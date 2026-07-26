import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { createRuntimeHostPorts } from "../src/host-ports.js";
import {
  disposeRuntimeSurfaceOperations,
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
} from "../src/operation-lifecycle.js";
import {
  disposeRuntimeOperationResourceActions,
  executeRuntimeOperationResourceAction,
  finalizeRuntimeOperationActionSettlement,
  mountRuntimeOperationResourceActions,
  readRuntimeOperationResourceActions,
} from "../src/operation-resource-actions.js";
import {
  disposeRuntimeSurfaceResources,
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
} from "../src/resource-lifecycle.js";
import { createRuntimeResolutionSnapshot } from "../src/value-resolution.js";

import { canonicalizeJson } from "@desen/protocol";

import type { DesenDiagnostic } from "@desen/protocol";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeHostPorts,
  RuntimeJsonObject,
  RuntimeOperationRequest,
  RuntimeResourceRequest,
  RuntimeTokenRequest,
} from "../src/host-ports.js";
import type { RuntimeSurfaceOperationsSnapshot } from "../src/operation-lifecycle.js";
import type {
  RuntimeDeferredActionSpec,
  RuntimeOperationActionSettlementDescriptor,
  RuntimeOperationActionSettlementTicket,
  RuntimeOperationResourceAction,
  RuntimeOperationResourceActionLimitProfile,
  RuntimeOperationResourceActionsHandle,
} from "../src/operation-resource-actions.js";
import type {
  RuntimeSurfaceResourceSpec,
  RuntimeSurfaceResourcesSnapshot,
} from "../src/resource-lifecycle.js";
import type { RuntimeResolutionSnapshot } from "../src/value-resolution.js";

const DOCUMENT_ID = "com.desen.actions";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "sign-in";
const SIGN_IN = "com.example.auth/signIn";
const REORDER = "com.example.tasks/reorder";
const STORES = "com.example.stores/list";
const VALID_INPUT = Object.freeze({ email: "person@example.com", password: "secret" });
const VALID_OUTPUT = Object.freeze({ userId: "user-1" });
const STORE_OUTPUT = Object.freeze({ items: Object.freeze([]), bounds: Object.freeze({}) });

type MutableRecord = Record<string, unknown>;
type MountedResources = Extract<
  ReturnType<typeof mountRuntimeSurfaceResources>,
  { status: "mounted" }
>;
type MountedOperations = Extract<
  ReturnType<typeof mountRuntimeSurfaceOperations>,
  { status: "mounted" }
>;
type MountedActions = Extract<
  ReturnType<typeof mountRuntimeOperationResourceActions>,
  { status: "mounted" }
>;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason?: unknown) => void;
}

interface HostOptions {
  readonly invoke?: (request: RuntimeOperationRequest) => unknown;
  readonly load?: (request: RuntimeResourceRequest) => unknown;
  readonly token?: (request: RuntimeTokenRequest) => unknown;
  readonly report?: (diagnostic: DesenDiagnostic<string>) => void;
}

interface FixtureOptions extends HostOptions {
  readonly catalog?: (catalog: MutableRecord) => void;
  readonly operations?: Readonly<Record<string, { readonly operation: string }>>;
  readonly resources?: Readonly<Record<string, RuntimeSurfaceResourceSpec>>;
  readonly limits?: RuntimeOperationResourceActionLimitProfile;
}

interface Fixture {
  readonly ports: RuntimeHostPorts;
  readonly resources: MountedResources;
  readonly operations: MountedOperations;
  readonly actions: MountedActions;
  readonly operationInventory: Readonly<Record<string, { readonly operation: string }>>;
}

type LowerFixture = Omit<Fixture, "actions">;

function deferred<Value>(): Deferred<Value> {
  let resolvePromise!: (value: Value) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return Object.freeze({ promise, resolve: resolvePromise, reject: rejectPromise });
}

function mutableRecord(value: unknown, label: string): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function preparedCatalog(
  mutate?: (catalog: MutableRecord) => void,
): DesenValidatedExecutionCatalogSet {
  const catalog = mutableRecord(JSON.parse(JSON.stringify(frozenWebCatalog)), "catalog");
  mutate?.(catalog);
  const validation = validateDesenExecutionCatalogSet([catalog]);
  expect(validation.valid).toBe(true);
  if (!validation.valid) throw new TypeError("Expected a valid execution Catalog fixture.");
  return validation.value;
}

function hostPorts(options: HostOptions = {}): RuntimeHostPorts {
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
      invoke: (options.invoke ??
        (() => ({
          status: "succeeded",
          value: VALID_OUTPUT,
        }))) as RuntimeHostPorts["operations"]["invoke"],
    },
    resources: {
      load: (options.load ??
        (() => ({
          status: "succeeded",
          value: STORE_OUTPUT,
        }))) as RuntimeHostPorts["resources"]["load"],
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
    clock: { now: () => 1 },
    diagnostics: { report: options.report ?? (() => undefined) },
  });
}

function defaultResources(): Readonly<Record<string, RuntimeSurfaceResourceSpec>> {
  return Object.freeze({
    stores: Object.freeze({ use: STORES, input: Object.freeze({}), policy: "manual" }),
  });
}

function mountedLower(options: FixtureOptions = {}): LowerFixture {
  const catalogSet = preparedCatalog(options.catalog);
  const ports = hostPorts(options);
  const operationInventory = options.operations ?? { signIn: { operation: SIGN_IN } };
  const resources = mountRuntimeSurfaceResources({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources: options.resources ?? defaultResources(),
    catalogSet,
    hostPorts: ports,
  });
  expect(resources.status).toBe("mounted");
  if (resources.status !== "mounted") throw new TypeError("Expected resources to mount.");
  const operations = mountRuntimeSurfaceOperations({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: operationInventory,
    catalogSet,
    hostPorts: ports,
  });
  expect(operations.status).toBe("mounted");
  if (operations.status !== "mounted") throw new TypeError("Expected operations to mount.");
  return Object.freeze({ ports, resources, operations, operationInventory });
}

function mountActions(lower: LowerFixture, overrides: Readonly<Record<string, unknown>> = {}) {
  return mountRuntimeOperationResourceActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    operations: lower.operationInventory,
    resourceHandle: lower.resources.handle,
    resourceSnapshot: lower.resources.snapshot,
    operationHandle: lower.operations.handle,
    operationSnapshot: lower.operations.snapshot,
    hostPorts: lower.ports,
    ...overrides,
  } as Parameters<typeof mountRuntimeOperationResourceActions>[0]);
}

function mountedFixture(options: FixtureOptions = {}): Fixture {
  const lower = mountedLower(options);
  const actions = mountActions(
    lower,
    options.limits === undefined ? {} : { limits: options.limits },
  );
  expect(actions.status).toBe("mounted");
  if (actions.status !== "mounted") throw new TypeError("Expected actions to mount.");
  return Object.freeze({ ...lower, actions });
}

function currentResources(fixture: LowerFixture): RuntimeSurfaceResourcesSnapshot {
  const read = readRuntimeSurfaceResources(fixture.resources.handle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected live resources.");
  return read.snapshot;
}

function currentOperations(fixture: LowerFixture): RuntimeSurfaceOperationsSnapshot {
  const read = readRuntimeSurfaceOperations(fixture.operations.handle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected live operations.");
  return read.snapshot;
}

function resolution(
  resourceSnapshot: RuntimeSurfaceResourcesSnapshot,
  operationSnapshot: RuntimeSurfaceOperationsSnapshot,
  state: RuntimeJsonObject = VALID_INPUT,
): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state,
    context: {},
    resource: resourceSnapshot.lifecycles,
    operation: operationSnapshot.lifecycles,
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function execute(
  fixture: Fixture,
  action: unknown,
  overrides: Readonly<{
    resourceSnapshot?: RuntimeSurfaceResourcesSnapshot;
    operationSnapshot?: RuntimeSurfaceOperationsSnapshot;
    resolutionSnapshot?: RuntimeResolutionSnapshot;
  }> = {},
) {
  const resourceSnapshot = overrides.resourceSnapshot ?? currentResources(fixture);
  const operationSnapshot = overrides.operationSnapshot ?? currentOperations(fixture);
  return executeRuntimeOperationResourceAction(
    fixture.actions.handle,
    action as RuntimeOperationResourceAction,
    overrides.resolutionSnapshot ?? resolution(resourceSnapshot, operationSnapshot),
    resourceSnapshot,
    operationSnapshot,
  );
}

function operationAction(
  overrides: Readonly<Record<string, unknown>> = {},
): RuntimeOperationResourceAction {
  return {
    type: "operation.invoke",
    operation: SIGN_IN,
    as: "signIn",
    input: VALID_INPUT,
    ...overrides,
  } as RuntimeOperationResourceAction;
}

function acceptedOperation(result: ReturnType<typeof execute>) {
  expect(["operation-started", "operation-queued", "operation-staged"]).toContain(result.status);
  if (
    result.status !== "operation-started" &&
    result.status !== "operation-queued" &&
    result.status !== "operation-staged"
  ) {
    throw new TypeError("Expected an accepted operation action.");
  }
  return result;
}

function terminalDescriptor(
  value: RuntimeOperationActionSettlementDescriptor,
): Extract<
  RuntimeOperationActionSettlementDescriptor,
  { readonly ticket: RuntimeOperationActionSettlementTicket }
> {
  expect(["succeeded", "failed", "denied", "invalid-output", "adapter-failed"]).toContain(
    value.status,
  );
  if (value.status === "superseded" || value.status === "disposed") {
    throw new TypeError("Expected a ticket-bearing terminal descriptor.");
  }
  return value;
}

function addStoreQueryInput(catalog: MutableRecord): void {
  const resources = mutableRecord(catalog.resources, "resources");
  const stores = mutableRecord(resources[STORES], "stores");
  stores.inputSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: { query: { type: "string", minLength: 1 } },
  };
}

describe("M04-T11 mount and exclusive authority", () => {
  it("mounts exact T08/T09 snapshots without invoking any host callback", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const fixture = mountedFixture({ invoke, load, token, report });

    expect(fixture.actions.resourceSnapshot).toBe(fixture.resources.snapshot);
    expect(fixture.actions.operationSnapshot).toBe(fixture.operations.snapshot);
    expect(invoke).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(Object.isFrozen(fixture.actions)).toBe(true);
  });

  it("reads exact compositor identity and current lower snapshots without callbacks or effects", () => {
    const invoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const fixture = mountedFixture({ invoke, load, token, report });
    const detachedRead = readRuntimeOperationResourceActions;

    const current = Reflect.apply(detachedRead, Object.freeze({ foreignReceiver: true }), [
      fixture.actions.handle,
    ]);
    expect(current).toEqual({
      status: "read",
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resourceSnapshot: fixture.resources.snapshot,
      operationSnapshot: fixture.operations.snapshot,
    });
    expect(
      readRuntimeOperationResourceActions(
        Object.freeze({}) as RuntimeOperationResourceActionsHandle,
      ),
    ).toEqual({ status: "invalid-handle" });
    expect(invoke).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();

    disposeRuntimeOperationResourceActions(fixture.actions.handle);
    expect(readRuntimeOperationResourceActions(fixture.actions.handle)).toEqual({
      status: "disposed",
    });
  });

  it("reports a reentrant read as busy without disturbing the active action", () => {
    let nestedStatus = "";
    const fixture = mountedFixture({
      token() {
        nestedStatus = readRuntimeOperationResourceActions(fixture.actions.handle).status;
        return { status: "resolved", value: "secret" };
      },
    });

    const result = execute(
      fixture,
      operationAction({
        input: {
          email: "person@example.com",
          password: { $token: "shared" },
        },
      }),
    );
    expect(result.status).toBe("operation-started");
    expect(nestedStatus).toBe("busy");
  });

  it.each([
    ["resource", "resourceSnapshot"],
    ["operation", "operationSnapshot"],
  ])("rejects an ABA-equal cloned %s snapshot", (_label, field) => {
    const lower = mountedLower();
    const original =
      field === "resourceSnapshot" ? lower.resources.snapshot : lower.operations.snapshot;
    const clone = JSON.parse(JSON.stringify(original)) as unknown;
    const result = mountActions(lower, { [field]: clone });
    expect(result).toMatchObject({
      status: "invalid",
      reason:
        field === "resourceSnapshot" ? "invalid-resource-authority" : "invalid-operation-authority",
    });
  });

  it.each([
    ["resource", "resourceHandle"],
    ["operation", "operationHandle"],
  ])("rejects a foreign %s handle paired with the local snapshot", (_label, handleField) => {
    const lower = mountedLower();
    const foreign = mountedLower();
    const foreignManager = _label === "resource" ? foreign.resources : foreign.operations;
    const result = mountActions(lower, {
      [handleField]: foreignManager.handle,
    });
    expect(result).toMatchObject({
      status: "invalid",
      reason: _label === "resource" ? "invalid-resource-authority" : "invalid-operation-authority",
    });
  });

  it.each([
    ["document", { documentId: "com.other.document" }],
    ["revision", { revision: `sha256:${"b".repeat(64)}` }],
    ["surface", { surfaceId: "other" }],
  ])("rejects %s metadata mismatching both lower authorities", (_label, overrides) => {
    const result = mountActions(mountedLower(), overrides);
    expect(result.status).toBe("invalid");
    expect(result).not.toHaveProperty("handle");
  });

  it("rejects forged lower handles without invoking diagnostics", () => {
    const report = vi.fn();
    const lower = mountedLower({ report });
    expect(
      mountActions(lower, {
        resourceHandle: {},
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-resource-authority" });
    expect(
      mountActions(lower, {
        operationHandle: {},
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-operation-authority" });
    expect(report).not.toHaveBeenCalled();
  });

  it("rejects a missing, extra, or malformed operation inventory atomically", () => {
    for (const operations of [
      {},
      { signIn: { operation: SIGN_IN }, extra: { operation: SIGN_IN } },
      { signIn: { operation: "not-a-capability" } },
    ]) {
      const lower = mountedLower();
      const result = mountActions(lower, { operations });
      expect(result).toMatchObject({ status: "invalid", reason: "invalid-operation-inventory" });
      expect(result).not.toHaveProperty("handle");
    }
  });

  it("rolls back a failed mount so the same lower handles can be mounted correctly", () => {
    const lower = mountedLower();
    expect(mountActions(lower, { operations: {} })).toMatchObject({ status: "invalid" });
    expect(mountActions(lower).status).toBe("mounted");
  });

  it("prevents a second compositor from claiming either surrendered lower handle", () => {
    const first = mountedLower();
    expect(mountActions(first).status).toBe("mounted");

    const secondOperation = mountedLower();
    expect(
      mountActions(secondOperation, {
        resourceHandle: first.resources.handle,
        resourceSnapshot: first.resources.snapshot,
      }),
    ).toMatchObject({ status: "invalid", reason: "already-owned-authority" });

    const secondResource = mountedLower();
    expect(
      mountActions(secondResource, {
        operationHandle: first.operations.handle,
        operationSnapshot: first.operations.snapshot,
      }),
    ).toMatchObject({ status: "invalid", reason: "already-owned-authority" });
  });

  it.each([
    ["negative", { maxPendingSettlements: -1 }],
    ["fraction", { maxRetainedSettlementActions: 1.5 }],
    ["above ceiling", { maxRetainedHandlerCodeUnits: 1_048_577 }],
    ["unknown key", { arbitrary: 1 }],
  ])("rejects a %s limit profile without claiming authority", (_label, limits) => {
    const lower = mountedLower();
    expect(mountActions(lower, { limits })).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
    });
    expect(mountActions(lower).status).toBe("mounted");
  });

  it("rejects accessor, symbol, and extra mount members without invoking getters", () => {
    const lower = mountedLower();
    let reads = 0;
    const input = {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      operations: lower.operationInventory,
      resourceHandle: lower.resources.handle,
      resourceSnapshot: lower.resources.snapshot,
      operationHandle: lower.operations.handle,
      operationSnapshot: lower.operations.snapshot,
      hostPorts: lower.ports,
      extra: true,
      [Symbol("hostile")]: true,
    };
    Object.defineProperty(input, "documentId", {
      enumerable: true,
      get() {
        reads += 1;
        return DOCUMENT_ID;
      },
    });
    expect(
      mountRuntimeOperationResourceActions(
        input as unknown as Parameters<typeof mountRuntimeOperationResourceActions>[0],
      ),
    ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    expect(reads).toBe(0);
  });
});

describe("M04-T11 snapshot authority and guard-first observation", () => {
  it.each([
    ["resource", "resourceSnapshot"],
    ["operation", "operationSnapshot"],
  ])("rejects an ABA-equal %s execution snapshot before reading when", (_label, field) => {
    const fixture = mountedFixture();
    let whenReads = 0;
    const action = {};
    Object.defineProperty(action, "when", {
      enumerable: true,
      get() {
        whenReads += 1;
        return undefined;
      },
    });
    const snapshot =
      field === "resourceSnapshot" ? currentResources(fixture) : currentOperations(fixture);
    const result = execute(fixture, action, {
      [field]: JSON.parse(JSON.stringify(snapshot)),
    });
    expect(result.status).toBe("invalid-snapshot");
    expect(whenReads).toBe(0);
  });

  it.each(["resource", "operation"])(
    "rejects a factory snapshot with a mismatched %s namespace before action observation",
    (namespace) => {
      const fixture = mountedFixture();
      const resources = currentResources(fixture);
      const operations = currentOperations(fixture);
      let whenReads = 0;
      const action = {};
      Object.defineProperty(action, "when", {
        enumerable: true,
        get() {
          whenReads += 1;
          return undefined;
        },
      });
      const mismatched = createRuntimeResolutionSnapshot({
        state: VALID_INPUT,
        context: {},
        resource: namespace === "resource" ? {} : resources.lifecycles,
        operation: namespace === "operation" ? {} : operations.lifecycles,
        event: { status: "unavailable" },
        item: {},
        env: {},
      });
      expect(
        execute(fixture, action, {
          resourceSnapshot: resources,
          operationSnapshot: operations,
          resolutionSnapshot: mismatched,
        }).status,
      ).toBe("invalid-snapshot");
      expect(whenReads).toBe(0);
    },
  );

  it("detects direct lower-operation drift at the next action boundary", () => {
    const pending = deferred<unknown>();
    const fixture = mountedFixture({ invoke: () => pending.promise });
    const beforeResources = currentResources(fixture);
    const beforeOperations = currentOperations(fixture);
    const direct = invokeRuntimeOperation(fixture.operations.handle, {
      alias: "signIn",
      operation: SIGN_IN,
      input: VALID_INPUT,
      operationSnapshot: beforeOperations,
    });
    expect(direct.status).toBe("started");
    expect(
      executeRuntimeOperationResourceAction(
        fixture.actions.handle,
        operationAction(),
        resolution(beforeResources, beforeOperations),
        beforeResources,
        beforeOperations,
      ).status,
    ).toBe("invalid-snapshot");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("detects direct lower-resource drift at the next action boundary", () => {
    const pending = deferred<unknown>();
    const fixture = mountedFixture({ load: () => pending.promise });
    const beforeResources = currentResources(fixture);
    const beforeOperations = currentOperations(fixture);
    const direct = refreshRuntimeSurfaceResource(fixture.resources.handle, {
      instanceId: "stores",
      resourceSnapshot: beforeResources,
      snapshot: resolution(beforeResources, beforeOperations),
    });
    expect(direct.status).toBe("started");
    expect(
      executeRuntimeOperationResourceAction(
        fixture.actions.handle,
        { type: "resource.refresh", resource: "stores" },
        resolution(beforeResources, beforeOperations),
        beforeResources,
        beforeOperations,
      ).status,
    ).toBe("invalid-snapshot");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("a false guard observes none of the operation payload and invokes no callback", () => {
    const invoke = vi.fn();
    const load = vi.fn();
    const token = vi.fn();
    const report = vi.fn();
    const fixture = mountedFixture({ invoke, load, token, report });
    const reads: Record<string, number> = {};
    const action: Record<string, unknown> = {
      when: { op: "eq", args: [1, 2] },
    };
    for (const key of [
      "type",
      "operation",
      "as",
      "input",
      "concurrency",
      "onSuccess",
      "onFailure",
      "resource",
      "extensions",
    ]) {
      reads[key] = 0;
      Object.defineProperty(action, key, {
        enumerable: true,
        get() {
          reads[key] = (reads[key] ?? 0) + 1;
          throw new Error(`must not read ${key}`);
        },
      });
    }
    expect(execute(fixture, action)).toEqual({ status: "skipped", diagnostics: [] });
    expect(reads).toEqual({
      type: 0,
      operation: 0,
      as: 0,
      input: 0,
      concurrency: 0,
      onSuccess: 0,
      onFailure: 0,
      resource: 0,
      extensions: 0,
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("returns false-guard predicate diagnostics without reporting them", () => {
    const report = vi.fn();
    const fixture = mountedFixture({ report });
    const result = execute(fixture, {
      when: { op: "gt", args: ["text", 1] },
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.diagnostics[0]?.code).toBe("PREDICATE_TYPE_MISMATCH");
    }
    expect(report).not.toHaveBeenCalled();
  });

  it("makes reflection reentry busy while the outer guard remains controlled", () => {
    const fixture = mountedFixture();
    let innerStatus = "";
    let once = false;
    const target = { when: { op: "eq", args: [1, 2] } };
    const hostile = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (!once && key === "when") {
          once = true;
          innerStatus = execute(fixture, operationAction()).status;
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });
    expect(execute(fixture, hostile).status).toBe("skipped");
    expect(innerStatus).toBe("busy");
  });

  it("gives disposal during guard reflection precedence over the stale guard result", () => {
    const fixture = mountedFixture();
    let once = false;
    const hostile = new Proxy(
      { when: { op: "eq", args: [1, 2] } },
      {
        getOwnPropertyDescriptor(object, key) {
          if (!once && key === "when") {
            once = true;
            disposeRuntimeOperationResourceActions(fixture.actions.handle);
          }
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
      },
    );
    expect(execute(fixture, hostile).status).toBe("disposed");
  });

  it("shares one detached token observation between a true guard and operation input", () => {
    const token = vi.fn(() => ({ status: "resolved" as const, value: "secret" }));
    const invoke = vi.fn(() => ({ status: "succeeded" as const, value: VALID_OUTPUT }));
    const fixture = mountedFixture({ token, invoke });
    const result = acceptedOperation(
      execute(
        fixture,
        operationAction({
          when: { op: "eq", args: [{ $token: "shared" }, "secret"] },
          input: { email: "person@example.com", password: { $token: "shared" } },
        }),
      ),
    );
    expect(result.status).toBe("operation-started");
    expect(token).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({ input: { email: "person@example.com", password: "secret" } }),
    );
  });

  it("fails closed when a token callback mutates the lower operation manager", () => {
    const holder: { fixture?: Fixture } = {};
    const lowerInvoke = vi.fn(() => new Promise(() => undefined));
    const token = vi.fn(() => {
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      const snapshot = currentOperations(fixture);
      invokeRuntimeOperation(fixture.operations.handle, {
        alias: "signIn",
        operation: SIGN_IN,
        input: VALID_INPUT,
        operationSnapshot: snapshot,
      });
      return { status: "resolved" as const, value: "secret" };
    });
    const fixture = mountedFixture({ invoke: lowerInvoke, token });
    holder.fixture = fixture;
    expect(
      execute(
        fixture,
        operationAction({
          input: { email: "person@example.com", password: { $token: "drift" } },
        }),
      ).status,
    ).toBe("invalid-snapshot");
    expect(lowerInvoke).toHaveBeenCalledTimes(1);
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("gives token-callback disposal precedence and never invokes the operation", () => {
    const holder: { fixture?: Fixture } = {};
    const invoke = vi.fn();
    const token = vi.fn(() => {
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      disposeRuntimeOperationResourceActions(fixture.actions.handle);
      return { status: "resolved" as const, value: "secret" };
    });
    const fixture = mountedFixture({ invoke, token });
    holder.fixture = fixture;
    expect(
      execute(
        fixture,
        operationAction({
          input: { email: "person@example.com", password: { $token: "dispose" } },
        }),
      ).status,
    ).toBe("disposed");
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown alias", { as: "missing" }, "unknown-operation-alias"],
    ["capability mismatch", { operation: REORDER }, "operation-capability-mismatch"],
    ["invalid alias", { as: "9bad" }, "invalid-action"],
  ])("rejects %s before observing input or settlement handlers", (_label, override, status) => {
    const fixture = mountedFixture();
    let reads = 0;
    const action = operationAction(override) as unknown as Record<string, unknown>;
    for (const key of ["input", "onSuccess", "onFailure", "extensions"]) {
      Object.defineProperty(action, key, {
        enumerable: true,
        get() {
          reads += 1;
          throw new Error("payload must remain unobserved");
        },
      });
    }
    expect(execute(fixture, action).status).toBe(status);
    expect(reads).toBe(0);
  });

  it.each([
    ["extra key", { arbitrary: true }, "invalid-action"],
    ["symbol key", { [Symbol("hostile")]: true }, "invalid-action"],
    ["invalid concurrency", { concurrency: "parallel" }, "invalid-action"],
    ["present undefined success", { onSuccess: undefined }, "invalid-action"],
    ["present undefined failure", { onFailure: undefined }, "invalid-action"],
    ["function input", { input: { password: () => "secret" } }, "payload-rejected"],
  ])("rejects guarded hostile action shape: %s", (_label, override, expected) => {
    const fixture = mountedFixture();
    expect(execute(fixture, operationAction(override)).status).toBe(expected);
  });
});

describe("M04-T11 handler capture, bounds, and operation acceptance", () => {
  it("detaches and freezes both handler arrays at invocation acceptance", async () => {
    const transport = deferred<unknown>();
    const fixture = mountedFixture({ invoke: () => transport.promise });
    const success: RuntimeDeferredActionSpec[] = [
      { type: "resource.refresh", resource: "stores", nested: { value: 1 } },
    ];
    const failure: RuntimeDeferredActionSpec[] = [{ type: "state.toggle", path: "failed" }];
    const accepted = acceptedOperation(
      execute(fixture, operationAction({ onSuccess: success, onFailure: failure })),
    );
    mutableRecord(mutableRecord(success[0], "success").nested, "nested").value = 99;
    success.push({ type: "event.emit", name: "mutated" });
    failure[0] = { type: "event.emit", name: "mutated" };
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const settlement = terminalDescriptor(await accepted.settlement);
    expect(settlement.actions).toEqual([
      { type: "resource.refresh", resource: "stores", nested: { value: 1 } },
    ]);
    expect(Object.isFrozen(settlement.actions)).toBe(true);
    expect(Object.isFrozen(settlement.actions[0])).toBe(true);
    finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket);
  });

  it.each([
    [
      "cyclic handler",
      () => {
        const action: Record<string, unknown> = { type: "state.toggle", path: "enabled" };
        action.self = action;
        return { onSuccess: [action] };
      },
    ],
    [
      "function handler member",
      () => ({ onSuccess: [{ type: "event.emit", callback: () => undefined }] }),
    ],
    [
      "handler accessor",
      () => {
        const action = { type: "state.toggle", path: "enabled" };
        Object.defineProperty(action, "secret", { enumerable: true, get: () => "never" });
        return { onSuccess: [action] };
      },
    ],
  ])("rejects unsafe %s before invoking the host", (_label, makeOverride) => {
    const invoke = vi.fn();
    const fixture = mountedFixture({ invoke });
    expect(execute(fixture, operationAction(makeOverride())).status).toBe("invalid-action");
    expect(invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["pending settlement", { maxPendingSettlements: 0 }, { onSuccess: [] }, "pending-settlements"],
    [
      "retained action",
      { maxRetainedSettlementActions: 0 },
      { onSuccess: [{}] },
      "retained-actions",
    ],
    [
      "handler code units",
      { maxRetainedHandlerCodeUnits: 3 },
      { onSuccess: [] },
      "retained-handler-code-units",
    ],
  ])("enforces the %s bound before token materialization", (_label, limits, handlers, reason) => {
    const token = vi.fn();
    const invoke = vi.fn();
    const fixture = mountedFixture({ limits, token, invoke });
    const result = execute(
      fixture,
      operationAction({
        ...handlers,
        input: { email: "person@example.com", password: { $token: "blocked" } },
      }),
    );
    expect(result).toMatchObject({ status: "settlement-limit", reason });
    expect(token).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("releases a provisional reservation after operation schema rejection", () => {
    const fixture = mountedFixture({ limits: { maxPendingSettlements: 1 } });
    expect(
      execute(fixture, operationAction({ input: { email: 42, password: "secret" } })).status,
    ).toBe("operation-input-rejected");
    expect(execute(fixture, operationAction()).status).toBe("operation-started");
  });

  it.each([
    ["unresolved reference", { $ref: "state.missing" }, "payload-rejected", "unresolved"],
    ["failed token", { $token: "failed" }, "payload-rejected", "adapter-failed"],
  ])("contains %s before operation invocation", (_label, password, status, reason) => {
    const invoke = vi.fn();
    const token = vi.fn(() => {
      throw new Error("secret token failure");
    });
    const fixture = mountedFixture({ invoke, token });
    const result = execute(
      fixture,
      operationAction({ input: { email: "person@example.com", password } }),
    );
    expect(result).toMatchObject({ status, reason });
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret token failure");
  });

  it("materializes named operation input in canonical key order", () => {
    const invoke = vi.fn((_request: RuntimeOperationRequest) => ({
      ...(_request === undefined ? {} : {}),
      status: "succeeded" as const,
      value: VALID_OUTPUT,
    }));
    const fixture = mountedFixture({ invoke });
    expect(
      execute(
        fixture,
        operationAction({ input: { password: "secret", email: "person@example.com" } }),
      ).status,
    ).toBe("operation-started");
    const request = invoke.mock.calls[0]?.[0];
    expect(Object.keys(request?.input ?? {})).toEqual(["email", "password"]);
    expect(Object.isFrozen(request?.input)).toBe(true);
  });

  it("returns started synchronously while even a synchronous host value settles later", async () => {
    const fixture = mountedFixture();
    let mapped = false;
    const accepted = acceptedOperation(execute(fixture, operationAction()));
    void accepted.settlement.then(() => {
      mapped = true;
    });
    expect(accepted.status).toBe("operation-started");
    expect(mapped).toBe(false);
    await accepted.settlement;
    expect(mapped).toBe(true);
  });

  it("returns queued immediately and preserves the first pending transport", () => {
    const transport = deferred<unknown>();
    const invoke = vi.fn(() => transport.promise);
    const fixture = mountedFixture({ invoke });
    expect(execute(fixture, operationAction()).status).toBe("operation-started");
    const queued = acceptedOperation(execute(fixture, operationAction({ concurrency: "queue" })));
    expect(queued).toMatchObject({ status: "operation-queued", position: 1 });
    expect(invoke).toHaveBeenCalledTimes(1);
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("returns staged during a settlement turn and launches it only after finalization", async () => {
    const transports: Deferred<unknown>[] = [];
    const invoke = vi.fn(() => {
      const transport = deferred<unknown>();
      transports.push(transport);
      return transport.promise;
    });
    const fixture = mountedFixture({ invoke });
    const first = acceptedOperation(execute(fixture, operationAction()));
    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const firstSettlement = terminalDescriptor(await first.settlement);
    const staged = acceptedOperation(execute(fixture, operationAction()));
    expect(staged.status).toBe("operation-staged");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, firstSettlement.ticket),
    ).toMatchObject({
      status: "finalized",
      promotedRequestId: staged.requestId,
    });
    expect(invoke).toHaveBeenCalledTimes(2);
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });
});

describe("M04-T11 mapped settlements and opaque finalization", () => {
  it.each([
    [
      "succeeded",
      () => ({ status: "succeeded", value: VALID_OUTPUT }),
      "succeeded",
      "success-handler",
    ],
    [
      "declared failed",
      () => ({ status: "failed", errorCode: "invalidCredentials" }),
      "failed",
      "failure-handler",
    ],
    ["denied", () => ({ status: "denied" }), "denied", "failure-handler"],
    [
      "invalid output",
      () => ({ status: "succeeded", value: { secret: "hidden" } }),
      "invalid-output",
      "failure-handler",
    ],
    [
      "adapter failed",
      () => {
        throw new Error("private adapter stack");
      },
      "adapter-failed",
      "failure-handler",
    ],
  ])(
    "maps %s to the exact immutable settlement turn",
    async (_label, implementation, expectedStatus, expectedHandler) => {
      const fixture = mountedFixture({ invoke: implementation });
      const accepted = acceptedOperation(
        execute(
          fixture,
          operationAction({
            onSuccess: [{ type: "event.emit", name: "success-handler" }],
            onFailure: [{ type: "event.emit", name: "failure-handler" }],
          }),
        ),
      );
      const settlement = terminalDescriptor(await accepted.settlement);
      expect(settlement.status).toBe(expectedStatus);
      expect(settlement.actions).toEqual([{ type: "event.emit", name: expectedHandler }]);
      expect(Object.isFrozen(settlement)).toBe(true);
      expect(Object.isFrozen(settlement.actions)).toBe(true);
      expect(settlement).not.toHaveProperty("lease");
      expect(JSON.stringify(settlement)).not.toMatch(/private adapter stack|secret.*hidden/u);
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket);
    },
  );

  it("does not acknowledge an empty settlement turn early", async () => {
    const transports: Deferred<unknown>[] = [];
    const invoke = vi.fn(() => {
      const transport = deferred<unknown>();
      transports.push(transport);
      return transport.promise;
    });
    const fixture = mountedFixture({ invoke });
    const first = acceptedOperation(execute(fixture, operationAction()));
    const queued = acceptedOperation(execute(fixture, operationAction({ concurrency: "queue" })));
    transports[0]?.resolve({ status: "succeeded", value: VALID_OUTPUT });
    const settlement = terminalDescriptor(await first.settlement);
    await Promise.resolve();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket),
    ).toMatchObject({ status: "finalized", promotedRequestId: queued.requestId });
    expect(invoke).toHaveBeenCalledTimes(2);
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("retains settlement capacity until the terminal ticket is explicitly finalized", async () => {
    const fixture = mountedFixture({ limits: { maxPendingSettlements: 1 } });
    const first = acceptedOperation(execute(fixture, operationAction()));
    const settlement = terminalDescriptor(await first.settlement);

    expect(execute(fixture, operationAction())).toMatchObject({
      status: "settlement-limit",
      reason: "pending-settlements",
    });
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
    expect(execute(fixture, operationAction()).status).toBe("operation-started");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("enforces the aggregate retained settlement-action bound across live tickets", async () => {
    const handlers = { onSuccess: [{ type: "event.emit", name: "done" }] };
    const fixture = mountedFixture({ limits: { maxRetainedSettlementActions: 1 } });
    const first = acceptedOperation(execute(fixture, operationAction(handlers)));
    const settlement = terminalDescriptor(await first.settlement);

    expect(execute(fixture, operationAction(handlers))).toMatchObject({
      status: "settlement-limit",
      reason: "retained-actions",
    });
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
    expect(execute(fixture, operationAction(handlers)).status).toBe("operation-started");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("enforces the aggregate canonical handler-code-unit bound across live tickets", async () => {
    const handlers = {
      onSuccess: [{ type: "event.emit", name: "done" }],
      onFailure: [],
    };
    const exactCodeUnits = canonicalizeJson([handlers.onSuccess, handlers.onFailure]).length;
    const fixture = mountedFixture({
      limits: { maxRetainedHandlerCodeUnits: exactCodeUnits },
    });
    const first = acceptedOperation(execute(fixture, operationAction(handlers)));
    const settlement = terminalDescriptor(await first.settlement);

    expect(execute(fixture, operationAction(handlers))).toMatchObject({
      status: "settlement-limit",
      reason: "retained-handler-code-units",
    });
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
    expect(execute(fixture, operationAction(handlers)).status).toBe("operation-started");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("makes a settlement ticket one-shot", async () => {
    const fixture = mountedFixture();
    const settlement = terminalDescriptor(
      await acceptedOperation(execute(fixture, operationAction())).settlement,
    );
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("already-finalized");
  });

  it("rejects forged and foreign settlement tickets without consuming the real ticket", async () => {
    const first = mountedFixture();
    const second = mountedFixture();
    const settlement = terminalDescriptor(
      await acceptedOperation(execute(first, operationAction())).settlement,
    );
    expect(
      finalizeRuntimeOperationActionSettlement(
        first.actions.handle,
        {} as RuntimeOperationActionSettlementTicket,
      ).status,
    ).toBe("invalid-ticket");
    expect(
      finalizeRuntimeOperationActionSettlement(second.actions.handle, settlement.ticket).status,
    ).toBe("invalid-ticket");
    expect(
      finalizeRuntimeOperationActionSettlement(first.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
  });

  it("returns disposed for a terminal ticket after owner disposal", async () => {
    const fixture = mountedFixture();
    const settlement = terminalDescriptor(
      await acceptedOperation(execute(fixture, operationAction())).settlement,
    );
    expect(disposeRuntimeOperationResourceActions(fixture.actions.handle).status).toBe("disposed");
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("disposed");
  });

  it("preserves finalized identity across later owner disposal", async () => {
    const fixture = mountedFixture();
    const settlement = terminalDescriptor(
      await acceptedOperation(execute(fixture, operationAction())).settlement,
    );
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("finalized");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
    expect(
      finalizeRuntimeOperationActionSettlement(fixture.actions.handle, settlement.ticket).status,
    ).toBe("already-finalized");
  });

  it("suppresses a settlement turn when the surrendered T09 handle is directly disposed", async () => {
    const transport = deferred<unknown>();
    const fixture = mountedFixture({ invoke: () => transport.promise });
    const accepted = acceptedOperation(execute(fixture, operationAction()));
    transport.resolve({ status: "succeeded", value: VALID_OUTPUT });
    disposeRuntimeSurfaceOperations(fixture.operations.handle);
    const settlement = await accepted.settlement;
    expect(settlement).toEqual({
      status: "disposed",
      alias: "signIn",
      requestId: accepted.requestId,
      actions: [],
    });
  });

  it("returns an accepted handle even when the synchronous host callback disposes its owner", async () => {
    const holder: { fixture?: Fixture } = {};
    const invoke = vi.fn(() => {
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      disposeRuntimeOperationResourceActions(fixture.actions.handle);
      return { status: "succeeded" as const, value: VALID_OUTPUT };
    });
    const fixture = mountedFixture({ invoke });
    holder.fixture = fixture;
    const accepted = acceptedOperation(execute(fixture, operationAction()));
    expect(accepted.status).toBe("operation-started");
    await expect(accepted.settlement).resolves.toMatchObject({ status: "disposed", actions: [] });
  });

  it("never inspects a late hostile settlement after terminal compositor disposal", async () => {
    const transport = deferred<unknown>();
    const fixture = mountedFixture({ invoke: () => transport.promise });
    const accepted = acceptedOperation(execute(fixture, operationAction()));
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
    let reads = 0;
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          reads += 1;
          throw new Error("late secret");
        },
      },
    );
    transport.resolve(hostile);
    await expect(accepted.settlement).resolves.toMatchObject({ status: "disposed" });
    expect(reads).toBe(0);
  });

  it("releases rejected reservations before accepting a later replacement", async () => {
    const transport = deferred<unknown>();
    const fixture = mountedFixture({
      invoke: () => transport.promise,
      limits: { maxPendingSettlements: 2 },
    });
    const first = acceptedOperation(execute(fixture, operationAction()));
    expect(execute(fixture, operationAction()).status).toBe("operation-rejected");
    const replacement = acceptedOperation(
      execute(fixture, operationAction({ concurrency: "replace" })),
    );
    await expect(first.settlement).resolves.toMatchObject({ status: "superseded", actions: [] });
    expect(replacement.status).toBe("operation-started");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });

  it("gives peer-manager drift from a rejection diagnostic callback precedence", () => {
    const holder: { fixture?: Fixture } = {};
    let once = false;
    const report = vi.fn(() => {
      if (once) return;
      once = true;
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      const resources = currentResources(fixture);
      const operations = currentOperations(fixture);
      refreshRuntimeSurfaceResource(fixture.resources.handle, {
        instanceId: "stores",
        resourceSnapshot: resources,
        snapshot: resolution(resources, operations),
      });
    });
    const fixture = mountedFixture({ report });
    holder.fixture = fixture;
    const result = execute(fixture, operationAction({ input: { email: 42, password: "secret" } }));
    expect(result.status).toBe("invalid-snapshot");
    disposeRuntimeOperationResourceActions(fixture.actions.handle);
  });
});

describe("M04-T11 resource refresh action composition", () => {
  it("rejects an unknown resource before observing extensions or calling the host", () => {
    const load = vi.fn();
    const report = vi.fn();
    const fixture = mountedFixture({ load, report });
    let reads = 0;
    const action = {
      type: "resource.refresh",
      resource: "missing",
    };
    Object.defineProperty(action, "extensions", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not inspect extensions");
      },
    });
    expect(execute(fixture, action).status).toBe("unknown-resource");
    expect(reads).toBe(0);
    expect(load).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["input", { input: {} }],
    ["handler", { onSuccess: [] }],
    ["concurrency", { concurrency: "replace" }],
    ["extra", { arbitrary: true }],
  ])("rejects a resource action carrying an operation-only %s member", (_label, extra) => {
    const load = vi.fn();
    const fixture = mountedFixture({ load });
    expect(
      execute(fixture, { type: "resource.refresh", resource: "stores", ...extra }).status,
    ).toBe("invalid-action");
    expect(load).not.toHaveBeenCalled();
  });

  it("returns resource-started synchronously without awaiting a synchronous host value", async () => {
    const load = vi.fn(() => ({ status: "succeeded" as const, value: STORE_OUTPUT }));
    const fixture = mountedFixture({ load });
    let settled = false;
    const result = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(result.status).toBe("resource-started");
    if (result.status !== "resource-started") throw new TypeError("Expected resource start.");
    void result.settlement.then(() => {
      settled = true;
    });
    expect(settled).toBe(false);
    await result.settlement;
    expect(settled).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("uses separate deterministic token sessions for the action guard and declared resource input", async () => {
    const token = vi.fn((_request: RuntimeTokenRequest) => ({
      ...(_request === undefined ? {} : {}),
      status: "resolved" as const,
      value: "nearby",
    }));
    const load = vi.fn((_request: RuntimeResourceRequest) => ({
      ...(_request === undefined ? {} : {}),
      status: "succeeded" as const,
      value: STORE_OUTPUT,
    }));
    const fixture = mountedFixture({
      catalog: addStoreQueryInput,
      resources: {
        stores: {
          use: STORES,
          input: { query: { $token: "shared" } },
          policy: "manual",
        },
      },
      token,
      load,
    });
    const result = execute(fixture, {
      type: "resource.refresh",
      resource: "stores",
      when: { op: "eq", args: [{ $token: "shared" }, "nearby"] },
    });
    expect(result.status).toBe("resource-started");
    if (result.status !== "resource-started") throw new TypeError("Expected resource start.");
    await result.settlement;
    expect(token).toHaveBeenCalledTimes(2);
    const requests = token.mock.calls.map(([request]) => request);
    expect(requests[0]?.context.requestId).toMatch(/^operation-resource-action:/u);
    expect(requests[1]?.context.requestId).toMatch(/^resource:/u);
    expect(requests[0]?.context.requestId).not.toBe(requests[1]?.context.requestId);
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ input: { query: "nearby" } }));
  });

  it("re-evaluates the declaration's current resolved input on every refresh", async () => {
    let value = "first";
    const token = vi.fn((_request: RuntimeTokenRequest) => ({
      ...(_request === undefined ? {} : {}),
      status: "resolved" as const,
      value,
    }));
    const load = vi.fn((_request: RuntimeResourceRequest) => ({
      ...(_request === undefined ? {} : {}),
      status: "succeeded" as const,
      value: STORE_OUTPUT,
    }));
    const fixture = mountedFixture({
      catalog: addStoreQueryInput,
      resources: {
        stores: {
          use: STORES,
          input: { query: { $token: "query" } },
          policy: "manual",
        },
      },
      token,
      load,
    });
    const first = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(first.status).toBe("resource-started");
    if (first.status !== "resource-started") throw new TypeError("Expected first refresh.");
    await first.settlement;
    value = "second";
    const second = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(second.status).toBe("resource-started");
    if (second.status !== "resource-started") throw new TypeError("Expected second refresh.");
    await second.settlement;
    expect(load.mock.calls.map(([request]) => request.input)).toEqual([
      { query: "first" },
      { query: "second" },
    ]);
  });

  it("returns a controlled resource input rejection without starting a transport", () => {
    const token = vi.fn(() => ({ status: "resolved" as const, value: 42 }));
    const load = vi.fn();
    const fixture = mountedFixture({
      catalog: addStoreQueryInput,
      resources: {
        stores: {
          use: STORES,
          input: { query: { $token: "query" } },
          policy: "manual",
        },
      },
      token,
      load,
    });
    expect(execute(fixture, { type: "resource.refresh", resource: "stores" })).toMatchObject({
      status: "resource-input-rejected",
      reason: "schema",
    });
    expect(load).not.toHaveBeenCalled();
  });

  it("makes reentry from a synchronous resource host callback busy", () => {
    const holder: { fixture?: Fixture } = {};
    let inner = "";
    const load = vi.fn(() => {
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      inner = execute(fixture, operationAction()).status;
      return { status: "succeeded" as const, value: STORE_OUTPUT };
    });
    const fixture = mountedFixture({ load });
    holder.fixture = fixture;
    expect(execute(fixture, { type: "resource.refresh", resource: "stores" }).status).toBe(
      "resource-started",
    );
    expect(inner).toBe("busy");
  });

  it("returns an accepted resource handle when its synchronous callback disposes the owner", async () => {
    const holder: { fixture?: Fixture } = {};
    const load = vi.fn(() => {
      const fixture = holder.fixture;
      if (fixture === undefined) throw new TypeError("Expected mounted fixture.");
      disposeRuntimeOperationResourceActions(fixture.actions.handle);
      return { status: "succeeded" as const, value: STORE_OUTPUT };
    });
    const fixture = mountedFixture({ load });
    holder.fixture = fixture;
    const result = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(result.status).toBe("resource-started");
    if (result.status !== "resource-started") throw new TypeError("Expected accepted refresh.");
    await expect(result.settlement).resolves.toMatchObject({ status: "disposed" });
  });

  it("logically supersedes a pending refresh and ignores its stale settlement", async () => {
    const transports: Deferred<unknown>[] = [];
    const load = vi.fn(() => {
      const transport = deferred<unknown>();
      transports.push(transport);
      return transport.promise;
    });
    const fixture = mountedFixture({ load });
    const first = execute(fixture, { type: "resource.refresh", resource: "stores" });
    const second = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(first.status).toBe("resource-started");
    expect(second.status).toBe("resource-started");
    if (first.status !== "resource-started" || second.status !== "resource-started") {
      throw new TypeError("Expected two accepted refreshes.");
    }
    await expect(first.settlement).resolves.toMatchObject({ status: "superseded" });
    transports[0]?.resolve(
      new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error("stale result must not be read");
          },
        },
      ),
    );
    transports[1]?.resolve({ status: "succeeded", value: STORE_OUTPUT });
    await expect(second.settlement).resolves.toMatchObject({ status: "succeeded" });
  });

  it("reports direct lower-resource disposal as terminal on the next action", () => {
    const fixture = mountedFixture();
    const resources = currentResources(fixture);
    const operations = currentOperations(fixture);
    const runtimeSnapshot = resolution(resources, operations);
    disposeRuntimeSurfaceResources(fixture.resources.handle);
    expect(
      executeRuntimeOperationResourceAction(
        fixture.actions.handle,
        { type: "resource.refresh", resource: "stores" },
        runtimeSnapshot,
        resources,
        operations,
      ).status,
    ).toBe("resource-disposed");
  });
});

describe("M04-T11 composed disposal", () => {
  it("terminally disposes both surrendered managers and is idempotent", () => {
    const fixture = mountedFixture();
    expect(disposeRuntimeOperationResourceActions(fixture.actions.handle)).toMatchObject({
      status: "disposed",
    });
    expect(readRuntimeSurfaceResources(fixture.resources.handle).status).toBe("disposed");
    expect(readRuntimeSurfaceOperations(fixture.operations.handle).status).toBe("disposed");
    expect(disposeRuntimeOperationResourceActions(fixture.actions.handle)).toEqual({
      status: "already-disposed",
      disposedResources: 0,
      disposedInvocations: 0,
      invalidatedLeases: 0,
    });
  });

  it("resolves pending operation and resource work as disposed", async () => {
    const operation = deferred<unknown>();
    const resource = deferred<unknown>();
    const fixture = mountedFixture({
      invoke: () => operation.promise,
      load: () => resource.promise,
    });
    const invoked = acceptedOperation(execute(fixture, operationAction()));
    const refreshed = execute(fixture, { type: "resource.refresh", resource: "stores" });
    expect(refreshed.status).toBe("resource-started");
    if (refreshed.status !== "resource-started") throw new TypeError("Expected refresh.");
    const disposed = disposeRuntimeOperationResourceActions(fixture.actions.handle);
    expect(disposed).toMatchObject({
      status: "disposed",
      disposedResources: 1,
      disposedInvocations: 1,
    });
    await expect(invoked.settlement).resolves.toMatchObject({ status: "disposed", actions: [] });
    await expect(refreshed.settlement).resolves.toMatchObject({ status: "disposed" });
  });

  it("rejects forged compositor handles without touching live managers", () => {
    const fixture = mountedFixture();
    expect(
      disposeRuntimeOperationResourceActions(
        {} as Parameters<typeof disposeRuntimeOperationResourceActions>[0],
      ),
    ).toMatchObject({ status: "invalid-handle" });
    expect(readRuntimeSurfaceResources(fixture.resources.handle).status).toBe("read");
    expect(readRuntimeSurfaceOperations(fixture.operations.handle).status).toBe("read");
  });
});
