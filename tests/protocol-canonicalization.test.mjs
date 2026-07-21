import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  calculateDesenBundleRevision,
  calculateDesenSourceDigest,
  sha256Hex,
} from "../packages/protocol/src/canonicalization.ts";
import {
  ProtocolCanonicalizationEvidenceError,
  buildProtocolCanonicalizationEvidence,
  verifyProtocolCanonicalization,
} from "../scripts/lib/protocol-canonicalization-proof.mjs";

const SNAPSHOT_URL = new URL("../packages/protocol/upstream/0.1.0/snapshot/", import.meta.url);
const SOURCE_DIGEST = "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878";
const BUNDLE_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolCanonicalizationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function readFrozenJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, SNAPSHOT_URL), "utf8"));
}

test("accepts exact deterministic canonicalization evidence", async () => {
  const result = await verifyProtocolCanonicalization();

  assert.equal(result.result, "PASS");
  assert.equal(result.rfcNumberSamples, 24);
  assert.equal(result.sha256Vectors, 8);
  assert.equal(result.frozenDesenGoldens, 5);
  assert.equal(result.publicExports.length, 9);
  assert.match(result.artifactSha256, /^[0-9a-f]{64}$/);
});

test("two independent evidence builds are byte-identical", async () => {
  const first = await buildProtocolCanonicalizationEvidence();
  const second = await buildProtocolCanonicalizationEvidence();

  assert.equal(first.artifactBytes.toString("hex"), second.artifactBytes.toString("hex"));
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("rejects stale or tampered canonicalization evidence", async () => {
  const pristine = await buildProtocolCanonicalizationEvidence();
  const tampered = Buffer.from(pristine.artifactBytes);
  tampered[tampered.length - 2] ^= 1;

  await assert.rejects(
    verifyProtocolCanonicalization({ artifactBytes: tampered }),
    hasEvidenceCode("CANONICALIZATION_ARTIFACT_DRIFT"),
  );
});

test("pure ECMAScript SHA-256 agrees with an independent Node crypto oracle", () => {
  for (const length of [...Array.from({ length: 258 }, (_, index) => index), 511, 512, 513, 1000]) {
    const framed = Uint8Array.from(
      { length: length + 2 },
      (_, index) => (index * 31 + length) & 0xff,
    );
    const input = framed.subarray(1, length + 1);
    const expected = createHash("sha256").update(input).digest("hex");
    assert.equal(sha256Hex(input), expected, `byte length ${length}`);
  }
});

test("accepts ordinary JSON and Uint8Array values created in another realm", () => {
  const foreignObject = runInNewContext(`({ z: 1, a: [true, null] })`);
  const foreignBytes = runInNewContext(`new Uint8Array([97, 98, 99])`);

  assert.equal(
    calculateDesenSourceDigest(foreignObject),
    calculateDesenSourceDigest({ a: [true, null], z: 1 }),
  );
  assert.equal(
    sha256Hex(foreignBytes),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("matches the frozen sign-in Source and Bundle golden digests without mutation", async () => {
  const source = await readFrozenJson("examples/sign-in.source.desen.json");
  const bundle = await readFrozenJson("examples/sign-in.bundle.desen.json");
  const sourceBefore = JSON.stringify(source);
  const bundleBefore = JSON.stringify(bundle);

  assert.equal(calculateDesenSourceDigest(source), SOURCE_DIGEST);
  assert.equal(bundle.sourceDigest, SOURCE_DIGEST);
  assert.equal(calculateDesenBundleRevision(bundle), BUNDLE_REVISION);
  assert.equal(bundle.revision, BUNDLE_REVISION);
  assert.equal(JSON.stringify(source), sourceBefore);
  assert.equal(JSON.stringify(bundle), bundleBefore);
});

test("frozen document projections exclude only their named top-level metadata", async () => {
  const source = await readFrozenJson("examples/sign-in.source.desen.json");
  const bundle = await readFrozenJson("examples/sign-in.bundle.desen.json");

  const changedAuthoring = structuredClone(source);
  changedAuthoring.authoring.canvas["sign-in"].x = 999;
  assert.equal(calculateDesenSourceDigest(changedAuthoring), SOURCE_DIGEST);

  const changedSourceExtension = structuredClone(source);
  changedSourceExtension.extensions["com.example/semantic"] = true;
  assert.notEqual(calculateDesenSourceDigest(changedSourceExtension), SOURCE_DIGEST);

  const changedPublication = structuredClone(bundle);
  changedPublication.revision = `sha256:${"f".repeat(64)}`;
  changedPublication.publication.publishedAt = "2099-01-01T00:00:00Z";
  assert.equal(calculateDesenBundleRevision(changedPublication), BUNDLE_REVISION);

  const changedBundleExtension = structuredClone(bundle);
  changedBundleExtension.extensions["com.example/semantic"] = true;
  assert.notEqual(calculateDesenBundleRevision(changedBundleExtension), BUNDLE_REVISION);

  const changedSourceDigest = structuredClone(bundle);
  changedSourceDigest.sourceDigest = `sha256:${"0".repeat(64)}`;
  assert.notEqual(calculateDesenBundleRevision(changedSourceDigest), BUNDLE_REVISION);
});

test("detects the frozen revision-tamper vector without defining diagnostics early", async () => {
  const mismatch = await readFrozenJson("conformance/invalid/bundle-revision-mismatch.json");
  const calculated = calculateDesenBundleRevision(mismatch);

  assert.equal(mismatch.revision, `sha256:${"f".repeat(64)}`);
  assert.equal(calculated, BUNDLE_REVISION);
  assert.notEqual(calculated, mismatch.revision);
});
