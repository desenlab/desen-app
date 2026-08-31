import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SELECTION_OVERLAY_PARENT_PIN,
  DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES,
  DesenAppSelectionOverlayProofError,
  buildDesenAppSelectionOverlayEvidence,
  verifyDesenAppSelectionOverlayEvidence,
  verifyDesenAppSelectionOverlaySourcePolicy,
  writeDesenAppSelectionOverlayEvidence,
} from "../scripts/lib/desen-app-selection-overlay-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const SELECTION_SOURCE = "apps/desen-app/src/authoring-selection.ts";
const ADAPTER_SOURCE = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS = "apps/desen-app/src/application.module.css";
const INSPECTOR_SOURCE = "apps/desen-app/src/authoring-inspector.ts";
const AUTHORING_SLOT_SOURCE = "apps/desen-app/src/authoring-slots.ts";
const AUTHORING_SLOT_TEST = "apps/desen-app/test/authoring-slots.test.ts";
const NAMED_SLOT_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const NAMED_SLOT_ARTIFACT_PIN_SHA256 =
  "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f";
const FIXTURES_SCENARIOS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const T14_PUBLICATION_APPLICATION_TEST_PATH =
  "apps/desen-app/test/publication-application.test.tsx";
const PACKAGE = "apps/desen-app/package.json";
const temporaryDirectories = [];
let parentArtifactBytes;
let selectionSource;
let adapterSource;
let applicationSource;
let cssSource;
let inspectorSource;
let slotSource;
let slotTestSource;
let namedSlotArtifactBytes;
let fixturesScenariosArtifactBytes;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppSelectionOverlayProofError && error.code === code;
}

function expectedSourcePolicyError(error) {
  return (
    error instanceof DesenAppSelectionOverlayProofError &&
    ["SOURCE_POLICY_VIOLATION", "CSS_POLICY_VIOLATION", "OVERLAY_OWNERSHIP_VIOLATION"].includes(
      error.code,
    )
  );
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
    `# Desen App selection overlay\n\nTask: M09-T04\n\nStatus: DONE\n\nN-042: TESTED\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`,
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  [
    parentArtifactBytes,
    selectionSource,
    adapterSource,
    applicationSource,
    cssSource,
    inspectorSource,
    slotSource,
    slotTestSource,
    namedSlotArtifactBytes,
    fixturesScenariosArtifactBytes,
  ] = await Promise.all([
    readFile(path.join(ROOT, PARENT_ARTIFACT)),
    readFile(path.join(ROOT, SELECTION_SOURCE), "utf8"),
    readFile(path.join(ROOT, ADAPTER_SOURCE), "utf8"),
    readFile(path.join(ROOT, APPLICATION_SOURCE), "utf8"),
    readFile(path.join(ROOT, APPLICATION_CSS), "utf8"),
    readFile(path.join(ROOT, INSPECTOR_SOURCE), "utf8"),
    readFile(path.join(ROOT, AUTHORING_SLOT_SOURCE), "utf8"),
    readFile(path.join(ROOT, AUTHORING_SLOT_TEST), "utf8"),
    readFile(path.join(ROOT, NAMED_SLOT_ARTIFACT)),
    readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT)),
  ]);
  built = await buildDesenAppSelectionOverlayEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-selection-overlay");
  assert.equal(built.artifact.profile, "desen.app.selection-overlay-proof.v1");
  assert.equal(built.artifact.task, "M09-T04");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [DESEN_APP_SELECTION_OVERLAY_PARENT_PIN]);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.n042Status, "TESTED");
  assert.equal(built.artifact.claim.p06Status, "PROVEN");
  assert.equal(built.artifactBytes.byteLength, 11_997);
  assert.equal(
    built.artifactSha256,
    "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
  );
  assert.equal(built.currentCompatibility.task, "M09-T04");
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.successor.task, "M09-T07");
  assert.equal(
    built.currentCompatibility.successor.artifact.sha256,
    NAMED_SLOT_ARTIFACT_PIN_SHA256,
  );
  assert.equal(built.currentCompatibility.successor.artifact.bytes, 24_830);
  assert.equal(
    built.currentCompatibility.successor.artifact.exactLiveSourceAndTestReceipts.length,
    8,
  );
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
  assert.deepEqual(
    built.currentCompatibility.successor.artifact.exactLiveSourceAndTestReceipts.map(
      ({ path: relativePath }) => relativePath,
    ),
    [
      "apps/desen-app/src/adapter-canvas.tsx",
      "apps/desen-app/src/authoring-data.ts",
      "apps/desen-app/src/authoring-preview.ts",
      "apps/desen-app/src/authoring-slots.ts",
      "apps/desen-app/test/adapter-canvas.test.tsx",
      "apps/desen-app/test/authoring-data.test.ts",
      "apps/desen-app/test/authoring-preview.test.ts",
      "apps/desen-app/test/authoring-slots.test.ts",
    ],
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[1], () => {
  const selection = built.artifact.authority.source.selection;
  assert.deepEqual(selection.exactPrimitiveFields, [
    "kind",
    "projectId",
    "surfaceId",
    "sourceNodeId",
    "capabilityId",
    "displayName",
    "conditional",
  ]);
  assert.deepEqual(selection.exactRuntimeSnapshotFields, ["surfaceId", "diagnosticIndex"]);
  assert.equal(selection.authoringModelMembershipRequired, true);
  assert.equal(selection.constructorDropsUnknownFields, true);
  assert.deepEqual(selection.diagnosticReads, ["byRuntimeNodeId", "runtimeNodeIdsBySourceNodeId"]);
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[2], () => {
  const selection = built.artifact.authority.source.selection;
  assert.equal(selection.repeatedRuntimeIdentitiesPreserved, true);
  assert.equal(selection.attachedBehaviorIdentitiesFiltered, true);
  assert.equal(selection.conditionalAbsenceOnly, true);
  assert.equal(built.artifact.claim.unknownAndStaleIdentityRejected, true);
  assert.equal(
    built.artifact.application.selection.runtimeLookup.includes("DiagnosticIndex"),
    true,
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[3], () => {
  const adapter = built.artifact.authority.source.adapter;
  const currentAdapter = built.currentCompatibility.authority.source.adapter;
  assert.equal(adapter.exactSharedRegistryRetained, true);
  assert.equal(adapter.managedFieldsetContainsRuntimeBoundary, true);
  assert.equal(adapter.overlayOutsideManagedFieldset, true);
  assert.equal(adapter.overlayReceivesNoManagedChildOrDomHandle, true);
  assert.equal(built.artifact.application.overlay.relationship.includes("sibling"), true);
  assert.equal(built.artifact.application.overlay.componentGeometry, false);
  assert.equal(currentAdapter.exactSharedRegistryRetained, true);
  assert.equal(currentAdapter.overlayOutsideManagedFieldset, undefined);
  assert.equal(currentAdapter.overlayReceivesNoManagedChildOrDomHandle, undefined);
  assert.equal(currentAdapter.optionalDesignChromeOverlayOutsideManagedFieldset, true);
  assert.equal(currentAdapter.optionalDesignChromeReceivesNoManagedChildOrDomHandle, true);
  assert.equal(built.currentCompatibility.application.overlay, undefined);
  assert.deepEqual(built.currentCompatibility.application.currentAuthoringChrome, {
    selectionStatusOwner: "LEFT_AUTHORING_PANEL",
    diagnosticStatusOwner: "RIGHT_INSPECTOR",
    splitAuthoringPanesAlwaysRendered: true,
    outsideManagedCapabilitySubtree: true,
    previewFrameEditorChromeRendered: false,
  });
  assert.deepEqual(built.currentCompatibility.application.optionalAdapterDesignChromeCapability, {
    selectionOverlayAvailable: true,
    diagnosticPlaceholderAvailable: true,
    explicitApplicationOptInRequired: true,
    relationship: "DOM sibling outside disabled managed fieldset",
    pointerEvents: "none",
    componentGeometry: false,
  });
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[4], () => {
  for (const authority of [
    built.artifact.authority.source.selection,
    built.artifact.authority.source.adapter,
    built.artifact.authority.source.application,
  ]) {
    assert.equal(authority.privateInspection.privateDomOrGeometryCalls, 0);
    assert.equal(authority.privateInspection.privateReactReferences, 0);
  }
  assert.equal(built.artifact.claim.privateDomAndReactAuthoringRejected, true);
  assert.equal(built.artifact.claim.publicDiagnosticIndexOnly, true);
  assert.equal(built.artifact.claim.componentGeometryClaimed, false);
  for (const authority of [
    built.currentCompatibility.authority.source.selection,
    built.currentCompatibility.authority.source.adapter,
    built.currentCompatibility.authority.source.application,
  ]) {
    assert.equal(authority.privateInspection.privateDomOrGeometryCalls, 0);
    assert.equal(authority.privateInspection.privateReactReferences, 0);
  }
  assert.equal(
    built.currentCompatibility.authority.source.application.privateInspection
      .allowedAuthoringLayerRowLookupDomCalls,
    1,
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[5], () => {
  assert.deepEqual(built.artifact.application.accessibility, {
    nativeLayerButtons: true,
    pressedState: true,
    dynamicSelectDeselectName: true,
    conditionalName: true,
    panelLiveStatus: true,
    tabKeyboardWrap: true,
  });
  assert.equal(built.currentCompatibility.application.accessibility.panelLiveStatus, undefined);
  assert.equal(built.currentCompatibility.application.accessibility.tabKeyboardWrap, undefined);
  assert.deepEqual(built.currentCompatibility.application.accessibility, {
    nativeLayerButtons: true,
    pressedState: true,
    dynamicSelectDeselectName: true,
    conditionalName: true,
    authoringStatusLive: true,
    splitAuthoringPanesAlwaysRendered: true,
    rightInspectorTabKeyboardWrap: true,
  });
  assert.equal(built.artifact.claim.routeResetSynchronous, true);
  assert.equal(built.artifact.tests.selectionTestNames.length, 6);
  assert.equal(built.artifact.tests.adapterTestNames.length, 3);
  assert.equal(built.artifact.tests.applicationTestNames.length, 2);
  assert.equal(
    built.currentCompatibility.application.package.inspectorTestCommand,
    "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.application.package.structuredInspectorTestCommand,
    "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotTestCommand,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(built.currentCompatibility.successor.schemaDerivedPrimitiveAndEnumControls, true);
  assert.equal(built.currentCompatibility.successor.publicEditorCoreAtomicMutation, true);
  assert.equal(built.currentCompatibility.successor.nestedObjectAndStructuredJsonEditing, true);
  assert.equal(built.currentCompatibility.successor.dynamicValuesLocked, true);
  assert.equal(built.currentCompatibility.successor.publisherBackedSessionPreview, true);
  assert.equal(built.currentCompatibility.successor.sourceAndPreviewCommitAtomically, true);
  assert.equal(built.currentCompatibility.successor.inspectorOutsideManagedCapabilitySubtree, true);
  assert.equal(built.currentCompatibility.successor.selectionOverlayBoundaryRetained, undefined);
  assert.equal(
    built.currentCompatibility.successor.optionalAdapterDesignChromeBoundaryRetained,
    true,
  );
  assert.equal(built.currentCompatibility.successor.completeNamedSlotProjectionImplemented, true);
  assert.equal(
    built.currentCompatibility.successor.publicStableIdInsertMoveAndReorderImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.publicValidatedNodeDeleteImplemented, true);
  assert.equal(built.currentCompatibility.successor.exactOwnDataDeletionSelectionImplemented, true);
  assert.equal(built.currentCompatibility.successor.rootAndSourceMinimumDeletionDisabled, true);
  assert.equal(built.currentCompatibility.successor.behaviorOwnedDeletePreservesEmptySlot, true);
  assert.equal(built.currentCompatibility.successor.failedDeletionPreservesCurrentDocument, true);
  assert.equal(built.currentCompatibility.successor.browserDataTransferReadsZero, true);
  assert.equal(built.currentCompatibility.successor.compactStableDropBoundaries, true);
  assert.equal(built.currentCompatibility.successor.stableNestedDragHover, true);
  assert.equal(built.currentCompatibility.successor.innermostNestedSlotOwnsPointer, true);
  assert.equal(
    built.currentCompatibility.successor.rejectedReleaseRetainsLastAcceptedProjection,
    true,
  );
  assert.equal(built.currentCompatibility.successor.noOpProjectionVisibleAndInert, true);
  assert.equal(built.currentCompatibility.successor.explicitComponentDropTargetGuide, true);
  assert.equal(built.currentCompatibility.successor.componentPanelWideDropSurface, true);
  assert.equal(built.currentCompatibility.successor.componentPaletteOuterDropInert, false);
  assert.equal(built.currentCompatibility.successor.draggableComponentCard, false);
  assert.equal(built.currentCompatibility.successor.dedicatedComponentDragHandle, true);
  assert.equal(built.currentCompatibility.successor.dedicatedLayerDragHandle, true);
  assert.equal(built.currentCompatibility.successor.deletionSourceAndPreviewCommitAtomically, true);
  assert.equal(built.currentCompatibility.successor.deletionFocusManaged, true);
  assert.deepEqual(built.currentCompatibility.successor.artifact.authenticatedClaims, {
    publicValidatedDelete: true,
    exactDeleteSelection: true,
    rootAndSourceMinimumDeletionDisabled: true,
    behaviorOwnedDeletePreservesEmptySlot: true,
    failedDeletionPreservesCurrentDocument: true,
    browserDataTransferReadsZero: true,
    expandedDropReadyBoundaries: true,
    stableNestedDragHover: true,
    explicitComponentDropTargetGuide: true,
    deletionSourceAndPreviewCommitAtomically: true,
    deletionFocusManaged: true,
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(built.currentCompatibility.successor.artifact.localCommandReceipts).map(
        ([name, receipt]) => [name, receipt.tests],
      ),
    ),
    { pureSlot: 27, focusedNamedSlots: 70, fullApp: 151, rootProof: 9 },
  );
  assert.equal(built.currentCompatibility.successor.exactTargetAdmissionCachesImplemented, true);
  assert.equal(built.currentCompatibility.successor.componentPaletteRenderLimit, 24);
  assert.equal(built.currentCompatibility.successor.splitAuthoringPanesAlwaysRendered, true);
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[6], async () => {
  const second = await buildDesenAppSelectionOverlayEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[7], async () => {
  const baseline = {
    selectionSource,
    adapterSource,
    applicationSource,
    cssSource,
  };
  assert.equal(
    verifyDesenAppSelectionOverlaySourcePolicy(baseline).adapter
      .optionalDesignChromeOverlayOutsideManagedFieldset,
    true,
  );

  for (const mutation of [
    {
      ...baseline,
      selectionSource: `${selectionSource}\ndocument.querySelector("[data-runtime]");\n`,
    },
    {
      ...baseline,
      selectionSource: `${selectionSource}\ndocument.body.getBoundingClientRect();\n`,
    },
    {
      ...baseline,
      adapterSource: replaceOnce(
        adapterSource,
        `      </fieldset>
      {showDesignChrome && mode === "design" && selectedDiagnostic !== undefined ? (
        <DiagnosticPlaceholderOverlay
          diagnostic={selectedDiagnostic.diagnostic}
          occurrence={selectedDiagnostic.occurrence}
          placeholderRef={diagnosticPlaceholderRef}
        />
      ) : showDesignChrome && mode === "design" ? (
        <SelectionOverlay projection={projection} />
      ) : null}`,
        `        {showDesignChrome && mode === "design" && selectedDiagnostic !== undefined ? (
          <DiagnosticPlaceholderOverlay
            diagnostic={selectedDiagnostic.diagnostic}
            occurrence={selectedDiagnostic.occurrence}
            placeholderRef={diagnosticPlaceholderRef}
          />
        ) : showDesignChrome && mode === "design" ? (
          <SelectionOverlay projection={projection} />
        ) : null}
      </fieldset>`,
      ),
    },
    {
      ...baseline,
      cssSource: replaceOnce(cssSource, "width: max-content;", "width: 100%;\n  height: 100%;"),
    },
    {
      ...baseline,
      applicationSource: `import type { DesenEditorDocument } from "@desen/editor-core";\n${applicationSource}`,
    },
    {
      ...baseline,
      applicationSource: replaceOnce(
        applicationSource,
        "createDesenEditorContinuousValidator",
        "createDesenEditorDocument",
      ),
    },
  ]) {
    assert.throws(
      () => verifyDesenAppSelectionOverlaySourcePolicy(mutation),
      expectedSourcePolicyError,
    );
  }

  assert.throws(
    () =>
      verifyDesenAppSelectionOverlaySourcePolicy({
        ...baseline,
        applicationSource: replaceOnce(
          applicationSource,
          'target.contentEditable === "true"',
          'target.closest("input") !== null',
        ),
      }),
    expectedError("PRIVATE_STRUCTURE_AUTHORITY"),
  );
  for (const [search, replacement] of [
    [
      "slotSurface.closest<HTMLElement>('[data-authoring-pane-scroll=\"layers\"]')",
      "slotSurface.closest<HTMLElement>('[data-managed-capability-subtree]')",
    ],
    [
      "const currentBounds = slotSurface.getBoundingClientRect()",
      "const currentBounds = document.body.getBoundingClientRect()",
    ],
  ]) {
    assert.throws(
      () =>
        verifyDesenAppSelectionOverlaySourcePolicy({
          ...baseline,
          applicationSource: replaceOnce(applicationSource, search, replacement),
        }),
      expectedError("PRIVATE_STRUCTURE_AUTHORITY"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppSelectionOverlaySourcePolicy({
        ...baseline,
        applicationSource: replaceOnce(
          applicationSource,
          'child.querySelector<HTMLElement>("[data-layer-drop-row-node-id]")',
          'child.querySelector<HTMLElement>("[data-managed-capability-subtree]")',
        ),
      }),
    expectedError("PRIVATE_STRUCTURE_AUTHORITY"),
  );

  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([
        [
          INSPECTOR_SOURCE,
          Buffer.from(
            replaceOnce(
              inspectorSource,
              'if (field.value.kind === "dynamic") {',
              'if (field.value.kind === "unavailable") {',
            ),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SLOT_SOURCE,
          Buffer.from(
            replaceOnce(
              slotSource,
              "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
              "const INSERTION_ADMISSION_BY_MODEL = new Map<",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  for (const [relativePath, source, search, replacement] of [
    [
      AUTHORING_SLOT_SOURCE,
      slotSource,
      "export function applyAuthoringNodeDelete(",
      "export function applyAuthoringNodeRemoval(",
    ],
    [
      AUTHORING_SLOT_SOURCE,
      slotSource,
      '? failure("source-invalid", validationReport)',
      '? failure("source-invalid")',
    ],
    [
      APPLICATION_SOURCE,
      applicationSource,
      'event.dataTransfer.setData("text/plain", "DESEN App authoring item");',
      'event.dataTransfer.getData("text/plain");\n  event.dataTransfer.setData("text/plain", "DESEN App authoring item");',
    ],
    [
      APPLICATION_CSS,
      cssSource,
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;\n  align-items: center;\n  padding: 0 0.125rem;",
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 0.75rem;\n  align-items: center;\n  padding: 0 0.125rem;",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  pointer-events: none;",
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: -0.5rem 0;\n  z-index: 5;\n  pointer-events: none;",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: none;',
    ],
    [
      APPLICATION_SOURCE,
      applicationSource,
      "onDragEnter={onBoundaryDragEnter}",
      "onDragEnter={() => undefined}",
    ],
    [
      APPLICATION_SOURCE,
      applicationSource,
      "onDragEnter={enterComponentDrop}",
      "onDragEnter={() => undefined}",
    ],
    [
      APPLICATION_SOURCE,
      applicationSource,
      "data-ready={readySlot !== null}\n        onDragEnter={enterComponentDrop}\n        onDragLeave={leaveComponentDrop}\n        onDragOver={admitComponentDrop}\n        onDrop={receiveComponentDrop}",
      "data-ready={readySlot !== null}\n        onDragEnter={enterComponentDrop}\n        onDragLeave={leaveComponentDrop}\n        onDragOver={admitComponentDrop}\n        onDrop={() => undefined}",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;\n  z-index: 4;\n  display: flex;\n  min-height: 4rem;",
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;\n  z-index: 4;\n  display: flex;\n  min-height: auto;",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
      ".layerDragHandle {\n  position: relative;\n  width: 1rem;\n  height: 1rem;\n  flex: 0 0 auto;\n  margin: 0;",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
      ".componentDragHandle {\n  position: relative;\n  width: 1rem;\n  height: 1rem;\n  flex: 0 0 auto;\n  margin: 0;",
    ],
    [
      APPLICATION_CSS,
      cssSource,
      '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
      '.slotBoundary[data-drop-disabled="true"] .slotBoundaryLine',
    ],
    [
      AUTHORING_SLOT_TEST,
      slotTestSource,
      "disables root deletion and deletion across the owning slot minimum",
      "allows root deletion and ignores the owning slot minimum",
    ],
  ]) {
    await assert.rejects(
      buildDesenAppSelectionOverlayEvidence({
        fileOverrides: new Map([
          [relativePath, Buffer.from(replaceOnce(source, search, replacement))],
        ]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([[NAMED_SLOT_ARTIFACT, changedByte(namedSlotArtifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[8], async () => {
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      parentArtifactBytes: changedByte(parentArtifactBytes),
    }),
    expectedError("PARENT_DRIFT"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppSelectionOverlayEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 1);
  assert.equal(verified.n042Status, "TESTED");

  await assert.rejects(
    verifyDesenAppSelectionOverlayEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppSelectionOverlayEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
});

test(DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES[9], async () => {
  const directory = await temporaryDirectory("desen-m09-t04-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppSelectionOverlayEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppSelectionOverlayEvidence({
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
    writeDesenAppSelectionOverlayEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppSelectionOverlayEvidence({
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
    buildDesenAppSelectionOverlayEvidence({
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
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([[ADAPTER_SOURCE, Buffer.from(`${adapterSource}\n`)]]),
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
      buildDesenAppSelectionOverlayEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[M10-T01A successor] authenticates the normal-product blank-project seal and live receipts", async () => {
  const successor = built.currentCompatibility.userCreatedBlankProjectSuccessor;
  assert.deepEqual(
    {
      task: successor.task,
      artifactSha256: successor.artifact.sha256,
      immutable: successor.artifact.immutable,
      predecessorSha256: successor.predecessor.sha256,
      normalProductEntryCovered: successor.normalProductEntryCovered,
      zeroProjectStartCovered: successor.zeroProjectStartCovered,
      visibleProjectCreationCovered: successor.visibleProjectCreationCovered,
      fixtureBootstrapBypassed: successor.fixtureBootstrapBypassed,
      durableLocalPersistenceCovered: successor.durableLocalPersistenceCovered,
      p08Status: successor.p08Status,
      runtimeInputAndPendingCovered: successor.runtimeInputAndPendingCovered,
      g10Closed: successor.g10Closed,
    },
    {
      task: "M10-T01A",
      artifactSha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
      immutable: true,
      predecessorSha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
      normalProductEntryCovered: true,
      zeroProjectStartCovered: true,
      visibleProjectCreationCovered: true,
      fixtureBootstrapBypassed: true,
      durableLocalPersistenceCovered: true,
      p08Status: "PROVEN",
      runtimeInputAndPendingCovered: false,
      g10Closed: false,
    },
  );
  const mutationPaths = [
    successor.artifact.path,
    ...successor.currentProjection.artifactBackedPaths,
    ...successor.currentProjection.reviewedPaths,
  ];
  assert.deepEqual(mutationPaths, [
    "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
    "apps/desen-app/package.json",
    "apps/desen-app/src/application.module.css",
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/src/local-runtime-persistence.ts",
    "apps/desen-app/src/main.tsx",
    "apps/desen-app/src/product-bootstrap.tsx",
    "apps/desen-app/src/project-data.ts",
    "apps/desen-app/src/reference-empty-project.ts",
    "apps/desen-app/src/styles.css",
    "apps/desen-app/test/application.test.tsx",
    "apps/desen-app/test/main-lifecycle.test.tsx",
    "apps/desen-app/tsconfig.local-dev.json",
    "dependency-cruiser.config.cjs",
    "package.json",
    "pnpm-lock.yaml",
    "apps/desen-app/README.md",
  ]);
  for (const relativePath of mutationPaths) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppSelectionOverlayEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }

  const packageSource = await readFile(path.join(ROOT, PACKAGE), "utf8");
  const packageMutations = [
    (manifest) => {
      manifest.scripts.dev = "vite";
    },
    (manifest) => {
      manifest.scripts.lint = "eslint src test --max-warnings=0";
    },
    (manifest) => {
      manifest.scripts.typecheck = "tsc -p tsconfig.json --noEmit";
    },
    (manifest) => {
      manifest.devDependencies["@desen/editor-web"] = manifest.dependencies["@desen/editor-web"];
      delete manifest.dependencies["@desen/editor-web"];
    },
  ];
  for (const mutate of packageMutations) {
    const manifest = JSON.parse(packageSource);
    mutate(manifest);
    await assert.rejects(
      buildDesenAppSelectionOverlayEvidence({
        fileOverrides: new Map([[PACKAGE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)]]),
      }),
      expectedError("PACKAGE_POLICY_VIOLATION"),
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
  const [artifactBytes, receiptBytes, publicationApplicationTestBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
    readFile(path.join(ROOT, T14_PUBLICATION_APPLICATION_TEST_PATH)),
  ]);
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([
        [T14_PUBLICATION_APPLICATION_TEST_PATH, changedByte(publicationApplicationTestBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSelectionOverlayEvidence({
      fileOverrides: new Map([
        [
          T14_PUBLICATION_APPLICATION_TEST_PATH,
          Buffer.from(
            replaceOnce(
              publicationApplicationTestBytes.toString("utf8"),
              "}, 10_000);",
              "}, 20_000);",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
