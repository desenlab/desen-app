import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-interactions.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-INTERACTIONS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0";
const HISTORICAL_ARTIFACT_BYTES = 52_430;
const P06_CURRENT_STATUS = "PARTIAL";
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const MAX_PROOF_DOCUMENT_BYTES = 500_000;
const MAX_PROOF_MATRIX_BYTES = 2_000_000;
const MAX_NORMATIVE_COVERAGE_BYTES = 2_000_000;
const PENDING_ARTIFACT_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
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

/** Absolute path to the immutable task-time M05-T04 interaction artifact. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable immutable M05-T04 proof. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact immutable M05-T04 Proof Matrix pins. */
export const DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

const DEFAULT_RUNTIME_REACT_INTERACTIONS_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_PATH,
);

const EXPECTED_CLAIM = Object.freeze({
  exactTwoWayBindingParityBeforeElementCreation: true,
  interactionAuthorityCommitScoped: true,
  exactCapturedSessionSnapshotAndRuntimeIdentity: true,
  behaviorEventsSupported: true,
  behaviorComponentCommandAuthority: false,
  componentCommandOwnershipOpaqueAndRevocable: true,
  nativeOrDomAuthorityExposed: false,
  referenceDeclaredCommandsImplemented: true,
});

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
]);

const EXPECTED_RUNTIME_TYPE_EXPORTS = Object.freeze([
  "RuntimeReactAdapterRegistryCreateInput",
  "RuntimeReactAdapterRegistryCreateResult",
  "RuntimeReactAdapterRegistryHandle",
  "RuntimeReactAdapterRegistryInvalidReason",
  "RuntimeReactAdapterRegistryLimitProfile",
  "RuntimeReactAdapterRegistryReadResult",
  "RuntimeReactAdapterRegistrySnapshot",
  "RuntimeReactBehaviorAdapterComponent",
  "RuntimeReactBehaviorAdapterProps",
  "RuntimeReactBehaviorAdapterRegistration",
  "RuntimeReactCommandAttachmentHandle",
  "RuntimeReactCommandAttachmentResult",
  "RuntimeReactCommandDetachmentResult",
  "RuntimeReactComponentAdapterComponent",
  "RuntimeReactComponentAdapterProps",
  "RuntimeReactComponentAdapterRegistration",
  "RuntimeReactComponentCommandPort",
  "RuntimeReactDiagnosticIdentity",
  "RuntimeReactEventDispatchResult",
  "RuntimeReactInteractionPort",
  "RuntimeReactNamedSlots",
  "RuntimeReactRenderFailure",
  "RuntimeReactRenderFailureChannel",
  "RuntimeReactRenderFailureCode",
  "RuntimeReactRenderInput",
  "RuntimeReactRenderLimitProfile",
  "RuntimeReactRenderResult",
  "RuntimeReactRenderedSurface",
  "RuntimeReactSemanticStyle",
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_RUNTIME_REACT = Object.freeze({
  exports: EXPECTED_RUNTIME_EXPORTS,
  typeExports: EXPECTED_RUNTIME_TYPE_EXPORTS,
  imports: Object.freeze({
    interactions: Object.freeze(["./registry.js", "@desen/runtime-core", "react"]),
    renderer: Object.freeze([
      "./interactions.js",
      "./registry.js",
      "@desen/runtime-core",
      "@desen/validator",
      "react",
    ]),
  }),
  commitMechanism: "private-layout-effect-controller",
  preFirstCommitAuthority: "unavailable",
  serverRenderAuthority: "unavailable",
  neverCommittedSuspenseAuthority: "unavailable",
  cleanupAuthority: "unavailable",
  postCommitRenderPhasePubliclyDistinguishable: false,
  trustedAdapterUsageRule:
    "side-effecting ports are called only from committed effects or platform callbacks",
  eventCompletionExposure: "void-only",
  bindingParityFailure: "RUNTIME_BINDING_MISMATCH",
});

const EXPECTED_COMPONENT_COMMANDS = Object.freeze({
  functions: Object.freeze([
    "attachRuntimeHeadlessSessionComponentCommands",
    "detachRuntimeHeadlessSessionComponentCommands",
  ]),
  types: Object.freeze([
    "RuntimeHeadlessSessionComponentCommandsInput",
    "RuntimeHeadlessSessionComponentCommandsAttachment",
    "RuntimeHeadlessSessionComponentCommandsAttachResult",
    "RuntimeHeadlessSessionComponentCommandsDetachResult",
  ]),
  stableLowerBindingTicket: true,
  supersession: "newest-owner-wins",
  staleCleanupRevokesReplacement: false,
  automaticRevocation: Object.freeze([
    "binding-replacement",
    "navigation",
    "react-unmount",
    "session-disposal",
  ]),
  hostileOutcomes: "fail-closed-denied-or-controlled-status",
});

const EXPECTED_REFERENCE_EXPORTS = Object.freeze([
  "AlertReactAdapter",
  "ButtonReactAdapter",
  "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
  "REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS",
  "StackReactAdapter",
  "TextFieldReactAdapter",
  "TextReactAdapter",
  "alertReactAdapterRegistration",
  "buttonReactAdapterRegistration",
  "stackReactAdapterRegistration",
  "textFieldReactAdapterRegistration",
  "textReactAdapterRegistration",
]);

const EXPECTED_REFERENCE_ADAPTERS = Object.freeze({
  subpath: "@desen/reference-catalog-web/react-adapters",
  staticComponentRegistrations: 5,
  exports: EXPECTED_REFERENCE_EXPORTS,
  packageExports: Object.freeze([
    ".",
    "./catalog.json",
    "./components",
    "./host-operations",
    "./operations",
    "./parity",
    "./react-adapters",
    "./tokens",
  ]),
  consumerExports: EXPECTED_REFERENCE_EXPORTS,
  builtPublicSubpathExecuted: true,
  declaredCommandImplementations: Object.freeze([
    Object.freeze({
      capabilityId: "com.example.ui/TextField",
      command: "focus",
      privatePrimitive: "TextFieldHandle.focus",
    }),
  ]),
  forwardedEvents: Object.freeze([
    Object.freeze({ capabilityId: "com.example.ui/TextField", event: "change" }),
    Object.freeze({ capabilityId: "com.example.ui/Button", event: "press" }),
  ]),
  commandAttachmentCallSite: "committed-useEffect",
  eventDispatchCallSites: Object.freeze(["onChange", "onPress"]),
  arbitraryPropOrSemanticStyleSpread: false,
  domOrNativeHandleLeak: false,
  dynamicExecutableLoading: false,
});

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M03-T10",
    path: "docs/proof/artifacts/reference-catalog-web-capability-artifact.json",
    sha256: "sha256:4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T17",
    gate: "G04",
    path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    sha256: "sha256:cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
    profile: "desen-runtime-core-audit-hardening-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T03",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json",
    sha256: "sha256:2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb",
    profile: "desen-runtime-react-resolved-styles-v1",
    result: "PASS",
  }),
]);

const EXPECTED_TESTS = Object.freeze({
  runtimeReactDeclarations: 11,
  runtimeReactExecutedCases: 23,
  referenceAdapterTests: 10,
  runtimeCoreCommandTests: 5,
  rootMutationTests: 18,
  compilerNegativeCases: Object.freeze({
    runtimeReact: 3,
    referenceAdapters: 10,
    runtimeCoreCommandAttachment: 7,
    total: 20,
  }),
});

const EXPECTED_COMPATIBILITY_PATHS = Object.freeze([
  "scripts/lib/reference-catalog-web-parity-proof.mjs",
  "scripts/lib/reference-catalog-web-capability-artifact-proof.mjs",
  "scripts/lib/reference-tokens-and-synthetic-fixtures-proof.mjs",
  "scripts/lib/runtime-core-headless-sign-in-proof.mjs",
  "scripts/lib/runtime-core-audit-hardening-proof.mjs",
  "scripts/lib/runtime-react-resolved-styles-proof.mjs",
  "scripts/lib/sc-01-dtcg-audit.mjs",
  "scripts/generate-sc-01-dtcg-proof.mjs",
  "scripts/verify-sc-01-dtcg.mjs",
  "scripts/lib/runtime-core-local-state-identity-proof.mjs",
  "scripts/generate-runtime-core-local-state-identity-proof.mjs",
  "scripts/verify-runtime-core-local-state-identity.mjs",
  "scripts/lib/runtime-core-command-event-actions-proof.mjs",
  "scripts/generate-runtime-core-command-event-actions-proof.mjs",
  "scripts/verify-runtime-core-command-event-actions.mjs",
  "scripts/lib/runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
  "scripts/verify-runtime-core-reactive-reevaluation.mjs",
  "tests/reference-catalog-web-capability-artifact.test.mjs",
  "tests/reference-catalog-web-parity.test.mjs",
  "tests/reference-tokens-and-synthetic-fixtures.test.mjs",
  "tests/runtime-core-headless-sign-in.test.mjs",
  "tests/runtime-core-audit-hardening.test.mjs",
  "tests/runtime-react-resolved-styles.test.mjs",
  "tests/sc-01-dtcg-audit.test.mjs",
  "tests/runtime-core-local-state-identity.test.mjs",
  "tests/runtime-core-command-event-actions.test.mjs",
  "tests/runtime-core-reactive-reevaluation.test.mjs",
]);

const EXPECTED_EVIDENCE_COMPATIBILITY = Object.freeze({
  normativeCompatibilityTransfer: Object.freeze({
    id: "N-034",
    historicalStatus: "PLANNED",
    currentStatus: "TESTED",
    monotonicIds: Object.freeze(["N-033", "N-034"]),
  }),
  sc01DtcgCompatibility: Object.freeze({
    artifactSha256: "sha256:1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
    taskTimeManifestSha256:
      "sha256:455025526691234369626b96281ba6522a0d90340adcfcd67ffea2d53be167fa",
    compatibilityMode: COMPATIBILITY_MODE,
    currentSuccessorSourceInputs: false,
    rootScripts: Object.freeze({
      generate: "node scripts/generate-sc-01-dtcg-proof.mjs",
      verify: "node scripts/verify-sc-01-dtcg.mjs",
      test: "node --test tests/sc-01-dtcg-audit.test.mjs",
    }),
    focusedTests: 20,
  }),
  localStateIdentityCompatibility: Object.freeze({
    artifactSha256: "sha256:4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
    artifactBytes: 15_575,
    compatibilityMode: COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    rootScripts: Object.freeze({
      generate: "node scripts/generate-runtime-core-local-state-identity-proof.mjs",
      verify: "node scripts/verify-runtime-core-local-state-identity.mjs",
      test: "node --test tests/runtime-core-local-state-identity.test.mjs",
    }),
    focusedTests: 20,
  }),
  commandEventCompatibility: Object.freeze({
    artifactSha256: "sha256:8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
    artifactBytes: 23_466,
    compatibilityMode: COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    historicalN034Status: "PLANNED",
    currentSelectedWebReactN034Status: "TESTED",
    rootScripts: Object.freeze({
      generate: "node scripts/generate-runtime-core-command-event-actions-proof.mjs",
      verify: "node scripts/verify-runtime-core-command-event-actions.mjs",
      test: "node --test tests/runtime-core-command-event-actions.test.mjs",
    }),
    focusedTests: 16,
  }),
  reactiveReevaluationCompatibility: Object.freeze({
    artifactSha256: "sha256:7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
    artifactBytes: 11_212,
    compatibilityMode: COMPATIBILITY_MODE,
    currentRuntimeSourceInputs: false,
    historicalN034Status: "PLANNED",
    currentSelectedWebReactN034Status: "TESTED",
    rootScripts: Object.freeze({
      generate: "node scripts/generate-runtime-core-reactive-reevaluation-proof.mjs",
      verify: "node scripts/verify-runtime-core-reactive-reevaluation.mjs",
      test: "node --test tests/runtime-core-reactive-reevaluation.test.mjs",
    }),
    focusedTests: 20,
  }),
  proofPinNormalization: Object.freeze({
    token: PENDING_ARTIFACT_SHA256,
    allowlistedDocuments: Object.freeze([
      PROOF_DOCUMENT_PATH,
      PROOF_MATRIX_PATH,
      NORMATIVE_COVERAGE_PATH,
    ]),
    exactReferenceCount: 5,
    productionVerifierAcceptsPending: false,
  }),
  verifierExecutionProfile: "static-evidence-and-built-package-tuple",
});

const EXPECTED_NONCLAIMS = Object.freeze([
  "No stable React reconciliation or runtime-to-source lookup API claim.",
  "No public detector that distinguishes a post-commit trusted child render phase.",
  "No committed adapter exception-containment claim.",
  "No concrete semantic-style, CSS, or accessibility-preservation claim.",
  "No independently built reference host or complete sign-in execution claim.",
  "No iOS, Android, SwiftUI, Compose, or other native renderer claim.",
]);

/** Controlled compatibility-reader failure for immutable M05-T04 evidence. */
export class RuntimeReactInteractionsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactInteractionsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactInteractionsEvidenceError(code, message, details);
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
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} options must be a plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "INTERACTIONS_OPTIONS_INVALID",
        `Historical M05-T04 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "INTERACTIONS_OPTIONS_INVALID",
        `Historical M05-T04 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("INTERACTIONS_OPTIONS_INVALID", `Historical M05-T04 ${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBoundedText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} exceeds its bounded UTF-8 byte limit.`,
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
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} must be non-shared non-Proxy bytes.`,
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
        "INTERACTIONS_OPTIONS_INVALID",
        `Historical M05-T04 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeReactInteractionsEvidenceError) throw error;
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} must not use shared backing memory.`,
    );
  }

  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} backing memory is detached or invalid.`,
    );
  }
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      `Historical M05-T04 ${label} must be a non-Proxy function.`,
    );
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
    fail(missingCode, `Historical M05-T04 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `Historical M05-T04 evidence must be a regular file: ${filePath}.`);
  }
  if (entry.size > maximumBytes || (exactBytes !== undefined && entry.size !== exactBytes)) {
    fail(unsafeCode, `Historical M05-T04 evidence has an invalid bounded byte size: ${filePath}.`);
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
      fail(unsafeCode, `Historical M05-T04 evidence changed identity while opening: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes || (exactBytes !== undefined && bytes.length !== exactBytes)) {
      fail(
        unsafeCode,
        `Historical M05-T04 evidence has an invalid bounded byte size: ${filePath}.`,
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeReactInteractionsEvidenceError) throw error;
    fail(unsafeCode, `Historical M05-T04 evidence could not be read safely: ${filePath}.`, {
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
      "INTERACTIONS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T04 artifact byte length changed.",
      { expected: HISTORICAL_ARTIFACT_BYTES, actual: bytes.length },
    );
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "INTERACTIONS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T04 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "INTERACTIONS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T04 artifact is not valid JSON.",
    );
  }

  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((record) => record?.path);
  const normalizedSelfPinPaths = new Set([
    NORMATIVE_COVERAGE_PATH,
    PROOF_MATRIX_PATH,
    PROOF_DOCUMENT_PATH,
  ]);
  const trackedRecordsAreExact =
    trackedFiles.length === 114 &&
    new Set(trackedPaths).size === trackedFiles.length &&
    trackedFiles.every((record) => {
      if (record === null || typeof record !== "object") return false;
      const normalizedSelfPin = normalizedSelfPinPaths.has(record.path);
      return (
        isDeepStrictEqual(
          Object.keys(record),
          normalizedSelfPin
            ? ["path", "bytes", "sha256", "selfPinNormalizedTo"]
            : ["path", "bytes", "sha256"],
        ) &&
        typeof record.path === "string" &&
        record.path.length > 0 &&
        Number.isSafeInteger(record.bytes) &&
        record.bytes >= 0 &&
        typeof record.sha256 === "string" &&
        /^sha256:[0-9a-f]{64}$/u.test(record.sha256) &&
        (!normalizedSelfPin || record.selfPinNormalizedTo === `sha256:${PENDING_ARTIFACT_SHA256}`)
      );
    });

  const successorEntries = Array.isArray(artifact.successorPackage?.entries)
    ? artifact.successorPackage.entries
    : [];
  const successorPaths = successorEntries.map((entry) => entry?.path);
  const successorEntriesAreExact =
    successorEntries.length === 81 &&
    new Set(successorPaths).size === successorEntries.length &&
    successorEntries.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        isDeepStrictEqual(Object.keys(entry), ["path", "byteLength", "contentDigest"]) &&
        typeof entry.path === "string" &&
        entry.path.length > 0 &&
        Number.isSafeInteger(entry.byteLength) &&
        entry.byteLength >= 0 &&
        typeof entry.contentDigest === "string" &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.contentDigest),
    );

  const actual = {
    rootKeys: Object.keys(artifact),
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.protocol,
    target: artifact.target,
    prerequisites: artifact.prerequisites,
    claim: artifact.claim,
    componentCommands: artifact.componentCommands,
    runtimeReact: artifact.runtimeReact,
    referenceAdapters: artifact.referenceAdapters,
    successorPackage: {
      identity: artifact.successorPackage?.identity,
      profile: artifact.successorPackage?.profile,
      profileVersion: artifact.successorPackage?.profileVersion,
      distributionFiles: artifact.successorPackage?.distributionFiles,
      distributionBytes: artifact.successorPackage?.distributionBytes,
      framedEntries: artifact.successorPackage?.framedEntries,
      framedBytes: artifact.successorPackage?.framedBytes,
      interpretations: artifact.successorPackage?.interpretations,
      catalogAdapterParity: artifact.successorPackage?.catalogAdapterParity,
    },
    evidenceKeys: Object.keys(artifact.evidence ?? {}),
    tests: artifact.evidence?.tests,
    compatibilityPaths: artifact.evidence?.compatibilityPaths,
    normativeCompatibilityTransfer: artifact.evidence?.normativeCompatibilityTransfer,
    sc01DtcgCompatibility: artifact.evidence?.sc01DtcgCompatibility,
    localStateIdentityCompatibility: artifact.evidence?.localStateIdentityCompatibility,
    commandEventCompatibility: artifact.evidence?.commandEventCompatibility,
    reactiveReevaluationCompatibility: artifact.evidence?.reactiveReevaluationCompatibility,
    proofPinNormalization: artifact.evidence?.proofPinNormalization,
    verifierExecutionProfile: artifact.evidence?.verifierExecutionProfile,
    nonclaims: artifact.nonclaims,
  };
  const expected = {
    rootKeys: [
      "schemaVersion",
      "task",
      "result",
      "profile",
      "protocol",
      "target",
      "prerequisites",
      "claim",
      "componentCommands",
      "runtimeReact",
      "referenceAdapters",
      "successorPackage",
      "evidence",
      "nonclaims",
    ],
    schemaVersion: 1,
    task: "M05-T04",
    result: "PASS",
    profile: "desen-runtime-react-interactions-v1",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: EXPECTED_PREREQUISITES,
    claim: EXPECTED_CLAIM,
    componentCommands: EXPECTED_COMPONENT_COMMANDS,
    runtimeReact: EXPECTED_RUNTIME_REACT,
    referenceAdapters: EXPECTED_REFERENCE_ADAPTERS,
    successorPackage: {
      identity: {
        id: "run.desen.reference.sign-in",
        version: "0.1.0",
        target: "web-react",
        packageDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
      },
      profile: "desen.web-react.package-digest",
      profileVersion: 1,
      distributionFiles: 80,
      distributionBytes: 243_175,
      framedEntries: 81,
      framedBytes: 252_072,
      interpretations: {
        independentFrame: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
        publicCalculation:
          "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
        publicVerification:
          "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
      },
      catalogAdapterParity: {
        direction: "exact-two-way",
        catalogComponents: [
          "com.example.ui/Alert",
          "com.example.ui/Button",
          "com.example.ui/Stack",
          "com.example.ui/Text",
          "com.example.ui/TextField",
        ],
        registrationComponents: [
          "com.example.ui/Alert",
          "com.example.ui/Button",
          "com.example.ui/Stack",
          "com.example.ui/Text",
          "com.example.ui/TextField",
        ],
        behaviors: [],
        interactions: [
          { capabilityId: "com.example.ui/Alert", commands: [], events: [] },
          { capabilityId: "com.example.ui/Button", commands: [], events: ["press"] },
          { capabilityId: "com.example.ui/Stack", commands: [], events: [] },
          { capabilityId: "com.example.ui/Text", commands: [], events: [] },
          {
            capabilityId: "com.example.ui/TextField",
            commands: ["focus"],
            events: ["change"],
          },
        ],
      },
    },
    evidenceKeys: [
      "tests",
      "trackedFiles",
      "compatibilityPaths",
      "normativeCompatibilityTransfer",
      "sc01DtcgCompatibility",
      "localStateIdentityCompatibility",
      "commandEventCompatibility",
      "reactiveReevaluationCompatibility",
      "proofPinNormalization",
      "verifierExecutionProfile",
    ],
    tests: EXPECTED_TESTS,
    compatibilityPaths: EXPECTED_COMPATIBILITY_PATHS,
    ...EXPECTED_EVIDENCE_COMPATIBILITY,
    nonclaims: EXPECTED_NONCLAIMS,
  };

  if (
    !trackedRecordsAreExact ||
    !successorEntriesAreExact ||
    !isDeepStrictEqual(actual, expected)
  ) {
    fail(
      "INTERACTIONS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T04 artifact no longer has its reviewed semantics or inventory.",
      { expected, actual },
    );
  }
  return freezeJson(artifact);
}

function exactSection(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("INTERACTIONS_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return Object.freeze({
    lines,
    section: lines.slice(start, end === -1 ? lines.length : end),
  });
}

function exactRow(markdown, id) {
  const lines = markdown.split(/\r?\n/u);
  const rows = lines.filter((line) => line.startsWith(`| ${id} |`));
  if (rows.length !== 1) {
    fail("INTERACTIONS_PROOF_PIN_DRIFT", `Expected one exact ${id} ledger row.`);
  }
  return Object.freeze({
    line: rows[0],
    cells: rows[0]
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim()),
  });
}

function verifyProofDocument(markdown) {
  const { lines, section } = exactSection(markdown, "## Evidence artifact");
  const pathLine = `\`${ARTIFACT_RELATIVE_PATH}\``;
  const shaLine = `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const pathIndex = section.indexOf(pathLine);
  const sectionText = section.join("\n");
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    lines.filter((line) => line === pathLine).length !== 1 ||
    lines.filter((line) => line === shaLine).length !== 1 ||
    !sectionText.includes("The production verifier rejects a pending, moved, duplicated, or") ||
    sectionText.includes(PENDING_ARTIFACT_SHA256)
  ) {
    fail(
      "INTERACTIONS_PROOF_PIN_DRIFT",
      "The M05-T04 proof artifact path, SHA, or immutable-verifier claim moved or drifted.",
    );
  }
}

function verifyProofMatrix(markdown) {
  const { lines, section } = exactSection(markdown, "## M05-T04");
  const pathLine = `\`${ARTIFACT_FILE_NAME}\``;
  const shaLine = `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const pathIndex = section.indexOf(pathLine);
  const sectionText = section.join("\n");
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    lines.filter((line) => line === pathLine).length !== 1 ||
    lines.filter((line) => line === shaLine).length !== 1 ||
    !sectionText.includes("N-034 becomes `TESTED` for the selected Web–React production profile") ||
    !sectionText.includes("N-033 remains `TESTED`") ||
    sectionText.includes(PENDING_ARTIFACT_SHA256)
  ) {
    fail(
      "INTERACTIONS_PROOF_PIN_DRIFT",
      "The M05-T04 Proof Matrix section pin or task-time normative claim moved or drifted.",
    );
  }

  const historicalPin = `\`${ARTIFACT_FILE_NAME}\` \`sha256:${HISTORICAL_ARTIFACT_SHA256}\``;
  const p05 = exactRow(markdown, "P-05");
  const statusRank = Object.freeze({ NOT_PROVEN: 0, PARTIAL: 1, PROVEN: 2 });
  const currentRank = statusRank[p05.cells[3]];
  if (
    p05.cells[0] !== "P-05" ||
    !p05.cells[2].includes("M05-T04") ||
    currentRank === undefined ||
    currentRank < statusRank.PARTIAL ||
    p05.line.split(historicalPin).length !== 2 ||
    p05.line.includes(PENDING_ARTIFACT_SHA256)
  ) {
    fail("INTERACTIONS_PROOF_PIN_DRIFT", "P-05 lost its immutable M05-T04 task-time authority.");
  }

  const p06 = exactRow(markdown, "P-06");
  if (
    p06.cells[0] !== "P-06" ||
    p06.cells[3] !== P06_CURRENT_STATUS ||
    !p06.cells[2].includes("M05-T04") ||
    p06.line.split(historicalPin).length !== 2 ||
    p06.line.includes(PENDING_ARTIFACT_SHA256)
  ) {
    fail(
      "INTERACTIONS_PROOF_PIN_DRIFT",
      "The exact P-06 M05-T04 artifact pin or historical status drifted.",
    );
  }
}

function verifyNormativeCoverage(markdown) {
  const n033 = exactRow(markdown, "N-033");
  const n034 = exactRow(markdown, "N-034");
  const pin = `\`${ARTIFACT_RELATIVE_PATH}\` \`sha256:${HISTORICAL_ARTIFACT_SHA256}\``;
  if (
    n033.cells[0] !== "N-033" ||
    n033.cells[4] !== "TESTED" ||
    !n033.cells[3].includes("M05-T04") ||
    !n033.line.includes(pin) ||
    n033.line.includes(PENDING_ARTIFACT_SHA256) ||
    n034.cells[0] !== "N-034" ||
    n034.cells[4] !== "TESTED" ||
    !n034.cells[3].includes("M05-T04") ||
    !n034.line.includes("TextField `focus`") ||
    n034.line.includes(PENDING_ARTIFACT_SHA256)
  ) {
    fail(
      "INTERACTIONS_PROOF_PIN_DRIFT",
      "The exact N-033/N-034 M05-T04 normative pin or task-time status drifted.",
    );
  }
}

function countOccurrences(text, token) {
  return text.split(token).length - 1;
}

function verifyDocumentation(proofText, matrixText, normativeText) {
  verifyProofDocument(proofText);
  verifyProofMatrix(matrixText);
  verifyNormativeCoverage(normativeText);

  const documents = [proofText, matrixText, normativeText];
  const artifactReferences = documents.reduce(
    (count, document) => count + countOccurrences(document, ARTIFACT_FILE_NAME),
    0,
  );
  const shaReferences = documents.reduce(
    (count, document) => count + countOccurrences(document, `sha256:${HISTORICAL_ARTIFACT_SHA256}`),
    0,
  );
  if (artifactReferences !== 5 || shaReferences !== 5) {
    fail(
      "INTERACTIONS_PROOF_PIN_DRIFT",
      "The immutable M05-T04 artifact must have exactly five matching documentation references.",
      {
        expected: 5,
        artifactReferences,
        shaReferences,
      },
    );
  }
}

function summarizeEvidence(built) {
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: HISTORICAL_ARTIFACT_BYTES,
    compatibilityMode: COMPATIBILITY_MODE,
    runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
    typeExports: EXPECTED_RUNTIME_TYPE_EXPORTS.length,
    runtimeReactDeclarations: EXPECTED_TESTS.runtimeReactDeclarations,
    runtimeReactExecutedCases: EXPECTED_TESTS.runtimeReactExecutedCases,
    referenceAdapterTests: EXPECTED_TESTS.referenceAdapterTests,
    runtimeCoreCommandTests: EXPECTED_TESTS.runtimeCoreCommandTests,
    compilerNegativeCases: EXPECTED_TESTS.compilerNegativeCases.total,
    rootMutationTests: EXPECTED_TESTS.rootMutationTests,
    trackedFiles: 114,
    compatibilityPaths: EXPECTED_COMPATIBILITY_PATHS.length,
    p06CurrentStatus: P06_CURRENT_STATUS,
    normativeStatus: "N-034:TESTED",
    exactDocumentationReferences: 5,
  });
}

/**
 * Reads only the exact immutable M05-T04 task-time artifact and reviewed semantic inventory.
 *
 * @remarks Current React/runtime source, generated output, package exports, prerequisites, build
 * products, and injected execution APIs can never be reinterpreted as historical M05-T04 evidence.
 */
export async function buildRuntimeReactInteractionsEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = optionalBuffer(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      "Historical M05-T04 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const authority = await readCheckpointedFrozenArtifact("M05-T04");
  if (
    authority.path !== ARTIFACT_RELATIVE_PATH ||
    authority.byteLength !== HISTORICAL_ARTIFACT_BYTES ||
    authority.sha256 !== HISTORICAL_ARTIFACT_SHA256
  ) {
    fail(
      "INTERACTIONS_ARTIFACT_DRIFT",
      "The checkpoint-authenticated M05-T04 artifact identity drifted.",
    );
  }
  const historicalBytes =
    injectedBytes ??
    (artifactPath === undefined
      ? authority.bytes
      : await readRegularFile(
          artifactPath,
          "INTERACTIONS_ARTIFACT_MISSING",
          "INTERACTIONS_ARTIFACT_UNSAFE",
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

/** Verifies immutable M05-T04 bytes, semantics, inventory, and exact historical documentation. */
export async function verifyRuntimeReactInteractionsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofDocumentText",
      "proofMatrixText",
      "normativeCoverageText",
      "proofPath",
      "proofMatrixPath",
      "normativeCoveragePath",
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
  const normativeCoverageText = optionalBoundedText(
    options.normativeCoverageText,
    "normativeCoverageText",
    MAX_NORMATIVE_COVERAGE_BYTES,
  );
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const normativeCoveragePath = optionalString(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  if (artifactPath !== undefined && injectedBytes !== undefined) {
    fail(
      "INTERACTIONS_OPTIONS_INVALID",
      "Historical M05-T04 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }

  const built = await buildRuntimeReactInteractionsEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const [proofText, matrixText, normativeText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_PATH,
        "INTERACTIONS_PROOF_MISSING",
        "INTERACTIONS_PROOF_UNSAFE",
        MAX_PROOF_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_PROOF_MATRIX_PATH,
        "INTERACTIONS_PROOF_MISSING",
        "INTERACTIONS_PROOF_UNSAFE",
        MAX_PROOF_MATRIX_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    normativeCoverageText ??
      readRegularFile(
        normativeCoveragePath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_NORMATIVE_COVERAGE_PATH,
        "INTERACTIONS_PROOF_MISSING",
        "INTERACTIONS_PROOF_UNSAFE",
        MAX_NORMATIVE_COVERAGE_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation(proofText, matrixText, normativeText);
  return summarizeEvidence(built);
}

/** Atomically copies only exact already-authenticated immutable M05-T04 task-time bytes. */
export async function writeRuntimeReactInteractionsEvidence(rawOptions = undefined) {
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
      "INTERACTIONS_OPTIONS_INVALID",
      "Historical M05-T04 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }

  const built = await buildRuntimeReactInteractionsEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const requestedPath = destinationPath ?? DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH;
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedPath),
      canonicalDestinationPath(DEFAULT_RUNTIME_REACT_INTERACTIONS_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail("INTERACTIONS_ARTIFACT_UNSAFE", "M05-T04 compatibility destination is unsafe.", {
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
    fail("INTERACTIONS_ARTIFACT_UNSAFE", "Atomic M05-T04 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    ...summarizeEvidence(built),
    artifactPath,
  });
}
