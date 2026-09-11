import {
  DESEN_NEUTRAL_THEME_DOCUMENT,
  applyThemeAuthoringEdit,
  createThemeAuthoringSession,
} from "@desen/design-system-authoring";

import type {
  ThemeAuthoringCompatibilityFeatureId,
  ThemeAuthoringEdit,
  ThemeAuthoringSession,
  ThemeAuthoringTransitionResult,
  ThemeAuthoringUnsupportedFeature,
} from "@desen/design-system-authoring";

const created = createThemeAuthoringSession(DESEN_NEUTRAL_THEME_DOCUMENT);
if (created.ok) {
  const session: ThemeAuthoringSession = created.session;
  const edit: ThemeAuthoringEdit = {
    kind: "set-literal",
    path: "palette.action",
    sourceId: "neutral.light",
    themeId: "desen-neutral",
    type: "color",
    value: { colorSpace: "srgb", components: [0, 0, 0] },
  };
  const result: ThemeAuthoringTransitionResult = applyThemeAuthoringEdit(session, edit);
  void result;

  // @ts-expect-error sessions expose immutable history
  session.past.push(session.document);
}

const invalidColor: ThemeAuthoringEdit = {
  kind: "set-literal",
  path: "palette.action",
  sourceId: "neutral.light",
  themeId: "desen-neutral",
  type: "color",
  // @ts-expect-error color controls require a DTCG color literal
  value: 1,
};
void invalidColor;

const featureId: ThemeAuthoringCompatibilityFeatureId = "ADDITIONAL_TOKEN_TYPES";
const unsupportedFeature = {} as ThemeAuthoringUnsupportedFeature;
void featureId;
void unsupportedFeature.featureId;
