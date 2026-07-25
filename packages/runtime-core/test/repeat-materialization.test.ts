import { describe, expect, it } from "vitest";

import {
  RUNTIME_REPEAT_LIMITS,
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeRepeatRootScope,
  createRuntimeRepeatedNodeIdentity,
  createRuntimeResolutionSnapshot,
  createRuntimeResolutionSnapshotForRepeatScope,
  materializeRuntimeRepeat,
  reconcileRuntimeRepeatedNodeIdentity,
  resolveRuntimeValue,
} from "../src/index.js";

import type {
  RuntimeJsonValue,
  RuntimeNodeIdentityDescriptor,
  RuntimeRepeatMaterialized,
  RuntimeRepeatScope,
  RuntimeRepeatSpec,
  RuntimeRepeatedNodeIdentity,
  RuntimeResolutionSnapshot,
} from "../src/index.js";

function snapshot(
  resourceValue: RuntimeJsonValue = [
    { id: "b", title: "Beta" },
    { id: "a", title: "Alpha" },
  ],
): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state: {},
    context: { fallbackKey: "fallback" },
    resource: {
      tasks: {
        status: "succeeded",
        pending: false,
        value: resourceValue,
      },
    },
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { platform: "web" },
  });
}

function repeat(
  items: RuntimeRepeatSpec["items"] = { $ref: "resource.tasks.value" },
  alias = "task",
  key: RuntimeRepeatSpec["key"] = { $ref: "item.task.id" },
  limit?: number,
): RuntimeRepeatSpec {
  return {
    items,
    as: alias,
    key,
    ...(limit === undefined ? {} : { limit }),
  };
}

function materialized(
  scope: RuntimeRepeatScope = createRuntimeRepeatRootScope(snapshot()),
  spec: RuntimeRepeatSpec = repeat(),
): RuntimeRepeatMaterialized {
  const result = materializeRuntimeRepeat(scope, spec);
  expect(result.status).toBe("materialized");
  if (result.status !== "materialized") {
    throw new Error(`Expected materialized repeat, received ${result.status}.`);
  }
  return result;
}

function identityDescriptor(use = "com.desen.ui/Text"): RuntimeNodeIdentityDescriptor {
  return {
    documentId: "com.desen.tasks",
    surfaceId: "tasks",
    nodeId: "tasks.item",
    use,
  };
}

function repeatedIdentity(
  scope: RuntimeRepeatScope,
  descriptor = identityDescriptor(),
): RuntimeRepeatedNodeIdentity {
  const result = createRuntimeRepeatedNodeIdentity(descriptor, scope);
  expect(result.status).toBe("created");
  if (result.status !== "created") {
    throw new Error("Expected repeated identity creation.");
  }
  return result.identity;
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("repeat scope and ordered materialization", () => {
  it("creates a branded root only from a real snapshot with an empty item namespace", () => {
    const root = createRuntimeRepeatRootScope(snapshot());
    expect(root.aliasOrder).toEqual([]);
    expect(root.repeatKeys).toEqual([]);
    expect(root.aliases).toEqual({});
    expectRecursivelyFrozen(root);

    expect(() =>
      createRuntimeRepeatRootScope({
        state: {},
        context: {},
        resource: {},
        operation: {},
        event: { status: "unavailable" },
        item: {},
        env: {},
      } as RuntimeResolutionSnapshot),
    ).toThrow(TypeError);

    const activeItemSnapshot = createRuntimeResolutionSnapshot({
      state: {},
      context: {},
      resource: {},
      operation: {},
      event: { status: "unavailable" },
      item: { outer: 1 },
      env: {},
    });
    expect(() => createRuntimeRepeatRootScope(activeItemSnapshot)).toThrow("empty item namespace");
  });

  it("resolves items before introducing the repeat's own alias", () => {
    const result = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat({ $ref: "item.task.children" }),
    );
    expect(result).toEqual({
      status: "invalid",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/items/$ref",
      reason: "items-unresolved",
    });
  });

  it("preserves source-array order instead of sorting by key", () => {
    const result = materialized();
    expect(result.instances.map(({ index, key }) => ({ index, key }))).toEqual([
      { index: 0, key: "b" },
      { index: 1, key: "a" },
    ]);
    expect(result.effectiveLimit).toBe(RUNTIME_REPEAT_LIMITS.maxInstancesPerRepeat);
  });

  it("exposes each alias only in its own child scope without sibling or root leakage", () => {
    const root = createRuntimeRepeatRootScope(snapshot());
    const result = materialized(root);
    const first = result.instances[0];
    const second = result.instances[1];
    if (first === undefined || second === undefined) {
      throw new Error("Expected two repeat instances.");
    }

    const firstSnapshot = createRuntimeResolutionSnapshotForRepeatScope(first.scope);
    const secondSnapshot = createRuntimeResolutionSnapshotForRepeatScope(second.scope);
    expect(resolveRuntimeValue({ $ref: "item.task.title" }, firstSnapshot)).toMatchObject({
      status: "resolved",
      value: "Beta",
    });
    expect(resolveRuntimeValue({ $ref: "item.task.title" }, secondSnapshot)).toMatchObject({
      status: "resolved",
      value: "Alpha",
    });
    expect(root.aliases).toEqual({});
    expect(first.scope.aliases.task).not.toBe(second.scope.aliases.task);
  });

  it("lets a nested repeat see outer aliases and extends the key path outer-to-inner", () => {
    const root = createRuntimeRepeatRootScope(
      snapshot([
        {
          id: "group-a",
          rows: [
            { id: 2, title: "Second" },
            { id: 1, title: "First" },
          ],
        },
      ]),
    );
    const outer = materialized(
      root,
      repeat({ $ref: "resource.tasks.value" }, "group", {
        $ref: "item.group.id",
      }),
    );
    const outerInstance = outer.instances[0];
    if (outerInstance === undefined) throw new Error("Expected outer instance.");

    const inner = materialized(
      outerInstance.scope,
      repeat({ $ref: "item.group.rows" }, "row", { $ref: "item.row.id" }),
    );
    expect(inner.instances.map(({ key }) => key)).toEqual([2, 1]);
    expect(inner.instances[0]?.scope.aliasOrder).toEqual(["group", "row"]);
    expect(inner.instances[0]?.scope.repeatKeys).toEqual(["group-a", 2]);

    const nestedSnapshot = createRuntimeResolutionSnapshotForRepeatScope(
      inner.instances[0]?.scope as RuntimeRepeatScope,
    );
    expect(resolveRuntimeValue({ $ref: "item.group.id" }, nestedSnapshot)).toMatchObject({
      status: "resolved",
      value: "group-a",
    });
    expect(resolveRuntimeValue({ $ref: "item.row.title" }, nestedSnapshot)).toMatchObject({
      status: "resolved",
      value: "Second",
    });
  });

  it("rejects active alias shadowing while disjoint siblings may reuse the alias", () => {
    const outer = materialized(
      createRuntimeRepeatRootScope(snapshot([{ id: "outer", rows: [{ id: "inner" }] }])),
      repeat({ $ref: "resource.tasks.value" }, "row", { $ref: "item.row.id" }),
    );
    const outerScope = outer.instances[0]?.scope;
    if (outerScope === undefined) throw new Error("Expected outer scope.");

    expect(
      materializeRuntimeRepeat(outerScope, repeat({ $ref: "item.row.rows" }, "row", "inner")),
    ).toEqual({
      status: "invalid",
      code: "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      pointer: "/as",
      reason: "active-alias-collision",
    });

    const root = createRuntimeRepeatRootScope(snapshot());
    expect(materializeRuntimeRepeat(root, repeat([], "row", "unused")).status).toBe("materialized");
    expect(materializeRuntimeRepeat(root, repeat([], "row", "unused")).status).toBe("materialized");
  });

  it("accepts scalar items and resolves the alias root directly", () => {
    const result = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(["alpha", 2], "row", { $ref: "item.row" }),
    );
    expect(result.instances.map(({ key }) => key)).toEqual(["alpha", 2]);
  });

  it("treats prototype-sensitive alias names as ordinary isolated data", () => {
    for (const alias of ["__proto__", "constructor"]) {
      const result = materialized(
        createRuntimeRepeatRootScope(snapshot()),
        repeat([{ id: alias }], alias, { $ref: `item.${alias}.id` }),
      );
      const instance = result.instances[0];
      if (instance === undefined) throw new Error("Expected prototype-safe instance.");
      expect(instance.key).toBe(alias);
      expect(Object.getPrototypeOf(instance.scope.aliases)).toBeNull();
      expect(Object.hasOwn(instance.scope.aliases, alias)).toBe(true);
    }
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("materializes an empty repeat without evaluating its key", () => {
    const result = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([], "row", { $ref: "item.row.id" }),
    );
    expect(result.instances).toEqual([]);
  });
});

describe("repeat failures, deferral, and limits", () => {
  it("distinguishes non-array items from unresolved and deferred item values", () => {
    const root = createRuntimeRepeatRootScope(snapshot());
    expect(materializeRuntimeRepeat(root, repeat("not-an-array"))).toEqual({
      status: "invalid",
      code: "REPEAT_ITEMS_INVALID",
      pointer: "/items",
      reason: "items-not-array",
    });
    expect(
      materializeRuntimeRepeat(root, repeat({ $ref: "resource.missing.value" })),
    ).toMatchObject({
      status: "invalid",
      code: "REFERENCE_UNRESOLVED",
      pointer: "/items/$ref",
      reason: "items-unresolved",
    });
    expect(materializeRuntimeRepeat(root, repeat({ $token: "tasks" }))).toEqual({
      status: "deferred",
      form: "token",
      pointer: "/items/$token",
    });
  });

  it("does not let a fallback hide a resolved null items value", () => {
    const withNull = createRuntimeResolutionSnapshot({
      state: { selection: null },
      context: {},
      resource: {},
      operation: {},
      event: { status: "unavailable" },
      item: {},
      env: {},
    });
    expect(
      materializeRuntimeRepeat(
        createRuntimeRepeatRootScope(withNull),
        repeat({ $ref: "state.selection", fallback: [] }),
      ),
    ).toEqual({
      status: "invalid",
      code: "REPEAT_ITEMS_INVALID",
      pointer: "/items",
      reason: "items-not-array",
    });
  });

  it.each([
    ["null", null],
    ["boolean", true],
    ["object", { id: "object" }],
    ["array", ["array"]],
  ] as const)("rejects a %s repeat key without partial instances", (_label, key) => {
    const result = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "accepted" }, { id: "rejected" }], "row", key),
    );
    expect(result).toMatchObject({
      status: "invalid",
      code: "REPEAT_KEY_INVALID",
      pointer: "/key",
      reason: "key-not-scalar",
      itemIndex: 0,
    });
    expect("instances" in result).toBe(false);
  });

  it("rejects a missing key at its exact item without exposing earlier successes", () => {
    const result = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "accepted" }, {}], "row", { $ref: "item.row.id" }),
    );
    expect(result).toEqual({
      status: "invalid",
      code: "REPEAT_KEY_INVALID",
      pointer: "/key",
      reason: "key-unresolved",
      itemIndex: 1,
    });
    expect("instances" in result).toBe(false);
  });

  it("uses a valid fallback for a missing item key", () => {
    const result = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{}, { id: "second" }], "row", {
        $ref: "item.row.id",
        fallback: { $ref: "context.fallbackKey" },
      }),
    );
    expect(result.instances.map(({ key }) => key)).toEqual(["fallback", "second"]);
  });

  it("keeps numeric and string keys distinct while canonicalizing negative zero", () => {
    const distinct = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: 1 }, { id: "1" }], "row", { $ref: "item.row.id" }),
    );
    expect(distinct.instances.map(({ keyIdentity }) => keyIdentity)).toEqual(["1", '"1"']);

    const duplicate = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: -0 }, { id: 0 }], "row", { $ref: "item.row.id" }),
    );
    expect(duplicate).toMatchObject({
      status: "invalid",
      code: "REPEAT_KEY_INVALID",
      reason: "duplicate-key",
      itemIndex: 1,
    });
  });

  it("defers token and format keys at the exact key location", () => {
    const token = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "a" }], "row", { $token: "identity" }),
    );
    expect(token).toEqual({
      status: "deferred",
      form: "token",
      pointer: "/key/$token",
      itemIndex: 0,
    });

    const format = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "a" }], "row", {
        $format: { template: "{id}", values: { id: { $ref: "item.row.id" } } },
      }),
    );
    expect(format).toEqual({
      status: "deferred",
      form: "format",
      pointer: "/key/$format",
      itemIndex: 0,
    });
  });

  it("structurally rejects a malformed key even when the item array is empty", () => {
    const result = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([], "row", { $token: "" }),
    );
    expect(result).toEqual({
      status: "invalid",
      code: "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      pointer: "/key/$token",
      reason: "malformed-token",
    });
  });

  it("accepts the exact explicit limit and rejects limit plus one without truncation", () => {
    const exact = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(["a", "b"], "row", { $ref: "item.row" }, 2),
    );
    expect(exact.instances).toHaveLength(2);
    expect(exact.effectiveLimit).toBe(2);

    const overflow = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(["a", "b", "c"], "row", { $ref: "item.row" }, 2),
    );
    expect(overflow).toEqual({
      status: "limit-exceeded",
      code: "run.desen.runtime/REPEAT_LIMIT_EXCEEDED",
      pointer: "/limit",
      reason: "declared-limit",
      limit: 2,
      observed: 3,
    });
    expect("instances" in overflow).toBe(false);

    const schemaIntegerAboveSafeRange = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(["a"], "row", { $ref: "item.row" }, 1e20),
    );
    expect(schemaIntegerAboveSafeRange.effectiveLimit).toBe(1_000);
  });

  it("enforces the exact 1,000-instance profile ceiling", () => {
    const acceptedItems = Array.from(
      { length: RUNTIME_REPEAT_LIMITS.maxInstancesPerRepeat },
      (_, index) => index,
    );
    const accepted = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(acceptedItems, "row", { $ref: "item.row" }),
    );
    expect(accepted.instances).toHaveLength(1_000);

    const rejected = materializeRuntimeRepeat(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([...acceptedItems, 1_000], "row", { $ref: "item.row" }),
    );
    expect(rejected).toEqual({
      status: "limit-exceeded",
      code: "run.desen.runtime/REPEAT_LIMIT_EXCEEDED",
      pointer: "/limit",
      reason: "profile-limit",
      limit: 1_000,
      observed: 1_001,
    });
  });

  it("rejects malformed, accessor-backed, sparse, cyclic, and decorated input", () => {
    const root = createRuntimeRepeatRootScope(snapshot());
    const accessor = {
      as: "row",
      get items(): RuntimeJsonValue {
        throw new Error("must not execute");
      },
      key: "key",
    };
    expect(materializeRuntimeRepeat(root, accessor as RuntimeRepeatSpec)).toMatchObject({
      status: "invalid",
      reason: "malformed-repeat",
    });

    const sparse = new Array<RuntimeJsonValue>(2);
    sparse[0] = "first";
    expect(materializeRuntimeRepeat(root, repeat(sparse, "row", "key"))).toMatchObject({
      status: "invalid",
      reason: "malformed-repeat",
    });

    const decorated = ["first"] as RuntimeJsonValue[] & { extra?: string };
    decorated.extra = "rejected";
    expect(materializeRuntimeRepeat(root, repeat(decorated, "row", "key"))).toMatchObject({
      status: "invalid",
      reason: "malformed-repeat",
    });

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(
      materializeRuntimeRepeat(root, repeat(cyclic as RuntimeValueForTest, "row", "key")),
    ).toMatchObject({
      status: "invalid",
      reason: "malformed-repeat",
    });
  });

  it("detaches caller input and recursively freezes successful output", () => {
    const items = [{ id: "a", nested: { value: 1 } }];
    const result = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(items, "row", { $ref: "item.row.id" }),
    );
    const callerItem = items[0];
    if (callerItem === undefined) throw new Error("Expected caller item.");
    callerItem.id = "mutated";
    callerItem.nested.value = 2;

    const child = result.instances[0];
    if (child === undefined) throw new Error("Expected child.");
    const childSnapshot = createRuntimeResolutionSnapshotForRepeatScope(child.scope);
    expect(resolveRuntimeValue({ $ref: "item.row.id" }, childSnapshot)).toMatchObject({
      status: "resolved",
      value: "a",
    });
    expectRecursivelyFrozen(result);
  });

  it("rejects forged scopes without throwing or exposing a partial result", () => {
    const result = materializeRuntimeRepeat({} as RuntimeRepeatScope, repeat());
    expect(result).toEqual({
      status: "invalid",
      code: "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      pointer: "",
      reason: "forged-scope",
    });
    expect(() => createRuntimeResolutionSnapshotForRepeatScope({} as RuntimeRepeatScope)).toThrow(
      TypeError,
    );
  });

  it("turns aggregate child-scope budget overflow into a controlled result", () => {
    function paddedSnapshot(length: number): RuntimeResolutionSnapshot {
      return createRuntimeResolutionSnapshot({
        state: { padding: "x".repeat(length) },
        context: {},
        resource: {},
        operation: {},
        event: { status: "unavailable" },
        item: {},
        env: {},
      });
    }

    let accepted = 0;
    let low = 0;
    let high = RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits;
    while (low <= high) {
      const candidate = Math.floor((low + high) / 2);
      try {
        paddedSnapshot(candidate);
        accepted = candidate;
        low = candidate + 1;
      } catch {
        high = candidate - 1;
      }
    }

    const root = createRuntimeRepeatRootScope(paddedSnapshot(accepted));
    expect(materializeRuntimeRepeat(root, repeat([], "row", { $ref: "item.row" }))).toMatchObject({
      status: "materialized",
      instances: [],
    });
    const evaluate = (): unknown =>
      materializeRuntimeRepeat(root, repeat(["a"], "row", { $ref: "item.row" }));
    expect(evaluate).not.toThrow();
    expect(evaluate()).toMatchObject({
      status: "invalid",
      code: "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      reason: "unsafe-or-unbounded-json",
      itemIndex: 0,
    });
  });
});

type RuntimeValueForTest = RuntimeRepeatSpec["items"];

describe("repeated node identity", () => {
  it("creates a canonical identity from the base tuple and complete key path", () => {
    const instance = materialized().instances[0];
    if (instance === undefined) throw new Error("Expected instance.");
    const identity = repeatedIdentity(instance.scope);

    expect(identity.repeatKeys).toEqual(["b"]);
    expect(identity.key).toBe('["com.desen.tasks","tasks","tasks.item",["b"]]');
    expect(identity.use).toBe("com.desen.ui/Text");
    expect(identity.mountGeneration).toBe(0);
    expectRecursivelyFrozen(identity);
  });

  it("preserves exact identity across reorder and ignores array index", () => {
    const first = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(
        [
          { id: "a", title: "First" },
          { id: "b", title: "Second" },
        ],
        "row",
        { $ref: "item.row.id" },
      ),
    );
    const firstA = first.instances[0];
    if (firstA === undefined) throw new Error("Expected first A.");
    const previous = repeatedIdentity(firstA.scope);

    const reordered = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat(
        [
          { id: "b", title: "Changed" },
          { id: "a", title: "Changed" },
        ],
        "renamedAlias",
        { $ref: "item.renamedAlias.id" },
      ),
    );
    const nextA = reordered.instances[1];
    if (nextA === undefined) throw new Error("Expected reordered A.");

    const decision = reconcileRuntimeRepeatedNodeIdentity(
      previous,
      identityDescriptor(),
      nextA.scope,
    );
    expect(decision).toEqual({
      status: "preserve-eligible",
      identity: previous,
    });
    if (decision.status === "preserve-eligible") {
      expect(decision.identity).toBe(previous);
    }
  });

  it("requires replacement when an own repeat key changes", () => {
    const first = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "a" }], "row", { $ref: "item.row.id" }),
    );
    const next = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "b" }], "row", { $ref: "item.row.id" }),
    );
    const previousScope = first.instances[0]?.scope;
    const nextScope = next.instances[0]?.scope;
    if (previousScope === undefined || nextScope === undefined) {
      throw new Error("Expected scopes.");
    }
    const previous = repeatedIdentity(previousScope);
    expect(
      reconcileRuntimeRepeatedNodeIdentity(previous, identityDescriptor(), nextScope),
    ).toMatchObject({
      status: "replace-required",
      reason: "identity-changed",
      previousIdentity: previous,
    });
  });

  it("resets mount generation when a key changes after an earlier capability remount", () => {
    const first = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "a" }], "row", { $ref: "item.row.id" }),
    );
    const firstScope = first.instances[0]?.scope;
    if (firstScope === undefined) throw new Error("Expected first scope.");
    const original = repeatedIdentity(firstScope);
    const remounted = reconcileRuntimeRepeatedNodeIdentity(
      original,
      identityDescriptor("com.desen.ui/Button"),
      firstScope,
    );
    if (remounted.status !== "remount-required") {
      throw new Error("Expected capability remount.");
    }
    expect(remounted.identity.mountGeneration).toBe(1);

    const next = materialized(
      createRuntimeRepeatRootScope(snapshot()),
      repeat([{ id: "b" }], "row", { $ref: "item.row.id" }),
    );
    const nextScope = next.instances[0]?.scope;
    if (nextScope === undefined) throw new Error("Expected next scope.");
    const replaced = reconcileRuntimeRepeatedNodeIdentity(
      remounted.identity,
      identityDescriptor("com.desen.ui/Button"),
      nextScope,
    );
    expect(replaced).toMatchObject({
      status: "replace-required",
      nextIdentity: { mountGeneration: 0 },
    });
  });

  it("requires replacement when an ancestor repeat key changes", () => {
    function nestedScope(outerKey: string): RuntimeRepeatScope {
      const outer = materialized(
        createRuntimeRepeatRootScope(snapshot()),
        repeat([{ id: outerKey, rows: [{ id: "same-inner" }] }], "group", {
          $ref: "item.group.id",
        }),
      );
      const outerScope = outer.instances[0]?.scope;
      if (outerScope === undefined) throw new Error("Expected outer scope.");
      const inner = materialized(
        outerScope,
        repeat({ $ref: "item.group.rows" }, "row", { $ref: "item.row.id" }),
      );
      const innerScope = inner.instances[0]?.scope;
      if (innerScope === undefined) throw new Error("Expected inner scope.");
      return innerScope;
    }

    const previous = repeatedIdentity(nestedScope("outer-a"));
    expect(
      reconcileRuntimeRepeatedNodeIdentity(previous, identityDescriptor(), nestedScope("outer-b")),
    ).toMatchObject({
      status: "replace-required",
      reason: "identity-changed",
    });
  });

  it("requires a remount on the same key path when capability changes", () => {
    const scope = materialized().instances[0]?.scope;
    if (scope === undefined) throw new Error("Expected scope.");
    const previous = repeatedIdentity(scope);

    const decision = reconcileRuntimeRepeatedNodeIdentity(
      previous,
      identityDescriptor("com.desen.ui/Button"),
      scope,
    );
    expect(decision).toMatchObject({
      status: "remount-required",
      reason: "capability-changed",
      identity: {
        key: previous.key,
        use: "com.desen.ui/Button",
        mountGeneration: 1,
      },
    });
  });

  it("requires replacement when the document, surface, or source node changes", () => {
    const scope = materialized().instances[0]?.scope;
    if (scope === undefined) throw new Error("Expected scope.");
    const previous = repeatedIdentity(scope);
    const decision = reconcileRuntimeRepeatedNodeIdentity(
      previous,
      { ...identityDescriptor(), nodeId: "tasks.other" },
      scope,
    );
    expect(decision).toMatchObject({
      status: "replace-required",
      reason: "identity-changed",
      previousIdentity: previous,
      nextIdentity: { mountGeneration: 0 },
    });
  });

  it("rejects root scopes, forged scopes, identities, and malformed descriptors", () => {
    const root = createRuntimeRepeatRootScope(snapshot());
    expect(createRuntimeRepeatedNodeIdentity(identityDescriptor(), root)).toEqual({
      status: "invalid",
      reason: "empty-repeat-path",
      pointer: "/scope",
    });
    expect(
      createRuntimeRepeatedNodeIdentity(identityDescriptor(), {} as RuntimeRepeatScope),
    ).toEqual({
      status: "invalid",
      reason: "forged-repeat-scope",
      pointer: "",
    });

    const scope = materialized(root).instances[0]?.scope;
    if (scope === undefined) throw new Error("Expected child scope.");
    expect(
      createRuntimeRepeatedNodeIdentity({ ...identityDescriptor(), nodeId: "" }, scope),
    ).toMatchObject({
      status: "invalid",
      reason: "malformed-node-id",
      pointer: "/node/nodeId",
    });
    expect(
      reconcileRuntimeRepeatedNodeIdentity(
        {} as RuntimeRepeatedNodeIdentity,
        identityDescriptor(),
        scope,
      ),
    ).toEqual({
      status: "invalid",
      reason: "forged-repeat-identity",
      pointer: "",
    });
  });
});
