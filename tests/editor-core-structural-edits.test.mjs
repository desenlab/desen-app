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
  EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN,
  EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES,
  EditorCoreStructuralEditsProofError,
  buildEditorCoreStructuralEditsEvidence,
  verifyEditorCoreStructuralEditsEvidence,
  writeEditorCoreStructuralEditsEvidence,
} from "../scripts/lib/editor-core-structural-edits-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STRUCTURAL_SOURCE = "packages/editor-core/src/structural-edits.ts";
const PROTOCOL_RUNTIME = "packages/protocol/dist/index.js";
const temporaryDirectories = [];
let built;

function expectedError(code) {
  return (error) => error instanceof EditorCoreStructuralEditsProofError && error.code === code;
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
  built = await buildEditorCoreStructuralEditsEvidence();
});

after(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test("[authority] authenticates the exact frozen M08-T02 artifact and isolated runtime graph", async () => {
  assert.equal(built.artifact.schemaVersion, 1);
  assert.equal(built.artifact.proofId, "editor-core-structural-edits");
  assert.equal(built.artifact.profile, "desen.editor-core.structural-edits-proof.v1");
  assert.equal(built.artifact.task, "M08-T03");
  assert.equal(built.artifact.result, "PASS");
  assert.deepEqual(built.artifact.prerequisite, {
    ...EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN,
    result: "PASS",
    authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
    liveProofReaderInput: false,
    sequence30HeadInput: false,
  });
  assert.deepEqual(built.artifact.executionAuthority, {
    ...built.artifact.executionAuthority,
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: 26,
    editorFiles: 5,
    retainedPredecessorEditorFiles: 2,
    dependencyFiles: 21,
    dependencyModules: 19,
    dependencyManifests: 2,
    prerequisite: {
      task: "M08-T02",
      path: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.path,
      sha256: EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.sha256,
    },
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
  assert.equal(built.artifact.executionAuthority.editorReceipts.length, 5);
  assert.equal(built.artifact.executionAuthority.dependencyReceipts.length, 21);

  const prerequisite = JSON.parse(
    await readFile(path.join(ROOT, EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.path), "utf8"),
  );
  assert.deepEqual(
    built.artifact.executionAuthority.dependencyReceipts,
    prerequisite.executionAuthority.dependencyReceipts,
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
});

test("[determinism] two fresh M08-T03 builds are byte-identical", async () => {
  const first = await buildEditorCoreStructuralEditsEvidence();
  const second = await buildEditorCoreStructuralEditsEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
});

test("[behavior] proves delete, move, reorder, stable identity, limits, and atomic diagnostics", () => {
  assert.deepEqual(built.artifact.behavior.deletion, {
    completeSubtree: true,
    emptiedSourceSlotRetained: true,
    remainingIdentities: ["sign-in.layout"],
  });
  assert.deepEqual(built.artifact.behavior.movement, {
    crossOwner: true,
    crossSlot: true,
    subtreePreserved: true,
    behaviorOwnerTarget: true,
    prototypeNamedSlotOwnData: true,
    absentDestinationAtZero: true,
    sameOwnerSameSlotReservedForReorder: true,
    cyclesRejected: true,
  });
  assert.deepEqual(built.artifact.behavior.reorder, {
    indexSemantics: "POST_REMOVAL_FINAL_POSITION",
    finalOrder: [
      "sign-in.email",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
      "sign-in.title",
    ],
    noOpReturnsFreshSnapshot: true,
  });
  assert.deepEqual(built.artifact.behavior.limits, {
    capabilityIdCodeUnits: 4_096,
    capabilityCommandInput: "NOT_APPLICABLE_TO_STRUCTURAL_COMMANDS",
    canonicalDocumentBytes: 8_388_608,
    identitiesPerTargetSurface: 25_000,
    sourceTreeDepth: 64,
    rootDepth: 0,
    exactCeilingsPass: true,
    oneUnitCrossingsFail: true,
  });
  assert.equal(built.artifact.behavior.identityAndOrder.nodeAndBehaviorIdsUnchangedByMove, true);
  assert.equal(built.artifact.behavior.diagnostics.structuralPassThrough, "SCHEMA_INVALID");
  assert.equal(built.artifact.behavior.immutability.atomicFailure, true);
});

test("[mutation] rejects runtime substitution and tracked boundary mutation", async () => {
  let runtimeExecuted = false;
  const runtime = {
    createDesenEditorDocument(input) {
      runtimeExecuted = true;
      return editorCore.createDesenEditorDocument(input);
    },
    deleteDesenEditorNode(editorDocument, command) {
      runtimeExecuted = true;
      return editorCore.deleteDesenEditorNode(editorDocument, command);
    },
    moveDesenEditorNode(editorDocument, command) {
      runtimeExecuted = true;
      return editorCore.moveDesenEditorNode(editorDocument, command);
    },
    reorderDesenEditorNode(editorDocument, command) {
      runtimeExecuted = true;
      return editorCore.reorderDesenEditorNode(editorDocument, command);
    },
  };
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({ runtime }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
  );
  assert.equal(runtimeExecuted, false);

  const source = await readFile(path.join(ROOT, STRUCTURAL_SOURCE));
  const dependency = await readFile(path.join(ROOT, PROTOCOL_RUNTIME));
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({
      fileOverrides: { [STRUCTURAL_SOURCE]: changedByte(source) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({
      fileOverrides: { [PROTOCOL_RUNTIME]: changedByte(dependency) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreStructuralEditsEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);

  await assert.rejects(
    verifyEditorCoreStructuralEditsEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStructuralEditsEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
});

test("[writer] atomically commits exact bytes and preserves the previous destination on failure", async () => {
  const directory = await temporaryDirectory("desen-m08-t03-writer-");
  const destinationPath = path.join(directory, "artifact.json");
  await writeFile(destinationPath, "previous\n");
  await assert.rejects(
    writeEditorCoreStructuralEditsEvidence({
      destinationPath,
      beforeAtomicRename() {
        throw new Error("blocked before rename");
      },
    }),
    /blocked before rename/,
  );
  assert.equal(await readFile(destinationPath, "utf8"), "previous\n");

  const result = await writeEditorCoreStructuralEditsEvidence({ destinationPath });
  assert.equal(result.artifactSha256, built.artifactSha256);
  assert.deepEqual(await readFile(destinationPath), built.artifactBytes);
});

test("[writer-filesystem] rejects symlink, hard-link, and non-file destinations", async () => {
  const directory = await temporaryDirectory("desen-m08-t03-destination-");
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
      writeEditorCoreStructuralEditsEvidence({ destinationPath }),
      expectedError("FILESYSTEM_UNSAFE"),
    );
  }
});

test("[filesystem] rejects linked prerequisite, artifact, and proof authorities", async () => {
  const directory = await temporaryDirectory("desen-m08-t03-authority-");
  const prerequisite = path.join(ROOT, EDITOR_CORE_STRUCTURAL_EDITS_PREREQUISITE_PIN.path);
  const prerequisiteBytes = await readFile(prerequisite);
  const prerequisiteCopy = path.join(directory, "prerequisite-copy.json");
  const prerequisiteLink = path.join(directory, "prerequisite.json");
  await writeFile(prerequisiteCopy, prerequisiteBytes);
  await symlink(prerequisiteCopy, prerequisiteLink);
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({ prerequisitePath: prerequisiteLink }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  const prerequisiteHardLink = path.join(directory, "prerequisite-hard.json");
  await link(prerequisiteCopy, prerequisiteHardLink);
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({ prerequisitePath: prerequisiteHardLink }),
    expectedError("FILESYSTEM_UNSAFE"),
  );

  const swappedAuthority = path.join(directory, "swapped-authority.json");
  const heldAuthority = path.join(directory, "held-authority.json");
  const replacementAuthority = path.join(directory, "replacement-authority.json");
  await writeFile(swappedAuthority, prerequisiteBytes);
  await writeFile(replacementAuthority, "replacement\n");
  let swapped = false;
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({
      prerequisitePath: swappedAuthority,
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

  const authorityParent = path.join(directory, "authority-parent");
  const heldParent = path.join(directory, "held-parent");
  const parentAuthority = path.join(authorityParent, "prerequisite.json");
  await mkdir(authorityParent);
  await writeFile(parentAuthority, prerequisiteBytes);
  let parentRenamed = false;
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({
      prerequisitePath: parentAuthority,
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

  const artifactTarget = path.join(directory, "artifact-target.json");
  const artifactLink = path.join(directory, "artifact-link.json");
  const proofTarget = path.join(directory, "proof-target.md");
  const proofLink = path.join(directory, "proof-link.md");
  await writeFile(artifactTarget, built.artifactBytes);
  await writeFile(proofTarget, exactProofDocument(built.artifactSha256));
  await symlink(artifactTarget, artifactLink);
  await symlink(proofTarget, proofLink);
  await assert.rejects(
    verifyEditorCoreStructuralEditsEvidence({
      artifactPath: artifactLink,
      proofDocumentPath: proofTarget,
    }),
    expectedError("FILESYSTEM_UNSAFE"),
  );
  await assert.rejects(
    verifyEditorCoreStructuralEditsEvidence({
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
  for (const name of ["deleteDesenEditorNode", "moveDesenEditorNode", "reorderDesenEditorNode"]) {
    Object.defineProperty(runtimeAccessor, name, { enumerable: true, value: editorCore[name] });
  }
  for (const options of [
    { unknown: true },
    accessor,
    inherited,
    symbol,
    proxy,
    { prerequisiteBytes: shared },
    { runtime: runtimeAccessor },
    { beforeAuthorityRecheck: new Proxy(() => undefined, {}) },
  ]) {
    await assert.rejects(
      buildEditorCoreStructuralEditsEvidence(options),
      expectedError("OPTIONS_INVALID"),
    );
  }
  await assert.rejects(
    writeEditorCoreStructuralEditsEvidence({
      beforeAtomicRename: new Proxy(() => undefined, {}),
    }),
    expectedError("OPTIONS_INVALID"),
  );
  await assert.rejects(
    buildEditorCoreStructuralEditsEvidence({
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
  assert.deepEqual(built.artifact.nonclaims, [
    "CATALOG_SLOT_ACCEPTANCE_AND_CARDINALITY",
    "CROSS_SURFACE_STRUCTURAL_MOVE",
    "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
    "M08_T04_THROUGH_T08_AUTHORING_AND_PERSISTENCE",
    "M08-T09_CATALOG_SEMANTICS_AND_CONTINUOUS_DIAGNOSTICS",
    "M08-T10_AND_G08_TERMINAL_UI_BOUNDARY",
    "HOSTILE_JAVASCRIPT_SANDBOX",
    "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
    "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    "P18_OR_G08_ADVANCEMENT",
  ]);
  assert.deepEqual(
    EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES,
    EDITOR_CORE_STRUCTURAL_EDITS_ROOT_TEST_NAMES.slice(),
  );
});
