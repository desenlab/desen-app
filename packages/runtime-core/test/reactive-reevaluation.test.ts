import { validateDesenExecutionCatalogSet } from "@desen/validator";
import { describe, expect, it, vi } from "vitest";

import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import type { RuntimeHostPorts, RuntimeJsonObject } from "../src/host-ports.js";
import {
  disposeRuntimeSurfaceState,
  mountRuntimeSurfaceState,
  writeRuntimeSurfaceState,
} from "../src/local-state.js";
import { mountRuntimeSurfaceOperations } from "../src/operation-lifecycle.js";
import { createRuntimeReactiveHostPorts } from "../src/reactive-host-ports.js";
import {
  disposeRuntimeReactiveReevaluation,
  invalidateRuntimeReactiveReevaluation,
  mountRuntimeReactiveReevaluation,
  readRuntimeReactiveReevaluation,
} from "../src/reactive-reevaluation.js";
import { mountRuntimeSurfaceResources } from "../src/resource-lifecycle.js";

import type { DesenValidatedExecutionCatalogSet } from "@desen/validator";
import type { RuntimeSurfaceStateHandle, RuntimeSurfaceStateSnapshot } from "../src/local-state.js";
import type {
  RuntimeReactiveEvaluator,
  RuntimeReactiveReevaluationHandle,
  RuntimeReactiveReevaluationLimitProfile,
  RuntimeReactiveReevaluationSnapshot,
} from "../src/reactive-reevaluation.js";
import type { RuntimeReactiveHostPorts } from "../src/reactive-host-ports.js";
import type {
  RuntimeSurfaceOperationsHandle,
  RuntimeSurfaceOperationsSnapshot,
} from "../src/operation-lifecycle.js";
import type {
  RuntimeSurfaceResourcesHandle,
  RuntimeSurfaceResourcesSnapshot,
} from "../src/resource-lifecycle.js";

const DOCUMENT_ID = "com.desen.reactive-test";
const REVISION = `sha256:${"b".repeat(64)}`;
const SURFACE_ID = "sign-in";

interface HostControl {
  context: RuntimeJsonObject;
  environment: RuntimeJsonObject;
  readonly contextNotices: Set<() => void>;
  readonly environmentNotices: Set<() => void>;
  readonly contextUnsubscribe: () => void;
  readonly environmentUnsubscribe: () => void;
  readonly getContext?: () => RuntimeJsonObject;
  readonly getEnvironment?: () => RuntimeJsonObject;
}

interface FixtureOptions {
  readonly evaluator?: RuntimeReactiveEvaluator;
  readonly limits?: RuntimeReactiveReevaluationLimitProfile;
  readonly control?: HostControl;
}

interface Fixture {
  readonly control: HostControl;
  readonly handle: RuntimeReactiveReevaluationHandle;
  readonly initial: RuntimeReactiveReevaluationSnapshot;
  readonly hostPorts: RuntimeReactiveHostPorts;
  readonly stateHandle: RuntimeSurfaceStateHandle;
  readonly stateSnapshot: RuntimeSurfaceStateSnapshot;
  readonly resourceHandle: RuntimeSurfaceResourcesHandle;
  readonly resourceSnapshot: RuntimeSurfaceResourcesSnapshot;
  readonly operationHandle: RuntimeSurfaceOperationsHandle;
  readonly operationSnapshot: RuntimeSurfaceOperationsSnapshot;
}

let cachedCatalog: DesenValidatedExecutionCatalogSet | undefined;

function catalogSet(): DesenValidatedExecutionCatalogSet {
  if (cachedCatalog !== undefined) return cachedCatalog;
  const result = validateDesenExecutionCatalogSet([
    JSON.parse(JSON.stringify(frozenWebCatalog)) as unknown,
  ]);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected the frozen web Catalog to validate.");
  cachedCatalog = result.value;
  return cachedCatalog;
}

function hostControl(
  overrides: Partial<
    Pick<HostControl, "context" | "environment" | "getContext" | "getEnvironment">
  > = {},
): HostControl {
  return {
    context: overrides.context ?? Object.freeze({ tenant: "alpha" }),
    environment: overrides.environment ?? Object.freeze({ platform: "web", locale: "en" }),
    contextNotices: new Set(),
    environmentNotices: new Set(),
    contextUnsubscribe: vi.fn(),
    environmentUnsubscribe: vi.fn(),
    ...(overrides.getContext === undefined ? {} : { getContext: overrides.getContext }),
    ...(overrides.getEnvironment === undefined ? {} : { getEnvironment: overrides.getEnvironment }),
  };
}

function hostPorts(control: HostControl): RuntimeHostPorts {
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
      invoke: () => ({ status: "succeeded", value: { userId: "user-1" } }),
    },
    resources: { load: () => ({ status: "denied" }) },
    tokens: {
      resolve: (request) =>
        request.token === "color.primary"
          ? { status: "resolved", value: "#315efb" }
          : { status: "missing" },
    },
    context: {
      getSnapshot: () => control.getContext?.() ?? control.context,
      subscribe: (notice) => {
        control.contextNotices.add(notice);
        return () => {
          control.contextUnsubscribe();
          control.contextNotices.delete(notice);
        };
      },
    },
    environment: {
      getSnapshot: () => control.getEnvironment?.() ?? control.environment,
      subscribe: (notice) => {
        control.environmentNotices.add(notice);
        return () => {
          control.environmentUnsubscribe();
          control.environmentNotices.delete(notice);
        };
      },
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  };
}

function notify(notices: Set<() => void>): void {
  for (const notice of [...notices]) notice();
}

function defaultEvaluator(request: Parameters<RuntimeReactiveEvaluator>[0]) {
  return {
    state: request.resolutionSnapshot.state,
    context: request.resolutionSnapshot.context,
    environment: request.resolutionSnapshot.env,
  };
}

function fixture(options: FixtureOptions = {}): Fixture {
  const control = options.control ?? hostControl();
  const reactivePorts = createRuntimeReactiveHostPorts(hostPorts(control));
  const state = mountRuntimeSurfaceState({
    surfaceId: SURFACE_ID,
    state: {
      count: { schema: { type: "number" }, initial: 0 },
      label: { schema: { type: "string" }, initial: "initial" },
    },
  });
  expect(state.status).toBe("mounted");
  if (state.status !== "mounted") throw new TypeError("Expected state to mount.");
  const resources = mountRuntimeSurfaceResources({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    resources: {},
    catalogSet: catalogSet(),
    hostPorts: reactivePorts,
  });
  expect(resources.status).toBe("mounted");
  if (resources.status !== "mounted") throw new TypeError("Expected resources to mount.");
  const operations = mountRuntimeSurfaceOperations({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    aliases: {},
    catalogSet: catalogSet(),
    hostPorts: reactivePorts,
  });
  expect(operations.status).toBe("mounted");
  if (operations.status !== "mounted") throw new TypeError("Expected operations to mount.");

  const mounted = mountRuntimeReactiveReevaluation({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    resourceHandle: resources.handle,
    resourceSnapshot: resources.snapshot,
    operationHandle: operations.handle,
    operationSnapshot: operations.snapshot,
    hostPorts: reactivePorts,
    evaluator: options.evaluator ?? defaultEvaluator,
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  expect(mounted.status).toBe("mounted");
  if (mounted.status !== "mounted") throw new TypeError("Expected reactive evaluation to mount.");
  return {
    control,
    handle: mounted.handle,
    initial: mounted.snapshot,
    hostPorts: reactivePorts,
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    resourceHandle: resources.handle,
    resourceSnapshot: resources.snapshot,
    operationHandle: operations.handle,
    operationSnapshot: operations.snapshot,
  };
}

function current(handle: RuntimeReactiveReevaluationHandle) {
  const result = readRuntimeReactiveReevaluation(handle);
  expect(result.status).toBe("read");
  if (result.status !== "read") throw new TypeError("Expected a live reactive snapshot.");
  return result.snapshot;
}

function updateState(
  fixtureValue: Fixture,
  path: string,
  value: string | number,
): RuntimeSurfaceStateSnapshot {
  const result = writeRuntimeSurfaceState(fixtureValue.stateHandle, { path, value });
  expect(result.status).toBe("updated");
  if (result.status !== "updated") throw new TypeError("Expected the state update.");
  return result.snapshot;
}

function invalidate(fixtureValue: Fixture, snapshot = current(fixtureValue.handle)) {
  return invalidateRuntimeReactiveReevaluation(fixtureValue.handle, {
    snapshot,
    reason: "action-turn",
  });
}

describe("runtime reactive reevaluation", () => {
  it("mounts one atomic whole-surface result with least-authority evaluator inputs", () => {
    const evaluator = vi.fn((request: Parameters<RuntimeReactiveEvaluator>[0]) => {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.resolutionSnapshot)).toBe(true);
      expect(request.resolutionSnapshot.event).toEqual({ status: "unavailable" });
      expect(request.resolutionSnapshot.item).toEqual({});
      expect(request.materializationContext.requestContext).toMatchObject({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        requestId: request.evaluationId,
      });
      expect(
        request.materializationContext.tokens.resolve({
          context: request.materializationContext.requestContext,
          token: "color.primary",
        }),
      ).toEqual({ status: "resolved", value: "#315efb" });
      expect(Object.keys(request.materializationContext)).toEqual(["requestContext", "tokens"]);
      return defaultEvaluator(request);
    });
    const mounted = fixture({ evaluator });

    expect(mounted.initial).toMatchObject({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      generation: 0,
      outcome: {
        status: "active",
        value: {
          state: { count: 0, label: "initial" },
          context: { tenant: "alpha" },
          environment: { locale: "en", platform: "web" },
        },
      },
    });
    expect(mounted.initial.evaluationId).toContain("reactive-evaluation:");
    expect(Object.isFrozen(mounted.initial)).toBe(true);
    expect(evaluator).toHaveBeenCalledTimes(1);
    expect(mounted.control.contextNotices.size).toBe(1);
    expect(mounted.control.environmentNotices.size).toBe(1);
  });

  it("batches multiple state writes behind one explicit action-turn invalidation", () => {
    const evaluator = vi.fn(defaultEvaluator);
    const mounted = fixture({ evaluator });
    updateState(mounted, "count", 1);
    updateState(mounted, "label", "complete");

    const result = invalidate(mounted, mounted.initial);

    expect(result.status).toBe("reevaluated");
    if (result.status !== "reevaluated") throw new TypeError("Expected reevaluation.");
    expect(result.snapshot.generation).toBe(1);
    expect(result.snapshot.outcome).toMatchObject({
      status: "active",
      value: { state: { count: 1, label: "complete" } },
    });
    expect(evaluator).toHaveBeenCalledTimes(2);
  });

  it("rereads complete context and environment snapshots from invalidation notices", () => {
    const mounted = fixture();
    mounted.control.context = Object.freeze({ tenant: "beta", feature: true });
    notify(mounted.control.contextNotices);
    const contextSnapshot = current(mounted.handle);
    expect(contextSnapshot.generation).toBe(1);
    expect(contextSnapshot.outcome).toMatchObject({
      status: "active",
      value: { context: { feature: true, tenant: "beta" } },
    });

    mounted.control.environment = Object.freeze({ platform: "web", locale: "tr" });
    notify(mounted.control.environmentNotices);
    const environmentSnapshot = current(mounted.handle);
    expect(environmentSnapshot.generation).toBe(2);
    expect(environmentSnapshot.outcome).toMatchObject({
      status: "active",
      value: { environment: { locale: "tr", platform: "web" } },
    });
  });

  it("retains the exact snapshot and generation when reevaluation output bytes are unchanged", () => {
    const evaluator = vi.fn(() => ({ constant: true }));
    const mounted = fixture({ evaluator });
    mounted.control.context = Object.freeze({ tenant: "changed-but-unobserved" });
    notify(mounted.control.contextNotices);

    expect(current(mounted.handle)).toBe(mounted.initial);
    expect(current(mounted.handle).generation).toBe(0);
    expect(evaluator).toHaveBeenCalledTimes(2);
  });

  it("discards an evaluator result without reflection when reentry makes it stale", () => {
    const mountedReference: { current?: Fixture } = {};
    let reentered = false;
    let reflections = 0;
    let evaluatorCalls = 0;
    const stale = new Proxy(
      { stale: true },
      {
        getPrototypeOf: (target) => {
          reflections += 1;
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    const evaluator: RuntimeReactiveEvaluator = (request) => {
      evaluatorCalls += 1;
      if (request.resolutionSnapshot.state.count === 1 && !reentered) {
        reentered = true;
        const mounted = mountedReference.current;
        if (mounted === undefined) throw new TypeError("Expected the mounted fixture.");
        updateState(mounted, "count", 2);
        expect(invalidate(mounted).status).toBe("queued");
        return stale;
      }
      return { count: request.resolutionSnapshot.state.count ?? null };
    };
    const mounted = fixture({ evaluator });
    mountedReference.current = mounted;
    updateState(mounted, "count", 1);

    const result = invalidate(mounted, mounted.initial);

    expect(result.status).toBe("reevaluated");
    expect(current(mounted.handle).outcome).toEqual({
      status: "active",
      value: { count: 2 },
    });
    expect(reflections).toBe(0);
    expect(evaluatorCalls).toBe(3);
  });

  it("discards a candidate when Proxy reflection itself triggers a newer host generation", () => {
    const mountedReference: { current?: Fixture } = {};
    let armed = false;
    let reflected = false;
    const evaluator = vi.fn((request: Parameters<RuntimeReactiveEvaluator>[0]) => {
      const tenant = request.resolutionSnapshot.context.tenant ?? null;
      if (armed && tenant === "alpha" && !reflected) {
        const target = { tenant };
        return new Proxy(target, {
          getPrototypeOf: (owner) => {
            reflected = true;
            const mounted = mountedReference.current;
            if (mounted === undefined) throw new TypeError("Expected the mounted fixture.");
            mounted.control.context = Object.freeze({ tenant: "beta" });
            notify(mounted.control.contextNotices);
            return Reflect.getPrototypeOf(owner);
          },
        });
      }
      return { tenant };
    });
    const mounted = fixture({ evaluator });
    mountedReference.current = mounted;
    armed = true;
    updateState(mounted, "count", 1);

    const result = invalidate(mounted, mounted.initial);

    expect(result.status).toBe("reevaluated");
    expect(reflected).toBe(true);
    expect(current(mounted.handle).outcome).toEqual({
      status: "active",
      value: { tenant: "beta" },
    });
    expect(evaluator).toHaveBeenCalledTimes(3);
  });

  it("rechecks invalidation state after host authentication before reflecting the candidate", () => {
    let armed = false;
    let readsAfterArming = 0;
    let reflections = 0;
    let context: RuntimeJsonObject = Object.freeze({ tenant: "alpha" });
    const controlled = hostControl({
      context,
      getContext: () => {
        if (armed) {
          readsAfterArming += 1;
          if (readsAfterArming === 3) {
            context = Object.freeze({ tenant: "beta" });
            notify(controlled.contextNotices);
          }
        }
        return context;
      },
    });
    const stale = new Proxy(
      { tenant: "alpha" },
      {
        getPrototypeOf: (target) => {
          reflections += 1;
          return Reflect.getPrototypeOf(target);
        },
      },
    );
    const evaluator: RuntimeReactiveEvaluator = (request) =>
      armed && request.resolutionSnapshot.context.tenant === "alpha"
        ? stale
        : { tenant: request.resolutionSnapshot.context.tenant ?? null };
    const mounted = fixture({ control: controlled, evaluator });
    armed = true;
    updateState(mounted, "count", 1);

    const result = invalidate(mounted, mounted.initial);

    expect(result.status).toBe("reevaluated");
    expect(reflections).toBe(0);
    expect(current(mounted.handle).outcome).toEqual({
      status: "active",
      value: { tenant: "beta" },
    });
  });

  it("deactivates the current output on a current evaluator throw", () => {
    let fail = false;
    const mounted = fixture({
      evaluator: () => {
        if (fail) throw new Error("private evaluator failure");
        return { visible: true };
      },
    });
    fail = true;
    mounted.control.context = Object.freeze({ tenant: "beta" });
    notify(mounted.control.contextNotices);

    expect(current(mounted.handle).outcome).toEqual({
      status: "inactive",
      reason: "evaluator-failed",
    });
    expect(current(mounted.handle).generation).toBe(1);
  });

  it("rejects asynchronous evaluator results and removes the prior active output", () => {
    let asynchronous = false;
    const evaluator = ((request: Parameters<RuntimeReactiveEvaluator>[0]) =>
      asynchronous
        ? Promise.resolve({ count: request.resolutionSnapshot.state.count })
        : { count: request.resolutionSnapshot.state.count }) as unknown as RuntimeReactiveEvaluator;
    const mounted = fixture({ evaluator });
    asynchronous = true;
    updateState(mounted, "count", 1);
    invalidate(mounted, mounted.initial);

    expect(current(mounted.handle).outcome).toEqual({
      status: "inactive",
      reason: "invalid-result",
    });
  });

  it("publishes an inactive result when complete host snapshots cannot be sampled consistently", () => {
    let generation = 0;
    const control = hostControl({
      getContext: () => Object.freeze({ generation: generation++ }),
    });
    const evaluator = vi.fn(defaultEvaluator);
    const mounted = fixture({ control, evaluator });

    expect(mounted.initial.outcome).toEqual({
      status: "inactive",
      reason: "inconsistent-snapshot",
    });
    expect(evaluator).not.toHaveBeenCalled();
  });

  it("requires factory-authenticated stale-safe host ports", () => {
    const control = hostControl();
    const plainPorts = hostPorts(control);
    const reactivePorts = createRuntimeReactiveHostPorts(plainPorts);
    const state = mountRuntimeSurfaceState({
      surfaceId: SURFACE_ID,
      state: {},
    });
    if (state.status !== "mounted") throw new TypeError("Expected state.");
    const resources = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: {},
      catalogSet: catalogSet(),
      hostPorts: reactivePorts,
    });
    const operations = mountRuntimeSurfaceOperations({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: {},
      catalogSet: catalogSet(),
      hostPorts: reactivePorts,
    });
    if (resources.status !== "mounted" || operations.status !== "mounted") {
      throw new TypeError("Expected lower managers.");
    }

    expect(
      mountRuntimeReactiveReevaluation({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        stateHandle: state.handle,
        stateSnapshot: state.snapshot,
        resourceHandle: resources.handle,
        resourceSnapshot: resources.snapshot,
        operationHandle: operations.handle,
        operationSnapshot: operations.snapshot,
        hostPorts: plainPorts as never,
        evaluator: defaultEvaluator,
      }),
    ).toEqual({ status: "invalid", reason: "malformed-input" });
  });

  it.each([
    ["negative", { maxSnapshotGeneration: -1 }],
    ["fractional", { maxEvaluationGeneration: 0.5 }],
    ["above default", { maxSynchronousTransitions: 65 }],
    ["unsafe integer", { maxEvaluationGeneration: Number.MAX_SAFE_INTEGER + 1 }],
    ["extra key", { maxSnapshotGeneration: 10, scheduler: "host" }],
    ["array", []],
  ])("rejects a malformed lower-only limit profile: %s", (_label, limits) => {
    const mounted = fixture();
    expect(
      mountRuntimeReactiveReevaluation({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        stateHandle: mounted.stateHandle,
        stateSnapshot: mounted.stateSnapshot,
        resourceHandle: mounted.resourceHandle,
        resourceSnapshot: mounted.resourceSnapshot,
        operationHandle: mounted.operationHandle,
        operationSnapshot: mounted.operationSnapshot,
        hostPorts: mounted.hostPorts,
        evaluator: defaultEvaluator,
        limits: limits as never,
      }),
    ).toEqual({ status: "invalid", reason: "malformed-input" });
  });

  it("rejects accessor-backed limit fields without invoking them", () => {
    const mounted = fixture();
    const getLimit = vi.fn(() => 1);
    const limits = Object.defineProperty({}, "maxSnapshotGeneration", {
      enumerable: true,
      get: getLimit,
    });

    expect(
      mountRuntimeReactiveReevaluation({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        stateHandle: mounted.stateHandle,
        stateSnapshot: mounted.stateSnapshot,
        resourceHandle: mounted.resourceHandle,
        resourceSnapshot: mounted.resourceSnapshot,
        operationHandle: mounted.operationHandle,
        operationSnapshot: mounted.operationSnapshot,
        hostPorts: mounted.hostPorts,
        evaluator: defaultEvaluator,
        limits: limits as never,
      }),
    ).toEqual({ status: "invalid", reason: "malformed-input" });
    expect(getLimit).not.toHaveBeenCalled();
  });

  it("rejects stale and structurally copied observable snapshots", () => {
    const mounted = fixture();
    updateState(mounted, "count", 1);
    const first = invalidate(mounted, mounted.initial);
    expect(first.status).toBe("reevaluated");
    const copied = Object.freeze({ ...current(mounted.handle) });

    expect(invalidate(mounted, mounted.initial)).toEqual({
      status: "rejected",
      reason: "invalid-snapshot",
    });
    expect(invalidate(mounted, copied)).toEqual({
      status: "rejected",
      reason: "invalid-snapshot",
    });
  });

  it("rejects malformed invalidation reasons without coercing hostile values", () => {
    const mounted = fixture();
    const toString = vi.fn(() => {
      throw new Error("must not coerce");
    });
    const result = invalidateRuntimeReactiveReevaluation(mounted.handle, {
      snapshot: mounted.initial,
      reason: { toString } as never,
    });

    expect(result).toEqual({ status: "rejected", reason: "invalid-request" });
    expect(toString).not.toHaveBeenCalled();
  });

  it("rechecks exact snapshot authority after hostile invalidation reflection", () => {
    const mounted = fixture();
    let reentered = false;
    const input = new Proxy(
      { snapshot: mounted.initial, reason: "state" as const },
      {
        getOwnPropertyDescriptor: (target, key) => {
          if (!reentered && key === "reason") {
            reentered = true;
            mounted.control.context = Object.freeze({ tenant: "newer" });
            notify(mounted.control.contextNotices);
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      },
    );

    expect(invalidateRuntimeReactiveReevaluation(mounted.handle, input)).toEqual({
      status: "rejected",
      reason: "invalid-snapshot",
    });
    expect(reentered).toBe(true);
    expect(current(mounted.handle).generation).toBe(1);
  });

  it("contains reentrant disposal while validating an invalidation request", () => {
    const mounted = fixture();
    let disposed = false;
    const input = new Proxy(
      { snapshot: mounted.initial, reason: "state" as const },
      {
        getPrototypeOf: (target) => {
          if (!disposed) {
            disposed = true;
            disposeRuntimeReactiveReevaluation(mounted.handle);
          }
          return Reflect.getPrototypeOf(target);
        },
      },
    );

    expect(invalidateRuntimeReactiveReevaluation(mounted.handle, input)).toEqual({
      status: "rejected",
      reason: "disposed",
    });
    expect(readRuntimeReactiveReevaluation(mounted.handle)).toEqual({ status: "disposed" });
  });

  it("fails closed at the synchronous transition limit without recursion or timer authority", () => {
    const control = hostControl();
    const evaluator = vi.fn((request: Parameters<RuntimeReactiveEvaluator>[0]) => {
      notify(control.contextNotices);
      return { count: request.resolutionSnapshot.state.count ?? null };
    });
    const mounted = fixture({
      control,
      evaluator,
      limits: { maxSynchronousTransitions: 2 },
    });

    expect(mounted.initial.outcome).toEqual({
      status: "inactive",
      reason: "transition-limit",
    });
    expect(evaluator).toHaveBeenCalledTimes(2);
  });

  it("does not wrap evaluator or snapshot generations at lowered inclusive ceilings", () => {
    const evaluationLimited = fixture({
      limits: { maxEvaluationGeneration: 0 },
    });
    evaluationLimited.control.context = Object.freeze({ tenant: "beta" });
    notify(evaluationLimited.control.contextNotices);
    expect(current(evaluationLimited.handle).outcome).toEqual({
      status: "inactive",
      reason: "evaluation-limit",
    });
    expect(
      invalidateRuntimeReactiveReevaluation(evaluationLimited.handle, {
        snapshot: current(evaluationLimited.handle),
        reason: "state",
      }),
    ).toEqual({ status: "rejected", reason: "terminal" });

    const snapshotLimited = fixture({
      limits: { maxSnapshotGeneration: 1 },
    });
    expect(snapshotLimited.initial).toMatchObject({
      generation: 0,
      outcome: { status: "active" },
    });
    snapshotLimited.control.context = Object.freeze({ tenant: "beta" });
    notify(snapshotLimited.control.contextNotices);
    expect(current(snapshotLimited.handle)).toMatchObject({
      generation: 1,
      outcome: { status: "inactive", reason: "snapshot-limit" },
    });

    const noPublicationCapacity = fixture({
      limits: { maxSnapshotGeneration: 0 },
    });
    expect(noPublicationCapacity.initial).toMatchObject({
      generation: 0,
      outcome: { status: "inactive", reason: "snapshot-limit" },
    });
  });

  it("deactivates terminally when a lower authority disappears", () => {
    const mounted = fixture();
    expect(disposeRuntimeSurfaceState(mounted.stateHandle).status).toBe("disposed");

    const result = invalidate(mounted, mounted.initial);

    expect(result.status).toBe("reevaluated");
    expect(current(mounted.handle).outcome).toEqual({
      status: "inactive",
      reason: "invalid-authority",
    });
    expect(invalidate(mounted)).toEqual({ status: "rejected", reason: "terminal" });
  });

  it("rejects revoked Proxy mount and invalidation inputs without throwing", () => {
    const revokedMount = Proxy.revocable({}, {});
    revokedMount.revoke();
    expect(
      mountRuntimeReactiveReevaluation(
        revokedMount.proxy as unknown as Parameters<typeof mountRuntimeReactiveReevaluation>[0],
      ),
    ).toEqual({ status: "invalid", reason: "malformed-input" });

    const mounted = fixture();
    const revokedInvalidation = Proxy.revocable(
      {
        snapshot: mounted.initial,
        reason: "state",
      },
      {},
    );
    revokedInvalidation.revoke();
    expect(
      invalidateRuntimeReactiveReevaluation(
        mounted.handle,
        revokedInvalidation.proxy as unknown as Parameters<
          typeof invalidateRuntimeReactiveReevaluation
        >[1],
      ),
    ).toEqual({ status: "rejected", reason: "invalid-request" });
  });

  it("revokes before exact-once unsubscribe and makes late callbacks inert", () => {
    const mounted = fixture();
    const contextNotice = [...mounted.control.contextNotices].at(0);
    const environmentNotice = [...mounted.control.environmentNotices].at(0);
    if (contextNotice === undefined || environmentNotice === undefined) {
      throw new TypeError("Expected captured notices.");
    }
    const before = mounted.initial;

    expect(disposeRuntimeReactiveReevaluation(mounted.handle)).toEqual({
      status: "disposed",
      unsubscribed: 2,
    });
    contextNotice();
    environmentNotice();
    expect(mounted.control.contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mounted.control.environmentUnsubscribe).toHaveBeenCalledTimes(1);
    expect(readRuntimeReactiveReevaluation(mounted.handle)).toEqual({ status: "disposed" });
    expect(
      invalidateRuntimeReactiveReevaluation(mounted.handle, {
        snapshot: before,
        reason: "state",
      }),
    ).toEqual({ status: "rejected", reason: "disposed" });
    expect(disposeRuntimeReactiveReevaluation(mounted.handle)).toEqual({
      status: "already-disposed",
      unsubscribed: 0,
    });
  });

  it("cleans an established subscription when the second host subscription fails", () => {
    const control = hostControl();
    const plain = hostPorts(control);
    const evaluator = vi.fn(defaultEvaluator);
    let retainedEnvironmentNotice: (() => void) | undefined;
    const reactivePorts = createRuntimeReactiveHostPorts({
      ...plain,
      environment: {
        getSnapshot: plain.environment.getSnapshot,
        subscribe: (notice) => {
          retainedEnvironmentNotice = notice;
          throw new Error("subscription unavailable");
        },
      },
    });
    const state = mountRuntimeSurfaceState({ surfaceId: SURFACE_ID, state: {} });
    if (state.status !== "mounted") throw new TypeError("Expected state.");
    const resources = mountRuntimeSurfaceResources({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      resources: {},
      catalogSet: catalogSet(),
      hostPorts: reactivePorts,
    });
    const operations = mountRuntimeSurfaceOperations({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      aliases: {},
      catalogSet: catalogSet(),
      hostPorts: reactivePorts,
    });
    if (resources.status !== "mounted" || operations.status !== "mounted") {
      throw new TypeError("Expected lower managers.");
    }

    expect(
      mountRuntimeReactiveReevaluation({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        stateHandle: state.handle,
        stateSnapshot: state.snapshot,
        resourceHandle: resources.handle,
        resourceSnapshot: resources.snapshot,
        operationHandle: operations.handle,
        operationSnapshot: operations.snapshot,
        hostPorts: reactivePorts,
        evaluator,
      }),
    ).toEqual({ status: "invalid", reason: "host-subscription-failed" });
    expect(control.contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(control.contextNotices.size).toBe(0);
    expect(retainedEnvironmentNotice).toBeTypeOf("function");
    retainedEnvironmentNotice?.();
    expect(evaluator).not.toHaveBeenCalled();
  });
});
