import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t05.json";

const HISTORICAL_CATALOG = Object.freeze({
  id: "run.desen.starter.web",
  version: "0.2.0",
  target: "web-react",
  sha256: "8772b5e3fe8bc3d4251e3fd7e6231b475affc74d930aaf531c03062e666e8541",
  bytes: 89_863,
});
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:ac99bdb31d76bef5ee42310ed342da187c3fa925d2f0fbbbf67ff11c491ef3e9";
const HISTORICAL_T01_ARTIFACT_SHA256 =
  "711f74398fb1d250d392dd4ff1145527cdaa7ca8673e811c7f753d211554cc74";
const HISTORICAL_T01_CATALOG_SHA256 =
  "0641d4baea6967f57700363a4cdf47ada8118cf39fd7f3bc8a5ec46709402134";

/** Historical browser command preserved in the frozen T05 receipt. */
export const M10A_T05_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:e2e"]),
});

/** Exact task-owned M10A-T05 proof-artifact destination. */
export const M10A_T05_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact capability inventory admitted by the historical T05 starter-library extension. */
export const M10A_T05_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Stack",
  "run.desen.starter/Text",
]);

/** Exact browser test inventory captured in the passing historical T05 receipt. */
export const M10A_T05_BROWSER_TEST_TITLES = Object.freeze(
  [
    "keeps Select and Dialog interactions inside the approved boundary",
    "preserves protocol identity with session isolation, survives StrictMode remount, and isolates the host graph",
    "publishes four Source surfaces and rejects undeclared capability data",
    "renders nested logical layout and safe semantic content in authoring and independent host graphs",
  ].sort(),
);

/** Exact all-true browser assertions captured in the historical T05 receipt. */
export const M10A_T05_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "atomicRequiredSlotInsertion",
    "compatibleLiveRerenderIdentity",
    "compatiblePublicationIdentity",
    "disabledAndLoadingButton",
    "escapeFocusReturn",
    "focusTrap",
    "independentHostGraph",
    "invalidDimensionsRejected",
    "keyboardSelect",
    "logicalRtlAlignment",
    "visibleBorderProjection",
    "nestedLayoutSlots",
    "nestedPortalContainment",
    "portalContainment",
    "privateSelectorsRejected",
    "publisherDerivedAuthoring",
    "sameStaticAdapterRegistry",
    "semanticContent",
    "strictModeUnmountRemount",
    "trustedLocalMedia",
    "unsupportedImageColorRejected",
    "unknownCapabilityRejected",
    "unknownStylePartRejected",
    "visibleVerticalSeparator",
    "wrongEventPayloadRejected",
  ].sort(),
);

/**
 * Stable task-time test declarations serialized in the frozen T05 receipt.
 *
 * They describe the original T05 capture, not the current successor Catalog test plan.
 */
export const M10A_T05_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T05 builds the exact expanded starter Catalog deterministically",
  "M10A-T05 admits only the declared layout and semantic-content capability contracts",
  "M10A-T05 authenticates all-positive authoring and independent-host browser observations",
  "M10A-T05 rejects invalid dimensions, executable content, remote media, and private selectors",
  "M10A-T05 keeps T01 historical evidence immutable while the starter Catalog evolves",
  "M10A-T05 rejects artifact, catalog, and browser-receipt drift",
  "M10A-T05 writer is atomic, leaves the Catalog read-only, and runs the browser in owned temporary authority",
]);

const HISTORICAL_CLAIMS = Object.freeze({
  layoutAndContentCapabilities: true,
  semanticHtmlWhereBaseUiIsUnnecessary: true,
  logicalRtlAlignment: true,
  nestedLayoutSlots: true,
  trustedBuiltInMediaOnly: true,
  unknownStylePropertiesRejected: true,
  invalidDimensionsRejected: true,
  unsupportedImageColorRejected: true,
  visibleVerticalSeparator: true,
  executableContentRejected: true,
  privateSelectorsRejected: true,
  sameStaticAdaptersInCanvasAndHost: true,
  historicalArtifactsRewritten: false,
  runtimeCoreChanged: false,
});
const HISTORICAL_NON_CLAIMS = Object.freeze([
  "T05 does not add arbitrary user asset import, local asset storage, or font admission; T13 owns those boundaries.",
  "T05 does not add normal-App design editing, draft-library persistence, Publisher authority, or Runtime activation.",
  "T05 does not add freeform CSS selectors, executable markup, private DOM access, or remote media URLs.",
  "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
]);

/** Stable error class raised at the bounded M10A-T05 historical proof boundary. */
export class M10AT05ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT05ProofError";
    this.code = "M10A_T05_" + code;
  }
}

function fail(code, message) {
  throw new M10AT05ProofError(code, message);
}

function deepFreeze(value) {
  if (
    value !== null &&
    typeof value === "object" &&
    !ArrayBuffer.isView(value) &&
    !Object.isFrozen(value)
  ) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactRecord(value, expectedKeys, label, failureCode) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(failureCode, label + " must be one inert plain record.");
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(failureCode, label + " fields drifted.");
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(failureCode, label + "." + key + " must be inert own data.");
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function assertExactArray(value, expected, label) {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((item, index) => item !== expected[index])
  ) {
    fail("ARTIFACT_DRIFT", label + " drifted.");
  }
}

function parseHistoricalArtifact(rawBytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBytes));
  } catch {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 evidence must be valid UTF-8 JSON.");
  }
  return value;
}

function captureHistoricalBrowser(rawBrowser) {
  const browser = exactRecord(
    rawBrowser,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Checkpointed M10A-T05 browser",
    "ARTIFACT_DRIFT",
  );
  if (
    browser.profile !== "desen.m10a-t05.browser-proof.v1" ||
    browser.result !== "PASS" ||
    !Array.isArray(browser.graphReceipts) ||
    !Array.isArray(browser.tests)
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 browser identity drifted.");
  }
  assertExactArray(
    browser.graphReceipts,
    ["authoring", "host"],
    "Checkpointed M10A-T05 graph receipt",
  );

  const titles = browser.tests
    .map((candidate, index) => {
      const item = exactRecord(
        candidate,
        ["result", "title"],
        "Checkpointed M10A-T05 browser test " + index,
        "ARTIFACT_DRIFT",
      );
      if (item.result !== "PASS" || typeof item.title !== "string") {
        fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 browser test contains a non-passing case.");
      }
      return item.title;
    })
    .sort();
  assertExactArray(titles, M10A_T05_BROWSER_TEST_TITLES, "Checkpointed M10A-T05 browser tests");

  const assertions = exactRecord(
    browser.assertions,
    M10A_T05_BROWSER_ASSERTION_NAMES,
    "Checkpointed M10A-T05 browser assertions",
    "ARTIFACT_DRIFT",
  );
  if (M10A_T05_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 browser assertions drifted.");
  }
  return deepFreeze(structuredClone(browser));
}

function authenticateHistoricalT05Artifact(rawBytes) {
  const artifact = exactRecord(
    parseHistoricalArtifact(rawBytes),
    [
      "browser",
      "capabilities",
      "claims",
      "historical",
      "nonClaims",
      "package",
      "profile",
      "proofId",
      "result",
      "schemaVersion",
      "task",
      "tests",
    ],
    "Checkpointed M10A-T05 evidence",
    "ARTIFACT_DRIFT",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T05" ||
    artifact.proofId !== "m10a-t05" ||
    artifact.profile !== "desen.m10a-t05.layout-content.v1" ||
    artifact.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 evidence identity drifted.");
  }

  const packageRecord = exactRecord(
    artifact.package,
    ["catalog", "digestProfile", "distBytes", "distFiles", "name", "packageDigest"],
    "Checkpointed M10A-T05 package",
    "ARTIFACT_DRIFT",
  );
  const catalog = exactRecord(
    packageRecord.catalog,
    ["bytes", "id", "sha256", "target", "version"],
    "Checkpointed M10A-T05 catalog",
    "ARTIFACT_DRIFT",
  );
  if (
    packageRecord.name !== "@desen/starter-catalog-web" ||
    packageRecord.digestProfile !== "desen.web-react.package-digest" ||
    packageRecord.packageDigest !== HISTORICAL_PACKAGE_DIGEST ||
    catalog.id !== HISTORICAL_CATALOG.id ||
    catalog.version !== HISTORICAL_CATALOG.version ||
    catalog.target !== HISTORICAL_CATALOG.target ||
    catalog.sha256 !== HISTORICAL_CATALOG.sha256 ||
    catalog.bytes !== HISTORICAL_CATALOG.bytes ||
    packageRecord.distFiles !== 21 ||
    packageRecord.distBytes !== 557_455
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 package receipt drifted.");
  }

  const capabilities = exactRecord(
    artifact.capabilities,
    ["content", "ids", "layout", "logicalProperties", "trustedImageSources"],
    "Checkpointed M10A-T05 capabilities",
    "ARTIFACT_DRIFT",
  );
  assertExactArray(capabilities.ids, M10A_T05_CAPABILITY_IDS, "Checkpointed M10A-T05 capabilities");
  assertExactArray(capabilities.layout, ["Box", "Stack", "Grid"], "Checkpointed M10A-T05 layout");
  assertExactArray(
    capabilities.content,
    ["Text", "Heading", "Image", "Icon", "Separator"],
    "Checkpointed M10A-T05 content",
  );
  assertExactArray(
    capabilities.logicalProperties,
    ["paddingInline", "marginInline", "textAlign", "fill", "hug"],
    "Checkpointed M10A-T05 logical properties",
  );
  assertExactArray(
    capabilities.trustedImageSources,
    ["neutral-horizon", "neutral-grid"],
    "Checkpointed M10A-T05 trusted image sources",
  );

  const historical = exactRecord(
    artifact.historical,
    ["m10aT01ArtifactSha256", "m10aT01CatalogSha256"],
    "Checkpointed M10A-T05 historical chain",
    "ARTIFACT_DRIFT",
  );
  if (
    historical.m10aT01ArtifactSha256 !== HISTORICAL_T01_ARTIFACT_SHA256 ||
    historical.m10aT01CatalogSha256 !== HISTORICAL_T01_CATALOG_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 T01 linkage drifted.");
  }

  const claims = exactRecord(
    artifact.claims,
    Object.keys(HISTORICAL_CLAIMS),
    "Checkpointed M10A-T05 claims",
    "ARTIFACT_DRIFT",
  );
  for (const [name, expected] of Object.entries(HISTORICAL_CLAIMS)) {
    if (claims[name] !== expected) {
      fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 claim drifted: " + name + ".");
    }
  }

  const tests = exactRecord(
    artifact.tests,
    ["browserCommand", "browserExecutedByVerifier", "packageCommand", "rootTestNames"],
    "Checkpointed M10A-T05 tests",
    "ARTIFACT_DRIFT",
  );
  if (
    tests.packageCommand !== "pnpm --filter @desen/starter-catalog-web test" ||
    tests.browserCommand !== "pnpm --filter @desen/starter-catalog-web-proof run test:e2e" ||
    tests.browserExecutedByVerifier !== true
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 test receipt drifted.");
  }
  assertExactArray(
    tests.rootTestNames,
    M10A_T05_ROOT_TEST_NAMES,
    "Checkpointed M10A-T05 root tests",
  );
  assertExactArray(artifact.nonClaims, HISTORICAL_NON_CLAIMS, "Checkpointed M10A-T05 non-claims");

  return deepFreeze({
    artifact,
    browser: captureHistoricalBrowser(artifact.browser),
    packageRecord,
    catalog,
  });
}

/**
 * Retires the former T05 capture path without permitting a historical artifact rewrite.
 *
 * M10A-T06 owns current form-control starter-catalog capture. The T05 receipt remains an
 * immutable task-time record, so neither an alternate destination nor injected observation can
 * cause it to be regenerated.
 */
export async function writeM10AT05Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T05 writer options", "OPTIONS_INVALID");
  }
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "M10A-T05 evidence is checkpointed history; M10A-T06 owns current starter capture.",
  );
}

/**
 * Authenticates exact historical M10A-T05 evidence without rebuilding the evolved starter
 * package or re-running Chromium.
 */
export async function verifyM10AT05Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T05 verifier options", "OPTIONS_INVALID");
  }
  const frozen = await readCheckpointedFrozenArtifact("M10A-T05");
  if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T05 artifact path drifted.");
  }
  const historical = authenticateHistoricalT05Artifact(Buffer.from(frozen.bytes));
  return deepFreeze({
    status: "PASS",
    task: "M10A-T05",
    packageDigest: historical.packageRecord.packageDigest,
    catalogSha256: historical.catalog.sha256,
    artifactSha256: frozen.sha256,
    browserExecutedByVerifier: false,
    browserTests: historical.browser.tests,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
  });
}

/** Alias retained for task-chain callers that request recorded historical T05 evidence. */
export async function verifyM10AT05RecordedEvidence(rawOptions = undefined) {
  return verifyM10AT05Evidence(rawOptions);
}
