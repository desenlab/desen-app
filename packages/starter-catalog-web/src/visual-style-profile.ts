import type { JsonValue } from "@desen/catalog-sdk";

/**
 * Finite Web visual-authoring profile shared by the starter Catalog and its React adapters.
 *
 * The profile intentionally accepts structured visual data rather than CSS strings. A Catalog
 * consumer can therefore offer conventional visual controls while the adapter retains the only
 * translation path to Web CSS.
 */

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
type JsonObject = Readonly<Record<string, JsonValue>>;

/** Public style profiles map to semantic starter capability surfaces, never DOM selectors. */
export type StarterVisualStyleProfile =
  "control" | "image" | "layout" | "media" | "neutral" | "separator" | "typography";

/**
 * Finite capability-to-profile projection shared by the Catalog consumer and the Web adapter.
 *
 * @remarks Capability identifiers are public Catalog identities, not caller-supplied selectors.
 * Keeping this projection beside the profile guards prevents a visual control from admitting a
 * structured DTCG literal which the exact Web mapper would later omit.
 */
const STARTER_VISUAL_STYLE_PROFILE_BY_CAPABILITY: Readonly<
  Record<string, StarterVisualStyleProfile>
> = Object.freeze({
  "run.desen.starter/Accordion": "control",
  "run.desen.starter/Alert": "control",
  "run.desen.starter/Avatar": "control",
  "run.desen.starter/Badge": "control",
  "run.desen.starter/Box": "layout",
  "run.desen.starter/Button": "neutral",
  "run.desen.starter/Card": "control",
  "run.desen.starter/Checkbox": "control",
  "run.desen.starter/Combobox": "control",
  "run.desen.starter/Dialog": "neutral",
  "run.desen.starter/Grid": "layout",
  "run.desen.starter/Heading": "typography",
  "run.desen.starter/Icon": "media",
  "run.desen.starter/Image": "image",
  "run.desen.starter/List": "control",
  "run.desen.starter/Menu": "control",
  "run.desen.starter/NumberField": "control",
  "run.desen.starter/Popover": "control",
  "run.desen.starter/Progress": "control",
  "run.desen.starter/RadioGroup": "control",
  "run.desen.starter/Select": "control",
  "run.desen.starter/Separator": "separator",
  "run.desen.starter/Skeleton": "control",
  "run.desen.starter/Slider": "control",
  "run.desen.starter/Stack": "layout",
  "run.desen.starter/Switch": "control",
  "run.desen.starter/Table": "control",
  "run.desen.starter/Tabs": "control",
  "run.desen.starter/Text": "typography",
  "run.desen.starter/TextArea": "control",
  "run.desen.starter/TextField": "control",
  "run.desen.starter/Tooltip": "control",
});

/** Returns the one declared visual profile for a known starter capability, if any. */
export function starterVisualStyleProfileForCapability(
  capabilityId: string,
): StarterVisualStyleProfile | undefined {
  if (typeof capabilityId !== "string") return undefined;
  return STARTER_VISUAL_STYLE_PROFILE_BY_CAPABILITY[capabilityId];
}

/** Bounded named generic font stacks; imported fonts remain the separate T13 concern. */
export const STARTER_FONT_FAMILIES = Object.freeze(["system", "serif", "mono"] as const);

const STARTER_DTCG_FONT_FAMILIES = Object.freeze([
  "system",
  "serif",
  "mono",
  "ui-sans-serif",
  "system-ui",
  "sans-serif",
  "ui-serif",
  "ui-monospace",
  "monospace",
] as const);
const STARTER_DTCG_NAMED_FONT_WEIGHTS = Object.freeze([
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
] as const);
const STARTER_BORDER_STYLES = Object.freeze([
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "inset",
  "outset",
  "ridge",
] as const);

const HEX_COLOR_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
  ],
} as const);
const DTCG_COLOR_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["colorSpace", "components"],
  properties: {
    colorSpace: { type: "string", enum: ["srgb"] },
    components: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: { type: "number", minimum: 0, maximum: 1 },
    },
    alpha: { type: "number", minimum: 0, maximum: 1 },
  },
} as const);
const COLOR_SCHEMA = Object.freeze({ anyOf: [HEX_COLOR_SCHEMA, DTCG_COLOR_SCHEMA] } as const);

function dtcgDimensionSchema(
  pxMinimum: number,
  pxMaximum: number,
  remMinimum: number,
  remMaximum: number,
): JsonObject {
  return Object.freeze({
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["value", "unit"],
        properties: {
          value: { type: "number", minimum: pxMinimum, maximum: pxMaximum },
          unit: { type: "string", enum: ["px"] },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["value", "unit"],
        properties: {
          value: { type: "number", minimum: remMinimum, maximum: remMaximum },
          unit: { type: "string", enum: ["rem"] },
        },
      },
    ],
  });
}

function numberOrDtcgDimensionSchema(
  pxMinimum: number,
  pxMaximum: number,
  remMinimum: number,
  remMaximum: number,
): JsonObject {
  return Object.freeze({
    anyOf: [
      { type: "number", minimum: pxMinimum, maximum: pxMaximum },
      dtcgDimensionSchema(pxMinimum, pxMaximum, remMinimum, remMaximum),
    ],
  });
}

const SIZE_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(0, 4_096, 0, 256);
const RADIUS_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(0, 128, 0, 8);
const BORDER_WIDTH_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(0, 16, 0, 1);
const POSITIVE_SPACING_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(0, 512, 0, 32);
const SIGNED_SPACING_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(-512, 512, -32, 32);
const FONT_SIZE_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(8, 160, 0.5, 10);
const LETTER_SPACING_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(-8, 32, -0.5, 2);
const INSET_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(-4_096, 4_096, -256, 256);
const SHADOW_OFFSET_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(-128, 128, -8, 8);
const SHADOW_BLUR_DIMENSION_SCHEMA = numberOrDtcgDimensionSchema(0, 256, 0, 16);

const DIMENSION_SCHEMA = Object.freeze({
  anyOf: [SIZE_DIMENSION_SCHEMA, { type: "string", enum: ["fill", "hug"] }],
  description: "A bounded pixel/rem dimension, or the finite fill/hug sizing mode.",
} as const);

const DTCG_FONT_FAMILY_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", enum: STARTER_DTCG_FONT_FAMILIES },
    {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: STARTER_DTCG_FONT_FAMILIES },
    },
  ],
} as const);
const DTCG_FONT_WEIGHT_SCHEMA = Object.freeze({
  anyOf: [
    { type: "integer", minimum: 1, maximum: 1_000 },
    { type: "string", enum: STARTER_DTCG_NAMED_FONT_WEIGHTS },
  ],
} as const);
const DTCG_TYPOGRAPHY_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"],
  properties: {
    fontFamily: DTCG_FONT_FAMILY_SCHEMA,
    fontSize: dtcgDimensionSchema(8, 160, 0.5, 10),
    fontWeight: DTCG_FONT_WEIGHT_SCHEMA,
    letterSpacing: dtcgDimensionSchema(-8, 32, -0.5, 2),
    lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
  },
} as const);
const DTCG_BORDER_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["color", "style", "width"],
  properties: {
    color: DTCG_COLOR_SCHEMA,
    style: { type: "string", enum: STARTER_BORDER_STYLES },
    width: dtcgDimensionSchema(0, 16, 0, 1),
  },
} as const);

const GRADIENT_STOP_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["color", "position"],
  properties: {
    color: COLOR_SCHEMA,
    position: { type: "number", minimum: 0, maximum: 100 },
  },
} as const);

const LINEAR_GRADIENT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["angle", "stops"],
  properties: {
    angle: { type: "number", minimum: 0, maximum: 360 },
    stops: { type: "array", minItems: 2, maxItems: 4, items: GRADIENT_STOP_SCHEMA },
  },
} as const);

const SHADOW_LAYER_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["color", "offsetX", "offsetY", "blur", "spread"],
  properties: {
    color: COLOR_SCHEMA,
    offsetX: SHADOW_OFFSET_DIMENSION_SCHEMA,
    offsetY: SHADOW_OFFSET_DIMENSION_SCHEMA,
    blur: SHADOW_BLUR_DIMENSION_SCHEMA,
    spread: SHADOW_OFFSET_DIMENSION_SCHEMA,
    inset: { type: "boolean" },
  },
} as const);
const BOX_SHADOW_SCHEMA = Object.freeze({
  anyOf: [
    SHADOW_LAYER_SCHEMA,
    { type: "array", minItems: 1, maxItems: 4, items: SHADOW_LAYER_SCHEMA },
  ],
} as const);

const BORDER_PROPERTIES = Object.freeze({
  border: DTCG_BORDER_SCHEMA,
  borderColor: { ...COLOR_SCHEMA, description: "Resolved border color." },
  borderWidth: BORDER_WIDTH_DIMENSION_SCHEMA,
  borderStyle: { type: "string", enum: STARTER_BORDER_STYLES },
  borderTopColor: COLOR_SCHEMA,
  borderRightColor: COLOR_SCHEMA,
  borderBottomColor: COLOR_SCHEMA,
  borderLeftColor: COLOR_SCHEMA,
  borderTopWidth: BORDER_WIDTH_DIMENSION_SCHEMA,
  borderRightWidth: BORDER_WIDTH_DIMENSION_SCHEMA,
  borderBottomWidth: BORDER_WIDTH_DIMENSION_SCHEMA,
  borderLeftWidth: BORDER_WIDTH_DIMENSION_SCHEMA,
  borderRadius: RADIUS_DIMENSION_SCHEMA,
  borderTopLeftRadius: RADIUS_DIMENSION_SCHEMA,
  borderTopRightRadius: RADIUS_DIMENSION_SCHEMA,
  borderBottomRightRadius: RADIUS_DIMENSION_SCHEMA,
  borderBottomLeftRadius: RADIUS_DIMENSION_SCHEMA,
} as const);

const APPEARANCE_PROPERTIES = Object.freeze({
  color: { ...COLOR_SCHEMA, description: "Resolved foreground color." },
  backgroundColor: { ...COLOR_SCHEMA, description: "Resolved solid background color." },
  backgroundGradient: LINEAR_GRADIENT_SCHEMA,
  ...BORDER_PROPERTIES,
  boxShadow: BOX_SHADOW_SCHEMA,
  opacity: { type: "number", minimum: 0, maximum: 1 },
} as const);

const IMAGE_APPEARANCE_PROPERTIES = Object.freeze({
  backgroundColor: { ...COLOR_SCHEMA, description: "Resolved solid background color." },
  backgroundGradient: LINEAR_GRADIENT_SCHEMA,
  ...BORDER_PROPERTIES,
  boxShadow: BOX_SHADOW_SCHEMA,
  opacity: { type: "number", minimum: 0, maximum: 1 },
} as const);

const TYPOGRAPHY_PROPERTIES = Object.freeze({
  typography: DTCG_TYPOGRAPHY_SCHEMA,
  fontFamily: { type: "string", enum: STARTER_FONT_FAMILIES },
  fontWeight: { type: "number", enum: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  fontSize: FONT_SIZE_DIMENSION_SCHEMA,
  lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
  letterSpacing: LETTER_SPACING_DIMENSION_SCHEMA,
  textAlign: { type: "string", enum: ["start", "center", "end", "justify"] },
  textDecoration: { type: "string", enum: ["none", "underline", "line-through", "overline"] },
  fontStyle: { type: "string", enum: ["normal", "italic"] },
  textTransform: { type: "string", enum: ["none", "uppercase", "lowercase", "capitalize"] },
} as const);

const GEOMETRY_PROPERTIES = Object.freeze({
  width: DIMENSION_SCHEMA,
  height: DIMENSION_SCHEMA,
  minWidth: SIZE_DIMENSION_SCHEMA,
  maxWidth: SIZE_DIMENSION_SCHEMA,
  minHeight: SIZE_DIMENSION_SCHEMA,
  maxHeight: SIZE_DIMENSION_SCHEMA,
  padding: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingBlock: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingInline: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingTop: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingRight: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingBottom: POSITIVE_SPACING_DIMENSION_SCHEMA,
  paddingLeft: POSITIVE_SPACING_DIMENSION_SCHEMA,
  margin: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginBlock: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginInline: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginTop: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginRight: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginBottom: SIGNED_SPACING_DIMENSION_SCHEMA,
  marginLeft: SIGNED_SPACING_DIMENSION_SCHEMA,
} as const);

const LAYOUT_PROPERTIES = Object.freeze({
  layoutMode: { type: "string", enum: ["block", "flex", "grid"] },
  flowDirection: { type: "string", enum: ["row", "column"] },
  flowWrap: { type: "string", enum: ["nowrap", "wrap"] },
  gridAutoFlow: { type: "string", enum: ["row", "column"] },
  gridColumns: { type: "integer", minimum: 1, maximum: 12 },
  flexGrow: { type: "number", minimum: 0, maximum: 12 },
  flexShrink: { type: "number", minimum: 0, maximum: 12 },
  gap: POSITIVE_SPACING_DIMENSION_SCHEMA,
  rowGap: POSITIVE_SPACING_DIMENSION_SCHEMA,
  columnGap: POSITIVE_SPACING_DIMENSION_SCHEMA,
  overflow: { type: "string", enum: ["visible", "hidden", "auto", "scroll"] },
  overflowX: { type: "string", enum: ["visible", "hidden", "auto", "scroll"] },
  overflowY: { type: "string", enum: ["visible", "hidden", "auto", "scroll"] },
  alignItems: { type: "string", enum: ["start", "center", "end", "stretch"] },
  alignSelf: { type: "string", enum: ["auto", "start", "center", "end", "stretch"] },
  justifyContent: {
    type: "string",
    enum: ["start", "center", "end", "between", "around", "evenly"],
  },
} as const);

const POSITIONING_PROPERTIES = Object.freeze({
  position: { type: "string", enum: ["static", "relative", "absolute"] },
  insetTop: INSET_DIMENSION_SCHEMA,
  insetRight: INSET_DIMENSION_SCHEMA,
  insetBottom: INSET_DIMENSION_SCHEMA,
  insetLeft: INSET_DIMENSION_SCHEMA,
  zIndex: { type: "integer", minimum: -100, maximum: 100 },
} as const);

const TRANSFORM_PROPERTIES = Object.freeze({
  translateX: INSET_DIMENSION_SCHEMA,
  translateY: INSET_DIMENSION_SCHEMA,
  rotate: { type: "number", minimum: -180, maximum: 180 },
  scaleX: { type: "number", minimum: 0.1, maximum: 4 },
  scaleY: { type: "number", minimum: 0.1, maximum: 4 },
  transformOrigin: {
    type: "string",
    enum: [
      "center",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
      "top-left",
    ],
  },
} as const);

const PROFILE_PROPERTIES: Readonly<
  Record<StarterVisualStyleProfile, Readonly<Record<string, unknown>>>
> = Object.freeze({
  layout: Object.freeze({
    ...APPEARANCE_PROPERTIES,
    ...TYPOGRAPHY_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...LAYOUT_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  typography: Object.freeze({
    ...APPEARANCE_PROPERTIES,
    ...TYPOGRAPHY_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  image: Object.freeze({
    ...IMAGE_APPEARANCE_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  media: Object.freeze({
    ...APPEARANCE_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  separator: Object.freeze({
    ...IMAGE_APPEARANCE_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  control: Object.freeze({
    ...APPEARANCE_PROPERTIES,
    ...TYPOGRAPHY_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...LAYOUT_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
  neutral: Object.freeze({
    ...APPEARANCE_PROPERTIES,
    ...TYPOGRAPHY_PROPERTIES,
    ...GEOMETRY_PROPERTIES,
    ...LAYOUT_PROPERTIES,
    ...POSITIONING_PROPERTIES,
    ...TRANSFORM_PROPERTIES,
  }),
});

/**
 * Compact local JSON Schema definitions. Every public property still resolves in exactly one hop
 * to a property-specific leaf with its own `type`, `enum`, or `anyOf`. Only repeated internals
 * (DTCG primitives, shadow layers, and gradient stops) are shared beneath that leaf. This keeps
 * 124 standalone semantic style parts inside the fixed package-digest node budget without an
 * external schema, URL, selector, or generic CSS escape hatch.
 */
function localStyleRef(name: string): JsonObject {
  return Object.freeze({ $ref: `#/$defs/${name}` });
}

const STYLE_HELPER_DEFINITIONS: Readonly<Record<string, JsonValue>> = Object.freeze({
  hexColor: HEX_COLOR_SCHEMA,
  dtcgColor: DTCG_COLOR_SCHEMA,
  // The leaf's direct numeric branch keeps each semantic property's exact scalar limit. This
  // shared object branch admits only finite px/rem records inside the global visual envelope;
  // the adapter guard remains the exact per-property authority before CSS projection.
  genericDimension: dtcgDimensionSchema(-4_096, 4_096, -256, 256),
  sizeDimension: dtcgDimensionSchema(0, 4_096, 0, 256),
  borderWidthDimension: dtcgDimensionSchema(0, 16, 0, 1),
  positiveSpacingDimension: dtcgDimensionSchema(0, 512, 0, 32),
  fontSizeDimension: dtcgDimensionSchema(8, 160, 0.5, 10),
  letterSpacingDimension: dtcgDimensionSchema(-8, 32, -0.5, 2),
  dtcgFontFamily: {
    anyOf: [
      { type: "string", enum: STARTER_DTCG_FONT_FAMILIES },
      {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: { type: "string", enum: STARTER_DTCG_FONT_FAMILIES },
      },
    ],
  },
  dtcgFontWeight: {
    anyOf: [
      { type: "integer", minimum: 1, maximum: 1_000 },
      { type: "string", enum: STARTER_DTCG_NAMED_FONT_WEIGHTS },
    ],
  },
  gradientStop: {
    type: "object",
    additionalProperties: false,
    required: ["color", "position"],
    properties: {
      color: localStyleRef("color"),
      position: { type: "number", minimum: 0, maximum: 100 },
    },
  },
  shadowLayer: {
    type: "object",
    additionalProperties: false,
    required: ["color", "offsetX", "offsetY", "blur", "spread"],
    properties: {
      color: localStyleRef("color"),
      offsetX: localStyleRef("genericDimension"),
      offsetY: localStyleRef("genericDimension"),
      blur: localStyleRef("genericDimension"),
      spread: localStyleRef("genericDimension"),
      inset: { type: "boolean" },
    },
  },
});

const STYLE_VALUE_DEFINITIONS: Readonly<Record<string, JsonValue>> = Object.freeze({
  alignItems: { type: "string", enum: ["start", "center", "end", "stretch"] },
  alignSelf: { type: "string", enum: ["auto", "start", "center", "end", "stretch"] },
  border: {
    type: "object",
    additionalProperties: false,
    required: ["color", "style", "width"],
    properties: {
      color: localStyleRef("dtcgColor"),
      style: { type: "string", enum: STARTER_BORDER_STYLES },
      width: localStyleRef("borderWidthDimension"),
    },
  },
  borderStyle: { type: "string", enum: STARTER_BORDER_STYLES },
  borderWidth: {
    anyOf: [{ type: "number", minimum: 0, maximum: 16 }, localStyleRef("borderWidthDimension")],
  },
  color: {
    anyOf: [localStyleRef("hexColor"), localStyleRef("dtcgColor")],
  },
  dimension: {
    anyOf: [localStyleRef("size"), { type: "string", enum: ["fill", "hug"] }],
    description: "A bounded pixel/rem dimension, or the finite fill/hug sizing mode.",
  },
  flex: { type: "number", minimum: 0, maximum: 12 },
  fontFamily: { type: "string", enum: STARTER_FONT_FAMILIES },
  fontSize: {
    anyOf: [{ type: "number", minimum: 8, maximum: 160 }, localStyleRef("fontSizeDimension")],
  },
  fontStyle: { type: "string", enum: ["normal", "italic"] },
  fontWeight: { type: "number", enum: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  flowDirection: { type: "string", enum: ["row", "column"] },
  flowWrap: { type: "string", enum: ["nowrap", "wrap"] },
  gridAutoFlow: { type: "string", enum: ["row", "column"] },
  gridColumns: { type: "integer", minimum: 1, maximum: 12 },
  inset: {
    anyOf: [{ type: "number", minimum: -4_096, maximum: 4_096 }, localStyleRef("genericDimension")],
  },
  justifyContent: {
    type: "string",
    enum: ["start", "center", "end", "between", "around", "evenly"],
  },
  layoutMode: { type: "string", enum: ["block", "flex", "grid"] },
  letterSpacing: {
    anyOf: [{ type: "number", minimum: -8, maximum: 32 }, localStyleRef("letterSpacingDimension")],
  },
  linearGradient: {
    type: "object",
    additionalProperties: false,
    required: ["angle", "stops"],
    properties: {
      angle: { type: "number", minimum: 0, maximum: 360 },
      stops: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: localStyleRef("gradientStop"),
      },
    },
  },
  lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
  opacity: { type: "number", minimum: 0, maximum: 1 },
  overflow: { type: "string", enum: ["visible", "hidden", "auto", "scroll"] },
  position: { type: "string", enum: ["static", "relative", "absolute"] },
  positiveSpacing: {
    anyOf: [
      { type: "number", minimum: 0, maximum: 512 },
      localStyleRef("positiveSpacingDimension"),
    ],
  },
  radius: {
    anyOf: [{ type: "number", minimum: 0, maximum: 128 }, localStyleRef("genericDimension")],
  },
  rotate: { type: "number", minimum: -180, maximum: 180 },
  scale: { type: "number", minimum: 0.1, maximum: 4 },
  shadow: {
    anyOf: [
      localStyleRef("shadowLayer"),
      { type: "array", minItems: 1, maxItems: 4, items: localStyleRef("shadowLayer") },
    ],
  },
  signedSpacing: {
    anyOf: [{ type: "number", minimum: -512, maximum: 512 }, localStyleRef("genericDimension")],
  },
  size: {
    anyOf: [{ type: "number", minimum: 0, maximum: 4_096 }, localStyleRef("sizeDimension")],
  },
  textAlign: { type: "string", enum: ["start", "center", "end", "justify"] },
  textDecoration: { type: "string", enum: ["none", "underline", "line-through", "overline"] },
  textTransform: { type: "string", enum: ["none", "uppercase", "lowercase", "capitalize"] },
  transformOrigin: {
    type: "string",
    enum: [
      "center",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
      "top-left",
    ],
  },
  typography: {
    type: "object",
    additionalProperties: false,
    required: ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"],
    properties: {
      fontFamily: localStyleRef("dtcgFontFamily"),
      fontSize: localStyleRef("fontSizeDimension"),
      fontWeight: localStyleRef("dtcgFontWeight"),
      letterSpacing: localStyleRef("letterSpacingDimension"),
      lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
    },
  },
  zIndex: { type: "integer", minimum: -100, maximum: 100 },
});

const STYLE_DEFINITION_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  border: ["dtcgColor", "borderWidthDimension"],
  borderWidth: ["borderWidthDimension"],
  color: ["hexColor", "dtcgColor"],
  dimension: ["size"],
  fontSize: ["fontSizeDimension"],
  inset: ["genericDimension"],
  letterSpacing: ["letterSpacingDimension"],
  linearGradient: ["gradientStop"],
  positiveSpacing: ["positiveSpacingDimension"],
  radius: ["genericDimension"],
  shadow: ["shadowLayer"],
  signedSpacing: ["genericDimension"],
  size: ["sizeDimension"],
  typography: ["dtcgFontFamily", "fontSizeDimension", "dtcgFontWeight", "letterSpacingDimension"],
  gradientStop: ["color"],
  shadowLayer: ["color", "genericDimension"],
});

const STYLE_PROPERTY_DEFINITION_NAMES: Readonly<Record<string, string>> = Object.freeze({
  alignItems: "alignItems",
  alignSelf: "alignSelf",
  backgroundColor: "color",
  backgroundGradient: "linearGradient",
  border: "border",
  borderBottomColor: "color",
  borderBottomLeftRadius: "radius",
  borderBottomRightRadius: "radius",
  borderBottomWidth: "borderWidth",
  borderColor: "color",
  borderLeftColor: "color",
  borderLeftWidth: "borderWidth",
  borderRadius: "radius",
  borderRightColor: "color",
  borderRightWidth: "borderWidth",
  borderStyle: "borderStyle",
  borderTopColor: "color",
  borderTopLeftRadius: "radius",
  borderTopRightRadius: "radius",
  borderTopWidth: "borderWidth",
  borderWidth: "borderWidth",
  boxShadow: "shadow",
  color: "color",
  columnGap: "positiveSpacing",
  flexGrow: "flex",
  flexShrink: "flex",
  flowDirection: "flowDirection",
  flowWrap: "flowWrap",
  fontFamily: "fontFamily",
  fontSize: "fontSize",
  fontStyle: "fontStyle",
  fontWeight: "fontWeight",
  gap: "positiveSpacing",
  gridAutoFlow: "gridAutoFlow",
  gridColumns: "gridColumns",
  height: "dimension",
  insetBottom: "inset",
  insetLeft: "inset",
  insetRight: "inset",
  insetTop: "inset",
  justifyContent: "justifyContent",
  layoutMode: "layoutMode",
  letterSpacing: "letterSpacing",
  lineHeight: "lineHeight",
  margin: "signedSpacing",
  marginBlock: "signedSpacing",
  marginBottom: "signedSpacing",
  marginInline: "signedSpacing",
  marginLeft: "signedSpacing",
  marginRight: "signedSpacing",
  marginTop: "signedSpacing",
  maxHeight: "size",
  maxWidth: "size",
  minHeight: "size",
  minWidth: "size",
  opacity: "opacity",
  overflow: "overflow",
  overflowX: "overflow",
  overflowY: "overflow",
  padding: "positiveSpacing",
  paddingBlock: "positiveSpacing",
  paddingBottom: "positiveSpacing",
  paddingInline: "positiveSpacing",
  paddingLeft: "positiveSpacing",
  paddingRight: "positiveSpacing",
  paddingTop: "positiveSpacing",
  position: "position",
  rotate: "rotate",
  rowGap: "positiveSpacing",
  scaleX: "scale",
  scaleY: "scale",
  textAlign: "textAlign",
  textDecoration: "textDecoration",
  textTransform: "textTransform",
  transformOrigin: "transformOrigin",
  translateX: "inset",
  translateY: "inset",
  typography: "typography",
  width: "dimension",
  zIndex: "zIndex",
});

function compactProfileSchema(profile: StarterVisualStyleProfile): JsonObject {
  const definitions: Record<string, JsonValue> = {};
  const properties: Record<string, JsonValue> = {};
  const includedDefinitions = new Set<string>();

  const includeDefinition = (definitionName: string): void => {
    if (includedDefinitions.has(definitionName)) return;
    const definition =
      STYLE_VALUE_DEFINITIONS[definitionName] ?? STYLE_HELPER_DEFINITIONS[definitionName];
    if (definition === undefined) {
      throw new TypeError(`STARTER_STYLE_DEFINITION_MISSING:${definitionName}`);
    }
    includedDefinitions.add(definitionName);
    definitions[definitionName] = definition;
    for (const dependency of STYLE_DEFINITION_DEPENDENCIES[definitionName] ?? []) {
      includeDefinition(dependency);
    }
  };

  for (const property of Object.keys(PROFILE_PROPERTIES[profile])) {
    const definitionName = STYLE_PROPERTY_DEFINITION_NAMES[property];
    if (definitionName === undefined) {
      throw new TypeError(`STARTER_STYLE_DEFINITION_MISSING:${property}`);
    }
    includeDefinition(definitionName);
    properties[property] = localStyleRef(definitionName);
  }
  return Object.freeze({
    $schema: JSON_SCHEMA_DIALECT,
    $defs: Object.freeze(definitions),
    type: "object",
    additionalProperties: false,
    properties: Object.freeze(properties),
  });
}

const PROFILE_SCHEMAS: Readonly<Record<StarterVisualStyleProfile, JsonObject>> = Object.freeze({
  layout: compactProfileSchema("layout"),
  typography: compactProfileSchema("typography"),
  image: compactProfileSchema("image"),
  media: compactProfileSchema("media"),
  separator: compactProfileSchema("separator"),
  control: compactProfileSchema("control"),
  neutral: compactProfileSchema("neutral"),
});

/** Returns one immutable Catalog `propertiesSchema` for the selected public semantic surface. */
export function starterVisualStylePropertiesSchema(profile: StarterVisualStyleProfile): JsonObject {
  return PROFILE_SCHEMAS[profile];
}

/** Enumerates exact properties accepted by the selected profile. */
export function starterVisualStylePropertyNames(
  profile: StarterVisualStyleProfile,
): readonly string[] {
  return Object.freeze(Object.keys(PROFILE_PROPERTIES[profile]));
}

/** Returns the exact immutable Catalog property map for one public visual style profile. */
export function starterVisualStyleProperties(
  profile: StarterVisualStyleProfile,
): Readonly<Record<string, unknown>> {
  return PROFILE_PROPERTIES[profile];
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/u.test(value);
}

function isFiniteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function isInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && isFiniteNumber(value, minimum, maximum);
}

export type StarterVisualColor = string | Readonly<Record<string, unknown>>;
export type StarterVisualDimension =
  number | Readonly<{ readonly unit: "px" | "rem"; readonly value: number }>;
export type StarterBoxShadow =
  Readonly<Record<string, unknown>> | readonly Readonly<Record<string, unknown>>[];
export type StarterTypography = Readonly<Record<string, unknown>>;
export type StarterBorder = Readonly<Record<string, unknown>>;

function isDtcgColor(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    isPlainRecord(value) &&
    value.colorSpace === "srgb" &&
    Array.isArray(value.components) &&
    value.components.length === 3 &&
    value.components.every((component) => isFiniteNumber(component, 0, 1)) &&
    (value.alpha === undefined || isFiniteNumber(value.alpha, 0, 1)) &&
    Object.keys(value).every(
      (key) => key === "colorSpace" || key === "components" || key === "alpha",
    )
  );
}

/** Exact color literal accepted from either the starter profile or a resolved DTCG color token. */
export function isStarterVisualColor(value: unknown): value is StarterVisualColor {
  return isHexColor(value) || isDtcgColor(value);
}

/** Converts an already admitted hex or DTCG sRGB color to a CSS-safe hexadecimal literal. */
export function starterColorToCss(value: StarterVisualColor): string {
  if (isHexColor(value)) return value;
  if (!isDtcgColor(value)) throw new TypeError("STARTER_COLOR_INVALID");
  const components = value.components as readonly number[];
  const encoded = components
    .map((component) =>
      Math.round(component * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
  const alpha = value.alpha;
  if (alpha === undefined || alpha === 1) return `#${encoded}`;
  return `#${encoded}${Math.round((alpha as number) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function isDtcgDimension(
  value: unknown,
  pxMinimum: number,
  pxMaximum: number,
  remMinimum: number,
  remMaximum: number,
): value is Exclude<StarterVisualDimension, number> {
  if (!isPlainRecord(value) || !Object.hasOwn(value, "unit") || !Object.hasOwn(value, "value"))
    return false;
  if (Object.keys(value).some((key) => key !== "unit" && key !== "value")) return false;
  if (value.unit === "px") return isFiniteNumber(value.value, pxMinimum, pxMaximum);
  if (value.unit === "rem") return isFiniteNumber(value.value, remMinimum, remMaximum);
  return false;
}

function isStyleDimension(
  value: unknown,
  pxMinimum: number,
  pxMaximum: number,
  remMinimum: number,
  remMaximum: number,
): value is StarterVisualDimension {
  return (
    isFiniteNumber(value, pxMinimum, pxMaximum) ||
    isDtcgDimension(value, pxMinimum, pxMaximum, remMinimum, remMaximum)
  );
}

/** Serializes only a finite numeric px value or an admitted DTCG px/rem dimension. */
export function starterDimensionToCss(value: StarterVisualDimension): number | string {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!isDtcgDimension(value, -4_096, 4_096, -256, 256))
    throw new TypeError("STARTER_DIMENSION_INVALID");
  return `${value.value}${value.unit}`;
}

function isDtcgFontFamily(value: unknown): boolean {
  const isSafeFamily = (candidate: unknown): candidate is string =>
    typeof candidate === "string" &&
    STARTER_DTCG_FONT_FAMILIES.includes(candidate as (typeof STARTER_DTCG_FONT_FAMILIES)[number]);
  return (
    isSafeFamily(value) ||
    (Array.isArray(value) &&
      value.length >= 1 &&
      value.length <= 3 &&
      value.every((candidate) => isSafeFamily(candidate)))
  );
}

function dtcgFontWeightToCss(value: unknown): number | undefined {
  if (isInteger(value, 1, 1_000)) return value;
  if (value === "hairline" || value === "thin") return 100;
  if (value === "extra-light" || value === "ultra-light") return 200;
  if (value === "light") return 300;
  if (value === "book" || value === "normal" || value === "regular") return 400;
  if (value === "medium") return 500;
  if (value === "demi-bold" || value === "semi-bold") return 600;
  if (value === "bold") return 700;
  if (value === "extra-bold" || value === "ultra-bold") return 800;
  if (value === "black" || value === "heavy" || value === "extra-black" || value === "ultra-black")
    return 900;
  return undefined;
}

function dtcgFontFamilyToCss(value: string | readonly string[]): string {
  const families = Array.isArray(value) ? value : [value];
  return families
    .map((family) => {
      if (family === "system") return "system-ui";
      if (family === "serif") return "ui-serif";
      if (family === "mono") return "ui-monospace";
      return family;
    })
    .join(", ");
}

/** Exact resolved DTCG typography literal accepted by the bounded Web profile. */
export function isStarterTypography(value: unknown): value is StarterTypography {
  return (
    isPlainRecord(value) &&
    isDtcgFontFamily(value.fontFamily) &&
    isDtcgDimension(value.fontSize, 8, 160, 0.5, 10) &&
    dtcgFontWeightToCss(value.fontWeight) !== undefined &&
    isDtcgDimension(value.letterSpacing, -8, 32, -0.5, 2) &&
    isFiniteNumber(value.lineHeight, 0.8, 3) &&
    Object.keys(value).length === 5 &&
    Object.keys(value).every(
      (key) =>
        key === "fontFamily" ||
        key === "fontSize" ||
        key === "fontWeight" ||
        key === "letterSpacing" ||
        key === "lineHeight",
    )
  );
}

/** Explicitly projects an admitted DTCG typography composite without accepting font CSS text. */
export function starterTypographyToCss(value: StarterTypography): Readonly<{
  readonly fontFamily: string;
  readonly fontSize: number | string;
  readonly fontWeight: number;
  readonly letterSpacing: number | string;
  readonly lineHeight: number;
}> {
  if (!isStarterTypography(value)) throw new TypeError("STARTER_TYPOGRAPHY_INVALID");
  const fontWeight = dtcgFontWeightToCss(value.fontWeight);
  if (fontWeight === undefined) throw new TypeError("STARTER_TYPOGRAPHY_INVALID");
  return Object.freeze({
    fontFamily: dtcgFontFamilyToCss(value.fontFamily as string | readonly string[]),
    fontSize: starterDimensionToCss(value.fontSize as StarterVisualDimension),
    fontWeight,
    letterSpacing: starterDimensionToCss(value.letterSpacing as StarterVisualDimension),
    lineHeight: value.lineHeight as number,
  });
}

/** Exact resolved DTCG border literal accepted by the bounded Web profile. */
export function isStarterBorder(value: unknown): value is StarterBorder {
  return (
    isPlainRecord(value) &&
    isDtcgColor(value.color) &&
    STARTER_BORDER_STYLES.includes(value.style as (typeof STARTER_BORDER_STYLES)[number]) &&
    isDtcgDimension(value.width, 0, 16, 0, 1) &&
    Object.keys(value).length === 3 &&
    Object.keys(value).every((key) => key === "color" || key === "style" || key === "width")
  );
}

/** Explicitly projects one admitted DTCG border composite to its three CSS-safe leaves. */
export function starterBorderToCss(value: StarterBorder): Readonly<{
  readonly borderColor: string;
  readonly borderStyle: string;
  readonly borderWidth: number | string;
}> {
  if (!isStarterBorder(value)) throw new TypeError("STARTER_BORDER_INVALID");
  return Object.freeze({
    borderColor: starterColorToCss(value.color as StarterVisualColor),
    borderStyle: value.style as string,
    borderWidth: starterDimensionToCss(value.width as StarterVisualDimension),
  });
}

function isLinearGradient(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value) || !isFiniteNumber(value.angle, 0, 360) || !Array.isArray(value.stops))
    return false;
  if (value.stops.length < 2 || value.stops.length > 4) return false;
  let priorPosition = -1;
  for (const stop of value.stops) {
    if (
      !isPlainRecord(stop) ||
      !isStarterVisualColor(stop.color) ||
      !isFiniteNumber(stop.position, 0, 100) ||
      stop.position < priorPosition ||
      Object.keys(stop).some((key) => key !== "color" && key !== "position")
    ) {
      return false;
    }
    priorPosition = stop.position;
  }
  return Object.keys(value).every((key) => key === "angle" || key === "stops");
}

function isStarterShadowLayer(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    isPlainRecord(value) &&
    isStarterVisualColor(value.color) &&
    isStyleDimension(value.offsetX, -128, 128, -8, 8) &&
    isStyleDimension(value.offsetY, -128, 128, -8, 8) &&
    isStyleDimension(value.blur, 0, 256, 0, 16) &&
    isStyleDimension(value.spread, -128, 128, -8, 8) &&
    (value.inset === undefined || typeof value.inset === "boolean") &&
    Object.keys(value).every(
      (key) =>
        key === "color" ||
        key === "offsetX" ||
        key === "offsetY" ||
        key === "blur" ||
        key === "spread" ||
        key === "inset",
    )
  );
}

/** Accepts one or up to four explicit bounded shadow layers, including a resolved DTCG shadow. */
export function isStarterBoxShadow(value: unknown): value is StarterBoxShadow {
  if (isStarterShadowLayer(value)) return true;
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 4 &&
    value.every((layer) => isStarterShadowLayer(layer))
  );
}

/** Verifies one resolved style leaf before it can reach the explicit Web style mapper. */
export function isStarterVisualStyleValue(
  profile: StarterVisualStyleProfile,
  property: string,
  value: unknown,
): boolean {
  if (!Object.hasOwn(PROFILE_PROPERTIES[profile], property)) return false;
  if (
    [
      "color",
      "backgroundColor",
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ].includes(property)
  )
    return isStarterVisualColor(value);
  if (property === "backgroundGradient") return isLinearGradient(value);
  if (property === "boxShadow") return isStarterBoxShadow(value);
  if (property === "border") return isStarterBorder(value);
  if (
    [
      "borderRadius",
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ].includes(property)
  )
    return isStyleDimension(value, 0, 128, 0, 8);
  if (
    [
      "borderWidth",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
    ].includes(property)
  )
    return isStyleDimension(value, 0, 16, 0, 1);
  if (property === "borderStyle")
    return STARTER_BORDER_STYLES.includes(value as (typeof STARTER_BORDER_STYLES)[number]);
  if (property === "opacity") return isFiniteNumber(value, 0, 1);
  if (property === "typography") return isStarterTypography(value);
  if (property === "fontFamily")
    return STARTER_FONT_FAMILIES.includes(value as (typeof STARTER_FONT_FAMILIES)[number]);
  if (property === "fontWeight")
    return [100, 200, 300, 400, 500, 600, 700, 800, 900].includes(value as number);
  if (property === "fontSize") return isStyleDimension(value, 8, 160, 0.5, 10);
  if (property === "lineHeight") return isFiniteNumber(value, 0.8, 3);
  if (property === "letterSpacing") return isStyleDimension(value, -8, 32, -0.5, 2);
  if (property === "textAlign")
    return ["start", "center", "end", "justify"].includes(value as string);
  if (property === "textDecoration")
    return ["none", "underline", "line-through", "overline"].includes(value as string);
  if (property === "fontStyle") return value === "normal" || value === "italic";
  if (property === "textTransform")
    return ["none", "uppercase", "lowercase", "capitalize"].includes(value as string);
  if (["width", "height"].includes(property))
    return isStyleDimension(value, 0, 4_096, 0, 256) || value === "fill" || value === "hug";
  if (["minWidth", "maxWidth", "minHeight", "maxHeight"].includes(property))
    return isStyleDimension(value, 0, 4_096, 0, 256);
  if (
    [
      "padding",
      "paddingBlock",
      "paddingInline",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ].includes(property)
  )
    return isStyleDimension(value, 0, 512, 0, 32);
  if (
    [
      "margin",
      "marginBlock",
      "marginInline",
      "marginTop",
      "marginRight",
      "marginBottom",
      "marginLeft",
    ].includes(property)
  )
    return isStyleDimension(value, -512, 512, -32, 32);
  if (property === "layoutMode") return value === "block" || value === "flex" || value === "grid";
  if (property === "flowDirection") return value === "row" || value === "column";
  if (property === "flowWrap") return value === "nowrap" || value === "wrap";
  if (property === "gridAutoFlow") return value === "row" || value === "column";
  if (property === "gridColumns") return isInteger(value, 1, 12);
  if (property === "flexGrow" || property === "flexShrink") return isFiniteNumber(value, 0, 12);
  if (["gap", "rowGap", "columnGap"].includes(property))
    return isStyleDimension(value, 0, 512, 0, 32);
  if (["overflow", "overflowX", "overflowY"].includes(property))
    return ["visible", "hidden", "auto", "scroll"].includes(value as string);
  if (property === "alignItems")
    return ["start", "center", "end", "stretch"].includes(value as string);
  if (property === "alignSelf")
    return ["auto", "start", "center", "end", "stretch"].includes(value as string);
  if (property === "justifyContent")
    return ["start", "center", "end", "between", "around", "evenly"].includes(value as string);
  if (property === "position")
    return value === "static" || value === "relative" || value === "absolute";
  if (
    ["insetTop", "insetRight", "insetBottom", "insetLeft", "translateX", "translateY"].includes(
      property,
    )
  )
    return isStyleDimension(value, -4_096, 4_096, -256, 256);
  if (property === "zIndex") return isInteger(value, -100, 100);
  if (property === "rotate") return isFiniteNumber(value, -180, 180);
  if (property === "scaleX" || property === "scaleY") return isFiniteNumber(value, 0.1, 4);
  if (property === "transformOrigin")
    return [
      "center",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
      "top-left",
    ].includes(value as string);
  return false;
}

/**
 * Checks a resolved visual literal against the exact adapter profile for one known starter capability.
 *
 * @returns `undefined` when `capabilityId` is not owned by this starter package. Callers can then
 *          leave a foreign Catalog's own schema authoritative. A boolean result is the same
 *          property-level guard used by the shared React adapter before CSS projection.
 */
export function isStarterCapabilityVisualStyleValue(
  capabilityId: string,
  property: string,
  value: unknown,
): boolean | undefined {
  const profile = starterVisualStyleProfileForCapability(capabilityId);
  return profile === undefined ? undefined : isStarterVisualStyleValue(profile, property, value);
}

/** Returns a CSS-safe linear-gradient string only from an already admitted structured value. */
export function starterLinearGradientToCss(value: Readonly<Record<string, unknown>>): string {
  if (!isLinearGradient(value)) throw new TypeError("STARTER_GRADIENT_INVALID");
  const stops = value.stops as readonly Readonly<Record<string, unknown>>[];
  return `linear-gradient(${value.angle}deg, ${stops
    .map((stop) => `${starterColorToCss(stop.color as StarterVisualColor)} ${stop.position}%`)
    .join(", ")})`;
}

/** Returns a CSS-safe box-shadow string only from one to four admitted bounded layers. */
export function starterBoxShadowToCss(value: StarterBoxShadow): string {
  if (!isStarterBoxShadow(value)) throw new TypeError("STARTER_SHADOW_INVALID");
  const layers = Array.isArray(value) ? value : [value];
  return layers
    .map(
      (layer) =>
        `${layer.inset === true ? "inset " : ""}${starterDimensionToCss(
          layer.offsetX as StarterVisualDimension,
        )} ${starterDimensionToCss(layer.offsetY as StarterVisualDimension)} ${starterDimensionToCss(
          layer.blur as StarterVisualDimension,
        )} ${starterDimensionToCss(layer.spread as StarterVisualDimension)} ${starterColorToCss(
          layer.color as StarterVisualColor,
        )}`,
    )
    .join(", ");
}
