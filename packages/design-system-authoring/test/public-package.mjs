import assert from "node:assert/strict";
import test from "node:test";

import * as authoring from "@desen/design-system-authoring";

const expectedExports = [
  "DESEN_NEUTRAL_THEME_DOCUMENT",
  "THEME_AUTHORING_KIND",
  "THEME_AUTHORING_LIMITS",
  "THEME_AUTHORING_SCHEMA_VERSION",
  "admitThemeAuthoringDocument",
  "applyThemeAuthoringEdit",
  "createThemeAuthoringSession",
  "exportThemeAuthoringDocument",
  "importThemeAuthoringDocument",
  "redoThemeAuthoringEdit",
  "selectThemeAuthoringMode",
  "undoThemeAuthoringEdit",
];

test("the built package exposes only the reviewed T03 authoring surface", () => {
  assert.deepEqual(Object.keys(authoring).sort(), expectedExports);
  assert.equal(authoring.THEME_AUTHORING_KIND, "desen.theme-authoring");
  assert.equal(authoring.THEME_AUTHORING_SCHEMA_VERSION, 1);
});

test("the built package edits, previews, undoes, exports and reimports Neutral", () => {
  const created = authoring.createThemeAuthoringSession(authoring.DESEN_NEUTRAL_THEME_DOCUMENT);
  assert.equal(created.ok, true);
  if (!created.ok) throw new TypeError(created.diagnostics[0].message);
  assert.equal(created.session.preview.ok, true);

  const edited = authoring.applyThemeAuthoringEdit(created.session, {
    kind: "set-literal",
    path: "palette.action",
    sourceId: "neutral.light",
    themeId: "desen-neutral",
    type: "color",
    value: { colorSpace: "srgb", components: [0.25, 0.5, 0.75] },
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new TypeError(edited.diagnostics[0].message);
  assert.deepEqual(
    edited.session.preview.tokens["color.action"].value.components,
    [0.25, 0.5, 0.75],
  );

  const undone = authoring.undoThemeAuthoringEdit(edited.session);
  assert.equal(undone.ok, true);
  if (!undone.ok) throw new TypeError(undone.diagnostics[0].message);
  const redone = authoring.redoThemeAuthoringEdit(undone.session);
  assert.equal(redone.ok, true);
  if (!redone.ok) throw new TypeError(redone.diagnostics[0].message);

  const exported = authoring.exportThemeAuthoringDocument(redone.session);
  const reimported = authoring.importThemeAuthoringDocument(redone.session, exported.text);
  assert.deepEqual(reimported, { changed: false, ok: true, session: redone.session });
  assert.deepEqual(exported.report.losses, []);
});

test("the built package creates tokens and restores structural mode selection", () => {
  const created = authoring.createThemeAuthoringSession(authoring.DESEN_NEUTRAL_THEME_DOCUMENT);
  if (!created.ok) throw new TypeError(created.diagnostics[0].message);
  const literal = authoring.applyThemeAuthoringEdit(created.session, {
    kind: "create-literal",
    path: "spacing.public-proof",
    sourceId: "neutral.base",
    themeId: "desen-neutral",
    type: "dimension",
    value: { unit: "px", value: 10 },
  });
  assert.equal(literal.ok, true);
  if (!literal.ok) throw new TypeError(literal.diagnostics[0].message);
  const duplicated = authoring.applyThemeAuthoringEdit(literal.session, {
    fromModeId: "light",
    kind: "duplicate-mode",
    modeId: "public-proof",
    name: "Public proof",
    themeId: "desen-neutral",
  });
  assert.equal(duplicated.ok, true);
  if (!duplicated.ok) throw new TypeError(duplicated.diagnostics[0].message);
  assert.deepEqual(duplicated.session.selection, {
    modeId: "public-proof",
    themeId: "desen-neutral",
  });

  const undone = authoring.undoThemeAuthoringEdit(duplicated.session);
  assert.equal(undone.ok, true);
  if (!undone.ok) throw new TypeError(undone.diagnostics[0].message);
  assert.deepEqual(undone.session.selection, { modeId: "light", themeId: "desen-neutral" });
  assert.equal(undone.session.preview.tokens["spacing.public-proof"].value.value, 10);
  const redone = authoring.redoThemeAuthoringEdit(undone.session);
  assert.equal(redone.ok, true);
  if (!redone.ok) throw new TypeError(redone.diagnostics[0].message);
  assert.deepEqual(redone.session.selection, {
    modeId: "public-proof",
    themeId: "desen-neutral",
  });
});

test("invalid built-package imports retain the exact working session", () => {
  const created = authoring.createThemeAuthoringSession(authoring.DESEN_NEUTRAL_THEME_DOCUMENT);
  if (!created.ok) throw new TypeError(created.diagnostics[0].message);
  const rejected = authoring.importThemeAuthoringDocument(created.session, '{"kind":1,"kind":2}');
  assert.equal(rejected.ok, false);
  assert.equal(rejected.session, created.session);
});

test("the built package preserves and discloses a validated opaque standard token", () => {
  const document = {
    kind: "desen.theme-authoring",
    schemaVersion: 1,
    themes: [
      {
        base: {
          document: { family: { $type: "fontFamily", $value: ["Inter", "sans-serif"] } },
          id: "public.base",
        },
        id: "public-theme",
        modes: [
          {
            id: "mode",
            name: "Mode",
            source: {
              document: { marker: { $type: "number", $value: 0 } },
              id: "public.mode",
            },
          },
        ],
        name: "Public theme",
      },
    ],
  };
  const created = authoring.createThemeAuthoringSession(document);
  assert.equal(created.ok, true);
  if (!created.ok) throw new TypeError(created.diagnostics[0].message);
  assert.equal(created.session.preview.ok, false);

  const exported = authoring.exportThemeAuthoringDocument(created.session);
  assert.deepEqual(
    exported.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
      featureId,
      diagnostic.code,
      diagnostic.pointer,
    ]),
    [["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/family/$type"]],
  );
  assert.deepEqual(
    JSON.parse(exported.text).themes[0].base.document,
    document.themes[0].base.document,
  );
  assert.deepEqual(authoring.importThemeAuthoringDocument(created.session, exported.text), {
    changed: false,
    ok: true,
    session: created.session,
  });

  const malformed = JSON.parse(JSON.stringify(document));
  malformed.themes[0].base.document = { gradient: { $type: "gradient", $value: [] } };
  const rejected = authoring.importThemeAuthoringDocument(
    created.session,
    JSON.stringify(malformed),
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.session, created.session);
  assert.deepEqual(rejected.diagnostics[0].cause, {
    classification: "INVALID_DTCG",
    code: "INVALID_DTCG_VALUE",
    message: "gradient must be an array of reviewed stop objects.",
    pointer: "/gradient/$value",
    sourceId: "public.base",
    tokenPath: "gradient",
  });
});
