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
import {
  authenticateRedactedHistoricalArchive,
  getHistoricalArchiveRedactionPin,
  matchesAmendedHistoricalReceipt,
} from "./historical-archive-redaction.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/desen-app-0.1.0-failure-fixture.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-FAILURE-FIXTURE.md";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-input-pending-fixture.json";
const T02_HISTORICAL_READER_BRIDGE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-t02-historical-reader-bridge.json.gz";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_BYTES = 4 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_INFLATED_BYTES = 8 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES = 6 * 1_024 * 1_024;
const MAX_HISTORICAL_OVERRIDES = 256;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  behaviorProjection: "apps/desen-app/src/authoring-behavior-projection.ts",
  conditions: "apps/desen-app/src/authoring-conditions.ts",
  authoringConnections: "apps/desen-app/src/authoring-connections.ts",
  behaviorControls: "apps/desen-app/src/behavior-controls.tsx",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  alert: "packages/reference-catalog-web/src/components/alert.tsx",
  textField: "packages/reference-catalog-web/src/components/text-field.tsx",
  button: "packages/reference-catalog-web/src/components/button.tsx",
  headlessSession: "packages/runtime-core/src/headless-session.ts",
  operationLifecycle: "packages/runtime-core/src/operation-lifecycle.ts",
});

const TEST_PATHS = Object.freeze({
  evergreenProductComposition: "apps/desen-app/test/evergreen-product-composition.test.tsx",
  authoringBehaviorProjection: "apps/desen-app/test/authoring-behavior-projection.test.ts",
  authoringConditions: "apps/desen-app/test/authoring-conditions.test.ts",
  authoringConnections: "apps/desen-app/test/authoring-connections.test.ts",
  behaviorControls: "apps/desen-app/test/behavior-controls.test.tsx",
  authoringFixtures: "apps/desen-app/test/authoring-fixtures.test.ts",
  interactiveComponents: "packages/reference-catalog-web/test/interactive-components.test.tsx",
  headlessSession: "packages/runtime-core/test/headless-session.test.ts",
  operationLifecycle: "packages/runtime-core/test/operation-lifecycle.test.ts",
});

const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/failure-fixture.pw.ts",
  config: "apps/desen-app-browser-e2e/failure-playwright.config.ts",
});

const PACKAGE_PATHS = Object.freeze({
  app: "apps/desen-app/package.json",
  browser: "apps/desen-app-browser-e2e/package.json",
  referenceCatalog: "packages/reference-catalog-web/package.json",
  runtimeCore: "packages/runtime-core/package.json",
});

const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";

const BRIDGE_REPRODUCTION_PATHS = Object.freeze([
  "scripts/generate-desen-app-t02-historical-reader-bridge.mjs",
  "tests/desen-app-t02-historical-reader-fixture.mjs",
]);

const PROOF_ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-failure-fixture-proof.mjs",
  "scripts/verify-desen-app-failure-fixture.mjs",
]);

const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...Object.values(TEST_PATHS),
    ...Object.values(BROWSER_PATHS),
    ...Object.values(PACKAGE_PATHS),
    CATALOG_PATH,
    ...BRIDGE_REPRODUCTION_PATHS,
    ...PROOF_ENTRYPOINT_PATHS,
    PARENT_ARTIFACT_PATH,
    T02_HISTORICAL_READER_BRIDGE_PATH,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const FOCUSED_TEST_COMMANDS = Object.freeze([
  "pnpm --filter @desen/app-web exec vitest run test/evergreen-product-composition.test.tsx test/authoring-behavior-projection.test.ts test/authoring-conditions.test.ts test/authoring-connections.test.ts test/behavior-controls.test.tsx test/authoring-fixtures.test.ts",
  "pnpm --filter @desen/reference-catalog-web exec vitest run test/interactive-components.test.tsx",
  "pnpm --filter @desen/runtime-core exec vitest run test/operation-lifecycle.test.ts test/headless-session.test.ts",
]);
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config failure-playwright.config.ts";
const BROWSER_TEST_NAME = "authors and retries one visible Catalog-declared public failure";

/** Exact immutable M10-T02 predecessor required by the visible-failure proof. */
export const DESEN_APP_FAILURE_FIXTURE_PARENT_PIN = Object.freeze({
  task: "M10-T02",
  gate: null,
  proofId: "desen-app-input-pending-fixture",
  path: PARENT_ARTIFACT_PATH,
  bytes: 14_261,
  sha256: "161202698b013775cbc89625ecea1f6894e9abcd927fb2eb660dff71652ba43d",
  profile: "desen.app.input-pending-fixture-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Historical M10-T02 identity; current archive bytes require the separate AR-01 transport pin. */
export const DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN = Object.freeze({
  path: T02_HISTORICAL_READER_BRIDGE_PATH,
  bytes: 2_491_742,
  sha256: "a3ef969f87441e2d8079dc7cd27db3a759acbb645441d206c3b35adc3149ec10",
  uncompressedBytes: 3_728_371,
  baseCommit: "d2c632f2cacab5d316d57aa3d51758d2a76d3cd2",
  fileEntries: 25,
  predecessorGapFiles: 0,
  successorAddedPaths: 2,
  projections: 1,
});

/** Independent root cases owned by the append-only M10-T03 proof family. */
export const DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the immutable M10-T02 parent without invoking its reader",
  "[authoring] creates a critical Alert and failed predicate through visible controls",
  "[fixture] admits only the exact Catalog-declared public error outcome",
  "[failure] exposes one real Runtime failure and authored Alert after pending",
  "[retry] clears stale failure while pending and reproduces it after settlement",
  "[continuity] preserves input, route, focus-safe geometry, and exact frame layout",
  "[generic] keeps reusable product composition free of invalidCredentials assumptions",
  "[boundary] leaves success, navigation, real host, T04, N-036, P-09/P-10 closure, and G10 open",
  "[determinism] builds byte-identical evidence with exact receipts and a bounded T02 bridge",
  "[policy] rejects source, test, parent, bridge, artifact, report, option, and destination drift",
]);

/** Default destination of the deterministic M10-T03 artifact. */
export const DEFAULT_DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);

// Filled after the detached artifact is generated. The reader and root test remain checkpoint-owned.
export const DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PIN = Object.freeze({
  bytes: 16_868,
  sha256: "bde909f8dbc4837c70627bab454d3dc5a936bd0abb6d70ec22b9cffbdb0e6a20",
});

const SUCCESSOR_AUTHORITIES = new WeakMap();
let cachedHistoricalBridgeAuthority;

async function authenticateSuccessHostOperationSuccessor(workspaceRoot) {
  let successorModule;
  try {
    successorModule = await import("./desen-app-success-host-operation-proof.mjs");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Historical T03 compatibility requires the official M10-T04 successor reader.",
        { cause: String(error) },
      );
    }
    throw error;
  }
  const authenticate = successorModule.authenticateDesenAppSuccessHostOperationSuccessor;
  const materialize = successorModule.materializeDesenAppT03HistoricalReaderFileOverrides;
  const readTaskTimeFile = successorModule.readDesenAppT03HistoricalReaderTaskTimeFile;
  if (
    typeof authenticate !== "function" ||
    typeof materialize !== "function" ||
    typeof readTaskTimeFile !== "function"
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The official M10-T04 successor reader does not expose the T03 bridge contract.",
    );
  }
  let successor;
  try {
    successor = await authenticate({ workspaceRoot });
  } catch (error) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The official M10-T04 successor was not authenticated.", {
      cause: String(error),
    });
  }
  return Object.freeze({ materialize, readTaskTimeFile, successor });
}

/** Stable fail-closed error raised by the M10-T03 evidence reader. */
export class DesenAppFailureFixtureProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppFailureFixtureProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppFailureFixtureProofError(code, message, details);
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
    if (error instanceof DesenAppFailureFixtureProofError) throw error;
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
    if (error instanceof DesenAppFailureFixtureProofError) throw error;
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
    fail(code, `${label} lost required visible-failure authority.`, { missing });
  }
}

function forbidFragments(source, fragments, label, code = "SOURCE_POLICY_VIOLATION") {
  const present = fragments.filter((fragment) => source.includes(fragment));
  if (present.length > 0) {
    fail(code, `${label} acquired authority outside M10-T03.`, { present });
  }
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_FAILURE_FIXTURE_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T02 parent artifact drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    !exactJsonKeys(artifact, [
      "schemaVersion",
      "proofId",
      "profile",
      "task",
      "gate",
      "result",
      "prerequisites",
      "claim",
      "authority",
      "tests",
      "boundary",
      "nonClaims",
    ]) ||
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.gate !== null ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.p09Status !== "PARTIAL" ||
    artifact.claim?.p10Status !== "PARTIAL" ||
    artifact.claim?.m10T03Closed !== false ||
    artifact.claim?.visibleFailureStateCovered !== false ||
    artifact.boundary?.trackedFiles !== 25 ||
    artifact.tests?.rootTestNames?.length !== 10
  ) {
    fail("PARENT_DRIFT", "The immutable M10-T02 parent schema or claims drifted.");
  }
  return Object.freeze({ summary: { ...pin }, artifact: deepFreeze(artifact) });
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
  const historicalPin = DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN;
  let transport;
  try {
    transport = authenticateRedactedHistoricalArchive(historicalPin.path, compressedBytes);
  } catch (error) {
    fail(
      "HISTORICAL_BRIDGE_DRIFT",
      "The amended historical archive transport was not authenticated.",
      {
        cause: String(error),
      },
    );
  }
  if (
    transport.historical.bytes !== historicalPin.bytes ||
    transport.historical.sha256 !== historicalPin.sha256 ||
    transport.historical.baseCommit !== historicalPin.baseCommit
  ) {
    fail(
      "HISTORICAL_BRIDGE_DRIFT",
      "The archive amendment names a different historical authority.",
    );
  }
  const pin = { ...historicalPin, ...transport.current };
  if (
    compressedBytes.byteLength !== pin.bytes ||
    compressedBytes.byteLength > MAX_HISTORICAL_BRIDGE_BYTES ||
    sha256(compressedBytes) !== pin.sha256
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The exact compressed T02 historical bridge drifted.");
  }
  if (cachedHistoricalBridgeAuthority !== undefined) {
    if (!isDeepStrictEqual(cachedHistoricalBridgeAuthority.projection, parentArtifact)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The cached T02 projection differs from its parent.");
    }
    return cachedHistoricalBridgeAuthority;
  }

  let inflated;
  try {
    inflated = gunzipSync(compressedBytes, {
      maxOutputLength: MAX_HISTORICAL_BRIDGE_INFLATED_BYTES,
    });
  } catch (error) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T02 bridge is not bounded gzip.", {
      cause: String(error),
    });
  }
  if (inflated.byteLength !== pin.uncompressedBytes) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T02 bridge inflated size drifted.");
  }
  let manifest;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
    manifest = JSON.parse(source);
    if (!Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8").equals(inflated)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The T02 bridge is not canonical dense JSON.");
    }
  } catch (error) {
    if (error instanceof DesenAppFailureFixtureProofError) throw error;
    fail("HISTORICAL_BRIDGE_DRIFT", "The T02 bridge JSON is invalid.", {
      cause: String(error),
    });
  }

  const projectionKeys = ["desen-app-input-pending-fixture"];
  const expectedAddedPaths = [BROWSER_PATHS.spec, BROWSER_PATHS.config].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
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
    manifest.profile !== pin.profile ||
    manifest.baseCommit !== pin.baseCommit ||
    !Array.isArray(manifest.successorAddedPaths) ||
    !isDeepStrictEqual(manifest.successorAddedPaths, expectedAddedPaths) ||
    !exactJsonKeys(manifest.files, Object.keys(manifest.files)) ||
    Object.keys(manifest.files).length !== pin.fileEntries ||
    !exactJsonKeys(manifest.projections, projectionKeys) ||
    !isDeepStrictEqual(manifest.projections[projectionKeys[0]], parentArtifact)
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T02 bridge identity or parent projection drifted.");
  }

  const encodedEntries = Object.entries(manifest.files);
  const encodedPaths = encodedEntries.map(([relativePath]) => relativePath);
  if (
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
    fail("HISTORICAL_BRIDGE_DRIFT", "The T02 task-time file manifest is not canonical.");
  }
  const files = new Map();
  let decodedBytes = 0;
  for (const [relativePath, encoded] of encodedEntries) {
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", `Invalid T02 task-time file: ${relativePath}.`);
    }
    decodedBytes += bytes.byteLength;
    if (decodedBytes > MAX_HISTORICAL_BRIDGE_DECODED_FILE_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The decoded T02 file authority exceeds its bound.");
    }
    files.set(relativePath, bytes);
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

/** Verifies the exact M10-T03 implementation profile without executing product code. */
export function verifyDesenAppFailureFixtureSourcePolicy(rawInput) {
  const input = exactOwnDataOptions(rawInput, Object.keys(SOURCE_PATHS), "source policy input");
  for (const key of Object.keys(SOURCE_PATHS)) {
    if (typeof input[key] !== "string") {
      fail("SOURCE_POLICY_VIOLATION", `source policy input.${key} must be text.`);
    }
  }

  requireFragments(
    input.authoringConnections,
    [
      'readonly concurrency: "queue" | "reject" | "replace";',
      'fields.concurrency !== "queue"',
      'fields.concurrency !== "reject"',
      'fields.concurrency !== "replace"',
      'candidate.type === "operation.invoke" ? [index] : []',
      'if (operationIndexes.length > 1) return failure("connection-conflict");',
      "concurrency: capturedRecipe.concurrency",
      "{ onSuccess: existingOperation.onSuccess }",
      "{ onFailure: existingOperation.onFailure }",
      "{ when: existingOperation.when }",
      "{ extensions: existingOperation.extensions }",
      "$ref: `operation.${capturedRecipe.alias}.pending`",
      "replaceDesenEditorAction(candidate",
      'return completeValidation(prepared, candidate, "connect-operation-trigger");',
    ],
    SOURCE_PATHS.authoringConnections,
  );
  requireFragments(
    input.behaviorControls,
    [
      "export function OperationConnectionControl",
      "model.referenceOptions.operations",
      "model.referenceOptions.states",
      "readonly operationAliases: readonly AuthoringOperationAliasOption[];",
      "operationAliases: surfaceOperationAliases",
      "const reservedAliases = surfaceOperationAliases.map(({ alias }) => alias);",
      "const reserved = new Set(reservedAliases.filter((alias) => alias !== currentAlias));",
      'const selected = compatible.find(({ value }) => value === field.value)?.value ?? "";',
      'if (!Object.hasOwn(current.input, field.value)) return [field.value, ""];',
      "function unrepresentableOperationInputNames(",
      "const declaredInputNames = new Set(operation.inputFields.map(({ value }) => value));",
      "Object.keys(current.input).filter((inputName) => !declaredInputNames.has(inputName))",
      'current?.concurrency ?? "reject"',
      'aria-label="Operation connection Catalog operation"',
      'aria-label="Operation connection result name"',
      'aria-label="Operation connection concurrency"',
      "<span>If operation is already running</span>",
      '<option value="reject">Ignore while running</option>',
      "connectLoading: true",
      "Advanced input values are preserved. Choose replacement states for",
      "unrepresentableInputs.length > 0",
      "const aliasAvailable = alias === current?.as || !reservedAliases.includes(alias);",
      "This result name is already used on this surface. Choose a unique name.",
      "!aliasAvailable",
      "Pending → Loading · this control blocks activation while pending. Concurrency governs",
      "Connected Press, operation.${alias}, and Loading pending.",
    ],
    SOURCE_PATHS.behaviorControls,
  );
  if (occurrenceCount(input.behaviorControls, 'current?.concurrency ?? "reject"') !== 2) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Operation connection default and authoritative reset must both retain reject concurrency.",
    );
  }
  requireFragments(
    input.application,
    [
      "applyAuthoringOperationTriggerConnection",
      "function connectSelectedOperation(",
      "prepareAuthoringPreviewBundle(",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      "<OperationConnectionControl",
      "operationAliases={behaviorProjection.operationAliases}",
      "onConnect={connectSelectedOperation}",
    ],
    SOURCE_PATHS.application,
  );
  requireFragments(
    input.textField,
    [
      "onChange(Object.freeze({ value: event.currentTarget.value }));",
      'type={secure ? "password" : "text"}',
      "value={value}",
    ],
    SOURCE_PATHS.textField,
  );
  requireFragments(
    input.button,
    [
      "const inactive = disabled || loading;",
      "aria-busy={loading || undefined}",
      "aria-disabled={loading || undefined}",
      'data-loading={loading ? "true" : undefined}',
      "if (!inactive) onPress?.(Object.freeze({}));",
    ],
    SOURCE_PATHS.button,
  );
  requireFragments(
    input.operationLifecycle,
    [
      'record.lifecycle = Object.freeze({ status: "pending", pending: true });',
      'envelope.concurrency === "queue"',
      'envelope.concurrency === "replace"',
      'status: "rejected"',
      'reason: "pending"',
      "scheduleTransport(authority, record, attempt);",
    ],
    SOURCE_PATHS.operationLifecycle,
  );
  if (
    occurrenceCount(
      input.operationLifecycle,
      'record.lifecycle = Object.freeze({ status: "pending", pending: true });',
    ) !== 3
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Every admitted immediate, staged, and promoted operation path must publish pending.",
    );
  }
  requireFragments(
    input.authoringFixtures,
    [
      "export function createAuthoringOperationFixtureController(",
      "for (const errorCode of Object.keys(fixtures.errors ?? {}).sort(compareText))",
      "id: `error:${errorCode}`",
      "description: errorDescriptions.get(errorCode)",
      'deepFreezeProjection({ status: "failed", errorCode: outcome.errorCode as string })',
      'state.status = current.outcome.kind === "success" ? "succeeded" : "failed";',
      "Request input is deliberately never read or retained.",
      "const promise = new Promise<RuntimeHostCallResult>",
      'state.status = "pending";',
      "return promise;",
      "const current = state.pending;",
      "current.resolve(operationOutcomeResult(current.outcome));",
      "revoked.resolve(DENIED_RESULT);",
      "state.pending?.resolve(DENIED_RESULT);",
    ],
    SOURCE_PATHS.authoringFixtures,
  );
  forbidFragments(
    input.authoringFixtures,
    ["fetch(", "XMLHttpRequest", "ProductionOperation", "integrationOperationPort"],
    SOURCE_PATHS.authoringFixtures,
  );
  requireFragments(
    input.alert,
    ['critical: "alert"', "role={TONE_ROLES[tone]}", "data-tone={tone}"],
    SOURCE_PATHS.alert,
  );
  requireFragments(
    input.operationLifecycle,
    [
      "if (!record.publicErrors.has(result.errorCode))",
      '"The operation adapter returned an undeclared public error code."',
      "error: Object.freeze({ code: result.errorCode })",
    ],
    SOURCE_PATHS.operationLifecycle,
  );
  requireFragments(
    input.headlessSession,
    [
      "subscribeRuntimeActionTurnSettlements",
      "invalidateSurface(authority, lifetime, reason);",
      "materializeRuntimeHeadlessSurface({",
      "commitPublishedReactive(",
    ],
    SOURCE_PATHS.headlessSession,
  );
  requireFragments(
    input.behaviorProjection,
    ["projectAuthoringBehaviorControls(", "Operation names come only from authored"],
    SOURCE_PATHS.behaviorProjection,
  );
  requireFragments(
    input.conditions,
    [
      "applyAuthoringConditionEdit(",
      "setDesenEditorNodeCondition",
      "clearDesenEditorNodeCondition",
    ],
    SOURCE_PATHS.conditions,
  );
  for (const [key, source] of Object.entries(input)) {
    forbidFragments(source, ["invalidCredentials"], SOURCE_PATHS[key]);
  }

  return deepFreeze({
    controlledCurrentStringEmission: true,
    secureAndPlainInputShareOneControlledPath: true,
    catalogOperationAndStateMapping: true,
    exactNameOnlyStateSuggestion: true,
    collisionFreeSuggestedAlias: true,
    manuallyReservedAliasRejected: true,
    absentOptionalInputPreserved: true,
    unrepresentableAdvancedInputRepairBlocked: true,
    undeclaredAdvancedInputRepairBlocked: true,
    concurrencyMeaningExplicit: true,
    explicitRejectConcurrency: true,
    atomicLoadingPendingReference: true,
    repairPreservesBranchesGuardAndExtensions: true,
    ambiguousRootInvocationRejected: true,
    currentPreviewRevalidatedBeforeCommit: true,
    runtimePendingPublishedBeforeTransport: true,
    loadingAccessibleAndFocusPreserving: true,
    loadingSuppressesActivation: true,
    syntheticPromiseExplicitlyUnresolved: true,
    fixtureRequestInputOpaque: true,
    fixtureDeactivationAndDisposalRevoke: true,
    catalogErrorFixtureProjectionGeneric: true,
    declaredPublicErrorOnly: true,
    technicalFailureRedactionPreserved: true,
    conditionalRuntimeReevaluationPreserved: true,
    criticalAlertSemanticsPreserved: true,
    referenceErrorCodeAbsentFromGenericSources: true,
  });
}

function verifyFocusedTestAuthority(files) {
  const sources = Object.fromEntries(
    Object.entries(TEST_PATHS).map(([key, relativePath]) => [
      key,
      decodeUtf8(files.get(relativePath), relativePath, "TEST_POLICY_VIOLATION"),
    ]),
  );
  requireFragments(
    sources.evergreenProductComposition,
    [
      '"authoring-behavior-projection.ts"',
      '"authoring-conditions.ts"',
      '"behavior-controls.tsx"',
      '"invalidCredentials"',
      "keeps generic editor modules free of the reference sign-in composition",
    ],
    TEST_PATHS.evergreenProductComposition,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.authoringBehaviorProjection,
    ['{ $ref: "operation.signIn.status" }, "failed"'],
    TEST_PATHS.authoringBehaviorProjection,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.authoringConditions,
    [
      'const alert = selectionFor(document, "sign-in.error");',
      "expect(alert.conditional).toBe(true);",
      "expect(Object.hasOwn(findNode(cleared.document",
    ],
    TEST_PATHS.authoringConditions,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.authoringConnections,
    [
      "connects press, mapped state inputs, and loading without exposing intermediates",
      'concurrency: "replace"',
      "repairs one root invocation in place while preserving branches, guards, and extensions",
      'concurrency: "reject"',
      "rejects multiple ambiguous root invocations without exposing a candidate",
      'reason: "connection-conflict"',
    ],
    TEST_PATHS.authoringConnections,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.behaviorControls,
    [
      "connects press, mapped inputs, concurrency, and Runtime pending as one operation recipe",
      'target: { value: "reject" }',
      "Connected Press, operation.signIn, and Loading pending.",
      "resets a same-owner draft and stale notice after an external operation edit",
      "suggests a surface-unique alias and rejects a manually reserved result name",
      "keeps an omitted optional input omitted when repairing",
      "requires explicit replacement states before repairing advanced declared inputs",
      "never drops an additional advanced input that only Actions can represent",
      "requires an explicit state when a new operation input has no exact-name match",
    ],
    TEST_PATHS.behaviorControls,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.authoringFixtures,
    [
      "keeps synthetic explicit while integration and production remain unavailable",
      "derives every Source alias and only authenticated Catalog fixture outcomes",
      "derives a non-auth operation, effect, and error inventory from Catalog authority",
      "keeps independent aliases pending and settles each captured Catalog outcome explicitly",
      "never reads or retains operation input and rejects accessor authorization fields",
      "revokes pending work on deactivate, supports replay, and terminally disposes",
    ],
    TEST_PATHS.authoringFixtures,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.interactiveComponents,
    [
      "suppresses Button press while preserving focus during loading",
      "expect(loadingButton.disabled).toBe(false);",
      'expect(loadingButton.getAttribute("aria-busy")).toBe("true");',
      "expect(document.activeElement).toBe(loadingButton);",
      "expect(presses).toBe(0);",
    ],
    TEST_PATHS.interactiveComponents,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.operationLifecycle,
    [
      "enters pending synchronously and sends detached Catalog-owned effect/input/context",
      'status: "pending"',
      "defaults omitted concurrency to reject and rejected attempts consume no generation",
      'reason: "pending"',
      "keeps synchronous host results asynchronous so pending is observable first",
      "exposes only declared public failures and publishes the closed failed lifecycle",
      "redacts undeclared errors, thrown/rejected adapters, and malformed envelopes",
    ],
    TEST_PATHS.operationLifecycle,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    sources.headlessSession,
    [
      "removes the false interactive Alert subtree and restores it only for current failure",
      'errorCode: "invalidCredentials"',
      'sourceNodeId === "sign-in.error"',
    ],
    TEST_PATHS.headlessSession,
    "TEST_POLICY_VIOLATION",
  );
  return deepFreeze({
    evergreenProductCompositionCases: testDeclarationCount(sources.evergreenProductComposition),
    authoringBehaviorProjectionCases: testDeclarationCount(sources.authoringBehaviorProjection),
    authoringConditionCases: testDeclarationCount(sources.authoringConditions),
    authoringConnectionCases: testDeclarationCount(sources.authoringConnections),
    behaviorControlCases: testDeclarationCount(sources.behaviorControls),
    authoringFixtureCases: testDeclarationCount(sources.authoringFixtures),
    interactiveComponentCases: testDeclarationCount(sources.interactiveComponents),
    headlessSessionCases: testDeclarationCount(sources.headlessSession),
    operationLifecycleCases: testDeclarationCount(sources.operationLifecycle),
    operationRepairAndAmbiguityCovered: true,
    semanticControlRerenderCovered: true,
    collisionFreeAndReservedAliasCovered: true,
    exactNameOnlyStateMappingCovered: true,
    optionalInputAbsenceRoundTripCovered: true,
    declaredAndAdditionalAdvancedInputLossBlocked: true,
    catalogDerivedSyntheticOutcomesCovered: true,
    opaqueInputAndRevocationCovered: true,
    focusPreservingLoadingSuppressionCovered: true,
    synchronousPendingAndRejectCovered: true,
    genericReferenceErrorGuardCovered: true,
    authoredFailedPredicateCovered: true,
    authoredConditionSetClearCovered: true,
    declaredFailureAndTechnicalRedactionCovered: true,
    conditionalAlertRemoveRestoreCovered: true,
  });
}

function verifyBrowserAuthority(files) {
  const spec = decodeUtf8(
    files.get(BROWSER_PATHS.spec),
    BROWSER_PATHS.spec,
    "TEST_POLICY_VIOLATION",
  );
  const config = decodeUtf8(
    files.get(BROWSER_PATHS.config),
    BROWSER_PATHS.config,
    "TEST_POLICY_VIOLATION",
  );
  requireFragments(
    spec,
    [
      'test("' + BROWSER_TEST_NAME + '"',
      'const PUBLIC_FAILURE_MESSAGE = "We could not sign in. Check your details and try again.";',
      'await page.getByRole("button", { name: "New project" }).click();',
      'await addLocalState(page, "email");',
      'await addLocalState(page, "password");',
      'await connectInput(page, "email");',
      'await connectInput(page, "password");',
      'getByRole("button", { name: "Set Secure" }).click();',
      'getByRole("switch", { name: "Secure" }).check();',
      'name: "Operation connection"',
      '"Connected Press, operation.signIn, and Loading pending."',
      'await insertComponent(page, "Alert", 4);',
      'await setTextProperty(page, "Text", PUBLIC_FAILURE_MESSAGE);',
      'getByRole("combobox", { name: "Tone" }).selectOption("critical");',
      'selectOption("operation");',
      'selectOption("signIn");',
      'selectOption("failed");',
      'await expect(canvas.getByRole("alert")).toHaveCount(0);',
      'getByRole("radio", { name: /^Synthetic/u })',
      'getByRole("radio", { name: /^Integration/u })',
      'getByRole("radio", { name: /^Production/u })',
      '.toEqual(["success", "error:invalidCredentials"]);',
      'await outcome.selectOption("error:invalidCredentials");',
      'await email.pressSequentially("designer@example.test");',
      'await password.pressSequentially("correct horse battery staple");',
      "await submit.click();",
      '"Pending · complete this fixture to settle the Runtime call."',
      'await expect(canvas.getByRole("alert")).toHaveCount(0);',
      'await expect(submit).toHaveAttribute("aria-busy", "true");',
      'await expect(email).toHaveValue("designer@example.test");',
      'await expect(password).toHaveValue("correct horse battery staple");',
      "await complete.click();",
      "await nextPaint(page);",
      'const alert = canvas.getByRole("alert");',
      "await expect(alert).toHaveText(PUBLIC_FAILURE_MESSAGE);",
      'await expect(alert).toHaveAttribute("data-tone", "critical");',
      'await expect(submit).not.toHaveAttribute("aria-busy");',
      "await expect(page).toHaveURL(/\\/projects\\/account-app\\/surfaces\\/sign-in$/u);",
      "expect(failureFrameBox).toEqual(initialFrameBox);",
      "initialHorizontalGeometry",
      "await submit.click();",
      "await expect(alert).toHaveCount(0);",
      "await complete.click();",
      "await nextPaint(page);",
      'await expect(canvas.getByRole("alert")).toHaveText(PUBLIC_FAILURE_MESSAGE);',
      "expect(await frame.boundingBox()).toEqual(initialFrameBox);",
      "expect(runtimeFailures).toEqual([]);",
    ],
    BROWSER_PATHS.spec,
    "TEST_POLICY_VIOLATION",
  );
  forbidFragments(
    spec,
    [
      "page.request",
      "submit.evaluate",
      "document.body.innerHTML",
      "dispatchEvent(",
      'selectOption("success")',
      "error:unavailable",
    ],
    BROWSER_PATHS.spec,
    "TEST_POLICY_VIOLATION",
  );
  if (occurrenceCount(spec, 'test("' + BROWSER_TEST_NAME + '"') !== 1) {
    fail("TEST_POLICY_VIOLATION", "The M10-T03 browser test identity is not unique.");
  }
  if (occurrenceCount(spec, "await nextPaint(page);") !== 2) {
    fail(
      "TEST_POLICY_VIOLATION",
      "Both public failures require the bounded double-animation-frame barrier.",
    );
  }
  if (occurrenceCount(spec, "await complete.click();") !== 2) {
    fail("TEST_POLICY_VIOLATION", "The failure retry matrix must settle exactly twice.");
  }
  requireFragments(
    config,
    [
      'testMatch: "failure-fixture.pw.ts"',
      'name: "failure-chromium"',
      "fullyParallel: false",
      "workers: 1",
      "reuseExistingServer: false",
      'command: "exec node apps/desen-app-browser-e2e/product-proof-server.mjs"',
    ],
    BROWSER_PATHS.config,
    "TEST_POLICY_VIOLATION",
  );
  return deepFreeze({
    testName: BROWSER_TEST_NAME,
    chromiumConfigurations: 1,
    visibleBlankProjectStart: true,
    authoredCriticalAlertCovered: true,
    authoredFailedPredicateCovered: true,
    idleAlertAbsent: true,
    pendingAlertAbsent: true,
    firstFailureAlertVisible: true,
    secondFailureAlertVisible: true,
    retryCleanupCovered: true,
    catalogOutcomeInventoryExact: true,
    undeclaredUnavailableFixtureAbsent: true,
    integrationAndProductionDisabled: true,
    realRuntimePendingBeforeFailure: true,
    loadingCleanupCovered: true,
    controlledInputPersistenceCovered: true,
    routeContinuityCovered: true,
    frameGeometryStable: true,
    horizontalGeometryStable: true,
    postSettlementDoubleAnimationFrameObserved: true,
    visibleFailureStateAsserted: true,
    successNavigationAsserted: false,
    realHostOperationAsserted: false,
    directNetworkOrDomMutationUsed: false,
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
      "playwright test --config failure-playwright.config.ts",
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
    fail("SOURCE_POLICY_VIOLATION", "The package and Catalog-owned M10-T03 contract drifted.");
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
      `const EXPECTED_BASE_COMMIT = "${DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.baseCommit}";`,
      'profile: "desen.app.m10-t02-historical-reader-bridge.v1"',
      "successorAddedPaths: [",
      `"${BROWSER_PATHS.spec}"`,
      `"${BROWSER_PATHS.config}"`,
      '"desen-app-input-pending-fixture": taskTimeArtifact',
      "gzipSync(bytes, { level: 9, mtime: 0 })",
      '{ flag: "wx" }',
    ],
    BRIDGE_REPRODUCTION_PATHS[0],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  requireFragments(
    fixture,
    [
      "authenticateDesenAppFailureFixtureSuccessor",
      "readDesenAppT02HistoricalReaderTaskTimeFile",
      "createDesenAppT02HistoricalReaderReadFile",
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

// The task artifact remains historical evidence. Only the separately displayed current
// projection may contain amended transport receipts; no new byte is assigned an old digest.
async function preserveHistoricalEvidence(currentArtifact, files, workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
    ARTIFACT_RELATIVE_PATH,
  );
  assertPinnedArtifact(artifactBytes);
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  const transport = getHistoricalArchiveRedactionPin(T02_HISTORICAL_READER_BRIDGE_PATH);
  const historicalBridge = artifact.authority.historicalReaderBridge;
  const expectedCurrentBridge = {
    ...historicalBridge,
    bytes: transport.current.bytes,
    sha256: transport.current.sha256,
    ...(Object.hasOwn(historicalBridge, "uncompressedBytes")
      ? { uncompressedBytes: transport.current.uncompressedBytes }
      : {}),
  };
  if (
    historicalBridge.path !== transport.historical.path ||
    historicalBridge.bytes !== transport.historical.bytes ||
    historicalBridge.sha256 !== transport.historical.sha256 ||
    !isDeepStrictEqual(currentArtifact.authority.historicalReaderBridge, expectedCurrentBridge)
  ) {
    fail("ARTIFACT_DRIFT", "Only the exact approved historical archive transport may change.");
  }

  const comparison = structuredClone(currentArtifact);
  comparison.authority.historicalReaderBridge = historicalBridge;
  const historicalReceipts = artifact.boundary.trackedReceipts;
  const currentReceipts = comparison.boundary.trackedReceipts;
  if (currentReceipts.length !== historicalReceipts.length) {
    fail("ARTIFACT_DRIFT", "The historical receipt inventory changed.");
  }
  const receiptAmendments = [];
  for (let index = 0; index < historicalReceipts.length; index += 1) {
    const historical = historicalReceipts[index];
    const current = currentReceipts[index];
    if (isDeepStrictEqual(current, historical)) continue;
    const bytes = files.get(historical.path);
    if (
      !exactJsonKeys(current, ["path", "bytes", "sha256"]) ||
      (historical.path !== T02_HISTORICAL_READER_BRIDGE_PATH &&
        historical.path !== BRIDGE_REPRODUCTION_PATHS[0]) ||
      current.path !== historical.path ||
      bytes === undefined ||
      current.bytes !== bytes.byteLength ||
      current.sha256 !== sha256(bytes) ||
      !matchesAmendedHistoricalReceipt(historical, bytes)
    ) {
      fail("ARTIFACT_DRIFT", "An unapproved historical receipt changed.", {
        relativePath: historical.path,
      });
    }
    receiptAmendments.push({
      pointer: `/boundary/trackedReceipts/${index}`,
      historical,
      current,
    });
    currentReceipts[index] = historical;
  }
  if (!isDeepStrictEqual(comparison, artifact)) {
    fail("ARTIFACT_DRIFT", "The archive amendment cannot change historical technical evidence.");
  }

  const currentArtifactBytes = await canonicalArtifactBytes(currentArtifact);
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    currentVerification: {
      profile: "desen.app.historical-archive-redaction-verification.v1",
      amendment: "AR-01",
      historicalArtifact: {
        path: ARTIFACT_RELATIVE_PATH,
        bytes: artifactBytes.byteLength,
        sha256: sha256(artifactBytes),
      },
      artifact: currentArtifact,
      artifactBytes: currentArtifactBytes,
      artifactSha256: sha256(currentArtifactBytes),
      archiveTransport: transport,
      receiptAmendments,
      historicalTechnicalProjectionPreserved: true,
      technicalFilesFreshlyVerified: true,
    },
  });
}
/**
 * Freshly verifies the retained M10-T03 technical projection and its amended archive transport.
 *
 * @remarks The original artifact fields retain their historical identity. Current bytes and
 * receipts are exposed separately in currentVerification; sanitized bytes never acquire old hashes.
 */
export async function buildDesenAppFailureFixtureEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const successHostSuccessor = await authenticateSuccessHostOperationSuccessor(
    options.workspaceRoot,
  );
  const files = await acquireFiles(
    Object.freeze({
      ...options,
      fileOverrides: successHostSuccessor.materialize(
        successHostSuccessor.successor,
        options.fileOverrides,
      ),
    }),
  );
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const bridge = authenticateHistoricalReaderBridge(
    files.get(T02_HISTORICAL_READER_BRIDGE_PATH),
    parent.artifact,
  );
  const source = verifyDesenAppFailureFixtureSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const focusedTests = verifyFocusedTestAuthority(files);
  const browser = verifyBrowserAuthority(files);
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
    proofId: "desen-app-failure-fixture",
    profile: "desen.app.failure-fixture-proof.v1",
    task: "M10-T03",
    gate: null,
    result: "PASS",
    prerequisites: [parent.summary],
    claim: {
      taskStatus: "DONE",
      p09Status: "PARTIAL",
      p10Status: "PARTIAL",
      authoredCriticalAlertCovered: true,
      authoredFailedPredicateCovered: true,
      catalogDeclaredPublicFailureCovered: true,
      undeclaredUnavailableFixtureRejected: true,
      realRuntimeFailureCovered: true,
      idleAndPendingAlertAbsenceCovered: true,
      firstAndRetryFailureVisibilityCovered: true,
      retryCleanupCovered: true,
      controlledInputPersistenceCovered: true,
      loadingCleanupCovered: true,
      routeContinuityCovered: true,
      frameGeometryStabilityCovered: true,
      genericReferenceErrorAssumptionRejected: true,
      technicalFailureRedactionCovered: true,
      m10T03Closed: true,
      m10T04Closed: false,
      visibleFailureStateCovered: true,
      successNavigationCovered: false,
      realHostOperationCovered: false,
      productionOperationCovered: false,
      n036Closed: false,
      g10Closed: false,
    },
    authority: {
      source,
      focusedTests,
      browser,
      package: packageAuthority,
      historicalReaderBridge: bridge.summary,
      bridgeReproduction,
    },
    tests: {
      focusedCommands: FOCUSED_TEST_COMMANDS,
      browserCommand: BROWSER_COMMAND,
      verifierCommand: "node scripts/verify-desen-app-failure-fixture.mjs",
      proofReaderCommand: "node --test tests/desen-app-failure-fixture.test.mjs",
      rootTestNames: DESEN_APP_FAILURE_FIXTURE_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
      deterministicReaderStartsListener: false,
    },
    boundary: {
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
      parentArtifacts: 1,
      historicalReaderBridgeArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-failure-fixture-proof.mjs",
        "tests/desen-app-failure-fixture.test.mjs",
      ],
      artifactTrackedEntrypoints: PROOF_ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "M10-T03 proves one dedicated authored visible public failure and retry matrix over the exact M10-T02 input/pending predecessor.",
      "The only admitted synthetic public failure is the exact Catalog-declared invalidCredentials fixture; unavailable remains declared but has no fixture.",
      "Success, navigation, and a separately authorized real host operation remain M10-T04.",
      "Integration and Production remain unavailable in this authoring fixture; production execution and N-036 are NOT_PROVEN.",
      "P-09 and P-10 remain PARTIAL, G10 remains open, and local evidence does not imply hosted exact-head success.",
      "The deterministic reader starts no Chromium, Vite, network listener, or external host.",
    ],
  });
  return preserveHistoricalEvidence(artifact, files, options.workspaceRoot);
}

function verifyProofDocument(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App failure fixture",
    "",
    "Task: M10-T03",
    "",
    "Status: DONE",
    "",
    "P-09: PARTIAL",
    "",
    "P-10: PARTIAL",
    "",
    `Predecessor artifact: \`sha256:${DESEN_APP_FAILURE_FIXTURE_PARENT_PIN.sha256}\``,
    "",
    `Historical bridge: \`sha256:${DESEN_APP_T02_HISTORICAL_READER_BRIDGE_PIN.sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(expectedHeader) ||
    occurrenceCount(source, "Task: M10-T03") !== 1 ||
    occurrenceCount(source, "Status: DONE") !== 1 ||
    occurrenceCount(source, "P-09: PARTIAL") !== 1 ||
    occurrenceCount(source, "P-10: PARTIAL") !== 1 ||
    occurrenceCount(source, "Final artifact:") !== 1 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T03 proof report lost its exact authority header.");
  }
}

function assertPinnedArtifact(bytes) {
  const pin = DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PIN;
  if (
    pin.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(pin.sha256) ||
    bytes.byteLength !== pin.bytes ||
    sha256(bytes) !== pin.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T03 artifact bytes drifted.");
  }
}

/** Verifies frozen M10-T03 technical evidence and separately reports current AR-01 receipts. */
export async function verifyDesenAppFailureFixtureEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppFailureFixtureEvidence(options.buildOptions);
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH)
      : captureBytes(options.artifactBytes, "artifactBytes");
  assertPinnedArtifact(artifactBytes);
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M10-T03 artifact does not match current authorities.");
  }
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.task !== "M10-T03" ||
    artifact?.proofId !== "desen-app-failure-fixture" ||
    artifact?.profile !== "desen.app.failure-fixture-proof.v1" ||
    artifact?.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The committed M10-T03 artifact identity drifted.");
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
  const focused = artifact.authority.focusedTests;
  return deepFreeze({
    task: artifact.task,
    result: artifact.result,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    currentVerification: {
      profile: built.currentVerification.profile,
      amendment: built.currentVerification.amendment,
      artifactBytes: built.currentVerification.artifactBytes.byteLength,
      artifactSha256: built.currentVerification.artifactSha256,
      archiveTransport: built.currentVerification.archiveTransport,
      trackedReceipts: built.currentVerification.artifact.boundary.trackedReceipts,
      receiptAmendments: built.currentVerification.receiptAmendments,
      historicalTechnicalProjectionPreserved: true,
      technicalFilesFreshlyVerified: true,
    },
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    focusedCases:
      focused.evergreenProductCompositionCases +
      focused.authoringBehaviorProjectionCases +
      focused.authoringConditionCases +
      focused.authoringConnectionCases +
      focused.behaviorControlCases +
      focused.authoringFixtureCases +
      focused.interactiveComponentCases +
      focused.headlessSessionCases +
      focused.operationLifecycleCases,
    chromiumScenarios: artifact.authority.browser.chromiumConfigurations,
    p09Status: artifact.claim.p09Status,
    p10Status: artifact.claim.p10Status,
    m10T03Closed: artifact.claim.m10T03Closed,
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
      "T02 historical compatibility requires the exact authenticated M10-T03 successor.",
    );
  }
  return SUCCESSOR_AUTHORITIES.get(successor);
}

/**
 * Authenticates the exact official M10-T03 successor for the historical M10-T02 reader.
 *
 * @remarks This function directly authenticates the frozen T02 artifact and bridge. It never
 * imports or invokes the T02 proof module, avoiding a cyclic reader authority.
 */
export async function authenticateDesenAppFailureFixtureSuccessor(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions, ["workspaceRoot"], "successor options");
  const workspaceRoot = path.resolve(options.workspaceRoot ?? WORKSPACE_ROOT);
  const verified = await verifyDesenAppFailureFixtureEvidence({
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
      path.join(workspaceRoot, T02_HISTORICAL_READER_BRIDGE_PATH),
      T02_HISTORICAL_READER_BRIDGE_PATH,
    ),
    parent.artifact,
  );
  const successor = deepFreeze({
    task: "M10-T03",
    proofId: "desen-app-failure-fixture",
    profile: "desen.app.failure-fixture-proof.v1",
    result: verified.result,
    artifact: {
      path: ARTIFACT_RELATIVE_PATH,
      ...DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PIN,
      immutable: true,
    },
    predecessor: { ...DESEN_APP_FAILURE_FIXTURE_PARENT_PIN },
    trackedFiles: verified.trackedFiles,
    currentVerification: verified.currentVerification,
    p09Status: verified.p09Status,
    p10Status: verified.p10Status,
    m10T03Closed: verified.m10T03Closed,
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

/** Materializes retained T02 technical bytes and amended archives before caller mutations. */
export function materializeDesenAppT02HistoricalReaderFileOverrides(successor, fileOverrides) {
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

/** Returns a defensive copy of retained M10-T02 technical or amended archive bytes. */
export function readDesenAppT02HistoricalReaderTaskTimeFile(successor, relativePath) {
  if (!safeRelativePath(relativePath)) {
    fail("OPTIONS_INVALID", "relativePath must be one safe relative path.");
  }
  const bytes = successorAuthority(successor).files.get(relativePath);
  if (bytes === undefined) {
    fail("OPTIONS_INVALID", "relativePath has no T02 task-time bridge entry.", { relativePath });
  }
  return Buffer.from(bytes);
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Atomically writes newly built M10-T03 evidence or refuses unsafe tracked replacement. */
export async function writeDesenAppFailureFixtureEvidence(rawOptions = undefined) {
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
      ? DEFAULT_DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PATH
      : path.resolve(options.artifactPath);
  const built = await buildDesenAppFailureFixtureEvidence(options.buildOptions);
  let destination;
  try {
    destination = await canonicalDestinationPath(artifactPath);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T03 artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  if (
    destination ===
    (await canonicalDestinationPath(DEFAULT_DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PATH))
  ) {
    try {
      const existing = await readRegularAuthority(destination, ARTIFACT_RELATIVE_PATH);
      if (
        DESEN_APP_FAILURE_FIXTURE_ARTIFACT_PIN.bytes > 0 &&
        !existing.equals(built.artifactBytes)
      ) {
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked M10-T03 artifact.");
      }
    } catch (error) {
      if (error instanceof DesenAppFailureFixtureProofError && error.code !== "AUTHORITY_UNSAFE") {
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
    if (error instanceof DesenAppFailureFixtureProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "M10-T03 artifact write failed safely.", {
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
