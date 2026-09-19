import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorVariant,
  insertDesenEditorVariant,
  setDesenEditorVariantCondition,
} from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type { JsonPrimitive } from "@desen/catalog-sdk";
import type {
  DesenEditorContentPredicate,
  DesenEditorContentVariant,
  DesenEditorDocument,
  DesenEditorContinuousValidationReport,
} from "@desen/editor-core";
import type { CatalogAuthoringModel, CatalogComponentSummary } from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

type JsonObject = Readonly<Record<string, unknown>>;
type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type EditorVariant = NonNullable<EditorNode["variants"]>[number];

const VARIANT_EXTENSION = "run.desen.app/t16-variant";
const VARIANT_VERSION = 1;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9 _-]{0,63}$/u;

/** Exact App route authorized to inspect or mutate one Source surface. */
export interface AuthoringVariantRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** A primitive surface state that can safely drive one named visual preset. */
export interface AuthoringVariantAxis {
  readonly name: string;
  readonly value: JsonPrimitive;
  readonly reference: string;
}

/** One named T16 preset projected from an immutable Source variant. */
export interface AuthoringVariantDescriptor {
  readonly index: number;
  readonly name: string;
  readonly axis: AuthoringVariantAxis;
}

/** Ready model for the selected component's named variants and declared visual states. */
export interface AuthoringVariantReadyModel {
  readonly status: "ready";
  readonly component: CatalogComponentSummary;
  readonly selection: AuthoringComponentSelection;
  readonly variants: readonly AuthoringVariantDescriptor[];
  readonly visualStates: readonly string[];
  readonly localStateOptions: readonly AuthoringVariantAxis[];
  readonly unmanagedVariantCount: number;
}

/** Fail-closed result of joining a Source selection, Catalog and variant metadata. */
export type AuthoringVariantModelResult =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | AuthoringVariantReadyModel;

/** A bounded mutation for one named variant. No arbitrary predicate or child tree is accepted. */
export type AuthoringVariantEdit =
  | Readonly<{
      readonly kind: "create";
      readonly axisName: string;
      readonly axisValue: JsonPrimitive;
      readonly name: string;
    }>
  | Readonly<{ readonly kind: "rename"; readonly index: number; readonly name: string }>
  | Readonly<{ readonly kind: "delete"; readonly index: number }>;

/** Atomic result of one named-variant mutation. */
export type AuthoringVariantEditResult =
  | Readonly<{ readonly ok: true; readonly document: DesenEditorDocument }>
  | Readonly<{
      readonly ok: false;
      readonly reason:
        | "catalog-invalid"
        | "edit-rejected"
        | "name-invalid"
        | "selection-invalid"
        | "source-invalid"
        | "state-invalid"
        | "variant-unavailable";
      readonly validationReport?: DesenEditorContinuousValidationReport;
    }>;

function ownRecord(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function own(value: JsonObject, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function capturePrimitive(value: unknown): JsonPrimitive | undefined {
  if (!isPrimitive(value)) return undefined;
  return value;
}

function captureText(value: unknown): string | undefined {
  return typeof value === "string" && NAME_PATTERN.test(value.trim()) ? value.trim() : undefined;
}

function captureSelection(
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
  if (selection.kind !== "component" || selection.sourceNodeId.length === 0) return undefined;
  return selection;
}

function findNode(
  document: DesenEditorDocument,
  route: AuthoringVariantRoute,
  selection: AuthoringComponentSelection,
): EditorNode | undefined {
  const surface = document.surfaces[route.surfaceId];
  if (surface === undefined) return undefined;
  let found: EditorNode | undefined;
  function visit(node: EditorNode): void {
    if (found !== undefined) return;
    if (node.id === selection.sourceNodeId) {
      found = node;
      return;
    }
    for (const children of Object.values(node.slots ?? {}))
      for (const child of children) visit(child);
    for (const behavior of node.behaviors ?? [])
      for (const children of Object.values(behavior.slots ?? {}))
        for (const child of children) visit(child);
  }
  visit(surface.root);
  return found;
}

function marker(variant: EditorVariant): JsonObject | undefined {
  const extensions = ownRecord(own(ownRecord(variant) ?? {}, "extensions"));
  return ownRecord(extensions === undefined ? undefined : own(extensions, VARIANT_EXTENSION));
}

function readDescriptor(
  index: number,
  variant: EditorVariant,
): AuthoringVariantDescriptor | undefined {
  const metadata = marker(variant);
  if (metadata === undefined || own(metadata, "version") !== VARIANT_VERSION) return undefined;
  const name = captureText(own(metadata, "name"));
  const axis = ownRecord(own(metadata, "axis"));
  const axisName = typeof axis?.name === "string" ? axis.name : undefined;
  const value = capturePrimitive(axis === undefined ? undefined : own(axis, "value"));
  const reference = typeof axis?.reference === "string" ? axis.reference : undefined;
  if (
    name === undefined ||
    axisName === undefined ||
    value === undefined ||
    reference === undefined
  )
    return undefined;
  return Object.freeze({
    index,
    name,
    axis: Object.freeze({ name: axisName, value, reference }),
  });
}

function stateAxes(
  document: DesenEditorDocument,
  surfaceId: string,
): readonly AuthoringVariantAxis[] {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return Object.freeze([]);
  return Object.freeze(
    Object.entries(surface.state)
      .flatMap(([name, declaration]) => {
        const initial = capturePrimitive(declaration.initial);
        return initial === undefined
          ? []
          : [Object.freeze({ name, value: initial, reference: `state.${name}` })];
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
  );
}

function predicate(axis: AuthoringVariantAxis): DesenEditorContentPredicate {
  return { op: "eq", args: [{ $ref: axis.reference }, axis.value] } as DesenEditorContentPredicate;
}

function validate(
  document: DesenEditorDocument,
  catalogs: readonly unknown[],
): AuthoringVariantEditResult {
  const validator = createDesenEditorContinuousValidator(catalogs);
  if (!validator.ok) return Object.freeze({ ok: false, reason: "catalog-invalid" });
  const report = validator.validator.validate(document);
  return report.valid
    ? Object.freeze({ ok: true, document })
    : Object.freeze({ ok: false, reason: "source-invalid", validationReport: report });
}

/** Projects only T16-marked named variants; unrelated protocol variants stay visible as unmanaged. */
export function prepareAuthoringVariantModel(
  model: CatalogAuthoringModel,
  route: AuthoringVariantRoute,
  selection: AuthoringComponentSelection | null,
): AuthoringVariantModelResult {
  if (selection === null) return Object.freeze({ status: "idle" });
  const captured = captureSelection(selection);
  if (
    captured === undefined ||
    projectAuthoringSelection(captured, route, model, undefined).status !== "unavailable"
  ) {
    return Object.freeze({ status: "rejected" });
  }
  const node = findNode(model.validationDocument, route, captured);
  const component = model.components.find(({ id }) => id === captured.capabilityId);
  if (node === undefined || node.use !== captured.capabilityId || component === undefined) {
    return Object.freeze({ status: "rejected" });
  }
  const variants = node.variants ?? [];
  const projected: AuthoringVariantDescriptor[] = [];
  variants.forEach((variant, index) => {
    const descriptor = readDescriptor(index, variant);
    if (descriptor !== undefined) projected.push(descriptor);
  });
  return Object.freeze({
    status: "ready",
    component,
    selection: captured,
    variants: Object.freeze(projected),
    visualStates: component.visualStates,
    localStateOptions: stateAxes(model.validationDocument, route.surfaceId),
    unmanagedVariantCount: variants.length - projected.length,
  });
}

/** Applies a named preset while preserving all children and rejecting undeclared state axes. */
export function applyAuthoringVariantEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringVariantRoute,
  selection: AuthoringComponentSelection,
  edit: AuthoringVariantEdit,
): AuthoringVariantEditResult {
  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok)
    return Object.freeze({
      ok: false,
      reason: prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid",
    });
  const model = prepareAuthoringVariantModel(prepared.model, route, selection);
  if (model.status !== "ready") return Object.freeze({ ok: false, reason: "selection-invalid" });
  const node = findNode(prepared.model.validationDocument, route, model.selection);
  if (node === undefined) return Object.freeze({ ok: false, reason: "selection-invalid" });
  if (edit.kind === "create") {
    const name = captureText(edit.name);
    const axisName = captureText(edit.axisName);
    const axis = model.localStateOptions.find(({ name: candidate }) => candidate === edit.axisName);
    const value = capturePrimitive(edit.axisValue);
    if (name === undefined || axisName === undefined)
      return Object.freeze({ ok: false, reason: "name-invalid" });
    if (axis === undefined || value === undefined || typeof value !== typeof axis.value)
      return Object.freeze({ ok: false, reason: "state-invalid" });
    if (model.variants.some((variant) => variant.name === name))
      return Object.freeze({ ok: false, reason: "name-invalid" });
    const variant: DesenEditorContentVariant = {
      when: predicate(Object.freeze({ name: axis.name, value, reference: axis.reference })),
      style: { base: {} },
      extensions: {
        [VARIANT_EXTENSION]: {
          version: VARIANT_VERSION,
          name,
          axis: { name: axis.name, value, reference: axis.reference },
        },
      },
    } as DesenEditorContentVariant;
    const changed = insertDesenEditorVariant(prepared.model.validationDocument, {
      surfaceId: route.surfaceId,
      nodeId: model.selection.sourceNodeId,
      index: (node.variants ?? []).length,
      variant,
    });
    return changed.ok
      ? validate(changed.document, prepared.model.validationCatalogs)
      : Object.freeze({ ok: false, reason: "edit-rejected" });
  }
  const descriptor = model.variants.find(({ index }) => index === edit.index);
  if (descriptor === undefined) return Object.freeze({ ok: false, reason: "variant-unavailable" });
  if (edit.kind === "delete") {
    const changed = deleteDesenEditorVariant(prepared.model.validationDocument, {
      surfaceId: route.surfaceId,
      nodeId: model.selection.sourceNodeId,
      index: edit.index,
    });
    return changed.ok
      ? validate(changed.document, prepared.model.validationCatalogs)
      : Object.freeze({ ok: false, reason: "edit-rejected" });
  }
  const name = captureText(edit.name);
  if (
    name === undefined ||
    model.variants.some((variant) => variant.name === name && variant.index !== edit.index)
  )
    return Object.freeze({ ok: false, reason: "name-invalid" });
  const changed = setDesenEditorVariantCondition(prepared.model.validationDocument, {
    surfaceId: route.surfaceId,
    nodeId: model.selection.sourceNodeId,
    index: edit.index,
    when: predicate(descriptor.axis),
  });
  if (!changed.ok) return Object.freeze({ ok: false, reason: "edit-rejected" });
  // Metadata is deliberately updated through a detached clone so children and Source identities remain untouched.
  const next = JSON.parse(canonicalizeJson(changed.document)) as DesenEditorDocument;
  const nextNode = findNode(next, route, model.selection);
  const nextVariant = nextNode?.variants?.[edit.index] as Record<string, unknown> | undefined;
  if (nextVariant === undefined) return Object.freeze({ ok: false, reason: "edit-rejected" });
  const extensions = (nextVariant.extensions ?? {}) as Record<string, unknown>;
  const metadata = (extensions[VARIANT_EXTENSION] ?? {}) as Record<string, unknown>;
  metadata.name = name;
  extensions[VARIANT_EXTENSION] = metadata;
  nextVariant.extensions = extensions;
  return validate(next, prepared.model.validationCatalogs);
}
