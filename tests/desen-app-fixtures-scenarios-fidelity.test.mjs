import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES,
  DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_PARENT_PINS,
  DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES,
  DesenAppFixturesScenariosFidelityProofError,
  buildDesenAppFixturesScenariosFidelityEvidence,
  verifyDesenAppFixturesScenariosFidelityEvidence,
  verifyDesenAppFixturesScenariosFidelitySourcePolicy,
  writeDesenAppFixturesScenariosFidelityEvidence,
} from "../scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze(
  DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_PARENT_PINS.map(({ path: relativePath }) => relativePath),
);
const SOURCE_PATHS = Object.freeze({
  fixtureSource: "apps/desen-app/src/authoring-fixtures.ts",
  scenarioSource: "apps/desen-app/src/authoring-scenarios.ts",
  fidelitySource: "apps/desen-app/src/preview-fidelity.ts",
  controlsSource: "apps/desen-app/src/preview-controls.tsx",
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  inspectorSource: "apps/desen-app/src/inspector-panel.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
});
const FIXTURE_TEST_PATH = "apps/desen-app/test/authoring-fixtures.test.ts";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const temporaryDirectories = [];
let parentArtifactBytes;
let sourcePolicyInput;
let fixtureTestSource;
let applicationTestSource;
let rootPackageSource;
let appPackageSource;
let built;

function expectedError(code) {
  return (error) =>
    error instanceof DesenAppFixturesScenariosFidelityProofError && error.code === code;
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
      "# Desen App fixtures, scenarios, and fidelity",
      "",
      "Task: M09-T11",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "P-09: PARTIAL",
      "P-10: PARTIAL",
      "S-001: TESTED",
      "PF-025: OPEN",
      "PF-028: CLOSED",
      "PF-083: OPEN",
      "PF-089: OPEN",
      "M09-T12: NOT_PROVEN",
      "M09-T13: NOT_PROVEN",
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
  [fixtureTestSource, applicationTestSource, rootPackageSource, appPackageSource] =
    await Promise.all([
      readFile(path.join(ROOT, FIXTURE_TEST_PATH), "utf8"),
      readFile(path.join(ROOT, APPLICATION_TEST_PATH), "utf8"),
      readFile(path.join(ROOT, ROOT_PACKAGE_PATH), "utf8"),
      readFile(path.join(ROOT, APP_PACKAGE_PATH), "utf8"),
    ]);
  built = await buildDesenAppFixturesScenariosFidelityEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-fixtures-scenarios-fidelity");
  assert.equal(built.artifact.profile, "desen.app.fixtures-scenarios-fidelity-proof.v1");
  assert.equal(built.artifact.task, "M09-T11");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[1], () => {
  const scenario = built.artifact.authority.source.scenario;
  assert.equal(scenario.propsOnly, true);
  assert.equal(scenario.stateAndFixturesFailClosed, true);
  assert.equal(scenario.publicEditorCoreTransitions, true);
  assert.equal(scenario.publisherPreviewPreparedSeparately, true);
  assert.equal(scenario.authoredDocumentMutation, false);
  assert.equal(scenario.currentPreviewMutation, false);
  assert.equal(built.artifact.claim.scenarioSourceAndBundleEphemeral, true);
  assert.equal(built.artifact.claim.authoredSourceAndPublishablePreviewUnchanged, true);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[2], () => {
  const fixture = built.artifact.authority.source.fixture;
  assert.equal(fixture.publicTestkitProjection, true);
  assert.deepEqual(fixture.exactOutcomes, ["success:user-1", "error:invalidCredentials"]);
  assert.equal(fixture.staticPendingOption, false);
  assert.equal(fixture.unavailableFixtureOption, false);
  assert.equal(fixture.exactRequestContextAuthorization, true);
  assert.equal(fixture.requestInputObservedOrRetained, false);
  assert.equal(fixture.executableHostBinding, false);
  assert.deepEqual(built.artifact.claim.visibleExecutionContexts, [
    "synthetic",
    "integration",
    "production",
  ]);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[3], () => {
  const fixture = built.artifact.authority.source.fixture;
  assert.equal(fixture.realPromisePending, true);
  assert.equal(fixture.explicitSettlement, true);
  assert.equal(fixture.stableOperationPort, true);
  assert.equal(fixture.disposeRevokesPending, true);
  assert.equal(built.artifact.claim.pendingRuntimeLifecycleExercised, true);
  assert.equal(built.artifact.claim.pendingRevokedOnPreviewReplacement, true);
  assert.equal(built.artifact.claim.pf028Status, "CLOSED");
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[4], () => {
  const fidelity = built.artifact.authority.source.fidelity;
  assert.deepEqual(fidelity.kinds, ["same", "equivalent", "undeclared", "approximate"]);
  assert.equal(fidelity.conservativePrecedence, true);
  assert.equal(fidelity.completeDeclaredDifferences, true);
  assert.equal(fidelity.approximateEmptyFallbackVisible, true);
  assert.equal(fidelity.missingOrInvalidMetadataUndeclared, true);
  assert.equal(fidelity.runtimeOrPrivateAdapterInspection, false);
  assert.equal(built.artifact.claim.s001Status, "TESTED");
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[5], () => {
  const controls = built.artifact.authority.source.controls;
  assert.deepEqual(controls.visibleExecutionContexts, ["synthetic", "integration", "production"]);
  assert.equal(controls.scenarioPreviewOnlyDisclosure, true);
  assert.equal(controls.pendingNotSelectable, true);
  assert.equal(controls.explicitCompleteControl, true);
  assert.equal(controls.approximateAlertPersistent, true);
  assert.equal(controls.completeDifferenceList, true);
  assert.equal(controls.undeclaredFidelityWarning, true);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[6], () => {
  const application = built.artifact.authority.source.application;
  const currentApplication = built.currentCompatibility.source.application;
  const currentCss = built.currentCompatibility.source.css;
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(application.scenarioSelectionDesignOnly, true);
  assert.equal(application.scenarioPreviewSeparateFromAuthoringSession, true);
  assert.equal(application.scenarioPersistsAcrossModeToggle, true);
  assert.equal(application.exactEffectivePreviewRevisionBindsController, true);
  assert.equal(application.pendingControllerDisposedOnPreviewReplacement, true);
  assert.equal(application.componentDragAuthorityLimitedToDedicatedHandle, true);
  assert.equal(application.oneGlobalLayerDropProjection, true);
  assert.equal(application.nestedSlotSurfaceOwnsDropEvents, true);
  assert.equal(application.layerMidpointHysteresis, 4);
  assert.equal(currentApplication.draggableComponentCard, true);
  assert.equal(currentApplication.separateNonDraggableComponentAddAction, true);
  assert.equal(currentApplication.componentDropAdmissionLimitedToExplicitTarget, true);
  assert.equal(currentApplication.componentPaletteOuterDropInert, true);
  assert.equal(currentApplication.stableGlobalLayerDragSession, true);
  assert.equal(currentApplication.globalLayerOwnerAndEpochFencing, true);
  assert.equal(currentApplication.edgeScrollExactSlotRehitTesting, true);
  assert.equal(currentCss.nestedLayerSlotsAndGlobalDragGuideVisible, true);
  assert.equal(currentCss.draggableComponentCardAndSeparateAddActionVisible, true);
  assert.equal(adapter.hostPortIdentityInMountLifetime, true);
  assert.equal(adapter.sessionDisposedOnReplacement, true);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[7], () => {
  assert.equal(built.artifact.application.package.appName, "@desen/app-web");
  assert.equal(built.artifact.application.package.testkitDependency, "workspace:*");
  assert.equal(
    built.artifact.application.package.appTestCommand,
    "vitest run test/authoring-fixtures.test.ts test/authoring-scenarios.test.ts test/preview-fidelity.test.ts test/preview-controls.test.tsx test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(Object.keys(built.artifact.application.package.rootCommands).length, 3);
  assert.equal(built.currentCompatibility.tests.testCaseCounts[APPLICATION_TEST_PATH], 42);
  assert.equal(built.currentCompatibility.tests.focusedTestCases, 88);
  assert.equal(built.artifact.boundary.focusedAppTestCaseCountPinned, true);
  assert.equal(built.artifact.boundary.finalCommandWiringPinned, true);
  assert.equal(built.artifact.tests.rootTestNames.length, 11);
  assert.equal(
    built.artifact.tests.semanticCoverage.includes(
      "REQUEST_INPUT_AND_PASSWORD_NOT_OBSERVED_OR_RETAINED",
    ),
    true,
  );
  assert.equal(
    built.artifact.tests.semanticCoverage.includes(
      "VISIBLE_COMPLETE_APPROXIMATE_FIDELITY_DIFFERENCES",
    ),
    true,
  );
  for (const count of Object.values(built.artifact.tests.testDeclarationCounts)) {
    assert.equal(Number.isSafeInteger(count) && count > 0, true);
  }
  assert.deepEqual(Object.values(built.artifact.tests.testCaseCounts), [20, 7, 6, 3, 10, 40]);
  assert.equal(
    built.artifact.tests.focusedTestCases,
    DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES,
  );
  assert.equal(built.artifact.tests.focusedTestCases, 86);
  assert.equal(built.artifact.boundary.focusedAppTestCases, 86);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[8], async () => {
  const second = await buildDesenAppFixturesScenariosFidelityEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[9], async () => {
  const mutations = [
    {
      key: "fixtureSource",
      search: "operations: [signInOperationRegistration]",
      replacement: "operations: []",
    },
    {
      key: "fixtureSource",
      search: 'id: "success",',
      replacement: 'id: "pending",',
    },
    {
      key: "fixtureSource",
      search: "const invoke = (",
      replacement: "const leaked = request.input;\n  void leaked;\n  const invoke = (",
    },
    {
      key: "fixtureSource",
      search: 'readContextString("surfaceId") === expectedContext.surfaceId',
      replacement: 'readContextString("surfaceId") !== undefined',
    },
    {
      key: "fixtureSource",
      search: "if (disposed || !active || !isAuthorizedSignInRequest(request, expectedContext))",
      replacement: "if (disposed || !isAuthorizedSignInRequest(request, expectedContext))",
    },
    {
      key: "scenarioSource",
      search: 'hasOwnData(scenario, "fixtures") || hasOwnData(scenario, "state")',
      replacement: 'hasOwnData(scenario, "fixtures")',
    },
    {
      key: "scenarioSource",
      search: "scenarioDocument = edited.document",
      replacement:
        "setAuthoringSession(edited.document);\n      scenarioDocument = edited.document",
    },
    {
      key: "fidelitySource",
      search: "Object.freeze([APPROXIMATE_FIDELITY_FALLBACK])",
      replacement: "Object.freeze([])",
    },
    {
      key: "controlsSource",
      search: "entry.differences.map((difference)",
      replacement: "entry.differences.slice(0, 1).map((difference)",
    },
    {
      key: "adapterSource",
      search: "[bundle, hostPorts, previewRevision, routeIdentity, supported]",
      replacement: "[bundle, previewRevision, routeIdentity, supported]",
    },
    {
      key: "applicationSource",
      search: "revision: fixtureRevision",
      replacement: 'revision: "unbound"',
    },
    {
      key: "applicationSource",
      search: "fixtureController.deactivate()",
      replacement: "fixtureController.activate()",
    },
    {
      key: "applicationSource",
      search: "const LAYER_DROP_MIDPOINT_HYSTERESIS_PX = 4",
      replacement: "const LAYER_DROP_MIDPOINT_HYSTERESIS_PX = 0",
    },
    {
      key: "applicationSource",
      search: 'import { flushSync } from "react-dom";',
      replacement: 'import { createPortal } from "react-dom";',
    },
    {
      key: "applicationSource",
      search: "flushSync(() => {",
      replacement: "queueMicrotask(() => {",
    },
    {
      key: "applicationSource",
      search: 'data-layer-slot-surface="true"',
      replacement: 'data-layer-slot-surface="false"',
    },
    {
      key: "applicationSource",
      search: "onProjectDrop={projectDrop}",
      replacement: "onProjectDrop={() => undefined}",
    },
    {
      key: "applicationSource",
      search: 'data-component-card="true"',
      replacement: 'data-component-card="false"',
    },
    {
      key: "applicationSource",
      search: "draggable={enabled}",
      replacement: "draggable={false}",
    },
    {
      key: "applicationSource",
      search: "className={styles.componentAddAction}",
      replacement: "className={styles.componentItemAction}",
    },
    {
      key: "applicationSource",
      search: "draggable={false}",
      replacement: "draggable={enabled}",
    },
    {
      key: "applicationSource",
      search: "event.preventDefault();\n                                event.stopPropagation();",
      replacement: "event.preventDefault();",
    },
    {
      key: "applicationSource",
      search: "onDragOver={admitComponentDrop}",
      replacement: "onDragOver={() => undefined}",
    },
    {
      key: "applicationSource",
      search:
        'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
      replacement:
        'if (!componentDropReady) return;\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
    },
    {
      key: "applicationSource",
      search: 'event.dataTransfer.dropEffect = "none"',
      replacement: 'event.dataTransfer.dropEffect = "copy"',
    },
    {
      key: "applicationSource",
      search:
        'if (dragIntent?.kind !== "component") return;\n        event.preventDefault();\n        onClearDrag();',
      replacement:
        'if (dragIntent?.kind !== "component") return;\n        event.preventDefault();\n        addComponent(dragIntent.componentId);',
    },
    {
      key: "applicationSource",
      search: "onDrop={receiveComponentDrop}",
      replacement: "onDrop={() => undefined}",
    },
    {
      key: "applicationSource",
      search: "onClick={() => addComponent(component.id)}",
      replacement: "onClick={() => undefined}",
    },
    {
      key: "applicationSource",
      search:
        "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      replacement: "const sessionOwnerKey = target.ownerId",
    },
    {
      key: "applicationSource",
      search: "pending.sessionEpoch !== currentSession.epoch",
      replacement: "pending.sessionEpoch === currentSession.epoch",
    },
    {
      key: "applicationSource",
      search: "pending.ownerKey !== currentSession.ownerKey",
      replacement: "pending.ownerKey === currentSession.ownerKey",
    },
    {
      key: "applicationSource",
      search: "document.elementFromPoint(pending.clientX, pending.clientY)",
      replacement: "pending.eventTarget",
    },
    {
      key: "applicationSource",
      search: "hitSlotSurface !== pending.slotSurface",
      replacement: "hitSlotSurface === pending.slotSurface",
    },
    {
      key: "applicationSource",
      search: "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      replacement: "dragSession.current = createAuthoringDragSession(current.epoch)",
    },
    {
      key: "applicationSource",
      search: "function clearUnclaimedDrop(): void {",
      replacement: "function keepUnclaimedDrop(): void {",
    },
    {
      key: "applicationCss",
      search: ".layerDragGuide {",
      replacement: ".removedLayerDragGuide {",
    },
    {
      key: "applicationCss",
      search: ".componentItem {",
      replacement: ".removedComponentItem {",
    },
    {
      key: "applicationCss",
      search: ".componentAddAction {",
      replacement: ".removedComponentAddAction {",
    },
    {
      key: "applicationSource",
      search: 'import referenceCatalog from "@desen/reference-catalog-web/catalog.json";',
      replacement:
        'import referenceCatalog from "@desen/reference-catalog-web/catalog.json";\nimport { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";',
    },
    {
      key: "applicationCss",
      search: ".fidelityDetails strong {",
      replacement: ".removedFidelityDetails strong {",
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () =>
        verifyDesenAppFixturesScenariosFidelitySourcePolicy({
          ...sourcePolicyInput,
          [mutation.key]: replaceOnce(
            sourcePolicyInput[mutation.key],
            mutation.search,
            mutation.replacement,
          ),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
      `${mutation.key} mutation must fail closed: ${mutation.search}`,
    );
  }

  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([
        [
          FIXTURE_TEST_PATH,
          Buffer.from(
            replaceOnce(
              fixtureTestSource,
              "never reads, retains, or logs operation input and password data",
              "does not prove secret retention",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([
        [
          APPLICATION_TEST_PATH,
          Buffer.from(`${applicationTestSource}\nit("unreviewed focused case", () => {});\n`),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([
        [
          APP_PACKAGE_PATH,
          Buffer.from(
            replaceOnce(
              appPackageSource,
              '"@desen/testkit": "workspace:*"',
              '"@desen/testkit": "0.0.0"',
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([
        [
          ROOT_PACKAGE_PATH,
          Buffer.from(
            replaceOnce(
              rootPackageSource,
              '"verify:desen-app-fixtures-scenarios-fidelity": "node scripts/verify-desen-app-design-run-modes.mjs',
              '"verify:desen-app-fixtures-scenarios-fidelity": "node scripts/verify-desen-app-real-adapter-canvas.mjs',
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES[10], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppFixturesScenariosFidelityEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppFixturesScenariosFidelityEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 3);
  assert.equal(verified.s001Status, "TESTED");
  assert.equal(verified.pf028Status, "CLOSED");
  assert.equal(verified.pf089Status, "OPEN");

  await assert.rejects(
    verifyDesenAppFixturesScenariosFidelityEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppFixturesScenariosFidelityEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t11-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppFixturesScenariosFidelityEvidence({
    artifactPath: destination,
  });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppFixturesScenariosFidelityEvidence({
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
    writeDesenAppFixturesScenariosFidelityEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppFixturesScenariosFidelityEvidence({
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
    buildDesenAppFixturesScenariosFidelityEvidence({
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
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
