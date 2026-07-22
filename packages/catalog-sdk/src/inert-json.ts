import { canonicalizeJson } from "@desen/protocol";

/** A JSON scalar accepted by DESEN data boundaries. */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Recursively immutable view of a JSON-shaped TypeScript value.
 *
 * @remarks This type describes the snapshots returned by the catalog SDK. It does not validate
 * JSON Schema constraints; runtime catalog validation remains a validator responsibility.
 */
export type ImmutableJson<Value> = Value extends JsonPrimitive
  ? Value
  : Value extends readonly unknown[]
    ? number extends Value["length"]
      ? Value extends readonly (infer Item)[]
        ? readonly ImmutableJson<Item>[]
        : never
      : { readonly [Key in keyof Value]: ImmutableJson<Value[Key]> }
    : Value extends object
      ? { readonly [Key in keyof Value]: ImmutableJson<Value[Key]> }
      : never;

type TupleIndexKeys<
  Value extends readonly unknown[],
  Prefix extends readonly unknown[] = readonly [],
> = Value extends readonly [unknown, ...infer Rest]
  ? `${Prefix["length"]}` | TupleIndexKeys<Rest, readonly [...Prefix, unknown]>
  : never;

/**
 * Compile-time projection that prevents executable or otherwise non-JSON fields from entering a
 * generic manifest while retaining literal information for later schema derivation.
 *
 * @remarks Runtime checks remain necessary because JavaScript callers and explicit casts can
 * bypass TypeScript. Non-finite numbers are rejected only at runtime.
 */
export type JsonInput<Value> = Value extends JsonPrimitive
  ? Value
  : Value extends readonly unknown[]
    ? Exclude<keyof Value, keyof unknown[] | TupleIndexKeys<Value>> extends never
      ? number extends Value["length"]
        ? Value extends readonly (infer Item)[]
          ? readonly JsonInput<Item>[]
          : never
        : { readonly [Key in keyof Value]: JsonInput<Value[Key]> }
      : never
    : Value extends (...arguments_: never[]) => unknown
      ? never
      : Value extends abstract new (...arguments_: never[]) => unknown
        ? never
        : Value extends object
          ? Extract<keyof Value, symbol> extends never
            ? { readonly [Key in keyof Value]: JsonInput<Value[Key]> }
            : never
          : never;

const INTERNAL_SLOT_SENTINEL = Object.freeze({});
const APPLY = Reflect.apply;
const IS_ARRAY_BUFFER_VIEW = ArrayBuffer.isView;
const DATE_GET_TIME = Date.prototype.getTime;
const MAP_HAS = Map.prototype.has;
const SET_HAS = Set.prototype.has;
const WEAK_MAP_HAS = WeakMap.prototype.has;
const WEAK_SET_HAS = WeakSet.prototype.has;
const BOOLEAN_VALUE_OF = Boolean.prototype.valueOf;
const NUMBER_VALUE_OF = Number.prototype.valueOf;
const STRING_VALUE_OF = String.prototype.valueOf;
const BIGINT_VALUE_OF = BigInt.prototype.valueOf;
const SYMBOL_VALUE_OF = Symbol.prototype.valueOf;
const WEAK_REF_DEREF = typeof WeakRef === "undefined" ? undefined : WeakRef.prototype.deref;
const FINALIZATION_REGISTRY_UNREGISTER =
  typeof FinalizationRegistry === "undefined"
    ? undefined
    : FinalizationRegistry.prototype.unregister;

type InternalSlotProbe = (value: object) => unknown;

const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER =
  typeof SharedArrayBuffer === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength")?.get;
const REGEXP_SOURCE_GETTER = Object.getOwnPropertyDescriptor(RegExp.prototype, "source")?.get;

const INTERNAL_SLOT_PROBES: readonly InternalSlotProbe[] = Object.freeze([
  (value) => APPLY(DATE_GET_TIME, value, []),
  (value) => APPLY(MAP_HAS, value, [INTERNAL_SLOT_SENTINEL]),
  (value) => APPLY(SET_HAS, value, [INTERNAL_SLOT_SENTINEL]),
  (value) => APPLY(WEAK_MAP_HAS, value, [INTERNAL_SLOT_SENTINEL]),
  (value) => APPLY(WEAK_SET_HAS, value, [INTERNAL_SLOT_SENTINEL]),
  (value) => APPLY(BOOLEAN_VALUE_OF, value, []),
  (value) => APPLY(NUMBER_VALUE_OF, value, []),
  (value) => APPLY(STRING_VALUE_OF, value, []),
  (value) => APPLY(BIGINT_VALUE_OF, value, []),
  (value) => APPLY(SYMBOL_VALUE_OF, value, []),
  ...(WEAK_REF_DEREF === undefined ? [] : [(value: object) => APPLY(WEAK_REF_DEREF, value, [])]),
  ...(FINALIZATION_REGISTRY_UNREGISTER === undefined
    ? []
    : [
        (value: object) => APPLY(FINALIZATION_REGISTRY_UNREGISTER, value, [INTERNAL_SLOT_SENTINEL]),
      ]),
  ...(ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined
    ? []
    : [(value: object) => APPLY(ARRAY_BUFFER_BYTE_LENGTH_GETTER, value, [])]),
  ...(SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined
    ? []
    : [(value: object) => APPLY(SHARED_ARRAY_BUFFER_BYTE_LENGTH_GETTER, value, [])]),
  ...(REGEXP_SOURCE_GETTER === undefined
    ? []
    : [(value: object) => APPLY(REGEXP_SOURCE_GETTER, value, [])]),
]);

function hasRecognizedInternalSlot(value: object): boolean {
  if (IS_ARRAY_BUFFER_VIEW(value)) return true;
  return INTERNAL_SLOT_PROBES.some((probe) => {
    try {
      probe(value);
      return true;
    } catch {
      return false;
    }
  });
}

function assertNoRecognizedExoticObjects(value: unknown, visited: WeakSet<object>): void {
  if (value === null || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);

  if (!Array.isArray(value) && hasRecognizedInternalSlot(value)) {
    throw new TypeError(
      "Cannot snapshot inert JSON: a recognized built-in object is not JSON data",
    );
  }

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      assertNoRecognizedExoticObjects(descriptor.value, visited);
    }
  }
}

function deepFreezeJson(value: unknown): void {
  if (value === null || typeof value !== "object") return;

  for (const key of Object.keys(value)) {
    deepFreezeJson((value as Record<string, unknown>)[key]);
  }
  Object.freeze(value);
}

/**
 * Creates a detached, canonical-key-ordered, recursively frozen JSON snapshot.
 *
 * The protocol canonicalizer rejects accessors, serialization hooks, hidden or symbol properties,
 * sparse arrays, directly observable custom prototypes, cycles, and non-JSON scalar values instead
 * of silently dropping them. A preflight additionally rejects recognized built-in internal-slot
 * objects even when their prototype was replaced; see the package limitations for unobservable
 * prototype-laundered host or ECMAScript exotics.
 */
export function createImmutableJsonSnapshot<Value>(value: Value): ImmutableJson<Value> {
  assertNoRecognizedExoticObjects(value, new WeakSet());
  const snapshot = JSON.parse(canonicalizeJson(value)) as unknown;
  deepFreezeJson(snapshot);
  return snapshot as ImmutableJson<Value>;
}
