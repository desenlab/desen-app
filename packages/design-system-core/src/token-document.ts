import {
  DESIGN_TOKEN_PROFILE,
  type AdmittedDtcgToken,
  type DtcgBorderValue,
  type DtcgColorValue,
  type DtcgCubicBezierValue,
  type DtcgDiagnostic,
  type DtcgDiagnosticCode,
  type DtcgDimensionValue,
  type DtcgDurationValue,
  type DtcgFailureClassification,
  type DtcgFontFamilyValue,
  type DtcgFontWeightValue,
  type DtcgJsonObject,
  type DtcgJsonValue,
  type DtcgNamedStrokeStyle,
  type DtcgNodeMetadata,
  type DtcgShadowLayerValue,
  type DtcgShadowValue,
  type DtcgTokenAlias,
  type DtcgTokenLiteral,
  type DtcgTokenType,
  type DtcgTokenValue,
  type DtcgTransitionValue,
  type DtcgTypographyValue,
} from "./token-types.js";

const WHOLE_TOKEN_ALIAS = /^\{([^{}.]+(?:\.[^{}.]+)*)\}$/u;
const SOURCE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const TOKEN_TYPES = new Set<DtcgTokenType>(DESIGN_TOKEN_PROFILE.tokenTypes);
const NAMED_FONT_WEIGHTS = new Set<DtcgFontWeightValue>([
  "black",
  "bold",
  "book",
  "demi-bold",
  "extra-black",
  "extra-bold",
  "extra-light",
  "hairline",
  "heavy",
  "light",
  "medium",
  "normal",
  "regular",
  "semi-bold",
  "thin",
  "ultra-black",
  "ultra-bold",
  "ultra-light",
]);
const NAMED_STROKE_STYLES = new Set<DtcgNamedStrokeStyle>([
  "dashed",
  "dotted",
  "double",
  "groove",
  "inset",
  "outset",
  "ridge",
  "solid",
]);
const METADATA_KEYS = new Set(["$deprecated", "$description", "$extensions"]);
const MAX_GENERAL_NUMBER = 1_000_000_000;
const MAX_DIMENSION = 1_000_000;
const MAX_DURATION = 86_400_000;

/** A safely captured, recursively immutable DTCG document snapshot. */
export type DtcgTokenDocument = DtcgJsonObject;

/** Successful admission of one bounded DTCG token document. */
export interface DtcgTokenDocumentAdmissionSuccess {
  readonly document: DtcgTokenDocument;
  readonly ok: true;
  readonly tokenPaths: readonly string[];
  readonly tokens: Readonly<Record<string, AdmittedDtcgToken>>;
}

/** Rejection of unsafe, invalid, or unsupported DTCG input. */
export interface DtcgTokenDocumentAdmissionFailure {
  readonly diagnostics: readonly [DtcgDiagnostic];
  readonly ok: false;
  readonly snapshot?: DtcgTokenDocument;
}

/** Result of bounded DTCG document admission. */
export type DtcgTokenDocumentAdmissionResult =
  DtcgTokenDocumentAdmissionFailure | DtcgTokenDocumentAdmissionSuccess;

interface JsonCaptureState {
  readonly active: Set<object>;
  characters: number;
  nodes: number;
}

interface AliasTypeInferenceState {
  steps: number;
}

interface DiagnosticContext {
  readonly pointer: string;
  readonly sourceId?: string | undefined;
  readonly tokenPath?: string | undefined;
}

/** @internal One structurally and literally validated token awaiting alias-graph closure. */
export interface CollectedDtcgToken {
  readonly declaredType: DtcgTokenType | undefined;
  readonly metadata: DtcgNodeMetadata;
  readonly path: string;
  readonly pointer: string;
  readonly value: DtcgTokenValue;
}

/** @internal A safe document whose complete token inventory awaits alias-graph closure. */
export interface CollectedDtcgTokenDocument {
  readonly document: DtcgTokenDocument;
  readonly ok: true;
  readonly tokenPaths: readonly string[];
  readonly tokens: Readonly<Record<string, CollectedDtcgToken>>;
}

/** @internal Result used to defer only alias closure until a selected-source overlay exists. */
export type DtcgTokenDocumentCollectionResult =
  CollectedDtcgTokenDocument | DtcgTokenDocumentAdmissionFailure;

class DtcgBoundaryError extends Error {
  readonly diagnostic: DtcgDiagnostic;

  constructor(diagnostic: DtcgDiagnostic) {
    super(diagnostic.message);
    this.name = "DtcgBoundaryError";
    this.diagnostic = diagnostic;
  }
}

function sortedKeys(value: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendPointer(pointer: string, segment: string): string {
  return `${pointer}/${escapePointerSegment(segment)}`;
}

function isRecord(value: DtcgJsonValue): value is DtcgJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function diagnostic(
  classification: DtcgFailureClassification,
  code: DtcgDiagnosticCode,
  message: string,
  context: DiagnosticContext,
): DtcgDiagnostic {
  const output: {
    classification: DtcgFailureClassification;
    code: DtcgDiagnosticCode;
    message: string;
    pointer: string;
    sourceId?: string;
    tokenPath?: string;
  } = { classification, code, message, pointer: context.pointer };
  if (context.sourceId !== undefined) output.sourceId = context.sourceId;
  if (context.tokenPath !== undefined) output.tokenPath = context.tokenPath;
  return deepFreeze(output);
}

function fail(
  classification: DtcgFailureClassification,
  code: DtcgDiagnosticCode,
  message: string,
  context: DiagnosticContext,
): never {
  throw new DtcgBoundaryError(diagnostic(classification, code, message, context));
}

function limit(condition: boolean, message: string, context: DiagnosticContext): asserts condition {
  if (!condition) fail("INVALID_DTCG", "LIMIT_EXCEEDED", message, context);
}

function exactKeys(value: DtcgJsonObject, expected: readonly string[]): boolean {
  const actual = sortedKeys(value);
  const wanted = [...expected].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function requiredMember(
  value: DtcgJsonObject,
  key: string,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): DtcgJsonValue {
  const member = value[key];
  if (member === undefined) {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", `Missing required member ${JSON.stringify(key)}.`, {
      pointer: appendPointer(pointer, key),
      sourceId,
      tokenPath,
    });
  }
  return member;
}

function captureJson(
  input: unknown,
  pointer: string,
  state: JsonCaptureState,
  depth: number,
  sourceId: string | undefined,
): DtcgJsonValue {
  state.nodes += 1;
  limit(
    state.nodes <= DESIGN_TOKEN_PROFILE.limits.maxJsonNodes,
    `DTCG input exceeds ${DESIGN_TOKEN_PROFILE.limits.maxJsonNodes} JSON nodes.`,
    { pointer, sourceId },
  );
  limit(
    depth <= DESIGN_TOKEN_PROFILE.limits.maxJsonDepth,
    `DTCG input exceeds JSON depth ${DESIGN_TOKEN_PROFILE.limits.maxJsonDepth}.`,
    { pointer, sourceId },
  );

  if (input === null || typeof input === "boolean") return input;
  if (typeof input === "string") {
    limit(
      input.length <= DESIGN_TOKEN_PROFILE.limits.maxStringLength,
      `DTCG string exceeds ${DESIGN_TOKEN_PROFILE.limits.maxStringLength} characters.`,
      { pointer, sourceId },
    );
    state.characters += input.length + 2;
    limit(
      state.characters <= DESIGN_TOKEN_PROFILE.limits.maxDocumentCharacters,
      "DTCG input exceeds the bounded document size.",
      { pointer, sourceId },
    );
    return input;
  }
  if (typeof input === "number") {
    if (
      !Number.isFinite(input) ||
      !Number.isSafeInteger(Math.trunc(input)) ||
      Object.is(input, -0)
    ) {
      fail(
        "INVALID_DTCG",
        "UNSAFE_DTCG_VALUE",
        "DTCG numbers must be finite, non-negative-zero values with a safe integer component.",
        { pointer, sourceId },
      );
    }
    state.characters += String(input).length;
    return input;
  }
  if (typeof input !== "object") {
    fail("INVALID_DTCG", "UNSAFE_DTCG_VALUE", "DTCG input must contain JSON data only.", {
      pointer,
      sourceId,
    });
  }
  if (state.active.has(input)) {
    fail("INVALID_DTCG", "UNSAFE_DTCG_VALUE", "DTCG input cannot contain a cycle.", {
      pointer,
      sourceId,
    });
  }

  let isArray: boolean;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    isArray = Array.isArray(input);
    prototype = Object.getPrototypeOf(input);
    keys = Reflect.ownKeys(input);
    descriptors = Object.getOwnPropertyDescriptors(input);
  } catch {
    fail(
      "INVALID_DTCG",
      "UNSAFE_DTCG_VALUE",
      "DTCG input could not be inspected without invoking caller behavior.",
      { pointer, sourceId },
    );
  }
  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    fail("INVALID_DTCG", "UNSAFE_DTCG_VALUE", "DTCG objects must use a plain or null prototype.", {
      pointer,
      sourceId,
    });
  }
  if (keys.some((key) => typeof key !== "string")) {
    fail("INVALID_DTCG", "UNSAFE_DTCG_VALUE", "DTCG input cannot contain symbol keys.", {
      pointer,
      sourceId,
    });
  }

  state.active.add(input);
  try {
    if (isArray) {
      const lengthDescriptor = descriptors.length;
      if (
        lengthDescriptor === undefined ||
        lengthDescriptor.enumerable ||
        !Object.hasOwn(lengthDescriptor, "value") ||
        typeof lengthDescriptor.value !== "number"
      ) {
        fail(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "DTCG arrays must expose an ordinary own length data property.",
          { pointer, sourceId },
        );
      }
      const length = lengthDescriptor.value;
      limit(
        length <= DESIGN_TOKEN_PROFILE.limits.maxArrayItems,
        `DTCG arrays cannot exceed ${DESIGN_TOKEN_PROFILE.limits.maxArrayItems} items.`,
        { pointer, sourceId },
      );
      if (
        keys.length !== length + 1 ||
        keys.some(
          (key, index) =>
            typeof key !== "string" || (index < length ? key !== String(index) : key !== "length"),
        )
      ) {
        fail(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "DTCG arrays must be dense and contain no custom properties.",
          { pointer, sourceId },
        );
      }
      const output: DtcgJsonValue[] = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !Object.hasOwn(descriptor, "value")
        ) {
          fail(
            "INVALID_DTCG",
            "UNSAFE_DTCG_VALUE",
            "DTCG arrays must contain enumerable own data values.",
            { pointer: appendPointer(pointer, key), sourceId },
          );
        }
        output.push(
          captureJson(descriptor.value, appendPointer(pointer, key), state, depth + 1, sourceId),
        );
      }
      return output;
    }

    const output = Object.create(null) as Record<string, DtcgJsonValue>;
    const stringKeys = keys as readonly string[];
    for (const key of [...stringKeys].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    )) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, "value")
      ) {
        fail(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "DTCG objects must contain enumerable own data values only.",
          { pointer: appendPointer(pointer, key), sourceId },
        );
      }
      state.characters += key.length + 3;
      limit(
        state.characters <= DESIGN_TOKEN_PROFILE.limits.maxDocumentCharacters,
        "DTCG input exceeds the bounded document size.",
        { pointer, sourceId },
      );
      output[key] = captureJson(
        descriptor.value,
        appendPointer(pointer, key),
        state,
        depth + 1,
        sourceId,
      );
    }
    return output;
  } finally {
    state.active.delete(input);
  }
}

function captureDocument(input: unknown, sourceId: string | undefined): DtcgTokenDocument {
  const captured = captureJson(
    input,
    "",
    { active: new Set<object>(), characters: 0, nodes: 0 },
    0,
    sourceId,
  );
  if (!isRecord(captured)) {
    fail("INVALID_DTCG", "INVALID_DTCG_DOCUMENT", "A DTCG token document must be a JSON object.", {
      pointer: "",
      sourceId,
    });
  }
  const serialized = JSON.stringify(captured);
  limit(
    serialized.length <= DESIGN_TOKEN_PROFILE.limits.maxDocumentCharacters,
    "DTCG input exceeds the bounded document size.",
    { pointer: "", sourceId },
  );
  return deepFreeze(captured);
}

function assertMetadata(
  node: DtcgJsonObject,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string | undefined,
): DtcgNodeMetadata {
  const description = node.$description;
  if (description !== undefined && typeof description !== "string") {
    fail("INVALID_DTCG", "INVALID_DTCG_METADATA", "$description must be a string.", {
      pointer: appendPointer(pointer, "$description"),
      sourceId,
      tokenPath,
    });
  }
  const deprecated = node.$deprecated;
  if (
    deprecated !== undefined &&
    typeof deprecated !== "boolean" &&
    typeof deprecated !== "string"
  ) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_METADATA",
      "$deprecated must be a boolean or explanatory string.",
      { pointer: appendPointer(pointer, "$deprecated"), sourceId, tokenPath },
    );
  }
  const extensions = node.$extensions;
  if (extensions !== undefined && !isRecord(extensions)) {
    fail("INVALID_DTCG", "INVALID_DTCG_METADATA", "$extensions must be a JSON object.", {
      pointer: appendPointer(pointer, "$extensions"),
      sourceId,
      tokenPath,
    });
  }

  const metadata: {
    $deprecated?: boolean | string;
    $description?: string;
    $extensions?: DtcgJsonObject;
  } = {};
  if (deprecated !== undefined) metadata.$deprecated = deprecated;
  if (description !== undefined) metadata.$description = description;
  if (extensions !== undefined && isRecord(extensions)) metadata.$extensions = extensions;
  return deepFreeze(metadata);
}

function withInheritedDeprecated(
  metadata: DtcgNodeMetadata,
  inheritedDeprecated: boolean | string | undefined,
): DtcgNodeMetadata {
  if (metadata.$deprecated !== undefined || inheritedDeprecated === undefined) return metadata;
  const effective: {
    $deprecated: boolean | string;
    $description?: string;
    $extensions?: DtcgJsonObject;
  } = { $deprecated: inheritedDeprecated };
  if (metadata.$description !== undefined) effective.$description = metadata.$description;
  if (metadata.$extensions !== undefined) effective.$extensions = metadata.$extensions;
  return deepFreeze(effective);
}

function parseType(
  value: DtcgJsonValue | undefined,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string | undefined,
): DtcgTokenType | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    fail("INVALID_DTCG", "INVALID_DTCG_STRUCTURE", "$type must be a string.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  if (!TOKEN_TYPES.has(value as DtcgTokenType)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_DTCG_TYPE",
      `Token type ${JSON.stringify(value)} is outside the bounded project profile.`,
      { pointer, sourceId, tokenPath },
    );
  }
  return value as DtcgTokenType;
}

function isDtcgTokenName(name: string): boolean {
  const hasControlCharacter = [...name].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
  return name.length > 0 && !name.startsWith("$") && !/[.{}]/u.test(name) && !hasControlCharacter;
}

/** @internal Return whether a path uses the exact name grammar admitted by this module. */
export function isDtcgTokenPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength) {
    return false;
  }
  const segments = value.split(".");
  return (
    segments.length <= DESIGN_TOKEN_PROFILE.limits.maxTokenPathSegments &&
    segments.every((segment) => isDtcgTokenName(segment))
  );
}

function assertTokenName(
  name: string,
  pointer: string,
  sourceId: string | undefined,
  path: readonly string[],
): void {
  const tokenPath = [...path, name].join(".");
  if (
    !isDtcgTokenName(name) ||
    tokenPath.length > DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength ||
    path.length + 1 > DESIGN_TOKEN_PROFILE.limits.maxTokenPathSegments
  ) {
    fail("INVALID_DTCG", "INVALID_DTCG_NAME", `Invalid DTCG name ${JSON.stringify(name)}.`, {
      pointer,
      sourceId,
      tokenPath,
    });
  }
}

function containsPropertyAlias(value: DtcgJsonValue): boolean {
  if (typeof value === "string") return WHOLE_TOKEN_ALIAS.test(value);
  if (value === null || typeof value !== "object") return false;
  return Object.values(value).some((nested) => containsPropertyAlias(nested));
}

function assertNumericRange(
  value: DtcgJsonValue | undefined,
  minimum: number,
  maximum: number,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is number {
  if (typeof value !== "number") {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "Expected a numeric token value.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  if (value < minimum || value > maximum) {
    fail(
      "INVALID_DTCG",
      "LIMIT_EXCEEDED",
      `Numeric token value must be between ${minimum} and ${maximum}.`,
      { pointer, sourceId, tokenPath },
    );
  }
}

function assertColor(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgColorValue {
  if (!isRecord(value)) {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "A color must be an object.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  const expected =
    value.alpha === undefined
      ? ["colorSpace", "components"]
      : ["alpha", "colorSpace", "components"];
  if (!exactKeys(value, expected)) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "A color must contain only colorSpace, components, and optional alpha.",
      { pointer, sourceId, tokenPath },
    );
  }
  if (typeof value.colorSpace !== "string") {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "colorSpace must be a string.", {
      pointer: appendPointer(pointer, "colorSpace"),
      sourceId,
      tokenPath,
    });
  }
  if (value.colorSpace !== "srgb") {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_COLOR_SPACE",
      `Color space ${JSON.stringify(value.colorSpace)} is outside the bounded sRGB profile.`,
      { pointer: appendPointer(pointer, "colorSpace"), sourceId, tokenPath },
    );
  }
  if (!Array.isArray(value.components) || value.components.length !== 3) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "sRGB components must be an array of exactly three numbers.",
      { pointer: appendPointer(pointer, "components"), sourceId, tokenPath },
    );
  }
  for (const [index, component] of value.components.entries()) {
    if (component === "none") {
      fail(
        "UNSUPPORTED_DTCG_FEATURE",
        "UNSUPPORTED_DTCG_MEMBER",
        "The bounded color profile does not resolve missing color components.",
        {
          pointer: appendPointer(appendPointer(pointer, "components"), String(index)),
          sourceId,
          tokenPath,
        },
      );
    }
    assertNumericRange(
      component,
      0,
      1,
      appendPointer(appendPointer(pointer, "components"), String(index)),
      sourceId,
      tokenPath,
    );
  }
  if (value.alpha !== undefined) {
    assertNumericRange(value.alpha, 0, 1, appendPointer(pointer, "alpha"), sourceId, tokenPath);
  }
}

function assertDimension(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
  nonNegative: boolean,
): asserts value is DtcgJsonObject & DtcgDimensionValue {
  if (!isRecord(value) || !exactKeys(value, ["unit", "value"])) {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "A dimension must contain exactly value and unit.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  assertNumericRange(
    value.value,
    nonNegative ? 0 : -MAX_DIMENSION,
    MAX_DIMENSION,
    appendPointer(pointer, "value"),
    sourceId,
    tokenPath,
  );
  if (value.unit !== "px" && value.unit !== "rem") {
    fail(
      typeof value.unit === "string" ? "UNSUPPORTED_DTCG_FEATURE" : "INVALID_DTCG",
      typeof value.unit === "string" ? "UNSUPPORTED_DTCG_MEMBER" : "INVALID_DTCG_VALUE",
      "Dimension unit must be px or rem.",
      { pointer: appendPointer(pointer, "unit"), sourceId, tokenPath },
    );
  }
}

function assertDuration(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgDurationValue {
  if (!isRecord(value) || !exactKeys(value, ["unit", "value"])) {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "A duration must contain exactly value and unit.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  if (value.unit !== "ms" && value.unit !== "s") {
    fail(
      typeof value.unit === "string" ? "UNSUPPORTED_DTCG_FEATURE" : "INVALID_DTCG",
      typeof value.unit === "string" ? "UNSUPPORTED_DTCG_MEMBER" : "INVALID_DTCG_VALUE",
      "Duration unit must be ms or s.",
      { pointer: appendPointer(pointer, "unit"), sourceId, tokenPath },
    );
  }
  assertNumericRange(
    value.value,
    0,
    value.unit === "s" ? MAX_DURATION / 1_000 : MAX_DURATION,
    appendPointer(pointer, "value"),
    sourceId,
    tokenPath,
  );
}

function assertCubicBezier(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgCubicBezierValue {
  if (!Array.isArray(value) || value.length !== 4) {
    fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "A cubicBezier must contain exactly four numbers.", {
      pointer,
      sourceId,
      tokenPath,
    });
  }
  for (const [index, component] of value.entries()) {
    assertNumericRange(
      component,
      index === 0 || index === 2 ? 0 : -100,
      index === 0 || index === 2 ? 1 : 100,
      appendPointer(pointer, String(index)),
      sourceId,
      tokenPath,
    );
  }
}

function assertFontFamily(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgFontFamilyValue {
  const entries = typeof value === "string" ? [value] : value;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 16) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "fontFamily must be a string or an array of one to sixteen strings.",
      { pointer, sourceId, tokenPath },
    );
  }
  for (const [index, entry] of entries.entries()) {
    if (typeof entry !== "string" || entry.trim().length === 0 || entry.length > 256) {
      fail(
        "INVALID_DTCG",
        "INVALID_DTCG_VALUE",
        "Every font family must be a non-empty string of at most 256 characters.",
        {
          pointer: Array.isArray(value) ? appendPointer(pointer, String(index)) : pointer,
          sourceId,
          tokenPath,
        },
      );
    }
  }
}

function assertFontWeight(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgFontWeightValue {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 1 || value > 1_000) {
      fail(
        "INVALID_DTCG",
        "INVALID_DTCG_VALUE",
        "Numeric fontWeight must be an integer between 1 and 1000.",
        { pointer, sourceId, tokenPath },
      );
    }
    return;
  }
  if (typeof value !== "string" || !NAMED_FONT_WEIGHTS.has(value as DtcgFontWeightValue)) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "fontWeight must be a DTCG named weight or an integer between 1 and 1000.",
      { pointer, sourceId, tokenPath },
    );
  }
}

function assertTypography(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgTypographyValue {
  const keys = ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"];
  if (!isRecord(value) || !exactKeys(value, keys)) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      `A typography value must contain exactly ${keys.join(", ")}.`,
      { pointer, sourceId, tokenPath },
    );
  }
  if (containsPropertyAlias(value)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "Only whole-token aliases are supported; composite-property aliases are not resolved.",
      { pointer, sourceId, tokenPath },
    );
  }
  assertFontFamily(
    requiredMember(value, "fontFamily", pointer, sourceId, tokenPath),
    appendPointer(pointer, "fontFamily"),
    sourceId,
    tokenPath,
  );
  assertDimension(
    requiredMember(value, "fontSize", pointer, sourceId, tokenPath),
    appendPointer(pointer, "fontSize"),
    sourceId,
    tokenPath,
    true,
  );
  assertFontWeight(
    requiredMember(value, "fontWeight", pointer, sourceId, tokenPath),
    appendPointer(pointer, "fontWeight"),
    sourceId,
    tokenPath,
  );
  assertDimension(
    requiredMember(value, "letterSpacing", pointer, sourceId, tokenPath),
    appendPointer(pointer, "letterSpacing"),
    sourceId,
    tokenPath,
    false,
  );
  assertNumericRange(
    requiredMember(value, "lineHeight", pointer, sourceId, tokenPath),
    0,
    100,
    appendPointer(pointer, "lineHeight"),
    sourceId,
    tokenPath,
  );
}

function assertBorder(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgBorderValue {
  if (!isRecord(value) || !exactKeys(value, ["color", "style", "width"])) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "A border must contain exactly color, style, and width.",
      { pointer, sourceId, tokenPath },
    );
  }
  if (containsPropertyAlias(value)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "Only whole-token aliases are supported; composite-property aliases are not resolved.",
      { pointer, sourceId, tokenPath },
    );
  }
  assertColor(
    requiredMember(value, "color", pointer, sourceId, tokenPath),
    appendPointer(pointer, "color"),
    sourceId,
    tokenPath,
  );
  assertDimension(
    requiredMember(value, "width", pointer, sourceId, tokenPath),
    appendPointer(pointer, "width"),
    sourceId,
    tokenPath,
    true,
  );
  const style = requiredMember(value, "style", pointer, sourceId, tokenPath);
  if (isRecord(style)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_STROKE_STYLE",
      "Complex strokeStyle values are outside the bounded border profile.",
      { pointer: appendPointer(pointer, "style"), sourceId, tokenPath },
    );
  }
  if (typeof style !== "string" || !NAMED_STROKE_STYLES.has(style as DtcgNamedStrokeStyle)) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "Border style must be a supported named DTCG stroke style.",
      { pointer: appendPointer(pointer, "style"), sourceId, tokenPath },
    );
  }
}

function assertShadowLayer(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgShadowLayerValue {
  const keys = ["blur", "color", "offsetX", "offsetY", "spread"];
  if (!isRecord(value) || !exactKeys(value, keys)) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      `A shadow layer must contain exactly ${keys.join(", ")}.`,
      { pointer, sourceId, tokenPath },
    );
  }
  if (containsPropertyAlias(value)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "Only whole-token aliases are supported; composite-property aliases are not resolved.",
      { pointer, sourceId, tokenPath },
    );
  }
  assertColor(
    requiredMember(value, "color", pointer, sourceId, tokenPath),
    appendPointer(pointer, "color"),
    sourceId,
    tokenPath,
  );
  assertDimension(
    requiredMember(value, "offsetX", pointer, sourceId, tokenPath),
    appendPointer(pointer, "offsetX"),
    sourceId,
    tokenPath,
    false,
  );
  assertDimension(
    requiredMember(value, "offsetY", pointer, sourceId, tokenPath),
    appendPointer(pointer, "offsetY"),
    sourceId,
    tokenPath,
    false,
  );
  assertDimension(
    requiredMember(value, "blur", pointer, sourceId, tokenPath),
    appendPointer(pointer, "blur"),
    sourceId,
    tokenPath,
    true,
  );
  assertDimension(
    requiredMember(value, "spread", pointer, sourceId, tokenPath),
    appendPointer(pointer, "spread"),
    sourceId,
    tokenPath,
    false,
  );
}

function assertShadow(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonValue & DtcgShadowValue {
  if (Array.isArray(value)) {
    if (value.length === 0 || value.length > DESIGN_TOKEN_PROFILE.limits.maxShadowLayers) {
      fail(
        "INVALID_DTCG",
        "LIMIT_EXCEEDED",
        `A shadow must contain one to ${DESIGN_TOKEN_PROFILE.limits.maxShadowLayers} layers.`,
        { pointer, sourceId, tokenPath },
      );
    }
    for (const [index, layer] of value.entries()) {
      assertShadowLayer(layer, appendPointer(pointer, String(index)), sourceId, tokenPath);
    }
    return;
  }
  assertShadowLayer(value, pointer, sourceId, tokenPath);
}

function assertTransition(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonObject & DtcgTransitionValue {
  if (!isRecord(value) || !exactKeys(value, ["delay", "duration", "timingFunction"])) {
    fail(
      "INVALID_DTCG",
      "INVALID_DTCG_VALUE",
      "A transition must contain exactly delay, duration, and timingFunction.",
      { pointer, sourceId, tokenPath },
    );
  }
  if (containsPropertyAlias(value)) {
    fail(
      "UNSUPPORTED_DTCG_FEATURE",
      "UNSUPPORTED_PROPERTY_ALIAS",
      "Only whole-token aliases are supported; composite-property aliases are not resolved.",
      { pointer, sourceId, tokenPath },
    );
  }
  assertDuration(
    requiredMember(value, "delay", pointer, sourceId, tokenPath),
    appendPointer(pointer, "delay"),
    sourceId,
    tokenPath,
  );
  assertDuration(
    requiredMember(value, "duration", pointer, sourceId, tokenPath),
    appendPointer(pointer, "duration"),
    sourceId,
    tokenPath,
  );
  assertCubicBezier(
    requiredMember(value, "timingFunction", pointer, sourceId, tokenPath),
    appendPointer(pointer, "timingFunction"),
    sourceId,
    tokenPath,
  );
}

function assertLiteral(
  type: DtcgTokenType,
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): asserts value is DtcgJsonValue & DtcgTokenLiteral {
  if (type === "color") assertColor(value, pointer, sourceId, tokenPath);
  else if (type === "dimension") assertDimension(value, pointer, sourceId, tokenPath, false);
  else if (type === "number") {
    assertNumericRange(
      value,
      -MAX_GENERAL_NUMBER,
      MAX_GENERAL_NUMBER,
      pointer,
      sourceId,
      tokenPath,
    );
  } else if (type === "typography") assertTypography(value, pointer, sourceId, tokenPath);
  else if (type === "border") assertBorder(value, pointer, sourceId, tokenPath);
  else if (type === "shadow") assertShadow(value, pointer, sourceId, tokenPath);
  else if (type === "duration") assertDuration(value, pointer, sourceId, tokenPath);
  else if (type === "cubicBezier") assertCubicBezier(value, pointer, sourceId, tokenPath);
  else assertTransition(value, pointer, sourceId, tokenPath);
}

function parseTokenAlias(
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): DtcgTokenAlias | undefined {
  if (typeof value === "string") {
    const match = WHOLE_TOKEN_ALIAS.exec(value);
    if (match !== null) return value as DtcgTokenAlias;
    if (value.includes("{") || value.includes("}")) {
      fail(
        "UNSUPPORTED_DTCG_FEATURE",
        "UNSUPPORTED_PROPERTY_ALIAS",
        "Only an entire $value may be a curly-brace token alias.",
        { pointer, sourceId, tokenPath },
      );
    }
  }
  return undefined;
}

function parseTokenValue(
  type: DtcgTokenType,
  value: DtcgJsonValue,
  pointer: string,
  sourceId: string | undefined,
  tokenPath: string,
): DtcgTokenValue {
  const alias = parseTokenAlias(value, pointer, sourceId, tokenPath);
  if (alias !== undefined) return alias;
  assertLiteral(type, value, pointer, sourceId, tokenPath);
  return value;
}

function collectTokens(
  node: DtcgJsonObject,
  path: readonly string[],
  pointer: string,
  inheritedType: DtcgTokenType | undefined,
  inheritedDeprecated: boolean | string | undefined,
  sourceId: string | undefined,
  output: Map<string, CollectedDtcgToken>,
): void {
  const tokenPath = path.join(".");
  const metadata = assertMetadata(node, pointer, sourceId, tokenPath || undefined);
  const ownType = parseType(
    node.$type,
    appendPointer(pointer, "$type"),
    sourceId,
    tokenPath || undefined,
  );
  const effectiveType = ownType ?? inheritedType;
  const reservedKeys = sortedKeys(node).filter((key) => key.startsWith("$"));
  const childKeys = sortedKeys(node).filter((key) => !key.startsWith("$"));

  if (Object.hasOwn(node, "$value")) {
    if (path.length === 0) {
      fail(
        "UNSUPPORTED_DTCG_FEATURE",
        "UNSUPPORTED_DTCG_MEMBER",
        "A root token is outside the project document profile.",
        { pointer, sourceId },
      );
    }
    for (const key of reservedKeys) {
      if (key !== "$type" && key !== "$value" && !METADATA_KEYS.has(key)) {
        fail(
          "UNSUPPORTED_DTCG_FEATURE",
          "UNSUPPORTED_DTCG_MEMBER",
          `Reserved token member ${JSON.stringify(key)} is not resolved by this profile.`,
          { pointer: appendPointer(pointer, key), sourceId, tokenPath },
        );
      }
    }
    if (childKeys.length > 0) {
      fail(
        "INVALID_DTCG",
        "INVALID_DTCG_STRUCTURE",
        "A DTCG token cannot also contain child tokens or groups.",
        { pointer: appendPointer(pointer, childKeys[0] ?? ""), sourceId, tokenPath },
      );
    }
    const rawValue = node.$value;
    if (rawValue === undefined) {
      fail("INVALID_DTCG", "INVALID_DTCG_VALUE", "$value cannot be undefined.", {
        pointer: appendPointer(pointer, "$value"),
        sourceId,
        tokenPath,
      });
    }
    const valuePointer = appendPointer(pointer, "$value");
    const alias = parseTokenAlias(rawValue, valuePointer, sourceId, tokenPath);
    let declaredType: DtcgTokenType | undefined;
    let value: DtcgTokenValue;
    if (alias === undefined) {
      if (effectiveType === undefined) {
        fail(
          "INVALID_DTCG",
          "MISSING_DTCG_TYPE",
          "A literal token must declare or inherit a supported $type.",
          { pointer, sourceId, tokenPath },
        );
      }
      declaredType = effectiveType;
      value = parseTokenValue(effectiveType, rawValue, valuePointer, sourceId, tokenPath);
    } else {
      declaredType = ownType;
      value = alias;
    }
    output.set(
      tokenPath,
      deepFreeze({
        declaredType,
        metadata: withInheritedDeprecated(metadata, inheritedDeprecated),
        path: tokenPath,
        pointer,
        value,
      }),
    );
    limit(
      output.size <= DESIGN_TOKEN_PROFILE.limits.maxTokenCount,
      `A DTCG document cannot exceed ${DESIGN_TOKEN_PROFILE.limits.maxTokenCount} tokens.`,
      { pointer, sourceId, tokenPath },
    );
    return;
  }

  for (const key of reservedKeys) {
    if (key !== "$type" && !METADATA_KEYS.has(key)) {
      fail(
        "UNSUPPORTED_DTCG_FEATURE",
        "UNSUPPORTED_DTCG_MEMBER",
        `Reserved group member ${JSON.stringify(key)} is not resolved by this profile.`,
        { pointer: appendPointer(pointer, key), sourceId, tokenPath: tokenPath || undefined },
      );
    }
  }
  if (childKeys.length === 0) {
    fail("INVALID_DTCG", "EMPTY_DTCG_GROUP", "A DTCG group must contain a token or child group.", {
      pointer,
      sourceId,
      tokenPath: tokenPath || undefined,
    });
  }
  const effectiveDeprecated = metadata.$deprecated ?? inheritedDeprecated;
  for (const key of childKeys) {
    const childPointer = appendPointer(pointer, key);
    assertTokenName(key, childPointer, sourceId, path);
    const child = node[key];
    if (child === undefined || !isRecord(child)) {
      fail("INVALID_DTCG", "INVALID_DTCG_STRUCTURE", "DTCG groups and tokens must be objects.", {
        pointer: childPointer,
        sourceId,
        tokenPath: [...path, key].join("."),
      });
    }
    collectTokens(
      child,
      [...path, key],
      childPointer,
      effectiveType,
      effectiveDeprecated,
      sourceId,
      output,
    );
  }
}

function inferCollectedTokenType(
  path: string,
  collected: ReadonlyMap<string, CollectedDtcgToken>,
  cache: Map<string, DtcgTokenType>,
  active: string[],
  state: AliasTypeInferenceState,
  sourceId: string | undefined,
): DtcgTokenType {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const token = collected.get(path);
  if (token === undefined) {
    fail(
      "INVALID_DTCG",
      "ALIAS_TARGET_MISSING",
      `Alias target ${JSON.stringify(path)} does not exist in the DTCG document.`,
      { pointer: "", sourceId, tokenPath: path },
    );
  }
  state.steps += 1;
  if (state.steps > DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps) {
    fail(
      "INVALID_DTCG",
      "RESOLUTION_LIMIT_EXCEEDED",
      `Alias type inference exceeds ${DESIGN_TOKEN_PROFILE.limits.maxResolutionSteps} bounded steps.`,
      { pointer: token.pointer, sourceId, tokenPath: path },
    );
  }
  if (token.declaredType !== undefined) {
    cache.set(path, token.declaredType);
    return token.declaredType;
  }
  if (!isDtcgTokenAlias(token.value)) {
    fail(
      "INVALID_DTCG",
      "MISSING_DTCG_TYPE",
      "A literal token must declare or inherit a supported $type.",
      { pointer: token.pointer, sourceId, tokenPath: path },
    );
  }
  const cycleIndex = active.indexOf(path);
  if (cycleIndex !== -1) {
    const cycle = [...active.slice(cycleIndex), path];
    fail(
      "INVALID_DTCG",
      "ALIAS_CYCLE",
      `Alias cycle detected while inferring a token type: ${cycle.join(" -> ")}.`,
      { pointer: appendPointer(token.pointer, "$value"), sourceId, tokenPath: path },
    );
  }
  if (active.length >= DESIGN_TOKEN_PROFILE.limits.maxAliasDepth) {
    fail(
      "INVALID_DTCG",
      "RESOLUTION_LIMIT_EXCEEDED",
      `Alias depth exceeds ${DESIGN_TOKEN_PROFILE.limits.maxAliasDepth}.`,
      { pointer: appendPointer(token.pointer, "$value"), sourceId, tokenPath: path },
    );
  }
  active.push(path);
  try {
    const targetPath = getDtcgAliasTarget(token.value);
    if (!collected.has(targetPath)) {
      fail(
        "INVALID_DTCG",
        "ALIAS_TARGET_MISSING",
        `Alias ${JSON.stringify(token.value)} cannot infer a type from a missing target.`,
        { pointer: appendPointer(token.pointer, "$value"), sourceId, tokenPath: path },
      );
    }
    const inferred = inferCollectedTokenType(targetPath, collected, cache, active, state, sourceId);
    cache.set(path, inferred);
    return inferred;
  } finally {
    active.pop();
  }
}

function admitCollectedTokens(
  collected: ReadonlyMap<string, CollectedDtcgToken>,
  sourceId: string | undefined,
): Map<string, AdmittedDtcgToken> {
  const admitted = new Map<string, AdmittedDtcgToken>();
  const typeCache = new Map<string, DtcgTokenType>();
  const typeState: AliasTypeInferenceState = { steps: 0 };
  const paths = [...collected.keys()].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  for (const path of paths) {
    const token = collected.get(path);
    if (token === undefined) continue;
    admitted.set(
      path,
      deepFreeze({
        metadata: token.metadata,
        path,
        type: inferCollectedTokenType(path, collected, typeCache, [], typeState, sourceId),
        value: token.value,
      }),
    );
  }
  return admitted;
}

function failureResult(
  boundaryError: DtcgBoundaryError,
  snapshot: DtcgTokenDocument | undefined,
): DtcgTokenDocumentAdmissionFailure {
  const output: {
    diagnostics: readonly [DtcgDiagnostic];
    ok: false;
    snapshot?: DtcgTokenDocument;
  } = { diagnostics: Object.freeze([boundaryError.diagnostic]), ok: false };
  if (snapshot !== undefined) output.snapshot = snapshot;
  return deepFreeze(output);
}

/**
 * Capture and completely validate one source except for alias-graph closure.
 *
 * @internal The resolver uses this after every unsafe container, member, metadata field, literal,
 * and finite profile limit has already been checked. Standalone admission remains strict below.
 */
export function collectDtcgTokenDocumentForResolution(
  input: unknown,
  sourceId?: string,
): DtcgTokenDocumentCollectionResult {
  if (sourceId !== undefined && (typeof sourceId !== "string" || !SOURCE_ID.test(sourceId))) {
    return failureResult(
      new DtcgBoundaryError(
        diagnostic(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "sourceId must be a bounded inert identifier string.",
          { pointer: "" },
        ),
      ),
      undefined,
    );
  }
  let snapshot: DtcgTokenDocument | undefined;
  try {
    snapshot = captureDocument(input, sourceId);
    const pending = new Map<string, CollectedDtcgToken>();
    collectTokens(snapshot, [], "", undefined, undefined, sourceId, pending);
    const tokenPaths = Object.freeze(
      [...pending.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    const tokens = Object.create(null) as Record<string, CollectedDtcgToken>;
    for (const path of tokenPaths) {
      const token = pending.get(path);
      if (token !== undefined) tokens[path] = token;
    }
    return deepFreeze({ document: snapshot, ok: true as const, tokenPaths, tokens });
  } catch (error) {
    if (error instanceof DtcgBoundaryError) return failureResult(error, snapshot);
    return failureResult(
      new DtcgBoundaryError(
        diagnostic(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "DTCG input could not be captured safely.",
          { pointer: "", sourceId },
        ),
      ),
      snapshot,
    );
  }
}

/**
 * Safely capture and validate one DTCG token document against the bounded project profile.
 *
 * @remarks Unsupported but safely captured input is returned as `snapshot` on the failure. The
 * package never strips an unknown feature and never invokes accessors or serialization hooks.
 */
export function admitDtcgTokenDocument(
  input: unknown,
  sourceId?: string,
): DtcgTokenDocumentAdmissionResult {
  const collection = collectDtcgTokenDocumentForResolution(input, sourceId);
  if (!collection.ok) return collection;
  try {
    const pending = new Map<string, CollectedDtcgToken>();
    for (const path of collection.tokenPaths) {
      const token = collection.tokens[path];
      if (token !== undefined) pending.set(path, token);
    }
    const collected = admitCollectedTokens(pending, sourceId);

    const tokenPaths = Object.freeze(
      [...collected.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)),
    );
    const tokens = Object.create(null) as Record<string, AdmittedDtcgToken>;
    for (const path of tokenPaths) {
      const token = collected.get(path);
      if (token !== undefined) tokens[path] = token;
    }
    return deepFreeze({ document: collection.document, ok: true as const, tokenPaths, tokens });
  } catch (error) {
    if (error instanceof DtcgBoundaryError) return failureResult(error, collection.document);
    return failureResult(
      new DtcgBoundaryError(
        diagnostic(
          "INVALID_DTCG",
          "UNSAFE_DTCG_VALUE",
          "DTCG input could not be captured safely.",
          { pointer: "", sourceId },
        ),
      ),
      collection.document,
    );
  }
}

/** Return the target path from a syntactically valid whole-token alias. */
export function getDtcgAliasTarget(alias: DtcgTokenAlias): string {
  return alias.slice(1, -1);
}

/** Return whether an unknown value is a syntactically valid whole-token alias. */
export function isDtcgTokenAlias(value: unknown): value is DtcgTokenAlias {
  return typeof value === "string" && WHOLE_TOKEN_ALIAS.test(value);
}

/**
 * Validate a detached literal value for a declared supported token type.
 *
 * @internal Used by the resolver for the final literal-override layer.
 */
export function validateDtcgLiteralOverride(
  type: DtcgTokenType,
  input: unknown,
  pointer: string,
  tokenPath: string,
):
  | { readonly ok: true; readonly value: DtcgTokenLiteral }
  | { readonly diagnostics: readonly [DtcgDiagnostic]; readonly ok: false } {
  let captured: DtcgJsonValue;
  try {
    captured = deepFreeze(
      captureJson(
        input,
        pointer,
        { active: new Set<object>(), characters: 0, nodes: 0 },
        0,
        undefined,
      ),
    );
    if (isDtcgTokenAlias(captured)) {
      fail(
        "INVALID_DTCG",
        "INVALID_LITERAL_OVERRIDE",
        "Literal overrides cannot contain aliases.",
        { pointer, tokenPath },
      );
    }
    assertLiteral(type, captured, pointer, undefined, tokenPath);
    return deepFreeze({ ok: true as const, value: captured });
  } catch (error) {
    const issue =
      error instanceof DtcgBoundaryError
        ? error.diagnostic
        : diagnostic(
            "INVALID_DTCG",
            "INVALID_LITERAL_OVERRIDE",
            "Literal override could not be captured safely.",
            { pointer, tokenPath },
          );
    return deepFreeze({ diagnostics: Object.freeze([issue]), ok: false as const });
  }
}
