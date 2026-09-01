import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorAction,
  insertDesenEditorAction,
  insertDesenEditorEventHandler,
  replaceDesenEditorAction,
  setDesenEditorOwnerProp,
} from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import {
  isAuthoringInspectorStateCompatible,
  prepareAuthoringInspectorModel,
} from "./authoring-inspector.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type {
  DesenEditorAction,
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
} from "@desen/editor-core";
import type { CatalogAuthoringModel } from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type JsonObject = Readonly<Record<string, unknown>>;

const STATE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/u;
const RUNTIME_REFERENCE_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u;
const CAPABILITY_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9.-]*(\.[A-Za-z0-9][A-Za-z0-9.-]*)*\/[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const MAX_INPUT_BINDINGS = 256;
const MAX_INPUT_NAME_CODE_UNITS = 256;

/** Exact App route that may authorize an atomic connection recipe. */
export interface AuthoringConnectionRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** One-click controlled-input recipe using a surface-local state declaration. */
export interface AuthoringInputConnectionRecipe {
  readonly stateName: string;
}

/** One operation input member mapped to a surface-local state declaration. */
export interface AuthoringOperationInputConnection {
  readonly inputName: string;
  readonly stateName: string;
}

/** One-click press → operation recipe with an optional lifecycle-backed loading prop. */
export interface AuthoringOperationTriggerConnectionRecipe {
  readonly alias: string;
  readonly connectLoading: boolean;
  readonly inputs: readonly AuthoringOperationInputConnection[];
  readonly operationId: string;
}

/** Atomic connection success containing only the completely validated Source endpoint. */
export interface AuthoringConnectionSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly operation: "connect-input" | "connect-operation-trigger";
}

/** Stable reason why a recipe produced no Source endpoint. */
export type AuthoringConnectionFailureReason =
  | "catalog-invalid"
  | "connection-conflict"
  | "connection-incompatible"
  | "edit-rejected"
  | "operation-unavailable"
  | "recipe-invalid"
  | "selection-invalid"
  | "source-invalid"
  | "state-unavailable";

/** Atomic recipe rejection. No staged intermediate document is exposed. */
export interface AuthoringConnectionFailure {
  readonly ok: false;
  readonly reason: AuthoringConnectionFailureReason;
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete outcome of one App-owned connection recipe. */
export type AuthoringConnectionResult = AuthoringConnectionFailure | AuthoringConnectionSuccess;

interface PreparedConnectionAuthority {
  readonly document: DesenEditorDocument;
  readonly model: CatalogAuthoringModel;
  readonly route: AuthoringConnectionRoute;
  readonly selection: AuthoringComponentSelection;
  readonly target: EditorNode;
}

function failure(
  reason: AuthoringConnectionFailureReason,
  validationReport?: DesenEditorContinuousValidationReport,
): AuthoringConnectionFailure {
  return Object.freeze({
    ok: false,
    reason,
    ...(validationReport === undefined ? {} : { validationReport }),
  });
}

function exactOwnData(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
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

function exactOwnArray(value: unknown, maximumLength: number): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximumLength
    ) {
      return undefined;
    }
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length)),
      )
    ) {
      return undefined;
    }
    const captured: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
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

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function captureRoute(route: AuthoringConnectionRoute): AuthoringConnectionRoute | undefined {
  const fields = exactOwnData(route, ["projectId", "surfaceId"]);
  return fields !== undefined && nonEmptyText(fields.projectId) && nonEmptyText(fields.surfaceId)
    ? Object.freeze({ projectId: fields.projectId, surfaceId: fields.surfaceId })
    : undefined;
}

function captureSelection(
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
  const fields = exactOwnData(selection, [
    "kind",
    "projectId",
    "surfaceId",
    "sourceNodeId",
    "capabilityId",
    "displayName",
    "conditional",
  ]);
  if (
    fields === undefined ||
    fields.kind !== "component" ||
    !nonEmptyText(fields.projectId) ||
    !nonEmptyText(fields.surfaceId) ||
    !nonEmptyText(fields.sourceNodeId) ||
    !nonEmptyText(fields.capabilityId) ||
    !nonEmptyText(fields.displayName) ||
    typeof fields.conditional !== "boolean"
  ) {
    return undefined;
  }
  return Object.freeze({
    kind: "component",
    projectId: fields.projectId,
    surfaceId: fields.surfaceId,
    sourceNodeId: fields.sourceNodeId,
    capabilityId: fields.capabilityId,
    displayName: fields.displayName,
    conditional: fields.conditional,
  });
}

function captureInputRecipe(
  recipe: AuthoringInputConnectionRecipe,
): AuthoringInputConnectionRecipe | undefined {
  const fields = exactOwnData(recipe, ["stateName"]);
  return fields !== undefined &&
    typeof fields.stateName === "string" &&
    STATE_NAME_PATTERN.test(fields.stateName)
    ? Object.freeze({ stateName: fields.stateName })
    : undefined;
}

function captureOperationRecipe(
  recipe: AuthoringOperationTriggerConnectionRecipe,
): AuthoringOperationTriggerConnectionRecipe | undefined {
  const fields = exactOwnData(recipe, ["alias", "connectLoading", "inputs", "operationId"]);
  const capturedInputs = exactOwnArray(fields?.inputs, MAX_INPUT_BINDINGS);
  if (
    fields === undefined ||
    typeof fields.alias !== "string" ||
    !RUNTIME_REFERENCE_SEGMENT_PATTERN.test(fields.alias) ||
    typeof fields.operationId !== "string" ||
    !CAPABILITY_ID_PATTERN.test(fields.operationId) ||
    typeof fields.connectLoading !== "boolean" ||
    capturedInputs === undefined
  ) {
    return undefined;
  }
  const inputs: AuthoringOperationInputConnection[] = [];
  const inputNames = new Set<string>();
  for (const input of capturedInputs) {
    const mapping = exactOwnData(input, ["inputName", "stateName"]);
    if (
      mapping === undefined ||
      typeof mapping.inputName !== "string" ||
      mapping.inputName.length === 0 ||
      mapping.inputName.length > MAX_INPUT_NAME_CODE_UNITS ||
      inputNames.has(mapping.inputName) ||
      typeof mapping.stateName !== "string" ||
      !STATE_NAME_PATTERN.test(mapping.stateName)
    ) {
      return undefined;
    }
    inputNames.add(mapping.inputName);
    inputs.push(Object.freeze({ inputName: mapping.inputName, stateName: mapping.stateName }));
  }
  return Object.freeze({
    alias: fields.alias,
    connectLoading: fields.connectLoading,
    inputs: Object.freeze(inputs),
    operationId: fields.operationId,
  });
}

function scheduleChildren(pending: EditorNode[], node: EditorNode): void {
  for (const children of Object.values(node.slots ?? {})) pending.push(...children);
  for (const behavior of node.behaviors ?? []) {
    for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
  }
}

function selectedNode(
  document: DesenEditorDocument,
  surfaceId: string,
  sourceNodeId: string,
): EditorNode | undefined {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return undefined;
  const pending = [surface.root];
  let match: EditorNode | undefined;
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === sourceNodeId) {
      if (match !== undefined) return undefined;
      match = node;
    }
    scheduleChildren(pending, node);
  }
  return match;
}

function prepareAuthority(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringConnectionRoute,
  selection: AuthoringComponentSelection,
): AuthoringConnectionFailure | PreparedConnectionAuthority {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  if (capturedRoute === undefined || capturedSelection === undefined) {
    return failure("selection-invalid");
  }
  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  if (
    projectAuthoringSelection(capturedSelection, capturedRoute, prepared.model, undefined)
      .status !== "unavailable"
  ) {
    return failure("selection-invalid");
  }
  const target = selectedNode(
    prepared.model.validationDocument,
    capturedRoute.surfaceId,
    capturedSelection.sourceNodeId,
  );
  if (target === undefined) return failure("selection-invalid");
  return Object.freeze({
    document: prepared.model.validationDocument,
    model: prepared.model,
    route: capturedRoute,
    selection: capturedSelection,
    target,
  });
}

function completeValidation(
  authority: PreparedConnectionAuthority,
  candidate: DesenEditorDocument,
  operation: AuthoringConnectionSuccess["operation"],
): AuthoringConnectionResult {
  const validator = createDesenEditorContinuousValidator(authority.model.validationCatalogs);
  if (!validator.ok) return failure("catalog-invalid");
  const report = validator.validator.validate(candidate);
  return report.valid
    ? Object.freeze({ ok: true, document: candidate, operation })
    : failure("source-invalid", report);
}

function surfaceHasState(authority: PreparedConnectionAuthority, stateName: string): boolean {
  const state = authority.document.surfaces[authority.route.surfaceId]?.state;
  return state !== undefined && Object.hasOwn(state, stateName);
}

function inputStateIsCompatible(
  authority: PreparedConnectionAuthority,
  stateName: string,
): boolean {
  const inspector = prepareAuthoringInspectorModel(
    authority.model,
    authority.route,
    authority.selection,
  );
  if (inspector.status !== "ready") return false;
  const valueField = inspector.fields.find(({ control }) => control.valuePointer === "/value");
  const state = inspector.localStates.find(({ name }) => name === stateName);
  return (
    valueField !== undefined &&
    state !== undefined &&
    isAuthoringInspectorStateCompatible(valueField, state) &&
    changeEventValueIsCompatible(authority, state.type)
  );
}

function exactAction(left: DesenEditorAction, right: DesenEditorAction): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}

function directStateReference(value: unknown): string | undefined {
  const captured = exactOwnData(value, ["$ref"]);
  const reference = captured?.$ref;
  return typeof reference === "string" && reference.startsWith("state.")
    ? reference.slice("state.".length)
    : undefined;
}

function canonicalInputWrite(stateName: string): DesenEditorAction {
  return Object.freeze({
    type: "state.set",
    path: stateName,
    value: Object.freeze({ $ref: "event.value" }),
  }) as DesenEditorAction;
}

function addActionPreservingHandler(
  document: DesenEditorDocument,
  authority: PreparedConnectionAuthority,
  event: string,
  action: DesenEditorAction,
  existingActions: readonly DesenEditorAction[] | undefined,
): DesenEditorDocument | undefined {
  const result =
    existingActions === undefined
      ? insertDesenEditorEventHandler(document, {
          surfaceId: authority.route.surfaceId,
          ownerId: authority.selection.sourceNodeId,
          event,
          actions: Object.freeze([action]),
        })
      : insertDesenEditorAction(document, {
          surfaceId: authority.route.surfaceId,
          ownerId: authority.selection.sourceNodeId,
          actionListPointer: `/on/${event}`,
          index: existingActions.length,
          action,
        });
  return result.ok ? result.document : undefined;
}

/**
 * Atomically connects a controlled component input to one compatible local state.
 *
 * @remarks The private candidate receives both `props.value = { $ref: "state.<name>" }` and a
 * `change` action that writes `{ $ref: "event.value" }`. Reconnecting replaces the single exact
 * write belonging to the previously bound state; every unrelated change action retains its exact
 * order. An existing exact write makes the recipe idempotent, while duplicate or conflicting writes
 * fail closed instead of guessing precedence. Only the fully continuously validated endpoint is
 * returned, so no half-bound or stale controlled input can escape this boundary.
 */
export function applyAuthoringInputConnection(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringConnectionRoute,
  selection: AuthoringComponentSelection,
  recipe: AuthoringInputConnectionRecipe,
): AuthoringConnectionResult {
  const capturedRecipe = captureInputRecipe(recipe);
  if (capturedRecipe === undefined) return failure("recipe-invalid");
  const prepared = prepareAuthority(document, catalogValue, route, selection);
  if ("ok" in prepared) return prepared;
  if (!surfaceHasState(prepared, capturedRecipe.stateName)) return failure("state-unavailable");
  if (!inputStateIsCompatible(prepared, capturedRecipe.stateName)) {
    return failure("connection-incompatible");
  }

  const action = canonicalInputWrite(capturedRecipe.stateName);
  const existingActions = prepared.target.on?.change;
  const related = (existingActions ?? []).filter(
    (candidate) => candidate.type === "state.set" && candidate.path === capturedRecipe.stateName,
  );
  if (
    related.length > 1 ||
    (related.length === 1 && !exactAction(related[0] as DesenEditorAction, action))
  ) {
    return failure("connection-conflict");
  }

  const previousStateName = directStateReference(prepared.target.props?.value);
  const previousCanonicalIndexes =
    previousStateName === undefined || previousStateName === capturedRecipe.stateName
      ? []
      : (existingActions ?? []).flatMap((candidate, index) =>
          exactAction(candidate, canonicalInputWrite(previousStateName)) ? [index] : [],
        );
  if (previousCanonicalIndexes.length > 1) return failure("connection-conflict");

  const bound = setDesenEditorOwnerProp(prepared.document, {
    surfaceId: prepared.route.surfaceId,
    ownerId: prepared.selection.sourceNodeId,
    name: "value",
    value: Object.freeze({ $ref: `state.${capturedRecipe.stateName}` }),
  });
  if (!bound.ok) return failure("edit-rejected");
  let candidate = bound.document;
  const previousCanonicalIndex = previousCanonicalIndexes[0];
  if (previousCanonicalIndex !== undefined && related.length === 0) {
    const replaced = replaceDesenEditorAction(candidate, {
      surfaceId: prepared.route.surfaceId,
      ownerId: prepared.selection.sourceNodeId,
      actionPointer: `/on/change/${previousCanonicalIndex}`,
      action,
    });
    if (!replaced.ok) return failure("edit-rejected");
    candidate = replaced.document;
  } else if (previousCanonicalIndex !== undefined) {
    const deleted = deleteDesenEditorAction(candidate, {
      surfaceId: prepared.route.surfaceId,
      ownerId: prepared.selection.sourceNodeId,
      actionPointer: `/on/change/${previousCanonicalIndex}`,
    });
    if (!deleted.ok) return failure("edit-rejected");
    candidate = deleted.document;
  } else if (related.length === 0) {
    const connected = addActionPreservingHandler(
      candidate,
      prepared,
      "change",
      action,
      existingActions,
    );
    if (connected === undefined) return failure("edit-rejected");
    candidate = connected;
  }
  return completeValidation(prepared, candidate, "connect-input");
}

function firstCatalog(authority: PreparedConnectionAuthority): JsonObject | undefined {
  const value = authority.model.validationCatalogs[0];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

type SchemaValueKind = "boolean" | "integer" | "number" | "string" | "structured";

function schemaValueKind(schema: JsonObject): SchemaValueKind {
  const type = schema.type;
  return type === "boolean" || type === "integer" || type === "number" || type === "string"
    ? type
    : "structured";
}

function schemaKindsAreCompatible(input: SchemaValueKind, state: SchemaValueKind): boolean {
  return input === state || (input === "number" && state === "integer");
}

function schemasAreCompatible(inputSchema: JsonObject, stateSchema: JsonObject): boolean {
  const inputKind = schemaValueKind(inputSchema);
  const stateKind = schemaValueKind(stateSchema);
  if (inputKind === "structured" || stateKind === "structured") {
    return (
      inputKind === "structured" &&
      stateKind === "structured" &&
      canonicalizeJson(inputSchema) === canonicalizeJson(stateSchema)
    );
  }
  return schemaKindsAreCompatible(inputKind, stateKind);
}

function selectedComponentContract(authority: PreparedConnectionAuthority): JsonObject | undefined {
  const components = jsonObject(firstCatalog(authority)?.components);
  return jsonObject(components?.[authority.selection.capabilityId]);
}

function selectedComponentEvent(
  authority: PreparedConnectionAuthority,
  eventName: string,
): JsonObject | undefined {
  const events = jsonObject(selectedComponentContract(authority)?.events);
  return jsonObject(events?.[eventName]);
}

function changeEventValueIsCompatible(
  authority: PreparedConnectionAuthority,
  stateKind: SchemaValueKind,
): boolean {
  try {
    const payloadSchema = jsonObject(selectedComponentEvent(authority, "change")?.payloadSchema);
    const properties = jsonObject(payloadSchema?.properties);
    const valueSchema = jsonObject(properties?.value);
    const required = payloadSchema?.required;
    return (
      payloadSchema?.type === "object" &&
      Array.isArray(required) &&
      required.includes("value") &&
      valueSchema !== undefined &&
      schemaKindsAreCompatible(stateKind, schemaValueKind(valueSchema))
    );
  } catch {
    return false;
  }
}

function operationInputsAreCompatible(
  authority: PreparedConnectionAuthority,
  recipe: AuthoringOperationTriggerConnectionRecipe,
): boolean {
  try {
    const operations = jsonObject(firstCatalog(authority)?.operations);
    const operation = jsonObject(operations?.[recipe.operationId]);
    const inputSchema = jsonObject(operation?.inputSchema);
    if (inputSchema === undefined || inputSchema.type !== "object") return false;
    const propertiesValue = inputSchema.properties;
    const properties: JsonObject | undefined =
      propertiesValue === undefined
        ? (Object.freeze({}) as JsonObject)
        : jsonObject(propertiesValue);
    if (properties === undefined) return false;
    const requiredValue = inputSchema.required;
    const required = requiredValue === undefined ? [] : requiredValue;
    if (!Array.isArray(required) || !required.every((name) => typeof name === "string")) {
      return false;
    }
    const mappings = new Map(recipe.inputs.map((mapping) => [mapping.inputName, mapping]));
    if (required.some((inputName) => !mappings.has(inputName))) return false;

    const states = authority.document.surfaces[authority.route.surfaceId]?.state;
    if (states === undefined) return false;
    for (const mapping of recipe.inputs) {
      const inputFieldSchema = jsonObject(properties[mapping.inputName]);
      const stateSchema = jsonObject(states[mapping.stateName]?.schema);
      if (
        inputFieldSchema === undefined ||
        stateSchema === undefined ||
        !schemasAreCompatible(inputFieldSchema, stateSchema)
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function catalogHasOperation(authority: PreparedConnectionAuthority, operationId: string): boolean {
  const operations = firstCatalog(authority)?.operations;
  return (
    typeof operations === "object" &&
    operations !== null &&
    !Array.isArray(operations) &&
    Object.hasOwn(operations, operationId)
  );
}

/**
 * Atomically connects a component press event to one declared operation.
 *
 * @remarks Explicit input mappings become state references without executing or inspecting state
 * values. Unrelated press actions retain their exact order. When requested, `loading` is connected
 * to `operation.<alias>.pending` with a literal `false` fallback in the same private candidate.
 * Alias/operation conflicts fail closed and only the fully validated endpoint is returned.
 */
export function applyAuthoringOperationTriggerConnection(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringConnectionRoute,
  selection: AuthoringComponentSelection,
  recipe: AuthoringOperationTriggerConnectionRecipe,
): AuthoringConnectionResult {
  const capturedRecipe = captureOperationRecipe(recipe);
  if (capturedRecipe === undefined) return failure("recipe-invalid");
  const prepared = prepareAuthority(document, catalogValue, route, selection);
  if ("ok" in prepared) return prepared;
  if (!catalogHasOperation(prepared, capturedRecipe.operationId)) {
    return failure("operation-unavailable");
  }
  if (capturedRecipe.inputs.some(({ stateName }) => !surfaceHasState(prepared, stateName))) {
    return failure("state-unavailable");
  }
  if (
    selectedComponentEvent(prepared, "press") === undefined ||
    !operationInputsAreCompatible(prepared, capturedRecipe)
  ) {
    return failure("connection-incompatible");
  }

  const input: Record<string, Readonly<{ readonly $ref: string }>> = Object.create(null) as Record<
    string,
    Readonly<{ readonly $ref: string }>
  >;
  for (const mapping of capturedRecipe.inputs) {
    input[mapping.inputName] = Object.freeze({ $ref: `state.${mapping.stateName}` });
  }
  const action = Object.freeze({
    type: "operation.invoke",
    operation: capturedRecipe.operationId,
    as: capturedRecipe.alias,
    input: Object.freeze(input),
    concurrency: "replace",
  }) as DesenEditorAction;
  const existingActions = prepared.target.on?.press;
  const related = (existingActions ?? []).filter(
    (candidate) =>
      candidate.type === "operation.invoke" &&
      (candidate.operation === capturedRecipe.operationId || candidate.as === capturedRecipe.alias),
  );
  if (
    related.length > 1 ||
    (related.length === 1 && !exactAction(related[0] as DesenEditorAction, action))
  ) {
    return failure("connection-conflict");
  }

  let candidate = prepared.document;
  if (capturedRecipe.connectLoading) {
    const loading = setDesenEditorOwnerProp(candidate, {
      surfaceId: prepared.route.surfaceId,
      ownerId: prepared.selection.sourceNodeId,
      name: "loading",
      value: Object.freeze({
        $ref: `operation.${capturedRecipe.alias}.pending`,
        fallback: false,
      }),
    });
    if (!loading.ok) return failure("edit-rejected");
    candidate = loading.document;
  }
  if (related.length === 0) {
    const connected = addActionPreservingHandler(
      candidate,
      prepared,
      "press",
      action,
      existingActions,
    );
    if (connected === undefined) return failure("edit-rejected");
    candidate = connected;
  }
  return completeValidation(prepared, candidate, "connect-operation-trigger");
}
