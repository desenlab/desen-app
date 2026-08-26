import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  clearDesenEditorNodeCondition,
  createDesenEditorDocument,
  deleteDesenEditorOwnerProp,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantProp,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorVariant,
  reorderDesenEditorVariant,
  setDesenEditorNodeCondition,
  setDesenEditorOwnerProp,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorVariantCondition,
  setDesenEditorVariantProp,
  setDesenEditorVariantStyleProperty,
} from "../src/index.js";

import type {
  DesenEditorContentEditResult,
  DesenEditorContentPredicate,
  DesenEditorContentVariant,
  DesenEditorDocument,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

const DOCUMENT_LIMIT = 8_388_608;
const TRUE_PREDICATE = Object.freeze({
  op: "truthy",
  args: Object.freeze([true]),
}) satisfies DesenEditorContentPredicate;
const FALSE_PREDICATE = Object.freeze({
  op: "truthy",
  args: Object.freeze([false]),
}) satisfies DesenEditorContentPredicate;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a test-fixture object.");
  }
  return value as MutableRecord;
}

function createDocument(input: unknown = clone(validSource)): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  if (!result.ok) throw new TypeError("Expected a structurally valid editor fixture.");
  return result.document;
}

function successful(result: DesenEditorContentEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok)
    throw new TypeError(`Expected content-edit success: ${result.diagnostics[0].code}`);
  expect(result.diagnostics).toEqual([]);
  return result.document;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

function withBehaviorAndVariants(): DesenEditorDocument {
  const input = clone(validSource);
  const surface = record(record(record(input).surfaces)["sign-in"]);
  const root = record(surface.root);
  root.behaviors = [
    {
      id: "sign-in.behavior",
      use: "com.example.interactions/Preview",
      props: { axis: "vertical" },
      style: { base: { indicator: { color: "blue" } } },
    },
  ];
  const children = record(root.slots).default as unknown[];
  const title = record(children[0]);
  title.variants = [
    { when: clone(TRUE_PREDICATE), props: { text: "first" } },
    { when: clone(FALSE_PREDICATE), style: { base: { text: { color: "gray" } } } },
    { when: clone(TRUE_PREDICATE), props: { text: "third" } },
  ];
  return createDocument(input);
}

function contentIds(document: DesenEditorDocument): readonly string[] {
  const surface = document.surfaces["sign-in"];
  if (surface === undefined) throw new TypeError("Missing sign-in surface.");
  const ids: string[] = [];
  const pending: (
    | { kind: "node"; value: typeof surface.root }
    | {
        kind: "behavior";
        value: NonNullable<typeof surface.root.behaviors>[number];
      }
  )[] = [{ kind: "node", value: surface.root }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    ids.push(current.value.id);
    for (const children of Object.values(current.value.slots ?? {})) {
      for (const child of children) pending.push({ kind: "node", value: child });
    }
    if (current.kind === "node") {
      for (const behavior of current.value.behaviors ?? []) {
        pending.push({ kind: "behavior", value: behavior });
      }
    }
  }
  return Object.freeze(ids.sort());
}

describe("M08-T04 content edits", () => {
  it("sets and deletes base node props without retaining inputs or removing the empty container", () => {
    const document = createDocument();
    const beforeIds = contentIds(document);
    const value = { $ref: "state.email", fallback: "" } as const;
    const command = {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "unresolvedProp",
      value,
    };

    const first = setDesenEditorOwnerProp(document, command);
    const second = setDesenEditorOwnerProp(document, clone(command));
    const firstDocument = successful(first);
    const secondDocument = successful(second);
    expect(
      firstDocument.surfaces["sign-in"]?.root.slots?.default?.[0]?.props?.unresolvedProp,
    ).toEqual(value);
    expect(canonicalizeJsonBytes(firstDocument)).toEqual(canonicalizeJsonBytes(secondDocument));
    expect(firstDocument).not.toBe(secondDocument);
    expect(contentIds(firstDocument)).toEqual(beforeIds);

    record(value).fallback = "caller-mutated";
    expect(
      firstDocument.surfaces["sign-in"]?.root.slots?.default?.[0]?.props?.unresolvedProp,
    ).toEqual({
      $ref: "state.email",
      fallback: "",
    });

    const deleted = successful(
      deleteDesenEditorOwnerProp(firstDocument, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "unresolvedProp",
      }),
    );
    const props = deleted.surfaces["sign-in"]?.root.slots?.default?.[0]?.props;
    expect(Object.hasOwn(props ?? {}, "unresolvedProp")).toBe(false);
    expect(
      Object.hasOwn(deleted.surfaces["sign-in"]?.root.slots?.default?.[0] ?? {}, "props"),
    ).toBe(true);
    expectDeepFrozen(first);
    expectDeepFrozen(deleted);
  });

  it("edits behavior props and prototype-sensitive prop names as own data", () => {
    const document = withBehaviorAndVariants();
    const set = successful(
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.behavior",
        name: "__proto__",
        value: { safe: true },
      }),
    );
    const props = set.surfaces["sign-in"]?.root.behaviors?.[0]?.props;
    expect(Object.hasOwn(props ?? {}, "__proto__")).toBe(true);
    expect(props?.__proto__).toEqual({ safe: true });
    const deleted = successful(
      deleteDesenEditorOwnerProp(set, {
        surfaceId: "sign-in",
        ownerId: "sign-in.behavior",
        name: "__proto__",
      }),
    );
    expect(
      Object.hasOwn(deleted.surfaces["sign-in"]?.root.behaviors?.[0]?.props ?? {}, "__proto__"),
    ).toBe(false);
  });

  it("sets and deletes node and behavior style leaves while preserving empty state and part maps", () => {
    const document = withBehaviorAndVariants();
    const node = successful(
      setDesenEditorOwnerStyleProperty(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "preview",
        part: "constructor",
        property: "toString",
        value: { $token: "color.preview" },
      }),
    );
    expect(
      node.surfaces["sign-in"]?.root.slots?.default?.[0]?.style?.preview?.constructor?.toString,
    ).toEqual({ $token: "color.preview" });
    const clearedNode = successful(
      deleteDesenEditorOwnerStyleProperty(node, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "preview",
        part: "constructor",
        property: "toString",
      }),
    );
    expect(
      clearedNode.surfaces["sign-in"]?.root.slots?.default?.[0]?.style?.preview?.constructor,
    ).toEqual({});

    const behavior = successful(
      setDesenEditorOwnerStyleProperty(clearedNode, {
        surfaceId: "sign-in",
        ownerId: "sign-in.behavior",
        state: "base",
        part: "indicator",
        property: "opacity",
        value: 0.5,
      }),
    );
    expect(behavior.surfaces["sign-in"]?.root.behaviors?.[0]?.style?.base?.indicator?.opacity).toBe(
      0.5,
    );
  });

  it("sets and clears only component-node base conditions", () => {
    const document = withBehaviorAndVariants();
    const set = successful(
      setDesenEditorNodeCondition(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        when: TRUE_PREDICATE,
      }),
    );
    expect(set.surfaces["sign-in"]?.root.slots?.default?.[0]?.when).toEqual(TRUE_PREDICATE);
    const cleared = successful(
      clearDesenEditorNodeCondition(set, { surfaceId: "sign-in", nodeId: "sign-in.title" }),
    );
    expect(Object.hasOwn(cleared.surfaces["sign-in"]?.root.slots?.default?.[0] ?? {}, "when")).toBe(
      false,
    );
    const behavior = setDesenEditorNodeCondition(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.behavior",
      when: TRUE_PREDICATE,
    });
    expect(behavior).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND" }],
    });
  });

  it("inserts variants at exact boundaries and preserves unresolved Catalog semantics", () => {
    const document = createDocument();
    const variant: DesenEditorContentVariant = {
      when: { op: "exists", args: [{ $ref: "state.future" }] },
      props: { unresolved: true },
      extensions: { "com.example/opaque": { retained: true } },
    };
    const inserted = successful(
      insertDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        variant,
      }),
    );
    expect(inserted.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants).toEqual([variant]);
    expect(contentIds(inserted)).toEqual(contentIds(document));
    const invalidBoundary = insertDesenEditorVariant(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      index: 1,
      variant,
    });
    expect(invalidBoundary).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_POSITION_INVALID" }],
    });
  });

  it("deletes variants and retains an empty own variants array", () => {
    const document = withBehaviorAndVariants();
    let next = document;
    for (let index = 2; index >= 0; index -= 1) {
      next = successful(
        deleteDesenEditorVariant(next, { surfaceId: "sign-in", nodeId: "sign-in.title", index }),
      );
    }
    const title = next.surfaces["sign-in"]?.root.slots?.default?.[0];
    expect(Object.hasOwn(title ?? {}, "variants")).toBe(true);
    expect(title?.variants).toEqual([]);
  });

  it("reorders variants by post-removal final index including a fresh no-op", () => {
    const document = withBehaviorAndVariants();
    const reordered = successful(
      reorderDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        variantIndex: 0,
        index: 2,
      }),
    );
    expect(
      reordered.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.map(
        (variant) => variant.props?.text,
      ),
    ).toEqual([undefined, "third", "first"]);
    const noOp = successful(
      reorderDesenEditorVariant(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        variantIndex: 1,
        index: 1,
      }),
    );
    expect(noOp).toEqual(document);
    expect(noOp).not.toBe(document);
  });

  it("sets variant conditions and rejects absent variant indices atomically", () => {
    const document = withBehaviorAndVariants();
    const set = successful(
      setDesenEditorVariantCondition(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 1,
        when: TRUE_PREDICATE,
      }),
    );
    expect(set.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[1]?.when).toEqual(
      TRUE_PREDICATE,
    );
    const failure = setDesenEditorVariantCondition(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      index: 3,
      when: TRUE_PREDICATE,
    });
    expect(failure).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_POSITION_INVALID" }],
    });
    expect(document.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[1]?.when).toEqual(
      FALSE_PREDICATE,
    );
  });

  it("sets and deletes variant props while allowing the last prop to leave an empty map", () => {
    const document = withBehaviorAndVariants();
    const set = successful(
      setDesenEditorVariantProp(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        name: "text",
        value: "replacement",
      }),
    );
    expect(set.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[0]?.props?.text).toBe(
      "replacement",
    );
    const deleted = successful(
      deleteDesenEditorVariantProp(set, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        name: "text",
      }),
    );
    expect(deleted.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[0]?.props).toEqual({});
  });

  it("sets and deletes variant style leaves while retaining empty style containers", () => {
    const document = withBehaviorAndVariants();
    const set = successful(
      setDesenEditorVariantStyleProperty(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "text",
        property: "color",
        value: "red",
      }),
    );
    expect(
      set.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[0]?.style?.base?.text?.color,
    ).toBe("red");
    const deleted = successful(
      deleteDesenEditorVariantStyleProperty(set, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "text",
        property: "color",
      }),
    );
    expect(
      deleted.surfaces["sign-in"]?.root.slots?.default?.[0]?.variants?.[0]?.style?.base?.text,
    ).toEqual({});
  });

  it("rejects deletion of every missing path without returning a partial document", () => {
    const document = withBehaviorAndVariants();
    const failures = [
      deleteDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "missing",
      }),
      deleteDesenEditorOwnerStyleProperty(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        state: "base",
        part: "missing",
        property: "color",
      }),
      clearDesenEditorNodeCondition(document, { surfaceId: "sign-in", nodeId: "sign-in.title" }),
      deleteDesenEditorVariantProp(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        name: "missing",
      }),
      deleteDesenEditorVariantStyleProperty(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        index: 0,
        state: "base",
        part: "missing",
        property: "color",
      }),
    ];
    for (const failure of failures) {
      expect(failure).toMatchObject({
        ok: false,
        diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND" }],
      });
      expect("document" in failure).toBe(false);
      expectDeepFrozen(failure);
    }
  });

  it("rejects missing and ambiguous surface-local owner identities", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    root.behaviors = [{ id: "sign-in.title", use: "com.example.interactions/Duplicate" }];
    const document = createDocument(input);
    const ambiguous = setDesenEditorOwnerProp(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "changed",
    });
    expect(ambiguous).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_TARGET_AMBIGUOUS" }],
    });
    const missing = setDesenEditorOwnerProp(document, {
      surfaceId: "sign-in",
      ownerId: "missing",
      name: "text",
      value: "changed",
    });
    expect(missing).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND" }],
    });
  });

  it("rejects non-data command shapes without invoking hooks and contains throwing Proxy traps atomically", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const getter = vi.fn(() => "active");
    const toJSON = vi.fn(() => ({ serialized: "authority" }));
    const accessor = {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
    } as Record<string, unknown>;
    Object.defineProperty(accessor, "value", { enumerable: true, get: getter });
    const symbolic = {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "changed",
      [Symbol("authority")]: true,
    };
    class Command {
      readonly surfaceId = "sign-in";
      readonly ownerId = "sign-in.title";
      readonly name = "text";
      readonly value = "changed";
    }
    const sparse = new Array(1);
    const forwardingTraps: string[] = [];
    const forwardingTarget = {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      name: "text",
      value: "forwarded",
    };
    const forwardingProxy = new Proxy(forwardingTarget, {
      getOwnPropertyDescriptor(target, key) {
        forwardingTraps.push(`getOwnPropertyDescriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      getPrototypeOf(target) {
        forwardingTraps.push("getPrototypeOf");
        return Reflect.getPrototypeOf(target);
      },
      ownKeys(target) {
        forwardingTraps.push("ownKeys");
        return Reflect.ownKeys(target);
      },
    });
    const throwingTraps: string[] = [];
    const throwingProxy = new Proxy(forwardingTarget, {
      getPrototypeOf() {
        throwingTraps.push("getPrototypeOf");
        throw new TypeError("controlled Proxy reflection failure");
      },
    });
    const failures = [
      setDesenEditorOwnerProp(document, accessor as never),
      setDesenEditorOwnerProp(document, symbolic as never),
      setDesenEditorOwnerProp(document, new Command()),
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "text",
        value: sparse,
      } as never),
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "text",
        value: () => "executable",
      } as never),
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "text",
        value: { inert: true, toJSON },
      } as never),
      setDesenEditorOwnerProp(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "text",
        value: "changed",
        policy: "force",
      } as never),
      setDesenEditorOwnerProp(document, throwingProxy),
    ];
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    for (const failure of failures) {
      expect(failure).toMatchObject({
        ok: false,
        diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_COMMAND_INVALID" }],
      });
      expect("document" in failure).toBe(false);
    }
    expect(throwingTraps).toEqual(["getPrototypeOf"]);
    expect(canonicalizeJsonBytes(document)).toEqual(before);

    const forwarded = successful(setDesenEditorOwnerProp(document, forwardingProxy));
    expect(forwarded.surfaces["sign-in"]?.root.slots?.default?.[0]?.props?.text).toBe("forwarded");
    expect(forwardingTraps).toEqual([
      "getPrototypeOf",
      "ownKeys",
      "getOwnPropertyDescriptor:name",
      "getOwnPropertyDescriptor:ownerId",
      "getOwnPropertyDescriptor:surfaceId",
      "getOwnPropertyDescriptor:value",
    ]);
  });

  it("rejects malformed-Unicode prop names with controlled command diagnostics", () => {
    const document = createDocument();
    const malformedName = "\ud800";
    const commands = [
      () =>
        setDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          name: malformedName,
          value: true,
        }),
      () =>
        deleteDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          name: malformedName,
        }),
      () =>
        setDesenEditorVariantProp(withBehaviorAndVariants(), {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          name: malformedName,
          value: true,
        }),
      () =>
        deleteDesenEditorVariantProp(withBehaviorAndVariants(), {
          surfaceId: "sign-in",
          nodeId: "sign-in.title",
          index: 0,
          name: malformedName,
        }),
    ];

    for (const command of commands) {
      expect(command).not.toThrow();
      expect(command()).toMatchObject({
        ok: false,
        diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_COMMAND_INVALID" }],
      });
    }
  });

  it("preserves structural diagnostics when a content value would make the Source invalid", () => {
    const document = createDocument();
    const result = setDesenEditorNodeCondition(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      when: { op: "not", args: [true, false] } as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected structural rejection.");
    expect(result.diagnostics[0].code).toBe("SCHEMA_INVALID");
    expect("document" in result).toBe(false);
    expect(
      Object.hasOwn(document.surfaces["sign-in"]?.root.slots?.default?.[0] ?? {}, "when"),
    ).toBe(false);
  });

  it("enforces depth, identity-count, and 8 MiB document boundaries", () => {
    const depthInput = clone(validSource);
    const depthSurface = record(record(record(depthInput).surfaces)["sign-in"]);
    let node = record(depthSurface.root);
    for (let depth = 1; depth <= 64; depth += 1) {
      const child = { id: `depth.${depth}`, use: "com.example.ui/Stack" };
      node.slots = { default: [child] };
      node = child;
    }
    const depthDocument = createDocument(depthInput);
    expect(
      setDesenEditorOwnerProp(depthDocument, {
        surfaceId: "sign-in",
        ownerId: "depth.64",
        name: "value",
        value: true,
      }).ok,
    ).toBe(true);
    node.slots = { default: [{ id: "depth.65", use: "com.example.ui/Stack" }] };
    const tooDeep = createDocument(depthInput);
    expect(
      setDesenEditorOwnerProp(tooDeep, {
        surfaceId: "sign-in",
        ownerId: "depth.65",
        name: "value",
        value: true,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED" }],
    });

    const identityInput = clone(validSource);
    const identitySurface = record(record(record(identityInput).surfaces)["sign-in"]);
    // This fixture has six node identities in sign-in, so 24,994 behaviors land exactly at 25,000.
    record(identitySurface.root).behaviors = Array.from({ length: 24_994 }, (_, index) => ({
      id: `b${index}`,
      use: "com.example.interactions/Preview",
    }));
    const identityDocument = createDocument(identityInput);
    expect(
      setDesenEditorOwnerProp(identityDocument, {
        surfaceId: "sign-in",
        ownerId: "sign-in.layout",
        name: "value",
        value: true,
      }).ok,
    ).toBe(true);
    (record(identitySurface.root).behaviors as unknown[]).push({
      id: "overflow",
      use: "com.example.interactions/Preview",
    });
    const tooMany = createDocument(identityInput);
    expect(
      setDesenEditorOwnerProp(tooMany, {
        surfaceId: "sign-in",
        ownerId: "sign-in.layout",
        name: "value",
        value: true,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED" }],
    });

    function sized(extraBytes: number): DesenEditorDocument {
      const input = clone(validSource);
      const inputSurface = record(record(record(input).surfaces)["sign-in"]);
      const firstChild = (record(record(inputSurface.root).slots).default as unknown[])[0];
      record(record(firstChild).props).x = false;
      record(input).authoring = { padding: "" };
      const baseLength = canonicalizeJsonBytes(input).byteLength;
      record(input.authoring).padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
      return createDocument(input);
    }
    const exactLimit = successful(
      setDesenEditorOwnerProp(sized(0), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "x",
        value: false,
      }),
    );
    expect(canonicalizeJsonBytes(exactLimit).byteLength).toBe(DOCUMENT_LIMIT);
    expect(
      setDesenEditorOwnerProp(sized(1), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        name: "x",
        value: false,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED" }],
    });
  });
});
