import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  M10A_T04_ROOT_TEST_NAMES,
  M10AT04ProofError,
  buildM10AT04Evidence,
  verifyM10AT04Evidence,
  writeM10AT04Evidence,
} from "../scripts/lib/m10a-t04-proof.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_DOCUMENT = path.join(WORKSPACE_ROOT, "docs/proof/M10A-T04.md");
const temporaryDirectories = [];

let built;
let proofDocument;

test.before(async () => {
  [built, proofDocument] = await Promise.all([buildM10AT04Evidence(), readFile(PROOF_DOCUMENT)]);
});

test.after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(M10A_T04_ROOT_TEST_NAMES[0], async () => {
  const second = await buildM10AT04Evidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(built.artifact.task, "M10A-T04");
  assert.equal(built.artifact.proofId, "m10a-t04");
  assert.equal(built.artifact.profile, "desen.design-system-release.proof.v1");
  assert.equal(built.artifact.result, "PASS");
  assert.match(built.artifact.release.digest, /^sha256:[0-9a-f]{64}$/u);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.ok(Object.isFrozen(built.artifact));
});

test(M10A_T04_ROOT_TEST_NAMES[1], () => {
  assert.equal(built.artifact.release.tokenSourceCount, 1);
  assert.equal(built.artifact.release.assetCount, 1);
  assert.equal(built.artifact.release.recipeCount, 1);
  assert.equal(built.artifact.release.immutable, true);
});

test(M10A_T04_ROOT_TEST_NAMES[2], () => {
  assert.notEqual(built.artifact.release.digest, built.artifact.release.changedDependencyDigest);
});

test(M10A_T04_ROOT_TEST_NAMES[3], async () => {
  const altered = Buffer.from(built.artifactBytes);
  altered[altered.length - 2] ^= 1;
  await assert.rejects(
    verifyM10AT04Evidence({ artifactBytes: altered, proofDocumentBytes: proofDocument }),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_ARTIFACT_DRIFT",
  );
});

test(M10A_T04_ROOT_TEST_NAMES[4], () => {
  assert.equal(built.artifact.release.exactReferenceHostProfileId, "web-react");
  assert.deepEqual(built.artifact.release.storeStatuses, ["stored", "unchanged", "unchanged"]);
});

test(M10A_T04_ROOT_TEST_NAMES[5], () => {
  assert.equal(built.artifact.release.interruptedWriteRecovered, true);
});

test(M10A_T04_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.claim.exactSnapshotProjection, true);
  assert.equal(built.artifact.claim.hiddenMetadataRejected, true);
  assert.equal(built.artifact.claim.storeDetachedSnapshots, true);
});

test(M10A_T04_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.claim.boundedInertRecipes, true);
});

test(M10A_T04_ROOT_TEST_NAMES[8], async () => {
  const report = Buffer.from(proofDocument);
  const marker = `sha256:${built.artifactSha256}`;
  const markerIndex = report.indexOf(marker);
  assert.notEqual(markerIndex, -1);
  report[markerIndex + marker.length - 1] =
    report[markerIndex + marker.length - 1] === 48 ? 49 : 48;
  await assert.rejects(
    verifyM10AT04Evidence({ artifactBytes: built.artifactBytes, proofDocumentBytes: report }),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_REPORT_DRIFT",
  );

  const falseClosure = Buffer.from(proofDocument)
    .toString("utf8")
    .replace(
      "**Status:** implementation evidence passes locally; exact-head hosted closure is pending. This\nreport does not start M10A-T05, add runtime activation, or advance G10A.",
      "**Status:** DONE. Exact-head hosted Quality gate and fresh-main closure are recorded below.",
    );
  await assert.rejects(
    verifyM10AT04Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(falseClosure, "utf8"),
    }),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_REPORT_DRIFT",
  );
  await assert.rejects(
    verifyM10AT04Evidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.alloc(256 * 1_024 + 1),
    }),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_OPTIONS_INVALID",
  );
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, "artifactBytes", {
    enumerable: true,
    get() {
      throw new Error("must not invoke option accessor");
    },
  });
  await assert.rejects(
    verifyM10AT04Evidence(accessorOptions),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_OPTIONS_INVALID",
  );
  await assert.rejects(
    verifyM10AT04Evidence(new Proxy({}, {})),
    (error) => error instanceof M10AT04ProofError && error.code === "M10A_T04_OPTIONS_INVALID",
  );
});

test(M10A_T04_ROOT_TEST_NAMES[9], async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m10a-t04-proof-"));
  temporaryDirectories.push(directory);
  const destination = path.join(directory, "artifact.json");
  const prior = Buffer.from("prior artifact remains authoritative\n", "utf8");
  await writeFile(destination, prior);
  await assert.rejects(
    writeM10AT04Evidence({
      artifactPath: destination,
      beforeAtomicRename() {
        throw new Error("simulated interruption before atomic rename");
      },
    }),
    (error) =>
      error instanceof M10AT04ProofError && error.code === "M10A_T04_ARTIFACT_WRITE_UNSAFE",
  );
  assert.deepEqual(await readFile(destination), prior);

  const written = await writeM10AT04Evidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const linkPath = path.join(directory, "link.json");
  await symlink(destination, linkPath);
  await assert.rejects(
    writeM10AT04Evidence({ artifactPath: linkPath }),
    (error) =>
      error instanceof M10AT04ProofError && error.code === "M10A_T04_ARTIFACT_WRITE_UNSAFE",
  );
});

test(M10A_T04_ROOT_TEST_NAMES[10], async () => {
  const result = await verifyM10AT04Evidence();
  const checkpoint = JSON.parse(
    await readFile(path.join(WORKSPACE_ROOT, "scripts/ci/proof-reader-checkpoints.json"), "utf8"),
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.task, "M10A-T04");
  assert.equal(result.checkpointHeadSha256, checkpoint.headSha256);
  assert.notEqual(result.checkpointHeadSha256, "TEST_OVERRIDE");
  assert.equal(result.externalExecution, false);
});
