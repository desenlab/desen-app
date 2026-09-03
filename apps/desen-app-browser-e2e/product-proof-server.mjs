import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { openLocalControlPlane } from "@desen/control-plane-api";
import { build, preview } from "vite";
import { openDesenAppLocalOperationHost } from "../desen-app/dev/local-operation-host.mjs";

const APP_HOST = "127.0.0.1";
const WITH_OPERATIONS = process.argv.includes("--with-operations");
const APP_PORT = WITH_OPERATIONS ? 4176 : 4175;
const APP_ORIGIN = `http://${APP_HOST}:${APP_PORT}`;
const APP_ROOT = resolve(import.meta.dirname, "../desen-app");
const LOCAL_RUNTIME_DEFINE_NAME = "__DESEN_APP_LOCAL_RUNTIME_CONFIG__";
const LOCAL_RUNTIME_PROFILE = "desen.app.local-runtime.v1";

let controlPlane;
let operationHost;
let previewServer;
let temporaryRoot;
let shutdownPromise;

function closeHttpServer(server) {
  const closing = new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error === undefined) resolveClose();
      else rejectClose(error);
    });
  });
  server.closeAllConnections();
  return closing;
}

async function cleanup() {
  let failed = false;
  if (previewServer !== undefined) {
    try {
      await closeHttpServer(previewServer.httpServer);
    } catch {
      failed = true;
    }
  }
  if (controlPlane !== undefined) {
    try {
      await controlPlane.close();
    } catch {
      failed = true;
    }
  }
  if (operationHost !== undefined) {
    try {
      await operationHost.close();
    } catch {
      failed = true;
    }
  }
  if (temporaryRoot !== undefined) {
    try {
      await rm(temporaryRoot, { force: true, recursive: true });
    } catch {
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
}

function shutdown() {
  shutdownPromise ??= cleanup();
  return shutdownPromise;
}

function receiveShutdownSignal() {
  void shutdown().then(
    () => process.exit(process.exitCode ?? 0),
    () => process.exit(1),
  );
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, receiveShutdownSignal);
}

try {
  temporaryRoot = await mkdtemp(join(tmpdir(), "desen-product-browser-proof-"));
  const controlPlaneRoot = join(temporaryRoot, "control-plane");
  const productDist = join(temporaryRoot, "product-dist");
  await mkdir(controlPlaneRoot, { mode: 0o700 });

  const apiToken = randomBytes(32).toString("base64url");
  controlPlane = await openLocalControlPlane({
    rootDirectory: controlPlaneRoot,
    apiToken,
    allowedOrigins: Object.freeze([APP_ORIGIN]),
  });
  const listener = await controlPlane.listen(0);
  const localRuntimeConfig = Object.freeze({
    profile: LOCAL_RUNTIME_PROFILE,
    controlPlane: Object.freeze({ origin: listener.origin, apiToken }),
  });
  let operationDefine = {};
  if (WITH_OPERATIONS) {
    const operationToken = randomBytes(32).toString("base64url");
    operationHost = await openDesenAppLocalOperationHost({
      apiToken: operationToken,
      allowedOrigin: APP_ORIGIN,
    });
    const operationListener = await operationHost.listen(0);
    operationDefine = {
      __DESEN_APP_LOCAL_OPERATION_CONFIG__: JSON.stringify({
        profile: "desen.app.local-operation.v1",
        origin: operationListener.origin,
        apiToken: operationToken,
      }),
    };
  }

  await build({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "warn",
    define: {
      [LOCAL_RUNTIME_DEFINE_NAME]: JSON.stringify(localRuntimeConfig),
      ...operationDefine,
    },
    build: {
      emptyOutDir: true,
      outDir: productDist,
    },
  });

  previewServer = await preview({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "warn",
    build: { outDir: productDist },
    preview: {
      host: APP_HOST,
      port: APP_PORT,
      strictPort: true,
    },
  });
  // Vite's programmatic preview installs its own immediate SIGTERM exit after this server's
  // cleanup listener. This process owns the complete proof composition, so replace that immediate
  // exit with the cleanup path that first closes SQLite and removes the private temporary root.
  process.removeAllListeners("SIGTERM");
  process.once("SIGTERM", receiveShutdownSignal);
  process.stdout.write(`Desen App product proof is ready at ${APP_ORIGIN}\n`);
} catch {
  process.stderr.write("The Desen App product proof server could not start.\n");
  process.exitCode = 1;
  await shutdown();
}
