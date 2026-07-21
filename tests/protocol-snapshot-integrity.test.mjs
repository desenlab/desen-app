import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFile,
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_SNAPSHOT_ROOT,
  EXPECTED_PROTOCOL_SNAPSHOT,
  ProtocolSnapshotIntegrityError,
  parseChecksumManifest,
  verifyProtocolSnapshot,
} from "../scripts/lib/protocol-snapshot-integrity.mjs";

async function createTemporarySnapshot(testContext) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "desen-protocol-snapshot-"));
  const snapshotRoot = path.join(temporaryRoot, "snapshot");
  await cp(DEFAULT_SNAPSHOT_ROOT, snapshotRoot, { recursive: true, preserveTimestamps: true });
  testContext.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  return snapshotRoot;
}

function hasIntegrityCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof ProtocolSnapshotIntegrityError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts the exact frozen DESEN 0.1.0 Git tree", async () => {
  const result = await verifyProtocolSnapshot();

  assert.equal(result.sourceCommit, EXPECTED_PROTOCOL_SNAPSHOT.sourceCommit);
  assert.equal(result.sourceTree, EXPECTED_PROTOCOL_SNAPSHOT.sourceTree);
  assert.equal(result.snapshotFiles, 31);
  assert.equal(result.manifestEntries, 30);
  assert.equal(result.aggregateSha256, EXPECTED_PROTOCOL_SNAPSHOT.aggregateSha256);
});

test("rejects a one-byte-equivalent content change", async (testContext) => {
  const snapshotRoot = await createTemporarySnapshot(testContext);
  await appendFile(path.join(snapshotRoot, "SPEC.md"), "\n");

  await assert.rejects(
    verifyProtocolSnapshot(snapshotRoot),
    hasIntegrityCode("UPSTREAM_FILE_CHECKSUM_MISMATCH"),
  );
});

test("rejects a missing manifest-owned file", async (testContext) => {
  const snapshotRoot = await createTemporarySnapshot(testContext);
  await unlink(path.join(snapshotRoot, "SPEC.md"));

  await assert.rejects(
    verifyProtocolSnapshot(snapshotRoot),
    hasIntegrityCode("UPSTREAM_INVENTORY_MISMATCH"),
  );
});

test("rejects an unexpected extra file", async (testContext) => {
  const snapshotRoot = await createTemporarySnapshot(testContext);
  await writeFile(path.join(snapshotRoot, "unexpected.txt"), "not upstream\n");

  await assert.rejects(
    verifyProtocolSnapshot(snapshotRoot),
    hasIntegrityCode("UPSTREAM_INVENTORY_MISMATCH"),
  );
});

test("rejects coordinated file and manifest tampering", async (testContext) => {
  const snapshotRoot = await createTemporarySnapshot(testContext);
  const specPath = path.join(snapshotRoot, "SPEC.md");
  const manifestPath = path.join(snapshotRoot, "SHA256SUMS");
  await appendFile(specPath, "\n");
  const changedSpec = await readFile(specPath);
  const changedDigest = createHash("sha256").update(changedSpec).digest("hex");
  const originalManifest = await readFile(manifestPath, "utf8");
  const changedManifest = originalManifest.replace(
    /^[0-9a-f]{64} {2}\.\/SPEC\.md$/m,
    `${changedDigest}  ./SPEC.md`,
  );
  await writeFile(manifestPath, changedManifest);

  await assert.rejects(
    verifyProtocolSnapshot(snapshotRoot),
    hasIntegrityCode("UPSTREAM_MANIFEST_CHECKSUM_MISMATCH"),
  );
});

test("rejects a symlink replacing a regular upstream file", async (testContext) => {
  const snapshotRoot = await createTemporarySnapshot(testContext);
  const readmePath = path.join(snapshotRoot, "README.md");
  await unlink(readmePath);
  await symlink("SPEC.md", readmePath);

  await assert.rejects(
    verifyProtocolSnapshot(snapshotRoot),
    hasIntegrityCode("UPSTREAM_UNSUPPORTED_ENTRY"),
  );
});

test("manifest parser rejects duplicate and path-traversal entries", () => {
  const digest = "0".repeat(64);
  assert.throws(
    () => parseChecksumManifest(Buffer.from(`${digest}  ./SPEC.md\n${digest}  ./SPEC.md\n`)),
    hasIntegrityCode("UPSTREAM_MANIFEST_DUPLICATE_PATH"),
  );
  assert.throws(
    () => parseChecksumManifest(Buffer.from(`${digest}  ./../SPEC.md\n`)),
    hasIntegrityCode("UPSTREAM_MANIFEST_UNSAFE_PATH"),
  );
});
