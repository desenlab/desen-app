import { appendJsonPointer, canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { RUNTIME_VALUE_SAFETY_LIMITS, resolveRuntimeValue } from "./value-resolution.js";

import type { JsonPointer } from "@desen/protocol";
import type {
  RuntimeJsonPrimitive,
  RuntimeJsonValue,
  RuntimeRequestContext,
  RuntimeTokenPort,
} from "./host-ports.js";
import type {
  RuntimeResolutionSnapshot,
  RuntimeValueInvalid,
  RuntimeValueResolved,
  RuntimeValueSpec,
  RuntimeValueUnresolved,
} from "./value-resolution.js";

const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const ROOT_POINTER = createJsonPointer();

/** Trusted host inputs required to materialize token references. */
export interface RuntimeValueMaterializationContext {
  /** Stable active-Bundle and surface identity attached to token lookups. */
  readonly requestContext: RuntimeRequestContext;
  /** Least-authority host port used to resolve opaque token names. */
  readonly tokens: RuntimeTokenPort;
}

/** An otherwise valid token reference that the active host provider does not know. */
export interface RuntimeTokenUnresolved {
  /** Discriminates an unresolved token from successful, invalid, and provider-failure outcomes. */
  readonly status: "unresolved";
  /** Frozen protocol diagnostic used when a required dynamic value has no value. */
  readonly code: "REFERENCE_UNRESOLVED";
  /** Exact relative JSON Pointer to the unresolved `$token` member. */
  readonly pointer: JsonPointer;
  /** Exact opaque token name supplied by the DESEN value form. */
  readonly token: string;
  /** Stable classification that cannot be confused with resolved JSON `null`. */
  readonly reason: "missing-token";
}

/** A redacted failure returned when the trusted token provider cannot supply a safe outcome. */
export interface RuntimeTokenProviderFailure {
  /** Discriminates an integration failure from document and lookup outcomes. */
  readonly status: "failed";
  /** Frozen protocol diagnostic for an unexpected trusted-adapter failure. */
  readonly code: "ADAPTER_FAILURE";
  /** Exact relative JSON Pointer to the `$token` member whose provider call failed. */
  readonly pointer: JsonPointer;
  /** Stable adapter classification; raw provider errors and payloads are never exposed. */
  readonly adapter: "token-provider";
}

/** Complete token-and-format materialization outcome with no deferred or partial value state. */
export type RuntimeValueMaterialization =
  | RuntimeValueResolved
  | RuntimeValueUnresolved
  | RuntimeValueInvalid
  | RuntimeTokenUnresolved
  | RuntimeTokenProviderFailure;

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

interface ParsedFormat {
  readonly names: ReadonlySet<string>;
  readonly occurrences: ReadonlyMap<string, number>;
  readonly literalCodeUnits: number;
}

interface CapturedMaterializationContext {
  readonly requestContext: RuntimeRequestContext;
  readonly resolveToken: RuntimeTokenPort["resolve"];
}

interface CachedTokenResolved {
  readonly status: "resolved";
  readonly value: RuntimeJsonValue;
}

interface CachedTokenMissing {
  readonly status: "missing";
}

interface CachedTokenFailed {
  readonly status: "failed";
}

interface CachedTokenUnbounded {
  readonly status: "unbounded";
}

type CachedTokenResolution =
  CachedTokenResolved | CachedTokenMissing | CachedTokenFailed | CachedTokenUnbounded;

interface RuntimeValueSafetyBudget {
  readonly failurePointer: JsonPointer;
  jsonNodes: number;
  stringCodeUnits: number;
}

interface MaterializationState {
  readonly context: CapturedMaterializationContext;
  readonly formatProfiles: WeakMap<object, ParsedFormat>;
  readonly snapshot: RuntimeResolutionSnapshot;
  readonly tokenCache: Map<string, CachedTokenResolution>;
  readonly tokenRetentionBudget: RuntimeValueSafetyBudget;
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

/**
 * Copies a hostile-language value through the same public safety limits as M04-T02.
 *
 * The final canonical round trip rejects invalid Unicode and normalizes object member order without
 * invoking serialization hooks. Necessary reflection over an arbitrary Proxy may execute its
 * traps; thrown traps are contained and never expose a partial snapshot.
 */
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

const CONTEXT_VALIDATION_FAILURE_MESSAGES = new WeakMap<object, string>();

function materializationContextFailure(path: string, message: string): never {
  const failure = Object.freeze(Object.create(null) as object);
  CONTEXT_VALIDATION_FAILURE_MESSAGES.set(
    failure,
    `Invalid runtime value materialization context at ${path}: ${message}`,
  );
  throw failure;
}

function contextValidationFailureMessage(error: unknown): string | undefined {
  return typeof error === "object" && error !== null
    ? CONTEXT_VALIDATION_FAILURE_MESSAGES.get(error)
    : undefined;
}

function exactOwnDataValues(
  input: unknown,
  path: string,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return materializationContextFailure(path, "expected an object");
  }

  try {
    if (!hasJsonObjectPrototype(input)) {
      return materializationContextFailure(path, "expected a plain data object");
    }
    const ownKeys = Reflect.ownKeys(input);
    if (ownKeys.some((key) => typeof key === "symbol")) {
      return materializationContextFailure(path, "symbol properties are not allowed");
    }
    const names = (ownKeys as string[]).sort(compareText);
    const expected = [...expectedKeys].sort(compareText);
    if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
      return materializationContextFailure(path, `expected exactly ${expected.join(", ")}`);
    }

    const values = Object.create(null) as Record<string, unknown>;
    for (const name of expected) {
      const property = enumerableDataValue(input, name);
      if (!property.valid) {
        return materializationContextFailure(
          `${path}/${name}`,
          "required property must be an enumerable own data property",
        );
      }
      values[name] = property.value;
    }
    return values;
  } catch (error) {
    if (contextValidationFailureMessage(error) !== undefined) throw error;
    return materializationContextFailure(path, "property descriptors could not be read safely");
  }
}

function captureMaterializationContext(
  context: RuntimeValueMaterializationContext,
): CapturedMaterializationContext {
  try {
    const contextValues = exactOwnDataValues(context, "/", ["requestContext", "tokens"]);
    const requestValues = exactOwnDataValues(contextValues.requestContext, "/requestContext", [
      "documentId",
      "requestId",
      "revision",
      "surfaceId",
    ]);
    for (const name of ["documentId", "requestId", "revision", "surfaceId"] as const) {
      if (typeof requestValues[name] !== "string") {
        return materializationContextFailure(`/requestContext/${name}`, "expected a string");
      }
    }
    const tokenValues = exactOwnDataValues(contextValues.tokens, "/tokens", ["resolve"]);
    if (typeof tokenValues.resolve !== "function") {
      return materializationContextFailure("/tokens/resolve", "expected a function");
    }

    const requestContext = Object.freeze({
      documentId: requestValues.documentId as string,
      revision: requestValues.revision as string,
      surfaceId: requestValues.surfaceId as string,
      requestId: requestValues.requestId as string,
    });
    return Object.freeze({
      requestContext,
      resolveToken: tokenValues.resolve as RuntimeTokenPort["resolve"],
    });
  } catch (error) {
    const message = contextValidationFailureMessage(error);
    // Caller-controlled thrown values are deliberately redacted instead of attached as `cause`.
    // eslint-disable-next-line preserve-caught-error
    throw new TypeError(
      message ??
        "Invalid runtime value materialization context at /: property descriptors could not be read safely",
    );
  }
}

function invalidValue(
  pointer: JsonPointer,
  reason: RuntimeValueInvalid["reason"],
): RuntimeValueInvalid {
  return Object.freeze({ status: "invalid", pointer, reason });
}

function resolvedValue(value: RuntimeJsonValue, usedFallback = false): RuntimeValueResolved {
  return Object.freeze({ status: "resolved", value, usedFallback });
}

function createSafetyBudget(failurePointer: JsonPointer): RuntimeValueSafetyBudget {
  return { failurePointer, jsonNodes: 0, stringCodeUnits: 0 };
}

function consumeNode(budget: RuntimeValueSafetyBudget, depth: number): boolean {
  if (
    depth > RUNTIME_VALUE_SAFETY_LIMITS.maxDepth ||
    budget.jsonNodes >= RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes
  ) {
    return false;
  }
  budget.jsonNodes += 1;
  return true;
}

function consumeStringCodeUnits(budget: RuntimeValueSafetyBudget, codeUnits: number): boolean {
  if (codeUnits > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits - budget.stringCodeUnits) {
    return false;
  }
  budget.stringCodeUnits += codeUnits;
  return true;
}

function consumePrimitive(
  value: RuntimeJsonPrimitive,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): boolean {
  return (
    consumeNode(budget, depth) &&
    (typeof value !== "string" || consumeStringCodeUnits(budget, value.length))
  );
}

function consumeRuntimeJsonValue(
  value: RuntimeJsonValue,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): boolean {
  const pending: { readonly depth: number; readonly value: RuntimeJsonValue }[] = [
    { depth, value },
  ];
  while (pending.length > 0) {
    const current = pending.pop() as {
      readonly depth: number;
      readonly value: RuntimeJsonValue;
    };
    if (!consumeNode(budget, current.depth)) return false;
    if (typeof current.value === "string") {
      if (!consumeStringCodeUnits(budget, current.value.length)) return false;
      continue;
    }
    if (current.value === null || typeof current.value !== "object") continue;

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({
          depth: current.depth + 1,
          value: current.value[index] as RuntimeJsonValue,
        });
      }
      continue;
    }

    const objectValue = current.value as Readonly<Record<string, RuntimeJsonValue>>;
    const keys = Object.keys(objectValue).sort(compareText);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      if (!consumeStringCodeUnits(budget, key.length)) return false;
      pending.push({
        depth: current.depth + 1,
        value: objectValue[key] as RuntimeJsonValue,
      });
    }
  }
  return true;
}

function safetyBudgetFailure(budget: RuntimeValueSafetyBudget): RuntimeValueInvalid {
  return invalidValue(budget.failurePointer, "unsafe-or-unbounded-json");
}

function tokenUnresolved(pointer: JsonPointer, token: string): RuntimeTokenUnresolved {
  return Object.freeze({
    status: "unresolved",
    code: "REFERENCE_UNRESOLVED",
    pointer,
    token,
    reason: "missing-token",
  });
}

function tokenProviderFailure(pointer: JsonPointer): RuntimeTokenProviderFailure {
  return Object.freeze({
    status: "failed",
    code: "ADAPTER_FAILURE",
    pointer,
    adapter: "token-provider",
  });
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return relative === ROOT_POINTER ? base : (`${base}${relative}` as JsonPointer);
}

function relocateReferenceFailure(
  resolution: RuntimeValueUnresolved | RuntimeValueInvalid,
  pointer: JsonPointer,
): RuntimeValueUnresolved | RuntimeValueInvalid {
  return Object.freeze({ ...resolution, pointer: prefixPointer(pointer, resolution.pointer) });
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

function parseFormatTemplate(template: string): ParsedFormat | undefined {
  const names = new Set<string>();
  const occurrences = new Map<string, number>();
  let literalCodeUnits = 0;
  let literalStart = 0;
  let index = 0;

  while (index < template.length) {
    const character = template[index] as string;
    if (character === "}") return undefined;
    if (character !== "{") {
      index += 1;
      continue;
    }

    literalCodeUnits += index - literalStart;
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
    occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
    index = end + 1;
    literalStart = index;
  }

  literalCodeUnits += template.length - literalStart;
  return Object.freeze({ names, occurrences, literalCodeUnits });
}

function validateFormatProfiles(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
  profiles: WeakMap<object, ParsedFormat>,
): RuntimeValueInvalid | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateFormatProfiles(
        value[index] as JsonSnapshotValue,
        appendJsonPointer(pointer, index),
        profiles,
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
          profiles,
        )
      : undefined;
  }
  if (Object.hasOwn(value, "$token")) return undefined;
  if (Object.hasOwn(value, "$format")) {
    const payload = value.$format as JsonSnapshotObject;
    const template = payload.template as string;
    const values = payload.values as JsonSnapshotObject;
    const profile = parseFormatTemplate(template);
    const formatPointer = appendJsonPointer(pointer, "$format");
    const templatePointer = appendJsonPointer(formatPointer, "template");
    if (profile === undefined || [...profile.names].some((name) => !Object.hasOwn(values, name))) {
      return invalidValue(templatePointer, "malformed-format");
    }
    const valuesPointer = appendJsonPointer(formatPointer, "values");
    const keys = Object.keys(values).sort(compareText);
    const unused = keys.find((key) => !profile.names.has(key));
    if (unused !== undefined) {
      return invalidValue(appendJsonPointer(valuesPointer, unused), "malformed-format");
    }
    profiles.set(value, profile);
    for (const key of keys) {
      const invalid = validateFormatProfiles(
        values[key] as JsonSnapshotValue,
        appendJsonPointer(valuesPointer, key),
        profiles,
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  for (const key of Object.keys(value).sort(compareText)) {
    const invalid = validateFormatProfiles(
      value[key] as JsonSnapshotValue,
      appendJsonPointer(pointer, key),
      profiles,
    );
    if (invalid !== undefined) return invalid;
  }
  return undefined;
}

function inspectTokenProviderResult(result: unknown): CachedTokenResolution {
  try {
    const statusContainer = exactProviderObject(result);
    const status = statusContainer.status;
    if (status === "missing") {
      return Object.keys(statusContainer).length === 1
        ? Object.freeze({ status: "missing" })
        : Object.freeze({ status: "failed" });
    }
    if (
      status !== "resolved" ||
      Object.keys(statusContainer).length !== 2 ||
      !Object.hasOwn(statusContainer, "value")
    ) {
      return Object.freeze({ status: "failed" });
    }
    const value = inertBoundedJsonSnapshot(statusContainer.value);
    return value === undefined
      ? Object.freeze({ status: "failed" })
      : Object.freeze({ status: "resolved", value: value as RuntimeJsonValue });
  } catch {
    return Object.freeze({ status: "failed" });
  }
}

function exactProviderObject(input: unknown): Readonly<Record<string, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Token provider result must be an object.");
  }
  if (!hasJsonObjectPrototype(input)) {
    throw new TypeError("Token provider result must be a plain data object.");
  }
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    throw new TypeError("Token provider result cannot contain symbols.");
  }
  const names = ownKeys as string[];
  if (!names.includes("status")) throw new TypeError("Token provider result requires status.");
  const values = Object.create(null) as Record<string, unknown>;
  for (const name of names) {
    const property = enumerableDataValue(input, name);
    if (!property.valid) throw new TypeError("Token provider result must contain own data.");
    values[name] = property.value;
  }
  return values;
}

function cachedTokenResolution(token: string, state: MaterializationState): CachedTokenResolution {
  const cached = state.tokenCache.get(token);
  if (cached !== undefined) return cached;

  let resolution: CachedTokenResolution;
  try {
    const request = Object.freeze({
      context: state.context.requestContext,
      token,
    });
    const result = Reflect.apply(state.context.resolveToken, undefined, [request]) as unknown;
    resolution = inspectTokenProviderResult(result);
  } catch {
    resolution = Object.freeze({ status: "failed" });
  }
  if (
    resolution.status === "resolved" &&
    !consumeRuntimeJsonValue(resolution.value, 0, state.tokenRetentionBudget)
  ) {
    return Object.freeze({ status: "unbounded" });
  }
  state.tokenCache.set(token, resolution);
  return resolution;
}

function materializeToken(
  value: JsonSnapshotObject,
  pointer: JsonPointer,
  state: MaterializationState,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): RuntimeValueMaterialization {
  const token = value.$token as string;
  const tokenPointer = appendJsonPointer(pointer, "$token");
  const resolution = cachedTokenResolution(token, state);
  if (resolution.status === "missing") return tokenUnresolved(tokenPointer, token);
  if (resolution.status === "failed") return tokenProviderFailure(tokenPointer);
  if (resolution.status === "unbounded") return safetyBudgetFailure(state.tokenRetentionBudget);
  if (!consumeRuntimeJsonValue(resolution.value, depth, budget)) {
    return safetyBudgetFailure(budget);
  }
  return resolvedValue(resolution.value);
}

function stringifyFormatValue(value: RuntimeJsonValue): string | undefined {
  if (typeof value === "string") return value;
  try {
    return canonicalizeJson(value);
  } catch {
    return undefined;
  }
}

function materializeFormat(
  value: JsonSnapshotObject,
  pointer: JsonPointer,
  state: MaterializationState,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): RuntimeValueMaterialization {
  const profile = state.formatProfiles.get(value);
  const formatPointer = appendJsonPointer(pointer, "$format");
  if (profile === undefined) return invalidValue(formatPointer, "malformed-format");

  const payload = value.$format as JsonSnapshotObject;
  const template = payload.template as string;
  const values = payload.values as JsonSnapshotObject;
  const valuesPointer = appendJsonPointer(formatPointer, "values");
  const substitutions = new Map<string, string>();
  let usedFallback = false;
  let outputLength = profile.literalCodeUnits;

  for (const name of Object.keys(values).sort(compareText)) {
    const result = materializeSnapshotValue(
      values[name] as JsonSnapshotValue,
      appendJsonPointer(valuesPointer, name),
      state,
      0,
      createSafetyBudget(formatPointer),
    );
    if (result.status !== "resolved") return result;
    const text = stringifyFormatValue(result.value);
    if (text === undefined) return invalidValue(formatPointer, "unsafe-or-unbounded-json");
    const occurrences = profile.occurrences.get(name) as number;
    if (
      text.length >
      Math.floor((RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits - outputLength) / occurrences)
    ) {
      return invalidValue(formatPointer, "unsafe-or-unbounded-json");
    }
    outputLength += text.length * occurrences;
    substitutions.set(name, text);
    usedFallback ||= result.usedFallback;
  }

  if (!consumeNode(budget, depth) || !consumeStringCodeUnits(budget, outputLength)) {
    return safetyBudgetFailure(budget);
  }
  const output = template.replace(
    /\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
    (_placeholder, name: string) => substitutions.get(name) as string,
  );
  return resolvedValue(output, usedFallback);
}

function materializeReference(
  value: JsonSnapshotObject,
  pointer: JsonPointer,
  state: MaterializationState,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): RuntimeValueMaterialization {
  const resolution = resolveRuntimeValue(value as RuntimeValueSpec, state.snapshot);
  if (resolution.status === "resolved") {
    return consumeRuntimeJsonValue(resolution.value, depth, budget)
      ? resolution
      : safetyBudgetFailure(budget);
  }
  if (resolution.status === "invalid" || resolution.status === "unresolved") {
    return relocateReferenceFailure(resolution, pointer);
  }

  if (!Object.hasOwn(value, "fallback")) {
    return invalidValue(prefixPointer(pointer, resolution.pointer), "unsafe-or-unbounded-json");
  }
  const fallback = materializeSnapshotValue(
    value.fallback as JsonSnapshotValue,
    appendJsonPointer(pointer, "fallback"),
    state,
    depth,
    budget,
  );
  return fallback.status === "resolved" ? resolvedValue(fallback.value, true) : fallback;
}

function materializeSnapshotValue(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
  state: MaterializationState,
  depth: number,
  budget: RuntimeValueSafetyBudget,
): RuntimeValueMaterialization {
  if (value === null || typeof value !== "object") {
    return consumePrimitive(value, depth, budget)
      ? resolvedValue(value)
      : safetyBudgetFailure(budget);
  }
  if (Array.isArray(value)) {
    if (!consumeNode(budget, depth)) return safetyBudgetFailure(budget);
    const result: RuntimeJsonValue[] = [];
    let usedFallback = false;
    for (let index = 0; index < value.length; index += 1) {
      const child = materializeSnapshotValue(
        value[index] as JsonSnapshotValue,
        appendJsonPointer(pointer, index),
        state,
        depth + 1,
        budget,
      );
      if (child.status !== "resolved") return child;
      result.push(child.value);
      usedFallback ||= child.usedFallback;
    }
    return resolvedValue(Object.freeze(result), usedFallback);
  }

  if (Object.hasOwn(value, "$ref")) {
    return materializeReference(value, pointer, state, depth, budget);
  }
  if (Object.hasOwn(value, "$token")) {
    return materializeToken(value, pointer, state, depth, budget);
  }
  if (Object.hasOwn(value, "$format")) {
    return materializeFormat(value, pointer, state, depth, budget);
  }

  if (!consumeNode(budget, depth)) return safetyBudgetFailure(budget);
  const result = Object.create(null) as Record<string, RuntimeJsonValue>;
  let usedFallback = false;
  for (const key of Object.keys(value).sort(compareText)) {
    if (!consumeStringCodeUnits(budget, key.length)) return safetyBudgetFailure(budget);
    const child = materializeSnapshotValue(
      value[key] as JsonSnapshotValue,
      appendJsonPointer(pointer, key),
      state,
      depth + 1,
      budget,
    );
    if (child.status !== "resolved") return child;
    result[key] = child.value;
    usedFallback ||= child.usedFallback;
  }
  return resolvedValue(Object.freeze(result), usedFallback);
}

/**
 * Completely materializes one DESEN value form against an atomic snapshot and trusted token port.
 *
 * @remarks M04-T02 remains the authoritative literal/reference/fallback validator and resolver.
 * This additive stage handles only its deferred token and format forms. Format placeholders follow
 * the closed PF-017 ASCII grammar. Strings substitute unchanged; every other JSON value uses RFC
 * 8785 canonical text. A unique token is looked up at most once per top-level call, including missing
 * and failed outcomes, and the cache is discarded before the function returns.
 *
 * Provider values are detached, recursively frozen, and bounded before use. Missing is distinct
 * from resolved JSON `null`. Provider exceptions, promises, malformed envelopes, accessors,
 * reflection failures, and unsafe values become a redacted `ADAPTER_FAILURE`. Children and retained
 * unique token candidates are charged incrementally against the M04-T02 depth, occurrence, and
 * string limits before accumulation; complete output is copied and checked again. No failed result
 * exposes a partial value. Token candidates are not consumer-schema validated here, and a candidate
 * shaped like another DESEN value form remains inert data.
 *
 * @throws TypeError when the materialization context is not the exact own-data host shape or when
 * `snapshot` was not created by `createRuntimeResolutionSnapshot`.
 */
export function materializeRuntimeValue(
  spec: RuntimeValueSpec,
  snapshot: RuntimeResolutionSnapshot,
  context: RuntimeValueMaterializationContext,
): RuntimeValueMaterialization {
  const capturedContext = captureMaterializationContext(context);
  const prerequisite = resolveRuntimeValue(spec, snapshot);
  if (prerequisite.status === "invalid") return prerequisite;

  const copied = inertBoundedJsonSnapshot(spec);
  if (copied === undefined) return invalidValue(ROOT_POINTER, "unsafe-or-unbounded-json");
  const copiedPrerequisite = resolveRuntimeValue(copied as RuntimeValueSpec, snapshot);
  if (copiedPrerequisite.status === "invalid") return copiedPrerequisite;

  const formatProfiles = new WeakMap<object, ParsedFormat>();
  const invalidFormat = validateFormatProfiles(copied, ROOT_POINTER, formatProfiles);
  if (invalidFormat !== undefined) return invalidFormat;
  if (copiedPrerequisite.status === "resolved" || copiedPrerequisite.status === "unresolved") {
    return copiedPrerequisite;
  }

  const result = materializeSnapshotValue(
    copied,
    ROOT_POINTER,
    {
      context: capturedContext,
      formatProfiles,
      snapshot,
      tokenCache: new Map(),
      tokenRetentionBudget: createSafetyBudget(ROOT_POINTER),
    },
    0,
    createSafetyBudget(ROOT_POINTER),
  );
  if (result.status !== "resolved") return result;

  const boundedOutput = inertBoundedJsonSnapshot(result.value);
  return boundedOutput === undefined
    ? invalidValue(ROOT_POINTER, "unsafe-or-unbounded-json")
    : resolvedValue(boundedOutput as RuntimeJsonValue, result.usedFallback);
}
