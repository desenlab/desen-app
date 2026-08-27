import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  reorderDesenEditorAction,
  replaceDesenEditorAction,
} from "../src/event-action-edits.js";
import { createDesenEditorDocument } from "../src/source-document.js";

import type {
  DesenEditorAction,
  DesenEditorEventActionEditResult,
} from "../src/event-action-edits.js";
import type { DesenEditorDocument } from "../src/source-document.js";

type MutableRecord = Record<string, unknown>;

const DOCUMENT_LIMIT = 8_388_608;
const TRUE_GUARD = Object.freeze({
  op: "truthy",
  args: Object.freeze([true]),
});

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

function successful(result: DesenEditorEventActionEditResult): DesenEditorDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new TypeError(`Expected event/action edit success: ${result.diagnostics[0].code}`);
  }
  expect(result.diagnostics).toEqual([]);
  return result.document;
}

function expectFailure(
  result: DesenEditorEventActionEditResult,
  code: string,
): asserts result is Extract<DesenEditorEventActionEditResult, { readonly ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("Expected an event/action edit failure.");
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

function withBehavior(): DesenEditorDocument {
  const input = clone(validSource);
  record(signInSurface(input).root).behaviors = [
    {
      id: "sign-in.behavior",
      use: "com.example.interactions/Preview",
    },
  ];
  return createDocument(input);
}

function editorIdentities(document: DesenEditorDocument): readonly string[] {
  const surface = document.surfaces["sign-in"];
  if (surface === undefined) throw new TypeError("Missing sign-in surface.");
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

function allClosedActions(): DesenEditorAction[] {
  return [
    {
      type: "state.set",
      path: "future.profile",
      value: { $ref: "state.future", fallback: { inert: true } },
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "state.set" } },
    },
    {
      type: "state.toggle",
      path: "future.enabled",
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "state.toggle" } },
    },
    {
      type: "navigate",
      surface: "future-surface",
      params: JSON.parse(
        '{"constructor":{"$ref":"state.future"},"__proto__":"own-data"}',
      ) as Record<string, string | { readonly $ref: string }>,
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "navigate" } },
    },
    {
      type: "operation.invoke",
      operation: "com.example.future/DoThing",
      as: "futureOperation",
      input: { value: { $ref: "state.future" } },
      concurrency: "queue",
      onSuccess: [{ type: "event.emit", name: "future.success", payload: { ok: true } }],
      onFailure: [{ type: "resource.refresh", resource: "futureResource" }],
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "operation.invoke" } },
    },
    {
      type: "resource.refresh",
      resource: "futureResource",
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "resource.refresh" } },
    },
    {
      type: "component.command",
      target: "future.component",
      command: "futureCommand",
      input: { value: { $ref: "state.future" } },
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "component.command" } },
    },
    {
      type: "event.emit",
      name: "future.event",
      payload: JSON.parse('{"constructor":true,"__proto__":{"retained":true}}') as Record<
        string,
        boolean | { readonly retained: boolean }
      >,
      when: clone(TRUE_GUARD),
      extensions: { "com.example.action": { variant: "event.emit" } },
    },
  ];
}

describe("M08-T06 event and closed-action edits", () => {
  it("inserts all seven closed actions for node and behavior owners without resolving semantics", () => {
    const document = withBehavior();
    const before = canonicalizeJsonBytes(document);
    const identities = editorIdentities(document);
    const actions = allClosedActions();
    const node = successful(
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions,
      }),
    );
    record(record(actions[0]).extensions)["com.example.action"] = { callerMutated: true };
    const behavior = successful(
      insertDesenEditorEventHandler(node, {
        surfaceId: "sign-in",
        ownerId: "sign-in.behavior",
        event: "constructor",
        actions: [],
      }),
    );

    const titleActions = behavior.surfaces["sign-in"]?.root.slots?.default?.[0]?.on?.future;
    const behaviorOn = behavior.surfaces["sign-in"]?.root.behaviors?.[0]?.on;
    expect(titleActions?.map((action) => action.type)).toEqual([
      "state.set",
      "state.toggle",
      "navigate",
      "operation.invoke",
      "resource.refresh",
      "component.command",
      "event.emit",
    ]);
    expect(titleActions?.[0]?.extensions).toEqual({
      "com.example.action": { variant: "state.set" },
    });
    const navigate = titleActions?.[2];
    expect(navigate?.type).toBe("navigate");
    if (navigate?.type !== "navigate") throw new TypeError("Expected navigate action.");
    expect(Object.hasOwn(navigate.params ?? {}, "__proto__")).toBe(true);
    expect(navigate.params?.__proto__).toBe("own-data");
    const emitted = titleActions?.[6];
    expect(emitted?.type).toBe("event.emit");
    if (emitted?.type !== "event.emit") throw new TypeError("Expected event action.");
    expect(Object.hasOwn(emitted.payload ?? {}, "__proto__")).toBe(true);
    expect(emitted.payload?.__proto__).toEqual({ retained: true });
    expect(Object.hasOwn(behaviorOn ?? {}, "constructor")).toBe(true);
    expect(behaviorOn?.constructor).toEqual([]);
    expect(editorIdentities(behavior)).toEqual(identities);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
    expectDeepFrozen(behavior);
  });

  it("rejects duplicate handlers and deletes the final handler while retaining an empty own map", () => {
    const document = createDocument();
    const duplicate = insertDesenEditorEventHandler(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.email",
      event: "change",
      actions: [],
    });
    expectFailure(duplicate, "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS");

    const inserted = successful(
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [],
      }),
    );
    const deleted = successful(
      deleteDesenEditorEventHandler(inserted, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
      }),
    );
    const title = deleted.surfaces["sign-in"]?.root.slots?.default?.[0];
    expect(Object.hasOwn(title ?? {}, "on")).toBe(true);
    expect(title?.on).toEqual({});
    expectFailure(
      deleteDesenEditorEventHandler(deleted, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
    );
  });

  it("inserts at exact root and nested boundaries and creates only an absent final settlement list", () => {
    const document = createDocument();
    const rootInserted = successful(
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionListPointer: "/on/press",
        index: 1,
        action: { type: "event.emit", name: "after.invoke" },
      }),
    );
    expect(
      rootInserted.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.map(
        (action) => action.type,
      ),
    ).toEqual(["operation.invoke", "event.emit"]);

    const nestedInserted = successful(
      insertDesenEditorAction(rootInserted, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionListPointer: "/on/press/0/onSuccess",
        index: 0,
        action: { type: "event.emit", name: "before.navigate" },
      }),
    );
    const successActions =
      nestedInserted.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0];
    expect(successActions?.type).toBe("operation.invoke");
    if (successActions?.type !== "operation.invoke") throw new TypeError("Expected operation.");
    expect(successActions.onSuccess?.map((action) => action.type)).toEqual([
      "event.emit",
      "navigate",
    ]);

    const failureCreated = successful(
      insertDesenEditorAction(nestedInserted, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionListPointer: "/on/press/0/onFailure",
        index: 0,
        action: { type: "resource.refresh", resource: "unknownResource" },
      }),
    );
    const operation = failureCreated.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0];
    expect(operation?.type).toBe("operation.invoke");
    if (operation?.type !== "operation.invoke") throw new TypeError("Expected operation.");
    expect(Object.hasOwn(operation, "onFailure")).toBe(true);
    expect(operation.onFailure).toEqual([
      { type: "resource.refresh", resource: "unknownResource" },
    ]);
  });

  it("replaces complete actions including guard, params, input, payload, and extensions", () => {
    const document = createDocument();
    const navigate: DesenEditorAction = {
      type: "navigate",
      surface: "unknown-surface",
      params: { next: { $ref: "state.unknown", fallback: 1 } },
      when: clone(TRUE_GUARD),
      extensions: { "com.example.replace": { phase: "navigate" } },
    };
    const withNavigate = successful(
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        action: navigate,
      }),
    );
    record(record(navigate).params).next = "caller-mutated";
    expect(withNavigate.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0]).toEqual({
      type: "navigate",
      surface: "unknown-surface",
      params: { next: { $ref: "state.unknown", fallback: 1 } },
      when: TRUE_GUARD,
      extensions: { "com.example.replace": { phase: "navigate" } },
    });

    const operation: DesenEditorAction = {
      type: "operation.invoke",
      operation: "com.example.unknown/Run",
      as: "unknownRun",
      input: { constructor: { $ref: "state.unknown" } },
      onSuccess: [{ type: "event.emit", name: "unknown.success" }],
      extensions: { "com.example.replace": { phase: "operation" } },
    };
    const withOperation = successful(
      replaceDesenEditorAction(withNavigate, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        action: operation,
      }),
    );
    const emitted = successful(
      replaceDesenEditorAction(withOperation, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0/onSuccess/0",
        action: {
          type: "event.emit",
          name: "unknown.payload",
          payload: { value: { $ref: "state.unknown" } },
          when: clone(TRUE_GUARD),
          extensions: { "com.example.replace": { phase: "event" } },
        },
      }),
    );
    const replaced = emitted.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0];
    expect(replaced?.type).toBe("operation.invoke");
    if (replaced?.type !== "operation.invoke") throw new TypeError("Expected operation.");
    expect(Object.hasOwn(replaced.input, "constructor")).toBe(true);
    expect(replaced.input).toEqual({ constructor: { $ref: "state.unknown" } });
    expect(replaced.onSuccess?.[0]).toMatchObject({
      type: "event.emit",
      name: "unknown.payload",
      payload: { value: { $ref: "state.unknown" } },
      when: TRUE_GUARD,
      extensions: { "com.example.replace": { phase: "event" } },
    });
  });

  it("reorders by post-removal final index and preserves deliberately empty action arrays", () => {
    const document = successful(
      insertDesenEditorEventHandler(createDocument(), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "ordered",
        actions: [
          { type: "state.toggle", path: "first" },
          { type: "resource.refresh", resource: "second" },
          { type: "event.emit", name: "third" },
        ],
      }),
    );
    const reordered = successful(
      reorderDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionPointer: "/on/ordered/0",
        index: 2,
      }),
    );
    expect(
      reordered.surfaces["sign-in"]?.root.slots?.default?.[0]?.on?.ordered?.map(
        (action) => action.type,
      ),
    ).toEqual(["resource.refresh", "event.emit", "state.toggle"]);

    const noOp = successful(
      reorderDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionPointer: "/on/ordered/1",
        index: 1,
      }),
    );
    expect(noOp).toEqual(document);
    expect(noOp).not.toBe(document);

    let empty = reordered;
    for (let index = 2; index >= 0; index -= 1) {
      empty = successful(
        deleteDesenEditorAction(empty, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          actionPointer: `/on/ordered/${index}`,
        }),
      );
    }
    const title = empty.surfaces["sign-in"]?.root.slots?.default?.[0];
    expect(Object.hasOwn(title?.on ?? {}, "ordered")).toBe(true);
    expect(title?.on?.ordered).toEqual([]);
  });

  it("retains an empty nested settlement list after deleting its final action", () => {
    const document = createDocument();
    const deleted = successful(
      deleteDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0/onSuccess/0",
      }),
    );
    const operation = deleted.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0];
    expect(operation?.type).toBe("operation.invoke");
    if (operation?.type !== "operation.invoke") throw new TypeError("Expected operation.");
    expect(Object.hasOwn(operation, "onSuccess")).toBe(true);
    expect(operation.onSuccess).toEqual([]);
  });

  it("rejects missing and ambiguous surface-local node or behavior owners", () => {
    const input = clone(validSource);
    record(signInSurface(input).root).behaviors = [
      { id: "sign-in.title", use: "com.example.interactions/Duplicate" },
    ];
    const document = createDocument(input);
    const results = [
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [],
      }),
      insertDesenEditorEventHandler(document, {
        surfaceId: "missing",
        ownerId: "sign-in.email",
        event: "future",
        actions: [],
      }),
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "missing",
        event: "future",
        actions: [],
      }),
    ] as const;
    expectFailure(results[0], "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS");
    expectFailure(results[1], "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND");
    expectFailure(results[2], "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND");
  });

  it("separates missing action paths from invalid source and final positions", () => {
    const document = createDocument();
    const pathFailures = [
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        actionListPointer: "/on/missing",
        index: 0,
        action: { type: "event.emit", name: "future" },
      }),
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.email",
        actionListPointer: "/on/change/0/onSuccess",
        index: 0,
        action: { type: "event.emit", name: "future" },
      }),
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0/onFailure/0",
        action: { type: "event.emit", name: "future" },
      }),
    ];
    for (const failure of pathFailures) {
      expectFailure(failure, "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND");
    }

    const positionFailures = [
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionListPointer: "/on/press",
        index: 2,
        action: { type: "event.emit", name: "future" },
      }),
      insertDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionListPointer: "/on/press/0/onFailure",
        index: 1,
        action: { type: "event.emit", name: "future" },
      }),
      reorderDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        index: 1,
      }),
    ];
    for (const failure of positionFailures) {
      expectFailure(failure, "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID");
    }
  });

  it("requires canonical owner-relative RFC 6901 action pointers and safe numeric positions", () => {
    const document = createDocument();
    const invalidListPointers = [
      "on/press",
      "/on/press/00/onSuccess",
      "/on/press/+0/onSuccess",
      "/on/press/-0/onSuccess",
      "/on/press/0/success",
      "/on/press/0/onSuccess/",
      "/on/press/9007199254740992/onSuccess",
      "/on/press~2",
    ];
    for (const actionListPointer of invalidListPointers) {
      expectFailure(
        insertDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionListPointer: actionListPointer as never,
          index: 0,
          action: { type: "event.emit", name: "future" },
        }),
        "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID",
      );
    }
    for (const actionPointer of [
      "/on/press/00",
      "/on/press/-1",
      "/on/press/1.0",
      "/on/press/9007199254740992",
    ]) {
      expectFailure(
        deleteDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionPointer: actionPointer as never,
        }),
        "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID",
      );
    }
    for (const index of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 9_007_199_254_740_992]) {
      expectFailure(
        insertDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionListPointer: "/on/press",
          index,
          action: { type: "event.emit", name: "future" },
        }),
        "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID",
      );
    }
  });

  it("preserves structural re-admission diagnostics for invalid action candidates", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const invalidType = replaceDesenEditorAction(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.submit",
      actionPointer: "/on/press/0",
      action: { type: "future.execute", value: true } as never,
    });
    expectFailure(invalidType, "SCHEMA_INVALID");
    const invalidGuard = insertDesenEditorEventHandler(document, {
      surfaceId: "sign-in",
      ownerId: "sign-in.title",
      event: "future",
      actions: [
        {
          type: "event.emit",
          name: "future",
          when: { op: "not", args: [true, false] },
        } as never,
      ],
    });
    expectFailure(invalidGuard, "SCHEMA_INVALID");
    expect(canonicalizeJsonBytes(document)).toEqual(before);
  });

  it("rejects active, cyclic, sparse, inherited, symbol, extra, and malformed command data without hooks", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const getter = vi.fn(() => ({ type: "event.emit", name: "active" }));
    const toJSON = vi.fn(() => ({ serialized: "authority" }));
    const accessor = {
      surfaceId: "sign-in",
      ownerId: "sign-in.submit",
      actionPointer: "/on/press/0",
    } as MutableRecord;
    Object.defineProperty(accessor, "action", { enumerable: true, get: getter });
    class Command {
      readonly surfaceId = "sign-in";
      readonly ownerId = "sign-in.submit";
      readonly actionPointer = "/on/press/0";
      readonly action = { type: "event.emit", name: "inherited" };
    }
    const cyclic: MutableRecord = { type: "event.emit", name: "cyclic" };
    cyclic.self = cyclic;
    const sparse = new Array(2);
    sparse[1] = { type: "event.emit", name: "present" };
    const decorated = [{ type: "event.emit", name: "present" }];
    Object.defineProperty(decorated, "authority", { value: true, enumerable: true });
    const failures = [
      replaceDesenEditorAction(document, accessor as never),
      replaceDesenEditorAction(document, new Command() as never),
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        action: { type: "event.emit", name: "active", toJSON },
      } as never),
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        action: cyclic,
      } as never),
      replaceDesenEditorAction(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.submit",
        actionPointer: "/on/press/0",
        action: () => "executable",
      } as never),
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: sparse,
      } as never),
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: decorated,
      } as never),
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [],
        policy: "force",
      } as never),
      insertDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "\ud800",
        actions: [],
      }),
      deleteDesenEditorEventHandler(document, {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        [Symbol("authority")]: true,
      } as never),
    ];
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
    for (const failure of failures) {
      expectFailure(failure, "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID");
    }
    expect(canonicalizeJsonBytes(document)).toEqual(before);
  });

  it("accepts an honest forwarding Proxy and contains throwing reflection traps atomically", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const target = {
      surfaceId: "sign-in",
      ownerId: "sign-in.submit",
      actionPointer: "/on/press/0/onSuccess/0" as const,
      action: { type: "event.emit", name: "forwarded" } as const,
    };
    const forwardingTraps: string[] = [];
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
    const forwarded = successful(replaceDesenEditorAction(document, forwarding));
    expect(forwarded.surfaces["sign-in"]?.root.slots?.default?.[4]?.on?.press?.[0]).toMatchObject({
      onSuccess: [{ type: "event.emit", name: "forwarded" }],
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
    const failure = replaceDesenEditorAction(document, throwing);
    expectFailure(failure, "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID");
    expect(throwingTraps).toEqual(["prototype"]);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
  });

  it("is deterministic, detached, deeply frozen, atomic, and stable-ID preserving", () => {
    const document = createDocument();
    const before = canonicalizeJsonBytes(document);
    const identities = editorIdentities(document);
    const command = {
      surfaceId: "sign-in",
      ownerId: "sign-in.submit",
      actionListPointer: "/on/press" as const,
      index: 1,
      action: { type: "event.emit", name: "deterministic", payload: { value: true } } as const,
    };
    const left = successful(insertDesenEditorAction(document, command));
    const right = successful(insertDesenEditorAction(document, command));
    expect(canonicalizeJsonBytes(left)).toEqual(canonicalizeJsonBytes(right));
    expect(left).not.toBe(right);
    expect(left).not.toBe(document);
    expect(editorIdentities(left)).toEqual(identities);
    expect(canonicalizeJsonBytes(document)).toEqual(before);
    expectDeepFrozen(left);
    expectDeepFrozen(right);
  });

  it("accepts component and action nesting depth 64 and rejects depth 65 before mutation", () => {
    function sourceAtComponentDepth(depth: number): unknown {
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
    expect(
      insertDesenEditorEventHandler(createDocument(sourceAtComponentDepth(64)), {
        surfaceId: "sign-in",
        ownerId: "depth.64",
        event: "future",
        actions: [],
      }).ok,
    ).toBe(true);
    expectFailure(
      insertDesenEditorEventHandler(createDocument(sourceAtComponentDepth(65)), {
        surfaceId: "sign-in",
        ownerId: "depth.65",
        event: "future",
        actions: [],
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    );

    function actionAtDepth(depth: number): DesenEditorAction {
      let action: DesenEditorAction = { type: "event.emit", name: "leaf" };
      for (let current = 0; current < depth; current += 1) {
        action = {
          type: "operation.invoke",
          operation: "com.example.future/Nested",
          as: `nested${current}`,
          input: {},
          onSuccess: [action],
        };
      }
      return action;
    }
    expect(
      insertDesenEditorEventHandler(createDocument(), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [actionAtDepth(64)],
      }).ok,
    ).toBe(true);
    expectFailure(
      insertDesenEditorEventHandler(createDocument(), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [actionAtDepth(65)],
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    );
  });

  it("accepts exactly 25,000 surface identities and 25,000 owner actions", () => {
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
    expect(
      insertDesenEditorEventHandler(createDocument(sourceWithIdentityCount(25_000)), {
        surfaceId: "sign-in",
        ownerId: "item.0",
        event: "future",
        actions: [],
      }).ok,
    ).toBe(true);
    expectFailure(
      insertDesenEditorEventHandler(createDocument(sourceWithIdentityCount(25_001)), {
        surfaceId: "sign-in",
        ownerId: "item.0",
        event: "future",
        actions: [],
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    );

    const actions = Array.from<unknown, DesenEditorAction>({ length: 25_000 }, (_, index) => ({
      type: "event.emit",
      name: `event.${index}`,
    }));
    expect(
      insertDesenEditorEventHandler(createDocument(), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions,
      }).ok,
    ).toBe(true);
    actions.push({ type: "event.emit", name: "overflow" });
    expectFailure(
      insertDesenEditorEventHandler(createDocument(), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions,
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    );
  }, 30_000);

  it("accepts an exact 8 MiB post-edit Source and rejects a one-byte crossing", () => {
    function sized(extraBytes: number): DesenEditorDocument {
      const input = clone(validSource);
      record(input).authoring = { padding: "" };
      const candidate = clone(input);
      record(rootChildren(candidate)[0]).on = { future: [] };
      const baseLength = canonicalizeJsonBytes(candidate).byteLength;
      record(record(input).authoring).padding = "x".repeat(
        DOCUMENT_LIMIT - baseLength + extraBytes,
      );
      return createDocument(input);
    }
    const accepted = successful(
      insertDesenEditorEventHandler(sized(0), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [],
      }),
    );
    expect(canonicalizeJsonBytes(accepted)).toHaveLength(DOCUMENT_LIMIT);
    expectFailure(
      insertDesenEditorEventHandler(sized(1), {
        surfaceId: "sign-in",
        ownerId: "sign-in.title",
        event: "future",
        actions: [],
      }),
      "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    );
  }, 30_000);
});
