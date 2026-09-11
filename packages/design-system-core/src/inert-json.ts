import { canonicalizeJson } from "@desen/protocol";

/** A scalar accepted by the editable-project JSON boundary. */
export type DesignSystemJsonPrimitive = string | number | boolean | null;

/** A recursively immutable JSON value returned by Design System Core. */
export type DesignSystemJsonValue =
  DesignSystemJsonPrimitive | readonly DesignSystemJsonValue[] | DesignSystemJsonObject;

/** A recursively immutable string-keyed JSON object returned by Design System Core. */
export interface DesignSystemJsonObject {
  readonly [key: string]: DesignSystemJsonValue;
}

/** Finite safety limits applied before protocol canonicalization. */
export const DESIGN_SYSTEM_JSON_LIMITS = Object.freeze({
  maxDepth: 64,
  maxNodes: 50_000,
  maxCanonicalBytes: 8 * 1024 * 1024,
  maxArrayItems: 8_192,
  maxObjectProperties: 8_192,
  maxStringCodeUnits: 262_144,
});

/** Stable reason why an inert JSON candidate could not be captured. */
export type InertJsonCaptureFailureCode =
  "JSON_LIMIT_EXCEEDED" | "UNSAFE_JSON_VALUE" | "INVALID_JSON_VALUE";

/** Controlled internal failure emitted while capturing untrusted inert JSON. */
export class InertJsonCaptureError extends Error {
  /** Stable machine-readable failure class. */
  readonly code: InertJsonCaptureFailureCode;
  /** JSON Pointer-like location at which admission stopped. */
  readonly pointer: string;

  /** Creates a bounded inert-JSON capture failure. */
  constructor(code: InertJsonCaptureFailureCode, pointer: string, message: string) {
    super(message);
    this.name = "InertJsonCaptureError";
    this.code = code;
    this.pointer = pointer;
  }
}

interface JsonCaptureState {
  readonly active: WeakSet<object>;
  canonicalBytes: number;
  nodes: number;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function fail(code: InertJsonCaptureFailureCode, pointer: string, message: string): never {
  throw new InertJsonCaptureError(code, pointer, message);
}

function sortedKeys(keys: readonly string[]): string[] {
  return [...keys].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) bytes += 1;
    else if (codeUnit <= 0x7ff) bytes += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

function jsonScalarByteLength(value: DesignSystemJsonPrimitive): number {
  return utf8ByteLength(JSON.stringify(value));
}

function reserveCanonicalBytes(state: JsonCaptureState, bytes: number, pointer: string): void {
  state.canonicalBytes += bytes;
  if (state.canonicalBytes > DESIGN_SYSTEM_JSON_LIMITS.maxCanonicalBytes) {
    fail("JSON_LIMIT_EXCEEDED", pointer, "Canonical JSON byte limit exceeded.");
  }
}

function captureJsonValue(
  value: unknown,
  pointer: string,
  depth: number,
  state: JsonCaptureState,
): DesignSystemJsonValue {
  state.nodes += 1;
  if (
    state.nodes > DESIGN_SYSTEM_JSON_LIMITS.maxNodes ||
    depth > DESIGN_SYSTEM_JSON_LIMITS.maxDepth
  ) {
    fail("JSON_LIMIT_EXCEEDED", pointer, "JSON traversal limit exceeded.");
  }

  if (value === null || typeof value === "boolean") {
    reserveCanonicalBytes(state, jsonScalarByteLength(value), pointer);
    return value;
  }
  if (typeof value === "string") {
    if (value.length > DESIGN_SYSTEM_JSON_LIMITS.maxStringCodeUnits) {
      fail("JSON_LIMIT_EXCEEDED", pointer, "JSON string limit exceeded.");
    }
    reserveCanonicalBytes(state, jsonScalarByteLength(value), pointer);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("INVALID_JSON_VALUE", pointer, "JSON numbers must be finite.");
    }
    reserveCanonicalBytes(state, jsonScalarByteLength(value), pointer);
    return value;
  }
  if (typeof value !== "object") {
    fail("INVALID_JSON_VALUE", pointer, `The ${typeof value} value type is not JSON data.`);
  }

  let isArray: boolean;
  let prototype: object | null;
  let ownKeys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value) as object | null;
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    fail("UNSAFE_JSON_VALUE", pointer, "JSON container inspection failed.");
  }
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype && prototype !== null)
  ) {
    fail("UNSAFE_JSON_VALUE", pointer, "JSON containers must use standard inert prototypes.");
  }
  if (state.active.has(value)) {
    fail("INVALID_JSON_VALUE", pointer, "JSON data cannot contain a cycle.");
  }
  state.active.add(value);

  try {
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      const length =
        lengthDescriptor !== undefined && Object.hasOwn(lengthDescriptor, "value")
          ? lengthDescriptor.value
          : undefined;
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > DESIGN_SYSTEM_JSON_LIMITS.maxArrayItems ||
        ownKeys.length !== length + 1 ||
        ownKeys.at(-1) !== "length"
      ) {
        fail(
          "JSON_LIMIT_EXCEEDED",
          pointer,
          "JSON arrays must be dense and within the item limit.",
        );
      }
      reserveCanonicalBytes(state, 2 + Math.max(0, length - 1), pointer);
      const output: DesignSystemJsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        if (ownKeys[index] !== key) {
          fail("UNSAFE_JSON_VALUE", pointer, "JSON arrays cannot contain extra or symbolic keys.");
        }
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !Object.hasOwn(descriptor, "value") ||
          !descriptor.enumerable
        ) {
          fail(
            "UNSAFE_JSON_VALUE",
            `${pointer}/${key}`,
            "JSON members must be own data properties.",
          );
        }
        output.push(captureJsonValue(descriptor.value, `${pointer}/${key}`, depth + 1, state));
      }
      return output;
    }

    if (ownKeys.length > DESIGN_SYSTEM_JSON_LIMITS.maxObjectProperties) {
      fail("JSON_LIMIT_EXCEEDED", pointer, "JSON object property limit exceeded.");
    }
    if (ownKeys.some((key) => typeof key !== "string")) {
      fail("UNSAFE_JSON_VALUE", pointer, "JSON objects cannot contain symbol keys.");
    }
    const keys = sortedKeys(ownKeys as readonly string[]);
    reserveCanonicalBytes(state, 2 + Math.max(0, keys.length - 1), pointer);
    const output = Object.create(null) as Record<string, DesignSystemJsonValue>;
    for (const key of keys) {
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      if (key.length > DESIGN_SYSTEM_JSON_LIMITS.maxStringCodeUnits) {
        fail("JSON_LIMIT_EXCEEDED", childPointer, "JSON property-name limit exceeded.");
      }
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !Object.hasOwn(descriptor, "value") ||
        !descriptor.enumerable
      ) {
        fail("UNSAFE_JSON_VALUE", childPointer, "JSON members must be own data properties.");
      }
      reserveCanonicalBytes(state, jsonScalarByteLength(key) + 1, childPointer);
      output[key] = captureJsonValue(descriptor.value, childPointer, depth + 1, state);
    }
    return output;
  } finally {
    state.active.delete(value);
  }
}

function deepFreeze(value: DesignSystemJsonValue): DesignSystemJsonValue {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Captures an independent, key-canonical, recursively frozen and finitely bounded JSON snapshot.
 *
 * @remarks Accessors, symbol/hidden properties, custom prototypes, sparse arrays, cycles and
 * non-finite or executable values are rejected. Caller-owned data is neither retained nor frozen.
 */
export function captureDesignSystemJson(value: unknown): DesignSystemJsonValue {
  const captured = captureJsonValue(value, "", 0, {
    active: new WeakSet<object>(),
    canonicalBytes: 0,
    nodes: 0,
  });
  let canonical: string;
  try {
    canonical = canonicalizeJson(captured);
  } catch (error) {
    fail(
      "INVALID_JSON_VALUE",
      "",
      error instanceof Error ? error.message : "JSON canonicalization failed.",
    );
  }
  if (utf8ByteLength(canonical) > DESIGN_SYSTEM_JSON_LIMITS.maxCanonicalBytes) {
    fail("JSON_LIMIT_EXCEEDED", "", "Canonical JSON byte limit exceeded.");
  }
  return deepFreeze(JSON.parse(canonical) as DesignSystemJsonValue);
}
