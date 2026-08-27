import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
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
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import * as editorCore from "../packages/editor-core/dist/index.js";
import {
  EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN,
  EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS,
  EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES,
  EditorCoreStateBindingEditsProofError,
  buildEditorCoreStateBindingEditsEvidence,
  verifyEditorCoreStateBindingEditsEvidence,
  writeEditorCoreStateBindingEditsEvidence,
} from "../scripts/lib/editor-core-state-binding-edits-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE_BINDING_SOURCE = "packages/editor-core/src/state-binding-edits.ts";
const PROTOCOL_RUNTIME = "packages/protocol/dist/index.js";
const AUTHORING_ROUND_TRIP_TEST = "packages/editor-core/test/authoring-round-trip.test.ts";
const AUTHORING_ROUND_TRIP_TYPES = "packages/editor-core/test/authoring-round-trip.types.ts";
const PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
const PERSISTENCE_RUNTIME = "packages/editor-core/dist/persistence.js";
const PERSISTENCE_DECLARATION = "packages/editor-core/dist/persistence.d.ts";
const PERSISTENCE_TEST = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES = "packages/editor-core/test/persistence.types.ts";
const PERSISTENCE_SUCCESSOR_PATHS = Object.freeze([
  PERSISTENCE_SOURCE,
  PERSISTENCE_RUNTIME,
  `${PERSISTENCE_RUNTIME}.map`,
  PERSISTENCE_DECLARATION,
  `${PERSISTENCE_DECLARATION}.map`,
  PERSISTENCE_TEST,
  PERSISTENCE_TYPES,
]);
const CONTINUOUS_VALIDATION_SOURCE = "packages/editor-core/src/continuous-validation.ts";
const CONTINUOUS_VALIDATION_RUNTIME = "packages/editor-core/dist/continuous-validation.js";
const CONTINUOUS_VALIDATION_DECLARATION = "packages/editor-core/dist/continuous-validation.d.ts";
const CONTINUOUS_VALIDATION_TEST = "packages/editor-core/test/continuous-validation.test.ts";
const CONTINUOUS_VALIDATION_TYPES = "packages/editor-core/test/continuous-validation.types.ts";
const CONTINUOUS_VALIDATION_SUCCESSOR_PATHS = Object.freeze([
  CONTINUOUS_VALIDATION_SOURCE,
  CONTINUOUS_VALIDATION_RUNTIME,
  `${CONTINUOUS_VALIDATION_RUNTIME}.map`,
  CONTINUOUS_VALIDATION_DECLARATION,
  `${CONTINUOUS_VALIDATION_DECLARATION}.map`,
  CONTINUOUS_VALIDATION_TEST,
  CONTINUOUS_VALIDATION_TYPES,
]);
const RETAINED_CONTENT_RUNTIME_EXPORTS = Object.freeze(
  [
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
  ].sort(),
);
const STATE_BINDING_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorResourceInput",
    "deleteDesenEditorStateDeclaration",
    "insertDesenEditorStateDeclaration",
    "setDesenEditorNodeRepeatItems",
    "setDesenEditorNodeRepeatKey",
    "setDesenEditorResourceInput",
    "setDesenEditorStateInitial",
    "setDesenEditorStateSchema",
  ].sort(),
);
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "insertDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    ...RETAINED_CONTENT_RUNTIME_EXPORTS,
    ...STATE_BINDING_RUNTIME_EXPORTS,
  ].sort(),
);
const STATE_BINDING_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID",
  "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
  "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
]);
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreStateBindingEditsProofError && error.code === code;
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

function authorityOption(task, suffix) {
  return task === "M08-T02" ? `t02Prerequisite${suffix}` : `t04Compatibility${suffix}`;
}

before(async () => {
  built = await buildEditorCoreStateBindingEditsEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates exact M08-T02 prerequisite, M08-T04 graph compatibility, and isolated runtime", async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-state-binding-edits");
  assert.equal(built.artifact.profile, "desen.editor-core.state-binding-edits-proof.v1");
  assert.equal(built.artifact.task, "M08-T05");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(
    built.artifact.prerequisites,
    EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS.map((pin) => ({
      ...pin,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      liveProofReaderInput: false,
      checkpointHeadInput: false,
    })),
  );
  assert.deepEqual(built.artifact.claim, {
    protocol: "0.1.0",
    platform: "platform-neutral",
    immutableStateBindingEditCommands: true,
    stableIdentityPreserved: true,
    taskStatus: "DONE",
    prerequisiteTasks: ["M08-T02"],
    prerequisiteStatuses: ["DONE"],
  });
  assert.deepEqual(built.artifact.currentGraphCompatibility, {
    ...EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN,
    result: "PASS",
    authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
    embeddedPrerequisiteChain: [
      {
        ...EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS[0],
      },
      {
        task: "M08-T03",
        path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
        bytes: 22_402,
        sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
      },
    ],
    widensOfficialPrerequisites: false,
  });
  assert.deepEqual(built.artifact.publicApi.runtimeExports, EXPECTED_RUNTIME_EXPORTS);
  assert.equal(built.artifact.publicApi.stateBindingPublicDeclarations, 23);
  assert.equal(built.artifact.publicApi.stateBindingTsdocDeclarations, 23);
  assert.deepEqual(built.artifact.executionAuthority, {
    ...built.artifact.executionAuthority,
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: 28,
    editorFiles: 7,
    retainedPredecessorEditorFiles: 4,
    dependencyFiles: 21,
    dependencyModules: 19,
    dependencyManifests: 2,
    prerequisites: EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS.map((pin) => ({
      task: pin.task,
      path: pin.path,
      sha256: pin.sha256,
    })),
    currentGraphCompatibility: {
      task: EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.task,
      path: EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.path,
      sha256: EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.sha256,
      widensOfficialPrerequisites: false,
    },
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
  assert.equal(built.artifact.executionAuthority.editorReceipts.length, 7);
  assert.equal(built.artifact.executionAuthority.dependencyReceipts.length, 21);

  const t04Artifact = JSON.parse(
    await readFile(
      path.join(ROOT, EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.path),
      "utf8",
    ),
  );
  assert.deepEqual(
    built.artifact.executionAuthority.dependencyReceipts,
    t04Artifact.executionAuthority.dependencyReceipts,
  );
  const retainedEditorReceipts = new Map(
    t04Artifact.executionAuthority.editorReceipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const receipt of built.artifact.executionAuthority.editorReceipts.filter(({ path: name }) =>
    ["source-document.js", "stable-id-insert.js", "structural-edits.js", "content-edits.js"].some(
      (fileName) => name.endsWith(fileName),
    ),
  )) {
    assert.deepEqual(receipt, retainedEditorReceipts.get(receipt.path));
  }
  const trackedReceipts = new Map(
    built.artifact.trackedBoundary.receipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const receipt of [
    ...built.artifact.executionAuthority.editorReceipts,
    ...built.artifact.executionAuthority.dependencyReceipts,
  ]) {
    assert.deepEqual(trackedReceipts.get(receipt.path), receipt);
  }
  assert.deepEqual(built.currentCompatibility.publicApi.proofOnlySuccessor, {
    task: "M08-T07",
    focusedTestPath: AUTHORING_ROUND_TRIP_TEST,
    focusedTypesPath: AUTHORING_ROUND_TRIP_TYPES,
    runtimeExportsAdded: 0,
    typeExportsAdded: 0,
    publicRuntimeCasesAdded: 2,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.deepEqual(built.currentCompatibility.publicApi.additiveSuccessor, {
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
  });
  assert.deepEqual(built.currentCompatibility.publicApi.continuousValidationSuccessor, {
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
    focusedBehaviorCasesAdded: 12,
    focusedCompilerNegativeAssertionsAdded: 9,
    publicRuntimeCasesAdded: 1,
    publicCompilerNegativeAssertionsAdded: 6,
  });
  assert.equal(built.currentCompatibility.publicApi.currentPackageRuntimeExports.length, 35);
  assert.equal(built.currentCompatibility.publicApi.currentPackageTypeExports.length, 88);
  assert.equal(built.currentCompatibility.testAuthority.publicRuntimeAndRootCases, 50);
  assert.equal(built.currentCompatibility.testAuthority.publicCompilerNegativeAssertions, 102);
  assert.equal(built.currentCompatibility.frozenAuthority.retainedTaskTimeReceipts, 64);
  const currentReceipts = new Set(
    built.currentCompatibility.trackedBoundary.receipts.map(({ path: receiptPath }) => receiptPath),
  );
  assert.equal(currentReceipts.has(AUTHORING_ROUND_TRIP_TEST), true);
  assert.equal(currentReceipts.has(AUTHORING_ROUND_TRIP_TYPES), true);
  for (const relativePath of PERSISTENCE_SUCCESSOR_PATHS) {
    assert.equal(currentReceipts.has(relativePath), true);
  }
  for (const relativePath of CONTINUOUS_VALIDATION_SUCCESSOR_PATHS) {
    assert.equal(currentReceipts.has(relativePath), true);
  }
});

test("[determinism] two fresh M08-T05 builds are byte-identical", async () => {
  const first = await buildEditorCoreStateBindingEditsEvidence();
  const second = await buildEditorCoreStateBindingEditsEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("[behavior] proves eight state/binding commands, stable identity, limits, and atomic diagnostics", () => {
  assert.deepEqual(built.artifact.behavior.commands, {
    functions: STATE_BINDING_RUNTIME_EXPORTS,
    executed: 8,
    stateDeclarationLifecycle: true,
    repeatItemsAndKey: true,
    resourceInputSetAndDelete: true,
  });
  assert.deepEqual(built.artifact.behavior.stateAndBindings, {
    dottedDeclarationsRemainData: true,
    initialMarkerShapesRemainInert: true,
    noReferenceOrActionCascade: true,
    repeatAliasLimitAndExtensionsPreserved: true,
    emptyRequiredMapsRetained: true,
    unresolvedSemanticsPreservedForM08T09: true,
  });
  assert.deepEqual(built.artifact.behavior.identityAndData, {
    stableIdsUnchanged: true,
    identities: [
      "sign-in.email",
      "sign-in.error",
      "sign-in.layout",
      "sign-in.password",
      "sign-in.submit",
      "sign-in.title",
    ],
    prototypeSensitiveNamesAreOwnData: true,
    callerInputsDetached: true,
  });
  assert.deepEqual(built.artifact.behavior.limits, {
    canonicalDocumentBytes: 8_388_608,
    identitiesPerTargetSurface: 25_000,
    sourceTreeDepth: 64,
    rootDepth: 0,
    exactCeilingsPass: true,
    oneUnitCrossingsFail: true,
  });
  assert.deepEqual(built.artifact.behavior.diagnostics, {
    editorCodes: STATE_BINDING_DIAGNOSTIC_CODES,
    structuralPassThrough: "SCHEMA_INVALID",
    missingExistingAmbiguousAndPathFailClosed: true,
    commandShapeBoundary: "OWN_ENUMERABLE_DATA_DESCRIPTORS",
    accessorAndToJsonHooksRejectedWithoutInvocation: true,
    proxyReflectionMayInvokeTraps: true,
    forwardingProxyAdmitted: true,
    forwardingProxyTrapOrder: [
      "getPrototypeOf",
      "ownKeys",
      "getOwnPropertyDescriptor:name",
      "getOwnPropertyDescriptor:resourceId",
      "getOwnPropertyDescriptor:surfaceId",
      "getOwnPropertyDescriptor:value",
    ],
    throwingProxyContainedAsCommandInvalid: true,
    throwingProxyTrapOrder: ["getPrototypeOf"],
    throwingProxyFailureLeavesPriorSourceUnchanged: true,
    failuresExposeNoDocument: true,
  });
  assert.deepEqual(built.artifact.behavior.immutability, {
    inputDocumentsUnchanged: true,
    commandsNotRetained: true,
    freshDetachedSuccess: true,
    recursivelyFrozenResults: true,
    atomicFailure: true,
  });
});

test("[mutation] rejects runtime substitution and tracked boundary mutation", async () => {
  let runtimeExecuted = false;
  const runtime = Object.fromEntries(
    ["createDesenEditorDocument", ...STATE_BINDING_RUNTIME_EXPORTS].map((name) => [
      name,
      (...args) => {
        runtimeExecuted = true;
        return editorCore[name](...args);
      },
    ]),
  );
  await assert.rejects(
    buildEditorCoreStateBindingEditsEvidence({ runtime }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  assert.equal(runtimeExecuted, false);

  const source = await readFile(path.join(ROOT, STATE_BINDING_SOURCE));
  const dependency = await readFile(path.join(ROOT, PROTOCOL_RUNTIME));
  const authoringTest = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TEST));
  const authoringTypes = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TYPES));
  await assert.rejects(
    buildEditorCoreStateBindingEditsEvidence({
      fileOverrides: { [STATE_BINDING_SOURCE]: changedByte(source) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStateBindingEditsEvidence({
      fileOverrides: { [PROTOCOL_RUNTIME]: changedByte(dependency) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  for (const [relativePath, bytes] of [
    [AUTHORING_ROUND_TRIP_TEST, authoringTest],
    [AUTHORING_ROUND_TRIP_TYPES, authoringTypes],
  ]) {
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
  for (const relativePath of PERSISTENCE_SUCCESSOR_PATHS) {
    const bytes = await readFile(path.join(ROOT, relativePath));
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreStateBindingEditsEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.deepEqual(
    verified.prerequisiteSha256s,
    EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS.map(({ sha256 }) => sha256),
  );
  assert.equal(
    verified.currentGraphCompatibilitySha256,
    EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.sha256,
  );

  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Hidden pin\n\n<!-- Final artifact: \`sha256:${built.artifactSha256}\` -->\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Fenced pin\n\n\`\`\`text\nFinal artifact: \`sha256:${built.artifactSha256}\`\n\`\`\`\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Space-indented pin\n\n    Final artifact: \`sha256:${built.artifactSha256}\`\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Tab-indented pin\n\n\tFinal artifact: \`sha256:${built.artifactSha256}\`\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  for (const invalidProofDocumentBytes of [
    `# Template pin\n\n<template>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</template>\n`,
    `# Hidden pin\n\n<div hidden>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</div>\n`,
    `# Collapsed pin\n\n<details>\nFinal artifact: \`sha256:${built.artifactSha256}\`\n</details>\n`,
    `${proofDocumentBytes}\nStatus: FAIL\n`,
    `${proofDocumentBytes}\nsha256:PENDING\n`,
  ]) {
    await assert.rejects(
      verifyEditorCoreStateBindingEditsEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentBytes: invalidProofDocumentBytes,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[writer] atomically commits exact bytes and preserves the previous destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t05-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCoreStateBindingEditsEvidence({
      destinationPath,
      beforeAtomicRename() {
        throw new Error("blocked before rename");
      },
    }),
    /blocked before rename/,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");

  const result = await writeEditorCoreStateBindingEditsEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[writer-filesystem] rejects symlink, hard-link, and non-file destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t05-destination-");
  const target = path.join(directory, "target.json");
  const symbolic = path.join(directory, "symbolic.json");
  const hard = path.join(directory, "hard.json");
  const nonFile = path.join(directory, "directory.json");
  await writeFile(target, "target\n");
  await symlink(target, symbolic);
  await link(target, hard);
  await mkdir(nonFile);
  for (const destinationPath of [symbolic, hard, nonFile]) {
    await assert.rejects(
      writeEditorCoreStateBindingEditsEvidence({ destinationPath }),
      expectedError("FILESYSTEM_UNSAFE"),
    );
  }
});

test("[filesystem] rejects linked artifact/proof and linked, replaced, or raced prerequisites", async () => {
  const directory = await temporaryDirectory("desen-m08-t05-authority-");
  for (const pin of [
    ...EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS,
    EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN,
  ]) {
    const label = pin.task.toLowerCase();
    const prerequisiteBytes = await readFile(path.join(ROOT, pin.path));
    const prerequisiteCopy = path.join(directory, `${label}-copy.json`);
    const prerequisiteSymbolic = path.join(directory, `${label}-symbolic.json`);
    await writeFile(prerequisiteCopy, prerequisiteBytes);
    await symlink(prerequisiteCopy, prerequisiteSymbolic);
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        [authorityOption(pin.task, "Path")]: prerequisiteSymbolic,
      }),
      expectedError("FILESYSTEM_UNSAFE"),
    );

    const hardTarget = path.join(directory, `${label}-hard-target.json`);
    const prerequisiteHard = path.join(directory, `${label}-hard.json`);
    await writeFile(hardTarget, prerequisiteBytes);
    await link(hardTarget, prerequisiteHard);
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        [authorityOption(pin.task, "Path")]: prerequisiteHard,
      }),
      expectedError("FILESYSTEM_UNSAFE"),
    );

    const swappedAuthority = path.join(directory, `${label}-swapped.json`);
    const heldAuthority = path.join(directory, `${label}-held.json`);
    const replacementAuthority = path.join(directory, `${label}-replacement.json`);
    await writeFile(swappedAuthority, prerequisiteBytes);
    await writeFile(replacementAuthority, "replacement\n");
    let swapped = false;
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        [authorityOption(pin.task, "Path")]: swappedAuthority,
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

    const authorityParent = path.join(directory, `${label}-authority-parent`);
    const heldParent = path.join(directory, `${label}-held-parent`);
    const parentAuthority = path.join(authorityParent, "prerequisite.json");
    await mkdir(authorityParent);
    await writeFile(parentAuthority, prerequisiteBytes);
    let parentRenamed = false;
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence({
        [authorityOption(pin.task, "Path")]: parentAuthority,
        async beforeAuthorityRecheck({ absolutePath }) {
          if (absolutePath !== parentAuthority || parentRenamed) return;
          parentRenamed = true;
          await rename(authorityParent, heldParent);
          await symlink(heldParent, authorityParent);
        },
      }),
      expectedError("FILESYSTEM_UNSAFE"),
    );
    assert.equal(parentRenamed, true);
  }

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactSymbolic = path.join(directory, "artifact-symbolic.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofSymbolic = path.join(directory, "proof-symbolic.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(artifactTarget, artifactSymbolic);
  await symlink(proofTarget, proofSymbolic);
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactPath: artifactSymbolic,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofSymbolic,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );

  const artifactHardTarget = path.join(directory, "artifact-hard-target.json");
  const artifactHard = path.join(directory, "artifact-hard.json");
  const proofHardTarget = path.join(directory, "proof-hard-target.md");
  const proofHard = path.join(directory, "proof-hard.md");
  await writeFile(artifactHardTarget, built.artifactBytes);
  await writeFile(proofHardTarget, exactProofDocument(built.artifactSha256));
  await link(artifactHardTarget, artifactHard);
  await link(proofHardTarget, proofHard);
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactPath: artifactHard,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreStateBindingEditsEvidence({
      artifactPath: artifactTarget,
      proofDocumentPath: proofHard,
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
  for (const name of STATE_BINDING_RUNTIME_EXPORTS) {
    Object.defineProperty(runtimeAccessor, name, { enumerable: true, value: editorCore[name] });
  }
  for (const options of [
    { unknown: true },
    accessor,
    inherited,
    symbol,
    proxy,
    { t02PrerequisiteBytes: shared },
    { t04CompatibilityBytes: shared },
    { runtime: runtimeAccessor },
    { beforeAuthorityRecheck: new Proxy(() => undefined, {}) },
  ]) {
    await assert.rejects(
      buildEditorCoreStateBindingEditsEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeEditorCoreStateBindingEditsEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildEditorCoreStateBindingEditsEvidence({
      beforeAuthorityRecheck() {
        return undefined;
      },
    }),
    expectedError("AUTHORITY_HOOK_REJECTED"),
  );
  assert.equal(getterInvocations, 0);
});

test("[immutability] freezes evidence and states the exact nonclaim boundary", () => {
  assertDeepFrozen(built.artifact);
  assertDeepFrozen(built.currentCompatibility);
  assert.deepEqual(built.artifact.nonclaims, [
    "EVENT_AND_CLOSED_ACTION_EDITING_M08_T06",
    "AUTHORING_ISOLATION_AND_UNKNOWN_EXTENSION_PROOF_M08_T07",
    "PERSISTENCE_M08_T08",
    "STATE_SCHEMA_INITIAL_REFERENCE_REPEAT_AND_CATALOG_SEMANTICS_M08_T09",
    "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
    "M08-T10_AND_G08_TERMINAL_UI_BOUNDARY",
    "HOSTILE_JAVASCRIPT_SANDBOX",
    "NO_PROXY_TRAP_EXECUTION_MEMBRANE",
    "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
    "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    "P18_OR_G08_ADVANCEMENT",
  ]);
  assert.deepEqual(
    EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES,
    EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES.slice(),
  );
});
