import {
  disposeRuntimeActionTurns,
  executeRuntimeActionTurn,
  mountRuntimeActionTurns,
  prepareRuntimeActionProgram,
  RUNTIME_ACTION_TURN_LIMITS,
} from "../src/index.js";

import type {
  RuntimeActionTurnCompletion,
  RuntimeActionTurnExecutionResult,
  RuntimeActionTurnLimitProfile,
  RuntimeActionTurnProgram,
  RuntimeActionTurnProgramPreparationResult,
  RuntimeActionTurnQueued,
  RuntimeActionTurnRequest,
  RuntimeActionTurnStarted,
  RuntimeActionTurnStep,
  RuntimeActionTurnTerminationReason,
  RuntimeActionTurnsDisposeResult,
  RuntimeActionTurnsHandle,
  RuntimeActionTurnsMountInput,
  RuntimeActionTurnsMountInvalidReason,
  RuntimeActionTurnsMountResult,
  RuntimeActionTurnsSnapshot,
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
  RuntimeHostPorts,
  RuntimeOperationResourceActionsHandle,
  RuntimeResolutionSnapshot,
  RuntimeStateNavigationActionsHandle,
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
  RuntimeSurfaceStateHandle,
  RuntimeSurfaceStateSnapshot,
} from "../src/index.js";

declare const hostPorts: RuntimeHostPorts;
declare const stateHandle: RuntimeSurfaceStateHandle;
declare const stateSnapshot: RuntimeSurfaceStateSnapshot;
declare const resourceHandle: RuntimeSurfaceResourcesHandle;
declare const resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
declare const operationHandle: RuntimeSurfaceOperationsHandle;
declare const operationSnapshot: RuntimeSurfaceOperationsSnapshot;
declare const stateActionsHandle: RuntimeStateNavigationActionsHandle;
declare const operationResourceActionsHandle: RuntimeOperationResourceActionsHandle;
declare const commandEventActionsHandle: RuntimeCommandEventActionsHandle;
declare const commandEventSnapshot: RuntimeCommandEventActionsSnapshot;
declare const resolutionSnapshot: RuntimeResolutionSnapshot;

const limits: RuntimeActionTurnLimitProfile = {
  maxActionsPerTurn: 64,
  maxSettlementDepth: 16,
  maxQueuedTurns: 64,
  maxSynchronousTurnTransitions: 64,
  maxTurnGeneration: Number.MAX_SAFE_INTEGER,
  maxRetainedQueuedActions: 4_096,
  maxRetainedQueuedCodeUnits: RUNTIME_ACTION_TURN_LIMITS.maxRetainedQueuedCodeUnits,
};

const mountInput: RuntimeActionTurnsMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  stateHandle,
  stateSnapshot,
  resourceHandle,
  resourceSnapshot,
  operationHandle,
  operationSnapshot,
  stateActionsHandle,
  operationResourceActionsHandle,
  commandEventActionsHandle,
  commandEventSnapshot,
  hostPorts,
  limits,
};

const mountResult: RuntimeActionTurnsMountResult = mountRuntimeActionTurns(mountInput);
if (mountResult.status === "mounted") {
  const handle: RuntimeActionTurnsHandle = mountResult.handle;
  const snapshot: RuntimeActionTurnsSnapshot = mountResult.snapshot;
  const prepared: RuntimeActionTurnProgramPreparationResult = prepareRuntimeActionProgram([
    { type: "state.toggle", path: "enabled" },
  ]);
  if (prepared.status === "prepared") {
    const program: RuntimeActionTurnProgram = prepared.program;
    const request: RuntimeActionTurnRequest = { program, snapshot: resolutionSnapshot };
    const execution: RuntimeActionTurnExecutionResult = executeRuntimeActionTurn(handle, request);
    if (execution.status === "started") {
      const started: RuntimeActionTurnStarted = execution;
      void started.completion.then((completion: RuntimeActionTurnCompletion) => completion.steps);
    }
    if (execution.status === "queued") {
      const queued: RuntimeActionTurnQueued = execution;
      void queued.position;
    }
  }
  const disposed: RuntimeActionTurnsDisposeResult = disposeRuntimeActionTurns(handle);
  void [snapshot, disposed];
}

const reason: RuntimeActionTurnTerminationReason = "invalid-snapshot";
const invalidMountReason: RuntimeActionTurnsMountInvalidReason = "invalid-state-authority";
declare const step: RuntimeActionTurnStep;
void [reason, invalidMountReason, step];

// @ts-expect-error prepared programs are opaque factory authorities
const forgedProgram: RuntimeActionTurnProgram = {};
void forgedProgram;

// @ts-expect-error coordinator handles are opaque factory authorities
const forgedHandle: RuntimeActionTurnsHandle = {};
void forgedHandle;

const callerOrigin: RuntimeActionTurnRequest = {
  program: forgedProgram,
  snapshot: resolutionSnapshot,
  // @ts-expect-error callers cannot inject an internal settlement origin
  origin: "settlement",
};
void callerOrigin;

const callerDepth: RuntimeActionTurnRequest = {
  program: forgedProgram,
  snapshot: resolutionSnapshot,
  // @ts-expect-error callers cannot reset the package-owned settlement depth
  settlementDepth: 0,
};
void callerDepth;

// @ts-expect-error trusted limit profiles accept only finite numeric ceilings
const invalidLimit: RuntimeActionTurnLimitProfile = { maxActionsPerTurn: "64" };
void invalidLimit;

// @ts-expect-error a queued admission always carries its FIFO position
const queuedWithoutPosition: RuntimeActionTurnQueued = {
  status: "queued",
  turnId: "turn",
  snapshot: {} as RuntimeActionTurnsSnapshot,
  completion: Promise.resolve({} as RuntimeActionTurnCompletion),
};
void queuedWithoutPosition;

// @ts-expect-error a terminal completion must name its controlled reason
const terminatedWithoutReason: RuntimeActionTurnCompletion = {
  status: "terminated",
  turnId: "turn",
  origin: "event",
  settlementDepth: 0,
  steps: [],
  snapshot: {} as RuntimeActionTurnsSnapshot,
  resolutionSnapshot,
  diagnostics: [],
};
void terminatedWithoutReason;

// @ts-expect-error T10 package-internal authority reads do not leak through the root API
import { readRuntimeStateNavigationActions } from "../src/index.js";
void readRuntimeStateNavigationActions;

// @ts-expect-error T11 package-internal authority reads do not leak through the root API
import { readRuntimeOperationResourceActions } from "../src/index.js";
void readRuntimeOperationResourceActions;

// @ts-expect-error settlement finalization remains package-internal
import { finalizeRuntimeOperationActionSettlement } from "../src/index.js";
void finalizeRuntimeOperationActionSettlement;

// @ts-expect-error raw settlement tickets remain package-internal
import type { RuntimeOperationActionSettlementTicket } from "../src/index.js";
declare const leakedTicket: RuntimeOperationActionSettlementTicket;
void leakedTicket;
