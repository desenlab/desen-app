import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  BUILD_OUTPUT_ROOTS,
  CHILD_PROCESS_VERIFIER_PROOF_IDS,
  EXECUTION_CLASSES,
  NATIVE_ADDON_PROOF_IDS,
  OS_TEMP_ROOT_PROOF_IDS,
  PROOF_IDS,
  READ_ONLY_ROOT_PROOF_IDS,
  SharedStateAuthorityError,
  WORKSPACE_TEMP_ROOT_PROOF_IDS,
  assertBuildOutputsUnchanged,
  assertConcurrentWorkloadsSafe,
  assertNonIgnoredUntrackedStateUnchanged,
  assertProofPairsCanRunConcurrently,
  classifyProofPairState,
  classifyWorkloadStateMetadata,
  createProofStepIsolationContext,
  snapshotBuildOutputs,
  snapshotNonIgnoredUntrackedState,
  validateWorkloadStateMetadata,
} from "../shared-state-authority.mjs";

const execFileAsync = promisify(execFile);

async function temporaryDirectory(prefix) {
  return await mkdtemp(path.join(tmpdir(), prefix));
}

async function runNode(code, env) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ["-e", code], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (codeValue, signal) => {
      resolvePromise({
        code: codeValue,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function mutableMetadata(stepId) {
  return structuredClone(classifyWorkloadStateMetadata(stepId));
}

test("owns exactly 130 steps across the six reviewed execution classes", () => {
  const allStepIds = [
    "orchestrator-contracts",
    "format",
    "lint",
    "structural-validator-artifacts",
    "workspace-graph",
    "package-tests",
    ...PROOF_IDS.map((id) => `verify-${id}`),
    ...PROOF_IDS.map((id) => `test-${id}`),
    "dependency-boundaries",
    "boundary-fixtures",
  ];
  const counts = Object.fromEntries(Object.values(EXECUTION_CLASSES).map((id) => [id, 0]));
  for (const stepId of allStepIds) {
    counts[classifyWorkloadStateMetadata(stepId).executionClass] += 1;
  }

  assert.equal(allStepIds.length, 130);
  assert.equal(new Set(allStepIds).size, 130);
  assert.deepEqual(counts, {
    GLOBAL_EXCLUSIVE: 6,
    WORKSPACE_OUTPUT_EXCLUSIVE: 1,
    PACKAGE_TEST_EXCLUSIVE: 1,
    PROOF_READ_ONLY: 66,
    PROOF_OS_TEMP_ISOLATED: 55,
    PROOF_WORKSPACE_TEMP_EXCLUSIVE: 1,
  });
});

test("pins the exact ten read-only and sole workspace-temp proof ids", () => {
  assert.equal(PROOF_IDS.length, 61);
  assert.equal(new Set(PROOF_IDS).size, 61);
  assert.deepEqual(READ_ONLY_ROOT_PROOF_IDS, [
    "protocol-canonicalization",
    "protocol-traceability",
    "publisher-catalog-resolution",
    "runtime-core-action-turns",
    "runtime-core-adapter-bridges",
    "runtime-core-operation-lifecycle",
    "runtime-core-operation-resource-actions",
    "runtime-core-repeat-materialization",
    "runtime-core-resource-lifecycle",
    "runtime-core-state-navigation-actions",
  ]);
  assert.deepEqual(WORKSPACE_TEMP_ROOT_PROOF_IDS, ["reference-host-web-source-audit"]);
  assert.equal(OS_TEMP_ROOT_PROOF_IDS.length, 50);
  assert.deepEqual(CHILD_PROCESS_VERIFIER_PROOF_IDS, [
    "publisher-catalog-pinning",
    "publisher-bundle-publication",
    "publisher-official-golden",
    "publisher-invalid-source-matrix",
    "control-plane-bundle-store",
  ]);
  for (const proofId of CHILD_PROCESS_VERIFIER_PROOF_IDS) {
    assert.deepEqual(classifyWorkloadStateMetadata(`verify-${proofId}`), {
      schemaVersion: 1,
      stepId: `verify-${proofId}`,
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: `verify-${proofId}`,
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "NONE",
      barrier: false,
    });
  }
  assert.deepEqual(NATIVE_ADDON_PROOF_IDS, ["reference-host-web-source-audit"]);
  assert.equal(
    classifyWorkloadStateMetadata("verify-reference-host-web-source-audit").nativeAddonPolicy,
    "REFERENCE_HOST_WEB_SOURCE_AUDIT",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-reference-host-web-source-audit").nativeAddonPolicy,
    "REFERENCE_HOST_WEB_SOURCE_AUDIT",
  );
  assert.equal(classifyWorkloadStateMetadata("verify-protocol-snapshot").nativeAddonPolicy, "NONE");
  assert.equal(
    new Set([
      ...READ_ONLY_ROOT_PROOF_IDS,
      ...OS_TEMP_ROOT_PROOF_IDS,
      ...WORKSPACE_TEMP_ROOT_PROOF_IDS,
    ]).size,
    61,
  );
});

test("unknown workloads and drifted metadata fail closed", () => {
  assert.throws(
    () => classifyWorkloadStateMetadata("verify-unknown-proof"),
    (error) =>
      error instanceof SharedStateAuthorityError && error.code === "SHARED_STATE_WORKLOAD_UNKNOWN",
  );

  const omitted = mutableMetadata("verify-protocol-snapshot");
  delete omitted.ports;
  assert.throws(() => validateWorkloadStateMetadata("verify-protocol-snapshot", omitted));

  const widened = mutableMetadata("verify-protocol-snapshot");
  widened.workspaceWrites = ["."];
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", widened),
    (error) => error.code === "SHARED_STATE_METADATA_DRIFT",
  );

  const accessor = mutableMetadata("verify-protocol-snapshot");
  Object.defineProperty(accessor, "ports", { get: () => [], enumerable: true });
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", accessor),
    (error) => error.code === "SHARED_STATE_METADATA_INVALID",
  );
});

test("path traversal in untrusted metadata is rejected before comparison", () => {
  const traversal = mutableMetadata("verify-protocol-snapshot");
  traversal.workspaceWrites = ["../outside"];
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", traversal),
    (error) => error.code === "SHARED_STATE_PATH_INVALID",
  );
});

test("ordinary proof pairs may overlap but source audit always requires a barrier", () => {
  assert.deepEqual(
    assertProofPairsCanRunConcurrently("protocol-snapshot", "protocol-canonicalization"),
    {
      concurrency: 2,
      proofIds: ["protocol-snapshot", "protocol-canonicalization"],
    },
  );
  assert.equal(classifyProofPairState("reference-host-web-source-audit").barrier, true);
  assert.throws(
    () =>
      assertProofPairsCanRunConcurrently(
        "reference-host-web-source-audit",
        "publisher-publish-result",
      ),
    (error) => error.code === "SHARED_STATE_BARRIER_REQUIRED",
  );
});

test("workspace read-write and write-write overlap is rejected", () => {
  const reader = mutableMetadata("verify-runtime-core-host-ports");
  reader.workspaceReads = ["packages/runtime-core"];
  const writer = mutableMetadata("test-protocol-snapshot");
  writer.workspaceWrites = ["packages/runtime-core/dist"];

  assert.throws(
    () => assertConcurrentWorkloadsSafe([reader, writer]),
    (error) => error.code === "SHARED_STATE_PATH_CONFLICT",
  );

  reader.workspaceReads = [];
  reader.workspaceWrites = ["packages/runtime-core"];
  assert.throws(
    () => assertConcurrentWorkloadsSafe([reader, writer]),
    (error) => error.code === "SHARED_STATE_PATH_CONFLICT",
  );
});

test("shared temp authority and fixed ports are rejected", () => {
  const left = mutableMetadata("test-protocol-snapshot");
  const right = mutableMetadata("test-protocol-types");
  right.tempKey = left.tempKey;
  assert.throws(
    () => assertConcurrentWorkloadsSafe([left, right]),
    (error) => error.code === "SHARED_STATE_TEMP_CONFLICT",
  );

  right.tempKey = "test-protocol-types";
  left.ports = [41_337];
  right.ports = [41_337];
  assert.throws(
    () => assertConcurrentWorkloadsSafe([left, right]),
    (error) => error.code === "SHARED_STATE_PORT_CONFLICT",
  );
});

test("concurrency cannot be widened or used with an exclusive step", () => {
  const left = classifyWorkloadStateMetadata("verify-protocol-snapshot");
  const right = classifyWorkloadStateMetadata("verify-protocol-types");
  assert.throws(
    () => assertConcurrentWorkloadsSafe([left, right], { concurrency: 3 }),
    (error) => error.code === "SHARED_STATE_CONCURRENCY_INVALID",
  );
  assert.throws(
    () =>
      assertConcurrentWorkloadsSafe([
        left,
        classifyWorkloadStateMetadata("test-reference-host-web-source-audit"),
      ]),
    (error) => error.code === "SHARED_STATE_BARRIER_REQUIRED",
  );
});

test("proof isolation preserves the reviewed command and argument vector", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-command-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const workload = Object.freeze({
    id: "verify-protocol-snapshot",
    command: "node",
    args: Object.freeze(["scripts/verify-protocol-snapshot.mjs"]),
  });
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload,
    baseEnvironment: {},
  });
  context.after(() => isolation.dispose());

  assert.equal(isolation.command, workload.command);
  assert.equal(isolation.args, workload.args);
  assert.equal(isolation.env.TMPDIR, isolation.tempRoot);
  assert.equal(isolation.env.TMP, isolation.tempRoot);
  assert.equal(isolation.env.TEMP, isolation.tempRoot);
  assert.match(isolation.env.NODE_OPTIONS, /--permission/u);
  assert.doesNotMatch(isolation.env.NODE_OPTIONS, /--allow-fs-write=/u);
});

test("only exact runtime-probe verifiers receive child-process authority", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-child-process-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const allowed = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-publisher-official-golden",
    baseEnvironment: {},
  });
  const denied = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-protocol-snapshot",
    baseEnvironment: {},
  });
  context.after(async () => {
    await allowed.dispose();
    await denied.dispose();
  });

  const allowedTempPath = path.join(allowed.tempRoot, "runtime-probe.txt");
  const probe = [
    `require("node:fs").writeFileSync(${JSON.stringify(allowedTempPath)}, "temp-ok");`,
    'const { spawnSync } = require("node:child_process");',
    'const child = spawnSync(process.execPath, ["-e", "process.stdout.write(\\"child-ok\\")"], { encoding: "utf8" });',
    "if (child.error) throw child.error;",
    "if (child.status !== 0) throw new Error(child.stderr);",
    "process.stdout.write(child.stdout);",
  ].join("\n");
  const allowedResult = await runNode(probe, allowed.env);
  assert.equal(allowedResult.code, 0, allowedResult.stderr);
  assert.equal(allowedResult.stdout, "child-ok");
  assert.equal(await readFile(allowedTempPath, "utf8"), "temp-ok");

  const deniedResult = await runNode(probe, denied.env);
  assert.notEqual(deniedResult.code, 0);
  assert.match(deniedResult.stderr, /Access to this API has been restricted|ERR_ACCESS_DENIED/u);

  const widened = mutableMetadata("verify-protocol-snapshot");
  widened.childProcessPolicy = "VERIFIER_RUNTIME_PROBE";
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", widened),
    (error) => error.code === "SHARED_STATE_METADATA_DRIFT",
  );
});

test("only the exact source-audit proof pair receives native-addon authority", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-native-addon-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const verifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-reference-host-web-source-audit",
    baseEnvironment: {},
  });
  const rootTest = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-reference-host-web-source-audit",
    baseEnvironment: {},
  });
  const ordinary = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-protocol-snapshot",
    baseEnvironment: {},
  });
  context.after(async () => {
    await verifier.dispose();
    await rootTest.dispose();
    await ordinary.dispose();
  });

  assert.equal(verifier.metadata.executionClass, "PROOF_READ_ONLY");
  assert.match(verifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(verifier.env.NODE_OPTIONS, /--allow-fs-write=/u);
  assert.match(rootTest.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(ordinary.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);

  const widened = mutableMetadata("verify-protocol-snapshot");
  widened.nativeAddonPolicy = "REFERENCE_HOST_WEB_SOURCE_AUDIT";
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", widened),
    (error) => error.code === "SHARED_STATE_METADATA_DRIFT",
  );
});

test("a verifier cannot write into its workspace", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-denied-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const destination = path.join(workspaceRoot, "forbidden.txt");
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-protocol-snapshot",
    baseEnvironment: {},
  });
  context.after(() => isolation.dispose());

  const result = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(destination)}, "forbidden")`,
    isolation.env,
  );
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Access to this API has been restricted|ERR_ACCESS_DENIED/u);
  await assert.rejects(readFile(destination), { code: "ENOENT" });
});

test("a root test may write only inside its own runner temp root", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-temp-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const first = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-snapshot",
    baseEnvironment: {},
  });
  const second = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-types",
    baseEnvironment: {},
  });
  context.after(async () => {
    await first.dispose();
    await second.dispose();
  });

  const ownPath = path.join(first.tempRoot, "allowed.txt");
  const ownResult = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(ownPath)}, "allowed")`,
    first.env,
  );
  assert.equal(ownResult.code, 0, ownResult.stderr);
  assert.equal(await readFile(ownPath, "utf8"), "allowed");

  const siblingPath = path.join(second.tempRoot, "forbidden.txt");
  const siblingResult = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(siblingPath)}, "forbidden")`,
    first.env,
  );
  assert.notEqual(siblingResult.code, 0);
  await assert.rejects(readFile(siblingPath), { code: "ENOENT" });
});

test("only the exact source-audit root test receives workspace write authority", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-source-audit-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const destination = path.join(workspaceRoot, "source-audit-temp.txt");
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-reference-host-web-source-audit",
    baseEnvironment: {},
  });
  context.after(() => isolation.dispose());

  assert.match(isolation.env.NODE_OPTIONS, /--allow-fs-write=/u);
  const result = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(destination)}, "allowed")`,
    isolation.env,
  );
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await readFile(destination, "utf8"), "allowed");
});

test("the preload denies TCP and UDP listener binding", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-listener-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-protocol-snapshot",
    baseEnvironment: {},
  });
  context.after(() => isolation.dispose());

  const tcp = await runNode('require("node:net").createServer().listen(0)', isolation.env);
  assert.notEqual(tcp.code, 0);
  assert.match(tcp.stderr, /Proof workloads may not bind network listeners/u);

  const udp = await runNode('require("node:dgram").createSocket("udp4").bind(0)', isolation.env);
  assert.notEqual(udp.code, 0);
  assert.match(udp.stderr, /Proof workloads may not bind network listeners/u);
});

test("symlinked workspace and temp-base authorities fail before temp creation", async (context) => {
  const parent = await temporaryDirectory("desen-shared-state-symlink-");
  context.after(() => rm(parent, { recursive: true, force: true }));
  const realWorkspace = path.join(parent, "workspace");
  const linkedWorkspace = path.join(parent, "workspace-link");
  const realTemp = path.join(parent, "temp");
  const linkedTemp = path.join(parent, "temp-link");
  await mkdir(realWorkspace);
  await mkdir(realTemp);
  await symlink(realWorkspace, linkedWorkspace, "dir");
  await symlink(realTemp, linkedTemp, "dir");

  await assert.rejects(
    createProofStepIsolationContext({
      workspaceRoot: linkedWorkspace,
      workload: "verify-protocol-snapshot",
      baseEnvironment: {},
      tempBaseDirectory: realTemp,
    }),
    (error) => error.code === "SHARED_STATE_PATH_UNSAFE",
  );
  await assert.rejects(
    createProofStepIsolationContext({
      workspaceRoot: realWorkspace,
      workload: "verify-protocol-snapshot",
      baseEnvironment: {},
      tempBaseDirectory: linkedTemp,
    }),
    (error) => error.code === "SHARED_STATE_PATH_UNSAFE",
  );
});

test("inherited NODE_OPTIONS authority is rejected", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-node-options-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await assert.rejects(
    createProofStepIsolationContext({
      workspaceRoot,
      workload: "verify-protocol-snapshot",
      baseEnvironment: { NODE_OPTIONS: "--require=unreviewed.cjs" },
    }),
    (error) => error.code === "SHARED_STATE_ENVIRONMENT_INVALID",
  );
});

test("runner temp cleanup removes files and is idempotent", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-cleanup-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-types",
    baseEnvironment: {},
  });
  await writeFile(path.join(isolation.tempRoot, "residue.txt"), "residue");
  await isolation.dispose();
  await isolation.dispose();
  await assert.rejects(lstat(isolation.tempRoot), { code: "ENOENT" });
});

test("build-output seals cover every exact app/package dist and Turbo root", async (context) => {
  assert.equal(BUILD_OUTPUT_ROOTS.length, 33);
  assert.equal(new Set(BUILD_OUTPUT_ROOTS).size, 33);
  assert.equal(BUILD_OUTPUT_ROOTS.includes(".turbo"), true);
  assert.equal(BUILD_OUTPUT_ROOTS.includes("apps/reference-host-web/dist"), true);
  assert.equal(BUILD_OUTPUT_ROOTS.includes("packages/validator/.turbo"), true);

  const workspaceRoot = await temporaryDirectory("desen-shared-state-build-seal-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await mkdir(path.join(workspaceRoot, "apps/example/dist"), { recursive: true });
  await mkdir(path.join(workspaceRoot, ".turbo"), { recursive: true });
  const builtFile = path.join(workspaceRoot, "apps/example/dist/index.js");
  await writeFile(builtFile, "export {}\n");
  await writeFile(path.join(workspaceRoot, ".turbo/receipt.json"), "{}\n");
  const outputRoots = [".turbo", "apps/example/dist", "packages/missing/dist"];
  const before = await snapshotBuildOutputs(workspaceRoot, { outputRoots });
  const same = await snapshotBuildOutputs(workspaceRoot, { outputRoots });
  assertBuildOutputsUnchanged(before, same);
  assert.equal(before.rootCount, 3);
  assert.equal(before.fileCount, 2);

  await writeFile(builtFile, "export const changed = true;\n");
  const after = await snapshotBuildOutputs(workspaceRoot, { outputRoots });
  assert.throws(
    () => assertBuildOutputsUnchanged(before, after),
    (error) => error.code === "SHARED_STATE_BUILD_OUTPUT_DRIFT",
  );
});

test("build-output seal rejects symlinked output entries", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-build-link-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const outputRoot = path.join(workspaceRoot, "packages/example/dist");
  const target = path.join(workspaceRoot, "target.js");
  await mkdir(outputRoot, { recursive: true });
  await writeFile(target, "export {}\n");
  await symlink(target, path.join(outputRoot, "index.js"));
  await assert.rejects(
    snapshotBuildOutputs(workspaceRoot, { outputRoots: ["packages/example/dist"] }),
    (error) => error.code === "SHARED_STATE_SNAPSHOT_UNSAFE",
  );
});

test("non-ignored untracked snapshots detect residue while ignored output stays outside authority", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-untracked-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await execFileAsync("git", ["init", "--quiet"], { cwd: workspaceRoot });
  await writeFile(path.join(workspaceRoot, ".gitignore"), "ignored/\n");
  await writeFile(path.join(workspaceRoot, "baseline.txt"), "baseline\n");
  await mkdir(path.join(workspaceRoot, "ignored"));
  await writeFile(path.join(workspaceRoot, "ignored/output.txt"), "ignored\n");

  const before = await snapshotNonIgnoredUntrackedState(workspaceRoot);
  const same = await snapshotNonIgnoredUntrackedState(workspaceRoot);
  assertNonIgnoredUntrackedStateUnchanged(before, same);
  assert.equal(before.entryCount, 2);

  await writeFile(path.join(workspaceRoot, "residue.txt"), "residue\n");
  const after = await snapshotNonIgnoredUntrackedState(workspaceRoot);
  assert.throws(
    () => assertNonIgnoredUntrackedStateUnchanged(before, after),
    (error) => error.code === "SHARED_STATE_UNTRACKED_DRIFT",
  );
});
