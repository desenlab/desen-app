import { createDesenEditorDocument } from "@desen/editor-core";

import { createEditableProjectDiagnostic } from "./diagnostics.js";
import { captureDesignSystemJson, InertJsonCaptureError } from "./inert-json.js";
import { admitEditableProjectRecipeGraph } from "./recipe-graph.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { EditableProjectDiagnostic } from "./diagnostics.js";
import type { DesignSystemJsonObject, DesignSystemJsonValue } from "./inert-json.js";
import type { EditableProjectRecipeGraph } from "./master-instance-types.js";

/** Exact kind discriminator for the App-owned editable-project envelope. */
export const EDITABLE_PROJECT_KIND = "desen.editable-project" as const;

/** Current and only admitted editable-project schema version. */
export const EDITABLE_PROJECT_SCHEMA_VERSION = 2 as const;

/** Finite collection and identifier limits for the editable-project schema. */
export const EDITABLE_PROJECT_LIMITS = Object.freeze({
  maxIdentifierCodeUnits: 128,
  maxLabelCodeUnits: 512,
  maxTokenSources: 32,
  maxRecipes: 2_048,
  maxAssets: 2_048,
  maxConnectionIntents: 2_048,
});

/** One named DTCG document retained in the editable project. */
export interface EditableProjectTokenSource {
  /** Stable project-local source identity. */
  readonly id: string;
  /** Complete inert DTCG token document, preserved without destructive normalization. */
  readonly document: DesignSystemJsonObject;
  /** Optional human-facing description. */
  readonly description?: string;
  /** Namespaced inert metadata not interpreted by Design System Core. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Legacy inert recipe metadata, independent of the explicit master/instance graph. */
export interface EditableProjectRecipeMetadata {
  /** Stable project-local recipe identity. */
  readonly id: string;
  /** Human-facing recipe name. */
  readonly name: string;
  /** Optional human-facing description. */
  readonly description?: string;
  /** Namespaced inert metadata; no graph or materializer semantics are implied. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Metadata placeholder for an asset whose bytes and handles remain a later authority. */
export interface EditableProjectAssetMetadata {
  /** Stable project-local asset identity. */
  readonly id: string;
  /** Human-facing asset name. */
  readonly name: string;
  /** Non-executable asset category. */
  readonly kind: "font" | "icon" | "image";
  /** Optional declared media type; this does not admit or load bytes. */
  readonly mediaType?: string;
  /** Namespaced inert metadata not interpreted by Design System Core. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Incomplete and deliberately non-executable connection intent retained beside valid design. */
export interface EditableProjectConnectionIntent {
  /** Stable project-local intent identity. */
  readonly id: string;
  /** Fixed state proving this record grants no executable connection authority. */
  readonly status: "draft";
  /** Existing or proposed Source surface identity supplied by the author. */
  readonly surfaceId: string;
  /** Optional Source node identity supplied by the author. */
  readonly nodeId?: string;
  /** Optional human-facing label. */
  readonly label?: string;
  /** Optional plain author note; it is never parsed as code or a host binding. */
  readonly note?: string;
  /** Namespaced inert metadata not interpreted as credentials, handlers or endpoints. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Exact design-system data retained by the historical version-1 envelope. */
export interface EditableProjectDesignSystemV1 {
  /** Ordered project token sources available to explicit resolver selections. */
  readonly tokenSources: readonly EditableProjectTokenSource[];
  /** Inert recipe metadata with no graph or materialization semantics. */
  readonly recipes: readonly EditableProjectRecipeMetadata[];
  /** Inert asset metadata; asset bytes and imports remain a later task. */
  readonly assets: readonly EditableProjectAssetMetadata[];
  /** Namespaced inert metadata not interpreted by Design System Core. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Current design-system data with explicit authoring relationships beside ordinary Source. */
export interface EditableProjectDesignSystem extends EditableProjectDesignSystemV1 {
  /** Admitted definitions and linked instances whose materializations equal stored Source. */
  readonly recipeGraph: EditableProjectRecipeGraph;
}

/** Historical version-1 App-owned project accepted only through explicit migration. */
export interface EditableProjectRecordV1 {
  /** App-owned envelope discriminator. */
  readonly kind: typeof EDITABLE_PROJECT_KIND;
  /** Exact finite envelope schema version. */
  readonly schemaVersion: 1;
  /** Stable project identity. */
  readonly id: string;
  /** Exact structurally admitted canonical DESEN Source. */
  readonly source: DesenEditorDocument;
  /** Editable design-system documents and inert metadata. */
  readonly designSystem: EditableProjectDesignSystemV1;
  /** Durable incomplete connection notes with no runtime authority. */
  readonly connectionIntents: readonly EditableProjectConnectionIntent[];
  /** Namespaced inert project metadata preserved losslessly. */
  readonly extensions?: DesignSystemJsonObject;
}

/** Current App-owned project with explicit authoring graph semantics outside DESEN Source. */
export interface EditableProjectRecordV2 extends Omit<
  EditableProjectRecordV1,
  "schemaVersion" | "designSystem"
> {
  /** Exact current envelope schema version. */
  readonly schemaVersion: 2;
  /** Editable design-system data and verified master/instance relationships. */
  readonly designSystem: EditableProjectDesignSystem;
}

/** Current editable-project schema admitted by this package. */
export type EditableProjectRecord = EditableProjectRecordV2;

/** Successful editable-project admission. */
export interface EditableProjectAdmissionSuccess {
  /** Confirms that a complete record is available. */
  readonly ok: true;
  /** Detached recursively immutable current record. */
  readonly record: EditableProjectRecord;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed editable-project admission with no partial record. */
export interface EditableProjectAdmissionFailure {
  /** Confirms that no record was admitted. */
  readonly ok: false;
  /** Deterministic diagnostics describing the rejected candidate. */
  readonly diagnostics: readonly EditableProjectDiagnostic[];
}

/** Result of admitting an unknown value as a current editable project. */
export type EditableProjectAdmissionResult =
  EditableProjectAdmissionFailure | EditableProjectAdmissionSuccess;

type KnownProjectAdmissionResult =
  | EditableProjectAdmissionFailure
  | {
      readonly ok: true;
      readonly record: EditableProjectRecordV1 | EditableProjectRecordV2;
      readonly diagnostics: readonly [];
    };

type MutableJsonObject = Record<string, DesignSystemJsonValue>;

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const IDENTIFIER = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;

function isObject(value: unknown): value is DesignSystemJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: DesignSystemJsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const accepted = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => accepted.has(key))
  );
}

function failure(
  code: EditableProjectDiagnostic["code"],
  pointer: string,
  message: string,
): EditableProjectAdmissionFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([createEditableProjectDiagnostic(code, pointer, message)]),
  });
}

function assertIdentifier(value: DesignSystemJsonValue | undefined): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function assertLabel(value: DesignSystemJsonValue | undefined): value is string {
  return typeof value === "string" && value.length <= EDITABLE_PROJECT_LIMITS.maxLabelCodeUnits;
}

function optionalLabel(value: DesignSystemJsonValue | undefined): value is string | undefined {
  return value === undefined || assertLabel(value);
}

function optionalExtensions(
  value: DesignSystemJsonValue | undefined,
): value is DesignSystemJsonObject | undefined {
  return value === undefined || isObject(value);
}

function uniqueIds(values: readonly { readonly id: string }[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

function parseTokenSources(
  value: DesignSystemJsonValue | undefined,
): readonly EditableProjectTokenSource[] | undefined {
  if (!Array.isArray(value) || value.length > EDITABLE_PROJECT_LIMITS.maxTokenSources)
    return undefined;
  const output: EditableProjectTokenSource[] = [];
  for (const candidate of value) {
    if (
      !isObject(candidate) ||
      !exactKeys(candidate, ["id", "document"], ["description", "extensions"]) ||
      !assertIdentifier(candidate.id) ||
      !isObject(candidate.document) ||
      !optionalLabel(candidate.description) ||
      !optionalExtensions(candidate.extensions)
    ) {
      return undefined;
    }
    output.push(candidate as unknown as EditableProjectTokenSource);
  }
  return uniqueIds(output) ? Object.freeze(output) : undefined;
}

function parseRecipes(
  value: DesignSystemJsonValue | undefined,
): readonly EditableProjectRecipeMetadata[] | undefined {
  if (!Array.isArray(value) || value.length > EDITABLE_PROJECT_LIMITS.maxRecipes) return undefined;
  const output: EditableProjectRecipeMetadata[] = [];
  for (const candidate of value) {
    if (
      !isObject(candidate) ||
      !exactKeys(candidate, ["id", "name"], ["description", "extensions"]) ||
      !assertIdentifier(candidate.id) ||
      !assertLabel(candidate.name) ||
      !optionalLabel(candidate.description) ||
      !optionalExtensions(candidate.extensions)
    ) {
      return undefined;
    }
    output.push(candidate as unknown as EditableProjectRecipeMetadata);
  }
  return uniqueIds(output) ? Object.freeze(output) : undefined;
}

function parseAssets(
  value: DesignSystemJsonValue | undefined,
): readonly EditableProjectAssetMetadata[] | undefined {
  if (!Array.isArray(value) || value.length > EDITABLE_PROJECT_LIMITS.maxAssets) return undefined;
  const output: EditableProjectAssetMetadata[] = [];
  for (const candidate of value) {
    if (
      !isObject(candidate) ||
      !exactKeys(candidate, ["id", "name", "kind"], ["mediaType", "extensions"]) ||
      !assertIdentifier(candidate.id) ||
      !assertLabel(candidate.name) ||
      (candidate.kind !== "font" && candidate.kind !== "icon" && candidate.kind !== "image") ||
      (candidate.mediaType !== undefined &&
        (typeof candidate.mediaType !== "string" || !MEDIA_TYPE.test(candidate.mediaType))) ||
      !optionalExtensions(candidate.extensions)
    ) {
      return undefined;
    }
    output.push(candidate as unknown as EditableProjectAssetMetadata);
  }
  return uniqueIds(output) ? Object.freeze(output) : undefined;
}

function parseConnectionIntents(
  value: DesignSystemJsonValue | undefined,
): readonly EditableProjectConnectionIntent[] | undefined {
  if (!Array.isArray(value) || value.length > EDITABLE_PROJECT_LIMITS.maxConnectionIntents) {
    return undefined;
  }
  const output: EditableProjectConnectionIntent[] = [];
  for (const candidate of value) {
    if (
      !isObject(candidate) ||
      !exactKeys(
        candidate,
        ["id", "status", "surfaceId"],
        ["nodeId", "label", "note", "extensions"],
      ) ||
      !assertIdentifier(candidate.id) ||
      candidate.status !== "draft" ||
      !assertIdentifier(candidate.surfaceId) ||
      (candidate.nodeId !== undefined && !assertIdentifier(candidate.nodeId)) ||
      !optionalLabel(candidate.label) ||
      !optionalLabel(candidate.note) ||
      !optionalExtensions(candidate.extensions)
    ) {
      return undefined;
    }
    output.push(candidate as unknown as EditableProjectConnectionIntent);
  }
  return uniqueIds(output) ? Object.freeze(output) : undefined;
}

function mapCaptureFailure(error: InertJsonCaptureError): EditableProjectAdmissionFailure {
  const code =
    error.code === "JSON_LIMIT_EXCEEDED"
      ? "PROJECT_LIMIT_EXCEEDED"
      : error.code === "UNSAFE_JSON_VALUE"
        ? "UNSAFE_PROJECT_VALUE"
        : "INVALID_PROJECT";
  return failure(code, error.pointer, error.message);
}

function admitKnownProjectRecord(
  input: unknown,
  allowLegacy: boolean,
): KnownProjectAdmissionResult {
  let captured: DesignSystemJsonValue;
  try {
    captured = captureDesignSystemJson(input);
  } catch (error) {
    return error instanceof InertJsonCaptureError
      ? mapCaptureFailure(error)
      : failure("INVALID_PROJECT", "", "Editable project capture failed.");
  }

  if (!isObject(captured)) {
    return failure("INVALID_PROJECT", "", "Editable project root fields are invalid.");
  }
  if (captured.kind !== EDITABLE_PROJECT_KIND) {
    return failure("INVALID_PROJECT", "/kind", "Editable project kind is invalid.");
  }
  if (!Object.hasOwn(captured, "schemaVersion")) {
    return failure(
      "INVALID_PROJECT",
      "/schemaVersion",
      "Editable project schema version is missing.",
    );
  }
  if (
    captured.schemaVersion !== EDITABLE_PROJECT_SCHEMA_VERSION &&
    !(allowLegacy && captured.schemaVersion === 1)
  ) {
    return failure(
      "UNSUPPORTED_PROJECT_VERSION",
      "/schemaVersion",
      "Editable project schema version is not supported.",
    );
  }
  if (
    !exactKeys(
      captured,
      ["kind", "schemaVersion", "id", "source", "designSystem", "connectionIntents"],
      ["extensions"],
    )
  ) {
    return failure("INVALID_PROJECT", "", "Editable project root fields are invalid.");
  }
  if (!assertIdentifier(captured.id)) {
    return failure("INVALID_PROJECT", "/id", "Editable project id is invalid.");
  }
  if (!optionalExtensions(captured.extensions)) {
    return failure("INVALID_PROJECT", "/extensions", "Project extensions must be an object.");
  }

  const source = createDesenEditorDocument(captured.source);
  if (!source.ok) {
    const pointer = source.diagnostics[0]?.pointer ?? "";
    return failure(
      "INVALID_SOURCE",
      `/source${pointer}`,
      "Editable project Source failed frozen DESEN structural admission.",
    );
  }

  if (
    !isObject(captured.designSystem) ||
    !exactKeys(
      captured.designSystem,
      captured.schemaVersion === 1
        ? ["tokenSources", "recipes", "assets"]
        : ["tokenSources", "recipes", "assets", "recipeGraph"],
      ["extensions"],
    ) ||
    !optionalExtensions(captured.designSystem.extensions)
  ) {
    return failure("INVALID_PROJECT", "/designSystem", "Design-system fields are invalid.");
  }
  const tokenSources = parseTokenSources(captured.designSystem.tokenSources);
  const recipes = parseRecipes(captured.designSystem.recipes);
  const assets = parseAssets(captured.designSystem.assets);
  const connectionIntents = parseConnectionIntents(captured.connectionIntents);
  if (tokenSources === undefined) {
    return failure("INVALID_PROJECT", "/designSystem/tokenSources", "Token sources are invalid.");
  }
  if (recipes === undefined) {
    return failure("INVALID_PROJECT", "/designSystem/recipes", "Recipe metadata is invalid.");
  }
  if (assets === undefined) {
    return failure("INVALID_PROJECT", "/designSystem/assets", "Asset metadata is invalid.");
  }
  if (connectionIntents === undefined) {
    return failure("INVALID_PROJECT", "/connectionIntents", "Connection intents are invalid.");
  }

  let designSystem = captured.designSystem;
  if (captured.schemaVersion === EDITABLE_PROJECT_SCHEMA_VERSION) {
    const graph = admitEditableProjectRecipeGraph(designSystem.recipeGraph, source.document);
    if (!graph.ok) return Object.freeze({ ok: false, diagnostics: graph.diagnostics });
    designSystem = {
      ...designSystem,
      recipeGraph: graph.graph as unknown as DesignSystemJsonValue,
    };
  }

  const record: MutableJsonObject = {
    ...captured,
    source: source.document as unknown as DesignSystemJsonValue,
    designSystem,
  };
  const admitted = captureDesignSystemJson(record) as unknown as
    EditableProjectRecordV1 | EditableProjectRecordV2;
  return Object.freeze({ ok: true, record: admitted, diagnostics: EMPTY_DIAGNOSTICS });
}

/** Internal exact-version admission used only by the closed migration registry. */
export function admitEditableProjectRecordForMigration(
  input: unknown,
): KnownProjectAdmissionResult {
  return admitKnownProjectRecord(input, true);
}

/**
 * Admits an unknown value as the current finite editable-project envelope.
 *
 * @remarks Source remains structurally admitted DESEN 0.1.0 data. Graph admission verifies its
 * authoring relationships against that Source; inert token documents, legacy recipe metadata,
 * assets and draft intents acquire no runtime authority. Version 1 requires explicit migration.
 */
export function admitEditableProjectRecord(input: unknown): EditableProjectAdmissionResult {
  const result = admitKnownProjectRecord(input, false);
  if (!result.ok) return result;
  if (result.record.schemaVersion !== EDITABLE_PROJECT_SCHEMA_VERSION) {
    return failure("UNSUPPORTED_PROJECT_VERSION", "/schemaVersion", "Current schema is required.");
  }
  return Object.freeze({ ok: true, record: result.record, diagnostics: EMPTY_DIAGNOSTICS });
}
