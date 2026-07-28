import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-RESOLVED-STYLES.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";

/** Absolute path to the immutable task-time M05-T03 semantic-style artifact. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable immutable M05-T03 proof. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact immutable M05-T03 Proof Matrix pin. */
export const DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_PROOF_MATRIX_PATH = path.join(
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
  "RuntimeReactStyleParts",
  "RuntimeReactStyleProperties",
]);

const EXPECTED_VALIDATOR_STYLE_TYPE_EXPORTS = Object.freeze([
  "DesenResolvedAdapterStyle",
  "DesenResolvedAdapterStyleParts",
  "DesenResolvedAdapterStyleProperties",
  "DesenResolvedAdapterStyleValidationResult",
]);

const EXPECTED_FAILURE_CODES = Object.freeze([
  "BEHAVIOR_LIMIT_EXCEEDED",
  "DEPTH_LIMIT_EXCEEDED",
  "DUPLICATE_RUNTIME_IDENTITY",
  "INVALID_BEHAVIOR_PROPS",
  "INVALID_BEHAVIOR_SLOTS",
  "INVALID_BEHAVIOR_STYLE",
  "INVALID_CATALOG_SET",
  "INVALID_COMPONENT_PROPS",
  "INVALID_COMPONENT_SLOTS",
  "INVALID_COMPONENT_STYLE",
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
    task: "M02-T08",
    path: "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
    sha256: "71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac",
    profile: "desen-component-contract-validation-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T05",
    path: "docs/proof/artifacts/runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T02",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json",
    sha256: "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    profile: "desen-runtime-react-resolved-props-slots-v1",
    result: "PASS",
  }),
]);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T03",
  result: "PASS",
  profile: "desen-runtime-react-resolved-styles-v1",
  protocol: "0.1.0",
  target: "web-react",
  runtimeExports: EXPECTED_RUNTIME_EXPORTS,
  typeExports: EXPECTED_TYPE_EXPORTS,
  validatorStyleTypeExports: EXPECTED_VALIDATOR_STYLE_TYPE_EXPORTS,
  sourceDeclarations: 38,
  tsdocDeclarations: 38,
  failureCodes: EXPECTED_FAILURE_CODES,
  failureChannels: Object.freeze(["null", "props", "slots", "style"]),
  trackedFiles: 55,
  runtimeReactTests: 8,
  validatorStyleTests: 3,
  runtimeReactCompilerNegativeCases: 6,
  validatorCompilerNegativeCases: 9,
  compilerNegativeCases: 15,
  rootMutationTests: 18,
  transferredOwnership: Object.freeze([
    "scripts/lib/runtime-react-resolved-props-slots-proof.mjs",
    "tests/runtime-react-resolved-props-slots.test.mjs",
  ]),
});

/** Controlled compatibility-verifier failure for immutable M05-T03 evidence. */
export class RuntimeReactResolvedStylesEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactResolvedStylesEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactResolvedStylesEvidenceError(code, message, details);
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
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `Historical M05-T03 ${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `Historical M05-T03 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `Historical M05-T03 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "RESOLVED_STYLES_OPTIONS_INVALID",
        `Historical M05-T03 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "RESOLVED_STYLES_OPTIONS_INVALID",
        `Historical M05-T03 ${label} option ${key} must be enumerable own data.`,
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
    fail(missingCode, `Historical M05-T03 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      unsafeCode,
      `Historical M05-T03 evidence must be a regular non-symlink file: ${filePath}.`,
    );
  }
  return readFile(filePath);
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "RESOLVED_STYLES_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T03 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "RESOLVED_STYLES_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T03 artifact is not valid JSON.",
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
    validatorStyleTypeExports: artifact.publicApi?.validatorStyleTypeExports,
    sourceDeclarations: artifact.publicApi?.sourceDeclarations,
    tsdocDeclarations: artifact.publicApi?.tsdocDeclarations,
    failureCodes: artifact.failureModel?.codes,
    failureChannels: artifact.failureModel?.channels,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    runtimeReactTests: artifact.evidence?.tests?.runtimeReactTests,
    validatorStyleTests: artifact.evidence?.tests?.validatorStyleTests,
    runtimeReactCompilerNegativeCases: artifact.evidence?.tests?.runtimeReactCompilerNegativeCases,
    validatorCompilerNegativeCases: artifact.evidence?.tests?.validatorCompilerNegativeCases,
    compilerNegativeCases: artifact.evidence?.tests?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.tests?.rootMutationTests,
    transferredOwnership: artifact.historicalCompatibility?.transferredOwnership,
  };
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    artifact.claim?.resolvedStyleReceivingBoundary !== true ||
    artifact.claim?.stateActivationOwner !== "capability-adapter" ||
    artifact.claim?.rendererStateSelection !== false ||
    artifact.claim?.rendererStateMerge !== false ||
    artifact.claim?.privatePlatformStructure !== false ||
    artifact.historicalCompatibility?.immutableArtifactSha256 !==
      "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0" ||
    artifact.historicalCompatibility?.compatibilityMode !== "immutable-task-time-artifact" ||
    artifact.semanticStyle?.hierarchy !== "visual-state/style-part/property/resolved-json" ||
    artifact.semanticStyle?.componentValidation !== "exact prepared Catalog propertiesSchema" ||
    artifact.semanticStyle?.behaviorValidation !== "exact prepared Catalog propertiesSchema" ||
    artifact.semanticStyle?.validatedValueDelivered !== true ||
    artifact.semanticStyle?.detachedAndRecursivelyImmutable !== true ||
    artifact.semanticStyle?.declaredStatesOnly !== true ||
    artifact.semanticStyle?.declaredPartsOnly !== true ||
    artifact.semanticStyle?.componentFailure?.code !== "INVALID_COMPONENT_STYLE" ||
    artifact.semanticStyle?.componentFailure?.channel !== "style" ||
    artifact.semanticStyle?.behaviorFailure?.code !== "INVALID_BEHAVIOR_STYLE" ||
    artifact.semanticStyle?.behaviorFailure?.channel !== "style" ||
    artifact.semanticStyle?.invalidStyleDeliveredToAdapter !== false ||
    artifact.receivingBudget?.preparedVisualStates !== true ||
    artifact.receivingBudget?.preparedStylePartSchemas !== true ||
    artifact.receivingBudget?.oneSharedSchemaBudget !== true ||
    artifact.receivingBudget?.styleValidationCounter !== "maxStyleValidations" ||
    artifact.receivingBudget?.controlledLimitFailure !== "RECEIVING_VALIDATION_LIMIT_EXCEEDED" ||
    artifact.failureModel?.allOrNothingBeforeReactElementCreation !== true ||
    artifact.failureModel?.exactValidatorDiagnosticsPreserved !== true ||
    artifact.architecture?.package !== "@desen/runtime-react" ||
    !isDeepStrictEqual(artifact.architecture?.productionDependencies, [
      "@desen/runtime-core",
      "@desen/validator",
    ]) ||
    !isDeepStrictEqual(artifact.architecture?.peerDependencies, ["react"]) ||
    artifact.architecture?.focusedScript !== "test:style-parts-states" ||
    !isDeepStrictEqual(artifact.architecture?.modules, [
      "./registry.js",
      "@desen/runtime-core",
      "@desen/validator",
      "react",
    ]) ||
    artifact.architecture?.dynamicExecutableLoading !== 0 ||
    artifact.architecture?.selectorClassDomRefAuthority !== 0 ||
    artifact.architecture?.stateActivationAuthorityExposedByRenderer !== false ||
    artifact.traceability?.task?.id !== "M05-T03" ||
    artifact.traceability?.task?.status !== "DONE" ||
    artifact.traceability?.task?.prerequisite !== "M05-T01–M05-T02" ||
    !isDeepStrictEqual(artifact.traceability?.normative, [
      { id: "N-028", status: "TESTED", owners: "M02-T08, M05-T03" },
      { id: "N-029", status: "TESTED", owners: "M02-T08, M05-T03" },
      { id: "N-030", status: "PLANNED", owners: "M03-T09, M09-T05, M12-T08" },
    ]) ||
    !isDeepStrictEqual(artifact.traceability?.canonicalTrace, [
      "C-019",
      "R-006",
      "R-064",
      "R-065",
      "R-066",
      "R-148",
    ]) ||
    artifact.traceability?.finding !== "PF-052" ||
    artifact.evidence?.tests?.directUniqueNonSkipped !== true ||
    artifact.evidence?.verifierExecutionProfile !== "static-evidence-only" ||
    !Array.isArray(artifact.nonclaims) ||
    artifact.nonclaims.length !== 4
  ) {
    fail(
      "RESOLVED_STYLES_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T03 artifact no longer has its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return Object.freeze(artifact);
}

function verifyExactPin(markdown, heading, artifactPath, code) {
  const lines = markdown.split(/\r?\n/u);
  const headingIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headingIndexes.length !== 1) fail(code, `Expected one exact ${heading} section.`);
  const start = headingIndexes[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next === -1 ? lines.length : next;
  const section = lines.slice(start, end);
  const pathLine = `\`${artifactPath}\``;
  const shaLine = `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`;
  const pathIndex = section.indexOf(pathLine);
  const globalPaths = lines.filter((line) => line.includes(artifactPath));
  const globalShas = lines.filter((line) => line.includes(`sha256:${HISTORICAL_ARTIFACT_SHA256}`));
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
    "RESOLVED_STYLES_PROOF_PIN_DRIFT",
  );
  verifyExactPin(
    matrixText,
    "## M05-T03",
    path.basename(ARTIFACT_RELATIVE_PATH),
    "RESOLVED_STYLES_PROOF_PIN_DRIFT",
  );
}

function artifactBytes(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail(
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `Historical M05-T03 ${label} must be a non-Proxy Buffer.`,
    );
  }
  return Buffer.from(value);
}

function optionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    fail("RESOLVED_STYLES_OPTIONS_INVALID", `Historical M05-T03 ${label} must be a string.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "RESOLVED_STYLES_OPTIONS_INVALID",
      `Historical M05-T03 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

/**
 * Reads and validates the exact immutable M05-T03 task-time artifact.
 *
 * @remarks Successor renderer, validator, runtime, package, build, and prerequisite state can
 * never be reinterpreted as task-time M05-T03 evidence through this compatibility builder.
 */
export async function buildRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const resolvedArtifactPath = artifactPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH;
  const historicalBytes =
    injectedBytes === undefined
      ? await readRegularFile(
          resolvedArtifactPath,
          "RESOLVED_STYLES_ARTIFACT_MISSING",
          "RESOLVED_STYLES_ARTIFACT_UNSAFE",
        )
      : injectedBytes;
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M05-T03 bytes, reviewed semantics, inventory, and exact documentation pins. */
export async function verifyRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
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
  const built = await buildRuntimeReactResolvedStylesEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const [proofText, matrixText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_PROOF_PATH,
        "RESOLVED_STYLES_PROOF_MISSING",
        "RESOLVED_STYLES_PROOF_UNSAFE",
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_PROOF_MATRIX_PATH,
        "RESOLVED_STYLES_PROOF_MISSING",
        "RESOLVED_STYLES_PROOF_UNSAFE",
      ).then((bytes) => bytes.toString("utf8")),
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
    runtimeReactTests: EXPECTED_SEMANTICS.runtimeReactTests,
    validatorStyleTests: EXPECTED_SEMANTICS.validatorStyleTests,
    compilerNegativeCases: EXPECTED_SEMANTICS.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.rootMutationTests,
  });
}

/** Atomically copies only exact already-validated immutable M05-T03 task-time bytes. */
export async function writeRuntimeReactResolvedStylesEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeReactResolvedStylesEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const artifactPath = destinationPath ?? DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH;
  if (
    path.resolve(artifactPath) === path.resolve(DEFAULT_RUNTIME_REACT_RESOLVED_STYLES_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      artifactPath: path.resolve(artifactPath),
      artifactSha256: built.artifactSha256,
      result: built.artifact.result,
      trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
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
    fail("RESOLVED_STYLES_ARTIFACT_UNSAFE", "Atomic M05-T03 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
    result: built.artifact.result,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
  });
}
