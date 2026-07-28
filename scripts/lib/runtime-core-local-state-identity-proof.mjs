import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_NAME = "runtime-core-0.1.0-local-state-identity.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13";
const HISTORICAL_ARTIFACT_BYTES = 15_575;
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const MAX_PROOF_DOCUMENT_BYTES = 500_000;
const MAX_PROOF_MATRIX_BYTES = 2_000_000;
const PROOF_DOCUMENT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/RUNTIME-CORE-LOCAL-STATE-IDENTITY.md",
);
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");

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
  "createRuntimeNodeIdentity",
  "disposeRuntimeSurfaceState",
  "mountRuntimeSurfaceState",
  "readRuntimeSurfaceState",
  "reconcileRuntimeNodeIdentity",
  "writeRuntimeSurfaceState",
]);

const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "RuntimeNodeIdentity",
  "RuntimeNodeIdentityCreationResult",
  "RuntimeNodeIdentityDescriptor",
  "RuntimeNodeIdentityInvalid",
  "RuntimeNodeIdentityInvalidReason",
  "RuntimeNodeIdentityReconciliation",
  "RuntimeSurfaceStateDisposeResult",
  "RuntimeSurfaceStateEntrySpec",
  "RuntimeSurfaceStateHandle",
  "RuntimeSurfaceStateIssue",
  "RuntimeSurfaceStateMountInput",
  "RuntimeSurfaceStateMountInvalid",
  "RuntimeSurfaceStateMountInvalidReason",
  "RuntimeSurfaceStateMountResult",
  "RuntimeSurfaceStateReadResult",
  "RuntimeSurfaceStateSnapshot",
  "RuntimeSurfaceStateWriteInput",
  "RuntimeSurfaceStateWriteRejected",
  "RuntimeSurfaceStateWriteRejectedReason",
  "RuntimeSurfaceStateWriteResult",
]);

const EXPECTED_INTERNAL_EXPORTS = Object.freeze([
  "isRuntimeJsonObject",
  "snapshotRuntimeJsonValue",
]);

const EXPECTED_TRACE_RULES = Object.freeze([
  Object.freeze({
    collection: "pipelineSteps",
    id: "PIPE-018",
    section: "24.2",
    owners: Object.freeze(["M04-T06"]),
    status: "LOCAL_STATE_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-054",
    section: "16.1",
    owners: Object.freeze(["M02-T10", "M04-T06"]),
    status: "RUNTIME_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
  Object.freeze({
    collection: "proseRules",
    id: "R-104",
    section: "24.4",
    owners: Object.freeze(["M04-T06", "M04-T07", "M05-T05"]),
    status: "BASE_IDENTITY_PRIMITIVE_REPEAT_AND_ADAPTER_COMPOSITION_DEFERRED",
  }),
  Object.freeze({
    collection: "diagnostics",
    id: "D-019",
    section: "Appendix B",
    owners: Object.freeze(["M02-T05", "M02-T10", "M04-T06"]),
    status: "RUNTIME_PRIMITIVE_HEADLESS_TRACE_DEFERRED",
  }),
]);

const EXPECTED_TRACKED_FILES = Object.freeze([
  Object.freeze({
    path: "packages/runtime-core/src/local-state.ts",
    bytes: 28_546,
    sha256: "0849d9bec96bd2de7c1b3f86270237fa1102ba0d5ae114776c179ff2a8acc207",
  }),
  Object.freeze({
    path: "packages/runtime-core/src/node-identity.ts",
    bytes: 10_904,
    sha256: "f3a1710344319575612cfcf45f10a99419165be606d5f549860912acf9574645",
  }),
  Object.freeze({
    path: "packages/runtime-core/src/runtime-json-snapshot.ts",
    bytes: 1_479,
    sha256: "91312691b4ff9f205ad6d7dbe5102a8df54894be3e4b33b8ca04e695b88fac57",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/local-state-identity.test.ts",
    bytes: 23_709,
    sha256: "781c7fd7d73af43391c3da02330adeb4ddf00e4b99d984d92d63ef07fe8a6a89",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/local-state-identity.types.ts",
    bytes: 2_538,
    sha256: "63ac6b9c415dd1b6444ae0327845d5974b751adba1cda70011a3297425fb4569",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/local-state.js",
    bytes: 18_258,
    sha256: "15904738295fdd93b186c54823818c07fc704eb8d8f0d46ff9ae5e4b6025c2e6",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/local-state.js.map",
    bytes: 17_427,
    sha256: "78a6a08f6730ff240ed0bea2a25dcad6f2d7ed8cf209fd524b0f80acb08927e2",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/local-state.d.ts",
    bytes: 10_123,
    sha256: "9139f9e516ccf47e3f1c35988a45eb798f7a04830703d37982c7756fbb70436d",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/local-state.d.ts.map",
    bytes: 4_036,
    sha256: "b14a4e799befa912dedcc5118748e1f5f44d006006cd7196150fe8194caba1e6",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/node-identity.js",
    bytes: 6_433,
    sha256: "c0f3ecb35b5cb19414472454c08c35b756c88bce40dc38341daf325645b8d0f6",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/node-identity.js.map",
    bytes: 5_629,
    sha256: "43c977cb65bb46a0cc2b73e7ea1afb437d389058063158a090b82f550a9ff524",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/node-identity.d.ts",
    bytes: 5_012,
    sha256: "2170851fb727405f976458f148a3490feaa79af9b5be770ae028a555b4a84b6c",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/node-identity.d.ts.map",
    bytes: 2_023,
    sha256: "dc8e3541a9b3376e5cf72189fb76b377e163bd5f196712cf6689b97572b3d163",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/runtime-json-snapshot.js",
    bytes: 1_269,
    sha256: "e63639fdb72651712c69f23eacb6609f651914b7fed3725246bac4282e4f6578",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/runtime-json-snapshot.js.map",
    bytes: 915,
    sha256: "a68f27dfc0c949ab7b4e4210f8486716d2bd05e76cd99a0628746a36ecf4eb14",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/runtime-json-snapshot.d.ts",
    bytes: 690,
    sha256: "1f26be24a9e777d2bda3d11ead4747b6aa02a820943305eb99d392e6c1670418",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/runtime-json-snapshot.d.ts.map",
    bytes: 358,
    sha256: "707d2d1c6791635a22a34e61c846af553c37f4407296e83a0d65f96a204c52db",
  }),
  Object.freeze({
    path: "packages/validator/schema-contract-syntax.d.ts",
    bytes: 1_275,
    sha256: "1415d571a46a8c4e376a72d15c6ea136cbbb20a96c90c398f48af461392f3245",
  }),
  Object.freeze({
    path: "packages/validator/schema-contract-syntax.js",
    bytes: 87,
    sha256: "8b68d387d6432fd70d44f96536bb3c5a7ba636927d805c55b5e6a29155487e84",
  }),
  Object.freeze({
    path: "scripts/lib/runtime-core-local-state-identity-proof.mjs",
    bytes: 75_697,
    sha256: "25077e553ac1ce15889dc925c81445c4cdea8d5295d0fde917b8e72f5cf87e83",
  }),
  Object.freeze({
    path: "scripts/generate-runtime-core-local-state-identity-proof.mjs",
    bytes: 859,
    sha256: "b5f6a26ec87f3f43b1657b7673e1082a4a41cdb610a11270335d1f32bfe4143e",
  }),
  Object.freeze({
    path: "scripts/verify-runtime-core-local-state-identity.mjs",
    bytes: 688,
    sha256: "e22173e791784408740dac6886cda2aabc9cf5f251b2b8311cf90755ea5a5a7b",
  }),
  Object.freeze({
    path: "tests/runtime-core-local-state-identity.test.mjs",
    bytes: 20_887,
    sha256: "bea1b4d68a1d5abf0f56e08ae4775caf7444f34a781d302ce5f882d51e18ede8",
  }),
]);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T02",
    result: "PASS",
    artifact: "runtime-core-0.1.0-value-resolution.json",
    artifactSha256: "73e4c3d7640eaefd0b45b04b006df3211f0338fafa77293414d43c1052536fea",
  }),
  Object.freeze({
    package: "@desen/validator",
    subpaths: Object.freeze({
      "./schema-contract": Object.freeze({
        types: "./dist/schema-instance-validation.d.ts",
        import: "./dist/schema-instance-validation.js",
      }),
      "./schema-contract-syntax": Object.freeze({
        types: "./schema-contract-syntax.d.ts",
        import: "./schema-contract-syntax.js",
      }),
    }),
    runtimeDependency: "workspace:*",
    manifestSha256: "0e38ffa1671f30beb536445fb74996dc2a2820e72cb575f86c45048e2396d8be",
    facade: Object.freeze({
      runtimeExports: Object.freeze(["validateDraft202012"]),
      typeExports: Object.freeze(["Draft202012SyntaxError", "Draft202012SyntaxValidator"]),
      tsdocDeclarations: 3,
      implementation: "./dist/generated/0.1.0/structural-validators.js#validateDraft202012",
    }),
  }),
]);

const EXPECTED_DEFERRED = Object.freeze([
  "state.toggle and complete action-turn execution (M04-T10)",
  "repeat expansion, repeat keys, and repeated instance identity (M04-T07)",
  "resource and operation lifecycle transitions (M04-T08/M04-T09)",
  "reactive reevaluation and conditional subtree lifecycle (M04-T15)",
  "complete headless sign-in observable trace (M04-T16)",
  "adapter compatibility and declared remount-required prop policy (M05-T05)",
  "cross-surface persistence profiles and secure memory erasure",
  "React, browser, iOS, Android, SwiftUI, and Compose adapters",
]);

const ROOT_SCRIPTS = Object.freeze([
  "generate:runtime-core-local-state-identity",
  "verify:runtime-core-local-state-identity",
  "test:runtime-core-local-state-identity",
]);

const PROOF_MATRIX_SECTION_START =
  "M04-T06 defines and proves a bounded, fail-closed surface-local state lifecycle and repeat-free";
const PROOF_MATRIX_SECTION_END =
  "M04-T07 defines and proves lexical repeat scopes, bounded atomic materialization, and repeated";

const PROOF_DOCUMENT_CONTEXT = [
  "Tracked receipt:",
  "",
  "```text",
  `docs/proof/artifacts/${ARTIFACT_NAME}`,
  "```",
  "",
  "## Explicit non-claims",
].join("\n");

/** Absolute path to the immutable M04-T06 local-state and node-identity artifact. */
export const DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts",
  ARTIFACT_NAME,
);

/** Stable failure emitted by the immutable M04-T06 compatibility reader. */
export class RuntimeCoreLocalStateIdentityEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreLocalStateIdentityEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreLocalStateIdentityEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function captureOptions(value, allowedKeys, operation) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${operation} options must be a non-Proxy plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${operation} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${operation} options contain unknown, inherited, or symbolic fields.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
        `Historical M04-T06 option ${JSON.stringify(key)} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      fail(
        "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
        `Historical M04-T06 option ${JSON.stringify(key)} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} must be a non-empty string.`,
    );
  }
  return value;
}

function optionalBoundedText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalBytes(value, label, exactBytes) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} must be non-shared non-Proxy bytes.`,
    );
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
        `Historical M04-T06 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeCoreLocalStateIdentityEvidenceError) throw error;
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} must not use shared backing memory.`,
    );
  }
  if (byteLength !== exactBytes) {
    fail(
      "LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT",
      `Historical M04-T06 ${label} has an invalid exact byte length.`,
      { expectedBytes: exactBytes, actualBytes: byteLength },
    );
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} backing memory is detached or invalid.`,
    );
  }
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      `Historical M04-T06 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

async function readBoundedHandle(handle, maximumBytes) {
  const captured = Buffer.allocUnsafe(maximumBytes + 1);
  let offset = 0;
  while (offset <= maximumBytes) {
    const { bytesRead } = await handle.read(captured, offset, maximumBytes + 1 - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return Buffer.from(captured.subarray(0, offset));
}

async function readRegularBytes(filePath, label, maximumBytes, exactBytes = undefined) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_MISSING", `${label} is missing or inaccessible.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE", `${label} must be a regular non-symlink file.`);
  }
  if (entry.size > maximumBytes || (exactBytes !== undefined && entry.size !== exactBytes)) {
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE", `${label} has an invalid bounded byte size.`);
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
      openedEntry.ino !== currentEntry.ino ||
      openedEntry.size > maximumBytes ||
      currentEntry.size > maximumBytes ||
      (exactBytes !== undefined &&
        (openedEntry.size !== exactBytes || currentEntry.size !== exactBytes))
    ) {
      fail(
        "LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE",
        `${label} changed identity while it was being opened.`,
      );
    }
    const bytes = await readBoundedHandle(handle, maximumBytes);
    if (bytes.length > maximumBytes || (exactBytes !== undefined && bytes.length !== exactBytes)) {
      fail("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE", `${label} has an invalid bounded byte size.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeCoreLocalStateIdentityEvidenceError) throw error;
    fail("LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE", `${label} could not be read safely.`, {
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

function assertHistoricalSemantics(artifact) {
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M04-T06" ||
    artifact.result !== "PASS" ||
    artifact.claim?.protocol !== "0.1.0" ||
    artifact.claim?.target !== "platform-neutral" ||
    !exactJson(artifact.claim?.protocolStatusChanges, []) ||
    !exactJson(artifact.claim?.proofMatrixStatusChanges, []) ||
    !exactJson(artifact.claim?.normativeStatusChanges, [
      { id: "N-024", from: "PLANNED", to: "TESTED" },
    ]) ||
    !exactJson(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    !exactJson(artifact.publicApi?.runtimeExports, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(artifact.publicApi?.typeExports, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(artifact.publicApi?.internalExports, EXPECTED_INTERNAL_EXPORTS) ||
    artifact.publicApi?.tsdocDeclarations !== 28 ||
    !exactJson(artifact.validatorFacade, EXPECTED_PREREQUISITES[1].facade) ||
    artifact.runtime?.mountProbes !== 6 ||
    artifact.runtime?.readProbes !== 3 ||
    artifact.runtime?.acceptedWriteProbes !== 3 ||
    artifact.runtime?.rejectedWriteProbes !== 7 ||
    artifact.runtime?.completeValidationProbes !== 3 ||
    artifact.runtime?.schemaSyntaxProbes !== 1 ||
    artifact.runtime?.schemaProfileProbes !== 2 ||
    artifact.runtime?.resolvedValueProbes !== 1 ||
    artifact.runtime?.pf019Probes !== 2 ||
    artifact.runtime?.noOpProbes !== 1 ||
    artifact.runtime?.atomicityProbes !== 4 ||
    artifact.runtime?.disposalProbes !== 5 ||
    artifact.runtime?.identityCreationProbes !== 2 ||
    artifact.runtime?.identityPreservationProbes !== 1 ||
    artifact.runtime?.identityRemountProbes !== 1 ||
    artifact.runtime?.identityReplacementProbes !== 1 ||
    artifact.runtime?.identityRejectionProbes !== 3 ||
    artifact.runtime?.capabilitySafetyProbes !== 1 ||
    artifact.runtime?.hostileInputProbes !== 1 ||
    artifact.runtime?.platformEffects !== 0 ||
    artifact.runtime?.sourceWriteBacks !== 0 ||
    artifact.runtime?.partialOutputs !== false ||
    artifact.stateSemantics?.schemaApplication !== "complete resolved-value" ||
    artifact.stateSemantics?.longestPrefixMatching !== false ||
    artifact.stateSemantics?.arrayTraversal !== false ||
    artifact.stateSemantics?.diagnostic !== "STATE_WRITE_INVALID" ||
    artifact.stateSemantics?.commit !== "atomic immutable generation" ||
    !exactJson(artifact.nodeIdentitySemantics?.keyTuple, ["documentId", "surfaceId", "nodeId"]) ||
    artifact.nodeIdentitySemantics?.revisionInKey !== false ||
    artifact.nodeIdentitySemantics?.capabilityInKey !== false ||
    artifact.nodeIdentitySemantics?.repeatKey !== "deferred to M04-T07" ||
    artifact.nodeIdentitySemantics?.adapterRemountPolicy !== "deferred to M05-T05" ||
    !exactJson(artifact.limits, {
      maxValueDepth: 128,
      maxJsonNodes: 4_096,
      maxStringCodeUnits: 1_048_576,
      partialResults: false,
    }) ||
    artifact.documentation?.normativeClause !== "N-024" ||
    artifact.documentation?.normativeStatus !== "TESTED" ||
    artifact.documentation?.finding !== "PF-036" ||
    artifact.evidence?.packageTests !== 33 ||
    artifact.evidence?.compilerNegativeCases !== 7 ||
    artifact.evidence?.rootMutationTests !== 13 ||
    !exactJson(artifact.evidence?.traceRules, EXPECTED_TRACE_RULES) ||
    !exactJson(artifact.evidence?.normativeRules, [
      {
        id: "N-024",
        status: "TESTED",
        evidence: "complete resolved-value post-write schema validation",
      },
    ]) ||
    !exactJson(artifact.evidence?.trackedFiles, EXPECTED_TRACKED_FILES) ||
    !exactJson(artifact.evidence?.rootScripts, ROOT_SCRIPTS) ||
    !exactJson(artifact.deferred, EXPECTED_DEFERRED) ||
    artifact.portability?.framework !== null ||
    !exactJson(artifact.portability?.platformGlobals, []) ||
    artifact.portability?.dynamicEvaluation !== false ||
    !exactJson(artifact.portability?.nondeterministicCalls, []) ||
    !exactJson(artifact.portability?.a2uiDependencies, [])
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T06 artifact lost its exact task-time semantics or inventory.",
    );
  }
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T06 artifact bytes changed.",
      {
        expectedBytes: HISTORICAL_ARTIFACT_BYTES,
        actualBytes: bytes.length,
        expectedSha256: HISTORICAL_ARTIFACT_SHA256,
        actualSha256,
      },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "LOCAL_STATE_IDENTITY_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M04-T06 artifact is not valid JSON.",
    );
  }
  assertHistoricalSemantics(artifact);
  return deepFreeze(artifact);
}

function verifyHistoricalProofPins(proofMatrixText, proofDocumentText) {
  const matrixReference = `\`${ARTIFACT_NAME}\`\n` + `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const documentReference = `docs/proof/artifacts/${ARTIFACT_NAME}`;
  const sectionStart = proofMatrixText.indexOf(PROOF_MATRIX_SECTION_START);
  const sectionEnd = proofMatrixText.indexOf(PROOF_MATRIX_SECTION_END);
  const reference = proofMatrixText.indexOf(matrixReference);
  if (
    proofMatrixText.split(matrixReference).length !== 2 ||
    proofMatrixText.split(`\`${ARTIFACT_NAME}\``).length !== 2 ||
    proofMatrixText.split(PROOF_MATRIX_SECTION_START).length !== 2 ||
    proofMatrixText.split(PROOF_MATRIX_SECTION_END).length !== 2 ||
    sectionStart < 0 ||
    sectionEnd <= sectionStart ||
    reference <= sectionStart ||
    reference >= sectionEnd ||
    proofDocumentText.split(documentReference).length !== 2 ||
    proofDocumentText.split(PROOF_DOCUMENT_CONTEXT).length !== 2
  ) {
    fail(
      "LOCAL_STATE_IDENTITY_PROOF_PIN_DRIFT",
      "The M04-T06 proof documents must retain one exact contextual task-time artifact pin.",
    );
  }
}

function summarizeEvidence(built) {
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    compatibilityMode: built.compatibilityMode,
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    internalExports: built.artifact.publicApi.internalExports.length,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    validatorFacadeRuntimeExports: built.artifact.validatorFacade.runtimeExports.length,
    validatorFacadeTypeExports: built.artifact.validatorFacade.typeExports.length,
    validatorFacadeTsdocDeclarations: built.artifact.validatorFacade.tsdocDeclarations,
    packageTests: built.artifact.evidence.packageTests,
    compilerNegativeCases: built.artifact.evidence.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.rootMutationTests,
    traceRules: built.artifact.evidence.traceRules.length,
    normativeRules: built.artifact.evidence.normativeRules.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    ...built.artifact.runtime,
  });
}

/**
 * Reads exact M04-T06 task-time evidence without consulting current source, documentation,
 * generated output, package exports, prerequisites, runtime probes, or successor task state.
 */
export async function buildRuntimeCoreLocalStateIdentityEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    HISTORICAL_ARTIFACT_BYTES,
  );
  if (artifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      "Historical M04-T06 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const historicalBytes =
    injectedBytes ??
    (await readRegularBytes(
      artifactPath ?? DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH,
      "Immutable M04-T06 artifact",
      HISTORICAL_ARTIFACT_BYTES,
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/** Verifies immutable M04-T06 bytes, task-time semantics, inventory, and exact proof pins. */
export async function verifyRuntimeCoreLocalStateIdentityEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofDocumentText",
      "proofMatrixText",
      "proofPath",
      "proofMatrixPath",
    ],
    "verify",
  );
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    HISTORICAL_ARTIFACT_BYTES,
  );
  const proofDocumentText = optionalBoundedText(
    options.proofDocumentText,
    "proofDocumentText",
    MAX_PROOF_DOCUMENT_BYTES,
  );
  const proofMatrixText = optionalBoundedText(
    options.proofMatrixText,
    "proofMatrixText",
    MAX_PROOF_MATRIX_BYTES,
  );
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const built = await buildRuntimeCoreLocalStateIdentityEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const [resolvedProofDocumentText, resolvedProofMatrixText] = await Promise.all([
    proofDocumentText ??
      readRegularBytes(
        proofPath ?? PROOF_DOCUMENT_PATH,
        "M04-T06 proof document",
        MAX_PROOF_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularBytes(
        proofMatrixPath ?? PROOF_MATRIX_PATH,
        "Proof Matrix",
        MAX_PROOF_MATRIX_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyHistoricalProofPins(resolvedProofMatrixText, resolvedProofDocumentText);
  return summarizeEvidence(built);
}

/**
 * Preserves the tracked M04-T06 artifact or copies only its exact authenticated historical bytes
 * to an alternate safe destination.
 */
export async function writeRuntimeCoreLocalStateIdentityEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    HISTORICAL_ARTIFACT_BYTES,
  );
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (sourceArtifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "LOCAL_STATE_IDENTITY_OPTIONS_INVALID",
      "Historical M04-T06 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildRuntimeCoreLocalStateIdentityEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const requestedPath = destinationPath ?? DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH;
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedPath),
      canonicalDestinationPath(DEFAULT_RUNTIME_CORE_LOCAL_STATE_IDENTITY_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail(
      "LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE",
      "The M04-T06 compatibility destination could not be resolved safely.",
      { cause: String(error) },
    );
  }
  if (artifactPath === trackedArtifactPath) {
    const authenticatedTracked = await buildRuntimeCoreLocalStateIdentityEvidence({
      artifactPath: trackedArtifactPath,
    });
    return Object.freeze({
      ...summarizeEvidence(authenticatedTracked),
      artifactPath,
      preserved: true,
    });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "LOCAL_STATE_IDENTITY_ARTIFACT_UNSAFE",
      "Atomic M04-T06 compatibility write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    ...summarizeEvidence(built),
    artifactPath,
    preserved: false,
  });
}

/** Exact root command names retained by the M04-T06 compatibility boundary. */
export const RUNTIME_CORE_LOCAL_STATE_IDENTITY_ROOT_SCRIPTS = ROOT_SCRIPTS;
