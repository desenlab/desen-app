import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  M10A_T09_ADDED_CAPABILITY_IDS,
  M10A_T09_BROWSER_ASSERTION_NAMES,
  M10A_T09_BROWSER_COMMAND,
  M10A_T09_BROWSER_TEST_TITLES,
  M10A_T09_CAPABILITY_IDS,
  M10A_T09_ROOT_TEST_NAMES,
  M10AT09ProofError,
  buildM10AT09Evidence,
  executeM10AT09BrowserProof,
  verifyM10AT09Evidence,
  verifyM10AT09RecordedEvidence,
  writeM10AT09Evidence,
} from "../scripts/lib/m10a-t09-proof.mjs";

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORICAL_ARTIFACT_SHA256 =
  "7fecf6a1b5eebb4a132f55e9641b6137b772bd1bb0df7fb380ef9c1f68289d09";
const HISTORICAL_CATALOG_SHA256 =
  "4e59de0135e7d445bc8c6e029506369bf8b38e40d5df5a57a39f81a799a42a69";
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:88a1fac65d43d166cbc31dceb890468950f677395ab93a62a382955e16b0c709";

function errorCode(expected) {
  return (error) => {
    assert.ok(error instanceof M10AT09ProofError);
    assert.equal(error.code, `M10A_T09_${expected}`);
    return true;
  };
}

test("M10A-T09 authenticates its frozen data-display receipt, not the successor Catalog", async () => {
  const receipt = await verifyM10AT09Evidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T09");
  assert.equal(receipt.packageDigest, HISTORICAL_PACKAGE_DIGEST);
  assert.equal(receipt.catalogSha256, HISTORICAL_CATALOG_SHA256);
  assert.equal(receipt.artifactSha256, HISTORICAL_ARTIFACT_SHA256);
  assert.equal(receipt.artifactBytes, 5_584);
  assert.equal(receipt.browserExecutedByVerifier, false);
  assert.match(receipt.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    receipt.browserTests.map(({ title }) => title),
    M10A_T09_BROWSER_TEST_TITLES,
  );
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.browserTests), true);

  const aliasReceipt = await verifyM10AT09RecordedEvidence();
  assert.deepEqual(aliasReceipt, receipt);
});

test("M10A-T09 preserves its exact frozen artifact and task-time declarations", async () => {
  const artifactPath = path.join(WORKSPACE_ROOT, "docs/proof/artifacts/m10a-t09.json");
  const artifactBytes = await readFile(artifactPath);
  assert.equal(artifactBytes.byteLength, 5_584);
  assert.equal(
    createHash("sha256").update(artifactBytes).digest("hex"),
    HISTORICAL_ARTIFACT_SHA256,
  );
  assert.deepEqual(M10A_T09_ADDED_CAPABILITY_IDS, [
    "run.desen.starter/Alert",
    "run.desen.starter/Avatar",
    "run.desen.starter/Badge",
    "run.desen.starter/Card",
    "run.desen.starter/List",
    "run.desen.starter/Progress",
    "run.desen.starter/Skeleton",
    "run.desen.starter/Table",
  ]);
  assert.equal(M10A_T09_CAPABILITY_IDS.length, 32);
  assert.equal(M10A_T09_BROWSER_TEST_TITLES.length, 4);
  assert.equal(M10A_T09_BROWSER_ASSERTION_NAMES.length, 15);
  assert.equal(M10A_T09_ROOT_TEST_NAMES.length, 6);
  assert.deepEqual(M10A_T09_BROWSER_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/starter-catalog-web-proof", "run", "test:m10a-t09"],
  });
});

test("M10A-T09 capture is retired and cannot redirect or recapture its immutable receipt", async () => {
  await assert.rejects(writeM10AT09Evidence(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(writeM10AT09Evidence({}), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(buildM10AT09Evidence(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(executeM10AT09BrowserProof(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  await assert.rejects(
    writeM10AT09Evidence({ artifactPath: "/tmp/redirected-m10a-t09.json" }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildM10AT09Evidence({ browserObservation: { result: "PASS" } }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    executeM10AT09BrowserProof({ workspaceRoot: "/tmp" }),
    errorCode("OPTIONS_INVALID"),
  );
});

test("M10A-T09 historical verifier rejects injected live-capture authority", async () => {
  await assert.rejects(
    verifyM10AT09Evidence({ browserObservation: { result: "PASS" } }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyM10AT09Evidence({ artifactBytes: Buffer.from("forged") }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyM10AT09Evidence({ workspaceRoot: WORKSPACE_ROOT }),
    errorCode("OPTIONS_INVALID"),
  );
  await assert.rejects(verifyM10AT09Evidence(new Proxy({}, {})), errorCode("OPTIONS_INVALID"));
});

test("M10A-T09 package wiring does not rebuild or test the successor Catalog as historical proof", async () => {
  const packageJson = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["generate:m10a-t09"],
    "node scripts/generate-m10a-t09-proof.mjs",
  );
  assert.equal(packageJson.scripts["verify:m10a-t09"], "node scripts/verify-m10a-t09.mjs");
  assert.equal(packageJson.scripts["test:m10a-t09"], "node --test tests/m10a-t09.test.mjs");
});
