import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  RuntimeReactResolvedPropsSlotsEvidenceError,
  buildRuntimeReactResolvedPropsSlotsEvidence,
  verifyRuntimeReactResolvedPropsSlotsEvidence,
  writeRuntimeReactResolvedPropsSlotsEvidence,
} from "../scripts/lib/runtime-react-resolved-props-slots-proof.mjs";

const HISTORICAL_SHA256 = "f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0";

function hasEvidenceCode(expectedCode) {
  return (error) => {
    assert.ok(error instanceof RuntimeReactResolvedPropsSlotsEvidenceError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("accepts the immutable task-time M05-T02 resolved-props and slots evidence", async () => {
  const result = await verifyRuntimeReactResolvedPropsSlotsEvidence();
  assert.deepEqual(result, {
    result: "PASS",
    artifactSha256: HISTORICAL_SHA256,
    compatibilityMode: "immutable-task-time-artifact",
    runtimeExports: 5,
    typeExports: 29,
    sourceDeclarations: 36,
    tsdocDeclarations: 36,
    trackedFiles: 109,
    failureCodes: 20,
    packageTests: 38,
    compilerNegativeCases: 33,
    rootMutationTests: 14,
  });
});

test("two independent historical compatibility builds preserve exact bytes", async () => {
  const first = await buildRuntimeReactResolvedPropsSlotsEvidence();
  const second = await buildRuntimeReactResolvedPropsSlotsEvidence();
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifact.task, "M05-T02");
  assert.equal(first.artifact.claim.resolvedPropsReceivingBoundary, true);
  assert.equal(first.artifact.namedSlots.fallbackGuessing, 0);
});

test("rejects one-byte task-time artifact tampering", async () => {
  const pristine = await readFile(
    new URL(
      "../docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json",
      import.meta.url,
    ),
  );
  const tampered = Buffer.from(pristine);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    buildRuntimeReactResolvedPropsSlotsEvidence({ artifactBytes: tampered }),
    hasEvidenceCode("RESOLVED_PROPS_SLOTS_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects successor source, runtime, prerequisite, or pending-pin injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { runtimeApis: {} },
    { prerequisiteBytes: {} },
    { preparedEvidence: {} },
    { buildOptions: {} },
    { allowPendingArtifactReference: true },
  ]) {
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence(options),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_OPTIONS_INVALID"),
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
      buildRuntimeReactResolvedPropsSlotsEvidence(options),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects moved, duplicated, pending, or mismatched proof pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-REACT-RESOLVED-PROPS-SLOTS.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofDocumentText of [
    proof.replace("## Evidence artifact", "## Moved artifact"),
    `${proof}\n\`docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json\`\n`,
    proof.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    proof.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactResolvedPropsSlotsEvidence({
        proofDocumentText,
        proofMatrixText: matrix,
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects moved, duplicated, pending, or mismatched Proof Matrix pins", async () => {
  const proof = await readFile(
    new URL("../docs/proof/RUNTIME-REACT-RESOLVED-PROPS-SLOTS.md", import.meta.url),
    "utf8",
  );
  const matrix = await readFile(new URL("../docs/proof/PROOF-MATRIX.md", import.meta.url), "utf8");
  for (const proofMatrixText of [
    matrix.replace("## M05-T02", "## Moved M05-T02"),
    `${matrix}\n\`runtime-react-0.1.0-resolved-props-slots.json\`\n`,
    matrix.replace(`sha256:${HISTORICAL_SHA256}`, "sha256:PENDING"),
    matrix.replace(HISTORICAL_SHA256, "0".repeat(64)),
  ]) {
    await assert.rejects(
      verifyRuntimeReactResolvedPropsSlotsEvidence({
        proofDocumentText: proof,
        proofMatrixText,
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_PROOF_PIN_DRIFT"),
    );
  }
});

test("rejects a symlink task-time artifact source", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-source-"));
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeReactResolvedPropsSlotsEvidence({ artifactPath: source }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects an existing symlink destination", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-write-"));
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeReactResolvedPropsSlotsEvidence({ artifactPath: destination }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer rejects temporary-byte tampering before rename", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    await assert.rejects(
      writeRuntimeReactResolvedPropsSlotsEvidence({
        artifactPath: destination,
        async beforeAtomicRename({ temporaryPath }) {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      hasEvidenceCode("RESOLVED_PROPS_SLOTS_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic compatibility writer preserves exact historical bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-react-t02-write-"));
  const destination = path.join(directory, "artifact.json");
  try {
    let defaultRenameAttempted = false;
    const preserved = await writeRuntimeReactResolvedPropsSlotsEvidence({
      async beforeAtomicRename() {
        defaultRenameAttempted = true;
      },
    });
    assert.equal(preserved.preserved, true);
    assert.equal(defaultRenameAttempted, false);

    const written = await writeRuntimeReactResolvedPropsSlotsEvidence({
      artifactPath: destination,
    });
    const rebuilt = await buildRuntimeReactResolvedPropsSlotsEvidence({
      artifactPath: destination,
    });
    assert.equal(written.artifactSha256, HISTORICAL_SHA256);
    assert.equal(rebuilt.artifactSha256, HISTORICAL_SHA256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
