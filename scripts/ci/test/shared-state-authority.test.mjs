import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  link,
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
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { createExhaustiveWorkloadInventory } from "../exhaustive-workload-inventory.mjs";
import { createReferenceHostWebChannelConsumptionRuntimeEnvironment } from "../../lib/reference-host-web-channel-consumption-proof.mjs";
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
  LOOPBACK_CHILD_LISTENER_VERIFIER_STEP_IDS,
  OS_TEMP_ONLY_VERIFIER_PROOF_IDS,
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
const LISTENER_GUARD_PATH = path.join(REPOSITORY_ROOT, "scripts/ci/no-proof-listener.cjs");
const VITEST_CLI_PATH = path.join(REPOSITORY_ROOT, "node_modules/vitest/vitest.mjs");
const LOOPBACK_AUTHORITY_PATH_KEY = "DESEN_CI_LOOPBACK_CHILD_LISTENER_AUTHORITY_PATH";
const LOOPBACK_GRANT_KEY = "DESEN_CI_LOOPBACK_CHILD_LISTENER_GRANT";
const LOOPBACK_TOKEN_KEY = "DESEN_CI_LOOPBACK_CHILD_LISTENER_TOKEN";

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
  "editor-core-public-package-contract",
  "editor-web-public-package-contract",
  ...PROOF_IDS.map((id) => `verify-${id}`),
  ...PROOF_IDS.map((id) => `test-${id}`),
  "dependency-boundaries",
  "boundary-fixtures",
]);

test("owns exactly 194 steps across the seven reviewed execution classes", () => {
  const counts = Object.fromEntries(Object.values(EXECUTION_CLASSES).map((id) => [id, 0]));
  for (const stepId of ALL_STEP_IDS) {
    counts[classifyWorkloadStateMetadata(stepId).executionClass] += 1;
  }

  assert.equal(ALL_STEP_IDS.length, 194);
  assert.equal(new Set(ALL_STEP_IDS).size, 194);
  assert.deepEqual(counts, {
    GLOBAL_EXCLUSIVE: 6,
    WORKSPACE_OUTPUT_EXCLUSIVE: 3,
    PACKAGE_TEST_EXCLUSIVE: 1,
    PROOF_READ_ONLY: 79,
    PROOF_OS_TEMP_ISOLATED: 94,
    PROOF_TRACKED_ALIAS_EXCLUSIVE: 10,
    PROOF_WORKSPACE_TEMP_EXCLUSIVE: 1,
  });
  assert.deepEqual(classifyWorkloadStateMetadata("editor-core-public-package-contract"), {
    schemaVersion: 2,
    stepId: "editor-core-public-package-contract",
    executionClass: "WORKSPACE_OUTPUT_EXCLUSIVE",
    workspaceReads: ["."],
    workspaceWrites: ["."],
    tempPolicy: "NONE",
    tempKey: null,
    ports: [],
    childProcessPolicy: "TOOLCHAIN_EXCLUSIVE",
    nativeAddonPolicy: "NONE",
    filesystemCompatibilityPolicy: "NONE",
    barrier: true,
  });
  assert.deepEqual(classifyWorkloadStateMetadata("editor-web-public-package-contract"), {
    schemaVersion: 2,
    stepId: "editor-web-public-package-contract",
    executionClass: "WORKSPACE_OUTPUT_EXCLUSIVE",
    workspaceReads: ["."],
    workspaceWrites: ["."],
    tempPolicy: "NONE",
    tempKey: null,
    ports: [],
    childProcessPolicy: "TOOLCHAIN_EXCLUSIVE",
    nativeAddonPolicy: "NONE",
    filesystemCompatibilityPolicy: "NONE",
    barrier: true,
  });
});

test("pins the exact ten read-only and sole workspace-temp proof ids", () => {
  assert.equal(PROOF_IDS.length, 92);
  assert.equal(new Set(PROOF_IDS).size, 92);
  const proofPairs = PROOF_IDS.map((proofId) => classifyProofPairState(proofId));
  assert.equal(proofPairs.filter(({ barrier }) => !barrier).length, 81);
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
  assert.equal(OS_TEMP_ROOT_PROOF_IDS.length, 81);
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
  assert.deepEqual(classifyProofPairState("editor-core-source-document"), {
    proofId: "editor-core-source-document",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-editor-core-source-document",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-editor-core-source-document",
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-editor-core-source-document",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-editor-core-source-document",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("editor-core-stable-id-insert"), {
    proofId: "editor-core-stable-id-insert",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-editor-core-stable-id-insert",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-editor-core-stable-id-insert",
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-editor-core-stable-id-insert",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-editor-core-stable-id-insert",
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
  assert.deepEqual(classifyProofPairState("control-plane-runtime-fault-injection"), {
    proofId: "control-plane-runtime-fault-injection",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-runtime-fault-injection",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-control-plane-runtime-fault-injection",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-runtime-fault-injection",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-runtime-fault-injection",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("control-plane-runtime-transition-races"), {
    proofId: "control-plane-runtime-transition-races",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-control-plane-runtime-transition-races",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-control-plane-runtime-transition-races",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-control-plane-runtime-transition-races",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-control-plane-runtime-transition-races",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("reference-host-web-channel-consumption"), {
    proofId: "reference-host-web-channel-consumption",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-reference-host-web-channel-consumption",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-reference-host-web-channel-consumption",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-reference-host-web-channel-consumption",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-reference-host-web-channel-consumption",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
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
    "control-plane-runtime-fault-injection",
    "control-plane-runtime-transition-races",
    "reference-host-web-channel-consumption",
    "desen-app-real-adapter-canvas",
  ]);
  assert.equal(CHILD_PROCESS_VERIFIER_PROOF_IDS.length, 13);
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
              : proofId === "control-plane-runtime-fault-injection"
                ? "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE"
                : proofId === "control-plane-runtime-transition-races"
                  ? "CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE"
                  : proofId === "reference-host-web-channel-consumption"
                    ? "REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_SQLITE"
                    : proofId === "desen-app-real-adapter-canvas"
                      ? "DESEN_APP_REAL_ADAPTER_CANVAS_VITE"
                      : "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    });
  }
  assert.deepEqual(OS_TEMP_ONLY_VERIFIER_PROOF_IDS, [
    "editor-core-source-document",
    "editor-core-stable-id-insert",
    "editor-core-structural-edits",
    "editor-core-content-edits",
    "editor-core-state-binding-edits",
    "editor-core-event-action-edits",
    "editor-core-authoring-round-trip",
    "editor-core-persistence",
    "editor-core-continuous-validation",
    "editor-core-terminal-integration",
  ]);
  assert.deepEqual(classifyWorkloadStateMetadata("verify-editor-core-source-document"), {
    schemaVersion: 2,
    stepId: "verify-editor-core-source-document",
    executionClass: "PROOF_OS_TEMP_ISOLATED",
    workspaceReads: ["."],
    workspaceWrites: [],
    tempPolicy: "RUNNER_SCOPED_OS",
    tempKey: "verify-editor-core-source-document",
    ports: [],
    childProcessPolicy: "NONE",
    nativeAddonPolicy: "NONE",
    filesystemCompatibilityPolicy: "NONE",
    barrier: false,
  });
  assert.deepEqual(classifyProofPairState("editor-core-continuous-validation"), {
    proofId: "editor-core-continuous-validation",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-editor-core-continuous-validation",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-editor-core-continuous-validation",
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-editor-core-continuous-validation",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-editor-core-continuous-validation",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("editor-core-terminal-integration"), {
    proofId: "editor-core-terminal-integration",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-editor-core-terminal-integration",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-editor-core-terminal-integration",
      ports: [],
      childProcessPolicy: "NONE",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-editor-core-terminal-integration",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-editor-core-terminal-integration",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-catalog-panel-layer-tree"), {
    proofId: "desen-app-catalog-panel-layer-tree",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-catalog-panel-layer-tree",
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
      stepId: "test-desen-app-catalog-panel-layer-tree",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-catalog-panel-layer-tree",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-real-adapter-canvas"), {
    proofId: "desen-app-real-adapter-canvas",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-real-adapter-canvas",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "verify-desen-app-real-adapter-canvas",
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "DESEN_APP_REAL_ADAPTER_CANVAS_VITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: "test-desen-app-real-adapter-canvas",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-real-adapter-canvas",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "DESEN_APP_REAL_ADAPTER_CANVAS_VITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-selection-overlay"), {
    proofId: "desen-app-selection-overlay",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-selection-overlay",
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
      stepId: "test-desen-app-selection-overlay",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-selection-overlay",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-schema-inspector"), {
    proofId: "desen-app-schema-inspector",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-schema-inspector",
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
      stepId: "test-desen-app-schema-inspector",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-schema-inspector",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-structured-inspector"), {
    proofId: "desen-app-structured-inspector",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-structured-inspector",
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
      stepId: "test-desen-app-structured-inspector",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-structured-inspector",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-named-slot-authoring"), {
    proofId: "desen-app-named-slot-authoring",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-named-slot-authoring",
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
      stepId: "test-desen-app-named-slot-authoring",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-named-slot-authoring",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-state-binding-editor"), {
    proofId: "desen-app-state-binding-editor",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-state-binding-editor",
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
      stepId: "test-desen-app-state-binding-editor",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-state-binding-editor",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-event-action-editor"), {
    proofId: "desen-app-event-action-editor",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-event-action-editor",
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
      stepId: "test-desen-app-event-action-editor",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-event-action-editor",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-design-run-modes"), {
    proofId: "desen-app-design-run-modes",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-design-run-modes",
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
      stepId: "test-desen-app-design-run-modes",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-design-run-modes",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(classifyProofPairState("desen-app-fixtures-scenarios-fidelity"), {
    proofId: "desen-app-fixtures-scenarios-fidelity",
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: "verify-desen-app-fixtures-scenarios-fidelity",
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
      stepId: "test-desen-app-fixtures-scenarios-fidelity",
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: "test-desen-app-fixtures-scenarios-fidelity",
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  });
  assert.deepEqual(NATIVE_ADDON_PROOF_IDS, [
    "reference-host-web-source-audit",
    "control-plane-local-api",
    "control-plane-runtime-activation",
    "control-plane-runtime-recovery",
    "control-plane-runtime-fault-injection",
    "control-plane-runtime-transition-races",
    "reference-host-web-channel-consumption",
    "editor-core-persistence",
    "desen-app-real-adapter-canvas",
  ]);
  assert.equal(NATIVE_ADDON_PROOF_IDS.length, 9);
  assert.deepEqual(NATIVE_ADDON_ROOT_STEP_IDS, [
    "test-publisher-invalid-source-matrix",
    "test-control-plane-local-api",
    "test-control-plane-runtime-activation",
    "test-control-plane-runtime-recovery",
    "test-control-plane-runtime-fault-injection",
    "test-editor-core-persistence",
    "test-desen-app-real-adapter-canvas",
  ]);
  assert.equal(
    new Set([
      ...NATIVE_ADDON_PROOF_IDS.flatMap((proofId) => [
        `verify-${proofId}`,
        ...(proofId === "reference-host-web-source-audit" ? [`test-${proofId}`] : []),
      ]),
      ...NATIVE_ADDON_ROOT_STEP_IDS,
    ]).size,
    17,
  );
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
    classifyWorkloadStateMetadata("verify-control-plane-runtime-fault-injection").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-control-plane-runtime-fault-injection").nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-control-plane-runtime-transition-races")
      .nativeAddonPolicy,
    "CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-control-plane-runtime-transition-races").nativeAddonPolicy,
    "NONE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-reference-host-web-channel-consumption")
      .nativeAddonPolicy,
    "REFERENCE_HOST_WEB_CHANNEL_CONSUMPTION_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-reference-host-web-channel-consumption").nativeAddonPolicy,
    "NONE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-editor-core-persistence").nativeAddonPolicy,
    "EDITOR_CORE_PERSISTENCE_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-editor-core-persistence").nativeAddonPolicy,
    "EDITOR_CORE_PERSISTENCE_SQLITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-desen-app-real-adapter-canvas").nativeAddonPolicy,
    "DESEN_APP_REAL_ADAPTER_CANVAS_VITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("test-desen-app-real-adapter-canvas").nativeAddonPolicy,
    "DESEN_APP_REAL_ADAPTER_CANVAS_VITE",
  );
  assert.equal(
    classifyWorkloadStateMetadata("verify-publisher-invalid-source-matrix").nativeAddonPolicy,
    "NONE",
  );
  assert.equal(classifyWorkloadStateMetadata("verify-protocol-snapshot").nativeAddonPolicy, "NONE");
  assert.deepEqual(LOOPBACK_CHILD_LISTENER_VERIFIER_STEP_IDS, [
    "verify-reference-host-web-channel-consumption",
  ]);
  assert.equal(
    new Set([
      ...READ_ONLY_ROOT_PROOF_IDS,
      ...OS_TEMP_ROOT_PROOF_IDS,
      ...WORKSPACE_TEMP_ROOT_PROOF_IDS,
    ]).size,
    92,
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

test("the editor verifier receives only its runner-owned temp-write authority", async (context) => {
  const workspaceRoot = await temporaryDirectory("desen-shared-state-editor-verifier-");
  context.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const isolation = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-editor-core-source-document",
    baseEnvironment: {},
  });
  context.after(() => isolation.dispose());

  assert.match(isolation.env.NODE_OPTIONS, /--allow-fs-write=/u);
  assert.doesNotMatch(isolation.env.NODE_OPTIONS, /(?:^| )--allow-child-process(?: |$)/u);
  const ownPath = path.join(isolation.tempRoot, "runtime-copy.mjs");
  const ownWrite = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(ownPath)}, "export {}")`,
    isolation.env,
  );
  assert.equal(ownWrite.code, 0, ownWrite.stderr);
  assert.equal(await readFile(ownPath, "utf8"), "export {}");

  const workspaceWrite = await runNode(
    `require("node:fs").writeFileSync(${JSON.stringify(path.join(workspaceRoot, "forbidden"))}, "no")`,
    isolation.env,
  );
  assert.notEqual(workspaceWrite.code, 0);
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

test(
  "only the exact M07-T11 Vitest child tree receives authenticated loopback port-zero authority",
  { timeout: 30_000 },
  async (context) => {
    const poisonedBaseEnvironment = {
      DESEN_CI_LOOPBACK_CHILD_LISTENER_AUTHORITY_PATH: "/tmp/ambient-authority.json",
      DESEN_CI_LOOPBACK_CHILD_LISTENER_GRANT: "a".repeat(64),
      DESEN_CI_LOOPBACK_CHILD_LISTENER_TOKEN: "a".repeat(64),
    };
    const first = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "verify-reference-host-web-channel-consumption",
      baseEnvironment: poisonedBaseEnvironment,
    });
    const second = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "verify-reference-host-web-channel-consumption",
      baseEnvironment: {},
    });
    const third = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "verify-reference-host-web-channel-consumption",
      baseEnvironment: {},
    });
    const rootTest = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "test-reference-host-web-channel-consumption",
      baseEnvironment: poisonedBaseEnvironment,
    });
    const otherVerifier = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "verify-control-plane-runtime-transition-races",
      baseEnvironment: poisonedBaseEnvironment,
    });
    context.after(async () => {
      await first.dispose();
      await second.dispose();
      await third.dispose();
      await rootTest.dispose();
      await otherVerifier.dispose();
    });

    const authorityPath = first.env[LOOPBACK_AUTHORITY_PATH_KEY];
    const token = first.env[LOOPBACK_TOKEN_KEY];
    assert.equal(path.dirname(authorityPath), first.tempRoot);
    assert.equal(path.basename(authorityPath), ".desen-ci-loopback-child-listener-authority.json");
    assert.match(token, /^[0-9a-f]{64}$/u);
    assert.notEqual(token, poisonedBaseEnvironment[LOOPBACK_TOKEN_KEY]);
    assert.notEqual(token, second.env[LOOPBACK_TOKEN_KEY]);
    assert.equal(first.env[LOOPBACK_GRANT_KEY], undefined);
    assert.equal(rootTest.env[LOOPBACK_AUTHORITY_PATH_KEY], undefined);
    assert.equal(rootTest.env[LOOPBACK_TOKEN_KEY], undefined);
    assert.equal(rootTest.env[LOOPBACK_GRANT_KEY], undefined);
    assert.equal(otherVerifier.env[LOOPBACK_AUTHORITY_PATH_KEY], undefined);
    assert.equal(otherVerifier.env[LOOPBACK_TOKEN_KEY], undefined);
    assert.equal(otherVerifier.env[LOOPBACK_GRANT_KEY], undefined);

    const authorityEntry = await lstat(authorityPath, { bigint: true });
    assert.equal(authorityEntry.isFile(), true);
    assert.equal(authorityEntry.isSymbolicLink(), false);
    assert.equal(authorityEntry.nlink, 1n);
    assert.equal(Number(authorityEntry.mode & 0o777n), 0o600);
    assert.equal(await realpath(authorityPath), authorityPath);
    assert.deepEqual(JSON.parse(await readFile(authorityPath, "utf8")), {
      profile: "desen.ci.loopback-child-listener-authority.v1",
      stepId: "verify-reference-host-web-channel-consumption",
      runtime: "VITEST_CHILD_PROCESS_TREE",
      transport: "TCP",
      family: "IPv4",
      address: "127.0.0.1",
      port: 0,
      workspaceRoot: REPOSITORY_ROOT,
      tokenSha256: createHash("sha256").update(token).digest("hex"),
    });

    const parent = await runNode(
      [
        `process.env.${LOOPBACK_GRANT_KEY} = process.env.${LOOPBACK_TOKEN_KEY};`,
        'require("node:net").createServer().listen(0, "127.0.0.1");',
      ].join("\n"),
      first.env,
    );
    assert.notEqual(parent.code, 0);
    assert.match(parent.stderr, /Proof workloads may not bind network listeners/u);

    const childEnvironment = createReferenceHostWebChannelConsumptionRuntimeEnvironment(first.env);
    assert.equal(childEnvironment.NODE_OPTIONS, first.env.NODE_OPTIONS);
    assert.equal(childEnvironment[LOOPBACK_GRANT_KEY], token);
    assert.equal(childEnvironment[LOOPBACK_AUTHORITY_PATH_KEY], authorityPath);
    assert.equal(childEnvironment[LOOPBACK_TOKEN_KEY], token);
    const childProbe = await runNode(
      [
        `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)});`,
        'if (!guard.listenerAuthorityActive) throw new Error("listener authority inactive");',
        `if (process.env.${LOOPBACK_GRANT_KEY} !== process.env.${LOOPBACK_TOKEN_KEY}) throw new Error("grant inheritance drift");`,
        'if (!process.env.NODE_OPTIONS.includes("no-proof-listener.cjs")) throw new Error("NODE_OPTIONS drift");',
        'if (!guard.isExactLoopbackEphemeralListenArguments([0, "127.0.0.1"])) throw new Error("positional listener denied");',
        'if (!guard.isExactLoopbackEphemeralListenArguments([{host: "127.0.0.1", port: 0, cb() {}}])) throw new Error("Fastify listener denied");',
        'for (const args of [[0], [0, "localhost"], [0, "::1"], [0, "0.0.0.0"], [4317, "127.0.0.1"], [{host: "127.0.0.1", port: 0, exclusive: true}], ["/tmp/socket"]]) if (guard.isExactLoopbackEphemeralListenArguments(args)) throw new Error("listener widening");',
        'for (const args of [[4317, "127.0.0.1"], [0, "localhost"], [0, "0.0.0.0"], ["/tmp/socket"]]) { try { require("node:net").createServer().listen(...args); throw new Error("invalid listener admitted"); } catch (error) { if (error.code !== guard.LISTENER_ERROR_CODE) throw error; } }',
        'const normalized = [{highWaterMark: 65536, path: undefined, localAddress: null, port: "4317", host: "127.0.0.1"}, null];',
        'Object.defineProperty(normalized, Symbol("normalizedArgs"), {value: true, enumerable: true, configurable: true, writable: true});',
        'if (!guard.isExactActiveLoopbackConnectArguments([normalized], new Set([4317]))) throw new Error("owned loopback connect denied");',
        'if (guard.isExactActiveLoopbackConnectArguments([normalized], new Set([4318]))) throw new Error("unowned connect admitted");',
        'normalized[0].host = "8.8.8.8";',
        'if (guard.isExactActiveLoopbackConnectArguments([normalized], new Set([4317]))) throw new Error("public connect admitted");',
        'try { require("node:net").connect({host: "8.8.8.8", port: 53}); throw new Error("external TCP admitted"); } catch (error) { if (error.code !== guard.NETWORK_ERROR_CODE) throw error; }',
        'try { require("node:net").connect({host: "127.0.0.1", port: 4317}); throw new Error("unowned loopback TCP admitted"); } catch (error) { if (error.code !== guard.NETWORK_ERROR_CODE) throw error; }',
        'try { require("node:dgram").createSocket("udp4").bind(0); throw new Error("UDP admitted"); } catch (error) { if (error.code !== guard.LISTENER_ERROR_CODE) throw error; }',
        "let numericLookupCompleted = false;",
        'require("node:dns").lookup("127.0.0.1", {all: true}, (error, addresses) => { if (error !== null || JSON.stringify(addresses) !== JSON.stringify([{address: "127.0.0.1", family: 4}])) throw new Error("numeric loopback lookup drift"); numericLookupCompleted = true; });',
        'for (const args of [["example.com", {all: true}, () => {}], ["127.0.0.2", {all: true}, () => {}], ["::1", {all: true}, () => {}], ["127.0.0.1", {all: false}, () => {}], ["127.0.0.1", {all: true, family: 4}, () => {}]]) { try { require("node:dns").lookup(...args); throw new Error("DNS lookup widening admitted"); } catch (error) { if (error.code !== guard.NETWORK_ERROR_CODE) throw error; } }',
        'try { require("node:dns").resolve("example.com", () => {}); throw new Error("DNS admitted"); } catch (error) { if (error.code !== guard.NETWORK_ERROR_CODE) throw error; }',
        'try { require("node:dns/promises").resolve("example.com"); throw new Error("promise DNS admitted"); } catch (error) { if (error.code !== guard.NETWORK_ERROR_CODE) throw error; }',
        'try { require("node:child_process").spawnSync("curl", ["https://example.com"]); throw new Error("external child admitted"); } catch (error) { if (error.code !== guard.CHILD_PROCESS_ERROR_CODE) throw error; }',
        'setImmediate(() => { if (!numericLookupCompleted) throw new Error("numeric loopback lookup was not asynchronous"); process.stdout.write("child-policy-ok"); });',
      ].join("\n"),
      childEnvironment,
    );
    assert.equal(childProbe.code, 0, childProbe.stderr);
    assert.equal(childProbe.stdout, "child-policy-ok");

    const wrongGrant = await runNode(
      `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)}); if (guard.listenerAuthorityActive) throw new Error("wrong grant admitted"); process.stdout.write("denied");`,
      { ...first.env, [LOOPBACK_GRANT_KEY]: "0".repeat(64) },
    );
    assert.equal(wrongGrant.code, 0, wrongGrant.stderr);
    assert.equal(wrongGrant.stdout, "denied");

    const changedStep = await runNode(
      `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)}); if (guard.listenerAuthorityActive) throw new Error("wrong step admitted"); process.stdout.write("denied");`,
      { ...childEnvironment, DESEN_CI_STEP_ID: "verify-control-plane-runtime-transition-races" },
    );
    assert.equal(changedStep.code, 0, changedStep.stderr);
    assert.equal(changedStep.stdout, "denied");

    const hardLinkPath = path.join(first.tempRoot, "linked-authority.json");
    await link(authorityPath, hardLinkPath);
    const linkedAuthority = await runNode(
      `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)}); if (guard.listenerAuthorityActive) throw new Error("linked authority admitted"); process.stdout.write("denied");`,
      childEnvironment,
    );
    assert.equal(linkedAuthority.code, 0, linkedAuthority.stderr);
    assert.equal(linkedAuthority.stdout, "denied");

    const secondAuthorityPath = second.env[LOOPBACK_AUTHORITY_PATH_KEY];
    await chmod(secondAuthorityPath, 0o644);
    const relaxedMode = await runNode(
      `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)}); if (guard.listenerAuthorityActive) throw new Error("relaxed authority admitted"); process.stdout.write("denied");`,
      createReferenceHostWebChannelConsumptionRuntimeEnvironment(second.env),
    );
    assert.equal(relaxedMode.code, 0, relaxedMode.stderr);
    assert.equal(relaxedMode.stdout, "denied");

    const thirdAuthorityPath = third.env[LOOPBACK_AUTHORITY_PATH_KEY];
    const thirdAuthorityBytes = await readFile(thirdAuthorityPath, "utf8");
    await writeFile(thirdAuthorityPath, `${thirdAuthorityBytes}\n`, { mode: 0o600 });
    const noncanonicalAuthority = await runNode(
      `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)}); if (guard.listenerAuthorityActive) throw new Error("noncanonical authority admitted"); process.stdout.write("denied");`,
      createReferenceHostWebChannelConsumptionRuntimeEnvironment(third.env),
    );
    assert.equal(noncanonicalAuthority.code, 0, noncanonicalAuthority.stderr);
    assert.equal(noncanonicalAuthority.stdout, "denied");
  },
);

test(
  "the M07-T11 Vitest fork inherits the unchanged guarded NODE_OPTIONS and child grant",
  { timeout: 30_000 },
  async (context) => {
    const isolation = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload: "verify-reference-host-web-channel-consumption",
      baseEnvironment: {},
    });
    context.after(() => isolation.dispose());
    const testPath = path.join(isolation.tempRoot, "listener-authority-inheritance.test.mjs");
    const configPath = path.join(isolation.tempRoot, "vitest.config.mjs");
    await writeFile(
      testPath,
      [
        'import { createRequire } from "node:module";',
        "const require = createRequire(import.meta.url);",
        `const guard = require(${JSON.stringify(LISTENER_GUARD_PATH)});`,
        'it("inherits the exact child listener authority", () => {',
        "  expect(guard.listenerAuthorityActive).toBe(true);",
        `  expect(process.env.${LOOPBACK_GRANT_KEY}).toBe(process.env.${LOOPBACK_TOKEN_KEY});`,
        `  expect(process.env.TMPDIR).toBe(${JSON.stringify(isolation.tempRoot)});`,
        '  expect(process.env.NODE_OPTIONS).toContain("--require=");',
        '  expect(process.env.NODE_OPTIONS).toContain("no-proof-listener.cjs");',
        '  expect(guard.isExactLoopbackEphemeralListenArguments([0, "127.0.0.1"])).toBe(true);',
        '  expect(() => require("node:child_process").spawnSync("curl", ["https://example.com"])).toThrow(expect.objectContaining({code: guard.CHILD_PROCESS_ERROR_CODE}));',
        "});",
        "",
      ].join("\n"),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      configPath,
      'export default { test: { cache: false, fileParallelism: false, globals: true, maxWorkers: 1, pool: "forks" } };\n',
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      path.join(isolation.tempRoot, "package.json"),
      '{"private":true,"type":"module"}\n',
      {
        flag: "wx",
        mode: 0o600,
      },
    );
    await writeFile(path.join(isolation.tempRoot, "pnpm-workspace.yaml"), "packages: []\n", {
      flag: "wx",
      mode: 0o600,
    });
    const runtimeEnvironment = createReferenceHostWebChannelConsumptionRuntimeEnvironment({
      ...isolation.env,
      NODE_PATH: "/unreviewed/node/path",
    });
    assert.equal(runtimeEnvironment.NODE_PATH, undefined);
    assert.equal(runtimeEnvironment.NODE_OPTIONS, isolation.env.NODE_OPTIONS);
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        VITEST_CLI_PATH,
        "run",
        testPath,
        "--config",
        configPath,
        "--configLoader=native",
        "--no-cache",
        "--no-file-parallelism",
        "--maxWorkers=1",
        "--pool=forks",
      ],
      {
        cwd: isolation.tempRoot,
        encoding: "utf8",
        env: runtimeEnvironment,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 20_000,
      },
    );
    assert.match(stdout, /1 passed/u);
    assert.equal(stderr, "");
  },
);

test(
  "the dependency-free T09 Vitest probe completes inside its exact proof isolation",
  { timeout: 30_000 },
  async () => {
    const workload = createExhaustiveWorkloadInventory().nodes.find(
      ({ id }) => id === "verify-control-plane-runtime-fault-injection",
    );
    assert.notEqual(workload, undefined);
    const isolation = await createProofStepIsolationContext({
      workspaceRoot: REPOSITORY_ROOT,
      workload,
    });
    try {
      const proofLibraryUrl = pathToFileURL(
        path.join(REPOSITORY_ROOT, "scripts/lib/control-plane-runtime-fault-injection-proof.mjs"),
      ).href;
      const probeSource = [
        `import { runControlPlaneRuntimeFaultInjectionVitestIsolationProbe as run } from ${JSON.stringify(proofLibraryUrl)};`,
        "process.stdout.write(JSON.stringify(await run()));",
      ].join("\n");
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ["--input-type=module", "--eval", probeSource],
        {
          cwd: REPOSITORY_ROOT,
          encoding: "utf8",
          env: isolation.env,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 20_000,
        },
      );
      assert.equal(stderr, "");
      assert.deepEqual(JSON.parse(stdout), {
        profile: "desen.control-plane.runtime-fault-injection-vitest-isolation.v1",
        status: "PASS",
        testCount: 1,
      });
    } finally {
      await isolation.dispose();
    }
  },
);

test("only the seventeen exact reviewed steps receive native-addon authority", async (context) => {
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
  const faultInjectionVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-control-plane-runtime-fault-injection",
    baseEnvironment: {},
  });
  const faultInjectionRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-control-plane-runtime-fault-injection",
    baseEnvironment: {},
  });
  const transitionRacesVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-control-plane-runtime-transition-races",
    baseEnvironment: {},
  });
  const transitionRacesRoot = await createProofStepIsolationContext({
    workspaceRoot: REPOSITORY_ROOT,
    workload: "test-control-plane-runtime-transition-races",
    baseEnvironment: {},
  });
  const channelConsumptionVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-reference-host-web-channel-consumption",
    baseEnvironment: {},
  });
  const channelConsumptionRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-reference-host-web-channel-consumption",
    baseEnvironment: {},
  });
  const persistenceVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-editor-core-persistence",
    baseEnvironment: {},
  });
  const persistenceRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-editor-core-persistence",
    baseEnvironment: {},
  });
  const adapterVerifier = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "verify-desen-app-real-adapter-canvas",
    baseEnvironment: {},
  });
  const adapterRoot = await createProofStepIsolationContext({
    workspaceRoot,
    workload: "test-desen-app-real-adapter-canvas",
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
    await faultInjectionVerifier.dispose();
    await faultInjectionRoot.dispose();
    await transitionRacesVerifier.dispose();
    await transitionRacesRoot.dispose();
    await channelConsumptionVerifier.dispose();
    await channelConsumptionRoot.dispose();
    await persistenceVerifier.dispose();
    await persistenceRoot.dispose();
    await adapterVerifier.dispose();
    await adapterRoot.dispose();
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
  assert.match(faultInjectionVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(faultInjectionRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(transitionRacesVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(transitionRacesRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(channelConsumptionVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.doesNotMatch(channelConsumptionRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(persistenceVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(persistenceRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(adapterVerifier.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(adapterRoot.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);
  assert.match(adapterVerifier.env.NODE_OPTIONS, /(?:^| )--allow-child-process(?: |$)/u);
  assert.doesNotMatch(ordinary.env.NODE_OPTIONS, /(?:^| )--allow-addons(?: |$)/u);

  const sqliteModulePath = path.join(
    REPOSITORY_ROOT,
    "apps/control-plane-api/node_modules/better-sqlite3",
  );
  const deniedRootAddon = await runNode(
    `const Database = require(${JSON.stringify(sqliteModulePath)}); new Database(":memory:");`,
    transitionRacesRoot.env,
  );
  assert.notEqual(deniedRootAddon.code, 0);
  assert.match(deniedRootAddon.stderr, /Cannot load native addon|ERR_DLOPEN_DISABLED/u);

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
    NONE: 176,
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

test("the default preload denies TCP and UDP listener binding", async (context) => {
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
  assert.equal(BUILD_OUTPUT_ROOTS.length, 35);
  assert.equal(new Set(BUILD_OUTPUT_ROOTS).size, 35);
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
