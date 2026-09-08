import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DesenAppLocalDemoError,
  acquireDesenAppDemoState,
  startDesenAppLocalDemo,
} from "./local-demo-host.mjs";
import { DesenAppLocalDevHostError } from "./local-dev-host.mjs";

const roots = [];
const leases = [];
async function workspace() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "desen-demo-state-test-")));
  roots.push(root);
  return root;
}
async function acquire(root, reset = false) {
  const state = await acquireDesenAppDemoState({ workspaceDirectory: root, reset });
  leases.push(state);
  return state;
}
afterEach(async () => {
  vi.restoreAllMocks();
  vi.doUnmock("./local-demo-host.mjs");
  await Promise.all(leases.splice(0).map((lease) => lease.release().catch(() => undefined)));
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("normal demo command shutdown", () => {
  async function importCommand(startHost, caseName) {
    const handlers = new Map();
    const originalOn = process.on.bind(process);
    vi.spyOn(process, "on").mockImplementation((event, handler) => {
      if (["SIGINT", "SIGTERM", "SIGHUP"].includes(event)) {
        handlers.set(event, handler);
        return process;
      }
      return originalOn(event, handler);
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.doMock("./local-demo-host.mjs", () => ({
      DesenAppLocalDemoError,
      startDesenAppLocalDemo: startHost,
    }));
    const previousArgs = process.argv;
    process.argv = [process.execPath, "local-demo.mjs"];
    const loaded =
      caseName === "ready"
        ? import("./local-demo.mjs?shutdown=ready")
        : import("./local-demo.mjs?shutdown=starting");
    // Dynamic loading is asynchronous; retain the CLI arguments until its main settles.
    const completion = loaded.finally(() => {
      process.argv = previousArgs;
    });
    await vi.waitFor(() => expect(handlers.size).toBe(3));
    return { handlers, completion };
  }

  it("drains one close across repeated shutdown signals without releasing ownership early", async () => {
    let finishClose;
    const closed = new Promise((resolve) => {
      finishClose = resolve;
    });
    const close = vi.fn(() => closed);
    const { handlers, completion } = await importCommand(
      vi.fn(async () => ({
        appOrigin: "http://127.0.0.1:5173",
        referenceHostOrigin: "http://127.0.0.1:30000",
        close,
      })),
      "ready",
    );
    await completion;
    for (const signal of ["SIGINT", "SIGTERM", "SIGINT", "SIGHUP"]) handlers.get(signal)();
    expect(close).toHaveBeenCalledTimes(1);
    finishClose();
    await closed;
  });

  it("finishes interrupted startup before draining its composed host exactly once", async () => {
    let finishStart;
    const started = new Promise((resolve) => {
      finishStart = resolve;
    });
    const close = vi.fn(async () => undefined);
    const { handlers, completion } = await importCommand(() => started, "starting");
    handlers.get("SIGINT")();
    handlers.get("SIGTERM")();
    expect(close).not.toHaveBeenCalled();
    finishStart({ appOrigin: "unused", referenceHostOrigin: null, close });
    await completion;
    expect(close).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("fixed local demo state", () => {
  it("starts empty, reopens the same generation, and retains exactly the latest reset without touching ordinary projects", async () => {
    const root = await workspace();
    const first = await acquire(root);
    expect(first.stateDirectory).toBe(join(root, ".desen/m10-demo/current"));
    expect(await readdir(first.stateDirectory)).toEqual([]);
    expect((await lstat(first.stateDirectory)).mode & 0o777).toBe(0o700);
    const normal = join(root, ".desen/desen-app");
    await mkdir(normal, { mode: 0o700 });
    await writeFile(join(normal, "keep"), "existing designer project");
    await writeFile(join(first.stateDirectory, "source"), "generation A");
    await first.release();
    await first.release();
    const reopen = await acquire(root);
    expect(await readFile(join(reopen.stateDirectory, "source"), "utf8")).toBe("generation A");
    await reopen.release();
    const second = await acquire(root, true);
    expect(await readdir(second.stateDirectory)).toEqual([]);
    const backup = join(root, ".desen/m10-demo/previous/source");
    expect(await readFile(backup, "utf8")).toBe("generation A");
    await writeFile(join(second.stateDirectory, "source"), "generation B");
    await second.release();
    const third = await acquire(root, true);
    expect(await readdir(third.stateDirectory)).toEqual([]);
    expect(await readFile(backup, "utf8")).toBe("generation B");
    expect((await readdir(join(root, ".desen/m10-demo"))).sort()).toEqual([
      "current",
      "lease",
      "owner",
      "previous",
    ]);
    expect(await readFile(join(normal, "keep"), "utf8")).toBe("existing designer project");
  });

  it("refuses reset and concurrent start while the exact owner is live", async () => {
    const root = await workspace();
    const state = await acquire(root);
    await writeFile(join(state.stateDirectory, "keep"), "untouched");
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
    await expect(acquire(root)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
    expect(await readFile(join(state.stateDirectory, "keep"), "utf8")).toBe("untouched");
  });

  it("never automatically reclaims a stale lease or interprets its PID as kill authority", async () => {
    const root = await workspace();
    const state = await acquire(root);
    await state.release();
    await writeFile(join(root, ".desen/m10-demo/lease"), "pid=99999999\n", { mode: 0o600 });
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
  });

  it("rejects a preexisting foreign or incompletely initialized demo root", async () => {
    const root = await workspace();
    await mkdir(join(root, ".desen"), { mode: 0o700 });
    await mkdir(join(root, ".desen/m10-demo"), { mode: 0o700 });
    const keep = join(root, ".desen/m10-demo/keep");
    await writeFile(keep, "foreign");
    await expect(acquire(root, true)).rejects.toThrow();
    expect(await readFile(keep, "utf8")).toBe("foreign");
  });

  for (const target of [".desen", ".desen/m10-demo", ".desen/m10-demo/current"]) {
    it(`rejects a symbolic link at ${target} without changing its destination`, async () => {
      const root = await workspace();
      const outside = await workspace();
      await writeFile(join(outside, "keep"), "outside");
      const state = await acquire(root);
      await state.release();
      await rename(join(root, target), join(root, "displaced"));
      await symlink(outside, join(root, target));
      await expect(acquire(root, true)).rejects.toThrow();
      expect(await readFile(join(outside, "keep"), "utf8")).toBe("outside");
    });
  }

  for (const kind of ["symlink", "hardlink", "writable"]) {
    it(`rejects unsafe ${kind} descendants before pruning either generation`, async () => {
      const root = await workspace();
      const outside = await workspace();
      const outsideFile = join(outside, "keep");
      await writeFile(outsideFile, "outside");
      const first = await acquire(root);
      await writeFile(join(first.stateDirectory, "kept"), "A");
      await first.release();
      const second = await acquire(root, true);
      const hostile = join(second.stateDirectory, "unsafe");
      if (kind === "symlink") await symlink(outsideFile, hostile);
      else if (kind === "hardlink") await link(outsideFile, hostile);
      else {
        await writeFile(hostile, "untrusted");
        await chmod(hostile, 0o666);
      }
      await second.release();
      await expect(acquire(root, true)).rejects.toMatchObject({ code: "UNSAFE_DEMO_STATE" });
      expect(await readFile(join(root, ".desen/m10-demo/previous/kept"), "utf8")).toBe("A");
      expect(await readFile(outsideFile, "utf8")).toBe("outside");
    });
  }

  it("rejects a tampered owner marker and non-private directory", async () => {
    const root = await workspace();
    const state = await acquire(root);
    await state.release();
    await writeFile(join(root, ".desen/m10-demo/owner"), "not owned");
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "UNSAFE_DEMO_STATE" });
    await chmod(join(root, ".desen/m10-demo"), 0o755);
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "UNSAFE_DEMO_STATE" });
  });

  it("does not unlink a replaced lease during release", async () => {
    const root = await workspace();
    const state = await acquire(root);
    const leasePath = join(root, ".desen/m10-demo/lease");
    await rename(leasePath, join(root, "old-lease"));
    await writeFile(leasePath, "replacement", { mode: 0o600 });
    await expect(state.release()).rejects.toMatchObject({ code: "UNSAFE_DEMO_STATE" });
    expect(await readFile(leasePath, "utf8")).toBe("replacement");
  });

  it("uses the normal product composition, closes it before releasing its store, and closes once", async () => {
    const root = await workspace();
    const close = vi.fn(async () => {
      await expect(acquire(root, true)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
    });
    const startHost = vi.fn(async () => ({
      appOrigin: "http://127.0.0.1:5173",
      referenceHostOrigin: "http://127.0.0.1:4190",
      close,
    }));
    const host = await startDesenAppLocalDemo({ workspaceDirectory: root, startHost });
    expect(startHost).toHaveBeenCalledExactlyOnceWith({
      appDirectory: join(root, "apps/desen-app"),
      stateDirectory: join(root, ".desen/m10-demo/current"),
      publication: {
        channelName: "preview",
        hostId: "reference-host-web",
        clientRootDirectory: join(root, "apps/reference-host-web"),
        installedPackageDirectory: join(root, "packages/reference-catalog-web"),
      },
    });
    expect(Object.keys(host).sort()).toEqual(["appOrigin", "close", "referenceHostOrigin"]);
    await Promise.all([host.close(), host.close()]);
    expect(close).toHaveBeenCalledOnce();
    await acquire(root, true);
  });

  it("retains the lease if composed services cannot close", async () => {
    const root = await workspace();
    const host = await startDesenAppLocalDemo({
      workspaceDirectory: root,
      startHost: async () => ({
        appOrigin: "http://127.0.0.1:5173",
        referenceHostOrigin: null,
        close: async () => {
          throw new Error("private detail");
        },
      }),
    });
    await expect(host.close()).rejects.toMatchObject({ code: "DEMO_STOP_FAILED" });
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
  });

  it("serializes concurrent releases of the same lease", async () => {
    const root = await workspace();
    const state = await acquire(root);
    await Promise.all([state.release(), state.release(), state.release()]);
    await acquire(root);
  });

  it("releases only a known fully cleaned startup failure", async () => {
    const root = await workspace();
    await expect(
      startDesenAppLocalDemo({
        workspaceDirectory: root,
        startHost: async () => {
          throw new DesenAppLocalDevHostError("LOCAL_START_FAILED");
        },
      }),
    ).rejects.toMatchObject({ code: "DEMO_START_FAILED" });
    await acquire(root);
  });

  for (const error of [
    new DesenAppLocalDevHostError("LOCAL_START_CLEANUP_FAILED"),
    new Error("private unknown failure"),
  ]) {
    it("retains uncertain startup ownership and redacts the original error", async () => {
      const root = await workspace();
      await expect(
        startDesenAppLocalDemo({
          workspaceDirectory: root,
          startHost: async () => {
            throw error;
          },
        }),
      ).rejects.toMatchObject({ code: "DEMO_STOP_FAILED" });
      await expect(acquire(root, true)).rejects.toMatchObject({ code: "DEMO_IN_USE" });
    });
  }

  it("bounds recursive reset scans instead of partially deleting an over-deep generation", async () => {
    const root = await workspace();
    const state = await acquire(root);
    let nested = state.stateDirectory;
    for (let depth = 0; depth < 33; depth += 1) {
      nested = join(nested, "d");
      await mkdir(nested);
    }
    await state.release();
    await expect(acquire(root, true)).rejects.toMatchObject({ code: "UNSAFE_DEMO_STATE" });
    expect((await lstat(nested)).isDirectory()).toBe(true);
  });
});
