import {
  attachRuntimeHeadlessSessionComponentCommands,
  authenticateRuntimeHeadlessSessionAdapterAuthority,
  authenticateRuntimeHeadlessSessionHostAuthority,
  detachRuntimeHeadlessSessionComponentCommands,
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
  RUNTIME_HEADLESS_SESSION_LIMITS,
  snapshotRuntimeJsonValue,
  subscribeRuntimeHeadlessSession,
  unsubscribeRuntimeHeadlessSession,
} from "../src/index.js";

import type {
  RuntimeHeadlessBindingSnapshot,
  RuntimeHeadlessSessionAdapterAuthorityInput,
  RuntimeHeadlessSessionAdapterAuthorityResult,
  RuntimeHeadlessSessionComponentCommandsAttachResult,
  RuntimeHeadlessSessionComponentCommandsAttachment,
  RuntimeHeadlessSessionComponentCommandsDetachResult,
  RuntimeHeadlessSessionComponentCommandsInput,
  RuntimeHeadlessSessionDisposeResult,
  RuntimeHeadlessSessionEventCompletion,
  RuntimeHeadlessSessionEventInput,
  RuntimeHeadlessSessionEventResult,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionHostAuthorityInput,
  RuntimeHeadlessSessionHostAuthorityResult,
  RuntimeHeadlessSessionLimitProfile,
  RuntimeHeadlessSessionListener,
  RuntimeHeadlessSessionMountInput,
  RuntimeHeadlessSessionMountResult,
  RuntimeHeadlessSessionReadResult,
  RuntimeHeadlessSessionSnapshot,
  RuntimeHeadlessSessionSubscribeResult,
  RuntimeHeadlessSessionSubscription,
  RuntimeHeadlessSessionUnsubscribeResult,
  RuntimeHostPorts,
  RuntimeJsonValue,
} from "../src/index.js";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";

declare const hostPorts: RuntimeHostPorts;
declare const otherHostPorts: RuntimeHostPorts;
declare const handle: RuntimeHeadlessSessionHandle;
declare const snapshot: RuntimeHeadlessSessionSnapshot;
declare const catalogSet: DesenValidatedExecutionCatalogSet;

const hostAuthorityInput: RuntimeHeadlessSessionHostAuthorityInput = { hostPorts };
const hostAuthority: RuntimeHeadlessSessionHostAuthorityResult =
  authenticateRuntimeHeadlessSessionHostAuthority(handle, hostAuthorityInput);
if (hostAuthority.status === "authenticated") {
  // @ts-expect-error authentication never exposes the retained host-port aggregate
  void hostAuthority.hostPorts;
}

authenticateRuntimeHeadlessSessionHostAuthority(handle, { hostPorts: otherHostPorts });

// @ts-expect-error host authority inputs are immutable
hostAuthorityInput.hostPorts = otherHostPorts;

// @ts-expect-error host authentication requires a host-port aggregate
authenticateRuntimeHeadlessSessionHostAuthority(handle, {});

authenticateRuntimeHeadlessSessionHostAuthority(handle, {
  hostPorts,
  // @ts-expect-error no snapshot, Catalog, or other authority may accompany the host aggregate
  snapshot,
});

// @ts-expect-error a structural object is not the complete RuntimeHostPorts contract
authenticateRuntimeHeadlessSessionHostAuthority(handle, { hostPorts: {} });

// @ts-expect-error a session snapshot is not an opaque session handle
authenticateRuntimeHeadlessSessionHostAuthority(snapshot, hostAuthorityInput);

const detachedRuntimeJson = snapshotRuntimeJsonValue({ nested: ["inert", 1, true, null] });
if (detachedRuntimeJson !== undefined) {
  const inertValue: RuntimeJsonValue = detachedRuntimeJson;
  void inertValue;
}

const adapterAuthorityInput: RuntimeHeadlessSessionAdapterAuthorityInput = {
  snapshot,
  catalogSet,
};
const adapterAuthority: RuntimeHeadlessSessionAdapterAuthorityResult =
  authenticateRuntimeHeadlessSessionAdapterAuthority(handle, adapterAuthorityInput);
if (adapterAuthority.status === "authenticated" || adapterAuthority.status === "invalid-snapshot") {
  const currentAdapterSnapshot: RuntimeHeadlessSessionSnapshot = adapterAuthority.snapshot;
  void currentAdapterSnapshot;
}

// @ts-expect-error adapter authority inputs are immutable
adapterAuthorityInput.snapshot = snapshot;

// @ts-expect-error adapter preflight always requires the exact validated Catalog set
authenticateRuntimeHeadlessSessionAdapterAuthority(handle, { snapshot });

authenticateRuntimeHeadlessSessionAdapterAuthority(handle, {
  snapshot,
  catalogSet,
  // @ts-expect-error a raw plan cannot replace or accompany session adapter authority
  plan: snapshot.plan,
});

// @ts-expect-error structurally reconstructed Catalog values carry no validator authority
authenticateRuntimeHeadlessSessionAdapterAuthority(handle, { snapshot, catalogSet: {} });

// @ts-expect-error a session snapshot is not an opaque session handle
authenticateRuntimeHeadlessSessionAdapterAuthority(snapshot, adapterAuthorityInput);

if (adapterAuthority.status === "authenticated") {
  // @ts-expect-error authenticated results never expose retained Catalog authority
  void adapterAuthority.catalogSet;
}

const componentCommandsInput: RuntimeHeadlessSessionComponentCommandsInput = {
  snapshot,
  runtimeInstanceId: '["document","surface","password"]',
  commands: {
    invoke(request) {
      void request.command;
      void request.input;
      return { status: "succeeded" };
    },
  },
};
const componentCommandsAttachment: RuntimeHeadlessSessionComponentCommandsAttachResult =
  attachRuntimeHeadlessSessionComponentCommands(handle, componentCommandsInput);
if (componentCommandsAttachment.status === "attached") {
  const attachment: RuntimeHeadlessSessionComponentCommandsAttachment =
    componentCommandsAttachment.attachment;
  const detached: RuntimeHeadlessSessionComponentCommandsDetachResult =
    detachRuntimeHeadlessSessionComponentCommands(attachment);
  void detached;
}

// @ts-expect-error command attachment inputs are immutable
componentCommandsInput.runtimeInstanceId = "replacement";

// @ts-expect-error an attachment requires the exact current snapshot
attachRuntimeHeadlessSessionComponentCommands(handle, {
  runtimeInstanceId: "password",
  commands: { invoke: () => ({ status: "succeeded" }) },
});

attachRuntimeHeadlessSessionComponentCommands(handle, {
  snapshot,
  runtimeInstanceId: "password",
  // @ts-expect-error a callback is required; inert metadata cannot become command authority
  commands: {},
});

attachRuntimeHeadlessSessionComponentCommands(handle, {
  snapshot,
  runtimeInstanceId: "password",
  commands: {
    // @ts-expect-error command results are a closed succeeded/denied classification
    invoke: () => ({ status: "pending" }),
  },
});

attachRuntimeHeadlessSessionComponentCommands(handle, {
  snapshot,
  runtimeInstanceId: "password",
  commands: { invoke: () => ({ status: "denied" }) },
  // @ts-expect-error executable attachment envelopes accept no extra authority
  catalogSet,
});

// @ts-expect-error command attachments carry factory-only authority
const forgedComponentCommandsAttachment: RuntimeHeadlessSessionComponentCommandsAttachment = {};
void forgedComponentCommandsAttachment;

// @ts-expect-error a session handle cannot be detached as a command attachment
detachRuntimeHeadlessSessionComponentCommands(handle);

const limits: RuntimeHeadlessSessionLimitProfile = {
  maxNodes: RUNTIME_HEADLESS_SESSION_LIMITS.maxNodes,
  maxDepth: 64,
  maxBindingCandidates: 32,
  maxEventHandlerBindings: 32,
  maxSubscriptions: 16,
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
  const mountedCatalogSet: DesenValidatedExecutionCatalogSet = mounted.catalogSet;
  const read: RuntimeHeadlessSessionReadResult = readRuntimeHeadlessSession(mountedHandle);
  const disposed: RuntimeHeadlessSessionDisposeResult =
    disposeRuntimeHeadlessSession(mountedHandle);
  void [mountedSnapshot, mountedCatalogSet, read, disposed];
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

const listener: RuntimeHeadlessSessionListener = () => undefined;
const subscribed: RuntimeHeadlessSessionSubscribeResult = subscribeRuntimeHeadlessSession(
  handle,
  listener,
);
if (subscribed.status === "subscribed") {
  const subscription: RuntimeHeadlessSessionSubscription = subscribed.subscription;
  const unsubscribed: RuntimeHeadlessSessionUnsubscribeResult =
    unsubscribeRuntimeHeadlessSession(subscription);
  void unsubscribed;
}
const useSyncExternalStoreSubscribe = (onStoreChange: () => void): (() => void) => {
  const result = subscribeRuntimeHeadlessSession(handle, onStoreChange);
  return result.status === "subscribed"
    ? () => {
        unsubscribeRuntimeHeadlessSession(result.subscription);
      }
    : () => undefined;
};
void useSyncExternalStoreSubscribe;

// @ts-expect-error session handles carry factory-only authority
const forgedHandle: RuntimeHeadlessSessionHandle = {};
void forgedHandle;

// @ts-expect-error subscription authorities are factory-created
const forgedSubscription: RuntimeHeadlessSessionSubscription = {};
void forgedSubscription;

// @ts-expect-error listeners are receiver-independent callbacks, not arbitrary values
subscribeRuntimeHeadlessSession(handle, "notice");

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

// @ts-expect-error the T13 settlement observer is package-internal
import { subscribeRuntimeActionTurnSettlements } from "../src/index.js";
void subscribeRuntimeActionTurnSettlements;
