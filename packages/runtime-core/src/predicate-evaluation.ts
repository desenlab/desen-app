import { appendJsonPointer, canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { RUNTIME_VALUE_SAFETY_LIMITS, resolveRuntimeValue } from "./value-resolution.js";

import type { JsonPointer } from "@desen/protocol";
import type { RuntimeJsonObject, RuntimeJsonPrimitive, RuntimeJsonValue } from "./host-ports.js";
import type {
  RuntimeLifecycleReferenceSnapshot,
  RuntimeReferenceFailureReason,
  RuntimeResolutionSnapshot,
  RuntimeValueInvalidReason,
  RuntimeValueResolution,
  RuntimeValueSpec,
} from "./value-resolution.js";

const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const REFERENCE_PATTERN =
  /^(state|context|resource|operation|event|item|env)(\.[A-Za-z_][A-Za-z0-9_-]*)+$/u;
const FORMAT_VALUE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const ROOT_POINTER = createJsonPointer();
const PREPARED_PREDICATE_BRAND = new WeakSet<object>();
const PREDICATE_OPERATORS = Object.freeze([
  "all",
  "any",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "exists",
  "truthy",
] as const);
const PREDICATE_OPERATOR_SET = new Set<string>(PREDICATE_OPERATORS);
const ONE_ARGUMENT_OPERATORS = new Set<RuntimePredicateOperator>(["not", "exists", "truthy"]);
const TWO_ARGUMENT_OPERATORS = new Set<RuntimePredicateOperator>([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
]);
const MAX_PREDICATE_NODES = 64;
const EXISTS_PRESENT_RESOLUTION = Object.freeze({
  status: "resolved",
  value: null,
  usedFallback: false,
} as const satisfies RuntimeValueResolution);

/** One of the thirteen closed DESEN 0.1.0 predicate operators. */
export type RuntimePredicateOperator = (typeof PREDICATE_OPERATORS)[number];

/** A nested predicate or ordinary DESEN value form accepted at one predicate argument. */
export type RuntimePredicateArgument = RuntimeValueSpec | RuntimePredicateSpec;

/** A closed DESEN predicate evaluated against one immutable runtime snapshot. */
export interface RuntimePredicateSpec {
  /** Exact protocol operator; arbitrary expressions and executable names are not accepted. */
  readonly op: RuntimePredicateOperator;
  /** Ordered operands whose allowed count is fixed by the selected operator. */
  readonly args: readonly RuntimePredicateArgument[];
}

/** Portable diagnostic emitted when resolved operands are dynamically incompatible. */
export interface RuntimePredicateTypeMismatch {
  /** Frozen protocol diagnostic code for incompatible predicate operands. */
  readonly code: "PREDICATE_TYPE_MISMATCH";
  /** Exact relative JSON Pointer to the incompatible argument. */
  readonly pointer: JsonPointer;
}

/** Stable reason why a predicate could not enter deterministic evaluation. */
export type RuntimePredicateInvalidReason = RuntimeValueInvalidReason | "malformed-predicate";

/** A malformed, hostile, or over-budget predicate with no partial boolean result. */
export interface RuntimePredicateInvalid {
  /** Discriminates invalid input from evaluated and deferred outcomes. */
  readonly status: "invalid";
  /** Exact relative location when it is safely discoverable. */
  readonly pointer: JsonPointer;
  /** Stable fail-closed classification. */
  readonly reason: RuntimePredicateInvalidReason;
}

/** A predicate whose token or format operand requires the M04-T05 composition step. */
export interface RuntimePredicateDeferred {
  /** Discriminates incomplete materialization from a valid boolean result. */
  readonly status: "deferred";
  /** Exact value form that is not owned by the T02-only evaluator. */
  readonly form: "token" | "format";
  /** Exact relative pointer to the deferred value form. */
  readonly pointer: JsonPointer;
}

/** A complete deterministic predicate result and its ordered dynamic diagnostics. */
export interface RuntimePredicateEvaluated {
  /** Discriminates a real boolean result from invalid or deferred evaluation. */
  readonly status: "evaluated";
  /** Complete predicate truth value. */
  readonly value: boolean;
  /** Frozen diagnostics in depth-first, left-to-right document order. */
  readonly diagnostics: readonly RuntimePredicateTypeMismatch[];
}

/** Complete outcome of evaluating one predicate against one atomic snapshot. */
export type RuntimePredicateEvaluation =
  RuntimePredicateEvaluated | RuntimePredicateInvalid | RuntimePredicateDeferred;

/**
 * Conditional-instantiation decision for an optional node `when`.
 *
 * @remarks `present: false` means the node must not be instantiated; it is not a request for a
 * visually hidden node. Invalid and deferred decisions remain distinguishable from a predicate
 * that evaluated to false.
 */
export type RuntimeConditionalPresence =
  | Readonly<{
      readonly status: "evaluated";
      readonly present: boolean;
      readonly diagnostics: readonly RuntimePredicateTypeMismatch[];
    }>
  | Readonly<{
      readonly status: "deferred";
      readonly present: false;
      readonly form: "token" | "format";
      readonly pointer: JsonPointer;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly present: false;
      readonly pointer: JsonPointer;
      readonly reason: RuntimePredicateInvalidReason;
    }>;

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

interface PreparedValueArgument {
  readonly kind: "value";
  readonly operandIndex: number;
}

interface PreparedNestedPredicateArgument {
  readonly kind: "predicate";
  readonly predicate: PreparedPredicateNode;
}

type PreparedPredicateArgument = PreparedValueArgument | PreparedNestedPredicateArgument;

interface PreparedPredicateNode {
  readonly op: RuntimePredicateOperator;
  readonly pointer: JsonPointer;
  readonly args: readonly PreparedPredicateArgument[];
}

interface RuntimePreparedPredicateOperand {
  readonly pointer: JsonPointer;
  readonly mode: "value" | "exists-primary";
  readonly spec: RuntimeValueSpec;
}

interface PreparedRuntimePredicateEvaluation {
  readonly root: PreparedPredicateNode;
  readonly operands: readonly RuntimePreparedPredicateOperand[];
}

interface PredicatePreparationBudget {
  argumentOccurrences: number;
  predicateNodes: number;
}

interface PredicateEvaluationContext {
  readonly operands: readonly RuntimePreparedPredicateOperand[];
  readonly outcomes: readonly RuntimeValueResolution[];
  readonly diagnostics: RuntimePredicateTypeMismatch[];
  readonly canonicalIdentities: WeakMap<object, string>;
}

interface EvaluatedArgument {
  readonly value: RuntimeJsonValue | boolean;
  readonly directlyUnresolved: boolean;
}

interface RuntimeValueBudget {
  jsonNodes: number;
  stringCodeUnits: number;
}

type RuntimePredicateOperandResolution =
  readonly RuntimeValueResolution[] | RuntimePredicateInvalid | RuntimePredicateDeferred;

interface RuntimePresenceResolved {
  readonly status: "resolved";
}

interface RuntimePresenceMissing {
  readonly status: "missing";
  readonly reason: RuntimeReferenceFailureReason;
}

type RuntimePresenceLookup = RuntimePresenceResolved | RuntimePresenceMissing;

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

// Predicate input crosses the same hostile-language boundary as ValueSpec input. This local copy
// intentionally mirrors the M04-T02 profile so earlier task-owned bytes remain immutable evidence.
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

function probeObjectPath(
  root: RuntimeJsonValue,
  segments: readonly string[],
): RuntimePresenceLookup {
  let value = root;
  for (const segment of segments) {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      !Object.hasOwn(value, segment)
    ) {
      return { status: "missing", reason: "missing-path" };
    }
    value = (value as RuntimeJsonObject)[segment] as RuntimeJsonValue;
  }
  return { status: "resolved" };
}

function probeRootedNamespace(
  roots: RuntimeJsonObject,
  segments: readonly string[],
): RuntimePresenceLookup {
  const rootName = segments[1] as string;
  if (!Object.hasOwn(roots, rootName)) {
    return { status: "missing", reason: "unknown-root" };
  }
  return probeObjectPath(roots[rootName] as RuntimeJsonValue, segments.slice(2));
}

function probeLifecycleReference(
  roots: Readonly<Record<string, RuntimeLifecycleReferenceSnapshot>>,
  segments: readonly string[],
): RuntimePresenceLookup {
  const rootName = segments[1] as string;
  if (!Object.hasOwn(roots, rootName)) {
    return { status: "missing", reason: "unknown-root" };
  }
  const lifecycle = roots[rootName] as RuntimeLifecycleReferenceSnapshot;
  const field = segments[2] as string | undefined;
  if ((field === "status" || field === "pending") && segments.length === 3) {
    return { status: "resolved" };
  }
  if (field === "value") {
    return lifecycle.status === "succeeded"
      ? probeObjectPath(lifecycle.value, segments.slice(3))
      : { status: "missing", reason: "missing-path" };
  }
  if (field === "error" && segments.length === 4 && segments[3] === "code") {
    return lifecycle.status === "failed"
      ? { status: "resolved" }
      : { status: "missing", reason: "missing-path" };
  }
  return { status: "missing", reason: "invalid-path" };
}

// `exists` projects only reference status. This mirrors the M04-T02 path allowlist while avoiding
// the complete-value copy and aggregate charge that ordinary value resolution intentionally adds.
function probeRuntimeReferencePresence(
  reference: string,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeValueResolution {
  const segments = reference.split(".");
  const namespace = segments[0] as string;
  let lookup: RuntimePresenceLookup;
  if (namespace === "state") {
    lookup = probeRootedNamespace(snapshot.state, segments);
  } else if (namespace === "context") {
    lookup = probeObjectPath(snapshot.context, segments.slice(1));
  } else if (namespace === "resource") {
    lookup = probeLifecycleReference(snapshot.resource, segments);
  } else if (namespace === "operation") {
    lookup = probeLifecycleReference(snapshot.operation, segments);
  } else if (namespace === "event") {
    lookup =
      snapshot.event.status === "unavailable"
        ? { status: "missing", reason: "inactive-scope" }
        : probeObjectPath(snapshot.event.value, segments.slice(1));
  } else if (namespace === "item") {
    lookup = probeRootedNamespace(snapshot.item, segments);
  } else {
    lookup = probeObjectPath(snapshot.env, segments.slice(1));
  }
  return lookup.status === "resolved"
    ? EXISTS_PRESENT_RESOLUTION
    : Object.freeze({
        status: "unresolved",
        code: "REFERENCE_UNRESOLVED",
        pointer: appendJsonPointer(ROOT_POINTER, "$ref"),
        reference,
        reason: lookup.reason,
      });
}

function hasExactKeys(record: JsonSnapshotObject, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort(compareText);
  if (actual.length !== expected.length) return false;
  return actual.every((key, index) => key === expected[index]);
}

function invalidPredicate(
  pointer: JsonPointer,
  reason: RuntimePredicateInvalidReason,
): RuntimePredicateInvalid {
  return Object.freeze({ status: "invalid", pointer, reason });
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return relative === ROOT_POINTER ? base : (`${base}${relative}` as JsonPointer);
}

function expectedArity(operator: RuntimePredicateOperator, length: number): boolean {
  if (operator === "all" || operator === "any") return length >= 1 && length <= 64;
  if (ONE_ARGUMENT_OPERATORS.has(operator)) return length === 1;
  return TWO_ARGUMENT_OPERATORS.has(operator) && length === 2;
}

function validPredicateShape(value: JsonSnapshotValue): value is JsonSnapshotObject & {
  readonly op: RuntimePredicateOperator;
  readonly args: JsonSnapshotValue[];
} {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["args", "op"]) &&
    typeof value.op === "string" &&
    PREDICATE_OPERATOR_SET.has(value.op) &&
    Array.isArray(value.args) &&
    expectedArity(value.op as RuntimePredicateOperator, value.args.length)
  );
}

function validateRuntimeValueSpecShape(
  value: JsonSnapshotValue,
  pointer: JsonPointer,
): RuntimePredicateInvalid | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const invalid = validateRuntimeValueSpecShape(
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
      const invalid = validateRuntimeValueSpecShape(
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
      return invalidPredicate(appendJsonPointer(pointer, "$ref"), "malformed-reference");
    }
    return Object.hasOwn(value, "fallback")
      ? validateRuntimeValueSpecShape(
          value.fallback as JsonSnapshotValue,
          appendJsonPointer(pointer, "fallback"),
        )
      : undefined;
  }

  if (reservedKey === "$token") {
    return keys.length === 1 && typeof value.$token === "string" && value.$token.length > 0
      ? undefined
      : invalidPredicate(appendJsonPointer(pointer, "$token"), "malformed-token");
  }

  if (reservedKey === "$format") {
    if (keys.length !== 1 || !isRecord(value.$format)) {
      return invalidPredicate(appendJsonPointer(pointer, "$format"), "malformed-format");
    }
    const format = value.$format;
    if (
      !hasExactKeys(format, ["template", "values"]) ||
      typeof format.template !== "string" ||
      !isRecord(format.values)
    ) {
      return invalidPredicate(appendJsonPointer(pointer, "$format"), "malformed-format");
    }
    const valuesPointer = appendJsonPointer(appendJsonPointer(pointer, "$format"), "values");
    for (const name of Object.keys(format.values).sort(compareText)) {
      if (!FORMAT_VALUE_NAME_PATTERN.test(name)) {
        return invalidPredicate(appendJsonPointer(valuesPointer, name), "malformed-format");
      }
      const invalid = validateRuntimeValueSpecShape(
        format.values[name] as JsonSnapshotValue,
        appendJsonPointer(valuesPointer, name),
      );
      if (invalid !== undefined) return invalid;
    }
    return undefined;
  }

  return invalidPredicate(appendJsonPointer(pointer, reservedKey), "reserved-literal-key");
}

function malformedRootPredicate(value: JsonSnapshotValue): RuntimePredicateInvalid | undefined {
  if (!isRecord(value)) return invalidPredicate(ROOT_POINTER, "malformed-predicate");
  const keys = Object.keys(value).sort(compareText);
  const extra = keys.find((key) => key !== "args" && key !== "op");
  if (extra !== undefined) {
    return invalidPredicate(appendJsonPointer(ROOT_POINTER, extra), "malformed-predicate");
  }
  if (!Object.hasOwn(value, "op") || typeof value.op !== "string") {
    return invalidPredicate(appendJsonPointer(ROOT_POINTER, "op"), "malformed-predicate");
  }
  if (!PREDICATE_OPERATOR_SET.has(value.op)) {
    return invalidPredicate(appendJsonPointer(ROOT_POINTER, "op"), "malformed-predicate");
  }
  if (!Object.hasOwn(value, "args") || !Array.isArray(value.args)) {
    return invalidPredicate(appendJsonPointer(ROOT_POINTER, "args"), "malformed-predicate");
  }
  if (!expectedArity(value.op as RuntimePredicateOperator, value.args.length)) {
    return invalidPredicate(appendJsonPointer(ROOT_POINTER, "args"), "malformed-predicate");
  }
  return undefined;
}

function preparePredicateNode(
  predicate: JsonSnapshotObject & {
    readonly op: RuntimePredicateOperator;
    readonly args: JsonSnapshotValue[];
  },
  pointer: JsonPointer,
  operands: RuntimePreparedPredicateOperand[],
  budget: PredicatePreparationBudget,
): PreparedPredicateNode | RuntimePredicateInvalid {
  budget.predicateNodes += 1;
  budget.argumentOccurrences += predicate.args.length;
  if (
    budget.predicateNodes > MAX_PREDICATE_NODES ||
    budget.argumentOccurrences > RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes
  ) {
    return invalidPredicate(ROOT_POINTER, "unsafe-or-unbounded-json");
  }

  const args: PreparedPredicateArgument[] = [];
  for (let index = 0; index < predicate.args.length; index += 1) {
    const argument = predicate.args[index] as JsonSnapshotValue;
    const argumentPointer = appendJsonPointer(appendJsonPointer(pointer, "args"), index);
    if (validPredicateShape(argument)) {
      const nested = preparePredicateNode(argument, argumentPointer, operands, budget);
      if ("status" in nested) return nested;
      args.push(Object.freeze({ kind: "predicate", predicate: nested }));
      continue;
    }

    const invalid = validateRuntimeValueSpecShape(argument, argumentPointer);
    if (invalid !== undefined) return invalid;
    const operandIndex = operands.length;
    const existsPrimary =
      predicate.op === "exists" &&
      isRecord(argument) &&
      Object.hasOwn(argument, "$ref") &&
      typeof argument.$ref === "string";
    operands.push(
      Object.freeze({
        pointer: argumentPointer,
        mode: existsPrimary ? "exists-primary" : "value",
        spec: argument as RuntimeValueSpec,
      }),
    );
    args.push(Object.freeze({ kind: "value", operandIndex }));
  }

  return Object.freeze({ op: predicate.op, pointer, args: Object.freeze(args) });
}

/**
 * Prepares a bounded predicate and its ordered ValueSpec operands without resolving any value.
 *
 * @internal This data-only package-internal seam lets M04-T05 complete deferred operands without
 * exposing a public executable resolver callback.
 */
export function prepareRuntimePredicateEvaluation(
  predicate: RuntimePredicateSpec,
): PreparedRuntimePredicateEvaluation | RuntimePredicateInvalid {
  const copied = inertBoundedJsonSnapshot(predicate);
  if (copied === undefined) return invalidPredicate(ROOT_POINTER, "unsafe-or-unbounded-json");
  const malformed = malformedRootPredicate(copied);
  if (malformed !== undefined) return malformed;

  const operands: RuntimePreparedPredicateOperand[] = [];
  const root = preparePredicateNode(
    copied as JsonSnapshotObject & {
      readonly op: RuntimePredicateOperator;
      readonly args: JsonSnapshotValue[];
    },
    ROOT_POINTER,
    operands,
    { argumentOccurrences: 0, predicateNodes: 0 },
  );
  if ("status" in root) return root;
  const prepared = Object.freeze({ root, operands: Object.freeze(operands) });
  PREPARED_PREDICATE_BRAND.add(prepared);
  return prepared;
}

/**
 * Resolves prepared operands against the same factory-created snapshot in document order.
 *
 * @internal `exists-primary` operands deliberately omit fallback while the full fallback shape has
 * already passed preparation. A complete invalid or deferred outcome returns at its first ordered
 * position. Resolved values are charged to one aggregate budget immediately, so an over-budget
 * predicate stops before later operands can amplify retained value copies.
 */
export function resolveRuntimePredicateOperands(
  prepared: PreparedRuntimePredicateEvaluation,
  snapshot: RuntimeResolutionSnapshot,
): RuntimePredicateOperandResolution {
  if (!PREPARED_PREDICATE_BRAND.has(prepared)) {
    throw new TypeError("Runtime predicate operands require a prepared predicate evaluation.");
  }
  // Validate the opaque factory brand before the specialized presence probe reads the snapshot.
  resolveRuntimeValue(true, snapshot);
  const budget: RuntimeValueBudget = { jsonNodes: 0, stringCodeUnits: 0 };
  const outcomes: RuntimeValueResolution[] = [];
  for (const operand of prepared.operands) {
    const outcome =
      operand.mode === "exists-primary"
        ? probeRuntimeReferencePresence((operand.spec as { readonly $ref: string }).$ref, snapshot)
        : resolveRuntimeValue(operand.spec, snapshot);
    if (outcome.status === "invalid" || outcome.status === "deferred") {
      return relocateTerminalOutcome(outcome, operand.pointer);
    }
    if (outcome.status === "resolved" && !chargeResolvedValue(outcome.value, budget)) {
      return invalidPredicate(ROOT_POINTER, "unsafe-or-unbounded-json");
    }
    outcomes.push(outcome);
  }
  return Object.freeze(outcomes);
}

function chargeResolvedValue(value: RuntimeJsonValue, budget: RuntimeValueBudget): boolean {
  const pending: { readonly value: RuntimeJsonValue; readonly depth: number }[] = [
    { value, depth: 0 },
  ];
  while (pending.length > 0) {
    const current = pending.pop() as {
      readonly value: RuntimeJsonValue;
      readonly depth: number;
    };
    if (current.depth > RUNTIME_VALUE_SAFETY_LIMITS.maxDepth) return false;
    budget.jsonNodes += 1;
    if (budget.jsonNodes > RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes) return false;
    if (typeof current.value === "string") {
      budget.stringCodeUnits += current.value.length;
      if (budget.stringCodeUnits > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits) return false;
      continue;
    }
    if (typeof current.value !== "object" || current.value === null) continue;
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({ value: current.value[index] as RuntimeJsonValue, depth: current.depth + 1 });
      }
      continue;
    }
    const record = current.value as RuntimeJsonObject;
    const keys = Object.keys(record);
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as string;
      budget.stringCodeUnits += key.length;
      if (budget.stringCodeUnits > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits) return false;
      pending.push({
        value: record[key] as RuntimeJsonValue,
        depth: current.depth + 1,
      });
    }
  }
  return true;
}

function relocateTerminalOutcome(
  outcome: Exclude<RuntimeValueResolution, { readonly status: "resolved" | "unresolved" }>,
  pointer: JsonPointer,
): RuntimePredicateInvalid | RuntimePredicateDeferred {
  return outcome.status === "deferred"
    ? Object.freeze({
        status: "deferred",
        form: outcome.form,
        pointer: prefixPointer(pointer, outcome.pointer),
      })
    : invalidPredicate(prefixPointer(pointer, outcome.pointer), outcome.reason);
}

function canonicalIdentity(
  value: RuntimeJsonValue | boolean,
  cache: WeakMap<object, string>,
): string {
  if (typeof value === "object" && value !== null) {
    const cached = cache.get(value);
    if (cached !== undefined) return cached;
    const identity = canonicalizeJson(value);
    cache.set(value, identity);
    return identity;
  }
  return canonicalizeJson(value);
}

function typeMismatch(diagnostics: RuntimePredicateTypeMismatch[], pointer: JsonPointer): void {
  diagnostics.push(Object.freeze({ code: "PREDICATE_TYPE_MISMATCH", pointer }));
}

function truthy(value: RuntimeJsonValue | boolean): boolean {
  if (value === null || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value !== "object" || Object.keys(value).length > 0;
}

function evaluateArgument(
  argument: PreparedPredicateArgument,
  context: PredicateEvaluationContext,
): EvaluatedArgument {
  if (argument.kind === "predicate") {
    return {
      value: evaluatePredicateNode(argument.predicate, context),
      directlyUnresolved: false,
    };
  }
  const outcome = context.outcomes[argument.operandIndex] as RuntimeValueResolution;
  return outcome.status === "unresolved"
    ? { value: false, directlyUnresolved: true }
    : { value: (outcome as { readonly value: RuntimeJsonValue }).value, directlyUnresolved: false };
}

function evaluateBooleanComposition(
  node: PreparedPredicateNode,
  args: readonly EvaluatedArgument[],
  context: PredicateEvaluationContext,
): boolean {
  let mismatch = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] as EvaluatedArgument;
    if (!argument.directlyUnresolved && typeof argument.value !== "boolean") {
      typeMismatch(
        context.diagnostics,
        appendJsonPointer(appendJsonPointer(node.pointer, "args"), index),
      );
      mismatch = true;
    }
  }
  if (mismatch || args.some((argument) => argument.directlyUnresolved)) return false;
  const values = args.map((argument) => argument.value as boolean);
  if (node.op === "all") return values.every(Boolean);
  if (node.op === "any") return values.some(Boolean);
  return !(values[0] as boolean);
}

function evaluateOrdering(
  node: PreparedPredicateNode,
  args: readonly EvaluatedArgument[],
  context: PredicateEvaluationContext,
): boolean {
  const left = args[0] as EvaluatedArgument;
  const right = args[1] as EvaluatedArgument;
  let mismatch = false;
  if (
    !left.directlyUnresolved &&
    typeof left.value !== "number" &&
    typeof left.value !== "string"
  ) {
    typeMismatch(
      context.diagnostics,
      appendJsonPointer(appendJsonPointer(node.pointer, "args"), 0),
    );
    mismatch = true;
  }
  if (
    !right.directlyUnresolved &&
    typeof right.value !== "number" &&
    typeof right.value !== "string"
  ) {
    typeMismatch(
      context.diagnostics,
      appendJsonPointer(appendJsonPointer(node.pointer, "args"), 1),
    );
    mismatch = true;
  } else if (
    !left.directlyUnresolved &&
    !right.directlyUnresolved &&
    (typeof left.value === "number" || typeof left.value === "string") &&
    typeof left.value !== typeof right.value
  ) {
    typeMismatch(
      context.diagnostics,
      appendJsonPointer(appendJsonPointer(node.pointer, "args"), 1),
    );
    mismatch = true;
  }
  if (mismatch || left.directlyUnresolved || right.directlyUnresolved) return false;

  const leftValue = left.value as number | string;
  const rightValue = right.value as number | string;
  if (node.op === "gt") return leftValue > rightValue;
  if (node.op === "gte") return leftValue >= rightValue;
  if (node.op === "lt") return leftValue < rightValue;
  return leftValue <= rightValue;
}

function evaluateMembership(
  node: PreparedPredicateNode,
  args: readonly EvaluatedArgument[],
  context: PredicateEvaluationContext,
): boolean {
  const collectionIndex = node.op === "in" ? 1 : 0;
  const memberIndex = node.op === "in" ? 0 : 1;
  const collection = args[collectionIndex] as EvaluatedArgument;
  const member = args[memberIndex] as EvaluatedArgument;
  const collectionValue = collection.value;

  if (
    !collection.directlyUnresolved &&
    !Array.isArray(collectionValue) &&
    typeof collectionValue !== "string"
  ) {
    typeMismatch(
      context.diagnostics,
      appendJsonPointer(appendJsonPointer(node.pointer, "args"), collectionIndex),
    );
    return false;
  }
  if (collection.directlyUnresolved || member.directlyUnresolved) return false;
  if (typeof collectionValue === "string") {
    if (typeof member.value !== "string") {
      typeMismatch(
        context.diagnostics,
        appendJsonPointer(appendJsonPointer(node.pointer, "args"), memberIndex),
      );
      return false;
    }
    return collectionValue.includes(member.value);
  }

  const memberIdentity = canonicalIdentity(member.value, context.canonicalIdentities);
  const candidates = collectionValue as readonly RuntimeJsonValue[];
  return candidates.some(
    (candidate) => canonicalIdentity(candidate, context.canonicalIdentities) === memberIdentity,
  );
}

function evaluatePredicateNode(
  node: PreparedPredicateNode,
  context: PredicateEvaluationContext,
): boolean {
  const args = node.args.map((argument) => evaluateArgument(argument, context));
  const unresolved = args.some((argument) => argument.directlyUnresolved);

  if (node.op === "all" || node.op === "any" || node.op === "not") {
    return evaluateBooleanComposition(node, args, context);
  }
  if (node.op === "truthy") {
    return unresolved ? false : truthy((args[0] as EvaluatedArgument).value);
  }
  if (node.op === "exists") {
    const argument = node.args[0] as PreparedPredicateArgument;
    if (
      argument.kind !== "value" ||
      (context.operands[argument.operandIndex] as RuntimePreparedPredicateOperand).mode !==
        "exists-primary"
    ) {
      typeMismatch(
        context.diagnostics,
        appendJsonPointer(appendJsonPointer(node.pointer, "args"), 0),
      );
      return false;
    }
    const operand = context.outcomes[argument.operandIndex] as RuntimeValueResolution;
    return operand.status === "resolved";
  }
  if (node.op === "eq" || node.op === "neq") {
    if (unresolved) return false;
    const equal =
      canonicalIdentity((args[0] as EvaluatedArgument).value, context.canonicalIdentities) ===
      canonicalIdentity((args[1] as EvaluatedArgument).value, context.canonicalIdentities);
    return node.op === "eq" ? equal : !equal;
  }
  if (node.op === "gt" || node.op === "gte" || node.op === "lt" || node.op === "lte") {
    return evaluateOrdering(node, args, context);
  }
  return evaluateMembership(node, args, context);
}

/**
 * Evaluates a prepared predicate from a complete, position-aligned operand outcome array.
 *
 * @internal The function accepts data outcomes rather than an executable resolver callback so
 * later package-internal composition can preserve one snapshot and token session.
 */
export function evaluatePreparedRuntimePredicate(
  prepared: PreparedRuntimePredicateEvaluation,
  outcomes: readonly RuntimeValueResolution[],
): RuntimePredicateEvaluation {
  if (!PREPARED_PREDICATE_BRAND.has(prepared) || outcomes.length !== prepared.operands.length) {
    throw new TypeError("Runtime predicate evaluation requires its exact prepared operand plan.");
  }

  const budget: RuntimeValueBudget = { jsonNodes: 0, stringCodeUnits: 0 };
  for (let index = 0; index < outcomes.length; index += 1) {
    const outcome = outcomes[index] as RuntimeValueResolution;
    const operand = prepared.operands[index] as RuntimePreparedPredicateOperand;
    if (outcome.status === "invalid" || outcome.status === "deferred") {
      return relocateTerminalOutcome(outcome, operand.pointer);
    }
    if (outcome.status === "resolved" && !chargeResolvedValue(outcome.value, budget)) {
      return invalidPredicate(ROOT_POINTER, "unsafe-or-unbounded-json");
    }
  }

  const diagnostics: RuntimePredicateTypeMismatch[] = [];
  const value = evaluatePredicateNode(prepared.root, {
    operands: prepared.operands,
    outcomes,
    diagnostics,
    canonicalIdentities: new WeakMap(),
  });
  return Object.freeze({
    status: "evaluated",
    value,
    diagnostics: Object.freeze(diagnostics),
  });
}

/**
 * Evaluates one closed DESEN predicate against one factory-created atomic snapshot.
 *
 * @remarks All arguments are resolved and evaluated depth-first from left to right without
 * short-circuiting, so diagnostics have deterministic document order. Direct unresolved operands
 * make their current predicate false; a false nested predicate remains an ordinary boolean for its
 * parent. Dynamic type mismatches likewise make the current predicate false and emit an exact
 * `PREDICATE_TYPE_MISMATCH`.
 *
 * Equality and array membership use RFC 8785 canonical JSON. String ordering and substring
 * membership use exact UTF-16 code-unit semantics without locale, normalization, expressions, or
 * host effects. `exists` probes the original reference, including resolved JSON `null`, and never
 * evaluates fallback. Token and format operands remain explicit `deferred` outcomes for M04-T05
 * composition rather than being guessed false.
 *
 * @throws TypeError when `snapshot` was not created by `createRuntimeResolutionSnapshot`.
 */
export function evaluateRuntimePredicate(
  predicate: RuntimePredicateSpec,
  snapshot: RuntimeResolutionSnapshot,
): RuntimePredicateEvaluation {
  const prepared = prepareRuntimePredicateEvaluation(predicate);
  if ("status" in prepared) {
    // Preserve the snapshot trust boundary even when malformed input needs no value lookup.
    resolveRuntimeValue(true, snapshot);
    return prepared;
  }
  const outcomes = resolveRuntimePredicateOperands(prepared, snapshot);
  if ("status" in outcomes) return outcomes;
  return evaluatePreparedRuntimePredicate(prepared, outcomes);
}

/**
 * Decides whether an optional conditional node may be instantiated.
 *
 * @remarks An omitted `when` is present. A predicate that evaluates false is absent, meaning the
 * node and descendants must not be instantiated rather than rendered with hidden styling. Invalid
 * or deferred evaluation also prevents instantiation fail-closed, but its status stays distinct
 * from a valid false result. Complete subtree lifecycle enforcement remains M04-T15/M04-T16.
 *
 * @throws TypeError when `snapshot` was not created by `createRuntimeResolutionSnapshot`.
 */
export function evaluateRuntimeConditionalPresence(
  when: RuntimePredicateSpec | undefined,
  snapshot: RuntimeResolutionSnapshot,
): RuntimeConditionalPresence {
  if (when === undefined) {
    resolveRuntimeValue(true, snapshot);
    return Object.freeze({
      status: "evaluated",
      present: true,
      diagnostics: Object.freeze([]),
    });
  }
  const evaluation = evaluateRuntimePredicate(when, snapshot);
  if (evaluation.status === "evaluated") {
    return Object.freeze({
      status: "evaluated",
      present: evaluation.value,
      diagnostics: evaluation.diagnostics,
    });
  }
  if (evaluation.status === "deferred") {
    return Object.freeze({
      status: "deferred",
      present: false,
      form: evaluation.form,
      pointer: evaluation.pointer,
    });
  }
  return Object.freeze({
    status: "invalid",
    present: false,
    pointer: evaluation.pointer,
    reason: evaluation.reason,
  });
}
