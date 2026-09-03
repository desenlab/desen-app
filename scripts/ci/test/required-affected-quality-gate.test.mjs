import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  captureAffectedChangeBoundary,
  createAffectedChangeBoundaryTestSeams,
} from "../affected-change-boundary.mjs";
import {
  validateAffectedSelectorPromotedBoundary,
  validateAffectedSelectorPromotedSelection,
  validateAffectedSelectorPromotionBoundary,
  verifyAffectedSelectorPromotionEvidence,
} from "../affected-selector-promotion-evidence.mjs";
import {
  createRequiredExhaustivePlan,
  createRequiredExhaustiveTerminalState,
  createSuccessfulExhaustiveStepObservation,
} from "../run-required-exhaustive-quality-gate.mjs";
import {
  REQUIRED_AFFECTED_RECEIPT_PROFILE,
  REQUIRED_AFFECTED_GATE_TIMEOUT_MS,
  REQUIRED_AFFECTED_SUFFIX_DEPENDENCY_POLICY,
  RequiredAffectedQualityGateError,
  createRequiredAffectedGateDeadline,
  createRequiredAffectedSelection,
  createRequiredQualityGateTestSeams,
  executeRequiredAffectedQualityGate,
  executeRequiredQualityGate,
  finalizeRequiredAffectedFailureReceipt,
  printRequiredAffectedReceipt,
  requiredQualityGateExitCode,
  resolveRequiredQualityGateMode,
  runRequiredAffectedClosingGuards,
  runRequiredAffectedQualityGate,
  validateRequiredAffectedSelection,
} from "../run-required-affected-quality-gate.mjs";

const REVISION = "a".repeat(40);
const BASE = "b".repeat(40);
const HEAD = "c".repeat(40);
const MERGE_BASE = "d".repeat(40);
const OID_BEFORE = "e".repeat(40);
const OID_AFTER = "f".repeat(40);
const TRACKED_OBJECT = "1".repeat(40);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");

function paths() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .subarray(0, -1)
    .toString("utf8")
    .split("\0")
    .sort();
}

function result(stdout = "", status = 0, stderr = "") {
  return {
    status,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

function trackedTree(trackedPaths) {
  return Buffer.concat(
    trackedPaths.map((relativePath) =>
      Buffer.from(`100644 blob ${TRACKED_OBJECT}\t${relativePath}\0`),
    ),
  );
}

function rawChanges(changedPaths) {
  return Buffer.concat(
    changedPaths.map((relativePath) =>
      Buffer.from(`:100644 100644 ${OID_BEFORE} ${OID_AFTER} M\0${relativePath}\0`),
    ),
  );
}

async function boundary(changedInput) {
  return await boundaryWithTrackedPaths(paths(), changedInput);
}

async function boundaryWithTrackedPaths(trackedPaths, changedInput) {
  const changedPaths = Array.isArray(changedInput) ? changedInput : [changedInput];
  const runGit = async (_workspaceRoot, args) => {
    if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
      return result("false\n");
    }
    if (args[0] === "cat-file") return result("commit\n");
    if (args[0] === "rev-parse" && args[1] === "--verify") {
      return result(`${REVISION}\n`);
    }
    if (args[0] === "rev-list") return result(`${REVISION} ${BASE} ${HEAD}\n`);
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") return result();
    if (args[0] === "merge-base" && args[1] === "--all") {
      return result(`${MERGE_BASE}\n`);
    }
    if (args[0] === "status") return result();
    if (args[0] === "ls-tree") return result(trackedTree(trackedPaths));
    if (args[0] === "diff-tree") return result(rawChanges(changedPaths));
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  };
  return await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository: true,
    testSeams: createAffectedChangeBoundaryTestSeams(runGit),
  });
}

async function productionBoundary(changedPath) {
  const trackedPaths = paths();
  const workspaceRoot = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-required-affected-boundary-")),
  );
  const environment = { ...process.env };
  delete environment.GIT_INDEX_FILE;
  Object.assign(environment, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_AUTHOR_NAME: "Desen CI",
    GIT_AUTHOR_EMAIL: "ci@desen.invalid",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_NAME: "Desen CI",
    GIT_COMMITTER_EMAIL: "ci@desen.invalid",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
    LANG: "C",
    LC_ALL: "C",
  });
  const git = (args, input = undefined) =>
    execFileSync("git", args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      env: environment,
      input,
    });
  try {
    git(["init", "--quiet", "--object-format=sha1"]);
    const sharedObjectId = git(["hash-object", "-w", "--stdin"], "shared\n").trim();
    const previousObjectId = git(["hash-object", "-w", "--stdin"], "previous\n").trim();
    const currentObjectId = git(["hash-object", "-w", "--stdin"], "current\n").trim();
    assert.equal(trackedPaths.includes(changedPath), true);
    git(
      ["update-index", "-z", "--index-info"],
      Buffer.concat(
        trackedPaths.map((trackedPath) =>
          Buffer.from(
            `100644 ${trackedPath === changedPath ? previousObjectId : sharedObjectId}\t${trackedPath}\0`,
          ),
        ),
      ),
    );
    const baseTree = git(["write-tree"]).trim();
    const baseRevision = git(["commit-tree", baseTree], "base\n").trim();
    git(["update-index", "--cacheinfo", "100644", currentObjectId, changedPath]);
    const headTree = git(["write-tree"]).trim();
    const headRevision = git(["commit-tree", headTree, "-p", baseRevision], "head\n").trim();
    const executionRevision = git(
      ["commit-tree", headTree, "-p", baseRevision, "-p", headRevision],
      "execution\n",
    ).trim();
    git(["update-ref", "refs/heads/execution", executionRevision]);
    git(["symbolic-ref", "HEAD", "refs/heads/execution"]);
    git(["reset", "--hard", "--quiet", executionRevision]);
    return await captureAffectedChangeBoundary({
      workspaceRoot,
      baseRevision,
      headRevision,
      executionRevision,
      sameRepository: true,
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function exhaustiveBoundary() {
  return await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository: true,
    testSeams: createAffectedChangeBoundaryTestSeams(async (_workspaceRoot, args) =>
      args[0] === "rev-parse" && args[1] === "--is-shallow-repository"
        ? result("true\n")
        : result("", 1),
    ),
  });
}

function runner() {
  createRequiredExhaustivePlan({ authority: "REQUIRED" });
  return async (workload) => createSuccessfulExhaustiveStepObservation(workload);
}

test("promotion applicability binds one verified receipt to the exact authenticated boundary", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const admitted = await boundary("scripts/verify-protocol-canonicalization.mjs");
  const substituted = await boundary("tests/protocol-canonicalization.test.mjs");
  assert.equal(validateAffectedSelectorPromotionBoundary(promotion, admitted), admitted);
  assert.equal(validateAffectedSelectorPromotedBoundary(admitted, promotion), admitted);
  assert.throws(
    () => validateAffectedSelectorPromotedBoundary(substituted, promotion),
    /unbound or substituted affected boundary/u,
  );
  assert.throws(
    () => validateAffectedSelectorPromotedBoundary(admitted, structuredClone(promotion)),
    /unbound or substituted affected boundary/u,
  );
});

test("promotion applicability makes every added, removed, or substituted authority exhaustive", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const current = paths();
  for (const trackedPaths of [
    current.filter(
      (trackedPath) => trackedPath !== "scripts/ci/affected-selector-promotion-evidence.mjs",
    ),
    [...current, "unreviewed/extra.mjs"].sort(),
    current
      .map((trackedPath) =>
        trackedPath === "scripts/ci/run-required-affected-quality-gate.mjs"
          ? "scripts/ci/run-shadow-affected-quality-gate.mjs"
          : trackedPath,
      )
      .sort(),
  ]) {
    const candidate = await boundaryWithTrackedPaths(
      trackedPaths,
      "scripts/verify-protocol-canonicalization.mjs",
    );
    assert.equal(validateAffectedSelectorPromotionBoundary(promotion, candidate), candidate);
    const selection = createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(candidate, promotion),
    );
    assert.equal(
      validateAffectedSelectorPromotedSelection(candidate, promotion, selection),
      selection,
    );
    assert.equal(selection.effectiveScope, "EXHAUSTIVE");
  }
});

test("one extra tracked path yields NOT_ELIGIBLE then exactly one exhaustive dispatch", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const drifted = await boundaryWithTrackedPaths(
    [...paths(), "unreviewed/extra.mjs"].sort(),
    "scripts/verify-protocol-canonicalization.mjs",
  );
  validateAffectedSelectorPromotionBoundary(promotion, drifted);
  const selection = validateAffectedSelectorPromotedSelection(
    drifted,
    promotion,
    createRequiredAffectedSelection(validateAffectedSelectorPromotedBoundary(drifted, promotion)),
  );
  let selectedCalls = 0;
  const affected = await runRequiredAffectedQualityGate(selection, {
    runStep: async () => {
      selectedCalls += 1;
    },
  });
  assert.equal(selection.effectiveScope, "EXHAUSTIVE");
  assert.throws(
    () =>
      validateAffectedSelectorPromotedSelection(drifted, promotion, {
        effectiveScope: "AFFECTED",
      }),
    /may authorize only exhaustive fallback/u,
  );
  assert.equal(affected.status, "NOT_ELIGIBLE");
  assert.equal(selectedCalls, 0);

  let affectedCalls = 0;
  let exhaustiveCalls = 0;
  const seams = createRequiredQualityGateTestSeams({
    verifyPromotion: async () => promotion,
    executeAffected: async () => {
      affectedCalls += 1;
      return affected;
    },
    executeExhaustive: async () => {
      exhaustiveCalls += 1;
      return Object.freeze({
        schemaVersion: 1,
        profile: "desen.ci.exhaustive-gate-boundary.v1",
        status: "PASS",
        execution: Object.freeze({
          schemaVersion: 1,
          profile: "desen.ci.required-exhaustive-quality-gate.v1",
          authority: "REQUIRED",
          scope: "EXHAUSTIVE",
          status: "PASS",
        }),
      });
    },
  });
  const result = await executeRequiredQualityGate({
    eventName: "pull_request",
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository: true,
    testSeams: seams,
  });
  assert.equal(result.mode, "EXHAUSTIVE");
  assert.equal(affectedCalls, 1);
  assert.equal(exhaustiveCalls, 1);
});

test("an authentic unsafe boundary is bound for exactly one exhaustive fallback", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const unsafe = await exhaustiveBoundary();
  assert.equal(unsafe.selection, "EXHAUSTIVE");
  assert.equal(validateAffectedSelectorPromotionBoundary(promotion, unsafe), unsafe);
  assert.equal(validateAffectedSelectorPromotedBoundary(unsafe, promotion), unsafe);
  const selection = createRequiredAffectedSelection(unsafe);
  assert.equal(selection.effectiveScope, "EXHAUSTIVE");
  let calls = 0;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    runStep: async () => {
      calls += 1;
    },
  });
  assert.equal(receipt.status, "NOT_ELIGIBLE");
  assert.equal(calls, 0);
});

test("runs every selected command fresh and closes one exact strict subset", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const events = [];
  const receipt = await runRequiredAffectedQualityGate(selection, {
    runStep: async (workload) => {
      events.push(workload.id);
      return await runner()(workload);
    },
    afterPrefix: async () => events.push("[build-output-seal-open]"),
    afterProofs: async () => events.push("[build-output-seal-close]"),
  });
  assert.equal(receipt.profile, REQUIRED_AFFECTED_RECEIPT_PROFILE);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.authority, "TEST");
  assert.equal(receipt.freshExecution, true);
  assert.equal(receipt.cachedSuccessRead, false);
  assert.equal(receipt.selectedWorkloadCount, 11);
  assert.equal(receipt.observedClosedCount, 11);
  assert.deepEqual(events.slice(0, 7), selection.nodeIds.slice(0, 7));
  assert.equal(events[6], "editor-core-public-package-contract");
  assert.equal(events[7], "[build-output-seal-open]");
  assert.equal(events.at(-3), "[build-output-seal-close]");
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    selection.nodeIds,
  );
});

test("fabricated or cloned selection identity cannot reach REQUIRED execution", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  assert.throws(
    () => validateRequiredAffectedSelection(structuredClone(selection)),
    (error) =>
      error instanceof RequiredAffectedQualityGateError &&
      error.code === "REQUIRED_AFFECTED_SELECTION_UNTRUSTED",
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });
  assert.equal(receipt.authority, "TEST");
  assert.notEqual(receipt.authority, "REQUIRED");
});

test("runs canonical multi-proof selections without inventing dependency completion", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary([
      "tests/protocol-types.test.mjs",
      "scripts/verify-protocol-canonicalization.mjs",
    ]),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.equal(selection.proofUnitCount, 2);
  assert.equal(selection.workloadCount, 13);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 13);
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    selection.nodeIds,
  );
  assert.equal(REQUIRED_AFFECTED_SUFFIX_DEPENDENCY_POLICY, "SELECTED_ROOT_BARRIER");
  assert.deepEqual(selection.nodeIds.slice(-2), ["dependency-boundaries", "boundary-fixtures"]);
});

test("runs the persistence closure behind both public-package contracts", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-editor-core-persistence.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.deepEqual(selection.nodeIds.slice(0, 8), [
    "orchestrator-contracts",
    "format",
    "lint",
    "structural-validator-artifacts",
    "workspace-graph",
    "package-tests",
    "editor-core-public-package-contract",
    "editor-web-public-package-contract",
  ]);
  assert.equal(selection.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-terminal-integration"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-schema-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs continuous validation after the editor-core contract with the connected T03-T07 closure", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-editor-core-continuous-validation.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("editor-web-public-package-contract"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(selection.nodeIds.includes("test-editor-core-continuous-validation"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-terminal-integration"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-schema-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs terminal integration with every M08 parent and the frozen P-18 runtime proofs", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-editor-core-terminal-integration.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["editor-core-terminal-integration"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-runtime-core-headless-sign-in"), true);
  assert.equal(selection.nodeIds.includes("verify-runtime-core-audit-hardening"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-terminal-integration"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-schema-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs the catalog panel closure behind exact shell and Catalog parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-catalog-panel-layer-tree.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-catalog-panel-layer-tree"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(
    selection.nodeIds.includes("verify-reference-catalog-web-capability-artifact"),
    true,
  );
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-catalog-panel-layer-tree"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-schema-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs the adapter canvas closure behind exact shell and source-audit parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-real-adapter-canvas.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-real-adapter-canvas"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-reference-host-web-source-audit"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-selection-overlay"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-schema-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-selection-overlay"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs named-slot authoring behind the exact structured-inspector parent", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-named-slot-authoring.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-named-slot-authoring"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-structured-inspector"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-named-slot-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs event/action authoring behind exact App and Editor Core parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-event-action-editor.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-event-action-editor"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-editor-core-event-action-edits"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs Design/Run modes behind exact canvas, state, and action parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-design-run-modes.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-design-run-modes"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-real-adapter-canvas"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-state-binding-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-event-action-editor"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs fixtures/scenarios fidelity behind exact Design/Run, fixture, and parity parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-fixtures-scenarios-fidelity"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(
    selection.nodeIds.includes("verify-reference-sign-in-fixtures-and-host-binding"),
    true,
  );
  assert.equal(selection.nodeIds.includes("verify-reference-catalog-web-parity"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-design-run-modes"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs source persistence behind exact shell, Editor Core, and T11 parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-source-persistence.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-source-persistence"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-editor-core-persistence"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-shell-navigation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-fixtures-scenarios-fidelity"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-source-persistence"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs node-linked diagnostics behind exact Runtime, Editor Core, and App parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-node-linked-diagnostics.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-node-linked-diagnostics"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-runtime-react-reconciliation-diagnostics"), true);
  assert.equal(selection.nodeIds.includes("verify-editor-core-continuous-validation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-source-persistence"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-node-linked-diagnostics"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-node-linked-diagnostics"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs publication behind exact App, Publisher, control-plane, and host parents", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-publish-activation.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-publish-activation"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  for (const proofId of [
    "desen-app-design-run-modes",
    "desen-app-fixtures-scenarios-fidelity",
    "desen-app-source-persistence",
    "desen-app-node-linked-diagnostics",
    "publisher-bundle-publication",
    "publisher-official-golden",
    "control-plane-local-api",
    "reference-host-web-channel-consumption",
    "desen-app-publish-activation",
  ]) {
    assert.equal(selection.nodeIds.includes(`verify-${proofId}`), true);
  }
  assert.equal(selection.nodeIds.includes("test-desen-app-publish-activation"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs empty-project browser E2E behind the exact publication parent", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-empty-project-browser-e2e.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-empty-project-browser-e2e"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-publish-activation"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-publish-activation"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-empty-project-browser-e2e"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs Browser E2E workspace compatibility behind the historical browser proof", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs"),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-browser-e2e-workspace-compatibility"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-empty-project-browser-e2e"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-empty-project-browser-e2e"), true);
  assert.equal(
    selection.nodeIds.includes("verify-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(
    selection.nodeIds.includes("test-desen-app-browser-e2e-workspace-compatibility"),
    true,
  );
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs visual behavior authoring behind the blank-project predecessor", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const authenticatedBoundary = await productionBoundary(
    "scripts/verify-desen-app-visual-behavior-authoring.mjs",
  );
  assert.equal(
    validateAffectedSelectorPromotionBoundary(promotion, authenticatedBoundary),
    authenticatedBoundary,
  );
  const selection = validateAffectedSelectorPromotedSelection(
    authenticatedBoundary,
    promotion,
    createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(authenticatedBoundary, promotion),
    ),
  );
  assert.equal(selection.effectiveScope, "AFFECTED");
  assert.equal(validateRequiredAffectedSelection(selection), selection);
  for (const key of [
    "selectorSha256",
    "ownershipSha256",
    "impactGraphSha256",
    "thresholdSha256",
    "inventorySha256",
  ]) {
    assert.equal(selection[key], promotion.promotedAuthorities[key]);
  }
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-visual-behavior-authoring"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-user-created-blank-project"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-visual-behavior-authoring"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs evergreen product composition behind the visual-behavior predecessor", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const authenticatedBoundary = await productionBoundary(
    "scripts/verify-desen-app-evergreen-product-composition.mjs",
  );
  assert.equal(
    validateAffectedSelectorPromotionBoundary(promotion, authenticatedBoundary),
    authenticatedBoundary,
  );
  const selection = validateAffectedSelectorPromotedSelection(
    authenticatedBoundary,
    promotion,
    createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(authenticatedBoundary, promotion),
    ),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-evergreen-product-composition"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-visual-behavior-authoring"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-evergreen-product-composition"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-input-pending-fixture"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-failure-fixture"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-failure-fixture"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs input/pending fixture behind the evergreen composition predecessor", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const authenticatedBoundary = await productionBoundary(
    "scripts/verify-desen-app-input-pending-fixture.mjs",
  );
  assert.equal(
    validateAffectedSelectorPromotionBoundary(promotion, authenticatedBoundary),
    authenticatedBoundary,
  );
  const selection = validateAffectedSelectorPromotedSelection(
    authenticatedBoundary,
    promotion,
    createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(authenticatedBoundary, promotion),
    ),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-input-pending-fixture"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-evergreen-product-composition"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-input-pending-fixture"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-failure-fixture"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-failure-fixture"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs the failure fixture behind the input/pending predecessor", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const authenticatedBoundary = await productionBoundary(
    "scripts/verify-desen-app-failure-fixture.mjs",
  );
  assert.equal(
    validateAffectedSelectorPromotionBoundary(promotion, authenticatedBoundary),
    authenticatedBoundary,
  );
  const selection = validateAffectedSelectorPromotedSelection(
    authenticatedBoundary,
    promotion,
    createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(authenticatedBoundary, promotion),
    ),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });

  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-failure-fixture"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  assert.equal(selection.nodeIds.includes("verify-desen-app-input-pending-fixture"), true);
  assert.equal(selection.nodeIds.includes("verify-desen-app-failure-fixture"), true);
  assert.equal(selection.nodeIds.includes("test-desen-app-failure-fixture"), true);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("runs success and real-host evidence behind both exact T04 parents", async () => {
  const promotion = await verifyAffectedSelectorPromotionEvidence();
  const authenticatedBoundary = await productionBoundary(
    "scripts/verify-desen-app-success-host-operation.mjs",
  );
  assert.equal(
    validateAffectedSelectorPromotionBoundary(promotion, authenticatedBoundary),
    authenticatedBoundary,
  );
  const selection = validateAffectedSelectorPromotedSelection(
    authenticatedBoundary,
    promotion,
    createRequiredAffectedSelection(
      validateAffectedSelectorPromotedBoundary(authenticatedBoundary, promotion),
    ),
  );
  const receipt = await runRequiredAffectedQualityGate(selection, { runStep: runner() });
  assert.deepEqual(selection.ownerProofUnitIds, ["desen-app-success-host-operation"]);
  assert.equal(selection.proofUnitCount, 71);
  assert.equal(selection.workloadCount, 152);
  for (const id of [
    "desen-app-failure-fixture",
    "reference-sign-in-fixtures-and-host-binding",
    "desen-app-success-host-operation",
  ]) {
    assert.equal(selection.nodeIds.includes(`verify-${id}`), true);
    assert.equal(selection.nodeIds.includes(`test-${id}`), true);
  }
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 152);
});

test("exhaustive fallback executes no duplicate required workload", async () => {
  const selection = createRequiredAffectedSelection(await boundary("package.json"));
  let calls = 0;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    runStep: async () => {
      calls += 1;
    },
  });
  assert.equal(selection.effectiveScope, "EXHAUSTIVE");
  assert.equal(receipt.status, "NOT_ELIGIBLE");
  assert.equal(receipt.freshExecution, false);
  assert.equal(calls, 0);
});

test("a selected failure stops later work and cannot authorize a pass", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  let calls = 0;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    runStep: async (workload) => {
      calls += 1;
      if (workload.id === "verify-protocol-canonicalization") throw new Error("fixture failure");
      return await authenticRunner(workload);
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.authority, "TEST");
  assert.equal(receipt.error.message, "fixture failure");
  assert.equal(calls, 8);
  assert.equal(receipt.observedClosedCount, 7);
});

test("the first proof failure remains primary when the closing build guard also fails", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  const receipt = await runRequiredAffectedQualityGate(selection, {
    runStep: async (workload) => {
      if (workload.id === "verify-protocol-canonicalization") {
        throw new Error("primary proof failure");
      }
      return await authenticRunner(workload);
    },
    afterProofs: async () => {
      throw new Error("secondary build guard failure");
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.error.message, "primary proof failure");
});

test("missing or malformed close observations fail instead of fabricating success", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  for (const observation of [undefined, { status: "PASS" }]) {
    const receipt = await runRequiredAffectedQualityGate(selection, {
      runStep: async () => observation,
    });
    assert.equal(receipt.status, "FAIL");
    assert.equal(receipt.observedClosedCount, 0);
  }
});

test("cancellation before scheduling starts no required workload and cannot return PASS", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  terminal.cancel("SIGINT");
  const winner = terminal.winner();
  let calls = 0;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async () => {
      calls += 1;
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, 0);
  assert.equal(receipt.observedClosedCount, 0);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("cancellation between regions stops every later workload and preserves the first reason", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  const authenticRunner = runner();
  let calls = 0;
  let winner;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async (workload) => {
      calls += 1;
      return await authenticRunner(workload);
    },
    afterPrefix: async () => {
      terminal.cancel("SIGTERM");
      winner = terminal.winner();
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, 7);
  assert.equal(receipt.observedClosedCount, 7);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("cancellation at the final observed close cannot fabricate a PASS receipt", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  const authenticRunner = runner();
  let calls = 0;
  let winner;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async (workload) => {
      calls += 1;
      const observation = await authenticRunner(workload);
      if (calls === selection.workloadCount) {
        terminal.cancel("SIGTERM");
        winner = terminal.winner();
      }
      return observation;
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, selection.workloadCount);
  assert.equal(receipt.observedClosedCount, selection.workloadCount);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("the gate-wide deadline remains terminal at the final observed close", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  const deadline = createRequiredAffectedGateDeadline(terminal);
  const authenticRunner = runner();
  let calls = 0;
  const receipt = await runRequiredAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async (workload) => {
      calls += 1;
      const observation = await authenticRunner(workload);
      if (calls === selection.workloadCount) {
        context.mock.timers.tick(REQUIRED_AFFECTED_GATE_TIMEOUT_MS);
      }
      return observation;
    },
  });
  deadline.clear();

  assert.equal(calls, selection.workloadCount);
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.authority, "TEST");
  assert.equal(receipt.observedClosedCount, selection.workloadCount);
  assert.equal(receipt.error.code, "REQUIRED_AFFECTED_GATE_TIMEOUT");
  assert.equal(terminal.winner().kind, "TIMEOUT");
  context.mock.timers.reset();
});

test("clearing the gate-wide deadline prevents a late timeout claim", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const terminal = createRequiredExhaustiveTerminalState();
  const deadline = createRequiredAffectedGateDeadline(terminal);
  deadline.clear();
  context.mock.timers.tick(REQUIRED_AFFECTED_GATE_TIMEOUT_MS);
  assert.equal(terminal.winner(), undefined);
  context.mock.timers.reset();
});

test("cancellation during final guards runs both guards and preserves every reason", async () => {
  const terminal = createRequiredExhaustiveTerminalState();
  const events = [];
  let winner;
  const closing = await runRequiredAffectedClosingGuards(terminal, {
    runUntrackedGuard: async () => {
      events.push("untracked");
      terminal.cancel("SIGTERM");
      winner = terminal.winner();
    },
    runWorkspaceGuard: async () => {
      events.push("workspace");
      throw new Error("later workspace guard failure");
    },
  });
  assert.deepEqual(events, ["untracked", "workspace"]);
  assert.equal(terminal.winner(), winner);
  assert.equal(closing.failure, winner.reason);
  assert.equal(closing.untrackedGuardFailure, null);
  assert.equal(closing.workspaceGuardFailure.message, "later workspace guard failure");
});

test("outer guard diagnostics cannot replace an earlier execution failure", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  const inner = await runRequiredAffectedQualityGate(selection, {
    runStep: async (workload) => {
      if (workload.id === "verify-protocol-canonicalization") {
        throw new Error("primary execution failure");
      }
      return await authenticRunner(workload);
    },
  });
  const closingTerminal = createRequiredExhaustiveTerminalState();
  const closing = await runRequiredAffectedClosingGuards(closingTerminal, {
    runUntrackedGuard: async () => {
      throw new Error("secondary untracked guard failure");
    },
    runWorkspaceGuard: async () => {
      throw new Error("tertiary workspace guard failure");
    },
  });
  const finalized = finalizeRequiredAffectedFailureReceipt(
    inner,
    selection,
    new Error("generic wrapper must not replace primary"),
    closing,
  );

  assert.equal(finalized.status, "FAIL");
  assert.equal(finalized.error.message, "primary execution failure");
  assert.equal(finalized.closingGuards.untracked.message, "secondary untracked guard failure");
  assert.equal(finalized.closingGuards.workspace.message, "tertiary workspace guard failure");
});

test("the log envelope is bounded to one explicit required marker", async () => {
  const selection = createRequiredAffectedSelection(await boundary("package.json"));
  validateRequiredAffectedSelection(selection);
  let output = "";
  printRequiredAffectedReceipt(
    { authority: "TEST", status: "NOT_ELIGIBLE" },
    { write: (text) => (output += text) },
  );
  assert.equal(output.split("DESEN_REQUIRED_AFFECTED_RECEIPT=").length - 1, 1);
  assert.equal(output.includes('"authority":"TEST"'), true);
});

test("required exhaustive invariants remain exact after required execution is imported", () => {
  const required = createRequiredExhaustivePlan();
  assert.equal(required.authority, "REQUIRED");
  assert.equal(required.scope, "EXHAUSTIVE");
  assert.equal(required.stepCount, 216);
  assert.equal(required.proofPairCount, 103);
});

test("only pull requests may attempt affected execution and every ineligible plan falls back", () => {
  for (const eventName of ["push", "workflow_dispatch", "release", "schedule", ""]) {
    assert.equal(resolveRequiredQualityGateMode(eventName), "EXHAUSTIVE");
  }
  assert.equal(resolveRequiredQualityGateMode("pull_request"), "TRY_AFFECTED");
  assert.equal(resolveRequiredQualityGateMode("pull_request", "PASS"), "AFFECTED");
  assert.equal(resolveRequiredQualityGateMode("pull_request", "FAIL"), "AFFECTED");
  assert.equal(resolveRequiredQualityGateMode("pull_request", "NOT_ELIGIBLE"), "EXHAUSTIVE");
  assert.throws(() => resolveRequiredQualityGateMode("pull_request", "SKIPPED"), /unknown status/u);
});

test("public REQUIRED wrappers reject injected authority before any command can start", async () => {
  for (const key of ["processRegistry", "terminalState", "runStep"]) {
    await assert.rejects(
      executeRequiredAffectedQualityGate({ [key]: Object.freeze({}) }),
      (error) =>
        error instanceof RequiredAffectedQualityGateError &&
        error.code === "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
    );
    await assert.rejects(
      executeRequiredQualityGate({ [key]: Object.freeze({}) }),
      (error) =>
        error instanceof RequiredAffectedQualityGateError &&
        error.code === "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
    );
  }
});

test("an unsafe pull request falls back to exhaustive exactly once", async () => {
  const events = [];
  const seams = createRequiredQualityGateTestSeams({
    verifyPromotion: async () => events.push("promotion"),
    executeAffected: async () => {
      events.push("affected");
      return Object.freeze({ status: "NOT_ELIGIBLE", authority: "REQUIRED" });
    },
    executeExhaustive: async () => {
      events.push("exhaustive");
      return Object.freeze({
        schemaVersion: 1,
        profile: "desen.ci.exhaustive-gate-boundary.v1",
        status: "PASS",
        execution: Object.freeze({
          schemaVersion: 1,
          profile: "desen.ci.required-exhaustive-quality-gate.v1",
          authority: "REQUIRED",
          scope: "EXHAUSTIVE",
          status: "PASS",
        }),
      });
    },
  });
  const result = await executeRequiredQualityGate({
    eventName: "pull_request",
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository: false,
    testSeams: seams,
  });

  assert.deepEqual(events, ["promotion", "affected", "exhaustive"]);
  assert.equal(result.mode, "EXHAUSTIVE");
  assert.equal(result.receipt.execution.authority, "TEST");
  assert.equal(requiredQualityGateExitCode(result), 1);
});

test("an inner PASS plus an outer closing failure remains nonzero in the dispatcher", async () => {
  const selection = createRequiredAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const inner = await runRequiredAffectedQualityGate(selection, { runStep: runner() });
  const terminal = createRequiredExhaustiveTerminalState();
  const closing = await runRequiredAffectedClosingGuards(terminal, {
    runWorkspaceGuard: async () => {
      throw new Error("closing workspace changed");
    },
  });
  const finalized = finalizeRequiredAffectedFailureReceipt(
    inner,
    selection,
    closing.failure,
    closing,
  );
  let exhaustiveCalls = 0;
  const seams = createRequiredQualityGateTestSeams({
    executeAffected: async () => finalized,
    executeExhaustive: async () => {
      exhaustiveCalls += 1;
      throw new Error("exhaustive must not run after an affected failure");
    },
  });
  const result = await executeRequiredQualityGate({
    eventName: "pull_request",
    executionRevision: REVISION,
    testSeams: seams,
  });

  assert.equal(inner.status, "PASS");
  assert.equal(result.mode, "AFFECTED");
  assert.equal(result.receipt.status, "FAIL");
  assert.equal(result.receipt.closingGuards.workspace.message, "closing workspace changed");
  assert.equal(exhaustiveCalls, 0);
  assert.equal(requiredQualityGateExitCode(result), 1);
});

test("a real terminal signal remains 130 or 143 after an affected FAIL receipt", async () => {
  for (const [signal, exitCode] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const seams = createRequiredQualityGateTestSeams({
      executeAffected: async () => {
        process.emit(signal);
        return Object.freeze({
          schemaVersion: 1,
          profile: REQUIRED_AFFECTED_RECEIPT_PROFILE,
          authority: "REQUIRED",
          requestedScope: "AFFECTED",
          effectiveScope: "AFFECTED",
          status: "FAIL",
        });
      },
      executeExhaustive: async () => {
        throw new Error("exhaustive must not run after an affected failure");
      },
    });
    const result = await executeRequiredQualityGate({
      eventName: "pull_request",
      executionRevision: REVISION,
      testSeams: seams,
    });
    assert.equal(result.mode, "AFFECTED");
    assert.equal(result.receipt.status, "FAIL");
    assert.equal(result.receipt.authority, "TEST");
    assert.equal(requiredQualityGateExitCode(result), exitCode);
  }
});

test("CLI terminal routing is fail-closed for affected failures and exhaustive throws", () => {
  assert.equal(requiredQualityGateExitCode({ mode: "AFFECTED", receipt: { status: "PASS" } }), 1);
  assert.equal(requiredQualityGateExitCode({ mode: "AFFECTED", receipt: { status: "FAIL" } }), 1);
  assert.equal(requiredQualityGateExitCode({ mode: "EXHAUSTIVE", receipt: { status: "PASS" } }), 1);
  assert.equal(requiredQualityGateExitCode(null, new Error("exhaustive failed")), 1);
  assert.equal(
    requiredQualityGateExitCode({ mode: "AFFECTED", receipt: { status: "FAIL" } }, null, 143),
    143,
  );
});

test("CLI cancellation codes remain terminal after a PASS receipt", () => {
  assert.equal(
    requiredQualityGateExitCode({ mode: "AFFECTED", receipt: { status: "PASS" } }, null, 130),
    130,
  );
  assert.equal(
    requiredQualityGateExitCode({ mode: "EXHAUSTIVE", receipt: { status: "PASS" } }, null, 143),
    143,
  );
  for (const invalid of [0, -1, 1, 129, 144, Number.NaN, "130"]) {
    assert.equal(
      requiredQualityGateExitCode(
        { mode: "AFFECTED", receipt: { status: "PASS", authority: "TEST" } },
        null,
        invalid,
      ),
      1,
    );
  }
});
