import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactAdapterRegistryEvidenceError,
  buildRuntimeReactAdapterRegistryEvidence,
  verifyRuntimeReactAdapterRegistryEvidence,
  writeRuntimeReactAdapterRegistryEvidence,
} from "../scripts/lib/runtime-react-adapter-registry-proof.mjs";

const HISTORICAL_SHA256 = "b2e98f5e54471aa3ec227e672e2fa6b0f90a970b4c48046a0b8a8323f33b6b42";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactAdapterRegistryEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts the immutable task-time M05-T01 adapter-registry evidence", async () => {
  const result = await verifyRuntimeReactAdapterRegistryEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 5,
    typeExports: 28,
    sourceDeclarations: 35,
    tsdocDeclarations: 35,
    packageTests: 10,
    compilerNegativeCases: 4,
    rootMutationTests: 11,
    trackedFiles: 25,
    failureCodes: 12,
  });
});

test("two independent historical compatibility builds are byte-identical", async () => {
  const first = await buildRuntimeReactAdapterRegistryEvidence();
  const second = await buildRuntimeReactAdapterRegistryEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
});

test("rejects one-byte task-time artifact tampering", async () => {
  const pristine = await readFile(
    new URL("../docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json", import.meta.url),
  );
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("RUNTIME_REACT_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects a byte-validity bypass before interpreting historical semantics", async () => {
  const pristine = JSON.parse(
    await readFile(
      new URL("../docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json", import.meta.url),
      "utf8",
    ),
  );
  pristine.claim.unknownCapabilityFallback = true;
  await assert.rejects(
    buildRuntimeReactAdapterRegistryEvidence({
      artifactBytes: Buffer.from(`${JSON.stringify(pristine)}\n`),
    }),
    hasEvidenceCode("RUNTIME_REACT_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, or prerequisite rebuild injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApi: {} },
    { prerequisiteArtifactBytes: Buffer.from("{}") },
    { verifyPrerequisite: false },
    { buildOptions: {} },
  ]) {
    await assert.rejects(
      buildRuntimeReactAdapterRegistryEvidence(options),
      hasEvidenceCode("RUNTIME_REACT_OPTIONS_INVALID"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched proof pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofDocumentText of [
    proof.replace("## Evidence artifact", "## Moved artifact"),
    `${proof}\n\`docs/proof/artifacts/runtime-react-0.1.0-adapter-registry.json\`\n`,
    proof.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    proof.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactAdapterRegistryEvidence({ proofDocumentText, proofMatrixText: matrix }),
      hasEvidenceCode("RUNTIME_REACT_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched Proof Matrix pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-REACT-ADAPTER-REGISTRY.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofMatrixText of [
    matrix.replace("## M05-T01", "## Moved M05-T01"),
    `${matrix}\n\`runtime-react-0.1.0-adapter-registry.json\`\n`,
    matrix.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    matrix.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactAdapterRegistryEvidence({ proofDocumentText: proof, proofMatrixText }),
      hasEvidenceCode("RUNTIME_REACT_PROOF_MATRIX_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink task-time artifact source", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t01-source-"));
  const target = path.join(temporaryDirectory, "target.json");
  const source = path.join(temporaryDirectory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactAdapterRegistryEvidence({ artifactPath: source }),
      hasEvidenceCode("RUNTIME_REACT_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects an existing symlink destination", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t01-write-"));
  const target = path.join(temporaryDirectory, "target.json");
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactAdapterRegistryEvidence({ artifactPath: destination }),
      TypeError,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects temporary-byte tampering before rename", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t01-write-"));
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactAdapterRegistryEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      TypeError,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer preserves exact historical bytes", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t01-write-"));
  const destination = path.join(temporaryDirectory, "artifact.json");
  try {
    let defaultRenameAttempted = false;
    const preserved = await writeRuntimeReactAdapterRegistryEvidence({
      async beforeAtomicRename() {
        defaultRenameAttempted = true;
      },
    });
    assert.equal(preserved.preserved, true);
    assert.equal(defaultRenameAttempted, false);

    const written = await writeRuntimeReactAdapterRegistryEvidence({ artifactPath: destination });
    const rebuilt = await buildRuntimeReactAdapterRegistryEvidence({ artifactPath: destination });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
