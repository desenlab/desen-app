import { PUBLISH_SOURCE_JSON_LIMITS } from "@desen/publisher";
import { canonicalizeJson } from "@desen/protocol";

import type { JsonValue } from "@desen/catalog-sdk";

/** Stable reason why Desen App rejected one structured-JSON text edit. */
export type StructuredJsonParseFailureReason =
  "duplicate-member" | "dynamic-value" | "invalid-json" | "invalid-unicode" | "limit-exceeded";

/** Successful strict structured-JSON capture with no shared mutable caller state. */
export interface StructuredJsonParseSuccess {
  readonly ok: true;
  readonly value: JsonValue;
}

/** Fail-closed structured-JSON capture with no partial parsed value. */
export interface StructuredJsonParseFailure {
  readonly ok: false;
  readonly reason: StructuredJsonParseFailureReason;
}

/** Complete result of parsing one Desen App structured-JSON text edit. */
export type StructuredJsonParseResult = StructuredJsonParseFailure | StructuredJsonParseSuccess;

type ScanIssue = StructuredJsonParseFailureReason;

interface ScanState {
  readonly text: string;
  decodedStringCodeUnits: number;
  dynamicValue: boolean;
  index: number;
  valueOccurrences: number;
}

interface ScannedString {
  readonly issue?: ScanIssue;
  readonly value: string;
}

const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;

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

function measureUtf8Bytes(value: string): "invalid-unicode" | "limit-exceeded" | undefined {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) return "invalid-unicode";
      bytes += 4;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return "invalid-unicode";
    } else {
      bytes += 3;
    }
    if (bytes > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes) return "limit-exceeded";
  }
  return undefined;
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
        return { value: "", issue: "invalid-json" };
      }
      if (typeof value !== "string") return { value: "", issue: "invalid-json" };
      if (!hasUnicodeScalarSequence(value)) return { value: "", issue: "invalid-unicode" };
      state.decodedStringCodeUnits += value.length;
      if (state.decodedStringCodeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxDecodedStringCodeUnits) {
        return { value: "", issue: "limit-exceeded" };
      }
      return { value };
    }
    if (character === "\\") {
      state.index += 1;
      if (state.text[state.index] === "u") state.index += 4;
    }
    state.index += 1;
  }
  return { value: "", issue: "invalid-json" };
}

function scanNumber(state: ScanState): ScanIssue | undefined {
  const start = state.index;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (isWhitespace(character) || character === "," || character === "]" || character === "}") {
      break;
    }
    state.index += 1;
    if (state.index - start > PUBLISH_SOURCE_JSON_LIMITS.maxNumberTokenCodeUnits) {
      return "limit-exceeded";
    }
  }
  const token = state.text.slice(start, state.index);
  return NUMBER_PATTERN.test(token) && Number.isFinite(Number(token)) ? undefined : "invalid-json";
}

function scanLiteral(state: ScanState, literal: "false" | "null" | "true"): ScanIssue | undefined {
  if (state.text.slice(state.index, state.index + literal.length) !== literal) {
    return "invalid-json";
  }
  state.index += literal.length;
  return undefined;
}

function scanArray(state: ScanState, depth: number): ScanIssue | undefined {
  if (depth > PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth) return "limit-exceeded";
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "]") {
    state.index += 1;
    return undefined;
  }

  while (state.index < state.text.length) {
    const issue = scanValue(state, depth);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "]") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return "invalid-json";
    state.index += 1;
    skipWhitespace(state);
  }
  return "invalid-json";
}

function scanObject(state: ScanState, depth: number): ScanIssue | undefined {
  if (depth > PUBLISH_SOURCE_JSON_LIMITS.maxJsonDepth) return "limit-exceeded";
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "}") {
    state.index += 1;
    return undefined;
  }

  const keys = new Set<string>();
  while (state.index < state.text.length) {
    if (state.text[state.index] !== '"') return "invalid-json";
    const key = scanString(state);
    if (key.issue !== undefined) return key.issue;
    if (keys.has(key.value)) return "duplicate-member";
    keys.add(key.value);
    if (key.value.startsWith("$")) state.dynamicValue = true;
    skipWhitespace(state);
    if (state.text[state.index] !== ":") return "invalid-json";
    state.index += 1;
    skipWhitespace(state);
    const issue = scanValue(state, depth);
    if (issue !== undefined) return issue;
    skipWhitespace(state);
    if (state.text[state.index] === "}") {
      state.index += 1;
      return undefined;
    }
    if (state.text[state.index] !== ",") return "invalid-json";
    state.index += 1;
    skipWhitespace(state);
  }
  return "invalid-json";
}

function scanValue(state: ScanState, parentDepth: number): ScanIssue | undefined {
  state.valueOccurrences += 1;
  if (state.valueOccurrences > PUBLISH_SOURCE_JSON_LIMITS.maxJsonValueOccurrences) {
    return "limit-exceeded";
  }
  skipWhitespace(state);
  const character = state.text[state.index];
  if (character === "{") return scanObject(state, parentDepth + 1);
  if (character === "[") return scanArray(state, parentDepth + 1);
  if (character === '"') return scanString(state).issue;
  if (character === "t") return scanLiteral(state, "true");
  if (character === "f") return scanLiteral(state, "false");
  if (character === "n") return scanLiteral(state, "null");
  if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
    return scanNumber(state);
  }
  return "invalid-json";
}

function scanStructuredJson(text: string): ScanIssue | undefined {
  const byteIssue = measureUtf8Bytes(text);
  if (byteIssue !== undefined) return byteIssue;

  const state: ScanState = {
    text,
    decodedStringCodeUnits: 0,
    dynamicValue: false,
    index: 0,
    valueOccurrences: 0,
  };
  skipWhitespace(state);
  const issue = scanValue(state, 0);
  if (issue !== undefined) return issue;
  skipWhitespace(state);
  if (state.index !== text.length) return "invalid-json";
  return state.dynamicValue ? "dynamic-value" : undefined;
}

function deepFreezeJson(value: JsonValue): JsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    const object = value as Readonly<Record<string, JsonValue>>;
    Object.keys(object).forEach((key) => deepFreezeJson(object[key] as JsonValue));
  }
  return Object.freeze(value) as JsonValue;
}

function failure(reason: StructuredJsonParseFailureReason): StructuredJsonParseFailure {
  return Object.freeze({ ok: false, reason });
}

/**
 * Parses one user-authored structured-JSON string under the Publisher Source JSON limit profile.
 *
 * @remarks Parsing rejects malformed JSON, decoded duplicate object members, non-scalar Unicode,
 * finite-profile exhaustion, and every object member whose decoded name starts with `$`. The last
 * rule keeps protocol dynamic-value authoring assigned to M09-T08. Success returns a detached,
 * recursively frozen JSON value; failure returns no partial value.
 */
export function parseStructuredJsonText(input: unknown): StructuredJsonParseResult {
  if (typeof input !== "string") return failure("invalid-json");
  const issue = scanStructuredJson(input);
  if (issue !== undefined) return failure(issue);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return failure("invalid-json");
  }
  return Object.freeze({ ok: true, value: deepFreezeJson(parsed as JsonValue) });
}

interface PrettyJsonState {
  readonly chunks: string[];
  codeUnits: number;
  limitExceeded: boolean;
}

function appendPrettyChunks(state: PrettyJsonState, ...chunks: string[]): void {
  for (const chunk of chunks) {
    state.codeUnits += chunk.length;
    if (state.codeUnits > PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes) {
      state.limitExceeded = true;
      state.chunks.length = 0;
      return;
    }
    state.chunks.push(chunk);
  }
}

function appendPrettyJson(value: JsonValue, depth: number, state: PrettyJsonState): void {
  if (state.limitExceeded) return;
  if (typeof value !== "object" || value === null) {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError("Expected a validated JSON primitive.");
    appendPrettyChunks(state, encoded);
    return;
  }

  const indentation = "  ".repeat(depth);
  const childIndentation = `${indentation}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      appendPrettyChunks(state, "[]");
      return;
    }
    appendPrettyChunks(state, "[\n");
    value.forEach((item, index) => {
      if (state.limitExceeded) return;
      if (index > 0) appendPrettyChunks(state, ",\n");
      appendPrettyChunks(state, childIndentation);
      appendPrettyJson(item, depth + 1, state);
    });
    if (!state.limitExceeded) appendPrettyChunks(state, "\n", indentation, "]");
    return;
  }

  const object = value as Readonly<Record<string, JsonValue>>;
  const keys = Object.keys(object).sort();
  if (keys.length === 0) {
    appendPrettyChunks(state, "{}");
    return;
  }
  appendPrettyChunks(state, "{\n");
  keys.forEach((key, index) => {
    if (state.limitExceeded) return;
    if (index > 0) appendPrettyChunks(state, ",\n");
    appendPrettyChunks(state, childIndentation, JSON.stringify(key), ": ");
    appendPrettyJson(object[key] as JsonValue, depth + 1, state);
  });
  if (!state.limitExceeded) appendPrettyChunks(state, "\n", indentation, "}");
}

/**
 * Formats one already validated JSON value as deterministic, human-readable JSON.
 *
 * @remarks Object members use canonical UTF-16 key order and arrays retain their semantic order.
 * Two-space formatting is preferred; when indentation alone would exceed the Publisher text
 * profile, the function falls back to canonical compact JSON so an admitted current value remains
 * editable. The returned text has no trailing newline and round-trips through
 * `parseStructuredJsonText` when the value contains no protocol-reserved `$` member names.
 */
export function formatStructuredJson(value: JsonValue): string {
  const state: PrettyJsonState = { chunks: [], codeUnits: 0, limitExceeded: false };
  appendPrettyJson(value, 0, state);
  if (state.limitExceeded) return canonicalizeJson(value);
  const formatted = state.chunks.join("");
  return measureUtf8Bytes(formatted) === "limit-exceeded" ? canonicalizeJson(value) : formatted;
}
