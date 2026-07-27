import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";

/** Absolute path to the immutable task-time M05-T01 React adapter-registry artifact. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the human-readable M05-T01 proof. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact M05-T01 Proof Matrix pin. */
export const DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T01",
  result: "PASS",
  profile: "desen-runtime-react-adapter-registry-v1",
  protocol: "0.1.0",
  target: "web-react",
  runtimeExports: Object.freeze([
    "RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS",
    "RUNTIME_REACT_RENDER_LIMITS",
    "createRuntimeReactAdapterRegistry",
    "readRuntimeReactAdapterRegistry",
    "renderRuntimeReactSurface",
  ]),
  typeExports: 28,
  sourceDeclarations: 35,
  tsdocDeclarations: 35,
  packageTests: 10,
  compilerNegativeCases: 4,
  rootMutationTests: 11,
  trackedFiles: 25,
  failureCodes: 12,
  productionDependencies: Object.freeze(["@desen/runtime-core"]),
  peerDependencies: Object.freeze(["react"]),
});

/** Controlled compatibility-verifier failure for immutable M05-T01 evidence. */
export class RuntimeReactAdapterRegistryEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactAdapterRegistryEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactAdapterRegistryEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeOptions(value) {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("RUNTIME_REACT_OPTIONS_INVALID", "Evidence options must be an object.");
  }
  return value;
}

async function readRegularFile(filePath, missingCode, unsafeCode) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(missingCode, `Historical M05-T01 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      unsafeCode,
      `Historical M05-T01 evidence must be a regular non-symlink file: ${filePath}.`,
    );
  }
  return readFile(filePath);
}

function exactArray(value, expected) {
  return Array.isArray(value) && isDeepStrictEqual(value, expected);
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "RUNTIME_REACT_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T01 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "RUNTIME_REACT_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T01 artifact is not valid JSON.",
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
    typeExports: artifact.publicApi?.typeExports?.length,
    sourceDeclarations: artifact.publicApi?.sourceDeclarations,
    tsdocDeclarations: artifact.publicApi?.tsdocDeclarations,
    packageTests: artifact.evidence?.packageTests,
    compilerNegativeCases: artifact.evidence?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.rootMutationTests,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    failureCodes: artifact.renderer?.failureCodes?.length,
    productionDependencies: artifact.boundary?.productionDependencies,
    peerDependencies: artifact.boundary?.peerDependencies,
  };
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !exactArray(artifact.renderer?.failureCodes, artifact.renderer?.failureCodesExercised) ||
    artifact.claim?.bundleCanSelectModule !== false ||
    artifact.claim?.unknownCapabilityFallback !== false ||
    artifact.claim?.nativeOrDomAuthorityExposed !== false ||
    artifact.registry?.factoryAuthenticatedHandle !== true ||
    artifact.registry?.adaptersInvokedDuringRegistration !== 0 ||
    artifact.renderer?.completePreflightBeforeAdapterExecution !== true ||
    artifact.renderer?.adaptersInvokedDuringPreflight !== 0 ||
    artifact.renderer?.placeholderElementsOnFailure !== 0 ||
    artifact.boundary?.browserOrDomImports !== 0 ||
    artifact.boundary?.dynamicExecutableLoading !== 0
  ) {
    fail(
      "RUNTIME_REACT_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T01 artifact no longer has its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return Object.freeze(artifact);
}

function verifyExactPin(markdown, heading, artifactPath, artifactSha256, code, suffix = "") {
  const lines = markdown.split(/\r?\n/u);
  const headingIndexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (headingIndexes.length !== 1) {
    fail(code, `Expected one exact ${heading} section.`);
  }
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
    semanticShas.length !== 1 ||
    /PENDING/iu.test(section.join("\n"))
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
    "RUNTIME_REACT_PROOF_PIN_DRIFT",
  );
  verifyExactPin(
    matrixText,
    "## M05-T01",
    path.basename(ARTIFACT_RELATIVE_PATH),
    HISTORICAL_ARTIFACT_SHA256,
    "RUNTIME_REACT_PROOF_MATRIX_PIN_DRIFT",
    ".",
  );
}

function rejectSuccessorBuildInjection(options) {
  for (const key of [
    "buildOptions",
    "fileOverrides",
    "runtimeApi",
    "prerequisiteArtifactBytes",
    "verifyPrerequisite",
  ]) {
    if (Object.hasOwn(options, key)) {
      fail(
        "RUNTIME_REACT_OPTIONS_INVALID",
        `Historical M05-T01 verification rejects successor rebuild option ${key}.`,
      );
    }
  }
}

/**
 * Reads and validates the exact immutable M05-T01 task-time artifact.
 *
 * @remarks M05-T02 owns all current renderer-source verification. This compatibility builder
 * deliberately does not reinterpret successor source as task-time T01 evidence.
 */
export async function buildRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  rejectSuccessorBuildInjection(options);
  const artifactPath = options.artifactPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH;
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularFile(
          artifactPath,
          "RUNTIME_REACT_ARTIFACT_MISSING",
          "RUNTIME_REACT_ARTIFACT_UNSAFE",
        )
      : Buffer.from(options.artifactBytes);
  const artifact = inspectHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M05-T01 bytes, reviewed semantics, inventory, and exact documentation pins. */
export async function verifyRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  rejectSuccessorBuildInjection(options);
  const built = await buildRuntimeReactAdapterRegistryEvidence({
    ...(options.artifactPath === undefined ? {} : { artifactPath: options.artifactPath }),
    ...(options.artifactBytes === undefined ? {} : { artifactBytes: options.artifactBytes }),
  });
  const [proofText, matrixText] = await Promise.all([
    options.proofDocumentText ??
      readFile(options.proofPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_PATH, "utf8"),
    options.proofMatrixText ??
      readFile(
        options.proofMatrixPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_PROOF_MATRIX_PATH,
        "utf8",
      ),
  ]);
  verifyDocumentation(proofText, matrixText);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: built.artifact.publicApi.runtimeExports.length,
    typeExports: built.artifact.publicApi.typeExports.length,
    sourceDeclarations: built.artifact.publicApi.sourceDeclarations,
    tsdocDeclarations: built.artifact.publicApi.tsdocDeclarations,
    packageTests: built.artifact.evidence.packageTests,
    compilerNegativeCases: built.artifact.evidence.compilerNegativeCases,
    rootMutationTests: built.artifact.evidence.rootMutationTests,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    failureCodes: built.artifact.renderer.failureCodes.length,
  });
}

/** Atomically writes only the exact already-validated immutable M05-T01 task-time bytes. */
export async function writeRuntimeReactAdapterRegistryEvidence(rawOptions = undefined) {
  const options = normalizeOptions(rawOptions);
  rejectSuccessorBuildInjection(options);
  const built = await buildRuntimeReactAdapterRegistryEvidence({
    ...(options.sourceArtifactPath === undefined
      ? {}
      : { artifactPath: options.sourceArtifactPath }),
    ...(options.artifactBytes === undefined ? {} : { artifactBytes: options.artifactBytes }),
  });
  const artifactPath = options.artifactPath ?? DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH;
  if (
    path.resolve(artifactPath) ===
    path.resolve(DEFAULT_RUNTIME_REACT_ADAPTER_REGISTRY_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
      artifactSha256: built.artifactSha256,
      result: built.artifact.result,
      preserved: true,
    });
  }
  await writeAtomicProofArtifact({
    artifactPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  return Object.freeze({
    artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
    artifactSha256: built.artifactSha256,
    result: built.artifact.result,
  });
}
