import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH,
  ControlPlaneBundleVerificationEvidenceError,
  buildControlPlaneBundleVerificationEvidence,
  verifyControlPlaneBundleVerificationEvidence,
  writeControlPlaneBundleVerificationEvidence,
} from "../scripts/lib/control-plane-bundle-verification-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json";
const EXPECTED_HASH = "db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a";
const temporaryDirectories = [];
let built;

function expectCode(code) {
  return (error) =>
    error instanceof ControlPlaneBundleVerificationEvidenceError && error.code === code;
}

function changedByte(bytes, index) {
  const copy = Uint8Array.from(bytes);
  copy[index] ^= 1;
  return copy;
}

function exactProof() {
  return `\`${ARTIFACT}\`\n\n\`sha256:${EXPECTED_HASH}\`\n`;
}

async function temporaryDirectory() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t02-reader-")));
  temporaryDirectories.push(directory);
  return directory;
}

function deeplyFrozen(root) {
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (!Object.isFrozen(value)) return false;
    for (const member of Object.values(value)) pending.push(member);
  }
  return true;
}

before(async () => {
  built = await buildControlPlaneBundleVerificationEvidence();
});

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true })));
});

test("authenticates the immutable M07-T02 artifact through the central checkpoint", () => {
  assert.equal(DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.equal(built.artifactSha256, EXPECTED_HASH);
  assert.equal(built.artifactBytes.byteLength, 48_642);
  assert.equal(built.artifact.task, "M07-T02");
  assert.equal(built.artifact.claims.supportedProtocol, "0.1.0");
  assert.equal(built.artifact.tests.packageRuntimeCases, 17);
  assert.equal(built.artifact.tests.packageGuardCases, 6);
  assert.equal(built.artifact.trackedFiles.length, 24);
  assert.equal(built.artifact.distribution.length, 28);
});

test("returns deterministic historical bytes", async () => {
  const second = await buildControlPlaneBundleVerificationEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, EXPECTED_HASH);
});

test("verifies one exact proof pin", async () => {
  const result = await verifyControlPlaneBundleVerificationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument: exactProof(),
  });
  assert.deepEqual(result, {
    result: "PASS",
    task: "M07-T02",
    artifactSha256: EXPECTED_HASH,
    artifactBytes: 48_642,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 24,
    distributionFiles: 28,
    rootMutationCases: 16,
  });
});

test("rejects mutations across the artifact", async () => {
  for (const index of [
    0,
    Math.floor(built.artifactBytes.length / 2),
    built.artifactBytes.length - 1,
  ]) {
    await assert.rejects(
      buildControlPlaneBundleVerificationEvidence({
        artifactBytes: changedByte(built.artifactBytes, index),
      }),
      expectCode("ARTIFACT_DRIFT"),
    );
  }
});

test("rejects malformed proof pins", async () => {
  const valid = exactProof();
  for (const proofDocument of [
    valid.replace(`sha256:${EXPECTED_HASH}`, "sha256:PENDING"),
    valid.replace(EXPECTED_HASH, "0".repeat(64)),
    `${valid}\n${valid}`,
    `\`sha256:${EXPECTED_HASH}\``,
  ]) {
    await assert.rejects(
      verifyControlPlaneBundleVerificationEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      expectCode("PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("rejects symbolic-link authority", async () => {
  const directory = await temporaryDirectory();
  const artifactLink = path.join(directory, "artifact.json");
  const proofLink = path.join(directory, "proof.md");
  await symlink(path.join(directory, "artifact-target.json"), artifactLink);
  await symlink(path.join(directory, "proof-target.md"), proofLink);
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({ artifactPath: artifactLink }),
    expectCode("ARTIFACT_UNSAFE"),
  );
  await assert.rejects(
    verifyControlPlaneBundleVerificationEvidence({
      artifactBytes: built.artifactBytes,
      proofPath: proofLink,
    }),
    expectCode("PROOF_DOCUMENT_UNSAFE"),
  );
});

test("copies exact bytes and protects the old destination on temporary tamper", async () => {
  const directory = await temporaryDirectory();
  const destinationPath = path.join(directory, "copy.json");
  await writeControlPlaneBundleVerificationEvidence({ destinationPath });
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
  await writeFile(destinationPath, "old");
  await assert.rejects(
    writeControlPlaneBundleVerificationEvidence({
      destinationPath,
      beforeAtomicRename: async ({ temporaryPath }) => writeFile(temporaryPath, "tampered"),
    }),
    expectCode("ARTIFACT_WRITE_FAILURE"),
  );
  assert.equal(await readFile(destinationPath, "utf8"), "old");
});

test("rejects active, shared-memory, and ambiguous options", async () => {
  const accessor = {};
  Object.defineProperty(accessor, "artifactBytes", {
    enumerable: true,
    get: () => built.artifactBytes,
  });
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence(accessor),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(4)),
    }),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleVerificationEvidence({
      artifactPath: "x",
      artifactBytes: built.artifactBytes,
    }),
    expectCode("INVALID_OPTIONS"),
  );
});

test("freezes the evidence graph and preserves later-phase nonclaims", () => {
  assert.equal(deeplyFrozen(built.artifact), true);
  assert.equal(built.artifact.nonclaims.length, 7);
});
