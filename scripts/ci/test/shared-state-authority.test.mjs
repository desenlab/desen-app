import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  BUILD_OUTPUT_ROOTS,
  CHILD_PROCESS_VERIFIER_PROOF_IDS,
  EXECUTION_CLASSES,
  FILESYSTEM_COMPATIBILITY_ROOT_STEP_IDS,
  FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS,
  FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS,
  FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES,
  NATIVE_ADDON_PROOF_IDS,
  NATIVE_ADDON_ROOT_STEP_IDS,
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
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "../../..");
const COMPATIBILITY_PRELOAD_PATH = path.join(
  REPOSITORY_ROOT,
  "scripts/ci/proof-filesystem-compatibility.cjs",
);

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

const ALL_STEP_IDS = Object.freeze([
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
]);

test("owns exactly 144 steps across the seven reviewed execution classes", () => {
  const counts = Object.fromEntries(Object.values(EXECUTION_CLASSES).map((id) => [id, 0]));
  for (const stepId of ALL_STEP_IDS) {
    counts[classifyWorkloadStateMetadata(stepId).executionClass] += 1;
  }

  assert.equal(ALL_STEP_IDS.length, 144);
  assert.equal(new Set(ALL_STEP_IDS).size, 144);
  assert.deepEqual(counts, {
    GLOBAL_EXCLUSIVE: 6,
    WORKSPACE_OUTPUT_EXCLUSIVE: 1,
    PACKAGE_TEST_EXCLUSIVE: 1,
    PROOF_READ_ONLY: 69,
    PROOF_OS_TEMP_ISOLATED: 56,
    PROOF_TRACKED_ALIAS_EXCLUSIVE: 10,
    PROOF_WORKSPACE_TEMP_EXCLUSIVE: 1,
  });
});

test("pins the exact ten read-only and sole workspace-temp proof ids", () => {
  assert.equal(PROOF_IDS.length, 68);
  assert.equal(new Set(PROOF_IDS).size, 68);
  const proofPairs = PROOF_IDS.map((proofId) => classifyProofPairState(proofId));
  assert.equal(proofPairs.filter(({ barrier }) => !barrier).length, 57);
  assert.equal(proofPairs.filter(({ barrier }) => barrier).length, 11);
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
  assert.equal(OS_TEMP_ROOT_PROOF_IDS.length, 57);
  assert.deepEqual(classifyProofPairState("control-plane-reference-preflight"), {
    proofId: "control-plane-reference-preflight",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-reference-preflight",
      executionClass: "PROOF_READ_ONLY",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "NONE",
      tempKey: null,
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-reference-preflight",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-reference-preflight",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("control-plane-runtime-staging"), {
    proofId: "control-plane-runtime-staging",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-runtime-staging",
      executionClass: "PROOF_READ_ONLY",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "NONE",
      tempKey: null,
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-runtime-staging",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-runtime-staging",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("control-plane-runtime-activation"), {
    proofId: "control-plane-runtime-activation",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-runtime-activation",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-control-plane-runtime-activation",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-runtime-activation",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-runtime-activation",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("control-plane-runtime-recovery"), {
    proofId: "control-plane-runtime-recovery",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-runtime-recovery",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-control-plane-runtime-recovery",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-runtime-recovery",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-runtime-recovery",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(CHILD_PROCESS_VERIFIER_PROOF_IDS, [
    "publisher-catalog-pinning",
    "publisher-bundle-publication",
    "publisher-official-golden",
    "publisher-invalid-source-matrix",
    "control-plane-bundle-store",
    "control-plane-bundle-verification",
    "control-plane-local-api",
    "control-plane-runtime-activation",
    "control-plane-runtime-recovery",
  ]);
  for (const proofId of CHILD_PROCESS_VERIFIER_PROOF_IDS) {
    assert.deepEqual(classifyWorkloadStateMetadata(`verify-${proofId}`), {
      schemaVersion: 2,
      stepId: `verify-${proofId}`,
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: `verify-${proofId}`,
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy:
        proofId === "control-plane-local-api"
          ? "CONTROL_PLANE_LOCAL_API_SQLITE"
          : proofId === "control-plane-runtime-activation"
            ? "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE"
            : proofId === "control-plane-runtime-recovery"
              ? "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE"
              : "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    });
  }
  assert.deepEqual(NATIVE_ADDON_PROOF_IDS, [
    "reference-host-web-source-audit",
    "control-plane-local-api",
    "control-plane-runtime-activation",
    "control-plane-runtime-recovery",
  ]);
  assert.deepEqual(NATIVE_ADDON_ROOT_STEP_IDS, [
    "test-publisher-invalid-source-matrix",
    "test-control-plane-local-api",
    "test-control-plane-runtime-activation",
    "test-control-plane-runtime-recovery",
  ]);
  assert.equal(
    classifyWorkloadStateMetadata("verify-reference-host-web-source-audit").nativeAddonPolicy,
    "REFERENCE_HOST_WEB_SOURCE_AUDIT",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-reference-host-web-source-audit").nativeAddonPolicy,
    "REFERENCE_HOST_WEB_SOURCE_AUDIT",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-publisher-invalid-source-matrix").nativeAddonPolicy,
    "PUBLISHER_INVALID_SOURCE_MATRIX_RUNTIME_PROBE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-control-plane-local-api").nativeAddonPolicy,
    "CONTROL_PLANE_LOCAL_API_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-control-plane-local-api").nativeAddonPolicy,
    "CONTROL_PLANE_LOCAL_API_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-control-plane-runtime-activation").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-control-plane-runtime-activation").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-control-plane-runtime-recovery").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-control-plane-runtime-recovery").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_RECOVERY_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-publisher-invalid-source-matrix").nativeAddonPolicy,
    "NONE",
  );
  assert.equal(classifyWorkloadStateMetadata("verify-protocol-snapshot").nativeAddonPolicy, "NONE");
  assert.equal(
    new Set([
      ...READ_ONLY_ROOT_PROOF_IDS,
      ...OS_TEMP_ROOT_PROOF_IDS,
      ...WORKSPACE_TEMP_ROOT_PROOF_IDS,
    ]).size,
    68,
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

test("ordinary proof pairs overlap while tracked aliases and source audit require barriers", () => {
  assert.deepEqual(
    assertProofPairsCanRunConcurrently("protocol-snapshot", "protocol-canonicalization"),
    {
      concurrency: 2,
      proofIds: ["protocol-snapshot", "protocol-canonicalization"],
    },
  );
  assert.deepEqual(
    assertProofPairsCanRunConcurrently(
      "control-plane-reference-preflight",
      "protocol-canonicalization",
    ),
    {
      concurrency: 2,
      proofIds: ["control-plane-reference-preflight", "protocol-canonicalization"],
    },
  );
  assert.deepEqual(FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS, [
    "test-reference-catalog-web-components",
    "test-reference-catalog-web-form-feedback",
    "test-reference-catalog-web-parity",
    "test-reference-catalog-web-capability-artifact",
    "test-reference-sign-in-fixtures-and-host-binding",
    "test-reference-tokens-and-synthetic-fixtures",
    "test-runtime-core-command-event-actions",
    "test-runtime-core-local-state-identity",
    "test-runtime-core-reactive-reevaluation",
    "test-sc-01-dtcg-compatibility",
  ]);
  for (const stepId of FILESYSTEM_COMPATIBILITY_TRACKED_ALIAS_STEP_IDS) {
    const proofId = stepId.slice("test-".length);
    assert.equal(classifyProofPairState(proofId).barrier, true);
  }
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

test("only the nine exact reviewed steps receive native-addon authority", async (context) => {
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
  const publisherMatrixVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-publisher-invalid-source-matrix",
    baseEnvironment: {},
  });
  const publisherMatrixRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-publisher-invalid-source-matrix",
    baseEnvironment: {},
  });
  const activationVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-control-plane-runtime-activation",
    baseEnvironment: {},
  });
  const activationRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-control-plane-runtime-activation",
    baseEnvironment: {},
  });
  const recoveryVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-control-plane-runtime-recovery",
    baseEnvironment: {},
  });
  const recoveryRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-control-plane-runtime-recovery",
    baseEnvironment: {},
  });
  context.after(async () => {
    await verifier.dispose();
    await rootTest.dispose();
    await ordinary.dispose();
    await publisherMatrixVerifier.dispose();
    await publisherMatrixRoot.dispose();
    await activationVerifier.dispose();
    await activationRoot.dispose();
    await recoveryVerifier.dispose();
    await recoveryRoot.dispose();
  });

  assert.equal(verifier.metadata.executionClass, "PROOF_READ_ONLY");
  assert.match(verifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(verifier.env.NODE_OPTIONS, /--allow-fs-write=/u);
  assert.match(rootTest.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(publisherMatrixVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(publisherMatrixRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(activationVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(activationRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(recoveryVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(recoveryRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(ordinary.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);

  const widened = mutableMetadata("verify-protocol-snapshot");
  widened.nativeAddonPolicy = "REFERENCE_HOST_WEB_SOURCE_AUDIT";
  assert.throws(
    () => validateWorkloadStateMetadata("verify-protocol-snapshot", widened),
    (error) => error.code === "SHARED_STATE_METADATA_DRIFT",
  );
});

test("filesystem compatibility is limited to eighteen reviewed workloads and exact rules", () => {
  assert.deepEqual(FILESYSTEM_COMPATIBILITY_ROOT_STEP_IDS, [
    "test-protocol-snapshot",
    "test-protocol-types",
    "test-protocol-official-suite-parity",
    "test-sc-01-a2ui-bridge",
    "test-reference-catalog-web-components",
    "test-reference-catalog-web-form-feedback",
    "test-reference-catalog-web-parity",
    "test-reference-catalog-web-capability-artifact",
    "test-reference-sign-in-fixtures-and-host-binding",
    "test-reference-tokens-and-synthetic-fixtures",
    "test-reference-host-web-shell",
    "test-reference-host-web-sign-in",
    "test-runtime-core-command-event-actions",
    "test-runtime-core-local-state-identity",
    "test-runtime-core-reactive-reevaluation",
    "test-runtime-react-reconciliation-diagnostics",
    "test-runtime-react-failure-boundary",
    "test-sc-01-dtcg-compatibility",
  ]);
  assert.equal(
    classifyWorkloadStateMetadata("test-protocol-snapshot").filesystemCompatibilityPolicy,
    "FIXTURE_COPY_AND_REVIEWED_SYMLINK",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-protocol-types").filesystemCompatibilityPolicy,
    "REVIEWED_SYMLINK",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-protocol-official-suite-parity")
      .filesystemCompatibilityPolicy,
    "FIXTURE_COPY",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-sc-01-a2ui-bridge").filesystemCompatibilityPolicy,
    "FIXTURE_COPY",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-reference-host-web-sign-in").filesystemCompatibilityPolicy,
    "REVIEWED_SYMLINK",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-protocol-diagnostics").filesystemCompatibilityPolicy,
    "NONE",
  );

  const policyCounts = {
    NONE: 0,
    FIXTURE_COPY: 0,
    REVIEWED_SYMLINK: 0,
    FIXTURE_COPY_AND_REVIEWED_SYMLINK: 0,
  };
  for (const stepId of ALL_STEP_IDS) {
    policyCounts[classifyWorkloadStateMetadata(stepId).filesystemCompatibilityPolicy] += 1;
  }
  assert.deepEqual(policyCounts, {
    NONE: 126,
    FIXTURE_COPY: 2,
    REVIEWED_SYMLINK: 15,
    FIXTURE_COPY_AND_REVIEWED_SYMLINK: 1,
  });

  const workspaceRuleEntries = Object.entries(FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES);
  const workspaceRules = workspaceRuleEntries.flatMap(([, rules]) => rules);
  assert.equal(workspaceRuleEntries.length, 14);
  assert.equal(workspaceRules.length, 18);
  assert.equal(
    workspaceRules.filter(
      ({ behavior }) =>
        behavior === FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS.TRACKED_ALIAS,
    ).length,
    10,
  );
  assert.equal(
    workspaceRules.filter(
      ({ behavior }) =>
        behavior === FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_BEHAVIORS.TEMP_FILE_MIRROR,
    ).length,
    8,
  );
  assert.deepEqual(FILESYSTEM_COMPATIBILITY_WORKSPACE_SYMLINK_RULES, {
    "test-reference-catalog-web-components": [
      {
        relativeTarget: "docs/proof/artifacts/reference-catalog-web-components.json",
        kind: "file",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-catalog-web-form-feedback": [
      {
        relativeTarget: "docs/proof/artifacts/reference-catalog-web-form-feedback.json",
        kind: "file",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-catalog-web-parity": [
      {
        relativeTarget: "docs/proof/artifacts/reference-catalog-web-parity.json",
        kind: "file",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-catalog-web-capability-artifact": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-sign-in-fixtures-and-host-binding": [
      {
        relativeTarget: "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json",
        kind: "file",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-tokens-and-synthetic-fixtures": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-reference-host-web-shell": [
      {
        relativeTarget: "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
      {
        relativeTarget: "docs/proof/REFERENCE-HOST-WEB-SHELL.md",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
    ],
    "test-reference-host-web-sign-in": [
      {
        relativeTarget: "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
      {
        relativeTarget: "docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
    ],
    "test-runtime-core-command-event-actions": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-runtime-core-local-state-identity": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-runtime-core-reactive-reevaluation": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
    "test-runtime-react-reconciliation-diagnostics": [
      {
        relativeTarget: "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
      {
        relativeTarget: "docs/proof/RUNTIME-REACT-RECONCILIATION-DIAGNOSTICS.md",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
    ],
    "test-runtime-react-failure-boundary": [
      {
        relativeTarget: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
      {
        relativeTarget: "docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md",
        kind: "file",
        behavior: "TEMP_FILE_MIRROR",
      },
    ],
    "test-sc-01-dtcg-compatibility": [
      {
        relativeTarget: "docs/proof/artifacts",
        kind: "directory",
        behavior: "TRACKED_ALIAS",
      },
    ],
  });

  const widened = mutableMetadata("test-protocol-diagnostics");
  widened.filesystemCompatibilityPolicy = "FIXTURE_COPY";
  assert.throws(
    () => validateWorkloadStateMetadata("test-protocol-diagnostics", widened),
    (error) => error.code === "SHARED_STATE_METADATA_INVALID",
  );
});

test("filesystem compatibility pins reviewed calls without widening generated grants", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-compat-workspace-");
  const externalRoot = await temporaryDirectory("desen-shared-state-compat-external-");
  context.after(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  });
  const sourceRoot = path.join(workspaceRoot, "packages/protocol/upstream/0.1.0/snapshot");
  const artifactRoot = path.join(workspaceRoot, "docs/proof/artifacts");
  const compatibilityPreloadPath = path.join(
    workspaceRoot,
    "scripts/ci/proof-filesystem-compatibility.cjs",
  );
  const trackedAliasTarget = path.join(artifactRoot, "reference-catalog-web-components.json");
  const mirroredAliasTarget = path.join(artifactRoot, "reference-host-web-0.1.0-shell.json");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(path.dirname(compatibilityPreloadPath), { recursive: true });
  await writeFile(compatibilityPreloadPath, await readFile(COMPATIBILITY_PRELOAD_PATH));
  await writeFile(path.join(sourceRoot, "source.txt"), "fixture\n");
  await writeFile(trackedAliasTarget, "tracked\n");
  await writeFile(mirroredAliasTarget, "mirrored\n");
  await writeFile(path.join(externalRoot, "outside.txt"), "outside\n");

  const compatible = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-snapshot",
    baseEnvironment: {},
  });
  const sibling = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-types",
    baseEnvironment: {},
  });
  const trackedAlias = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-reference-catalog-web-components",
    baseEnvironment: {},
  });
  const mirroredAlias = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-reference-host-web-shell",
    baseEnvironment: {},
  });
  const policyless = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-diagnostics",
    baseEnvironment: {
      DESEN_CI_FILESYSTEM_COMPATIBILITY: "FIXTURE_COPY",
      DESEN_CI_WORKSPACE_ROOT: externalRoot,
    },
  });
  context.after(async () => {
    await compatible.dispose();
    await sibling.dispose();
    await trackedAlias.dispose();
    await mirroredAlias.dispose();
    await policyless.dispose();
  });

  assert.equal(
    compatible.env.DESEN_CI_FILESYSTEM_COMPATIBILITY,
    "FIXTURE_COPY_AND_REVIEWED_SYMLINK",
  );
  assert.equal(compatible.env.DESEN_CI_WORKSPACE_ROOT, await realpath(workspaceRoot));
  assert.match(compatible.env.NODE_OPTIONS, /proof-filesystem-compatibility\.cjs/u);
  assert.equal(policyless.env.DESEN_CI_FILESYSTEM_COMPATIBILITY, undefined);
  assert.equal(policyless.env.DESEN_CI_WORKSPACE_ROOT, undefined);
  assert.doesNotMatch(policyless.env.NODE_OPTIONS, /proof-filesystem-compatibility\.cjs/u);
  assert.equal(trackedAlias.metadata.executionClass, "PROOF_TRACKED_ALIAS_EXCLUSIVE");
  assert.deepEqual(trackedAlias.metadata.workspaceWrites, [
    "docs/proof/artifacts/reference-catalog-web-components.json",
  ]);
  assert.equal(trackedAlias.metadata.barrier, true);
  assert.equal(trackedAlias.env.NODE_OPTIONS.includes(`--allow-fs-write=${workspaceRoot}`), false);
  assert.equal(
    compatible.env.NODE_OPTIONS.includes(`--allow-fs-read=${path.dirname(compatible.tempRoot)} `),
    false,
  );

  const destination = path.join(compatible.tempRoot, "copy");
  const linkPath = path.join(compatible.tempRoot, "relative-link.txt");
  const success = await runNode(
    [
      'const { cp, symlink } = require("node:fs/promises");',
      "void (async () => {",
      `  await cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(destination)}, { recursive: true, preserveTimestamps: true });`,
      `  await symlink("copy/source.txt", ${JSON.stringify(linkPath)});`,
      '  process.stdout.write("compatible");',
      "})();",
    ].join("\n"),
    compatible.env,
  );
  assert.equal(success.code, 0, success.stderr);
  assert.equal(success.stdout, "compatible");
  assert.equal(await readFile(path.join(destination, "source.txt"), "utf8"), "fixture\n");
  assert.equal(await readlink(linkPath), "copy/source.txt");

  const workspaceLinkPath = path.join(trackedAlias.tempRoot, "workspace-link.txt");
  const workspaceLink = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink(${JSON.stringify(trackedAliasTarget)}, ${JSON.stringify(workspaceLinkPath)});`,
    ].join("\n"),
    trackedAlias.env,
  );
  assert.equal(workspaceLink.code, 0, workspaceLink.stderr);
  assert.equal(await readlink(workspaceLinkPath), await realpath(trackedAliasTarget));

  const unreviewedWorkspaceTarget = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink(${JSON.stringify(path.join(sourceRoot, "source.txt"))}, ${JSON.stringify(path.join(trackedAlias.tempRoot, "unreviewed-link.txt"))});`,
    ].join("\n"),
    trackedAlias.env,
  );
  assert.notEqual(unreviewedWorkspaceTarget.code, 0);
  assert.match(unreviewedWorkspaceTarget.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const mirroredLinkPath = path.join(mirroredAlias.tempRoot, "mirrored-link.json");
  const mirroredLink = await runNode(
    [
      'const { symlink, writeFile } = require("node:fs/promises");',
      "void (async () => {",
      `  await symlink(${JSON.stringify(mirroredAliasTarget)}, ${JSON.stringify(mirroredLinkPath)});`,
      `  await writeFile(${JSON.stringify(mirroredLinkPath)}, "temp-only\\n");`,
      "})();",
    ].join("\n"),
    mirroredAlias.env,
  );
  assert.equal(mirroredLink.code, 0, mirroredLink.stderr);
  const mirroredTarget = await readlink(mirroredLinkPath);
  assert.equal(mirroredTarget.startsWith(`${mirroredAlias.tempRoot}${path.sep}`), true);
  assert.equal(await readFile(mirroredLinkPath, "utf8"), "temp-only\n");
  assert.equal(await readFile(mirroredAliasTarget, "utf8"), "mirrored\n");

  const reboundLinkPath = path.join(workspaceRoot, "rebound-link");
  const reboundEnvironment = {
    ...compatible.env,
    TMPDIR: workspaceRoot,
    TMP: workspaceRoot,
    TEMP: workspaceRoot,
  };
  const reboundTemp = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink("scripts/ci/proof-filesystem-compatibility.cjs", ${JSON.stringify(reboundLinkPath)});`,
    ].join("\n"),
    reboundEnvironment,
  );
  assert.notEqual(reboundTemp.code, 0);
  assert.match(reboundTemp.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);
  await assert.rejects(lstat(reboundLinkPath), { code: "ENOENT" });

  const reboundStepLinkPath = path.join(trackedAlias.tempRoot, "rebound-step-link");
  const reboundStep = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink(${JSON.stringify(mirroredAliasTarget)}, ${JSON.stringify(reboundStepLinkPath)});`,
    ].join("\n"),
    {
      ...trackedAlias.env,
      DESEN_CI_STEP_ID: "test-reference-host-web-shell",
    },
  );
  assert.notEqual(reboundStep.code, 0);
  assert.match(reboundStep.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);
  await assert.rejects(lstat(reboundStepLinkPath), { code: "ENOENT" });

  const siblingEscape = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(path.join(sibling.tempRoot, "copy"))}, { recursive: true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(siblingEscape.code, 0);
  assert.match(siblingEscape.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const sourceEscape = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(externalRoot)}, ${JSON.stringify(path.join(compatible.tempRoot, "outside-copy"))}, { recursive: true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(sourceEscape.code, 0);
  assert.match(sourceEscape.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const destinationEscape = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(path.join(workspaceRoot, "forbidden-copy"))}, { recursive: true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(destinationEscape.code, 0);
  assert.match(destinationEscape.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const relativeSymlinkEscape = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink(${JSON.stringify(path.relative(compatible.tempRoot, path.join(sibling.tempRoot, "forbidden.txt")))}, ${JSON.stringify(path.join(compatible.tempRoot, "forbidden-link"))});`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(relativeSymlinkEscape.code, 0);
  assert.match(relativeSymlinkEscape.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const redirectedParent = path.join(compatible.tempRoot, "redirected-parent");
  await symlink(sibling.tempRoot, redirectedParent, "dir");
  const redirectedCopy = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(path.join(redirectedParent, "copy"))}, { recursive: true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(redirectedCopy.code, 0);
  assert.match(redirectedCopy.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);
  await assert.rejects(readFile(path.join(sibling.tempRoot, "copy/source.txt")), {
    code: "ENOENT",
  });

  const trackedRedirectedParent = path.join(trackedAlias.tempRoot, "redirected-parent");
  await symlink(sibling.tempRoot, trackedRedirectedParent, "dir");
  const redirectedSymlink = await runNode(
    [
      'const { symlink } = require("node:fs/promises");',
      `void symlink(${JSON.stringify(trackedAliasTarget)}, ${JSON.stringify(path.join(trackedRedirectedParent, "link.txt"))});`,
    ].join("\n"),
    trackedAlias.env,
  );
  assert.notEqual(redirectedSymlink.code, 0);
  assert.match(redirectedSymlink.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const externalSourceLink = path.join(sourceRoot, "external-link.txt");
  await symlink(path.join(externalRoot, "outside.txt"), externalSourceLink);
  const linkedSourceEscape = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(path.join(compatible.tempRoot, "linked-source-copy"))}, { recursive: true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(linkedSourceEscape.code, 0);
  assert.match(linkedSourceEscape.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const unsupportedCopyOptions = await runNode(
    [
      'const { cp } = require("node:fs/promises");',
      `void cp(${JSON.stringify(sourceRoot)}, ${JSON.stringify(path.join(compatible.tempRoot, "filtered-copy"))}, { recursive: true, filter: () => true });`,
    ].join("\n"),
    compatible.env,
  );
  assert.notEqual(unsupportedCopyOptions.code, 0);
  assert.match(unsupportedCopyOptions.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);

  const mismatchedEnvironment = {
    ...compatible.env,
    DESEN_CI_STEP_ID: "test-protocol-diagnostics",
  };
  const policyMismatch = await runNode(
    'process.stdout.write("unreachable")',
    mismatchedEnvironment,
  );
  assert.notEqual(policyMismatch.code, 0);
  assert.match(policyMismatch.stderr, /DESEN_CI_FILESYSTEM_COMPATIBILITY_INVALID/u);
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
    workload: "test-protocol-diagnostics",
    baseEnvironment: {},
  });
  const second = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-protocol-structural-validation",
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

test("only the exact source-audit root test receives a direct workspace-write grant", async (context) => {
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
    workload: "test-protocol-diagnostics",
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
