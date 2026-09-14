import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

import { readCheckpointedFrozenArtifact } from "../ci/proof-reader-checkpoints.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/m10a-t06.json";

const HISTORICAL_CATALOG = Object.freeze({
  id: "run.desen.starter.web",
  version: "0.3.0",
  target: "web-react",
  sha256: "e131b8b02be9e4b50d38bf6b0e454ebbd79da8e134ca1d6bd90b943b05beddd5",
  bytes: 237_432,
});
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:1b112e64456c2b706336b1be4ae3983e5fbfc21b9d5469df141561ba446da957";
const HISTORICAL_T05_ARTIFACT_SHA256 =
  "3c78a9a6b61081a57e9c48b44dc74aa2d12e457679f383ffbd85224372d92ab7";
const HISTORICAL_T05_CATALOG_SHA256 =
  "8772b5e3fe8bc3d4251e3fd7e6231b475affc74d930aaf531c03062e666e8541";

/** Historical browser command preserved in the frozen T06 receipt. */
export const M10A_T06_BROWSER_COMMAND = Object.freeze({
  command: "pnpm",
  args: Object.freeze(["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t06"]),
});

/** Exact task-owned M10A-T06 proof-artifact destination. */
export const M10A_T06_ARTIFACT_PATH = path.join(WORKSPACE_ROOT, ARTIFACT_RELATIVE_PATH);

/** Exact capability inventory admitted by the historical T06 form-control extension. */
export const M10A_T06_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Box",
  "run.desen.starter/Button",
  "run.desen.starter/Checkbox",
  "run.desen.starter/Dialog",
  "run.desen.starter/Grid",
  "run.desen.starter/Heading",
  "run.desen.starter/Icon",
  "run.desen.starter/Image",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Select",
  "run.desen.starter/Separator",
  "run.desen.starter/Stack",
  "run.desen.starter/Switch",
  "run.desen.starter/Text",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
]);

/** Exact form-control additions captured in the historical T06 receipt. */
export const M10A_T06_FORM_CAPABILITY_IDS = Object.freeze([
  "run.desen.starter/Checkbox",
  "run.desen.starter/RadioGroup",
  "run.desen.starter/Switch",
  "run.desen.starter/TextArea",
  "run.desen.starter/TextField",
]);

/** Exact browser case inventory captured by the historical isolated T06 proof. */
export const M10A_T06_BROWSER_TEST_TITLES = Object.freeze(
  [
    "publishes the T06 form surfaces through the reviewed starter Catalog",
    "preserves native labels and described messages in authoring and independent host graphs",
    "projects controlled form changes through the Runtime event boundary",
    "retains Button disabled/loading behavior and rejects malformed form payloads",
  ].sort(),
);

/** Exact all-true browser assertions captured by the historical isolated T06 proof. */
export const M10A_T06_BROWSER_ASSERTION_NAMES = Object.freeze(
  [
    "allFormCapabilitiesPublished",
    "controlledCheckboxChange",
    "controlledRadioGroupChange",
    "controlledSwitchChange",
    "controlledTextAreaChange",
    "controlledTextFieldChange",
    "disabledAndLoadingButton",
    "helpAndErrorAssociation",
    "independentHostGraph",
    "invalidFormValueRejected",
    "keyboardFocus",
    "malformedFormPayloadRejected",
    "nativeLabelAssociation",
    "publisherDerivedAuthoring",
    "safeStyleProjectionRetainsSemantics",
    "sameStaticAdapterRegistry",
  ].sort(),
);

/**
 * Stable task-time test declarations serialized in the frozen T06 receipt.
 *
 * They describe the original 0.3.0 capture rather than requirements for a successor Catalog.
 */
export const M10A_T06_ROOT_TEST_NAMES = Object.freeze([
  "M10A-T06 builds the exact 0.3.0 starter Catalog deterministically",
  "M10A-T06 admits only the declared form-control contracts and controlled event payloads",
  "M10A-T06 authenticates all-positive authoring and independent-host form browser observations",
  "M10A-T06 rejects malformed form observations, artifact drift, and unsafe injected data",
  "M10A-T06 preserves the checkpointed T05 receipt while the starter Catalog evolves",
  "M10A-T06 writer is atomic, leaves the Catalog read-only, and runs Chromium in owned temporary authority",
]);

const HISTORICAL_CONTROLLED_EVENT_PAYLOADS = Object.freeze([
  "TextField.change:{value:string}",
  "TextArea.change:{value:string}",
  "Checkbox.change:{checked:boolean}",
  "RadioGroup.change:{value:string}",
  "Switch.change:{checked:boolean}",
]);
const HISTORICAL_ACCESSIBLE_PARTS = Object.freeze(["label", "help", "error"]);
const HISTORICAL_CLAIMS = Object.freeze({
  boundedFormCapabilities: true,
  controlledEventPayloadsOnly: true,
  nativeLabelHelpErrorComposition: true,
  styleProjectionRetainsSemantics: true,
  keyboardFocusValidated: true,
  buttonDisabledLoadingRetained: true,
  malformedFormPayloadRejected: true,
  sameStaticAdaptersInCanvasAndHost: true,
  historicalArtifactsRewritten: false,
  runtimeCoreChanged: false,
});
const HISTORICAL_NON_CLAIMS = Object.freeze([
  "T06 does not add normal-App design editing, draft-library persistence, Publisher authority, or Runtime activation.",
  "T06 does not add arbitrary CSS selectors, executable markup, private DOM access, or remote media URLs.",
  "T06 does not create business actions or application state beyond bounded controlled form event payloads.",
  "Local evidence does not substitute for exact-head hosted Quality gate and fresh-main closure.",
]);

/** Stable error class raised at the bounded M10A-T06 historical proof boundary. */
export class M10AT06ProofError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "M10AT06ProofError";
    this.code = "M10A_T06_" + code;
  }
}

function fail(code, message) {
  throw new M10AT06ProofError(code, message);
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
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 evidence must be valid UTF-8 JSON.");
  }
  return value;
}

function captureHistoricalBrowser(rawBrowser) {
  const browser = exactRecord(
    rawBrowser,
    ["assertions", "graphReceipts", "profile", "result", "tests"],
    "Checkpointed M10A-T06 browser",
    "ARTIFACT_DRIFT",
  );
  if (
    browser.profile !== "desen.m10a-t06.browser-proof.v1" ||
    browser.result !== "PASS" ||
    !Array.isArray(browser.graphReceipts) ||
    !Array.isArray(browser.tests)
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 browser identity drifted.");
  }
  assertExactArray(
    browser.graphReceipts,
    ["authoring", "host"],
    "Checkpointed M10A-T06 graph receipt",
  );

  const titles = browser.tests
    .map((candidate, index) => {
      const item = exactRecord(
        candidate,
        ["result", "title"],
        "Checkpointed M10A-T06 browser test " + index,
        "ARTIFACT_DRIFT",
      );
      if (item.result !== "PASS" || typeof item.title !== "string") {
        fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 browser test contains a non-passing case.");
      }
      return item.title;
    })
    .sort();
  assertExactArray(titles, M10A_T06_BROWSER_TEST_TITLES, "Checkpointed M10A-T06 browser tests");

  const assertions = exactRecord(
    browser.assertions,
    M10A_T06_BROWSER_ASSERTION_NAMES,
    "Checkpointed M10A-T06 browser assertions",
    "ARTIFACT_DRIFT",
  );
  if (M10A_T06_BROWSER_ASSERTION_NAMES.some((name) => assertions[name] !== true)) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 browser assertions drifted.");
  }
  return deepFreeze(structuredClone(browser));
}

function authenticateHistoricalT06Artifact(rawBytes) {
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
    "Checkpointed M10A-T06 evidence",
    "ARTIFACT_DRIFT",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M10A-T06" ||
    artifact.proofId !== "m10a-t06" ||
    artifact.profile !== "desen.m10a-t06.form-controls.v1" ||
    artifact.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 evidence identity drifted.");
  }

  const packageRecord = exactRecord(
    artifact.package,
    ["catalog", "digestProfile", "distBytes", "distFiles", "name", "packageDigest"],
    "Checkpointed M10A-T06 package",
    "ARTIFACT_DRIFT",
  );
  const catalog = exactRecord(
    packageRecord.catalog,
    ["bytes", "id", "sha256", "target", "version"],
    "Checkpointed M10A-T06 catalog",
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
    packageRecord.distFiles !== 25 ||
    packageRecord.distBytes !== 1_307_199
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 package receipt drifted.");
  }

  const capabilities = exactRecord(
    artifact.capabilities,
    ["accessibleParts", "controlledEventPayloads", "formControls", "ids"],
    "Checkpointed M10A-T06 capabilities",
    "ARTIFACT_DRIFT",
  );
  assertExactArray(capabilities.ids, M10A_T06_CAPABILITY_IDS, "Checkpointed M10A-T06 capabilities");
  assertExactArray(
    capabilities.formControls,
    M10A_T06_FORM_CAPABILITY_IDS,
    "Checkpointed M10A-T06 form controls",
  );
  assertExactArray(
    capabilities.controlledEventPayloads,
    HISTORICAL_CONTROLLED_EVENT_PAYLOADS,
    "Checkpointed M10A-T06 controlled payloads",
  );
  assertExactArray(
    capabilities.accessibleParts,
    HISTORICAL_ACCESSIBLE_PARTS,
    "Checkpointed M10A-T06 accessible parts",
  );

  const historical = exactRecord(
    artifact.historical,
    ["m10aT05ArtifactSha256", "m10aT05CatalogSha256"],
    "Checkpointed M10A-T06 historical chain",
    "ARTIFACT_DRIFT",
  );
  if (
    historical.m10aT05ArtifactSha256 !== HISTORICAL_T05_ARTIFACT_SHA256 ||
    historical.m10aT05CatalogSha256 !== HISTORICAL_T05_CATALOG_SHA256
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 T05 linkage drifted.");
  }

  const claims = exactRecord(
    artifact.claims,
    Object.keys(HISTORICAL_CLAIMS),
    "Checkpointed M10A-T06 claims",
    "ARTIFACT_DRIFT",
  );
  for (const [name, expected] of Object.entries(HISTORICAL_CLAIMS)) {
    if (claims[name] !== expected) {
      fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 claim drifted: " + name + ".");
    }
  }

  const tests = exactRecord(
    artifact.tests,
    ["browserCommand", "browserExecutedByVerifier", "packageCommand", "rootTestNames"],
    "Checkpointed M10A-T06 tests",
    "ARTIFACT_DRIFT",
  );
  if (
    tests.packageCommand !== "pnpm --filter @desen/starter-catalog-web test" ||
    tests.browserCommand !== "pnpm --filter @desen/starter-catalog-web-proof run test:m10a-t06" ||
    tests.browserExecutedByVerifier !== true
  ) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 test receipt drifted.");
  }
  assertExactArray(
    tests.rootTestNames,
    M10A_T06_ROOT_TEST_NAMES,
    "Checkpointed M10A-T06 root tests",
  );
  assertExactArray(artifact.nonClaims, HISTORICAL_NON_CLAIMS, "Checkpointed M10A-T06 non-claims");

  return deepFreeze({
    artifact,
    browser: captureHistoricalBrowser(artifact.browser),
    packageRecord,
    catalog,
  });
}

function rejectHistoricalCapture(rawOptions, label) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], label, "OPTIONS_INVALID");
  }
  fail(
    "HISTORICAL_CAPTURE_RETIRED",
    "M10A-T06 evidence is checkpointed history; successor Catalog tasks own current capture.",
  );
}

/**
 * Retires the former T06 browser capture path without permitting a historical artifact rewrite.
 *
 * The recorded browser command remains evidence only; invoking it again would test a successor
 * Catalog rather than reproduce the sealed T06 task-time authority.
 */
export async function executeM10AT06BrowserProof(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T06 browser-proof options");
}

/**
 * Retires T06 artifact construction so callers cannot synthesize a receipt from current Catalog
 * bytes or a new browser observation.
 */
export async function buildM10AT06Evidence(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T06 builder options");
}

/**
 * Retires the former T06 capture writer without permitting a frozen artifact rewrite or redirect.
 */
export async function writeM10AT06Evidence(rawOptions = undefined) {
  return rejectHistoricalCapture(rawOptions, "M10A-T06 writer options");
}

/**
 * Authenticates exact historical M10A-T06 evidence without rebuilding an evolved starter package
 * or re-running Chromium.
 */
export async function verifyM10AT06Evidence(rawOptions = undefined) {
  if (rawOptions !== undefined) {
    exactRecord(rawOptions, [], "M10A-T06 verifier options", "OPTIONS_INVALID");
  }
  const frozen = await readCheckpointedFrozenArtifact("M10A-T06");
  if (frozen.path !== ARTIFACT_RELATIVE_PATH) {
    fail("ARTIFACT_DRIFT", "Checkpointed M10A-T06 artifact path drifted.");
  }
  const historical = authenticateHistoricalT06Artifact(Buffer.from(frozen.bytes));
  return deepFreeze({
    status: "PASS",
    task: "M10A-T06",
    artifactBytes: frozen.byteLength,
    packageDigest: historical.packageRecord.packageDigest,
    catalogSha256: historical.catalog.sha256,
    artifactSha256: frozen.sha256,
    browserExecutedByVerifier: false,
    browserTests: historical.browser.tests,
    checkpointHeadSha256: frozen.checkpointHeadSha256,
  });
}

/** Alias retained for task-chain callers that request recorded historical T06 evidence. */
export async function verifyM10AT06RecordedEvidence(rawOptions = undefined) {
  return verifyM10AT06Evidence(rawOptions);
}
