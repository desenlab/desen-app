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
const CONTENT_EDIT_PROFILE = Object.freeze({
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
type MutableEditorVariant = NonNullable<MutableEditorNode["variants"]>[number];

/** One structurally representable DESEN value edited into a prop or style-property leaf. */
export type DesenEditorContentValue = NonNullable<EditorNode["props"]>[string];

/** One structurally representable DESEN predicate edited into a node or variant condition. */
export type DesenEditorContentPredicate = NonNullable<EditorNode["when"]>;

/** One structurally representable ordered node variant. */
export type DesenEditorContentVariant = NonNullable<EditorNode["variants"]>[number];

interface CapturedOwnerPropSetCommand {
  readonly name: string;
  readonly ownerId: string;
  readonly surfaceId: string;
  readonly value: DesenEditorContentValue;
}

interface CapturedOwnerPropDeleteCommand {
  readonly name: string;
  readonly ownerId: string;
  readonly surfaceId: string;
}

interface CapturedOwnerStyleSetCommand {
  readonly ownerId: string;
  readonly part: string;
  readonly property: string;
  readonly state: string;
  readonly surfaceId: string;
  readonly value: DesenEditorContentValue;
}

interface CapturedOwnerStyleDeleteCommand {
  readonly ownerId: string;
  readonly part: string;
  readonly property: string;
  readonly state: string;
  readonly surfaceId: string;
}

interface CapturedNodeConditionSetCommand {
  readonly nodeId: string;
  readonly surfaceId: string;
  readonly when: DesenEditorContentPredicate;
}

interface CapturedNodeConditionClearCommand {
  readonly nodeId: string;
  readonly surfaceId: string;
}

interface CapturedVariantInsertCommand {
  readonly index: number;
  readonly nodeId: string;
  readonly surfaceId: string;
  readonly variant: DesenEditorContentVariant;
}

interface CapturedVariantIndexCommand {
  readonly index: number;
  readonly nodeId: string;
  readonly surfaceId: string;
}

interface CapturedVariantReorderCommand extends CapturedVariantIndexCommand {
  readonly variantIndex: number;
}

interface CapturedVariantConditionSetCommand extends CapturedVariantIndexCommand {
  readonly when: DesenEditorContentPredicate;
}

interface CapturedVariantPropSetCommand extends CapturedVariantIndexCommand {
  readonly name: string;
  readonly value: DesenEditorContentValue;
}

interface CapturedVariantPropDeleteCommand extends CapturedVariantIndexCommand {
  readonly name: string;
}

interface CapturedVariantStyleSetCommand extends CapturedVariantIndexCommand {
  readonly part: string;
  readonly property: string;
  readonly state: string;
  readonly value: DesenEditorContentValue;
}

interface CapturedVariantStyleDeleteCommand extends CapturedVariantIndexCommand {
  readonly part: string;
  readonly property: string;
  readonly state: string;
}

type OwnerMatch =
  | Readonly<{
      readonly depth: number;
      readonly kind: "behavior";
      readonly owner: EditorBehavior;
      readonly pointer: JsonPointer;
    }>
  | Readonly<{
      readonly depth: number;
      readonly kind: "node";
      readonly owner: EditorNode;
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
  | Readonly<{ readonly ok: false; readonly result: DesenEditorContentEditFailure }>;

type ResolvedOwnerResult =
  | Readonly<{ readonly ok: true; readonly match: OwnerMatch }>
  | Readonly<{ readonly ok: false; readonly result: DesenEditorContentEditFailure }>;

interface MutationIssue {
  readonly code:
    | "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND"
    | "run.desen.editor/CONTENT_EDIT_POSITION_INVALID";
  readonly match: OwnerMatch;
  readonly message: string;
  readonly pointer: JsonPointer;
}

type MutationResult =
  Readonly<{ readonly ok: true }> | Readonly<{ readonly ok: false; readonly issue: MutationIssue }>;

/** Stable editor-specific diagnostic codes emitted by M08-T04 content-edit commands. */
export type DesenEditorContentEditDiagnosticCode =
  | "run.desen.editor/CONTENT_EDIT_COMMAND_INVALID"
  | "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED"
  | "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND"
  | "run.desen.editor/CONTENT_EDIT_POSITION_INVALID"
  | "run.desen.editor/CONTENT_EDIT_TARGET_AMBIGUOUS"
  | "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND";

/** Frozen JSON-serializable diagnostic emitted by a content-edit command. */
export type DesenEditorContentEditDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorContentEditDiagnosticCode>
>;

/** Exact command for setting one base prop on a component node or behavior instance. */
export interface DesenEditorOwnerPropSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local node or behavior identity. */
  readonly ownerId: string;
  /** Exact prop name; Catalog declaration remains a continuous-validation concern. */
  readonly name: string;
  /** Complete inert DESEN value to assign. */
  readonly value: DesenEditorContentValue;
}

/** Exact command for deleting one existing base prop from a node or behavior. */
export interface DesenEditorOwnerPropDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local node or behavior identity. */
  readonly ownerId: string;
  /** Exact existing prop name. */
  readonly name: string;
}

/** Exact command for setting one base visual-state/style-part/property leaf. */
export interface DesenEditorOwnerStylePropertySetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local node or behavior identity. */
  readonly ownerId: string;
  /** Exact visual-state name. */
  readonly state: string;
  /** Exact semantic style-part name. */
  readonly part: string;
  /** Exact style-property name. */
  readonly property: string;
  /** Complete inert DESEN value to assign. */
  readonly value: DesenEditorContentValue;
}

/** Exact command for deleting one existing base style-property leaf. */
export interface DesenEditorOwnerStylePropertyDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local node or behavior identity. */
  readonly ownerId: string;
  /** Exact visual-state name. */
  readonly state: string;
  /** Exact semantic style-part name. */
  readonly part: string;
  /** Exact existing style-property name. */
  readonly property: string;
}

/** Exact command for setting a component node's base conditional-presence predicate. */
export interface DesenEditorNodeConditionSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Complete inert DESEN predicate. */
  readonly when: DesenEditorContentPredicate;
}

/** Exact command for clearing one existing component-node condition. */
export interface DesenEditorNodeConditionClearCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
}

/** Exact command for inserting one complete variant at an ordered boundary. */
export interface DesenEditorVariantInsertCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Zero-based insertion boundary in the existing variant array. */
  readonly index: number;
  /** Complete inert variant to insert. */
  readonly variant: DesenEditorContentVariant;
}

/** Exact command for deleting one existing variant by index. */
export interface DesenEditorVariantDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Zero-based existing variant index. */
  readonly index: number;
}

/** Exact command for reordering a variant by its post-removal final position. */
export interface DesenEditorVariantReorderCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index selected before removal. */
  readonly variantIndex: number;
  /** Zero-based final position after removing the selected variant. */
  readonly index: number;
}

/** Exact command for replacing an existing variant's predicate. */
export interface DesenEditorVariantConditionSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index. */
  readonly index: number;
  /** Complete inert replacement predicate. */
  readonly when: DesenEditorContentPredicate;
}

/** Exact command for setting one prop on an existing variant. */
export interface DesenEditorVariantPropSetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index. */
  readonly index: number;
  /** Exact prop name. */
  readonly name: string;
  /** Complete inert DESEN value to assign. */
  readonly value: DesenEditorContentValue;
}

/** Exact command for deleting one existing variant prop. */
export interface DesenEditorVariantPropDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index. */
  readonly index: number;
  /** Exact existing prop name. */
  readonly name: string;
}

/** Exact command for setting one style-property leaf on an existing variant. */
export interface DesenEditorVariantStylePropertySetCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index. */
  readonly index: number;
  /** Exact visual-state name. */
  readonly state: string;
  /** Exact semantic style-part name. */
  readonly part: string;
  /** Exact style-property name. */
  readonly property: string;
  /** Complete inert DESEN value to assign. */
  readonly value: DesenEditorContentValue;
}

/** Exact command for deleting one existing variant style-property leaf. */
export interface DesenEditorVariantStylePropertyDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node identity. */
  readonly nodeId: string;
  /** Existing variant index. */
  readonly index: number;
  /** Exact visual-state name. */
  readonly state: string;
  /** Exact semantic style-part name. */
  readonly part: string;
  /** Exact existing style-property name. */
  readonly property: string;
}

/** Successful atomic content edit with one fresh immutable direct Source snapshot. */
export interface DesenEditorContentEditSuccess {
  /** Confirms that the complete content edit was applied. */
  readonly ok: true;
  /** Fresh direct Source document; prior inputs remain untouched. */
  readonly document: DesenEditorDocument;
  /** Always empty after a structurally valid edit. */
  readonly diagnostics: readonly [];
}

/** Rejected content edit with no partial Source snapshot. */
export interface DesenEditorContentEditFailure {
  /** Confirms that no content-edit document was produced. */
  readonly ok: false;
  /** Nonempty frozen structural or editor-command diagnostics. */
  readonly diagnostics: readonly [
    DesenStructuralDiagnostic | DesenEditorContentEditDiagnostic,
    ...(DesenStructuralDiagnostic | DesenEditorContentEditDiagnostic)[],
  ];
}

/** Complete result of one M08-T04 content-edit command. */
export type DesenEditorContentEditResult =
  DesenEditorContentEditFailure | DesenEditorContentEditSuccess;

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

function safeIndex(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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

function captureOwnerPropSet(
  input: DesenEditorOwnerPropSetCommand,
): CapturedOwnerPropSetCommand | undefined {
  const fields = exactOwnData(input, ["name", "ownerId", "surfaceId", "value"]);
  if (
    fields === undefined ||
    !stringName(fields.name) ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const value = captureJson<DesenEditorContentValue>(fields.value);
  return value === undefined
    ? undefined
    : Object.freeze({
        name: fields.name,
        ownerId: fields.ownerId,
        surfaceId: fields.surfaceId,
        value,
      });
}

function captureOwnerPropDelete(
  input: DesenEditorOwnerPropDeleteCommand,
): CapturedOwnerPropDeleteCommand | undefined {
  const fields = exactOwnData(input, ["name", "ownerId", "surfaceId"]);
  return fields !== undefined &&
    stringName(fields.name) &&
    localIdentifier(fields.ownerId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({ name: fields.name, ownerId: fields.ownerId, surfaceId: fields.surfaceId })
    : undefined;
}

function captureOwnerStyleSet(
  input: DesenEditorOwnerStylePropertySetCommand,
): CapturedOwnerStyleSetCommand | undefined {
  const fields = exactOwnData(input, [
    "ownerId",
    "part",
    "property",
    "state",
    "surfaceId",
    "value",
  ]);
  if (
    fields === undefined ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.part) ||
    !localIdentifier(fields.property) ||
    !localIdentifier(fields.state) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const value = captureJson<DesenEditorContentValue>(fields.value);
  return value === undefined
    ? undefined
    : Object.freeze({
        ownerId: fields.ownerId,
        part: fields.part,
        property: fields.property,
        state: fields.state,
        surfaceId: fields.surfaceId,
        value,
      });
}

function captureOwnerStyleDelete(
  input: DesenEditorOwnerStylePropertyDeleteCommand,
): CapturedOwnerStyleDeleteCommand | undefined {
  const fields = exactOwnData(input, ["ownerId", "part", "property", "state", "surfaceId"]);
  return fields !== undefined &&
    localIdentifier(fields.ownerId) &&
    localIdentifier(fields.part) &&
    localIdentifier(fields.property) &&
    localIdentifier(fields.state) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        ownerId: fields.ownerId,
        part: fields.part,
        property: fields.property,
        state: fields.state,
        surfaceId: fields.surfaceId,
      })
    : undefined;
}

function captureNodeConditionSet(
  input: DesenEditorNodeConditionSetCommand,
): CapturedNodeConditionSetCommand | undefined {
  const fields = exactOwnData(input, ["nodeId", "surfaceId", "when"]);
  if (
    fields === undefined ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const when = captureJson<DesenEditorContentPredicate>(fields.when);
  return when === undefined
    ? undefined
    : Object.freeze({ nodeId: fields.nodeId, surfaceId: fields.surfaceId, when });
}

function captureNodeConditionClear(
  input: DesenEditorNodeConditionClearCommand,
): CapturedNodeConditionClearCommand | undefined {
  const fields = exactOwnData(input, ["nodeId", "surfaceId"]);
  return fields !== undefined && localIdentifier(fields.nodeId) && localIdentifier(fields.surfaceId)
    ? Object.freeze({ nodeId: fields.nodeId, surfaceId: fields.surfaceId })
    : undefined;
}

function captureVariantInsert(
  input: DesenEditorVariantInsertCommand,
): CapturedVariantInsertCommand | undefined {
  const fields = exactOwnData(input, ["index", "nodeId", "surfaceId", "variant"]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const variant = captureJson<DesenEditorContentVariant>(fields.variant);
  return variant === undefined
    ? undefined
    : Object.freeze({
        index: fields.index,
        nodeId: fields.nodeId,
        surfaceId: fields.surfaceId,
        variant,
      });
}

function captureVariantIndex(
  input: DesenEditorVariantDeleteCommand,
): CapturedVariantIndexCommand | undefined {
  const fields = exactOwnData(input, ["index", "nodeId", "surfaceId"]);
  return fields !== undefined &&
    safeIndex(fields.index) &&
    localIdentifier(fields.nodeId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({ index: fields.index, nodeId: fields.nodeId, surfaceId: fields.surfaceId })
    : undefined;
}

function captureVariantReorder(
  input: DesenEditorVariantReorderCommand,
): CapturedVariantReorderCommand | undefined {
  const fields = exactOwnData(input, ["index", "nodeId", "surfaceId", "variantIndex"]);
  return fields !== undefined &&
    safeIndex(fields.index) &&
    safeIndex(fields.variantIndex) &&
    localIdentifier(fields.nodeId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        index: fields.index,
        nodeId: fields.nodeId,
        surfaceId: fields.surfaceId,
        variantIndex: fields.variantIndex,
      })
    : undefined;
}

function captureVariantConditionSet(
  input: DesenEditorVariantConditionSetCommand,
): CapturedVariantConditionSetCommand | undefined {
  const fields = exactOwnData(input, ["index", "nodeId", "surfaceId", "when"]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const when = captureJson<DesenEditorContentPredicate>(fields.when);
  return when === undefined
    ? undefined
    : Object.freeze({
        index: fields.index,
        nodeId: fields.nodeId,
        surfaceId: fields.surfaceId,
        when,
      });
}

function captureVariantPropSet(
  input: DesenEditorVariantPropSetCommand,
): CapturedVariantPropSetCommand | undefined {
  const fields = exactOwnData(input, ["index", "name", "nodeId", "surfaceId", "value"]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !stringName(fields.name) ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const value = captureJson<DesenEditorContentValue>(fields.value);
  return value === undefined
    ? undefined
    : Object.freeze({
        index: fields.index,
        name: fields.name,
        nodeId: fields.nodeId,
        surfaceId: fields.surfaceId,
        value,
      });
}

function captureVariantPropDelete(
  input: DesenEditorVariantPropDeleteCommand,
): CapturedVariantPropDeleteCommand | undefined {
  const fields = exactOwnData(input, ["index", "name", "nodeId", "surfaceId"]);
  return fields !== undefined &&
    safeIndex(fields.index) &&
    stringName(fields.name) &&
    localIdentifier(fields.nodeId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        index: fields.index,
        name: fields.name,
        nodeId: fields.nodeId,
        surfaceId: fields.surfaceId,
      })
    : undefined;
}

function captureVariantStyleSet(
  input: DesenEditorVariantStylePropertySetCommand,
): CapturedVariantStyleSetCommand | undefined {
  const fields = exactOwnData(input, [
    "index",
    "nodeId",
    "part",
    "property",
    "state",
    "surfaceId",
    "value",
  ]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !localIdentifier(fields.nodeId) ||
    !localIdentifier(fields.part) ||
    !localIdentifier(fields.property) ||
    !localIdentifier(fields.state) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const value = captureJson<DesenEditorContentValue>(fields.value);
  return value === undefined
    ? undefined
    : Object.freeze({
        index: fields.index,
        nodeId: fields.nodeId,
        part: fields.part,
        property: fields.property,
        state: fields.state,
        surfaceId: fields.surfaceId,
        value,
      });
}

function captureVariantStyleDelete(
  input: DesenEditorVariantStylePropertyDeleteCommand,
): CapturedVariantStyleDeleteCommand | undefined {
  const fields = exactOwnData(input, ["index", "nodeId", "part", "property", "state", "surfaceId"]);
  return fields !== undefined &&
    safeIndex(fields.index) &&
    localIdentifier(fields.nodeId) &&
    localIdentifier(fields.part) &&
    localIdentifier(fields.property) &&
    localIdentifier(fields.state) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        index: fields.index,
        nodeId: fields.nodeId,
        part: fields.part,
        property: fields.property,
        state: fields.state,
        surfaceId: fields.surfaceId,
      })
    : undefined;
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
    capabilityId: match.owner.use,
    subject: Object.freeze({ id: match.owner.id, kind: match.kind }),
  });
}

function contentDiagnostic(
  code: DesenEditorContentEditDiagnosticCode,
  message: string,
  pointer?: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): DesenEditorContentEditDiagnostic {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(context === undefined ? {} : { context }),
  });
}

function contentFailure(
  diagnostic: DesenStructuralDiagnostic | DesenEditorContentEditDiagnostic,
  ...rest: (DesenStructuralDiagnostic | DesenEditorContentEditDiagnostic)[]
): DesenEditorContentEditFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      diagnostic,
      ...rest,
    ]) as DesenEditorContentEditFailure["diagnostics"],
  });
}

function commandFailure(message: string): DesenEditorContentEditFailure {
  return contentFailure(
    contentDiagnostic("run.desen.editor/CONTENT_EDIT_COMMAND_INVALID", message),
  );
}

function structuralFailure(
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenEditorContentEditFailure {
  const first = diagnostics[0];
  return first === undefined
    ? commandFailure("The editor document could not be admitted for a content edit.")
    : contentFailure(first, ...diagnostics.slice(1));
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
        pending.push({
          depth: depth + 1,
          kind: "node",
          owner: child,
          pointer: appendJsonPointer(pointer, index),
        });
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
      identityOccurrences > CONTENT_EDIT_PROFILE.maxIdentityOccurrencesPerSurface ||
      current.depth > CONTENT_EDIT_PROFILE.maxSourceTreeDepth
    ) {
      return Object.freeze({ pointer: current.pointer, status: "limit-exceeded" });
    }
    matches.push(current);
    scheduleSlotChildren(pending, current.owner, current.pointer, current.depth);
    if (current.kind === "node") {
      const behaviors = current.owner.behaviors ?? [];
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
    CONTENT_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return Object.freeze({
      ok: false,
      result: contentFailure(
        contentDiagnostic(
          "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED",
          "The editor document exceeds the finite content-edit profile.",
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
      result: contentFailure(
        contentDiagnostic(
          "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
          "The content-edit command targets a surface that does not exist.",
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
      result: contentFailure(
        contentDiagnostic(
          "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED",
          "The target surface exceeds the finite content-edit profile.",
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

function resolveOwner(
  prepared: PreparedSurface,
  surfaceId: string,
  ownerId: string,
  requirement: "node" | "owner",
): ResolvedOwnerResult {
  const matches = prepared.inspection.matches.filter((match) => match.owner.id === ownerId);
  if (
    matches.length === 0 ||
    (matches.length === 1 && requirement === "node" && matches[0]?.kind !== "node")
  ) {
    return Object.freeze({
      ok: false,
      result: contentFailure(
        contentDiagnostic(
          "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
          requirement === "node"
            ? "The content-edit command does not select a component node."
            : "The content-edit command owner does not exist in the target surface.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  if (matches.length !== 1) {
    return Object.freeze({
      ok: false,
      result: contentFailure(
        contentDiagnostic(
          "run.desen.editor/CONTENT_EDIT_TARGET_AMBIGUOUS",
          "The content-edit command identity is ambiguous in the target surface.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  return Object.freeze({ ok: true, match: matches[0] as OwnerMatch });
}

function mutableDocument(document: DesenEditorDocument): MutableEditorDocument {
  return JSON.parse(canonicalizeJson(document)) as MutableEditorDocument;
}

function mutableOwner(owner: EditorOwner): MutableEditorOwner {
  return owner as MutableEditorOwner;
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

function propPointer(match: OwnerMatch, name: string): JsonPointer {
  return appendJsonPointer(appendJsonPointer(match.pointer, "props"), name);
}

function variantPointer(match: OwnerMatch, index: number): JsonPointer {
  return appendJsonPointer(appendJsonPointer(match.pointer, "variants"), index);
}

function mutationIssue(
  code: MutationIssue["code"],
  match: OwnerMatch,
  message: string,
  pointer: JsonPointer,
): MutationResult {
  return Object.freeze({ ok: false, issue: Object.freeze({ code, match, message, pointer }) });
}

function mutationSuccess(): MutationResult {
  return Object.freeze({ ok: true });
}

function finalizeCandidate(
  candidate: MutableEditorDocument,
  surfaceId: string,
  original: DesenEditorDocument,
): DesenEditorContentEditResult {
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) {
    return contentFailure(
      contentDiagnostic(
        "run.desen.editor/CONTENT_EDIT_TARGET_NOT_FOUND",
        "The target surface disappeared while preparing the content edit.",
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
    return contentFailure(
      contentDiagnostic(
        "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED",
        "The content edit would exceed the finite target-surface profile.",
        inspection.pointer,
        frozenContext(original, surfaceId),
      ),
    );
  }
  if (
    canonicalizeJsonBytes(candidate).byteLength > CONTENT_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return contentFailure(
      contentDiagnostic(
        "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED",
        "The content edit would exceed the finite editor-document profile.",
        createJsonPointer(),
        Object.freeze({ documentId: original.id }),
      ),
    );
  }
  const admitted = createDesenEditorDocument(candidate);
  if (!admitted.ok) return structuralFailure(admitted.diagnostics);
  return Object.freeze({ ok: true, document: admitted.document, diagnostics: EMPTY_DIAGNOSTICS });
}

function applyOwnerMutation(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
  ownerId: string,
  requirement: "node" | "owner",
  mutate: (owner: MutableEditorOwner, match: OwnerMatch) => MutationResult,
): DesenEditorContentEditResult {
  const preparation = prepareSurface(editorDocument, surfaceId);
  if (!preparation.ok) return preparation.result;
  const prepared = preparation.value;
  const resolved = resolveOwner(prepared, surfaceId, ownerId, requirement);
  if (!resolved.ok) return resolved.result;

  const candidate = mutableDocument(prepared.document);
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined)
    return commandFailure("The detached content-edit surface disappeared.");
  const inspection = inspectSurface(
    surface.root as EditorNode,
    appendJsonPointer(prepared.surfacePointer, "root"),
  );
  if (inspection.status === "limit-exceeded") {
    return contentFailure(
      contentDiagnostic(
        "run.desen.editor/CONTENT_EDIT_LIMIT_EXCEEDED",
        "The detached content-edit candidate exceeds the finite profile.",
        inspection.pointer,
        frozenContext(prepared.document, surfaceId),
      ),
    );
  }
  const candidatePrepared: PreparedSurface = Object.freeze({
    document: candidate as unknown as DesenEditorDocument,
    inspection,
    surfacePointer: prepared.surfacePointer,
  });
  const candidateResolved = resolveOwner(candidatePrepared, surfaceId, ownerId, requirement);
  if (!candidateResolved.ok) {
    return contentFailure(
      contentDiagnostic(
        "run.desen.editor/CONTENT_EDIT_TARGET_AMBIGUOUS",
        "The content-edit target could not be reproduced in the detached candidate.",
        prepared.surfacePointer,
        frozenContext(prepared.document, surfaceId),
      ),
    );
  }
  const mutation = mutate(mutableOwner(candidateResolved.match.owner), resolved.match);
  if (!mutation.ok) {
    return contentFailure(
      contentDiagnostic(
        mutation.issue.code,
        mutation.issue.message,
        mutation.issue.pointer,
        frozenContext(prepared.document, surfaceId, mutation.issue.match),
      ),
    );
  }
  return finalizeCandidate(candidate, surfaceId, prepared.document);
}

function setProp(
  owner: MutableEditorOwner,
  name: string,
  value: DesenEditorContentValue,
): MutationResult {
  const props = ownRecord(owner, "props") ?? Object.create(null);
  defineOwn(props, name, value);
  defineOwn(owner, "props", props);
  return mutationSuccess();
}

function deleteProp(owner: MutableEditorOwner, match: OwnerMatch, name: string): MutationResult {
  const props = ownRecord(owner, "props");
  if (props === undefined || !Object.hasOwn(props, name)) {
    return mutationIssue(
      "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND",
      match,
      "The content-edit command cannot delete a prop that is not present.",
      propPointer(match, name),
    );
  }
  Reflect.deleteProperty(props, name);
  return mutationSuccess();
}

function setStyleProperty(
  owner: MutableEditorOwner | MutableEditorVariant,
  match: OwnerMatch,
  basePointer: JsonPointer,
  state: string,
  part: string,
  property: string,
  value: DesenEditorContentValue,
): MutationResult {
  const style = ownRecord(owner, "style") ?? Object.create(null);
  const states = ownRecord(style, state) ?? Object.create(null);
  const properties = ownRecord(states, part) ?? Object.create(null);
  defineOwn(properties, property, value);
  defineOwn(states, part, properties);
  defineOwn(style, state, states);
  defineOwn(owner, "style", style);
  void match;
  void basePointer;
  return mutationSuccess();
}

function deleteStyleProperty(
  owner: MutableEditorOwner | MutableEditorVariant,
  match: OwnerMatch,
  basePointer: JsonPointer,
  state: string,
  part: string,
  property: string,
): MutationResult {
  const style = ownRecord(owner, "style");
  const states = style === undefined ? undefined : ownRecord(style, state);
  const properties = states === undefined ? undefined : ownRecord(states, part);
  if (properties === undefined || !Object.hasOwn(properties, property)) {
    return mutationIssue(
      "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND",
      match,
      "The content-edit command cannot delete a style property that is not present.",
      appendJsonPointer(appendJsonPointer(appendJsonPointer(basePointer, state), part), property),
    );
  }
  Reflect.deleteProperty(properties, property);
  return mutationSuccess();
}

function existingVariant(
  owner: MutableEditorOwner,
  match: OwnerMatch,
  index: number,
):
  | Readonly<{ readonly ok: true; readonly variant: MutableEditorVariant }>
  | Readonly<{ readonly ok: false; readonly result: MutationResult }> {
  const variants = Object.hasOwn(owner, "variants")
    ? (owner as MutableEditorNode).variants
    : undefined;
  const variant = variants?.[index];
  return variant === undefined
    ? Object.freeze({
        ok: false,
        result: mutationIssue(
          "run.desen.editor/CONTENT_EDIT_POSITION_INVALID",
          match,
          "The content-edit command variant index does not exist.",
          variantPointer(match, index),
        ),
      })
    : Object.freeze({ ok: true, variant });
}

/**
 * Sets one base prop on the unique surface-local node or behavior named by the command.
 *
 * @remarks The prop name is an arbitrary valid I-JSON string, including empty and
 * prototype-sensitive names; Catalog resolution is intentionally deferred. Success returns a
 * fresh detached, recursively frozen direct Source. Invalid commands, ambiguous or absent
 * targets, fixed-profile overflow, and structural re-admission failures are atomic and expose
 * diagnostics without a partial document.
 */
export function setDesenEditorOwnerProp(
  editorDocument: DesenEditorDocument,
  command: DesenEditorOwnerPropSetCommand,
): DesenEditorContentEditResult {
  const captured = captureOwnerPropSet(command);
  if (captured === undefined)
    return commandFailure("Prop-set command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    "owner",
    (owner) => setProp(owner, captured.name, captured.value),
  );
}

/**
 * Deletes one existing base prop from a unique surface-local node or behavior.
 *
 * @remarks A missing prop is an error and an emptied own `props` container remains present.
 * Success returns a fresh detached, recursively frozen direct Source; every command, target,
 * fixed-profile, or structural failure is atomic and diagnostic-only.
 */
export function deleteDesenEditorOwnerProp(
  editorDocument: DesenEditorDocument,
  command: DesenEditorOwnerPropDeleteCommand,
): DesenEditorContentEditResult {
  const captured = captureOwnerPropDelete(command);
  if (captured === undefined)
    return commandFailure("Prop-delete command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    "owner",
    (owner, match) => deleteProp(owner, match, captured.name),
  );
}

/**
 * Sets one base visual-state/style-part/property leaf on a unique surface-local node or behavior.
 *
 * @remarks Missing style containers are created without interpreting unresolved Catalog
 * semantics. Success returns a fresh detached, recursively frozen direct Source; invalid
 * addressing, fixed-profile overflow, or structural rejection is atomic and diagnostic-only.
 */
export function setDesenEditorOwnerStyleProperty(
  editorDocument: DesenEditorDocument,
  command: DesenEditorOwnerStylePropertySetCommand,
): DesenEditorContentEditResult {
  const captured = captureOwnerStyleSet(command);
  if (captured === undefined)
    return commandFailure("Style-set command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    "owner",
    (owner, match) =>
      setStyleProperty(
        owner,
        match,
        appendJsonPointer(match.pointer, "style"),
        captured.state,
        captured.part,
        captured.property,
        captured.value,
      ),
  );
}

/**
 * Deletes one existing base style-property leaf from a unique node or behavior.
 *
 * @remarks A missing state, part, or property is an error; emptied style containers are retained.
 * Success returns a fresh detached, recursively frozen direct Source, while all command, target,
 * fixed-profile, and structural failures return only diagnostics and never a partial edit.
 */
export function deleteDesenEditorOwnerStyleProperty(
  editorDocument: DesenEditorDocument,
  command: DesenEditorOwnerStylePropertyDeleteCommand,
): DesenEditorContentEditResult {
  const captured = captureOwnerStyleDelete(command);
  if (captured === undefined)
    return commandFailure("Style-delete command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    "owner",
    (owner, match) =>
      deleteStyleProperty(
        owner,
        match,
        appendJsonPointer(match.pointer, "style"),
        captured.state,
        captured.part,
        captured.property,
      ),
  );
}

/**
 * Sets or replaces the base conditional-presence predicate of one unique surface-local node.
 *
 * @remarks Behavior identities are not eligible and predicate semantics may remain unresolved.
 * Success returns a fresh detached, recursively frozen direct Source; invalid commands, target
 * errors, fixed-profile overflow, and structural rejection are atomic and diagnostic-only.
 */
export function setDesenEditorNodeCondition(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeConditionSetCommand,
): DesenEditorContentEditResult {
  const captured = captureNodeConditionSet(command);
  if (captured === undefined)
    return commandFailure("Condition-set command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner) => {
      defineOwn(owner, "when", captured.when);
      return mutationSuccess();
    },
  );
}

/**
 * Clears one existing condition from a unique surface-local node without changing its identity.
 *
 * @remarks Behavior identities and nodes without an own condition are rejected. Success returns a
 * fresh detached, recursively frozen direct Source; all command, target, fixed-profile, and
 * structural failures are atomic and expose no partial document.
 */
export function clearDesenEditorNodeCondition(
  editorDocument: DesenEditorDocument,
  command: DesenEditorNodeConditionClearCommand,
): DesenEditorContentEditResult {
  const captured = captureNodeConditionClear(command);
  if (captured === undefined)
    return commandFailure("Condition-clear command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      if (!Object.hasOwn(owner, "when")) {
        return mutationIssue(
          "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND",
          match,
          "The content-edit command cannot clear a condition that is not present.",
          appendJsonPointer(match.pointer, "when"),
        );
      }
      delete (owner as MutableEditorNode).when;
      return mutationSuccess();
    },
  );
}

/**
 * Inserts one complete variant at an exact boundary in a unique node's ordered variant array.
 *
 * @remarks An absent array accepts only boundary zero; no variant identity is generated and
 * unresolved Catalog semantics are preserved. Success returns a fresh detached, recursively
 * frozen direct Source; invalid positions and all other failures are atomic and diagnostic-only.
 */
export function insertDesenEditorVariant(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantInsertCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantInsert(command);
  if (captured === undefined)
    return commandFailure("Variant-insert command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const node = owner as MutableEditorNode;
      const variants = Object.hasOwn(node, "variants") ? (node.variants ?? []) : [];
      if (
        captured.index > variants.length ||
        (!Object.hasOwn(node, "variants") && captured.index !== 0)
      ) {
        return mutationIssue(
          "run.desen.editor/CONTENT_EDIT_POSITION_INVALID",
          match,
          "The variant insert index must address an existing ordered boundary.",
          variantPointer(match, captured.index),
        );
      }
      variants.splice(captured.index, 0, captured.variant as MutableEditorVariant);
      defineOwn(node, "variants", variants);
      return mutationSuccess();
    },
  );
}

/**
 * Deletes one existing indexed variant from a unique surface-local node.
 *
 * @remarks The index must exist and deletion of the last item retains an empty own `variants`
 * array. Success returns a fresh detached, recursively frozen direct Source; command, target,
 * fixed-profile, position, and structural failures are atomic and diagnostic-only.
 */
export function deleteDesenEditorVariant(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantDeleteCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantIndex(command);
  if (captured === undefined)
    return commandFailure("Variant-delete command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      (owner as MutableEditorNode).variants?.splice(captured.index, 1);
      return mutationSuccess();
    },
  );
}

/**
 * Moves one existing variant to its requested post-removal final index.
 *
 * @remarks Both the selected pre-removal index and final index must exist in the resulting array;
 * order and variant payloads otherwise remain stable. Success returns a fresh detached,
 * recursively frozen direct Source; every failure is atomic and exposes diagnostics only.
 */
export function reorderDesenEditorVariant(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantReorderCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantReorder(command);
  if (captured === undefined)
    return commandFailure("Variant-reorder command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const variants = (owner as MutableEditorNode).variants;
      if (
        variants === undefined ||
        captured.variantIndex >= variants.length ||
        captured.index > variants.length - 1
      ) {
        return mutationIssue(
          "run.desen.editor/CONTENT_EDIT_POSITION_INVALID",
          match,
          "Variant reorder indices must select an existing variant and a post-removal final position.",
          variantPointer(match, captured.variantIndex),
        );
      }
      const removed = variants.splice(captured.variantIndex, 1)[0];
      if (removed === undefined) {
        return mutationIssue(
          "run.desen.editor/CONTENT_EDIT_POSITION_INVALID",
          match,
          "The selected variant disappeared during reorder.",
          variantPointer(match, captured.variantIndex),
        );
      }
      variants.splice(captured.index, 0, removed);
      return mutationSuccess();
    },
  );
}

/**
 * Replaces the predicate of one existing indexed variant on a unique surface-local node.
 *
 * @remarks Predicate semantics may remain unresolved, but structural re-admission is mandatory.
 * Success returns a fresh detached, recursively frozen direct Source; invalid indices, commands,
 * targets, fixed-profile overflow, and structural rejection are atomic and diagnostic-only.
 */
export function setDesenEditorVariantCondition(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantConditionSetCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantConditionSet(command);
  if (captured === undefined)
    return commandFailure("Variant-condition command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      defineOwn(selected.variant, "when", captured.when);
      return mutationSuccess();
    },
  );
}

/**
 * Sets one prop on an existing indexed variant of a unique surface-local node.
 *
 * @remarks Arbitrary valid I-JSON prop names and unresolved Catalog semantics are preserved;
 * absent `props` is created. Success returns a fresh detached, recursively frozen direct Source;
 * command, index, target, fixed-profile, and structural failures are atomic and diagnostic-only.
 */
export function setDesenEditorVariantProp(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantPropSetCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantPropSet(command);
  if (captured === undefined)
    return commandFailure("Variant-prop-set command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      const props = ownRecord(selected.variant, "props") ?? Object.create(null);
      defineOwn(props, captured.name, captured.value);
      defineOwn(selected.variant, "props", props);
      return mutationSuccess();
    },
  );
}

/**
 * Deletes one existing prop from an existing indexed variant.
 *
 * @remarks Missing variants or props are errors and deletion of the last prop retains an empty
 * own `props` object. Success returns a fresh detached, recursively frozen direct Source; all
 * command, target, fixed-profile, position, and structural failures are atomic and diagnostic-only.
 */
export function deleteDesenEditorVariantProp(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantPropDeleteCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantPropDelete(command);
  if (captured === undefined)
    return commandFailure("Variant-prop-delete command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      const props = ownRecord(selected.variant, "props");
      const pointer = appendJsonPointer(
        appendJsonPointer(variantPointer(match, captured.index), "props"),
        captured.name,
      );
      if (props === undefined || !Object.hasOwn(props, captured.name)) {
        return mutationIssue(
          "run.desen.editor/CONTENT_EDIT_PATH_NOT_FOUND",
          match,
          "The content-edit command cannot delete a variant prop that is not present.",
          pointer,
        );
      }
      Reflect.deleteProperty(props, captured.name);
      return mutationSuccess();
    },
  );
}

/**
 * Sets one visual-state/style-part/property leaf on an existing indexed variant.
 *
 * @remarks Missing style containers are created and unresolved Catalog semantics remain allowed.
 * Success returns a fresh detached, recursively frozen direct Source; command, target, index,
 * fixed-profile, and structural failures are atomic and expose diagnostics without partial data.
 */
export function setDesenEditorVariantStyleProperty(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantStylePropertySetCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantStyleSet(command);
  if (captured === undefined)
    return commandFailure("Variant-style-set command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      const base = appendJsonPointer(variantPointer(match, captured.index), "style");
      return setStyleProperty(
        selected.variant,
        match,
        base,
        captured.state,
        captured.part,
        captured.property,
        captured.value,
      );
    },
  );
}

/**
 * Deletes one existing style-property leaf from an existing indexed variant.
 *
 * @remarks Missing paths are errors and every emptied visual-state, part, and style container is
 * retained. Success returns a fresh detached, recursively frozen direct Source; all command,
 * target, index, fixed-profile, and structural failures are atomic and diagnostic-only.
 */
export function deleteDesenEditorVariantStyleProperty(
  editorDocument: DesenEditorDocument,
  command: DesenEditorVariantStylePropertyDeleteCommand,
): DesenEditorContentEditResult {
  const captured = captureVariantStyleDelete(command);
  if (captured === undefined)
    return commandFailure("Variant-style-delete command must be exact inert own data.");
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.nodeId,
    "node",
    (owner, match) => {
      const selected = existingVariant(owner, match, captured.index);
      if (!selected.ok) return selected.result;
      const base = appendJsonPointer(variantPointer(match, captured.index), "style");
      return deleteStyleProperty(
        selected.variant,
        match,
        base,
        captured.state,
        captured.part,
        captured.property,
      );
    },
  );
}
