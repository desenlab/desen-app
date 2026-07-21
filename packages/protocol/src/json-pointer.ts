const JSON_POINTER_ROOT = "";

declare const jsonPointerBrand: unique symbol;

/**
 * An RFC 6901 JSON Pointer in its JSON string representation.
 *
 * @remarks The empty string addresses the document root. URI-fragment pointers such as `#/entry`
 * are deliberately not included in this type. Values are created by {@link createJsonPointer} or
 * narrowed by {@link isJsonPointer}; the brand has no serialized runtime representation.
 */
export type JsonPointer = string & { readonly [jsonPointerBrand]: "JsonPointer" };

/**
 * One unescaped path component accepted by {@link createJsonPointer} and
 * {@link appendJsonPointer}.
 *
 * @remarks Strings remain exact Unicode strings and are never normalized. Numbers are a
 * convenience for non-negative, safe integer array indexes and are serialized as decimal tokens.
 */
export type JsonPointerSegment = string | number;

function pointerFailure(message: string): never {
  throw new TypeError(`Invalid JSON Pointer: ${message}`);
}

function ownDataValue(object: object, key: PropertyKey, label: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    pointerFailure(`${label} could not be read safely`);
  }
  if (descriptor === undefined) pointerFailure(`${label} is missing`);
  if (!("value" in descriptor)) pointerFailure(`${label} must be an own data property`);
  return descriptor.value;
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
        pointerFailure(`${label} contains an unpaired high surrogate`);
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      pointerFailure(`${label} contains an unpaired low surrogate`);
    }
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") pointerFailure(`${label} must be a string`);
  assertWellFormedUnicode(value, label);
}

function segmentText(segment: JsonPointerSegment): string {
  if (typeof segment === "string") {
    assertWellFormedUnicode(segment, "a segment");
    return segment;
  }
  if (!Number.isSafeInteger(segment) || segment < 0) {
    pointerFailure("a numeric segment must be a non-negative safe integer");
  }
  return String(segment);
}

function decodeToken(token: string): string {
  let decoded = "";
  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (character !== "~") {
      decoded += character;
      continue;
    }

    const escape = token[index + 1];
    if (escape === "0") decoded += "~";
    else if (escape === "1") decoded += "/";
    else pointerFailure("a `~` escape must be followed by `0` or `1`");
    index += 1;
  }
  return decoded;
}

function parsePointer(pointer: string): readonly string[] {
  assertWellFormedUnicode(pointer, "the pointer");
  if (pointer === JSON_POINTER_ROOT) return Object.freeze([]);
  if (!pointer.startsWith("/")) {
    pointerFailure("a non-root pointer must begin with `/`");
  }

  return Object.freeze(pointer.slice(1).split("/").map(decodeToken));
}

/**
 * Escapes one unencoded reference token using RFC 6901's `~0` and `~1` substitutions.
 *
 * @remarks Escaping is deterministic, performs no Unicode normalization, and does not apply JSON
 * string or percent encoding. The returned token is suitable for insertion after a `/` separator.
 *
 * @throws TypeError when `token` is not a well-formed Unicode string.
 */
export function escapeJsonPointerToken(token: string): string {
  assertString(token, "the token");
  // Tilde must be escaped first so the escape marker introduced for slash remains untouched.
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

/**
 * Decodes one RFC 6901 reference token.
 *
 * @remarks The operation reverses only JSON Pointer token escaping. In particular, `%` sequences
 * and JSON backslash escapes are preserved. The exact `~01` input decodes to `~1`, not `/`.
 *
 * @throws TypeError when `token` is not a well-formed encoded token or contains `/`.
 */
export function unescapeJsonPointerToken(token: string): string {
  assertString(token, "the token");
  if (token.includes("/")) pointerFailure("an encoded token cannot contain `/`");
  return decodeToken(token);
}

/**
 * Creates an RFC 6901 JSON Pointer from unescaped path segments.
 *
 * @remarks An empty segment list returns the root pointer `""`. Empty string segments are valid,
 * so `createJsonPointer([""])` returns `"/"`. The function is pure and never changes the input.
 *
 * @throws TypeError when the input is not a dense data-only array, a string segment contains
 * invalid Unicode, or a numeric segment is not a non-negative safe integer. Array accessors are
 * rejected without being invoked.
 */
export function createJsonPointer(segments: readonly JsonPointerSegment[] = []): JsonPointer {
  if (!Array.isArray(segments)) pointerFailure("segments must be an array");

  const length = ownDataValue(segments, "length", "segments length");
  if (!Number.isSafeInteger(length) || (length as number) < 0) {
    pointerFailure("segments length must be a non-negative safe integer");
  }
  if (length === 0) return JSON_POINTER_ROOT as JsonPointer;

  const encoded: string[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    const segment = ownDataValue(segments, String(index), `segment ${index}`);
    encoded.push(escapeJsonPointerToken(segmentText(segment as JsonPointerSegment)));
  }
  return `/${encoded.join("/")}` as JsonPointer;
}

/**
 * Parses an RFC 6901 JSON Pointer into exact, unescaped string tokens.
 *
 * @remarks Numeric-looking tokens remain strings because array-index interpretation requires a
 * target document and belongs to pointer resolution. The returned array is frozen. URI fragments
 * such as `#/entry` are not accepted.
 *
 * @throws TypeError when `pointer` is not a valid JSON Pointer string representation.
 */
export function parseJsonPointer(pointer: string): readonly string[] {
  assertString(pointer, "the pointer");
  return parsePointer(pointer);
}

/**
 * Appends one unescaped segment to an existing RFC 6901 JSON Pointer.
 *
 * @remarks Root is handled without a truthiness shortcut, preserving the distinction between an
 * unavailable pointer and the known root pointer `""`. The function is pure.
 *
 * @throws TypeError when `pointer` is invalid or `segment` cannot be encoded.
 */
export function appendJsonPointer(pointer: JsonPointer, segment: JsonPointerSegment): JsonPointer {
  assertString(pointer, "the pointer");
  parsePointer(pointer);
  return `${pointer}/${escapeJsonPointerToken(segmentText(segment))}` as JsonPointer;
}

/**
 * Tests whether an unknown value is an RFC 6901 JSON Pointer string representation.
 *
 * @remarks This guard accepts both the root `""` and syntax-only tokens such as `"/01"` or
 * `"/-"`; document-specific array-index rules are outside this operation. It never throws.
 */
export function isJsonPointer(value: unknown): value is JsonPointer {
  if (typeof value !== "string") return false;
  try {
    parsePointer(value);
    return true;
  } catch {
    return false;
  }
}
