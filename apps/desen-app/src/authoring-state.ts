import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorStateDeclaration,
  insertDesenEditorStateDeclaration,
  setDesenEditorStateInitial,
  setDesenEditorStateSchema,
} from "@desen/editor-core";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type {
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
  DesenEditorStateDeclaration,
} from "@desen/editor-core";
import type { CatalogAuthoringModel } from "./authoring-data.js";

type JsonObject = Readonly<Record<string, unknown>>;

const AUTHORING_STATE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/u;
const STATE_REFERENCE_PATTERN = /^state\.([A-Za-z][A-Za-z0-9_-]{0,127})(?:\.|$)/u;
const STATE_USAGE_SCAN_PROFILE = Object.freeze({
  maxDepth: 512,
  maxVisitedValues: 100_000,
});

/** Primitive JSON Schema preset supported by the first local-state authoring surface. */
export type AuthoringStateValueType = "boolean" | "integer" | "number" | "string";

/** Exact App route that may authorize a surface-local state projection or mutation. */
export interface AuthoringStateRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** One current surface-local declaration with a bounded conservative count of state usages. */
export interface AuthoringStateDeclarationModel {
  readonly name: string;
  /** Exact primitive preset, or `null` when the declaration owns a non-preset schema. */
  readonly type: AuthoringStateValueType | null;
  /** Exact immutable schema retained from the validator-admitted Source. */
  readonly schema: JsonObject;
  /** Exact immutable initial JSON value retained from the validator-admitted Source. */
  readonly initial: JsonValue;
  /** Number of reference-shaped reads and explicit state writes outside inert state declarations. */
  readonly usageCount: number;
}

/** Route-authenticated local-state projection ready for App-owned authoring chrome. */
export interface AuthoringStateReadyModel {
  readonly status: "ready";
  readonly route: AuthoringStateRoute;
  readonly declarations: readonly AuthoringStateDeclarationModel[];
}

/** Fail-closed outcome of preparing one bounded surface-local state projection. */
export type AuthoringStateModelResult =
  | AuthoringStateReadyModel
  | Readonly<{
      readonly status: "rejected";
      readonly reason: "projection-limit" | "route-invalid";
    }>;

/** Exact primitive state edit admitted by the M09-T08 App boundary. */
export type AuthoringStateEdit =
  | Readonly<{
      readonly kind: "insert";
      readonly name: string;
      readonly type: AuthoringStateValueType;
    }>
  | Readonly<{
      readonly kind: "update";
      readonly name: string;
      readonly type: AuthoringStateValueType;
      /** Complete JSON candidate, admitted only when it exactly matches the selected preset. */
      readonly initial: JsonValue;
    }>
  | Readonly<{ readonly kind: "delete"; readonly name: string }>;

/** Atomic local-state success over one fresh immutable direct Source. */
export interface AuthoringStateEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
}

/** Stable, UI-safe reason why a local-state request produced no Source document. */
export type AuthoringStateEditFailureReason =
  | "catalog-invalid"
  | "edit-rejected"
  | "preview-unavailable"
  | "projection-limit"
  | "source-invalid"
  | "state-exists"
  | "state-in-use"
  | "state-not-found";

/** Atomic local-state failure with no partial schema or initial-value document. */
export interface AuthoringStateEditFailure {
  readonly ok: false;
  readonly reason: AuthoringStateEditFailureReason;
  /** Complete rejected-candidate diagnostics when continuous validation reached that boundary. */
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete result of one App-owned primitive local-state edit. */
export type AuthoringStateEditResult = AuthoringStateEditFailure | AuthoringStateEditSuccess;

type CapturedAuthoringStateEdit =
  | Readonly<{
      readonly kind: "insert";
      readonly name: string;
      readonly type: AuthoringStateValueType;
    }>
  | Readonly<{
      readonly kind: "update";
      readonly name: string;
      readonly type: AuthoringStateValueType;
      readonly initial: string | number | boolean;
    }>
  | Readonly<{ readonly kind: "delete"; readonly name: string }>;

interface UsageScanWork {
  readonly depth: number;
  readonly value: unknown;
}

interface OwnerScanWork {
  readonly depth: number;
  readonly owner: JsonObject;
}

interface ActionScanWork {
  readonly action: JsonObject;
  readonly depth: number;
}

class StateProjectionLimitError extends Error {}
class StateProjectionRejectedError extends Error {}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function failure(
  reason: AuthoringStateEditFailureReason,
  validationReport?: DesenEditorContinuousValidationReport,
): AuthoringStateEditFailure {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStateValueType(value: unknown): value is AuthoringStateValueType {
  return value === "boolean" || value === "integer" || value === "number" || value === "string";
}

function initialMatchesType(
  type: AuthoringStateValueType,
  value: unknown,
): value is string | number | boolean {
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === "number" && Number.isFinite(value);
}

function captureRoute(route: AuthoringStateRoute): AuthoringStateRoute | undefined {
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

function captureEdit(edit: AuthoringStateEdit): CapturedAuthoringStateEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    if (kindDescriptor?.enumerable !== true || !("value" in kindDescriptor)) return undefined;

    if (kindDescriptor.value === "delete") {
      const fields = exactOwnData(edit, ["kind", "name"]);
      if (
        fields === undefined ||
        !isNonEmptyString(fields.name) ||
        !AUTHORING_STATE_IDENTIFIER_PATTERN.test(fields.name)
      ) {
        return undefined;
      }
      return Object.freeze({ kind: "delete", name: fields.name });
    }

    if (kindDescriptor.value === "insert") {
      const fields = exactOwnData(edit, ["kind", "name", "type"]);
      if (
        fields === undefined ||
        !isNonEmptyString(fields.name) ||
        !AUTHORING_STATE_IDENTIFIER_PATTERN.test(fields.name) ||
        !isStateValueType(fields.type)
      ) {
        return undefined;
      }
      return Object.freeze({ kind: "insert", name: fields.name, type: fields.type });
    }

    if (kindDescriptor.value !== "update") return undefined;
    const fields = exactOwnData(edit, ["initial", "kind", "name", "type"]);
    if (
      fields === undefined ||
      !isNonEmptyString(fields.name) ||
      !AUTHORING_STATE_IDENTIFIER_PATTERN.test(fields.name) ||
      !isStateValueType(fields.type) ||
      !initialMatchesType(fields.type, fields.initial)
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "update",
      name: fields.name,
      type: fields.type,
      initial: fields.initial,
    });
  } catch {
    return undefined;
  }
}

function ownDataObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StateProjectionRejectedError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new StateProjectionRejectedError();
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new StateProjectionRejectedError();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new StateProjectionRejectedError();
    }
  }
  return value as JsonObject;
}

function ownDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor?.enumerable !== true || !("value" in descriptor)) {
    throw new StateProjectionRejectedError();
  }
  return descriptor.value;
}

function optionalOwnDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return undefined;
  if (descriptor.enumerable !== true || !("value" in descriptor)) {
    throw new StateProjectionRejectedError();
  }
  return descriptor.value;
}

function presetType(schema: JsonObject): AuthoringStateValueType | null {
  const keys = Reflect.ownKeys(schema);
  if (keys.length !== 1 || keys[0] !== "type") return null;
  const type = ownDataValue(schema, "type");
  return isStateValueType(type) ? type : null;
}

function stateReferenceName(reference: string): string | undefined {
  return STATE_REFERENCE_PATTERN.exec(reference)?.[1];
}

function stateWriteName(path: string): string {
  return path.split(".", 1)[0] ?? path;
}

function incrementUsage(usages: Map<string, number>, name: string | undefined): void {
  if (name === undefined || !usages.has(name)) return;
  usages.set(name, (usages.get(name) ?? 0) + 1);
}

function accountWork(visited: { value: number }, depth: number): void {
  visited.value += 1;
  if (
    visited.value > STATE_USAGE_SCAN_PROFILE.maxVisitedValues ||
    depth > STATE_USAGE_SCAN_PROFILE.maxDepth
  ) {
    throw new StateProjectionLimitError();
  }
}

function reserveScheduledWork(
  visited: { value: number },
  pendingCount: number,
  additionalCount: number,
): void {
  if (
    additionalCount < 0 ||
    visited.value + pendingCount + additionalCount > STATE_USAGE_SCAN_PROFILE.maxVisitedValues
  ) {
    throw new StateProjectionLimitError();
  }
}

function exactDataArrayLength(value: readonly unknown[]): number {
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0
  ) {
    throw new StateProjectionRejectedError();
  }
  return lengthDescriptor.value as number;
}

function scanReferences(
  roots: readonly unknown[],
  usages: Map<string, number>,
  visited: { value: number },
): void {
  const pending: UsageScanWork[] = roots.map((value) => ({ depth: 0, value }));
  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    accountWork(visited, work.depth);
    if (typeof work.value !== "object" || work.value === null) continue;

    if (Array.isArray(work.value)) {
      const length = exactDataArrayLength(work.value);
      reserveScheduledWork(visited, pending.length, length);
      const keys = Reflect.ownKeys(work.value);
      if (
        keys.length !== length + 1 ||
        keys.some(
          (key) =>
            typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
        )
      ) {
        throw new StateProjectionRejectedError();
      }
      for (let index = length - 1; index >= 0; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(work.value, String(index));
        if (descriptor?.enumerable !== true || !("value" in descriptor)) {
          throw new StateProjectionRejectedError();
        }
        pending.push({ depth: work.depth + 1, value: descriptor.value });
      }
      continue;
    }

    const object = ownDataObject(work.value);
    const reference = optionalOwnDataValue(object, "$ref");
    if (typeof reference === "string") incrementUsage(usages, stateReferenceName(reference));

    const keys = Reflect.ownKeys(object) as string[];
    reserveScheduledWork(visited, pending.length, keys.length);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      pending.push({ depth: work.depth + 1, value: ownDataValue(object, key) });
    }
  }
}

function dataObjectArray(value: unknown): readonly JsonObject[] {
  if (!Array.isArray(value)) throw new StateProjectionRejectedError();
  const length = exactDataArrayLength(value);
  if (length > STATE_USAGE_SCAN_PROFILE.maxVisitedValues) {
    throw new StateProjectionLimitError();
  }
  const result: JsonObject[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new StateProjectionRejectedError();
    }
    result.push(ownDataObject(descriptor.value));
  }
  return result;
}

function scheduleActionLists(action: JsonObject, depth: number, pending: ActionScanWork[]): void {
  const type = optionalOwnDataValue(action, "type");
  if (type !== "operation.invoke") return;
  for (const key of ["onFailure", "onSuccess"] as const) {
    const actions = optionalOwnDataValue(action, key);
    if (actions === undefined) continue;
    for (const nested of dataObjectArray(actions)) pending.push({ action: nested, depth });
  }
}

function countActionWrites(
  root: JsonObject,
  usages: Map<string, number>,
  visited: { value: number },
): void {
  const owners: OwnerScanWork[] = [{ depth: 0, owner: root }];
  const actions: ActionScanWork[] = [];

  while (owners.length > 0) {
    const work = owners.pop();
    if (work === undefined) continue;
    accountWork(visited, work.depth);

    const handlersValue = optionalOwnDataValue(work.owner, "on");
    if (handlersValue !== undefined) {
      const handlers = ownDataObject(handlersValue);
      for (const eventName of Object.keys(handlers)) {
        for (const action of dataObjectArray(ownDataValue(handlers, eventName))) {
          actions.push({ action, depth: work.depth + 1 });
        }
      }
    }

    const behaviorsValue = optionalOwnDataValue(work.owner, "behaviors");
    if (behaviorsValue !== undefined) {
      for (const behavior of dataObjectArray(behaviorsValue)) {
        owners.push({ depth: work.depth + 1, owner: behavior });
      }
    }

    const slotsValue = optionalOwnDataValue(work.owner, "slots");
    if (slotsValue !== undefined) {
      const slots = ownDataObject(slotsValue);
      for (const slotName of Object.keys(slots)) {
        for (const child of dataObjectArray(ownDataValue(slots, slotName))) {
          owners.push({ depth: work.depth + 1, owner: child });
        }
      }
    }
  }

  while (actions.length > 0) {
    const work = actions.pop();
    if (work === undefined) continue;
    accountWork(visited, work.depth);
    const type = optionalOwnDataValue(work.action, "type");
    const path = optionalOwnDataValue(work.action, "path");
    if ((type === "state.set" || type === "state.toggle") && typeof path === "string") {
      incrementUsage(usages, stateWriteName(path));
    }
    scheduleActionLists(work.action, work.depth + 1, actions);
  }
}

function usageCounts(
  surface: JsonObject,
  stateNames: readonly string[],
): ReadonlyMap<string, number> {
  const usages = new Map(stateNames.map((name) => [name, 0]));
  const root = ownDataObject(ownDataValue(surface, "root"));
  const resources = ownDataObject(ownDataValue(surface, "resources"));
  const roots: unknown[] = [root];
  for (const resourceName of Object.keys(resources)) {
    const resource = ownDataObject(ownDataValue(resources, resourceName));
    roots.push(ownDataValue(resource, "input"));
  }
  const visited = { value: 0 };
  scanReferences(roots, usages, visited);
  countActionWrites(root, usages, visited);
  return usages;
}

function declarationModels(surface: JsonObject): readonly AuthoringStateDeclarationModel[] {
  const state = ownDataObject(ownDataValue(surface, "state"));
  const stateNames = Object.keys(state).sort(compareText);
  const usages = usageCounts(surface, stateNames);
  return Object.freeze(
    stateNames.map((name) => {
      const declaration = ownDataObject(ownDataValue(state, name));
      const schema = ownDataObject(ownDataValue(declaration, "schema"));
      const initial = ownDataValue(declaration, "initial") as JsonValue;
      return Object.freeze({
        name,
        type: presetType(schema),
        schema,
        initial,
        usageCount: usages.get(name) ?? 0,
      });
    }),
  );
}

function presetSchema(type: AuthoringStateValueType): DesenEditorStateDeclaration["schema"] {
  return Object.freeze({ type });
}

function presetInitial(type: AuthoringStateValueType): string | number | boolean {
  if (type === "string") return "";
  if (type === "boolean") return false;
  return 0;
}

function presetDeclaration(type: AuthoringStateValueType): DesenEditorStateDeclaration {
  return Object.freeze({
    schema: presetSchema(type),
    initial: presetInitial(type),
  }) as DesenEditorStateDeclaration;
}

/**
 * Projects the exact local-state map for one current App route through a bounded data-only scan.
 *
 * @remarks Existing protocol-valid declarations with richer schemas remain visible with a `null`
 * preset type. Usage counts include surface-local state writes and conservatively count
 * reference-shaped data everywhere outside the declaration map, so extension data cannot hide a
 * possible use. Inert state initial values remain excluded and no accessor is invoked. Unknown
 * routes, malformed runtime values, and finite scan-profile overflow fail closed without returning
 * a partial declaration list.
 */
export function prepareAuthoringStateModel(
  model: CatalogAuthoringModel,
  route: AuthoringStateRoute,
): AuthoringStateModelResult {
  try {
    const capturedRoute = captureRoute(route);
    if (capturedRoute === undefined) {
      return Object.freeze({ status: "rejected", reason: "route-invalid" });
    }
    if (!model.surfaces.some(({ id }) => id === capturedRoute.surfaceId)) {
      return Object.freeze({ status: "rejected", reason: "route-invalid" });
    }
    const surfaces = ownDataObject(model.validationDocument.surfaces);
    const surfaceValue = optionalOwnDataValue(surfaces, capturedRoute.surfaceId);
    if (surfaceValue === undefined) {
      return Object.freeze({ status: "rejected", reason: "route-invalid" });
    }
    return Object.freeze({
      status: "ready",
      route: capturedRoute,
      declarations: declarationModels(ownDataObject(surfaceValue)),
    });
  } catch (error) {
    return Object.freeze({
      status: "rejected",
      reason: error instanceof StateProjectionLimitError ? "projection-limit" : "route-invalid",
    });
  }
}

/**
 * Applies one exact primitive local-state edit through public Editor Core commands.
 *
 * @remarks The current Source and Catalog are re-admitted before every edit. Schema and initial
 * replacement commands are staged on a private candidate and only their complete endpoint is
 * continuously validated, allowing an atomic primitive-type transition without exposing the
 * incompatible intermediate declaration. Deletion is limited to a state with zero bounded data
 * usages and never cascades into references or actions. Every rejection preserves the caller's
 * document.
 */
export function applyAuthoringStateEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringStateRoute,
  edit: AuthoringStateEdit,
): AuthoringStateEditResult {
  const capturedRoute = captureRoute(route);
  const capturedEdit = captureEdit(edit);
  if (capturedRoute === undefined || capturedEdit === undefined) return failure("edit-rejected");

  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  const stateModel = prepareAuthoringStateModel(prepared.model, capturedRoute);
  if (stateModel.status !== "ready") {
    return failure(stateModel.reason === "projection-limit" ? "projection-limit" : "edit-rejected");
  }

  const existing = stateModel.declarations.find(({ name }) => name === capturedEdit.name);
  let candidate = prepared.model.validationDocument;

  if (capturedEdit.kind === "insert") {
    if (existing !== undefined) return failure("state-exists");
    const changed = insertDesenEditorStateDeclaration(candidate, {
      surfaceId: capturedRoute.surfaceId,
      name: capturedEdit.name,
      declaration: presetDeclaration(capturedEdit.type),
    });
    if (!changed.ok) return failure("edit-rejected");
    candidate = changed.document;
  } else if (capturedEdit.kind === "update") {
    if (existing === undefined) return failure("state-not-found");
    if (existing.type === null) return failure("edit-rejected");
    const schemaChanged = setDesenEditorStateSchema(candidate, {
      surfaceId: capturedRoute.surfaceId,
      name: capturedEdit.name,
      schema: presetSchema(capturedEdit.type),
    });
    if (!schemaChanged.ok) return failure("edit-rejected");
    const initialChanged = setDesenEditorStateInitial(schemaChanged.document, {
      surfaceId: capturedRoute.surfaceId,
      name: capturedEdit.name,
      initial: capturedEdit.initial,
    });
    if (!initialChanged.ok) return failure("edit-rejected");
    candidate = initialChanged.document;
  } else {
    if (existing === undefined) return failure("state-not-found");
    if (existing.usageCount !== 0) return failure("state-in-use");
    const changed = deleteDesenEditorStateDeclaration(candidate, {
      surfaceId: capturedRoute.surfaceId,
      name: capturedEdit.name,
    });
    if (!changed.ok) return failure("edit-rejected");
    candidate = changed.document;
  }

  const validator = createDesenEditorContinuousValidator(prepared.model.validationCatalogs);
  if (!validator.ok) return failure("catalog-invalid");
  const validationReport = validator.validator.validate(candidate);
  if (!validationReport.valid) return failure("source-invalid", validationReport);
  return Object.freeze({ ok: true, document: candidate });
}
