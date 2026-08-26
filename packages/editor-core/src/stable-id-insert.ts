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
const COMMAND_KEYS = Object.freeze([
  "idBase",
  "index",
  "parentId",
  "slot",
  "surfaceId",
  "use",
] as const);
const INSERT_PROFILE = Object.freeze({
  maxCapabilityIdCodeUnits: 4_096,
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

interface CapturedInsertCommand {
  readonly idBase: string;
  readonly index: number;
  readonly parentId: string;
  readonly slot: string;
  readonly surfaceId: string;
  readonly use: string;
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
    }>;

type OwnerWork = OwnerMatch;

interface SurfaceInspection {
  readonly identityOccurrences: number;
  readonly matches: readonly OwnerMatch[];
  readonly reservedIds: ReadonlySet<string>;
  readonly status: "inspected";
}

interface SurfaceInspectionLimit {
  readonly pointer: JsonPointer;
  readonly status: "limit-exceeded";
}

/** Stable editor-specific diagnostic codes emitted by the M08-T02 insert boundary. */
export type DesenEditorInsertDiagnosticCode =
  | "run.desen.editor/INSERT_COMMAND_INVALID"
  | "run.desen.editor/INSERT_LIMIT_EXCEEDED"
  | "run.desen.editor/INSERT_POSITION_INVALID"
  | "run.desen.editor/INSERT_TARGET_AMBIGUOUS"
  | "run.desen.editor/INSERT_TARGET_NOT_FOUND";

/** Frozen, JSON-serializable diagnostic emitted by the editor insert boundary. */
export type DesenEditorInsertDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorInsertDiagnosticCode>
>;

/**
 * Complete deterministic command for inserting one minimal component node into a named slot.
 *
 * @remarks The command intentionally carries no explicit node id. The editor derives one from
 * `idBase` against the selected surface's shared node/behavior identity namespace. It also carries
 * no props, styles, conditions, variants, bindings, state, behaviors, or actions; later M08 tasks
 * own those edits.
 */
export interface DesenEditorNodeInsertCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Stable node or behavior identity whose named slot receives the new child. */
  readonly parentId: string;
  /** Exact named slot; an absent slot is created only when `index` is zero. */
  readonly slot: string;
  /** Zero-based insertion boundary in the existing ordered slot array. */
  readonly index: number;
  /** Preferred local identifier before deterministic collision suffixing. */
  readonly idBase: string;
  /** Structurally valid component capability identifier for the new leaf node. */
  readonly use: string;
}

/** Successful insertion with one fresh direct immutable Source snapshot. */
export interface DesenEditorNodeInsertSuccess {
  /** Confirms that the complete insertion was applied. */
  readonly ok: true;
  /** New direct Source document; the previous document and command remain untouched. */
  readonly document: DesenEditorDocument;
  /** Exact stable node identity selected by the deterministic allocator. */
  readonly insertedNodeId: string;
  /** Always empty after a structurally valid insertion. */
  readonly diagnostics: readonly [];
}

/** Rejected insertion with no partial document or allocated node identity. */
export interface DesenEditorNodeInsertFailure {
  /** Confirms that no insertion result was produced. */
  readonly ok: false;
  /**
   * Nonempty structural or editor-command diagnostics.
   *
   * @remarks Structural diagnostics retain their frozen DESEN 0.1.0 codes and JSON Pointers.
   * Editor-specific diagnostics use the collision-resistant `run.desen.editor/*` namespace.
   */
  readonly diagnostics: readonly [
    DesenStructuralDiagnostic | DesenEditorInsertDiagnostic,
    ...(DesenStructuralDiagnostic | DesenEditorInsertDiagnostic)[],
  ];
}

/** Complete result of one deterministic stable-ID insert command. */
export type DesenEditorNodeInsertResult =
  DesenEditorNodeInsertFailure | DesenEditorNodeInsertSuccess;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isAsciiLetter(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigit(character: string): boolean {
  const code = character.charCodeAt(0);
  return code >= 48 && code <= 57;
}

function isAsciiLetterOrDigit(character: string): boolean {
  return isAsciiLetter(character) || isAsciiDigit(character);
}

// The frozen capability regex's repeated dotted namespace group is language-redundant because its
// preceding class already accepts dots. This linear scan preserves that exact language without
// exposing an editor command to backtracking behavior.
function isCapabilityId(value: string): boolean {
  if (value.length > INSERT_PROFILE.maxCapabilityIdCodeUnits) return false;
  const slash = value.indexOf("/");
  if (slash <= 0 || slash !== value.lastIndexOf("/") || slash === value.length - 1) return false;

  const namespace = value.slice(0, slash);
  const name = value.slice(slash + 1);
  if (!isAsciiLetterOrDigit(namespace[0] as string)) return false;
  for (let index = 1; index < namespace.length; index += 1) {
    const character = namespace[index] as string;
    if (!isAsciiLetterOrDigit(character) && character !== "." && character !== "-") return false;
  }
  if (name.length === 0 || name.length > 128 || !isAsciiLetter(name[0] as string)) return false;
  for (let index = 1; index < name.length; index += 1) {
    const character = name[index] as string;
    if (
      !isAsciiLetterOrDigit(character) &&
      character !== "." &&
      character !== "_" &&
      character !== ":" &&
      character !== "-"
    ) {
      return false;
    }
  }
  return true;
}

function ownEnumerableDataValue(object: object, key: string): unknown | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function captureInsertCommand(
  input: DesenEditorNodeInsertCommand,
): CapturedInsertCommand | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== null && prototype !== Object.prototype) return undefined;

    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== COMMAND_KEYS.length ||
      keys.some((key) => typeof key !== "string") ||
      !(keys as string[])
        .slice()
        .sort(compareText)
        .every((key, index) => key === COMMAND_KEYS[index])
    ) {
      return undefined;
    }

    const idBase = ownEnumerableDataValue(input, "idBase");
    const index = ownEnumerableDataValue(input, "index");
    const parentId = ownEnumerableDataValue(input, "parentId");
    const slot = ownEnumerableDataValue(input, "slot");
    const surfaceId = ownEnumerableDataValue(input, "surfaceId");
    const use = ownEnumerableDataValue(input, "use");
    if (
      typeof idBase !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(idBase) ||
      !Number.isSafeInteger(index) ||
      (index as number) < 0 ||
      typeof parentId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(parentId) ||
      typeof slot !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(slot) ||
      typeof surfaceId !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(surfaceId) ||
      typeof use !== "string" ||
      !isCapabilityId(use)
    ) {
      return undefined;
    }

    return Object.freeze({
      idBase,
      index: index as number,
      parentId,
      slot,
      surfaceId,
      use,
    });
  } catch {
    return undefined;
  }
}

function frozenContext(
  document: DesenEditorDocument,
  surfaceId: string,
  match?: OwnerMatch,
): Readonly<DesenDiagnosticContext> {
  const base = { documentId: document.id, surfaceId };
  if (match === undefined) return Object.freeze(base);
  return Object.freeze({
    ...base,
    subject: Object.freeze({ kind: match.kind, id: match.owner.id }),
    capabilityId: match.owner.use,
  });
}

function insertDiagnostic(
  code: DesenEditorInsertDiagnosticCode,
  message: string,
  pointer?: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): DesenEditorInsertDiagnostic {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(context === undefined ? {} : { context }),
  });
}

function insertFailure(
  diagnostic: DesenStructuralDiagnostic | DesenEditorInsertDiagnostic,
  ...rest: (DesenStructuralDiagnostic | DesenEditorInsertDiagnostic)[]
): DesenEditorNodeInsertFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      diagnostic,
      ...rest,
    ]) as DesenEditorNodeInsertFailure["diagnostics"],
  });
}

function structuralFailure(
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenEditorNodeInsertFailure {
  const first = diagnostics[0];
  return first === undefined
    ? insertFailure(
        insertDiagnostic(
          "run.desen.editor/INSERT_COMMAND_INVALID",
          "The editor document could not be admitted for insertion.",
        ),
      )
    : insertFailure(first, ...diagnostics.slice(1));
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
      });
    }
  }
}

function inspectSurface(
  root: EditorNode,
  rootPointer: JsonPointer,
  targetId: string,
): SurfaceInspection | SurfaceInspectionLimit {
  const pending: OwnerWork[] = [{ kind: "node", owner: root, depth: 0, pointer: rootPointer }];
  const matches: OwnerMatch[] = [];
  const reservedIds = new Set<string>();
  let identityOccurrences = 0;

  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    identityOccurrences += 1;
    if (
      identityOccurrences > INSERT_PROFILE.maxIdentityOccurrencesPerSurface ||
      work.depth > INSERT_PROFILE.maxSourceTreeDepth
    ) {
      return Object.freeze({ status: "limit-exceeded", pointer: work.pointer });
    }

    reservedIds.add(work.owner.id);
    if (work.owner.id === targetId) matches.push(Object.freeze({ ...work }));

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

  return Object.freeze({
    status: "inspected",
    identityOccurrences,
    matches: Object.freeze(matches),
    reservedIds,
  });
}

function allocateNodeId(idBase: string, reservedIds: ReadonlySet<string>): string | undefined {
  if (!reservedIds.has(idBase)) return idBase;

  // One more candidate than the occupied set guarantees a free value because every ordinal yields
  // a distinct valid identifier. Suffix-specific truncation keeps the 128-character protocol cap.
  for (let ordinal = 2; ordinal <= reservedIds.size + 1; ordinal += 1) {
    const suffix = `-${ordinal}`;
    const candidate = `${idBase.slice(0, 128 - suffix.length)}${suffix}`;
    if (!reservedIds.has(candidate)) return candidate;
  }
  return undefined;
}

function mutableDocument(document: DesenEditorDocument): MutableEditorDocument {
  return JSON.parse(canonicalizeJson(document)) as MutableEditorDocument;
}

function mutableOwner(owner: EditorOwner): MutableEditorOwner {
  return owner as MutableEditorOwner;
}

/**
 * Inserts one minimal leaf node through a deterministic surface-local stable-ID allocator.
 *
 * @remarks The function first captures the exact inert command, then re-admits the current direct
 * Source document, scans the selected surface's shared node/behavior namespace, chooses `idBase`
 * or the lowest free `-2`, `-3`, ... suffix, and inserts at the exact requested slot boundary.
 * Existing identities and semantic array order are never rewritten. Unknown but structurally
 * valid capability and slot semantics remain representable for M08-T09 continuous validation.
 *
 * The operation is atomic: success returns a fresh detached recursively immutable direct Source;
 * failure returns stable diagnostics with no document or allocated identity. The fixed M08-T02
 * profile admits at most 25,000 node/behavior identities in the target surface, a target-surface
 * component depth of 64 with the root at depth zero, a 4,096-code-unit capability id, and an 8 MiB
 * canonical editor document. These limits are fixed implementation policy rather than caller-owned
 * authority.
 *
 * @returns A frozen success containing the complete new document and allocated identity, or a
 * frozen failure containing no partial document or identity.
 */
export function insertDesenEditorNode(
  document: DesenEditorDocument,
  command: DesenEditorNodeInsertCommand,
): DesenEditorNodeInsertResult {
  const captured = captureInsertCommand(command);
  if (captured === undefined) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_COMMAND_INVALID",
        "Insert command must contain exact inert surface, parent, slot, index, id-base, and capability fields.",
      ),
    );
  }

  const admitted = createDesenEditorDocument(document);
  if (!admitted.ok) return structuralFailure(admitted.diagnostics);
  if (
    canonicalizeJsonBytes(admitted.document).byteLength > INSERT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The editor document exceeds the finite insert profile.",
        createJsonPointer(),
        Object.freeze({ documentId: admitted.document.id }),
      ),
    );
  }

  const surfacePointer = createJsonPointer(["surfaces", captured.surfaceId]);
  if (!Object.hasOwn(admitted.document.surfaces, captured.surfaceId)) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_NOT_FOUND",
        "The insert command targets a surface that does not exist.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }
  const surface = admitted.document.surfaces[captured.surfaceId];
  if (surface === undefined) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_NOT_FOUND",
        "The insert command targets a surface that does not exist.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }

  const inspection = inspectSurface(
    surface.root,
    appendJsonPointer(surfacePointer, "root"),
    captured.parentId,
  );
  if (inspection.status === "limit-exceeded") {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The target surface exceeds the finite insert profile.",
        inspection.pointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }
  if (inspection.matches.length === 0) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_NOT_FOUND",
        "The insert command parent identity does not exist in the target surface.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }
  if (inspection.matches.length !== 1) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_AMBIGUOUS",
        "The insert command parent identity is ambiguous in the target surface.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }

  const parent = inspection.matches[0] as OwnerMatch;
  const existingSlot = namedSlotChildren(parent.owner, captured.slot);
  const existingLength = existingSlot?.length ?? 0;
  if (captured.index > existingLength || (existingSlot === undefined && captured.index !== 0)) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_POSITION_INVALID",
        "The insert index must address an existing named-slot boundary.",
        appendJsonPointer(appendJsonPointer(parent.pointer, "slots"), captured.slot),
        frozenContext(admitted.document, captured.surfaceId, parent),
      ),
    );
  }
  if (
    inspection.identityOccurrences >= INSERT_PROFILE.maxIdentityOccurrencesPerSurface ||
    parent.depth >= INSERT_PROFILE.maxSourceTreeDepth
  ) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The insertion would exceed the finite target-surface profile.",
        parent.pointer,
        frozenContext(admitted.document, captured.surfaceId, parent),
      ),
    );
  }

  const insertedNodeId = allocateNodeId(captured.idBase, inspection.reservedIds);
  if (insertedNodeId === undefined) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The stable node-identity allocation space is exhausted.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }

  const candidate = mutableDocument(admitted.document);
  const candidateSurface = candidate.surfaces[captured.surfaceId];
  if (candidateSurface === undefined) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_NOT_FOUND",
        "The insert target disappeared while preparing the immutable result.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }
  const candidateInspection = inspectSurface(
    candidateSurface.root as EditorNode,
    appendJsonPointer(surfacePointer, "root"),
    captured.parentId,
  );
  if (candidateInspection.status === "limit-exceeded") {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The detached insertion candidate exceeds the finite target-surface profile.",
        candidateInspection.pointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }
  if (candidateInspection.matches.length !== 1) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_TARGET_AMBIGUOUS",
        "The insert target could not be reproduced in the detached result candidate.",
        surfacePointer,
        frozenContext(admitted.document, captured.surfaceId),
      ),
    );
  }

  const candidateParent = mutableOwner(candidateInspection.matches[0]?.owner as EditorOwner);
  const ownSlots = slotChildren(candidateParent as EditorOwner);
  const slots =
    ownSlots === undefined ? {} : (ownSlots as NonNullable<MutableEditorOwner["slots"]>);
  const children = Object.hasOwn(slots, captured.slot) ? (slots[captured.slot] ?? []) : [];
  children.splice(captured.index, 0, { id: insertedNodeId, use: captured.use });
  Object.defineProperty(slots, captured.slot, {
    configurable: true,
    enumerable: true,
    value: children,
    writable: true,
  });
  Object.defineProperty(candidateParent, "slots", {
    configurable: true,
    enumerable: true,
    value: slots,
    writable: true,
  });

  if (canonicalizeJsonBytes(candidate).byteLength > INSERT_PROFILE.maxDocumentCanonicalBytes) {
    return insertFailure(
      insertDiagnostic(
        "run.desen.editor/INSERT_LIMIT_EXCEEDED",
        "The insertion would exceed the finite editor-document profile.",
        parent.pointer,
        frozenContext(admitted.document, captured.surfaceId, parent),
      ),
    );
  }

  const result = createDesenEditorDocument(candidate);
  if (!result.ok) return structuralFailure(result.diagnostics);
  return Object.freeze({
    ok: true,
    document: result.document,
    insertedNodeId,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
