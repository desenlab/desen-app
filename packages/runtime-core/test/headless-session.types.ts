import {
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
  RUNTIME_HEADLESS_SESSION_LIMITS,
} from "../src/index.js";

import type {
  RuntimeHeadlessBindingSnapshot,
  RuntimeHeadlessSessionDisposeResult,
  RuntimeHeadlessSessionEventCompletion,
  RuntimeHeadlessSessionEventInput,
  RuntimeHeadlessSessionEventResult,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionLimitProfile,
  RuntimeHeadlessSessionMountInput,
  RuntimeHeadlessSessionMountResult,
  RuntimeHeadlessSessionReadResult,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHostPorts,
} from "../src/index.js";

declare const hostPorts: RuntimeHostPorts;
declare const handle: RuntimeHeadlessSessionHandle;
declare const snapshot: RuntimeHeadlessSessionSnapshot;

const limits: RuntimeHeadlessSessionLimitProfile = {
  maxNodes: RUNTIME_HEADLESS_SESSION_LIMITS.maxNodes,
  maxDepth: 64,
  maxBindingCandidates: 32,
  maxEventHandlerBindings: 32,
  maxSurfaceTransitions: 8,
  maxSnapshotGeneration: 1_000,
  maxPlanJsonOccurrences: 100_000,
  maxPlanCodeUnits: 1_000_000,
};
const mountInput: RuntimeHeadlessSessionMountInput = {
  bundle: {},
  catalogs: [],
  hostPorts,
  limits,
};
const mounted: RuntimeHeadlessSessionMountResult = mountRuntimeHeadlessSession(mountInput);
if (mounted.status === "mounted") {
  const mountedHandle: RuntimeHeadlessSessionHandle = mounted.handle;
  const mountedSnapshot: RuntimeHeadlessSessionSnapshot = mounted.snapshot;
  const read: RuntimeHeadlessSessionReadResult = readRuntimeHeadlessSession(mountedHandle);
  const disposed: RuntimeHeadlessSessionDisposeResult =
    disposeRuntimeHeadlessSession(mountedHandle);
  void [mountedSnapshot, read, disposed];
}

const event: RuntimeHeadlessSessionEventInput = {
  snapshot,
  runtimeInstanceId: '["document","surface","node"]',
  eventName: "change",
  payload: { value: "person@example.com" },
};
const eventResult: RuntimeHeadlessSessionEventResult = dispatchRuntimeHeadlessSessionEvent(
  handle,
  event,
);
if (eventResult.status === "dispatched") {
  void eventResult.completion.then((completion: RuntimeHeadlessSessionEventCompletion) => {
    const status: "completed" | "disposed" | "navigated" | "terminated" = completion.status;
    void status;
  });
}

const componentBinding: RuntimeHeadlessBindingSnapshot = {
  kind: "component",
  sourceNodeId: "email",
  capabilityId: "com.example.ui/TextField",
  runtimeInstanceId: '["document","surface","email"]',
  registrationGeneration: 0,
  handledEvents: ["change"],
};
void componentBinding;

// @ts-expect-error session handles carry factory-only authority
const forgedHandle: RuntimeHeadlessSessionHandle = {};
void forgedHandle;

// @ts-expect-error session limit values are numeric lower-only ceilings
const stringLimit: RuntimeHeadlessSessionLimitProfile = { maxNodes: "5000" };
void stringLimit;

const stringEventHandlerLimit: RuntimeHeadlessSessionLimitProfile = {
  // @ts-expect-error handled-event ceilings are finite numeric lower-only limits
  maxEventHandlerBindings: "5000",
};
void stringEventHandlerLimit;

// @ts-expect-error unknown limit names cannot widen the closed profile
const unknownLimit: RuntimeHeadlessSessionLimitProfile = { maxTimers: 1 };
void unknownLimit;

// @ts-expect-error mount requires the complete host aggregate
const mountWithoutHost: RuntimeHeadlessSessionMountInput = { bundle: {}, catalogs: [] };
void mountWithoutHost;

// @ts-expect-error an event requires an exact current session snapshot
const eventWithoutSnapshot: RuntimeHeadlessSessionEventInput = {
  runtimeInstanceId: "node",
  eventName: "change",
  payload: {},
};
void eventWithoutSnapshot;

const malformedCompletion: RuntimeHeadlessSessionEventCompletion = {
  // @ts-expect-error completion status is a closed action-turn classification
  status: "failed",
  turnId: "turn:0",
  snapshot: null,
};
void malformedCompletion;

// @ts-expect-error observable plans cannot contain executable callbacks
const executablePlan: RuntimeHeadlessSessionSnapshot["plan"] = { callback: () => undefined };
void executablePlan;

const invalidBinding: RuntimeHeadlessBindingSnapshot = {
  kind: "component",
  sourceNodeId: "email",
  capabilityId: "com.example.ui/TextField",
  runtimeInstanceId: "email:0",
  registrationGeneration: 0,
  handledEvents: [],
  // @ts-expect-error binding summaries expose no adapter callback
  invoke: () => ({ status: "succeeded" }),
};
void invalidBinding;

// @ts-expect-error session disposal requires the opaque handle
disposeRuntimeHeadlessSession({});

// @ts-expect-error the private materialization sidecar reader is absent from the package root
import { readRuntimeHeadlessMaterializationSidecar } from "../src/index.js";
void readRuntimeHeadlessMaterializationSidecar;
