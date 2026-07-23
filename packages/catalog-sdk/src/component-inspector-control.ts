import { createJsonPointer } from "@desen/protocol";

import { createImmutableJsonSnapshot } from "./inert-json.js";

import type { JsonPointer } from "@desen/protocol";
import type { ComponentManifestInput, RegisteredComponent } from "./component-registration.js";
import type { ImmutableJson, JsonPrimitive } from "./inert-json.js";
import type { JsonValue } from "./schema-type-derivation.js";

const MAX_CONTROL_DEPTH = 16;
const MAX_CONTROL_COUNT = 512;

const REFERENCE_KEYWORDS = Object.freeze(["$ref", "$dynamicRef", "$recursiveRef"]);
const COMBINATOR_KEYWORDS = Object.freeze(["allOf", "anyOf", "oneOf", "not"]);
const CONDITIONAL_KEYWORDS = Object.freeze([
  "if",
  "then",
  "else",
  "dependentSchemas",
  "dependentRequired",
]);
const PATTERN_KEYWORDS = Object.freeze(["pattern", "patternProperties"]);
const UNSUPPORTED_APPLICATOR_KEYWORDS = Object.freeze([
  "$defs",
  "const",
  "contentSchema",
  "items",
  "prefixItems",
  "contains",
  "minContains",
  "maxContains",
  "unevaluatedItems",
  "unevaluatedProperties",
  "propertyNames",
]);
const SUPPORTED_SCHEMA_KEYWORDS = Object.freeze([
  "$anchor",
  "$comment",
  "$id",
  "$schema",
  "additionalProperties",
  "default",
  "deprecated",
  "description",
  "enum",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maximum",
  "maxItems",
  "maxLength",
  "maxProperties",
  "minimum",
  "minItems",
  "minLength",
  "minProperties",
  "multipleOf",
  "properties",
  "readOnly",
  "required",
  "title",
  "type",
  "uniqueItems",
  "writeOnly",
]);

type JsonRecord = Record<string, unknown>;

type ClosedEnumeratedObjectSchema = JsonRecord & {
  readonly type: "object";
  readonly additionalProperties: false;
  readonly properties: JsonRecord;
};

interface ComponentInspectorControlBase {
  readonly property: string | null;
  readonly required: boolean;
  readonly valuePointer: JsonPointer;
  readonly schemaPointer: JsonPointer;
  readonly hint?: JsonValue;
  readonly hintPointer?: JsonPointer;
}

interface ComponentInspectorPrimitiveControl extends ComponentInspectorControlBase {
  readonly kind: Exclude<ComponentInspectorControlKind, "enum" | "group" | "structured-json">;
}

interface ComponentInspectorEnumControl extends ComponentInspectorControlBase {
  readonly kind: "enum";
  readonly options: readonly JsonPrimitive[];
}

interface ComponentInspectorGroupControl extends ComponentInspectorControlBase {
  readonly kind: "group";
  readonly children: readonly ComponentInspectorControl[];
}

interface ComponentInspectorStructuredJsonControl extends ComponentInspectorControlBase {
  readonly kind: "structured-json";
  readonly fallbackReason: ComponentInspectorFallbackReason;
}

/**
 * The platform-neutral inspector presentation selected for one component property.
 *
 * @remarks These values describe editor intent as inert data. They do not name framework widgets
 * and never change the validation semantics of the authoritative `propsSchema`.
 */
export type ComponentInspectorControlKind =
  "enum" | "boolean" | "string" | "number" | "integer" | "group" | "structured-json";

/**
 * Why a schema subtree must remain editable through an honest structured-JSON fallback.
 */
export type ComponentInspectorFallbackReason =
  | "array"
  | "open-object"
  | "multi-type"
  | "reference"
  | "combinator"
  | "conditional"
  | "pattern"
  | "unsupported-schema"
  | "derivation-limit";

/**
 * One immutable, schema-derived inspector descriptor.
 *
 * @remarks `kind`, `required`, and enum `options` are derived only from `propsSchema`. Optional
 * authoring hints are opaque sidecars with their own pointers and cannot override those fields.
 * A group contains the complete recursively derived set of its explicitly declared properties.
 */
export type ComponentInspectorControl =
  | ComponentInspectorPrimitiveControl
  | ComponentInspectorEnumControl
  | ComponentInspectorGroupControl
  | ComponentInspectorStructuredJsonControl;

/**
 * Detached inspector metadata derived from one registered component manifest.
 *
 * @remarks The complete authoritative property schema and, when present, the complete authoring
 * contract are retained alongside the descriptor list. Every nested value is inert, detached
 * JSON and recursively frozen.
 */
export interface ComponentInspectorControlPlan {
  readonly propsSchema: ImmutableJson<ComponentManifestInput["propsSchema"]>;
  readonly authoring?: ImmutableJson<NonNullable<ComponentManifestInput["authoring"]>>;
  readonly controls: readonly ComponentInspectorControl[];
}

interface DerivationState {
  count: number;
}

interface HintSidecar {
  readonly hint: JsonValue;
  readonly hintPointer: JsonPointer;
}

const DERIVATION_LIMIT = Object.freeze({});

function fail(path: JsonPointer, message: string): never {
  throw new TypeError(`Cannot derive component inspector controls at ${path || "/"}: ${message}`);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, path: JsonPointer): JsonRecord {
  if (!isRecord(value)) fail(path, "expected a JSON object");
  return value;
}

function hasAnyOwn(record: JsonRecord, keys: readonly string[]): boolean {
  return keys.some((key) => Object.hasOwn(record, key));
}

function hasUnknownSchemaKeyword(schema: JsonRecord): boolean {
  return Object.keys(schema).some(
    (key) =>
      !SUPPORTED_SCHEMA_KEYWORDS.includes(key) &&
      !REFERENCE_KEYWORDS.includes(key) &&
      !COMBINATOR_KEYWORDS.includes(key) &&
      !CONDITIONAL_KEYWORDS.includes(key) &&
      !PATTERN_KEYWORDS.includes(key) &&
      !UNSUPPORTED_APPLICATOR_KEYWORDS.includes(key),
  );
}

function fallbackReason(schema: JsonRecord): ComponentInspectorFallbackReason | undefined {
  if (hasAnyOwn(schema, REFERENCE_KEYWORDS)) return "reference";
  if (hasAnyOwn(schema, COMBINATOR_KEYWORDS)) return "combinator";
  if (hasAnyOwn(schema, CONDITIONAL_KEYWORDS)) return "conditional";
  if (hasAnyOwn(schema, PATTERN_KEYWORDS)) return "pattern";

  const schemaType = schema.type;
  if (Array.isArray(schemaType)) return "multi-type";
  if (schemaType === "array") return "array";
  if (hasAnyOwn(schema, UNSUPPORTED_APPLICATOR_KEYWORDS)) return "unsupported-schema";
  if (hasUnknownSchemaKeyword(schema)) return "unsupported-schema";
  if (schemaType === "object" && Object.hasOwn(schema, "enum")) return "unsupported-schema";
  if (schemaType === "object" && !isClosedEnumeratedObject(schema)) return "open-object";
  if (
    schemaType !== "object" &&
    hasAnyOwn(schema, [
      "properties",
      "additionalProperties",
      "required",
      "minProperties",
      "maxProperties",
    ])
  ) {
    return "unsupported-schema";
  }
  return undefined;
}

function isClosedEnumeratedObject(schema: JsonRecord): schema is ClosedEnumeratedObjectSchema {
  return (
    schema.type === "object" &&
    schema.additionalProperties === false &&
    isRecord(schema.properties) &&
    !hasAnyOwn(schema, REFERENCE_KEYWORDS) &&
    !hasAnyOwn(schema, COMBINATOR_KEYWORDS) &&
    !hasAnyOwn(schema, CONDITIONAL_KEYWORDS) &&
    !hasAnyOwn(schema, PATTERN_KEYWORDS) &&
    !hasAnyOwn(schema, UNSUPPORTED_APPLICATOR_KEYWORDS) &&
    !hasUnknownSchemaKeyword(schema)
  );
}

function requiredPropertyNames(schema: JsonRecord): ReadonlySet<string> | undefined {
  if (!Object.hasOwn(schema, "required")) return new Set<string>();
  if (!Array.isArray(schema.required) || !isRecord(schema.properties)) return undefined;

  const names = new Set<string>();
  for (const name of schema.required) {
    if (typeof name !== "string" || !Object.hasOwn(schema.properties, name)) return undefined;
    names.add(name);
  }
  return names;
}

function primitiveEnumOptions(schema: JsonRecord): readonly JsonPrimitive[] | undefined {
  if (!Object.hasOwn(schema, "enum") || !Array.isArray(schema.enum) || schema.enum.length === 0) {
    return undefined;
  }
  if (
    !schema.enum.every(
      (value): value is JsonPrimitive =>
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    )
  ) {
    return undefined;
  }
  return schema.enum;
}

function enumOptionsMatchDeclaredType(
  options: readonly JsonPrimitive[],
  schemaType: unknown,
): boolean {
  if (schemaType === undefined) return true;
  if (schemaType === "null") return options.every((value) => value === null);
  if (schemaType === "boolean") return options.every((value) => typeof value === "boolean");
  if (schemaType === "string") return options.every((value) => typeof value === "string");
  if (schemaType === "number") return options.every((value) => typeof value === "number");
  if (schemaType === "integer") {
    return options.every((value) => typeof value === "number" && Number.isInteger(value));
  }
  return false;
}

function withHint(
  control: Omit<ComponentInspectorControlBase, "hint" | "hintPointer">,
  hint: HintSidecar | undefined,
): ComponentInspectorControlBase {
  return hint === undefined
    ? control
    : { ...control, hint: hint.hint, hintPointer: hint.hintPointer };
}

function structuredJsonControl(
  property: string | null,
  required: boolean,
  valueSegments: readonly string[],
  schemaSegments: readonly string[],
  reason: ComponentInspectorFallbackReason,
  hint?: HintSidecar,
): ComponentInspectorStructuredJsonControl {
  return {
    ...withHint(
      {
        property,
        required,
        valuePointer: createJsonPointer(valueSegments),
        schemaPointer: createJsonPointer(schemaSegments),
      },
      hint,
    ),
    kind: "structured-json",
    fallbackReason: reason,
  };
}

function reserveControl(state: DerivationState, depth: number): void {
  if (depth > MAX_CONTROL_DEPTH || state.count >= MAX_CONTROL_COUNT) {
    throw DERIVATION_LIMIT;
  }
  state.count += 1;
}

function canonicalPropertyNames(properties: JsonRecord): readonly string[] {
  // JSON.parse applies numeric-index enumeration rules even to RFC 8785-ordered text. Sorting the
  // keys again restores the canonical UTF-16 property order used by the protocol canonicalizer.
  return Object.keys(properties).sort();
}

function deriveControl(
  schemaValue: unknown,
  property: string,
  required: boolean,
  valueSegments: readonly string[],
  schemaSegments: readonly string[],
  depth: number,
  state: DerivationState,
  hint?: HintSidecar,
): ComponentInspectorControl {
  reserveControl(state, depth);

  if (!isRecord(schemaValue)) {
    return structuredJsonControl(
      property,
      required,
      valueSegments,
      schemaSegments,
      "unsupported-schema",
      hint,
    );
  }

  const reason = fallbackReason(schemaValue);
  if (reason !== undefined) {
    return structuredJsonControl(property, required, valueSegments, schemaSegments, reason, hint);
  }

  if (Array.isArray(schemaValue.type)) {
    return structuredJsonControl(
      property,
      required,
      valueSegments,
      schemaSegments,
      "multi-type",
      hint,
    );
  }

  const base = withHint(
    {
      property,
      required,
      valuePointer: createJsonPointer(valueSegments),
      schemaPointer: createJsonPointer(schemaSegments),
    },
    hint,
  );
  const enumOptions = primitiveEnumOptions(schemaValue);
  if (enumOptions !== undefined && enumOptionsMatchDeclaredType(enumOptions, schemaValue.type)) {
    return { ...base, kind: "enum", options: enumOptions };
  }
  if (Object.hasOwn(schemaValue, "enum")) {
    return structuredJsonControl(
      property,
      required,
      valueSegments,
      schemaSegments,
      "unsupported-schema",
      hint,
    );
  }

  if (
    schemaValue.type === "boolean" ||
    schemaValue.type === "string" ||
    schemaValue.type === "number" ||
    schemaValue.type === "integer"
  ) {
    return { ...base, kind: schemaValue.type };
  }

  if (isClosedEnumeratedObject(schemaValue)) {
    const requiredNames = requiredPropertyNames(schemaValue);
    if (requiredNames === undefined) {
      return structuredJsonControl(
        property,
        required,
        valueSegments,
        schemaSegments,
        "unsupported-schema",
        hint,
      );
    }

    const properties = schemaValue.properties;
    const children = canonicalPropertyNames(properties).map((childProperty) =>
      deriveControl(
        properties[childProperty],
        childProperty,
        requiredNames.has(childProperty),
        [...valueSegments, childProperty],
        [...schemaSegments, "properties", childProperty],
        depth + 1,
        state,
      ),
    );
    return { ...base, kind: "group", children };
  }

  return structuredJsonControl(
    property,
    required,
    valueSegments,
    schemaSegments,
    "unsupported-schema",
    hint,
  );
}

function topLevelHint(hints: JsonRecord | undefined, property: string): HintSidecar | undefined {
  if (hints === undefined || !Object.hasOwn(hints, property)) return undefined;
  return {
    hint: hints[property] as JsonValue,
    hintPointer: createJsonPointer(["authoring", "controls", property]),
  };
}

function rootFallback(
  reason: ComponentInspectorFallbackReason,
): readonly ComponentInspectorControl[] {
  return [structuredJsonControl(null, true, [], ["propsSchema"], reason)] as const;
}

/**
 * Derives a deterministic, platform-neutral inspector plan from one registered component.
 *
 * @remarks Accepting the immutable result of `registerComponent` keeps the authoritative
 * `propsSchema` and authoring contract in one unambiguous snapshot. The registration is
 * snapshotted again before inspection, so the caller remains untouched and accessors or non-JSON
 * values fail without entering the derivation. A closed object `propsSchema` yields its
 * canonical-key-ordered top-level controls. Primitive enums, booleans, strings, numbers, integers,
 * and recursively closed enumerated objects receive dedicated descriptors; every unsupported
 * subtree remains visible as `structured-json`.
 *
 * Authoring hints are copied only as opaque sidecars. They never select a control kind, change
 * requiredness, or replace enum options. DESEN 0.1.0 defines no nested hint vocabulary, so this
 * reference profile attaches only an exact top-level `authoring.controls[property]` entry to the
 * corresponding top-level descriptor; nested controls receive no inferred hint semantics.
 * Exceeding 16 control levels or 512 controls fails closed to one root `derivation-limit` fallback
 * instead of returning a partial plan.
 *
 * This helper is not a complete Catalog or JSON Schema validator. Untrusted and
 * publication-bound manifests still require `@desen/validator`.
 *
 * @throws TypeError when the registration cannot be snapshotted as inert JSON or lacks the basic
 * registered-component shape needed for derivation.
 */
export function deriveComponentInspectorControls<
  const Id extends string,
  const Manifest extends ComponentManifestInput,
>(registration: RegisteredComponent<Id, Manifest>): ComponentInspectorControlPlan {
  const snapshot = createImmutableJsonSnapshot(registration) as unknown;
  const registrationRecord = requireRecord(snapshot, createJsonPointer());
  if (
    Object.keys(registrationRecord).length !== 2 ||
    !Object.hasOwn(registrationRecord, "id") ||
    !Object.hasOwn(registrationRecord, "manifest") ||
    typeof registrationRecord.id !== "string"
  ) {
    fail(createJsonPointer(), "expected exactly id and manifest");
  }
  const snapshotRecord = requireRecord(
    registrationRecord.manifest,
    createJsonPointer(["manifest"]),
  );
  const propsSchema = requireRecord(
    snapshotRecord.propsSchema,
    createJsonPointer(["manifest", "propsSchema"]),
  );

  let authoring: JsonRecord | undefined;
  let hints: JsonRecord | undefined;
  if (Object.hasOwn(snapshotRecord, "authoring")) {
    authoring = requireRecord(
      snapshotRecord.authoring,
      createJsonPointer(["manifest", "authoring"]),
    );
    if (Object.hasOwn(authoring, "controls")) {
      hints = requireRecord(
        authoring.controls,
        createJsonPointer(["manifest", "authoring", "controls"]),
      );
    }
  }

  let controls: readonly ComponentInspectorControl[];
  const rootReason = fallbackReason(propsSchema);
  if (rootReason !== undefined || !isClosedEnumeratedObject(propsSchema)) {
    controls = rootFallback(rootReason ?? "unsupported-schema");
  } else {
    const requiredNames = requiredPropertyNames(propsSchema);
    if (requiredNames === undefined) {
      controls = rootFallback("unsupported-schema");
    } else {
      try {
        const state: DerivationState = { count: 0 };
        controls = canonicalPropertyNames(propsSchema.properties).map((property) =>
          deriveControl(
            propsSchema.properties[property],
            property,
            requiredNames.has(property),
            [property],
            ["propsSchema", "properties", property],
            1,
            state,
            topLevelHint(hints, property),
          ),
        );
      } catch (error: unknown) {
        if (error !== DERIVATION_LIMIT) throw error;
        controls = rootFallback("derivation-limit");
      }
    }
  }

  const plan: Record<string, unknown> = {
    propsSchema,
    controls,
  };
  if (authoring !== undefined) plan.authoring = authoring;
  return createImmutableJsonSnapshot(plan) as unknown as ComponentInspectorControlPlan;
}
