import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  M10A_T02_ARTIFACT_PATH,
  M10A_T02_ROOT_TEST_NAMES,
  M10A_T02_SC01_PIN,
  M10AT02ProofError,
  buildM10AT02Evidence,
  verifyM10AT02Evidence,
  verifyM10AT02RecordedEvidence,
  writeM10AT02Evidence,
} from "../scripts/lib/m10a-t02-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT_SHA256 = "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2";
const AGGREGATE_SHA256 = "6a5f57ae8face6679d421a695dc0cf225ed84703af5622bf293324bc21768fb4";

function errorCode(code) {
  return (error) => error instanceof M10AT02ProofError && error.code === `M10A_T02_${code}`;
}

test("M10A-T02 authenticates frozen v1 evidence without importing current Core", async () => {
  const receipt = await verifyM10AT02Evidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T02");
  assert.equal(receipt.evidenceScope, "historical-artifact-authentication");
  assert.equal(receipt.artifactBytes, 11_513);
  assert.equal(receipt.artifactSha256, ARTIFACT_SHA256);
  assert.equal(receipt.authorityAggregateSha256, AGGREGATE_SHA256);
  assert.equal(receipt.tokenTypes, 9);
  assert.equal(receipt.tokenFamilies, 7);
  assert.equal(receipt.rejectedCases, 5);
  assert.equal(receipt.historicalSc01Sha256, M10A_T02_SC01_PIN.sha256);
  assert.equal(receipt.externalExecution, false);
  assert.match(receipt.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(receipt), true);
  assert.deepEqual(await verifyM10AT02RecordedEvidence(), receipt);
});

test("M10A-T02 preserves exact artifact bytes and recorded predecessor semantics", async () => {
  const bytes = await readFile(path.join(WORKSPACE_ROOT, M10A_T02_ARTIFACT_PATH));
  assert.equal(bytes.byteLength, 11_513);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), ARTIFACT_SHA256);
  const artifact = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(artifact.tests.rootTestNames, M10A_T02_ROOT_TEST_NAMES);
  assert.deepEqual(artifact.project.schemaVersions, [1]);
  assert.equal(artifact.project.losses, 0);
  assert.equal(artifact.project.sourcePreservedExactly, true);
  assert.equal(artifact.historicalSc01.fullResolverClaim, false);
  assert.equal(artifact.historicalSc01.leaves, M10A_T02_SC01_PIN.leaves);
  const files = artifact.publicPackage.files;
  const payload = files
    .map(({ path: name, bytes: length, sha256 }) => `${name}\0${length}\0${sha256}\n`)
    .join("");
  assert.equal(files.length, 23);
  assert.equal(
    files.reduce((sum, item) => sum + item.bytes, 0),
    169_240,
  );
  assert.equal(createHash("sha256").update(payload).digest("hex"), AGGREGATE_SHA256);
});

test("M10A-T02 capture is retired without rewriting the historical receipt", async () => {
  const artifactPath = path.join(WORKSPACE_ROOT, M10A_T02_ARTIFACT_PATH);
  const before = await readFile(artifactPath);
  for (const capture of [buildM10AT02Evidence, writeM10AT02Evidence]) {
    await assert.rejects(capture(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
    await assert.rejects(capture({}), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  }
  assert.deepEqual(await readFile(artifactPath), before);
});

test("M10A-T02 rejects injected capture authority and unsafe options without invoking accessors", async () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return WORKSPACE_ROOT;
    },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const unsafe = [
    null,
    [],
    new Proxy({}, {}),
    revoked.proxy,
    Object.create(null),
    accessor,
    { artifactPath: "/tmp/redirected-m10a-t02.json" },
    { artifactBytes: Buffer.from("forged") },
    { workspaceRoot: WORKSPACE_ROOT },
    { runtime: {} },
    { fileOverrides: new Map() },
    { proofDocumentBytes: Buffer.from("forged") },
    {
      beforeAtomicRename() {
        throw new Error("Retired capture must not invoke callbacks.");
      },
    },
    { [Symbol("authority")]: true },
    Object.defineProperty({}, "hidden", { value: true }),
  ];
  for (const boundary of [
    buildM10AT02Evidence,
    writeM10AT02Evidence,
    verifyM10AT02Evidence,
    verifyM10AT02RecordedEvidence,
  ]) {
    for (const value of unsafe) await assert.rejects(boundary(value), errorCode("OPTIONS_INVALID"));
  }
  assert.equal(getterCalls, 0);
});

test("M10A-T02 historical wiring does not build or execute the successor Core package", async () => {
  const pkg = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["generate:m10a-t02"], "node scripts/generate-m10a-t02-proof.mjs");
  assert.equal(pkg.scripts["verify:m10a-t02"], "node scripts/verify-m10a-t02.mjs");
  assert.equal(pkg.scripts["test:m10a-t02"], "node --test tests/m10a-t02.test.mjs");
});
