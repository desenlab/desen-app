import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";

import { captureAffectedChangeBoundary } from "./affected-change-boundary.mjs";
import {
  validateAffectedSelectorPromotionBoundary,
  validateAffectedSelectorPromotedBoundary,
  validateAffectedSelectorPromotedSelection,
  verifyAffectedSelectorPromotionEvidence,
} from "./affected-selector-promotion-evidence.mjs";
import {
  createShadowAffectedSelection,
  validateShadowAffectedSelection,
} from "./affected-workload-selector.mjs";
import {
  assertExhaustiveGateCleanInput,
  assertExhaustiveGateWorkspaceUnchanged,
  captureExhaustiveGateWorkspace,
} from "./exhaustive-gate-boundary.mjs";
import {
  REQUIRED_AUTHORITY,
  createRequiredExhaustiveCancellationState,
  createRequiredExhaustiveProcessRegistry,
  createRequiredExhaustiveProcessRunner,
  createRequiredExhaustiveTerminalState,
  createRequiredExhaustivePlan,
  executeRequiredExhaustiveQualityGate,
} from "./run-required-exhaustive-quality-gate.mjs";
import {
  assertBuildOutputsUnchanged,
  assertNonIgnoredUntrackedStateUnchanged,
  snapshotBuildOutputs,
  snapshotNonIgnoredUntrackedState,
} from "./shared-state-authority.mjs";

const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
export const REQUIRED_AFFECTED_RECEIPT_PROFILE = "desen.ci.required-affected-execution.v1";
const REQUIRED_EXHAUSTIVE_RECEIPT_PROFILE = "desen.ci.required-exhaustive-quality-gate.v1";
const EXHAUSTIVE_BOUNDARY_RECEIPT_PROFILE = "desen.ci.exhaustive-gate-boundary.v1";
const PREFIX_IDS = Object.freeze([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "workspace-graph",
  "package-tests",
  "editor-core-public-package-contract",
]);
const SUFFIX_IDS = Object.freeze(["dependency-boundaries", "boundary-fixtures"]);
export const REQUIRED_AFFECTED_SUFFIX_DEPENDENCY_POLICY = "SELECTED_ROOT_BARRIER";
const REQUIRED_EXECUTION_TOKEN = Object.freeze({ profile: "desen.ci.required-affected-token.v1" });
const REQUIRED_SELECTION_PROFILE = "desen.ci.required-affected-selector.v1";
const AUTHENTIC_REQUIRED_SELECTIONS = new WeakMap();
const AUTHENTIC_EXECUTION_AUTHORITIES = new WeakSet();
const AUTHENTIC_AFFECTED_RUNNERS = new WeakMap();
const AUTHENTIC_AFFECTED_HOOKS = new WeakMap();
const AUTHENTIC_AFFECTED_CLOSE_OBSERVATIONS = new WeakSet();
const REQUIRED_QUALITY_GATE_TEST_SEAMS = new WeakMap();
const AUTHENTIC_REQUIRED_GATE_RESULTS = new WeakSet();
const REQUIRED_GATE_RESULT_EXIT_CODES = new WeakMap();
const AFFECTED_EXECUTION_OPTION_KEYS = Object.freeze([
  "workspaceRoot",
  "baseRevision",
  "headRevision",
  "executionRevision",
  "sameRepository",
]);
const REQUIRED_GATE_OPTION_KEYS = Object.freeze([
  "eventName",
  "baseRevision",
  "headRevision",
  "executionRevision",
  "sameRepository",
  "testSeams",
]);
const FORBIDDEN_AUTHORITY_OPTION_KEYS = Object.freeze([
  "processRegistry",
  "terminalState",
  "runStep",
]);
const VALID_TERMINAL_EXIT_CODES = Object.freeze([130, 143]);
/** Fixed soft deadline kept below the workflow's independent 19-minute hard timeout. */
export const REQUIRED_AFFECTED_GATE_TIMEOUT_MS = 17 * 60 * 1_000;

function selectionProjection(selection) {
  return {
    schemaVersion: selection.schemaVersion,
    profile: selection.profile,
    authority: selection.authority,
    requestedScope: selection.requestedScope,
    effectiveScope: selection.effectiveScope,
    decisionCategory: selection.decisionCategory,
    reason: selection.reason,
    baseRevision: selection.baseRevision,
    headRevision: selection.headRevision,
    executionRevision: selection.executionRevision,
    mergeBaseRevision: selection.mergeBaseRevision,
    inventorySha256: selection.inventorySha256,
    ownershipSha256: selection.ownershipSha256,
    impactGraphSha256: selection.impactGraphSha256,
    thresholdSha256: selection.thresholdSha256,
    selectorSha256: selection.selectorSha256,
    changeSetSha256: selection.changeSetSha256,
    changedPaths: selection.changedPaths,
    ownerProofUnitIds: selection.ownerProofUnitIds,
    affectedProofUnitIds: selection.affectedProofUnitIds,
    nodeIds: selection.nodeIds,
  };
}

function selectionSha256(selection) {
  return createHash("sha256")
    .update(JSON.stringify(selectionProjection(selection)))
    .digest("hex");
}

/** Creates a distinct REQUIRED identity only after the measured selector authenticates its plan. */
export function createRequiredAffectedSelection(rawBoundary) {
  const measured = validateShadowAffectedSelection(createShadowAffectedSelection(rawBoundary));
  const base = {
    ...measured,
    profile: REQUIRED_SELECTION_PROFILE,
    authority: "REQUIRED",
  };
  const required = Object.freeze({ ...base, planSha256: selectionSha256(base) });
  AUTHENTIC_REQUIRED_SELECTIONS.set(required, measured);
  return required;
}

/** Rejects fabricated or relabelled plans; only this module can issue REQUIRED selector identity. */
export function validateRequiredAffectedSelection(candidate) {
  const measured = AUTHENTIC_REQUIRED_SELECTIONS.get(candidate);
  if (measured === undefined) {
    fail("REQUIRED_AFFECTED_SELECTION_UNTRUSTED", "Required selection is not code-owned.");
  }
  validateShadowAffectedSelection(measured);
  if (
    candidate.profile !== REQUIRED_SELECTION_PROFILE ||
    candidate.authority !== "REQUIRED" ||
    candidate.planSha256 !== selectionSha256(candidate)
  ) {
    fail("REQUIRED_AFFECTED_SELECTION_DRIFT", "Required selection identity drifted.");
  }
  for (const key of Reflect.ownKeys(measured)) {
    if (["profile", "authority", "planSha256"].includes(key)) continue;
    if (candidate[key] !== measured[key]) {
      fail("REQUIRED_AFFECTED_SELECTION_DRIFT", `Measured selection field "${key}" drifted.`);
    }
  }
  return candidate;
}

/** Stable failure raised inside the promoted REQUIRED affected execution surface. */
export class RequiredAffectedQualityGateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RequiredAffectedQualityGateError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new RequiredAffectedQualityGateError(code, message, details);
}

function normalizePublicOptions(rawOptions, allowedKeys, label) {
  const options = rawOptions ?? {};
  if (
    typeof options !== "object" ||
    Array.isArray(options) ||
    utilTypes.isProxy(options) ||
    Object.getPrototypeOf(options) !== Object.prototype
  ) {
    fail("REQUIRED_AFFECTED_OPTIONS_INVALID", `${label} must be one inert own-data record.`);
  }
  for (const key of Reflect.ownKeys(options)) {
    const descriptor =
      typeof key === "string" ? Object.getOwnPropertyDescriptor(options, key) : undefined;
    if (typeof key === "string" && FORBIDDEN_AUTHORITY_OPTION_KEYS.includes(key)) {
      fail(
        "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
        `${label} rejects injected process, terminal, and runner authority.`,
      );
    }
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      !descriptor ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("REQUIRED_AFFECTED_OPTIONS_INVALID", `${label} contains an unknown field.`, {
        key: typeof key === "string" ? key : String(key),
      });
    }
  }
  return options;
}

function createExecutionAuthority({ cancellation = false } = {}) {
  const processRegistry = createRequiredExhaustiveProcessRegistry();
  const cancellationState = cancellation
    ? createRequiredExhaustiveCancellationState({ processRegistry })
    : null;
  const terminalState =
    cancellationState?.terminalState ?? createRequiredExhaustiveTerminalState({ processRegistry });
  const authority = Object.freeze({
    processRegistry,
    terminalState,
    cancellationState,
  });
  AUTHENTIC_EXECUTION_AUTHORITIES.add(authority);
  return authority;
}

function validateExecutionAuthority(authority) {
  if (
    !AUTHENTIC_EXECUTION_AUTHORITIES.has(authority) ||
    authority.terminalState?.processRegistry !== authority.processRegistry
  ) {
    fail(
      "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
      "REQUIRED affected execution requires one code-owned process and terminal authority.",
    );
  }
  return authority;
}

function markAffectedRunner(runStep, authority) {
  const authenticAuthority = validateExecutionAuthority(authority);
  const markedRunner = async (...args) => {
    const observation = await runStep(...args);
    if (observation !== null && typeof observation === "object") {
      AUTHENTIC_AFFECTED_CLOSE_OBSERVATIONS.add(observation);
    }
    return observation;
  };
  AUTHENTIC_AFFECTED_RUNNERS.set(markedRunner, authenticAuthority);
  return markedRunner;
}

function markAffectedHook(hook, authority) {
  AUTHENTIC_AFFECTED_HOOKS.set(hook, validateExecutionAuthority(authority));
  return hook;
}

function affectedReceiptAuthority({
  requiredExecutionToken,
  requiredExecutionAuthority,
  runStep,
  terminalState,
  afterPrefix,
  afterProofs,
}) {
  if (requiredExecutionToken !== REQUIRED_EXECUTION_TOKEN) return "TEST";
  const authority = validateExecutionAuthority(requiredExecutionAuthority);
  if (
    authority.terminalState !== terminalState ||
    AUTHENTIC_AFFECTED_RUNNERS.get(runStep) !== authority ||
    AUTHENTIC_AFFECTED_HOOKS.get(afterPrefix) !== authority ||
    AUTHENTIC_AFFECTED_HOOKS.get(afterProofs) !== authority
  ) {
    fail(
      "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
      "REQUIRED affected execution rejects injected runners, terminals, and closing hooks.",
    );
  }
  return "REQUIRED";
}

function errorProjection(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : "NonErrorFailure",
    code: typeof error?.code === "string" ? error.code : null,
    message: error instanceof Error ? error.message : String(error),
  });
}

function successfulObservation(observation, workload, authority) {
  if (
    observation === null ||
    typeof observation !== "object" ||
    observation.schemaVersion !== 1 ||
    observation.profile !== "desen.ci.exhaustive-step-close.v1" ||
    observation.stepId !== workload.id ||
    observation.status !== "PASS" ||
    observation.observedClose !== true ||
    observation.code !== 0 ||
    observation.signal !== null ||
    (authority === "REQUIRED" && !AUTHENTIC_AFFECTED_CLOSE_OBSERVATIONS.has(observation))
  ) {
    fail(
      "REQUIRED_AFFECTED_CLOSE_UNOBSERVED",
      `Required affected workload "${workload.id}" did not close successfully.`,
    );
  }
  return observation;
}

function stepReceipt(workload, status, startedAt, observation, error = null) {
  return Object.freeze({
    id: workload.id,
    status,
    observedClose: observation?.observedClose === true,
    code: observation?.code ?? null,
    signal: observation?.signal ?? null,
    durationMs: performance.now() - startedAt,
    error: error ? errorProjection(error) : null,
  });
}

function executionReceipt(selection, status, steps, startedAt, error = null, authority = "TEST") {
  return Object.freeze({
    schemaVersion: 1,
    profile: REQUIRED_AFFECTED_RECEIPT_PROFILE,
    authority,
    requestedScope: "AFFECTED",
    effectiveScope: selection.effectiveScope,
    decisionCategory: selection.decisionCategory,
    reason: selection.reason,
    status,
    executionRevision: selection.executionRevision,
    selectorSha256: selection.selectorSha256,
    ownershipSha256: selection.ownershipSha256,
    impactGraphSha256: selection.impactGraphSha256,
    thresholdSha256: selection.thresholdSha256,
    inventorySha256: selection.inventorySha256,
    planSha256: selection.planSha256,
    changeSetSha256: selection.changeSetSha256,
    strictSubset: selection.strictSubset,
    freshExecution: selection.effectiveScope === "AFFECTED",
    cachedSuccessRead: false,
    selectedWorkloadCount: selection.workloadCount,
    selectedProofUnitCount: selection.proofUnitCount,
    observedClosedCount: steps.filter(({ observedClose }) => observedClose).length,
    durationMs: performance.now() - startedAt,
    steps: Object.freeze([...steps]),
    error: error ? errorProjection(error) : null,
    closingGuards: Object.freeze({ untracked: null, workspace: null }),
  });
}

function selectedRegions(selection, nodeById) {
  const nodes = selection.nodeIds.map((id) => nodeById.get(id));
  if (nodes.some((workload) => workload === undefined)) {
    fail(
      "REQUIRED_AFFECTED_PLAN_INVALID",
      "The selector referenced an unknown exhaustive workload.",
    );
  }
  const conditionalPrefixIds = selection.affectedProofUnitIds.includes("editor-core-persistence")
    ? ["editor-web-public-package-contract"]
    : [];
  const expectedPrefixIds = [...PREFIX_IDS, ...conditionalPrefixIds];
  const prefix = nodes.slice(0, expectedPrefixIds.length);
  const suffix = nodes.slice(-SUFFIX_IDS.length);
  const proofNodes = nodes.slice(expectedPrefixIds.length, -SUFFIX_IDS.length);
  if (
    prefix.some(({ id }, index) => id !== expectedPrefixIds[index]) ||
    suffix.some(({ id }, index) => id !== SUFFIX_IDS[index]) ||
    proofNodes.length !== selection.proofUnitCount * 2
  ) {
    fail("REQUIRED_AFFECTED_PLAN_INVALID", "Required execution regions drifted.");
  }
  const expectedProofNodeIds = new Set(
    selection.affectedProofUnitIds.flatMap((proofId) => [`verify-${proofId}`, `test-${proofId}`]),
  );
  if (
    expectedProofNodeIds.size !== proofNodes.length ||
    proofNodes.some(({ id }) => !expectedProofNodeIds.has(id))
  ) {
    fail("REQUIRED_AFFECTED_PLAN_INVALID", "Required proof workload membership drifted.");
  }

  for (const proofId of selection.affectedProofUnitIds) {
    const verifier = nodeById.get(`verify-${proofId}`);
    const rootTest = nodeById.get(`test-${proofId}`);
    const expectedVerifierDependency =
      proofId === "editor-core-source-document" ||
      proofId === "editor-core-stable-id-insert" ||
      proofId === "editor-core-structural-edits" ||
      proofId === "editor-core-content-edits" ||
      proofId === "editor-core-state-binding-edits" ||
      proofId === "editor-core-event-action-edits" ||
      proofId === "editor-core-authoring-round-trip" ||
      proofId === "editor-core-continuous-validation" ||
      proofId === "editor-core-terminal-integration"
        ? "editor-core-public-package-contract"
        : proofId === "editor-core-persistence"
          ? "editor-web-public-package-contract"
          : "package-tests";
    if (
      verifier === undefined ||
      rootTest === undefined ||
      verifier.dependencies.length !== 1 ||
      verifier.dependencies[0] !== expectedVerifierDependency ||
      rootTest.dependencies.length !== 1 ||
      rootTest.dependencies[0] !== verifier.id
    ) {
      fail("REQUIRED_AFFECTED_PLAN_INVALID", `Required proof pair "${proofId}" drifted.`);
    }
  }

  const completedPrefixIds = new Set();
  for (const workload of prefix) {
    if (workload.dependencies.some((dependency) => !completedPrefixIds.has(dependency))) {
      fail(
        "REQUIRED_AFFECTED_PLAN_INVALID",
        `Required prefix "${workload.id}" is not dependency closed.`,
      );
    }
    completedPrefixIds.add(workload.id);
  }

  const exhaustiveRootIds = [...nodeById.values()]
    .filter(({ id }) => id.startsWith("test-"))
    .map(({ id }) => id);
  const selectedRootIds = selection.affectedProofUnitIds.map((proofId) => `test-${proofId}`);
  const dependencyBoundary = suffix[0];
  const boundaryFixtures = suffix[1];
  if (
    exhaustiveRootIds.length !== 94 ||
    dependencyBoundary.dependencies.length !== exhaustiveRootIds.length ||
    dependencyBoundary.dependencies.some(
      (dependency, index) => dependency !== exhaustiveRootIds[index],
    ) ||
    selectedRootIds.some((id) => !dependencyBoundary.dependencies.includes(id)) ||
    boundaryFixtures.dependencies.length !== 1 ||
    boundaryFixtures.dependencies[0] !== dependencyBoundary.id
  ) {
    fail("REQUIRED_AFFECTED_PLAN_INVALID", "Required suffix dependency policy drifted.");
  }

  // The exhaustive graph declares dependency-boundaries behind every root. In the distinct
  // affected graph this reviewed policy projects that all-root ordering barrier to the exact
  // selected roots. No absent root is treated as completed.
  return Object.freeze({
    prefix,
    proofWorkloads: proofNodes,
    suffix,
    suffixDependencyPolicy: REQUIRED_AFFECTED_SUFFIX_DEPENDENCY_POLICY,
    selectedRootIds: Object.freeze(selectedRootIds),
  });
}

function validateTerminalState(terminalState) {
  if (
    !(terminalState?.signal instanceof AbortSignal) ||
    typeof terminalState.claimFailure !== "function" ||
    typeof terminalState.assertOpen !== "function" ||
    typeof terminalState.winner !== "function"
  ) {
    fail("REQUIRED_AFFECTED_RUNNER_INVALID", "Required affected terminal authority is invalid.");
  }
  return terminalState;
}

/** Arms the fixed gate-wide deadline that remains live through every closing guard. */
export function createRequiredAffectedGateDeadline(rawTerminalState) {
  const terminalState = validateTerminalState(rawTerminalState);
  let cleared = false;
  const timer = setTimeout(() => {
    terminalState.claimFailure(
      new RequiredAffectedQualityGateError(
        "REQUIRED_AFFECTED_GATE_TIMEOUT",
        `The required affected quality gate exceeded its ${REQUIRED_AFFECTED_GATE_TIMEOUT_MS}ms timeout.`,
        { timeoutMs: REQUIRED_AFFECTED_GATE_TIMEOUT_MS },
      ),
      { kind: "TIMEOUT", stepId: null },
    );
  }, REQUIRED_AFFECTED_GATE_TIMEOUT_MS);
  timer.unref?.();
  return Object.freeze({
    clear: () => {
      if (cleared) return;
      clearTimeout(timer);
      cleared = true;
    },
  });
}

function terminalWinnerReason(terminalState) {
  const winner = terminalState.winner();
  if (winner === undefined) return undefined;
  if (!(winner?.reason instanceof Error)) {
    fail(
      "REQUIRED_AFFECTED_TERMINAL_INVALID",
      "Required affected terminal authority exposed an invalid winning reason.",
    );
  }
  return winner.reason;
}

function assertTerminalOpen(terminalState) {
  terminalState.assertOpen();
  const winnerReason = terminalWinnerReason(terminalState);
  if (winnerReason) throw winnerReason;
  if (terminalState.signal.aborted) {
    const reason = terminalState.signal.reason;
    if (reason instanceof Error) throw reason;
    fail(
      "REQUIRED_AFFECTED_TERMINAL_ABORTED",
      "Required affected execution was aborted without one valid terminal reason.",
    );
  }
}

function claimTerminalFailure(terminalState, error, stepId = null) {
  terminalState.claimFailure(error, { kind: "EXECUTION_ERROR", stepId });
  return terminalWinnerReason(terminalState) ?? error;
}

async function observeClosingGuard(terminalState, runGuard) {
  let terminalBefore = null;
  let guardFailure = null;
  let terminalAfter = null;
  try {
    assertTerminalOpen(terminalState);
  } catch (error) {
    terminalBefore = error;
  }
  try {
    await runGuard();
  } catch (error) {
    guardFailure = error;
    claimTerminalFailure(terminalState, error);
  }
  try {
    assertTerminalOpen(terminalState);
  } catch (error) {
    terminalAfter = error;
  }
  return Object.freeze({ terminalBefore, guardFailure, terminalAfter });
}

/**
 * Runs both outer closing guards even after cancellation and returns the first terminal failure.
 *
 * The callbacks are closing-guard seams used by the production wrapper and focused race tests;
 * neither callback can turn a prior failure or cancellation into a passing receipt.
 */
export async function runRequiredAffectedClosingGuards(
  rawTerminalState,
  { runUntrackedGuard = async () => undefined, runWorkspaceGuard } = {},
) {
  const terminalState = validateTerminalState(rawTerminalState);
  if (typeof runUntrackedGuard !== "function" || typeof runWorkspaceGuard !== "function") {
    fail("REQUIRED_AFFECTED_GUARD_INVALID", "Required affected closing guards are invalid.");
  }
  const untracked = await observeClosingGuard(terminalState, runUntrackedGuard);
  const workspace = await observeClosingGuard(terminalState, runWorkspaceGuard);
  let finalFailure;
  try {
    assertTerminalOpen(terminalState);
  } catch (error) {
    finalFailure = error;
  }
  return Object.freeze({
    failure:
      terminalWinnerReason(terminalState) ??
      untracked.terminalBefore ??
      untracked.guardFailure ??
      untracked.terminalAfter ??
      workspace.terminalBefore ??
      workspace.guardFailure ??
      workspace.terminalAfter ??
      finalFailure ??
      null,
    untrackedGuardFailure: untracked.guardFailure,
    workspaceGuardFailure: workspace.guardFailure,
  });
}

function closingGuardProjection(closingGuards) {
  return Object.freeze({
    untracked: closingGuards.untrackedGuardFailure
      ? errorProjection(closingGuards.untrackedGuardFailure)
      : null,
    workspace: closingGuards.workspaceGuardFailure
      ? errorProjection(closingGuards.workspaceGuardFailure)
      : null,
  });
}

/**
 * Combines an inner REQUIRED receipt with outer guard evidence without replacing the first error.
 */
export function finalizeRequiredAffectedFailureReceipt(
  receipt,
  selection,
  primaryFailure,
  closingGuards,
  startedAt = performance.now(),
  requiredExecutionToken,
) {
  const failure = primaryFailure ?? closingGuards.failure;
  if (!failure && receipt?.status !== "FAIL") {
    fail("REQUIRED_AFFECTED_FAILURE_MISSING", "A failing required receipt requires one failure.");
  }
  const authority = requiredExecutionToken === REQUIRED_EXECUTION_TOKEN ? "REQUIRED" : "TEST";
  const baseReceipt =
    receipt ?? executionReceipt(selection, "FAIL", [], startedAt, failure, authority);
  return Object.freeze({
    ...baseReceipt,
    status: "FAIL",
    error: baseReceipt.error ?? errorProjection(failure),
    closingGuards: closingGuardProjection(closingGuards),
  });
}

/**
 * Executes a code-owned strict subset sequentially from fresh commands.
 *
 * The selection must carry a process-local REQUIRED authenticity mark. Injected runners are
 * exposed only for focused contract tests; the exported production entry point constructs the
 * real process runner and accepts no runner override.
 */
export async function runRequiredAffectedQualityGate(
  rawSelection,
  {
    runStep,
    terminalState = createRequiredExhaustiveTerminalState(),
    afterPrefix = async () => undefined,
    afterProofs = async () => undefined,
    requiredExecutionToken,
    requiredExecutionAuthority,
  } = {},
) {
  const startedAt = performance.now();
  const selection = validateRequiredAffectedSelection(rawSelection);
  if (selection.effectiveScope !== "AFFECTED") {
    return executionReceipt(selection, "NOT_ELIGIBLE", [], startedAt, null, "TEST");
  }
  if (typeof runStep !== "function") {
    fail(
      "REQUIRED_AFFECTED_RUNNER_MISSING",
      "Required affected execution requires one step runner.",
    );
  }
  const terminal = validateTerminalState(terminalState);
  if (typeof afterPrefix !== "function" || typeof afterProofs !== "function") {
    fail("REQUIRED_AFFECTED_RUNNER_INVALID", "Required affected runner hooks are invalid.");
  }
  const receiptAuthority = affectedReceiptAuthority({
    requiredExecutionToken,
    requiredExecutionAuthority,
    runStep,
    terminalState: terminal,
    afterPrefix,
    afterProofs,
  });

  // The exhaustive REQUIRED factory authenticates and marks the original workload objects. The
  // selected scheduler consumes only the closed subset; unsafe selection delegates to the full
  // exhaustive gate before this function is entered.
  const exhaustivePlan = createRequiredExhaustivePlan({ authority: REQUIRED_AUTHORITY });
  const nodeById = new Map(exhaustivePlan.nodes.map((workload) => [workload.id, workload]));
  const regions = selectedRegions(selection, nodeById);
  const steps = [];
  const runObserved = async (workload) => {
    assertTerminalOpen(terminal);
    const stepStartedAt = performance.now();
    let observation;
    try {
      observation = await runStep(workload, Object.freeze({ signal: terminal.signal }));
      assertTerminalOpen(terminal);
      observation = successfulObservation(observation, workload, receiptAuthority);
      assertTerminalOpen(terminal);
      steps.push(stepReceipt(workload, "PASS", stepStartedAt, observation));
    } catch (error) {
      const primary = claimTerminalFailure(terminal, error, workload.id);
      steps.push(stepReceipt(workload, "FAIL", stepStartedAt, observation, primary));
      throw primary;
    }
  };

  try {
    for (const workload of regions.prefix) await runObserved(workload);
    assertTerminalOpen(terminal);
    await afterPrefix();
    assertTerminalOpen(terminal);
    let proofFailure;
    try {
      for (const workload of regions.proofWorkloads) await runObserved(workload);
    } catch (error) {
      proofFailure = error;
    } finally {
      try {
        await afterProofs();
        if (!proofFailure) assertTerminalOpen(terminal);
      } catch (guardError) {
        if (!proofFailure) {
          proofFailure = guardError;
        } else if (
          guardError !== proofFailure &&
          proofFailure instanceof Error &&
          Object.isExtensible(proofFailure)
        ) {
          Object.defineProperty(proofFailure, "buildOutputGuardError", {
            value: guardError,
            enumerable: false,
          });
        }
      }
    }
    if (proofFailure) throw proofFailure;
    // The affected graph projects the exhaustive all-root barrier to exactly the selected roots.
    // The suffix starts only after every genuinely selected root closes.
    for (const workload of regions.suffix) await runObserved(workload);
    assertTerminalOpen(terminal);
    if (steps.length !== selection.workloadCount) {
      fail(
        "REQUIRED_AFFECTED_RECEIPT_INCOMPLETE",
        "The selected required plan did not close fully.",
      );
    }
    assertTerminalOpen(terminal);
    return executionReceipt(selection, "PASS", steps, startedAt, null, receiptAuthority);
  } catch (error) {
    const primary = claimTerminalFailure(terminal, error);
    return executionReceipt(selection, "FAIL", steps, startedAt, primary, receiptAuthority);
  }
}

/**
 * Captures the real Git boundary and executes an eligible selection inside the existing tracked,
 * untracked, build-output, process-isolation, and cancellation guards.
 */
async function executeRequiredAffectedQualityGateWithAuthority(
  options,
  rawExecutionAuthority,
  verifiedPromotion = undefined,
) {
  const executionAuthority = validateExecutionAuthority(rawExecutionAuthority);
  const { processRegistry, terminalState: terminal } = executionAuthority;
  const deadline = createRequiredAffectedGateDeadline(terminal);
  try {
    const workspaceRoot = options.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT;
    const { baseRevision, headRevision, executionRevision, sameRepository } = options;
    if (path.resolve(workspaceRoot) !== DEFAULT_WORKSPACE_ROOT) {
      fail(
        "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
        "REQUIRED affected execution rejects an injected workspace root.",
      );
    }
    const promotion = verifiedPromotion ?? (await verifyAffectedSelectorPromotionEvidence());
    assertTerminalOpen(terminal);
    const startedAt = performance.now();
    const boundary = await captureAffectedChangeBoundary({
      workspaceRoot,
      baseRevision,
      headRevision,
      executionRevision,
      sameRepository,
    });
    assertTerminalOpen(terminal);
    validateAffectedSelectorPromotionBoundary(promotion, boundary);
    assertTerminalOpen(terminal);
    const selection = validateAffectedSelectorPromotedSelection(
      boundary,
      promotion,
      createRequiredAffectedSelection(
        validateAffectedSelectorPromotedBoundary(boundary, promotion),
      ),
    );
    for (const key of [
      "selectorSha256",
      "ownershipSha256",
      "impactGraphSha256",
      "thresholdSha256",
      "inventorySha256",
    ]) {
      if (selection[key] !== promotion.promotedAuthorities[key]) {
        fail(
          "REQUIRED_AFFECTED_PROMOTION_AUTHORITY_DRIFT",
          `Promoted affected authority field "${key}" drifted from authenticated I07-04 evidence.`,
        );
      }
    }
    if (selection.effectiveScope !== "AFFECTED") {
      return await runRequiredAffectedQualityGate(selection, {
        runStep: async () => fail("REQUIRED_AFFECTED_FALLBACK_EXECUTED", "Fallback executed work."),
      });
    }

    const beforeWorkspace = await captureExhaustiveGateWorkspace(workspaceRoot);
    let receipt;
    let primaryFailure;
    let buildOutputsBefore;
    let untrackedBefore;
    try {
      assertTerminalOpen(terminal);
      await assertExhaustiveGateCleanInput(workspaceRoot, selection.executionRevision);
      untrackedBefore = await snapshotNonIgnoredUntrackedState(workspaceRoot);
      const runStep = markAffectedRunner(
        createRequiredExhaustiveProcessRunner({
          workspaceRoot,
          processRegistry,
          terminalState: terminal,
        }),
        executionAuthority,
      );
      const afterPrefix = markAffectedHook(async () => {
        buildOutputsBefore = await snapshotBuildOutputs(workspaceRoot);
      }, executionAuthority);
      const afterProofs = markAffectedHook(async () => {
        if (!buildOutputsBefore) {
          fail("REQUIRED_AFFECTED_BUILD_GUARD_MISSING", "The required build guard did not open.");
        }
        assertBuildOutputsUnchanged(buildOutputsBefore, await snapshotBuildOutputs(workspaceRoot));
      }, executionAuthority);
      receipt = await runRequiredAffectedQualityGate(selection, {
        runStep,
        terminalState: terminal,
        afterPrefix,
        afterProofs,
        requiredExecutionToken: REQUIRED_EXECUTION_TOKEN,
        requiredExecutionAuthority: executionAuthority,
      });
      if (receipt.status !== "PASS") primaryFailure = terminalWinnerReason(terminal);
    } catch (error) {
      primaryFailure = error;
    }

    const closingGuards = await runRequiredAffectedClosingGuards(terminal, {
      runUntrackedGuard: async () => {
        if (untrackedBefore) {
          assertNonIgnoredUntrackedStateUnchanged(
            untrackedBefore,
            await snapshotNonIgnoredUntrackedState(workspaceRoot),
          );
        }
      },
      runWorkspaceGuard: async () => {
        assertExhaustiveGateWorkspaceUnchanged(
          beforeWorkspace,
          await captureExhaustiveGateWorkspace(workspaceRoot),
        );
      },
    });
    const failure = terminalWinnerReason(terminal) ?? primaryFailure ?? closingGuards.failure;
    if (failure) {
      return finalizeRequiredAffectedFailureReceipt(
        receipt,
        selection,
        primaryFailure ?? failure,
        closingGuards,
        startedAt,
        REQUIRED_EXECUTION_TOKEN,
      );
    }
    assertTerminalOpen(terminal);
    return receipt;
  } finally {
    deadline.clear();
  }
}

/**
 * Runs the promoted affected authority with only module-created process and terminal state.
 *
 * Public callers may provide revisions, but may not replace the process registry, terminal state,
 * runner, or closing hooks that authorize a REQUIRED receipt.
 */
export async function executeRequiredAffectedQualityGate(rawOptions = {}) {
  const options = normalizePublicOptions(
    rawOptions,
    AFFECTED_EXECUTION_OPTION_KEYS,
    "Required affected execution options",
  );
  return await executeRequiredAffectedQualityGateWithAuthority(options, createExecutionAuthority());
}

/** Emits the machine-readable REQUIRED affected receipt used by CI diagnostics. */
export function printRequiredAffectedReceipt(receipt, stream = process.stdout) {
  stream.write(`\nDESEN_REQUIRED_AFFECTED_RECEIPT=${JSON.stringify(receipt)}\n`);
}

/** Returns the closed event/status routing decision used by the authoritative dispatcher. */
export function resolveRequiredQualityGateMode(eventName, affectedStatus = null) {
  if (eventName !== "pull_request") return "EXHAUSTIVE";
  if (affectedStatus === null) return "TRY_AFFECTED";
  if (affectedStatus === "PASS" || affectedStatus === "FAIL") return "AFFECTED";
  if (affectedStatus === "NOT_ELIGIBLE") return "EXHAUSTIVE";
  fail("REQUIRED_AFFECTED_STATUS_INVALID", "The affected dispatcher received an unknown status.");
}

/** Closed terminal projection used by the CLI; cancellation remains terminal after any receipt. */
export function requiredQualityGateExitCode(result, failure = null, cancellationExitCode = null) {
  const effectiveCancellationExitCode =
    cancellationExitCode ?? REQUIRED_GATE_RESULT_EXIT_CODES.get(result) ?? null;
  if (effectiveCancellationExitCode !== null) {
    return VALID_TERMINAL_EXIT_CODES.includes(effectiveCancellationExitCode)
      ? effectiveCancellationExitCode
      : 1;
  }
  if (failure !== null) return 1;
  if (
    !AUTHENTIC_REQUIRED_GATE_RESULTS.has(result) ||
    result?.receipt === null ||
    typeof result?.receipt !== "object"
  ) {
    return 1;
  }
  if (result.mode === "AFFECTED") {
    return result.receipt.schemaVersion === 1 &&
      result.receipt.profile === REQUIRED_AFFECTED_RECEIPT_PROFILE &&
      result.receipt.authority === "REQUIRED" &&
      result.receipt.requestedScope === "AFFECTED" &&
      result.receipt.effectiveScope === "AFFECTED" &&
      result.receipt.status === "PASS"
      ? 0
      : 1;
  }
  if (result.mode === "EXHAUSTIVE") {
    return result.receipt.schemaVersion === 1 &&
      result.receipt.profile === EXHAUSTIVE_BOUNDARY_RECEIPT_PROFILE &&
      result.receipt.status === "PASS" &&
      result.receipt.execution?.schemaVersion === 1 &&
      result.receipt.execution.profile === REQUIRED_EXHAUSTIVE_RECEIPT_PROFILE &&
      result.receipt.execution.authority === "REQUIRED" &&
      result.receipt.execution.scope === "EXHAUSTIVE" &&
      result.receipt.execution.status === "PASS"
      ? 0
      : 1;
  }
  return 1;
}

function exactEnvironmentValue(environment, key) {
  const descriptor = Object.getOwnPropertyDescriptor(environment, key);
  return descriptor && "value" in descriptor && typeof descriptor.value === "string"
    ? descriptor.value
    : "";
}

/** Creates authenticated dispatcher seams whose receipts remain non-authoritative TEST output. */
export function createRequiredQualityGateTestSeams({
  verifyPromotion = async () => undefined,
  executeAffected,
  executeExhaustive,
} = {}) {
  if (
    typeof verifyPromotion !== "function" ||
    typeof executeAffected !== "function" ||
    typeof executeExhaustive !== "function"
  ) {
    fail(
      "REQUIRED_AFFECTED_TEST_SEAM_INVALID",
      "Required dispatcher test seams must supply all three functions.",
    );
  }
  const seams = Object.freeze({ verifyPromotion, executeAffected, executeExhaustive });
  REQUIRED_QUALITY_GATE_TEST_SEAMS.set(seams, seams);
  return seams;
}

function createDispatchResult(mode, receipt, authority, cancellationExitCode = null) {
  let projectedReceipt = receipt;
  if (authority === "TEST") {
    projectedReceipt =
      mode === "AFFECTED"
        ? Object.freeze({ ...receipt, authority: "TEST" })
        : Object.freeze({
            ...receipt,
            execution:
              receipt?.execution && typeof receipt.execution === "object"
                ? Object.freeze({ ...receipt.execution, authority: "TEST" })
                : receipt?.execution,
          });
  }
  const result = Object.freeze({ mode, receipt: projectedReceipt });
  AUTHENTIC_REQUIRED_GATE_RESULTS.add(result);
  REQUIRED_GATE_RESULT_EXIT_CODES.set(result, cancellationExitCode);
  return result;
}

/**
 * Runs affected selection only for an eligible same-repository pull request. Every other event or
 * unsafe selection delegates to the unchanged fresh REQUIRED + EXHAUSTIVE authority.
 */
export async function executeRequiredQualityGate(rawOptions = {}) {
  const options = normalizePublicOptions(
    rawOptions,
    REQUIRED_GATE_OPTION_KEYS,
    "Required quality-gate options",
  );
  const testSeams = options.testSeams;
  const testConfiguration =
    testSeams === undefined ? undefined : REQUIRED_QUALITY_GATE_TEST_SEAMS.get(testSeams);
  if (testSeams !== undefined && testConfiguration === undefined) {
    fail(
      "REQUIRED_AFFECTED_AUTHORITY_INJECTED",
      "The required dispatcher rejected unauthenticated execution seams.",
    );
  }
  const executionAuthority = createExecutionAuthority({ cancellation: true });
  const cancellation = executionAuthority.cancellationState;
  const uninstall = cancellation?.install();
  try {
    const promotion = await (
      testConfiguration?.verifyPromotion ?? verifyAffectedSelectorPromotionEvidence
    )();
    if (resolveRequiredQualityGateMode(options.eventName) === "TRY_AFFECTED") {
      const affectedOptions = {
        baseRevision: options.baseRevision,
        headRevision: options.headRevision,
        executionRevision: options.executionRevision,
        sameRepository: options.sameRepository,
      };
      const affected = testConfiguration
        ? await testConfiguration.executeAffected(affectedOptions)
        : await executeRequiredAffectedQualityGateWithAuthority(
            affectedOptions,
            executionAuthority,
            promotion,
          );
      if (resolveRequiredQualityGateMode(options.eventName, affected.status) === "AFFECTED") {
        return createDispatchResult(
          "AFFECTED",
          affected,
          testConfiguration ? "TEST" : "REQUIRED",
          cancellation?.exitCode() ?? null,
        );
      }
    }
    const exhaustiveOptions = {
      expectedRevision: options.executionRevision || undefined,
    };
    exhaustiveOptions.processRegistry = executionAuthority.processRegistry;
    exhaustiveOptions.terminalState = executionAuthority.terminalState;
    const exhaustive = testConfiguration
      ? await testConfiguration.executeExhaustive(exhaustiveOptions)
      : await executeRequiredExhaustiveQualityGate(exhaustiveOptions);
    return createDispatchResult(
      "EXHAUSTIVE",
      exhaustive,
      testConfiguration ? "TEST" : "REQUIRED",
      cancellation?.exitCode() ?? null,
    );
  } catch (error) {
    const cancellationExitCode = cancellation?.exitCode();
    if (
      VALID_TERMINAL_EXIT_CODES.includes(cancellationExitCode) &&
      error instanceof Error &&
      Object.isExtensible(error)
    ) {
      Object.defineProperty(error, "requiredQualityGateCancellationExitCode", {
        value: cancellationExitCode,
        enumerable: false,
      });
    }
    throw error;
  } finally {
    uninstall?.();
  }
}

async function main() {
  let result;
  let failure;
  try {
    result = await executeRequiredQualityGate({
      eventName: exactEnvironmentValue(process.env, "GITHUB_EVENT_NAME"),
      baseRevision: exactEnvironmentValue(process.env, "DESEN_REQUIRED_BASE_REVISION"),
      headRevision: exactEnvironmentValue(process.env, "DESEN_REQUIRED_HEAD_REVISION"),
      executionRevision: exactEnvironmentValue(process.env, "GITHUB_SHA"),
      sameRepository:
        exactEnvironmentValue(process.env, "DESEN_REQUIRED_SAME_REPOSITORY") === "true",
    });
  } catch (error) {
    failure = error;
  }
  if (result?.mode === "AFFECTED") {
    printRequiredAffectedReceipt(result.receipt);
  } else if (result?.mode === "EXHAUSTIVE") {
    process.stdout.write(`\nDESEN_REQUIRED_EXHAUSTIVE_RECEIPT=${JSON.stringify(result.receipt)}\n`);
  }
  if (failure) {
    process.stderr.write(`${failure.stack ?? String(failure)}\n`);
  }
  process.exitCode = requiredQualityGateExitCode(
    result,
    failure ?? null,
    failure?.requiredQualityGateCancellationExitCode ?? null,
  );
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await main();

export { DEFAULT_WORKSPACE_ROOT };
