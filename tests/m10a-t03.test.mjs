import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  M10A_T03_ARTIFACT_PATH,
  M10A_T03_BROWSER_COMMAND,
  M10A_T03_BROWSER_CAPTURE_COMMAND,
  M10A_T03_ROOT_TEST_NAMES,
  M10AT03ProofError,
  buildM10AT03Evidence,
  executeM10AT03BrowserProof,
  executeM10AT03Evidence,
  verifyM10AT03Evidence,
  verifyM10AT03RecordedEvidence,
  writeM10AT03Evidence,
} from "../scripts/lib/m10a-t03-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT_SHA256 = "530efe5d80d78a722c1832ad5b95086c2fd97bc2f1a4bd275b9a1924394b1e2b";
const T02_ARTIFACT_SHA256 = "135dffbab6bc2c0d73e93caf2da6edbbeb7cec2653555fc5c128e1de0f5936c2";
const T02_AGGREGATE_SHA256 = "6a5f57ae8face6679d421a695dc0cf225ed84703af5622bf293324bc21768fb4";

function errorCode(code) {
  return (error) => error instanceof M10AT03ProofError && error.code === `M10A_T03_${code}`;
}

test("M10A-T03 authenticates frozen authoring evidence without executing the successor workbench", async () => {
  const receipt = await verifyM10AT03Evidence();
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.task, "M10A-T03");
  assert.equal(receipt.evidenceScope, "historical-artifact-authentication");
  assert.equal(receipt.artifactBytes, 80_054);
  assert.equal(receipt.artifactSha256, ARTIFACT_SHA256);
  assert.equal(receipt.t02ArtifactSha256, T02_ARTIFACT_SHA256);
  assert.equal(receipt.t02AuthorityAggregateSha256, T02_AGGREGATE_SHA256);
  assert.equal(receipt.authoringRuntimeExports, 12);
  assert.equal(receipt.neutralTokens, 45);
  assert.equal(receipt.browserCases, 4);
  assert.equal(receipt.browserAssertions, 15);
  assert.equal(receipt.sc01ValidFixtures, 16);
  assert.equal(receipt.sc01PreviewReadyUnderT02, 3);
  assert.equal(receipt.sc01PreservedUnsupported, 13);
  assert.equal(receipt.t02RecognizedUnsupportedFixtures, 6);
  assert.equal(receipt.t02RecognizedMalformedFixtures, 10);
  assert.equal(receipt.browserExecutedByVerifier, false);
  assert.equal(receipt.externalNetwork, false);
  assert.match(receipt.checkpointHeadSha256, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.browserTests), true);
  assert.deepEqual(await verifyM10AT03RecordedEvidence(), receipt);
});

test("M10A-T03 preserves artifact bytes and derives its T02 link from recorded receipts", async () => {
  const [bytes, t02Bytes] = await Promise.all([
    readFile(path.join(WORKSPACE_ROOT, M10A_T03_ARTIFACT_PATH)),
    readFile(path.join(WORKSPACE_ROOT, "docs/proof/artifacts/m10a-t02.json")),
  ]);
  assert.equal(bytes.byteLength, 80_054);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), ARTIFACT_SHA256);
  assert.equal(createHash("sha256").update(t02Bytes).digest("hex"), T02_ARTIFACT_SHA256);
  const artifact = JSON.parse(bytes.toString("utf8"));
  const t02 = JSON.parse(t02Bytes.toString("utf8"));
  const files = t02.publicPackage.files;
  const aggregate = createHash("sha256")
    .update(
      files
        .map(({ path: name, bytes: length, sha256 }) => `${name}\0${length}\0${sha256}\n`)
        .join(""),
    )
    .digest("hex");
  assert.equal(aggregate, T02_AGGREGATE_SHA256);
  assert.deepEqual(artifact.frozenAuthorities.t02, {
    artifact: {
      path: "docs/proof/artifacts/m10a-t02.json",
      bytes: t02Bytes.byteLength,
      sha256: T02_ARTIFACT_SHA256,
    },
    profile: t02.profile,
    result: t02.result,
    publicRuntimeExports: t02.publicPackage.requiredRuntimeExports,
    authorityFiles: files.length,
    authorityBytes: files.reduce((sum, item) => sum + item.bytes, 0),
    authorityAggregateSha256: aggregate,
    unchanged: true,
  });
  assert.deepEqual(artifact.tests.rootTestNames, M10A_T03_ROOT_TEST_NAMES);
  assert.equal(artifact.tests.browserExecutedByVerifier, true);
  assert.equal(artifact.workbench.normalDesenAppIntegrated, false);
  assert.equal(artifact.claim.partialPreviewAuthority, false);
  assert.equal(artifact.authoring.transfer.losses, 0);
  assert.deepEqual(M10A_T03_BROWSER_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/design-system-workbench-proof", "run", "test:e2e:built"],
  });
  assert.deepEqual(M10A_T03_BROWSER_CAPTURE_COMMAND, {
    command: "pnpm",
    args: ["--filter", "@desen/design-system-workbench-proof", "run", "test:e2e"],
  });
});

test("M10A-T03 capture and browser execution are retired without rewriting the receipt", async () => {
  const artifactPath = path.join(WORKSPACE_ROOT, M10A_T03_ARTIFACT_PATH);
  const before = await readFile(artifactPath);
  for (const capture of [
    buildM10AT03Evidence,
    executeM10AT03BrowserProof,
    executeM10AT03Evidence,
    writeM10AT03Evidence,
  ]) {
    await assert.rejects(capture(), errorCode("HISTORICAL_CAPTURE_RETIRED"));
    await assert.rejects(capture({}), errorCode("HISTORICAL_CAPTURE_RETIRED"));
  }
  assert.deepEqual(await readFile(artifactPath), before);
});

test("M10A-T03 rejects injected live authority and unsafe options without invoking accessors", async () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "browserObservation", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { result: "PASS" };
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
    { artifactPath: "/tmp/redirected-m10a-t03.json" },
    { artifactBytes: Buffer.from("forged") },
    { workspaceRoot: WORKSPACE_ROOT },
    { runtime: {} },
    { coreRuntime: {} },
    { fileOverrides: new Map() },
    { proofDocumentBytes: Buffer.from("forged") },
    { browserObservation: { result: "PASS" } },
    { graphObservation: { result: "PASS" } },
    { environment: {} },
    { command: "capture" },
    {
      beforeAtomicRename() {
        throw new Error("Retired capture must not invoke callbacks.");
      },
    },
    { [Symbol("authority")]: true },
    Object.defineProperty({}, "hidden", { value: true }),
  ];
  for (const boundary of [
    buildM10AT03Evidence,
    executeM10AT03BrowserProof,
    executeM10AT03Evidence,
    writeM10AT03Evidence,
    verifyM10AT03Evidence,
    verifyM10AT03RecordedEvidence,
  ]) {
    for (const value of unsafe) await assert.rejects(boundary(value), errorCode("OPTIONS_INVALID"));
  }
  assert.equal(getterCalls, 0);
});

test("M10A-T03 historical wiring does not build Core authoring or the successor browser harness", async () => {
  const pkg = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["generate:m10a-t03"], "node scripts/generate-m10a-t03-proof.mjs");
  assert.equal(pkg.scripts["verify:m10a-t03"], "node scripts/verify-m10a-t03.mjs");
  assert.equal(pkg.scripts["test:m10a-t03"], "node --test tests/m10a-t03.test.mjs");
});
