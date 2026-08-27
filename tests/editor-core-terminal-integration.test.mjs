import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS,
  EditorCoreTerminalIntegrationProofError,
  buildEditorCoreTerminalIntegrationEvidence,
  verifyEditorCoreTerminalIntegrationEvidence,
  writeEditorCoreTerminalIntegrationEvidence,
} from "../scripts/lib/editor-core-terminal-integration-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROOF_LIBRARY = "scripts/lib/editor-core-terminal-integration-proof.mjs";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreTerminalIntegrationProofError && error.code === code;
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
  built = await buildEditorCoreTerminalIntegrationEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates M08-T01 through T09 and the exact P-18 platform prerequisites", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-terminal-integration");
  assert.equal(built.artifact.profile, "desen.editor-core.terminal-integration-proof.v1");
  assert.equal(built.artifact.task, "M08-T10");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(
    built.artifact.prerequisites.map(({ task, path: artifactPath, bytes, sha256, authority }) => ({
      task,
      path: artifactPath,
      bytes,
      sha256,
      authority,
    })),
    EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS.map(
      ({ task, path: artifactPath, bytes, sha256, authority }) => ({
        task,
        path: artifactPath,
        bytes,
        sha256,
        authority,
      }),
    ),
  );
  assert.deepEqual(built.artifact.claim.prerequisiteTasks, [
    "M08-T01",
    "M08-T02",
    "M08-T03",
    "M08-T04",
    "M08-T05",
    "M08-T06",
    "M08-T07",
    "M08-T08",
    "M08-T09",
    "M01-T05",
    "M04-T16",
    "M04-T17",
  ]);
  assert.equal(built.artifact.claim.p18Status, "PROVEN");
  assert.equal(built.artifact.claim.gateStatus, "DONE");
  assert.equal(built.artifact.claim.s002Status, "TESTED");
  assert.equal(built.artifact.publicApi.runtimeExports.length, 35);
  assert.equal(built.artifact.publicApi.typeExports.length, 88);
  assert.equal(built.artifact.publicApi.taskRuntimeExportsAdded, 0);
  assert.equal(built.artifact.publicApi.taskTypeExportsAdded, 0);
  assert.equal(built.artifact.publicApi.productionHelperAdded, false);
});

test("[graphs] runs two independent receipted emitted graphs with identical detached outcomes", async () => {
  assert.equal(
    built.artifact.executionAuthority.mode,
    "TWO_INDEPENDENT_AUTHENTICATED_BYTE_COPY_ESM_GRAPHS",
  );
  assert.equal(built.artifact.executionAuthority.graphCount, 2);
  assert.equal(built.artifact.executionAuthority.sameWorkspaceModuleCacheUsed, false);
  assert.equal(built.artifact.executionAuthority.editorRuntimeFilesPerGraph, 9);
  assert.equal(built.artifact.executionAuthority.dependencyFilesPerGraph, 21);
  assert.equal(built.artifact.executionAuthority.runtimeFilesPerGraph, 31);
  assert.equal(built.artifact.independentGraphs.graphs, 2);
  assert.equal(built.artifact.independentGraphs.traceValuesEqual, true);
  assert.equal(built.artifact.independentGraphs.finalCanonicalBytesEqual, true);
  assert.equal(built.artifact.independentGraphs.finalDocumentsDetached, true);
  assert.equal(built.artifact.independentGraphs.fullValidationReportsEqual, true);
  assert.deepEqual(
    built.artifact.independentGraphs.graphOneTrace,
    built.artifact.independentGraphs.graphTwoTrace,
  );

  const secondBuild = await buildEditorCoreTerminalIntegrationEvidence();
  assert.deepEqual(secondBuild.artifactBytes, built.artifactBytes);
  assert.equal(secondBuild.artifactSha256, built.artifactSha256);
});

test("[transcript] executes all 32 commands with an exact stable-identity ledger", () => {
  const trace = built.artifact.independentGraphs.graphOneTrace;
  assert.equal(trace.commands.length, 32);
  assert.equal(trace.steps.length, 32);
  assert.deepEqual(
    trace.steps.map(({ ordinal }) => ordinal),
    Array.from({ length: 32 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    trace.steps.map(({ command }) => command),
    trace.commands,
  );
  assert.deepEqual(trace.steps[0].identityDelta, {
    added: ["node:sign-in.terminal"],
    removed: [],
  });
  assert.deepEqual(trace.steps[1].identityDelta, {
    added: [],
    removed: ["node:sign-in.terminal-delete"],
  });
  for (const step of trace.steps.slice(2)) {
    assert.deepEqual(step.identityDelta, { added: [], removed: [] });
    assert.equal(step.priorDocumentUnchanged, true);
    assert.equal(step.freshDocument, true);
    assert.equal(step.recursivelyFrozen, true);
    assert.match(step.identityLedger.canonicalSha256, /^[0-9a-f]{64}$/u);
  }
  assert.equal(trace.steps[0].insertedNodeId, "sign-in.terminal");
});

test("[atomicity] contains one controlled failure and resumes without changing the prior document", () => {
  const failure = built.artifact.independentGraphs.graphOneTrace.controlledFailure;
  assert.equal(failure.afterSuccessfulStep, 16);
  assert.equal(failure.command, "deleteDesenEditorNode");
  assert.equal(failure.diagnosticCode, "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND");
  assert.equal(failure.partialDocumentExposed, false);
  assert.equal(failure.priorDocumentUnchanged, true);
  assert.equal(failure.resumeStep, 17);
  assert.equal(failure.resumedSuccessfully, true);
});

test("[terminal] validates, persists, reopens, and distinguishes authoring fingerprints", () => {
  const terminal = built.artifact.independentGraphs.graphOneTrace.final;
  assert.equal(terminal.validation.valid, true);
  assert.equal(terminal.validation.diagnosticCount, 0);
  assert.equal(terminal.validation.obligationCount, 7);
  assert.equal(terminal.validation.invalidSubjectCount, 0);
  assert.equal(terminal.validation.unmappedDiagnosticCount, 0);
  assert.equal(terminal.validation.report.valid, true);
  assert.equal(terminal.validation.report.obligations.length, 7);
  assert.deepEqual(
    terminal.validation.report,
    built.artifact.independentGraphs.graphTwoTrace.final.validation.report,
  );
  assert.deepEqual(
    terminal.validation.reportCanonical,
    built.artifact.independentGraphs.graphTwoTrace.final.validation.reportCanonical,
  );
  assert.equal(terminal.persistence.saveStatus, "created");
  assert.equal(terminal.persistence.openStatus, "opened");
  assert.equal(terminal.persistence.generation, 1);
  assert.equal(terminal.persistence.detachedReopenedDocument, true);
  assert.equal(terminal.persistence.canonicalBytesPreserved, true);
  assert.equal(terminal.authoringFingerprints.sourceDigestsEqual, true);
  assert.equal(terminal.authoringFingerprints.documentFingerprintsDifferent, true);
  assert.notEqual(
    terminal.authoringFingerprints.leftDocumentFingerprint,
    terminal.authoringFingerprints.rightDocumentFingerprint,
  );
});

test("[platform] AST-audits source, JavaScript, and declarations for the React DOM Node CSS boundary", () => {
  const boundary = built.artifact.packageBoundary;
  assert.equal(boundary.platformNeutral, true);
  assert.equal(boundary.currentEmittedFiles, 36);
  assert.equal(boundary.astAudit.method, "TYPESCRIPT_AST");
  assert.equal(boundary.astAudit.files, 27);
  assert.equal(boundary.astAudit.byLayer.SOURCE.files, 9);
  assert.equal(boundary.astAudit.byLayer.EMITTED_JS.files, 9);
  assert.equal(boundary.astAudit.byLayer.EMITTED_DTS.files, 9);
  assert.equal(boundary.astAudit.byLayer.EMITTED_JS.staticEdges, 24);
  assert.equal(boundary.fileInventory.method, "NO_FOLLOW_EXACT_REGULAR_FILE_INVENTORY");
  assert.equal(boundary.fileInventory.sourceFiles, 9);
  assert.equal(boundary.fileInventory.distFiles, 36);
  assert.equal(boundary.fileInventory.sourcePaths.length, 9);
  assert.equal(boundary.fileInventory.distPaths.length, 36);
  assert.equal(boundary.astAudit.relativeEdgeClosure.closed, true);
  assert.equal(boundary.astAudit.relativeEdgeClosure.relativeEdges, 68);
  assert.equal(boundary.astAudit.relativeEdgeClosure.receipts.length, 68);
  for (const layer of Object.values(boundary.astAudit.byLayer)) {
    assert.equal(layer.forbiddenImports, 0);
    assert.equal(layer.unknownImports, 0);
    assert.equal(layer.dynamicImports, 0);
    assert.equal(layer.evalCalls, 0);
    assert.equal(layer.functionConstructors, 0);
    assert.equal(layer.forbiddenPlatformIdentifiers, 0);
  }
  assert.equal(boundary.reactImports, 0);
  assert.equal(boundary.domImports, 0);
  assert.equal(boundary.nodeImports, 0);
  assert.equal(boundary.cssImports, 0);
});

test("[trace] round-trips callback-free JSON through RFC 8785 with an exact digest", () => {
  const left = built.artifact.independentGraphs.graphOneRoundTrip;
  const right = built.artifact.independentGraphs.graphTwoRoundTrip;
  assert.equal(left.jsonSerializable, true);
  assert.equal(left.callbacksOrExecutableValues, false);
  assert.equal(left.parsedValueExact, true);
  assert.equal(left.canonicalBytesEqual, true);
  assert.equal(left.rfc8785CanonicalSha256, left.roundTripCanonicalSha256);
  assert.match(left.rfc8785CanonicalSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(left, right);
});

test("[mutation] rejects runtime, tracked boundary, and prerequisite substitution", async () => {
  await assert.rejects(
    buildEditorCoreTerminalIntegrationEvidence({ runtime: {} }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  await assert.rejects(
    buildEditorCoreTerminalIntegrationEvidence({
      inventoryExtraPaths: ["packages/editor-core/src/platform-authority.ts"],
    }),
    expectedError("INVENTORY_DRIFT"),
  );
  const proofLibraryBytes = await readFile(path.join(ROOT, PROOF_LIBRARY));
  await assert.rejects(
    buildEditorCoreTerminalIntegrationEvidence({
      fileOverrides: new Map([[PROOF_LIBRARY, changedByte(proofLibraryBytes)]]),
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  const t09 = EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS[8];
  const t09Bytes = await readFile(path.join(ROOT, t09.path));
  await assert.rejects(
    buildEditorCoreTerminalIntegrationEvidence({
      prerequisiteBytes: new Map([[t09.path, t09Bytes]]),
    }),
    expectedError("PREREQUISITE_OVERRIDE_REJECTED"),
  );
  await assert.rejects(
    buildEditorCoreTerminalIntegrationEvidence({
      prerequisiteBytes: new Map([[t09.path, changedByte(t09Bytes)]]),
    }),
    expectedError("PREREQUISITE_DRIFT"),
  );
});

test("[verification] rejects artifact and visible proof-pin drift", async () => {
  const proofDocumentBytes = Buffer.from(exactProofDocument(built.artifactSha256));
  const verified = await verifyEditorCoreTerminalIntegrationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.p18Status, "PROVEN");
  assert.equal(verified.g08Status, "DONE");

  await assert.rejects(
    verifyEditorCoreTerminalIntegrationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreTerminalIntegrationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(exactProofDocument("0".repeat(64))),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreTerminalIntegrationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: Buffer.from(
        `${exactProofDocument(built.artifactSha256)}\nM08-T10: FAIL\n`,
      ),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact deterministic evidence", async () => {
  const directory = await temporaryDirectory("desen-m08-t10-proof-");
  const destinationPath = path.join(directory, "artifact.json");
  let beforeRenameCalls = 0;
  const written = await writeEditorCoreTerminalIntegrationEvidence({
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
