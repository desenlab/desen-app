/**
 * A complete sRGB color value from the DTCG 2025.10 color module subset used by the reference
 * Web package.
 *
 * @remarks The hexadecimal member is the deterministic Web fallback for the equivalent normalized
 * sRGB components. This profile does not accept other color spaces or property-level aliases.
 */
export interface DtcgReferenceColorValue {
  readonly colorSpace: "srgb";
  readonly components: readonly [number, number, number];
  readonly alpha: number;
  readonly hex: `#${string}`;
}

/**
 * A DTCG 2025.10 dimension value supported by the reference Web package.
 *
 * @remarks The DTCG format limits dimensions to `px` and `rem`. The reference document currently
 * uses `rem` so browser zoom and user font-size preferences continue to scale spacing.
 */
export interface DtcgReferenceDimensionValue {
  readonly value: number;
  readonly unit: "px" | "rem";
}

/**
 * A whole-token DTCG alias in curly-brace syntax.
 *
 * @remarks Aliases are resolved only within {@link REFERENCE_TOKEN_DOCUMENT}. Property-level
 * aliases, external documents, and runtime-selected token sources are outside this package.
 */
export type DtcgReferenceAlias = `{${string}}`;

/** The direct or aliased token values admitted by the reference DTCG subset. */
export type DtcgReferenceTokenValue =
  DtcgReferenceAlias | DtcgReferenceColorValue | DtcgReferenceDimensionValue;

type DeepReadonly<Value> = Value extends (...arguments_: never[]) => unknown
  ? Value
  : Value extends readonly unknown[]
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value extends object
      ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
      : Value;

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as DeepReadonly<Value>;
  }

  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<Value>;
}

function colorToken(
  hex: `#${string}`,
  red: number,
  green: number,
  blue: number,
): Readonly<{ readonly $value: DtcgReferenceColorValue }> {
  return {
    $value: {
      colorSpace: "srgb",
      components: [red / 255, green / 255, blue / 255],
      alpha: 1,
      hex,
    },
  };
}

function dimensionToken(
  value: number,
  unit: DtcgReferenceDimensionValue["unit"] = "rem",
): Readonly<{ readonly $value: DtcgReferenceDimensionValue }> {
  return { $value: { value, unit } };
}

function aliasToken(alias: DtcgReferenceAlias): Readonly<{ readonly $value: DtcgReferenceAlias }> {
  return { $value: alias };
}

/**
 * The single authoritative design-token document for the DESEN reference Web capability package.
 *
 * @remarks This is a strict DTCG 2025.10 subset:
 *
 * - nested groups with inherited `color` or `dimension` types;
 * - complete sRGB colors with matching lowercase six-digit hexadecimal fallbacks;
 * - `px` or `rem` dimensions; and
 * - whole-token curly-brace aliases whose target has the same effective type.
 *
 * The Web provider validates this document during module initialization and derives every exposed
 * value and CSS custom property from it. The document contains no platform handler, DOM node,
 * runtime host port, external reference, executable value, secret, or user data.
 */
export const REFERENCE_TOKEN_DOCUMENT = deepFreeze({
  color: {
    $type: "color",
    action: {
      primary: colorToken("#1d4ed8", 29, 78, 216),
    },
    border: {
      default: colorToken("#6b7280", 107, 114, 128),
      strong: colorToken("#374151", 55, 65, 81),
    },
    content: {
      onAction: colorToken("#ffffff", 255, 255, 255),
      onCritical: aliasToken("{color.content.onAction}"),
    },
    critical: {
      base: colorToken("#b91c1c", 185, 28, 28),
      surface: colorToken("#fef2f2", 254, 242, 242),
      text: colorToken("#7f1d1d", 127, 29, 29),
    },
    info: {
      base: aliasToken("{color.action.primary}"),
      surface: colorToken("#eff6ff", 239, 246, 255),
      text: colorToken("#1e3a8a", 30, 58, 138),
    },
    success: {
      base: colorToken("#15803d", 21, 128, 61),
      surface: colorToken("#f0fdf4", 240, 253, 244),
      text: colorToken("#14532d", 20, 83, 45),
    },
    surface: {
      default: aliasToken("{color.content.onAction}"),
      disabled: colorToken("#f3f4f6", 243, 244, 246),
    },
    text: {
      default: colorToken("#111827", 17, 24, 39),
    },
    warning: {
      base: colorToken("#a16207", 161, 98, 7),
      surface: colorToken("#fffbeb", 255, 251, 235),
      text: colorToken("#713f12", 113, 63, 18),
    },
  },
  radius: {
    $type: "dimension",
    control: dimensionToken(0.375),
  },
  space: {
    $type: "dimension",
    xs: dimensionToken(0.25),
    sm: dimensionToken(0.5),
    md: dimensionToken(1),
    lg: dimensionToken(1.5),
    xl: dimensionToken(2),
  },
} as const);
