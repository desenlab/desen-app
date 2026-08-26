import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  createDesenEditorDocument,
  deleteDesenEditorNode,
  moveDesenEditorNode,
  reorderDesenEditorNode,
} from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorNodeDeleteCommand,
  DesenEditorNodeMoveCommand,
  DesenEditorNodeReorderCommand,
} from "../src/index.js";

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

function surfaceIdentities(
  document: DesenEditorDocument,
  surfaceId = "sign-in",
): readonly string[] {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) throw new TypeError("Expected a test surface.");
  const identities: string[] = [];
  const pending: (
    | {
        readonly kind: "behavior";
        readonly value: NonNullable<typeof surface.root.behaviors>[number];
      }
    | { readonly kind: "node"; readonly value: typeof surface.root }
  )[] = [{ kind: "node", value: surface.root }];
  while (pending.length > 0) {
    const owner = pending.pop();
    if (owner === undefined) continue;
    identities.push(owner.value.id);
    for (const children of Object.values(owner.value.slots ?? {})) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) pending.push({ kind: "node", value: child });
      }
    }
    if (owner.kind === "node") {
      for (let index = (owner.value.behaviors?.length ?? 0) - 1; index >= 0; index -= 1) {
        const behavior = owner.value.behaviors?.[index];
        if (behavior !== undefined) pending.push({ kind: "behavior", value: behavior });
      }
    }
  }
  return Object.freeze(identities.sort());
}

function deleteCommand(
  overrides: Partial<DesenEditorNodeDeleteCommand> = {},
): DesenEditorNodeDeleteCommand {
  return { surfaceId: "sign-in", nodeId: "sign-in.title", ...overrides };
}

function moveCommand(
  overrides: Partial<DesenEditorNodeMoveCommand> = {},
): DesenEditorNodeMoveCommand {
  return {
    surfaceId: "sign-in",
    nodeId: "sign-in.title",
    parentId: "sign-in.email",
    slot: "content",
    index: 0,
    ...overrides,
  };
}

function reorderCommand(
  overrides: Partial<DesenEditorNodeReorderCommand> = {},
): DesenEditorNodeReorderCommand {
  return {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    nodeId: "sign-in.title",
    index: 4,
    ...overrides,
  };
}

describe("M08-T03 structural edits", () => {
  it("deletes a complete node subtree while retaining the emptied source-slot key", () => {
    const input = clone(validSource);
    const root = record(record(record(input).surfaces)["sign-in"]);
    const rootNode = record(root.root);
    const target = {
      id: "delete.target",
      use: "com.example.ui/Stack",
      behaviors: [{ id: "delete.behavior", use: "com.example.interactions/Sortable" }],
      slots: {
        nested: [{ id: "delete.child", use: "com.example.unresolved/Unknown" }],
      },
    };
    rootNode.slots = { disposable: [target] };
    const document = createDocument(input);
    const command = deleteCommand({ nodeId: "delete.target" });

    const result = deleteDesenEditorNode(document, command);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected delete success.");
    const slots = result.document.surfaces["sign-in"]?.root.slots;
    expect(Object.hasOwn(slots ?? {}, "disposable")).toBe(true);
    expect(slots?.disposable).toEqual([]);
    expect(surfaceIdentities(result.document)).toEqual(["sign-in.layout"]);
    expect(document.surfaces["sign-in"]?.root.slots?.disposable).toHaveLength(1);
    expect(result.document).not.toBe(document);
    expect(result.diagnostics).toEqual([]);
    expectDeepFrozen(result);
    expect(Object.isFrozen(command)).toBe(false);
  });

  it("moves the exact subtree to a different owner slot without rewriting any identity", () => {
    const input = clone(validSource);
    const root = record(record(record(input).surfaces)["sign-in"]);
    const rootNode = record(root.root);
    rootNode.slots = {
      source: [
        {
          id: "move.target",
          use: "com.example.ui/Stack",
          behaviors: [{ id: "move.behavior", use: "com.example.interactions/Sortable" }],
          slots: { nested: [{ id: "move.child", use: "com.example.ui/Text" }] },
        },
      ],
      owners: [{ id: "move.destination", use: "com.example.ui/Stack" }],
    };
    const document = createDocument(input);
    const beforeIds = surfaceIdentities(document);

    const result = moveDesenEditorNode(
      document,
      moveCommand({
        nodeId: "move.target",
        parentId: "move.destination",
        slot: "unresolvedSlot",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected move success.");
    const resultRoot = result.document.surfaces["sign-in"]?.root;
    expect(resultRoot?.slots?.source).toEqual([]);
    expect(resultRoot?.slots?.owners?.[0]?.slots?.unresolvedSlot?.[0]).toEqual({
      id: "move.target",
      use: "com.example.ui/Stack",
      behaviors: [{ id: "move.behavior", use: "com.example.interactions/Sortable" }],
      slots: { nested: [{ id: "move.child", use: "com.example.ui/Text" }] },
    });
    expect(surfaceIdentities(result.document)).toEqual(beforeIds);
    expect(result.document).not.toBe(document);
    expectDeepFrozen(result);
  });

  it("moves to a behavior-owned slot and creates an absent destination only at index zero", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    root.behaviors = [
      { id: "sign-in.sortable", use: "com.example.interactions/Sortable", slots: {} },
    ];
    const document = createDocument(input);

    const accepted = moveDesenEditorNode(
      document,
      moveCommand({ parentId: "sign-in.sortable", slot: "dragPreview", index: 0 }),
    );
    const rejected = moveDesenEditorNode(
      document,
      moveCommand({ parentId: "sign-in.sortable", slot: "dragPreview", index: 1 }),
    );

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new TypeError("Expected behavior-slot move success.");
    expect(
      accepted.document.surfaces["sign-in"]?.root.behaviors?.[0]?.slots?.dragPreview?.[0]?.id,
    ).toBe("sign-in.title");
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID" }),
      ],
    });
    expect(Object.hasOwn(rejected, "document")).toBe(false);
  });

  it("moves across slots of one owner and inserts at an existing destination boundary", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    const slots = record(root.slots);
    slots.archive = [
      { id: "archive.first", use: "com.example.ui/Text" },
      { id: "archive.last", use: "com.example.ui/Text" },
    ];
    const document = createDocument(input);

    const result = moveDesenEditorNode(
      document,
      moveCommand({
        parentId: "sign-in.layout",
        slot: "archive",
        index: 1,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected cross-slot move success.");
    expect(
      result.document.surfaces["sign-in"]?.root.slots?.archive?.map((node) => node.id),
    ).toEqual(["archive.first", "sign-in.title", "archive.last"]);
    expect(
      result.document.surfaces["sign-in"]?.root.slots?.default?.map((node) => node.id),
    ).toEqual(["sign-in.email", "sign-in.password", "sign-in.error", "sign-in.submit"]);
  });

  it("reorders by the post-removal final position and returns a fresh result for a no-op", () => {
    const document = createDocument();

    const moved = reorderDesenEditorNode(document, reorderCommand());
    const noOp = reorderDesenEditorNode(
      document,
      reorderCommand({ nodeId: "sign-in.submit", index: 4 }),
    );

    expect(moved.ok).toBe(true);
    expect(noOp.ok).toBe(true);
    if (!moved.ok || !noOp.ok) throw new TypeError("Expected reorder success.");
    expect(moved.document.surfaces["sign-in"]?.root.slots?.default?.map((node) => node.id)).toEqual(
      ["sign-in.email", "sign-in.password", "sign-in.error", "sign-in.submit", "sign-in.title"],
    );
    expect(noOp.document).toEqual(document);
    expect(noOp.document).not.toBe(document);
    expect(noOp.document.surfaces).not.toBe(document.surfaces);
    expectDeepFrozen(moved);
    expectDeepFrozen(noOp);
  });

  it("reorders a direct child inside a behavior-owned slot", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    root.behaviors = [
      {
        id: "sign-in.sortable",
        use: "com.example.interactions/Sortable",
        slots: {
          dragPreview: [
            { id: "preview.first", use: "com.example.ui/Text" },
            { id: "preview.middle", use: "com.example.ui/Text" },
            { id: "preview.last", use: "com.example.ui/Text" },
          ],
        },
      },
    ];
    const document = createDocument(input);

    const result = reorderDesenEditorNode(document, {
      surfaceId: "sign-in",
      parentId: "sign-in.sortable",
      slot: "dragPreview",
      nodeId: "preview.middle",
      index: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected behavior-slot reorder success.");
    expect(
      result.document.surfaces["sign-in"]?.root.behaviors?.[0]?.slots?.dragPreview?.map(
        (node) => node.id,
      ),
    ).toEqual(["preview.first", "preview.last", "preview.middle"]);
  });

  it("rejects deleting or moving a surface root and rejects same-slot move ambiguity", () => {
    const document = createDocument();
    const deletedRoot = deleteDesenEditorNode(
      document,
      deleteCommand({ nodeId: "sign-in.layout" }),
    );
    const movedRoot = moveDesenEditorNode(document, moveCommand({ nodeId: "sign-in.layout" }));
    const sameSlot = moveDesenEditorNode(
      document,
      moveCommand({ parentId: "sign-in.layout", slot: "default", index: 4 }),
    );
    const reorderedRoot = reorderDesenEditorNode(
      document,
      reorderCommand({ nodeId: "sign-in.layout" }),
    );

    for (const result of [deletedRoot, movedRoot, reorderedRoot]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN" }),
        ],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
    }
    expect(sameSlot).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID" }),
      ],
    });
  });

  it("rejects moving a node into itself, a descendant node, or a descendant behavior", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    root.slots = {
      default: [
        {
          id: "cycle.target",
          use: "com.example.ui/Stack",
          behaviors: [{ id: "cycle.behavior", use: "com.example.interactions/Sortable" }],
          slots: { default: [{ id: "cycle.child", use: "com.example.ui/Stack" }] },
        },
      ],
    };
    const document = createDocument(input);

    for (const parentId of ["cycle.target", "cycle.child", "cycle.behavior"]) {
      const result = moveDesenEditorNode(
        document,
        moveCommand({ nodeId: "cycle.target", parentId }),
      );
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN" }),
        ],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
    }
  });

  it("requires unique surface-wide target and owner identities without choosing a first match", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    const slots = record(root.slots);
    const children = slots.default as MutableRecord[];
    record(children[1]).id = record(children[0]).id;
    const ambiguousDocument = createDocument(input);
    const document = createDocument();

    const missing = deleteDesenEditorNode(document, deleteCommand({ nodeId: "missing.node" }));
    const ambiguousDelete = deleteDesenEditorNode(ambiguousDocument, deleteCommand());
    const ambiguousMove = moveDesenEditorNode(ambiguousDocument, moveCommand());
    const ambiguousReorder = reorderDesenEditorNode(ambiguousDocument, reorderCommand());
    const missingOwner = moveDesenEditorNode(document, moveCommand({ parentId: "missing.owner" }));

    expect(missing).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND" }),
      ],
    });
    expect(missingOwner).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND" }),
      ],
    });
    for (const result of [ambiguousDelete, ambiguousMove, ambiguousReorder]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_TARGET_AMBIGUOUS" }),
        ],
      });
    }
  });

  it("requires reorder membership and validates both move and reorder positions atomically", () => {
    const document = createDocument();
    const wrongSlot = reorderDesenEditorNode(document, reorderCommand({ slot: "other" }));
    const wrongOwner = reorderDesenEditorNode(
      document,
      reorderCommand({ parentId: "sign-in.email" }),
    );
    const reorderOverflow = reorderDesenEditorNode(document, reorderCommand({ index: 5 }));
    const moveOverflow = moveDesenEditorNode(
      document,
      moveCommand({ parentId: "sign-in.layout", slot: "other", index: 1 }),
    );

    for (const result of [wrongSlot, wrongOwner]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND" }),
        ],
      });
    }
    for (const result of [reorderOverflow, moveOverflow]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID" }),
        ],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
    }
    expect(document).toEqual(validSource);
  });

  it("rejects malformed commands, extra authority, symbols, prototypes, and active properties", () => {
    const document = createDocument();
    let getterInvocations = 0;
    const accessor = moveCommand();
    Object.defineProperty(accessor, "slot", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return "active";
      },
    });

    const cases: readonly [(value: never) => unknown, unknown][] = [
      [deleteDesenEditorNode.bind(undefined, document), { ...deleteCommand(), extra: true }],
      [
        moveDesenEditorNode.bind(undefined, document),
        Object.assign(moveCommand(), { [Symbol("authority")]: true }),
      ],
      [moveDesenEditorNode.bind(undefined, document), accessor],
      [moveDesenEditorNode.bind(undefined, document), { ...moveCommand(), index: -1 }],
      [reorderDesenEditorNode.bind(undefined, document), { ...reorderCommand(), index: 0.5 }],
      [
        reorderDesenEditorNode.bind(undefined, document),
        Object.assign(Object.create({ inheritedAuthority: true }) as object, reorderCommand()),
      ],
    ];
    for (const [invoke, command] of cases) {
      const result = invoke(command as never) as ReturnType<typeof moveDesenEditorNode>;
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID" }),
        ],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
    }
    expect(getterInvocations).toBe(0);
  });

  it("creates and addresses Object.prototype-named slots only as own data", () => {
    const inheritedConstructor = Object.prototype.constructor;
    const document = createDocument();

    const moved = moveDesenEditorNode(
      document,
      moveCommand({ parentId: "sign-in.email", slot: "constructor", index: 0 }),
    );

    expect(moved.ok).toBe(true);
    if (!moved.ok) throw new TypeError("Expected prototype-slot-safe move success.");
    const slots = moved.document.surfaces["sign-in"]?.root.slots?.default?.[0]?.slots;
    const constructorSlot = slots?.["constructor" as string];
    expect(Object.hasOwn(slots ?? {}, "constructor")).toBe(true);
    expect(constructorSlot?.map((node) => node.id)).toEqual(["sign-in.title"]);
    expect(Object.prototype.constructor).toBe(inheritedConstructor);
  });

  it("preserves structural diagnostics for a forged current Source", () => {
    const forged = clone(validSource) as MutableRecord;
    forged.kind = "desen.bundle";

    const result = deleteDesenEditorNode(forged as unknown as DesenEditorDocument, deleteCommand());

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_INVALID", pointer: "/kind" }),
    );
    expect(Object.hasOwn(result, "document")).toBe(false);
    expect(Object.isFrozen(forged)).toBe(false);
  });

  it("accepts a resulting depth of 64 and rejects a move that would create depth 65", () => {
    function sourceWithDestinationDepth(depth: number) {
      const input = clone(validSource);
      const surface = record(record(record(input).surfaces)["sign-in"]);
      const root = record(surface.root);
      const target = { id: "depth.target", use: "com.example.ui/Text" };
      const chainRoot = { id: "depth.1", use: "com.example.ui/Stack", slots: {} };
      root.slots = { target: [target], chain: [chainRoot] };
      let parent = chainRoot as MutableRecord;
      for (let index = 2; index <= depth; index += 1) {
        const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
        parent.slots = { default: [child] };
        parent = child;
      }
      return { input, parentId: parent.id as string };
    }

    const exact = sourceWithDestinationDepth(63);
    const crossing = sourceWithDestinationDepth(64);
    const accepted = moveDesenEditorNode(
      createDocument(exact.input),
      moveCommand({ nodeId: "depth.target", parentId: exact.parentId }),
    );
    const rejected = moveDesenEditorNode(
      createDocument(crossing.input),
      moveCommand({ nodeId: "depth.target", parentId: crossing.parentId }),
    );

    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED" }),
      ],
    });
  });

  it("admits exactly 25,000 surface identities and rejects the next occurrence", () => {
    function sourceWithIdentityCount(count: number) {
      const input = clone(validSource);
      const surface = record(record(record(input).surfaces)["sign-in"]);
      const root = record(surface.root);
      root.slots = {
        default: Array.from({ length: count - 1 }, (_, index) => ({
          id: `item.${index}`,
          use: "com.example.ui/Text",
        })),
      };
      return input;
    }

    const acceptedDocument = createDocument(sourceWithIdentityCount(25_000));
    const rejectedDocument = createDocument(sourceWithIdentityCount(25_001));
    const accepted = reorderDesenEditorNode(acceptedDocument, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      nodeId: "item.24998",
      index: 24_998,
    });
    const rejected = deleteDesenEditorNode(rejectedDocument, {
      surfaceId: "sign-in",
      nodeId: "item.24999",
    });

    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED" }),
      ],
    });
  }, 30_000);

  it("admits an exact 8 MiB Source and rejects a one-byte crossing before mutation", () => {
    function sizedSource(extraBytes: number) {
      const input = clone(validSource) as MutableRecord;
      input.authoring = { padding: "" };
      const baseLength = canonicalizeJsonBytes(input).byteLength;
      record(input.authoring).padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
      return input;
    }

    const acceptedDocument = createDocument(sizedSource(0));
    const rejectedDocument = createDocument(sizedSource(1));
    const accepted = reorderDesenEditorNode(acceptedDocument, reorderCommand());
    const rejected = reorderDesenEditorNode(rejectedDocument, reorderCommand());

    expect(canonicalizeJsonBytes(acceptedDocument)).toHaveLength(DOCUMENT_LIMIT);
    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED" }),
      ],
    });
  }, 30_000);
});
