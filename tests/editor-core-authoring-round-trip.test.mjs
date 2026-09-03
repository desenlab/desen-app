import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fsPromises, {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import * as editorCore from "../packages/editor-core/dist/index.js";
import {
  EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS,
  EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES,
  EditorCoreAuthoringRoundTripProofError,
  buildEditorCoreAuthoringRoundTripEvidence,
  verifyEditorCoreAuthoringRoundTripEvidence,
  writeEditorCoreAuthoringRoundTripEvidence,
} from "../scripts/lib/editor-core-authoring-round-trip-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const FOCUSED_TEST = "packages/editor-core/test/authoring-round-trip.test.ts";
const FOCUSED_TYPES = "packages/editor-core/test/authoring-round-trip.types.ts";
const PROOF_LIBRARY = "scripts/lib/editor-core-authoring-round-trip-proof.mjs";
const ROOT_TEST = "tests/editor-core-authoring-round-trip.test.mjs";
const PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
const PERSISTENCE_RUNTIME = "packages/editor-core/dist/persistence.js";
const PERSISTENCE_DECLARATION = "packages/editor-core/dist/persistence.d.ts";
const PERSISTENCE_TEST = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES = "packages/editor-core/test/persistence.types.ts";
const CONTINUOUS_VALIDATION_SOURCE = "packages/editor-core/src/continuous-validation.ts";
const CONTINUOUS_VALIDATION_RUNTIME = "packages/editor-core/dist/continuous-validation.js";
const CONTINUOUS_VALIDATION_DECLARATION = "packages/editor-core/dist/continuous-validation.d.ts";
const CONTINUOUS_VALIDATION_TEST = "packages/editor-core/test/continuous-validation.test.ts";
const CONTINUOUS_VALIDATION_TYPES = "packages/editor-core/test/continuous-validation.types.ts";
const PERSISTENCE_SUCCESSOR_PATHS = Object.freeze([
  PERSISTENCE_SOURCE,
  PERSISTENCE_RUNTIME,
  `${PERSISTENCE_RUNTIME}.map`,
  PERSISTENCE_DECLARATION,
  `${PERSISTENCE_DECLARATION}.map`,
  PERSISTENCE_TEST,
  PERSISTENCE_TYPES,
]);
const CONTINUOUS_VALIDATION_SUCCESSOR_PATHS = Object.freeze([
  CONTINUOUS_VALIDATION_SOURCE,
  CONTINUOUS_VALIDATION_RUNTIME,
  `${CONTINUOUS_VALIDATION_RUNTIME}.map`,
  CONTINUOUS_VALIDATION_DECLARATION,
  `${CONTINUOUS_VALIDATION_DECLARATION}.map`,
  CONTINUOUS_VALIDATION_TEST,
  CONTINUOUS_VALIDATION_TYPES,
]);
const TERMINAL_INTEGRATION_TEST = "packages/editor-core/test/terminal-integration.test.ts";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreAuthoringRoundTripProofError && error.code === code;
}

function changedByte(bytes) {
  const changed = Buffer.from(bytes);
  changed[Math.floor(changed.byteLength / 2)] ^= 1;
  return changed;
}

function exactProofDocument(artifactSha256) {
  return `# Test proof\n\nFinal artifact: \`sha256:${artifactSha256}\`\n`;
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
  built = await buildEditorCoreAuthoringRoundTripEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates exact M08-T01 through T06 artifacts, frozen protocol bytes, and isolated runtime", async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-authoring-round-trip");
  assert.equal(built.artifact.profile, "desen.editor-core.authoring-round-trip-proof.v1");
  assert.equal(built.artifact.task, "M08-T07");
  assert.equal(built.artifact.result, "PASS");
  assert.equal(built.artifactBytes.byteLength, 62_304);
  assert.equal(
    built.artifactSha256,
    "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
  );
  assert.deepEqual(
    built.artifact.prerequisites,
    EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map((pin) => ({
      task: pin.task,
      path: pin.path,
      bytes: pin.bytes,
      sha256: pin.sha256,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      liveProofReaderInput: false,
      checkpointHeadInput: false,
    })),
  );
  assert.deepEqual(
    built.artifact.claim.prerequisiteTasks,
    EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map(({ task }) => task),
  );
  assert.equal(built.artifact.claim.proofOnlyNoRuntimeOrTypeExportAdded, true);
  assert.equal(built.artifact.publicApi.taskRuntimeExportsAdded, 0);
  assert.equal(built.artifact.publicApi.taskTypeExportsAdded, 0);
  assert.deepEqual(built.artifact.publicApi.predecessorExportInvariance, {
    predecessorTask: "M08-T06",
    predecessorRuntimeExports: 33,
    predecessorTypeExports: 69,
    sourceRuntimeExact: true,
    sourceTypeExact: true,
    emittedRuntimeExact: true,
    emittedDeclarationRuntimeExact: true,
    emittedDeclarationTypeExact: true,
    runtimeAdditions: [],
    runtimeRemovals: [],
    typeAdditions: [],
    typeRemovals: [],
    taskRuntimeExportsAdded: 0,
    taskTypeExportsAdded: 0,
  });
  assert.equal(built.artifact.frozenProtocol.snapshot.snapshotFiles, 31);
  assert.equal(built.artifact.frozenProtocol.snapshot.totalBytes, 306_604);
  assert.equal(built.artifact.frozenProtocol.exactFiles.length, 6);
  assert.equal(built.artifact.retainedNormativeEvidence.artifacts.length, 4);
  assert.equal(
    built.artifact.retainedNormativeEvidence.rootAuthoringExcludedFromTerminalBundle,
    true,
  );
  assert.equal(built.artifact.executionAuthority.runtimeFiles, 29);
  assert.equal(built.artifact.executionAuthority.editorFiles, 8);
  assert.equal(built.artifact.executionAuthority.dependencyFiles, 21);
  assert.equal(built.artifact.executionAuthority.retainedPredecessorEditorFiles, 7);

  const t06Artifact = JSON.parse(
    await readFile(
      path.join(ROOT, EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.at(-1).path),
      "utf8",
    ),
  );
  assert.deepEqual(
    built.artifact.executionAuthority.dependencyReceipts,
    t06Artifact.executionAuthority.dependencyReceipts,
  );
  const tracked = new Map(
    built.artifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  assert.equal(tracked.has(FOCUSED_TEST), true);
  assert.equal(tracked.has(FOCUSED_TYPES), true);
  for (const receipt of [
    ...built.artifact.executionAuthority.editorReceipts,
    ...built.artifact.executionAuthority.dependencyReceipts,
  ]) {
    assert.deepEqual(tracked.get(receipt.path), receipt);
  }
  assert.deepEqual(built.currentCompatibility.publicApi.proofOnlySuccessor, {
    task: "M08-T07",
    focusedTestPath: FOCUSED_TEST,
    focusedTypesPath: FOCUSED_TYPES,
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    publicRuntimeCasesAdded: 2,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.deepEqual(built.currentCompatibility.publicApi.terminalProofSuccessor, {
    task: "M08-T10",
    authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
    focusedTestPath: TERMINAL_INTEGRATION_TEST,
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    focusedRuntimeCases: 4,
    publicRuntimeCasesAdded: 0,
    publicCompilerNegativeAssertionsAdded: 0,
  });
  assert.deepEqual(built.currentCompatibility.publicApi.additiveSuccessors, [
    {
      task: "M08-T08",
      sourcePath: PERSISTENCE_SOURCE,
      runtimePath: PERSISTENCE_RUNTIME,
      declarationPath: PERSISTENCE_DECLARATION,
      focusedTestPath: PERSISTENCE_TEST,
      focusedTypesPath: PERSISTENCE_TYPES,
      runtimeExports: ["createDesenEditorPersistencePort"],
      typeExports: [
        "DesenEditorPersistenceAdapter",
        "DesenEditorPersistenceAdapterFailureReason",
        "DesenEditorPersistenceAdapterReadResult",
        "DesenEditorPersistenceAdapterSourceRecord",
        "DesenEditorPersistenceAdapterWriteRequest",
        "DesenEditorPersistenceAdapterWriteResult",
        "DesenEditorPersistenceDiagnostic",
        "DesenEditorPersistenceDiagnosticCode",
        "DesenEditorPersistencePort",
        "DesenEditorSourceOpenResult",
        "DesenEditorSourceOpenSuccess",
        "DesenEditorSourceSaveRequest",
        "DesenEditorSourceSaveResult",
      ],
      publicRuntimeCasesAdded: 3,
      publicCompilerNegativeAssertionsAdded: 21,
    },
    {
      task: "M08-T09",
      sourcePath: CONTINUOUS_VALIDATION_SOURCE,
      runtimePath: CONTINUOUS_VALIDATION_RUNTIME,
      declarationPath: CONTINUOUS_VALIDATION_DECLARATION,
      focusedTestPath: CONTINUOUS_VALIDATION_TEST,
      focusedTypesPath: CONTINUOUS_VALIDATION_TYPES,
      runtimeExports: ["createDesenEditorContinuousValidator"],
      typeExports: [
        "DesenEditorContinuousValidationReport",
        "DesenEditorContinuousValidator",
        "DesenEditorContinuousValidatorCreationFailure",
        "DesenEditorContinuousValidatorCreationResult",
        "DesenEditorContinuousValidatorCreationSuccess",
        "DesenEditorInvalidSubjectMapping",
      ],
      publicRuntimeCasesAdded: 1,
      publicCompilerNegativeAssertionsAdded: 6,
      publicDeclarations: 7,
      tsdocDeclarations: 7,
    },
  ]);
  assert.deepEqual(built.currentCompatibility.publicApi.additiveRuntimeExports, [
    "createDesenEditorContinuousValidator",
    "createDesenEditorPersistencePort",
  ]);
  assert.equal(built.currentCompatibility.publicApi.additiveTypeExports.length, 19);
  assert.equal(built.currentCompatibility.publicApi.currentPackageRuntimeExports.length, 35);
  assert.equal(built.currentCompatibility.publicApi.currentPackageTypeExports.length, 88);
  assert.equal(built.currentCompatibility.executionAuthority.runtimeFiles, 31);
  assert.equal(built.currentCompatibility.executionAuthority.editorFiles, 10);
  assert.equal(built.currentCompatibility.packageBoundary.currentEmittedFiles, 36);
  assert.equal(built.currentCompatibility.packageBoundary.staticEsmEdges, 24);
  assert.equal(built.currentCompatibility.testAuthority.publicRuntimeAndRootCases, 50);
  assert.equal(built.currentCompatibility.testAuthority.publicCompilerNegativeAssertions, 102);
  assert.equal(built.currentCompatibility.testAuthority.terminalIntegrationRuntimeCases, 4);
  assert.equal(built.currentCompatibility.trackedBoundary.files, 110);
  assert.deepEqual(built.currentCompatibility.frozenAuthority, {
    path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    bytes: 62_304,
    sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
    retainedTaskTimeReceipts: 84,
  });
  const currentReceipts = new Set(
    built.currentCompatibility.trackedBoundary.receipts.map(({ path: receiptPath }) => receiptPath),
  );
  for (const relativePath of PERSISTENCE_SUCCESSOR_PATHS) {
    assert.equal(currentReceipts.has(relativePath), true);
  }
  for (const relativePath of CONTINUOUS_VALIDATION_SUCCESSOR_PATHS) {
    assert.equal(currentReceipts.has(relativePath), true);
  }
  assert.equal(currentReceipts.has(TERMINAL_INTEGRATION_TEST), true);
});

test("[determinism] two fresh M08-T07 builds are byte-identical", async () => {
  const first = await buildEditorCoreAuthoringRoundTripEvidence();
  const second = await buildEditorCoreAuthoringRoundTripEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("[behavior] proves all 32 commands preserve authoring and all 16 unknown-extension locations", () => {
  const behavior = built.artifact.behavior;
  assert.equal(behavior.commands.runtimeExports, 33);
  assert.equal(behavior.commands.mutationCommands, 32);
  assert.equal(behavior.commands.commandReceipts.length, 32);
  assert.equal(behavior.authoringIsolation.rootAuthoringPreservedAcrossAllCommands, true);
  assert.equal(behavior.authoringIsolation.scannerIsolation.exactAllocatedId, "sign-in.inserted");
  assert.deepEqual(
    behavior.authoringIsolation.scannerIsolation.actionProbeReceipts.map(
      ({ fakeActionShapedValues }) => fakeActionShapedValues,
    ),
    [25_001, 25_001, 25_001],
  );
  assert.deepEqual(behavior.authoringIsolation.scannerIsolation.actionProbeReceipts.at(-1), {
    ...behavior.authoringIsolation.scannerIsolation.actionProbeReceipts.at(-1),
    location: "nested-action-extension",
    pointer: "/surfaces/sign-in/root/on/preservation/3/onSuccess/0/extensions",
    commandSucceededAboveCoreActionLimit: true,
  });
  assert.deepEqual(behavior.authoringIsolation.scannerIsolation.ownerProbeReceipts.at(-1), {
    ...behavior.authoringIsolation.scannerIsolation.ownerProbeReceipts.at(-1),
    location: "nested-action-extension",
    pointer: "/surfaces/sign-in/root/on/preservation/3/onSuccess/0/extensions",
    fakeOwnerId: "nested-extension.fake-owner",
    diagnosticCode: "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
  });
  assert.equal(
    behavior.authoringIsolation.scannerIsolation.nestedActionExtensionActionScanProbed,
    true,
  );
  assert.equal(
    behavior.authoringIsolation.scannerIsolation.nestedActionExtensionOwnerScanProbed,
    true,
  );
  assert.deepEqual(behavior.authoringIsolation.canonicalByteLimit, {
    ...behavior.authoringIsolation.canonicalByteLimit,
    canonicalSourceByteLimit: 8_388_608,
    withRootAuthoringCanonicalBytes: 8_388_609,
    overByOneRejected: true,
    authoringExcludedControlSucceeded: true,
    limitCoversCompleteSourceIncludingRootAuthoring: true,
  });
  assert.equal(behavior.unknownExtensions.sourceReachableLocations, 16);
  assert.equal(behavior.unknownExtensions.locations.length, 16);
  assert.equal(behavior.unknownExtensions.valuesPreservedAcrossFactoryAndAllCommands, true);
  assert.equal(
    behavior.unknownExtensions.valuesPreservedAcrossJsonSerializationParseAndReadmission,
    true,
  );
  assert.equal(behavior.unknownExtensions.lifecycle.insertCarriesSuppliedMarker, true);
  assert.equal(behavior.unknownExtensions.lifecycle.moveCarriesMarkerToNewPointer, true);
  assert.equal(behavior.unknownExtensions.lifecycle.reorderCarriesMarkerToNewPointer, true);
  assert.equal(behavior.unknownExtensions.lifecycle.deleteRemovesOnlyTargetOwnerMarker, true);
  assert.equal(
    behavior.unknownExtensions.lifecycle.wholeReplacementReplacesOldMarkerWithSuppliedMarker,
    true,
  );
  assert.equal(
    behavior.unknownExtensions.lifecycle.deliberatelyDeletedOrWholeReplacedOwnerMarkerSurvives,
    false,
  );
  assert.equal(behavior.roundTrip.readmissionCycles, 67);
});

test("[mutation] rejects runtime substitution and tracked boundary mutation", async () => {
  let runtimeExecuted = false;
  const runtime = Object.fromEntries(
    built.currentCompatibility.publicApi.currentPackageRuntimeExports.map((name) => [
      name,
      (...arguments_) => {
        runtimeExecuted = true;
        return editorCore[name](...arguments_);
      },
    ]),
  );
  await assert.rejects(
    buildEditorCoreAuthoringRoundTripEvidence({ runtime }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  assert.equal(runtimeExecuted, false);

  for (const relativePath of [FOCUSED_TEST, FOCUSED_TYPES]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildEditorCoreAuthoringRoundTripEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
  for (const relativePath of [PROOF_LIBRARY, ROOT_TEST]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildEditorCoreAuthoringRoundTripEvidence({
        fileOverrides: { [relativePath]: Buffer.concat([bytes, Buffer.from("\n")]) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
  for (const relativePath of [
    ...PERSISTENCE_SUCCESSOR_PATHS,
    ...CONTINUOUS_VALIDATION_SUCCESSOR_PATHS,
  ]) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildEditorCoreAuthoringRoundTripEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const directory = await temporaryDirectory("desen-m08-t07-proof-preflight-");
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(proofDocumentPath, proofDocumentBytes);
  const authorityOpen = test.mock.method(fsPromises, "open");
  syncBuiltinESMExports();
  try {
    const verified = await verifyEditorCoreAuthoringRoundTripEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath,
    });
    assert.equal(verified.result, "PASS");
    assert.equal(verified.artifactSha256, built.artifactSha256);
    assert.equal(
      verified.directPredecessorSha256,
      EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.at(-1).sha256,
    );
    assert.deepEqual(
      verified.prerequisiteSha256s,
      EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.map(({ sha256 }) => sha256),
    );
    assert.equal(
      authorityOpen.mock.calls.filter(({ arguments: values }) => values[0] === proofDocumentPath)
        .length,
      2,
      "A path-backed proof must be acquired again after the complete fresh build.",
    );
    const readsAfterPositive = authorityOpen.mock.callCount();
    await assert.rejects(
      verifyEditorCoreAuthoringRoundTripEvidence({
        artifactBytes: changedByte(built.artifactBytes),
        proofDocumentBytes,
      }),
      expectedError("ARTIFACT_DRIFT"),
    );
    assert.ok(authorityOpen.mock.callCount() > readsAfterPositive);
    const readsBeforeMalformedProofs = authorityOpen.mock.callCount();

    for (const invalidProofDocumentBytes of [
      `${proofDocumentBytes}${proofDocumentBytes}`,
      `# Hidden\n\n<!-- Final artifact: \`sha256:${built.artifactSha256}\` -->\n`,
      `# Fenced\n\n\`\`\`text\nFinal artifact: \`sha256:${built.artifactSha256}\`\n\`\`\`\n`,
      `${proofDocumentBytes}\nStatus: FAIL\n`,
      `${proofDocumentBytes}\nsha256:PENDING\n`,
    ]) {
      await assert.rejects(
        verifyEditorCoreAuthoringRoundTripEvidence({
          artifactBytes: built.artifactBytes,
          proofDocumentBytes: invalidProofDocumentBytes,
        }),
        expectedError("PROOF_PIN_DRIFT"),
      );
    }
    for (const malformedPin of ["short", "A".repeat(64), "0".repeat(63)]) {
      await assert.rejects(
        verifyEditorCoreAuthoringRoundTripEvidence({
          artifactBytes: built.artifactBytes,
          proofDocumentBytes: exactProofDocument(malformedPin),
        }),
        expectedError("PROOF_PIN_DRIFT"),
      );
    }
    // Structural invalidity wins over a second artifact fault without entering build authority.
    await assert.rejects(
      verifyEditorCoreAuthoringRoundTripEvidence({
        artifactBytes: changedByte(built.artifactBytes),
        proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
    await assert.rejects(
      verifyEditorCoreAuthoringRoundTripEvidence({
        buildOptions: { unknown: true },
        proofDocumentBytes: "malformed",
      }),
      expectedError("OPTIONS_INVALID"),
    );
    assert.equal(
      authorityOpen.mock.callCount(),
      readsBeforeMalformedProofs,
      "Malformed proof envelopes must not acquire any build authority.",
    );
    await assert.rejects(
      verifyEditorCoreAuthoringRoundTripEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentBytes: exactProofDocument("0".repeat(64)),
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
    assert.ok(
      authorityOpen.mock.callCount() > readsBeforeMalformedProofs,
      "A plausible but wrong digest must still be checked against a complete fresh build.",
    );
  } finally {
    authorityOpen.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[writer] atomically commits exact bytes and preserves the previous destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t07-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCoreAuthoringRoundTripEvidence({
      destinationPath,
      beforeAtomicRename() {
        throw new Error("blocked before rename");
      },
    }),
    /blocked before rename/,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");
  const result = await writeEditorCoreAuthoringRoundTripEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[writer-filesystem] rejects symlink, hard-link, and non-file destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t07-destination-");
  const target = path.join(directory, "target.json");
  const symbolic = path.join(directory, "symbolic.json");
  const hard = path.join(directory, "hard.json");
  const nonFile = path.join(directory, "directory.json");
  await writeFile(target, "target\n");
  await symlink(target, symbolic);
  await link(target, hard);
  await mkdir(nonFile);
  const linkedParent = path.join(directory, "linked-parent");
  await symlink(directory, linkedParent);
  const authorityOpen = test.mock.method(fsPromises, "open");
  syncBuiltinESMExports();
  try {
    for (const destinationPath of [
      symbolic,
      hard,
      nonFile,
      path.join(directory, "missing-parent", "artifact.json"),
      path.join(linkedParent, "artifact.json"),
    ]) {
      await assert.rejects(
        writeEditorCoreAuthoringRoundTripEvidence({ destinationPath }),
        expectedError("FILESYSTEM_UNSAFE"),
      );
    }
    assert.equal(
      authorityOpen.mock.callCount(),
      0,
      "Unsafe destinations must be rejected before any fresh-build authority is opened.",
    );
  } finally {
    authorityOpen.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[filesystem] rejects linked artifact/proof and linked, replaced, or raced prerequisites", async () => {
  const directory = await temporaryDirectory("desen-m08-t07-authority-");
  const pin = EDITOR_CORE_AUTHORING_ROUND_TRIP_PREREQUISITE_PINS.at(-1);
  const prerequisiteBytes = await readFile(path.join(ROOT, pin.path));
  const prerequisiteCopy = path.join(directory, "t06-copy.json");
  const prerequisiteSymbolic = path.join(directory, "t06-symbolic.json");
  await writeFile(prerequisiteCopy, prerequisiteBytes);
  await symlink(prerequisiteCopy, prerequisiteSymbolic);
  await assert.rejects(
    buildEditorCoreAuthoringRoundTripEvidence({ t06PrerequisitePath: prerequisiteSymbolic }),
    expectedError("FILESYSTEM_UNSAFE"),
  );

  const hardTarget = path.join(directory, "t06-hard-target.json");
  const prerequisiteHard = path.join(directory, "t06-hard.json");
  await writeFile(hardTarget, prerequisiteBytes);
  await link(hardTarget, prerequisiteHard);
  await assert.rejects(
    buildEditorCoreAuthoringRoundTripEvidence({ t06PrerequisitePath: prerequisiteHard }),
    expectedError("FILESYSTEM_UNSAFE"),
  );

  const swappedAuthority = path.join(directory, "t06-swapped.json");
  const heldAuthority = path.join(directory, "t06-held.json");
  const replacementAuthority = path.join(directory, "t06-replacement.json");
  await writeFile(swappedAuthority, prerequisiteBytes);
  await writeFile(replacementAuthority, "replacement\n");
  let swapped = false;
  await assert.rejects(
    buildEditorCoreAuthoringRoundTripEvidence({
      t06PrerequisitePath: swappedAuthority,
      async beforeAuthorityRecheck({ absolutePath }) {
        if (absolutePath !== swappedAuthority || swapped) return;
        swapped = true;
        await rename(swappedAuthority, heldAuthority);
        await rename(replacementAuthority, swappedAuthority);
      },
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  assert.equal(swapped, true);

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactSymbolic = path.join(directory, "artifact-symbolic.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofSymbolic = path.join(directory, "proof-symbolic.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(artifactTarget, artifactSymbolic);
  await symlink(proofTarget, proofSymbolic);
  await assert.rejects(
    verifyEditorCoreAuthoringRoundTripEvidence({
      artifactPath: artifactSymbolic,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreAuthoringRoundTripEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofSymbolic,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
});

test("[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs", async () => {
  let getterInvocations = 0;
  const accessor = {};
  Object.defineProperty(accessor, "runtime", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return editorCore;
    },
  });
  const inherited = Object.create({ runtime: editorCore });
  const symbol = { [Symbol("authority")]: true };
  const proxy = new Proxy({}, { ownKeys: () => ["runtime"] });
  const shared = new Uint8Array(new SharedArrayBuffer(8));
  for (const options of [
    { unknown: true },
    accessor,
    inherited,
    symbol,
    proxy,
    { t06PrerequisiteBytes: shared },
    { beforeAuthorityRecheck: new Proxy(() => undefined, {}) },
  ]) {
    await assert.rejects(
      buildEditorCoreAuthoringRoundTripEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeEditorCoreAuthoringRoundTripEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  assert.equal(getterInvocations, 0);
});

test("[immutability] freezes evidence and states the exact nonclaim boundary", () => {
  assertDeepFrozen(built.artifact);
  assertDeepFrozen(built.currentCompatibility);
  assert.deepEqual(built.artifact.nonclaims, [
    "LEXICAL_JSON_BYTES_WHITESPACE_OR_OBJECT_MEMBER_ORDER_PRESERVATION",
    "STORAGE_IO_SAVE_OPEN_DURABILITY_AND_PERSISTENCE_PORT_M08_T08",
    "UNKNOWN_EXTENSION_DEFINED_CORE_SEMANTICS",
    "DELIBERATELY_DELETED_OR_WHOLE_REPLACED_OWNER_EXTENSION_SURVIVAL",
    "CONTINUOUS_CATALOG_SEMANTICS_AND_INVALID_NODE_MAPPING_M08_T09",
    "ACTION_EXECUTION_AND_RUNTIME_TURNS",
    "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
    "M08_T10_TERMINAL_REACT_DOM_AND_G08_BOUNDARY",
    "HOSTILE_JAVASCRIPT_SANDBOX",
    "NO_PROXY_TRAP_EXECUTION_MEMBRANE",
    "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
    "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    "P18_OR_G08_ADVANCEMENT",
  ]);
  assert.deepEqual(
    built.artifact.normativeCoverage.map(({ id, status }) => [id, status]),
    [
      ["N-012", "TESTED"],
      ["N-018", "TESTED"],
      ["S-003", "TESTED"],
    ],
  );
  assert.equal(
    built.currentCompatibility.nonclaims.includes(
      "M08_T08_PERSISTENCE_SUCCESSOR_BYTES_ARE_COMPATIBILITY_ONLY_NOT_T07_CLAIM_AUTHORITY",
    ),
    true,
  );
  assert.equal(
    built.currentCompatibility.nonclaims.includes(
      "M08_T09_CONTINUOUS_VALIDATION_SUCCESSOR_BYTES_ARE_COMPATIBILITY_ONLY_NOT_T07_CLAIM_AUTHORITY",
    ),
    true,
  );
  assert.deepEqual(
    EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES,
    EDITOR_CORE_AUTHORING_ROUND_TRIP_ROOT_TEST_NAMES.slice(),
  );
});
