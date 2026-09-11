import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { createDesenEditorDocument, insertDesenEditorSubtree } from "../src/index.js";

import type {
  DesenEditorDocument,
  DesenEditorSubtreeInsertCommand,
  DesenEditorSubtreeInsertResult,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function createDocument(input: unknown = clone(validSource)): DesenEditorDocument {
  const result = createDesenEditorDocument(input);
  if (!result.ok) throw new TypeError("Expected a structurally valid editor fixture.");
  return result.document;
}

function starterDialogSubtree() {
  return {
    id: "starter.dialog",
    use: "run.desen.starter/Dialog",
    props: {
      triggerLabel: "Open",
      title: "Welcome",
      description: "Complete the next step.",
      closeLabel: "Close",
      disabled: false,
    },
    slots: {
      content: [
        {
          id: "starter.dialog.content",
          use: "run.desen.starter/Button",
          props: { label: "Continue", disabled: false, loading: false },
        },
      ],
    },
  } satisfies DesenEditorSubtreeInsertCommand["subtree"];
}

function insert(
  document: DesenEditorDocument,
  overrides: Partial<DesenEditorSubtreeInsertCommand> = {},
): DesenEditorSubtreeInsertResult {
  return insertDesenEditorSubtree(document, {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    index: 2,
    subtree: starterDialogSubtree(),
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

describe("insertDesenEditorSubtree", () => {
  it("atomically inserts one complete exact-ID subtree at the requested ordered boundary", () => {
    const document = createDocument();
    const beforeBytes = canonicalizeJsonBytes(document);
    const subtree = starterDialogSubtree();
    const command: DesenEditorSubtreeInsertCommand = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 2,
      subtree,
    };

    const result = insertDesenEditorSubtree(document, command);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected subtree insertion success.");
    const children = result.document.surfaces["sign-in"]?.root.slots?.default ?? [];
    expect(children.map((child) => child.id)).toEqual([
      "sign-in.title",
      "sign-in.email",
      "starter.dialog",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ]);
    expect(children[2]).toEqual(subtree);
    expect(result.insertedNodeId).toBe("starter.dialog");
    expect(result.diagnostics).toEqual([]);
    expect(result.document).not.toBe(document);
    expect(canonicalizeJsonBytes(document)).toEqual(beforeBytes);
    expectDeepFrozen(result);

    subtree.props.title = "Caller mutation";
    const callerChild = subtree.slots.content[0];
    if (callerChild === undefined) throw new TypeError("Expected the caller-owned child fixture.");
    callerChild.props.label = "Caller mutation";
    expect(children[2]?.props?.title).toBe("Welcome");
    expect(children[2]?.slots?.content?.[0]?.props?.label).toBe("Continue");
  });

  it("rejects collisions with existing node or behavior identities without remapping", () => {
    const document = createDocument();
    const nodeCollision = insert(document, {
      subtree: { id: "sign-in.title", use: "run.desen.starter/Button" },
    });

    const withBehavior = starterDialogSubtree() as MutableRecord;
    withBehavior.behaviors = [{ id: "sign-in.submit", use: "com.example.interactions/Focusable" }];
    const behaviorCollision = insert(document, {
      subtree: withBehavior as DesenEditorSubtreeInsertCommand["subtree"],
    });

    for (const result of [nodeCollision, behaviorCollision]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "run.desen.editor/INSERT_IDENTITY_COLLISION" }),
        ],
      });
      expect(Object.hasOwn(result, "document")).toBe(false);
      expect(Object.hasOwn(result, "insertedNodeId")).toBe(false);
      expectDeepFrozen(result);
    }
  });

  it("rejects identities repeated within the supplied subtree", () => {
    const subtree = starterDialogSubtree();
    const contentChild = subtree.slots.content[0];
    if (contentChild === undefined) throw new TypeError("Expected the child fixture.");
    contentChild.id = subtree.id;

    const result = insert(createDocument(), { subtree });

    expect(result).toEqual({
      ok: false,
      diagnostics: [
        expect.objectContaining({ code: "run.desen.editor/INSERT_IDENTITY_COLLISION" }),
      ],
    });
  });

  it("retains target and slot-boundary failure semantics", () => {
    const document = createDocument();
    const missing = insert(document, { parentId: "missing.parent" });
    const invalidPosition = insert(document, { slot: "absent", index: 1 });

    expect(missing).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_TARGET_NOT_FOUND" })],
    });
    expect(invalidPosition).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_POSITION_INVALID" })],
    });
  });

  it("rejects extra, inherited, symbol, and accessor command authority without invoking getters", () => {
    const document = createDocument();
    const base = {
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 0,
      subtree: starterDialogSubtree(),
    };
    let getterCalls = 0;
    const accessor = { ...base };
    Object.defineProperty(accessor, "subtree", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return starterDialogSubtree();
      },
    });

    const commands = [
      { ...base, executable: () => undefined },
      Object.assign({ ...base }, { [Symbol("authority")]: true }),
      Object.assign(Object.create({ inherited: true }) as object, base),
      accessor,
    ];
    for (const command of commands) {
      const result = insertDesenEditorSubtree(
        document,
        command as unknown as DesenEditorSubtreeInsertCommand,
      );
      expect(result).toEqual({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_COMMAND_INVALID" })],
      });
    }
    expect(getterCalls).toBe(0);
  });

  it("rejects active or cyclic nested subtree data without invoking accessors", () => {
    const document = createDocument();
    let getterCalls = 0;
    const activeSubtree = starterDialogSubtree() as MutableRecord;
    Object.defineProperty(activeSubtree, "props", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return {};
      },
    });
    const cyclicSubtree = starterDialogSubtree() as MutableRecord;
    cyclicSubtree.extensions = { cycle: cyclicSubtree };

    for (const subtree of [activeSubtree, cyclicSubtree]) {
      const result = insert(document, {
        subtree: subtree as DesenEditorSubtreeInsertCommand["subtree"],
      });
      expect(result).toEqual({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_COMMAND_INVALID" })],
      });
    }
    expect(getterCalls).toBe(0);
  });

  it("bounds hostile sparse width and generic JSON depth before canonical serialization", () => {
    const document = createDocument();
    const huge = starterDialogSubtree() as MutableRecord;
    huge.extensions = { values: new Array(250_001) };

    const deep = starterDialogSubtree() as MutableRecord;
    let cursor: MutableRecord = {};
    deep.extensions = cursor;
    for (let depth = 0; depth < 257; depth += 1) {
      const next: MutableRecord = {};
      cursor.next = next;
      cursor = next;
    }

    for (const subtree of [huge, deep]) {
      const result = insert(document, {
        subtree: subtree as DesenEditorSubtreeInsertCommand["subtree"],
      });
      expect(result).toEqual({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_COMMAND_INVALID" })],
      });
    }
  });

  it("enforces nested capability and resulting Source-tree limits", () => {
    const document = createDocument();
    const longCapability = `${"a".repeat(4_092)}/Text`;
    const capabilityResult = insert(document, {
      subtree: { id: "starter.long", use: longCapability },
    });

    const deepSubtree: MutableRecord = {
      id: "subtree.0",
      use: "run.desen.starter/Button",
    };
    let parent = deepSubtree;
    for (let depth = 1; depth <= 64; depth += 1) {
      const child: MutableRecord = {
        id: `subtree.${depth}`,
        use: "run.desen.starter/Button",
      };
      parent.slots = { default: [child] };
      parent = child;
    }
    const depthResult = insert(document, {
      parentId: "sign-in.title",
      slot: "content",
      index: 0,
      subtree: deepSubtree as DesenEditorSubtreeInsertCommand["subtree"],
    });

    for (const result of [capabilityResult, depthResult]) {
      expect(result).toEqual({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "run.desen.editor/INSERT_LIMIT_EXCEEDED" })],
      });
    }
  });
});
