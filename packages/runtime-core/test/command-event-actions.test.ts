import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  disposeRuntimeCommandEventActions,
  executeRuntimeCommandEventAction,
  mountRuntimeCommandEventActions,
  readRuntimeCommandEventActions,
  readRuntimeCommandEventActionsForAdapterBridge,
  registerRuntimeComponentCommandTarget,
  unregisterRuntimeComponentCommandTarget,
} from "../src/command-event-actions.js";
import {
  consumeRuntimeComponentCommandHostRequestForAdapterBridge,
  createRuntimeCommandEventHostPorts,
  emitRuntimeHostEventHostPort,
  invokeRuntimeComponentCommandHostPort,
  validateRuntimeHostEventHostPort,
} from "../src/command-event-ports.js";
import { createRuntimeHostPorts } from "../src/host-ports.js";
import {
  createRuntimeResolutionSnapshot,
  RUNTIME_VALUE_SAFETY_LIMITS,
} from "../src/value-resolution.js";

import type { DesenDiagnostic } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeCommandEventAction,
  RuntimeCommandEventActionLimitProfile,
  RuntimeCommandEventActionsHandle,
  RuntimeCommandEventActionsSnapshot,
} from "../src/command-event-actions.js";
import type {
  RuntimeCommandEventHostPorts,
  RuntimeComponentCommandHostRequest,
  RuntimeHostEventRequest,
} from "../src/command-event-ports.js";
import type { RuntimeHostPorts, RuntimeTokenRequest } from "../src/host-ports.js";

const DOCUMENT_ID = "com.desen.command-events";
const REVISION = `sha256:${"c".repeat(64)}`;
const SURFACE_ID = "sign-in";
const TEXT_FIELD = "com.example.ui/TextField";
const MAP = "com.example.maps/Map";
const FIELD_NODE = "email-field";
const MAP_NODE = "store-map";
const HOST_EVENT = "analytics / 登录";
const CONTRACT_ID = "host.contract/sign-in-submitted@1";
// The shared M04-T02 snapshot envelope consumes ten aggregate node occurrences, leaving 4,086
// visible primitive properties inside one exact 4,096-node detached object boundary.
const SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES = RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes - 10;

type MutableRecord = Record<string, unknown>;
type Mounted = Extract<
  ReturnType<typeof mountRuntimeCommandEventActions>,
  { readonly status: "mounted" }
>;

interface Options {
  readonly invoke?: (request: RuntimeComponentCommandHostRequest) => unknown;
  readonly validate?: (request: RuntimeHostEventRequest) => unknown;
  readonly emit?: (request: RuntimeHostEventRequest) => unknown;
  readonly token?: (request: RuntimeTokenRequest) => unknown;
  readonly report?: (diagnostic: DesenDiagnostic<string>) => void;
  readonly limits?: RuntimeCommandEventActionLimitProfile;
  readonly staticComponents?: Readonly<Record<string, string>>;
  readonly hostEvents?: Readonly<Record<string, string>>;
}

interface Fixture {
  readonly mounted: Mounted;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly hostPorts: RuntimeHostPorts;
  readonly commandEventPorts: RuntimeCommandEventHostPorts;
}

function preparedCatalog(): DesenValidatedExecutionCatalogSet {
  const catalog = JSON.parse(JSON.stringify(frozenWebCatalog)) as MutableRecord;
  const validation = validateDesenExecutionCatalogSet([catalog]);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("Expected a valid execution Catalog fixture.");
  return validation.value;
}

function runtimeHostPorts(options: Options = {}): RuntimeHostPorts {
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
    operations: {
      invoke: () => ({ status: "failed", errorCode: "unused" }),
    },
    resources: {
      load: () => ({ status: "failed", errorCode: "unused" }),
    },
    tokens: {
      resolve: (options.token ??
        (() => ({ status: "missing" }))) as RuntimeHostPorts["tokens"]["resolve"],
    },
    context: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({}),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 0 },
    diagnostics: { report: options.report ?? (() => undefined) },
  });
}

function bridgePorts(options: Options = {}): RuntimeCommandEventHostPorts {
  return createRuntimeCommandEventHostPorts({
    commands: {
      invoke: (options.invoke ?? (() => ({ status: "succeeded" }))) as (
        request: RuntimeComponentCommandHostRequest,
      ) => { status: "succeeded" },
    },
    events: {
      validate: (options.validate ?? (() => ({ status: "valid" }))) as (
        request: RuntimeHostEventRequest,
      ) => { status: "valid" },
      emit: (options.emit ?? (() => ({ status: "succeeded" }))) as (
        request: RuntimeHostEventRequest,
      ) => { status: "succeeded" },
    },
  });
}

function fixture(options: Options = {}): Fixture {
  const hostPorts = runtimeHostPorts(options);
  const commandEventPorts = bridgePorts(options);
  const catalogSet = preparedCatalog();
  const mounted = mountRuntimeCommandEventActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    staticComponents:
      options.staticComponents ?? Object.freeze({ [FIELD_NODE]: TEXT_FIELD, [MAP_NODE]: MAP }),
    hostEvents: options.hostEvents ?? Object.freeze({ [HOST_EVENT]: CONTRACT_ID }),
    catalogSet,
    hostPorts,
    commandEventPorts,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(mounted.status).toBe("mounted");
  if (mounted.status !== "mounted") throw new TypeError("Expected command/event mount.");
  return Object.freeze({ mounted, catalogSet, hostPorts, commandEventPorts });
}

function resolution() {
  return createRuntimeResolutionSnapshot({
    state: { enabled: true },
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function execute(
  target: Fixture,
  action: unknown,
  snapshot: RuntimeCommandEventActionsSnapshot = target.mounted.snapshot,
) {
  return executeRuntimeCommandEventAction(
    target.mounted.handle,
    action as RuntimeCommandEventAction,
    resolution(),
    snapshot,
  );
}

function register(
  target: Fixture,
  runtimeInstanceId = "field-instance-1",
  snapshot: RuntimeCommandEventActionsSnapshot = target.mounted.snapshot,
  sourceNodeId = FIELD_NODE,
  capabilityId = TEXT_FIELD,
) {
  return registerRuntimeComponentCommandTarget(target.mounted.handle, {
    sourceNodeId,
    capabilityId,
    runtimeInstanceId,
    snapshot,
  });
}

function requestContext() {
  return Object.freeze({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    requestId: "request-0",
  });
}

function commandRequest(): RuntimeComponentCommandHostRequest {
  return Object.freeze({
    context: requestContext(),
    sourceNodeId: FIELD_NODE,
    runtimeInstanceId: "field-instance-1",
    capabilityId: TEXT_FIELD,
    command: "focus",
    input: Object.freeze({}),
  });
}

function eventRequest(): RuntimeHostEventRequest {
  return Object.freeze({
    context: requestContext(),
    name: HOST_EVENT,
    contractId: CONTRACT_ID,
    payload: Object.freeze({ source: "form" }),
  });
}

function standaloneBoundaryObject(
  properties = SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES,
): Record<string, null> {
  const value = Object.create(null) as Record<string, null>;
  for (let index = 0; index < properties; index += 1) value[`field${index}`] = null;
  return value;
}

describe("M04-T12 command/event synchronous port boundary", () => {
  it("invokes all callbacks receiver-free with detached frozen requests", () => {
    const receivers: unknown[] = [];
    const requests: unknown[] = [];
    const ports = createRuntimeCommandEventHostPorts({
      commands: {
        invoke(this: unknown, request) {
          receivers.push(this);
          requests.push(request);
          return { status: "succeeded" };
        },
      },
      events: {
        validate(this: unknown, request) {
          receivers.push(this);
          requests.push(request);
          return { status: "valid" };
        },
        emit(this: unknown, request) {
          receivers.push(this);
          requests.push(request);
          return { status: "succeeded" };
        },
      },
    });

    expect(invokeRuntimeComponentCommandHostPort(ports, commandRequest())).toEqual({
      status: "succeeded",
    });
    expect(validateRuntimeHostEventHostPort(ports, eventRequest())).toEqual({
      status: "valid",
    });
    expect(emitRuntimeHostEventHostPort(ports, eventRequest())).toEqual({
      status: "succeeded",
    });
    expect(receivers).toEqual([undefined, undefined, undefined]);
    for (const request of requests) {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen((request as { context: object }).context)).toBe(true);
    }
  });

  it("brands each normalized command request for exactly one package-internal bridge consumption", () => {
    const observed: boolean[] = [];
    const invoke = (request: RuntimeComponentCommandHostRequest) => {
      observed.push(
        consumeRuntimeComponentCommandHostRequestForAdapterBridge(request, ports),
        consumeRuntimeComponentCommandHostRequestForAdapterBridge(request, ports),
      );
      return { status: "succeeded" as const };
    };
    const ports = bridgePorts({ invoke });
    const foreignPorts = bridgePorts({ invoke });
    const callerRequest = commandRequest();
    expect(consumeRuntimeComponentCommandHostRequestForAdapterBridge(callerRequest, ports)).toBe(
      false,
    );
    expect(invokeRuntimeComponentCommandHostPort(ports, callerRequest)).toEqual({
      status: "succeeded",
    });
    expect(invokeRuntimeComponentCommandHostPort(foreignPorts, callerRequest)).toEqual({
      status: "succeeded",
    });
    expect(observed).toEqual([true, false, false, false]);

    let retained: RuntimeComponentCommandHostRequest | undefined;
    const unconsumedPorts = bridgePorts({
      invoke(request) {
        retained = request;
        return { status: "succeeded" };
      },
    });
    expect(invokeRuntimeComponentCommandHostPort(unconsumedPorts, callerRequest)).toEqual({
      status: "succeeded",
    });
    if (retained === undefined) throw new TypeError("Expected normalized request capture.");
    expect(
      consumeRuntimeComponentCommandHostRequestForAdapterBridge(retained, unconsumedPorts),
    ).toBe(false);
  });

  it("rejects accessor-bearing factory shapes without invoking getters", () => {
    const getter = vi.fn(() => ({ invoke: () => ({ status: "succeeded" }) }));
    const input = {
      events: { validate: () => ({ status: "valid" }), emit: () => ({ status: "succeeded" }) },
    };
    Object.defineProperty(input, "commands", { enumerable: true, get: getter });
    expect(() =>
      createRuntimeCommandEventHostPorts(
        input as unknown as Parameters<typeof createRuntimeCommandEventHostPorts>[0],
      ),
    ).toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    [
      "throw",
      () => {
        throw new Error("private");
      },
    ],
    ["promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "other" })],
    ["extra", () => ({ status: "succeeded", private: "secret" })],
  ])("normalizes %s command results into redacted adapter failure", (_label, invoke) => {
    const ports = bridgePorts({ invoke });
    expect(invokeRuntimeComponentCommandHostPort(ports, commandRequest())).toEqual({
      status: "adapter-failed",
    });
  });

  it("rejects malformed nested request contexts before any callback", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const ports = bridgePorts({ invoke });
    const getter = vi.fn(() => "leak");
    const context = { ...requestContext() } as Record<string, unknown>;
    Object.defineProperty(context, "private", { enumerable: true, get: getter });
    expect(
      invokeRuntimeComponentCommandHostPort(ports, {
        ...commandRequest(),
        context: context as unknown as ReturnType<typeof requestContext>,
      }),
    ).toEqual({ status: "adapter-failed" });
    expect(getter).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects top-level accessors, symbols, and extra keys without invoking getters", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const ports = bridgePorts({ invoke });
    const getter = vi.fn(() => Object.freeze({}));
    const accessor = { ...commandRequest() } as Record<PropertyKey, unknown>;
    Object.defineProperty(accessor, "input", { enumerable: true, get: getter });
    expect(
      invokeRuntimeComponentCommandHostPort(
        ports,
        accessor as unknown as RuntimeComponentCommandHostRequest,
      ),
    ).toEqual({ status: "adapter-failed" });

    const symbol = { ...commandRequest(), [Symbol("private")]: true };
    expect(
      invokeRuntimeComponentCommandHostPort(
        ports,
        symbol as unknown as RuntimeComponentCommandHostRequest,
      ),
    ).toEqual({ status: "adapter-failed" });

    const extra = { ...commandRequest(), private: true };
    expect(
      invokeRuntimeComponentCommandHostPort(
        ports,
        extra as unknown as RuntimeComponentCommandHostRequest,
      ),
    ).toEqual({ status: "adapter-failed" });
    expect(getter).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("accepts the shared 4,096-node aggregate boundary with 4,086 payload properties and no bridge-envelope tax", () => {
    const invoke = vi.fn((request: RuntimeComponentCommandHostRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const validate = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "valid" as const };
    });
    const emit = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const ports = bridgePorts({ invoke, validate, emit });
    const exactInput = standaloneBoundaryObject();
    const exactPayload = standaloneBoundaryObject();

    expect(
      invokeRuntimeComponentCommandHostPort(ports, {
        ...commandRequest(),
        input: exactInput,
      }),
    ).toEqual({ status: "succeeded" });
    expect(
      validateRuntimeHostEventHostPort(ports, {
        ...eventRequest(),
        payload: exactPayload,
      }),
    ).toEqual({ status: "valid" });
    expect(
      emitRuntimeHostEventHostPort(ports, {
        ...eventRequest(),
        payload: exactPayload,
      }),
    ).toEqual({ status: "succeeded" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(Object.keys(invoke.mock.calls[0]?.[0].input ?? {})).toHaveLength(
      SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES,
    );
    expect(Object.isFrozen(invoke.mock.calls[0]?.[0].input)).toBe(true);
    expect(Object.isFrozen(validate.mock.calls[0]?.[0].payload)).toBe(true);
  });

  it("accepts canonical metadata strings at their exact per-string ceiling", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const validate = vi.fn(() => ({ status: "valid" as const }));
    const ports = bridgePorts({ invoke, validate });
    const exact = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits);

    expect(
      invokeRuntimeComponentCommandHostPort(ports, {
        ...commandRequest(),
        context: { ...requestContext(), documentId: exact },
        command: exact,
      }),
    ).toEqual({ status: "succeeded" });
    expect(
      validateRuntimeHostEventHostPort(ports, {
        ...eventRequest(),
        name: exact,
        contractId: exact,
      }),
    ).toEqual({ status: "valid" });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(validate).toHaveBeenCalledTimes(1);

    expect(
      invokeRuntimeComponentCommandHostPort(ports, {
        ...commandRequest(),
        command: `${exact}x`,
      }),
    ).toEqual({ status: "adapter-failed" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("rejects the shared aggregate node ceiling plus one before any bridge callback", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const validate = vi.fn(() => ({ status: "valid" as const }));
    const emit = vi.fn(() => ({ status: "succeeded" as const }));
    const ports = bridgePorts({ invoke, validate, emit });
    const oversized = standaloneBoundaryObject(SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES + 1);

    expect(
      invokeRuntimeComponentCommandHostPort(ports, {
        ...commandRequest(),
        input: oversized,
      }),
    ).toEqual({ status: "adapter-failed" });
    expect(
      validateRuntimeHostEventHostPort(ports, {
        ...eventRequest(),
        payload: oversized,
      }),
    ).toEqual({ status: "adapter-failed" });
    expect(
      emitRuntimeHostEventHostPort(ports, {
        ...eventRequest(),
        payload: oversized,
      }),
    ).toEqual({ status: "adapter-failed" });
    expect(invoke).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("normalizes event validation and emission promises, throws, and malformed envelopes", () => {
    const validationPromise = bridgePorts({ validate: () => Promise.resolve({ status: "valid" }) });
    const emissionThrow = bridgePorts({
      emit: () => {
        throw new Error("private");
      },
    });
    const malformed = bridgePorts({ validate: () => ({ status: "valid", extra: true }) });
    expect(validateRuntimeHostEventHostPort(validationPromise, eventRequest())).toEqual({
      status: "adapter-failed",
    });
    expect(emitRuntimeHostEventHostPort(emissionThrow, eventRequest())).toEqual({
      status: "adapter-failed",
    });
    expect(validateRuntimeHostEventHostPort(malformed, eventRequest())).toEqual({
      status: "adapter-failed",
    });
  });
});

describe("M04-T12 mount and live-target authority", () => {
  it("mounts without observing any host callback and accepts Unicode event names", () => {
    const invoke = vi.fn();
    const validate = vi.fn();
    const emit = vi.fn();
    const token = vi.fn();
    const report = vi.fn();
    const mounted = fixture({ invoke, validate, emit, token, report });
    expect(mounted.mounted.snapshot).toEqual({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      liveTargets: {},
    });
    expect(
      [invoke, validate, emit, token, report].every((mock) => mock.mock.calls.length === 0),
    ).toBe(true);
  });

  it("rejects forged Catalog and command/event authorities atomically", () => {
    const valid = fixture();
    const forgedCatalog = mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: { [FIELD_NODE]: TEXT_FIELD },
      hostEvents: {},
      catalogSet: [] as unknown as DesenValidatedExecutionCatalogSet,
      hostPorts: valid.hostPorts,
      commandEventPorts: valid.commandEventPorts,
    });
    expect(forgedCatalog).toMatchObject({ status: "invalid", reason: "catalog-set-invalid" });

    const forgedPorts = mountRuntimeCommandEventActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      staticComponents: { [FIELD_NODE]: TEXT_FIELD },
      hostEvents: {},
      catalogSet: preparedCatalog(),
      hostPorts: valid.hostPorts,
      commandEventPorts: {} as RuntimeCommandEventHostPorts,
    });
    expect(forgedPorts).toMatchObject({
      status: "invalid",
      reason: "invalid-command-event-ports",
    });
  });

  it("rejects every explicitly null limit instead of widening it to a default", () => {
    const valid = fixture();
    for (const key of [
      "maxActionGeneration",
      "maxRegistrationGeneration",
      "maxSnapshotGeneration",
      "maxLiveTargets",
      "maxStaticComponents",
      "maxHostEvents",
      "maxRetainedIdentifierCodeUnits",
      "maxRuntimeInstanceIdCodeUnits",
    ] as const) {
      const result = mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents: { [FIELD_NODE]: TEXT_FIELD },
        hostEvents: { [HOST_EVENT]: CONTRACT_ID },
        catalogSet: preparedCatalog(),
        hostPorts: valid.hostPorts,
        commandEventPorts: valid.commandEventPorts,
        limits: { [key]: null } as unknown as RuntimeCommandEventActionLimitProfile,
      });
      expect(result).toMatchObject({ status: "invalid", reason: "malformed-input" });
    }
  });

  it("accepts exactly 5,000 short static entries and rejects 5,001 before value observation", () => {
    const valid = fixture();
    const staticComponents = Object.fromEntries(
      Array.from({ length: 5_000 }, (_unused, index) => [`node${index}`, TEXT_FIELD]),
    );
    expect(
      mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents,
        hostEvents: {},
        catalogSet: preparedCatalog(),
        hostPorts: valid.hostPorts,
        commandEventPorts: valid.commandEventPorts,
      }),
    ).toMatchObject({ status: "mounted" });

    const getter = vi.fn(() => TEXT_FIELD);
    const overflow = Object.create(null) as Record<string, unknown>;
    for (let index = 0; index < 5_001; index += 1) {
      Object.defineProperty(overflow, `node${index}`, {
        enumerable: true,
        get: getter,
      });
    }
    expect(
      mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents: overflow as Readonly<Record<string, string>>,
        hostEvents: {},
        catalogSet: preparedCatalog(),
        hostPorts: valid.hostPorts,
        commandEventPorts: valid.commandEventPorts,
      }),
    ).toMatchObject({ status: "invalid", reason: "registry-limit" });
    expect(getter).not.toHaveBeenCalled();
  });

  it("applies lowered entry and aggregate identifier ceilings before map value observation", () => {
    const valid = fixture();
    const getter = vi.fn(() => TEXT_FIELD);
    const overflow = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(overflow, {
      first: { enumerable: true, get: getter },
      second: { enumerable: true, get: getter },
    });
    expect(
      mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents: overflow as Readonly<Record<string, string>>,
        hostEvents: {},
        catalogSet: preparedCatalog(),
        hostPorts: valid.hostPorts,
        commandEventPorts: valid.commandEventPorts,
        limits: { maxStaticComponents: 1 },
      }),
    ).toMatchObject({ status: "invalid", reason: "registry-limit" });
    expect(getter).not.toHaveBeenCalled();

    expect(
      mountRuntimeCommandEventActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        staticComponents: { field: TEXT_FIELD },
        hostEvents: {},
        catalogSet: preparedCatalog(),
        hostPorts: valid.hostPorts,
        commandEventPorts: valid.commandEventPorts,
        limits: { maxRetainedIdentifierCodeUnits: 8 },
      }),
    ).toMatchObject({ status: "invalid", reason: "registry-limit" });
  });

  it("registers inert identities and publishes frozen exact snapshots", () => {
    const target = fixture();
    const result = register(target);
    expect(result).toMatchObject({
      status: "registered",
      sourceNodeId: FIELD_NODE,
      runtimeInstanceId: "field-instance-1",
      registrationGeneration: 0,
    });
    if (result.status !== "registered") throw new TypeError("Expected registration.");
    expect(result.snapshot.generation).toBe(1);
    expect(result.snapshot.liveTargets[FIELD_NODE]).toEqual({
      capabilityId: TEXT_FIELD,
      instances: [{ runtimeInstanceId: "field-instance-1", registrationGeneration: 0 }],
    });
    expect(Object.isFrozen(result.snapshot.liveTargets[FIELD_NODE]?.instances)).toBe(true);
    expect(JSON.stringify(result.snapshot)).not.toContain("invoke");
  });

  it("reads the exact current snapshot without callbacks, effects, receiver dependence, or generation drift", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const validate = vi.fn(() => ({ status: "valid" as const }));
    const emit = vi.fn(() => ({ status: "succeeded" as const }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const target = fixture({ invoke, validate, emit, token, report });
    const detachedRead = readRuntimeCommandEventActions;

    const initial = Reflect.apply(detachedRead, Object.freeze({ foreign: true }), [
      target.mounted.handle,
    ]);
    expect(initial).toEqual({ status: "read", snapshot: target.mounted.snapshot });
    if (initial.status !== "read") throw new TypeError("Expected current registry read.");
    expect(initial.snapshot).toBe(target.mounted.snapshot);
    expect(initial.snapshot.generation).toBe(0);

    const registered = register(target);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    const current = readRuntimeCommandEventActions(target.mounted.handle);
    expect(current).toEqual({ status: "read", snapshot: registered.snapshot });
    if (current.status !== "read") throw new TypeError("Expected current registry read.");
    expect(current.snapshot).toBe(registered.snapshot);
    expect(current.snapshot.generation).toBe(1);

    expect(invoke).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("reads exact adapter-bridge Catalog and snapshot authorities without callbacks, effects, or generation drift", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const validate = vi.fn(() => ({ status: "valid" as const }));
    const emit = vi.fn(() => ({ status: "succeeded" as const }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const target = fixture({ invoke, validate, emit, token, report });
    const detachedRead = readRuntimeCommandEventActionsForAdapterBridge;

    const initial = Reflect.apply(detachedRead, Object.freeze({ foreign: true }), [
      target.mounted.handle,
    ]);
    expect(initial).toEqual({
      status: "read",
      catalogSet: target.catalogSet,
      commandEventPorts: target.commandEventPorts,
      snapshot: target.mounted.snapshot,
    });
    if (initial.status !== "read") throw new TypeError("Expected adapter-bridge authority read.");
    expect(initial.catalogSet).toBe(target.catalogSet);
    expect(initial.commandEventPorts).toBe(target.commandEventPorts);
    expect(initial.snapshot).toBe(target.mounted.snapshot);
    expect(Object.isFrozen(initial)).toBe(true);

    const repeated = readRuntimeCommandEventActionsForAdapterBridge(target.mounted.handle);
    expect(repeated).toEqual(initial);
    if (repeated.status !== "read") throw new TypeError("Expected repeated adapter-bridge read.");
    expect(repeated.catalogSet).toBe(initial.catalogSet);
    expect(repeated.commandEventPorts).toBe(initial.commandEventPorts);
    expect(repeated.snapshot).toBe(initial.snapshot);
    expect(readRuntimeCommandEventActions(target.mounted.handle)).toEqual({
      status: "read",
      snapshot: initial.snapshot,
    });
    expect(
      [invoke, validate, emit, token, report].every((mock) => mock.mock.calls.length === 0),
    ).toBe(true);

    const registered = register(target);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    expect(registered.registrationGeneration).toBe(0);
    expect(registered.snapshot.generation).toBe(1);
    const current = readRuntimeCommandEventActionsForAdapterBridge(target.mounted.handle);
    expect(current).toEqual({
      status: "read",
      catalogSet: target.catalogSet,
      commandEventPorts: target.commandEventPorts,
      snapshot: registered.snapshot,
    });
    if (current.status !== "read") throw new TypeError("Expected current adapter-bridge read.");
    expect(current.catalogSet).toBe(target.catalogSet);
    expect(current.commandEventPorts).toBe(target.commandEventPorts);
    expect(current.snapshot).toBe(registered.snapshot);
    expect(invoke).not.toHaveBeenCalled();

    expect(
      execute(
        target,
        { type: "component.command", target: FIELD_NODE, command: "focus" },
        registered.snapshot,
      ),
    ).toMatchObject({
      status: "command-succeeded",
      requestId: 'command-event-action:["sign-in",0]',
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("fails adapter-bridge reads closed for forged and disposed handles without cross-authority leakage", () => {
    const left = fixture();
    const right = fixture();
    const rightRegistration = register(right, "right-bridge-instance");
    if (rightRegistration.status !== "registered") {
      throw new TypeError("Expected right adapter-bridge registration.");
    }

    expect(
      readRuntimeCommandEventActionsForAdapterBridge(
        Object.freeze({}) as RuntimeCommandEventActionsHandle,
      ),
    ).toEqual({ status: "invalid-handle" });
    const foreign = readRuntimeCommandEventActionsForAdapterBridge(right.mounted.handle);
    expect(foreign).toEqual({
      status: "read",
      catalogSet: right.catalogSet,
      commandEventPorts: right.commandEventPorts,
      snapshot: rightRegistration.snapshot,
    });
    if (foreign.status !== "read") throw new TypeError("Expected foreign adapter-bridge read.");
    expect(foreign.catalogSet).toBe(right.catalogSet);
    expect(foreign.commandEventPorts).toBe(right.commandEventPorts);
    expect(foreign.commandEventPorts).not.toBe(left.commandEventPorts);
    expect(foreign.catalogSet).not.toBe(left.catalogSet);
    expect(foreign.snapshot).toBe(rightRegistration.snapshot);
    expect(foreign.snapshot).not.toBe(left.mounted.snapshot);

    expect(disposeRuntimeCommandEventActions(left.mounted.handle)).toEqual({
      status: "disposed",
      disposedTargets: 0,
    });
    expect(readRuntimeCommandEventActionsForAdapterBridge(left.mounted.handle)).toEqual({
      status: "disposed",
    });
    const rightAfterLeftDisposal = readRuntimeCommandEventActionsForAdapterBridge(
      right.mounted.handle,
    );
    expect(rightAfterLeftDisposal).toEqual(foreign);
    if (rightAfterLeftDisposal.status !== "read") {
      throw new TypeError("Expected independent live adapter-bridge authority.");
    }
    expect(rightAfterLeftDisposal.catalogSet).toBe(right.catalogSet);
    expect(rightAfterLeftDisposal.commandEventPorts).toBe(right.commandEventPorts);
    expect(rightAfterLeftDisposal.snapshot).toBe(rightRegistration.snapshot);
  });

  it("contains forged, foreign, and revoked read authorities without leaking another registry", () => {
    const left = fixture();
    const right = fixture();
    const rightRegistration = register(right, "right-instance");
    if (rightRegistration.status !== "registered") {
      throw new TypeError("Expected right registration.");
    }

    expect(
      readRuntimeCommandEventActions(Object.freeze({}) as RuntimeCommandEventActionsHandle),
    ).toEqual({ status: "invalid-handle" });
    const foreign = readRuntimeCommandEventActions(right.mounted.handle);
    expect(foreign).toEqual({ status: "read", snapshot: rightRegistration.snapshot });
    if (foreign.status !== "read") throw new TypeError("Expected foreign manager read.");
    expect(foreign.snapshot).toBe(rightRegistration.snapshot);
    expect(foreign.snapshot).not.toBe(left.mounted.snapshot);

    expect(disposeRuntimeCommandEventActions(left.mounted.handle)).toEqual({
      status: "disposed",
      disposedTargets: 0,
    });
    expect(readRuntimeCommandEventActions(left.mounted.handle)).toEqual({
      status: "disposed",
    });
    expect(readRuntimeCommandEventActions(right.mounted.handle)).toEqual({
      status: "read",
      snapshot: rightRegistration.snapshot,
    });
  });

  it("supports repeated instances but makes their source target ambiguous until one leaves", () => {
    const target = fixture();
    const first = register(target);
    if (first.status !== "registered") throw new TypeError("Expected first registration.");
    const second = register(target, "field-instance-2", first.snapshot);
    if (second.status !== "registered") throw new TypeError("Expected second registration.");

    expect(
      execute(
        target,
        { type: "component.command", target: FIELD_NODE, command: "focus" },
        second.snapshot,
      ),
    ).toMatchObject({
      status: "command-target-unavailable",
      reason: "ambiguous",
    });
    const removed = unregisterRuntimeComponentCommandTarget(target.mounted.handle, {
      ticket: second.ticket,
      snapshot: second.snapshot,
    });
    if (removed.status !== "unregistered") throw new TypeError("Expected unregister.");
    expect(
      execute(
        target,
        { type: "component.command", target: FIELD_NODE, command: "focus" },
        removed.snapshot,
      ),
    ).toMatchObject({
      status: "command-succeeded",
      runtimeInstanceId: "field-instance-1",
    });
  });

  it("rejects duplicate instance identity, static mismatch, stale snapshots, and foreign tickets", () => {
    const left = fixture();
    const right = fixture();
    const registered = register(left);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    expect(register(left, "field-instance-1", registered.snapshot)).toMatchObject({
      status: "already-registered",
      runtimeInstanceId: "field-instance-1",
    });
    expect(register(left, "field-instance-2", left.mounted.snapshot)).toMatchObject({
      status: "invalid-snapshot",
    });
    expect(register(left, "map", registered.snapshot, FIELD_NODE, MAP)).toMatchObject({
      status: "capability-mismatch",
    });
    expect(
      unregisterRuntimeComponentCommandTarget(right.mounted.handle, {
        ticket: registered.ticket,
        snapshot: right.mounted.snapshot,
      }),
    ).toEqual({ status: "invalid-ticket" });
  });

  it("rejects non-JSON Unicode runtime identities without registry or snapshot drift", () => {
    const target = fixture();
    for (const runtimeInstanceId of ["\ud800", "\udc00"]) {
      expect(register(target, runtimeInstanceId)).toEqual({
        status: "malformed-request",
      });
    }
    expect(target.mounted.snapshot).toMatchObject({
      generation: 0,
      liveTargets: {},
    });
  });

  it("prevents ticket reuse and ABA removal after re-registration", () => {
    const target = fixture();
    const first = register(target);
    if (first.status !== "registered") throw new TypeError("Expected first registration.");
    const removed = unregisterRuntimeComponentCommandTarget(target.mounted.handle, {
      ticket: first.ticket,
      snapshot: first.snapshot,
    });
    if (removed.status !== "unregistered") throw new TypeError("Expected removal.");
    const second = register(target, "field-instance-1", removed.snapshot);
    if (second.status !== "registered") throw new TypeError("Expected second registration.");
    expect(second.registrationGeneration).toBe(1);
    expect(
      unregisterRuntimeComponentCommandTarget(target.mounted.handle, {
        ticket: first.ticket,
        snapshot: second.snapshot,
      }),
    ).toEqual({ status: "stale-ticket" });
  });

  it("enforces registry, registration, and snapshot generation ceilings without partial mutation", () => {
    const registry = fixture({ limits: { maxLiveTargets: 0 } });
    expect(register(registry)).toEqual({ status: "registry-limit" });
    expect(registry.mounted.snapshot.liveTargets).toEqual({});

    const registration = fixture({ limits: { maxRegistrationGeneration: 0 } });
    const first = register(registration);
    if (first.status !== "registered") throw new TypeError("Expected first registration.");
    const removed = unregisterRuntimeComponentCommandTarget(registration.mounted.handle, {
      ticket: first.ticket,
      snapshot: first.snapshot,
    });
    if (removed.status !== "unregistered") throw new TypeError("Expected unregister.");
    expect(register(registration, "second", removed.snapshot)).toEqual({
      status: "registration-limit",
    });

    const snapshots = fixture({ limits: { maxSnapshotGeneration: 0 } });
    expect(register(snapshots)).toEqual({ status: "snapshot-limit" });
    expect(snapshots.mounted.snapshot.liveTargets).toEqual({});

    const noUnregisterCapacity = fixture({ limits: { maxSnapshotGeneration: 1 } });
    expect(register(noUnregisterCapacity)).toEqual({ status: "snapshot-limit" });
    expect(noUnregisterCapacity.mounted.snapshot.liveTargets).toEqual({});

    const exactCapacity = fixture({ limits: { maxSnapshotGeneration: 2 } });
    const exactRegistration = register(exactCapacity);
    if (exactRegistration.status !== "registered") {
      throw new TypeError("Expected registration with reserved unregister capacity.");
    }
    const exactUnregister = unregisterRuntimeComponentCommandTarget(exactCapacity.mounted.handle, {
      ticket: exactRegistration.ticket,
      snapshot: exactRegistration.snapshot,
    });
    expect(exactUnregister).toMatchObject({
      status: "unregistered",
      snapshot: { generation: 2, liveTargets: {} },
    });
  });

  it("holds transition ownership during hostile registration reflection", () => {
    const target = fixture();
    const nested: string[] = [];
    const request = new Proxy(
      {
        sourceNodeId: FIELD_NODE,
        capabilityId: TEXT_FIELD,
        runtimeInstanceId: "outer",
        snapshot: target.mounted.snapshot,
      },
      {
        getPrototypeOf(value) {
          nested.push(registerRuntimeComponentCommandTarget(target.mounted.handle, value).status);
          return Object.getPrototypeOf(value);
        },
      },
    );
    expect(registerRuntimeComponentCommandTarget(target.mounted.handle, request)).toMatchObject({
      status: "registered",
    });
    expect(nested).toEqual(["busy"]);
  });

  it("lets reflection-time disposal win without publishing a partial registration", () => {
    const target = fixture();
    const disposal: unknown[] = [];
    const request = new Proxy(
      {
        sourceNodeId: FIELD_NODE,
        capabilityId: TEXT_FIELD,
        runtimeInstanceId: "outer",
        snapshot: target.mounted.snapshot,
      },
      {
        getPrototypeOf(value) {
          disposal.push(disposeRuntimeCommandEventActions(target.mounted.handle));
          return Object.getPrototypeOf(value);
        },
      },
    );
    expect(registerRuntimeComponentCommandTarget(target.mounted.handle, request)).toEqual({
      status: "disposed",
    });
    expect(disposal).toEqual([{ status: "disposed", disposedTargets: 0 }]);
  });
});

describe("M04-T12 component.command", () => {
  it("routes a declared schema-valid command only to the sole live runtime identity", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const target = fixture({ invoke });
    const registered = register(target);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    const result = execute(
      target,
      { type: "component.command", target: FIELD_NODE, command: "focus" },
      registered.snapshot,
    );
    expect(result).toMatchObject({
      status: "command-succeeded",
      requestId: 'command-event-action:["sign-in",0]',
      capabilityId: TEXT_FIELD,
      runtimeInstanceId: "field-instance-1",
    });
    expect(invoke).toHaveBeenCalledWith({
      context: {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        requestId: 'command-event-action:["sign-in",0]',
      },
      sourceNodeId: FIELD_NODE,
      runtimeInstanceId: "field-instance-1",
      capabilityId: TEXT_FIELD,
      command: "focus",
      input: {},
    });
  });

  it("proves required-input command declaration before materializing and accepts valid input", () => {
    const invoke = vi.fn((request: RuntimeComponentCommandHostRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const target = fixture({ invoke });
    const registered = register(target, "map-instance", target.mounted.snapshot, MAP_NODE, MAP);
    if (registered.status !== "registered") throw new TypeError("Expected map registration.");
    expect(
      execute(
        target,
        {
          type: "component.command",
          target: MAP_NODE,
          command: "fitBounds",
          input: { bounds: { north: 1 } },
        },
        registered.snapshot,
      ),
    ).toMatchObject({ status: "command-succeeded" });
    expect(invoke.mock.calls[0]?.[0].input).toEqual({ bounds: { north: 1 } });
  });

  it("rejects unknown static targets, undeclared commands, and unavailable targets before input observation", () => {
    const input = vi.fn(() => ({ secret: true }));
    const command = vi.fn(() => "focus");
    const target = fixture();
    const unknownTarget = { type: "component.command", target: "missing" } as Record<
      string,
      unknown
    >;
    Object.defineProperty(unknownTarget, "command", { enumerable: true, get: command });
    Object.defineProperty(unknownTarget, "input", { enumerable: true, get: input });
    expect(execute(target, unknownTarget)).toMatchObject({
      status: "unknown-command-target",
    });
    expect(command).not.toHaveBeenCalled();

    for (const action of [
      { type: "component.command", target: FIELD_NODE, command: "missing" },
      { type: "component.command", target: FIELD_NODE, command: "focus" },
    ]) {
      Object.defineProperty(action, "input", { enumerable: true, get: input });
      const result = execute(target, action);
      expect(["unknown-command", "command-target-unavailable"]).toContain(result.status);
    }
    expect(input).not.toHaveBeenCalled();
  });

  it("rejects invalid resolved command input with COMMAND_INPUT_INVALID and no host call", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const target = fixture({ invoke });
    const registered = register(target, "map-instance", target.mounted.snapshot, MAP_NODE, MAP);
    if (registered.status !== "registered") throw new TypeError("Expected map registration.");
    const result = execute(
      target,
      {
        type: "component.command",
        target: MAP_NODE,
        command: "fitBounds",
        input: { bounds: "wrong" },
      },
      registered.snapshot,
    );
    expect(result.status).toBe("command-input-rejected");
    if (result.status !== "command-input-rejected") throw new TypeError("Expected rejection.");
    expect(result.diagnostics.map(({ code }) => code)).toContain("COMMAND_INPUT_INVALID");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("rejects command input shared-node ceiling plus one during materialization with no bridge call", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const }));
    const target = fixture({ invoke });
    const registered = register(target);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    expect(
      execute(
        target,
        {
          type: "component.command",
          target: FIELD_NODE,
          command: "focus",
          input: standaloneBoundaryObject(SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES + 1),
        },
        registered.snapshot,
      ),
    ).toMatchObject({ status: "payload-rejected", reason: "invalid" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("shares one token capture across a true guard and command input", () => {
    const token = vi.fn(() => ({ status: "resolved" as const, value: true }));
    const invoke = vi.fn((request: RuntimeComponentCommandHostRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const target = fixture({ token, invoke });
    const registered = register(target, "map-instance", target.mounted.snapshot, MAP_NODE, MAP);
    if (registered.status !== "registered") throw new TypeError("Expected map registration.");
    expect(
      execute(
        target,
        {
          type: "component.command",
          target: MAP_NODE,
          command: "fitBounds",
          when: { op: "truthy", args: [{ $token: "shared" }] },
          input: { bounds: { active: { $token: "shared" } } },
        },
        registered.snapshot,
      ),
    ).toMatchObject({ status: "command-succeeded" });
    expect(token).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0].input).toEqual({ bounds: { active: true } });
  });

  it("keeps a false guard free of action payload, command, bridge, and diagnostic observations", () => {
    const invoke = vi.fn();
    const report = vi.fn();
    const target = fixture({ invoke, report });
    const type = vi.fn(() => "component.command");
    const targetGetter = vi.fn(() => FIELD_NODE);
    const command = vi.fn(() => "focus");
    const input = vi.fn(() => ({}));
    const extension = vi.fn(() => ({}));
    const action = { when: { op: "truthy", args: [false] } } as Record<string, unknown>;
    Object.defineProperty(action, "type", { enumerable: true, get: type });
    Object.defineProperty(action, "target", { enumerable: true, get: targetGetter });
    Object.defineProperty(action, "command", { enumerable: true, get: command });
    Object.defineProperty(action, "input", { enumerable: true, get: input });
    Object.defineProperty(action, "extensions", { enumerable: true, get: extension });
    expect(execute(target, action)).toEqual({ status: "skipped", diagnostics: [] });
    expect(type).not.toHaveBeenCalled();
    expect(targetGetter).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
    expect(extension).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    ["denied", () => ({ status: "denied" })],
    [
      "throw",
      () => {
        throw new Error("private");
      },
    ],
    ["promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "succeeded", extra: true })],
  ])("returns controlled %s command outcome", (_label, invoke) => {
    const target = fixture({ invoke });
    const registered = register(target);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    const result = execute(
      target,
      { type: "component.command", target: FIELD_NODE, command: "focus" },
      registered.snapshot,
    );
    expect(["command-denied", "adapter-failed"]).toContain(result.status);
    expect(JSON.stringify(result)).not.toContain("private");
  });
});

describe("M04-T12 event.emit", () => {
  it("validates the exact allowlisted contract before emitting one detached payload", () => {
    const order: string[] = [];
    const validate = vi.fn((request: RuntimeHostEventRequest) => {
      order.push(`validate:${request.contractId}`);
      return { status: "valid" as const };
    });
    const emit = vi.fn((request: RuntimeHostEventRequest) => {
      order.push(`emit:${request.contractId}`);
      return { status: "succeeded" as const };
    });
    const target = fixture({ validate, emit });
    expect(
      execute(target, {
        type: "event.emit",
        name: HOST_EVENT,
        payload: { source: "form" },
      }),
    ).toMatchObject({
      status: "event-emitted",
      requestId: 'command-event-action:["sign-in",0]',
      contractId: CONTRACT_ID,
    });
    expect(order).toEqual([`validate:${CONTRACT_ID}`, `emit:${CONTRACT_ID}`]);
    expect(validate.mock.calls[0]?.[0].payload).toEqual({ source: "form" });
  });

  it("rejects an unknown name before payload or host observation", () => {
    const payload = vi.fn(() => ({ secret: true }));
    const validate = vi.fn();
    const emit = vi.fn();
    const target = fixture({ validate, emit });
    const action = { type: "event.emit", name: "not allowed" } as Record<string, unknown>;
    Object.defineProperty(action, "payload", { enumerable: true, get: payload });
    expect(execute(target, action)).toMatchObject({ status: "host-event-not-allowlisted" });
    expect(payload).not.toHaveBeenCalled();
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("rejects non-JSON Unicode event names without validation, emission, or unsafe result text", () => {
    const validate = vi.fn();
    const emit = vi.fn();
    const target = fixture({ validate, emit });
    for (const name of ["\ud800", "\udc00"]) {
      const result = execute(target, { type: "event.emit", name });
      expect(result).toMatchObject({ status: "invalid-action" });
      expect(JSON.stringify(result)).not.toContain("\\ud800");
      expect(JSON.stringify(result)).not.toContain("\\udc00");
    }
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("uses an empty object for an omitted payload", () => {
    const validate = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "valid" as const };
    });
    const emit = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const target = fixture({ validate, emit });
    expect(execute(target, { type: "event.emit", name: HOST_EVENT })).toMatchObject({
      status: "event-emitted",
    });
    expect(validate.mock.calls[0]?.[0].payload).toEqual({});
    expect(emit.mock.calls[0]?.[0].payload).toEqual({});
  });

  it("carries the exact shared aggregate payload boundary through materialization, validation, and emission", () => {
    const validate = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "valid" as const };
    });
    const emit = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const target = fixture({ validate, emit });
    expect(
      execute(target, {
        type: "event.emit",
        name: HOST_EVENT,
        payload: standaloneBoundaryObject(),
      }),
    ).toMatchObject({ status: "event-emitted" });
    expect(validate).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(Object.keys(validate.mock.calls[0]?.[0].payload ?? {})).toHaveLength(
      SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES,
    );
    expect(Object.keys(emit.mock.calls[0]?.[0].payload ?? {})).toHaveLength(
      SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES,
    );
  });

  it("shares one token capture across a true event guard and payload", () => {
    const token = vi.fn(() => ({ status: "resolved" as const, value: true }));
    const emit = vi.fn((request: RuntimeHostEventRequest) => {
      void request;
      return { status: "succeeded" as const };
    });
    const target = fixture({ token, emit });
    expect(
      execute(target, {
        type: "event.emit",
        name: HOST_EVENT,
        when: { op: "truthy", args: [{ $token: "shared" }] },
        payload: { enabled: { $token: "shared" } },
      }),
    ).toMatchObject({ status: "event-emitted" });
    expect(token).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[0].payload).toEqual({ enabled: true });
  });

  it("rejects event payload shared-node ceiling plus one during materialization with no host call", () => {
    const validate = vi.fn(() => ({ status: "valid" as const }));
    const emit = vi.fn(() => ({ status: "succeeded" as const }));
    const target = fixture({ validate, emit });
    expect(
      execute(target, {
        type: "event.emit",
        name: HOST_EVENT,
        payload: standaloneBoundaryObject(SHARED_SNAPSHOT_MAX_OBJECT_PROPERTIES + 1),
      }),
    ).toMatchObject({ status: "payload-rejected", reason: "invalid" });
    expect(validate).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it("enforces the accepted action-generation ceiling", () => {
    const target = fixture({ limits: { maxActionGeneration: 0 } });
    expect(execute(target, { type: "event.emit", name: HOST_EVENT })).toMatchObject({
      status: "event-emitted",
      requestId: 'command-event-action:["sign-in",0]',
    });
    expect(execute(target, { type: "event.emit", name: HOST_EVENT })).toEqual({
      status: "action-limit",
    });
  });

  it("never emits after invalid, throwing, promised, or malformed validation", () => {
    const validators = [
      () => ({ status: "invalid" }),
      () => {
        throw new Error("private");
      },
      () => Promise.resolve({ status: "valid" }),
      () => ({ status: "valid", extra: true }),
    ];
    for (const validate of validators) {
      const emit = vi.fn();
      const target = fixture({ validate, emit });
      const result = execute(target, { type: "event.emit", name: HOST_EVENT });
      expect(["host-event-payload-invalid", "adapter-failed"]).toContain(result.status);
      expect(emit).not.toHaveBeenCalled();
    }
  });

  it.each([
    ["denied", () => ({ status: "denied" })],
    [
      "throw",
      () => {
        throw new Error("private");
      },
    ],
    ["promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "succeeded", extra: true })],
  ])("returns controlled %s emission outcome", (_label, emit) => {
    const target = fixture({ emit });
    const result = execute(target, { type: "event.emit", name: HOST_EVENT });
    expect(["event-denied", "adapter-failed"]).toContain(result.status);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("stops after validator-time disposal and never reports emission success", () => {
    // Deliberate cyclic fixture for the host callback.
    // eslint-disable-next-line prefer-const
    let target!: Fixture;
    const emit = vi.fn();
    const validate = vi.fn(() => {
      disposeRuntimeCommandEventActions(target.mounted.handle);
      return { status: "valid" as const };
    });
    target = fixture({ validate, emit });
    expect(execute(target, { type: "event.emit", name: HOST_EVENT })).toEqual({
      status: "disposed",
    });
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("M04-T12 reentry and disposal", () => {
  it("makes command and emission callback reentry busy, and disposal wins after callbacks", () => {
    // Deliberate cyclic fixture for the host callback.
    // eslint-disable-next-line prefer-const
    let commandTarget!: Fixture;
    const commandNested: string[] = [];
    const invoke = vi.fn(() => {
      commandNested.push(
        execute(commandTarget, { type: "event.emit", name: HOST_EVENT }, commandSnapshot).status,
      );
      disposeRuntimeCommandEventActions(commandTarget.mounted.handle);
      return { status: "succeeded" as const };
    });
    commandTarget = fixture({ invoke });
    const registered = register(commandTarget);
    if (registered.status !== "registered") throw new TypeError("Expected registration.");
    const commandSnapshot = registered.snapshot;
    expect(
      execute(
        commandTarget,
        { type: "component.command", target: FIELD_NODE, command: "focus" },
        commandSnapshot,
      ),
    ).toEqual({ status: "disposed" });
    expect(commandNested).toEqual(["busy"]);

    // Deliberate cyclic fixture for the host callback.
    // eslint-disable-next-line prefer-const
    let eventTarget!: Fixture;
    const eventNested: string[] = [];
    const emit = vi.fn(() => {
      eventNested.push(execute(eventTarget, { type: "event.emit", name: HOST_EVENT }).status);
      disposeRuntimeCommandEventActions(eventTarget.mounted.handle);
      return { status: "succeeded" as const };
    });
    eventTarget = fixture({ emit });
    expect(execute(eventTarget, { type: "event.emit", name: HOST_EVENT })).toEqual({
      status: "disposed",
    });
    expect(eventNested).toEqual(["busy"]);
  });

  it("turns diagnostic-time disposal into disposed without reviving the manager", () => {
    // Deliberate cyclic fixture for the diagnostic callback.
    // eslint-disable-next-line prefer-const
    let target!: Fixture;
    const nested: string[] = [];
    const report = vi.fn(() => {
      nested.push(execute(target, { type: "event.emit", name: HOST_EVENT }).status);
      disposeRuntimeCommandEventActions(target.mounted.handle);
    });
    target = fixture({ report });
    expect(execute(target, { type: "event.emit", name: "blocked" })).toEqual({
      status: "disposed",
    });
    expect(nested).toEqual(["busy"]);
    expect(execute(target, { type: "event.emit", name: HOST_EVENT })).toEqual({
      status: "disposed",
    });
  });

  it("disposes every registration ticket terminally and is idempotent", () => {
    const target = fixture();
    const first = register(target);
    if (first.status !== "registered") throw new TypeError("Expected first registration.");
    const second = register(target, "field-instance-2", first.snapshot);
    if (second.status !== "registered") throw new TypeError("Expected second registration.");
    expect(disposeRuntimeCommandEventActions(target.mounted.handle)).toEqual({
      status: "disposed",
      disposedTargets: 2,
    });
    expect(disposeRuntimeCommandEventActions(target.mounted.handle)).toEqual({
      status: "already-disposed",
      disposedTargets: 0,
    });
    expect(
      unregisterRuntimeComponentCommandTarget(target.mounted.handle, {
        ticket: first.ticket,
        snapshot: second.snapshot,
      }),
    ).toEqual({ status: "disposed" });
  });
});
