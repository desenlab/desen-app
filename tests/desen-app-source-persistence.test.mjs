import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES,
  DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS,
  DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES,
  DesenAppSourcePersistenceProofError,
  buildDesenAppSourcePersistenceEvidence,
  verifyDesenAppSourcePersistenceEvidence,
  verifyDesenAppSourcePersistenceSourcePolicy,
  writeDesenAppSourcePersistenceEvidence,
} from "../scripts/lib/desen-app-source-persistence-proof.mjs";

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
  authoringData: "apps/desen-app/src/authoring-data.ts",
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringScenarios: "apps/desen-app/src/authoring-scenarios.ts",
  previewFidelity: "apps/desen-app/src/preview-fidelity.ts",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  statePanel: "apps/desen-app/src/state-panel.tsx",
  projectNavigation: "apps/desen-app/src/project-navigation.ts",
  persistence: "apps/desen-app/src/authoring-persistence.ts",
  persistenceControls: "apps/desen-app/src/persistence-controls.tsx",
});
const PERSISTENCE_TEST_PATH = "apps/desen-app/test/authoring-persistence.test.ts";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const ROOT_PACKAGE_PATH = "package.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const PUBLICATION_APPLICATION_TEST = "apps/desen-app/test/publication-application.test.tsx";
const temporaryDirectories = [];
let sourcePolicyInput;
let parentArtifactBytes;
let persistenceTestSource;
let appPackageSource;
let rootPackageSource;
let built;

function expectedError(code) {
  return (error) => error instanceof DesenAppSourcePersistenceProofError && error.code === code;
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
      "# Desen App Source persistence",
      "",
      "Task: M09-T12",
      "",
      "Status: DONE",
      "",
      "P-08: NOT_PROVEN",
      "N-012: TESTED",
      "N-018: TESTED",
      "S-003: TESTED",
      "PF-085: OPEN",
      "PF-089: OPEN",
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
      DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS.map(async ({ path: relativePath }) => [
        relativePath,
        await readFile(path.join(ROOT, relativePath)),
      ]),
    ),
  );
  [persistenceTestSource, appPackageSource, rootPackageSource] = await Promise.all([
    readFile(path.join(ROOT, PERSISTENCE_TEST_PATH), "utf8"),
    readFile(path.join(ROOT, APP_PACKAGE_PATH), "utf8"),
    readFile(path.join(ROOT, ROOT_PACKAGE_PATH), "utf8"),
  ]);
  built = await buildDesenAppSourcePersistenceEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[0], () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "desen-app-source-persistence");
  assert.equal(built.artifact.profile, "desen.app.source-persistence-proof.v1");
  assert.equal(built.artifact.task, "M09-T12");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisites, DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS);
  assert.equal(built.artifact.boundary.parentArtifacts, 3);
  assert.equal(built.artifact.claim.taskStatus, "DONE");
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[1], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.publicEditorCorePersistencePort, true);
  assert.deepEqual(source.route, { projectId: "account-app", surfaceId: "sign-in" });
  assert.equal(source.sourceKey, "account-app-source");
  assert.equal(source.documentId, "com.example.account-app");
  assert.equal(source.exactOwnDataAuthorityCapture, true);
  assert.equal(built.artifact.claim.sourceKeyIndependentOfDocumentId, true);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[2], () => {
  const source = built.artifact.authority.source;
  const claim = built.artifact.claim;
  assert.equal(source.awaitedSettlementsCapturedAsExactOwnEnumerableData, true);
  assert.equal(source.settlementAccessorInvocation, false);
  assert.equal(source.malformedOpenRetryableAndDraftPreserved, true);
  assert.equal(source.postReflectionAndAdmissionAuthorityRechecked, true);
  assert.equal(source.openAdmissionAtomic, true);
  assert.equal(source.openedDocumentReauthorized, true);
  assert.equal(source.failedOrRejectedOpenPreservesDraft, true);
  assert.equal(claim.awaitedSettlementsCapturedAsExactOwnEnumerableData, true);
  assert.equal(claim.settlementAccessorInvocation, false);
  assert.equal(claim.malformedOpenRetryableAndDraftPreserved, true);
  assert.equal(claim.postReflectionAndAdmissionAuthorityRechecked, true);
  assert.equal(claim.openAdmissionAtomic, true);
  assert.equal(claim.failedOrRejectedOpenPreservesDraft, true);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[3], () => {
  const source = built.artifact.authority.source;
  const claim = built.artifact.claim;
  assert.equal(source.validOptionalDiagnosticDataCopiedAndFrozen, true);
  assert.equal(source.casGenerationRelationshipsValidated, true);
  assert.equal(source.malformedSaveIndeterminateAndReopenRequired, true);
  assert.equal(source.reentrantSettlementCannotPublishRevokedState, true);
  assert.equal(claim.validOptionalDiagnosticDataCopiedAndFrozen, true);
  assert.equal(claim.casGenerationRelationshipsValidated, true);
  assert.equal(claim.malformedSaveIndeterminateAndReopenRequired, true);
  assert.equal(claim.reentrantSettlementCannotPublishRevokedState, true);
  assert.equal(claim.createUpdateUnchangedGenerationCas, true);
  assert.equal(claim.conflictOrIndeterminateRequiresReopen, true);
  assert.equal(claim.generationExhaustionRequiresReopen, true);
  assert.equal(claim.unexpectedDispatchedSaveIndeterminate, true);
  assert.equal(claim.automaticRetryOrMerge, false);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[4], () => {
  const source = built.artifact.authority.source;
  const claim = built.artifact.claim;
  assert.equal(source.completeAuthoredSourceCanonicalDirtyComparison, true);
  assert.equal(source.identityOrVersionDirtyAuthority, false);
  assert.equal(source.sameCanonicalReplacementRemainsClean, true);
  assert.equal(source.canonicalRevertReturnsClean, true);
  assert.equal(source.successfulOpenOrSaveEstablishesCanonicalBaseline, true);
  assert.equal(claim.completeAuthoredSourceCanonicalDirtyComparison, true);
  assert.equal(claim.identityOrVersionDirtyAuthority, false);
  assert.equal(claim.sameCanonicalReplacementRemainsClean, true);
  assert.equal(claim.canonicalRevertReturnsClean, true);
  assert.equal(claim.successfulOpenOrSaveEstablishesCanonicalBaseline, true);
  assert.equal(claim.newerEditRemainsDirtyAfterOlderSave, true);
  assert.equal(claim.staleOpenCannotReplaceEditedSession, true);
  assert.equal(claim.staleLifetimeSettlementIgnored, true);
  assert.match(built.artifactSha256, /^[0-9a-f]{64}$/u);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[5], () => {
  const source = built.artifact.authority.source;
  assert.equal(source.dirtyOpenRequiresExplicitConfirmation, true);
  assert.equal(source.designModeOnlyControls, true);
  assert.equal(source.visibleGenerationDirtyAndReopenState, true);
  assert.equal(source.cleanNoPortLabelAccurate, true);
  assert.equal(built.artifact.claim.dirtyOpenRequiresExplicitConfirmation, true);
  assert.equal(built.artifact.claim.cleanNoPortLabelAccurate, true);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[6], () => {
  const source = built.artifact.authority.source;
  const claim = built.artifact.claim;
  assert.equal(source.navigationAndPageExitGuarded, true);
  assert.equal(source.centralizedAuthoringSessionCommit, true);
  assert.equal(source.noPortCanonicalBaselineAndCurrentTracked, true);
  assert.equal(source.noPortDirtyProjectionRerenderSafe, true);
  assert.equal(source.pristineNoPortNavigationAdmitted, true);
  assert.equal(source.editedNoPortDraftNavigationAndPageExitGuarded, true);
  assert.equal(claim.navigationAndPageExitGuarded, true);
  assert.equal(claim.centralizedAuthoringSessionCommit, true);
  assert.equal(claim.noPortCanonicalBaselineAndCurrentTracked, true);
  assert.equal(claim.noPortDirtyProjectionRerenderSafe, true);
  assert.equal(claim.pristineNoPortNavigationAdmitted, true);
  assert.equal(claim.editedNoPortDraftNavigationAndPageExitGuarded, true);
  assert.equal(built.artifact.claim.n012Status, "TESTED");
  assert.equal(built.artifact.claim.n018Status, "TESTED");
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[7], () => {
  const claim = built.artifact.claim;
  assert.equal(claim.authoredSourceOnly, true);
  assert.equal(claim.scenarioPreviewPersisted, false);
  assert.equal(claim.runtimeInputOrSecretPersisted, false);
  assert.equal(claim.concretePersistenceAdapterClaimed, false);
  assert.equal(built.artifact.application.package.editorWebDependency, null);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[8], () => {
  assert.equal(built.artifact.tests.focusedFiles.length, 5);
  assert.equal(
    built.artifact.tests.focusedTestCases,
    DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES,
  );
  assert.deepEqual(built.artifact.tests.testCaseCounts, {
    "apps/desen-app/test/authoring-persistence.test.ts": 30,
    "apps/desen-app/test/persistence-controls.test.tsx": 22,
    "apps/desen-app/test/persistence-application.test.tsx": 16,
    "apps/desen-app/test/project-navigation.test.ts": 32,
    "apps/desen-app/test/application.test.tsx": 42,
  });
  assert.equal(built.artifact.tests.fullAppTestFiles, 22);
  assert.equal(built.artifact.tests.fullAppTestCases, 324);
  assert.equal(built.artifact.boundary.trackedFiles, 35);
  assert.equal(built.artifact.boundary.historicalProofReadersTracked, false);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[9], async () => {
  const rebuilt = await buildDesenAppSourcePersistenceEvidence();
  assert.deepEqual(rebuilt.artifactBytes, built.artifactBytes);
  assert.equal(rebuilt.artifactSha256, built.artifactSha256);
  assert.notEqual(rebuilt.artifact, built.artifact);
  assert.equal(Object.isFrozen(rebuilt.artifact), true);
  assert.equal(Object.isFrozen(rebuilt.artifact.boundary.trackedReceipts), true);
  assert.deepEqual(rebuilt.currentCompatibility, built.currentCompatibility);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[10], async () => {
  const sourceMutations = [
    [
      "persistence",
      'const AUTHORIZED_SOURCE_KEY = "account-app-source"',
      'const AUTHORIZED_SOURCE_KEY = "document-id"',
    ],
    ["persistence", "document: snapshotDocument", "document: state.savedDocument"],
    ["persistence", "if (state.reopenRequired)", "if (false)"],
    ["persistence", "documentVersion !== openedAtDocumentVersion", "false"],
    [
      "persistence",
      "const descriptor = Object.getOwnPropertyDescriptor(input, key)",
      "const descriptor = { enumerable: true, value: input[key] }",
    ],
    [
      "persistence",
      'allowedOwnData(input, ["code", "context", "message", "pointer"])',
      'exactOwnData(input, ["code", "context", "message", "pointer"])',
    ],
    [
      "persistence",
      "values.pointer !== undefined && !isJsonPointer(values.pointer)",
      'values.pointer !== undefined && typeof values.pointer !== "string"',
    ],
    [
      "persistence",
      "return Object.freeze({ kind: values.kind, id: values.id })",
      "return { kind: values.kind, id: values.id }",
    ],
    [
      "persistence",
      "expectedGeneration === null && generated.generation === 1",
      "expectedGeneration === null && positiveGeneration(generated.generation)",
    ],
    [
      "persistence",
      "generated.generation === expectedGeneration + 1",
      "positiveGeneration(generated.generation)",
    ],
    [
      "persistence",
      "return expectedGeneration !== null && generated.generation === expectedGeneration",
      "return expectedGeneration !== null && positiveGeneration(generated.generation)",
    ],
    [
      "persistence",
      "expectedGeneration === MAX_GENERATION && generated.generation === MAX_GENERATION",
      "positiveGeneration(generated.generation)",
    ],
    ["persistence", ": currentGeneration === expectedGeneration", ": false"],
    [
      "persistence",
      "const portResult = captureOpenSettlement(rawPortResult)",
      "const portResult = rawPortResult",
    ],
    ["persistence", "if (portResult === undefined)", "if (false)"],
    [
      "persistence",
      "const portResult = captureOpenSettlement(rawPortResult);\n    if (\n      state.disposed ||",
      "const portResult = captureOpenSettlement(rawPortResult);\n    if (\n      false ||",
    ],
    [
      "persistence",
      "const admitted = admitSession(capturedCatalog, portResult.document);\n    if (\n      state.disposed ||",
      "const admitted = admitSession(capturedCatalog, portResult.document);\n    if (\n      false ||",
    ],
    [
      "persistence",
      "const result = captureSaveSettlement(rawPortResult, expectedGeneration)",
      "const result = rawPortResult",
    ],
    ["persistence", "if (result === undefined)", "if (false)"],
    [
      "persistence",
      "const result = captureSaveSettlement(rawPortResult, expectedGeneration);\n    if (state.disposed || currentOperation !== token)",
      "const result = captureSaveSettlement(rawPortResult, expectedGeneration);\n    if (false)",
    ],
    [
      "persistence",
      "canonicalDocument = canonicalizeJson(prepared.model.validationDocument)",
      "canonicalDocument = JSON.stringify(prepared.model.validationDocument)",
    ],
    [
      "persistence",
      "if (admitted.canonicalDocument === currentDocumentCanonical)",
      "if (document === state.session.document)",
    ],
    ["persistence", "currentDocumentCanonical !== savedDocumentCanonical", "documentVersion > 0"],
    [
      "persistence",
      "dirty: currentDocumentCanonical !== snapshotDocumentCanonical",
      "dirty: documentVersion > 0",
    ],
    ["persistenceControls", "Discard changes and open", "Open immediately"],
    ["persistenceControls", "Local draft unchanged", "Saved"],
    [
      "projectNavigation",
      "if (installedNavigationGuard?.owner === owner) installedNavigationGuard = null",
      "installedNavigationGuard = null",
    ],
    [
      "application",
      "publicationPort = null,",
      "export function DesenAppApplication({ persistencePort }",
    ],
    [
      "application",
      "if (persistenceController === null) return inMemoryDraftDirty.current",
      "if (persistenceController === null) return false",
    ],
    [
      "application",
      "if (persistenceController === null) return inMemoryDraftDirty.current",
      "if (persistenceController === null) return true",
    ],
    ["application", "dirty: state?.dirty ?? inMemoryDirty", "dirty: state?.dirty ?? true"],
    [
      "application",
      "const canonicalDocument = canonicalizeJson(nextSession.document)",
      "const canonicalDocument = String(nextSession.document)",
    ],
    ["application", "setAuthoringSession(nextSession)", "void nextSession"],
  ];
  for (const [key, marker, replacement] of sourceMutations) {
    assert.throws(
      () =>
        verifyDesenAppSourcePersistenceSourcePolicy({
          ...sourcePolicyInput,
          [key]: replaceOnce(sourcePolicyInput[key], marker, replacement),
        }),
      expectedError("SOURCE_POLICY_VIOLATION"),
    );
  }
  assert.throws(
    () =>
      verifyDesenAppSourcePersistenceSourcePolicy({
        ...sourcePolicyInput,
        persistence: `${sourcePolicyInput.persistence}\nimport "@desen/editor-web";\n`,
      }),
    expectedError("SOURCE_POLICY_VIOLATION"),
  );

  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          PERSISTENCE_TEST_PATH,
          Buffer.from(
            replaceOnce(
              persistenceTestSource,
              "derives the exact project-owned local key without consulting Source.id",
              "derives a storage key",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  for (const requiredTestName of [
    "fails closed and remains retryable for malformed open settlements without invoking accessors",
    "treats every malformed dispatched save settlement as indeterminate until reopen",
    "rechecks open authority after settlement capture and opened-document admission",
    "rechecks save authority after settlement capture re-entry",
  ]) {
    await assert.rejects(
      buildDesenAppSourcePersistenceEvidence({
        fileOverrides: new Map([
          [
            PERSISTENCE_TEST_PATH,
            Buffer.from(
              replaceOnce(persistenceTestSource, requiredTestName, `${requiredTestName} weakened`),
            ),
          ],
        ]),
      }),
      expectedError("TEST_POLICY_VIOLATION"),
    );
  }
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          PERSISTENCE_TEST_PATH,
          Buffer.from(
            replaceOnce(
              persistenceTestSource,
              "derives clean replacements from complete canonical authored content",
              "derives clean replacements from document identity",
            ),
          ),
        ],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [PERSISTENCE_TEST_PATH, Buffer.from(`${persistenceTestSource}\nit("drift", () => {});\n`)],
      ]),
    }),
    expectedError("TEST_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          APP_PACKAGE_PATH,
          Buffer.from(replaceOnce(appPackageSource, "test:persistence", "test:persistence-drift")),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          ROOT_PACKAGE_PATH,
          Buffer.from(
            replaceOnce(
              rootPackageSource,
              "generate:desen-app-source-persistence",
              "generate:desen-app-source-persistence-drift",
            ),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[11], async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyDesenAppSourcePersistenceEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.focusedTestCases, 142);
  assert.equal(verified.trackedFiles, 35);

  for (const pin of DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS) {
    await assert.rejects(
      buildDesenAppSourcePersistenceEvidence({
        fileOverrides: new Map([[pin.path, changedByte(parentArtifactBytes.get(pin.path))]]),
      }),
      expectedError("PARENT_DRIFT"),
    );
  }
  await assert.rejects(
    verifyDesenAppSourcePersistenceEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyDesenAppSourcePersistenceEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: Buffer.from("Task: M09-T12\nStatus: DONE\n"),
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );

  const directory = await temporaryDirectory("desen-app-source-persistence-");
  const artifactPath = path.join(directory, "artifact.json");
  const written = await writeDesenAppSourcePersistenceEvidence({ artifactPath });
  assert.equal(written.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(artifactPath), built.artifactBytes);

  const sentinel = path.join(directory, "sentinel.json");
  const linkedArtifact = path.join(directory, "linked-artifact.json");
  await writeFile(sentinel, "sentinel\n");
  await symlink(sentinel, linkedArtifact);
  await assert.rejects(
    writeDesenAppSourcePersistenceEvidence({ artifactPath: linkedArtifact }),
    expectedError("ARTIFACT_WRITE_UNSAFE"),
  );
  assert.equal(await readFile(sentinel, "utf8"), "sentinel\n");
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
    buildDesenAppSourcePersistenceEvidence({
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
      buildDesenAppSourcePersistenceEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError("SUCCESSOR_POLICY_VIOLATION"),
    );
  }
});

test("[M10-T01A successor] authenticates the exact public local-persistence composition", async () => {
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
      buildDesenAppSourcePersistenceEvidence({
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
  assert.equal(built.currentCompatibility.package.editorWebDependency, null);
  assert.equal(built.currentCompatibility.package.currentEditorWebRuntimeDependency, "workspace:*");
  assert.equal(
    built.currentCompatibility.package.currentEditorWebAuthority,
    "PUBLIC_LOCAL_PERSISTENCE_ADAPTER_ONLY",
  );
  for (const [relativePath, code] of [
    [successor.artifact.path, "SUCCESSOR_POLICY_VIOLATION"],
    ["apps/desen-app/package.json", "SUCCESSOR_POLICY_VIOLATION"],
    ["apps/desen-app/src/local-runtime-persistence.ts", "SUCCESSOR_POLICY_VIOLATION"],
    ["apps/desen-app/src/product-bootstrap.tsx", "SUCCESSOR_POLICY_VIOLATION"],
    ["dependency-cruiser.config.cjs", "SUCCESSOR_POLICY_VIOLATION"],
    ["pnpm-lock.yaml", "SUCCESSOR_POLICY_VIOLATION"],
  ]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildDesenAppSourcePersistenceEvidence({
        fileOverrides: new Map([[relativePath, Buffer.concat([bytes, Buffer.from("\n")])]]),
      }),
      expectedError(code),
    );
  }
  const appPackagePath = "apps/desen-app/package.json";
  const appPackageBytes = await readFile(path.join(ROOT, appPackagePath));
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          appPackagePath,
          Buffer.from(
            appPackageBytes
              .toString("utf8")
              .replace('"@desen/editor-web": "workspace:*"', '"@desen/editor-web": "^0.1.0"'),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
  const runtimePath = "apps/desen-app/src/local-runtime-persistence.ts";
  const runtimeBytes = await readFile(path.join(ROOT, runtimePath));
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [
          runtimePath,
          Buffer.from(
            runtimeBytes
              .toString("utf8")
              .replace('from "@desen/editor-web";', 'from "@desen/editor-web/private";'),
          ),
        ],
      ]),
    }),
    expectedError("PACKAGE_POLICY_VIOLATION"),
  );
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
      buildDesenAppSourcePersistenceEvidence({
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
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_ARTIFACT, changedByte(artifactBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([[PUBLISH_ACTIVATION_RECEIPT, changedByte(receiptBytes)]]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
      fileOverrides: new Map([
        [PUBLICATION_APPLICATION_TEST, changedByte(publicationApplicationBytes)],
      ]),
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildDesenAppSourcePersistenceEvidence({
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
