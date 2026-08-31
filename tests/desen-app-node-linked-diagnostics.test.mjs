import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES,
  DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS,
  DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES,
  DesenAppNodeLinkedDiagnosticsProofError,
  buildDesenAppNodeLinkedDiagnosticsEvidence,
  verifyDesenAppNodeLinkedDiagnosticsEvidence,
  verifyDesenAppNodeLinkedDiagnosticsSourcePolicy,
  writeDesenAppNodeLinkedDiagnosticsEvidence,
} from "../scripts/lib/desen-app-node-linked-diagnostics-proof.mjs";

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
const SOURCE_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/src/authoring-diagnostics.ts",
  diagnosticsPanel: "apps/desen-app/src/diagnostics-panel.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  authoringInspector: "apps/desen-app/src/authoring-inspector.ts",
  authoringState: "apps/desen-app/src/authoring-state.ts",
  authoringEventActions: "apps/desen-app/src/authoring-event-actions.ts",
  authoringSlots: "apps/desen-app/src/authoring-slots.ts",
  persistence: "apps/desen-app/src/authoring-persistence.ts",
});
const TEST_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/test/authoring-diagnostics.test.ts",
  diagnosticsPanel: "apps/desen-app/test/diagnostics-panel.test.tsx",
  authoringInspector: "apps/desen-app/test/authoring-inspector.test.ts",
  authoringState: "apps/desen-app/test/authoring-state.test.ts",
  authoringEventActions: "apps/desen-app/test/authoring-event-actions.test.ts",
  authoringSlots: "apps/desen-app/test/authoring-slots.test.ts",
  adapterCanvas: "apps/desen-app/test/adapter-canvas.test.tsx",
  application: "apps/desen-app/test/application.test.tsx",
  persistenceApplication: "apps/desen-app/test/persistence-application.test.tsx",
});
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const ROOT_PACKAGE_PATH = "package.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLICATION_SOURCE_PATH = "apps/desen-app/src/authoring-publication.ts";
const PUBLICATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
const temporaryDirectories = [];
let sourcePolicyInput;
let testSources;
let parentArtifactBytes;
let appPackageSource;
let rootPackageSource;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppNodeLinkedDiagnosticsProofError && error.code === code;
}

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, `Missing mutation marker ${search}`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App node-linked diagnostics",
      "",
      "Task: M09-T13",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "P-16: PROVEN",
      "PF-086: OPEN",
      "PF-089: OPEN",
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
  testSources = new Map(
    await Promise.all(
      Object.values(TEST_PATHS).map(async (relativePath) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath), "utf8"),
      ]),
    ),
  );
  parentArtifactBytes = new Map(
    await Promise.all(
      DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS.map(async ({ path: relativePath }) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  [appPackageSource, rootPackageSource] = await Promise.all([
    readFile(path.join(ROOT, APP_PACKAGE_PATH), "utf8"),
    readFile(path.join(ROOT, ROOT_PACKAGE_PATH), "utf8"),
  ]);
  built = await buildDesenAppNodeLinkedDiagnosticsEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-node-linked-diagnostics");
  assert.equal(built.artifact.profile, "desen.app.node-linked-diagnostics-proof.v1");
  assert.equal(built.artifact.task, "M09-T13");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 11);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p16Status, "PROVEN");
  assert.equal(built.artifact.claim.pf086Status, "OPEN");
  assert.equal(built.artifact.claim.dedicatedComponentDragHandle, true);
  assert.equal(built.artifact.claim.dedicatedLayerDragHandle, true);
  assert.equal(built.artifact.claim.componentPanelWideDropSurface, true);
  assert.equal(built.artifact.claim.innermostNestedSlotOwnsPointer, true);
  assert.equal(built.artifact.claim.stableInsertionLaneGeometry, true);
  assert.equal(built.artifact.claim.rowHalfProjectionBroadensHitArea, true);
  assert.equal(built.artifact.claim.noOpPlacementFeedbackVisible, true);
  assert.equal(built.artifact.claim.releaseDriftRetainsLastAdmittedPlacement, true);
  assert.equal(built.artifact.claim.insertedNodeFocusedInLayers, true);
  assert.equal(built.artifact.claim.selectedInstanceRemovalDiscoverable, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[1], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.explicitInvalidSubjectMappingOnly, true);
  assert.equal(source.diagnosticTextIdentityInference, false);
  assert.equal(source.snapshotBoundSelectionKeyReadmittedByApplication, true);
  assert.equal(built.artifact.claim.explicitContextIdentityMappingOnly, true);
  assert.equal(built.artifact.claim.diagnosticCodeMessagePointerIdentityInference, false);
  assert.equal(built.artifact.claim.snapshotBoundSelectionReadmitted, true);
  assert.equal(source.dedicatedComponentDragHandle, true);
  assert.equal(source.dedicatedLayerDragHandle, true);
  assert.equal(source.componentPanelWideDropSurface, true);
  assert.equal(source.innermostNestedSlotOwnsPointer, true);
  assert.equal(source.stableInsertionLaneGeometry, true);
  assert.equal(source.rowHalfProjectionBroadensHitArea, true);
  assert.equal(source.noOpPlacementFeedbackVisible, true);
  assert.equal(source.releaseDriftRetainsLastAdmittedPlacement, true);
  assert.equal(source.insertedNodeFocusedInLayers, true);
  assert.equal(source.selectedInstanceRemovalDiscoverable, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[2], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.duplicateOccurrenceOrderPreserved, true);
  assert.equal(claim.unmappedDiagnosticsVisible, true);
  assert.equal(claim.unmappedDiagnosticsSelectable, false);
  assert.equal(built.artifact.authority.source.duplicateOccurrenceOrderPreserved, true);
  assert.equal(built.artifact.authority.source.unmappedDiagnosticsVisibleAndInert, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[3], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.reportSnapshotDocumentFingerprintFenced, true);
  assert.equal(claim.reportSnapshotCatalogFingerprintFenced, true);
  assert.equal(claim.routeAndSurfaceFenced, true);
  assert.equal(claim.runtimeKindMismatchFailsClosed, true);
  assert.equal(claim.committedOwnerFingerprintFenced, true);
  assert.equal(built.artifact.authority.source.renderedRouteAndRuntimeKindFenced, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[4], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.invalidPlaceholderAppOwned, true);
  assert.equal(claim.invalidPlaceholderInsideManagedRuntimeSubtree, false);
  assert.equal(claim.lastKnownGoodPreviewPreserved, true);
  assert.equal(
    built.artifact.authority.source.invalidPlaceholderOutsideManagedRuntimeSubtree,
    true,
  );
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[5], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.runModeDiagnosticsVisible, false);
  assert.equal(claim.automaticFocusSteal, false);
  assert.equal(claim.explicitSelectionFocusOnly, true);
  assert.equal(built.artifact.authority.source.runModeDiagnosticsHidden, true);
  assert.equal(built.artifact.authority.source.focusRequiresExplicitSelection, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[6], () => {
  assert.equal(built.artifact.claim.obligationsVisibleMetadataOnly, true);
  assert.equal(built.artifact.claim.obligationsExecutable, false);
  assert.equal(built.artifact.authority.source.obligationsVisibleMetadataOnly, true);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[7], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.rejectedDiagnosticsPersisted, false);
  assert.equal(claim.rejectedDiagnosticsAffectDirtyState, false);
  assert.equal(claim.rejectedDiagnosticsIncludedInSave, false);
  assert.equal(
    built.artifact.authority.source.rejectedCandidateDiagnosticsOutsidePersistence,
    true,
  );
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[8], () => {
  assert.equal(built.artifact.tests.focusedFiles.length, 9);
  assert.equal(
    built.artifact.tests.focusedTestCases,
    DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES,
  );
  assert.deepEqual(built.artifact.tests.testCaseCounts, {
    "apps/desen-app/test/authoring-diagnostics.test.ts": 7,
    "apps/desen-app/test/diagnostics-panel.test.tsx": 4,
    "apps/desen-app/test/authoring-inspector.test.ts": 27,
    "apps/desen-app/test/authoring-state.test.ts": 13,
    "apps/desen-app/test/authoring-event-actions.test.ts": 13,
    "apps/desen-app/test/authoring-slots.test.ts": 28,
    "apps/desen-app/test/adapter-canvas.test.tsx": 10,
    "apps/desen-app/test/application.test.tsx": 42,
    "apps/desen-app/test/persistence-application.test.tsx": 17,
  });
  assert.equal(built.artifact.tests.fullAppTestFiles, 24);
  assert.equal(built.artifact.tests.fullAppTestCases, 339);
  assert.equal(built.artifact.boundary.trackedFiles, 39);
  assert.equal(built.artifact.boundary.historicalProofReadersTracked, false);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[9], async () => {
  const rebuilt = await buildDesenAppNodeLinkedDiagnosticsEvidence();
  assert.deepEqual(rebuilt.artifactBytes, built.artifactBytes);
  assert.equal(rebuilt.artifactSha256, built.artifactSha256);
  assert.deepEqual(JSON.parse(built.artifactBytes), built.artifact);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[10], async () => {
  const sourceMutations = [
    ["authoringDiagnostics", "report.invalidSubjects", "[]"],
    ["authoringDiagnostics", "mapping.occurrencePointers.map", "[].map"],
    [
      "authoringDiagnostics",
      "report.documentFingerprint !== snapshot.documentFingerprint",
      "false",
    ],
    ["authoringDiagnostics", "runtimeNodeIdsByBehaviorId", "runtimeNodeIdsBySourceNodeId"],
    ["diagnosticsPanel", '<section aria-label="Validation diagnostics"', "<section"],
    ["diagnosticsPanel", 'type="button"', 'autoFocus type="button"'],
    ["adapterCanvas", 'data-diagnostic-placeholder="source-identity"', ""],
    [
      "application",
      "transientDiagnostics.ownerDocumentFingerprint === committedDocumentFingerprint",
      "true",
    ],
    ["application", "captureEditDiagnostics(result);", "void result;"],
    ["application", 'data-component-drag-handle="true"', ""],
    ["application", 'data-layer-drag-handle="true"', ""],
    ["application", "data-layer-drop-row-node-id={node.id}", ""],
    [
      "application",
      "onDragEnter={enterComponentDrop}\n        onDragLeave={leaveComponentDrop}\n        onDragOver={admitComponentDrop}\n        onDrop={receiveComponentDrop}",
      "onDragEnter={undefined}\n        onDragLeave={undefined}\n        onDragOver={undefined}\n        onDrop={undefined}",
    ],
    ["application", 'releaseAdmission.status === "rejected"', "false"],
    ["application", '"Current position"', '"Drop here"'],
    ["application", "pendingLayerFocus.current = result.nodeId", "void result.nodeId"],
    ["application", "clientY < midpoint", "false"],
    ["applicationCss", ".layerDragHandle::before", ".layerGrip::before"],
    ["applicationCss", '.slotBoundary[data-drop-noop-hovered="true"]::before', ".slotBoundary"],
    ["authoringInspector", "readonly validationReport?:", "readonly rejectedReport?:"],
    [
      "authoringState",
      'return failure("source-invalid", validationReport)',
      'return failure("source-invalid")',
    ],
    [
      "persistence",
      "export interface AuthoringPersistenceState",
      "validationReport\nexport interface AuthoringPersistenceState",
    ],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppNodeLinkedDiagnosticsSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppNodeLinkedDiagnosticsSourcePolicy({
        ...sourcePolicyInput,
        applicationCss: replaceOnce(
          sourcePolicyInput.applicationCss,
          ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;",
          ".slotBoundaryHitArea {\n  position: absolute;\n  inset: -0.5rem 0;",
        ),
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const diagnosticsTest = testSources.get(TEST_PATHS.authoringDiagnostics);
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([
        [
          TEST_PATHS.authoringDiagnostics,
          Buffer.from(
            replaceOnce(
              diagnosticsTest,
              "creates links only from invalidSubjects and leaves code/message/pointer guesses visible but inert",
              "creates links from convenient metadata",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([
        [
          TEST_PATHS.diagnosticsPanel,
          Buffer.from(`${testSources.get(TEST_PATHS.diagnosticsPanel)}\nit("drift", () => {});\n`),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([
        [
          APP_PACKAGE_PATH,
          Buffer.from(replaceOnce(appPackageSource, "test:diagnostics", "test:diagnostics-drift")),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([
        [
          ROOT_PACKAGE_PATH,
          Buffer.from(
            replaceOnce(
              rootPackageSource,
              "generate:desen-app-node-linked-diagnostics",
              "generate:desen-app-node-linked-diagnostics-drift",
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES[11], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppNodeLinkedDiagnosticsEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.focusedTestCases, 161);
  assert.equal(verified.trackedFiles, 39);
  assert.equal(verified.prerequisites, 11);
  assert.equal(verified.p16Status, "PROVEN");
  assert.equal(verified.pf086Status, "OPEN");

  for (const pin of DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS) {
    await assert.rejects(
      buildDesenAppNodeLinkedDiagnosticsEvidence({
        fileOverrides: new Map([[pin.path, changedByte(parentArtifactBytes.get(pin.path))]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }
  await assert.rejects(
    verifyDesenAppNodeLinkedDiagnosticsEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppNodeLinkedDiagnosticsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Task: M09-T13\nStatus: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-app-node-linked-diagnostics-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeDesenAppNodeLinkedDiagnosticsEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = path.join(directory, "sentinel.json");
  const linkedArtifact = path.join(directory, "linked-artifact.json");
  await writeFile(sentinel, "sentinel\n");
  await symlink(sentinel, linkedArtifact);
  await assert.rejects(
    writeDesenAppNodeLinkedDiagnosticsEvidence({ artifactPath: linkedArtifact }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.equal(await readFile(sentinel, "utf8"), "sentinel\n");
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
      buildDesenAppNodeLinkedDiagnosticsEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[M10-T01A successor] authenticates the exact product-created blank-project closure", async () => {
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
      buildDesenAppNodeLinkedDiagnosticsEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  assert.equal(successor.task, "M10-T01A");
  assert.equal(
    successor.artifact.sha256,
    "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
  );
  assert.equal(successor.currentProjection.currentReceipts.length, 43);
  for (const relativePath of [
    successor.artifact.path,
    "apps/desen-app/package.json",
    "apps/desen-app/src/application.module.css",
    "apps/desen-app/src/local-runtime-persistence.ts",
    "apps/desen-app/src/product-bootstrap.tsx",
    "dependency-cruiser.config.cjs",
    "pnpm-lock.yaml",
  ]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppNodeLinkedDiagnosticsEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[successor] authenticates and mutation-tests the exact M09-T14/G09 publish-activation closure", async () => {
  assert.equal(built.artifactBytes.byteLength, 29_208);
  assert.equal(
    built.artifactSha256,
    "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
  );
  assert.deepEqual(built.currentCompatibility.retainedClaim, {
    taskStatus: "DONE",
    immutableRejectedCandidateReport: true,
    explicitContextIdentityMappingOnly: true,
    rejectedDiagnosticsPersisted: false,
    publicationClaimed: false,
    activationClaimed: false,
    p08Status: "NOT_PROVEN",
    p16Status: "PROVEN",
    pf086Status: "OPEN",
    pf089Status: "OPEN",
  });

  const successor = built.currentCompatibility.publishActivationSuccessor;
  assert.deepEqual(successor, {
    task: "M09-T14",
    gate: "G09",
    artifact: {
      task: "M09-T14",
      gate: "G09",
      proofId: "desen-app-publish-activation",
      profile: "desen.app.publish-activation-proof.v1",
      result: "PASS",
      path: PUBLISH_ACTIVATION_ARTIFACT,
      bytes: 24_763,
      sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
    },
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
  });

  const [artifactBytes, publicationSourceBytes, publicationApplicationBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLICATION_SOURCE_PATH)),
    readFile(path.join(ROOT, PUBLICATION_APPLICATION_TEST)),
  ]);
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([[PUBLICATION_SOURCE_PATH, changedByte(publicationSourceBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
      fileOverrides: new Map([
        [PUBLICATION_APPLICATION_TEST, changedByte(publicationApplicationBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppNodeLinkedDiagnosticsEvidence({
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
