/* eslint-disable @typescript-eslint/no-invalid-void-type -- The cached token callback preserves
 * the receiver-independent host-port contract. */
import { appendJsonPointer, canonicalizeJson, createJsonPointer } from "@desen/protocol";

import {
  evaluatePreparedRuntimePredicate,
  evaluateRuntimePredicate,
  prepareRuntimePredicateEvaluation,
} from "./predicate-evaluation.js";
import { materializeRuntimeValue } from "./token-format-resolution.js";
import { RUNTIME_VALUE_SAFETY_LIMITS, resolveRuntimeValue } from "./value-resolution.js";

import type { JsonPointer } from "@desen/protocol";
import type {
  RuntimeJsonObject,
  RuntimeJsonPrimitive,
  RuntimeJsonValue,
  RuntimeRequestContext,
  RuntimeTokenPort,
  RuntimeTokenRequest,
  RuntimeTokenResolution,
} from "./host-ports.js";
import type {
  RuntimePredicateInvalidReason,
  RuntimePredicateSpec,
  RuntimePredicateTypeMismatch,
} from "./predicate-evaluation.js";
import type {
  RuntimeTokenProviderFailure,
  RuntimeValueMaterializationContext,
} from "./token-format-resolution.js";
import type {
  RuntimeResolutionSnapshot,
  RuntimeValueInvalidReason,
  RuntimeValueResolution,
  RuntimeValueResolved,
  RuntimeValueSpec,
  RuntimeValueUnresolved,
} from "./value-resolution.js";

const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const REFERENCE_PATTERN =
  /^(state|context|resource|operation|event|item|env)(\.[A-Za-z_][A-Za-z0-9_-]*)+$/u;
const FORMAT_VALUE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const ROOT_POINTER = createJsonPointer();
const STYLE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const TOKEN_SESSION_FAILURE = new TypeError("The runtime token session failed.");
const PREDICATE_MISSING_OUTCOME = Object.freeze({
  status: "unresolved",
  code: "REFERENCE_UNRESOLVED",
  pointer: ROOT_POINTER,
  reference: "state.__desen_unresolved",
  reason: "missing-path",
} as const satisfies RuntimeValueUnresolved);
const PREDICATE_PRESENT_OUTCOME = Object.freeze({
  status: "resolved",
  value: null,
  usedFallback: false,
} as const satisfies RuntimeValueResolved);

/** String-keyed component property ValueSpecs before consumer-schema validation. */
export type RuntimePropValueSpecs = Readonly<Record<string, RuntimeValueSpec>>;

/**
 * Style ValueSpecs keyed by visual state, style part, and declared property.
 *
 * @remarks Each property value is one indivisible override leaf. Literal objects and arrays inside
 * that ValueSpec are replaced as a whole rather than recursively merged.
 */
export type RuntimeStyleValueSpecs = Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, RuntimeValueSpec>>>>>
>;

/**
 * One data-only conditional patch accepted by the ordered variant evaluator.
 *
 * @remarks Every variant contains `when` and at least one prop or style patch. Extensions remain
 * opaque and cannot widen the closed core fields.
 */
export type RuntimeVariantOverrideSpec =
  | Readonly<{
      /** Closed predicate evaluated against the same snapshot as every sibling variant. */
      readonly when: RuntimePredicateSpec;
      /** Complete prop-leaf replacements applied when `when` evaluates true. */
      readonly props: RuntimePropValueSpecs;
      /** Optional style-property replacements applied in the same patch. */
      readonly style?: RuntimeStyleValueSpecs;
      /** Opaque extension data never interpreted by this evaluator. */
      readonly extensions?: RuntimeJsonObject;
    }>
  | Readonly<{
      /** Closed predicate evaluated against the same snapshot as every sibling variant. */
      readonly when: RuntimePredicateSpec;
      /** Optional prop-leaf replacements applied in the same patch. */
      readonly props?: RuntimePropValueSpecs;
      /** Complete style-property replacements applied when `when` evaluates true. */
      readonly style: RuntimeStyleValueSpecs;
      /** Opaque extension data never interpreted by this evaluator. */
      readonly extensions?: RuntimeJsonObject;
    }>;

/**
 * Base prop/style ValueSpecs and their document-ordered conditional patches.
 *
 * @remarks Structural node fields are intentionally absent. Variants cannot select capabilities,
 * add or remove children, attach behaviors, or replace event handlers through this API.
 */
export interface RuntimeVariantEvaluationInput {
  /** Base component prop ValueSpecs applied before matching variants. */
  readonly props?: RuntimePropValueSpecs;
  /** Base style ValueSpecs applied before matching variants. */
  readonly style?: RuntimeStyleValueSpecs;
  /** Semantic array whose order is preserved exactly. */
  readonly variants?: readonly RuntimeVariantOverrideSpec[];
}

/** Exact source locations retained for the effective prop and style ValueSpecs. */
export interface RuntimeVariantValueSources {
  /** Winning source pointer for every effective prop. */
  readonly props: Readonly<Record<string, JsonPointer>>;
  /** Winning source pointer for every effective style property. */
  readonly style: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, JsonPointer>>>>>
  >;
}

/** Successful base-first, document-ordered variant composition. */
export interface RuntimeVariantOverridesEvaluated {
  /** Discriminates a complete composition from a fail-closed terminal. */
  readonly status: "evaluated";
  /** Effective prop ValueSpecs; values remain inert until the later consumer stage materializes. */
  readonly effectiveProps: RuntimePropValueSpecs;
  /** Effective style ValueSpecs with visual states kept as independent maps. */
  readonly effectiveStyle: RuntimeStyleValueSpecs;
  /** Source pointers for later schema-validation and adapter diagnostics. */
  readonly sources: RuntimeVariantValueSources;
  /** Zero-based indexes of every matching variant in original document order. */
  readonly matchingVariantIndices: readonly number[];
  /** Ordered dynamic predicate diagnostics, prefixed to their variant source locations. */
  readonly diagnostics: readonly RuntimePredicateTypeMismatch[];
}

/** Stable reason why variant composition could not produce an effective immutable map. */
export type RuntimeVariantOverrideInvalidReason =
  | RuntimePredicateInvalidReason
  | RuntimeValueInvalidReason
  | "malformed-variant-overrides"
  | "materialization-incomplete";

/** Malformed, hostile, over-budget, or incompletely materialized variant input. */
export interface RuntimeVariantOverridesInvalid {
  /** Discriminates invalid input from evaluated and trusted-provider-failure outcomes. */
  readonly status: "invalid";
  /** Exact source-relative location when it can be discovered safely. */
  readonly pointer: JsonPointer;
  /** Stable fail-closed classification without partial effective values. */
  readonly reason: RuntimeVariantOverrideInvalidReason;
}

/** Complete outcome of one ordered variant and style-override evaluation turn. */
export type RuntimeVariantOverridesEvaluation =
  RuntimeVariantOverridesEvaluated | RuntimeVariantOverridesInvalid | RuntimeTokenProviderFailure;

interface JsonSnapshotObject {
  [key: string]: JsonSnapshotValue;
}

type JsonSnapshotValue = RuntimeJsonPrimitive | JsonSnapshotObject | JsonSnapshotValue[];

interface JsonSnapshotVisit {
  readonly kind: "visit";
  readonly source: unknown;
  readonly depth: number;
  readonly assign: (value: JsonSnapshotValue) => void;
}

interface JsonSnapshotLeave {
  readonly kind: "leave";
  readonly source: object;
}

type JsonSnapshotWork = JsonSnapshotLeave | JsonSnapshotVisit;

type PreparedRuntimePredicate = Exclude<
  ReturnType<typeof prepareRuntimePredicateEvaluation>,
  { readonly status: "invalid" }
>;

interface PreparedVariant {
  readonly when: PreparedRuntimePredicate;
  readonly props: JsonSnapshotObject | undefined;
  readonly style: JsonSnapshotObject | undefined;
}

interface PreparedVariantInput {
  readonly props: JsonSnapshotObject | undefined;
  readonly style: JsonSnapshotObject | undefined;
  readonly variants: readonly PreparedVariant[];
}

interface SelectedValueSpec {
  readonly source: JsonPointer;
  readonly spec: RuntimeValueSpec;
}

type SelectedProps = Map<string, SelectedValueSpec>;
type SelectedStyle = Map<string, Map<string, Map<string, SelectedValueSpec>>>;

interface RuntimeValueBudget {
  jsonNodes: number;
  stringCodeUnits: number;
}

type CachedTokenOutcome =
  | Readonly<{ readonly status: "resolved"; readonly value: RuntimeJsonValue }>
  | Readonly<{ readonly status: "missing" }>
  | Readonly<{ readonly status: "failed" }>
  | Readonly<{ readonly status: "unbounded" }>;

interface CapturedMaterializationContext {
  readonly requestContext: RuntimeRequestContext;
  readonly resolveToken: RuntimeTokenPort["resolve"];
}

interface VariantTokenSession {
  context: RuntimeValueMaterializationContext;
  readonly retentionBudget: RuntimeValueBudget;
  readonly tokenCache: Map<string, CachedTokenOutcome>;
  budgetExceeded: boolean;
}

interface PreparedVariantResult {
  readonly prepared: PreparedVariantInput;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasJsonObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  return (
    Object.getPrototypeOf(prototype) === null &&
    constructor !== undefined &&
    "value" in constructor &&
    typeof constructor.value === "function" &&
    Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE
  );
}

function enumerableDataValue(
  owner: object,
  key: PropertyKey,
): { readonly valid: true; readonly value: unknown } | { readonly valid: false } {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? { valid: true, value: descriptor.value }
    : { valid: false };
}

function freezeJsonSnapshot(snapshot: JsonSnapshotValue): JsonSnapshotValue {
  const pending: JsonSnapshotValue[] = [snapshot];
  const containers: (JsonSnapshotObject | readonly JsonSnapshotValue[])[] = [];
  while (pending.length > 0) {
    const value = pending.pop() as JsonSnapshotValue;
    if (typeof value !== "object" || value === null) continue;
    containers.push(value);
    if (Array.isArray(value)) pending.push(...value);
    else pending.push(...Object.values(value));
  }
  for (let index = containers.length - 1; index >= 0; index -= 1) {
    Object.freeze(containers[index]);
  }
  return snapshot;
}

// Variant input and cached token values cross the same hostile-language boundary as the earlier
// runtime slices. This local copy keeps those byte-owned prerequisite implementations unchanged.
function inertBoundedJsonSnapshot(input: unknown): JsonSnapshotValue | undefined {
  const root: { value?: JsonSnapshotValue } = {};
  const activeContainers = new WeakSet<object>();
  const pending: JsonSnapshotWork[] = [
    {
      kind: "visit",
      source: input,
      depth: 0,
      assign(value) {
        root.value = value;
      },
    },
  ];
  let discoveredNodes = 1;
  let stringCodeUnits = 0;

  try {
    while (pending.length > 0) {
      const work = pending.pop() as JsonSnapshotWork;
      if (work.kind === "leave") {
        activeContainers.delete(work.source);
        continue;
      }
      if (work.depth > RUNTIME_VALUE_SAFETY_LIMITS.maxDepth) return undefined;

      const { source } = work;
      if (source === null || typeof source === "boolean") {
        work.assign(source);
        continue;
      }
      if (typeof source === "number") {
        if (!Number.isFinite(source)) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source === "string") {
        stringCodeUnits += source.length;
        if (stringCodeUnits > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source !== "object" || activeContainers.has(source)) return undefined;

      activeContainers.add(source);
      pending.push({ kind: "leave", source });

      if (Array.isArray(source)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(source, "length");
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number" ||
          !Number.isInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          lengthDescriptor.value > RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes - discoveredNodes ||
          (lengthDescriptor.value > 0 && work.depth >= RUNTIME_VALUE_SAFETY_LIMITS.maxDepth)
        ) {
          return undefined;
        }
        const length = lengthDescriptor.value;
        const ownKeys = Reflect.ownKeys(source);
        if (
          ownKeys.length !== length + 1 ||
          ownKeys.some((key) => typeof key === "symbol") ||
          !ownKeys.includes("length")
        ) {
          return undefined;
        }

        discoveredNodes += length;
        const destination: JsonSnapshotValue[] = new Array<JsonSnapshotValue>(length);
        work.assign(destination);
        for (let index = length - 1; index >= 0; index -= 1) {
          const element = enumerableDataValue(source, String(index));
          if (!element.valid) return undefined;
          pending.push({
            kind: "visit",
            source: element.value,
            depth: work.depth + 1,
            assign(value) {
              destination[index] = value;
            },
          });
        }
        continue;
      }

      if (!hasJsonObjectPrototype(source)) return undefined;
      const ownKeys = Reflect.ownKeys(source);
      if (
        ownKeys.length > RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes - discoveredNodes ||
        (ownKeys.length > 0 && work.depth >= RUNTIME_VALUE_SAFETY_LIMITS.maxDepth) ||
        ownKeys.some((key) => typeof key === "symbol")
      ) {
        return undefined;
      }
      const keys = (ownKeys as string[]).sort(compareText);
      discoveredNodes += keys.length;
      const destination = Object.create(null) as JsonSnapshotObject;
      work.assign(destination);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index] as string;
        stringCodeUnits += key.length;
        if (stringCodeUnits > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits) return undefined;
        const property = enumerableDataValue(source, key);
        if (!property.valid) return undefined;
        pending.push({
          kind: "visit",
          source: property.value,
          depth: work.depth + 1,
          assign(value) {
            destination[key] = value;
          },
        });
      }
    }

    if (root.value === undefined) return undefined;
    return freezeJsonSnapshot(JSON.parse(canonicalizeJson(root.value)) as JsonSnapshotValue);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is JsonSnapshotObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return relative === ROOT_POINTER ? base : (`${base}${relative}` as JsonPointer);
}

function invalidVariant(
  pointer: JsonPointer,
  reason: RuntimeVariantOverrideInvalidReason,
): RuntimeVariantOverridesInvalid {
  return Object.freeze({ status: "invalid", pointer, reason });
}

function exactKeys(
  value: JsonSnapshotObject,
  allowed: readonly string[],
  required: readonly string[],
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  const keys = Object.keys(value).sort(compareText);
  const unknown = keys.find((key) => !allowed.includes(key));
  if (unknown !== undefined) {
    return invalidVariant(appendJsonPointer(pointer, unknown), "malformed-variant-overrides");
  }
  const missing = required.find((key) => !Object.hasOwn(value, key));
  return missing === undefined
    ? undefined
    : invalidVariant(appendJsonPointer(pointer, missing), "malformed-variant-overrides");
}

function relocateInvalidValue(
  pointer: JsonPointer,
  relativePointer: JsonPointer,
  reason: RuntimeValueInvalidReason,
): RuntimeVariantOverridesInvalid {
  return invalidVariant(prefixPointer(pointer, relativePointer), reason);
}

function hasExactKeys(value: JsonSnapshotObject, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  return (
    keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index])
  );
}

function isAsciiIdentifier(name: string): boolean {
  if (name.length === 0) return false;
  const first = name.charCodeAt(0);
  if (!((first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95)) {
    return false;
  }
  for (let index = 1; index < name.length; index += 1) {
    const code = name.charCodeAt(index);
    if (!(
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 95
    )) {
      return false;
    }
  }
  return true;
}

function parseFormatNames(template: string): ReadonlySet<string> | undefined {
  const names = new Set<string>();
  let index = 0;
  while (index < template.length) {
    const character = template[index] as string;
    if (character === "}") return undefined;
    if (character !== "{") {
      index += 1;
      continue;
    }

    const start = index + 1;
    let end = start;
    while (end < template.length && template[end] !== "}") {
      if (template[end] === "{") return undefined;
      end += 1;
    }
    if (end >= template.length || end === start) return undefined;
    const name = template.slice(start, end);
    if (!isAsciiIdentifier(name)) return undefined;
    names.add(name);
    index = end + 1;
  }
  return names;
}

function validateValueSpecShape(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateValueSpecShape(
        value[index] as JsonSnapshotValue,
        appendJsonPointer(pointer, index),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  const keys = Object.keys(value).sort(compareText);
  const reservedKey = keys.find((key) => key.startsWith("$"));
  if (reservedKey === undefined) {
    for (const key of keys) {
      const invalid = validateValueSpecShape(
        value[key] as JsonSnapshotValue,
        appendJsonPointer(pointer, key),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  if (reservedKey === "$ref") {
    if (
      (keys.length !== 1 && !(keys.length === 2 && keys[0] === "$ref" && keys[1] === "fallback")) ||
      typeof value.$ref !== "string" ||
      !REFERENCE_PATTERN.test(value.$ref)
    ) {
      return invalidVariant(appendJsonPointer(pointer, "$ref"), "malformed-reference");
    }
    return Object.hasOwn(value, "fallback")
      ? validateValueSpecShape(
          value.fallback as JsonSnapshotValue,
          appendJsonPointer(pointer, "fallback"),
        )
      : undefined;
  }

  if (reservedKey === "$token") {
    return keys.length === 1 && typeof value.$token === "string" && value.$token.length > 0
      ? undefined
      : invalidVariant(appendJsonPointer(pointer, "$token"), "malformed-token");
  }

  if (reservedKey === "$format") {
    if (keys.length !== 1 || !isRecord(value.$format)) {
      return invalidVariant(appendJsonPointer(pointer, "$format"), "malformed-format");
    }
    const format = value.$format;
    if (
      !hasExactKeys(format, ["template", "values"]) ||
      typeof format.template !== "string" ||
      !isRecord(format.values)
    ) {
      return invalidVariant(appendJsonPointer(pointer, "$format"), "malformed-format");
    }

    const formatValues = format.values as JsonSnapshotObject;
    const valuesPointer = appendJsonPointer(appendJsonPointer(pointer, "$format"), "values");
    const valueNames = Object.keys(formatValues).sort(compareText);
    for (const name of valueNames) {
      if (!FORMAT_VALUE_NAME_PATTERN.test(name)) {
        return invalidVariant(appendJsonPointer(valuesPointer, name), "malformed-format");
      }
      const invalid = validateValueSpecShape(
        formatValues[name] as JsonSnapshotValue,
        appendJsonPointer(valuesPointer, name),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  return invalidVariant(appendJsonPointer(pointer, reservedKey), "reserved-literal-key");
}

function validateFormatProfiles(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateFormatProfiles(
        value[index] as JsonSnapshotValue,
        appendJsonPointer(pointer, index),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  if (Object.hasOwn(value, "$ref")) {
    return Object.hasOwn(value, "fallback")
      ? validateFormatProfiles(
          value.fallback as JsonSnapshotValue,
          appendJsonPointer(pointer, "fallback"),
        )
      : undefined;
  }
  if (Object.hasOwn(value, "$token")) return undefined;
  if (Object.hasOwn(value, "$format")) {
    const format = value.$format as JsonSnapshotObject;
    const template = format.template as string;
    const formatValues = format.values as JsonSnapshotObject;
    const formatPointer = appendJsonPointer(pointer, "$format");
    const templatePointer = appendJsonPointer(formatPointer, "template");
    const names = parseFormatNames(template);
    if (names === undefined || [...names].some((name) => !Object.hasOwn(formatValues, name))) {
      return invalidVariant(templatePointer, "malformed-format");
    }

    const valuesPointer = appendJsonPointer(formatPointer, "values");
    const valueNames = Object.keys(formatValues).sort(compareText);
    const unused = valueNames.find((name) => !names.has(name));
    if (unused !== undefined) {
      return invalidVariant(appendJsonPointer(valuesPointer, unused), "malformed-format");
    }
    for (const name of valueNames) {
      const invalid = validateFormatProfiles(
        formatValues[name] as JsonSnapshotValue,
        appendJsonPointer(valuesPointer, name),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  for (const key of Object.keys(value).sort(compareText)) {
    const invalid = validateFormatProfiles(
      value[key] as JsonSnapshotValue,
      appendJsonPointer(pointer, key),
    );
    if (invalid !== undefined) return invalid;
  }
  return undefined;
}

// M04-T05 must validate raw output candidates without observing the runtime snapshot or token
// provider. The two pure passes preserve T02 structural precedence and T03 outer-first format
// precedence while deliberately omitting resolution and formatted-output construction, so an
// overwritten leaf can never fail the turn.
function validateValueSpec(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  return validateValueSpecShape(value, pointer) ?? validateFormatProfiles(value, pointer);
}

function validateProps(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  if (!isRecord(value)) {
    return invalidVariant(pointer, "malformed-variant-overrides");
  }
  for (const key of Object.keys(value).sort(compareText)) {
    const childPointer = appendJsonPointer(pointer, key);
    const invalid = validateValueSpec(value[key] as JsonSnapshotValue, childPointer);
    if (invalid !== undefined) return invalid;
  }
  return undefined;
}

function validateStyle(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  if (!isRecord(value)) {
    return invalidVariant(pointer, "malformed-variant-overrides");
  }
  for (const state of Object.keys(value).sort(compareText)) {
    const statePointer = appendJsonPointer(pointer, state);
    if (!STYLE_NAME_PATTERN.test(state)) {
      return invalidVariant(statePointer, "malformed-variant-overrides");
    }
    const parts = value[state] as JsonSnapshotValue;
    if (!isRecord(parts)) {
      return invalidVariant(statePointer, "malformed-variant-overrides");
    }
    for (const part of Object.keys(parts).sort(compareText)) {
      const partPointer = appendJsonPointer(statePointer, part);
      if (!STYLE_NAME_PATTERN.test(part)) {
        return invalidVariant(partPointer, "malformed-variant-overrides");
      }
      const properties = parts[part] as JsonSnapshotValue;
      if (!isRecord(properties)) {
        return invalidVariant(partPointer, "malformed-variant-overrides");
      }
      for (const property of Object.keys(properties).sort(compareText)) {
        const propertyPointer = appendJsonPointer(partPointer, property);
        if (!STYLE_NAME_PATTERN.test(property)) {
          return invalidVariant(propertyPointer, "malformed-variant-overrides");
        }
        const invalid = validateValueSpec(
          properties[property] as JsonSnapshotValue,
          propertyPointer,
        );
        if (invalid !== undefined) return invalid;
      }
    }
  }
  return undefined;
}

function prepareVariantInput(
  input: RuntimeVariantEvaluationInput,
): PreparedVariantResult | RuntimeVariantOverridesInvalid {
  const copied = inertBoundedJsonSnapshot(input);
  if (copied === undefined || !isRecord(copied)) {
    return invalidVariant(ROOT_POINTER, "unsafe-or-unbounded-json");
  }

  const rootShape = exactKeys(copied, ["props", "style", "variants"], [], ROOT_POINTER);
  if (rootShape !== undefined) return rootShape;

  if (Object.hasOwn(copied, "props")) {
    const invalid = validateProps(copied.props as JsonSnapshotValue, "/props" as JsonPointer);
    if (invalid !== undefined) return invalid;
  }
  if (Object.hasOwn(copied, "style")) {
    const invalid = validateStyle(copied.style as JsonSnapshotValue, "/style" as JsonPointer);
    if (invalid !== undefined) return invalid;
  }

  const variantsValue = Object.hasOwn(copied, "variants") ? copied.variants : [];
  if (!Array.isArray(variantsValue)) {
    return invalidVariant("/variants" as JsonPointer, "malformed-variant-overrides");
  }

  const variants: PreparedVariant[] = [];
  for (let index = 0; index < variantsValue.length; index += 1) {
    const pointer = appendJsonPointer("/variants" as JsonPointer, index);
    const variant = variantsValue[index] as JsonSnapshotValue;
    if (!isRecord(variant)) {
      return invalidVariant(pointer, "malformed-variant-overrides");
    }
    const shape = exactKeys(variant, ["extensions", "props", "style", "when"], ["when"], pointer);
    if (shape !== undefined) return shape;
    if (!Object.hasOwn(variant, "props") && !Object.hasOwn(variant, "style")) {
      return invalidVariant(pointer, "malformed-variant-overrides");
    }
    if (Object.hasOwn(variant, "extensions") && !isRecord(variant.extensions)) {
      return invalidVariant(
        appendJsonPointer(pointer, "extensions"),
        "malformed-variant-overrides",
      );
    }
    if (Object.hasOwn(variant, "props")) {
      const invalid = validateProps(
        variant.props as JsonSnapshotValue,
        appendJsonPointer(pointer, "props"),
      );
      if (invalid !== undefined) return invalid;
    }
    if (Object.hasOwn(variant, "style")) {
      const invalid = validateStyle(
        variant.style as JsonSnapshotValue,
        appendJsonPointer(pointer, "style"),
      );
      if (invalid !== undefined) return invalid;
    }

    const whenPointer = appendJsonPointer(pointer, "when");
    const preparedWhen = prepareRuntimePredicateEvaluation(
      variant.when as unknown as RuntimePredicateSpec,
    );
    if ("status" in preparedWhen) {
      return invalidVariant(prefixPointer(whenPointer, preparedWhen.pointer), preparedWhen.reason);
    }
    for (const operand of preparedWhen.operands) {
      const invalid = validateValueSpec(
        operand.spec as unknown as JsonSnapshotValue,
        prefixPointer(whenPointer, operand.pointer),
      );
      if (invalid !== undefined) return invalid;
    }
    variants.push(
      Object.freeze({
        when: preparedWhen,
        props: Object.hasOwn(variant, "props") ? (variant.props as JsonSnapshotObject) : undefined,
        style: Object.hasOwn(variant, "style") ? (variant.style as JsonSnapshotObject) : undefined,
      }),
    );
  }

  return Object.freeze({
    prepared: Object.freeze({
      props: Object.hasOwn(copied, "props") ? (copied.props as JsonSnapshotObject) : undefined,
      style: Object.hasOwn(copied, "style") ? (copied.style as JsonSnapshotObject) : undefined,
      variants: Object.freeze(variants),
    }),
  });
}

function exactOwnDataValues(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  try {
    if (!hasJsonObjectPrototype(input)) return undefined;
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.some((key) => typeof key === "symbol")) return undefined;
    const names = (ownKeys as string[]).sort(compareText);
    const expected = [...expectedKeys].sort(compareText);
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
      return undefined;
    }
    const values = Object.create(null) as Record<string, unknown>;
    for (const name of expected) {
      const property = enumerableDataValue(input, name);
      if (!property.valid) return undefined;
      values[name] = property.value;
    }
    return values;
  } catch {
    return undefined;
  }
}

function captureMaterializationContext(
  context: RuntimeValueMaterializationContext,
): CapturedMaterializationContext {
  const values = exactOwnDataValues(context, ["requestContext", "tokens"]);
  const request = exactOwnDataValues(values?.requestContext, [
    "documentId",
    "requestId",
    "revision",
    "surfaceId",
  ]);
  const tokens = exactOwnDataValues(values?.tokens, ["resolve"]);
  if (
    request === undefined ||
    tokens === undefined ||
    typeof request.documentId !== "string" ||
    typeof request.requestId !== "string" ||
    typeof request.revision !== "string" ||
    typeof request.surfaceId !== "string" ||
    typeof tokens.resolve !== "function"
  ) {
    throw new TypeError("Invalid runtime variant materialization context.");
  }
  return Object.freeze({
    requestContext: Object.freeze({
      documentId: request.documentId,
      revision: request.revision,
      surfaceId: request.surfaceId,
      requestId: request.requestId,
    }),
    resolveToken: tokens.resolve as RuntimeTokenPort["resolve"],
  });
}

function chargeRuntimeJson(value: RuntimeJsonValue, budget: RuntimeValueBudget): boolean {
  const pending: { readonly value: RuntimeJsonValue; readonly depth: number }[] = [
    { value, depth: 0 },
  ];
  while (pending.length > 0) {
    const current = pending.pop() as {
      readonly value: RuntimeJsonValue;
      readonly depth: number;
    };
    if (
      current.depth > RUNTIME_VALUE_SAFETY_LIMITS.maxDepth ||
      budget.jsonNodes >= RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes
    ) {
      return false;
    }
    budget.jsonNodes += 1;
    if (typeof current.value === "string") {
      if (
        current.value.length >
        RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits - budget.stringCodeUnits
      ) {
        return false;
      }
      budget.stringCodeUnits += current.value.length;
      continue;
    }
    if (typeof current.value !== "object" || current.value === null) continue;
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({
          value: current.value[index] as RuntimeJsonValue,
          depth: current.depth + 1,
        });
      }
      continue;
    }
    const record = current.value as RuntimeJsonObject;
    const keys = Object.keys(record).sort(compareText);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      if (key.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits - budget.stringCodeUnits) {
        return false;
      }
      budget.stringCodeUnits += key.length;
      pending.push({ value: record[key] as RuntimeJsonValue, depth: current.depth + 1 });
    }
  }
  return true;
}

function inspectSessionTokenResult(result: unknown): CachedTokenOutcome {
  const values =
    typeof result === "object" && result !== null && !Array.isArray(result)
      ? exactOwnDataValues(
          result,
          Reflect.ownKeys(result).every((key) => typeof key === "string")
            ? (Reflect.ownKeys(result) as string[])
            : [],
        )
      : undefined;
  if (values === undefined) return Object.freeze({ status: "failed" });
  if (values.status === "missing" && Object.keys(values).length === 1) {
    return Object.freeze({ status: "missing" });
  }
  if (
    values.status !== "resolved" ||
    Object.keys(values).length !== 2 ||
    !Object.hasOwn(values, "value")
  ) {
    return Object.freeze({ status: "failed" });
  }
  const copied = inertBoundedJsonSnapshot(values.value);
  return copied === undefined
    ? Object.freeze({ status: "failed" })
    : Object.freeze({ status: "resolved", value: copied as RuntimeJsonValue });
}

function createTokenSession(captured: CapturedMaterializationContext): VariantTokenSession {
  const session: VariantTokenSession = {
    context: undefined as unknown as RuntimeValueMaterializationContext,
    retentionBudget: { jsonNodes: 0, stringCodeUnits: 0 },
    tokenCache: new Map<string, CachedTokenOutcome>(),
    budgetExceeded: false,
  };

  const tokens = Object.freeze({
    resolve(this: void, request: RuntimeTokenRequest): RuntimeTokenResolution {
      const cached = session.tokenCache.get(request.token);
      if (cached !== undefined) {
        if (cached.status === "resolved" || cached.status === "missing") return cached;
        throw TOKEN_SESSION_FAILURE;
      }

      let inspected: CachedTokenOutcome;
      try {
        const result = Reflect.apply(captured.resolveToken, undefined, [request]) as unknown;
        inspected = inspectSessionTokenResult(result);
      } catch {
        inspected = Object.freeze({ status: "failed" });
      }
      if (
        inspected.status === "resolved" &&
        !chargeRuntimeJson(inspected.value, session.retentionBudget)
      ) {
        inspected = Object.freeze({ status: "unbounded" });
        session.budgetExceeded = true;
      }
      session.tokenCache.set(request.token, inspected);
      if (inspected.status === "resolved" || inspected.status === "missing") return inspected;
      throw TOKEN_SESSION_FAILURE;
    },
  } satisfies RuntimeTokenPort);

  session.context = Object.freeze({
    requestContext: captured.requestContext,
    tokens,
  });
  return session;
}

function relocateProviderFailure(
  outcome: RuntimeTokenProviderFailure,
  pointer: JsonPointer,
): RuntimeTokenProviderFailure {
  return Object.freeze({ ...outcome, pointer: prefixPointer(pointer, outcome.pointer) });
}

function chargePredicateOutcome(
  outcome: RuntimeValueResolution,
  budget: RuntimeValueBudget,
  pointer: JsonPointer,
): RuntimeVariantOverridesInvalid | undefined {
  return outcome.status === "resolved" && !chargeRuntimeJson(outcome.value, budget)
    ? invalidVariant(pointer, "unsafe-or-unbounded-json")
    : undefined;
}

function materializePredicate(
  prepared: PreparedRuntimePredicate,
  variantIndex: number,
  snapshot: RuntimeResolutionSnapshot,
  session: VariantTokenSession,
  aggregateBudget: RuntimeValueBudget,
):
  | Readonly<{
      readonly value: boolean;
      readonly diagnostics: readonly RuntimePredicateTypeMismatch[];
    }>
  | RuntimeVariantOverridesInvalid
  | RuntimeTokenProviderFailure {
  const variantPointer = appendJsonPointer("/variants" as JsonPointer, variantIndex);
  const whenPointer = appendJsonPointer(variantPointer, "when");
  const outcomes: RuntimeValueResolution[] = [];

  for (const operand of prepared.operands) {
    const operandPointer = prefixPointer(whenPointer, operand.pointer);
    if (operand.mode === "exists-primary") {
      const existence = evaluateRuntimePredicate({ op: "exists", args: [operand.spec] }, snapshot);
      if (existence.status === "invalid") {
        return invalidVariant(prefixPointer(operandPointer, existence.pointer), existence.reason);
      }
      if (existence.status !== "evaluated") {
        return invalidVariant(operandPointer, "materialization-incomplete");
      }
      outcomes.push(existence.value ? PREDICATE_PRESENT_OUTCOME : PREDICATE_MISSING_OUTCOME);
      continue;
    }

    const materialized = materializeRuntimeValue(operand.spec, snapshot, session.context);
    if (materialized.status === "failed") {
      return session.budgetExceeded
        ? invalidVariant(
            prefixPointer(operandPointer, materialized.pointer),
            "unsafe-or-unbounded-json",
          )
        : relocateProviderFailure(materialized, operandPointer);
    }
    if (materialized.status === "invalid") {
      return relocateInvalidValue(operandPointer, materialized.pointer, materialized.reason);
    }
    const predicateOutcome: RuntimeValueResolution =
      materialized.status === "unresolved" && "token" in materialized
        ? PREDICATE_MISSING_OUTCOME
        : (materialized as RuntimeValueResolution);
    const budgetFailure = chargePredicateOutcome(predicateOutcome, aggregateBudget, operandPointer);
    if (budgetFailure !== undefined) return budgetFailure;
    outcomes.push(predicateOutcome);
  }

  const evaluation = evaluatePreparedRuntimePredicate(prepared, Object.freeze(outcomes));
  if (evaluation.status === "invalid") {
    return invalidVariant(prefixPointer(whenPointer, evaluation.pointer), evaluation.reason);
  }
  if (evaluation.status !== "evaluated") {
    return invalidVariant(
      prefixPointer(whenPointer, evaluation.pointer),
      "materialization-incomplete",
    );
  }
  return Object.freeze({
    value: evaluation.value,
    diagnostics: Object.freeze(
      evaluation.diagnostics.map((diagnostic) =>
        Object.freeze({
          code: diagnostic.code,
          pointer: prefixPointer(whenPointer, diagnostic.pointer),
        }),
      ),
    ),
  });
}

function applyProps(
  selected: SelectedProps,
  props: JsonSnapshotObject | undefined,
  pointer: JsonPointer,
): void {
  if (props === undefined) return;
  for (const key of Object.keys(props).sort(compareText)) {
    selected.set(
      key,
      Object.freeze({
        spec: props[key] as RuntimeValueSpec,
        source: appendJsonPointer(pointer, key),
      }),
    );
  }
}

function applyStyle(
  selected: SelectedStyle,
  style: JsonSnapshotObject | undefined,
  pointer: JsonPointer,
): void {
  if (style === undefined) return;
  for (const state of Object.keys(style).sort(compareText)) {
    let selectedParts = selected.get(state);
    if (selectedParts === undefined) {
      selectedParts = new Map();
      selected.set(state, selectedParts);
    }
    const parts = style[state] as JsonSnapshotObject;
    for (const part of Object.keys(parts).sort(compareText)) {
      let selectedProperties = selectedParts.get(part);
      if (selectedProperties === undefined) {
        selectedProperties = new Map();
        selectedParts.set(part, selectedProperties);
      }
      const properties = parts[part] as JsonSnapshotObject;
      for (const property of Object.keys(properties).sort(compareText)) {
        selectedProperties.set(
          property,
          Object.freeze({
            spec: properties[property] as RuntimeValueSpec,
            source: appendJsonPointer(
              appendJsonPointer(appendJsonPointer(pointer, state), part),
              property,
            ),
          }),
        );
      }
    }
  }
}

function finalizeProps(selected: SelectedProps): Readonly<{
  readonly specs: RuntimePropValueSpecs;
  readonly sources: Readonly<Record<string, JsonPointer>>;
}> {
  const specs = Object.create(null) as Record<string, RuntimeValueSpec>;
  const sources = Object.create(null) as Record<string, JsonPointer>;
  for (const key of [...selected.keys()].sort(compareText)) {
    const selectedValue = selected.get(key) as SelectedValueSpec;
    specs[key] = selectedValue.spec;
    sources[key] = selectedValue.source;
  }
  return Object.freeze({
    specs: Object.freeze(specs),
    sources: Object.freeze(sources),
  });
}

function finalizeStyle(selected: SelectedStyle): Readonly<{
  readonly specs: RuntimeStyleValueSpecs;
  readonly sources: RuntimeVariantValueSources["style"];
}> {
  const specs = Object.create(null) as Record<
    string,
    Record<string, Record<string, RuntimeValueSpec>>
  >;
  const sources = Object.create(null) as Record<
    string,
    Record<string, Record<string, JsonPointer>>
  >;

  for (const state of [...selected.keys()].sort(compareText)) {
    const selectedParts = selected.get(state) as Map<string, Map<string, SelectedValueSpec>>;
    const partSpecs = Object.create(null) as Record<string, Record<string, RuntimeValueSpec>>;
    const partSources = Object.create(null) as Record<string, Record<string, JsonPointer>>;
    for (const part of [...selectedParts.keys()].sort(compareText)) {
      const selectedProperties = selectedParts.get(part) as Map<string, SelectedValueSpec>;
      const propertySpecs = Object.create(null) as Record<string, RuntimeValueSpec>;
      const propertySources = Object.create(null) as Record<string, JsonPointer>;
      for (const property of [...selectedProperties.keys()].sort(compareText)) {
        const selectedValue = selectedProperties.get(property) as SelectedValueSpec;
        propertySpecs[property] = selectedValue.spec;
        propertySources[property] = selectedValue.source;
      }
      partSpecs[part] = Object.freeze(propertySpecs);
      partSources[part] = Object.freeze(propertySources);
    }
    specs[state] = Object.freeze(partSpecs);
    sources[state] = Object.freeze(partSources);
  }

  return Object.freeze({
    specs: Object.freeze(specs),
    sources: Object.freeze(sources),
  });
}

/**
 * Applies base prop/style ValueSpecs and every matching variant in exact document order.
 *
 * @remarks Variant predicates are prepared with the M04-T04 data-only seam, then every ordinary
 * operand is completed through M04-T03 using one factory-created snapshot, one captured request
 * context, and one turn-scoped token cache. Operand outcomes remain position-aligned. Missing
 * references or tokens make their current predicate false; malformed input, provider failure, or
 * a finite-budget crossing fails the complete evaluation without exposing a partial map.
 *
 * Base paths are selected first. Matching variants replace a prop at `/props/{name}` or one style
 * leaf at `/style/{state}/{part}/{property}`; later matching variants win only at paths they
 * declare. Literal objects and arrays are whole leaf values, `null` is a value rather than a delete
 * instruction, and visual-state maps never cascade into one another. Structural node mutation is
 * impossible because the accepted input contains no slots, children, capability, behavior,
 * repeat, or event fields.
 *
 * The result retains immutable ValueSpecs and exact winning source pointers. It deliberately does
 * not materialize effective prop/style values, validate capability schemas, select active visual
 * states, or invoke adapters; those consumer responsibilities remain in M05.
 *
 * @throws TypeError when `snapshot` is not factory-created or `context` is not the exact trusted
 * materialization-context shape.
 */
export function evaluateRuntimeVariantOverrides(
  input: RuntimeVariantEvaluationInput,
  snapshot: RuntimeResolutionSnapshot,
  context: RuntimeValueMaterializationContext,
): RuntimeVariantOverridesEvaluation {
  const capturedContext = captureMaterializationContext(context);
  // Preserve the existing factory-brand boundary before inspecting or preparing caller input.
  resolveRuntimeValue(true, snapshot);

  const preparation = prepareVariantInput(input);
  if ("status" in preparation) return preparation;

  const session = createTokenSession(capturedContext);
  const aggregateBudget: RuntimeValueBudget = { jsonNodes: 0, stringCodeUnits: 0 };
  const diagnostics: RuntimePredicateTypeMismatch[] = [];
  const matchingVariantIndices: number[] = [];
  const selectedProps: SelectedProps = new Map();
  const selectedStyle: SelectedStyle = new Map();

  applyProps(selectedProps, preparation.prepared.props, "/props" as JsonPointer);
  applyStyle(selectedStyle, preparation.prepared.style, "/style" as JsonPointer);

  for (let index = 0; index < preparation.prepared.variants.length; index += 1) {
    const variant = preparation.prepared.variants[index] as PreparedVariant;
    const evaluation = materializePredicate(
      variant.when,
      index,
      snapshot,
      session,
      aggregateBudget,
    );
    if ("status" in evaluation) return evaluation;
    diagnostics.push(...evaluation.diagnostics);
    if (!evaluation.value) continue;

    matchingVariantIndices.push(index);
    const variantPointer = appendJsonPointer("/variants" as JsonPointer, index);
    applyProps(selectedProps, variant.props, appendJsonPointer(variantPointer, "props"));
    applyStyle(selectedStyle, variant.style, appendJsonPointer(variantPointer, "style"));
  }

  const props = finalizeProps(selectedProps);
  const style = finalizeStyle(selectedStyle);
  return Object.freeze({
    status: "evaluated",
    effectiveProps: props.specs,
    effectiveStyle: style.specs,
    sources: Object.freeze({
      props: props.sources,
      style: style.sources,
    }),
    matchingVariantIndices: Object.freeze(matchingVariantIndices),
    diagnostics: Object.freeze(diagnostics),
  });
}
