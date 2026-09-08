import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";

import {
  openBundleRuntimeActivation,
  openLocalControlPlane,
  preflightBundlePackages,
  verifyBundleStoreEntry,
} from "@desen/control-plane-api";
import { calculateDesenBundleRevision } from "@desen/protocol";
import {
  loadReferenceHostInstalledPackage,
  openReferenceHostWebServer,
} from "@desen/reference-host-web-server";
import { build, preview } from "vite";

import { openDesenAppLocalPublicationHost } from "../desen-app/dev/local-publication-host.mjs";

const APP_ORIGIN = "http://127.0.0.1:4179";
const HOST_ORIGIN = "http://127.0.0.1:4180";
const APP_ROOT = resolve(import.meta.dirname, "../desen-app");
const HOST_ROOT = resolve(import.meta.dirname, "../reference-host-web");
const PACKAGE_ROOT = resolve(import.meta.dirname, "../../packages/reference-catalog-web");
const CHANNEL_NAME = "preview";
const HOST_ID = "reference-host-web";
const SOURCE_KEY = "account-app-source";
const MAX_RESPONSE_BYTES = 2_097_152;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const COMMANDS = Object.freeze(["boot", "observe", "install-negative", "shutdown"]);
const NEGATIVE_CASES = Object.freeze(["corrupt-revision", "catalog-mismatch"]);

let config;
let controlPlane;
let activationBridge;
let referenceHost;
let previewServer;
let controlPlaneOrigin;
let activationOrigin;
let buildIdentity;
let appSourceIdentity;
let closing;
let busy = false;
let lastRequestId = 0;
let lifecycleStage = "ipc";

function requireInvariant(value) {
  if (!value) throw new TypeError("The isolated recovery proof contract was not satisfied.");
}

function exactKeys(value, keys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function closePreview() {
  if (previewServer === undefined) return;
  const server = previewServer.httpServer;
  const stopped = new Promise((resolveStop, rejectStop) => {
    server.close((error) => (error === undefined ? resolveStop() : rejectStop(error)));
  });
  server.closeAllConnections();
  await stopped;
}

function shutdown() {
  closing ??= (async () => {
    let failed = false;
    for (const close of [
      closePreview,
      async () => activationBridge?.close(),
      async () => referenceHost?.close(),
      async () => controlPlane?.close(),
    ]) {
      try {
        await close();
      } catch {
        failed = true;
      }
    }
    // The supervisor alone owns deletion. Shutdown preserves durable records and both builds;
    // the next boot may refresh only the App's trusted launcher configuration.
    requireInvariant(!failed);
  })();
  return closing;
}

async function stopOnDisconnect() {
  try {
    await shutdown();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.once("disconnect", () => void stopOnDisconnect());
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => void stopOnDisconnect());
}

async function responseBytes(response) {
  requireInvariant(response.body !== null);
  const chunks = [];
  let length = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      requireInvariant(length <= MAX_RESPONSE_BYTES && chunks.length < 1_024);
      chunks.push(Buffer.from(next.value));
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new TypeError("A bounded recovery proof response could not be consumed.");
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

async function controlPlaneRequest(path, method = "GET", bytes, etag) {
  requireInvariant(config !== undefined && controlPlaneOrigin !== undefined);
  requireInvariant(
    /^\/v1\/(?:sources\/account-app-source|channels\/preview|bundles\/sha256:[0-9a-f]{64})$/u.test(
      path,
    ),
  );
  const response = await globalThis.fetch(`${controlPlaneOrigin}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.controlPlaneToken}`,
      ...(bytes === undefined ? {} : { "content-type": "application/json" }),
      ...(etag === undefined ? {} : { "if-match": etag }),
    },
    ...(bytes === undefined ? {} : { body: bytes }),
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(10_000),
  });
  const body = await responseBytes(response);
  requireInvariant(response.ok);
  return { body, etag: response.headers.get("etag"), status: response.status };
}

async function activationRecord() {
  const observer = await openBundleRuntimeActivation({
    rootDirectory: join(config.root, "control-plane"),
  });
  try {
    const state = observer.readState();
    if (state.status === "empty") return null;
    requireInvariant(state.status === "recovery-required" && state.record !== null);
    return state.record;
  } finally {
    observer.close();
  }
}

async function buildFiles(directory, requireBuild = true) {
  const entries = [];
  let totalBytes = 0;
  async function visit(relative) {
    const names = await readdir(join(directory, relative));
    for (const name of names.sort()) {
      requireInvariant(/^[a-zA-Z0-9._-]+$/u.test(name));
      const path = relative === "" ? name : `${relative}/${name}`;
      const stat = await lstat(join(directory, path));
      requireInvariant(!stat.isSymbolicLink());
      if (stat.isDirectory()) {
        requireInvariant(path.split("/").length < 4);
        await visit(path);
      } else {
        requireInvariant(stat.isFile() && entries.length < 128 && stat.size <= 16_777_216);
        const bytes = await readFile(join(directory, path));
        totalBytes += bytes.byteLength;
        requireInvariant(totalBytes <= 33_554_432);
        entries.push({ path, bytes: bytes.byteLength, sha256: hash(bytes) });
      }
    }
  }
  await visit("");
  requireInvariant(entries.length > 0);
  requireInvariant(
    !requireBuild ||
      (entries.some((entry) => entry.path === "index.html") &&
        entries.some((entry) => entry.path.endsWith(".js")) &&
        entries.some((entry) => entry.path.endsWith(".css"))),
  );
  return entries;
}

async function fingerprintBuilds() {
  const app = await buildFiles(join(config.root, "app-dist"));
  const host = await buildFiles(join(config.root, "host-dist"));
  return { app: hash(JSON.stringify(app)), host: hash(JSON.stringify(host)) };
}

async function verifyServedBuild(directory, origin) {
  const entries = await buildFiles(directory);
  for (const entry of entries) {
    const response = await globalThis.fetch(`${origin}/${entry.path}`, {
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(10_000),
    });
    requireInvariant(response.status === 200);
    const bytes = await responseBytes(response);
    requireInvariant(bytes.byteLength === entry.bytes && hash(bytes) === entry.sha256);
  }
  return hash(JSON.stringify(entries));
}

async function assessCandidate(revision, bytes) {
  const integrity = verifyBundleStoreEntry({ revision, bytes }, { status: "not-available" });
  if (integrity.status === "rejected") {
    return {
      status: "rejected",
      stage: integrity.stage,
      codes: integrity.diagnostics.map((diagnostic) => diagnostic.code),
    };
  }
  const inventory = await loadReferenceHostInstalledPackage({
    installedPackageDirectory: PACKAGE_ROOT,
  });
  const packages = preflightBundlePackages(integrity.authority, [inventory]);
  return packages.status === "rejected"
    ? {
        status: "rejected",
        stage: packages.stage,
        codes: packages.diagnostics.map((diagnostic) => diagnostic.code),
      }
    : { status: "verified" };
}

async function observe() {
  const channelResponse = await controlPlaneRequest(`/v1/channels/${CHANNEL_NAME}`);
  const channel = JSON.parse(channelResponse.body.toString("utf8"));
  requireInvariant(
    exactKeys(channel, ["channelName", "generation", "revision"]) &&
      channel.channelName === CHANNEL_NAME &&
      Number.isSafeInteger(channel.generation) &&
      DIGEST.test(channel.revision) &&
      channelResponse.etag === `"g:${String(channel.generation)}"`,
  );
  const bundle = await controlPlaneRequest(`/v1/bundles/${channel.revision}`);
  const source = await controlPlaneRequest(`/v1/sources/${SOURCE_KEY}`);
  const builds = {
    app: await verifyServedBuild(join(config.root, "app-dist"), APP_ORIGIN),
    host: await verifyServedBuild(join(config.root, "host-dist"), HOST_ORIGIN),
  };
  requireInvariant(JSON.stringify(builds) === JSON.stringify(buildIdentity));
  const appSource = hash(JSON.stringify(await buildFiles(join(APP_ROOT, "src"), false)));
  requireInvariant(appSource === appSourceIdentity);
  return {
    pid: process.pid,
    channel,
    activeRecord: await activationRecord(),
    source: { etag: source.etag, sha256: hash(source.body) },
    candidate: await assessCandidate(channel.revision, bundle.body),
    builds,
    appSource,
  };
}

async function installNegative(kind) {
  requireInvariant(NEGATIVE_CASES.includes(kind));
  const before = await observe();
  requireInvariant(before.activeRecord !== null);
  const existing = await controlPlaneRequest(`/v1/bundles/${before.activeRecord.activeRevision}`);
  const bundle = JSON.parse(existing.body.toString("utf8"));
  // Explicit transport-negative fixture derived from the real visible publication, not editor input.
  const text = bundle.surfaces["sign-in"].root.slots.default[0];
  requireInvariant(text.id === "node.text" && typeof text.props.text === "string");
  text.props.text =
    kind === "corrupt-revision" ? "Rejected corrupt checkout" : "Rejected Catalog checkout";
  if (kind === "catalog-mismatch") {
    requireInvariant(bundle.requires.catalogs.length === 1);
    bundle.requires.catalogs[0].digest = `sha256:${"0".repeat(64)}`;
  }
  bundle.revision = calculateDesenBundleRevision(bundle);
  if (kind === "corrupt-revision")
    text.props.text = "Rejected corrupt checkout changed after hashing";
  const bytes = Buffer.from(JSON.stringify(bundle));
  const diagnosis = await assessCandidate(bundle.revision, bytes);
  const expectedCode =
    kind === "corrupt-revision" ? "REVISION_MISMATCH" : "CATALOG_DIGEST_MISMATCH";
  requireInvariant(diagnosis.status === "rejected" && diagnosis.codes.includes(expectedCode));
  const stored = await controlPlaneRequest(`/v1/bundles/${bundle.revision}`, "PUT", bytes);
  requireInvariant(stored.status === 201);
  const channel = await controlPlaneRequest(
    `/v1/channels/${CHANNEL_NAME}`,
    "PUT",
    Buffer.from(JSON.stringify({ revision: bundle.revision })),
    `"g:${String(before.channel.generation)}"`,
  );
  requireInvariant(channel.status === 200);
  const after = await observe();
  requireInvariant(
    after.channel.revision === bundle.revision &&
      after.channel.generation === before.channel.generation + 1 &&
      JSON.stringify(after.activeRecord) === JSON.stringify(before.activeRecord) &&
      JSON.stringify(after.source) === JSON.stringify(before.source),
  );
  return { kind, bundlePutStatus: stored.status, channelPutStatus: channel.status, ...after };
}

async function boot(input) {
  lifecycleStage = "boot-input";
  requireInvariant(config === undefined);
  requireInvariant(
    exactKeys(input, ["root", "controlPlaneToken", "activationToken", "resume", "ports", "builds"]),
  );
  requireInvariant(
    typeof input.root === "string" &&
      basename(input.root).startsWith("desen-restart-browser-proof-") &&
      (await realpath(input.root)) === input.root &&
      (await lstat(input.root)).isDirectory() &&
      typeof input.resume === "boolean" &&
      /^[A-Za-z0-9_-]{43}$/u.test(input.controlPlaneToken) &&
      /^[A-Za-z0-9_-]{43}$/u.test(input.activationToken) &&
      input.controlPlaneToken !== input.activationToken,
  );
  requireInvariant(
    input.resume
      ? exactKeys(input.ports, ["controlPlane", "activation"]) &&
          [input.ports.controlPlane, input.ports.activation].every(
            (port) => Number.isSafeInteger(port) && port > 0 && port <= 65_535,
          ) &&
          exactKeys(input.builds, ["app", "host"]) &&
          [input.builds.app, input.builds.host].every((digest) => /^[0-9a-f]{64}$/u.test(digest))
      : input.ports === null && input.builds === null,
  );
  config = Object.freeze(input);
  appSourceIdentity = hash(JSON.stringify(await buildFiles(join(APP_ROOT, "src"), false)));
  const rootDirectory = join(config.root, "control-plane");
  const appDist = join(config.root, "app-dist");
  const hostDist = join(config.root, "host-dist");
  lifecycleStage = "boot-build-identity";
  if (!config.resume) await mkdir(rootDirectory, { mode: 0o700 });
  else
    requireInvariant(JSON.stringify(await fingerprintBuilds()) === JSON.stringify(config.builds));

  lifecycleStage = "boot-control-plane";
  controlPlane = await openLocalControlPlane({
    rootDirectory,
    apiToken: config.controlPlaneToken,
    allowedOrigins: Object.freeze([APP_ORIGIN]),
  });
  const controlPlaneListener = await controlPlane.listen(config.ports?.controlPlane ?? 0);
  controlPlaneOrigin = controlPlaneListener.origin;
  if (!config.resume) {
    await build({
      root: HOST_ROOT,
      appType: "spa",
      configFile: false,
      envDir: false,
      clearScreen: false,
      logLevel: "silent",
      build: { emptyOutDir: true, outDir: hostDist },
    });
  }
  lifecycleStage = "boot-reference-host";
  referenceHost = await openReferenceHostWebServer({
    rootDirectory,
    installedPackageDirectory: PACKAGE_ROOT,
    clientBuildDirectory: hostDist,
    controlPlaneOrigin,
    controlPlaneApiToken: config.controlPlaneToken,
    channelName: CHANNEL_NAME,
  });
  requireInvariant((await referenceHost.listen(4_180)).origin === HOST_ORIGIN);
  lifecycleStage = "boot-activation-bridge";
  activationBridge = await openDesenAppLocalPublicationHost({
    apiToken: config.activationToken,
    allowedOrigin: APP_ORIGIN,
    channelName: CHANNEL_NAME,
    hostId: HOST_ID,
    activatePublishedRevision: ({ channelName, channelGeneration, revision }) =>
      referenceHost.activatePublishedRevision({ channelName, channelGeneration, revision }),
  });
  activationOrigin = (await activationBridge.listen(0)).origin;
  const ports = {
    controlPlane: Number(new URL(controlPlaneOrigin).port),
    activation: Number(new URL(activationOrigin).port),
  };
  lifecycleStage = "boot-origin-identity";
  if (config.resume) requireInvariant(ports.controlPlane === config.ports.controlPlane);
  // The real bridge intentionally allocates a fresh port. Rebuild only the normal App's trusted
  // launcher configuration in the same private directory; host bytes never change or rebuild.
  await build({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "silent",
    define: {
      __DESEN_APP_LOCAL_RUNTIME_CONFIG__: JSON.stringify({
        profile: "desen.app.local-runtime.v1",
        controlPlane: { origin: controlPlaneOrigin, apiToken: config.controlPlaneToken },
      }),
      __DESEN_APP_LOCAL_PUBLICATION_CONFIG__: JSON.stringify({
        profile: "desen.app.local-publication.v1",
        controlPlane: { origin: controlPlaneOrigin, apiToken: config.controlPlaneToken },
        activation: { origin: activationOrigin, apiToken: config.activationToken },
        destination: { channelName: CHANNEL_NAME, hostId: HOST_ID },
      }),
    },
    build: { emptyOutDir: true, outDir: appDist },
  });
  lifecycleStage = "boot-build-fingerprint";
  buildIdentity = await fingerprintBuilds();
  if (config.resume) requireInvariant(buildIdentity.host === config.builds.host);
  lifecycleStage = "boot-app-preview";
  previewServer = await preview({
    root: APP_ROOT,
    appType: "spa",
    configFile: false,
    envDir: false,
    clearScreen: false,
    logLevel: "silent",
    build: { outDir: appDist },
    preview: { host: "127.0.0.1", port: 4_179, strictPort: true },
  });
  // Vite installs its own SIGTERM handler; retain the full-composition revocation order.
  process.removeAllListeners("SIGTERM");
  process.once("SIGTERM", () => void stopOnDisconnect());
  lifecycleStage = "boot-active-record";
  requireInvariant(
    appSourceIdentity === hash(JSON.stringify(await buildFiles(join(APP_ROOT, "src"), false))),
  );
  return {
    pid: process.pid,
    ports,
    builds: buildIdentity,
    appSource: appSourceIdentity,
    activeRecord: await activationRecord(),
  };
}

function send(message) {
  requireInvariant(typeof process.send === "function" && process.connected);
  return new Promise((resolveSend, rejectSend) => {
    process.send(message, (error) => (error === null ? resolveSend() : rejectSend(error)));
  });
}

process.on("message", (message) => {
  void (async () => {
    try {
      requireInvariant(
        !busy &&
          closing === undefined &&
          exactKeys(message, ["id", "command", "payload"]) &&
          Number.isSafeInteger(message.id) &&
          message.id === lastRequestId + 1 &&
          COMMANDS.includes(message.command),
      );
      busy = true;
      lastRequestId = message.id;
      let result;
      if (message.command === "boot") result = await boot(message.payload);
      else {
        requireInvariant(config !== undefined);
        if (message.command === "install-negative") result = await installNegative(message.payload);
        else {
          requireInvariant(message.payload === null);
          if (message.command === "observe") result = await observe();
          else {
            await shutdown();
            await send({ id: message.id, status: "stopped" });
            process.exit(0);
          }
        }
      }
      await send({ id: message.id, status: "ok", result });
      lifecycleStage = "ipc";
      busy = false;
    } catch {
      // Neither IPC nor stderr may serialize configuration, request headers, bodies, or exceptions.
      try {
        await send({ id: lastRequestId, status: "failed", stage: lifecycleStage });
      } catch {
        /* Supervisor may have exited. */
      }
      try {
        await shutdown();
      } catch {
        /* Failure is already terminal. */
      }
      process.exit(1);
    }
  })();
});

if (typeof process.send !== "function") {
  process.stderr.write("This recovery proof child requires its isolated IPC supervisor.\n");
  process.exit(1);
}
