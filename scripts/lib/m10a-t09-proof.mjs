import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t09.json";
const T08_ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t08.json";

const HISTORICAL_T09_ARTIFACT_SHA256 =
  "7fecf6a1b5eebb4a132f55e9641b6137b772bd1bb0df7fb380ef9c1f68289d09";
const HISTORICAL_T09_ARTIFACT_BYTES = 5_584;
const HISTORICAL_T08_ARTIFACT_SHA256 =
  "37bfd7458fac6001b396632dc167a155aca56c3d5a62b93c1df144284428a729";
const HISTORICAL_T08_CATALOG_SHA256 =
  "d125bc3a7a83c0cedb56c4202585d3110849b71eb33043896d57973e2b08045e";
const HISTORICAL_CATALOG = Object.freeze({
  id: "run.desen.starter.web",
  version: "0.6.0",
  target: "web-react",
  sha256: "4e59de0135e7d445bc8c6e029506369bf8b38e40d5df5a57a39f81a799a42a69",
  bytes: 585_861,
});
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:88a1fac65d43d166cbc31dceb890468950f677395ab93a62a382955e16b0c709";

/** Historical browser command preserved in the frozen T09 receipt. */
export const M10A_T09_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t09"]),
});

/** Exact historical M10A-T09 artifact destination; capture is retired. */
export const M10A_T09_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact capability inventory admitted by the historical T09 extension. */
export const M10A_T09_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Accordion",
  "run.desen.starter/Alert",
  "run.desen.starter/Avatar",
  "run.desen.starter/Badge",
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Card",
  "run.desen.starter/Checkbox",
  "run.desen.starter/Combobox",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/List",
  "run.desen.starter/Menu",
  "run.desen.starter/NumberField",
  "run.desen.starter/Popover",
  "run.desen.starter/Progress",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Skeleton",
  "run.desen.starter/Slider",
  "run.desen.starter/Stack",
  "run.desen.starter/Switch",
  "run.desen.starter/Table",
  "run.desen.starter/Tabs",
  "run.desen.starter/Text",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
  "run.desen.starter/Tooltip",
]);

/** Exact data-display and feedback additions recorded by historical T09. */
export const M10A_T09_ADDED_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Alert",
  "run.desen.starter/Avatar",
  "run.desen.starter/Badge",
  "run.desen.starter/Card",
  "run.desen.starter/List",
  "run.desen.starter/Progress",
  "run.desen.starter/Skeleton",
  "run.desen.starter/Table",
]);

/** Exact browser cases captured in the historical isolated T09 proof. */
export const M10A_T09_BROWSER_TEST_TITLES = Object.freeze(
  [
    "publishes the T09 data-display and feedback inventory through the reviewed starter Catalog",
    "renders empty loading error and ready examples with text alternatives and table semantics",
    "renders the same sample-data scenarios in the independent host graph without an operation",
    "retains bounded repeats and row identities while rejecting grid and malformed-data authority",
  ].sort(),
);

/** Exact all-true browser assertions captured in the historical T09 receipt. */
export const M10A_T09_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "allDataDisplayFeedbackCapabilitiesPublished",
    "authoringGraphPresent",
    "avatarTextAlternative",
    "emptyExample",
    "enterpriseGridNotAdmitted",
    "errorExample",
    "explicitListItemSlots",
    "independentHostGraph",
    "loadingExample",
    "readyExample",
    "repeatBoundEnforced",
    "sameStaticAdapterRegistry",
    "sampleDataWithoutOperation",
    "stableRowIdentity",
    "tableSemantics",
  ].sort(),
);

/** Stable task-time test declarations serialized in the historical T09 receipt. */
export const M10A_T09_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T09 builds the exact 0.6.0 data-display and feedback Catalog deterministically",
  "M10A-T09 admits bounded sample data, explicit item slots, and stable table row identities",
  "M10A-T09 authenticates authoring and independent-host browser observations",
  "M10A-T09 rejects malformed browser observations, artifact drift, and unsafe evidence options",
  "M10A-T09 preserves the checkpointed T08 historical receipt while the starter Catalog evolves",
  "M10A-T09 writer is atomic and leaves current artifact bytes deterministic",
]);

const HISTORICAL_CLAIMS = Object.freeze({
  boundedSampleData: true,
  explicitItemSlots: true,
  nativeTableSemantics: true,
  stableRowIdentity: true,
  textAlternatives: true,
  emptyLoadingErrorReadyExamples: true,
  sampleDataWithoutOperation: true,
  enterpriseGridNotAdmitted: true,
  sameStaticAdaptersInAuthoringAndHost: true,
  historicalArtifactsRewritten: false,
  runtimeCoreChanged: false,
});

const HISTORICAL_NON_CLAIMS = Object.freeze([
  "T09 does not add normal-App persistence, Publisher authority, Runtime activation, or M11 behavior.",
  "T09 does not admit enterprise-grid features, charts, server pagination, sorting, callbacks, renderers, selectors, executable markup, or remote media URLs.",
  "T09 sample-data contracts do not bind operations; later data resolution remains outside this task boundary.",
  "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
]);

/** Stable error class raised at the historical M10A-T09 proof boundary. */
export class M10AT09ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT09ProofError";
    this.code = `M10A_T09_${code}`;
  }
}

function fail(code, message) {
  throw new M10AT09ProofError(code, message);
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
    fail(failureCode, `${label} must be one inert plain record.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail(failureCode, `${label} fields drifted.`);
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail(failureCode, `${label}.${key} must be inert own data.`);
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
    fail("ARTIFACT_DRIFT", `${label} drifted.`);
  }
}

function parseHistoricalArtifact(rawBytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBytes));
  } catch {
    fail("ARTIFACT_DRIFT", `${label} must be valid UTF-8 JSON.`);
  }
}

function captureHistoricalBrowser(rawBrowser) {
  const browser = exactRecord(
    rawBrowser,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Checkpointed M10A-T09 browser",
    "ARTIFACT_DRIFT",
  );
  if (
    browser.profile !== "desen.m10a-t09.browser-proof.v1" ||
    browser.result !== "PASS" ||
    !Array.isArray(browser.graphReceipts) ||
    !Array.isArray(browser.tests)
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 browser identity drifted.");
  }
  assertExactArray(
    browser.graphReceipts,
    ["authoring", "host"],
    "Checkpointed M10A-T09 graph receipt",
  );
  const titles = browser.tests.map((candidate, index) => {
    const item = exactRecord(
      candidate,
      ["result", "title"],
      `Checkpointed M10A-T09 browser test ${index}`,
      "ARTIFACT_DRIFT",
    );
    if (item.result !== "PASS" || typeof item.title !== "string") {
      fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 browser test contains a non-passing case.");
    }
    return item.title;
  });
  assertExactArray(titles, M10A_T09_BROWSER_TEST_TITLES, "Checkpointed M10A-T09 browser tests");

  const assertions = exactRecord(
    browser.assertions,
    M10A_T09_BROWSER_ASSERTION_NAMES,
    "Checkpointed M10A-T09 browser assertions",
    "ARTIFACT_DRIFT",
  );
  if (M10A_T09_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 browser assertions drifted.");
  }
  return deepFreeze(structuredClone(browser));
}

function authenticateHistoricalT08Link(rawBytes) {
  const artifact = exactRecord(
    parseHistoricalArtifact(rawBytes, "Checkpointed M10A-T08 evidence"),
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
    "Checkpointed M10A-T08 evidence",
    "ARTIFACT_DRIFT",
  );
  const packageRecord = exactRecord(
    artifact.package,
    ["catalog", "digestProfile", "distBytes", "distFiles", "name", "packageDigest"],
    "Checkpointed M10A-T08 package",
    "ARTIFACT_DRIFT",
  );
  const catalog = exactRecord(
    packageRecord.catalog,
    ["bytes", "id", "sha256", "target", "version"],
    "Checkpointed M10A-T08 catalog",
    "ARTIFACT_DRIFT",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T08" ||
    artifact.proofId !== "m10a-t08" ||
    artifact.profile !== "desen.m10a-t08.overlays-disclosures.v1" ||
    artifact.result !== "PASS" ||
    catalog.id !== "run.desen.starter.web" ||
    catalog.version !== "0.5.0" ||
    catalog.target !== "web-react" ||
    catalog.sha256 !== HISTORICAL_T08_CATALOG_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T08 linkage authority drifted.");
  }
  return catalog.sha256;
}

function authenticateHistoricalT09Artifact(rawBytes, t08) {
  const artifact = exactRecord(
    parseHistoricalArtifact(rawBytes, "Checkpointed M10A-T09 evidence"),
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
    "Checkpointed M10A-T09 evidence",
    "ARTIFACT_DRIFT",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T09" ||
    artifact.proofId !== "m10a-t09" ||
    artifact.profile !== "desen.m10a-t09.data-display-feedback.v1" ||
    artifact.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 evidence identity drifted.");
  }

  const packageRecord = exactRecord(
    artifact.package,
    ["catalog", "digestProfile", "distBytes", "distFiles", "name", "packageDigest"],
    "Checkpointed M10A-T09 package",
    "ARTIFACT_DRIFT",
  );
  const catalog = exactRecord(
    packageRecord.catalog,
    ["bytes", "id", "sha256", "target", "version"],
    "Checkpointed M10A-T09 catalog",
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
    packageRecord.distFiles !== 37 ||
    packageRecord.distBytes !== 3_155_509
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 package receipt drifted.");
  }

  const capabilities = exactRecord(
    artifact.capabilities,
    ["added", "ids", "listIdentity", "repeatLimit", "requiredSlots", "table", "tableRowIdentity"],
    "Checkpointed M10A-T09 capabilities",
    "ARTIFACT_DRIFT",
  );
  assertExactArray(capabilities.ids, M10A_T09_CAPABILITY_IDS, "Checkpointed M10A-T09 capabilities");
  assertExactArray(
    capabilities.added,
    M10A_T09_ADDED_CAPABILITY_IDS,
    "Checkpointed M10A-T09 added capabilities",
  );
  assertExactArray(
    capabilities.requiredSlots,
    ["Card.content", "List.items"],
    "Checkpointed M10A-T09 required slots",
  );
  if (
    capabilities.listIdentity !== "stable-id" ||
    capabilities.table !== "native-caption-header-cell-semantics" ||
    capabilities.tableRowIdentity !== "stable-id" ||
    capabilities.repeatLimit !== 100
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 capability detail drifted.");
  }

  const historical = exactRecord(
    artifact.historical,
    ["m10aT08ArtifactSha256", "m10aT08CatalogSha256"],
    "Checkpointed M10A-T09 historical chain",
    "ARTIFACT_DRIFT",
  );
  if (
    historical.m10aT08ArtifactSha256 !== HISTORICAL_T08_ARTIFACT_SHA256 ||
    historical.m10aT08ArtifactSha256 !== t08.artifactSha256 ||
    historical.m10aT08CatalogSha256 !== HISTORICAL_T08_CATALOG_SHA256 ||
    historical.m10aT08CatalogSha256 !== t08.catalogSha256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 T08 linkage drifted.");
  }

  const claims = exactRecord(
    artifact.claims,
    Object.keys(HISTORICAL_CLAIMS),
    "Checkpointed M10A-T09 claims",
    "ARTIFACT_DRIFT",
  );
  for (const [name, expected] of Object.entries(HISTORICAL_CLAIMS)) {
    if (claims[name] !== expected) {
      fail("ARTIFACT_DRIFT", `Checkpointed M10A-T09 claim drifted: ${name}.`);
    }
  }

  const tests = exactRecord(
    artifact.tests,
    ["browserCommand", "browserExecutedByVerifier", "packageCommand", "rootTestNames"],
    "Checkpointed M10A-T09 tests",
    "ARTIFACT_DRIFT",
  );
  if (
    tests.packageCommand !== "pnpm --filter @desen/starter-catalog-web test" ||
    tests.browserCommand !== "pnpm --filter @desen/starter-catalog-web-proof run test:m10a-t09" ||
    tests.browserExecutedByVerifier !== true
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 test receipt drifted.");
  }
  assertExactArray(
    tests.rootTestNames,
    M10A_T09_ROOT_TEST_NAMES,
    "Checkpointed M10A-T09 root tests",
  );
  assertExactArray(artifact.nonClaims, HISTORICAL_NON_CLAIMS, "Checkpointed M10A-T09 non-claims");

  return deepFreeze({
    browser: captureHistoricalBrowser(artifact.browser),
    catalog,
    packageRecord,
  });
}

function rejectHistoricalCapture(rawOptions, label) {
  if (rawOptions !== undefined) exactRecord(rawOptions, [], label, "OPTIONS_INVALID");
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "M10A-T09 evidence is checkpointed history; successor Catalog tasks own current capture.",
  );
}

/** Retires the former T09 browser capture path without re-running a successor Catalog. */
export async function executeM10AT09BrowserProof(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T09 browser-proof options");
}

/** Retires T09 artifact construction so current Catalog bytes cannot rewrite its receipt. */
export async function buildM10AT09Evidence(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T09 builder options");
}

/** Retires the former T09 capture writer without permitting a receipt redirect or rewrite. */
export async function writeM10AT09Evidence(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T09 writer options");
}

/** Authenticates exact historical T09 evidence and its checkpointed T08 predecessor. */
export async function verifyM10AT09Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T09 verifier options", "OPTIONS_INVALID");
  }
  const [frozenT09, frozenT08] = await Promise.all([
    readCheckpointedFrozenArtifact("M10A-T09"),
    readCheckpointedFrozenArtifact("M10A-T08"),
  ]);
  if (
    frozenT09.path !== ARTIFACT_RELATIVE_PATH ||
    frozenT09.byteLength !== HISTORICAL_T09_ARTIFACT_BYTES ||
    frozenT09.sha256 !== HISTORICAL_T09_ARTIFACT_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T09 artifact receipt drifted.");
  }
  if (
    frozenT08.path !== T08_ARTIFACT_RELATIVE_PATH ||
    frozenT08.sha256 !== HISTORICAL_T08_ARTIFACT_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T08 predecessor receipt drifted.");
  }
  const t08CatalogSha256 = authenticateHistoricalT08Link(Buffer.from(frozenT08.bytes));
  const historical = authenticateHistoricalT09Artifact(Buffer.from(frozenT09.bytes), {
    artifactSha256: frozenT08.sha256,
    catalogSha256: t08CatalogSha256,
  });
  return deepFreeze({
    status: "PASS",
    task: "M10A-T09",
    artifactBytes: frozenT09.byteLength,
    artifactSha256: frozenT09.sha256,
    catalogSha256: historical.catalog.sha256,
    packageDigest: historical.packageRecord.packageDigest,
    browserTests: historical.browser.tests,
    browserExecutedByVerifier: false,
    checkpointHeadSha256: frozenT09.checkpointHeadSha256,
  });
}

/** Alias retained for callers that request recorded historical T09 evidence. */
export async function verifyM10AT09RecordedEvidence(rawOptions = undefined) {
  return verifyM10AT09Evidence(rawOptions);
}
