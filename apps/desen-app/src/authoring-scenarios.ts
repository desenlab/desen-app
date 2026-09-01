import { setDesenEditorOwnerProp } from "@desen/editor-core";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { prepareAuthoringPreviewBundle } from "./authoring-preview.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";
import type { PublishCatalogPackageCandidate } from "@desen/publisher";
import type { CatalogAuthoringModel } from "./authoring-data.js";
import type {
  AuthoringPreviewBundleResult,
  AuthoringPreviewBundleSuccess,
} from "./authoring-preview.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

type JsonObject = Readonly<Record<string, unknown>>;

const SCENARIO_ID = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const SCENARIO_ALLOWED_KEYS = Object.freeze([
  "description",
  "extensions",
  "fixtures",
  "props",
  "state",
] as const);
const SCENARIO_PROJECTION_LIMITS = Object.freeze({ maxDepth: 64, maxValues: 25_000 });

/** Stable select value that restores the current authored Source values. */
export const AUTHORING_SOURCE_SCENARIO_VALUE = "source" as const;

/** Closed select value for either authored values or one exact Catalog scenario. */
export type AuthoringScenarioValue = typeof AUTHORING_SOURCE_SCENARIO_VALUE | `catalog:${string}`;

/** Exact App route that may authorize a component-scenario preview. */
export interface AuthoringScenarioRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** One authored or Catalog-declared scenario choice exposed to App-owned controls. */
export interface AuthoringScenarioOption {
  readonly kind: "catalog" | "source";
  readonly value: AuthoringScenarioValue;
  readonly scenarioId: string | null;
  readonly label: string;
  readonly description: string | undefined;
}

/** Route- and component-authenticated scenario choices ready for App-owned controls. */
export interface AuthoringScenarioReadyModel {
  readonly status: "ready";
  readonly route: AuthoringScenarioRoute;
  readonly selection: AuthoringComponentSelection;
  readonly options: readonly AuthoringScenarioOption[];
}

/** Stable reason why no scenario model authority was exposed. */
export type AuthoringScenarioModelRejectionReason =
  | "catalog-invalid"
  | "projection-limit"
  | "route-invalid"
  | "scenario-unsupported"
  | "selection-invalid";

/** Honest outcome of projecting authored and Catalog-declared scenario choices. */
export type AuthoringScenarioModelResult =
  | Readonly<{ readonly status: "idle" }>
  | AuthoringScenarioReadyModel
  | Readonly<{
      readonly status: "rejected";
      readonly reason: AuthoringScenarioModelRejectionReason;
    }>;

/** Successful transient scenario Source and its independently prepared preview Bundle. */
export interface AuthoringScenarioPreviewSuccess {
  readonly ok: true;
  readonly scenarioDocument: DesenEditorDocument;
  readonly preview: AuthoringPreviewBundleSuccess;
}

/** Stable reason why a transient scenario preview was not prepared. */
export type AuthoringScenarioPreviewFailureReason =
  | AuthoringScenarioModelRejectionReason
  | "document-invalid"
  | "preview-unavailable"
  | "scenario-invalid";

/** Fail-closed scenario-preview rejection with no partial Source or Bundle. */
export interface AuthoringScenarioPreviewFailure {
  readonly ok: false;
  readonly reason: AuthoringScenarioPreviewFailureReason;
}

/** Complete result of preparing one authoring-only scenario preview. */
export type AuthoringScenarioPreviewResult =
  AuthoringScenarioPreviewFailure | AuthoringScenarioPreviewSuccess;

interface CapturedScenario {
  readonly id: string;
  readonly value: `catalog:${string}`;
  readonly description: string | undefined;
  readonly props: readonly (readonly [string, JsonValue])[];
}

interface ScenarioProjection {
  readonly catalog: JsonObject;
  readonly catalogs: readonly unknown[];
  readonly route: AuthoringScenarioRoute;
  readonly selection: AuthoringComponentSelection;
  readonly scenarios: readonly CapturedScenario[];
}

class ScenarioProjectionError extends Error {
  constructor(readonly reason: AuthoringScenarioModelRejectionReason) {
    super(reason);
  }
}

class ScenarioProjectionLimitError extends Error {}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
    throw new ScenarioProjectionError("catalog-invalid");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new ScenarioProjectionError("catalog-invalid");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new ScenarioProjectionError("catalog-invalid");
    }
  }
  return value as JsonObject;
}

function ownDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor?.enumerable !== true || !("value" in descriptor)) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  return descriptor.value;
}

function optionalOwnDataValue(object: JsonObject, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return undefined;
  if (descriptor.enumerable !== true || !("value" in descriptor)) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  return descriptor.value;
}

function hasOwnData(object: JsonObject, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return false;
  if (descriptor.enumerable !== true || !("value" in descriptor)) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  return true;
}

function dataArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new ScenarioProjectionError("catalog-invalid");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    (lengthDescriptor.value as number) < 0
  ) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  const length = lengthDescriptor.value as number;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== length + 1 ||
    keys.some(
      (key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
    )
  ) {
    throw new ScenarioProjectionError("catalog-invalid");
  }
  const captured: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !("value" in descriptor)) {
      throw new ScenarioProjectionError("catalog-invalid");
    }
    captured.push(descriptor.value);
  }
  return captured;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function captureRoute(route: AuthoringScenarioRoute): AuthoringScenarioRoute | undefined {
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
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
  try {
    const fields = exactOwnData(selection, [
      "capabilityId",
      "conditional",
      "displayName",
      "kind",
      "projectId",
      "sourceNodeId",
      "surfaceId",
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

function captureJsonValue(
  value: unknown,
  depth: number,
  budget: { count: number },
  ancestors: Set<object>,
): JsonValue {
  budget.count += 1;
  if (
    budget.count > SCENARIO_PROJECTION_LIMITS.maxValues ||
    depth > SCENARIO_PROJECTION_LIMITS.maxDepth
  ) {
    throw new ScenarioProjectionLimitError();
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") throw new ScenarioProjectionError("catalog-invalid");
  if (ancestors.has(value)) throw new ScenarioProjectionError("catalog-invalid");

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items = dataArray(value).map((item) =>
        captureJsonValue(item, depth + 1, budget, ancestors),
      );
      return Object.freeze(items);
    }

    const object = ownDataObject(value);
    const captured: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(object)) {
      captured[key] = captureJsonValue(ownDataValue(object, key), depth + 1, budget, ancestors);
    }
    return Object.freeze(captured);
  } finally {
    ancestors.delete(value);
  }
}

function selectedCatalog(model: CatalogAuthoringModel, capabilityId: string): JsonObject {
  const catalogs = dataArray(model.validationCatalogs);
  const matches: JsonObject[] = [];
  for (const value of catalogs) {
    const catalog = ownDataObject(value);
    const components = ownDataObject(ownDataValue(catalog, "components"));
    if (hasOwnData(components, capabilityId)) matches.push(catalog);
  }
  if (matches.length !== 1) throw new ScenarioProjectionError("catalog-invalid");
  return matches[0] as JsonObject;
}

function captureScenarios(catalog: JsonObject, capabilityId: string): readonly CapturedScenario[] {
  const components = ownDataObject(ownDataValue(catalog, "components"));
  const contractValue = optionalOwnDataValue(components, capabilityId);
  if (contractValue === undefined) throw new ScenarioProjectionError("selection-invalid");
  const contract = ownDataObject(contractValue);
  const authoringValue = optionalOwnDataValue(contract, "authoring");
  if (authoringValue === undefined) return Object.freeze([]);
  const authoring = ownDataObject(authoringValue);
  const scenariosValue = optionalOwnDataValue(authoring, "scenarios");
  if (scenariosValue === undefined) return Object.freeze([]);
  const scenarios = ownDataObject(scenariosValue);

  const budget = { count: 0 };
  return Object.freeze(
    Object.keys(scenarios)
      .sort(compareText)
      .map((id) => {
        if (!SCENARIO_ID.test(id)) throw new ScenarioProjectionError("catalog-invalid");
        const scenario = ownDataObject(ownDataValue(scenarios, id));
        if (Object.keys(scenario).some((key) => !SCENARIO_ALLOWED_KEYS.includes(key as never))) {
          throw new ScenarioProjectionError("catalog-invalid");
        }
        if (hasOwnData(scenario, "fixtures") || hasOwnData(scenario, "state")) {
          throw new ScenarioProjectionError("scenario-unsupported");
        }

        const descriptionValue = optionalOwnDataValue(scenario, "description");
        if (descriptionValue !== undefined && typeof descriptionValue !== "string") {
          throw new ScenarioProjectionError("catalog-invalid");
        }
        const propsValue = optionalOwnDataValue(scenario, "props");
        const props = propsValue === undefined ? Object.freeze({}) : ownDataObject(propsValue);
        const propEntries = Object.freeze(
          Object.keys(props)
            .sort(compareText)
            .map(
              (name) =>
                Object.freeze([
                  name,
                  captureJsonValue(ownDataValue(props, name), 0, budget, new Set()),
                ]) as readonly [string, JsonValue],
            ),
        );
        return Object.freeze({
          id,
          value: `catalog:${id}` as const,
          description: descriptionValue,
          props: propEntries,
        });
      }),
  );
}

function projectScenarios(
  model: CatalogAuthoringModel,
  route: AuthoringScenarioRoute,
  selection: AuthoringComponentSelection,
): ScenarioProjection {
  const capturedRoute = captureRoute(route);
  if (capturedRoute === undefined) throw new ScenarioProjectionError("route-invalid");
  const capturedSelection = captureSelection(selection);
  if (
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId
  ) {
    throw new ScenarioProjectionError("selection-invalid");
  }
  const selectionProjection = projectAuthoringSelection(
    capturedSelection,
    capturedRoute,
    model,
    undefined,
  );
  if (selectionProjection.status !== "unavailable") {
    throw new ScenarioProjectionError("selection-invalid");
  }
  const catalog = selectedCatalog(model, capturedSelection.capabilityId);
  return Object.freeze({
    catalog,
    catalogs: dataArray(model.validationCatalogs),
    route: capturedRoute,
    selection: capturedSelection,
    scenarios: captureScenarios(catalog, capturedSelection.capabilityId),
  });
}

function scenarioOption(scenario: CapturedScenario): AuthoringScenarioOption {
  return Object.freeze({
    kind: "catalog",
    value: scenario.value,
    scenarioId: scenario.id,
    label: scenario.id,
    description: scenario.description,
  });
}

function modelFailure(reason: AuthoringScenarioModelRejectionReason): AuthoringScenarioModelResult {
  return Object.freeze({ status: "rejected", reason });
}

function previewFailure(
  reason: AuthoringScenarioPreviewFailureReason,
): AuthoringScenarioPreviewFailure {
  return Object.freeze({ ok: false, reason });
}

function capturedCurrentPreview(
  preview: AuthoringPreviewBundleResult,
): AuthoringPreviewBundleSuccess | undefined {
  const fields = exactOwnData(preview, ["bundle", "ok", "revision"]);
  if (fields === undefined || fields.ok !== true || !isNonEmptyString(fields.revision)) {
    return undefined;
  }
  const bundle = ownDataObject(fields.bundle);
  if (ownDataValue(bundle, "revision") !== fields.revision) return undefined;
  return preview as AuthoringPreviewBundleSuccess;
}

/**
 * Projects authored values plus every exact Catalog-declared props-only scenario for one selection.
 *
 * @remarks Route, Source identity, component capability, Catalog tuple, and scenario declarations
 * are reauthorized from own enumerable data. Scenario `state` and `fixtures` remain unsupported and
 * reject the complete projection instead of being partially or approximately interpreted.
 */
export function prepareAuthoringScenarioModel(
  model: CatalogAuthoringModel,
  route: AuthoringScenarioRoute,
  selection: AuthoringComponentSelection | null,
): AuthoringScenarioModelResult {
  if (selection === null) return Object.freeze({ status: "idle" });
  try {
    const projection = projectScenarios(model, route, selection);
    return Object.freeze({
      status: "ready",
      route: projection.route,
      selection: projection.selection,
      options: Object.freeze([
        Object.freeze({
          kind: "source",
          value: AUTHORING_SOURCE_SCENARIO_VALUE,
          scenarioId: null,
          label: "Source values",
          description: "Current authored component properties.",
        }),
        ...projection.scenarios.map(scenarioOption),
      ]),
    });
  } catch (error) {
    if (error instanceof ScenarioProjectionLimitError) return modelFailure("projection-limit");
    return modelFailure(
      error instanceof ScenarioProjectionError ? error.reason : "catalog-invalid",
    );
  }
}

/**
 * Prepares an authoring-only scenario Source and Bundle without changing the session Source/Bundle.
 *
 * @remarks The current document is freshly re-admitted with its exact Catalog before selection and
 * scenario authorization. Catalog scenario props are detached and applied only as shallow top-level
 * replacements through public Editor Core commands. No scenario data enters the authored Source,
 * the current publishable preview, persistence, activation, host operations, or Runtime state.
 */
export function prepareAuthoringScenarioPreview(
  document: DesenEditorDocument,
  currentPreview: AuthoringPreviewBundleResult,
  model: CatalogAuthoringModel,
  route: AuthoringScenarioRoute,
  selection: AuthoringComponentSelection,
  scenarioValue: AuthoringScenarioValue,
  catalogPackages: readonly PublishCatalogPackageCandidate[],
): AuthoringScenarioPreviewResult {
  try {
    const initialProjection = projectScenarios(model, route, selection);
    const freshModel = prepareCatalogAuthoringModel(initialProjection.catalogs, document);
    if (!freshModel.ok) {
      return previewFailure(
        freshModel.reason === "catalog-invalid"
          ? "catalog-invalid"
          : freshModel.reason === "projection-limit"
            ? "projection-limit"
            : "document-invalid",
      );
    }
    const projection = projectScenarios(freshModel.model, route, selection);

    const admittedCurrentPreview = capturedCurrentPreview(currentPreview);
    if (admittedCurrentPreview === undefined) return previewFailure("preview-unavailable");
    const baselinePreview = prepareAuthoringPreviewBundle(document, catalogPackages);
    if (!baselinePreview.ok) return previewFailure("document-invalid");
    if (baselinePreview.revision !== admittedCurrentPreview.revision) {
      return previewFailure("preview-unavailable");
    }

    if (scenarioValue === AUTHORING_SOURCE_SCENARIO_VALUE) {
      return Object.freeze({
        ok: true,
        scenarioDocument: document,
        preview: admittedCurrentPreview,
      });
    }
    if (typeof scenarioValue !== "string") return previewFailure("scenario-invalid");
    const scenario = projection.scenarios.find(({ value }) => value === scenarioValue);
    if (scenario === undefined) return previewFailure("scenario-invalid");

    let scenarioDocument = document;
    for (const [name, value] of scenario.props) {
      const edited = setDesenEditorOwnerProp(scenarioDocument, {
        surfaceId: projection.route.surfaceId,
        ownerId: projection.selection.sourceNodeId,
        name,
        value,
      });
      if (!edited.ok) return previewFailure("scenario-invalid");
      scenarioDocument = edited.document;
    }
    const preview = prepareAuthoringPreviewBundle(scenarioDocument, catalogPackages);
    if (!preview.ok) return previewFailure("scenario-invalid");
    return Object.freeze({ ok: true, scenarioDocument, preview });
  } catch (error) {
    if (error instanceof ScenarioProjectionLimitError) return previewFailure("projection-limit");
    return previewFailure(
      error instanceof ScenarioProjectionError ? error.reason : "catalog-invalid",
    );
  }
}
