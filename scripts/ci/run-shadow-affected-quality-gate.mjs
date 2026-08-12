import path from "node:path";
import { pathToFileURL } from "node:url";

import { captureAffectedChangeBoundary } from "./affected-change-boundary.mjs";
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
  OPTIONAL_AUTHORITY,
  createRequiredExhaustiveCancellationState,
  createRequiredExhaustiveProcessRegistry,
  createRequiredExhaustiveProcessRunner,
  createRequiredExhaustiveTerminalState,
  createRequiredExhaustivePlan,
} from "./run-required-exhaustive-quality-gate.mjs";
import {
  assertBuildOutputsUnchanged,
  assertNonIgnoredUntrackedStateUnchanged,
  snapshotBuildOutputs,
  snapshotNonIgnoredUntrackedState,
} from "./shared-state-authority.mjs";

const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../..");
export const SHADOW_AFFECTED_RECEIPT_PROFILE = "desen.ci.shadow-affected-execution.v1";
const PREFIX_IDS = Object.freeze([
  "orchestrator-contracts",
  "format",
  "lint",
  "structural-validator-artifacts",
  "workspace-graph",
  "package-tests",
]);
const SUFFIX_IDS = Object.freeze(["dependency-boundaries", "boundary-fixtures"]);
export const SHADOW_AFFECTED_SUFFIX_DEPENDENCY_POLICY = "SELECTED_ROOT_BARRIER";

/** Stable failure raised only inside the non-authoritative shadow execution surface. */
export class ShadowAffectedQualityGateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ShadowAffectedQualityGateError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ShadowAffectedQualityGateError(code, message, details);
}

function errorProjection(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : "NonErrorFailure",
    code: typeof error?.code === "string" ? error.code : null,
    message: error instanceof Error ? error.message : String(error),
  });
}

function successfulObservation(observation, workload) {
  if (
    observation === null ||
    typeof observation !== "object" ||
    observation.schemaVersion !== 1 ||
    observation.profile !== "desen.ci.exhaustive-step-close.v1" ||
    observation.stepId !== workload.id ||
    observation.status !== "PASS" ||
    observation.observedClose !== true ||
    observation.code !== 0 ||
    observation.signal !== null
  ) {
    fail(
      "SHADOW_AFFECTED_CLOSE_UNOBSERVED",
      `Shadow workload "${workload.id}" did not close successfully.`,
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

function executionReceipt(selection, status, steps, startedAt, error = null) {
  return Object.freeze({
    schemaVersion: 1,
    profile: SHADOW_AFFECTED_RECEIPT_PROFILE,
    authority: "SHADOW",
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
    fail("SHADOW_AFFECTED_PLAN_INVALID", "The selector referenced an unknown exhaustive workload.");
  }
  const prefix = nodes.slice(0, PREFIX_IDS.length);
  const suffix = nodes.slice(-SUFFIX_IDS.length);
  const proofNodes = nodes.slice(PREFIX_IDS.length, -SUFFIX_IDS.length);
  if (
    prefix.some(({ id }, index) => id !== PREFIX_IDS[index]) ||
    suffix.some(({ id }, index) => id !== SUFFIX_IDS[index]) ||
    proofNodes.length !== selection.proofUnitCount * 2
  ) {
    fail("SHADOW_AFFECTED_PLAN_INVALID", "Shadow execution regions drifted.");
  }
  const expectedProofNodeIds = new Set(
    selection.affectedProofUnitIds.flatMap((proofId) => [`verify-${proofId}`, `test-${proofId}`]),
  );
  if (
    expectedProofNodeIds.size !== proofNodes.length ||
    proofNodes.some(({ id }) => !expectedProofNodeIds.has(id))
  ) {
    fail("SHADOW_AFFECTED_PLAN_INVALID", "Shadow proof workload membership drifted.");
  }

  for (const proofId of selection.affectedProofUnitIds) {
    const verifier = nodeById.get(`verify-${proofId}`);
    const rootTest = nodeById.get(`test-${proofId}`);
    if (
      verifier === undefined ||
      rootTest === undefined ||
      verifier.dependencies.length !== 1 ||
      verifier.dependencies[0] !== "package-tests" ||
      rootTest.dependencies.length !== 1 ||
      rootTest.dependencies[0] !== verifier.id
    ) {
      fail("SHADOW_AFFECTED_PLAN_INVALID", `Shadow proof pair "${proofId}" drifted.`);
    }
  }

  const completedPrefixIds = new Set();
  for (const workload of prefix) {
    if (workload.dependencies.some((dependency) => !completedPrefixIds.has(dependency))) {
      fail(
        "SHADOW_AFFECTED_PLAN_INVALID",
        `Shadow prefix "${workload.id}" is not dependency closed.`,
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
    exhaustiveRootIds.length !== 71 ||
    dependencyBoundary.dependencies.length !== exhaustiveRootIds.length ||
    dependencyBoundary.dependencies.some(
      (dependency, index) => dependency !== exhaustiveRootIds[index],
    ) ||
    selectedRootIds.some((id) => !dependencyBoundary.dependencies.includes(id)) ||
    boundaryFixtures.dependencies.length !== 1 ||
    boundaryFixtures.dependencies[0] !== dependencyBoundary.id
  ) {
    fail("SHADOW_AFFECTED_PLAN_INVALID", "Shadow suffix dependency policy drifted.");
  }

  // The exhaustive graph declares dependency-boundaries behind every root. In the distinct
  // affected graph this reviewed policy projects that all-root ordering barrier to the exact
  // selected roots. No absent root is treated as completed.
  return Object.freeze({
    prefix,
    proofWorkloads: proofNodes,
    suffix,
    suffixDependencyPolicy: SHADOW_AFFECTED_SUFFIX_DEPENDENCY_POLICY,
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
    fail("SHADOW_AFFECTED_RUNNER_INVALID", "Shadow affected terminal authority is invalid.");
  }
  return terminalState;
}

function terminalWinnerReason(terminalState) {
  const winner = terminalState.winner();
  if (winner === undefined) return undefined;
  if (!(winner?.reason instanceof Error)) {
    fail(
      "SHADOW_AFFECTED_TERMINAL_INVALID",
      "Shadow affected terminal authority exposed an invalid winning reason.",
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
      "SHADOW_AFFECTED_TERMINAL_ABORTED",
      "Shadow affected execution was aborted without one valid terminal reason.",
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
 * The callbacks are non-authoritative SHADOW seams used by the production wrapper and focused
 * race tests; neither callback can create a passing receipt.
 */
export async function runShadowAffectedClosingGuards(
  rawTerminalState,
  { runUntrackedGuard = async () => undefined, runWorkspaceGuard } = {},
) {
  const terminalState = validateTerminalState(rawTerminalState);
  if (typeof runUntrackedGuard !== "function" || typeof runWorkspaceGuard !== "function") {
    fail("SHADOW_AFFECTED_GUARD_INVALID", "Shadow affected closing guards are invalid.");
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
 * Combines an inner SHADOW receipt with outer guard evidence without replacing the first error.
 */
export function finalizeShadowAffectedFailureReceipt(
  receipt,
  selection,
  primaryFailure,
  closingGuards,
  startedAt = performance.now(),
) {
  const failure = primaryFailure ?? closingGuards.failure;
  if (!failure && receipt?.status !== "FAIL") {
    fail("SHADOW_AFFECTED_FAILURE_MISSING", "A failing shadow receipt requires one failure.");
  }
  const baseReceipt = receipt ?? executionReceipt(selection, "FAIL", [], startedAt, failure);
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
 * This function is intentionally SHADOW-only. Injected runners are useful for contract tests but
 * can never produce REQUIRED authority, and exhaustive fallback plans execute no duplicate work.
 */
export async function runShadowAffectedQualityGate(
  rawSelection,
  {
    runStep,
    terminalState = createRequiredExhaustiveTerminalState(),
    afterPrefix = async () => undefined,
    afterProofs = async () => undefined,
  } = {},
) {
  const startedAt = performance.now();
  const selection = validateShadowAffectedSelection(rawSelection);
  if (selection.effectiveScope !== "AFFECTED") {
    return executionReceipt(selection, "NOT_ELIGIBLE", [], startedAt);
  }
  if (typeof runStep !== "function") {
    fail("SHADOW_AFFECTED_RUNNER_MISSING", "Shadow affected execution requires one step runner.");
  }
  const terminal = validateTerminalState(terminalState);
  if (typeof afterPrefix !== "function" || typeof afterProofs !== "function") {
    fail("SHADOW_AFFECTED_RUNNER_INVALID", "Shadow affected runner hooks are invalid.");
  }

  // The exhaustive SHADOW factory authenticates and marks the original workload objects. Its
  // required sibling remains permanently fixed to all 150 nodes.
  const exhaustivePlan = createRequiredExhaustivePlan({ authority: OPTIONAL_AUTHORITY });
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
      observation = successfulObservation(observation, workload);
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
      fail("SHADOW_AFFECTED_RECEIPT_INCOMPLETE", "The selected shadow plan did not close fully.");
    }
    assertTerminalOpen(terminal);
    return executionReceipt(selection, "PASS", steps, startedAt);
  } catch (error) {
    const primary = claimTerminalFailure(terminal, error);
    return executionReceipt(selection, "FAIL", steps, startedAt, primary);
  }
}

/**
 * Captures the real Git boundary and executes an eligible selection inside the existing tracked,
 * untracked, build-output, process-isolation, and cancellation guards.
 */
export async function executeShadowAffectedQualityGate({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  baseRevision,
  headRevision,
  executionRevision,
  sameRepository,
  processRegistry = createRequiredExhaustiveProcessRegistry(),
  terminalState,
} = {}) {
  const startedAt = performance.now();
  const boundary = await captureAffectedChangeBoundary({
    workspaceRoot,
    baseRevision,
    headRevision,
    executionRevision,
    sameRepository,
  });
  const selection = createShadowAffectedSelection(boundary);
  if (selection.effectiveScope !== "AFFECTED") {
    return await runShadowAffectedQualityGate(selection, {
      runStep: async () => fail("SHADOW_AFFECTED_FALLBACK_EXECUTED", "Fallback executed work."),
    });
  }

  const beforeWorkspace = await captureExhaustiveGateWorkspace(workspaceRoot);
  let receipt;
  let primaryFailure;
  let buildOutputsBefore;
  let untrackedBefore;
  const terminal = terminalState ?? createRequiredExhaustiveTerminalState({ processRegistry });
  try {
    await assertExhaustiveGateCleanInput(workspaceRoot, selection.executionRevision);
    untrackedBefore = await snapshotNonIgnoredUntrackedState(workspaceRoot);
    const runStep = createRequiredExhaustiveProcessRunner({
      workspaceRoot,
      processRegistry,
      terminalState: terminal,
    });
    receipt = await runShadowAffectedQualityGate(selection, {
      runStep,
      terminalState: terminal,
      afterPrefix: async () => {
        buildOutputsBefore = await snapshotBuildOutputs(workspaceRoot);
      },
      afterProofs: async () => {
        if (!buildOutputsBefore) {
          fail("SHADOW_AFFECTED_BUILD_GUARD_MISSING", "The shadow build guard did not open.");
        }
        assertBuildOutputsUnchanged(buildOutputsBefore, await snapshotBuildOutputs(workspaceRoot));
      },
    });
    if (receipt.status !== "PASS") primaryFailure = terminalWinnerReason(terminal);
  } catch (error) {
    primaryFailure = error;
  }

  const closingGuards = await runShadowAffectedClosingGuards(terminal, {
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
    return finalizeShadowAffectedFailureReceipt(
      receipt,
      selection,
      primaryFailure ?? failure,
      closingGuards,
      startedAt,
    );
  }
  assertTerminalOpen(terminal);
  return receipt;
}

/** Emits the sole machine-readable log envelope consumed by later I07-04 observation review. */
export function printShadowAffectedReceipt(receipt, stream = process.stdout) {
  stream.write(`\nDESEN_SHADOW_AFFECTED_RECEIPT=${JSON.stringify(receipt)}\n`);
}

function exactEnvironmentValue(environment, key) {
  const descriptor = Object.getOwnPropertyDescriptor(environment, key);
  return descriptor && "value" in descriptor && typeof descriptor.value === "string"
    ? descriptor.value
    : "";
}

async function main() {
  const registry = createRequiredExhaustiveProcessRegistry();
  const cancellation = createRequiredExhaustiveCancellationState({ processRegistry: registry });
  const uninstall = cancellation.install();
  let receipt;
  try {
    receipt = await executeShadowAffectedQualityGate({
      baseRevision: exactEnvironmentValue(process.env, "DESEN_CI_BASE_SHA"),
      headRevision: exactEnvironmentValue(process.env, "DESEN_CI_HEAD_SHA"),
      executionRevision: exactEnvironmentValue(process.env, "GITHUB_SHA"),
      sameRepository: exactEnvironmentValue(process.env, "DESEN_CI_SAME_REPOSITORY") === "true",
      processRegistry: registry,
      terminalState: cancellation.terminalState,
    });
  } catch (error) {
    receipt = Object.freeze({
      schemaVersion: 1,
      profile: SHADOW_AFFECTED_RECEIPT_PROFILE,
      authority: "SHADOW",
      requestedScope: "AFFECTED",
      effectiveScope: "EXHAUSTIVE",
      decisionCategory: "INVALID_DIFF",
      reason: "SHADOW_WRAPPER_FAILURE",
      status: "NOT_ELIGIBLE",
      error: errorProjection(error),
    });
  } finally {
    uninstall();
  }
  printShadowAffectedReceipt(receipt);
  // SHADOW observation is deliberately non-authoritative. Required CI decides repository status.
  process.exitCode = 0;
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await main();

export { DEFAULT_WORKSPACE_ROOT };
