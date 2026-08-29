import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorAction,
  deleteDesenEditorEventHandler,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  reorderDesenEditorAction,
  replaceDesenEditorAction,
} from "@desen/editor-core";
import { escapeJsonPointerToken } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type {
  DesenEditorContinuousValidationReport,
  DesenEditorActionListPointer,
  DesenEditorActionPointer,
  DesenEditorDocument,
  DesenEditorEventActionEditResult as CoreEventActionEditResult,
} from "@desen/editor-core";
import type { CatalogAuthoringModel } from "./authoring-data.js";

type JsonObject = Readonly<Record<string, unknown>>;

const AUTHORING_EVENT_ACTION_LIMITS = Object.freeze({
  maxActionDepth: 64,
  maxActionOccurrences: 25_000,
  maxIdentityOccurrences: 25_000,
  maxSourceDepth: 64,
});

const ACTION_TYPES = Object.freeze([
  "component.command",
  "event.emit",
  "navigate",
  "operation.invoke",
  "resource.refresh",
  "state.set",
  "state.toggle",
] as const);

/** Exact App route that may authorize an event/action projection or mutation. */
export interface AuthoringEventActionRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Stable App-owned identity for one component event owner. */
export interface AuthoringEventOwnerSelection {
  readonly kind: "event-owner";
  readonly projectId: string;
  readonly surfaceId: string;
  readonly ownerKind: "component";
  readonly ownerId: string;
  readonly capabilityId: string;
  readonly displayName: string;
  readonly conditional: boolean;
}

/** One closed DESEN action discriminator supported by the authoring boundary. */
export type AuthoringActionType = (typeof ACTION_TYPES)[number];

/**
 * Complete recursively closed action value accepted by the App editor.
 *
 * @remarks Runtime admission remains authoritative for predicates, identifiers, and every nested
 * ValueSpec. This public shape keeps the seven-action discriminator available to App-owned React
 * chrome instead of widening it to an arbitrary JSON value.
 */
export type AuthoringClosedAction =
  | Readonly<{
      readonly type: "state.set";
      readonly path: string;
      readonly value: JsonValue;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "state.toggle";
      readonly path: string;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "navigate";
      readonly surface: string;
      readonly params?: Readonly<Record<string, JsonValue>>;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "operation.invoke";
      readonly operation: string;
      readonly as: string;
      readonly input: Readonly<Record<string, JsonValue>>;
      readonly concurrency?: "queue" | "reject" | "replace";
      readonly onSuccess?: readonly AuthoringClosedAction[];
      readonly onFailure?: readonly AuthoringClosedAction[];
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "resource.refresh";
      readonly resource: string;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "component.command";
      readonly target: string;
      readonly command: string;
      readonly input?: Readonly<Record<string, JsonValue>>;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>
  | Readonly<{
      readonly type: "event.emit";
      readonly name: string;
      readonly payload?: Readonly<Record<string, JsonValue>>;
      readonly when?: Readonly<Record<string, JsonValue>>;
      readonly extensions?: Readonly<Record<string, JsonValue>>;
    }>;

/** One labeled reference candidate for an action field. */
export interface AuthoringActionReferenceOption {
  readonly value: string;
  readonly label: string;
}

/** One component-command pair currently addressable on the selected surface. */
export interface AuthoringComponentCommandReferenceOption {
  readonly targetId: string;
  readonly targetLabel: string;
  readonly command: string;
  readonly label: string;
}

/** Bounded reference candidates derived from the exact current Source and Catalog. */
export interface AuthoringEventActionReferenceOptions {
  readonly states: readonly AuthoringActionReferenceOption[];
  readonly surfaces: readonly AuthoringActionReferenceOption[];
  readonly operations: readonly AuthoringActionReferenceOption[];
  readonly resources: readonly AuthoringActionReferenceOption[];
  readonly componentCommands: readonly AuthoringComponentCommandReferenceOption[];
}

/** One recursively projected action list, retaining absent versus present-empty state. */
export interface AuthoringActionListModel {
  readonly pointer: DesenEditorActionListPointer;
  readonly present: boolean;
  readonly actions: readonly AuthoringActionModel[];
}

/** One closed action and the canonical pointers of any operation settlement branches. */
export interface AuthoringActionModel {
  readonly pointer: DesenEditorActionPointer;
  readonly index: number;
  readonly depth: number;
  readonly action: AuthoringClosedAction;
  readonly onSuccess: AuthoringActionListModel | null;
  readonly onFailure: AuthoringActionListModel | null;
}

/** One Catalog-declared owner event and its current root action-list lifecycle. */
export interface AuthoringEventHandlerModel {
  readonly event: string;
  readonly description: string | undefined;
  readonly payloadSchema: JsonObject;
  readonly actionList: AuthoringActionListModel;
}

/** Route- and owner-authenticated event/action projection ready for App chrome. */
export interface AuthoringEventActionReadyModel {
  readonly status: "ready";
  readonly route: AuthoringEventActionRoute;
  readonly owner: AuthoringEventOwnerSelection;
  readonly events: readonly AuthoringEventHandlerModel[];
  readonly referenceOptions: AuthoringEventActionReferenceOptions;
}

/** Honest outcome of preparing an event/action projection for the current selection. */
export type AuthoringEventActionModelResult =
  | Readonly<{ readonly status: "idle" }>
  | AuthoringEventActionReadyModel
  | Readonly<{
      readonly status: "rejected";
      readonly reason: "projection-limit" | "route-invalid" | "selection-invalid";
    }>;

/** Exact App edit mapped one-to-one to the six public Editor Core event/action commands. */
export type AuthoringEventActionEdit =
  | Readonly<{
      readonly kind: "insert-handler";
      readonly event: string;
      readonly actions: readonly AuthoringClosedAction[];
    }>
  | Readonly<{ readonly kind: "delete-handler"; readonly event: string }>
  | Readonly<{
      readonly kind: "insert-action";
      readonly actionListPointer: DesenEditorActionListPointer;
      readonly index: number;
      readonly action: AuthoringClosedAction;
    }>
  | Readonly<{
      readonly kind: "replace-action";
      readonly actionPointer: DesenEditorActionPointer;
      readonly action: AuthoringClosedAction;
    }>
  | Readonly<{
      readonly kind: "delete-action";
      readonly actionPointer: DesenEditorActionPointer;
    }>
  | Readonly<{
      readonly kind: "reorder-action";
      readonly actionPointer: DesenEditorActionPointer;
      /** Final index after removing the selected action from its current list. */
      readonly index: number;
    }>;

/** Stable operation name identifying which public Editor Core command was attempted. */
export type AuthoringEventActionOperation = AuthoringEventActionEdit["kind"];

/** Atomic event/action success over one fresh immutable direct Source. */
export interface AuthoringEventActionEditSuccess {
  readonly ok: true;
  readonly operation: AuthoringEventActionOperation;
  readonly document: DesenEditorDocument;
}

/** Stable, UI-safe reason why an event/action request produced no Source document. */
export type AuthoringEventActionEditFailureReason =
  | "catalog-invalid"
  | "edit-rejected"
  | "event-exists"
  | "event-not-found"
  | "owner-invalid"
  | "path-invalid"
  | "position-invalid"
  | "preview-unavailable"
  | "projection-limit"
  | "source-invalid";

/** Atomic event/action failure with no partial Source snapshot. */
export interface AuthoringEventActionEditFailure {
  readonly ok: false;
  readonly reason: AuthoringEventActionEditFailureReason;
  /** Complete rejected-candidate diagnostics when continuous validation reached that boundary. */
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete result of one App-owned handler or closed-action edit. */
export type AuthoringEventActionEditResult =
  AuthoringEventActionEditFailure | AuthoringEventActionEditSuccess;

type CapturedAuthoringEventActionEdit = AuthoringEventActionEdit;

interface OwnerResolution {
  readonly owner: JsonObject;
  readonly surface: JsonObject;
}

interface ProjectionCounter {
  actionOccurrences: number;
}

interface LocatedAction {
  readonly action: AuthoringActionModel;
  readonly list: AuthoringActionListModel;
}

class EventActionProjectionLimitError extends Error {}
class EventActionProjectionRejectedError extends Error {}
class EventActionRouteRejectedError extends Error {}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure(
  reason: AuthoringEventActionEditFailureReason,
  validationReport?: DesenEditorContinuousValidationReport,
): AuthoringEventActionEditFailure {
  return Object.freeze({
    ok: false,
    reason,
    ...(validationReport === undefined ? {} : { validationReport }),
  });
}

function exactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return undefined;
  }
  const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function ownDataObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EventActionProjectionRejectedError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new EventActionProjectionRejectedError();
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new EventActionProjectionRejectedError();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new EventActionProjectionRejectedError();
    }
  }
  return value as JsonObject;
}

function ownDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor?.enumerable !== true || !("value" in descriptor)) {
    throw new EventActionProjectionRejectedError();
  }
  return descriptor.value;
}

function optionalOwnDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return undefined;
  if (descriptor.enumerable !== true || !("value" in descriptor)) {
    throw new EventActionProjectionRejectedError();
  }
  return descriptor.value;
}

function dataArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new EventActionProjectionRejectedError();
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0
  ) {
    throw new EventActionProjectionRejectedError();
  }
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some(
      (key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    throw new EventActionProjectionRejectedError();
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new EventActionProjectionRejectedError();
    }
    result.push(descriptor.value);
  }
  return result;
}

function dataObjectArray(value: unknown): readonly JsonObject[] {
  return dataArray(value).map(ownDataObject);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function readNonEmptyString(object: JsonObject, key: string): string {
  const value = ownDataValue(object, key);
  if (!isNonEmptyString(value)) throw new EventActionProjectionRejectedError();
  return value;
}

function optionalObject(object: JsonObject, key: string): JsonObject | undefined {
  const value = optionalOwnDataValue(object, key);
  return value === undefined ? undefined : ownDataObject(value);
}

function optionalObjectArray(object: JsonObject, key: string): readonly JsonObject[] {
  const value = optionalOwnDataValue(object, key);
  return value === undefined ? Object.freeze([]) : dataObjectArray(value);
}

function captureRoute(route: AuthoringEventActionRoute): AuthoringEventActionRoute | undefined {
  try {
    const fields = exactOwnData(route, ["projectId", "surfaceId"]);
    if (
      fields === undefined ||
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({ projectId: fields.projectId, surfaceId: fields.surfaceId });
  } catch {
    return undefined;
  }
}

function captureSelection(
  selection: AuthoringEventOwnerSelection,
): AuthoringEventOwnerSelection | undefined {
  try {
    const fields = exactOwnData(selection, [
      "capabilityId",
      "conditional",
      "displayName",
      "kind",
      "ownerId",
      "ownerKind",
      "projectId",
      "surfaceId",
    ]);
    if (
      fields === undefined ||
      fields.kind !== "event-owner" ||
      fields.ownerKind !== "component" ||
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.surfaceId) ||
      !isNonEmptyString(fields.ownerId) ||
      !isNonEmptyString(fields.capabilityId) ||
      !isNonEmptyString(fields.displayName) ||
      typeof fields.conditional !== "boolean"
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "event-owner",
      projectId: fields.projectId,
      surfaceId: fields.surfaceId,
      ownerKind: fields.ownerKind,
      ownerId: fields.ownerId,
      capabilityId: fields.capabilityId,
      displayName: fields.displayName,
      conditional: fields.conditional,
    });
  } catch {
    return undefined;
  }
}

function captureEdit(edit: AuthoringEventActionEdit): CapturedAuthoringEventActionEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    if (kindDescriptor?.enumerable !== true || !("value" in kindDescriptor)) return undefined;

    if (kindDescriptor.value === "insert-handler") {
      const fields = exactOwnData(edit, ["actions", "event", "kind"]);
      if (
        fields === undefined ||
        !isNonEmptyString(fields.event) ||
        !Array.isArray(fields.actions)
      ) {
        return undefined;
      }
      return Object.freeze({
        kind: "insert-handler",
        event: fields.event,
        actions: fields.actions as readonly AuthoringClosedAction[],
      });
    }
    if (kindDescriptor.value === "delete-handler") {
      const fields = exactOwnData(edit, ["event", "kind"]);
      if (fields === undefined || !isNonEmptyString(fields.event)) return undefined;
      return Object.freeze({ kind: "delete-handler", event: fields.event });
    }
    if (kindDescriptor.value === "insert-action") {
      const fields = exactOwnData(edit, ["action", "actionListPointer", "index", "kind"]);
      if (
        fields === undefined ||
        !isNonEmptyString(fields.actionListPointer) ||
        !Number.isSafeInteger(fields.index) ||
        (fields.index as number) < 0
      ) {
        return undefined;
      }
      return Object.freeze({
        kind: "insert-action",
        actionListPointer: fields.actionListPointer as DesenEditorActionListPointer,
        index: fields.index as number,
        action: fields.action as AuthoringClosedAction,
      });
    }
    if (kindDescriptor.value === "replace-action") {
      const fields = exactOwnData(edit, ["action", "actionPointer", "kind"]);
      if (fields === undefined || !isNonEmptyString(fields.actionPointer)) return undefined;
      return Object.freeze({
        kind: "replace-action",
        actionPointer: fields.actionPointer as DesenEditorActionPointer,
        action: fields.action as AuthoringClosedAction,
      });
    }
    if (kindDescriptor.value === "delete-action") {
      const fields = exactOwnData(edit, ["actionPointer", "kind"]);
      if (fields === undefined || !isNonEmptyString(fields.actionPointer)) return undefined;
      return Object.freeze({
        kind: "delete-action",
        actionPointer: fields.actionPointer as DesenEditorActionPointer,
      });
    }
    if (kindDescriptor.value !== "reorder-action") return undefined;
    const fields = exactOwnData(edit, ["actionPointer", "index", "kind"]);
    if (
      fields === undefined ||
      !isNonEmptyString(fields.actionPointer) ||
      !Number.isSafeInteger(fields.index) ||
      (fields.index as number) < 0
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "reorder-action",
      actionPointer: fields.actionPointer as DesenEditorActionPointer,
      index: fields.index as number,
    });
  } catch {
    return undefined;
  }
}

function childNodes(owner: JsonObject): readonly JsonObject[] {
  const slots = optionalObject(owner, "slots");
  if (slots === undefined) return Object.freeze([]);
  const result: JsonObject[] = [];
  for (const slotName of Object.keys(slots).sort(compareText)) {
    result.push(...dataObjectArray(ownDataValue(slots, slotName)));
  }
  return result;
}

function resolveRawOwner(
  document: DesenEditorDocument,
  route: AuthoringEventActionRoute,
  selection: AuthoringEventOwnerSelection,
): OwnerResolution {
  const documentObject = ownDataObject(document);
  const surfaces = ownDataObject(ownDataValue(documentObject, "surfaces"));
  const surfaceValue = optionalOwnDataValue(surfaces, route.surfaceId);
  if (surfaceValue === undefined) throw new EventActionRouteRejectedError();
  const surface = ownDataObject(surfaceValue);
  const pending: {
    readonly depth: number;
    readonly kind: "behavior" | "component";
    readonly owner: JsonObject;
  }[] = [{ depth: 0, kind: "component", owner: ownDataObject(ownDataValue(surface, "root")) }];
  const matches: { readonly kind: "behavior" | "component"; readonly owner: JsonObject }[] = [];
  let occurrences = 0;

  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    occurrences += 1;
    if (
      occurrences > AUTHORING_EVENT_ACTION_LIMITS.maxIdentityOccurrences ||
      work.depth > AUTHORING_EVENT_ACTION_LIMITS.maxSourceDepth
    ) {
      throw new EventActionProjectionLimitError();
    }
    if (readNonEmptyString(work.owner, "id") === selection.ownerId) matches.push(work);

    const children = childNodes(work.owner);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push({
        depth: work.depth + 1,
        kind: "component",
        owner: children[index] as JsonObject,
      });
    }
    if (work.kind === "component") {
      const behaviors = optionalObjectArray(work.owner, "behaviors");
      for (let index = behaviors.length - 1; index >= 0; index -= 1) {
        pending.push({
          depth: work.depth,
          kind: "behavior",
          owner: behaviors[index] as JsonObject,
        });
      }
    }
  }

  if (matches.length !== 1) throw new EventActionProjectionRejectedError();
  const match = matches[0] as (typeof matches)[number];
  const conditional = optionalOwnDataValue(match.owner, "when") !== undefined;
  if (
    match.kind !== selection.ownerKind ||
    readNonEmptyString(match.owner, "use") !== selection.capabilityId ||
    conditional !== selection.conditional
  ) {
    throw new EventActionProjectionRejectedError();
  }
  return Object.freeze({ owner: match.owner, surface });
}

function resolveLayerOwner(
  model: CatalogAuthoringModel,
  selection: AuthoringEventOwnerSelection,
): void {
  const modelObject = ownDataObject(model);
  const surfaces = dataObjectArray(ownDataValue(modelObject, "surfaces"));
  const selectedSurfaces = surfaces.filter(
    (surface) => readNonEmptyString(surface, "id") === selection.surfaceId,
  );
  if (selectedSurfaces.length !== 1) throw new EventActionRouteRejectedError();

  const root = ownDataObject(ownDataValue(selectedSurfaces[0] as JsonObject, "root"));
  const pending: { readonly kind: "behavior" | "component"; readonly owner: JsonObject }[] = [
    { kind: "component", owner: root },
  ];
  const matches: (typeof pending)[number][] = [];
  let occurrences = 0;
  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    occurrences += 1;
    if (occurrences > AUTHORING_EVENT_ACTION_LIMITS.maxIdentityOccurrences) {
      throw new EventActionProjectionLimitError();
    }
    if (readNonEmptyString(work.owner, "id") === selection.ownerId) matches.push(work);

    const slots = dataObjectArray(ownDataValue(work.owner, "slots"));
    for (let slotIndex = slots.length - 1; slotIndex >= 0; slotIndex -= 1) {
      const children = dataObjectArray(ownDataValue(slots[slotIndex] as JsonObject, "children"));
      for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
        pending.push({ kind: "component", owner: children[childIndex] as JsonObject });
      }
    }
    if (work.kind === "component") {
      const behaviors = dataObjectArray(ownDataValue(work.owner, "behaviors"));
      for (let index = behaviors.length - 1; index >= 0; index -= 1) {
        pending.push({ kind: "behavior", owner: behaviors[index] as JsonObject });
      }
    }
  }
  if (matches.length !== 1) throw new EventActionProjectionRejectedError();
  const match = matches[0] as (typeof matches)[number];
  if (
    match.kind !== selection.ownerKind ||
    readNonEmptyString(match.owner, "capabilityId") !== selection.capabilityId ||
    readNonEmptyString(match.owner, "displayName") !== selection.displayName ||
    ownDataValue(match.owner, "conditional") !== selection.conditional
  ) {
    throw new EventActionProjectionRejectedError();
  }
}

function selectedCatalog(model: CatalogAuthoringModel): JsonObject {
  const modelObject = ownDataObject(model);
  const identity = ownDataObject(ownDataValue(modelObject, "catalog"));
  const id = readNonEmptyString(identity, "id");
  const version = readNonEmptyString(identity, "version");
  const target = readNonEmptyString(identity, "target");
  const catalogs = dataObjectArray(ownDataValue(modelObject, "validationCatalogs"));
  const matches = catalogs.filter(
    (catalog) =>
      readNonEmptyString(catalog, "id") === id &&
      readNonEmptyString(catalog, "version") === version &&
      readNonEmptyString(catalog, "target") === target,
  );
  if (matches.length !== 1) throw new EventActionProjectionRejectedError();
  return matches[0] as JsonObject;
}

function ownerContract(catalog: JsonObject, selection: AuthoringEventOwnerSelection): JsonObject {
  const contracts = ownDataObject(ownDataValue(catalog, "components"));
  const contract = optionalOwnDataValue(contracts, selection.capabilityId);
  if (contract === undefined) throw new EventActionProjectionRejectedError();
  return ownDataObject(contract);
}

function actionType(action: JsonObject): AuthoringActionType {
  const type = ownDataValue(action, "type");
  if (!ACTION_TYPES.some((candidate) => candidate === type)) {
    throw new EventActionProjectionRejectedError();
  }
  return type as AuthoringActionType;
}

function projectActionList(
  actionsValue: unknown,
  present: boolean,
  pointer: DesenEditorActionListPointer,
  depth: number,
  counter: ProjectionCounter,
): AuthoringActionListModel {
  const actions = present ? dataObjectArray(actionsValue) : Object.freeze([]);
  const projected = actions.map((action, index) => {
    if (depth > AUTHORING_EVENT_ACTION_LIMITS.maxActionDepth) {
      throw new EventActionProjectionLimitError();
    }
    counter.actionOccurrences += 1;
    if (counter.actionOccurrences > AUTHORING_EVENT_ACTION_LIMITS.maxActionOccurrences) {
      throw new EventActionProjectionLimitError();
    }
    const type = actionType(action);
    const actionPointer = `${pointer}/${index}` as DesenEditorActionPointer;
    let onSuccess: AuthoringActionListModel | null = null;
    let onFailure: AuthoringActionListModel | null = null;
    if (type === "operation.invoke") {
      const onSuccessValue = optionalOwnDataValue(action, "onSuccess");
      const onFailureValue = optionalOwnDataValue(action, "onFailure");
      onSuccess = projectActionList(
        onSuccessValue,
        onSuccessValue !== undefined,
        `${actionPointer}/onSuccess` as DesenEditorActionListPointer,
        depth + 1,
        counter,
      );
      onFailure = projectActionList(
        onFailureValue,
        onFailureValue !== undefined,
        `${actionPointer}/onFailure` as DesenEditorActionListPointer,
        depth + 1,
        counter,
      );
    }
    return Object.freeze({
      pointer: actionPointer,
      index,
      depth,
      action: action as unknown as AuthoringClosedAction,
      onSuccess,
      onFailure,
    });
  });
  return Object.freeze({ pointer, present, actions: Object.freeze(projected) });
}

function eventModels(
  owner: JsonObject,
  contract: JsonObject,
): readonly AuthoringEventHandlerModel[] {
  const declaredEvents = optionalObject(contract, "events") ?? Object.freeze({});
  const handlers = optionalObject(owner, "on");
  if (handlers !== undefined) {
    for (const eventName of Object.keys(handlers)) {
      if (!Object.hasOwn(declaredEvents, eventName)) {
        throw new EventActionProjectionRejectedError();
      }
    }
  }
  const counter: ProjectionCounter = { actionOccurrences: 0 };
  return Object.freeze(
    Object.keys(declaredEvents)
      .sort(compareText)
      .map((event) => {
        const specification = ownDataObject(ownDataValue(declaredEvents, event));
        const descriptionValue = optionalOwnDataValue(specification, "description");
        if (descriptionValue !== undefined && typeof descriptionValue !== "string") {
          throw new EventActionProjectionRejectedError();
        }
        const payloadSchema = ownDataObject(ownDataValue(specification, "payloadSchema"));
        const actionsValue =
          handlers === undefined ? undefined : optionalOwnDataValue(handlers, event);
        return Object.freeze({
          event,
          description: descriptionValue,
          payloadSchema,
          actionList: projectActionList(
            actionsValue,
            actionsValue !== undefined,
            `/on/${escapeJsonPointerToken(event)}` as DesenEditorActionListPointer,
            0,
            counter,
          ),
        });
      }),
  );
}

function genericOptions(values: readonly string[]): readonly AuthoringActionReferenceOption[] {
  return Object.freeze(
    [...values].sort(compareText).map((value) => Object.freeze({ value, label: value })),
  );
}

function componentCommandOptions(
  catalog: JsonObject,
  surface: JsonObject,
): readonly AuthoringComponentCommandReferenceOption[] {
  const components = ownDataObject(ownDataValue(catalog, "components"));
  const root = ownDataObject(ownDataValue(surface, "root"));
  const pending = [root];
  const result: AuthoringComponentCommandReferenceOption[] = [];
  let occurrences = 0;
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    occurrences += 1;
    if (occurrences > AUTHORING_EVENT_ACTION_LIMITS.maxIdentityOccurrences) {
      throw new EventActionProjectionLimitError();
    }
    const targetId = readNonEmptyString(node, "id");
    const capabilityId = readNonEmptyString(node, "use");
    const contractValue = optionalOwnDataValue(components, capabilityId);
    if (contractValue === undefined) throw new EventActionProjectionRejectedError();
    const contract = ownDataObject(contractValue);
    const authoring = optionalObject(contract, "authoring");
    const displayNameValue =
      authoring === undefined ? undefined : optionalOwnDataValue(authoring, "displayName");
    const targetLabel =
      typeof displayNameValue === "string" ? `${displayNameValue} (${targetId})` : targetId;
    const commands = optionalObject(contract, "commands");
    if (commands !== undefined) {
      for (const command of Object.keys(commands).sort(compareText)) {
        result.push(
          Object.freeze({
            targetId,
            targetLabel,
            command,
            label: `${targetLabel} — ${command}`,
          }),
        );
      }
    }
    const children = childNodes(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index] as JsonObject);
    }
    for (const behavior of optionalObjectArray(node, "behaviors")) {
      const behaviorChildren = childNodes(behavior);
      for (let index = behaviorChildren.length - 1; index >= 0; index -= 1) {
        pending.push(behaviorChildren[index] as JsonObject);
      }
    }
  }
  result.sort((left, right) => {
    const targetOrder = compareText(left.targetId, right.targetId);
    return targetOrder === 0 ? compareText(left.command, right.command) : targetOrder;
  });
  return Object.freeze(result);
}

function referenceOptions(
  catalog: JsonObject,
  document: DesenEditorDocument,
  surface: JsonObject,
): AuthoringEventActionReferenceOptions {
  const state = ownDataObject(ownDataValue(surface, "state"));
  const resources = ownDataObject(ownDataValue(surface, "resources"));
  const surfaces = ownDataObject(ownDataValue(ownDataObject(document), "surfaces"));
  const operations = ownDataObject(ownDataValue(catalog, "operations"));
  return Object.freeze({
    states: genericOptions(Object.keys(state)),
    surfaces: genericOptions(Object.keys(surfaces)),
    operations: genericOptions(Object.keys(operations)),
    resources: genericOptions(Object.keys(resources)),
    componentCommands: componentCommandOptions(catalog, surface),
  });
}

function locateList(
  events: readonly AuthoringEventHandlerModel[],
  pointer: string,
): Readonly<{ readonly list: AuthoringActionListModel; readonly root: boolean }> | undefined {
  const pending: { readonly list: AuthoringActionListModel; readonly root: boolean }[] = events.map(
    ({ actionList }) => ({ list: actionList, root: true }),
  );
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current.list.pointer === pointer) return current;
    for (const action of current.list.actions) {
      if (action.onFailure !== null) pending.push({ list: action.onFailure, root: false });
      if (action.onSuccess !== null) pending.push({ list: action.onSuccess, root: false });
    }
  }
  return undefined;
}

function locateAction(
  events: readonly AuthoringEventHandlerModel[],
  pointer: string,
): LocatedAction | undefined {
  const pending = events.map(({ actionList }) => actionList);
  while (pending.length > 0) {
    const list = pending.pop();
    if (list === undefined) continue;
    for (const action of list.actions) {
      if (action.pointer === pointer) return Object.freeze({ action, list });
      if (action.onFailure !== null) pending.push(action.onFailure);
      if (action.onSuccess !== null) pending.push(action.onSuccess);
    }
  }
  return undefined;
}

function coreFailureReason(
  result: Extract<CoreEventActionEditResult, { readonly ok: false }>,
): AuthoringEventActionEditFailureReason {
  const code = result.diagnostics[0].code;
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_LIMIT_EXCEEDED") return "projection-limit";
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_PATH_NOT_FOUND") return "path-invalid";
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_POSITION_INVALID") return "position-invalid";
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_TARGET_EXISTS") return "event-exists";
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_TARGET_NOT_FOUND") return "event-not-found";
  if (code === "run.desen.editor/EVENT_ACTION_EDIT_TARGET_AMBIGUOUS") return "owner-invalid";
  return "edit-rejected";
}

/**
 * Creates a frozen exact owner selection without retaining React, DOM, event, or callback values.
 */
export function createAuthoringEventOwnerSelection(
  input: Omit<AuthoringEventOwnerSelection, "kind">,
): AuthoringEventOwnerSelection {
  const fields = exactOwnData(input, [
    "capabilityId",
    "conditional",
    "displayName",
    "ownerId",
    "ownerKind",
    "projectId",
    "surfaceId",
  ]);
  if (fields === undefined)
    throw new TypeError("Authoring event owner selection must be exact data.");
  const selection = captureSelection({
    kind: "event-owner",
    projectId: fields.projectId as string,
    surfaceId: fields.surfaceId as string,
    ownerKind: fields.ownerKind as "component",
    ownerId: fields.ownerId as string,
    capabilityId: fields.capabilityId as string,
    displayName: fields.displayName as string,
    conditional: fields.conditional as boolean,
  });
  if (selection === undefined) throw new TypeError("Authoring event owner selection is invalid.");
  return selection;
}

/** Returns whether two runtime values are the same exact inert event-owner selection. */
export function isSameAuthoringEventOwnerSelection(
  left: AuthoringEventOwnerSelection | null,
  right: AuthoringEventOwnerSelection,
): boolean {
  if (left === null) return false;
  const capturedLeft = captureSelection(left);
  const capturedRight = captureSelection(right);
  return (
    capturedLeft !== undefined &&
    capturedRight !== undefined &&
    capturedLeft.projectId === capturedRight.projectId &&
    capturedLeft.surfaceId === capturedRight.surfaceId &&
    capturedLeft.ownerKind === capturedRight.ownerKind &&
    capturedLeft.ownerId === capturedRight.ownerId &&
    capturedLeft.capabilityId === capturedRight.capabilityId &&
    capturedLeft.displayName === capturedRight.displayName &&
    capturedLeft.conditional === capturedRight.conditional
  );
}

/**
 * Projects Catalog-declared events and recursively nested closed actions for one current owner.
 *
 * @remarks The projector distinguishes absent, present-empty, and present-nonempty handlers and
 * settlement arrays; emits only canonical escaped owner-relative pointers; scans exact enumerable
 * own data without invoking accessors; and fails closed beyond 64 settlement levels, 25,000 action
 * occurrences, or the matching bounded Source identity profile. A null selection is an honest idle
 * state. Route, selection, raw Source owner, projected layer metadata, owner kind, and Catalog
 * capability must all agree exactly before any model is returned.
 */
export function prepareAuthoringEventActionModel(
  model: CatalogAuthoringModel,
  route: AuthoringEventActionRoute,
  selection: AuthoringEventOwnerSelection | null,
): AuthoringEventActionModelResult {
  if (selection === null) return Object.freeze({ status: "idle" });
  try {
    const capturedRoute = captureRoute(route);
    if (capturedRoute === undefined) {
      return Object.freeze({ status: "rejected", reason: "route-invalid" });
    }
    const capturedSelection = captureSelection(selection);
    if (
      capturedSelection === undefined ||
      capturedSelection.projectId !== capturedRoute.projectId ||
      capturedSelection.surfaceId !== capturedRoute.surfaceId
    ) {
      return Object.freeze({ status: "rejected", reason: "selection-invalid" });
    }
    resolveLayerOwner(model, capturedSelection);
    const resolved = resolveRawOwner(model.validationDocument, capturedRoute, capturedSelection);
    const catalog = selectedCatalog(model);
    const contract = ownerContract(catalog, capturedSelection);
    return Object.freeze({
      status: "ready",
      route: capturedRoute,
      owner: capturedSelection,
      events: eventModels(resolved.owner, contract),
      referenceOptions: referenceOptions(catalog, model.validationDocument, resolved.surface),
    });
  } catch (error) {
    return Object.freeze({
      status: "rejected",
      reason:
        error instanceof EventActionProjectionLimitError
          ? "projection-limit"
          : error instanceof EventActionRouteRejectedError
            ? "route-invalid"
            : "selection-invalid",
    });
  }
}

/**
 * Applies one exact event/action edit through only the six public Editor Core commands.
 *
 * @remarks Every request re-admits the current Source and Catalog, reauthorizes its exact route,
 * owner, Catalog event, lifecycle, pointer, and index against a fresh bounded projection, then
 * continuously validates the complete candidate. Nested settlement insertion may materialize an
 * absent branch only at index zero; root event lifecycle remains exclusive to handler commands.
 * Reorder indices use Editor Core's post-removal final-index convention. Every failure is atomic
 * and preserves the caller's document.
 */
export function applyAuthoringEventActionEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringEventActionRoute,
  selection: AuthoringEventOwnerSelection,
  edit: AuthoringEventActionEdit,
): AuthoringEventActionEditResult {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  const capturedEdit = captureEdit(edit);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedEdit === undefined
  ) {
    return failure("edit-rejected");
  }

  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  const current = prepareAuthoringEventActionModel(
    prepared.model,
    capturedRoute,
    capturedSelection,
  );
  if (current.status !== "ready") {
    if (current.status === "idle") return failure("owner-invalid");
    return failure(current.reason === "projection-limit" ? "projection-limit" : "owner-invalid");
  }

  let changed: CoreEventActionEditResult;
  if (capturedEdit.kind === "insert-handler") {
    const handler = current.events.find(({ event }) => event === capturedEdit.event);
    if (handler === undefined) return failure("event-not-found");
    if (handler.actionList.present) return failure("event-exists");
    changed = insertDesenEditorEventHandler(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      event: capturedEdit.event,
      actions: capturedEdit.actions as unknown as Parameters<
        typeof insertDesenEditorEventHandler
      >[1]["actions"],
    });
  } else if (capturedEdit.kind === "delete-handler") {
    const handler = current.events.find(({ event }) => event === capturedEdit.event);
    if (handler === undefined || !handler.actionList.present) return failure("event-not-found");
    changed = deleteDesenEditorEventHandler(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      event: capturedEdit.event,
    });
  } else if (capturedEdit.kind === "insert-action") {
    const located = locateList(current.events, capturedEdit.actionListPointer);
    if (located === undefined || (located.root && !located.list.present))
      return failure("path-invalid");
    if (!located.list.present && capturedEdit.index !== 0) return failure("position-invalid");
    if (located.list.present && capturedEdit.index > located.list.actions.length) {
      return failure("position-invalid");
    }
    changed = insertDesenEditorAction(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      actionListPointer: capturedEdit.actionListPointer,
      index: capturedEdit.index,
      action: capturedEdit.action as unknown as Parameters<
        typeof insertDesenEditorAction
      >[1]["action"],
    });
  } else if (capturedEdit.kind === "replace-action") {
    if (locateAction(current.events, capturedEdit.actionPointer) === undefined) {
      return failure("path-invalid");
    }
    changed = replaceDesenEditorAction(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      actionPointer: capturedEdit.actionPointer,
      action: capturedEdit.action as unknown as Parameters<
        typeof replaceDesenEditorAction
      >[1]["action"],
    });
  } else if (capturedEdit.kind === "delete-action") {
    if (locateAction(current.events, capturedEdit.actionPointer) === undefined) {
      return failure("path-invalid");
    }
    changed = deleteDesenEditorAction(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      actionPointer: capturedEdit.actionPointer,
    });
  } else {
    const located = locateAction(current.events, capturedEdit.actionPointer);
    if (located === undefined) return failure("path-invalid");
    if (capturedEdit.index >= located.list.actions.length) return failure("position-invalid");
    changed = reorderDesenEditorAction(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      ownerId: capturedSelection.ownerId,
      actionPointer: capturedEdit.actionPointer,
      index: capturedEdit.index,
    });
  }

  if (!changed.ok) return failure(coreFailureReason(changed));
  const validator = createDesenEditorContinuousValidator(prepared.model.validationCatalogs);
  if (!validator.ok) return failure("catalog-invalid");
  const validationReport = validator.validator.validate(changed.document);
  if (!validationReport.valid) return failure("source-invalid", validationReport);
  return Object.freeze({
    ok: true,
    operation: capturedEdit.kind,
    document: changed.document,
  });
}
