import {
  createDesenEditorDocument,
  createDesenEditorContinuousValidator,
  deleteDesenEditorOwnerStyleProperty,
  deleteDesenEditorVariant,
  deleteDesenEditorVariantStyleProperty,
  insertDesenEditorVariant,
  setDesenEditorOwnerStyleProperty,
  setDesenEditorVariantStyleProperty,
} from "@desen/editor-core";
import { canonicalizeJson } from "@desen/protocol";
import { isStarterCapabilityVisualStyleValue } from "@desen/starter-catalog-web";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";
import { projectAuthoringSelection } from "./authoring-selection.js";

import type { JsonPrimitive, JsonValue } from "@desen/catalog-sdk";
import type {
  DesenEditorContentEditResult,
  DesenEditorContentValue,
  DesenEditorContentVariant,
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
} from "@desen/editor-core";
import type {
  AuthoringStylePartContract,
  CatalogAuthoringModel,
  CatalogComponentSummary,
} from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

type JsonObject = Readonly<Record<string, unknown>>;
type EditorNode = DesenEditorDocument["surfaces"][string]["root"];
type EditorVariant = NonNullable<EditorNode["variants"]>[number];

const BASE_STYLE_STATE = "base";
const RESPONSIVE_VARIANT_EXTENSION = "run.desen.app/t12-responsive";
const RESPONSIVE_VARIANT_VERSION = 1;
const NAMED_VARIANT_EXTENSION = "run.desen.app/t16-variant";
const NAMED_VARIANT_VERSION = 1;
const MAX_TOKEN_OPTIONS = 1_024;

/** Exact App route that may authorize a style projection or mutation. */
export interface AuthoringStyleRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** The only responsive targets this boundary can author. No caller-supplied predicates are accepted. */
export type AuthoringResponsiveBreakpointId = "tablet" | "mobile";

/** One finite, app-owned responsive breakpoint definition. */
export interface AuthoringResponsiveBreakpoint {
  readonly id: AuthoringResponsiveBreakpointId;
  readonly label: string;
  /** The exact inclusive `env.viewport.width` upper bound authored into Source. */
  readonly maxWidth: number;
}

/**
 * Fixed responsive breakpoints owned by this authoring boundary.
 *
 * @remarks Base style is the desktop/default layer. Tablet and mobile are represented by exact
 * `lte(env.viewport.width, maxWidth)` node variants, never by CSS media strings.
 */
export const AUTHORING_RESPONSIVE_BREAKPOINTS: readonly AuthoringResponsiveBreakpoint[] =
  Object.freeze([
    Object.freeze({ id: "tablet", label: "Tablet", maxWidth: 1_024 }),
    Object.freeze({ id: "mobile", label: "Mobile", maxWidth: 767 }),
  ]);

/** The exact selectable style layer. A raw `when` predicate is deliberately not part of this API. */
export type AuthoringStyleTarget =
  | Readonly<{ readonly kind: "base" }>
  | Readonly<{ readonly kind: "visual-state"; readonly state: string }>
  | Readonly<{ readonly kind: "variant"; readonly index: number }>
  | Readonly<{
      readonly kind: "breakpoint";
      readonly breakpoint: AuthoringResponsiveBreakpointId;
    }>;

/** Explicit source category of a token option presented by a caller-owned token resolver. */
export type AuthoringStyleTokenType =
  "border" | "color" | "dimension" | "number" | "shadow" | "typography";

/**
 * One caller-resolved token option. `resolvedValue` must be a concrete JSON literal compatible
 * with the selected Catalog style-property schema; the boundary never imports or assumes a token
 * registry, token source, or DTCG representation.
 */
export interface AuthoringResolvedStyleToken {
  readonly path: string;
  readonly type: AuthoringStyleTokenType;
  readonly resolvedValue: JsonValue;
}

/** Honest state of one Source style leaf. Dynamic forms outside exact token references stay read-only. */
export type AuthoringStyleValueState =
  | Readonly<{ readonly kind: "absent" }>
  | Readonly<{ readonly kind: "literal"; readonly value: JsonValue }>
  | Readonly<{
      readonly kind: "token";
      readonly path: string;
      readonly type: AuthoringStyleTokenType;
      readonly resolvedValue: JsonValue;
    }>
  | Readonly<{ readonly kind: "unresolved-token"; readonly path: string }>
  | Readonly<{ readonly kind: "dynamic"; readonly value: JsonValue }>;

/** Conservative presentation hint. The exact schema remains authoritative for every edit. */
export type AuthoringStyleControlKind =
  "boolean" | "enum" | "integer" | "number" | "string" | "structured-json";

/** One Catalog-authorized, directly addressable base visual-state style property. */
export interface AuthoringStyleControl {
  readonly part: string;
  readonly property: string;
  readonly description: string | undefined;
  readonly kind: AuthoringStyleControlKind;
  /**
   * Exact T02 token value families that can be selected for this leaf.
   *
   * @remarks An empty list is intentional: a Catalog property can still accept typed literals
   * while the T02 profile has no semantically equivalent token family (for example a gradient or
   * an enum). The UI must not offer a token that the sealed mutation boundary would reject.
   */
  readonly tokenTypes: readonly AuthoringStyleTokenType[];
  /** Exact detached JSON Schema for this declared property, never a generic CSS descriptor. */
  readonly propertiesSchema: JsonObject;
  readonly base: AuthoringStyleValueState;
  /** Declared non-base visual states. Unknown state names never enter this projection. */
  readonly visualStates?: readonly Readonly<{
    readonly state: string;
    readonly value: AuthoringStyleValueState;
  }>[];
  /** T16 named variants that may receive closed style overrides for this exact leaf. */
  readonly variants?: readonly Readonly<{
    readonly index: number;
    readonly name: string;
    readonly value: AuthoringStyleValueState;
  }>[];
  readonly responsive: readonly AuthoringResponsiveStyleValue[];
}

/** One exact finite breakpoint value projection for an individual control. */
export interface AuthoringResponsiveStyleValue {
  readonly breakpoint: AuthoringResponsiveBreakpoint;
  /** `null` means no boundary-owned exact responsive variant exists for this breakpoint. */
  readonly variantIndex: number | null;
  readonly value: AuthoringStyleValueState;
}

/** A Catalog-declared semantic style part projected into only closed, directly addressable controls. */
export interface AuthoringStylePart {
  readonly name: string;
  readonly description: string | undefined;
  /** False when the declared JSON Schema cannot safely enumerate a closed property map. */
  readonly controlsAvailable: boolean;
  readonly controls: readonly AuthoringStyleControl[];
}

/** Observability only: variants the boundary deliberately leaves untouched. */
export interface AuthoringUnmanagedResponsiveVariant {
  readonly index: number;
  readonly reason: "ambiguous-owned-breakpoint" | "malformed-owned-breakpoint" | "unmanaged";
}

/** Ready read model for one exact, route-valid Source component selection. */
export interface AuthoringStyleReadyModel {
  readonly status: "ready";
  readonly component: CatalogComponentSummary;
  readonly selection: AuthoringComponentSelection;
  readonly parts: readonly AuthoringStylePart[];
  /** Existing variants that were not admitted as exact T12 breakpoint overrides. */
  readonly unmanagedResponsiveVariants: readonly AuthoringUnmanagedResponsiveVariant[];
}

/** Fail-closed style model outcome. */
export type AuthoringStyleModelResult =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | AuthoringStyleReadyModel;

/** Closed mutation surface for a single declared style-property leaf. */
export type AuthoringStyleEdit =
  | Readonly<{
      readonly kind: "set-literal";
      readonly target: AuthoringStyleTarget;
      readonly part: string;
      readonly property: string;
      readonly value: JsonValue;
    }>
  | Readonly<{
      readonly kind: "set-token";
      readonly target: AuthoringStyleTarget;
      readonly part: string;
      readonly property: string;
      readonly token: string;
    }>
  | Readonly<{
      readonly kind: "reset";
      readonly target: AuthoringStyleTarget;
      readonly part: string;
      readonly property: string;
    }>;

/** Atomic Source mutation success. */
export interface AuthoringStyleEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
}

/** Stable reason why a style mutation produced no Source document. */
export type AuthoringStyleEditFailureReason =
  | "catalog-invalid"
  | "control-unavailable"
  | "edit-rejected"
  | "responsive-variant-ambiguous"
  | "responsive-variant-invalid"
  | "selection-invalid"
  | "source-invalid"
  | "token-incompatible"
  | "token-unknown"
  | "value-invalid";

/** Atomic failure: no candidate document is returned. */
export interface AuthoringStyleEditFailure {
  readonly ok: false;
  readonly reason: AuthoringStyleEditFailureReason;
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete outcome of one App-owned style mutation. */
export type AuthoringStyleEditResult = AuthoringStyleEditSuccess | AuthoringStyleEditFailure;

type CapturedStyleTarget =
  | Readonly<{ readonly kind: "base" }>
  | Readonly<{ readonly kind: "visual-state"; readonly state: string }>
  | Readonly<{ readonly kind: "variant"; readonly index: number }>
  | Readonly<{
      readonly kind: "breakpoint";
      readonly breakpoint: AuthoringResponsiveBreakpointId;
    }>;

type CapturedStyleEdit =
  | Readonly<{
      readonly kind: "set-literal";
      readonly target: CapturedStyleTarget;
      readonly part: string;
      readonly property: string;
      readonly value: JsonValue;
    }>
  | Readonly<{
      readonly kind: "set-token";
      readonly target: CapturedStyleTarget;
      readonly part: string;
      readonly property: string;
      readonly token: string;
    }>
  | Readonly<{
      readonly kind: "reset";
      readonly target: CapturedStyleTarget;
      readonly part: string;
      readonly property: string;
    }>;

interface ResponsiveVariantMatch {
  readonly breakpoint: AuthoringResponsiveBreakpoint;
  readonly index: number;
  readonly variant: EditorVariant;
}

interface ResponsiveVariantInventory {
  readonly exactByBreakpoint: ReadonlyMap<AuthoringResponsiveBreakpointId, ResponsiveVariantMatch>;
  readonly ambiguousBreakpoints: ReadonlySet<AuthoringResponsiveBreakpointId>;
  readonly malformedMarkerIndexes: ReadonlySet<number>;
  /**
   * True when otherwise exact App-owned responsive variants would cascade from a narrower
   * breakpoint into a wider one. Runtime applies matching variants in document order, so such a
   * Source would let the wider tablet override win at a mobile viewport.
   */
  readonly nonCanonicalOrder: boolean;
  readonly unmanaged: readonly AuthoringUnmanagedResponsiveVariant[];
}

const NO_STYLE_VALUE = Object.freeze({ kind: "absent" }) as Readonly<{ readonly kind: "absent" }>;

function tokenTypes(
  ...types: readonly AuthoringStyleTokenType[]
): readonly AuthoringStyleTokenType[] {
  return Object.freeze([...types]);
}

/**
 * Finite semantic mapping from the reviewed starter Web profile to the T02 token families.
 *
 * This list intentionally lives beside the sealed edit boundary instead of being inferred from
 * JSON Schema shapes. Both a DTCG dimension and a number can be JSON numbers in some schemas,
 * but they do not carry the same design-system meaning. Properties with no matching T02 family
 * remain literal-only rather than accepting an arbitrary token by coincidence.
 */
const TOKEN_TYPES_BY_PROPERTY: Readonly<Record<string, readonly AuthoringStyleTokenType[]>> =
  Object.freeze({
    backgroundColor: tokenTypes("color"),
    border: tokenTypes("border"),
    borderBottomColor: tokenTypes("color"),
    borderBottomLeftRadius: tokenTypes("dimension"),
    borderBottomRightRadius: tokenTypes("dimension"),
    borderBottomWidth: tokenTypes("dimension"),
    borderColor: tokenTypes("color"),
    borderLeftColor: tokenTypes("color"),
    borderLeftWidth: tokenTypes("dimension"),
    borderRadius: tokenTypes("dimension"),
    borderRightColor: tokenTypes("color"),
    borderRightWidth: tokenTypes("dimension"),
    borderTopColor: tokenTypes("color"),
    borderTopLeftRadius: tokenTypes("dimension"),
    borderTopRightRadius: tokenTypes("dimension"),
    borderTopWidth: tokenTypes("dimension"),
    borderWidth: tokenTypes("dimension"),
    boxShadow: tokenTypes("shadow"),
    color: tokenTypes("color"),
    columnGap: tokenTypes("dimension"),
    flexGrow: tokenTypes("number"),
    flexShrink: tokenTypes("number"),
    fontSize: tokenTypes("dimension"),
    fontWeight: tokenTypes("number"),
    gap: tokenTypes("dimension"),
    gridColumns: tokenTypes("number"),
    height: tokenTypes("dimension"),
    insetBottom: tokenTypes("dimension"),
    insetLeft: tokenTypes("dimension"),
    insetRight: tokenTypes("dimension"),
    insetTop: tokenTypes("dimension"),
    letterSpacing: tokenTypes("dimension"),
    lineHeight: tokenTypes("number"),
    margin: tokenTypes("dimension"),
    marginBlock: tokenTypes("dimension"),
    marginBottom: tokenTypes("dimension"),
    marginInline: tokenTypes("dimension"),
    marginLeft: tokenTypes("dimension"),
    marginRight: tokenTypes("dimension"),
    marginTop: tokenTypes("dimension"),
    maxHeight: tokenTypes("dimension"),
    maxWidth: tokenTypes("dimension"),
    minHeight: tokenTypes("dimension"),
    minWidth: tokenTypes("dimension"),
    opacity: tokenTypes("number"),
    padding: tokenTypes("dimension"),
    paddingBlock: tokenTypes("dimension"),
    paddingBottom: tokenTypes("dimension"),
    paddingInline: tokenTypes("dimension"),
    paddingLeft: tokenTypes("dimension"),
    paddingRight: tokenTypes("dimension"),
    paddingTop: tokenTypes("dimension"),
    rotate: tokenTypes("number"),
    rowGap: tokenTypes("dimension"),
    scaleX: tokenTypes("number"),
    scaleY: tokenTypes("number"),
    translateX: tokenTypes("dimension"),
    translateY: tokenTypes("dimension"),
    typography: tokenTypes("typography"),
    width: tokenTypes("dimension"),
    zIndex: tokenTypes("number"),
  });
const NO_TOKEN_TYPES = Object.freeze([]) as readonly AuthoringStyleTokenType[];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function captureExactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
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
  } catch {
    return undefined;
  }
}

function ownDataObject(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
    }
    return value as JsonObject;
  } catch {
    return undefined;
  }
}

function ownDataValue(record: JsonObject, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function hasOwnDataValue(record: JsonObject, key: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor?.enumerable === true && "value" in descriptor;
  } catch {
    return false;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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

function containsDynamicValue(value: JsonValue): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return value.some((item) => containsDynamicValue(item));
  for (const key of Object.keys(value)) {
    if (key.startsWith("$")) return true;
    if (containsDynamicValue((value as Readonly<Record<string, JsonValue>>)[key] as JsonValue)) {
      return true;
    }
  }
  return false;
}

function captureStyleRoute(route: AuthoringStyleRoute): AuthoringStyleRoute | undefined {
  const fields = captureExactOwnData(route, ["projectId", "surfaceId"]);
  if (
    fields === undefined ||
    !isNonEmptyString(fields.projectId) ||
    !isNonEmptyString(fields.surfaceId)
  ) {
    return undefined;
  }
  return Object.freeze({ projectId: fields.projectId, surfaceId: fields.surfaceId });
}

function captureStyleSelection(
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
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
}

function breakpointFor(value: unknown): AuthoringResponsiveBreakpoint | undefined {
  return AUTHORING_RESPONSIVE_BREAKPOINTS.find(({ id }) => id === value);
}

function captureStyleTarget(value: unknown): CapturedStyleTarget | undefined {
  const kind = captureExactOwnData(value, ["kind"]);
  if (kind !== undefined && kind.kind === "base") return Object.freeze({ kind: "base" });

  const visualState = captureExactOwnData(value, ["kind", "state"]);
  if (visualState?.kind === "visual-state" && isNonEmptyString(visualState.state)) {
    return Object.freeze({ kind: "visual-state", state: visualState.state });
  }

  const variant = captureExactOwnData(value, ["kind", "index"]);
  if (
    variant?.kind === "variant" &&
    typeof variant.index === "number" &&
    Number.isInteger(variant.index) &&
    variant.index >= 0
  ) {
    return Object.freeze({ kind: "variant", index: variant.index });
  }

  const breakpoint = captureExactOwnData(value, ["kind", "breakpoint"]);
  if (breakpoint?.kind !== "breakpoint") return undefined;
  const selected = breakpointFor(breakpoint.breakpoint);
  return selected === undefined
    ? undefined
    : Object.freeze({ kind: "breakpoint", breakpoint: selected.id });
}

function captureStyleEdit(edit: AuthoringStyleEdit): CapturedStyleEdit | undefined {
  try {
    if (typeof edit !== "object" || edit === null || Array.isArray(edit)) return undefined;
    const kindDescriptor = Object.getOwnPropertyDescriptor(edit, "kind");
    if (kindDescriptor?.enumerable !== true || !("value" in kindDescriptor)) return undefined;
    const kind = kindDescriptor.value;
    const expectedKeys =
      kind === "set-literal"
        ? ["kind", "target", "part", "property", "value"]
        : kind === "set-token"
          ? ["kind", "target", "part", "property", "token"]
          : kind === "reset"
            ? ["kind", "target", "part", "property"]
            : undefined;
    if (expectedKeys === undefined) return undefined;
    const fields = captureExactOwnData(edit, expectedKeys);
    if (
      fields === undefined ||
      !isNonEmptyString(fields.part) ||
      !isNonEmptyString(fields.property)
    ) {
      return undefined;
    }
    const target = captureStyleTarget(fields.target);
    if (target === undefined) return undefined;
    if (kind === "reset") {
      return Object.freeze({ kind, target, part: fields.part, property: fields.property });
    }
    if (kind === "set-token") {
      return isNonEmptyString(fields.token)
        ? Object.freeze({
            kind,
            target,
            part: fields.part,
            property: fields.property,
            token: fields.token,
          })
        : undefined;
    }
    const capturedValue = captureJsonValue(fields.value);
    if (capturedValue === undefined || containsDynamicValue(capturedValue)) return undefined;
    return Object.freeze({
      kind,
      target,
      part: fields.part,
      property: fields.property,
      value: capturedValue,
    });
  } catch {
    return undefined;
  }
}

function isTokenType(value: unknown): value is AuthoringStyleTokenType {
  return (
    value === "border" ||
    value === "color" ||
    value === "dimension" ||
    value === "number" ||
    value === "shadow" ||
    value === "typography"
  );
}

function captureResolvedStyleTokens(
  options: readonly AuthoringResolvedStyleToken[],
): readonly AuthoringResolvedStyleToken[] | undefined {
  try {
    if (!Array.isArray(options) || options.length > MAX_TOKEN_OPTIONS) return undefined;
    const seenPaths = new Set<string>();
    const captured: AuthoringResolvedStyleToken[] = [];
    for (const option of options) {
      const fields = captureExactOwnData(option, ["path", "type", "resolvedValue"]);
      if (
        fields === undefined ||
        !isNonEmptyString(fields.path) ||
        !isTokenType(fields.type) ||
        seenPaths.has(fields.path)
      ) {
        return undefined;
      }
      const resolvedValue = captureJsonValue(fields.resolvedValue);
      if (resolvedValue === undefined || containsDynamicValue(resolvedValue)) return undefined;
      seenPaths.add(fields.path);
      captured.push(Object.freeze({ path: fields.path, type: fields.type, resolvedValue }));
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function findSelectedEditorNode(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
): EditorNode | undefined {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined) return undefined;
  const pending: EditorNode[] = [surface.root];
  let matched: EditorNode | undefined;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current.id === nodeId) {
      if (matched !== undefined) return undefined;
      matched = current;
    }
    for (const children of Object.values(current.slots ?? {})) pending.push(...children);
    for (const behavior of current.behaviors ?? []) {
      for (const children of Object.values(behavior.slots ?? {})) pending.push(...children);
    }
  }
  return matched;
}

function controlKind(schema: JsonObject): AuthoringStyleControlKind {
  const enumValues = ownDataValue(schema, "enum");
  if (Array.isArray(enumValues) && enumValues.every(isJsonPrimitive)) return "enum";
  const type = ownDataValue(schema, "type");
  return type === "boolean" || type === "integer" || type === "number" || type === "string"
    ? type
    : "structured-json";
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function localDefinitionName(reference: unknown): string | undefined {
  if (typeof reference !== "string") return undefined;
  const match = /^#\/\$defs\/([A-Za-z][A-Za-z0-9_-]{0,127})$/u.exec(reference);
  return match?.[1];
}

/**
 * Resolves one exact, local property-schema alias from a closed Catalog style-part schema.
 *
 * Catalogs commonly use `$defs` to keep repeated profile schemas below their bounded artifact
 * budget. The App may follow only a one-hop `#/$defs/name` reference whose property is otherwise
 * exactly `{ "$ref": ... }`; external references, JSON Pointer traversal, and composition beside
 * the reference remain unavailable rather than accidentally widening the authoring surface.
 */
function resolveLocalPropertySchema(root: JsonObject, schema: JsonObject): JsonObject | undefined {
  if (!hasOwnDataValue(schema, "$ref")) return schema;
  if (Object.keys(schema).length !== 1) return undefined;
  const definitionName = localDefinitionName(ownDataValue(schema, "$ref"));
  const definitions = ownDataObject(ownDataValue(root, "$defs"));
  return definitionName === undefined || definitions === undefined
    ? undefined
    : ownDataObject(ownDataValue(definitions, definitionName));
}

function propertySchemaEntries(
  part: AuthoringStylePartContract,
): readonly Readonly<{ readonly property: string; readonly schema: JsonObject }>[] | undefined {
  const root = ownDataObject(part.propertiesSchema);
  if (root === undefined || ownDataValue(root, "additionalProperties") !== false) return undefined;
  const properties = ownDataObject(ownDataValue(root, "properties"));
  if (properties === undefined) return undefined;
  const entries: Readonly<{ readonly property: string; readonly schema: JsonObject }>[] = [];
  for (const property of Object.keys(properties).sort(compareText)) {
    const propertySchema = ownDataObject(ownDataValue(properties, property));
    const schema =
      propertySchema === undefined ? undefined : resolveLocalPropertySchema(root, propertySchema);
    if (schema === undefined) return undefined;
    entries.push(Object.freeze({ property, schema }));
  }
  return Object.freeze(entries);
}

function styleLeafValue(
  nodeOrVariant: EditorNode | EditorVariant,
  part: string,
  property: string,
  tokens: readonly AuthoringResolvedStyleToken[],
  state = BASE_STYLE_STATE,
): AuthoringStyleValueState {
  const owner = ownDataObject(nodeOrVariant);
  const style = owner === undefined ? undefined : ownDataObject(ownDataValue(owner, "style"));
  const stateValue = style === undefined ? undefined : ownDataObject(ownDataValue(style, state));
  const stylePart =
    stateValue === undefined ? undefined : ownDataObject(ownDataValue(stateValue, part));
  if (stylePart === undefined || !hasOwnDataValue(stylePart, property)) return NO_STYLE_VALUE;
  const value = captureJsonValue(ownDataValue(stylePart, property));
  if (value === undefined) return Object.freeze({ kind: "dynamic", value: null });
  const record = ownDataObject(value);
  if (
    record !== undefined &&
    Object.keys(record).length === 1 &&
    hasOwnDataValue(record, "$token")
  ) {
    const path = ownDataValue(record, "$token");
    if (typeof path === "string") {
      const token = tokens.find((candidate) => candidate.path === path);
      return token === undefined
        ? Object.freeze({ kind: "unresolved-token", path })
        : Object.freeze({
            kind: "token",
            path: token.path,
            type: token.type,
            resolvedValue: token.resolvedValue,
          });
    }
  }
  return containsDynamicValue(value)
    ? Object.freeze({ kind: "dynamic", value })
    : Object.freeze({ kind: "literal", value });
}

function isExactViewportPredicate(
  value: unknown,
  breakpoint: AuthoringResponsiveBreakpoint,
): boolean {
  const predicate = ownDataObject(value);
  if (predicate === undefined || Object.keys(predicate).length !== 2) return false;
  if (ownDataValue(predicate, "op") !== "lte") return false;
  const args = ownDataValue(predicate, "args");
  if (!Array.isArray(args) || args.length !== 2 || args[1] !== breakpoint.maxWidth) return false;
  const reference = ownDataObject(args[0]);
  return (
    reference !== undefined &&
    Object.keys(reference).length === 1 &&
    ownDataValue(reference, "$ref") === "env.viewport.width"
  );
}

function responsiveMarker(variant: EditorVariant): JsonObject | undefined {
  const record = ownDataObject(variant);
  const extensions =
    record === undefined ? undefined : ownDataObject(ownDataValue(record, "extensions"));
  return extensions === undefined
    ? undefined
    : ownDataObject(ownDataValue(extensions, RESPONSIVE_VARIANT_EXTENSION));
}

function namedVariantDescriptor(
  index: number,
  variant: EditorVariant,
): Readonly<{ readonly index: number; readonly name: string }> | undefined {
  const record = ownDataObject(variant);
  const extensions =
    record === undefined ? undefined : ownDataObject(ownDataValue(record, "extensions"));
  const marker =
    extensions === undefined
      ? undefined
      : ownDataObject(ownDataValue(extensions, NAMED_VARIANT_EXTENSION));
  const name = marker === undefined ? undefined : ownDataValue(marker, "name");
  return marker !== undefined &&
    ownDataValue(marker, "version") === NAMED_VARIANT_VERSION &&
    isNonEmptyString(name)
    ? Object.freeze({ index, name })
    : undefined;
}

/** Extracts a known marker target even when the marker itself is malformed, for fail-closed edits. */
function markedBreakpointTarget(variant: EditorVariant): AuthoringResponsiveBreakpoint | undefined {
  return breakpointFor(ownDataValue(responsiveMarker(variant) ?? {}, "breakpoint"));
}

function markedBreakpoint(variant: EditorVariant): AuthoringResponsiveBreakpoint | undefined {
  const marker = responsiveMarker(variant);
  if (marker === undefined || Object.keys(marker).length !== 2) return undefined;
  if (ownDataValue(marker, "version") !== RESPONSIVE_VARIANT_VERSION) return undefined;
  return markedBreakpointTarget(variant);
}

function isExactOwnedResponsiveVariant(
  variant: EditorVariant,
  breakpoint: AuthoringResponsiveBreakpoint,
): boolean {
  const record = ownDataObject(variant);
  return (
    record !== undefined &&
    markedBreakpoint(variant)?.id === breakpoint.id &&
    !hasOwnDataValue(record, "props") &&
    ownDataObject(ownDataValue(record, "style")) !== undefined &&
    isExactViewportPredicate(ownDataValue(record, "when"), breakpoint)
  );
}

function responsiveVariantInventory(node: EditorNode): ResponsiveVariantInventory {
  const variants = node.variants ?? [];
  const exactByBreakpoint = new Map<AuthoringResponsiveBreakpointId, ResponsiveVariantMatch>();
  const ambiguousBreakpoints = new Set<AuthoringResponsiveBreakpointId>();
  const malformedMarkerIndexes = new Set<number>();

  variants.forEach((variant, index) => {
    const marked = markedBreakpoint(variant);
    if (marked === undefined) {
      const extensions = ownDataObject(ownDataValue(ownDataObject(variant) ?? {}, "extensions"));
      if (extensions !== undefined && hasOwnDataValue(extensions, RESPONSIVE_VARIANT_EXTENSION)) {
        malformedMarkerIndexes.add(index);
      }
      return;
    }
    if (!isExactOwnedResponsiveVariant(variant, marked)) {
      malformedMarkerIndexes.add(index);
      return;
    }
    if (exactByBreakpoint.has(marked.id)) {
      ambiguousBreakpoints.add(marked.id);
      return;
    }
    exactByBreakpoint.set(marked.id, Object.freeze({ breakpoint: marked, index, variant }));
  });

  // T12 owns only the finite tablet/mobile cascade. Matching variants are evaluated in source
  // order, so their maximum widths must be monotonic from wider to narrower: tablet, then mobile.
  // Do not silently mutate a pre-existing document to repair this; a responsive edit must stay
  // atomic and source-preserving when its existing cascade cannot be trusted.
  const exactInDocumentOrder = [...exactByBreakpoint.values()]
    .filter(({ breakpoint }) => !ambiguousBreakpoints.has(breakpoint.id))
    .sort((left, right) => left.index - right.index);
  let previousMaxWidth = Number.POSITIVE_INFINITY;
  let nonCanonicalOrder = false;
  for (const match of exactInDocumentOrder) {
    if (match.breakpoint.maxWidth > previousMaxWidth) {
      nonCanonicalOrder = true;
      break;
    }
    previousMaxWidth = match.breakpoint.maxWidth;
  }

  const unmanaged: AuthoringUnmanagedResponsiveVariant[] = [];
  variants.forEach((variant, index) => {
    const marked = markedBreakpoint(variant);
    if (malformedMarkerIndexes.has(index)) {
      unmanaged.push(Object.freeze({ index, reason: "malformed-owned-breakpoint" }));
      return;
    }
    if (marked !== undefined && ambiguousBreakpoints.has(marked.id)) {
      unmanaged.push(Object.freeze({ index, reason: "ambiguous-owned-breakpoint" }));
      return;
    }
    if (marked === undefined) unmanaged.push(Object.freeze({ index, reason: "unmanaged" }));
  });

  return Object.freeze({
    exactByBreakpoint,
    ambiguousBreakpoints,
    malformedMarkerIndexes,
    nonCanonicalOrder,
    unmanaged: Object.freeze(unmanaged),
  });
}

function prepareStyleParts(
  component: CatalogComponentSummary,
  node: EditorNode,
  tokens: readonly AuthoringResolvedStyleToken[],
  inventory: ResponsiveVariantInventory,
): readonly AuthoringStylePart[] {
  return Object.freeze(
    component.styleParts.map((part) => {
      const entries = propertySchemaEntries(part);
      if (entries === undefined) {
        return Object.freeze({
          name: part.name,
          description: part.description,
          controlsAvailable: false,
          controls: Object.freeze([]),
        });
      }
      const controls = entries.map(({ property, schema }) =>
        Object.freeze({
          part: part.name,
          property,
          description:
            typeof ownDataValue(schema, "description") === "string"
              ? (ownDataValue(schema, "description") as string)
              : undefined,
          kind: controlKind(schema),
          tokenTypes: expectedTokenTypes(property) ?? NO_TOKEN_TYPES,
          propertiesSchema: schema,
          base: styleLeafValue(node, part.name, property, tokens),
          visualStates: Object.freeze(
            component.visualStates.map((state) =>
              Object.freeze({
                state,
                value: styleLeafValue(node, part.name, property, tokens, state),
              }),
            ),
          ),
          variants: Object.freeze(
            (node.variants ?? [])
              .map((variant, index) => {
                const descriptor = namedVariantDescriptor(index, variant);
                return descriptor === undefined
                  ? undefined
                  : Object.freeze({
                      index,
                      name: descriptor.name,
                      value: styleLeafValue(variant, part.name, property, tokens),
                    });
              })
              .filter(
                (
                  value,
                ): value is Readonly<{
                  readonly index: number;
                  readonly name: string;
                  readonly value: AuthoringStyleValueState;
                }> => value !== undefined,
              ),
          ),
          responsive: Object.freeze(
            AUTHORING_RESPONSIVE_BREAKPOINTS.map((breakpoint) => {
              const match = inventory.exactByBreakpoint.get(breakpoint.id);
              return Object.freeze({
                breakpoint,
                variantIndex: match?.index ?? null,
                value:
                  match === undefined
                    ? NO_STYLE_VALUE
                    : styleLeafValue(match.variant, part.name, property, tokens),
              });
            }),
          ),
        }),
      );
      return Object.freeze({
        name: part.name,
        description: part.description,
        controlsAvailable: true,
        controls: Object.freeze(controls),
      });
    }),
  );
}

function prepareAuthoringStyleModelCaptured(
  model: CatalogAuthoringModel,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection | null,
  tokens: readonly AuthoringResolvedStyleToken[],
): AuthoringStyleModelResult {
  if (selection === null) return Object.freeze({ status: "idle" });
  const projection = projectAuthoringSelection(selection, route, model, undefined);
  if (projection.status !== "unavailable") return Object.freeze({ status: "rejected" });
  const node = findSelectedEditorNode(
    model.validationDocument,
    route.surfaceId,
    selection.sourceNodeId,
  );
  const component = model.components.find(({ id }) => id === selection.capabilityId);
  if (node === undefined || node.use !== selection.capabilityId || component === undefined) {
    return Object.freeze({ status: "rejected" });
  }
  const inventory = responsiveVariantInventory(node);
  return Object.freeze({
    status: "ready",
    component,
    selection,
    parts: prepareStyleParts(component, node, tokens, inventory),
    unmanagedResponsiveVariants: inventory.unmanaged,
  });
}

/**
 * Projects only exact Catalog-declared base-state style controls for a selected component.
 *
 * @remarks `tokenOptions` is caller supplied and must contain concrete, typed resolved values;
 * absent, malformed, duplicate, or dynamic options intentionally make the projection unavailable.
 * No runtime DOM, CSS, token registry, or adapter behavior crosses this boundary.
 */
export function prepareAuthoringStyleModel(
  model: CatalogAuthoringModel,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection | null,
  tokenOptions: readonly AuthoringResolvedStyleToken[],
): AuthoringStyleModelResult {
  const capturedRoute = captureStyleRoute(route);
  const capturedTokens = captureResolvedStyleTokens(tokenOptions);
  if (capturedRoute === undefined || capturedTokens === undefined) {
    return Object.freeze({ status: "rejected" });
  }
  if (selection === null) return Object.freeze({ status: "idle" });
  const capturedSelection = captureStyleSelection(selection);
  return capturedSelection === undefined
    ? Object.freeze({ status: "rejected" })
    : prepareAuthoringStyleModelCaptured(model, capturedRoute, capturedSelection, capturedTokens);
}

/**
 * Creates a transient, non-authored preview that promotes one declared state or named variant
 * to the base style layer. The authored Source and its variant predicates are never changed.
 */
export function prepareAuthoringStylePreviewDocument(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection | null,
  target: AuthoringStyleTarget,
): DesenEditorDocument {
  if (selection === null || target.kind === "base" || target.kind === "breakpoint") return document;
  const capturedSelection = selection;
  try {
    const candidate = JSON.parse(canonicalizeJson(document)) as Record<string, unknown>;
    const surface =
      candidate.surfaces && typeof candidate.surfaces === "object"
        ? (candidate.surfaces as Record<string, unknown>)[route.surfaceId]
        : undefined;
    const root =
      surface && typeof surface === "object"
        ? (surface as Record<string, unknown>).root
        : undefined;
    let selected: Record<string, unknown> | undefined;
    function visit(value: unknown): void {
      if (
        selected !== undefined ||
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
      )
        return;
      const record = value as Record<string, unknown>;
      if (record.id === capturedSelection.sourceNodeId) {
        selected = record;
        return;
      }
      const slots = record.slots;
      if (slots !== null && typeof slots === "object") {
        for (const children of Object.values(slots as Record<string, unknown>)) {
          if (Array.isArray(children)) for (const child of children) visit(child);
        }
      }
    }
    visit(root);
    if (selected === undefined) return document;
    const style =
      selected.style && typeof selected.style === "object"
        ? (selected.style as Record<string, unknown>)
        : {};
    const nextBase =
      style.base && typeof style.base === "object"
        ? (JSON.parse(canonicalizeJson(style.base)) as Record<string, unknown>)
        : {};
    const overlay =
      target.kind === "visual-state"
        ? style[target.state]
        : Array.isArray(selected.variants)
          ? (selected.variants[target.index] as Record<string, unknown> | undefined)?.style
          : undefined;
    if (overlay && typeof overlay === "object" && !Array.isArray(overlay)) {
      for (const [part, properties] of Object.entries(overlay as Record<string, unknown>)) {
        if (properties === null || typeof properties !== "object" || Array.isArray(properties))
          continue;
        nextBase[part] = {
          ...(nextBase[part] as Record<string, unknown> | undefined),
          ...(properties as Record<string, unknown>),
        };
      }
    }
    selected.style = { ...style, base: nextBase };
    const admitted = createDesenEditorDocument(candidate);
    return admitted.ok ? admitted.document : document;
  } catch {
    return document;
  }
}

function findControl(
  styleModel: AuthoringStyleReadyModel,
  part: string,
  property: string,
): AuthoringStyleControl | undefined {
  return styleModel.parts
    .find(({ name }) => name === part)
    ?.controls.find((control) => control.property === property);
}

/** Returns the exact projected leaf targeted by a sealed edit, if one is available. */
function targetStyleValue(
  control: AuthoringStyleControl,
  target: CapturedStyleTarget,
): AuthoringStyleValueState | undefined {
  if (target.kind === "base") return control.base;
  if (target.kind === "visual-state") {
    return control.visualStates?.find(({ state }) => state === target.state)?.value;
  }
  if (target.kind === "variant") {
    return control.variants?.find(({ index }) => index === target.index)?.value;
  }
  return control.responsive.find(({ breakpoint }) => breakpoint.id === target.breakpoint)?.value;
}

function contentFailure(): AuthoringStyleEditFailure {
  return Object.freeze({ ok: false, reason: "edit-rejected" });
}

function validateCandidate(
  candidate: DesenEditorDocument,
  catalogs: readonly unknown[],
  invalidReason: AuthoringStyleEditFailureReason,
): AuthoringStyleEditResult {
  const validator = createDesenEditorContinuousValidator(catalogs);
  if (!validator.ok) return Object.freeze({ ok: false, reason: "catalog-invalid" });
  const report = validator.validator.validate(candidate);
  return report.valid
    ? Object.freeze({ ok: true, document: candidate })
    : Object.freeze({ ok: false, reason: invalidReason, validationReport: report });
}

function editSucceeded(result: DesenEditorContentEditResult): DesenEditorDocument | undefined {
  return result.ok ? result.document : undefined;
}

function setBaseStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  return editSucceeded(
    setDesenEditorOwnerStyleProperty(document, {
      surfaceId: route.surfaceId,
      ownerId: selection.sourceNodeId,
      state: BASE_STYLE_STATE,
      part: edit.part,
      property: edit.property,
      value: edit.value as DesenEditorContentValue,
    }),
  );
}

function setVisualStateStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  state: string,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  return editSucceeded(
    setDesenEditorOwnerStyleProperty(document, {
      surfaceId: route.surfaceId,
      ownerId: selection.sourceNodeId,
      state,
      part: edit.part,
      property: edit.property,
      value: edit.value as DesenEditorContentValue,
    }),
  );
}

function setVariantStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  target: Readonly<{ readonly index: number }>,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  return editSucceeded(
    setDesenEditorVariantStyleProperty(document, {
      surfaceId: route.surfaceId,
      nodeId: selection.sourceNodeId,
      index: target.index,
      state: BASE_STYLE_STATE,
      part: edit.part,
      property: edit.property,
      value: edit.value as DesenEditorContentValue,
    }),
  );
}

function insertResponsiveStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  node: EditorNode,
  inventory: ResponsiveVariantInventory,
  breakpoint: AuthoringResponsiveBreakpoint,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  const narrower = [...inventory.exactByBreakpoint.values()]
    .filter((match) => match.breakpoint.maxWidth < breakpoint.maxWidth)
    .sort((left, right) => left.index - right.index)[0];
  const index = narrower?.index ?? (node.variants ?? []).length;
  const variant: DesenEditorContentVariant = {
    when: {
      op: "lte",
      args: [{ $ref: "env.viewport.width" }, breakpoint.maxWidth],
    },
    style: {
      [BASE_STYLE_STATE]: {
        [edit.part]: { [edit.property]: edit.value },
      },
    },
    extensions: {
      [RESPONSIVE_VARIANT_EXTENSION]: {
        breakpoint: breakpoint.id,
        version: RESPONSIVE_VARIANT_VERSION,
      },
    },
  };
  return editSucceeded(
    insertDesenEditorVariant(document, {
      surfaceId: route.surfaceId,
      nodeId: selection.sourceNodeId,
      index,
      variant,
    }),
  );
}

function setResponsiveStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  node: EditorNode,
  inventory: ResponsiveVariantInventory,
  breakpoint: AuthoringResponsiveBreakpoint,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  const existing = inventory.exactByBreakpoint.get(breakpoint.id);
  if (existing === undefined) {
    return insertResponsiveStyle(document, route, selection, node, inventory, breakpoint, edit);
  }
  return editSucceeded(
    setDesenEditorVariantStyleProperty(document, {
      surfaceId: route.surfaceId,
      nodeId: selection.sourceNodeId,
      index: existing.index,
      state: BASE_STYLE_STATE,
      part: edit.part,
      property: edit.property,
      value: edit.value as DesenEditorContentValue,
    }),
  );
}

function styleContainsLeaf(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = ownDataObject(value);
  if (record === undefined) return false;
  for (const state of Object.keys(record)) {
    const parts = ownDataObject(ownDataValue(record, state));
    if (parts === undefined) continue;
    for (const part of Object.keys(parts)) {
      const properties = ownDataObject(ownDataValue(parts, part));
      if (properties !== undefined && Object.keys(properties).length > 0) return true;
    }
  }
  return false;
}

function resetResponsiveStyle(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  breakpoint: AuthoringResponsiveBreakpoint,
  existing: ResponsiveVariantMatch,
  edit: Readonly<{ readonly part: string; readonly property: string }>,
): DesenEditorContentEditResult | undefined {
  const deleted = deleteDesenEditorVariantStyleProperty(document, {
    surfaceId: route.surfaceId,
    nodeId: selection.sourceNodeId,
    index: existing.index,
    state: BASE_STYLE_STATE,
    part: edit.part,
    property: edit.property,
  });
  if (!deleted.ok) return undefined;
  const changedNode = findSelectedEditorNode(
    deleted.document,
    route.surfaceId,
    selection.sourceNodeId,
  );
  const changedVariant = changedNode?.variants?.[existing.index];
  if (
    changedNode === undefined ||
    changedVariant === undefined ||
    !isExactOwnedResponsiveVariant(changedVariant, breakpoint)
  ) {
    return undefined;
  }
  if (styleContainsLeaf(ownDataValue(ownDataObject(changedVariant) ?? {}, "style"))) return deleted;
  return deleteDesenEditorVariant(deleted.document, {
    surfaceId: route.surfaceId,
    nodeId: selection.sourceNodeId,
    index: existing.index,
  });
}

function expectedTokenTypes(property: string): readonly AuthoringStyleTokenType[] | undefined {
  return TOKEN_TYPES_BY_PROPERTY[property];
}

function tokenReference(path: string): JsonValue {
  return Object.freeze({ $token: path }) as JsonValue;
}

function styleMutation(
  document: DesenEditorDocument,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  node: EditorNode,
  inventory: ResponsiveVariantInventory,
  target: CapturedStyleTarget,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): DesenEditorDocument | undefined {
  if (target.kind === "base") return setBaseStyle(document, route, selection, edit);
  if (target.kind === "visual-state") {
    if (!node.use || !selection.capabilityId) return undefined;
    return setVisualStateStyle(document, route, selection, target.state, edit);
  }
  if (target.kind === "variant") {
    const descriptor = node.variants?.[target.index];
    return descriptor !== undefined &&
      namedVariantDescriptor(target.index, descriptor) !== undefined
      ? setVariantStyle(document, route, selection, target, edit)
      : undefined;
  }
  const breakpoint = breakpointFor(target.breakpoint);
  if (
    breakpoint === undefined ||
    inventory.nonCanonicalOrder ||
    inventory.ambiguousBreakpoints.has(breakpoint.id)
  ) {
    return undefined;
  }
  return setResponsiveStyle(document, route, selection, node, inventory, breakpoint, edit);
}

function preflightLiteralValue(
  document: DesenEditorDocument,
  catalogs: readonly unknown[],
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  node: EditorNode,
  inventory: ResponsiveVariantInventory,
  target: CapturedStyleTarget,
  edit: Readonly<{ readonly part: string; readonly property: string; readonly value: JsonValue }>,
): AuthoringStyleEditFailure | undefined {
  const candidate = styleMutation(document, route, selection, node, inventory, target, edit);
  if (candidate === undefined) return contentFailure();
  const checked = validateCandidate(candidate, catalogs, "value-invalid");
  return checked.ok ? undefined : checked;
}

/**
 * Applies one sealed, Catalog-authorized base style or exact responsive breakpoint override.
 *
 * @remarks Literal input and a token's caller-supplied resolved literal are each continuously
 * validated before a document is returned. Token edits store only `{ $token: path }` after that
 * proof. No arbitrary CSS string, arbitrary variant predicate, undeclared part/property, behavior
 * owner, generic schema spreading, or unresolved token input reaches Editor Core.
 */
export function applyAuthoringStyleEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringStyleRoute,
  selection: AuthoringComponentSelection,
  tokenOptions: readonly AuthoringResolvedStyleToken[],
  edit: AuthoringStyleEdit,
): AuthoringStyleEditResult {
  const capturedRoute = captureStyleRoute(route);
  const capturedSelection = captureStyleSelection(selection);
  const capturedTokens = captureResolvedStyleTokens(tokenOptions);
  const capturedEdit = captureStyleEdit(edit);
  if (capturedRoute === undefined || capturedSelection === undefined) {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }
  if (capturedTokens === undefined || capturedEdit === undefined) return contentFailure();

  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return Object.freeze({
      ok: false,
      reason: prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid",
    });
  }
  const styleModel = prepareAuthoringStyleModelCaptured(
    prepared.model,
    capturedRoute,
    capturedSelection,
    capturedTokens,
  );
  if (styleModel.status !== "ready") {
    return Object.freeze({ ok: false, reason: "selection-invalid" });
  }
  const control = findControl(styleModel, capturedEdit.part, capturedEdit.property);
  if (
    control === undefined ||
    !styleModel.parts.find(({ name }) => name === capturedEdit.part)?.controlsAvailable
  ) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  if (
    capturedEdit.target.kind === "visual-state" &&
    !styleModel.component.visualStates.includes(capturedEdit.target.state)
  ) {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  // Dynamic Source leaves are display-only. This guard deliberately precedes every mutation path
  // so programmatic callers cannot bypass the read-only control rendered by the App.
  if (targetStyleValue(control, capturedEdit.target)?.kind === "dynamic") {
    return Object.freeze({ ok: false, reason: "control-unavailable" });
  }
  const node = findSelectedEditorNode(
    prepared.model.validationDocument,
    capturedRoute.surfaceId,
    capturedSelection.sourceNodeId,
  );
  if (node === undefined) return Object.freeze({ ok: false, reason: "selection-invalid" });
  const inventory = responsiveVariantInventory(node);
  if (capturedEdit.target.kind === "breakpoint") {
    const breakpoint = breakpointFor(capturedEdit.target.breakpoint);
    if (breakpoint === undefined) return contentFailure();
    if (inventory.ambiguousBreakpoints.has(breakpoint.id)) {
      return Object.freeze({ ok: false, reason: "responsive-variant-ambiguous" });
    }
    if (inventory.nonCanonicalOrder) {
      return Object.freeze({ ok: false, reason: "responsive-variant-invalid" });
    }
    if (
      [...inventory.malformedMarkerIndexes].some((index) => {
        const variant = node.variants?.[index];
        return variant !== undefined && markedBreakpointTarget(variant)?.id === breakpoint.id;
      })
    ) {
      return Object.freeze({ ok: false, reason: "responsive-variant-invalid" });
    }
  }

  if (capturedEdit.kind === "reset") {
    if (capturedEdit.target.kind === "base") {
      if (control.base.kind === "absent" || control.base.kind === "dynamic") {
        return Object.freeze({ ok: false, reason: "control-unavailable" });
      }
      const changed = editSucceeded(
        deleteDesenEditorOwnerStyleProperty(prepared.model.validationDocument, {
          surfaceId: capturedRoute.surfaceId,
          ownerId: capturedSelection.sourceNodeId,
          state: BASE_STYLE_STATE,
          part: capturedEdit.part,
          property: capturedEdit.property,
        }),
      );
      return changed === undefined
        ? contentFailure()
        : validateCandidate(changed, prepared.model.validationCatalogs, "source-invalid");
    }
    if (capturedEdit.target.kind === "visual-state") {
      if (!styleModel.component.visualStates.includes(capturedEdit.target.state)) {
        return Object.freeze({ ok: false, reason: "control-unavailable" });
      }
      const current = targetStyleValue(control, capturedEdit.target);
      if (current === undefined || current.kind === "absent" || current.kind === "dynamic") {
        return Object.freeze({ ok: false, reason: "control-unavailable" });
      }
      const changed = editSucceeded(
        deleteDesenEditorOwnerStyleProperty(prepared.model.validationDocument, {
          surfaceId: capturedRoute.surfaceId,
          ownerId: capturedSelection.sourceNodeId,
          state: capturedEdit.target.state,
          part: capturedEdit.part,
          property: capturedEdit.property,
        }),
      );
      return changed === undefined
        ? contentFailure()
        : validateCandidate(changed, prepared.model.validationCatalogs, "source-invalid");
    }
    if (capturedEdit.target.kind === "variant") {
      const variant = node.variants?.[capturedEdit.target.index];
      if (
        variant === undefined ||
        namedVariantDescriptor(capturedEdit.target.index, variant) === undefined
      ) {
        return Object.freeze({ ok: false, reason: "control-unavailable" });
      }
      const current = targetStyleValue(control, capturedEdit.target);
      if (current === undefined || current.kind === "absent" || current.kind === "dynamic") {
        return Object.freeze({ ok: false, reason: "control-unavailable" });
      }
      const changed = editSucceeded(
        deleteDesenEditorVariantStyleProperty(prepared.model.validationDocument, {
          surfaceId: capturedRoute.surfaceId,
          nodeId: capturedSelection.sourceNodeId,
          index: capturedEdit.target.index,
          state: BASE_STYLE_STATE,
          part: capturedEdit.part,
          property: capturedEdit.property,
        }),
      );
      return changed === undefined
        ? contentFailure()
        : validateCandidate(changed, prepared.model.validationCatalogs, "source-invalid");
    }
    const breakpoint = breakpointFor(capturedEdit.target.breakpoint);
    const existing =
      breakpoint === undefined ? undefined : inventory.exactByBreakpoint.get(breakpoint.id);
    const projection = control.responsive.find(
      ({ breakpoint: candidate }) => candidate.id === breakpoint?.id,
    );
    if (
      breakpoint === undefined ||
      existing === undefined ||
      projection === undefined ||
      projection.value.kind === "absent" ||
      projection.value.kind === "dynamic"
    ) {
      return Object.freeze({ ok: false, reason: "control-unavailable" });
    }
    const changed = resetResponsiveStyle(
      prepared.model.validationDocument,
      capturedRoute,
      capturedSelection,
      breakpoint,
      existing,
      capturedEdit,
    );
    if (changed === undefined || !changed.ok) return contentFailure();
    return validateCandidate(changed.document, prepared.model.validationCatalogs, "source-invalid");
  }

  let value: JsonValue;
  let resolvedValue: JsonValue;
  if (capturedEdit.kind === "set-token") {
    const token = capturedTokens.find(({ path }) => path === capturedEdit.token);
    if (token === undefined) return Object.freeze({ ok: false, reason: "token-unknown" });
    const allowedTypes = expectedTokenTypes(capturedEdit.property);
    if (allowedTypes === undefined || !allowedTypes.includes(token.type)) {
      return Object.freeze({ ok: false, reason: "token-incompatible" });
    }
    const proof = preflightLiteralValue(
      prepared.model.validationDocument,
      prepared.model.validationCatalogs,
      capturedRoute,
      capturedSelection,
      node,
      inventory,
      capturedEdit.target,
      { part: capturedEdit.part, property: capturedEdit.property, value: token.resolvedValue },
    );
    if (proof !== undefined) return proof;
    value = tokenReference(token.path);
    resolvedValue = token.resolvedValue;
  } else {
    value = capturedEdit.value;
    resolvedValue = value;
  }

  if (
    isStarterCapabilityVisualStyleValue(
      styleModel.component.id,
      capturedEdit.property,
      resolvedValue,
    ) === false
  ) {
    return Object.freeze({ ok: false, reason: "value-invalid" });
  }

  const changed = styleMutation(
    prepared.model.validationDocument,
    capturedRoute,
    capturedSelection,
    node,
    inventory,
    capturedEdit.target,
    { part: capturedEdit.part, property: capturedEdit.property, value },
  );
  if (changed === undefined) return contentFailure();
  return validateCandidate(
    changed,
    prepared.model.validationCatalogs,
    capturedEdit.kind === "set-token" ? "source-invalid" : "value-invalid",
  );
}
