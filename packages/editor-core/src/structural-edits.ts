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
const DELETE_COMMAND_KEYS = Object.freeze(["nodeId", "surfaceId"] as const);
const MOVE_COMMAND_KEYS = Object.freeze([
  "index",
  "nodeId",
  "parentId",
  "slot",
  "surfaceId",
] as const);
const REORDER_COMMAND_KEYS = MOVE_COMMAND_KEYS;
const STRUCTURAL_EDIT_PROFILE = Object.freeze({
  maxDocumentCanonicalBytes: 8_388_608,
  maxIdentityOccurrencesPerSurface: 25_000,
  maxSourceTreeDepth: 64,
} as const);

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type EditorBehavior = NonNullable<EditorNode["behaviors"]>[number];
type EditorOwner = EditorNode | EditorBehavior;

type MutableJson<Value> = Value extends null | boolean | number | string
  ? Value
  : Value extends readonly (infer Item)[]
    ? MutableJson<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: MutableJson<Value[Key]> }
      : never;

type MutableEditorDocument = MutableJson<DesenEditorDocument>;
type MutableEditorNode = MutableEditorDocument["surfaces"][string]["root"];
type MutableEditorBehavior = NonNullable<MutableEditorNode["behaviors"]>[number];
type MutableEditorOwner = MutableEditorNode | MutableEditorBehavior;

interface CapturedDeleteCommand {
  readonly nodeId: string;
  readonly surfaceId: string;
}

interface CapturedMoveCommand {
  readonly index: number;
  readonly nodeId: string;
  readonly parentId: string;
  readonly slot: string;
  readonly surfaceId: string;
}

type CapturedReorderCommand = CapturedMoveCommand;

interface NodeSource {
  readonly children: readonly EditorNode[];
  readonly index: number;
  readonly owner: EditorOwner;
  readonly ownerPointer: JsonPointer;
  readonly slot: string;
}

type OwnerMatch =
  | Readonly<{
      depth: number;
      kind: "behavior";
      owner: EditorBehavior;
      pointer: JsonPointer;
    }>
  | Readonly<{
      depth: number;
      kind: "node";
      owner: EditorNode;
      pointer: JsonPointer;
      source: NodeSource | undefined;
    }>;

type OwnerWork = OwnerMatch;

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
  | Readonly<{ ok: true; value: PreparedSurface }>
  | Readonly<{ ok: false; result: DesenEditorStructuralEditFailure }>;

/** Stable editor-specific diagnostic codes emitted by M08-T03 structural-edit commands. */
export type DesenEditorStructuralEditDiagnosticCode =
  | "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID"
  | "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN"
  | "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED"
  | "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID"
  | "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN"
  | "run.desen.editor/STRUCTURAL_EDIT_TARGET_AMBIGUOUS"
  | "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND";

/** Frozen, JSON-serializable diagnostic emitted by a structural-edit command. */
export type DesenEditorStructuralEditDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorStructuralEditDiagnosticCode>
>;

/** Exact command for deleting one non-root component-node subtree. */
export interface DesenEditorNodeDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Stable identity of the component node whose complete subtree is removed. */
  readonly nodeId: string;
}

/** Exact command for moving one non-root component-node subtree to a different owner or slot. */
export interface DesenEditorNodeMoveCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Stable identity of the component node whose complete subtree is moved. */
  readonly nodeId: string;
  /** Stable node or behavior identity that owns the destination named slot. */
  readonly parentId: string;
  /** Exact destination slot name. */
  readonly slot: string;
  /** Zero-based insertion boundary in the destination slot before the move. */
  readonly index: number;
}

/** Exact command for reordering one direct child within one owner's existing named slot. */
export interface DesenEditorNodeReorderCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Stable node or behavior identity that owns the reordered named slot. */
  readonly parentId: string;
  /** Exact existing slot containing the direct child. */
  readonly slot: string;
  /** Stable identity of the direct component-node child to reorder. */
  readonly nodeId: string;
  /** Zero-based final position interpreted after removing the selected child. */
  readonly index: number;
}

/** Successful atomic structural edit with one fresh direct immutable Source snapshot. */
export interface DesenEditorStructuralEditSuccess {
  /** Confirms that the complete structural edit was applied. */
  readonly ok: true;
  /** New direct Source document; the prior document and command remain untouched. */
  readonly document: DesenEditorDocument;
  /** Always empty after a structurally valid edit. */
  readonly diagnostics: readonly [];
}

/** Rejected structural edit with no partial Source snapshot. */
export interface DesenEditorStructuralEditFailure {
  /** Confirms that no structural-edit result was produced. */
  readonly ok: false;
  /** Nonempty frozen structural or editor-command diagnostics. */
  readonly diagnostics: readonly [
    DesenStructuralDiagnostic | DesenEditorStructuralEditDiagnostic,
    ...(DesenStructuralDiagnostic | DesenEditorStructuralEditDiagnostic)[],
  ];
}

/** Complete result of one delete, move, or ordered-reorder command. */
export type DesenEditorStructuralEditResult =
  DesenEditorStructuralEditFailure | DesenEditorStructuralEditSuccess;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ownEnumerableDataValue(object: object, key: string): unknown | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function hasExactCommandKeys(input: unknown, expected: readonly string[]): input is object {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) return false;
    const keys = Reflect.ownKeys(input);
    return (
      keys.length === expected.length &&
      keys.every((key) => typeof key === "string") &&
      (keys as string[])
        .slice()
        .sort(compareText)
        .every((key, index) => key === expected[index])
    );
  } catch {
    return false;
  }
}

function captureDeleteCommand(
  input: DesenEditorNodeDeleteCommand,
): CapturedDeleteCommand | undefined {
  try {
    if (!hasExactCommandKeys(input, DELETE_COMMAND_KEYS)) return undefined;
    const nodeId = ownEnumerableDataValue(input, "nodeId");
    const surfaceId = ownEnumerableDataValue(input, "surfaceId");
    if (
      typeof nodeId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(nodeId) ||
      typeof surfaceId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({ nodeId, surfaceId });
  } catch {
    return undefined;
  }
}

function capturePositionCommand(
  input: DesenEditorNodeMoveCommand | DesenEditorNodeReorderCommand,
  expected: readonly string[],
): CapturedMoveCommand | undefined {
  try {
    if (!hasExactCommandKeys(input, expected)) return undefined;
    const index = ownEnumerableDataValue(input, "index");
    const nodeId = ownEnumerableDataValue(input, "nodeId");
    const parentId = ownEnumerableDataValue(input, "parentId");
    const slot = ownEnumerableDataValue(input, "slot");
    const surfaceId = ownEnumerableDataValue(input, "surfaceId");
    if (
      !Number.isSafeInteger(index) ||
      (index as number) < 0 ||
      typeof nodeId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(nodeId) ||
      typeof parentId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(parentId) ||
      typeof slot !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(slot) ||
      typeof surfaceId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({
      index: index as number,
      nodeId,
      parentId,
      slot,
      surfaceId,
    });
  } catch {
    return undefined;
  }
}

function frozenContext(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
  match?: OwnerMatch,
): Readonly<DesenDiagnosticContext> {
  const base = { documentId: editorDocument.id, surfaceId };
  if (match === undefined) return Object.freeze(base);
  return Object.freeze({
    ...base,
    subject: Object.freeze({ kind: match.kind, id: match.owner.id }),
    capabilityId: match.owner.use,
  });
}

function editDiagnostic(
  code: DesenEditorStructuralEditDiagnosticCode,
  message: string,
  pointer?: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): DesenEditorStructuralEditDiagnostic {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(context === undefined ? {} : { context }),
  });
}

function editFailure(
  diagnostic: DesenStructuralDiagnostic | DesenEditorStructuralEditDiagnostic,
  ...rest: (DesenStructuralDiagnostic | DesenEditorStructuralEditDiagnostic)[]
): DesenEditorStructuralEditFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      diagnostic,
      ...rest,
    ]) as DesenEditorStructuralEditFailure["diagnostics"],
  });
}

function structuralFailure(
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenEditorStructuralEditFailure {
  const first = diagnostics[0];
  return first === undefined
    ? editFailure(
        editDiagnostic(
          "run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID",
          "The editor document could not be admitted for a structural edit.",
        ),
      )
    : editFailure(first, ...diagnostics.slice(1));
}

function slotChildren(
  owner: EditorOwner,
): Readonly<Record<string, readonly EditorNode[]>> | undefined {
  return Object.hasOwn(owner, "slots") ? owner.slots : undefined;
}

function namedSlotChildren(owner: EditorOwner, slot: string): readonly EditorNode[] | undefined {
  const slots = slotChildren(owner);
  return slots !== undefined && Object.hasOwn(slots, slot) ? slots[slot] : undefined;
}

function scheduleSlotChildren(
  pending: OwnerWork[],
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
    const slotPointer = appendJsonPointer(appendJsonPointer(ownerPointer, "slots"), slot);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child === undefined) continue;
      pending.push({
        kind: "node",
        owner: child,
        depth: depth + 1,
        pointer: appendJsonPointer(slotPointer, index),
        source: Object.freeze({ children, index, owner, ownerPointer, slot }),
      });
    }
  }
}

function inspectSurface(
  root: EditorNode,
  rootPointer: JsonPointer,
): SurfaceInspection | SurfaceInspectionLimit {
  const pending: OwnerWork[] = [
    { kind: "node", owner: root, depth: 0, pointer: rootPointer, source: undefined },
  ];
  const matches: OwnerMatch[] = [];
  let identityOccurrences = 0;

  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    identityOccurrences += 1;
    if (
      identityOccurrences > STRUCTURAL_EDIT_PROFILE.maxIdentityOccurrencesPerSurface ||
      work.depth > STRUCTURAL_EDIT_PROFILE.maxSourceTreeDepth
    ) {
      return Object.freeze({ status: "limit-exceeded", pointer: work.pointer });
    }
    matches.push(Object.freeze(work));
    scheduleSlotChildren(pending, work.owner, work.pointer, work.depth);
    if (work.kind === "node") {
      const behaviors = work.owner.behaviors ?? [];
      const behaviorsPointer = appendJsonPointer(work.pointer, "behaviors");
      for (let index = behaviors.length - 1; index >= 0; index -= 1) {
        const behavior = behaviors[index];
        if (behavior === undefined) continue;
        pending.push({
          kind: "behavior",
          owner: behavior,
          depth: work.depth,
          pointer: appendJsonPointer(behaviorsPointer, index),
        });
      }
    }
  }

  return Object.freeze({ status: "inspected", matches: Object.freeze(matches) });
}

function matchesIdentity(inspection: SurfaceInspection, id: string): readonly OwnerMatch[] {
  return inspection.matches.filter((match) => match.owner.id === id);
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
    STRUCTURAL_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
          "The editor document exceeds the finite structural-edit profile.",
          createJsonPointer(),
          Object.freeze({ documentId: admitted.document.id }),
        ),
      ),
    });
  }

  const surfacePointer = createJsonPointer(["surfaces", surfaceId]);
  if (!Object.hasOwn(admitted.document.surfaces, surfaceId)) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
          "The structural-edit command targets a surface that does not exist.",
          surfacePointer,
          frozenContext(admitted.document, surfaceId),
        ),
      ),
    });
  }
  const surface = admitted.document.surfaces[surfaceId];
  if (surface === undefined) {
    return Object.freeze({
      ok: false,
      result: editFailure(
        editDiagnostic(
          "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
          "The structural-edit command targets a surface that does not exist.",
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
          "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
          "The target surface exceeds the finite structural-edit profile.",
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

function missingTarget(
  prepared: PreparedSurface,
  surfaceId: string,
  message: string,
): DesenEditorStructuralEditFailure {
  return editFailure(
    editDiagnostic(
      "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
      message,
      prepared.surfacePointer,
      frozenContext(prepared.document, surfaceId),
    ),
  );
}

function ambiguousTarget(
  prepared: PreparedSurface,
  surfaceId: string,
  message: string,
): DesenEditorStructuralEditFailure {
  return editFailure(
    editDiagnostic(
      "run.desen.editor/STRUCTURAL_EDIT_TARGET_AMBIGUOUS",
      message,
      prepared.surfacePointer,
      frozenContext(prepared.document, surfaceId),
    ),
  );
}

function mutableDocument(editorDocument: DesenEditorDocument): MutableEditorDocument {
  return JSON.parse(canonicalizeJson(editorDocument)) as MutableEditorDocument;
}

function mutableOwner(owner: EditorOwner): MutableEditorOwner {
  return owner as MutableEditorOwner;
}

function mutableNode(node: EditorNode): MutableEditorNode {
  return node as MutableEditorNode;
}

function mutableSourceChildren(source: NodeSource): MutableEditorNode[] {
  return source.children as MutableEditorNode[];
}

function destinationChildren(
  owner: MutableEditorOwner,
  slot: string,
): MutableEditorNode[] | undefined {
  const slots = slotChildren(owner as EditorOwner);
  if (slots === undefined || !Object.hasOwn(slots, slot)) return undefined;
  return slots[slot] as MutableEditorNode[] | undefined;
}

function defineDestinationChildren(
  owner: MutableEditorOwner,
  slot: string,
  children: MutableEditorNode[],
): void {
  const existingSlots = slotChildren(owner as EditorOwner);
  const slots =
    existingSlots === undefined
      ? ({} as NonNullable<MutableEditorOwner["slots"]>)
      : (existingSlots as NonNullable<MutableEditorOwner["slots"]>);
  Object.defineProperty(slots, slot, {
    configurable: true,
    enumerable: true,
    value: children,
    writable: true,
  });
  Object.defineProperty(owner, "slots", {
    configurable: true,
    enumerable: true,
    value: slots,
    writable: true,
  });
}

function isWithinNodeSubtree(owner: OwnerMatch, node: OwnerMatch & { kind: "node" }): boolean {
  const ownerPointer = owner.pointer as string;
  const nodePointer = node.pointer as string;
  return ownerPointer === nodePointer || ownerPointer.startsWith(`${nodePointer}/`);
}

function finalizeCandidate(
  candidate: MutableEditorDocument,
  surfaceId: string,
  original: DesenEditorDocument,
): DesenEditorStructuralEditResult {
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND",
        "The edit target disappeared while preparing the immutable result.",
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
        "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
        "The structural edit would exceed the finite target-surface profile.",
        inspection.pointer,
        frozenContext(original, surfaceId),
      ),
    );
  }
  if (
    canonicalizeJsonBytes(candidate).byteLength > STRUCTURAL_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
        "The structural edit would exceed the finite editor-document profile.",
        createJsonPointer(),
        Object.freeze({ documentId: original.id }),
      ),
    );
  }
  const result = createDesenEditorDocument(candidate);
  if (!result.ok) return structuralFailure(result.diagnostics);
  return Object.freeze({ ok: true, document: result.document, diagnostics: EMPTY_DIAGNOSTICS });
}

function commandFailure(message: string): DesenEditorStructuralEditFailure {
  return editFailure(editDiagnostic("run.desen.editor/STRUCTURAL_EDIT_COMMAND_INVALID", message));
}

/**
 * Deletes one non-root component node and its complete nested node/behavior subtree.
 *
 * @remarks The exact command and current direct Source are captured before traversal. A unique
 * component-node identity is removed from its owning slot without deleting that slot key, even
 * when the retained array becomes empty. The root is never deletable. Unresolved capability and
 * slot semantics remain accepted for later continuous validation.
 *
 * The operation is atomic and bounded by the fixed 8 MiB document, 25,000 surface identity, and
 * root-at-zero depth-64 profile shared with insertion. Success returns a fresh detached recursively
 * frozen direct Source; failure exposes no partial document.
 */
export function deleteDesenEditorNode(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeDeleteCommand,
): DesenEditorStructuralEditResult {
  const captured = captureDeleteCommand(command);
  if (captured === undefined) {
    return commandFailure(
      "Delete command must contain exact inert surface and node identity fields.",
    );
  }
  const preparation = prepareSurface(editorDocument, captured.surfaceId);
  if (!preparation.ok) return preparation.result;
  const prepared = preparation.value;
  const matches = matchesIdentity(prepared.inspection, captured.nodeId);
  if (matches.length === 0 || (matches.length === 1 && matches[0]?.kind !== "node")) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The delete command node identity does not exist in the target surface.",
    );
  }
  if (matches.length !== 1) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The delete command node identity is ambiguous in the target surface.",
    );
  }
  const target = matches[0];
  if (target?.kind !== "node") {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The delete command identity does not select a component node.",
    );
  }
  if (target.source === undefined) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
        "A surface root cannot be deleted.",
        target.pointer,
        frozenContext(prepared.document, captured.surfaceId, target),
      ),
    );
  }

  const candidate = mutableDocument(prepared.document);
  const candidateSurface = candidate.surfaces[captured.surfaceId];
  if (candidateSurface === undefined)
    return missingTarget(prepared, captured.surfaceId, "The target surface disappeared.");
  const candidateInspection = inspectSurface(
    candidateSurface.root as EditorNode,
    appendJsonPointer(prepared.surfacePointer, "root"),
  );
  if (candidateInspection.status === "limit-exceeded") {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
        "The detached delete candidate exceeds the finite target-surface profile.",
        candidateInspection.pointer,
        frozenContext(prepared.document, captured.surfaceId),
      ),
    );
  }
  const candidateMatches = matchesIdentity(candidateInspection, captured.nodeId);
  const candidateTarget = candidateMatches[0];
  if (
    candidateMatches.length !== 1 ||
    candidateTarget?.kind !== "node" ||
    candidateTarget.source === undefined
  ) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The delete target could not be reproduced in the detached result candidate.",
    );
  }
  mutableSourceChildren(candidateTarget.source).splice(candidateTarget.source.index, 1);
  return finalizeCandidate(candidate, captured.surfaceId, prepared.document);
}

/**
 * Moves one non-root component-node subtree to a different owner or named slot.
 *
 * @remarks The source slot is left present when emptied. The destination may be owned by a node or
 * behavior, and an absent destination slot is created only at index zero. Moving within the same
 * owner and slot is rejected in favor of `reorderDesenEditorNode`. The destination cannot be the
 * selected node or any node/behavior inside its subtree, so the Source remains acyclic. No node or
 * behavior identity is rewritten.
 *
 * The operation is atomic and rechecks the fixed 8 MiB document, 25,000 surface identity, and
 * root-at-zero depth-64 profile on the complete result. Success returns a fresh detached recursively
 * frozen direct Source; failure exposes no partial document.
 */
export function moveDesenEditorNode(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeMoveCommand,
): DesenEditorStructuralEditResult {
  const captured = capturePositionCommand(command, MOVE_COMMAND_KEYS);
  if (captured === undefined) {
    return commandFailure(
      "Move command must contain exact inert surface, node, destination-owner, slot, and index fields.",
    );
  }
  const preparation = prepareSurface(editorDocument, captured.surfaceId);
  if (!preparation.ok) return preparation.result;
  const prepared = preparation.value;

  const targetMatches = matchesIdentity(prepared.inspection, captured.nodeId);
  if (
    targetMatches.length === 0 ||
    (targetMatches.length === 1 && targetMatches[0]?.kind !== "node")
  ) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The move command node identity does not exist in the target surface.",
    );
  }
  if (targetMatches.length !== 1) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The move command node identity is ambiguous in the target surface.",
    );
  }
  const target = targetMatches[0];
  if (target?.kind !== "node") {
    return missingTarget(prepared, captured.surfaceId, "The move target is not a component node.");
  }
  if (target.source === undefined) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
        "A surface root cannot be moved.",
        target.pointer,
        frozenContext(prepared.document, captured.surfaceId, target),
      ),
    );
  }

  const parentMatches = matchesIdentity(prepared.inspection, captured.parentId);
  if (parentMatches.length === 0) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The move destination owner does not exist in the target surface.",
    );
  }
  if (parentMatches.length !== 1) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The move destination owner is ambiguous in the target surface.",
    );
  }
  const parent = parentMatches[0] as OwnerMatch;
  if (target.source.ownerPointer === parent.pointer && target.source.slot === captured.slot) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
        "A same-owner same-slot move must use the ordered-reorder command.",
        appendJsonPointer(appendJsonPointer(parent.pointer, "slots"), captured.slot),
        frozenContext(prepared.document, captured.surfaceId, parent),
      ),
    );
  }
  if (isWithinNodeSubtree(parent, target)) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_CYCLE_FORBIDDEN",
        "A node cannot move into itself or an owner inside its subtree.",
        parent.pointer,
        frozenContext(prepared.document, captured.surfaceId, parent),
      ),
    );
  }

  const existingDestination = namedSlotChildren(parent.owner, captured.slot);
  const destinationLength = existingDestination?.length ?? 0;
  if (
    captured.index > destinationLength ||
    (existingDestination === undefined && captured.index !== 0)
  ) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
        "The move index must address an existing destination-slot boundary.",
        appendJsonPointer(appendJsonPointer(parent.pointer, "slots"), captured.slot),
        frozenContext(prepared.document, captured.surfaceId, parent),
      ),
    );
  }

  const candidate = mutableDocument(prepared.document);
  const candidateSurface = candidate.surfaces[captured.surfaceId];
  if (candidateSurface === undefined)
    return missingTarget(prepared, captured.surfaceId, "The target surface disappeared.");
  const candidateInspection = inspectSurface(
    candidateSurface.root as EditorNode,
    appendJsonPointer(prepared.surfacePointer, "root"),
  );
  if (candidateInspection.status === "limit-exceeded") {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
        "The detached move candidate exceeds the finite target-surface profile.",
        candidateInspection.pointer,
        frozenContext(prepared.document, captured.surfaceId),
      ),
    );
  }
  const candidateTargets = matchesIdentity(candidateInspection, captured.nodeId);
  const candidateParents = matchesIdentity(candidateInspection, captured.parentId);
  const candidateTarget = candidateTargets[0];
  const candidateParent = candidateParents[0];
  if (
    candidateTargets.length !== 1 ||
    candidateTarget?.kind !== "node" ||
    candidateTarget.source === undefined ||
    candidateParents.length !== 1 ||
    candidateParent === undefined
  ) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The move targets could not be reproduced in the detached result candidate.",
    );
  }

  const sourceChildren = mutableSourceChildren(candidateTarget.source);
  const removed = sourceChildren.splice(candidateTarget.source.index, 1)[0];
  if (removed === undefined) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The move source disappeared from its slot.",
    );
  }
  const mutableParent = mutableOwner(candidateParent.owner);
  const currentDestination = destinationChildren(mutableParent, captured.slot);
  const nextDestination = currentDestination ?? [];
  nextDestination.splice(captured.index, 0, mutableNode(removed as EditorNode));
  if (currentDestination === undefined) {
    defineDestinationChildren(mutableParent, captured.slot, nextDestination);
  }
  return finalizeCandidate(candidate, captured.surfaceId, prepared.document);
}

/**
 * Reorders one uniquely identified direct child within an existing owner slot.
 *
 * @remarks `index` is the final zero-based position after the selected child has been removed, so
 * moving the last child to the last position remains valid. The parent may be a component node or
 * behavior. The command never changes identities, deletes the slot key, or crosses owner/slot
 * boundaries; use `moveDesenEditorNode` for those transitions.
 *
 * The operation is atomic and bounded by the fixed 8 MiB document, 25,000 surface identity, and
 * root-at-zero depth-64 profile. Even a semantic no-op returns a fresh detached recursively frozen
 * direct Source, while failure exposes no partial document.
 */
export function reorderDesenEditorNode(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeReorderCommand,
): DesenEditorStructuralEditResult {
  const captured = capturePositionCommand(command, REORDER_COMMAND_KEYS) as
    CapturedReorderCommand | undefined;
  if (captured === undefined) {
    return commandFailure(
      "Reorder command must contain exact inert surface, owner, slot, node, and index fields.",
    );
  }
  const preparation = prepareSurface(editorDocument, captured.surfaceId);
  if (!preparation.ok) return preparation.result;
  const prepared = preparation.value;

  const parentMatches = matchesIdentity(prepared.inspection, captured.parentId);
  if (parentMatches.length === 0) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The reorder owner does not exist in the target surface.",
    );
  }
  if (parentMatches.length !== 1) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The reorder owner is ambiguous in the target surface.",
    );
  }
  const parent = parentMatches[0] as OwnerMatch;

  const targetMatches = matchesIdentity(prepared.inspection, captured.nodeId);
  if (
    targetMatches.length === 0 ||
    (targetMatches.length === 1 && targetMatches[0]?.kind !== "node")
  ) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The reorder node identity does not exist in the target surface.",
    );
  }
  if (targetMatches.length !== 1) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The reorder node identity is ambiguous in the target surface.",
    );
  }
  const target = targetMatches[0];
  if (target?.kind === "node" && target.source === undefined) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_ROOT_FORBIDDEN",
        "A surface root cannot be reordered.",
        target.pointer,
        frozenContext(prepared.document, captured.surfaceId, target),
      ),
    );
  }
  if (target?.kind !== "node" || target.source === undefined) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The reorder target is not a direct child in an owner slot.",
    );
  }
  if (target.source.ownerPointer !== parent.pointer || target.source.slot !== captured.slot) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The reorder target is not a direct child of the addressed owner slot.",
    );
  }
  const remainingLength = target.source.children.length - 1;
  if (captured.index > remainingLength) {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_POSITION_INVALID",
        "The reorder index must be a final position after removing the selected child.",
        appendJsonPointer(appendJsonPointer(parent.pointer, "slots"), captured.slot),
        frozenContext(prepared.document, captured.surfaceId, parent),
      ),
    );
  }

  const candidate = mutableDocument(prepared.document);
  const candidateSurface = candidate.surfaces[captured.surfaceId];
  if (candidateSurface === undefined)
    return missingTarget(prepared, captured.surfaceId, "The target surface disappeared.");
  const candidateInspection = inspectSurface(
    candidateSurface.root as EditorNode,
    appendJsonPointer(prepared.surfacePointer, "root"),
  );
  if (candidateInspection.status === "limit-exceeded") {
    return editFailure(
      editDiagnostic(
        "run.desen.editor/STRUCTURAL_EDIT_LIMIT_EXCEEDED",
        "The detached reorder candidate exceeds the finite target-surface profile.",
        candidateInspection.pointer,
        frozenContext(prepared.document, captured.surfaceId),
      ),
    );
  }
  const candidateTargets = matchesIdentity(candidateInspection, captured.nodeId);
  const candidateTarget = candidateTargets[0];
  if (
    candidateTargets.length !== 1 ||
    candidateTarget?.kind !== "node" ||
    candidateTarget.source === undefined
  ) {
    return ambiguousTarget(
      prepared,
      captured.surfaceId,
      "The reorder target could not be reproduced in the detached result candidate.",
    );
  }
  const children = mutableSourceChildren(candidateTarget.source);
  const removed = children.splice(candidateTarget.source.index, 1)[0];
  if (removed === undefined) {
    return missingTarget(
      prepared,
      captured.surfaceId,
      "The reorder target disappeared from its slot.",
    );
  }
  children.splice(captured.index, 0, removed);
  return finalizeCandidate(candidate, captured.surfaceId, prepared.document);
}
