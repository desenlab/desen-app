import {
  bindRuntimeAdapterBridges,
  createRuntimeAdapterBridgePorts,
  disposeRuntimeAdapterBridges,
  readRuntimeAdapterBridges,
  receiveRuntimeAdapterEvent,
  registerRuntimeAdapterBinding,
  unregisterRuntimeAdapterBinding,
} from "../src/index.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeAdapterBindingTicket,
  RuntimeAdapterBridgesBindInput,
  RuntimeAdapterBridgesHandle,
  RuntimeAdapterBridgesSnapshot,
  RuntimeAdapterComponentCommandPort,
  RuntimeAdapterEventHandlerSelector,
  RuntimeAdapterEventTurnPort,
  RuntimeAdapterEventTurnRequest,
} from "../src/index.js";
import type {
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
  RuntimeNodeIdentity,
  RuntimeRepeatScope,
} from "../src/index.js";

declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const commandHandle: RuntimeCommandEventActionsHandle;
declare const commandSnapshot: RuntimeCommandEventActionsSnapshot;
declare const identity: RuntimeNodeIdentity;
declare const scope: RuntimeRepeatScope;

const eventTurns: RuntimeAdapterEventTurnPort = {
  dispatch(request) {
    void request.payload;
    return { status: "accepted" };
  },
};
const created = createRuntimeAdapterBridgePorts({
  eventTurns,
  limits: {
    maxLiveBindings: 10,
    maxEventHandlerBindings: 10,
    maxRegistrationGeneration: 10,
    maxSnapshotGeneration: 20,
    maxEventGeneration: 30,
    maxRetainedIdentifierCodeUnits: 1_024,
    maxRetainedScopeJsonOccurrences: 100,
    maxRetainedScopeCodeUnits: 1_024,
    maxRuntimeInstanceIdCodeUnits: 256,
  },
});
const handle: RuntimeAdapterBridgesHandle = created.handle;
created.componentCommands.invoke({
  context: {
    documentId: "com.desen.types",
    revision: `sha256:${"a".repeat(64)}`,
    surfaceId: "sign-in",
    requestId: "request-0",
  },
  sourceNodeId: "field",
  runtimeInstanceId: "runtime-field",
  capabilityId: "com.example.ui/TextField",
  command: "focus",
  input: {},
});

const bindInput: RuntimeAdapterBridgesBindInput = {
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  catalogSet,
  commandEventActionsHandle: commandHandle,
  commandEventSnapshot: commandSnapshot,
};
const bound = bindRuntimeAdapterBridges(handle, bindInput);
if (bound.status === "bound") {
  const snapshot: RuntimeAdapterBridgesSnapshot = bound.snapshot;
  const commands: RuntimeAdapterComponentCommandPort = {
    invoke(request) {
      void request.input;
      return { status: "succeeded" };
    },
  };
  const component = registerRuntimeAdapterBinding(handle, {
    kind: "component",
    identity,
    scope,
    handledEvents: ["change"],
    commands,
    snapshot,
  });
  if (component.status === "registered") {
    const ticket: RuntimeAdapterBindingTicket = component.ticket;
    const event = receiveRuntimeAdapterEvent(handle, {
      ticket,
      eventName: "change",
      payload: { value: "hello" },
      snapshot: component.snapshot,
    });
    void event;
    void unregisterRuntimeAdapterBinding(handle, {
      ticket,
      snapshot: component.snapshot,
    });
  }
}
void [readRuntimeAdapterBridges(handle), disposeRuntimeAdapterBridges(handle)];

// @ts-expect-error bridge handles are opaque factory authorities
const forgedHandle: RuntimeAdapterBridgesHandle = {};
void forgedHandle;

// @ts-expect-error binding tickets are opaque exact-generation authorities
const forgedTicket: RuntimeAdapterBindingTicket = {};
void forgedTicket;

const asynchronousSink: RuntimeAdapterEventTurnPort = {
  // @ts-expect-error event admission is synchronous and cannot return a Promise
  dispatch: async () => ({ status: "accepted" as const }),
};
void asynchronousSink;

const executablePayload: RuntimeAdapterEventTurnRequest = {
  eventId: "adapter-event-0",
  documentId: "com.desen.types",
  revision: `sha256:${"a".repeat(64)}`,
  surfaceId: "sign-in",
  capabilityKind: "component",
  capabilityId: "com.example.ui/TextField",
  runtimeInstanceId: "field",
  handler: { kind: "component", sourceNodeId: "field", eventName: "change" },
  // @ts-expect-error validated event payloads are inert JSON and never callbacks
  payload: { callback: () => undefined },
  item: {},
  repeatKeys: [],
};
void executablePayload;

const handlerWithActions: RuntimeAdapterEventHandlerSelector = {
  kind: "component",
  sourceNodeId: "field",
  eventName: "change",
  // @ts-expect-error T14 transports only a selector; raw action programs remain T13/T16-owned
  actions: [{ type: "state.toggle", path: "enabled" }],
};
void handlerWithActions;

// @ts-expect-error behavior selectors require their exact source behavior identity
const behaviorWithoutId: RuntimeAdapterEventHandlerSelector = {
  kind: "behavior",
  sourceNodeId: "field",
  eventName: "reorder",
};
void behaviorWithoutId;

registerRuntimeAdapterBinding(handle, {
  kind: "component",
  identity,
  scope,
  handledEvents: [],
  snapshot: {} as RuntimeAdapterBridgesSnapshot,
  // @ts-expect-error runtime-instance identity is derived internally from the T07 identity
  runtimeInstanceId: "caller-chosen",
});

registerRuntimeAdapterBinding(handle, {
  kind: "component",
  identity,
  scope,
  handledEvents: [],
  snapshot: {} as RuntimeAdapterBridgesSnapshot,
  // @ts-expect-error platform targets and refs never cross the generic bridge
  target: { focus: () => undefined },
});

registerRuntimeAdapterBinding(handle, {
  kind: "behavior",
  owner: {} as RuntimeAdapterBindingTicket,
  behaviorId: "tasks.sort",
  capabilityId: "com.example.interactions/Sortable",
  handledEvents: ["reorder"],
  snapshot: {} as RuntimeAdapterBridgesSnapshot,
  // @ts-expect-error DESEN 0.1.0 defines no reachable behavior-command action
  commands: { invoke: () => ({ status: "succeeded" }) },
});

const commandWithContext: RuntimeAdapterComponentCommandPort = {
  invoke(request) {
    // @ts-expect-error adapter callbacks receive only the declared command and validated input
    void request.context;
    return { status: "denied" };
  },
};
void commandWithContext;
