import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  invokeRuntimeOperation,
  mountRuntimeSurfaceOperations,
  readRuntimeSurfaceOperations,
} from "../src/operation-lifecycle.js";
import {
  createRuntimeReactiveHostPorts,
  isRuntimeReactiveHostPorts,
} from "../src/reactive-host-ports.js";
import {
  mountRuntimeSurfaceResources,
  readRuntimeSurfaceResources,
  refreshRuntimeSurfaceResource,
  startRuntimeSurfaceResources,
} from "../src/resource-lifecycle.js";
import { createRuntimeResolutionSnapshot } from "../src/value-resolution.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeOperationRequest,
} from "../src/host-ports.js";

const REVISION = `sha256:${"a".repeat(64)}`;
const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";
const REQUEST = Object.freeze({
  context: Object.freeze({
    documentId: "com.desen.reactive-host-test",
    revision: REVISION,
    surfaceId: "sign-in",
    requestId: "request-1",
  }),
  capabilityId: "com.example.auth/signIn",
  invocationAlias: "signIn",
  input: Object.freeze({
    email: "person@example.test",
    password: "synthetic",
  }),
  effect: "network",
}) satisfies RuntimeOperationRequest;

interface Hooks {
  readonly invoke?: RuntimeHostPorts["operations"]["invoke"];
  readonly load?: RuntimeHostPorts["resources"]["load"];
}

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

let cachedCatalog: DesenValidatedExecutionCatalogSet | undefined;

function catalogSet(): DesenValidatedExecutionCatalogSet {
  if (cachedCatalog !== undefined) return cachedCatalog;
  const result = validateDesenExecutionCatalogSet([
    JSON.parse(JSON.stringify(frozenWebCatalog)) as unknown,
  ]);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected the frozen Catalog.");
  cachedCatalog = result.value;
  return cachedCatalog;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return Object.freeze({ promise, resolve });
}

function hostInput(hooks: Hooks = {}): RuntimeHostPorts {
  return {
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
      invoke:
        hooks.invoke ??
        (() => ({
          status: "succeeded",
          value: { userId: "user-1" },
        })),
    },
    resources: {
      load: hooks.load ?? (() => ({ status: "failed", errorCode: "unavailable" })),
    },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze({ tenant: "reference" }),
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  };
}

function resourceRequest() {
  return Object.freeze({
    context: Object.freeze({ ...REQUEST.context, requestId: "request-2" }),
    instanceId: "profile",
    capabilityId: "com.example.profile/read",
    input: Object.freeze({}),
  });
}

function resourceResolution(
  lifecycles: Parameters<typeof createRuntimeResolutionSnapshot>[0]["resource"],
) {
  return createRuntimeResolutionSnapshot({
    state: {},
    context: {},
    resource: lifecycles,
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: {},
  });
}

describe("createRuntimeReactiveHostPorts", () => {
  it("brands the captured aggregate and preserves every non-settlement callback by identity", () => {
    const input = hostInput();
    const ports = createRuntimeReactiveHostPorts(input);

    expect(isRuntimeReactiveHostPorts(ports)).toBe(true);
    expect(isRuntimeReactiveHostPorts(input)).toBe(false);
    expect(Object.isFrozen(ports)).toBe(true);
    expect(ports.operations.invoke).not.toBe(input.operations.invoke);
    expect(ports.resources.load).not.toBe(input.resources.load);
    expect(ports.navigation.navigate).toBe(input.navigation.navigate);
    expect(ports.storage.getBundle).toBe(input.storage.getBundle);
    expect(ports.storage.putBundle).toBe(input.storage.putBundle);
    expect(ports.storage.readActivation).toBe(input.storage.readActivation);
    expect(ports.storage.commitActivation).toBe(input.storage.commitActivation);
    expect(ports.tokens.resolve).toBe(input.tokens.resolve);
    expect(ports.context.getSnapshot).toBe(input.context.getSnapshot);
    expect(ports.context.subscribe).toBe(input.context.subscribe);
    expect(ports.environment.getSnapshot).toBe(input.environment.getSnapshot);
    expect(ports.environment.subscribe).toBe(input.environment.subscribe);
    expect(ports.clock.now).toBe(input.clock.now);
    expect(ports.diagnostics.report).toBe(input.diagnostics.report);
  });

  it("invokes synchronous host callbacks once without a receiver and returns a native Promise", async () => {
    const invoke = vi.fn(function (this: unknown) {
      expect(this).toBeUndefined();
      return { status: "succeeded" as const, value: { userId: "user-1" } };
    });
    const ports = createRuntimeReactiveHostPorts(
      hostInput({ invoke: invoke as RuntimeHostPorts["operations"]["invoke"] }),
    );

    const settlement = ports.operations.invoke(REQUEST);
    expect(settlement).toBeInstanceOf(Promise);
    await expect(settlement).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("detaches and recursively freezes successful operation and resource values", async () => {
    const operationValue = { user: { id: "user-1" }, roles: ["member"] };
    const resourceValue = { items: [{ id: "item-1" }] };
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => Promise.resolve({ status: "succeeded", value: operationValue }),
        load: () => Promise.resolve({ status: "succeeded", value: resourceValue }),
      }),
    );

    const operation = await ports.operations.invoke(REQUEST);
    const resource = await ports.resources.load(resourceRequest());
    operationValue.user.id = "mutated";
    operationValue.roles.push("admin");
    const firstResourceItem = resourceValue.items.at(0);
    if (firstResourceItem === undefined) throw new TypeError("Expected the resource fixture item.");
    firstResourceItem.id = "mutated";

    expect(operation).toEqual({
      status: "succeeded",
      value: { roles: ["member"], user: { id: "user-1" } },
    });
    expect(resource).toEqual({
      status: "succeeded",
      value: { items: [{ id: "item-1" }] },
    });
    expect(Object.isFrozen(operation)).toBe(true);
    expect(
      operation.status === "succeeded" &&
        Object.isFrozen(operation.value) &&
        Object.isFrozen((operation.value as { user: object }).user),
    ).toBe(true);
  });

  it.each<Readonly<{ readonly candidate: RuntimeHostCallResult }>>([
    { candidate: { status: "failed", errorCode: "invalidCredentials" } },
    { candidate: { status: "denied" } },
  ])("preserves the controlled $candidate.status envelope", async ({ candidate }) => {
    const ports = createRuntimeReactiveHostPorts(hostInput({ invoke: () => candidate }));
    const result = await ports.operations.invoke(REQUEST);
    expect(result).toEqual(candidate);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("adopts a foreign promise-like exactly once and exposes only its sanitized settlement", async () => {
    const then = vi.fn((resolve: (value: RuntimeHostCallResult) => void) =>
      resolve({ status: "succeeded", value: { ok: true } }),
    );
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => ({ then }) as unknown as PromiseLike<RuntimeHostCallResult>,
      }),
    );

    await expect(ports.operations.invoke(REQUEST)).resolves.toEqual({
      status: "succeeded",
      value: { ok: true },
    });
    expect(then).toHaveBeenCalledTimes(1);
  });

  it("redacts a throwing then getter without observing its private reason", async () => {
    const getThen = vi.fn(() => {
      throw new Error("private then getter");
    });
    const thenable = Object.defineProperty({}, "then", {
      configurable: true,
      get: getThen,
    });
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => thenable as unknown as PromiseLike<RuntimeHostCallResult>,
      }),
    );

    await expect(ports.operations.invoke(REQUEST)).rejects.toBeUndefined();
    expect(getThen).toHaveBeenCalledTimes(1);
  });

  it("uses native first-settlement semantics for resolve-then-throw and double settlement", async () => {
    const resolveThenThrow = {
      then(resolve: (value: RuntimeHostCallResult) => void) {
        resolve({ status: "succeeded", value: { winner: "resolved" } });
        throw new Error("ignored after resolution");
      },
    };
    const doubleSettlement = {
      then(resolve: (value: RuntimeHostCallResult) => void, reject: (reason?: unknown) => void) {
        resolve({ status: "succeeded", value: { winner: "first" } });
        reject(new Error("ignored rejection"));
        resolve({ status: "succeeded", value: { winner: "late" } });
      },
    };
    const first = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => resolveThenThrow as unknown as PromiseLike<RuntimeHostCallResult>,
      }),
    );
    const second = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => doubleSettlement as unknown as PromiseLike<RuntimeHostCallResult>,
      }),
    );

    await expect(first.operations.invoke(REQUEST)).resolves.toEqual({
      status: "succeeded",
      value: { winner: "resolved" },
    });
    await expect(second.operations.invoke(REQUEST)).resolves.toEqual({
      status: "succeeded",
      value: { winner: "first" },
    });
  });

  it("redacts synchronous throws and asynchronous rejection reasons", async () => {
    const thrown = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => {
          throw new Error("private stack");
        },
      }),
    );
    const rejected = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => Promise.reject(new Error("private provider response")),
      }),
    );

    await expect(thrown.operations.invoke(REQUEST)).rejects.toBeUndefined();
    await expect(rejected.operations.invoke(REQUEST)).rejects.toBeUndefined();
  });

  it.each([
    ["unknown status", { status: "other" }],
    ["extra success field", { status: "succeeded", value: null, secret: true }],
    ["missing success value", { status: "succeeded" }],
    ["non-string error code", { status: "failed", errorCode: 7 }],
    ["extra denial field", { status: "denied", value: null }],
    ["array envelope", [{ status: "denied" }]],
    [
      "class envelope",
      new (class Settlement {
        status = "denied";
      })(),
    ],
    [
      "accessor status",
      Object.defineProperty({}, "status", {
        configurable: true,
        enumerable: true,
        get: () => "denied",
      }),
    ],
    ["symbol field", Object.assign({ status: "denied" }, { [Symbol("secret")]: true })],
    [
      "cyclic success",
      (() => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return { status: "succeeded", value };
      })(),
    ],
  ])("rejects malformed settlement: %s", async (_label, candidate) => {
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => candidate as RuntimeHostCallResult,
      }),
    );
    await expect(ports.operations.invoke(REQUEST)).rejects.toBeUndefined();
  });

  it("contains reflection failures and never reads an accessor-backed payload", async () => {
    const readValue = vi.fn(() => ({ secret: true }));
    const candidate = Object.defineProperties(
      {},
      {
        status: { value: "succeeded", enumerable: true },
        value: { get: readValue, enumerable: true },
      },
    );
    const reflected = new Proxy(candidate, {
      ownKeys: () => {
        throw new Error("reflection failed");
      },
    });
    const ports = createRuntimeReactiveHostPorts(
      hostInput({ invoke: () => reflected as RuntimeHostCallResult }),
    );

    await expect(ports.operations.invoke(REQUEST)).rejects.toBeUndefined();
    expect(readValue).not.toHaveBeenCalled();
  });

  it("redacts a settlement Proxy revoked before sanitization", async () => {
    const revoked = Proxy.revocable({ status: "denied" as const }, {});
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => Promise.resolve(revoked.proxy),
      }),
    );
    const settlement = ports.operations.invoke(REQUEST);
    revoked.revoke();

    await expect(settlement).rejects.toBeUndefined();
  });

  it("finishes hostile Proxy reflection before the inert envelope becomes observable", async () => {
    const observations: string[] = [];
    const target = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(target, {
      status: { configurable: true, enumerable: true, value: "succeeded" },
      value: {
        configurable: true,
        enumerable: true,
        value: { userId: "user-1" },
      },
    });
    const candidate = new Proxy(target, {
      getPrototypeOf: () => {
        observations.push("getPrototypeOf");
        return null;
      },
      ownKeys: (owner) => {
        observations.push("ownKeys");
        return Reflect.ownKeys(owner);
      },
      getOwnPropertyDescriptor: (owner, key) => {
        observations.push(`descriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(owner, key);
      },
    });
    const ports = createRuntimeReactiveHostPorts(
      hostInput({ invoke: () => Promise.resolve(candidate as RuntimeHostCallResult) }),
    );

    const result = await ports.operations.invoke(REQUEST);
    observations.push("observed");
    expect(result).toEqual({ status: "succeeded", value: { userId: "user-1" } });
    expect(observations.at(-1)).toBe("observed");
    expect(observations).toContain("descriptor:value");
  });

  it("prevents Proxy reflection reentry from letting an older operation overwrite its replacement", async () => {
    const firstTransport = deferred<RuntimeHostCallResult>();
    let calls = 0;
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => {
          calls += 1;
          return calls === 1
            ? firstTransport.promise
            : { status: "succeeded", value: { userId: "current-user" } };
        },
      }),
    );
    const mounted = mountRuntimeSurfaceOperations({
      documentId: "com.desen.reactive-host-test",
      revision: REVISION,
      surfaceId: "sign-in",
      aliases: { signIn: { operation: SIGN_IN } },
      catalogSet: catalogSet(),
      hostPorts: ports,
    });
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected operation manager.");
    const first = invokeRuntimeOperation(mounted.handle, {
      alias: "signIn",
      operation: SIGN_IN,
      input: { email: "person@example.com", password: "synthetic" },
      concurrency: "replace",
      operationSnapshot: mounted.snapshot,
    });
    expect(first.status).toBe("started");
    if (first.status !== "started") throw new TypeError("Expected the first invocation.");

    let replacement:
      Extract<ReturnType<typeof invokeRuntimeOperation>, { status: "started" }> | undefined;
    let reentered = false;
    const staleTarget = {
      status: "succeeded" as const,
      value: { userId: "stale-user" },
    };
    const stale = new Proxy(staleTarget, {
      getPrototypeOf: (target) => {
        if (!reentered) {
          reentered = true;
          const read = readRuntimeSurfaceOperations(mounted.handle);
          if (read.status !== "read") throw new TypeError("Expected current operations.");
          const candidate = invokeRuntimeOperation(mounted.handle, {
            alias: "signIn",
            operation: SIGN_IN,
            input: { email: "person@example.com", password: "synthetic" },
            concurrency: "replace",
            operationSnapshot: read.snapshot,
          });
          if (candidate.status !== "started") {
            throw new TypeError(`Expected replacement, received ${candidate.status}.`);
          }
          replacement = candidate;
        }
        return Reflect.getPrototypeOf(target);
      },
    });

    firstTransport.resolve(stale);
    await expect(first.settlement).resolves.toMatchObject({ status: "superseded" });
    await Promise.resolve();
    const currentReplacement = replacement;
    if (currentReplacement === undefined) throw new TypeError("Expected reentrant replacement.");
    const replacementSettlement = await currentReplacement.settlement;

    expect(reentered).toBe(true);
    expect(calls).toBe(2);
    expect(replacementSettlement).toMatchObject({
      status: "succeeded",
      snapshot: {
        lifecycles: {
          signIn: {
            status: "succeeded",
            pending: false,
            value: { userId: "current-user" },
          },
        },
      },
    });
    if (replacementSettlement.status !== "succeeded") {
      throw new TypeError(`Expected success, received ${replacementSettlement.status}.`);
    }
    const finalRead = readRuntimeSurfaceOperations(mounted.handle);
    expect(finalRead.status).toBe("read");
    if (finalRead.status === "read") {
      expect(finalRead.snapshot).toBe(replacementSettlement.snapshot);
      expect(finalRead.snapshot.lifecycles.signIn).not.toMatchObject({
        value: { userId: "stale-user" },
      });
    }
  });

  it("prevents thenable execution reentry from letting an older operation overwrite its replacement", async () => {
    const mountedReference: {
      current?: Extract<ReturnType<typeof mountRuntimeSurfaceOperations>, { status: "mounted" }>;
    } = {};
    let replacement:
      Extract<ReturnType<typeof invokeRuntimeOperation>, { status: "started" }> | undefined;
    let calls = 0;
    const firstThenable = {
      then(resolve: (value: RuntimeHostCallResult) => void) {
        const current = mountedReference.current;
        if (current === undefined) throw new TypeError("Expected mounted operations.");
        const read = readRuntimeSurfaceOperations(current.handle);
        if (read.status !== "read") throw new TypeError("Expected current operations.");
        const candidate = invokeRuntimeOperation(current.handle, {
          alias: "signIn",
          operation: SIGN_IN,
          input: { email: "person@example.com", password: "synthetic" },
          concurrency: "replace",
          operationSnapshot: read.snapshot,
        });
        if (candidate.status !== "started") {
          throw new TypeError(`Expected replacement, received ${candidate.status}.`);
        }
        replacement = candidate;
        resolve({ status: "succeeded", value: { userId: "stale-thenable" } });
      },
    };
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        invoke: () => {
          calls += 1;
          return calls === 1
            ? (firstThenable as unknown as PromiseLike<RuntimeHostCallResult>)
            : { status: "succeeded", value: { userId: "current-thenable" } };
        },
      }),
    );
    const result = mountRuntimeSurfaceOperations({
      documentId: "com.desen.reactive-host-test",
      revision: REVISION,
      surfaceId: "sign-in",
      aliases: { signIn: { operation: SIGN_IN } },
      catalogSet: catalogSet(),
      hostPorts: ports,
    });
    if (result.status !== "mounted") throw new TypeError("Expected operation manager.");
    mountedReference.current = result;
    const first = invokeRuntimeOperation(result.handle, {
      alias: "signIn",
      operation: SIGN_IN,
      input: { email: "person@example.com", password: "synthetic" },
      concurrency: "replace",
      operationSnapshot: result.snapshot,
    });
    if (first.status !== "started") throw new TypeError("Expected first invocation.");

    await expect(first.settlement).resolves.toMatchObject({ status: "superseded" });
    const currentReplacement = replacement;
    if (currentReplacement === undefined) throw new TypeError("Expected thenable replacement.");
    const settlement = await currentReplacement.settlement;

    expect(calls).toBe(2);
    expect(settlement).toMatchObject({
      status: "succeeded",
      snapshot: {
        lifecycles: {
          signIn: {
            status: "succeeded",
            value: { userId: "current-thenable" },
          },
        },
      },
    });
  });

  it("prevents Proxy reflection reentry from letting an older resource overwrite its refresh", async () => {
    const firstTransport = deferred<RuntimeHostCallResult>();
    let calls = 0;
    const currentOutput = {
      items: [{ id: "current-store" }],
      bounds: {},
    };
    const ports = createRuntimeReactiveHostPorts(
      hostInput({
        load: () => {
          calls += 1;
          return calls === 1
            ? firstTransport.promise
            : { status: "succeeded", value: currentOutput };
        },
      }),
    );
    const mounted = mountRuntimeSurfaceResources({
      documentId: "com.desen.reactive-host-test",
      revision: REVISION,
      surfaceId: "sign-in",
      resources: {
        stores: { use: STORES, input: {}, policy: "mount" },
      },
      catalogSet: catalogSet(),
      hostPorts: ports,
    });
    expect(mounted.status).toBe("mounted");
    if (mounted.status !== "mounted") throw new TypeError("Expected resource manager.");
    const started = startRuntimeSurfaceResources(
      mounted.handle,
      resourceResolution(mounted.snapshot.lifecycles),
      mounted.snapshot,
    );
    expect(started.status).toBe("started");
    if (started.status !== "started") throw new TypeError("Expected resource start.");
    const first = started.entries.find((entry) => entry.instanceId === "stores");
    if (first?.status !== "started") throw new TypeError("Expected started resource entry.");

    let refresh:
      Extract<ReturnType<typeof refreshRuntimeSurfaceResource>, { status: "started" }> | undefined;
    let reentered = false;
    const staleTarget = {
      status: "succeeded" as const,
      value: { items: [{ id: "stale-store" }], bounds: {} },
    };
    const stale = new Proxy(staleTarget, {
      getPrototypeOf: (target) => {
        if (!reentered) {
          reentered = true;
          const read = readRuntimeSurfaceResources(mounted.handle);
          if (read.status !== "read") throw new TypeError("Expected current resources.");
          const candidate = refreshRuntimeSurfaceResource(mounted.handle, {
            instanceId: "stores",
            resourceSnapshot: read.snapshot,
            snapshot: resourceResolution(read.snapshot.lifecycles),
          });
          if (candidate.status !== "started") {
            throw new TypeError(`Expected refresh, received ${candidate.status}.`);
          }
          refresh = candidate;
        }
        return Reflect.getPrototypeOf(target);
      },
    });

    firstTransport.resolve(stale);
    await expect(first.settlement).resolves.toMatchObject({ status: "superseded" });
    await Promise.resolve();
    const currentRefresh = refresh;
    if (currentRefresh === undefined) throw new TypeError("Expected reentrant refresh.");
    const refreshSettlement = await currentRefresh.settlement;

    expect(reentered).toBe(true);
    expect(calls).toBe(2);
    expect(refreshSettlement).toMatchObject({
      status: "succeeded",
      snapshot: {
        lifecycles: {
          stores: {
            status: "succeeded",
            pending: false,
            value: currentOutput,
          },
        },
      },
    });
    const finalRead = readRuntimeSurfaceResources(mounted.handle);
    if (finalRead.status !== "read") throw new TypeError("Expected final resources.");
    expect(finalRead.snapshot.lifecycles.stores).not.toMatchObject({
      value: { items: [{ id: "stale-store" }] },
    });
  });

  it("does not freeze or mutate host-owned aggregate, request, result, or promise objects", async () => {
    const result = { status: "succeeded" as const, value: { ok: true } };
    const promise = Promise.resolve(result);
    const input = hostInput({ invoke: () => promise });
    const ports = createRuntimeReactiveHostPorts(input);

    await ports.operations.invoke(REQUEST);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.operations)).toBe(false);
    expect(Object.isFrozen(REQUEST)).toBe(true);
    expect(Object.isFrozen(result)).toBe(false);
    expect(Object.isFrozen(result.value)).toBe(false);
    expect(Object.isFrozen(promise)).toBe(false);
  });
});
