import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactReconciliationDiagnosticsEvidenceError,
  buildRuntimeReactReconciliationDiagnosticsEvidence,
  verifyRuntimeReactReconciliationDiagnosticsEvidence,
  writeRuntimeReactReconciliationDiagnosticsEvidence,
} from "../scripts/lib/runtime-react-reconciliation-diagnostics-proof.mjs";

const HISTORICAL_SHA256 = "292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb";
const HISTORICAL_BYTES = 19_234;
const SUCCESSOR_SHA256 = "261b820b381a0d0c8005a7baf85e33464f2558bfa2a263b94dcb6fd28ddd38ff";
const SUCCESSOR_ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/publisher-0.1.0-source-preservation.json";
const LATEST_SUCCESSOR_SHA256 = "59cb08f75849ae4831644e746a72186227a9774ceb7bcd8281156ccbc6dd085e";
const LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/publisher-0.1.0-source-normalization.json";
const SUCCESSOR_EVIDENCE_TEXT =
  "M06-T06 completes the Publisher preservation slice with unchanged prepared behavior and one complete bounded five-string component-node trace.";
const LATEST_SUCCESSOR_EVIDENCE_TEXT =
  "M06-T07 carries that exact behavior and every trace record unchanged through digest calculation, root-authoring removal, and deterministic normalization; exact pointers remain resolvable in the normalized document and no extension or authoring node gains trace authority.";
const ARTIFACT_FILE_NAME = "runtime-react-0.1.0-reconciliation-diagnostics.json";
const ARTIFACT_RELATIVE_PATH = `docs/proof/artifacts/${ARTIFACT_FILE_NAME}`;
const ARTIFACT_URL = new URL(`../${ARTIFACT_RELATIVE_PATH}`, import.meta.url);
const PROOF_URL = new URL(
  "../docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md",
  import.meta.url,
);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);
const NORMATIVE_URL = new URL("../docs/proof/NORMATIVE-COVERAGE.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactReconciliationDiagnosticsEvidenceError);
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
  const indexes = lines.flatMap((line, index) => (line.startsWith(`| ${id} `) ? [index] : []));
  assert.equal(indexes.length, 1);
  lines[indexes[0]] = replace(lines[indexes[0]]);
  return lines.join("\n");
}

function replaceExactOnce(text, search, replacement) {
  assert.equal(text.split(search).length - 1, 1);
  return text.replace(search, replacement);
}

test("accepts immutable task-time M05-T05 reconciliation and diagnostic evidence", async () => {
  const result = await verifyRuntimeReactReconciliationDiagnosticsEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    artifactBytes: HISTORICAL_BYTES,
    compatibilityMode: "immutable-task-time-artifact",
    trackedFiles: 29,
    runtimeExports: 10,
    typeExports: 51,
    sourceDeclarations: 67,
    tsdocDeclarations: 67,
    packageTests: 53,
    compilerNegativeCases: 26,
    rootMutationCases: 35,
    p16Status: "PARTIAL",
    n021HistoricalStatus: "PLANNED",
    n021CurrentStatus: "TESTED",
    n021SuccessorArtifactSha256: SUCCESSOR_SHA256,
    n021LatestArtifactSha256: LATEST_SUCCESSOR_SHA256,
    exactDocumentationReferences: 4,
    exactSuccessorDocumentationReferences: 2,
  });
});

test("two independent historical reads preserve exact bytes and recursively frozen semantics", async () => {
  const first = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  const second = await buildRuntimeReactReconciliationDiagnosticsEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.artifactBytes.length, HISTORICAL_BYTES);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T05");
  assert.equal(first.artifact.claim.committedAdapterErrorBoundaryImplemented, false);
  assert.equal(first.artifact.diagnostics.recursivelyImmutable, true);
  assert.equal(first.artifact.evidence.tests.rootMutationCases, 35);
  assert.equal(first.artifact.evidence.traceability.normative.currentStatus, "PLANNED");
  assert.equal(first.artifact.evidence.traceability.normative.remainingOwner, "M06-T06");
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.claim), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects one-byte and byte-length task-time artifact tampering", async () => {
  const original = await readFile(ARTIFACT_URL);
  const tampered = Buffer.from(original);
  tampered[Math.floor(tampered.length / 2)] ^= 1;
  await assert.rejects(
    buildRuntimeReactReconciliationDiagnosticsEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_HISTORICAL_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeReactReconciliationDiagnosticsEvidence({
      artifactBytes: original.subarray(0, original.length - 1),
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, build, prerequisite, and pending-pin injection", async () => {
  for (const options of [
    { workspaceRoot: "." },
    { fileOverrides: {} },
    { prerequisiteBytes: {} },
    { runtimeApi: {} },
    { runtimeApis: {} },
    { preparedEvidence: {} },
    { build: () => undefined },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence(options),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor, inherited, symbol, non-enumerable, Proxy, and hostile byte inputs", async () => {
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
      buildRuntimeReactReconciliationDiagnosticsEvidence(options),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
    );
  }

  class Uint8ArraySubclass extends Uint8Array {}
  for (const artifactBytes of [
    "not-bytes",
    new Uint8Array(new SharedArrayBuffer(HISTORICAL_BYTES)),
    new Proxy(Buffer.alloc(HISTORICAL_BYTES), {}),
    new Uint8ArraySubclass(HISTORICAL_BYTES),
  ]) {
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({ artifactBytes }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects ambiguous source options and unbounded documentation", async () => {
  const bytes = await readFile(ARTIFACT_URL);
  await assert.rejects(
    buildRuntimeReactReconciliationDiagnosticsEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactReconciliationDiagnosticsEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeReactReconciliationDiagnosticsEvidence({
      proofDocumentText: "x".repeat(500_001),
    }),
    hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched proof and M05-T05 section pins", async () => {
  const texts = await proofTexts();
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved artifact"),
    `${texts.proofDocumentText}\n\`${ARTIFACT_RELATIVE_PATH}\`\n\`sha256:${HISTORICAL_SHA256}\`\n`,
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
  ]) {
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        ...texts,
        proofDocumentText,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    );
  }
  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T05", "## Moved M05-T05"),
    texts.proofMatrixText.replace(
      `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
      `\`evil/${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_SHA256}\`.`,
    ),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "f".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        ...texts,
        proofMatrixText,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects regressed P-16 authority or N-021 monotonic successor-closure drift", async () => {
  const texts = await proofTexts();
  for (const proofMatrixText of [
    replaceRow(texts.proofMatrixText, "P-16", (row) =>
      replaceExactOnce(row, "| PROVEN         |", "| NOT_PROVEN     |"),
    ),
    replaceRow(texts.proofMatrixText, "P-16", (row) => row.replace("M05-T05", "M05-T99")),
    replaceRow(texts.proofMatrixText, "P-16", (row) =>
      row.replace(HISTORICAL_SHA256, "a".repeat(64)),
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        ...texts,
        proofMatrixText,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    );
  }
  for (const normativeCoverageText of [
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, "| TESTED      |", "| PLANNED     |"),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, "| TESTED      |", "| UNKNOWN     |"),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, "M05-T05, M06-T06–M06-T07", "M05-T05, M06-T06–M06-T99"),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, "M05-T05, M06-T06–M06-T07", "M05-T99, M06-T06–M06-T07"),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, HISTORICAL_SHA256, "b".repeat(64)),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, SUCCESSOR_SHA256, "c".repeat(64)),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(
        row,
        SUCCESSOR_ARTIFACT_RELATIVE_PATH,
        `moved/${SUCCESSOR_ARTIFACT_RELATIVE_PATH}`,
      ),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, SUCCESSOR_EVIDENCE_TEXT, ""),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, LATEST_SUCCESSOR_SHA256, "d".repeat(64)),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(
        row,
        LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH,
        `moved/${LATEST_SUCCESSOR_ARTIFACT_RELATIVE_PATH}`,
      ),
    ),
    replaceRow(texts.normativeCoverageText, "N-021", (row) =>
      replaceExactOnce(row, LATEST_SUCCESSOR_EVIDENCE_TEXT, ""),
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({
        ...texts,
        normativeCoverageText,
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects symlink artifact and proof-document inputs", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t05-symlink-"));
  try {
    const artifactLink = path.join(temporary, ARTIFACT_FILE_NAME);
    const proofLink = path.join(temporary, "proof.md");
    await symlink(ARTIFACT_URL.pathname, artifactLink);
    await symlink(PROOF_URL.pathname, proofLink);
    await assert.rejects(
      buildRuntimeReactReconciliationDiagnosticsEvidence({ artifactPath: artifactLink }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE"),
    );
    await assert.rejects(
      verifyRuntimeReactReconciliationDiagnosticsEvidence({ proofPath: proofLink }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_PROOF_UNSAFE"),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("default writer is a true no-op and alternate destination is an exact atomic copy", async () => {
  const before = await stat(ARTIFACT_URL);
  const result = await writeRuntimeReactReconciliationDiagnosticsEvidence();
  const after = await stat(ARTIFACT_URL);
  assert.equal(result.preserved, true);
  assert.equal(before.ino, after.ino);
  assert.equal(before.mtimeMs, after.mtimeMs);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t05-copy-"));
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const copied = await writeRuntimeReactReconciliationDiagnosticsEvidence({
      artifactPath: destination,
    });
    assert.equal(copied.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
    assert.equal((await lstat(destination)).isFile(), true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("temporary-byte tampering fails atomically without replacing the destination", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "desen-t05-atomic-"));
  try {
    const destination = path.join(temporary, ARTIFACT_FILE_NAME);
    const originalDestination = Buffer.from("preserve-me");
    await writeFile(destination, originalDestination);
    await assert.rejects(
      writeRuntimeReactReconciliationDiagnosticsEvidence({
        artifactPath: destination,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "tampered");
        },
      }),
      hasEvidenceCode("RECONCILIATION_DIAGNOSTICS_ARTIFACT_UNSAFE"),
    );
    assert.deepEqual(await readFile(destination), originalDestination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
