import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { createDesenEditorDocument, insertDesenEditorNode } from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorNodeInsertCommand,
  DesenEditorNodeInsertResult,
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

function insert(
  document: DesenEditorDocument,
  overrides: Partial<DesenEditorNodeInsertCommand> = {},
): DesenEditorNodeInsertResult {
  return insertDesenEditorNode(document, {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    index: 0,
    idBase: "sign-in.inserted",
    use: "com.example.ui/Text",
    ...overrides,
  });
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

function surfaceIdentities(document: DesenEditorDocument, surfaceId: string): readonly string[] {
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

function insertedDefaultChildren(result: DesenEditorNodeInsertResult) {
  if (!result.ok) throw new TypeError("Expected insertion success.");
  return result.document.surfaces["sign-in"]?.root.slots?.default ?? [];
}

describe("insertDesenEditorNode", () => {
  it("inserts one minimal leaf at the exact ordered boundary and preserves every prior identity", () => {
    const document = createDocument();
    const beforeIds = surfaceIdentities(document, "sign-in");
    const command: DesenEditorNodeInsertCommand = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 2,
      idBase: "sign-in.help",
      use: "com.example.ui/Text",
    };

    const result = insertDesenEditorNode(document, command);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected insert success.");
    const children = insertedDefaultChildren(result);
    expect(children.map((child) => child.id)).toEqual([
      "sign-in.title",
      "sign-in.email",
      "sign-in.help",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ]);
    expect(children[2]).toEqual({ id: "sign-in.help", use: "com.example.ui/Text" });
    expect(Object.keys(children[2] ?? {}).sort()).toEqual(["id", "use"]);
    expect(result.insertedNodeId).toBe("sign-in.help");
    expect(result.diagnostics).toEqual([]);
    expect(surfaceIdentities(result.document, "sign-in")).toEqual(
      [...beforeIds, "sign-in.help"].sort(),
    );
    expect(result.document).not.toBe(document);
    expect(result.document.surfaces).not.toBe(document.surfaces);
    expect(document).toEqual(validSource);
    expect(Object.isFrozen(command)).toBe(false);
    expectDeepFrozen(result);
  });

  it("allocates the lowest free suffix deterministically without retaining either input", () => {
    const document = createDocument();
    const command = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 5,
      idBase: "sign-in.title",
      use: "com.example.ui/Text",
    } satisfies DesenEditorNodeInsertCommand;

    const first = insertDesenEditorNode(document, command);
    const second = insertDesenEditorNode(document, clone(command));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new TypeError("Expected deterministic inserts.");
    expect(first.insertedNodeId).toBe("sign-in.title-2");
    expect(second.insertedNodeId).toBe("sign-in.title-2");
    expect(first.document).toEqual(second.document);
    expect(first.document).not.toBe(second.document);
    expect(first.document.surfaces).not.toBe(second.document.surfaces);
    expect(canonicalizeJsonBytes(first.document)).toEqual(canonicalizeJsonBytes(second.document));

    record(command).idBase = "caller-mutated";
    expect(first.insertedNodeId).toBe("sign-in.title-2");
  });

  it("truncates a 128-character occupied base only enough for its collision suffix", () => {
    const input = clone(validSource);
    const root = record(record(record(input).surfaces)["sign-in"]);
    const rootNode = record(root.root);
    const idBase = `A${"b".repeat(127)}`;
    rootNode.id = idBase;
    const document = createDocument(input);

    const result = insert(document, { parentId: idBase, idBase });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected max-length allocation success.");
    expect(result.insertedNodeId).toBe(`${idBase.slice(0, 126)}-2`);
    expect(result.insertedNodeId).toHaveLength(128);
  });

  it("skips occupied suffixes and chooses the lowest free collision ordinal", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    const slots = record(root.slots);
    const children = slots.default as MutableRecord[];
    children.push({ id: "sign-in.title-2", use: "com.example.ui/Text" });

    const result = insert(createDocument(input), { idBase: "sign-in.title" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected collision allocation success.");
    expect(result.insertedNodeId).toBe("sign-in.title-3");
  });

  it("keeps identity allocation surface-local and case-sensitive", () => {
    const document = createDocument();
    const crossSurface = insert(document, {
      surfaceId: "home",
      parentId: "home.layout",
      idBase: "sign-in.title",
    });
    const caseVariant = insert(document, { idBase: "Sign-in.title" });

    expect(crossSurface.ok).toBe(true);
    expect(caseVariant.ok).toBe(true);
    if (!crossSurface.ok || !caseVariant.ok) throw new TypeError("Expected both insertions.");
    expect(crossSurface.insertedNodeId).toBe("sign-in.title");
    expect(caseVariant.insertedNodeId).toBe("Sign-in.title");
  });

  it("reserves behavior identities and can target a behavior-owned named slot", () => {
    const input = clone(validSource);
    const surface = record(record(record(input).surfaces)["sign-in"]);
    const root = record(surface.root);
    root.behaviors = [
      {
        id: "sign-in.sortable",
        use: "com.example.interactions/Sortable",
        slots: { dragPreview: [] },
      },
    ];
    const document = createDocument(input);

    const collision = insert(document, { idBase: "sign-in.sortable" });
    const behaviorSlot = insert(document, {
      parentId: "sign-in.sortable",
      slot: "dragPreview",
      idBase: "sign-in.preview",
    });

    expect(collision.ok).toBe(true);
    expect(behaviorSlot.ok).toBe(true);
    if (!collision.ok || !behaviorSlot.ok) throw new TypeError("Expected behavior-aware inserts.");
    expect(collision.insertedNodeId).toBe("sign-in.sortable-2");
    expect(
      behaviorSlot.document.surfaces["sign-in"]?.root.behaviors?.[0]?.slots?.dragPreview,
    ).toEqual([{ id: "sign-in.preview", use: "com.example.ui/Text" }]);
  });

  it("creates an absent slot only at index zero and preserves unresolved catalog semantics", () => {
    const document = createDocument();
    const accepted = insert(document, {
      slot: "notYetDeclared",
      index: 0,
      use: "com.example.unresolved/Unknown",
    });
    const rejected = insert(document, { slot: "anotherAbsentSlot", index: 1 });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new TypeError("Expected structural insert success.");
    expect(accepted.document.surfaces["sign-in"]?.root.slots?.notYetDeclared).toEqual([
      { id: "sign-in.inserted", use: "com.example.unresolved/Unknown" },
    ]);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_POSITION_INVALID" })],
    });
    expect(Object.hasOwn(rejected, "document")).toBe(false);
    expect(Object.hasOwn(rejected, "insertedNodeId")).toBe(false);
    expectDeepFrozen(rejected);
  });

  it("creates Object.prototype-named slots as own data without inherited lookup", () => {
    const document = createDocument();
    const inheritedConstructor = Object.prototype.constructor;

    const result = insert(document, {
      slot: "constructor",
      idBase: "sign-in.prototype-safe",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected prototype-named slot insertion success.");
    const slots = result.document.surfaces["sign-in"]?.root.slots;
    expect(slots === undefined ? false : Object.hasOwn(slots, "constructor")).toBe(true);
    expect(slots?.["constructor"]).toEqual([
      { id: "sign-in.prototype-safe", use: "com.example.ui/Text" },
    ]);
    expect(Object.prototype.constructor).toBe(inheritedConstructor);
  });

  it("creates the slot map for a leaf parent without widening the inserted node payload", () => {
    const document = createDocument();

    const result = insert(document, {
      parentId: "sign-in.title",
      slot: "content",
      index: 0,
      idBase: "sign-in.title.content",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected leaf-parent insertion success.");
    expect(result.document.surfaces["sign-in"]?.root.slots?.default?.[0]?.slots?.content).toEqual([
      { id: "sign-in.title.content", use: "com.example.ui/Text" },
    ]);
  });

  it("rejects missing and ambiguous identity targets without choosing a first match", () => {
    const document = createDocument();
    const missingSurface = insert(document, { surfaceId: "missing" });
    const missingParent = insert(document, { parentId: "missing.parent" });

    const ambiguousInput = clone(validSource);
    const surface = record(record(record(ambiguousInput).surfaces)["sign-in"]);
    const root = record(surface.root);
    const slots = record(root.slots);
    const children = slots.default as MutableRecord[];
    record(children[1]).id = record(children[0]).id;
    const ambiguous = insert(createDocument(ambiguousInput), {
      parentId: record(children[0]).id as string,
    });

    expect(missingSurface).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_TARGET_NOT_FOUND" })],
    });
    expect(missingParent).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_TARGET_NOT_FOUND" })],
    });
    expect(ambiguous).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_TARGET_AMBIGUOUS" })],
    });
  });

  it("rejects malformed exact-command fields, extra authority, and active properties", () => {
    const document = createDocument();
    const base = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 0,
      idBase: "sign-in.inserted",
      use: "com.example.ui/Text",
    };
    let getterInvocations = 0;
    const accessor = { ...base };
    Object.defineProperty(accessor, "idBase", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return "active";
      },
    });

    for (const command of [
      { ...base, index: -1 },
      { ...base, index: 0.5 },
      { ...base, idBase: "invalid id" },
      { ...base, slot: "invalid slot" },
      { ...base, use: "invalid" },
      { ...base, explicitId: "bypass" },
      Object.assign({ ...base }, { [Symbol("authority")]: true }),
      accessor,
      Object.assign(Object.create({ inheritedAuthority: true }) as object, base),
    ]) {
      const result = insertDesenEditorNode(
        document,
        command as unknown as DesenEditorNodeInsertCommand,
      );
      expect(result).toEqual({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_COMMAND_INVALID" })],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
    }
    expect(getterInvocations).toBe(0);
  });

  it("accepts exactly 4,096 capability-id code units and rejects 4,097", () => {
    const document = createDocument();
    const exactUse = `${"a".repeat(4_091)}/Text`;
    const crossingUse = `${"a".repeat(4_092)}/Text`;

    const accepted = insert(document, { use: exactUse });
    const rejected = insert(document, { use: crossingUse });

    expect(exactUse).toHaveLength(4_096);
    expect(crossingUse).toHaveLength(4_097);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new TypeError("Expected exact capability-id ceiling success.");
    expect(accepted.document.surfaces["sign-in"]?.root.slots?.default?.[0]?.use).toBe(exactUse);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_COMMAND_INVALID" })],
    });
  });

  it("preserves structural diagnostics when a forged current document is rejected", () => {
    const forged = clone(validSource) as MutableRecord;
    forged.kind = "desen.bundle";

    const result = insertDesenEditorNode(forged as unknown as DesenEditorDocument, {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 0,
      idBase: "sign-in.inserted",
      use: "com.example.ui/Text",
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_INVALID", pointer: "/kind" }),
    );
    expect(Object.hasOwn(result, "document")).toBe(false);
    expect(Object.isFrozen(forged)).toBe(false);
  });

  it("accepts source depth 64 and rejects an insertion that would create depth 65", () => {
    function sourceWithParentDepth(depth: number) {
      const input = clone(validSource);
      const surface = record(record(record(input).surfaces)["sign-in"]);
      const root = record(surface.root);
      root.slots = {};
      let parent = root;
      for (let index = 1; index <= depth; index += 1) {
        const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
        parent.slots = { default: [child] };
        parent = child;
      }
      return { input, parentId: parent.id as string };
    }

    const exact = sourceWithParentDepth(63);
    const crossing = sourceWithParentDepth(64);
    const accepted = insert(createDocument(exact.input), {
      parentId: exact.parentId,
      slot: "default",
    });
    const rejected = insert(createDocument(crossing.input), {
      parentId: crossing.parentId,
      slot: "default",
    });

    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_LIMIT_EXCEEDED" })],
    });
  });

  it("admits exactly 25,000 surface identities and rejects the next one", () => {
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

    const accepted = insert(createDocument(sourceWithIdentityCount(24_999)), {
      index: 24_998,
    });
    const rejected = insert(createDocument(sourceWithIdentityCount(25_000)), {
      index: 24_999,
    });

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new TypeError("Expected exact identity ceiling success.");
    expect(surfaceIdentities(accepted.document, "sign-in")).toHaveLength(25_000);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_LIMIT_EXCEEDED" })],
    });
  }, 30_000);

  it("admits an exact 8 MiB post-insert document and rejects a one-byte crossing", () => {
    function sizedSource(extraBytes: number) {
      const input = clone(validSource) as MutableRecord;
      input.authoring = { padding: "" };
      const candidate = clone(input);
      const candidateSurface = record(record(candidate.surfaces)["sign-in"]);
      const candidateRoot = record(candidateSurface.root);
      const candidateSlots = record(candidateRoot.slots);
      const candidateChildren = candidateSlots.default as unknown[];
      candidateChildren.splice(0, 0, {
        id: "sign-in.inserted",
        use: "com.example.ui/Text",
      });
      const baseLength = canonicalizeJsonBytes(candidate).byteLength;
      record(input.authoring).padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
      return input;
    }

    const accepted = insert(createDocument(sizedSource(0)));
    const rejected = insert(createDocument(sizedSource(1)));

    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new TypeError("Expected exact byte ceiling success.");
    expect(canonicalizeJsonBytes(accepted.document)).toHaveLength(DOCUMENT_LIMIT);
    expect(rejected).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_LIMIT_EXCEEDED" })],
    });
  }, 30_000);
});
