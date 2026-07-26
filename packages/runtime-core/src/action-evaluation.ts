import { appendJsonPointer, createJsonPointer, parseJsonPointer } from "@desen/protocol";

import {
  evaluatePreparedRuntimePredicate,
  prepareRuntimePredicateEvaluation,
} from "./predicate-evaluation.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { materializeRuntimeValue } from "./token-format-resolution.js";

import type { JsonPointer } from "@desen/protocol";
import type {
  RuntimeJsonValue,
  RuntimeRequestContext,
  RuntimeTokenPort,
  RuntimeTokenResolution,
} from "./host-ports.js";
import type { RuntimePredicateSpec, RuntimePredicateTypeMismatch } from "./predicate-evaluation.js";
import type { RuntimeValueMaterialization } from "./token-format-resolution.js";
import type {
  RuntimeResolutionSnapshot,
  RuntimeValueInvalid,
  RuntimeValueResolution,
  RuntimeValueSpec,
} from "./value-resolution.js";

const ROOT_POINTER = createJsonPointer();
const ACTION_EVALUATION_AUTHORITIES = new WeakMap<object, RuntimeActionEvaluationAuthority>();
declare const RUNTIME_ACTION_EVALUATION_SESSION_TYPE_BRAND: unique symbol;

type CachedTokenResolution = RuntimeTokenResolution | "failed";

type RuntimeTokenResolutionCapture =
  | Readonly<{ readonly status: "captured"; readonly result: RuntimeTokenResolution }>
  | Readonly<{ readonly status: "malformed" }>;

interface RuntimeActionEvaluationAuthority {
  readonly requestContext: RuntimeRequestContext;
  readonly resolveToken: RuntimeTokenPort["resolve"];
  readonly isActive: () => boolean;
  readonly cache: Map<string, CachedTokenResolution>;
  tokenPort: RuntimeTokenPort;
  budgetExceeded: boolean;
}

type RuntimeActionTokenAuthority = Omit<RuntimeActionEvaluationAuthority, "tokenPort">;

/** @internal Opaque action-wide cache shared by guard and payload materialization. */
export interface RuntimeActionEvaluationSession {
  readonly [RUNTIME_ACTION_EVALUATION_SESSION_TYPE_BRAND]: true;
}

/** @internal Inputs for one action-wide evaluation session. */
export interface RuntimeActionEvaluationSessionInput {
  readonly requestContext: RuntimeRequestContext;
  readonly tokens: RuntimeTokenPort;
  /** Caller-owned lifecycle gate checked before and after every token-provider observation. */
  readonly isActive: () => boolean;
}

/** @internal Exact own-data capture of the guard property, before any payload inspection. */
export type RuntimeActionWhenCapture =
  | Readonly<{ readonly status: "captured"; readonly when: RuntimePredicateSpec | undefined }>
  | Readonly<{ readonly status: "invalid"; readonly pointer: JsonPointer }>;

/** @internal Complete prepared guard decision with no deferred operands. */
export type RuntimeActionGuardEvaluation =
  | Readonly<{
      readonly status: "evaluated";
      readonly value: boolean;
      readonly diagnostics: readonly RuntimePredicateTypeMismatch[];
    }>
  | Readonly<{
      readonly status: "adapter-failed" | "invalid";
      readonly pointer: JsonPointer;
    }>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownDataValue(
  object: object,
  key: PropertyKey,
):
  | Readonly<{ readonly valid: true; readonly present: true; readonly value: unknown }>
  | Readonly<{ readonly valid: true; readonly present: false }>
  | Readonly<{ readonly valid: false; readonly present: boolean }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (descriptor === undefined) return Object.freeze({ valid: true, present: false });
    return "value" in descriptor
      ? Object.freeze({ valid: true, present: true, value: descriptor.value })
      : Object.freeze({ valid: false, present: true });
  } catch {
    return Object.freeze({ valid: false, present: false });
  }
}

function exactAllowedKeys(
  object: object,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  try {
    const keys = Reflect.ownKeys(object);
    if (keys.some((key) => typeof key !== "string")) return false;
    const names = keys as string[];
    const allowed = new Set([...required, ...optional]);
    return (
      required.every((key) => names.includes(key)) &&
      names.length >= required.length &&
      names.every((key) => allowed.has(key)) &&
      names.every((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    );
  } catch {
    return false;
  }
}

function captureRequestContext(input: unknown): RuntimeRequestContext | undefined {
  const captured = snapshotRuntimeJsonValue(input);
  if (
    !isRuntimeJsonObject(captured) ||
    !exactAllowedKeys(captured, ["documentId", "requestId", "revision", "surfaceId"])
  ) {
    return undefined;
  }
  const documentId = ownDataValue(captured, "documentId");
  const requestId = ownDataValue(captured, "requestId");
  const revision = ownDataValue(captured, "revision");
  const surfaceId = ownDataValue(captured, "surfaceId");
  if (
    !documentId.valid ||
    !documentId.present ||
    typeof documentId.value !== "string" ||
    !requestId.valid ||
    !requestId.present ||
    typeof requestId.value !== "string" ||
    !revision.valid ||
    !revision.present ||
    typeof revision.value !== "string" ||
    !surfaceId.valid ||
    !surfaceId.present ||
    typeof surfaceId.value !== "string"
  ) {
    return undefined;
  }
  return Object.freeze({
    documentId: documentId.value,
    requestId: requestId.value,
    revision: revision.value,
    surfaceId: surfaceId.value,
  });
}

function captureTokenResolution(input: unknown): RuntimeTokenResolutionCapture {
  if (!isPlainRecord(input)) return Object.freeze({ status: "malformed" });
  let keys: readonly PropertyKey[];
  const values = Object.create(null) as Record<string, unknown>;
  try {
    keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string")) {
      return Object.freeze({ status: "malformed" });
    }
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return Object.freeze({ status: "malformed" });
      }
      values[key] = descriptor.value;
    }
  } catch {
    return Object.freeze({ status: "malformed" });
  }
  const names = keys as string[];
  if (names.length === 1 && names.includes("status") && values.status === "missing") {
    return Object.freeze({
      status: "captured",
      result: Object.freeze({ status: "missing" }),
    });
  }
  if (
    names.length !== 2 ||
    !names.includes("status") ||
    !names.includes("value") ||
    values.status !== "resolved"
  ) {
    return Object.freeze({ status: "malformed" });
  }
  const capturedValue = snapshotRuntimeJsonValue(values.value);
  if (capturedValue === undefined) {
    return Object.freeze({ status: "malformed" });
  }
  return Object.freeze({
    status: "captured",
    result: Object.freeze({ status: "resolved", value: capturedValue }),
  });
}

function retentionFits(
  cache: ReadonlyMap<string, CachedTokenResolution>,
  token: string,
  result: RuntimeTokenResolution,
): boolean {
  const retained: (readonly [string, RuntimeTokenResolution])[] = [];
  for (const [cachedToken, cachedResult] of cache) {
    if (cachedResult !== "failed") retained.push(Object.freeze([cachedToken, cachedResult]));
  }
  retained.push(Object.freeze([token, result]));
  retained.sort(([left], [right]) => compareText(left, right));
  return snapshotRuntimeJsonValue(retained) !== undefined;
}

function active(authority: RuntimeActionTokenAuthority): boolean {
  try {
    return Reflect.apply(authority.isActive, undefined, []) === true;
  } catch {
    return false;
  }
}

function createTokenPort(authority: RuntimeActionTokenAuthority): RuntimeTokenPort {
  return Object.freeze({
    resolve(request: Parameters<RuntimeTokenPort["resolve"]>[0]) {
      const token = request.token;
      if (!active(authority)) throw new TypeError("The action lifetime is no longer active.");
      if (authority.budgetExceeded) {
        throw new TypeError("The action token-retention budget was already exhausted.");
      }
      const cached = authority.cache.get(token);
      if (cached === "failed") throw new TypeError("The cached token lookup failed.");
      if (cached !== undefined) return cached;

      let captured: RuntimeTokenResolutionCapture;
      try {
        const raw = Reflect.apply(authority.resolveToken, undefined, [
          Object.freeze({ context: authority.requestContext, token }),
        ]);
        if (!active(authority)) throw new TypeError("The action was revoked during token lookup.");
        captured = captureTokenResolution(raw);
        if (!active(authority)) throw new TypeError("The action was revoked during token capture.");
      } catch {
        authority.cache.set(token, "failed");
        throw new TypeError("The token provider failed.");
      }
      if (captured.status === "malformed") {
        authority.cache.set(token, "failed");
        throw new TypeError("The token provider returned malformed data.");
      }
      if (!retentionFits(authority.cache, token, captured.result)) {
        authority.budgetExceeded = true;
        authority.cache.set(token, "failed");
        throw new RangeError("The action token-retention budget was exhausted.");
      }
      authority.cache.set(token, captured.result);
      return captured.result;
    },
  });
}

function sessionAuthority(
  session: RuntimeActionEvaluationSession,
): RuntimeActionEvaluationAuthority {
  if (typeof session !== "object" || session === null) {
    throw new TypeError("Action evaluation requires a factory-created session.");
  }
  const authority = ACTION_EVALUATION_AUTHORITIES.get(session);
  if (authority === undefined) {
    throw new TypeError("Action evaluation requires a factory-created session.");
  }
  return authority;
}

function materializationContext(authority: RuntimeActionEvaluationAuthority) {
  return Object.freeze({
    requestContext: authority.requestContext,
    tokens: authority.tokenPort,
  });
}

function invalidMaterialization(pointer: JsonPointer = ROOT_POINTER): RuntimeValueInvalid {
  return Object.freeze({
    status: "invalid",
    pointer,
    reason: "unsafe-or-unbounded-json",
  });
}

function remapArrayPointer(keys: readonly string[], pointer: JsonPointer): JsonPointer {
  try {
    const segments = parseJsonPointer(pointer);
    const first = segments[0];
    if (first !== undefined && /^(?:0|[1-9][0-9]*)$/u.test(first) && Number(first) < keys.length) {
      let mapped = appendJsonPointer(ROOT_POINTER, keys[Number(first)] as string);
      for (const segment of segments.slice(1)) mapped = appendJsonPointer(mapped, segment);
      return mapped;
    }
  } catch {
    return ROOT_POINTER;
  }
  return pointer;
}

/**
 * Creates one bounded token-observation session shared by an action guard and its payload.
 *
 * @internal Each provider result is captured once as closed frozen JSON. Before retention, the
 * complete sorted `[token, result]` set is re-snapshotted through the M04-T02 aggregate safety
 * limits, so individually valid values cannot accumulate without bound across materializations.
 */
export function createRuntimeActionEvaluationSession(
  input: RuntimeActionEvaluationSessionInput,
): RuntimeActionEvaluationSession {
  if (!isPlainRecord(input) || !exactAllowedKeys(input, ["isActive", "requestContext", "tokens"])) {
    throw new TypeError("Invalid action evaluation session input.");
  }
  const requestContext = ownDataValue(input, "requestContext");
  const tokens = ownDataValue(input, "tokens");
  const isActive = ownDataValue(input, "isActive");
  const capturedContext =
    requestContext.valid && requestContext.present
      ? captureRequestContext(requestContext.value)
      : undefined;
  if (
    capturedContext === undefined ||
    !tokens.valid ||
    !tokens.present ||
    !isPlainRecord(tokens.value) ||
    !exactAllowedKeys(tokens.value, ["resolve"]) ||
    !isActive.valid ||
    !isActive.present ||
    typeof isActive.value !== "function"
  ) {
    throw new TypeError("Invalid action evaluation session input.");
  }
  const resolve = ownDataValue(tokens.value, "resolve");
  if (!resolve.valid || !resolve.present || typeof resolve.value !== "function") {
    throw new TypeError("Invalid action token port.");
  }

  const authority: RuntimeActionEvaluationAuthority = {
    requestContext: capturedContext,
    resolveToken: resolve.value as RuntimeTokenPort["resolve"],
    isActive: isActive.value as () => boolean,
    cache: new Map<string, CachedTokenResolution>(),
    budgetExceeded: false,
    tokenPort: undefined as unknown as RuntimeTokenPort,
  };
  authority.tokenPort = createTokenPort(authority);
  const session = Object.freeze({}) as RuntimeActionEvaluationSession;
  ACTION_EVALUATION_AUTHORITIES.set(session, authority);
  return session;
}

/**
 * Captures only the optional `when` own data property.
 *
 * @internal No action discriminator, payload, extensions, accessor, or host callback is observed.
 */
export function captureRuntimeActionWhen(action: unknown): RuntimeActionWhenCapture {
  if (typeof action !== "object" || action === null || Array.isArray(action)) {
    return Object.freeze({ status: "invalid", pointer: ROOT_POINTER });
  }
  const when = ownDataValue(action, "when");
  if (!when.valid || (when.present && when.value === undefined)) {
    return Object.freeze({ status: "invalid", pointer: ROOT_POINTER });
  }
  return Object.freeze({
    status: "captured",
    when: when.present ? (when.value as RuntimePredicateSpec) : undefined,
  });
}

/**
 * Prepares and fully materializes one action guard through its action-wide token session.
 *
 * @internal Reporting, payload inspection, state checks, and effects remain caller-owned.
 */
export function evaluateRuntimeActionGuard(
  session: RuntimeActionEvaluationSession,
  when: RuntimePredicateSpec | undefined,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeActionGuardEvaluation {
  const authority = sessionAuthority(session);
  if (authority.budgetExceeded) {
    return Object.freeze({ status: "invalid", pointer: ROOT_POINTER });
  }
  let prepared: ReturnType<typeof prepareRuntimePredicateEvaluation>;
  try {
    prepared = prepareRuntimePredicateEvaluation(when ?? ({ op: "truthy", args: [true] } as const));
  } catch {
    return Object.freeze({ status: "invalid", pointer: ROOT_POINTER });
  }
  if ("status" in prepared) {
    return Object.freeze({ status: "invalid", pointer: prepared.pointer });
  }

  const outcomes: RuntimeValueResolution[] = [];
  for (const operand of prepared.operands) {
    const spec =
      operand.mode === "exists-primary"
        ? ({ $ref: (operand.spec as { readonly $ref: string }).$ref } as const)
        : operand.spec;
    let result: RuntimeValueMaterialization;
    try {
      result = materializeRuntimeValue(spec, snapshot, materializationContext(authority));
    } catch {
      return Object.freeze({ status: "invalid", pointer: operand.pointer });
    }
    if (result.status === "failed") {
      return authority.budgetExceeded
        ? Object.freeze({ status: "invalid", pointer: operand.pointer })
        : Object.freeze({ status: "adapter-failed", pointer: operand.pointer });
    }
    if (result.status === "invalid") {
      return Object.freeze({ status: "invalid", pointer: operand.pointer });
    }
    if (result.status === "unresolved" && !("reference" in result)) {
      outcomes.push(
        Object.freeze({
          status: "unresolved",
          code: "REFERENCE_UNRESOLVED",
          pointer: result.pointer,
          reference: `$token:${result.token}`,
          reason: "missing-path",
        }),
      );
    } else {
      outcomes.push(result as RuntimeValueResolution);
    }
  }

  try {
    const evaluation = evaluatePreparedRuntimePredicate(prepared, Object.freeze(outcomes));
    return evaluation.status === "evaluated"
      ? Object.freeze({
          status: "evaluated",
          value: evaluation.value,
          diagnostics: evaluation.diagnostics,
        })
      : Object.freeze({ status: "invalid", pointer: evaluation.pointer });
  } catch {
    return Object.freeze({ status: "invalid", pointer: ROOT_POINTER });
  }
}

/** @internal Materializes one ValueSpec through the action-wide token session. */
export function materializeRuntimeActionValue(
  session: RuntimeActionEvaluationSession,
  spec: RuntimeValueSpec,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeValueMaterialization {
  const authority = sessionAuthority(session);
  if (authority.budgetExceeded) return invalidMaterialization();
  try {
    const result = materializeRuntimeValue(spec, snapshot, materializationContext(authority));
    return authority.budgetExceeded && result.status === "failed"
      ? invalidMaterialization(result.pointer)
      : result;
  } catch {
    return invalidMaterialization();
  }
}

/**
 * Captures and materializes one named ValueSpec map as a single sorted synthetic array.
 *
 * @internal Accessors are rejected without invocation. Failure pointers are remapped from array
 * positions to original names and the successful map is detached and recursively frozen.
 */
export function materializeRuntimeActionNamedValues(
  session: RuntimeActionEvaluationSession,
  input: unknown,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeValueMaterialization {
  const captured = snapshotRuntimeJsonValue(input);
  if (!isRuntimeJsonObject(captured)) return invalidMaterialization();
  const keys = Object.keys(captured).sort(compareText);
  const specs = keys.map((key) => captured[key] as RuntimeValueSpec);
  const result = materializeRuntimeActionValue(session, specs, snapshot);
  if (result.status !== "resolved") {
    return Object.freeze({
      ...result,
      pointer: remapArrayPointer(keys, result.pointer),
    }) as RuntimeValueMaterialization;
  }
  if (!Array.isArray(result.value) || result.value.length !== keys.length) {
    return invalidMaterialization();
  }
  const values: Record<string, RuntimeJsonValue> = Object.create(null);
  for (const [index, key] of keys.entries()) {
    values[key] = result.value[index] as RuntimeJsonValue;
  }
  const detached = snapshotRuntimeJsonValue(values);
  return isRuntimeJsonObject(detached)
    ? Object.freeze({ status: "resolved", value: detached, usedFallback: result.usedFallback })
    : invalidMaterialization();
}
