import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PROOF_ENTRIES,
  createQualityGateSteps,
  executeQualityGate,
  validateQualityGatePlan,
} from "../run-ci-quality-gate.mjs";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../..");
const PROOF_CONCURRENCY = 2;
const TERMINATION_GRACE_MS = 5_000;
const VALIDATED_LEGACY_STEPS = new WeakMap();

const GLOBAL_PREFIX_IDS = Object.freeze([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "workspace-graph",
  "package-tests",
]);

const GLOBAL_SUFFIX_IDS = Object.freeze(["dependency-boundaries", "boundary-fixtures"]);

const EXPECTED_MODULAR_SCHEDULE_SHA256 =
  "28040878bca4748500f08b0f946a409a6abc4099c80f432bc9ac33d7b5342575";

class ModularQualityGateError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ModularQualityGateError";
    this.details = details;
  }
}

class ModularCommandError extends ModularQualityGateError {
  constructor(step, code, signal) {
    super(`"${step.label}" failed.`, {
      stepId: step.id,
      code,
      signal,
    });
    this.name = "ModularCommandError";
    this.code = code;
    this.signal = signal;
  }
}

class ModularCancellationError extends ModularQualityGateError {
  constructor(signal) {
    super(`The modular quality gate was cancelled by ${signal}.`, { signal });
    this.name = "ModularCancellationError";
    this.signal = signal;
  }
}

function assertExactIds(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new ModularQualityGateError(`${label} drifted from the validated legacy plan.`, {
      expected,
      actual,
    });
  }
}

function assertUniqueIds(ids, label) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new ModularQualityGateError(`${label} contains duplicate ids.`, {
      duplicates: [...new Set(duplicates)],
    });
  }
}

function normalizeSchedule(schedule) {
  return {
    schemaVersion: 1,
    legacyPlanSha256: schedule.legacyPlanSha256,
    concurrency: schedule.concurrency,
    prefix: schedule.prefix.map(({ id }) => id),
    proofPairs: schedule.proofPairs.map(({ id, verifier, rootTest }) => ({
      id,
      steps: [verifier.id, rootTest.id],
    })),
    suffix: schedule.suffix.map(({ id }) => id),
  };
}

function calculateScheduleSha256(schedule) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeSchedule(schedule)))
    .digest("hex");
}

function assertExactOwnKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ModularQualityGateError(`${label} is not an object.`);
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  assertExactIds(actualKeys, sortedExpectedKeys, `${label} fields`);
}

function assertExactStep(actual, expected, label) {
  assertExactOwnKeys(actual, ["id", "label", "command", "args"], label);
  if (
    actual.id !== expected.id ||
    actual.label !== expected.label ||
    actual.command !== expected.command
  ) {
    throw new ModularQualityGateError(`${label} identity or command drifted.`, {
      expected: {
        id: expected.id,
        label: expected.label,
        command: expected.command,
      },
      actual: {
        id: actual.id,
        label: actual.label,
        command: actual.command,
      },
    });
  }
  if (!Array.isArray(actual.args)) {
    throw new ModularQualityGateError(`${label} args are not an array.`);
  }
  assertExactIds(actual.args, expected.args, `${label} args`);
}

function validateScheduleForExecution(candidate) {
  const expected = createModularQualityGateSchedule();
  try {
    assertExactOwnKeys(
      candidate,
      [
        "concurrency",
        "legacyPlanSha256",
        "legacySteps",
        "prefix",
        "proofPairs",
        "suffix",
        "scheduleSha256",
        "stepCount",
        "proofPairCount",
      ],
      "The injected modular schedule",
    );
    for (const field of [
      "concurrency",
      "legacyPlanSha256",
      "scheduleSha256",
      "stepCount",
      "proofPairCount",
    ]) {
      if (candidate[field] !== expected[field]) {
        throw new ModularQualityGateError(`The injected modular schedule ${field} drifted.`, {
          expected: expected[field],
          actual: candidate[field],
        });
      }
    }
    if (candidate.concurrency !== PROOF_CONCURRENCY) {
      throw new ModularQualityGateError("The injected modular schedule widened concurrency.", {
        expected: PROOF_CONCURRENCY,
        actual: candidate.concurrency,
      });
    }

    for (const field of ["legacySteps", "prefix", "proofPairs", "suffix"]) {
      if (!Array.isArray(candidate[field])) {
        throw new ModularQualityGateError(
          `The injected modular schedule ${field} is not an array.`,
        );
      }
    }
    if (candidate.legacySteps.length !== expected.legacySteps.length) {
      throw new ModularQualityGateError("The injected modular schedule omitted legacy steps.", {
        expected: expected.legacySteps.length,
        actual: candidate.legacySteps.length,
      });
    }
    for (const [index, expectedStep] of expected.legacySteps.entries()) {
      assertExactStep(
        candidate.legacySteps[index],
        expectedStep,
        `The injected legacy step at index ${index}`,
      );
    }

    const candidateStepById = new Map(candidate.legacySteps.map((step) => [step.id, step]));
    if (candidateStepById.size !== candidate.legacySteps.length) {
      throw new ModularQualityGateError("The injected modular schedule duplicates legacy steps.");
    }

    assertExactIds(
      candidate.prefix.map(({ id }) => id),
      expected.prefix.map(({ id }) => id),
      "The injected modular prefix",
    );
    assertExactIds(
      candidate.suffix.map(({ id }) => id),
      expected.suffix.map(({ id }) => id),
      "The injected modular suffix",
    );
    for (const step of [...candidate.prefix, ...candidate.suffix]) {
      if (candidateStepById.get(step.id) !== step) {
        throw new ModularQualityGateError(
          `The injected global step "${step.id}" is not owned by its legacy-step identity.`,
        );
      }
    }

    if (candidate.proofPairs.length !== expected.proofPairs.length) {
      throw new ModularQualityGateError("The injected modular schedule omitted proof pairs.", {
        expected: expected.proofPairs.length,
        actual: candidate.proofPairs.length,
      });
    }
    for (const [index, expectedPair] of expected.proofPairs.entries()) {
      const pair = candidate.proofPairs[index];
      assertExactOwnKeys(pair, ["id", "verifier", "rootTest"], `The injected proof pair ${index}`);
      if (
        pair.id !== expectedPair.id ||
        pair.verifier?.id !== expectedPair.verifier.id ||
        pair.rootTest?.id !== expectedPair.rootTest.id
      ) {
        throw new ModularQualityGateError(`The injected proof pair ${index} drifted.`, {
          expected: {
            id: expectedPair.id,
            verifier: expectedPair.verifier.id,
            rootTest: expectedPair.rootTest.id,
          },
          actual: {
            id: pair.id,
            verifier: pair.verifier?.id,
            rootTest: pair.rootTest?.id,
          },
        });
      }
      if (
        candidateStepById.get(pair.verifier.id) !== pair.verifier ||
        candidateStepById.get(pair.rootTest.id) !== pair.rootTest
      ) {
        throw new ModularQualityGateError(
          `The injected proof pair "${pair.id}" does not own its exact legacy-step identities.`,
        );
      }
    }
  } catch (error) {
    if (error instanceof ModularQualityGateError) {
      throw error;
    }
    throw new ModularQualityGateError("The injected modular schedule could not be inspected.", {
      cause: String(error),
    });
  }
  return expected;
}

/**
 * Derives the modular shadow schedule exclusively from the validated legacy quality-gate plan.
 *
 * The modular schedule changes execution grouping only. Every exact legacy command remains owned
 * once, and every proof verifier remains inseparable from its matching root proof test.
 */
export function createModularQualityGateSchedule({
  steps = createQualityGateSteps(),
  proofEntries = PROOF_ENTRIES,
  expectedScheduleSha256 = EXPECTED_MODULAR_SCHEDULE_SHA256,
} = {}) {
  const legacyPlan = validateQualityGatePlan(steps);
  const stepIds = steps.map(({ id }) => id);
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const proofIds = proofEntries.map(({ id }) => id);

  assertUniqueIds(stepIds, "Legacy quality-gate steps");
  assertUniqueIds(proofIds, "Modular proof entries");

  const expectedVerifierIds = proofEntries.map(({ id }) => `verify-${id}`);
  const expectedRootTestIds = proofEntries.map(({ id }) => `test-${id}`);
  const expectedLegacyOrder = [
    ...GLOBAL_PREFIX_IDS,
    ...expectedVerifierIds,
    ...expectedRootTestIds,
    ...GLOBAL_SUFFIX_IDS,
  ];
  assertExactIds(stepIds, expectedLegacyOrder, "The modular legacy-step order");

  const prefix = GLOBAL_PREFIX_IDS.map((id) => stepById.get(id));
  const suffix = GLOBAL_SUFFIX_IDS.map((id) => stepById.get(id));
  const proofPairs = proofEntries.map(({ id }) => {
    const verifier = stepById.get(`verify-${id}`);
    const rootTest = stepById.get(`test-${id}`);
    if (!verifier || !rootTest) {
      throw new ModularQualityGateError(`Proof "${id}" is missing one of its atomic steps.`, {
        id,
        verifierFound: Boolean(verifier),
        rootTestFound: Boolean(rootTest),
      });
    }
    return Object.freeze({ id, verifier, rootTest });
  });

  const ownedIds = [
    ...prefix.map(({ id }) => id),
    ...proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    ...suffix.map(({ id }) => id),
  ];
  assertUniqueIds(ownedIds, "Modular step ownership");
  if (
    ownedIds.length !== stepIds.length ||
    stepIds.some((id) => !ownedIds.includes(id)) ||
    ownedIds.some((id) => !stepById.has(id))
  ) {
    throw new ModularQualityGateError(
      "The modular schedule does not own every validated legacy step exactly once.",
      {
        missing: stepIds.filter((id) => !ownedIds.includes(id)),
        unknown: ownedIds.filter((id) => !stepById.has(id)),
      },
    );
  }

  const schedule = {
    concurrency: PROOF_CONCURRENCY,
    legacyPlanSha256: legacyPlan.planSha256,
    legacySteps: Object.freeze([...steps]),
    prefix: Object.freeze(prefix),
    proofPairs: Object.freeze(proofPairs),
    suffix: Object.freeze(suffix),
  };
  const scheduleSha256 = calculateScheduleSha256(schedule);
  if (scheduleSha256 !== expectedScheduleSha256) {
    throw new ModularQualityGateError("The reviewed modular schedule drifted.", {
      expected: expectedScheduleSha256,
      actual: scheduleSha256,
    });
  }

  for (const step of steps) {
    VALIDATED_LEGACY_STEPS.set(
      step,
      Object.freeze({
        id: step.id,
        label: step.label,
        command: step.command,
        args: Object.freeze([...step.args]),
      }),
    );
  }

  return Object.freeze({
    ...schedule,
    scheduleSha256,
    stepCount: steps.length,
    proofPairCount: proofPairs.length,
  });
}

function cancellationFromSignal(signal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new ModularCancellationError("ABORT");
}

function cancellationSignalFromReason(reason) {
  return reason instanceof ModularCancellationError ? reason.signal : "SIGTERM";
}

function createStepReceipt(step, status, durationMs, error) {
  const receipt = {
    id: step.id,
    label: step.label,
    status,
    durationMs,
  };
  if (error) {
    receipt.error = Object.freeze({
      name: error.name,
      message: error.message,
    });
  }
  return Object.freeze(receipt);
}

async function runTimedStep(step, runStep, signal, receiptById) {
  if (signal?.aborted) {
    throw cancellationFromSignal(signal);
  }

  const startedAt = performance.now();
  try {
    await runStep(step, { signal });
    if (signal?.aborted) {
      throw cancellationFromSignal(signal);
    }
    receiptById.set(step.id, createStepReceipt(step, "PASS", performance.now() - startedAt));
  } catch (error) {
    const status = signal?.aborted ? "CANCELLED" : "FAIL";
    receiptById.set(step.id, createStepReceipt(step, status, performance.now() - startedAt, error));
    throw error;
  }
}

async function runSequentialSteps(steps, runStep, signal, receiptById) {
  for (const step of steps) {
    await runTimedStep(step, runStep, signal, receiptById);
  }
}

function linkAbortSignal(source, targetController) {
  if (!source) {
    return () => undefined;
  }
  const forwardAbort = () => {
    if (!targetController.signal.aborted) {
      targetController.abort(cancellationFromSignal(source));
    }
  };
  if (source.aborted) {
    forwardAbort();
    return () => undefined;
  }
  source.addEventListener("abort", forwardAbort, { once: true });
  return () => source.removeEventListener("abort", forwardAbort);
}

async function runProofPairs(schedule, runStep, externalSignal, receiptById) {
  const controller = new AbortController();
  const unlinkAbort = linkAbortSignal(externalSignal, controller);
  let nextPairIndex = 0;
  let primaryError;

  const worker = async () => {
    while (!controller.signal.aborted) {
      const pairIndex = nextPairIndex;
      nextPairIndex += 1;
      if (pairIndex >= schedule.proofPairs.length) {
        return;
      }

      const pair = schedule.proofPairs[pairIndex];
      try {
        await runTimedStep(pair.verifier, runStep, controller.signal, receiptById);
        await runTimedStep(pair.rootTest, runStep, controller.signal, receiptById);
      } catch (error) {
        if (!primaryError && !externalSignal?.aborted) {
          primaryError = error;
        }
        if (!controller.signal.aborted) {
          controller.abort(error);
        }
        return;
      }
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(schedule.concurrency, schedule.proofPairs.length) }, async () =>
        worker(),
      ),
    );
  } finally {
    unlinkAbort();
  }

  if (externalSignal?.aborted) {
    throw cancellationFromSignal(externalSignal);
  }
  if (primaryError) {
    throw primaryError;
  }
  if (controller.signal.aborted) {
    throw cancellationFromSignal(controller.signal);
  }
}

function createOrderedReceipts(schedule, receiptById) {
  return Object.freeze(
    schedule.legacySteps.map(
      (step) => receiptById.get(step.id) ?? createStepReceipt(step, "NOT_RUN", 0),
    ),
  );
}

function createPairReceipts(schedule, receiptById) {
  return Object.freeze(
    schedule.proofPairs.map(({ id, verifier, rootTest }) => {
      const verifierReceipt = receiptById.get(verifier.id);
      const rootTestReceipt = receiptById.get(rootTest.id);
      const statuses = [verifierReceipt?.status, rootTestReceipt?.status];
      const status = statuses.includes("FAIL")
        ? "FAIL"
        : statuses.includes("CANCELLED")
          ? "CANCELLED"
          : statuses.every((value) => value === "PASS")
            ? "PASS"
            : "NOT_RUN";
      return Object.freeze({
        id,
        status,
        steps: Object.freeze([
          verifierReceipt ?? createStepReceipt(verifier, "NOT_RUN", 0),
          rootTestReceipt ?? createStepReceipt(rootTest, "NOT_RUN", 0),
        ]),
      });
    }),
  );
}

function createModularReceipt(schedule, receiptById) {
  const steps = createOrderedReceipts(schedule, receiptById);
  return Object.freeze({
    schemaVersion: 1,
    status: steps.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
    scheduleSha256: schedule.scheduleSha256,
    legacyPlanSha256: schedule.legacyPlanSha256,
    concurrency: schedule.concurrency,
    stepCount: schedule.stepCount,
    proofPairCount: schedule.proofPairCount,
    steps,
    proofPairs: createPairReceipts(schedule, receiptById),
  });
}

/**
 * Executes the fixed global prefix, atomic proof pairs, and fixed global suffix.
 *
 * Proof pairs are the only concurrent units. A first failure permanently closes scheduling and
 * aborts every active sibling before the primary failure is returned.
 */
async function runValidatedModularSchedule(schedule, { runStep, signal, receiptById = new Map() }) {
  if (typeof runStep !== "function") {
    throw new ModularQualityGateError("The modular schedule requires a step runner.");
  }

  try {
    await runSequentialSteps(schedule.prefix, runStep, signal, receiptById);
    await runProofPairs(schedule, runStep, signal, receiptById);
    await runSequentialSteps(schedule.suffix, runStep, signal, receiptById);
  } catch (error) {
    error.modularReceipt = createModularReceipt(schedule, receiptById);
    throw error;
  }
  return createModularReceipt(schedule, receiptById);
}

export async function runModularSchedule(schedule, options) {
  return runValidatedModularSchedule(validateScheduleForExecution(schedule), options);
}

function printCommand(step) {
  process.stdout.write(`\n[${step.id}] $ ${step.command} ${step.args.join(" ")}\n`);
}

function forwardDetachedProcessSignal(
  signal,
  child,
  { platform = process.platform, killProcessGroup = process.kill } = {},
) {
  if (!child) {
    return false;
  }
  if (platform !== "win32" && Number.isSafeInteger(child.pid) && child.pid > 0) {
    try {
      killProcessGroup(-child.pid, signal);
      return true;
    } catch (error) {
      if (error?.code === "ESRCH") {
        return false;
      }
      throw error;
    }
  }
  return child.kill(signal);
}

function createProcessCancellationError(signal, terminationErrors) {
  const reason = cancellationFromSignal(signal);
  const cancellationSignal = cancellationSignalFromReason(reason);
  const error = new ModularCancellationError(cancellationSignal);
  error.cause = reason;
  if (terminationErrors.length > 0) {
    error.details = {
      ...error.details,
      terminationErrors: terminationErrors.map((terminationError) => ({
        name: terminationError.name,
        message: terminationError.message,
      })),
    };
  }
  return error;
}

/**
 * Creates a shell-free process runner for validated legacy command steps.
 */
export function createProcessStepRunner({
  workspaceRoot = WORKSPACE_ROOT,
  spawnFunction = spawn,
  forwardSignalFunction,
  platform = process.platform,
  killProcessGroup = process.kill,
  terminationGraceMs = TERMINATION_GRACE_MS,
  printCommandFunction = printCommand,
} = {}) {
  if (
    !Number.isSafeInteger(terminationGraceMs) ||
    terminationGraceMs < 0 ||
    terminationGraceMs > TERMINATION_GRACE_MS
  ) {
    throw new ModularQualityGateError("The process termination grace period is out of bounds.", {
      maximum: TERMINATION_GRACE_MS,
      actual: terminationGraceMs,
    });
  }
  const signalChild =
    forwardSignalFunction ??
    ((signal, child) =>
      forwardDetachedProcessSignal(signal, child, {
        platform,
        killProcessGroup,
      }));

  return async (step, { signal } = {}) => {
    const validatedStep = VALIDATED_LEGACY_STEPS.get(step);
    if (!validatedStep) {
      throw new ModularQualityGateError(
        "The process runner refused a step outside the validated legacy plan.",
        {
          stepId: step?.id,
        },
      );
    }
    assertExactStep(step, validatedStep, `The validated process step "${validatedStep.id}"`);
    if (signal?.aborted) {
      throw cancellationFromSignal(signal);
    }
    printCommandFunction?.(validatedStep);

    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawnFunction(validatedStep.command, validatedStep.args, {
        cwd: workspaceRoot,
        env: process.env,
        detached: process.platform !== "win32",
        shell: false,
        stdio: "inherit",
      });
      let settled = false;
      let terminationTimer;
      let processError;
      const terminationErrors = [];

      const cleanup = () => {
        signal?.removeEventListener("abort", handleAbort);
        if (terminationTimer) {
          clearTimeout(terminationTimer);
        }
      };
      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        callback(value);
      };
      const handleAbort = () => {
        const cancellationSignal = cancellationSignalFromReason(signal.reason);
        try {
          signalChild(cancellationSignal, child);
        } catch (error) {
          terminationErrors.push(error);
        }
        terminationTimer = setTimeout(() => {
          try {
            signalChild("SIGKILL", child);
          } catch (error) {
            if (error?.code !== "ESRCH") {
              terminationErrors.push(error);
            }
          }
        }, terminationGraceMs);
        terminationTimer.unref?.();
      };

      signal?.addEventListener("abort", handleAbort, { once: true });
      if (signal?.aborted) {
        handleAbort();
      }
      child.on("error", (error) => {
        processError ??= error;
      });
      child.on("close", (code, childSignal) => {
        if (signal?.aborted) {
          settle(rejectPromise, createProcessCancellationError(signal, terminationErrors));
          return;
        }
        if (processError) {
          settle(rejectPromise, processError);
          return;
        }
        if (code === 0 && childSignal === null) {
          settle(resolvePromise);
          return;
        }
        settle(rejectPromise, new ModularCommandError(validatedStep, code, childSignal));
      });
    });
  };
}

function attachModularReceipt(receipt, modularReceipt) {
  receipt.modular = modularReceipt;
  return receipt;
}

/**
 * Runs the exhaustive modular shadow gate inside the legacy inventory and tracked-workspace guard.
 */
export async function executeModularQualityGate({
  workspaceRoot = WORKSPACE_ROOT,
  schedule = createModularQualityGateSchedule(),
  runStep = createProcessStepRunner({ workspaceRoot }),
  signal,
  assertCanContinue,
  readInventoryFunction,
  snapshotFunction,
} = {}) {
  const validatedSchedule = validateScheduleForExecution(schedule);
  const receiptById = new Map();
  let modularReceipt;
  const orchestrationStep = Object.freeze({
    id: "modular-exhaustive-shadow",
    label: "Exhaustive modular quality gate",
  });
  const assertExecutionCanContinue = () => {
    if (signal?.aborted) {
      throw cancellationFromSignal(signal);
    }
    assertCanContinue?.();
  };

  try {
    const receipt = await executeQualityGate({
      workspaceRoot,
      readInventoryFunction,
      snapshotFunction,
      steps: [orchestrationStep],
      runStep: async () => {
        modularReceipt = await runValidatedModularSchedule(validatedSchedule, {
          runStep,
          signal,
          receiptById,
        });
      },
      assertCanContinue: assertExecutionCanContinue,
    });
    return attachModularReceipt(receipt, modularReceipt);
  } catch (error) {
    modularReceipt ??= error.modularReceipt ?? createModularReceipt(validatedSchedule, receiptById);
    if (error.receipt) {
      attachModularReceipt(error.receipt, modularReceipt);
    }
    throw error;
  }
}

function printReceipt(receipt) {
  process.stdout.write(
    `\n${JSON.stringify(
      {
        status: receipt.status,
        revision: receipt.revision,
        scheduleSha256: receipt.modular?.scheduleSha256,
        legacyPlanSha256: receipt.modular?.legacyPlanSha256,
        steps: receipt.modular?.steps.map(({ id, status, durationMs }) => ({
          id,
          status,
          duration: `${(durationMs / 1000).toFixed(2)}s`,
        })),
        error: receipt.error,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const controller = new AbortController();
  const handlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      if (!controller.signal.aborted) {
        controller.abort(new ModularCancellationError(signal));
      }
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }

  let failure;
  let receipt;
  try {
    receipt = await executeModularQualityGate({ signal: controller.signal });
  } catch (error) {
    failure = error;
    receipt = error.receipt;
  } finally {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler);
    }
  }

  if (receipt) {
    printReceipt(receipt);
  }
  if (failure) {
    process.stderr.write(`${failure.stack ?? String(failure)}\n`);
    process.exitCode =
      failure instanceof ModularCancellationError
        ? failure.signal === "SIGINT"
          ? 130
          : failure.signal === "SIGTERM"
            ? 143
            : 1
        : 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) {
  await main();
}

export {
  EXPECTED_MODULAR_SCHEDULE_SHA256,
  GLOBAL_PREFIX_IDS,
  GLOBAL_SUFFIX_IDS,
  ModularCancellationError,
  ModularCommandError,
  ModularQualityGateError,
  PROOF_CONCURRENCY,
  calculateScheduleSha256,
};
