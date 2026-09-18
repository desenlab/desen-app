import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  captureDesenEditorClipboard,
  createDesenEditorDocument,
  createDesenEditorHistory,
  pasteDesenEditorClipboard,
  recordDesenEditorHistory,
  redoDesenEditorHistory,
  undoDesenEditorHistory,
} from "../src/index.js";

function document() {
  const result = createDesenEditorDocument(validSource);
  if (!result.ok) throw new TypeError("Expected a valid Source fixture.");
  return result.document;
}

describe("editor history and identity-safe clipboard", () => {
  it("keeps bounded immutable undo/redo snapshots and clears redo after a new edit", () => {
    const initial = document();
    const first = { ...initial, id: "com.example.first" };
    const second = { ...initial, id: "com.example.second" };
    const firstDocument = createDesenEditorDocument(first);
    const secondDocument = createDesenEditorDocument(second);
    if (!firstDocument.ok || !secondDocument.ok) throw new TypeError("Expected valid edits.");
    const initialHistory = createDesenEditorHistory(initial, 2);
    if (initialHistory === undefined) throw new TypeError("Expected a history.");
    const emptyUndo = undoDesenEditorHistory(initialHistory);
    expect(emptyUndo.ok).toBe(false);
    if (!emptyUndo.ok) expect(emptyUndo.history).toBe(initialHistory);
    const committed = recordDesenEditorHistory(initialHistory, firstDocument.document);
    const undone = undoDesenEditorHistory(committed);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(canonicalizeJsonBytes(undone.history.document)).toEqual(canonicalizeJsonBytes(initial));
    const redone = redoDesenEditorHistory(undone.history);
    expect(redone.ok).toBe(true);
    if (!redone.ok) return;
    expect(canonicalizeJsonBytes(redone.history.document)).toEqual(
      canonicalizeJsonBytes(firstDocument.document),
    );
    const branched = recordDesenEditorHistory(undone.history, secondDocument.document);
    expect(redoDesenEditorHistory(branched).ok).toBe(false);
  });

  it("duplicates a nested node with fresh identities and rejects a foreign payload", () => {
    const initial = document();
    const captured = captureDesenEditorClipboard(initial, "sign-in", ["sign-in.email"]);
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const pasted = pasteDesenEditorClipboard(initial, {
      payload: captured.payload,
      surfaceId: "sign-in",
      parentId: "sign-in.layout",
      slot: "default",
      index: 2,
    });
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) return;
    expect(pasted.insertedNodeIds).toEqual(["sign-in.email.copy"]);
    const children = pasted.document.surfaces["sign-in"]?.root.slots?.default ?? [];
    expect(children.map(({ id }) => id)).toContain("sign-in.email.copy");
    expect(children.find(({ id }) => id === "sign-in.email.copy")?.on).toEqual(
      children.find(({ id }) => id === "sign-in.email")?.on,
    );
    expect(
      pasteDesenEditorClipboard(initial, {
        payload: { ...captured.payload },
        surfaceId: "sign-in",
        parentId: "sign-in.layout",
        slot: "default",
        index: 0,
      }).ok,
    ).toBe(false);
    expect(canonicalizeJsonBytes(initial)).toEqual(canonicalizeJsonBytes(document()));
  });
});
