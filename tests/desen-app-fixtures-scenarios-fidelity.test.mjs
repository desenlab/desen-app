import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  mkdtemp,
  readFile as readLiveFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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
import { createDesenAppHistoricalReaderReadFile } from "./desen-app-historical-reader-fixture.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const readFile = createDesenAppHistoricalReaderReadFile({
  workspaceRoot: ROOT,
  liveReadFile: readLiveFile,
});
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
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLICATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
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
  assert.equal(currentApplication.applicationReactDomImports, 0);
  assert.equal(currentApplication.reactDomAuthoritySurrendered, true);
  assert.equal(currentApplication.componentDragAuthorityLimitedToDedicatedHandle, true);
  assert.equal(currentApplication.dedicatedLayerDragHandle, true);
  assert.equal(currentApplication.separateNonDraggableComponentAddAction, true);
  assert.equal(currentApplication.componentPanelWideDropSurface, true);
  assert.equal(currentApplication.stickyComponentTargetDirectDropSurface, true);
  assert.equal(currentApplication.stableGlobalLayerDragSession, true);
  assert.equal(currentApplication.globalLayerOwnerAndEpochFencing, true);
  assert.equal(currentApplication.edgeScrollExactSlotRehitTesting, true);
  assert.equal(currentCss.nestedLayerSlotsAndGlobalDragGuideVisible, true);
  assert.equal(currentCss.dedicatedDragHandlesAndSeparateAddActionVisible, true);
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
  assert.equal(built.currentCompatibility.tests.testCaseCounts[APPLICATION_TEST_PATH], 44);
  assert.equal(built.currentCompatibility.tests.focusedTestCases, 91);
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
      search: "registrations.push(registerOperation({ id: capabilityId, manifest }));",
      replacement: 'registrations.push(registerOperation({ id: "forged", manifest }));',
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
      search: "if (disposed || !active || !hasAuthorizedRequestContext(request, expectedContext))",
      replacement: "if (disposed || !hasAuthorizedRequestContext(request, expectedContext))",
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
      search: '} from "react";',
      replacement: '} from "react";\nimport { flushSync } from "react-dom";',
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
      search: 'data-component-drag-handle="true"',
      replacement: 'data-component-drag-handle="false"',
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
      search: 'admission.status === "noop"\n        ? "none"',
      replacement: 'admission.status === "accepted"\n        ? "none"',
    },
    {
      key: "applicationSource",
      search: "panelDragEnterDepth.current += 1",
      replacement: "panelDragEnterDepth.current = 1",
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
              "never reads or retains operation input and rejects accessor authorization fields",
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
      buildDesenAppFixturesScenariosFidelityEvidence({
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
      buildDesenAppFixturesScenariosFidelityEvidence({
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
  assert.equal(
    successor.currentProjection.relationship,
    "EXACT_M10_T01A_ARTIFACT_OWNED_LIVE_RECEIPTS",
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
      buildDesenAppFixturesScenariosFidelityEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[M10-T01B successor] authenticates visual behavior authoring and fails closed on substitutions", async () => {
  const successor = built.currentCompatibility.visualBehaviorAuthoringSuccessor;
  assert.deepEqual(
    {
      task: successor.task,
      artifact: successor.artifact,
      predecessor: successor.predecessor,
      relationship: successor.currentProjection.relationship,
      trackedFiles: successor.trackedFiles,
      rootTests: successor.rootTests,
      visualInputConnectionCovered: successor.visualInputConnectionCovered,
      visualOperationActionCovered: successor.visualOperationActionCovered,
      visualConditionalPresenceCovered: successor.visualConditionalPresenceCovered,
      catalogDerivedRunControlsCovered: successor.catalogDerivedRunControlsCovered,
      advancedJsonRetained: successor.advancedJsonRetained,
      p08Status: successor.p08Status,
      p09Status: successor.p09Status,
      m10T02Closed: successor.m10T02Closed,
      realHostOperationCovered: successor.realHostOperationCovered,
      g10Closed: successor.g10Closed,
    },
    {
      task: "M10-T01B",
      artifact: {
        path: "docs/proof/artifacts/desen-app-0.1.0-visual-behavior-authoring.json",
        bytes: 10_962,
        sha256: "cd7366014a0cb6f056fa78392f81ef7cb4b5be2f523b95e5984c704be3caf0e8",
        immutable: true,
      },
      predecessor: {
        task: "M10-T01A",
        gate: null,
        proofId: "desen-app-user-created-blank-project",
        path: "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
        bytes: 20_173,
        sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
        profile: "desen.app.user-created-blank-project-proof.v1",
        result: "PASS",
        immutable: true,
      },
      relationship: "EXACT_M10_T01B_ARTIFACT_OWNED_LIVE_RECEIPTS",
      trackedFiles: 31,
      rootTests: 9,
      visualInputConnectionCovered: true,
      visualOperationActionCovered: true,
      visualConditionalPresenceCovered: true,
      catalogDerivedRunControlsCovered: true,
      advancedJsonRetained: true,
      p08Status: "PROVEN",
      p09Status: "PARTIAL",
      m10T02Closed: false,
      realHostOperationCovered: false,
      g10Closed: false,
    },
  );
  assert.equal(successor.currentProjection.trackedReceipts.length, 31);
  assert.equal(
    successor.currentProjection.artifactBackedPaths.includes("apps/desen-app/README.md"),
    false,
  );
  assert.deepEqual(successor.currentProjection.hostedBrowserCompatibility, {
    compatibilityReceipt: "M10-T01B-HOSTED-BROWSER-COMPAT",
    correctiveReceiptOnly: true,
    overriddenHistoricalPaths: ["apps/desen-app-browser-e2e/user-created-blank-project.pw.ts"],
    trackedReceipts: [
      {
        path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
        bytes: 15_143,
        sha256: "5fcdc7f312bb2ef45e747499e50bf31f2dfae8e1c1b82963176d99eb8bb8395b",
      },
    ],
  });

  const artifactPath = successor.artifact.path;
  const receiptPath = "apps/desen-app/src/authoring-connections.ts";
  const hostedBrowserPath = "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts";
  const [artifactBytes, receiptBytes, hostedBrowserBytes] = await Promise.all([
    readFile(path.join(ROOT, artifactPath)),
    readFile(path.join(ROOT, receiptPath)),
    readFile(path.join(ROOT, hostedBrowserPath)),
  ]);
  for (const [relativePath, bytes] of [
    [artifactPath, changedByte(artifactBytes)],
    [artifactPath, Buffer.alloc(0)],
    [receiptPath, changedByte(receiptBytes)],
    [receiptPath, Buffer.alloc(0)],
    [hostedBrowserPath, changedByte(hostedBrowserBytes)],
    [hostedBrowserPath, Buffer.alloc(0)],
  ]) {
    await assert.rejects(
      buildDesenAppFixturesScenariosFidelityEvidence({
        fileOverrides: new Map([[relativePath, bytes]]),
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
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
      fileOverrides: new Map([
        [PUBLICATION_APPLICATION_TEST, changedByte(publicationApplicationBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppFixturesScenariosFidelityEvidence({
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
