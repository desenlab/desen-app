import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorOwnerProp,
  setDesenEditorOwnerProp,
} from "@desen/editor-core";
import { canonicalizeJson, canonicalizeJsonBytes, parseJsonPointer } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type { ComponentInspectorControl, JsonPrimitive, JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorContentValue, DesenEditorDocument } from "@desen/editor-core";
import type {
  AuthoringLayerNode,
  CatalogAuthoringModel,
  CatalogComponentSummary,
} from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

type JsonObject = Readonly<Record<string, unknown>>;

/** Exact App route that may authorize an inspector read or mutation. */
export interface AuthoringInspectorRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Honest state of one schema-derived property in the selected Source node. */
export type AuthoringInspectorValueState =
  | Readonly<{ readonly kind: "absent" }>
  | Readonly<{ readonly kind: "literal"; readonly value: JsonPrimitive }>
  | Readonly<{
      readonly kind: "dynamic";
      readonly reference: string | null;
      readonly value: JsonValue;
    }>
  | Readonly<{ readonly kind: "structured"; readonly value: JsonValue }>;

/** One directly addressable, primitive local-state declaration available to Inspector binding UI. */
export interface AuthoringInspectorStateOption {
  readonly enumValues: readonly JsonPrimitive[] | undefined;
  readonly initial: JsonPrimitive;
  readonly name: string;
  readonly reference: string;
  readonly type: "boolean" | "integer" | "number" | "string";
}

/** One inspector row joined from an authoritative schema descriptor and current Source value. */
export interface AuthoringInspectorField {
  readonly children: readonly AuthoringInspectorField[];
  /** Whether this exact value subtree contains protocol-dynamic authority. */
  readonly containsDynamicValue: boolean;
  readonly control: ComponentInspectorControl;
  readonly description: string | undefined;
  readonly label: string;
  readonly qualifiedLabel: string;
  readonly value: AuthoringInspectorValueState;
}

/** Inspector model for one exact, route-valid Source component selection. */
export interface AuthoringInspectorReadyModel {
  readonly component: CatalogComponentSummary;
  readonly controlCount: number;
  readonly fields: readonly AuthoringInspectorField[];
  readonly localStates: readonly AuthoringInspectorStateOption[];
  readonly node: AuthoringLayerNode;
  readonly selection: AuthoringComponentSelection;
  readonly status: "ready";
}

/** Fail-closed result of joining a selection, Source values, and Catalog-derived controls. */
export type AuthoringInspectorModelResult =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | AuthoringInspectorReadyModel;

/** Exact schema-derived prop mutation requested through the App-owned Inspector. */
export type AuthoringInspectorEdit =
  | Readonly<{ readonly kind: "delete"; readonly valuePointer: string }>
  | Readonly<{
      readonly kind: "set";
      readonly value: JsonValue;
      readonly valuePointer: string;
    }>;

/** Exact local-state binding transition requested through the App-owned Inspector. */
export type AuthoringInspectorBindingEdit =
  | Readonly<{ readonly kind: "bind"; readonly stateName: string; readonly valuePointer: string }>
  | Readonly<{ readonly kind: "use-initial"; readonly valuePointer: string }>;

/** Atomic Source mutation success returned by the App inspector boundary. */
export interface AuthoringInspectorEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
}

/** Stable, UI-safe reason why an inspector edit produced no Source document. */
export type AuthoringInspectorEditFailureReason =
  | "catalog-invalid"
  | "binding-incompatible"
  | "control-unavailable"
  | "edit-rejected"
  | "preview-unavailable"
  | "required-property"
  | "selection-invalid"
  | "source-invalid"
  | "value-invalid";

/** Atomic inspector failure with no partial document. */
export interface AuthoringInspectorEditFailure {
  readonly ok: false;
  readonly reason: AuthoringInspectorEditFailureReason;
}

/** Complete result of one schema-authorized Inspector edit. */
export type AuthoringInspectorEditResult =
  AuthoringInspectorEditFailure | AuthoringInspectorEditSuccess;

function comparePrimitive(left: JsonPrimitive, right: JsonPrimitive): boolean {
  return left === right;
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

type CapturedAuthoringInspectorEdit =
  | Readonly<{ readonly kind: "delete"; readonly valuePointer: string }>
  | Readonly<{ readonly kind: "set"; readonly value: JsonValue; readonly valuePointer: string }>;

type CapturedAuthoringInspectorBindingEdit =
  | Readonly<{ readonly kind: "bind"; readonly stateName: string; readonly valuePointer: string }>
  | Readonly<{ readonly kind: "use-initial"; readonly valuePointer: string }>;

const BINDABLE_STATE_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/u;

function captureExactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
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

function captureInspectorRoute(
  route: AuthoringInspectorRoute,
): AuthoringInspectorRoute | undefined {
  try {
    const fields = captureExactOwnData(route, ["projectId", "surfaceId"]);
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

function captureInspectorSelection(
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
  try {
    const fields = captureExactOwnData(selection, [
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
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.surfaceId) ||
      !isNonEmptyString(fields.sourceNodeId) ||
      !isNonEmptyString(fields.capabilityId) ||
      !isNonEmptyString(fields.displayName) ||
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
  } catch {
    return undefined;
  }
}

function deepFreezeJson(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
  } else {
    for (const key of Object.keys(value)) {
      deepFreezeJson((value as Readonly<Record<string, JsonValue>>)[key] as JsonValue);
    }
  }
  return Object.freeze(value);
}

function captureJsonValue(value: unknown): JsonValue | undefined {
  try {
    return deepFreezeJson(JSON.parse(canonicalizeJson(value)) as JsonValue);
  } catch {
    return undefined;
  }
}

function captureInspectorEdit(
  edit: AuthoringInspectorEdit,
): CapturedAuthoringInspectorEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const ownKeys = Reflect.ownKeys(edit);
    if (ownKeys.some((key) => typeof key !== "string")) return undefined;

    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    const pointerDescriptor = Object.getOwnPropertyDescriptor(edit, "valuePointer");
    if (
      kindDescriptor?.enumerable !== true ||
      !("value" in kindDescriptor) ||
      pointerDescriptor?.enumerable !== true ||
      !("value" in pointerDescriptor) ||
      typeof pointerDescriptor.value !== "string"
    ) {
      return undefined;
    }
    parseJsonPointer(pointerDescriptor.value);

    if (kindDescriptor.value === "delete") {
      if (ownKeys.length !== 2 || !ownKeys.includes("kind") || !ownKeys.includes("valuePointer")) {
        return undefined;
      }
      return Object.freeze({ kind: "delete", valuePointer: pointerDescriptor.value });
    }
    if (kindDescriptor.value !== "set") return undefined;
    if (
      ownKeys.length !== 3 ||
      !ownKeys.includes("kind") ||
      !ownKeys.includes("valuePointer") ||
      !ownKeys.includes("value")
    ) {
      return undefined;
    }
    const valueDescriptor = Object.getOwnPropertyDescriptor(edit, "value");
    if (valueDescriptor?.enumerable !== true || !("value" in valueDescriptor)) {
      return undefined;
    }
    const value = captureJsonValue(valueDescriptor.value);
    if (value === undefined) return undefined;
    return Object.freeze({
      kind: "set",
      value,
      valuePointer: pointerDescriptor.value,
    });
  } catch {
    return undefined;
  }
}

function captureInspectorBindingEdit(
  edit: AuthoringInspectorBindingEdit,
): CapturedAuthoringInspectorBindingEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    const pointerDescriptor = Object.getOwnPropertyDescriptor(edit, "valuePointer");
    if (
      kindDescriptor?.enumerable !== true ||
      !("value" in kindDescriptor) ||
      pointerDescriptor?.enumerable !== true ||
      !("value" in pointerDescriptor) ||
      typeof pointerDescriptor.value !== "string" ||
      pointerDescriptor.value.length === 0
    ) {
      return undefined;
    }
    parseJsonPointer(pointerDescriptor.value);
    const ownKeys = Reflect.ownKeys(edit);
    if (ownKeys.some((key) => typeof key !== "string")) return undefined;

    if (kindDescriptor.value === "use-initial") {
      if (ownKeys.length !== 2 || !ownKeys.includes("kind") || !ownKeys.includes("valuePointer")) {
        return undefined;
      }
      return Object.freeze({ kind: "use-initial", valuePointer: pointerDescriptor.value });
    }
    if (kindDescriptor.value !== "bind") return undefined;
    const stateDescriptor = Object.getOwnPropertyDescriptor(edit, "stateName");
    if (
      ownKeys.length !== 3 ||
      !ownKeys.includes("kind") ||
      !ownKeys.includes("stateName") ||
      !ownKeys.includes("valuePointer") ||
      stateDescriptor?.enumerable !== true ||
      !("value" in stateDescriptor) ||
      typeof stateDescriptor.value !== "string" ||
      !BINDABLE_STATE_NAME.test(stateDescriptor.value)
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "bind",
      stateName: stateDescriptor.value,
      valuePointer: pointerDescriptor.value,
    });
  } catch {
    return undefined;
  }
}

function humanizeProperty(property: string): string {
  const spaced = property
    .replaceAll(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replaceAll(/[._:-]+/gu, " ")
    .trim();
  return spaced.length === 0
    ? "Unnamed property"
    : `${spaced[0]?.toUpperCase() ?? ""}${spaced.slice(1)}`;
}

function readChildSchema(schema: JsonObject | undefined, property: string): JsonObject | undefined {
  const properties = schema?.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return undefined;
  }
  const childSchema = (properties as JsonObject)[property];
  return typeof childSchema === "object" && childSchema !== null && !Array.isArray(childSchema)
    ? (childSchema as JsonObject)
    : undefined;
}

function optionalSchemaText(schema: JsonObject | undefined, key: "description" | "title") {
  const value = schema?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalSchemaTitle(schema: JsonObject | undefined): string | undefined {
  const title = optionalSchemaText(schema, "title")?.trim();
  return title === undefined || title.length === 0 ? undefined : title;
}

interface DynamicValueScan {
  readonly found: boolean;
  readonly reference: string | null;
}

const NO_DYNAMIC_VALUE = Object.freeze({ found: false, reference: null });

function directDynamicValue(value: unknown): DynamicValueScan {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return NO_DYNAMIC_VALUE;
  }
  const record = value as JsonObject;
  const dynamicKey = Object.keys(record).find((key) => key.startsWith("$"));
  if (dynamicKey === undefined) return NO_DYNAMIC_VALUE;
  return Object.freeze({
    found: true,
    reference: dynamicKey === "$ref" && typeof record.$ref === "string" ? record.$ref : null,
  });
}

function nestedDynamicValue(value: JsonValue): DynamicValueScan {
  const direct = directDynamicValue(value);
  if (direct.found) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = nestedDynamicValue(item);
      if (nested.found) return nested;
    }
    return NO_DYNAMIC_VALUE;
  }
  if (isJsonObject(value)) {
    for (const key of Object.keys(value)) {
      const nested = nestedDynamicValue(value[key] as JsonValue);
      if (nested.found) return nested;
    }
  }
  return NO_DYNAMIC_VALUE;
}

function sourceValueState(
  container: JsonObject,
  control: ComponentInspectorControl,
): AuthoringInspectorValueState {
  const property = control.property;
  if (property !== null && !Object.hasOwn(container, property)) {
    return Object.freeze({ kind: "absent" });
  }
  const value = (property === null ? container : container[property]) as JsonValue;
  const directDynamic = directDynamicValue(value);
  if (directDynamic.found) {
    return Object.freeze({ kind: "dynamic", reference: directDynamic.reference, value });
  }
  if (control.kind === "structured-json") {
    const nestedDynamic = nestedDynamicValue(value);
    if (nestedDynamic.found) {
      return Object.freeze({ kind: "dynamic", reference: nestedDynamic.reference, value });
    }
    return Object.freeze({ kind: "structured", value });
  }
  if (isJsonPrimitive(value)) return Object.freeze({ kind: "literal", value });
  if (control.kind === "group") {
    return Object.freeze({ kind: "structured", value });
  }
  return Object.freeze({ kind: "dynamic", reference: null, value });
}

function isJsonObject(value: JsonValue): value is Readonly<Record<string, JsonValue>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inspectorControlLabel(
  control: ComponentInspectorControl,
  parentSchema: JsonObject | undefined,
): string {
  const property = control.property;
  const schema = property === null ? parentSchema : readChildSchema(parentSchema, property);
  return (
    optionalSchemaTitle(schema) ?? (property === null ? "Properties" : humanizeProperty(property))
  );
}

function prepareInspectorFields(
  controls: readonly ComponentInspectorControl[],
  container: JsonObject,
  parentSchema: JsonObject | undefined,
  parentLabels: readonly string[],
): readonly AuthoringInspectorField[] {
  const labels = controls.map((control) => inspectorControlLabel(control, parentSchema));
  const labelCounts = new Map<string, number>();
  labels.forEach((label) => labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1));
  return controls.map((control, index) => {
    const label = labels[index] ?? "Unnamed property";
    const qualifiedSegment =
      (labelCounts.get(label) ?? 0) > 1 ? `${label} (${control.valuePointer || "/"})` : label;
    return prepareInspectorField(
      control,
      container,
      parentSchema,
      parentLabels,
      label,
      qualifiedSegment,
    );
  });
}

function prepareInspectorField(
  control: ComponentInspectorControl,
  container: JsonObject,
  parentSchema: JsonObject | undefined,
  parentLabels: readonly string[],
  label: string,
  qualifiedSegment: string,
): AuthoringInspectorField {
  const property = control.property;
  const schema = property === null ? parentSchema : readChildSchema(parentSchema, property);
  const value = sourceValueState(container, control);
  const containsDynamicValue =
    value.kind === "dynamic" ||
    (value.kind === "structured" && nestedDynamicValue(value.value).found);
  const qualifiedLabel = [...parentLabels, qualifiedSegment].join(" · ");
  let children: readonly AuthoringInspectorField[] = [];
  if (control.kind === "group" && value.kind === "structured" && isJsonObject(value.value)) {
    const groupValue = value.value;
    children = prepareInspectorFields(control.children, groupValue, schema, [
      ...parentLabels,
      qualifiedSegment,
    ]);
  }
  return Object.freeze({
    children: Object.freeze(children),
    containsDynamicValue,
    control,
    description: optionalSchemaText(schema, "description"),
    label,
    qualifiedLabel,
    value,
  });
}

function countControls(controls: readonly ComponentInspectorControl[]): number {
  return controls.reduce(
    (total, control) =>
      total + 1 + (control.kind === "group" ? countControls(control.children) : 0),
    0,
  );
}

function scheduleChildren(pending: AuthoringLayerNode[], node: AuthoringLayerNode): void {
  for (const slot of node.slots) {
    for (const child of slot.children) pending.push(child);
  }
  for (const behavior of node.behaviors) {
    for (const slot of behavior.slots) {
      for (const child of slot.children) pending.push(child);
    }
  }
}

function findSelectedNode(
  model: CatalogAuthoringModel,
  selection: AuthoringComponentSelection,
): AuthoringLayerNode | undefined {
  const surface = model.surfaces.find(({ id }) => id === selection.surfaceId);
  if (surface === undefined) return undefined;
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === selection.sourceNodeId) return node;
    scheduleChildren(pending, node);
  }
  return undefined;
}

function isPrimitiveControl(
  control: ComponentInspectorControl,
): control is
  | Extract<ComponentInspectorControl, { readonly kind: "enum" }>
  | Extract<
      ComponentInspectorControl,
      { readonly kind: "boolean" | "integer" | "number" | "string" }
    > {
  return (
    control.kind === "enum" ||
    control.kind === "boolean" ||
    control.kind === "integer" ||
    control.kind === "number" ||
    control.kind === "string"
  );
}

function controlAcceptsValue(control: ComponentInspectorControl, value: JsonPrimitive): boolean {
  if (control.kind === "enum") {
    return control.options.some((option) => comparePrimitive(option, value));
  }
  if (control.kind === "boolean") return typeof value === "boolean";
  if (control.kind === "string") return typeof value === "string";
  if (control.kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (control.kind === "integer") return typeof value === "number" && Number.isInteger(value);
  return false;
}

function primitiveMatchesStateType(
  type: AuthoringInspectorStateOption["type"],
  value: unknown,
): value is JsonPrimitive {
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeof value === "number" && Number.isFinite(value);
}

function projectStateEnum(schema: JsonObject): readonly JsonPrimitive[] | undefined {
  if (!Object.hasOwn(schema, "enum")) return undefined;
  const values = schema.enum;
  if (!Array.isArray(values) || values.length === 0 || !values.every(isJsonPrimitive)) {
    return undefined;
  }
  return Object.freeze([...values]);
}

function projectInspectorStateOptions(
  document: DesenEditorDocument,
  surfaceId: string,
): readonly AuthoringInspectorStateOption[] {
  try {
    const surface = document.surfaces[surfaceId];
    if (surface === undefined) return Object.freeze([]);
    const options: AuthoringInspectorStateOption[] = [];
    for (const [name, declaration] of Object.entries(surface.state)) {
      if (!BINDABLE_STATE_NAME.test(name)) continue;
      const schema = declaration.schema as JsonObject;
      const type = schema.type;
      if (type !== "string" && type !== "boolean" && type !== "number" && type !== "integer") {
        continue;
      }
      if (!primitiveMatchesStateType(type, declaration.initial)) continue;
      options.push(
        Object.freeze({
          enumValues: projectStateEnum(schema),
          initial: declaration.initial,
          name,
          reference: `state.${name}`,
          type,
        }),
      );
    }
    options.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    return Object.freeze(options);
  } catch {
    return Object.freeze([]);
  }
}

/** Returns whether one authenticated local-state declaration is provably safe for a field. */
export function isAuthoringInspectorStateCompatible(
  field: AuthoringInspectorField,
  state: AuthoringInspectorStateOption,
): boolean {
  try {
    if (field.control.valuePointer.length === 0 || field.control.property === null) return false;
    if (field.control.kind === "string") return state.type === "string";
    if (field.control.kind === "boolean") return state.type === "boolean";
    if (field.control.kind === "number") {
      return state.type === "number" || state.type === "integer";
    }
    if (field.control.kind === "integer") return state.type === "integer";
    const control = field.control;
    if (control.kind !== "enum" || state.enumValues === undefined) return false;
    return state.enumValues.every((value) => control.options.some((item) => item === value));
  } catch {
    return false;
  }
}

function directLocalStateName(value: JsonValue): string | undefined {
  if (!isJsonObject(value)) return undefined;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "$ref") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, "$ref");
  if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
  if (typeof descriptor.value !== "string" || !descriptor.value.startsWith("state.")) {
    return undefined;
  }
  const name = descriptor.value.slice("state.".length);
  return BINDABLE_STATE_NAME.test(name) ? name : undefined;
}

function findInspectorField(
  fields: readonly AuthoringInspectorField[],
  valuePointer: string,
): AuthoringInspectorField | undefined {
  for (const field of fields) {
    if (field.control.valuePointer === valuePointer) return field;
    const nested = findInspectorField(field.children, valuePointer);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

type MutableJsonValue = JsonPrimitive | MutableJsonValue[] | { [key: string]: MutableJsonValue };

const MAX_ROOT_PROP_TRANSITIONS = 256;
const MAX_ROOT_TRANSITION_WORK_BYTES = 32 * 1024 * 1024;

function mutableJsonClone(value: JsonValue): MutableJsonValue | undefined {
  try {
    return JSON.parse(canonicalizeJson(value)) as MutableJsonValue;
  } catch {
    return undefined;
  }
}

function defineJsonProperty(
  object: Record<string, MutableJsonValue>,
  property: string,
  value: MutableJsonValue,
): void {
  Object.defineProperty(object, property, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function setOwnerProp(
  document: DesenEditorDocument,
  selection: AuthoringComponentSelection,
  property: string,
  value: JsonValue,
): DesenEditorDocument | undefined {
  const changed = setDesenEditorOwnerProp(document, {
    surfaceId: selection.surfaceId,
    ownerId: selection.sourceNodeId,
    name: property,
    value: value as DesenEditorContentValue,
  });
  return changed.ok ? changed.document : undefined;
}

function deleteOwnerProp(
  document: DesenEditorDocument,
  selection: AuthoringComponentSelection,
  property: string,
): DesenEditorDocument | undefined {
  const changed = deleteDesenEditorOwnerProp(document, {
    surfaceId: selection.surfaceId,
    ownerId: selection.sourceNodeId,
    name: property,
  });
  return changed.ok ? changed.document : undefined;
}

function replaceRootProps(
  document: DesenEditorDocument,
  selection: AuthoringComponentSelection,
  currentProps: JsonObject,
  nextValue: JsonValue,
): DesenEditorDocument | undefined {
  if (!isJsonObject(nextValue)) return undefined;
  const deletions = Object.keys(currentProps)
    .filter((property) => !Object.hasOwn(nextValue, property))
    .sort();
  const reducingSets: string[] = [];
  const growingSets: string[] = [];
  for (const property of Object.keys(nextValue)) {
    if (!Object.hasOwn(currentProps, property)) {
      growingSets.push(property);
      continue;
    }
    const currentValue = currentProps[property];
    const nextPropertyValue = nextValue[property];
    if (canonicalizeJson(currentValue) === canonicalizeJson(nextPropertyValue)) continue;
    const target =
      canonicalizeJsonBytes(nextPropertyValue).byteLength <=
      canonicalizeJsonBytes(currentValue).byteLength
        ? reducingSets
        : growingSets;
    target.push(property);
  }
  const sets = [...reducingSets.sort(), ...growingSets.sort()];
  const transitionCount = deletions.length + sets.length;
  if (transitionCount === 0) return document;
  if (transitionCount > MAX_ROOT_PROP_TRANSITIONS) return undefined;

  // Editor Core intentionally snapshots and validates the complete document for every public prop
  // command. Bound both command count and aggregate snapshot work before entering that synchronous
  // loop so a small but very wide root object cannot monopolize the browser main thread.
  const snapshotBytes =
    canonicalizeJsonBytes(document).byteLength + canonicalizeJsonBytes(nextValue).byteLength;
  if (snapshotBytes > Math.floor(MAX_ROOT_TRANSITION_WORK_BYTES / transitionCount)) {
    return undefined;
  }

  let candidate = document;

  // This candidate is never exposed. Removing obsolete values and shrinking replacements before
  // any growth avoids a transient document that can exceed Editor Core's fixed byte profile even
  // when both endpoints are admissible.
  for (const property of deletions) {
    const changed = deleteOwnerProp(candidate, selection, property);
    if (changed === undefined) return undefined;
    candidate = changed;
  }
  for (const property of sets) {
    const changed = setOwnerProp(candidate, selection, property, nextValue[property] as JsonValue);
    if (changed === undefined) return undefined;
    candidate = changed;
  }
  return candidate;
}

function changeNestedProp(
  document: DesenEditorDocument,
  selection: AuthoringComponentSelection,
  currentProps: JsonObject,
  segments: readonly string[],
  edit: CapturedAuthoringInspectorEdit,
): DesenEditorDocument | undefined {
  const topProperty = segments[0];
  if (topProperty === undefined) {
    return edit.kind === "set"
      ? replaceRootProps(document, selection, currentProps, edit.value)
      : undefined;
  }
  if (segments.length === 1) {
    return edit.kind === "set"
      ? setOwnerProp(document, selection, topProperty, edit.value)
      : deleteOwnerProp(document, selection, topProperty);
  }

  const currentTop = currentProps[topProperty] as JsonValue | undefined;
  if (currentTop === undefined) return undefined;
  const mutableTop = mutableJsonClone(currentTop);
  if (!isJsonObject(mutableTop as JsonValue)) return undefined;

  let parent = mutableTop as Record<string, MutableJsonValue>;
  for (let index = 1; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    if (!Object.hasOwn(parent, segment)) return undefined;
    const child = parent[segment];
    if (typeof child !== "object" || child === null || Array.isArray(child)) return undefined;
    parent = child;
  }
  const property = segments.at(-1) as string;
  if (edit.kind === "delete") {
    if (!Object.hasOwn(parent, property)) return undefined;
    Reflect.deleteProperty(parent, property);
  } else {
    defineJsonProperty(parent, property, mutableJsonClone(edit.value) as MutableJsonValue);
  }
  return setOwnerProp(document, selection, topProperty, mutableTop as JsonValue);
}

/**
 * Joins one route-valid Source selection with current props and canonical Catalog control order.
 *
 * @remarks Dynamic values remain explicit states and retain their complete inert ValueSpec.
 * Direct, compatible local-state references may be changed only through the separate binding
 * boundary; every other dynamic form stays read-only. Closed object groups expose their recursive
 * control tree, while unsupported schema subtrees remain honest structured-JSON fallbacks.
 */
export function prepareAuthoringInspectorModel(
  model: CatalogAuthoringModel,
  route: AuthoringInspectorRoute,
  selection: AuthoringComponentSelection | null,
): AuthoringInspectorModelResult {
  if (selection === null) return Object.freeze({ status: "idle" });
  const projection = projectAuthoringSelection(selection, route, model, undefined);
  if (projection.status !== "unavailable") return Object.freeze({ status: "rejected" });

  const node = findSelectedNode(model, selection);
  const component = model.components.find(({ id }) => id === selection.capabilityId);
  if (node === undefined || component === undefined) return Object.freeze({ status: "rejected" });

  const propsSchema = component.inspector.propsSchema as JsonObject;
  const fields = prepareInspectorFields(component.inspector.controls, node.props, propsSchema, []);
  const localStates = projectInspectorStateOptions(model.validationDocument, selection.surfaceId);

  return Object.freeze({
    status: "ready",
    component,
    controlCount: countControls(component.inspector.controls),
    fields: Object.freeze(fields),
    localStates,
    node,
    selection,
  });
}

/**
 * Applies one exact schema-derived edit through Editor Core and continuous Catalog validation.
 *
 * @remarks Selection and control identity are re-derived from the supplied immutable Source and
 * validated Catalog before mutation. Nested changes rebuild only their complete top-level prop,
 * while a root structured fallback stages a deterministic whole-props transition internally.
 * Dynamic values cannot be overwritten through this T06 API; required values cannot be deleted.
 * Any command or semantic failure preserves the input document.
 */
export function applyAuthoringInspectorEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringInspectorRoute,
  selection: AuthoringComponentSelection,
  edit: AuthoringInspectorEdit,
): AuthoringInspectorEditResult {
  const capturedRoute = captureInspectorRoute(route);
  const capturedSelection = captureInspectorSelection(selection);
  const capturedEdit = captureInspectorEdit(edit);
  if (capturedRoute === undefined || capturedSelection === undefined) {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }
  if (capturedEdit === undefined) {
    return Object.freeze({ ok: false, reason: "edit-rejected" });
  }
  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return Object.freeze({
      ok: false,
      reason: prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid",
    });
  }
  const inspector = prepareAuthoringInspectorModel(
    prepared.model,
    capturedRoute,
    capturedSelection,
  );
  if (inspector.status !== "ready") {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }

  const field = findInspectorField(inspector.fields, capturedEdit.valuePointer);
  if (field === undefined) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  if (field.value.kind === "dynamic") {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  if (field.control.kind === "group" && field.containsDynamicValue) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }

  if (capturedEdit.kind === "delete") {
    if (capturedEdit.valuePointer === "") {
      return Object.freeze({ ok: false, reason: "control-unavailable" });
    }
    if (field.control.required) {
      return Object.freeze({ ok: false, reason: "required-property" });
    }
    if (field.value.kind === "absent") {
      return Object.freeze({ ok: false, reason: "control-unavailable" });
    }
  } else {
    const dynamic = nestedDynamicValue(capturedEdit.value);
    if (dynamic.found) {
      return Object.freeze({ ok: false, reason: "control-unavailable" });
    }
    if (isPrimitiveControl(field.control)) {
      if (
        !isJsonPrimitive(capturedEdit.value) ||
        !controlAcceptsValue(field.control, capturedEdit.value)
      ) {
        return Object.freeze({ ok: false, reason: "value-invalid" });
      }
    } else if (field.control.kind === "group" && !isJsonObject(capturedEdit.value)) {
      return Object.freeze({ ok: false, reason: "value-invalid" });
    }
  }

  const changed = changeNestedProp(
    prepared.model.validationDocument,
    capturedSelection,
    inspector.node.props,
    parseJsonPointer(capturedEdit.valuePointer),
    capturedEdit,
  );
  if (changed === undefined) return Object.freeze({ ok: false, reason: "edit-rejected" });

  const validator = createDesenEditorContinuousValidator(prepared.model.validationCatalogs);
  if (!validator.ok) return Object.freeze({ ok: false, reason: "catalog-invalid" });
  const report = validator.validator.validate(changed);
  if (!report.valid) return Object.freeze({ ok: false, reason: "source-invalid" });

  return Object.freeze({ ok: true, document: changed });
}

/**
 * Applies one direct local-state binding transition through Editor Core and continuous validation.
 *
 * @remarks This boundary is intentionally separate from literal Inspector editing. It constructs
 * only exact `{ $ref: "state.<name>" }` values for route-local, primitive declarations whose type
 * is provably compatible with the authenticated Catalog control. Existing bindings from runtime
 * namespaces, bindings with fallbacks, tokens, formats, and nested dynamic values remain read-only.
 * Detaching a direct state binding restores that declaration's validated primitive initial value.
 * Every rejection preserves the input Source document.
 */
export function applyAuthoringInspectorBindingEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringInspectorRoute,
  selection: AuthoringComponentSelection,
  edit: AuthoringInspectorBindingEdit,
): AuthoringInspectorEditResult {
  const capturedRoute = captureInspectorRoute(route);
  const capturedSelection = captureInspectorSelection(selection);
  const capturedEdit = captureInspectorBindingEdit(edit);
  if (capturedRoute === undefined || capturedSelection === undefined) {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }
  if (capturedEdit === undefined) {
    return Object.freeze({ ok: false, reason: "edit-rejected" });
  }

  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return Object.freeze({
      ok: false,
      reason: prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid",
    });
  }
  const inspector = prepareAuthoringInspectorModel(
    prepared.model,
    capturedRoute,
    capturedSelection,
  );
  if (inspector.status !== "ready") {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }
  const field = findInspectorField(inspector.fields, capturedEdit.valuePointer);
  if (
    field === undefined ||
    !isPrimitiveControl(field.control) ||
    field.control.property === null ||
    field.control.valuePointer.length === 0
  ) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }

  const currentStateName =
    field.value.kind === "dynamic" ? directLocalStateName(field.value.value) : undefined;
  if (field.value.kind === "dynamic" && currentStateName === undefined) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }

  const stateName = capturedEdit.kind === "bind" ? capturedEdit.stateName : currentStateName;
  if (stateName === undefined) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  const state = inspector.localStates.find(({ name }) => name === stateName);
  if (state === undefined || !isAuthoringInspectorStateCompatible(field, state)) {
    return Object.freeze({ ok: false, reason: "binding-incompatible" });
  }

  const value: JsonValue =
    capturedEdit.kind === "bind" ? Object.freeze({ $ref: state.reference }) : state.initial;
  const changed = changeNestedProp(
    prepared.model.validationDocument,
    capturedSelection,
    inspector.node.props,
    parseJsonPointer(capturedEdit.valuePointer),
    Object.freeze({ kind: "set", value, valuePointer: capturedEdit.valuePointer }),
  );
  if (changed === undefined) return Object.freeze({ ok: false, reason: "edit-rejected" });

  const validator = createDesenEditorContinuousValidator(prepared.model.validationCatalogs);
  if (!validator.ok) return Object.freeze({ ok: false, reason: "catalog-invalid" });
  const report = validator.validator.validate(changed);
  if (!report.valid) return Object.freeze({ ok: false, reason: "source-invalid" });
  return Object.freeze({ ok: true, document: changed });
}
