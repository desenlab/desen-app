import {
  REFERENCE_TOKEN_DOCUMENT,
  REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
  REFERENCE_WEB_TOKEN_CSS_REFERENCES,
  REFERENCE_WEB_TOKEN_PROVIDER,
  REFERENCE_WEB_TOKEN_VALUES,
  resolveReferenceWebToken,
} from "../src/tokens/index.js";

import type { CSSProperties } from "react";
import type {
  DtcgReferenceAlias,
  DtcgReferenceColorValue,
  DtcgReferenceDimensionValue,
  ReferenceWebTokenCssProperty,
  ReferenceWebTokenCssReference,
  ReferenceWebTokenPath,
  ReferenceWebTokenResolution,
} from "../src/tokens/index.js";

const tokenPath: ReferenceWebTokenPath = "color.action.primary";
const cssProperty: ReferenceWebTokenCssProperty = "--desen-color-action-primary";
const cssReference: ReferenceWebTokenCssReference = "var(--desen-color-action-primary, #1d4ed8)";
const alias: DtcgReferenceAlias = "{color.action.primary}";
const color: DtcgReferenceColorValue = {
  colorSpace: "srgb",
  components: [29 / 255, 78 / 255, 216 / 255],
  alpha: 1,
  hex: "#1d4ed8",
};
const dimension: DtcgReferenceDimensionValue = { value: 1, unit: "rem" };
const resolution: ReferenceWebTokenResolution = resolveReferenceWebToken(tokenPath);
const hostRootStyle: CSSProperties = REFERENCE_WEB_TOKEN_CSS_PROPERTIES;
if (resolution.ok) {
  const narrowedPath: ReferenceWebTokenPath = resolution.token;
  const narrowedProperty: ReferenceWebTokenCssProperty = resolution.cssProperty;
  void narrowedPath;
  void narrowedProperty;
} else {
  const code: "UNKNOWN_TOKEN" = resolution.code;
  void code;
}
void cssProperty;
void cssReference;
void alias;
void color;
void dimension;
void hostRootStyle;

// @ts-expect-error M03-T07-N01 The reference provider exposes only its closed token inventory.
const unknownTokenPath: ReferenceWebTokenPath = "color.brand.primary";
void unknownTokenPath;

// @ts-expect-error M03-T07-N02 CSS custom properties remain tied to the closed token inventory.
const unknownCssProperty: ReferenceWebTokenCssProperty = "--desen-color-brand";
void unknownCssProperty;

// @ts-expect-error M03-T07-N03 CSS references must use a declared reference custom property.
const unknownCssReference: ReferenceWebTokenCssReference = "var(--brand-color)";
void unknownCssReference;

// @ts-expect-error M03-T07-N04 Color components are readonly.
color.components[0] = 1;

// @ts-expect-error M03-T07-N05 Dimensions admit only the DTCG px and rem units.
const invalidDimension: DtcgReferenceDimensionValue = { value: 1, unit: "em" };
void invalidDimension;

// @ts-expect-error M03-T07-N06 The authoritative DTCG document is recursively readonly.
REFERENCE_TOKEN_DOCUMENT.space.md.$value.value = 999;

// @ts-expect-error M03-T07-N07 Resolved token values cannot be reassigned by consumers.
REFERENCE_WEB_TOKEN_VALUES["space.md"] = "999rem";

// @ts-expect-error M03-T07-N08 CSS provider properties cannot be reassigned by consumers.
REFERENCE_WEB_TOKEN_CSS_PROPERTIES["--desen-space-md"] = "999rem";

// @ts-expect-error M03-T07-N09 CSS references cannot be reassigned by consumers.
REFERENCE_WEB_TOKEN_CSS_REFERENCES["space.md"] = "var(--desen-space-lg)";

// @ts-expect-error M03-T07-N10 The immutable provider cannot be given a replacement resolver.
REFERENCE_WEB_TOKEN_PROVIDER.resolve = () => ({
  ok: false,
  code: "UNKNOWN_TOKEN",
  token: "forged",
});
