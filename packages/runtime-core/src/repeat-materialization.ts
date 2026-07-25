import { appendJsonPointer, canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { createRuntimeNodeIdentity, reconcileRuntimeNodeIdentity } from "./node-identity.js";
import { isRuntimeJsonObject, snapshotRuntimeJsonValue } from "./runtime-json-snapshot.js";
import { createRuntimeResolutionSnapshot, resolveRuntimeValue } from "./value-resolution.js";

import type { JsonPointer } from "@desen/protocol";
import type { RuntimeJsonObject, RuntimeJsonValue } from "./host-ports.js";
import type {
  RuntimeNodeIdentity,
  RuntimeNodeIdentityDescriptor,
  RuntimeNodeIdentityInvalidReason,
} from "./node-identity.js";
import type {
  RuntimeResolutionSnapshot,
  RuntimeValueInvalidReason,
  RuntimeValueSpec,
} from "./value-resolution.js";

const ROOT_POINTER = createJsonPointer();
const REPEAT_ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const REPEAT_SCOPE_BRAND = new WeakSet<object>();
const REPEAT_SCOPE_BASE_SNAPSHOT = new WeakMap<object, RuntimeResolutionSnapshot>();
const REPEATED_NODE_IDENTITY_BRAND = new WeakSet<object>();
declare const RUNTIME_REPEAT_SCOPE_TYPE_BRAND: unique symbol;
declare const RUNTIME_REPEATED_NODE_IDENTITY_TYPE_BRAND: unique symbol;

/** Finite Reference Profile ceiling owned by one repeat-materialization call. */
export const RUNTIME_REPEAT_LIMITS = Object.freeze({
  /** Maximum instances materialized by one repeat declaration. */
  maxInstancesPerRepeat: 1_000,
} as const);

/** A scalar DESEN repeat key whose JSON type remains part of its identity. */
export type RuntimeRepeatKey = string | number;

/** Closed repeat declaration consumed by the framework-neutral runtime. */
export interface RuntimeRepeatSpec {
  /** Value resolved in the incoming parent scope before the new alias exists. */
  readonly items: RuntimeValueSpec;
  /** Lexical item alias introduced only in each materialized child scope. */
  readonly as: string;
  /** Scalar key resolved separately for every item after the alias becomes active. */
  readonly key: RuntimeValueSpec;
  /** Optional declaration ceiling combined with the Reference Profile ceiling. */
  readonly limit?: number;
  /** Opaque extension data that cannot widen core repeat semantics. */
  readonly extensions?: RuntimeJsonObject;
}

/**
 * Factory-branded lexical repeat scope.
 *
 * @remarks The scope retains one shared base snapshot plus only active alias values and the
 * outer-to-inner key path. Use {@link createRuntimeResolutionSnapshotForRepeatScope} to create a
 * standard M04-T02 snapshot on demand; this avoids retaining one full snapshot per repeat item.
 */
export interface RuntimeRepeatScope {
  /** Compile-time opaque marker backed by a private runtime brand. */
  readonly [RUNTIME_REPEAT_SCOPE_TYPE_BRAND]: true;
  /** Active aliases and their immutable item values. */
  readonly aliases: RuntimeJsonObject;
  /** Lexical outer-to-inner alias order; aliases are not part of instance identity. */
  readonly aliasOrder: readonly string[];
  /** Type-sensitive outer-to-inner repeat-key path. */
  readonly repeatKeys: readonly RuntimeRepeatKey[];
}

/** One item retained in original array order after complete repeat validation. */
export interface RuntimeRepeatMaterializedInstance {
  /** Zero-based source-array position; it is not part of stable identity. */
  readonly index: number;
  /** Resolved string or finite number key. */
  readonly key: RuntimeRepeatKey;
  /** RFC 8785 canonical identity of the scalar key. */
  readonly keyIdentity: string;
  /** Child scope where the current alias and key path are active. */
  readonly scope: RuntimeRepeatScope;
}

/** Stable repeat failure code, including project-owned fail-closed profile errors. */
export type RuntimeRepeatInvalidCode =
  | "REFERENCE_UNRESOLVED"
  | "REPEAT_ITEMS_INVALID"
  | "REPEAT_KEY_INVALID"
  | "run.desen.runtime/INVALID_REPEAT_CONTRACT";

/** Stable reason why a repeat could not produce any observable instance. */
export type RuntimeRepeatInvalidReason =
  | RuntimeValueInvalidReason
  | "active-alias-collision"
  | "duplicate-key"
  | "forged-scope"
  | "items-not-array"
  | "items-unresolved"
  | "key-not-scalar"
  | "key-unresolved"
  | "malformed-repeat";

/** Atomic repeat rejection carrying no partial child scopes or identities. */
export interface RuntimeRepeatInvalid {
  /** Discriminates controlled rejection from materialization and deferral. */
  readonly status: "invalid";
  /** Frozen or namespaced diagnostic classification. */
  readonly code: RuntimeRepeatInvalidCode;
  /** Exact repeat-relative source location. */
  readonly pointer: JsonPointer;
  /** Stable implementation-profile reason. */
  readonly reason: RuntimeRepeatInvalidReason;
  /** Item position when the failure arose during key evaluation. */
  readonly itemIndex?: number;
}

/** Token or format work intentionally deferred by the T02/T06-only repeat primitive. */
export interface RuntimeRepeatDeferred {
  /** Discriminates incomplete value composition from invalid repeat data. */
  readonly status: "deferred";
  /** Exact value form requiring the later materialization composition. */
  readonly form: "token" | "format";
  /** Exact repeat-relative source location. */
  readonly pointer: JsonPointer;
  /** Item position when the deferred form arose from key evaluation. */
  readonly itemIndex?: number;
}

/** Controlled, non-truncating repeat overflow. */
export interface RuntimeRepeatLimitExceeded {
  /** Ensures overflow cannot be mistaken for a smaller successful subtree. */
  readonly status: "limit-exceeded";
  /** Project-owned diagnostic because the frozen registry has no repeat-limit code. */
  readonly code: "run.desen.runtime/REPEAT_LIMIT_EXCEEDED";
  /** Logical repeat-limit location, including when the Reference Profile supplies the bound. */
  readonly pointer: JsonPointer;
  /** Whether the explicit declaration or Reference Profile supplied the effective ceiling. */
  readonly reason: "declared-limit" | "profile-limit";
  /** Effective accepted maximum. */
  readonly limit: number;
  /** Number of items that would have been materialized. */
  readonly observed: number;
}

/** Successful ordered and immutable repeat materialization. */
export interface RuntimeRepeatMaterialized {
  /** Confirms every item, key, alias, and limit passed before any instance became observable. */
  readonly status: "materialized";
  /** Instances in exact source-array order. */
  readonly instances: readonly RuntimeRepeatMaterializedInstance[];
  /** Minimum of the declaration limit and Reference Profile ceiling. */
  readonly effectiveLimit: number;
}

/** Complete outcome of one repeat-materialization attempt. */
export type RuntimeRepeatMaterialization =
  | RuntimeRepeatMaterialized
  | RuntimeRepeatInvalid
  | RuntimeRepeatDeferred
  | RuntimeRepeatLimitExceeded;

/**
 * Stable identity for one repeated source-node instance.
 *
 * @remarks The key contains the T06 document/surface/source-node tuple plus the ordered repeat-key
 * path. Alias names, array indexes, item contents, revision, props, and styles are excluded.
 */
export interface RuntimeRepeatedNodeIdentity {
  /** Compile-time opaque marker backed by a private runtime brand. */
  readonly [RUNTIME_REPEATED_NODE_IDENTITY_TYPE_BRAND]: true;
  /** Canonical document/surface/source-node/repeat-path tuple. */
  readonly key: string;
  /** Factory-authenticated T06 identity used for capability compatibility. */
  readonly baseIdentity: RuntimeNodeIdentity;
  /** Immutable type-sensitive outer-to-inner repeat-key path. */
  readonly repeatKeys: readonly RuntimeRepeatKey[];
  /** Current component capability, excluded from the stable key. */
  readonly use: string;
  /** Capability-change generation inherited from the reconciled base identity. */
  readonly mountGeneration: number;
}

/** Stable repeated-identity rejection reason. */
export type RuntimeRepeatedNodeIdentityInvalidReason =
  | RuntimeNodeIdentityInvalidReason
  | "empty-repeat-path"
  | "forged-repeat-identity"
  | "forged-repeat-scope";

/** Controlled repeated-identity failure with no substitute identity. */
export interface RuntimeRepeatedNodeIdentityInvalid {
  /** Discriminates rejection from creation or compatibility decisions. */
  readonly status: "invalid";
  /** Stable failure classification. */
  readonly reason: RuntimeRepeatedNodeIdentityInvalidReason;
  /** Descriptor- or scope-relative location when safely known. */
  readonly pointer: JsonPointer;
}

/** Complete result of creating one repeated node identity. */
export type RuntimeRepeatedNodeIdentityCreationResult =
  | Readonly<{
      /** Confirms creation from a valid descriptor and non-root repeat scope. */
      status: "created";
      /** New immutable repeated identity. */
      identity: RuntimeRepeatedNodeIdentity;
    }>
  | RuntimeRepeatedNodeIdentityInvalid;

/** Complete compatibility decision for one repeated node across reevaluation. */
export type RuntimeRepeatedNodeIdentityReconciliation =
  | Readonly<{
      /** Base tuple, capability, and complete repeat-key path match. */
      status: "preserve-eligible";
      /** Exact previous identity, preserved by reference. */
      identity: RuntimeRepeatedNodeIdentity;
    }>
  | Readonly<{
      /** Repeat path matches but the component capability changed. */
      status: "remount-required";
      /** Stable remount classification. */
      reason: "capability-changed";
      /** Same stable key with an incremented mount generation. */
      identity: RuntimeRepeatedNodeIdentity;
    }>
  | Readonly<{
      /** Base tuple or any own/ancestor repeat key changed. */
      status: "replace-required";
      /** Stable replacement classification. */
      reason: "identity-changed";
      /** Factory-authenticated identity being replaced. */
      previousIdentity: RuntimeRepeatedNodeIdentity;
      /** Fresh identity for the next key path. */
      nextIdentity: RuntimeRepeatedNodeIdentity;
    }>
  | RuntimeRepeatedNodeIdentityInvalid;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function prefixPointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return relative === ROOT_POINTER ? base : (`${base}${relative}` as JsonPointer);
}

function hasExactKeys(
  value: RuntimeJsonObject,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value).sort(compareText);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    actual.every((key) => allowed.has(key)) &&
    actual.length >= required.length &&
    actual.length <= required.length + optional.length
  );
}

function invalidRepeat(
  code: RuntimeRepeatInvalidCode,
  pointer: JsonPointer,
  reason: RuntimeRepeatInvalidReason,
  itemIndex?: number,
): RuntimeRepeatInvalid {
  return Object.freeze({
    status: "invalid",
    code,
    pointer,
    reason,
    ...(itemIndex === undefined ? {} : { itemIndex }),
  });
}

function deferredRepeat(
  form: "token" | "format",
  pointer: JsonPointer,
  itemIndex?: number,
): RuntimeRepeatDeferred {
  return Object.freeze({
    status: "deferred",
    form,
    pointer,
    ...(itemIndex === undefined ? {} : { itemIndex }),
  });
}

function createAliasMap(
  parent: RuntimeJsonObject,
  alias?: string,
  item?: RuntimeJsonValue,
): RuntimeJsonObject {
  const aliases = Object.create(null) as Record<string, RuntimeJsonValue>;
  for (const key of Object.keys(parent)) {
    aliases[key] = parent[key] as RuntimeJsonValue;
  }
  if (alias !== undefined && item !== undefined) aliases[alias] = item;
  return Object.freeze(aliases);
}

function createScope(
  baseSnapshot: RuntimeResolutionSnapshot,
  aliases: RuntimeJsonObject,
  aliasOrder: readonly string[],
  repeatKeys: readonly RuntimeRepeatKey[],
): RuntimeRepeatScope {
  const scope = Object.freeze({
    aliases,
    aliasOrder: Object.freeze([...aliasOrder]),
    repeatKeys: Object.freeze([...repeatKeys]),
  });
  REPEAT_SCOPE_BRAND.add(scope);
  REPEAT_SCOPE_BASE_SNAPSHOT.set(scope, baseSnapshot);
  return scope as unknown as RuntimeRepeatScope;
}

function snapshotForAliases(
  base: RuntimeResolutionSnapshot,
  aliases: RuntimeJsonObject,
): RuntimeResolutionSnapshot {
  return createRuntimeResolutionSnapshot({
    state: base.state,
    context: base.context,
    resource: base.resource,
    operation: base.operation,
    event: base.event,
    item: aliases,
    env: base.env,
  });
}

function trySnapshotForAliases(
  base: RuntimeResolutionSnapshot,
  aliases: RuntimeJsonObject,
): RuntimeResolutionSnapshot | undefined {
  try {
    return snapshotForAliases(base, aliases);
  } catch {
    return undefined;
  }
}

function scopeBase(scope: RuntimeRepeatScope): RuntimeResolutionSnapshot | undefined {
  return REPEAT_SCOPE_BRAND.has(scope) ? REPEAT_SCOPE_BASE_SNAPSHOT.get(scope) : undefined;
}

/**
 * Creates the repeat root from one factory-created M04-T02 snapshot.
 *
 * @remarks Root creation requires an empty `item` namespace. Nested repeat scopes must come from
 * {@link materializeRuntimeRepeat}; callers cannot inject an untracked alias or key path.
 *
 * @throws TypeError when the snapshot is forged or already contains an active item alias.
 */
export function createRuntimeRepeatRootScope(
  snapshot: RuntimeResolutionSnapshot,
): RuntimeRepeatScope {
  // The ordinary resolver performs the existing private snapshot-brand check without inspecting
  // or copying any host-controlled path.
  resolveRuntimeValue(null, snapshot);
  if (Object.keys(snapshot.item).length !== 0) {
    throw new TypeError("A runtime repeat root requires an empty item namespace.");
  }
  return createScope(snapshot, createAliasMap({}), [], []);
}

/**
 * Creates a standard resolution snapshot for a factory-authenticated repeat scope.
 *
 * @remarks The full base snapshot is copied only on demand. Materialized repeat results therefore
 * do not retain one duplicate of state, context, resources, operations, event, and environment per
 * item.
 *
 * @throws TypeError when `scope` was not created by this module.
 */
export function createRuntimeResolutionSnapshotForRepeatScope(
  scope: RuntimeRepeatScope,
): RuntimeResolutionSnapshot {
  const base = scopeBase(scope);
  if (base === undefined) throw new TypeError("Invalid runtime repeat scope.");
  return snapshotForAliases(base, scope.aliases);
}

/**
 * Materializes one repeat declaration atomically in original item order.
 *
 * @remarks `items` resolves before the new alias exists. Each `key` resolves in a temporary child
 * scope containing that alias. One invalid, missing, non-scalar, or duplicate key rejects the
 * whole subtree, and overflow never truncates. Token and format forms remain explicitly deferred
 * for M04-T16 composition because M04-T07 depends only on the T02 resolver and T06 identity slice.
 */
export function materializeRuntimeRepeat(
  scope: RuntimeRepeatScope,
  input: RuntimeRepeatSpec,
): RuntimeRepeatMaterialization {
  const base = scopeBase(scope);
  if (base === undefined) {
    return invalidRepeat("run.desen.runtime/INVALID_REPEAT_CONTRACT", ROOT_POINTER, "forged-scope");
  }

  const captured = snapshotRuntimeJsonValue(input);
  if (
    !isRuntimeJsonObject(captured) ||
    !hasExactKeys(captured, ["as", "items", "key"], ["extensions", "limit"])
  ) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      ROOT_POINTER,
      "malformed-repeat",
    );
  }

  const alias = captured.as;
  if (typeof alias !== "string" || !REPEAT_ALIAS_PATTERN.test(alias)) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      appendJsonPointer(ROOT_POINTER, "as"),
      "malformed-repeat",
    );
  }
  if (Object.hasOwn(scope.aliases, alias)) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      appendJsonPointer(ROOT_POINTER, "as"),
      "active-alias-collision",
    );
  }
  if (Object.hasOwn(captured, "extensions") && !isRuntimeJsonObject(captured.extensions)) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      appendJsonPointer(ROOT_POINTER, "extensions"),
      "malformed-repeat",
    );
  }
  const declaredLimit = captured.limit;
  if (
    declaredLimit !== undefined &&
    (typeof declaredLimit !== "number" || !Number.isInteger(declaredLimit) || declaredLimit < 1)
  ) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      appendJsonPointer(ROOT_POINTER, "limit"),
      "malformed-repeat",
    );
  }

  const itemsPointer = appendJsonPointer(ROOT_POINTER, "items");
  const parentSnapshot = trySnapshotForAliases(base, scope.aliases);
  if (parentSnapshot === undefined) {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      itemsPointer,
      "unsafe-or-unbounded-json",
    );
  }
  const keyPointer = appendJsonPointer(ROOT_POINTER, "key");
  const structuralKey = resolveRuntimeValue(captured.key as RuntimeValueSpec, parentSnapshot);
  if (structuralKey.status === "invalid") {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      prefixPointer(keyPointer, structuralKey.pointer),
      structuralKey.reason,
    );
  }
  const itemsResolution = resolveRuntimeValue(captured.items as RuntimeValueSpec, parentSnapshot);
  if (itemsResolution.status === "deferred") {
    return deferredRepeat(
      itemsResolution.form,
      prefixPointer(itemsPointer, itemsResolution.pointer),
    );
  }
  if (itemsResolution.status === "invalid") {
    return invalidRepeat(
      "run.desen.runtime/INVALID_REPEAT_CONTRACT",
      prefixPointer(itemsPointer, itemsResolution.pointer),
      itemsResolution.reason,
    );
  }
  if (itemsResolution.status === "unresolved") {
    return invalidRepeat(
      "REFERENCE_UNRESOLVED",
      prefixPointer(itemsPointer, itemsResolution.pointer),
      "items-unresolved",
    );
  }
  if (!Array.isArray(itemsResolution.value)) {
    return invalidRepeat("REPEAT_ITEMS_INVALID", itemsPointer, "items-not-array");
  }

  const effectiveLimit = Math.min(
    declaredLimit ?? RUNTIME_REPEAT_LIMITS.maxInstancesPerRepeat,
    RUNTIME_REPEAT_LIMITS.maxInstancesPerRepeat,
  );
  if (itemsResolution.value.length > effectiveLimit) {
    return Object.freeze({
      status: "limit-exceeded",
      code: "run.desen.runtime/REPEAT_LIMIT_EXCEEDED",
      pointer: appendJsonPointer(ROOT_POINTER, "limit"),
      reason:
        declaredLimit !== undefined && declaredLimit <= RUNTIME_REPEAT_LIMITS.maxInstancesPerRepeat
          ? "declared-limit"
          : "profile-limit",
      limit: effectiveLimit,
      observed: itemsResolution.value.length,
    });
  }

  const seenKeys = new Set<string>();
  const prepared: {
    readonly index: number;
    readonly item: RuntimeJsonValue;
    readonly key: RuntimeRepeatKey;
    readonly keyIdentity: string;
    readonly aliases: RuntimeJsonObject;
  }[] = [];

  for (let index = 0; index < itemsResolution.value.length; index += 1) {
    const item = itemsResolution.value[index] as RuntimeJsonValue;
    const aliases = createAliasMap(scope.aliases, alias, item);
    const keySnapshot = trySnapshotForAliases(base, aliases);
    if (keySnapshot === undefined) {
      return invalidRepeat(
        "run.desen.runtime/INVALID_REPEAT_CONTRACT",
        keyPointer,
        "unsafe-or-unbounded-json",
        index,
      );
    }
    const keyResolution = resolveRuntimeValue(captured.key as RuntimeValueSpec, keySnapshot);
    if (keyResolution.status === "deferred") {
      return deferredRepeat(
        keyResolution.form,
        prefixPointer(keyPointer, keyResolution.pointer),
        index,
      );
    }
    if (keyResolution.status === "invalid") {
      return invalidRepeat(
        "run.desen.runtime/INVALID_REPEAT_CONTRACT",
        prefixPointer(keyPointer, keyResolution.pointer),
        keyResolution.reason,
        index,
      );
    }
    if (keyResolution.status === "unresolved") {
      return invalidRepeat("REPEAT_KEY_INVALID", keyPointer, "key-unresolved", index);
    }
    if (typeof keyResolution.value !== "string" && typeof keyResolution.value !== "number") {
      return invalidRepeat("REPEAT_KEY_INVALID", keyPointer, "key-not-scalar", index);
    }
    const key = keyResolution.value;
    const keyIdentity = canonicalizeJson(key);
    if (seenKeys.has(keyIdentity)) {
      return invalidRepeat("REPEAT_KEY_INVALID", keyPointer, "duplicate-key", index);
    }
    seenKeys.add(keyIdentity);
    prepared.push({ index, item, key, keyIdentity, aliases });
  }

  const instances = prepared.map(({ index, key, keyIdentity, aliases }) =>
    Object.freeze({
      index,
      key,
      keyIdentity,
      scope: createScope(base, aliases, [...scope.aliasOrder, alias], [...scope.repeatKeys, key]),
    }),
  );
  return Object.freeze({
    status: "materialized",
    instances: Object.freeze(instances),
    effectiveLimit,
  });
}

function repeatedIdentityInvalid(
  reason: RuntimeRepeatedNodeIdentityInvalidReason,
  pointer: JsonPointer = ROOT_POINTER,
): RuntimeRepeatedNodeIdentityInvalid {
  return Object.freeze({ status: "invalid", reason, pointer });
}

function createRepeatedIdentity(
  baseIdentity: RuntimeNodeIdentity,
  scope: RuntimeRepeatScope,
): RuntimeRepeatedNodeIdentity {
  const repeatKeys = Object.freeze([...scope.repeatKeys]);
  const identity = Object.freeze({
    key: canonicalizeJson([
      baseIdentity.documentId,
      baseIdentity.surfaceId,
      baseIdentity.nodeId,
      repeatKeys,
    ]),
    baseIdentity,
    repeatKeys,
    use: baseIdentity.use,
    mountGeneration: baseIdentity.mountGeneration,
  });
  REPEATED_NODE_IDENTITY_BRAND.add(identity);
  return identity as unknown as RuntimeRepeatedNodeIdentity;
}

function prefixedNodeIdentityFailure(
  reason: RuntimeNodeIdentityInvalidReason,
  pointer: JsonPointer,
): RuntimeRepeatedNodeIdentityInvalid {
  return repeatedIdentityInvalid(
    reason,
    pointer === ROOT_POINTER
      ? appendJsonPointer(ROOT_POINTER, "node")
      : (`/node${pointer}` as JsonPointer),
  );
}

/**
 * Creates one stable repeated identity from a validated node descriptor and active child scope.
 *
 * @remarks The descriptor is passed through the T06 factory, so this API never needs access to the
 * private T06 brand or changes the prerequisite implementation bytes.
 */
export function createRuntimeRepeatedNodeIdentity(
  descriptor: RuntimeNodeIdentityDescriptor,
  scope: RuntimeRepeatScope,
): RuntimeRepeatedNodeIdentityCreationResult {
  if (!REPEAT_SCOPE_BRAND.has(scope)) {
    return repeatedIdentityInvalid("forged-repeat-scope");
  }
  if (scope.repeatKeys.length === 0) {
    return repeatedIdentityInvalid("empty-repeat-path", appendJsonPointer(ROOT_POINTER, "scope"));
  }
  const base = createRuntimeNodeIdentity(descriptor);
  if (base.status === "invalid") {
    return prefixedNodeIdentityFailure(base.reason, base.pointer);
  }
  return Object.freeze({
    status: "created",
    identity: createRepeatedIdentity(base.identity, scope),
  });
}

/**
 * Reconciles one repeated identity across reorder, key-path, and capability changes.
 *
 * @remarks Reorder preserves the exact object because indexes are absent from identity. A changed
 * own or ancestor key requires replacement. A capability change on the same key path increments
 * the T06 mount generation. Actual platform-instance preservation remains M05-T05.
 */
export function reconcileRuntimeRepeatedNodeIdentity(
  previousIdentity: RuntimeRepeatedNodeIdentity,
  nextDescriptor: RuntimeNodeIdentityDescriptor,
  nextScope: RuntimeRepeatScope,
): RuntimeRepeatedNodeIdentityReconciliation {
  if (
    typeof previousIdentity !== "object" ||
    previousIdentity === null ||
    !REPEATED_NODE_IDENTITY_BRAND.has(previousIdentity)
  ) {
    return repeatedIdentityInvalid("forged-repeat-identity");
  }
  if (!REPEAT_SCOPE_BRAND.has(nextScope)) {
    return repeatedIdentityInvalid("forged-repeat-scope");
  }
  if (nextScope.repeatKeys.length === 0) {
    return repeatedIdentityInvalid("empty-repeat-path", appendJsonPointer(ROOT_POINTER, "scope"));
  }

  const freshBase = createRuntimeNodeIdentity(nextDescriptor);
  if (freshBase.status === "invalid") {
    return prefixedNodeIdentityFailure(freshBase.reason, freshBase.pointer);
  }
  const freshIdentity = createRepeatedIdentity(freshBase.identity, nextScope);
  if (previousIdentity.key !== freshIdentity.key) {
    return Object.freeze({
      status: "replace-required",
      reason: "identity-changed",
      previousIdentity,
      nextIdentity: freshIdentity,
    });
  }

  const baseDecision = reconcileRuntimeNodeIdentity(previousIdentity.baseIdentity, nextDescriptor);
  if (baseDecision.status === "invalid") {
    return prefixedNodeIdentityFailure(baseDecision.reason, baseDecision.pointer);
  }
  const nextBase =
    baseDecision.status === "replace-required" ? baseDecision.nextIdentity : baseDecision.identity;
  const nextIdentity = createRepeatedIdentity(nextBase, nextScope);

  if (baseDecision.status === "remount-required") {
    return Object.freeze({
      status: "remount-required",
      reason: "capability-changed",
      identity: nextIdentity,
    });
  }
  return Object.freeze({
    status: "preserve-eligible",
    identity: previousIdentity,
  });
}
