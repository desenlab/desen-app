import { canonicalizeJson } from "@desen/protocol";

import type { DesignSystemJsonObject, DesignSystemJsonValue } from "@desen/design-system-core";

export const AUTHORING_JSON_LIMITS = Object.freeze({
  maxArrayItems: 8_192,
  maxCanonicalBytes: 8 * 1_024 * 1_024,
  maxDepth: 64,
  maxNodes: 50_000,
  maxObjectProperties: 8_192,
  maxStringCodeUnits: 262_144,
});

export type InertJsonFailureCode =
  | "DUPLICATE_MEMBER"
  | "INVALID_JSON"
  | "INVALID_UNICODE"
  | "JSON_LIMIT_EXCEEDED"
  | "UNSAFE_JSON_VALUE";

export class InertJsonError extends Error {
  readonly code: InertJsonFailureCode;
  readonly pointer: string;

  constructor(code: InertJsonFailureCode, pointer: string, message: string) {
    super(message);
    this.name = "InertJsonError";
    this.code = code;
    this.pointer = pointer;
  }
}

interface CaptureState {
  readonly active: WeakSet<object>;
  canonicalBytes: number;
  nodes: number;
}

interface ScanState {
  readonly text: string;
  index: number;
  nodes: number;
}

interface ScannedString {
  readonly issue?: InertJsonFailureCode;
  readonly value: string;
}

const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;

function fail(code: InertJsonFailureCode, pointer: string, message: string): never {
  throw new InertJsonError(code, pointer, message);
}

function consumeCanonicalBytes(state: CaptureState, bytes: number, pointer: string): void {
  state.canonicalBytes += bytes;
  if (state.canonicalBytes > AUTHORING_JSON_LIMITS.maxCanonicalBytes) {
    fail("JSON_LIMIT_EXCEEDED", pointer, "Canonical JSON byte limit exceeded.");
  }
}

function escapePointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function hasUnicodeScalarSequence(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) bytes += 1;
    else if (codeUnit <= 0x7ff) bytes += 2;
    else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
        fail("INVALID_UNICODE", "", "JSON text must contain Unicode scalar values only.");
      }
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("INVALID_UNICODE", "", "JSON text must contain Unicode scalar values only.");
    } else bytes += 3;
  }
  return bytes;
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function captureValue(
  value: unknown,
  pointer: string,
  depth: number,
  state: CaptureState,
): DesignSystemJsonValue {
  state.nodes += 1;
  if (state.nodes > AUTHORING_JSON_LIMITS.maxNodes || depth > AUTHORING_JSON_LIMITS.maxDepth) {
    fail("JSON_LIMIT_EXCEEDED", pointer, "JSON traversal limit exceeded.");
  }
  if (value === null) {
    consumeCanonicalBytes(state, 4, pointer);
    return value;
  }
  if (typeof value === "boolean") {
    consumeCanonicalBytes(state, value ? 4 : 5, pointer);
    return value;
  }
  if (typeof value === "string") {
    if (!hasUnicodeScalarSequence(value)) {
      fail("INVALID_UNICODE", pointer, "JSON strings must contain Unicode scalar values only.");
    }
    if (value.length > AUTHORING_JSON_LIMITS.maxStringCodeUnits) {
      fail("JSON_LIMIT_EXCEEDED", pointer, "JSON string limit exceeded.");
    }
    consumeCanonicalBytes(state, utf8ByteLength(JSON.stringify(value)), pointer);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      fail("INVALID_JSON", pointer, "JSON numbers must be finite and cannot be negative zero.");
    }
    consumeCanonicalBytes(state, canonicalizeJson(value).length, pointer);
    return value;
  }
  if (typeof value !== "object") {
    fail("INVALID_JSON", pointer, `The ${typeof value} value type is not inert JSON.`);
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
    fail("UNSAFE_JSON_VALUE", pointer, "JSON containers must use inert standard prototypes.");
  }
  if (state.active.has(value))
    fail("UNSAFE_JSON_VALUE", pointer, "JSON data cannot contain a cycle.");
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
        length > AUTHORING_JSON_LIMITS.maxArrayItems ||
        ownKeys.length !== length + 1
      ) {
        fail(
          "JSON_LIMIT_EXCEEDED",
          pointer,
          "JSON arrays must be dense and within the item limit.",
        );
      }
      consumeCanonicalBytes(state, 2 + Math.max(0, length - 1), pointer);
      const output: DesignSystemJsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (
          ownKeys[index] !== key ||
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        ) {
          fail(
            "UNSAFE_JSON_VALUE",
            `${pointer}/${key}`,
            "JSON arrays cannot be sparse or executable.",
          );
        }
        output.push(captureValue(descriptor.value, `${pointer}/${key}`, depth + 1, state));
      }
      if (ownKeys[length] !== "length") {
        fail("UNSAFE_JSON_VALUE", pointer, "JSON arrays cannot contain extra or symbolic keys.");
      }
      return output;
    }

    if (ownKeys.length > AUTHORING_JSON_LIMITS.maxObjectProperties) {
      fail("JSON_LIMIT_EXCEEDED", pointer, "JSON object property limit exceeded.");
    }
    if (ownKeys.some((key) => typeof key !== "string")) {
      fail("UNSAFE_JSON_VALUE", pointer, "JSON objects cannot contain symbol keys.");
    }
    const output = Object.create(null) as Record<string, DesignSystemJsonValue>;
    const keys = (ownKeys as readonly string[]).toSorted();
    consumeCanonicalBytes(state, 2 + Math.max(0, keys.length - 1), pointer);
    for (const key of keys) {
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      if (!hasUnicodeScalarSequence(key) || key.length > AUTHORING_JSON_LIMITS.maxStringCodeUnits) {
        fail(
          key.length > AUTHORING_JSON_LIMITS.maxStringCodeUnits
            ? "JSON_LIMIT_EXCEEDED"
            : "INVALID_UNICODE",
          childPointer,
          "JSON member names must be bounded Unicode scalar strings.",
        );
      }
      consumeCanonicalBytes(state, utf8ByteLength(JSON.stringify(key)) + 1, childPointer);
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail("UNSAFE_JSON_VALUE", childPointer, "JSON members must be own data properties.");
      }
      output[key] = captureValue(descriptor.value, childPointer, depth + 1, state);
    }
    return output;
  } finally {
    state.active.delete(value);
  }
}

export function captureInertJson(value: unknown): DesignSystemJsonValue {
  const captured = captureValue(value, "", 0, {
    active: new WeakSet<object>(),
    canonicalBytes: 0,
    nodes: 0,
  });
  const canonical = canonicalizeJson(captured);
  if (utf8ByteLength(canonical) > AUTHORING_JSON_LIMITS.maxCanonicalBytes) {
    fail("JSON_LIMIT_EXCEEDED", "", "Canonical JSON byte limit exceeded.");
  }
  return deepFreeze(JSON.parse(canonical) as DesignSystemJsonValue);
}

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function skipWhitespace(state: ScanState): void {
  while (isWhitespace(state.text[state.index])) state.index += 1;
}

function scanString(state: ScanState): ScannedString {
  const start = state.index;
  state.index += 1;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (character === '"') {
      state.index += 1;
      let value: unknown;
      try {
        value = JSON.parse(state.text.slice(start, state.index)) as unknown;
      } catch {
        return { issue: "INVALID_JSON", value: "" };
      }
      if (typeof value !== "string") return { issue: "INVALID_JSON", value: "" };
      if (!hasUnicodeScalarSequence(value)) return { issue: "INVALID_UNICODE", value: "" };
      if (value.length > AUTHORING_JSON_LIMITS.maxStringCodeUnits) {
        return { issue: "JSON_LIMIT_EXCEEDED", value: "" };
      }
      return { value };
    }
    if (character === "\\") {
      state.index += 1;
      if (state.text[state.index] === "u") state.index += 4;
    }
    state.index += 1;
  }
  return { issue: "INVALID_JSON", value: "" };
}

function scanNumber(state: ScanState): InertJsonFailureCode | undefined {
  const start = state.index;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (isWhitespace(character) || character === "," || character === "]" || character === "}")
      break;
    state.index += 1;
    if (state.index - start > 1_024) return "JSON_LIMIT_EXCEEDED";
  }
  const token = state.text.slice(start, state.index);
  const number = Number(token);
  return NUMBER_PATTERN.test(token) && Number.isFinite(number) && !Object.is(number, -0)
    ? undefined
    : "INVALID_JSON";
}

function scanLiteral(
  state: ScanState,
  literal: "false" | "null" | "true",
): InertJsonFailureCode | undefined {
  if (state.text.slice(state.index, state.index + literal.length) !== literal)
    return "INVALID_JSON";
  state.index += literal.length;
  return undefined;
}

function scanValue(state: ScanState, depth: number): InertJsonFailureCode | undefined {
  state.nodes += 1;
  if (state.nodes > AUTHORING_JSON_LIMITS.maxNodes || depth > AUTHORING_JSON_LIMITS.maxDepth) {
    return "JSON_LIMIT_EXCEEDED";
  }
  skipWhitespace(state);
  const character = state.text[state.index];
  if (character === "{") return scanObject(state, depth);
  if (character === "[") return scanArray(state, depth);
  if (character === '"') return scanString(state).issue;
  if (character === "t") return scanLiteral(state, "true");
  if (character === "f") return scanLiteral(state, "false");
  if (character === "n") return scanLiteral(state, "null");
  if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
    return scanNumber(state);
  }
  return "INVALID_JSON";
}

function scanArray(state: ScanState, depth: number): InertJsonFailureCode | undefined {
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "]") {
    state.index += 1;
    return undefined;
  }
  let count = 0;
  while (state.index < state.text.length) {
    count += 1;
    if (count > AUTHORING_JSON_LIMITS.maxArrayItems) return "JSON_LIMIT_EXCEEDED";
    const issue = scanValue(state, depth + 1);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "]") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return "INVALID_JSON";
    state.index += 1;
    skipWhitespace(state);
  }
  return "INVALID_JSON";
}

function scanObject(state: ScanState, depth: number): InertJsonFailureCode | undefined {
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "}") {
    state.index += 1;
    return undefined;
  }
  const keys = new Set<string>();
  while (state.index < state.text.length) {
    if (keys.size >= AUTHORING_JSON_LIMITS.maxObjectProperties) return "JSON_LIMIT_EXCEEDED";
    if (state.text[state.index] !== '"') return "INVALID_JSON";
    const key = scanString(state);
    if (key.issue !== undefined) return key.issue;
    if (keys.has(key.value)) return "DUPLICATE_MEMBER";
    keys.add(key.value);
    skipWhitespace(state);
    if (state.text[state.index] !== ":") return "INVALID_JSON";
    state.index += 1;
    const issue = scanValue(state, depth + 1);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "}") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return "INVALID_JSON";
    state.index += 1;
    skipWhitespace(state);
  }
  return "INVALID_JSON";
}

export function parseInertJsonText(
  input: unknown,
):
  | { readonly ok: true; readonly value: DesignSystemJsonValue }
  | { readonly ok: false; readonly issue: InertJsonFailureCode } {
  if (typeof input !== "string") return Object.freeze({ issue: "INVALID_JSON", ok: false });
  let byteLength: number;
  try {
    byteLength = utf8ByteLength(input);
  } catch (error) {
    return Object.freeze({
      issue: error instanceof InertJsonError ? error.code : "INVALID_UNICODE",
      ok: false,
    });
  }
  if (byteLength > AUTHORING_JSON_LIMITS.maxCanonicalBytes) {
    return Object.freeze({ issue: "JSON_LIMIT_EXCEEDED", ok: false });
  }
  const state: ScanState = { text: input, index: 0, nodes: 0 };
  skipWhitespace(state);
  const issue = scanValue(state, 0);
  skipWhitespace(state);
  if (issue !== undefined || state.index !== input.length) {
    return Object.freeze({ issue: issue ?? "INVALID_JSON", ok: false });
  }
  try {
    const parsed = JSON.parse(input) as unknown;
    return Object.freeze({ ok: true, value: captureInertJson(parsed) });
  } catch {
    return Object.freeze({ issue: "INVALID_JSON", ok: false });
  }
}

export function asJsonObject(value: DesignSystemJsonValue): DesignSystemJsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DesignSystemJsonObject)
    : undefined;
}
