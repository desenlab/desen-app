import { canonicalizeJsonBytes } from "@desen/protocol";

import { createDesenEditorDocument } from "./source-document.js";
import { insertDesenEditorSubtree } from "./stable-id-insert.js";

import type { DesenEditorDocument } from "./source-document.js";

const EMPTY: readonly [] = Object.freeze([]);
const DEFAULT_HISTORY_LIMIT = 100;
const MAX_CLIPBOARD_NODES = 256;
const MAX_CLIPBOARD_BYTES = 8_388_608;
const MAX_SOURCE_TREE_DEPTH = 64;
const PASTE_COMMAND_KEYS = Object.freeze(["index", "parentId", "payload", "slot", "surfaceId"]);
const PREDICATE_OPERATIONS = new Set([
  "all",
  "any",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "exists",
  "truthy",
]);

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type EditorResource = DesenEditorDocument["surfaces"][string]["resources"][string];
type EditorState = DesenEditorDocument["surfaces"][string]["state"][string];

type MutableJson<Value> = Value extends null | boolean | number | string
  ? Value
  : Value extends readonly (infer Item)[]
    ? MutableJson<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: MutableJson<Value[Key]> }
      : never;

type MutableNode = MutableJson<EditorNode>;
type MutableResource = MutableJson<EditorResource>;

/** Stable diagnostic codes emitted by bounded history and clipboard operations. */
export type DesenEditorHistoryDiagnosticCode =
  | "run.desen.editor/HISTORY_EMPTY"
  | "run.desen.editor/HISTORY_LIMIT_INVALID"
  | "run.desen.editor/HISTORY_DOCUMENT_INVALID"
  | "run.desen.editor/HISTORY_STATE_INVALID"
  | "run.desen.editor/CLIPBOARD_INVALID"
  | "run.desen.editor/CLIPBOARD_LIMIT_EXCEEDED"
  | "run.desen.editor/CLIPBOARD_TARGET_INVALID"
  | "run.desen.editor/CLIPBOARD_IDENTITY_INVALID"
  | "run.desen.editor/CLIPBOARD_REFERENCE_INVALID";

/** One immutable history/clipboard diagnostic. */
export interface DesenEditorHistoryDiagnostic {
  readonly code: DesenEditorHistoryDiagnosticCode;
  readonly message: string;
}

/** One retained immutable document snapshot. */
export interface DesenEditorHistoryEntry {
  readonly document: DesenEditorDocument;
}

/** Bounded immutable undo/redo state owned by the editor host. */
export interface DesenEditorHistory {
  readonly document: DesenEditorDocument;
  readonly future: readonly DesenEditorHistoryEntry[];
  readonly limit: number;
  readonly past: readonly DesenEditorHistoryEntry[];
}

/** Result of an undo/redo transition, preserving the prior state on failure. */
export type DesenEditorHistoryResult =
  | Readonly<{ readonly ok: true; readonly changed: boolean; readonly history: DesenEditorHistory }>
  | Readonly<{
      readonly ok: false;
      readonly diagnostics: readonly [DesenEditorHistoryDiagnostic];
      readonly history: DesenEditorHistory;
    }>;

/** App-owned clipboard payload with provenance and bounded node contents. */
export interface DesenEditorClipboardPayload {
  readonly kind: "desen.editor/clipboard";
  readonly version: 1;
  readonly sourceSurfaceId: string;
  readonly state: Readonly<Record<string, EditorState>>;
  readonly resources: Readonly<Record<string, EditorResource>>;
  readonly nodes: readonly EditorNode[];
}

/** Current owning slot placement of a component node. */
export interface DesenEditorNodePlacement {
  readonly parentId: string | null;
  readonly slot: string | null;
  readonly index: number | null;
}

/** Result of capturing a bounded clipboard payload. */
export type DesenEditorClipboardResult =
  | Readonly<{ readonly ok: true; readonly payload: DesenEditorClipboardPayload }>
  | Readonly<{ readonly ok: false; readonly diagnostics: readonly [DesenEditorHistoryDiagnostic] }>;

/** Target and payload for one identity-remapped paste operation. */
export interface DesenEditorPasteCommand {
  readonly payload: DesenEditorClipboardPayload;
  readonly surfaceId: string;
  readonly parentId: string;
  readonly slot: string;
  readonly index: number;
}

/** Successful paste result containing the new document and identities. */
export interface DesenEditorPasteSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly insertedNodeIds: readonly string[];
}

/** Result of a paste operation, with no partial document on failure. */
export type DesenEditorPasteResult =
  | DesenEditorPasteSuccess
  | Readonly<{ readonly ok: false; readonly diagnostics: readonly [DesenEditorHistoryDiagnostic] }>;

const clipboardProvenance = new WeakSet<object>();
const historyProvenance = new WeakSet<object>();

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
    diagnostics: Object.freeze([Object.freeze({ code, message })] as [
      DesenEditorHistoryDiagnostic,
    ]),
  });
}

function historyFailure(
  history: DesenEditorHistory,
  code: DesenEditorHistoryDiagnosticCode,
  message: string,
): Readonly<{
  readonly ok: false;
  readonly diagnostics: readonly [DesenEditorHistoryDiagnostic];
  readonly history: DesenEditorHistory;
}> {
  return Object.freeze({
    ok: false as const,
    diagnostics: Object.freeze([Object.freeze({ code, message })] as [
      DesenEditorHistoryDiagnostic,
    ]),
    history,
  });
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(value);
}

function validHistoryLimit(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 512;
}

function captureClipboardSelection(input: unknown): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 1 ||
      lengthDescriptor.value > MAX_CLIPBOARD_NODES
    ) {
      return undefined;
    }
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== length + 1 ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && (!/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length)),
      )
    ) {
      return undefined;
    }
    const captured: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured.push(descriptor.value);
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function capturePasteCommand(input: unknown): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== PASTE_COMMAND_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !PASTE_COMMAND_KEYS.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = {};
    for (const key of PASTE_COMMAND_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function captureHistoryDocument(input: unknown): DesenEditorDocument | undefined {
  try {
    const admitted = createDesenEditorDocument(input);
    return admitted.ok ? admitted.document : undefined;
  } catch {
    return undefined;
  }
}

function sameDocument(left: DesenEditorDocument, right: DesenEditorDocument): boolean {
  const leftBytes = canonicalizeJsonBytes(left);
  const rightBytes = canonicalizeJsonBytes(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
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

function readSurface(
  document: DesenEditorDocument,
  surfaceId: string,
): DesenEditorDocument["surfaces"][string] | undefined {
  return Object.hasOwn(document.surfaces, surfaceId) ? document.surfaces[surfaceId] : undefined;
}

function findNode(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
): NodeMatch | null {
  const surface = readSurface(document, surfaceId);
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

function allIdentities(document: DesenEditorDocument, surfaceId: string): Set<string> | undefined {
  const surface = readSurface(document, surfaceId);
  const result = new Set<string>();
  if (surface !== undefined && !collectNodeIdentities(surface.root, result)) return undefined;
  return result;
}

function allocateIdentity(base: string, reserved: Set<string>): string {
  // Suffix-specific truncation keeps every candidate inside the protocol's 128-character local-ID
  // cap. One more ordinal than the occupied set guarantees a free deterministic candidate.
  for (let ordinal = 1; ordinal <= reserved.size + 2; ordinal += 1) {
    const suffix = ordinal === 1 ? ".copy" : `.copy.${ordinal}`;
    const candidate = `${base.slice(0, 128 - suffix.length)}${suffix}`;
    if (candidate === base || reserved.has(candidate)) continue;
    reserved.add(candidate);
    return candidate;
  }
  throw new TypeError("clipboard identity space exhausted");
}

const BINDING_IDENTITY_LEADING_CHARACTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BINDING_IDENTITY_TRAILING_CHARACTERS = `${BINDING_IDENTITY_LEADING_CHARACTERS}_0123456789-`;

function compactBindingIdentity(ordinal: number, maxLength: number): string | undefined {
  let remainder = ordinal;
  let width = 1;
  let blockSize = BINDING_IDENTITY_LEADING_CHARACTERS.length;
  while (remainder >= blockSize) {
    remainder -= blockSize;
    width += 1;
    if (width > maxLength) return undefined;
    blockSize = Math.min(
      Number.MAX_SAFE_INTEGER,
      blockSize * BINDING_IDENTITY_TRAILING_CHARACTERS.length,
    );
  }
  const trailingWidth = width - 1;
  const trailingSpace = BINDING_IDENTITY_TRAILING_CHARACTERS.length ** trailingWidth;
  const leadingIndex = Math.floor(remainder / trailingSpace);
  let trailingRemainder = remainder % trailingSpace;
  let candidate = BINDING_IDENTITY_LEADING_CHARACTERS[leadingIndex];
  if (candidate === undefined) return undefined;
  for (let index = trailingWidth - 1; index >= 0; index -= 1) {
    const divisor = BINDING_IDENTITY_TRAILING_CHARACTERS.length ** index;
    const characterIndex = Math.floor(trailingRemainder / divisor);
    const character = BINDING_IDENTITY_TRAILING_CHARACTERS[characterIndex];
    if (character === undefined) return undefined;
    candidate += character;
    trailingRemainder %= divisor;
  }
  return candidate;
}

function allocateBindingIdentity(base: string, reserved: Set<string>, maxLength = 128): string {
  // Binding roots are dot-delimited inside `$ref` and state paths. Hyphen suffixes therefore keep
  // a copied root addressable instead of accidentally turning `copy` into a child path segment.
  // A boundary-length state path can leave no room for that suffix, so the bounded compact
  // namespace supplies a fresh valid root without lengthening the admitted path.
  if (!Number.isSafeInteger(maxLength) || maxLength < 1 || maxLength > 128) {
    throw new TypeError("clipboard binding identity length is invalid");
  }
  for (let ordinal = 1; ordinal <= reserved.size + 2; ordinal += 1) {
    const suffix = ordinal === 1 ? "-copy" : `-copy-${ordinal}`;
    if (suffix.length >= maxLength) break;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (candidate === base || reserved.has(candidate)) continue;
    reserved.add(candidate);
    return candidate;
  }
  for (let ordinal = 0; ordinal <= reserved.size + 1; ordinal += 1) {
    const candidate = compactBindingIdentity(ordinal, maxLength);
    if (candidate === undefined) break;
    if (candidate === base || reserved.has(candidate)) continue;
    reserved.add(candidate);
    return candidate;
  }
  throw new TypeError("clipboard binding identity space exhausted");
}

function mappedIdentity(mapping: ReadonlyMap<string, string>, source: string): string {
  const mapped = mapping.get(source);
  if (mapped === undefined) throw new TypeError("clipboard binding mapping is incomplete");
  return mapped;
}

interface BindingCollector {
  valid: boolean;
  readonly componentTargets: Set<string>;
  readonly operationDeclarations: Map<string, string>;
  readonly operationReferences: Set<string>;
  readonly resourceNames: Set<string>;
  readonly stateNameMaxLengths: Map<string, number>;
  readonly stateNames: Set<string>;
}

interface ClipboardDependencies {
  readonly resources: Readonly<Record<string, EditorResource>>;
  readonly state: Readonly<Record<string, EditorState>>;
}

interface BindingMappings {
  readonly operations: ReadonlyMap<string, string>;
  readonly resources: ReadonlyMap<string, string>;
  readonly state: ReadonlyMap<string, string>;
}

interface RemappedClipboard {
  readonly nodes: readonly EditorNode[];
  readonly resources: Readonly<Record<string, EditorResource>>;
  readonly state: Readonly<Record<string, EditorState>>;
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function nestedPredicateRecord(value: unknown): Record<string, unknown> | undefined {
  const record = jsonRecord(value);
  return record !== undefined &&
    Object.keys(record).length === 2 &&
    Object.hasOwn(record, "op") &&
    typeof record.op === "string" &&
    PREDICATE_OPERATIONS.has(record.op) &&
    Object.hasOwn(record, "args") &&
    Array.isArray(record.args)
    ? record
    : undefined;
}

function createBindingCollector(): BindingCollector {
  return {
    valid: true,
    componentTargets: new Set(),
    operationDeclarations: new Map(),
    operationReferences: new Set(),
    resourceNames: new Set(),
    stateNameMaxLengths: new Map(),
    stateNames: new Set(),
  };
}

function collectStatePathBinding(path: string, collector: BindingCollector): void {
  const root = path.split(".")[0];
  if (root === undefined) return;
  collector.stateNames.add(root);
  const maxRootLength = 128 - (path.length - root.length);
  const previous = collector.stateNameMaxLengths.get(root) ?? 128;
  collector.stateNameMaxLengths.set(root, Math.min(previous, maxRootLength));
}

function collectReferenceBinding(reference: string, collector: BindingCollector): void {
  const segments = reference.split(".");
  const root = segments[1];
  if (root === undefined) return;
  if (segments[0] === "state") collector.stateNames.add(root);
  if (segments[0] === "resource") collector.resourceNames.add(root);
  if (segments[0] === "operation") collector.operationReferences.add(root);
}

function collectValueBindings(value: unknown, collector: BindingCollector): void {
  if (Array.isArray(value)) {
    for (const child of value) collectValueBindings(child, collector);
    return;
  }
  const record = jsonRecord(value);
  if (record === undefined) return;
  if (typeof record.$ref === "string") {
    collectReferenceBinding(record.$ref, collector);
    if (Object.hasOwn(record, "fallback")) collectValueBindings(record.fallback, collector);
    return;
  }
  const format = jsonRecord(record.$format);
  const values = format === undefined ? undefined : jsonRecord(format.values);
  if (values !== undefined) {
    for (const child of Object.values(values)) collectValueBindings(child, collector);
    return;
  }
  if (Object.hasOwn(record, "$token")) return;
  for (const child of Object.values(record)) collectValueBindings(child, collector);
}

function collectPredicateBindings(value: unknown, collector: BindingCollector): void {
  const predicate = jsonRecord(value);
  if (predicate === undefined || !Array.isArray(predicate.args)) return;
  for (const argument of predicate.args) {
    const nested = nestedPredicateRecord(argument);
    if (nested !== undefined) {
      collectPredicateBindings(nested, collector);
    } else {
      collectValueBindings(argument, collector);
    }
  }
}

function collectStyleBindings(value: unknown, collector: BindingCollector): void {
  const style = jsonRecord(value);
  if (style === undefined) return;
  for (const partsValue of Object.values(style)) {
    const parts = jsonRecord(partsValue);
    if (parts === undefined) continue;
    for (const propertiesValue of Object.values(parts)) {
      const properties = jsonRecord(propertiesValue);
      if (properties === undefined) continue;
      for (const property of Object.values(properties)) collectValueBindings(property, collector);
    }
  }
}

function collectActionBindings(value: unknown, collector: BindingCollector): void {
  if (!Array.isArray(value)) return;
  for (const actionValue of value) {
    const action = jsonRecord(actionValue);
    if (action === undefined) continue;
    if (Object.hasOwn(action, "when")) collectPredicateBindings(action.when, collector);
    switch (action.type) {
      case "state.set": {
        if (typeof action.path === "string") collectStatePathBinding(action.path, collector);
        collectValueBindings(action.value, collector);
        break;
      }
      case "state.toggle": {
        if (typeof action.path === "string") collectStatePathBinding(action.path, collector);
        break;
      }
      case "navigate": {
        const params = jsonRecord(action.params);
        if (params !== undefined) {
          for (const parameter of Object.values(params)) collectValueBindings(parameter, collector);
        }
        break;
      }
      case "operation.invoke": {
        if (typeof action.as === "string" && typeof action.operation === "string") {
          const previous = collector.operationDeclarations.get(action.as);
          if (previous !== undefined && previous !== action.operation) collector.valid = false;
          else collector.operationDeclarations.set(action.as, action.operation);
        }
        const input = jsonRecord(action.input);
        if (input !== undefined) {
          for (const member of Object.values(input)) collectValueBindings(member, collector);
        }
        collectActionBindings(action.onSuccess, collector);
        collectActionBindings(action.onFailure, collector);
        break;
      }
      case "resource.refresh": {
        if (typeof action.resource === "string") collector.resourceNames.add(action.resource);
        break;
      }
      case "component.command": {
        if (typeof action.target === "string") collector.componentTargets.add(action.target);
        const input = jsonRecord(action.input);
        if (input !== undefined) {
          for (const member of Object.values(input)) collectValueBindings(member, collector);
        }
        break;
      }
      case "event.emit": {
        const payload = jsonRecord(action.payload);
        if (payload !== undefined) {
          for (const member of Object.values(payload)) collectValueBindings(member, collector);
        }
        break;
      }
    }
  }
}

function collectOwnerBindings(value: unknown, collector: BindingCollector): void {
  const owner = jsonRecord(value);
  if (owner === undefined) return;
  const props = jsonRecord(owner.props);
  if (props !== undefined) {
    for (const property of Object.values(props)) collectValueBindings(property, collector);
  }
  collectStyleBindings(owner.style, collector);
  const on = jsonRecord(owner.on);
  if (on !== undefined) {
    for (const actions of Object.values(on)) collectActionBindings(actions, collector);
  }
}

function collectNodeBindings(node: EditorNode, collector: BindingCollector): void {
  collectOwnerBindings(node, collector);
  if (node.when !== undefined) collectPredicateBindings(node.when, collector);
  if (node.repeat !== undefined) {
    collectValueBindings(node.repeat.items, collector);
    collectValueBindings(node.repeat.key, collector);
  }
  for (const variant of node.variants ?? []) {
    collectPredicateBindings(variant.when, collector);
    const props = variant.props ?? {};
    for (const property of Object.values(props)) collectValueBindings(property, collector);
    collectStyleBindings(variant.style, collector);
  }
  for (const behavior of node.behaviors ?? []) {
    collectOwnerBindings(behavior, collector);
    for (const children of Object.values(behavior.slots ?? {})) {
      for (const child of children) collectNodeBindings(child, collector);
    }
  }
  for (const children of Object.values(node.slots ?? {})) {
    for (const child of children) collectNodeBindings(child, collector);
  }
}

function bindingSetMatchesRecord(values: ReadonlySet<string>, record: object): boolean {
  const keys = Object.keys(record);
  return keys.length === values.size && keys.every((key) => values.has(key));
}

function operationReferencesResolve(collector: BindingCollector): boolean {
  return [...collector.operationReferences].every((alias) =>
    collector.operationDeclarations.has(alias),
  );
}

function collectSurfaceOperationAliases(node: EditorNode): ReadonlyMap<string, string> | undefined {
  const collector = createBindingCollector();
  collectNodeBindings(node, collector);
  return collector.valid ? collector.operationDeclarations : undefined;
}

function captureClipboardDependencies(
  document: DesenEditorDocument,
  surfaceId: string,
  nodes: readonly EditorNode[],
): ClipboardDependencies | undefined {
  const surface = readSurface(document, surfaceId);
  if (surface === undefined || collectSurfaceOperationAliases(surface.root) === undefined) {
    return undefined;
  }
  const collector = createBindingCollector();
  for (const node of nodes) collectNodeBindings(node, collector);
  const capturedIdentities = new Set<string>();
  if (
    nodes.some((node) => !collectNodeIdentities(node, capturedIdentities)) ||
    [...collector.componentTargets].some((target) => !capturedIdentities.has(target))
  ) {
    return undefined;
  }
  // Set iteration observes later additions, giving resource inputs a bounded dependency closure
  // while every resource definition is inspected at most once.
  for (const resourceName of collector.resourceNames) {
    if (!Object.hasOwn(surface.resources, resourceName)) return undefined;
    const resource = surface.resources[resourceName];
    if (resource === undefined) return undefined;
    for (const input of Object.values(resource.input)) collectValueBindings(input, collector);
  }
  if (
    !collector.valid ||
    !operationReferencesResolve(collector) ||
    [...collector.stateNames].some((stateName) => !Object.hasOwn(surface.state, stateName)) ||
    [...collector.resourceNames].some(
      (resourceName) => !Object.hasOwn(surface.resources, resourceName),
    )
  ) {
    return undefined;
  }
  const state = freezeDeep(
    Object.fromEntries(
      Object.entries(surface.state)
        .filter(([stateName]) => collector.stateNames.has(stateName))
        .map(([stateName, definition]) => [
          stateName,
          JSON.parse(JSON.stringify(definition)) as EditorState,
        ]),
    ),
  );
  const resources = freezeDeep(
    Object.fromEntries(
      Object.entries(surface.resources)
        .filter(([resourceName]) => collector.resourceNames.has(resourceName))
        .map(([resourceName, definition]) => [
          resourceName,
          JSON.parse(JSON.stringify(definition)) as EditorResource,
        ]),
    ),
  );
  return Object.freeze({ resources, state });
}

function inspectClipboardBindings(
  payload: DesenEditorClipboardPayload,
): BindingCollector | undefined {
  const collector = createBindingCollector();
  for (const node of payload.nodes) collectNodeBindings(node, collector);
  const capturedIdentities = new Set<string>();
  for (const resource of Object.values(payload.resources)) {
    for (const input of Object.values(resource.input)) collectValueBindings(input, collector);
  }
  if (
    !collector.valid ||
    payload.nodes.some((node) => !collectNodeIdentities(node, capturedIdentities)) ||
    [...collector.componentTargets].some((target) => !capturedIdentities.has(target)) ||
    !operationReferencesResolve(collector) ||
    !bindingSetMatchesRecord(collector.stateNames, payload.state) ||
    !bindingSetMatchesRecord(collector.resourceNames, payload.resources)
  ) {
    return undefined;
  }
  return collector;
}

function rewriteReferenceBinding(reference: string, mappings: BindingMappings): string {
  const segments = reference.split(".");
  const root = segments[1];
  if (root === undefined) return reference;
  const mapping =
    segments[0] === "state"
      ? mappings.state
      : segments[0] === "resource"
        ? mappings.resources
        : segments[0] === "operation"
          ? mappings.operations
          : undefined;
  const replacement = mapping?.get(root);
  if (replacement === undefined) return reference;
  segments[1] = replacement;
  return segments.join(".");
}

function rewriteValueBindings(value: unknown, mappings: BindingMappings): void {
  if (Array.isArray(value)) {
    for (const child of value) rewriteValueBindings(child, mappings);
    return;
  }
  const record = jsonRecord(value);
  if (record === undefined) return;
  if (typeof record.$ref === "string") {
    record.$ref = rewriteReferenceBinding(record.$ref, mappings);
    if (Object.hasOwn(record, "fallback")) rewriteValueBindings(record.fallback, mappings);
    return;
  }
  const format = jsonRecord(record.$format);
  const values = format === undefined ? undefined : jsonRecord(format.values);
  if (values !== undefined) {
    for (const child of Object.values(values)) rewriteValueBindings(child, mappings);
    return;
  }
  if (Object.hasOwn(record, "$token")) return;
  for (const child of Object.values(record)) rewriteValueBindings(child, mappings);
}

function rewritePredicateBindings(value: unknown, mappings: BindingMappings): void {
  const predicate = jsonRecord(value);
  if (predicate === undefined || !Array.isArray(predicate.args)) return;
  for (const argument of predicate.args) {
    const nested = nestedPredicateRecord(argument);
    if (nested !== undefined) {
      rewritePredicateBindings(nested, mappings);
    } else {
      rewriteValueBindings(argument, mappings);
    }
  }
}

function rewriteStyleBindings(value: unknown, mappings: BindingMappings): void {
  const style = jsonRecord(value);
  if (style === undefined) return;
  for (const partsValue of Object.values(style)) {
    const parts = jsonRecord(partsValue);
    if (parts === undefined) continue;
    for (const propertiesValue of Object.values(parts)) {
      const properties = jsonRecord(propertiesValue);
      if (properties === undefined) continue;
      for (const property of Object.values(properties)) rewriteValueBindings(property, mappings);
    }
  }
}

function rewriteActionBindings(
  value: unknown,
  mappings: BindingMappings,
  nodeIdentities: ReadonlyMap<string, string>,
): void {
  if (!Array.isArray(value)) return;
  for (const actionValue of value) {
    const action = jsonRecord(actionValue);
    if (action === undefined) continue;
    if (Object.hasOwn(action, "when")) rewritePredicateBindings(action.when, mappings);
    switch (action.type) {
      case "state.set":
      case "state.toggle": {
        if (typeof action.path === "string") {
          const segments = action.path.split(".");
          const root = segments[0];
          const replacement = root === undefined ? undefined : mappings.state.get(root);
          if (replacement !== undefined) {
            segments[0] = replacement;
            action.path = segments.join(".");
          }
        }
        if (action.type === "state.set") rewriteValueBindings(action.value, mappings);
        break;
      }
      case "navigate": {
        const params = jsonRecord(action.params);
        if (params !== undefined) {
          for (const parameter of Object.values(params)) rewriteValueBindings(parameter, mappings);
        }
        break;
      }
      case "operation.invoke": {
        if (typeof action.as === "string")
          action.as = mappings.operations.get(action.as) ?? action.as;
        const input = jsonRecord(action.input);
        if (input !== undefined) {
          for (const member of Object.values(input)) rewriteValueBindings(member, mappings);
        }
        rewriteActionBindings(action.onSuccess, mappings, nodeIdentities);
        rewriteActionBindings(action.onFailure, mappings, nodeIdentities);
        break;
      }
      case "resource.refresh": {
        if (typeof action.resource === "string") {
          action.resource = mappings.resources.get(action.resource) ?? action.resource;
        }
        break;
      }
      case "component.command": {
        if (typeof action.target === "string") {
          action.target = mappedIdentity(nodeIdentities, action.target);
        }
        const input = jsonRecord(action.input);
        if (input !== undefined) {
          for (const member of Object.values(input)) rewriteValueBindings(member, mappings);
        }
        break;
      }
      case "event.emit": {
        const payload = jsonRecord(action.payload);
        if (payload !== undefined) {
          for (const member of Object.values(payload)) rewriteValueBindings(member, mappings);
        }
        break;
      }
    }
  }
}

function rewriteOwnerBindings(
  value: unknown,
  mappings: BindingMappings,
  nodeIdentities: ReadonlyMap<string, string>,
): void {
  const owner = jsonRecord(value);
  if (owner === undefined) return;
  const props = jsonRecord(owner.props);
  if (props !== undefined) {
    for (const property of Object.values(props)) rewriteValueBindings(property, mappings);
  }
  rewriteStyleBindings(owner.style, mappings);
  const on = jsonRecord(owner.on);
  if (on !== undefined) {
    for (const actions of Object.values(on)) {
      rewriteActionBindings(actions, mappings, nodeIdentities);
    }
  }
}

function rewriteNodeBindings(
  node: MutableNode,
  mappings: BindingMappings,
  nodeIdentities: ReadonlyMap<string, string>,
): void {
  rewriteOwnerBindings(node, mappings, nodeIdentities);
  if (node.when !== undefined) rewritePredicateBindings(node.when, mappings);
  if (node.repeat !== undefined) {
    rewriteValueBindings(node.repeat.items, mappings);
    rewriteValueBindings(node.repeat.key, mappings);
  }
  for (const variant of node.variants ?? []) {
    rewritePredicateBindings(variant.when, mappings);
    for (const property of Object.values(variant.props ?? {})) {
      rewriteValueBindings(property, mappings);
    }
    rewriteStyleBindings(variant.style, mappings);
  }
  for (const behavior of node.behaviors ?? []) {
    rewriteOwnerBindings(behavior, mappings, nodeIdentities);
    for (const children of Object.values(behavior.slots ?? {})) {
      for (const child of children) rewriteNodeBindings(child, mappings, nodeIdentities);
    }
  }
  for (const children of Object.values(node.slots ?? {})) {
    for (const child of children) rewriteNodeBindings(child, mappings, nodeIdentities);
  }
}

function remapNodes(
  nodes: readonly EditorNode[],
  reserved: Set<string>,
  bindings: BindingMappings,
): readonly EditorNode[] {
  const mutableNodes = nodes.map((node) => JSON.parse(JSON.stringify(node)) as MutableNode);
  const mapping = new Map<string, string>();
  const visitNode = (current: MutableNode, depth: number): void => {
    if (depth > MAX_SOURCE_TREE_DEPTH) throw new TypeError("clipboard depth exceeded");
    const oldId = current.id;
    if (mapping.has(oldId)) throw new TypeError("clipboard identity repeated");
    const nextId = allocateIdentity(oldId, reserved);
    mapping.set(oldId, nextId);
    current.id = nextId;
    for (const behavior of current.behaviors ?? []) {
      const behaviorId = behavior.id;
      if (mapping.has(behaviorId)) throw new TypeError("clipboard identity repeated");
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
  for (const mutable of mutableNodes) visitNode(mutable, 0);
  for (const mutable of mutableNodes) rewriteNodeBindings(mutable, bindings, mapping);
  return Object.freeze(mutableNodes.map((mutable) => freezeDeep(mutable as unknown as EditorNode)));
}

function remapClipboard(
  payload: DesenEditorClipboardPayload,
  target: DesenEditorDocument["surfaces"][string],
  reservedNodeIdentities: Set<string>,
): RemappedClipboard | undefined {
  const collector = inspectClipboardBindings(payload);
  const targetOperations = collectSurfaceOperationAliases(target.root);
  if (collector === undefined || targetOperations === undefined) return undefined;
  const stateMapping = new Map<string, string>();
  const reservedState = new Set(Object.keys(target.state));
  for (const stateName of Object.keys(payload.state)) {
    stateMapping.set(
      stateName,
      allocateBindingIdentity(
        stateName,
        reservedState,
        collector.stateNameMaxLengths.get(stateName) ?? 128,
      ),
    );
  }
  const resourceMapping = new Map<string, string>();
  const reservedResources = new Set(Object.keys(target.resources));
  for (const resourceName of Object.keys(payload.resources)) {
    resourceMapping.set(resourceName, allocateBindingIdentity(resourceName, reservedResources));
  }
  const operationMapping = new Map<string, string>();
  const reservedOperations = new Set(targetOperations.keys());
  for (const operationName of collector.operationDeclarations.keys()) {
    operationMapping.set(operationName, allocateBindingIdentity(operationName, reservedOperations));
  }
  const mappings = Object.freeze({
    operations: operationMapping,
    resources: resourceMapping,
    state: stateMapping,
  });
  const state = freezeDeep(
    Object.fromEntries(
      Object.entries(payload.state).map(([stateName, definition]) => [
        mappedIdentity(stateMapping, stateName),
        JSON.parse(JSON.stringify(definition)) as EditorState,
      ]),
    ),
  ) as Readonly<Record<string, EditorState>>;
  const resources = freezeDeep(
    Object.fromEntries(
      Object.entries(payload.resources).map(([resourceName, definition]) => {
        const mutable = JSON.parse(JSON.stringify(definition)) as MutableResource;
        for (const input of Object.values(mutable.input)) rewriteValueBindings(input, mappings);
        return [mappedIdentity(resourceMapping, resourceName), mutable];
      }),
    ),
  ) as Readonly<Record<string, EditorResource>>;
  return Object.freeze({
    nodes: remapNodes(payload.nodes, reservedNodeIdentities, mappings),
    resources,
    state,
  });
}

function insertClipboardDependencies(
  document: DesenEditorDocument,
  surfaceId: string,
  remapped: RemappedClipboard,
): DesenEditorDocument | undefined {
  if (Object.keys(remapped.state).length === 0 && Object.keys(remapped.resources).length === 0) {
    return document;
  }
  const mutable = JSON.parse(JSON.stringify(document)) as MutableJson<DesenEditorDocument>;
  const surface = Object.hasOwn(mutable.surfaces, surfaceId)
    ? mutable.surfaces[surfaceId]
    : undefined;
  if (surface === undefined) return undefined;
  for (const [stateName, definition] of Object.entries(remapped.state)) {
    surface.state[stateName] = JSON.parse(JSON.stringify(definition)) as MutableJson<EditorState>;
  }
  for (const [resourceName, definition] of Object.entries(remapped.resources)) {
    surface.resources[resourceName] = JSON.parse(
      JSON.stringify(definition),
    ) as MutableJson<EditorResource>;
  }
  return captureHistoryDocument(mutable);
}

function registerHistoryAuthority(history: DesenEditorHistory): DesenEditorHistory {
  historyProvenance.add(history);
  return history;
}

function isRegisteredHistoryAuthority(history: DesenEditorHistory): boolean {
  return historyProvenance.has(history);
}

function invalidHistoryAuthority(history: DesenEditorHistory): DesenEditorHistoryResult {
  return historyFailure(
    history,
    "run.desen.editor/HISTORY_STATE_INVALID",
    "Only an Editor Core-created immutable history may transition.",
  );
}

/** Creates bounded immutable history rooted at one admitted document. */
export function createDesenEditorHistory(
  document: DesenEditorDocument,
  limit: number = DEFAULT_HISTORY_LIMIT,
): DesenEditorHistory | undefined {
  if (!validHistoryLimit(limit)) return undefined;
  const capturedDocument = captureHistoryDocument(document);
  if (capturedDocument === undefined) return undefined;
  return registerHistoryAuthority(
    Object.freeze({ document: capturedDocument, future: EMPTY, limit, past: EMPTY }),
  );
}

/** Records one independently admitted document and clears redo state. */
export function recordDesenEditorHistory(
  history: DesenEditorHistory,
  document: DesenEditorDocument,
): DesenEditorHistoryResult {
  if (!isRegisteredHistoryAuthority(history)) return invalidHistoryAuthority(history);
  const capturedDocument = captureHistoryDocument(document);
  if (capturedDocument === undefined)
    return historyFailure(
      history,
      "run.desen.editor/HISTORY_DOCUMENT_INVALID",
      "The authored document could not be admitted into history.",
    );
  if (sameDocument(capturedDocument, history.document)) {
    return Object.freeze({ ok: true as const, changed: false, history });
  }
  const nextHistory = registerHistoryAuthority(
    Object.freeze({
      document: capturedDocument,
      future: EMPTY,
      limit: history.limit,
      past: Object.freeze(
        [...history.past, Object.freeze({ document: history.document })].slice(-history.limit),
      ),
    }),
  );
  return Object.freeze({
    ok: true as const,
    changed: true,
    history: nextHistory,
  });
}

/** Moves one immutable snapshot from past to future. */
export function undoDesenEditorHistory(history: DesenEditorHistory): DesenEditorHistoryResult {
  if (!isRegisteredHistoryAuthority(history)) return invalidHistoryAuthority(history);
  const entry = history.past.at(-1);
  if (entry === undefined)
    return historyFailure(
      history,
      "run.desen.editor/HISTORY_EMPTY",
      "No authored edit is available to undo.",
    );
  const nextHistory = registerHistoryAuthority(
    Object.freeze({
      document: entry.document,
      future: Object.freeze([Object.freeze({ document: history.document }), ...history.future]),
      limit: history.limit,
      past: Object.freeze(history.past.slice(0, -1)),
    }),
  );
  return Object.freeze({
    ok: true as const,
    changed: true,
    history: nextHistory,
  });
}

/** Moves one immutable snapshot from future to past. */
export function redoDesenEditorHistory(history: DesenEditorHistory): DesenEditorHistoryResult {
  if (!isRegisteredHistoryAuthority(history)) return invalidHistoryAuthority(history);
  const entry = history.future[0];
  if (entry === undefined)
    return historyFailure(
      history,
      "run.desen.editor/HISTORY_EMPTY",
      "No authored edit is available to redo.",
    );
  const nextHistory = registerHistoryAuthority(
    Object.freeze({
      document: entry.document,
      future: Object.freeze(history.future.slice(1)),
      limit: history.limit,
      past: Object.freeze(
        [...history.past, Object.freeze({ document: history.document })].slice(-history.limit),
      ),
    }),
  );
  return Object.freeze({
    ok: true as const,
    changed: true,
    history: nextHistory,
  });
}

/** Captures selected nodes into an App-owned, bounded clipboard payload. */
export function captureDesenEditorClipboard(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeIds: readonly string[],
): DesenEditorClipboardResult {
  const capturedNodeIds = captureClipboardSelection(nodeIds);
  if (!validIdentifier(surfaceId) || capturedNodeIds === undefined) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Clipboard selection is not a bounded node list.",
    ) as never;
  }
  const admittedDocument = captureHistoryDocument(document);
  if (admittedDocument === undefined) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Clipboard source is not an admitted Source document.",
    ) as never;
  }
  if (allIdentities(admittedDocument, surfaceId) === undefined) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
      "Clipboard source contains ambiguous identities.",
    ) as never;
  }
  const unique = new Set<string>();
  const nodes: EditorNode[] = [];
  for (const nodeId of capturedNodeIds) {
    if (!validIdentifier(nodeId) || unique.has(nodeId))
      return diagnostic(
        "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
        "Clipboard selection contains a duplicate or invalid identity.",
      ) as never;
    unique.add(nodeId);
    const match = findNode(admittedDocument, surfaceId, nodeId);
    if (match === null || match.parentId === null)
      return diagnostic(
        "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
        "Clipboard selection contains a missing or non-copyable node.",
      ) as never;
    nodes.push(cloneNode(match.node));
  }
  const selectedIds = new Set(unique);
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
  const dependencies = captureClipboardDependencies(admittedDocument, surfaceId, nodes);
  if (dependencies === undefined) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
      "Clipboard selection contains an unresolved or ambiguous surface binding.",
    ) as never;
  }
  const payload = freezeDeep({
    kind: "desen.editor/clipboard" as const,
    version: 1 as const,
    sourceSurfaceId: surfaceId,
    state: dependencies.state,
    resources: dependencies.resources,
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
  const admittedDocument = captureHistoryDocument(document);
  if (admittedDocument === undefined || allIdentities(admittedDocument, surfaceId) === undefined) {
    return null;
  }
  const match = findNode(admittedDocument, surfaceId, nodeId);
  return match === null
    ? null
    : Object.freeze({ parentId: match.parentId, slot: match.slot, index: match.index });
}

/** Pastes a provenance-checked payload with fresh identities and rewritten references. */
export function pasteDesenEditorClipboard(
  document: DesenEditorDocument,
  command: DesenEditorPasteCommand,
): DesenEditorPasteResult {
  const capturedCommand = capturePasteCommand(command);
  if (capturedCommand === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Clipboard paste requires one inert exact command.",
    ) as never;
  const { index, parentId, payload, slot, surfaceId } = capturedCommand;
  if (typeof payload !== "object" || payload === null || !clipboardProvenance.has(payload))
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Only an App-captured clipboard payload may be pasted.",
    ) as never;
  const admittedDocument = captureHistoryDocument(document);
  if (admittedDocument === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_INVALID",
      "Clipboard target is not an admitted Source document.",
    ) as never;
  if (
    !validIdentifier(surfaceId) ||
    !validIdentifier(parentId) ||
    !validIdentifier(slot) ||
    !Number.isSafeInteger(index) ||
    (index as number) < 0
  ) {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_TARGET_INVALID",
      "Clipboard target is not a valid named slot boundary.",
    ) as never;
  }
  const targetSurface = readSurface(admittedDocument, surfaceId);
  if (targetSurface === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_TARGET_INVALID",
      "Clipboard target surface does not exist.",
    ) as never;
  const admittedPayload = payload as DesenEditorClipboardPayload;
  const reserved = allIdentities(admittedDocument, surfaceId);
  if (reserved === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_IDENTITY_INVALID",
      "Clipboard target contains ambiguous identities.",
    ) as never;
  let remapped: RemappedClipboard | undefined;
  try {
    // Allocate every identity before rewriting references so links between separately selected
    // roots cannot remain aliased to an original node merely because it was visited later.
    remapped = remapClipboard(admittedPayload, targetSurface, reserved);
  } catch {
    return diagnostic(
      "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
      "Clipboard identity remapping failed atomically.",
    ) as never;
  }
  if (remapped === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
      "Clipboard binding remapping failed atomically.",
    ) as never;
  let current = insertClipboardDependencies(admittedDocument, surfaceId, remapped);
  if (current === undefined)
    return diagnostic(
      "run.desen.editor/CLIPBOARD_REFERENCE_INVALID",
      "Clipboard dependencies failed structural admission.",
    ) as never;
  const insertedNodeIds: string[] = [];
  let insertionIndex = index as number;
  for (const node of remapped.nodes) {
    const inserted = insertDesenEditorSubtree(current, {
      surfaceId,
      parentId,
      slot,
      index: insertionIndex,
      subtree: node,
    });
    if (!inserted.ok)
      return diagnostic(
        "run.desen.editor/CLIPBOARD_TARGET_INVALID",
        "Clipboard insertion was rejected without a partial document.",
      ) as never;
    current = inserted.document;
    insertedNodeIds.push(inserted.insertedNodeId);
    insertionIndex += 1;
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
