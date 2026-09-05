import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DESEN_APP_LOCAL_DEV_ORIGIN,
  DESEN_APP_LOCAL_RUNTIME_DEFINE_NAME,
  DESEN_APP_LOCAL_RUNTIME_PROFILE,
  DESEN_APP_LOCAL_OPERATION_DEFINE_NAME,
  DESEN_APP_LOCAL_OPERATION_PROFILE,
  DESEN_APP_LOCAL_PUBLICATION_DEFINE_NAME,
  DESEN_APP_LOCAL_PUBLICATION_PROFILE,
  DESEN_APP_LOCAL_VITE_FS_DENY,
  DesenAppLocalDevHostError,
  createDesenAppLocalApiToken,
  createDesenAppLocalOperationDefine,
  createDesenAppLocalPublicationDefine,
  createDesenAppLocalRuntimeDefine,
  prepareDesenAppLocalStateRoot,
  startDesenAppLocalDev,
} from "./local-dev-host.mjs";

const roots = [];

function deterministicIndependentEntropy(seed) {
  let next = seed;
  return () => new Uint8Array(32).fill(next++);
}

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
    expect(
      JSON.parse(
        createDesenAppLocalOperationDefine("http://127.0.0.1:43128", token)[
          DESEN_APP_LOCAL_OPERATION_DEFINE_NAME
        ],
      ),
    ).toEqual({
      profile: DESEN_APP_LOCAL_OPERATION_PROFILE,
      origin: "http://127.0.0.1:43128",
      apiToken: token,
    });
    const publicationToken = createDesenAppLocalApiToken(() => new Uint8Array(32).fill(0xac));
    expect(
      JSON.parse(
        createDesenAppLocalPublicationDefine(
          "http://127.0.0.1:43127",
          token,
          "http://127.0.0.1:43129",
          publicationToken,
          "preview",
          "reference-host-web",
        )[DESEN_APP_LOCAL_PUBLICATION_DEFINE_NAME],
      ),
    ).toEqual({
      profile: DESEN_APP_LOCAL_PUBLICATION_PROFILE,
      controlPlane: { origin: "http://127.0.0.1:43127", apiToken: token },
      activation: { origin: "http://127.0.0.1:43129", apiToken: publicationToken },
      destination: { channelName: "preview", hostId: "reference-host-web" },
    });
    expect(() => createDesenAppLocalRuntimeDefine("https://127.0.0.1:43127", token)).toThrowError(
      new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG"),
    );
  });

  it("starts independently authorized services before fixed-port Vite and revokes all exactly once", async () => {
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
    const operationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43128,
        origin: "http://127.0.0.1:43128",
      })),
      close: vi.fn(async () => undefined),
    };
    let operationOptions;
    const openOperationHost = vi.fn(async (options) => {
      operationOptions = options;
      return operationHost;
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
      openOperationHost,
      createViteServer,
      entropy: deterministicIndependentEntropy(7),
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
    const injectedOperationConfig = JSON.parse(
      viteConfig.define[DESEN_APP_LOCAL_OPERATION_DEFINE_NAME],
    );
    expect(injectedOperationConfig).toEqual({
      profile: DESEN_APP_LOCAL_OPERATION_PROFILE,
      origin: "http://127.0.0.1:43128",
      apiToken: operationOptions.apiToken,
    });
    expect(operationOptions.allowedOrigin).toBe(DESEN_APP_LOCAL_DEV_ORIGIN);
    expect(operationOptions.apiToken).not.toBe(controlPlaneOptions.apiToken);
    expect(operationHost.listen).toHaveBeenCalledExactlyOnceWith(0);
    expect(viteServer.listen).toHaveBeenCalledTimes(1);

    await host.close();
    await host.close();

    expect(viteServer.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(operationHost.close).toHaveBeenCalledTimes(1);
  });

  it("composes one separately built host and independent fixed activation edge for local publication", async () => {
    const appDirectory = await temporaryAppDirectory();
    const clientRootDirectory = await temporaryAppDirectory();
    const installedPackageDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    const operationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43128,
        origin: "http://127.0.0.1:43128",
      })),
      close: vi.fn(async () => undefined),
    };
    const referenceHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43129,
        origin: "http://127.0.0.1:43129",
      })),
      activatePublishedRevision: vi.fn(async () => ({
        status: "active",
        relationship: "activated",
        activeRevision: `sha256:${"a".repeat(64)}`,
        activationGeneration: 0,
      })),
      close: vi.fn(async () => undefined),
    };
    let referenceOptions;
    const openReferenceHost = vi.fn(async (options) => {
      referenceOptions = options;
      return referenceHost;
    });
    const publicationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43130,
        origin: "http://127.0.0.1:43130",
      })),
      close: vi.fn(async () => undefined),
    };
    let publicationOptions;
    const openPublicationHost = vi.fn(async (options) => {
      publicationOptions = options;
      return publicationHost;
    });
    const buildReferenceHost = vi.fn(async () => undefined);
    const viteServer = {
      listen: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    let viteConfig;

    const host = await startDesenAppLocalDev({
      appDirectory,
      stateDirectory,
      openControlPlane: async () => controlPlane,
      openOperationHost: async () => operationHost,
      openReferenceHost,
      openPublicationHost,
      buildReferenceHost,
      createViteServer: async (config) => {
        viteConfig = config;
        return viteServer;
      },
      entropy: deterministicIndependentEntropy(21),
      publication: {
        channelName: "preview",
        clientRootDirectory,
        hostId: "reference-host-web",
        installedPackageDirectory,
      },
    });

    expect(host.referenceHostOrigin).toBe("http://127.0.0.1:43129");
    expect(buildReferenceHost).toHaveBeenCalledTimes(1);
    expect(buildReferenceHost.mock.calls[0]?.[0]).toMatchObject({
      root: clientRootDirectory,
      appType: "spa",
      configFile: false,
      envDir: false,
      build: {
        emptyOutDir: true,
        outDir: join(stateDirectory, "desen-app", "reference-host-web-dist"),
      },
    });
    expect(referenceOptions).toMatchObject({
      rootDirectory: join(stateDirectory, "desen-app", "control-plane"),
      installedPackageDirectory,
      clientBuildDirectory: join(stateDirectory, "desen-app", "reference-host-web-dist"),
      channelName: "preview",
    });
    expect(publicationOptions).toMatchObject({
      allowedOrigin: DESEN_APP_LOCAL_DEV_ORIGIN,
      channelName: "preview",
      hostId: "reference-host-web",
    });
    expect(publicationOptions.apiToken).not.toBe(referenceOptions.controlPlaneApiToken);
    const request = {
      channelName: "preview",
      channelGeneration: 1,
      hostId: "reference-host-web",
      revision: `sha256:${"a".repeat(64)}`,
    };
    await expect(publicationOptions.activatePublishedRevision(request)).resolves.toMatchObject({
      status: "active",
    });
    expect(referenceHost.activatePublishedRevision).toHaveBeenCalledExactlyOnceWith({
      channelName: "preview",
      channelGeneration: 1,
      revision: request.revision,
    });
    const config = JSON.parse(viteConfig.define[DESEN_APP_LOCAL_PUBLICATION_DEFINE_NAME]);
    expect(config).toEqual({
      profile: DESEN_APP_LOCAL_PUBLICATION_PROFILE,
      controlPlane: {
        origin: "http://127.0.0.1:43127",
        apiToken: referenceOptions.controlPlaneApiToken,
      },
      activation: { origin: "http://127.0.0.1:43130", apiToken: publicationOptions.apiToken },
      destination: { channelName: "preview", hostId: "reference-host-web" },
    });

    await host.close();
    await host.close();
    expect(viteServer.close).toHaveBeenCalledTimes(1);
    expect(publicationHost.close).toHaveBeenCalledTimes(1);
    expect(referenceHost.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(viteServer.close.mock.invocationCallOrder[0]).toBeLessThan(
      publicationHost.close.mock.invocationCallOrder[0],
    );
    expect(publicationHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      referenceHost.close.mock.invocationCallOrder[0],
    );
    expect(referenceHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      operationHost.close.mock.invocationCallOrder[0],
    );
    expect(operationHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      controlPlane.close.mock.invocationCallOrder[0],
    );
  });

  it("rejects a symlinked reference-host build root without emptying its target", async () => {
    const appDirectory = await temporaryAppDirectory();
    const clientRootDirectory = await temporaryAppDirectory();
    const installedPackageDirectory = await temporaryAppDirectory();
    const outside = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const appStateDirectory = join(stateDirectory, "desen-app");
    const buildDirectory = join(appStateDirectory, "reference-host-web-dist");
    const sentinel = join(outside, "must-survive.txt");
    await mkdir(appStateDirectory, { recursive: true, mode: 0o700 });
    await writeFile(sentinel, "preserved", "utf8");
    await symlink(outside, buildDirectory);

    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    const operationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43128,
        origin: "http://127.0.0.1:43128",
      })),
      close: vi.fn(async () => undefined),
    };
    const buildReferenceHost = vi.fn(async () => undefined);
    const openReferenceHost = vi.fn();
    const openPublicationHost = vi.fn();

    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane: async () => controlPlane,
        openOperationHost: async () => operationHost,
        openReferenceHost,
        openPublicationHost,
        buildReferenceHost,
        createViteServer: vi.fn(),
        entropy: deterministicIndependentEntropy(25),
        publication: {
          channelName: "preview",
          clientRootDirectory,
          hostId: "reference-host-web",
          installedPackageDirectory,
        },
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("LOCAL_START_FAILED"));

    expect(buildReferenceHost).not.toHaveBeenCalled();
    expect(openReferenceHost).not.toHaveBeenCalled();
    expect(openPublicationHost).not.toHaveBeenCalled();
    expect(await readFile(sentinel, "utf8")).toBe("preserved");
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(operationHost.close).toHaveBeenCalledTimes(1);
  });

  it("revokes a partially opened publication composition from the edge inward", async () => {
    const appDirectory = await temporaryAppDirectory();
    const clientRootDirectory = await temporaryAppDirectory();
    const installedPackageDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const controlPlane = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43127,
        origin: "http://127.0.0.1:43127",
      })),
      close: vi.fn(async () => undefined),
    };
    const operationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43128,
        origin: "http://127.0.0.1:43128",
      })),
      close: vi.fn(async () => undefined),
    };
    const referenceHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43129,
        origin: "http://127.0.0.1:43129",
      })),
      activatePublishedRevision: vi.fn(),
      close: vi.fn(async () => undefined),
    };
    const publicationHost = {
      listen: vi.fn(async () => {
        throw new Error("private-publication-listener-detail");
      }),
      close: vi.fn(async () => undefined),
    };
    const createViteServer = vi.fn();

    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane: async () => controlPlane,
        openOperationHost: async () => operationHost,
        openReferenceHost: async () => referenceHost,
        openPublicationHost: async () => publicationHost,
        buildReferenceHost: async () => undefined,
        createViteServer,
        entropy: deterministicIndependentEntropy(31),
        publication: {
          channelName: "preview",
          clientRootDirectory,
          hostId: "reference-host-web",
          installedPackageDirectory,
        },
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("LOCAL_START_FAILED"));

    expect(publicationHost.close).toHaveBeenCalledTimes(1);
    expect(referenceHost.close).toHaveBeenCalledTimes(1);
    expect(operationHost.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(createViteServer).not.toHaveBeenCalled();
    expect(publicationHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      referenceHost.close.mock.invocationCallOrder[0],
    );
    expect(referenceHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      operationHost.close.mock.invocationCallOrder[0],
    );
    expect(operationHost.close.mock.invocationCallOrder[0]).toBeLessThan(
      controlPlane.close.mock.invocationCallOrder[0],
    );
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
    const operationHost = {
      listen: vi.fn(async () => ({
        address: "127.0.0.1",
        port: 43128,
        origin: "http://127.0.0.1:43128",
      })),
      close: vi.fn(async () => undefined),
    };

    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane: async () => controlPlane,
        openOperationHost: async () => operationHost,
        createViteServer: async () => viteServer,
        entropy: deterministicIndependentEntropy(9),
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("LOCAL_START_FAILED"));
    expect(viteServer.close).toHaveBeenCalledTimes(1);
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(operationHost.close).toHaveBeenCalledTimes(1);
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
      entropy: deterministicIndependentEntropy(11),
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

  it("does not admit a reused persistence bearer as local operation authority", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const openControlPlane = vi.fn();
    const openOperationHost = vi.fn();
    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane,
        openOperationHost,
        entropy: () => new Uint8Array(32).fill(12),
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG"));
    expect(openControlPlane).not.toHaveBeenCalled();
    expect(openOperationHost).not.toHaveBeenCalled();
  });

  it("does not open any service when host activation reuses another local authority", async () => {
    const appDirectory = await temporaryAppDirectory();
    const stateDirectory = await stateDirectoryFor(appDirectory);
    const openControlPlane = vi.fn();
    const openOperationHost = vi.fn();
    const entropyValues = [
      new Uint8Array(32).fill(17),
      new Uint8Array(32).fill(18),
      new Uint8Array(32).fill(17),
    ];

    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane,
        openOperationHost,
        entropy: () => entropyValues.shift(),
        publication: {
          channelName: "preview",
          clientRootDirectory: appDirectory,
          hostId: "reference-host-web",
          installedPackageDirectory: appDirectory,
        },
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("INVALID_RUNTIME_CONFIG"));

    expect(openControlPlane).not.toHaveBeenCalled();
    expect(openOperationHost).not.toHaveBeenCalled();
  });

  it("revokes Source authority when the separately authorized operation listener cannot start", async () => {
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
    const operationHost = {
      listen: vi.fn(async () => {
        throw new Error("private-operation-listener-detail");
      }),
      close: vi.fn(async () => undefined),
    };
    const createViteServer = vi.fn();
    await expect(
      startDesenAppLocalDev({
        appDirectory,
        stateDirectory,
        openControlPlane: async () => controlPlane,
        openOperationHost: async () => operationHost,
        createViteServer,
        entropy: deterministicIndependentEntropy(13),
      }),
    ).rejects.toEqual(new DesenAppLocalDevHostError("LOCAL_START_FAILED"));
    expect(controlPlane.close).toHaveBeenCalledTimes(1);
    expect(operationHost.close).toHaveBeenCalledTimes(1);
    expect(createViteServer).not.toHaveBeenCalled();
  });
});
