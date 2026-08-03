import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
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
import test from "node:test";

import {
  DEFAULT_PROOF_READER_CHECKPOINT_PATH,
  EXPECTED_GENESIS_CHECKPOINT_SHA256,
  PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256,
  PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS,
  PROOF_READER_CHECKPOINT_TASK_AUTHORITY,
  ProofReaderCheckpointError,
  calculateProofReaderCheckpointSha256,
  validateProofReaderCheckpointAppendCandidateBytes,
  validateProofReaderCheckpointBytes,
  verifyProofReaderCheckpoints,
} from "../proof-reader-checkpoints.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const GENESIS_PREDECESSOR_SHA256 = "0".repeat(64);
const baselineBytes = await readFile(DEFAULT_PROOF_READER_CHECKPOINT_PATH);
const baselineText = baselineBytes.toString("utf8");
const baselineManifest = JSON.parse(baselineText);

function cloneBaseline() {
  return structuredClone(baselineManifest);
}

function canonicalBytes(manifest) {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function checkpointError(code) {
  return (error) => error instanceof ProofReaderCheckpointError && error.code === code;
}

function appendSuccessor(manifest, mutate) {
  const previous = manifest.checkpoints.at(-1);
  const successor = structuredClone(previous);
  successor.sequence = previous.sequence + 1;
  successor.predecessorSha256 = manifest.headSha256;
  mutate(successor);
  manifest.checkpoints.push(successor);
  manifest.headSha256 = calculateProofReaderCheckpointSha256(successor);
  return successor;
}

function changedReaderReceipt(reader, marker) {
  reader.bytes += marker.length;
  reader.sha256 = createHash("sha256").update(`${reader.sha256}:${marker}`, "utf8").digest("hex");
}

function authorityPaths() {
  return PROOF_READER_CHECKPOINT_TASK_AUTHORITY.flatMap((entry) => [
    entry.artifact.path,
    ...entry.readers.map(({ path: readerPath }) => readerPath),
  ]);
}

async function materializeAuthorityWorkspace() {
  const temporaryBase = await realpath(os.tmpdir());
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(temporaryBase, "desen-reader-checkpoint-")),
  );
  for (const relativePath of authorityPaths()) {
    const source = path.join(WORKSPACE_ROOT, relativePath);
    const target = path.join(temporaryRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  await mkdir(path.join(temporaryRoot, "scripts/ci"), { recursive: true });
  await writeFile(
    path.join(temporaryRoot, "scripts/ci/proof-reader-checkpoints.json"),
    baselineBytes,
  );
  return temporaryRoot;
}

test("the reviewed chain authenticates its immutable genesis and current readers", async () => {
  const manifest = validateProofReaderCheckpointBytes(baselineBytes);
  const result = await verifyProofReaderCheckpoints();

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.checkpoints.length, 6);
  assert.equal(manifest.checkpoints[0].sequence, 1);
  assert.equal(manifest.checkpoints[0].predecessorSha256, GENESIS_PREDECESSOR_SHA256);
  assert.equal(manifest.checkpoints[1].sequence, 2);
  assert.equal(manifest.checkpoints[1].predecessorSha256, EXPECTED_GENESIS_CHECKPOINT_SHA256);
  assert.equal(manifest.checkpoints[2].sequence, 3);
  assert.equal(
    manifest.checkpoints[2].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[1],
  );
  assert.equal(manifest.checkpoints[3].sequence, 4);
  assert.equal(
    manifest.checkpoints[3].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[2],
  );
  assert.equal(manifest.checkpoints[4].sequence, 5);
  assert.equal(
    manifest.checkpoints[4].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[3],
  );
  assert.equal(manifest.checkpoints[5].sequence, 6);
  assert.equal(
    manifest.checkpoints[5].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[4],
  );
  assert.equal(manifest.checkpoints[0].artifacts.length, 6);
  assert.equal(manifest.checkpoints[0].readers.length, 12);
  assert.equal(manifest.checkpoints[1].artifacts.length, 8);
  assert.equal(manifest.checkpoints[1].readers.length, 16);
  assert.equal(manifest.checkpoints[2].artifacts.length, 9);
  assert.equal(manifest.checkpoints[2].readers.length, 18);
  assert.equal(manifest.checkpoints[3].artifacts.length, 10);
  assert.equal(manifest.checkpoints[3].readers.length, 20);
  assert.equal(manifest.checkpoints[4].artifacts.length, 11);
  assert.equal(manifest.checkpoints[4].readers.length, 22);
  assert.equal(manifest.checkpoints[5].artifacts.length, 11);
  assert.equal(manifest.checkpoints[5].readers.length, 22);
  assert.equal(
    calculateProofReaderCheckpointSha256(manifest.checkpoints.at(-1)),
    manifest.headSha256,
  );
  assert.equal(manifest.headSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[5]);
  assert.deepEqual(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256, [
    "5fbf737da2edbac5cd88ba5897013cbe213c32c5e3344b585014e65fa1a707e8",
    "95a4ebc5261c98569d0e42320aa300f70ec568d1083af38d869b06c82398368c",
    "f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882",
    "ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5",
    "7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3",
    "790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd",
  ]);
  assert.equal(Object.isFrozen(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256), true);
  assert.deepEqual(PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS, [6, 8, 9, 10, 11, 11]);
  assert.equal(Object.isFrozen(PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS), true);
  assert.deepEqual(
    manifest.checkpoints.map((checkpoint) => calculateProofReaderCheckpointSha256(checkpoint)),
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256,
  );
  assert.deepEqual(result, {
    status: "PASS",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    headSha256: manifest.headSha256,
    checkpoints: 6,
    frozenArtifacts: 11,
    currentReaders: 22,
  });
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.checkpoints[0].readers[0]));
});

test("sequence six advances only the bounded M06-T11 timeout-hardened readers", () => {
  const sequenceFive = baselineManifest.checkpoints[4];
  const sequenceSix = baselineManifest.checkpoints[5];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const notM06T11 = ({ task }) => task !== "M06-T11";

  assert.deepEqual(sequenceSix.artifacts, sequenceFive.artifacts);
  assert.deepEqual(sequenceSix.readers.map(identity), sequenceFive.readers.map(identity));
  assert.deepEqual(sequenceSix.readers.filter(notM06T11), sequenceFive.readers.filter(notM06T11));
  assert.deepEqual(
    sequenceFive.readers.filter(({ task }) => task === "M06-T11"),
    [
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 164416,
        sha256: "6ade0a3f72ccdbeaf41be5d1db507ba656a0d9b1a92f116629e8d57fd72cd8e2",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 60050,
        sha256: "09ecdc5623d14349c6581d6739ee711d65843230610e9aa0a0d96c44ecd0d8db",
      },
    ],
  );
  assert.deepEqual(
    sequenceSix.readers.filter(({ task }) => task === "M06-T11"),
    [
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 164703,
        sha256: "7686dcdf05f464696bd9813937bd4b8fe37ef49e9a5c6a7726222aa7781698c1",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 60604,
        sha256: "002c87d0585217e905062b0476d34b18816337672aaadecdfc372bd5ddc769bf",
      },
    ],
  );
});

test("the genesis cannot be rewritten and reheaded as a different history", () => {
  const rewritten = cloneBaseline();
  changedReaderReceipt(rewritten.checkpoints[0].readers[0], "rewritten-genesis");
  rewritten.checkpoints[1].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[0],
  );
  rewritten.checkpoints[2].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[1],
  );
  rewritten.checkpoints[3].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[2],
  );
  rewritten.checkpoints[4].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[3],
  );
  rewritten.checkpoints[5].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[4],
  );
  rewritten.headSha256 = calculateProofReaderCheckpointSha256(rewritten.checkpoints[5]);

  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(rewritten)),
    checkpointError("PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED"),
  );
});

test("task, artifact, reader path, role, and order authority are owned by code", () => {
  const generations = [
    {
      checkpoint: baselineManifest.checkpoints[0],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 6),
    },
    {
      checkpoint: baselineManifest.checkpoints[1],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 8),
    },
    {
      checkpoint: baselineManifest.checkpoints[2],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 9),
    },
    {
      checkpoint: baselineManifest.checkpoints[3],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 10),
    },
    {
      checkpoint: baselineManifest.checkpoints[4],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY,
    },
    {
      checkpoint: baselineManifest.checkpoints[5],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY,
    },
  ];

  for (const { checkpoint, authority } of generations) {
    const expectedArtifacts = authority.map(({ task, artifact }) => ({ task, ...artifact }));
    const expectedReaders = authority.flatMap(({ task, readers }) =>
      readers.map(({ role, path: readerPath }) => ({ task, role, path: readerPath })),
    );

    assert.deepEqual(checkpoint.artifacts, expectedArtifacts);
    assert.deepEqual(
      checkpoint.readers.map(({ task, role, path: readerPath }) => ({
        task,
        role,
        path: readerPath,
      })),
      expectedReaders,
    );
    assert.equal(new Set(checkpoint.artifacts.map(({ task }) => task)).size, authority.length);
    assert.equal(
      new Set(checkpoint.artifacts.map(({ path: itemPath }) => itemPath)).size,
      authority.length,
    );
    assert.equal(
      new Set(checkpoint.readers.map(({ path: itemPath }) => itemPath)).size,
      authority.length * 2,
    );
  }
  assert.equal(PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length, 11);
  assert.equal(baselineText.includes('"command"') || baselineText.includes('"args"'), false);
});

test("reviewed task generations stay pinned while a candidate inherits current authority", () => {
  assert.deepEqual(
    baselineManifest.checkpoints.map(({ artifacts }) => artifacts.length),
    PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS,
  );

  const manifest = cloneBaseline();
  const candidate = appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "current-authority-candidate");
  });

  assert.equal(candidate.sequence, PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS.length + 1);
  assert.equal(candidate.artifacts.length, PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length);
  assert.equal(candidate.readers.length, PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length * 2);
  assert.equal(
    validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest)).status,
    "REVIEW_REQUIRED",
  );
});

test("singleton checkpointBytes and workspaceRoot options are accepted", async () => {
  const withBytes = await verifyProofReaderCheckpoints({
    checkpointBytes: baselineBytes,
  });
  const withRoot = await verifyProofReaderCheckpoints({
    workspaceRoot: WORKSPACE_ROOT,
  });

  assert.equal(withBytes.status, "PASS");
  assert.equal(withRoot.status, "PASS");
});

test("unknown, accessor-backed, proxy, and active verifier options fail closed", async () => {
  let getterInvoked = false;
  const accessor = {};
  Object.defineProperty(accessor, "workspaceRoot", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return WORKSPACE_ROOT;
    },
  });

  await assert.rejects(
    verifyProofReaderCheckpoints({ command: "node" }),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyProofReaderCheckpoints(accessor),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyProofReaderCheckpoints(new Proxy({}, {})),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyProofReaderCheckpoints({ checkpointBytes: new Uint8Array() }),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );
  assert.equal(getterInvoked, false);
});

test("unknown manifest fields cannot select commands or expand authority", () => {
  const rootCommand = cloneBaseline();
  rootCommand.command = "node";
  const checkpointCommand = cloneBaseline();
  checkpointCommand.checkpoints[0].command = "node";
  const readerCommand = cloneBaseline();
  readerCommand.checkpoints[0].readers[0].args = ["malicious.mjs"];

  for (const manifest of [rootCommand, checkpointCommand, readerCommand]) {
    assert.throws(
      () => validateProofReaderCheckpointBytes(canonicalBytes(manifest)),
      checkpointError("PROOF_READER_CHECKPOINT_SCHEMA_INVALID"),
    );
  }
});

test("malformed JSON, invalid UTF-8, bad digests, and unsafe byte counts fail closed", () => {
  assert.throws(
    () => validateProofReaderCheckpointBytes(Buffer.from("{", "utf8")),
    checkpointError("PROOF_READER_CHECKPOINT_JSON_INVALID"),
  );
  assert.throws(
    () => validateProofReaderCheckpointBytes(Buffer.from([0xc3, 0x28])),
    checkpointError("PROOF_READER_CHECKPOINT_UTF8_INVALID"),
  );

  const badDigest = cloneBaseline();
  badDigest.headSha256 = "A".repeat(64);
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(badDigest)),
    checkpointError("PROOF_READER_CHECKPOINT_SCHEMA_INVALID"),
  );

  const badBytes = cloneBaseline();
  badBytes.checkpoints[0].readers[0].bytes = 0;
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(badBytes)),
    checkpointError("PROOF_READER_CHECKPOINT_SCHEMA_INVALID"),
  );
});

test("whitespace, key reordering, duplicate keys, and trailing data are non-canonical", () => {
  const compact = Buffer.from(JSON.stringify(baselineManifest), "utf8");
  const crlf = Buffer.from(baselineText.replaceAll("\n", "\r\n"), "utf8");
  const reordered = Buffer.from(
    `${JSON.stringify(
      {
        headSha256: baselineManifest.headSha256,
        schemaVersion: baselineManifest.schemaVersion,
        profile: baselineManifest.profile,
        checkpoints: baselineManifest.checkpoints,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const duplicate = Buffer.from(
    baselineText.replace(
      '  "schemaVersion": 1,\n',
      '  "schemaVersion": 1,\n  "schemaVersion": 1,\n',
    ),
    "utf8",
  );

  for (const bytes of [compact, crlf, reordered, duplicate]) {
    assert.throws(
      () => validateProofReaderCheckpointBytes(bytes),
      checkpointError("PROOF_READER_CHECKPOINT_CANONICAL_DRIFT"),
    );
  }
  assert.throws(
    () => validateProofReaderCheckpointBytes(Buffer.from(`${baselineText}false`, "utf8")),
    checkpointError("PROOF_READER_CHECKPOINT_JSON_INVALID"),
  );
});

test("duplicate or reordered task and path authority fail closed", () => {
  const reorderedArtifacts = cloneBaseline();
  [reorderedArtifacts.checkpoints[0].artifacts[0], reorderedArtifacts.checkpoints[0].artifacts[1]] =
    [
      reorderedArtifacts.checkpoints[0].artifacts[1],
      reorderedArtifacts.checkpoints[0].artifacts[0],
    ];
  const duplicateReader = cloneBaseline();
  duplicateReader.checkpoints[0].readers[1] = structuredClone(
    duplicateReader.checkpoints[0].readers[0],
  );
  const reorderedReaders = cloneBaseline();
  [reorderedReaders.checkpoints[0].readers[0], reorderedReaders.checkpoints[0].readers[1]] = [
    reorderedReaders.checkpoints[0].readers[1],
    reorderedReaders.checkpoints[0].readers[0],
  ];

  for (const manifest of [reorderedArtifacts, duplicateReader, reorderedReaders]) {
    assert.throws(
      () => validateProofReaderCheckpointBytes(canonicalBytes(manifest)),
      (error) =>
        error instanceof ProofReaderCheckpointError &&
        (error.code === "PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT" ||
          error.code === "PROOF_READER_CHECKPOINT_READER_DRIFT" ||
          error.code === "PROOF_READER_CHECKPOINT_SCHEMA_INVALID"),
    );
  }
});

test("head, sequence, predecessor, artifact, and reader tampering fail closed", () => {
  const wrongHead = cloneBaseline();
  wrongHead.headSha256 = "1".repeat(64);
  const wrongSequence = cloneBaseline();
  wrongSequence.checkpoints[5].sequence = 7;
  const wrongPredecessor = cloneBaseline();
  wrongPredecessor.checkpoints[0].predecessorSha256 = "2".repeat(64);
  const artifactTamper = cloneBaseline();
  artifactTamper.checkpoints[0].artifacts[0].sha256 = "3".repeat(64);
  const readerTamper = cloneBaseline();
  readerTamper.checkpoints[0].readers[0].path = "scripts/lib/other.mjs";

  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(wrongHead)),
    checkpointError("PROOF_READER_CHECKPOINT_CHAIN_DRIFT"),
  );
  for (const manifest of [wrongSequence, wrongPredecessor]) {
    assert.throws(
      () => validateProofReaderCheckpointBytes(canonicalBytes(manifest)),
      checkpointError("PROOF_READER_CHECKPOINT_CHAIN_DRIFT"),
    );
  }
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(artifactTamper)),
    checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
  );
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(readerTamper)),
    checkpointError("PROOF_READER_CHECKPOINT_READER_DRIFT"),
  );
});

test("one changed reader is a valid review candidate while twenty-one peers remain unchanged", () => {
  const manifest = cloneBaseline();
  const reviewedReaders = structuredClone(manifest.checkpoints.at(-1).readers);
  const successor = appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "successor");
  });

  const candidate = validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest));
  assert.deepEqual(candidate, {
    status: "REVIEW_REQUIRED",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    anchoredCheckpoints: 6,
    candidateSequence: 7,
    predecessorSha256: baselineManifest.headSha256,
    candidateSha256: manifest.headSha256,
  });
  assert.equal(successor.sequence, 7);
  assert.equal(successor.predecessorSha256, baselineManifest.headSha256);
  assert.notDeepEqual(successor.readers[0], reviewedReaders[0]);
  assert.deepEqual(successor.readers.slice(1), reviewedReaders.slice(1));
});

test("an unreviewed append cannot become live authority by reheading the manifest", async () => {
  const manifest = cloneBaseline();
  appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "unreviewed-live-append");
  });

  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(manifest)),
    checkpointError("PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED"),
  );
  await assert.rejects(
    verifyProofReaderCheckpoints({ checkpointBytes: canonicalBytes(manifest) }),
    checkpointError("PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED"),
  );
});

test("a successor with all readers unchanged is rejected as redundant", () => {
  const manifest = cloneBaseline();
  appendSuccessor(manifest, () => undefined);

  assert.throws(
    () => validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest)),
    checkpointError("PROOF_READER_CHECKPOINT_CHAIN_DRIFT"),
  );
});

test("a later checkpoint cannot roll one reader back to any prior receipt", () => {
  const manifest = cloneBaseline();
  const genesisReceipt = structuredClone(manifest.checkpoints[0].readers[0]);
  appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "second");
  });
  appendSuccessor(manifest, (checkpoint) => {
    checkpoint.readers[0] = genesisReceipt;
    changedReaderReceipt(checkpoint.readers[1], "third");
  });

  assert.throws(
    () => validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest)),
    checkpointError("PROOF_READER_CHECKPOINT_CHAIN_DRIFT"),
  );
});

test("a rewritten reviewed prefix cannot be smuggled through the candidate path", () => {
  const manifest = cloneBaseline();
  changedReaderReceipt(manifest.checkpoints[0].readers[0], "rewritten-prefix");
  manifest.checkpoints[1].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[0],
  );
  manifest.checkpoints[2].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[1],
  );
  manifest.checkpoints[3].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[2],
  );
  manifest.checkpoints[4].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[3],
  );
  manifest.checkpoints[5].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[4],
  );
  manifest.headSha256 = calculateProofReaderCheckpointSha256(manifest.checkpoints[5]);
  appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[1], "candidate-after-rewrite");
  });

  assert.throws(
    () => validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest)),
    checkpointError("PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED"),
  );
});

test("current reader byte drift fails even when the checkpoint itself is canonical", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const readerPath = baselineManifest.checkpoints[0].readers[0].path;
  try {
    const absolutePath = path.join(temporaryRoot, readerPath);
    const current = await readFile(absolutePath);
    await writeFile(absolutePath, Buffer.concat([current, Buffer.from("\n")]));
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_READER_DRIFT"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("current frozen-artifact byte drift fails before reader verification", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const artifactPath = baselineManifest.checkpoints[0].artifacts[0].path;
  try {
    const absolutePath = path.join(temporaryRoot, artifactPath);
    const current = await readFile(absolutePath);
    current[0] ^= 1;
    await writeFile(absolutePath, current);
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("symbolic reader files are rejected instead of followed", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const readerPath = baselineManifest.checkpoints[0].readers[0].path;
  const targetPath = path.join(temporaryRoot, readerPath);
  const siblingPath = path.join(temporaryRoot, baselineManifest.checkpoints[0].readers[1].path);
  try {
    await rm(targetPath);
    await symlink(siblingPath, targetPath);
    assert.equal((await lstat(targetPath)).isSymbolicLink(), true);
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("a symbolic authority parent directory is rejected instead of traversed", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const parentPath = path.join(temporaryRoot, "scripts/lib");
  const realParentPath = path.join(temporaryRoot, "scripts/lib-reviewed");
  try {
    await rename(parentPath, realParentPath);
    await symlink(realParentPath, parentPath, "dir");
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("a symbolic workspace root is rejected even when it targets a complete workspace", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const symbolicRoot = `${temporaryRoot}-link`;
  try {
    await symlink(temporaryRoot, symbolicRoot, "dir");
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: symbolicRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
  } finally {
    await rm(symbolicRoot, { force: true });
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("a missing authority file fails closed", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const artifactPath = baselineManifest.checkpoints[0].artifacts[0].path;
  try {
    await rm(path.join(temporaryRoot, artifactPath));
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("over-budget checkpoint and authority files fail before parsing or hashing", async () => {
  assert.throws(
    () => validateProofReaderCheckpointBytes(Buffer.alloc(2 * 1024 * 1024 + 1)),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );

  const temporaryRoot = await materializeAuthorityWorkspace();
  const artifactPath = baselineManifest.checkpoints[0].artifacts[0].path;
  try {
    await writeFile(path.join(temporaryRoot, artifactPath), Buffer.alloc(16 * 1024 * 1024 + 1));
    await assert.rejects(
      verifyProofReaderCheckpoints({ workspaceRoot: temporaryRoot }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
