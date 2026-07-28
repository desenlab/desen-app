import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreReactiveReevaluationEvidenceError,
  buildRuntimeCoreReactiveReevaluationEvidence,
  verifyRuntimeCoreReactiveReevaluationEvidence,
  writeRuntimeCoreReactiveReevaluationEvidence,
} from "../scripts/lib/runtime-core-reactive-reevaluation-proof.mjs";

const HISTORICAL_SHA256 = "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67";
const ARTIFACT_URL = new URL(
  "../docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json",
  import.meta.url,
);
const PROOF_URL = new URL("../docs/proof/RUNTIME-CORE-REACTIVE-REEVALUATION.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreReactiveReevaluationEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

async function proofTexts() {
  const [proofDocumentText, proofMatrixText] = await Promise.all([
    readFile(PROOF_URL, "utf8"),
    readFile(MATRIX_URL, "utf8"),
  ]);
  return { proofDocumentText, proofMatrixText };
}

test("accepts immutable task-time M04-T15 reactive reevaluation evidence", async () => {
  const result = await verifyRuntimeCoreReactiveReevaluationEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 6,
    typeExports: 17,
    moduleExports: 24,
    tsdocDeclarations: 24,
    focusedTests: 54,
    compilerNegativeCases: 11,
    rootMutationTests: 30,
    trackedFiles: 17,
    traceRules: 6,
    evaluatorAuthorityLeaks: 0,
    requestLeaks: 0,
    platformEffects: 0,
  });
});

test("two independent historical reactive builds preserve exact bytes and semantics", async () => {
  const first = await buildRuntimeCoreReactiveReevaluationEvidence();
  const second = await buildRuntimeCoreReactiveReevaluationEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M04-T15");
  assert.equal(first.artifact.claim.target, "platform-neutral");
  assert.equal(first.artifact.evidence.rootMutationTests, 30);
  assert.equal(first.artifact.runtime.evaluatorAuthorityLeaks, 0);
  assert.equal(Object.isFrozen(first.artifact), true);
  assert.equal(Object.isFrozen(first.artifact.evidence), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles), true);
  assert.equal(Object.isFrozen(first.artifact.evidence.trackedFiles[0]), true);
});

test("rejects one-byte task-time reactive artifact tampering", async () => {
  const tampered = Buffer.from(await readFile(ARTIFACT_URL));
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeCoreReactiveReevaluationEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("REACTIVE_HISTORICAL_ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildRuntimeCoreReactiveReevaluationEvidence({
      artifactBytes: tampered.subarray(0, tampered.length - 1),
    }),
    hasEvidenceCode("REACTIVE_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, prerequisite, probe, or build injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApi: {} },
    { validatorApi: {} },
    { runtimeApis: {} },
    { runtimeProbe: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeCoreReactiveReevaluationEvidence(options),
      hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor build or prerequisite verifier injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApi: {} },
    { prerequisiteBytes: {} },
    { buildOptions: {} },
    { preparedEvidence: {} },
  ]) {
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence(options),
      hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor build and prerequisite writer injection", async () => {
  for (const options of [{ fileOverrides: {} }, { prerequisiteBytes: {} }, { buildOptions: {} }]) {
    await assert.rejects(
      writeRuntimeCoreReactiveReevaluationEvidence(options),
      hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
    );
  }
});

test("rejects ambiguous artifact byte and source path options", async () => {
  const bytes = await readFile(ARTIFACT_URL);
  await assert.rejects(
    buildRuntimeCoreReactiveReevaluationEvidence({
      artifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeCoreReactiveReevaluationEvidence({
      sourceArtifactPath: ARTIFACT_URL.pathname,
      artifactBytes: bytes,
    }),
    hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
  );
});

test("rejects accessor, inherited, symbol, and Proxy options without invoking hooks", async () => {
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
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
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
  for (const options of [accessor, inherited, symbol, proxy, revoked.proxy]) {
    await assert.rejects(
      buildRuntimeCoreReactiveReevaluationEvidence(options),
      hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("captures exact Buffer or Uint8Array bytes and rejects hostile byte views or hooks", async () => {
  const artifactBytes = await readFile(ARTIFACT_URL);
  const fromUint8Array = await buildRuntimeCoreReactiveReevaluationEvidence({
    artifactBytes: new Uint8Array(artifactBytes),
  });
  assert.equal(fromUint8Array.artifactSha256, HISTORICAL_SHA256);

  let subclassGetterCalls = 0;
  class HostileBytes extends Uint8Array {
    get byteLength() {
      subclassGetterCalls += 1;
      return super.byteLength;
    }
  }
  const sharedBytes = new Uint8Array(new SharedArrayBuffer(artifactBytes.length));
  sharedBytes.set(artifactBytes);
  for (const artifactBytesInput of [
    "{}",
    new HostileBytes(artifactBytes),
    sharedBytes,
    new Proxy(new Uint8Array(artifactBytes), {}),
  ]) {
    await assert.rejects(
      buildRuntimeCoreReactiveReevaluationEvidence({ artifactBytes: artifactBytesInput }),
      hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
    );
  }
  assert.equal(subclassGetterCalls, 0);
  await assert.rejects(
    verifyRuntimeCoreReactiveReevaluationEvidence({
      proofDocumentText: "x".repeat(500_001),
    }),
    hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeCoreReactiveReevaluationEvidence({
      proofMatrixText: "x".repeat(2_000_001),
    }),
    hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeCoreReactiveReevaluationEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("REACTIVE_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched reactive proof pins", async () => {
  const texts = await proofTexts();
  const exactPath = "`docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json`.";
  const exactSha = `Its SHA-256 is \`${HISTORICAL_SHA256}\`.`;
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence boundary", "## Moved evidence boundary"),
    `${texts.proofDocumentText}\n${exactPath}\n${exactSha}\n`,
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofDocumentText.replace(
      "task-time boundary, `N-003`, `N-034`, and `N-041` were `PLANNED`",
      "task-time boundary, `N-003` and `N-041` were `PLANNED`",
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence({
        proofDocumentText,
        proofMatrixText: texts.proofMatrixText,
      }),
      hasEvidenceCode("REACTIVE_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched reactive Proof Matrix pins", async () => {
  const texts = await proofTexts();
  const exactPair =
    "`runtime-core-0.1.0-reactive-reevaluation.json`\n" + `\`sha256:${HISTORICAL_SHA256}\`.`;
  for (const proofMatrixText of [
    texts.proofMatrixText.replace(
      "M04-T15 defines and proves one platform-neutral reactive publication boundary without changing a",
      "Moved M04-T15 reactive publication boundary",
    ),
    `${texts.proofMatrixText}\n${exactPair}\n`,
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "0".repeat(64)),
    texts.proofMatrixText.replace(
      "N-003, N-034, and N-041 remained\n`PLANNED`",
      "N-003 and N-041 remained\n`PLANNED`",
    ),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText,
      }),
      hasEvidenceCode("REACTIVE_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink reactive proof-document source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-proof-"));
  const target = path.join(directory, "proof.md");
  const source = path.join(directory, "proof-link.md");
  const oversized = path.join(directory, "oversized-proof.md");
  try {
    await writeFile(target, await readFile(PROOF_URL));
    await symlink(target, source);
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence({ proofPath: source }),
      hasEvidenceCode("REACTIVE_PROOF_UNSAFE"),
    );
    await writeFile(oversized, "x".repeat(500_001));
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence({ proofPath: oversized }),
      hasEvidenceCode("REACTIVE_PROOF_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a symlink reactive Proof Matrix source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-matrix-"));
  const target = path.join(directory, "matrix.md");
  const source = path.join(directory, "matrix-link.md");
  try {
    await writeFile(target, await readFile(MATRIX_URL));
    await symlink(target, source);
    await assert.rejects(
      verifyRuntimeCoreReactiveReevaluationEvidence({ proofMatrixPath: source }),
      hasEvidenceCode("REACTIVE_PROOF_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a symlink task-time reactive artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, await readFile(ARTIFACT_URL));
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeCoreReactiveReevaluationEvidence({ artifactPath: source }),
      hasEvidenceCode("REACTIVE_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic reactive compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeCoreReactiveReevaluationEvidence({ artifactPath: destination }),
      hasEvidenceCode("REACTIVE_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic reactive compatibility writer rejects temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeCoreReactiveReevaluationEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("REACTIVE_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic reactive compatibility writer preserves exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    const written = await writeRuntimeCoreReactiveReevaluationEvidence({
      artifactPath: destination,
    });
    const rebuilt = await buildRuntimeCoreReactiveReevaluationEvidence({
      artifactPath: destination,
    });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("default reactive compatibility write is a byte and inode preserving no-op", async () => {
  const before = await lstat(ARTIFACT_URL);
  const beforeBytes = await readFile(ARTIFACT_URL);
  let renameAttempted = false;
  const preserved = await writeRuntimeCoreReactiveReevaluationEvidence({
    async beforeAtomicRename() {
      renameAttempted = true;
    },
  });
  const after = await lstat(ARTIFACT_URL);
  assert.equal(preserved.preserved, true);
  assert.equal(preserved.artifactSha256, HISTORICAL_SHA256);
  assert.equal(renameAttempted, false);
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.deepEqual(await readFile(ARTIFACT_URL), beforeBytes);
});

test("symlink-parent alias to the tracked reactive artifact remains a no-op", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-alias-"));
  const alias = path.join(directory, "artifact-parent");
  const trackedPath = ARTIFACT_URL.pathname;
  try {
    await symlink(path.dirname(trackedPath), alias, "dir");
    const aliasedPath = path.join(alias, path.basename(trackedPath));
    const before = await lstat(ARTIFACT_URL);
    let renameAttempted = false;
    const preserved = await writeRuntimeCoreReactiveReevaluationEvidence({
      artifactPath: aliasedPath,
      async beforeAtomicRename() {
        renameAttempted = true;
      },
    });
    const after = await lstat(ARTIFACT_URL);
    assert.equal(preserved.preserved, true);
    assert.equal(renameAttempted, false);
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeMs, before.mtimeMs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writer rejects a tampered reactive source before creating a destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t15-write-"));
  const source = path.join(directory, "source.json");
  const destination = path.join(directory, "destination.json");
  const tampered = Buffer.from(await readFile(ARTIFACT_URL));
  tampered[0] ^= 1;
  try {
    await writeFile(source, tampered);
    await assert.rejects(
      writeRuntimeCoreReactiveReevaluationEvidence({
        sourceArtifactPath: source,
        artifactPath: destination,
      }),
      hasEvidenceCode("REACTIVE_HISTORICAL_ARTIFACT_DRIFT"),
    );
    await assert.rejects(readFile(destination));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
