import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";

import {
  assertExhaustiveGateCleanInput,
  executeExhaustiveGateBoundary,
} from "./exhaustive-gate-boundary.mjs";
import {
  createExhaustiveWorkloadInventory,
  validateExhaustiveWorkloadInventory,
  validateRepositoryWorkloadInputs,
} from "./exhaustive-workload-inventory.mjs";
import {
  assertBuildOutputsUnchanged,
  assertNonIgnoredUntrackedStateUnchanged,
  assertProofPairsCanRunConcurrently,
  classifyProofPairState,
  createProofStepIsolationContext,
  snapshotBuildOutputs,
  snapshotNonIgnoredUntrackedState,
} from "./shared-state-authority.mjs";

const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
const PROFILE = "desen.ci.required-exhaustive-quality-gate.v1";
const PLAN_PROFILE = "desen.ci.required-exhaustive-plan.v1";
const CLOSE_PROFILE = "desen.ci.exhaustive-step-close.v1";
const REPOSITORY_PROFILE = "desen.ci.exhaustive-repository-authentication.v1";
const REQUIRED_AUTHORITY = "REQUIRED";
const OPTIONAL_AUTHORITY = "SHADOW";
const EXHAUSTIVE_SCOPE = "EXHAUSTIVE";
const EXPECTED_PLAN_SHA256_BY_AUTHORITY = Object.freeze({
  REQUIRED: "73ec61f03fbd5f0899862a3bb94e85fdd3c273ce793f99f7c72a1c30fb158acc",
  SHADOW: "5bd33848d4207e157cc3410e78971d5a22af708f1f57cba930922e5dd4e80519",
});
const PROOF_PAIR_CONCURRENCY = 2;
const DEFAULT_STEP_TIMEOUT_MS = 15 * 60 * 1_000;
const MAXIMUM_STEP_TIMEOUT_MS = 60 * 60 * 1_000;
const DEFAULT_GATE_TIMEOUT_MS = 17 * 60 * 1_000;
const MAXIMUM_GATE_TIMEOUT_MS = 60 * 60 * 1_000;
const DEFAULT_TERMINATION_GRACE_MS = 5_000;
const MAXIMUM_TERMINATION_GRACE_MS = 5_000;
const MAXIMUM_ENVIRONMENT_KEYS = 4_096;
const MAXIMUM_ENVIRONMENT_VALUE_BYTES = 1024 * 1024;
const PLAN_KEYS = Object.freeze([
  "schemaVersion",
  "profile",
  "authority",
  "scope",
  "inventorySha256",
  "concurrency",
  "nodes",
  "prefix",
  "proofPairs",
  "suffix",
  "planSha256",
  "stepCount",
  "proofPairCount",
]);
const PROOF_PAIR_KEYS = Object.freeze(["id", "verifier", "rootTest"]);
const NODE_KEYS = Object.freeze([
  "id",
  "label",
  "command",
  "args",
  "dependencies",
  "executionClass",
  "sharedState",
]);
const CLOSE_KEYS = Object.freeze([
  "schemaVersion",
  "profile",
  "stepId",
  "status",
  "observedClose",
  "code",
  "signal",
]);
const ALLOWED_TERMINATION_SIGNALS = Object.freeze(["SIGINT", "SIGTERM", "SIGKILL"]);
const VALIDATED_PLANS = new WeakSet();
const VALIDATED_NODES = new WeakMap();
const AUTHENTIC_PROCESS_REGISTRIES = new WeakSet();
const AUTHENTIC_TERMINAL_STATES = new WeakSet();
const AUTHENTIC_PROCESS_RUNNERS = new WeakSet();
const PROCESS_RUNNER_TERMINALS = new WeakMap();
const AUTHENTIC_CLOSE_OBSERVATIONS = new WeakSet();
const TERMINAL_KINDS = Object.freeze([
  "TIMEOUT",
  "PROCESS_ERROR",
  "COMMAND_CLOSE",
  "EXTERNAL_SIGNAL",
  "EXECUTION_ERROR",
]);

/** Stable failure raised by the required exhaustive scheduler or process boundary. */
export class RequiredExhaustiveQualityGateError extends Error {
  /**
   * @param {string} code stable machine-readable failure code
   * @param {string} message human-readable failure summary
   * @param {Record<string, unknown>} [details] bounded failure context
   * @param {ErrorOptions} [options] standard error options
   */
  constructor(code, message, details = {}, options = {}) {
    super(message, options);
    this.name = "RequiredExhaustiveQualityGateError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

/** Stable failure raised after a required exhaustive command closes unsuccessfully. */
export class RequiredExhaustiveCommandError extends RequiredExhaustiveQualityGateError {
  constructor(workload, code, signal) {
    super("REQUIRED_EXHAUSTIVE_COMMAND_FAILED", `"${workload.label}" failed.`, {
      stepId: workload.id,
      code,
      signal,
    });
    this.name = "RequiredExhaustiveCommandError";
    this.exitCode = code;
    this.signal = signal;
  }
}

/** Stable failure raised when one exhaustive workload exceeds its reviewed time bound. */
export class RequiredExhaustiveTimeoutError extends RequiredExhaustiveQualityGateError {
  constructor(workload, timeoutMs) {
    super(
      "REQUIRED_EXHAUSTIVE_STEP_TIMEOUT",
      `"${workload.label}" exceeded its ${timeoutMs}ms timeout.`,
      { stepId: workload.id, timeoutMs },
    );
    this.name = "RequiredExhaustiveTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Stable failure raised when the complete exhaustive gate exceeds its reviewed time bound. */
export class RequiredExhaustiveGateTimeoutError extends RequiredExhaustiveQualityGateError {
  constructor(timeoutMs) {
    super(
      "REQUIRED_EXHAUSTIVE_GATE_TIMEOUT",
      `The required exhaustive quality gate exceeded its ${timeoutMs}ms timeout.`,
      { timeoutMs },
    );
    this.name = "RequiredExhaustiveGateTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Permanent cancellation raised for SIGINT, SIGTERM, or an internal abort. */
export class RequiredExhaustiveCancellationError extends RequiredExhaustiveQualityGateError {
  constructor(signal = "ABORT", options = {}) {
    super(
      "REQUIRED_EXHAUSTIVE_CANCELLED",
      `The required exhaustive quality gate was cancelled by ${signal}.`,
      { signal },
      options,
    );
    this.name = "RequiredExhaustiveCancellationError";
    this.signal = signal;
  }
}

function fail(code, message, details = {}, options = {}) {
  throw new RequiredExhaustiveQualityGateError(code, message, details, options);
}

function exactOwnDataRecord(value, expectedKeys, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID", `${label} must be one inert plain object.`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    fail("REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID", `${label} fields drifted.`, {
      expected: expectedKeys,
      actual: keys.map(String),
    });
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID", `${label}.${key} must be inert own data.`);
    }
  }
  return value;
}

function exactDenseArray(value, label, maximumLength) {
  if (
    !Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Array.prototype ||
    value.length > maximumLength ||
    Reflect.ownKeys(value).length !== value.length + 1
  ) {
    fail("REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID", `${label} must be one bounded dense array.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("REQUIRED_EXHAUSTIVE_AUTHORITY_INVALID", `${label}[${index}] must be inert own data.`);
    }
  }
  return value;
}

function assertExactValues(actual, expected, label) {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail("REQUIRED_EXHAUSTIVE_PLAN_DRIFT", `${label} drifted.`, { expected, actual });
  }
}

function assertSupportedAuthority(authority) {
  if (authority !== REQUIRED_AUTHORITY && authority !== OPTIONAL_AUTHORITY) {
    fail(
      "REQUIRED_EXHAUSTIVE_AUTHORITY_MODE_INVALID",
      "Authority must be code-owned REQUIRED or explicitly selected SHADOW.",
      { authority },
    );
  }
  return authority;
}

function assertExhaustiveScope(scope) {
  if (scope !== EXHAUSTIVE_SCOPE) {
    fail(
      "REQUIRED_EXHAUSTIVE_SCOPE_INVALID",
      "The required scheduler accepts only EXHAUSTIVE scope.",
      { scope },
    );
  }
  return scope;
}

function normalizedPlanProjection(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    profile: plan.profile,
    authority: plan.authority,
    scope: plan.scope,
    inventorySha256: plan.inventorySha256,
    concurrency: plan.concurrency,
    nodes: plan.nodes.map(({ id }) => id),
    prefix: plan.prefix.map(({ id }) => id),
    proofPairs: plan.proofPairs.map(({ id, verifier, rootTest }) => ({
      id,
      steps: [verifier.id, rootTest.id],
    })),
    suffix: plan.suffix.map(({ id }) => id),
  };
}

function calculatePlanSha256(plan) {
  return createHash("sha256")
    .update(JSON.stringify(normalizedPlanProjection(plan)))
    .digest("hex");
}

function dependencyClosure(nodeId, nodeById, collected = new Set()) {
  const workload = nodeById.get(nodeId);
  if (!workload) {
    fail("REQUIRED_EXHAUSTIVE_DEPENDENCY_INVALID", "The workload graph references an unknown id.", {
      nodeId,
    });
  }
  for (const dependencyId of workload.dependencies) {
    if (!collected.has(dependencyId)) {
      collected.add(dependencyId);
      dependencyClosure(dependencyId, nodeById, collected);
    }
  }
  return collected;
}

function deriveExecutionRegions(inventory) {
  const nodeById = new Map(inventory.nodes.map((workload) => [workload.id, workload]));
  const proofNodeIds = new Set(
    inventory.proofUnits.flatMap(({ verifierNodeId, rootTestNodeId }) => [
      verifierNodeId,
      rootTestNodeId,
    ]),
  );
  const prefixIds = new Set();
  for (const { verifierNodeId } of inventory.proofUnits) {
    for (const dependencyId of dependencyClosure(verifierNodeId, nodeById)) {
      if (!proofNodeIds.has(dependencyId)) prefixIds.add(dependencyId);
    }
  }
  const prefix = inventory.nodes.filter(({ id }) => prefixIds.has(id));
  const suffix = inventory.nodes.filter(({ id }) => !proofNodeIds.has(id) && !prefixIds.has(id));
  const proofPairs = inventory.proofUnits.map(({ id, verifierNodeId, rootTestNodeId }) => {
    const verifier = nodeById.get(verifierNodeId);
    const rootTest = nodeById.get(rootTestNodeId);
    if (!verifier || !rootTest) {
      fail("REQUIRED_EXHAUSTIVE_PROOF_PAIR_INVALID", `Proof pair "${id}" is incomplete.`);
    }
    return Object.freeze({ id, verifier, rootTest });
  });

  if (prefix.length === 0 || suffix.length === 0 || proofPairs.length === 0) {
    fail(
      "REQUIRED_EXHAUSTIVE_REGION_INVALID",
      "The dependency graph did not yield prefix, proof-pair, and suffix regions.",
    );
  }
  for (const workload of prefix) {
    if (!["SERIAL_GLOBAL", "SERIAL_BUILD_WRITER"].includes(workload.executionClass)) {
      fail(
        "REQUIRED_EXHAUSTIVE_CLASS_DRIFT",
        `Prefix workload "${workload.id}" has an unsupported execution class.`,
        { executionClass: workload.executionClass },
      );
    }
  }
  for (const { id, verifier, rootTest } of proofPairs) {
    if (
      verifier.executionClass !== "CONCURRENT_PROOF" ||
      rootTest.executionClass !== "CONCURRENT_PROOF" ||
      rootTest.dependencies.length !== 1 ||
      rootTest.dependencies[0] !== verifier.id ||
      verifier.dependencies.some((dependencyId) => !prefixIds.has(dependencyId))
    ) {
      fail(
        "REQUIRED_EXHAUSTIVE_CLASS_DRIFT",
        `Proof pair "${id}" has invalid identity, dependency, or execution-class ownership.`,
      );
    }
  }
  const prefixAndProofIds = new Set([...prefixIds, ...proofNodeIds]);
  for (const workload of suffix) {
    if (
      workload.executionClass !== "SERIAL_GLOBAL" ||
      workload.dependencies.some(
        (dependencyId) =>
          !prefixAndProofIds.has(dependencyId) && !suffix.some(({ id }) => id === dependencyId),
      )
    ) {
      fail(
        "REQUIRED_EXHAUSTIVE_CLASS_DRIFT",
        `Suffix workload "${workload.id}" has invalid dependency or execution-class ownership.`,
      );
    }
  }

  const ownedIds = [
    ...prefix.map(({ id }) => id),
    ...proofPairs.flatMap(({ verifier, rootTest }) => [verifier.id, rootTest.id]),
    ...suffix.map(({ id }) => id),
  ];
  if (
    ownedIds.length !== inventory.nodes.length ||
    new Set(ownedIds).size !== inventory.nodes.length ||
    inventory.nodes.some(({ id }) => !ownedIds.includes(id))
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_REGION_INVALID",
      "The derived execution regions do not own all 146 workloads exactly once.",
    );
  }

  return Object.freeze({
    prefix: Object.freeze(prefix),
    proofPairs: Object.freeze(proofPairs),
    suffix: Object.freeze(suffix),
  });
}

function rememberValidatedNode(workload) {
  VALIDATED_NODES.set(
    workload,
    Object.freeze({
      id: workload.id,
      label: workload.label,
      command: workload.command,
      args: Object.freeze([...workload.args]),
      dependencies: Object.freeze([...workload.dependencies]),
      executionClass: workload.executionClass,
      sharedState: workload.sharedState,
    }),
  );
}

/**
 * Builds the single code-owned exhaustive plan from the authenticated 146-node dependency graph.
 *
 * `REQUIRED` is the default authority. `SHADOW` must be explicitly requested, while scope is
 * permanently fixed to `EXHAUSTIVE`.
 */
export function createRequiredExhaustivePlan({
  authority = REQUIRED_AUTHORITY,
  scope = EXHAUSTIVE_SCOPE,
  inventory = createExhaustiveWorkloadInventory(),
} = {}) {
  assertSupportedAuthority(authority);
  assertExhaustiveScope(scope);
  const validatedInventory = validateExhaustiveWorkloadInventory(inventory);
  const regions = deriveExecutionRegions(validatedInventory);
  const base = {
    schemaVersion: 1,
    profile: PLAN_PROFILE,
    authority,
    scope,
    inventorySha256: validatedInventory.inventorySha256,
    concurrency: PROOF_PAIR_CONCURRENCY,
    nodes: validatedInventory.nodes,
    prefix: regions.prefix,
    proofPairs: regions.proofPairs,
    suffix: regions.suffix,
  };
  const planSha256 = calculatePlanSha256(base);
  if (planSha256 !== EXPECTED_PLAN_SHA256_BY_AUTHORITY[authority]) {
    fail(
      "REQUIRED_EXHAUSTIVE_PLAN_DRIFT",
      "The dependency-derived exhaustive plan digest drifted from review.",
      { expected: EXPECTED_PLAN_SHA256_BY_AUTHORITY[authority], actual: planSha256 },
    );
  }
  const plan = Object.freeze({
    ...base,
    planSha256,
    stepCount: validatedInventory.workloadCount,
    proofPairCount: validatedInventory.proofUnitCount,
  });
  for (const workload of plan.nodes) rememberValidatedNode(workload);
  VALIDATED_PLANS.add(plan);
  return plan;
}

function validatePlanForExecution(candidate, expectedAuthority) {
  if (!VALIDATED_PLANS.has(candidate)) {
    fail(
      "REQUIRED_EXHAUSTIVE_PLAN_UNTRUSTED",
      "Execution refused a plan not returned by the code-owned plan factory.",
    );
  }
  exactOwnDataRecord(candidate, PLAN_KEYS, "The exhaustive execution plan");
  const expected = createRequiredExhaustivePlan({ authority: expectedAuthority });
  for (const field of [
    "schemaVersion",
    "profile",
    "authority",
    "scope",
    "inventorySha256",
    "concurrency",
    "planSha256",
    "stepCount",
    "proofPairCount",
  ]) {
    if (candidate[field] !== expected[field]) {
      fail("REQUIRED_EXHAUSTIVE_PLAN_DRIFT", `Execution plan field "${field}" drifted.`, {
        expected: expected[field],
        actual: candidate[field],
      });
    }
  }
  for (const field of ["nodes", "prefix", "proofPairs", "suffix"]) {
    exactDenseArray(candidate[field], `The exhaustive execution plan ${field}`, 256);
  }
  assertExactValues(candidate.nodes, expected.nodes, "The exhaustive node identities");
  assertExactValues(candidate.prefix, expected.prefix, "The exhaustive prefix identities");
  assertExactValues(candidate.suffix, expected.suffix, "The exhaustive suffix identities");
  if (candidate.proofPairs.length !== expected.proofPairs.length) {
    fail("REQUIRED_EXHAUSTIVE_PLAN_DRIFT", "The exhaustive proof-pair count drifted.");
  }
  for (const [index, expectedPair] of expected.proofPairs.entries()) {
    const actualPair = candidate.proofPairs[index];
    exactOwnDataRecord(actualPair, PROOF_PAIR_KEYS, `Proof pair ${index}`);
    if (
      actualPair.id !== expectedPair.id ||
      actualPair.verifier !== expectedPair.verifier ||
      actualPair.rootTest !== expectedPair.rootTest
    ) {
      fail(
        "REQUIRED_EXHAUSTIVE_IDENTITY_DRIFT",
        `Proof pair ${index} drifted from code-owned identity.`,
      );
    }
  }
  if (candidate.concurrency !== PROOF_PAIR_CONCURRENCY || candidate.stepCount !== 146) {
    fail(
      "REQUIRED_EXHAUSTIVE_PLAN_DRIFT",
      "The exhaustive plan widened concurrency or omitted workloads.",
    );
  }
  return candidate;
}

function cancellationFromSignal(signal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new RequiredExhaustiveCancellationError("ABORT");
}

function cancellationSignalFromReason(reason) {
  return reason instanceof RequiredExhaustiveCancellationError &&
    ["SIGINT", "SIGTERM"].includes(reason.signal)
    ? reason.signal
    : "SIGTERM";
}

function assertTerminationSignal(signal) {
  if (!ALLOWED_TERMINATION_SIGNALS.includes(signal)) {
    fail("REQUIRED_EXHAUSTIVE_SIGNAL_INVALID", "The termination signal is unsupported.", {
      signal,
    });
  }
  return signal;
}

/**
 * Creates a shared registry for all child process groups that are currently awaiting `close`.
 *
 * A repeated host signal can use this registry to escalate every active group, including both
 * concurrently running proof pairs, without allowing scheduling to resume.
 */
export function createRequiredExhaustiveProcessRegistry() {
  const active = new Map();

  const register = (stepId, terminate) => {
    if (typeof stepId !== "string" || stepId.length === 0 || typeof terminate !== "function") {
      fail(
        "REQUIRED_EXHAUSTIVE_PROCESS_REGISTRY_INVALID",
        "An active process registration requires a step id and terminator.",
      );
    }
    const token = Symbol(stepId);
    active.set(token, Object.freeze({ stepId, terminate }));
    let removed = false;
    return () => {
      if (!removed) {
        active.delete(token);
        removed = true;
      }
    };
  };

  const terminateAll = (signal) => {
    assertTerminationSignal(signal);
    const errors = [];
    let attempted = 0;
    for (const { stepId, terminate } of [...active.values()]) {
      attempted += 1;
      try {
        terminate(signal);
      } catch (error) {
        if (error?.code !== "ESRCH") {
          errors.push(
            Object.freeze({
              stepId,
              name: error instanceof Error ? error.name : "NonErrorFailure",
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    }
    return Object.freeze({ attempted, errors: Object.freeze(errors) });
  };

  const registry = Object.freeze({
    register,
    terminateAll,
    activeCount: () => active.size,
  });
  AUTHENTIC_PROCESS_REGISTRIES.add(registry);
  return registry;
}

function validateProcessRegistry(registry) {
  if (
    registry === null ||
    typeof registry !== "object" ||
    typeof registry.register !== "function" ||
    typeof registry.terminateAll !== "function" ||
    typeof registry.activeCount !== "function"
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_PROCESS_REGISTRY_INVALID",
      "The process runner requires a valid active-process registry.",
    );
  }
  return registry;
}

/** Creates one monotonic first-terminal authority shared by scheduling and every child process. */
export function createRequiredExhaustiveTerminalState({
  processRegistry = createRequiredExhaustiveProcessRegistry(),
} = {}) {
  const registry = validateProcessRegistry(processRegistry);
  const controller = new AbortController();
  let winner;
  let initialTerminationInProgress = false;
  let pendingEscalation = false;
  let killEscalationIssued = false;

  const noTermination = () => Object.freeze({ attempted: 0, errors: Object.freeze([]) });

  const issueKillEscalation = () => {
    if (killEscalationIssued) return noTermination();
    if (initialTerminationInProgress) {
      pendingEscalation = true;
      return noTermination();
    }
    killEscalationIssued = true;
    return registry.terminateAll("SIGKILL");
  };

  const claim = ({ kind, reason, stepId, exitCode, terminationSignal }) => {
    if (winner) {
      return Object.freeze({
        first: false,
        winner,
        attempted: 0,
        errors: Object.freeze([]),
      });
    }
    if (
      !TERMINAL_KINDS.includes(kind) ||
      !(reason instanceof Error) ||
      (stepId !== null && (typeof stepId !== "string" || stepId.length === 0)) ||
      !Number.isSafeInteger(exitCode) ||
      exitCode < 1 ||
      !["SIGINT", "SIGTERM"].includes(terminationSignal)
    ) {
      fail(
        "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
        "A terminal claim must contain one reviewed immutable failure record.",
      );
    }
    winner = Object.freeze({ kind, reason, stepId, exitCode, terminationSignal });
    initialTerminationInProgress = true;
    const termination = registry.terminateAll(terminationSignal);
    initialTerminationInProgress = false;
    const escalation = pendingEscalation ? issueKillEscalation() : noTermination();
    pendingEscalation = false;
    controller.abort(reason);
    return Object.freeze({
      first: true,
      winner,
      attempted: termination.attempted,
      errors: Object.freeze([...termination.errors, ...escalation.errors]),
    });
  };

  const claimFailure = (
    reason,
    {
      kind = reason instanceof RequiredExhaustiveTimeoutError
        ? "TIMEOUT"
        : reason instanceof RequiredExhaustiveGateTimeoutError
          ? "TIMEOUT"
          : reason instanceof RequiredExhaustiveCommandError
            ? "COMMAND_CLOSE"
            : "EXECUTION_ERROR",
      stepId = reason?.details?.stepId ?? null,
    } = {},
  ) => {
    const failureReason =
      reason instanceof Error
        ? reason
        : new RequiredExhaustiveQualityGateError(
            "REQUIRED_EXHAUSTIVE_NON_ERROR_FAILURE",
            "The exhaustive gate received a non-Error terminal rejection.",
            { value: String(reason) },
          );
    return claim({
      kind,
      reason: failureReason,
      stepId,
      exitCode: 1,
      terminationSignal: "SIGTERM",
    });
  };

  const cancel = (signal, reason = new RequiredExhaustiveCancellationError(signal)) => {
    if (!["SIGINT", "SIGTERM"].includes(signal)) {
      fail(
        "REQUIRED_EXHAUSTIVE_SIGNAL_INVALID",
        "Permanent cancellation accepts only SIGINT or SIGTERM.",
        { signal },
      );
    }
    if (!winner) {
      if (!(reason instanceof RequiredExhaustiveCancellationError) || reason.signal !== signal) {
        fail(
          "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
          "External cancellation reason and signal must match.",
        );
      }
      const result = claim({
        kind: "EXTERNAL_SIGNAL",
        reason,
        stepId: null,
        exitCode: signal === "SIGINT" ? 130 : 143,
        terminationSignal: signal,
      });
      return Object.freeze({
        first: true,
        signal,
        escalated: 0,
        errors: result.errors,
      });
    }
    const result = issueKillEscalation();
    return Object.freeze({
      first: false,
      signal: winner.kind === "EXTERNAL_SIGNAL" ? winner.reason.signal : undefined,
      escalated: result.attempted,
      errors: result.errors,
    });
  };

  const terminalState = Object.freeze({
    signal: controller.signal,
    processRegistry: registry,
    claimFailure,
    cancel,
    assertOpen: () => {
      if (winner) throw winner.reason;
    },
    winner: () => winner,
    exitCode: () => winner?.exitCode,
  });
  AUTHENTIC_TERMINAL_STATES.add(terminalState);
  return terminalState;
}

function claimTerminalReason(terminalState, reason, stepId = null, kind = "EXECUTION_ERROR") {
  if (
    reason instanceof RequiredExhaustiveCancellationError &&
    ["SIGINT", "SIGTERM"].includes(reason.signal)
  ) {
    const existingWinner = terminalState.winner();
    if (existingWinner) {
      return Object.freeze({
        first: false,
        winner: existingWinner,
        attempted: 0,
        errors: Object.freeze([]),
      });
    }
    return terminalState.cancel(reason.signal, reason);
  }
  return terminalState.claimFailure(reason, { kind, stepId });
}

/**
 * Installs host-signal handlers over the same first-terminal authority used by the process graph.
 * Later signals can escalate active groups but can never replace the first failure or exit code.
 */
export function createRequiredExhaustiveCancellationState({
  processRegistry = createRequiredExhaustiveProcessRegistry(),
  terminalState = createRequiredExhaustiveTerminalState({ processRegistry }),
} = {}) {
  const registry = validateProcessRegistry(processRegistry);
  if (
    terminalState?.processRegistry !== registry ||
    typeof terminalState.cancel !== "function" ||
    typeof terminalState.exitCode !== "function"
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
      "Signal cancellation must share the active process registry and terminal authority.",
    );
  }
  let installedProcess;
  let handlers;

  const cancel = (signal) => terminalState.cancel(signal);

  const uninstall = () => {
    if (!installedProcess || !handlers) return;
    for (const [signal, handler] of handlers) installedProcess.off(signal, handler);
    installedProcess = undefined;
    handlers = undefined;
  };

  const install = (processObject = process) => {
    if (
      installedProcess ||
      !processObject ||
      typeof processObject.on !== "function" ||
      typeof processObject.off !== "function"
    ) {
      fail(
        "REQUIRED_EXHAUSTIVE_SIGNAL_HANDLER_INVALID",
        "Signal handlers may be installed exactly once on an event-capable process.",
      );
    }
    installedProcess = processObject;
    handlers = new Map(["SIGINT", "SIGTERM"].map((signal) => [signal, () => cancel(signal)]));
    for (const [signal, handler] of handlers) processObject.on(signal, handler);
    return uninstall;
  };

  return Object.freeze({
    signal: terminalState.signal,
    processRegistry: registry,
    terminalState,
    cancel,
    install,
    uninstall,
    receivedSignal: () =>
      terminalState.winner()?.kind === "EXTERNAL_SIGNAL"
        ? terminalState.winner().reason.signal
        : undefined,
    exitCode: () => terminalState.exitCode(),
  });
}

function forwardDetachedProcessSignal(
  signal,
  child,
  { platform = process.platform, killProcessGroup = process.kill } = {},
) {
  assertTerminationSignal(signal);
  if (!child) return false;
  if (platform !== "win32" && Number.isSafeInteger(child.pid) && child.pid > 0) {
    try {
      killProcessGroup(-child.pid, signal);
      return true;
    } catch (error) {
      if (error?.code === "ESRCH") return false;
      throw error;
    }
  }
  if (typeof child.kill !== "function") return false;
  try {
    return child.kill(signal);
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function printCommand(workload) {
  process.stdout.write(`\n[${workload.id}] $ ${workload.command} ${workload.args.join(" ")}\n`);
}

function copyBoundedEnvironment(rawEnvironment, label) {
  if (
    rawEnvironment === null ||
    typeof rawEnvironment !== "object" ||
    Array.isArray(rawEnvironment) ||
    utilTypes.isProxy(rawEnvironment)
  ) {
    fail("REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID", `${label} is not an environment record.`);
  }
  const keys = Reflect.ownKeys(rawEnvironment);
  if (
    keys.length > MAXIMUM_ENVIRONMENT_KEYS ||
    keys.some((key) => typeof key !== "string" || key.length === 0 || key.includes("\0"))
  ) {
    fail("REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID", `${label} exceeds its key budget.`);
  }
  const environment = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(rawEnvironment, key);
    if (!descriptor || !("value" in descriptor)) {
      fail("REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID", `${label}.${key} is accessor-backed.`);
    }
    if (descriptor.value === undefined) continue;
    if (
      typeof descriptor.value !== "string" ||
      Buffer.byteLength(descriptor.value) > MAXIMUM_ENVIRONMENT_VALUE_BYTES ||
      descriptor.value.includes("\0")
    ) {
      fail("REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID", `${label}.${key} is not one bounded string.`);
    }
    environment[key] = descriptor.value;
  }
  return environment;
}

async function prepareEnvironmentContext({
  prepareStepEnvironment,
  workspaceRoot,
  workload,
  baseEnvironment,
}) {
  const copiedBase = copyBoundedEnvironment(baseEnvironment, "The base process environment");
  if (!prepareStepEnvironment) {
    return Object.freeze({ env: copiedBase, dispose: async () => undefined });
  }
  const context = await prepareStepEnvironment(
    Object.freeze({ workspaceRoot, workload, baseEnvironment: Object.freeze(copiedBase) }),
  );
  if (context === undefined) {
    return Object.freeze({ env: copiedBase, dispose: async () => undefined });
  }
  if (
    context === null ||
    typeof context !== "object" ||
    Array.isArray(context) ||
    utilTypes.isProxy(context)
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_ISOLATION_INVALID",
      `Isolation hook for "${workload.id}" returned an invalid context.`,
    );
  }
  const allowedKeys = ["metadata", "command", "args", "env", "tempRoot", "dispose"];
  const keys = Reflect.ownKeys(context);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key)) ||
    !keys.includes("env") ||
    !keys.includes("dispose")
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_ISOLATION_INVALID",
      `Isolation hook for "${workload.id}" returned unsupported fields.`,
      { actual: keys.map(String), allowed: allowedKeys },
    );
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(context, key);
    if (!descriptor || !("value" in descriptor)) {
      fail(
        "REQUIRED_EXHAUSTIVE_ISOLATION_INVALID",
        `Isolation context field "${key}" is accessor-backed.`,
      );
    }
  }
  if (
    (context.command !== undefined && context.command !== workload.command) ||
    (context.args !== undefined &&
      (!Array.isArray(context.args) ||
        context.args.length !== workload.args.length ||
        context.args.some((value, index) => value !== workload.args[index])))
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_IDENTITY_DRIFT",
      `Isolation hook attempted to replace the command identity for "${workload.id}".`,
    );
  }
  if (typeof context.dispose !== "function") {
    fail(
      "REQUIRED_EXHAUSTIVE_ISOLATION_INVALID",
      `Isolation hook for "${workload.id}" omitted its cleanup function.`,
    );
  }
  return Object.freeze({
    env: copyBoundedEnvironment(context.env, `Isolation environment for "${workload.id}"`),
    dispose: context.dispose,
  });
}

function assertValidatedWorkload(workload) {
  const expected = VALIDATED_NODES.get(workload);
  if (!expected) {
    fail(
      "REQUIRED_EXHAUSTIVE_WORKLOAD_UNTRUSTED",
      "The process runner refused a workload outside a code-owned exhaustive plan.",
      { stepId: workload?.id },
    );
  }
  exactOwnDataRecord(workload, NODE_KEYS, `Validated workload "${expected.id}"`);
  if (
    workload.id !== expected.id ||
    workload.label !== expected.label ||
    workload.command !== expected.command ||
    workload.executionClass !== expected.executionClass ||
    workload.sharedState !== expected.sharedState
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_IDENTITY_DRIFT",
      `Validated workload "${expected.id}" changed identity or execution class.`,
    );
  }
  assertExactValues(workload.args, expected.args, `Workload "${expected.id}" arguments`);
  assertExactValues(
    workload.dependencies,
    expected.dependencies,
    `Workload "${expected.id}" dependencies`,
  );
  return expected;
}

function successfulCloseObservation(workload) {
  return Object.freeze({
    schemaVersion: 1,
    profile: CLOSE_PROFILE,
    stepId: workload.id,
    status: "PASS",
    observedClose: true,
    code: 0,
    signal: null,
  });
}

function createTerminationFailure(reason, terminationErrors) {
  let error;
  if (reason instanceof RequiredExhaustiveTimeoutError) {
    error = reason;
  } else {
    const cancellation =
      reason instanceof Error ? reason : new RequiredExhaustiveCancellationError("ABORT");
    error = new RequiredExhaustiveCancellationError(cancellationSignalFromReason(cancellation), {
      cause: cancellation,
    });
  }
  if (terminationErrors.length > 0 && Object.isExtensible(error)) {
    Object.defineProperty(error, "terminationErrors", {
      value: Object.freeze([...terminationErrors]),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return error;
}

function attachTerminationEvidence(error, terminationErrors) {
  if (terminationErrors.length > 0 && error instanceof Error && Object.isExtensible(error)) {
    Object.defineProperty(error, "terminationErrors", {
      value: Object.freeze([...terminationErrors]),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return error;
}

async function prepareDefaultStepEnvironment({ workspaceRoot, workload, baseEnvironment }) {
  if (workload.executionClass !== "CONCURRENT_PROOF") return undefined;
  return await createProofStepIsolationContext({
    workspaceRoot,
    workload,
    baseEnvironment,
  });
}

/**
 * Creates a shell-free process runner that resolves only after an authenticated workload emits
 * `close` with code zero and no signal.
 *
 * The optional `prepareStepEnvironment` hook can supply runner-owned environment isolation and an
 * awaited cleanup function without changing the reviewed command or argument vector.
 */
export function createRequiredExhaustiveProcessRunner({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  spawnFunction = spawn,
  forwardSignalFunction,
  platform = process.platform,
  killProcessGroup = process.kill,
  processRegistry = createRequiredExhaustiveProcessRegistry(),
  terminalState,
  prepareStepEnvironment = prepareDefaultStepEnvironment,
  baseEnvironment = process.env,
  stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  terminationGraceMs = DEFAULT_TERMINATION_GRACE_MS,
  printCommandFunction = printCommand,
} = {}) {
  if (
    typeof workspaceRoot !== "string" ||
    workspaceRoot.length === 0 ||
    typeof spawnFunction !== "function" ||
    (forwardSignalFunction !== undefined && typeof forwardSignalFunction !== "function") ||
    (prepareStepEnvironment !== undefined && typeof prepareStepEnvironment !== "function") ||
    (printCommandFunction !== null && typeof printCommandFunction !== "function")
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_PROCESS_OPTIONS_INVALID",
      "The exhaustive process-runner options are invalid.",
    );
  }
  if (
    !Number.isSafeInteger(stepTimeoutMs) ||
    stepTimeoutMs < 1 ||
    stepTimeoutMs > MAXIMUM_STEP_TIMEOUT_MS
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_TIMEOUT_INVALID",
      "The per-step timeout is outside its reviewed bound.",
      { maximum: MAXIMUM_STEP_TIMEOUT_MS, actual: stepTimeoutMs },
    );
  }
  if (
    !Number.isSafeInteger(terminationGraceMs) ||
    terminationGraceMs < 0 ||
    terminationGraceMs > MAXIMUM_TERMINATION_GRACE_MS
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_TERMINATION_GRACE_INVALID",
      "The process termination grace period is outside its reviewed bound.",
      { maximum: MAXIMUM_TERMINATION_GRACE_MS, actual: terminationGraceMs },
    );
  }
  const registry = validateProcessRegistry(processRegistry);
  const terminal =
    terminalState ?? createRequiredExhaustiveTerminalState({ processRegistry: registry });
  if (
    terminal?.processRegistry !== registry ||
    typeof terminal.claimFailure !== "function" ||
    typeof terminal.winner !== "function" ||
    !(terminal.signal instanceof AbortSignal)
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
      "The process runner must share one valid terminal authority with its process registry.",
    );
  }
  const signalChild =
    forwardSignalFunction ??
    ((signal, child) =>
      forwardDetachedProcessSignal(signal, child, { platform, killProcessGroup }));
  const authenticConfiguration =
    path.resolve(workspaceRoot) === DEFAULT_WORKSPACE_ROOT &&
    spawnFunction === spawn &&
    forwardSignalFunction === undefined &&
    platform === process.platform &&
    killProcessGroup === process.kill &&
    AUTHENTIC_PROCESS_REGISTRIES.has(registry) &&
    AUTHENTIC_TERMINAL_STATES.has(terminal) &&
    prepareStepEnvironment === prepareDefaultStepEnvironment &&
    baseEnvironment === process.env &&
    stepTimeoutMs === DEFAULT_STEP_TIMEOUT_MS &&
    terminationGraceMs === DEFAULT_TERMINATION_GRACE_MS &&
    printCommandFunction === printCommand;

  const runProcess = async (workload, { signal } = {}) => {
    const validatedWorkload = assertValidatedWorkload(workload);
    if (signal !== undefined && !(signal instanceof AbortSignal)) {
      fail("REQUIRED_EXHAUSTIVE_SIGNAL_INVALID", "The process runner signal is invalid.");
    }
    const handleExternalAbort = () => {
      claimTerminalReason(terminal, cancellationFromSignal(signal), validatedWorkload.id);
    };
    if (signal && signal !== terminal.signal) {
      signal.addEventListener("abort", handleExternalAbort, { once: true });
      if (signal.aborted) handleExternalAbort();
    }
    const unlinkExternalSignal = () => {
      if (signal && signal !== terminal.signal) {
        signal.removeEventListener("abort", handleExternalAbort);
      }
    };
    terminal.assertOpen();

    let isolation;
    try {
      isolation = await prepareEnvironmentContext({
        prepareStepEnvironment,
        workspaceRoot,
        workload,
        baseEnvironment,
      });
    } catch (error) {
      terminal.claimFailure(error, { kind: "EXECUTION_ERROR", stepId: validatedWorkload.id });
      unlinkExternalSignal();
      throw error;
    }
    if (terminal.signal.aborted) {
      await isolation.dispose();
      unlinkExternalSignal();
      throw terminal.winner().reason;
    }
    printCommandFunction?.(validatedWorkload);

    let child;
    try {
      child = spawnFunction(validatedWorkload.command, validatedWorkload.args, {
        cwd: workspaceRoot,
        env: isolation.env,
        detached: platform !== "win32",
        shell: false,
        stdio: "inherit",
      });
    } catch (error) {
      terminal.claimFailure(error, { kind: "PROCESS_ERROR", stepId: validatedWorkload.id });
      try {
        await isolation.dispose();
      } catch (cleanupError) {
        if (error instanceof Error && Object.isExtensible(error)) {
          Object.defineProperty(error, "isolationCleanupError", {
            value: cleanupError,
            enumerable: false,
          });
        }
      }
      unlinkExternalSignal();
      throw error;
    }
    if (!child || typeof child.on !== "function") {
      const childError = new RequiredExhaustiveQualityGateError(
        "REQUIRED_EXHAUSTIVE_CHILD_INVALID",
        `The process runner did not receive a child for "${validatedWorkload.id}".`,
        { stepId: validatedWorkload.id },
      );
      terminal.claimFailure(childError, {
        kind: "PROCESS_ERROR",
        stepId: validatedWorkload.id,
      });
      await isolation.dispose();
      unlinkExternalSignal();
      throw childError;
    }

    return await new Promise((resolvePromise, rejectPromise) => {
      let closeSeen = false;
      let terminationReason;
      let localFailure;
      let timeoutTimer;
      let escalationTimer;
      let gracefulSent = false;
      let killSent = false;
      let unregister = () => undefined;
      const terminationErrors = [];

      const recordTerminationError = (error) => {
        if (error?.code === "ESRCH") return;
        terminationErrors.push(
          Object.freeze({
            name: error instanceof Error ? error.name : "NonErrorFailure",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      };
      const tryForward = (nextSignal) => {
        try {
          signalChild(nextSignal, child);
        } catch (error) {
          recordTerminationError(error);
        }
      };
      const forceTerminate = () => {
        if (killSent || closeSeen) return;
        killSent = true;
        if (escalationTimer) {
          clearTimeout(escalationTimer);
          escalationTimer = undefined;
        }
        tryForward("SIGKILL");
      };
      const requestTermination = (reason, nextSignal) => {
        terminationReason ??= reason;
        if (nextSignal === "SIGKILL") {
          forceTerminate();
          return;
        }
        if (killSent) return;
        if (!gracefulSent) {
          gracefulSent = true;
          tryForward(nextSignal);
        }
        if (!closeSeen && !killSent && !escalationTimer) {
          escalationTimer = setTimeout(forceTerminate, terminationGraceMs);
          escalationTimer.unref?.();
        }
      };
      const cleanupListeners = () => {
        unlinkExternalSignal();
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (escalationTimer) clearTimeout(escalationTimer);
        unregister();
      };
      const attachCleanupEvidence = (error, cleanupError) => {
        if (error instanceof Error && Object.isExtensible(error)) {
          Object.defineProperty(error, "isolationCleanupError", {
            value: cleanupError,
            enumerable: false,
            configurable: false,
            writable: false,
          });
        }
        return error;
      };

      unregister = registry.register(validatedWorkload.id, (nextSignal) => {
        if (nextSignal === "SIGKILL") {
          forceTerminate();
          return;
        }
        requestTermination(terminal.winner()?.reason, nextSignal);
      });
      if (terminal.signal.aborted) {
        requestTermination(terminal.winner().reason, terminal.winner().terminationSignal);
      }
      timeoutTimer = setTimeout(() => {
        const timeoutError = new RequiredExhaustiveTimeoutError(validatedWorkload, stepTimeoutMs);
        localFailure ??= timeoutError;
        terminal.claimFailure(timeoutError, { kind: "TIMEOUT", stepId: validatedWorkload.id });
      }, stepTimeoutMs);
      timeoutTimer.unref?.();

      child.on("error", (error) => {
        localFailure ??= error;
        terminal.claimFailure(error, {
          kind: "PROCESS_ERROR",
          stepId: validatedWorkload.id,
        });
      });
      child.on("close", (code, childSignal) => {
        if (closeSeen) return;
        closeSeen = true;
        cleanupListeners();
        if (!localFailure && (code !== 0 || childSignal !== null)) {
          localFailure = new RequiredExhaustiveCommandError(validatedWorkload, code, childSignal);
          terminal.claimFailure(localFailure, {
            kind: "COMMAND_CLOSE",
            stepId: validatedWorkload.id,
          });
        }
        void (async () => {
          let cleanupError;
          try {
            await isolation.dispose();
          } catch (error) {
            cleanupError = error;
          }

          let outcomeError;
          if (cleanupError) {
            const cleanupFailure = new RequiredExhaustiveQualityGateError(
              "REQUIRED_EXHAUSTIVE_ISOLATION_CLEANUP_FAILED",
              `Isolation cleanup failed for "${validatedWorkload.id}".`,
              { stepId: validatedWorkload.id },
              { cause: cleanupError },
            );
            terminal.claimFailure(cleanupFailure, {
              kind: "EXECUTION_ERROR",
              stepId: validatedWorkload.id,
            });
            localFailure = localFailure
              ? attachCleanupEvidence(localFailure, cleanupError)
              : cleanupFailure;
          }
          if (localFailure) outcomeError = localFailure;
          else if (terminal.winner()) {
            outcomeError = new RequiredExhaustiveCancellationError(
              cancellationSignalFromReason(terminal.winner().reason),
              { cause: terminal.winner().reason },
            );
          } else if (terminationReason) {
            outcomeError = createTerminationFailure(terminationReason, terminationErrors);
          }
          if (outcomeError && terminationErrors.length > 0) {
            outcomeError = attachTerminationEvidence(outcomeError, terminationErrors);
          }
          if (outcomeError) {
            rejectPromise(outcomeError);
          } else {
            const observation = successfulCloseObservation(validatedWorkload);
            if (authenticConfiguration) AUTHENTIC_CLOSE_OBSERVATIONS.add(observation);
            resolvePromise(observation);
          }
        })();
      });
    });
  };
  if (authenticConfiguration) AUTHENTIC_PROCESS_RUNNERS.add(runProcess);
  PROCESS_RUNNER_TERMINALS.set(runProcess, terminal);
  return runProcess;
}

function assertSuccessfulCloseObservation(candidate, workload, authority) {
  exactOwnDataRecord(candidate, CLOSE_KEYS, `Close observation for "${workload.id}"`);
  if (
    candidate.schemaVersion !== 1 ||
    candidate.profile !== CLOSE_PROFILE ||
    candidate.stepId !== workload.id ||
    candidate.status !== "PASS" ||
    candidate.observedClose !== true ||
    candidate.code !== 0 ||
    candidate.signal !== null ||
    (authority === REQUIRED_AUTHORITY && !AUTHENTIC_CLOSE_OBSERVATIONS.has(candidate))
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_CLOSE_UNOBSERVED",
      `Workload "${workload.id}" did not provide an authentic successful close observation.`,
    );
  }
  return candidate;
}

/** Creates the exact successful-close result shape for an injected contract-test step runner. */
export function createSuccessfulExhaustiveStepObservation(workload) {
  assertValidatedWorkload(workload);
  return successfulCloseObservation(workload);
}

function errorProjection(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : "NonErrorFailure",
    message: error instanceof Error ? error.message : String(error),
  });
}

function createStepReceipt(workload, status, durationMs, observation, error) {
  return Object.freeze({
    id: workload.id,
    label: workload.label,
    status,
    durationMs,
    observedClose: observation?.observedClose === true,
    code: observation?.code ?? null,
    signal: observation?.signal ?? null,
    error: error ? errorProjection(error) : null,
  });
}

function assertCanContinue(signal, externalAssertion) {
  if (signal?.aborted) throw cancellationFromSignal(signal);
  externalAssertion?.();
  if (signal?.aborted) throw cancellationFromSignal(signal);
}

async function runObservedWorkload(
  workload,
  runStep,
  terminalState,
  authority,
  externalAssertion,
  receiptById,
) {
  const signal = terminalState.signal;
  assertCanContinue(signal, externalAssertion);
  const startedAt = performance.now();
  let observation;
  try {
    observation = assertSuccessfulCloseObservation(
      await runStep(workload, Object.freeze({ signal })),
      workload,
      authority,
    );
    assertCanContinue(signal, externalAssertion);
    receiptById.set(
      workload.id,
      createStepReceipt(workload, "PASS", performance.now() - startedAt, observation),
    );
  } catch (error) {
    const existingWinner = terminalState.winner();
    const propagatedCancellation =
      error instanceof RequiredExhaustiveCancellationError &&
      existingWinner !== undefined &&
      (error === existingWinner.reason || error.cause === existingWinner.reason);
    if (!propagatedCancellation) claimTerminalReason(terminalState, error, workload.id);
    const winner = terminalState.winner();
    const status =
      winner?.reason === error &&
      winner.stepId === workload.id &&
      !(error instanceof RequiredExhaustiveCancellationError)
        ? "FAIL"
        : "CANCELLED";
    receiptById.set(
      workload.id,
      createStepReceipt(workload, status, performance.now() - startedAt, observation, error),
    );
    throw error;
  }
}

function assertDependenciesCompleted(workload, completedIds) {
  const missing = workload.dependencies.filter((dependencyId) => !completedIds.has(dependencyId));
  if (missing.length > 0) {
    fail(
      "REQUIRED_EXHAUSTIVE_DEPENDENCY_UNSATISFIED",
      `Workload "${workload.id}" started before its dependencies closed successfully.`,
      { stepId: workload.id, missing },
    );
  }
}

async function runSequentialRegion(
  workloads,
  runStep,
  terminalState,
  authority,
  externalAssertion,
  receiptById,
  completedIds,
) {
  for (const workload of workloads) {
    assertDependenciesCompleted(workload, completedIds);
    await runObservedWorkload(
      workload,
      runStep,
      terminalState,
      authority,
      externalAssertion,
      receiptById,
    );
    completedIds.add(workload.id);
    assertCanContinue(terminalState.signal, externalAssertion);
  }
}

async function runProofPairRegion(
  plan,
  runStep,
  terminalState,
  authority,
  externalAssertion,
  receiptById,
  completedIds,
) {
  const activePairIds = new Set();
  let startedPairCount = 0;
  const segments = [];
  let ordinarySegment = [];
  let barrierCount = 0;
  const flushOrdinarySegment = () => {
    if (ordinarySegment.length === 0) return;
    segments.push(Object.freeze({ barrier: false, pairs: Object.freeze(ordinarySegment) }));
    ordinarySegment = [];
  };
  for (const pair of plan.proofPairs) {
    const classification = classifyProofPairState(pair.id);
    if (classification.barrier) {
      barrierCount += 1;
      flushOrdinarySegment();
      segments.push(Object.freeze({ barrier: true, pairs: Object.freeze([pair]) }));
    } else {
      ordinarySegment.push(pair);
    }
  }
  flushOrdinarySegment();
  if (barrierCount !== 11 || plan.proofPairs.length - barrierCount !== 58) {
    fail(
      "REQUIRED_EXHAUSTIVE_CLASS_DRIFT",
      "The shared-state authority must classify exactly 58 ordinary pairs and 11 barrier pairs.",
      { barrierCount, proofPairCount: plan.proofPairs.length },
    );
  }

  const runPair = async (pair) => {
    let entered = false;
    try {
      if (activePairIds.size >= PROOF_PAIR_CONCURRENCY) {
        fail(
          "REQUIRED_EXHAUSTIVE_CONCURRENCY_WIDENED",
          "More than two proof pairs became active.",
          { activePairIds: [...activePairIds] },
        );
      }
      for (const activePairId of activePairIds) {
        assertProofPairsCanRunConcurrently(activePairId, pair.id);
      }
      activePairIds.add(pair.id);
      entered = true;
      startedPairCount += 1;
      assertDependenciesCompleted(pair.verifier, completedIds);
      await runObservedWorkload(
        pair.verifier,
        runStep,
        terminalState,
        authority,
        externalAssertion,
        receiptById,
      );
      completedIds.add(pair.verifier.id);
      assertCanContinue(terminalState.signal, externalAssertion);
      assertDependenciesCompleted(pair.rootTest, completedIds);
      await runObservedWorkload(
        pair.rootTest,
        runStep,
        terminalState,
        authority,
        externalAssertion,
        receiptById,
      );
      completedIds.add(pair.rootTest.id);
      assertCanContinue(terminalState.signal, externalAssertion);
    } catch (error) {
      claimTerminalReason(terminalState, error, pair.verifier.id);
    } finally {
      if (entered) activePairIds.delete(pair.id);
    }
  };

  for (const segment of segments) {
    assertCanContinue(terminalState.signal, externalAssertion);
    if (segment.barrier) {
      if (activePairIds.size !== 0 || segment.pairs.length !== 1) {
        fail(
          "REQUIRED_EXHAUSTIVE_BARRIER_VIOLATION",
          "The exclusive proof pair did not receive a drained scheduler.",
        );
      }
      await runPair(segment.pairs[0]);
    } else {
      let nextPairIndex = 0;
      const worker = async () => {
        while (!terminalState.signal.aborted) {
          const pairIndex = nextPairIndex;
          nextPairIndex += 1;
          if (pairIndex >= segment.pairs.length) return;
          await runPair(segment.pairs[pairIndex]);
        }
      };
      await Promise.allSettled(
        Array.from(
          {
            length: Math.min(PROOF_PAIR_CONCURRENCY, segment.pairs.length),
          },
          worker,
        ),
      );
    }
    if (terminalState.winner()) throw terminalState.winner().reason;
  }
  if (startedPairCount !== plan.proofPairs.length) {
    fail(
      "REQUIRED_EXHAUSTIVE_PROOF_OMISSION",
      "The proof scheduler stopped before claiming every proof pair.",
      { startedPairCount, proofPairCount: plan.proofPairs.length },
    );
  }
}

function orderedStepReceipts(plan, receiptById) {
  return Object.freeze(
    plan.nodes.map(
      (workload) => receiptById.get(workload.id) ?? createStepReceipt(workload, "NOT_RUN", 0),
    ),
  );
}

function proofPairReceipts(plan, receiptById) {
  return Object.freeze(
    plan.proofPairs.map(({ id, verifier, rootTest }) => {
      const steps = Object.freeze([
        receiptById.get(verifier.id) ?? createStepReceipt(verifier, "NOT_RUN", 0),
        receiptById.get(rootTest.id) ?? createStepReceipt(rootTest, "NOT_RUN", 0),
      ]);
      const status = steps.some(({ status }) => status === "FAIL")
        ? "FAIL"
        : steps.some(({ status }) => status === "CANCELLED")
          ? "CANCELLED"
          : steps.every(({ status }) => status === "PASS")
            ? "PASS"
            : "NOT_RUN";
      return Object.freeze({ id, status, steps });
    }),
  );
}

function createExecutionReceipt(plan, receiptById, forcedFailure = false) {
  const steps = orderedStepReceipts(plan, receiptById);
  const observedClosedCount = steps.filter(
    ({ status, observedClose, code, signal }) =>
      status === "PASS" && observedClose && code === 0 && signal === null,
  ).length;
  const status =
    !forcedFailure &&
    steps.length === 146 &&
    observedClosedCount === 146 &&
    steps.every(({ status: stepStatus }) => stepStatus === "PASS")
      ? "PASS"
      : "FAIL";
  return Object.freeze({
    schemaVersion: 1,
    profile: PROFILE,
    status,
    authority: plan.authority,
    scope: plan.scope,
    planSha256: plan.planSha256,
    inventorySha256: plan.inventorySha256,
    concurrency: plan.concurrency,
    stepCount: plan.stepCount,
    proofPairCount: plan.proofPairCount,
    observedClosedCount,
    steps,
    proofPairs: proofPairReceipts(plan, receiptById),
  });
}

function attachExecutionReceipt(error, receipt) {
  if (error instanceof Error && Object.isExtensible(error)) {
    Object.defineProperty(error, "requiredExhaustiveReceipt", {
      value: receipt,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return error;
  }
  return new RequiredExhaustiveQualityGateError(
    "REQUIRED_EXHAUSTIVE_EXECUTION_FAILED",
    "The exhaustive workload failed with a non-extensible rejection.",
    { primary: errorProjection(error), receipt },
    { cause: error },
  );
}

/**
 * Executes one authenticated plan: dependency-derived prefix, at most two proof pairs, then suffix.
 *
 * Every supplied runner result must contain an exact successful `close` observation. The returned
 * receipt remains in the stable 146-node inventory order even though proof pairs may overlap.
 */
export async function runRequiredExhaustivePlan(
  plan,
  {
    authority = REQUIRED_AUTHORITY,
    runStep,
    signal,
    terminalState,
    assertCanContinue: externalAssertion,
    workspaceRoot = DEFAULT_WORKSPACE_ROOT,
    snapshotBuildOutputsFunction = snapshotBuildOutputs,
    assertBuildOutputsUnchangedFunction = assertBuildOutputsUnchanged,
    snapshotUntrackedStateFunction = snapshotNonIgnoredUntrackedState,
    assertUntrackedStateUnchangedFunction = assertNonIgnoredUntrackedStateUnchanged,
  } = {},
) {
  assertSupportedAuthority(authority);
  const validatedPlan = validatePlanForExecution(plan, authority);
  if (typeof runStep !== "function") {
    fail("REQUIRED_EXHAUSTIVE_RUNNER_MISSING", "The exhaustive plan requires one step runner.");
  }
  for (const [name, candidate] of Object.entries({
    snapshotBuildOutputsFunction,
    assertBuildOutputsUnchangedFunction,
    snapshotUntrackedStateFunction,
    assertUntrackedStateUnchangedFunction,
  })) {
    if (typeof candidate !== "function") {
      fail(
        "REQUIRED_EXHAUSTIVE_GUARD_INVALID",
        `Mandatory execution guard "${name}" is not a function.`,
      );
    }
  }
  const terminal = terminalState ?? createRequiredExhaustiveTerminalState();
  if (
    !AUTHENTIC_TERMINAL_STATES.has(terminal) ||
    !(terminal.signal instanceof AbortSignal) ||
    typeof terminal.claimFailure !== "function"
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
      "The exhaustive scheduler requires one code-owned terminal authority.",
    );
  }
  if (
    authority === REQUIRED_AUTHORITY &&
    (!AUTHENTIC_PROCESS_RUNNERS.has(runStep) ||
      PROCESS_RUNNER_TERMINALS.get(runStep) !== terminal ||
      path.resolve(workspaceRoot) !== DEFAULT_WORKSPACE_ROOT ||
      signal !== undefined ||
      externalAssertion !== undefined ||
      snapshotBuildOutputsFunction !== snapshotBuildOutputs ||
      assertBuildOutputsUnchangedFunction !== assertBuildOutputsUnchanged ||
      snapshotUntrackedStateFunction !== snapshotNonIgnoredUntrackedState ||
      assertUntrackedStateUnchangedFunction !== assertNonIgnoredUntrackedStateUnchanged)
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_AUTHORITY_INJECTED",
      "REQUIRED execution rejects injected runners, guards, signals, and workspace authority.",
    );
  }
  const handleExternalAbort = () => {
    claimTerminalReason(terminal, cancellationFromSignal(signal));
  };
  if (signal && signal !== terminal.signal) {
    if (!(signal instanceof AbortSignal)) {
      fail("REQUIRED_EXHAUSTIVE_SIGNAL_INVALID", "The scheduler signal is invalid.");
    }
    signal.addEventListener("abort", handleExternalAbort, { once: true });
    if (signal.aborted) handleExternalAbort();
  }
  const unlinkExternalSignal = () => {
    if (signal && signal !== terminal.signal) {
      signal.removeEventListener("abort", handleExternalAbort);
    }
  };
  const receiptById = new Map();
  const completedIds = new Set();
  let untrackedBefore;
  let buildBefore;
  let primaryError;
  let buildGuardError;
  let untrackedGuardError;

  try {
    assertCanContinue(terminal.signal, externalAssertion);
    untrackedBefore = await snapshotUntrackedStateFunction(workspaceRoot);
    if (authority === REQUIRED_AUTHORITY && untrackedBefore.entryCount !== 0) {
      fail(
        "REQUIRED_EXHAUSTIVE_INPUT_DIRTY",
        "REQUIRED execution refuses non-ignored untracked opening state.",
        { entryCount: untrackedBefore.entryCount },
      );
    }
    assertCanContinue(terminal.signal, externalAssertion);
    await runSequentialRegion(
      validatedPlan.prefix,
      runStep,
      terminal,
      authority,
      externalAssertion,
      receiptById,
      completedIds,
    );
    assertCanContinue(terminal.signal, externalAssertion);
    buildBefore = await snapshotBuildOutputsFunction(workspaceRoot);
    assertCanContinue(terminal.signal, externalAssertion);
  } catch (error) {
    claimTerminalReason(terminal, error);
    primaryError = terminal.winner().reason;
  }

  if (!primaryError && buildBefore) {
    try {
      await runProofPairRegion(
        validatedPlan,
        runStep,
        terminal,
        authority,
        externalAssertion,
        receiptById,
        completedIds,
      );
      assertCanContinue(terminal.signal, externalAssertion);
    } catch (error) {
      claimTerminalReason(terminal, error);
      primaryError = terminal.winner().reason;
    }
  }

  if (buildBefore) {
    try {
      const buildAfter = await snapshotBuildOutputsFunction(workspaceRoot);
      assertBuildOutputsUnchangedFunction(buildBefore, buildAfter);
    } catch (error) {
      buildGuardError = error;
      claimTerminalReason(terminal, error);
    }
  }

  if (!primaryError && !buildGuardError) {
    try {
      await runSequentialRegion(
        validatedPlan.suffix,
        runStep,
        terminal,
        authority,
        externalAssertion,
        receiptById,
        completedIds,
      );
      assertCanContinue(terminal.signal, externalAssertion);
    } catch (error) {
      claimTerminalReason(terminal, error);
      primaryError = terminal.winner().reason;
    }
  }

  if (untrackedBefore) {
    try {
      const untrackedAfter = await snapshotUntrackedStateFunction(workspaceRoot);
      assertUntrackedStateUnchangedFunction(untrackedBefore, untrackedAfter);
    } catch (error) {
      untrackedGuardError = error;
      claimTerminalReason(terminal, error);
    }
  }

  unlinkExternalSignal();
  const failure =
    terminal.winner()?.reason ?? primaryError ?? buildGuardError ?? untrackedGuardError;
  if (failure) {
    if (Object.isExtensible(failure)) {
      if (buildGuardError && buildGuardError !== failure) {
        Object.defineProperty(failure, "buildOutputGuardError", {
          value: buildGuardError,
          enumerable: false,
        });
      }
      if (untrackedGuardError && untrackedGuardError !== failure) {
        Object.defineProperty(failure, "untrackedStateGuardError", {
          value: untrackedGuardError,
          enumerable: false,
        });
      }
    }
    throw attachExecutionReceipt(failure, createExecutionReceipt(validatedPlan, receiptById, true));
  }
  const receipt = createExecutionReceipt(validatedPlan, receiptById);
  if (receipt.status !== "PASS" || completedIds.size !== 146) {
    throw attachExecutionReceipt(
      new RequiredExhaustiveQualityGateError(
        "REQUIRED_EXHAUSTIVE_RECEIPT_INCOMPLETE",
        "The exhaustive gate did not observe all 146 workloads close successfully.",
        { completed: completedIds.size, observedClosed: receipt.observedClosedCount },
      ),
      receipt,
    );
  }
  return receipt;
}

function authenticateRepository(discovered, plan) {
  const repository = validateRepositoryWorkloadInputs(discovered);
  return Object.freeze({
    schemaVersion: 1,
    profile: REPOSITORY_PROFILE,
    status: "PASS",
    authority: plan.authority,
    scope: plan.scope,
    inventorySha256: plan.inventorySha256,
    planSha256: plan.planSha256,
    repository,
  });
}

/**
 * Runs the required exhaustive plan inside revision, repository-inventory, and tracked-workspace
 * authentication. Closing workspace capture and cancellation checks remain authoritative after
 * both success and primary workload failure.
 */
export async function executeRequiredExhaustiveQualityGate({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  authority = REQUIRED_AUTHORITY,
  scope = EXHAUSTIVE_SCOPE,
  plan = createRequiredExhaustivePlan({ authority, scope }),
  runStep,
  signal,
  assertCanContinue: externalAssertion,
  expectedRevision,
  readRevisionFunction,
  readInventoryFunction,
  captureWorkspaceFunction,
  assertCleanInputFunction = assertExhaustiveGateCleanInput,
  snapshotBuildOutputsFunction = snapshotBuildOutputs,
  assertBuildOutputsUnchangedFunction = assertBuildOutputsUnchanged,
  snapshotUntrackedStateFunction = snapshotNonIgnoredUntrackedState,
  assertUntrackedStateUnchangedFunction = assertNonIgnoredUntrackedStateUnchanged,
  processRegistry = createRequiredExhaustiveProcessRegistry(),
  terminalState,
  prepareStepEnvironment,
  stepTimeoutMs = DEFAULT_STEP_TIMEOUT_MS,
  gateTimeoutMs = DEFAULT_GATE_TIMEOUT_MS,
  terminationGraceMs = DEFAULT_TERMINATION_GRACE_MS,
  spawnFunction = spawn,
  forwardSignalFunction,
  platform = process.platform,
  killProcessGroup = process.kill,
  printCommandFunction = printCommand,
} = {}) {
  assertSupportedAuthority(authority);
  assertExhaustiveScope(scope);
  if (
    !Number.isSafeInteger(gateTimeoutMs) ||
    gateTimeoutMs < 1 ||
    gateTimeoutMs > MAXIMUM_GATE_TIMEOUT_MS
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_GATE_TIMEOUT_INVALID",
      "The complete-gate timeout is outside its reviewed bound.",
      { maximum: MAXIMUM_GATE_TIMEOUT_MS, actual: gateTimeoutMs },
    );
  }
  if (typeof assertCleanInputFunction !== "function") {
    fail(
      "REQUIRED_EXHAUSTIVE_CLEAN_INPUT_INVALID",
      "The exhaustive gate requires one clean-input authority.",
    );
  }
  const validatedPlan = validatePlanForExecution(plan, authority);
  if (validatedPlan.scope !== scope) {
    fail(
      "REQUIRED_EXHAUSTIVE_SCOPE_INVALID",
      "The plan scope does not match the fixed exhaustive execution scope.",
    );
  }
  const registry = validateProcessRegistry(processRegistry);
  const terminal =
    terminalState ?? createRequiredExhaustiveTerminalState({ processRegistry: registry });
  if (!AUTHENTIC_TERMINAL_STATES.has(terminal) || terminal.processRegistry !== registry) {
    fail(
      "REQUIRED_EXHAUSTIVE_TERMINAL_INVALID",
      "The full exhaustive gate requires one code-owned terminal authority.",
    );
  }
  if (
    authority === REQUIRED_AUTHORITY &&
    (path.resolve(workspaceRoot) !== DEFAULT_WORKSPACE_ROOT ||
      runStep !== undefined ||
      signal !== undefined ||
      externalAssertion !== undefined ||
      readRevisionFunction !== undefined ||
      readInventoryFunction !== undefined ||
      captureWorkspaceFunction !== undefined ||
      assertCleanInputFunction !== assertExhaustiveGateCleanInput ||
      snapshotBuildOutputsFunction !== snapshotBuildOutputs ||
      assertBuildOutputsUnchangedFunction !== assertBuildOutputsUnchanged ||
      snapshotUntrackedStateFunction !== snapshotNonIgnoredUntrackedState ||
      assertUntrackedStateUnchangedFunction !== assertNonIgnoredUntrackedStateUnchanged ||
      !AUTHENTIC_PROCESS_REGISTRIES.has(registry) ||
      prepareStepEnvironment !== undefined ||
      stepTimeoutMs !== DEFAULT_STEP_TIMEOUT_MS ||
      gateTimeoutMs !== DEFAULT_GATE_TIMEOUT_MS ||
      terminationGraceMs !== DEFAULT_TERMINATION_GRACE_MS ||
      spawnFunction !== spawn ||
      forwardSignalFunction !== undefined ||
      platform !== process.platform ||
      killProcessGroup !== process.kill ||
      printCommandFunction !== printCommand)
  ) {
    fail(
      "REQUIRED_EXHAUSTIVE_AUTHORITY_INJECTED",
      "REQUIRED gate authority rejects injected repository, runner, guard, and process seams.",
    );
  }
  const handleExternalAbort = () => {
    claimTerminalReason(terminal, cancellationFromSignal(signal));
  };
  if (signal && signal !== terminal.signal) {
    if (!(signal instanceof AbortSignal)) {
      fail("REQUIRED_EXHAUSTIVE_SIGNAL_INVALID", "The full-gate signal is invalid.");
    }
    signal.addEventListener("abort", handleExternalAbort, { once: true });
    if (signal.aborted) handleExternalAbort();
  }
  const unlinkExternalSignal = () => {
    if (signal && signal !== terminal.signal) {
      signal.removeEventListener("abort", handleExternalAbort);
    }
  };
  const assertion = () => assertCanContinue(terminal.signal, externalAssertion);
  const stepRunner =
    runStep ??
    createRequiredExhaustiveProcessRunner({
      workspaceRoot,
      spawnFunction,
      forwardSignalFunction,
      platform,
      killProcessGroup,
      processRegistry: registry,
      terminalState: terminal,
      prepareStepEnvironment,
      stepTimeoutMs,
      terminationGraceMs,
      printCommandFunction,
    });

  const gateTimeout = setTimeout(() => {
    terminal.claimFailure(new RequiredExhaustiveGateTimeoutError(gateTimeoutMs), {
      kind: "TIMEOUT",
      stepId: null,
    });
  }, gateTimeoutMs);
  gateTimeout.unref?.();

  try {
    return await executeExhaustiveGateBoundary({
      workspaceRoot,
      expectedRevision,
      readRevisionFunction,
      readInventoryFunction,
      captureWorkspaceFunction,
      assertCanContinue: assertion,
      authenticateInventory: async (discovered) =>
        authenticateRepository(discovered, validatedPlan),
      execute: async ({ workspaceRoot: authenticatedRoot, revision }) => {
        try {
          const cleanInput = await assertCleanInputFunction(authenticatedRoot, revision);
          const execution = await runRequiredExhaustivePlan(validatedPlan, {
            authority,
            runStep: stepRunner,
            terminalState: terminal,
            assertCanContinue: externalAssertion,
            workspaceRoot,
            snapshotBuildOutputsFunction,
            assertBuildOutputsUnchangedFunction,
            snapshotUntrackedStateFunction,
            assertUntrackedStateUnchangedFunction,
          });
          return Object.freeze({ ...execution, cleanInput });
        } catch (error) {
          claimTerminalReason(terminal, error);
          throw terminal.winner().reason;
        }
      },
    });
  } finally {
    clearTimeout(gateTimeout);
    unlinkExternalSignal();
  }
}

function printableReceipt(boundaryReceipt, error) {
  const execution =
    boundaryReceipt?.execution ??
    error?.requiredExhaustiveReceipt ??
    error?.cause?.requiredExhaustiveReceipt;
  const repository = boundaryReceipt?.inventory?.repository;
  const workspaceBefore = boundaryReceipt?.workspaceBefore;
  const workspaceAfter = boundaryReceipt?.workspaceAfter;
  return {
    status: boundaryReceipt?.status ?? execution?.status ?? "FAIL",
    revision: boundaryReceipt?.revision,
    authority: execution?.authority,
    scope: execution?.scope,
    planSha256: execution?.planSha256,
    inventorySha256: execution?.inventorySha256,
    concurrency: execution?.concurrency,
    observedClosedCount: execution?.observedClosedCount ?? 0,
    stepCount: execution?.stepCount ?? 146,
    proofPairCount: execution?.proofPairCount ?? 69,
    repository: repository
      ? {
          proofCount: repository.proofCount,
          legacyPrerequisiteCount: repository.legacyPrerequisiteCount,
          legacyLeafInvocationCount: repository.legacyLeafInvocationCount,
          distinctLeafWorkloadCount: repository.distinctLeafWorkloadCount,
          workspaceTestScriptCount: repository.workspaceTestScriptCount,
        }
      : undefined,
    workspace: workspaceBefore
      ? {
          beforeDigest: workspaceBefore.digest,
          afterDigest: workspaceAfter?.digest,
          trackedFileCount: workspaceBefore.trackedFileCount,
          trackedBytes: workspaceBefore.trackedBytes,
          unchanged: workspaceBefore.digest === workspaceAfter?.digest,
        }
      : undefined,
    cleanInput: execution?.cleanInput,
    durationMs: boundaryReceipt?.durationMs,
    steps: execution?.steps.map(({ id, status, observedClose, code, signal, durationMs }) => ({
      id,
      status,
      observedClose,
      code,
      signal,
      durationMs,
    })),
    error: error
      ? { ...errorProjection(error), code: typeof error.code === "string" ? error.code : undefined }
      : boundaryReceipt?.error,
  };
}

/**
 * Resolves CLI authority without accepting aliases: unset/empty is REQUIRED and exact SHADOW is
 * the sole explicit pre-cutover observation mode.
 */
export function resolveRequiredExhaustiveAuthority(environment = process.env) {
  if (environment === null || typeof environment !== "object") {
    fail(
      "REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID",
      "CLI authority requires an environment record.",
    );
  }
  const descriptor = Object.getOwnPropertyDescriptor(environment, "DESEN_CI_AUTHORITY");
  if (!descriptor) return REQUIRED_AUTHORITY;
  if (!("value" in descriptor)) {
    fail(
      "REQUIRED_EXHAUSTIVE_ENVIRONMENT_INVALID",
      "DESEN_CI_AUTHORITY must be inert environment data.",
    );
  }
  const value = descriptor.value;
  if (value === undefined || value === "") return REQUIRED_AUTHORITY;
  if (value === OPTIONAL_AUTHORITY) return OPTIONAL_AUTHORITY;
  fail(
    "REQUIRED_EXHAUSTIVE_AUTHORITY_MODE_INVALID",
    "DESEN_CI_AUTHORITY accepts only exact SHADOW; omit it for REQUIRED.",
    { value: typeof value === "string" ? value : String(value) },
  );
}

async function main() {
  const processRegistry = createRequiredExhaustiveProcessRegistry();
  const cancellation = createRequiredExhaustiveCancellationState({ processRegistry });
  const uninstall = cancellation.install();
  let receipt;
  let failure;
  try {
    const authority = resolveRequiredExhaustiveAuthority(process.env);
    const plan = createRequiredExhaustivePlan({ authority });
    receipt = await executeRequiredExhaustiveQualityGate({
      authority,
      plan,
      processRegistry,
      terminalState: cancellation.terminalState,
      expectedRevision: process.env.GITHUB_SHA || undefined,
    });
  } catch (error) {
    failure = error;
    receipt = error?.exhaustiveGateReceipt;
  } finally {
    uninstall();
  }

  process.stdout.write(`\n${JSON.stringify(printableReceipt(receipt, failure), null, 2)}\n`);
  if (failure) {
    process.stderr.write(`${failure.stack ?? String(failure)}\n`);
    process.exitCode = cancellation.exitCode() ?? 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await main();

export {
  DEFAULT_GATE_TIMEOUT_MS,
  DEFAULT_STEP_TIMEOUT_MS,
  DEFAULT_TERMINATION_GRACE_MS,
  EXHAUSTIVE_SCOPE,
  OPTIONAL_AUTHORITY,
  PROOF_PAIR_CONCURRENCY,
  REQUIRED_AUTHORITY,
  calculatePlanSha256,
};
