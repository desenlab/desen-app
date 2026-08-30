import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES,
  DESEN_APP_CATALOG_PANEL_REFERENCE_CAPABILITY_PIN,
  DESEN_APP_CATALOG_PANEL_SHELL_PIN,
  DesenAppCatalogPanelLayerTreeProofError,
  buildDesenAppCatalogPanelLayerTreeEvidence,
  verifyDesenAppCatalogPanelLayerTreeEvidence,
  writeDesenAppCatalogPanelLayerTreeEvidence,
} from "../scripts/lib/desen-app-catalog-panel-layer-tree-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json";
const SHELL_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const REFERENCE_ARTIFACT = "docs/proof/artifacts/reference-catalog-web-capability-artifact.json";
const FIXTURES_SCENARIOS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const T14_PUBLICATION_APPLICATION_TEST_PATH =
  "apps/desen-app/test/publication-application.test.tsx";
const CATALOG = "packages/reference-catalog-web/catalog.json";
const SOURCE = "examples/sign-in/official-derived.source.desen.json";
const PACKAGE = "apps/desen-app/package.json";
const APPLICATION = "apps/desen-app/src/application.tsx";
const AUTHORING = "apps/desen-app/src/authoring-data.ts";
const AUTHORING_SELECTION = "apps/desen-app/src/authoring-selection.ts";
const ADAPTER_CANVAS = "apps/desen-app/src/adapter-canvas.tsx";
const AUTHORING_TEST = "apps/desen-app/test/authoring-data.test.ts";
const AUTHORING_SELECTION_TEST = "apps/desen-app/test/authoring-selection.test.ts";
const temporaryDirectories = [];
let built;
let shellArtifactBytes;
let referenceArtifactBytes;
let fixturesScenariosArtifactBytes;

function expectedError(code) {
  return (error) => error instanceof DesenAppCatalogPanelLayerTreeProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    `# Desen App Catalog panel and layer tree\n\nTask: M09-T02\n\nStatus: DONE\n\nArtifact: \`${ARTIFACT}\`\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`,
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  [built, shellArtifactBytes, referenceArtifactBytes, fixturesScenariosArtifactBytes] =
    await Promise.all([
      buildDesenAppCatalogPanelLayerTreeEvidence(),
      readFile(path.join(ROOT, SHELL_ARTIFACT)),
      readFile(path.join(ROOT, REFERENCE_ARTIFACT)),
      readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT)),
    ]);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifactBytes.byteLength, 25_375);
  assert.equal(
    built.artifactSha256,
    "85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61",
  );
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-catalog-panel-layer-tree");
  assert.equal(built.artifact.profile, "desen.app.catalog-panel-layer-tree-proof.v1");
  assert.equal(built.artifact.task, "M09-T02");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_CATALOG_PANEL_SHELL_PIN,
    DESEN_APP_CATALOG_PANEL_REFERENCE_CAPABILITY_PIN,
  ]);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.shellCompatibilityRetained, true);
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.successor.task, "M09-T07");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(built.artifact.authority.catalog.identity, {
    kind: "desen.catalog",
    desen: "0.1.0",
    id: "run.desen.reference.sign-in",
    version: "0.1.0",
    target: "web-react",
    packageDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  });
  assert.equal(built.artifact.authority.catalog.componentCount, 5);
  assert.deepEqual(
    built.artifact.authority.catalog.components.map(
      ({ id, displayName, authoringCategory, semanticCategory }) => ({
        id,
        displayName,
        authoringCategory,
        semanticCategory,
      }),
    ),
    [
      {
        id: "com.example.ui/Alert",
        displayName: "Alert",
        authoringCategory: "Feedback",
        semanticCategory: "feedback",
      },
      {
        id: "com.example.ui/Button",
        displayName: "Button",
        authoringCategory: "Actions",
        semanticCategory: "action",
      },
      {
        id: "com.example.ui/Stack",
        displayName: "Stack",
        authoringCategory: "Layout",
        semanticCategory: "layout",
      },
      {
        id: "com.example.ui/Text",
        displayName: "Text",
        authoringCategory: "Content",
        semanticCategory: "content",
      },
      {
        id: "com.example.ui/TextField",
        displayName: "Text field",
        authoringCategory: "Inputs",
        semanticCategory: "input",
      },
    ],
  );
  assert.deepEqual(
    built.artifact.authority.source.surfaces.map(({ id, root }) => ({
      id,
      rootId: root.id,
      children: root.slots.flatMap((slot) => slot.children.map((child) => child.id)),
    })),
    [
      { id: "home", rootId: "home.layout", children: ["home.title"] },
      {
        id: "sign-in",
        rootId: "sign-in.layout",
        children: [
          "sign-in.title",
          "sign-in.email",
          "sign-in.password",
          "sign-in.error",
          "sign-in.submit",
        ],
      },
    ],
  );
  assert.deepEqual(built.artifact.authority.source.conditionalNodeIds, ["sign-in.error"]);
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[2], () => {
  assert.deepEqual(built.artifact.application.projection.validatorApis, [
    "validateDesenInteractionCatalogSet",
    "validateDesenSourceInteractionContracts",
  ]);
  assert.equal(built.artifact.application.projection.failurePolicy, "NO_PARTIAL_AUTHORING_MODEL");
  assert.deepEqual(built.artifact.application.projection.failureReasons, [
    "catalog-invalid",
    "source-invalid",
    "projection-limit",
  ]);
  assert.deepEqual(built.artifact.application.ui.tabs, ["Layers", "Components"]);
  assert.equal(built.artifact.application.ui.componentFilter, "LOCAL_READ_MODEL_ONLY");
  assert.equal(
    built.artifact.application.ui.unknownSurfacePolicy,
    "EXPLICIT_NO_SOURCE_TREE_WITHOUT_SUBSTITUTION",
  );
  assert.equal(built.artifact.evidence.tests.positiveAndNegativeCoverage, true);
  assert.equal(built.artifact.evidence.tests.failClosedCatalogSourceAndLimitCoverage, true);
  assert.equal(built.artifact.evidence.tests.targetedReceipts.length, 2);
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[3], () => {
  assert.deepEqual(built.artifact.boundary.imports.exactDesenPackageImports, [
    "@desen/reference-catalog-web/catalog.json",
    "@desen/validator#validateDesenInteractionCatalogSet",
    "@desen/validator#validateDesenSourceInteractionContracts",
  ]);
  assert.equal(built.artifact.boundary.imports.editorCoreImports, 0);
  assert.equal(built.artifact.boundary.imports.catalogSdkImports, 0);
  assert.equal(built.artifact.boundary.imports.runtimeReactImports, 0);
  assert.equal(built.artifact.boundary.imports.adapterImports, 0);
  assert.equal(built.artifact.boundary.imports.platformIoCalls, 0);
  assert.equal(built.artifact.boundary.imports.dragDropMutationHandlers, 0);
  assert.equal(built.artifact.boundary.imports.canvasElements, 0);
  assert.equal(built.artifact.claim.realAdapterCanvasImplemented, false);
  assert.equal(built.artifact.claim.selectionOrInspectorImplemented, false);
  assert.equal(built.artifact.claim.sourceMutationOrHistoryImplemented, false);
  assert.equal(built.artifact.nonclaims.length, 4);
  assert.equal(built.currentCompatibility.retainedClaim.componentFilterMutatesSource, false);
  assert.equal(built.currentCompatibility.retainedClaim.unknownSurfaceSubstitutesSource, false);
  assert.equal(built.currentCompatibility.successor.realAdapterCanvasOwnedBySuccessor, true);
  assert.equal(
    built.currentCompatibility.successor.historicalNoCanvasNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(built.currentCompatibility.successor.exactPublicRuntimeAdapterPathAllowed, true);
  assert.equal(
    built.currentCompatibility.successor.sourceIdentitySelectionOverlayImplemented,
    undefined,
  );
  assert.equal(
    built.currentCompatibility.successor.sourceIdentitySelectionStatusRehomedToAuthoringPanel,
    true,
  );
  assert.equal(built.currentCompatibility.successor.diagnosticStatusRehomedToRightInspector, true);
  assert.equal(built.currentCompatibility.successor.previewFrameEditorChromeRendered, false);
  assert.equal(
    built.currentCompatibility.successor.historicalNoSelectionNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.successor.schemaDerivedPrimitiveAndEnumInspectorImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.publicEditorCorePropMutationImplemented, true);
  assert.equal(built.currentCompatibility.successor.publisherBackedSessionPreviewImplemented, true);
  assert.equal(
    built.currentCompatibility.successor
      .historicalNoInspectorOrSourceMutationNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.successor.nestedObjectAndStructuredJsonEditingImplemented,
    true,
  );
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    path: "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json",
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
  });
  assert.equal(built.currentCompatibility.successor.completeNamedSlotProjectionImplemented, true);
  assert.equal(
    built.currentCompatibility.successor.catalogAdmissionAndCardinalityPreflightImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.publicStableIdInsertMoveAndReorderImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.publicValidatedNodeDeletionImplemented, true);
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
  assert.equal(built.currentCompatibility.successor.activeTabOnlyAuthoringWork, undefined);
  assert.equal(built.currentCompatibility.successor.splitAuthoringPanesAlwaysRendered, true);
  assert.equal(
    built.currentCompatibility.successor.exactSlotSelectionAndEditCaptureImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.atomicPublisherBackedSlotEditsImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotSuccessorTestScript,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotRootCommands[
      "verify:desen-app-named-slot-authoring"
    ],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node scripts/verify-desen-app-named-slot-authoring.mjs",
  );
  assert.equal(built.currentCompatibility.successor.dynamicEditingImplemented, false);
  assert.equal(built.currentCompatibility.successor.persistenceUiImplemented, undefined);
  assert.equal(built.currentCompatibility.successor.runOrPublishImplemented, undefined);
  assert.equal(built.currentCompatibility.successor.currentPersistenceUiImplemented, true);
  assert.equal(built.currentCompatibility.successor.currentDesignRunImplemented, true);
  assert.equal(built.currentCompatibility.successor.currentPublishActivationImplemented, true);
  assert.equal(built.currentCompatibility.boundary.imports.runtimeCoreImports, 5);
  assert.equal(built.currentCompatibility.boundary.imports.runtimeReactImports, 2);
  assert.equal(built.currentCompatibility.boundary.imports.applicationReactDomImports, 0);
  assert.equal(built.currentCompatibility.boundary.imports.publicDiagnosticIndexTypeOnlyImports, 2);
  assert.equal(built.currentCompatibility.boundary.imports.adapterImports, 1);
  assert.equal(
    built.currentCompatibility.boundary.imports.exactReferenceAdapterRegistryConstructions,
    1,
  );
  assert.equal(built.currentCompatibility.boundary.imports.officialBundleImports, 1);
  assert.equal(built.currentCompatibility.boundary.imports.applicationSelectionImports, 2);
  assert.equal(built.currentCompatibility.boundary.imports.adapterSelectionImports, 2);
  assert.equal(built.currentCompatibility.boundary.imports.selectionAuthoringImports, 1);
  assert.equal(built.currentCompatibility.boundary.imports.handwrittenManagedTreeElements, 0);
  assert.equal(built.currentCompatibility.boundary.imports.privateDomAccesses, 0);
  assert.equal(built.currentCompatibility.boundary.imports.catalogSdkImports, 11);
  assert.equal(built.currentCompatibility.boundary.imports.editorCoreImports, 20);
  assert.equal(built.currentCompatibility.boundary.imports.publisherImports, 3);
  assert.equal(built.currentCompatibility.boundary.imports.protocolImports, 10);
  assert.equal(built.currentCompatibility.boundary.imports.reviewedSourceMutationCalls, 13);
  assert.equal(built.currentCompatibility.boundary.imports.reviewedNamedSlotDragDropHandlers, 25);
  assert.deepEqual(built.currentCompatibility.application.ui.currentDragSession, {
    singlePanelSession: true,
    ownerIdentity: "OWNER_KIND_OWNER_ID_SLOT_JSON_TUPLE",
    epochFencedAnimationFrames: true,
    hitTestConfinedToExactSlotSurface: true,
    releaseDriftRetainsLastAcceptedProjection: true,
    coordinateLessFallbackRequiresSameAcceptedOwner: true,
    reactDomAuthoritySurrendered: true,
    dedicatedComponentDragHandle: true,
    dedicatedLayerDragHandle: true,
    componentPanelWideDropSurface: true,
  });
  assert.equal(built.currentCompatibility.application.ui.tabs, undefined);
  assert.equal(built.currentCompatibility.application.ui.tabKeyboardKeys, undefined);
  assert.equal(built.currentCompatibility.application.ui.successorSelectionOverlay, undefined);
  assert.deepEqual(
    {
      authoringLayout: built.currentCompatibility.application.ui.authoringLayout,
      authoringPanes: built.currentCompatibility.application.ui.authoringPanes,
      splitAuthoringPanesAlwaysRendered:
        built.currentCompatibility.application.ui.splitAuthoringPanesAlwaysRendered,
    },
    {
      authoringLayout: "PERMANENT_VERTICAL_SPLIT",
      authoringPanes: ["Components", "Layers"],
      splitAuthoringPanesAlwaysRendered: true,
    },
  );
  assert.deepEqual(built.currentCompatibility.application.ui.currentSelectionStatus, {
    task: "M09-T04",
    exactSourceIdentityOnly: true,
    publicDiagnosticIndexOnly: true,
    owner: "LEFT_AUTHORING_PANEL",
    outsideManagedCapabilitySubtree: true,
    previewFrameEditorChromeRendered: false,
    privateDomOrReactInspection: false,
  });
  assert.deepEqual(built.currentCompatibility.application.ui.currentDiagnosticStatus, {
    owner: "RIGHT_INSPECTOR",
    outsideManagedCapabilitySubtree: true,
    previewFrameDiagnosticPlaceholderRendered: false,
  });
  assert.equal(
    built.currentCompatibility.application.ui.layerHierarchySemantics,
    "AUTHORING_SOURCE_TREE_WITH_PUBLIC_EDITOR_CORE_MUTATIONS",
  );
  assert.equal(
    built.currentCompatibility.application.ui.insertionControls,
    "CATALOG_ADMITTED_ADD_AND_DEDICATED_DRAG_HANDLE",
  );
  assert.equal(
    built.currentCompatibility.application.ui.successorCanvas.officialBundleOnly,
    undefined,
  );
  assert.equal(
    built.currentCompatibility.application.ui.successorCanvas.controlsDisabled,
    undefined,
  );
  assert.deepEqual(built.currentCompatibility.application.ui.successorCanvas, {
    task: "M09-T03",
    exactPublicReferenceRegistry: true,
    publisherBackedDraftOrOfficialFallback: true,
    designControlsDisabled: true,
    runControlsInteractiveAgainstSyntheticFixture: true,
    previewFrameEditorChromeRendered: false,
    unknownSurfaceSubstitution: false,
  });
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[4], async () => {
  const second = await buildDesenAppCatalogPanelLayerTreeEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[5], async () => {
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      shellArtifactBytes: changedByte(shellArtifactBytes),
    }),
    expectedError("SHELL_PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      referenceArtifactBytes: changedByte(referenceArtifactBytes),
    }),
    expectedError("REFERENCE_PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  const catalog = JSON.parse(await readFile(path.join(ROOT, CATALOG), "utf8"));
  catalog.components["com.example.ui/Alert"].authoring.displayName = "Notice";
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[CATALOG, Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`)]]),
    }),
    expectedError("CATALOG_SEMANTIC_DRIFT"),
  );

  const source = JSON.parse(await readFile(path.join(ROOT, SOURCE), "utf8"));
  source.surfaces["sign-in"].root.slots.default.reverse();
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[SOURCE, Buffer.from(`${JSON.stringify(source, null, 2)}\n`)]]),
    }),
    expectedError("SOURCE_SEMANTIC_DRIFT"),
  );

  const manifest = JSON.parse(await readFile(path.join(ROOT, PACKAGE), "utf8"));
  manifest.dependencies["@desen/editor-core"] = "workspace:../drift";
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[PACKAGE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)]]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );

  const application = await readFile(path.join(ROOT, APPLICATION), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`import { flushSync } from "react-dom";\n${application}`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  for (const [retained, replacement] of [
    [
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot]);",
      "const sessionOwnerKey = target.ownerId;",
    ],
    [
      "dragSession.current = createAuthoringDragSession(current.epoch + 1);",
      "dragSession.current = createAuthoringDragSession(current.epoch);",
    ],
    ["hitSlotSurface !== pending.slotSurface", "hitSlotSurface === pending.slotSurface"],
  ]) {
    assert.equal(application.includes(retained), true);
    await assert.rejects(
      buildDesenAppCatalogPanelLayerTreeEvidence({
        fileOverrides: new Map([
          [APPLICATION, Buffer.from(application.replace(retained, replacement))],
        ]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  const admittedRowDragEnter = "onDragEnter={updateDropProjection}";
  assert.equal(application.includes(admittedRowDragEnter), true);
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          APPLICATION,
          Buffer.from(
            application.replace(
              admittedRowDragEnter,
              admittedRowDragEnter.replace("onDragEnter", "onDragOver"),
            ),
          ),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const authoring = await readFile(path.join(ROOT, AUTHORING), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [AUTHORING, Buffer.from(`import "@desen/editor-core";\n${authoring}`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[AUTHORING, Buffer.from(`${authoring}\nvoid fetch("/source");\n`)]]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [AUTHORING, Buffer.from(`${authoring}\nnavigator.sendBeacon("/source", "drift");\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [AUTHORING, Buffer.from(`${authoring}\ndocument.cookie = "proof=drift";\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );

  const authoringTest = await readFile(path.join(ROOT, AUTHORING_TEST), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [AUTHORING_TEST, Buffer.from(authoringTest.replaceAll('reason: "projection-limit",', ""))],
      ]),
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );

  const authoringSelection = await readFile(path.join(ROOT, AUTHORING_SELECTION), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SELECTION,
          Buffer.from(
            authoringSelection.replace(
              "import type { RuntimeReactDiagnosticIndex }",
              "import { RuntimeReactDiagnosticIndex }",
            ),
          ),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SELECTION,
          Buffer.from(`${authoringSelection}\ndocument.querySelector("[data-node]");\n`),
        ],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );

  const authoringSelectionTest = await readFile(path.join(ROOT, AUTHORING_SELECTION_TEST), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SELECTION_TEST,
          Buffer.from(
            authoringSelectionTest.replace(
              "rejects a forged same-route Source identity instead of treating it as conditional",
              "accepts a forged same-route Source identity",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_AUTHORITY_DRIFT"),
  );

  const adapterCanvas = await readFile(path.join(ROOT, ADAPTER_CANVAS), "utf8");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          ADAPTER_CANVAS,
          Buffer.from(
            adapterCanvas.replace(
              "@desen/reference-catalog-web/react-adapters",
              "@desen/reference-catalog-web/private/react-adapters",
            ),
          ),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nvoid import("@desen/runtime-react");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nconst handwritten = <Stack />;\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ndocument.querySelector("main");\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ninsertDesenEditor();\n`)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          ADAPTER_CANVAS,
          Buffer.from(
            adapterCanvas.replace(
              "createRuntimeReactAdapterRegistry(\n  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n)",
              "createRuntimeReactAdapterRegistry({})",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[6], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppCatalogPanelLayerTreeEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 2);
  assert.equal(verified.catalogComponents, 5);
  assert.equal(verified.sourceSurfaces, 2);
  assert.equal(verified.sourceNodes, 8);

  await assert.rejects(
    verifyDesenAppCatalogPanelLayerTreeEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppCatalogPanelLayerTreeEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t02-writer-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppCatalogPanelLayerTreeEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppCatalogPanelLayerTreeEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);
});

test(DESEN_APP_CATALOG_PANEL_LAYER_TREE_ROOT_TEST_NAMES[7], async () => {
  const directory = await temporaryDirectory("desen-m09-t02-links-");
  const shellTarget = path.join(directory, "shell-target.json");
  const shellLink = path.join(directory, "shell.json");
  await writeFile(shellTarget, shellArtifactBytes);
  await symlink(shellTarget, shellLink);
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({ shellArtifactPath: shellLink }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const referenceTarget = path.join(directory, "reference-target.json");
  const referenceLink = path.join(directory, "reference.json");
  await writeFile(referenceTarget, referenceArtifactBytes);
  await symlink(referenceTarget, referenceLink);
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({ referenceArtifactPath: referenceLink }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppCatalogPanelLayerTreeEvidence({
      artifactPath: artifactLink,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(proofTarget, proofLink);
  await assert.rejects(
    verifyDesenAppCatalogPanelLayerTreeEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofLink,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const linkedWorkspace = path.join(directory, "workspace");
  const linkedAppsTarget = path.join(directory, "apps-target");
  await mkdir(linkedWorkspace);
  await mkdir(path.join(linkedAppsTarget, "desen-app"), { recursive: true });
  await symlink(linkedAppsTarget, path.join(linkedWorkspace, "apps"), "dir");
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      workspaceRoot: linkedWorkspace,
      shellArtifactBytes,
      referenceArtifactBytes,
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
    buildDesenAppCatalogPanelLayerTreeEvidence({
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
    buildDesenAppCatalogPanelLayerTreeEvidence({
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
      buildDesenAppCatalogPanelLayerTreeEvidence({
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
  const [artifactBytes, receiptBytes, publicationApplicationTestBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
    readFile(path.join(ROOT, T14_PUBLICATION_APPLICATION_TEST_PATH)),
  ]);
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [T14_PUBLICATION_APPLICATION_TEST_PATH, changedByte(publicationApplicationTestBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  const publicationApplicationTestSource = publicationApplicationTestBytes.toString("utf8");
  assert.equal(
    publicationApplicationTestSource.split("}, 10_000);").length - 1,
    1,
    "Expected one exact T14 timeout successor marker.",
  );
  await assert.rejects(
    buildDesenAppCatalogPanelLayerTreeEvidence({
      fileOverrides: new Map([
        [
          T14_PUBLICATION_APPLICATION_TEST_PATH,
          Buffer.from(
            publicationApplicationTestSource.replace("}, 10_000);", "}, 20_000);"),
            "utf8",
          ),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
