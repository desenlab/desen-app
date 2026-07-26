import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  bindRuntimeAdapterBridges,
  createRuntimeAdapterBridgePorts,
  disposeRuntimeAdapterBridges,
  readRuntimeAdapterBridges,
  receiveRuntimeAdapterEvent,
  registerRuntimeAdapterBinding,
  RUNTIME_ADAPTER_BRIDGE_LIMITS,
  unregisterRuntimeAdapterBinding,
} from "../src/adapter-bridges.js";
import {
  disposeRuntimeCommandEventActions,
  executeRuntimeCommandEventAction,
  mountRuntimeCommandEventActions,
  readRuntimeCommandEventActions,
  registerRuntimeComponentCommandTarget,
} from "../src/command-event-actions.js";
import { createRuntimeCommandEventHostPorts } from "../src/command-event-ports.js";
import { createRuntimeHostPorts } from "../src/host-ports.js";
import { createRuntimeNodeIdentity } from "../src/node-identity.js";
import {
  createRuntimeRepeatedNodeIdentity,
  createRuntimeRepeatRootScope,
  materializeRuntimeRepeat,
} from "../src/repeat-materialization.js";
import { createRuntimeResolutionSnapshot } from "../src/value-resolution.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeAdapterBindingRegistrationResult,
  RuntimeAdapterBridgesSnapshot,
  RuntimeAdapterComponentCommandRequest,
  RuntimeAdapterEventTurnRequest,
  RuntimeAdapterNodeIdentity,
} from "../src/adapter-bridges.js";
import type {
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
} from "../src/command-event-actions.js";
import type { RuntimeHostPorts } from "../src/host-ports.js";
import type { RuntimeRepeatScope } from "../src/repeat-materialization.js";

const DOCUMENT_ID = "com.desen.adapter-bridges";
const REVISION = `sha256:${"d".repeat(64)}`;
const SURFACE_ID = "tasks";
const FIELD_NODE = "email-field";
const TEXT_FIELD = "com.example.ui/TextField";
const STACK_NODE = "tasks-stack";
const STACK = "com.example.ui/Stack";
const SORTABLE = "com.example.interactions/Sortable";

type MutableRecord = Record<string, unknown>;
type Registered = Extract<
  RuntimeAdapterBindingRegistrationResult,
  { readonly status: "registered" }
>;

interface FixtureOptions {
  readonly eventDispatch?: (request: RuntimeAdapterEventTurnRequest) => unknown;
  readonly limits?: Parameters<typeof createRuntimeAdapterBridgePorts>[0]["limits"];
  readonly catalogSet?: DesenValidatedExecutionCatalogSet;
  readonly staticComponents?: Readonly<Record<string, string>>;
}

interface Fixture {
  readonly bridge: ReturnType<typeof createRuntimeAdapterBridgePorts>;
  readonly bridgeSnapshot: RuntimeAdapterBridgesSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly commandHandle: RuntimeCommandEventActionsHandle;
  readonly commandSnapshot: RuntimeCommandEventActionsSnapshot;
  readonly hostPorts: RuntimeHostPorts;
}

function preparedCatalog(): DesenValidatedExecutionCatalogSet {
  const catalog = JSON.parse(JSON.stringify(frozenWebCatalog)) as MutableRecord;
  const validation = validateDesenExecutionCatalogSet([catalog]);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("Expected a prepared Catalog.");
  return validation.value;
}

function runtimeHostPorts(): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: () => ({
        status: "committed",
        record: {
          activeRevision: REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      }),
    },
    operations: { invoke: () => ({ status: "failed", errorCode: "unused" }) },
    resources: { load: () => ({ status: "failed", errorCode: "unused" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 0 },
    diagnostics: { report: () => undefined },
  });
}

function fixture(options: FixtureOptions = {}): Fixture {
  const catalogSet = options.catalogSet ?? preparedCatalog();
  const bridge = createRuntimeAdapterBridgePorts({
    eventTurns: {
      dispatch: (options.eventDispatch ?? (() => ({ status: "accepted" }))) as (
        request: RuntimeAdapterEventTurnRequest,
      ) => { status: "accepted" },
    },
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  const commandEventPorts = createRuntimeCommandEventHostPorts({
    commands: bridge.componentCommands,
    events: {
      validate: () => ({ status: "valid" }),
      emit: () => ({ status: "succeeded" }),
    },
  });
  const hostPorts = runtimeHostPorts();
  const commands = mountRuntimeCommandEventActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    staticComponents: options.staticComponents ?? {
      [FIELD_NODE]: TEXT_FIELD,
      [STACK_NODE]: STACK,
    },
    hostEvents: {},
    catalogSet,
    hostPorts,
    commandEventPorts,
  });
  expect(commands.status).toBe("mounted");
  if (commands.status !== "mounted") throw new TypeError("Expected T12 to mount.");
  const bound = bindRuntimeAdapterBridges(bridge.handle, {
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    catalogSet,
    commandEventActionsHandle: commands.handle,
    commandEventSnapshot: commands.snapshot,
  });
  expect(bound.status).toBe("bound");
  if (bound.status !== "bound") throw new TypeError("Expected bridge bind.");
  return {
    bridge,
    bridgeSnapshot: bound.snapshot,
    catalogSet,
    commandHandle: commands.handle,
    commandSnapshot: commands.snapshot,
    hostPorts,
  };
}

function resolution(state: Readonly<Record<string, unknown>> = {}) {
  return createRuntimeResolutionSnapshot({
    state: state as never,
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function baseIdentityAndScope(
  nodeId = FIELD_NODE,
  use = TEXT_FIELD,
): {
  readonly identity: RuntimeAdapterNodeIdentity;
  readonly scope: RuntimeRepeatScope;
} {
  const identity = createRuntimeNodeIdentity({
    documentId: DOCUMENT_ID,
    surfaceId: SURFACE_ID,
    nodeId,
    use,
  });
  expect(identity.status).toBe("created");
  if (identity.status !== "created") throw new TypeError("Expected node identity.");
  return {
    identity: identity.identity,
    scope: createRuntimeRepeatRootScope(resolution()),
  };
}

function registerStackComponent(
  target: Fixture,
  snapshot = target.bridgeSnapshot,
  options: {
    readonly handledEvents?: readonly string[];
    readonly invoke?: (request: RuntimeAdapterComponentCommandRequest) => unknown;
    readonly scope?: RuntimeRepeatScope;
  } = {},
): Registered {
  const defaults = baseIdentityAndScope(STACK_NODE, STACK);
  return registerComponent(target, snapshot, {
    ...options,
    handledEvents: options.handledEvents ?? [],
    identity: defaults.identity,
    scope: options.scope ?? defaults.scope,
  });
}

function registerComponent(
  target: Fixture,
  snapshot = target.bridgeSnapshot,
  options: {
    readonly handledEvents?: readonly string[];
    readonly invoke?: (request: RuntimeAdapterComponentCommandRequest) => unknown;
    readonly identity?: RuntimeAdapterNodeIdentity;
    readonly scope?: RuntimeRepeatScope;
  } = {},
): Registered {
  const defaults = baseIdentityAndScope();
  const result = registerRuntimeAdapterBinding(target.bridge.handle, {
    kind: "component",
    identity: options.identity ?? defaults.identity,
    scope: options.scope ?? defaults.scope,
    handledEvents: options.handledEvents ?? ["change"],
    commands: {
      invoke: (options.invoke ?? (() => ({ status: "succeeded" }))) as (
        request: RuntimeAdapterComponentCommandRequest,
      ) => { status: "succeeded" },
    },
    snapshot,
  });
  if (result.status !== "registered") {
    throw new TypeError(`Expected component registration: ${JSON.stringify(result)}`);
  }
  return result;
}

function registerBehavior(
  target: Fixture,
  owner: Registered,
  handledEvents: readonly string[] = ["reorder"],
): Registered {
  const result = registerRuntimeAdapterBinding(target.bridge.handle, {
    kind: "behavior",
    owner: owner.ticket,
    behaviorId: "tasks.sort",
    capabilityId: SORTABLE,
    handledEvents,
    snapshot: owner.snapshot,
  });
  expect(result.status).toBe("registered");
  if (result.status !== "registered") throw new TypeError("Expected behavior registration.");
  return result;
}

function currentCommandSnapshot(target: Fixture): RuntimeCommandEventActionsSnapshot {
  const read = readRuntimeCommandEventActions(target.commandHandle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected current T12 snapshot.");
  return read.snapshot;
}

describe("M04-T14 two-phase adapter bridge", () => {
  it("creates an unbound command port and binds only the exact T12 Catalog authority", () => {
    const eventTurns = { dispatch: () => ({ status: "accepted" as const }) };
    const created = createRuntimeAdapterBridgePorts({ eventTurns });
    expect(readRuntimeAdapterBridges(created.handle)).toEqual({ status: "unbound" });

    const target = fixture();
    expect(
      bindRuntimeAdapterBridges(target.bridge.handle, {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        catalogSet: target.catalogSet,
        commandEventActionsHandle: target.commandHandle,
        commandEventSnapshot: target.commandSnapshot,
      }),
    ).toEqual({ status: "invalid", reason: "already-bound" });

    const foreignCatalog = preparedCatalog();
    const foreign = createRuntimeAdapterBridgePorts({ eventTurns });
    expect(
      bindRuntimeAdapterBridges(foreign.handle, {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        catalogSet: foreignCatalog,
        commandEventActionsHandle: target.commandHandle,
        commandEventSnapshot: currentCommandSnapshot(target),
      }),
    ).toEqual({ status: "invalid", reason: "catalog-mismatch" });

    const wrongPortOwner = createRuntimeAdapterBridgePorts({ eventTurns });
    expect(
      bindRuntimeAdapterBridges(wrongPortOwner.handle, {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        catalogSet: target.catalogSet,
        commandEventActionsHandle: target.commandHandle,
        commandEventSnapshot: currentCommandSnapshot(target),
      }),
    ).toEqual({ status: "invalid", reason: "command-authority-invalid" });
  });

  it("makes disposal busy throughout hostile bind, register, event, and unregister reflection", () => {
    const bridge = createRuntimeAdapterBridgePorts({
      eventTurns: { dispatch: () => ({ status: "accepted" }) },
    });
    const catalogSet = preparedCatalog();
    const commandEventPorts = createRuntimeCommandEventHostPorts({
      commands: bridge.componentCommands,
      events: {
        validate: () => ({ status: "valid" }),
        emit: () => ({ status: "succeeded" }),
      },
    });
    const commands = mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: { [FIELD_NODE]: TEXT_FIELD, [STACK_NODE]: STACK },
      hostEvents: {},
      catalogSet,
      hostPorts: runtimeHostPorts(),
      commandEventPorts,
    });
    expect(commands.status).toBe("mounted");
    if (commands.status !== "mounted") throw new TypeError("Expected reflected T12 mount.");

    const attempts: string[] = [];
    const bindInput = new Proxy(
      {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        catalogSet,
        commandEventActionsHandle: commands.handle,
        commandEventSnapshot: commands.snapshot,
      },
      {
        getPrototypeOf(targetObject) {
          attempts.push(disposeRuntimeAdapterBridges(bridge.handle).status);
          return Reflect.getPrototypeOf(targetObject);
        },
      },
    );
    const bound = bindRuntimeAdapterBridges(bridge.handle, bindInput);
    expect(bound.status).toBe("bound");
    if (bound.status !== "bound") throw new TypeError("Expected reflected bridge bind.");

    const parts = baseIdentityAndScope();
    const registrationInput = new Proxy(
      {
        kind: "component" as const,
        identity: parts.identity,
        scope: parts.scope,
        handledEvents: ["change"],
        commands: { invoke: () => ({ status: "succeeded" as const }) },
        snapshot: bound.snapshot,
      },
      {
        getPrototypeOf(targetObject) {
          attempts.push(disposeRuntimeAdapterBridges(bridge.handle).status);
          return Reflect.getPrototypeOf(targetObject);
        },
      },
    );
    const component = registerRuntimeAdapterBinding(bridge.handle, registrationInput);
    expect(component.status).toBe("registered");
    if (component.status !== "registered") {
      throw new TypeError("Expected reflected component registration.");
    }

    const payload = new Proxy(
      { value: "reflected" },
      {
        ownKeys(targetObject) {
          attempts.push(disposeRuntimeAdapterBridges(bridge.handle).status);
          return Reflect.ownKeys(targetObject);
        },
      },
    );
    const eventInput = new Proxy(
      {
        ticket: component.ticket,
        eventName: "change",
        payload,
        snapshot: component.snapshot,
      },
      {
        getPrototypeOf(targetObject) {
          attempts.push(disposeRuntimeAdapterBridges(bridge.handle).status);
          return Reflect.getPrototypeOf(targetObject);
        },
      },
    );
    expect(receiveRuntimeAdapterEvent(bridge.handle, eventInput).status).toBe("dispatched");

    const unregistrationInput = new Proxy(
      { ticket: component.ticket, snapshot: component.snapshot },
      {
        getPrototypeOf(targetObject) {
          attempts.push(disposeRuntimeAdapterBridges(bridge.handle).status);
          return Reflect.getPrototypeOf(targetObject);
        },
      },
    );
    expect(unregisterRuntimeAdapterBinding(bridge.handle, unregistrationInput).status).toBe(
      "unregistered",
    );
    expect(attempts.length).toBeGreaterThanOrEqual(4);
    expect(attempts.every((status) => status === "busy")).toBe(true);
  });

  it("derives the component runtime id from the exact factory identity and mirrors it into T12", () => {
    const target = fixture();
    const { identity, scope } = baseIdentityAndScope();
    const registered = registerComponent(target, target.bridgeSnapshot, { identity, scope });

    expect(registered.binding).toMatchObject({
      kind: "component",
      sourceNodeId: FIELD_NODE,
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: identity.key,
      registrationGeneration: 0,
    });
    expect(currentCommandSnapshot(target).liveTargets[FIELD_NODE]?.instances).toEqual([
      { runtimeInstanceId: identity.key, registrationGeneration: 0 },
    ]);
    expect(Object.isFrozen(registered.snapshot)).toBe(true);
    expect(Object.isFrozen(registered.snapshot.bindings)).toBe(true);
  });

  it("validates, detaches, and dispatches one declared component event with an inert selector", () => {
    const requests: RuntimeAdapterEventTurnRequest[] = [];
    const target = fixture({
      eventDispatch(request) {
        requests.push(request);
        return { status: "accepted" };
      },
    });
    const component = registerComponent(target);
    const callerPayload = { value: "hello" };
    const received = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: component.ticket,
      eventName: "change",
      payload: callerPayload,
      snapshot: component.snapshot,
    });

    expect(received.status).toBe("dispatched");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      eventId: "adapter-event-0",
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: component.binding.runtimeInstanceId,
      handler: { kind: "component", sourceNodeId: FIELD_NODE, eventName: "change" },
      payload: { value: "hello" },
      item: {},
      repeatKeys: [],
    });
    expect(requests[0]?.payload).not.toBe(callerPayload);
    expect(Object.isFrozen(requests[0]?.payload)).toBe(true);
    callerPayload.value = "mutated";
    expect(requests[0]?.payload).toEqual({ value: "hello" });
  });

  it("returns exact payload diagnostics and never dispatches an unknown or invalid event", () => {
    const dispatch = vi.fn(() => ({ status: "accepted" as const }));
    const target = fixture({ eventDispatch: dispatch });
    const component = registerComponent(target);
    let payloadDescriptorReads = 0;
    const unknownInput = new Proxy(
      {
        ticket: component.ticket,
        eventName: "teleport",
        payload: { value: "hidden" },
        snapshot: component.snapshot,
      },
      {
        getOwnPropertyDescriptor(targetObject, property) {
          if (property === "payload") {
            payloadDescriptorReads += 1;
            throw new TypeError("unknown payload descriptor must not be inspected");
          }
          return Reflect.getOwnPropertyDescriptor(targetObject, property);
        },
      },
    );
    const unknown = receiveRuntimeAdapterEvent(target.bridge.handle, unknownInput);
    expect(unknown.status).toBe("unknown-event");
    expect(payloadDescriptorReads).toBe(0);

    const invalid = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: component.ticket,
      eventName: "change",
      payload: { value: 42 },
      snapshot: component.snapshot,
    });
    expect(invalid.status).toBe("payload-invalid");
    if (invalid.status === "payload-invalid") {
      expect(
        invalid.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.pointer]),
      ).toEqual([["EVENT_PAYLOAD_INVALID", "/value"]]);
    }
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("rejects T12 authority drift before observing a known payload or invoking the event sink", () => {
    const dispatch = vi.fn(() => ({ status: "accepted" as const }));
    const target = fixture({ eventDispatch: dispatch });
    const component = registerComponent(target);
    const drift = registerRuntimeComponentCommandTarget(target.commandHandle, {
      sourceNodeId: FIELD_NODE,
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: "foreign-live-instance",
      snapshot: currentCommandSnapshot(target),
    });
    expect(drift.status).toBe("registered");
    let payloadDescriptorReads = 0;
    const event = new Proxy(
      {
        ticket: component.ticket,
        eventName: "change",
        payload: { value: "must-not-be-read" },
        snapshot: component.snapshot,
      },
      {
        getOwnPropertyDescriptor(targetObject, property) {
          if (property === "payload") {
            payloadDescriptorReads += 1;
            throw new TypeError("drifted authority must reject before payload observation");
          }
          return Reflect.getOwnPropertyDescriptor(targetObject, property);
        },
      },
    );
    expect(receiveRuntimeAdapterEvent(target.bridge.handle, event)).toEqual({
      status: "invalid-command-authority",
    });
    expect(payloadDescriptorReads).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("validates declared unhandled events but emits no event turn", () => {
    const dispatch = vi.fn(() => ({ status: "accepted" as const }));
    const target = fixture({ eventDispatch: dispatch });
    const component = registerComponent(target, target.bridgeSnapshot, { handledEvents: [] });
    const result = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: component.ticket,
      eventName: "change",
      payload: { value: "accepted" },
      snapshot: component.snapshot,
    });
    expect(result).toEqual({
      status: "validated-unhandled",
      payload: { value: "accepted" },
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("keeps payload-shaped ValueSpec names inert and contains turn-port failures", () => {
    const catalog = JSON.parse(JSON.stringify(frozenWebCatalog)) as MutableRecord;
    const components = catalog.components as MutableRecord;
    const textField = components[TEXT_FIELD] as MutableRecord;
    const events = textField.events as MutableRecord;
    const change = events.change as MutableRecord;
    change.payloadSchema = {
      type: "object",
      additionalProperties: false,
      required: ["$ref"],
      properties: { $ref: { type: "string" } },
    };
    const validation = validateDesenExecutionCatalogSet([catalog]);
    expect(validation.valid).toBe(true);
    if (!validation.valid) throw new TypeError("Expected modified Catalog.");
    const target = fixture({
      catalogSet: validation.value,
      eventDispatch: () => Promise.resolve({ status: "accepted" }),
    });
    const component = registerComponent(target);
    expect(
      receiveRuntimeAdapterEvent(target.bridge.handle, {
        ticket: component.ticket,
        eventName: "change",
        payload: { $ref: "state.secret" },
        snapshot: component.snapshot,
      }),
    ).toEqual({ status: "bridge-failed", eventId: "adapter-event-0" });
  });

  it("preserves the exact validator payload limits at the live adapter boundary", () => {
    const catalog = JSON.parse(JSON.stringify(frozenWebCatalog)) as MutableRecord;
    const components = catalog.components as MutableRecord;
    const textField = components[TEXT_FIELD] as MutableRecord;
    const events = textField.events as MutableRecord;
    const change = events.change as MutableRecord;
    change.payloadSchema = {};
    const validation = validateDesenExecutionCatalogSet([catalog]);
    expect(validation.valid).toBe(true);
    if (!validation.valid) throw new TypeError("Expected open event payload Catalog.");
    const target = fixture({ catalogSet: validation.value });
    const component = registerComponent(target);
    const receive = (payload: unknown) =>
      receiveRuntimeAdapterEvent(target.bridge.handle, {
        ticket: component.ticket,
        eventName: "change",
        payload,
        snapshot: component.snapshot,
      });
    const nested = (depth: number): unknown => {
      let value: unknown = null;
      for (let index = 0; index < depth; index += 1) value = [value];
      return value;
    };

    expect(receive(nested(128)).status).toBe("dispatched");
    expect(receive(nested(129)).status).toBe("payload-invalid");
    expect(receive(Array.from({ length: 4_095 }, () => null)).status).toBe("dispatched");
    expect(receive(Array.from({ length: 4_096 }, () => null)).status).toBe("payload-invalid");
    expect(receive("x".repeat(1_048_576)).status).toBe("dispatched");
    expect(receive("x".repeat(1_048_577)).status).toBe("payload-invalid");
  });

  it("allows event reentry so the later T13 sink can preserve FIFO admission", () => {
    const eventIds: string[] = [];
    const transitionStatuses: string[] = [];
    let nested: ReturnType<typeof receiveRuntimeAdapterEvent> | undefined;
    let reentered = false;
    const target = fixture({
      eventDispatch(request) {
        eventIds.push(request.eventId);
        if (!reentered) {
          reentered = true;
          transitionStatuses.push(
            unregisterRuntimeAdapterBinding(target.bridge.handle, {
              ticket: component.ticket,
              snapshot: component.snapshot,
            }).status,
            disposeRuntimeAdapterBridges(target.bridge.handle).status,
          );
          nested = receiveRuntimeAdapterEvent(target.bridge.handle, {
            ticket: component.ticket,
            eventName: "change",
            payload: { value: "nested" },
            snapshot: component.snapshot,
          });
        }
        return { status: "accepted" };
      },
    });
    const component = registerComponent(target);
    const outer = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: component.ticket,
      eventName: "change",
      payload: { value: "outer" },
      snapshot: component.snapshot,
    });
    expect(outer.status).toBe("dispatched");
    expect(nested?.status).toBe("dispatched");
    expect(eventIds).toEqual(["adapter-event-0", "adapter-event-1"]);
    expect(transitionStatuses).toEqual(["busy", "busy"]);
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot: component.snapshot,
    });
  });

  it("keeps registry disposal and mutation busy throughout hostile payload reflection", () => {
    const dispatch = vi.fn(() => ({ status: "accepted" as const }));
    const target = fixture({ eventDispatch: dispatch });
    const component = registerComponent(target);
    let attempted = false;
    const payload = new Proxy(
      { value: "x" },
      {
        ownKeys(targetObject) {
          if (!attempted) {
            attempted = true;
            expect(
              unregisterRuntimeAdapterBinding(target.bridge.handle, {
                ticket: component.ticket,
                snapshot: component.snapshot,
              }).status,
            ).toBe("busy");
            expect(disposeRuntimeAdapterBridges(target.bridge.handle).status).toBe("busy");
          }
          return Reflect.ownKeys(targetObject);
        },
      },
    );
    expect(
      receiveRuntimeAdapterEvent(target.bridge.handle, {
        ticket: component.ticket,
        eventName: "change",
        payload,
        snapshot: component.snapshot,
      }).status,
    ).toBe("dispatched");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});

describe("M04-T14 behavior ownership and repeat identity", () => {
  it("dispatches behavior events with their exact owner scope and inert behavior selector", () => {
    const requests: RuntimeAdapterEventTurnRequest[] = [];
    const target = fixture({
      eventDispatch(request) {
        requests.push(request);
        return { status: "accepted" };
      },
    });
    const component = registerStackComponent(target);
    const behavior = registerBehavior(target, component);
    const result = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: behavior.ticket,
      eventName: "reorder",
      payload: { fromIndex: 0, toIndex: 1, itemKey: "a" },
      snapshot: behavior.snapshot,
    });
    expect(result.status).toBe("dispatched");
    expect(requests[0]).toMatchObject({
      capabilityKind: "behavior",
      capabilityId: SORTABLE,
      handler: {
        kind: "behavior",
        sourceNodeId: STACK_NODE,
        behaviorId: "tasks.sort",
        eventName: "reorder",
      },
    });
    expect(behavior.binding.runtimeInstanceId).toBe(
      JSON.stringify([component.binding.runtimeInstanceId, "behavior", "tasks.sort"]),
    );
  });

  it("rejects an arbitrary behavior capability before it can become a live binding", () => {
    const target = fixture();
    const component = registerStackComponent(target);
    expect(
      registerRuntimeAdapterBinding(target.bridge.handle, {
        kind: "behavior",
        owner: component.ticket,
        behaviorId: "tasks.sort",
        capabilityId: "com.example.interactions/Unknown",
        handledEvents: ["reorder"],
        snapshot: component.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "unknown-capability" });
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot: component.snapshot,
    });
  });

  it("enforces Catalog attachTo compatibility and bound T12 authority before behavior effects", () => {
    const incompatible = fixture();
    const field = registerComponent(incompatible);
    expect(
      registerRuntimeAdapterBinding(incompatible.bridge.handle, {
        kind: "behavior",
        owner: field.ticket,
        behaviorId: "tasks.sort",
        capabilityId: SORTABLE,
        handledEvents: ["reorder"],
        snapshot: field.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "incompatible-owner" });

    const drifted = fixture();
    const stack = registerStackComponent(drifted);
    const drift = registerRuntimeComponentCommandTarget(drifted.commandHandle, {
      sourceNodeId: FIELD_NODE,
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: "foreign-live-instance",
      snapshot: currentCommandSnapshot(drifted),
    });
    expect(drift.status).toBe("registered");
    expect(
      registerRuntimeAdapterBinding(drifted.bridge.handle, {
        kind: "behavior",
        owner: stack.ticket,
        behaviorId: "tasks.sort",
        capabilityId: SORTABLE,
        handledEvents: ["reorder"],
        snapshot: stack.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "invalid-command-authority" });
    expect(readRuntimeAdapterBridges(drifted.bridge.handle)).toEqual({
      status: "read",
      snapshot: stack.snapshot,
    });
  });

  it("cascades behaviors when their owner component unregisters and rejects ghost events first", () => {
    const target = fixture();
    const component = registerStackComponent(target);
    const behavior = registerBehavior(target, component);
    const removed = unregisterRuntimeAdapterBinding(target.bridge.handle, {
      ticket: component.ticket,
      snapshot: behavior.snapshot,
    });
    expect(removed.status).toBe("unregistered");
    if (removed.status !== "unregistered") throw new TypeError("Expected unregistration.");
    expect(removed.cascadedBehaviors).toBe(1);

    let payloadReads = 0;
    const payload = new Proxy(
      { fromIndex: 0, toIndex: 1, itemKey: "a" },
      {
        ownKeys(targetObject) {
          payloadReads += 1;
          return Reflect.ownKeys(targetObject);
        },
      },
    );
    expect(
      receiveRuntimeAdapterEvent(target.bridge.handle, {
        ticket: behavior.ticket,
        eventName: "reorder",
        payload,
        snapshot: removed.snapshot,
      }),
    ).toEqual({ status: "stale-ticket" });
    expect(payloadReads).toBe(0);
  });

  it("uses the T07 repeat identity unchanged and preserves exact item aliases", () => {
    const requests: RuntimeAdapterEventTurnRequest[] = [];
    const target = fixture({
      eventDispatch(request) {
        requests.push(request);
        return { status: "accepted" };
      },
    });
    const root = createRuntimeRepeatRootScope(resolution({ tasks: [{ id: "a", label: "First" }] }));
    const repeated = materializeRuntimeRepeat(root, {
      items: { $ref: "state.tasks" },
      as: "task",
      key: { $ref: "item.task.id" },
    });
    expect(repeated.status).toBe("materialized");
    if (repeated.status !== "materialized") throw new TypeError("Expected repeat materialization.");
    const scope = repeated.instances[0]?.scope;
    if (scope === undefined) throw new TypeError("Expected repeated scope.");
    const identity = createRuntimeRepeatedNodeIdentity(
      {
        documentId: DOCUMENT_ID,
        surfaceId: SURFACE_ID,
        nodeId: FIELD_NODE,
        use: TEXT_FIELD,
      },
      scope,
    );
    expect(identity.status).toBe("created");
    if (identity.status !== "created") throw new TypeError("Expected repeated identity.");
    const component = registerComponent(target, target.bridgeSnapshot, {
      identity: identity.identity,
      scope,
    });
    expect(component.binding.runtimeInstanceId).toBe(identity.identity.key);
    const result = receiveRuntimeAdapterEvent(target.bridge.handle, {
      ticket: component.ticket,
      eventName: "change",
      payload: { value: "x" },
      snapshot: component.snapshot,
    });
    expect(result.status).toBe("dispatched");
    expect(requests[0]?.item).toEqual({ task: { id: "a", label: "First" } });
    expect(requests[0]?.repeatKeys).toEqual(["a"]);
  });
});

describe("M04-T14 command containment, finite limits, and disposal", () => {
  it("routes only the exact T12-selected live component into one generic adapter callback", () => {
    const invocations: RuntimeAdapterComponentCommandRequest[] = [];
    const target = fixture();
    const component = registerComponent(target, target.bridgeSnapshot, {
      invoke(request) {
        invocations.push(request);
        return { status: "succeeded" };
      },
    });
    const commandResult = executeRuntimeCommandEventAction(
      target.commandHandle,
      { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
      resolution(),
      currentCommandSnapshot(target),
    );
    expect(commandResult.status).toBe("command-succeeded");
    expect(invocations).toEqual([{ command: "focus", input: {} }]);
    expect(Object.isFrozen(invocations[0])).toBe(true);
    expect(Object.isFrozen(invocations[0]?.input)).toBe(true);
    expect(component.binding.kind).toBe("component");

    expect(
      target.bridge.componentCommands.invoke({
        context: {
          documentId: DOCUMENT_ID,
          revision: REVISION,
          surfaceId: SURFACE_ID,
          requestId: "forged-direct-call",
        },
        sourceNodeId: FIELD_NODE,
        runtimeInstanceId: component.binding.runtimeInstanceId,
        capabilityId: TEXT_FIELD,
        command: "focus",
        input: {},
      }),
    ).toEqual({ status: "denied" });
    expect(invocations).toHaveLength(1);
  });

  it("rejects a normalized request from a second T12 port owner sharing the same callback", () => {
    const invocations = vi.fn(() => ({ status: "succeeded" as const }));
    const target = fixture();
    const component = registerComponent(target, target.bridgeSnapshot, { invoke: invocations });
    const foreignPorts = createRuntimeCommandEventHostPorts({
      commands: target.bridge.componentCommands,
      events: {
        validate: () => ({ status: "valid" }),
        emit: () => ({ status: "succeeded" }),
      },
    });
    const foreign = mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: { [FIELD_NODE]: TEXT_FIELD },
      hostEvents: {},
      catalogSet: target.catalogSet,
      hostPorts: runtimeHostPorts(),
      commandEventPorts: foreignPorts,
    });
    expect(foreign.status).toBe("mounted");
    if (foreign.status !== "mounted") throw new TypeError("Expected foreign T12 mount.");
    const registered = registerRuntimeComponentCommandTarget(foreign.handle, {
      sourceNodeId: FIELD_NODE,
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: component.binding.runtimeInstanceId,
      snapshot: foreign.snapshot,
    });
    expect(registered.status).toBe("registered");
    if (registered.status !== "registered") throw new TypeError("Expected foreign target.");

    expect(
      executeRuntimeCommandEventAction(
        foreign.handle,
        { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
        resolution(),
        registered.snapshot,
      ).status,
    ).toBe("command-denied");
    expect(invocations).not.toHaveBeenCalled();

    expect(
      executeRuntimeCommandEventAction(
        target.commandHandle,
        { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
        resolution(),
        currentCommandSnapshot(target),
      ).status,
    ).toBe("command-succeeded");
    expect(invocations).toHaveBeenCalledTimes(1);
  });

  it("keeps bridge and T12 authority live when a command callback requests disposal", () => {
    let disposal: ReturnType<typeof disposeRuntimeAdapterBridges> | undefined;
    const target = fixture();
    const component = registerComponent(target, target.bridgeSnapshot, {
      invoke() {
        disposal = disposeRuntimeAdapterBridges(target.bridge.handle);
        return { status: "succeeded" };
      },
    });
    expect(
      executeRuntimeCommandEventAction(
        target.commandHandle,
        { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
        resolution(),
        currentCommandSnapshot(target),
      ).status,
    ).toBe("command-succeeded");
    expect(disposal).toEqual({
      status: "busy",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot: component.snapshot,
    });
    expect(currentCommandSnapshot(target).liveTargets[FIELD_NODE]?.instances).toHaveLength(1);
  });

  it("keeps command reentry fenced while reflecting a hostile adapter result", () => {
    const attempts: unknown[] = [];
    const target = fixture();
    const live: { behavior?: Registered; stack?: Registered } = {};
    const component = registerComponent(target, target.bridgeSnapshot, {
      invoke() {
        return new Proxy(
          { status: "succeeded" as const },
          {
            getPrototypeOf(result) {
              const behavior = live.behavior;
              const stack = live.stack;
              if (behavior === undefined || stack === undefined) {
                throw new TypeError("Expected live hostile-reflection fixtures.");
              }
              attempts.push(
                unregisterRuntimeAdapterBinding(target.bridge.handle, {
                  ticket: behavior.ticket,
                  snapshot: behavior.snapshot,
                }),
              );
              attempts.push(
                registerRuntimeAdapterBinding(target.bridge.handle, {
                  kind: "behavior",
                  owner: stack.ticket,
                  behaviorId: "tasks.sort.reentrant",
                  capabilityId: SORTABLE,
                  handledEvents: ["reorder"],
                  snapshot: behavior.snapshot,
                }),
              );
              attempts.push(disposeRuntimeAdapterBridges(target.bridge.handle));
              return Reflect.getPrototypeOf(result);
            },
          },
        );
      },
    });
    const stack = registerStackComponent(target, component.snapshot);
    live.stack = stack;
    const behavior = registerBehavior(target, stack);
    live.behavior = behavior;

    expect(
      executeRuntimeCommandEventAction(
        target.commandHandle,
        { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
        resolution(),
        currentCommandSnapshot(target),
      ).status,
    ).toBe("command-succeeded");
    expect(attempts).toEqual([
      { status: "busy" },
      { status: "busy" },
      { status: "busy", disposedComponents: 0, disposedBehaviors: 0 },
    ]);
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot: behavior.snapshot,
    });
    expect(behavior.snapshot.bindings).toHaveLength(3);
  });

  it.each([
    [
      "throw",
      () => {
        throw new Error("secret");
      },
    ],
    ["promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "maybe" })],
  ])("contains a %s command callback as an adapter failure", (_label, invoke) => {
    const target = fixture();
    registerComponent(target, target.bridgeSnapshot, { invoke });
    const result = executeRuntimeCommandEventAction(
      target.commandHandle,
      { type: "component.command", target: FIELD_NODE, command: "focus", input: {} },
      resolution(),
      currentCommandSnapshot(target),
    );
    expect(result.status).toBe("adapter-failed");
  });

  it("enforces lower-only aggregate binding and handler limits before T12 effects", () => {
    expect(RUNTIME_ADAPTER_BRIDGE_LIMITS).toEqual({
      maxLiveBindings: 5_000,
      maxEventHandlerBindings: 5_000,
      maxRegistrationGeneration: Number.MAX_SAFE_INTEGER,
      maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
      maxEventGeneration: Number.MAX_SAFE_INTEGER,
      maxRetainedIdentifierCodeUnits: 1_048_576,
      maxRetainedScopeJsonOccurrences: 262_144,
      maxRetainedScopeCodeUnits: 1_048_576,
      maxRuntimeInstanceIdCodeUnits: 1_024,
    });
    expect(() =>
      createRuntimeAdapterBridgePorts({
        eventTurns: { dispatch: () => ({ status: "accepted" }) },
        limits: { maxRetainedScopeJsonOccurrences: 262_145 },
      }),
    ).toThrow(TypeError);
    const target = fixture({ limits: { maxLiveBindings: 1 } });
    const component = registerStackComponent(target);
    expect(
      registerRuntimeAdapterBinding(target.bridge.handle, {
        kind: "behavior",
        owner: component.ticket,
        behaviorId: "tasks.sort",
        capabilityId: SORTABLE,
        handledEvents: [],
        snapshot: component.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "registry-limit" });
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot: component.snapshot,
    });

    const handlerBound = fixture({ limits: { maxEventHandlerBindings: 1 } });
    const handlerOwner = registerStackComponent(handlerBound);
    const handler = registerBehavior(handlerBound, handlerOwner);
    const fieldParts = baseIdentityAndScope();
    expect(
      registerRuntimeAdapterBinding(handlerBound.bridge.handle, {
        kind: "component",
        identity: fieldParts.identity,
        scope: fieldParts.scope,
        handledEvents: ["change"],
        commands: {
          invoke: () => ({ status: "succeeded" }),
        },
        snapshot: handler.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "event-handler-limit" });
    expect(readRuntimeAdapterBridges(handlerBound.bridge.handle)).toEqual({
      status: "read",
      snapshot: handler.snapshot,
    });
  });

  it("reaches all 5,000 empty-scope component bindings before rejecting binding 5,001", () => {
    const staticComponents = Object.freeze(
      Object.fromEntries(
        Array.from({ length: 5_000 }, (_, index) => [
          `field-${index.toString().padStart(4, "0")}`,
          TEXT_FIELD,
        ]),
      ),
    );
    const target = fixture({ staticComponents });
    const scope = createRuntimeRepeatRootScope(resolution());
    let snapshot = target.bridgeSnapshot;
    for (let index = 0; index < 5_000; index += 1) {
      const nodeId = `field-${index.toString().padStart(4, "0")}`;
      const identity = createRuntimeNodeIdentity({
        documentId: DOCUMENT_ID,
        surfaceId: SURFACE_ID,
        nodeId,
        use: TEXT_FIELD,
      });
      if (identity.status !== "created") {
        throw new TypeError(`Expected identity ${index}.`);
      }
      const registered = registerRuntimeAdapterBinding(target.bridge.handle, {
        kind: "component",
        identity: identity.identity,
        scope,
        handledEvents: [],
        snapshot,
      });
      if (registered.status !== "registered") {
        throw new TypeError(`Expected registration ${index}: ${JSON.stringify(registered)}`);
      }
      snapshot = registered.snapshot;
    }
    expect(snapshot.bindings).toHaveLength(5_000);

    const overflowIdentity = createRuntimeNodeIdentity({
      documentId: DOCUMENT_ID,
      surfaceId: SURFACE_ID,
      nodeId: "field-overflow",
      use: TEXT_FIELD,
    });
    expect(overflowIdentity.status).toBe("created");
    if (overflowIdentity.status !== "created") throw new TypeError("Expected overflow identity.");
    expect(
      registerRuntimeAdapterBinding(target.bridge.handle, {
        kind: "component",
        identity: overflowIdentity.identity,
        scope,
        handledEvents: [],
        snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "registry-limit" });
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "read",
      snapshot,
    });
  }, 120_000);

  it("reserves future snapshots and bounds detached scope projections without double charging behaviors", () => {
    const noFutureSnapshot = fixture({ limits: { maxSnapshotGeneration: 1 } });
    const stackParts = baseIdentityAndScope(STACK_NODE, STACK);
    expect(
      registerRuntimeAdapterBinding(noFutureSnapshot.bridge.handle, {
        kind: "component",
        identity: stackParts.identity,
        scope: stackParts.scope,
        handledEvents: [],
        snapshot: noFutureSnapshot.bridgeSnapshot,
      }),
    ).toEqual({ status: "invalid", reason: "snapshot-limit" });
    expect(currentCommandSnapshot(noFutureSnapshot).liveTargets).toEqual({});

    const bounded = fixture({
      limits: {
        maxRetainedScopeJsonOccurrences: 3,
        maxRetainedScopeCodeUnits: 28,
      },
    });
    const component = registerStackComponent(bounded);
    const behavior = registerBehavior(bounded, component);
    const removed = unregisterRuntimeAdapterBinding(bounded.bridge.handle, {
      ticket: component.ticket,
      snapshot: behavior.snapshot,
    });
    expect(removed.status).toBe("unregistered");
    if (removed.status !== "unregistered") throw new TypeError("Expected bounded cleanup.");
    expect(registerStackComponent(bounded, removed.snapshot).status).toBe("registered");

    const aggregateBound = fixture({ limits: { maxRetainedScopeJsonOccurrences: 5 } });
    const aggregateFirst = registerComponent(aggregateBound, aggregateBound.bridgeSnapshot, {
      handledEvents: [],
    });
    const aggregateSecond = baseIdentityAndScope(STACK_NODE, STACK);
    expect(
      registerRuntimeAdapterBinding(aggregateBound.bridge.handle, {
        kind: "component",
        identity: aggregateSecond.identity,
        scope: aggregateSecond.scope,
        handledEvents: [],
        snapshot: aggregateFirst.snapshot,
      }),
    ).toEqual({ status: "invalid", reason: "retained-limit" });
    expect(readRuntimeAdapterBridges(aggregateBound.bridge.handle)).toEqual({
      status: "read",
      snapshot: aggregateFirst.snapshot,
    });
    expect(currentCommandSnapshot(aggregateBound).liveTargets[STACK_NODE]).toBeUndefined();

    const tooSmall = fixture({ limits: { maxRetainedScopeJsonOccurrences: 2 } });
    const tooSmallParts = baseIdentityAndScope(STACK_NODE, STACK);
    expect(
      registerRuntimeAdapterBinding(tooSmall.bridge.handle, {
        kind: "component",
        identity: tooSmallParts.identity,
        scope: tooSmallParts.scope,
        handledEvents: [],
        snapshot: tooSmall.bridgeSnapshot,
      }),
    ).toEqual({ status: "invalid", reason: "retained-limit" });
    expect(currentCommandSnapshot(tooSmall).liveTargets).toEqual({});
  });

  it("uses current T12 cleanup authority after drift and locally revokes after lower disposal", () => {
    const drifted = fixture();
    const component = registerComponent(drifted);
    const external = registerRuntimeComponentCommandTarget(drifted.commandHandle, {
      sourceNodeId: FIELD_NODE,
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: "external-instance",
      snapshot: currentCommandSnapshot(drifted),
    });
    expect(external.status).toBe("registered");
    expect(disposeRuntimeAdapterBridges(drifted.bridge.handle)).toEqual({
      status: "disposed",
      disposedComponents: 1,
      disposedBehaviors: 0,
    });
    expect(currentCommandSnapshot(drifted).liveTargets[FIELD_NODE]?.instances).toEqual([
      { runtimeInstanceId: "external-instance", registrationGeneration: 1 },
    ]);
    expect(readRuntimeAdapterBridges(drifted.bridge.handle)).toEqual({ status: "disposed" });
    expect(component.binding.kind).toBe("component");

    const lowerDisposed = fixture();
    const stack = registerStackComponent(lowerDisposed);
    const behavior = registerBehavior(lowerDisposed, stack);
    expect(disposeRuntimeCommandEventActions(lowerDisposed.commandHandle)).toEqual({
      status: "disposed",
      disposedTargets: 1,
    });
    expect(disposeRuntimeAdapterBridges(lowerDisposed.bridge.handle)).toEqual({
      status: "disposed",
      disposedComponents: 1,
      disposedBehaviors: 1,
    });
    expect(readRuntimeAdapterBridges(lowerDisposed.bridge.handle)).toEqual({
      status: "disposed",
    });
    expect(
      receiveRuntimeAdapterEvent(lowerDisposed.bridge.handle, {
        ticket: behavior.ticket,
        eventName: "reorder",
        payload: { fromIndex: 0, toIndex: 1, itemKey: "a" },
        snapshot: behavior.snapshot,
      }),
    ).toEqual({ status: "disposed" });
    expect(
      lowerDisposed.bridge.componentCommands.invoke({
        context: {
          documentId: DOCUMENT_ID,
          revision: REVISION,
          surfaceId: SURFACE_ID,
          requestId: "late-after-tombstone",
        },
        sourceNodeId: STACK_NODE,
        runtimeInstanceId: stack.binding.runtimeInstanceId,
        capabilityId: STACK,
        command: "none",
        input: {},
      }),
    ).toEqual({ status: "denied" });
  });

  it("disposes idempotently, unregisters T12 targets, and contains all late work", () => {
    const target = fixture();
    const component = registerStackComponent(target);
    registerBehavior(target, component);
    expect(disposeRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "disposed",
      disposedComponents: 1,
      disposedBehaviors: 1,
    });
    expect(currentCommandSnapshot(target).liveTargets).toEqual({});
    expect(readRuntimeAdapterBridges(target.bridge.handle)).toEqual({ status: "disposed" });
    expect(disposeRuntimeAdapterBridges(target.bridge.handle)).toEqual({
      status: "already-disposed",
      disposedComponents: 0,
      disposedBehaviors: 0,
    });
    expect(
      receiveRuntimeAdapterEvent(target.bridge.handle, {
        ticket: component.ticket,
        eventName: "change",
        payload: { value: "late" },
        snapshot: component.snapshot,
      }),
    ).toEqual({ status: "disposed" });
  });
});
