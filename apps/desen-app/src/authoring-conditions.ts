import {
  clearDesenEditorNodeCondition,
  createDesenEditorContinuousValidator,
  setDesenEditorNodeCondition,
} from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type {
  DesenEditorContentPredicate,
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
} from "@desen/editor-core";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

/** Exact App route that may authorize a selected-node condition edit. */
export interface AuthoringConditionRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Exact set/clear transition supported by the App-owned condition boundary. */
export type AuthoringConditionEdit =
  | Readonly<{ readonly kind: "clear" }>
  | Readonly<{
      readonly kind: "set";
      readonly when: DesenEditorContentPredicate;
    }>;

/** Atomic condition success containing one fully validated Source endpoint. */
export interface AuthoringConditionEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly operation: AuthoringConditionEdit["kind"];
}

/** Stable reason why a condition edit produced no Source endpoint. */
export type AuthoringConditionEditFailureReason =
  "catalog-invalid" | "condition-absent" | "edit-rejected" | "selection-invalid" | "source-invalid";

/** Atomic condition rejection with no partially edited document. */
export interface AuthoringConditionEditFailure {
  readonly ok: false;
  readonly reason: AuthoringConditionEditFailureReason;
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete outcome of one selected-component condition edit. */
export type AuthoringConditionEditResult =
  AuthoringConditionEditFailure | AuthoringConditionEditSuccess;

function failure(
  reason: AuthoringConditionEditFailureReason,
  validationReport?: DesenEditorContinuousValidationReport,
): AuthoringConditionEditFailure {
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

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function captureRoute(route: AuthoringConditionRoute): AuthoringConditionRoute | undefined {
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

function capturePredicate(value: unknown): DesenEditorContentPredicate | undefined {
  try {
    const captured = JSON.parse(canonicalizeJson(value)) as unknown;
    return typeof captured === "object" && captured !== null && !Array.isArray(captured)
      ? (captured as DesenEditorContentPredicate)
      : undefined;
  } catch {
    return undefined;
  }
}

function captureEdit(edit: AuthoringConditionEdit): AuthoringConditionEdit | undefined {
  try {
    const kind =
      typeof edit === "object" && edit !== null
        ? Object.getOwnPropertyDescriptor(edit, "kind")
        : undefined;
    if (kind === undefined || !kind.enumerable || !("value" in kind)) return undefined;
    if (kind.value === "clear") {
      return exactOwnData(edit, ["kind"]) === undefined
        ? undefined
        : Object.freeze({ kind: "clear" });
    }
    if (kind.value !== "set") return undefined;
    const fields = exactOwnData(edit, ["kind", "when"]);
    const when = capturePredicate(fields?.when);
    return fields === undefined || when === undefined
      ? undefined
      : Object.freeze({ kind: "set", when });
  } catch {
    return undefined;
  }
}

/**
 * Sets or clears one selected component's conditional-presence predicate atomically.
 *
 * @remarks The exact current route and Source selection are reauthorized before invoking public
 * Editor Core condition commands. A set may replace an existing predicate; clear requires a
 * currently conditional selection. The resulting complete Source then crosses Catalog-bound
 * continuous validation. Structural or semantic failure exposes no candidate document.
 */
export function applyAuthoringConditionEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringConditionRoute,
  selection: AuthoringComponentSelection,
  edit: AuthoringConditionEdit,
): AuthoringConditionEditResult {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  const capturedEdit = captureEdit(edit);
  if (capturedRoute === undefined || capturedSelection === undefined) {
    return failure("selection-invalid");
  }
  if (capturedEdit === undefined) return failure("edit-rejected");
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
  if (capturedEdit.kind === "clear" && !capturedSelection.conditional) {
    return failure("condition-absent");
  }

  const changed =
    capturedEdit.kind === "set"
      ? setDesenEditorNodeCondition(prepared.model.validationDocument, {
          surfaceId: capturedRoute.surfaceId,
          nodeId: capturedSelection.sourceNodeId,
          when: capturedEdit.when,
        })
      : clearDesenEditorNodeCondition(prepared.model.validationDocument, {
          surfaceId: capturedRoute.surfaceId,
          nodeId: capturedSelection.sourceNodeId,
        });
  if (!changed.ok) return failure("edit-rejected");

  const validator = createDesenEditorContinuousValidator(prepared.model.validationCatalogs);
  if (!validator.ok) return failure("catalog-invalid");
  const report = validator.validator.validate(changed.document);
  return report.valid
    ? Object.freeze({ ok: true, document: changed.document, operation: capturedEdit.kind })
    : failure("source-invalid", report);
}
