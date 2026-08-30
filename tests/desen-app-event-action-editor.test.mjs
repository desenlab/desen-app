import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS,
  DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES,
  DesenAppEventActionEditorProofError,
  buildDesenAppEventActionEditorEvidence,
  verifyDesenAppEventActionEditorEvidence,
  verifyDesenAppEventActionEditorSourcePolicy,
  writeDesenAppEventActionEditorEvidence,
} from "../scripts/lib/desen-app-event-action-editor-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze(
  DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS.map(({ path: relativePath }) => relativePath),
);
const SOURCE_PATHS = Object.freeze({
  eventActionSource: "apps/desen-app/src/authoring-event-actions.ts",
  eventActionPanel: "apps/desen-app/src/event-action-panel.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
});
const DESIGN_RUN_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLICATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
const SELF_READER_PATH = "scripts/lib/desen-app-event-action-editor-proof.mjs";
const temporaryDirectories = [];
let parentArtifactBytes;
let successorArtifactBytes;
let fixturesScenariosArtifactBytes;
let selfReaderBytes;
let sourcePolicyInput;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppEventActionEditorProofError && error.code === code;
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

function replaceOnceAfter(source, anchor, search, replacement) {
  const anchorIndex = source.indexOf(anchor);
  assert.notEqual(anchorIndex, -1, `Missing mutation anchor ${anchor}`);
  const index = source.indexOf(search, anchorIndex + anchor.length);
  assert.notEqual(index, -1, `Missing mutation marker ${search} after ${anchor}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App event and closed-action editor",
      "",
      "Task: M09-T09",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "PF-025: OPEN",
      "PF-083: OPEN",
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
  [successorArtifactBytes, fixturesScenariosArtifactBytes, selfReaderBytes] = await Promise.all([
    readFile(path.join(ROOT, DESIGN_RUN_ARTIFACT_PATH)),
    readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT_PATH)),
    readFile(path.join(ROOT, SELF_READER_PATH)),
  ]);
  built = await buildDesenAppEventActionEditorEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-event-action-editor");
  assert.equal(built.artifact.profile, "desen.app.event-action-editor-proof.v1");
  assert.equal(built.artifact.task, "M09-T09");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 2);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
  assert.equal(built.artifactBytes.byteLength > 0, true);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
  assert.equal(built.currentCompatibility.successor.task, "M09-T10");
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    path: DESIGN_RUN_ARTIFACT_PATH,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
  });
  assert.equal(built.currentCompatibility.successor.oneImmutableSourceAndBundleSession, true);
  assert.equal(built.currentCompatibility.successor.zeroRuntimeRemountOrDisposeOnToggle, true);
  assert.equal(built.currentCompatibility.successor.sameManagedCapabilitySubtreeOnToggle, true);
  assert.equal(built.currentCompatibility.successor.exactAdapterStateSetExecution, true);
  assert.equal(built.currentCompatibility.successor.centralRunAuthoringGuards, true);
  assert.equal(built.currentCompatibility.successor.externalHostPortsDeniedOrInert, true);
  assert.equal(built.currentCompatibility.successor.focusedDesignRunTests, 44);
  assert.equal(built.currentCompatibility.successor.fullAppTests, 210);
  assert.equal(built.currentCompatibility.successor.fixturesAndScenariosImplemented, false);
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.pf028Status, "CLOSED");
  assert.deepEqual(built.currentCompatibility.retainedAuthoringUx, {
    rootSafeDefaultPlacementTarget: true,
    explicitChangeTarget: true,
    stableCompactLayerGaps: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    guardedLastAcceptedProjection: true,
    releaseDriftRetainsLastAcceptedProjection: true,
    nestedSlotSurfaceOwnsDropEvents: true,
    explicitNoOpPlacementFeedback: true,
    componentDragAuthorityLimitedToDedicatedHandle: true,
    dedicatedLayerDragHandle: true,
    componentPanelWideDropSurface: true,
    stickyComponentTargetDirectDropSurface: true,
    separateNonDraggableComponentAddAction: true,
    visibleSelectedLayerDeleteControl: true,
    guardedDeleteAndBackspace: true,
    namedSlotAndValidatorAuthorityChanged: false,
    arbitraryCanvasGeometryOrDropClaimed: false,
    nativeBrowserDragE2eClaimed: false,
  });
  assert.equal(built.currentCompatibility.boundary.retainedHistoricalReceipts, 17);
  assert.equal(built.currentCompatibility.boundary.successorCompatibilityPaths, 70);
  assert.equal(built.currentCompatibility.boundary.currentPathReceipts.length, 71);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[1], () => {
  const authority = built.artifact.authority.source.eventAction;
  assert.deepEqual(authority.appOwnerKinds, ["component"]);
  assert.equal(authority.behaviorOwnerUiClaimed, false);
  assert.equal(authority.catalogDeclaredEventsOnly, true);
  assert.equal(authority.absentEmptyAndPresentLifecycle, true);
  assert.equal(authority.canonicalEscapedPointers, true);
  assert.equal(authority.freshOwnerAndPointerAuthorization, true);
  assert.equal(built.artifact.claim.catalogDeclaredEventProjection, true);
  assert.equal(built.artifact.claim.exactSelectedComponentOwner, true);
  assert.equal(built.artifact.claim.behaviorOwnerUiClaimed, false);
  assert.equal(built.artifact.claim.absentEmptyAndPresentHandlerLifecycle, true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[2], () => {
  const authority = built.artifact.authority.source.eventAction;
  assert.equal(authority.publicEditorCoreCommands, 6);
  assert.equal(authority.continuousCompleteSourceRevalidation, true);
  assert.equal(authority.noPartialDocumentOnFailure, true);
  assert.equal(built.artifact.claim.publicEditorCoreEventActionMutation, true);
  assert.equal(built.artifact.claim.continuousCompleteSourceRevalidation, true);
  assert.equal(built.artifact.claim.failedEditPreservesCurrentDocument, true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[3], () => {
  const authority = built.artifact.authority.source.eventAction;
  assert.deepEqual(authority.actionTypes, [
    "component.command",
    "event.emit",
    "navigate",
    "operation.invoke",
    "resource.refresh",
    "state.set",
    "state.toggle",
  ]);
  assert.equal(authority.recursiveOperationSettlements, true);
  assert.equal(built.artifact.claim.recursivelyNestedOperationSettlements, true);
  assert.equal(built.artifact.authority.source.panel.sevenActionStarters, true);
  assert.equal(built.artifact.authority.source.panel.recursiveSettlementLists, true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[4], () => {
  const authority = built.artifact.authority.source.eventAction;
  assert.equal(authority.actionDepthLimit, 64);
  assert.equal(authority.actionOccurrenceLimit, 25_000);
  assert.equal(authority.identityOccurrenceLimit, 25_000);
  assert.equal(authority.sourceDepthLimit, 64);
  assert.equal(authority.exactOwnDataRouteSelectionAndEditCapture, true);
  assert.equal(built.artifact.claim.exactOwnDataEventActionCapture, true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[5], () => {
  const panel = built.artifact.authority.source.panel;
  const application = built.artifact.authority.source.application;
  assert.equal(panel.owner, "Desen App");
  assert.equal(panel.completeActionJsonComposer, true);
  assert.equal(panel.inertReferencePreservation, true);
  assert.equal(panel.executionClaimed, false);
  assert.equal(panel.managedAdapterImports, 0);
  assert.equal(application.publisherPreflightBeforeCommit, true);
  assert.equal(application.sourceAndPreviewCommitAtomically, true);
  assert.equal(application.publisherFailurePreservesPriorSession, true);
  assert.equal(application.eventActionChromeOutsideManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.artifact.claim.eventActionChromeOutsideManagedCapabilitySubtree, true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[6], () => {
  const receipts = built.artifact.tests.localCommandReceipts;
  assert.equal(receipts.pureEventActions.tests, 12);
  assert.equal(receipts.panel.tests, 7);
  assert.equal(receipts.focusedEventActions.tests, 84);
  assert.equal(receipts.fullApp.tests, 202);
  assert.equal(receipts.rootProof.tests, 10);
  assert.equal(receipts.focusedEventActions.testFiles, 8);
  assert.equal(receipts.fullApp.testFiles, 15);
  assert.equal(
    built.artifact.application.package.rootCommands["verify:desen-app-event-action-editor"],
    "node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-editor-core-event-action-edits.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:event-actions && node scripts/verify-desen-app-event-action-editor.mjs",
  );
  assert.equal(built.artifact.claim.actionExecutionClaimed, false);
  assert.equal(built.artifact.claim.persistenceClaimed, false);
  assert.equal(built.artifact.claim.designRunClaimed, false);
  assert.equal(built.artifact.claim.activationClaimed, false);
  assert.equal(built.artifact.claim.browserE2eClaimed, false);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[7], async () => {
  const second = await buildDesenAppEventActionEditorEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[8], () => {
  const mutations = [
    {
      key: "eventActionSource",
      search: "export function applyAuthoringEventActionEdit(",
      replacement: "export function applyUncheckedEventActionEdit(",
    },
    {
      key: "eventActionSource",
      search: "maxActionOccurrences: 25_000",
      replacement: "maxActionOccurrences: Number.POSITIVE_INFINITY",
    },
    {
      key: "eventActionSource",
      search: "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      replacement: "createUncheckedValidator(prepared.model.validationCatalogs)",
    },
    {
      key: "eventActionPanel",
      search: "const parsed = parseInertJsonText(draft);",
      replacement: "const parsed = JSON.parse(draft);",
    },
    {
      key: "eventActionPanel",
      search: "The complete JSON object is committed unchanged.",
      replacement: "Each field commits immediately.",
    },
    {
      key: "applicationSource",
      search: "function editSelectedEventAction(",
      replacement: "function editUncheckedEventAction(",
    },
    {
      key: "applicationSource",
      after: "function editSelectedEventAction(",
      search:
        '    if (!nextPreview.ok) {\n      return Object.freeze({ ok: false, reason: "preview-unavailable" });\n    }\n    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));',
      replacement:
        '    commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }));\n    if (!nextPreview.ok) {\n      return Object.freeze({ ok: false, reason: "preview-unavailable" });\n    }',
    },
    {
      key: "applicationSource",
      search: "<EventActionPanel",
      replacement: "<UncheckedEventActionPanel",
    },
    {
      key: "applicationSource",
      search: "const resolvedActiveSlot = activeSlot ?? defaultSlot;",
      replacement: "const resolvedActiveSlot = activeSlot;",
    },
    {
      key: "applicationSource",
      search: 'aria-label="Change target in Layers"',
      replacement: 'aria-label="Target"',
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
      search: '(event.key !== "Delete" && event.key !== "Backspace")',
      replacement: 'event.key !== "Delete"',
    },
    {
      key: "applicationSource",
      search: "className={styles.authoringSelectionActions}",
      replacement: "className={styles.removedAuthoringSelectionActions}",
    },
    {
      key: "applicationCss",
      search: ".eventActionPanel {",
      replacement: ".removedEventActionPanel {",
    },
    {
      key: "applicationCss",
      search: ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;",
      replacement:
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 0.25rem;",
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () =>
        verifyDesenAppEventActionEditorSourcePolicy({
          ...sourcePolicyInput,
          [mutation.key]: mutation.after
            ? replaceOnceAfter(
                sourcePolicyInput[mutation.key],
                mutation.after,
                mutation.search,
                mutation.replacement,
              )
            : replaceOnce(sourcePolicyInput[mutation.key], mutation.search, mutation.replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
      `${mutation.key} mutation must fail closed: ${mutation.search}`,
    );
  }
});

test(DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES[9], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppEventActionEditorEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([[DESIGN_RUN_ARTIFACT_PATH, changedByte(successorArtifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([[SELF_READER_PATH, changedByte(selfReaderBytes)]]),
    }),
    expectedError("BOUNDARY_DRIFT"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppEventActionEditorEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 2);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppEventActionEditorEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppEventActionEditorEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t09-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppEventActionEditorEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppEventActionEditorEvidence({
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
    writeDesenAppEventActionEditorEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppEventActionEditorEvidence({
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
    buildDesenAppEventActionEditorEvidence({
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
    buildDesenAppEventActionEditorEvidence({
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
      buildDesenAppEventActionEditorEvidence({
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
  const [artifactBytes, receiptBytes, publicationApplicationBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
    readFile(path.join(ROOT, PUBLICATION_APPLICATION_TEST)),
  ]);
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([
        [PUBLICATION_APPLICATION_TEST, changedByte(publicationApplicationBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppEventActionEditorEvidence({
      fileOverrides: new Map([
        [
          PUBLICATION_APPLICATION_TEST,
          Buffer.from(
            replaceOnce(
              publicationApplicationBytes.toString("utf8"),
              "  }, 10_000);",
              "  }, 20_000);",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
