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
  readCheckpointedFrozenArtifact,
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

function reheadFrom(manifest, changedCheckpointIndex) {
  for (let index = changedCheckpointIndex + 1; index < manifest.checkpoints.length; index += 1) {
    manifest.checkpoints[index].predecessorSha256 = calculateProofReaderCheckpointSha256(
      manifest.checkpoints[index - 1],
    );
  }
  manifest.headSha256 = calculateProofReaderCheckpointSha256(manifest.checkpoints.at(-1));
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
  assert.equal(manifest.checkpoints.length, 62);
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
  assert.equal(manifest.checkpoints[22].sequence, 23);
  assert.equal(
    manifest.checkpoints[22].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[21],
  );
  assert.equal(manifest.checkpoints[23].sequence, 24);
  assert.equal(
    manifest.checkpoints[23].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[22],
  );
  assert.equal(manifest.checkpoints[24].sequence, 25);
  assert.equal(
    manifest.checkpoints[24].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[23],
  );
  assert.equal(manifest.checkpoints[25].sequence, 26);
  assert.equal(
    manifest.checkpoints[25].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[24],
  );
  assert.equal(manifest.checkpoints[26].sequence, 27);
  assert.equal(
    manifest.checkpoints[26].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[25],
  );
  assert.equal(manifest.checkpoints[27].sequence, 28);
  assert.equal(
    manifest.checkpoints[27].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[26],
  );
  assert.equal(manifest.checkpoints[28].sequence, 29);
  assert.equal(
    manifest.checkpoints[28].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[27],
  );
  assert.equal(manifest.checkpoints[29].sequence, 30);
  assert.equal(
    manifest.checkpoints[29].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[28],
  );
  assert.equal(manifest.checkpoints[30].sequence, 31);
  assert.equal(
    manifest.checkpoints[30].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[29],
  );
  assert.equal(manifest.checkpoints[31].sequence, 32);
  assert.equal(
    manifest.checkpoints[31].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[30],
  );
  assert.equal(manifest.checkpoints[32].sequence, 33);
  assert.equal(
    manifest.checkpoints[32].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[31],
  );
  assert.equal(manifest.checkpoints[33].sequence, 34);
  assert.equal(
    manifest.checkpoints[33].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[32],
  );
  assert.equal(manifest.checkpoints[34].sequence, 35);
  assert.equal(
    manifest.checkpoints[34].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[33],
  );
  assert.equal(manifest.checkpoints[35].sequence, 36);
  assert.equal(
    manifest.checkpoints[35].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[34],
  );
  assert.equal(manifest.checkpoints[36].sequence, 37);
  assert.equal(
    manifest.checkpoints[36].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[35],
  );
  assert.equal(manifest.checkpoints[37].sequence, 38);
  assert.equal(
    manifest.checkpoints[37].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[36],
  );
  assert.equal(manifest.checkpoints[38].sequence, 39);
  assert.equal(
    manifest.checkpoints[38].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[37],
  );
  assert.equal(manifest.checkpoints[39].sequence, 40);
  assert.equal(
    manifest.checkpoints[39].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[38],
  );
  assert.equal(manifest.checkpoints[40].sequence, 41);
  assert.equal(
    manifest.checkpoints[40].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[39],
  );
  assert.equal(manifest.checkpoints[41].sequence, 42);
  assert.equal(
    manifest.checkpoints[41].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[40],
  );
  assert.equal(manifest.checkpoints[42].sequence, 43);
  assert.equal(
    manifest.checkpoints[42].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[41],
  );
  assert.equal(manifest.checkpoints[43].sequence, 44);
  assert.equal(
    manifest.checkpoints[43].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[42],
  );
  assert.equal(manifest.checkpoints[44].sequence, 45);
  assert.equal(
    manifest.checkpoints[44].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[43],
  );
  assert.equal(manifest.checkpoints[45].sequence, 46);
  assert.equal(
    manifest.checkpoints[45].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[44],
  );
  assert.equal(manifest.checkpoints[46].sequence, 47);
  assert.equal(
    manifest.checkpoints[46].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[45],
  );
  assert.equal(manifest.checkpoints[47].sequence, 48);
  assert.equal(
    manifest.checkpoints[47].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[46],
  );
  assert.equal(manifest.checkpoints[48].sequence, 49);
  assert.equal(
    manifest.checkpoints[48].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[47],
  );
  assert.equal(manifest.checkpoints[49].sequence, 50);
  assert.equal(
    manifest.checkpoints[49].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[48],
  );
  assert.equal(manifest.checkpoints[50].sequence, 51);
  assert.equal(
    manifest.checkpoints[50].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[49],
  );
  assert.equal(manifest.checkpoints[51].sequence, 52);
  assert.equal(
    manifest.checkpoints[51].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[50],
  );
  assert.equal(manifest.checkpoints[52].sequence, 53);
  assert.equal(
    manifest.checkpoints[52].predecessorSha256,
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[51],
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
  assert.equal(manifest.checkpoints[22].artifacts.length, 19);
  assert.equal(manifest.checkpoints[22].readers.length, 38);
  assert.equal(manifest.checkpoints[23].artifacts.length, 20);
  assert.equal(manifest.checkpoints[23].readers.length, 40);
  assert.equal(manifest.checkpoints[24].artifacts.length, 25);
  assert.equal(manifest.checkpoints[24].readers.length, 50);
  assert.equal(manifest.checkpoints[25].artifacts.length, 25);
  assert.equal(manifest.checkpoints[25].readers.length, 50);
  assert.equal(manifest.checkpoints[26].artifacts.length, 25);
  assert.equal(manifest.checkpoints[26].readers.length, 50);
  assert.equal(manifest.checkpoints[27].artifacts.length, 25);
  assert.equal(manifest.checkpoints[27].readers.length, 50);
  assert.equal(manifest.checkpoints[28].artifacts.length, 26);
  assert.equal(manifest.checkpoints[28].readers.length, 52);
  assert.equal(manifest.checkpoints[29].artifacts.length, 27);
  assert.equal(manifest.checkpoints[29].readers.length, 54);
  assert.equal(manifest.checkpoints[30].artifacts.length, 28);
  assert.equal(manifest.checkpoints[30].readers.length, 56);
  assert.equal(manifest.checkpoints[31].artifacts.length, 29);
  assert.equal(manifest.checkpoints[31].readers.length, 58);
  assert.equal(manifest.checkpoints[32].artifacts.length, 30);
  assert.equal(manifest.checkpoints[32].readers.length, 60);
  assert.equal(manifest.checkpoints[33].artifacts.length, 31);
  assert.equal(manifest.checkpoints[33].readers.length, 62);
  assert.equal(manifest.checkpoints[34].artifacts.length, 32);
  assert.equal(manifest.checkpoints[34].readers.length, 64);
  assert.equal(manifest.checkpoints[35].artifacts.length, 33);
  assert.equal(manifest.checkpoints[35].readers.length, 66);
  assert.equal(manifest.checkpoints[36].artifacts.length, 34);
  assert.equal(manifest.checkpoints[36].readers.length, 68);
  assert.equal(manifest.checkpoints[37].artifacts.length, 35);
  assert.equal(manifest.checkpoints[37].readers.length, 70);
  assert.equal(manifest.checkpoints[38].artifacts.length, 35);
  assert.equal(manifest.checkpoints[38].readers.length, 70);
  assert.equal(manifest.checkpoints[39].artifacts.length, 36);
  assert.equal(manifest.checkpoints[39].readers.length, 72);
  assert.equal(manifest.checkpoints[40].artifacts.length, 37);
  assert.equal(manifest.checkpoints[40].readers.length, 74);
  assert.equal(manifest.checkpoints[41].artifacts.length, 38);
  assert.equal(manifest.checkpoints[41].readers.length, 76);
  assert.equal(manifest.checkpoints[42].artifacts.length, 39);
  assert.equal(manifest.checkpoints[42].readers.length, 78);
  assert.equal(manifest.checkpoints[43].artifacts.length, 40);
  assert.equal(manifest.checkpoints[43].readers.length, 80);
  assert.equal(manifest.checkpoints[44].artifacts.length, 41);
  assert.equal(manifest.checkpoints[44].readers.length, 82);
  assert.equal(manifest.checkpoints[45].artifacts.length, 42);
  assert.equal(manifest.checkpoints[45].readers.length, 84);
  assert.equal(manifest.checkpoints[46].artifacts.length, 43);
  assert.equal(manifest.checkpoints[46].readers.length, 86);
  assert.equal(manifest.checkpoints[47].artifacts.length, 44);
  assert.equal(manifest.checkpoints[47].readers.length, 88);
  assert.equal(manifest.checkpoints[48].artifacts.length, 45);
  assert.equal(manifest.checkpoints[48].readers.length, 90);
  assert.equal(manifest.checkpoints[49].artifacts.length, 46);
  assert.equal(manifest.checkpoints[49].readers.length, 92);
  assert.equal(manifest.checkpoints[50].artifacts.length, 47);
  assert.equal(manifest.checkpoints[50].readers.length, 94);
  assert.equal(manifest.checkpoints[51].artifacts.length, 48);
  assert.equal(manifest.checkpoints[51].readers.length, 96);
  assert.equal(manifest.checkpoints[52].artifacts.length, 49);
  assert.equal(manifest.checkpoints[52].readers.length, 98);
  assert.equal(manifest.checkpoints[53].artifacts.length, 49);
  assert.equal(manifest.checkpoints[53].readers.length, 98);
  assert.equal(manifest.checkpoints[54].artifacts.length, 49);
  assert.equal(manifest.checkpoints[54].readers.length, 98);
  assert.equal(manifest.checkpoints[55].artifacts.length, 49);
  assert.equal(manifest.checkpoints[55].readers.length, 98);
  assert.equal(manifest.checkpoints[56].artifacts.length, 50);
  assert.equal(manifest.checkpoints[56].readers.length, 100);
  assert.equal(manifest.checkpoints[57].artifacts.length, 51);
  assert.equal(manifest.checkpoints[57].readers.length, 102);
  assert.equal(manifest.checkpoints[58].artifacts.length, 51);
  assert.equal(manifest.checkpoints[58].readers.length, 102);
  assert.equal(manifest.checkpoints[59].artifacts.length, 52);
  assert.equal(manifest.checkpoints[59].readers.length, 104);
  assert.equal(manifest.checkpoints[60].artifacts.length, 52);
  assert.equal(manifest.checkpoints[60].readers.length, 104);
  assert.equal(manifest.checkpoints[61].artifacts.length, 52);
  assert.equal(manifest.checkpoints[61].readers.length, 104);
  assert.equal(
    calculateProofReaderCheckpointSha256(manifest.checkpoints.at(-1)),
    manifest.headSha256,
  );
  assert.equal(manifest.headSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[61]);
  assert.equal(PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256.length, 62);
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
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[22],
    "3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[23],
    "f7dcc3f74653e739a46434b8fa746f177a9b33cabb874ad9910747dcd46310de",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[24],
    "d6bcdf4a26c4b4fd7ea51c83b92f551ff76a98802381284537516d2969b70137",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[25],
    "0027f8c18eb1837e9998a5c5a998072e8eebec54e4e8edef974129b910134f5b",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[26],
    "bf21a7a600ca9d569d90a8711e4fe857e91beb933d8a3c7289ebfbf0b8a2d87a",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[27],
    "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[28],
    "ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[29],
    "f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[30],
    "181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[31],
    "9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[32],
    "64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[33],
    "f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[34],
    "a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[35],
    "4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[36],
    "e43b48e2d4873b9212d4d0b1bf3e6fb03f56fcc350f8bc9ad65409891995c310",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[37],
    "64f7d6519589a5a8cb564af1215c2a12c44297f8ea855910613ea3b361cee6d0",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[38],
    "6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[39],
    "e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[40],
    "b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[41],
    "40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[42],
    "0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[43],
    "f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[44],
    "340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[45],
    "f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[46],
    "c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[47],
    "5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[48],
    "45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[49],
    "6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[50],
    "42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[51],
    "c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[52],
    "48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[53],
    "0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[54],
    "f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17",
  );
  assert.equal(
    PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[55],
    "1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a",
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
    [
      6, 8, 9, 10, 11, 11, 13, 14, 14, 14, 14, 14, 14, 14, 15, 16, 17, 17, 17, 17, 18, 18, 19, 20,
      25, 25, 25, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 35, 36, 37, 38, 39, 40, 41, 42, 43,
      44, 45, 46, 47, 48, 49, 49, 49, 49, 50, 51, 51, 52, 52, 52,
    ],
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
    checkpoints: 62,
    frozenArtifacts: 52,
    currentReaders: 104,
  });
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.checkpoints[0].readers[0]));
});

test("sequence thirty-eight reseals the final editor readers and appends exact T10 authority", () => {
  const sequenceThirtySeven = baselineManifest.checkpoints[36];
  const sequenceThirtyEight = baselineManifest.checkpoints[37];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [
    50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67,
  ];

  assert.deepEqual(sequenceThirtyEight.artifacts.slice(0, 34), sequenceThirtySeven.artifacts);
  assert.deepEqual(
    sequenceThirtyEight.readers.slice(0, 68).map(identity),
    sequenceThirtySeven.readers.map(identity),
  );
  assert.deepEqual(
    sequenceThirtyEight.readers
      .slice(0, 68)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(sequenceThirtySeven.readers[index])
          ? []
          : [index],
      ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    sequenceThirtyEight.readers.slice(0, 50),
    sequenceThirtySeven.readers.slice(0, 50),
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => {
      const { bytes, sha256 } = sequenceThirtyEight.readers[index];
      return [bytes, sha256];
    }),
    [
      [141098, "9ed24466463ad57c0449627d64d30a768e8ac43419e34848e85e4e2b5083046e"],
      [49634, "78d0b0a6927dfc3752a6ff03fb3d96b36c321732078130c03672b0cfaa831bf8"],
      [92146, "1fa4386b58b7e660f34ea50feb410624c1ab2a5645dd2e13c2555772d8dea8a1"],
      [26333, "1c69c59a5adb8528129ca3f610da68d80186345c7920756883bd66aefd3f7498"],
      [97221, "707df8e85d5242895554474f3f7a7b2016bb55e8e8af40f36c27e1888d08c7d0"],
      [22545, "3a29dd0dd9346c0aa9ac8c3d654f54fdda8b91774cad6c12f1a37cc9464fc1ae"],
      [103228, "fd81bde3ca258646ba58683d728846c5d7ece2b1a84fd3d2f8b8e075be264026"],
      [26377, "614bee826366aee846bb3961257b21b1bc98d7acbd8206d70ee5f8bfe0c1359c"],
      [104771, "81d6c1de23b48ddf7d54e4ee423195703ede8a465a2afda53097dc3eef62336c"],
      [30264, "920184769a5ccb26b6711f34639b4f73ddebfe9466d340909aff03940ca3e6cc"],
      [104309, "5383908c77c55d424004bc8c81d3f4f7a7968dd99658ea7c22edf55673b19996"],
      [29745, "940f12c13dc8e6e6526e00ca0de87d49527a1500e887dc9391a005e1bebbf757"],
      [141122, "15b9b2dda874c25ff0a6dee65660089179058a33418ed740c3f16a72ff185499"],
      [25312, "2fb1e3a135b6a871d355b96debb15edb6bb0824d8947bc59c41ac9a48d3e24fe"],
      [70831, "cacc5ead190b38e7eed3574f417a4d0fcf9365b35c6c761d017d91d5502250fc"],
      [17544, "c477c37659b4cd699227a962976e28e849f95d856b07c4dbcb0c156ca94f1f7d"],
      [68105, "2dd5cf841567ca4e67e8a03e4f04e6fe211a5be3638ceb32e7425455d4640061"],
      [13071, "73092914189ff9098d967f8ddef226292deb9ec36fbf471ce638077efa6a87ab"],
    ],
  );
  assert.deepEqual(sequenceThirtyEight.artifacts[34], {
    task: "M08-T10",
    path: "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json",
    bytes: 325549,
    sha256: "5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b",
  });
  assert.deepEqual(sequenceThirtyEight.readers.slice(68), [
    {
      task: "M08-T10",
      role: "proof-library",
      path: "scripts/lib/editor-core-terminal-integration-proof.mjs",
      bytes: 84005,
      sha256: "46354aae84ddf65314ad3cd8cfbefc33245e4de495ecda577ca296185f749ca2",
    },
    {
      task: "M08-T10",
      role: "root-test",
      path: "tests/editor-core-terminal-integration.test.mjs",
      bytes: 13088,
      sha256: "f1cd04fbccbba01469bfbacad3154c2ba99e130745dbbd1bcf0397230982dff9",
    },
  ]);
});

test("sequence thirty-nine advances only the corrected T09 and T10 current readers", () => {
  const sequenceThirtyEight = baselineManifest.checkpoints[37];
  const sequenceThirtyNine = baselineManifest.checkpoints[38];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [66, 67, 68, 69];

  assert.equal(
    sequenceThirtyNine.predecessorSha256,
    "64f7d6519589a5a8cb564af1215c2a12c44297f8ea855910613ea3b361cee6d0",
  );
  assert.deepEqual(sequenceThirtyNine.artifacts, sequenceThirtyEight.artifacts);
  assert.deepEqual(
    sequenceThirtyNine.readers.map(identity),
    sequenceThirtyEight.readers.map(identity),
  );
  assert.deepEqual(
    sequenceThirtyNine.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceThirtyEight.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    sequenceThirtyNine.readers.slice(0, 66),
    sequenceThirtyEight.readers.slice(0, 66),
  );
  assert.deepEqual(sequenceThirtyNine.readers.slice(66), [
    {
      task: "M08-T09",
      role: "proof-library",
      path: "scripts/lib/editor-core-continuous-validation-proof.mjs",
      bytes: 71087,
      sha256: "df665c264cea2c33a937c0fc74b6250ede8acae2032b75f2f24c1f8dc69affdb",
    },
    {
      task: "M08-T09",
      role: "root-test",
      path: "tests/editor-core-continuous-validation.test.mjs",
      bytes: 15066,
      sha256: "574467231c3dbf4fd60b350da7f39c008d39072d935f461c50e059c609cc4d2a",
    },
    {
      task: "M08-T10",
      role: "proof-library",
      path: "scripts/lib/editor-core-terminal-integration-proof.mjs",
      bytes: 90708,
      sha256: "53942712a9a1c40a1076b46912d13feb247eda59405790f4f211c495c44e895c",
    },
    {
      task: "M08-T10",
      role: "root-test",
      path: "tests/editor-core-terminal-integration.test.mjs",
      bytes: 14830,
      sha256: "9cc2fb35ddb5d4b15371f8edcba07837e02a605169a609ef5eeb5da7e3ef0431",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceThirtyNine),
    "6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7",
  );
});

test("sequence forty preserves frozen receipts, reseals live editor readers, and appends M09-T01", () => {
  const sequenceThirtyNine = baselineManifest.checkpoints[38];
  const sequenceForty = baselineManifest.checkpoints[39];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(
    sequenceForty.predecessorSha256,
    "6a186ee56e9a3c8ffd176b712d54a56e7ca3e73990f46d0fe387c9f52bddf6f7",
  );
  assert.deepEqual(
    sequenceForty.artifacts.slice(0, sequenceThirtyNine.artifacts.length),
    sequenceThirtyNine.artifacts,
  );
  assert.deepEqual(sequenceForty.artifacts[35], {
    task: "M09-T01",
    path: "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json",
    bytes: 12118,
    sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
  });
  assert.deepEqual(
    sequenceForty.readers.slice(0, sequenceThirtyNine.readers.length).map(identity),
    sequenceThirtyNine.readers.map(identity),
  );
  assert.deepEqual(
    sequenceForty.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceThirtyNine.readers[index]) ? [] : [index],
    ),
    [66, 67, 68, 69, 70, 71],
  );
  assert.deepEqual(sequenceForty.readers.slice(0, 66), sequenceThirtyNine.readers.slice(0, 66));
  assert.deepEqual(sequenceForty.readers.slice(66), [
    {
      task: "M08-T09",
      role: "proof-library",
      path: "scripts/lib/editor-core-continuous-validation-proof.mjs",
      bytes: 71199,
      sha256: "dc53c7888b8debd893e415587f16c6f5888b6a5eefbdfd9788c66db1a3352ae7",
    },
    {
      task: "M08-T09",
      role: "root-test",
      path: "tests/editor-core-continuous-validation.test.mjs",
      bytes: 15083,
      sha256: "8f4c0c26699e588b0908c3e0255840d7f827cb2e61f6438d35fe76fc959bd7aa",
    },
    {
      task: "M08-T10",
      role: "proof-library",
      path: "scripts/lib/editor-core-terminal-integration-proof.mjs",
      bytes: 90824,
      sha256: "f451ee7337caf6c9974e78d5c9947f052c9eb39a0c853d3015e25bad39c675e4",
    },
    {
      task: "M08-T10",
      role: "root-test",
      path: "tests/editor-core-terminal-integration.test.mjs",
      bytes: 14852,
      sha256: "bf65bd2c607d43e6ae1466accf85fba7e54b518e70eb190cc476496ede1f8a44",
    },
    {
      task: "M09-T01",
      role: "proof-library",
      path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
      bytes: 30756,
      sha256: "6465e17ba687b9e4d7873ed5309aebb56a0b989cb719d984a9594a3707ff6a98",
    },
    {
      task: "M09-T01",
      role: "root-test",
      path: "tests/desen-app-shell-navigation.test.mjs",
      bytes: 15467,
      sha256: "f4f3e120889379da8adb81d7b698ff2c4415e57fdfc06a729c79eb40a47b893a",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceForty),
    "e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e",
  );
});

test("sequence forty-one preserves frozen receipts, reseals M09-T01, and appends M09-T02", () => {
  const sequenceForty = baselineManifest.checkpoints[39];
  const sequenceFortyOne = baselineManifest.checkpoints[40];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(
    sequenceFortyOne.predecessorSha256,
    "e19eabc91c56c015b7fec7469d096b09a4bf42f5b6edc907c0207dd8c94feb0e",
  );
  assert.deepEqual(
    sequenceFortyOne.artifacts.slice(0, sequenceForty.artifacts.length),
    sequenceForty.artifacts,
  );
  assert.deepEqual(sequenceFortyOne.artifacts[36], {
    task: "M09-T02",
    path: "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json",
    bytes: 25375,
    sha256: "85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61",
  });
  assert.deepEqual(
    sequenceFortyOne.readers.slice(0, sequenceForty.readers.length).map(identity),
    sequenceForty.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortyOne.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceForty.readers[index]) ? [] : [index],
    ),
    [70, 71, 72, 73],
  );
  assert.deepEqual(sequenceFortyOne.readers.slice(0, 70), sequenceForty.readers.slice(0, 70));
  assert.deepEqual(sequenceFortyOne.readers.slice(70), [
    {
      task: "M09-T01",
      role: "proof-library",
      path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
      bytes: 36405,
      sha256: "5b1f041e9325cd3908bbb5c3fffab22ad0858f8b11a255ba7273973afd70aff5",
    },
    {
      task: "M09-T01",
      role: "root-test",
      path: "tests/desen-app-shell-navigation.test.mjs",
      bytes: 16516,
      sha256: "d2d50275d295e30f0083b1362432dc8cb014b8ebfe369bad08ef7cdbe03668f1",
    },
    {
      task: "M09-T02",
      role: "proof-library",
      path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
      bytes: 50635,
      sha256: "fb4bab225f2d05bea7282d19daf99d4389e64fcf23a7c6091e87057ca2be63bb",
    },
    {
      task: "M09-T02",
      role: "root-test",
      path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
      bytes: 15618,
      sha256: "f9fbfad0fd05043080c2cf73c272f0dda41f5744a092f0a4a507531dcb79594e",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortyOne),
    "b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68",
  );
});

test("sequence forty-two preserves sequences one through forty-one, reseals exact compatibility readers, and appends M09-T03", () => {
  const sequenceFortyOne = baselineManifest.checkpoints[40];
  const sequenceFortyTwo = baselineManifest.checkpoints[41];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [20, 21, 70, 71, 72, 73, 74, 75];

  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(baselineManifest.checkpoints.slice(0, 41)), "utf8")
      .digest("hex"),
    "7eb170f924ef9d23be9b3479e6a56d003095bf216dae0d1e580323f2dc2f9158",
  );
  assert.equal(
    sequenceFortyTwo.predecessorSha256,
    "b36679b7ea3ffd0e019d3051b30312dd96b050e10ae7d5d44cf39eb9d30eeb68",
  );
  assert.deepEqual(
    sequenceFortyTwo.artifacts.slice(0, sequenceFortyOne.artifacts.length),
    sequenceFortyOne.artifacts,
  );
  assert.deepEqual(sequenceFortyTwo.artifacts[37], {
    task: "M09-T03",
    path: "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json",
    bytes: 73111,
    sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
  });
  assert.deepEqual(
    sequenceFortyTwo.readers.slice(0, sequenceFortyOne.readers.length).map(identity),
    sequenceFortyOne.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortyTwo.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFortyOne.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  for (let index = 0; index < sequenceFortyOne.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceFortyTwo.readers[index], sequenceFortyOne.readers[index]);
    }
  }
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFortyTwo.readers[index]),
    [
      {
        task: "M05-T04",
        role: "proof-library",
        path: "scripts/lib/runtime-react-interactions-proof.mjs",
        bytes: 42177,
        sha256: "1eb04ac69a9d910a30574523d59cc0124d2559d65b2dc9fd8442b56cd970484b",
      },
      {
        task: "M05-T04",
        role: "root-test",
        path: "tests/runtime-react-interactions.test.mjs",
        bytes: 20532,
        sha256: "7caf970857815ad181c23d76b8ca2d7470fd7d0b113d5b484902de3e33765c78",
      },
      {
        task: "M09-T01",
        role: "proof-library",
        path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
        bytes: 41170,
        sha256: "d12906aad5abfc124a5b3542ae711c82713028842fc2ab4a09587a22187ce1dc",
      },
      {
        task: "M09-T01",
        role: "root-test",
        path: "tests/desen-app-shell-navigation.test.mjs",
        bytes: 19390,
        sha256: "bb8d0f7e31cb3da207f29f1b109ac5ed3b087b4a8f05e41b5d1d33162a0e3b70",
      },
      {
        task: "M09-T02",
        role: "proof-library",
        path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
        bytes: 62764,
        sha256: "ad5b6b079d0c3ca82c3b685d6d55164600471f49389d2f77e469129215175049",
      },
      {
        task: "M09-T02",
        role: "root-test",
        path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
        bytes: 19733,
        sha256: "2bb7ec20f9b0f320d0709a9d643cf7eebf53a1ca57f34c3fea0ec318f218d839",
      },
      {
        task: "M09-T03",
        role: "proof-library",
        path: "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
        bytes: 73183,
        sha256: "e6ff92ffd774edab9cd38a852be67145fa048df79dcf38ff8740d94b522b1f18",
      },
      {
        task: "M09-T03",
        role: "root-test",
        path: "tests/desen-app-real-adapter-canvas.test.mjs",
        bytes: 22347,
        sha256: "03a61e2e2ab976f090e258210ac3851d06c8a0b067d46ebb109426b21aa66946",
      },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortyTwo),
    "40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5",
  );
});

test("sequence forty-three preserves prior history, reseals App compatibility readers, and appends M09-T04", () => {
  const sequenceFortyTwo = baselineManifest.checkpoints[41];
  const sequenceFortyThree = baselineManifest.checkpoints[42];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [70, 71, 72, 73, 74, 75, 76, 77];

  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(baselineManifest.checkpoints.slice(0, 42)), "utf8")
      .digest("hex"),
    "2e0afd12ba1bb0f459c29747cb2b7a0d95c40fd280b58515a9f378809047a3ab",
  );
  assert.equal(
    sequenceFortyThree.predecessorSha256,
    "40d7c380cec3a7efd04316959a41abda3c8f71c1604f7f2fb892f18ae4cd2fa5",
  );
  assert.deepEqual(
    sequenceFortyThree.artifacts.slice(0, sequenceFortyTwo.artifacts.length),
    sequenceFortyTwo.artifacts,
  );
  assert.deepEqual(sequenceFortyThree.artifacts[38], {
    task: "M09-T04",
    path: "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json",
    bytes: 11997,
    sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
  });
  assert.deepEqual(
    sequenceFortyThree.readers.slice(0, sequenceFortyTwo.readers.length).map(identity),
    sequenceFortyTwo.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortyThree.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFortyTwo.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  for (let index = 0; index < sequenceFortyTwo.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceFortyThree.readers[index], sequenceFortyTwo.readers[index]);
    }
  }
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFortyThree.readers[index]),
    [
      {
        task: "M09-T01",
        role: "proof-library",
        path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
        bytes: 43494,
        sha256: "0ec889d8a2ff88922d4a4bbb7530f2df633b975ae7eaf3e0c811bb292fbf6f45",
      },
      {
        task: "M09-T01",
        role: "root-test",
        path: "tests/desen-app-shell-navigation.test.mjs",
        bytes: 20527,
        sha256: "ec78aa7bd60f9c2faa8523be30f3845ee18ee08fb358b8099f8b35ba413d022e",
      },
      {
        task: "M09-T02",
        role: "proof-library",
        path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
        bytes: 68752,
        sha256: "60fd95401d8e170132d5e840a436da47af8ad91ff155cd6fc62f3831e8e7ad06",
      },
      {
        task: "M09-T02",
        role: "root-test",
        path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
        bytes: 21318,
        sha256: "d26d32d77a643ba657db0bd0a3d011fb68b42aaef3d97888a6e3657690c4f50c",
      },
      {
        task: "M09-T03",
        role: "proof-library",
        path: "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
        bytes: 89209,
        sha256: "8f310f4c68191dbc7a7bd69eaca1009da6da4b73519d95816cd7e16047076a19",
      },
      {
        task: "M09-T03",
        role: "root-test",
        path: "tests/desen-app-real-adapter-canvas.test.mjs",
        bytes: 24997,
        sha256: "9a04322b71c31f08061a8798516ae18e22bbbd4a26907b7a610b651c902eca03",
      },
      {
        task: "M09-T04",
        role: "proof-library",
        path: "scripts/lib/desen-app-selection-overlay-proof.mjs",
        bytes: 42521,
        sha256: "cfa1c0b4d04b7d15ca746fd7b46b1d947a08b48dee5b7637ca4e99fcd3ab1d37",
      },
      {
        task: "M09-T04",
        role: "root-test",
        path: "tests/desen-app-selection-overlay.test.mjs",
        bytes: 10506,
        sha256: "ce59437c2dcfbfb58bf3b6c641ed08021d77bde024371784eeb17cd57af6e9b2",
      },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortyThree),
    "0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58",
  );
});

test("sequence forty-four preserves its reviewed prefix, reseals App readers, and appends M09-T05", () => {
  const sequenceFortyThree = baselineManifest.checkpoints[42];
  const sequenceFortyFour = baselineManifest.checkpoints[43];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79];

  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(baselineManifest.checkpoints.slice(0, 43)), "utf8")
      .digest("hex"),
    "0530aeaedfb7257956ab3237f13963c45c53fcb5f35d6b8d5e4bb8135599ec2d",
  );
  assert.equal(
    sequenceFortyFour.predecessorSha256,
    "0bbb101332d7af5dcf7260b6df6961837003571f67a6e3a69232e65e19cded58",
  );
  assert.deepEqual(
    sequenceFortyFour.artifacts.slice(0, sequenceFortyThree.artifacts.length),
    sequenceFortyThree.artifacts,
  );
  assert.deepEqual(sequenceFortyFour.artifacts[39], {
    task: "M09-T05",
    path: "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json",
    bytes: 22998,
    sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
  });
  assert.deepEqual(
    sequenceFortyFour.readers.slice(0, sequenceFortyThree.readers.length).map(identity),
    sequenceFortyThree.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortyFour.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFortyThree.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  for (let index = 0; index < sequenceFortyThree.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceFortyFour.readers[index], sequenceFortyThree.readers[index]);
    }
  }
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFortyFour.readers[index]),
    [
      {
        task: "M09-T01",
        role: "proof-library",
        path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
        bytes: 44679,
        sha256: "b78929640c67b578236b8fea8bcaaf9b2869a90b6c7e635a239beebb35c9e116",
      },
      {
        task: "M09-T01",
        role: "root-test",
        path: "tests/desen-app-shell-navigation.test.mjs",
        bytes: 21288,
        sha256: "619a68586f1345da124f55cdff627cb3351eaeccfcd63bf410b681b89e95084c",
      },
      {
        task: "M09-T02",
        role: "proof-library",
        path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
        bytes: 72921,
        sha256: "1147707557d9bab77b2c55c207a9d4cab8ce5de7fd77260370bd5778b4ce61d2",
      },
      {
        task: "M09-T02",
        role: "root-test",
        path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
        bytes: 21970,
        sha256: "b7c02644ce5c8943ff0f0391c978eabb9cdf2dda318a5ee6e730fccbe71e69e8",
      },
      {
        task: "M09-T03",
        role: "proof-library",
        path: "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
        bytes: 91910,
        sha256: "cafd3e6b35b5a2222f069a5f04d97d4ea756ac20c7bcb221a915c21ca97cc424",
      },
      {
        task: "M09-T03",
        role: "root-test",
        path: "tests/desen-app-real-adapter-canvas.test.mjs",
        bytes: 25414,
        sha256: "edfd59654a8ccd5ca6141557506635f99e15b5c0192d3aa4dc63beebe447248c",
      },
      {
        task: "M09-T04",
        role: "proof-library",
        path: "scripts/lib/desen-app-selection-overlay-proof.mjs",
        bytes: 51058,
        sha256: "8868da3264d17ddb90507caea6dfa8bbdcbdc13736ec18b1ccd8986be62a7194",
      },
      {
        task: "M09-T04",
        role: "root-test",
        path: "tests/desen-app-selection-overlay.test.mjs",
        bytes: 13173,
        sha256: "6014fea1416bd398d4a5913b3c2cca2821d357d0e93ce68e2390dc93449ae19c",
      },
      {
        task: "M09-T05",
        role: "proof-library",
        path: "scripts/lib/desen-app-schema-inspector-proof.mjs",
        bytes: 51508,
        sha256: "e675dac3face232a48dd2fc0cbe64a47c2453bd51e3ca7269a9ec3379f3d421b",
      },
      {
        task: "M09-T05",
        role: "root-test",
        path: "tests/desen-app-schema-inspector.test.mjs",
        bytes: 13578,
        sha256: "193ce0247f3c9f14fe612643a351e4ef4fff906d059d981cec62c83828b95ca2",
      },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortyFour),
    "f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c",
  );
});

test("sequence forty-five preserves its reviewed prefix, reseals App readers, and appends M09-T06", () => {
  const sequenceFortyFour = baselineManifest.checkpoints[43];
  const sequenceFortyFive = baselineManifest.checkpoints[44];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81];

  assert.equal(
    createHash("sha256")
      .update(JSON.stringify(baselineManifest.checkpoints.slice(0, 44)), "utf8")
      .digest("hex"),
    "ab78c11ade3b15a3a21a2c65bff3cb21aa8b681ec47586084799831ecf343b8f",
  );
  assert.equal(
    sequenceFortyFive.predecessorSha256,
    "f0c5f3bfbc30ccf230c5256b3a5672c29ffa0e884129ae210571895bd063812c",
  );
  assert.deepEqual(
    sequenceFortyFive.artifacts.slice(0, sequenceFortyFour.artifacts.length),
    sequenceFortyFour.artifacts,
  );
  assert.deepEqual(sequenceFortyFive.artifacts[40], {
    task: "M09-T06",
    path: "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json",
    bytes: 26133,
    sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
  });
  assert.deepEqual(
    sequenceFortyFive.readers.slice(0, sequenceFortyFour.readers.length).map(identity),
    sequenceFortyFour.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortyFive.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFortyFour.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  for (let index = 0; index < sequenceFortyFour.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceFortyFive.readers[index], sequenceFortyFour.readers[index]);
    }
  }
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFortyFive.readers[index]),
    [
      {
        task: "M09-T01",
        role: "proof-library",
        path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
        bytes: 45111,
        sha256: "8ec31bf48dc4ca8d8509b930fbf99238d3560f9b03e2ef940696641362cbe997",
      },
      {
        task: "M09-T01",
        role: "root-test",
        path: "tests/desen-app-shell-navigation.test.mjs",
        bytes: 21641,
        sha256: "dc84c5af2deacdd58a30859cd6b8ea51495470c7cca30167e251b86c65d7fee3",
      },
      {
        task: "M09-T02",
        role: "proof-library",
        path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
        bytes: 74540,
        sha256: "89cd53ef9d49099b778cf158cab40bc3c17c1db69eab77b77d72024b4735562e",
      },
      {
        task: "M09-T02",
        role: "root-test",
        path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
        bytes: 22158,
        sha256: "00a129fad8ddc2e228109b89994a6bef853588d1587a54fbc16f7f02834ac585",
      },
      {
        task: "M09-T03",
        role: "proof-library",
        path: "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
        bytes: 92810,
        sha256: "1cc4d783f788e4c2f18e2ab64c3fc3cf736e30d72820e41d1fb489c9821a192b",
      },
      {
        task: "M09-T03",
        role: "root-test",
        path: "tests/desen-app-real-adapter-canvas.test.mjs",
        bytes: 25522,
        sha256: "90b29b58db660c3205f9b6601d2dd76cd1026c7af650090f2b1ff2288c0d1881",
      },
      {
        task: "M09-T04",
        role: "proof-library",
        path: "scripts/lib/desen-app-selection-overlay-proof.mjs",
        bytes: 52668,
        sha256: "875c75508cf8dd8e1a6a9473fc608ec1721eb1efd9f208b33d2d207ede6bc784",
      },
      {
        task: "M09-T04",
        role: "root-test",
        path: "tests/desen-app-selection-overlay.test.mjs",
        bytes: 13557,
        sha256: "25483d46715e046c2d372e0c41fc13371adc51c7328f8ecaec041650089c9480",
      },
      {
        task: "M09-T05",
        role: "proof-library",
        path: "scripts/lib/desen-app-schema-inspector-proof.mjs",
        bytes: 58844,
        sha256: "692836c1071f2bad3cd0643a5128d506c3624c157ba1e900651f088c5d82134e",
      },
      {
        task: "M09-T05",
        role: "root-test",
        path: "tests/desen-app-schema-inspector.test.mjs",
        bytes: 12211,
        sha256: "ab463bfa87de2c82a43185a94ca2f728056eb19c33ca8c0bc7eadf3277ec9554",
      },
      {
        task: "M09-T06",
        role: "proof-library",
        path: "scripts/lib/desen-app-structured-inspector-proof.mjs",
        bytes: 59817,
        sha256: "9075433fd20436f6ae79075470722fe8e23ee65fe82f2347ac151ef25667d729",
      },
      {
        task: "M09-T06",
        role: "root-test",
        path: "tests/desen-app-structured-inspector.test.mjs",
        bytes: 23934,
        sha256: "835162247f14fe5183a31ec9c806cd23f0c3dfeb43515afe622b539637c9970e",
      },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortyFive),
    "340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f",
  );
});

test("sequence forty-six preserves its reviewed prefix, reseals App readers, and appends M09-T07", () => {
  const sequenceFortyFive = baselineManifest.checkpoints[44];
  const sequenceFortySix = baselineManifest.checkpoints[45];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83];

  assert.equal(
    sequenceFortySix.predecessorSha256,
    "340460237dd173995d4d0fa158f0e4c6c54b76d55958757d742a981466fd213f",
  );
  assert.deepEqual(
    sequenceFortySix.artifacts.slice(0, sequenceFortyFive.artifacts.length),
    sequenceFortyFive.artifacts,
  );
  assert.deepEqual(sequenceFortySix.artifacts[41], {
    task: "M09-T07",
    path: "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json",
    bytes: 24830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
  });
  assert.deepEqual(
    sequenceFortySix.readers.slice(0, sequenceFortyFive.readers.length).map(identity),
    sequenceFortyFive.readers.map(identity),
  );
  assert.deepEqual(
    sequenceFortySix.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceFortyFive.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  for (let index = 0; index < sequenceFortyFive.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceFortySix.readers[index], sequenceFortyFive.readers[index]);
    }
  }
  assert.deepEqual(
    changedReaderIndexes.map((index) => sequenceFortySix.readers[index]),
    [
      {
        task: "M09-T01",
        role: "proof-library",
        path: "scripts/lib/desen-app-shell-navigation-proof.mjs",
        bytes: 50569,
        sha256: "cae05955d6cf5ea2efe0af8fc8fd033240f1fa055458960ca013fe48158f9e3d",
      },
      {
        task: "M09-T01",
        role: "root-test",
        path: "tests/desen-app-shell-navigation.test.mjs",
        bytes: 25450,
        sha256: "e0e6609c51e4c9c01a6b83472723bbf0e2204865d2800c8cb22cdd26fcff4929",
      },
      {
        task: "M09-T02",
        role: "proof-library",
        path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
        bytes: 82011,
        sha256: "ac1ea5a11b5f017291d0189fc68f6f6630b30995f4f9d27e5b3138c732bf240e",
      },
      {
        task: "M09-T02",
        role: "root-test",
        path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
        bytes: 25749,
        sha256: "0e696a833e108c8a8f5564ee0e078eb2e80bf345df688669acd7d414b9d2d1dd",
      },
      {
        task: "M09-T03",
        role: "proof-library",
        path: "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
        bytes: 104177,
        sha256: "98bb1b054a038c5717d6a974d1011396b0958c13a37a7c0a7ee9c42160fdc9f6",
      },
      {
        task: "M09-T03",
        role: "root-test",
        path: "tests/desen-app-real-adapter-canvas.test.mjs",
        bytes: 28446,
        sha256: "ce323171b356f95d17b63dc2fae8287c10b097dd5ba6c02318d70845c6d0d257",
      },
      {
        task: "M09-T04",
        role: "proof-library",
        path: "scripts/lib/desen-app-selection-overlay-proof.mjs",
        bytes: 65014,
        sha256: "3565f9d1d07b56605019f7933d99f2962bbafcce23709f178fc3f3948f8eb44e",
      },
      {
        task: "M09-T04",
        role: "root-test",
        path: "tests/desen-app-selection-overlay.test.mjs",
        bytes: 19832,
        sha256: "b289c05af49ca30a34285f4def2209008f15ba1466cb845263265ac1b9c95c2c",
      },
      {
        task: "M09-T05",
        role: "proof-library",
        path: "scripts/lib/desen-app-schema-inspector-proof.mjs",
        bytes: 67486,
        sha256: "35d4e4457f30d70d95a9f0ae4cb2a7ed564d4ee13b29af24e928ec531de8cf4b",
      },
      {
        task: "M09-T05",
        role: "root-test",
        path: "tests/desen-app-schema-inspector.test.mjs",
        bytes: 16798,
        sha256: "2bca6aa98eeb53ca63c1f9a6e25770dc6078d5d839eb6034f40ec706ab15556f",
      },
      {
        task: "M09-T06",
        role: "proof-library",
        path: "scripts/lib/desen-app-structured-inspector-proof.mjs",
        bytes: 76947,
        sha256: "75a943c4020d9a6de12dfcdefbea2500b4a029acf27396c02ececa16a22352a9",
      },
      {
        task: "M09-T06",
        role: "root-test",
        path: "tests/desen-app-structured-inspector.test.mjs",
        bytes: 28879,
        sha256: "4ccabc86a8c920f1ec5c629c7923660938aa79dd7761aadc404fb344630d1901",
      },
      {
        task: "M09-T07",
        role: "proof-library",
        path: "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
        bytes: 53049,
        sha256: "e4339ce6ae42a5247e79d1c5442801f4ce03878c22952aed97d73950c843fe78",
      },
      {
        task: "M09-T07",
        role: "root-test",
        path: "tests/desen-app-named-slot-authoring.test.mjs",
        bytes: 20597,
        sha256: "8fd06599c09dc15522857bbd27f2d4b368fc625296f28cbe428cbf5753ce07fb",
      },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceFortySix),
    "f09ec643d1b2756174ca47fae99837a68f6656bec0c6933e566d5075713a0f5f",
  );
});

test("sequence forty-seven preserves history, reseals the App chain, and appends M09-T08", () => {
  const previous = baselineManifest.checkpoints[45];
  const current = baselineManifest.checkpoints[46];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[45]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T08",
    path: "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json",
    bytes: 28766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85],
  );
  assert.deepEqual(current.readers.slice(-2).map(identity), [
    {
      task: "M09-T08",
      role: "proof-library",
      path: "scripts/lib/desen-app-state-binding-editor-proof.mjs",
    },
    {
      task: "M09-T08",
      role: "root-test",
      path: "tests/desen-app-state-binding-editor.test.mjs",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "c28ba9a9f274ac0bc3f7dc7ed6de51df35128b109b374b563f5c0239891f58f7",
  );
});

test("sequence forty-eight preserves history, reseals predecessor readers, and appends M09-T09", () => {
  const previous = baselineManifest.checkpoints[46];
  const current = baselineManifest.checkpoints[47];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[46]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T09",
    path: "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json",
    bytes: 23812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [70, 71, 72, 73, 74, 75, 78, 79, 80, 81, 82, 84, 85, 86, 87],
  );
  assert.deepEqual(current.readers.slice(-2).map(identity), [
    {
      task: "M09-T09",
      role: "proof-library",
      path: "scripts/lib/desen-app-event-action-editor-proof.mjs",
    },
    {
      task: "M09-T09",
      role: "root-test",
      path: "tests/desen-app-event-action-editor.test.mjs",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "5ecf9e630e2c91cb97a7c85c60e8318fdf694039711a64bf1797e481aca0ff90",
  );
});

test("sequence forty-nine preserves history, reseals App readers, and appends M09-T10", () => {
  const previous = baselineManifest.checkpoints[47];
  const current = baselineManifest.checkpoints[48];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[47]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T10",
    path: "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json",
    bytes: 17900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [72, 73, 74, 75, 76, 77, 78, 80, 82, 84, 86, 87, 88, 89],
  );
  assert.deepEqual(current.readers.slice(72, 74), [
    {
      task: "M09-T02",
      role: "proof-library",
      path: "scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs",
      bytes: 84880,
      sha256: "d1074f44bba9fca7ef87bb797b72dd0857081215454c710cc32c356e5310a115",
    },
    {
      task: "M09-T02",
      role: "root-test",
      path: "tests/desen-app-catalog-panel-layer-tree.test.mjs",
      bytes: 26481,
      sha256: "df0b4fe2e192551e74e0fd39da735c55f3e834e1cc6c12cc65f0bcf2848ec313",
    },
  ]);
  assert.deepEqual(current.readers.slice(-2).map(identity), [
    {
      task: "M09-T10",
      role: "proof-library",
      path: "scripts/lib/desen-app-design-run-modes-proof.mjs",
    },
    {
      task: "M09-T10",
      role: "root-test",
      path: "tests/desen-app-design-run-modes.test.mjs",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "45ed64e604400f18b15b3b4ef44bc35634a6c1567b46174329ec36529168272e",
  );
});

test("sequence fifty preserves sequence forty-nine, reseals every App reader, and appends M09-T11", () => {
  const previous = baselineManifest.checkpoints[48];
  const current = baselineManifest.checkpoints[49];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 50);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[48]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T11",
    path: "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json",
    bytes: 29407,
    sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91],
  );
  assert.deepEqual(current.readers.slice(-2), [
    {
      task: "M09-T11",
      role: "proof-library",
      path: "scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs",
      bytes: 63501,
      sha256: "aa61c89861da2793c5dc7762198be37a9941de34031fb0c9ae8b8c314476d28b",
    },
    {
      task: "M09-T11",
      role: "root-test",
      path: "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
      bytes: 19281,
      sha256: "1255d3db1a7a44bebf04d4f1f4919105e376ed342d1df6b5118d84a2c2ace91d",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "6abea41064a05efe363df0f66d1e7d1b4923af08f819acf4c266b092985192a4",
  );
});

test("sequence fifty-one preserves sequence fifty, reseals the App chain, and appends M09-T12", () => {
  const previous = baselineManifest.checkpoints[49];
  const current = baselineManifest.checkpoints[50];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 51);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[49]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T12",
    path: "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json",
    bytes: 27053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93,
    ],
  );
  assert.deepEqual(current.readers.slice(0, 70), previous.readers.slice(0, 70));
  assert.deepEqual(current.readers.slice(-2), [
    {
      task: "M09-T12",
      role: "proof-library",
      path: "scripts/lib/desen-app-source-persistence-proof.mjs",
      bytes: 56014,
      sha256: "18c759c87011e4ed30b044eaa02b9ccf2cc9e4134c33f7cfd0f292070ffc5add",
    },
    {
      task: "M09-T12",
      role: "root-test",
      path: "tests/desen-app-source-persistence.test.mjs",
      bytes: 23578,
      sha256: "baee083f499523e8d5ea47b322f2d1c162097c27b95897946e72dcb25e99f033",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "42e88946b598566a46237af8d30587fa765d9d58807e864464fc5525fbc64921",
  );
});

test("sequence fifty-two preserves sequence fifty-one, reseals the App chain, and appends M09-T13", async () => {
  const previous = baselineManifest.checkpoints[50];
  const current = baselineManifest.checkpoints[51];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 52);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[50]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T13",
    path: "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json",
    bytes: 29208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95,
    ],
  );
  assert.deepEqual(current.readers.slice(0, 70), previous.readers.slice(0, 70));
  assert.deepEqual(current.readers.slice(-2), [
    {
      task: "M09-T13",
      role: "proof-library",
      path: "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
      bytes: 56429,
      sha256: "4f98c727c5b5f49c95ab0b3c4b9a1a70afe01f3d834d07be9e4a1949c5a80b6f",
    },
    {
      task: "M09-T13",
      role: "root-test",
      path: "tests/desen-app-node-linked-diagnostics.test.mjs",
      bytes: 17783,
      sha256: "dd524e430ce145ec1ce42220b977f8c60cde176d22c2bc995cfc25fdd92753ec",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "c42b0c0fe010b04128a31f26b25a5875e72b7566fa64403d0223b4dbada478a9",
  );
});

test("sequence fifty-three preserves sequence fifty-two, reseals the App chain, and appends M09-T14", async () => {
  const previous = baselineManifest.checkpoints[51];
  const current = baselineManifest.checkpoints[52];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 53);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[51]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M09-T14",
    path: "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json",
    bytes: 24763,
    sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers
      .slice(0, previous.readers.length)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95,
    ],
  );
  assert.deepEqual(current.readers.slice(0, 70), previous.readers.slice(0, 70));
  assert.deepEqual(current.readers.slice(96), [
    {
      task: "M09-T14",
      role: "proof-library",
      path: "scripts/lib/desen-app-publish-activation-proof.mjs",
      bytes: 49397,
      sha256: "f6c8430faaa4ca7a5af2f935a106cf59b55a0065afe46a2f948f510931cd88ac",
    },
    {
      task: "M09-T14",
      role: "root-test",
      path: "tests/desen-app-publish-activation.test.mjs",
      bytes: 13038,
      sha256: "add104d6c3fd28a982d8f1762680c3b22e0987f9fbd19fa03896d4b593ee7c27",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "48a1457317c593b846cd4750eb309e846c33248824559d27810441584f0144d8",
  );
});

test("sequence fifty-four preserves sequence fifty-three and reseals only the M08-T08 readers", () => {
  const previous = baselineManifest.checkpoints[52];
  const current = baselineManifest.checkpoints[53];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 54);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[52]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [64, 65],
  );
  assert.deepEqual(current.readers.slice(64, 66), [
    {
      task: "M08-T08",
      role: "proof-library",
      path: "scripts/lib/editor-core-persistence-proof.mjs",
      bytes: 78526,
      sha256: "236867741922e60b25d7bb680b0d4ac07d602310b6ad7a00de741ec810b076a6",
    },
    {
      task: "M08-T08",
      role: "root-test",
      path: "tests/editor-core-persistence.test.mjs",
      bytes: 21719,
      sha256: "3a2a0e1a3aece594323f4ae0dab24a73f289ff546c6eb906f770ee8b945a72e6",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "0772221371ffe1a35fe955b8cad34c725d0f9ae933714f81f10b3451214a6638",
  );
});

test("sequence fifty-five preserves sequence fifty-four and reseals only the M09 readers", () => {
  const previous = baselineManifest.checkpoints[53];
  const current = baselineManifest.checkpoints[54];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const receipt = ({ bytes, sha256 }) => ({ bytes, sha256 });

  assert.equal(current.sequence, 55);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[53]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95, 96, 97,
    ],
  );
  assert.deepEqual(current.readers.slice(0, 70), previous.readers.slice(0, 70));
  assert.deepEqual(current.readers.slice(70).map(receipt), [
    { bytes: 83360, sha256: "56e320777ede51362b1c974337a30d50f5134c2dc84ac1a6350c4061cae02391" },
    { bytes: 39057, sha256: "45941252150c2a4a83c52e17b3894e19d565f91ae7fb0afe678ddb359804701f" },
    { bytes: 123492, sha256: "29e2fffeb53badea2adc2b426fc825745836feb588632436a615e2d89a3cb84a" },
    { bytes: 43083, sha256: "e01f30d44abfdbd5c6910b50eafdb07d73d9f17030a286473e212dfcdcfb4064" },
    { bytes: 152121, sha256: "389fe13cfa2236a498d337ee1a6773adc277c3a86587a36b350fe11ff97edf0c" },
    { bytes: 46755, sha256: "94eb044c925967dba2cfa40dd60eb2e7212c13fa23c3e6c5c30c567af8c1aa99" },
    { bytes: 107245, sha256: "55adf64cf6aff2e6bad6879ce58a5947494bc355af956bc327799b8bb91fa0c1" },
    { bytes: 40770, sha256: "7cb43748d1e685d7578998474f89f638dd0b40c9b7e594022b129cd5fc817e60" },
    { bytes: 112967, sha256: "395925b4a0d8ab77d11ee9a874612c68c45301167e7783986bdaa835a5ff8ebd" },
    { bytes: 39841, sha256: "2daa41a8f4961140a0fc0c3586d2143c3e8ab07a9ead3adbbffa386676adad08" },
    { bytes: 127077, sha256: "88e8c9f76699c6f945c736ce088e96e76b2a7305a1c6e399a627d603de32d0b0" },
    { bytes: 54253, sha256: "5468d56af1c269364d19aaf5e3026eaf297c45e744c4d279db49ed9ee4d60312" },
    { bytes: 101284, sha256: "fc1c91b4a065d19c858d8c3bc961b004a837a674dfcd4ac30cf597c4ea1f40be" },
    { bytes: 40899, sha256: "ac366fd36f0500b7d301618c1b0b8b344b8e197f590955225b65b60df67538e3" },
    { bytes: 92656, sha256: "96fbf9eaed407b98b142b77230d474fe77a08652e751e420938367f8da59f82c" },
    { bytes: 35490, sha256: "d97518d57b05fd4f3fd60e77ea0613b92cbae0e4baf5115f18d66b1ea1514973" },
    { bytes: 94402, sha256: "fa1bb567d223aa1a036d94ee21a544f7731ef28359030ca28de98dc352ba65f6" },
    { bytes: 35923, sha256: "ee4bb509d4e6de2d5113c3e891d4b920c215b28ffb54e23896a85cb50bac8e52" },
    { bytes: 92950, sha256: "cf223fbc1487dcf982293d6629dfd5dcb2c69193082aab749ad193d20dad77dd" },
    { bytes: 31067, sha256: "51167b5ff3b0b226e093354cf39287d2626efd321cdea63d6759106b5f34035f" },
    { bytes: 100250, sha256: "8830bee201ef54c3591c342ded1e75b667e8b563b86aa1d926e33603384897f1" },
    { bytes: 38532, sha256: "c125e414b14f7dd1c87ae043809072fd839050bd874cd32d1125e5f9c5a8b740" },
    { bytes: 77074, sha256: "f65fb79faf12a524dfa6edd88b56b7d2d39e08d1ee0b3a0866592905cde1223e" },
    { bytes: 30752, sha256: "492bcb844472d45a79bedc92d926a64b79f1aa8da784b395cd6d87695f133509" },
    { bytes: 71735, sha256: "d4026131e9a981eb1d5fd7257b854b88f3f85b32210fd5b7072e63a3cde7a6e8" },
    { bytes: 22048, sha256: "1c9144ce7db4b80c8d36f3f7a5007eee3d8342d3a17c88c5b2de0918514ae812" },
    { bytes: 56645, sha256: "2d00b026c18586cb6dce8e4f3e25a10a46183bb03943eb695eedbb9905c4b9a9" },
    { bytes: 15281, sha256: "a36422e4cb419e09e050aa18eede4dd6c8606d0e9d83afc875f00a0804ee229f" },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "f1ac24425ca2372410835a6c5721057763792010aaf77ccc78b8d30636333a17",
  );
});

test("sequence fifty-six preserves frozen authority and reseals only compatibility successors", () => {
  const previous = baselineManifest.checkpoints[54];
  const current = baselineManifest.checkpoints[55];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const receipt = ({ bytes, sha256 }) => ({ bytes, sha256 });
  const changedReaderIndexes = [
    0, 1, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 70, 71, 72, 73,
    74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 86, 88, 89, 90, 92, 94, 96,
  ];

  assert.equal(current.sequence, 56);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[54]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => receipt(current.readers[index])),
    [
      { bytes: 186159, sha256: "9dff5ff65524b29843610c9bc10efbda9c0cb94db1c03a3767e2da746252ab2c" },
      { bytes: 50013, sha256: "061404f11ad8fc9f0e49239713d3f0592e48edbbf72d4354df39e0b43259ea0b" },
      { bytes: 80739, sha256: "c19e0c0dceb89283d841574db6e28acd356854cc40486c10a27e3e5a08e4f729" },
      { bytes: 24620, sha256: "45b049fe9bb6380ca5e53638aad4ba2f42154faa6bdcde7897426c6d9cf6f12f" },
      { bytes: 90181, sha256: "7c7c626bba860d524bac72e0fc7cfa3fedddbea8a42c9594a2f019265512260c" },
      { bytes: 26410, sha256: "85cd0f9a17787b674b21a8e1be3bc016758e54d37598e5d9b71b17b73b6d939c" },
      { bytes: 88986, sha256: "77fcf4f6e366dd8e2b92f05cd9192304fabdf163c99d21e8c91c3201d8c226ff" },
      { bytes: 25567, sha256: "2b2c18b43b78eaa3fd636737667c86126cc54bbfabe9d7d8b4ce2f85c29a7d00" },
      { bytes: 67012, sha256: "fa2fb2616233b8447b9a93c80c916f9fa6e6c19e9df7da5a099852905627f6ba" },
      { bytes: 18066, sha256: "9136dbe11747678bbda40ae63768f20daa7005f7db83f17fce03d40a3cef840b" },
      { bytes: 69471, sha256: "b862654c6e9ac5b564e6735d9c8a5bb10f324ea5bc605e159fea6745f5ea716b" },
      { bytes: 19855, sha256: "f45e786b394682f3a8be9688cc745fe8a940845ab74443fdbb1fa54115177f8a" },
      { bytes: 72867, sha256: "0f0772bbdd4512ab5546b4661cbf6ebfd6095c47cd8a63d884790780141e41bb" },
      { bytes: 20827, sha256: "d1b0b86968addcfc3000ce62b450dca4d81ec0ac7104573df1755007e5ad1e6c" },
      { bytes: 31446, sha256: "fe4a7bd0a65f09e2b8b80ab038249d51804757705956519ba28b28289a2535cc" },
      { bytes: 6111, sha256: "28f6c3dbac4ec942fd9a51aeb7f602efe3546af12d87a74b9fc9d05e86da6af4" },
      { bytes: 33804, sha256: "6cb2160eabdf2d8d33bd70410a021670e73e5f579e307abb316c2ef9ec824a60" },
      { bytes: 7739, sha256: "b0f87e75eb340e36eedda33ae5089c77b6ed9a9c162da78e1dc627f5138949a3" },
      { bytes: 60730, sha256: "7b2603d4354e25b4dd988c4ebcbdfd7abf9ceff1d594509dd2c868602403df33" },
      { bytes: 13842, sha256: "b0991ab2e481008415480658dcf6101677de6f6ea62a1827722f6f485f47ce78" },
      { bytes: 87106, sha256: "059cde9538255d10cf1fec758d278c2636b65e86f7040fc8cb5fc22374344e17" },
      { bytes: 40243, sha256: "ec50a6946a4d3d992d436905d9d8c6dcf57b519507f5fc677cc6b26f98b3e18b" },
      { bytes: 128257, sha256: "906dfe44d112b0d0b93698c97368a303a9aef73cc5b7b99d7d0a28ca76ec3495" },
      { bytes: 46004, sha256: "cba5a01eaecf392efce1d37a35085e720e3acf27bab666c34c2a32dd9a29f94f" },
      { bytes: 159669, sha256: "7c8a0c329bea484331b7abfcbebbadfbb19b4164379d04231f5ace656df0b1e7" },
      { bytes: 49452, sha256: "71122e7646fc76a08a1c33d9fa2855eac02e86240b02a16b8285fdab69fa2b8c" },
      { bytes: 112310, sha256: "1837b947aa9649e4564b5042a88fbaf36a3fb7e971599c852db4c28923306dca" },
      { bytes: 42472, sha256: "619b17e19452e259871b5e1dc36cced280a44d809feb3187d05d7af71d55947e" },
      { bytes: 116762, sha256: "5c4e751bed6fda8dc28869dad6491e64bf4aa25c0e577293b66b08125c8cbfe6" },
      { bytes: 39940, sha256: "5498f3a09eb1673e5ad1e008f6cbcd0a48e3b8d6cad56dc2ec34186a550b57f3" },
      { bytes: 130820, sha256: "507cc1970214e47016e9c5be5fa8914b90b2a45f6e813dcd468c7761b2b94e29" },
      { bytes: 54372, sha256: "f4cdf48282c53c64d41e7eb84bf1b183eedb6863b631466ebbfe0f1a87269c22" },
      { bytes: 104781, sha256: "2c85df1d40accfff092ce113d608469ed0c928516fe223b06dcd9880388c39b7" },
      { bytes: 40917, sha256: "2c1c0e25351aff14811bcd185284e648fdc0b8f36cab67ee9ef0f564ff9f3d3d" },
      { bytes: 95981, sha256: "9a1f0a36c08fbaad3816f2d70719c8825b75ca041e6fd85179ddca0de39cc8d1" },
      { bytes: 97644, sha256: "947497261e27f4791fbdc8d865e576cc2ba879d4a12a86ff3436fc8b5d5a43f9" },
      { bytes: 97021, sha256: "3eec34f93c2df7f02e7b7f109054c5746b9bb8f2d6cd8c6fc2fecb182d54dea7" },
      { bytes: 32395, sha256: "d90b41eb8be9099859e48cb3a0876f5479785400c0f87919cd8f7e3cda808a8f" },
      { bytes: 103671, sha256: "ae31db2c3c7dc375e9a9c30a87be7e04d395eed7631de9bac1ec895bc522cda2" },
      { bytes: 80523, sha256: "f0752b2caba13d02125694142b368bac1ae78fe347aa40dcd85e64b1e95a7012" },
      { bytes: 75278, sha256: "215c6a1ce0790270465a9acffacd2f932f5e1c30efee6be1103c4076f01d3658" },
      { bytes: 60150, sha256: "13f2401afaf4710251ac5514d9d9d2917eb9e961b44747a67d99307e7bad0739" },
    ],
  );
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "1a2049082f981614c33fb2f1576cfd8d52e9dbd6dbb44f5177d3cf290064c51a",
  );
});

test("sequence fifty-seven preserves the reviewed chain and appends M10-T01", () => {
  const previous = baselineManifest.checkpoints[55];
  const current = baselineManifest.checkpoints[56];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 57);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[55]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M10-T01",
    path: "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json",
    bytes: 10259,
    sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(current.readers.slice(previous.readers.length), [
    {
      task: "M10-T01",
      role: "proof-library",
      path: "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
      bytes: 32299,
      sha256: "4e6028de6295368ca28ee78c16224e8f1fc5d0cd47c22ab7e444ed98e80e0993",
    },
    {
      task: "M10-T01",
      role: "root-test",
      path: "tests/desen-app-empty-project-browser-e2e.test.mjs",
      bytes: 10946,
      sha256: "700f250e90848eb9eace69a4472de0afbe06690e3bc9aec982d1d0e54431b296",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "690c73294f6926822fb1535ac60ea40636545890031db72b7a8d63930a27cc57",
  );
});

test("sequence fifty-eight preserves sequence fifty-seven, reseals current app readers, and appends compatibility authority", () => {
  const previous = baselineManifest.checkpoints[56];
  const current = baselineManifest.checkpoints[57];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const receipt = ({ bytes, sha256 }) => ({ bytes, sha256 });
  const changedReaderIndexes = [
    70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93,
    94, 95, 96, 97, 98, 99,
  ];

  assert.equal(current.sequence, 58);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[56]);
  assert.deepEqual(current.artifacts.slice(0, previous.artifacts.length), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M10-T01-COMPAT",
    path: "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json",
    bytes: 16025,
    sha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers
      .slice(0, previous.readers.length)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => receipt(current.readers[index])),
    [
      { bytes: 96767, sha256: "10c876a41048a68d0bca20dc00b935a3c082892ea3c50c179b9f92c2b791dc86" },
      { bytes: 42209, sha256: "5efa4eb91bd7a171918792543d8113b8f8251fbd9bd4c46f5f7d3db52ec99d6b" },
      { bytes: 137918, sha256: "c8a3f3538b24890e82007a11200857635531e9a876f2f3417d61bbe5ad56bc91" },
      { bytes: 47976, sha256: "472effd7d060d5ca8a2dcadafdb9ddfc049c7822c4324e1b4243481a0840238b" },
      { bytes: 169490, sha256: "e66a19c68eac002a2f96c1e9f9de6c03ea2f84647a57cf26852b7d3caf98b761" },
      { bytes: 51420, sha256: "71836f7d016c593efae9deb148bf1f1852c3dcb52379258e10ad699949534781" },
      { bytes: 122010, sha256: "0019efe45de22763bac5990f33400e51751895a22032dba2d944260440561465" },
      { bytes: 44439, sha256: "c7d4fdf8584f1cde8b1f483ce2fdae3f175afbdc8161a1993bcf4ce5a3bb5ed9" },
      { bytes: 126423, sha256: "b4cebdf9e1e9011d4e76aa4038451b5a88df679669c660f944e81c5aea23df22" },
      { bytes: 41906, sha256: "6400397a55e04075673badff0c6b565b59eaca1287f8e35cf30de23f379dc056" },
      { bytes: 140481, sha256: "8e37b8bf79c135c9c9bf2a6e82a4b2321988e77a5e3d6bf22b1db232f707fa35" },
      { bytes: 56342, sha256: "a8c6af0ddc84e1f562de308d5799fdf9011cca2f72cab40a3cbf02b6442bd33d" },
      { bytes: 114442, sha256: "b6998f16ff8259951f757616d044e4906104e89951711bf60a956b74e048fdd8" },
      { bytes: 42886, sha256: "a5480248b62468a5b8984c0e2ae46eebd86c8753c93c5113866415ae03d5da14" },
      { bytes: 105642, sha256: "f99af46ddf15740d24efba67ae00245d07b72912dca0f8ce2392f3429c1fe24e" },
      { bytes: 37459, sha256: "7efc9a0872cdab666841b54d57a64b428b81f0519cdb111277552270e6c04c79" },
      { bytes: 107305, sha256: "4557ba2c80fac9399a6e235f640dd25308347491ff0eff78b3e8ddce0fb1e0b0" },
      { bytes: 37891, sha256: "e63b82fb6a57f20f944d462ae5e094d047cfb821c0eaf2322dde102457f83428" },
      { bytes: 106682, sha256: "d937bb6a91c55b1bc7c0546dc4b5b20b36ca6967687cd30c08132236faf51190" },
      { bytes: 34360, sha256: "c9ed44421610e2aa49b4a3e6c02bcc9437560dae18ecee7c5226088d37c9fd8b" },
      { bytes: 113332, sha256: "171ac9a4a98bad678be4225916838976493e0c71ffd7439ece6133dd610c959d" },
      { bytes: 40508, sha256: "1eb6bd285df2feb498c3ede97807a856643dcb6576e4a3c280b198a8edbe412e" },
      { bytes: 90240, sha256: "b43d9dd851aad3d7e5931c1333a26a331c40ea5f05d24c2248503187769bbe86" },
      { bytes: 32720, sha256: "407fd873922366693d73497ac036ef352aefb63b55bfdd5fee85531031729701" },
      { bytes: 85021, sha256: "f5e6d04bf29e7b36776a438ea323d742af71cdcdb5da381b190bd4da57ae910a" },
      { bytes: 24020, sha256: "8882e944681436bac69db2a296510ad855836e9790f701415bfb07c32bdc7f41" },
      { bytes: 70100, sha256: "ad77e4a3d8586d93a25b1179b1d1babaec6edec9ba0c86f65573c85f39aa31fc" },
      { bytes: 17249, sha256: "31940b93edda62671ea438622c5b5f51596e205e90de6529399f827022299c03" },
      { bytes: 27305, sha256: "bd6b6ebc7d2f6dd268a300146bffddf0ffb6fd294149a2c8fd91dda72f9b4d69" },
      { bytes: 15619, sha256: "90c3a6cdae6ed3ced37ff249dadf0125ca2c9a89b7d6ffd6ade123b9d991141a" },
    ],
  );
  assert.deepEqual(current.readers.slice(previous.readers.length), [
    {
      task: "M10-T01-COMPAT",
      role: "proof-library",
      path: "scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs",
      bytes: 53568,
      sha256: "c51a6ae86eacee28771a273b0a243dba0269e271cd07667bfd00e10815c4fa8f",
    },
    {
      task: "M10-T01-COMPAT",
      role: "root-test",
      path: "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
      bytes: 22468,
      sha256: "b20a2711a1a569ecd22aa11410616f9e007e8a1fefd17619f36f0c15147f8365",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "08396f779b0c1c63cf56d9a9292dcd0a103228c57fe39e1173d95a4a106a92e5",
  );
});

test("sequence fifty-nine preserves sequence fifty-eight and reseals only the permission-model fixture reader", () => {
  const previous = baselineManifest.checkpoints[57];
  const current = baselineManifest.checkpoints[58];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 59);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[57]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [99],
  );
  assert.deepEqual(previous.readers[99], {
    task: "M10-T01",
    role: "root-test",
    path: "tests/desen-app-empty-project-browser-e2e.test.mjs",
    bytes: 15619,
    sha256: "90c3a6cdae6ed3ced37ff249dadf0125ca2c9a89b7d6ffd6ade123b9d991141a",
  });
  assert.deepEqual(current.readers[99], {
    task: "M10-T01",
    role: "root-test",
    path: "tests/desen-app-empty-project-browser-e2e.test.mjs",
    bytes: 15820,
    sha256: "054c9393edebb0818cdcfad3af91bff44cc457fef7b9e895150b32039cadbefb",
  });
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "349a292c9137f0f66c5cd58f384aa2175082613500905fdb723f15b246cbd2e8",
  );
});

test("sequence sixty preserves sequence fifty-nine, freezes historical compatibility readers, and appends M10-T01A", async () => {
  const previous = baselineManifest.checkpoints[58];
  const current = baselineManifest.checkpoints[59];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 60);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[58]);
  assert.deepEqual(current.artifacts.slice(0, -1), previous.artifacts);
  assert.deepEqual(current.artifacts.at(-1), {
    task: "M10-T01A",
    path: "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
    bytes: 20173,
    sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
  });
  assert.deepEqual(
    current.readers.slice(0, previous.readers.length).map(identity),
    previous.readers.map(identity),
  );
  assert.deepEqual(
    current.readers
      .slice(0, previous.readers.length)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [100, 101],
  );
  assert.deepEqual(current.readers.slice(previous.readers.length), [
    {
      task: "M10-T01A",
      role: "proof-library",
      path: "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
      bytes: 41994,
      sha256: "abc72449ba985321ffa675a887b1cd0efbb6a0719ac231e9eb688f2cfad37efb",
    },
    {
      task: "M10-T01A",
      role: "root-test",
      path: "tests/desen-app-user-created-blank-project.test.mjs",
      bytes: 15457,
      sha256: "92641dcc935a9ecdb854f991080d3b4b0841ff0c0ad476c774a57e35dfd11f6f",
    },
  ]);
  for (const [index, reader] of current.readers.entries()) {
    if ((index >= 70 && index <= 97) || index === 101) continue;
    const bytes = await readFile(path.join(WORKSPACE_ROOT, reader.path));
    assert.equal(bytes.byteLength, reader.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reader.sha256);
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "8f8d69456575c8780fa394f7c46189ac02bb8cecdf24c1a46d81ec0d1ea2c7a1",
  );
});

test("sequence sixty-one preserves sequence sixty and reseals only the M09 App readers for M10-T01A", async () => {
  const previous = baselineManifest.checkpoints[59];
  const current = baselineManifest.checkpoints[60];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 61);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[59]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [
      70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92,
      93, 94, 95, 96, 97,
    ],
  );
  for (const [index, reader] of current.readers.entries()) {
    if (index === 101) continue;
    const bytes = await readFile(path.join(WORKSPACE_ROOT, reader.path));
    assert.equal(bytes.byteLength, reader.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reader.sha256);
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "a80e008bf0f383ab46d097abfec17710131a47656040ec07dc7cc60f965666fb",
  );
});

test("sequence sixty-two preserves sequence sixty-one and reseals only the compatibility root for temp isolation", async () => {
  const previous = baselineManifest.checkpoints[60];
  const current = baselineManifest.checkpoints[61];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 62);
  assert.equal(current.predecessorSha256, PROOF_READER_CHECKPOINT_REVIEWED_CHAIN_SHA256[60]);
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    [101],
  );
  assert.deepEqual(previous.readers[101], {
    task: "M10-T01-COMPAT",
    role: "root-test",
    path: "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    bytes: 9746,
    sha256: "4645512c876f594161b923450bdeff36e2d4fec582f123a9fa29b6e2a1598093",
  });
  assert.deepEqual(current.readers[101], {
    task: "M10-T01-COMPAT",
    role: "root-test",
    path: "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    bytes: 9814,
    sha256: "1fd2a93a60da465b6100fbf53d99bd9035e82686d7ac297179a6fb1ba72ab49c",
  });
  for (const reader of current.readers) {
    const bytes = await readFile(path.join(WORKSPACE_ROOT, reader.path));
    assert.equal(bytes.byteLength, reader.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reader.sha256);
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "15ede557b4167cb7bc0cce89b02cf0e9d9f0f7e92c4c5fdc2d799cb3bcf0be55",
  );
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

test("sequence twenty-three preserves its reviewed prefix, reseals exact compatibility readers, and appends M07-T10", () => {
  const sequenceTwentyTwo = baselineManifest.checkpoints[21];
  const sequenceTwentyThree = baselineManifest.checkpoints[22];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [
    0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31, 32,
    33, 34, 35, 36, 37,
  ];

  assert.equal(sequenceTwentyThree.sequence, 23);
  assert.equal(
    sequenceTwentyThree.predecessorSha256,
    "aef9881c8fc540873f889a09754e5f2c19adc3c19934ba0fcfcf5e6a12b2da9e",
  );
  assert.deepEqual(sequenceTwentyThree.artifacts.slice(0, -1), sequenceTwentyTwo.artifacts);
  assert.deepEqual(sequenceTwentyThree.artifacts.at(-1), {
    task: "M07-T10",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json",
    bytes: 58059,
    sha256: "f5f10dd422f9e1fc7ca4445b84bf192280e59fb747d8d2ed40357cba3ebc0f39",
  });
  assert.deepEqual(
    sequenceTwentyThree.readers.slice(0, sequenceTwentyTwo.readers.length).map(identity),
    sequenceTwentyTwo.readers.map(identity),
  );
  assert.deepEqual(
    sequenceTwentyThree.readers.slice(sequenceTwentyTwo.readers.length).map(identity),
    [
      {
        task: "M07-T10",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-transition-races-proof.mjs",
      },
      {
        task: "M07-T10",
        role: "root-test",
        path: "tests/control-plane-runtime-transition-races.test.mjs",
      },
    ],
  );
  assert.deepEqual(
    sequenceTwentyThree.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTwentyTwo.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => ({
      index,
      bytes: sequenceTwentyThree.readers[index].bytes,
      sha256: sequenceTwentyThree.readers[index].sha256,
    })),
    [
      {
        index: 0,
        bytes: 269572,
        sha256: "e7c2497ee3aa128dc3d3c6cb297887a94f8d176549e6a4c205c65beeca9f6db4",
      },
      {
        index: 1,
        bytes: 91297,
        sha256: "d7801ea603f72435cf07d55ad74cebf4ac62b0f95128d728d28200cc225afc0e",
      },
      {
        index: 2,
        bytes: 60289,
        sha256: "828aa1407a6dd790c0b0568d2a4a5c966cb1a43aa5d7aba16ae77c29819776b1",
      },
      {
        index: 3,
        bytes: 56537,
        sha256: "d8f9ffd0798bf3196b5030eab5c389273113359b398cd01597b8d1c8d4374d47",
      },
      {
        index: 4,
        bytes: 72643,
        sha256: "f6b10c50898d95ec737db3cf29091e9d84fbe93a1f4a1cc29cb5427d585ffb09",
      },
      {
        index: 5,
        bytes: 29586,
        sha256: "ec40b474e4a424a771acc94952c50546ecea2aefdd07b40da74555dd236d1ac9",
      },
      {
        index: 7,
        bytes: 38590,
        sha256: "f8644fba6a3ebc17ab09aa8396ee6c20574e7549082cd7f67df4bdc00b349a92",
      },
      {
        index: 8,
        bytes: 139396,
        sha256: "89ff5dc4f35036164dd33f1fcf65220bd086ce02ff04e9068078cbf6713bcb48",
      },
      {
        index: 9,
        bytes: 82563,
        sha256: "4b1eb8e40281c0e12d94786042e34c85ec81737d07836b2e964fa9dc20eae185",
      },
      {
        index: 10,
        bytes: 171863,
        sha256: "82f66664a5099e61367bc6a006f2bb59eec63eaf96c27dc95d207ae0741576bf",
      },
      {
        index: 11,
        bytes: 88591,
        sha256: "09e84895310b254ca201aa5b6e87b87b1eadf602293eaaa7545c92eafd49ac51",
      },
      {
        index: 14,
        bytes: 125378,
        sha256: "bd0bd456e39497f5bd2d2fe21cd2e574b76d1fbf5c60bd77924d973633de2e85",
      },
      {
        index: 15,
        bytes: 28896,
        sha256: "6795ca970ab7c9e159f65e7d866512631529ee6de0d0e8bd59b36f29cf35c926",
      },
      {
        index: 16,
        bytes: 108318,
        sha256: "ab70e14998cfedc2fd355063515df3551cf910247f081364407697e15e69aafa",
      },
      {
        index: 17,
        bytes: 24782,
        sha256: "a574fe8ed0dacae1d08c52fbd626cb135a65784e8b160247660328dd5a7710b8",
      },
      {
        index: 18,
        bytes: 105456,
        sha256: "9560167d3b8c3f4f0c82037016cd92a389a131bd0dc59047065e44868cef9a52",
      },
      {
        index: 19,
        bytes: 24200,
        sha256: "256a8897a0ee34f0fcfe8d207a40e1785a01672ea95d8430951f9cbfcbeee057",
      },
      {
        index: 22,
        bytes: 89172,
        sha256: "3f29d421bd42ee2b0b1c8ef52104ca61d677c2d02cab633d2b66b31c62af4261",
      },
      {
        index: 23,
        bytes: 22091,
        sha256: "493b2aa81c6570f398d277278766e15cb85543a3a2cf143dc7a448b44185f7e8",
      },
      {
        index: 26,
        bytes: 101028,
        sha256: "573252de1b002c5dcda3bda6277ca609b7ba43458f3dbecb0d267028e8f17d1b",
      },
      {
        index: 27,
        bytes: 23957,
        sha256: "edd0baebf4533502b1b11e18904bab367da47b4461000d5cf8cbffd4c14ca4ff",
      },
      {
        index: 28,
        bytes: 100466,
        sha256: "5e4c8d67f3245faa6987a43535983c2a694633ee6466275bdf6b19c52ee2d6ee",
      },
      {
        index: 29,
        bytes: 30221,
        sha256: "79b63370cb58b549b68677a7bd8d1e828730a2bfeec5ae2a3d22950b81d9fe54",
      },
      {
        index: 30,
        bytes: 117892,
        sha256: "d8f9dbf86d2c07d92bc79e96e7c3be6e8f55000031d3b7575c34be2298be0098",
      },
      {
        index: 31,
        bytes: 29167,
        sha256: "bc93883cf767b6f1255404dd2f4139da2a29134f15e22ea1ece1fae57ad360fc",
      },
      {
        index: 32,
        bytes: 94824,
        sha256: "8602ef31f6a4f638b15e9e26e1a5b5b107593e7d0007daf2089f6a66bbb86542",
      },
      {
        index: 33,
        bytes: 28220,
        sha256: "968dadebad1b4f07ce9d6b277988788a07cb0cdeea06a1cc598a0d1e25f07dbc",
      },
      {
        index: 34,
        bytes: 69216,
        sha256: "0b78564a5b0c952b7bac6c47013ff8b337d76d089c19bcc46c9b87f38855b26e",
      },
      {
        index: 35,
        bytes: 18154,
        sha256: "2168ec05b7ff773c15531b00906056ef278ea0b00a4840023956f26a2b5c2af6",
      },
      {
        index: 36,
        bytes: 68377,
        sha256: "aa3895fcc79bd6b322f495f00703d1eda57123ad8b1cd9167dc6956dc28c7d2e",
      },
      {
        index: 37,
        bytes: 19130,
        sha256: "5b0bed4eeedf4971ca18d2f698f9e7702c4fc3d8ee728231ef3b30fff204dcbc",
      },
    ],
  );
  for (let index = 0; index < sequenceTwentyTwo.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceTwentyThree.readers[index], sequenceTwentyTwo.readers[index]);
    }
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentyThree),
    "3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d",
  );
});

test("sequence twenty-four preserves its reviewed prefix, reseals exact compatibility readers, and appends M07-T11", () => {
  const sequenceTwentyThree = baselineManifest.checkpoints[22];
  const sequenceTwentyFour = baselineManifest.checkpoints[23];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });
  const changedReaderIndexes = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 22, 23, 26, 27, 28, 29, 30, 31,
    32, 33, 34, 35, 36, 37, 38, 39,
  ];

  assert.equal(sequenceTwentyFour.sequence, 24);
  assert.equal(
    sequenceTwentyFour.predecessorSha256,
    "3308da059b521c2b5f5fe75d036303221cace805094445f2d64383384831d45d",
  );
  assert.deepEqual(sequenceTwentyFour.artifacts.slice(0, -1), sequenceTwentyThree.artifacts);
  assert.deepEqual(sequenceTwentyFour.artifacts.at(-1), {
    task: "M07-T11",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-channel-consumption.json",
    bytes: 39307,
    sha256: "48bd9f85bd2da413fc72c1973a33732cc091796f9afc2863ec1eec15054314e0",
  });
  assert.deepEqual(
    sequenceTwentyFour.readers.slice(0, sequenceTwentyThree.readers.length).map(identity),
    sequenceTwentyThree.readers.map(identity),
  );
  assert.deepEqual(
    sequenceTwentyFour.readers.slice(sequenceTwentyThree.readers.length).map(identity),
    [
      {
        task: "M07-T11",
        role: "proof-library",
        path: "scripts/lib/reference-host-web-channel-consumption-proof.mjs",
      },
      {
        task: "M07-T11",
        role: "root-test",
        path: "tests/reference-host-web-channel-consumption.test.mjs",
      },
    ],
  );
  assert.deepEqual(
    sequenceTwentyFour.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(sequenceTwentyThree.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => ({
      index,
      bytes: sequenceTwentyFour.readers[index].bytes,
      sha256: sequenceTwentyFour.readers[index].sha256,
    })),
    [
      {
        index: 0,
        bytes: 279237,
        sha256: "b7f17df2ac1256217897072ece67e0eb8522521b6e44b80f8d76bce5c01bd08c",
      },
      {
        index: 1,
        bytes: 93464,
        sha256: "888c1cf5235340bd5e7a27229eedb74250bfefe054078ecd8956e233ce74de70",
      },
      {
        index: 2,
        bytes: 60598,
        sha256: "5b2178f6b90a8b830c613cf228512e3e2c6fa7b1545cca0abbe343e45ba2b749",
      },
      {
        index: 3,
        bytes: 68032,
        sha256: "b2964ee7a2dedc285fc5da5050732525ed38c4ff6cdba4acc0f668d4462407d2",
      },
      {
        index: 4,
        bytes: 72952,
        sha256: "a0664730afda307e7f513acecba764a2b7c93f4878fa27dbdebf7b20a6cadc70",
      },
      {
        index: 5,
        bytes: 40529,
        sha256: "f0282eecd5fa844851fe533eb77122384c61ab58a639d7281aa0edceb2751191",
      },
      {
        index: 6,
        bytes: 103727,
        sha256: "4371b3d878564e8d34032b1c7f901b3c17e092dbd8f9acfca1b53687a255e6c8",
      },
      {
        index: 7,
        bytes: 39954,
        sha256: "e442dc376f4787d35941f2676e78f34a859d7eee9a0374449260dd35328b5502",
      },
      {
        index: 8,
        bytes: 139704,
        sha256: "a61af18578594c589be8ae07ee244fed05c21c2f865f91a53f3ef48f4daf44bd",
      },
      {
        index: 9,
        bytes: 87397,
        sha256: "26df77e97181faf11c98ca352cb83ee2b8f2f54cf2e07abc2d0a76df9d1eb813",
      },
      {
        index: 10,
        bytes: 172770,
        sha256: "1aec8cefc757303b5eeb6a9f5f61241f3b3c5b087ecccba9d3edcb45b1dd64de",
      },
      {
        index: 11,
        bytes: 97713,
        sha256: "cf5e4ca357b4f6e2aa5c636303e3d6a3b9cd3fcd401d8bce991f33441227644e",
      },
      {
        index: 14,
        bytes: 130737,
        sha256: "65d6b5491404c6f7422931a731df82757b2122d4f227af91265a001ccd80e40b",
      },
      {
        index: 15,
        bytes: 31292,
        sha256: "1f12b20955b88b0aaaf90459838082a4f4d37340a1e8841c298cef21f89041f5",
      },
      {
        index: 16,
        bytes: 110010,
        sha256: "470371ae6fd3fe3a32af8e85e618b5f561a5ea6390ae7067084c818e4a1069bc",
      },
      {
        index: 17,
        bytes: 25476,
        sha256: "50f37803000ea401a393a0c4e513b3306235f4be4dbe14ff5e512a5369e9a392",
      },
      {
        index: 18,
        bytes: 108553,
        sha256: "db654c58d4538dfa59c46b43b4180902873dc362b6475df16e60ed6da3fe50a5",
      },
      {
        index: 19,
        bytes: 24522,
        sha256: "ffc15e53dc10ab50a813c921acba1049c9d72c2600e6abb5e12d818a864e7867",
      },
      {
        index: 22,
        bytes: 92421,
        sha256: "5b0c33c9b3c63b5aeff7ed7360cd6a12f8013d4b6f0eb776f6abb53f1df41707",
      },
      {
        index: 23,
        bytes: 22413,
        sha256: "534fb50d40178bc9a07f90487c377571209045cd86e4c5efcc0b03af8ada6b6f",
      },
      {
        index: 26,
        bytes: 104347,
        sha256: "8fdcdebd91fa9be6f0b30d1098c3250a12c464c9a087f27f73bf8c32ca056e4f",
      },
      {
        index: 27,
        bytes: 24279,
        sha256: "d0066a012724285623ea84af183fae6d94330dd493862804e075205a235f7896",
      },
      {
        index: 28,
        bytes: 103208,
        sha256: "a2056007dd502f1caa3c59af5d9ba393cd9651cf3e65191fcc6e48fd78b1de26",
      },
      {
        index: 29,
        bytes: 30543,
        sha256: "d507f109b3386b88cf8d26a0ed0d3e941ce479d5f43680eb7547c24ac4613431",
      },
      {
        index: 30,
        bytes: 120814,
        sha256: "710f59d46d4999ca85d332fd51a3ec5eeb33f62c3477598fd137b8a45009b4ca",
      },
      {
        index: 31,
        bytes: 29489,
        sha256: "66714f4d709cb0de042cb257570536d505a8ee2d3ef521b41a77090fcafdf69a",
      },
      {
        index: 32,
        bytes: 97972,
        sha256: "3b53d7dd57e12fc4d9dd6c8499be9e8e42e6c8f78aeed2f3c0788cd0608821f8",
      },
      {
        index: 33,
        bytes: 28570,
        sha256: "5c0f08c766adf6cb45c68e8d3d406d964c98db3f4c3b662ce0e6319b90815d8e",
      },
      {
        index: 34,
        bytes: 71322,
        sha256: "32eda95ff0f20839b49407ea10b428ee229be8c172d07b3fc42b9db859b147ff",
      },
      {
        index: 35,
        bytes: 18770,
        sha256: "f19a6709377d685aedbce20e0f795fc38245bb63256fb3cab5a7a50d7263d065",
      },
      {
        index: 36,
        bytes: 72312,
        sha256: "0e2fd022ec059ab1014cc51b8b5b7e0acd856a2260c815dc0c255c3ddda5cbbc",
      },
      {
        index: 37,
        bytes: 19783,
        sha256: "96f1d5b0cbb4a646198b8b6d4dfe1fbc2be539b909762ab1072f6de10f2b0656",
      },
      {
        index: 38,
        bytes: 71919,
        sha256: "c0ff3865c345bc119e9f80db415bf574eb9cc4f40f4104cf96bce76e39b7148b",
      },
      {
        index: 39,
        bytes: 20656,
        sha256: "1a2f276ae2c0f91e0ef5a16cb0c86c6a181c4ef63b58bd17017f3fab0d30524e",
      },
    ],
  );
  for (let index = 0; index < sequenceTwentyThree.readers.length; index += 1) {
    if (!changedReaderIndexes.includes(index)) {
      assert.deepEqual(sequenceTwentyFour.readers[index], sequenceTwentyThree.readers[index]);
    }
  }
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentyFour),
    "f7dcc3f74653e739a46434b8fa746f177a9b33cabb874ad9910747dcd46310de",
  );
});

test("sequence twenty-five preserves the first twenty artifacts and appends the exact publisher generation", async () => {
  const sequenceTwentyFour = baselineManifest.checkpoints[23];
  const sequenceTwentyFive = baselineManifest.checkpoints[24];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(sequenceTwentyFive.sequence, 25);
  assert.equal(
    sequenceTwentyFive.predecessorSha256,
    "f7dcc3f74653e739a46434b8fa746f177a9b33cabb874ad9910747dcd46310de",
  );
  assert.deepEqual(sequenceTwentyFive.artifacts.slice(0, 20), sequenceTwentyFour.artifacts);
  assert.deepEqual(sequenceTwentyFive.artifacts.slice(20), [
    {
      task: "M06-T02",
      path: "docs/proof/artifacts/publisher-0.1.0-catalog-resolution.json",
      bytes: 10936,
      sha256: "02c5c567c8603470f0f45515dfd1713e528147bcc15ed72daa580807388015f6",
    },
    {
      task: "M06-T03",
      path: "docs/proof/artifacts/publisher-0.1.0-source-preflight.json",
      bytes: 12499,
      sha256: "07537cc034d99dec3cb887805381f58a550de3a0dcb694564ab6a20ac760a387",
    },
    {
      task: "M06-T04",
      path: "docs/proof/artifacts/publisher-0.1.0-capability-preflight.json",
      bytes: 20474,
      sha256: "2c55593b69fd5203d3fe2aeaeb8e59dc70cb4a89c4168605c581c17fd1aad56e",
    },
    {
      task: "M06-T06",
      path: "docs/proof/artifacts/publisher-0.1.0-source-preservation.json",
      bytes: 21723,
      sha256: "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff",
    },
    {
      task: "M06-T07",
      path: "docs/proof/artifacts/publisher-0.1.0-source-normalization.json",
      bytes: 8715,
      sha256: "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e",
    },
  ]);
  assert.deepEqual(
    sequenceTwentyFive.readers.slice(0, 40).map(identity),
    sequenceTwentyFour.readers.map(identity),
  );
  assert.deepEqual(sequenceTwentyFive.readers.slice(40).map(identity), [
    {
      task: "M06-T02",
      role: "proof-library",
      path: "scripts/lib/publisher-catalog-resolution-proof.mjs",
    },
    {
      task: "M06-T02",
      role: "root-test",
      path: "tests/publisher-catalog-resolution.test.mjs",
    },
    {
      task: "M06-T03",
      role: "proof-library",
      path: "scripts/lib/publisher-source-preflight-proof.mjs",
    },
    {
      task: "M06-T03",
      role: "root-test",
      path: "tests/publisher-source-preflight.test.mjs",
    },
    {
      task: "M06-T04",
      role: "proof-library",
      path: "scripts/lib/publisher-capability-preflight-proof.mjs",
    },
    {
      task: "M06-T04",
      role: "root-test",
      path: "tests/publisher-capability-preflight.test.mjs",
    },
    {
      task: "M06-T06",
      role: "proof-library",
      path: "scripts/lib/publisher-source-preservation-proof.mjs",
    },
    {
      task: "M06-T06",
      role: "root-test",
      path: "tests/publisher-source-preservation.test.mjs",
    },
    {
      task: "M06-T07",
      role: "proof-library",
      path: "scripts/lib/publisher-source-normalization-proof.mjs",
    },
    {
      task: "M06-T07",
      role: "root-test",
      path: "tests/publisher-source-normalization.test.mjs",
    },
  ]);

  assert.deepEqual(sequenceTwentyFive.readers.slice(12, 14), [
    {
      task: "M06-T10",
      role: "proof-library",
      path: "scripts/lib/publisher-official-golden-proof.mjs",
      bytes: 55313,
      sha256: "44876fa70e791b9fa6e7d964d3de9eba5fc79a82a275d94a5901ee64d32db295",
    },
    {
      task: "M06-T10",
      role: "root-test",
      path: "tests/publisher-official-golden.test.mjs",
      bytes: 36955,
      sha256: "3cc45b192a7236d5e7111588c17c4c5ac685f475b7aefb47507300f1bec2c36f",
    },
  ]);
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentyFive),
    "d6bcdf4a26c4b4fd7ea51c83b92f551ff76a98802381284537516d2969b70137",
  );
});

test("sequence twenty-six preserves every artifact and reseals only official-golden readers", async () => {
  const sequenceTwentyFive = baselineManifest.checkpoints[24];
  const sequenceTwentySix = baselineManifest.checkpoints[25];
  assert.equal(sequenceTwentySix.sequence, 26);
  assert.equal(
    sequenceTwentySix.predecessorSha256,
    "d6bcdf4a26c4b4fd7ea51c83b92f551ff76a98802381284537516d2969b70137",
  );
  assert.deepEqual(sequenceTwentySix.artifacts, sequenceTwentyFive.artifacts);
  assert.deepEqual(sequenceTwentySix.readers.slice(0, 12), sequenceTwentyFive.readers.slice(0, 12));
  assert.deepEqual(sequenceTwentySix.readers.slice(12, 14), [
    {
      task: "M06-T10",
      role: "proof-library",
      path: "scripts/lib/publisher-official-golden-proof.mjs",
      bytes: 50294,
      sha256: "2fd4a3499b4b45fc3a7a805554b2342e5e53bcec809132c7e301750d5d889148",
    },
    {
      task: "M06-T10",
      role: "root-test",
      path: "tests/publisher-official-golden.test.mjs",
      bytes: 34459,
      sha256: "3e64765c660fb81355073fabb1971a99aa6eb7e64d112bd5d3fd89cb79241ac9",
    },
  ]);
  assert.deepEqual(sequenceTwentySix.readers.slice(14), sequenceTwentyFive.readers.slice(14));
  assert.equal(
    calculateProofReaderCheckpointSha256(sequenceTwentySix),
    "0027f8c18eb1837e9998a5c5a998072e8eebec54e4e8edef974129b910134f5b",
  );
});

test("sequence twenty-seven preserves authority and reseals only two formatted root readers", () => {
  const previous = baselineManifest.checkpoints[25];
  const current = baselineManifest.checkpoints[26];
  assert.equal(current.sequence, 27);
  assert.equal(
    current.predecessorSha256,
    "0027f8c18eb1837e9998a5c5a998072e8eebec54e4e8edef974129b910134f5b",
  );
  assert.deepEqual(current.artifacts, previous.artifacts);
  for (let index = 0; index < current.readers.length; index += 1) {
    if (![35, 37].includes(index))
      assert.deepEqual(current.readers[index], previous.readers[index]);
  }
  assert.deepEqual(current.readers[35], {
    task: "M07-T09",
    role: "root-test",
    path: "tests/control-plane-runtime-fault-injection.test.mjs",
    bytes: 17894,
    sha256: "a9aa2e79bd1f323bcb2a9976b6dc9be2da8590cd2708fcafda0bbf72034c63bb",
  });
  assert.deepEqual(current.readers[37], {
    task: "M07-T10",
    role: "root-test",
    path: "tests/control-plane-runtime-transition-races.test.mjs",
    bytes: 19683,
    sha256: "5a607fdd2e713a31076fa5d73c7c789224d85829230f2d3e6b2d43b1095edc6e",
  });
  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "bf21a7a600ca9d569d90a8711e4fe857e91beb933d8a3c7289ebfbf0b8a2d87a",
  );
});

test("sequence twenty-eight preserves artifacts and reseals only seven final readers", () => {
  const previous = baselineManifest.checkpoints[26];
  const current = baselineManifest.checkpoints[27];
  const changedReaderIndexes = [15, 17, 19, 23, 27, 34, 36];
  const identity = ({ task, role, path: readerPath }) => ({ task, role, path: readerPath });

  assert.equal(current.sequence, 28);
  assert.equal(
    current.predecessorSha256,
    "bf21a7a600ca9d569d90a8711e4fe857e91beb933d8a3c7289ebfbf0b8a2d87a",
  );
  assert.deepEqual(current.artifacts, previous.artifacts);
  assert.deepEqual(current.readers.map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers.flatMap((reader, index) =>
      JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
    ),
    changedReaderIndexes,
  );
  assert.deepEqual(
    changedReaderIndexes.map((index) => current.readers[index]),
    [
      {
        task: "M07-T01",
        role: "root-test",
        path: "tests/control-plane-bundle-store.test.mjs",
        bytes: 12822,
        sha256: "6dc372192d6f07b00841068425cbb67708b8d468041e0bc7061e87e2c2c134f1",
      },
      {
        task: "M07-T02",
        role: "root-test",
        path: "tests/control-plane-bundle-verification.test.mjs",
        bytes: 6588,
        sha256: "03d6be297479e118eb959f9a5f2f4348fd07f66f16fb85220f4db336dd8cb75d",
      },
      {
        task: "M07-T03",
        role: "root-test",
        path: "tests/control-plane-package-preflight.test.mjs",
        bytes: 6558,
        sha256: "3a836ceefb654b44b7b9c7ad86b518ce36d1ce30e4a486fb99d5bd8c156cec5f",
      },
      {
        task: "M07-T04",
        role: "root-test",
        path: "tests/control-plane-reference-preflight.test.mjs",
        bytes: 6605,
        sha256: "55c5ad298c144f60ad52737cd683e37d04d2d86c5c10f4e469242c4af571ec6a",
      },
      {
        task: "M07-T05",
        role: "root-test",
        path: "tests/control-plane-local-api.test.mjs",
        bytes: 6356,
        sha256: "b75186bb3c6a01fe4928d52c286a3eaf6f03ea2a5395fe3a8dd686e4c43b4849",
      },
      {
        task: "M07-T09",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-fault-injection-proof.mjs",
        bytes: 66581,
        sha256: "c071f7c65fdea9dfbbfc98e2a010d9eace05019eac81bb78dc852c2be999c932",
      },
      {
        task: "M07-T10",
        role: "proof-library",
        path: "scripts/lib/control-plane-runtime-transition-races-proof.mjs",
        bytes: 69040,
        sha256: "af8792cdca54005d50270f4f9261ed0b2df766b3a91a6142104e80cd1cdc153e",
      },
    ],
  );

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
  );
});

test("sequence twenty-nine reseals the M07-T01 gate reader, appends M08-T01, and preserves other authority", () => {
  const previous = baselineManifest.checkpoints[27];
  const current = baselineManifest.checkpoints[28];

  assert.equal(current.sequence, 29);
  assert.equal(
    current.predecessorSha256,
    "2577962251a9e6fa86993bd0e8bda1ed901f850a3b93678486c0445aed035546",
  );
  assert.deepEqual(current.artifacts.slice(0, 25), previous.artifacts);
  assert.deepEqual(
    current.readers
      .slice(0, 50)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [15],
  );
  assert.deepEqual(current.readers[15], {
    task: "M07-T01",
    role: "root-test",
    path: "tests/control-plane-bundle-store.test.mjs",
    bytes: 13558,
    sha256: "e4b1f457067a3b94f3f3e5bd5e663445d5450d414f9369279afd320e503af9b1",
  });
  assert.deepEqual(current.artifacts[25], {
    task: "M08-T01",
    path: "docs/proof/artifacts/editor-core-0.1.0-source-document.json",
    bytes: 23270,
    sha256: "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
  });
  assert.deepEqual(current.readers.slice(50), [
    {
      task: "M08-T01",
      role: "proof-library",
      path: "scripts/lib/editor-core-source-document-proof.mjs",
      bytes: 103051,
      sha256: "e26c6e6fbc757202e2ab476120921df0eb4e5f5b611d24db7e130a2f6d92af9f",
    },
    {
      task: "M08-T01",
      role: "root-test",
      path: "tests/editor-core-source-document.test.mjs",
      bytes: 42244,
      sha256: "e791be0263f0bb4c0cec9016fe68a0dee0cda43e9f7b8260f2fc098948e6d7f7",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b",
  );
});

test("sequence thirty reseals M08-T01 and appends the exact M08-T02 generation", () => {
  const previous = baselineManifest.checkpoints[28];
  const current = baselineManifest.checkpoints[29];

  assert.equal(current.sequence, 30);
  assert.equal(
    current.predecessorSha256,
    "ccd4a58913585da39e71ea360714c69e70a94188e0b5643e521d61bf246f1a2b",
  );
  assert.deepEqual(current.artifacts.slice(0, 26), previous.artifacts);
  assert.deepEqual(
    current.readers
      .slice(0, 52)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51],
  );
  assert.deepEqual(current.artifacts[26], {
    task: "M08-T02",
    path: "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
    bytes: 19561,
    sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
  });
  assert.deepEqual(current.readers.slice(50), [
    {
      task: "M08-T01",
      role: "proof-library",
      path: "scripts/lib/editor-core-source-document-proof.mjs",
      bytes: 107394,
      sha256: "e90cccecb57059ed08ea7c20cb0d148440120342836d96637ee475b8da27164b",
    },
    {
      task: "M08-T01",
      role: "root-test",
      path: "tests/editor-core-source-document.test.mjs",
      bytes: 42979,
      sha256: "af28ef3688d8c8a8f15f00a245ae7e9ce7516321a9b673dc9a00a9b14fab167c",
    },
    {
      task: "M08-T02",
      role: "proof-library",
      path: "scripts/lib/editor-core-stable-id-insert-proof.mjs",
      bytes: 49645,
      sha256: "d93cdc588917cf4e8cf84cd127647adc45eba51338e00a2fa6b8876e15800924",
    },
    {
      task: "M08-T02",
      role: "root-test",
      path: "tests/editor-core-stable-id-insert.test.mjs",
      bytes: 13912,
      sha256: "ec96a5cef73849e514e161beb10301d0c81274e4fc9412661099d2025ad925c4",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970",
  );
});

test("sequence thirty-one reseals the current editor readers, appends M08-T03, and authenticates every live authority", async () => {
  const previous = baselineManifest.checkpoints[29];
  const current = baselineManifest.checkpoints[30];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 31);
  assert.equal(
    current.predecessorSha256,
    "f5598749a14e7d5eed27cb07e92a83f2bec28b5404f4480600e687d960f04970",
  );
  assert.deepEqual(current.artifacts.slice(0, 27), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 54).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 54)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53],
  );
  assert.deepEqual(current.artifacts[27], {
    task: "M08-T03",
    path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
    bytes: 22402,
    sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
  });
  assert.deepEqual(current.readers.slice(50), [
    {
      task: "M08-T01",
      role: "proof-library",
      path: "scripts/lib/editor-core-source-document-proof.mjs",
      bytes: 111699,
      sha256: "2c07689d534865b64d65c8e8a16182d06844149ea6193224d8c2d447721dc826",
    },
    {
      task: "M08-T01",
      role: "root-test",
      path: "tests/editor-core-source-document.test.mjs",
      bytes: 43879,
      sha256: "af876f849d16931cddb93296fb30f0512af1e232dde7c9df32d1f893fce88f8b",
    },
    {
      task: "M08-T02",
      role: "proof-library",
      path: "scripts/lib/editor-core-stable-id-insert-proof.mjs",
      bytes: 61944,
      sha256: "8eb99abb35534f088c621c03d8ff5b2e7c70be7e00d7a19d337304db26108299",
    },
    {
      task: "M08-T02",
      role: "root-test",
      path: "tests/editor-core-stable-id-insert.test.mjs",
      bytes: 16615,
      sha256: "4a2cf3453bacef58018817d95fdedeb9d50ceb82351a487deee8cba7c4741047",
    },
    {
      task: "M08-T03",
      role: "proof-library",
      path: "scripts/lib/editor-core-structural-edits-proof.mjs",
      bytes: 66472,
      sha256: "44a9f3dfd8bf7c3aba9231b7bceb05ac49acc45d2bbd124b7f9188eb8a8f4bcd",
    },
    {
      task: "M08-T03",
      role: "root-test",
      path: "tests/editor-core-structural-edits.test.mjs",
      bytes: 15979,
      sha256: "ddcdc15db6798d63d15515ac1c6eae716117dc8e60322af734f476c979f79952",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d",
  );
});

test("sequence thirty-two reseals every current editor reader and appends exact M08-T04 authority", async () => {
  const previous = baselineManifest.checkpoints[30];
  const current = baselineManifest.checkpoints[31];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 32);
  assert.equal(
    current.predecessorSha256,
    "181d5a1e0c012f53cfe02640c2f8d0ddf1e300090a3c3742882bb3722175e42d",
  );
  assert.deepEqual(current.artifacts.slice(0, 28), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 56).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 56)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 55],
  );
  assert.deepEqual(current.artifacts[28], {
    task: "M08-T04",
    path: "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
    bytes: 26988,
    sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
  });
  assert.deepEqual(current.readers.slice(50), [
    {
      task: "M08-T01",
      role: "proof-library",
      path: "scripts/lib/editor-core-source-document-proof.mjs",
      bytes: 116583,
      sha256: "b31b51102e43b287829a030c20bca6bc89fe83f624243274cf31300ebf56f5a6",
    },
    {
      task: "M08-T01",
      role: "root-test",
      path: "tests/editor-core-source-document.test.mjs",
      bytes: 45549,
      sha256: "48e8235c564fcd4b5c70c5e8d3be5fe2189affc22d3662a6eb9c777a3c1e3177",
    },
    {
      task: "M08-T02",
      role: "proof-library",
      path: "scripts/lib/editor-core-stable-id-insert-proof.mjs",
      bytes: 68939,
      sha256: "b6b78f626b6dd787a68d87da3e24b048527dd53ad50c0c5593a72102567f3ac6",
    },
    {
      task: "M08-T02",
      role: "root-test",
      path: "tests/editor-core-stable-id-insert.test.mjs",
      bytes: 18945,
      sha256: "9eef9869781e52de646fe1460d19ee3e928a005605284ac1e05ec9eddaeb137f",
    },
    {
      task: "M08-T03",
      role: "proof-library",
      path: "scripts/lib/editor-core-structural-edits-proof.mjs",
      bytes: 76807,
      sha256: "37c6f891d5836513330ea9a98e82c807e9a673d3be63da139c0709a1d5c7921d",
    },
    {
      task: "M08-T03",
      role: "root-test",
      path: "tests/editor-core-structural-edits.test.mjs",
      bytes: 16939,
      sha256: "3f4d39056671e16e892451ab654c96c38509c5b39a7259ca70c68dfa0287df25",
    },
    {
      task: "M08-T04",
      role: "proof-library",
      path: "scripts/lib/editor-core-content-edits-proof.mjs",
      bytes: 79063,
      sha256: "fcbab15b0ba9ba086f6ddb431fb8f0319208783760e3c00eecce4e9952353a71",
    },
    {
      task: "M08-T04",
      role: "root-test",
      path: "tests/editor-core-content-edits.test.mjs",
      bytes: 21923,
      sha256: "1857b5bd7b033b5721202f6f68989c9e2cd4183c4d580b1de1d3408edb432e3e",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424",
  );
});

test("sequence thirty-three reseals affected editor readers and appends exact M08-T05 authority", () => {
  const previous = baselineManifest.checkpoints[31];
  const current = baselineManifest.checkpoints[32];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 33);
  assert.equal(
    current.predecessorSha256,
    "9be019b902ee17a57c9e2f13270fa67fe26265d06e360719bd1542643be6a424",
  );
  assert.deepEqual(current.artifacts.slice(0, 29), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 58).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 58)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 56],
  );
  assert.deepEqual(current.artifacts[29], {
    task: "M08-T05",
    path: "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
    bytes: 30014,
    sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
  });
  assert.deepEqual(current.readers.slice(58), [
    {
      task: "M08-T05",
      role: "proof-library",
      path: "scripts/lib/editor-core-state-binding-edits-proof.mjs",
      bytes: 82175,
      sha256: "6f238144f8bf793f02aec25117406fb28c2ecf44b01579a7d4ae68cf6ebfce86",
    },
    {
      task: "M08-T05",
      role: "root-test",
      path: "tests/editor-core-state-binding-edits.test.mjs",
      bytes: 23903,
      sha256: "6c888764911696a8c81476bac516fed3b43fd96362353d3b0fbe37582dba8510",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871",
  );
});

test("sequence thirty-four reseals affected editor readers and appends exact M08-T06 authority", () => {
  const previous = baselineManifest.checkpoints[32];
  const current = baselineManifest.checkpoints[33];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 34);
  assert.equal(
    current.predecessorSha256,
    "64da5390046020ed223da42ce8a24d9fcf971c6a5a0a92fc49d368586414c871",
  );
  assert.deepEqual(current.artifacts.slice(0, 30), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 60).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 60)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 56, 58],
  );
  assert.deepEqual(current.artifacts[30], {
    task: "M08-T06",
    path: "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
    bytes: 31310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
  });
  assert.deepEqual(current.readers.slice(60), [
    {
      task: "M08-T06",
      role: "proof-library",
      path: "scripts/lib/editor-core-event-action-edits-proof.mjs",
      bytes: 87454,
      sha256: "78763fc9bad87f8b92615d0c2d67471ee293980dece87dd33046154f45ed4ef0",
    },
    {
      task: "M08-T06",
      role: "root-test",
      path: "tests/editor-core-event-action-edits.test.mjs",
      bytes: 23211,
      sha256: "21e6e15c9aff17ab13e2e071588c1b83928effb0338be5ad51e5d28e31ef5ec8",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674",
  );
});

test("sequence thirty-five reseals editor successors and appends exact M08-T07 authority", () => {
  const previous = baselineManifest.checkpoints[33];
  const current = baselineManifest.checkpoints[34];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 35);
  assert.equal(
    current.predecessorSha256,
    "f641e8d20d0f5e94cca809d330e3ad5bb0d7ffe0c3ec5defc14e0b5fca63b674",
  );
  assert.deepEqual(current.artifacts.slice(0, 31), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 62).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 62)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61],
  );
  assert.deepEqual(current.artifacts[31], {
    task: "M08-T07",
    path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    bytes: 62304,
    sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
  });
  assert.deepEqual(current.readers.slice(62), [
    {
      task: "M08-T07",
      role: "proof-library",
      path: "scripts/lib/editor-core-authoring-round-trip-proof.mjs",
      bytes: 123915,
      sha256: "2ecb5023b7a74ec74ffabd0fbd5f19df4a818fefda7c3edf992ffac368c6df76",
    },
    {
      task: "M08-T07",
      role: "root-test",
      path: "tests/editor-core-authoring-round-trip.test.mjs",
      bytes: 18354,
      sha256: "6b8aeec27c99a6c598037553af9c6da211c85c6f28cedd3a24adbf288765f387",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3",
  );
});

test("sequence thirty-six reseals all editor readers and appends exact M08-T08 authority", async () => {
  const previous = baselineManifest.checkpoints[34];
  const current = baselineManifest.checkpoints[35];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 36);
  assert.equal(
    current.predecessorSha256,
    "a2e3ef962ed37e0570cdddef64ae8d0eef2fd3f298cc2580f7ee65d8200f6fa3",
  );
  assert.deepEqual(current.artifacts.slice(0, 32), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 64).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 64)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63],
  );
  assert.deepEqual(current.artifacts[32], {
    task: "M08-T08",
    path: "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
    bytes: 49785,
    sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
  });
  assert.deepEqual(current.readers.slice(64), [
    {
      task: "M08-T08",
      role: "proof-library",
      path: "scripts/lib/editor-core-persistence-proof.mjs",
      bytes: 49754,
      sha256: "29b7a9fe341a8acd1fdf32b0448a8b9a3ef83962594e7089a2a6217e18952da8",
    },
    {
      task: "M08-T08",
      role: "root-test",
      path: "tests/editor-core-persistence.test.mjs",
      bytes: 12150,
      sha256: "d0685565ed364f26f62d30ef3025144bb9b228d6f0e3403ba82a05677912fc79",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82",
  );

  const artifactMutation = cloneBaseline();
  artifactMutation.checkpoints[35].artifacts[32].bytes += 1;
  assert.throws(
    () => calculateProofReaderCheckpointSha256(artifactMutation.checkpoints[35]),
    checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
  );

  const readerMutation = cloneBaseline();
  changedReaderReceipt(readerMutation.checkpoints[35].readers[65], "M08-T08-reader-tamper");
  readerMutation.headSha256 = calculateProofReaderCheckpointSha256(readerMutation.checkpoints[35]);
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(readerMutation)),
    checkpointError("PROOF_READER_CHECKPOINT_CHAIN_DRIFT"),
  );
});

test("sequence thirty-seven reseals all changed editor readers and appends exact M08-T09 authority", () => {
  const previous = baselineManifest.checkpoints[35];
  const current = baselineManifest.checkpoints[36];
  const identity = ({ task, role, path: authorityPath }) => ({
    task,
    role,
    path: authorityPath,
  });

  assert.equal(current.sequence, 37);
  assert.equal(
    current.predecessorSha256,
    "4f351f2f535b1fc335876160256a42b1d53c7c7f43db08e0b86bf50c389d1e82",
  );
  assert.deepEqual(current.artifacts.slice(0, 33), previous.artifacts);
  assert.deepEqual(current.readers.slice(0, 66).map(identity), previous.readers.map(identity));
  assert.deepEqual(
    current.readers
      .slice(0, 66)
      .flatMap((reader, index) =>
        JSON.stringify(reader) === JSON.stringify(previous.readers[index]) ? [] : [index],
      ),
    [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65],
  );
  assert.deepEqual(current.artifacts[33], {
    task: "M08-T09",
    path: "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json",
    bytes: 40099,
    sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
  });
  assert.deepEqual(current.readers.slice(64), [
    {
      task: "M08-T08",
      role: "proof-library",
      path: "scripts/lib/editor-core-persistence-proof.mjs",
      bytes: 67829,
      sha256: "baf53c20f0aeac9296a7df819f78f7b85eb4a8106f47e5a471f4f6a30dfc4b7b",
    },
    {
      task: "M08-T08",
      role: "root-test",
      path: "tests/editor-core-persistence.test.mjs",
      bytes: 16483,
      sha256: "c8b270ca9fb35a82f117ba5f551b52a458a92f59ead41575281c54a320d00389",
    },
    {
      task: "M08-T09",
      role: "proof-library",
      path: "scripts/lib/editor-core-continuous-validation-proof.mjs",
      bytes: 62890,
      sha256: "f3b27812aae9b3e4a3d74ccb9cda7aac7749c560257f33003eb66d5041dd1b5f",
    },
    {
      task: "M08-T09",
      role: "root-test",
      path: "tests/editor-core-continuous-validation.test.mjs",
      bytes: 10840,
      sha256: "f1b415d0dc41f755649f1ddd345ba1454e8695b9971e0afbc4032fc7d348d2b5",
    },
  ]);

  assert.equal(
    calculateProofReaderCheckpointSha256(current),
    "e43b48e2d4873b9212d4d0b1bf3e6fb03f56fcc350f8bc9ad65409891995c310",
  );

  const readerMutation = cloneBaseline();
  changedReaderReceipt(readerMutation.checkpoints[36].readers[67], "M08-T09-reader-tamper");
  readerMutation.checkpoints = readerMutation.checkpoints.slice(0, 37);
  readerMutation.headSha256 = calculateProofReaderCheckpointSha256(readerMutation.checkpoints[36]);
  assert.throws(
    () => validateProofReaderCheckpointBytes(canonicalBytes(readerMutation)),
    checkpointError("PROOF_READER_CHECKPOINT_HISTORY_UNANCHORED"),
  );
});

test("the genesis cannot be rewritten and reheaded as a different history", () => {
  const rewritten = cloneBaseline();
  changedReaderReceipt(rewritten.checkpoints[0].readers[0], "rewritten-genesis");
  reheadFrom(rewritten, 0);

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
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 18),
    },
    {
      checkpoint: baselineManifest.checkpoints[21],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 18),
    },
    {
      checkpoint: baselineManifest.checkpoints[22],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 19),
    },
    {
      checkpoint: baselineManifest.checkpoints[23],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 20),
    },
    {
      checkpoint: baselineManifest.checkpoints[24],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 25),
    },
    {
      checkpoint: baselineManifest.checkpoints[28],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 26),
    },
    {
      checkpoint: baselineManifest.checkpoints[29],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 27),
    },
    {
      checkpoint: baselineManifest.checkpoints[30],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 28),
    },
    {
      checkpoint: baselineManifest.checkpoints[31],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 29),
    },
    {
      checkpoint: baselineManifest.checkpoints[32],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 30),
    },
    {
      checkpoint: baselineManifest.checkpoints[33],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 31),
    },
    {
      checkpoint: baselineManifest.checkpoints[34],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 32),
    },
    {
      checkpoint: baselineManifest.checkpoints[35],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 33),
    },
    {
      checkpoint: baselineManifest.checkpoints[36],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 34),
    },
    {
      checkpoint: baselineManifest.checkpoints[37],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 35),
    },
    {
      checkpoint: baselineManifest.checkpoints[39],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 36),
    },
    {
      checkpoint: baselineManifest.checkpoints[40],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 37),
    },
    {
      checkpoint: baselineManifest.checkpoints[41],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 38),
    },
    {
      checkpoint: baselineManifest.checkpoints[42],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 39),
    },
    {
      checkpoint: baselineManifest.checkpoints[43],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 40),
    },
    {
      checkpoint: baselineManifest.checkpoints[44],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 41),
    },
    {
      checkpoint: baselineManifest.checkpoints[45],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 42),
    },
    {
      checkpoint: baselineManifest.checkpoints[46],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 43),
    },
    {
      checkpoint: baselineManifest.checkpoints[47],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 44),
    },
    {
      checkpoint: baselineManifest.checkpoints[48],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 45),
    },
    {
      checkpoint: baselineManifest.checkpoints[49],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 46),
    },
    {
      checkpoint: baselineManifest.checkpoints[50],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 47),
    },
    {
      checkpoint: baselineManifest.checkpoints[51],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 48),
    },
    {
      checkpoint: baselineManifest.checkpoints[52],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 49),
    },
    {
      checkpoint: baselineManifest.checkpoints[56],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 50),
    },
    {
      checkpoint: baselineManifest.checkpoints[57],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 51),
    },
    {
      checkpoint: baselineManifest.checkpoints[58],
      authority: PROOF_READER_CHECKPOINT_TASK_AUTHORITY.slice(0, 51),
    },
    {
      checkpoint: baselineManifest.checkpoints[59],
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
  assert.equal(PROOF_READER_CHECKPOINT_TASK_AUTHORITY.length, 52);
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
  await assert.rejects(
    verifyProofReaderCheckpoints({ beforeAuthorityOpen: {} }),
    checkpointError("PROOF_READER_CHECKPOINT_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyProofReaderCheckpoints({ beforeAuthorityOpen: new Proxy(() => undefined, {}) }),
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
  wrongSequence.checkpoints.at(-1).sequence += 1;
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

test("one changed reader is a valid review candidate while one hundred three peers remain unchanged", () => {
  const manifest = cloneBaseline();
  const reviewedReaders = structuredClone(manifest.checkpoints.at(-1).readers);
  const successor = appendSuccessor(manifest, (checkpoint) => {
    changedReaderReceipt(checkpoint.readers[0], "successor");
  });

  const candidate = validateProofReaderCheckpointAppendCandidateBytes(canonicalBytes(manifest));
  assert.deepEqual(candidate, {
    status: "REVIEW_REQUIRED",
    profile: "desen.ci.proof-reader-checkpoints.v1",
    anchoredCheckpoints: 62,
    candidateSequence: 63,
    predecessorSha256: baselineManifest.headSha256,
    candidateSha256: manifest.headSha256,
  });
  assert.equal(successor.sequence, 63);
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
  reheadFrom(manifest, 0);
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

test("central historical reader returns the exact checkpoint-owned task artifact", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const expected = baselineManifest.checkpoints.at(-1).artifacts[0];
  try {
    const result = await readCheckpointedFrozenArtifact(expected.task, {
      workspaceRoot: temporaryRoot,
      checkpointBytes: baselineBytes,
    });
    assert.deepEqual(
      {
        task: result.task,
        path: result.path,
        byteLength: result.byteLength,
        sha256: result.sha256,
        checkpointHeadSha256: result.checkpointHeadSha256,
      },
      {
        task: expected.task,
        path: expected.path,
        byteLength: expected.bytes,
        sha256: expected.sha256,
        checkpointHeadSha256: baselineManifest.headSha256,
      },
    );
    assert.equal(createHash("sha256").update(result.bytes).digest("hex"), expected.sha256);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("central historical reader rejects unknown and duplicated task identity", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  try {
    await assert.rejects(
      readCheckpointedFrozenArtifact("M99-T99", {
        workspaceRoot: temporaryRoot,
        checkpointBytes: baselineBytes,
      }),
      checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_IDENTITY_DRIFT"),
    );

    const duplicated = cloneBaseline();
    duplicated.checkpoints.at(-1).artifacts[1].task =
      duplicated.checkpoints.at(-1).artifacts[0].task;
    assert.throws(
      () => calculateProofReaderCheckpointSha256(duplicated.checkpoints.at(-1)),
      checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
    );
    await assert.rejects(
      readCheckpointedFrozenArtifact(duplicated.checkpoints.at(-1).artifacts[0].task, {
        workspaceRoot: temporaryRoot,
        checkpointBytes: Buffer.from(`${JSON.stringify(duplicated, null, 2)}\n`),
      }),
      checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("central historical reader binds one artifact read to the checkpoint receipt", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const expected = baselineManifest.checkpoints.at(-1).artifacts[0];
  try {
    const artifactPath = path.join(temporaryRoot, expected.path);
    const bytes = await readFile(artifactPath);
    bytes[Math.floor(bytes.length / 2)] ^= 1;
    await writeFile(artifactPath, bytes);
    await assert.rejects(
      readCheckpointedFrozenArtifact(expected.task, {
        workspaceRoot: temporaryRoot,
        checkpointBytes: baselineBytes,
      }),
      checkpointError("PROOF_READER_CHECKPOINT_ARTIFACT_DRIFT"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("central historical reader rejects authority-parent rename to an outside symlink", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const outside = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-reader-parent-outside-")),
  );
  const expected = baselineManifest.checkpoints.at(-1).artifacts[0];
  const parentPath = path.dirname(path.join(temporaryRoot, expected.path));
  const displacedParent = path.join(outside, "reviewed-parent");
  let swapped = false;
  try {
    await assert.rejects(
      readCheckpointedFrozenArtifact(expected.task, {
        workspaceRoot: temporaryRoot,
        checkpointBytes: baselineBytes,
        beforeAuthorityOpen: async ({ relativePath }) => {
          if (relativePath !== expected.path || swapped) return;
          swapped = true;
          await rename(parentPath, displacedParent);
          await symlink(displacedParent, parentPath, "dir");
        },
      }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
    assert.equal(swapped, true);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("central historical reader rejects workspace-root rename to an outside symlink", async () => {
  const temporaryRoot = await materializeAuthorityWorkspace();
  const displacedRoot = `${temporaryRoot}-reviewed`;
  const expected = baselineManifest.checkpoints.at(-1).artifacts[0];
  let swapped = false;
  try {
    await assert.rejects(
      readCheckpointedFrozenArtifact(expected.task, {
        workspaceRoot: temporaryRoot,
        checkpointBytes: baselineBytes,
        beforeAuthorityOpen: async ({ relativePath }) => {
          if (relativePath !== expected.path || swapped) return;
          swapped = true;
          await rename(temporaryRoot, displacedRoot);
          await symlink(displacedRoot, temporaryRoot, "dir");
        },
      }),
      checkpointError("PROOF_READER_CHECKPOINT_FILE_UNSAFE"),
    );
    assert.equal(swapped, true);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
    await rm(displacedRoot, { recursive: true, force: true });
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
