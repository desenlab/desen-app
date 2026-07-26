import {
  createRuntimeReactiveHostPorts,
  disposeRuntimeReactiveReevaluation,
  invalidateRuntimeReactiveReevaluation,
  mountRuntimeReactiveReevaluation,
  readRuntimeReactiveReevaluation,
  RUNTIME_REACTIVE_REEVALUATION_LIMITS,
} from "../src/index.js";

import type {
  RuntimeHostPorts,
  RuntimeReactiveEvaluationOutcome,
  RuntimeReactiveEvaluationRequest,
  RuntimeReactiveEvaluator,
  RuntimeReactiveHostPorts,
  RuntimeReactiveInvalidationInput,
  RuntimeReactiveMaterializationContext,
  RuntimeReactiveReevaluationHandle,
  RuntimeReactiveReevaluationLimitProfile,
  RuntimeReactiveReevaluationMountInput,
  RuntimeReactiveReevaluationMountResult,
  RuntimeReactiveReevaluationSnapshot,
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

const reactiveHostPorts: RuntimeReactiveHostPorts = createRuntimeReactiveHostPorts(hostPorts);
const limits: RuntimeReactiveReevaluationLimitProfile = {
  maxSynchronousTransitions: RUNTIME_REACTIVE_REEVALUATION_LIMITS.maxSynchronousTransitions,
  maxEvaluationGeneration: 100,
  maxSnapshotGeneration: 100,
};
const evaluator: RuntimeReactiveEvaluator = (request) => {
  const evaluationId: string = request.evaluationId;
  const materialization: RuntimeReactiveMaterializationContext = request.materializationContext;
  void materialization.tokens.resolve({
    context: materialization.requestContext,
    token: "color.primary",
  });
  return {
    evaluationId,
    state: request.resolutionSnapshot.state,
    context: request.resolutionSnapshot.context,
    resource: request.resolutionSnapshot.resource,
    operation: request.resolutionSnapshot.operation,
    environment: request.resolutionSnapshot.env,
  };
};
const mountInput: RuntimeReactiveReevaluationMountInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  stateHandle,
  stateSnapshot,
  resourceHandle,
  resourceSnapshot,
  operationHandle,
  operationSnapshot,
  hostPorts: reactiveHostPorts,
  evaluator,
  limits,
};
const mounted: RuntimeReactiveReevaluationMountResult =
  mountRuntimeReactiveReevaluation(mountInput);
if (mounted.status === "mounted") {
  const handle: RuntimeReactiveReevaluationHandle = mounted.handle;
  const snapshot: RuntimeReactiveReevaluationSnapshot = mounted.snapshot;
  const invalidation: RuntimeReactiveInvalidationInput = {
    snapshot,
    reason: "action-turn",
  };
  void invalidateRuntimeReactiveReevaluation(handle, invalidation);
  void readRuntimeReactiveReevaluation(handle);
  void disposeRuntimeReactiveReevaluation(handle);
}

const active: RuntimeReactiveEvaluationOutcome = {
  status: "active",
  value: { visible: true },
};
const inactive: RuntimeReactiveEvaluationOutcome = {
  status: "inactive",
  reason: "invalid-result",
};
void [active, inactive];

// @ts-expect-error stale-safe host aggregates carry factory-only authority
const forgedHostPorts: RuntimeReactiveHostPorts = hostPorts;
void forgedHostPorts;

// @ts-expect-error reactive coordinator handles carry factory-only authority
const forgedHandle: RuntimeReactiveReevaluationHandle = {};
void forgedHandle;

const asynchronousEvaluator: RuntimeReactiveEvaluator =
  // @ts-expect-error whole-surface evaluation is deliberately synchronous
  async () => ({ visible: true });
void asynchronousEvaluator;

const executableEvaluator: RuntimeReactiveEvaluator =
  // @ts-expect-error evaluator output is inert JSON and never contains callbacks
  () => ({ callback: () => undefined });
void executableEvaluator;

// @ts-expect-error active output requires a bounded JSON value
const activeWithoutValue: RuntimeReactiveEvaluationOutcome = { status: "active" };
void activeWithoutValue;

// @ts-expect-error inactive output requires one controlled reason
const inactiveWithoutReason: RuntimeReactiveEvaluationOutcome = { status: "inactive" };
void inactiveWithoutReason;

// @ts-expect-error trusted limit profiles contain finite numeric ceilings
const invalidLimit: RuntimeReactiveReevaluationLimitProfile = { maxSnapshotGeneration: "10" };
void invalidLimit;

const unsupportedReason: RuntimeReactiveInvalidationInput = {
  snapshot: {} as RuntimeReactiveReevaluationSnapshot,
  // @ts-expect-error invalidations are limited to tracked runtime mutation domains
  reason: "timer",
};
void unsupportedReason;

const requestWithAuthority: RuntimeReactiveEvaluationRequest = {
  evaluationId: "reactive-evaluation:0",
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  resolutionSnapshot: {} as RuntimeReactiveEvaluationRequest["resolutionSnapshot"],
  materializationContext: {} as RuntimeReactiveMaterializationContext,
  // @ts-expect-error evaluators never receive state mutation authority
  stateHandle,
};
void requestWithAuthority;

const requestWithHostAggregate: RuntimeReactiveEvaluationRequest = {
  evaluationId: "reactive-evaluation:0",
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  resolutionSnapshot: {} as RuntimeReactiveEvaluationRequest["resolutionSnapshot"],
  materializationContext: {} as RuntimeReactiveMaterializationContext,
  // @ts-expect-error evaluators receive only the token port, not the complete host aggregate
  hostPorts: reactiveHostPorts,
};
void requestWithHostAggregate;

// @ts-expect-error the private reactive-host authenticator is absent from the package root
import { isRuntimeReactiveHostPorts } from "../src/index.js";
void isRuntimeReactiveHostPorts;
