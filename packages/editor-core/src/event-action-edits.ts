import {
  appendJsonPointer,
  canonicalizeJson,
  canonicalizeJsonBytes,
  createJsonPointer,
  parseJsonPointer,
} from "@desen/protocol";

import { createDesenEditorDocument } from "./source-document.js";

import type { DesenDiagnostic, DesenDiagnosticContext, JsonPointer } from "@desen/protocol";
import type { DesenStructuralDiagnostic } from "@desen/validator";
import type { DesenEditorDocument } from "./source-document.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const CANONICAL_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const EVENT_ACTION_EDIT_PROFILE = Object.freeze({
  maxActionNestingDepth: 64,
  maxActionOccurrencesPerOwner: 25_000,
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
type MutableEditorAction = MutableJson<DesenEditorAction>;
type MutableEditorActionList = MutableEditorAction[];

/** One complete structurally representable member of DESEN 0.1.0's closed action union. */
export type DesenEditorAction = NonNullable<EditorOwner["on"]>[string][number];

/**
 * Owner-relative RFC 6901 pointer to a root event list or nested operation settlement list.
 *
 * @remarks Runtime admission requires `/on/{event}` followed by zero or more
 * `/{canonical-index}/{onSuccess|onFailure}` pairs. The template type keeps ordinary literal use
 * ergonomic; the command boundary performs the complete grammar and finite-depth check.
 */
export type DesenEditorActionListPointer = `/on/${string}`;

/**
 * Owner-relative RFC 6901 pointer to one existing action in a root or settlement list.
 *
 * @remarks The final token is a canonical non-negative safe integer. All preceding tokens must
 * form a valid {@link DesenEditorActionListPointer}; runtime admission enforces that full grammar.
 */
export type DesenEditorActionPointer = `/on/${string}`;

/** Stable editor-specific diagnostic codes emitted by M08-T06 event/action commands. */
export type DesenEditorEventActionEditDiagnosticCode =
  | "run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID"
  | "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED"
  | "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND"
  | "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID"
  | "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS"
  | "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS"
  | "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND";

/** Frozen JSON-serializable diagnostic emitted by an event/action command. */
export type DesenEditorEventActionEditDiagnostic = Readonly<
  DesenDiagnostic<DesenEditorEventActionEditDiagnosticCode>
>;

/** Exact command for inserting one absent owner event handler with its complete ordered actions. */
export interface DesenEditorEventHandlerInsertCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Exact absent local event identifier. */
  readonly event: string;
  /** Complete ordered action list, which may be empty. */
  readonly actions: readonly DesenEditorAction[];
}

/** Exact command for deleting one existing owner event handler. */
export interface DesenEditorEventHandlerDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Exact existing local event identifier. */
  readonly event: string;
}

/** Exact command for inserting one complete action at an ordered action-list boundary. */
export interface DesenEditorActionInsertCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Owner-relative pointer to the receiving root or settlement action list. */
  readonly actionListPointer: DesenEditorActionListPointer;
  /** Existing ordered boundary at which the action is inserted. */
  readonly index: number;
  /** Complete closed-union action to insert without semantic normalization. */
  readonly action: DesenEditorAction;
}

/** Exact command for replacing one existing action as a complete closed-union value. */
export interface DesenEditorActionReplaceCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Owner-relative pointer to the exact existing action. */
  readonly actionPointer: DesenEditorActionPointer;
  /** Complete replacement action, including its kind, guard, maps, and settlement branches. */
  readonly action: DesenEditorAction;
}

/** Exact command for deleting one existing action while retaining its ordered list. */
export interface DesenEditorActionDeleteCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Owner-relative pointer to the exact existing action. */
  readonly actionPointer: DesenEditorActionPointer;
}

/** Exact command for moving one existing action to a post-removal final index in the same list. */
export interface DesenEditorActionReorderCommand {
  /** Selected Source surface map key. */
  readonly surfaceId: string;
  /** Unique surface-local component-node or behavior identity. */
  readonly ownerId: string;
  /** Owner-relative pointer to the exact existing action before removal. */
  readonly actionPointer: DesenEditorActionPointer;
  /** Final index after the selected action has been removed from its list. */
  readonly index: number;
}

/** Successful atomic event/action edit with one fresh immutable direct Source snapshot. */
export interface DesenEditorEventActionEditSuccess {
  /** Confirms that the complete event/action edit was applied. */
  readonly ok: true;
  /** Fresh direct Source document; prior inputs remain untouched. */
  readonly document: DesenEditorDocument;
  /** Always empty after a structurally valid edit. */
  readonly diagnostics: readonly [];
}

/** Rejected event/action edit with no partial Source snapshot. */
export interface DesenEditorEventActionEditFailure {
  /** Confirms that no edited document was produced. */
  readonly ok: false;
  /** Nonempty frozen structural or editor-command diagnostics. */
  readonly diagnostics: readonly [
    DesenStructuralDiagnostic | DesenEditorEventActionEditDiagnostic,
    ...(DesenStructuralDiagnostic | DesenEditorEventActionEditDiagnostic)[],
  ];
}

/** Complete result of one M08-T06 event-handler or closed-action command. */
export type DesenEditorEventActionEditResult =
  DesenEditorEventActionEditFailure | DesenEditorEventActionEditSuccess;

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

interface InspectionLimit {
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
  | Readonly<{ readonly ok: false; readonly result: DesenEditorEventActionEditFailure }>;

type ResolvedOwnerResult =
  | Readonly<{ readonly ok: true; readonly match: OwnerMatch }>
  | Readonly<{ readonly ok: false; readonly result: DesenEditorEventActionEditFailure }>;

type SettlementBranch = "onFailure" | "onSuccess";

interface ActionListStep {
  readonly branch: SettlementBranch;
  readonly index: number;
}

interface ParsedActionListPointer {
  readonly event: string;
  readonly steps: readonly ActionListStep[];
}

interface ParsedActionPointer {
  readonly index: number;
  readonly list: ParsedActionListPointer;
}

interface CapturedEventHandlerInsertCommand {
  readonly actions: readonly DesenEditorAction[];
  readonly event: string;
  readonly ownerId: string;
  readonly surfaceId: string;
}

interface CapturedEventHandlerDeleteCommand {
  readonly event: string;
  readonly ownerId: string;
  readonly surfaceId: string;
}

interface CapturedActionInsertCommand {
  readonly action: DesenEditorAction;
  readonly index: number;
  readonly list: ParsedActionListPointer;
  readonly ownerId: string;
  readonly surfaceId: string;
}

interface CapturedActionReplaceCommand {
  readonly action: DesenEditorAction;
  readonly ownerId: string;
  readonly pointer: ParsedActionPointer;
  readonly surfaceId: string;
}

interface CapturedActionDeleteCommand {
  readonly ownerId: string;
  readonly pointer: ParsedActionPointer;
  readonly surfaceId: string;
}

interface CapturedActionReorderCommand extends CapturedActionDeleteCommand {
  readonly index: number;
}

interface MutationIssue {
  readonly code:
    | "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED"
    | "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND"
    | "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID"
    | "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS"
    | "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND";
  readonly match: OwnerMatch;
  readonly message: string;
  readonly pointer: JsonPointer;
}

type MutationResult =
  Readonly<{ readonly ok: true }> | Readonly<{ readonly ok: false; readonly issue: MutationIssue }>;

type ActionListResolution =
  | Readonly<{ readonly ok: true; readonly actions: MutableEditorActionList }>
  | Readonly<{ readonly ok: false; readonly result: MutationResult }>;

interface PendingAction {
  readonly action: unknown;
  readonly depth: number;
  readonly pointer: JsonPointer;
}

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
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalIndex(token: string): number | undefined {
  if (!CANONICAL_INDEX_PATTERN.test(token)) return undefined;
  const index = Number(token);
  return safeIndex(index) && String(index) === token ? index : undefined;
}

function parseActionListTokens(tokens: readonly string[]): ParsedActionListPointer | undefined {
  if (tokens.length < 2 || tokens.length % 2 !== 0 || tokens[0] !== "on") return undefined;
  const event = tokens[1];
  if (!localIdentifier(event)) return undefined;
  const steps: ActionListStep[] = [];
  for (let offset = 2; offset < tokens.length; offset += 2) {
    const indexToken = tokens[offset];
    const branch = tokens[offset + 1];
    if (indexToken === undefined || (branch !== "onFailure" && branch !== "onSuccess")) {
      return undefined;
    }
    const index = canonicalIndex(indexToken);
    if (index === undefined) return undefined;
    steps.push(Object.freeze({ branch, index }));
  }
  return Object.freeze({ event, steps: Object.freeze(steps) });
}

function parseActionListPointer(value: unknown): ParsedActionListPointer | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return parseActionListTokens(parseJsonPointer(value));
  } catch {
    return undefined;
  }
}

function parseActionPointer(value: unknown): ParsedActionPointer | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const tokens = parseJsonPointer(value);
    if (tokens.length < 3 || tokens.length % 2 !== 1) return undefined;
    const indexToken = tokens[tokens.length - 1];
    if (indexToken === undefined) return undefined;
    const index = canonicalIndex(indexToken);
    const list = parseActionListTokens(tokens.slice(0, -1));
    return index === undefined || list === undefined ? undefined : Object.freeze({ index, list });
  } catch {
    return undefined;
  }
}

function captureEventHandlerInsert(
  input: DesenEditorEventHandlerInsertCommand,
): CapturedEventHandlerInsertCommand | undefined {
  const fields = exactOwnData(input, ["actions", "event", "ownerId", "surfaceId"]);
  if (
    fields === undefined ||
    !Array.isArray(fields.actions) ||
    !localIdentifier(fields.event) ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const actions = captureJson<readonly DesenEditorAction[]>(fields.actions);
  return actions === undefined || !Array.isArray(actions)
    ? undefined
    : Object.freeze({
        actions: Object.freeze(actions),
        event: fields.event,
        ownerId: fields.ownerId,
        surfaceId: fields.surfaceId,
      });
}

function captureEventHandlerDelete(
  input: DesenEditorEventHandlerDeleteCommand,
): CapturedEventHandlerDeleteCommand | undefined {
  const fields = exactOwnData(input, ["event", "ownerId", "surfaceId"]);
  return fields !== undefined &&
    localIdentifier(fields.event) &&
    localIdentifier(fields.ownerId) &&
    localIdentifier(fields.surfaceId)
    ? Object.freeze({
        event: fields.event,
        ownerId: fields.ownerId,
        surfaceId: fields.surfaceId,
      })
    : undefined;
}

function captureActionInsert(
  input: DesenEditorActionInsertCommand,
): CapturedActionInsertCommand | undefined {
  const fields = exactOwnData(input, [
    "action",
    "actionListPointer",
    "index",
    "ownerId",
    "surfaceId",
  ]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const list = parseActionListPointer(fields.actionListPointer);
  const action = captureJson<DesenEditorAction>(fields.action);
  return list === undefined || action === undefined
    ? undefined
    : Object.freeze({
        action,
        index: fields.index,
        list,
        ownerId: fields.ownerId,
        surfaceId: fields.surfaceId,
      });
}

function captureActionReplace(
  input: DesenEditorActionReplaceCommand,
): CapturedActionReplaceCommand | undefined {
  const fields = exactOwnData(input, ["action", "actionPointer", "ownerId", "surfaceId"]);
  if (
    fields === undefined ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const pointer = parseActionPointer(fields.actionPointer);
  const action = captureJson<DesenEditorAction>(fields.action);
  return pointer === undefined || action === undefined
    ? undefined
    : Object.freeze({ action, ownerId: fields.ownerId, pointer, surfaceId: fields.surfaceId });
}

function captureActionDelete(
  input: DesenEditorActionDeleteCommand,
): CapturedActionDeleteCommand | undefined {
  const fields = exactOwnData(input, ["actionPointer", "ownerId", "surfaceId"]);
  if (
    fields === undefined ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const pointer = parseActionPointer(fields.actionPointer);
  return pointer === undefined
    ? undefined
    : Object.freeze({ ownerId: fields.ownerId, pointer, surfaceId: fields.surfaceId });
}

function captureActionReorder(
  input: DesenEditorActionReorderCommand,
): CapturedActionReorderCommand | undefined {
  const fields = exactOwnData(input, ["actionPointer", "index", "ownerId", "surfaceId"]);
  if (
    fields === undefined ||
    !safeIndex(fields.index) ||
    !localIdentifier(fields.ownerId) ||
    !localIdentifier(fields.surfaceId)
  ) {
    return undefined;
  }
  const pointer = parseActionPointer(fields.actionPointer);
  return pointer === undefined
    ? undefined
    : Object.freeze({
        index: fields.index,
        ownerId: fields.ownerId,
        pointer,
        surfaceId: fields.surfaceId,
      });
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

function eventActionDiagnostic(
  code: DesenEditorEventActionEditDiagnosticCode,
  message: string,
  pointer?: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): DesenEditorEventActionEditDiagnostic {
  return Object.freeze({
    code,
    message,
    ...(pointer === undefined ? {} : { pointer }),
    ...(context === undefined ? {} : { context }),
  });
}

function eventActionFailure(
  diagnostic: DesenStructuralDiagnostic | DesenEditorEventActionEditDiagnostic,
  ...rest: (DesenStructuralDiagnostic | DesenEditorEventActionEditDiagnostic)[]
): DesenEditorEventActionEditFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      diagnostic,
      ...rest,
    ]) as DesenEditorEventActionEditFailure["diagnostics"],
  });
}

function commandFailure(message: string): DesenEditorEventActionEditFailure {
  return eventActionFailure(
    eventActionDiagnostic("run.desen.editor/EVENT_ACTION_EDIT_COMMAND_INVALID", message),
  );
}

function structuralFailure(
  diagnostics: readonly DesenStructuralDiagnostic[],
): DesenEditorEventActionEditFailure {
  const first = diagnostics[0];
  return first === undefined
    ? commandFailure("The editor document could not be admitted for an event/action edit.")
    : eventActionFailure(first, ...diagnostics.slice(1));
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
): SurfaceInspection | InspectionLimit {
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
      identityOccurrences > EVENT_ACTION_EDIT_PROFILE.maxIdentityOccurrencesPerSurface ||
      current.depth > EVENT_ACTION_EDIT_PROFILE.maxSourceTreeDepth
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

function actionRecord(action: unknown): Record<string, unknown> | undefined {
  return typeof action === "object" && action !== null && !Array.isArray(action)
    ? (action as Record<string, unknown>)
    : undefined;
}

function scheduleActionList(
  pending: PendingAction[],
  actions: readonly unknown[],
  listPointer: JsonPointer,
  depth: number,
): void {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    pending.push(
      Object.freeze({
        action: actions[index],
        depth,
        pointer: appendJsonPointer(listPointer, index),
      }),
    );
  }
}

function inspectOwnerActions(
  owner: EditorOwner,
  ownerPointer: JsonPointer,
): InspectionLimit | undefined {
  const on = Object.hasOwn(owner, "on") ? owner.on : undefined;
  if (on === undefined) return undefined;
  const pending: PendingAction[] = [];
  const events = Object.keys(on).sort(compareText);
  for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const event = events[eventIndex] as string;
    const actions = on[event] ?? [];
    scheduleActionList(
      pending,
      actions,
      appendJsonPointer(appendJsonPointer(ownerPointer, "on"), event),
      0,
    );
  }
  let occurrences = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    occurrences += 1;
    if (
      occurrences > EVENT_ACTION_EDIT_PROFILE.maxActionOccurrencesPerOwner ||
      current.depth > EVENT_ACTION_EDIT_PROFILE.maxActionNestingDepth
    ) {
      return Object.freeze({ pointer: current.pointer, status: "limit-exceeded" });
    }
    const record = actionRecord(current.action);
    if (record?.type !== "operation.invoke") continue;
    for (const branch of ["onSuccess", "onFailure"] as const) {
      const actions = Object.hasOwn(record, branch) ? record[branch] : undefined;
      if (Array.isArray(actions)) {
        scheduleActionList(
          pending,
          actions,
          appendJsonPointer(current.pointer, branch),
          current.depth + 1,
        );
      }
    }
  }
  return undefined;
}

function prepareSurface(
  editorDocument: DesenEditorDocument,
  surfaceId: string,
): PreparedSurfaceResult {
  const admitted = createDesenEditorDocument(editorDocument);
  if (!admitted.ok) {
    return Object.freeze({ ok: false, result: structuralFailure(admitted.diagnostics) });
  }
  if (
    canonicalizeJsonBytes(admitted.document).byteLength >
    EVENT_ACTION_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return Object.freeze({
      ok: false,
      result: eventActionFailure(
        eventActionDiagnostic(
          "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
          "The editor document exceeds the finite event/action edit profile.",
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
      result: eventActionFailure(
        eventActionDiagnostic(
          "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
          "The event/action command targets a surface that does not exist.",
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
      result: eventActionFailure(
        eventActionDiagnostic(
          "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
          "The target surface exceeds the finite event/action edit profile.",
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
): ResolvedOwnerResult {
  const matches = prepared.inspection.matches.filter((match) => match.owner.id === ownerId);
  if (matches.length === 0) {
    return Object.freeze({
      ok: false,
      result: eventActionFailure(
        eventActionDiagnostic(
          "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
          "The event/action command owner does not exist in the target surface.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  if (matches.length !== 1) {
    return Object.freeze({
      ok: false,
      result: eventActionFailure(
        eventActionDiagnostic(
          "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS",
          "The event/action command identity is ambiguous in the target surface.",
          prepared.surfacePointer,
          frozenContext(prepared.document, surfaceId),
        ),
      ),
    });
  }
  return Object.freeze({ ok: true, match: matches[0] as OwnerMatch });
}

function mutableDocument(sourceDocument: DesenEditorDocument): MutableEditorDocument {
  return JSON.parse(canonicalizeJson(sourceDocument)) as MutableEditorDocument;
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

function eventPointer(match: OwnerMatch, event: string): JsonPointer {
  return appendJsonPointer(appendJsonPointer(match.pointer, "on"), event);
}

function actionListPointer(match: OwnerMatch, parsed: ParsedActionListPointer): JsonPointer {
  let pointer = eventPointer(match, parsed.event);
  for (const step of parsed.steps) {
    pointer = appendJsonPointer(appendJsonPointer(pointer, step.index), step.branch);
  }
  return pointer;
}

function actionPointer(match: OwnerMatch, parsed: ParsedActionPointer): JsonPointer {
  return appendJsonPointer(actionListPointer(match, parsed.list), parsed.index);
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

function pointerDepthIssue(match: OwnerMatch, parsed: ParsedActionListPointer): MutationResult {
  return mutationIssue(
    "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
    match,
    "The action-list pointer exceeds the finite settlement-nesting profile.",
    actionListPointer(match, parsed),
  );
}

function resolveActionList(
  owner: MutableEditorOwner,
  match: OwnerMatch,
  parsed: ParsedActionListPointer,
  createFinalSettlement: boolean,
  insertionIndex?: number,
): ActionListResolution {
  const on = ownRecord(owner, "on");
  const root = on?.[parsed.event];
  if (on === undefined || !Object.hasOwn(on, parsed.event) || !Array.isArray(root)) {
    return Object.freeze({
      ok: false,
      result: mutationIssue(
        "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
        match,
        "The action-list pointer does not select an existing root event handler.",
        eventPointer(match, parsed.event),
      ),
    });
  }

  let actions = root as MutableEditorActionList;
  let pointer = eventPointer(match, parsed.event);
  for (let stepIndex = 0; stepIndex < parsed.steps.length; stepIndex += 1) {
    const step = parsed.steps[stepIndex] as ActionListStep;
    const selected = actions[step.index];
    const selectedPointer = appendJsonPointer(pointer, step.index);
    if (selected === undefined) {
      return Object.freeze({
        ok: false,
        result: mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "The action-list pointer contains an action index that does not exist.",
          selectedPointer,
        ),
      });
    }
    const branchPointer = appendJsonPointer(selectedPointer, step.branch);
    if (selected.type !== "operation.invoke") {
      return Object.freeze({
        ok: false,
        result: mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
          match,
          "Only an operation.invoke action can own a settlement action list.",
          branchPointer,
        ),
      });
    }
    const record = selected as unknown as Record<string, unknown>;
    const branch = Object.hasOwn(record, step.branch) ? record[step.branch] : undefined;
    const isFinalStep = stepIndex === parsed.steps.length - 1;
    if (branch === undefined) {
      if (createFinalSettlement && isFinalStep) {
        if (insertionIndex !== 0) {
          return Object.freeze({
            ok: false,
            result: mutationIssue(
              "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
              match,
              "An absent settlement list can be created only at boundary zero.",
              appendJsonPointer(branchPointer, insertionIndex ?? 0),
            ),
          });
        }
        const created: MutableEditorActionList = [];
        defineOwn(record, step.branch, created);
        actions = created;
        pointer = branchPointer;
        continue;
      }
      return Object.freeze({
        ok: false,
        result: mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
          match,
          "The selected operation does not own the requested settlement action list.",
          branchPointer,
        ),
      });
    }
    if (!Array.isArray(branch)) {
      return Object.freeze({
        ok: false,
        result: mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND",
          match,
          "The selected settlement member is not an action list.",
          branchPointer,
        ),
      });
    }
    actions = branch as MutableEditorActionList;
    pointer = branchPointer;
  }
  return Object.freeze({ ok: true, actions });
}

function finalizeCandidate(
  candidate: MutableEditorDocument,
  surfaceId: string,
  original: DesenEditorDocument,
): DesenEditorEventActionEditResult {
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
        "The target surface disappeared while preparing the event/action edit.",
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
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
        "The event/action edit would exceed the finite target-surface profile.",
        inspection.pointer,
        frozenContext(original, surfaceId),
      ),
    );
  }
  if (
    canonicalizeJsonBytes(candidate).byteLength >
    EVENT_ACTION_EDIT_PROFILE.maxDocumentCanonicalBytes
  ) {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
        "The event/action edit would exceed the finite editor-document profile.",
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
  mutate: (owner: MutableEditorOwner, match: OwnerMatch) => MutationResult,
): DesenEditorEventActionEditResult {
  const preparation = prepareSurface(editorDocument, surfaceId);
  if (!preparation.ok) return preparation.result;
  const prepared = preparation.value;
  const resolved = resolveOwner(prepared, surfaceId, ownerId);
  if (!resolved.ok) return resolved.result;

  const priorActionLimit = inspectOwnerActions(resolved.match.owner, resolved.match.pointer);
  if (priorActionLimit !== undefined) {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
        "The selected owner exceeds the finite event/action traversal profile.",
        priorActionLimit.pointer,
        frozenContext(prepared.document, surfaceId, resolved.match),
      ),
    );
  }

  const candidate = mutableDocument(prepared.document);
  const surface = candidate.surfaces[surfaceId];
  if (surface === undefined) {
    return commandFailure("The detached event/action edit surface disappeared.");
  }
  const inspection = inspectSurface(
    surface.root as EditorNode,
    appendJsonPointer(prepared.surfacePointer, "root"),
  );
  if (inspection.status === "limit-exceeded") {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
        "The detached event/action edit candidate exceeds the finite profile.",
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
  const candidateResolved = resolveOwner(candidatePrepared, surfaceId, ownerId);
  if (!candidateResolved.ok) {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS",
        "The event/action target could not be reproduced in the detached candidate.",
        prepared.surfacePointer,
        frozenContext(prepared.document, surfaceId),
      ),
    );
  }

  const mutation = mutate(mutableOwner(candidateResolved.match.owner), resolved.match);
  if (!mutation.ok) {
    return eventActionFailure(
      eventActionDiagnostic(
        mutation.issue.code,
        mutation.issue.message,
        mutation.issue.pointer,
        frozenContext(prepared.document, surfaceId, mutation.issue.match),
      ),
    );
  }

  const nextActionLimit = inspectOwnerActions(
    candidateResolved.match.owner,
    candidateResolved.match.pointer,
  );
  if (nextActionLimit !== undefined) {
    return eventActionFailure(
      eventActionDiagnostic(
        "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED",
        "The event/action edit would exceed the finite owner-action traversal profile.",
        nextActionLimit.pointer,
        frozenContext(prepared.document, surfaceId, resolved.match),
      ),
    );
  }
  return finalizeCandidate(candidate, surfaceId, prepared.document);
}

/**
 * Inserts one absent event handler on a unique surface-local node or behavior.
 *
 * @remarks A missing `on` map is created as own data, while a duplicate event fails explicitly.
 * The complete ordered action list is captured without guard, reference, map, or settlement
 * interpretation. Success is detached and recursively frozen; every failure is atomic.
 */
export function insertDesenEditorEventHandler(
  editorDocument: DesenEditorDocument,
  command: DesenEditorEventHandlerInsertCommand,
): DesenEditorEventActionEditResult {
  const captured = captureEventHandlerInsert(command);
  if (captured === undefined) {
    return commandFailure("Event-handler-insert command must be exact inert own data.");
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      const on = ownRecord(owner, "on") ?? Object.create(null);
      const pointer = eventPointer(match, captured.event);
      if (Object.hasOwn(on, captured.event)) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS",
          match,
          "The selected owner already has this event handler.",
          pointer,
        );
      }
      defineOwn(on, captured.event, captured.actions as MutableEditorActionList);
      defineOwn(owner, "on", on);
      return mutationSuccess();
    },
  );
}

/**
 * Deletes one existing event handler while retaining the owner's own `on` map when empty.
 *
 * @remarks The action list and its nested settlement branches are removed only with that exact
 * event member. Missing handlers are errors; success preserves every identity and unrelated
 * semantic order in a fresh detached recursively frozen direct Source.
 */
export function deleteDesenEditorEventHandler(
  editorDocument: DesenEditorDocument,
  command: DesenEditorEventHandlerDeleteCommand,
): DesenEditorEventActionEditResult {
  const captured = captureEventHandlerDelete(command);
  if (captured === undefined) {
    return commandFailure("Event-handler-delete command must be exact inert own data.");
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      const on = ownRecord(owner, "on");
      const pointer = eventPointer(match, captured.event);
      if (on === undefined || !Object.hasOwn(on, captured.event)) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND",
          match,
          "The selected owner does not have this event handler.",
          pointer,
        );
      }
      Reflect.deleteProperty(on, captured.event);
      return mutationSuccess();
    },
  );
}

/**
 * Inserts one complete action at an existing root or nested ordered-list boundary.
 *
 * @remarks A generic action insert never creates a missing root event. It may create only its
 * final absent `onSuccess` or `onFailure` list, only at boundary zero and only on an existing
 * `operation.invoke` action. Closed-union structure is re-admitted without Catalog semantics.
 */
export function insertDesenEditorAction(
  editorDocument: DesenEditorDocument,
  command: DesenEditorActionInsertCommand,
): DesenEditorEventActionEditResult {
  const captured = captureActionInsert(command);
  if (captured === undefined) {
    return commandFailure(
      "Action-insert command must use exact data and a canonical action pointer.",
    );
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      if (captured.list.steps.length > EVENT_ACTION_EDIT_PROFILE.maxActionNestingDepth) {
        return pointerDepthIssue(match, captured.list);
      }
      const resolved = resolveActionList(owner, match, captured.list, true, captured.index);
      if (!resolved.ok) return resolved.result;
      if (captured.index > resolved.actions.length) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "The action insert index must address an existing ordered boundary.",
          appendJsonPointer(actionListPointer(match, captured.list), captured.index),
        );
      }
      resolved.actions.splice(captured.index, 0, captured.action as MutableEditorAction);
      return mutationSuccess();
    },
  );
}

/**
 * Replaces one existing action as a whole closed-union value.
 *
 * @remarks Replacement may change the action discriminant, guard, payload, input, parameters,
 * extensions, and complete nested success/failure branches together. No prior action member is
 * merged or normalized; structural re-admission and fixed limits remain atomic.
 */
export function replaceDesenEditorAction(
  editorDocument: DesenEditorDocument,
  command: DesenEditorActionReplaceCommand,
): DesenEditorEventActionEditResult {
  const captured = captureActionReplace(command);
  if (captured === undefined) {
    return commandFailure(
      "Action-replace command must use exact data and a canonical action pointer.",
    );
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      if (captured.pointer.list.steps.length > EVENT_ACTION_EDIT_PROFILE.maxActionNestingDepth) {
        return pointerDepthIssue(match, captured.pointer.list);
      }
      const resolved = resolveActionList(owner, match, captured.pointer.list, false);
      if (!resolved.ok) return resolved.result;
      if (resolved.actions[captured.pointer.index] === undefined) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "The action pointer does not select an existing action.",
          actionPointer(match, captured.pointer),
        );
      }
      resolved.actions[captured.pointer.index] = captured.action as MutableEditorAction;
      return mutationSuccess();
    },
  );
}

/**
 * Deletes one existing action while retaining its root or settlement list as own empty data.
 *
 * @remarks Missing lists and indices fail rather than becoming no-ops. Success preserves all
 * unrelated action order and every node/behavior identity in a fresh detached recursively frozen
 * Source; semantic reference validity remains M08-T09 work.
 */
export function deleteDesenEditorAction(
  editorDocument: DesenEditorDocument,
  command: DesenEditorActionDeleteCommand,
): DesenEditorEventActionEditResult {
  const captured = captureActionDelete(command);
  if (captured === undefined) {
    return commandFailure(
      "Action-delete command must use exact data and a canonical action pointer.",
    );
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      if (captured.pointer.list.steps.length > EVENT_ACTION_EDIT_PROFILE.maxActionNestingDepth) {
        return pointerDepthIssue(match, captured.pointer.list);
      }
      const resolved = resolveActionList(owner, match, captured.pointer.list, false);
      if (!resolved.ok) return resolved.result;
      if (resolved.actions[captured.pointer.index] === undefined) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "The action pointer does not select an existing action.",
          actionPointer(match, captured.pointer),
        );
      }
      resolved.actions.splice(captured.pointer.index, 1);
      return mutationSuccess();
    },
  );
}

/**
 * Reorders one existing action within its current root or settlement list.
 *
 * @remarks `index` is the selected action's final position after removal. Both the source action
 * and final position must exist; success changes no action value, other list, owner identity, or
 * unrelated semantic order and returns a fresh detached recursively frozen Source.
 */
export function reorderDesenEditorAction(
  editorDocument: DesenEditorDocument,
  command: DesenEditorActionReorderCommand,
): DesenEditorEventActionEditResult {
  const captured = captureActionReorder(command);
  if (captured === undefined) {
    return commandFailure(
      "Action-reorder command must use exact data and a canonical action pointer.",
    );
  }
  return applyOwnerMutation(
    editorDocument,
    captured.surfaceId,
    captured.ownerId,
    (owner, match) => {
      if (captured.pointer.list.steps.length > EVENT_ACTION_EDIT_PROFILE.maxActionNestingDepth) {
        return pointerDepthIssue(match, captured.pointer.list);
      }
      const resolved = resolveActionList(owner, match, captured.pointer.list, false);
      if (!resolved.ok) return resolved.result;
      if (
        resolved.actions[captured.pointer.index] === undefined ||
        captured.index > resolved.actions.length - 1
      ) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "Action reorder indices must select an action and a post-removal final position.",
          actionPointer(match, captured.pointer),
        );
      }
      const selected = resolved.actions.splice(captured.pointer.index, 1)[0];
      if (selected === undefined) {
        return mutationIssue(
          "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID",
          match,
          "The selected action disappeared during reorder.",
          actionPointer(match, captured.pointer),
        );
      }
      resolved.actions.splice(captured.index, 0, selected);
      return mutationSuccess();
    },
  );
}
