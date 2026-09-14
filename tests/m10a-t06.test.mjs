import assert from "node:assert/strict";
import test from "node:test";

import {
  M10A_T06_BROWSER_ASSERTION_NAMES,
  M10A_T06_BROWSER_COMMAND,
  M10A_T06_BROWSER_TEST_TITLES,
  M10A_T06_CAPABILITY_IDS,
  M10A_T06_FORM_CAPABILITY_IDS,
  M10A_T06_ROOT_TEST_NAMES,
  M10AT06ProofError,
  buildM10AT06Evidence,
  executeM10AT06BrowserProof,
  verifyM10AT06Evidence,
  verifyM10AT06RecordedEvidence,
  writeM10AT06Evidence,
} from "../scripts/lib/m10a-t06-proof.mjs";

const HISTORICAL_CATALOG_SHA256 =
  "e131b8b02be9e4b50d38bf6b0e454ebbd79da8e134ca1d6bd90b943b05beddd5";
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:1b112e64456c2b706336b1be4ae3983e5fbfc21b9d5469df141561ba446da957";
const HISTORICAL_ARTIFACT_SHA256 =
  "21ad7b4dc09acc8813d67684fabb52f5ae6aaad5f0979b0ac050cfacbf957127";

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT06ProofError);
    assert.equal(error.code, "M10A_T06_" + expected);
    return true;
  };
}

test("M10A-T06 authenticates its frozen form-control receipt, not the successor Catalog", async () => {
  const receipt = await verifyM10AT06Evidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T06");
  assert.equal(receipt.packageDigest, HISTORICAL_PACKAGE_DIGEST);
  assert.equal(receipt.catalogSha256, HISTORICAL_CATALOG_SHA256);
  assert.equal(receipt.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
  assert.equal(receipt.artifactBytes, 5_024);
  assert.equal(receipt.browserExecutedByVerifier, false);
  assert.equal(typeof receipt.checkpointHeadSha256, "string");
  assert.match(receipt.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    receipt.browserTests.map(({ title }) => title),
    M10A_T06_BROWSER_TEST_TITLES,
  );
  assert.equal(Object.isFrozen(receipt), true);

  const aliasReceipt = await verifyM10AT06RecordedEvidence();
  assert.deepEqual(aliasReceipt, receipt);
});

test("M10A-T06 preserves its task-time capability and browser receipt declarations", () => {
  assert.deepEqual(M10A_T06_CAPABILITY_IDS, [
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
  assert.deepEqual(M10A_T06_FORM_CAPABILITY_IDS, [
    "run.desen.starter/Checkbox",
    "run.desen.starter/RadioGroup",
    "run.desen.starter/Switch",
    "run.desen.starter/TextArea",
    "run.desen.starter/TextField",
  ]);
  assert.equal(M10A_T06_BROWSER_TEST_TITLES.length, 4);
  assert.equal(M10A_T06_BROWSER_ASSERTION_NAMES.length, 16);
  assert.equal(M10A_T06_ROOT_TEST_NAMES.length, 6);
  assert.deepEqual(M10A_T06_BROWSER_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t06"],
  });
});

test("M10A-T06 capture is retired and cannot redirect or recapture its immutable receipt", async () => {
  await assert.rejects(writeM10AT06Evidence(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(writeM10AT06Evidence({}), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(buildM10AT06Evidence(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(executeM10AT06BrowserProof(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(
    writeM10AT06Evidence({ artifactPath: "/tmp/redirected-m10a-t06.json" }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildM10AT06Evidence({ browserObservation: { result: "PASS" } }),
    errorCode("OPTIONS_INVALID"),
  );
});

test("M10A-T06 historical verifier rejects live-capture options", async () => {
  await assert.rejects(
    verifyM10AT06Evidence({ browserObservation: { result: "PASS" } }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyM10AT06Evidence({ artifactBytes: Buffer.from("forged") }),
    errorCode("OPTIONS_INVALID"),
  );
});
