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
  EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS,
  EDITOR_CORE_EVENT_ACTION_EDITS_ROOT_TEST_NAMES,
  EditorCoreEventActionEditsProofError,
  buildEditorCoreEventActionEditsEvidence,
  verifyEditorCoreEventActionEditsEvidence,
  writeEditorCoreEventActionEditsEvidence,
} from "../scripts/lib/editor-core-event-action-edits-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const EVENT_ACTION_SOURCE = "packages/editor-core/src/event-action-edits.ts";
const PROTOCOL_RUNTIME = "packages/protocol/dist/index.js";
const AUTHORING_ROUND_TRIP_TEST = "packages/editor-core/test/authoring-round-trip.test.ts";
const AUTHORING_ROUND_TRIP_TYPES = "packages/editor-core/test/authoring-round-trip.types.ts";
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
const EVENT_ACTION_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorAction",
    "deleteDesenEditorEventHandler",
    "insertDesenEditorAction",
    "insertDesenEditorEventHandler",
    "reorderDesenEditorAction",
    "replaceDesenEditorAction",
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
    ...EVENT_ACTION_RUNTIME_EXPORTS,
  ].sort(),
);
const EVENT_ACTION_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID",
  "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
  "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
  "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS",
  "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
]);
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreEventActionEditsProofError && error.code === code;
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

function authorityOption(suffix) {
  return `t05Prerequisite${suffix}`;
}

before(async () => {
  built = await buildEditorCoreEventActionEditsEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates the exact M08-T05 prerequisite and isolated runtime", async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-event-action-edits");
  assert.equal(built.artifact.profile, "desen.editor-core.event-action-edits-proof.v1");
  assert.equal(built.artifact.task, "M08-T06");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(
    built.artifact.prerequisites,
    EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS.map((pin) => ({
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
    immutableEventActionEditCommands: true,
    stableIdentityPreserved: true,
    taskStatus: "DONE",
    prerequisiteTasks: ["M08-T05"],
    prerequisiteStatuses: ["DONE"],
  });
  assert.equal(Object.hasOwn(built.artifact, "currentGraphCompatibility"), false);
  assert.deepEqual(built.artifact.publicApi.runtimeExports, EXPECTED_RUNTIME_EXPORTS);
  assert.equal(built.artifact.publicApi.eventActionPublicDeclarations, 20);
  assert.equal(built.artifact.publicApi.eventActionTsdocDeclarations, 20);
  assert.deepEqual(built.artifact.executionAuthority, {
    ...built.artifact.executionAuthority,
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: 29,
    editorFiles: 8,
    retainedPredecessorEditorFiles: 5,
    dependencyFiles: 21,
    dependencyModules: 19,
    dependencyManifests: 2,
    prerequisites: EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS.map((pin) => ({
      task: pin.task,
      path: pin.path,
      sha256: pin.sha256,
    })),
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
  assert.equal(built.artifact.executionAuthority.editorReceipts.length, 8);
  assert.equal(built.artifact.executionAuthority.dependencyReceipts.length, 21);

  const t05Artifact = JSON.parse(
    await readFile(
      path.join(ROOT, EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS[0].path),
      "utf8",
    ),
  );
  assert.deepEqual(
    built.artifact.executionAuthority.dependencyReceipts,
    t05Artifact.executionAuthority.dependencyReceipts,
  );
  const retainedEditorReceipts = new Map(
    t05Artifact.executionAuthority.editorReceipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const receipt of built.artifact.executionAuthority.editorReceipts.filter(({ path: name }) =>
    [
      "source-document.js",
      "stable-id-insert.js",
      "structural-edits.js",
      "content-edits.js",
      "state-binding-edits.js",
    ].some((fileName) => name.endsWith(fileName)),
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
  assert.equal(built.currentCompatibility.testAuthority.publicRuntimeAndRootCases, 46);
  assert.equal(built.currentCompatibility.testAuthority.publicCompilerNegativeAssertions, 75);
  assert.deepEqual(built.currentCompatibility.frozenAuthority, {
    path: "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
    bytes: 31_310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    retainedTaskTimeReceipts: 76,
  });
  const currentReceipts = new Set(
    built.currentCompatibility.trackedBoundary.receipts.map(({ path: receiptPath }) => receiptPath),
  );
  assert.equal(currentReceipts.has(AUTHORING_ROUND_TRIP_TEST), true);
  assert.equal(currentReceipts.has(AUTHORING_ROUND_TRIP_TYPES), true);
});

test("[determinism] two fresh M08-T06 builds are byte-identical", async () => {
  const first = await buildEditorCoreEventActionEditsEvidence();
  const second = await buildEditorCoreEventActionEditsEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("[behavior] proves six event/action commands, nested actions, limits, and atomic diagnostics", () => {
  assert.deepEqual(built.artifact.behavior.commands, {
    functions: EVENT_ACTION_RUNTIME_EXPORTS,
    executed: 6,
    eventHandlerInsertDelete: true,
    actionInsertReplaceDeleteReorder: true,
    closedActionVariants: 7,
    nestedSettlementEditing: true,
  });
  assert.deepEqual(built.artifact.behavior.eventsAndActions, {
    nodeAndBehaviorOwners: true,
    ownerRelativeRfc6901Pointers: true,
    postRemovalFinalReorderIndex: true,
    emptyEventMapsAndActionListsRetained: true,
    guardsInputsParamsPayloadsAndExtensionsCapturedWhole: true,
    prototypeSensitiveNamesAreOwnData: true,
    unresolvedSemanticsPreservedForM08T09: true,
  });
  assert.deepEqual(built.artifact.behavior.identityAndData, {
    stableIdsUnchanged: true,
    identities: [
      "sign-in.behavior",
      "sign-in.email",
      "sign-in.error",
      "sign-in.layout",
      "sign-in.password",
      "sign-in.submit",
      "sign-in.title",
    ],
    callerInputsDetached: true,
    actionsRemainInertData: true,
  });
  assert.deepEqual(built.artifact.behavior.limits, {
    canonicalDocumentBytes: 8_388_608,
    identitiesPerTargetSurface: 25_000,
    actionsPerTargetOwner: 25_000,
    sourceTreeDepth: 64,
    actionNestingDepth: 64,
    rootDepth: 0,
    exactCeilingsPass: true,
    oneUnitCrossingsFail: true,
  });
  assert.deepEqual(
    {
      ...built.artifact.behavior.diagnostics,
      forwardingProxyTrapOrder: undefined,
    },
    {
      editorCodes: EVENT_ACTION_DIAGNOSTIC_CODES,
      structuralPassThrough: "SCHEMA_INVALID",
      missingExistingAmbiguousPositionAndPathFailClosed: true,
      commandShapeBoundary: "OWN_ENUMERABLE_DATA_DESCRIPTORS",
      accessorAndToJsonHooksRejectedWithoutInvocation: true,
      proxyReflectionMayInvokeTraps: true,
      forwardingProxyAdmitted: true,
      forwardingProxyTrapOrder: undefined,
      throwingProxyContainedAsCommandInvalid: true,
      throwingProxyTrapOrder: ["prototype"],
      throwingProxyFailureLeavesPriorSourceUnchanged: true,
      failuresExposeNoDocument: true,
    },
  );
  assert.equal(
    built.artifact.behavior.diagnostics.forwardingProxyTrapOrder.includes("prototype"),
    true,
  );
  assert.equal(built.artifact.behavior.diagnostics.forwardingProxyTrapOrder.includes("keys"), true);
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
    ["createDesenEditorDocument", ...EVENT_ACTION_RUNTIME_EXPORTS].map((name) => [
      name,
      (...args) => {
        runtimeExecuted = true;
        return editorCore[name](...args);
      },
    ]),
  );
  await assert.rejects(
    buildEditorCoreEventActionEditsEvidence({ runtime }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  assert.equal(runtimeExecuted, false);

  const source = await readFile(path.join(ROOT, EVENT_ACTION_SOURCE));
  const dependency = await readFile(path.join(ROOT, PROTOCOL_RUNTIME));
  const authoringTest = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TEST));
  const authoringTypes = await readFile(path.join(ROOT, AUTHORING_ROUND_TRIP_TYPES));
  await assert.rejects(
    buildEditorCoreEventActionEditsEvidence({
      fileOverrides: { [EVENT_ACTION_SOURCE]: changedByte(source) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreEventActionEditsEvidence({
      fileOverrides: { [PROTOCOL_RUNTIME]: changedByte(dependency) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  for (const [relativePath, bytes] of [
    [AUTHORING_ROUND_TRIP_TEST, authoringTest],
    [AUTHORING_ROUND_TRIP_TYPES, authoringTypes],
  ]) {
    await assert.rejects(
      buildEditorCoreEventActionEditsEvidence({
        fileOverrides: { [relativePath]: changedByte(bytes) },
      }),
      expectedError("BOUNDARY_DRIFT"),
    );
  }
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreEventActionEditsEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);
  assert.deepEqual(
    verified.prerequisiteSha256s,
    EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS.map(({ sha256 }) => sha256),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Hidden pin\n\n<!-- Final artifact: \`sha256:${built.artifactSha256}\` -->\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Fenced pin\n\n\`\`\`text\nFinal artifact: \`sha256:${built.artifactSha256}\`\n\`\`\`\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `# Space-indented pin\n\n    Final artifact: \`sha256:${built.artifactSha256}\`\n`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
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
      verifyEditorCoreEventActionEditsEvidence({
        artifactBytes: built.artifactBytes,
        proofDocumentBytes: invalidProofDocumentBytes,
      }),
      expectedError("PROOF_PIN_DRIFT"),
    );
  }
});

test("[writer] atomically commits exact bytes and preserves the previous destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t06-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCoreEventActionEditsEvidence({
      destinationPath,
      beforeAtomicRename() {
        throw new Error("blocked before rename");
      },
    }),
    /blocked before rename/,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");

  const result = await writeEditorCoreEventActionEditsEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[writer-filesystem] rejects symlink, hard-link, and non-file destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t06-destination-");
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
      writeEditorCoreEventActionEditsEvidence({ destinationPath }),
      expectedError("FILESYSTEM_UNSAFE"),
    );
  }
});

test("[filesystem] rejects linked artifact/proof and linked, replaced, or raced prerequisites", async () => {
  const directory = await temporaryDirectory("desen-m08-t06-authority-");
  for (const pin of EDITOR_CORE_EVENT_ACTION_EDITS_PREREQUISITE_PINS) {
    const label = pin.task.toLowerCase();
    const prerequisiteBytes = await readFile(path.join(ROOT, pin.path));
    const prerequisiteCopy = path.join(directory, `${label}-copy.json`);
    const prerequisiteSymbolic = path.join(directory, `${label}-symbolic.json`);
    await writeFile(prerequisiteCopy, prerequisiteBytes);
    await symlink(prerequisiteCopy, prerequisiteSymbolic);
    await assert.rejects(
      buildEditorCoreEventActionEditsEvidence({
        [authorityOption("Path")]: prerequisiteSymbolic,
      }),
      expectedError("FILESYSTEM_UNSAFE"),
    );

    const hardTarget = path.join(directory, `${label}-hard-target.json`);
    const prerequisiteHard = path.join(directory, `${label}-hard.json`);
    await writeFile(hardTarget, prerequisiteBytes);
    await link(hardTarget, prerequisiteHard);
    await assert.rejects(
      buildEditorCoreEventActionEditsEvidence({
        [authorityOption("Path")]: prerequisiteHard,
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
      buildEditorCoreEventActionEditsEvidence({
        [authorityOption("Path")]: swappedAuthority,
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
      buildEditorCoreEventActionEditsEvidence({
        [authorityOption("Path")]: parentAuthority,
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
    verifyEditorCoreEventActionEditsEvidence({
      artifactPath: artifactSymbolic,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
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
    verifyEditorCoreEventActionEditsEvidence({
      artifactPath: artifactHard,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreEventActionEditsEvidence({
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
  for (const name of EVENT_ACTION_RUNTIME_EXPORTS) {
    Object.defineProperty(runtimeAccessor, name, { enumerable: true, value: editorCore[name] });
  }
  for (const options of [
    { unknown: true },
    accessor,
    inherited,
    symbol,
    proxy,
    { t05PrerequisiteBytes: shared },
    { runtime: runtimeAccessor },
    { beforeAuthorityRecheck: new Proxy(() => undefined, {}) },
  ]) {
    await assert.rejects(
      buildEditorCoreEventActionEditsEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeEditorCoreEventActionEditsEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildEditorCoreEventActionEditsEvidence({
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
    "AUTHORING_ISOLATION_AND_UNKNOWN_EXTENSION_PROOF_M08_T07",
    "PERSISTENCE_M08_T08",
    "EVENT_ACTION_REFERENCE_AND_CATALOG_SEMANTICS_M08_T09",
    "ACTION_EXECUTION_AND_RUNTIME_TURNS",
    "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
    "M08-T10_AND_G08_TERMINAL_UI_BOUNDARY",
    "HOSTILE_JAVASCRIPT_SANDBOX",
    "NO_PROXY_TRAP_EXECUTION_MEMBRANE",
    "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
    "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    "P18_OR_G08_ADVANCEMENT",
  ]);
  assert.deepEqual(
    EDITOR_CORE_EVENT_ACTION_EDITS_ROOT_TEST_NAMES,
    EDITOR_CORE_EVENT_ACTION_EDITS_ROOT_TEST_NAMES.slice(),
  );
});
