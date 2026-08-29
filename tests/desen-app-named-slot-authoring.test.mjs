import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN,
  DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES,
  DesenAppNamedSlotAuthoringProofError,
  buildDesenAppNamedSlotAuthoringEvidence,
  verifyDesenAppNamedSlotAuthoringEvidence,
  verifyDesenAppNamedSlotAuthoringSourcePolicy,
  writeDesenAppNamedSlotAuthoringEvidence,
} from "../scripts/lib/desen-app-named-slot-authoring-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const SOURCE_PATHS = Object.freeze({
  authoringDataSource: "apps/desen-app/src/authoring-data.ts",
  slotSource: "apps/desen-app/src/authoring-slots.ts",
  previewSource: "apps/desen-app/src/authoring-preview.ts",
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
});
const temporaryDirectories = [];
let parentArtifactBytes;
let sourcePolicyInput;
let fixturesScenariosArtifactBytes;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppNamedSlotAuthoringProofError && error.code === code;
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
      "# Desen App named-slot authoring",
      "",
      "Task: M09-T07",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "",
      "M09-T08: NOT_PROVEN",
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
  parentArtifactBytes = await readFile(path.join(ROOT, PARENT_PATH));
  fixturesScenariosArtifactBytes = await readFile(
    path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT_PATH),
  );
  built = await buildDesenAppNamedSlotAuthoringEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-named-slot-authoring");
  assert.equal(built.artifact.profile, "desen.app.named-slot-authoring-proof.v1");
  assert.equal(built.artifact.task, "M09-T07");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN]);
  assert.equal(built.artifact.boundary.parentArtifacts, 1);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
  assert.equal(built.currentCompatibility.successor.task, "M09-T08");
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    path: "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json",
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
  });
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[1], () => {
  const policy = verifyDesenAppNamedSlotAuthoringSourcePolicy(sourcePolicyInput);
  assert.equal(policy.authoringData.completeDeclaredSlotProjection, true);
  assert.equal(policy.authoringData.effectiveMinimumProfile, "minItems ?? (required ? 1 : 0)");
  assert.equal(policy.authoringData.explicitAcceptancePresenceRetained, true);
  assert.equal(policy.authoringData.sourcePresenceRetainedSeparately, true);
  assert.equal(policy.slots.absentSlotProjection, true);
  assert.equal(policy.slots.exactIdOrCategoryAcceptance, true);
  assert.equal(policy.slots.unrestrictedOnlyWhenAcceptanceFieldsAbsent, true);
  assert.equal(policy.slots.componentInsertionPreflight, true);
  assert.equal(policy.slots.nodeMoveAndReorderPreflight, true);
  assert.equal(policy.slots.insertionPreflightRunsPublicMutationAndValidation, true);
  assert.equal(policy.slots.placementPreflightRunsPublicMutationAndValidation, true);
  assert.equal(policy.slots.cyclePreflight, true);
  assert.equal(policy.slots.destinationMaximumBeforeInsertOrMove, true);
  assert.equal(policy.slots.absentDestinationMinimumBeforeInsertOrMove, true);
  assert.equal(policy.slots.sourceMinimumBeforeCrossSlotMove, true);
  assert.equal(built.artifact.claim.completeCatalogDeclaredSlotProjection, true);
  assert.equal(built.artifact.claim.absentAndEmptySlotsRemainDistinct, true);
  assert.equal(built.artifact.claim.pf010EffectiveMinimum, true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[2], () => {
  const slots = built.artifact.authority.source.slots;
  assert.equal(slots.publicEditorCoreOnly, true);
  assert.equal(slots.nodeDeletionPreflight, true);
  assert.equal(slots.deletionPreflightRunsPublicMutationAndValidation, true);
  assert.equal(slots.sameSlotBoundaryConvertedAfterRemoval, true);
  assert.equal(slots.rootPlacementRejected, true);
  assert.equal(slots.rootDeletionRejected, true);
  assert.equal(slots.cyclesPreflightedBeforePublicEditorCoreMove, true);
  assert.equal(slots.deterministicStableIdInsert, true);
  assert.equal(slots.publicNestedSubtreeDelete, true);
  assert.equal(slots.sourceMinimumBeforeDelete, true);
  assert.equal(slots.validatedSourceSnapshotMutation, true);
  assert.equal(slots.noPartialDocumentOrIdentityOnFailure, true);
  assert.equal(built.artifact.claim.publicStableIdInsert, true);
  assert.equal(built.artifact.claim.publicCrossSlotMove, true);
  assert.equal(built.artifact.claim.publicSameSlotReorder, true);
  assert.equal(built.artifact.claim.publicNestedSubtreeDelete, true);
  assert.equal(built.artifact.claim.pf080BoundaryConversion, true);
  assert.equal(built.artifact.claim.nodeAndBehaviorOwnersSupported, true);
  assert.equal(built.artifact.claim.stableIdentityPreserved, true);
  assert.equal(built.artifact.claim.rootsAndCyclesFailClosed, true);
  assert.equal(built.artifact.claim.rootDeletionDisabled, true);
  assert.equal(built.artifact.claim.sourceMinimumDeletionDisabled, true);
  assert.equal(built.artifact.claim.behaviorOwnedDeletePreservesEmptySlot, true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[3], () => {
  const slots = built.artifact.authority.source.slots;
  assert.equal(slots.exactRouteSelectionAndEditCapture, true);
  assert.equal(slots.exactComponentDeletionSelectionCapture, true);
  assert.equal(slots.editDescriptorsCapturedOnce, true);
  assert.equal(slots.defaultPropTransitionLimit, 256);
  assert.equal(slots.defaultPropWorkByteLimit, 32 * 1_024 * 1_024);
  assert.equal(slots.defaultPropWidthCheckedBeforeSort, true);
  assert.equal(slots.validatorPreparationCachedPerModel, true);
  assert.equal(slots.insertionAdmissionCachedPerModelAndExactTarget, true);
  assert.equal(slots.placementAdmissionCachedPerModelAndExactTarget, true);
  assert.equal(slots.admissionCacheKeysExcludeBoundaryIndex, true);
  assert.equal(slots.cachedPlacementBaseMaterializesBoundaryFinalIndex, true);
  assert.equal(slots.cachedAdmissionsRejectOutOfRangeBoundary, true);
  assert.equal(slots.minimalRequiredSlotInsertFailsClosed, true);
  assert.equal(slots.completeSourceRevalidation, true);
  assert.equal(slots.deletionCompleteSourceRevalidation, true);
  assert.equal(slots.noPartialDocumentOnDeleteFailure, true);
  assert.equal(built.artifact.claim.exactOwnDataRouteSelectionAndEditCapture, true);
  assert.equal(built.artifact.claim.exactOwnDataDeletionSelectionCapture, true);
  assert.equal(built.artifact.claim.boundedDefaultPropStaging, true);
  assert.equal(built.artifact.claim.continuousCompleteSourceRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
  assert.equal(built.artifact.claim.failedDeletionPreservesCurrentDocument, true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[4], () => {
  const application = built.currentCompatibility.source.application;
  const adapter = built.currentCompatibility.source.adapter;
  const css = built.currentCompatibility.source.css;
  assert.equal(application.appOwnedDragIntent, true);
  assert.equal(application.browserPayloadIsInertHint, true);
  assert.equal(application.declaredAbsentSlotsVisible, true);
  assert.equal(application.linearDeclaredPresentJoin, true);
  assert.equal(application.orderedBoundaryControls, true);
  assert.equal(application.expandedNonOverlappingDropReadyBoundaries, true);
  assert.equal(application.rowHalfDropTargets, true);
  assert.equal(application.rowGeometryUsedOnlyForBoundedDropProjection, true);
  assert.equal(application.stableNestedDragHoverTracking, true);
  assert.equal(application.invalidPlacementControlsDisabled, true);
  assert.equal(application.sameSlotNoOpControlsDisabled, true);
  assert.equal(application.explicitComponentDropTarget, true);
  assert.equal(application.stickyComponentDropTarget, true);
  assert.equal(application.componentDragGuidance, true);
  assert.equal(application.slotlessDisabledPlacementGuide, true);
  assert.equal(application.browserDataTransferReads, 0);
  assert.equal(application.componentPaletteRenderLimit, 24);
  assert.equal(application.completeFilteredMatchCountRetained, true);
  assert.equal(application.inactiveLayerTreeNotRendered, true);
  assert.equal(application.inactiveComponentPaletteShortCircuited, true);
  assert.equal(application.activeTabOnlyAuthoringWork, true);
  assert.equal(application.publicNodeDeletionPreflight, true);
  assert.equal(application.invalidDeletionControlsDisabled, true);
  assert.equal(application.deletionReasonAssociatedWithControl, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.deletionSourceAndPreviewCommitAtomically, true);
  assert.equal(application.successfulDeletionClearsSelection, true);
  assert.equal(application.successfulInsertionSelectsNewLayer, true);
  assert.equal(application.deletionFocusReturnsToLayersTab, true);
  assert.equal(application.failedDeletionPreservesSelectionAndFocus, true);
  assert.equal(application.slotChromeOutsideManagedCapabilitySubtree, true);
  assert.equal(adapter.managedSubtreeExplicit, true);
  assert.equal(adapter.selectionOverlayRemainsSibling, true);
  assert.equal(css.managedDescendantSlotSelectors, 0);
  assert.equal(css.expandedNonOverlappingDropBoundaries, true);
  assert.equal(css.rowDropPositionPresentation, true);
  assert.equal(css.stableHoveredDropPresentation, true);
  assert.equal(css.stickyComponentTargetPresentation, true);
  assert.equal(css.slotlessTargetGuidePresentation, true);
  assert.equal(built.artifact.claim.appOwnedInertDragHints, true);
  assert.equal(built.artifact.claim.browserDataTransferReadsZero, true);
  assert.equal(built.artifact.claim.expandedDropReadyBoundaries, true);
  assert.equal(built.artifact.claim.stableNestedDragHover, true);
  assert.equal(built.artifact.claim.explicitComponentDropTargetGuide, true);
  assert.equal(built.artifact.claim.componentInsertionPreflight, true);
  assert.equal(built.artifact.claim.nodeMoveAndReorderPreflight, true);
  assert.equal(built.artifact.claim.invalidPlacementControlsDisabled, true);
  assert.equal(built.artifact.claim.insertionPreflightRunsPublicMutationAndValidation, true);
  assert.equal(built.artifact.claim.placementPreflightRunsPublicMutationAndValidation, true);
  assert.equal(built.artifact.claim.cyclePreflight, true);
  assert.equal(built.artifact.claim.sameSlotNoOpControlsDisabled, true);
  assert.equal(built.artifact.claim.insertionAdmissionCachedPerModelAndExactTarget, true);
  assert.equal(built.artifact.claim.placementAdmissionCachedPerModelAndExactTarget, true);
  assert.equal(built.artifact.claim.cachedPlacementBaseMaterializesBoundaryFinalIndex, true);
  assert.equal(built.artifact.claim.componentPaletteRenderLimit, 24);
  assert.equal(built.artifact.claim.activeTabOnlyAuthoringWork, true);
  assert.equal(built.artifact.claim.keyboardPlacementControl, true);
  assert.equal(built.artifact.claim.publisherSessionPreview, true);
  assert.equal(built.artifact.claim.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.deletionSourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.deletionFocusManaged, true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[5], () => {
  const evidence = built.artifact.tests;
  assert.equal(evidence.rootTestNames.length, 9);
  assert.equal(evidence.semanticCoverage.includes("PF_010_EFFECTIVE_MINIMUM"), true);
  assert.equal(evidence.semanticCoverage.includes("PF_080_BOUNDARY_CONVERSION"), true);
  assert.equal(evidence.semanticCoverage.includes("DEFAULT_PROP_STAGING_BOUNDS"), true);
  assert.equal(
    evidence.semanticCoverage.includes("ONE_THOUSAND_TWENTY_FIVE_CACHED_BOUNDARIES"),
    true,
  );
  assert.equal(evidence.semanticCoverage.includes("ATOMIC_PUBLISHER_PREVIEW"), true);
  assert.equal(evidence.semanticCoverage.includes("PUBLIC_NESTED_SUBTREE_DELETE"), true);
  assert.equal(evidence.semanticCoverage.includes("STABLE_NESTED_DRAG_HOVER"), true);
  assert.equal(evidence.semanticCoverage.includes("DATA_TRANSFER_READS_ZERO"), true);
  assert.deepEqual(evidence.localCommandReceipts, {
    pureSlot: {
      command: "pnpm --filter @desen/app-web exec vitest run test/authoring-slots.test.ts",
      result: "PASS",
      testFiles: 1,
      tests: 27,
    },
    focusedNamedSlots: {
      command: "pnpm --filter @desen/app-web test:named-slots",
      result: "PASS",
      testFiles: 5,
      tests: 70,
    },
    fullApp: {
      command: "pnpm --filter @desen/app-web test",
      result: "PASS",
      testFiles: 11,
      tests: 151,
    },
    rootProof: {
      command: "node --test tests/desen-app-named-slot-authoring.test.mjs",
      result: "PASS",
      testFiles: 1,
      tests: 9,
    },
  });
  assert.equal(
    built.artifact.application.package.appTestCommand,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.artifact.application.package.rootCommands["verify:desen-app-named-slot-authoring"],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node scripts/verify-desen-app-named-slot-authoring.mjs",
  );
  assert.equal(built.artifact.application.package.parentAuthenticatedInsideReader, true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[6], async () => {
  const second = await buildDesenAppNamedSlotAuthoringEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[7], () => {
  const mutations = [
    {
      ...sourcePolicyInput,
      authoringDataSource: replaceOnce(
        sourcePolicyInput.authoringDataSource,
        'Object.hasOwn(slot, "minItems")',
        "slot.minItems !== undefined",
      ),
    },
    {
      ...sourcePolicyInput,
      slotSource: replaceOnce(
        sourcePolicyInput.slotSource,
        "const keys = Reflect.ownKeys(edit)",
        "const keys = Object.keys(edit)",
      ),
    },
    {
      ...sourcePolicyInput,
      slotSource: replaceOnce(
        sourcePolicyInput.slotSource,
        "  deleteDesenEditorNode,",
        "  privateDeleteDesenEditorNode,",
      ),
    },
    {
      ...sourcePolicyInput,
      slotSource: replaceOnce(
        sourcePolicyInput.slotSource,
        "maxDefaultPropTransitions: 256",
        "maxDefaultPropTransitions: 512",
      ),
    },
    {
      ...sourcePolicyInput,
      slotSource: replaceOnce(
        sourcePolicyInput.slotSource,
        "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
        "const INSERTION_ADMISSION_BY_MODEL = new Map<",
      ),
    },
    {
      ...sourcePolicyInput,
      slotSource: replaceOnce(
        sourcePolicyInput.slotSource,
        "capturedEdit.index > placement.index ? capturedEdit.index - 1 : capturedEdit.index",
        "capturedEdit.index",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: `${sourcePolicyInput.applicationSource}\nevent.dataTransfer.getData`,
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "data-drop-hovered={dropReady && dropHovered}",
        "data-drop-hovered={false}",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "function projectNearestDrop(",
        "function uncheckedNearestDrop(",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "sourceNodeId: result.nodeId",
        "sourceNodeId: selection?.sourceNodeId ?? result.nodeId",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "applyAuthoringNodeDelete(document, referenceCatalog, route, selection)",
        "applyAuthoringSlotEdit(document, referenceCatalog, route, selection as never, {} as never)",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "const COMPONENT_PALETTE_RENDER_LIMIT = 24",
        "const COMPONENT_PALETTE_RENDER_LIMIT = 48",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationSource: replaceOnce(
        sourcePolicyInput.applicationSource,
        "if (!active) return null",
        "if (!active) void active",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        '.slotBoundary[data-drop-ready="true"] .slotBoundaryLine',
        ".slotBoundary .slotBoundaryLine",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 2rem;\n  align-items: center;\n  padding: 0 0.125rem;",
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  align-items: center;\n  padding: 0;",
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
        '.slotBoundary[data-drop-disabled="true"] .slotBoundaryLine',
      ),
    },
    {
      ...sourcePolicyInput,
      applicationCss: replaceOnce(
        sourcePolicyInput.applicationCss,
        ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
        ".componentSlotTarget {\n  position: relative;\n  top: 0;",
      ),
    },
  ];
  for (const [index, mutation] of mutations.entries()) {
    assert.throws(
      () => verifyDesenAppNamedSlotAuthoringSourcePolicy(mutation),
      expectedError("SOURCE_POLICY_VIOLATION"),
      `mutation ${index} must fail closed`,
    );
  }
});

test(DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES[8], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppNamedSlotAuthoringEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.task, "M09-T07");
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.deepEqual(verified.localTestCounts, {
    pureSlot: 27,
    focusedNamedSlots: 70,
    fullApp: 151,
    rootProof: 9,
  });

  await assert.rejects(
    verifyDesenAppNamedSlotAuthoringEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppNamedSlotAuthoringEvidence({
      parentArtifactBytes: changedByte(parentArtifactBytes),
    }),
    expectedError("PARENT_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppNamedSlotAuthoringEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    verifyDesenAppNamedSlotAuthoringEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Status: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t07-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeDesenAppNamedSlotAuthoringEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  await assert.rejects(
    writeDesenAppNamedSlotAuthoringEvidence({
      artifactPath,
      beforeAtomicRename: () => {
        throw new Error("injected-before-rename failure");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const linkedArtifactPath = path.join(directory, "linked-artifact.json");
  await symlink(artifactPath, linkedArtifactPath);
  await assert.rejects(
    verifyDesenAppNamedSlotAuthoringEvidence({
      artifactPath: linkedArtifactPath,
      proofDocument,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const forgedParentPath = path.join(directory, "forged-parent.json");
  await writeFile(forgedParentPath, changedByte(parentArtifactBytes));
  assert.notDeepEqual(await readFile(forgedParentPath), parentArtifactBytes);
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
    buildDesenAppNamedSlotAuthoringEvidence({
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
    buildDesenAppNamedSlotAuthoringEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
