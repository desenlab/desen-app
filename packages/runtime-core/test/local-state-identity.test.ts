import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeNodeIdentity,
  createRuntimeResolutionSnapshot,
  disposeRuntimeSurfaceState,
  mountRuntimeSurfaceState,
  readRuntimeSurfaceState,
  reconcileRuntimeNodeIdentity,
  resolveRuntimeValue,
  writeRuntimeSurfaceState,
} from "../src/index.js";

import type {
  RuntimeNodeIdentity,
  RuntimeNodeIdentityCreationResult,
  RuntimeNodeIdentityDescriptor,
  RuntimeJsonObject,
  RuntimeSurfaceStateMountInput,
  RuntimeSurfaceStateMountResult,
  RuntimeSurfaceStateSnapshot,
} from "../src/index.js";

function profileSchema(): RuntimeJsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["enabled", "mode", "name"],
    properties: {
      enabled: { type: "boolean" },
      mode: { enum: ["basic", "advanced"] },
      name: { type: "string", minLength: 1 },
      nickname: { type: "string" },
      details: {
        type: "object",
        additionalProperties: false,
        required: ["level"],
        properties: { level: { type: "integer", minimum: 1 } },
      },
    },
    if: {
      properties: { mode: { const: "advanced" } },
      required: ["mode"],
    },
    then: { required: ["details"] },
  };
}

function stateInput(): RuntimeSurfaceStateMountInput {
  return {
    surfaceId: "account",
    state: {
      bag: {
        schema: { type: "object" },
        initial: {},
      },
      count: {
        schema: { type: "integer", minimum: 0 },
        initial: 0,
      },
      list: {
        schema: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
        initial: [{ name: "first" }],
      },
      marker: {
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["$ref"],
          properties: { $ref: { type: "string" } },
        },
        initial: { $ref: "state.remains-literal" },
      },
      profile: {
        schema: profileSchema(),
        initial: { enabled: false, mode: "basic", name: "Ada" },
      },
      "profile.name": {
        schema: { type: "string" },
        initial: "dotted-declaration",
      },
    },
  };
}

function mounted(
  input: RuntimeSurfaceStateMountInput = stateInput(),
): Extract<RuntimeSurfaceStateMountResult, { status: "mounted" }> {
  const result = mountRuntimeSurfaceState(input);
  expect(result.status).toBe("mounted");
  if (result.status !== "mounted") throw new Error("Expected mounted surface state.");
  return result;
}

function createdIdentity(
  descriptor: RuntimeNodeIdentityDescriptor = {
    documentId: "com.desen.account",
    surfaceId: "account",
    nodeId: "account.submit",
    use: "com.desen.ui/Button",
  },
): RuntimeNodeIdentity {
  const result: RuntimeNodeIdentityCreationResult = createRuntimeNodeIdentity(descriptor);
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("Expected created identity.");
  return result.identity;
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("surface-local state mount and read", () => {
  it("mounts all initials atomically as detached, frozen generation-zero values", () => {
    const input = stateInput();
    const result = mounted(input);

    expect(result.snapshot.surfaceId).toBe("account");
    expect(result.snapshot.generation).toBe(0);
    expect(result.snapshot.values).toEqual({
      bag: {},
      count: 0,
      list: [{ name: "first" }],
      marker: { $ref: "state.remains-literal" },
      profile: { enabled: false, mode: "basic", name: "Ada" },
      "profile.name": "dotted-declaration",
    });
    expectRecursivelyFrozen(result);
    expect(readRuntimeSurfaceState(result.handle)).toEqual({
      status: "active",
      snapshot: result.snapshot,
    });

    const profileEntry = input.state.profile;
    const listEntry = input.state.list;
    if (profileEntry === undefined || listEntry === undefined) {
      throw new Error("Expected complete state fixture.");
    }
    (profileEntry.initial as { name: string }).name = "caller mutation";
    const firstListItem = (listEntry.initial as { name: string }[])[0];
    if (firstListItem === undefined) throw new Error("Expected list fixture item.");
    firstListItem.name = "caller mutation";
    expect(result.snapshot.values.profile).toEqual({
      enabled: false,
      mode: "basic",
      name: "Ada",
    });
    expect(result.snapshot.values.list).toEqual([{ name: "first" }]);
  });

  it("feeds its values directly into the existing seven-namespace resolver", () => {
    const result = mounted();
    const resolution = createRuntimeResolutionSnapshot({
      state: result.snapshot.values,
      context: {},
      resource: {},
      operation: {},
      event: { status: "unavailable" },
      item: {},
      env: { platform: "web" },
    });

    expect(resolveRuntimeValue({ $ref: "state.profile.name" }, resolution)).toEqual({
      status: "resolved",
      value: "Ada",
      usedFallback: false,
    });
  });

  it("creates independent fresh lifetimes and never restores a prior generation", () => {
    const first = mounted();
    const update = writeRuntimeSurfaceState(first.handle, { path: "count", value: 3 });
    expect(update.status).toBe("updated");

    const second = mounted();
    expect(second.handle).not.toBe(first.handle);
    expect(second.snapshot).not.toBe(first.snapshot);
    expect(second.snapshot.values.count).toBe(0);
    expect(second.snapshot.generation).toBe(0);
  });

  it("rejects one bad declaration without exposing a partial handle or snapshot", () => {
    const invalidInitial = mountRuntimeSurfaceState({
      surfaceId: "account",
      state: {
        acceptedFirst: { schema: { type: "string" }, initial: "valid" },
        rejectedSecond: { schema: { type: "integer" }, initial: "wrong" },
      },
    });
    expect(invalidInitial).toMatchObject({
      status: "invalid",
      reason: "invalid-initial-value",
      entryName: "rejectedSecond",
      pointer: "/state/rejectedSecond/initial",
    });
    expect(invalidInitial).not.toHaveProperty("handle");
    expect(invalidInitial).not.toHaveProperty("snapshot");

    const invalidSchema = mountRuntimeSurfaceState({
      surfaceId: "account",
      state: {
        broken: {
          schema: { $ref: "https://remote.invalid/schema" },
          initial: null,
        },
      },
    });
    expect(invalidSchema).toMatchObject({
      status: "invalid",
      reason: "invalid-state-schema",
      entryName: "broken",
    });
    if (invalidSchema.status !== "invalid") throw new Error("Expected invalid state schema.");
    expect(invalidSchema.issues.length).toBeGreaterThan(0);
  });

  it.each([
    ["non-string type", { type: 42 }],
    ["non-array required", { required: "name" }],
    ["non-object properties", { properties: [] }],
    ["negative minimum length", { minLength: -1 }],
    ["different dialect", { $schema: "https://json-schema.org/draft/2019-09/schema" }],
  ])("rejects invalid Draft 2020-12 schema syntax: %s", (_label, schema) => {
    const result = mountRuntimeSurfaceState({
      surfaceId: "account",
      state: { invalid: { schema: schema as never, initial: null } },
    });
    expect(result).toMatchObject({
      status: "invalid",
      reason: "invalid-state-schema",
      entryName: "invalid",
    });
    if (result.status !== "invalid") throw new Error("Expected invalid schema syntax.");
    expect(result.issues).not.toHaveLength(0);
    expect(result.issues[0]?.kind).toBe("syntax");
  });

  it("rejects every schema vocabulary declaration instead of silently weakening assertions", () => {
    const vocabularySchemas: RuntimeJsonObject[] = [
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $vocabulary: {
          "https://json-schema.org/draft/2020-12/vocab/format-assertion": true,
        },
        type: "string",
        format: "email",
      },
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $vocabulary: { "not an absolute vocabulary URI": true },
        type: "string",
      },
    ];

    for (const schema of vocabularySchemas) {
      const result = mountRuntimeSurfaceState({
        surfaceId: "account",
        state: { guarded: { schema, initial: "not-an-email" } },
      });
      expect(result).toMatchObject({
        status: "invalid",
        reason: "invalid-state-schema",
        entryName: "guarded",
        issues: [{ kind: "profile", pointer: "/$vocabulary", keyword: "$vocabulary" }],
      });
      expect(result).not.toHaveProperty("handle");
    }
  });

  it("contains hostile mount data without invoking accessors", () => {
    const getter = vi.fn(() => ({ type: "string" }));
    const entry: Record<string, unknown> = { initial: "safe" };
    Object.defineProperty(entry, "schema", { enumerable: true, get: getter });

    const result = mountRuntimeSurfaceState({
      surfaceId: "account",
      state: { hostile: entry },
    } as unknown as RuntimeSurfaceStateMountInput);
    expect(result).toMatchObject({
      status: "invalid",
      reason: "unsafe-or-unbounded-input",
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects the frozen-pattern backtracking adversary through a linear capability parser", () => {
    expect(
      createRuntimeNodeIdentity({
        documentId: "com.desen.account",
        surfaceId: "account",
        nodeId: "account.submit",
        use: `${"a.".repeat(80)}/`,
      }),
    ).toEqual({
      status: "invalid",
      reason: "malformed-capability-id",
      pointer: "/use",
    });
  });
});

describe("atomic schema-safe surface-state writes", () => {
  it("supports complete replacements, nested writes, and schema-approved final property creation", () => {
    const state = mounted();

    const nested = writeRuntimeSurfaceState(state.handle, {
      path: "profile.name",
      value: "Grace",
    });
    expect(nested.status).toBe("updated");
    if (nested.status !== "updated") throw new Error("Expected nested update.");
    expect(nested.snapshot.generation).toBe(1);
    expect(nested.snapshot.values.profile).toEqual({
      enabled: false,
      mode: "basic",
      name: "Grace",
    });
    expect(state.snapshot.values.profile).toEqual({
      enabled: false,
      mode: "basic",
      name: "Ada",
    });

    const optional = writeRuntimeSurfaceState(state.handle, {
      path: "profile.nickname",
      value: "",
    });
    expect(optional.status).toBe("updated");
    if (optional.status !== "updated") throw new Error("Expected optional-property update.");
    expect(optional.snapshot.values.profile).toMatchObject({ nickname: "" });

    const root = writeRuntimeSurfaceState(state.handle, {
      path: "profile",
      value: {
        details: { level: 2 },
        enabled: true,
        mode: "advanced",
        name: "Lin",
      },
    });
    expect(root.status).toBe("updated");
    if (root.status !== "updated") throw new Error("Expected root replacement.");
    expect(root.snapshot.generation).toBe(3);
    expect(root.snapshot.values.profile).toEqual({
      details: { level: 2 },
      enabled: true,
      mode: "advanced",
      name: "Lin",
    });
  });

  it("treats ValueSpec-looking objects and prototype-sensitive names as inert resolved JSON", () => {
    const state = mounted();
    const marker = writeRuntimeSurfaceState(state.handle, {
      path: "marker",
      value: { $ref: "context.not-evaluated" },
    });
    expect(marker.status).toBe("updated");

    for (const [path, value] of [
      ["bag.__proto__", { safe: true }],
      ["bag.constructor", "data"],
      ["bag.ui:mode", false],
      ["bag.0", 0],
      ["bag.empty-value", ""],
    ] as const) {
      expect(writeRuntimeSurfaceState(state.handle, { path, value }).status).toBe("updated");
    }

    const read = readRuntimeSurfaceState(state.handle);
    expect(read.status).toBe("active");
    if (read.status !== "active") throw new Error("Expected active state.");
    const bag = read.snapshot.values.bag;
    expect(typeof bag).toBe("object");
    expect(Object.hasOwn(bag as object, "__proto__")).toBe(true);
    expect((bag as Record<string, unknown>).__proto__).toEqual({ safe: true });
    expect(Object.getPrototypeOf(bag)).toBe(Object.prototype);
  });

  it("checks the complete post-write entry and leaves the current snapshot byte-identical on failure", () => {
    const state = mounted();
    const before = readRuntimeSurfaceState(state.handle);
    expect(before.status).toBe("active");
    if (before.status !== "active") throw new Error("Expected active state.");

    const conditionalFailure = writeRuntimeSurfaceState(state.handle, {
      path: "profile.mode",
      value: "advanced",
    });
    expect(conditionalFailure).toMatchObject({
      status: "rejected",
      code: "STATE_WRITE_INVALID",
      reason: "schema-mismatch",
      path: "profile.mode",
    });
    if (conditionalFailure.status !== "rejected") throw new Error("Expected rejected write.");
    expect(conditionalFailure.issues).toContainEqual({
      kind: "mismatch",
      pointer: "/details",
      keyword: "required",
    });

    const after = readRuntimeSurfaceState(state.handle);
    expect(after).toEqual(before);
    if (after.status !== "active") throw new Error("Expected active state.");
    expect(after.snapshot).toBe(before.snapshot);
    expect(after.snapshot.generation).toBe(0);
  });

  it("uses the first dot segment without longest-prefix matching", () => {
    const state = mounted();
    const result = writeRuntimeSurfaceState(state.handle, {
      path: "profile.name",
      value: "prefix-child",
    });
    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("Expected prefix-child update.");
    expect(result.snapshot.values.profile).toMatchObject({ name: "prefix-child" });
    expect(result.snapshot.values["profile.name"]).toBe("dotted-declaration");

    const dottedOnly = mounted({
      surfaceId: "account",
      state: {
        "profile.name": { schema: { type: "string" }, initial: "dotted" },
      },
    });
    expect(
      writeRuntimeSurfaceState(dottedOnly.handle, {
        path: "profile.name",
        value: "unreachable",
      }),
    ).toMatchObject({
      status: "rejected",
      reason: "unknown-state",
      code: "STATE_WRITE_INVALID",
    });
  });

  it.each([
    ["missing intermediate", "bag.missing.child", "missing-parent"],
    ["array traversal", "list.0.name", "non-object-parent"],
    ["unknown root", "unknown.value", "unknown-state"],
    ["empty segment", "bag..value", "malformed-path"],
    ["trailing segment", "bag.", "malformed-path"],
  ])("rejects %s without partial state", (_label, path, reason) => {
    const state = mounted();
    const before = state.snapshot;
    expect(writeRuntimeSurfaceState(state.handle, { path, value: "x" })).toMatchObject({
      status: "rejected",
      code: "STATE_WRITE_INVALID",
      reason,
      path,
    });
    expect(readRuntimeSurfaceState(state.handle)).toEqual({
      status: "active",
      snapshot: before,
    });
  });

  it("rejects unsafe write requests without invoking accessors or retaining candidates", () => {
    const state = mounted();
    const getter = vi.fn(() => "count");
    const accessor = { value: 1 };
    Object.defineProperty(accessor, "path", { enumerable: true, get: getter });
    expect(
      writeRuntimeSurfaceState(
        state.handle,
        accessor as unknown as { path: string; value: number },
      ),
    ).toMatchObject({
      status: "rejected",
      reason: "unsafe-or-unbounded-value",
      path: null,
    });
    expect(getter).not.toHaveBeenCalled();

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(
      writeRuntimeSurfaceState(state.handle, {
        path: "bag",
        value: cyclic as never,
      }),
    ).toMatchObject({
      status: "rejected",
      reason: "unsafe-or-unbounded-value",
    });

    expect(
      writeRuntimeSurfaceState(state.handle, {
        path: "bag",
        value: "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1),
      }),
    ).toMatchObject({
      status: "rejected",
      reason: "unsafe-or-unbounded-value",
    });
    expect(readRuntimeSurfaceState(state.handle)).toEqual({
      status: "active",
      snapshot: state.snapshot,
    });
  });

  it("returns unchanged for canonically identical data and does not advance generation", () => {
    const state = mounted();
    const first = writeRuntimeSurfaceState(state.handle, {
      path: "bag",
      value: { z: 2, a: 1 },
    });
    expect(first.status).toBe("updated");
    if (first.status !== "updated") throw new Error("Expected first update.");

    const reordered = writeRuntimeSurfaceState(state.handle, {
      path: "bag",
      value: { a: 1, z: 2 },
    });
    expect(reordered).toEqual({ status: "unchanged", snapshot: first.snapshot });
    if (reordered.status !== "unchanged") throw new Error("Expected no-op.");
    expect(reordered.snapshot).toBe(first.snapshot);
    expect(reordered.snapshot.generation).toBe(1);

    const negativeZero = writeRuntimeSurfaceState(state.handle, { path: "count", value: -0 });
    expect(negativeZero.status).toBe("unchanged");
  });
});

describe("surface-state disposal", () => {
  it("is terminal and idempotent while a fresh remount restarts from exact initials", () => {
    const state = mounted();
    const historical: RuntimeSurfaceStateSnapshot = state.snapshot;
    expect(disposeRuntimeSurfaceState(state.handle)).toEqual({
      status: "disposed",
      surfaceId: "account",
    });
    expect(readRuntimeSurfaceState(state.handle)).toEqual({
      status: "disposed",
      surfaceId: "account",
    });
    expect(writeRuntimeSurfaceState(state.handle, { path: "count", value: 1 })).toEqual({
      status: "disposed",
      surfaceId: "account",
    });
    expect(disposeRuntimeSurfaceState(state.handle)).toEqual({
      status: "already-disposed",
      surfaceId: "account",
    });

    // Historical caller-retained snapshots are immutable observations, not live authority.
    expect(historical.values.count).toBe(0);
    const remounted = mounted();
    expect(remounted.snapshot.generation).toBe(0);
    expect(remounted.snapshot.values.count).toBe(0);
  });

  it("rejects forged handles without affecting a real lifetime", () => {
    const state = mounted();
    const forged = { surfaceId: "account" } as typeof state.handle;
    expect(readRuntimeSurfaceState(forged)).toEqual({
      status: "invalid",
      reason: "forged-handle",
    });
    expect(disposeRuntimeSurfaceState(forged)).toEqual({
      status: "invalid",
      reason: "forged-handle",
    });
    expect(readRuntimeSurfaceState(state.handle).status).toBe("active");
  });
});

describe("stable non-repeated node identity", () => {
  it("uses a structured document/surface/node tuple and excludes revision and capability", () => {
    const first = createdIdentity();
    const sameTupleOtherCapability = createdIdentity({
      documentId: first.documentId,
      surfaceId: first.surfaceId,
      nodeId: first.nodeId,
      use: "com.desen.ui/Link",
    });

    expect(JSON.parse(first.key)).toEqual(["com.desen.account", "account", "account.submit"]);
    expect(first.key).toBe(sameTupleOtherCapability.key);
    expect(first.mountGeneration).toBe(0);
    expectRecursivelyFrozen(first);
  });

  it("preserves the exact identity when the tuple and capability stay compatible", () => {
    const identity = createdIdentity();
    const result = reconcileRuntimeNodeIdentity(identity, {
      documentId: identity.documentId,
      surfaceId: identity.surfaceId,
      nodeId: identity.nodeId,
      use: identity.use,
    });
    expect(result).toEqual({ status: "preserve-eligible", identity });
    if (result.status !== "preserve-eligible") throw new Error("Expected preservation.");
    expect(result.identity).toBe(identity);
  });

  it("requires a new mount generation when use changes under the same stable identity", () => {
    const identity = createdIdentity();
    const changed = reconcileRuntimeNodeIdentity(identity, {
      documentId: identity.documentId,
      surfaceId: identity.surfaceId,
      nodeId: identity.nodeId,
      use: "com.desen.ui/Link",
    });
    expect(changed.status).toBe("remount-required");
    if (changed.status !== "remount-required") throw new Error("Expected remount.");
    expect(changed.reason).toBe("capability-changed");
    expect(changed.identity.key).toBe(identity.key);
    expect(changed.identity.mountGeneration).toBe(1);
    expect(changed.identity).not.toBe(identity);
  });

  it.each([
    ["document", { documentId: "com.desen.other" }],
    ["surface", { surfaceId: "other" }],
    ["node", { nodeId: "account.cancel" }],
  ])("requires replacement when the %s identity field changes", (_label, patch) => {
    const identity = createdIdentity();
    const result = reconcileRuntimeNodeIdentity(identity, {
      documentId: identity.documentId,
      surfaceId: identity.surfaceId,
      nodeId: identity.nodeId,
      use: identity.use,
      ...patch,
    });
    expect(result.status).toBe("replace-required");
    if (result.status !== "replace-required") throw new Error("Expected replacement.");
    expect(result.reason).toBe("identity-changed");
    expect(result.previousIdentity).toBe(identity);
    expect(result.nextIdentity.key).not.toBe(identity.key);
    expect(result.nextIdentity.mountGeneration).toBe(0);
  });

  it("uses exact string identity and rejects forged or expanded descriptors", () => {
    const identity = createdIdentity();
    const caseChanged = reconcileRuntimeNodeIdentity(identity, {
      documentId: identity.documentId,
      surfaceId: "Account",
      nodeId: identity.nodeId,
      use: identity.use,
    });
    expect(caseChanged.status).toBe("replace-required");

    expect(
      reconcileRuntimeNodeIdentity({ ...identity } as RuntimeNodeIdentity, {
        documentId: identity.documentId,
        surfaceId: identity.surfaceId,
        nodeId: identity.nodeId,
        use: identity.use,
      }),
    ).toEqual({
      status: "invalid",
      reason: "forged-identity",
      pointer: "",
    });

    expect(
      createRuntimeNodeIdentity({
        documentId: identity.documentId,
        surfaceId: identity.surfaceId,
        nodeId: identity.nodeId,
        use: identity.use,
        revision: `sha256:${"a".repeat(64)}`,
      } as RuntimeNodeIdentityDescriptor),
    ).toEqual({
      status: "invalid",
      reason: "malformed-descriptor",
      pointer: "",
    });
  });

  it("copies descriptors without invoking hostile accessors", () => {
    const getter = vi.fn(() => "account");
    const descriptor: Record<string, unknown> = {
      documentId: "com.desen.account",
      nodeId: "account.submit",
      use: "com.desen.ui/Button",
    };
    Object.defineProperty(descriptor, "surfaceId", {
      enumerable: true,
      get: getter,
    });
    expect(
      createRuntimeNodeIdentity(descriptor as unknown as RuntimeNodeIdentityDescriptor),
    ).toEqual({
      status: "invalid",
      reason: "unsafe-or-unbounded-descriptor",
      pointer: "",
    });
    expect(getter).not.toHaveBeenCalled();
  });
});
