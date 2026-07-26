import { calculateDesenBundleRevision } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import frozenSignInBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
} from "../src/headless-session.js";

import type {
  RuntimeHostCallResult,
  RuntimeHostPorts,
  RuntimeJsonObject,
} from "../src/host-ports.js";
import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionLimitProfile,
  RuntimeHeadlessSessionSnapshot,
} from "../src/headless-session.js";

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
  readonly navigationTargets: string[];
  readonly navigationContexts: RuntimeJsonObject[];
  navigationHook: (() => void) | undefined;
  readonly contextUnsubscribe: () => void;
  readonly environmentUnsubscribe: () => void;
}

interface MountedFixture {
  readonly control: HostControl;
  readonly handle: RuntimeHeadlessSessionHandle;
  readonly initial: RuntimeHeadlessSessionSnapshot;
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
    resources: { load: () => ({ status: "denied" }) },
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
    readonly target?: HostControl;
    readonly limits?: RuntimeHeadlessSessionLimitProfile;
  } = {},
): MountedFixture {
  const target = options.target ?? control();
  const result = mountRuntimeHeadlessSession({
    bundle: options.bundle ?? clone(frozenSignInBundle),
    catalogs: [clone(frozenWebCatalog)],
    hostPorts: hostPorts(target),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(result.status).toBe("mounted");
  if (result.status !== "mounted") throw new TypeError(`Expected mount: ${result.reason}`);
  return { control: target, handle: result.handle, initial: result.snapshot };
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

describe("M04-T16 exact ingress and initial headless materialization", () => {
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
  });

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
