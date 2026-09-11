import { admitDtcgTokenDocument } from "../src/token-document.js";

import type { DtcgTokenDocument, DtcgTokenDocumentAdmissionResult } from "../src/token-document.js";
import type { DtcgColorValue, DtcgTokenAlias, DtcgTypographyValue } from "../src/token-types.js";

const alias: DtcgTokenAlias = "{color.brand}";
void alias;

const color: DtcgColorValue = {
  colorSpace: "srgb",
  components: [0, 0.5, 1],
};
const typography: DtcgTypographyValue = {
  fontFamily: ["Inter", "sans-serif"],
  fontSize: { value: 16, unit: "px" },
  fontWeight: 400,
  letterSpacing: { value: 0, unit: "px" },
  lineHeight: 1.5,
};
void typography;

const result: DtcgTokenDocumentAdmissionResult = admitDtcgTokenDocument({
  color: { $type: "color", brand: { $value: color } },
});

// @ts-expect-error diagnostic source identity must remain a string at the public type boundary
admitDtcgTokenDocument({}, { id: "not-a-string" });

if (result.ok) {
  const document: DtcgTokenDocument = result.document;
  void document;

  // @ts-expect-error admitted token records are immutable
  result.tokens["color.brand"] = undefined;
  // @ts-expect-error admitted document members are recursively immutable
  result.document.color = null;
} else {
  const code: string = result.diagnostics[0].code;
  void code;

  // @ts-expect-error failures expose no partially admitted token record
  const partial = result.tokens;
  void partial;
}

// @ts-expect-error only sRGB belongs to the compile-time bounded color profile
const unsupportedColor: DtcgColorValue = { colorSpace: "display-p3", components: [0, 0, 0] };
void unsupportedColor;

// @ts-expect-error typography composites require all five DTCG members
const incompleteTypography: DtcgTypographyValue = {
  fontFamily: "Inter",
  fontSize: { value: 16, unit: "px" },
};
void incompleteTypography;
