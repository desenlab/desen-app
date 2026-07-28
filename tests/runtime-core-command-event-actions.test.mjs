import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRuntimeCoreCommandEventActionsEvidence,
  DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH,
  RuntimeCoreCommandEventActionsEvidenceError,
  verifyRuntimeCoreCommandEventActionsEvidence,
  writeRuntimeCoreCommandEventActionsEvidence,
} from "../scripts/lib/runtime-core-command-event-actions-proof.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TEST_DIRECTORY, "..");
const PROOF_MATRIX_PATH = path.join(WORKSPACE_ROOT, "docs/proof/PROOF-MATRIX.md");
const PROOF_DOCUMENT_PATH = path.join(
  WORKSPACE_ROOT,
  "docs/proof/RUNTIME-CORE-COMMAND-EVENT-ACTIONS.md",
);
const ROOT_MANIFEST_PATH = path.join(WORKSPACE_ROOT, "package.json");
const HISTORICAL_SHA256 = "sha256:8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4";
const ARTIFACT_NAME = "runtime-core-0.1.0-command-event-actions.json";

function expectEvidenceFailure(error, code) {
  assert.ok(error instanceof RuntimeCoreCommandEventActionsEvidenceError);
  if (code !== undefined) assert.equal(error.code, code);
  return true;
}

async function temporaryDirectory() {
  return mkdtemp(path.join(os.tmpdir(), "desen-command-event-compat-"));
}

test("accepts the tracked immutable M04-T12 command/event evidence", async () => {
  const result = await verifyRuntimeCoreCommandEventActionsEvidence();
  assert.equal(result.result, "PASS");
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
  assert.equal(result.compatibilityMode, "immutable-task-time-artifact");
  assert.equal(result.runtimeExports, 8);
  assert.equal(result.typeExports, 26);
  assert.equal(result.internalRuntimeExports, 7);
  assert.equal(result.internalTypeExports, 3);
  assert.equal(result.tsdocDeclarations, 44);
  assert.equal(result.focusedTests, 58);
  assert.equal(result.compilerNegativeCases, 27);
  assert.equal(result.rootMutationTests, 21);
  assert.equal(result.traceRules, 6);
  assert.equal(result.normativeTested, 1);
  assert.equal(result.normativePlannedAtTaskTime, 1);
  assert.equal(result.trackedFiles, 16);
  assert.equal(result.portProbes, 39);
  assert.equal(result.adapterBridgeReadProbes, 8);
  assert.equal(result.hostilePayloadReads, 0);
  assert.equal(result.falseGuardEffects, 0);
  assert.equal(result.falseGuardDiagnosticCalls, 0);
  assert.equal(result.rawHostFailuresExposed, false);
  assert.equal(result.platformEffects, 0);
});

test("reads byte-identical immutable task-time evidence twice", async () => {
  const [first, second] = await Promise.all([
    buildRuntimeCoreCommandEventActionsEvidence(),
    buildRuntimeCoreCommandEventActionsEvidence(),
  ]);
  assert.deepEqual(first.artifactBytes, second.artifactBytes);
  assert.equal(first.artifactBytes.length, 23_466);
  assert.equal(first.artifactSha256, HISTORICAL_SHA256);
  assert.equal(second.artifactSha256, HISTORICAL_SHA256);
  assert.equal(first.compatibilityMode, "immutable-task-time-artifact");
});

test("preserves historical N-034 semantics without consulting current coverage", async () => {
  const { artifact } = await buildRuntimeCoreCommandEventActionsEvidence();
  assert.deepEqual(artifact.normative, { tested: ["N-031"], planned: ["N-034"] });
  assert.deepEqual(artifact.claim.normativeStatusChanges, [
    { id: "N-031", from: "PLANNED", to: "TESTED" },
  ]);
  assert.equal(artifact.semantics.productionAdapterCommandParity, null);
  assert.equal(
    artifact.deferred[0],
    "production-adapter implementation of every declared command and N-034 closure (M05)",
  );
  assert.equal(
    artifact.evidence.trackedFiles.some(
      ({ path: trackedPath }) =>
        trackedPath === "docs/proof/NORMATIVE-COVERAGE.md" ||
        trackedPath === "packages/runtime-core/src/index.ts",
    ),
    false,
  );
});

test("rejects every current source build prerequisite or runtime injection", async () => {
  for (const options of [
    { fileOverrides: {} },
    { buildOptions: {} },
    { prerequisiteBytes: {} },
    { runtimeApi: {} },
    { runtimePortApi: {} },
    { runtimeActionInternalApi: {} },
    { validatorApi: {} },
    { proofDocumentPath: "ignored" },
  ]) {
    await assert.rejects(buildRuntimeCoreCommandEventActionsEvidence(options), (error) =>
      expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
    );
  }
});

test("rejects Proxy accessor hidden symbolic inherited and unknown options without traps", async () => {
  let getterCalls = 0;
  let proxyCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "artifactPath", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "ignored";
    },
  });
  const hidden = Object.defineProperty({}, "artifactPath", {
    enumerable: false,
    value: "ignored",
  });
  const inherited = Object.create({ artifactPath: "ignored" });
  const symbolic = { [Symbol("artifactPath")]: "ignored" };
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        proxyCalls += 1;
        return Object.prototype;
      },
      ownKeys() {
        proxyCalls += 1;
        return [];
      },
    },
  );
  for (const options of [accessor, hidden, inherited, symbolic, proxy, { unknown: true }]) {
    await assert.rejects(buildRuntimeCoreCommandEventActionsEvidence(options), (error) =>
      expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
    );
  }
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

test("rejects Proxy shared and accessor-subclass artifact bytes without traps", async () => {
  const proxied = new Proxy(new Uint8Array([1, 2, 3]), {});
  await assert.rejects(
    buildRuntimeCoreCommandEventActionsEvidence({ artifactBytes: proxied }),
    (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
  );

  const historicalBytes = await readFile(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH);
  assert.equal(
    (
      await buildRuntimeCoreCommandEventActionsEvidence({
        artifactBytes: new Uint8Array(historicalBytes),
      })
    ).artifactSha256,
    HISTORICAL_SHA256,
  );

  let accessorCalls = 0;
  class HostileBytes extends Uint8Array {
    get buffer() {
      accessorCalls += 1;
      throw new Error("hostile buffer accessor");
    }

    get byteLength() {
      accessorCalls += 1;
      throw new Error("hostile byteLength accessor");
    }

    get byteOffset() {
      accessorCalls += 1;
      throw new Error("hostile byteOffset accessor");
    }
  }
  await assert.rejects(
    buildRuntimeCoreCommandEventActionsEvidence({
      artifactBytes: new HostileBytes(historicalBytes),
    }),
    (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
  );
  assert.equal(accessorCalls, 0);

  if (typeof SharedArrayBuffer === "function") {
    await assert.rejects(
      buildRuntimeCoreCommandEventActionsEvidence({
        artifactBytes: new Uint8Array(new SharedArrayBuffer(8)),
      }),
      (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
    );
  }
});

test("rejects stale or one-byte-tampered immutable evidence", async () => {
  const result = await buildRuntimeCoreCommandEventActionsEvidence();
  const tampered = Buffer.from(result.artifactBytes);
  tampered[tampered.length - 2] ^= 1;
  await assert.rejects(
    verifyRuntimeCoreCommandEventActionsEvidence({ artifactBytes: tampered }),
    (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_HISTORICAL_ARTIFACT_DRIFT"),
  );
});

test("rejects moved duplicated mismatched or over-budget historical proof pins", async () => {
  const [matrix, proof] = await Promise.all([
    readFile(PROOF_MATRIX_PATH, "utf8"),
    readFile(PROOF_DOCUMENT_PATH, "utf8"),
  ]);
  const matrixReference = `\`${ARTIFACT_NAME}\`\n\`${HISTORICAL_SHA256}\`.`;
  const proofReference =
    `\`docs/proof/artifacts/${ARTIFACT_NAME}\`\n` + `(\`${HISTORICAL_SHA256}\`).`;
  for (const options of [
    { proofMatrixText: matrix.replace(`\`${ARTIFACT_NAME}\``, "`moved.json`") },
    { proofMatrixText: `${matrix}\n\`${ARTIFACT_NAME}\`\n` },
    { proofMatrixText: matrix.replace(HISTORICAL_SHA256, `sha256:${"0".repeat(64)}`) },
    { proofMatrixText: `${matrix.replace(matrixReference, "")}\n${matrixReference}\n` },
    { proofDocumentText: proof.replace(proofReference, `${proofReference}\n${proofReference}`) },
    { proofDocumentText: `${proof.replace(proofReference, "")}\n${proofReference}\n` },
  ]) {
    await assert.rejects(verifyRuntimeCoreCommandEventActionsEvidence(options), (error) =>
      expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_PROOF_PIN_DRIFT"),
    );
  }
  await assert.rejects(
    verifyRuntimeCoreCommandEventActionsEvidence({
      proofMatrixText: "x".repeat(2_000_001),
    }),
    (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
  );
  await assert.rejects(
    verifyRuntimeCoreCommandEventActionsEvidence({
      proofDocumentText: "x".repeat(500_001),
    }),
    (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_OPTIONS_INVALID"),
  );
});

test("rejects a symlink historical artifact source", async () => {
  const directory = await temporaryDirectory();
  const target = path.join(directory, "target.json");
  const source = path.join(directory, "artifact.json");
  try {
    await writeFile(
      target,
      await readFile(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH),
    );
    await symlink(target, source);
    await assert.rejects(
      buildRuntimeCoreCommandEventActionsEvidence({ artifactPath: source }),
      (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_ARTIFACT_UNSAFE"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writes and verifies an exact alternate copy", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "command-event-actions.json");
  try {
    const written = await writeRuntimeCoreCommandEventActionsEvidence({ artifactPath });
    const verified = await verifyRuntimeCoreCommandEventActionsEvidence({ artifactPath });
    assert.equal(written.preserved, false);
    assert.equal(written.compatibilityMode, "immutable-task-time-artifact");
    assert.equal(verified.artifactSha256, HISTORICAL_SHA256);
    assert.equal(verified.artifactSha256, written.artifactSha256);
    assert.deepEqual(
      await readFile(artifactPath),
      await readFile(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detects alternate-copy temporary-byte substitution", async () => {
  const directory = await temporaryDirectory();
  const artifactPath = path.join(directory, "command-event-actions.json");
  try {
    await assert.rejects(
      writeRuntimeCoreCommandEventActionsEvidence({
        artifactPath,
        beforeAtomicRename: async ({ temporaryPath }) => {
          await writeFile(temporaryPath, "{}\n");
        },
      }),
      (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_ARTIFACT_WRITE_FAILED"),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects symlink destinations without changing their targets", async () => {
  const directory = await temporaryDirectory();
  const target = path.join(directory, "target.json");
  const destination = path.join(directory, "artifact.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, destination);
    await assert.rejects(
      writeRuntimeCoreCommandEventActionsEvidence({ artifactPath: destination }),
      (error) => expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_ARTIFACT_WRITE_FAILED"),
    );
    assert.equal(await readFile(target, "utf8"), "{}\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preserves the tracked inode and mtime through default generation", async () => {
  const before = await lstat(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH, {
    bigint: true,
  });
  const result = await writeRuntimeCoreCommandEventActionsEvidence();
  const after = await lstat(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH, {
    bigint: true,
  });
  assert.equal(result.preserved, true);
  assert.equal(result.artifactSha256, HISTORICAL_SHA256);
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeNs, before.mtimeNs);
});

test("preserves a symlink-parent alias to the tracked artifact without hooks", async () => {
  const directory = await temporaryDirectory();
  const aliasParent = path.join(directory, "artifacts");
  const aliasPath = path.join(aliasParent, ARTIFACT_NAME);
  try {
    await symlink(
      path.dirname(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH),
      aliasParent,
      "dir",
    );
    const before = await lstat(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH, {
      bigint: true,
    });
    const result = await writeRuntimeCoreCommandEventActionsEvidence({
      artifactPath: aliasPath,
    });
    const after = await lstat(DEFAULT_RUNTIME_CORE_COMMAND_EVENT_ACTIONS_ARTIFACT_PATH, {
      bigint: true,
    });
    assert.equal(result.preserved, true);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mtimeNs, before.mtimeNs);

    let hookCalls = 0;
    for (const options of [
      {
        artifactPath: aliasPath,
        beforeAtomicRename() {
          hookCalls += 1;
        },
      },
      { artifactPath: aliasPath, buildOptions: {} },
    ]) {
      await assert.rejects(writeRuntimeCoreCommandEventActionsEvidence(options), (error) =>
        expectEvidenceFailure(error, "COMMAND_EVENT_ACTION_NONDEFAULT_TRACKED_WRITE"),
      );
    }
    assert.equal(hookCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("pins the exact historical prerequisite trace and tracked-file ledgers", async () => {
  const { artifact } = await buildRuntimeCoreCommandEventActionsEvidence();
  assert.equal(artifact.prerequisites.length, 3);
  assert.deepEqual(
    artifact.prerequisites.map(({ task, artifactSha256 }) => ({ task, artifactSha256 })),
    [
      {
        task: "M04-T10",
        artifactSha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
      },
      {
        task: "M02-T09",
        artifactSha256: "981e1d59dd68e32639055b1267880cc1e6ebb3a76ad1176298990b28fe048208",
      },
      {
        task: "M02-T11",
        artifactSha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
      },
    ],
  );
  assert.deepEqual(
    artifact.evidence.traceRules.map(({ id }) => id),
    ["R-080", "R-106", "R-120", "R-122", "D-015", "D-016"],
  );
  assert.equal(artifact.evidence.trackedFiles.length, 16);
  assert.deepEqual(artifact.evidence.trackedFiles.at(-1), {
    path: "tests/runtime-core-command-event-actions.test.mjs",
    bytes: 19_918,
    sha256: "3ec7171601b0bc4fdb3f10e58fee47fe378f25dfba40964feb2e076be10f9550",
  });
});

test("keeps root command/event scripts independent of current source and builds", async () => {
  const manifest = JSON.parse(await readFile(ROOT_MANIFEST_PATH, "utf8"));
  assert.equal(
    manifest.scripts["generate:runtime-core-command-event-actions"],
    "node scripts/generate-runtime-core-command-event-actions-proof.mjs",
  );
  assert.equal(
    manifest.scripts["verify:runtime-core-command-event-actions"],
    "node scripts/verify-runtime-core-command-event-actions.mjs",
  );
  assert.equal(
    manifest.scripts["test:runtime-core-command-event-actions"],
    "node --test tests/runtime-core-command-event-actions.test.mjs",
  );
});
