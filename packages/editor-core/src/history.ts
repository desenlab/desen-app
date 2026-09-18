import { canonicalizeJsonBytes } from "@desen/protocol";

import { createDesenEditorDocument } from "./source-document.js";
import { insertDesenEditorSubtree } from "./stable-id-insert.js";

import type { DesenEditorDocument } from "./source-document.js";

const EMPTY: readonly [] = Object.freeze([]);
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_CLIPBOARD_NODES = 256;
const MAX_CLIPBOARD_BYTES = 8_388_608;
const MAX_SOURCE_TREE_DEPTH = 64;

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];

type MutableJson<Value> = Value extends null | boolean | number | string
  ? Value
  : Value extends readonly (infer Item)[]
    ? MutableJson<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: MutableJson<Value[Key]> }
      : never;

type MutableNode = MutableJson<EditorNode>;

export type DesenEditorHistoryDiagnosticCode =
  | "run.desen.editor/HISTORY_EMPTY"
  | "run.desen.editor/HISTORY_LIMIT_INVALID"
  | "run.desen.editor/HISTORY_DOCUMENT_INVALID"
  | "run.desen.editor/CLIPBOARD_INVALID"
  | "run.desen.editor/CLIPBOARD_LIMIT_EXCEEDED"
  | "run.desen.editor/CLIPBOARD_TARGET_INVALID"
  | "run.desen.editor/CLIPBOARD_IDENTITY_INVALID"
  | "run.desen.editor/CLIPBOARD_REFERENCE_INVALID";

export interface DesenEditorHistoryDiagnostic {
  readonly code: DesenEditorHistoryDiagnosticCode;
  readonly message: string;
}

export interface DesenEditorHistoryEntry {
  readonly document: DesenEditorDocument;
}

export interface DesenEditorHistory {
  readonly document: DesenEditorDocument;
  readonly future: readonly DesenEditorHistoryEntry[];
  readonly limit: number;
  readonly past: readonly DesenEditorHistoryEntry[];
}

export type DesenEditorHistoryResult =
  | Readonly<{ readonly ok: true; readonly changed: boolean; readonly history: DesenEditorHistory }>
  | Readonly<{
      readonly ok: false;
      readonly diagnostics: readonly [DesenEditorHistoryDiagnostic];
      readonly history: DesenEditorHistory;
    }>;

export interface DesenEditorClipboardPayload {
  readonly kind: "desen.editor/clipboard";
  readonly version: 1;
  readonly sourceSurfaceId: string;
  readonly nodes: readonly EditorNode[];
}

export interface DesenEditorNodePlacement {
  readonly parentId: string | null;
  readonly slot: string | null;
  readonly index: number | null;
}

export type DesenEditorClipboardResult =
  | Readonly<{ readonly ok: true; readonly payload: DesenEditorClipboardPayload }>
  | Readonly<{ readonly ok: false; readonly diagnostics: readonly [DesenEditorHistoryDiagnostic] }>;

export interface DesenEditorPasteCommand {
  readonly payload: DesenEditorClipboardPayload;
  readonly surfaceId: string;
  readonly parentId: string;
  readonly slot: string;
  readonly index: number;
}

export interface DesenEditorPasteSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly insertedNodeIds: readonly string[];
}

export type DesenEditorPasteResult =
  | DesenEditorPasteSuccess
  | Readonly<{ readonly ok: false; readonly diagnostics: readonly [DesenEditorHistoryDiagnostic] }>;

const clipboardProvenance = new WeakSet<object>();

function freezeDeep<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function diagnostic(
  code: DesenEditorHistoryDiagnosticCode,
  message: string,
): Readonly<{ readonly ok: false; readonly diagnostics: readonly [DesenEditorHistoryDiagnostic] }> {
  return Object.freeze({
    ok: false as const,
    diagnostics: Object.freeze([{ code, message }] as [DesenEditorHistoryDiagnostic]),
  });
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function validHistoryLimit(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 512;
}

function captureHistoryDocument(input: unknown): DesenEditorDocument | undefined {
  const admitted = createDesenEditorDocument(input);
  return admitted.ok ? admitted.document : undefined;
}

function cloneNode(node: EditorNode): EditorNode {
  return freezeDeep(JSON.parse(JSON.stringify(node)) as EditorNode);
}

interface NodeMatch {
  readonly node: EditorNode;
  readonly parentId: string | null;
  readonly slot: string | null;
  readonly index: number | null;
}

function findNode(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
): NodeMatch | null {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return null;
  const pending: {
    readonly node: EditorNode;
    readonly depth: number;
    readonly parentId: string | null;
    readonly slot: string | null;
    readonly index: number | null;
  }[] = [{ node: surface.root, depth: 0, index: null, parentId: null, slot: null }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current.node.id === nodeId) return current;
    if (current.depth >= MAX_SOURCE_TREE_DEPTH) continue;
    for (const [slot, children] of Object.entries(current.node.slots ?? {})) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) {
          pending.push({
            node: child,
            depth: current.depth + 1,
            index,
            parentId: current.node.id,
            slot,
          });
        }
      }
    }
    for (const behavior of current.node.behaviors ?? []) {
      for (const [slot, children] of Object.entries(behavior.slots ?? {})) {
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index];
          if (child !== undefined) {
            pending.push({
              node: child,
              depth: current.depth + 1,
              index,
              parentId: behavior.id,
              slot,
            });
          }
        }
      }
    }
  }
  return null;
}

function collectNodeIdentities(node: EditorNode, output: Set<string>, depth = 0): boolean {
  if (depth > MAX_SOURCE_TREE_DEPTH || output.has(node.id)) return false;
  output.add(node.id);
  for (const behavior of node.behaviors ?? []) {
    if (output.has(behavior.id)) return false;
    output.add(behavior.id);
    for (const children of Object.values(behavior.slots ?? {})) {
      for (const child of children)
        if (!collectNodeIdentities(child, output, depth + 1)) return false;
    }
  }
  for (const children of Object.values(node.slots ?? {})) {
    for (const child of children)
      if (!collectNodeIdentities(child, output, depth + 1)) return false;
  }
  return true;
}

function allIdentities(document: DesenEditorDocument, surfaceId: string): Set<string> {
  const surface = document.surfaces[surfaceId];
  const result = new Set<string>();
  if (surface !== undefined) collectNodeIdentities(surface.root, result);
  return result;
}

function allocateIdentity(base: string, reserved: Set<string>): string {
  let candidate = `${base}.copy`;
  let suffix = 2;
  while (reserved.has(candidate)) candidate = `${base}.copy.${suffix++}`;
  reserved.add(candidate);
  return candidate;
}

function remapNode(
  node: EditorNode,
  reserved: Set<string>,
  mapping: Map<string, string>,
): EditorNode {
  const mutable = JSON.parse(JSON.stringify(node)) as MutableNode;
  const visitNode = (current: MutableNode, depth: number): void => {
    if (depth > MAX_SOURCE_TREE_DEPTH) throw new TypeError("clipboard depth exceeded");
    const oldId = current.id;
    const nextId = allocateIdentity(oldId, reserved);
    mapping.set(oldId, nextId);
    current.id = nextId;
    for (const behavior of current.behaviors ?? []) {
      const behaviorId = behavior.id;
      const nextBehaviorId = allocateIdentity(behaviorId, reserved);
      mapping.set(behaviorId, nextBehaviorId);
      behavior.id = nextBehaviorId;
      for (const children of Object.values(behavior.slots ?? {})) {
        for (const child of children) visitNode(child, depth + 1);
      }
    }
    for (const children of Object.values(current.slots ?? {})) {
      for (const child of children) visitNode(child, depth + 1);
    }
  };
  visitNode(mutable, 0);
  const rewriteReferences = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) rewriteReferences(child);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (typeof child === "string") {
        const mapped = mapping.get(child);
        if (
          mapped !== undefined &&
          /(?:Id|id|target|source|owner|node|component|behavior)/u.test(key)
        ) {
          record[key] = mapped;
        } else {
          for (const [from, to] of mapping) {
            for (const prefix of ["node.", "component.", "behavior.", "owner."]) {
              if (child === `${prefix}${from}`) record[key] = `${prefix}${to}`;
            }
          }
        }
      } else rewriteReferences(child);
    }
  };
  rewriteReferences(mutable);
  return freezeDeep(mutable as unknown as EditorNode);
}

export function createDesenEditorHistory(
  document: DesenEditorDocument,
  limit: number = DEFAULT_HISTORY_LIMIT,
): DesenEditorHistory | undefined {
  if (!validHistoryLimit(limit)) return undefined;
  return Object.freeze({ document, future: EMPTY, limit, past: EMPTY });
}

export function recordDesenEditorHistory(
  history: DesenEditorHistory,
  document: DesenEditorDocument,
): DesenEditorHistory {
  if (document === history.document) return history;
  return Object.freeze({
    document,
    future: EMPTY,
    limit: history.limit,
    past: Object.freeze(
      [...history.past, Object.freeze({ document: history.document })].slice(-history.limit),
    ),
  });
}

export function undoDesenEditorHistory(history: DesenEditorHistory): DesenEditorHistoryResult {
  const entry = history.past.at(-1);
  if (entry === undefined)
    return diagnostic(
      "run.desen.editor/HISTORY_EMPTY",
      "No authored edit is available to undo.",
    ) as never;
  return Object.freeze({
    ok: true as const,
    changed: true,
    history: Object.freeze({
      document: entry.document,
      future: Object.freeze([{ document: history.document }, ...history.future]),
      limit: history.limit,
      past: Object.freeze(history.past.slice(0, -1)),
    }),
  });
}

export function redoDesenEditorHistory(history: DesenEditorHistory): DesenEditorHistoryResult {
  const entry = history.future[0];
  if (entry === undefined)
    return diagnostic(
      "run.desen.editor/HISTORY_EMPTY",
      "No authored edit is available to redo.",
    ) as never;
  return Object.freeze({
    ok: true as const,
    changed: true,
    history: Object.freeze({
      document: entry.document,
      future: Object.freeze(history.future.slice(1)),
      limit: history.limit,
      past: Object.freeze([...history.past, { document: history.document }].slice(-history.limit)),
    }),
  });
}

export function captureDesenEditorClipboard(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeIds: readonly string[],
): DesenEditorClipboardResult {
  if (
    !validIdentifier(surfaceId) ||
    !Array.isArray(nodeIds) ||
    nodeIds.length === 0 ||
    nodeIds.length > MAX_CLIPBOARD_NODES
  ) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Clipboard selection is not a bounded node list.",
    ) as never;
  }
  const unique = new Set<string>();
  const nodes: EditorNode[] = [];
  for (const nodeId of nodeIds) {
    if (!validIdentifier(nodeId) || unique.has(nodeId))
      return diagnostic(
        "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
        "Clipboard selection contains a duplicate or invalid identity.",
      ) as never;
    unique.add(nodeId);
    const match = findNode(document, surfaceId, nodeId);
    if (match === null || match.parentId === null)
      return diagnostic(
        "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
        "Clipboard selection contains a missing or non-copyable node.",
      ) as never;
    nodes.push(cloneNode(match.node));
  }
  const selectedIds = new Set(nodeIds);
  const containsAnotherSelection = (node: EditorNode): boolean => {
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) {
        if (selectedIds.has(child.id) || containsAnotherSelection(child)) return true;
      }
    }
    for (const behavior of node.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) {
        for (const child of children) {
          if (selectedIds.has(child.id) || containsAnotherSelection(child)) return true;
        }
      }
    }
    return false;
  };
  if (nodes.some(containsAnotherSelection)) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
      "Clipboard selection cannot contain both a node and one of its descendants.",
    ) as never;
  }
  const payload = freezeDeep({
    kind: "desen.editor/clipboard" as const,
    version: 1 as const,
    sourceSurfaceId: surfaceId,
    nodes: Object.freeze(nodes),
  });
  if (canonicalizeJsonBytes(payload).byteLength > MAX_CLIPBOARD_BYTES)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_LIMIT_EXCEEDED",
      "Clipboard payload exceeds the bounded transfer budget.",
    ) as never;
  clipboardProvenance.add(payload);
  return Object.freeze({ ok: true as const, payload });
}

/** Returns the current owning slot of one component node without exposing mutable tree authority. */
export function readDesenEditorNodePlacement(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
): DesenEditorNodePlacement | null {
  const match = findNode(document, surfaceId, nodeId);
  return match === null
    ? null
    : Object.freeze({ parentId: match.parentId, slot: match.slot, index: match.index });
}

export function pasteDesenEditorClipboard(
  document: DesenEditorDocument,
  command: DesenEditorPasteCommand,
): DesenEditorPasteResult {
  if (!clipboardProvenance.has(command?.payload as object))
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Only an App-captured clipboard payload may be pasted.",
    ) as never;
  if (
    !validIdentifier(command.surfaceId) ||
    !validIdentifier(command.parentId) ||
    !validIdentifier(command.slot) ||
    !Number.isSafeInteger(command.index) ||
    command.index < 0
  ) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_TARGET_INVALID",
      "Clipboard target is not a valid named slot boundary.",
    ) as never;
  }
  if (document.surfaces[command.surfaceId] === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_TARGET_INVALID",
      "Clipboard target surface does not exist.",
    ) as never;
  const reserved = allIdentities(document, command.surfaceId);
  let current = document;
  const insertedNodeIds: string[] = [];
  let index = command.index;
  const mapping = new Map<string, string>();
  for (const node of command.payload.nodes) {
    let remapped: EditorNode;
    try {
      remapped = remapNode(node, reserved, mapping);
    } catch {
      return diagnostic(
        "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
        "Clipboard identity remapping failed atomically.",
      ) as never;
    }
    const inserted = insertDesenEditorSubtree(current, {
      surfaceId: command.surfaceId,
      parentId: command.parentId,
      slot: command.slot,
      index,
      subtree: remapped,
    });
    if (!inserted.ok)
      return diagnostic(
        "run.desen.editor/CLIPBOARD_TARGET_INVALID",
        "Clipboard insertion was rejected without a partial document.",
      ) as never;
    current = inserted.document;
    insertedNodeIds.push(inserted.insertedNodeId);
    index += 1;
  }
  const admitted = captureHistoryDocument(current);
  if (admitted === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
      "Clipboard result failed structural admission.",
    ) as never;
  return Object.freeze({
    ok: true as const,
    document: admitted,
    insertedNodeIds: Object.freeze(insertedNodeIds),
  });
}
