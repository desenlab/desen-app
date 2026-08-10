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
  assert.equal(manifest.checkpoints.length, 22);
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
  assert.equal(manifest.checkpoints[6].sequence, 7);
  assert.equal(
    manifest.checkpoints[6].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[5],
  );
  assert.equal(manifest.checkpoints[7].sequence, 8);
  assert.equal(
    manifest.checkpoints[7].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[6],
  );
  assert.equal(manifest.checkpoints[8].sequence, 9);
  assert.equal(
    manifest.checkpoints[8].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[7],
  );
  assert.equal(manifest.checkpoints[9].sequence, 10);
  assert.equal(
    manifest.checkpoints[9].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[8],
  );
  assert.equal(manifest.checkpoints[10].sequence, 11);
  assert.equal(
    manifest.checkpoints[10].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[9],
  );
  assert.equal(manifest.checkpoints[11].sequence, 12);
  assert.equal(
    manifest.checkpoints[11].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[10],
  );
  assert.equal(manifest.checkpoints[12].sequence, 13);
  assert.equal(
    manifest.checkpoints[12].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[11],
  );
  assert.equal(manifest.checkpoints[13].sequence, 14);
  assert.equal(
    manifest.checkpoints[13].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[12],
  );
  assert.equal(manifest.checkpoints[14].sequence, 15);
  assert.equal(
    manifest.checkpoints[14].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[13],
  );
  assert.equal(manifest.checkpoints[15].sequence, 16);
  assert.equal(
    manifest.checkpoints[15].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[14],
  );
  assert.equal(manifest.checkpoints[16].sequence, 17);
  assert.equal(
    manifest.checkpoints[16].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[15],
  );
  assert.equal(manifest.checkpoints[17].sequence, 18);
  assert.equal(
    manifest.checkpoints[17].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[16],
  );
  assert.equal(manifest.checkpoints[18].sequence, 19);
  assert.equal(
    manifest.checkpoints[18].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[17],
  );
  assert.equal(manifest.checkpoints[19].sequence, 20);
  assert.equal(
    manifest.checkpoints[19].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[18],
  );
  assert.equal(manifest.checkpoints[20].sequence, 21);
  assert.equal(
    manifest.checkpoints[20].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[19],
  );
  assert.equal(manifest.checkpoints[21].sequence, 22);
  assert.equal(
    manifest.checkpoints[21].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[20],
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
  assert.equal(manifest.checkpoints[6].artifacts.length, 13);
  assert.equal(manifest.checkpoints[6].readers.length, 26);
  assert.equal(manifest.checkpoints[7].artifacts.length, 14);
  assert.equal(manifest.checkpoints[7].readers.length, 28);
  assert.equal(manifest.checkpoints[8].artifacts.length, 14);
  assert.equal(manifest.checkpoints[8].readers.length, 28);
  assert.equal(manifest.checkpoints[9].artifacts.length, 14);
  assert.equal(manifest.checkpoints[9].readers.length, 28);
  assert.equal(manifest.checkpoints[10].artifacts.length, 14);
  assert.equal(manifest.checkpoints[10].readers.length, 28);
  assert.equal(manifest.checkpoints[11].artifacts.length, 14);
  assert.equal(manifest.checkpoints[11].readers.length, 28);
  assert.equal(manifest.checkpoints[12].artifacts.length, 14);
  assert.equal(manifest.checkpoints[12].readers.length, 28);
  assert.equal(manifest.checkpoints[13].artifacts.length, 14);
  assert.equal(manifest.checkpoints[13].readers.length, 28);
  assert.equal(manifest.checkpoints[14].artifacts.length, 15);
  assert.equal(manifest.checkpoints[14].readers.length, 30);
  assert.equal(manifest.checkpoints[15].artifacts.length, 16);
  assert.equal(manifest.checkpoints[15].readers.length, 32);
  assert.equal(manifest.checkpoints[16].artifacts.length, 17);
  assert.equal(manifest.checkpoints[16].readers.length, 34);
  assert.equal(manifest.checkpoints[17].artifacts.length, 17);
  assert.equal(manifest.checkpoints[17].readers.length, 34);
  assert.equal(manifest.checkpoints[18].artifacts.length, 17);
  assert.equal(manifest.checkpoints[18].readers.length, 34);
  assert.equal(manifest.checkpoints[19].artifacts.length, 17);
  assert.equal(manifest.checkpoints[19].readers.length, 34);
  assert.equal(manifest.checkpoints[20].artifacts.length, 18);
  assert.equal(manifest.checkpoints[20].readers.length, 36);
  assert.equal(manifest.checkpoints[21].artifacts.length, 18);
  assert.equal(manifest.checkpoints[21].readers.length, 36);
  assert.equal(
    calculateProofReaderCheckpointSha256(manifest.checkpoints.at(-1)),
    manifest.headSha256,
  );
  assert.equal(manifest.headSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[21]);
  assert.equal(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length, 22);
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[7],
    "f707fb4c3338aeda79eb6242b645b5e864ce54b1e3955373e8edebcd7e026b8a",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[8],
    "94f48160552a6e0de702f71200e56c23d61bab8692d43f3ac1104dcfa681568b",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[9],
    "bd3f5b90656f0e41d7f6aa439fdc01889e9ebeada26cd3caf8624c3ce1db7d07",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[10],
    "63b8af4da431f0918c7ea9480564750bd12057af2bc83c294d962113ce7c9be8",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[11],
    "85c49a0d79346bf2ea92b716f6b43c5d95d164209e3d67af34871a334686e10e",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[12],
    "146b04f1c8209be64168afb451ceee2c422da0cdced116f8d08beafe795c533c",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[13],
    "3d2dd7a48ee2573d14fb1dbea18ef8b4e3498c6a26f82d76ea589dba3c821078",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[14],
    "b75a2580d1d6820392aa74ba5b7671b01baed1740fe2097c2a78e24663b5e4d5",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[15],
    "f9e77791148c7f89e586b6eb8964338185a35c11900b69262a159002af0838cd",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[16],
    "cc7227fe73f0b03fa56e18c075de5bc8bb2f87c4425aa669fd437ed2cc09730e",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[17],
    "4e9ac8adac57d058444bfe2113fbb5dd364cd24d6052ad5f2cd8910a13c22b45",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[18],
    "abf161e5a85053e19ce218127aa3f7d3a3ac8480b68b01a4185618ac732393a3",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[19],
    "8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[20],
    "ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[21],
    "aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e",
  );
  assert.deepEqual(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.slice(0, 7), [
    "5fbf737da2edbac5cd88ba5897013cbe213c32c5e3344b585014e65fa1a707e8",
    "95a4ebc5261c98569d0e42320aa300f70ec568d1083af38d869b06c82398368c",
    "f92e879b3a72e75abb07af2b2bcfded62e014b99aa0cbe69c64aee12d5379882",
    "ee2d72c3529d9295945d339fb214c41dbbf906ffa6613a7ad6e766ec79c1bcf5",
    "7df3631d509ed7e65c571566a825d6d3cd52d336e1a74512bf3e8e26920749b3",
    "790ad28b6fd441e6d5f40f277a97e8de36a178a9e50fff3e208e6c27588915fd",
    "d50b5ee4fb265f241bac7652b979af0146d530528ba6db8fc98c8fb3225a5ba5",
  ]);
  assert.equal(Object.isFrozen(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256), true);
  assert.deepEqual(
    PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS,
    [6, 8, 9, 10, 11, 11, 13, 14, 14, 14, 14, 14, 14, 14, 15, 16, 17, 17, 17, 17, 18, 18],
  );
  assert.equal(Object.isFrozen(PROOF_READER_CHECKPOINT_REVIEWED_TASK_COUNTS), true);
  assert.deepEqual(
    manifest.checkpoints.map((checkpoint) => calculateProofReaderCheckpointSha256(checkpoint)),
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256,
  );
  assert.deepEqual(result, {
    status: "PASS",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    headSha256: manifest.headSha256,
    checkpoints: 22,
    frozenArtifacts: 18,
    currentReaders: 36,
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

test("sequence seven reseals final live readers and appends exact T04/P17 generations", () => {
  const sequenceSix = baselineManifest.checkpoints[5];
  const sequenceSeven = baselineManifest.checkpoints[6];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const resealedReaderIndexes = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19];
  const stableReaderIndexes = [6, 13, 20, 21];

  assert.deepEqual(sequenceSeven.artifacts.slice(0, 11), sequenceSix.artifacts);
  assert.deepEqual(
    sequenceSeven.readers.slice(0, 22).map(identity),
    sequenceSix.readers.map(identity),
  );
  assert.deepEqual(
    sequenceSeven.readers
      .slice(0, 22)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(sequenceSix.readers[index]) ? [] : [index],
      ),
    resealedReaderIndexes,
  );
  for (const index of stableReaderIndexes) {
    assert.deepEqual(sequenceSeven.readers[index], sequenceSix.readers[index]);
  }
  assert.deepEqual(sequenceSeven.readers.slice(0, 2), [
    {
      task: "M05-T09",
      role: "proof-library",
      path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
      bytes: 252188,
      sha256: "94d1d9f02af9d564ebe4dd2c5b36fc0f7bab4d28cad87ca144ddb41756dd1c17",
    },
    {
      task: "M05-T09",
      role: "root-test",
      path: "tests/reference-host-web-source-audit.test.mjs",
      bytes: 83937,
      sha256: "1690d26b0a301b2528413b4bcfa9fc2e3f32171db284e6fced82726669c16840",
    },
  ]);
  assert.deepEqual(sequenceSeven.artifacts.slice(11), [
    {
      task: "M07-T04",
      path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
      bytes: 34612,
      sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
    },
    {
      task: "M05-T06",
      path: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
      bytes: 9534,
      sha256: "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723",
    },
  ]);
  assert.deepEqual(sequenceSeven.readers.slice(22), [
    {
      task: "M07-T04",
      role: "proof-library",
      path: "scripts/lib/control-plane-reference-preflight-proof.mjs",
      bytes: 62190,
      sha256: "f6c66c46eb100e9ccffb59920d9f2e2beb9b82fdf57bb6ace3194eec03fe2b38",
    },
    {
      task: "M07-T04",
      role: "root-test",
      path: "tests/control-plane-reference-preflight.test.mjs",
      bytes: 18098,
      sha256: "f05e02c5ae6266493dc80521c6b4a545b5c601e89bb9e32c6aa3a5a7081504fd",
    },
    {
      task: "M05-T06",
      role: "proof-library",
      path: "scripts/lib/runtime-react-failure-boundary-proof.mjs",
      bytes: 50104,
      sha256: "b873271eb35f8ebe835e7557bf6148ddadf78bc77ee1196ce9078aab547ac5de",
    },
    {
      task: "M05-T06",
      role: "root-test",
      path: "tests/runtime-react-failure-boundary.test.mjs",
      bytes: 26562,
      sha256: "37ce784982279f7acc9739dd5665af3b24be5962f69a818459a2e0a6a205b6f7",
    },
  ]);
});

test("sequence eight appends the exact M07-T05 generation without rewriting prior authority", () => {
  const sequenceSeven = baselineManifest.checkpoints[6];
  const sequenceEight = baselineManifest.checkpoints[7];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceEight.artifacts.slice(0, 13), sequenceSeven.artifacts);
  assert.deepEqual(
    sequenceEight.readers.slice(0, 26).map(identity),
    sequenceSeven.readers.map(identity),
  );
  assert.deepEqual(
    sequenceEight.readers
      .slice(0, 26)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(sequenceSeven.readers[index]) ? [] : [index],
      ),
    [0, 1, 2, 3, 4, 5, 8, 14, 16, 18, 22, 23],
  );
  assert.deepEqual(sequenceEight.artifacts[13], {
    task: "M07-T05",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
    bytes: 41945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
  });
  assert.deepEqual(sequenceEight.readers.slice(26), [
    {
      task: "M07-T05",
      role: "proof-library",
      path: "scripts/lib/control-plane-local-api-proof.mjs",
      bytes: 73915,
      sha256: "f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3",
    },
    {
      task: "M07-T05",
      role: "root-test",
      path: "tests/control-plane-local-api.test.mjs",
      bytes: 17291,
      sha256: "490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65",
    },
  ]);
});

test("sequence nine reseals only the final M07-T02 and M07-T03 bridge readers", () => {
  const sequenceEight = baselineManifest.checkpoints[7];
  const sequenceNine = baselineManifest.checkpoints[8];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [16, 17, 18, 19];

  assert.deepEqual(sequenceNine.artifacts, sequenceEight.artifacts);
  assert.deepEqual(sequenceNine.readers.map(identity), sequenceEight.readers.map(identity));
  assert.deepEqual(
    sequenceNine.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceEight.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(sequenceNine.readers.slice(16, 20), [
    {
      task: "M07-T02",
      role: "proof-library",
      path: "scripts/lib/control-plane-bundle-verification-proof.mjs",
      bytes: 94612,
      sha256: "4c69fa253ba2d9432a75c6c6aaa2ad69e23c3683c43dae9c92dc73b3208937d9",
    },
    {
      task: "M07-T02",
      role: "root-test",
      path: "tests/control-plane-bundle-verification.test.mjs",
      bytes: 20959,
      sha256: "fdcfc8c4868c1ee084b652e42c7dab4750bc569c4c05928dde7136118b4689ed",
    },
    {
      task: "M07-T03",
      role: "proof-library",
      path: "scripts/lib/control-plane-package-preflight-proof.mjs",
      bytes: 86174,
      sha256: "5624b06d8d0962d18c9a920a34a95b0023f4909d8c7b7812057bedcdc62ab5ab",
    },
    {
      task: "M07-T03",
      role: "root-test",
      path: "tests/control-plane-package-preflight.test.mjs",
      bytes: 21119,
      sha256: "10c1a677b88b5c6bd4389e659ce38f11a627ae92de4aafe4ffade0de23790f11",
    },
  ]);
  for (const [index, reader] of sequenceNine.readers.entries()) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(reader, sequenceEight.readers[index]);
    }
  }
});

test("sequence ten reseals only the final catalog and M07-T01 compatibility readers", () => {
  const sequenceNine = baselineManifest.checkpoints[8];
  const sequenceTen = baselineManifest.checkpoints[9];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [7, 14, 15];

  assert.deepEqual(sequenceTen.artifacts, sequenceNine.artifacts);
  assert.deepEqual(sequenceTen.readers.map(identity), sequenceNine.readers.map(identity));
  assert.deepEqual(
    sequenceTen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceNine.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceTen.readers[index]),
    [
      {
        task: "M06-T08",
        role: "root-test",
        path: "tests/publisher-catalog-pinning.test.mjs",
        bytes: 38530,
        sha256: "bb3038a8c5bb241c863daa6c7f41c1d8ab210da81fdbe52697f33a3c14909116",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 99672,
        sha256: "d9d9edd6379357dde229999ce461a0dc66bf58dc0d7900eb6f5ece177a9b3fba",
      },
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 26679,
        sha256: "6b3a7869962046a3594a788095faad640c76fec660a59aee7b26844e831851ff",
      },
    ],
  );
  for (const [index, reader] of sequenceTen.readers.entries()) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(reader, sequenceNine.readers[index]);
    }
  }
});

test("sequence eleven reseals only the final M07-T05 strict-JSON bridge readers", () => {
  const sequenceTen = baselineManifest.checkpoints[9];
  const sequenceEleven = baselineManifest.checkpoints[10];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [26, 27];

  assert.deepEqual(sequenceEleven.artifacts, sequenceTen.artifacts);
  assert.deepEqual(sequenceEleven.readers.map(identity), sequenceTen.readers.map(identity));
  assert.deepEqual(
    sequenceEleven.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTen.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(sequenceEleven.readers.slice(26), [
    {
      task: "M07-T05",
      role: "proof-library",
      path: "scripts/lib/control-plane-local-api-proof.mjs",
      bytes: 77034,
      sha256: "c704e25024eaf7bdf317cc144f6b85922a3fe73a24c9c91e639ede032e22eb6f",
    },
    {
      task: "M07-T05",
      role: "root-test",
      path: "tests/control-plane-local-api.test.mjs",
      bytes: 17578,
      sha256: "4871c406390c4c9b36bff1c417a6c8dd22798736ea8daad1c63a3cbd0a978389",
    },
  ]);
  assert.deepEqual(sequenceEleven.readers.slice(0, 26), sequenceTen.readers.slice(0, 26));
});

test("sequence twelve reseals only the final M07-T05 ADR token-bounds bridge readers", () => {
  const sequenceEleven = baselineManifest.checkpoints[10];
  const sequenceTwelve = baselineManifest.checkpoints[11];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceTwelve.artifacts, sequenceEleven.artifacts);
  assert.deepEqual(sequenceTwelve.readers.map(identity), sequenceEleven.readers.map(identity));
  assert.deepEqual(
    sequenceTwelve.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceEleven.readers[index]) ? [] : [index],
    ),
    [26, 27],
  );
  assert.deepEqual(sequenceTwelve.readers.slice(26), [
    {
      task: "M07-T05",
      role: "proof-library",
      path: "scripts/lib/control-plane-local-api-proof.mjs",
      bytes: 77507,
      sha256: "e2050408c5bf3e084eacd6e42880310dafbfdf03b79821500cc0567b998f7d66",
    },
    {
      task: "M07-T05",
      role: "root-test",
      path: "tests/control-plane-local-api.test.mjs",
      bytes: 17716,
      sha256: "061b40ea20e0f7ee362f26bd54db954c3caea338df5e2f090ce34a4618ac37cc",
    },
  ]);
  assert.deepEqual(sequenceTwelve.readers.slice(0, 26), sequenceEleven.readers.slice(0, 26));
});

test("sequence thirteen reseals only the final M06-T09 stale-fixture root reader", () => {
  const sequenceTwelve = baselineManifest.checkpoints[11];
  const sequenceThirteen = baselineManifest.checkpoints[12];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceThirteen.artifacts, sequenceTwelve.artifacts);
  assert.deepEqual(sequenceThirteen.readers.map(identity), sequenceTwelve.readers.map(identity));
  assert.deepEqual(
    sequenceThirteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTwelve.readers[index]) ? [] : [index],
    ),
    [9],
  );
  assert.deepEqual(sequenceThirteen.readers[9], {
    task: "M06-T09",
    role: "root-test",
    path: "tests/publisher-bundle-publication.test.mjs",
    bytes: 63859,
    sha256: "ae7b688d904b4c77632fd78e0ee23b2264eae1574b4350306b5e2ec1b9974b8d",
  });
  assert.deepEqual(sequenceThirteen.readers.slice(0, 9), sequenceTwelve.readers.slice(0, 9));
  assert.deepEqual(sequenceThirteen.readers.slice(10), sequenceTwelve.readers.slice(10));
});

test("sequence fourteen reseals only the final T11 and M07-T01 compatibility readers", () => {
  const sequenceThirteen = baselineManifest.checkpoints[12];
  const sequenceFourteen = baselineManifest.checkpoints[13];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceFourteen.artifacts, sequenceThirteen.artifacts);
  assert.deepEqual(sequenceFourteen.readers.map(identity), sequenceThirteen.readers.map(identity));
  assert.deepEqual(
    sequenceFourteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceThirteen.readers[index]) ? [] : [index],
    ),
    [10, 11, 14],
  );
  assert.deepEqual(sequenceFourteen.readers[10], {
    task: "M06-T11",
    role: "proof-library",
    path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
    bytes: 166563,
    sha256: "06eb59602a768c13f19cc83289a574823d191aa3b62ed8fb7149381b326de802",
  });
  assert.deepEqual(sequenceFourteen.readers[11], {
    task: "M06-T11",
    role: "root-test",
    path: "tests/publisher-invalid-source-matrix.test.mjs",
    bytes: 60572,
    sha256: "29b407c2f7f1b17d17bff450185a9304c3186caea4a98973df3f1e3e4f684531",
  });
  assert.deepEqual(sequenceFourteen.readers[14], {
    task: "M07-T01",
    role: "proof-library",
    path: "scripts/lib/control-plane-bundle-store-proof.mjs",
    bytes: 99672,
    sha256: "888d5e81bda7ca2cdcc58bb063d49409cad5f5d73bdd9baaa16dc199e566e5c6",
  });
});

test("sequence fifteen appends M07-T06 and reseals its affected compatibility readers", () => {
  const sequenceFourteen = baselineManifest.checkpoints[13];
  const sequenceFifteen = baselineManifest.checkpoints[14];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [
    0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29,
  ];

  assert.deepEqual(sequenceFifteen.artifacts.slice(0, 14), sequenceFourteen.artifacts);
  assert.deepEqual(
    sequenceFifteen.readers.slice(0, 28).map(identity),
    sequenceFourteen.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFifteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFourteen.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(sequenceFifteen.artifacts[14], {
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    bytes: 47622,
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
  });
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFifteen.readers[index]),
    [
      {
        task: "M05-T09",
        role: "proof-library",
        path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
        bytes: 257943,
        sha256: "927201fd9e9067a1d03ca1b274724bb065ca97f47755348338a979e4c2f2f74a",
      },
      {
        task: "M05-T09",
        role: "root-test",
        path: "tests/reference-host-web-source-audit.test.mjs",
        bytes: 86740,
        sha256: "ec7aabd8e3446f58ca397e55f0b4580bee193e21e692c46fe89c3f4a60902ac9",
      },
      {
        task: "M06-T01",
        role: "proof-library",
        path: "scripts/lib/publisher-publish-result-proof.mjs",
        bytes: 59053,
        sha256: "384566b518a86a801228ca8717c2250856b0017d22a78aa3b8ca187e717a9779",
      },
      {
        task: "M06-T01",
        role: "root-test",
        path: "tests/publisher-publish-result.test.mjs",
        bytes: 39871,
        sha256: "5584e4b58dffb6221439e8841cc9ee167a7d40e8d27636bad40da682f3dffa84",
      },
      {
        task: "M06-T05",
        role: "proof-library",
        path: "scripts/lib/publisher-execution-preflight-proof.mjs",
        bytes: 71407,
        sha256: "bd3bfc693676bf5bf4dc5439173d25025042955293616eaf9136780575e4c6d5",
      },
      {
        task: "M06-T05",
        role: "root-test",
        path: "tests/publisher-execution-preflight.test.mjs",
        bytes: 17767,
        sha256: "9c2e5b0f71fce28d824b3591c60f83f58dbe78f8f94a1b555b34b07423f86cff",
      },
      {
        task: "M06-T08",
        role: "root-test",
        path: "tests/publisher-catalog-pinning.test.mjs",
        bytes: 38554,
        sha256: "3f2e94ca6135d3efa440ad851dccc08ebf28a78227c6b3fcd0aa92b6d0c00a39",
      },
      {
        task: "M06-T09",
        role: "proof-library",
        path: "scripts/lib/publisher-bundle-publication-proof.mjs",
        bytes: 138164,
        sha256: "3e0492155d08b2d1140adfc5ba78df4b71fbf944717f1b853b5be41bd64fa7e0",
      },
      {
        task: "M06-T09",
        role: "root-test",
        path: "tests/publisher-bundle-publication.test.mjs",
        bytes: 63883,
        sha256: "a464849fe555ae4b76ca0644efce0bdbd07044c9468220dbae137a8ab347eeac",
      },
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 167031,
        sha256: "3f06521596f5effa5936e9e0c1c22fe1cf7c5f555457ef80c187ae62855cb54d",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 60596,
        sha256: "bab6d5f50c6de37062741221afed63a72bd73e5c0bdd15f8536af2fea1c8d96f",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 105203,
        sha256: "fda6c679ce74201a90483f36d26702f5478bc67561ea632315541d542697f80b",
      },
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 27154,
        sha256: "ab25e94ed1880b79dfb22f98a3da67fa5b777fdfaa86b3f02739bed6af29a45c",
      },
      {
        task: "M07-T02",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-verification-proof.mjs",
        bytes: 98333,
        sha256: "96349b03fb83aac07e48b30e24787d639d80bdeea757ff7e7300754e078be443",
      },
      {
        task: "M07-T02",
        role: "root-test",
        path: "tests/control-plane-bundle-verification.test.mjs",
        bytes: 21676,
        sha256: "29501b0cf5410dbcab232551ddb757d80927ea355e5e786620d9e26ccb5e7c1b",
      },
      {
        task: "M07-T03",
        role: "proof-library",
        path: "scripts/lib/control-plane-package-preflight-proof.mjs",
        bytes: 90666,
        sha256: "2cb6c5af4849230f98f42defd5c216183ae23805a167758c9d103da7ce8ab523",
      },
      {
        task: "M07-T03",
        role: "root-test",
        path: "tests/control-plane-package-preflight.test.mjs",
        bytes: 21748,
        sha256: "0ffe96803caed6695456d69a9c04045d08c9d6f144c6553545ff11fc6e9cf4c7",
      },
      {
        task: "M07-T04",
        role: "proof-library",
        path: "scripts/lib/control-plane-reference-preflight-proof.mjs",
        bytes: 75427,
        sha256: "0102cd7af6cfce1ba186c513aeb5a53aa2e0e495dcba9c5f8d854ed6128ea4a3",
      },
      {
        task: "M07-T04",
        role: "root-test",
        path: "tests/control-plane-reference-preflight.test.mjs",
        bytes: 18894,
        sha256: "5bfe5a85e7b70babc93c4def358466400456d6eb990810a0553390293896c03d",
      },
      {
        task: "M07-T05",
        role: "proof-library",
        path: "scripts/lib/control-plane-local-api-proof.mjs",
        bytes: 84375,
        sha256: "a707bc6fe9ba28a66adcc9bf22320479ca43279d830d85b4bd79cd76fa434d4e",
      },
      {
        task: "M07-T05",
        role: "root-test",
        path: "tests/control-plane-local-api.test.mjs",
        bytes: 20177,
        sha256: "1efb09be7a449e4989a634ce60ba676d77961e866728e7ebce94b9b267e5cec9",
      },
      {
        task: "M07-T06",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-staging-proof.mjs",
        bytes: 77139,
        sha256: "4e15a16c61eba16825ddafc3c5218af8740e8ceda4e410feea8242a64cf751e7",
      },
      {
        task: "M07-T06",
        role: "root-test",
        path: "tests/control-plane-runtime-staging.test.mjs",
        bytes: 23831,
        sha256: "5182b67f3d9bcc92fc3ec956b71fc7c26731711d0ac411b5b4139500311ccafd",
      },
    ],
  );
});

test("sequence sixteen appends M07-T07 and reseals its affected compatibility readers", () => {
  const sequenceFifteen = baselineManifest.checkpoints[14];
  const sequenceSixteen = baselineManifest.checkpoints[15];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [
    0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31,
  ];

  assert.deepEqual(sequenceSixteen.artifacts.slice(0, 15), sequenceFifteen.artifacts);
  assert.deepEqual(
    sequenceSixteen.readers.slice(0, 30).map(identity),
    sequenceFifteen.readers.map(identity),
  );
  assert.deepEqual(
    sequenceSixteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFifteen.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(sequenceSixteen.artifacts[15], {
    task: "M07-T07",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json",
    bytes: 49892,
    sha256: "3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334",
  });
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceSixteen.readers[index]),
    [
      {
        task: "M05-T09",
        role: "proof-library",
        path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
        bytes: 261145,
        sha256: "a9e58b3f4c6aa70421121b285e9c576bc0d71dfcaa1ff90a2c37667b9a86cabe",
      },
      {
        task: "M05-T09",
        role: "root-test",
        path: "tests/reference-host-web-source-audit.test.mjs",
        bytes: 87748,
        sha256: "62103dfff978ce2a40e5e46875e0b4087d8998d38efd8100da6e009684abd37f",
      },
      {
        task: "M06-T01",
        role: "proof-library",
        path: "scripts/lib/publisher-publish-result-proof.mjs",
        bytes: 59362,
        sha256: "c6c8bce0f6c38b6508c68d16f1ddd2abc3b83328b3d4f4ba87255c3a4e9585fe",
      },
      {
        task: "M06-T01",
        role: "root-test",
        path: "tests/publisher-publish-result.test.mjs",
        bytes: 42492,
        sha256: "d1021ef5236e34b173e4e12031bbcc997ca09f18bfd7fd0cf8bd728652c72246",
      },
      {
        task: "M06-T05",
        role: "proof-library",
        path: "scripts/lib/publisher-execution-preflight-proof.mjs",
        bytes: 71716,
        sha256: "e1bac338f8b7e27f2747789964b505abfbc1bac5267f397f43b0a90fd8806c28",
      },
      {
        task: "M06-T05",
        role: "root-test",
        path: "tests/publisher-execution-preflight.test.mjs",
        bytes: 17767,
        sha256: "adaca2ed4bb6c611af648c223a887893cd998aca4e173fd4feff0987ac469f51",
      },
      {
        task: "M06-T08",
        role: "root-test",
        path: "tests/publisher-catalog-pinning.test.mjs",
        bytes: 38566,
        sha256: "48612a4f09a5c9840e71a2e31b6d6349521a3830e28bd8bf6335d110243d7df4",
      },
      {
        task: "M06-T09",
        role: "proof-library",
        path: "scripts/lib/publisher-bundle-publication-proof.mjs",
        bytes: 138472,
        sha256: "d63a8d2f98131d85cc5b0145e3a851ba182eecbc5ccbf47ed1769049e5e02bcf",
      },
      {
        task: "M06-T09",
        role: "root-test",
        path: "tests/publisher-bundle-publication.test.mjs",
        bytes: 63895,
        sha256: "b6f77feceb56f68cfced2556fed990468446d4fc9ab867a0680646f0b25123dc",
      },
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 168592,
        sha256: "72e3075cb4837b571791324b28a1fc5cdd723665933bf00079272be734a8cfab",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 62249,
        sha256: "7b90ccea78c6f2d11607f9257a36445b94409aca62fcc8e8fe904cde61a08c0f",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 110780,
        sha256: "7218cc33d429fc04cd53db195b0201f8d5ec5cf7869fee8d09d9843fd635b77e",
      },
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 27455,
        sha256: "6eddeaa24579834b1cd9fe35b4d6a8d51828104b8fc794daa49ad66b8320e463",
      },
      {
        task: "M07-T02",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-verification-proof.mjs",
        bytes: 102114,
        sha256: "ed4777ce54391ec9fe60a8b39e277844207467f0808ee164ef44211efdf181e4",
      },
      {
        task: "M07-T02",
        role: "root-test",
        path: "tests/control-plane-bundle-verification.test.mjs",
        bytes: 22237,
        sha256: "3694ad0c606bc71904e4172c51f959ead3a8523b9f1985f9daf51a8107ac9828",
      },
      {
        task: "M07-T03",
        role: "proof-library",
        path: "scripts/lib/control-plane-package-preflight-proof.mjs",
        bytes: 95339,
        sha256: "18978522f6b4659d37449c6363ba90e04573ee3c8d10f647c80c1778cc80ab6f",
      },
      {
        task: "M07-T03",
        role: "root-test",
        path: "tests/control-plane-package-preflight.test.mjs",
        bytes: 22335,
        sha256: "155a2a4f44aae40ccc6819ffb2e0968397ff6e0313194c5dba517dd40c270a32",
      },
      {
        task: "M07-T04",
        role: "proof-library",
        path: "scripts/lib/control-plane-reference-preflight-proof.mjs",
        bytes: 79921,
        sha256: "91792d2149be6e242772da2fc9bddbb22e66bd207989fa1fcd1d272f86f79040",
      },
      {
        task: "M07-T04",
        role: "root-test",
        path: "tests/control-plane-reference-preflight.test.mjs",
        bytes: 19481,
        sha256: "93deba1024086c76d6d62eef81a2175160bad7cffdf6208542012f40bc2aa937",
      },
      {
        task: "M07-T05",
        role: "proof-library",
        path: "scripts/lib/control-plane-local-api-proof.mjs",
        bytes: 90085,
        sha256: "41eff6d96b8a6c0d45326b1f221827662ecd179d777ee393e8e12f615392dc75",
      },
      {
        task: "M07-T05",
        role: "root-test",
        path: "tests/control-plane-local-api.test.mjs",
        bytes: 20830,
        sha256: "76c5b6ff3b7514fe93137cf173ddbe86fb2e23e0ee0fd187b511ba08d0f44ec2",
      },
      {
        task: "M07-T06",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-staging-proof.mjs",
        bytes: 87122,
        sha256: "d771447b9ab827b83e0a695f90a2f69aba93d1c6dee62fd0fb5ace7feb2cb8fd",
      },
      {
        task: "M07-T06",
        role: "root-test",
        path: "tests/control-plane-runtime-staging.test.mjs",
        bytes: 25564,
        sha256: "c2413f3aa8f374247fbe54a0d37ddffa44013c5327d8a77bf9b840daa7f57a01",
      },
      {
        task: "M07-T07",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-activation-proof.mjs",
        bytes: 85644,
        sha256: "99332dca08781d8b86282efb23a19b17ee14913c4d8886a08a7a9d4368f39b78",
      },
      {
        task: "M07-T07",
        role: "root-test",
        path: "tests/control-plane-runtime-activation.test.mjs",
        bytes: 26039,
        sha256: "4c88c51945a53e0730d0305b260048e676528edc692d079ddc1711726ee5208e",
      },
    ],
  );
});

test("sequence seventeen appends M07-T08 and reseals its affected compatibility readers", () => {
  const sequenceSixteen = baselineManifest.checkpoints[15];
  const sequenceSeventeen = baselineManifest.checkpoints[16];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [14, 15, 16, 18, 22, 26, 27, 28, 29, 30, 31, 32, 33];

  assert.deepEqual(sequenceSeventeen.artifacts.slice(0, 16), sequenceSixteen.artifacts);
  assert.deepEqual(
    sequenceSeventeen.readers.slice(0, 32).map(identity),
    sequenceSixteen.readers.map(identity),
  );
  assert.deepEqual(
    sequenceSeventeen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceSixteen.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(sequenceSeventeen.artifacts[16], {
    task: "M07-T08",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json",
    bytes: 44224,
    sha256: "c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9",
  });
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceSeventeen.readers[index]),
    [
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 114530,
        sha256: "546b63d426feceb155b65b03bf6a17b8067ad18d9b21865f44a5a67e0e8cc0cc",
      },
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 27447,
        sha256: "3e5919019d3277dad8677e61ba2528e8c5bb48c4cdc46a8e541f223f8ee3d8cf",
      },
      {
        task: "M07-T02",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-verification-proof.mjs",
        bytes: 105443,
        sha256: "b27dbbc4c734d22adc90bb5659e5adf299a4e5f2118b1150868ec33cdb8ecb2f",
      },
      {
        task: "M07-T03",
        role: "proof-library",
        path: "scripts/lib/control-plane-package-preflight-proof.mjs",
        bytes: 99700,
        sha256: "0bc84d46fb29b53f0b4a71dca2827383f12f9d018488eba4e92da62fd2c367c3",
      },
      {
        task: "M07-T04",
        role: "proof-library",
        path: "scripts/lib/control-plane-reference-preflight-proof.mjs",
        bytes: 84120,
        sha256: "3aeb55fac9af1f44b83893271ac20ba3db12dc2202ea7d4a0166062afd47eafd",
      },
      {
        task: "M07-T05",
        role: "proof-library",
        path: "scripts/lib/control-plane-local-api-proof.mjs",
        bytes: 95333,
        sha256: "7e5a7799bc47ef9c8defb6835dcf5eb8a28f21092a3edf3b21810c6a2d99d3e4",
      },
      {
        task: "M07-T05",
        role: "root-test",
        path: "tests/control-plane-local-api.test.mjs",
        bytes: 20927,
        sha256: "2a14f320fcec90c09652442478fdad6345a0683ff31e41d1d9cc1b5fb1b197fd",
      },
      {
        task: "M07-T06",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-staging-proof.mjs",
        bytes: 93916,
        sha256: "05a62f04b6de1963468cb92af6c16607d3b5d9c23e0593d2a4bc19613327b2a7",
      },
      {
        task: "M07-T06",
        role: "root-test",
        path: "tests/control-plane-runtime-staging.test.mjs",
        bytes: 27409,
        sha256: "d85655b1389cdc447a49dc7a0a69a2a2df2b0dd214eae1f2083e1d86aa6838bc",
      },
      {
        task: "M07-T07",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-activation-proof.mjs",
        bytes: 106509,
        sha256: "2fe1f4c785e26ad58e742f95abfae166329d4ab04a48413a979ba6dd25a2bae5",
      },
      {
        task: "M07-T07",
        role: "root-test",
        path: "tests/control-plane-runtime-activation.test.mjs",
        bytes: 26261,
        sha256: "be0d2b26dc7aa1cb5f9b9775063ea5d6a026d930600c93fb66b6489f1a1d59e2",
      },
      {
        task: "M07-T08",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-recovery-proof.mjs",
        bytes: 84219,
        sha256: "08f143107430dde90cf1865c21d7ce1ec854897b0c1c4306b96525bdd0d18daa",
      },
      {
        task: "M07-T08",
        role: "root-test",
        path: "tests/control-plane-runtime-recovery.test.mjs",
        bytes: 24939,
        sha256: "b97e7991e0ac20e7232112594228fdd829a536e81d16d06fd3f909e7e3a02492",
      },
    ],
  );
});

test("sequence eighteen preserves every artifact and reseals the final T08 compatibility chain", () => {
  const sequenceSeventeen = baselineManifest.checkpoints[16];
  const sequenceEighteen = baselineManifest.checkpoints[17];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14];

  assert.deepEqual(sequenceEighteen.artifacts, sequenceSeventeen.artifacts);
  assert.deepEqual(sequenceEighteen.readers.map(identity), sequenceSeventeen.readers.map(identity));
  assert.deepEqual(
    sequenceEighteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceSeventeen.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceEighteen.readers[index]),
    [
      {
        task: "M05-T09",
        role: "proof-library",
        path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
        bytes: 263857,
        sha256: "bb8f2dde9a4f63a848003cf7be7b69c1c9681992d56c9a254653dee8cbd7bbe3",
      },
      {
        task: "M05-T09",
        role: "root-test",
        path: "tests/reference-host-web-source-audit.test.mjs",
        bytes: 89057,
        sha256: "9442048b8b96f6aec06136b489dc08e01f159c46609eeb225aa2f949c98e3521",
      },
      {
        task: "M06-T01",
        role: "proof-library",
        path: "scripts/lib/publisher-publish-result-proof.mjs",
        bytes: 59671,
        sha256: "f50e209675cfcd41547bf2b25aeb29e5033384bb7011c3be6b1f3ad74e7ad8f1",
      },
      {
        task: "M06-T01",
        role: "root-test",
        path: "tests/publisher-publish-result.test.mjs",
        bytes: 45051,
        sha256: "0ee1761fd1990622cffb7ee225e14c66dc7dfde4e1a221263f0739b7839cf8ec",
      },
      {
        task: "M06-T05",
        role: "proof-library",
        path: "scripts/lib/publisher-execution-preflight-proof.mjs",
        bytes: 72025,
        sha256: "b4d55e0da2a2992bcc311254bfc47c2c69287f9e049ed8e84bb9b50c8886d2a4",
      },
      {
        task: "M06-T05",
        role: "root-test",
        path: "tests/publisher-execution-preflight.test.mjs",
        bytes: 17767,
        sha256: "8ab35ee609d175377ccb2beb679f6d76f93c9c2cf4bc749df0d94a7ff7e47e74",
      },
      {
        task: "M06-T08",
        role: "root-test",
        path: "tests/publisher-catalog-pinning.test.mjs",
        bytes: 38558,
        sha256: "93854fbe1861fe7fdda98bbbe909a0b86f0195dbcf3437b5d15824ba0eed9c3e",
      },
      {
        task: "M06-T09",
        role: "proof-library",
        path: "scripts/lib/publisher-bundle-publication-proof.mjs",
        bytes: 138780,
        sha256: "33e2683251e7bb515e090325b67dd4b2e5ce6be608b32955d9597b426a414cef",
      },
      {
        task: "M06-T09",
        role: "root-test",
        path: "tests/publisher-bundle-publication.test.mjs",
        bytes: 63887,
        sha256: "3cad2a4ea3b18ecadd6baa0c46c4e75b28b3bd059efef2ac57fc0f785c4ac5f3",
      },
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 169060,
        sha256: "9a5553b24f03f3042cdf5e5270c57d76aba518d58e570366db7dbde173bdb010",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 62241,
        sha256: "423e720c5740d1a21acd2fcb8e19d80e6801aff631becff52afe4240f05b30f4",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 116441,
        sha256: "e130843bc24f3e1f219f6ede2b40a51894dcbbeade70fa347dc23768c04ffe71",
      },
    ],
  );
});

test("sequence nineteen preserves prior authority and repairs only the final staging reader", () => {
  const sequenceEighteen = baselineManifest.checkpoints[17];
  const sequenceNineteen = baselineManifest.checkpoints[18];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceNineteen.artifacts, sequenceEighteen.artifacts);
  assert.deepEqual(sequenceNineteen.readers.map(identity), sequenceEighteen.readers.map(identity));
  assert.deepEqual(
    sequenceNineteen.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceEighteen.readers[index]) ? [] : [index],
    ),
    [28],
  );
  assert.deepEqual(sequenceNineteen.readers[28], {
    task: "M07-T06",
    role: "proof-library",
    path: "scripts/lib/control-plane-runtime-staging-proof.mjs",
    bytes: 93916,
    sha256: "d0b6ec50df131066283619a01fa41fffdbb2a68c409d3c8d1a816f625f658521",
  });
});

test("sequence twenty preserves prior authority and repairs only the final activation reader", () => {
  const sequenceNineteen = baselineManifest.checkpoints[18];
  const sequenceTwenty = baselineManifest.checkpoints[19];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.deepEqual(sequenceTwenty.artifacts, sequenceNineteen.artifacts);
  assert.deepEqual(sequenceTwenty.readers.map(identity), sequenceNineteen.readers.map(identity));
  assert.deepEqual(
    sequenceTwenty.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceNineteen.readers[index]) ? [] : [index],
    ),
    [30],
  );
  assert.deepEqual(sequenceTwenty.readers[30], {
    task: "M07-T07",
    role: "proof-library",
    path: "scripts/lib/control-plane-runtime-activation-proof.mjs",
    bytes: 106509,
    sha256: "d322bf867930215d0f9e0f532bdacbea4ba50145dfa5df38f2e559102cc080ef",
  });
});

test("sequence twenty-one preserves its reviewed prefix, reseals compatibility readers, and appends M07-T09", () => {
  const sequenceTwenty = baselineManifest.checkpoints[19];
  const sequenceTwentyOne = baselineManifest.checkpoints[20];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(sequenceTwentyOne.sequence, 21);
  assert.equal(
    sequenceTwentyOne.predecessorSha256,
    "8ba332b059e508dcb93aec4211edf3dcb10fb497d3a743b61ff7ee7e08c8a28e",
  );
  assert.deepEqual(sequenceTwentyOne.artifacts.slice(0, 17), sequenceTwenty.artifacts);
  assert.deepEqual(
    sequenceTwentyOne.artifacts.map(({ task, path: artifactPath }) => ({
      task,
      path: artifactPath,
    })),
    [
      ...sequenceTwenty.artifacts.map(({ task, path: artifactPath }) => ({
        task,
        path: artifactPath,
      })),
      {
        task: "M07-T09",
        path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json",
      },
    ],
  );
  assert.deepEqual(sequenceTwentyOne.readers.map(identity), [
    ...sequenceTwenty.readers.map(identity),
    {
      task: "M07-T09",
      role: "proof-library",
      path: "scripts/lib/control-plane-runtime-fault-injection-proof.mjs",
    },
    {
      task: "M07-T09",
      role: "root-test",
      path: "tests/control-plane-runtime-fault-injection.test.mjs",
    },
  ]);
  assert.deepEqual(sequenceTwentyOne.artifacts[17], {
    task: "M07-T09",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json",
    bytes: 64493,
    sha256: "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
  });
  const changedReaderIndexes = [
    0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31, 32,
    33, 34, 35,
  ];
  assert.deepEqual(
    sequenceTwentyOne.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTwenty.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceTwentyOne.readers[index]),
    [
      {
        task: "M05-T09",
        role: "proof-library",
        path: "scripts/lib/reference-host-web-source-audit-proof.mjs",
        bytes: 266698,
        sha256: "3e105e24dd9771a578cd43d8e82f884dd0a2ef04fb1dcc7af1d617ed05ec9ffe",
      },
      {
        task: "M05-T09",
        role: "root-test",
        path: "tests/reference-host-web-source-audit.test.mjs",
        bytes: 90209,
        sha256: "34427c9fe31f3ec6bca14a661d5ea092058aa2e4d24d93a33e551a604e9bc162",
      },
      {
        task: "M06-T01",
        role: "proof-library",
        path: "scripts/lib/publisher-publish-result-proof.mjs",
        bytes: 59980,
        sha256: "dcf7dbe1b4bfcda4c83ce3dc93ab2ae41e42893f4ae8ec197b221e494009aa09",
      },
      {
        task: "M06-T01",
        role: "root-test",
        path: "tests/publisher-publish-result.test.mjs",
        bytes: 50786,
        sha256: "75145e262363ceacd930806afe3f786b69b0a65910060de239f11b99c3d3cff5",
      },
      {
        task: "M06-T05",
        role: "proof-library",
        path: "scripts/lib/publisher-execution-preflight-proof.mjs",
        bytes: 72334,
        sha256: "9d1b048513ac4cc0170dae2cc61c5e0befd3ed5c0d4c764e0f5f0199a6a39fea",
      },
      {
        task: "M06-T05",
        role: "root-test",
        path: "tests/publisher-execution-preflight.test.mjs",
        bytes: 24873,
        sha256: "5e0e7c2d7362f7a83996ef953ac45c0e4f249f844cc5b64de48a961df12553b1",
      },
      {
        task: "M06-T08",
        role: "root-test",
        path: "tests/publisher-catalog-pinning.test.mjs",
        bytes: 38586,
        sha256: "38eff5f01bdb54713446dda1898b87b5ca3da9064bae27937a1ebe9486ad52e5",
      },
      {
        task: "M06-T09",
        role: "proof-library",
        path: "scripts/lib/publisher-bundle-publication-proof.mjs",
        bytes: 139088,
        sha256: "7680e332fe8c9c5e585022c3b05b885d6d40722a882f67f3a2646554f5413a46",
      },
      {
        task: "M06-T09",
        role: "root-test",
        path: "tests/publisher-bundle-publication.test.mjs",
        bytes: 74554,
        sha256: "0919d7a79dd353b23d1491cdec7c50a1fa58ab867a3ba9fc64a337cec2343e25",
      },
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 170585,
        sha256: "eb1929fa1ad3f468ee9b38b47fe7727ba7e0202042b63574bd411c93a344c014",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 76636,
        sha256: "c697bcad81cc36392db37be25f2cc7eda525494023cf78743b4b55331895b97a",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 118818,
        sha256: "fdbc9cf4265b7119bd99fad60d844284c0f08733a7a1608ae26288637d334abc",
      },
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 27832,
        sha256: "8b628293422bf7eb62398b9479cfde053ca651b8f0f7073b8cdc1df4f71d7380",
      },
      {
        task: "M07-T02",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-verification-proof.mjs",
        bytes: 106323,
        sha256: "3cea46972681a31f60f6f1ae747b7354d464f52d887ec9cfc5a7e733730dbecb",
      },
      {
        task: "M07-T02",
        role: "root-test",
        path: "tests/control-plane-bundle-verification.test.mjs",
        bytes: 23923,
        sha256: "4ac78bebc229379170e7d01623f081bec2bc933c8050ba3aa54c4cf0f76b1c1d",
      },
      {
        task: "M07-T03",
        role: "proof-library",
        path: "scripts/lib/control-plane-package-preflight-proof.mjs",
        bytes: 101936,
        sha256: "c7308205063b08f73ef500fefeaa4ffba59f6417b34cf188747c790defab64d9",
      },
      {
        task: "M07-T03",
        role: "root-test",
        path: "tests/control-plane-package-preflight.test.mjs",
        bytes: 23343,
        sha256: "7ef485c7cd44532e70bf11b93c352eb70679b9466a65fc0eddf4c205a9db6465",
      },
      {
        task: "M07-T04",
        role: "proof-library",
        path: "scripts/lib/control-plane-reference-preflight-proof.mjs",
        bytes: 86191,
        sha256: "b1b5a166c05038d815fbe48cf60cd6ffe61c8db07c9beccb3e7feb32d4786d08",
      },
      {
        task: "M07-T04",
        role: "root-test",
        path: "tests/control-plane-reference-preflight.test.mjs",
        bytes: 20489,
        sha256: "10d1119bc86239cd5305a9c4d546b2095d816ce84774aa0308351c181ffca0fa",
      },
      {
        task: "M07-T05",
        role: "proof-library",
        path: "scripts/lib/control-plane-local-api-proof.mjs",
        bytes: 97717,
        sha256: "1b82c0d09d9934fc0b35e1896e76718a274fd851da59213f678b8edef36d6a62",
      },
      {
        task: "M07-T05",
        role: "root-test",
        path: "tests/control-plane-local-api.test.mjs",
        bytes: 22149,
        sha256: "73ffc34a4fcaf59b8448b48ab9ff198487091c936b0af8c70bb06e1dfd05fe26",
      },
      {
        task: "M07-T06",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-staging-proof.mjs",
        bytes: 96719,
        sha256: "51361e62735790d6e6ef4b14b99269dd0d9b27d5577b01cbe53aa005f34824fb",
      },
      {
        task: "M07-T06",
        role: "root-test",
        path: "tests/control-plane-runtime-staging.test.mjs",
        bytes: 28421,
        sha256: "2ac3c371e5ec80c258d5a7a4797cd557c0253216c6ba13d0ebc745ab79e17baf",
      },
      {
        task: "M07-T07",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-activation-proof.mjs",
        bytes: 109975,
        sha256: "7ca58483b443c3691398553c28b85e459138ed35f6b6c239ca5f1a786b732dab",
      },
      {
        task: "M07-T07",
        role: "root-test",
        path: "tests/control-plane-runtime-activation.test.mjs",
        bytes: 27487,
        sha256: "d7d902c71e90d05f22b7a417f945f37c127b315b845fdc95ab9ab4a76a5feb21",
      },
      {
        task: "M07-T08",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-recovery-proof.mjs",
        bytes: 90616,
        sha256: "186291ae66eadda4a449fee52b51e58c8f29564a54f6bd135a782cbd519b1824",
      },
      {
        task: "M07-T08",
        role: "root-test",
        path: "tests/control-plane-runtime-recovery.test.mjs",
        bytes: 26432,
        sha256: "d1c898e91d695972c6cdc14e9d5eb138c6655e43a5cbefb5c32bd819748a9eeb",
      },
      {
        task: "M07-T09",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-fault-injection-proof.mjs",
        bytes: 64932,
        sha256: "da3fed33227c78eef872d06a3aedaf98a4e87e91de12893a21aceb5a9365216f",
      },
      {
        task: "M07-T09",
        role: "root-test",
        path: "tests/control-plane-runtime-fault-injection.test.mjs",
        bytes: 17341,
        sha256: "f50017b668eb7f4a60d596a2d87a7e5b067989a9e1fe9a00270e685c44a4b8f6",
      },
    ],
  );
  for (let index = 0; index < sequenceTwenty.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceTwentyOne.readers[index], sequenceTwenty.readers[index]);
    }
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentyOne),
    "ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939",
  );
});

test("sequence twenty-two preserves authority and reseals only I07-03 workflow-dependent readers", () => {
  const sequenceTwentyOne = baselineManifest.checkpoints[20];
  const sequenceTwentyTwo = baselineManifest.checkpoints[21];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [8, 10, 11, 12, 14];

  assert.equal(sequenceTwentyTwo.sequence, 22);
  assert.equal(
    sequenceTwentyTwo.predecessorSha256,
    "ce12c066545e21779abf891898aaf0b09ceb1c0c1b51be382a0adabd5f86e939",
  );
  assert.deepEqual(sequenceTwentyTwo.artifacts, sequenceTwentyOne.artifacts);
  assert.deepEqual(
    sequenceTwentyTwo.readers.map(identity),
    sequenceTwentyOne.readers.map(identity),
  );
  assert.deepEqual(
    sequenceTwentyTwo.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTwentyOne.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceTwentyTwo.readers[index]),
    [
      {
        task: "M06-T09",
        role: "proof-library",
        path: "scripts/lib/publisher-bundle-publication-proof.mjs",
        bytes: 139088,
        sha256: "7fa4303bb54205c35f08aca62cbb6b07efaa840cd79706b4c4787f2d7da09462",
      },
      {
        task: "M06-T11",
        role: "proof-library",
        path: "scripts/lib/publisher-invalid-source-matrix-proof.mjs",
        bytes: 170739,
        sha256: "2fd1e56ae45718f58a30c8eb8293d79e6bd7923d61da12131671964163614a90",
      },
      {
        task: "M06-T11",
        role: "root-test",
        path: "tests/publisher-invalid-source-matrix.test.mjs",
        bytes: 77231,
        sha256: "074535d871037e8c082326e7be246290a357b6fae6c318a5c310cbf24c532ac3",
      },
      {
        task: "M06-T10",
        role: "proof-library",
        path: "scripts/lib/publisher-official-golden-proof.mjs",
        bytes: 58144,
        sha256: "ecaf564db36e14e11cb3f68e652a280b7961bbd300205a7b3f765be67ae391fe",
      },
      {
        task: "M07-T01",
        role: "proof-library",
        path: "scripts/lib/control-plane-bundle-store-proof.mjs",
        bytes: 119679,
        sha256: "e42ef8c63388ec2263fc399b30d4dedd9e4ae0403a62a607552724b16d7e494f",
      },
    ],
  );
  for (let index = 0; index < sequenceTwentyOne.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceTwentyTwo.readers[index], sequenceTwentyOne.readers[index]);
    }
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentyTwo),
    "aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e",
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
  rewritten.checkpoints[6].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[5],
  );
  rewritten.checkpoints[7].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[6],
  );
  rewritten.checkpoints[8].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[7],
  );
  rewritten.checkpoints[9].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[8],
  );
  rewritten.checkpoints[10].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[9],
  );
  rewritten.checkpoints[11].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[10],
  );
  rewritten.checkpoints[12].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[11],
  );
  rewritten.checkpoints[13].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[12],
  );
  rewritten.checkpoints[14].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[13],
  );
  rewritten.checkpoints[15].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[14],
  );
  rewritten.checkpoints[16].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[15],
  );
  rewritten.checkpoints[17].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[16],
  );
  rewritten.checkpoints[18].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[17],
  );
  rewritten.checkpoints[19].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[18],
  );
  rewritten.checkpoints[20].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[19],
  );
  rewritten.checkpoints[21].predecessorSha256 = calculateProofReaderCheckpointSha256(
    rewritten.checkpoints[20],
  );
  rewritten.headSha256 = calculateProofReaderCheckpointSha256(rewritten.checkpoints[21]);

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
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 11),
    },
    {
      checkpoint: baselineManifest.checkpoints[5],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 11),
    },
    {
      checkpoint: baselineManifest.checkpoints[6],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 13),
    },
    {
      checkpoint: baselineManifest.checkpoints[7],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[8],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[9],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[10],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[11],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[12],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[13],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 14),
    },
    {
      checkpoint: baselineManifest.checkpoints[14],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 15),
    },
    {
      checkpoint: baselineManifest.checkpoints[15],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 16),
    },
    {
      checkpoint: baselineManifest.checkpoints[16],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 17),
    },
    {
      checkpoint: baselineManifest.checkpoints[17],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 17),
    },
    {
      checkpoint: baselineManifest.checkpoints[18],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 17),
    },
    {
      checkpoint: baselineManifest.checkpoints[19],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 17),
    },
    {
      checkpoint: baselineManifest.checkpoints[20],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY,
    },
    {
      checkpoint: baselineManifest.checkpoints[21],
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
  assert.equal(PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length, 18);
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
  wrongSequence.checkpoints[21].sequence = 23;
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

test("one changed reader is a valid review candidate while thirty-five peers remain unchanged", () => {
  const manifest = cloneBaseline();
  const reviewedReaders = structuredClone(manifest.checkpoints.at(-1).readers);
  const successor = appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "successor");
  });

  const candidate = validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest));
  assert.deepEqual(candidate, {
    status: "REVIEW_REQUIRED",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    anchoredCheckpoints: 22,
    candidateSequence: 23,
    predecessorSha256: baselineManifest.headSha256,
    candidateSha256: manifest.headSha256,
  });
  assert.equal(successor.sequence, 23);
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
  manifest.checkpoints[6].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[5],
  );
  manifest.checkpoints[7].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[6],
  );
  manifest.checkpoints[8].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[7],
  );
  manifest.checkpoints[9].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[8],
  );
  manifest.checkpoints[10].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[9],
  );
  manifest.checkpoints[11].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[10],
  );
  manifest.checkpoints[12].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[11],
  );
  manifest.checkpoints[13].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[12],
  );
  manifest.checkpoints[14].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[13],
  );
  manifest.checkpoints[15].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[14],
  );
  manifest.checkpoints[16].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[15],
  );
  manifest.checkpoints[17].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[16],
  );
  manifest.checkpoints[18].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[17],
  );
  manifest.checkpoints[19].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[18],
  );
  manifest.checkpoints[20].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[19],
  );
  manifest.checkpoints[21].predecessorSha256 = calculateProofReaderCheckpointSha256(
    manifest.checkpoints[20],
  );
  manifest.headSha256 = calculateProofReaderCheckpointSha256(manifest.checkpoints[21]);
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
