const CODE_UNIT_COMPARATOR = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Reference ceilings for one callback-free React diagnostic index. */
export const RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS = Object.freeze({
  /** Maximum component-plus-behavior binding records admitted atomically. */
  maxBindings: 25_000,
  /** Maximum identifier fields across all admitted binding records. */
  maxIdentifierOccurrences: 115_000,
  /** Maximum aggregate UTF-16 units across distinct retained identifier values. */
  maxIdentifierCodeUnits: 4_194_304,
} as const);

/** Optional trusted profile that may only lower diagnostic-index ceilings. */
export interface RuntimeReactDiagnosticIndexLimitProfile {
  readonly maxBindings?: number;
  readonly maxIdentifierOccurrences?: number;
  readonly maxIdentifierCodeUnits?: number;
}

/** Minimal prepared component identity admitted by the diagnostic-index builder. */
export interface RuntimeReactComponentDiagnosticIndexBinding {
  readonly kind: "component";
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
}

/** Minimal prepared behavior identity admitted by the diagnostic-index builder. */
export interface RuntimeReactBehaviorDiagnosticIndexBinding {
  readonly kind: "behavior";
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly behaviorId: string;
  readonly ownerRuntimeNodeId: string;
}

/**
 * Minimal callback-free identity accepted from the completely prepared renderer binding set.
 *
 * @remarks Props, styles, slots, React values, platform objects, sessions, Catalogs, registries,
 * and callbacks are deliberately absent from this boundary.
 */
export type RuntimeReactDiagnosticIndexBinding =
  RuntimeReactComponentDiagnosticIndexBinding | RuntimeReactBehaviorDiagnosticIndexBinding;

/** Immutable forward diagnostic record for one prepared component runtime node. */
export interface RuntimeReactComponentDiagnosticIndexEntry {
  readonly kind: "component";
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
}

/** Immutable forward diagnostic record for one prepared behavior runtime node. */
export interface RuntimeReactBehaviorDiagnosticIndexEntry {
  readonly kind: "behavior";
  readonly runtimeNodeId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly behaviorId: string;
  readonly ownerRuntimeNodeId: string;
}

/** Complete immutable forward diagnostic record for one prepared runtime node. */
export type RuntimeReactDiagnosticIndexEntry =
  RuntimeReactComponentDiagnosticIndexEntry | RuntimeReactBehaviorDiagnosticIndexEntry;

/**
 * Callback-free immutable lookup index for one completely prepared React surface.
 *
 * @remarks Every lookup record has a null prototype. Inverse arrays are UTF-16 code-unit sorted
 * and support repeated source nodes and repeated behavior attachments without one-to-one guesses.
 */
export interface RuntimeReactDiagnosticIndex {
  readonly byRuntimeNodeId: Readonly<Record<string, RuntimeReactDiagnosticIndexEntry>>;
  readonly runtimeNodeIdsBySourceNodeId: Readonly<Record<string, readonly string[]>>;
  readonly runtimeNodeIdsByBehaviorId: Readonly<Record<string, readonly string[]>>;
}

/** Stable closed reason why no partial diagnostic index was returned. */
export type RuntimeReactDiagnosticIndexInvalidReason =
  | "behavior-owner-mismatch"
  | "binding-limit"
  | "duplicate-runtime-node"
  | "identifier-code-unit-limit"
  | "identifier-occurrence-limit"
  | "invalid-input"
  | "invalid-limits"
  | "unknown-behavior-owner";

/** Complete all-or-nothing result of building one React diagnostic index. */
export type RuntimeReactDiagnosticIndexBuildResult =
  | Readonly<{
      readonly status: "built";
      readonly index: RuntimeReactDiagnosticIndex;
    }>
  | Readonly<{
      readonly status: "invalid";
      readonly reason: RuntimeReactDiagnosticIndexInvalidReason;
    }>;

type CapturedLimits = Required<RuntimeReactDiagnosticIndexLimitProfile>;

interface IdentifierBudget {
  occurrences: number;
  codeUnits: number;
  readonly retainedValues: Set<string>;
}

function invalid(
  reason: RuntimeReactDiagnosticIndexInvalidReason,
): RuntimeReactDiagnosticIndexBuildResult {
  return Object.freeze({ status: "invalid", reason });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function lowerLimit(value: unknown, ceiling: number): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= ceiling
    ? (value as number)
    : undefined;
}

function captureLimits(value: unknown): CapturedLimits | undefined {
  if (value === undefined) return RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS;
  if (!isPlainRecord(value)) return undefined;

  const names = Object.keys(RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS);
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return undefined;
  }
  let containsInvalidKey: boolean;
  try {
    containsInvalidKey =
      keys.some((key) => typeof key !== "string" || !names.includes(key)) ||
      keys.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor === undefined || !descriptor.enumerable || !("value" in descriptor);
      });
  } catch {
    return undefined;
  }
  if (containsInvalidKey) {
    return undefined;
  }

  const output: Record<string, number> = Object.create(null);
  for (const name of names) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, name);
    } catch {
      return undefined;
    }
    const ceiling =
      RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS[
        name as keyof typeof RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS
      ];
    const limit = lowerLimit(
      descriptor === undefined ? ceiling : "value" in descriptor ? descriptor.value : undefined,
      ceiling,
    );
    if (limit === undefined) return undefined;
    output[name] = limit;
  }
  return Object.freeze(output) as unknown as CapturedLimits;
}

type DenseArrayCapture =
  | Readonly<{ readonly status: "captured"; readonly values: readonly unknown[] }>
  | Readonly<{ readonly status: "invalid" }>
  | Readonly<{ readonly status: "limit" }>;

function captureDenseArray(value: unknown, maximum: number): DenseArrayCapture {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return Object.freeze({ status: "invalid" });
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      return Object.freeze({ status: "invalid" });
    }
    const length = lengthDescriptor.value as number;
    if (length > maximum) return Object.freeze({ status: "limit" });
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== length + 1 ||
      keys.some(
        (key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)),
      )
    ) {
      return Object.freeze({ status: "invalid" });
    }

    const output: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return Object.freeze({ status: "invalid" });
      }
      output.push(descriptor.value);
    }
    return Object.freeze({ status: "captured", values: Object.freeze(output) });
  } catch {
    return Object.freeze({ status: "invalid" });
  }
}

function exactOwnData(
  value: object,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const output: Record<string, unknown> = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return undefined;
  }
}

function reserveIdentifiers(
  values: readonly string[],
  budget: IdentifierBudget,
  limits: CapturedLimits,
): RuntimeReactDiagnosticIndexInvalidReason | undefined {
  if (values.some((value) => value.length === 0)) return "invalid-input";
  if (values.length > limits.maxIdentifierOccurrences - budget.occurrences) {
    return "identifier-occurrence-limit";
  }
  let addedCodeUnits = 0;
  const newlyRetainedValues = new Set<string>();
  for (const value of values) {
    if (budget.retainedValues.has(value) || newlyRetainedValues.has(value)) continue;
    if (value.length > limits.maxIdentifierCodeUnits - budget.codeUnits - addedCodeUnits) {
      return "identifier-code-unit-limit";
    }
    addedCodeUnits += value.length;
    newlyRetainedValues.add(value);
  }
  budget.occurrences += values.length;
  budget.codeUnits += addedCodeUnits;
  for (const value of newlyRetainedValues) budget.retainedValues.add(value);
  return undefined;
}

function captureBinding(
  value: unknown,
  budget: IdentifierBudget,
  limits: CapturedLimits,
):
  | RuntimeReactDiagnosticIndexEntry
  | Readonly<{ readonly reason: RuntimeReactDiagnosticIndexInvalidReason }> {
  if (!isPlainRecord(value)) return Object.freeze({ reason: "invalid-input" });
  let kindDescriptor: PropertyDescriptor | undefined;
  try {
    kindDescriptor = Object.getOwnPropertyDescriptor(value, "kind");
  } catch {
    return Object.freeze({ reason: "invalid-input" });
  }
  if (
    kindDescriptor === undefined ||
    !kindDescriptor.enumerable ||
    !("value" in kindDescriptor) ||
    (kindDescriptor.value !== "component" && kindDescriptor.value !== "behavior")
  ) {
    return Object.freeze({ reason: "invalid-input" });
  }

  if (kindDescriptor.value === "component") {
    const captured = exactOwnData(value, ["kind", "runtimeNodeId", "sourceNodeId", "capabilityId"]);
    if (captured === undefined) return Object.freeze({ reason: "invalid-input" });
    const identifiers = [captured.runtimeNodeId, captured.sourceNodeId, captured.capabilityId];
    if (identifiers.some((identifier) => typeof identifier !== "string")) {
      return Object.freeze({ reason: "invalid-input" });
    }
    const strings = identifiers as string[];
    const budgetFailure = reserveIdentifiers(strings, budget, limits);
    if (budgetFailure !== undefined) return Object.freeze({ reason: budgetFailure });
    return Object.freeze({
      kind: "component",
      runtimeNodeId: strings[0] as string,
      sourceNodeId: strings[1] as string,
      capabilityId: strings[2] as string,
    });
  }

  const captured = exactOwnData(value, [
    "kind",
    "runtimeNodeId",
    "sourceNodeId",
    "capabilityId",
    "behaviorId",
    "ownerRuntimeNodeId",
  ]);
  if (captured === undefined) return Object.freeze({ reason: "invalid-input" });
  const identifiers = [
    captured.runtimeNodeId,
    captured.sourceNodeId,
    captured.capabilityId,
    captured.behaviorId,
    captured.ownerRuntimeNodeId,
  ];
  if (identifiers.some((identifier) => typeof identifier !== "string")) {
    return Object.freeze({ reason: "invalid-input" });
  }
  const strings = identifiers as string[];
  const budgetFailure = reserveIdentifiers(strings, budget, limits);
  if (budgetFailure !== undefined) return Object.freeze({ reason: budgetFailure });
  return Object.freeze({
    kind: "behavior",
    runtimeNodeId: strings[0] as string,
    sourceNodeId: strings[1] as string,
    capabilityId: strings[2] as string,
    behaviorId: strings[3] as string,
    ownerRuntimeNodeId: strings[4] as string,
  });
}

function frozenLookup<Value>(
  entries: readonly (readonly [string, Value])[],
): Readonly<Record<string, Value>> {
  const output: Record<string, Value> = Object.create(null);
  for (const [key, value] of entries) output[key] = value;
  return Object.freeze(output);
}

/**
 * Builds one deterministic, bounded, callback-free diagnostic index from minimal prepared
 * binding identities.
 *
 * @remarks Input is captured atomically through exact own-data records. Duplicate runtime
 * identities, malformed behavior ownership, hostile reflection, or any lower-only limit crossing
 * returns a reason-only failure without a partial index. A successful result retains only copied
 * string identities in recursively frozen null-prototype lookups and sorted inverse arrays.
 */
export function buildRuntimeReactDiagnosticIndex(
  bindings: readonly RuntimeReactDiagnosticIndexBinding[],
  limitProfile?: RuntimeReactDiagnosticIndexLimitProfile,
): RuntimeReactDiagnosticIndexBuildResult {
  const limits = captureLimits(limitProfile);
  if (limits === undefined) return invalid("invalid-limits");
  const capturedArray = captureDenseArray(bindings, limits.maxBindings);
  if (capturedArray.status === "limit") return invalid("binding-limit");
  if (capturedArray.status === "invalid") return invalid("invalid-input");

  const budget: IdentifierBudget = {
    occurrences: 0,
    codeUnits: 0,
    retainedValues: new Set(),
  };
  const entries: RuntimeReactDiagnosticIndexEntry[] = [];
  for (const candidate of capturedArray.values) {
    const captured = captureBinding(candidate, budget, limits);
    if ("reason" in captured) return invalid(captured.reason);
    entries.push(captured);
  }
  entries.sort((left, right) => CODE_UNIT_COMPARATOR(left.runtimeNodeId, right.runtimeNodeId));

  const byRuntime = new Map<string, RuntimeReactDiagnosticIndexEntry>();
  for (const entry of entries) {
    if (byRuntime.has(entry.runtimeNodeId)) return invalid("duplicate-runtime-node");
    byRuntime.set(entry.runtimeNodeId, entry);
  }
  for (const entry of entries) {
    if (entry.kind !== "behavior") continue;
    const owner = byRuntime.get(entry.ownerRuntimeNodeId);
    if (owner === undefined || owner.kind !== "component") {
      return invalid("unknown-behavior-owner");
    }
    if (owner.sourceNodeId !== entry.sourceNodeId) {
      return invalid("behavior-owner-mismatch");
    }
  }

  const sourceRuntimeIds = new Map<string, string[]>();
  const behaviorRuntimeIds = new Map<string, string[]>();
  for (const entry of entries) {
    const sourceBucket = sourceRuntimeIds.get(entry.sourceNodeId) ?? [];
    sourceBucket.push(entry.runtimeNodeId);
    sourceRuntimeIds.set(entry.sourceNodeId, sourceBucket);
    if (entry.kind === "behavior") {
      const behaviorBucket = behaviorRuntimeIds.get(entry.behaviorId) ?? [];
      behaviorBucket.push(entry.runtimeNodeId);
      behaviorRuntimeIds.set(entry.behaviorId, behaviorBucket);
    }
  }

  const freezeBuckets = (buckets: ReadonlyMap<string, readonly string[]>) =>
    frozenLookup(
      [...buckets.entries()]
        .sort(([left], [right]) => CODE_UNIT_COMPARATOR(left, right))
        .map(
          ([key, values]) => [key, Object.freeze([...values].sort(CODE_UNIT_COMPARATOR))] as const,
        ),
    );

  const index: RuntimeReactDiagnosticIndex = Object.freeze({
    byRuntimeNodeId: frozenLookup([...byRuntime.entries()]),
    runtimeNodeIdsBySourceNodeId: freezeBuckets(sourceRuntimeIds),
    runtimeNodeIdsByBehaviorId: freezeBuckets(behaviorRuntimeIds),
  });
  return Object.freeze({ status: "built", index });
}
