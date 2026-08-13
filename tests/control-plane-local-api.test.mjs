import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH,
  ControlPlaneLocalApiEvidenceError,
  buildControlPlaneLocalApiEvidence,
  verifyControlPlaneLocalApiEvidence,
  writeControlPlaneLocalApiEvidence,
} from "../scripts/lib/control-plane-local-api-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json";
const EXPECTED_HASH = "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9";
const temporaryDirectories = [];
let built;

function expectCode(code) {
  return (error) => error instanceof ControlPlaneLocalApiEvidenceError && error.code === code;
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
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t05-reader-")));
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
  built = await buildControlPlaneLocalApiEvidence();
});

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true })));
});

test("authenticates the immutable M07-T05 artifact through the central checkpoint", () => {
  assert.equal(DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.equal(built.artifactSha256, EXPECTED_HASH);
  assert.equal(built.artifactBytes.byteLength, 41_945);
  assert.equal(built.artifact.proofId, "control-plane-local-api");
  assert.equal(built.artifact.task, "M07-T05");
  assert.equal(built.artifact.tests.packageRuntimeCases, 16);
  assert.equal(built.artifact.tests.compileTimeNegativeCases, 18);
  assert.equal(built.artifact.trackedFiles.length, 22);
  assert.equal(built.artifact.distribution.length, 28);
});

test("returns deterministic historical bytes", async () => {
  const second = await buildControlPlaneLocalApiEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, EXPECTED_HASH);
});

test("verifies one exact proof pin", async () => {
  const result = await verifyControlPlaneLocalApiEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument: exactProof(),
  });
  assert.deepEqual(result, {
    result: "PASS",
    task: "M07-T05",
    artifactSha256: EXPECTED_HASH,
    artifactBytes: 41_945,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 22,
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
      buildControlPlaneLocalApiEvidence({ artifactBytes: changedByte(built.artifactBytes, index) }),
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
      verifyControlPlaneLocalApiEvidence({
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
    buildControlPlaneLocalApiEvidence({ artifactPath: artifactLink }),
    expectCode("ARTIFACT_UNSAFE"),
  );
  await assert.rejects(
    verifyControlPlaneLocalApiEvidence({
      artifactBytes: built.artifactBytes,
      proofPath: proofLink,
    }),
    expectCode("PROOF_DOCUMENT_UNSAFE"),
  );
});

test("copies exact bytes and protects the old destination on temporary tamper", async () => {
  const directory = await temporaryDirectory();
  const destinationPath = path.join(directory, "copy.json");
  await writeControlPlaneLocalApiEvidence({ destinationPath });
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
  await writeFile(destinationPath, "old");
  await assert.rejects(
    writeControlPlaneLocalApiEvidence({
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
  await assert.rejects(buildControlPlaneLocalApiEvidence(accessor), expectCode("INVALID_OPTIONS"));
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(4)),
    }),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneLocalApiEvidence({
      artifactPath: "x",
      artifactBytes: built.artifactBytes,
    }),
    expectCode("INVALID_OPTIONS"),
  );
});

test("freezes the evidence graph and preserves later-phase nonclaims", () => {
  assert.equal(deeplyFrozen(built.artifact), true);
  assert.equal(built.artifact.nonclaims.length, 10);
});
