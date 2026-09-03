import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fsPromises, {
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
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
  EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN,
  EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES,
  EditorCoreStableIdInsertProofError,
  buildEditorCoreStableIdInsertEvidence,
  verifyEditorCoreStableIdInsertEvidence,
  writeEditorCoreStableIdInsertEvidence,
} from "../scripts/lib/editor-core-stable-id-insert-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const INSERT_SOURCE = "packages/editor-core/src/stable-id-insert.ts";
const STRUCTURAL_EDITS_SOURCE = "packages/editor-core/src/structural-edits.ts";
const CONTENT_EDITS_SOURCE = "packages/editor-core/src/content-edits.ts";
const PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
const AUTHORING_ROUND_TRIP_TEST = "packages/editor-core/test/authoring-round-trip.test.ts";
const AUTHORING_ROUND_TRIP_TYPES = "packages/editor-core/test/authoring-round-trip.types.ts";
const PERSISTENCE_TEST = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES = "packages/editor-core/test/persistence.types.ts";
const TERMINAL_INTEGRATION_TEST = "packages/editor-core/test/terminal-integration.test.ts";
const PUBLIC_TEST = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES = "packages/editor-core/test/public-package.types.mts";
const ROOT_TEST = "tests/editor-core-stable-id-insert.test.mjs";
const PROTOCOL_RUNTIME = "packages/protocol/dist/index.js";
const CONTENT_RUNTIME_EXPORTS = Object.freeze([
  "clearDesenEditorNodeCondition",
  "deleteDesenEditorOwnerProp",
  "deleteDesenEditorOwnerStyleProperty",
  "deleteDesenEditorVariant",
  "deleteDesenEditorVariantProp",
  "deleteDesenEditorVariantStyleProperty",
  "insertDesenEditorVariant",
  "reorderDesenEditorVariant",
  "setDesenEditorNodeCondition",
  "setDesenEditorOwnerProp",
  "setDesenEditorOwnerStyleProperty",
  "setDesenEditorVariantCondition",
  "setDesenEditorVariantProp",
  "setDesenEditorVariantStyleProperty",
]);
const CONTENT_TYPE_EXPORTS = Object.freeze([
  "DesenEditorContentEditDiagnostic",
  "DesenEditorContentEditDiagnosticCode",
  "DesenEditorContentEditFailure",
  "DesenEditorContentEditResult",
  "DesenEditorContentEditSuccess",
  "DesenEditorContentPredicate",
  "DesenEditorContentValue",
  "DesenEditorContentVariant",
  "DesenEditorNodeConditionClearCommand",
  "DesenEditorNodeConditionSetCommand",
  "DesenEditorOwnerPropDeleteCommand",
  "DesenEditorOwnerPropSetCommand",
  "DesenEditorOwnerStylePropertyDeleteCommand",
  "DesenEditorOwnerStylePropertySetCommand",
  "DesenEditorVariantConditionSetCommand",
  "DesenEditorVariantDeleteCommand",
  "DesenEditorVariantInsertCommand",
  "DesenEditorVariantPropDeleteCommand",
  "DesenEditorVariantPropSetCommand",
  "DesenEditorVariantReorderCommand",
  "DesenEditorVariantStylePropertyDeleteCommand",
  "DesenEditorVariantStylePropertySetCommand",
]);
const STATE_BINDING_RUNTIME_EXPORTS = Object.freeze([
  "deleteDesenEditorResourceInput",
  "deleteDesenEditorStateDeclaration",
  "insertDesenEditorStateDeclaration",
  "setDesenEditorNodeRepeatItems",
  "setDesenEditorNodeRepeatKey",
  "setDesenEditorResourceInput",
  "setDesenEditorStateInitial",
  "setDesenEditorStateSchema",
]);
const STATE_BINDING_TYPE_EXPORTS = Object.freeze([
  "DesenEditorBindingValue",
  "DesenEditorNodeRepeatItemsSetCommand",
  "DesenEditorNodeRepeatKeySetCommand",
  "DesenEditorResourceInputDeleteCommand",
  "DesenEditorResourceInputSetCommand",
  "DesenEditorStateBindingEditDiagnostic",
  "DesenEditorStateBindingEditDiagnosticCode",
  "DesenEditorStateBindingEditFailure",
  "DesenEditorStateBindingEditResult",
  "DesenEditorStateBindingEditSuccess",
  "DesenEditorStateDeclaration",
  "DesenEditorStateDeclarationDeleteCommand",
  "DesenEditorStateDeclarationInsertCommand",
  "DesenEditorStateInitialSetCommand",
  "DesenEditorStateSchemaSetCommand",
]);
const EVENT_ACTION_RUNTIME_EXPORTS = Object.freeze([
  "deleteDesenEditorAction",
  "deleteDesenEditorEventHandler",
  "insertDesenEditorAction",
  "insertDesenEditorEventHandler",
  "reorderDesenEditorAction",
  "replaceDesenEditorAction",
]);
const EVENT_ACTION_TYPE_EXPORTS = Object.freeze([
  "DesenEditorAction",
  "DesenEditorActionDeleteCommand",
  "DesenEditorActionInsertCommand",
  "DesenEditorActionListPointer",
  "DesenEditorActionPointer",
  "DesenEditorActionReorderCommand",
  "DesenEditorActionReplaceCommand",
  "DesenEditorEventActionEditDiagnostic",
  "DesenEditorEventActionEditDiagnosticCode",
  "DesenEditorEventActionEditFailure",
  "DesenEditorEventActionEditResult",
  "DesenEditorEventActionEditSuccess",
  "DesenEditorEventHandlerDeleteCommand",
  "DesenEditorEventHandlerInsertCommand",
]);
const PERSISTENCE_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorPersistencePort"]);
const PERSISTENCE_TYPE_EXPORTS = Object.freeze([
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
]);
const CONTINUOUS_VALIDATION_RUNTIME_EXPORTS = Object.freeze([
  "createDesenEditorContinuousValidator",
]);
const CONTINUOUS_VALIDATION_TYPE_EXPORTS = Object.freeze([
  "DesenEditorContinuousValidationReport",
  "DesenEditorContinuousValidator",
  "DesenEditorContinuousValidatorCreationFailure",
  "DesenEditorContinuousValidatorCreationResult",
  "DesenEditorContinuousValidatorCreationSuccess",
  "DesenEditorInvalidSubjectMapping",
]);
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreStableIdInsertProofError && error.code === code;
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
  built = await buildEditorCoreStableIdInsertEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates the exact frozen M08-T01 artifact without a live reader input", async () => {
  assert.equal(built.artifactBytes.byteLength, 19_561);
  assert.equal(
    built.artifactSha256,
    "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
  );
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-stable-id-insert");
  assert.equal(built.artifact.profile, "desen.editor-core.stable-id-insert-proof.v1");
  assert.equal(built.artifact.task, "M08-T02");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, {
    ...EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN,
    result: "PASS",
    authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
    liveProofReaderInput: false,
    sequence29HeadInput: false,
  });
  assert.equal(
    built.artifact.trackedBoundary.receipts.some(({ path: receiptPath }) =>
      receiptPath.includes("proof-reader"),
    ),
    false,
  );
  assert.deepEqual(built.artifact.executionAuthority, {
    ...built.artifact.executionAuthority,
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: 25,
    editorFiles: 4,
    dependencyFiles: 21,
    dependencyModules: 19,
    dependencyManifests: 2,
    prerequisite: {
      task: "M08-T01",
      path: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.path,
      sha256: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.sha256,
    },
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
  assert.equal(built.artifact.executionAuthority.editorReceipts.length, 4);
  assert.equal(built.artifact.executionAuthority.dependencyReceipts.length, 21);
  assert.equal(
    built.artifact.executionAuthority.dependencyReceipts.some(
      ({ path: receiptPath }) => receiptPath === "packages/validator/dist/index.js",
    ),
    true,
  );
  const prerequisite = JSON.parse(
    await readFile(path.join(ROOT, EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.path), "utf8"),
  );
  const dependencyPaths = new Set(
    built.artifact.executionAuthority.dependencyReceipts.map(
      ({ path: receiptPath }) => receiptPath,
    ),
  );
  const prerequisiteDependencyReceipts = prerequisite.evidence.trackedFiles
    .filter(({ path: receiptPath }) => dependencyPaths.has(receiptPath))
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  assert.deepEqual(
    built.artifact.executionAuthority.dependencyReceipts,
    prerequisiteDependencyReceipts,
  );
  const trackedReceipts = new Map(
    built.artifact.trackedBoundary.receipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const receipt of [
    ...built.artifact.executionAuthority.editorReceipts,
    ...built.artifact.executionAuthority.dependencyReceipts,
  ]) {
    assert.deepEqual(trackedReceipts.get(receipt.path), receipt);
  }
  assert.deepEqual(
    built.currentCompatibility.boundary.additiveRuntimeExports,
    [
      ...CONTENT_RUNTIME_EXPORTS,
      ...STATE_BINDING_RUNTIME_EXPORTS,
      ...EVENT_ACTION_RUNTIME_EXPORTS,
      ...PERSISTENCE_RUNTIME_EXPORTS,
      ...CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
      "deleteDesenEditorNode",
      "moveDesenEditorNode",
      "reorderDesenEditorNode",
    ].sort(),
  );
  assert.equal(built.currentCompatibility.boundary.additiveTypeExports.length, 78);
  for (const name of [
    ...CONTENT_TYPE_EXPORTS,
    ...STATE_BINDING_TYPE_EXPORTS,
    ...EVENT_ACTION_TYPE_EXPORTS,
    ...PERSISTENCE_TYPE_EXPORTS,
    ...CONTINUOUS_VALIDATION_TYPE_EXPORTS,
  ]) {
    assert.equal(built.currentCompatibility.boundary.additiveTypeExports.includes(name), true);
  }
  assert.deepEqual(built.currentCompatibility.boundary.additiveSuccessor, {
    task: "M08-T08",
    sourcePath: PERSISTENCE_SOURCE,
    runtimePath: "packages/editor-core/dist/persistence.js",
    declarationPath: "packages/editor-core/dist/persistence.d.ts",
    focusedTestPath: PERSISTENCE_TEST,
    focusedTypesPath: PERSISTENCE_TYPES,
    runtimeExports: PERSISTENCE_RUNTIME_EXPORTS,
    typeExports: PERSISTENCE_TYPE_EXPORTS,
    publicRuntimeCasesAdded: 3,
    publicCompilerNegativeAssertionsAdded: 21,
  });
  assert.deepEqual(built.currentCompatibility.boundary.proofOnlySuccessor, {
    task: "M08-T07",
    runtimeExports: [],
    typeExports: [],
    focusedTestPath: AUTHORING_ROUND_TRIP_TEST,
    focusedTypesPath: AUTHORING_ROUND_TRIP_TYPES,
    publicRuntimeCasesAdded: 2,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.deepEqual(built.currentCompatibility.boundary.terminalProofSuccessor, {
    task: "M08-T10",
    authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
    focusedTestPath: TERMINAL_INTEGRATION_TEST,
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    focusedRuntimeCases: 4,
    publicRuntimeCasesAdded: 0,
    publicCompilerNegativeAssertionsAdded: 0,
  });
  assert.equal(built.currentCompatibility.boundary.additiveSuccessors.length, 6);
  assert.equal(built.currentCompatibility.boundary.currentPackageRuntimeExports.length, 35);
  assert.equal(built.currentCompatibility.boundary.currentPackageTypeExports.length, 88);
  assert.equal(built.currentCompatibility.executionAuthority.runtimeFiles, 23);
  assert.equal(built.currentCompatibility.executionAuthority.editorFiles, 2);
  assert.equal(built.currentCompatibility.executionAuthority.dependencyFiles, 21);
  assert.equal(built.currentCompatibility.testAuthority.publicRuntimeCases, 50);
  assert.equal(built.currentCompatibility.testAuthority.publicCompilerNegativeAssertions, 102);
  assert.equal(built.currentCompatibility.testAuthority.terminalIntegrationRuntimeCases, 4);
  assert.deepEqual(built.currentCompatibility.frozenAuthority, {
    path: "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
    bytes: 19_561,
    sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
    retainedTaskTimeReceipts: 43,
  });
});

test("[determinism] two fresh M08-T02 builds are byte-identical", async () => {
  const first = await buildEditorCoreStableIdInsertEvidence();
  const second = await buildEditorCoreStableIdInsertEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
  assert.deepEqual(first.currentCompatibility, second.currentCompatibility);
});

test("[behavior] proves allocation, ordering, node and behavior targets, limits, and atomic failures", () => {
  assert.deepEqual(built.artifact.behavior.allocation, {
    base: "sign-in.help",
    lowestFreeCollision: "sign-in.title-3",
    surfaceLocal: "sign-in.title",
    behaviorReserved: "sign-in.sortable-2",
  });
  assert.deepEqual(built.artifact.behavior.insertion, {
    exactOrderedBoundary: 2,
    insertedNodeKeys: ["id", "use"],
    nodeTarget: true,
    behaviorTarget: true,
    absentSlotAtZero: true,
    prototypeNamedSlotOwnData: true,
  });
  assert.deepEqual(built.artifact.behavior.limits, {
    capabilityIdCodeUnits: 4_096,
    canonicalDocumentBytes: 8_388_608,
    identitiesPerTargetSurface: 25_000,
    sourceTreeDepth: 64,
    rootDepth: 0,
    exactCeilingsPass: true,
    oneUnitCrossingsFail: true,
    exactIdentityResultCount: 25_000,
  });
  assert.equal(built.artifact.behavior.immutability.atomicFailure, true);
  assert.equal(built.artifact.behavior.diagnostics.failuresExposeNoDocumentOrIdentity, true);
});

test("[mutation] rejects runtime substitution and tracked boundary mutation", async () => {
  let runtimeExecuted = false;
  const runtime = {
    createDesenEditorDocument(input) {
      runtimeExecuted = true;
      return editorCore.createDesenEditorDocument(input);
    },
    insertDesenEditorNode(document, command) {
      runtimeExecuted = true;
      const result = editorCore.insertDesenEditorNode(document, command);
      if (!result.ok) return result;
      return { ...result, insertedNodeId: "mutated.id" };
    },
  };
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({ runtime }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  assert.equal(runtimeExecuted, false);

  const source = await readFile(path.join(ROOT, INSERT_SOURCE));
  const structuralEditsSource = await readFile(path.join(ROOT, STRUCTURAL_EDITS_SOURCE));
  const contentEditsSource = await readFile(path.join(ROOT, CONTENT_EDITS_SOURCE));
  const persistenceSource = await readFile(path.join(ROOT, PERSISTENCE_SOURCE));
  const authoringRoundTripTest = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TEST));
  const authoringRoundTripTypes = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TYPES));
  const persistenceTest = await readFile(path.join(ROOT, PERSISTENCE_TEST));
  const persistenceTypes = await readFile(path.join(ROOT, PERSISTENCE_TYPES));
  const persistenceRuntime = await readFile(
    path.join(ROOT, "packages/editor-core/dist/persistence.js"),
  );
  const publicTest = await readFile(path.join(ROOT, PUBLIC_TEST));
  const publicTypes = await readFile(path.join(ROOT, PUBLIC_TYPES));
  const rootTest = await readFile(path.join(ROOT, ROOT_TEST));
  const dependency = await readFile(path.join(ROOT, PROTOCOL_RUNTIME));
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [INSERT_SOURCE]: changedByte(source) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [STRUCTURAL_EDITS_SOURCE]: changedByte(structuralEditsSource) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [CONTENT_EDITS_SOURCE]: changedByte(contentEditsSource) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [PERSISTENCE_SOURCE]: changedByte(persistenceSource) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [AUTHORING_ROUND_TRIP_TEST]: changedByte(authoringRoundTripTest) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [AUTHORING_ROUND_TRIP_TYPES]: changedByte(authoringRoundTripTypes) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [PERSISTENCE_TEST]: changedByte(persistenceTest) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [PERSISTENCE_TYPES]: changedByte(persistenceTypes) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: {
        "packages/editor-core/dist/persistence.js": changedByte(persistenceRuntime),
      },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  for (const [relativePath, bytes] of [
    [PUBLIC_TEST, publicTest],
    [PUBLIC_TYPES, publicTypes],
    [ROOT_TEST, rootTest],
  ]) {
    await assert.rejects(
      buildEditorCoreStableIdInsertEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [PROTOCOL_RUNTIME]: changedByte(dependency) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const directory = await temporaryDirectory("desen-m08-t02-proof-preflight-");
  const proofDocumentPath = path.join(directory, "proof.md");
  await writeFile(proofDocumentPath, proofDocumentBytes);
  const authorityOpen = test.mock.method(fsPromises, "open");
  syncBuiltinESMExports();
  try {
    const verified = await verifyEditorCoreStableIdInsertEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentPath,
    });
    assert.equal(verified.result, "PASS");
    assert.equal(verified.artifactSha256, built.artifactSha256);

    assert.equal(
      authorityOpen.mock.calls.filter(({ arguments: values }) => values[0] === proofDocumentPath)
        .length,
      2,
      "A path-backed proof must be acquired again after the complete fresh build.",
    );
    const readsAfterPositive = authorityOpen.mock.callCount();
    await assert.rejects(
      verifyEditorCoreStableIdInsertEvidence({
        artifactBytes: changedByte(built.artifactBytes),
        proofDocumentBytes,
      }),
      expectedError("ARTIFACT_DRIFT"),
    );
    assert.ok(authorityOpen.mock.callCount() > readsAfterPositive);
    const readsBeforeMalformedProofs = authorityOpen.mock.callCount();

    await assert.rejects(
      verifyEditorCoreStableIdInsertEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
    for (const invalidProofDocumentBytes of [
      `<!-- Final artifact: \`sha256:${built.artifactSha256}\` -->\n`,
      `\`\`\`text\nFinal artifact: \`sha256:${built.artifactSha256}\`\n\`\`\`\n`,
      `    Final artifact: \`sha256:${built.artifactSha256}\`\n`,
      `\tFinal artifact: \`sha256:${built.artifactSha256}\`\n`,
      `<template>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</template>\n`,
      `<div hidden>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</div>\n`,
      `<details>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</details>\n`,
      `Status: FAIL\nFinal artifact: \`sha256:${built.artifactSha256}\`\n`,
      `sha256:PENDING\nFinal artifact: \`sha256:${built.artifactSha256}\`\n`,
    ]) {
      await assert.rejects(
        verifyEditorCoreStableIdInsertEvidence({
          artifactBytes: built.artifactBytes,
          proofDocumentBytes: invalidProofDocumentBytes,
        }),
        expectedError("PROOF_PIN_DRIFT"),
      );
    }
    for (const malformedPin of ["short", "A".repeat(64), "0".repeat(63)]) {
      await assert.rejects(
        verifyEditorCoreStableIdInsertEvidence({
          artifactBytes: built.artifactBytes,
          proofDocumentBytes: exactProofDocument(malformedPin),
        }),
        expectedError("PROOF_PIN_DRIFT"),
      );
    }
    // Structural invalidity wins over a second artifact fault without entering build authority.
    await assert.rejects(
      verifyEditorCoreStableIdInsertEvidence({
        artifactBytes: changedByte(built.artifactBytes),
        proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
    await assert.rejects(
      verifyEditorCoreStableIdInsertEvidence({
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
      verifyEditorCoreStableIdInsertEvidence({
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
  const directory = await temporaryDirectory("desen-m08-t02-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCoreStableIdInsertEvidence({
      destinationPath,
      beforeAtomicRename() {
        throw new Error("blocked before rename");
      },
    }),
    /blocked before rename/,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");

  const result = await writeEditorCoreStableIdInsertEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[writer-filesystem] rejects symlink, hard-link, and non-file destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t02-destination-");
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
        writeEditorCoreStableIdInsertEvidence({ destinationPath }),
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

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m08-t02-authority-");
  const prerequisite = path.join(ROOT, EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.path);
  const prerequisiteCopy = path.join(directory, "prerequisite-copy.json");
  const prerequisiteLink = path.join(directory, "prerequisite.json");
  await writeFile(prerequisiteCopy, await readFile(prerequisite));
  await symlink(prerequisiteCopy, prerequisiteLink);
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({ prerequisitePath: prerequisiteLink }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  const prerequisiteHardLink = path.join(directory, "prerequisite-hard.json");
  await link(prerequisiteCopy, prerequisiteHardLink);
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({ prerequisitePath: prerequisiteHardLink }),
    expectedError("FILESYSTEM_UNSAFE"),
  );

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(artifactTarget, artifactLink);
  await symlink(proofTarget, proofLink);
  await assert.rejects(
    verifyEditorCoreStableIdInsertEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreStableIdInsertEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofLink,
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
  const runtimeAccessor = {};
  Object.defineProperty(runtimeAccessor, "createDesenEditorDocument", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      return editorCore.createDesenEditorDocument;
    },
  });
  Object.defineProperty(runtimeAccessor, "insertDesenEditorNode", {
    enumerable: true,
    value: editorCore.insertDesenEditorNode,
  });
  for (const options of [
    { unknown: true },
    accessor,
    inherited,
    symbol,
    proxy,
    { prerequisiteBytes: shared },
    { runtime: runtimeAccessor },
  ]) {
    await assert.rejects(
      buildEditorCoreStableIdInsertEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeEditorCoreStableIdInsertEvidence({
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
    "M08-T03_DELETE_MOVE_AND_ORDERED_REORDER",
    "LATER_AUTHORING_SELECTION_VIEWPORT_POLICY",
    "M08_T04_THROUGH_T08_AUTHORING_AND_PERSISTENCE",
    "M08-T09_CATALOG_SEMANTICS_AND_CONTINUOUS_DIAGNOSTICS",
    "M08-T10_AND_G08_TERMINAL_UI_BOUNDARY",
    "HOSTILE_JAVASCRIPT_SANDBOX",
    "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
    "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    "P18_OR_G08_ADVANCEMENT",
  ]);
  assert.deepEqual(
    EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES,
    EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES.slice(),
  );
});
