import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import { readExhaustiveGateRepositoryInventory } from "../exhaustive-gate-boundary.mjs";
import {
  ExhaustiveWorkloadInventoryError,
  calculateExhaustiveWorkloadInventorySha256,
  createExhaustiveWorkloadInventory,
} from "../exhaustive-workload-inventory.mjs";
import {
  DEFAULT_GATE_TIMEOUT_MS,
  DEFAULT_STEP_TIMEOUT_MS,
  EXHAUSTIVE_SCOPE,
  OPTIONAL_AUTHORITY,
  PROOF_PAIR_CONCURRENCY,
  REQUIRED_AUTHORITY,
  RequiredExhaustiveCancellationError,
  RequiredExhaustiveGateTimeoutError,
  RequiredExhaustiveQualityGateError,
  RequiredExhaustiveTimeoutError,
  createRequiredExhaustiveCancellationState,
  createRequiredExhaustivePlan,
  createRequiredExhaustiveProcessRegistry,
  createRequiredExhaustiveProcessRunner,
  createRequiredExhaustiveTerminalState,
  createSuccessfulExhaustiveStepObservation,
  executeRequiredExhaustiveQualityGate,
  resolveRequiredExhaustiveAuthority,
  runRequiredExhaustivePlan,
} from "../run-required-exhaustive-quality-gate.mjs";
import { classifyProofPairState } from "../shared-state-authority.mjs";

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");
const SAME_BUILD = Object.freeze({ profile: "test.build", digest: "same" });
const SAME_UNTRACKED = Object.freeze({ profile: "test.untracked", digest: "same" });
const SAME_WORKSPACE = Object.freeze({
  profile: "desen.ci.exhaustive-gate-boundary.v1",
  digest: "1".repeat(64),
  indexSha256: "2".repeat(64),
  worktreeSha256: "3".repeat(64),
  trackedFileCount: 1,
  trackedBytes: 1,
});

function successfulGuardOptions(overrides = {}) {
  return {
    workspaceRoot: WORKSPACE_ROOT,
    snapshotBuildOutputsFunction: async () => SAME_BUILD,
    assertBuildOutputsUnchangedFunction: (before, after) => assert.equal(before, after),
    snapshotUntrackedStateFunction: async () => SAME_UNTRACKED,
    assertUntrackedStateUnchangedFunction: (before, after) => assert.equal(before, after),
    ...overrides,
  };
}

function pass(workload) {
  return createSuccessfulExhaustiveStepObservation(workload);
}

function createShadowPlan() {
  return createRequiredExhaustivePlan({ authority: OPTIONAL_AUTHORITY });
}

async function runShadowPlan(plan, options) {
  return await runRequiredExhaustivePlan(plan, {
    ...options,
    authority: OPTIONAL_AUTHORITY,
  });
}

function createFakeChild(pid) {
  const child = new EventEmitter();
  child.pid = pid;
  child.killed = false;
  child.kill = () => true;
  return child;
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await delay(1);
  }
  assert.fail(message);
}

test("the dependency-derived plan owns the exact 188-node exhaustive inventory", () => {
  const plan = createRequiredExhaustivePlan();
  const inventory = createExhaustiveWorkloadInventory();
  const ownedIds = [
    ...plan.prefix.map(({ id }) => id),
    ...plan.proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    ...plan.suffix.map(({ id }) => id),
  ];

  assert.equal(plan.authority, REQUIRED_AUTHORITY);
  assert.equal(plan.scope, EXHAUSTIVE_SCOPE);
  assert.equal(plan.concurrency, 2);
  assert.equal(PROOF_PAIR_CONCURRENCY, 2);
  assert.equal(DEFAULT_STEP_TIMEOUT_MS, 15 * 60 * 1_000);
  assert.equal(DEFAULT_GATE_TIMEOUT_MS, 17 * 60 * 1_000);
  assert.equal(plan.stepCount, 188);
  assert.equal(plan.proofPairCount, 89);
  assert.equal(plan.prefix.length, 8);
  assert.equal(plan.suffix.length, 2);
  assert.equal(plan.planSha256, "86af002c1fc656c397a36e6aae2aae5d99ea30a43ec3d0742053a9ae14ca8d98");
  assert.equal(ownedIds.length, 188);
  assert.equal(new Set(ownedIds).size, 188);
  assert.deepEqual([...ownedIds].sort(), inventory.nodes.map(({ id }) => id).sort());
  for (const pair of plan.proofPairs) {
    assert.deepEqual(pair.rootTest.dependencies, [pair.verifier.id]);
  }
});

test("authority defaults to REQUIRED, accepts only explicit SHADOW, and fixes EXHAUSTIVE scope", () => {
  assert.equal(resolveRequiredExhaustiveAuthority({}), REQUIRED_AUTHORITY);
  assert.equal(resolveRequiredExhaustiveAuthority({ DESEN_CI_AUTHORITY: "" }), REQUIRED_AUTHORITY);
  assert.equal(
    resolveRequiredExhaustiveAuthority({ DESEN_CI_AUTHORITY: "SHADOW" }),
    OPTIONAL_AUTHORITY,
  );
  for (const value of ["REQUIRED", "shadow", "AFFECTED", " SHADOW "]) {
    assert.throws(
      () => resolveRequiredExhaustiveAuthority({ DESEN_CI_AUTHORITY: value }),
      RequiredExhaustiveQualityGateError,
    );
  }
  const observationPlan = createRequiredExhaustivePlan({ authority: OPTIONAL_AUTHORITY });
  assert.equal(observationPlan.authority, "SHADOW");
  assert.equal(observationPlan.scope, "EXHAUSTIVE");
  assert.equal(
    observationPlan.planSha256,
    "e4f13684f3c26f60bd7f5564a32ef4fc4654d098a04f39e4fdd98b6dd32582a7",
  );
  assert.throws(
    () => createRequiredExhaustivePlan({ scope: "AFFECTED" }),
    RequiredExhaustiveQualityGateError,
  );
});

test("injected plan, identity, command, dependency, and class drift fail before execution", async () => {
  const plan = createShadowPlan();
  let executionCount = 0;
  await assert.rejects(
    runShadowPlan(structuredClone(plan), {
      runStep: async () => {
        executionCount += 1;
      },
      ...successfulGuardOptions(),
    }),
    (error) =>
      error instanceof RequiredExhaustiveQualityGateError &&
      error.code === "REQUIRED_EXHAUSTIVE_PLAN_UNTRUSTED",
  );
  assert.equal(executionCount, 0);

  for (const mutate of [
    (inventory) => {
      inventory.nodes[0].command = "pnpm";
    },
    (inventory) => {
      inventory.nodes[0].dependencies = ["boundary-fixtures"];
    },
    (inventory) => {
      inventory.nodes[0].executionClass = "CONCURRENT_PROOF";
    },
  ]) {
    const inventory = structuredClone(createExhaustiveWorkloadInventory());
    mutate(inventory);
    assert.throws(() => {
      inventory.inventorySha256 = calculateExhaustiveWorkloadInventorySha256(inventory);
      createRequiredExhaustivePlan({ inventory });
    }, ExhaustiveWorkloadInventoryError);
  }
});

test("REQUIRED authority rejects injected success runners and repository seams", async () => {
  const plan = createRequiredExhaustivePlan();
  let executionCount = 0;
  const injectedRunner = async (workload) => {
    executionCount += 1;
    return pass(workload);
  };

  await assert.rejects(
    runRequiredExhaustivePlan(plan, {
      runStep: injectedRunner,
      ...successfulGuardOptions(),
    }),
    (error) =>
      error instanceof RequiredExhaustiveQualityGateError &&
      error.code === "REQUIRED_EXHAUSTIVE_AUTHORITY_INJECTED",
  );
  await assert.rejects(
    executeRequiredExhaustiveQualityGate({
      plan,
      runStep: injectedRunner,
      readRevisionFunction: async () => "a".repeat(40),
    }),
    (error) =>
      error instanceof RequiredExhaustiveQualityGateError &&
      error.code === "REQUIRED_EXHAUSTIVE_AUTHORITY_INJECTED",
  );
  for (const injectedBoundary of [
    { assertCleanInputFunction: async () => Object.freeze({ status: "PASS" }) },
    { gateTimeoutMs: 1 },
  ]) {
    await assert.rejects(
      executeRequiredExhaustiveQualityGate({ plan, ...injectedBoundary }),
      (error) =>
        error instanceof RequiredExhaustiveQualityGateError &&
        error.code === "REQUIRED_EXHAUSTIVE_AUTHORITY_INJECTED",
    );
  }
  assert.equal(executionCount, 0);
});

test("all 188 successful closes produce stable inventory-ordered receipts", async () => {
  const plan = createShadowPlan();
  const calls = [];
  const receipt = await runShadowPlan(plan, {
    runStep: async (workload) => {
      calls.push(workload.id);
      return pass(workload);
    },
    ...successfulGuardOptions(),
  });

  assert.equal(calls.length, 188);
  assert.equal(new Set(calls).size, 188);
  assert.equal(calls.filter((id) => id === "editor-core-public-package-contract").length, 1);
  assert.equal(
    calls.indexOf("editor-core-public-package-contract"),
    calls.indexOf("package-tests") + 1,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-source-document"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-stable-id-insert"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-structural-edits"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-content-edits"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-state-binding-edits"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-continuous-validation"),
    true,
  );
  assert.equal(
    calls.indexOf("editor-core-public-package-contract") <
      calls.indexOf("verify-editor-core-terminal-integration"),
    true,
  );
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 188);
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    plan.nodes.map(({ id }) => id),
  );
  assert.equal(
    receipt.steps.every(({ status, observedClose }) => status === "PASS" && observedClose),
    true,
  );
  assert.equal(
    receipt.proofPairs.every(({ status }) => status === "PASS"),
    true,
  );
});

test("dynamic workers keep two safe ordinary pairs active and drain for all barrier pairs", async () => {
  const plan = createShadowPlan();
  const barrierPairs = plan.proofPairs.filter(({ id }) => classifyProofPairState(id).barrier);
  const barrierStepIds = new Set(
    barrierPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
  );
  let activeProofSteps = 0;
  let maximumActive = 0;
  const exclusiveBarrierSteps = new Set();
  let firstVerifierHeld = true;
  let releaseFirst;
  const firstRelease = new Promise((resolvePromise) => {
    releaseFirst = resolvePromise;
  });
  let thirdPairStartedWhileFirstHeld = false;
  const firstVerifier = plan.proofPairs[0].verifier.id;
  const thirdVerifier = plan.proofPairs[2].verifier.id;

  const receipt = await runShadowPlan(plan, {
    runStep: async (workload) => {
      if (workload.executionClass === "CONCURRENT_PROOF") {
        activeProofSteps += 1;
        maximumActive = Math.max(maximumActive, activeProofSteps);
        if (workload.id === firstVerifier) await firstRelease;
        if (workload.id === thirdVerifier && firstVerifierHeld) {
          thirdPairStartedWhileFirstHeld = true;
          firstVerifierHeld = false;
          releaseFirst();
        }
        if (barrierStepIds.has(workload.id)) {
          if (activeProofSteps === 1) exclusiveBarrierSteps.add(workload.id);
          assert.equal(activeProofSteps, 1);
        }
        await delay(1);
        activeProofSteps -= 1;
      }
      return pass(workload);
    },
    ...successfulGuardOptions(),
  });

  assert.equal(receipt.status, "PASS");
  assert.equal(maximumActive, 2);
  assert.equal(thirdPairStartedWhileFirstHeld, true);
  assert.equal(barrierPairs.length, 11);
  assert.equal(plan.proofPairs.length - barrierPairs.length, 78);
  assert.equal(exclusiveBarrierSteps.size, 22);
});

test("the first proof failure permanently aborts and awaits its active sibling", async () => {
  const plan = createShadowPlan();
  const [firstPair, secondPair] = plan.proofPairs;
  const failure = new Error("injected proof failure");
  const started = [];
  let siblingClosed = false;
  let releaseBoth;
  const bothStarted = new Promise((resolvePromise) => {
    releaseBoth = resolvePromise;
  });

  await assert.rejects(
    runShadowPlan(plan, {
      runStep: async (workload, { signal }) => {
        if (workload.executionClass !== "CONCURRENT_PROOF") return pass(workload);
        started.push(workload.id);
        if (started.length === 2) releaseBoth();
        await bothStarted;
        if (workload.id === firstPair.verifier.id) throw failure;
        await new Promise((resolvePromise) => {
          signal.addEventListener("abort", resolvePromise, { once: true });
        });
        await delay(5);
        siblingClosed = true;
        throw signal.reason;
      },
      ...successfulGuardOptions(),
    }),
    (error) => {
      assert.equal(error, failure);
      assert.equal(siblingClosed, true);
      assert.deepEqual(started.sort(), [firstPair.verifier.id, secondPair.verifier.id].sort());
      assert.equal(error.requiredExhaustiveReceipt.status, "FAIL");
      assert.equal(
        error.requiredExhaustiveReceipt.steps.find(({ id }) => id === firstPair.verifier.id).status,
        "FAIL",
      );
      assert.equal(
        error.requiredExhaustiveReceipt.steps.find(({ id }) => id === secondPair.verifier.id)
          .status,
        "CANCELLED",
      );
      assert.equal(
        error.requiredExhaustiveReceipt.steps.find(({ id }) => id === plan.suffix[0].id).status,
        "NOT_RUN",
      );
      return true;
    },
  );
});

test("representative package, root-test, and boundary failures stop their dependency suffix", async () => {
  const plan = createShadowPlan();
  const cases = [
    {
      targetId: "package-tests",
      forbiddenIds: plan.proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    },
    {
      targetId: "editor-core-public-package-contract",
      forbiddenIds: plan.proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    },
    {
      targetId: plan.proofPairs[0].rootTest.id,
      forbiddenIds: plan.suffix.map(({ id }) => id),
    },
    {
      targetId: plan.suffix[0].id,
      forbiddenIds: [plan.suffix[1].id],
    },
  ];

  for (const { targetId, forbiddenIds } of cases) {
    const failure = new Error(`injected failure at ${targetId}`);
    const startedIds = [];
    await assert.rejects(
      runShadowPlan(plan, {
        runStep: async (workload) => {
          startedIds.push(workload.id);
          if (workload.id === targetId) throw failure;
          return pass(workload);
        },
        ...successfulGuardOptions(),
      }),
      (error) => {
        assert.equal(error, failure);
        assert.equal(error.requiredExhaustiveReceipt.status, "FAIL");
        assert.equal(
          error.requiredExhaustiveReceipt.steps.find(({ id }) => id === targetId).status,
          "FAIL",
        );
        return true;
      },
    );
    for (const forbiddenId of forbiddenIds) {
      assert.equal(startedIds.includes(forbiddenId), false, `${forbiddenId} started after failure`);
      assert.equal(
        plan.nodes.some(({ id }) => id === forbiddenId),
        true,
        `${forbiddenId} must belong to the exhaustive plan`,
      );
    }
  }
});

test("external cancellation is permanent before work and between steps", async () => {
  const plan = createShadowPlan();
  const preCancelled = new AbortController();
  const cancellation = new RequiredExhaustiveCancellationError("SIGINT");
  preCancelled.abort(cancellation);
  let calls = 0;
  await assert.rejects(
    runShadowPlan(plan, {
      signal: preCancelled.signal,
      runStep: async () => {
        calls += 1;
      },
      ...successfulGuardOptions(),
    }),
    (error) => error === cancellation,
  );
  assert.equal(calls, 0);

  let cancelled = false;
  await assert.rejects(
    runShadowPlan(plan, {
      runStep: async (workload) => {
        calls += 1;
        cancelled = true;
        return pass(workload);
      },
      assertCanContinue: () => {
        if (cancelled) throw new RequiredExhaustiveCancellationError("SIGTERM");
      },
      ...successfulGuardOptions(),
    }),
    RequiredExhaustiveCancellationError,
  );
  assert.equal(calls, 1);

  const interruptState = createRequiredExhaustiveCancellationState();
  assert.equal(interruptState.cancel("SIGINT").first, true);
  assert.equal(interruptState.receivedSignal(), "SIGINT");
  assert.equal(interruptState.exitCode(), 130);
});

test("a close receipt omission or forged success can never produce PASS", async () => {
  const plan = createShadowPlan();
  for (const result of [
    undefined,
    { status: "PASS" },
    {
      schemaVersion: 1,
      profile: "desen.ci.exhaustive-step-close.v1",
      stepId: plan.nodes[0].id,
      status: "PASS",
      observedClose: false,
      code: 0,
      signal: null,
    },
  ]) {
    await assert.rejects(
      runShadowPlan(plan, {
        runStep: async () => result,
        ...successfulGuardOptions(),
      }),
      (error) => {
        assert.equal(error.requiredExhaustiveReceipt.status, "FAIL");
        assert.equal(error.requiredExhaustiveReceipt.observedClosedCount, 0);
        return true;
      },
    );
  }
});

test("the process runner refuses unowned workload identity before spawn", async () => {
  const plan = createRequiredExhaustivePlan();
  const forged = structuredClone(plan.prefix[0]);
  let spawnCount = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => {
      spawnCount += 1;
      return createFakeChild(100);
    },
    printCommandFunction: null,
  });
  await assert.rejects(runner(forged), RequiredExhaustiveQualityGateError);
  assert.equal(spawnCount, 0);
});

test("two active process groups receive cancellation, repeated signal escalation, and await close", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const cancellation = createRequiredExhaustiveCancellationState({ processRegistry: registry });
  const children = [createFakeChild(201), createFakeChild(202)];
  const forwarded = [];
  let spawnIndex = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => children[spawnIndex++],
    forwardSignalFunction: (signal, child) => {
      forwarded.push([child.pid, signal]);
      return true;
    },
    processRegistry: registry,
    terminalState: cancellation.terminalState,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 10_000,
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const executions = plan.proofPairs
    .slice(0, 2)
    .map(({ verifier }) => runner(verifier, { signal: cancellation.signal }));
  await waitFor(() => registry.activeCount() === 2, "Both child groups did not become active.");

  assert.equal(cancellation.cancel("SIGTERM").first, true);
  assert.equal(cancellation.cancel("SIGINT").first, false);
  assert.equal(cancellation.receivedSignal(), "SIGTERM");
  assert.equal(cancellation.exitCode(), 143);
  assert.deepEqual(forwarded.sort(), [
    [201, "SIGKILL"],
    [201, "SIGTERM"],
    [202, "SIGKILL"],
    [202, "SIGTERM"],
  ]);
  let settled = false;
  Promise.allSettled(executions).then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  for (const child of children) child.emit("close", null, "SIGKILL");
  const results = await Promise.allSettled(executions);
  assert.equal(
    results.every(({ status }) => status === "rejected"),
    true,
  );
  assert.equal(registry.activeCount(), 0);
});

test("the first timeout immediately terminates every active group and later SIGINT cannot win", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const children = [createFakeChild(211), createFakeChild(212)];
  const forwarded = [];
  let spawnIndex = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => children[spawnIndex++],
    forwardSignalFunction: (signal, child) => {
      forwarded.push([child.pid, signal]);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 2,
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const executions = plan.proofPairs
    .slice(0, 2)
    .map(({ verifier }) => runner(verifier, { signal: terminal.signal }));
  await waitFor(() => registry.activeCount() === 2, "Both timeout fixtures did not start.");
  await waitFor(() => terminal.winner() !== undefined, "No timeout claimed terminal authority.");

  const winner = terminal.winner();
  assert.equal(winner.kind, "TIMEOUT");
  assert.equal(winner.exitCode, 1);
  assert.equal(
    children.every((child) =>
      forwarded.some(([pid, signal]) => pid === child.pid && signal === "SIGTERM"),
    ),
    true,
  );
  assert.equal(terminal.cancel("SIGINT").first, false);
  assert.equal(terminal.winner(), winner);
  assert.equal(terminal.exitCode(), 1);
  assert.equal(
    children.every((child) =>
      forwarded.some(([pid, signal]) => pid === child.pid && signal === "SIGKILL"),
    ),
    true,
  );

  for (const child of children) child.emit("close", null, "SIGKILL");
  const results = await Promise.allSettled(executions);
  assert.equal(
    results.every(({ status }) => status === "rejected"),
    true,
  );
  assert.equal(registry.activeCount(), 0);
});

test("a child error terminates its sibling immediately but still awaits both close events", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const children = [createFakeChild(221), createFakeChild(222)];
  const forwarded = [];
  let spawnIndex = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => children[spawnIndex++],
    forwardSignalFunction: (signal, child) => {
      forwarded.push([child.pid, signal]);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 10_000,
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const executions = plan.proofPairs
    .slice(0, 2)
    .map(({ verifier }) => runner(verifier, { signal: terminal.signal }));
  await waitFor(() => registry.activeCount() === 2, "Both error fixtures did not start.");

  const processError = new Error("injected active child error");
  children[0].emit("error", processError);
  assert.equal(terminal.winner().reason, processError);
  assert.equal(terminal.winner().kind, "PROCESS_ERROR");
  assert.equal(
    children.every((child) =>
      forwarded.some(([pid, signal]) => pid === child.pid && signal === "SIGTERM"),
    ),
    true,
  );
  let settled = false;
  Promise.allSettled(executions).then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);

  for (const child of children) child.emit("close", 1, null);
  const results = await Promise.allSettled(executions);
  assert.equal(
    results.every(({ status }) => status === "rejected"),
    true,
  );
  assert.equal(terminal.winner().reason, processError);
});

test("an external signal that wins first keeps its exit authority over later failures", () => {
  const terminal = createRequiredExhaustiveTerminalState();
  assert.equal(terminal.cancel("SIGINT").first, true);
  const winner = terminal.winner();
  assert.equal(winner.kind, "EXTERNAL_SIGNAL");
  assert.equal(terminal.exitCode(), 130);
  assert.equal(terminal.claimFailure(new Error("late failure")).first, false);
  assert.equal(terminal.winner(), winner);
  assert.equal(terminal.exitCode(), 130);
});

test("an abort-listener escalation preserves graceful-before-force signal order", () => {
  const registry = createRequiredExhaustiveProcessRegistry();
  const forwarded = [];
  registry.register("reentrant-step", (signal) => forwarded.push(signal));
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  terminal.signal.addEventListener(
    "abort",
    () => {
      terminal.cancel("SIGINT");
    },
    { once: true },
  );

  const failure = new Error("injected first terminal failure");
  assert.equal(terminal.claimFailure(failure).first, true);
  assert.deepEqual(forwarded, ["SIGTERM", "SIGKILL"]);
  assert.equal(terminal.winner().reason, failure);
  assert.equal(terminal.exitCode(), 1);
});

test("a reentrant escalation waits until every graceful termination request is sent", () => {
  const registry = createRequiredExhaustiveProcessRegistry();
  const forwarded = [];
  let terminal;
  registry.register("first-step", (signal) => {
    forwarded.push(["first-step", signal]);
    if (signal === "SIGTERM") terminal.cancel("SIGINT");
  });
  registry.register("second-step", (signal) => forwarded.push(["second-step", signal]));
  terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });

  assert.equal(terminal.claimFailure(new Error("injected failure")).first, true);
  assert.deepEqual(forwarded, [
    ["first-step", "SIGTERM"],
    ["second-step", "SIGTERM"],
    ["first-step", "SIGKILL"],
    ["second-step", "SIGKILL"],
  ]);
});

test("late signals and grace expiry can force-terminate each process only once", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const child = createFakeChild(225);
  const forwarded = [];
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => child,
    forwardSignalFunction: (signal) => {
      forwarded.push(signal);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 10_000,
    terminationGraceMs: 2,
    printCommandFunction: null,
  });
  const running = runner(plan.prefix[0], { signal: terminal.signal });
  await waitFor(() => registry.activeCount() === 1, "The child process did not become active.");

  const processError = new Error("injected process failure");
  child.emit("error", processError);
  assert.equal(terminal.cancel("SIGINT").first, false);
  assert.equal(terminal.cancel("SIGTERM").first, false);
  await delay(20);
  assert.deepEqual(forwarded, ["SIGTERM", "SIGKILL"]);
  assert.equal(terminal.winner().reason, processError);
  assert.equal(terminal.exitCode(), 1);

  child.emit("close", null, "SIGKILL");
  await assert.rejects(running, (error) => error === processError);
});

test("one host signal stays graceful when the first cancelled child closes cleanly", async () => {
  const plan = createShadowPlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const children = [createFakeChild(226), createFakeChild(227)];
  const forwarded = [];
  let spawnIndex = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => children[spawnIndex++],
    forwardSignalFunction: (signal, child) => {
      forwarded.push([child.pid, signal]);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 10_000,
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const running = runShadowPlan(plan, {
    terminalState: terminal,
    runStep: async (workload, options) =>
      workload.executionClass === "CONCURRENT_PROOF"
        ? await runner(workload, options)
        : pass(workload),
    ...successfulGuardOptions(),
  });
  const rejected = assert.rejects(running, (error) => error === terminal.winner().reason);
  await waitFor(() => registry.activeCount() === 2, "Both proof children did not become active.");

  assert.equal(terminal.cancel("SIGINT").first, true);
  assert.deepEqual(forwarded, [
    [226, "SIGINT"],
    [227, "SIGINT"],
  ]);
  children[0].emit("close", 0, null);
  await delay(20);
  assert.deepEqual(forwarded, [
    [226, "SIGINT"],
    [227, "SIGINT"],
  ]);

  assert.equal(terminal.cancel("SIGTERM").first, false);
  assert.deepEqual(forwarded, [
    [226, "SIGINT"],
    [227, "SIGINT"],
    [227, "SIGKILL"],
  ]);
  children[1].emit("close", null, "SIGKILL");
  await rejected;
});

test("a child that closes while receiving its graceful signal never gets a late SIGKILL", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const child = createFakeChild(228);
  const forwarded = [];
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => child,
    forwardSignalFunction: (signal) => {
      forwarded.push(signal);
      if (signal === "SIGTERM") child.emit("close", 0, null);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async () => undefined,
    stepTimeoutMs: 10_000,
    terminationGraceMs: 2,
    printCommandFunction: null,
  });
  const running = runner(plan.prefix[0], { signal: terminal.signal });
  const rejected = assert.rejects(running, RequiredExhaustiveCancellationError);
  await waitFor(() => registry.activeCount() === 1, "The child process did not become active.");

  assert.equal(terminal.cancel("SIGTERM").first, true);
  await delay(20);
  assert.deepEqual(forwarded, ["SIGTERM"]);
  assert.equal(registry.activeCount(), 0);
  await rejected;
});

test("a nonzero close stops its sibling before delayed isolation cleanup can finish", async () => {
  const plan = createRequiredExhaustivePlan();
  const registry = createRequiredExhaustiveProcessRegistry();
  const terminal = createRequiredExhaustiveTerminalState({ processRegistry: registry });
  const children = [createFakeChild(231), createFakeChild(232)];
  const forwarded = [];
  let spawnIndex = 0;
  let releaseCleanup;
  const delayedCleanup = new Promise((resolvePromise) => {
    releaseCleanup = resolvePromise;
  });
  const firstStepId = plan.proofPairs[0].verifier.id;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => children[spawnIndex++],
    forwardSignalFunction: (signal, child) => {
      forwarded.push([child.pid, signal]);
      return true;
    },
    processRegistry: registry,
    terminalState: terminal,
    prepareStepEnvironment: async ({ workload }) => ({
      env: {},
      dispose: async () => {
        if (workload.id === firstStepId) await delayedCleanup;
      },
    }),
    stepTimeoutMs: 10_000,
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const executions = plan.proofPairs
    .slice(0, 2)
    .map(({ verifier }) => runner(verifier, { signal: terminal.signal }));
  await waitFor(() => registry.activeCount() === 2, "Both close fixtures did not start.");

  children[0].emit("close", 7, null);
  assert.equal(terminal.winner().kind, "COMMAND_CLOSE");
  assert.equal(
    forwarded.some(([pid, signal]) => pid === children[1].pid && signal === "SIGTERM"),
    true,
  );
  let firstSettled = false;
  executions[0].catch(() => {
    firstSettled = true;
  });
  await Promise.resolve();
  assert.equal(firstSettled, false);

  releaseCleanup();
  children[1].emit("close", null, "SIGTERM");
  const results = await Promise.allSettled(executions);
  assert.equal(
    results.every(({ status }) => status === "rejected"),
    true,
  );
  assert.equal(terminal.winner().kind, "COMMAND_CLOSE");
});

test("ESRCH during cancellation is harmless but the runner still awaits close", async () => {
  const plan = createRequiredExhaustivePlan();
  const child = createFakeChild(301);
  const controller = new AbortController();
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => child,
    forwardSignalFunction: () => {
      const error = new Error("already gone");
      error.code = "ESRCH";
      throw error;
    },
    terminationGraceMs: 1_000,
    printCommandFunction: null,
  });
  const running = runner(plan.prefix[0], { signal: controller.signal });
  await Promise.resolve();
  controller.abort(new RequiredExhaustiveCancellationError("SIGTERM"));
  let settled = false;
  running.catch(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  child.emit("close", null, "SIGTERM");
  await assert.rejects(running, RequiredExhaustiveCancellationError);
});

test("step timeout terminates, escalates, and cannot settle before close", async () => {
  const plan = createRequiredExhaustivePlan();
  const child = createFakeChild(401);
  const signals = [];
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => child,
    forwardSignalFunction: (signal) => {
      signals.push(signal);
      return true;
    },
    stepTimeoutMs: 2,
    terminationGraceMs: 2,
    printCommandFunction: null,
  });
  const running = runner(plan.prefix[0]);
  let settled = false;
  running.catch(() => {
    settled = true;
  });
  await delay(20);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(settled, false);
  child.emit("close", null, "SIGKILL");
  await assert.rejects(running, RequiredExhaustiveTimeoutError);
});

test("process error and close races preserve the process error and settle once", async () => {
  const plan = createRequiredExhaustivePlan();
  const child = createFakeChild(501);
  const processError = new Error("injected child error");
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => child,
    printCommandFunction: null,
  });
  const running = runner(plan.prefix[0]);
  await waitFor(
    () => child.listenerCount("error") > 0,
    "The process runner did not install its error listener.",
  );
  child.emit("error", processError);
  let settled = false;
  running.catch(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  child.emit("close", 1, null);
  child.emit("close", 0, null);
  await assert.rejects(running, (error) => error === processError);
});

test("the isolation hook may change environment but never command identity", async () => {
  const plan = createRequiredExhaustivePlan();
  const child = createFakeChild(601);
  let spawnOptions;
  let disposed = 0;
  const runner = createRequiredExhaustiveProcessRunner({
    spawnFunction: (command, args, options) => {
      assert.equal(command, plan.prefix[0].command);
      assert.deepEqual(args, plan.prefix[0].args);
      spawnOptions = options;
      queueMicrotask(() => child.emit("close", 0, null));
      return child;
    },
    prepareStepEnvironment: async () => ({
      env: { TEST_ISOLATION: "owned" },
      dispose: async () => {
        disposed += 1;
      },
    }),
    printCommandFunction: null,
  });
  const observation = await runner(plan.prefix[0]);
  assert.equal(observation.observedClose, true);
  assert.equal(spawnOptions.shell, false);
  assert.equal(spawnOptions.env.TEST_ISOLATION, "owned");
  assert.equal(disposed, 1);

  const rejectedRunner = createRequiredExhaustiveProcessRunner({
    spawnFunction: () => assert.fail("A replaced command must not spawn."),
    prepareStepEnvironment: async () => ({
      command: "pnpm",
      env: {},
      dispose: async () => undefined,
    }),
    printCommandFunction: null,
  });
  await assert.rejects(rejectedRunner(plan.prefix[0]), RequiredExhaustiveQualityGateError);
});

test("build-output and untracked closing guards run after a primary proof failure", async () => {
  const plan = createShadowPlan();
  const primary = new Error("primary proof failure");
  const buildDrift = new Error("build output drift");
  let buildSnapshots = 0;
  let untrackedSnapshots = 0;

  await assert.rejects(
    runShadowPlan(plan, {
      runStep: async (workload) => {
        if (workload.id === plan.proofPairs[0].verifier.id) throw primary;
        return pass(workload);
      },
      ...successfulGuardOptions({
        snapshotBuildOutputsFunction: async () => ({ sequence: ++buildSnapshots }),
        assertBuildOutputsUnchangedFunction: () => {
          throw buildDrift;
        },
        snapshotUntrackedStateFunction: async () => ({ sequence: ++untrackedSnapshots }),
        assertUntrackedStateUnchangedFunction: () => undefined,
      }),
    }),
    (error) => {
      assert.equal(error, primary);
      assert.equal(error.buildOutputGuardError, buildDrift);
      assert.equal(error.requiredExhaustiveReceipt.status, "FAIL");
      return true;
    },
  );
  assert.equal(buildSnapshots, 2);
  assert.equal(untrackedSnapshots, 2);
});

test("untracked drift fails the gate even after all 188 steps close successfully", async () => {
  const plan = createShadowPlan();
  const untrackedDrift = new Error("untracked drift");
  await assert.rejects(
    runShadowPlan(plan, {
      runStep: async (workload) => pass(workload),
      ...successfulGuardOptions({
        assertUntrackedStateUnchangedFunction: () => {
          throw untrackedDrift;
        },
      }),
    }),
    (error) => {
      assert.equal(error, untrackedDrift);
      assert.equal(error.requiredExhaustiveReceipt.status, "FAIL");
      assert.equal(error.requiredExhaustiveReceipt.observedClosedCount, 188);
      return true;
    },
  );
});

test("the full gate authenticates repository inputs and hosted revision without executing commands", async () => {
  const plan = createShadowPlan();
  const revision = "a".repeat(40);
  const receipt = await executeRequiredExhaustiveQualityGate({
    workspaceRoot: WORKSPACE_ROOT,
    authority: OPTIONAL_AUTHORITY,
    plan,
    expectedRevision: revision,
    readRevisionFunction: async () => revision,
    readInventoryFunction: async () => await readExhaustiveGateRepositoryInventory(WORKSPACE_ROOT),
    captureWorkspaceFunction: async () => SAME_WORKSPACE,
    assertCleanInputFunction: async (_workspaceRoot, expectedRevision) =>
      Object.freeze({ status: "PASS", revision: expectedRevision }),
    runStep: async (workload) => pass(workload),
    ...successfulGuardOptions(),
  });

  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.revision, revision);
  assert.equal(receipt.inventory.status, "PASS");
  assert.equal(receipt.inventory.authority, "SHADOW");
  assert.equal(receipt.inventory.scope, "EXHAUSTIVE");
  assert.equal(receipt.execution.status, "PASS");
  assert.equal(receipt.execution.observedClosedCount, 188);
  assert.equal(receipt.execution.cleanInput.revision, revision);
});

test("the soft complete-gate timeout claims cooperative terminal failure", async () => {
  const plan = createShadowPlan();
  const revision = "c".repeat(40);
  await assert.rejects(
    executeRequiredExhaustiveQualityGate({
      workspaceRoot: WORKSPACE_ROOT,
      authority: OPTIONAL_AUTHORITY,
      plan,
      expectedRevision: revision,
      readRevisionFunction: async () => revision,
      readInventoryFunction: async () =>
        await readExhaustiveGateRepositoryInventory(WORKSPACE_ROOT),
      captureWorkspaceFunction: async () => SAME_WORKSPACE,
      assertCleanInputFunction: async () => Object.freeze({ status: "PASS", revision }),
      runStep: async (_workload, { signal }) => {
        await new Promise((resolvePromise) => {
          signal.addEventListener("abort", resolvePromise, { once: true });
        });
        throw signal.reason;
      },
      gateTimeoutMs: 2,
      ...successfulGuardOptions(),
    }),
    (error) =>
      error instanceof RequiredExhaustiveGateTimeoutError &&
      error.code === "REQUIRED_EXHAUSTIVE_GATE_TIMEOUT",
  );
});

test("cancellation during the final tracked snapshot cannot return PASS", async () => {
  const plan = createShadowPlan();
  const controller = new AbortController();
  const cancellation = new RequiredExhaustiveCancellationError("SIGTERM");
  let snapshots = 0;
  await assert.rejects(
    executeRequiredExhaustiveQualityGate({
      workspaceRoot: WORKSPACE_ROOT,
      authority: OPTIONAL_AUTHORITY,
      plan,
      signal: controller.signal,
      readRevisionFunction: async () => "b".repeat(40),
      readInventoryFunction: async () =>
        await readExhaustiveGateRepositoryInventory(WORKSPACE_ROOT),
      captureWorkspaceFunction: async () => {
        snapshots += 1;
        if (snapshots === 2) controller.abort(cancellation);
        return SAME_WORKSPACE;
      },
      assertCleanInputFunction: async () => Object.freeze({ status: "PASS" }),
      runStep: async (workload) => pass(workload),
      ...successfulGuardOptions(),
    }),
    (error) => {
      assert.equal(error, cancellation);
      assert.equal(error.exhaustiveGateReceipt.status, "FAIL");
      assert.equal(error.exhaustiveGateReceipt.execution.status, "PASS");
      return true;
    },
  );
  assert.equal(snapshots, 2);
});
