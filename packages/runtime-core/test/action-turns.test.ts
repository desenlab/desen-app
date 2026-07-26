import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  disposeRuntimeActionTurns,
  executeRuntimeActionTurn,
  mountRuntimeActionTurns,
  prepareRuntimeActionProgram,
  RUNTIME_ACTION_TURN_LIMITS,
} from "../src/action-turns.js";
import { createRuntimeCommandEventHostPorts } from "../src/command-event-ports.js";
import {
  mountRuntimeCommandEventActions,
  readRuntimeCommandEventActions,
  registerRuntimeComponentCommandTarget,
} from "../src/command-event-actions.js";
import { createRuntimeHostPorts } from "../src/host-ports.js";
import {
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
  writeRuntimeSurfaceState,
} from "../src/local-state.js";
import {
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
} from "../src/operation-lifecycle.js";
import {
  finalizeRuntimeOperationActionSettlement,
  mountRuntimeOperationResourceActions,
} from "../src/operation-resource-actions.js";
import {
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
} from "../src/resource-lifecycle.js";
import { mountRuntimeStateNavigationActions } from "../src/state-navigation-actions.js";
import { createRuntimeResolutionSnapshot } from "../src/value-resolution.js";

import type { DesenDiagnostic } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeActionTurnCompletion,
  RuntimeActionTurnLimitProfile,
  RuntimeActionTurnProgramPreparationResult,
  RuntimeActionTurnsHandle,
  RuntimeActionTurnsMountInput,
} from "../src/action-turns.js";
import type { RuntimeComponentCommandAction } from "../src/command-event-actions.js";
import type {
  RuntimeComponentCommandHostRequest,
  RuntimeHostEventRequest,
} from "../src/command-event-ports.js";
import type {
  RuntimeHostPorts,
  RuntimeNavigationRequest,
  RuntimeOperationRequest,
  RuntimeResourceRequest,
  RuntimeTokenRequest,
} from "../src/host-ports.js";
import type {
  RuntimeOperationActionSettlementDescriptor,
  RuntimeOperationInvokeAction,
} from "../src/operation-resource-actions.js";
import type { RuntimeResolutionSnapshot } from "../src/value-resolution.js";

const DOCUMENT_ID = "https://desen.app/tests/action-turns";
const REVISION = `sha256:${"d".repeat(64)}`;
const SURFACE_ID = "sign-in";
const NEXT_SURFACE_ID = "home";
const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";
const TEXT_FIELD = "com.example.ui/TextField";
const FIELD_NODE = "email-field";
const HOST_EVENT = "action-turn.saved";
const HOST_EVENT_CONTRACT = "action-turn.saved.v1";
const VALID_INPUT = Object.freeze({
  email: "person@example.com",
  password: "secret",
});
const VALID_OUTPUT = Object.freeze({ userId: "user-1" });
const STORE_OUTPUT = Object.freeze({ items: Object.freeze([]), bounds: Object.freeze({}) });

type MountedState = Extract<ReturnType<typeof mountRuntimeSurfaceState>, { status: "mounted" }>;
type MountedResources = Extract<
  ReturnType<typeof mountRuntimeSurfaceResources>,
  { status: "mounted" }
>;
type MountedOperations = Extract<
  ReturnType<typeof mountRuntimeSurfaceOperations>,
  { status: "mounted" }
>;
type MountedStateActions = Extract<
  ReturnType<typeof mountRuntimeStateNavigationActions>,
  { status: "mounted" }
>;
type MountedOperationActions = Extract<
  ReturnType<typeof mountRuntimeOperationResourceActions>,
  { status: "mounted" }
>;
type MountedCommandActions = Extract<
  ReturnType<typeof mountRuntimeCommandEventActions>,
  { status: "mounted" }
>;
type MountedTurns = Extract<ReturnType<typeof mountRuntimeActionTurns>, { status: "mounted" }>;
type AcceptedTurn = Extract<
  ReturnType<typeof executeRuntimeActionTurn>,
  { status: "started" | "queued" }
>;
type TicketDescriptor = Extract<
  RuntimeOperationActionSettlementDescriptor,
  { readonly ticket: object }
>;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason?: unknown) => void;
}

interface Hooks {
  readonly navigate?: (request: RuntimeNavigationRequest) => unknown;
  readonly invokeOperation?: (request: RuntimeOperationRequest) => unknown;
  readonly loadResource?: (request: RuntimeResourceRequest) => unknown;
  readonly resolveToken?: (request: RuntimeTokenRequest) => unknown;
  readonly report?: (diagnostic: DesenDiagnostic<string>) => void;
  readonly invokeCommand?: (request: RuntimeComponentCommandHostRequest) => unknown;
  readonly validateEvent?: (request: RuntimeHostEventRequest) => unknown;
  readonly emitEvent?: (request: RuntimeHostEventRequest) => unknown;
}

interface FixtureOptions {
  readonly hooks?: Hooks;
  readonly limits?: RuntimeActionTurnLimitProfile;
}

interface Children {
  readonly hostPorts: RuntimeHostPorts;
  readonly state: MountedState;
  readonly resources: MountedResources;
  readonly operations: MountedOperations;
  readonly stateActions: MountedStateActions;
  readonly operationActions: MountedOperationActions;
  readonly commandActions: MountedCommandActions;
}

interface Fixture extends Children {
  readonly turns: MountedTurns;
}

let cachedCatalog: DesenValidatedExecutionCatalogSet | undefined;

function catalogSet(): DesenValidatedExecutionCatalogSet {
  if (cachedCatalog !== undefined) return cachedCatalog;
  const validation = validateDesenExecutionCatalogSet([
    JSON.parse(JSON.stringify(frozenWebCatalog)) as unknown,
  ]);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("Expected the frozen web Catalog to validate.");
  cachedCatalog = validation.value;
  return cachedCatalog;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

function hostPorts(hooks: Hooks = {}): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: {
      navigate: (hooks.navigate ??
        (() => ({ status: "succeeded" }))) as RuntimeHostPorts["navigation"]["navigate"],
    },
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
    operations: {
      invoke: (hooks.invokeOperation ??
        (() => ({
          status: "succeeded",
          value: VALID_OUTPUT,
        }))) as RuntimeHostPorts["operations"]["invoke"],
    },
    resources: {
      load: (hooks.loadResource ??
        (() => ({
          status: "succeeded",
          value: STORE_OUTPUT,
        }))) as RuntimeHostPorts["resources"]["load"],
    },
    tokens: {
      resolve: (hooks.resolveToken ??
        (() => ({ status: "missing" }))) as RuntimeHostPorts["tokens"]["resolve"],
    },
    context: {
      getSnapshot: () => Object.freeze({ source: "action-turn-test" }),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: hooks.report ?? (() => undefined) },
  });
}

function children(hooks: Hooks = {}): Children {
  const ports = hostPorts(hooks);
  const state = mountRuntimeSurfaceState({
    surfaceId: SURFACE_ID,
    state: {
      count: {
        schema: { type: "integer", minimum: 0 },
        initial: 0,
      },
      enabled: {
        schema: { type: "boolean" },
        initial: false,
      },
      label: {
        schema: { type: "string", minLength: 1 },
        initial: "ready",
      },
    },
  });
  expect(state.status).toBe("mounted");
  if (state.status !== "mounted") throw new TypeError("Expected state to mount.");

  const stateActions = mountRuntimeStateNavigationActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    surfaceIds: [SURFACE_ID, NEXT_SURFACE_ID],
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    hostPorts: ports,
  });
  expect(stateActions.status).toBe("mounted");
  if (stateActions.status !== "mounted") throw new TypeError("Expected state actions to mount.");

  const resources = mountRuntimeSurfaceResources({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources: {
      stores: { use: STORES, input: {}, policy: "manual" },
    },
    catalogSet: catalogSet(),
    hostPorts: ports,
  });
  expect(resources.status).toBe("mounted");
  if (resources.status !== "mounted") throw new TypeError("Expected resources to mount.");

  const operations = mountRuntimeSurfaceOperations({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: { signIn: { operation: SIGN_IN } },
    catalogSet: catalogSet(),
    hostPorts: ports,
  });
  expect(operations.status).toBe("mounted");
  if (operations.status !== "mounted") throw new TypeError("Expected operations to mount.");

  const operationActions = mountRuntimeOperationResourceActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    operations: { signIn: { operation: SIGN_IN } },
    resourceHandle: resources.handle,
    resourceSnapshot: resources.snapshot,
    operationHandle: operations.handle,
    operationSnapshot: operations.snapshot,
    hostPorts: ports,
  });
  expect(operationActions.status).toBe("mounted");
  if (operationActions.status !== "mounted") {
    throw new TypeError("Expected operation/resource actions to mount.");
  }

  const commandPorts = createRuntimeCommandEventHostPorts({
    commands: {
      invoke: (hooks.invokeCommand ?? (() => ({ status: "succeeded" }))) as (
        request: RuntimeComponentCommandHostRequest,
      ) => { status: "succeeded" },
    },
    events: {
      validate: (hooks.validateEvent ?? (() => ({ status: "valid" }))) as (
        request: RuntimeHostEventRequest,
      ) => { status: "valid" },
      emit: (hooks.emitEvent ?? (() => ({ status: "succeeded" }))) as (
        request: RuntimeHostEventRequest,
      ) => { status: "succeeded" },
    },
  });
  const commandActions = mountRuntimeCommandEventActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    staticComponents: { [FIELD_NODE]: TEXT_FIELD },
    hostEvents: { [HOST_EVENT]: HOST_EVENT_CONTRACT },
    catalogSet: catalogSet(),
    hostPorts: ports,
    commandEventPorts: commandPorts,
  });
  expect(commandActions.status).toBe("mounted");
  if (commandActions.status !== "mounted") {
    throw new TypeError("Expected command/event actions to mount.");
  }

  return {
    hostPorts: ports,
    state,
    resources,
    operations,
    stateActions,
    operationActions,
    commandActions,
  };
}

function mountInput(
  target: Children,
  limits?: RuntimeActionTurnLimitProfile,
): RuntimeActionTurnsMountInput {
  const commandEvent = readRuntimeCommandEventActions(target.commandActions.handle);
  if (commandEvent.status !== "read") {
    throw new TypeError("Expected a current command/event authority for coordinator mount.");
  }
  return {
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    stateHandle: target.state.handle,
    stateSnapshot: target.state.snapshot,
    resourceHandle: target.resources.handle,
    resourceSnapshot: target.resources.snapshot,
    operationHandle: target.operations.handle,
    operationSnapshot: target.operations.snapshot,
    stateActionsHandle: target.stateActions.handle,
    operationResourceActionsHandle: target.operationActions.handle,
    commandEventActionsHandle: target.commandActions.handle,
    commandEventSnapshot: commandEvent.snapshot,
    hostPorts: target.hostPorts,
    ...(limits === undefined ? {} : { limits }),
  };
}

function mountedFixture(options: FixtureOptions = {}): Fixture {
  const target = children(options.hooks);
  const turns = mountRuntimeActionTurns(mountInput(target, options.limits));
  expect(turns.status).toBe("mounted");
  if (turns.status !== "mounted") throw new TypeError("Expected action turns to mount.");
  return { ...target, turns };
}

function currentResolution(
  target: Children,
  event: RuntimeResolutionSnapshot["event"] = {
    status: "available",
    value: Object.freeze({ source: "submit" }),
  },
): RuntimeResolutionSnapshot {
  const state = readRuntimeSurfaceState(target.state.handle);
  const resource = readRuntimeSurfaceResources(target.resources.handle);
  const operation = readRuntimeSurfaceOperations(target.operations.handle);
  expect(state.status).toBe("active");
  expect(resource.status).toBe("read");
  expect(operation.status).toBe("read");
  if (state.status !== "active" || resource.status !== "read" || operation.status !== "read") {
    throw new TypeError("Expected current lower-manager snapshots.");
  }
  return createRuntimeResolutionSnapshot({
    state: state.snapshot.values,
    context: { source: "event-turn" },
    resource: resource.snapshot.lifecycles,
    operation: operation.snapshot.lifecycles,
    event,
    item: { index: 1 },
    env: { platform: "web" },
  });
}

function mustPrepare(
  actions: readonly unknown[],
): Extract<RuntimeActionTurnProgramPreparationResult, { readonly status: "prepared" }> {
  const prepared = prepareRuntimeActionProgram(actions);
  expect(prepared.status).toBe("prepared");
  if (prepared.status !== "prepared") throw new TypeError("Expected a prepared action program.");
  return prepared;
}

function admit(
  target: Fixture,
  actions: readonly unknown[],
  snapshot: RuntimeResolutionSnapshot = currentResolution(target),
): AcceptedTurn {
  const prepared = mustPrepare(actions);
  const admitted = executeRuntimeActionTurn(target.turns.handle, {
    program: prepared.program,
    snapshot,
  });
  expect(["started", "queued"]).toContain(admitted.status);
  if (admitted.status !== "started" && admitted.status !== "queued") {
    throw new TypeError("Expected an accepted turn.");
  }
  return admitted;
}

async function run(
  target: Fixture,
  actions: readonly unknown[],
  snapshot: RuntimeResolutionSnapshot = currentResolution(target),
): Promise<RuntimeActionTurnCompletion> {
  return admit(target, actions, snapshot).completion;
}

function operationAction(
  overrides: Readonly<Record<string, unknown>> = {},
): RuntimeOperationInvokeAction {
  return {
    type: "operation.invoke",
    operation: SIGN_IN,
    as: "signIn",
    input: VALID_INPUT,
    ...overrides,
  } as RuntimeOperationInvokeAction;
}

function commandAction(): RuntimeComponentCommandAction {
  return {
    type: "component.command",
    target: FIELD_NODE,
    command: "focus",
    input: {},
  };
}

function registerCommandTarget(target: Children, runtimeInstanceId = "field-1") {
  const read = readRuntimeCommandEventActions(target.commandActions.handle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected a current command snapshot.");
  const registered = registerRuntimeComponentCommandTarget(target.commandActions.handle, {
    sourceNodeId: FIELD_NODE,
    capabilityId: TEXT_FIELD,
    runtimeInstanceId,
    snapshot: read.snapshot,
  });
  expect(registered.status).toBe("registered");
  if (registered.status !== "registered") throw new TypeError("Expected target registration.");
  return registered;
}

function terminalDescriptor(
  descriptor: RuntimeOperationActionSettlementDescriptor,
): TicketDescriptor {
  expect(["succeeded", "failed", "denied", "invalid-output", "adapter-failed"]).toContain(
    descriptor.status,
  );
  if (!("ticket" in descriptor)) throw new TypeError("Expected a ticket-bearing settlement.");
  return descriptor;
}

async function flushMicrotasks(rounds = 80): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

function expectDeepFrozen(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, seen);
}

function hasExactOwnKeys(value: unknown, expected: readonly string[]): value is object {
  if (typeof value !== "object" || value === null) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return (
      keys.length === expected.length &&
      expected.every((key) => keys.includes(key)) &&
      keys.every((key) => typeof key === "string")
    );
  } catch {
    return false;
  }
}

function isResolutionSnapshotEnvelope(value: unknown): value is object {
  return hasExactOwnKeys(value, [
    "context",
    "env",
    "event",
    "item",
    "operation",
    "resource",
    "state",
  ]);
}

function isCompletedTurnEnvelope(value: unknown): value is { readonly status: unknown } {
  return (
    hasExactOwnKeys(value, [
      "diagnostics",
      "origin",
      "resolutionSnapshot",
      "settlementDepth",
      "snapshot",
      "status",
      "steps",
      "turnId",
    ]) && Reflect.get(value, "status") === "completed"
  );
}

function isSettlementWorkItemEnvelope(value: unknown): value is { readonly origin: unknown } {
  return (
    hasExactOwnKeys(value, [
      "depth",
      "descriptor",
      "origin",
      "program",
      "programAuthority",
      "programFailure",
      "scope",
      "turnId",
    ]) && Reflect.get(value, "origin") === "settlement"
  );
}

describe("M04-T13 bounded prepared programs", () => {
  it("captures only indices 0 through 63 and never observes the 65th action", () => {
    let suffixReads = 0;
    const actions = Array.from({ length: 65 }, () => ({
      type: "state.toggle",
      path: "enabled",
    }));
    Object.defineProperty(actions, "64", {
      configurable: true,
      enumerable: true,
      get() {
        suffixReads += 1;
        throw new Error("the suffix must remain unobserved");
      },
    });

    const prepared = mustPrepare(actions);
    expect(prepared).toMatchObject({ actionCount: 65, overflow: true });
    expect(suffixReads).toBe(0);
    expect(Reflect.ownKeys(prepared.program)).toEqual([]);
    expectDeepFrozen(prepared);
  });

  it("detaches and recursively freezes the executable prefix before admission", async () => {
    const original = {
      type: "state.set",
      path: "label",
      value: { nested: "captured" },
    };
    const prepared = mustPrepare([original]);
    original.type = "proof.unknown";
    original.path = "missing";
    original.value.nested = "mutated";
    const target = mountedFixture();
    const admitted = executeRuntimeActionTurn(target.turns.handle, {
      program: prepared.program,
      snapshot: currentResolution(target),
    });
    expect(admitted.status).toBe("started");
    if (admitted.status !== "started") throw new TypeError("Expected a started turn.");
    const completion = await admitted.completion;
    expect(completion.steps[0]).toMatchObject({
      route: "state-navigation",
      result: { status: "state-rejected" },
    });
    expect(completion.status).toBe("terminated");
  });

  it.each([
    ["non-array", {}],
    ["sparse prefix", new Array(1)],
    ["primitive action", [null]],
    ["missing discriminator", [{}]],
    ["function member", [{ type: "event.emit", callback: () => undefined }]],
  ])("rejects malformed prepared-program input: %s", (_label, actions) => {
    expect(prepareRuntimeActionProgram(actions as readonly unknown[]).status).toBe("invalid");
  });

  it("rejects an accessor in the executable prefix without invoking it", () => {
    let reads = 0;
    const actions: unknown[] = [];
    Object.defineProperty(actions, "0", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return { type: "state.toggle", path: "enabled" };
      },
    });
    actions.length = 1;
    expect(prepareRuntimeActionProgram(actions)).toMatchObject({
      status: "invalid",
      reason: "malformed-actions",
    });
    expect(reads).toBe(0);
  });
});

describe("M04-T13 exact child mount and public authority", () => {
  it("mounts exact T10/T11/T12 authorities without invoking host callbacks", () => {
    const navigate = vi.fn(() => ({ status: "succeeded" as const }));
    const invokeOperation = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const invokeCommand = vi.fn(() => ({ status: "succeeded" as const }));
    const report = vi.fn();
    const target = mountedFixture({
      hooks: { navigate, invokeOperation, invokeCommand, report },
    });

    expect(target.turns.snapshot).toMatchObject({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(invokeOperation).not.toHaveBeenCalled();
    expect(invokeCommand).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expectDeepFrozen(target.turns);
  });

  it("rejects forged and foreign T10/T11 child handles before claiming anything", () => {
    const left = children();
    const right = children();
    expect(
      mountRuntimeActionTurns({
        ...mountInput(left),
        stateActionsHandle: Object.freeze({}) as typeof left.stateActions.handle,
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });
    expect(
      mountRuntimeActionTurns({
        ...mountInput(left),
        stateActionsHandle: right.stateActions.handle,
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });
    expect(
      mountRuntimeActionTurns({
        ...mountInput(left),
        operationResourceActionsHandle: Object.freeze({}) as typeof left.operationActions.handle,
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-operation-authority" });
    expect(
      mountRuntimeActionTurns({
        ...mountInput(left),
        operationResourceActionsHandle: right.operationActions.handle,
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-operation-authority" });
    expect(mountRuntimeActionTurns(mountInput(left)).status).toBe("mounted");
  });

  it("rejects forged T12 authority, stale lower snapshots, and a second exclusive claim", () => {
    const target = children();
    expect(
      mountRuntimeActionTurns({
        ...mountInput(target),
        commandEventActionsHandle: Object.freeze({}) as typeof target.commandActions.handle,
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-command-event-authority" });
    const written = writeRuntimeSurfaceState(target.state.handle, {
      path: "count",
      value: 1,
    });
    expect(written.status).toBe("updated");
    expect(mountRuntimeActionTurns(mountInput(target))).toMatchObject({
      status: "invalid",
      reason: "invalid-state-authority",
    });

    const fresh = children();
    expect(mountRuntimeActionTurns(mountInput(fresh)).status).toBe("mounted");
    expect(mountRuntimeActionTurns(mountInput(fresh))).toMatchObject({
      status: "invalid",
      reason: "already-owned-authority",
    });
  });

  it.each([
    ["negative", { maxActionsPerTurn: -1 }],
    ["fractional", { maxSettlementDepth: 1.5 }],
    ["non-finite", { maxQueuedTurns: Number.POSITIVE_INFINITY }],
    ["above profile", { maxActionsPerTurn: 65 }],
    ["non-number", { maxTurnGeneration: "1" }],
  ])("rejects a widening or malformed limit profile: %s", (_label, limits) => {
    const target = children();
    expect(
      mountRuntimeActionTurns({
        ...mountInput(target),
        limits: limits as RuntimeActionTurnLimitProfile,
      }),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
  });

  it("keeps all exported operations receiver independent", async () => {
    const target = children();
    const mounted = Reflect.apply(mountRuntimeActionTurns, Object.freeze({ hostile: true }), [
      mountInput(target),
    ]);
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected receiver-free mount.");
    const prepared = Reflect.apply(prepareRuntimeActionProgram, Object.freeze({ hostile: true }), [
      [{ type: "state.toggle", path: "enabled" }],
    ]);
    expect(prepared.status).toBe("prepared");
    if (prepared.status !== "prepared") throw new TypeError("Expected receiver-free preparation.");
    const admitted = Reflect.apply(executeRuntimeActionTurn, Object.freeze({ hostile: true }), [
      mounted.handle,
      { program: prepared.program, snapshot: currentResolution(target) },
    ]);
    expect(admitted.status).toBe("started");
    if (admitted.status !== "started") throw new TypeError("Expected receiver-free admission.");
    await expect(admitted.completion).resolves.toMatchObject({ status: "completed" });
    expect(
      Reflect.apply(disposeRuntimeActionTurns, Object.freeze({ hostile: true }), [mounted.handle]),
    ).toMatchObject({ status: "disposed" });
  });
});

describe("M04-T13 ordered dispatch and current snapshots", () => {
  it("runs in source order, continues after skipped, and stops at an unknown action", async () => {
    const emitted: string[] = [];
    const target = mountedFixture({
      hooks: {
        emitEvent(request) {
          emitted.push(request.context.requestId);
          return { status: "succeeded" };
        },
      },
    });
    const completion = await run(target, [
      {
        type: "state.toggle",
        path: "enabled",
        when: { op: "eq", args: [false, true] },
      },
      { type: "state.toggle", path: "enabled" },
      { type: "event.emit", name: HOST_EVENT },
      { type: "proof.unknown", payload: { secret: "inert" } },
      { type: "event.emit", name: HOST_EVENT },
    ]);

    expect(completion).toMatchObject({
      status: "terminated",
      reason: "action-failed",
    });
    expect(
      completion.steps.map(({ index, route, result }) => [index, route, result.status]),
    ).toEqual([
      [0, "state-navigation", "skipped"],
      [1, "state-navigation", "state-updated"],
      [2, "command-event", "event-emitted"],
      [3, "unknown", "unknown-action"],
    ]);
    expect(emitted).toHaveLength(1);
    const state = readRuntimeSurfaceState(target.state.handle);
    expect(state.status === "active" ? state.snapshot.values.enabled : undefined).toBe(true);
  });

  it("keeps earlier effects and does not inspect later slots after a controlled denial", async () => {
    const emitEvent = vi.fn(() => ({ status: "denied" as const }));
    const target = mountedFixture({ hooks: { emitEvent } });
    const completion = await run(target, [
      { type: "state.toggle", path: "enabled" },
      { type: "event.emit", name: HOST_EVENT },
      { type: "state.toggle", path: "enabled" },
    ]);

    expect(completion).toMatchObject({ status: "terminated", reason: "action-failed" });
    expect(completion.steps.map(({ result }) => result.status)).toEqual([
      "state-updated",
      "event-denied",
    ]);
    const state = readRuntimeSurfaceState(target.state.handle);
    expect(state.status === "active" ? state.snapshot.values.enabled : undefined).toBe(true);
    expect(emitEvent).toHaveBeenCalledTimes(1);
  });

  it("adopts a registration before the first command of the next admission", async () => {
    const invokeCommand = vi.fn(() => ({ status: "succeeded" as const }));
    const target = mountedFixture({ hooks: { invokeCommand } });
    const staleLexicalSnapshot = currentResolution(target);

    const missing = await run(target, [commandAction()], staleLexicalSnapshot);
    expect(missing).toMatchObject({ status: "terminated", reason: "action-failed" });
    expect(missing.steps[0]?.result.status).toBe("command-target-unavailable");
    expect(invokeCommand).not.toHaveBeenCalled();

    const registered = registerCommandTarget(target, "field-current");
    const visible = await run(target, [commandAction()], staleLexicalSnapshot);
    expect(visible.status).toBe("completed");
    expect(visible.steps[0]?.result).toMatchObject({
      status: "command-succeeded",
      runtimeInstanceId: "field-current",
    });
    expect(visible.snapshot.commandEventSnapshot).toBe(registered.snapshot);
    expect(invokeCommand).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the current four-domain resolution before every ordered slot", async () => {
    const observedPayloads: unknown[] = [];
    const target = mountedFixture({
      hooks: {
        validateEvent(request) {
          observedPayloads.push(request.payload);
          return { status: "valid" };
        },
      },
    });
    const completion = await run(target, [
      { type: "state.set", path: "count", value: 7 },
      {
        type: "event.emit",
        name: HOST_EVENT,
        payload: { count: { $ref: "state.count" } },
      },
    ]);

    expect(completion.status).toBe("completed");
    expect(observedPayloads).toEqual([{ count: 7 }]);
    expect(completion.resolutionSnapshot.state.count).toBe(7);
  });

  it("never retries an invalid snapshot after a token callback advances lower state", async () => {
    const holder: { target?: Fixture } = {};
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const resolveToken = vi.fn(() => {
      const target = holder.target;
      if (target === undefined) throw new TypeError("Expected a mounted target.");
      const written = writeRuntimeSurfaceState(target.state.handle, {
        path: "count",
        value: 7,
      });
      expect(written.status).toBe("updated");
      return { status: "resolved" as const, value: "must-not-commit" };
    });
    const target = mountedFixture({ hooks: { emitEvent, resolveToken } });
    holder.target = target;

    const completion = await run(target, [
      { type: "state.set", path: "label", value: { $token: "racing-token" } },
      { type: "event.emit", name: HOST_EVENT },
    ]);
    expect(completion).toMatchObject({ status: "terminated", reason: "invalid-snapshot" });
    expect(completion.steps).toHaveLength(1);
    expect(completion.steps[0]?.result.status).toBe("invalid-snapshot");
    expect(resolveToken).toHaveBeenCalledTimes(1);
    expect(emitEvent).not.toHaveBeenCalled();
    const state = readRuntimeSurfaceState(target.state.handle);
    expect(state.status).toBe("active");
    if (state.status !== "active") throw new TypeError("Expected active state.");
    expect(state.snapshot.values).toMatchObject({ count: 7, label: "ready" });
    expect(completion.snapshot.stateSnapshot).toBe(state.snapshot);
  });

  it("executes exactly 64 actions and reports one core diagnostic for the 65th", async () => {
    expect(RUNTIME_ACTION_TURN_LIMITS.maxActionsPerTurn).toBe(64);
    const reports: DesenDiagnostic<string>[] = [];
    const exact = mountedFixture();
    const sixtyFour = Array.from({ length: 64 }, () => ({
      type: "state.toggle",
      path: "enabled",
    }));
    const exactCompletion = await run(exact, sixtyFour);
    expect(exactCompletion.status).toBe("completed");
    expect(exactCompletion.steps).toHaveLength(64);

    const overflow = mountedFixture({
      hooks: {
        report(diagnostic) {
          reports.push(diagnostic);
        },
      },
    });
    const overflowCompletion = await run(overflow, [...sixtyFour, { type: "proof.unread" }]);
    expect(overflowCompletion).toMatchObject({
      status: "terminated",
      reason: "action-limit",
    });
    expect(overflowCompletion.steps).toHaveLength(64);
    expect(overflowCompletion.diagnostics.map(({ code }) => code)).toEqual([
      "ACTION_LIMIT_EXCEEDED",
    ]);
    expect(reports.map(({ code }) => code)).toEqual(["ACTION_LIMIT_EXCEEDED"]);
  });

  it("blocks reporting-time reentry without queueing or executing another action", async () => {
    const holder: { target?: Fixture; program?: ReturnType<typeof mustPrepare> } = {};
    const emitted = vi.fn(() => ({ status: "succeeded" as const }));
    const reentries: ReturnType<typeof executeRuntimeActionTurn>[] = [];
    const target = mountedFixture({
      hooks: {
        emitEvent: emitted,
        report() {
          const current = holder.target;
          const program = holder.program;
          if (current === undefined || program === undefined) return;
          reentries.push(
            executeRuntimeActionTurn(current.turns.handle, {
              program: program.program,
              snapshot: currentResolution(current),
            }),
          );
        },
      },
    });
    holder.target = target;
    holder.program = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);

    const completion = await run(
      target,
      Array.from({ length: 65 }, () => ({
        type: "state.toggle",
        path: "enabled",
      })),
    );
    expect(completion).toMatchObject({ status: "terminated", reason: "action-limit" });
    expect(reentries).toEqual([{ status: "rejected", reason: "invalid-request", diagnostics: [] }]);
    expect(emitted).not.toHaveBeenCalled();
  });
});

describe("M04-T13 shared FIFO and retained limits", () => {
  it("queues reentrant admissions in FIFO order without recursive dispatch", async () => {
    const holder: {
      turns?: MountedTurns;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    let insideCommand = false;
    const admissions: AcceptedTurn[] = [];
    const emitted: string[] = [];
    const target = children({
      invokeCommand() {
        insideCommand = true;
        if (
          holder.turns === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized FIFO fixture.");
        }
        for (let index = 0; index < 3; index += 1) {
          const admission = executeRuntimeActionTurn(holder.turns.handle, {
            program: holder.queuedProgram.program,
            snapshot: holder.lexicalSnapshot,
          });
          expect(admission.status).toBe("queued");
          if (admission.status !== "queued") throw new TypeError("Expected queued reentry.");
          admissions.push(admission);
        }
        insideCommand = false;
        return { status: "succeeded" };
      },
      emitEvent(request) {
        expect(insideCommand).toBe(false);
        emitted.push(request.context.requestId);
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "fifo-field");
    const mounted = mountRuntimeActionTurns(mountInput(target));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected FIFO coordinator.");
    holder.turns = mounted;
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected outer turn.");
    await expect(outer.completion).resolves.toMatchObject({ status: "completed" });
    const completions = await Promise.all(admissions.map(({ completion }) => completion));
    expect(admissions.map((admission) => admission.status)).toEqual(["queued", "queued", "queued"]);
    expect(
      admissions.map((admission) =>
        admission.status === "queued" ? admission.position : undefined,
      ),
    ).toEqual([1, 2, 3]);
    expect(completions.every(({ status }) => status === "completed")).toBe(true);
    expect(emitted).toEqual(
      completions.map((completion) => {
        const result = completion.steps[0]?.result;
        return result?.status === "event-emitted" ? result.requestId : "missing";
      }),
    );
  });

  it("keeps the active program charged while bounding reentrant retained actions", async () => {
    const holder: {
      turns?: MountedTurns;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    const admissions: ReturnType<typeof executeRuntimeActionTurn>[] = [];
    const target = children({
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized retention fixture.");
        }
        for (let index = 0; index < 2; index += 1) {
          admissions.push(
            executeRuntimeActionTurn(holder.turns.handle, {
              program: holder.queuedProgram.program,
              snapshot: holder.lexicalSnapshot,
            }),
          );
        }
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "retained-field");
    const mounted = mountRuntimeActionTurns(mountInput(target, { maxRetainedQueuedActions: 2 }));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected retention coordinator.");
    holder.turns = mounted;
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected retained outer turn.");
    await outer.completion;
    expect(admissions[0]?.status).toBe("queued");
    expect(admissions[1]).toMatchObject({ status: "rejected", reason: "retained-limit" });
    if (admissions[0]?.status === "queued") {
      await expect(admissions[0].completion).resolves.toMatchObject({ status: "completed" });
    }
  });

  it("reserves future settlement capacity before an operation effect", async () => {
    const holder: {
      turns?: MountedTurns;
      filler?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    const fillers: ReturnType<typeof executeRuntimeActionTurn>[] = [];
    const invokeOperation = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const target = children({
      invokeOperation,
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.filler === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized reservation fixture.");
        }
        fillers.push(
          executeRuntimeActionTurn(holder.turns.handle, {
            program: holder.filler.program,
            snapshot: holder.lexicalSnapshot,
          }),
        );
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "reservation-field");
    const mounted = mountRuntimeActionTurns(mountInput(target, { maxQueuedTurns: 1 }));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected reservation coordinator.");
    holder.turns = mounted;
    holder.filler = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction(), operationAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected reservation outer turn.");
    const completion = await outer.completion;
    expect(completion).toMatchObject({ status: "terminated", reason: "action-limit" });
    expect(completion.steps).toHaveLength(1);
    expect(invokeOperation).not.toHaveBeenCalled();
    expect(fillers[0]?.status).toBe("queued");
    if (fillers[0]?.status === "queued") await fillers[0].completion;
  });

  it("terminates only the excess synchronous transitions and fulfills every completion", async () => {
    const holder: {
      turns?: MountedTurns;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    const admissions: AcceptedTurn[] = [];
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const target = children({
      emitEvent,
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized transition fixture.");
        }
        for (let index = 0; index < 3; index += 1) {
          const admission = executeRuntimeActionTurn(holder.turns.handle, {
            program: holder.queuedProgram.program,
            snapshot: holder.lexicalSnapshot,
          });
          expect(admission.status).toBe("queued");
          if (admission.status !== "queued") throw new TypeError("Expected queued transition.");
          admissions.push(admission);
        }
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "transition-field");
    const mounted = mountRuntimeActionTurns(
      mountInput(target, { maxSynchronousTurnTransitions: 2 }),
    );
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected transition coordinator.");
    holder.turns = mounted;
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected transition outer turn.");
    await outer.completion;
    const completions = await Promise.all(admissions.map(({ completion }) => completion));
    expect(completions.map(({ status }) => status)).toEqual([
      "completed",
      "terminated",
      "terminated",
    ]);
    expect(
      completions
        .slice(1)
        .every(
          (completion) =>
            completion.status === "terminated" && completion.reason === "transition-limit",
        ),
    ).toBe(true);
    expect(emitEvent).toHaveBeenCalledTimes(1);
  });

  it("accepts generation zero and rejects the next turn at a lowered generation ceiling", async () => {
    const target = mountedFixture({ limits: { maxTurnGeneration: 0 } });
    await expect(admit(target, []).completion).resolves.toMatchObject({ status: "completed" });
    const rejected = executeRuntimeActionTurn(target.turns.handle, {
      program: mustPrepare([]).program,
      snapshot: currentResolution(target),
    });
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: "turn-generation-limit",
    });
  });
});

describe("M04-T13 operation settlement turns and mandatory finalization", () => {
  it("keeps the originating turn nonblocking and finalizes a successful handler turn", async () => {
    const transport = deferred<unknown>();
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const invokeOperation = vi.fn(() => transport.promise);
    const target = mountedFixture({ hooks: { emitEvent, invokeOperation } });

    const origin = admit(target, [
      operationAction({
        onSuccess: [{ type: "event.emit", name: HOST_EVENT }],
        onFailure: [],
      }),
    ]);
    const originCompletion = await origin.completion;
    expect(originCompletion.status).toBe("completed");
    expect(originCompletion.steps[0]?.result.status).toBe("operation-started");
    expect(invokeOperation).toHaveBeenCalledTimes(1);
    expect(emitEvent).not.toHaveBeenCalled();

    const result = originCompletion.steps[0]?.result;
    if (
      result?.status !== "operation-started" &&
      result?.status !== "operation-queued" &&
      result?.status !== "operation-staged"
    ) {
      throw new TypeError("Expected an accepted operation action.");
    }
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const descriptor = terminalDescriptor(await result.settlement);
    await flushMicrotasks();
    expect(descriptor.status).toBe("succeeded");
    expect(emitEvent).toHaveBeenCalledTimes(1);
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("finalizes settlement after its initial current-resolution rebuild fails closed", async () => {
    const transport = deferred<unknown>();
    const target = mountedFixture({
      hooks: {
        invokeOperation: () => transport.promise,
      },
    });
    const origin = await run(target, [
      operationAction({
        onSuccess: [{ type: "state.toggle", path: "enabled" }],
      }),
    ]);
    const result = origin.steps[0]?.result;
    if (result?.status !== "operation-started") {
      throw new TypeError("Expected a pending operation for resolution containment.");
    }

    const originalFreeze = Object.freeze;
    let blockedSnapshots = 0;
    const freeze = vi.spyOn(Object, "freeze").mockImplementation(((value: object) => {
      const stack = new Error().stack ?? "";
      if (isResolutionSnapshotEnvelope(value) && stack.includes("composeResolutionSnapshot")) {
        blockedSnapshots += 1;
        throw new Error("private pre-loop resolution failure");
      }
      return originalFreeze(value);
    }) as typeof Object.freeze);
    let descriptor: TicketDescriptor | undefined;
    try {
      transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
      descriptor = terminalDescriptor(await result.settlement);
      await flushMicrotasks(120);
    } finally {
      freeze.mockRestore();
    }

    expect(blockedSnapshots).toBeGreaterThanOrEqual(1);
    expect(descriptor).toBeDefined();
    if (descriptor === undefined) throw new TypeError("Expected a terminal descriptor.");
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
    const state = readRuntimeSurfaceState(target.state.handle);
    expect(state.status === "active" ? state.snapshot.values.enabled : undefined).toBe(false);
    await expect(admit(target, []).completion).resolves.toMatchObject({ status: "completed" });
  });

  it("contains an asynchronous settlement-enqueue throw without rejection or ticket loss", async () => {
    const transport = deferred<unknown>();
    const target = mountedFixture({
      hooks: {
        invokeOperation: () => transport.promise,
      },
    });
    const origin = await run(target, [
      operationAction({
        onSuccess: [{ type: "state.toggle", path: "enabled" }],
      }),
    ]);
    const result = origin.steps[0]?.result;
    if (result?.status !== "operation-started") {
      throw new TypeError("Expected a pending operation for async containment.");
    }

    const originalFreeze = Object.freeze;
    let enqueueFailures = 0;
    const freeze = vi.spyOn(Object, "freeze").mockImplementation(((value: object) => {
      if (enqueueFailures === 0 && isSettlementWorkItemEnvelope(value)) {
        enqueueFailures += 1;
        throw new Error("private settlement enqueue failure");
      }
      return originalFreeze(value);
    }) as typeof Object.freeze);
    let descriptor: TicketDescriptor | undefined;
    try {
      transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
      descriptor = terminalDescriptor(await result.settlement);
      await flushMicrotasks(120);
    } finally {
      freeze.mockRestore();
    }

    expect(enqueueFailures).toBe(1);
    expect(descriptor).toBeDefined();
    if (descriptor === undefined) throw new TypeError("Expected a contained terminal descriptor.");
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
    const state = readRuntimeSurfaceState(target.state.handle);
    expect(state.status).toBe("disposed");
    expect(disposeRuntimeActionTurns(target.turns.handle).status).toBe("already-disposed");
  });

  it("selects the failure handler and still finalizes after a controlled handler failure", async () => {
    const emitted: string[] = [];
    const target = mountedFixture({
      hooks: {
        invokeOperation: () => ({ status: "failed", errorCode: "invalidCredentials" }),
        emitEvent(request) {
          emitted.push(request.name);
          return { status: "succeeded" };
        },
      },
    });
    const origin = await run(target, [
      operationAction({
        onSuccess: [{ type: "event.emit", name: "not-allowlisted" }],
        onFailure: [
          { type: "event.emit", name: HOST_EVENT },
          { type: "proof.failure" },
          { type: "event.emit", name: HOST_EVENT },
        ],
      }),
    ]);
    const result = origin.steps[0]?.result;
    if (
      result?.status !== "operation-started" &&
      result?.status !== "operation-queued" &&
      result?.status !== "operation-staged"
    ) {
      throw new TypeError("Expected an accepted failed operation.");
    }
    const descriptor = terminalDescriptor(await result.settlement);
    await flushMicrotasks();

    expect(descriptor.status).toBe("failed");
    expect(emitted).toEqual([HOST_EVENT]);
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("makes the parent event unavailable inside an asynchronous settlement turn", async () => {
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const target = mountedFixture({ hooks: { emitEvent } });
    const origin = await run(
      target,
      [
        operationAction({
          onSuccess: [
            {
              type: "event.emit",
              name: HOST_EVENT,
              payload: { source: { $ref: "event.source" } },
            },
          ],
        }),
      ],
      currentResolution(target, {
        status: "available",
        value: Object.freeze({ source: "must-not-cross-turn" }),
      }),
    );
    const result = origin.steps[0]?.result;
    if (
      result?.status !== "operation-started" &&
      result?.status !== "operation-queued" &&
      result?.status !== "operation-staged"
    ) {
      throw new TypeError("Expected an accepted event-fence operation.");
    }
    const descriptor = terminalDescriptor(await result.settlement);
    await flushMicrotasks();
    expect(emitEvent).not.toHaveBeenCalled();
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("finalizes an empty handler before promoting queued same-alias work", async () => {
    const firstTransport = deferred<unknown>();
    const invokeOperation = vi
      .fn<(request: RuntimeOperationRequest) => unknown>()
      .mockImplementationOnce(() => firstTransport.promise)
      .mockImplementation(() => ({ status: "succeeded", value: VALID_OUTPUT }));
    const target = mountedFixture({ hooks: { invokeOperation } });

    const first = await run(target, [operationAction({ onSuccess: [] })]);
    const firstResult = first.steps[0]?.result;
    if (firstResult?.status !== "operation-started") {
      throw new TypeError("Expected the first operation to start.");
    }
    const second = await run(target, [operationAction({ concurrency: "queue" })]);
    expect(second.steps[0]?.result.status).toBe("operation-queued");
    expect(invokeOperation).toHaveBeenCalledTimes(1);

    firstTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const descriptor = terminalDescriptor(await firstResult.settlement);
    await flushMicrotasks();
    expect(invokeOperation).toHaveBeenCalledTimes(2);
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("holds a nested staged operation until the parent settlement finally path", async () => {
    const firstTransport = deferred<unknown>();
    const invokeOperation = vi
      .fn<(request: RuntimeOperationRequest) => unknown>()
      .mockImplementationOnce(() => firstTransport.promise)
      .mockImplementation(() => ({ status: "succeeded", value: VALID_OUTPUT }));
    const target = mountedFixture({ hooks: { invokeOperation } });
    const origin = await run(target, [
      operationAction({
        onSuccess: [operationAction({ onSuccess: [] })],
      }),
    ]);
    const result = origin.steps[0]?.result;
    if (result?.status !== "operation-started") {
      throw new TypeError("Expected the parent operation to start.");
    }
    expect(invokeOperation).toHaveBeenCalledTimes(1);

    firstTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const descriptor = terminalDescriptor(await result.settlement);
    await flushMicrotasks();
    expect(invokeOperation).toHaveBeenCalledTimes(2);
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("finalizes a ticket after a settlement handler reaches the 65-action limit", async () => {
    const reports: DesenDiagnostic<string>[] = [];
    const target = mountedFixture({
      hooks: {
        report(diagnostic) {
          reports.push(diagnostic);
        },
      },
    });
    const handler = Array.from({ length: 65 }, () => ({
      type: "state.toggle",
      path: "enabled",
    }));
    const origin = await run(target, [operationAction({ onSuccess: handler })]);
    const result = origin.steps[0]?.result;
    if (result?.status !== "operation-started") {
      throw new TypeError("Expected the bounded operation to start.");
    }
    const descriptor = terminalDescriptor(await result.settlement);
    await flushMicrotasks(160);
    expect(reports.filter(({ code }) => code === "ACTION_LIMIT_EXCEEDED")).toHaveLength(1);
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("already-finalized");
  });

  it("accepts sixteen nested operation effects and rejects the seventeenth before effect", async () => {
    function nestedOperation(levels: number): RuntimeOperationInvokeAction {
      return operationAction({
        onSuccess: levels > 1 ? [nestedOperation(levels - 1)] : [],
      });
    }

    const exactInvoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const exact = mountedFixture({ hooks: { invokeOperation: exactInvoke } });
    await run(exact, [nestedOperation(16)]);
    await flushMicrotasks(320);
    expect(exactInvoke).toHaveBeenCalledTimes(16);

    const reports: DesenDiagnostic<string>[] = [];
    const overflowInvoke = vi.fn(() => ({
      status: "succeeded" as const,
      value: VALID_OUTPUT,
    }));
    const overflow = mountedFixture({
      hooks: {
        invokeOperation: overflowInvoke,
        report(diagnostic) {
          reports.push(diagnostic);
        },
      },
    });
    await run(overflow, [nestedOperation(17)]);
    await flushMicrotasks(360);
    expect(overflowInvoke).toHaveBeenCalledTimes(16);
    expect(reports.filter(({ code }) => code === "ACTION_LIMIT_EXCEEDED")).toHaveLength(1);
  });

  it("disposes T11 before finalizing settlement navigation and never promotes queued work", async () => {
    const firstTransport = deferred<unknown>();
    const navigate = vi.fn(() => ({ status: "succeeded" as const }));
    const invokeOperation = vi
      .fn<(request: RuntimeOperationRequest) => unknown>()
      .mockImplementationOnce(() => firstTransport.promise)
      .mockImplementation(() => ({ status: "succeeded", value: VALID_OUTPUT }));
    const target = mountedFixture({ hooks: { invokeOperation, navigate } });

    const first = await run(target, [
      operationAction({
        onSuccess: [{ type: "navigate", surface: NEXT_SURFACE_ID }],
      }),
    ]);
    const firstResult = first.steps[0]?.result;
    if (firstResult?.status !== "operation-started") {
      throw new TypeError("Expected the navigation parent operation.");
    }
    const second = await run(target, [operationAction({ concurrency: "queue" })]);
    const secondResult = second.steps[0]?.result;
    if (secondResult?.status !== "operation-queued") {
      throw new TypeError("Expected queued same-alias work.");
    }

    firstTransport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const descriptor = terminalDescriptor(await firstResult.settlement);
    await flushMicrotasks(120);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(invokeOperation).toHaveBeenCalledTimes(1);
    await expect(secondResult.settlement).resolves.toMatchObject({ status: "disposed" });
    expect(
      finalizeRuntimeOperationActionSettlement(target.operationActions.handle, descriptor.ticket)
        .status,
    ).toBe("disposed");
    expect(
      executeRuntimeActionTurn(target.turns.handle, {
        program: mustPrepare([]).program,
        snapshot: currentResolutionSnapshotAfterDisposal(),
      }),
    ).toEqual({ status: "disposed" });
  });
});

describe("M04-T13 navigation, disposal, and late work containment", () => {
  it("contains a drain-level completion failure and fulfills reentrant queued work", async () => {
    const holder: {
      turns?: MountedTurns;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    let queued: AcceptedTurn | undefined;
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const target = children({
      emitEvent,
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected an initialized drain-containment fixture.");
        }
        const admission = executeRuntimeActionTurn(holder.turns.handle, {
          program: holder.queuedProgram.program,
          snapshot: holder.lexicalSnapshot,
        });
        expect(admission.status).toBe("queued");
        if (admission.status !== "queued") {
          throw new TypeError("Expected reentrant work to enter the shared FIFO.");
        }
        queued = admission;
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "drain-failure-field");
    const mounted = mountRuntimeActionTurns(mountInput(target));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected a drain coordinator.");
    holder.turns = mounted;
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const originalFreeze = Object.freeze;
    let completionFailures = 0;
    const freeze = vi.spyOn(Object, "freeze").mockImplementation(((value: object) => {
      if (completionFailures === 0 && isCompletedTurnEnvelope(value)) {
        completionFailures += 1;
        throw new Error("private drain completion failure");
      }
      return originalFreeze(value);
    }) as typeof Object.freeze);
    let outer: ReturnType<typeof executeRuntimeActionTurn>;
    try {
      outer = executeRuntimeActionTurn(mounted.handle, {
        program: mustPrepare([commandAction()]).program,
        snapshot: holder.lexicalSnapshot,
      });
    } finally {
      freeze.mockRestore();
    }

    expect(completionFailures).toBe(1);
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected a contained idle admission.");
    if (queued === undefined) throw new TypeError("Expected captured reentrant work.");
    const [outerCompletion, queuedCompletion] = await Promise.all([
      outer.completion,
      queued.completion,
    ]);
    expect(outerCompletion.status).toBe("disposed");
    expect(queuedCompletion.status).toBe("disposed");
    expect(emitEvent).not.toHaveBeenCalled();
    expect(disposeRuntimeActionTurns(mounted.handle).status).toBe("already-disposed");
  });

  it("resolves navigation before queued old-surface completion while disposing children first", async () => {
    const holder: {
      turns?: MountedTurns;
      navigationProgram?: ReturnType<typeof mustPrepare>;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    const completionOrder: string[] = [];
    const queued: AcceptedTurn[] = [];
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const target = children({
      emitEvent,
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.navigationProgram === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized navigation fixture.");
        }
        const navigation = executeRuntimeActionTurn(holder.turns.handle, {
          program: holder.navigationProgram.program,
          snapshot: holder.lexicalSnapshot,
        });
        const after = executeRuntimeActionTurn(holder.turns.handle, {
          program: holder.queuedProgram.program,
          snapshot: holder.lexicalSnapshot,
        });
        expect(navigation.status).toBe("queued");
        expect(after.status).toBe("queued");
        if (navigation.status !== "queued" || after.status !== "queued") {
          throw new TypeError("Expected queued navigation and old-surface work.");
        }
        void navigation.completion.then(() => completionOrder.push("navigation"));
        void after.completion.then(() => completionOrder.push("queued"));
        queued.push(navigation, after);
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "navigation-field");
    const mounted = mountRuntimeActionTurns(mountInput(target));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected navigation coordinator.");
    holder.turns = mounted;
    holder.navigationProgram = mustPrepare([{ type: "navigate", surface: NEXT_SURFACE_ID }]);
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected navigation outer turn.");
    await outer.completion;
    const completions = await Promise.all(queued.map(({ completion }) => completion));
    await flushMicrotasks();
    expect(completions.map(({ status }) => status)).toEqual(["navigated", "disposed"]);
    expect(completionOrder).toEqual(["navigation", "queued"]);
    expect(emitEvent).not.toHaveBeenCalled();
    expect(readRuntimeSurfaceState(target.state.handle).status).toBe("disposed");
    expect(readRuntimeCommandEventActions(target.commandActions.handle).status).toBe("disposed");
  });

  it("disposes pending settlement reservations and contains late host completion", async () => {
    const transport = deferred<unknown>();
    const emitEvent = vi.fn(() => ({ status: "succeeded" as const }));
    const target = mountedFixture({
      hooks: {
        invokeOperation: () => transport.promise,
        emitEvent,
      },
    });
    const origin = await run(target, [
      operationAction({
        onSuccess: [{ type: "event.emit", name: HOST_EVENT }],
      }),
    ]);
    expect(origin.steps[0]?.result.status).toBe("operation-started");
    const disposed = disposeRuntimeActionTurns(target.turns.handle);
    expect(disposed).toMatchObject({ status: "disposed", discardedTurns: 1 });
    expect(disposeRuntimeActionTurns(target.turns.handle).status).toBe("already-disposed");

    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    await flushMicrotasks(120);
    expect(emitEvent).not.toHaveBeenCalled();
    expect(disposeRuntimeActionTurns(target.turns.handle).status).toBe("already-disposed");
  });

  it("fulfills queued completions on explicit disposal and contains forged handles", async () => {
    const holder: {
      turns?: MountedTurns;
      queuedProgram?: ReturnType<typeof mustPrepare>;
      lexicalSnapshot?: RuntimeResolutionSnapshot;
    } = {};
    const admissions: AcceptedTurn[] = [];
    const target = children({
      invokeCommand() {
        if (
          holder.turns === undefined ||
          holder.queuedProgram === undefined ||
          holder.lexicalSnapshot === undefined
        ) {
          throw new TypeError("Expected initialized disposal fixture.");
        }
        const admission = executeRuntimeActionTurn(holder.turns.handle, {
          program: holder.queuedProgram.program,
          snapshot: holder.lexicalSnapshot,
        });
        expect(admission.status).toBe("queued");
        if (admission.status !== "queued") throw new TypeError("Expected queued disposal work.");
        admissions.push(admission);
        disposeRuntimeActionTurns(holder.turns.handle);
        return { status: "succeeded" };
      },
    });
    registerCommandTarget(target, "dispose-field");
    const mounted = mountRuntimeActionTurns(mountInput(target));
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected disposal coordinator.");
    holder.turns = mounted;
    holder.queuedProgram = mustPrepare([{ type: "event.emit", name: HOST_EVENT }]);
    holder.lexicalSnapshot = currentResolution(target);

    const outer = executeRuntimeActionTurn(mounted.handle, {
      program: mustPrepare([commandAction()]).program,
      snapshot: holder.lexicalSnapshot,
    });
    expect(outer.status).toBe("started");
    if (outer.status !== "started") throw new TypeError("Expected disposal outer turn.");
    await expect(outer.completion).resolves.toMatchObject({ status: "disposed" });
    await expect(admissions[0]?.completion).resolves.toMatchObject({ status: "disposed" });
    expect(
      executeRuntimeActionTurn(Object.freeze({}) as RuntimeActionTurnsHandle, {
        program: mustPrepare([]).program,
        snapshot: holder.lexicalSnapshot,
      }),
    ).toEqual({ status: "invalid-handle" });
    expect(disposeRuntimeActionTurns(Object.freeze({}) as RuntimeActionTurnsHandle)).toMatchObject({
      status: "invalid-handle",
      discardedTurns: 0,
    });
  });
});

function currentResolutionSnapshotAfterDisposal(): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state: {},
    context: {},
    resource: {},
    operation: {},
    event: { status: "available", value: null },
    item: {},
    env: {},
  });
}
