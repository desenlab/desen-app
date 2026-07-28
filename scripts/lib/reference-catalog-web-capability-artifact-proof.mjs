import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_NAME = "reference-catalog-web-capability-artifact.json";
const ARTIFACT_SHA256 = "4ddeee8d33ff718e1907a6402b7c2d10ef0769c872832a4cb056231441ae65e0";
const CATALOG_SHA256 = "3113e299e0bec65f19b823a712378592a57806116b1eadd902c0390906772279";
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");

/** Absolute path to the immutable task-time M03-T10 proof artifact. */
export const DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/artifacts",
  ARTIFACT_NAME,
);

/**
 * Historical location of the M03-T10 published Catalog.
 *
 * @remarks Successor tasks now own this live path. The compatibility reader never reads, writes,
 * or claims its current bytes.
 */
export const DEFAULT_REFERENCE_CATALOG_WEB_CATALOG_PATH = path.join(
  WORKSPACE_ROOT,
  "packages/reference-catalog-web/catalog.json",
);

const HISTORICAL_PACKAGE_FILES = Object.freeze(["catalog.json", "dist"]);
const HISTORICAL_PACKAGE_EXPORT_TARGETS = Object.freeze({
  ".": Object.freeze({
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  }),
  "./catalog.json": "./catalog.json",
  "./components": Object.freeze({
    types: "./dist/components/index.d.ts",
    import: "./dist/components/index.js",
  }),
  "./host-operations": Object.freeze({
    types: "./dist/host-operations/index.d.ts",
    import: "./dist/host-operations/index.js",
  }),
  "./operations": Object.freeze({
    types: "./dist/operations/index.d.ts",
    import: "./dist/operations/index.js",
  }),
  "./parity": Object.freeze({
    types: "./dist/parity/index.d.ts",
    import: "./dist/parity/index.js",
  }),
  "./tokens": Object.freeze({
    types: "./dist/tokens/index.d.ts",
    import: "./dist/tokens/index.js",
  }),
});
const HISTORICAL_PACKAGE_EXPORTS = Object.freeze(Object.keys(HISTORICAL_PACKAGE_EXPORT_TARGETS));

/** Controlled strict-compatibility failure for immutable M03-T10 evidence. */
export class ReferenceCatalogWebCapabilityArtifactEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceCatalogWebCapabilityArtifactEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceCatalogWebCapabilityArtifactEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function prefixedSha256(bytes) {
  return `sha256:${sha256(bytes)}`;
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
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      `${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      `${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      `${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        `${label}.${key} is not safely readable.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        `${label}.${key} must be an enumerable own data property.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID", `${label} must be a non-empty string.`);
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
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      `${label} must be non-shared non-Proxy bytes.`,
    );
  }
  return Buffer.from(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID", `${label} must be a non-Proxy function.`);
  }
  return value;
}

async function readRegularBytes(filePath, label) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_MISSING", `${label} is missing.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_UNSAFE", `${label} must be a regular non-symlink file.`);
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
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M03-T10" ||
    artifact.result !== "PASS" ||
    artifact.prerequisite?.task !== "M03-T09" ||
    artifact.prerequisite?.result !== "PASS" ||
    artifact.prerequisite?.artifactSha256 !==
      "6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a" ||
    artifact.identity?.id !== "run.desen.reference.sign-in" ||
    artifact.identity?.version !== "0.1.0" ||
    artifact.identity?.target !== "web-react" ||
    artifact.identity?.protocol !== "0.1.0" ||
    artifact.tuple?.id !== artifact.identity.id ||
    artifact.tuple?.version !== artifact.identity.version ||
    artifact.tuple?.target !== artifact.identity.target ||
    artifact.tuple?.packageDigest !==
      "sha256:4ebfc6209d4874f3798009c72c634d2f65e60f8b59d4a517f269380a8cec6d9e" ||
    artifact.catalog?.bytes !== 8_439 ||
    artifact.catalog?.sha256 !== `sha256:${CATALOG_SHA256}` ||
    artifact.catalog?.canonicalBytes !== 5_873 ||
    artifact.catalog?.components?.length !== 5 ||
    artifact.catalog?.operations?.length !== 1 ||
    artifact.catalog?.behaviors?.length !== 0 ||
    artifact.catalog?.resources?.length !== 0 ||
    artifact.inventory?.files !== 76 ||
    artifact.inventory?.totalBytes !== 224_069 ||
    artifact.inventory?.entries?.length !== 76 ||
    artifact.reproducibility?.isolatedBuilds !== 2 ||
    artifact.reproducibility?.byteIdentical !== true ||
    artifact.reproducibility?.workspaceDistExactMatch !== true ||
    artifact.reproducibility?.sourceMaps?.sourceMaps !== 38 ||
    artifact.reproducibility?.sourceMaps?.declarationMaps !== 19 ||
    artifact.mutations?.total !== 236 ||
    artifact.capabilityComposition?.executableRegistryCreated !== false ||
    artifact.capabilityComposition?.runtimeAdapterRegistrationOwner !== "M05" ||
    artifact.evidence?.provenance?.mode !== "tracked-defaults" ||
    artifact.evidence?.provenance?.overrides?.length !== 0 ||
    artifact.evidence?.trackedFiles?.length !== 288 ||
    JSON.stringify(artifact.evidence?.packagePublication?.exports) !==
      JSON.stringify(HISTORICAL_PACKAGE_EXPORTS)
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_HISTORICAL_DRIFT",
      "The immutable M03-T10 artifact lost its task-time semantics.",
    );
  }
}

function parseHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== ARTIFACT_SHA256) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_HISTORICAL_DRIFT",
      "The immutable M03-T10 artifact bytes changed.",
      { expectedSha256: ARTIFACT_SHA256, actualSha256 },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_HISTORICAL_DRIFT",
      "The immutable M03-T10 artifact is not valid JSON.",
    );
  }
  exactHistoricalSemantics(artifact);
  return deepFreeze(artifact);
}

function verifyMatrixPin(matrixText) {
  const exactReference = `\`${ARTIFACT_NAME}\`\n\`sha256:${ARTIFACT_SHA256}\`.`;
  if (matrixText.split(exactReference).length !== 2) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PROOF_PIN_DRIFT",
      "Proof Matrix must retain one exact adjacent immutable M03-T10 artifact pin.",
    );
  }
}

async function historicalBuild(options) {
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH;
  const artifactBytes =
    optionalBytes(options.artifactBytes, "artifactBytes") ??
    (await readRegularBytes(path.resolve(artifactPath), "M03-T10 artifact"));
  const artifact = parseHistoricalArtifact(artifactBytes);
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: `sha256:${ARTIFACT_SHA256}`,
    catalogSha256: `sha256:${CATALOG_SHA256}`,
    compatibilityMode: "immutable-task-time-artifact",
  });
}

/**
 * Reads exact task-time M03-T10 evidence without consulting the successor Catalog, source, or dist.
 */
export async function buildReferenceCatalogWebCapabilityArtifactEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "Build");
  return historicalBuild(options);
}

/** Validates that explicit bytes do not embed the historical package digest. */
export function verifyReferenceCatalogWebSelfReferenceExclusion(inventory, packageDigest) {
  if (!Array.isArray(inventory) || typeof packageDigest !== "string") {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      "Historical self-reference inputs are invalid.",
    );
  }
  const needle = Buffer.from(packageDigest, "ascii");
  for (const entry of inventory) {
    let captured;
    try {
      captured = captureOptions(entry, ["path", "bytes", "sha256"], "Inventory entry");
    } catch {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        "Historical self-reference inventory is malformed.",
      );
    }
    const bytes = optionalBytes(captured.bytes, "Inventory entry bytes");
    if (bytes === undefined) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
        "Historical self-reference inventory is malformed.",
      );
    }
    if (bytes.includes(needle)) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_SELF_REFERENCE_DETECTED",
        "Historical package digest bytes occur inside the supplied distribution.",
      );
    }
  }
  return Object.freeze({
    packageDigestBytesAbsent: true,
    exactTupleBytesAbsent: true,
    reason: "the exact tuple necessarily contains the absent packageDigest",
  });
}

/**
 * Validates an explicitly supplied manifest against the historical M03-T10 package surface.
 *
 * @remarks This does not inspect or constrain the successor package manifest.
 */
export function verifyReferenceCatalogWebPackagePublicationSurface(packageManifest) {
  function drift(message) {
    fail("REFERENCE_CAPABILITY_ARTIFACT_PACKAGE_SURFACE_DRIFT", message);
  }

  function captureOwnDataRecord(value, expectedKeys, label) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    ) {
      drift(`${label} must be a plain own-data object.`);
    }
    let prototype;
    let keys;
    try {
      prototype = Object.getPrototypeOf(value);
      keys = Reflect.ownKeys(value);
    } catch {
      drift(`${label} could not be inspected safely.`);
    }
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => typeof key !== "string" || key !== expectedKeys[index])
    ) {
      drift(`${label} keys differ from the immutable M03-T10 surface.`);
    }
    const captured = Object.create(null);
    for (const key of expectedKeys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        drift(`${label}.${key} could not be inspected safely.`);
      }
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        drift(`${label}.${key} must be an enumerable own data property.`);
      }
      captured[key] = descriptor.value;
    }
    return captured;
  }

  function captureManifestMember(value, key) {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    ) {
      drift("Historical package manifest input is malformed.");
    }
    let prototype;
    let descriptor;
    try {
      prototype = Object.getPrototypeOf(value);
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      drift(`Historical package manifest ${key} could not be inspected safely.`);
    }
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      drift(`Historical package manifest ${key} must be an enumerable own data property.`);
    }
    return descriptor.value;
  }

  const files = captureManifestMember(packageManifest, "files");
  if (
    utilTypes.isProxy(files) ||
    !Array.isArray(files) ||
    Object.getPrototypeOf(files) !== Array.prototype ||
    Reflect.ownKeys(files).some((key, index) => key !== ["0", "1", "length"][index]) ||
    files.length !== HISTORICAL_PACKAGE_FILES.length ||
    HISTORICAL_PACKAGE_FILES.some((expected, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(files, String(index));
      return (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        descriptor.value !== expected
      );
    })
  ) {
    drift("Historical package files differ from the immutable M03-T10 surface.");
  }

  const exports = captureOwnDataRecord(
    captureManifestMember(packageManifest, "exports"),
    HISTORICAL_PACKAGE_EXPORTS,
    "Historical package exports",
  );
  for (const exportName of HISTORICAL_PACKAGE_EXPORTS) {
    const expectedTarget = HISTORICAL_PACKAGE_EXPORT_TARGETS[exportName];
    const actualTarget = exports[exportName];
    if (typeof expectedTarget === "string") {
      if (actualTarget !== expectedTarget) {
        drift(`Historical package export ${exportName} target changed.`);
      }
      continue;
    }
    const capturedTarget = captureOwnDataRecord(
      actualTarget,
      ["types", "import"],
      `Historical package export ${exportName}`,
    );
    if (
      capturedTarget.types !== expectedTarget.types ||
      capturedTarget.import !== expectedTarget.import
    ) {
      drift(`Historical package export ${exportName} target changed.`);
    }
  }
  return Object.freeze({
    files: HISTORICAL_PACKAGE_FILES,
    exports: HISTORICAL_PACKAGE_EXPORTS,
    export: "./catalog.json",
    target: "./catalog.json",
    executableLoader: false,
  });
}

function assertPreparedEvidence(expected) {
  let captured;
  try {
    captured = captureOptions(
      expected,
      ["artifact", "artifactBytes", "artifactSha256", "catalogSha256", "compatibilityMode"],
      "Prepared evidence",
    );
  } catch {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREPARED_RESULT_INVALID",
      "Prepared evidence is not the strict historical M03-T10 result.",
    );
  }
  let artifactBytes;
  try {
    artifactBytes = optionalBytes(captured.artifactBytes, "Prepared evidence artifactBytes");
  } catch {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREPARED_RESULT_INVALID",
      "Prepared evidence is not the strict historical M03-T10 result.",
    );
  }
  if (
    artifactBytes === undefined ||
    captured.artifactSha256 !== `sha256:${ARTIFACT_SHA256}` ||
    captured.catalogSha256 !== `sha256:${CATALOG_SHA256}` ||
    captured.compatibilityMode !== "immutable-task-time-artifact" ||
    sha256(artifactBytes) !== ARTIFACT_SHA256
  ) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PREPARED_RESULT_INVALID",
      "Prepared evidence is not the strict historical M03-T10 result.",
    );
  }
  return Object.freeze({
    artifact: parseHistoricalArtifact(artifactBytes),
    artifactBytes,
  });
}

async function explicitDistributionInventory(directory, segments = []) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  const result = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const nextSegments = [...segments, entry.name];
    const status = await lstat(entryPath);
    if (status.isSymbolicLink()) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE",
        "Historical distribution inventory rejects symlinks.",
      );
    }
    if (status.isDirectory()) {
      result.push(...(await explicitDistributionInventory(entryPath, nextSegments)));
    } else if (status.isFile()) {
      const bytes = await readFile(entryPath);
      result.push(
        Object.freeze({
          path: `dist/${nextSegments.join("/")}`,
          bytes: bytes.length,
          sha256: prefixedSha256(bytes),
        }),
      );
    } else {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_UNSAFE",
        "Historical distribution inventory accepts regular files only.",
      );
    }
  }
  return result;
}

/** Checks an explicitly staged directory against the immutable historical inventory metadata. */
export async function verifyReferenceCatalogWebDistributionInventory(rawOptions) {
  const options = captureOptions(rawOptions, ["expected", "distDirectory"], "Distribution");
  const prepared = assertPreparedEvidence(options.expected);
  const distDirectory = optionalString(options.distDirectory, "distDirectory");
  if (distDirectory === undefined || !path.isAbsolute(distDirectory)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_OPTIONS_INVALID",
      "distDirectory must be an absolute path.",
    );
  }
  const actual = await explicitDistributionInventory(distDirectory);
  const historical = prepared.artifact.inventory.entries.map(
    ({ path: entryPath, bytes, sha256: entrySha256 }) => ({
      path: entryPath,
      bytes,
      sha256: entrySha256,
    }),
  );
  if (JSON.stringify(actual) !== JSON.stringify(historical)) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_DISTRIBUTION_DRIFT",
      "The staged directory differs from the immutable M03-T10 distribution inventory.",
    );
  }
  return Object.freeze({ result: "PASS", files: actual.length });
}

/** Compares explicit artifact or historical Catalog bytes with task-time identities. */
export function verifyReferenceCatalogWebCapabilityArtifactOutputs(rawOptions) {
  const options = captureOptions(
    rawOptions,
    ["expected", "artifactBytes", "catalogBytes"],
    "Outputs",
  );
  const prepared = assertPreparedEvidence(options.expected);
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const catalogBytes = optionalBytes(options.catalogBytes, "catalogBytes");
  if (artifactBytes === undefined || sha256(artifactBytes) !== ARTIFACT_SHA256) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_PROOF_DRIFT",
      "Explicit M03-T10 proof bytes differ from the immutable artifact.",
    );
  }
  if (catalogBytes !== undefined && sha256(catalogBytes) !== CATALOG_SHA256) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_CATALOG_DRIFT",
      "Explicit Catalog bytes differ from the immutable M03-T10 Catalog identity.",
    );
  }
  const artifact = prepared.artifact;
  return Object.freeze({
    result: "PASS",
    artifactSha256: `sha256:${ARTIFACT_SHA256}`,
    catalogSha256: `sha256:${CATALOG_SHA256}`,
    packageDigest: artifact.tuple.packageDigest,
    inventoryFiles: artifact.inventory.files,
    inventoryBytes: artifact.inventory.totalBytes,
    mutationVectors: artifact.mutations.total,
    sourceMaps: artifact.reproducibility.sourceMaps.sourceMaps,
    trackedFiles: artifact.evidence.trackedFiles.length,
    provenanceMode: artifact.evidence.provenance.mode,
    compatibilityMode: "immutable-task-time-artifact",
  });
}

/** Verifies exact M03-T10 artifact bytes, semantics, and its unique Proof Matrix pin. */
export async function verifyReferenceCatalogWebCapabilityArtifactEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "artifactBytes", "proofMatrixText"],
    "Verify",
  );
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const expected = await historicalBuild(options);
  verifyMatrixPin(
    proofMatrixText ?? (await readRegularBytes(PROOF_MATRIX_PATH, "Proof Matrix")).toString("utf8"),
  );
  return verifyReferenceCatalogWebCapabilityArtifactOutputs({
    expected,
    artifactBytes: expected.artifactBytes,
  });
}

/**
 * Preserves the tracked artifact or copies its exact historical bytes to an alternate safe target.
 *
 * @remarks The successor `catalog.json` path is never touched.
 */
export async function writeReferenceCatalogWebCapabilityArtifactEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactPath", "beforeArtifactAtomicRename", "buildOptions"],
    "Write",
  );
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(
    options.beforeArtifactAtomicRename,
    "beforeArtifactAtomicRename",
  );
  const buildOptions =
    options.buildOptions === undefined
      ? undefined
      : captureOptions(options.buildOptions, ["artifactPath", "artifactBytes"], "buildOptions");
  const built = await historicalBuild(buildOptions ?? Object.freeze({}));
  let canonicalArtifactPath;
  let canonicalTrackedPath;
  try {
    [canonicalArtifactPath, canonicalTrackedPath] = await Promise.all([
      canonicalDestinationPath(artifactPath),
      canonicalDestinationPath(DEFAULT_REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail(
      "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED",
      "The immutable M03-T10 artifact destination could not be resolved safely.",
      { cause: String(error) },
    );
  }
  if (canonicalArtifactPath === canonicalTrackedPath) {
    if (beforeAtomicRename !== undefined || buildOptions !== undefined) {
      fail(
        "REFERENCE_CAPABILITY_ARTIFACT_NONDEFAULT_TRACKED_WRITE",
        "The immutable tracked M03-T10 artifact cannot be rebuilt or hooked.",
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
      "REFERENCE_CAPABILITY_ARTIFACT_WRITE_FAILED",
      "The immutable M03-T10 artifact could not be copied safely.",
      { cause: String(error) },
    );
  }
  return Object.freeze({ ...built, artifactPath: canonicalArtifactPath });
}

/** Historical root script names retained for exact task-time compatibility. */
export const REFERENCE_CATALOG_WEB_CAPABILITY_ARTIFACT_ROOT_SCRIPTS = Object.freeze([
  "generate:reference-catalog-web-capability-artifact",
  "verify:reference-catalog-web-capability-artifact",
  "test:reference-catalog-web-capability-artifact",
]);
