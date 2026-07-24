import { appendJsonPointer, canonicalizeJson, createJsonPointer } from "@desen/protocol";

import type { JsonPointer } from "@desen/protocol";
import type { RuntimeJsonObject, RuntimeJsonPrimitive, RuntimeJsonValue } from "./host-ports.js";

const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const REFERENCE_PATTERN =
  /^(state|context|resource|operation|event|item|env)(\.[A-Za-z_][A-Za-z0-9_-]*)+$/u;
const FORMAT_VALUE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const SNAPSHOT_KEYS = [
  "context",
  "env",
  "event",
  "item",
  "operation",
  "resource",
  "state",
] as const;
const SNAPSHOT_BRAND = new WeakSet<object>();
const ROOT_POINTER = createJsonPointer();
declare const RUNTIME_RESOLUTION_SNAPSHOT_TYPE_BRAND: unique symbol;

/** Deterministic limits applied before runtime values enter DESEN evaluation. */
export const RUNTIME_VALUE_SAFETY_LIMITS = Object.freeze({
  /** Maximum nested container depth accepted at the data boundary. */
  maxDepth: 128,
  /** Maximum total JSON value and property occurrences accepted in one snapshot. */
  maxJsonNodes: 4_096,
  /** Maximum combined UTF-16 code units across string values and object keys. */
  maxStringCodeUnits: 1_048_576,
} as const);

/** A DESEN reference form accepted by the runtime value resolver. */
export interface RuntimeReferenceValue {
  /** Dot-separated reference beginning with one of the seven DESEN namespaces. */
  readonly $ref: string;
  /** Value evaluated only when a lexically valid reference is missing at evaluation time. */
  readonly fallback?: RuntimeValueSpec;
}

/** A DESEN target-token form whose materialization is owned by M04-T03. */
export interface RuntimeTokenValue {
  /** Non-empty, target-defined token name. */
  readonly $token: string;
}

/** The deterministic formatting payload whose materialization is owned by M04-T03. */
export interface RuntimeFormatPayload {
  /** Format template interpreted by the protocol-defined formatter. */
  readonly template: string;
  /** Named value forms available to the template. */
  readonly values: Readonly<Record<string, RuntimeValueSpec>>;
}

/** A DESEN deterministic string-format form whose materialization is owned by M04-T03. */
export interface RuntimeFormatValue {
  /** Complete format payload. */
  readonly $format: RuntimeFormatPayload;
}

/**
 * A literal object value.
 *
 * @remarks Runtime validation rejects property names beginning with `$`; this index signature
 * intentionally remains broad enough to model JSON object composition.
 */
export interface RuntimeLiteralValue {
  /** Nested literal or dynamic value form. */
  readonly [key: string]: RuntimeValueSpec;
}

/** Any DESEN 0.1.0 value form accepted at the runtime resolution boundary. */
export type RuntimeValueSpec =
  | RuntimeJsonPrimitive
  | readonly RuntimeValueSpec[]
  | RuntimeReferenceValue
  | RuntimeTokenValue
  | RuntimeFormatValue
  | RuntimeLiteralValue;

/** Readable lifecycle state exposed by one declared resource or operation root. */
export type RuntimeLifecycleReferenceSnapshot =
  | Readonly<{ status: "idle"; pending: false }>
  | Readonly<{ status: "pending"; pending: true }>
  | Readonly<{ status: "succeeded"; pending: false; value: RuntimeJsonValue }>
  | Readonly<{ status: "failed"; pending: false; error: Readonly<{ code: string }> }>;

/** Current handler payload availability at the event-reference boundary. */
export type RuntimeEventReferenceSnapshot =
  Readonly<{ status: "unavailable" }> | Readonly<{ status: "available"; value: RuntimeJsonValue }>;

/**
 * Caller-owned data used to create one atomic runtime reference snapshot.
 *
 * @remarks The runtime must derive declaration and active-scope membership from an already
 * validated surface and current evaluation turn. This boundary verifies inert data, exact
 * lifecycle/event envelopes, and map presence; it does not independently prove Bundle
 * provenance or Catalog contracts.
 */
export interface RuntimeResolutionSnapshotInput {
  /** Runtime-composed surface-local state values keyed by declaration name. */
  readonly state: RuntimeJsonObject;
  /** Host-approved non-secret context paths. */
  readonly context: RuntimeJsonObject;
  /** Runtime-composed resource roots and their current public lifecycle state. */
  readonly resource: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
  /** Runtime-composed operation aliases and their current public lifecycle state. */
  readonly operation: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
  /** Payload for the immediate handler turn, or an explicit unavailable marker. */
  readonly event: RuntimeEventReferenceSnapshot;
  /** Runtime-composed active repeat aliases and their current values. */
  readonly item: RuntimeJsonObject;
  /** Runtime environment paths supplied by the current host profile. */
  readonly env: RuntimeJsonObject;
}

/**
 * Detached, bounded, recursively immutable view of all seven DESEN reference namespaces.
 *
 * @remarks Instances are created only by {@link createRuntimeResolutionSnapshot}. The factory
 * brand prevents callers from bypassing the atomic copy and shape checks with a type assertion.
 */
export interface RuntimeResolutionSnapshot {
  /** Compile-time opaque marker; the corresponding runtime brand is held outside the value. */
  readonly [RUNTIME_RESOLUTION_SNAPSHOT_TYPE_BRAND]: true;
  /** Runtime-composed surface-local state values keyed by declaration name. */
  readonly state: RuntimeJsonObject;
  /** Host-approved non-secret context paths. */
  readonly context: RuntimeJsonObject;
  /** Runtime-composed resource roots and their current public lifecycle state. */
  readonly resource: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
  /** Runtime-composed operation aliases and their current public lifecycle state. */
  readonly operation: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>;
  /** Payload for the immediate handler turn, or an explicit unavailable marker. */
  readonly event: RuntimeEventReferenceSnapshot;
  /** Runtime-composed active repeat aliases and their current values. */
  readonly item: RuntimeJsonObject;
  /** Runtime environment paths supplied by the current host profile. */
  readonly env: RuntimeJsonObject;
}

/** Why a syntactically valid reference could not produce a value. */
export type RuntimeReferenceFailureReason =
  "unknown-root" | "inactive-scope" | "invalid-path" | "missing-path";

/** Successful complete value materialization. */
export interface RuntimeValueResolved {
  /** Discriminates a complete result from every failure or deferred form. */
  readonly status: "resolved";
  /** Complete recursively immutable JSON value; JSON `null` remains a successful value. */
  readonly value: RuntimeJsonValue;
  /** Whether any reference in the complete value selected its fallback. */
  readonly usedFallback: boolean;
}

/** A reference failure carrying no partial composite value. */
export interface RuntimeValueUnresolved {
  /** Discriminates a missing reference from invalid input and deferred forms. */
  readonly status: "unresolved";
  /** Frozen protocol diagnostic code owned by reference resolution. */
  readonly code: "REFERENCE_UNRESOLVED";
  /** Exact relative JSON Pointer to the failing `$ref` member. */
  readonly pointer: JsonPointer;
  /** Exact unresolved reference text. */
  readonly reference: string;
  /** Stable runtime classification of the failed lookup. */
  readonly reason: RuntimeReferenceFailureReason;
}

/** Why a value form was rejected before it could enter evaluation. */
export type RuntimeValueInvalidReason =
  | "unsafe-or-unbounded-json"
  | "reserved-literal-key"
  | "malformed-reference"
  | "malformed-token"
  | "malformed-format";

/** Rejected hostile or malformed value input carrying no partial composite value. */
export interface RuntimeValueInvalid {
  /** Discriminates malformed input from reference failure and deferred forms. */
  readonly status: "invalid";
  /** Exact relative location when the malformed member is safely discoverable. */
  readonly pointer: JsonPointer;
  /** Stable reason for rejection. */
  readonly reason: RuntimeValueInvalidReason;
}

/** A structurally valid value form intentionally fenced for the next runtime task. */
export interface RuntimeValueDeferred {
  /** Discriminates a planned value form from resolved and failed results. */
  readonly status: "deferred";
  /** Exact form that requires M04-T03 materialization. */
  readonly form: "token" | "format";
  /** Exact relative pointer to the deferred `$token` or `$format` member. */
  readonly pointer: JsonPointer;
}

/** Complete outcome of resolving one DESEN value form against one atomic snapshot. */
export type RuntimeValueResolution =
  RuntimeValueResolved | RuntimeValueUnresolved | RuntimeValueInvalid | RuntimeValueDeferred;

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

interface ReferenceLookupResolved {
  readonly status: "resolved";
  readonly value: RuntimeJsonValue;
}

interface ReferenceLookupMissing {
  readonly status: "missing";
  readonly reason: RuntimeReferenceFailureReason;
  readonly fallbackEligible: boolean;
}

type ReferenceLookup = ReferenceLookupResolved | ReferenceLookupMissing;

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

// Count every JSON occurrence while copying data descriptors, before canonical serialization.
// This matches the resolved-data safety profile without invoking accessors.
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
    const snapshot = JSON.parse(canonicalizeJson(root.value)) as JsonSnapshotValue;
    return freezeJsonSnapshot(snapshot);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is JsonSnapshotObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: JsonSnapshotObject, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort(compareText);
  if (actual.length !== expected.length) return false;
  return actual.every((key, index) => key === expected[index]);
}

function isLifecycleSnapshot(value: unknown): value is RuntimeLifecycleReferenceSnapshot {
  if (!isRecord(value) || typeof value.status !== "string" || typeof value.pending !== "boolean") {
    return false;
  }
  if (value.status === "idle") {
    return value.pending === false && hasExactKeys(value, ["pending", "status"]);
  }
  if (value.status === "pending") {
    return value.pending === true && hasExactKeys(value, ["pending", "status"]);
  }
  if (value.status === "succeeded") {
    return value.pending === false && hasExactKeys(value, ["pending", "status", "value"]);
  }
  if (value.status !== "failed" || value.pending !== false) return false;
  if (!hasExactKeys(value, ["error", "pending", "status"]) || !isRecord(value.error)) return false;
  return hasExactKeys(value.error, ["code"]) && typeof value.error.code === "string";
}

function isLifecycleMap(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isLifecycleSnapshot);
}

function isEventSnapshot(value: unknown): value is RuntimeEventReferenceSnapshot {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (value.status === "unavailable") return hasExactKeys(value, ["status"]);
  return value.status === "available" && hasExactKeys(value, ["status", "value"]);
}

function isResolutionSnapshotShape(value: JsonSnapshotValue): boolean {
  if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS)) return false;
  return (
    isRecord(value.state) &&
    isRecord(value.context) &&
    isLifecycleMap(value.resource) &&
    isLifecycleMap(value.operation) &&
    isEventSnapshot(value.event) &&
    isRecord(value.item) &&
    isRecord(value.env)
  );
}

/**
 * Creates one detached and atomic view of all DESEN reference namespaces.
 *
 * @remarks The complete input is copied before any scope becomes observable. Accessors, functions,
 * promises, symbols, non-plain class/prototype shapes, cycles, sparse arrays, non-finite numbers,
 * reflection failures, and values beyond {@link RUNTIME_VALUE_SAFETY_LIMITS} are rejected. Only
 * enumerable own data is copied from accepted plain-record-compatible objects, so inherited data
 * never becomes observable. Caller mutation after this call cannot affect the returned snapshot.
 *
 * @throws TypeError when the input is not bounded data-only JSON with the exact runtime scope
 * shape, lifecycle envelopes, and event availability marker.
 */
export function createRuntimeResolutionSnapshot(
  input: RuntimeResolutionSnapshotInput,
): RuntimeResolutionSnapshot {
  const snapshot = inertBoundedJsonSnapshot(input);
  if (snapshot === undefined || !isResolutionSnapshotShape(snapshot)) {
    throw new TypeError(
      "Runtime resolution snapshot input must be bounded data-only JSON with the exact DESEN scope shape.",
    );
  }
  SNAPSHOT_BRAND.add(snapshot as object);
  return snapshot as unknown as RuntimeResolutionSnapshot;
}

function invalidValue(
  pointer: JsonPointer,
  reason: RuntimeValueInvalidReason,
): RuntimeValueInvalid {
  return Object.freeze({ status: "invalid", pointer, reason });
}

function unresolvedValue(
  pointer: JsonPointer,
  reference: string,
  reason: RuntimeReferenceFailureReason,
): RuntimeValueUnresolved {
  return Object.freeze({
    status: "unresolved",
    code: "REFERENCE_UNRESOLVED",
    pointer,
    reference,
    reason,
  });
}

function deferredValue(
  pointer: JsonPointer,
  form: RuntimeValueDeferred["form"],
): RuntimeValueDeferred {
  return Object.freeze({ status: "deferred", form, pointer });
}

function resolvedValue(value: RuntimeJsonValue, usedFallback = false): RuntimeValueResolved {
  return Object.freeze({ status: "resolved", value, usedFallback });
}

function validateValueSpec(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimeValueInvalid | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateValueSpec(
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
      const invalid = validateValueSpec(
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
      return invalidValue(appendJsonPointer(pointer, "$ref"), "malformed-reference");
    }
    return Object.hasOwn(value, "fallback")
      ? validateValueSpec(
          value.fallback as JsonSnapshotValue,
          appendJsonPointer(pointer, "fallback"),
        )
      : undefined;
  }

  if (reservedKey === "$token") {
    return keys.length === 1 && typeof value.$token === "string" && value.$token.length > 0
      ? undefined
      : invalidValue(appendJsonPointer(pointer, "$token"), "malformed-token");
  }

  if (reservedKey === "$format") {
    if (keys.length !== 1 || !isRecord(value.$format)) {
      return invalidValue(appendJsonPointer(pointer, "$format"), "malformed-format");
    }
    const format = value.$format;
    if (
      !hasExactKeys(format, ["template", "values"]) ||
      typeof format.template !== "string" ||
      !isRecord(format.values)
    ) {
      return invalidValue(appendJsonPointer(pointer, "$format"), "malformed-format");
    }
    const valuesPointer = appendJsonPointer(appendJsonPointer(pointer, "$format"), "values");
    for (const name of Object.keys(format.values).sort(compareText)) {
      if (!FORMAT_VALUE_NAME_PATTERN.test(name)) {
        return invalidValue(appendJsonPointer(valuesPointer, name), "malformed-format");
      }
      const invalid = validateValueSpec(
        format.values[name] as JsonSnapshotValue,
        appendJsonPointer(valuesPointer, name),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  return invalidValue(appendJsonPointer(pointer, reservedKey), "reserved-literal-key");
}

function resolveObjectPath(root: RuntimeJsonValue, segments: readonly string[]): ReferenceLookup {
  let value = root;
  for (const segment of segments) {
    if (!isRuntimeJsonObject(value)) {
      return { status: "missing", reason: "missing-path", fallbackEligible: true };
    }
    if (!Object.hasOwn(value, segment)) {
      return { status: "missing", reason: "missing-path", fallbackEligible: true };
    }
    value = value[segment] as RuntimeJsonValue;
  }
  return { status: "resolved", value };
}

function isRuntimeJsonObject(
  value: RuntimeJsonValue,
): value is Readonly<Record<string, RuntimeJsonValue>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRootedNamespace(
  roots: RuntimeJsonObject,
  segments: readonly string[],
): ReferenceLookup {
  const rootName = segments[1] as string;
  if (!Object.hasOwn(roots, rootName)) {
    return { status: "missing", reason: "unknown-root", fallbackEligible: false };
  }
  return resolveObjectPath(roots[rootName] as RuntimeJsonValue, segments.slice(2));
}

function resolveLifecycleReference(
  roots: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>,
  segments: readonly string[],
): ReferenceLookup {
  const rootName = segments[1] as string;
  if (!Object.hasOwn(roots, rootName)) {
    return { status: "missing", reason: "unknown-root", fallbackEligible: false };
  }
  const lifecycle = roots[rootName] as RuntimeLifecycleReferenceSnapshot;
  const field = segments[2] as string | undefined;
  if (field === "status" && segments.length === 3) {
    return { status: "resolved", value: lifecycle.status };
  }
  if (field === "pending" && segments.length === 3) {
    return { status: "resolved", value: lifecycle.pending };
  }
  if (field === "value") {
    if (lifecycle.status !== "succeeded") {
      return { status: "missing", reason: "missing-path", fallbackEligible: true };
    }
    return resolveObjectPath(lifecycle.value, segments.slice(3));
  }
  if (field === "error" && segments.length === 4 && segments[3] === "code") {
    return lifecycle.status === "failed"
      ? { status: "resolved", value: lifecycle.error.code }
      : { status: "missing", reason: "missing-path", fallbackEligible: true };
  }
  return { status: "missing", reason: "invalid-path", fallbackEligible: false };
}

function lookupReference(reference: string, snapshot: RuntimeResolutionSnapshot): ReferenceLookup {
  const segments = reference.split(".");
  const namespace = segments[0] as string;
  if (namespace === "state") return resolveRootedNamespace(snapshot.state, segments);
  if (namespace === "context") return resolveObjectPath(snapshot.context, segments.slice(1));
  if (namespace === "resource") return resolveLifecycleReference(snapshot.resource, segments);
  if (namespace === "operation") return resolveLifecycleReference(snapshot.operation, segments);
  if (namespace === "event") {
    if (snapshot.event.status === "unavailable") {
      return { status: "missing", reason: "inactive-scope", fallbackEligible: false };
    }
    return resolveObjectPath(snapshot.event.value, segments.slice(1));
  }
  if (namespace === "item") return resolveRootedNamespace(snapshot.item, segments);
  return resolveObjectPath(snapshot.env, segments.slice(1));
}

function resolveSnapshotValue(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeValueResolution {
  if (value === null || typeof value !== "object") {
    return resolvedValue(value);
  }

  if (Array.isArray(value)) {
    const resolved: RuntimeJsonValue[] = [];
    let usedFallback = false;
    for (let index = 0; index < value.length; index += 1) {
      const child = resolveSnapshotValue(
        value[index] as JsonSnapshotValue,
        appendJsonPointer(pointer, index),
        snapshot,
      );
      if (child.status !== "resolved") return child;
      resolved.push(child.value);
      usedFallback ||= child.usedFallback;
    }
    return resolvedValue(Object.freeze(resolved), usedFallback);
  }

  if (Object.hasOwn(value, "$ref")) {
    const reference = value.$ref as string;
    const lookup = lookupReference(reference, snapshot);
    if (lookup.status === "resolved") return resolvedValue(lookup.value);
    if (lookup.fallbackEligible && Object.hasOwn(value, "fallback")) {
      const fallback = resolveSnapshotValue(
        value.fallback as JsonSnapshotValue,
        appendJsonPointer(pointer, "fallback"),
        snapshot,
      );
      return fallback.status === "resolved" ? resolvedValue(fallback.value, true) : fallback;
    }
    return unresolvedValue(appendJsonPointer(pointer, "$ref"), reference, lookup.reason);
  }

  if (Object.hasOwn(value, "$token")) {
    return deferredValue(appendJsonPointer(pointer, "$token"), "token");
  }
  if (Object.hasOwn(value, "$format")) {
    return deferredValue(appendJsonPointer(pointer, "$format"), "format");
  }

  const result = Object.create(null) as Record<string, RuntimeJsonValue>;
  let usedFallback = false;
  for (const key of Object.keys(value).sort(compareText)) {
    const child = resolveSnapshotValue(
      value[key] as JsonSnapshotValue,
      appendJsonPointer(pointer, key),
      snapshot,
    );
    if (child.status !== "resolved") return child;
    result[key] = child.value;
    usedFallback ||= child.usedFallback;
  }
  return resolvedValue(Object.freeze(result), usedFallback);
}

/**
 * Resolves one complete DESEN value form against one factory-created atomic snapshot.
 *
 * @remarks Missing is distinct from JSON `null`: a successfully resolved `null` never selects a
 * fallback. Fallback is considered only for a legal root and path that is absent at evaluation
 * time; it cannot create an unknown state/resource/operation/item root, revive an inactive event
 * scope, or legalize an unlisted lifecycle path. Arrays are returned whole but are never traversed
 * by a reference path. Scope values shaped like another value form remain inert data and are not
 * evaluated a second time. A failed child rejects the complete composite without a partial value.
 * The complete composed output is detached and checked against the same depth, occurrence, and
 * string budgets, so repeated references cannot amplify individually valid inputs beyond the
 * public safety profile.
 *
 * Token lookup and deterministic string formatting deliberately return `deferred` until M04-T03.
 * Consuming prop/style schema validation and `PROP_TYPE_MISMATCH` remain the adapter composition
 * boundary; a later type mismatch never retries a fallback.
 *
 * @throws TypeError when `snapshot` was not created by {@link createRuntimeResolutionSnapshot}.
 */
export function resolveRuntimeValue(
  spec: RuntimeValueSpec,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeValueResolution {
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !SNAPSHOT_BRAND.has(snapshot as object)
  ) {
    throw new TypeError("Runtime values require a factory-created resolution snapshot.");
  }

  const value = inertBoundedJsonSnapshot(spec);
  if (value === undefined) return invalidValue(ROOT_POINTER, "unsafe-or-unbounded-json");
  const invalid = validateValueSpec(value, ROOT_POINTER);
  if (invalid !== undefined) return invalid;
  const resolution = resolveSnapshotValue(value, ROOT_POINTER, snapshot);
  if (resolution.status !== "resolved") return resolution;
  const boundedOutput = inertBoundedJsonSnapshot(resolution.value);
  return boundedOutput === undefined
    ? invalidValue(ROOT_POINTER, "unsafe-or-unbounded-json")
    : resolvedValue(boundedOutput as RuntimeJsonValue, resolution.usedFallback);
}
