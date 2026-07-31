import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  EXPECTED_MODULAR_SCHEDULE_SHA256,
  GLOBAL_PREFIX_IDS,
  GLOBAL_SUFFIX_IDS,
  ModularCancellationError,
  ModularQualityGateError,
  PROOF_CONCURRENCY,
  createModularQualityGateSchedule,
  createProcessStepRunner,
  executeModularQualityGate,
  runModularSchedule,
} from "../run-modular-quality-gate.mjs";
import { PROOF_ENTRIES, createQualityGateSteps } from "../../run-ci-quality-gate.mjs";

function stepIds(schedule) {
  return [
    ...schedule.prefix.map(({ id }) => id),
    ...schedule.proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    ...schedule.suffix.map(({ id }) => id),
  ];
}

test("the modular schedule owns every exact legacy step once", () => {
  const legacySteps = createQualityGateSteps();
  const schedule = createModularQualityGateSchedule();
  const ownedIds = stepIds(schedule);

  assert.equal(schedule.stepCount, 130);
  assert.equal(schedule.proofPairCount, 61);
  assert.equal(schedule.concurrency, 2);
  assert.deepEqual(
    schedule.prefix.map(({ id }) => id),
    GLOBAL_PREFIX_IDS,
  );
  assert.deepEqual(
    schedule.suffix.map(({ id }) => id),
    GLOBAL_SUFFIX_IDS,
  );
  assert.equal(ownedIds.length, legacySteps.length);
  assert.equal(new Set(ownedIds).size, legacySteps.length);
  assert.deepEqual([...ownedIds].sort(), legacySteps.map(({ id }) => id).sort());
  assert.deepEqual(
    schedule.proofPairs.map(({ id }) => id),
    PROOF_ENTRIES.map(({ id }) => id),
  );
  for (const pair of schedule.proofPairs) {
    assert.equal(pair.verifier.id, `verify-${pair.id}`);
    assert.equal(pair.rootTest.id, `test-${pair.id}`);
  }
});

test("the modular schedule hash and grouping are deterministic", () => {
  const first = createModularQualityGateSchedule();
  const second = createModularQualityGateSchedule();

  assert.equal(
    EXPECTED_MODULAR_SCHEDULE_SHA256,
    "28040878bca4748500f08b0f946a409a6abc4099c80f432bc9ac33d7b5342575",
  );
  assert.equal(first.scheduleSha256, EXPECTED_MODULAR_SCHEDULE_SHA256);
  assert.equal(second.scheduleSha256, EXPECTED_MODULAR_SCHEDULE_SHA256);
  assert.deepEqual(stepIds(first), stepIds(second));
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.proofPairs));
});

test("duplicate, missing, and unknown proof ownership fail closed", () => {
  assert.throws(
    () =>
      createModularQualityGateSchedule({
        proofEntries: [...PROOF_ENTRIES, PROOF_ENTRIES[0]],
      }),
    (error) => error instanceof ModularQualityGateError && /duplicate ids/u.test(error.message),
  );

  assert.throws(
    () =>
      createModularQualityGateSchedule({
        proofEntries: PROOF_ENTRIES.slice(0, -1),
      }),
    (error) => error instanceof ModularQualityGateError && /legacy-step order/u.test(error.message),
  );

  assert.throws(
    () =>
      createModularQualityGateSchedule({
        proofEntries: [
          ...PROOF_ENTRIES.slice(0, -1),
          Object.freeze({
            id: "unknown-proof",
            verifierFile: "scripts/verify-unknown-proof.mjs",
            rootTestFile: "tests/unknown-proof.test.mjs",
          }),
        ],
      }),
    (error) => error instanceof ModularQualityGateError && /legacy-step order/u.test(error.message),
  );
});

test("missing, duplicate, or appended legacy steps cannot enter the modular schedule", () => {
  const missing = createQualityGateSteps().slice(0, -1);
  assert.throws(() => createModularQualityGateSchedule({ steps: missing }));

  const duplicate = [...createQualityGateSteps()];
  duplicate[1] = duplicate[0];
  assert.throws(() => createModularQualityGateSchedule({ steps: duplicate }));

  const unknown = [
    ...createQualityGateSteps(),
    Object.freeze({
      id: "unknown-step",
      label: "Unknown",
      command: "node",
      args: Object.freeze(["unknown.mjs"]),
    }),
  ];
  assert.throws(() => createModularQualityGateSchedule({ steps: unknown }));
});

test("execution revalidates hostile injected schedules before starting any step", async () => {
  const hostileSchedules = [];

  const widened = structuredClone(createModularQualityGateSchedule());
  widened.concurrency = 3;
  hostileSchedules.push(widened);

  const incomplete = structuredClone(createModularQualityGateSchedule());
  incomplete.legacySteps.pop();
  hostileSchedules.push(incomplete);

  const duplicate = structuredClone(createModularQualityGateSchedule());
  duplicate.legacySteps[1] = duplicate.legacySteps[0];
  hostileSchedules.push(duplicate);

  const mutatedCommand = structuredClone(createModularQualityGateSchedule());
  mutatedCommand.legacySteps[0].command = "pnpm";
  hostileSchedules.push(mutatedCommand);

  const mutatedArgs = structuredClone(createModularQualityGateSchedule());
  mutatedArgs.legacySteps[0].args = ["unreviewed-writer"];
  hostileSchedules.push(mutatedArgs);

  for (const hostileSchedule of hostileSchedules) {
    let executionCount = 0;
    await assert.rejects(
      runModularSchedule(hostileSchedule, {
        runStep: async () => {
          executionCount += 1;
        },
      }),
      ModularQualityGateError,
    );
    assert.equal(executionCount, 0);
  }
});

test("the default process runner refuses an unvalidated step before spawn", async () => {
  const schedule = createModularQualityGateSchedule();
  const forgedStep = structuredClone(schedule.prefix[0]);
  forgedStep.args = [...forgedStep.args, "unreviewed-writer"];
  let spawnCount = 0;
  const runner = createProcessStepRunner({
    spawnFunction() {
      spawnCount += 1;
      throw new Error("must not spawn");
    },
    printCommandFunction: null,
  });

  await assert.rejects(runner(forgedStep), ModularQualityGateError);
  assert.equal(spawnCount, 0);
});

test("the process runner rejects same-identity mutation after factory validation", async () => {
  const mutableSteps = structuredClone(createQualityGateSteps());
  const schedule = createModularQualityGateSchedule({ steps: mutableSteps });
  const validatedThenMutatedStep = schedule.prefix[0];
  validatedThenMutatedStep.command = "pnpm";
  validatedThenMutatedStep.args.push("unreviewed-writer");
  let spawnCount = 0;
  const runner = createProcessStepRunner({
    spawnFunction() {
      spawnCount += 1;
      throw new Error("must not spawn");
    },
    printCommandFunction: null,
  });

  await assert.rejects(
    runner(validatedThenMutatedStep),
    (error) =>
      error instanceof ModularQualityGateError &&
      /identity or command drifted/u.test(error.message),
  );
  assert.equal(spawnCount, 0);
});

test("a successful modular run executes all 130 steps and returns legacy-ordered receipts", async () => {
  const schedule = createModularQualityGateSchedule();
  const executionOrder = [];
  const receipt = await runModularSchedule(schedule, {
    runStep: async ({ id }) => {
      executionOrder.push(id);
    },
  });

  assert.equal(executionOrder.length, 130);
  assert.equal(new Set(executionOrder).size, 130);
  assert.deepEqual([...executionOrder].sort(), schedule.legacySteps.map(({ id }) => id).sort());
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    schedule.legacySteps.map(({ id }) => id),
  );
  assert.equal(
    receipt.steps.every(({ status }) => status === "PASS"),
    true,
  );
  assert.equal(
    receipt.proofPairs.every(({ status }) => status === "PASS"),
    true,
  );
  assert.equal(receipt.status, "PASS");
});

test("only proof pairs overlap, with a hard concurrency bound of two", async () => {
  const schedule = createModularQualityGateSchedule();
  let active = 0;
  let maximumActive = 0;
  let completedProofSteps = 0;
  const pairStepOrder = new Map();

  const receipt = await runModularSchedule(schedule, {
    runStep: async ({ id }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (id.startsWith("verify-") || id.startsWith("test-")) {
        const proofId = id.replace(/^(?:verify|test)-/u, "");
        const order = pairStepOrder.get(proofId) ?? [];
        order.push(id.startsWith("verify-") ? "verify" : "test");
        pairStepOrder.set(proofId, order);
        await delay(2);
        completedProofSteps += 1;
      } else {
        assert.equal(active, 1);
      }
      active -= 1;
    },
  });

  assert.equal(PROOF_CONCURRENCY, 2);
  assert.equal(maximumActive, 2);
  assert.equal(completedProofSteps, 122);
  assert.equal(receipt.status, "PASS");
  for (const proofId of PROOF_ENTRIES.map(({ id }) => id)) {
    assert.deepEqual(pairStepOrder.get(proofId), ["verify", "test"]);
  }
});

test("the first proof failure aborts its active sibling and starts no later pair", async () => {
  const schedule = createModularQualityGateSchedule();
  const [firstPair, secondPair] = schedule.proofPairs;
  const startedProofSteps = [];
  const injectedFailure = new Error("injected proof failure");
  let releaseBoth;
  const bothStarted = new Promise((resolvePromise) => {
    releaseBoth = resolvePromise;
  });

  await assert.rejects(
    runModularSchedule(schedule, {
      runStep: async ({ id }, { signal }) => {
        if (!id.startsWith("verify-") && !id.startsWith("test-")) {
          return;
        }
        startedProofSteps.push(id);
        if (startedProofSteps.length === 2) {
          releaseBoth();
        }
        await bothStarted;
        if (id === firstPair.verifier.id) {
          throw injectedFailure;
        }
        await new Promise((resolvePromise, rejectPromise) => {
          if (signal.aborted) {
            rejectPromise(signal.reason);
            return;
          }
          signal.addEventListener("abort", () => rejectPromise(signal.reason), {
            once: true,
          });
        });
      },
    }),
    (error) => {
      assert.equal(error, injectedFailure);
      assert.deepEqual(
        startedProofSteps.sort(),
        [firstPair.verifier.id, secondPair.verifier.id].sort(),
      );
      assert.equal(
        error.modularReceipt.steps.find(({ id }) => id === firstPair.verifier.id).status,
        "FAIL",
      );
      assert.equal(
        error.modularReceipt.steps.find(({ id }) => id === secondPair.verifier.id).status,
        "CANCELLED",
      );
      assert.equal(
        error.modularReceipt.steps.find(({ id }) => id === firstPair.rootTest.id).status,
        "NOT_RUN",
      );
      assert.equal(
        error.modularReceipt.steps.find(({ id }) => id === GLOBAL_SUFFIX_IDS[0]).status,
        "NOT_RUN",
      );
      return true;
    },
  );
});

test("external cancellation is permanent, reaches both workers, and skips the suffix", async () => {
  const schedule = createModularQualityGateSchedule();
  const controller = new AbortController();
  const cancellation = new ModularCancellationError("SIGTERM");
  let activeProofSteps = 0;
  let releaseStarted;
  const bothStarted = new Promise((resolvePromise) => {
    releaseStarted = resolvePromise;
  });

  const execution = runModularSchedule(schedule, {
    signal: controller.signal,
    runStep: async ({ id }, { signal }) => {
      if (!id.startsWith("verify-") && !id.startsWith("test-")) {
        return;
      }
      activeProofSteps += 1;
      if (activeProofSteps === 2) {
        releaseStarted();
      }
      await new Promise((resolvePromise, rejectPromise) => {
        if (signal.aborted) {
          rejectPromise(signal.reason);
          return;
        }
        signal.addEventListener("abort", () => rejectPromise(signal.reason), {
          once: true,
        });
      });
    },
  });

  await bothStarted;
  controller.abort(cancellation);
  await assert.rejects(execution, (error) => {
    assert.equal(error, cancellation);
    assert.equal(
      error.modularReceipt.steps.filter(({ status }) => status === "CANCELLED").length,
      2,
    );
    assert.equal(
      error.modularReceipt.steps.find(({ id }) => id === GLOBAL_SUFFIX_IDS[0]).status,
      "NOT_RUN",
    );
    return true;
  });
});

test("the process runner never spawns after cancellation and forwards cancellation to its group", async () => {
  const schedule = createModularQualityGateSchedule();
  const validatedStep = schedule.prefix[0];
  const cancelled = new AbortController();
  cancelled.abort(new ModularCancellationError("SIGINT"));
  let spawnCount = 0;
  const neverSpawn = createProcessStepRunner({
    spawnFunction() {
      spawnCount += 1;
      throw new Error("must not spawn");
    },
    printCommandFunction: undefined,
  });
  await assert.rejects(
    neverSpawn(validatedStep, { signal: cancelled.signal }),
    ModularCancellationError,
  );
  assert.equal(spawnCount, 0);

  const child = new EventEmitter();
  child.pid = 123;
  child.killed = false;
  child.kill = () => true;
  const forwardedSignals = [];
  const controller = new AbortController();
  const runner = createProcessStepRunner({
    spawnFunction() {
      return child;
    },
    forwardSignalFunction(signal, activeChild) {
      assert.equal(activeChild, child);
      forwardedSignals.push(signal);
      return true;
    },
    terminationGraceMs: 0,
    printCommandFunction: null,
  });
  const running = runner(validatedStep, { signal: controller.signal });
  controller.abort(new ModularCancellationError("SIGTERM"));
  child.emit("close", null, "SIGTERM");
  await assert.rejects(running, ModularCancellationError);
  assert.deepEqual(forwardedSignals, ["SIGTERM"]);
});

test("an initial signal-forward failure escalates and never settles before child close", async () => {
  const validatedStep = createModularQualityGateSchedule().prefix[0];
  const child = new EventEmitter();
  child.pid = 321;
  child.killed = false;
  child.kill = () => true;
  const forwardedSignals = [];
  const initialForwardError = new Error("injected initial forward failure");
  const controller = new AbortController();
  const runner = createProcessStepRunner({
    spawnFunction: () => child,
    forwardSignalFunction(signal) {
      forwardedSignals.push(signal);
      if (signal === "SIGTERM") {
        throw initialForwardError;
      }
      return true;
    },
    terminationGraceMs: 1,
    printCommandFunction: null,
  });
  let settled = false;
  const running = runner(validatedStep, { signal: controller.signal });
  running.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  controller.abort(new ModularCancellationError("SIGTERM"));
  await delay(10);
  assert.deepEqual(forwardedSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(settled, false);

  child.emit("close", null, "SIGKILL");
  await assert.rejects(running, (error) => {
    assert.ok(error instanceof ModularCancellationError);
    assert.deepEqual(error.details.terminationErrors, [
      {
        name: initialForwardError.name,
        message: initialForwardError.message,
      },
    ]);
    return true;
  });
});

test("ignored Windows SIGTERM still escalates to SIGKILL despite child.killed", async () => {
  const validatedStep = createModularQualityGateSchedule().prefix[0];
  const child = new EventEmitter();
  child.pid = 456;
  child.killed = false;
  const childSignals = [];
  child.kill = (signal) => {
    childSignals.push(signal);
    child.killed = true;
    return true;
  };
  const controller = new AbortController();
  const runner = createProcessStepRunner({
    spawnFunction: () => child,
    platform: "win32",
    terminationGraceMs: 1,
    printCommandFunction: null,
  });
  let settled = false;
  const running = runner(validatedStep, { signal: controller.signal });
  running.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  controller.abort(new ModularCancellationError("SIGTERM"));
  await delay(10);
  assert.deepEqual(childSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(child.killed, true);
  assert.equal(settled, false);

  child.emit("close", null, "SIGKILL");
  await assert.rejects(running, ModularCancellationError);
});

test("process error and close races settle once only after close", async () => {
  const validatedStep = createModularQualityGateSchedule().prefix[0];
  const child = new EventEmitter();
  child.pid = 789;
  child.killed = false;
  child.kill = () => true;
  const runner = createProcessStepRunner({
    spawnFunction: () => child,
    printCommandFunction: null,
  });
  const processError = new Error("injected child error");
  let settled = false;
  const running = runner(validatedStep);
  running.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );

  child.emit("error", processError);
  await Promise.resolve();
  assert.equal(settled, false);
  child.emit("close", 1, null);
  child.emit("close", 0, null);
  await assert.rejects(running, (error) => error === processError);
  assert.equal(settled, true);
});

test("executeModularQualityGate keeps the legacy tracked-workspace closing guard authoritative", async () => {
  let snapshotCount = 0;
  await assert.rejects(
    executeModularQualityGate({
      runStep: async () => undefined,
      snapshotFunction: async () => ({
        digest: snapshotCount++ === 0 ? "before" : "after",
        trackedFileCount: 1,
      }),
    }),
    (error) => {
      assert.match(error.message, /tracked workspace bytes or modes/u);
      assert.equal(error.receipt.status, "FAIL");
      assert.equal(error.receipt.modular.steps.length, 130);
      assert.equal(
        error.receipt.modular.steps.every(({ status }) => status === "PASS"),
        true,
      );
      return true;
    },
  );
});
