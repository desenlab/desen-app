import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeCoreAuditHardeningEvidenceError,
  buildRuntimeCoreAuditHardeningEvidence,
  verifyRuntimeCoreAuditHardeningEvidence,
  writeRuntimeCoreAuditHardeningEvidence,
} from "../scripts/lib/runtime-core-audit-hardening-proof.mjs";

const HISTORICAL_SHA256 = "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeCoreAuditHardeningEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts immutable task-time M04-T17/G04 audit-hardening evidence", async () => {
  const result = await verifyRuntimeCoreAuditHardeningEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    trackedFiles: 21,
    rootMutationTests: 13,
    focusedTests: 77,
    compilerNegativeCases: 14,
    publicRuntimeExports: 2,
    publicTypeExports: 4,
    internalModuleExports: 3,
    normativeCorrections: 2,
    compatibilityMode: "immutable-task-time-artifact",
  });
});

test("two independent historical audit builds preserve exact bytes and migration inventory", async () => {
  const first = await buildRuntimeCoreAuditHardeningEvidence();
  const second = await buildRuntimeCoreAuditHardeningEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M04-T17");
  assert.equal(first.artifact.gate, "G04");
  assert.equal(first.artifact.migration.finding.sha256, second.artifact.migration.finding.sha256);
  assert.equal(first.artifact.migration.transferredOwnership.length, 11);
});

test("rejects one-byte task-time audit artifact tampering", async () => {
  const pristine = await readFile(
    new URL("../docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json", import.meta.url),
  );
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeCoreAuditHardeningEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("AUDIT_HISTORICAL_ARTIFACT_DRIFT"),
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
      buildRuntimeCoreAuditHardeningEvidence(options),
      hasEvidenceCode("AUDIT_OPTIONS_INVALID"),
    );
  }
});

test("rejects accessor, inherited, symbol, and Proxy audit options without invoking hooks", async () => {
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
      buildRuntimeCoreAuditHardeningEvidence(options),
      hasEvidenceCode("AUDIT_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects moved, duplicated, pending, or mismatched audit proof pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofDocumentText of [
    proof.replace("## Evidence artifact", "## Moved evidence artifact"),
    `${proof}\n\`docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json\`\n`,
    proof.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    proof.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreAuditHardeningEvidence({
        proofDocumentText,
        proofMatrixText: matrix,
      }),
      hasEvidenceCode("AUDIT_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched audit Proof Matrix pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofMatrixText of [
    matrix.replace("## M04-T17 / G04 audit hardening", "## Moved M04-T17 / G04 audit hardening"),
    `${matrix}\n\`docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json\`\n`,
    matrix.replace(HISTORICAL_SHA256, "[PENDING_FINAL_ARTIFACT_SHA256]"),
    matrix.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeCoreAuditHardeningEvidence({
        proofDocumentText: proof,
        proofMatrixText,
      }),
      hasEvidenceCode("AUDIT_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink task-time audit artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t17-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeCoreAuditHardeningEvidence({ artifactPath: source }),
      hasEvidenceCode("AUDIT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic audit compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t17-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeCoreAuditHardeningEvidence({ artifactPath: destination }),
      hasEvidenceCode("AUDIT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic audit compatibility writer rejects temporary-byte tampering", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t17-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeCoreAuditHardeningEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("AUDIT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic audit compatibility writer preserves exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-core-t17-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    let defaultRenameAttempted = false;
    const preserved = await writeRuntimeCoreAuditHardeningEvidence({
      async beforeAtomicRename() {
        defaultRenameAttempted = true;
      },
    });
    assert.equal(preserved.preserved, true);
    assert.equal(defaultRenameAttempted, false);

    const written = await writeRuntimeCoreAuditHardeningEvidence({
      artifactPath: destination,
    });
    const rebuilt = await buildRuntimeCoreAuditHardeningEvidence({
      artifactPath: destination,
    });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
