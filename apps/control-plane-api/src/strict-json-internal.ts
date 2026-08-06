import { TextDecoder } from "node:util";

/** @internal Finite limits for strict interoperable-JSON capture. */
export interface StrictJsonLimits {
  readonly maxDecodedStringCodeUnits: number;
  readonly maxDepth: number;
  readonly maxNumberTokenCodeUnits: number;
  readonly maxValueOccurrences: number;
}

/** @internal Recursively immutable JSON object accepted by strict ingress. */
export interface StrictJsonObject {
  readonly [key: string]: StrictJsonValue;
}

/** @internal Recursively immutable JSON value accepted by strict ingress. */
export type StrictJsonValue =
  null | boolean | number | string | readonly StrictJsonValue[] | StrictJsonObject;

/** @internal Linked path retained only when strict ingress rejects one value. */
export interface StrictJsonPath {
  readonly parent?: StrictJsonPath;
  readonly segment?: string | number;
}

/** @internal Stable rejection class and location from strict JSON ingress. */
export type StrictJsonIssue = Readonly<{
  readonly kind: "duplicate" | "invalid" | "limit";
  readonly path: StrictJsonPath;
}>;

/** @internal Complete result of strict JSON byte ingress. */
export type StrictJsonParseResult =
  | Readonly<{ readonly status: "parsed"; readonly value: StrictJsonValue }>
  | Readonly<{ readonly status: "rejected"; readonly issue: StrictJsonIssue }>;

interface ScanState {
  readonly limits: StrictJsonLimits;
  readonly text: string;
  decodedStringCodeUnits: number;
  index: number;
  valueOccurrences: number;
}

interface ScannedString {
  readonly issue?: StrictJsonIssue;
  readonly value: string;
}

const ROOT_PATH = Object.freeze({}) as StrictJsonPath;
const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function childPath(parent: StrictJsonPath, segment: string | number): StrictJsonPath {
  return { parent, segment };
}

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r";
}

function skipWhitespace(state: ScanState): void {
  while (isWhitespace(state.text[state.index])) state.index += 1;
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

function scanString(state: ScanState, path: StrictJsonPath): ScannedString {
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
        return { value: "", issue: { kind: "invalid", path } };
      }
      if (typeof value !== "string" || !hasUnicodeScalarSequence(value)) {
        return { value: "", issue: { kind: "invalid", path } };
      }
      state.decodedStringCodeUnits += value.length;
      if (state.decodedStringCodeUnits > state.limits.maxDecodedStringCodeUnits) {
        return { value: "", issue: { kind: "limit", path } };
      }
      return { value };
    }
    if (character === "\\") {
      state.index += 1;
      if (state.text[state.index] === "u") state.index += 4;
    }
    state.index += 1;
  }
  return { value: "", issue: { kind: "invalid", path } };
}

function scanNumber(state: ScanState, path: StrictJsonPath): StrictJsonIssue | undefined {
  const start = state.index;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (isWhitespace(character) || character === "," || character === "]" || character === "}") {
      break;
    }
    state.index += 1;
    if (state.index - start > state.limits.maxNumberTokenCodeUnits) {
      return { kind: "limit", path };
    }
  }
  const token = state.text.slice(start, state.index);
  return NUMBER_PATTERN.test(token) && Number.isFinite(Number(token))
    ? undefined
    : { kind: "invalid", path };
}

function scanLiteral(
  state: ScanState,
  literal: "false" | "null" | "true",
  path: StrictJsonPath,
): StrictJsonIssue | undefined {
  if (state.text.slice(state.index, state.index + literal.length) !== literal) {
    return { kind: "invalid", path };
  }
  state.index += literal.length;
  return undefined;
}

function scanArray(
  state: ScanState,
  path: StrictJsonPath,
  depth: number,
): StrictJsonIssue | undefined {
  if (depth > state.limits.maxDepth) return { kind: "limit", path };
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "]") {
    state.index += 1;
    return undefined;
  }

  let itemIndex = 0;
  while (state.index < state.text.length) {
    const issue = scanValue(state, childPath(path, itemIndex), depth);
    if (issue !== undefined) return issue;
    itemIndex += 1;
    skipWhitespace(state);
    if (state.text[state.index] === "]") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
  }
  return { kind: "invalid", path };
}

function scanObject(
  state: ScanState,
  path: StrictJsonPath,
  depth: number,
): StrictJsonIssue | undefined {
  if (depth > state.limits.maxDepth) return { kind: "limit", path };
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "}") {
    state.index += 1;
    return undefined;
  }

  const keys = new Set<string>();
  while (state.index < state.text.length) {
    if (state.text[state.index] !== '"') return { kind: "invalid", path };
    const key = scanString(state, path);
    if (key.issue !== undefined) return key.issue;
    const memberPath = childPath(path, key.value);
    if (keys.has(key.value)) return { kind: "duplicate", path: memberPath };
    keys.add(key.value);
    skipWhitespace(state);
    if (state.text[state.index] !== ":") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
    const issue = scanValue(state, memberPath, depth);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "}") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return { kind: "invalid", path };
    state.index += 1;
    skipWhitespace(state);
  }
  return { kind: "invalid", path };
}

function scanValue(
  state: ScanState,
  path: StrictJsonPath,
  parentDepth: number,
): StrictJsonIssue | undefined {
  state.valueOccurrences += 1;
  if (state.valueOccurrences > state.limits.maxValueOccurrences) {
    return { kind: "limit", path };
  }
  skipWhitespace(state);
  const character = state.text[state.index];
  if (character === "{") return scanObject(state, path, parentDepth + 1);
  if (character === "[") return scanArray(state, path, parentDepth + 1);
  if (character === '"') return scanString(state, path).issue;
  if (character === "t") return scanLiteral(state, "true", path);
  if (character === "f") return scanLiteral(state, "false", path);
  if (character === "n") return scanLiteral(state, "null", path);
  if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
    return scanNumber(state, path);
  }
  return { kind: "invalid", path };
}

function scanJson(text: string, limits: StrictJsonLimits): StrictJsonIssue | undefined {
  const state: ScanState = {
    limits,
    text,
    decodedStringCodeUnits: 0,
    index: 0,
    valueOccurrences: 0,
  };
  skipWhitespace(state);
  const issue = scanValue(state, ROOT_PATH, 0);
  if (issue !== undefined) return issue;
  skipWhitespace(state);
  return state.index === text.length ? undefined : { kind: "invalid", path: ROOT_PATH };
}

function deepFreezeJson(value: StrictJsonValue): StrictJsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    const object = value as StrictJsonObject;
    Object.keys(object).forEach((key) => deepFreezeJson(object[key] as StrictJsonValue));
  }
  return Object.freeze(value) as StrictJsonValue;
}

function canonicalStringByteLength(value: string): number {
  let bytes = 2;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22 || codeUnit === 0x5c) {
      bytes += 2;
    } else if (
      codeUnit === 0x08 ||
      codeUnit === 0x09 ||
      codeUnit === 0x0a ||
      codeUnit === 0x0c ||
      codeUnit === 0x0d
    ) {
      bytes += 2;
    } else if (codeUnit <= 0x1f) {
      bytes += 6;
    } else if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function hasLeadingBom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

/** @internal Converts an opaque linked rejection path to ordered JSON path segments. */
export function strictJsonPathSegments(path: StrictJsonPath): readonly (string | number)[] {
  const segments: (string | number)[] = [];
  let current: StrictJsonPath | undefined = path;
  while (current?.parent !== undefined) {
    segments.push(current.segment as string | number);
    current = current.parent;
  }
  segments.reverse();
  return Object.freeze(segments);
}

/**
 * @internal Measures RFC 8785 output without allocating it, stopping after the supplied maximum.
 */
export function canonicalJsonByteLengthWithin(
  value: StrictJsonValue,
  maximum: number,
): number | undefined {
  let bytes = 0;
  const charge = (amount: number): boolean => {
    bytes += amount;
    return bytes <= maximum;
  };
  const visit = (current: StrictJsonValue): boolean => {
    if (current === null) return charge(4);
    if (typeof current === "boolean") return charge(current ? 4 : 5);
    if (typeof current === "number") return charge(JSON.stringify(current).length);
    if (typeof current === "string") return charge(canonicalStringByteLength(current));
    if (Array.isArray(current)) {
      if (!charge(2 + Math.max(0, current.length - 1))) return false;
      return current.every((item) => visit(item));
    }
    const object = current as StrictJsonObject;
    const keys = Object.keys(object);
    if (!charge(2 + Math.max(0, keys.length - 1))) return false;
    return keys.every(
      (key) => charge(canonicalStringByteLength(key) + 1) && visit(object[key] as StrictJsonValue),
    );
  };
  return visit(value) ? bytes : undefined;
}

/** @internal Parses one exact UTF-8 JSON byte sequence under a caller-owned finite profile. */
export function parseStrictJsonBytes(
  bytes: Uint8Array,
  limits: StrictJsonLimits,
): StrictJsonParseResult {
  if (hasLeadingBom(bytes)) {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
  const issue = scanJson(text, limits);
  if (issue !== undefined) return { status: "rejected", issue };

  try {
    return {
      status: "parsed",
      value: deepFreezeJson(JSON.parse(text) as StrictJsonValue),
    };
  } catch {
    return { status: "rejected", issue: { kind: "invalid", path: ROOT_PATH } };
  }
}
