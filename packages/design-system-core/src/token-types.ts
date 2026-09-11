/**
 * Closed token-value types shared by DTCG document admission and deterministic resolution.
 *
 * @packageDocumentation
 */

/** JSON primitives admitted by the design-token boundary. */
export type DtcgJsonPrimitive = boolean | null | number | string;

/** Recursively immutable JSON arrays admitted by the design-token boundary. */
export type DtcgJsonArray = readonly DtcgJsonValue[];

/** Recursively immutable JSON objects admitted by the design-token boundary. */
export type DtcgJsonObject = Readonly<{ [key: string]: DtcgJsonValue }>;

/** Recursively immutable JSON data admitted by the design-token boundary. */
export type DtcgJsonValue = DtcgJsonArray | DtcgJsonObject | DtcgJsonPrimitive;

/** The exact DTCG report version targeted by the project token profile. */
export type DtcgFormatVersion = "2025.10";

/** Token types directly resolved by the project design-system profile. */
export type DtcgTokenType =
  | "border"
  | "color"
  | "cubicBezier"
  | "dimension"
  | "duration"
  | "number"
  | "shadow"
  | "transition"
  | "typography";

/** Higher-level value families surfaced by the project design-system profile. */
export type DesignTokenValueFamily =
  "border" | "color" | "dimension" | "motion" | "number" | "shadow" | "typography";

/** A whole-token DTCG curly-brace alias. */
export type DtcgTokenAlias = `{${string}}`;

/** A bounded sRGB color literal from the DTCG 2025.10 color module. */
export interface DtcgColorValue {
  readonly colorSpace: "srgb";
  readonly components: readonly [number, number, number];
  readonly alpha?: number;
}

/** A bounded DTCG dimension literal. */
export interface DtcgDimensionValue {
  readonly value: number;
  readonly unit: "px" | "rem";
}

/** A bounded DTCG duration literal. */
export interface DtcgDurationValue {
  readonly value: number;
  readonly unit: "ms" | "s";
}

/** A bounded DTCG cubic Bezier literal. */
export type DtcgCubicBezierValue = readonly [number, number, number, number];

/** Named font weights admitted inside the bounded typography profile. */
export type DtcgNamedFontWeight =
  | "black"
  | "bold"
  | "book"
  | "demi-bold"
  | "extra-black"
  | "extra-bold"
  | "extra-light"
  | "hairline"
  | "heavy"
  | "light"
  | "medium"
  | "normal"
  | "regular"
  | "semi-bold"
  | "thin"
  | "ultra-black"
  | "ultra-bold"
  | "ultra-light";

/** A font-family literal admitted inside the bounded typography profile. */
export type DtcgFontFamilyValue = string | readonly string[];

/** A font-weight literal admitted inside the bounded typography profile. */
export type DtcgFontWeightValue = DtcgNamedFontWeight | number;

/** A bounded DTCG typography composite literal. */
export interface DtcgTypographyValue {
  readonly fontFamily: DtcgFontFamilyValue;
  readonly fontSize: DtcgDimensionValue;
  readonly fontWeight: DtcgFontWeightValue;
  readonly letterSpacing: DtcgDimensionValue;
  readonly lineHeight: number;
}

/** Named stroke styles admitted inside the bounded border profile. */
export type DtcgNamedStrokeStyle =
  "dashed" | "dotted" | "double" | "groove" | "inset" | "outset" | "ridge" | "solid";

/** A bounded DTCG border composite literal. */
export interface DtcgBorderValue {
  readonly color: DtcgColorValue;
  readonly style: DtcgNamedStrokeStyle;
  readonly width: DtcgDimensionValue;
}

/** One bounded DTCG shadow layer. */
export interface DtcgShadowLayerValue {
  readonly blur: DtcgDimensionValue;
  readonly color: DtcgColorValue;
  readonly offsetX: DtcgDimensionValue;
  readonly offsetY: DtcgDimensionValue;
  readonly spread: DtcgDimensionValue;
}

/** A single- or multi-layer bounded DTCG shadow literal. */
export type DtcgShadowValue = DtcgShadowLayerValue | readonly DtcgShadowLayerValue[];

/** A bounded DTCG transition composite literal. */
export interface DtcgTransitionValue {
  readonly delay: DtcgDurationValue;
  readonly duration: DtcgDurationValue;
  readonly timingFunction: DtcgCubicBezierValue;
}

/** Literal values accepted for each supported DTCG token type. */
export interface DtcgLiteralValueByType {
  readonly border: DtcgBorderValue;
  readonly color: DtcgColorValue;
  readonly cubicBezier: DtcgCubicBezierValue;
  readonly dimension: DtcgDimensionValue;
  readonly duration: DtcgDurationValue;
  readonly number: number;
  readonly shadow: DtcgShadowValue;
  readonly transition: DtcgTransitionValue;
  readonly typography: DtcgTypographyValue;
}

/** Union of every literal value accepted by the bounded project profile. */
export type DtcgTokenLiteral = DtcgLiteralValueByType[DtcgTokenType];

/** A literal value or a whole-token alias accepted at a DTCG token node. */
export type DtcgTokenValue = DtcgTokenAlias | DtcgTokenLiteral;

/** Metadata preserved without interpretation on admitted DTCG groups and tokens. */
export interface DtcgNodeMetadata {
  readonly $deprecated?: boolean | string;
  readonly $description?: string;
  readonly $extensions?: DtcgJsonObject;
}

/** One flattened, typed token declaration captured from an admitted document. */
export interface AdmittedDtcgToken {
  readonly metadata: DtcgNodeMetadata;
  readonly path: string;
  readonly type: DtcgTokenType;
  readonly value: DtcgTokenValue;
}

/** Stable top-level classification for rejected token data. */
export type DtcgFailureClassification = "INVALID_DTCG" | "UNSUPPORTED_DTCG_FEATURE";

/** Stable diagnostic codes emitted by admission and resolution. */
export type DtcgDiagnosticCode =
  | "ALIAS_CYCLE"
  | "ALIAS_TARGET_MISSING"
  | "ALIAS_TYPE_MISMATCH"
  | "DUPLICATE_LITERAL_OVERRIDE"
  | "DUPLICATE_SOURCE_ID"
  | "EMPTY_DTCG_GROUP"
  | "EMPTY_SOURCE_LIST"
  | "INVALID_DTCG_DOCUMENT"
  | "INVALID_DTCG_METADATA"
  | "INVALID_DTCG_NAME"
  | "INVALID_DTCG_STRUCTURE"
  | "INVALID_DTCG_VALUE"
  | "INVALID_LITERAL_OVERRIDE"
  | "INVALID_SOURCE_DESCRIPTOR"
  | "LIMIT_EXCEEDED"
  | "MISSING_DTCG_TYPE"
  | "RESOLUTION_LIMIT_EXCEEDED"
  | "SOURCE_TYPE_MISMATCH"
  | "UNSAFE_DTCG_VALUE"
  | "UNSUPPORTED_COLOR_SPACE"
  | "UNSUPPORTED_DTCG_MEMBER"
  | "UNSUPPORTED_DTCG_TYPE"
  | "UNSUPPORTED_PROPERTY_ALIAS"
  | "UNSUPPORTED_STROKE_STYLE";

/** One immutable, location-aware diagnostic from DTCG admission or resolution. */
export interface DtcgDiagnostic {
  readonly classification: DtcgFailureClassification;
  readonly code: DtcgDiagnosticCode;
  readonly message: string;
  readonly pointer: string;
  readonly sourceId?: string;
  readonly tokenPath?: string;
}

/** Explicit finite limits for the bounded project DTCG profile. */
export interface DtcgProfileLimits {
  readonly maxAliasDepth: number;
  readonly maxArrayItems: number;
  readonly maxDocumentCharacters: number;
  readonly maxJsonDepth: number;
  readonly maxJsonNodes: number;
  readonly maxModesAsSources: number;
  readonly maxResolutionSteps: number;
  readonly maxShadowLayers: number;
  readonly maxSources: number;
  readonly maxStringLength: number;
  readonly maxTokenCount: number;
  readonly maxTokenPathLength: number;
  readonly maxTokenPathSegments: number;
}

/** Machine-readable declaration of the exact DTCG surface supported by this package. */
export interface DtcgProjectProfile {
  readonly colorSpaces: readonly ["srgb"];
  readonly dimensionUnits: readonly ["px", "rem"];
  readonly durationUnits: readonly ["ms", "s"];
  readonly formatVersion: DtcgFormatVersion;
  readonly limits: DtcgProfileLimits;
  readonly metadataMembers: readonly ["$deprecated", "$description", "$extensions"];
  readonly motionTypes: readonly ["duration", "cubicBezier", "transition"];
  readonly tokenTypes: readonly DtcgTokenType[];
  readonly wholeTokenAliasesOnly: true;
}

/**
 * Exact closed DTCG 2025.10 project profile enforced by admission and resolution.
 *
 * @remarks Project modes and contextual selection are represented as ordered external source
 * overlays. They are deliberately not encoded as invented members inside a DTCG document.
 */
export const DESIGN_TOKEN_PROFILE: DtcgProjectProfile = Object.freeze({
  colorSpaces: Object.freeze(["srgb"] as const),
  dimensionUnits: Object.freeze(["px", "rem"] as const),
  durationUnits: Object.freeze(["ms", "s"] as const),
  formatVersion: "2025.10",
  limits: Object.freeze({
    maxAliasDepth: 64,
    maxArrayItems: 4_096,
    maxDocumentCharacters: 4_194_304,
    maxJsonDepth: 64,
    maxJsonNodes: 50_000,
    maxModesAsSources: 16,
    maxResolutionSteps: 250_000,
    maxShadowLayers: 16,
    maxSources: 17,
    maxStringLength: 65_536,
    maxTokenCount: 4_096,
    maxTokenPathLength: 1_024,
    maxTokenPathSegments: 32,
  }),
  metadataMembers: Object.freeze(["$deprecated", "$description", "$extensions"] as const),
  motionTypes: Object.freeze(["duration", "cubicBezier", "transition"] as const),
  tokenTypes: Object.freeze([
    "border",
    "color",
    "cubicBezier",
    "dimension",
    "duration",
    "number",
    "shadow",
    "transition",
    "typography",
  ] as const),
  wholeTokenAliasesOnly: true,
});

/** Return the higher-level family for a supported token type. */
export function getDesignTokenValueFamily(type: DtcgTokenType): DesignTokenValueFamily {
  if (type === "duration" || type === "cubicBezier" || type === "transition") return "motion";
  return type;
}
