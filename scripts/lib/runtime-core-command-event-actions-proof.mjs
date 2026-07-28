import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_NAME = "runtime-core-0.1.0-command-event-actions.json";
const ARTIFACT_SHA256 = "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4";
const HISTORICAL_ARTIFACT_BYTES = 23_466;
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const PROOF_DOCUMENT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md",
);
const MAX_PROOF_DOCUMENT_BYTES = 500_000;
const MAX_PROOF_MATRIX_BYTES = 2_000_000;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "createRuntimeCommandEventHostPorts",
  "RUNTIME_COMMAND_EVENT_ACTION_LIMITS",
  "disposeRuntimeCommandEventActions",
  "executeRuntimeCommandEventAction",
  "mountRuntimeCommandEventActions",
  "readRuntimeCommandEventActions",
  "registerRuntimeComponentCommandTarget",
  "unregisterRuntimeComponentCommandTarget",
]);

const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeCommandEventHostPorts",
  "RuntimeCommandEventHostPortsInput",
  "RuntimeComponentCommandHostPort",
  "RuntimeComponentCommandHostRequest",
  "RuntimeComponentCommandHostResult",
  "RuntimeHostEventEmissionResult",
  "RuntimeHostEventPort",
  "RuntimeHostEventRequest",
  "RuntimeHostEventValidationResult",
  "RuntimeCommandEventAction",
  "RuntimeCommandEventActionLimitProfile",
  "RuntimeCommandEventActionResult",
  "RuntimeCommandEventActionsDisposeResult",
  "RuntimeCommandEventActionsHandle",
  "RuntimeCommandEventActionsMountInput",
  "RuntimeCommandEventActionsMountResult",
  "RuntimeCommandEventActionsReadResult",
  "RuntimeCommandEventActionsSnapshot",
  "RuntimeComponentCommandAction",
  "RuntimeComponentCommandRegistrationTicket",
  "RuntimeComponentCommandTargetRegistrationInput",
  "RuntimeComponentCommandTargetRegistrationResult",
  "RuntimeComponentCommandTargetUnregistrationInput",
  "RuntimeComponentCommandTargetUnregistrationResult",
  "RuntimeHostEventEmitAction",
  "RuntimeRegisteredComponentCommandTargetSnapshot",
]);

const EXPECTED_INTERNAL_RUNTIME_EXPORTS = Object.freeze([
  "consumeRuntimeComponentCommandHostRequestForAdapterBridge",
  "emitRuntimeHostEventHostPort",
  "invokeRuntimeComponentCommandHostPort",
  "isRuntimeCommandEventHostPorts",
  "isRuntimeCommandEventHostPortsForComponentCommandPort",
  "validateRuntimeHostEventHostPort",
  "readRuntimeCommandEventActionsForAdapterBridge",
]);

const EXPECTED_INTERNAL_TYPE_EXPORTS = Object.freeze([
  "RuntimeComponentCommandPortCallResult",
  "RuntimeHostEventEmissionCallResult",
  "RuntimeHostEventValidationCallResult",
]);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T10",
    result: "PASS",
    artifact: "runtime-core-0.1.0-state-navigation-actions.json",
    artifactSha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
  }),
  Object.freeze({
    task: "M02-T09",
    result: "PASS",
    artifact: "protocol-0.1.0-interaction-contracts.json",
    artifactSha256: "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208",
  }),
  Object.freeze({
    task: "M02-T11",
    result: "PASS",
    artifact: "protocol-0.1.0-execution-contracts.json",
    artifactSha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  }),
]);

const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    id: "R-080",
    section: "20.6",
    owners: Object.freeze(["M02-T09", "M02-T11", "M04-T12"]),
  }),
  Object.freeze({
    id: "R-106",
    section: "24.6",
    owners: Object.freeze(["M04-T01", "M04-T09", "M04-T12"]),
  }),
  Object.freeze({
    id: "R-120",
    section: "27.5",
    owners: Object.freeze(["M02-T08", "M02-T09", "M02-T11", "M04-T12"]),
  }),
  Object.freeze({
    id: "R-122",
    section: "27.7",
    owners: Object.freeze(["M04-T01", "M04-T08", "M04-T09", "M04-T10", "M04-T12"]),
  }),
  Object.freeze({
    id: "D-015",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T09", "M04-T12"]),
  }),
  Object.freeze({
    id: "D-016",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T11", "M04-T12"]),
  }),
]);

const HISTORICAL_TRACKED_FILES = Object.freeze([
  Object.freeze({
    path: "packages/runtime-core/src/command-event-ports.ts",
    bytes: 15_821,
    sha256: "21f3d562a927f5b1bf131be999a00c9b85fbbede28acad81607261ee812f6b5c",
  }),
  Object.freeze({
    path: "packages/runtime-core/src/command-event-actions.ts",
    bytes: 66_762,
    sha256: "8e63472e7bac5e3fd17752c8470c46593f893b75c8d7bde752841bdcd5e71deb",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/command-event-actions.test.ts",
    bytes: 59_122,
    sha256: "947790bad2d8d7fa2cca0a06899cbf75da5ce8e9d71e883f97327b45e2396702",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/command-event-actions.types.ts",
    bytes: 11_515,
    sha256: "a5ad3a9fc353edaffbc7102f99bfde3a27672c9b14dc006a73989092cb9ede09",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-ports.js",
    bytes: 11_766,
    sha256: "57992f04e6bf12002c6211d581cf4251818d22c76423dca33f55cdca2616ffc8",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-ports.js.map",
    bytes: 10_348,
    sha256: "c595fd4cff55f74a20503ae1a0b841a4934def87b545aa82175505294293ecfc",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-ports.d.ts",
    bytes: 5_361,
    sha256: "28640b704a782d45bcadad368f9e77f017e1a898c6023ed1137290a4ab50edf3",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-ports.d.ts.map",
    bytes: 2_888,
    sha256: "dd942151f8d38f6927a22a2bfe928f4ef2eab73f871ac1a5c1a1142d1b5a6107",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-actions.js",
    bytes: 53_877,
    sha256: "336d211a0d56ffa2bd9686a94703eb770e17604ae1226089c5e2705a7c9e6f0f",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-actions.js.map",
    bytes: 43_747,
    sha256: "b4cb5599bc92ba189ac2396079e0102a741c545b4016f6934a30322d6c6f90ed",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-actions.d.ts",
    bytes: 13_665,
    sha256: "0072d32f1675ef4b6bce73b8697b38ca4ba07bfd460028c8f0a03209865a9450",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/command-event-actions.d.ts.map",
    bytes: 9_260,
    sha256: "3fe157f361fa4b2ea18b1607f635bc1890b66711dc849b3b59d43ed7c9948a49",
  }),
  Object.freeze({
    path: "scripts/lib/runtime-core-command-event-actions-proof.mjs",
    bytes: 119_025,
    sha256: "bd86f68715eb1eb61372179ffda4a12ce51c69c981ffce44b4fb8d4fd4286ae1",
  }),
  Object.freeze({
    path: "scripts/generate-runtime-core-command-event-actions-proof.mjs",
    bytes: 855,
    sha256: "701f05795f6e9510cf3c15c2e7a752ed4bdf763a7ef33ce82c2bc5712b2301c6",
  }),
  Object.freeze({
    path: "scripts/verify-runtime-core-command-event-actions.mjs",
    bytes: 693,
    sha256: "0823e3c7c1e30d7d18122892ec590b456afd2d39a50ff24b63f2d04cfe5943f7",
  }),
  Object.freeze({
    path: "tests/runtime-core-command-event-actions.test.mjs",
    bytes: 19_918,
    sha256: "3ec7171601b0bc4fdb3f10e58fee47fe378f25dfba40964feb2e076be10f9550",
  }),
]);

const PROOF_MATRIX_CONTEXT = [
  "N-031 advances to `TESTED`; N-034 remains `PLANNED` until concrete",
  "production adapters prove complete declared-command implementation parity. M04-T13 now proves",
  "ordered multi-action turns; incoming adapter events, full cross-manager provenance, Bundle ingress,",
  "activation, and final finite-limit evidence remain later work. P-17 stays `PARTIAL`:",
  `\`${ARTIFACT_NAME}\``,
  `\`sha256:${ARTIFACT_SHA256}\`.`,
  "",
  "M04-T13 defines and proves bounded, deterministic action-turn composition",
].join("\n");

const PROOF_DOCUMENT_CONTEXT = [
  "This is an immutable task-time receipt. Its exact artifact is",
  `\`docs/proof/artifacts/${ARTIFACT_NAME}\``,
  `(\`sha256:${ARTIFACT_SHA256}\`).`,
  "The receipt preserves M04-T12's historical `N-034: PLANNED` status; M05-T04 owns the later",
  "selected Web–React `N-034: TESTED` evidence without rewriting this artifact.",
].join("\n");

/** Absolute path to the immutable M04-T12 command/event action evidence. */
export const DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts",
  ARTIFACT_NAME,
);

/** Stable failure emitted by the immutable M04-T12 compatibility reader. */
export class RuntimeCoreCommandEventActionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreCommandEventActionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreCommandEventActionsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sorted(values) {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function exactJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function normalizeOptions(options, allowedNames, operation) {
  if (options === undefined) return Object.freeze({});
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    utilTypes.isProxy(options)
  ) {
    fail(
      "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
      `${operation} options must be a non-Proxy plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch {
    fail(
      "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
      `${operation} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedNames.includes(key))
  ) {
    fail(
      "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
      `${operation} options contain unknown, inherited, or symbolic fields.`,
    );
  }
  const captured = Object.create(null);
  for (const name of sorted(keys)) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(options, name);
    } catch {
      fail(
        "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
        `${operation} option ${JSON.stringify(name)} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(
        "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
        `${operation} option ${JSON.stringify(name)} must be an enumerable own data property.`,
      );
    }
    captured[name] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBoundedText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} exceeds its bounded UTF-8 byte limit.`);
  }
  return text;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} must be non-shared non-Proxy bytes.`);
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "COMMAND_EVENT_ACTION_OPTIONS_INVALID",
        `${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeCoreCommandEventActionsEvidenceError) throw error;
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} must not use shared backing memory.`);
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} backing memory is detached or invalid.`);
  }
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("COMMAND_EVENT_ACTION_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(filePath, label, maximumBytes) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_MISSING", `${label} is missing or inaccessible.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE", `${label} must be a regular non-symlink file.`);
  }
  if (entry.size > maximumBytes) {
    fail("COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE", `${label} exceeds its bounded byte limit.`);
  }

  let handle;
  try {
    handle = await open(filePath, "r");
    const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(filePath)]);
    if (
      !openedEntry.isFile() ||
      !currentEntry.isFile() ||
      currentEntry.isSymbolicLink() ||
      openedEntry.dev !== currentEntry.dev ||
      openedEntry.ino !== currentEntry.ino
    ) {
      fail(
        "COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE",
        `${label} changed identity while it was being opened.`,
      );
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes) {
      fail("COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE", `${label} exceeds its bounded byte limit.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeCoreCommandEventActionsEvidenceError) throw error;
    fail("COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

function assertHistoricalTrackedFiles(files) {
  if (!Array.isArray(files) || files.length !== HISTORICAL_TRACKED_FILES.length) {
    fail(
      "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T12 tracked-file ledger changed.",
    );
  }
  for (let index = 0; index < HISTORICAL_TRACKED_FILES.length; index += 1) {
    if (!exactJson(files[index], HISTORICAL_TRACKED_FILES[index])) {
      fail(
        "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT",
        "The immutable M04-T12 tracked-file ledger changed.",
        { index, expected: HISTORICAL_TRACKED_FILES[index], actual: files[index] },
      );
    }
  }
}

function assertHistoricalSemantics(artifact) {
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T12" ||
    artifact.result !== "PASS" ||
    artifact.claim?.protocol !== "0.1.0" ||
    artifact.claim?.target !== "platform-neutral" ||
    !exactJson(artifact.claim?.protocolStatusChanges, []) ||
    !exactJson(artifact.claim?.proofMatrixStatusChanges, []) ||
    !exactJson(artifact.claim?.normativeStatusChanges, [
      { id: "N-031", from: "PLANNED", to: "TESTED" },
    ]) ||
    !exactJson(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    !exactJson(artifact.publicApi?.runtimeExports, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(artifact.publicApi?.typeExports, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(artifact.publicApi?.internalRuntimeExports, EXPECTED_INTERNAL_RUNTIME_EXPORTS) ||
    !exactJson(artifact.publicApi?.internalTypeExports, EXPECTED_INTERNAL_TYPE_EXPORTS) ||
    artifact.publicApi?.tsdocDeclarations !== 44 ||
    artifact.ports?.probes !== 39 ||
    artifact.ports?.standaloneJsonAggregateNodes?.accepted !== 4_096 ||
    artifact.ports?.standaloneJsonAggregateNodes?.rejected !== 4_097 ||
    artifact.ports?.rawAdapterFailuresExposed !== false ||
    artifact.runtime?.adapterBridgeReadProbes !== 8 ||
    artifact.runtime?.hostilePayloadReads !== 0 ||
    artifact.runtime?.falseGuardEffects !== 0 ||
    artifact.runtime?.falseGuardDiagnosticCalls !== 0 ||
    artifact.runtime?.rawHostFailuresExposed !== false ||
    artifact.runtime?.platformEffects !== 0 ||
    artifact.semantics?.productionAdapterCommandParity !== null ||
    artifact.semantics?.incomingAdapterEvents !== null ||
    artifact.documentation?.finding !== "PF-042" ||
    artifact.documentation?.findingStatus !== "OPEN" ||
    artifact.documentation?.proofDocument !== "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md" ||
    !exactJson(artifact.normative, { tested: ["N-031"], planned: ["N-034"] }) ||
    artifact.evidence?.focusedTests !== 58 ||
    artifact.evidence?.compilerNegativeCases !== 27 ||
    artifact.evidence?.rootMutationTests !== 21 ||
    !exactJson(artifact.evidence?.traceRules, EXPECTED_TRACE_RULES) ||
    artifact.portability?.framework !== null ||
    !exactJson(artifact.portability?.platformGlobals, []) ||
    artifact.portability?.dynamicEvaluation !== false ||
    !Array.isArray(artifact.deferred) ||
    artifact.deferred[0] !==
      "production-adapter implementation of every declared command and N-034 closure (M05)"
  ) {
    fail(
      "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T12 artifact lost its exact task-time semantics.",
    );
  }
  assertHistoricalTrackedFiles(artifact.evidence?.trackedFiles);
}

function parseHistoricalArtifact(bytes) {
  const expectedSha256 = `sha256:${ARTIFACT_SHA256}`;
  const actualSha256 = sha256(bytes);
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || actualSha256 !== expectedSha256) {
    fail(
      "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T12 artifact bytes changed.",
      {
        expectedBytes: HISTORICAL_ARTIFACT_BYTES,
        actualBytes: bytes.length,
        expectedSha256,
        actualSha256,
      },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T12 artifact is not valid JSON.",
    );
  }
  assertHistoricalSemantics(artifact);
  return deepFreeze(artifact);
}

function verifyHistoricalProofPins(proofMatrixText, proofDocumentText) {
  const exactMatrixReference = `\`${ARTIFACT_NAME}\`\n\`sha256:${ARTIFACT_SHA256}\`.`;
  const exactDocumentReference =
    `\`docs/proof/artifacts/${ARTIFACT_NAME}\`\n` + `(\`sha256:${ARTIFACT_SHA256}\`).`;
  if (
    proofMatrixText.split(exactMatrixReference).length !== 2 ||
    proofMatrixText.split(`\`${ARTIFACT_NAME}\``).length !== 2 ||
    proofMatrixText.split(PROOF_MATRIX_CONTEXT).length !== 2 ||
    proofDocumentText.split(exactDocumentReference).length !== 2 ||
    proofDocumentText.split(`sha256:${ARTIFACT_SHA256}`).length !== 2 ||
    proofDocumentText.split(PROOF_DOCUMENT_CONTEXT).length !== 2
  ) {
    fail(
      "COMMAND_EVENT_ACTION_PROOF_PIN_DRIFT",
      "The M04-T12 proof documents must retain one exact contextual immutable artifact pin.",
    );
  }
}

async function readHistoricalArtifact(options) {
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH;
  const artifactBytes =
    optionalBytes(options.artifactBytes, "artifactBytes") ??
    (await readRegularBytes(
      path.resolve(artifactPath),
      "Immutable M04-T12 artifact",
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = parseHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: `sha256:${ARTIFACT_SHA256}`,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/**
 * Reads exact M04-T12 task-time evidence without consulting current source, docs, or build output.
 */
export async function buildRuntimeCoreCommandEventActionsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions, ["artifactPath", "artifactBytes"], "Build");
  return readHistoricalArtifact(options);
}

/** Verifies immutable M04-T12 bytes, task-time semantics, and unique historical proof pins. */
export async function verifyRuntimeCoreCommandEventActionsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(
    rawOptions,
    ["artifactPath", "artifactBytes", "proofMatrixText", "proofDocumentText"],
    "Verify",
  );
  const proofMatrixText = optionalBoundedText(
    options.proofMatrixText,
    "proofMatrixText",
    MAX_PROOF_MATRIX_BYTES,
  );
  const proofDocumentText = optionalBoundedText(
    options.proofDocumentText,
    "proofDocumentText",
    MAX_PROOF_DOCUMENT_BYTES,
  );
  const built = await readHistoricalArtifact(options);
  verifyHistoricalProofPins(
    proofMatrixText ??
      (await readRegularBytes(PROOF_MATRIX_PATH, "Proof Matrix", MAX_PROOF_MATRIX_BYTES)).toString(
        "utf8",
      ),
    proofDocumentText ??
      (
        await readRegularBytes(
          PROOF_DOCUMENT_PATH,
          "M04-T12 proof document",
          MAX_PROOF_DOCUMENT_BYTES,
        )
      ).toString("utf8"),
  );
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    compatibilityMode: built.compatibilityMode,
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    internalRuntimeExports: built.artifact.publicApi.internalRuntimeExports.length,
    internalTypeExports: built.artifact.publicApi.internalTypeExports.length,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    focusedTests: built.artifact.evidence.focusedTests,
    compilerNegativeCases: built.artifact.evidence.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.rootMutationTests,
    traceRules: built.artifact.evidence.traceRules.length,
    normativeTested: built.artifact.normative.tested.length,
    normativePlannedAtTaskTime: built.artifact.normative.planned.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    portProbes: built.artifact.ports.probes,
    ...built.artifact.runtime,
  });
}

/**
 * Preserves the tracked M04-T12 artifact or copies its exact bytes to an alternate safe target.
 */
export async function writeRuntimeCoreCommandEventActionsEvidence(rawOptions = undefined) {
  const options = normalizeOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : normalizeOptions(options.buildOptions, ["artifactPath", "artifactBytes"], "buildOptions");

  let canonicalArtifactPath;
  let canonicalTrackedPath;
  try {
    [canonicalArtifactPath, canonicalTrackedPath] = await Promise.all([
      canonicalDestinationPath(artifactPath),
      canonicalDestinationPath(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail(
      "COMMAND_EVENT_ACTION_ARTIFACT_WRITE_FAILED",
      "The immutable M04-T12 artifact destination could not be resolved safely.",
      { cause: String(error) },
    );
  }

  if (canonicalArtifactPath === canonicalTrackedPath) {
    if (beforeAtomicRename !== undefined || buildOptions !== undefined) {
      fail(
        "COMMAND_EVENT_ACTION_NONDEFAULT_TRACKED_WRITE",
        "The immutable tracked M04-T12 artifact cannot be rebuilt or hooked.",
      );
    }
    const built = await readHistoricalArtifact(Object.freeze({}));
    return Object.freeze({ ...built, artifactPath: canonicalTrackedPath, preserved: true });
  }

  const built = await readHistoricalArtifact(buildOptions ?? Object.freeze({}));
  try {
    await writeAtomicProofArtifact({
      artifactPath: canonicalArtifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "COMMAND_EVENT_ACTION_ARTIFACT_WRITE_FAILED",
      "The immutable M04-T12 artifact could not be copied safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    ...built,
    artifactPath: canonicalArtifactPath,
    preserved: false,
  });
}
