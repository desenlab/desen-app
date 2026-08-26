import {
  appendJsonPointer,
  canonicalizeJson,
  canonicalizeJsonBytes,
  createJsonPointer,
} from "@desen/protocol";

import { createDesenEditorDocument } from "./source-document.js";

import type { DesenDiagnostic, DesenDiagnosticContext, JsonPointer } from "@desen/protocol";
import type { DesenStructuralDiagnostic } from "@desen/validator";
import type { DesenEditorDocument } from "./source-document.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const STATE_BINDING_EDIT_PROFILE = Object.freeze({
  maxDocumentCanonicalBytes: 8_388_608,
  maxIdentityOccurrencesPerSurface: 25_000,
  maxSourceTreeDepth: 64,
} as const);

type EditorSurface = DesenEditorDocument["surfaces"][string];
type EditorNode = EditorSurface["root"];
type EditorBehavior = NonNullable<EditorNode["behaviors"]>[number];
type EditorOwner = EditorNode | EditorBehavior;

type MutableJson<Value> = Value extends null | boolean | number | string
  ? Value
  : Value extends readonly (infer Item)[]
    ? MutableJson<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: MutableJson<Value[Key]> }
      : unknown;

type MutableEditorDocument = MutableJson<DesenEditorDocument>;
type MutableEditorSurface = MutableEditorDocument["surfaces"][string];
type MutableEditorNode = MutableEditorSurface["root"];

/** One complete structurally representable surface-local DESEN state declaration. */
export type DesenEditorStateDeclaration = EditorSurface["state"][string];

/** One complete structurally representable DESEN value at a repeat or resource-input root. */
export type DesenEditorBindingValue = EditorSurface["root"]["repeat"] extends infer Repeat
  ? Repeat extends { readonly items: infer Value }
    ? Value
    : never
  : never;

/** Stable editor-specific diagnostic codes emitted by M08-T05 state/binding commands. */
export type DesenEditorStateBindingEditDiagnosticCode =
  | "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID"
  | "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED"
  | "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND"
  | "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS"
  | "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS"
  | "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND";

/** Frozen JSON-serializable diagnostic emitted by a state/binding command. */
export type DesenEditorStateBindingEditDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorStateBindingEditDiagnosticCode>
>;

/** Exact command for inserting one complete state declaration under an absent name. */
export interface DesenEditorStateDeclarationInsertCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact absent surface-local state identifier. */
  readonly name: string;
  /** Complete state declaration to insert without reference rewriting. */
  readonly declaration: DesenEditorStateDeclaration;
}

/** Exact command for deleting one existing state declaration without cascading references. */
export interface DesenEditorStateDeclarationDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact existing surface-local state identifier. */
  readonly name: string;
}

/** Exact command for replacing one existing state declaration's complete schema. */
export interface DesenEditorStateSchemaSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact existing surface-local state identifier. */
  readonly name: string;
  /** Complete inert Draft 2020-12 schema candidate. */
  readonly schema: DesenEditorStateDeclaration["schema"];
}

/** Exact command for replacing one existing state's complete inert initial JSON value. */
export interface DesenEditorStateInitialSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact existing surface-local state identifier. */
  readonly name: string;
  /** Complete inert JSON value; marker-shaped objects remain literal state data. */
  readonly initial: DesenEditorStateDeclaration["initial"];
}

/** Exact command for replacing `repeat.items` on one node with an existing repeat. */
export interface DesenEditorNodeRepeatItemsSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Complete replacement ValueSpec. */
  readonly items: DesenEditorBindingValue;
}

/** Exact command for replacing `repeat.key` on one node with an existing repeat. */
export interface DesenEditorNodeRepeatKeySetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Complete replacement ValueSpec. */
  readonly key: DesenEditorBindingValue;
}

/** Exact command for creating or replacing one resource-input ValueSpec root. */
export interface DesenEditorResourceInputSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact existing surface-local resource-instance identifier. */
  readonly resourceId: string;
  /** Exact input member name, including empty or prototype-sensitive strings. */
  readonly name: string;
  /** Complete replacement ValueSpec. */
  readonly value: DesenEditorBindingValue;
}

/** Exact command for deleting one existing resource-input member. */
export interface DesenEditorResourceInputDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Exact existing surface-local resource-instance identifier. */
  readonly resourceId: string;
  /** Exact existing input member name. */
  readonly name: string;
}

/** Successful atomic state/binding edit with one fresh immutable direct Source snapshot. */
export interface DesenEditorStateBindingEditSuccess {
  /** Confirms that the complete state/binding edit was applied. */
  readonly ok: true;
  /** Fresh direct Source document; prior inputs remain untouched. */
  readonly document: DesenEditorDocument;
  /** Always empty after a structurally valid edit. */
  readonly diagnostics: readonly [];
}

/** Rejected state/binding edit with no partial Source snapshot. */
export interface DesenEditorStateBindingEditFailure {
  /** Confirms that no edited document was produced. */
  readonly ok: false;
  /** Nonempty frozen structural or editor-command diagnostics. */
  readonly diagnostics: readonly [
    DesenStructuralDiagnostic | DesenEditorStateBindingEditDiagnostic,
    ...(DesenStructuralDiagnostic | DesenEditorStateBindingEditDiagnostic)[],
  ];
}

/** Complete result of one M08-T05 state declaration or binding-root command. */
export type DesenEditorStateBindingEditResult =
  DesenEditorStateBindingEditFailure | DesenEditorStateBindingEditSuccess;

type OwnerMatch = Readonly<{
  readonly depth: number;
  readonly kind: "behavior" | "node";
  readonly owner: EditorOwner;
  readonly pointer: JsonPointer;
}>;

interface SurfaceInspection {
  readonly matches: readonly OwnerMatch[];
  readonly status: "inspected";
}

interface SurfaceInspectionLimit {
  readonly pointer: JsonPointer;
  readonly status: "limit-exceeded";
}

interface PreparedSurface {
  readonly document: DesenEditorDocument;
  readonly inspection: SurfaceInspection;
  readonly surfacePointer: JsonPointer;
}

type PreparedSurfaceResult =
  | Readonly<{ readonly ok: true; readonly value: PreparedSurface }>
  | Readonly<{ readonly ok: false; readonly result: DesenEditorStateBindingEditFailure }>;

type ResolvedNodeResult =
  | Readonly<{ readonly ok: true; readonly match: OwnerMatch }>
  | Readonly<{ readonly ok: false; readonly result: DesenEditorStateBindingEditFailure }>;

interface MutationIssue {
  readonly code:
    | "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND"
    | "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS"
    | "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND";
  readonly match?: OwnerMatch;
  readonly message: string;
  readonly pointer: JsonPointer;
}

type MutationResult =
  Readonly<{ readonly ok: true }> | Readonly<{ readonly ok: false; readonly issue: MutationIssue }>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string") ||
      !(keys as string[])
        .slice()
        .sort(compareText)
        .every((key, index) => key === expectedKeys[index])
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function captureJson<Value>(value: unknown): Value | undefined {
  try {
    return JSON.parse(canonicalizeJson(value)) as Value;
  } catch {
    return undefined;
  }
}

function localIdentifier(value: unknown): value is string {
  return typeof value === "string" && LOCAL_IDENTIFIER_PATTERN.test(value);
}

function stringName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    canonicalizeJson(value);
    return true;
  } catch {
    return false;
  }
}

function captureStateInsert(
  input: DesenEditorStateDeclarationInsertCommand,
): DesenEditorStateDeclarationInsertCommand | undefined {
  const fields = exactOwnData(input, ["declaration", "name", "surfaceId"]);
  if (fields === undefined || !localIdentifier(fields.name) || !localIdentifier(fields.surfaceId)) {
    return undefined;
  }
  const declaration = captureJson<DesenEditorStateDeclaration>(fields.declaration);
  return declaration === undefined
    ? undefined
    : Object.freeze({ declaration, name: fields.name, surfaceId: fields.surfaceId });
}

function captureStateDelete(
  input: DesenEditorStateDeclarationDeleteCommand,
): DesenEditorStateDeclarationDeleteCommand | undefined {
  const fields = exactOwnData(input, ["name", "surfaceId"]);
  return fields !== undefined && localIdentifier(fields.name) && localIdentifier(fields.surfaceId)
    ? Object.freeze({ name: fields.name, surfaceId: fields.surfaceId })
    : undefined;
}

function captureStateSchema(
  input: DesenEditorStateSchemaSetCommand,
): DesenEditorStateSchemaSetCommand | undefined {
  const fields = exactOwnData(input, ["name", "schema", "surfaceId"]);
  if (fields === undefined || !localIdentifier(fields.name) || !localIdentifier(fields.surfaceId)) {
    return undefined;
  }
  const schema = captureJson<DesenEditorStateDeclaration["schema"]>(fields.schema);
  return schema === undefined
    ? undefined
    : Object.freeze({ name: fields.name, schema, surfaceId: fields.surfaceId });
}

function captureStateInitial(
  input: DesenEditorStateInitialSetCommand,
): DesenEditorStateInitialSetCommand | undefined {
  const fields = exactOwnData(input, ["initial", "name", "surfaceId"]);
  if (fields === undefined || !localIdentifier(fields.name) || !localIdentifier(fields.surfaceId)) {
    return undefined;
  }
  const initial = captureJson<DesenEditorStateDeclaration["initial"]>(fields.initial);
  return initial === undefined
    ? undefined
    : Object.freeze({ initial, name: fields.name, surfaceId: fields.surfaceId });
}

function captureRepeatItems(
  input: DesenEditorNodeRepeatItemsSetCommand,
): DesenEditorNodeRepeatItemsSetCommand | undefined {
  const fields = exactOwnData(input, ["items", "nodeId", "surfaceId"]);
  if (
    fields === undefined ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const items = captureJson<DesenEditorBindingValue>(fields.items);
  return items === undefined
    ? undefined
    : Object.freeze({ items, nodeId: fields.nodeId, surfaceId: fields.surfaceId });
}

function captureRepeatKey(
  input: DesenEditorNodeRepeatKeySetCommand,
): DesenEditorNodeRepeatKeySetCommand | undefined {
  const fields = exactOwnData(input, ["key", "nodeId", "surfaceId"]);
  if (
    fields === undefined ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const key = captureJson<DesenEditorBindingValue>(fields.key);
  return key === undefined
    ? undefined
    : Object.freeze({ key, nodeId: fields.nodeId, surfaceId: fields.surfaceId });
}

function captureResourceInputSet(
  input: DesenEditorResourceInputSetCommand,
): DesenEditorResourceInputSetCommand | undefined {
  const fields = exactOwnData(input, ["name", "resourceId", "surfaceId", "value"]);
  if (
    fields === undefined ||
    !stringName(fields.name) ||
    !localIdentifier(fields.resourceId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const value = captureJson<DesenEditorBindingValue>(fields.value);
  return value === undefined
    ? undefined
    : Object.freeze({
        name: fields.name,
        resourceId: fields.resourceId,
        surfaceId: fields.surfaceId,
        value,
      });
}

function captureResourceInputDelete(
  input: DesenEditorResourceInputDeleteCommand,
): DesenEditorResourceInputDeleteCommand | undefined {
  const fields = exactOwnData(input, ["name", "resourceId", "surfaceId"]);
  return fields !== undefined &&
    stringName(fields.name) &&
    localIdentifier(fields.resourceId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        name: fields.name,
        resourceId: fields.resourceId,
        surfaceId: fields.surfaceId,
      })
    : undefined;
}

function frozenContext(
  sourceDocument: DesenEditorDocument,
  surfaceId: string,
  match?: OwnerMatch,
): Readonly<DesenDiagnosticContext> {
  const base = { documentId: sourceDocument.id, surfaceId };
  if (match === undefined) return Object.freeze(base);
  return Object.freeze({
    ...base,
    capabilityId: match.owner.use,
    subject: Object.freeze({ id: match.owner.id, kind: match.kind }),
  });
}

function editDiagnostic(
  code: DesenEditorStateBindingEditDiagnosticCode,
  message: string,
  pointer?: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): DesenEditorStateBindingEditDiagnostic {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(context === undefined ? {} : { context }),
  });
}

function editFailure(
  diagnostic: DesenStructuralDiagnostic | DesenEditorStateBindingEditDiagnostic,
  ...rest: (DesenStructuralDiagnostic | DesenEditorStateBindingEditDiagnostic)[]
): DesenEditorStateBindingEditFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      diagnostic,
      ...rest,
    ]) as DesenEditorStateBindingEditFailure["diagnostics"],
  });
}

function commandFailure(message: string): DesenEditorStateBindingEditFailure {
  return editFailure(
    editDiagnostic("run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID", message),
  );
}

function structuralFailure(
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenEditorStateBindingEditFailure {
  const first = diagnostics[0];
  return first === undefined
    ? commandFailure("The editor document could not be admitted for a state/binding edit.")
    : editFailure(first, ...diagnostics.slice(1));
}

function slotChildren(
  owner: EditorOwner,
): Readonly<Record<string, readonly EditorNode[]>> | undefined {
  return Object.hasOwn(owner, "slots") ? owner.slots : undefined;
}

function scheduleSlotChildren(
  pending: OwnerMatch[],
  owner: EditorOwner,
  ownerPointer: JsonPointer,
  depth: number,
): void {
  const slots = slotChildren(owner);
  if (slots === undefined) return;
  const slotNames = Object.keys(slots).sort(compareText);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slot = slotNames[slotIndex] as string;
    const children = slots[slot] ?? [];
    const pointer = appendJsonPointer(appendJsonPointer(ownerPointer, "slots"), slot);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) {
        pending.push(
          Object.freeze({
            depth: depth + 1,
            kind: "node",
            owner: child,
            pointer: appendJsonPointer(pointer, index),
          }),
        );
      }
    }
  }
}

function inspectSurface(
  root: EditorNode,
  rootPointer: JsonPointer,
): SurfaceInspection | SurfaceInspectionLimit {
  const pending: OwnerMatch[] = [
    Object.freeze({ depth: 0, kind: "node", owner: root, pointer: rootPointer }),
  ];
  const matches: OwnerMatch[] = [];
  let identityOccurrences = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    identityOccurrences += 1;
    if (
      identityOccurrences > STATE_BINDING_EDIT_PROFILE.maxIdentityOccurrencesPerSurface ||
      current.depth > STATE_BINDING_EDIT_PROFILE.maxSourceTreeDepth
    ) {
      return Object.freeze({ pointer: current.pointer, status: "limit-exceeded" });
    }
    matches.push(current);
    scheduleSlotChildren(pending, current.owner, current.pointer, current.depth);
    if (current.kind === "node") {
      const behaviors = (current.owner as EditorNode).behaviors ?? [];
      const pointer = appendJsonPointer(current.pointer, "behaviors");
      for (let index = behaviors.length - 1; index >= 0; index -= 1) {
        const behavior = behaviors[index];
        if (behavior !== undefined) {
          pending.push(
            Object.freeze({
              depth: current.depth,
              kind: "behavior",
              owner: behavior,
              pointer: appendJsonPointer(pointer, index),
            }),
          );
        }
      }
    }
  }
  return Object.freeze({ matches: Object.freeze(matches), status: "inspected" });
}

function prepareSurface(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
): PreparedSurfaceResult {
  const admitted = createDesenEditorDocument(editorDocument);
  if (!admitted.ok)
    return Object.freeze({ ok: false, result: structuralFailure(admitted.diagnostics) });
  if (
    canonicalizeJsonBytes(admitted.document).byteLength >
    STATE_BINDING_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
          "The editor document exceeds the finite state/binding edit profile.",
          createJsonPointer(),
          Object.freeze({ documentId: admitted.document.id }),
        ),
      ),
    });
  }
  const surfacePointer = createJsonPointer(["surfaces", surfaceId]);
  const surface = Object.hasOwn(admitted.document.surfaces, surfaceId)
    ? admitted.document.surfaces[surfaceId]
    : undefined;
  if (surface === undefined) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
          "The state/binding command targets a surface that does not exist.",
          surfacePointer,
          frozenContext(admitted.document, surfaceId),
        ),
      ),
    });
  }
  const inspection = inspectSurface(surface.root, appendJsonPointer(surfacePointer, "root"));
  if (inspection.status === "limit-exceeded") {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
          "The target surface exceeds the finite state/binding edit profile.",
          inspection.pointer,
          frozenContext(admitted.document, surfaceId),
        ),
      ),
    });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({ document: admitted.document, inspection, surfacePointer }),
  });
}

function resolveNode(
  prepared: PreparedSurface,
  surfaceId: string,
  nodeId: string,
): ResolvedNodeResult {
  const identityMatches = prepared.inspection.matches.filter((match) => match.owner.id === nodeId);
  if (
    identityMatches.length === 0 ||
    (identityMatches.length === 1 && identityMatches[0]?.kind !== "node")
  ) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
          "The state/binding command does not select a component node.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  if (identityMatches.length !== 1) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS",
          "The state/binding command identity is ambiguous in the target surface.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  return Object.freeze({ ok: true, match: identityMatches[0] as OwnerMatch });
}

function mutableDocument(sourceDocument: DesenEditorDocument): MutableEditorDocument {
  return JSON.parse(canonicalizeJson(sourceDocument)) as MutableEditorDocument;
}

function defineOwn(object: object, key: string, value: unknown): void {
  Object.defineProperty(object, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function ownRecord(object: object, key: string): Record<string, unknown> | undefined {
  if (!Object.hasOwn(object, key)) return undefined;
  const value = (object as Record<string, unknown>)[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mutationIssue(
  code: MutationIssue["code"],
  message: string,
  pointer: JsonPointer,
  match?: OwnerMatch,
): MutationResult {
  return Object.freeze({
    ok: false,
    issue: Object.freeze({ code, message, pointer, ...(match === undefined ? {} : { match }) }),
  });
}

function mutationSuccess(): MutationResult {
  return Object.freeze({ ok: true });
}

function finalizeCandidate(
  candidate: MutableEditorDocument,
  surfaceId: string,
  original: DesenEditorDocument,
): DesenEditorStateBindingEditResult {
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The target surface disappeared while preparing the state/binding edit.",
        createJsonPointer(["surfaces", surfaceId]),
        frozenContext(original, surfaceId),
      ),
    );
  }
  const inspection = inspectSurface(
    surface.root as EditorNode,
    createJsonPointer(["surfaces", surfaceId, "root"]),
  );
  if (inspection.status === "limit-exceeded") {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
        "The state/binding edit would exceed the finite target-surface profile.",
        inspection.pointer,
        frozenContext(original, surfaceId),
      ),
    );
  }
  if (
    canonicalizeJsonBytes(candidate).byteLength >
    STATE_BINDING_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
        "The state/binding edit would exceed the finite editor-document profile.",
        createJsonPointer(),
        Object.freeze({ documentId: original.id }),
      ),
    );
  }
  const admitted = createDesenEditorDocument(candidate);
  if (!admitted.ok) return structuralFailure(admitted.diagnostics);
  return Object.freeze({ ok: true, document: admitted.document, diagnostics: EMPTY_DIAGNOSTICS });
}

function applySurfaceMutation(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
  mutate: (surface: MutableEditorSurface) => MutationResult,
): DesenEditorStateBindingEditResult {
  const preparation = prepareSurface(editorDocument, surfaceId);
  if (!preparation.ok) return preparation.result;
  const candidate = mutableDocument(preparation.value.document);
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) return commandFailure("The detached edit surface disappeared.");
  const mutation = mutate(surface);
  if (!mutation.ok) {
    return editFailure(
      editDiagnostic(
        mutation.issue.code,
        mutation.issue.message,
        mutation.issue.pointer,
        frozenContext(preparation.value.document, surfaceId, mutation.issue.match),
      ),
    );
  }
  return finalizeCandidate(candidate, surfaceId, preparation.value.document);
}

function applyNodeMutation(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
  mutate: (node: MutableEditorNode, match: OwnerMatch) => MutationResult,
): DesenEditorStateBindingEditResult {
  const preparation = prepareSurface(editorDocument, surfaceId);
  if (!preparation.ok) return preparation.result;
  const resolved = resolveNode(preparation.value, surfaceId, nodeId);
  if (!resolved.ok) return resolved.result;
  const candidate = mutableDocument(preparation.value.document);
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) return commandFailure("The detached repeat-edit surface disappeared.");
  const inspection = inspectSurface(
    surface.root as EditorNode,
    appendJsonPointer(preparation.value.surfacePointer, "root"),
  );
  if (inspection.status === "limit-exceeded") {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
        "The detached repeat-edit candidate exceeds the finite profile.",
        inspection.pointer,
        frozenContext(preparation.value.document, surfaceId),
      ),
    );
  }
  const candidatePrepared: PreparedSurface = Object.freeze({
    document: candidate as unknown as DesenEditorDocument,
    inspection,
    surfacePointer: preparation.value.surfacePointer,
  });
  const candidateResolved = resolveNode(candidatePrepared, surfaceId, nodeId);
  if (!candidateResolved.ok) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS",
        "The repeat-edit target could not be reproduced in the detached candidate.",
        preparation.value.surfacePointer,
        frozenContext(preparation.value.document, surfaceId),
      ),
    );
  }
  const mutation = mutate(candidateResolved.match.owner as MutableEditorNode, resolved.match);
  if (!mutation.ok) {
    return editFailure(
      editDiagnostic(
        mutation.issue.code,
        mutation.issue.message,
        mutation.issue.pointer,
        frozenContext(preparation.value.document, surfaceId, mutation.issue.match),
      ),
    );
  }
  return finalizeCandidate(candidate, surfaceId, preparation.value.document);
}

function statePointer(surfaceId: string, name: string): JsonPointer {
  return createJsonPointer(["surfaces", surfaceId, "state", name]);
}

function resourcePointer(surfaceId: string, resourceId: string): JsonPointer {
  return createJsonPointer(["surfaces", surfaceId, "resources", resourceId]);
}

/**
 * Inserts one complete state declaration under an absent surface-local identifier.
 *
 * @remarks The command stores the declaration without renaming or rewriting any reference or
 * action. Success returns a fresh detached recursively frozen direct Source. Duplicate names,
 * invalid commands, finite-profile overflow, and structural rejection are atomic and expose no
 * partial document.
 */
export function insertDesenEditorStateDeclaration(
  editorDocument: DesenEditorDocument,
  command: DesenEditorStateDeclarationInsertCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureStateInsert(command);
  if (captured === undefined)
    return commandFailure("State-insert command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const state = surface.state as Record<string, unknown>;
    const pointer = statePointer(captured.surfaceId, captured.name);
    if (Object.hasOwn(state, captured.name)) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS",
        "The state declaration already exists.",
        pointer,
      );
    }
    defineOwn(state, captured.name, captured.declaration);
    return mutationSuccess();
  });
}

/**
 * Deletes one existing state declaration without cascading into references or actions.
 *
 * @remarks Deleting the final declaration retains the required own `state` map. Success returns a
 * fresh detached recursively frozen direct Source; missing targets and every other failure are
 * atomic and diagnostic-only.
 */
export function deleteDesenEditorStateDeclaration(
  editorDocument: DesenEditorDocument,
  command: DesenEditorStateDeclarationDeleteCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureStateDelete(command);
  if (captured === undefined)
    return commandFailure("State-delete command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const state = surface.state as Record<string, unknown>;
    const pointer = statePointer(captured.surfaceId, captured.name);
    if (!Object.hasOwn(state, captured.name)) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The state declaration does not exist.",
        pointer,
      );
    }
    Reflect.deleteProperty(state, captured.name);
    return mutationSuccess();
  });
}

/**
 * Replaces the complete schema of one existing state declaration.
 *
 * @remarks Frozen Source structural admission still validates the embedded Draft 2020-12 schema;
 * compatibility with the current initial value remains a later continuous-validation concern.
 * Success is immutable and detached, while failure exposes no partial Source.
 */
export function setDesenEditorStateSchema(
  editorDocument: DesenEditorDocument,
  command: DesenEditorStateSchemaSetCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureStateSchema(command);
  if (captured === undefined)
    return commandFailure("State-schema command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const state = surface.state as Record<string, unknown>;
    const declaration = ownRecord(state, captured.name);
    const pointer = statePointer(captured.surfaceId, captured.name);
    if (declaration === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The state declaration does not exist.",
        pointer,
      );
    }
    defineOwn(declaration, "schema", captured.schema);
    return mutationSuccess();
  });
}

/**
 * Replaces the complete inert initial JSON value of one existing state declaration.
 *
 * @remarks Marker-shaped objects such as `{ $ref: ... }` remain literal state data rather than
 * ValueSpecs. The command performs no schema-compatibility interpretation; structural admission,
 * fixed limits, immutability, and atomic failure still apply.
 */
export function setDesenEditorStateInitial(
  editorDocument: DesenEditorDocument,
  command: DesenEditorStateInitialSetCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureStateInitial(command);
  if (captured === undefined)
    return commandFailure("State-initial command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const state = surface.state as Record<string, unknown>;
    const declaration = ownRecord(state, captured.name);
    const pointer = statePointer(captured.surfaceId, captured.name);
    if (declaration === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The state declaration does not exist.",
        pointer,
      );
    }
    defineOwn(declaration, "initial", captured.initial);
    return mutationSuccess();
  });
}

/**
 * Replaces the complete `repeat.items` ValueSpec of one unique component node.
 *
 * @remarks The node must already own a complete repeat; the command does not synthesize `as` or
 * `key` and preserves repeat limits, extensions, unrelated order, and all identities. References
 * are stored whole without parsing or rewriting.
 */
export function setDesenEditorNodeRepeatItems(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeRepeatItemsSetCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureRepeatItems(command);
  if (captured === undefined)
    return commandFailure("Repeat-items command must be exact inert own data.");
  return applyNodeMutation(editorDocument, captured.surfaceId, captured.nodeId, (node, match) => {
    const repeat = ownRecord(node, "repeat");
    const pointer = appendJsonPointer(appendJsonPointer(match.pointer, "repeat"), "items");
    if (repeat === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
        "The selected node does not own a repeat to edit.",
        pointer,
        match,
      );
    }
    defineOwn(repeat, "items", captured.items);
    return mutationSuccess();
  });
}

/**
 * Replaces the complete `repeat.key` ValueSpec of one unique component node.
 *
 * @remarks The existing repeat's `items`, alias, limit, and extensions remain byte-equivalent.
 * Success returns a fresh detached frozen Source; missing, ambiguous, invalid, or over-limit
 * commands fail atomically.
 */
export function setDesenEditorNodeRepeatKey(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeRepeatKeySetCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureRepeatKey(command);
  if (captured === undefined)
    return commandFailure("Repeat-key command must be exact inert own data.");
  return applyNodeMutation(editorDocument, captured.surfaceId, captured.nodeId, (node, match) => {
    const repeat = ownRecord(node, "repeat");
    const pointer = appendJsonPointer(appendJsonPointer(match.pointer, "repeat"), "key");
    if (repeat === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
        "The selected node does not own a repeat to edit.",
        pointer,
        match,
      );
    }
    defineOwn(repeat, "key", captured.key);
    return mutationSuccess();
  });
}

/**
 * Creates or replaces one complete ValueSpec in an existing resource input map.
 *
 * @remarks Input names are arbitrary valid I-JSON strings and are always created as own data,
 * including empty or prototype-sensitive names. Catalog compatibility and reference resolution
 * remain continuous-validation concerns.
 */
export function setDesenEditorResourceInput(
  editorDocument: DesenEditorDocument,
  command: DesenEditorResourceInputSetCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureResourceInputSet(command);
  if (captured === undefined)
    return commandFailure("Resource-input-set command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const resources = surface.resources as Record<string, unknown>;
    const resource = ownRecord(resources, captured.resourceId);
    const base = resourcePointer(captured.surfaceId, captured.resourceId);
    if (resource === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The resource instance does not exist.",
        base,
      );
    }
    const input = ownRecord(resource, "input");
    if (input === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
        "The resource instance does not expose its required input map.",
        appendJsonPointer(base, "input"),
      );
    }
    defineOwn(input, captured.name, captured.value);
    return mutationSuccess();
  });
}

/**
 * Deletes one existing resource-input member while retaining the required own input map.
 *
 * @remarks Missing resources or input members fail rather than becoming silent no-ops. Success
 * preserves all unrelated values, semantic order, and identities in a fresh detached recursively
 * frozen direct Source.
 */
export function deleteDesenEditorResourceInput(
  editorDocument: DesenEditorDocument,
  command: DesenEditorResourceInputDeleteCommand,
): DesenEditorStateBindingEditResult {
  const captured = captureResourceInputDelete(command);
  if (captured === undefined)
    return commandFailure("Resource-input-delete command must be exact inert own data.");
  return applySurfaceMutation(editorDocument, captured.surfaceId, (surface) => {
    const resources = surface.resources as Record<string, unknown>;
    const resource = ownRecord(resources, captured.resourceId);
    const base = resourcePointer(captured.surfaceId, captured.resourceId);
    if (resource === undefined) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
        "The resource instance does not exist.",
        base,
      );
    }
    const input = ownRecord(resource, "input");
    const pointer = appendJsonPointer(appendJsonPointer(base, "input"), captured.name);
    if (input === undefined || !Object.hasOwn(input, captured.name)) {
      return mutationIssue(
        "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
        "The resource input member does not exist.",
        pointer,
      );
    }
    Reflect.deleteProperty(input, captured.name);
    return mutationSuccess();
  });
}
