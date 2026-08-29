import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN,
  DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES,
  DesenAppStructuredInspectorProofError,
  buildDesenAppStructuredInspectorEvidence,
  verifyDesenAppStructuredInspectorEvidence,
  verifyDesenAppStructuredInspectorSourcePolicy,
  writeDesenAppStructuredInspectorEvidence,
} from "../scripts/lib/desen-app-structured-inspector-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_PATH = "apps/desen-app/src/event-action-panel.tsx";
const EVENT_ACTION_TEST_PATH = "apps/desen-app/test/authoring-event-actions.test.ts";
const EVENT_ACTION_PANEL_TEST_PATH = "apps/desen-app/test/event-action-panel.test.tsx";
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  inspectorSource: "apps/desen-app/src/authoring-inspector.ts",
  structuredJsonSource: "apps/desen-app/src/structured-json.ts",
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
  return (error) => error instanceof DesenAppStructuredInspectorProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function replaceOnce(source, search, replacement) {
  assert.equal(source.includes(search), true, `Mutation anchor not found: ${search}`);
  return source.replace(search, replacement);
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App structured inspector",
      "",
      "Task: M09-T06",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
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
  sourcePolicyInput = Object.fromEntries(
    await Promise.all(
      Object.entries(SOURCE_PATHS).map(async ([key, relativePath]) => [
        key,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  parentArtifactBytes = await readFile(path.join(ROOT, PARENT_PATH));
  fixturesScenariosArtifactBytes = await readFile(
    path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT_PATH),
  );
  built = await buildDesenAppStructuredInspectorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-structured-inspector");
  assert.equal(built.artifact.profile, "desen.app.structured-inspector-proof.v1");
  assert.equal(built.artifact.task, "M09-T06");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_STRUCTURED_INSPECTOR_PARENT_PIN]);
  assert.equal(built.artifact.boundary.parentArtifacts, 1);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
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
    built.currentCompatibility.successor.package.rootCommands[
      "test:desen-app-named-slot-authoring"
    ],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node --test tests/desen-app-named-slot-authoring.test.mjs",
  );
  assert.equal(
    built.currentCompatibility.successor.package.stateBindingTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-state.test.ts test/authoring-inspector.test.ts test/state-panel.test.tsx test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.successor.package.stateBindingRootCommands[
      "test:desen-app-state-binding-editor"
    ],
    "node scripts/verify-desen-app-schema-inspector.mjs && node scripts/verify-editor-core-state-binding-edits.mjs && node scripts/verify-desen-app-named-slot-authoring.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:state-bindings && node --test tests/desen-app-state-binding-editor.test.mjs",
  );
  assert.equal(
    built.currentCompatibility.successor.package.eventActionTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-data.test.ts test/authoring-selection.test.ts test/authoring-event-actions.test.ts test/event-action-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.successor.package.eventActionRootCommands[
      "test:desen-app-event-action-editor"
    ],
    "node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-editor-core-event-action-edits.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:event-actions && node --test tests/desen-app-event-action-editor.test.mjs",
  );
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[1], () => {
  const policy = verifyDesenAppStructuredInspectorSourcePolicy(sourcePolicyInput);
  assert.equal(policy.authoringData.publicCatalogSdkDerivation, true);
  assert.equal(policy.authoringData.recursiveControlPlanRetained, true);
  assert.equal(policy.authoringData.validationDocumentSnapshotRetained, true);
  assert.equal(policy.inspector.recursiveGroupProjection, true);
  assert.equal(policy.inspector.canonicalValuePointerReadmission, true);
  assert.equal(policy.inspector.accessibleQualifiedNameDisambiguation, true);
  assert.equal(policy.panel.recursiveGroupPresentation, true);
  assert.equal(policy.panel.semanticNestedGroupFieldsets, true);
  assert.deepEqual(policy.panel.fallbackReasons, [
    "array",
    "open-object",
    "multi-type",
    "reference",
    "combinator",
    "conditional",
    "pattern",
    "unsupported-schema",
    "derivation-limit",
  ]);
  assert.equal(built.artifact.claim.recursiveClosedObjectControls, true);
  assert.equal(built.artifact.claim.canonicalRfc6901Pointers, true);
  assert.equal(built.artifact.claim.completeFallbackReasonMatrix, true);
  assert.equal(built.artifact.claim.structuredJsonFallbackVisibleAndEditable, true);
  assert.equal(built.artifact.claim.accessibleDuplicateAndEmptyPropertyNames, true);
  assert.equal(built.artifact.claim.semanticNestedGroupFieldsets, true);
  assert.equal(built.artifact.authority.fallback.referenceCatalogHasNestedFallbackFixture, false);
  assert.equal(built.artifact.authority.fallback.syntheticAppTestsRequired, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[2], () => {
  const structured = built.artifact.authority.source.structuredJson;
  assert.equal(structured.parserProfile, "strict-bounded-json");
  assert.equal(structured.malformedAndNonFiniteRejected, true);
  assert.equal(structured.duplicateDecodedMembersRejected, true);
  assert.equal(structured.invalidUnicodeRejected, true);
  assert.deepEqual(structured.publisherLimitsEnforced, [
    "maxSourceUtf8Bytes",
    "maxDecodedStringCodeUnits",
    "maxNumberTokenCodeUnits",
    "maxJsonDepth",
    "maxJsonValueOccurrences",
  ]);
  assert.equal(structured.dynamicMemberNamesRejected, true);
  assert.equal(structured.detachedRecursivelyFrozenResult, true);
  assert.equal(structured.deterministicPrettyFormatting, true);
  assert.equal(structured.canonicalCompactFallbackForPrettyLimit, true);
  assert.equal(structured.boundedPrettyFormattingConstruction, true);
  assert.equal(built.artifact.claim.strictBoundedStructuredJsonCapture, true);
  assert.equal(built.artifact.claim.publisherJsonLimitsEnforced, true);
  assert.equal(built.artifact.claim.admittedStructuredJsonRemainsEditableAtPrettyLimit, true);
  assert.equal(built.artifact.claim.boundedPrettyFormattingConstruction, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[3], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.equal(inspector.nestedTopOwnerRebuild, true);
  assert.equal(inspector.deterministicWholePropsTransition, true);
  assert.equal(inspector.rootDeleteBeforeSetTransition, true);
  assert.equal(inspector.rootReducingSetsBeforeGrowth, true);
  assert.equal(inspector.unchangedRootPropsSkipped, true);
  assert.equal(inspector.rootTransitionCountLimit, 256);
  assert.equal(inspector.rootTransitionWorkByteLimit, 32 * 1024 * 1024);
  assert.equal(inspector.rootTransitionBudgetBeforeEditorCoreLoop, true);
  assert.equal(inspector.semanticRootNoOpReturnsValidatedDocument, true);
  assert.equal(inspector.validatedSourceSnapshotMutation, true);
  assert.equal(inspector.publicEditorCoreOnly, true);
  assert.equal(inspector.completeSourceRevalidation, true);
  assert.equal(inspector.noPartialDocumentOnFailure, true);
  assert.equal(built.artifact.claim.publicEditorCoreNestedMutation, true);
  assert.equal(built.artifact.claim.completeTopLevelOwnerRebuild, true);
  assert.equal(built.artifact.claim.rootPropsDeleteBeforeSet, true);
  assert.equal(built.artifact.claim.rootPropsShrinkBeforeGrowth, true);
  assert.equal(built.artifact.claim.unchangedRootPropsSkipped, true);
  assert.equal(built.artifact.claim.boundedSynchronousRootTransitions, true);
  assert.equal(built.artifact.claim.semanticRootNoOpSucceedsWithValidatedDocument, true);
  assert.equal(built.artifact.claim.validatedSourceSnapshotMutation, true);
  assert.equal(built.artifact.claim.continuousSchemaRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[4], () => {
  const inspector = built.artifact.authority.source.inspector;
  assert.equal(inspector.exactOwnDataEditCapture, true);
  assert.equal(inspector.exactOwnDataRouteAndSelectionCapture, true);
  assert.equal(inspector.detachedJsonCapture, true);
  assert.equal(inspector.dynamicLockBeforeMutation, true);
  assert.equal(inspector.dynamicAncestorLockBeforeMutation, true);
  assert.equal(inspector.routeSelectionAndControlReadmission, true);
  assert.equal(built.artifact.claim.dynamicValuesLocked, true);
  assert.equal(built.artifact.claim.dynamicAncestorGroupsLocked, true);
  assert.equal(built.artifact.claim.exactOwnDataRouteAndSelectionCapture, true);
  assert.equal(built.artifact.claim.controlHintsRemainOpaque, true);
  assert.equal(built.artifact.claim.staleRouteSelectionAndPointerRejected, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[5], () => {
  const preview = built.artifact.authority.source.preview;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(preview.publicPublisherOnly, true);
  assert.equal(preview.sourceReadmittedBeforePublication, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherFailurePreservesPriorSession, true);
  assert.equal(adapter.revisionReplacementDisposesPreviousSession, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.publisherFailurePreservesPriorSession, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[6], () => {
  const panel = built.artifact.authority.source.panel;
  const application = built.artifact.authority.source.application;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(panel.owner, "Desen App");
  assert.equal(panel.managedAdapterImports, 0);
  assert.equal(panel.accessibleErrorAndStatusFeedback, true);
  assert.equal(panel.memoizedStructuredFormatting, true);
  assert.equal(panel.canonicalNumericDraftAfterCommit, true);
  assert.equal(panel.singleInlineValidationAlertPerDraft, true);
  assert.equal(panel.helpDescriptionRetainedWithInlineError, true);
  assert.equal(panel.dynamicAncestorUnsetHidden, true);
  assert.equal(panel.stableInspectorFieldIdentity, true);
  assert.equal(panel.valueKindFocusHandoff, true);
  assert.equal(panel.semanticReplacementFocusTargets, true);
  assert.equal(application.inspectorInsideManagedSubtree, false);
  assert.equal(adapter.inspectorImports, 0);
  assert.equal(adapter.selectionOverlayRemainsAppOwnedSibling, true);
  assert.equal(built.artifact.authority.source.css.managedDescendantSelectors, 0);
  assert.equal(built.artifact.claim.inspectorOutsideManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.selectionOverlayBoundaryRetained, true);
  assert.equal(built.artifact.claim.memoizedStructuredFormatting, true);
  assert.equal(built.artifact.claim.canonicalNumericDraftWithInlineErrors, true);
  assert.equal(built.artifact.claim.describedHelpRetainedWithInlineErrors, true);
  assert.equal(built.artifact.claim.valueKindReplacementFocusHandoff, true);
  assert.equal(built.artifact.claim.stableInspectorFieldIdentity, true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[7], async () => {
  const second = await buildDesenAppStructuredInspectorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[8], () => {
  const mutations = [
    {
      ...sourcePolicyInput,
      authoringDataSource: replaceOnce(
        sourcePolicyInput.authoringDataSource,
        "deriveComponentInspectorControls(",
        "deriveManualInspectorControls(",
      ),
    },
    {
      ...sourcePolicyInput,
      authoringDataSource: replaceOnce(
        sourcePolicyInput.authoringDataSource,
        "validationDocument: sourceResult.value",
        "validationDocument: sourceValue",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        'captureExactOwnData(route, ["projectId", "surfaceId"])',
        'captureLooseOwnData(route, ["projectId", "surfaceId"])',
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "captureExactOwnData(selection, [",
        "captureLooseOwnData(selection, [",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "parseJsonPointer(capturedEdit.valuePointer)",
        "[]",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
        "createUncheckedValidator(prepared.model.validationCatalogs)",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "prepared.model.validationDocument",
        "document",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "for (const property of deletions)",
        "for (const property of sets)",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const MAX_ROOT_PROP_TRANSITIONS = 256",
        "const MAX_ROOT_PROP_TRANSITIONS = 2_560",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const MAX_ROOT_TRANSITION_WORK_BYTES = 32 * 1024 * 1024",
        "const MAX_ROOT_TRANSITION_WORK_BYTES = 320 * 1024 * 1024",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "canonicalizeJson(currentValue) === canonicalizeJson(nextPropertyValue)",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "const sets = [...reducingSets.sort(), ...growingSets.sort()]",
        "const sets = [...growingSets.sort(), ...reducingSets.sort()]",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "transitionCount > MAX_ROOT_PROP_TRANSITIONS",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "if (transitionCount === 0) return document;",
        "if (transitionCount === 0) return undefined;",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        "snapshotBytes > Math.floor(MAX_ROOT_TRANSITION_WORK_BYTES / transitionCount)",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        'field.control.kind === "group" && field.containsDynamicValue',
        'field.control.kind === "group" && false',
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        '? `${label} (${control.valuePointer || "/"})` : label',
        "? label : label",
      ),
    },
    {
      ...sourcePolicyInput,
      inspectorSource: replaceOnce(
        sourcePolicyInput.inspectorSource,
        '? "Unnamed property"',
        '? ""',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'return "duplicate-member"',
        'return "invalid-json"',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'key.value.startsWith("$")',
        'key.value.endsWith("$")',
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        'measureUtf8Bytes(formatted) === "limit-exceeded" ? canonicalizeJson(value) : formatted',
        "formatted",
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        "state.codeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      structuredJsonSource: replaceOnce(
        sourcePolicyInput.structuredJsonSource,
        "if (state.limitExceeded) return canonicalizeJson(value);",
        "if (false) return canonicalizeJson(value);",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        '"open-object": "Open object schema"',
        '"open-object-disabled": "Open object schema"',
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        replaceOnce(sourcePolicyInput.panelSource, "<fieldset", "<div"),
        "</fieldset>",
        "</div>",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "<legend className={styles.visuallyHidden}>{field.qualifiedLabel} group</legend>",
        "<span className={styles.visuallyHidden}>{field.qualifiedLabel} group</span>",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "const current = useMemo(",
        "const current = noMemo(",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "setDraft(String(value));",
        "setDraft(draft);",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        'id={errorId} role="alert"',
        'id={errorId} role="status"',
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        ") : null}\n      {field.description === undefined ? null : (",
        ") : field.description === undefined ? null : (",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "field.containsDynamicValue ||",
        "false ||",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "useLayoutEffect(() => {",
        "useEffect(() => {",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "previousValueKind.current !== field.value.kind",
        "false",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "focusTarget.current?.focus()",
        "void focusTarget.current",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}`}",
        "key={`${inspector.selection.sourceNodeId}:${field.control.valuePointer}:${field.value.kind}`}",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(sourcePolicyInput.panelSource, "tabIndex={-1}", "tabIndex={0}"),
    },
    {
      ...sourcePolicyInput,
      panelSource: replaceOnce(
        sourcePolicyInput.panelSource,
        "ref={focusTargetRef}",
        "ref={undefined}",
      ),
    },
    {
      ...sourcePolicyInput,
      panelSource: `${sourcePolicyInput.panelSource}\nvoid document.querySelector('textarea');\n`,
    },
    {
      ...sourcePolicyInput,
      applicationSource: sourcePolicyInput.applicationSource.replaceAll(
        "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
        "commitAuthoringSession(Object.freeze({ document: result.document, preview }))",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        ".structuredTextarea",
        "[data-managed-capability-subtree] .structuredTextarea",
      ),
    },
  ];
  for (const [mutationIndex, mutation] of mutations.entries()) {
    assert.throws(
      () => verifyDesenAppStructuredInspectorSourcePolicy(mutation),
      expectedError("SOURCE_POLICY_VIOLATION"),
      `source-policy mutation ${mutationIndex} must fail closed`,
    );
  }
});

test(DESEN_APP_STRUCTURED_INSPECTOR_ROOT_TEST_NAMES[9], async () => {
  const slotSource = await readFile(path.join(ROOT, AUTHORING_SLOT_SOURCE_PATH), "utf8");
  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
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
      buildDesenAppStructuredInspectorEvidence({
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
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([[NAMED_SLOT_ARTIFACT_PATH, changedByte(namedSlotArtifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const stateBindingArtifactBytes = await readFile(path.join(ROOT, STATE_BINDING_ARTIFACT_PATH));
  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([
        [STATE_BINDING_ARTIFACT_PATH, changedByte(stateBindingArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const eventActionSource = await readFile(path.join(ROOT, EVENT_ACTION_SOURCE_PATH), "utf8");
  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([
        [
          EVENT_ACTION_SOURCE_PATH,
          Buffer.from(eventActionSource.replace('ownerKind: "component"', 'ownerKind: "behavior"')),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  await assert.rejects(
    buildDesenAppStructuredInspectorEvidence({
      parentArtifactBytes: changedByte(parentArtifactBytes),
    }),
    expectedError("PARENT_DRIFT"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppStructuredInspectorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 1);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t06-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppStructuredInspectorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppStructuredInspectorEvidence({
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
    writeDesenAppStructuredInspectorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppStructuredInspectorEvidence({
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
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([[SOURCE_PERSISTENCE_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});

test("[successor] authenticates and mutation-tests the exact M09-T13 diagnostics closure", async () => {
  const successor = built.currentCompatibility.nodeLinkedDiagnosticsSuccessor;
  assert.deepEqual(successor.artifact, {
    task: "M09-T13",
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    result: "PASS",
    path: NODE_LINKED_DIAGNOSTICS_ARTIFACT,
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
  });
  assert.deepEqual(
    {
      focusedTestCases: successor.focusedTestCases,
      fullAppTestFiles: successor.fullAppTestFiles,
      fullAppTestCases: successor.fullAppTestCases,
      trackedFiles: successor.trackedFiles,
      parentArtifacts: successor.parentArtifacts,
      rootTests: successor.rootTests,
      explicitContextIdentityMappingOnly: successor.explicitContextIdentityMappingOnly,
      diagnosticCodeMessagePointerIdentityInference:
        successor.diagnosticCodeMessagePointerIdentityInference,
      duplicateOccurrenceOrderPreserved: successor.duplicateOccurrenceOrderPreserved,
      unmappedDiagnosticsSelectable: successor.unmappedDiagnosticsSelectable,
      snapshotAndRouteFenced: successor.snapshotAndRouteFenced,
      runtimeKindMismatchFailsClosed: successor.runtimeKindMismatchFailsClosed,
      invalidPlaceholderInsideManagedRuntimeSubtree:
        successor.invalidPlaceholderInsideManagedRuntimeSubtree,
      runModeDiagnosticsVisible: successor.runModeDiagnosticsVisible,
      automaticFocusSteal: successor.automaticFocusSteal,
      obligationsExecutable: successor.obligationsExecutable,
      rejectedDiagnosticsPersisted: successor.rejectedDiagnosticsPersisted,
      rejectedDiagnosticsAffectDirtyState: successor.rejectedDiagnosticsAffectDirtyState,
      rejectedDiagnosticsIncludedInSave: successor.rejectedDiagnosticsIncludedInSave,
      p16Status: successor.p16Status,
      pf086Status: successor.pf086Status,
    },
    {
      focusedTestCases: 161,
      fullAppTestFiles: 24,
      fullAppTestCases: 339,
      trackedFiles: 39,
      parentArtifacts: 11,
      rootTests: 12,
      explicitContextIdentityMappingOnly: true,
      diagnosticCodeMessagePointerIdentityInference: false,
      duplicateOccurrenceOrderPreserved: true,
      unmappedDiagnosticsSelectable: false,
      snapshotAndRouteFenced: true,
      runtimeKindMismatchFailsClosed: true,
      invalidPlaceholderInsideManagedRuntimeSubtree: false,
      runModeDiagnosticsVisible: false,
      automaticFocusSteal: false,
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
    buildDesenAppStructuredInspectorEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
