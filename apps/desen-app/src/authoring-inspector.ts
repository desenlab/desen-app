import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorOwnerProp,
  setDesenEditorOwnerProp,
} from "@desen/editor-core";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type { ComponentInspectorControl, JsonPrimitive } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";
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
  | Readonly<{ readonly kind: "dynamic"; readonly reference: string | null }>
  | Readonly<{ readonly kind: "structured" }>;

/** One inspector row joined from an authoritative schema descriptor and current Source value. */
export interface AuthoringInspectorField {
  readonly control: ComponentInspectorControl;
  readonly description: string | undefined;
  readonly label: string;
  readonly value: AuthoringInspectorValueState;
}

/** Inspector model for one exact, route-valid Source component selection. */
export interface AuthoringInspectorReadyModel {
  readonly component: CatalogComponentSummary;
  readonly fields: readonly AuthoringInspectorField[];
  readonly node: AuthoringLayerNode;
  readonly selection: AuthoringComponentSelection;
  readonly status: "ready";
}

/** Fail-closed result of joining a selection, Source values, and Catalog-derived controls. */
export type AuthoringInspectorModelResult =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | AuthoringInspectorReadyModel;

/** Exact primitive prop mutation admitted by the M09-T05 inspector. */
export type AuthoringInspectorEdit =
  | Readonly<{ readonly kind: "delete"; readonly property: string }>
  | Readonly<{
      readonly kind: "set";
      readonly property: string;
      readonly value: JsonPrimitive;
    }>;

/** Atomic Source mutation success returned by the App inspector boundary. */
export interface AuthoringInspectorEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
}

/** Stable, UI-safe reason why an inspector edit produced no Source document. */
export type AuthoringInspectorEditFailureReason =
  | "catalog-invalid"
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

/** Complete result of one schema-authorized primitive or enum inspector edit. */
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
  | Readonly<{ readonly kind: "delete"; readonly property: string }>
  | Readonly<{ readonly kind: "set"; readonly property: string; readonly value: unknown }>;

function captureInspectorEdit(
  edit: AuthoringInspectorEdit,
): CapturedAuthoringInspectorEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const ownKeys = Reflect.ownKeys(edit);
    if (ownKeys.some((key) => typeof key !== "string")) return undefined;

    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    const propertyDescriptor = Object.getOwnPropertyDescriptor(edit, "property");
    if (
      kindDescriptor?.enumerable !== true ||
      !("value" in kindDescriptor) ||
      propertyDescriptor?.enumerable !== true ||
      !("value" in propertyDescriptor) ||
      typeof propertyDescriptor.value !== "string" ||
      propertyDescriptor.value.length === 0
    ) {
      return undefined;
    }

    if (kindDescriptor.value === "delete") {
      if (ownKeys.length !== 2 || !ownKeys.includes("kind") || !ownKeys.includes("property")) {
        return undefined;
      }
      return Object.freeze({ kind: "delete", property: propertyDescriptor.value });
    }
    if (kindDescriptor.value !== "set") return undefined;
    if (
      ownKeys.length !== 3 ||
      !ownKeys.includes("kind") ||
      !ownKeys.includes("property") ||
      !ownKeys.includes("value")
    ) {
      return undefined;
    }
    const valueDescriptor = Object.getOwnPropertyDescriptor(edit, "value");
    if (valueDescriptor?.enumerable !== true || !("value" in valueDescriptor)) {
      return undefined;
    }
    return Object.freeze({
      kind: "set",
      property: propertyDescriptor.value,
      value: valueDescriptor.value,
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
  return spaced.length === 0 ? property : `${spaced[0]?.toUpperCase() ?? ""}${spaced.slice(1)}`;
}

function readSchemaRecord(
  component: CatalogComponentSummary,
  property: string,
): JsonObject | undefined {
  const root = component.inspector.propsSchema as JsonObject;
  const properties = root.properties;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return undefined;
  }
  const schema = (properties as JsonObject)[property];
  return typeof schema === "object" && schema !== null && !Array.isArray(schema)
    ? (schema as JsonObject)
    : undefined;
}

function optionalSchemaText(schema: JsonObject | undefined, key: "description" | "title") {
  const value = schema?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sourceValueState(
  node: AuthoringLayerNode,
  control: ComponentInspectorControl,
): AuthoringInspectorValueState {
  const property = control.property;
  if (property === null || !Object.hasOwn(node.props, property)) {
    return Object.freeze({ kind: "absent" });
  }
  const value = node.props[property];
  if (isJsonPrimitive(value)) return Object.freeze({ kind: "literal", value });
  const reference =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "$ref") &&
    typeof (value as JsonObject).$ref === "string"
      ? ((value as JsonObject).$ref as string)
      : null;
  if (reference !== null) return Object.freeze({ kind: "dynamic", reference });
  if (control.kind === "group" || control.kind === "structured-json") {
    return Object.freeze({ kind: "structured" });
  }
  return Object.freeze({ kind: "dynamic", reference });
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

function isEditableControl(
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

/**
 * Joins one route-valid Source selection with current props and canonical Catalog control order.
 *
 * @remarks Dynamic values remain explicit non-editable states for M09-T08, while group and
 * structured-JSON descriptors remain visible for M09-T06 instead of being silently discarded.
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

  const fields = component.inspector.controls.map((control) => {
    const property = control.property;
    const schema = property === null ? undefined : readSchemaRecord(component, property);
    return Object.freeze({
      control,
      description: optionalSchemaText(schema, "description"),
      label:
        optionalSchemaText(schema, "title") ??
        (property === null ? "Properties" : humanizeProperty(property)),
      value: sourceValueState(node, control),
    });
  });

  return Object.freeze({
    status: "ready",
    component,
    fields: Object.freeze(fields),
    node,
    selection,
  });
}

/**
 * Applies one exact primitive/enum edit through Editor Core and continuous Catalog validation.
 *
 * @remarks Selection and control identity are re-derived from the supplied immutable Source and
 * validated Catalog before mutation. Dynamic values cannot be overwritten through this T05 API;
 * required props cannot be deleted. Any command or semantic failure preserves the input document.
 */
export function applyAuthoringInspectorEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringInspectorRoute,
  selection: AuthoringComponentSelection,
  edit: AuthoringInspectorEdit,
): AuthoringInspectorEditResult {
  const capturedEdit = captureInspectorEdit(edit);
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
  const inspector = prepareAuthoringInspectorModel(prepared.model, route, selection);
  if (inspector.status !== "ready") {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }

  const field = inspector.fields.find(({ control }) => control.property === capturedEdit.property);
  if (field === undefined || field.control.property === null || !isEditableControl(field.control)) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  if (field.value.kind === "dynamic" || field.value.kind === "structured") {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }

  if (capturedEdit.kind === "delete") {
    if (field.control.required) {
      return Object.freeze({ ok: false, reason: "required-property" });
    }
    if (field.value.kind === "absent") {
      return Object.freeze({ ok: false, reason: "control-unavailable" });
    }
  } else if (
    !isJsonPrimitive(capturedEdit.value) ||
    !controlAcceptsValue(field.control, capturedEdit.value)
  ) {
    return Object.freeze({ ok: false, reason: "value-invalid" });
  }

  const changed =
    capturedEdit.kind === "delete"
      ? deleteDesenEditorOwnerProp(document, {
          surfaceId: selection.surfaceId,
          ownerId: selection.sourceNodeId,
          name: capturedEdit.property,
        })
      : setDesenEditorOwnerProp(document, {
          surfaceId: selection.surfaceId,
          ownerId: selection.sourceNodeId,
          name: capturedEdit.property,
          value: capturedEdit.value as JsonPrimitive,
        });
  if (!changed.ok) return Object.freeze({ ok: false, reason: "edit-rejected" });

  const validator = createDesenEditorContinuousValidator([catalogValue]);
  if (!validator.ok) return Object.freeze({ ok: false, reason: "catalog-invalid" });
  const report = validator.validator.validate(changed.document);
  if (!report.valid) return Object.freeze({ ok: false, reason: "source-invalid" });

  return Object.freeze({ ok: true, document: changed.document });
}
