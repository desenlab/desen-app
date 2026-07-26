import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeHostPorts,
  createRuntimeResolutionSnapshot,
  disposeRuntimeSurfaceState,
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
  writeRuntimeSurfaceState,
} from "../src/index.js";
import {
  disposeRuntimeStateNavigationActions,
  executeRuntimeStateNavigationAction,
  mountRuntimeStateNavigationActions,
  readRuntimeStateNavigationActions,
} from "../src/state-navigation-actions.js";

import type { DesenDiagnostic } from "@desen/protocol";
import type {
  RuntimeHostPorts,
  RuntimeNavigationRequest,
  RuntimeResolutionSnapshot,
  RuntimeSurfaceStateMountInput,
  RuntimeSurfaceStateSnapshot,
  RuntimeTokenRequest,
} from "../src/index.js";
import type {
  RuntimeStateNavigationAction,
  RuntimeStateNavigationActionsHandle,
} from "../src/state-navigation-actions.js";

const DOCUMENT_ID = "com.desen.actions";
const REVISION = `sha256:${"a".repeat(64)}`;
const SURFACE_ID = "home";

type MountedState = Extract<ReturnType<typeof mountRuntimeSurfaceState>, { status: "mounted" }>;
type MountedActions = Extract<
  ReturnType<typeof mountRuntimeStateNavigationActions>,
  { status: "mounted" }
>;

interface Fixture {
  readonly state: MountedState;
  readonly actions: MountedActions;
}

interface HostOptions {
  readonly navigate?: (request: RuntimeNavigationRequest) => unknown;
  readonly token?: (request: RuntimeTokenRequest) => unknown;
  readonly report?: (diagnostic: DesenDiagnostic<string>) => void;
}

function stateInput(): RuntimeSurfaceStateMountInput {
  return {
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
      profile: {
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["enabled", "name"],
          properties: {
            enabled: { type: "boolean" },
            name: { type: "string", minLength: 1 },
          },
        },
        initial: { enabled: false, name: "Ada" },
      },
    },
  };
}

function hostPorts(options: HostOptions = {}): RuntimeHostPorts {
  return createRuntimeHostPorts({
    navigation: {
      navigate: (options.navigate ??
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
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
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

function mountedState(): MountedState {
  const result = mountRuntimeSurfaceState(stateInput());
  expect(result.status).toBe("mounted");
  if (result.status !== "mounted") throw new TypeError("Expected mounted test state.");
  return result;
}

function mountedFixture(options: HostOptions = {}): Fixture {
  const state = mountedState();
  const actions = mountRuntimeStateNavigationActions({
    documentId: DOCUMENT_ID,
    revision: REVISION,
    surfaceId: SURFACE_ID,
    surfaceIds: [SURFACE_ID, "settings"],
    stateHandle: state.handle,
    stateSnapshot: state.snapshot,
    hostPorts: hostPorts(options),
  });
  expect(actions.status).toBe("mounted");
  if (actions.status !== "mounted") throw new TypeError("Expected mounted action executor.");
  return Object.freeze({ state, actions });
}

function resolution(state: RuntimeSurfaceStateSnapshot): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state: state.values,
    context: {},
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function execute(
  fixture: Fixture,
  action: unknown,
  stateSnapshot: RuntimeSurfaceStateSnapshot = fixture.state.snapshot,
  runtimeSnapshot: RuntimeResolutionSnapshot = resolution(stateSnapshot),
) {
  return executeRuntimeStateNavigationAction(
    fixture.actions.handle,
    action as RuntimeStateNavigationAction,
    runtimeSnapshot,
    stateSnapshot,
  );
}

function currentState(fixture: Fixture): RuntimeSurfaceStateSnapshot {
  const read = readRuntimeSurfaceState(fixture.state.handle);
  expect(read.status).toBe("active");
  if (read.status !== "active") throw new TypeError("Expected active test state.");
  return read.snapshot;
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("M04-T10 mount and authority boundary", () => {
  it("mounts an exact state lifetime and local surface inventory without invoking host callbacks", () => {
    const navigate = vi.fn(() => ({ status: "succeeded" as const }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const fixture = mountedFixture({ navigate, token, report });

    expect(fixture.actions.stateSnapshot).toBe(fixture.state.snapshot);
    expect(navigate).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expectRecursivelyFrozen(fixture.actions);
  });

  it("reads exact identity and current lower state without callbacks, effects, or generation drift", () => {
    const navigate = vi.fn(() => ({ status: "succeeded" as const }));
    const token = vi.fn(() => ({ status: "missing" as const }));
    const report = vi.fn();
    const fixture = mountedFixture({ navigate, token, report });
    const detachedRead = readRuntimeStateNavigationActions;

    const initial = Reflect.apply(detachedRead, Object.freeze({ foreign: true }), [
      fixture.actions.handle,
    ]);
    expect(initial).toEqual({
      status: "read",
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      stateSnapshot: fixture.state.snapshot,
    });
    if (initial.status !== "read") throw new TypeError("Expected initial executor read.");
    expect(initial.stateSnapshot).toBe(fixture.state.snapshot);

    const written = writeRuntimeSurfaceState(fixture.state.handle, {
      path: "count",
      value: 1,
    });
    if (written.status !== "updated") throw new TypeError("Expected direct state update.");
    const current = readRuntimeStateNavigationActions(fixture.actions.handle);
    expect(current).toEqual({
      status: "read",
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      stateSnapshot: written.snapshot,
    });
    if (current.status !== "read") throw new TypeError("Expected current executor read.");
    expect(current.stateSnapshot).toBe(written.snapshot);
    expect(current.stateSnapshot.generation).toBe(1);
    expect(readRuntimeStateNavigationActions(fixture.actions.handle)).toEqual(current);

    expect(navigate).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it("contains forged, foreign, externally revoked, disposed, and navigated read authorities", () => {
    const left = mountedFixture();
    const right = mountedFixture();
    const forged = Object.freeze({}) as RuntimeStateNavigationActionsHandle;

    expect(readRuntimeStateNavigationActions(forged)).toEqual({
      status: "invalid-handle",
    });
    const foreign = readRuntimeStateNavigationActions(right.actions.handle);
    expect(foreign).toMatchObject({
      status: "read",
      stateSnapshot: right.state.snapshot,
    });
    if (foreign.status !== "read") throw new TypeError("Expected foreign executor read.");
    expect(foreign.stateSnapshot).not.toBe(left.state.snapshot);

    disposeRuntimeSurfaceState(left.state.handle);
    expect(readRuntimeStateNavigationActions(left.actions.handle)).toEqual({
      status: "disposed",
    });

    const disposed = mountedFixture();
    expect(disposeRuntimeStateNavigationActions(disposed.actions.handle)).toEqual({
      status: "disposed",
    });
    expect(readRuntimeStateNavigationActions(disposed.actions.handle)).toEqual({
      status: "disposed",
    });

    const navigated = mountedFixture();
    expect(execute(navigated, { type: "navigate", surface: "settings" })).toMatchObject({
      status: "navigated",
    });
    expect(readRuntimeStateNavigationActions(navigated.actions.handle)).toEqual({
      status: "navigated",
    });
  });

  it.each([
    ["duplicate", [SURFACE_ID, SURFACE_ID]],
    ["missing current", ["settings"]],
    ["malformed", [SURFACE_ID, "https://example.test"]],
  ])("rejects a %s local-surface inventory atomically", (_label, surfaceIds) => {
    const state = mountedState();
    const result = mountRuntimeStateNavigationActions({
      documentId: DOCUMENT_ID,
      revision: REVISION,
      surfaceId: SURFACE_ID,
      surfaceIds,
      stateHandle: state.handle,
      stateSnapshot: state.snapshot,
      hostPorts: hostPorts(),
    });
    expect(result).toMatchObject({ status: "invalid", reason: "invalid-surface-inventory" });
    expect(result).not.toHaveProperty("handle");
  });

  it("rejects stale, foreign, disposed, and forged state authorities", () => {
    const stale = mountedState();
    const updated = writeRuntimeSurfaceState(stale.handle, { path: "count", value: 1 });
    expect(updated.status).toBe("updated");
    expect(
      mountRuntimeStateNavigationActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        surfaceIds: [SURFACE_ID],
        stateHandle: stale.handle,
        stateSnapshot: stale.snapshot,
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });

    const foreign = mountRuntimeSurfaceState({ ...stateInput(), surfaceId: "foreign" });
    expect(foreign.status).toBe("mounted");
    if (foreign.status !== "mounted") throw new TypeError("Expected foreign state.");
    expect(
      mountRuntimeStateNavigationActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        surfaceIds: [SURFACE_ID],
        stateHandle: foreign.handle,
        stateSnapshot: foreign.snapshot,
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });

    const disposed = mountedState();
    disposeRuntimeSurfaceState(disposed.handle);
    expect(
      mountRuntimeStateNavigationActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        surfaceIds: [SURFACE_ID],
        stateHandle: disposed.handle,
        stateSnapshot: disposed.snapshot,
        hostPorts: hostPorts(),
      }),
    ).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });
  });

  it.each(["mutate", "dispose"] as const)(
    "rechecks state after hostile host-port capture attempts to %s it",
    (mode) => {
      const state = mountedState();
      const navigate = vi.fn(() => ({ status: "succeeded" as const }));
      const token = vi.fn(() => ({ status: "missing" as const }));
      const report = vi.fn();
      const base = hostPorts({ navigate, token, report });
      let attacked = false;
      const hostile = new Proxy(base, {
        getOwnPropertyDescriptor(target, key) {
          if (!attacked) {
            attacked = true;
            if (mode === "mutate") {
              writeRuntimeSurfaceState(state.handle, { path: "count", value: 7 });
            } else {
              disposeRuntimeSurfaceState(state.handle);
            }
          }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });

      const result = mountRuntimeStateNavigationActions({
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        surfaceIds: [SURFACE_ID],
        stateHandle: state.handle,
        stateSnapshot: state.snapshot,
        hostPorts: hostile,
      });
      expect(attacked).toBe(true);
      expect(result).toMatchObject({ status: "invalid", reason: "invalid-state-authority" });
      expect(navigate).not.toHaveBeenCalled();
      expect(token).not.toHaveBeenCalled();
      expect(report).not.toHaveBeenCalled();
    },
  );
});

describe("M04-T10 guard-first evaluation", () => {
  it("skips a false guard without inspecting any payload field or invoking any callback", () => {
    const reads = {
      type: vi.fn(),
      path: vi.fn(),
      value: vi.fn(),
      surface: vi.fn(),
      params: vi.fn(),
      extensions: vi.fn(),
    };
    const action: Record<string, unknown> = {
      when: { op: "truthy", args: [false] },
    };
    for (const key of Object.keys(reads) as (keyof typeof reads)[]) {
      Object.defineProperty(action, key, {
        enumerable: true,
        get() {
          reads[key]();
          throw new TypeError(`must not read ${key}`);
        },
      });
    }
    const navigate = vi.fn();
    const token = vi.fn();
    const report = vi.fn();
    const fixture = mountedFixture({ navigate, token, report });

    expect(execute(fixture, action)).toEqual({ status: "skipped", diagnostics: [] });
    for (const read of Object.values(reads)) expect(read).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(currentState(fixture)).toBe(fixture.state.snapshot);
  });

  it("keeps false-with-type-mismatch diagnostics observable in the result but never reports them", () => {
    const report = vi.fn();
    const fixture = mountedFixture({ report });
    const result = execute(fixture, {
      type: "state.toggle",
      path: "enabled",
      when: { op: "gt", args: [false, 1] },
    });

    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new TypeError("Expected skipped action.");
    expect(result.diagnostics).toMatchObject([
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" },
    ]);
    expect(report).not.toHaveBeenCalled();
    expectRecursivelyFrozen(result);
  });

  it("rejects malformed guards before action-shape validation and reports a redacted diagnostic", () => {
    const report = vi.fn();
    const fixture = mountedFixture({ report });
    const result = execute(fixture, {
      type: "not-an-action",
      when: { op: "unknown", args: [] },
      arbitrary: () => "executable",
    });

    expect(result).toMatchObject({ status: "guard-rejected", reason: "invalid" });
    expect(report).toHaveBeenCalledTimes(1);
    expect(String(report.mock.calls[0]?.[0]?.message)).not.toContain("executable");
    expectRecursivelyFrozen(result);
  });

  it("holds the busy gate before a hostile when-descriptor trap can reenter", () => {
    const fixture = mountedFixture();
    let nestedStatus = "";
    let trapped = false;
    const target = {
      type: "state.toggle",
      path: "enabled",
      when: { op: "truthy", args: [false] },
    };
    const action = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === "when" && !trapped) {
          trapped = true;
          nestedStatus = execute(fixture, { type: "state.toggle", path: "enabled" }).status;
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });

    expect(execute(fixture, action)).toMatchObject({ status: "skipped" });
    expect(nestedStatus).toBe("busy");
    expect(currentState(fixture).values.enabled).toBe(false);
  });

  it("returns disposed when a hostile when-descriptor trap terminally revokes the executor", () => {
    const fixture = mountedFixture();
    let trapped = false;
    const target = { type: "state.toggle", path: "enabled" };
    const action = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === "when" && !trapped) {
          trapped = true;
          disposeRuntimeStateNavigationActions(fixture.actions.handle);
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });

    expect(execute(fixture, action)).toEqual({ status: "disposed" });
    expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("disposed");
  });

  it("reports true-guard mismatch diagnostics before payload and stops on diagnostic-time state drift", () => {
    const events: string[] = [];
    // Deliberate cyclic fixture: the host callback must target the authority mounted below.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const report = vi.fn(() => {
      events.push("report");
      writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 9 });
    });
    const token = vi.fn(() => {
      events.push("token");
      return { status: "resolved" as const, value: 2 };
    });
    fixture = mountedFixture({ report, token });
    const result = execute(fixture, {
      type: "state.set",
      path: "count",
      value: { $token: "count.next" },
      when: {
        op: "any",
        args: [true, { op: "gt", args: [false, 1] }],
      },
    });

    expect(result).toMatchObject({ status: "invalid-snapshot" });
    expect(events).toEqual(["report"]);
    expect(token).not.toHaveBeenCalled();
    expect(currentState(fixture).values.count).toBe(9);
  });

  it("keeps diagnostic-report reentry busy and turns diagnostic-time disposal into disposed", () => {
    // Deliberate cyclic fixture for the reentrant host callback.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const nested: string[] = [];
    const report = vi.fn(() => {
      nested.push(execute(fixture, { type: "state.toggle", path: "enabled" }).status);
      disposeRuntimeStateNavigationActions(fixture.actions.handle);
    });
    fixture = mountedFixture({ report });
    const result = execute(fixture, {
      type: "state.toggle",
      path: "enabled",
      when: {
        op: "any",
        args: [true, { op: "gt", args: [false, 1] }],
      },
    });

    expect(nested).toEqual(["busy"]);
    expect(result).toEqual({ status: "disposed" });
  });

  it("rechecks exact state before returning a token-backed false guard", () => {
    // Deliberate cyclic fixture: the false-guard token callback mutates the mounted state.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const payload = vi.fn(() => 2);
    const token = vi.fn(() => {
      writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 4 });
      return { status: "resolved" as const, value: false };
    });
    fixture = mountedFixture({ token });
    const action = {
      type: "state.set",
      path: "count",
      when: { op: "truthy", args: [{ $token: "guard.false" }] },
    } as Record<string, unknown>;
    Object.defineProperty(action, "value", { enumerable: true, get: payload });

    expect(execute(fixture, action)).toMatchObject({ status: "invalid-snapshot" });
    expect(payload).not.toHaveBeenCalled();
    expect(currentState(fixture).values.count).toBe(4);
  });

  it("captures one mutable token result once across a true guard, diagnostic callback, and payload", () => {
    const providerResult = { status: "resolved" as const, value: true };
    const token = vi.fn(() => providerResult);
    const report = vi.fn(() => {
      providerResult.value = false;
    });
    const fixture = mountedFixture({ token, report });
    const result = execute(fixture, {
      type: "state.set",
      path: "enabled",
      value: { $token: "feature.flag" },
      when: {
        op: "all",
        args: [
          { $token: "feature.flag" },
          { op: "any", args: [true, { op: "gt", args: [false, 1] }] },
        ],
      },
    });

    expect(result).toMatchObject({ status: "state-updated", requestId: 'action:["home",0]' });
    expect(token).toHaveBeenCalledTimes(1);
    expect(currentState(fixture).values.enabled).toBe(true);
  });
});

describe("M04-T10 state actions", () => {
  it("materializes references and applies complete-schema state.set updates and no-ops", () => {
    const fixture = mountedFixture();
    const first = execute(fixture, {
      type: "state.set",
      path: "count",
      value: 2,
    });
    expect(first).toMatchObject({ status: "state-updated", requestId: 'action:["home",0]' });
    if (first.status !== "state-updated") throw new TypeError("Expected updated state.");

    const second = execute(
      fixture,
      { type: "state.set", path: "count", value: { $ref: "state.count" } },
      first.stateSnapshot,
      resolution(first.stateSnapshot),
    );
    expect(second).toMatchObject({ status: "state-unchanged", requestId: 'action:["home",1]' });
    expect(currentState(fixture).values.count).toBe(2);
  });

  it("rejects complete-schema violations without partial writes or request-id gaps", () => {
    const fixture = mountedFixture();
    const rejected = execute(fixture, {
      type: "state.set",
      path: "profile.enabled",
      value: "not-boolean",
    });
    expect(rejected).toMatchObject({
      status: "state-rejected",
      action: "state.set",
      reason: "schema-mismatch",
    });
    expect(currentState(fixture)).toBe(fixture.state.snapshot);

    const accepted = execute(fixture, {
      type: "state.set",
      path: "profile.enabled",
      value: true,
    });
    expect(accepted).toMatchObject({
      status: "state-updated",
      requestId: 'action:["home",0]',
    });
    expect(currentState(fixture).values.profile).toEqual({ enabled: true, name: "Ada" });
  });

  it("detects token-time state mutation immediately before state.set", () => {
    // Deliberate cyclic fixture: the token callback mutates the mounted state.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const token = vi.fn(() => {
      writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 7 });
      return { status: "resolved" as const, value: 5 };
    });
    fixture = mountedFixture({ token });

    expect(
      execute(fixture, {
        type: "state.set",
        path: "count",
        value: { $token: "count.next" },
      }),
    ).toMatchObject({ status: "invalid-snapshot" });
    expect(currentState(fixture).values.count).toBe(7);
  });

  it("stops token materialization and returns disposed when a token callback revokes state", () => {
    // Deliberate cyclic fixture: the token callback revokes the mounted executor.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const token = vi.fn(() => {
      disposeRuntimeStateNavigationActions(fixture.actions.handle);
      return { status: "resolved" as const, value: 5 };
    });
    fixture = mountedFixture({ token });

    expect(
      execute(fixture, {
        type: "state.set",
        path: "count",
        value: { $token: "count.next" },
      }),
    ).toEqual({ status: "disposed" });
    expect(token).toHaveBeenCalledTimes(1);
  });

  it("toggles exact root and nested booleans but rejects missing and non-boolean targets", () => {
    const fixture = mountedFixture();
    const root = execute(fixture, { type: "state.toggle", path: "enabled" });
    expect(root).toMatchObject({ status: "state-updated", requestId: 'action:["home",0]' });
    if (root.status !== "state-updated") throw new TypeError("Expected root toggle.");
    const nested = execute(
      fixture,
      { type: "state.toggle", path: "profile.enabled" },
      root.stateSnapshot,
      resolution(root.stateSnapshot),
    );
    expect(nested).toMatchObject({ status: "state-updated", requestId: 'action:["home",1]' });
    if (nested.status !== "state-updated") throw new TypeError("Expected nested toggle.");

    const rejected = execute(
      fixture,
      { type: "state.toggle", path: "label" },
      nested.stateSnapshot,
      resolution(nested.stateSnapshot),
    );
    expect(rejected).toMatchObject({
      status: "state-rejected",
      reason: "toggle-target-not-boolean",
    });
    expect(currentState(fixture).values.profile).toEqual({ enabled: true, name: "Ada" });
  });

  it("detects guard-token state mutation immediately before toggle", () => {
    // Deliberate cyclic fixture: the guard callback mutates the mounted state.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const token = vi.fn(() => {
      writeRuntimeSurfaceState(fixture.state.handle, { path: "enabled", value: true });
      return { status: "resolved" as const, value: true };
    });
    fixture = mountedFixture({ token });

    expect(
      execute(fixture, {
        type: "state.toggle",
        path: "enabled",
        when: { op: "truthy", args: [{ $token: "guard" }] },
      }),
    ).toMatchObject({ status: "invalid-snapshot" });
    expect(currentState(fixture).values.enabled).toBe(true);
  });

  it("rejects extra and accessor action fields without invoking accessors", () => {
    const fixture = mountedFixture();
    expect(
      execute(fixture, { type: "state.set", path: "count", value: 1, extra: true }),
    ).toMatchObject({ status: "invalid-action" });

    const getter = vi.fn(() => 1);
    const action = { type: "state.set", path: "count" } as Record<string, unknown>;
    Object.defineProperty(action, "value", { enumerable: true, get: getter });
    expect(execute(fixture, action)).toMatchObject({ status: "invalid-action" });
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("M04-T10 local navigation", () => {
  it("materializes one sorted detached parameter map, calls receiver-independently, and terminates", () => {
    let observed: RuntimeNavigationRequest | undefined;
    const navigate = vi.fn(function (this: unknown, request: RuntimeNavigationRequest) {
      expect(this).toBeUndefined();
      observed = request;
      return { status: "succeeded" as const };
    });
    const token = vi.fn(() => ({ status: "resolved" as const, value: "shared" }));
    const fixture = mountedFixture({ navigate, token });
    const result = execute(fixture, {
      type: "navigate",
      surface: "settings",
      params: {
        z: { $token: "shared" },
        a: { $token: "shared" },
      },
    });

    expect(result).toMatchObject({
      status: "navigated",
      requestId: 'action:["home",0]',
      surface: "settings",
    });
    expect(token).toHaveBeenCalledTimes(1);
    expect(Object.keys(observed?.params ?? {})).toEqual(["a", "z"]);
    expect(observed).toEqual({
      context: {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: SURFACE_ID,
        requestId: 'action:["home",0]',
      },
      targetSurfaceId: "settings",
      params: { a: "shared", z: "shared" },
    });
    expectRecursivelyFrozen(observed);
    expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("disposed");
    expect(execute(fixture, { type: "state.toggle", path: "enabled" })).toEqual({
      status: "disposed",
    });
    expect(disposeRuntimeStateNavigationActions(fixture.actions.handle)).toEqual({
      status: "already-disposed",
    });
  });

  it("treats successful same-surface navigation as terminal", () => {
    const fixture = mountedFixture();
    expect(execute(fixture, { type: "navigate", surface: SURFACE_ID })).toMatchObject({
      status: "navigated",
      surface: SURFACE_ID,
    });
    expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("disposed");
  });

  it("rejects unknown/non-local targets before params and extensions with exact core diagnostics", () => {
    const params = vi.fn();
    const extensions = vi.fn();
    const action = { type: "navigate", surface: "outside" } as Record<string, unknown>;
    Object.defineProperty(action, "params", { enumerable: true, get: params });
    Object.defineProperty(action, "extensions", { enumerable: true, get: extensions });
    const navigate = vi.fn();
    const token = vi.fn();
    const fixture = mountedFixture({ navigate, token });
    const result = execute(fixture, action);

    expect(result).toMatchObject({
      status: "unknown-surface",
      surface: "outside",
      diagnostics: [{ code: "ENTRY_NOT_FOUND", pointer: "/surface" }],
    });
    expect(params).not.toHaveBeenCalled();
    expect(extensions).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expectRecursivelyFrozen(result);
  });

  it("gives terminal disposal precedence when unknown-surface reflection revokes the executor", () => {
    // Deliberate cyclic fixture: the surface descriptor trap revokes its executor.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const params = vi.fn();
    let attacked = false;
    const target = { type: "navigate", surface: "outside" } as Record<string, unknown>;
    Object.defineProperty(target, "params", { enumerable: true, get: params });
    const action = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        if (key === "surface" && !attacked) {
          attacked = true;
          disposeRuntimeStateNavigationActions(fixture.actions.handle);
        }
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });
    fixture = mountedFixture();

    expect(execute(fixture, action)).toEqual({ status: "disposed" });
    expect(params).not.toHaveBeenCalled();
  });

  it("gives exact-state drift precedence over an early invalid action shape", () => {
    // Deliberate cyclic fixture: own-key reflection mutates state before shape rejection.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    let attacked = false;
    const action = new Proxy(
      { type: "state.toggle", path: "enabled", extra: true },
      {
        ownKeys(object) {
          if (!attacked) {
            attacked = true;
            writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 6 });
          }
          return Reflect.ownKeys(object);
        },
      },
    );
    fixture = mountedFixture();

    expect(execute(fixture, action)).toMatchObject({ status: "invalid-snapshot" });
    expect(currentState(fixture).values.count).toBe(6);
  });

  it("rejects a known target with nested params accessors without invoking them", () => {
    const getter = vi.fn(() => "secret");
    const params: Record<string, unknown> = {};
    Object.defineProperty(params, "secret", { enumerable: true, get: getter });
    const navigate = vi.fn();
    const fixture = mountedFixture({ navigate });
    const result = execute(fixture, {
      type: "navigate",
      surface: "settings",
      params,
    });

    expect(result).toMatchObject({ status: "payload-rejected", reason: "invalid" });
    expect(getter).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("fails closed when action-wide distinct token retention exceeds the aggregate JSON budget", () => {
    const large = Object.freeze(Array.from({ length: 2_050 }, () => 1));
    const calls: string[] = [];
    const token = vi.fn((request: RuntimeTokenRequest) => {
      calls.push(request.token);
      return { status: "resolved" as const, value: large };
    });
    const navigate = vi.fn();
    const fixture = mountedFixture({ token, navigate });
    const result = execute(fixture, {
      type: "navigate",
      surface: "settings",
      when: { op: "truthy", args: [{ $token: "guard" }] },
      params: {
        a: { $token: "payload-a" },
        b: { $token: "payload-b" },
      },
    });

    expect(result).toMatchObject({ status: "payload-rejected", reason: "invalid" });
    expect(calls).toEqual(["guard", "payload-a"]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("preserves T03 ADAPTER_FAILURE classification for individually unsafe token results", () => {
    const oversized = Object.freeze(Array.from({ length: 4_097 }, () => 1));
    const guardNavigate = vi.fn();
    const guardToken = vi.fn(() => ({ status: "resolved" as const, value: oversized }));
    const guardFixture = mountedFixture({ token: guardToken, navigate: guardNavigate });
    expect(
      execute(guardFixture, {
        type: "navigate",
        surface: "settings",
        when: { op: "truthy", args: [{ $token: "too.large" }] },
      }),
    ).toMatchObject({ status: "guard-rejected", reason: "adapter-failed" });
    expect(guardToken).toHaveBeenCalledTimes(1);
    expect(guardNavigate).not.toHaveBeenCalled();

    const payloadCalls: string[] = [];
    const payloadNavigate = vi.fn();
    const payloadFixture = mountedFixture({
      navigate: payloadNavigate,
      token(request) {
        payloadCalls.push(request.token);
        return {
          status: "resolved",
          value: request.token === "a.large" ? oversized : "must-not-run",
        };
      },
    });
    expect(
      execute(payloadFixture, {
        type: "navigate",
        surface: "settings",
        params: {
          a: { $token: "a.large" },
          b: { $token: "b.later" },
        },
      }),
    ).toMatchObject({ status: "payload-rejected", reason: "adapter-failed" });
    expect(payloadCalls).toEqual(["a.large"]);
    expect(payloadNavigate).not.toHaveBeenCalled();
  });

  it("keeps malformed or thrown token providers classified as ADAPTER_FAILURE", () => {
    const malformed = mountedFixture({
      token: () => ({ status: "resolved", value: () => "host secret" }),
    });
    const malformedResult = execute(malformed, {
      type: "state.set",
      path: "count",
      value: { $token: "malformed" },
    });
    expect(malformedResult).toMatchObject({
      status: "payload-rejected",
      reason: "adapter-failed",
      diagnostics: [{ code: "ADAPTER_FAILURE" }],
    });
    expect(JSON.stringify(malformedResult)).not.toContain("host secret");

    const thrown = mountedFixture({
      token() {
        throw new Error("private provider detail");
      },
    });
    const thrownResult = execute(thrown, {
      type: "state.set",
      path: "count",
      value: { $token: "throws" },
    });
    expect(thrownResult).toMatchObject({
      status: "payload-rejected",
      reason: "adapter-failed",
      diagnostics: [{ code: "ADAPTER_FAILURE" }],
    });
    expect(JSON.stringify(thrownResult)).not.toContain("private provider detail");
  });

  it("detects params-token state mutation immediately before navigation", () => {
    // Deliberate cyclic fixture: the params token callback mutates the mounted state.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    const navigate = vi.fn();
    const token = vi.fn(() => {
      writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 8 });
      return { status: "resolved" as const, value: "ok" };
    });
    fixture = mountedFixture({ navigate, token });
    const result = execute(fixture, {
      type: "navigate",
      surface: "settings",
      params: { q: { $token: "query" } },
    });

    expect(result).toMatchObject({ status: "invalid-snapshot" });
    expect(navigate).not.toHaveBeenCalled();
    expect(currentState(fixture).values.count).toBe(8);
  });

  it("rechecks disposal after hostile navigation-result reflection", () => {
    // Deliberate cyclic fixture: result reflection revokes the mounted executor.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    let attacked = false;
    const rawResult = new Proxy(
      { status: "succeeded" as const },
      {
        getOwnPropertyDescriptor(object, key) {
          if (!attacked) {
            attacked = true;
            disposeRuntimeStateNavigationActions(fixture.actions.handle);
          }
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
      },
    );
    fixture = mountedFixture({ navigate: () => rawResult });

    expect(execute(fixture, { type: "navigate", surface: "settings" })).toEqual({
      status: "disposed",
    });
    expect(attacked).toBe(true);
  });

  it("rechecks exact state after hostile denied-result reflection before interpreting denial", () => {
    // Deliberate cyclic fixture: result reflection mutates the mounted state.
    // eslint-disable-next-line prefer-const
    let fixture!: Fixture;
    let attacked = false;
    const rawResult = new Proxy(
      { status: "denied" as const },
      {
        getOwnPropertyDescriptor(object, key) {
          if (!attacked) {
            attacked = true;
            writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 3 });
          }
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
      },
    );
    fixture = mountedFixture({ navigate: () => rawResult });

    expect(execute(fixture, { type: "navigate", surface: "settings" })).toMatchObject({
      status: "invalid-snapshot",
    });
    expect(currentState(fixture).values.count).toBe(3);
  });

  it("keeps denial live, emits namespaced NAVIGATION_DENIED, and consumes only accepted IDs", () => {
    const navigate = vi
      .fn()
      .mockReturnValueOnce({ status: "denied" })
      .mockReturnValueOnce({ status: "succeeded" });
    const fixture = mountedFixture({ navigate });
    expect(
      execute(fixture, {
        type: "navigate",
        surface: "unknown",
        params: { ignored: { $token: "never" } },
      }),
    ).toMatchObject({ status: "unknown-surface" });
    expect(execute(fixture, { type: "navigate", surface: "settings" })).toMatchObject({
      status: "navigation-denied",
      requestId: 'action:["home",0]',
      diagnostics: [{ code: "run.desen.runtime/NAVIGATION_DENIED" }],
    });
    expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("active");
    expect(execute(fixture, { type: "navigate", surface: "settings" })).toMatchObject({
      status: "navigated",
      requestId: 'action:["home",1]',
    });
  });

  it.each([
    [
      "throw",
      () =>
        void (() => {
          throw new Error("secret");
        })(),
    ],
    ["promise", () => Promise.resolve({ status: "succeeded" })],
    ["malformed", () => ({ status: "succeeded", extra: true })],
    [
      "accessor",
      () => {
        const result = {};
        Object.defineProperty(result, "status", {
          enumerable: true,
          get() {
            throw new Error("must not invoke");
          },
        });
        return result;
      },
    ],
  ])(
    "maps %s navigation adapter outcomes to redacted ADAPTER_FAILURE and stays live",
    (_label, fn) => {
      const fixture = mountedFixture({ navigate: fn });
      const result = execute(fixture, { type: "navigate", surface: "settings" });
      expect(result).toMatchObject({
        status: "adapter-failed",
        requestId: 'action:["home",0]',
        diagnostics: [{ code: "ADAPTER_FAILURE" }],
      });
      expect(JSON.stringify(result)).not.toContain("secret");
      expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("active");
      expectRecursivelyFrozen(result);
    },
  );
});

describe("M04-T10 disposal and provenance", () => {
  it("rejects stale or foreign state/resolution snapshots before action inspection", () => {
    const fixture = mountedFixture();
    const foreign = mountedState();
    const actionGetter = vi.fn(() => "state.toggle");
    const action = {} as Record<string, unknown>;
    Object.defineProperty(action, "type", { enumerable: true, get: actionGetter });

    expect(
      executeRuntimeStateNavigationAction(
        fixture.actions.handle,
        action as unknown as RuntimeStateNavigationAction,
        resolution(foreign.snapshot),
        foreign.snapshot,
      ),
    ).toMatchObject({ status: "invalid-snapshot" });
    expect(actionGetter).not.toHaveBeenCalled();

    writeRuntimeSurfaceState(fixture.state.handle, { path: "count", value: 1 });
    expect(execute(fixture, { type: "state.toggle", path: "enabled" })).toMatchObject({
      status: "invalid-snapshot",
    });
  });

  it("disposes idempotently, revokes owned state, and rejects forged handles", () => {
    const fixture = mountedFixture();
    expect(disposeRuntimeStateNavigationActions(fixture.actions.handle)).toEqual({
      status: "disposed",
    });
    expect(disposeRuntimeStateNavigationActions(fixture.actions.handle)).toEqual({
      status: "already-disposed",
    });
    expect(readRuntimeSurfaceState(fixture.state.handle).status).toBe("disposed");

    const forged = Object.freeze({}) as RuntimeStateNavigationActionsHandle;
    expect(disposeRuntimeStateNavigationActions(forged)).toEqual({ status: "invalid-handle" });
    expect(
      executeRuntimeStateNavigationAction(
        forged,
        { type: "state.toggle", path: "enabled" },
        resolution(fixture.state.snapshot),
        fixture.state.snapshot,
      ),
    ).toEqual({ status: "invalid-handle" });
  });
});
