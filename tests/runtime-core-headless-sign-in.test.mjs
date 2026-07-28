import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreHeadlessSignInEvidenceError,
  buildRuntimeCoreHeadlessSignInEvidence,
  verifyRuntimeCoreHeadlessSignInEvidence,
  writeRuntimeCoreHeadlessSignInEvidence,
} from "../scripts/lib/runtime-core-headless-sign-in-proof.mjs";

const HISTORICAL_SHA256 = "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreHeadlessSignInEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts immutable task-time M04-T16/G04 headless sign-in evidence", async () => {
  const result = await verifyRuntimeCoreHeadlessSignInEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.runtimeExports, 7);
  assert.equal(result.typeExports, 22);
  assert.equal(result.moduleExports, 35);
  assert.equal(result.tsdocDeclarations, 35);
  assert.equal(result.focusedTests, 34);
  assert.equal(result.compilerNegativeCases, 11);
  assert.equal(result.rootMutationTests, 24);
  assert.equal(result.traceRules, 72);
  assert.equal(result.currentTraceRules, 67);
  assert.equal(result.deferredTraceRules, 5);
  assert.equal(result.trackedFiles, 21);
  assert.equal(result.deterministicRuns, 6);
  assert.equal(result.sessionsPerScenario, 2);
  assert.equal(result.scenarioCount, 3);
  assert.equal(result.traceEntries, 48);
  assert.equal(result.executableValues, 0);
  assert.equal(result.platformValues, 0);
});

test("two independent historical headless builds preserve exact bytes and trace inventory", async () => {
  const first = await buildRuntimeCoreHeadlessSignInEvidence();
  const second = await buildRuntimeCoreHeadlessSignInEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M04-T16");
  assert.equal(first.artifact.gate, "G04");
  assert.equal(first.artifact.runtime.traceSha256, second.artifact.runtime.traceSha256);
  assert.equal(first.artifact.evidence.trackedFiles.length, 21);
});

test("rejects one-byte task-time headless artifact tampering", async () => {
  const pristine = await readFile(
    new URL("../docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json", import.meta.url),
  );
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeCoreHeadlessSignInEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("HEADLESS_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, prerequisite, probe, or build injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApis: {} },
    { runtimeProbe: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeCoreHeadlessSignInEvidence(options),
      hasEvidenceCode("HEADLESS_OPTIONS_INVALID"),
    );
  }
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
  for (const options of [accessor, inherited, symbol, proxy]) {
    await assert.rejects(
      buildRuntimeCoreHeadlessSignInEvidence(options),
      hasEvidenceCode("HEADLESS_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects moved, duplicated, pending, or mismatched headless proof pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-CORE-HEADLESS-SIGN-IN.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofDocumentText of [
    proof.replace("## Evidence boundary", "## Moved evidence boundary"),
    `${proof}\n\`docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json\`\n`,
    proof.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    proof.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreHeadlessSignInEvidence({
        proofDocumentText,
        proofMatrixText: matrix,
      }),
      hasEvidenceCode("HEADLESS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched headless Proof Matrix pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-CORE-HEADLESS-SIGN-IN.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofMatrixText of [
    matrix.replace("## M04-T16 / G04", "## Moved M04-T16 / G04"),
    `${matrix}\n\`runtime-core-0.1.0-headless-sign-in.json\`\n`,
    matrix.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    matrix.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreHeadlessSignInEvidence({
        proofDocumentText: proof,
        proofMatrixText,
      }),
      hasEvidenceCode("HEADLESS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink task-time headless artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t16-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeCoreHeadlessSignInEvidence({ artifactPath: source }),
      hasEvidenceCode("HEADLESS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic headless compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t16-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeCoreHeadlessSignInEvidence({ artifactPath: destination }),
      hasEvidenceCode("HEADLESS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic headless compatibility writer rejects temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t16-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeCoreHeadlessSignInEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("HEADLESS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic headless compatibility writer preserves exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t16-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    let defaultRenameAttempted = false;
    const preserved = await writeRuntimeCoreHeadlessSignInEvidence({
      async beforeAtomicRename() {
        defaultRenameAttempted = true;
      },
    });
    assert.equal(preserved.preserved, true);
    assert.equal(defaultRenameAttempted, false);

    const written = await writeRuntimeCoreHeadlessSignInEvidence({
      artifactPath: destination,
    });
    const rebuilt = await buildRuntimeCoreHeadlessSignInEvidence({
      artifactPath: destination,
    });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
