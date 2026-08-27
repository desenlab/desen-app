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
  verifyEditorCorePersistenceEvidence,
  writeEditorCorePersistenceEvidence,
} from "../scripts/lib/editor-core-persistence-proof.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TRACKED_PERSISTENCE_SOURCE = "packages/editor-core/src/persistence.ts";
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
  const tracked = new Set(
    built.artifact.trackedFiles.map(({ path: relativePath }) => relativePath),
  );
  for (const relativePath of [
    TRACKED_PERSISTENCE_SOURCE,
    "packages/editor-web/src/local-source-persistence.ts",
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
});

test("[mutation] rejects prerequisite, tracked-file, and runtime substitution", async () => {
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
  await assert.rejects(
    buildEditorCorePersistenceEvidence({ runtime: editorCore }),
    expectedError("RUNTIME_OVERRIDE_REJECTED"),
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
  assert.equal(built.artifact.nonclaims.length, 8);
  assert.deepEqual(
    EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES,
    EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES.slice(),
  );
});
