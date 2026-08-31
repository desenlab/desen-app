import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN,
  DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
  DesenAppShellNavigationProofError,
  buildDesenAppShellNavigationEvidence,
  verifyDesenAppShellNavigationEvidence,
  writeDesenAppShellNavigationEvidence,
} from "../scripts/lib/desen-app-shell-navigation-proof.mjs";

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
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const PREREQUISITE = "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json";
const FIXTURES_SCENARIOS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLISH_ACTIVATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
const NAVIGATION = "apps/desen-app/src/project-navigation.ts";
const APPLICATION = "apps/desen-app/src/application.tsx";
const ADAPTER_CANVAS = "apps/desen-app/src/adapter-canvas.tsx";
const AUTHORING_SELECTION = "apps/desen-app/src/authoring-selection.ts";
const LOGO = "apps/desen-app/src/assets/desen-logo.svg";
const INDEX = "apps/desen-app/index.html";
const PACKAGE = "apps/desen-app/package.json";
const ROOT_PACKAGE = "package.json";
const temporaryDirectories = [];
let built;
let fixturesScenariosArtifactBytes;

function expectedError(code) {
  return (error) => error instanceof DesenAppShellNavigationProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    `# Desen App shell and navigation\n\nTask: M09-T01\n\nStatus: DONE\n\nArtifact: \`${ARTIFACT}\`\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`,
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  [built, fixturesScenariosArtifactBytes] = await Promise.all([
    buildDesenAppShellNavigationEvidence(),
    readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT)),
  ]);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("[authority] binds M09-T01 to the exact completed G08 artifact", () => {
  assert.equal(built.artifactBytes.byteLength, 12_118);
  assert.equal(
    built.artifactSha256,
    "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
  );
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-shell-navigation");
  assert.equal(built.artifact.profile, "desen.app.shell-navigation-proof.v1");
  assert.equal(built.artifact.task, "M09-T01");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.prerequisiteGate, "G08");
  assert.equal(built.artifact.claim.prerequisiteStatus, "DONE");
  assert.deepEqual(
    built.artifact.evidence.rootTestNames,
    DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
  );
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.additiveSuccessor.task, "M09-T07");
  assert.deepEqual(built.currentCompatibility.additiveSuccessor.artifact, {
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    path: "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json",
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
  });
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.task, "M09-T11");
  assert.equal(built.currentCompatibility.fixturesScenariosSuccessor.focusedTestCases, 86);
  assert.equal(
    built.currentCompatibility.fixturesScenariosSuccessor.operationInputOrPasswordRetained,
    false,
  );
});

test("[shell] records the closed route, fixture, guidance, and accessibility profile", () => {
  assert.deepEqual(built.artifact.application.shell.routes, [
    "/projects",
    "/projects/:projectId",
    "/projects/:projectId/surfaces/:surfaceId",
  ]);
  assert.deepEqual(built.artifact.application.shell.fixtureProjects, [
    "account-app",
    "checkout-pilot",
  ]);
  assert.equal(built.artifact.application.shell.unknownRoutePolicy, "EXPLICIT_NOT_FOUND");
  assert.equal(
    built.artifact.application.shell.navigationAuthority,
    "SAME_ORIGIN_HISTORY_API_WITH_POPSTATE_AND_APP_EVENT",
  );
  assert.equal(built.artifact.application.shell.disabledFutureActionsExplained, true);
  assert.equal(built.artifact.application.shell.keyboardFocusVisible, true);
  assert.equal(built.artifact.application.shell.routeHeadingFocus, true);
  assert.equal(built.artifact.application.shell.reducedMotionHonored, true);
  assert.deepEqual(built.artifact.application.shell.localSvgAssets, [
    "apps/desen-app/src/assets/breadcrumb-separator.svg",
    "apps/desen-app/src/assets/desen-logo.svg",
    "apps/desen-app/src/assets/plus.svg",
    "apps/desen-app/src/assets/settings.svg",
    "apps/desen-app/src/assets/theme.svg",
  ]);
  assert.equal(built.artifact.evidence.tests.positiveAndNegativeCoverage, true);
  assert.deepEqual(built.artifact.evidence.tests.runtimeCases, {
    "project-navigation.test.ts": 30,
    "application.test.tsx": 10,
    "main-lifecycle.test.tsx": 3,
  });
  assert.equal(built.artifact.evidence.tests.totalRuntimeCases, 43);
});

test("[boundary] keeps the first app slice free of editor, renderer, persistence, and publish authority", () => {
  assert.deepEqual(
    {
      catalogDrivenPanelImplemented: built.artifact.claim.catalogDrivenPanelImplemented,
      realAdapterCanvasImplemented: built.artifact.claim.realAdapterCanvasImplemented,
      selectionOrInspectorImplemented: built.artifact.claim.selectionOrInspectorImplemented,
      persistenceUiImplemented: built.artifact.claim.persistenceUiImplemented,
      runOrPublishImplemented: built.artifact.claim.runOrPublishImplemented,
      userProjectCreationImplemented: built.artifact.claim.userProjectCreationImplemented,
    },
    {
      catalogDrivenPanelImplemented: false,
      realAdapterCanvasImplemented: false,
      selectionOrInspectorImplemented: false,
      persistenceUiImplemented: false,
      runOrPublishImplemented: false,
      userProjectCreationImplemented: false,
    },
  );
  assert.equal(built.artifact.boundary.imports.desenPackageImports, 0);
  assert.equal(built.artifact.boundary.imports.arbitraryExecutableImports, 0);
  assert.equal(built.artifact.boundary.imports.arbitraryExecutableHtmlEntries, 0);
  assert.equal(built.artifact.boundary.trackedFiles, 24);
  assert.equal(built.artifact.nonclaims.length, 4);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.catalogDrivenAuthoringReadModelAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.exactPublicRuntimeAdapterCanvasAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.stableSourceSelectionOverlayAllowed,
    undefined,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.stableSourceSelectionStatusAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.selectionStatusOwner,
    "LEFT_AUTHORING_PANEL",
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.diagnosticStatusOwner,
    "RIGHT_INSPECTOR",
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.previewFrameEditorChromeRendered,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.optionalAdapterDesignChromeCapabilityAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoCatalogPanelNonclaimAppliedToCurrentApp,
    false,
  );
  assert.deepEqual(built.currentCompatibility.additiveSuccessor.knownSourceEdges, [
    "apps/desen-app/src/authoring-data.ts",
    "apps/desen-app/src/adapter-canvas.tsx",
    "apps/desen-app/src/authoring-selection.ts",
    "apps/desen-app/src/authoring-inspector.ts",
    "apps/desen-app/src/authoring-preview.ts",
    "apps/desen-app/src/inspector-panel.tsx",
    "apps/desen-app/src/structured-json.ts",
    "apps/desen-app/src/authoring-slots.ts",
    "apps/desen-app/src/authoring-state.ts",
    "apps/desen-app/src/state-panel.tsx",
    "apps/desen-app/src/authoring-event-actions.ts",
    "apps/desen-app/src/event-action-panel.tsx",
    "apps/desen-app/src/authoring-fixtures.ts",
    "apps/desen-app/src/authoring-scenarios.ts",
    "apps/desen-app/src/preview-controls.tsx",
    "apps/desen-app/src/preview-fidelity.ts",
  ]);
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoRealAdapterCanvasNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoSelectionOrInspectorNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor
      .historicalNoSourceMutationNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.persistenceAndControlPlanePublishStillDisallowed,
    undefined,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.sourcePersistenceSuccessorAuthenticated,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.currentDesignRunImplemented, true);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.publishActivationSuccessorAuthenticated,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.authoringPreviewExternalEffectsRemainDenied,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.schemaDerivedPrimitiveAndEnumInspectorAllowed,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.publicEditorCoreMutationAllowed, true);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.publisherBackedSessionPreviewAllowed,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.nestedObjectInspectorAllowed, true);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.honestStructuredJsonFallbackAllowed,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.dynamicValuesRemainLocked, true);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.completeNamedSlotProjectionAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.catalogAdmissionAndCardinalityPreflightAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.publicStableIdInsertMoveAndReorderAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.publicValidatedNodeDeletionAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.deletionPreflightRunsPublicMutationAndValidation,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.rootAndSourceMinimumDeletionDisabled,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.behaviorOwnedDeletePreservesEmptySlot,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.exactOwnDataDeletionSelectionCapture,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.continuousCompleteSourceRevalidation,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.failedDeletionPreservesCurrentDocument,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.deletionSourceAndPreviewCommitAtomically,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.deletionFocusManaged, true);
  assert.equal(built.currentCompatibility.additiveSuccessor.browserDataTransferReadsZero, true);
  assert.equal(built.currentCompatibility.additiveSuccessor.expandedDropReadyBoundaries, true);
  assert.equal(built.currentCompatibility.additiveSuccessor.stableNestedDragHover, true);
  assert.equal(built.currentCompatibility.additiveSuccessor.explicitComponentDropTargetGuide, true);
  assert.equal(built.currentCompatibility.additiveSuccessor.keyboardPlacementControl, true);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.insertionAdmissionCachedPerModelAndExactTarget,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.placementAdmissionCachedPerModelAndExactTarget,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.cachedPlacementBaseMaterializesBoundaryFinalIndex,
    true,
  );
  assert.equal(built.currentCompatibility.additiveSuccessor.componentPaletteRenderLimit, 24);
  assert.equal(built.currentCompatibility.additiveSuccessor.activeTabOnlyAuthoringWork, undefined);
  assert.equal(
    built.currentCompatibility.additiveSuccessor.splitAuthoringPanesAlwaysRendered,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.exactSlotSelectionAndEditCaptureAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.additiveSuccessor.atomicPublisherBackedSlotEditsAllowed,
    true,
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotTestCommand,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotRootCommands[
      "test:desen-app-named-slot-authoring"
    ],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node --test tests/desen-app-named-slot-authoring.test.mjs",
  );
  assert.equal(built.currentCompatibility.boundary.imports.exactReferenceAdapterRegistry, true);
  assert.equal(built.currentCompatibility.boundary.imports.applicationReactDomImports, 0);
  assert.equal(built.currentCompatibility.boundary.imports.publicDiagnosticIndexTypeOnlyImports, 1);
  assert.equal(built.currentCompatibility.boundary.imports.handwrittenManagedTreeElements, 0);
  assert.equal(built.currentCompatibility.boundary.imports.privateDomAccesses, 0);
  assert.equal(built.currentCompatibility.boundary.imports.unreviewedMutationOrPublicationCalls, 0);
  assert.equal(
    built.currentCompatibility.boundary.imports.publicEditorCoreAndPublisherSuccessorEdges,
    true,
  );
  assert.equal(built.currentCompatibility.retainedClaim.catalogDrivenPanelImplemented, undefined);
  assert.equal(built.currentCompatibility.retainedClaim.realAdapterCanvasImplemented, undefined);
});

test("[determinism] builds byte-identical detached evidence twice", async () => {
  const second = await buildDesenAppShellNavigationEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test("[mutation] rejects prerequisite, route, package, and scope-boundary drift", async () => {
  const prerequisite = await readFile(path.join(ROOT, PREREQUISITE));
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({ prerequisiteBytes: changedByte(prerequisite) }),
    expectedError("PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("BOUNDARY_DRIFT"),
  );

  const navigation = await readFile(path.join(ROOT, NAVIGATION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [NAVIGATION, Buffer.from(navigation.replaceAll('kind: "not-found"', 'kind: "fallback"'))],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          NAVIGATION,
          Buffer.from(
            navigation.replace(
              "return `${window.location.pathname}${window.location.search}${window.location.hash}`;",
              "return window.location.pathname;",
            ),
          ),
        ],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          NAVIGATION,
          Buffer.from(
            navigation.replace(
              'window.location.pathname !== "/" ||\n    window.location.search !== "" ||\n    window.location.hash !== ""',
              'window.location.pathname !== "/"',
            ),
          ),
        ],
      ]),
    }),
    expectedError("SHELL_SEMANTIC_DRIFT"),
  );

  const packageBytes = await readFile(path.join(ROOT, PACKAGE), "utf8");
  const packageWithExtraDependency = JSON.parse(packageBytes);
  packageWithExtraDependency.dependencies["react-router-dom"] = "7.9.1";
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [PACKAGE, Buffer.from(`${JSON.stringify(packageWithExtraDependency, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );
  const rootPackageBytes = await readFile(path.join(ROOT, ROOT_PACKAGE), "utf8");
  const rootPackageWithParserDrift = JSON.parse(rootPackageBytes);
  rootPackageWithParserDrift.devDependencies.typescript = "6.0.4";
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ROOT_PACKAGE, Buffer.from(`${JSON.stringify(rootPackageWithParserDrift, null, 2)}\n`)],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [PACKAGE, Buffer.from(packageBytes.replace("@desen/app-web", "@desen/app-shell"))],
      ]),
    }),
    expectedError("PACKAGE_DRIFT"),
  );

  const application = await readFile(path.join(ROOT, APPLICATION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`import { flushSync } from "react-dom";\n${application}`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport "./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nexport*from"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nexport*from/*x*/"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const indexHtml = await readFile(path.join(ROOT, INDEX), "utf8");
  for (const executableHtml of [
    '<script src="https://example.test/extra.js"></script>',
    "<script>globalThis.extraExecution = true;</script>",
    '<button onclick="globalThis.extraExecution = true">Unsafe</button>',
  ]) {
    await assert.rejects(
      buildDesenAppShellNavigationEvidence({
        fileOverrides: new Map([
          [INDEX, Buffer.from(indexHtml.replace("</body>", `${executableHtml}\n  </body>`))],
        ]),
      }),
      expectedError("IMPORT_BOUNDARY_DRIFT"),
    );
  }
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nimport/*x*/"./untracked-module.js";\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nvoid import("./project-data.js");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\nvoid import/*x*/("./project-data.js");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          APPLICATION,
          Buffer.from(`${application}\ntype Hidden = import("./untracked-module.js").Hidden;\n`),
        ],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [APPLICATION, Buffer.from(`${application}\ncreateDesenEditor();\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );

  const adapterCanvas = await readFile(path.join(ROOT, ADAPTER_CANVAS), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
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

  const authoringSelection = await readFile(path.join(ROOT, AUTHORING_SELECTION), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          AUTHORING_SELECTION,
          Buffer.from(`${authoringSelection}\ndocument.querySelector("input");\n`),
        ],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [AUTHORING_SELECTION, Buffer.from(authoringSelection.replace("import type {", "import {"))],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nvoid import("@desen/runtime-react");\n`)],
      ]),
    }),
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\nconst handwritten = <Stack />;\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ndocument.querySelector("main");\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [ADAPTER_CANVAS, Buffer.from(`${adapterCanvas}\ninsertDesenEditor();\n`)],
      ]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
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
    expectedError("IMPORT_BOUNDARY_DRIFT"),
  );

  const logo = await readFile(path.join(ROOT, LOGO), "utf8");
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([[LOGO, Buffer.from(logo.replace("</svg>", "<script/>\n</svg>"))]]),
    }),
    expectedError("SCOPE_BOUNDARY_DRIFT"),
  );
});

test("[verification] rejects artifact and visible proof-pin drift", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppShellNavigationEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisiteGate, "G08");
  assert.equal(verified.prerequisiteStatus, "DONE");

  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically writes exact evidence and preserves a destination on tampering", async () => {
  const directory = await temporaryDirectory("desen-m09-t01-writer-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppShellNavigationEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppShellNavigationEvidence({
      artifactPath: destination,
      beforeAtomicRename: async ({ temporaryPath }) => {
        await writeFile(temporaryPath, "tampered");
      },
    }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);
});

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m09-t01-links-");
  const prerequisiteTarget = path.join(directory, "prerequisite-target.json");
  const prerequisiteLink = path.join(directory, "prerequisite.json");
  await writeFile(prerequisiteTarget, await readFile(path.join(ROOT, PREREQUISITE)));
  await symlink(prerequisiteTarget, prerequisiteLink);
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({ prerequisitePath: prerequisiteLink }),
    expectedError("AUTHORITY_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppShellNavigationEvidence({
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
    verifyDesenAppShellNavigationEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath: proofLink,
    }),
    expectedError("AUTHORITY_UNSAFE"),
  );
});

test("[successor] authenticates and mutation-tests the exact M09-T12 persistence closure", async () => {
  const successor = built.currentCompatibility.sourcePersistenceSuccessor;
  assert.deepEqual(successor.artifact, {
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    path: SOURCE_PERSISTENCE_ARTIFACT,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
  });
  assert.equal(successor.focusedTestCases, 142);
  assert.equal(successor.fullAppTestFiles, 22);
  assert.equal(successor.fullAppTestCases, 324);
  assert.equal(successor.exactProjectScopedSourceKey, "account-app-source");
  assert.equal(successor.publicEditorCorePersistencePort, true);
  assert.equal(successor.authoredSourceOnly, true);
  assert.equal(successor.sourceKeyIndependentOfDocumentId, true);
  assert.equal(successor.awaitedSettlementsCapturedAsExactOwnEnumerableData, true);
  assert.equal(successor.settlementAccessorInvocation, false);
  assert.equal(successor.validOptionalDiagnosticDataCopiedAndFrozen, true);
  assert.equal(successor.casGenerationRelationshipsValidated, true);
  assert.equal(successor.openedDocumentReauthorized, true);
  assert.equal(successor.failedOrRejectedOpenPreservesDraft, true);
  assert.equal(successor.malformedOpenRetryableAndDraftPreserved, true);
  assert.equal(successor.generationExhaustionRequiresReopen, true);
  assert.equal(successor.automaticRetryOrMerge, false);
  assert.equal(successor.unexpectedDispatchedSaveIndeterminate, true);
  assert.equal(successor.malformedSaveIndeterminateAndReopenRequired, true);
  assert.equal(successor.staleOpenCannotReplaceEditedSession, true);
  assert.equal(successor.staleLifetimeSettlementIgnored, true);
  assert.equal(successor.postReflectionAndAdmissionAuthorityRechecked, true);
  assert.equal(successor.reentrantSettlementCannotPublishRevokedState, true);
  assert.equal(successor.dirtyOpenRequiresExplicitConfirmation, true);
  assert.equal(successor.designModeOnlyControls, true);
  assert.equal(successor.visibleGenerationDirtyAndReopenState, true);
  assert.equal(successor.completeAuthoredSourceCanonicalDirtyComparison, true);
  assert.equal(successor.identityOrVersionDirtyAuthority, false);
  assert.equal(successor.sameCanonicalReplacementRemainsClean, true);
  assert.equal(successor.canonicalRevertReturnsClean, true);
  assert.equal(successor.successfulOpenOrSaveEstablishesCanonicalBaseline, true);
  assert.equal(successor.newerEditRemainsDirtyAfterOlderSave, true);
  assert.equal(successor.noPortCanonicalBaselineAndCurrentTracked, true);
  assert.equal(successor.noPortDirtyProjectionRerenderSafe, true);
  assert.equal(successor.cleanNoPortLabelAccurate, true);
  assert.equal(successor.cleanNoPortStatusText, "Local draft unchanged");
  assert.equal(successor.navigationAndPageExitGuarded, true);
  assert.equal(successor.scenarioPreviewPersisted, false);
  assert.equal(successor.runtimeInputOrSecretPersisted, false);
  const artifactBytes = await readFile(path.join(ROOT, SOURCE_PERSISTENCE_ARTIFACT));
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
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
    buildDesenAppShellNavigationEvidence({
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
      buildDesenAppShellNavigationEvidence({
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
      buildDesenAppShellNavigationEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
  for (const { path: relativePath } of M10_T01A_SECURE_SCROLL_CURRENT_PROJECTION.trackedReceipts) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppShellNavigationEvidence({
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
      buildDesenAppShellNavigationEvidence({
        fileOverrides: new Map([[PACKAGE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)]]),
      }),
      expectedError("PACKAGE_DRIFT"),
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

  const artifactPath = successor.artifact.path;
  const receiptPath = "apps/desen-app/src/authoring-connections.ts";
  const [artifactBytes, receiptBytes] = await Promise.all([
    readFile(path.join(ROOT, artifactPath)),
    readFile(path.join(ROOT, receiptPath)),
  ]);
  for (const [relativePath, bytes] of [
    [artifactPath, changedByte(artifactBytes)],
    [artifactPath, Buffer.alloc(0)],
    [receiptPath, changedByte(receiptBytes)],
    [receiptPath, Buffer.alloc(0)],
  ]) {
    await assert.rejects(
      buildDesenAppShellNavigationEvidence({
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
  const [artifactBytes, receiptBytes, applicationTestBytes] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_APPLICATION_TEST)),
  ]);
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [PUBLISH_ACTIVATION_APPLICATION_TEST, changedByte(applicationTestBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppShellNavigationEvidence({
      fileOverrides: new Map([
        [
          PUBLISH_ACTIVATION_APPLICATION_TEST,
          Buffer.from(applicationTestBytes.toString("utf8").replace("}, 10_000);", "}, 20_000);")),
        ],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
