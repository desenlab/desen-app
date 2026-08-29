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
  assert.equal(currentAdapter.overlayOutsideManagedFieldset, true);
  assert.equal(currentAdapter.overlayReceivesNoManagedChildOrDomHandle, true);
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
  assert.equal(built.currentCompatibility.successor.selectionOverlayBoundaryRetained, true);
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
  assert.equal(built.currentCompatibility.successor.expandedDropReadyBoundaries, true);
  assert.equal(built.currentCompatibility.successor.stableNestedDragHover, true);
  assert.equal(built.currentCompatibility.successor.explicitComponentDropTargetGuide, true);
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
  assert.equal(built.currentCompatibility.successor.activeTabOnlyAuthoringWork, true);
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
    verifyDesenAppSelectionOverlaySourcePolicy(baseline).adapter.overlayOutsideManagedFieldset,
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
        '      </fieldset>\n      {mode === "design" ? <SelectionOverlay projection={projection} /> : null}',
        '        {mode === "design" ? <SelectionOverlay projection={projection} /> : null}\n      </fieldset>',
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
      APPLICATION_SOURCE,
      applicationSource,
      'event.dataTransfer.setData("text/plain", "DESEN App authoring item");',
      'event.dataTransfer.getData("text/plain");\n  event.dataTransfer.setData("text/plain", "DESEN App authoring item");',
    ],
    [APPLICATION_CSS, cssSource, "min-height: 1.5rem;", "min-height: 0.25rem;"],
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
