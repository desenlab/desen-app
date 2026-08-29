import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS,
  DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES,
  DesenAppSchemaInspectorProofError,
  buildDesenAppSchemaInspectorEvidence,
  verifyDesenAppSchemaInspectorEvidence,
  writeDesenAppSchemaInspectorEvidence,
} from "../scripts/lib/desen-app-schema-inspector-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze([
  "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json",
  "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json",
  "docs/proof/artifacts/publisher-0.1.0-official-golden.json",
]);
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_PATH = "apps/desen-app/src/event-action-panel.tsx";
const EVENT_ACTION_TEST_PATH = "apps/desen-app/test/authoring-event-actions.test.ts";
const EVENT_ACTION_PANEL_TEST_PATH = "apps/desen-app/test/event-action-panel.test.tsx";
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  inspectorSource: "apps/desen-app/src/authoring-inspector.ts",
  previewSource: "apps/desen-app/src/authoring-preview.ts",
  selectionSource: "apps/desen-app/src/authoring-selection.ts",
  panelSource: "apps/desen-app/src/inspector-panel.tsx",
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  globalCss: "apps/desen-app/src/styles.css",
});
const temporaryDirectories = [];
let parentArtifactBytes;
let fixturesScenariosArtifactBytes;
let sourcePolicyInput;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppSchemaInspectorProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App schema inspector",
      "",
      "Task: M09-T05",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
      "M09-T06: NOT_PROVEN",
      "M09-T08: NOT_PROVEN",
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
  const sourceEntries = await Promise.all(
    Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
      key,
      await readFile(path.join(ROOT, relativePath), "utf8"),
    ]),
  );
  sourcePolicyInput = Object.fromEntries(sourceEntries);
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
  built = await buildDesenAppSchemaInspectorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-schema-inspector");
  assert.equal(built.artifact.profile, "desen.app.schema-inspector-proof.v1");
  assert.equal(built.artifact.task, "M09-T05");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
  assert.equal(built.artifactBytes.byteLength, 22_998);
  assert.equal(
    built.artifactSha256,
    "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
  );
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.successor.task, "M09-T08");
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    path: STATE_BINDING_ARTIFACT_PATH,
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
  });
  assert.deepEqual(built.currentCompatibility.successor.predecessorArtifact, {
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    path: NAMED_SLOT_ARTIFACT_PATH,
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
  });
  assert.deepEqual(
    built.currentCompatibility.boundary.additiveSuccessorReceipts
      .slice(-5)
      .map(({ path: relativePath }) => relativePath),
    [
      EVENT_ACTION_SOURCE_PATH,
      EVENT_ACTION_PANEL_PATH,
      EVENT_ACTION_TEST_PATH,
      EVENT_ACTION_PANEL_TEST_PATH,
      FIXTURES_SCENARIOS_ARTIFACT_PATH,
    ],
  );
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[1], () => {
  assert.equal(built.currentCompatibility.successor.schemaDerivedChildControls, true);
  assert.equal(built.currentCompatibility.successor.nestedObjectInspector, true);
  assert.equal(built.currentCompatibility.successor.completeCatalogDeclaredSlotProjection, true);
  assert.equal(built.currentCompatibility.successor.absentAndEmptySlotsRemainDistinct, true);
  assert.equal(built.currentCompatibility.successor.catalogAdmissionAndCardinalityPreflight, true);
  assert.equal(built.currentCompatibility.successor.publicStableIdInsertMoveAndReorder, true);
  assert.equal(built.currentCompatibility.successor.publicValidatedNodeDeletion, true);
  assert.equal(
    built.currentCompatibility.successor.deletionPreflightRunsPublicMutationAndValidation,
    true,
  );
  assert.equal(built.currentCompatibility.successor.rootAndSourceMinimumDeletionDisabled, true);
  assert.equal(built.currentCompatibility.successor.behaviorOwnedDeletePreservesEmptySlot, true);
  assert.equal(built.currentCompatibility.successor.exactOwnDataDeletionSelectionCapture, true);
  assert.equal(built.currentCompatibility.successor.continuousCompleteSourceRevalidation, true);
  assert.equal(built.currentCompatibility.successor.failedDeletionPreservesCurrentDocument, true);
  assert.equal(built.currentCompatibility.successor.deletionSourceAndPreviewCommitAtomically, true);
  assert.equal(built.currentCompatibility.successor.deletionFocusManaged, true);
  assert.equal(built.currentCompatibility.successor.browserDataTransferReadsZero, true);
  assert.equal(built.currentCompatibility.successor.expandedDropReadyBoundaries, true);
  assert.equal(built.currentCompatibility.successor.stableNestedDragHover, true);
  assert.equal(built.currentCompatibility.successor.explicitComponentDropTargetGuide, true);
  assert.equal(built.currentCompatibility.successor.keyboardPlacementControl, true);
  assert.equal(
    built.currentCompatibility.successor.insertionAdmissionCachedPerModelAndExactTarget,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.placementAdmissionCachedPerModelAndExactTarget,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.cachedPlacementBaseMaterializesBoundaryFinalIndex,
    true,
  );
  assert.equal(built.currentCompatibility.successor.componentPaletteRenderLimit, 24);
  assert.equal(built.currentCompatibility.successor.activeTabOnlyAuthoringWork, true);
  assert.equal(built.currentCompatibility.successor.nodeAndBehaviorOwnersSupported, true);
  assert.equal(built.currentCompatibility.successor.exactOwnDataRouteSelectionAndEditCapture, true);
  assert.equal(built.currentCompatibility.successor.atomicPublisherBackedSlotEdits, true);
  assert.equal(
    built.currentCompatibility.successor.slotChromeOutsideManagedCapabilitySubtree,
    true,
  );
  assert.equal(built.currentCompatibility.successor.surfaceLocalPrimitiveStateEditing, true);
  assert.equal(built.currentCompatibility.successor.boundedUsageCounts, true);
  assert.equal(built.currentCompatibility.successor.usedStateDeleteRejected, true);
  assert.equal(
    built.currentCompatibility.successor.exactCompatibleDirectLocalStateBindingChangeAndDetach,
    true,
  );
  assert.equal(built.currentCompatibility.successor.runtimeAndAdvancedBindingsReadOnly, true);
  assert.equal(built.currentCompatibility.successor.atomicPublisherBackedPreview, true);
  assert.equal(
    built.currentCompatibility.successor.retainedNamedSlotAuthoringUxCompatibility,
    true,
  );
  assert.equal(built.currentCompatibility.successor.nonOverlappingStableSlotBoundaries, true);
  assert.equal(built.currentCompatibility.successor.rowHalfDropTargets, true);
  assert.equal(built.currentCompatibility.successor.stickyComponentDropTarget, true);
  assert.equal(built.currentCompatibility.successor.stableGlobalLayerDragSession, true);
  assert.equal(built.currentCompatibility.successor.globalLayerOwnerAndEpochFencing, true);
  assert.equal(built.currentCompatibility.successor.stableThirtyTwoPixelLayerGaps, true);
  assert.equal(built.currentCompatibility.successor.explicitStickyComponentDropTarget, true);
  assert.equal(built.currentCompatibility.successor.componentPaletteOuterDropInert, true);
  assert.equal(built.currentCompatibility.successor.draggableComponentCard, true);
  assert.equal(built.currentCompatibility.successor.separateNonDraggableComponentAddAction, true);
  assert.equal(built.currentCompatibility.successor.successfulInsertionSelectsNewLayer, true);
  assert.equal(built.currentCompatibility.successor.persistenceImplemented, false);
  assert.equal(built.currentCompatibility.successor.eventActionEditingImplemented, false);
  assert.equal(built.currentCompatibility.successor.designRunImplemented, false);
  assert.equal(built.currentCompatibility.successor.activationImplemented, false);
  assert.equal(built.currentCompatibility.successor.browserE2eImplemented, false);
  assert.equal(
    built.currentCompatibility.successor.package.namedSlotTestCommand,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.successor.package.namedSlotRootCommands[
      "verify:desen-app-named-slot-authoring"
    ],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node scripts/verify-desen-app-named-slot-authoring.mjs",
  );
  assert.equal(
    built.currentCompatibility.successor.package.stateBindingTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-state.test.ts test/authoring-inspector.test.ts test/state-panel.test.tsx test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.successor.package.stateBindingRootCommands[
      "verify:desen-app-state-binding-editor"
    ],
    "node scripts/verify-desen-app-schema-inspector.mjs && node scripts/verify-editor-core-state-binding-edits.mjs && node scripts/verify-desen-app-named-slot-authoring.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:state-bindings && node scripts/verify-desen-app-state-binding-editor.mjs",
  );
  assert.equal(
    built.currentCompatibility.successor.package.eventActionTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-data.test.ts test/authoring-selection.test.ts test/authoring-event-actions.test.ts test/event-action-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.successor.package.eventActionRootCommands[
      "verify:desen-app-event-action-editor"
    ],
    "node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-editor-core-event-action-edits.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:event-actions && node scripts/verify-desen-app-event-action-editor.mjs",
  );
  assert.deepEqual(built.artifact.claim.controlKinds, [
    "boolean",
    "enum",
    "integer",
    "number",
    "string",
  ]);
  assert.deepEqual(built.artifact.authority.schema.referenceKinds, [
    "boolean",
    "enum",
    "number",
    "string",
  ]);
  assert.deepEqual(built.artifact.authority.schema.syntheticCoveredKinds, [
    "integer",
    "mixed-primitive-enum",
  ]);
  assert.equal(built.artifact.authority.schema.referenceControls.length, 5);
  assert.equal(built.artifact.authority.schema.schemaAuthority, "component.propsSchema");
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[2], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.deepEqual(inspector.editableKinds, ["boolean", "enum", "integer", "number", "string"]);
  assert.equal(inspector.mutationUsesPublicEditorCoreOnly, true);
  assert.equal(inspector.editCommandCapturedAsExactOwnEnumerableData, true);
  assert.equal(inspector.editAccessorsSymbolsAndUnknownFieldsRejected, true);
  assert.equal(inspector.proxyGetTrapNotRequired, true);
  assert.equal(inspector.completeDocumentRevalidatedAfterEveryMutation, true);
  assert.equal(inspector.noPartialDocumentOnFailure, true);
  assert.equal(built.artifact.claim.publicEditorCoreAtomicMutation, true);
  assert.equal(built.artifact.claim.exactOwnDataEditCommandCapture, true);
  assert.equal(built.artifact.claim.hostileAccessorsSymbolsAndExtraFieldsRejected, true);
  assert.equal(built.artifact.claim.continuousSchemaRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[3], () => {
  const inspector = built.artifact.authority.source.inspector;
  const panel = built.artifact.authority.source.panel;
  assert.equal(inspector.dynamicAndStructuredLockPrecedesMutation, true);
  assert.equal(inspector.routeAndSelectionReadmissionRequired, true);
  assert.equal(panel.dynamicInteractiveControls, 0);
  assert.equal(panel.structuredInteractiveControls, 0);
  assert.equal(built.artifact.claim.dynamicValuesLocked, true);
  assert.equal(built.artifact.claim.structuredValuesLocked, true);
  assert.equal(built.artifact.claim.staleRouteAndSelectionRejected, true);
  assert.equal(built.currentCompatibility.successor.structuredJsonFallback, true);
  assert.equal(built.currentCompatibility.successor.protocolDynamicValuesLocked, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[4], () => {
  const preview = built.artifact.authority.source.preview;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(preview.publicPublisherOnly, true);
  assert.equal(preview.sourceReadmittedBeforePublication, true);
  assert.equal(preview.immutableBundleAndRevisionReturned, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherRejectionPreservesPriorSession, true);
  assert.equal(adapter.revisionReplacementDisposesPreviousSession, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.publisherFailurePreservesPriorSession, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[5], () => {
  const panel = built.artifact.authority.source.panel;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(panel.owner, "Desen App");
  assert.equal(panel.managedAdapterImports, 0);
  assert.equal(application.inspectorInsideManagedSubtree, false);
  assert.equal(adapter.inspectorImports, 0);
  assert.equal(adapter.selectionOverlayRemainsAppOwnedSibling, true);
  assert.equal(built.artifact.authority.source.css.managedDescendantSelectors, 0);
  assert.equal(built.artifact.claim.inspectorOutsideManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.selectionOverlayBoundaryRetained, true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[6], async () => {
  const second = await buildDesenAppSchemaInspectorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[7], async () => {
  assert.equal(built.currentCompatibility.successor.publicEditorCoreMutationRetained, true);
  for (const [key, relativePath] of Object.entries(SOURCE_PATHS).filter(([key]) =>
    ["authoringDataSource", "inspectorSource", "panelSource", "applicationCss"].includes(key),
  )) {
    await assert.rejects(
      buildDesenAppSchemaInspectorEvidence({
        fileOverrides: new Map([
          [relativePath, Buffer.from(`${sourcePolicyInput[key]}\n/* successor drift */\n`)],
        ]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  const slotSource = await readFile(path.join(ROOT, AUTHORING_SLOT_SOURCE_PATH), "utf8");
  await assert.rejects(
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SLOT_SOURCE_PATH,
          Buffer.from(
            slotSource.replace("evaluateAuthoringSlotPlacement", "evaluateUncheckedSlotPlacement"),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const applicationSource = await readFile(path.join(ROOT, SOURCE_PATHS.applicationSource), "utf8");
  for (const [search, replacement] of [
    [
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "dragSession.current = createAuthoringDragSession(current.epoch)",
    ],
    ["onDrop={receiveComponentDrop}", "onDrop={() => undefined}"],
    ["className={styles.componentAddAction}", "className={styles.removedComponentAddAction}"],
  ]) {
    await assert.rejects(
      buildDesenAppSchemaInspectorEvidence({
        fileOverrides: new Map([
          [
            SOURCE_PATHS.applicationSource,
            Buffer.from(applicationSource.replace(search, replacement)),
          ],
        ]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  const namedSlotArtifactBytes = await readFile(path.join(ROOT, NAMED_SLOT_ARTIFACT_PATH));
  await assert.rejects(
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([[NAMED_SLOT_ARTIFACT_PATH, changedByte(namedSlotArtifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const stateBindingArtifactBytes = await readFile(path.join(ROOT, STATE_BINDING_ARTIFACT_PATH));
  await assert.rejects(
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([
        [STATE_BINDING_ARTIFACT_PATH, changedByte(stateBindingArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const eventActionSource = await readFile(path.join(ROOT, EVENT_ACTION_SOURCE_PATH), "utf8");
  await assert.rejects(
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([
        [
          EVENT_ACTION_SOURCE_PATH,
          Buffer.from(eventActionSource.replace('ownerKind: "component"', 'ownerKind: "behavior"')),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[8], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppSchemaInspectorEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppSchemaInspectorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 3);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
});

test(DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES[9], async () => {
  const directory = await temporaryDirectory("desen-m09-t05-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppSchemaInspectorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppSchemaInspectorEvidence({
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
    writeDesenAppSchemaInspectorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppSchemaInspectorEvidence({
      artifactPath: artifactLink,
      proofDocument: exactProofDocument(built.artifactSha256),
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
    buildDesenAppSchemaInspectorEvidence({
      fileOverrides: new Map([[SOURCE_PERSISTENCE_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
