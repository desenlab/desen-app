import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { gunzipSync } from "node:zlib";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-SUCCESS-HOST-OPERATION.md";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json";
const T03_HISTORICAL_READER_BRIDGE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz";
const HOST_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_BYTES = 4 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_INFLATED_BYTES = 8 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES = 6 * 1_024 * 1_024;
const MAX_HISTORICAL_OVERRIDES = 256;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  main: "apps/desen-app/src/main.tsx",
  localWorkspaces: "apps/desen-app/src/local-workspaces.tsx",
  workspaceStyles: "apps/desen-app/src/local-workspaces.module.css",
  flowProfile: "apps/desen-app/src/reference-flow-workspace-profile.ts",
  runNavigation: "apps/desen-app/src/authoring-run-navigation.ts",
  integration: "apps/desen-app/src/authoring-integration.ts",
  localBinding: "apps/desen-app/src/local-operation-binding.ts",
  localHost: "apps/desen-app/dev/local-operation-host.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  eventActions: "apps/desen-app/src/authoring-event-actions.ts",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  operationLifecycle: "packages/runtime-core/src/operation-lifecycle.ts",
});

const TEST_PATHS = Object.freeze({
  localWorkspaces: "apps/desen-app/test/local-workspaces.test.tsx",
  flowProfile: "apps/desen-app/test/reference-flow-workspace-profile.test.ts",
  integration: "apps/desen-app/test/authoring-integration.test.ts",
  localBinding: "apps/desen-app/test/local-operation-binding.test.ts",
  localHost: "apps/desen-app/dev/local-operation-host.test.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.test.mjs",
  runNavigation: "apps/desen-app/test/authoring-run-navigation.test.ts",
  successNavigation: "apps/desen-app/test/success-host-navigation.test.tsx",
  operationLifecycle: "packages/runtime-core/test/operation-lifecycle.test.ts",
});

const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/success-host-operation.pw.ts",
  config: "apps/desen-app-browser-e2e/success-host-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/product-proof-server.mjs",
});

const BOUNDARY_PATHS = Object.freeze({
  configuration: "dependency-cruiser.config.cjs",
  verifier: "scripts/verify-boundary-fixtures.mjs",
  readme: "tests/boundaries/README.md",
  allowedListener:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-local-operation-host/apps/desen-app/dev/local-operation-host.mjs",
  allowedImporter:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-local-operation-host/apps/desen-app-browser-e2e/product-proof-server.mjs",
  deniedNeighbor:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-unreviewed-dev-module/apps/desen-app/dev/local-operation-private.mjs",
  deniedNeighborImporter:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/product-proof-server.mjs",
  deniedOtherImporterListener:
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-local-operation-host/apps/desen-app/dev/local-operation-host.mjs",
  deniedOtherImporter:
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-local-operation-host/apps/desen-app-browser-e2e/proof-application.mjs",
});

const PACKAGE_PATHS = Object.freeze({
  app: "apps/desen-app/package.json",
  browser: "apps/desen-app-browser-e2e/package.json",
  referenceCatalog: "packages/reference-catalog-web/package.json",
  runtimeCore: "packages/runtime-core/package.json",
});

const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";

const BRIDGE_REPRODUCTION_PATHS = Object.freeze([
  "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
  "tests/desen-app-t03-historical-reader-fixture.mjs",
]);

const PROOF_ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-success-host-operation-proof.mjs",
  "scripts/verify-desen-app-success-host-operation.mjs",
]);

const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...Object.values(TEST_PATHS),
    ...Object.values(BROWSER_PATHS),
    ...Object.values(BOUNDARY_PATHS),
    ...Object.values(PACKAGE_PATHS),
    CATALOG_PATH,
    HOST_BINDING_ARTIFACT_PATH,
    ...BRIDGE_REPRODUCTION_PATHS,
    ...PROOF_ENTRYPOINT_PATHS,
    PARENT_ARTIFACT_PATH,
    T03_HISTORICAL_READER_BRIDGE_PATH,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const FOCUSED_TEST_COMMANDS = Object.freeze([
  "pnpm --filter @desen/app-web exec vitest run test/local-workspaces.test.tsx test/reference-flow-workspace-profile.test.ts test/authoring-integration.test.ts test/local-operation-binding.test.ts test/authoring-run-navigation.test.ts test/success-host-navigation.test.tsx dev/local-operation-host.test.mjs dev/local-dev-host.test.mjs",
  "pnpm --filter @desen/runtime-core exec vitest run test/operation-lifecycle.test.ts",
]);
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config success-host-playwright.config.ts";
const BROWSER_TEST_NAME =
  "authors success navigation and explicitly runs the same Source through a real local host";

const SUCCESSOR_ADDED_PATHS = Object.freeze(
  [
    "apps/desen-app/src/local-workspaces.tsx",
    "apps/desen-app/src/local-workspaces.module.css",
    "apps/desen-app/src/reference-flow-workspace-profile.ts",
    "apps/desen-app/test/local-workspaces.test.tsx",
    "apps/desen-app/test/reference-flow-workspace-profile.test.ts",
    "apps/desen-app/src/authoring-integration.ts",
    "apps/desen-app/test/authoring-integration.test.ts",
    "apps/desen-app/src/local-operation-binding.ts",
    "apps/desen-app/test/local-operation-binding.test.ts",
    "apps/desen-app/dev/local-operation-host.mjs",
    "apps/desen-app/dev/local-operation-host.test.mjs",
    "apps/desen-app/src/authoring-run-navigation.ts",
    "apps/desen-app/test/authoring-run-navigation.test.ts",
    "apps/desen-app/test/success-host-navigation.test.tsx",
    BROWSER_PATHS.spec,
    BROWSER_PATHS.config,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// These exact T01A/T01B receipts were absent from their bridges and remained unchanged through
// the T03 base commit. Capturing them prevents later mutation audits from silently reading T04 bytes.
const PREDECESSOR_GAP_RECEIPTS = Object.freeze([
  {
    path: "apps/desen-app-browser-e2e/product-proof-server.mjs",
    bytes: 3706,
    sha256: "e78aaabb139f15e3097788b90a271aea49e2354fb782234d9974f0bf19fa705c",
  },
  {
    path: "apps/desen-app/dev/local-dev-host.mjs",
    bytes: 13016,
    sha256: "7e1b703c42abc3b6d2b2af114fe696ba2a7ec093499178af4af9ab032fd0ac41",
  },
  {
    path: "apps/desen-app/dev/local-dev-host.test.mjs",
    bytes: 8266,
    sha256: "b8626c99789ea61163b8642118b68bb28ceaaee2056bb3c2b79ef32b225ba80f",
  },
  {
    path: "apps/desen-app/src/preview-controls.tsx",
    bytes: 10810,
    sha256: "8fa80c577ad6de491774d6fc37d0e4a1a15765fab172e36f23d8dbcfe1408988",
  },
  {
    path: "apps/desen-app/test/main-lifecycle.test.tsx",
    bytes: 5719,
    sha256: "bde97de9d7a4e131f6b9e011c89145d6ec3a3ab4051f7106174d329b935747ab",
  },
  {
    path: "apps/desen-app/tsconfig.local-dev.json",
    bytes: 229,
    sha256: "0ceb3261385bc76b58a77873b62e89a97d1cfee258395e975f92ff4167fa9528",
  },
  {
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 5156,
    sha256: "c884a14e7e6803cab840db136db0c60ccb74a115a7f04834ef6faaae0f55be15",
  },
  {
    path: "tests/boundaries/README.md",
    bytes: 1407,
    sha256: "39f2900d72b7731193d3a5d7958891adaae38f9cb647ef18ffd03313b8df5e18",
  },
]);

/** Exact immutable M10-T03 predecessor required by the success-host-operation proof. */
export const DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN = Object.freeze({
  task: "M10-T03",
  gate: null,
  proofId: "desen-app-failure-fixture",
  path: PARENT_ARTIFACT_PATH,
  bytes: 16_868,
  sha256: "bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20",
  profile: "desen.app.failure-fixture-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact immutable trusted host-binding predecessor genuinely consumed by the local transport. */
export const DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN = Object.freeze({
  task: "M03-T08",
  gate: null,
  proofId: "reference-sign-in-fixtures-and-host-binding",
  path: HOST_BINDING_ARTIFACT_PATH,
  bytes: 12_713,
  sha256: "b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2",
  result: "PASS",
  immutable: true,
});

/** Exact compressed M10-T03 task-time authority for its historical reader pair. */
export const DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN = Object.freeze({
  path: T03_HISTORICAL_READER_BRIDGE_PATH,
  bytes: 2_769_997,
  sha256: "64f76eaeac8369a9f7ae00086dac914adc3c84979d53c770d2ebe0082576005f",
  uncompressedBytes: 4_385_030,
  baseCommit: "a1d26905aec6ee3d4bcb73ca17b02187e7b57420",
  fileEntries: 42,
  predecessorGapFiles: 8,
  successorAddedPaths: 16,
  projections: 1,
});

/** Independent root cases owned by the append-only M10-T04 proof family. */
export const DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact frozen T03 and trusted host-binding parents without invoking their readers",
  "[workspace] selects an additive empty two-surface workspace without changing legacy Source",
  "[authoring] creates success navigation and the destination through ordinary visible controls",
  "[synthetic] completes the Catalog success with no real HTTP or Source write",
  "[integration] requires explicit activation before the fixed separately authorized local HTTP binding",
  "[success] navigates after an actual non-Catalog host result and preserves Source and frame",
  "[failure] preserves origin after real HTTP failure and permits a valid retry",
  "[revocation] rejects forged identity, alias, effect, late result, and inactive navigation authority",
  "[determinism] builds byte-identical evidence with exact receipts and a bounded T03 bridge",
  "[policy] rejects source, tests, parent, bridge, artifact, report, options, and unsafe writes",
]);

/** Default destination of the deterministic M10-T04 artifact. */
export const DEFAULT_DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);

/** Exact frozen artifact identity; the reader and its root test remain checkpoint-owned. */
export const DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PIN = Object.freeze({
  bytes: 22456,
  sha256: "d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423",
});

const SUCCESSOR_AUTHORITIES = new WeakMap();
let cachedHistoricalBridgeAuthority;

/** Stable fail-closed error raised by the M10-T04 evidence reader. */
export class DesenAppSuccessHostOperationProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppSuccessHostOperationProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppSuccessHostOperationProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze(Object.create(null));
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert own-data object.`);
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} contains unsupported authority.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureBytes(value, label) {
  if (!(value instanceof Uint8Array) || utilTypes.isProxy(value)) {
    fail("OPTIONS_INVALID", `${label} must be one non-Proxy byte array.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) ||
    Object.getOwnPropertyDescriptor(value, "buffer") !== undefined ||
    Object.getOwnPropertyDescriptor(value, "byteLength") !== undefined ||
    Object.getOwnPropertyDescriptor(value, "byteOffset") !== undefined ||
    (typeof SharedArrayBuffer !== "undefined" && value.buffer instanceof SharedArrayBuffer) ||
    value.byteLength > MAX_AUTHORITY_BYTES
  ) {
    fail("OPTIONS_INVALID", `${label} exceeds or violates the evidence byte authority.`);
  }
  return Buffer.from(value);
}

function captureOverrides(value) {
  if (value === undefined) return new Map();
  if (
    !(value instanceof Map) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Map.prototype ||
    Reflect.ownKeys(value).length !== 0 ||
    value.size > TRACKED_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one inert bounded Map.");
  }
  const captured = new Map();
  let totalBytes = 0;
  for (const [relativePath, bytes] of Map.prototype.entries.call(value)) {
    if (typeof relativePath !== "string" || !TRACKED_PATHS.includes(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an untracked path.", { relativePath });
    }
    const capturedBytes = captureBytes(bytes, `fileOverrides[${relativePath}]`);
    totalBytes += capturedBytes.byteLength;
    if (totalBytes > MAX_AUTHORITY_BYTES) {
      fail("OPTIONS_INVALID", "fileOverrides exceeds the aggregate byte budget.");
    }
    captured.set(relativePath, capturedBytes);
  }
  return captured;
}

function captureBuildOptions(value) {
  const options = exactOwnDataOptions(value, ["fileOverrides", "workspaceRoot"], "build options");
  const workspaceRoot = options.workspaceRoot ?? WORKSPACE_ROOT;
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    workspaceRoot.includes("\0")
  ) {
    fail("OPTIONS_INVALID", "workspaceRoot must be one non-empty path.");
  }
  return Object.freeze({
    workspaceRoot: path.resolve(workspaceRoot),
    fileOverrides: captureOverrides(options.fileOverrides),
  });
}

async function readRegularAuthority(absolutePath, relativePath) {
  let handle;
  try {
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority is not one bounded regular file: ${relativePath}.`);
    }
    const canonical = await realpath(absolutePath);
    if (canonical !== absolutePath) {
      fail("AUTHORITY_UNSAFE", `Authority resolves through a linked path: ${relativePath}.`);
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== metadata.size || opened.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority changed during acquisition: ${relativePath}.`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof DesenAppSuccessHostOperationProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Could not read evidence authority: ${relativePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function acquireFiles(options) {
  const canonicalRoot = await realpath(options.workspaceRoot);
  if (canonicalRoot !== options.workspaceRoot) {
    fail("AUTHORITY_UNSAFE", "workspaceRoot must be its canonical non-symbolic path.");
  }
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      options.fileOverrides.get(relativePath) ??
        (await readRegularAuthority(path.join(canonicalRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${relativePath} is not valid UTF-8.`);
  }
}

function parseJson(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, relativePath, code));
  } catch (error) {
    if (error instanceof DesenAppSuccessHostOperationProofError) throw error;
    fail(code, `${relativePath} is not valid JSON.`);
  }
}

function exactJsonKeys(value, expectedKeys) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !isDeepStrictEqual(Object.keys(value), expectedKeys)
  ) {
    return false;
  }
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return (
      typeof key === "string" &&
      descriptor !== undefined &&
      descriptor.enumerable &&
      descriptor.configurable &&
      descriptor.writable &&
      "value" in descriptor
    );
  });
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function testDeclarationCount(source) {
  return source.match(/\bit(?:\.each)?\(/gu)?.length ?? 0;
}

function requireFragments(source, fragments, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) {
    fail(code, `${label} lost required success-host-operation authority.`, { missing });
  }
}

function forbidFragments(source, fragments, label, code = "SOURCE_POLICY_VIOLATION") {
  const present = fragments.filter((fragment) => source.includes(fragment));
  if (present.length > 0) {
    fail(code, `${label} acquired authority outside M10-T04.`, { present });
  }
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T03 parent artifact drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.gate !== null ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.p09Status !== "PARTIAL" ||
    artifact.claim?.p10Status !== "PARTIAL" ||
    artifact.claim?.m10T03Closed !== true ||
    artifact.claim?.m10T04Closed !== false ||
    artifact.claim?.visibleFailureStateCovered !== true ||
    artifact.boundary?.trackedFiles !== 34 ||
    artifact.tests?.rootTestNames?.length !== 10
  ) {
    fail("PARENT_DRIFT", "The immutable M10-T03 parent schema or claims drifted.");
  }
  return Object.freeze({ summary: { ...pin }, artifact: deepFreeze(artifact) });
}

function authenticateHostBinding(bytes) {
  const pin = DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable trusted host-binding artifact drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.result !== pin.result ||
    artifact.operation?.operationId !== "com.example.auth/signIn" ||
    artifact.hostBinding?.executableStoredInCatalogOrFixtures !== false
  ) {
    fail("PARENT_DRIFT", "The trusted host-binding parent lost its inert/executable separation.");
  }
  return Object.freeze({ ...pin });
}

function safeRelativePath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    relativePath.length <= 512 &&
    !relativePath.includes("\0") &&
    !path.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    !relativePath.split("/").includes("..")
  );
}

function authenticateHistoricalReaderBridge(compressedBytes, parentArtifact) {
  const pin = DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN;
  if (
    compressedBytes.byteLength !== pin.bytes ||
    compressedBytes.byteLength > MAX_HISTORICAL_BRIDGE_BYTES ||
    sha256(compressedBytes) !== pin.sha256
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The exact compressed T03 historical bridge drifted.");
  }
  if (cachedHistoricalBridgeAuthority !== undefined) {
    if (!isDeepStrictEqual(cachedHistoricalBridgeAuthority.projection, parentArtifact)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The cached T03 projection differs from its parent.");
    }
    return cachedHistoricalBridgeAuthority;
  }

  let inflated;
  try {
    inflated = gunzipSync(compressedBytes, {
      maxOutputLength: MAX_HISTORICAL_BRIDGE_INFLATED_BYTES,
    });
  } catch (error) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T03 bridge is not bounded gzip.", {
      cause: String(error),
    });
  }
  if (inflated.byteLength !== pin.uncompressedBytes) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T03 bridge inflated size drifted.");
  }
  let manifest;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
    manifest = JSON.parse(source);
    if (!Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8").equals(inflated)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The T03 bridge is not canonical dense JSON.");
    }
  } catch (error) {
    if (error instanceof DesenAppSuccessHostOperationProofError) throw error;
    fail("HISTORICAL_BRIDGE_DRIFT", "The T03 bridge JSON is invalid.", {
      cause: String(error),
    });
  }

  const projectionKeys = ["desen-app-failure-fixture"];
  const expectedAddedPaths = SUCCESSOR_ADDED_PATHS;
  if (
    !exactJsonKeys(manifest, [
      "schemaVersion",
      "profile",
      "baseCommit",
      "successorAddedPaths",
      "files",
      "projections",
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.profile !== "desen.app.m10-t03-historical-reader-bridge.v1" ||
    manifest.baseCommit !== pin.baseCommit ||
    !Array.isArray(manifest.successorAddedPaths) ||
    !isDeepStrictEqual(manifest.successorAddedPaths, expectedAddedPaths) ||
    !exactJsonKeys(manifest.files, Object.keys(manifest.files)) ||
    Object.keys(manifest.files).length !== pin.fileEntries ||
    !exactJsonKeys(manifest.projections, projectionKeys) ||
    !isDeepStrictEqual(manifest.projections[projectionKeys[0]], parentArtifact)
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T03 bridge identity or parent projection drifted.");
  }

  const encodedEntries = Object.entries(manifest.files);
  const encodedPaths = encodedEntries.map(([relativePath]) => relativePath);
  const expectedReceipts = [
    ...parentArtifact.boundary.trackedReceipts,
    ...PREDECESSOR_GAP_RECEIPTS,
  ];
  const expectedPaths = expectedReceipts
    .map(({ path: relativePath }) => relativePath)
    .sort((left, right) => left.localeCompare(right, "en-US"));
  if (
    !isDeepStrictEqual(encodedPaths, expectedPaths) ||
    !isDeepStrictEqual(
      encodedPaths,
      [...encodedPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    new Set(encodedPaths).size !== encodedPaths.length ||
    encodedEntries.some(
      ([relativePath, encoded]) =>
        !safeRelativePath(relativePath) ||
        typeof encoded !== "string" ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded),
    )
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T03 task-time file manifest is not canonical.");
  }
  const files = new Map();
  let decodedBytes = 0;
  for (const [relativePath, encoded] of encodedEntries) {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", `Invalid T03 task-time file: ${relativePath}.`);
    }
    decodedBytes += bytes.byteLength;
    if (decodedBytes > MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The decoded T03 file authority exceeds its bound.");
    }
    files.set(relativePath, bytes);
  }
  for (const receipt of expectedReceipts) {
    const bytes = files.get(receipt.path);
    if (bytes.byteLength !== receipt.bytes || sha256(bytes) !== receipt.sha256) {
      fail("HISTORICAL_BRIDGE_DRIFT", `The exact task-time receipt drifted: ${receipt.path}.`);
    }
  }
  cachedHistoricalBridgeAuthority = Object.freeze({
    files,
    projection: deepFreeze(manifest.projections[projectionKeys[0]]),
    successorAddedPaths: new Set(manifest.successorAddedPaths),
    summary: deepFreeze({
      path: pin.path,
      bytes: pin.bytes,
      sha256: pin.sha256,
      uncompressedBytes: pin.uncompressedBytes,
      baseCommit: pin.baseCommit,
      fileEntries: pin.fileEntries,
      predecessorGapFiles: pin.predecessorGapFiles,
      successorAddedPaths: pin.successorAddedPaths,
      projections: pin.projections,
      canonicalDenseManifest: true,
      boundedGzip: true,
      parentProjectionAuthenticated: true,
    }),
  });
  return cachedHistoricalBridgeAuthority;
}

/** Verifies the exact M10-T04 implementation profile without executing product code. */
export function verifyDesenAppSuccessHostOperationSourcePolicy(rawInput) {
  const input = exactOwnDataOptions(rawInput, Object.keys(SOURCE_PATHS), "source policy input");
  for (const key of Object.keys(SOURCE_PATHS)) {
    if (typeof input[key] !== "string") {
      fail("SOURCE_POLICY_VIOLATION", "Every source authority must be text.");
    }
  }
  const fragments = {
    localWorkspaces: [
      "readProjectWorkspaceProfileAuthority(profileDescriptor.value)",
      "projectIds.has(profile.project.id)",
      "sourceKeys.has(profile.sourceKey)",
      "navigateDesenApp(target.profile.surfacePath)",
      'aria-label="Local workspace"',
      'route.kind === "projects"',
      "setRetainedHandle(routedWorkspace.handle)",
    ],
    workspaceStyles: ["position: fixed;", "z-index: 21;", "var(--desen-app-surface)"],
    flowProfile: [
      "readProjectWorkspaceProfileAuthority(",
      "REFERENCE_SIGN_IN_WORKSPACE_PROFILE",
      'profileId: "reference-flow-web"',
      'documentId: "com.example.flow-app"',
      'sourceKey: "flow-app-source"',
      'entry: "start"',
      'id: "start.layout"',
      'id: "result.layout"',
      "width: 420, height: 720",
      "registry: reference.runtime.registry",
      "catalogPackages: reference.catalogPackages",
      "hostPorts: reference.runtime.hostPorts",
    ],
    integration: [
      "const BINDING_AUTHORITIES = new WeakMap",
      "authority.profile !== captured.profile",
      "admitProjectWorkspaceDocument(authority.profile, captured.document)",
      "prepareAuthoringSurfacePreviewBundle(",
      "preview.revision !== revision",
      "let active = false;",
      "request.context.documentId !== admitted.document.id",
      "request.context.surfaceId !== surfaceId",
      "request.context.revision !== revision",
      "states.get(request.invocationAlias)",
      "state.capabilityId !== request.capabilityId",
      "state.effect !== request.effect",
      "seenRequestIds.has(request.context.requestId)",
      "seenRequestIds.size >= MAX_INVOCATIONS",
      "snapshotRuntimeJsonValue(request.input)",
      "new AbortController()",
      "if (!stillPending(state, pending)) return",
      'state.status = "responded";',
      "pending.resolve(candidate)",
      "pending.resolve(DENIED)",
      "pending.abort.abort()",
    ],
    runNavigation: [
      "createAuthoringRunNavigationController(",
      "const admitted = createDesenEditorDocument(input.document)",
      "context.documentId !== documentId",
      "context.revision !== revision",
      "context.surfaceId !== surfaceId",
      "surfaceIds.has(captured.targetSurfaceId)",
      "!isRunActive()",
      "if (!active || terminal || transitioning) return DENIED;",
      "epoch !== requestEpoch",
      "terminal = true;",
      "createAuthoringRunHostPorts(",
      "snapshotRuntimeJsonValue(params)",
      "resources: { load: () => DENIED }",
      "getSnapshot: () => EMPTY_CONTEXT",
    ],
    localBinding: [
      'from "@desen/reference-catalog-web/host-operations"',
      'const ENDPOINT_PATH = "/api/sign-in";',
      "const MAX_REQUEST_BYTES = 16_384;",
      "const MAX_RESPONSE_BYTES = 65_536;",
      "const MAX_RESPONSE_CHUNKS = 1_024;",
      "const TIMEOUT_MILLISECONDS = 15_000;",
      'captured?.capabilityId !== "com.example.auth/signIn"',
      'captured.effect !== "network"',
      'redirect: "error"',
      'credentials: "omit"',
      'cache: "no-store"',
      'referrerPolicy: "no-referrer"',
      "signal: transport.signal",
      "Promise.race([execute(), interruption])",
      "bindReferenceSignInHostOperation((input)",
      "return await (binding.invoke(credentials)",
    ],
    localHost: [
      'const LOOPBACK = "127.0.0.1";',
      'const ENDPOINT = "/api/sign-in";',
      "const MAX_REQUEST_BYTES = 16_384;",
      "const MAX_REQUEST_CHUNKS = 1_024;",
      "const REQUEST_TIMEOUT_MILLISECONDS = 10_000;",
      "timingSafeEqual(candidate, expected)",
      "uniqueRequestHeaders(request)",
      "request.headers.host !==",
      "if (!authorized(request.headers.authorization, expectedAuthorization))",
      'respond(401, { error: { code: "invalidCredentials" } });',
      'respond(200, { userId: "local-host-user" });',
      "server.listen({ host: LOOPBACK, port: 0, exclusive: true }",
      "server.closeAllConnections()",
    ],
    localDevHost: [
      'DESEN_APP_LOCAL_OPERATION_DEFINE_NAME = "__DESEN_APP_LOCAL_OPERATION_CONFIG__"',
      "if (operationApiToken === apiToken)",
      "operationHost = await openOperationHost(",
      "apiToken: operationApiToken",
      "await operationHost.listen(0)",
      "await operationHost.close()",
    ],
    main: [
      "readInjectedDesenAppLocalOperationConfig()",
      "createAuthoringIntegrationBinding(",
      "profile: REFERENCE_FLOW_WORKSPACE_PROFILE",
      "capabilityId: SIGN_IN_OPERATION_ID",
      "createDesenAppLocalSignInOperation(",
      "globalThis.fetch.bind(globalThis)",
      "<DesenAppLocalWorkspaces",
      "integrationBinding={flowIntegration}",
      "test account only, not production authentication",
    ],
    productBootstrap: [
      "integrationBinding = null",
      "integrationBinding={integrationBinding}",
      "workspaceProfile={workspaceProfile}",
    ],
    application: [
      "const [runDestination, setRunDestination]",
      "readAuthoringIntegrationBinding(",
      "createAuthoringIntegrationController(",
      "createAuthoringRunNavigationController(",
      'isRunActive: () => modeRef.current === "run"',
      "createAuthoringRunHostPorts(",
      "integrationController?.operationPort",
      "fixtureController.operationPort",
      "navigationController.navigationPort",
      "integrationController.activate()",
      "integrationController.deactivate()",
      'function restartRun(context: "synthetic" | "integration" = executionContext)',
      "setRunDestination(null)",
      "setRunEpoch((current) => current + 1)",
      "onContextChange={restartRun}",
      "onRestart={() => restartRun()}",
    ],
    previewControls: [
      "integration !== null",
      'executionContext === "integration"',
      "Restart run",
      "Your authored Source is unchanged.",
      "Explicit host connection · no fixture substitution.",
    ],
    authoringFixtures: [
      "Request input is deliberately never read or retained.",
      "current.resolve(operationOutcomeResult(current.outcome))",
    ],
    authoringConnections: ["{ onSuccess: existingOperation.onSuccess }"],
    eventActions: ["navigate", "onSuccess"],
    eventActionPanel: ["Destination surface", "Success"],
    operationLifecycle: [
      'record.lifecycle = Object.freeze({ status: "pending", pending: true });',
      "if (!record.publicErrors.has(result.errorCode))",
    ],
  };
  for (const [key, required] of Object.entries(fragments)) {
    requireFragments(input[key], required, SOURCE_PATHS[key]);
  }
  if (occurrenceCount(input.runNavigation, "epoch !== requestEpoch") !== 2) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Run navigation must recheck its epoch around policy callbacks.",
    );
  }
  for (const key of [
    "application",
    "integration",
    "runNavigation",
    "localWorkspaces",
    "previewControls",
  ]) {
    forbidFragments(
      input[key],
      ["com.example.auth/signIn", "invalidCredentials", "/api/sign-in", "user-1"],
      SOURCE_PATHS[key],
    );
  }
  forbidFragments(
    input.integration,
    ["fetch(", "XMLHttpRequest", "operationOutcomeResult(", "fixtures.success"],
    SOURCE_PATHS.integration,
  );
  forbidFragments(
    input.localHost,
    ["console.log(", "console.error(", "writeFile(", "appendFile("],
    SOURCE_PATHS.localHost,
  );
  return deepFreeze({
    additiveAuthenticatedTwoSurfaceWorkspace: true,
    legacySourceAndStorageIdentityPreserved: true,
    guardedWorkspaceNavigation: true,
    explicitInactiveIntegrationAuthority: true,
    exactProfileDocumentRevisionAliasCapabilityEffect: true,
    boundedReplayAndDetachedInput: true,
    revocationAbortAndLateSettlementFencing: true,
    runtimeOwnsOutputAndPublicErrorValidation: true,
    localManagedNavigationNotBrowserNavigation: true,
    runDoesNotGrantStorageResourcesOrProduction: true,
    explicitTrustedHostOperationBinding: true,
    fixedLoopbackEndpointOutsideSource: true,
    separateBearerOriginAndHostAuthorization: true,
    boundedRequestsResponsesAndTimeouts: true,
    publicFailureRedactionAndNoCredentialPersistence: true,
    catalogFixtureAndActualLocalHostResultDistinct: true,
    genericEditorNotSignInSpecific: true,
    runRestartAndDesignRestoreOrigin: true,
  });
}

function verifyFocusedTestAuthority(files) {
  const sources = Object.fromEntries(
    Object.entries(TEST_PATHS).map(([key, relativePath]) => [
      key,
      decodeUtf8(files.get(relativePath), relativePath, "TEST_POLICY_VIOLATION"),
    ]),
  );
  const required = {
    localWorkspaces: [
      "creates the separate two-surface project through normal UI without changing stored Account app",
      "uses the actual editor dirty-draft guard before changing persistence controllers",
      "selects a known result-surface deep link without opening the default Source",
      "rejects forged profiles, duplicate handles, duplicate project identities, and empty inventories",
    ],
    flowProfile: [
      "authenticates independent Source, storage, route, and two-surface identities",
      "starts both surfaces empty with declared portrait frames and no authored behavior",
      "does not grant a live operation merely by selecting the new workspace",
      "leaves legacy Account app bytes and its original storage identity unchanged",
    ],
    integration: [
      "captures a generic non-auth binding without calling ambient or explicit implementations",
      "rejects forged, serialized and same-metadata cross-profile authorities",
      "requires explicit activation and uses no fixture outcomes or ambient profile ports",
      "ignores Catalog fixture payloads even when they differ from the actual host response",
      "rejects document, surface, revision, binding and profile mismatches before I/O",
      "recomputes content-bound revision instead of accepting a stale same-id document",
      "requires every request's exact authored alias, capability, effect and context",
      "deactivates synchronously, aborts pending work and rejects old-epoch settlements after reactivation",
      "supports StrictMode activation replay before input and makes disposal terminal and idempotent",
    ],
    localBinding: [
      "uses the fixed host binding and one bounded fetch without ambient credentials",
      "does not inspect credentials for a denied capability or access active input fields",
      "returns only the declared error classification and leaves output schema authority to Runtime",
      "denies pre-aborted calls without reading inputs or starting fetch",
      "revokes a noncooperative fetch and cancels its late successful response",
      "bounds even a noncooperative fetch by one fixed timeout with no retry",
      "redacts thrown transport values rather than retaining causes or messages",
    ],
    localHost: [
      "executes the explicit local account over real HTTP with a non-Catalog output",
      "returns only the declared public failure for a wrong account and never logs credentials",
      "rejects a foreign raw Host independently from the socket destination",
      "authorizes only the exact browser preflight and never exposes a credentialed CORS policy",
      "bounds both declared and chunked request bodies before account evaluation",
    ],
    localDevHost: [
      "starts independently authorized services before fixed-port Vite and revokes all exactly once",
      "does not admit a reused persistence bearer as local operation authority",
      "revokes Source authority when the separately authorized operation listener cannot start",
    ],
    runNavigation: [
      "starts inert and permits one detached in-document transition without mutating Source",
      "denies unknown surfaces, URLs, extra keys and accessor-bearing request data",
      "checks Design mode synchronously and supports only nonterminal StrictMode replay",
      "preserves the origin on callback denial and prevents reentrant navigation",
      "rechecks lifetime after policy callbacks and denies reentrancy before request capture",
      "keeps all unrelated host families inert and exposes only detached navigation params",
    ],
    successNavigation: [
      "DesenAppApplication",
      "createAuthoringIntegrationBinding",
      "uses only Catalog fixtures until Integration is selected, then restores the design origin",
      "executes one connected host callback with live input and mounts its actual destination",
      "does not navigate on an unaccepted host candidate",
      "aborts an outstanding Integration call and ignores late success after leaving Run",
      "rejects a connection from a different opaque workspace profile",
    ],
    operationLifecycle: [
      "enters pending synchronously and sends detached Catalog-owned effect/input/context",
      "exposes only declared public failures and publishes the closed failed lifecycle",
      "redacts undeclared errors, thrown/rejected adapters, and malformed envelopes",
    ],
  };
  for (const [key, fragments] of Object.entries(required)) {
    requireFragments(sources[key], fragments, TEST_PATHS[key], "TEST_POLICY_VIOLATION");
  }
  const declarationSites = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, testDeclarationCount(source)]),
  );
  if (Object.values(declarationSites).some((count) => count < 1)) {
    fail("TEST_POLICY_VIOLATION", "Every focused suite must retain executable test declarations.");
  }
  return deepFreeze({
    declarationSites,
    totalDeclarationSites: Object.values(declarationSites).reduce((sum, count) => sum + count, 0),
    declarationSitesAreNotExpandedVitestExecutionCount: true,
    workspaceCreationLegacyPreservationAndDirtyGuard: true,
    genericNonAuthIntegrationAndExactIdentityNegatives: true,
    sourceRevisionAndAliasEffectMismatchNegatives: true,
    cancellationLateResultAndReplayNegatives: true,
    fixedHostBindingAndBoundedTransportNegatives: true,
    realLocalHttpAndHostOriginTokenNegatives: true,
    managedNavigationInertModeAndReentryNegatives: true,
    actualAppSuccessNavigation: true,
    runtimeOutputValidationAndFailureRedaction: true,
  });
}

function verifyBrowserAuthority(files) {
  const spec = decodeUtf8(
    files.get(BROWSER_PATHS.spec),
    BROWSER_PATHS.spec,
    "BROWSER_POLICY_VIOLATION",
  );
  const config = decodeUtf8(
    files.get(BROWSER_PATHS.config),
    BROWSER_PATHS.config,
    "BROWSER_POLICY_VIOLATION",
  );
  const server = decodeUtf8(
    files.get(BROWSER_PATHS.server),
    BROWSER_PATHS.server,
    "BROWSER_POLICY_VIOLATION",
  );
  requireFragments(
    spec,
    [
      BROWSER_TEST_NAME,
      'const ALIAS = "submitCredentials";',
      'await page.goto("/")',
      'name: "Local workspace"',
      'selectOption("reference-flow-web")',
      'name: "New project"',
      'name: "Create project"',
      "Blank Flow app project",
      'await openSurface(page, "Result")',
      'await insert(page, "result", "Text", 1)',
      'await property(page, "Text", "Operation completed")',
      'await openSurface(page, "Start")',
      'await state(page, "email")',
      'await state(page, "password")',
      'name: "Operation connection result name"',
      ".fill(ALIAS)",
      'name: "Success", exact: true',
      'selectOption("navigate")',
      'name: "Destination surface"',
      'selectOption("result")',
      "await save(page)",
      "const savedWriteCount = writes.length;",
      "const savedSource = writes.at(-1);",
      'name: "Managed start canvas"',
      'name: "Managed result canvas"',
      "name: /^Synthetic/u",
      "name: /^Integration/u",
      "name: /^Production/u",
      'pressSequentially("synthetic@example.test")',
      'pressSequentially("synthetic-only")',
      "Complete ${ALIAS} fixture",
      "expect(hostCalls).toBe(0)",
      'name: "Restart run"',
      "name: /^Integration/u }).check()",
      "name: /^Next outcome/u })).toHaveCount(0)",
      "name: /fixture/u })).toHaveCount(0)",
      'pressSequentially("designer@example.test")',
      'pressSequentially("wrong-test-password")',
      'new URL(response.url()).pathname === "/api/sign-in"',
      "expect((await denied).status()).toBe(401)",
      "await expect(result).toHaveCount(0)",
      'fill("local-demo-pass")',
      "expect(response.status()).toBe(200)",
      'expect(await response.json()).toEqual({ userId: "local-host-user" })',
      "expect(hostCalls).toBe(2)",
      "expect(writes).toHaveLength(savedWriteCount)",
      "expect(writes.at(-1)).toBe(savedSource)",
      'expect(savedSource).not.toContain("designer@example.test")',
      'expect(savedSource).not.toContain("local-demo-pass")',
      'expect(savedSource).not.toContain("local-host-user")',
      "expect(await frame.boundingBox()).toEqual(originalFrame)",
      'name: "Design", exact: true',
      "await page.reload()",
      "expect(pageErrors).toEqual([])",
    ],
    BROWSER_PATHS.spec,
    "BROWSER_POLICY_VIOLATION",
  );
  forbidFragments(
    spec,
    [
      "page.request.",
      "page.route(",
      "route.fulfill(",
      "page.addInitScript(",
      "page.evaluate(",
      "localStorage.",
      "sessionStorage.",
      "__DESEN_APP_LOCAL_OPERATION_CONFIG__",
    ],
    BROWSER_PATHS.spec,
    "BROWSER_POLICY_VIOLATION",
  );
  requireFragments(
    config,
    [
      'testMatch: "success-host-operation.pw.ts"',
      '...devices["Desktop Chrome"]',
      "fullyParallel: false",
      "workers: 1",
      "retries: 0",
      'projects: [{ name: "success-host-chromium" }]',
      "product-proof-server.mjs --with-operations",
      "reuseExistingServer: false",
      'trace: "retain-on-failure"',
      'screenshot: "only-on-failure"',
    ],
    BROWSER_PATHS.config,
    "BROWSER_POLICY_VIOLATION",
  );
  requireFragments(
    server,
    [
      'process.argv.includes("--with-operations")',
      "if (WITH_OPERATIONS)",
      'const operationToken = randomBytes(32).toString("base64url")',
      "openDesenAppLocalOperationHost(",
      "apiToken: operationToken",
      "await operationHost.listen(0)",
      "__DESEN_APP_LOCAL_OPERATION_CONFIG__",
      "await operationHost.close()",
      "root: APP_ROOT",
      "configFile: false",
    ],
    BROWSER_PATHS.server,
    "BROWSER_POLICY_VIOLATION",
  );
  if ((spec.match(/\btest\(/gu)?.length ?? 0) !== 1) {
    fail("BROWSER_POLICY_VIOLATION", "T04 owns exactly one dedicated actual-Chromium journey.");
  }
  return deepFreeze({
    chromiumConfigurations: 1,
    testName: BROWSER_TEST_NAME,
    normalVisibleProductFlow: true,
    emptyTwoSurfaceWorkspaceCreation: true,
    destinationContentAuthoredVisibly: true,
    designerChosenNonDefaultOperationAlias: true,
    successSubactionNavigateAuthoredVisibly: true,
    syntheticCatalogSuccessNavigation: true,
    syntheticRealHttpCallCount: 0,
    explicitIntegrationSelection: true,
    productionRemainsDisabled: true,
    integrationFixtureControlsAbsent: true,
    actualLocalHttpPublicFailureStatus: 401,
    actualLocalHttpSuccessStatus: 200,
    actualLocalHttpSuccessOutput: Object.freeze({ userId: "local-host-user" }),
    catalogFixtureSuccessOutput: Object.freeze({ userId: "user-1" }),
    hostResultDistinctFromCatalogFixture: true,
    actualLocalHttpCalls: 2,
    publicFailurePreservesOriginAndInput: true,
    successfulRetryNavigatesManagedDestination: true,
    sourceWriteCountAndBytesUnchangedByRun: true,
    runInputAndHostOutputAbsentFromSavedSource: true,
    browserUrlRemainsOnDesignOrigin: true,
    exactFrameGeometryStable: true,
    restartRunAndDesignRestoreOrigin: true,
    reloadReopensAuthoredSourceWithoutRunValues: true,
    directNetworkOrDomMutationUsed: false,
    proofOnlyRouteUsed: false,
    productionAuthenticationClaimed: false,
  });
}

function verifyDependencyBoundaryAuthority(files) {
  const sources = Object.fromEntries(
    Object.entries(BOUNDARY_PATHS).map(([key, relativePath]) => [
      key,
      decodeUtf8(files.get(relativePath), relativePath, "BOUNDARY_POLICY_VIOLATION"),
    ]),
  );
  const configurationMarkers = [
    'const desenAppLocalOperationHostPath = "^apps/desen-app/dev/local-operation-host\\\\.mjs$";',
    '"^apps/desen-app-browser-e2e/product-proof-server\\\\.mjs$";',
    'const controlPlanePublicBuildEntryPath = "^apps/control-plane-api/dist/index\\\\.(?:d\\\\.ts|js)$";',
    'name: "desen-app-browser-e2e-reviewed-app-source-only"',
    'path: "^apps/desen-app-browser-e2e/",\n        pathNot: desenAppBrowserProductProofServerPath,',
    'name: "desen-app-browser-e2e-product-server-control-plane-public-root-only"',
    'path: "^apps/control-plane-api/",\n        pathNot: controlPlanePublicBuildEntryPath,',
    'name: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies"',
    'from: { path: desenAppBrowserProductProofServerPath },\n      to: {\n        path: "^apps/(?!desen-app-browser-e2e/|control-plane-api/)",\n        pathNot: desenAppLocalOperationHostPath,\n      },',
  ];
  for (const marker of configurationMarkers) {
    if (occurrenceCount(sources.configuration, marker) !== 1) {
      fail(
        "BOUNDARY_POLICY_VIOLATION",
        "The one exact file-scoped operation-listener exception drifted.",
        { marker },
      );
    }
  }
  if (occurrenceCount(sources.configuration, "pathNot: desenAppLocalOperationHostPath") !== 1) {
    fail(
      "BOUNDARY_POLICY_VIOLATION",
      "The operation-listener exception cannot expand to another importer.",
    );
  }
  const cases = [
    {
      name: "allowed-desen-app-browser-e2e-product-server-local-operation-host",
      expectedRule: null,
    },
    {
      name: "desen-app-browser-e2e-product-server-imports-unreviewed-dev-module",
      expectedRule: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
    },
    {
      name: "desen-app-browser-e2e-non-product-server-imports-local-operation-host",
      expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
    },
  ];
  for (const boundaryCase of cases) {
    const expectedRule =
      boundaryCase.expectedRule === null ? "null" : JSON.stringify(boundaryCase.expectedRule);
    const marker =
      "name: " + JSON.stringify(boundaryCase.name) + ",\n    expectedRule: " + expectedRule + ",";
    if (occurrenceCount(sources.verifier, marker) !== 1) {
      fail(
        "BOUNDARY_POLICY_VIOLATION",
        "The exact allowed/forbidden fixture classification drifted.",
        { case: boundaryCase.name },
      );
    }
  }
  requireFragments(
    sources.verifier,
    [
      'const configuration = path.join(workspaceRoot, "dependency-cruiser.config.cjs");',
      '["--config", configuration, "--output-type", "json", ...inputs]',
      "if (!ruleNames.has(boundaryCase.expectedRule))",
      "if ((report.summary?.error ?? 0) !== 0 || result.status !== 0)",
    ],
    BOUNDARY_PATHS.verifier,
    "BOUNDARY_POLICY_VIOLATION",
  );
  requireFragments(
    sources.readme,
    [
      "two exact file-scoped composition edges",
      "apps/desen-app/dev/local-operation-host.mjs",
      "neighboring unreviewed App dev modules",
      "exception grants no access to the App source tree or the rest of its dev directory",
      "All 26",
    ],
    BOUNDARY_PATHS.readme,
    "BOUNDARY_POLICY_VIOLATION",
  );
  const fixtureMarkers = {
    allowedListener: ["export const openDesenAppLocalOperationHost = () => undefined;"],
    allowedImporter: [
      'from "../desen-app/dev/local-operation-host.mjs";',
      "export const allowedOperationHostComposition = openDesenAppLocalOperationHost;",
    ],
    deniedNeighbor: ['export const privateHostDetail = "unreviewed";'],
    deniedNeighborImporter: [
      'from "../desen-app/dev/local-operation-private.mjs";',
      "export const forbiddenDevModuleComposition = privateHostDetail;",
    ],
    deniedOtherImporterListener: ["export const openDesenAppLocalOperationHost = () => undefined;"],
    deniedOtherImporter: [
      'from "../desen-app/dev/local-operation-host.mjs";',
      "export const forbiddenOperationHostComposition = openDesenAppLocalOperationHost;",
    ],
  };
  for (const [key, markers] of Object.entries(fixtureMarkers)) {
    requireFragments(sources[key], markers, BOUNDARY_PATHS[key], "BOUNDARY_POLICY_VIOLATION");
    forbidFragments(
      sources[key],
      ["createServer(", ".listen("],
      BOUNDARY_PATHS[key],
      "BOUNDARY_POLICY_VIOLATION",
    );
  }
  return deepFreeze({
    authorityFiles: Object.keys(BOUNDARY_PATHS).length,
    cases,
    exactAnchoredProductServerImporter: true,
    exactAnchoredLocalListenerTarget: true,
    publicControlPlaneEntryOnlyPreserved: true,
    neighboringDevModulesRemainDenied: true,
    otherBrowserImportersRemainDenied: true,
    applicationSourceAndOtherRootsRemainDenied: true,
    inertFixtureFiles: true,
    boundaryFixtureCasesInSeparateCommand: 26,
    dependencyCruiserExecutedByVerifier: false,
  });
}

function verifyPackageAuthority(files) {
  const app = parseJson(files.get(PACKAGE_PATHS.app), PACKAGE_PATHS.app);
  const browser = parseJson(files.get(PACKAGE_PATHS.browser), PACKAGE_PATHS.browser);
  const referenceCatalog = parseJson(
    files.get(PACKAGE_PATHS.referenceCatalog),
    PACKAGE_PATHS.referenceCatalog,
  );
  const runtimeCore = parseJson(files.get(PACKAGE_PATHS.runtimeCore), PACKAGE_PATHS.runtimeCore);
  const catalog = parseJson(files.get(CATALOG_PATH), CATALOG_PATH);
  const operation = catalog?.operations?.["com.example.auth/signIn"];
  const fixtures = operation?.authoring?.fixtures;
  const fixtureErrors = fixtures?.errors;
  const manifestErrorCodes = operation?.errors?.map(({ code }) => code);
  if (
    app?.name !== "@desen/app-web" ||
    typeof app.scripts?.["test:behavior-authoring"] !== "string" ||
    !app.scripts["test:behavior-authoring"].includes("test/authoring-connections.test.ts") ||
    !app.scripts["test:behavior-authoring"].includes("test/behavior-controls.test.tsx") ||
    !app.scripts["test:behavior-authoring"].includes("test/authoring-fixtures.test.ts") ||
    browser?.name !== "@desen/app-browser-e2e" ||
    !browser.scripts?.["test:e2e"]?.endsWith(
      "playwright test --config success-host-playwright.config.ts",
    ) ||
    referenceCatalog?.name !== "@desen/reference-catalog-web" ||
    referenceCatalog.scripts?.["test:interactive-components"] !==
      "vitest run test/interactive-components.test.tsx" ||
    runtimeCore?.name !== "@desen/runtime-core" ||
    runtimeCore.scripts?.["test:operation-lifecycle"] !==
      "vitest run test/operation-lifecycle.test.ts" ||
    catalog?.id !== "run.desen.reference.sign-in" ||
    operation?.effect !== "network" ||
    !isDeepStrictEqual(manifestErrorCodes, ["invalidCredentials", "unavailable"]) ||
    !exactJsonKeys(fixtures, ["errors", "success"]) ||
    !exactJsonKeys(fixtureErrors, ["invalidCredentials"]) ||
    !isDeepStrictEqual(fixtureErrors.invalidCredentials, {}) ||
    !isDeepStrictEqual(fixtures.success, { userId: "user-1" })
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The package and Catalog-owned M10-T04 contract drifted.");
  }
  return deepFreeze({
    appPackage: app.name,
    browserPackage: browser.name,
    referenceCatalogPackage: referenceCatalog.name,
    runtimeCorePackage: runtimeCore.name,
    focusedTestCommands: FOCUSED_TEST_COMMANDS,
    browserCommand: BROWSER_COMMAND,
    browserSuiteIncludesDedicatedConfig: true,
    catalogId: catalog.id,
    capabilityId: "com.example.auth/signIn",
    exactFixtureErrorCodes: Object.freeze(Object.keys(fixtureErrors)),
    unavailableDeclaredButNotFixtureBacked: true,
    catalogSuccessOutput: fixtures.success,
    localHostSuccessOutputMustDiffer: true,
  });
}

function verifyBridgeReproductionAuthority(files) {
  const generator = decodeUtf8(
    files.get(BRIDGE_REPRODUCTION_PATHS[0]),
    BRIDGE_REPRODUCTION_PATHS[0],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  const fixture = decodeUtf8(
    files.get(BRIDGE_REPRODUCTION_PATHS[1]),
    BRIDGE_REPRODUCTION_PATHS[1],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  requireFragments(
    generator,
    [
      `const EXPECTED_BASE_COMMIT = "${DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.baseCommit}";`,
      'profile: "desen.app.m10-t03-historical-reader-bridge.v1"',
      "successorAddedPaths: [",
      `"${BROWSER_PATHS.spec}"`,
      `"${BROWSER_PATHS.config}"`,
      ...SUCCESSOR_ADDED_PATHS.map((relativePath) => `"${relativePath}"`),
      '"desen-app-failure-fixture": taskTimeArtifact',
      "gzipSync(bytes, { level: 9, mtime: 0 })",
      '{ flag: "wx" }',
    ],
    BRIDGE_REPRODUCTION_PATHS[0],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  requireFragments(
    fixture,
    [
      "authenticateDesenAppSuccessHostOperationSuccessor",
      "readDesenAppT03HistoricalReaderTaskTimeFile",
      "createDesenAppT03HistoricalReaderReadFile",
    ],
    BRIDGE_REPRODUCTION_PATHS[1],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  return deepFreeze({
    exactBaseCommitGenerator: true,
    exclusiveDeterministicGzipWrite: true,
    successorAddedPathInventoryExact: true,
    historicalFixtureUsesBrandedSuccessor: true,
  });
}

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
}

/** Builds detached deterministic M10-T04 evidence from exact current authorities. */
export async function buildDesenAppSuccessHostOperationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const files = await acquireFiles(options);
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const hostBinding = authenticateHostBinding(files.get(HOST_BINDING_ARTIFACT_PATH));
  const bridge = authenticateHistoricalReaderBridge(
    files.get(T03_HISTORICAL_READER_BRIDGE_PATH),
    parent.artifact,
  );
  const source = verifyDesenAppSuccessHostOperationSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const focusedTests = verifyFocusedTestAuthority(files);
  const browser = verifyBrowserAuthority(files);
  const dependencyBoundary = verifyDependencyBoundaryAuthority(files);
  const packageAuthority = verifyPackageAuthority(files);
  const bridgeReproduction = verifyBridgeReproductionAuthority(files);
  const trackedReceipts = Object.freeze(
    TRACKED_PATHS.map((relativePath) => {
      const bytes = files.get(relativePath);
      return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-success-host-operation",
    profile: "desen.app.success-host-operation-proof.v1",
    task: "M10-T04",
    gate: null,
    result: "PASS",
    prerequisites: [parent.summary, hostBinding],
    claim: {
      taskStatus: "DONE",
      p09Status: "PROVEN",
      p10Status: "PROVEN",
      m10T04Closed: true,
      additiveWorkspacePreservesLegacySource: true,
      visibleNoCodeSuccessNavigation: true,
      catalogSyntheticSuccessWithNoHostIo: true,
      explicitAuthorizedIntegrationExecution: true,
      actualLocalHttpHostOperation: true,
      dependencyBoundaryExplicitAndNarrow: true,
      actualHostOutputDistinctFromFixture: true,
      localHostFailureAndSuccessfulRetry: true,
      managedDestinationNavigation: true,
      runSourceGenerationAndBytesUnchanged: true,
      frameGeometryStable: true,
      restartAndDesignRestoreOrigin: true,
      forgedStaleInactiveAndUnboundRequestsRejected: true,
      abortLateSettlementAndReplayFencing: true,
      productionAuthenticationCovered: false,
      productionOperationCovered: false,
      remoteDeploymentCovered: false,
      multiUserPersistenceCovered: false,
      n036Closed: false,
      n040Closed: false,
      g10Closed: false,
    },
    authority: {
      source,
      focusedTests,
      browser,
      dependencyBoundary,
      package: packageAuthority,
      historicalReaderBridge: bridge.summary,
      bridgeReproduction,
    },
    tests: {
      focusedCommands: FOCUSED_TEST_COMMANDS,
      browserCommand: BROWSER_COMMAND,
      boundaryCommand: "pnpm boundaries",
      boundaryFixtureCommand: "node scripts/verify-boundary-fixtures.mjs",
      verifierCommand: "node scripts/verify-desen-app-success-host-operation.mjs",
      proofReaderCommand: "node --test tests/desen-app-success-host-operation.test.mjs",
      rootTestNames: DESEN_APP_SUCCESS_HOST_OPERATION_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
      boundaryExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
    },
    boundary: {
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
      parentArtifacts: 2,
      historicalReaderBridgeArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-success-host-operation-proof.mjs",
        "tests/desen-app-success-host-operation.test.mjs",
      ],
      artifactTrackedEntrypoints: PROOF_ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "M10-T04 proves normal-App synthetic success/navigation and an explicitly selected separately authorized local HTTP operation over the exact T03 and M03-T08 predecessors.",
      "The real local host executes a documented test-only account and returns local-host-user, not the Catalog's user-1 fixture. It is not production authentication.",
      "DESEN Source data contains no endpoint, handler, bearer, production credential, or host implementation authority.",
      "Run navigation is local managed-surface state, not browser history, Source entry mutation, persistence, publication, or activation.",
      "N-036, N-040, remote deployment, multi-user persistence, production operations, and G10 remain unproven.",
      "The deterministic reader starts no Chromium, Vite, network listener, or external host. Browser execution remains a separate fresh workload, not a cached seal result.",
      "Local evidence does not imply hosted exact-head Quality gate or Browser E2E success.",
    ],
  });
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App success and local host operation",
    "",
    "Task: M10-T04",
    "",
    "Status: DONE",
    "",
    "P-09: PROVEN",
    "",
    "P-10: PROVEN",
    "",
    "Predecessor artifact: `sha256:" + DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN.sha256 + "`",
    "",
    "Host binding artifact: `sha256:" +
      DESEN_APP_SUCCESS_HOST_OPERATION_HOST_BINDING_PIN.sha256 +
      "`",
    "",
    "Historical bridge: `sha256:" + DESEN_APP_T03_HISTORICAL_READER_BRIDGE_PIN.sha256 + "`",
    "",
    "Final artifact: `sha256:" + artifactSha256 + "`",
  ].join("\n");
  if (
    !source.startsWith(expectedHeader) ||
    occurrenceCount(source, "Task: M10-T04") !== 1 ||
    occurrenceCount(source, "Status: DONE") !== 1 ||
    occurrenceCount(source, "P-09: PROVEN") !== 1 ||
    occurrenceCount(source, "P-10: PROVEN") !== 1 ||
    occurrenceCount(source, "Final artifact:") !== 1 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T04 proof report lost its exact authority header.");
  }
}

function assertPinnedArtifact(bytes) {
  const pin = DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PIN;
  if (
    pin.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(pin.sha256) ||
    bytes.byteLength !== pin.bytes ||
    sha256(bytes) !== pin.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T04 artifact bytes drifted.");
  }
}

/** Verifies the frozen M10-T04 artifact against freshly acquired exact authorities. */
export async function verifyDesenAppSuccessHostOperationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppSuccessHostOperationEvidence(options.buildOptions);
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH)
      : captureBytes(options.artifactBytes, "artifactBytes");
  assertPinnedArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M10-T04 artifact does not match current authorities.");
  }
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.task !== "M10-T04" ||
    artifact?.proofId !== "desen-app-success-host-operation" ||
    artifact?.profile !== "desen.app.success-host-operation-proof.v1" ||
    artifact?.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The committed M10-T04 artifact identity drifted.");
  }
  const proofDocumentPath =
    options.proofDocumentPath === undefined
      ? DEFAULT_PROOF_DOCUMENT_PATH
      : path.resolve(options.proofDocumentPath);
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularAuthority(proofDocumentPath, PROOF_DOCUMENT_RELATIVE_PATH)
      : captureBytes(options.proofDocument, "proofDocument");
  verifyProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: artifact.task,
    result: artifact.result,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    focusedDeclarationSites: artifact.authority.focusedTests.totalDeclarationSites,
    chromiumScenarios: artifact.authority.browser.chromiumConfigurations,
    p09Status: artifact.claim.p09Status,
    p10Status: artifact.claim.p10Status,
    m10T04Closed: artifact.claim.m10T04Closed,
    browserExecutedByVerifier: false,
  });
}

function successorAuthority(successor) {
  if (
    successor === null ||
    typeof successor !== "object" ||
    utilTypes.isProxy(successor) ||
    !SUCCESSOR_AUTHORITIES.has(successor)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "T03 historical compatibility requires the exact authenticated M10-T04 successor.",
    );
  }
  return SUCCESSOR_AUTHORITIES.get(successor);
}

/**
 * Authenticates the exact official M10-T04 successor for the historical M10-T03 reader.
 *
 * @remarks This function directly authenticates the frozen T03 artifact and bridge. It never
 * imports or invokes the T03 proof module, avoiding a cyclic reader authority.
 */
export async function authenticateDesenAppSuccessHostOperationSuccessor(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions, ["workspaceRoot"], "successor options");
  const workspaceRoot = path.resolve(options.workspaceRoot ?? WORKSPACE_ROOT);
  const verified = await verifyDesenAppSuccessHostOperationEvidence({
    artifactPath: path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
    proofDocumentPath: path.join(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH),
    buildOptions: { workspaceRoot },
  });
  const parent = authenticateParent(
    await readRegularAuthority(
      path.join(workspaceRoot, PARENT_ARTIFACT_PATH),
      PARENT_ARTIFACT_PATH,
    ),
  );
  const bridge = authenticateHistoricalReaderBridge(
    await readRegularAuthority(
      path.join(workspaceRoot, T03_HISTORICAL_READER_BRIDGE_PATH),
      T03_HISTORICAL_READER_BRIDGE_PATH,
    ),
    parent.artifact,
  );
  const successor = deepFreeze({
    task: "M10-T04",
    proofId: "desen-app-success-host-operation",
    profile: "desen.app.success-host-operation-proof.v1",
    result: verified.result,
    artifact: {
      path: ARTIFACT_RELATIVE_PATH,
      ...DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PIN,
      immutable: true,
    },
    predecessor: { ...DESEN_APP_SUCCESS_HOST_OPERATION_PARENT_PIN },
    trackedFiles: verified.trackedFiles,
    p09Status: verified.p09Status,
    p10Status: verified.p10Status,
    m10T04Closed: verified.m10T04Closed,
  });
  SUCCESSOR_AUTHORITIES.set(successor, bridge);
  return successor;
}

function validateHistoricalOverrideMap(fileOverrides) {
  if (
    !(fileOverrides instanceof Map) ||
    utilTypes.isProxy(fileOverrides) ||
    Object.getPrototypeOf(fileOverrides) !== Map.prototype ||
    Reflect.ownKeys(fileOverrides).length !== 0 ||
    fileOverrides.size > MAX_HISTORICAL_OVERRIDES
  ) {
    fail("OPTIONS_INVALID", "Historical fileOverrides must be one inert bounded Map.");
  }
}

/** Materializes exact T03 task-time bytes first, then applies caller mutations defensively. */
export function materializeDesenAppT03HistoricalReaderFileOverrides(successor, fileOverrides) {
  const authority = successorAuthority(successor);
  validateHistoricalOverrideMap(fileOverrides);
  const materialized = new Map(
    [...authority.files].map(([relativePath, bytes]) => [relativePath, Buffer.from(bytes)]),
  );
  let totalBytes = 0;
  for (const [relativePath, bytes] of Map.prototype.entries.call(fileOverrides)) {
    if (!safeRelativePath(relativePath)) {
      fail("OPTIONS_INVALID", "Historical fileOverrides contains an unsafe relative path.");
    }
    const captured = captureBytes(bytes, `historical fileOverrides[${relativePath}]`);
    totalBytes += captured.byteLength;
    if (totalBytes > MAX_AUTHORITY_BYTES) {
      fail("OPTIONS_INVALID", "Historical fileOverrides exceeds its aggregate byte budget.");
    }
    materialized.set(relativePath, captured);
  }
  return materialized;
}

/** Returns a defensive copy of one exact M10-T03 task-time file. */
export function readDesenAppT03HistoricalReaderTaskTimeFile(successor, relativePath) {
  if (!safeRelativePath(relativePath)) {
    fail("OPTIONS_INVALID", "relativePath must be one safe relative path.");
  }
  const bytes = successorAuthority(successor).files.get(relativePath);
  if (bytes === undefined) {
    fail("OPTIONS_INVALID", "relativePath has no T03 task-time bridge entry.", { relativePath });
  }
  return Buffer.from(bytes);
}

/** Removes only the exact authenticated T04-added paths from a historical file inventory. */
export function projectDesenAppT03HistoricalReaderPathInventory(successor, currentPaths) {
  const authority = successorAuthority(successor);
  if (
    !Array.isArray(currentPaths) ||
    utilTypes.isProxy(currentPaths) ||
    Object.getPrototypeOf(currentPaths) !== Array.prototype ||
    currentPaths.length > 4_096 ||
    Reflect.ownKeys(currentPaths).some(
      (key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    fail("OPTIONS_INVALID", "Historical path inventory must be one bounded dense array.");
  }
  const captured = [];
  for (let index = 0; index < currentPaths.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(currentPaths, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      !safeRelativePath(descriptor.value)
    ) {
      fail("OPTIONS_INVALID", "Historical path inventory contains unsupported authority.");
    }
    captured.push(descriptor.value);
  }
  if (new Set(captured).size !== captured.length) {
    fail("OPTIONS_INVALID", "Historical path inventory contains duplicate paths.");
  }
  return Object.freeze(
    captured.filter((relativePath) => !authority.successorAddedPaths.has(relativePath)),
  );
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Atomically writes newly built M10-T04 evidence or refuses unsafe tracked replacement. */
export async function writeDesenAppSuccessHostOperationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const built = await buildDesenAppSuccessHostOperationEvidence(options.buildOptions);
  let destination;
  try {
    destination = await canonicalDestinationPath(artifactPath);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T04 artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  if (
    destination ===
    (await canonicalDestinationPath(DEFAULT_DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PATH))
  ) {
    try {
      const existing = await readRegularAuthority(destination, ARTIFACT_RELATIVE_PATH);
      if (
        DESEN_APP_SUCCESS_HOST_OPERATION_ARTIFACT_PIN.bytes > 0 &&
        !existing.equals(built.artifactBytes)
      ) {
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked M10-T04 artifact.");
      }
    } catch (error) {
      if (
        error instanceof DesenAppSuccessHostOperationProofError &&
        error.code !== "AUTHORITY_UNSAFE"
      ) {
        throw error;
      }
    }
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof DesenAppSuccessHostOperationProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "M10-T04 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
