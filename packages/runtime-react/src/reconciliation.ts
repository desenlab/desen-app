import { canonicalizeJson } from "@desen/protocol";

import { RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS } from "./registry.js";

import type { RuntimeJsonObject, RuntimeJsonValue } from "@desen/runtime-core";

const RECONCILIATION_KEY_PROFILE = "desen.runtime-react/reconciliation-key@0.1.0";

/**
 * Complete trusted input used to derive one adapter instance's React reconciliation key.
 *
 * @remarks `remountOnProps` must be the detached policy captured by the adapter registry. The
 * validated render plan supplies `runtimeNodeId`, `capabilityId`, and `props`; Catalogs and Bundles
 * cannot supply or override the policy.
 */
export interface RuntimeReactReconciliationKeyInput {
  /** Stable materialized component or behavior instance identity. */
  readonly runtimeNodeId: string;
  /** Exact registered adapter capability identity. */
  readonly capabilityId: string;
  /** Detached, validated resolved props for the instance. */
  readonly props: RuntimeJsonObject;
  /** Static trusted property names whose presence or value requires remounting. */
  readonly remountOnProps: readonly string[];
}

interface OwnDataValue {
  readonly present: boolean;
  readonly valid: boolean;
  readonly value?: unknown;
}

function ownEnumerableDataValue(value: object, key: PropertyKey): OwnDataValue {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { present: false, valid: true };
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      return { present: true, valid: false };
    }
    return { present: true, valid: true, value: descriptor.value };
  } catch {
    return { present: false, valid: false };
  }
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

function hasExactInputShape(
  value: Record<string, unknown>,
): value is Record<keyof RuntimeReactReconciliationKeyInput, unknown> {
  try {
    if (Object.getOwnPropertySymbols(value).length !== 0) return false;
    const expected = ["runtimeNodeId", "capabilityId", "props", "remountOnProps"];
    const names = Object.getOwnPropertyNames(value);
    return names.length === expected.length && expected.every((name) => names.includes(name));
  } catch {
    return false;
  }
}

function fail(message: string): never {
  throw new TypeError(`Cannot create React reconciliation key: ${message}`);
}

function captureRemountOnProps(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return fail("remountOnProps must be an ordinary dense array");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      return fail("remountOnProps must not contain symbol properties");
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable !== false ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS.maxRemountPropsPerAdapter
    ) {
      return fail("remountOnProps exceeds its property-count limit");
    }
    const length = lengthDescriptor.value as number;
    const ownNames = Object.getOwnPropertyNames(value);
    if (
      ownNames.length !== length + 1 ||
      !ownNames.includes("length") ||
      ownNames.some((name) => name !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(name))
    ) {
      return fail("remountOnProps must be an ordinary dense array");
    }

    const names = new Set<string>();
    let codeUnits = 0;
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string"
      ) {
        return fail("remountOnProps entries must be enumerable own-data strings");
      }
      if (names.has(descriptor.value)) return fail("remountOnProps contains a duplicate name");
      codeUnits += descriptor.value.length;
      if (codeUnits > RUNTIME_REACT_ADAPTER_REGISTRY_LIMITS.maxRemountPropCodeUnits) {
        return fail("remountOnProps exceeds its string limit");
      }
      names.add(descriptor.value);
    }
    const canonicalNames = [...names].sort();
    canonicalizeJson(canonicalNames);
    return Object.freeze(canonicalNames);
  } catch (error) {
    if (
      error instanceof TypeError &&
      error.message.startsWith("Cannot create React reconciliation key:")
    ) {
      throw error;
    }
    return fail("remountOnProps is not inert RFC 8785-compatible data");
  }
}

/**
 * Derives one collision-safe RFC 8785 canonical React reconciliation key.
 *
 * @remarks The key always includes the stable runtime identity and exact adapter capability.
 * It additionally includes a presence-aware projection of only the statically registered
 * `remountOnProps`: a missing property and an explicitly present `null` therefore produce distinct
 * keys. Undeclared prop changes cannot change the key, and semantic object property order cannot
 * affect it. This helper does not read style, slots, Catalog data, Bundle data, callbacks, React
 * instances, or platform objects.
 *
 * @throws TypeError when the input envelope, policy, selected prop, or selected prop value is not
 * inert RFC 8785-compatible own data within the registry policy limits.
 */
export function createRuntimeReactReconciliationKey(
  input: RuntimeReactReconciliationKeyInput,
): string {
  if (!isPlainRecord(input) || !hasExactInputShape(input)) {
    return fail("input must be an exact plain own-data record");
  }
  const runtimeNodeId = ownEnumerableDataValue(input, "runtimeNodeId");
  const capabilityId = ownEnumerableDataValue(input, "capabilityId");
  const props = ownEnumerableDataValue(input, "props");
  const remountOnProps = ownEnumerableDataValue(input, "remountOnProps");
  if (
    !runtimeNodeId.valid ||
    !runtimeNodeId.present ||
    typeof runtimeNodeId.value !== "string" ||
    runtimeNodeId.value.length === 0 ||
    !capabilityId.valid ||
    !capabilityId.present ||
    typeof capabilityId.value !== "string" ||
    capabilityId.value.length === 0 ||
    !props.valid ||
    !props.present ||
    !isPlainRecord(props.value) ||
    !remountOnProps.valid ||
    !remountOnProps.present
  ) {
    return fail("input members must be enumerable own data of the declared types");
  }

  const propertyNames = captureRemountOnProps(remountOnProps.value);
  const projection: (
    | Readonly<{ readonly name: string; readonly presence: "missing" }>
    | Readonly<{
        readonly name: string;
        readonly presence: "present";
        readonly value: RuntimeJsonValue;
      }>
  )[] = [];
  for (const name of propertyNames) {
    const selected = ownEnumerableDataValue(props.value, name);
    if (!selected.valid) return fail(`selected prop ${JSON.stringify(name)} is not own data`);
    projection.push(
      selected.present
        ? Object.freeze({
            name,
            presence: "present",
            value: selected.value as RuntimeJsonValue,
          })
        : Object.freeze({ name, presence: "missing" }),
    );
  }

  try {
    return canonicalizeJson({
      capabilityId: capabilityId.value,
      profile: RECONCILIATION_KEY_PROFILE,
      remountProps: projection,
      runtimeNodeId: runtimeNodeId.value,
    });
  } catch {
    return fail("selected identity or prop data is not inert RFC 8785-compatible JSON");
  }
}
