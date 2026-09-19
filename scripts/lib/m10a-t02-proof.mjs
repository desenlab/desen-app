import { createHash } from "node:crypto";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

/** Relative tracked path of the immutable historical T02 artifact. */
export const M10A_T02_ARTIFACT_PATH = "docs/proof/artifacts/m10a-t02.json";
const ARTIFACT_BYTES = 11_513;
const ARTIFACT_SHA256 = "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2";
const AUTHORITY_AGGREGATE_SHA256 =
  "6a5f57ae8face6679d421a695dc0cf225ed84703af5622bf293324bc21768fb4";

/** Exact SC-01 artifact identity recorded by the historical T02 successor. */
export const M10A_T02_SC01_PIN = Object.freeze({
  task: "SC-01",
  path: "docs/proof/artifacts/sc-01-dtcg-compatibility.json",
  bytes: 31_286,
  sha256: "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
  classification: "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE",
  leaves: 26,
});

const RUNTIME_EXPORTS = Object.freeze([
  "DESIGN_TOKEN_PROFILE",
  "EDITABLE_PROJECT_KIND",
  "EDITABLE_PROJECT_LIMITS",
  "EDITABLE_PROJECT_SCHEMA_VERSION",
  "SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS",
  "admitDtcgTokenDocument",
  "admitEditableProjectRecord",
  "getDesignTokenValueFamily",
  "getDtcgAliasTarget",
  "isDtcgTokenAlias",
  "migrateEditableProjectRecord",
  "resolveDesignTokens",
]);

/** Stable task-time test declarations retained in the frozen T02 receipt. */
export const M10A_T02_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T02 builds deterministic evidence through the built public package",
  "M10A-T02 proves a lossless immutable project export and reimport",
  "M10A-T02 proves nine DTCG types seven families and deterministic precedence",
  "M10A-T02 rejects alias cycle missing target type mismatch overflow and unsafe data",
  "M10A-T02 preserves the exact historical 26-leaf SC-01 artifact",
  "M10A-T02 rejects public-runtime package and historical-authority mutations",
  "M10A-T02 verifier rejects artifact and visible-report drift",
  "M10A-T02 writer is atomic and rejects unsafe destinations",
  "M10A-T02 authenticates its checkpointed artifact without external execution",
]);

/** Stable redacted failure emitted by the historical T02 evidence boundary. */
export class M10AT02ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT02ProofError";
    this.code = `M10A_T02_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT02ProofError(code, message);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactRecord(value, expectedKeys, label, code = "ARTIFACT_DRIFT") {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(code, `${label} must be one inert plain record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(code, `${label} fields drifted.`);
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(code, `${label} fields must be inert own data.`);
    }
  }
  return value;
}

function equal(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) fail("ARTIFACT_DRIFT", `${label} drifted.`);
}

function options(value, label) {
  if (value !== undefined) exactRecord(value, [], label, "OPTIONS_INVALID");
}

function authenticateRecordedArtifact(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("ARTIFACT_DRIFT", "Checkpointed T02 evidence must be valid UTF-8 JSON.");
  }
  const artifact = exactRecord(
    parsed,
    [
      "schemaVersion",
      "task",
      "proofId",
      "profile",
      "result",
      "claim",
      "publicPackage",
      "project",
      "tokens",
      "historicalSc01",
      "tests",
      "nonClaims",
    ],
    "Checkpointed T02 evidence",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T02" ||
    artifact.proofId !== "m10a-t02" ||
    artifact.profile !== "desen.design-system-core.proof.v1" ||
    artifact.result !== "PASS"
  )
    fail("ARTIFACT_DRIFT", "Checkpointed T02 identity drifted.");
  equal(
    artifact.claim,
    {
      implementationEvidence: "PASS",
      taskCompletionRequiresHostedExactHead: true,
      platformNeutralCore: true,
      projectEnvelopeVersioned: true,
      projectRoundTripLossAware: true,
      tokenResolutionDeterministic: true,
      historicalSc01Unchanged: true,
    },
    "Historical T02 claims",
  );
  const pkg = exactRecord(
    artifact.publicPackage,
    [
      "name",
      "private",
      "type",
      "sideEffects",
      "exportRoot",
      "productionDependencies",
      "onlyReviewedInternalDependencies",
      "requiredRuntimeExports",
      "exercisedBuiltPublicRoot",
      "sourceAuthority",
      "files",
    ],
    "Historical T02 package",
  );
  if (
    pkg.name !== "@desen/design-system-core" ||
    pkg.private !== true ||
    pkg.type !== "module" ||
    pkg.sideEffects !== false ||
    pkg.onlyReviewedInternalDependencies !== true ||
    pkg.exercisedBuiltPublicRoot !== true
  )
    fail("ARTIFACT_DRIFT", "Historical T02 package boundary drifted.");
  equal(
    pkg.exportRoot,
    { types: "./dist/index.d.ts", import: "./dist/index.js" },
    "Historical T02 export root",
  );
  equal(
    pkg.productionDependencies,
    ["@desen/editor-core", "@desen/protocol"],
    "Historical T02 dependencies",
  );
  equal(pkg.requiredRuntimeExports, RUNTIME_EXPORTS, "Historical T02 exports");
  if (!Array.isArray(pkg.files) || pkg.files.length !== 23)
    fail("ARTIFACT_DRIFT", "Historical T02 receipt inventory drifted.");
  const paths = new Set();
  const payload = pkg.files
    .map((candidate) => {
      const item = exactRecord(
        candidate,
        ["path", "bytes", "sha256"],
        "Historical T02 file receipt",
      );
      if (
        typeof item.path !== "string" ||
        !item.path.startsWith("packages/design-system-core/") ||
        item.path.includes("..") ||
        paths.has(item.path) ||
        !Number.isSafeInteger(item.bytes) ||
        item.bytes <= 0 ||
        typeof item.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(item.sha256)
      ) {
        fail("ARTIFACT_DRIFT", "Historical T02 file receipt is invalid.");
      }
      paths.add(item.path);
      return `${item.path}\0${item.bytes}\0${item.sha256}\n`;
    })
    .join("");
  // Only recorded receipts enter this aggregate; evolving Core files are not historical authority.
  const aggregate = createHash("sha256").update(payload, "utf8").digest("hex");
  if (
    aggregate !== AUTHORITY_AGGREGATE_SHA256 ||
    pkg.files.reduce((sum, item) => sum + item.bytes, 0) !== 169_240
  ) {
    fail("ARTIFACT_DRIFT", "Historical T02 authority aggregate drifted.");
  }
  equal(
    artifact.project,
    {
      kind: "desen.editable-project",
      schemaVersions: [1],
      sourceKind: "desen.source",
      sourcePreservedExactly: true,
      canonicalBytes: 4_211,
      digest: "sha256:99c458aad4f1e6ca19f21690a5dd42d7281a1fed8142c87ab1a2e835d5eb3c20",
      deterministicAcrossKeyOrder: true,
      reimportByteIdentical: true,
      reimportRecordIdentical: true,
      changes: 0,
      losses: 0,
      retained: {
        tokenSources: 1,
        recipes: 1,
        assets: 1,
        connectionIntents: 1,
        projectExtensions: true,
        tokenExtensions: true,
      },
      connectionIntentAuthority: "INERT_DRAFT_ONLY",
      executableIntentRejected: true,
    },
    "Historical T02 v1 project",
  );
  const tokens = exactRecord(
    artifact.tokens,
    [
      "standard",
      "supportedTypes",
      "supportedTypeCount",
      "supportedFamilies",
      "supportedFamilyCount",
      "motionTypes",
      "profile",
      "admittedTokenCount",
      "resolvedTokenPaths",
      "deterministicOrder",
      "orderedSourceIds",
      "laterSourceWins",
      "aliasResolvedAfterOverlay",
      "crossSourceUntypedAliasTargetIntroducedLater",
      "literalOverrideWinsLast",
      "aliasesObserveLiteralOverride",
      "outputRecursivelyImmutable",
      "observations",
      "negativeMatrix",
    ],
    "Historical T02 token evidence",
  );
  equal(
    tokens.supportedTypes,
    [
      "border",
      "color",
      "cubicBezier",
      "dimension",
      "duration",
      "number",
      "shadow",
      "transition",
      "typography",
    ],
    "Historical T02 token types",
  );
  equal(
    tokens.supportedFamilies,
    ["border", "color", "dimension", "motion", "number", "shadow", "typography"],
    "Historical T02 token families",
  );
  equal(
    tokens.motionTypes,
    ["duration", "cubicBezier", "transition"],
    "Historical T02 motion types",
  );
  equal(
    tokens.orderedSourceIds,
    ["neutral.base", "mode.dark"],
    "Historical T02 token source order",
  );
  if (
    tokens.standard !== "DTCG 2025.10" ||
    tokens.supportedTypeCount !== 9 ||
    tokens.supportedFamilyCount !== 7 ||
    tokens.admittedTokenCount !== 10 ||
    [
      "deterministicOrder",
      "laterSourceWins",
      "aliasResolvedAfterOverlay",
      "crossSourceUntypedAliasTargetIntroducedLater",
      "literalOverrideWinsLast",
      "aliasesObserveLiteralOverride",
      "outputRecursivelyImmutable",
    ].some((key) => tokens[key] !== true)
  ) {
    fail("ARTIFACT_DRIFT", "Historical T02 token semantics drifted.");
  }
  equal(
    tokens.negativeMatrix,
    [
      { id: "alias-cycle", code: "ALIAS_CYCLE", partialResult: false },
      { id: "alias-missing-target", code: "ALIAS_TARGET_MISSING", partialResult: false },
      { id: "alias-type-mismatch", code: "ALIAS_TYPE_MISMATCH", partialResult: false },
      { id: "numeric-overflow", code: "LIMIT_EXCEEDED", partialResult: false },
      { id: "unsafe-accessor", code: "UNSAFE_DTCG_VALUE", partialResult: false },
    ],
    "Historical T02 rejection matrix",
  );
  equal(
    artifact.historicalSc01,
    {
      ...M10A_T02_SC01_PIN,
      effectiveTypes: ["color", "dimension"],
      typeCounts: { color: 20, dimension: 6 },
      aliases: 3,
      fullResolverClaim: false,
      relationship: "UNCHANGED_HISTORICAL_CLOSED_REFERENCE_PROFILE",
    },
    "Historical T02 SC-01 receipt",
  );
  equal(
    artifact.tests,
    {
      rootTestNames: M10A_T02_ROOT_TEST_NAMES,
      packageBehaviorRunsSeparately: true,
      verifierWritesWorkspace: false,
      verifierUsesNetwork: false,
      verifierSpawnsChildren: false,
      hostedExactHeadRequired: true,
    },
    "Historical T02 test receipt",
  );
  equal(
    artifact.nonClaims,
    [
      "T02 does not add the T03 theme editor or any normal App integration.",
      "T02 does not create immutable releases, recipe materialization, asset loading, executable connections, or runtime semantics.",
      "The broader T02 DTCG project profile is a successor and does not rewrite SC-01's historical closed reference profile.",
      "Local deterministic evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
    "Historical T02 non-claims",
  );
  return deepFreeze(artifact);
}

function retired(value, label) {
  options(value, label);
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "M10A-T02 evidence is checkpointed history; successor tasks own current project and token capture.",
  );
}

/** Retires T02 construction without importing the evolving Core package. */
export async function buildM10AT02Evidence(value = undefined) {
  return retired(value, "M10A-T02 builder options");
}

/** Retires T02 capture without permitting a receipt redirect or rewrite. */
export async function writeM10AT02Evidence(value = undefined) {
  return retired(value, "M10A-T02 writer options");
}

/** Authenticates checkpointed T02 evidence without executing current package behavior. */
export async function verifyM10AT02Evidence(value = undefined) {
  options(value, "M10A-T02 verifier options");
  const frozen = await readCheckpointedFrozenArtifact("M10A-T02");
  if (
    frozen.path !== M10A_T02_ARTIFACT_PATH ||
    frozen.byteLength !== ARTIFACT_BYTES ||
    frozen.sha256 !== ARTIFACT_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed T02 artifact receipt drifted.");
  }
  const artifact = authenticateRecordedArtifact(Buffer.from(frozen.bytes));
  return deepFreeze({
    status: "PASS",
    task: "M10A-T02",
    evidenceScope: "historical-artifact-authentication",
    artifactBytes: frozen.byteLength,
    artifactSha256: frozen.sha256,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
    projectDigest: artifact.project.digest,
    tokenTypes: artifact.tokens.supportedTypeCount,
    tokenFamilies: artifact.tokens.supportedFamilyCount,
    rejectedCases: artifact.tokens.negativeMatrix.length,
    historicalSc01Sha256: artifact.historicalSc01.sha256,
    authorityAggregateSha256: AUTHORITY_AGGREGATE_SHA256,
    externalExecution: false,
  });
}

/** Alias for callers requesting recorded historical T02 evidence. */
export async function verifyM10AT02RecordedEvidence(value = undefined) {
  return verifyM10AT02Evidence(value);
}
