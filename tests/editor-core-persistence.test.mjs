import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import * as editorCore from "../packages/editor-core/dist/index.js";
import {
  EDITOR_CORE_PERSISTENCE_PACKAGE_SCRIPTS,
  EDITOR_CORE_PERSISTENCE_PREREQUISITE_PINS,
  EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES,
  EditorCorePersistenceProofError,
  buildEditorCorePersistenceEvidence,
  projectEditorCorePersistenceDependencySecurityManifest,
  verifyEditorCorePersistenceEvidence,
  writeEditorCorePersistenceEvidence,
} from "../scripts/lib/editor-core-persistence-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TRACKED_PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
const TRACKED_CONTINUOUS_VALIDATION_SOURCE = "packages/editor-core/src/continuous-validation.ts";
const PUBLISH_ACTIVATION_ARTIFACT = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PUBLISH_ACTIVATION_RECEIPT = "packages/editor-web/src/local-bundle-channel-publication.ts";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCorePersistenceProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nTask: \`M08-T08\`\n\nResult: \`PASS\`\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`;
}

async function temporaryDirectory(prefix) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  temporaryDirectories.push(directory);
  return directory;
}

function assertDeepFrozen(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return;
  }
  visited.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, visited);
}

before(async () => {
  built = await buildEditorCorePersistenceEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates frozen M07-T05 and M08-T07 plus current emitted integration bytes", () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-persistence");
  assert.equal(built.artifact.profile, "desen.editor-core.persistence-proof.v1");
  assert.equal(built.artifact.task, "M08-T08");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifactBytes.byteLength, 49_785);
  assert.equal(
    built.artifactSha256,
    "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
  );
  assert.deepEqual(
    built.artifact.prerequisites,
    EDITOR_CORE_PERSISTENCE_PREREQUISITE_PINS.map((pin) => ({
      ...pin,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
    })),
  );
  assert.equal(built.artifact.executionAuthority.workspacePublicPackageImports, true);
  assert.equal(built.artifact.claim.realNativeSqlite, true);
  assert.equal(built.artifact.executionAuthority.nativeAddon, "better-sqlite3@13.0.3");
  assert.equal(built.artifact.executionAuthority.osTemporaryRoot, true);
  assert.equal(built.artifact.executionAuthority.networkListenerOpened, false);
  assert.ok(built.artifact.executionAuthority.emittedDistributionReceipts > 0);
  assert.deepEqual(
    built.artifact.packageScripts,
    Object.entries(EDITOR_CORE_PERSISTENCE_PACKAGE_SCRIPTS).map(([name, command]) => ({
      name,
      command,
    })),
  );
  assert.deepEqual(
    built.currentCompatibility.packageScripts.retained,
    Object.entries(EDITOR_CORE_PERSISTENCE_PACKAGE_SCRIPTS).map(([name, command]) => ({
      name,
      command,
    })),
  );
  assert.deepEqual(
    built.currentCompatibility.packageScripts.compatibilityOnlySuccessor.map(({ name }) => name),
    [
      "generate:editor-core-continuous-validation",
      "verify:editor-core-continuous-validation",
      "test:editor-core-continuous-validation",
    ],
  );
  assert.deepEqual(
    built.currentCompatibility.packageScripts.terminalProofSuccessor.map(({ name }) => name),
    [
      "generate:editor-core-terminal-integration",
      "verify:editor-core-terminal-integration",
      "test:editor-core-terminal-integration",
    ],
  );
  assert.equal(built.currentCompatibility.publicApi.currentPackageRuntimeExports.length, 35);
  assert.equal(built.currentCompatibility.publicApi.currentPackageTypeExports.length, 88);
  assert.deepEqual(built.currentCompatibility.publicApi.compatibilityOnlySuccessor, {
    task: "M08-T09",
    authority: "COMPATIBILITY_ONLY_NOT_M08_T08_CLAIM_AUTHORITY",
    relationship: "ADDITIVE_SIBLING_SUCCESSOR",
    sourcePath: TRACKED_CONTINUOUS_VALIDATION_SOURCE,
    runtimePath: "packages/editor-core/dist/continuous-validation.js",
    declarationPath: "packages/editor-core/dist/continuous-validation.d.ts",
    focusedTestPath: "packages/editor-core/test/continuous-validation.test.ts",
    focusedTypesPath: "packages/editor-core/test/continuous-validation.types.ts",
    runtimeExports: ["createDesenEditorContinuousValidator"],
    typeExports: [
      "DesenEditorContinuousValidationReport",
      "DesenEditorContinuousValidator",
      "DesenEditorContinuousValidatorCreationFailure",
      "DesenEditorContinuousValidatorCreationResult",
      "DesenEditorContinuousValidatorCreationSuccess",
      "DesenEditorInvalidSubjectMapping",
    ],
    publicDeclarations: 7,
    tsdocDeclarations: 7,
    publicRuntimeCasesAdded: 1,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.deepEqual(built.currentCompatibility.publicApi.terminalProofSuccessor, {
    task: "M08-T10",
    authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
    focusedTestPath: "packages/editor-core/test/terminal-integration.test.ts",
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    focusedRuntimeCases: 4,
    publicRuntimeCasesAdded: 0,
    publicCompilerNegativeAssertionsAdded: 0,
  });
  assert.deepEqual(built.currentCompatibility.publishActivationSuccessor, {
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
    editorWebReceiptPaths: [
      "packages/editor-web/package.json",
      "packages/editor-web/src/index.ts",
      "packages/editor-web/src/local-bundle-channel-publication.ts",
      "packages/editor-web/test/local-bundle-channel-publication.test.ts",
      "packages/editor-web/test/public-package.mjs",
      "packages/editor-web/test/public-package.types.mts",
    ],
    retainedT08ReceiptHandoffPaths: [
      "packages/editor-web/dist/index.d.ts",
      "packages/editor-web/dist/index.js",
      "packages/editor-web/package.json",
      "packages/editor-web/src/index.ts",
      "packages/editor-web/test/public-package.mjs",
      "packages/editor-web/test/public-package.types.mts",
    ],
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
  assert.equal(built.currentCompatibility.packageBoundary.currentEmittedFiles, 36);
  assert.equal(built.currentCompatibility.packageBoundary.staticEsmEdges, 24);
  assert.equal(built.currentCompatibility.packageBoundary.editorWebOwnsTransportAdapter, true);
  assert.equal(built.currentCompatibility.tests.editorCorePublicRuntimeCases, 50);
  assert.equal(built.currentCompatibility.tests.editorCorePublicCompilerNegativeAssertions, 102);
  assert.equal(built.currentCompatibility.tests.editorCoreTerminalIntegrationRuntimeCases, 4);
  assert.equal(built.currentCompatibility.tests.editorCoreContinuousValidationRuntimeCases, 12);
  assert.equal(
    built.currentCompatibility.tests.editorCoreContinuousValidationCompilerNegativeAssertions,
    9,
  );
  assert.equal(built.currentCompatibility.tests.editorWebPublicRuntimeCases, 4);
  assert.equal(built.currentCompatibility.tests.editorWebPublicCompilerNegativeAssertions, 10);
  assert.deepEqual(built.currentCompatibility.receiptCompatibility, {
    retainedTaskTimeReceipts: 32,
    currentExactRetainedReceipts: 25,
    dependencySecurityProjectedReceipts: 1,
    publishActivationHandoffReceipts: 6,
  });
  assert.deepEqual(built.currentCompatibility.frozenAuthority, {
    path: "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
    bytes: 49_785,
    sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
    proofDocument: {
      path: "docs/proof/EDITOR-CORE-PERSISTENCE.md",
      bytes: 4_631,
      sha256: "4076d45392de8662cfb52672550b6906341cf2c44be165017655c2ac3607ad26",
    },
    retainedTaskTimeReceipts: 32,
    formalPrerequisiteTasks: ["M07-T05", "M08-T07"],
  });
  const tracked = new Set(
    built.currentCompatibility.trackedFiles.map(({ path: relativePath }) => relativePath),
  );
  for (const relativePath of [
    TRACKED_PERSISTENCE_SOURCE,
    TRACKED_CONTINUOUS_VALIDATION_SOURCE,
    "packages/editor-core/dist/continuous-validation.js",
    "packages/editor-core/dist/continuous-validation.d.ts",
    "packages/editor-core/test/continuous-validation.test.ts",
    "packages/editor-core/test/continuous-validation.types.ts",
    "packages/editor-core/test/terminal-integration.test.ts",
    PUBLISH_ACTIVATION_ARTIFACT,
    PUBLISH_ACTIVATION_RECEIPT,
    "packages/editor-web/dist/local-bundle-channel-publication.d.ts",
    "packages/editor-web/dist/local-bundle-channel-publication.js",
    "packages/editor-web/src/local-source-persistence.ts",
    "packages/editor-web/test/local-bundle-channel-publication.test.ts",
    "scripts/lib/editor-core-persistence-proof.mjs",
    "scripts/generate-editor-core-persistence-proof.mjs",
    "scripts/verify-editor-core-persistence.mjs",
    "tests/editor-core-persistence.test.mjs",
  ]) {
    assert.equal(tracked.has(relativePath), true);
  }
});

test("[lifecycle] proves create, open, unchanged, and update through the real local SQLite API", () => {
  assert.deepEqual(built.artifact.integration.lifecycle, {
    initial: "missing",
    createdGeneration: 1,
    openedGeneration: 1,
    unchangedGeneration: 1,
    updatedGeneration: 2,
    raceStatuses: ["conflict", "updated"],
    raceWinnerGeneration: 3,
    raceConflictGeneration: 3,
    restartGeneration: 3,
    restartUnchangedGeneration: 3,
  });
  assert.equal(built.artifact.integration.transport.storage, "REAL_OS_TEMP_SQLITE");
  assert.equal(built.artifact.integration.transport.fetchAuthority, "EXPLICIT_INJECT_SHIM");
  assert.equal(built.artifact.integration.transport.implicitGlobalFetch, false);
  assert.equal(built.artifact.integration.transport.redirectMode, true);
  assert.ok(built.artifact.integration.transport.putRequests >= 6);
  assert.deepEqual(
    built.currentCompatibility.integration.lifecycle,
    built.artifact.integration.lifecycle,
  );
});

test("[durability] proves two-port CAS, close-reopen durability, and independent Source keys", () => {
  assert.deepEqual(built.artifact.integration.durability, {
    independentControlPlaneInstances: 2,
    closeReopen: true,
    nativeSqlite: true,
    compareAndSetSingleWinner: true,
    staleWriterDidNotOverwrite: true,
  });
  assert.equal(built.artifact.integration.roundTrip.sourceKey, "local-draft");
  assert.notEqual(
    built.artifact.integration.roundTrip.sourceKey,
    built.artifact.integration.roundTrip.sourceDocumentId,
  );
  assert.equal(built.artifact.integration.roundTrip.sourceKeyIndependentOfDocumentId, true);
});

test("[round-trip] preserves canonical authoring and all sixteen extension locations", () => {
  const roundTrip = built.artifact.integration.roundTrip;
  assert.equal(roundTrip.canonicalEqualAfterRestart, true);
  assert.equal(roundTrip.authoringPreserved, true);
  assert.equal(roundTrip.extensionLocations, 16);
  assert.equal(roundTrip.detached, true);
  assert.equal(roundTrip.recursivelyFrozen, true);
  assert.match(roundTrip.canonicalSha256, /^[0-9a-f]{64}$/u);
  assert.match(roundTrip.extensionProjectionSha256, /^[0-9a-f]{64}$/u);
  assert.ok(roundTrip.canonicalBytes > 0);
});

test("[adversarial] resolves uncertain commits and fails closed for malformed transport authority", () => {
  assert.deepEqual(built.artifact.integration.uncertainty, {
    lostPutResponseStatus: "indeterminate",
    reopenResolvedGeneration: 1,
    reopenResolvedMarker: "uncertain",
    noAutomaticRetry: true,
  });
  assert.equal(
    built.artifact.integration.adversarial.malformedReadCode,
    "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
  );
  assert.equal(built.artifact.integration.adversarial.malformedWriteStatus, "indeterminate");
  assert.deepEqual(
    built.artifact.integration.adversarial.uncertainPostDispatchStorageResults,
    [
      "STORAGE_IO_FAILURE",
      "UNSAFE_STORAGE_PATH",
      "METADATA_CORRUPT",
      "UNRECOGNIZED_POST_DISPATCH_FAILURE",
    ].map((code) => ({ code, status: "indeterminate" })),
  );
  assert.equal(
    built.artifact.integration.adversarial.authenticationFailureCode,
    "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED",
  );
  assert.equal(
    built.artifact.integration.adversarial.invalidSourceKeyCode,
    "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
  );
  assert.equal(built.artifact.integration.adversarial.implicitFetchRejected, true);
  assert.equal(built.artifact.integration.adversarial.platformDetailsLeaked, false);
});

test("[determinism] two fresh M08-T08 evidence builds are byte-identical", async () => {
  const first = await buildEditorCorePersistenceEvidence();
  const second = await buildEditorCorePersistenceEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.currentCompatibility, second.currentCompatibility);
});

test("[mutation] rejects prerequisite, tracked-file, and runtime substitution", async () => {
  const securityManifest = await readFile(path.join(ROOT, "apps/control-plane-api/package.json"));
  const projectedManifest =
    projectEditorCorePersistenceDependencySecurityManifest(securityManifest);
  assert.equal(JSON.parse(securityManifest.toString("utf8")).dependencies.fastify, "5.12.2");
  assert.equal(JSON.parse(projectedManifest.toString("utf8")).dependencies.fastify, "5.11.2");
  assert.deepEqual(
    projectedManifest,
    Buffer.from(securityManifest.toString("utf8").replace('"5.12.2"', '"5.11.2"')),
  );
  for (const rejectedManifest of [
    projectedManifest,
    changedByte(securityManifest),
    Buffer.from(securityManifest.toString("utf8").replace('"5.12.2"', '"5.12.1"')),
    Buffer.from(securityManifest.toString("utf8").replace('"13.0.3"', '"13.0.4"')),
  ]) {
    assert.throws(
      () => projectEditorCorePersistenceDependencySecurityManifest(rejectedManifest),
      expectedError("RETAINED_T08_AUTHORITY_DRIFT"),
    );
  }
  projectedManifest[0] ^= 1;
  assert.notDeepEqual(
    projectedManifest,
    projectEditorCorePersistenceDependencySecurityManifest(securityManifest),
  );
  const prerequisite = await readFile(
    path.join(ROOT, EDITOR_CORE_PERSISTENCE_PREREQUISITE_PINS[0].path),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({ m07PrerequisiteBytes: changedByte(prerequisite) }),
    expectedError("PREREQUISITE_DRIFT"),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({ m07PrerequisiteBytes: prerequisite }),
    expectedError("PREREQUISITE_OVERRIDE_REJECTED"),
  );
  const tracked = await readFile(path.join(ROOT, TRACKED_PERSISTENCE_SOURCE));
  await assert.rejects(
    buildEditorCorePersistenceEvidence({
      fileOverrides: { [TRACKED_PERSISTENCE_SOURCE]: changedByte(tracked) },
    }),
    expectedError("TRACKED_FILE_DRIFT"),
  );
  const continuousValidation = await readFile(
    path.join(ROOT, TRACKED_CONTINUOUS_VALIDATION_SOURCE),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({
      fileOverrides: {
        [TRACKED_CONTINUOUS_VALIDATION_SOURCE]: changedByte(continuousValidation),
      },
    }),
    expectedError("TRACKED_FILE_DRIFT"),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({ runtime: editorCore }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  const [publishActivationArtifact, publishActivationReceipt] = await Promise.all([
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_ARTIFACT)),
    readFile(path.join(ROOT, PUBLISH_ACTIVATION_RECEIPT)),
  ]);
  await assert.rejects(
    buildEditorCorePersistenceEvidence({
      fileOverrides: {
        [PUBLISH_ACTIVATION_ARTIFACT]: changedByte(publishActivationArtifact),
      },
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({
      fileOverrides: {
        [PUBLISH_ACTIVATION_RECEIPT]: changedByte(publishActivationReceipt),
      },
    }),
    expectedError("SUCCESSOR_POLICY_VIOLATION"),
  );
  await assert.rejects(
    buildEditorCorePersistenceEvidence({
      fileOverrides: {
        [PUBLISH_ACTIVATION_ARTIFACT]: publishActivationArtifact,
      },
    }),
    expectedError("TRACKED_FILE_OVERRIDE_REJECTED"),
  );
});

test("[artifact] verifies exact bytes and one visible proof-document pin", async () => {
  const proofDocument = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCorePersistenceEvidence({
    artifactBytes: built.artifactBytes,
    proofDocument,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  await assert.rejects(
    verifyEditorCorePersistenceEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocument,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCorePersistenceEvidence({
      artifactBytes: built.artifactBytes,
      proofDocument: `<!-- Final artifact: \`sha256:${built.artifactSha256}\` -->\nTask: \`M08-T08\`\nResult: \`PASS\`\n`,
    }),
    expectedError("PROOF_DOCUMENT_DRIFT"),
  );
});

test("[writer] atomically commits exact bytes and protects an existing destination", async () => {
  const directory = await temporaryDirectory("desen-m08-t08-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCorePersistenceEvidence({
      destinationPath,
      async beforeAtomicRename({ temporaryPath }) {
        await writeFile(temporaryPath, "tampered\n");
      },
    }),
    expectedError("ARTIFACT_WRITE_FAILED"),
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");
  const result = await writeEditorCorePersistenceEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[options] rejects linked authority and active, inherited, proxy, or shared inputs", async () => {
  let getterInvocations = 0;
  const accessor = {};
  Object.defineProperty(accessor, "runtime", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return editorCore;
    },
  });
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  for (const options of [
    accessor,
    Object.create({ runtime: editorCore }),
    new Proxy({}, { ownKeys: () => ["runtime"] }),
    { [Symbol("authority")]: true },
    { m07PrerequisiteBytes: shared },
  ]) {
    await assert.rejects(
      buildEditorCorePersistenceEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  assert.equal(getterInvocations, 0);

  const directory = await temporaryDirectory("desen-m08-t08-authority-");
  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(artifactTarget, artifactLink);
  await symlink(proofTarget, proofLink);
  await assert.rejects(
    verifyEditorCorePersistenceEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCorePersistenceEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofLink,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  assertDeepFrozen(built.artifact);
  assertDeepFrozen(built.currentCompatibility);
  assert.equal(built.artifact.nonclaims.length, 8);
  assert.equal(
    built.currentCompatibility.nonclaims.includes(
      "M08-T09 continuous-validation bytes are compatibility-only successor authority and are not part of the frozen M08-T08 claim.",
    ),
    true,
  );
  assert.equal(
    built.currentCompatibility.nonclaims.includes(
      "M08-T10 terminal-integration bytes are compatibility-only successor authority and are not part of the frozen M08-T08 claim.",
    ),
    true,
  );
  assert.equal(
    built.currentCompatibility.nonclaims.includes(
      "M09-T14 publish-activation bytes are authenticated successor authority and are not part of the frozen M08-T08 claim.",
    ),
    true,
  );
  assert.deepEqual(
    EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES,
    EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES.slice(),
  );
});
