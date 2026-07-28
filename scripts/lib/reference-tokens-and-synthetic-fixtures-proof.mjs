import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_SHA256 = "5510336a4098af065e8e39ffc54b257cc3b0e024aef5967de056f9221025fe0f";
const ARTIFACT_NAME = "reference-tokens-and-synthetic-fixtures.json";
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");

/** Absolute path to the immutable task-time M03-T07 evidence artifact. */
export const DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts",
  ARTIFACT_NAME,
);

/** Controlled strict-compatibility failure for immutable M03-T07 evidence. */
export class ReferenceTokensAndSyntheticFixturesEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceTokensAndSyntheticFixturesEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceTokensAndSyntheticFixturesEvidenceError(code, message, details);
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
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} options must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} options could not be captured safely.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "TOKEN_FIXTURE_OPTIONS_INVALID",
      `${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label}.${key} is not safely readable.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "TOKEN_FIXTURE_OPTIONS_INVALID",
        `${label}.${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !(value instanceof Uint8Array) ||
    (typeof SharedArrayBuffer === "function" && value.buffer instanceof SharedArrayBuffer)
  ) {
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} must be non-shared non-Proxy bytes.`);
  }
  return Buffer.from(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("TOKEN_FIXTURE_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(filePath, label) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("TOKEN_FIXTURE_ARTIFACT_MISSING", `${label} is missing.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("TOKEN_FIXTURE_ARTIFACT_UNSAFE", `${label} must be a regular non-symlink file.`);
  }
  return readFile(filePath);
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function exactHistoricalSemantics(artifact) {
  const tokenTests = artifact.evidence?.packageTests?.tokens;
  const fixtureTests = artifact.evidence?.packageTests?.fixtures;
  const tokenNegativeCases = artifact.evidence?.typeNegativeCases?.tokens;
  const fixtureNegativeCases = artifact.evidence?.typeNegativeCases?.fixtures;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M03-T07" ||
    artifact.result !== "PASS" ||
    artifact.claim?.protocol !== "0.1.0" ||
    artifact.claim?.target !== "web-react" ||
    artifact.prerequisite?.task !== "M03-T06" ||
    artifact.prerequisite?.result !== "PASS" ||
    artifact.prerequisite?.artifactSha256 !==
      "553a48cb95aa2a9e6c2ee4e860aea7aedea92499c977b093c1c515c0ad9d75f2" ||
    artifact.tokens?.format !== "DTCG 2025.10 reference subset" ||
    artifact.tokens?.count !== 26 ||
    artifact.tokens?.inventory?.length !== 26 ||
    artifact.tokens?.componentCssCoverage?.coveredProperties?.length !== 26 ||
    artifact.tokens?.providerIsDomFree !== true ||
    artifact.tokens?.genericDesenResolution !== false ||
    artifact.fixtures?.bindingDataExcluded !== true ||
    artifact.fixtures?.executableBindingRejected !== true ||
    artifact.evidence?.provenance?.mode !== "tracked-defaults" ||
    artifact.evidence?.provenance?.overrides?.length !== 0 ||
    tokenTests?.length !== 6 ||
    fixtureTests?.length !== 13 ||
    artifact.evidence?.rootTests?.length !== 16 ||
    tokenNegativeCases?.length !== 10 ||
    fixtureNegativeCases?.length !== 10 ||
    artifact.evidence?.trackedFiles?.length !== 25
  ) {
    fail(
      "TOKEN_FIXTURE_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M03-T07 artifact lost its task-time semantics.",
    );
  }
}

function parseHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== ARTIFACT_SHA256) {
    fail(
      "TOKEN_FIXTURE_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M03-T07 artifact bytes changed.",
      { expectedSha256: ARTIFACT_SHA256, actualSha256 },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "TOKEN_FIXTURE_HISTORICAL_ARTIFACT_DRIFT",
      "The immutable M03-T07 artifact is not valid JSON.",
    );
  }
  exactHistoricalSemantics(artifact);
  return deepFreeze(artifact);
}

function verifyMatrixPin(matrixText) {
  const exactReference = `\`${ARTIFACT_NAME}\`\n\`sha256:${ARTIFACT_SHA256}\`.`;
  if (
    matrixText.split(exactReference).length !== 2 ||
    matrixText.split(`\`${ARTIFACT_NAME}\``).length !== 2
  ) {
    fail(
      "TOKEN_FIXTURE_PROOF_PIN_DRIFT",
      "Proof Matrix must retain one exact adjacent immutable M03-T07 artifact pin.",
    );
  }
}

async function readHistoricalArtifact(options) {
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH;
  const artifactBytes =
    optionalBytes(options.artifactBytes, "artifactBytes") ??
    (await readRegularBytes(path.resolve(artifactPath), "M03-T07 artifact"));
  const artifact = parseHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: ARTIFACT_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
  });
}

/**
 * Reads the exact task-time M03-T07 artifact without consulting successor source or build output.
 */
export async function buildReferenceTokensAndSyntheticFixturesEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "Build");
  return readHistoricalArtifact(options);
}

/** Verifies exact M03-T07 bytes, task-time semantics, and the immutable Proof Matrix pin. */
export async function verifyReferenceTokensAndSyntheticFixturesEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "artifactBytes", "proofMatrixText"],
    "Verify",
  );
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const built = await readHistoricalArtifact(options);
  verifyMatrixPin(
    proofMatrixText ?? (await readRegularBytes(PROOF_MATRIX_PATH, "Proof Matrix")).toString("utf8"),
  );
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: ARTIFACT_SHA256,
    prerequisiteSha256: built.artifact.prerequisite.artifactSha256,
    provenanceMode: built.artifact.evidence.provenance.mode,
    compatibilityMode: built.compatibilityMode,
    tokens: built.artifact.tokens.count,
    componentCssProperties: built.artifact.tokens.componentCssCoverage.coveredProperties.length,
    packageTests:
      built.artifact.evidence.packageTests.tokens.length +
      built.artifact.evidence.packageTests.fixtures.length,
    rootTests: built.artifact.evidence.rootTests.length,
    typeNegativeCases:
      built.artifact.evidence.typeNegativeCases.tokens.length +
      built.artifact.evidence.typeNegativeCases.fixtures.length,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
  });
}

/**
 * Preserves the tracked M03-T07 artifact or copies its exact bytes to an alternate safe target.
 */
export async function writeReferenceTokensAndSyntheticFixturesEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOptions(options.buildOptions, ["artifactPath", "artifactBytes"], "buildOptions");
  const built = await readHistoricalArtifact(buildOptions ?? Object.freeze({}));
  let canonicalArtifactPath;
  let canonicalTrackedPath;
  try {
    [canonicalArtifactPath, canonicalTrackedPath] = await Promise.all([
      canonicalDestinationPath(artifactPath),
      canonicalDestinationPath(DEFAULT_REFERENCE_TOKENS_AND_SYNTHETIC_FIXTURES_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail(
      "TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED",
      "The immutable M03-T07 artifact destination could not be resolved safely.",
      { cause: String(error) },
    );
  }
  if (canonicalArtifactPath === canonicalTrackedPath) {
    if (beforeAtomicRename !== undefined || buildOptions !== undefined) {
      fail(
        "TOKEN_FIXTURE_NONDEFAULT_TRACKED_WRITE",
        "The immutable tracked M03-T07 artifact cannot be rebuilt or hooked.",
      );
    }
    return Object.freeze({ ...built, preserved: true });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: canonicalArtifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "TOKEN_FIXTURE_ARTIFACT_WRITE_FAILED",
      "The immutable M03-T07 artifact could not be copied safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({ ...built, artifactPath: canonicalArtifactPath });
}
