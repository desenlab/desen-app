import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_REAL_ADAPTER_CANVAS_HOST_SOURCE_AUDIT_PIN,
  DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES,
  DESEN_APP_REAL_ADAPTER_CANVAS_SHELL_PIN,
  DesenAppRealAdapterCanvasProofError,
  buildDesenAppRealAdapterCanvasEvidence,
  verifyDesenAppRealAdapterCanvasEvidence,
  verifyDesenAppRealAdapterCanvasGraphPolicy,
  verifyDesenAppRealAdapterCanvasSourcePolicy,
  writeDesenAppRealAdapterCanvasEvidence,
} from "../scripts/lib/desen-app-real-adapter-canvas-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const SHELL_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const HOST_SOURCE_AUDIT_ARTIFACT =
  "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json";
const FIXTURES_SCENARIOS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const ADAPTER_CANVAS = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION = "apps/desen-app/src/application.tsx";
const AUTHORING_SELECTION = "apps/desen-app/src/authoring-selection.ts";
const temporaryDirectories = [];
let adapterCanvasSource;
let applicationSource;
let authoringSelectionSource;
let built;
let hostSourceAuditArtifact;
let hostSourceAuditArtifactBytes;
let shellArtifactBytes;
let fixturesScenariosArtifactBytes;

function expectedError(code) {
  return (error) => error instanceof DesenAppRealAdapterCanvasProofError && error.code === code;
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

function cloneGraph() {
  return JSON.parse(JSON.stringify(built.currentCompatibility.authority.runtimeResolution.modules));
}

function graphModule(graph, id) {
  const module = graph.find((candidate) => candidate.id === id);
  assert.notEqual(module, undefined, `Graph module not found: ${id}`);
  return module;
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    `# Desen App real-adapter canvas\n\nTask: M09-T03\n\nStatus: DONE\n\nArtifact: \`${ARTIFACT}\`\n\nP-06: PROVEN\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`,
  );
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

before(async () => {
  [
    adapterCanvasSource,
    applicationSource,
    authoringSelectionSource,
    built,
    hostSourceAuditArtifactBytes,
    shellArtifactBytes,
    fixturesScenariosArtifactBytes,
  ] = await Promise.all([
    readFile(path.join(ROOT, ADAPTER_CANVAS), "utf8"),
    readFile(path.join(ROOT, APPLICATION), "utf8"),
    readFile(path.join(ROOT, AUTHORING_SELECTION), "utf8"),
    buildDesenAppRealAdapterCanvasEvidence(),
    readFile(path.join(ROOT, HOST_SOURCE_AUDIT_ARTIFACT)),
    readFile(path.join(ROOT, SHELL_ARTIFACT)),
    readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT)),
  ]);
  hostSourceAuditArtifact = JSON.parse(hostSourceAuditArtifactBytes);
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-real-adapter-canvas");
  assert.equal(built.artifact.profile, "desen.app.real-adapter-canvas-proof.v1");
  assert.equal(built.artifact.task, "M09-T03");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifactBytes.byteLength, 73_111);
  assert.equal(
    built.artifactSha256,
    "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
  );
  assert.deepEqual(built.artifact.prerequisites, [
    DESEN_APP_REAL_ADAPTER_CANVAS_SHELL_PIN,
    DESEN_APP_REAL_ADAPTER_CANVAS_HOST_SOURCE_AUDIT_PIN,
  ]);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.shellCompatibilityRetained, true);
  assert.equal(built.artifact.claim.p06Status, "PROVEN");
  assert.equal(built.artifact.claim.s001Status, "PLANNED");
  assert.equal(built.artifact.claim.pf059Status, "OPEN");
  assert.equal(built.artifact.claim.p07Status, "PARTIAL");
  assert.equal(built.currentCompatibility.result, "PASS");
  assert.equal(built.currentCompatibility.successor.task, "M09-T07");
  assert.deepEqual(built.currentCompatibility.successor.artifact, {
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
    built.currentCompatibility.fixturesScenariosSuccessor.pendingRuntimeLifecycleExercised,
    true,
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[1], () => {
  assert.deepEqual(built.artifact.authority.source.controlledIdentity, {
    SUPPORTED_PROJECT_ID: "account-app",
    SUPPORTED_SURFACE_ID: "sign-in",
    EXPECTED_DOCUMENT_ID: "com.example.account-app",
    EXPECTED_REVISION: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
  });
  assert.deepEqual(built.artifact.authority.data.bundle, {
    path: "examples/sign-in/official-derived.bundle.desen.json",
    bytes: 4_899,
    sha256: "334450fa1864bf280a30342090a46ba1d2f2dc96552b9430afdde5fcada902b0",
    id: "com.example.account-app",
    revision: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    entry: "sign-in",
    surfaceId: "sign-in",
    catalogDigest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  });
  assert.equal(built.artifact.authority.source.exactPublicRegistryInput, true);
  assert.equal(built.artifact.authority.source.exactOfficialBundleMount, true);
  assert.equal(built.artifact.authority.source.manualManagedTreeElements, 0);
  assert.equal(built.artifact.authority.source.dynamicExecutableImports, 0);
  assert.equal(built.artifact.authority.source.privateDomInspectionCalls, 0);
  assert.deepEqual(
    built.artifact.authority.semanticSymbols.symbols.map(({ symbol }) => symbol),
    [
      "createRuntimeReactAdapterRegistry",
      "disposeRuntimeHeadlessSession",
      "mountRuntimeHeadlessSession",
      "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
      "renderRuntimeReactSurface",
      "RuntimeReactSurfaceBoundary",
      "useRuntimeReactSurface",
    ],
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[2], async () => {
  const runtime = built.artifact.authority.runtimeResolution;
  assert.equal(runtime.tool, "vite@8.1.5");
  assert.equal(runtime.authority, "programmatic build({ write: false }) Plugin.moduleParsed");
  assert.equal(runtime.write, false);
  assert.equal(runtime.independentBuilds, 2);
  assert.equal(runtime.deterministic, true);
  assert.equal(runtime.moduleCount, 102);
  assert.equal(runtime.staticEdges, 290);
  assert.equal(runtime.dynamicEdges, 0);
  assert.equal(runtime.unresolvedEdges, 0);
  assert.equal(runtime.sharedRuntimeModuleCount, 19);
  assert.equal(runtime.realComponentModuleCount, 5);
  assert.equal(
    runtime.sharedHostGraphSha256,
    hostSourceAuditArtifact.runtimeResolution.graphSha256,
  );
  assert.equal(runtime.sharedRuntimeIdentity.length, 19);
  assert.equal(
    runtime.sharedRuntimeIdentity.some(
      ({ id }) => id === "packages/reference-catalog-web/dist/components/text-field.js",
    ),
    true,
  );

  const currentRuntime = built.currentCompatibility.authority.runtimeResolution;
  assert.equal(currentRuntime.moduleCount, 143);
  assert.equal(currentRuntime.staticEdges, 424);
  assert.equal(currentRuntime.dynamicEdges, 0);
  assert.equal(currentRuntime.sharedRuntimeModuleCount, 19);
  assert.equal(currentRuntime.realComponentModuleCount, 5);

  const second = await buildDesenAppRealAdapterCanvasEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.authority.runtimeResolution.modules), true);
  assert.deepEqual(second.currentCompatibility, built.currentCompatibility);
  assert.equal(Object.isFrozen(second.currentCompatibility), true);
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[3], () => {
  assert.equal(built.artifact.application.ui.mode, "READ_ONLY_DESIGN_PREVIEW");
  assert.equal(built.artifact.application.ui.disabledFieldsetOutsideManagedTree, true);
  assert.equal(built.artifact.application.route.unsupportedTuplePolicy, "NO_MOUNT_NO_SUBSTITUTION");
  assert.equal(built.artifact.tests.disabledControls, true);
  assert.equal(built.artifact.tests.unsupportedTupleNoMount, true);
  assert.equal(built.artifact.tests.staleTreeRemovedBeforeReplacement, true);
  assert.equal(built.artifact.tests.exactSessionDisposal, true);
  assert.equal(built.artifact.tests.strictModeReplayBalanced, true);
  assert.equal(built.artifact.tests.finalRootUnmountCovered, true);
  assert.equal(built.artifact.application.lifecycle.mismatchDisposesBeforeFailure, true);
  assert.equal(built.artifact.application.lifecycle.preflightFailureDisposesBeforeFailure, true);
  assert.equal(built.artifact.application.lifecycle.effectCleanupDisposes, true);
  assert.equal(built.currentCompatibility.application.ui.selectionOverlay, true);
  assert.equal(
    built.currentCompatibility.application.ui.selectionOverlayOutsideManagedCapabilitySubtree,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.historicalNoSelectionOverlayNonclaimAppliedToCurrentApp,
    false,
  );
  assert.equal(built.currentCompatibility.successor.publicDiagnosticIndexOnly, true);
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
  assert.equal(
    built.currentCompatibility.successor.publicStableIdInsertMoveAndReorderImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.publicValidatedNestedSubtreeDeletionImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.exactDeletionSelectionCaptureImplemented, true);
  assert.equal(
    built.currentCompatibility.successor.rootAndMinimumDeletionPreflightImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.behaviorOwnedDeletePreservesEmptySlotImplemented,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.failedDeletionPreservesDocumentImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.exactTargetAdmissionCachesImplemented, true);
  assert.equal(
    built.currentCompatibility.successor.placementCacheMaterializesBoundaryFinalIndex,
    true,
  );
  assert.equal(
    built.currentCompatibility.successor.cyclePreflightedBeforePublicEditorCoreMove,
    true,
  );
  assert.equal(built.currentCompatibility.successor.componentPaletteRenderLimit, 24);
  assert.equal(built.currentCompatibility.successor.activeTabOnlyAuthoringWork, true);
  assert.equal(built.currentCompatibility.successor.expandedDropReadyBoundariesImplemented, true);
  assert.equal(built.currentCompatibility.successor.stableNestedDragHoverImplemented, true);
  assert.equal(built.currentCompatibility.successor.browserDataTransferReads, 0);
  assert.equal(
    built.currentCompatibility.successor.explicitComponentDropTargetGuideImplemented,
    true,
  );
  assert.equal(built.currentCompatibility.successor.atomicDeletionPreviewAndFocusImplemented, true);
  assert.equal(built.currentCompatibility.successor.exactArtifactSourceAndTestReceipts, true);
  assert.equal(built.currentCompatibility.successor.artifactSourceAndTestReceiptCount, 8);
  assert.equal(
    built.currentCompatibility.application.package.namedSlotFocusedTest,
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",
  );
  assert.equal(
    built.currentCompatibility.application.package.namedSlotRootCommands[
      "verify:desen-app-named-slot-authoring"
    ],
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && node scripts/verify-desen-app-named-slot-authoring.mjs",
  );
  assert.equal(built.currentCompatibility.successor.dynamicEditingImplemented, false);
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[4], () => {
  const directImport = replaceOnce(
    adapterCanvasSource,
    'import { useEffect, useMemo, useState } from "react";',
    'import { useEffect, useMemo, useState } from "react";\nimport { Button } from "@desen/reference-catalog-web/components/button";',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(directImport, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const handwrittenTree = replaceOnce(
    adapterCanvasSource,
    "<RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />",
    '<button type="button">Handwritten managed action</button>',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(handwrittenTree, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[5], () => {
  const aliasedRegistry = replaceOnce(
    adapterCanvasSource,
    "{ REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT }",
    "{ REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT as localRegistryInput }",
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(aliasedRegistry, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const helperTree = `${adapterCanvasSource}\nfunction HiddenManagedTree() {\n  return <input aria-label="Hidden managed input" />;\n}\n`;
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(helperTree, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[6], () => {
  const localRegistry = replaceOnce(
    adapterCanvasSource,
    "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n);",
    '{ "com.example.ui/Button": () => null },\n);',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(localRegistry, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const discardedRegistry = replaceOnce(
    adapterCanvasSource,
    "const ADAPTER_CANVAS_REGISTRY = createRuntimeReactAdapterRegistry(\n  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n);",
    'const ADAPTER_CANVAS_REGISTRY = (createRuntimeReactAdapterRegistry(\n  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,\n), { status: "failed" } as never);',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(discardedRegistry, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  for (const applicationMutation of [
    replaceOnce(
      applicationSource,
      'import { DesenAdapterCanvas } from "./adapter-canvas.js";',
      'import { DesenAdapterCanvas as ExactCanvas } from "./adapter-canvas.js";\nconst DesenAdapterCanvas = ExactCanvas;',
    ),
    replaceOnce(
      applicationSource,
      "surfaceId={selectedSurface.id}\n          />",
      'surfaceId={selectedSurface.id}\n            {...({ surfaceId: "sign-in" })}\n          />',
    ),
    replaceOnce(
      replaceOnce(
        applicationSource,
        'import { DesenAdapterCanvas } from "./adapter-canvas.js";',
        'import { DesenAdapterCanvas } from "./adapter-canvas.js";\nvoid DesenAdapterCanvas;',
      ),
      "}>) {\n  if (selectedSurface === undefined)",
      "}>) {\n  const DesenAdapterCanvas = (_props: unknown) => <div>fake</div>;\n  if (selectedSurface === undefined)",
    ),
    replaceOnce(
      applicationSource,
      "  const model = preparedModel.model;\n\n  return (",
      '  const model = preparedModel.model;\n  if (import.meta.env.PROD) (selectedSurface as { id: string }).id = "sign-in";\n\n  return (',
    ),
  ]) {
    assert.throws(
      () => verifyDesenAppRealAdapterCanvasSourcePolicy(adapterCanvasSource, applicationMutation),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  const dynamicImport = replaceOnce(
    adapterCanvasSource,
    "function isSupportedRoute(routeIdentity: RouteIdentity): boolean {",
    'function isSupportedRoute(routeIdentity: RouteIdentity): boolean {\n  void import("@desen/runtime-react");',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(dynamicImport, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  for (const [from, to] of [
    ["@desen/reference-catalog-web/tokens", "@desen/reference-catalog-web/private-tokens"],
    ["@desen/runtime-core", "@desen/runtime-core/dist/headless-session.js"],
    ["@desen/runtime-react", "@desen/runtime-react/dist/registry.js"],
  ]) {
    assert.throws(
      () =>
        verifyDesenAppRealAdapterCanvasSourcePolicy(
          replaceOnce(adapterCanvasSource, `from "${from}"`, `from "${to}"`),
          applicationSource,
        ),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[7], () => {
  const privateDom = replaceOnce(
    adapterCanvasSource,
    "function CanvasLoading() {",
    'function CanvasLoading() {\n  document.querySelector("[data-managed]");',
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(privateDom, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const privateReactTree = replaceOnce(
    adapterCanvasSource,
    "function CanvasLoading() {",
    "function CanvasLoading() {\n  const candidate = {} as { __reactFiber?: unknown };\n  void candidate.__reactFiber;",
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(privateReactTree, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const valueDiagnosticImport = replaceOnce(
    authoringSelectionSource,
    "import type { RuntimeReactDiagnosticIndex }",
    "import { RuntimeReactDiagnosticIndex }",
  );
  assert.throws(
    () =>
      verifyDesenAppRealAdapterCanvasSourcePolicy(
        adapterCanvasSource,
        applicationSource,
        valueDiagnosticImport,
      ),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const selectionDomInspection = `${authoringSelectionSource}\ndocument.querySelector("[data-node]");\n`;
  assert.throws(
    () =>
      verifyDesenAppRealAdapterCanvasSourcePolicy(
        adapterCanvasSource,
        applicationSource,
        selectionDomInspection,
      ),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const overlayInsideManagedSubtree = replaceOnce(
    adapterCanvasSource,
    '        </div>\n      </fieldset>\n      {mode === "design" ? <SelectionOverlay projection={projection} /> : null}',
    '          {mode === "design" ? <SelectionOverlay projection={projection} /> : null}\n        </div>\n      </fieldset>',
  );
  assert.throws(
    () =>
      verifyDesenAppRealAdapterCanvasSourcePolicy(
        overlayInsideManagedSubtree,
        applicationSource,
        authoringSelectionSource,
      ),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const unsupportedSubstitution = replaceOnce(
    adapterCanvasSource,
    "if (!supported) return <CanvasUnavailable />;",
    "if (!supported) return <ManagedAdapterSurface input={state.input} />;",
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(unsupportedSubstitution, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  const widenedRouteGuard = replaceOnce(
    adapterCanvasSource,
    "routeIdentity.surfaceId === SUPPORTED_SURFACE_ID\n  );",
    "routeIdentity.surfaceId === SUPPORTED_SURFACE_ID || true\n  );",
  );
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasSourcePolicy(widenedRouteGuard, applicationSource),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  for (const asiMutation of [
    replaceOnce(
      adapterCanvasSource,
      "return () => {\n      disposeRuntimeHeadlessSession(session);",
      "return\n    () => {\n      disposeRuntimeHeadlessSession(session);",
    ),
    replaceOnce(
      adapterCanvasSource,
      "  return (\n    <>\n      <fieldset",
      "  return\n  (\n    <>\n      <fieldset",
    ),
    replaceOnce(
      adapterCanvasSource,
      "if (!supported) return <CanvasUnavailable />;",
      "if (!supported) return\n  <CanvasUnavailable />;",
    ),
  ]) {
    assert.throws(
      () => verifyDesenAppRealAdapterCanvasSourcePolicy(asiMutation, applicationSource),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  for (const [from, to] of [
    [
      "const supported = isSupportedRoute(routeIdentity);",
      "let supported = isSupportedRoute(routeIdentity); supported = true;",
    ],
    [
      "      bundle,\n      catalogs: [referenceCatalog],",
      "      bundle: {} as never,\n      catalogs: [referenceCatalog],",
    ],
    [
      "catalogs: [referenceCatalog],",
      "catalogs: [referenceCatalog], ...({ catalogs: [] as never }),",
    ],
    [
      "catalogs: [referenceCatalog],\n      hostPorts,",
      "catalogs: [referenceCatalog],\n      hostPorts: {} as RuntimeHostPorts,",
    ],
    ["result={result}", "result={undefined as never}"],
  ]) {
    assert.throws(
      () =>
        verifyDesenAppRealAdapterCanvasSourcePolicy(
          replaceOnce(adapterCanvasSource, from, to),
          applicationSource,
        ),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  for (const [from, to] of [
    [
      'navigation: { navigate: () => ({ status: "denied" }) }',
      'navigation: { navigate: () => ({ status: "succeeded" }) }',
    ],
    [
      'operations: { invoke: () => ({ status: "denied" }) }',
      'operations: { invoke: () => ({ status: "succeeded", output: {} }) }',
    ],
    [
      'resources: { load: () => ({ status: "denied" }) }',
      'resources: { load: () => ({ status: "succeeded", value: {} }) }',
    ],
    [
      'tokens: { resolve: () => ({ status: "missing" }) }',
      'tokens: { resolve: () => ({ status: "resolved", value: "widened" }) }',
    ],
  ]) {
    assert.throws(
      () =>
        verifyDesenAppRealAdapterCanvasSourcePolicy(
          replaceOnce(adapterCanvasSource, from, to),
          applicationSource,
        ),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }

  for (const [from, to] of [
    ['"account-app"', '"checkout-pilot"'],
    ['"sign-in"', '"recovery"'],
    ['"com.example.account-app"', '"com.example.other-app"'],
    [
      '"../../../examples/sign-in/official-derived.bundle.desen.json"',
      '"../../../examples/sign-in/handwritten.bundle.desen.json"',
    ],
  ]) {
    assert.throws(
      () =>
        verifyDesenAppRealAdapterCanvasSourcePolicy(
          replaceOnce(adapterCanvasSource, from, to),
          applicationSource,
        ),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[8], () => {
  const componentSubstitution = cloneGraph();
  const adapters = graphModule(
    componentSubstitution,
    "packages/reference-catalog-web/dist/react-adapters/index.js",
  );
  adapters.imports[
    adapters.imports.indexOf("packages/reference-catalog-web/dist/components/alert.js")
  ] = "packages/reference-catalog-web/dist/components/button.js";
  assert.throws(
    () =>
      verifyDesenAppRealAdapterCanvasGraphPolicy(componentSubstitution, hostSourceAuditArtifact),
    expectedError("VITE_GRAPH_DRIFT"),
  );

  for (const [from, to] of [
    [
      "packages/reference-catalog-web/dist/react-adapters/index.js",
      "apps/desen-app/src/authoring-data.ts",
    ],
    ["packages/runtime-react/dist/index.js", "packages/runtime-core/dist/index.js"],
  ]) {
    const substitution = cloneGraph();
    const canvas = graphModule(substitution, ADAPTER_CANVAS);
    canvas.imports[canvas.imports.indexOf(from)] = to;
    canvas.imports.sort();
    assert.throws(
      () => verifyDesenAppRealAdapterCanvasGraphPolicy(substitution, hostSourceAuditArtifact),
      expectedError("VITE_GRAPH_DRIFT"),
    );
  }

  const codeSubstitution = cloneGraph();
  graphModule(codeSubstitution, "packages/runtime-react/dist/render-plan.js").codeSha256 =
    `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => verifyDesenAppRealAdapterCanvasGraphPolicy(codeSubstitution, hostSourceAuditArtifact),
    expectedError("HOST_GRAPH_IDENTITY_DRIFT"),
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[9], async () => {
  await assert.rejects(
    buildDesenAppRealAdapterCanvasEvidence({ shellArtifactBytes: changedByte(shellArtifactBytes) }),
    expectedError("PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppRealAdapterCanvasEvidence({
      hostSourceAuditArtifactBytes: changedByte(hostSourceAuditArtifactBytes),
    }),
    expectedError("PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildDesenAppRealAdapterCanvasEvidence({
      fixturesScenariosArtifactBytes: changedByte(fixturesScenariosArtifactBytes),
    }),
    expectedError("PREREQUISITE_DRIFT"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppRealAdapterCanvasEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.graphModules, 102);
  assert.equal(verified.currentGraphModules, 143);
  assert.equal(verified.sharedRuntimeModules, 19);
  assert.equal(verified.realComponentModules, 5);

  await assert.rejects(
    verifyDesenAppRealAdapterCanvasEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppRealAdapterCanvasEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test(DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES[10], async () => {
  const directory = await temporaryDirectory("desen-m09-t03-boundaries-");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppRealAdapterCanvasEvidence({
      artifactPath: artifactLink,
      proofDocument: exactProofDocument(built.artifactSha256),
    }),
    expectedError("AUTHORITY_NOT_REGULAR"),
  );

  const destination = path.join(directory, "written-artifact.json");
  const written = await writeDesenAppRealAdapterCanvasEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppRealAdapterCanvasEvidence({
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
    writeDesenAppRealAdapterCanvasEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.deepEqual(await readFile(destination), preserved);
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
        bytes: 27_088,
        sha256: "75a7007c2fd60bd5da28c6f2175e9db7ebab763f67e8a7ca9eaaa03b468f7544",
      },
      focusedTestCases: 140,
      fullAppTestFiles: 22,
      fullAppTestCases: 322,
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
    buildDesenAppRealAdapterCanvasEvidence({
      fileOverrides: new Map([[SOURCE_PERSISTENCE_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
});
