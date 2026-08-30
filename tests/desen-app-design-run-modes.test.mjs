import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS,
  DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES,
  DesenAppDesignRunModesProofError,
  buildDesenAppDesignRunModesEvidence,
  verifyDesenAppDesignRunModesEvidence,
  verifyDesenAppDesignRunModesSourcePolicy,
  writeDesenAppDesignRunModesEvidence,
} from "../scripts/lib/desen-app-design-run-modes-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PARENT_PATHS = Object.freeze(
  DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS.map(({ path: relativePath }) => relativePath),
);
const SOURCE_PATHS = Object.freeze({
  adapterSource: "apps/desen-app/src/adapter-canvas.tsx",
  applicationSource: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorSource: "apps/desen-app/src/inspector-panel.tsx",
});
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLICATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
const temporaryDirectories = [];
let parentArtifactBytes;
let sourcePolicyInput;
let adapterTestSource;
let appPackageSource;
let fixturesScenariosArtifactBytes;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppDesignRunModesProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function replaceOnce(source, search, replacement) {
  const index = source.indexOf(search);
  assert.notEqual(index, -1, "Missing mutation marker " + search);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function exactProofDocument(artifactSha256) {
  return Buffer.from(
    [
      "# Desen App Design and Run modes",
      "",
      "Task: M09-T10",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "P-09: PARTIAL",
      "PF-025: OPEN",
      "PF-028: OPEN",
      "PF-083: OPEN",
      "M09-T11: NOT_PROVEN",
      "M09-T12: NOT_PROVEN",
      "M09-T13: NOT_PROVEN",
      "M09-T14: NOT_PROVEN",
      "",
      "Final artifact: `sha256:" + artifactSha256 + "`",
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
  [adapterTestSource, appPackageSource, fixturesScenariosArtifactBytes] = await Promise.all([
    readFile(path.join(ROOT, ADAPTER_TEST_PATH), "utf8"),
    readFile(path.join(ROOT, APP_PACKAGE_PATH), "utf8"),
    readFile(path.join(ROOT, FIXTURES_SCENARIOS_ARTIFACT_PATH)),
  ]);
  built = await buildDesenAppDesignRunModesEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-design-run-modes");
  assert.equal(built.artifact.profile, "desen.app.design-run-modes-proof.v1");
  assert.equal(built.artifact.task, "M09-T10");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
  assert.equal(built.artifact.claim.p08Status, "NOT_PROVEN");
  assert.equal(built.artifact.claim.p09Status, "PARTIAL");
  assert.equal(built.artifactBytes.byteLength, 17_900);
  assert.equal(
    built.artifactSha256,
    "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
  );
  assert.equal(built.currentCompatibility.successor.task, "M09-T11");
  assert.equal(built.currentCompatibility.successor.focusedTestCases, 86);
  assert.equal(built.currentCompatibility.successor.pendingRuntimeLifecycleExercised, true);
  assert.equal(built.currentCompatibility.successor.pf028Status, "CLOSED");
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[1], () => {
  const application = built.artifact.authority.source.application;
  assert.equal(application.oneImmutableAuthoringSession, true);
  assert.equal(application.sameDocumentAndPreviewAcrossToggle, true);
  assert.equal(application.exactSourceRevisionUnchanged, true);
  assert.equal(application.exactBundleRevisionUnchanged, true);
  assert.equal(built.artifact.claim.oneImmutableSourceAndBundleSession, true);
  assert.equal(built.artifact.claim.sourceRevisionUnchangedOnToggle, true);
  assert.equal(built.artifact.claim.bundleRevisionUnchangedOnToggle, true);
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[2], () => {
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(adapter.oneRuntimeSessionAcrossModeToggle, true);
  assert.equal(adapter.modeExcludedFromMountEffectIdentity, true);
  assert.equal(adapter.sameManagedCapabilitySubtree, true);
  assert.equal(built.artifact.claim.zeroRuntimeRemountOrDisposeOnToggle, true);
  assert.equal(built.artifact.claim.sameManagedCapabilitySubtreeOnToggle, true);
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[3], () => {
  const adapter = built.artifact.authority.source.adapter;
  const application = built.artifact.authority.source.application;
  assert.equal(adapter.designDefault, true);
  assert.equal(adapter.designControlsDisabled, true);
  assert.equal(adapter.designSelectionOverlayOnly, true);
  assert.equal(application.runSelectionSuppressed, true);
  assert.equal(application.runPanelsMountedButNoninteractive, true);
  assert.equal(built.artifact.claim.designSelectionAndAuthoringOnly, true);
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[4], () => {
  const adapter = built.artifact.authority.source.adapter;
  assert.equal(adapter.runAdapterInteractionsEnabled, true);
  assert.equal(adapter.exactPublicRuntimeReactBoundary, true);
  assert.equal(built.artifact.claim.runAdapterEventToRuntimeStateSet, true);
  assert.equal(built.artifact.claim.runStateSetRerendersAdapter, true);
  assert.ok(
    built.artifact.tests.semanticCoverage.includes(
      "RUN_ADAPTER_EVENT_TO_RUNTIME_STATE_SET_RERENDER",
    ),
  );
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[5], () => {
  const adapter = built.artifact.authority.source.adapter;
  const application = built.artifact.authority.source.application;
  assert.equal(application.centralRunModeAuthoringGuards, true);
  assert.equal(adapter.hostPortsDeniedOrInert, true);
  assert.equal(adapter.externalEffectsDenied, true);
  assert.equal(built.artifact.claim.centralAuthoringGuardsInRun, true);
  assert.equal(built.artifact.claim.allExternalHostPortsDeniedOrInert, true);
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[6], () => {
  const receipts = built.artifact.tests.localCommandReceipts;
  assert.equal(receipts.adapter.tests, 9);
  assert.equal(receipts.application.tests, 35);
  assert.equal(receipts.focusedDesignRun.tests, 44);
  assert.equal(receipts.focusedDesignRun.testFiles, 2);
  assert.equal(receipts.fullApp.tests, 210);
  assert.equal(receipts.fullApp.testFiles, 15);
  assert.equal(receipts.rootProof.tests, 10);
  assert.equal(built.artifact.authority.source.application.accessiblePressedModeControl, true);
  assert.equal(built.artifact.claim.accessibleModeControl, true);
  assert.equal(built.artifact.claim.fixturesAndScenariosClaimed, false);
  assert.equal(built.artifact.claim.pf028Status, "OPEN");
  assert.equal(built.artifact.claim.persistenceClaimed, false);
  assert.equal(built.artifact.claim.diagnosticsClaimed, false);
  assert.equal(built.artifact.claim.publicationClaimed, false);
  assert.equal(built.artifact.claim.browserE2eClaimed, false);
  assert.equal(
    built.artifact.application.package.rootCommands["verify:desen-app-design-run-modes"],
    "node scripts/verify-desen-app-real-adapter-canvas.mjs && node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-desen-app-event-action-editor.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:design-run && node scripts/verify-desen-app-design-run-modes.mjs",
  );
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[7], async () => {
  const second = await buildDesenAppDesignRunModesEvidence();
  assert.deepEqual(second.artifactBytes, built.artifactBytes);
  assert.equal(second.artifactSha256, built.artifactSha256);
  assert.notEqual(second.artifact, built.artifact);
  assert.equal(Object.isFrozen(second.artifact), true);
  assert.equal(Object.isFrozen(second.artifact.boundary.trackedReceipts), true);
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[8], async () => {
  const mutations = [
    {
      key: "adapterSource",
      search: 'export type DesenAdapterCanvasMode = "design" | "run"',
      replacement: 'export type DesenAdapterCanvasMode = "run"',
    },
    {
      key: "adapterSource",
      search: "[bundle, hostPorts, previewRevision, routeIdentity, supported]",
      replacement: "[bundle, hostPorts, mode, previewRevision, routeIdentity, supported]",
    },
    {
      key: "adapterSource",
      search: 'disabled={mode === "design"}',
      replacement: "disabled={false}",
    },
    {
      key: "adapterSource",
      search: 'navigation: { navigate: () => ({ status: "denied" }) }',
      replacement: 'navigation: { navigate: () => ({ status: "accepted" }) }',
    },
    {
      key: "adapterSource",
      search: 'navigation: { navigate: () => ({ status: "denied" }) },',
      replacement:
        'navigation: { navigate: () => ({ status: "denied" }), open: () => ({ status: "denied" }) },',
    },
    {
      key: "adapterSource",
      search: "      hostPorts,\n    });",
      replacement: "      hostPorts: ADAPTER_CANVAS_HOST_PORTS,\n    });",
    },
    {
      key: "applicationSource",
      search: 'const modeRef = useRef<SurfaceEditorMode>("design")',
      replacement: 'const modeRef = useRef<SurfaceEditorMode>("run")',
    },
    {
      key: "applicationSource",
      search:
        'function isDesignMode(): boolean {\n    if (modeRef.current !== "design") return false;\n    if (publicationController === null) return true;\n    if (publicationControllerLifetime.current !== publicationController) return false;\n    const current = publicationController.read();\n    return !current.disposed && current.pending === null;\n  }',
      replacement:
        'function isDesignMode(): boolean {\n    return modeRef.current === "design";\n  }',
    },
    {
      key: "applicationSource",
      search: "modeRef.current = nextMode;",
      replacement: "setAuthoringSession(authoringSession);\n    modeRef.current = nextMode;",
    },
    {
      key: "applicationSource",
      search: "if (!isDesignMode()) return;",
      replacement: "if (false) return;",
    },
    {
      key: "applicationSource",
      search:
        "function toggleSelection(node: AuthoringLayerNode): void {\n    if (!isDesignMode()) return;",
      replacement:
        "function toggleSelection(node: AuthoringLayerNode): void {\n    setSelection(null);\n    if (!isDesignMode()) return;",
    },
    {
      key: "applicationSource",
      search: 'selection={mode === "design" ? selection : null}',
      replacement: "selection={selection}",
    },
    {
      key: "inspectorSource",
      search: "hidden={hidden}",
      replacement: "hidden={false}",
    },
    {
      key: "applicationCss",
      search: '.surfaceFrame[data-mode="run"]',
      replacement: ".removedRunSurface",
    },
  ];
  for (const mutation of mutations) {
    assert.throws(
      () =>
        verifyDesenAppDesignRunModesSourcePolicy({
          ...sourcePolicyInput,
          [mutation.key]: replaceOnce(
            sourcePolicyInput[mutation.key],
            mutation.search,
            mutation.replacement,
          ),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
      mutation.key + " mutation must fail closed: " + mutation.search,
    );
  }

  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([
        [
          ADAPTER_TEST_PATH,
          Buffer.from(
            replaceOnce(
              adapterTestSource,
              'fireEvent.change(email, { target: { value: "run-mode@example.test" } })',
              'fireEvent.change(email, { target: { value: "bypassed@example.test" } })',
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
    "inspectTests must reject required semantic-marker drift",
  );
  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([
        [
          APP_PACKAGE_PATH,
          Buffer.from(
            replaceOnce(
              appPackageSource,
              '"test:design-run": "vitest run test/adapter-canvas.test.tsx test/application.test.tsx"',
              '"test:design-run": "vitest run test/application.test.tsx"',
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
    "inspectPackages must reject focused-command drift",
  );
});

test(DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES[9], async () => {
  for (const [relativePath, bytes] of parentArtifactBytes) {
    await assert.rejects(
      buildDesenAppDesignRunModesEvidence({
        fileOverrides: new Map([[relativePath, changedByte(bytes)]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }

  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([
        [FIXTURES_SCENARIOS_ARTIFACT_PATH, changedByte(fixturesScenariosArtifactBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );

  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppDesignRunModesEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.prerequisites, 3);
  assert.equal(verified.p08Status, "NOT_PROVEN");

  await assert.rejects(
    verifyDesenAppDesignRunModesEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppDesignRunModesEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: exactProofDocument("0".repeat(64)),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-m09-t10-boundaries-");
  const destination = path.join(directory, "artifact.json");
  const written = await writeDesenAppDesignRunModesEvidence({ artifactPath: destination });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destination), built.artifactBytes);

  const preserved = Buffer.from("preserve-existing-destination");
  await writeFile(destination, preserved);
  await assert.rejects(
    writeDesenAppDesignRunModesEvidence({
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
    writeDesenAppDesignRunModesEvidence({ artifactPath: linkedDestination }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  await writeFile(artifactTarget, built.artifactBytes);
  await symlink(artifactTarget, artifactLink);
  await assert.rejects(
    verifyDesenAppDesignRunModesEvidence({
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
    buildDesenAppDesignRunModesEvidence({
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
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([[NODE_LINKED_DIAGNOSTICS_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
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
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
      fileOverrides: new Map([
        [PUBLICATION_APPLICATION_TEST, changedByte(publicationApplicationBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppDesignRunModesEvidence({
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
