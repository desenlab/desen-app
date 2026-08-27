import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactInteractionsEvidenceError,
  buildRuntimeReactInteractionsEvidence,
  verifyRuntimeReactInteractionsEvidence,
  writeRuntimeReactInteractionsEvidence,
} from "../scripts/lib/runtime-react-interactions-proof.mjs";

const HISTORICAL_SHA256 = "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0";
const HISTORICAL_BYTES = 52_430;
const PENDING_SHA256 = "[PENDING_FINAL_ARTIFACT_SHA256]";
const ARTIFACT_FILE_NAME = "runtime-react-0.1.0-interactions.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const ARTIFACT_URL = new URL(`../${ARTIFACT_RELATIVE_PATH}`, import.meta.url);
const PROOF_URL = new URL("../docs/proof/RUNTIME-REACT-INTERACTIONS.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const NORMATIVE_URL = new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactInteractionsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function proofTexts() {
  const [proofDocumentText, proofMatrixText, normativeCoverageText] = await Promise.all([
    readFile(PROOF_URL, "utf8"),
    readFile(MATRIX_URL, "utf8"),
    readFile(NORMATIVE_URL, "utf8"),
  ]);
  return { proofDocumentText, proofMatrixText, normativeCoverageText };
}

function replaceRow(markdown, id, replace) {
  const lines = markdown.split("\n");
  const indexes = lines.flatMap((line, index) => (line.startsWith(`| ${id} |`) ? [index] : []));
  assert.equal(indexes.length, 1);
  lines[indexes[0]] = replace(lines[indexes[0]]);
  return lines.join("\n");
}

function replaceExactOnce(text, search, replacement) {
  assert.equal(text.split(search).length - 1, 1);
  return text.replace(search, replacement);
}

function withLedgerStatus(row, status) {
  return row.replace(/\| (?:NOT_PROVEN|PARTIAL|PROVEN|UNKNOWN)\s+\|/u, `| ${status.padEnd(15)}|`);
}

function readLedgerStatus(markdown, id) {
  const row = markdown.split("\n").filter((line) => line.startsWith(`| ${id} |`));
  assert.equal(row.length, 1);
  return row[0]
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim())[3];
}

test("accepts immutable task-time M05-T04 interaction evidence and root mutation coverage", async () => {
  const texts = await proofTexts();
  const result = await verifyRuntimeReactInteractionsEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    artifactBytes: HISTORICAL_BYTES,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 5,
    typeExports: 31,
    runtimeReactDeclarations: 11,
    runtimeReactExecutedCases: 23,
    referenceAdapterTests: 10,
    runtimeCoreCommandTests: 5,
    compilerNegativeCases: 20,
    rootMutationTests: 18,
    trackedFiles: 114,
    compatibilityPaths: 28,
    p06CurrentStatus: readLedgerStatus(texts.proofMatrixText, "P-06"),
    normativeStatus: "N-034:TESTED",
    exactDocumentationReferences: 5,
  });
});

test("two independent historical builds preserve exact bytes and recursively frozen semantics", async () => {
  const first = await buildRuntimeReactInteractionsEvidence();
  const second = await buildRuntimeReactInteractionsEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifactBytes.length, HISTORICAL_BYTES);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T04");
  assert.equal(first.artifact.claim.interactionAuthorityCommitScoped, true);
  assert.equal(first.artifact.referenceAdapters.dynamicExecutableLoading, false);
  assert.equal(first.artifact.evidence.tests.rootMutationTests, 18);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.evidence), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
  assert.equal(Object.isFrozen(first.artifact.successorPackage.entries[0]), true);
});

test("rejects one-byte and byte-length task-time artifact tampering", async () => {
  const original = await readFile(ARTIFACT_URL);
  const tampered = Buffer.from(original);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("INTERACTIONS_HISTORICAL_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      artifactBytes: original.subarray(0, original.length - 1),
    }),
    hasEvidenceCode("INTERACTIONS_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, file override, runtime, prerequisite, and build injection", async () => {
  for (const options of [
    { sourceFiles: {} },
    { fileOverrides: {} },
    { runtimeApi: {} },
    { runtimeApis: {} },
    { referencePackageApi: {} },
    { prerequisiteBytes: {} },
    { prerequisiteResults: {} },
    { preparedEvidence: {} },
    { build: () => undefined },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence(options),
      hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor verifier injection", async () => {
  for (const options of [
    { sourceFiles: {} },
    { fileOverrides: {} },
    { runtimeApis: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { build: () => undefined },
    { buildOptions: {} },
  ]) {
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence(options),
      hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor writer injection", async () => {
  for (const options of [
    { sourceFiles: {} },
    { fileOverrides: {} },
    { runtimeApis: {} },
    { prerequisiteBytes: {} },
    { build: () => undefined },
    { buildOptions: {} },
  ]) {
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence(options),
      hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
    );
  }
});

test("rejects ambiguous artifact byte and source path options", async () => {
  const bytes = await readFile(ARTIFACT_URL);
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactInteractionsEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
});

test("rejects accessor, inherited, symbol, non-enumerable, and Proxy options without hooks", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = Object.defineProperty({}, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const inherited = Object.create({ artifactPath: "ignored" });
  const symbol = { [Symbol("artifactPath")]: "ignored" };
  const nonEnumerable = Object.defineProperty({}, "artifactPath", {
    enumerable: false,
    value: "ignored",
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();

  for (const options of [accessor, inherited, symbol, nonEnumerable, proxy, revoked.proxy]) {
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence(options),
      hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects hostile bytes, values, callbacks, and unbounded injected documentation", async () => {
  class Uint8ArraySubclass extends Uint8Array {}
  const sharedBytes = new Uint8Array(new SharedArrayBuffer(HISTORICAL_BYTES));
  const proxiedBytes = new Proxy(Buffer.alloc(HISTORICAL_BYTES), {});
  for (const artifactBytes of [
    "{}",
    sharedBytes,
    proxiedBytes,
    new Uint8ArraySubclass(HISTORICAL_BYTES),
  ]) {
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence({ artifactBytes }),
      hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    buildRuntimeReactInteractionsEvidence({ artifactPath: "" }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactInteractionsEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({ proofDocumentText: "x".repeat(500_001) }),
    hasEvidenceCode("INTERACTIONS_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched proof-document pins", async () => {
  const texts = await proofTexts();
  const pathLine = `\`${ARTIFACT_RELATIVE_PATH}\``;
  const shaLine = `\`sha256:${HISTORICAL_SHA256}\`.`;
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved artifact"),
    texts.proofDocumentText.replace(ARTIFACT_RELATIVE_PATH, `evil/${ARTIFACT_RELATIVE_PATH}`),
    `${texts.proofDocumentText}\n${pathLine}\n${shaLine}\n`,
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, PENDING_SHA256),
  ]) {
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        proofDocumentText,
        proofMatrixText: texts.proofMatrixText,
        normativeCoverageText: texts.normativeCoverageText,
      }),
      hasEvidenceCode("INTERACTIONS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched M05-T04 Proof Matrix pins", async () => {
  const texts = await proofTexts();
  const pathLine = `\`${ARTIFACT_FILE_NAME}\``;
  const shaLine = `\`sha256:${HISTORICAL_SHA256}\`.`;
  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T04", "## Moved M05-T04"),
    texts.proofMatrixText.replace(
      `\n${pathLine}\n${shaLine}`,
      `\n\`evil/${ARTIFACT_FILE_NAME}\`\n${shaLine}`,
    ),
    `${texts.proofMatrixText}\n${pathLine}\n${shaLine}\n`,
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, PENDING_SHA256),
  ]) {
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText,
        normativeCoverageText: texts.normativeCoverageText,
      }),
      hasEvidenceCode("INTERACTIONS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects P-05 or P-06 task-time authority drift", async () => {
  const texts = await proofTexts();
  const partialProofMatrixText = replaceRow(texts.proofMatrixText, "P-06", (row) =>
    withLedgerStatus(row, "PARTIAL"),
  );
  const provenProofMatrixText = replaceRow(texts.proofMatrixText, "P-06", (row) =>
    withLedgerStatus(row, "PROVEN"),
  );
  const [partialCompatibility, provenCompatibility] = await Promise.all([
    verifyRuntimeReactInteractionsEvidence({
      proofDocumentText: texts.proofDocumentText,
      proofMatrixText: partialProofMatrixText,
      normativeCoverageText: texts.normativeCoverageText,
    }),
    verifyRuntimeReactInteractionsEvidence({
      proofDocumentText: texts.proofDocumentText,
      proofMatrixText: provenProofMatrixText,
      normativeCoverageText: texts.normativeCoverageText,
    }),
  ]);
  assert.equal(partialCompatibility.p06CurrentStatus, "PARTIAL");
  assert.equal(provenCompatibility.p06CurrentStatus, "PROVEN");
  assert.equal(partialCompatibility.artifactSha256, HISTORICAL_SHA256);
  assert.equal(provenCompatibility.artifactSha256, HISTORICAL_SHA256);

  const variants = [
    replaceRow(texts.proofMatrixText, "P-05", (row) =>
      row.replace(`\`${ARTIFACT_FILE_NAME}\``, `\`evil/${ARTIFACT_FILE_NAME}\``),
    ),
    replaceRow(texts.proofMatrixText, "P-05", (row) =>
      replaceExactOnce(row, "| PROVEN         |", "| UNKNOWN        |"),
    ),
    replaceRow(texts.proofMatrixText, "P-05", (row) =>
      replaceExactOnce(
        row,
        "M03-T04, M03-T10, M05-T04, M06-T08, M07-T03",
        "M03-T04, M03-T10, M05-T99, M06-T08, M07-T03",
      ),
    ),
    replaceRow(texts.proofMatrixText, "P-06", (row) =>
      row.replace(HISTORICAL_SHA256, "f".repeat(64)),
    ),
    replaceRow(texts.proofMatrixText, "P-06", (row) => row.replace("M05-T04", "M05-T99")),
    replaceRow(texts.proofMatrixText, "P-06", (row) => withLedgerStatus(row, "NOT_PROVEN")),
    replaceRow(texts.proofMatrixText, "P-06", (row) => withLedgerStatus(row, "UNKNOWN")),
    replaceRow(texts.proofMatrixText, "P-06", (row) => withLedgerStatus(row, "toString")),
  ];
  for (const proofMatrixText of variants) {
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText,
        normativeCoverageText: texts.normativeCoverageText,
      }),
      hasEvidenceCode("INTERACTIONS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects N-033 artifact pin or N-033/N-034 task-time status drift", async () => {
  const texts = await proofTexts();
  const variants = [
    replaceRow(texts.normativeCoverageText, "N-033", (row) =>
      row.replace(`\`${ARTIFACT_RELATIVE_PATH}\``, `\`evil/${ARTIFACT_RELATIVE_PATH}\``),
    ),
    replaceRow(texts.normativeCoverageText, "N-033", (row) =>
      row.replace("| TESTED ", "| PLANNED"),
    ),
    replaceRow(texts.normativeCoverageText, "N-033", (row) =>
      row.replace(HISTORICAL_SHA256, "a".repeat(64)),
    ),
    replaceRow(texts.normativeCoverageText, "N-034", (row) =>
      row.replace("| TESTED ", "| PLANNED"),
    ),
    replaceRow(texts.normativeCoverageText, "N-034", (row) =>
      row.replace("TextField `focus`", "TextField `blur`"),
    ),
  ];
  for (const normativeCoverageText of variants) {
    await assert.rejects(
      verifyRuntimeReactInteractionsEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText: texts.proofMatrixText,
        normativeCoverageText,
      }),
      hasEvidenceCode("INTERACTIONS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects an otherwise valid-looking sixth cross-document artifact reference", async () => {
  const texts = await proofTexts();
  await assert.rejects(
    verifyRuntimeReactInteractionsEvidence({
      proofDocumentText: `${texts.proofDocumentText}\nHistorical duplicate ${ARTIFACT_FILE_NAME} sha256:${HISTORICAL_SHA256}\n`,
      proofMatrixText: texts.proofMatrixText,
      normativeCoverageText: texts.normativeCoverageText,
    }),
    hasEvidenceCode("INTERACTIONS_PROOF_PIN_DRIFT"),
  );
});

for (const [label, option, sourceUrl] of [
  ["proof document", "proofPath", PROOF_URL],
  ["Proof Matrix", "proofMatrixPath", MATRIX_URL],
  ["Normative Coverage", "normativeCoveragePath", NORMATIVE_URL],
]) {
  test(`rejects a symlink ${label} source`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-proof-"));
    const target = path.join(directory, "target.md");
    const source = path.join(directory, "source.md");
    try {
      await writeFile(target, await readFile(sourceUrl));
      await symlink(target, source);
      await assert.rejects(
        verifyRuntimeReactInteractionsEvidence({ [option]: source }),
        hasEvidenceCode("INTERACTIONS_PROOF_UNSAFE"),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("rejects a symlink task-time artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, await readFile(ARTIFACT_URL));
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactInteractionsEvidence({ artifactPath: source }),
      hasEvidenceCode("INTERACTIONS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence({ artifactPath: destination }),
      hasEvidenceCode("INTERACTIONS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("INTERACTIONS_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(readFile(destination));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer preserves exact historical bytes at an alternate path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    const written = await writeRuntimeReactInteractionsEvidence({ artifactPath: destination });
    const rebuilt = await buildRuntimeReactInteractionsEvidence({ artifactPath: destination });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("default compatibility writer is a byte- and inode-preserving no-op", async () => {
  const beforeEntry = await lstat(ARTIFACT_URL, { bigint: true });
  const beforeBytes = await readFile(ARTIFACT_URL);
  let renameAttempted = false;
  const preserved = await writeRuntimeReactInteractionsEvidence({
    async beforeAtomicRename() {
      renameAttempted = true;
    },
  });
  const afterEntry = await lstat(ARTIFACT_URL, { bigint: true });
  const afterBytes = await readFile(ARTIFACT_URL);

  assert.equal(preserved.preserved, true);
  assert.equal(preserved.artifactSha256, HISTORICAL_SHA256);
  assert.equal(renameAttempted, false);
  assert.equal(afterEntry.dev, beforeEntry.dev);
  assert.equal(afterEntry.ino, beforeEntry.ino);
  assert.equal(afterEntry.size, beforeEntry.size);
  assert.equal(afterEntry.mtimeNs, beforeEntry.mtimeNs);
  assert.deepEqual(afterBytes, beforeBytes);
});

test("writer rejects a tampered source before creating a destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t04-write-"));
  const source = path.join(directory, "source.json");
  const destination = path.join(directory, "destination.json");
  const tampered = Buffer.from(await readFile(ARTIFACT_URL));
  tampered[0] ^= 1;
  try {
    await writeFile(source, tampered);
    await assert.rejects(
      writeRuntimeReactInteractionsEvidence({
        sourceArtifactPath: source,
        artifactPath: destination,
      }),
      hasEvidenceCode("INTERACTIONS_HISTORICAL_ARTIFACT_DRIFT"),
    );
    await assert.rejects(readFile(destination));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
