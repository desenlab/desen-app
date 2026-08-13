import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH,
  ControlPlanePackagePreflightEvidenceError,
  buildControlPlanePackagePreflightEvidence,
  verifyControlPlanePackagePreflightEvidence,
  writeControlPlanePackagePreflightEvidence,
} from "../scripts/lib/control-plane-package-preflight-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json";
const EXPECTED_HASH = "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628";
const temporaryDirectories = [];
let built;

function expectCode(code) {
  return (error) =>
    error instanceof ControlPlanePackagePreflightEvidenceError && error.code === code;
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
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t03-reader-")));
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
  built = await buildControlPlanePackagePreflightEvidence();
});

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true })));
});

test("authenticates the immutable M07-T03 artifact through the central checkpoint", () => {
  assert.equal(DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.equal(built.artifactSha256, EXPECTED_HASH);
  assert.equal(built.artifactBytes.byteLength, 62_743);
  assert.equal(built.artifact.task, "M07-T03");
  assert.deepEqual(built.artifact.claims.supportedTargets, ["web-react"]);
  assert.equal(built.artifact.tests.packageRuntimeCases, 34);
  assert.equal(built.artifact.tests.packageFocusedCases, 39);
  assert.equal(built.artifact.trackedFiles.length, 23);
  assert.equal(built.artifact.distribution.length, 28);
});

test("returns deterministic historical bytes", async () => {
  const second = await buildControlPlanePackagePreflightEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, EXPECTED_HASH);
});

test("verifies one exact proof pin", async () => {
  const result = await verifyControlPlanePackagePreflightEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument: exactProof(),
  });
  assert.deepEqual(result, {
    result: "PASS",
    task: "M07-T03",
    artifactSha256: EXPECTED_HASH,
    artifactBytes: 62_743,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 23,
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
      buildControlPlanePackagePreflightEvidence({
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
      verifyControlPlanePackagePreflightEvidence({
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
    buildControlPlanePackagePreflightEvidence({ artifactPath: artifactLink }),
    expectCode("ARTIFACT_UNSAFE"),
  );
  await assert.rejects(
    verifyControlPlanePackagePreflightEvidence({
      artifactBytes: built.artifactBytes,
      proofPath: proofLink,
    }),
    expectCode("PROOF_DOCUMENT_UNSAFE"),
  );
});

test("copies exact bytes and protects the old destination on temporary tamper", async () => {
  const directory = await temporaryDirectory();
  const destinationPath = path.join(directory, "copy.json");
  await writeControlPlanePackagePreflightEvidence({ destinationPath });
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
  await writeFile(destinationPath, "old");
  await assert.rejects(
    writeControlPlanePackagePreflightEvidence({
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
    buildControlPlanePackagePreflightEvidence(accessor),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(4)),
    }),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlanePackagePreflightEvidence({
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
