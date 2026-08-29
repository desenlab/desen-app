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
    "apps/desen-app/test/application.test.tsx": 40,
  });
  assert.equal(built.artifact.tests.fullAppTestFiles, 22);
  assert.equal(built.artifact.tests.fullAppTestCases, 322);
  assert.equal(built.artifact.boundary.trackedFiles, 35);
  assert.equal(built.artifact.boundary.historicalProofReadersTracked, false);
});

test(DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES[9], async () => {
  const rebuilt = await buildDesenAppSourcePersistenceEvidence();
  assert.deepEqual(rebuilt.artifactBytes, built.artifactBytes);
  assert.equal(rebuilt.artifactSha256, built.artifactSha256);
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
      "export function DesenAppApplication({ persistencePort = null }",
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
  assert.equal(verified.focusedTestCases, 140);
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
