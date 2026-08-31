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
const M10_T01A_SECURE_SCROLL_CURRENT_PROJECTION = Object.freeze({
  compatibilityReceipt: "M10-T01A-SECURE-SCROLL-COMPAT",
  correctiveReceiptOnly: true,
  overriddenHistoricalPaths: Object.freeze([
    "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
    "apps/desen-app/src/application.module.css",
  ]),
  additivePaths: Object.freeze([
    "apps/desen-app/src/inspector-panel.tsx",
    "apps/desen-app/test/inspector-panel.test.tsx",
  ]),
  checkpointResealedPaths: Object.freeze([
    "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
    "tests/desen-app-user-created-blank-project.test.mjs",
  ]),
  trackedReceipts: Object.freeze([
    Object.freeze({
      path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
      bytes: 15_935,
      sha256: "1ea724a50606719b597ddfee7db95594a9a1272d2cac33fd2c23800879b9cbc1",
    }),
    Object.freeze({
      path: "apps/desen-app/src/application.module.css",
      bytes: 112_302,
      sha256: "4ff3d05e8160ab8b155b1e9a24a565dd2988e808a02dd29cb375dc8edc2f41d1",
    }),
    Object.freeze({
      path: "apps/desen-app/src/inspector-panel.tsx",
      bytes: 32_412,
      sha256: "06e62b9449aa4f1ea05bc0b28d045897897baabfbf257eff9b9bafa842ecf470",
    }),
    Object.freeze({
      path: "apps/desen-app/test/inspector-panel.test.tsx",
      bytes: 27_492,
      sha256: "ee46354d9ff0c09fe6b85e4a7ee66a85221832ce0c198d0319222b3cda90d6b5",
    }),
  ]),
});
const M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json";
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
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLISH_ACTIVATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
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
  const currentApplication = built.currentCompatibility.source.application;
  const currentCss = built.currentCompatibility.source.css;
  assert.equal(currentApplication.stableGlobalLayerDragSession, true);
  assert.equal(currentApplication.globalLayerOwnerAndEpochFencing, true);
  assert.equal(currentApplication.guardedLastAcceptedProjection, true);
  assert.equal(currentApplication.releaseDriftRetainsLastAcceptedProjection, true);
  assert.equal(currentApplication.nestedSlotSurfaceOwnsDropEvents, true);
  assert.equal(currentApplication.explicitNoOpPlacementFeedback, true);
  assert.equal(currentApplication.componentDragAuthorityLimitedToDedicatedHandle, true);
  assert.equal(currentApplication.dedicatedLayerDragHandle, true);
  assert.equal(currentApplication.componentPanelWideDropSurface, true);
  assert.equal(currentApplication.stickyComponentTargetDirectDropSurface, true);
  assert.equal(currentApplication.separateNonDraggableComponentAddAction, true);
  assert.equal(currentApplication.retainedInsertSelectionForDeleteDiscoverability, true);
  assert.equal(currentCss.stableCompactSlotGaps, true);
  assert.equal(currentCss.stableGlobalDragGuidePresentation, true);
  assert.equal(currentCss.noOpPlacementFeedbackPresentation, true);
  assert.equal(currentCss.panelWideComponentDropPresentation, true);
  assert.equal(currentCss.stickyComponentTargetDirectDropPresentation, true);
  assert.equal(currentCss.dedicatedDragHandlesPresentation, true);
  assert.equal(currentCss.separateComponentAddActionPresentation, true);
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
      search:
        "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      replacement: "const sessionOwnerKey = target.ownerId",
    },
    {
      key: "applicationSource",
      search: "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      replacement: "dragSession.current = createAuthoringDragSession(current.epoch)",
    },
    {
      key: "applicationSource",
      search: 'admission.status === "noop"\n        ? "none"',
      replacement: 'admission.status === "noop"\n        ? "move"',
    },
    {
      key: "applicationSource",
      search: 'releaseAdmission.status === "rejected"',
      replacement: 'releaseAdmission.status === "noop"',
    },
    {
      key: "applicationSource",
      search:
        "event.stopPropagation();\n    const admission = projectNearestDrop(list, event.clientY, event.target);",
      replacement: "const admission = projectNearestDrop(list, event.clientY, event.target);",
    },
    {
      key: "applicationSource",
      search: "panelDragEnterDepth.current += 1",
      replacement: "panelDragEnterDepth.current += 0",
    },
    {
      key: "applicationSource",
      search:
        "onDragEnter={enterComponentDrop}\n        onDragLeave={leaveComponentDrop}\n        onDragOver={admitComponentDrop}\n        onDrop={receiveComponentDrop}",
      replacement:
        "onDragEnter={undefined}\n        onDragLeave={undefined}\n        onDragOver={undefined}\n        onDrop={undefined}",
    },
    {
      key: "applicationSource",
      search: 'data-component-drag-handle="true"',
      replacement: 'data-component-drag-handle="false"',
    },
    {
      key: "applicationSource",
      search: 'data-layer-drag-handle="true"',
      replacement: 'data-layer-drag-handle="false"',
    },
    {
      key: "applicationSource",
      search: "className={styles.componentAddAction}",
      replacement: "className={styles.removedComponentAddAction}",
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
      search: ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;",
      replacement:
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 0.25rem;",
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
        bytes: 27_053,
        sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
      },
      focusedTestCases: 142,
      fullAppTestFiles: 22,
      fullAppTestCases: 324,
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

test("[successor] authenticates and mutation-tests the exact M09-T13 diagnostics closure", async () => {
  const successor = built.currentCompatibility.nodeLinkedDiagnosticsSuccessor;
  assert.deepEqual(
    {
      artifact: successor.artifact,
      focusedTestFiles: successor.focusedTestFiles,
      focusedTestCases: successor.focusedTestCases,
      fullAppTestFiles: successor.fullAppTestFiles,
      fullAppTestCases: successor.fullAppTestCases,
      parentArtifacts: successor.parentArtifacts,
      trackedFiles: successor.trackedFiles,
      immutableRejectedCandidateReport: successor.immutableRejectedCandidateReport,
      explicitContextIdentityMappingOnly: successor.explicitContextIdentityMappingOnly,
      textIdentityInference: successor.diagnosticCodeMessagePointerIdentityInference,
      duplicateOccurrenceOrderPreserved: successor.duplicateOccurrenceOrderPreserved,
      unmappedDiagnosticsSelectable: successor.unmappedDiagnosticsSelectable,
      reportDocumentFenced: successor.reportSnapshotDocumentFingerprintFenced,
      reportCatalogFenced: successor.reportSnapshotCatalogFingerprintFenced,
      routeAndSurfaceFenced: successor.routeAndSurfaceFenced,
      runtimeKindMismatchFailsClosed: successor.runtimeKindMismatchFailsClosed,
      invalidPlaceholderInsideRuntime: successor.invalidPlaceholderInsideManagedRuntimeSubtree,
      runModeDiagnosticsVisible: successor.runModeDiagnosticsVisible,
      obligationsExecutable: successor.obligationsExecutable,
      rejectedDiagnosticsPersisted: successor.rejectedDiagnosticsPersisted,
      rejectedDiagnosticsAffectDirtyState: successor.rejectedDiagnosticsAffectDirtyState,
      rejectedDiagnosticsIncludedInSave: successor.rejectedDiagnosticsIncludedInSave,
      p16Status: successor.p16Status,
      pf086Status: successor.pf086Status,
    },
    {
      artifact: {
        task: "M09-T13",
        proofId: "desen-app-node-linked-diagnostics",
        profile: "desen.app.node-linked-diagnostics-proof.v1",
        result: "PASS",
        path: NODE_LINKED_DIAGNOSTICS_ARTIFACT,
        bytes: 29_208,
        sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
      },
      focusedTestFiles: 9,
      focusedTestCases: 161,
      fullAppTestFiles: 24,
      fullAppTestCases: 339,
      parentArtifacts: 11,
      trackedFiles: 39,
      immutableRejectedCandidateReport: true,
      explicitContextIdentityMappingOnly: true,
      textIdentityInference: false,
      duplicateOccurrenceOrderPreserved: true,
      unmappedDiagnosticsSelectable: false,
      reportDocumentFenced: true,
      reportCatalogFenced: true,
      routeAndSurfaceFenced: true,
      runtimeKindMismatchFailsClosed: true,
      invalidPlaceholderInsideRuntime: false,
      runModeDiagnosticsVisible: false,
      obligationsExecutable: false,
      rejectedDiagnosticsPersisted: false,
      rejectedDiagnosticsAffectDirtyState: false,
      rejectedDiagnosticsIncludedInSave: false,
      p16Status: "PROVEN",
      pf086Status: "OPEN",
    },
  );
  const artifactBytes = await readFile(path.join(ROOT, NODE_LINKED_DIAGNOSTICS_ARTIFACT));
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});

test("[M10 successor] authenticates immutable browser evidence and rejects current substitutions", async () => {
  const successor = built.currentCompatibility.emptyProjectBrowserE2eSuccessor;
  assert.deepEqual(
    {
      task: successor.task,
      artifactSha256: successor.artifact.sha256,
      immutable: successor.artifact.immutable,
      compatibilitySha256: successor.compatibilityArtifact.sha256,
      compatibilityReceipt: successor.compatibilityArtifact.compatibilityReceipt,
      compatibilityRelationship: successor.currentProjection.relationship,
      p08Status: successor.p08Status,
      runtimeInputAndPendingCovered: successor.runtimeInputAndPendingCovered,
      g10Closed: successor.g10Closed,
    },
    {
      task: "M10-T01",
      artifactSha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
      immutable: true,
      compatibilitySha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
      compatibilityReceipt: "M10-T01-COMPAT",
      compatibilityRelationship: "IMMUTABLE_M10_T01_COMPATIBILITY_RECEIPTS",
      p08Status: "PROVEN",
      runtimeInputAndPendingCovered: false,
      g10Closed: false,
    },
  );
  const mutationPaths = [
    successor.artifact.path,
    successor.compatibilityArtifact.path,
    ...successor.currentProjection.changedHistoricalPaths.map(
      ({ path: relativePath }) => relativePath,
    ),
  ];
  assert.deepEqual(mutationPaths, [
    "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json",
    "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json",
    "pnpm-lock.yaml",
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/test/application.test.tsx",
    "dependency-cruiser.config.cjs",
  ]);
  for (const relativePath of mutationPaths) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppStateBindingEditorEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[M10-T01A successor] authenticates the exact user-created blank-project overlay and fails closed", async () => {
  const successor = built.currentCompatibility.userCreatedBlankProjectSuccessor;
  assert.deepEqual(
    {
      compatibilityReceipt: successor.currentProjection.compatibilityReceipt,
      correctiveReceiptOnly: successor.currentProjection.correctiveReceiptOnly,
      overriddenHistoricalPaths: successor.currentProjection.overriddenHistoricalPaths,
      additivePaths: successor.currentProjection.additivePaths,
      checkpointResealedPaths: successor.currentProjection.checkpointResealedPaths,
      trackedReceipts: successor.currentProjection.trackedReceipts,
    },
    M10_T01A_SECURE_SCROLL_CURRENT_PROJECTION,
  );
  for (const { path: relativePath } of M10_T01A_SECURE_SCROLL_CURRENT_PROJECTION.trackedReceipts) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppStateBindingEditorEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  assert.deepEqual(
    {
      task: successor.task,
      artifactPath: successor.artifact.path,
      artifactSha256: successor.artifact.sha256,
      immutable: successor.artifact.immutable,
      predecessorTask: successor.predecessor.task,
      predecessorSha256: successor.predecessor.sha256,
      trackedReceipts: successor.trackedReceipts.length,
      p08Status: successor.p08Status,
      runtimeInputAndPendingCovered: successor.runtimeInputAndPendingCovered,
      invalidCredentialsAndPublicFailureCovered:
        successor.invalidCredentialsAndPublicFailureCovered,
      successNavigationAndHostOperationCovered: successor.successNavigationAndHostOperationCovered,
      g10Closed: successor.g10Closed,
    },
    {
      task: "M10-T01A",
      artifactPath: M10_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
      artifactSha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
      immutable: true,
      predecessorTask: "M10-T01-COMPAT",
      predecessorSha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
      trackedReceipts: 43,
      p08Status: "PROVEN",
      runtimeInputAndPendingCovered: false,
      invalidCredentialsAndPublicFailureCovered: false,
      successNavigationAndHostOperationCovered: false,
      g10Closed: false,
    },
  );
  const trackedPaths = successor.trackedReceipts.map(({ path: relativePath }) => relativePath);
  assert.equal(new Set(trackedPaths).size, 43);
  assert.deepEqual(trackedPaths.slice(0, 2), [".github/workflows/ci.yml", ".gitignore"]);
  assert.deepEqual(trackedPaths.slice(-2), [
    "tests/boundaries/README.md",
    "tests/desen-app-user-created-blank-project.test.mjs",
  ]);

  for (const relativePath of [
    successor.artifact.path,
    "apps/desen-app/package.json",
    "apps/desen-app/src/product-bootstrap.tsx",
    "apps/desen-app/dev/local-dev-host.mjs",
    "dependency-cruiser.config.cjs",
    "tests/boundaries/README.md",
  ]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppStateBindingEditorEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[successor] authenticates and mutation-tests the exact M09-T14/G09 publish-activation closure", async () => {
  const successor = built.currentCompatibility.publishActivationSuccessor;
  assert.equal(successor.task, "M09-T14");
  assert.equal(successor.gate, "G09");
  assert.deepEqual(successor.artifact, {
    task: "M09-T14",
    gate: "G09",
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    result: "PASS",
    path: PUBLISH_ACTIVATION_ARTIFACT,
    bytes: 24_763,
    sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  });
  assert.deepEqual(
    {
      focusedTestDeclarations: successor.focusedTestDeclarations,
      trackedFiles: successor.trackedFiles,
      parentArtifacts: successor.parentArtifacts,
      rootTests: successor.rootTests,
      savedAuthoredSourceOnly: successor.savedAuthoredSourceOnly,
      publisherRerunFromSavedSource: successor.publisherRerunFromSavedSource,
      scenarioPreviewPublished: successor.scenarioPreviewPublished,
      fixtureDataPublished: successor.fixtureDataPublished,
      operationInputOrSecretPublished: successor.operationInputOrSecretPublished,
      rejectedDiagnosticsPublished: successor.rejectedDiagnosticsPublished,
      exactCanonicalBundleBytesStored: successor.exactCanonicalBundleBytesStored,
      fixedPreviewChannelCompareAndSet: successor.fixedPreviewChannelCompareAndSet,
      mutableChannelIsActivationAuthority: successor.mutableChannelIsActivationAuthority,
      distinctSourceChannelAndActivationGenerations:
        successor.distinctSourceChannelAndActivationGenerations,
      activeRevisionRequiresReferenceHostReceipt:
        successor.activeRevisionRequiresReferenceHostReceipt,
      staleCompletionCanBecomeActive: successor.staleCompletionCanBecomeActive,
      blindRetryAfterIndeterminate: successor.blindRetryAfterIndeterminate,
      conflictActivatesCandidate: successor.conflictActivatesCandidate,
      lastKnownGoodActivationPreserved: successor.lastKnownGoodActivationPreserved,
      realPublicControlPlaneAndReferenceHostIntegration:
        successor.realPublicControlPlaneAndReferenceHostIntegration,
      browserAppImportsNodeCompositionPackages: successor.browserAppImportsNodeCompositionPackages,
      publicationClaimed: successor.publicationClaimed,
      activationClaimed: successor.activationClaimed,
      browserE2eClaimed: successor.browserE2eClaimed,
      p08Status: successor.p08Status,
      pf085Status: successor.pf085Status,
      pf086Status: successor.pf086Status,
      pf089Status: successor.pf089Status,
    },
    {
      focusedTestDeclarations: 45,
      trackedFiles: 33,
      parentArtifacts: 9,
      rootTests: 12,
      savedAuthoredSourceOnly: true,
      publisherRerunFromSavedSource: true,
      scenarioPreviewPublished: false,
      fixtureDataPublished: false,
      operationInputOrSecretPublished: false,
      rejectedDiagnosticsPublished: false,
      exactCanonicalBundleBytesStored: true,
      fixedPreviewChannelCompareAndSet: true,
      mutableChannelIsActivationAuthority: false,
      distinctSourceChannelAndActivationGenerations: true,
      activeRevisionRequiresReferenceHostReceipt: true,
      staleCompletionCanBecomeActive: false,
      blindRetryAfterIndeterminate: false,
      conflictActivatesCandidate: false,
      lastKnownGoodActivationPreserved: true,
      realPublicControlPlaneAndReferenceHostIntegration: true,
      browserAppImportsNodeCompositionPackages: false,
      publicationClaimed: true,
      activationClaimed: true,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      pf085Status: "OPEN",
      pf086Status: "OPEN",
      pf089Status: "OPEN",
    },
  );
  const [artifactBytes, receiptBytes, applicationTestBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_APPLICATION_TEST)),
  ]);
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([
        [PUBLISH_ACTIVATION_APPLICATION_TEST, changedByte(applicationTestBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppStateBindingEditorEvidence({
      fileOverrides: new Map([
        [
          PUBLISH_ACTIVATION_APPLICATION_TEST,
          Buffer.from(applicationTestBytes.toString("utf8").replace("}, 10_000);", "}, 20_000);")),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
