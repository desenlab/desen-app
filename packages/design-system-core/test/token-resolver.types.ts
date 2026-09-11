import { resolveDesignTokens } from "../src/token-resolver.js";
import { DESIGN_TOKEN_PROFILE } from "../src/token-types.js";

import type {
  DesignTokenLiteralOverride,
  DesignTokenResolutionRequest,
  ResolvedDesignToken,
} from "../src/token-resolver.js";
import type { EditableProjectRecord } from "../src/project-record.js";
import type { DtcgColorValue, DtcgLiteralValueByType, DtcgTokenType } from "../src/token-types.js";

const color: DtcgColorValue = {
  colorSpace: "srgb",
  components: [0, 0.5, 1],
};
const override: DesignTokenLiteralOverride = {
  path: "color.brand",
  type: "color",
  value: color,
};
const request: DesignTokenResolutionRequest = {
  sources: [{ id: "base", document: { color: { $type: "color", $value: color } } }],
  literalOverrides: [override],
};
const result = resolveDesignTokens(request);

declare const project: EditableProjectRecord;
const projectResolution = resolveDesignTokens({ sources: project.designSystem.tokenSources });
void projectResolution;

const type: DtcgTokenType = DESIGN_TOKEN_PROFILE.tokenTypes[0] ?? "color";
void type;

const mappedColor: DtcgLiteralValueByType["color"] = color;
void mappedColor;

if (result.ok) {
  const token: ResolvedDesignToken | undefined = result.tokens["color.brand"];
  void token;

  // @ts-expect-error resolved token maps are immutable
  result.tokens["color.brand"] = token;
  // @ts-expect-error source identity order is immutable
  result.sourceIds.push("mode");
} else {
  // @ts-expect-error failures expose no partial token map
  const partial = result.tokens;
  void partial;
}

// @ts-expect-error a color override requires a color literal
const invalidColorOverride: DesignTokenLiteralOverride = {
  path: "color.brand",
  type: "color",
  value: 1,
};
void invalidColorOverride;

// @ts-expect-error profile token types are immutable
DESIGN_TOKEN_PROFILE.tokenTypes.push("gradient");
