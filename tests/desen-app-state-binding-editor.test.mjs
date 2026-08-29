import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS,
  DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES,
  DesenAppStateBindingEditorProofError,
  buildDesenAppStateBindingEditorEvidence,
  verifyDesenAppStateBindingEditorEvidence,
  verifyDesenAppStateBindingEditorSourcePolicy,
  writeDesenAppStateBindingEditorEvidence,
} from "../scripts/lib/desen-app-state-binding-editor-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze(
  DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS.map(({ path: relativePath }) => relativePath),
);
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  stateSource: "apps/desen-app/src/authoring-state.ts",
  inspectorSource: "apps/desen-app/src/authoring-inspector.ts",
  structuredJsonSource: "apps/desen-app/src/structured-json.ts",
  statePanelSource: "apps/desen-app/src/state-panel.tsx",
  inspectorPanelSource: "apps/desen-app/src/inspector-panel.tsx",
  previewSource: "apps/desen-app/src/authoring-preview.ts",
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
});
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const temporaryDirectories = [];
let parentArtifactBytes;
let sourcePolicyInput;
let fixturesScenariosArtifactBytes;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppStateBindingEditorProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, `Missing mutation marker ${search}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App state-binding editor",
      "",
      "Task: M09-T08",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
      "M09-T09: NOT_PROVEN",
      "M09-T10: NOT_PROVEN",
      "M09-T12: NOT_PROVEN",
      "M09-T14: NOT_PROVEN",
      "",
      `Final artifact: \`sha256:${artifactSha256}\``,
      "",
    ].join("\n"),
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  sourcePolicyInput = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  parentArtifactBytes = new Map(
    await Promise.all(
      PARENT_PATHS.map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  fixturesScenariosArtifactBytes = await readFile(
    path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT_PATH),
  );
  built = await buildDesenAppStateBindingEditorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-state-binding-editor");
  assert.equal(built.artifact.profile, "desen.app.state-binding-editor-proof.v1");
  assert.equal(built.artifact.task, "M09-T08");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
  assert.equal(built.artifactBytes.byteLength > 0, true);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.equal(built.currentCompatibility.successor.task, "M09-T09");
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
    task: "M09-T09",
    proofId: "desen-app-event-action-editor",
    profile: "desen.app.event-action-editor-proof.v1",
    result: "PASS",
    path: "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json",
    bytes: 23_812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
  });
  assert.equal(built.currentCompatibility.successor.exactSelectedComponentEvents, true);
  assert.equal(built.currentCompatibility.successor.behaviorOwnerUiImplemented, false);
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[1], () => {
  const state = built.artifact.authority.source.state;
  assert.deepEqual(state.primitivePresets, ["boolean", "integer", "number", "string"]);
  assert.equal(state.surfaceLocalProjection, true);
  assert.equal(state.deterministicDeclarationOrder, true);
  assert.equal(state.usageReferenceReads, true);
  assert.equal(state.usageStateSetAndToggleWrites, true);
  assert.equal(state.inertStateInitialExcludedFromUsage, true);
  assert.equal(state.usageScanMaxDepth, 512);
  assert.equal(state.usageScanMaxVisitedValues, 100_000);
  assert.equal(state.publicEditorCoreStateCommandsOnly, true);
  assert.equal(state.primitiveSchemaAndInitialStagedPrivately, true);
  assert.equal(state.unusedOnlyDeletion, true);
  assert.equal(built.artifact.claim.surfaceLocalPrimitiveStateList, true);
  assert.equal(built.artifact.claim.primitiveStateAddUpdateDelete, true);
  assert.equal(built.artifact.claim.boundedConservativeUsageCount, true);
  assert.equal(built.artifact.claim.usedStateDeleteRejected, true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[2], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.equal(inspector.directPrimitiveLocalStateOptionsOnly, true);
  assert.equal(inspector.exactSingleRefBindingShapeOnly, true);
  assert.equal(inspector.catalogControlCompatibilityRequired, true);
  assert.equal(inspector.routeSelectionAndEditReadmissionRequired, true);
  assert.equal(inspector.exactOwnDataBindingEditCapture, true);
  assert.equal(inspector.bindConstructsExactStateReference, true);
  assert.equal(inspector.detachRestoresValidatedPrimitiveInitial, true);
  assert.equal(built.artifact.claim.directCompatibleLocalStatePropBinding, true);
  assert.equal(built.artifact.claim.exactDirectBindingChange, true);
  assert.equal(built.artifact.claim.exactDirectBindingDetachToInitial, true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[3], () => {
  const state = built.artifact.authority.source.state;
  const inspector = built.artifact.authority.source.inspector;
  const inert = built.artifact.authority.source.structuredJson;
  assert.equal(state.exactOwnDataRouteAndEditCapture, true);
  assert.equal(state.legalAdvancedSchemasVisibleReadOnly, true);
  assert.equal(state.completeSourceRevalidation, true);
  assert.equal(state.noPartialDocumentOnFailure, true);
  assert.equal(inspector.runtimeAndAdvancedBindingsReadOnly, true);
  assert.equal(inspector.completeSourceRevalidation, true);
  assert.equal(inspector.noPartialDocumentOnFailure, true);
  assert.equal(inert.inertReservedMembersNotInterpreted, true);
  assert.equal(inert.publisherJsonLimitsRetained, true);
  assert.equal(inert.advancedStateUiClaimed, false);
  assert.equal(built.artifact.claim.runtimeAndAdvancedBindingReadOnly, true);
  assert.equal(built.artifact.claim.advancedStateSchemaReadOnly, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[4], () => {
  const application = built.artifact.authority.source.application;
  const statePanel = built.artifact.authority.source.statePanel;
  const inspectorPanel = built.artifact.authority.source.inspectorPanel;
  const preview = built.artifact.authority.source.preview;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(statePanel.owner, "Desen App");
  assert.equal(statePanel.primitiveListAddUpdateDeleteControls, true);
  assert.equal(statePanel.noPersistenceOrPublicationClaim, true);
  assert.equal(inspectorPanel.owner, "Desen App");
  assert.equal(inspectorPanel.runtimeAndAdvancedBindingsReadOnly, true);
  assert.equal(inspectorPanel.managedAdapterImports, 0);
  assert.equal(preview.publicPublisherOnly, true);
  assert.equal(adapter.previousSessionDisposed, true);
  assert.equal(application.stateSourceAndPreviewCommitAtomically, true);
  assert.equal(application.bindingSourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherFailurePreservesPriorSession, true);
  assert.equal(application.stateAndInspectorChromeOutsideManagedCapabilitySubtree, true);
  assert.equal(application.retainedNamedSlotRowHalfDropTargets, true);
  assert.equal(application.retainedStickyComponentDropTarget, true);
  assert.equal(application.retainedInsertSelectionForDeleteDiscoverability, true);
  assert.equal(
    built.artifact.authority.source.css.retainedNonOverlappingStableSlotBoundaries,
    true,
  );
  assert.equal(built.artifact.authority.source.css.retainedRowDropPositionPresentation, true);
  assert.equal(built.artifact.authority.source.css.retainedStickyComponentTargetPresentation, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.stateAndBindingChromeOutsideManagedCapabilitySubtree, true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[5], () => {
  const tests = built.artifact.tests;
  assert.equal(tests.localCommandReceipts.pureState.tests, 12);
  assert.equal(tests.localCommandReceipts.focusedStateBindings.tests, 109);
  assert.equal(tests.localCommandReceipts.fullApp.tests, 181);
  assert.equal(tests.localCommandReceipts.rootProof.tests, 9);
  assert.equal(tests.localCommandReceipts.focusedStateBindings.testFiles, 8);
  assert.equal(tests.localCommandReceipts.fullApp.testFiles, 13);
  assert.equal(
    built.artifact.application.package.appTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-state.test.ts test/authoring-inspector.test.ts test/state-panel.test.tsx test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.artifact.application.package.rootCommands["verify:desen-app-state-binding-editor"],
    "node scripts/verify-desen-app-schema-inspector.mjs && node scripts/verify-editor-core-state-binding-edits.mjs && node scripts/verify-desen-app-named-slot-authoring.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:state-bindings && node scripts/verify-desen-app-state-binding-editor.mjs",
  );
  assert.equal(built.artifact.claim.persistenceClaimed, false);
  assert.equal(built.artifact.claim.eventActionEditingClaimed, false);
  assert.equal(built.artifact.claim.designRunClaimed, false);
  assert.equal(built.artifact.claim.activationClaimed, false);
  assert.equal(built.artifact.claim.browserE2eClaimed, false);
  assert.equal(built.artifact.claim.retainedNamedSlotAuthoringUxCompatibility, true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[6], async () => {
  const second = await buildDesenAppStateBindingEditorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[7], async () => {
  const mutations = [
    {
      key: "stateSource",
      search: "export function applyAuthoringStateEdit(",
      replacement: "export function applyUncheckedStateEdit(",
    },
    {
      key: "stateSource",
      search: "maxVisitedValues: 100_000",
      replacement: "maxVisitedValues: Number.POSITIVE_INFINITY",
    },
    {
      key: "inspectorSource",
      search: "export function applyAuthoringInspectorBindingEdit(",
      replacement: "export function applyUncheckedInspectorBindingEdit(",
    },
    {
      key: "inspectorPanelSource",
      search: "This runtime or advanced binding is preserved as read-only.",
      replacement: "Runtime bindings may be edited here.",
    },
    {
      key: "applicationSource",
      search: "function editLocalState(edit: AuthoringStateEdit)",
      replacement: "function editUncheckedState(edit: AuthoringStateEdit)",
    },
    {
      key: "applicationSource",
      search: "function projectNearestDrop(",
      replacement: "function uncheckedNearestDrop(",
    },
    {
      key: "applicationSource",
      search: "sourceNodeId: result.nodeId",
      replacement: "sourceNodeId: selection?.sourceNodeId ?? result.nodeId",
    },
    {
      key: "applicationCss",
      search: ".stateList {",
      replacement: ".removedStateList {",
    },
    {
      key: "applicationCss",
      search: '.slotBoundary[data-drop-hovered="true"] {\n  z-index: 4;',
      replacement: '.slotBoundary[data-drop-disabled="true"] {\n  z-index: 4;',
    },
    {
      key: "applicationCss",
      search: ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
      replacement: ".componentSlotTarget {\n  position: relative;\n  top: 0;",
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () =>
        verifyDesenAppStateBindingEditorSourcePolicy({
          ...sourcePolicyInput,
          [mutation.key]: replaceOnce(
            sourcePolicyInput[mutation.key],
            mutation.search,
            mutation.replacement,
          ),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
});

test(DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES[8], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppStateBindingEditorEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppStateBindingEditorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 3);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppStateBindingEditorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppStateBindingEditorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t08-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppStateBindingEditorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppStateBindingEditorEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);

  const linkedDestination = path.join(directory, "linked-destination.json");
  await symlink(destination, linkedDestination);
  await assert.rejects(
    writeDesenAppStateBindingEditorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppStateBindingEditorEvidence({
      artifactPath: artifactLink,
      proofDocument,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
});

test("[successor] authenticates and mutation-tests the exact M09-T12 persistence closure", async () => {
  const successor = built.currentCompatibility.sourcePersistenceSuccessor;
  assert.deepEqual(
    {
      artifact: successor.artifact,
      focusedTestCases: successor.focusedTestCases,
      fullAppTestFiles: successor.fullAppTestFiles,
      fullAppTestCases: successor.fullAppTestCases,
      sourceKey: successor.exactProjectScopedSourceKey,
      publicPort: successor.publicEditorCorePersistencePort,
      authoredSourceOnly: successor.authoredSourceOnly,
      sourceKeyIndependentOfDocumentId: successor.sourceKeyIndependentOfDocumentId,
      exactOwnSettlementCapture: successor.awaitedSettlementsCapturedAsExactOwnEnumerableData,
      settlementAccessorInvocation: successor.settlementAccessorInvocation,
      frozenOptionalDiagnosticCopy: successor.validOptionalDiagnosticDataCopiedAndFrozen,
      casGenerationRelations: successor.casGenerationRelationshipsValidated,
      openedDocumentReauthorized: successor.openedDocumentReauthorized,
      failedOpenPreservesDraft: successor.failedOrRejectedOpenPreservesDraft,
      malformedOpenRetryable: successor.malformedOpenRetryableAndDraftPreserved,
      generationExhaustionRequiresReopen: successor.generationExhaustionRequiresReopen,
      automaticRetryOrMerge: successor.automaticRetryOrMerge,
      unexpectedSaveIndeterminate: successor.unexpectedDispatchedSaveIndeterminate,
      malformedSaveReopenLock: successor.malformedSaveIndeterminateAndReopenRequired,
      staleOpenCannotReplace: successor.staleOpenCannotReplaceEditedSession,
      staleLifetimeIgnored: successor.staleLifetimeSettlementIgnored,
      postSettlementAuthorityRecheck: successor.postReflectionAndAdmissionAuthorityRechecked,
      reentrantSettlementCannotPublish: successor.reentrantSettlementCannotPublishRevokedState,
      dirtyOpenConfirmation: successor.dirtyOpenRequiresExplicitConfirmation,
      designModeOnlyControls: successor.designModeOnlyControls,
      visiblePersistenceState: successor.visibleGenerationDirtyAndReopenState,
      completeCanonicalDirty: successor.completeAuthoredSourceCanonicalDirtyComparison,
      identityOrVersionDirtyAuthority: successor.identityOrVersionDirtyAuthority,
      sameCanonicalReplacementRemainsClean: successor.sameCanonicalReplacementRemainsClean,
      canonicalRevertReturnsClean: successor.canonicalRevertReturnsClean,
      openOrSaveBaseline: successor.successfulOpenOrSaveEstablishesCanonicalBaseline,
      currentVsSaveSnapshot: successor.newerEditRemainsDirtyAfterOlderSave,
      noPortCanonicalTracking: successor.noPortCanonicalBaselineAndCurrentTracked,
      noPortRerenderSafe: successor.noPortDirtyProjectionRerenderSafe,
      cleanNoPortLabelAccurate: successor.cleanNoPortLabelAccurate,
      cleanNoPortStatusText: successor.cleanNoPortStatusText,
      navigationGuarded: successor.navigationAndPageExitGuarded,
      scenarioPreviewPersisted: successor.scenarioPreviewPersisted,
      runtimeInputOrSecretPersisted: successor.runtimeInputOrSecretPersisted,
    },
    {
      artifact: {
        task: "M09-T12",
        proofId: "desen-app-source-persistence",
        profile: "desen.app.source-persistence-proof.v1",
        result: "PASS",
        path: SOURCE_PERSISTENCE_ARTIFACT,
        bytes: 27_088,
        sha256: "75a7007c2fd60bd5da28c6f2175e9db7ebab763f67e8a7ca9eaaa03b468f7544",
      },
      focusedTestCases: 140,
      fullAppTestFiles: 22,
      fullAppTestCases: 322,
      sourceKey: "account-app-source",
      publicPort: true,
      authoredSourceOnly: true,
      sourceKeyIndependentOfDocumentId: true,
      exactOwnSettlementCapture: true,
      settlementAccessorInvocation: false,
      frozenOptionalDiagnosticCopy: true,
      casGenerationRelations: true,
      openedDocumentReauthorized: true,
      failedOpenPreservesDraft: true,
      malformedOpenRetryable: true,
      generationExhaustionRequiresReopen: true,
      automaticRetryOrMerge: false,
      unexpectedSaveIndeterminate: true,
      malformedSaveReopenLock: true,
      staleOpenCannotReplace: true,
      staleLifetimeIgnored: true,
      postSettlementAuthorityRecheck: true,
      reentrantSettlementCannotPublish: true,
      dirtyOpenConfirmation: true,
      designModeOnlyControls: true,
      visiblePersistenceState: true,
      completeCanonicalDirty: true,
      identityOrVersionDirtyAuthority: false,
      sameCanonicalReplacementRemainsClean: true,
      canonicalRevertReturnsClean: true,
      openOrSaveBaseline: true,
      currentVsSaveSnapshot: true,
      noPortCanonicalTracking: true,
      noPortRerenderSafe: true,
      cleanNoPortLabelAccurate: true,
      cleanNoPortStatusText: "Local draft unchanged",
      navigationGuarded: true,
      scenarioPreviewPersisted: false,
      runtimeInputOrSecretPersisted: false,
    },
  );
  const artifactBytes = await readFile(path.join(ROOT, SOURCE_PERSISTENCE_ARTIFACT));
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([[SOURCE_PERSISTENCE_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
