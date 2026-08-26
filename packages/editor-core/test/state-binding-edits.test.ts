import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  deleteDesenEditorResourceInput,
  deleteDesenEditorStateDeclaration,
  insertDesenEditorStateDeclaration,
  setDesenEditorNodeRepeatItems,
  setDesenEditorNodeRepeatKey,
  setDesenEditorResourceInput,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
} from "../src/state-binding-edits.js";
import { createDesenEditorDocument } from "../src/source-document.js";

import type {
  DesenEditorBindingValue,
  DesenEditorStateBindingEditResult,
  DesenEditorStateDeclaration,
} from "../src/state-binding-edits.js";
import type { DesenEditorDocument } from "../src/source-document.js";

type MutableRecord = Record<string, unknown>;

const DOCUMENT_LIMIT = 8_388_608;

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

function successful(result: DesenEditorStateBindingEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(`Expected state/binding edit success: ${result.diagnostics[0].code}`);
  }
  expect(result.diagnostics).toEqual([]);
  return result.document;
}

function expectFailure(
  result: DesenEditorStateBindingEditResult,
  code: string,
): asserts result is Extract<DesenEditorStateBindingEditResult, { readonly ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("Expected a state/binding edit failure.");
  expect(result.diagnostics[0].code).toBe(code);
  expect("document" in result).toBe(false);
  expectDeepFrozen(result);
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

function signInSurface(input: unknown): MutableRecord {
  return record(record(record(input).surfaces)["sign-in"]);
}

function rootChildren(input: unknown): unknown[] {
  return record(record(signInSurface(input).root).slots).default as unknown[];
}

function withRepeatAndResource(): DesenEditorDocument {
  const input = clone(validSource);
  const surface = signInSurface(input);
  const resources = record(surface.resources);
  resources.data = {
    use: "com.example.data/List",
    input: { existing: { $ref: "state.email", fallback: "" } },
    policy: "manual",
    extensions: { "com.example.resource": { retained: true } },
  };
  const title = record(rootChildren(input)[0]);
  title.repeat = {
    items: { $ref: "resource.data.value", fallback: [] },
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 10,
    extensions: { "com.example.repeat": { retained: true } },
  };
  return createDocument(input);
}

function editorIdentities(document: DesenEditorDocument, surfaceId = "sign-in"): readonly string[] {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) throw new TypeError("Missing identity fixture surface.");
  const ids: string[] = [];
  const pending: (
    | { readonly kind: "node"; readonly value: typeof surface.root }
    | {
        readonly kind: "behavior";
        readonly value: NonNullable<typeof surface.root.behaviors>[number];
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

describe("M08-T05 state declaration and binding edits", () => {
  it("inserts complete dotted and prototype-sensitive state declarations as detached own data", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const declaration = {
      schema: {
        type: "object",
        properties: { value: { type: "string" } },
        required: ["value"],
      },
      initial: { value: "original" },
      extensions: { "com.example.state": { retained: true } },
    } satisfies DesenEditorStateDeclaration;

    const dotted = successful(
      insertDesenEditorStateDeclaration(document, {
        surfaceId: "sign-in",
        name: "profile.name",
        declaration,
      }),
    );
    record(declaration.initial).value = "caller-mutated";
    const withPrototypeName = successful(
      insertDesenEditorStateDeclaration(dotted, {
        surfaceId: "sign-in",
        name: "constructor",
        declaration: { schema: { type: "boolean" }, initial: false },
      }),
    );

    const state = withPrototypeName.surfaces["sign-in"]?.state;
    expect(Object.hasOwn(state ?? {}, "profile.name")).toBe(true);
    expect(Object.hasOwn(state ?? {}, "constructor")).toBe(true);
    expect(state?.["profile.name"]?.initial).toEqual({ value: "original" });
    expect(state?.["constructor"]?.initial).toBe(false);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
    expect(document.surfaces["sign-in"]?.state["profile.name"]).toBeUndefined();
    expectDeepFrozen(withPrototypeName);
  });

  it("sets state schema and inert initial values, then deletes without cascading references", () => {
    const document = createDocument();
    const schemaChanged = successful(
      setDesenEditorStateSchema(document, {
        surfaceId: "sign-in",
        name: "email",
        schema: { type: "number", minimum: 0 },
      }),
    );
    // Schema/initial compatibility is intentionally deferred to M08-T09 continuous validation.
    expect(schemaChanged.surfaces["sign-in"]?.state.email?.initial).toBe("");

    const markerInitial = { $ref: "state.password", fallback: { nested: true } };
    const initialChanged = successful(
      setDesenEditorStateInitial(schemaChanged, {
        surfaceId: "sign-in",
        name: "email",
        initial: markerInitial,
      }),
    );
    markerInitial.fallback.nested = false;
    expect(initialChanged.surfaces["sign-in"]?.state.email?.initial).toEqual({
      $ref: "state.password",
      fallback: { nested: true },
    });

    const deleted = successful(
      deleteDesenEditorStateDeclaration(initialChanged, {
        surfaceId: "sign-in",
        name: "email",
      }),
    );
    const emailNode = deleted.surfaces["sign-in"]?.root.slots?.default?.[1];
    expect(deleted.surfaces["sign-in"]?.state.email).toBeUndefined();
    expect(emailNode?.props?.value).toEqual({ $ref: "state.email" });
    expect(emailNode?.on?.change?.[0]).toMatchObject({ type: "state.set", path: "email" });
    expect(document.surfaces["sign-in"]?.state.email?.initial).toBe("");
    expectDeepFrozen(deleted);
  });

  it("retains the required empty state map after deleting the final declaration", () => {
    const withoutEmail = successful(
      deleteDesenEditorStateDeclaration(createDocument(), {
        surfaceId: "sign-in",
        name: "email",
      }),
    );
    const empty = successful(
      deleteDesenEditorStateDeclaration(withoutEmail, {
        surfaceId: "sign-in",
        name: "password",
      }),
    );
    const surface = empty.surfaces["sign-in"];
    expect(Object.hasOwn(surface ?? {}, "state")).toBe(true);
    expect(surface?.state).toEqual({});
  });

  it("replaces repeat items and key while preserving alias, limit, extensions, order, and identities", () => {
    const document = withRepeatAndResource();
    const identities = editorIdentities(document);
    const items: DesenEditorBindingValue = {
      $format: {
        template: "{rows}",
        values: { rows: { $ref: "resource.data.value", fallback: [] } },
      },
    };
    const itemsChanged = successful(
      setDesenEditorNodeRepeatItems(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        items,
      }),
    );
    record(record(items).$format).template = "caller-mutated";
    const keyChanged = successful(
      setDesenEditorNodeRepeatKey(itemsChanged, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        key: { $ref: "item.row.slug", fallback: 0 },
      }),
    );
    const repeat = keyChanged.surfaces["sign-in"]?.root.slots?.default?.[0]?.repeat;

    expect(repeat).toEqual({
      items: {
        $format: {
          template: "{rows}",
          values: { rows: { $ref: "resource.data.value", fallback: [] } },
        },
      },
      as: "row",
      key: { $ref: "item.row.slug", fallback: 0 },
      limit: 10,
      extensions: { "com.example.repeat": { retained: true } },
    });
    expect(editorIdentities(keyChanged)).toEqual(identities);
    expect(document.surfaces["sign-in"]?.root.slots?.default?.[0]?.repeat?.key).toEqual({
      $ref: "item.row.id",
    });
    expectDeepFrozen(keyChanged);
  });

  it("creates, replaces, and deletes prototype-sensitive resource-input leaves as own data", () => {
    const document = withRepeatAndResource();
    const callerValue = { $ref: "state.password", fallback: ["safe"] };
    const created = successful(
      setDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "__proto__",
        value: callerValue,
      }),
    );
    callerValue.fallback.push("caller-mutated");
    const input = created.surfaces["sign-in"]?.resources.data?.input;
    expect(Object.hasOwn(input ?? {}, "__proto__")).toBe(true);
    expect(input?.__proto__).toEqual({ $ref: "state.password", fallback: ["safe"] });

    const replaced = successful(
      setDesenEditorResourceInput(created, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "existing",
        value: null,
      }),
    );
    const withoutPrototype = successful(
      deleteDesenEditorResourceInput(replaced, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "__proto__",
      }),
    );
    const empty = successful(
      deleteDesenEditorResourceInput(withoutPrototype, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "existing",
      }),
    );
    expect(Object.hasOwn(empty.surfaces["sign-in"]?.resources.data ?? {}, "input")).toBe(true);
    expect(empty.surfaces["sign-in"]?.resources.data?.input).toEqual({});
    expect(document.surfaces["sign-in"]?.resources.data?.input.existing).toEqual({
      $ref: "state.email",
      fallback: "",
    });
  });

  it("reports duplicate, missing target, and missing path failures without partial authority", () => {
    const document = withRepeatAndResource();
    const failures: readonly [DesenEditorStateBindingEditResult, string][] = [
      [
        insertDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "email",
          declaration: { schema: { type: "string" }, initial: "" },
        }),
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS",
      ],
      [
        deleteDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "missing",
        }),
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
      ],
      [
        setDesenEditorStateSchema(document, {
          surfaceId: "missing",
          name: "email",
          schema: {},
        }),
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
      ],
      [
        setDesenEditorNodeRepeatItems(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.email",
          items: [],
        }),
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
      ],
      [
        setDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "missing",
          name: "value",
          value: true,
        }),
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
      ],
      [
        deleteDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "data",
          name: "missing",
        }),
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
      ],
    ];
    for (const [result, code] of failures) expectFailure(result, code);
  });

  it("requires one unique component-node identity for repeat edits", () => {
    const duplicateNodes = clone(validSource);
    rootChildren(duplicateNodes).push({
      id: "sign-in.title",
      use: "com.example.ui/Text",
      repeat: { items: [], as: "row", key: "key" },
    });
    const ambiguousNode = setDesenEditorNodeRepeatItems(createDocument(duplicateNodes), {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      items: [1],
    });
    expectFailure(ambiguousNode, "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS");

    const nodeAndBehavior = clone(validSource);
    const root = record(signInSurface(nodeAndBehavior).root);
    root.behaviors = [
      {
        id: "sign-in.title",
        use: "com.example.interactions/Duplicate",
      },
    ];
    const ambiguousNamespace = setDesenEditorNodeRepeatKey(createDocument(nodeAndBehavior), {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      key: "key",
    });
    expectFailure(ambiguousNamespace, "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS");

    const behaviorOnly = clone(validSource);
    record(signInSurface(behaviorOnly).root).behaviors = [
      {
        id: "repeat.behavior",
        use: "com.example.interactions/Only",
      },
    ];
    const wrongKind = setDesenEditorNodeRepeatItems(createDocument(behaviorOnly), {
      surfaceId: "sign-in",
      nodeId: "repeat.behavior",
      items: [],
    });
    expectFailure(wrongKind, "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND");
  });

  it("preserves structural diagnostics for invalid schemas and binding forms atomically", () => {
    const document = withRepeatAndResource();
    const before = canonicalizeJsonBytes(document);
    const invalidSchema = setDesenEditorStateSchema(document, {
      surfaceId: "sign-in",
      name: "email",
      schema: { type: "not-a-json-schema-type" } as never,
    });
    expectFailure(invalidSchema, "SCHEMA_INVALID");
    const invalidRepeat = setDesenEditorNodeRepeatItems(document, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      items: { $ref: "unknown.value" } as never,
    });
    expectFailure(invalidRepeat, "SCHEMA_INVALID");
    const invalidDeclaration = insertDesenEditorStateDeclaration(document, {
      surfaceId: "sign-in",
      name: "invalidSchema",
      declaration: {
        schema: { pattern: "[" },
        initial: "value",
      },
    });
    expectFailure(invalidDeclaration, "SCHEMA_INVALID");
    expect(canonicalizeJsonBytes(document)).toEqual(before);
    expect(document.surfaces["sign-in"]?.state.invalidSchema).toBeUndefined();
  });

  it("rejects active, executable, sparse, inherited, symbol, extra, and malformed command data without hooks", () => {
    const document = withRepeatAndResource();
    const before = canonicalizeJsonBytes(document);
    const getter = vi.fn(() => ({ marker: true }));
    const toJSON = vi.fn(() => ({ serialized: "authority" }));
    const accessor = { surfaceId: "sign-in", name: "email" } as Record<string, unknown>;
    Object.defineProperty(accessor, "initial", { enumerable: true, get: getter });
    class Command {
      readonly surfaceId = "sign-in";
      readonly name = "email";
      readonly initial = "changed";
    }
    const sparse = new Array(2);
    sparse[1] = "present";
    const failures = [
      setDesenEditorStateInitial(document, accessor as never),
      setDesenEditorStateInitial(document, new Command()),
      setDesenEditorStateInitial(document, {
        surfaceId: "sign-in",
        name: "email",
        initial: { inert: true, toJSON },
      } as never),
      setDesenEditorStateInitial(document, {
        surfaceId: "sign-in",
        name: "email",
        initial: () => "executable",
      } as never),
      setDesenEditorNodeRepeatItems(document, {
        surfaceId: "sign-in",
        nodeId: "sign-in.title",
        items: sparse,
      } as never),
      setDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "value",
        value: true,
        policy: "force",
      } as never),
      setDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "\ud800",
        value: true,
      }),
      setDesenEditorResourceInput(document, {
        surfaceId: "sign-in",
        resourceId: "data",
        name: "value",
        value: true,
        [Symbol("authority")]: true,
      } as never),
    ];
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    for (const failure of failures) {
      expectFailure(failure, "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID");
    }
    expect(canonicalizeJsonBytes(document)).toEqual(before);
  });

  it("accepts an honest forwarding Proxy and contains throwing reflection traps atomically", () => {
    const document = withRepeatAndResource();
    const before = canonicalizeJsonBytes(document);
    const forwardingTraps: string[] = [];
    const target = {
      surfaceId: "sign-in",
      resourceId: "data",
      name: "forwarded",
      value: { $ref: "state.email" } as const,
    };
    const forwarding = new Proxy(target, {
      getOwnPropertyDescriptor(value, key) {
        forwardingTraps.push(`descriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(value, key);
      },
      getPrototypeOf(value) {
        forwardingTraps.push("prototype");
        return Reflect.getPrototypeOf(value);
      },
      ownKeys(value) {
        forwardingTraps.push("keys");
        return Reflect.ownKeys(value);
      },
    });
    const forwarded = successful(setDesenEditorResourceInput(document, forwarding));
    expect(forwarded.surfaces["sign-in"]?.resources.data?.input.forwarded).toEqual({
      $ref: "state.email",
    });
    expect(forwardingTraps).toContain("prototype");
    expect(forwardingTraps).toContain("keys");

    const throwingTraps: string[] = [];
    const throwing = new Proxy(target, {
      getPrototypeOf() {
        throwingTraps.push("prototype");
        throw new TypeError("controlled Proxy reflection failure");
      },
    });
    const failed = setDesenEditorResourceInput(document, throwing);
    expectFailure(failed, "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID");
    expect(throwingTraps).toEqual(["prototype"]);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
  });

  it("is deterministic, detached, deeply frozen, atomic, and stable-ID preserving", () => {
    const document = withRepeatAndResource();
    const before = canonicalizeJsonBytes(document);
    const ids = editorIdentities(document);
    const command = {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      key: { $ref: "item.row.key", fallback: "missing" },
    } as const;
    const left = successful(setDesenEditorNodeRepeatKey(document, command));
    const right = successful(setDesenEditorNodeRepeatKey(document, command));

    expect(canonicalizeJsonBytes(left)).toEqual(canonicalizeJsonBytes(right));
    expect(left).not.toBe(right);
    expect(left).not.toBe(document);
    expect(editorIdentities(left)).toEqual(ids);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
    expectDeepFrozen(left);
    expectDeepFrozen(right);
  });

  it("accepts component depth 64 and rejects depth 65 before mutation", () => {
    function sourceAtDepth(depth: number): unknown {
      const input = clone(validSource);
      const root = record(signInSurface(input).root);
      root.slots = {};
      let parent = root;
      for (let index = 1; index <= depth; index += 1) {
        const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
        parent.slots = { default: [child] };
        parent = child;
      }
      return input;
    }
    const accepted = setDesenEditorStateInitial(createDocument(sourceAtDepth(64)), {
      surfaceId: "sign-in",
      name: "email",
      initial: "accepted",
    });
    expect(accepted.ok).toBe(true);
    const rejectedDocument = createDocument(sourceAtDepth(65));
    const rejected = setDesenEditorStateInitial(rejectedDocument, {
      surfaceId: "sign-in",
      name: "email",
      initial: "rejected",
    });
    expectFailure(rejected, "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED");
    expect(rejectedDocument.surfaces["sign-in"]?.state.email?.initial).toBe("");
  });

  it("accepts exactly 25,000 surface identities and rejects the next occurrence", () => {
    function sourceWithIdentityCount(count: number): unknown {
      const input = clone(validSource);
      const root = record(signInSurface(input).root);
      root.behaviors = [];
      root.slots = {
        default: Array.from({ length: count - 1 }, (_, index) => ({
          id: `item.${index}`,
          use: "com.example.ui/Text",
        })),
      };
      return input;
    }
    const accepted = setDesenEditorStateInitial(createDocument(sourceWithIdentityCount(25_000)), {
      surfaceId: "sign-in",
      name: "email",
      initial: "accepted",
    });
    expect(accepted.ok).toBe(true);
    const rejected = setDesenEditorStateInitial(createDocument(sourceWithIdentityCount(25_001)), {
      surfaceId: "sign-in",
      name: "email",
      initial: "rejected",
    });
    expectFailure(rejected, "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED");
  }, 30_000);

  it("accepts an exact 8 MiB post-edit Source and rejects a one-byte crossing", () => {
    function sized(extraBytes: number): DesenEditorDocument {
      const input = clone(validSource);
      record(input).authoring = { padding: "" };
      const candidate = clone(input);
      record(record(signInSurface(candidate).state).email).initial = false;
      const baseLength = canonicalizeJsonBytes(candidate).byteLength;
      record(record(input).authoring).padding = "x".repeat(
        DOCUMENT_LIMIT - baseLength + extraBytes,
      );
      return createDocument(input);
    }
    const accepted = successful(
      setDesenEditorStateInitial(sized(0), {
        surfaceId: "sign-in",
        name: "email",
        initial: false,
      }),
    );
    expect(canonicalizeJsonBytes(accepted)).toHaveLength(DOCUMENT_LIMIT);
    const rejected = setDesenEditorStateInitial(sized(1), {
      surfaceId: "sign-in",
      name: "email",
      initial: false,
    });
    expectFailure(rejected, "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED");
  }, 30_000);
});
