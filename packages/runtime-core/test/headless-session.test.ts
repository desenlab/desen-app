import { calculateDesenBundleRevision } from "@desen/protocol";
import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenSignInBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import * as adapterBridges from "../src/adapter-bridges.js";
import {
  attachRuntimeHeadlessSessionComponentCommands,
  authenticateRuntimeHeadlessSessionAdapterAuthority,
  authenticateRuntimeHeadlessSessionHostAuthority,
  detachRuntimeHeadlessSessionComponentCommands,
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
  subscribeRuntimeHeadlessSession,
  unsubscribeRuntimeHeadlessSession,
} from "../src/headless-session.js";

import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
} from "../src/host-ports.js";
import type {
  RuntimeHeadlessSessionComponentCommandsAttachment,
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionLimitProfile,
  RuntimeHeadlessSessionSnapshot,
} from "../src/headless-session.js";
import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";

type MutableRecord = Record<string, unknown>;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

interface HostControl {
  context: RuntimeJsonObject;
  environment: RuntimeJsonObject;
  readonly contextNotices: Set<() => void>;
  readonly environmentNotices: Set<() => void>;
  readonly operationAttempts: Deferred<RuntimeHostCallResult>[];
  readonly resourceAttempts: Deferred<RuntimeHostCallResult>[];
  readonly navigationTargets: string[];
  readonly navigationContexts: RuntimeJsonObject[];
  navigationHook: (() => void) | undefined;
  readonly contextUnsubscribe: () => void;
  readonly environmentUnsubscribe: () => void;
}

interface MountedFixture {
  readonly control: HostControl;
  readonly handle: RuntimeHeadlessSessionHandle;
  readonly hostPorts: RuntimeHostPorts;
  readonly initial: RuntimeHeadlessSessionSnapshot;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return Object.freeze({ promise, resolve });
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function control(): HostControl {
  return {
    context: Object.freeze({ title: "Sign in", tenant: "alpha" }),
    environment: Object.freeze({ locale: "en", platform: "web" }),
    contextNotices: new Set(),
    environmentNotices: new Set(),
    operationAttempts: [],
    resourceAttempts: [],
    navigationTargets: [],
    navigationContexts: [],
    navigationHook: undefined,
    contextUnsubscribe: vi.fn(),
    environmentUnsubscribe: vi.fn(),
  };
}

function hostPorts(target: HostControl): RuntimeHostPorts {
  return {
    navigation: {
      navigate(request) {
        target.navigationHook?.();
        target.navigationTargets.push(request.targetSurfaceId);
        target.navigationContexts.push(request.context as unknown as RuntimeJsonObject);
        return { status: "succeeded" };
      },
    },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: (request) => ({
        status: "committed",
        record: {
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        },
      }),
    },
    operations: {
      invoke() {
        const attempt = deferred<RuntimeHostCallResult>();
        target.operationAttempts.push(attempt);
        return attempt.promise;
      },
    },
    resources: {
      load() {
        const attempt = deferred<RuntimeHostCallResult>();
        target.resourceAttempts.push(attempt);
        return attempt.promise;
      },
    },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => target.context,
      subscribe(notice) {
        target.contextNotices.add(notice);
        return () => {
          target.contextNotices.delete(notice);
          target.contextUnsubscribe();
        };
      },
    },
    environment: {
      getSnapshot: () => target.environment,
      subscribe(notice) {
        target.environmentNotices.add(notice);
        return () => {
          target.environmentNotices.delete(notice);
          target.environmentUnsubscribe();
        };
      },
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  };
}

function mount(
  options: {
    readonly bundle?: unknown;
    readonly catalogs?: unknown;
    readonly target?: HostControl;
    readonly hostPorts?: RuntimeHostPorts;
    readonly limits?: RuntimeHeadlessSessionLimitProfile;
  } = {},
): MountedFixture {
  const target = options.target ?? control();
  const mountedHostPorts = options.hostPorts ?? hostPorts(target);
  const result = mountRuntimeHeadlessSession({
    bundle: options.bundle ?? clone(frozenSignInBundle),
    catalogs: options.catalogs ?? [clone(frozenWebCatalog)],
    hostPorts: mountedHostPorts,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(
    result.status,
    result.status === "invalid"
      ? `mount failed: ${result.reason} ${JSON.stringify(result.diagnostics)}`
      : undefined,
  ).toBe("mounted");
  if (result.status !== "mounted") throw new TypeError(`Expected mount: ${result.reason}`);
  return {
    control: target,
    handle: result.handle,
    hostPorts: mountedHostPorts,
    initial: result.snapshot,
    catalogSet: result.catalogSet,
  };
}

function validatedFrozenCatalogSet(): DesenValidatedExecutionCatalogSet {
  const result = validateDesenExecutionCatalogSet([clone(frozenWebCatalog)]);
  expect(result.valid, result.valid ? undefined : JSON.stringify(result.diagnostics)).toBe(true);
  if (!result.valid) throw new TypeError("Expected the frozen web Catalog to validate.");
  return result.value;
}

function mountAdapterAuthority(
  options: {
    readonly bundle?: unknown;
    readonly target?: HostControl;
  } = {},
): MountedFixture {
  return mount({
    ...(options.bundle === undefined ? {} : { bundle: options.bundle }),
    catalogs: validatedFrozenCatalogSet(),
    ...(options.target === undefined ? {} : { target: options.target }),
  });
}

function current(target: MountedFixture): RuntimeHeadlessSessionSnapshot {
  const read = readRuntimeHeadlessSession(target.handle);
  expect(read.status).toBe("read");
  if (read.status !== "read") throw new TypeError("Expected a live session.");
  return read.snapshot;
}

function runtimeInstance(snapshot: RuntimeHeadlessSessionSnapshot, sourceNodeId: string): string {
  const binding = snapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === sourceNodeId,
  );
  expect(binding).toBeDefined();
  if (binding === undefined) throw new TypeError(`Missing binding: ${sourceNodeId}`);
  return binding.runtimeInstanceId;
}

function operationStatus(
  snapshot: RuntimeHeadlessSessionSnapshot,
  alias = "signIn",
): string | undefined {
  const lifecycle = snapshot.operation[alias];
  if (typeof lifecycle !== "object" || lifecycle === null || Array.isArray(lifecycle)) {
    return undefined;
  }
  const record = lifecycle as RuntimeJsonObject;
  return typeof lifecycle === "object" && lifecycle !== null && typeof record.status === "string"
    ? record.status
    : undefined;
}

async function dispatch(
  target: MountedFixture,
  sourceNodeId: string,
  eventName: string,
  payload: unknown,
  snapshot = current(target),
): Promise<RuntimeHeadlessSessionSnapshot> {
  const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
    snapshot,
    runtimeInstanceId: runtimeInstance(snapshot, sourceNodeId),
    eventName,
    payload,
  });
  expect(result.status).toBe("dispatched");
  if (result.status !== "dispatched") throw new TypeError(`Expected dispatch: ${result.status}`);
  const completion = await result.completion;
  expect(["completed", "navigated"]).toContain(completion.status);
  expect(completion.snapshot).not.toBeNull();
  return completion.snapshot as RuntimeHeadlessSessionSnapshot;
}

async function flush(rounds = 30): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

async function waitFor(
  target: MountedFixture,
  predicate: (snapshot: RuntimeHeadlessSessionSnapshot) => boolean,
): Promise<RuntimeHeadlessSessionSnapshot> {
  for (let index = 0; index < 80; index += 1) {
    await Promise.resolve();
    const snapshot = current(target);
    if (predicate(snapshot)) return snapshot;
  }
  throw new TypeError(
    `The expected deterministic session state was not published: ${JSON.stringify({
      snapshot: current(target),
      navigationTargets: target.control.navigationTargets,
      attempts: target.control.operationAttempts.length,
      navigationContexts: target.control.navigationContexts,
    })}`,
  );
}

function notify(notices: Set<() => void>): void {
  for (const notice of [...notices]) notice();
}

function componentCommandBundle(): MutableRecord {
  const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
  const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
  const root = signIn.root as MutableRecord;
  const children = (root.slots as MutableRecord).default as MutableRecord[];
  const submit = children[4] as MutableRecord;
  const handlers = submit.on as MutableRecord;
  const press = handlers.press as unknown[];
  press.unshift({
    type: "component.command",
    target: "sign-in.password",
    command: "focus",
    input: {},
  });
  bundle.revision = calculateDesenBundleRevision(bundle);
  return bundle;
}

async function dispatchSubmit(target: MountedFixture, snapshot: RuntimeHeadlessSessionSnapshot) {
  const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
    snapshot,
    runtimeInstanceId: runtimeInstance(snapshot, "sign-in.submit"),
    eventName: "press",
    payload: {},
  });
  expect(result.status).toBe("dispatched");
  if (result.status !== "dispatched") throw new TypeError(`Expected dispatch: ${result.status}`);
  return result.completion;
}

function expectPortableJson(value: unknown, seen = new WeakSet<object>()): void {
  expect(["bigint", "function", "symbol", "undefined"]).not.toContain(typeof value);
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  expect(Array.isArray(value) || prototype === Object.prototype || prototype === null).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    expect(typeof key).toBe("string");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    expect(descriptor).toBeDefined();
    expect(descriptor !== undefined && "value" in descriptor).toBe(true);
    if (descriptor !== undefined && "value" in descriptor) {
      expectPortableJson(descriptor.value, seen);
    }
  }
}

describe("M05-T07 exact headless-session host authority", () => {
  it("authenticates only the exact mounted aggregate without exposing port authority", () => {
    const left = mount();
    const right = mount();

    const authenticated = authenticateRuntimeHeadlessSessionHostAuthority(left.handle, {
      hostPorts: left.hostPorts,
    });
    expect(authenticated).toEqual({ status: "authenticated" });
    expect(Object.isFrozen(authenticated)).toBe(true);
    expect(Reflect.ownKeys(authenticated)).toEqual(["status"]);
    expect("hostPorts" in authenticated).toBe(false);

    const sameChildren = { ...left.hostPorts };
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(left.handle, {
        hostPorts: sameChildren,
      }),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(left.handle, {
        hostPorts: right.hostPorts,
      }),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(right.handle, {
        hostPorts: left.hostPorts,
      }),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(right.handle, {
        hostPorts: right.hostPorts,
      }),
    ).toEqual({ status: "authenticated" });

    expect(disposeRuntimeHeadlessSession(left.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(right.handle).status).toBe("disposed");
  });

  it("never reflects into exact or mismatched host-port aggregates", () => {
    const target = control();
    let exactPortReflections = 0;
    const exactHostPorts = new Proxy(hostPorts(target), {
      get(...parameters) {
        exactPortReflections += 1;
        return Reflect.get(...parameters);
      },
      getOwnPropertyDescriptor(...parameters) {
        exactPortReflections += 1;
        return Reflect.getOwnPropertyDescriptor(...parameters);
      },
      getPrototypeOf(...parameters) {
        exactPortReflections += 1;
        return Reflect.getPrototypeOf(...parameters);
      },
      ownKeys(...parameters) {
        exactPortReflections += 1;
        return Reflect.ownKeys(...parameters);
      },
    });
    const mounted = mount({ target, hostPorts: exactHostPorts });
    exactPortReflections = 0;

    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(mounted.handle, {
        hostPorts: exactHostPorts,
      }),
    ).toEqual({ status: "authenticated" });
    expect(exactPortReflections).toBe(0);

    let mismatchedPortReflections = 0;
    const mismatchedHostPorts = new Proxy(
      {},
      {
        get() {
          mismatchedPortReflections += 1;
          throw new Error("Host-port values are private.");
        },
        getOwnPropertyDescriptor() {
          mismatchedPortReflections += 1;
          throw new Error("Host-port descriptors are private.");
        },
        getPrototypeOf() {
          mismatchedPortReflections += 1;
          throw new Error("Host-port prototypes are private.");
        },
        ownKeys() {
          mismatchedPortReflections += 1;
          throw new Error("Host-port keys are private.");
        },
      },
    ) as RuntimeHostPorts;
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(mounted.handle, {
        hostPorts: mismatchedHostPorts,
      }),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(mismatchedPortReflections).toBe(0);
    expect(disposeRuntimeHeadlessSession(mounted.handle).status).toBe("disposed");
  });

  it("rejects accessor-backed, inherited, extra, symbolic, and hostile request envelopes", () => {
    const target = mount();
    let accessorReads = 0;
    const accessorRequest = {};
    Object.defineProperty(accessorRequest, "hostPorts", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return target.hostPorts;
      },
    });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(target.handle, accessorRequest as never),
    ).toEqual({ status: "malformed-request" });
    expect(accessorReads).toBe(0);

    const nonEnumerableRequest = {};
    Object.defineProperty(nonEnumerableRequest, "hostPorts", {
      enumerable: false,
      value: target.hostPorts,
    });
    const symbolRequest = {
      hostPorts: target.hostPorts,
      [Symbol("hidden")]: true,
    };
    for (const request of [
      [],
      Object.assign(Object.create({}), { hostPorts: target.hostPorts }),
      {},
      { hostPorts: target.hostPorts, snapshot: target.initial },
      nonEnumerableRequest,
      symbolRequest,
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("reflection denied");
          },
        },
      ),
    ]) {
      const result = authenticateRuntimeHeadlessSessionHostAuthority(
        target.handle,
        request as never,
      );
      expect(result).toEqual({ status: "malformed-request" });
      expect(Object.isFrozen(result)).toBe(true);
    }

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(target.handle, revoked.proxy as never),
    ).toEqual({ status: "malformed-request" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(target.handle, {
        hostPorts: null,
      } as never),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
  });

  it("short-circuits disposed and forged handles before reflecting over a request", () => {
    const target = mount();
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
    let reflections = 0;
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflections += 1;
          throw new Error("must not reflect");
        },
        ownKeys() {
          reflections += 1;
          throw new Error("must not reflect");
        },
      },
    );

    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(target.handle, hostile as never),
    ).toEqual({ status: "disposed" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(
        {} as RuntimeHeadlessSessionHandle,
        hostile as never,
      ),
    ).toEqual({ status: "invalid-handle" });
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(null as never, hostile as never),
    ).toEqual({ status: "invalid-handle" });
    expect(reflections).toBe(0);
  });

  it("rechecks session authority after request reflection reenters disposal", () => {
    const disposedDuringPrototype = mount();
    const prototypeRequest = new Proxy(
      { hostPorts: disposedDuringPrototype.hostPorts },
      {
        getPrototypeOf(request) {
          expect(disposeRuntimeHeadlessSession(disposedDuringPrototype.handle).status).toBe(
            "disposed",
          );
          return Reflect.getPrototypeOf(request);
        },
      },
    );
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(
        disposedDuringPrototype.handle,
        prototypeRequest,
      ),
    ).toEqual({ status: "disposed" });

    const disposedDuringDescriptor = mount();
    const descriptorRequest = new Proxy(
      { hostPorts: disposedDuringDescriptor.hostPorts },
      {
        getOwnPropertyDescriptor(request, key) {
          expect(disposeRuntimeHeadlessSession(disposedDuringDescriptor.handle).status).toBe(
            "disposed",
          );
          return Reflect.getOwnPropertyDescriptor(request, key);
        },
      },
    );
    expect(
      authenticateRuntimeHeadlessSessionHostAuthority(
        disposedDuringDescriptor.handle,
        descriptorRequest,
      ),
    ).toEqual({ status: "disposed" });
  });
});

describe("M05-T02 exact framework-adapter session authority", () => {
  it("returns the exact retained Catalog authority for raw and prevalidated mount ingress", () => {
    const rawCatalogs = [clone(frozenWebCatalog)];
    const raw = mount({ catalogs: rawCatalogs });
    expect(raw.catalogSet).not.toBe(rawCatalogs);
    expectPortableJson(raw.initial);
    expect("catalogSet" in raw.initial).toBe(false);
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(raw.handle, {
        snapshot: raw.initial,
        catalogSet: raw.catalogSet,
      }),
    ).toEqual({ status: "authenticated", snapshot: raw.initial });

    const prevalidated = validatedFrozenCatalogSet();
    const retained = mount({ catalogs: prevalidated });
    expect(retained.catalogSet).toBe(prevalidated);
  });

  it("authenticates only the retained Catalog set and returns no lower authority", () => {
    const target = mountAdapterAuthority();
    const authenticated = authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, {
      snapshot: target.initial,
      catalogSet: target.catalogSet,
    });
    expect(authenticated).toEqual({
      status: "authenticated",
      snapshot: target.initial,
    });
    expect(Object.isFrozen(authenticated)).toBe(true);
    expect(Reflect.ownKeys(authenticated).sort()).toEqual(["snapshot", "status"]);
    if (authenticated.status !== "authenticated") {
      throw new TypeError("Expected exact adapter authority.");
    }
    expect(authenticated.snapshot).toBe(target.initial);
    expect("catalogSet" in authenticated).toBe(false);
    expect("plan" in authenticated).toBe(false);
    expect("hostPorts" in authenticated).toBe(false);

    const byteEqualCatalogSet = validatedFrozenCatalogSet();
    expect(byteEqualCatalogSet).not.toBe(target.catalogSet);
    const catalogMismatch = authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, {
      snapshot: target.initial,
      catalogSet: byteEqualCatalogSet,
    });
    expect(catalogMismatch).toEqual({ status: "invalid-catalog-set" });
    expect(Object.isFrozen(catalogMismatch)).toBe(true);
    expect(Reflect.ownKeys(catalogMismatch)).toEqual(["status"]);

    let catalogReflections = 0;
    const hostileCatalog = new Proxy(
      {},
      {
        get() {
          catalogReflections += 1;
          throw new Error("Catalog properties must remain private.");
        },
        getOwnPropertyDescriptor() {
          catalogReflections += 1;
          throw new Error("Catalog descriptors must remain private.");
        },
        ownKeys() {
          catalogReflections += 1;
          throw new Error("Catalog keys must remain private.");
        },
      },
    ) as DesenValidatedExecutionCatalogSet;
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, {
        snapshot: target.initial,
        catalogSet: hostileCatalog,
      }),
    ).toEqual({ status: "invalid-catalog-set" });
    expect(catalogReflections).toBe(0);
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
  });

  it("rejects stale, reconstructed, and foreign identities with deterministic precedence", async () => {
    const left = mountAdapterAuthority();
    const right = mountAdapterAuthority();
    const next = await dispatch(left, "sign-in.email", "change", {
      value: "adapter-authority@example.com",
    });

    const stale = authenticateRuntimeHeadlessSessionAdapterAuthority(left.handle, {
      snapshot: left.initial,
      catalogSet: left.catalogSet,
    });
    expect(stale).toEqual({ status: "invalid-snapshot", snapshot: next });
    expect(Object.isFrozen(stale)).toBe(true);
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(left.handle, {
        snapshot: clone(next),
        catalogSet: left.catalogSet,
      }),
    ).toEqual({ status: "invalid-snapshot", snapshot: next });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(left.handle, {
        snapshot: right.initial,
        catalogSet: right.catalogSet,
      }),
    ).toEqual({ status: "invalid-snapshot", snapshot: next });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(left.handle, {
        snapshot: next,
        catalogSet: right.catalogSet,
      }),
    ).toEqual({ status: "invalid-catalog-set" });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(right.handle, {
        snapshot: right.initial,
        catalogSet: right.catalogSet,
      }),
    ).toEqual({ status: "authenticated", snapshot: right.initial });

    expect(disposeRuntimeHeadlessSession(left.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(right.handle).status).toBe("disposed");
  });

  it("rejects hostile envelopes without invoking accessors or leaking reflection failures", () => {
    const target = mountAdapterAuthority();
    let accessorReads = 0;
    const accessorRequest = { catalogSet: target.catalogSet };
    Object.defineProperty(accessorRequest, "snapshot", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return target.initial;
      },
    });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, accessorRequest as never),
    ).toEqual({ status: "malformed-request" });
    expect(accessorReads).toBe(0);

    const nonEnumerableRequest = { catalogSet: target.catalogSet };
    Object.defineProperty(nonEnumerableRequest, "snapshot", {
      enumerable: false,
      value: target.initial,
    });
    const symbol = Symbol("hidden");
    const symbolRequest = {
      snapshot: target.initial,
      catalogSet: target.catalogSet,
      [symbol]: true,
    };
    for (const request of [
      [],
      Object.assign(Object.create({}), {
        snapshot: target.initial,
        catalogSet: target.catalogSet,
      }),
      { snapshot: target.initial },
      { snapshot: target.initial, catalogSet: target.catalogSet, plan: target.initial.plan },
      nonEnumerableRequest,
      symbolRequest,
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("reflection denied");
          },
        },
      ),
    ]) {
      const result = authenticateRuntimeHeadlessSessionAdapterAuthority(
        target.handle,
        request as never,
      );
      expect(result).toEqual({ status: "malformed-request" });
      expect(Object.isFrozen(result)).toBe(true);
    }

    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, revocable.proxy as never),
    ).toEqual({ status: "malformed-request" });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, {
        snapshot: null,
        catalogSet: target.catalogSet,
      } as never),
    ).toEqual({ status: "invalid-snapshot", snapshot: target.initial });
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
  });

  it("short-circuits disposed and forged handles before reflecting over caller input", () => {
    const target = mountAdapterAuthority();
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
    let reflections = 0;
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflections += 1;
          throw new Error("must not reflect");
        },
        ownKeys() {
          reflections += 1;
          throw new Error("must not reflect");
        },
      },
    );
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(target.handle, hostile as never),
    ).toEqual({ status: "disposed" });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(
        {} as RuntimeHeadlessSessionHandle,
        hostile as never,
      ),
    ).toEqual({ status: "invalid-handle" });
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(null as never, hostile as never),
    ).toEqual({ status: "invalid-handle" });
    expect(reflections).toBe(0);
  });

  it("rechecks authority after Proxy reflection disposes or republishes the session", () => {
    const disposedTarget = mountAdapterAuthority();
    const disposalRequest = new Proxy(
      {
        snapshot: disposedTarget.initial,
        catalogSet: disposedTarget.catalogSet,
      },
      {
        getPrototypeOf(request) {
          expect(disposeRuntimeHeadlessSession(disposedTarget.handle).status).toBe("disposed");
          return Reflect.getPrototypeOf(request);
        },
      },
    );
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(disposedTarget.handle, disposalRequest),
    ).toEqual({ status: "disposed" });

    const throwingTarget = mountAdapterAuthority();
    const throwingDisposalRequest = new Proxy(
      {
        snapshot: throwingTarget.initial,
        catalogSet: throwingTarget.catalogSet,
      },
      {
        ownKeys() {
          expect(disposeRuntimeHeadlessSession(throwingTarget.handle).status).toBe("disposed");
          throw new Error("reflection denied after disposal");
        },
      },
    );
    expect(
      authenticateRuntimeHeadlessSessionAdapterAuthority(
        throwingTarget.handle,
        throwingDisposalRequest,
      ),
    ).toEqual({ status: "disposed" });

    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const title = children[0] as MutableRecord;
    (title.props as MutableRecord).text = { $ref: "context.title" };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const publishedTarget = mountAdapterAuthority({ bundle });
    publishedTarget.control.context = Object.freeze({
      title: "Published during reflection",
      tenant: "alpha",
    });
    let publications = 0;
    const publicationRequest = new Proxy(
      {
        snapshot: publishedTarget.initial,
        catalogSet: publishedTarget.catalogSet,
      },
      {
        getPrototypeOf(request) {
          publications += 1;
          notify(publishedTarget.control.contextNotices);
          return Reflect.getPrototypeOf(request);
        },
      },
    );
    const publicationResult = authenticateRuntimeHeadlessSessionAdapterAuthority(
      publishedTarget.handle,
      publicationRequest,
    );
    expect(publications).toBe(1);
    expect(publicationResult.status).toBe("invalid-snapshot");
    if (publicationResult.status !== "invalid-snapshot") {
      throw new TypeError("Expected reentrant publication to stale the captured snapshot.");
    }
    expect(publicationResult.snapshot).toBe(current(publishedTarget));
    expect(publicationResult.snapshot).not.toBe(publishedTarget.initial);
    expect(JSON.stringify(publicationResult.snapshot.plan)).toContain(
      "Published during reflection",
    );
    expect(disposeRuntimeHeadlessSession(publishedTarget.handle).status).toBe("disposed");
  });
});

describe("M04-T16 exact ingress and initial headless materialization", () => {
  it("provides a reentrancy-safe snapshot-store subscription with terminal fan-out", async () => {
    const target = mount({ limits: { maxSubscriptions: 2 } });
    const notices: string[] = [];
    const firstSubscription = subscribeRuntimeHeadlessSession(target.handle, () => {
      notices.push(readRuntimeHeadlessSession(target.handle).status);
      if (firstSubscription?.status === "subscribed") {
        unsubscribeRuntimeHeadlessSession(firstSubscription.subscription);
      }
      throw new Error("hostile store listener");
    });
    const secondSubscription = subscribeRuntimeHeadlessSession(target.handle, () => {
      notices.push(`second:${readRuntimeHeadlessSession(target.handle).status}`);
    });
    expect(firstSubscription.status).toBe("subscribed");
    expect(secondSubscription.status).toBe("subscribed");
    expect(subscribeRuntimeHeadlessSession(target.handle, () => undefined)).toEqual({
      status: "subscription-limit",
    });
    expect(notices).toEqual([]);

    const changed = await dispatch(target, "sign-in.email", "change", {
      value: "subscriber@example.com",
    });
    await flush();
    expect(changed.state.email).toBe("subscriber@example.com");
    expect(notices).toEqual(["read", "second:read"]);

    expect(
      firstSubscription.status === "subscribed"
        ? unsubscribeRuntimeHeadlessSession(firstSubscription.subscription)
        : undefined,
    ).toEqual({ status: "already-unsubscribed" });
    const reusedSubscription = subscribeRuntimeHeadlessSession(target.handle, () => {
      notices.push(`reused:${readRuntimeHeadlessSession(target.handle).status}`);
    });
    expect(reusedSubscription.status).toBe("subscribed");
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
    await flush();
    expect(notices).toEqual(["read", "second:read", "second:disposed", "reused:disposed"]);
    expect(
      secondSubscription.status === "subscribed"
        ? unsubscribeRuntimeHeadlessSession(secondSubscription.subscription)
        : undefined,
    ).toEqual({ status: "already-unsubscribed" });
    expect(
      reusedSubscription.status === "subscribed"
        ? unsubscribeRuntimeHeadlessSession(reusedSubscription.subscription)
        : undefined,
    ).toEqual({ status: "already-unsubscribed" });
    expect(subscribeRuntimeHeadlessSession(target.handle, () => undefined)).toEqual({
      status: "disposed",
    });
    expect(
      subscribeRuntimeHeadlessSession({} as RuntimeHeadlessSessionHandle, () => undefined),
    ).toEqual({ status: "invalid-handle" });
    expect(subscribeRuntimeHeadlessSession(target.handle, undefined as never)).toEqual({
      status: "invalid-listener",
    });
    expect(unsubscribeRuntimeHeadlessSession({} as never)).toEqual({
      status: "invalid-subscription",
    });
  });

  it("delivers one terminal notice to every live listener after listener-driven disposal", async () => {
    const target = mount();
    const notices: string[] = [];
    const first = subscribeRuntimeHeadlessSession(target.handle, () => {
      const status = readRuntimeHeadlessSession(target.handle).status;
      notices.push(`first:${status}`);
      if (status === "read") disposeRuntimeHeadlessSession(target.handle);
    });
    const second = subscribeRuntimeHeadlessSession(target.handle, () => {
      notices.push(`second:${readRuntimeHeadlessSession(target.handle).status}`);
    });
    expect(first.status).toBe("subscribed");
    expect(second.status).toBe("subscribed");

    await dispatch(target, "sign-in.email", "change", { value: "dispose@example.com" });
    await flush();
    expect(notices).toEqual(["first:read", "second:disposed", "first:disposed"]);
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
  });

  it("validates the frozen Bundle/Catalog, verifies its revision, and publishes only active nodes", () => {
    const target = mount();
    expect(target.initial).toMatchObject({
      documentId: frozenSignInBundle.id,
      revision: frozenSignInBundle.revision,
      surfaceId: "sign-in",
      generation: 0,
      state: { email: "", password: "" },
      operation: { signIn: { status: "idle", pending: false } },
    });
    expect(target.initial.bindings.map(({ sourceNodeId }) => sourceNodeId)).not.toContain(
      "sign-in.error",
    );
    expect(
      [...target.initial.bindings]
        .sort((left, right) => left.registrationGeneration - right.registrationGeneration)
        .map(({ sourceNodeId }) => sourceNodeId),
    ).toEqual([
      "sign-in.layout",
      "sign-in.title",
      "sign-in.email",
      "sign-in.password",
      "sign-in.submit",
    ]);
    expect(JSON.stringify(target.initial.plan)).toContain("Sign in");
    expect(JSON.parse(JSON.stringify(target.initial))).toEqual(target.initial);
  });

  it("really rolls back an already-added binding after an injected mid-transaction failure", () => {
    const originalRegister = adapterBridges.registerRuntimeAdapterBinding;
    const originalUnregister = adapterBridges.unregisterRuntimeAdapterBinding;
    let registrationAttempts = 0;
    let unregistrationAttempts = 0;
    const register = vi
      .spyOn(adapterBridges, "registerRuntimeAdapterBinding")
      .mockImplementation((...arguments_: Parameters<typeof originalRegister>) => {
        registrationAttempts += 1;
        return registrationAttempts === 2
          ? Object.freeze({ status: "invalid", reason: "retained-limit" })
          : originalRegister(...arguments_);
      });
    const unregister = vi
      .spyOn(adapterBridges, "unregisterRuntimeAdapterBinding")
      .mockImplementation((...arguments_: Parameters<typeof originalUnregister>) => {
        unregistrationAttempts += 1;
        return originalUnregister(...arguments_);
      });
    try {
      expect(
        mountRuntimeHeadlessSession({
          bundle: clone(frozenSignInBundle),
          catalogs: [clone(frozenWebCatalog)],
          hostPorts: hostPorts(control()),
        }),
      ).toMatchObject({ status: "invalid", reason: "materialization-failed" });
    } finally {
      register.mockRestore();
      unregister.mockRestore();
    }
    expect(registrationAttempts).toBe(2);
    expect(unregistrationAttempts).toBe(1);
  });

  it("rejects malformed ingress and an otherwise valid Bundle with a stale revision", () => {
    expect(
      mountRuntimeHeadlessSession({
        bundle: {},
        catalogs: [clone(frozenWebCatalog)],
        hostPorts: hostPorts(control()),
      }),
    ).toMatchObject({ status: "invalid", reason: "bundle-invalid" });

    const stale = clone(frozenSignInBundle) as unknown as MutableRecord;
    const publication = stale.publication as MutableRecord;
    publication.publisher = "revision-excluded";
    const surfaces = stale.surfaces as MutableRecord;
    const signIn = surfaces["sign-in"] as MutableRecord;
    const state = signIn.state as MutableRecord;
    const email = state.email as MutableRecord;
    email.initial = "changed@example.com";
    expect(
      mountRuntimeHeadlessSession({
        bundle: stale,
        catalogs: [clone(frozenWebCatalog)],
        hostPorts: hostPorts(control()),
      }),
    ).toMatchObject({ status: "invalid", reason: "revision-mismatch" });
  });

  it("materializes the navigation target as an independently valid entry surface", () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    bundle.entry = "home";
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    expect(target.initial.surfaceId).toBe("home");
    expect(JSON.stringify(target.initial.plan)).toContain("Welcome");
  });

  // The deliberately wide vector normally completes near one second, but it can exceed Vitest's
  // generic five-second budget when every runtime-core file competes for the same CI worker.
  it("mounts beyond the former 4,096 aggregate scope-occurrence bottleneck", () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    root.slots = {
      default: Array.from({ length: 1_365 }, (_, index) => ({
        id: `wide.${index.toString().padStart(4, "0")}`,
        use: "com.example.ui/Text",
        props: { text: `Node ${index}` },
      })),
    };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    expect(target.initial.bindings).toHaveLength(1_366);
    expect(disposeRuntimeHeadlessSession(target.handle)).toEqual({
      status: "disposed",
      activatedSurfaces: 1,
    });
  }, 15_000);

  it("rejects an untrusted Catalog set and every malformed or widening limit profile", () => {
    expect(
      mountRuntimeHeadlessSession({
        bundle: clone(frozenSignInBundle),
        catalogs: [{}],
        hostPorts: hostPorts(control()),
      }),
    ).toMatchObject({ status: "invalid", reason: "catalog-invalid" });

    for (const limits of [
      { maxNodes: -1 },
      { maxNodes: 5_001 },
      { maxDepth: 1.5 },
      { maxDepth: 129 },
      { maxBindingCandidates: 5_001 },
      { maxEventHandlerBindings: 5_001 },
      { maxSubscriptions: 257 },
      { maxSurfaceTransitions: 65 },
      { maxSnapshotGeneration: Number.POSITIVE_INFINITY },
      { maxPlanJsonOccurrences: 262_145 },
      { maxPlanCodeUnits: 4_194_305 },
      { unknown: 1 },
    ]) {
      expect(
        mountRuntimeHeadlessSession({
          bundle: clone(frozenSignInBundle),
          catalogs: [clone(frozenWebCatalog)],
          hostPorts: hostPorts(control()),
          limits: limits as RuntimeHeadlessSessionLimitProfile,
        }),
      ).toMatchObject({ status: "invalid", reason: "malformed-input" });
    }
  });

  it("does not invoke hostile mount accessors and contains reflection-failing Proxies", () => {
    let reads = 0;
    const accessorInput = {
      catalogs: [clone(frozenWebCatalog)],
      hostPorts: hostPorts(control()),
    };
    Object.defineProperty(accessorInput, "bundle", {
      enumerable: true,
      get() {
        reads += 1;
        return clone(frozenSignInBundle);
      },
    });
    expect(mountRuntimeHeadlessSession(accessorInput as never)).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
    });
    expect(reads).toBe(0);

    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("reflection denied");
        },
      },
    );
    expect(mountRuntimeHeadlessSession(hostile as never)).toMatchObject({
      status: "invalid",
      reason: "malformed-input",
    });
  });
});

describe("M04-T16 official frozen sign-in trace", () => {
  it("publishes a generic recursively nested operation settlement without polling", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const error = children[3] as MutableRecord;
    const errorWhen = error.when as MutableRecord;
    const errorArguments = errorWhen.args as MutableRecord[];
    errorArguments[0] = { $ref: "operation.reorder.status" };
    const submit = children[4] as MutableRecord;
    const submitProps = submit.props as MutableRecord;
    submitProps.loading = { $ref: "operation.reorder.pending", fallback: false };
    const handlers = submit.on as MutableRecord;
    const press = handlers.press as MutableRecord[];
    const parentOperation = press[0] as MutableRecord;
    parentOperation.operation = "com.example.tasks/reorder";
    parentOperation.as = "reorder";
    parentOperation.input = { itemKey: "parent", fromIndex: 0, toIndex: 1 };
    parentOperation.onSuccess = [
      {
        type: "operation.invoke",
        operation: "com.example.tasks/reorder",
        as: "nestedReorder",
        input: { itemKey: "nested", fromIndex: 1, toIndex: 0 },
        concurrency: "replace",
        onSuccess: [
          {
            type: "state.set",
            path: "email",
            value: "nested-settlement@example.com",
          },
        ],
      },
    ];
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    const published: RuntimeHeadlessSessionSnapshot[] = [];
    const subscription = subscribeRuntimeHeadlessSession(target.handle, () => {
      const read = readRuntimeHeadlessSession(target.handle);
      if (read.status === "read") published.push(read.snapshot);
    });
    expect(subscription.status).toBe("subscribed");

    await dispatch(target, "sign-in.submit", "press", {});
    expect(target.control.operationAttempts).toHaveLength(1);

    target.control.operationAttempts[0]?.resolve({
      status: "succeeded",
      value: {},
    });
    await flush();
    expect(target.control.operationAttempts).toHaveLength(2);
    expect(published.some((candidate) => operationStatus(candidate, "reorder") === "pending")).toBe(
      true,
    );

    target.control.operationAttempts[1]?.resolve({
      status: "succeeded",
      value: {},
    });
    const terminal = await waitFor(
      target,
      (candidate) => candidate.state.email === "nested-settlement@example.com",
    );
    await flush();
    expect(operationStatus(terminal, "nestedReorder")).toBe("succeeded");
    expect(target.control.navigationTargets).toEqual([]);
    expect(
      published.some((candidate) => candidate.state.email === "nested-settlement@example.com"),
    ).toBe(true);
    if (subscription.status === "subscribed") {
      expect(unsubscribeRuntimeHeadlessSession(subscription.subscription)).toEqual({
        status: "unsubscribed",
      });
    }
  });

  it("publishes edits, pending, failure, retry, success, and exact home handoff", async () => {
    const target = mount();
    const email = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    expect(email.state.email).toBe("person@example.com");
    expect(JSON.stringify(email.plan)).toContain("person@example.com");

    const password = await dispatch(
      target,
      "sign-in.password",
      "change",
      { value: "secret" },
      email,
    );
    expect(password.state.password).toBe("secret");

    const pending = await dispatch(target, "sign-in.submit", "press", {}, password);
    expect(target.control.operationAttempts).toHaveLength(1);
    expect(pending.operation.signIn).toEqual({ status: "pending", pending: true });
    expect(JSON.stringify(pending.plan)).toContain('"loading":true');
    expect(pending.bindings.map(({ sourceNodeId }) => sourceNodeId)).not.toContain("sign-in.error");

    target.control.operationAttempts[0]?.resolve({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    const failed = await waitFor(target, (snapshot) => operationStatus(snapshot) === "failed");
    expect(failed.bindings.map(({ sourceNodeId }) => sourceNodeId)).toContain("sign-in.error");
    expect(JSON.stringify(failed.plan)).toContain("Sign-in failed");

    const retryPending = await dispatch(target, "sign-in.submit", "press", {}, failed);
    expect(retryPending.operation.signIn).toEqual({ status: "pending", pending: true });
    expect(retryPending.bindings.map(({ sourceNodeId }) => sourceNodeId)).not.toContain(
      "sign-in.error",
    );
    await flush();
    expect(target.control.operationAttempts).toHaveLength(2);
    target.control.operationAttempts[1]?.resolve({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    const home = await waitFor(target, (snapshot) => snapshot.surfaceId === "home");
    expect(home.surfaceId).toBe("home");
    expect(JSON.stringify(home.plan)).toContain("Welcome");
    expect(target.control.navigationTargets).toEqual(["home"]);
  });

  it("keeps newest-wins replacement and ignores the stale first settlement", async () => {
    const target = mount();
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    const firstPending = await dispatch(target, "sign-in.submit", "press", {}, snapshot);
    const secondPending = await dispatch(target, "sign-in.submit", "press", {}, firstPending);
    expect(operationStatus(secondPending)).toBe("pending");
    expect(target.control.operationAttempts).toHaveLength(2);

    target.control.operationAttempts[0]?.resolve({
      status: "succeeded",
      value: { userId: "stale" },
    });
    await flush();
    expect(current(target).surfaceId).toBe("sign-in");
    expect(operationStatus(current(target))).toBe("pending");

    target.control.operationAttempts[1]?.resolve({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    const failed = await waitFor(target, (candidate) => operationStatus(candidate) === "failed");
    expect(failed.surfaceId).toBe("sign-in");
    expect(target.control.navigationTargets).toEqual([]);
  });

  it("removes the false interactive Alert subtree and restores it only for current failure", async () => {
    const target = mount();
    expect(
      target.initial.bindings.some(({ sourceNodeId }) => sourceNodeId === "sign-in.error"),
    ).toBe(false);
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    await dispatch(target, "sign-in.submit", "press", {}, snapshot);
    target.control.operationAttempts[0]?.resolve({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    const failed = await waitFor(target, (candidate) => operationStatus(candidate) === "failed");
    expect(failed.bindings.some(({ sourceNodeId }) => sourceNodeId === "sign-in.error")).toBe(true);
    const pending = await dispatch(target, "sign-in.submit", "press", {}, failed);
    expect(pending.bindings.some(({ sourceNodeId }) => sourceNodeId === "sign-in.error")).toBe(
      false,
    );
  });
});

describe("M04-T16 event authority, reactive hosts, and cleanup", () => {
  it("terminally disposes the complete session after an injected T13 resource publication fault", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    signIn.resources = {
      stores: {
        use: "com.example.stores/list",
        input: {},
        policy: "manual",
      },
    };
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const email = children[1] as MutableRecord;
    email.on = {
      change: [{ type: "resource.refresh", resource: "stores" }],
    };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    await dispatch(target, "sign-in.email", "change", {
      value: "ignored@example.com",
    });
    expect(target.control.resourceAttempts).toHaveLength(1);

    const originalFreeze = Object.freeze;
    let injectedFailures = 0;
    const freeze = vi.spyOn(Object, "freeze").mockImplementation(((value: object) => {
      const keys = typeof value === "object" && value !== null ? Reflect.ownKeys(value) : [];
      const actionTurnSnapshotKeys = [
        "commandEventSnapshot",
        "documentId",
        "generation",
        "operationSnapshot",
        "resourceSnapshot",
        "revision",
        "stateSnapshot",
        "surfaceId",
      ];
      if (
        injectedFailures === 0 &&
        keys.length === actionTurnSnapshotKeys.length &&
        actionTurnSnapshotKeys.every((key) => keys.includes(key))
      ) {
        injectedFailures += 1;
        throw new Error("injected T13 resource publication fault");
      }
      return originalFreeze(value);
    }) as typeof Object.freeze);
    try {
      target.control.resourceAttempts[0]?.resolve({
        status: "succeeded",
        value: { items: [], bounds: {} },
      });
      await flush(120);
    } finally {
      freeze.mockRestore();
    }
    expect(injectedFailures).toBe(1);
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
  });

  it("rejects malformed payloads, stale snapshots, and unknown runtime instances", async () => {
    const target = mount();
    const initial = target.initial;
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot: initial,
        runtimeInstanceId: runtimeInstance(initial, "sign-in.email"),
        eventName: "change",
        payload: { wrong: true },
      }),
    ).toMatchObject({ status: "rejected", reason: "payload-invalid" });

    const next = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot: initial,
        runtimeInstanceId: runtimeInstance(initial, "sign-in.email"),
        eventName: "change",
        payload: { value: "stale@example.com" },
      }),
    ).toMatchObject({ status: "invalid-snapshot", snapshot: next });
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot: next,
        runtimeInstanceId: "not-live",
        eventName: "change",
        payload: { value: "ignored@example.com" },
      }),
    ).toEqual({ status: "unknown-binding" });
  });

  it("rejects cloned/foreign authorities and event accessors without invoking them", () => {
    const left = mount();
    const right = mount();
    const cloned = clone(left.initial);
    expect(
      dispatchRuntimeHeadlessSessionEvent(left.handle, {
        snapshot: cloned,
        runtimeInstanceId: runtimeInstance(left.initial, "sign-in.email"),
        eventName: "change",
        payload: { value: "clone@example.com" },
      }),
    ).toMatchObject({ status: "invalid-snapshot", snapshot: left.initial });
    expect(
      dispatchRuntimeHeadlessSessionEvent(left.handle, {
        snapshot: right.initial,
        runtimeInstanceId: runtimeInstance(right.initial, "sign-in.email"),
        eventName: "change",
        payload: { value: "foreign@example.com" },
      }),
    ).toMatchObject({ status: "invalid-snapshot", snapshot: left.initial });
    expect(readRuntimeHeadlessSession({} as RuntimeHeadlessSessionHandle)).toEqual({
      status: "invalid-handle",
    });

    let reads = 0;
    const hostileEvent = {
      snapshot: left.initial,
      runtimeInstanceId: runtimeInstance(left.initial, "sign-in.email"),
      payload: { value: "hidden@example.com" },
    };
    Object.defineProperty(hostileEvent, "eventName", {
      enumerable: true,
      get() {
        reads += 1;
        return "change";
      },
    });
    expect(dispatchRuntimeHeadlessSessionEvent(left.handle, hostileEvent as never)).toEqual({
      status: "malformed-request",
    });
    expect(reads).toBe(0);
    expect(
      dispatchRuntimeHeadlessSessionEvent(left.handle, {
        snapshot: left.initial,
        runtimeInstanceId: runtimeInstance(left.initial, "sign-in.email"),
        eventName: "change",
        payload: new Proxy(
          {},
          {
            ownKeys() {
              throw new Error("payload reflection denied");
            },
          },
        ),
      }),
    ).toMatchObject({ status: "rejected", reason: "payload-invalid" });
  });

  it("commits context and environment invalidations through T15 without polling", () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const surfaces = bundle.surfaces as MutableRecord;
    const signIn = surfaces["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    const slots = root.slots as MutableRecord;
    const children = slots.default as MutableRecord[];
    const title = children[0] as MutableRecord;
    const props = title.props as MutableRecord;
    props.text = { $ref: "context.title" };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    expect(JSON.stringify(target.initial.plan)).toContain("Sign in");

    target.control.context = Object.freeze({ title: "Welcome back", tenant: "alpha" });
    notify(target.control.contextNotices);
    expect(JSON.stringify(current(target).plan)).toContain("Welcome back");

    target.control.environment = Object.freeze({ locale: "tr", platform: "web" });
    notify(target.control.environmentNotices);
    expect(current(target).surfaceId).toBe("sign-in");
  });

  it("consumes byte-equal reevaluation candidates and keeps the exact public snapshot dispatchable", async () => {
    const target = mount();
    for (let index = 0; index < 65; index += 1) {
      notify(target.control.environmentNotices);
    }
    expect(current(target)).toBe(target.initial);
    const completion = await dispatch(target, "sign-in.email", "change", {
      value: "still-live@example.com",
    });
    expect(completion.state.email).toBe("still-live@example.com");
  });

  it("publishes current lower namespaces even when the T15 commitment bytes stay equal", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const state = signIn.state as MutableRecord;
    state.auditFlag = { schema: { type: "boolean" }, initial: false };
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const email = children[1] as MutableRecord;
    email.on = {
      change: [{ type: "state.set", path: "auditFlag", value: true }],
    };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    const updated = await dispatch(target, "sign-in.email", "change", {
      value: "ignored@example.com",
    });
    expect(updated.state.auditFlag).toBe(true);
    expect(updated.generation).toBe(1);
    expect(updated.evaluationId).toBe(target.initial.evaluationId);
    expect(updated.plan).toBe(target.initial.plan);
    expect(updated.bindings).toBe(target.initial.bindings);
  });

  it("terminally disposes instead of exposing a permanently stale plan after hostile context", () => {
    const target = mount();
    const before = target.initial;
    target.control.context = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("context reflection denied");
        },
      },
    ) as RuntimeJsonObject;
    notify(target.control.contextNotices);
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot: before,
        runtimeInstanceId: runtimeInstance(before, "sign-in.email"),
        eventName: "change",
        payload: { value: "blocked@example.com" },
      }),
    ).toEqual({ status: "disposed" });
  });

  it("enforces binding and snapshot publication ceilings without a partial registry", async () => {
    const referenceBoundary = mount({
      limits: {
        maxBindingCandidates: 5_000,
        maxEventHandlerBindings: 5_000,
      },
    });
    expect(disposeRuntimeHeadlessSession(referenceBoundary.handle).status).toBe("disposed");

    const boundedControl = control();
    expect(
      mountRuntimeHeadlessSession({
        bundle: clone(frozenSignInBundle),
        catalogs: [clone(frozenWebCatalog)],
        hostPorts: hostPorts(boundedControl),
        limits: { maxBindingCandidates: 4 },
      }),
    ).toMatchObject({
      status: "invalid",
      reason: "materialization-failed",
    });
    expect(boundedControl.contextNotices).toHaveLength(0);
    expect(boundedControl.environmentNotices).toHaveLength(0);
    expect(
      mountRuntimeHeadlessSession({
        bundle: clone(frozenSignInBundle),
        catalogs: [clone(frozenWebCatalog)],
        hostPorts: hostPorts(control()),
        limits: { maxEventHandlerBindings: 2 },
      }),
    ).toMatchObject({ status: "invalid", reason: "materialization-failed" });
    const exactEventBoundary = mount({ limits: { maxEventHandlerBindings: 3 } });
    expect(disposeRuntimeHeadlessSession(exactEventBoundary.handle).status).toBe("disposed");

    const generationBound = mount({ limits: { maxSnapshotGeneration: 0 } });
    const result = dispatchRuntimeHeadlessSessionEvent(generationBound.handle, {
      snapshot: generationBound.initial,
      runtimeInstanceId: runtimeInstance(generationBound.initial, "sign-in.email"),
      eventName: "change",
      payload: { value: "next@example.com" },
    });
    expect(result.status).toBe("dispatched");
    if (result.status !== "dispatched") throw new TypeError("Expected a bounded dispatch.");
    await result.completion;
    expect(readRuntimeHeadlessSession(generationBound.handle)).toEqual({ status: "disposed" });

    const bindingChangingBundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const bindingChangingSignIn = (bindingChangingBundle.surfaces as MutableRecord)[
      "sign-in"
    ] as MutableRecord;
    const bindingChangingRoot = bindingChangingSignIn.root as MutableRecord;
    const bindingChangingChildren = (bindingChangingRoot.slots as MutableRecord)
      .default as MutableRecord[];
    const conditionalError = bindingChangingChildren[3] as MutableRecord;
    conditionalError.when = {
      op: "truthy",
      args: [{ $ref: "context.showError" }],
    };
    bindingChangingBundle.revision = calculateDesenBundleRevision(bindingChangingBundle);
    const bindingChangingControl = control();
    bindingChangingControl.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      showError: false,
    });
    const bindingChanging = mount({
      bundle: bindingChangingBundle,
      target: bindingChangingControl,
      limits: { maxSnapshotGeneration: 0 },
    });
    bindingChanging.control.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      showError: true,
    });
    notify(bindingChanging.control.contextNotices);
    expect(readRuntimeHeadlessSession(bindingChanging.handle)).toEqual({ status: "disposed" });

    const rollback = mount({ limits: { maxBindingCandidates: 5 } });
    let snapshot = await dispatch(rollback, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(
      rollback,
      "sign-in.password",
      "change",
      { value: "secret" },
      snapshot,
    );
    await dispatch(rollback, "sign-in.submit", "press", {}, snapshot);
    rollback.control.operationAttempts[0]?.resolve({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    await flush();
    expect(readRuntimeHeadlessSession(rollback.handle)).toEqual({ status: "disposed" });
  });

  it("enforces the managed-surface transition ceiling", async () => {
    const target = mount({ limits: { maxSurfaceTransitions: 0 } });
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    await dispatch(target, "sign-in.submit", "press", {}, snapshot);
    await flush();
    target.control.operationAttempts[0]?.resolve({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    await flush();
    expect(target.control.navigationTargets).toEqual(["home"]);
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
  });

  it("authenticates behavior provenance before executing its exact prepared program", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const surfaces = bundle.surfaces as MutableRecord;
    const signIn = surfaces["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    root.behaviors = [
      {
        id: "sign-in.sort",
        use: "com.example.interactions/Sortable",
        props: { axis: "vertical", handle: "item" },
        on: {
          reorder: [
            {
              type: "state.set",
              path: "email",
              value: { $ref: "event.itemKey" },
            },
          ],
        },
      },
    ];
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    const behavior = target.initial.bindings.find(
      (binding) => binding.kind === "behavior" && binding.behaviorId === "sign-in.sort",
    );
    expect(behavior).toBeDefined();
    if (behavior === undefined) throw new TypeError("Expected the Sortable behavior binding.");
    expect(target.initial.plan.root[0]?.behaviors[0]?.identity).toBe(behavior.runtimeInstanceId);
    const owner = target.initial.bindings.find(
      (binding) => binding.kind === "component" && binding.sourceNodeId === "sign-in.layout",
    );
    expect(owner?.registrationGeneration).toBe(0);
    expect(behavior.registrationGeneration).toBe(1);
    const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
      snapshot: target.initial,
      runtimeInstanceId: behavior.runtimeInstanceId,
      eventName: "reorder",
      payload: { fromIndex: 0, toIndex: 1, itemKey: "sorted@example.com" },
    });
    expect(result.status).toBe("dispatched");
    if (result.status !== "dispatched") throw new TypeError("Expected behavior dispatch.");
    const completion = await result.completion;
    expect(completion.snapshot?.state.email).toBe("sorted@example.com");
  });

  it("replaces repeated behavior provenance with the desired stable-key item scope", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    root.repeat = {
      items: { $ref: "context.rows" },
      as: "row",
      key: { $ref: "item.row.id" },
    };
    root.behaviors = [
      {
        id: "sign-in.sort",
        use: "com.example.interactions/Sortable",
        props: { axis: "vertical", handle: "item" },
        on: {
          reorder: [
            {
              type: "state.set",
              path: "email",
              value: { $ref: "item.row.label" },
            },
          ],
        },
      },
    ];
    bundle.revision = calculateDesenBundleRevision(bundle);
    const targetControl = control();
    targetControl.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      rows: [{ id: "stable", label: "First scope" }],
    });
    const target = mount({ bundle, target: targetControl });
    const firstBehavior = target.initial.bindings.find(
      (binding) => binding.kind === "behavior" && binding.behaviorId === "sign-in.sort",
    );
    expect(firstBehavior).toBeDefined();
    if (firstBehavior === undefined) throw new TypeError("Expected repeated behavior.");
    expect(target.initial.plan.root[0]?.behaviors[0]?.identity).toBe(
      firstBehavior.runtimeInstanceId,
    );

    target.control.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      rows: [{ id: "stable", label: "Desired scope" }],
    });
    notify(target.control.contextNotices);
    const desired = current(target);
    const desiredBehavior = desired.bindings.find(
      (binding) => binding.kind === "behavior" && binding.behaviorId === "sign-in.sort",
    );
    expect(desiredBehavior).toBeDefined();
    if (desiredBehavior === undefined) throw new TypeError("Expected desired behavior.");
    expect(desiredBehavior.runtimeInstanceId).toBe(firstBehavior.runtimeInstanceId);
    expect(desiredBehavior.registrationGeneration).toBeGreaterThan(
      firstBehavior.registrationGeneration,
    );

    const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
      snapshot: desired,
      runtimeInstanceId: desiredBehavior.runtimeInstanceId,
      eventName: "reorder",
      payload: { fromIndex: 0, toIndex: 0, itemKey: "stable" },
    });
    expect(result.status).toBe("dispatched");
    if (result.status !== "dispatched") throw new TypeError("Expected desired behavior dispatch.");
    const completion = await result.completion;
    expect(completion.snapshot?.state.email).toBe("Desired scope");
  });

  it("holds a second event while the first synchronous turn removes its own binding", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const state = signIn.state as MutableRecord;
    state.emailVisible = { schema: { type: "boolean" }, initial: true };
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const email = children[1] as MutableRecord;
    email.when = { op: "truthy", args: [{ $ref: "state.emailVisible" }] };
    email.on = {
      change: [{ type: "state.set", path: "emailVisible", value: false }],
    };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const target = mount({ bundle });
    const request = {
      snapshot: target.initial,
      runtimeInstanceId: runtimeInstance(target.initial, "sign-in.email"),
      eventName: "change",
      payload: { value: "first@example.com" },
    } as const;
    const first = dispatchRuntimeHeadlessSessionEvent(target.handle, request);
    expect(first.status).toBe("dispatched");
    const second = dispatchRuntimeHeadlessSessionEvent(target.handle, request);
    expect(second).toEqual({ status: "rejected", reason: "turn-rejected" });
    if (first.status !== "dispatched") throw new TypeError("Expected first dispatch.");
    const completion = await first.completion;
    expect(completion.snapshot?.bindings.map(({ sourceNodeId }) => sourceNodeId)).not.toContain(
      "sign-in.email",
    );
  });

  it("defers reentrant payload disposal until T14 unwinds and returns a terminal outcome", async () => {
    const target = mount();
    let disposal: ReturnType<typeof disposeRuntimeHeadlessSession> | undefined;
    const payload = new Proxy(
      { value: "dispose@example.com" },
      {
        ownKeys(subject) {
          disposal ??= disposeRuntimeHeadlessSession(target.handle);
          return Reflect.ownKeys(subject);
        },
      },
    );
    const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
      snapshot: target.initial,
      runtimeInstanceId: runtimeInstance(target.initial, "sign-in.email"),
      eventName: "change",
      payload,
    });
    expect(disposal).toEqual({ status: "disposed", activatedSurfaces: 1 });
    expect(result).toEqual({ status: "disposed" });
    await flush();
    expect(target.control.contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(target.control.environmentUnsubscribe).toHaveBeenCalledTimes(1);
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot: target.initial,
        runtimeInstanceId: runtimeInstance(target.initial, "sign-in.email"),
        eventName: "change",
        payload: { value: "late@example.com" },
      }),
    ).toEqual({ status: "disposed" });
  });

  it("completes host-navigation reentrant disposal after the T13 callback unwinds", async () => {
    const bundle = clone(frozenSignInBundle) as unknown as MutableRecord;
    const signIn = (bundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const email = children[1] as MutableRecord;
    email.on = {
      change: [{ type: "navigate", surface: "home" }],
    };
    bundle.revision = calculateDesenBundleRevision(bundle);
    const targetControl = control();
    const target = mount({ bundle, target: targetControl });
    let disposal: ReturnType<typeof disposeRuntimeHeadlessSession> | undefined;
    target.control.navigationHook = () => {
      disposal ??= disposeRuntimeHeadlessSession(target.handle);
    };

    const result = dispatchRuntimeHeadlessSessionEvent(target.handle, {
      snapshot: target.initial,
      runtimeInstanceId: runtimeInstance(target.initial, "sign-in.email"),
      eventName: "change",
      payload: { value: "navigate@example.com" },
    });
    expect(disposal).toEqual({ status: "disposed", activatedSurfaces: 1 });
    expect(result).toEqual({ status: "disposed" });
    expect(target.control.navigationTargets).toEqual(["home"]);
    await flush();
    expect(target.control.contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(target.control.environmentUnsubscribe).toHaveBeenCalledTimes(1);
    expect(disposeRuntimeHeadlessSession(target.handle)).toEqual({
      status: "already-disposed",
      activatedSurfaces: 0,
    });
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
  });

  it("disposes in one terminal operation, unsubscribes twice, and ignores late settlements", async () => {
    const target = mount();
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    await dispatch(target, "sign-in.submit", "press", {}, snapshot);
    const retainedNotice = [...target.control.contextNotices][0];
    expect(disposeRuntimeHeadlessSession(target.handle)).toEqual({
      status: "disposed",
      activatedSurfaces: 1,
    });
    expect(disposeRuntimeHeadlessSession(target.handle)).toEqual({
      status: "already-disposed",
      activatedSurfaces: 0,
    });
    expect(target.control.contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(target.control.environmentUnsubscribe).toHaveBeenCalledTimes(1);
    target.control.operationAttempts[0]?.resolve({
      status: "succeeded",
      value: { userId: "late" },
    });
    await flush();
    retainedNotice?.();
    expect(
      dispatchRuntimeHeadlessSessionEvent(target.handle, {
        snapshot,
        runtimeInstanceId: runtimeInstance(snapshot, "sign-in.submit"),
        eventName: "press",
        payload: {},
      }),
    ).toEqual({ status: "disposed" });
    expect(readRuntimeHeadlessSession(target.handle)).toEqual({ status: "disposed" });
  });
});

async function deterministicTrace(): Promise<unknown> {
  const target = mount();
  const trace: RuntimeHeadlessSessionSnapshot[] = [target.initial];
  trace.push(await dispatch(target, "sign-in.email", "change", { value: "person@example.com" }));
  trace.push(
    await dispatch(target, "sign-in.password", "change", { value: "secret" }, trace.at(-1)),
  );
  trace.push(await dispatch(target, "sign-in.submit", "press", {}, trace.at(-1)));
  target.control.operationAttempts[0]?.resolve({
    status: "failed",
    errorCode: "invalidCredentials",
  });
  trace.push(await waitFor(target, (snapshot) => operationStatus(snapshot) === "failed"));
  disposeRuntimeHeadlessSession(target.handle);
  return JSON.parse(JSON.stringify(trace)) as unknown;
}

describe("M04-T16 deterministic portable trace", () => {
  it("produces byte-equivalent pure JSON on two independent runs", async () => {
    const first = await deterministicTrace();
    const second = await deterministicTrace();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expectPortableJson(first);
  });
});

describe("M05-T04 component command attachment authority", () => {
  it("retains one stable T14 binding while snapshots publish and detaches idempotently", async () => {
    const target = mount({ bundle: componentCommandBundle() });
    const passwordId = runtimeInstance(target.initial, "sign-in.password");
    const initialBinding = target.initial.bindings.find(
      (binding) => binding.runtimeInstanceId === passwordId,
    );
    const requests: unknown[] = [];
    const attached = attachRuntimeHeadlessSessionComponentCommands(target.handle, {
      snapshot: target.initial,
      runtimeInstanceId: passwordId,
      commands: {
        invoke(request) {
          expect(this).toBeUndefined();
          requests.push(request);
          expect(Object.isFrozen(request)).toBe(true);
          expect(Object.isFrozen(request.input)).toBe(true);
          return Object.freeze({ status: "succeeded" });
        },
      },
    });
    expect(attached.status).toBe("attached");
    if (attached.status !== "attached") throw new TypeError("Expected command attachment.");
    expect(Object.isFrozen(attached.attachment)).toBe(true);
    expect(Reflect.ownKeys(attached.attachment)).toEqual([]);
    expect(current(target)).toBe(target.initial);

    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    const retainedBinding = snapshot.bindings.find(
      (binding) => binding.runtimeInstanceId === passwordId,
    );
    expect(snapshot).not.toBe(target.initial);
    expect(snapshot.bindings).toBe(target.initial.bindings);
    expect(retainedBinding?.registrationGeneration).toBe(initialBinding?.registrationGeneration);

    const completion = await dispatchSubmit(target, snapshot);
    expect((await completion).status).toBe("completed");
    expect(requests).toEqual([{ command: "focus", input: {} }]);

    expect(detachRuntimeHeadlessSessionComponentCommands(attached.attachment)).toEqual({
      status: "detached",
    });
    expect(detachRuntimeHeadlessSessionComponentCommands(attached.attachment)).toEqual({
      status: "already-detached",
    });
    const detachedCompletion = await dispatchSubmit(target, current(target));
    expect((await detachedCompletion).status).toBe("terminated");
    expect(requests).toHaveLength(1);
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
  });

  it("rejects copied, foreign, stale, behavior, unknown, and malformed authorities", async () => {
    const left = mount({ bundle: componentCommandBundle() });
    const right = mount({ bundle: componentCommandBundle() });
    const passwordId = runtimeInstance(left.initial, "sign-in.password");
    const commands = Object.freeze({
      invoke: () => Object.freeze({ status: "succeeded" as const }),
    });
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, {
        snapshot: right.initial,
        runtimeInstanceId: passwordId,
        commands,
      }),
    ).toEqual({ status: "invalid-snapshot", snapshot: left.initial });
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, {
        snapshot: clone(left.initial),
        runtimeInstanceId: passwordId,
        commands,
      }),
    ).toEqual({ status: "invalid-snapshot", snapshot: left.initial });

    const currentSnapshot = await dispatch(left, "sign-in.password", "change", {
      value: "secret",
    });
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, {
        snapshot: left.initial,
        runtimeInstanceId: passwordId,
        commands,
      }),
    ).toEqual({ status: "invalid-snapshot", snapshot: currentSnapshot });
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, {
        snapshot: currentSnapshot,
        runtimeInstanceId: "missing",
        commands,
      }),
    ).toEqual({ status: "unknown-component" });

    const behaviorBundle = componentCommandBundle();
    const signIn = (behaviorBundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    root.behaviors = [
      {
        id: "sign-in.sort",
        use: "com.example.interactions/Sortable",
        props: { axis: "vertical", handle: "item" },
        on: {},
      },
    ];
    behaviorBundle.revision = calculateDesenBundleRevision(behaviorBundle);
    const behaviorTarget = mount({ bundle: behaviorBundle });
    const behavior = behaviorTarget.initial.bindings.find((binding) => binding.kind === "behavior");
    expect(behavior).toBeDefined();
    expect(
      attachRuntimeHeadlessSessionComponentCommands(behaviorTarget.handle, {
        snapshot: behaviorTarget.initial,
        runtimeInstanceId: behavior?.runtimeInstanceId ?? "missing",
        commands,
      }),
    ).toEqual({ status: "unknown-component" });

    const guarded = attachRuntimeHeadlessSessionComponentCommands(left.handle, {
      snapshot: currentSnapshot,
      runtimeInstanceId: passwordId,
      commands,
    });
    expect(guarded.status).toBe("attached");
    if (guarded.status !== "attached") throw new TypeError("Expected guarded attachment.");
    const reentrantDetachmentInput = new Proxy(
      {
        snapshot: currentSnapshot,
        runtimeInstanceId: passwordId,
        commands,
      },
      {
        getPrototypeOf(value) {
          expect(detachRuntimeHeadlessSessionComponentCommands(guarded.attachment)).toEqual({
            status: "detached",
          });
          return Reflect.getPrototypeOf(value);
        },
      },
    );
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, reentrantDetachmentInput),
    ).toEqual({ status: "malformed-request" });

    const malformedPort = Object.freeze({
      invoke: commands.invoke,
      extra: true,
    });
    expect(
      attachRuntimeHeadlessSessionComponentCommands(left.handle, {
        snapshot: currentSnapshot,
        runtimeInstanceId: passwordId,
        commands: malformedPort,
      }),
    ).toEqual({ status: "malformed-request" });
    const accessor = Object.defineProperty(
      {
        snapshot: currentSnapshot,
        runtimeInstanceId: passwordId,
      },
      "commands",
      {
        enumerable: true,
        get: () => commands,
      },
    );
    expect(
      attachRuntimeHeadlessSessionComponentCommands(
        left.handle,
        accessor as unknown as Parameters<typeof attachRuntimeHeadlessSessionComponentCommands>[1],
      ),
    ).toEqual({ status: "malformed-request" });
    expect(
      attachRuntimeHeadlessSessionComponentCommands({} as RuntimeHeadlessSessionHandle, {
        snapshot: currentSnapshot,
        runtimeInstanceId: passwordId,
        commands,
      }),
    ).toEqual({ status: "invalid-handle" });
    expect(
      detachRuntimeHeadlessSessionComponentCommands(
        {} as RuntimeHeadlessSessionComponentCommandsAttachment,
      ),
    ).toEqual({ status: "invalid-attachment" });

    const reentrant = mount({ bundle: componentCommandBundle() });
    const disposalInput = new Proxy(
      {
        snapshot: reentrant.initial,
        runtimeInstanceId: runtimeInstance(reentrant.initial, "sign-in.password"),
        commands,
      },
      {
        getPrototypeOf(value) {
          expect(disposeRuntimeHeadlessSession(reentrant.handle).status).toBe("disposed");
          return Reflect.getPrototypeOf(value);
        },
      },
    );
    expect(attachRuntimeHeadlessSessionComponentCommands(reentrant.handle, disposalInput)).toEqual({
      status: "disposed",
    });
    expect(disposeRuntimeHeadlessSession(left.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(right.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(behaviorTarget.handle).status).toBe("disposed");
  });

  it("supersedes atomically and makes reentrant ownership changes fail the active call closed", async () => {
    const target = mount({ bundle: componentCommandBundle() });
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    const passwordId = runtimeInstance(snapshot, "sign-in.password");
    const first = attachRuntimeHeadlessSessionComponentCommands(target.handle, {
      snapshot,
      runtimeInstanceId: passwordId,
      commands: { invoke: () => Object.freeze({ status: "succeeded" }) },
    });
    expect(first.status).toBe("attached");
    if (first.status !== "attached") throw new TypeError("Expected first attachment.");
    const replacementInvocations = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    const second = attachRuntimeHeadlessSessionComponentCommands(target.handle, {
      snapshot,
      runtimeInstanceId: passwordId,
      commands: { invoke: replacementInvocations },
    });
    expect(second.status).toBe("attached");
    if (second.status !== "attached") throw new TypeError("Expected replacement attachment.");
    expect(detachRuntimeHeadlessSessionComponentCommands(first.attachment)).toEqual({
      status: "already-detached",
    });
    expect((await dispatchSubmit(target, snapshot)).status).toBe("completed");
    expect(replacementInvocations).toHaveBeenCalledTimes(1);

    const reentrantTarget = mount({ bundle: componentCommandBundle() });
    let reentrantSnapshot = await dispatch(reentrantTarget, "sign-in.email", "change", {
      value: "person@example.com",
    });
    reentrantSnapshot = await dispatch(
      reentrantTarget,
      "sign-in.password",
      "change",
      { value: "secret" },
      reentrantSnapshot,
    );
    const reentrantPasswordId = runtimeInstance(reentrantSnapshot, "sign-in.password");
    const successorInvocations = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    let successor: ReturnType<typeof attachRuntimeHeadlessSessionComponentCommands> | undefined;
    const reentrantOwner = attachRuntimeHeadlessSessionComponentCommands(reentrantTarget.handle, {
      snapshot: reentrantSnapshot,
      runtimeInstanceId: reentrantPasswordId,
      commands: {
        invoke() {
          successor = attachRuntimeHeadlessSessionComponentCommands(reentrantTarget.handle, {
            snapshot: current(reentrantTarget),
            runtimeInstanceId: reentrantPasswordId,
            commands: { invoke: successorInvocations },
          });
          return Object.freeze({ status: "succeeded" });
        },
      },
    });
    expect(reentrantOwner.status).toBe("attached");
    if (reentrantOwner.status !== "attached") throw new TypeError("Expected reentrant owner.");
    expect((await dispatchSubmit(reentrantTarget, reentrantSnapshot)).status).toBe("terminated");
    expect(successor?.status).toBe("attached");
    expect(detachRuntimeHeadlessSessionComponentCommands(reentrantOwner.attachment)).toEqual({
      status: "already-detached",
    });
    expect((await dispatchSubmit(reentrantTarget, current(reentrantTarget))).status).toBe(
      "completed",
    );
    expect(successorInvocations).toHaveBeenCalledTimes(1);
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(reentrantTarget.handle).status).toBe("disposed");
  });

  it("contains throwing callbacks and rejects executable or malformed callback results", async () => {
    const target = mount({ bundle: componentCommandBundle() });
    let snapshot = await dispatch(target, "sign-in.email", "change", {
      value: "person@example.com",
    });
    snapshot = await dispatch(target, "sign-in.password", "change", { value: "secret" }, snapshot);
    const passwordId = runtimeInstance(snapshot, "sign-in.password");
    expect(
      attachRuntimeHeadlessSessionComponentCommands(target.handle, {
        snapshot,
        runtimeInstanceId: passwordId,
        commands: {
          invoke() {
            throw new Error("hostile adapter callback");
          },
        },
      }).status,
    ).toBe("attached");
    expect((await dispatchSubmit(target, snapshot)).status).toBe("terminated");
    expect(readRuntimeHeadlessSession(target.handle).status).toBe("read");

    const statusGetter = vi.fn(() => "succeeded");
    expect(
      attachRuntimeHeadlessSessionComponentCommands(target.handle, {
        snapshot: current(target),
        runtimeInstanceId: passwordId,
        commands: {
          invoke() {
            return Object.defineProperty({}, "status", {
              enumerable: true,
              get: statusGetter,
            }) as unknown as { readonly status: "succeeded" };
          },
        },
      }).status,
    ).toBe("attached");
    expect((await dispatchSubmit(target, current(target))).status).toBe("terminated");
    expect(statusGetter).not.toHaveBeenCalled();
    expect(readRuntimeHeadlessSession(target.handle).status).toBe("read");

    const resultOwnerState: {
      attachment?: RuntimeHeadlessSessionComponentCommandsAttachment;
    } = {};
    let resultTrapCalls = 0;
    const reentrantResultOwner = attachRuntimeHeadlessSessionComponentCommands(target.handle, {
      snapshot: current(target),
      runtimeInstanceId: passwordId,
      commands: {
        invoke() {
          return new Proxy(
            { status: "succeeded" as const },
            {
              getPrototypeOf(subject) {
                resultTrapCalls += 1;
                if (resultOwnerState.attachment !== undefined) {
                  detachRuntimeHeadlessSessionComponentCommands(resultOwnerState.attachment);
                }
                return Reflect.getPrototypeOf(subject);
              },
            },
          );
        },
      },
    });
    expect(reentrantResultOwner.status).toBe("attached");
    if (reentrantResultOwner.status !== "attached") {
      throw new TypeError("Expected hostile-result attachment.");
    }
    resultOwnerState.attachment = reentrantResultOwner.attachment;
    expect((await dispatchSubmit(target, current(target))).status).toBe("terminated");
    expect(resultTrapCalls).toBeGreaterThan(0);
    expect(detachRuntimeHeadlessSessionComponentCommands(reentrantResultOwner.attachment)).toEqual({
      status: "already-detached",
    });
    expect(disposeRuntimeHeadlessSession(target.handle).status).toBe("disposed");
  });

  it("revokes attachments on binding replacement, navigation, and terminal disposal", async () => {
    const replacementBundle = componentCommandBundle();
    const signIn = (replacementBundle.surfaces as MutableRecord)["sign-in"] as MutableRecord;
    const root = signIn.root as MutableRecord;
    const children = (root.slots as MutableRecord).default as MutableRecord[];
    const password = children[2] as MutableRecord;
    password.when = {
      op: "truthy",
      args: [{ $ref: "context.showPassword" }],
    };
    replacementBundle.revision = calculateDesenBundleRevision(replacementBundle);
    const replacementControl = control();
    replacementControl.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      showPassword: true,
    });
    const replacementTarget = mount({
      bundle: replacementBundle,
      target: replacementControl,
    });
    const originalId = runtimeInstance(replacementTarget.initial, "sign-in.password");
    const originalBinding = replacementTarget.initial.bindings.find(
      (binding) => binding.runtimeInstanceId === originalId,
    );
    const original = attachRuntimeHeadlessSessionComponentCommands(replacementTarget.handle, {
      snapshot: replacementTarget.initial,
      runtimeInstanceId: originalId,
      commands: { invoke: () => Object.freeze({ status: "succeeded" }) },
    });
    expect(original.status).toBe("attached");
    if (original.status !== "attached") throw new TypeError("Expected original attachment.");
    replacementControl.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      showPassword: false,
    });
    notify(replacementControl.contextNotices);
    expect(
      current(replacementTarget).bindings.some(
        (binding) => binding.sourceNodeId === "sign-in.password",
      ),
    ).toBe(false);
    expect(detachRuntimeHeadlessSessionComponentCommands(original.attachment)).toEqual({
      status: "already-detached",
    });
    replacementControl.context = Object.freeze({
      title: "Sign in",
      tenant: "alpha",
      showPassword: true,
    });
    notify(replacementControl.contextNotices);
    const restoredSnapshot = current(replacementTarget);
    const restoredBinding = restoredSnapshot.bindings.find(
      (binding) => binding.sourceNodeId === "sign-in.password",
    );
    expect(restoredBinding?.registrationGeneration).toBeGreaterThan(
      originalBinding?.registrationGeneration ?? -1,
    );
    const restored = attachRuntimeHeadlessSessionComponentCommands(replacementTarget.handle, {
      snapshot: restoredSnapshot,
      runtimeInstanceId: restoredBinding?.runtimeInstanceId ?? "missing",
      commands: { invoke: () => Object.freeze({ status: "succeeded" }) },
    });
    expect(restored.status).toBe("attached");
    if (restored.status !== "attached") throw new TypeError("Expected restored attachment.");
    expect(detachRuntimeHeadlessSessionComponentCommands(original.attachment)).toEqual({
      status: "already-detached",
    });
    expect(detachRuntimeHeadlessSessionComponentCommands(restored.attachment)).toEqual({
      status: "detached",
    });

    const navigationTarget = mount({ bundle: componentCommandBundle() });
    let navigationSnapshot = await dispatch(navigationTarget, "sign-in.email", "change", {
      value: "person@example.com",
    });
    navigationSnapshot = await dispatch(
      navigationTarget,
      "sign-in.password",
      "change",
      { value: "secret" },
      navigationSnapshot,
    );
    const navigationAttachment = attachRuntimeHeadlessSessionComponentCommands(
      navigationTarget.handle,
      {
        snapshot: navigationSnapshot,
        runtimeInstanceId: runtimeInstance(navigationSnapshot, "sign-in.password"),
        commands: { invoke: () => Object.freeze({ status: "succeeded" }) },
      },
    );
    expect(navigationAttachment.status).toBe("attached");
    if (navigationAttachment.status !== "attached") {
      throw new TypeError("Expected navigation attachment.");
    }
    expect((await dispatchSubmit(navigationTarget, navigationSnapshot)).status).toBe("completed");
    navigationTarget.control.operationAttempts[0]?.resolve({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    await flush();
    expect(current(navigationTarget).surfaceId).toBe("home");
    expect(detachRuntimeHeadlessSessionComponentCommands(navigationAttachment.attachment)).toEqual({
      status: "already-detached",
    });

    const disposedTarget = mount({ bundle: componentCommandBundle() });
    const disposedAttachment = attachRuntimeHeadlessSessionComponentCommands(
      disposedTarget.handle,
      {
        snapshot: disposedTarget.initial,
        runtimeInstanceId: runtimeInstance(disposedTarget.initial, "sign-in.password"),
        commands: { invoke: () => Object.freeze({ status: "succeeded" }) },
      },
    );
    expect(disposedAttachment.status).toBe("attached");
    if (disposedAttachment.status !== "attached") {
      throw new TypeError("Expected disposal attachment.");
    }
    expect(disposeRuntimeHeadlessSession(disposedTarget.handle).status).toBe("disposed");
    expect(detachRuntimeHeadlessSessionComponentCommands(disposedAttachment.attachment)).toEqual({
      status: "already-detached",
    });
    expect(disposeRuntimeHeadlessSession(replacementTarget.handle).status).toBe("disposed");
    expect(disposeRuntimeHeadlessSession(navigationTarget.handle).status).toBe("disposed");
  });
});
