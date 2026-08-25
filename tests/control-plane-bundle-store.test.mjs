import assert from "node:assert/strict";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import { createQualityGateSteps } from "../scripts/run-ci-quality-gate.mjs";

import {
  DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH,
  ControlPlaneBundleStoreEvidenceError,
  buildControlPlaneBundleStoreEvidence,
  createImmutableControlPlaneProofReader,
  verifyControlPlaneBundleStoreEvidence,
  writeControlPlaneBundleStoreEvidence,
} from "../scripts/lib/control-plane-bundle-store-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json";
const PROOF = "docs/proof/CONTROL-PLANE-BUNDLE-STORE.md";
const EXPECTED_HASH = "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795";
const temporaryDirectories = [];
let built;

function expectCode(code) {
  return (error) => error instanceof ControlPlaneBundleStoreEvidenceError && error.code === code;
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
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-t01-reader-")));
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
  built = await buildControlPlaneBundleStoreEvidence();
});

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true })));
});

test("authenticates the immutable M07-T01 artifact through the central checkpoint", () => {
  const qualityGateSteps = createQualityGateSteps();
  assert.equal(Object.isFrozen(qualityGateSteps), true);
  const controlPlaneBundleStoreSteps = qualityGateSteps.filter(({ id }) =>
    ["verify-control-plane-bundle-store", "test-control-plane-bundle-store"].includes(id),
  );
  assert.deepEqual(controlPlaneBundleStoreSteps, [
    {
      id: "verify-control-plane-bundle-store",
      label: "Proof verifier: control-plane-bundle-store",
      command: "node",
      args: ["scripts/verify-control-plane-bundle-store.mjs"],
    },
    {
      id: "test-control-plane-bundle-store",
      label: "Root proof and mutation test: control-plane-bundle-store",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/control-plane-bundle-store.test.mjs"],
    },
  ]);
  assert.equal(DEFAULT_CONTROL_PLANE_BUNDLE_STORE_ARTIFACT_PATH, path.join(ROOT, ARTIFACT));
  assert.equal(built.artifactSha256, EXPECTED_HASH);
  assert.equal(built.artifactBytes.byteLength, 22_396);
  assert.equal(built.artifact.task, "M07-T01");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.claims.officialBundle.canonicalBytes, 2_173);
  assert.equal(built.artifact.tests.packageRuntimeCases, 18);
  assert.equal(built.artifact.trackedFiles.length, 24);
  assert.equal(built.artifact.distribution.length, 16);
});

test("returns deterministic bytes without consulting current implementation sources", async () => {
  const second = await buildControlPlaneBundleStoreEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, EXPECTED_HASH);
});

test("verifies one exact proof pin", async () => {
  assert.deepEqual(
    await verifyControlPlaneBundleStoreEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProof(),
    }),
    {
      result: "PASS",
      task: "M07-T01",
      artifactSha256: EXPECTED_HASH,
      artifactBytes: 22_396,
      compatibilityMode: "immutable-task-time-artifact",
      trackedFiles: 24,
      distributionFiles: 16,
      rootMutationCases: 16,
    },
  );
});

test("rejects mutations at the beginning, middle, and end of the artifact", async () => {
  for (const index of [
    0,
    Math.floor(built.artifactBytes.length / 2),
    built.artifactBytes.length - 1,
  ]) {
    await assert.rejects(
      buildControlPlaneBundleStoreEvidence({
        artifactBytes: changedByte(built.artifactBytes, index),
      }),
      expectCode("ARTIFACT_DRIFT"),
    );
  }
});

test("rejects pending, wrong, duplicate, and missing proof pins", async () => {
  const valid = exactProof();
  const variants = [
    valid.replace(`sha256:${EXPECTED_HASH}`, "sha256:PENDING"),
    valid.replace(EXPECTED_HASH, "0".repeat(64)),
    `${valid}\n${valid}`,
    `\`sha256:${EXPECTED_HASH}\``,
  ];
  for (const proofDocument of variants) {
    await assert.rejects(
      verifyControlPlaneBundleStoreEvidence({
        artifactBytes: built.artifactBytes,
        proofDocument,
      }),
      expectCode("PROOF_DOCUMENT_DRIFT"),
    );
  }
});

test("rejects symbolic-link artifact and proof authority", async () => {
  const directory = await temporaryDirectory();
  const artifactLink = path.join(directory, "artifact.json");
  const proofLink = path.join(directory, "proof.md");
  await symlink(path.join(directory, "artifact-target.json"), artifactLink);
  await symlink(path.join(directory, "proof-target.md"), proofLink);
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ artifactPath: artifactLink }),
    expectCode("ARTIFACT_UNSAFE"),
  );
  await assert.rejects(
    verifyControlPlaneBundleStoreEvidence({
      artifactBytes: built.artifactBytes,
      proofPath: proofLink,
    }),
    expectCode("PROOF_DOCUMENT_UNSAFE"),
  );
});

test("rejects hard-linked, oversized, and lstat-to-open swapped authorities", async () => {
  const directory = await temporaryDirectory();
  const hardLinkedArtifact = path.join(directory, "hard-linked-artifact.json");
  const hardLinkSource = path.join(directory, "hard-link-source.json");
  await writeFile(hardLinkSource, built.artifactBytes);
  await link(hardLinkSource, hardLinkedArtifact);
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ artifactPath: hardLinkedArtifact }),
    expectCode("ARTIFACT_UNSAFE"),
  );

  const oversizedArtifact = path.join(directory, "oversized-artifact.json");
  await writeFile(oversizedArtifact, Buffer.alloc(built.artifactBytes.byteLength + 1));
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ artifactPath: oversizedArtifact }),
    expectCode("ARTIFACT_UNSAFE"),
  );

  const swappedArtifact = path.join(directory, "swapped-artifact.json");
  const replacementArtifact = path.join(directory, "replacement-artifact.json");
  const displacedArtifact = path.join(directory, "displaced-artifact.json");
  await writeFile(swappedArtifact, built.artifactBytes);
  await writeFile(replacementArtifact, changedByte(built.artifactBytes, 1));
  let swapped = false;
  const swappingReader = createImmutableControlPlaneProofReader({
    ErrorType: ControlPlaneBundleStoreEvidenceError,
    artifactRelativePath: ARTIFACT,
    proofDocumentRelativePath: PROOF,
    task: "M07-T01",
    profile: built.artifact.profile,
    rootKeys: Object.keys(built.artifact),
    claimKeys: Object.keys(built.artifact.claims),
    trackedFiles: built.artifact.trackedFiles.length,
    distributionFiles: built.artifact.distribution.length,
    prerequisites: built.artifact.prerequisites.length,
    testCounts: { rootMutationCases: built.artifact.tests.rootMutationCases },
    nonclaims: built.artifact.nonclaims.length,
    reproduction: built.artifact.reproduction.length,
    beforeAuthorityOpen: async ({ code }) => {
      if (code !== "ARTIFACT_UNSAFE" || swapped) return;
      swapped = true;
      await rename(swappedArtifact, displacedArtifact);
      await rename(replacementArtifact, swappedArtifact);
    },
  });
  await assert.rejects(
    swappingReader.build({ artifactPath: swappedArtifact }),
    expectCode("ARTIFACT_UNSAFE"),
  );
  assert.equal(swapped, true);
});

test("rejects authority-parent rename to an outside symlink during a read", async () => {
  const directory = await temporaryDirectory();
  const authorityRoot = path.join(directory, "authority-root");
  const parentPath = path.join(authorityRoot, "nested");
  const outsideParent = path.join(directory, "outside-parent");
  const artifactPath = path.join(parentPath, "artifact.json");
  await mkdir(parentPath, { recursive: true });
  await writeFile(artifactPath, built.artifactBytes);
  let swapped = false;
  const reader = createImmutableControlPlaneProofReader({
    ErrorType: ControlPlaneBundleStoreEvidenceError,
    artifactRelativePath: ARTIFACT,
    proofDocumentRelativePath: PROOF,
    task: "M07-T01",
    profile: built.artifact.profile,
    rootKeys: Object.keys(built.artifact),
    claimKeys: Object.keys(built.artifact.claims),
    trackedFiles: built.artifact.trackedFiles.length,
    distributionFiles: built.artifact.distribution.length,
    prerequisites: built.artifact.prerequisites.length,
    testCounts: { rootMutationCases: built.artifact.tests.rootMutationCases },
    nonclaims: built.artifact.nonclaims.length,
    reproduction: built.artifact.reproduction.length,
    authorityRoot,
    beforeAuthorityOpen: async ({ code }) => {
      if (code !== "ARTIFACT_UNSAFE" || swapped) return;
      swapped = true;
      await rename(parentPath, outsideParent);
      await symlink(outsideParent, parentPath, "dir");
    },
  });
  await assert.rejects(reader.build({ artifactPath }), expectCode("ARTIFACT_UNSAFE"));
  assert.equal(swapped, true);
});

test("rejects authority-root rename to an outside symlink during a read", async () => {
  const directory = await temporaryDirectory();
  const authorityRoot = path.join(directory, "authority-root");
  const outsideRoot = path.join(directory, "outside-root");
  const artifactPath = path.join(authorityRoot, "nested/artifact.json");
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, built.artifactBytes);
  let swapped = false;
  const reader = createImmutableControlPlaneProofReader({
    ErrorType: ControlPlaneBundleStoreEvidenceError,
    artifactRelativePath: ARTIFACT,
    proofDocumentRelativePath: PROOF,
    task: "M07-T01",
    profile: built.artifact.profile,
    rootKeys: Object.keys(built.artifact),
    claimKeys: Object.keys(built.artifact.claims),
    trackedFiles: built.artifact.trackedFiles.length,
    distributionFiles: built.artifact.distribution.length,
    prerequisites: built.artifact.prerequisites.length,
    testCounts: { rootMutationCases: built.artifact.tests.rootMutationCases },
    nonclaims: built.artifact.nonclaims.length,
    reproduction: built.artifact.reproduction.length,
    authorityRoot,
    beforeAuthorityOpen: async ({ code }) => {
      if (code !== "ARTIFACT_UNSAFE" || swapped) return;
      swapped = true;
      await rename(authorityRoot, outsideRoot);
      await symlink(outsideRoot, authorityRoot, "dir");
    },
  });
  await assert.rejects(reader.build({ artifactPath }), expectCode("ARTIFACT_UNSAFE"));
  assert.equal(swapped, true);
});

test("copies only the authenticated historical bytes to a custom destination", async () => {
  const directory = await temporaryDirectory();
  const destinationPath = path.join(directory, "copy.json");
  const result = await writeControlPlaneBundleStoreEvidence({ destinationPath });
  assert.equal(result.artifactSha256, EXPECTED_HASH);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("preserves a destination when the atomic temporary is tampered", async () => {
  const directory = await temporaryDirectory();
  const destinationPath = path.join(directory, "copy.json");
  await writeFile(destinationPath, "old");
  await assert.rejects(
    writeControlPlaneBundleStoreEvidence({
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
    buildControlPlaneBundleStoreEvidence(accessor),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({
      artifactBytes: new Uint8Array(new SharedArrayBuffer(4)),
    }),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ artifactPath: "x", artifactBytes: built.artifactBytes }),
    expectCode("INVALID_OPTIONS"),
  );
  await assert.rejects(
    buildControlPlaneBundleStoreEvidence({ extra: true }),
    expectCode("INVALID_OPTIONS"),
  );
});

test("freezes the historical evidence graph and retains its explicit nonclaims", () => {
  assert.equal(deeplyFrozen(built.artifact), true);
  assert.equal(built.artifact.nonclaims.length, 7);
  assert.equal(built.artifact.claims.historicalCompatibility.historicalArtifactsRewritten, false);
});
