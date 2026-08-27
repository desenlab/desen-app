import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS,
  EditorCoreContinuousValidationProofError,
  buildEditorCoreContinuousValidationEvidence,
  verifyEditorCoreContinuousValidationEvidence,
  writeEditorCoreContinuousValidationEvidence,
} from "../scripts/lib/editor-core-continuous-validation-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_LIBRARY = "scripts/lib/editor-core-continuous-validation-proof.mjs";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) =>
    error instanceof EditorCoreContinuousValidationProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nStatus: DONE\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`;
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  built = await buildEditorCoreContinuousValidationEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates exact M08-T03 through T07 artifacts and an isolated runtime graph", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-continuous-validation");
  assert.equal(built.artifact.profile, "desen.editor-core.continuous-validation-proof.v1");
  assert.equal(built.artifact.task, "M08-T09");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(
    built.artifact.prerequisites,
    EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map((pin) => ({
      task: pin.task,
      path: pin.path,
      bytes: pin.bytes,
      sha256: pin.sha256,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      liveProofReaderInput: false,
      checkpointHeadInput: false,
    })),
  );
  assert.deepEqual(built.artifact.claim.prerequisiteTasks, [
    "M08-T03",
    "M08-T04",
    "M08-T05",
    "M08-T06",
    "M08-T07",
  ]);
  assert.equal(built.artifact.claim.m08T08FormalPrerequisite, false);
  assert.equal(built.artifact.claim.m08T08CurrentGraphCompatibility, true);
  assert.equal(
    built.artifact.prerequisites.some(({ task }) => task === "M08-T08"),
    false,
  );
  assert.equal(
    built.artifact.executionAuthority.mode,
    "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
  );
  assert.equal(built.artifact.executionAuthority.runtimeFiles, 31);
  assert.equal(built.artifact.executionAuthority.editorFiles, 10);
  assert.equal(built.artifact.executionAuthority.retainedPredecessorEditorFiles, 6);
  assert.equal(built.artifact.executionAuthority.currentNonformalPersistenceEditorFiles, 1);
  assert.equal(built.artifact.executionAuthority.dependencyFiles, 21);
  assert.equal(built.artifact.publicApi.runtimeExports.length, 35);
  assert.equal(built.artifact.publicApi.typeExports.length, 88);
  assert.equal(built.artifact.publicApi.taskRuntimeExportsAdded, 1);
  assert.equal(built.artifact.publicApi.taskTypeExportsAdded, 6);
  assert.equal(built.artifact.publicApi.currentNonformalPersistenceRuntimeExports, 1);
  assert.equal(built.artifact.publicApi.currentNonformalPersistenceTypeExports, 13);
  assert.equal(built.artifact.packageBoundary.platformNeutral, true);
  assert.equal(built.artifact.packageBoundary.currentEmittedFiles, 36);
  assert.equal(built.artifact.packageBoundary.staticEsmEdges, 24);
  assert.equal(built.artifact.packageBoundary.currentNonformalPersistenceModuleAudited, true);
  assert.equal(built.artifact.packageBoundary.nodeImports, 0);
  assert.equal(built.artifact.packageBoundary.reactImports, 0);
  assert.equal(built.artifact.packageBoundary.domImports, 0);
  assert.equal(built.artifact.testAuthority.focusedBehaviorCases, 12);
  assert.equal(built.artifact.testAuthority.focusedCompilerNegativeAssertions, 9);
  assert.equal(built.artifact.testAuthority.persistenceBehaviorCases, 10);
  assert.equal(built.artifact.testAuthority.persistenceCompilerNegativeAssertions, 21);
  assert.equal(built.artifact.testAuthority.publicRuntimeAndRootCases, 50);
  assert.equal(built.artifact.testAuthority.publicCompilerNegativeAssertions, 102);
  assert.equal(built.artifact.trackedBoundary.files, 99);
});

test("[determinism] two fresh M08-T09 builds are byte-identical", async () => {
  const first = await buildEditorCoreContinuousValidationEvidence();
  const second = await buildEditorCoreContinuousValidationEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.match(first.artifactSha256, /^[0-9a-f]{64}$/u);
});

test("[behavior] maps critical subject diagnostics, duplicate occurrences, and controlled unmapped diagnostics", () => {
  const behavior = built.artifact.behavior;
  assert.deepEqual(behavior.criticalSubjectMapping.diagnosticCodes, ["UNKNOWN_CAPABILITY"]);
  assert.deepEqual(behavior.criticalSubjectMapping.invalidSubjects, [
    {
      surfaceId: "sign-in",
      subject: { kind: "node", id: "sign-in.layout" },
      diagnosticIndexes: [0],
      occurrencePointers: ["/surfaces/sign-in/root"],
    },
  ]);
  assert.equal(behavior.criticalSubjectMapping.explicitContextOnly, true);
  assert.equal(behavior.criticalSubjectMapping.pointerInference, false);
  assert.deepEqual(behavior.duplicateOccurrences.mapping.occurrencePointers, [
    "/surfaces/sign-in/root/slots/default/0",
    "/surfaces/sign-in/root/slots/default/1",
  ]);
  assert.equal(behavior.duplicateOccurrences.everyExactOccurrenceReturned, true);
  assert.equal(behavior.multiDiagnosticSubject.mapping.diagnosticIndexes.length > 1, true);
  assert.deepEqual(behavior.controlledUnmapped.invalidSubjects, []);
  assert.deepEqual(behavior.controlledUnmapped.unmappedDiagnosticIndexes, [0]);
  assert.equal(behavior.controlledUnmapped.noPointerGuessing, true);
});

test("[fingerprints] includes authoring in document identity and preserves Catalog order", () => {
  const fingerprints = built.artifact.behavior.fingerprints;
  assert.equal(fingerprints.algorithm, "RFC8785_SHA256");
  assert.equal(fingerprints.authoringSensitiveDocumentFingerprint, true);
  assert.notEqual(
    fingerprints.firstAuthoringDocumentFingerprint,
    fingerprints.secondAuthoringDocumentFingerprint,
  );
  assert.equal(fingerprints.orderSensitiveCatalogSetFingerprint, true);
  assert.notEqual(
    fingerprints.firstCatalogOrderFingerprint,
    fingerprints.secondCatalogOrderFingerprint,
  );
  assert.equal(fingerprints.identicalDocumentAcrossCatalogOrders, true);
});

test("[obligations] preserves dynamic work without turning obligations into invalidity", () => {
  const behavior = built.artifact.behavior;
  assert.equal(behavior.baseline.valid, true);
  assert.equal(behavior.baseline.diagnosticCount, 0);
  assert.equal(behavior.baseline.obligationCount, 7);
  assert.deepEqual(behavior.baseline.obligationKinds, [
    "component-prop",
    "operation-input",
    "state-write",
  ]);
  assert.equal(behavior.baseline.obligationsDoNotCauseInvalidity, true);
  assert.equal(behavior.catalogCapture.malformedCatalogControlled, true);
  assert.equal(behavior.catalogCapture.noPartialValidatorOnFailure, true);
  assert.equal(behavior.catalogCapture.callerMutationDetached, true);
  assert.equal(behavior.catalogCapture.validatorAndReportsRecursivelyFrozen, true);
});

test("[mutation] rejects runtime, tracked-boundary, and prerequisite substitution", async () => {
  await assert.rejects(
    buildEditorCoreContinuousValidationEvidence({ runtime: {} }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );

  const proofLibraryBytes = await readFile(path.join(ROOT, PROOF_LIBRARY));
  await assert.rejects(
    buildEditorCoreContinuousValidationEvidence({
      fileOverrides: new Map([[PROOF_LIBRARY, changedByte(proofLibraryBytes)]]),
    }),
    expectedError("BOUNDARY_DRIFT"),
  );

  const t07 = EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.at(-1);
  const t07Bytes = await readFile(path.join(ROOT, t07.path));
  await assert.rejects(
    buildEditorCoreContinuousValidationEvidence({ t07PrerequisiteBytes: t07Bytes }),
    expectedError("PREREQUISITE_OVERRIDE_REJECTED"),
  );
  await assert.rejects(
    buildEditorCoreContinuousValidationEvidence({
      t07PrerequisiteBytes: changedByte(t07Bytes),
    }),
    expectedError("PREREQUISITE_DRIFT"),
  );
});

test("[verification] rejects artifact and visible proof-pin drift", async () => {
  const proofDocumentBytes = Buffer.from(exactProofDocument(built.artifactSha256));
  const verified = await verifyEditorCoreContinuousValidationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.deepEqual(verified.prerequisiteTasks, [
    "M08-T03",
    "M08-T04",
    "M08-T05",
    "M08-T06",
    "M08-T07",
  ]);
  assert.equal(verified.m08T08FormalPrerequisite, false);

  await assert.rejects(
    verifyEditorCoreContinuousValidationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreContinuousValidationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(exactProofDocument("0".repeat(64))),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreContinuousValidationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(
        `${exactProofDocument(built.artifactSha256)}\nM08-T09: FAIL\n`,
      ),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact deterministic evidence", async () => {
  const directory = await temporaryDirectory("desen-m08-t09-proof-");
  const destinationPath = path.join(directory, "artifact.json");
  let beforeRenameCalls = 0;
  const written = await writeEditorCoreContinuousValidationEvidence({
    destinationPath,
    beforeAtomicRename() {
      beforeRenameCalls += 1;
    },
  });
  assert.equal(beforeRenameCalls, 1);
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.equal(written.artifactBytes, built.artifactBytes.byteLength);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});
