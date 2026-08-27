interface LocalSourceJsonLimits {
  readonly maxDecodedStringCodeUnits: number;
  readonly maxDepth: number;
  readonly maxNumberTokenCodeUnits: number;
  readonly maxValueOccurrences: number;
}

interface ScanState {
  readonly limits: LocalSourceJsonLimits;
  readonly text: string;
  decodedStringCodeUnits: number;
  index: number;
  valueOccurrences: number;
}

interface ScannedString {
  readonly valid: boolean;
  readonly value: string;
}

const NUMBER_PATTERN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/u;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

const LOCAL_SOURCE_JSON_LIMITS: Readonly<LocalSourceJsonLimits> = Object.freeze({
  maxDecodedStringCodeUnits: 4_194_304,
  maxDepth: 256,
  maxNumberTokenCodeUnits: 1_024,
  maxValueOccurrences: 262_144,
});

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
        return { valid: false, value: "" };
      }
      if (typeof value !== "string" || !hasUnicodeScalarSequence(value)) {
        return { valid: false, value: "" };
      }
      state.decodedStringCodeUnits += value.length;
      return {
        valid: state.decodedStringCodeUnits <= state.limits.maxDecodedStringCodeUnits,
        value,
      };
    }
    if (character === "\\") {
      state.index += 1;
      if (state.text[state.index] === "u") state.index += 4;
    }
    state.index += 1;
  }
  return { valid: false, value: "" };
}

function scanNumber(state: ScanState): boolean {
  const start = state.index;
  while (state.index < state.text.length) {
    const character = state.text[state.index];
    if (isWhitespace(character) || character === "," || character === "]" || character === "}") {
      break;
    }
    state.index += 1;
    if (state.index - start > state.limits.maxNumberTokenCodeUnits) return false;
  }
  const token = state.text.slice(start, state.index);
  return NUMBER_PATTERN.test(token) && Number.isFinite(Number(token));
}

function scanLiteral(state: ScanState, literal: "false" | "null" | "true"): boolean {
  if (state.text.slice(state.index, state.index + literal.length) !== literal) return false;
  state.index += literal.length;
  return true;
}

function scanArray(state: ScanState, depth: number): boolean {
  if (depth > state.limits.maxDepth) return false;
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "]") {
    state.index += 1;
    return true;
  }
  while (state.index < state.text.length) {
    if (!scanValue(state, depth)) return false;
    skipWhitespace(state);
    if (state.text[state.index] === "]") {
      state.index += 1;
      return true;
    }
    if (state.text[state.index] !== ",") return false;
    state.index += 1;
    skipWhitespace(state);
  }
  return false;
}

function scanObject(state: ScanState, depth: number): boolean {
  if (depth > state.limits.maxDepth) return false;
  state.index += 1;
  skipWhitespace(state);
  if (state.text[state.index] === "}") {
    state.index += 1;
    return true;
  }
  const keys = new Set<string>();
  while (state.index < state.text.length) {
    if (state.text[state.index] !== '"') return false;
    const key = scanString(state);
    if (!key.valid || keys.has(key.value)) return false;
    keys.add(key.value);
    skipWhitespace(state);
    if (state.text[state.index] !== ":") return false;
    state.index += 1;
    skipWhitespace(state);
    if (!scanValue(state, depth)) return false;
    skipWhitespace(state);
    if (state.text[state.index] === "}") {
      state.index += 1;
      return true;
    }
    if (state.text[state.index] !== ",") return false;
    state.index += 1;
    skipWhitespace(state);
  }
  return false;
}

function scanValue(state: ScanState, parentDepth: number): boolean {
  state.valueOccurrences += 1;
  if (state.valueOccurrences > state.limits.maxValueOccurrences) return false;
  skipWhitespace(state);
  const character = state.text[state.index];
  if (character === "{") return scanObject(state, parentDepth + 1);
  if (character === "[") return scanArray(state, parentDepth + 1);
  if (character === '"') return scanString(state).valid;
  if (character === "t") return scanLiteral(state, "true");
  if (character === "f") return scanLiteral(state, "false");
  if (character === "n") return scanLiteral(state, "null");
  if (character === "-" || (character !== undefined && character >= "0" && character <= "9")) {
    return scanNumber(state);
  }
  return false;
}

function scanJson(text: string, limits: LocalSourceJsonLimits): boolean {
  const state: ScanState = {
    limits,
    text,
    decodedStringCodeUnits: 0,
    index: 0,
    valueOccurrences: 0,
  };
  skipWhitespace(state);
  if (!scanValue(state, 0)) return false;
  skipWhitespace(state);
  return state.index === text.length;
}

function hasLeadingBom(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

/** Parses exact Source response bytes under the M07-T05 strict interoperable-JSON profile. */
export function parseLocalSourceJsonBytes(bytes: Uint8Array): unknown | undefined {
  if (hasLeadingBom(bytes)) return undefined;
  let text: string;
  try {
    text = UTF8_DECODER.decode(bytes);
  } catch {
    return undefined;
  }
  if (!scanJson(text, LOCAL_SOURCE_JSON_LIMITS)) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
