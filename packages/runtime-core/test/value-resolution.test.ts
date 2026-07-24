import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeResolutionSnapshot,
  resolveRuntimeValue,
} from "../src/index.js";

import type { RuntimeResolutionSnapshotInput, RuntimeValueSpec } from "../src/index.js";

function createSnapshotInput(): RuntimeResolutionSnapshotInput {
  return {
    state: {
      profile: { name: "Selman", nullable: null },
      enabled: false,
      count: 0,
      empty: "",
      list: [{ id: "one" }, { id: "two" }],
      indirect: { $ref: "context.private" },
    },
    context: {
      route: { tenant: "desenlab" },
      capabilities: { canPublish: true },
    },
    resource: {
      stores: {
        status: "succeeded",
        pending: false,
        value: { items: [{ id: "store-1" }], total: 1 },
      },
      drafts: { status: "idle", pending: false },
    },
    operation: {
      save: { status: "pending", pending: true },
      signIn: {
        status: "failed",
        pending: false,
        error: { code: "invalidCredentials" },
      },
    },
    event: {
      status: "available",
      value: { field: { id: "email" }, valid: false },
    },
    item: {
      task: { title: "Protokolü kanıtla", done: false },
    },
    env: {
      viewport: { width: 1280, height: 720, orientation: "landscape" },
      pointer: "fine",
      colorScheme: "dark",
      reducedMotion: false,
      locale: "tr-TR",
      platform: "web",
    },
  };
}

function asSnapshotInput(value: unknown): RuntimeResolutionSnapshotInput {
  return value as RuntimeResolutionSnapshotInput;
}

function asValueSpec(value: unknown): RuntimeValueSpec {
  return value as RuntimeValueSpec;
}

describe("runtime value resolution snapshot", () => {
  it("copies all seven namespaces atomically and recursively freezes the detached result", () => {
    const input = createSnapshotInput();
    const snapshot = createRuntimeResolutionSnapshot(input);

    expect(Object.keys(snapshot).sort()).toEqual([
      "context",
      "env",
      "event",
      "item",
      "operation",
      "resource",
      "state",
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.state)).toBe(true);
    expect(Object.isFrozen(snapshot.state.profile)).toBe(true);
    expect(Object.isFrozen(snapshot.resource.stores)).toBe(true);
    expect(Object.isFrozen(snapshot.event)).toBe(true);

    (input.state.profile as { name: string }).name = "mutated";
    (input.resource as Record<string, unknown>).stores = { status: "idle", pending: false };
    expect(snapshot.state.profile).toEqual({ name: "Selman", nullable: null });
    expect(snapshot.resource.stores).toMatchObject({ status: "succeeded" });
  });

  it("rejects forged snapshots at resolution even when their visible shape is identical", () => {
    const forged = createSnapshotInput();
    expect(() =>
      resolveRuntimeValue(
        "literal",
        forged as unknown as ReturnType<typeof createRuntimeResolutionSnapshot>,
      ),
    ).toThrowError("Runtime values require a factory-created resolution snapshot.");
  });

  it.each([
    [
      "missing namespace",
      (() => {
        const { env, ...rest } = createSnapshotInput();
        void env;
        return rest;
      })(),
    ],
    ["extra namespace", { ...createSnapshotInput(), globals: {} }],
    [
      "incoherent pending lifecycle",
      {
        ...createSnapshotInput(),
        operation: { save: { status: "pending", pending: false } },
      },
    ],
    [
      "leaking lifecycle field",
      {
        ...createSnapshotInput(),
        resource: {
          stores: {
            status: "failed",
            pending: false,
            error: { code: "offline", message: "internal detail" },
          },
        },
      },
    ],
    [
      "implicit event absence",
      {
        ...createSnapshotInput(),
        event: {},
      },
    ],
    ["custom prototype", Object.assign(Object.create({ secret: true }), createSnapshotInput())],
  ])("rejects %s", (_label, input) => {
    expect(() => createRuntimeResolutionSnapshot(asSnapshotInput(input))).toThrowError(
      "Runtime resolution snapshot input must be bounded data-only JSON",
    );
  });

  it("rejects accessors without invoking them and rejects the complete aggregate", () => {
    const getter = vi.fn(() => ({ tenant: "unsafe" }));
    const input = createSnapshotInput();
    Object.defineProperty(input.context, "route", {
      enumerable: true,
      configurable: true,
      get: getter,
    });

    expect(() => createRuntimeResolutionSnapshot(input)).toThrowError(
      "Runtime resolution snapshot input must be bounded data-only JSON",
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it("copies only own data from plain-record-compatible objects and never inherits fields", () => {
    const compatiblePrototype = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(compatiblePrototype, "constructor", {
      configurable: true,
      value: Object,
    });
    compatiblePrototype.inheritedSecret = "must not cross";
    const input = Object.assign(
      Object.create(compatiblePrototype) as object,
      createSnapshotInput(),
    );

    const snapshot = createRuntimeResolutionSnapshot(asSnapshotInput(input));
    expect(Object.hasOwn(snapshot, "inheritedSecret")).toBe(false);
    expect("inheritedSecret" in snapshot).toBe(false);
  });

  it("contains reflection failures, cycles, promises, sparse arrays, and non-finite numbers", () => {
    const cyclic = createSnapshotInput();
    (cyclic.context as Record<string, unknown>).cycle = cyclic.context;

    const promise = createSnapshotInput();
    (promise.context as Record<string, unknown>).future = Promise.resolve("secret");

    const sparse = createSnapshotInput();
    (sparse.state as Record<string, unknown>).sparse = new Array(2);

    const nonFinite = createSnapshotInput();
    (nonFinite.state as Record<string, unknown>).bad = Number.POSITIVE_INFINITY;

    const hostile = new Proxy(createSnapshotInput(), {
      ownKeys() {
        throw new Error("hostile reflection");
      },
    });

    for (const input of [cyclic, promise, sparse, nonFinite, hostile]) {
      expect(() => createRuntimeResolutionSnapshot(asSnapshotInput(input))).toThrowError(
        "Runtime resolution snapshot input must be bounded data-only JSON",
      );
    }
  });
});

describe("resolveRuntimeValue", () => {
  it("resolves literals and every DESEN reference namespace without host effects", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const result = resolveRuntimeValue(
      {
        name: { $ref: "state.profile.name" },
        tenant: { $ref: "context.route.tenant" },
        resourceStatus: { $ref: "resource.stores.status" },
        stores: { $ref: "resource.stores.value.items" },
        operationPending: { $ref: "operation.save.pending" },
        publicError: { $ref: "operation.signIn.error.code" },
        field: { $ref: "event.field.id" },
        task: { $ref: "item.task.title" },
        width: { $ref: "env.viewport.width" },
        scalar: true,
        ordered: [1, "two", null],
      },
      snapshot,
    );

    expect(result).toEqual({
      status: "resolved",
      usedFallback: false,
      value: {
        field: "email",
        name: "Selman",
        operationPending: true,
        ordered: [1, "two", null],
        publicError: "invalidCredentials",
        resourceStatus: "succeeded",
        scalar: true,
        stores: [{ id: "store-1" }],
        task: "Protokolü kanıtla",
        tenant: "desenlab",
        width: 1280,
      },
    });
    if (result.status !== "resolved") throw new Error("expected resolved value");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
  });

  it("preserves null and every falsy resolved value without selecting fallback", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(
      resolveRuntimeValue({ $ref: "state.profile.nullable", fallback: "wrong" }, snapshot),
    ).toEqual({ status: "resolved", value: null, usedFallback: false });
    expect(resolveRuntimeValue({ $ref: "state.enabled", fallback: true }, snapshot)).toEqual({
      status: "resolved",
      value: false,
      usedFallback: false,
    });
    expect(resolveRuntimeValue({ $ref: "state.count", fallback: 99 }, snapshot)).toEqual({
      status: "resolved",
      value: 0,
      usedFallback: false,
    });
    expect(resolveRuntimeValue({ $ref: "state.empty", fallback: "wrong" }, snapshot)).toEqual({
      status: "resolved",
      value: "",
      usedFallback: false,
    });
  });

  it("uses fallback only for a missing path beneath a valid active root", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(
      resolveRuntimeValue(
        {
          state: { $ref: "state.profile.nickname", fallback: "anonymous" },
          context: { $ref: "context.route.section", fallback: "home" },
          resource: { $ref: "resource.drafts.value", fallback: [] },
          operation: { $ref: "operation.save.error.code", fallback: "none" },
        },
        snapshot,
      ),
    ).toEqual({
      status: "resolved",
      usedFallback: true,
      value: {
        context: "home",
        operation: "none",
        resource: [],
        state: "anonymous",
      },
    });
  });

  it.each([
    ["state.unknown", "unknown-root"],
    ["resource.unknown.status", "unknown-root"],
    ["operation.unknown.status", "unknown-root"],
    ["item.unknown.title", "unknown-root"],
    ["resource.stores.secret", "invalid-path"],
    ["operation.save.status.value", "invalid-path"],
  ] as const)("does not let fallback legalize %s", (reference, reason) => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(resolveRuntimeValue({ $ref: reference, fallback: "guessed" }, snapshot)).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/$ref",
      reference,
      reason,
    });
  });

  it("does not let fallback revive event scope outside the immediate handler turn", () => {
    const input = { ...createSnapshotInput(), event: { status: "unavailable" as const } };
    const snapshot = createRuntimeResolutionSnapshot(input);
    expect(resolveRuntimeValue({ $ref: "event.field", fallback: "guessed" }, snapshot)).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/$ref",
      reference: "event.field",
      reason: "inactive-scope",
    });
  });

  it("returns arrays whole, never traverses them, and interprets exactly the second root segment", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(resolveRuntimeValue({ $ref: "state.list" }, snapshot)).toEqual({
      status: "resolved",
      value: [{ id: "one" }, { id: "two" }],
      usedFallback: false,
    });
    expect(
      resolveRuntimeValue({ $ref: "state.list.length", fallback: "missing" }, snapshot),
    ).toEqual({
      status: "resolved",
      value: "missing",
      usedFallback: true,
    });
    expect(
      resolveRuntimeValue({ $ref: "state.profile.name.extra", fallback: "missing" }, snapshot),
    ).toEqual({
      status: "resolved",
      value: "missing",
      usedFallback: true,
    });
  });

  it("keeps reference-shaped scope data inert instead of evaluating it a second time", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(resolveRuntimeValue({ $ref: "state.indirect" }, snapshot)).toEqual({
      status: "resolved",
      value: { $ref: "context.private" },
      usedFallback: false,
    });
  });

  it("reports the exact nested pointer and never returns a partial composite value", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const result = resolveRuntimeValue(
      {
        cards: [
          { title: "valid" },
          { title: { $ref: "state.profile.missing" } },
          { title: "must not become observable" },
        ],
      },
      snapshot,
    );
    expect(result).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/cards/1/title/$ref",
      reference: "state.profile.missing",
      reason: "missing-path",
    });
    expect("value" in result).toBe(false);

    expect(
      resolveRuntimeValue({ "a/b~c": { $ref: "state.profile.missing" } }, snapshot),
    ).toMatchObject({ pointer: "/a~1b~0c/$ref" });
  });

  it("evaluates a selected fallback normally and preserves its exact failure pointer", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(
      resolveRuntimeValue(
        {
          $ref: "context.missing",
          fallback: { $ref: "state.profile.alsoMissing" },
        },
        snapshot,
      ),
    ).toEqual({
      status: "unresolved",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/fallback/$ref",
      reference: "state.profile.alsoMissing",
      reason: "missing-path",
    });
  });

  it("fences valid token and format forms until M04-T03 without partial materialization", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(resolveRuntimeValue({ $token: "color.action.primary" }, snapshot)).toEqual({
      status: "deferred",
      form: "token",
      pointer: "/$token",
    });
    const composite = resolveRuntimeValue(
      {
        greeting: {
          $format: {
            template: "Hello {name}",
            values: { name: { $ref: "state.profile.name" } },
          },
        },
        observable: "must not escape",
      },
      snapshot,
    );
    expect(composite).toEqual({
      status: "deferred",
      form: "format",
      pointer: "/greeting/$format",
    });
    expect("value" in composite).toBe(false);
  });

  it.each([
    [{ $ref: "global.secret", fallback: "unsafe" }, "/$ref", "malformed-reference"],
    [{ $ref: "state.list.0" }, "/$ref", "malformed-reference"],
    [{ $ref: "state.profile.name", extra: true }, "/$ref", "malformed-reference"],
    [{ $token: "" }, "/$token", "malformed-token"],
    [
      { $format: { template: "{bad}", values: { "not-valid": "x" } } },
      "/$format/values/not-valid",
      "malformed-format",
    ],
    [{ $unknown: "reserved" }, "/$unknown", "reserved-literal-key"],
  ] as const)("rejects malformed value form %#", (spec, pointer, reason) => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(resolveRuntimeValue(asValueSpec(spec), snapshot)).toEqual({
      status: "invalid",
      pointer,
      reason,
    });
  });

  it("rejects hostile or unbounded value data without invoking accessors", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const getter = vi.fn(() => "secret");
    const accessor = {};
    Object.defineProperty(accessor, "value", { enumerable: true, get: getter });

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    const tooLarge = new Array(RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes).fill(null);
    for (const spec of [accessor, cycle, tooLarge, Number.NaN]) {
      expect(resolveRuntimeValue(asValueSpec(spec), snapshot)).toEqual({
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      });
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("accepts every exact safety maximum and rejects each plus-one boundary", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const exactString = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits);
    expect(resolveRuntimeValue(exactString, snapshot)).toMatchObject({ status: "resolved" });
    expect(resolveRuntimeValue(`${exactString}x`, snapshot)).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    const exactNodes = new Array(RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes - 1).fill(null);
    expect(resolveRuntimeValue(exactNodes, snapshot)).toMatchObject({ status: "resolved" });
    expect(resolveRuntimeValue([...exactNodes, null], snapshot)).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    function nestedArray(depth: number): RuntimeValueSpec {
      let value: RuntimeValueSpec = null;
      for (let index = 0; index < depth; index += 1) value = [value];
      return value;
    }
    expect(
      resolveRuntimeValue(nestedArray(RUNTIME_VALUE_SAFETY_LIMITS.maxDepth), snapshot),
    ).toMatchObject({ status: "resolved" });
    expect(
      resolveRuntimeValue(nestedArray(RUNTIME_VALUE_SAFETY_LIMITS.maxDepth + 1), snapshot),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    const amplificationInput = createSnapshotInput();
    (amplificationInput.state as Record<string, RuntimeValueSpec>).largeArray = new Array(
      1_000,
    ).fill(null);
    (amplificationInput.state as Record<string, RuntimeValueSpec>).largeText = "x".repeat(400_000);
    (amplificationInput.state as Record<string, RuntimeValueSpec>).deep = nestedArray(80);
    const amplificationSnapshot = createRuntimeResolutionSnapshot(amplificationInput);

    expect(
      resolveRuntimeValue(
        new Array(5).fill(null).map(() => ({ $ref: "state.largeArray" })),
        amplificationSnapshot,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(
      resolveRuntimeValue(
        new Array(3).fill(null).map(() => ({ $ref: "state.largeText" })),
        amplificationSnapshot,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    let deepReference: RuntimeValueSpec = { $ref: "state.deep" };
    for (let index = 0; index < 80; index += 1) deepReference = [deepReference];
    expect(resolveRuntimeValue(deepReference, amplificationSnapshot)).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
  });
});
