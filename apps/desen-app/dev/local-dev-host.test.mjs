import { lstat, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DESEN_APP_LOCAL_DEV_ORIGIN,
  DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME,
  DESEN_APP_LOCAL_RUNTIME_PROFILE,
  DESEN_APP_LOCAL_VITE_FS_DENY,
  DesenAppLocalDevHostError,
  createDesenAppLocalApiToken,
  createDesenAppLocalRuntimeDefine,
  prepareDesenAppLocalStateRoot,
  startDesenAppLocalDev,
} from "./local-dev-host.mjs";

const roots = [];

async function temporaryAppDirectory() {
  const root = await mkdtemp(join(tmpdir(), "desen-app-local-dev-"));
  roots.push(root);
  return realpath(root);
}

async function stateDirectoryFor(appDirectory) {
  const stateParent = `${appDirectory}-state-root`;
  roots.push(stateParent);
  await mkdir(stateParent, { mode: 0o700 });
  return join(stateParent, ".desen");
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map(async (root) => rm(root, { force: true, recursive: true })),
  );
});

describe("Desen App local development host", () => {
  it("creates and reuses a private app-owned durable control-plane root", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const first = await prepareDesenAppLocalStateRoot(stateDirectory);
    const second = await prepareDesenAppLocalStateRoot(stateDirectory);
    const stats = await lstat(first);

    expect(first).toBe(join(stateDirectory, "desen-app", "control-plane"));
    expect(second).toBe(first);
    expect(stats.isDirectory()).toBe(true);
    expect(stats.isSymbolicLink()).toBe(false);
    expect(stats.mode & 0o777).toBe(0o700);
  });

  it("rejects a symlinked local state root without following it", async () => {
    const appDirectory = await temporaryAppDirectory();
    const outside = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    await symlink(outside, stateDirectory);

    await expect(prepareDesenAppLocalStateRoot(stateDirectory)).rejects.toEqual(
      new DesenAppLocalDevHostError("UNSAFE_STATE_ROOT"),
    );
  });

  it("generates a finite random token and an exact closed Vite runtime definition", () => {
    const token = createDesenAppLocalApiToken(() => new Uint8Array(32).fill(0xab));
    const define = createDesenAppLocalRuntimeDefine("http://127.0.0.1:43127", token);
    const config = JSON.parse(define[DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME]);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(config).toEqual({
      profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
      controlPlane: { origin: "http://127.0.0.1:43127", apiToken: token },
    });
    expect(Object.keys(define)).toEqual([DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME]);
    expect(() => createDesenAppLocalRuntimeDefine("https://127.0.0.1:43127", token)).toThrowError(
      new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG"),
    );
  });

  it("starts control-plane before fixed-port Vite and revokes both exactly once", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    let controlPlaneOptions;
    const openControlPlane = vi.fn(async (options) => {
      controlPlaneOptions = options;
      return controlPlane;
    });
    const viteServer = {
      listen: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    let viteConfig;
    const createViteServer = vi.fn(async (config) => {
      viteConfig = config;
      return viteServer;
    });

    const host = await startDesenAppLocalDev({
      appDirectory,
      stateDirectory,
      openControlPlane,
      createViteServer,
      entropy: () => new Uint8Array(32).fill(7),
    });

    expect(controlPlaneOptions.rootDirectory).toBe(
      join(stateDirectory, "desen-app", "control-plane"),
    );
    expect(controlPlaneOptions.allowedOrigins).toEqual([DESEN_APP_LOCAL_DEV_ORIGIN]);
    expect(controlPlaneOptions.apiToken).toHaveLength(43);
    expect(viteConfig).toMatchObject({
      root: appDirectory,
      appType: "spa",
      configFile: false,
      envDir: false,
      server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        open: false,
        origin: DESEN_APP_LOCAL_DEV_ORIGIN,
        fs: {
          strict: true,
          deny: DESEN_APP_LOCAL_VITE_FS_DENY,
        },
      },
    });
    expect(viteConfig.plugins.map(({ name }) => name)).toContain("desen-app-local-state-deny");
    const injectedConfig = JSON.parse(viteConfig.define[DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME]);
    expect(injectedConfig.controlPlane.apiToken).toBe(controlPlaneOptions.apiToken);
    expect(viteServer.listen).toHaveBeenCalledTimes(1);

    await host.close();
    await host.close();

    expect(viteServer.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
  });

  it("closes an opened control plane when Vite startup fails", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    const viteServer = {
      listen: vi.fn(async () => {
        throw new Error("address detail that must not escape");
      }),
      close: vi.fn(async () => undefined),
    };

    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane: async () => controlPlane,
        createViteServer: async () => viteServer,
        entropy: () => new Uint8Array(32).fill(9),
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("LOCAL_START_FAILED"));
    expect(viteServer.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
  });

  it("returns an exact denial instead of serving local state or the SPA fallback", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    await writeFile(
      join(appDirectory, "index.html"),
      "<!doctype html><title>Desen local state boundary</title>",
      "utf8",
    );
    let controlPlaneRoot;
    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    const host = await startDesenAppLocalDev({
      appDirectory,
      stateDirectory,
      openControlPlane: async (options) => {
        controlPlaneRoot = options.rootDirectory;
        return controlPlane;
      },
      entropy: () => new Uint8Array(32).fill(11),
    });

    try {
      if (typeof controlPlaneRoot !== "string") {
        throw new Error("Expected the local state root to be captured.");
      }
      const secret = "sqlite-source-secret-that-must-never-be-served";
      const databasePath = join(controlPlaneRoot, "control-plane.sqlite3");
      await writeFile(databasePath, secret, { encoding: "utf8", mode: 0o600 });
      const requests = [
        `${host.appOrigin}/.desen/control-plane/control-plane.sqlite3`,
        `${host.appOrigin}/%2EDeSeN/control-plane/control-plane.sqlite3`,
        `${host.appOrigin}/@fs/${databasePath}`,
      ];

      for (const request of requests) {
        const response = await fetch(request, { redirect: "error" });
        const body = await response.text();
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(body).not.toContain(secret);
      }
    } finally {
      await host.close();
    }
  });
});
