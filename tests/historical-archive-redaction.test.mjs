import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";

import {
  GENERATOR_REDACTION_RECEIPTS,
  getHistoricalArchiveRedactionPin,
  inspectHistoricalArchiveRedaction,
} from "../scripts/lib/historical-archive-redaction.mjs";
import {
  HISTORICAL_ARCHIVE_REDACTION_ARTIFACT_PIN,
  HISTORICAL_ARCHIVE_REDACTION_PATHS,
  HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES,
  HistoricalArchiveRedactionProofError,
  buildHistoricalArchiveRedactionEvidence,
  verifyHistoricalArchiveRedactionEvidence,
  writeHistoricalArchiveRedactionEvidence,
} from "../scripts/lib/historical-archive-redaction-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECKPOINT = "scripts/ci/proof-reader-checkpoints.json";
const ARTIFACT = "docs/proof/artifacts/historical-archive-redaction.json";
const directories = [];
let built;
let fixture;

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const mutated = (bytes) => {
  const copy = Buffer.from(bytes);
  copy[Math.floor(copy.byteLength / 2)] ^= 1;
  return copy;
};
const expected = (code) => (error) => {
  assert.ok(error instanceof HistoricalArchiveRedactionProofError);
  assert.equal(error.code, code);
  return true;
};

async function temporaryDirectory() {
  const result = await realpath(await mkdtemp(path.join(os.tmpdir(), "desen-ar01-test-")));
  directories.push(result);
  return result;
}

function proofDocument(sha256) {
  return Buffer.from(
    [
      "# Historical archive redaction",
      "Task: AR-01",
      "Git history is not rewritten",
      "Original compressed archives are not reconstructed",
      `Final artifact: \`sha256:${sha256}\``,
      "",
    ].join("\n"),
  );
}

async function buildWithOverride(relativePath, bytes) {
  return buildHistoricalArchiveRedactionEvidence({
    fileOverrides: new Map([[relativePath, bytes]]),
  });
}

before(async () => {
  built = await buildHistoricalArchiveRedactionEvidence();
  fixture = await temporaryDirectory();
  const paths = new Set([
    CHECKPOINT,
    ...HISTORICAL_ARCHIVE_REDACTION_PATHS,
    ...built.artifact.authority.generators.map(({ current }) => current.path),
    ...built.artifact.authority.implementation.map(({ path: relativePath }) => relativePath),
    ...built.artifact.authority.preservedHistory.frozenArtifacts.map(
      ({ path: relativePath }) => relativePath,
    ),
  ]);
  for (const relativePath of paths) {
    const destination = path.join(fixture, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(ROOT, relativePath), destination);
  }
});

after(async () => {
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.task, "AR-01");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifact.authority.archives.length, 4);
  for (const entry of built.artifact.authority.archives) {
    const pin = getHistoricalArchiveRedactionPin(entry.path);
    assert.deepEqual(entry.historical, pin.historical);
    assert.deepEqual(entry.current, pin.current);
    assert.notEqual(entry.historical.sha256, entry.current.sha256);
    assert.match(entry.technicalAuthoritySha256, /^[0-9a-f]{64}$/u);
  }
  assert.deepEqual(built.artifact.authority.generators, GENERATOR_REDACTION_RECEIPTS);
  assert.equal(built.artifact.boundary.productBehaviorChanged, false);
  assert.equal(built.artifact.boundary.m10T05Started, false);
  assert.equal(built.artifact.boundary.oldProofReadersInvoked, false);
  assert.equal(built.artifact.privacy.historicalArchiveBytesClaimedCurrent, false);
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[1], async () => {
  const history = built.artifact.authority.preservedHistory;
  assert.equal(history.throughSequence, 70);
  assert.equal(history.frozenArtifactCount, 57);
  assert.equal(
    history.headSha256,
    "52e71083e7c6f08986480434b5a327b1de6a2d29487b8f8a7ecbef1ffdb4d4e6",
  );
  assert.equal(
    new Set(history.frozenArtifacts.map(({ path: relativePath }) => relativePath)).size,
    57,
  );
  for (const item of history.frozenArtifacts) {
    const bytes = await readFile(path.join(ROOT, item.path));
    assert.equal(bytes.byteLength, item.bytes);
    assert.equal(digest(bytes), item.sha256);
  }
  const another = await buildHistoricalArchiveRedactionEvidence();
  assert.deepEqual(another.artifactBytes, built.artifactBytes);
  assert.equal(another.artifactSha256, built.artifactSha256);
  assert.equal(Object.isFrozen(another.artifact.authority.archives), true);
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[2], async () => {
  assert.equal(built.artifact.privacy.decodedContentsEmitted, false);
  assert.equal(built.artifact.privacy.removedContentReconstructed, false);
  assert.ok(built.artifact.privacy.documentationFilesChecked > 0);
  let checked = 0;
  for (const relativePath of HISTORICAL_ARCHIVE_REDACTION_PATHS) {
    const inspected = inspectHistoricalArchiveRedaction(
      relativePath,
      await readFile(path.join(ROOT, relativePath)),
    );
    for (const [name, bytes] of inspected.decodedFiles) {
      if (!name.endsWith(".md")) continue;
      checked += 1;
      assert.doesNotMatch(
        bytes.toString("utf8"),
        /^#{1,6}[^\n]*(?:public build-log drafts|social(?: media)? drafts)/imu,
      );
    }
  }
  assert.equal(checked, built.artifact.privacy.documentationFilesChecked);
  const keys = (value, result = []) => {
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) {
        result.push(key);
        keys(child, result);
      }
    return result;
  };
  assert.equal(
    keys(built.artifact).some((key) =>
      ["decodedFiles", "base64", "rawContent", "removedText"].includes(key),
    ),
    false,
  );
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[3], async () => {
  for (const relativePath of HISTORICAL_ARCHIVE_REDACTION_PATHS) {
    const original = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildWithOverride(relativePath, mutated(original)),
      expected("ARCHIVE_DRIFT"),
    );
    const manifest = JSON.parse(gunzipSync(original, { maxOutputLength: 8 * 1024 * 1024 }));
    const technicalPath = Object.keys(manifest.files).find(
      (name) => name.endsWith(".mjs") || name.endsWith(".tsx"),
    );
    manifest.files[technicalPath] = Buffer.from("invalid technical authority").toString("base64");
    await assert.rejects(
      buildWithOverride(relativePath, gzipSync(Buffer.from(JSON.stringify(manifest)))),
      expected("ARCHIVE_DRIFT"),
    );
  }
  for (const { current } of GENERATOR_REDACTION_RECEIPTS) {
    await assert.rejects(
      buildWithOverride(current.path, mutated(await readFile(path.join(ROOT, current.path)))),
      expected("GENERATOR_DRIFT"),
    );
  }
  for (const relativePath of [
    built.artifact.authority.preservedHistory.frozenArtifacts[0].path,
    built.artifact.authority.preservedHistory.frozenArtifacts.at(-1).path,
  ]) {
    await assert.rejects(
      buildWithOverride(relativePath, mutated(await readFile(path.join(ROOT, relativePath)))),
      expected("FROZEN_ARTIFACT_DRIFT"),
    );
  }
  const history = JSON.parse(await readFile(path.join(ROOT, CHECKPOINT), "utf8"));
  history.checkpoints[0].readers[0].sha256 = "0".repeat(64);
  await assert.rejects(
    buildWithOverride(CHECKPOINT, Buffer.from(`${JSON.stringify(history)}\n`)),
    expected("HISTORY_DRIFT"),
  );
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[4], async () => {
  let getterCalls = 0;
  const hostile = Object.defineProperty({}, "workspaceRoot", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return ROOT;
    },
  });
  for (const options of [
    null,
    [],
    new Proxy({}, {}),
    hostile,
    { typo: true },
    { fileOverrides: new Map([["../outside", Buffer.alloc(1)]]) },
    { fileOverrides: new Proxy(new Map(), {}) },
    { fileOverrides: new Map([[CHECKPOINT, new Uint8Array(new SharedArrayBuffer(1))]]) },
    { beforeAuthorityOpen: 1 },
  ]) {
    await assert.rejects(
      buildHistoricalArchiveRedactionEvidence(options),
      expected("OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  const relativePath = HISTORICAL_ARCHIVE_REDACTION_PATHS[0];
  const bytes = await readFile(path.join(ROOT, relativePath));
  const input = new Map([[relativePath, bytes]]);
  const pending = buildHistoricalArchiveRedactionEvidence({ fileOverrides: input });
  bytes.fill(0);
  input.clear();
  assert.deepEqual((await pending).artifactBytes, built.artifactBytes);
  await assert.rejects(
    buildWithOverride("unknown-file", Buffer.alloc(1)),
    expected("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildWithOverride(CHECKPOINT, Buffer.alloc(16 * 1024 * 1024 + 1)),
    expected("OPTIONS_INVALID"),
  );
  const data = await readFile(path.join(ROOT, relativePath));
  Object.defineProperty(data, "buffer", {
    get() {
      getterCalls += 1;
      throw new Error("getter must not execute");
    },
  });
  assert.deepEqual(
    (await buildWithOverride(relativePath, data)).artifactBytes,
    built.artifactBytes,
  );
  assert.equal(getterCalls, 0);
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[5], async () => {
  const opened = [];
  await buildHistoricalArchiveRedactionEvidence({
    beforeAuthorityOpen: ({ path: relativePath }) => opened.push(relativePath),
  });
  for (const relativePath of HISTORICAL_ARCHIVE_REDACTION_PATHS)
    assert.equal(opened.filter((value) => value === relativePath).length, 1);
  const target = GENERATOR_REDACTION_RECEIPTS[0].current.path;
  const absolute = path.join(fixture, target);
  const original = await readFile(absolute);
  assert.deepEqual(
    (await buildHistoricalArchiveRedactionEvidence({ workspaceRoot: fixture })).artifactBytes,
    built.artifactBytes,
  );
  await writeFile(absolute, mutated(original));
  await assert.rejects(
    buildHistoricalArchiveRedactionEvidence({ workspaceRoot: fixture }),
    expected("GENERATOR_DRIFT"),
  );
  await writeFile(absolute, original);
  assert.deepEqual(
    (await buildHistoricalArchiveRedactionEvidence({ workspaceRoot: fixture })).artifactBytes,
    built.artifactBytes,
  );
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[6], async () => {
  const relativePath = HISTORICAL_ARCHIVE_REDACTION_PATHS[0];
  const absolute = path.join(fixture, relativePath);
  const original = await readFile(absolute);
  const sibling = path.join(path.dirname(absolute), "held.json.gz");
  await writeFile(sibling, original);
  for (const kind of ["symlink", "hardlink", "directory"]) {
    await rm(absolute);
    if (kind === "symlink") await symlink(sibling, absolute);
    if (kind === "hardlink") await link(sibling, absolute);
    if (kind === "directory") await mkdir(absolute);
    await assert.rejects(
      buildHistoricalArchiveRedactionEvidence({ workspaceRoot: fixture }),
      expected("AUTHORITY_UNSAFE"),
    );
    await rm(absolute, { recursive: kind === "directory" });
    await writeFile(absolute, original);
  }
  await assert.rejects(
    buildHistoricalArchiveRedactionEvidence({
      workspaceRoot: fixture,
      beforeAuthorityOpen: async ({ path: currentPath }) => {
        if (currentPath === relativePath) await writeFile(absolute, mutated(original));
      },
    }),
    expected("AUTHORITY_UNSAFE"),
  );
  await writeFile(absolute, original);
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[7], async () => {
  assert.deepEqual(
    { bytes: built.artifactBytes.byteLength, sha256: built.artifactSha256 },
    HISTORICAL_ARCHIVE_REDACTION_ARTIFACT_PIN,
  );
  const verified = await verifyHistoricalArchiveRedactionEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes: proofDocument(built.artifactSha256),
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.preservedFrozenArtifacts, 57);
  await assert.rejects(
    verifyHistoricalArchiveRedactionEvidence({
      artifactBytes: mutated(built.artifactBytes),
      proofDocumentBytes: proofDocument(built.artifactSha256),
    }),
    expected("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyHistoricalArchiveRedactionEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from("Task: AR-01"),
    }),
    expected("REPORT_DRIFT"),
  );
  await assert.rejects(
    verifyHistoricalArchiveRedactionEvidence({
      artifactBytes: built.artifactBytes,
      artifactPath: path.join(ROOT, ARTIFACT),
    }),
    expected("OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyHistoricalArchiveRedactionEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.concat([
        proofDocument(built.artifactSha256),
        Buffer.from("\n### Private social drafts\nExample test data.\n"),
      ]),
    }),
    expected("REPORT_DRIFT"),
  );
});

test(HISTORICAL_ARCHIVE_REDACTION_ROOT_TEST_NAMES[8], async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "amendment.json");
  const result = await writeHistoricalArchiveRedactionEvidence({ artifactPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
  await assert.rejects(
    writeHistoricalArchiveRedactionEvidence({ artifactPath: path.join(ROOT, ARTIFACT) }),
    expected("ARTIFACT_WRITE_UNSAFE"),
  );
  const alias = path.join(directory, "alias.json");
  await symlink(artifactPath, alias);
  await assert.rejects(
    writeHistoricalArchiveRedactionEvidence({ artifactPath: alias }),
    expected("ARTIFACT_WRITE_UNSAFE"),
  );
  await assert.rejects(
    writeHistoricalArchiveRedactionEvidence({ artifactPath: directory }),
    expected("ARTIFACT_WRITE_UNSAFE"),
  );
  const racing = path.join(directory, "racing.json");
  await assert.rejects(
    writeHistoricalArchiveRedactionEvidence({
      artifactPath: racing,
      beforeAtomicRename: async () => {
        await link(artifactPath, racing);
      },
    }),
    expected("ARTIFACT_WRITE_UNSAFE"),
  );
  await rm(racing);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);
});
