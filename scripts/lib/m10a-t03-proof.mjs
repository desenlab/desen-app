import { createHash } from "node:crypto";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

/** Relative tracked path of the immutable historical T03 artifact. */
export const M10A_T03_ARTIFACT_PATH = "docs/proof/artifacts/m10a-t03.json";
const ARTIFACT_BYTES = 80_054;
const ARTIFACT_SHA256 = "530efe5d80d78a722c1832ad5b95086c2fd97bc2f1a4bd275b9a1924394b1e2b";
const T02_PIN = Object.freeze({
  path: "docs/proof/artifacts/m10a-t02.json",
  bytes: 11_513,
  sha256: "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2",
});
const T02_AUTHORITY_AGGREGATE = "6a5f57ae8face6679d421a695dc0cf225ed84703af5622bf293324bc21768fb4";
const SC01_PIN = Object.freeze({
  path: "docs/proof/artifacts/sc-01-dtcg-compatibility.json",
  bytes: 31_286,
  sha256: "1df806e0b56d66e27558bbc2bb2f17e0e261b0103c90ed2658ad1eba4c3bdbc6",
});

const BROWSER_TEST_TITLES = Object.freeze([
  "applies a color literal to live preview and supports undo and redo",
  "edits typography atomically and redirects a whole-token alias",
  "round-trips deterministic export and retains working data after invalid import",
  "shows the editable Neutral foundation and switches light and dark modes",
]);
const BROWSER_ASSERTIONS = Object.freeze([
  "visibleNeutralFoundation",
  "lightDarkModeSelection",
  "literalColorAuthoring",
  "exactColorAlpha",
  "livePreview",
  "atomicTypographyComposite",
  "unitAwareTypography",
  "wholeTokenAliasAuthoring",
  "tokenCreation",
  "structuredThemeModeAuthoring",
  "undoRedoInteraction",
  "deterministicExportReimport",
  "invalidImportRetention",
  "unsupportedModePreviewBlocked",
  "isolatedProofGraph",
]);

/** Historical browser command retained for task-time receipt inspection only. */
export const M10A_T03_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze([
    "--filter",
    "@desen/design-system-workbench-proof",
    "run",
    "test:e2e:built",
  ]),
});

/** Historical capture command retained for inspection; execution is retired. */
export const M10A_T03_BROWSER_CAPTURE_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/design-system-workbench-proof", "run", "test:e2e"]),
});

/** Stable task-time declarations retained in the frozen T03 receipt. */
export const M10A_T03_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T03 builds deterministic evidence through the built public package",
  "M10A-T03 proves editable Neutral modes arbitrary values and live preview",
  "M10A-T03 proves atomic typography alias edits and bounded undo redo",
  "M10A-T03 preserves the exact SC-01 compatibility matrix and rejects invalid imports atomically",
  "M10A-T03 preserves T02 Protocol and Runtime Core authorities exactly",
  "M10A-T03 rejects public API package application and browser observation mutations",
  "M10A-T03 verifier rejects artifact and visible-report drift",
  "M10A-T03 writer is atomic and rejects unsafe destinations",
]);

/** Stable redacted failure emitted by the historical T03 evidence boundary. */
export class M10AT03ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT03ProofError";
    this.code = `M10A_T03_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT03ProofError(code, message);
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

function parseArtifact(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("ARTIFACT_DRIFT", `${label} must be valid UTF-8 JSON.`);
  }
}

function receiptAggregate(receipts, prefix, count, expected) {
  if (!Array.isArray(receipts) || receipts.length !== count) {
    fail("ARTIFACT_DRIFT", "Historical receipt inventory drifted.");
  }
  const paths = new Set();
  let byteLength = 0;
  const payload = receipts
    .map((candidate) => {
      const item = exactRecord(candidate, ["path", "bytes", "sha256"], "Historical file receipt");
      if (
        typeof item.path !== "string" ||
        !item.path.startsWith(prefix) ||
        item.path.includes("..") ||
        paths.has(item.path) ||
        !Number.isSafeInteger(item.bytes) ||
        item.bytes <= 0 ||
        typeof item.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(item.sha256)
      ) {
        fail("ARTIFACT_DRIFT", "Historical file receipt is invalid.");
      }
      paths.add(item.path);
      byteLength += item.bytes;
      return `${item.path}\0${item.bytes}\0${item.sha256}\n`;
    })
    .join("");
  // Preserve the original receipt framing without reading the evolving package files.
  const aggregate = createHash("sha256").update(payload, "utf8").digest("hex");
  if (aggregate !== expected) fail("ARTIFACT_DRIFT", "Historical receipt aggregate drifted.");
  return {
    authorityFiles: receipts.length,
    authorityBytes: byteLength,
    authorityAggregateSha256: aggregate,
  };
}

function authenticateT02(bytes) {
  const artifact = exactRecord(
    parseArtifact(bytes, "Checkpointed T02 predecessor"),
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
    "Checkpointed T02 predecessor",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T02" ||
    artifact.proofId !== "m10a-t02" ||
    artifact.profile !== "desen.design-system-core.proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.publicPackage?.name !== "@desen/design-system-core"
  ) {
    fail("ARTIFACT_DRIFT", "Historical T02 predecessor identity drifted.");
  }
  const aggregate = receiptAggregate(
    artifact.publicPackage.files,
    "packages/design-system-core/",
    23,
    T02_AUTHORITY_AGGREGATE,
  );
  if (aggregate.authorityBytes !== 169_240)
    fail("ARTIFACT_DRIFT", "Historical T02 receipt bytes drifted.");
  return {
    artifact: T02_PIN,
    profile: artifact.profile,
    result: artifact.result,
    publicRuntimeExports: artifact.publicPackage.requiredRuntimeExports,
    ...aggregate,
    unchanged: true,
  };
}

function authenticateRecordedArtifact(bytes, t02) {
  const artifact = exactRecord(
    parseArtifact(bytes, "Checkpointed T03 evidence"),
    [
      "schemaVersion",
      "task",
      "proofId",
      "profile",
      "result",
      "claim",
      "publicPackage",
      "authoring",
      "workbench",
      "frozenAuthorities",
      "tests",
      "nonClaims",
    ],
    "Checkpointed T03 evidence",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T03" ||
    artifact.proofId !== "m10a-t03" ||
    artifact.profile !== "desen.theme-token-authoring.proof.v1" ||
    artifact.result !== "PASS"
  )
    fail("ARTIFACT_DRIFT", "Historical T03 identity drifted.");
  equal(
    artifact.claim,
    {
      implementationEvidence: "PASS",
      taskCompletionRequiresHostedExactHead: true,
      platformNeutralAuthoring: true,
      editableNeutralLightDark: true,
      arbitraryProfileValidColorAndTypographyValues: true,
      aliasAndModeAuthoring: true,
      boundedUndoRedo: true,
      livePreviewProjection: true,
      neutralContrastAndFocus: true,
      structuredThemeModeCrud: true,
      literalAndAliasCreation: true,
      lossAwareTransfer: true,
      invalidImportAtomicity: true,
      sc01CompatibilityPreservation: true,
      t02RecognizedUnsupportedPreservation: true,
      unsupportedSelectedModePreviewBlocked: true,
      partialPreviewAuthority: false,
      isolatedWorkbenchProof: true,
    },
    "Historical T03 claims",
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
      "files",
      "authorityAggregateSha256",
    ],
    "Historical T03 package",
  );
  if (
    pkg.name !== "@desen/design-system-authoring" ||
    pkg.private !== true ||
    pkg.type !== "module" ||
    pkg.sideEffects !== false ||
    pkg.onlyReviewedInternalDependencies !== true ||
    pkg.exercisedBuiltPublicRoot !== true
  )
    fail("ARTIFACT_DRIFT", "Historical T03 package boundary drifted.");
  equal(
    pkg.productionDependencies,
    ["@desen/design-system-core", "@desen/protocol"],
    "Historical T03 dependencies",
  );
  equal(
    pkg.requiredRuntimeExports,
    [
      "DESEN_NEUTRAL_THEME_DOCUMENT",
      "THEME_AUTHORING_KIND",
      "THEME_AUTHORING_LIMITS",
      "THEME_AUTHORING_SCHEMA_VERSION",
      "admitThemeAuthoringDocument",
      "applyThemeAuthoringEdit",
      "createThemeAuthoringSession",
      "exportThemeAuthoringDocument",
      "importThemeAuthoringDocument",
      "redoThemeAuthoringEdit",
      "selectThemeAuthoringMode",
      "undoThemeAuthoringEdit",
    ],
    "Historical T03 public exports",
  );
  receiptAggregate(
    pkg.files,
    "packages/design-system-authoring/",
    13,
    pkg.authorityAggregateSha256,
  );
  equal(
    pkg.authorityAggregateSha256,
    "5d34423adf9d5e0b02208d0191ad3ff5aec9954174a338a341559d89ab7d2f95",
    "Historical T03 package receipts",
  );

  const authoring = exactRecord(
    artifact.authoring,
    ["kind", "schemaVersion", "limits", "neutral", "editing", "transfer"],
    "Historical T03 authoring",
  );
  if (
    authoring.kind !== "desen.theme-authoring" ||
    authoring.schemaVersion !== 1 ||
    authoring.neutral.id !== "desen-neutral" ||
    authoring.neutral.tokenCount !== 45 ||
    authoring.neutral.recursivelyImmutable !== true ||
    authoring.editing.undoRestoresExactDocument !== true ||
    authoring.editing.redoRestoresExactDocument !== true ||
    authoring.editing.aliasAwareLivePreview !== true ||
    authoring.transfer.deterministicReimport !== true ||
    authoring.transfer.losses !== 0
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 authoring semantics drifted.");
  }
  equal(
    authoring.limits,
    {
      maxHistoryEntries: 100,
      maxIdentifierCodeUnits: 128,
      maxImportBytes: 8_388_608,
      maxLabelCodeUnits: 512,
      maxModesPerTheme: 16,
      maxThemes: 16,
      maxUnsupportedFeaturesPerOverlay: 64,
    },
    "Historical T03 limits",
  );
  const matrix = authoring.transfer.reviewedUnsupportedMatrix;
  const sc01 = matrix.frozenSc01;
  if (
    sc01.featureFamilies !== 14 ||
    sc01.validFixtures !== 16 ||
    sc01.invalidFixtures !== 7 ||
    sc01.previewReadyUnderT02 !== 3 ||
    sc01.preservedUnsupported !== 13 ||
    sc01.historicalFeaturesSupportedByT02 !== 7 ||
    sc01.historicalFeaturesStillUnsupported !== 9 ||
    sc01.fixtures.length !== 16 ||
    sc01.invalid.length !== 7 ||
    sc01.everyFixtureSurvivedSupportedEditUndoRedoAndReimport !== true ||
    sc01.everyUnsupportedRemainderDisclosed !== true ||
    sc01.everyInvalidAndMaskingImportRetainedExactSession !== true
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 SC-01 compatibility boundary drifted.");
  }
  const unsupported = matrix.t02RecognizedUnsupported;
  if (
    unsupported.validFixtures !== 6 ||
    unsupported.malformedFixtures !== 10 ||
    unsupported.fixtures.length !== 6 ||
    unsupported.malformed.length !== 10 ||
    unsupported.everyFixtureSurvivedSupportedEditUndoRedoAndReimport !== true ||
    unsupported.everyFeatureWasDisclosedAndPreviewBlocked !== true ||
    unsupported.everyMalformedAndMaskingImportRetainedExactSession !== true ||
    [...sc01.fixtures, ...unsupported.fixtures].some(
      (fixture) =>
        fixture.losses !== 0 ||
        fixture.partialPreviewAuthority !== false ||
        fixture.exactExportReimport !== true,
    )
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 preservation and rejection claims drifted.");
  }
  const workbench = exactRecord(
    artifact.workbench,
    [
      "name",
      "private",
      "type",
      "productionDependencies",
      "browserDependency",
      "files",
      "authorityAggregateSha256",
      "browser",
      "browserJourneyCoverage",
      "graph",
      "exactBrowserCases",
      "exactBrowserAssertions",
      "graphModuleCount",
      "normalDesenAppIntegrated",
    ],
    "Historical T03 workbench",
  );
  if (
    workbench.name !== "@desen/design-system-workbench-proof" ||
    workbench.private !== true ||
    workbench.type !== "module" ||
    workbench.exactBrowserCases !== 4 ||
    workbench.exactBrowserAssertions !== 15 ||
    workbench.graphModuleCount !== 24 ||
    workbench.normalDesenAppIntegrated !== false
  )
    fail("ARTIFACT_DRIFT", "Historical T03 workbench boundary drifted.");
  receiptAggregate(
    workbench.files,
    "apps/design-system-workbench-proof/",
    12,
    workbench.authorityAggregateSha256,
  );
  equal(
    workbench.authorityAggregateSha256,
    "3de750ed185dfa5f65b7e61ffddf8c65fe3359e7eec618430622f49d44f67e10",
    "Historical T03 workbench receipts",
  );
  equal(
    workbench.browser,
    {
      profile: "desen.m10a-t03.browser-proof.v1",
      result: "PASS",
      tests: BROWSER_TEST_TITLES.map((title) => ({ title, result: "PASS" })),
      graphReceipts: ["theme-workbench"],
      assertions: Object.fromEntries(BROWSER_ASSERTIONS.map((name) => [name, true])),
    },
    "Historical T03 browser observation",
  );
  const graph = exactRecord(
    workbench.graph,
    ["schemaVersion", "graph", "entry", "result", "assertions", "modules"],
    "Historical T03 graph",
  );
  if (
    graph.schemaVersion !== 1 ||
    graph.graph !== "theme-workbench" ||
    graph.entry !== "index.html" ||
    graph.result !== "PASS" ||
    !Array.isArray(graph.modules) ||
    graph.modules.length !== 24
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 graph identity drifted.");
  }
  equal(
    graph.assertions,
    {
      designSystemAuthoringPresent: true,
      isolatedProofGraph: true,
      forbiddenAuthorities: {
        desenApp: false,
        editor: false,
        publisher: false,
        runtime: false,
        starterCatalog: false,
      },
    },
    "Historical T03 graph boundary",
  );
  if (
    workbench.browserJourneyCoverage.partialPreviewAuthority !== false ||
    workbench.browserJourneyCoverage.visibleFocusOutlinePx !== 2 ||
    workbench.browserJourneyCoverage.unsupportedSelectedModePreviewBlocked !== true
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 browser coverage drifted.");
  }
  const frozen = exactRecord(
    artifact.frozenAuthorities,
    ["t02", "sc01", "protocol", "runtimeCore"],
    "Historical T03 foundations",
  );
  equal(frozen.t02, t02, "Historical T03 to T02 predecessor link");
  equal(frozen.sc01.artifact, SC01_PIN, "Historical T03 SC-01 artifact");
  if (
    frozen.sc01.classification !== "DTCG_2025_10_COMPATIBLE_CLOSED_REFERENCE_PROFILE" ||
    frozen.sc01.featureFamilies.length !== 14 ||
    frozen.sc01.validButUnsupportedFixtures.length !== 16 ||
    frozen.sc01.invalidFixtures.length !== 7 ||
    frozen.sc01.unchanged !== true
  ) {
    fail("ARTIFACT_DRIFT", "Historical T03 SC-01 foundation drifted.");
  }
  equal(
    frozen.protocol,
    {
      protocol: "0.1.0",
      sourceCommit: "b0bd7c4f0f61555b1d90e3a2ceb90d6e3d43daca",
      sourceTree: "cd7afa57888095718c4ee82b69b5b282980763c8",
      manifestSha256: "92e1c817d75ddc71e993de0dcf42ad7003738b6a59dc57905b879f872828c2cd",
      aggregateSha256: "afe8fc359465ce891f4325fcdeca4b2f12bca48f1aa54a34c4f3a97985f7e060",
      snapshotFiles: 31,
      manifestEntries: 30,
      totalBytes: 306_604,
      unchanged: true,
    },
    "Historical T03 protocol receipt",
  );
  equal(
    frozen.runtimeCore,
    {
      artifact: {
        path: "docs/proof/artifacts/runtime-core-baseline.json",
        bytes: 271,
        sha256: "fbda58d72ccff36d530368422dd7fd82c73dcca359c29e3a6667e8ae4b9b424b",
      },
      profile: "desen.runtime-core-baseline.v1",
      objectFormat: "sha1",
      tree: "3fa3613a3be63c749f40b6a0b55af5b40c675773",
      trackedFiles: 61,
      clean: true,
      unchanged: true,
    },
    "Historical T03 Runtime Core receipt",
  );
  equal(
    artifact.tests,
    {
      rootTestNames: M10A_T03_ROOT_TEST_NAMES,
      packageBehaviorRunsSeparately: true,
      publicPackageRunsSeparately: true,
      browserExecutedByVerifier: true,
      verifierUsesNetwork: false,
      verifierSpawnsBoundedLocalChildren: true,
      hostedExactHeadRequired: true,
    },
    "Historical T03 test receipt",
  );
  equal(
    artifact.nonClaims,
    [
      "T03 does not integrate the theme workbench into the normal Desen App.",
      "T03 does not persist projects, create immutable releases, publish or activate token data, or change Runtime semantics.",
      "The isolated browser workbench is implementation evidence, not a production application or visual-regression system.",
      "The frozen SC-01 matrix bounds the standards claim to 14 reviewed feature families, 16 exact valid-but-unsupported fixtures, and seven exact invalid fixtures; it is not a general DTCG parser, resolver, or arbitrary-input conformance verdict.",
      "All 16 historical SC-01 fixtures are preserved without silent loss. The three complete documents now fully supported by T02 are preview-ready and emit no false disclosure; the 13 documents with a remaining unsupported member are disclosed, inert, and preview-blocked without partial or production authority.",
      "Local deterministic evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
    ],
    "Historical T03 non-claims",
  );
  return deepFreeze(artifact);
}

function retired(value, label) {
  options(value, label);
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "M10A-T03 evidence is checkpointed history; successor tasks own current authoring and browser capture.",
  );
}

/** Retires T03 artifact construction without importing current authoring or Core packages. */
export async function buildM10AT03Evidence(value = undefined) {
  return retired(value, "M10A-T03 builder options");
}

/** Retires execution of the former T03 Chromium capture path. */
export async function executeM10AT03BrowserProof(value = undefined) {
  return retired(value, "M10A-T03 browser-proof options");
}

/** Retires the combined T03 capture path without launching any child process. */
export async function executeM10AT03Evidence(value = undefined) {
  return retired(value, "M10A-T03 execution options");
}

/** Retires the T03 writer without permitting a receipt redirect or rewrite. */
export async function writeM10AT03Evidence(value = undefined) {
  return retired(value, "M10A-T03 writer options");
}

/** Authenticates frozen T03 evidence and its recorded T02 predecessor without current capture. */
export async function verifyM10AT03Evidence(value = undefined) {
  options(value, "M10A-T03 verifier options");
  const [frozen, predecessor] = await Promise.all([
    readCheckpointedFrozenArtifact("M10A-T03"),
    readCheckpointedFrozenArtifact("M10A-T02"),
  ]);
  if (
    frozen.path !== M10A_T03_ARTIFACT_PATH ||
    frozen.byteLength !== ARTIFACT_BYTES ||
    frozen.sha256 !== ARTIFACT_SHA256 ||
    predecessor.path !== T02_PIN.path ||
    predecessor.byteLength !== T02_PIN.bytes ||
    predecessor.sha256 !== T02_PIN.sha256 ||
    predecessor.checkpointHeadSha256 !== frozen.checkpointHeadSha256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed T03 artifact or predecessor receipt drifted.");
  }
  const artifact = authenticateRecordedArtifact(
    Buffer.from(frozen.bytes),
    authenticateT02(Buffer.from(predecessor.bytes)),
  );
  const matrix = artifact.authoring.transfer.reviewedUnsupportedMatrix;
  return deepFreeze({
    status: "PASS",
    task: "M10A-T03",
    evidenceScope: "historical-artifact-authentication",
    artifactBytes: frozen.byteLength,
    artifactSha256: frozen.sha256,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
    authoringRuntimeExports: artifact.publicPackage.requiredRuntimeExports.length,
    neutralTokens: artifact.authoring.neutral.tokenCount,
    browserCases: artifact.workbench.exactBrowserCases,
    browserAssertions: artifact.workbench.exactBrowserAssertions,
    browserTests: artifact.workbench.browser.tests,
    t02ArtifactSha256: predecessor.sha256,
    t02AuthorityAggregateSha256: T02_AUTHORITY_AGGREGATE,
    sc01ArtifactSha256: artifact.frozenAuthorities.sc01.artifact.sha256,
    sc01ValidFixtures: matrix.frozenSc01.validFixtures,
    sc01PreviewReadyUnderT02: matrix.frozenSc01.previewReadyUnderT02,
    sc01PreservedUnsupported: matrix.frozenSc01.preservedUnsupported,
    t02RecognizedUnsupportedFixtures: matrix.t02RecognizedUnsupported.validFixtures,
    t02RecognizedMalformedFixtures: matrix.t02RecognizedUnsupported.malformedFixtures,
    protocolAggregateSha256: artifact.frozenAuthorities.protocol.aggregateSha256,
    runtimeCoreTree: artifact.frozenAuthorities.runtimeCore.tree,
    browserExecutedByVerifier: false,
    externalNetwork: false,
  });
}

/** Alias for callers requesting recorded historical T03 evidence. */
export async function verifyM10AT03RecordedEvidence(value = undefined) {
  return verifyM10AT03Evidence(value);
}
