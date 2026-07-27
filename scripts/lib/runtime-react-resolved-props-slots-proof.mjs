import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RESOLVED-PROPS-SLOTS.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";

/** Absolute path to the immutable task-time M05-T02 receiving-boundary artifact. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable immutable M05-T02 proof. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact immutable M05-T02 Proof Matrix pin. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
  "RUNTIME_REACT_RENDER_LIMITS",
  "createRuntimeReactAdapterRegistry",
  "readRuntimeReactAdapterRegistry",
  "renderRuntimeReactSurface",
]);

const EXPECTED_TYPE_EXPORTS = Object.freeze([
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
]);

const EXPECTED_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
  "DUPLICATE_RUNTIME_IDENTITY",
  "INVALID_BEHAVIOR_PROPS",
  "INVALID_BEHAVIOR_SLOTS",
  "INVALID_CATALOG_SET",
  "INVALID_COMPONENT_PROPS",
  "INVALID_COMPONENT_SLOTS",
  "INVALID_REGISTRY",
  "INVALID_SESSION",
  "INVALID_SESSION_SNAPSHOT",
  "JSON_DEPTH_LIMIT_EXCEEDED",
  "JSON_OCCURRENCE_LIMIT_EXCEEDED",
  "MALFORMED_RENDER_PLAN",
  "NODE_LIMIT_EXCEEDED",
  "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
  "SLOT_LIMIT_EXCEEDED",
  "STRING_LIMIT_EXCEEDED",
  "UNKNOWN_BEHAVIOR_CAPABILITY",
  "UNKNOWN_COMPONENT_CAPABILITY",
]);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M02-T11",
    path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
    profile: "desen-execution-contract-validation-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T17",
    gate: "G04",
    path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    sha256: "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
    profile: "desen-runtime-core-audit-hardening-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T01",
    path: "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json",
    sha256: "b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42",
    profile: "desen-runtime-react-adapter-registry-v1",
    result: "PASS",
  }),
]);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T02",
  result: "PASS",
  profile: "desen-runtime-react-resolved-props-slots-v1",
  protocol: "0.1.0",
  target: "web-react",
  runtimeExports: EXPECTED_RUNTIME_EXPORTS,
  typeExports: EXPECTED_TYPE_EXPORTS,
  sourceDeclarations: 36,
  tsdocDeclarations: 36,
  failureCodes: EXPECTED_FAILURE_CODES,
  trackedFiles: 109,
  runtimeReactTests: 12,
  validatorTests: 20,
  runtimeCoreTests: 6,
  runtimeCoreFileTests: 35,
  schemaEvaluatorTests: 37,
  compilerNegativeCases: 33,
  rootMutationTests: 14,
  transferredOwnership: 35,
});

/** Controlled compatibility-verifier failure for immutable M05-T02 evidence. */
export class RuntimeReactResolvedPropsSlotsEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactResolvedPropsSlotsEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactResolvedPropsSlotsEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      `Historical M05-T02 ${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      `Historical M05-T02 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      `Historical M05-T02 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
        `Historical M05-T02 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
        `Historical M05-T02 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function readRegularFile(filePath, missingCode, unsafeCode) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(missingCode, `Historical M05-T02 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      unsafeCode,
      `Historical M05-T02 evidence must be a regular non-symlink file: ${filePath}.`,
    );
  }
  return readFile(filePath);
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "RESOLVED_PROPS_SLOTS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T02 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "RESOLVED_PROPS_SLOTS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T02 artifact is not valid JSON.",
    );
  }

  const actual = {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.claim?.protocol,
    target: artifact.claim?.target,
    runtimeExports: artifact.publicApi?.runtimeExports,
    typeExports: artifact.publicApi?.typeExports,
    sourceDeclarations: artifact.publicApi?.sourceDeclarations,
    tsdocDeclarations: artifact.publicApi?.tsdocDeclarations,
    failureCodes: artifact.failureModel?.codes,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    runtimeReactTests: artifact.evidence?.tests?.runtimeReactTests,
    validatorTests: artifact.evidence?.tests?.validatorTests,
    runtimeCoreTests: artifact.evidence?.tests?.runtimeCoreTests,
    runtimeCoreFileTests: artifact.evidence?.tests?.runtimeCoreFileTests,
    schemaEvaluatorTests: artifact.evidence?.tests?.schemaEvaluatorTests,
    compilerNegativeCases: artifact.evidence?.tests?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.tests?.rootMutationTests,
    transferredOwnership: artifact.historicalCompatibility?.transferredOwnership?.length,
  };
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    artifact.claim?.resolvedPropsReceivingBoundary !== true ||
    artifact.claim?.authenticatedNamedSlots !== true ||
    artifact.claim?.rawPlanAuthority !== false ||
    artifact.claim?.privateStructureInspection !== false ||
    artifact.catalogAuthority?.exactExecutionCatalogSetIdentity !== true ||
    artifact.catalogAuthority?.rawMountReturnsExactRetainedCatalogSet !== true ||
    artifact.catalogAuthority?.lowerStageCatalogAccepted !== false ||
    artifact.catalogAuthority?.structurallyEqualCatalogAccepted !== false ||
    artifact.sessionAuthority?.exactLiveSnapshotIdentity !== true ||
    artifact.receivingBudget?.oneFactoryAuthenticatedScopePerRender !== true ||
    artifact.receivingBudget?.nonResettingPreparedSchemaBudget !== true ||
    artifact.receivingBudget?.actualSchemaInterpreterWorkBudgeted !== true ||
    artifact.receivingBudget?.preparedSlotContractsBudgeted !== true ||
    artifact.props?.componentValidationMode !== "complete/resolved-value" ||
    artifact.props?.behaviorValidationMode !== "complete/resolved-value" ||
    artifact.props?.invalidValueDeliveredToAdapter !== false ||
    artifact.namedSlots?.exactNamesAndOrderPreserved !== true ||
    artifact.namedSlots?.fallbackGuessing !== 0 ||
    artifact.failureModel?.allOrNothingPreflight !== true ||
    artifact.architecture?.browserDomNativeAuthorities !== 0 ||
    artifact.architecture?.dynamicExecutableLoading !== 0 ||
    artifact.architecture?.privateReactInspection !== 0 ||
    artifact.traceability?.task?.id !== "M05-T02" ||
    artifact.traceability?.task?.status !== "DONE" ||
    artifact.traceability?.task?.prerequisite !== "M05-T01" ||
    artifact.historicalCompatibility?.compatibilityMode !== "immutable-task-time-artifact"
  ) {
    fail(
      "RESOLVED_PROPS_SLOTS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T02 artifact no longer has its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return Object.freeze(artifact);
}

function verifyExactPin(markdown, heading, artifactPath, artifactSha256, code, suffix = "") {
  const lines = markdown.split(/\r?\n/u);
  const headingIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headingIndexes.length !== 1) fail(code, `Expected one exact ${heading} section.`);
  const start = headingIndexes[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next === -1 ? lines.length : next;
  const section = lines.slice(start, end);
  const pathLine = `\`${artifactPath}\``;
  const shaLine = `\`sha256:${artifactSha256}\`${suffix}`;
  const pathIndex = section.indexOf(pathLine);
  const globalPaths = lines.filter((line) => line.includes(artifactPath));
  const globalShas = lines.filter((line) => line.includes(`sha256:${artifactSha256}`));
  const semanticShas = section.filter((line) =>
    line.trimStart().replaceAll("`", "").startsWith("sha256:"),
  );
  if (
    pathIndex < 0 ||
    section[pathIndex + 1] !== shaLine ||
    globalPaths.length !== 1 ||
    globalShas.length !== 1 ||
    semanticShas.length !== 1
  ) {
    fail(code, `${heading} artifact path or SHA moved, changed, or became ambiguous.`);
  }
}

function verifyDocumentation(proofText, matrixText) {
  verifyExactPin(
    proofText,
    "## Evidence artifact",
    ARTIFACT_RELATIVE_PATH,
    HISTORICAL_ARTIFACT_SHA256,
    "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
    ".",
  );
  verifyExactPin(
    matrixText,
    "## M05-T02",
    path.basename(ARTIFACT_RELATIVE_PATH),
    HISTORICAL_ARTIFACT_SHA256,
    "RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT",
    ".",
  );
}

function artifactBytes(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      `Historical M05-T02 ${label} must be a non-Proxy Buffer.`,
    );
  }
  return Buffer.from(value);
}

function optionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    fail("RESOLVED_PROPS_SLOTS_OPTIONS_INVALID", `Historical M05-T02 ${label} must be a string.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "RESOLVED_PROPS_SLOTS_OPTIONS_INVALID",
      `Historical M05-T02 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

/**
 * Reads and validates the exact immutable M05-T02 task-time artifact.
 *
 * @remarks M05-T03 owns all current semantic-style renderer verification. This compatibility
 * builder deliberately never reinterprets successor source as task-time T02 evidence.
 */
export async function buildRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const resolvedArtifactPath =
    artifactPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH;
  const historicalBytes =
    injectedBytes === undefined
      ? await readRegularFile(
          resolvedArtifactPath,
          "RESOLVED_PROPS_SLOTS_ARTIFACT_MISSING",
          "RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE",
        )
      : injectedBytes;
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M05-T02 bytes, reviewed semantics, inventory, and exact documentation pins. */
export async function verifyRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
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
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const proofDocumentText = optionalString(options.proofDocumentText, "proofDocumentText");
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const built = await buildRuntimeReactResolvedPropsSlotsEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const [proofText, matrixText] = await Promise.all([
    proofDocumentText ??
      readFile(proofPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_PROOF_PATH, "utf8"),
    proofMatrixText ??
      readFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_PROOF_MATRIX_PATH,
        "utf8",
      ),
  ]);
  verifyDocumentation(proofText, matrixText);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: EXPECTED_RUNTIME_EXPORTS.length,
    typeExports: EXPECTED_TYPE_EXPORTS.length,
    sourceDeclarations: EXPECTED_SEMANTICS.sourceDeclarations,
    tsdocDeclarations: EXPECTED_SEMANTICS.tsdocDeclarations,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    failureCodes: EXPECTED_FAILURE_CODES.length,
    packageTests:
      EXPECTED_SEMANTICS.runtimeReactTests +
      EXPECTED_SEMANTICS.validatorTests +
      EXPECTED_SEMANTICS.runtimeCoreTests,
    compilerNegativeCases: EXPECTED_SEMANTICS.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.rootMutationTests,
  });
}

/** Atomically copies only exact already-validated immutable M05-T02 task-time bytes. */
export async function writeRuntimeReactResolvedPropsSlotsEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactResolvedPropsSlotsEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const artifactPath = destinationPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH;
  if (
    path.resolve(artifactPath) ===
    path.resolve(DEFAULT_RUNTIME_REACT_RESOLVED_PROPS_SLOTS_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
      artifactSha256: built.artifactSha256,
      result: built.artifact.result,
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
      "RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE",
      "Atomic M05-T02 compatibility write failed safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({
    artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
    artifactSha256: built.artifactSha256,
    result: built.artifact.result,
  });
}
