import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

import { openLocalControlPlane } from "@desen/control-plane-api";
import { openReferenceHostWebServer } from "@desen/reference-host-web-server";
import { build, preview } from "vite";

import { openDesenAppLocalPublicationHost } from "../desen-app/dev/local-publication-host.mjs";

const APP_HOST = "127.0.0.1";
const APP_PORT = 4_177;
const REFERENCE_HOST_PORT = 4_178;
const APP_ORIGIN = `http://${APP_HOST}:${String(APP_PORT)}`;
const REFERENCE_HOST_ORIGIN = `http://${APP_HOST}:${String(REFERENCE_HOST_PORT)}`;
const APP_ROOT = resolve(import.meta.dirname, "../desen-app");
const REFERENCE_HOST_ROOT = resolve(import.meta.dirname, "../reference-host-web");
const INSTALLED_PACKAGE_ROOT = resolve(import.meta.dirname, "../../packages/reference-catalog-web");
const CHANNEL_NAME = "preview";
const HOST_ID = "reference-host-web";

let activationBridge;
let controlPlane;
let previewServer;
let referenceHost;
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
  for (const close of [
    async () => {
      if (previewServer !== undefined) await closeHttpServer(previewServer.httpServer);
    },
    async () => activationBridge?.close(),
    async () => referenceHost?.close(),
    async () => controlPlane?.close(),
    async () => {
      if (temporaryRoot !== undefined) await rm(temporaryRoot, { force: true, recursive: true });
    },
  ]) {
    try {
      await close();
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
  temporaryRoot = await realpath(
    await mkdtemp(join(tmpdir(), "desen-published-host-browser-proof-")),
  );
  const controlPlaneRoot = join(temporaryRoot, "control-plane");
  const productDist = join(temporaryRoot, "product-dist");
  const referenceHostDist = join(temporaryRoot, "reference-host-dist");
  await mkdir(controlPlaneRoot, { mode: 0o700 });

  const controlPlaneToken = randomBytes(32).toString("base64url");
  const activationToken = randomBytes(32).toString("base64url");
  if (controlPlaneToken === activationToken) throw new TypeError("Independent tokens collided.");

  controlPlane = await openLocalControlPlane({
    rootDirectory: controlPlaneRoot,
    apiToken: controlPlaneToken,
    allowedOrigins: Object.freeze([APP_ORIGIN]),
  });
  const controlPlaneListener = await controlPlane.listen(0);

  await build({
    root: REFERENCE_HOST_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "warn",
    build: { emptyOutDir: true, outDir: referenceHostDist },
  });
  referenceHost = await openReferenceHostWebServer({
    rootDirectory: controlPlaneRoot,
    installedPackageDirectory: INSTALLED_PACKAGE_ROOT,
    clientBuildDirectory: referenceHostDist,
    controlPlaneOrigin: controlPlaneListener.origin,
    controlPlaneApiToken: controlPlaneToken,
    channelName: CHANNEL_NAME,
  });
  const referenceHostListener = await referenceHost.listen(REFERENCE_HOST_PORT);
  if (referenceHostListener.origin !== REFERENCE_HOST_ORIGIN) {
    throw new TypeError("Unexpected reference-host identity.");
  }

  activationBridge = await openDesenAppLocalPublicationHost({
    apiToken: activationToken,
    allowedOrigin: APP_ORIGIN,
    channelName: CHANNEL_NAME,
    hostId: HOST_ID,
    activatePublishedRevision: ({ channelName, channelGeneration, revision }) =>
      referenceHost.activatePublishedRevision({ channelName, channelGeneration, revision }),
  });
  const activationListener = await activationBridge.listen(0);

  await build({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "warn",
    define: {
      __DESEN_APP_LOCAL_RUNTIME_CONFIG__: JSON.stringify({
        profile: "desen.app.local-runtime.v1",
        controlPlane: { origin: controlPlaneListener.origin, apiToken: controlPlaneToken },
      }),
      __DESEN_APP_LOCAL_PUBLICATION_CONFIG__: JSON.stringify({
        profile: "desen.app.local-publication.v1",
        controlPlane: { origin: controlPlaneListener.origin, apiToken: controlPlaneToken },
        activation: { origin: activationListener.origin, apiToken: activationToken },
        destination: { channelName: CHANNEL_NAME, hostId: HOST_ID },
      }),
    },
    build: { emptyOutDir: true, outDir: productDist },
  });

  previewServer = await preview({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "warn",
    build: { outDir: productDist },
    preview: { host: APP_HOST, port: APP_PORT, strictPort: true },
  });
  process.removeAllListeners("SIGTERM");
  process.once("SIGTERM", receiveShutdownSignal);
  process.stdout.write(
    `DESEN published-host proof is ready at ${APP_ORIGIN} with host ${REFERENCE_HOST_ORIGIN}\n`,
  );
} catch {
  process.stderr.write("The DESEN published-host proof server could not start.\n");
  process.exitCode = 1;
  await shutdown();
}
