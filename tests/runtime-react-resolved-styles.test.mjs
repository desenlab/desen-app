import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactResolvedStylesEvidenceError,
  buildRuntimeReactResolvedStylesEvidence,
  verifyRuntimeReactResolvedStylesEvidence,
  writeRuntimeReactResolvedStylesEvidence,
} from "../scripts/lib/runtime-react-resolved-styles-proof.mjs";

const HISTORICAL_SHA256 = "2b0e03e58116d161484cd3c309370ff1ee5003ee6158d4e941749faf0d6797eb";
const ARTIFACT_URL = new URL(
  "../docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json",
  import.meta.url,
);
const PROOF_URL = new URL("../docs/proof/RUNTIME-REACT-RESOLVED-STYLES.md", import.meta.url);
const MATRIX_URL = new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url);

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactResolvedStylesEvidenceError);
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

test("accepts the immutable task-time M05-T03 semantic-style evidence", async () => {
  const result = await verifyRuntimeReactResolvedStylesEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 5,
    typeExports: 31,
    sourceDeclarations: 38,
    tsdocDeclarations: 38,
    trackedFiles: 55,
    failureCodes: 22,
    runtimeReactTests: 8,
    validatorStyleTests: 3,
    compilerNegativeCases: 15,
    rootMutationTests: 18,
  });
});

test("two independent historical compatibility builds preserve exact bytes and semantics", async () => {
  const first = await buildRuntimeReactResolvedStylesEvidence();
  const second = await buildRuntimeReactResolvedStylesEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T03");
  assert.equal(first.artifact.claim.resolvedStyleReceivingBoundary, true);
  assert.equal(first.artifact.claim.stateActivationOwner, "capability-adapter");
  assert.equal(first.artifact.semanticStyle.invalidStyleDeliveredToAdapter, false);
});

test("rejects one-byte task-time artifact tampering", async () => {
  const tampered = Buffer.from(await readFile(ARTIFACT_URL));
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactResolvedStylesEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("RESOLVED_STYLES_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, build, prerequisite, or pending-pin build injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApis: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeReactResolvedStylesEvidence(options),
      hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor source, runtime, build, or prerequisite verifier injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApis: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { buildOptions: {} },
  ]) {
    await assert.rejects(
      verifyRuntimeReactResolvedStylesEvidence(options),
      hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
    );
  }
});

test("rejects successor build and prerequisite writer injection", async () => {
  for (const options of [{ fileOverrides: {} }, { prerequisiteBytes: {} }, { buildOptions: {} }]) {
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence(options),
      hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
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
      buildRuntimeReactResolvedStylesEvidence(options),
      hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects non-Buffer artifact bytes and Proxy atomic hooks", async () => {
  await assert.rejects(
    buildRuntimeReactResolvedStylesEvidence({ artifactBytes: "{}" }),
    hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
  );
  await assert.rejects(
    writeRuntimeReactResolvedStylesEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    hasEvidenceCode("RESOLVED_STYLES_OPTIONS_INVALID"),
  );
});

test("rejects moved, duplicated, pending, or mismatched proof pins", async () => {
  const texts = await proofTexts();
  for (const proofDocumentText of [
    texts.proofDocumentText.replace("## Evidence artifact", "## Moved artifact"),
    `${texts.proofDocumentText}\n\`docs/proof/artifacts/runtime-react-0.1.0-resolved-styles.json\`\n`,
    texts.proofDocumentText.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    texts.proofDocumentText.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactResolvedStylesEvidence({
        proofDocumentText,
        proofMatrixText: texts.proofMatrixText,
      }),
      hasEvidenceCode("RESOLVED_STYLES_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched Proof Matrix pins", async () => {
  const texts = await proofTexts();
  for (const proofMatrixText of [
    texts.proofMatrixText.replace("## M05-T03", "## Moved M05-T03"),
    `${texts.proofMatrixText}\n\`runtime-react-0.1.0-resolved-styles.json\`\n`,
    texts.proofMatrixText.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    texts.proofMatrixText.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactResolvedStylesEvidence({
        proofDocumentText: texts.proofDocumentText,
        proofMatrixText,
      }),
      hasEvidenceCode("RESOLVED_STYLES_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink proof-document source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-proof-"));
  const target = path.join(directory, "proof.md");
  const source = path.join(directory, "proof-link.md");
  try {
    await writeFile(target, await readFile(PROOF_URL));
    await symlink(target, source);
    await assert.rejects(
      verifyRuntimeReactResolvedStylesEvidence({ proofPath: source }),
      hasEvidenceCode("RESOLVED_STYLES_PROOF_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a symlink Proof Matrix source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-matrix-"));
  const target = path.join(directory, "matrix.md");
  const source = path.join(directory, "matrix-link.md");
  try {
    await writeFile(target, await readFile(MATRIX_URL));
    await symlink(target, source);
    await assert.rejects(
      verifyRuntimeReactResolvedStylesEvidence({ proofMatrixPath: source }),
      hasEvidenceCode("RESOLVED_STYLES_PROOF_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a symlink task-time artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, await readFile(ARTIFACT_URL));
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactResolvedStylesEvidence({ artifactPath: source }),
      hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence({ artifactPath: destination }),
      hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RESOLVED_STYLES_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer preserves exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    const written = await writeRuntimeReactResolvedStylesEvidence({ artifactPath: destination });
    const rebuilt = await buildRuntimeReactResolvedStylesEvidence({ artifactPath: destination });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
    assert.deepEqual(await readFile(destination), await readFile(ARTIFACT_URL));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("default compatibility write is a no-op and never invokes the atomic hook", async () => {
  let renameAttempted = false;
  const preserved = await writeRuntimeReactResolvedStylesEvidence({
    async beforeAtomicRename() {
      renameAttempted = true;
    },
  });
  assert.equal(preserved.preserved, true);
  assert.equal(preserved.artifactSha256, HISTORICAL_SHA256);
  assert.equal(renameAttempted, false);
});

test("writer rejects a tampered source before creating a destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t03-write-"));
  const source = path.join(directory, "source.json");
  const destination = path.join(directory, "destination.json");
  const tampered = Buffer.from(await readFile(ARTIFACT_URL));
  tampered[0] ^= 1;
  try {
    await writeFile(source, tampered);
    await assert.rejects(
      writeRuntimeReactResolvedStylesEvidence({
        sourceArtifactPath: source,
        artifactPath: destination,
      }),
      hasEvidenceCode("RESOLVED_STYLES_HISTORICAL_ARTIFACT_DRIFT"),
    );
    await assert.rejects(readFile(destination));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
