import { createJsonPointer } from "@desen/protocol";

import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import { INVALID_SOURCE_JSON_CODE, SOURCE_LIMIT_EXCEEDED_CODE } from "./publish-result.js";

import type { DesenDiagnostic, JsonPointer, JsonPointerSegment } from "@desen/protocol";
import type { PublishErrorDiagnostic, PublishFailure } from "./publish-result.js";

/** JSON values accepted at the raw, pre-schema publication boundary. */
export type PublishJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly PublishJsonValue[]
  | { readonly [key: string]: PublishJsonValue };

/** Finite project profile applied before a Source reaches value-based validation or hashing. */
export interface PublishSourceJsonLimits {
  /** Maximum UTF-8 bytes in the raw Source text. */
  readonly maxSourceUtf8Bytes: number;
  /** Maximum object/array nesting depth in the raw JSON value. */
  readonly maxJsonDepth: number;
  /** Maximum total JSON value occurrences, excluding object member-name tokens. */
  readonly maxJsonValueOccurrences: number;
  /** Maximum aggregate decoded UTF-16 code units across keys and string values. */
  readonly maxDecodedStringCodeUnits: number;
  /** Maximum code units in one raw JSON number token before numeric conversion. */
  readonly maxNumberTokenCodeUnits: number;
}

/**
 * Frozen finite parser profile for the local DESEN 0.1.0 Publisher.
 *
 * @remarks The 8 MiB Source-text ceiling is four times the Reference Profile's 2 MiB final-Bundle
 * ceiling, leaving bounded room for authoring and discovery data removed during publication.
 * These limits are project-owned and are not universal DESEN protocol constants.
 */
export const PUBLISH_SOURCE_JSON_LIMITS: Readonly<PublishSourceJsonLimits> = Object.freeze({
  maxSourceUtf8Bytes: 8_388_608,
  maxJsonDepth: 256,
  maxJsonValueOccurrences: 262_144,
  maxDecodedStringCodeUnits: 4_194_304,
  maxNumberTokenCodeUnits: 1_024,
});

interface SourceJsonParseSuccess {
  readonly ok: true;
  readonly value: PublishJsonValue;
  readonly diagnostics: readonly [];
}

type SourceJsonParseFailure = PublishFailure & { readonly stage: "json-parse" };

/** Package-private result of the raw Source JSON stage. */
export type SourceJsonParseResult = SourceJsonParseSuccess | SourceJsonParseFailure;

interface ScanPath {
  readonly parent?: ScanPath;
  readonly segment?: JsonPointerSegment;
}

type ScanIssue =
  | Readonly<{ kind: "invalid"; path: ScanPath }>
  | Readonly<{ kind: "duplicate"; path: ScanPath }>
  | Readonly<{ kind: "limit"; path: ScanPath }>;

interface ScanState {
  readonly text: string;
  readonly limits: Readonly<PublishSourceJsonLimits>;
  index: number;
  valueOccurrences: number;
  decodedStringCodeUnits: number;
}

interface ScannedString {
  readonly value: string;
  readonly issue?: ScanIssue;
}

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const ROOT_PATH = Object.freeze({}) as ScanPath;
const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

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

function measureSourceUtf8Bytes(
  value: string,
  maximum: number,
): "valid" | "invalid-unicode" | "limit" {
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
    if (bytes > maximum) return "limit";
  }
  return "valid";
}

function normalizedLimits(input: unknown): Readonly<PublishSourceJsonLimits> | undefined {
  const keys = [
    "maxSourceUtf8Bytes",
    "maxJsonDepth",
    "maxJsonValueOccurrences",
    "maxDecodedStringCodeUnits",
    "maxNumberTokenCodeUnits",
  ] as const;
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    const snapshot: Partial<Record<(typeof keys)[number], number>> = {};
    if (
      Reflect.ownKeys(input).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(input, key))
    ) {
      return undefined;
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        !Number.isSafeInteger(descriptor.value) ||
        descriptor.value < 0
      ) {
        return undefined;
      }
      snapshot[key] = descriptor.value as number;
    }
    return Object.freeze(snapshot) as Readonly<PublishSourceJsonLimits>;
  } catch {
    return undefined;
  }
}

function childPath(parent: ScanPath, segment: JsonPointerSegment): ScanPath {
  return { parent, segment };
}

function pointerForPath(path: ScanPath): JsonPointer {
  const segments: JsonPointerSegment[] = [];
  let current: ScanPath | undefined = path;
  while (current?.parent !== undefined) {
    segments.push(current.segment as JsonPointerSegment);
    current = current.parent;
  }
  segments.reverse();
  return createJsonPointer(segments);
}

function scanString(state: ScanState, path: ScanPath): ScannedString {
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

function scanNumber(state: ScanState, path: ScanPath): ScanIssue | undefined {
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
  if (!NUMBER_PATTERN.test(token) || !Number.isFinite(Number(token))) {
    return { kind: "invalid", path };
  }
  return undefined;
}

function scanLiteral(
  state: ScanState,
  literal: "false" | "null" | "true",
  path: ScanPath,
): ScanIssue | undefined {
  if (state.text.slice(state.index, state.index + literal.length) !== literal) {
    return { kind: "invalid", path };
  }
  state.index += literal.length;
  return undefined;
}

function scanArray(state: ScanState, path: ScanPath, depth: number): ScanIssue | undefined {
  if (depth > state.limits.maxJsonDepth) return { kind: "limit", path };
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

function scanObject(state: ScanState, path: ScanPath, depth: number): ScanIssue | undefined {
  if (depth > state.limits.maxJsonDepth) return { kind: "limit", path };
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

function scanValue(state: ScanState, path: ScanPath, parentDepth: number): ScanIssue | undefined {
  state.valueOccurrences += 1;
  if (state.valueOccurrences > state.limits.maxJsonValueOccurrences) {
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

function scanSourceJson(
  text: string,
  limits: Readonly<PublishSourceJsonLimits>,
): ScanIssue | undefined {
  const utf8 = measureSourceUtf8Bytes(text, limits.maxSourceUtf8Bytes);
  if (utf8 === "limit") return { kind: "limit", path: ROOT_PATH };
  if (utf8 === "invalid-unicode") return { kind: "invalid", path: ROOT_PATH };

  const state: ScanState = {
    text,
    limits,
    index: 0,
    valueOccurrences: 0,
    decodedStringCodeUnits: 0,
  };
  skipWhitespace(state);
  const issue = scanValue(state, ROOT_PATH, 0);
  if (issue !== undefined) return issue;
  skipWhitespace(state);
  return state.index === text.length ? undefined : { kind: "invalid", path: ROOT_PATH };
}

function deepFreezeJson(value: PublishJsonValue): PublishJsonValue {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreezeJson(item));
  } else {
    Object.keys(value).forEach((key) =>
      deepFreezeJson((value as Record<string, PublishJsonValue>)[key] as PublishJsonValue),
    );
  }
  return Object.freeze(value);
}

function publisherDiagnostic(
  code: typeof INVALID_SOURCE_JSON_CODE | typeof SOURCE_LIMIT_EXCEEDED_CODE,
  message: string,
  pointer: JsonPointer,
): PublishErrorDiagnostic {
  const diagnostic = Object.freeze({
    code,
    message,
    pointer,
  }) satisfies Readonly<DesenDiagnostic<typeof code>>;
  return annotatePublishErrorDiagnostic(diagnostic, "json-parse");
}

function parseFailure(issue: ScanIssue): SourceJsonParseFailure {
  const pointer = pointerForPath(issue.path);
  const diagnostic =
    issue.kind === "limit"
      ? publisherDiagnostic(
          SOURCE_LIMIT_EXCEEDED_CODE,
          "Source JSON exceeded the finite publication parsing profile.",
          pointer,
        )
      : publisherDiagnostic(
          INVALID_SOURCE_JSON_CODE,
          issue.kind === "duplicate"
            ? "Source JSON contains a duplicate decoded object member name."
            : "Source input is not interoperable JSON.",
          pointer,
        );
  return createPublishFailure([diagnostic]) as SourceJsonParseFailure;
}

function malformedSourceFailure(): SourceJsonParseFailure {
  return parseFailure({ kind: "invalid", path: ROOT_PATH });
}

/**
 * Parses one raw Source JSON string into a detached, recursively frozen pre-schema value.
 *
 * @internal This is the package-private first publication stage, not a public partial-publication
 * API. It rejects malformed or non-I-JSON input, duplicate decoded member names, and finite-budget
 * exhaustion with a stable diagnostic and never exposes a partial value or Bundle.
 */
export function parseSourceJson(
  input: unknown,
  limits: unknown = PUBLISH_SOURCE_JSON_LIMITS,
): SourceJsonParseResult {
  const profile = normalizedLimits(limits);
  if (profile === undefined) return parseFailure({ kind: "limit", path: ROOT_PATH });
  if (typeof input !== "string") return malformedSourceFailure();
  const issue = scanSourceJson(input, profile);
  if (issue !== undefined) return parseFailure(issue);

  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    return malformedSourceFailure();
  }
  return Object.freeze({
    ok: true,
    value: deepFreezeJson(parsed as PublishJsonValue),
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
