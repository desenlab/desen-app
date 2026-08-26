import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
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
const PROTOCOL_RUNTIME = "packages/protocol/dist/index.js";
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
});

test("[determinism] two fresh M08-T02 builds are byte-identical", async () => {
  const first = await buildEditorCoreStableIdInsertEvidence();
  const second = await buildEditorCoreStableIdInsertEvidence();
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactSha256, second.artifactSha256);
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
  const dependency = await readFile(path.join(ROOT, PROTOCOL_RUNTIME));
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [INSERT_SOURCE]: changedByte(source) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
  await assert.rejects(
    buildEditorCoreStableIdInsertEvidence({
      fileOverrides: { [PROTOCOL_RUNTIME]: changedByte(dependency) },
    }),
    expectedError("BOUNDARY_DRIFT"),
  );
});

test("[artifact] verifies exact artifact bytes and one exact final proof pin", async () => {
  const proofDocumentBytes = exactProofDocument(built.artifactSha256);
  const verified = await verifyEditorCoreStableIdInsertEvidence({
    artifactBytes: built.artifactBytes,
    proofDocumentBytes,
  });
  assert.equal(verified.result, "PASS");
  assert.equal(verified.artifactSha256, built.artifactSha256);

  await assert.rejects(
    verifyEditorCoreStableIdInsertEvidence({
      artifactBytes: changedByte(built.artifactBytes),
      proofDocumentBytes,
    }),
    expectedError("ARTIFACT_DRIFT"),
  );
  await assert.rejects(
    verifyEditorCoreStableIdInsertEvidence({
      artifactBytes: built.artifactBytes,
      proofDocumentBytes: `${proofDocumentBytes}${proofDocumentBytes}`,
    }),
    expectedError("PROOF_PIN_DRIFT"),
  );
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
  for (const destinationPath of [symbolic, hard, nonFile]) {
    await assert.rejects(
      writeEditorCoreStableIdInsertEvidence({ destinationPath }),
      expectedError("FILESYSTEM_UNSAFE"),
    );
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
