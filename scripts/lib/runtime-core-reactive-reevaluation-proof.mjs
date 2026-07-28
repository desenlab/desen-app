import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67";
const HISTORICAL_ARTIFACT_BYTES = 11_212;
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
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

/** Absolute path to the immutable task-time M04-T15 reactive-reevaluation artifact. */
export const DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable immutable M04-T15 proof. */
export const DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact immutable M04-T15 Proof Matrix pin. */
export const DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

const EXPECTED_CLAIM = Object.freeze({
  protocol: "0.1.0",
  target: "platform-neutral",
  summary:
    "Exact current state, resource, and operation generations plus complete context and environment snapshots produce one bounded whole-surface result while detached pre-lifecycle host settlements and post-evaluator epoch checks prevent stale asynchronous or reentrant results from overwriting newer state.",
  protocolStatusChanges: Object.freeze([]),
  proofMatrixStatusChanges: Object.freeze([]),
  normativeStatusChanges: Object.freeze([]),
});

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T05",
    artifact: "runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
  }),
  Object.freeze({
    task: "M04-T06",
    artifact: "runtime-core-0.1.0-local-state-identity.json",
    sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
  }),
  Object.freeze({
    task: "M04-T07",
    artifact: "runtime-core-0.1.0-repeat-materialization.json",
    sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
  }),
  Object.freeze({
    task: "M04-T08",
    artifact: "runtime-core-0.1.0-resource-lifecycle.json",
    sha256: "2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82",
  }),
  Object.freeze({
    task: "M04-T09",
    artifact: "runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
  }),
  Object.freeze({
    task: "M04-T10",
    artifact: "runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
  }),
  Object.freeze({
    task: "M04-T11",
    artifact: "runtime-core-0.1.0-operation-resource-actions.json",
    sha256: "b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7",
  }),
  Object.freeze({
    task: "M04-T12",
    artifact: "runtime-core-0.1.0-command-event-actions.json",
    sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
  }),
  Object.freeze({
    task: "M04-T13",
    artifact: "runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    task: "M04-T14",
    artifact: "runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
]);

const EXPECTED_PUBLIC_API = Object.freeze({
  runtimeExports: 6,
  typeExports: 17,
  totalExports: 23,
  moduleExports: 24,
  tsdocDeclarations: 24,
});

const EXPECTED_SOURCE_INVARIANTS = Object.freeze({
  reactiveHostPorts: Object.freeze({
    captureChecks: 13,
    settlementFenceChecks: 7,
    revokedReflectionChecks: 6,
    envelopeChecks: 10,
    authorityChecks: 4,
    imports: 2,
    platformEffects: 0,
  }),
  reactiveReevaluation: Object.freeze({
    revokedInputReflectionChecks: 6,
    mountAuthorityChecks: 16,
    consistentSnapshotChecks: 21,
    staleCandidateChecks: 22,
    evaluatorRequestLeaks: 0,
    batchingChecks: 11,
    publicationChecks: 6,
    subscriptionChecks: 13,
    invalidationAuthorityChecks: 17,
    revocationGraphChecks: 17,
    disposalChecks: 4,
    limitChecks: 5,
    wholeSurfaceProfileChecks: 4,
    imports: 8,
    platformEffects: 0,
  }),
});

const EXPECTED_RUNTIME = Object.freeze({
  hostCaptureProbes: 12,
  settlementProbes: 9,
  revokedProxyRedactions: 1,
  authorityProbes: 11,
  revokedInputProbes: 2,
  batchingProbes: 7,
  hostSnapshotProbes: 5,
  staleCandidateProbes: 5,
  unchangedPublicationProbes: 3,
  failedSubscriptionCleanupProbes: 7,
  disposalProbes: 8,
  evaluatorCalls: 6,
  evaluatorAuthorityLeaks: 0,
  requestLeaks: 0,
  platformEffects: 0,
});

const EXPECTED_LIMITS = Object.freeze({
  maxSynchronousTransitions: 64,
  maxEvaluationGeneration: Number.MAX_SAFE_INTEGER,
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
});

const EXPECTED_SEMANTICS = Object.freeze({
  settlementFence:
    "Resource and operation results cross a native-Promise, exact-envelope, detached JSON boundary before lifecycle managers inspect them; reentrant reflection completes before the lower current-attempt check, while revoked-Proxy reflection failures are rejected without their reason.",
  authority:
    "Mount requires one factory-authenticated host aggregate and exact current state, resource, and operation handle/snapshot identities for the same document lifetime.",
  consistentSnapshot:
    "Every evaluator attempt double-samples complete lower-manager identities plus detached context and environment bytes around construction of one seven-namespace resolution snapshot.",
  leastAuthority:
    "The synchronous evaluator receives only frozen identity metadata, the resolution snapshot, and token materialization authority.",
  batching:
    "Explicit action-turn invalidation and context/environment notices set one coalescing dirty bit drained synchronously under a finite transition ceiling without platform scheduling.",
  staleCandidates:
    "Invalidation epoch and all sampled authorities are authenticated before evaluator entry, after evaluator return, and after hostile result detachment; stale candidates never publish.",
  publication:
    "Canonical byte-equal output preserves the exact previous snapshot and generation; changed active or inactive output advances monotonically without wraparound.",
  strategy:
    "This reference slice deliberately uses permitted whole-surface reevaluation; M04-T16 owns its observable oracle against indexed evaluation, while dependency-index performance work remains M12-T05.",
  failedMount:
    "Central revocation clears the complete evaluator, host, manager, snapshot, and subscription graph before failed-mount cleanup; a notice retained by the failed subscription remains inert.",
  disposal:
    "Disposal crosses the same complete revocation boundary, installs a minimal private tombstone, then unsubscribes context and environment exactly once; late and reentrant notices remain inert.",
});

const EXPECTED_DOCUMENTATION = Object.freeze({
  normativeStatusChanges: 0,
  proofMatrixStatusChanges: 0,
  findings: 1,
});

const EXPECTED_TRACKED_FILES = Object.freeze([
  Object.freeze({
    path: "packages/runtime-core/src/reactive-host-ports.ts",
    bytes: 7_193,
    sha256: "1f12c4418a914c3517470880e64da0b54569d5f0142250b318c422325080d923",
  }),
  Object.freeze({
    path: "packages/runtime-core/src/reactive-reevaluation.ts",
    bytes: 41_267,
    sha256: "863391b677eef1d0641b9f721be3cfe21e116af99a8764b369467d9356e7a751",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/reactive-host-ports.test.ts",
    bytes: 25_631,
    sha256: "02da7e3a2a25b8ef7d8c97d5269fddee133ba0a67e3f4e464dc6f5881ad2def8",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/reactive-reevaluation.test.ts",
    bytes: 31_826,
    sha256: "4c8efa04741986dd6e38953e5973ca24c05341fa469f0a09bcb967186a134ba9",
  }),
  Object.freeze({
    path: "packages/runtime-core/test/reactive-reevaluation.types.ts",
    bytes: 6_075,
    sha256: "14d12891db92ef26db7b05baf1d0b36bb55533f6db3d11aa12076abda239f92b",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-host-ports.js",
    bytes: 6_181,
    sha256: "56b9af13b550c901f6c995a4a7c55e2e56a07c60364ad8d55794150bb59fabfd",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-host-ports.js.map",
    bytes: 4_673,
    sha256: "253a21330fb521301c5a1a130f06629c5e282e74f0475e1718382e59c9e0ce4b",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-host-ports.d.ts",
    bytes: 2_570,
    sha256: "4f9c2bdca0d88fb4cbb8b7ea1d6daf4fc7aa56738c4b8cb5096150f37f83ba6f",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-host-ports.d.ts.map",
    bytes: 507,
    sha256: "36b1e2264bb0fc1b2c1fc0f3e18abe58e92861ca88c8735d2f88b157c9c7b5d6",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-reevaluation.js",
    bytes: 31_354,
    sha256: "45fb6a7c57fd33e89b3661fb14b9eeed151a9149de06ec3fbfe6bdb8e28cd10a",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-reevaluation.js.map",
    bytes: 26_213,
    sha256: "390b544d2cd0514dfc8916e2fe3e096fb82a1cc02136b5d21e45968700ccd38c",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-reevaluation.d.ts",
    bytes: 10_452,
    sha256: "31bcf07d3ec8c9e5cf06c3542129e5a8c0e4bf1ce31d95222166b7b10af22f39",
  }),
  Object.freeze({
    path: "packages/runtime-core/dist/reactive-reevaluation.d.ts.map",
    bytes: 4_371,
    sha256: "5a607a4f69d0f88251c9ce384df9d6d61bc782a79b80c2a9b93e1c3c6f6eaae5",
  }),
  Object.freeze({
    path: "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
    bytes: 74_729,
    sha256: "d30bc915dfc90435951a9ffdd277c2c63be9c9e42b98a82f77d25d3d412a254c",
  }),
  Object.freeze({
    path: "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
    bytes: 695,
    sha256: "df7e94438cbf2eeda8f26906e22270f2d454c17d7e55e1a8714faa109e2cd3ec",
  }),
  Object.freeze({
    path: "scripts/verify-runtime-core-reactive-reevaluation.mjs",
    bytes: 697,
    sha256: "2502da00a52ffd55e3679b4f699c7b138082405815c7acb87b45cef95caf7eec",
  }),
  Object.freeze({
    path: "tests/runtime-core-reactive-reevaluation.test.mjs",
    bytes: 24_906,
    sha256: "74aabe03536c20cbe76034c53b6d0c59b67d6543a17c3d1d59481d66ea574ff7",
  }),
]);

const EXPECTED_TRACKED_PATHS = Object.freeze(
  EXPECTED_TRACKED_FILES.map(({ path: relativePath }) => relativePath),
);

const EXPECTED_SHARED_INPUTS = Object.freeze([
  "packages/runtime-core/package.json",
  "packages/runtime-core/src/index.ts",
  "packages/runtime-core/dist/index.js",
  "packages/runtime-core/dist/index.d.ts",
  "docs/proof/protocol-0.1.0-traceability.json",
  "docs/proof/NORMATIVE-COVERAGE.md",
  "docs/proof/PROOF-MATRIX.md",
  "docs/plan/PROTOCOL-FINDINGS.md",
  "docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md",
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
]);

const EXPECTED_DEFERRED = Object.freeze([
  "complete validated surface traversal, conditional/repeat materialization, and descendant semantic inactivity (M04-T16)",
  "M04-T14 selector to M04-T13 prepared-program composition and seven-namespace event/item provenance (M04-T16)",
  "joint action-turn/reactive session coordinator, deterministic sign-in JSON trace, and complete session disposal (M04-T16)",
  "whole-surface versus dependency-indexed observable oracle (M04-T16)",
  "dependency-index optimization and cross-strategy performance comparison (M12-T05 when needed)",
  "standalone token invalidation because the frozen 0.1.0 token port has no subscription",
  "React reconciliation, concrete instance preservation/remount, DOM/CSS/accessibility/focus, and production adapter parity (M05)",
  "Android and iOS adapter implementations",
  "future protocol clarification recorded by PF-045",
]);

/** Controlled compatibility-verifier failure for immutable M04-T15 evidence. */
export class RuntimeCoreReactiveReevaluationEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreReactiveReevaluationEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreReactiveReevaluationEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REACTIVE_OPTIONS_INVALID",
        `Historical M04-T15 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REACTIVE_OPTIONS_INVALID",
        `Historical M04-T15 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("REACTIVE_OPTIONS_INVALID", `Historical M04-T15 ${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBoundedText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalBuffer(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} must be non-shared non-Proxy bytes.`,
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
        "REACTIVE_OPTIONS_INVALID",
        `Historical M04-T15 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeCoreReactiveReevaluationEvidenceError) throw error;
    fail("REACTIVE_OPTIONS_INVALID", `Historical M04-T15 ${label} could not be captured safely.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} must not use shared backing memory.`,
    );
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      `Historical M04-T15 ${label} backing memory is detached or invalid.`,
    );
  }
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("REACTIVE_OPTIONS_INVALID", `Historical M04-T15 ${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularFile(
  filePath,
  missingCode,
  unsafeCode,
  maximumBytes,
  exactBytes = undefined,
) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(missingCode, `Historical M04-T15 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `Historical M04-T15 evidence must be a regular file: ${filePath}.`);
  }
  if (entry.size > maximumBytes || (exactBytes !== undefined && entry.size !== exactBytes)) {
    fail(unsafeCode, `Historical M04-T15 evidence has an invalid bounded byte size: ${filePath}.`);
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
      fail(unsafeCode, `Historical M04-T15 evidence changed identity while opening: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes || (exactBytes !== undefined && bytes.length !== exactBytes)) {
      fail(
        unsafeCode,
        `Historical M04-T15 evidence has an invalid bounded byte size: ${filePath}.`,
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeCoreReactiveReevaluationEvidenceError) throw error;
    fail(unsafeCode, `Historical M04-T15 evidence could not be read safely: ${filePath}.`, {
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

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function inspectHistoricalArtifact(bytes) {
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "REACTIVE_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M04-T15 artifact byte length changed.",
      { expected: HISTORICAL_ARTIFACT_BYTES, actual: bytes.length },
    );
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "REACTIVE_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M04-T15 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "REACTIVE_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T15 artifact is not valid JSON.",
    );
  }

  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((record) => record?.path);
  const trackedRecordsAreExact =
    new Set(trackedPaths).size === trackedFiles.length &&
    trackedFiles.every(
      (record) =>
        record !== null &&
        typeof record === "object" &&
        isDeepStrictEqual(Object.keys(record), ["path", "bytes", "sha256"]) &&
        typeof record.path === "string" &&
        Number.isSafeInteger(record.bytes) &&
        record.bytes >= 0 &&
        typeof record.sha256 === "string" &&
        /^[0-9a-f]{64}$/u.test(record.sha256),
    );

  const actual = {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    claim: artifact.claim,
    prerequisites: artifact.prerequisites,
    publicApi: artifact.publicApi,
    sourceInvariants: artifact.sourceInvariants,
    runtime: artifact.runtime,
    limits: artifact.limits,
    semantics: artifact.semantics,
    documentation: artifact.documentation,
    focusedTestRegistrations: artifact.evidence?.focusedTestRegistrations,
    focusedTests: artifact.evidence?.focusedTests,
    compilerNegativeCases: artifact.evidence?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.rootMutationTests,
    traceRules: artifact.evidence?.traceRules,
    trackedFiles,
    semanticOnlySharedInputs: artifact.evidence?.semanticOnlySharedInputs,
    deferred: artifact.deferred,
  };
  const expected = {
    schemaVersion: 1,
    task: "M04-T15",
    result: "PASS",
    claim: EXPECTED_CLAIM,
    prerequisites: EXPECTED_PREREQUISITES,
    publicApi: EXPECTED_PUBLIC_API,
    sourceInvariants: EXPECTED_SOURCE_INVARIANTS,
    runtime: EXPECTED_RUNTIME,
    limits: EXPECTED_LIMITS,
    semantics: EXPECTED_SEMANTICS,
    documentation: EXPECTED_DOCUMENTATION,
    focusedTestRegistrations: 39,
    focusedTests: 54,
    compilerNegativeCases: 11,
    rootMutationTests: 30,
    traceRules: 6,
    trackedFiles: EXPECTED_TRACKED_FILES,
    semanticOnlySharedInputs: EXPECTED_SHARED_INPUTS,
    deferred: EXPECTED_DEFERRED,
  };
  if (!trackedRecordsAreExact || !isDeepStrictEqual(actual, expected)) {
    fail(
      "REACTIVE_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T15 artifact no longer has its reviewed semantics or inventory.",
      { expected, actual },
    );
  }
  return freezeJson(artifact);
}

function exactSection(markdown, heading, code) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) fail(code, `Expected one exact ${heading} section.`);
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return Object.freeze({
    lines,
    section: lines.slice(start, end === -1 ? lines.length : end),
  });
}

function verifyProofDocument(markdown) {
  const { lines, section } = exactSection(
    markdown,
    "## Evidence boundary",
    "REACTIVE_PROOF_PIN_DRIFT",
  );
  const pathLine = `\`${ARTIFACT_RELATIVE_PATH}\`.`;
  const shaLine = `Its SHA-256 is \`${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const pathIndex = section.indexOf(pathLine);
  const sectionText = section.join("\n");
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    lines.filter((line) => line === pathLine).length !== 1 ||
    lines.filter((line) => line === shaLine).length !== 1 ||
    !sectionText.includes("task-time boundary, `N-003`, `N-034`, and `N-041` were `PLANNED`") ||
    sectionText.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "REACTIVE_PROOF_PIN_DRIFT",
      "The M04-T15 proof path, SHA, or task-time normative claim moved or drifted.",
    );
  }
}

function verifyProofMatrix(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const startMarker =
    "M04-T15 defines and proves one platform-neutral reactive publication boundary without changing a";
  const endMarker = "## M04-T16 / G04";
  const starts = lines.flatMap((line, index) => (line === startMarker ? [index] : []));
  const ends = lines.flatMap((line, index) => (line === endMarker ? [index] : []));
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    fail("REACTIVE_PROOF_PIN_DRIFT", "The exact M04-T15 Proof Matrix ledger moved or duplicated.");
  }
  const section = lines.slice(starts[0], ends[0]);
  const pathLine = `\`${ARTIFACT_FILE_NAME}\``;
  const shaLine = `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const pathIndex = section.indexOf(pathLine);
  const sectionText = section.join("\n");
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    lines.filter((line) => line === pathLine).length !== 1 ||
    lines.filter((line) => line === shaLine).length !== 1 ||
    !sectionText.includes("N-003, N-034, and N-041 remained\n`PLANNED`") ||
    sectionText.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "REACTIVE_PROOF_PIN_DRIFT",
      "The M04-T15 Proof Matrix pin or task-time normative claim moved or drifted.",
    );
  }
}

function summarizeEvidence(built) {
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    compatibilityMode: COMPATIBILITY_MODE,
    runtimeExports: EXPECTED_PUBLIC_API.runtimeExports,
    typeExports: EXPECTED_PUBLIC_API.typeExports,
    moduleExports: EXPECTED_PUBLIC_API.moduleExports,
    tsdocDeclarations: EXPECTED_PUBLIC_API.tsdocDeclarations,
    focusedTests: 54,
    compilerNegativeCases: 11,
    rootMutationTests: 30,
    trackedFiles: EXPECTED_TRACKED_PATHS.length,
    traceRules: 6,
    evaluatorAuthorityLeaks: EXPECTED_RUNTIME.evaluatorAuthorityLeaks,
    requestLeaks: EXPECTED_RUNTIME.requestLeaks,
    platformEffects: EXPECTED_RUNTIME.platformEffects,
  });
}

/**
 * Reads only the exact immutable M04-T15 task-time artifact and reviewed semantic inventory.
 *
 * @remarks Current runtime source, generated output, package exports, prerequisites, probes, and
 * documentation state can never be rebuilt into historical M04-T15 evidence through this reader.
 */
export async function buildRuntimeCoreReactiveReevaluationEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      "Historical M04-T15 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const resolvedPath = artifactPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH;
  const historicalBytes =
    injectedBytes ??
    (await readRegularFile(
      resolvedPath,
      "REACTIVE_ARTIFACT_MISSING",
      "REACTIVE_ARTIFACT_UNSAFE",
      HISTORICAL_ARTIFACT_BYTES,
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M04-T15 bytes, semantics, inventory, and exact historical documentation. */
export async function verifyRuntimeCoreReactiveReevaluationEvidence(rawOptions = undefined) {
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
  const injectedBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
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
  const built = await buildRuntimeCoreReactiveReevaluationEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const [proofText, matrixText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_PROOF_PATH,
        "REACTIVE_PROOF_MISSING",
        "REACTIVE_PROOF_UNSAFE",
        MAX_PROOF_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_PROOF_MATRIX_PATH,
        "REACTIVE_PROOF_MISSING",
        "REACTIVE_PROOF_UNSAFE",
        MAX_PROOF_MATRIX_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyProofDocument(proofText);
  verifyProofMatrix(matrixText);
  return summarizeEvidence(built);
}

/** Atomically copies only exact already-authenticated immutable M04-T15 task-time bytes. */
export async function writeRuntimeCoreReactiveReevaluationEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (sourceArtifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "REACTIVE_OPTIONS_INVALID",
      "Historical M04-T15 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const built = await buildRuntimeCoreReactiveReevaluationEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const requestedPath = destinationPath ?? DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH;
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedPath),
      canonicalDestinationPath(DEFAULT_RUNTIME_CORE_REACTIVE_REEVALUATION_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail("REACTIVE_ARTIFACT_UNSAFE", "M04-T15 compatibility destination is unsafe.", {
      cause: String(error),
    });
  }
  if (artifactPath === trackedArtifactPath) {
    return Object.freeze({
      ...summarizeEvidence(built),
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
    fail("REACTIVE_ARTIFACT_UNSAFE", "Atomic M04-T15 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    ...summarizeEvidence(built),
    artifactPath,
  });
}
