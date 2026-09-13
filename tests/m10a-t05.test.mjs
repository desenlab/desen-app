import assert from "node:assert/strict";
import test from "node:test";

import {
  M10A_T05_BROWSER_ASSERTION_NAMES,
  M10A_T05_BROWSER_COMMAND,
  M10A_T05_BROWSER_TEST_TITLES,
  M10A_T05_CAPABILITY_IDS,
  M10A_T05_ROOT_TEST_NAMES,
  M10AT05ProofError,
  verifyM10AT05Evidence,
  verifyM10AT05RecordedEvidence,
  writeM10AT05Evidence,
} from "../scripts/lib/m10a-t05-proof.mjs";

const HISTORICAL_CATALOG_SHA256 =
  "8772b5e3fe8bc3d4251e3fd7e6231b475affc74d930aaf531c03062e666e8541";
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:ac99bdb31d76bef5ee42310ed342da187c3fa925d2f0fbbbf67ff11c491ef3e9";
const HISTORICAL_ARTIFACT_SHA256 =
  "3c78a9a6b61081a57e9c48b44dc74aa2d12e457679f383ffbd85224372d92ab7";

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT05ProofError);
    assert.equal(error.code, "M10A_T05_" + expected);
    return true;
  };
}

test("M10A-T05 authenticates its frozen layout-and-content receipt, not the successor Catalog", async () => {
  const receipt = await verifyM10AT05Evidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T05");
  assert.equal(receipt.packageDigest, HISTORICAL_PACKAGE_DIGEST);
  assert.equal(receipt.catalogSha256, HISTORICAL_CATALOG_SHA256);
  assert.equal(receipt.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
  assert.equal(receipt.browserExecutedByVerifier, false);
  assert.equal(typeof receipt.checkpointHeadSha256, "string");
  assert.match(receipt.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    receipt.browserTests.map(({ title }) => title),
    M10A_T05_BROWSER_TEST_TITLES,
  );
  assert.equal(Object.isFrozen(receipt), true);

  const aliasReceipt = await verifyM10AT05RecordedEvidence();
  assert.deepEqual(aliasReceipt, receipt);
});

test("M10A-T05 preserves its task-time capability and browser receipt declarations", () => {
  assert.deepEqual(M10A_T05_CAPABILITY_IDS, [
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
  assert.equal(M10A_T05_BROWSER_TEST_TITLES.length, 4);
  assert.equal(M10A_T05_BROWSER_ASSERTION_NAMES.length, 25);
  assert.equal(M10A_T05_ROOT_TEST_NAMES.length, 7);
  assert.deepEqual(M10A_T05_BROWSER_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/starter-catalog-web-proof", "run", "test:e2e"],
  });
});

test("M10A-T05 capture is retired and cannot redirect its immutable receipt", async () => {
  await assert.rejects(writeM10AT05Evidence(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(writeM10AT05Evidence({}), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(
    writeM10AT05Evidence({ artifactPath: "/tmp/redirected-m10a-t05.json" }),
    errorCode("OPTIONS_INVALID"),
  );
});

test("M10A-T05 historical verifier rejects live-capture options", async () => {
  await assert.rejects(
    verifyM10AT05Evidence({ browserObservation: { result: "PASS" } }),
    errorCode("OPTIONS_INVALID"),
  );
});
