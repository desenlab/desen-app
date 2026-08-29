import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb";
const HISTORICAL_ARTIFACT_BYTES = 19_234;
const SUCCESSOR_ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/publisher-0.1.0-source-preservation.json";
const SUCCESSOR_ARTIFACT_SHA256 =
  "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff";
const LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/publisher-0.1.0-source-normalization.json";
const LATEST_SUCCESSOR_ARTIFACT_SHA256 =
  "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e";
const N021_CURRENT_OWNERS = "M05-T05, M06-T06–M06-T07";
const N021_CURRENT_STATUS = "TESTED";
const N021_CURRENT_EVIDENCE = [
  "M05-T05 proves the selected Web–React runtime side.",
  "M06-T06 completes the Publisher preservation slice with unchanged prepared behavior and one complete bounded five-string component-node trace.",
  "M06-T07 carries that exact behavior and every trace record unchanged through digest calculation, root-authoring removal, and deterministic normalization; exact pointers remain resolvable in the normalized document and no extension or authoring node gains trace authority.",
  `Evidence: \`${ARTIFACT_RELATIVE_PATH}\` \`sha256:${HISTORICAL_ARTIFACT_SHA256}\`; \`${SUCCESSOR_ARTIFACT_RELATIVE_PATH}\` \`sha256:${SUCCESSOR_ARTIFACT_SHA256}\`; \`${LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH}\` \`sha256:${LATEST_SUCCESSOR_ARTIFACT_SHA256}\`.`,
].join(" ");
const PROOF_STATUS_RANK = Object.freeze({ NOT_PROVEN: 0, PARTIAL: 1, PROVEN: 2 });
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const MAX_PROOF_DOCUMENT_BYTES = 500_000;
const MAX_LEDGER_BYTES = 2_000_000;
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

/** Absolute path to the immutable task-time M05-T05 proof artifact. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the immutable M05-T05 human-readable proof. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact M05-T05 Proof Matrix pins. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

/** Absolute path to the exact M05-T05 normative pin. */
export const DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T06",
    path: "docs/proof/artifacts/runtime-core-0.1.0-local-state-identity.json",
    sha256: "sha256:4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
    target: "platform-neutral",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T07",
    path: "docs/proof/artifacts/runtime-core-0.1.0-repeat-materialization.json",
    sha256: "sha256:45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
    target: "platform-neutral",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    profile: "desen-runtime-react-interactions-v1",
    target: "web-react",
    result: "PASS",
  }),
]);

const EXPECTED_CLAIM = Object.freeze({
  liveSessionSubscriptionCommitOnly: true,
  stableSnapshotAndCompatibleAdapterReferences: true,
  reconciliationIdentityIncludesRuntimeNodeAndCapability: true,
  trustedRemountPolicyPresenceAware: true,
  rfc8785CanonicalRemountProjection: true,
  realComponentBehaviorAndRepeatReconciliation: true,
  boundedCallbackFreeImmutableDiagnosticIndex: true,
  staleManagedSurfaceRetainedOnFailure: false,
  unknownCapabilityOrRenderFallback: false,
  committedAdapterErrorBoundaryImplemented: false,
});

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T05",
  result: "PASS",
  profile: "desen-runtime-react-reconciliation-diagnostics-v1",
  protocol: "0.1.0",
  target: "web-react",
  claim: EXPECTED_CLAIM,
  reconciliationProfile: "desen.runtime-react/reconciliation-key@0.1.0",
  reconciliationIdentityFields: Object.freeze(["runtimeNodeId", "capabilityId"]),
  remountPolicyOwner: "trusted-static-adapter-registry",
  missingAndPresentNullAreDistinct: true,
  sessionAndRegistryRootIsolation: "nested-weakly-keyed-stable-boundary-component",
  diagnosticLimits: Object.freeze({
    maxBindings: 25_000,
    maxIdentifierOccurrences: 115_000,
    maxIdentifierCodeUnits: 4_194_304,
  }),
  repeatedSourceIdentityOneToMany: true,
  diagnosticCallbackFields: 0,
  diagnosticAuthorityFields: 0,
  runtimeExports: 10,
  typeExports: 51,
  publicRootDeclarations: 61,
  sourceDeclarations: 67,
  tsdocDeclarations: 67,
  moduleOnlyExports: 6,
  renderFailureCodes: 25,
  unknownCapabilityPlaceholderGuessing: false,
  committedAdapterExceptionContainment: false,
  trackedFiles: 29,
  packageRegistrations: 53,
  compilerNegativeCases: 26,
  rootMutationCases: 35,
  proofClaim: Object.freeze({
    id: "P-16",
    historicalStatus: "NOT_PROVEN",
    currentStatus: "PARTIAL",
  }),
  normative: Object.freeze({
    id: "N-021",
    historicalStatus: "PLANNED",
    currentStatus: "PLANNED",
    remainingOwner: "M06-T06",
  }),
  nonclaims: 5,
});

/** Controlled compatibility-reader failure for immutable M05-T05 evidence. */
export class RuntimeReactReconciliationDiagnosticsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactReconciliationDiagnosticsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactReconciliationDiagnosticsEvidenceError(code, message, details);
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
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} options must be a plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `Historical M05-T05 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `Historical M05-T05 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} must be a non-empty string.`,
    );
  }
  return value;
}

function optionalText(value, label, maximumBytes) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > maximumBytes) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} must be non-shared non-Proxy bytes.`,
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
        "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
        `Historical M05-T05 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError) throw error;
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} must not use shared backing memory.`,
    );
  }

  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      `Historical M05-T05 ${label} backing memory is detached or invalid.`,
    );
  }
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
    fail(missingCode, `Historical M05-T05 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(unsafeCode, `Historical M05-T05 evidence must be a regular file: ${filePath}.`);
  }
  if (entry.size > maximumBytes || (exactBytes !== undefined && entry.size !== exactBytes)) {
    fail(unsafeCode, `Historical M05-T05 evidence has an invalid byte size: ${filePath}.`);
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
      fail(unsafeCode, `Historical M05-T05 evidence changed identity while opening: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes || (exactBytes !== undefined && bytes.length !== exactBytes)) {
      fail(unsafeCode, `Historical M05-T05 evidence has an invalid byte size: ${filePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError) throw error;
    fail(unsafeCode, `Historical M05-T05 evidence could not be read safely: ${filePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function artifactSemantics(artifact) {
  return {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.protocol,
    target: artifact.target,
    claim: artifact.claim,
    reconciliationProfile: artifact.reconciliation?.profile,
    reconciliationIdentityFields: artifact.reconciliation?.identityFields,
    remountPolicyOwner: artifact.reconciliation?.remountPolicyOwner,
    missingAndPresentNullAreDistinct: artifact.reconciliation?.missingAndPresentNullAreDistinct,
    sessionAndRegistryRootIsolation: artifact.liveSurface?.sessionAndRegistryRootIsolation,
    diagnosticLimits: artifact.diagnostics?.limits,
    repeatedSourceIdentityOneToMany: artifact.diagnostics?.repeatedSourceIdentityOneToMany,
    diagnosticCallbackFields: artifact.diagnostics?.callbackFields,
    diagnosticAuthorityFields:
      artifact.diagnostics?.propsStyleSlotsReactSessionCatalogRegistryFields,
    runtimeExports: artifact.publicApi?.runtimeExports?.length,
    typeExports: artifact.publicApi?.typeExports?.length,
    publicRootDeclarations: artifact.publicApi?.publicRootDeclarations,
    sourceDeclarations: artifact.publicApi?.sourceDeclarations,
    tsdocDeclarations: artifact.publicApi?.tsdocDeclarations,
    moduleOnlyExports: artifact.publicApi?.moduleOnlyExports?.length,
    renderFailureCodes: artifact.failureBoundary?.renderFailureCodes?.length,
    unknownCapabilityPlaceholderGuessing:
      artifact.failureBoundary?.unknownCapabilityPlaceholderGuessing,
    committedAdapterExceptionContainment:
      artifact.failureBoundary?.committedAdapterExceptionContainment,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    packageRegistrations: artifact.evidence?.tests?.packageRegistrations,
    compilerNegativeCases: artifact.evidence?.tests?.compilerNegativeCases,
    rootMutationCases: artifact.evidence?.tests?.rootMutationCases,
    proofClaim: artifact.evidence?.traceability?.proofClaim,
    normative: artifact.evidence?.traceability?.normative,
    nonclaims: artifact.nonclaims?.length,
  };
}

function inspectHistoricalArtifact(bytes) {
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T05 artifact byte length changed.",
      { expected: HISTORICAL_ARTIFACT_BYTES, actual: bytes.length },
    );
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T05 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "RECONCILIATION_DIAGNOSTICS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T05 artifact is not valid JSON.",
    );
  }
  const actual = artifactSemantics(artifact);
  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((entry) => entry?.path);
  const trackedPathsValid =
    new Set(trackedPaths).size === trackedPaths.length &&
    trackedFiles.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof entry.path === "string" &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0 &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.sha256),
    );
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    !trackedPathsValid ||
    artifact.reconciliation?.ordinaryPropStyleAndSlotChangesPreserveInstance !== true ||
    artifact.reconciliation?.capabilityChangeRemounts !== true ||
    artifact.reconciliation?.behaviorPolicyParity !== true ||
    artifact.reconciliation?.repeatReorderPreservesMaterializedRuntimeIdentity !== true ||
    artifact.reconciliation?.sessionSwitchRemountsManagedRoot !== true ||
    artifact.liveSurface?.observation !== "React.useSyncExternalStore" ||
    artifact.liveSurface?.subscriptionAdmission !== "commit-only" ||
    artifact.liveSurface?.previousSurfaceRetainedOnTerminalOrRenderFailure !== false ||
    artifact.diagnostics?.recursivelyImmutable !== true ||
    artifact.diagnostics?.partialIndexOnFailure !== false ||
    artifact.failureBoundary?.committedAdapterExceptionContainmentOwner !== "M05-T06" ||
    artifact.boundary?.package !== "@desen/runtime-react" ||
    artifact.boundary?.reactPeerRange !== ">=19.0.0 <20.0.0" ||
    artifact.evidence?.dynamicExecutableImports !== 0 ||
    artifact.evidence?.proofPinNormalization?.exactReferenceCount !== 4 ||
    artifact.evidence?.verifierExecutionProfile !==
      "static-source-api-package-and-focused-test-inventory"
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T05 artifact lost its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return freezeJson(artifact);
}

function sectionLines(markdown, heading, code) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) fail(code, `Expected one exact ${heading} section.`);
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start, end === -1 ? lines.length : end);
}

function exactRow(markdown, id, code) {
  const rows = markdown.split(/\r?\n/u).filter((line) => line.startsWith(`| ${id} `));
  if (rows.length !== 1) fail(code, `Expected one exact ${id} row.`);
  return rows[0];
}

function verifyLocationPin(lines, artifactPath, artifactSha256, code) {
  const section = lines.join("\n");
  const pathToken = `\`${artifactPath}\``;
  const shaToken = `\`sha256:${artifactSha256}\``;
  const pathReferences = section.split(pathToken).length - 1;
  const shaReferences = section.split(shaToken).length - 1;
  if (pathReferences !== 1 || shaReferences !== 1) {
    fail(code, `${artifactPath} or its exact SHA moved, changed, or became ambiguous.`);
  }
}

function verifyDocumentation(proofText, matrixText, normativeText) {
  verifyLocationPin(
    sectionLines(proofText, "## Evidence artifact", "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    ARTIFACT_RELATIVE_PATH,
    HISTORICAL_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
  verifyLocationPin(
    sectionLines(matrixText, "## M05-T05", "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    ARTIFACT_FILE_NAME,
    HISTORICAL_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
  const p16 = exactRow(matrixText, "P-16", "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT");
  const p16Cells = p16.split("|").map((cell) => cell.trim());
  const historicalP16Status = EXPECTED_SEMANTICS.proofClaim.currentStatus;
  const currentP16Rank = PROOF_STATUS_RANK[p16Cells[4]];
  if (
    p16Cells[3] !== "M05-T05, M09-T13" ||
    currentP16Rank === undefined ||
    currentP16Rank < PROOF_STATUS_RANK[historicalP16Status]
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      "P-16 regressed below its immutable M05-T05 partial-proof authority.",
    );
  }
  verifyLocationPin(
    [p16],
    ARTIFACT_FILE_NAME,
    HISTORICAL_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
  const n021 = exactRow(normativeText, "N-021", "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT");
  const n021Cells = n021.split("|").map((cell) => cell.trim());
  const historicalStatus = EXPECTED_SEMANTICS.normative.currentStatus;
  const statusRank = Object.freeze({ PLANNED: 0, TESTED: 1 });
  const currentRank = statusRank[n021Cells[5]];
  if (
    n021Cells[4] !== N021_CURRENT_OWNERS ||
    currentRank === undefined ||
    currentRank < statusRank[historicalStatus] ||
    n021Cells[5] !== N021_CURRENT_STATUS ||
    n021Cells[6] !== N021_CURRENT_EVIDENCE
  ) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
      "N-021 lost its exact monotonic M05-T05/M06-T07 successor closure.",
    );
  }
  verifyLocationPin(
    [n021],
    ARTIFACT_RELATIVE_PATH,
    HISTORICAL_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
  verifyLocationPin(
    [n021],
    SUCCESSOR_ARTIFACT_RELATIVE_PATH,
    SUCCESSOR_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
  verifyLocationPin(
    [n021],
    LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH,
    LATEST_SUCCESSOR_ARTIFACT_SHA256,
    "RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT",
  );
}

/**
 * Reads exact immutable M05-T05 evidence without consulting current successor source or tests.
 */
export async function buildRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  if (options.artifactPath !== undefined && options.artifactBytes !== undefined) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      "Historical M05-T05 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH;
  const injectedBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const historicalBytes =
    injectedBytes ??
    (await readRegularFile(
      artifactPath,
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_MISSING",
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE",
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

/** Verifies immutable M05-T05 bytes, reviewed semantics, inventory, and exact proof pins. */
export async function verifyRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "normativeCoveragePath",
      "normativeCoverageText",
    ],
    "verify",
  );
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      "Historical M05-T05 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(
    options.proofDocumentText,
    "proofDocumentText",
    MAX_PROOF_DOCUMENT_BYTES,
  );
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(
    options.proofMatrixText,
    "proofMatrixText",
    MAX_LEDGER_BYTES,
  );
  const normativeCoveragePath = optionalString(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  const normativeCoverageText = optionalText(
    options.normativeCoverageText,
    "normativeCoverageText",
    MAX_LEDGER_BYTES,
  );
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const [proofText, matrixText, normativeText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        MAX_PROOF_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_PROOF_MATRIX_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        MAX_LEDGER_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    normativeCoverageText ??
      readRegularFile(
        normativeCoveragePath ??
          DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_NORMATIVE_COVERAGE_PATH,
        "RECONCILIATION_DIAGNOSTICS_PROOF_MISSING",
        "RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE",
        MAX_LEDGER_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation(proofText, matrixText, normativeText);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    compatibilityMode: COMPATIBILITY_MODE,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    runtimeExports: EXPECTED_SEMANTICS.runtimeExports,
    typeExports: EXPECTED_SEMANTICS.typeExports,
    sourceDeclarations: EXPECTED_SEMANTICS.sourceDeclarations,
    tsdocDeclarations: EXPECTED_SEMANTICS.tsdocDeclarations,
    packageTests: EXPECTED_SEMANTICS.packageRegistrations,
    compilerNegativeCases: EXPECTED_SEMANTICS.compilerNegativeCases,
    rootMutationCases: EXPECTED_SEMANTICS.rootMutationCases,
    p16Status: EXPECTED_SEMANTICS.proofClaim.currentStatus,
    n021HistoricalStatus: EXPECTED_SEMANTICS.normative.currentStatus,
    n021CurrentStatus: N021_CURRENT_STATUS,
    n021SuccessorArtifactSha256: SUCCESSOR_ARTIFACT_SHA256,
    n021LatestArtifactSha256: LATEST_SUCCESSOR_ARTIFACT_SHA256,
    exactDocumentationReferences: 4,
    exactSuccessorDocumentationReferences: 2,
  });
}

/** Atomically copies only exact already-authenticated immutable M05-T05 task-time bytes. */
export async function writeRuntimeReactReconciliationDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (sourceArtifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID",
      "Historical M05-T05 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const destinationPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactReconciliationDiagnosticsEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  if (
    sourceArtifactPath === undefined &&
    artifactBytes === undefined &&
    path.resolve(destinationPath) ===
      path.resolve(DEFAULT_RUNTIME_REACT_RECONCILIATION_DIAGNOSTICS_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      result: built.artifact.result,
      artifactPath: path.resolve(destinationPath),
      artifactSha256: built.artifactSha256,
      trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
      packageTests: EXPECTED_SEMANTICS.packageRegistrations,
      compilerNegativeCases: EXPECTED_SEMANTICS.compilerNegativeCases,
      rootMutationCases: EXPECTED_SEMANTICS.rootMutationCases,
      compatibilityMode: COMPATIBILITY_MODE,
      preserved: true,
    });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE",
      "Atomic M05-T05 compatibility write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(destinationPath),
    artifactSha256: built.artifactSha256,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    packageTests: EXPECTED_SEMANTICS.packageRegistrations,
    compilerNegativeCases: EXPECTED_SEMANTICS.compilerNegativeCases,
    rootMutationCases: EXPECTED_SEMANTICS.rootMutationCases,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}
