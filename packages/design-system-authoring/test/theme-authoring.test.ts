import { describe, expect, it } from "vitest";

import { DESIGN_TOKEN_PROFILE } from "@desen/design-system-core";
import {
  DESEN_NEUTRAL_THEME_DOCUMENT,
  THEME_AUTHORING_LIMITS,
  admitThemeAuthoringDocument,
  applyThemeAuthoringEdit,
  createThemeAuthoringSession,
  exportThemeAuthoringDocument,
  importThemeAuthoringDocument,
  redoThemeAuthoringEdit,
  selectThemeAuthoringMode,
  undoThemeAuthoringEdit,
} from "../src/index.js";

import type { DtcgColorValue, DtcgTypographyValue } from "@desen/design-system-core";
import type { ThemeAuthoringSession } from "../src/index.js";

function session(): ThemeAuthoringSession {
  const result = createThemeAuthoringSession(DESEN_NEUTRAL_THEME_DOCUMENT);
  if (!result.ok) throw new TypeError(JSON.stringify(result.diagnostics[0]));
  return result.session;
}

function color(red: number, green: number, blue: number): DtcgColorValue {
  return { colorSpace: "srgb", components: [red, green, blue] };
}

function resolvedColor(current: ThemeAuthoringSession, path: string): DtcgColorValue {
  if (!current.preview.ok) throw new TypeError(current.preview.diagnostics[0].message);
  return current.preview.tokens[path]?.value as DtcgColorValue;
}

function relativeLuminance(colorValue: DtcgColorValue): number {
  const linear = colorValue.components.map((component) =>
    component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(left: DtcgColorValue, right: DtcgColorValue): number {
  const light = Math.max(relativeLuminance(left), relativeLuminance(right));
  const dark = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (light + 0.05) / (dark + 0.05);
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function mutableTestObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function oneModeDocument(base: Record<string, unknown>, mode: Record<string, unknown>) {
  return {
    kind: "desen.theme-authoring",
    schemaVersion: 1,
    themes: [
      {
        base: { document: base, id: "test.base" },
        id: "test-theme",
        modes: [
          {
            id: "mode",
            name: "Mode",
            source: { document: mode, id: "test.mode" },
          },
        ],
        name: "Test theme",
      },
    ],
  };
}

function assertDeepFrozen(root: unknown): void {
  const pending = [root];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

describe("theme authoring", () => {
  it("ships an editable Neutral light/dark foundation with live alias-aware controls", () => {
    const current = session();
    expect(current.selection).toEqual({ themeId: "desen-neutral", modeId: "light" });
    expect(current.preview.ok).toBe(true);
    if (!current.preview.ok) throw new TypeError("Expected a resolved preview.");
    expect(current.preview.tokenPaths).toHaveLength(45);
    expect(current.preview.sourceIds).toEqual(["neutral.base", "neutral.light"]);
    expect(current.preview.tokens["color.action"]?.aliasChain).toEqual(["palette.action"]);
    expect(current.preview.controls.find(({ path }) => path === "color.action")).toMatchObject({
      aliasTarget: "palette.action",
      family: "color",
      kind: "alias",
      sourceId: "neutral.base",
    });
    expect(current.preview.controls.find(({ path }) => path === "typography.body")).toMatchObject({
      family: "typography",
      kind: "literal",
      sourceId: "neutral.base",
    });
    assertDeepFrozen(current);

    const dark = selectThemeAuthoringMode(current, { themeId: "desen-neutral", modeId: "dark" });
    expect(dark.ok).toBe(true);
    if (!dark.ok) throw new TypeError(dark.diagnostics[0].message);
    expect(dark.session.preview.ok).toBe(true);
    expect(resolvedColor(dark.session, "color.canvas").components[0]).toBeCloseTo(0.0392156863);
    expect(current.selection.modeId).toBe("light");
    expect(dark.session.past).toEqual([]);
  });

  it("keeps both Neutral defaults legible and gives focus a separate two-pixel signal", () => {
    let current = session();
    for (const modeId of ["light", "dark"] as const) {
      const selected = selectThemeAuthoringMode(current, { themeId: "desen-neutral", modeId });
      if (!selected.ok) throw new TypeError(selected.diagnostics[0].message);
      current = selected.session;
      expect(
        contrast(
          resolvedColor(current, "color.foreground"),
          resolvedColor(current, "color.canvas"),
        ),
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrast(resolvedColor(current, "color.muted"), resolvedColor(current, "color.surface")),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(resolvedColor(current, "color.action"), resolvedColor(current, "color.onAction")),
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrast(resolvedColor(current, "color.focus"), resolvedColor(current, "color.canvas")),
      ).toBeGreaterThanOrEqual(3);
      if (!current.preview.ok) throw new TypeError(current.preview.diagnostics[0].message);
      expect(current.preview.tokens["stroke.default"]?.value).toEqual({ unit: "px", value: 1 });
      expect(current.preview.tokens["stroke.focus"]?.value).toEqual({ unit: "px", value: 2 });
    }
  });

  it("edits arbitrary supported colors and composite typography with bounded undo/redo", () => {
    const initial = session();
    const changedColor = color(0.12, 0.34, 0.56);
    const colorEdit = applyThemeAuthoringEdit(initial, {
      kind: "set-literal",
      path: "palette.action",
      sourceId: "neutral.light",
      themeId: "desen-neutral",
      type: "color",
      value: changedColor,
    });
    expect(colorEdit.ok).toBe(true);
    if (!colorEdit.ok) throw new TypeError(colorEdit.diagnostics[0].message);
    expect(resolvedColor(colorEdit.session, "color.action")).toEqual(changedColor);
    expect(colorEdit.session.past).toHaveLength(1);

    const typography: DtcgTypographyValue = {
      fontFamily: ["Avenir Next", "system-ui"],
      fontSize: { unit: "px", value: 20 },
      fontWeight: 525,
      letterSpacing: { unit: "px", value: 0.25 },
      lineHeight: 1.35,
    };
    const typeEdit = applyThemeAuthoringEdit(colorEdit.session, {
      kind: "set-literal",
      path: "typography.body",
      sourceId: "neutral.base",
      themeId: "desen-neutral",
      type: "typography",
      value: typography,
    });
    expect(typeEdit.ok).toBe(true);
    if (!typeEdit.ok) throw new TypeError(typeEdit.diagnostics[0].message);
    expect(
      typeEdit.session.preview.ok && typeEdit.session.preview.tokens["typography.body"]?.value,
    ).toEqual(typography);

    const undone = undoThemeAuthoringEdit(typeEdit.session);
    expect(undone.ok).toBe(true);
    if (!undone.ok) throw new TypeError(undone.diagnostics[0].message);
    expect(undone.session.document).toBe(colorEdit.session.document);
    const redone = redoThemeAuthoringEdit(undone.session);
    expect(redone.ok).toBe(true);
    if (!redone.ok) throw new TypeError(redone.diagnostics[0].message);
    expect(redone.session.document).toBe(typeEdit.session.document);
    expect(initial.revision).toBe(0);

    const selectedDark = selectThemeAuthoringMode(typeEdit.session, {
      modeId: "dark",
      themeId: "desen-neutral",
    });
    if (!selectedDark.ok) throw new TypeError(selectedDark.diagnostics[0].message);
    const undoneAfterSelection = undoThemeAuthoringEdit(selectedDark.session);
    if (!undoneAfterSelection.ok) throw new TypeError(undoneAfterSelection.diagnostics[0].message);
    expect(undoneAfterSelection.session.selection).toEqual({
      modeId: "dark",
      themeId: "desen-neutral",
    });
    const redoneAfterSelection = redoThemeAuthoringEdit(undoneAfterSelection.session);
    if (!redoneAfterSelection.ok) throw new TypeError(redoneAfterSelection.diagnostics[0].message);
    expect(redoneAfterSelection.session.selection).toEqual({
      modeId: "dark",
      themeId: "desen-neutral",
    });
  });

  it("undoes and redoes an imported document together with its exact selection", () => {
    const dark = selectThemeAuthoringMode(session(), {
      modeId: "dark",
      themeId: "desen-neutral",
    });
    if (!dark.ok) throw new TypeError(dark.diagnostics[0].message);
    const other = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const otherTheme = other.themes[0];
    if (otherTheme === undefined) throw new TypeError("Expected Neutral.");
    (otherTheme as { id: string }).id = "other";
    const imported = importThemeAuthoringDocument(dark.session, JSON.stringify(other));
    if (!imported.ok) throw new TypeError(imported.diagnostics[0].message);
    expect(imported.session.selection).toEqual({ modeId: "light", themeId: "other" });

    const undone = undoThemeAuthoringEdit(imported.session);
    if (!undone.ok) throw new TypeError(undone.diagnostics[0].message);
    expect(undone.session.document).toBe(dark.session.document);
    expect(undone.session.selection).toEqual({ modeId: "dark", themeId: "desen-neutral" });

    const redone = redoThemeAuthoringEdit(undone.session);
    if (!redone.ok) throw new TypeError(redone.diagnostics[0].message);
    expect(redone.session.document).toBe(imported.session.document);
    expect(redone.session.selection).toEqual({ modeId: "light", themeId: "other" });
  });

  it("edits whole-token aliases and rejects broken all-mode graphs atomically", () => {
    const initial = session();
    const alias = applyThemeAuthoringEdit(initial, {
      kind: "set-alias",
      path: "color.action",
      sourceId: "neutral.base",
      targetPath: "palette.muted",
      themeId: "desen-neutral",
      type: "color",
    });
    expect(alias.ok).toBe(true);
    if (!alias.ok) throw new TypeError(alias.diagnostics[0].message);
    expect(resolvedColor(alias.session, "color.action")).toEqual(
      resolvedColor(alias.session, "color.muted"),
    );

    const rejected = applyThemeAuthoringEdit(alias.session, {
      kind: "set-alias",
      path: "color.action",
      sourceId: "neutral.base",
      targetPath: "palette.does-not-exist",
      themeId: "desen-neutral",
      type: "color",
    });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) throw new TypeError("Expected a rejected alias.");
    expect(rejected.diagnostics[0].code).toBe("TOKEN_EDIT_REJECTED");
    expect(rejected.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");
    expect(rejected.session).toBe(alias.session);
  });

  it("authors named themes, modes, literal tokens, and aliases without raw JSON", () => {
    const initial = session();
    const literal = applyThemeAuthoringEdit(initial, {
      kind: "create-literal",
      path: "palette.brand",
      sourceId: "neutral.base",
      themeId: "desen-neutral",
      type: "color",
      value: color(0.125, 0.375, 0.875),
    });
    expect(literal.ok).toBe(true);
    if (!literal.ok) throw new TypeError(literal.diagnostics[0].message);
    expect(resolvedColor(literal.session, "palette.brand")).toEqual(color(0.125, 0.375, 0.875));

    const alias = applyThemeAuthoringEdit(literal.session, {
      kind: "create-alias",
      path: "color.brand",
      sourceId: "neutral.base",
      targetPath: "palette.brand",
      themeId: "desen-neutral",
      type: "color",
    });
    expect(alias.ok).toBe(true);
    if (!alias.ok) throw new TypeError(alias.diagnostics[0].message);
    expect(resolvedColor(alias.session, "color.brand")).toEqual(color(0.125, 0.375, 0.875));

    const deletedAlias = applyThemeAuthoringEdit(alias.session, {
      kind: "delete-token",
      path: "color.brand",
      sourceId: "neutral.base",
      themeId: "desen-neutral",
    });
    expect(deletedAlias.ok).toBe(true);
    if (!deletedAlias.ok) throw new TypeError(deletedAlias.diagnostics[0].message);

    const duplicateMode = applyThemeAuthoringEdit(deletedAlias.session, {
      fromModeId: "light",
      kind: "duplicate-mode",
      modeId: "contrast",
      name: "High contrast",
      themeId: "desen-neutral",
    });
    expect(duplicateMode.ok).toBe(true);
    if (!duplicateMode.ok) throw new TypeError(duplicateMode.diagnostics[0].message);
    expect(duplicateMode.session.selection).toEqual({
      modeId: "contrast",
      themeId: "desen-neutral",
    });
    expect(duplicateMode.session.document.themes[0]?.modes).toHaveLength(3);

    const renamedMode = applyThemeAuthoringEdit(duplicateMode.session, {
      kind: "rename-mode",
      modeId: "contrast",
      name: "Accessible contrast",
      themeId: "desen-neutral",
    });
    expect(renamedMode.ok).toBe(true);
    if (!renamedMode.ok) throw new TypeError(renamedMode.diagnostics[0].message);
    expect(renamedMode.session.document.themes[0]?.modes[2]?.name).toBe("Accessible contrast");

    const deletedMode = applyThemeAuthoringEdit(renamedMode.session, {
      kind: "delete-mode",
      modeId: "contrast",
      themeId: "desen-neutral",
    });
    expect(deletedMode.ok).toBe(true);
    if (!deletedMode.ok) throw new TypeError(deletedMode.diagnostics[0].message);
    expect(deletedMode.session.selection).toEqual({ modeId: "light", themeId: "desen-neutral" });

    const duplicateTheme = applyThemeAuthoringEdit(deletedMode.session, {
      fromThemeId: "desen-neutral",
      kind: "duplicate-theme",
      name: "Brand system",
      themeId: "brand",
    });
    expect(duplicateTheme.ok).toBe(true);
    if (!duplicateTheme.ok) throw new TypeError(duplicateTheme.diagnostics[0].message);
    expect(duplicateTheme.session.selection).toEqual({ modeId: "light", themeId: "brand" });
    expect(duplicateTheme.session.document.themes[1]?.base.id).toBe("brand:base-source");

    const renamedTheme = applyThemeAuthoringEdit(duplicateTheme.session, {
      kind: "rename-theme",
      name: "Brand foundations",
      themeId: "brand",
    });
    expect(renamedTheme.ok).toBe(true);
    if (!renamedTheme.ok) throw new TypeError(renamedTheme.diagnostics[0].message);

    const deletedTheme = applyThemeAuthoringEdit(renamedTheme.session, {
      kind: "delete-theme",
      themeId: "desen-neutral",
    });
    expect(deletedTheme.ok).toBe(true);
    if (!deletedTheme.ok) throw new TypeError(deletedTheme.diagnostics[0].message);
    expect(deletedTheme.session.document.themes).toHaveLength(1);
    expect(deletedTheme.session.document.themes[0]?.name).toBe("Brand foundations");

    const existingPath = applyThemeAuthoringEdit(deletedTheme.session, {
      kind: "create-literal",
      path: "palette.brand",
      sourceId: "brand:base-source",
      themeId: "brand",
      type: "color",
      value: color(1, 0, 0),
    });
    expect(existingPath.ok).toBe(false);
    expect(existingPath.session).toBe(deletedTheme.session);
  });

  it("restores structural selections through undo and redo", () => {
    const initial = session();
    const duplicateMode = applyThemeAuthoringEdit(initial, {
      fromModeId: "light",
      kind: "duplicate-mode",
      modeId: "contrast",
      name: "Contrast",
      themeId: "desen-neutral",
    });
    if (!duplicateMode.ok) throw new TypeError(duplicateMode.diagnostics[0].message);
    expect(duplicateMode.session.selection).toEqual({
      modeId: "contrast",
      themeId: "desen-neutral",
    });
    const modeUndo = undoThemeAuthoringEdit(duplicateMode.session);
    if (!modeUndo.ok) throw new TypeError(modeUndo.diagnostics[0].message);
    expect(modeUndo.session.selection).toEqual({ modeId: "light", themeId: "desen-neutral" });
    const modeRedo = redoThemeAuthoringEdit(modeUndo.session);
    if (!modeRedo.ok) throw new TypeError(modeRedo.diagnostics[0].message);
    expect(modeRedo.session.selection).toEqual({
      modeId: "contrast",
      themeId: "desen-neutral",
    });

    const duplicateTheme = applyThemeAuthoringEdit(initial, {
      fromThemeId: "desen-neutral",
      kind: "duplicate-theme",
      name: "Brand",
      themeId: "brand",
    });
    if (!duplicateTheme.ok) throw new TypeError(duplicateTheme.diagnostics[0].message);
    expect(duplicateTheme.session.selection).toEqual({ modeId: "light", themeId: "brand" });
    const themeUndo = undoThemeAuthoringEdit(duplicateTheme.session);
    if (!themeUndo.ok) throw new TypeError(themeUndo.diagnostics[0].message);
    expect(themeUndo.session.selection).toEqual({ modeId: "light", themeId: "desen-neutral" });
    const themeRedo = redoThemeAuthoringEdit(themeUndo.session);
    if (!themeRedo.ok) throw new TypeError(themeRedo.diagnostics[0].message);
    expect(themeRedo.session.selection).toEqual({ modeId: "light", themeId: "brand" });
  });

  it("allocates bounded deterministic source identities for maximum-length duplicate ids", () => {
    const maximumThemeId = "a".repeat(THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits);
    const maximumNewThemeId = "b".repeat(THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits);
    const maximumModeId = "c".repeat(THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits);
    const input = oneModeDocument(
      { base: { $type: "number", $value: 1 } },
      { mode: { $type: "number", $value: 2 } },
    );
    const inputTheme = input.themes[0];
    if (inputTheme === undefined) throw new TypeError("Expected one test theme.");
    inputTheme.id = maximumThemeId;
    const created = createThemeAuthoringSession(input);
    if (!created.ok) throw new TypeError(created.diagnostics[0].message);

    const themeEdit = {
      fromThemeId: maximumThemeId,
      kind: "duplicate-theme" as const,
      name: "Maximum theme",
      themeId: maximumNewThemeId,
    };
    const firstThemeDuplicate = applyThemeAuthoringEdit(created.session, themeEdit);
    const secondThemeDuplicate = applyThemeAuthoringEdit(created.session, themeEdit);
    if (!firstThemeDuplicate.ok || !secondThemeDuplicate.ok) {
      throw new TypeError("Expected bounded deterministic theme duplication.");
    }
    expect(firstThemeDuplicate.session.document).toEqual(secondThemeDuplicate.session.document);
    const duplicatedTheme = firstThemeDuplicate.session.document.themes[1];
    if (duplicatedTheme === undefined) throw new TypeError("Expected the duplicated theme.");
    const duplicatedSourceIds = [
      duplicatedTheme.base.id,
      ...duplicatedTheme.modes.map((mode) => mode.source.id),
    ];
    expect(new Set(duplicatedSourceIds).size).toBe(duplicatedSourceIds.length);
    expect(
      duplicatedSourceIds.every((id) => id.length <= THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits),
    ).toBe(true);

    const modeDuplicate = applyThemeAuthoringEdit(created.session, {
      fromModeId: "mode",
      kind: "duplicate-mode",
      modeId: maximumModeId,
      name: "Maximum mode",
      themeId: maximumThemeId,
    });
    if (!modeDuplicate.ok) throw new TypeError(modeDuplicate.diagnostics[0].message);
    const createdMode = modeDuplicate.session.document.themes[0]?.modes[1];
    expect(createdMode?.source.id.length).toBeLessThanOrEqual(
      THEME_AUTHORING_LIMITS.maxIdentifierCodeUnits,
    );
  });

  it("atomically rejects deleting the final theme or mode", () => {
    const created = createThemeAuthoringSession(
      oneModeDocument(
        { base: { $type: "number", $value: 1 } },
        { mode: { $type: "number", $value: 2 } },
      ),
    );
    if (!created.ok) throw new TypeError(created.diagnostics[0].message);
    for (const edit of [
      { kind: "delete-theme", themeId: "test-theme" },
      { kind: "delete-mode", modeId: "mode", themeId: "test-theme" },
    ] as const) {
      const result = applyThemeAuthoringEdit(created.session, edit);
      expect(result.ok).toBe(false);
      expect(result.session).toBe(created.session);
    }
  });

  it("prunes empty token ancestors but never erases a required source root", () => {
    const initial = session();
    const createdToken = applyThemeAuthoringEdit(initial, {
      kind: "create-literal",
      path: "custom.only",
      sourceId: "neutral.base",
      themeId: "desen-neutral",
      type: "number",
      value: 1,
    });
    if (!createdToken.ok) throw new TypeError(createdToken.diagnostics[0].message);
    const deletedToken = applyThemeAuthoringEdit(createdToken.session, {
      kind: "delete-token",
      path: "custom.only",
      sourceId: "neutral.base",
      themeId: "desen-neutral",
    });
    if (!deletedToken.ok) throw new TypeError(deletedToken.diagnostics[0].message);
    expect(
      Object.hasOwn(deletedToken.session.document.themes[0]?.base.document ?? {}, "custom"),
    ).toBe(false);

    const singleToken = createThemeAuthoringSession(
      oneModeDocument(
        { only: { $type: "number", $value: 1 } },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    if (!singleToken.ok) throw new TypeError(singleToken.diagnostics[0].message);
    const rejected = applyThemeAuthoringEdit(singleToken.session, {
      kind: "delete-token",
      path: "only",
      sourceId: "test.base",
      themeId: "test-theme",
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.session).toBe(singleToken.session);
    if (rejected.ok) throw new TypeError("A source root cannot become an empty DTCG document.");
    expect(rejected.diagnostics[0].cause?.code).toBe("EMPTY_DTCG_GROUP");
  });

  it("round-trips deterministically and preserves disclosed unsupported standard data", () => {
    const initial = session();
    const firstExport = exportThemeAuthoringDocument(initial);
    const reimport = importThemeAuthoringDocument(initial, firstExport.text);
    expect(reimport).toEqual({ changed: false, ok: true, session: initial });

    const unsupported = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const dark = unsupported.themes[0]?.modes[1];
    const palette = dark?.source.document.palette;
    if (palette === null || typeof palette !== "object" || Array.isArray(palette)) {
      throw new TypeError("Expected the Neutral dark palette.");
    }
    const focus = (palette as Record<string, unknown>).focus;
    if (focus === null || typeof focus !== "object" || Array.isArray(focus)) {
      throw new TypeError("Expected the Neutral focus token.");
    }
    const value = (focus as Record<string, unknown>).$value;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Expected the Neutral focus color.");
    }
    (value as { colorSpace: string }).colorSpace = "display-p3";
    const imported = importThemeAuthoringDocument(initial, JSON.stringify(unsupported));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new TypeError(imported.diagnostics[0].message);
    const disclosure = exportThemeAuthoringDocument(imported.session);
    expect(disclosure.report.losses).toEqual([]);
    expect(disclosure.report.preservedUnsupportedFeatures).toHaveLength(1);
    expect(disclosure.report.preservedUnsupportedFeatures[0]).toMatchObject({
      modeId: "dark",
      preserved: true,
      sourceId: "neutral.dark",
      themeId: "desen-neutral",
    });
    expect(disclosure.text).toContain("display-p3");
    const selectedDark = selectThemeAuthoringMode(imported.session, {
      themeId: "desen-neutral",
      modeId: "dark",
    });
    expect(selectedDark.ok).toBe(true);
    if (!selectedDark.ok) throw new TypeError(selectedDark.diagnostics[0].message);
    expect(selectedDark.session.preview.ok).toBe(false);
    if (selectedDark.session.preview.ok)
      throw new TypeError("Unsupported data cannot become preview authority.");
    expect(selectedDark.session.preview.diagnostics[0].classification).toBe(
      "UNSUPPORTED_DTCG_FEATURE",
    );

    for (const [colorSpace, components] of [
      ["a98-rgb", [0, 0.5, 1]],
      ["display-p3", [1, 0, 0]],
      ["hsl", [359.99, 100, 0]],
      ["hwb", [0, 100, 100]],
      ["oklch", [0.6, 0.2, 200]],
      ["lab", [50, 0, 0]],
      ["lch", [50, 230, 359.99]],
      ["oklab", [0.5, -0.4, 0.4]],
      ["prophoto-rgb", [0, 0.5, 1]],
      ["rec2020", [0, 0.5, 1]],
      ["srgb-linear", [0, 0.5, 1]],
      ["xyz-d50", [0, 0.5, 1]],
      ["xyz-d65", [0, 0.5, 1]],
    ] as const) {
      const wideGamut = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
      const wideGamutDocument = wideGamut.themes[0]?.modes[1]?.source.document;
      if (wideGamutDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
      (wideGamutDocument as Record<string, unknown>).wideGamut = {
        $type: "color",
        $value: { colorSpace, components },
      };
      const wideGamutAdmission = admitThemeAuthoringDocument(wideGamut);
      expect(wideGamutAdmission.ok).toBe(true);
      if (!wideGamutAdmission.ok) throw new TypeError(wideGamutAdmission.diagnostics[0].message);
      expect(wideGamutAdmission.report.preservedUnsupportedFeatures).toHaveLength(1);
      expect(JSON.stringify(wideGamutAdmission.document)).toContain(colorSpace);
    }

    const wideGamutWithNone = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const wideGamutWithNoneDocument = wideGamutWithNone.themes[0]?.modes[1]?.source.document;
    if (wideGamutWithNoneDocument === undefined) {
      throw new TypeError("Expected the Neutral dark source.");
    }
    (wideGamutWithNoneDocument as Record<string, unknown>).wideWithNone = {
      $type: "color",
      $value: { colorSpace: "display-p3", components: ["none", 0.5, "none"] },
    };
    const wideGamutWithNoneAdmission = admitThemeAuthoringDocument(wideGamutWithNone);
    if (!wideGamutWithNoneAdmission.ok) {
      throw new TypeError(wideGamutWithNoneAdmission.diagnostics[0].message);
    }
    expect(wideGamutWithNoneAdmission.report.preservedUnsupportedFeatures).toHaveLength(3);
    expect(
      wideGamutWithNoneAdmission.report.preservedUnsupportedFeatures
        .map((feature) => feature.diagnostic.pointer)
        .toSorted(),
    ).toEqual(
      [
        "/wideWithNone/$value/colorSpace",
        "/wideWithNone/$value/components/0",
        "/wideWithNone/$value/components/2",
      ].toSorted(),
    );

    const unicode = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const unicodeTheme = unicode.themes[0];
    if (unicodeTheme === undefined) throw new TypeError("Expected Neutral.");
    (unicodeTheme as { name: string }).name = "DÉ SEN";
    const unicodeSession = createThemeAuthoringSession(unicode);
    if (!unicodeSession.ok) throw new TypeError(unicodeSession.diagnostics[0].message);
    const unicodeExport = exportThemeAuthoringDocument(unicodeSession.session);
    expect(unicodeExport.report.canonicalBytes).toBeGreaterThan(unicodeExport.text.length);

    const propertyAlias = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const typography = propertyAlias.themes[0]?.base.document.typography;
    if (typography === null || typeof typography !== "object" || Array.isArray(typography)) {
      throw new TypeError("Expected Neutral typography.");
    }
    const body = (typography as Record<string, unknown>).body;
    const bodyValue = mutableTestObject(mutableTestObject(body)?.$value);
    const fontSize = mutableTestObject(bodyValue?.fontSize);
    if (fontSize === undefined) throw new TypeError("Expected body font size.");
    fontSize.value = "{space.4}";
    const propertyAliasAdmission = admitThemeAuthoringDocument(propertyAlias);
    expect(propertyAliasAdmission.ok).toBe(false);
    if (propertyAliasAdmission.ok) throw new TypeError("Property aliases must fail closed.");
    expect(propertyAliasAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_VALUE");

    const embeddedAliasText = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const embeddedAliasSource = embeddedAliasText.themes[0]?.modes[1]?.source.document;
    if (embeddedAliasSource === undefined) throw new TypeError("Expected the Neutral dark source.");
    (embeddedAliasSource as Record<string, unknown>).embeddedAliasText = {
      $type: "number",
      $value: "prefix {opacity.disabled}",
    };
    const embeddedAliasAdmission = admitThemeAuthoringDocument(embeddedAliasText);
    expect(embeddedAliasAdmission.ok).toBe(false);
    if (embeddedAliasAdmission.ok) throw new TypeError("Embedded aliases must fail closed.");
    expect(embeddedAliasAdmission.diagnostics[0].cause?.code).toBe("UNSUPPORTED_PROPERTY_ALIAS");

    const unknownAliases = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const aliasSource = unknownAliases.themes[0]?.modes[1]?.source.document;
    if (aliasSource === undefined) throw new TypeError("Expected the Neutral dark source.");
    const mutableAliasSource = aliasSource as Record<string, unknown>;
    mutableAliasSource.gradientTarget = {
      $type: "gradient",
      $value: { stops: [] },
    };
    mutableAliasSource.aliasToGradient = {
      $type: "gradient",
      $value: "{gradientTarget}",
    };
    const unknownAliasAdmission = admitThemeAuthoringDocument(unknownAliases);
    expect(unknownAliasAdmission.ok).toBe(false);
    if (unknownAliasAdmission.ok) throw new TypeError("Unvalidated token types must fail closed.");
    expect(unknownAliasAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_VALUE");

    const inheritedAliasType = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const inheritedAliasDocument = inheritedAliasType.themes[0]?.modes[1]?.source.document;
    if (inheritedAliasDocument === undefined)
      throw new TypeError("Expected the Neutral dark source.");
    (inheritedAliasDocument as Record<string, unknown>).inheritedAlias = {
      $type: "number",
      alias: { $value: "{palette.action}" },
    };
    const inheritedAliasAdmission = admitThemeAuthoringDocument(inheritedAliasType);
    expect(inheritedAliasAdmission.ok).toBe(true);
    if (!inheritedAliasAdmission.ok)
      throw new TypeError(inheritedAliasAdmission.diagnostics[0].message);

    const futureMembers = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const futureDocument = futureMembers.themes[0]?.modes[1]?.source.document;
    if (futureDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    const mutableFutureDocument = futureDocument as Record<string, unknown>;
    mutableFutureDocument.$root = { $type: "number", $value: 1 };
    mutableFutureDocument.futureGroup = {
      $root: {
        $type: "color",
        $value: { colorSpace: "oklch", components: [0.6, 0.2, 200] },
      },
    };
    const futureAdmission = admitThemeAuthoringDocument(futureMembers);
    expect(futureAdmission.ok).toBe(true);
    if (!futureAdmission.ok) throw new TypeError(futureAdmission.diagnostics[0].message);
    expect(futureAdmission.report.preservedUnsupportedFeatures).toHaveLength(3);
    const futureColorFeature = futureAdmission.report.preservedUnsupportedFeatures.find(
      (feature) => feature.diagnostic.code === "UNSUPPORTED_COLOR_SPACE",
    );
    expect(futureColorFeature?.diagnostic).toMatchObject({
      pointer: "/futureGroup/$root/$value/colorSpace",
      tokenPath: "futureGroup.$root",
    });
    expect(
      futureAdmission.report.preservedUnsupportedFeatures
        .filter((feature) => feature.diagnostic.pointer.endsWith("/$root"))
        .map((feature) => feature.diagnostic.tokenPath),
    ).toEqual(["$root", "futureGroup.$root"]);

    const rootAliasAdmission = admitThemeAuthoringDocument(
      oneModeDocument(
        { crossSourceAlias: { $type: "number", $value: "{group.$root}" } },
        {
          group: { $root: { $type: "number", $value: 1 } },
          sameSourceAlias: { $type: "number", $value: "{group.$root}" },
        },
      ),
    );
    expect(rootAliasAdmission.ok).toBe(true);
    if (!rootAliasAdmission.ok) throw new TypeError(rootAliasAdmission.diagnostics[0].message);
    expect(rootAliasAdmission.report.preservedUnsupportedFeatures).toHaveLength(1);

    const topLevelRootAlias = admitThemeAuthoringDocument(
      oneModeDocument(
        { alias: { $type: "number", $value: "{$root}" } },
        { $root: { $type: "number", $value: 1 } },
      ),
    );
    if (!topLevelRootAlias.ok) throw new TypeError(topLevelRootAlias.diagnostics[0].message);
    expect(topLevelRootAlias.report.preservedUnsupportedFeatures[0]?.diagnostic.tokenPath).toBe(
      "$root",
    );

    const groupAliasIsNotRootAlias = admitThemeAuthoringDocument(
      oneModeDocument(
        { alias: { $type: "number", $value: "{group}" } },
        { group: { $root: { $type: "number", $value: 1 } } },
      ),
    );
    expect(groupAliasIsNotRootAlias.ok).toBe(false);
    if (groupAliasIsNotRootAlias.ok) throw new TypeError("A group path is not a $root token path.");
    expect(groupAliasIsNotRootAlias.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");

    const large = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    (large as { extensions?: unknown }).extensions = {
      bulk: Array.from({ length: 7_000 }, () => "x".repeat(40)),
    };
    const largeSession = createThemeAuthoringSession(large);
    if (!largeSession.ok) throw new TypeError(largeSession.diagnostics[0].message);
    const largeExport = exportThemeAuthoringDocument(largeSession.session);
    const largeReimport = importThemeAuthoringDocument(largeSession.session, largeExport.text);
    expect(largeReimport.ok).toBe(true);
    if (!largeReimport.ok) throw new TypeError(largeReimport.diagnostics[0].message);
    expect(exportThemeAuthoringDocument(largeReimport.session).text).toBe(largeExport.text);
  });

  it("never lets an unsupported feature mask a later invalid declaration", () => {
    const mixed = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const darkPalette = mixed.themes[0]?.modes[1]?.source.document.palette;
    if (darkPalette === null || typeof darkPalette !== "object" || Array.isArray(darkPalette)) {
      throw new TypeError("Expected the Neutral dark palette.");
    }
    const palette = darkPalette as Record<string, unknown>;
    palette.aaaUnsupported = {
      $type: "color",
      $value: { colorSpace: "oklch", components: [0.6, 0.2, 200] },
    };
    palette.zzzBroken = { $type: "color", $value: "{palette.does-not-exist}" };
    const admission = admitThemeAuthoringDocument(mixed);
    expect(admission.ok).toBe(false);
    if (admission.ok) throw new TypeError("Expected the hidden invalid alias to reject admission.");
    expect(admission.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");

    for (const [colorSpace, components] of [
      ["a98-rgb", [1.01, 0, 0]],
      ["display-p3", [2, 0, 0]],
      ["hsl", [360, 50, 50]],
      ["hwb", [-1, 50, 50]],
      ["lab", [100.01, 0, 0]],
      ["lch", [50, -0.01, 0]],
      ["oklab", [-0.01, 0, 0]],
      ["oklch", [0.5, 0.2, 360]],
      ["prophoto-rgb", [0, 0, 1.01]],
      ["rec2020", [0, -0.01, 0]],
      ["srgb-linear", [0, 0, 1.01]],
      ["xyz-d50", [1.01, 0, 0]],
      ["xyz-d65", [0, 1.01, 0]],
      ["unknown-space", [0, 0, 0]],
    ] as const) {
      const invalidColorSpace = admitThemeAuthoringDocument(
        oneModeDocument(
          { marker: { $type: "number", $value: 0 } },
          { invalidColor: { $type: "color", $value: { colorSpace, components } } },
        ),
      );
      expect(invalidColorSpace.ok).toBe(false);
      if (invalidColorSpace.ok) {
        throw new TypeError("Only valid closed DTCG 2025.10 color spaces may be preserved.");
      }
      expect(invalidColorSpace.diagnostics[0]).toMatchObject({
        code: "DTCG_REJECTED",
        cause: { code: "INVALID_DTCG_VALUE" },
      });
    }

    const unsupportedGroup = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const groupDocument = unsupportedGroup.themes[0]?.modes[1]?.source.document;
    if (groupDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    (groupDocument as Record<string, unknown>).mixed = {
      $type: "gradient",
      inheritedUnsupported: { $value: { stops: [] } },
      bad: { $type: "number", $value: "not-a-number" },
    };
    const groupAdmission = admitThemeAuthoringDocument(unsupportedGroup);
    expect(groupAdmission.ok).toBe(false);
    if (groupAdmission.ok) throw new TypeError("Expected invalid supported child rejection.");
    expect(groupAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_VALUE");

    const unsupportedToken = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const tokenDocument = unsupportedToken.themes[0]?.modes[1]?.source.document;
    if (tokenDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    (tokenDocument as Record<string, unknown>).mixed = {
      $type: "gradient",
      $value: { stops: [] },
      child: { $type: "number", $value: "bad" },
    };
    const tokenAdmission = admitThemeAuthoringDocument(unsupportedToken);
    expect(tokenAdmission.ok).toBe(false);
    if (tokenAdmission.ok) throw new TypeError("Expected mixed token/group rejection.");
    expect(tokenAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_STRUCTURE");

    for (const invalidTokenDocument of [
      {
        $root: { $type: "number", $value: 2 },
        $type: "number",
        $value: 1,
      },
      {
        invalidToken: {
          $extends: "some.group",
          $type: "number",
          $value: 1,
        },
      },
    ]) {
      const groupOnlyMemberOnToken = admitThemeAuthoringDocument(
        oneModeDocument({ marker: { $type: "number", $value: 0 } }, invalidTokenDocument),
      );
      expect(groupOnlyMemberOnToken.ok).toBe(false);
      if (groupOnlyMemberOnToken.ok) {
        throw new TypeError("Group-only DTCG members cannot be preserved on a token.");
      }
      expect(groupOnlyMemberOnToken.diagnostics[0].code).toBe("DTCG_REJECTED");
    }

    for (const [unsupportedMemberDocument, expectedCode] of [
      [
        {
          baseGroup: { token: { $type: "number", $value: 1 } },
          derivedGroup: { $extends: "baseGroup" },
        },
        "INVALID_DTCG_STRUCTURE",
      ],
      [{ derivedGroup: { $extends: "{missing}" } }, "ALIAS_TARGET_MISSING"],
      [{ a: { $extends: "{b}" }, b: { $extends: "{a}" } }, "ALIAS_CYCLE"],
      [
        { invalidUnit: { $type: "dimension", $value: { unit: "em", value: 1 } } },
        "UNSUPPORTED_DTCG_MEMBER",
      ],
      [
        { invalidUnit: { $type: "duration", $value: { unit: "days", value: 1 } } },
        "UNSUPPORTED_DTCG_MEMBER",
      ],
      [{ futureMember: { $future: true, $type: "number", $value: 1 } }, "INVALID_DTCG_STRUCTURE"],
    ] as const) {
      const unsupportedMember = admitThemeAuthoringDocument(
        oneModeDocument({ marker: { $type: "number", $value: 0 } }, unsupportedMemberDocument),
      );
      expect(unsupportedMember.ok).toBe(false);
      if (unsupportedMember.ok) {
        throw new TypeError("Unvalidated reserved members and units must fail closed.");
      }
      expect(unsupportedMember.diagnostics[0].cause?.code).toBe(expectedCode);
    }

    const validComplexStroke = admitThemeAuthoringDocument(
      oneModeDocument(
        { marker: { $type: "number", $value: 0 } },
        {
          border: {
            $type: "border",
            $value: {
              color: { colorSpace: "srgb", components: [0, 0, 0] },
              style: {
                dashArray: [
                  { unit: "px", value: 1 },
                  { unit: "px", value: 2 },
                ],
                lineCap: "round",
              },
              width: { unit: "px", value: 1 },
            },
          },
        },
      ),
    );
    expect(validComplexStroke.ok).toBe(true);
    if (!validComplexStroke.ok) throw new TypeError(validComplexStroke.diagnostics[0].message);
    expect(validComplexStroke.report.preservedUnsupportedFeatures).toEqual([
      expect.objectContaining({ featureId: "ADDITIONAL_TOKEN_TYPES" }),
    ]);

    for (const [style, expectedCode] of [
      [{ garbage: true }, "INVALID_DTCG_VALUE"],
      [{ dashArray: [{ unit: "px", value: 1 }], lineCap: "garbage" }, "INVALID_DTCG_VALUE"],
      [{ dashArray: ["{missing}"], lineCap: "round" }, "ALIAS_TARGET_MISSING"],
    ] as const) {
      const complexStroke = admitThemeAuthoringDocument(
        oneModeDocument(
          { marker: { $type: "number", $value: 0 } },
          {
            border: {
              $type: "border",
              $value: {
                color: { colorSpace: "srgb", components: [0, 0, 0] },
                style,
                width: { unit: "px", value: 1 },
              },
            },
          },
        ),
      );
      expect(complexStroke.ok).toBe(false);
      if (complexStroke.ok)
        throw new TypeError("Malformed complex stroke styles must fail closed.");
      expect(complexStroke.diagnostics[0].cause?.code).toBe(expectedCode);
    }

    const unsupportedComposite = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const compositeDocument = unsupportedComposite.themes[0]?.modes[1]?.source.document;
    if (compositeDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    (compositeDocument as Record<string, unknown>).family = {
      $type: "fontFamily",
      $value: "Inter",
    };
    (compositeDocument as Record<string, unknown>).badType = {
      $type: "typography",
      $value: {
        fontFamily: "{family}",
        fontSize: { unit: "px", value: -1 },
        fontWeight: 400,
        letterSpacing: { unit: "px", value: 0 },
        lineHeight: 1,
      },
    };
    const compositeAdmission = admitThemeAuthoringDocument(unsupportedComposite);
    expect(compositeAdmission.ok).toBe(false);
    if (compositeAdmission.ok) throw new TypeError("Expected invalid composite child rejection.");
    expect(compositeAdmission.diagnostics[0].cause?.code).toBe("LIMIT_EXCEEDED");

    const unsupportedAlias = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const aliasDocument = unsupportedAlias.themes[0]?.modes[1]?.source.document;
    if (aliasDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    (aliasDocument as Record<string, unknown>).mixed = {
      $type: "gradient",
      hiddenAlias: { $value: "{definitely.missing}" },
    };
    const hiddenAliasAdmission = admitThemeAuthoringDocument(unsupportedAlias);
    expect(hiddenAliasAdmission.ok).toBe(false);
    if (hiddenAliasAdmission.ok) throw new TypeError("Expected hidden alias rejection.");
    expect(hiddenAliasAdmission.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");

    for (const target of ["palette.action", "numericTarget"] as const) {
      const mismatchedUnknownAlias = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
      const mismatchDocument = mismatchedUnknownAlias.themes[0]?.modes[1]?.source.document;
      if (mismatchDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
      const mutableMismatchDocument = mismatchDocument as Record<string, unknown>;
      mutableMismatchDocument.numericTarget = { $type: "number", $value: 7 };
      mutableMismatchDocument.unknownAlias = {
        $type: "gradient",
        $value: `{${target}}`,
      };
      const mismatchAdmission = admitThemeAuthoringDocument(mismatchedUnknownAlias);
      expect(mismatchAdmission.ok).toBe(false);
      if (mismatchAdmission.ok) throw new TypeError("Expected raw alias type mismatch rejection.");
      expect(mismatchAdmission.diagnostics[0].cause?.code).toBe("ALIAS_TYPE_MISMATCH");
    }

    const unsupportedSourceOverride = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const overrideTheme = unsupportedSourceOverride.themes[0];
    const overrideModeDocument = overrideTheme?.modes[1]?.source.document;
    if (overrideTheme === undefined || overrideModeDocument === undefined) {
      throw new TypeError("Expected the Neutral dark mode.");
    }
    (overrideTheme.base.document as Record<string, unknown>).sourceMismatch = {
      $type: "number",
      $value: 1,
    };
    (overrideModeDocument as Record<string, unknown>).sourceMismatch = {
      $type: "gradient",
      $value: { stops: [] },
    };
    const overrideAdmission = admitThemeAuthoringDocument(unsupportedSourceOverride);
    expect(overrideAdmission.ok).toBe(false);
    if (overrideAdmission.ok) throw new TypeError("Expected raw source type mismatch rejection.");
    expect(overrideAdmission.diagnostics[0].cause?.code).toBe("SOURCE_TYPE_MISMATCH");

    for (const [base, mode] of [
      [
        {
          numeric: { $type: "number", $value: 1 },
          switched: { $value: "{numeric}" },
        },
        { switched: { $type: "gradient", $value: { stops: [] } } },
      ],
      [
        {
          numeric: { $type: "number", $value: 1 },
          switched: { $type: "gradient", $value: { stops: [] } },
        },
        { switched: { $value: "{numeric}" } },
      ],
      [
        {
          aliasStep: { $value: "{numeric}" },
          numeric: { $type: "number", $value: 1 },
          switched: { $value: "{aliasStep}" },
        },
        { switched: { $type: "gradient", $value: { stops: [] } } },
      ],
      [
        {
          numeric: { $type: "number", $value: 1 },
          switched: { $ref: "#/numeric/$value" },
        },
        { switched: { $type: "fontFamily", $value: "Inter" } },
      ],
      [
        { switched: { $type: "fontFamily", $value: "Inter" } },
        {
          numeric: { $type: "number", $value: 1 },
          switched: { $ref: "#/numeric/$value" },
        },
      ],
    ] as const) {
      const inferredTransition = admitThemeAuthoringDocument(oneModeDocument(base, mode));
      expect(inferredTransition.ok).toBe(false);
      if (inferredTransition.ok) {
        throw new TypeError("A source transition cannot hide an inferred alias type change.");
      }
      expect(inferredTransition.diagnostics[0].cause?.code).toBe("SOURCE_TYPE_MISMATCH");
    }

    for (const invalidRoot of [
      {},
      { child: { $type: "number", $value: 1 } },
      { $type: "color", $value: "{missing.path}" },
      { $type: "color", $value: { colorSpace: "srgb", components: [2, 0, 0] } },
      {
        $type: "number",
        $value: 1,
        child: { $type: "number", $value: 2 },
      },
    ]) {
      const invalidRootMember = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
      const invalidRootMemberDocument = invalidRootMember.themes[0]?.modes[1]?.source.document;
      if (invalidRootMemberDocument === undefined) {
        throw new TypeError("Expected the Neutral dark source.");
      }
      (invalidRootMemberDocument as Record<string, unknown>).$root = invalidRoot;
      const invalidRootMemberAdmission = admitThemeAuthoringDocument(invalidRootMember);
      expect(invalidRootMemberAdmission.ok).toBe(false);
      if (invalidRootMemberAdmission.ok)
        throw new TypeError("Expected invalid $root payload rejection.");
      expect(invalidRootMemberAdmission.diagnostics[0].code).toBe("DTCG_REJECTED");
    }

    const injectedTargetAdmission = admitThemeAuthoringDocument(
      oneModeDocument(
        { alias: { $type: "number", $value: "{group.authoring-proof}" } },
        { group: { $root: { $type: "number", $value: 1 } } },
      ),
    );
    expect(injectedTargetAdmission.ok).toBe(false);
    if (injectedTargetAdmission.ok) {
      throw new TypeError("A validation projection must not satisfy a missing alias target.");
    }
    expect(injectedTargetAdmission.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");

    const rootOverrideCycle = admitThemeAuthoringDocument(
      oneModeDocument(
        { group: { $root: { $type: "number", $value: 1 } } },
        {
          alias: { $type: "number", $value: "{group.$root}" },
          group: { $root: { $type: "number", $value: "{alias}" } },
        },
      ),
    );
    expect(rootOverrideCycle.ok).toBe(false);
    if (rootOverrideCycle.ok) {
      throw new TypeError("A projected $root override must retain its logical alias identity.");
    }
    expect(rootOverrideCycle.diagnostics[0].cause?.code).toBe("ALIAS_CYCLE");

    const twoRootCycle = admitThemeAuthoringDocument(
      oneModeDocument(
        { marker: { $type: "number", $value: 1 } },
        {
          g: { $root: { $type: "number", $value: "{h.$root}" } },
          h: { $root: { $type: "number", $value: "{g.$root}" } },
        },
      ),
    );
    expect(twoRootCycle.ok).toBe(false);
    if (twoRootCycle.ok) {
      throw new TypeError("Multiple projected $root aliases must retain exact cycle identities.");
    }
    expect(twoRootCycle.diagnostics[0].cause).toMatchObject({
      code: "ALIAS_CYCLE",
      message: "Alias cycle detected while inferring a token type: g.$root -> h.$root -> g.$root.",
    });

    const crossSourceRootCycle = admitThemeAuthoringDocument(
      oneModeDocument(
        { g: { $root: { $type: "number", $value: "{h.$root}" } } },
        { h: { $root: { $type: "number", $value: "{g.$root}" } } },
      ),
    );
    expect(crossSourceRootCycle.ok).toBe(false);
    if (crossSourceRootCycle.ok) {
      throw new TypeError("Cross-source projected $root aliases must retain exact identities.");
    }
    expect(crossSourceRootCycle.diagnostics[0].cause).toMatchObject({
      code: "ALIAS_CYCLE",
      message: "Alias cycle detected while inferring a token type: g.$root -> h.$root -> g.$root.",
      pointer: "/g/$root/$value",
      sourceId: "test.base",
      tokenPath: "g.$root",
    });

    const rootOverrideTypeMismatch = admitThemeAuthoringDocument(
      oneModeDocument(
        { group: { $root: { $type: "number", $value: 1 } } },
        {
          group: {
            $root: {
              $type: "color",
              $value: { colorSpace: "srgb", components: [0, 0, 0] },
            },
          },
        },
      ),
    );
    expect(rootOverrideTypeMismatch.ok).toBe(false);
    if (rootOverrideTypeMismatch.ok) {
      throw new TypeError("A $root override cannot change type across ordered sources.");
    }
    expect(rootOverrideTypeMismatch.diagnostics[0].cause).toMatchObject({
      code: "SOURCE_TYPE_MISMATCH",
      tokenPath: "group.$root",
    });

    const inheritedUnknownRoot = admitThemeAuthoringDocument(
      oneModeDocument(
        {
          group: {
            $root: { $value: { stops: [] } },
            $type: "gradient",
          },
        },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(inheritedUnknownRoot.ok).toBe(false);
    if (inheritedUnknownRoot.ok) throw new TypeError("Unvalidated group types must fail closed.");
    expect(inheritedUnknownRoot.diagnostics[0].cause?.code).toBe("INVALID_DTCG_VALUE");

    const inheritedUnknownRootAlias = admitThemeAuthoringDocument(
      oneModeDocument(
        {
          group: {
            $root: { $value: "{missing}" },
            $type: "gradient",
          },
        },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(inheritedUnknownRootAlias.ok).toBe(false);
    if (inheritedUnknownRootAlias.ok) {
      throw new TypeError("A typeless $root alias must still resolve its own target.");
    }
    expect(inheritedUnknownRootAlias.diagnostics[0].cause?.code).toBe("ALIAS_TARGET_MISSING");

    const embeddedAliasWithChild = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const embeddedAliasDocument = embeddedAliasWithChild.themes[0]?.modes[1]?.source.document;
    if (embeddedAliasDocument === undefined)
      throw new TypeError("Expected the Neutral dark source.");
    (embeddedAliasDocument as Record<string, unknown>).mixed = {
      $type: "number",
      $value: "prefix {opacity.disabled}",
      child: { $type: "number", $value: 1 },
    };
    const embeddedAliasWithChildAdmission = admitThemeAuthoringDocument(embeddedAliasWithChild);
    expect(embeddedAliasWithChildAdmission.ok).toBe(false);
    if (embeddedAliasWithChildAdmission.ok)
      throw new TypeError("Expected a mixed token/group rejection.");
    expect(embeddedAliasWithChildAdmission.diagnostics[0].cause?.code).toBe(
      "INVALID_DTCG_STRUCTURE",
    );

    const rootTokenWithCrossSourceCollision = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const collisionTheme = rootTokenWithCrossSourceCollision.themes[0];
    const collisionMode = collisionTheme?.modes[1];
    if (collisionTheme === undefined || collisionMode === undefined) {
      throw new TypeError("Expected the Neutral dark mode.");
    }
    (collisionTheme.base as { document: unknown }).document = {
      "authoring-proof": { $type: "color", $value: color(0.1, 0.2, 0.3) },
    };
    (collisionMode.source as { document: unknown }).document = { $type: "number", $value: 1 };
    const rootTokenAdmission = admitThemeAuthoringDocument(rootTokenWithCrossSourceCollision);
    expect(rootTokenAdmission.ok).toBe(false);
    if (rootTokenAdmission.ok) throw new TypeError("A document root cannot itself be a token.");
    expect(rootTokenAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_STRUCTURE");

    const rootColorWithCollision = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const rootColorTheme = rootColorWithCollision.themes[0];
    const rootColorMode = rootColorTheme?.modes[1];
    if (rootColorTheme === undefined || rootColorMode === undefined) {
      throw new TypeError("Expected the Neutral dark mode.");
    }
    (rootColorTheme.base as { document: unknown }).document = {
      "authoring-proof": { $type: "number", $value: 1 },
    };
    (rootColorMode.source as { document: unknown }).document = {
      $type: "color",
      $value: { colorSpace: "display-p3", components: [1, 0, 0] },
    };
    const rootColorAdmission = admitThemeAuthoringDocument(rootColorWithCollision);
    expect(rootColorAdmission.ok).toBe(false);
    if (rootColorAdmission.ok) throw new TypeError("A document root cannot itself be a token.");
    expect(rootColorAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_STRUCTURE");

    for (const rootValue of [
      { $type: "color", $value: "{does.not.exist}" },
      { $type: "color", $value: { colorSpace: "srgb", components: [2, 0, 0] } },
    ]) {
      const invalidRootToken = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
      const invalidRootTheme = invalidRootToken.themes[0];
      const invalidRootMode = invalidRootTheme?.modes[1];
      if (invalidRootTheme === undefined || invalidRootMode === undefined) {
        throw new TypeError("Expected the Neutral dark mode.");
      }
      (invalidRootTheme.base as { document: unknown }).document = {
        baseNumber: { $type: "number", $value: 1 },
      };
      (invalidRootMode.source as { document: unknown }).document = rootValue;
      const invalidRootAdmission = admitThemeAuthoringDocument(invalidRootToken);
      expect(invalidRootAdmission.ok).toBe(false);
      if (invalidRootAdmission.ok) throw new TypeError("Expected invalid root token rejection.");
      expect(invalidRootAdmission.diagnostics[0].cause?.code).toBe("INVALID_DTCG_STRUCTURE");
    }
  });

  it("bounds unsupported-feature preservation work per overlay", () => {
    const overloaded = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const darkDocument = overloaded.themes[0]?.modes[1]?.source.document;
    if (darkDocument === undefined) throw new TypeError("Expected the Neutral dark source.");
    for (
      let index = 0;
      index <= THEME_AUTHORING_LIMITS.maxUnsupportedFeaturesPerOverlay;
      index += 1
    ) {
      (darkDocument as Record<string, unknown>)[`root${String(index).padStart(3, "0")}`] = {
        $root: { $type: "number", $value: index },
      };
    }
    expect(admitThemeAuthoringDocument(overloaded)).toMatchObject({
      diagnostics: [{ code: "UNSUPPORTED_FEATURE_LIMIT_EXCEEDED", modeId: "dark" }],
      ok: false,
    });

    const limitDocument: Record<string, unknown> = {};
    for (let index = 0; index < DESIGN_TOKEN_PROFILE.limits.maxTokenCount - 1; index += 1) {
      limitDocument[`t${String(index).padStart(4, "0")}`] = { $type: "number", $value: index };
    }
    limitDocument.group = { $root: { $type: "number", $value: 1 } };
    const atTokenLimit = admitThemeAuthoringDocument(
      oneModeDocument({ t0000: { $type: "number", $value: 0 } }, limitDocument),
    );
    expect(atTokenLimit.ok).toBe(true);
    if (!atTokenLimit.ok) throw new TypeError(atTokenLimit.diagnostics[0].message);
    expect(atTokenLimit.report.preservedUnsupportedFeatures).toHaveLength(1);

    const unsupportedOnly = admitThemeAuthoringDocument(
      oneModeDocument(
        { $root: { $type: "number", $value: 0 } },
        { $root: { $type: "number", $value: 1 } },
      ),
    );
    if (!unsupportedOnly.ok) throw new TypeError(JSON.stringify(unsupportedOnly.diagnostics[0]));
    expect(unsupportedOnly.report.preservedUnsupportedFeatures).toHaveLength(2);
  });

  it("leaves over-depth alias-chain rejection to the frozen T02 resolver", () => {
    const base: Record<string, unknown> = {};
    for (let index = 0; index < DESIGN_TOKEN_PROFILE.limits.maxTokenCount - 1; index += 1) {
      const current = `a${String(index).padStart(4, "0")}`;
      const next = `a${String(index + 1).padStart(4, "0")}`;
      base[current] = { $value: `{${next}}` };
    }
    base.a4095 = { $type: "number", $value: 1 };

    const admission = admitThemeAuthoringDocument(
      oneModeDocument(base, {
        a0000: { $value: "{a0001}" },
      }),
    );
    expect(admission.ok).toBe(false);
    if (admission.ok) throw new TypeError("An alias chain beyond the T02 limit must be rejected.");
    expect(admission.diagnostics[0].cause?.code).toBe("RESOLUTION_LIMIT_EXCEEDED");
  });

  it("preserves $root tokens at both frozen T02 token-path limits", () => {
    let maximumSegmentDocument: Record<string, unknown> = {
      $root: { $type: "number", $value: 1 },
    };
    for (let index = DESIGN_TOKEN_PROFILE.limits.maxTokenPathSegments - 1; index >= 0; index -= 1) {
      maximumSegmentDocument = { [`s${index}`]: maximumSegmentDocument };
    }
    const maximumLengthName = "p".repeat(DESIGN_TOKEN_PROFILE.limits.maxTokenPathLength);
    const maximumLengthDocument = {
      [maximumLengthName]: { $root: { $type: "number", $value: 1 } },
    };

    for (const document of [maximumSegmentDocument, maximumLengthDocument]) {
      const admission = admitThemeAuthoringDocument(
        oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
      );
      if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
      expect(admission.report.preservedUnsupportedFeatures).toHaveLength(1);
      expect(admission.report.preservedUnsupportedFeatures[0]?.diagnostic.code).toBe(
        "UNSUPPORTED_DTCG_MEMBER",
      );
      expect(admission.report.preservedUnsupportedFeatures[0]?.diagnostic.pointer).toContain(
        "/$root",
      );
    }
  });

  it("keeps $root projection paths bounded through adversarial name collisions", () => {
    const collisionDocument: Record<string, unknown> = {
      group: { $root: { $type: "number", $value: 1 } },
    };
    let repeatedSuffix = "authoring-proof";
    for (let index = 0; index < 202; index += 1) {
      collisionDocument[repeatedSuffix] = { $type: "number", $value: index };
      repeatedSuffix = `${repeatedSuffix}-next`;
    }
    collisionDocument["authoring-proof"] = { $type: "number", $value: 0 };
    for (let index = 2; index <= 256; index += 1) {
      collisionDocument[`authoring-proof-${index}`] = { $type: "number", $value: index };
    }
    const admission = admitThemeAuthoringDocument(
      oneModeDocument(collisionDocument, { marker: { $type: "number", $value: 0 } }),
    );
    if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
    expect(admission.report.preservedUnsupportedFeatures).toHaveLength(1);
    expect(admission.report.preservedUnsupportedFeatures[0]?.diagnostic.pointer).toBe(
      "/group/$root",
    );
  });

  it("uses the exact T02 token-name grammar for ordinary edits", () => {
    const custom = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const lightPalette = custom.themes[0]?.modes[0]?.source.document.palette;
    if (lightPalette === null || typeof lightPalette !== "object" || Array.isArray(lightPalette)) {
      throw new TypeError("Expected the Neutral light palette.");
    }
    (lightPalette as Record<string, unknown>)["valid$name"] = {
      $type: "color",
      $value: color(0.1, 0.2, 0.3),
    };
    const created = createThemeAuthoringSession(custom);
    if (!created.ok) throw new TypeError(created.diagnostics[0].message);
    const edited = applyThemeAuthoringEdit(created.session, {
      kind: "set-literal",
      path: "palette.valid$name",
      sourceId: "neutral.light",
      themeId: "desen-neutral",
      type: "color",
      value: color(0.7, 0.6, 0.5),
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) throw new TypeError(edited.diagnostics[0].message);
    expect(resolvedColor(edited.session, "palette.valid$name")).toEqual(color(0.7, 0.6, 0.5));
  });

  it("retains the exact working session for malformed, duplicate, invalid, and unsafe imports", () => {
    const current = session();
    for (const text of [
      "{",
      '{"kind":"desen.theme-authoring","kind":"desen.theme-authoring"}',
      JSON.stringify({ ...clone(DESEN_NEUTRAL_THEME_DOCUMENT), themes: [] }),
    ]) {
      const result = importThemeAuthoringDocument(current, text);
      expect(result.ok).toBe(false);
      if (result.ok) throw new TypeError("Expected import rejection.");
      expect(result.session).toBe(current);
      expect(result.session.revision).toBe(0);
      expect(result.session.past).toEqual([]);
    }

    const invalid = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const action = invalid.themes[0]?.base.document.color;
    if (action === null || typeof action !== "object" || Array.isArray(action)) {
      throw new TypeError("Expected Neutral color tokens.");
    }
    (action as Record<string, unknown>).action = {
      $type: "color",
      $value: "{palette.missing}",
    };
    const invalidResult = importThemeAuthoringDocument(current, JSON.stringify(invalid));
    expect(invalidResult.ok).toBe(false);
    if (invalidResult.ok) throw new TypeError("Expected invalid DTCG rejection.");
    expect(invalidResult.session).toBe(current);

    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(admitThemeAuthoringDocument(cycle)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "UNSAFE_THEME_VALUE" }],
    });
    let getterRuns = 0;
    const executable = Object.defineProperty({}, "kind", {
      enumerable: true,
      get() {
        getterRuns += 1;
        return "desen.theme-authoring";
      },
    });
    expect(admitThemeAuthoringDocument(executable).ok).toBe(false);
    expect(getterRuns).toBe(0);

    const repeatedLongString = "x".repeat(THEME_AUTHORING_LIMITS.maxImportBytes / 32);
    const oversizedByExpansion = {
      extensions: { bulk: Array.from({ length: 64 }, () => repeatedLongString) },
      kind: "desen.theme-authoring",
      schemaVersion: 1,
      themes: [],
    };
    expect(admitThemeAuthoringDocument(oversizedByExpansion)).toMatchObject({
      diagnostics: [{ code: "UNSAFE_THEME_VALUE" }],
      ok: false,
    });
  });

  it("uses one zero-based depth limit for direct admission and canonical reimport", () => {
    const outcomes: boolean[] = [];
    for (const nesting of [62, 63, 64]) {
      let extensions: Record<string, unknown> = {};
      for (let depth = 0; depth < nesting; depth += 1) extensions = { x: extensions };
      const candidate = clone(DESEN_NEUTRAL_THEME_DOCUMENT) as unknown as Record<string, unknown>;
      candidate.extensions = extensions;
      const created = createThemeAuthoringSession(candidate);
      outcomes.push(created.ok);
      if (!created.ok) continue;
      const exported = exportThemeAuthoringDocument(created.session);
      const reimported = importThemeAuthoringDocument(created.session, exported.text);
      expect(reimported.ok).toBe(true);
    }
    expect(outcomes).toEqual([true, true, false]);
  });

  it("rejects whitespace labels and reused document-local source identities", () => {
    const blankName = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const firstTheme = blankName.themes[0];
    if (firstTheme === undefined) throw new TypeError("Expected Neutral.");
    (firstTheme as { name: string }).name = "   ";
    expect(admitThemeAuthoringDocument(blankName)).toMatchObject({
      diagnostics: [{ code: "INVALID_THEME_DOCUMENT" }],
      ok: false,
    });

    const duplicateSource = clone(DESEN_NEUTRAL_THEME_DOCUMENT);
    const modes = duplicateSource.themes[0]?.modes;
    if (modes?.[0] === undefined || modes[1] === undefined)
      throw new TypeError("Expected two modes.");
    (modes[1].source as { id: string }).id = modes[0].source.id;
    expect(admitThemeAuthoringDocument(duplicateSource)).toMatchObject({
      diagnostics: [{ code: "INVALID_THEME_DOCUMENT", pointer: "/themes/0/modes/1/source/id" }],
      ok: false,
    });
  });

  it("caps successful document history without constraining custom literal values", () => {
    let current = session();
    for (let index = 0; index < THEME_AUTHORING_LIMITS.maxHistoryEntries + 5; index += 1) {
      const step = applyThemeAuthoringEdit(current, {
        kind: "set-literal",
        path: "palette.action",
        sourceId: "neutral.light",
        themeId: "desen-neutral",
        type: "color",
        value: color((index + 1) / 200, 0.2, 0.3),
      });
      if (!step.ok) throw new TypeError(step.diagnostics[0].message);
      current = step.session;
    }
    expect(current.past).toHaveLength(THEME_AUTHORING_LIMITS.maxHistoryEntries);
    expect(current.revision).toBe(THEME_AUTHORING_LIMITS.maxHistoryEntries + 5);
  });

  it("covers the frozen SC-01 valid-but-unsupported fixture authority losslessly", () => {
    const black = {
      alpha: 1,
      colorSpace: "srgb",
      components: [0, 0, 0],
      hex: "#000000",
    };
    const fixtures = [
      {
        document: {
          alias: { $type: "color", $value: "{primary}" },
          primary: { $type: "color", $value: black },
        },
        id: "root-token-curly-alias",
      },
      {
        document: {
          alias: { $value: "{palette.primary}" },
          palette: { primary: { $type: "color", $value: black } },
        },
        id: "alias-infers-target-type",
      },
      {
        document: {
          alias: { $ref: "#/primary/$value", $type: "color" },
          primary: { $type: "color", $value: black },
        },
        id: "whole-token-json-pointer",
      },
      {
        document: {
          base: { $type: "color", $value: black },
          derived: {
            $type: "color",
            $value: {
              alpha: 1,
              colorSpace: "srgb",
              components: [{ $ref: "#/base/$value/components/0" }, 0, 0],
              hex: "#000000",
            },
          },
        },
        id: "color-component-json-pointer",
      },
      {
        document: {
          semantic: {
            $root: { $value: black },
            $type: "color",
            accent: { $value: black },
          },
        },
        id: "group-root-token",
      },
      {
        document: {
          base: { $type: "color", accent: { $value: black } },
          derived: {
            $extends: "{base}",
            $type: "color",
            accent: { $value: black },
          },
        },
        id: "group-extends",
      },
      {
        document: { empty: { $description: "A valid empty DTCG group." } },
        id: "empty-described-group",
      },
      {
        document: {
          primary: {
            $extensions: { "example.com": { source: "fixture" } },
            $type: "color",
            $value: black,
          },
        },
        id: "token-vendor-extension",
      },
      {
        document: {
          legacy: { $deprecated: "Use primary.", $type: "color", $value: black },
        },
        id: "deprecated-token",
      },
      {
        document: { opacity: { $type: "number", $value: 0.5 } },
        id: "number-token",
      },
      {
        document: {
          body: {
            $type: "typography",
            $value: {
              fontFamily: "Inter",
              fontSize: { unit: "rem", value: 1 },
              fontWeight: 400,
              letterSpacing: { unit: "px", value: 0 },
              lineHeight: 1.5,
            },
          },
        },
        id: "typography-token",
      },
      {
        document: {
          accent: {
            $type: "color",
            $value: { alpha: 1, colorSpace: "display-p3", components: [0.1, 0.2, 0.3] },
          },
        },
        id: "display-p3-color",
      },
      {
        document: {
          accent: {
            $type: "color",
            $value: { alpha: 1, colorSpace: "oklch", components: [0.5, 0.2, 180] },
          },
        },
        id: "oklch-color",
      },
      {
        document: {
          accent: {
            $type: "color",
            $value: { alpha: 1, colorSpace: "srgb", components: ["none", 0.2, 0.3] },
          },
        },
        id: "srgb-none-component",
      },
      {
        document: {
          accent: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] },
          },
        },
        id: "color-without-local-alpha-and-hex",
      },
      {
        document: {
          modifiers: {
            theme: {
              contexts: {
                dark: [{ color: { background: { $type: "color", $value: black } } }],
                light: [{ color: { background: { $type: "color", $value: black } } }],
              },
              default: "light",
            },
          },
          resolutionOrder: [{ $ref: "#/modifiers/theme" }],
          version: "2025-11-01",
        },
        id: "resolver-theme-modifier",
      },
    ];
    const expectedFeatures = new Map<
      string,
      readonly (readonly [string, string, string, string | null])[]
    >([
      [
        "root-token-curly-alias",
        [
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/primary/$value/hex",
            "primary",
          ],
        ],
      ],
      [
        "alias-infers-target-type",
        [
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/palette/primary/$value/hex",
            "palette.primary",
          ],
        ],
      ],
      [
        "whole-token-json-pointer",
        [
          ["JSON_POINTER_REF", "UNSUPPORTED_DTCG_MEMBER", "/alias/$ref", "alias"],
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/primary/$value/hex",
            "primary",
          ],
        ],
      ],
      [
        "color-component-json-pointer",
        [
          ["OPTIONAL_COLOR_ALPHA_AND_HEX", "UNSUPPORTED_DTCG_MEMBER", "/base/$value/hex", "base"],
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/derived/$value/hex",
            "derived",
          ],
          [
            "PROPERTY_LEVEL_REF",
            "UNSUPPORTED_PROPERTY_ALIAS",
            "/derived/$value/components/0/$ref",
            "derived",
          ],
        ],
      ],
      [
        "group-root-token",
        [
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/semantic/$root/$value/hex",
            "semantic.$root",
          ],
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/semantic/accent/$value/hex",
            "semantic.accent",
          ],
          ["ROOT_GROUP_TOKEN", "UNSUPPORTED_DTCG_MEMBER", "/semantic/$root", "semantic.$root"],
        ],
      ],
      [
        "group-extends",
        [
          ["GROUP_EXTENDS", "UNSUPPORTED_DTCG_MEMBER", "/derived/$extends", "derived"],
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/base/accent/$value/hex",
            "base.accent",
          ],
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/derived/accent/$value/hex",
            "derived.accent",
          ],
        ],
      ],
      ["empty-described-group", [["EMPTY_GROUP", "EMPTY_DTCG_GROUP", "/empty", "empty"]]],
      [
        "token-vendor-extension",
        [
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/primary/$value/hex",
            "primary",
          ],
        ],
      ],
      [
        "deprecated-token",
        [
          [
            "OPTIONAL_COLOR_ALPHA_AND_HEX",
            "UNSUPPORTED_DTCG_MEMBER",
            "/legacy/$value/hex",
            "legacy",
          ],
        ],
      ],
      ["number-token", []],
      ["typography-token", []],
      [
        "display-p3-color",
        [
          [
            "ADDITIONAL_COLOR_SPACES",
            "UNSUPPORTED_COLOR_SPACE",
            "/accent/$value/colorSpace",
            "accent",
          ],
        ],
      ],
      [
        "oklch-color",
        [
          [
            "ADDITIONAL_COLOR_SPACES",
            "UNSUPPORTED_COLOR_SPACE",
            "/accent/$value/colorSpace",
            "accent",
          ],
        ],
      ],
      [
        "srgb-none-component",
        [
          [
            "NONE_COLOR_COMPONENTS",
            "UNSUPPORTED_DTCG_MEMBER",
            "/accent/$value/components/0",
            "accent",
          ],
        ],
      ],
      ["color-without-local-alpha-and-hex", []],
      [
        "resolver-theme-modifier",
        [["RESOLVER_THEMES_AND_MODES", "UNSUPPORTED_DTCG_MEMBER", "", null]],
      ],
    ]);

    for (const fixture of fixtures) {
      const admission = admitThemeAuthoringDocument(
        oneModeDocument(fixture.document, { marker: { $type: "number", $value: 0 } }),
      );
      if (!admission.ok) {
        throw new TypeError(`${fixture.id}: ${JSON.stringify(admission.diagnostics[0])}`);
      }
      expect(admission.ok, fixture.id).toBe(true);
      const created = createThemeAuthoringSession(admission.document);
      if (!created.ok) throw new TypeError(`Could not create ${fixture.id}.`);
      const exported = exportThemeAuthoringDocument(created.session);
      const expected = expectedFeatures.get(fixture.id);
      if (expected === undefined) throw new TypeError(`Missing matrix row for ${fixture.id}.`);
      expect(
        exported.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
          featureId,
          diagnostic.code,
          diagnostic.pointer,
          diagnostic.tokenPath ?? null,
        ]),
        fixture.id,
      ).toEqual(expected);
      expect(created.session.preview.ok, fixture.id).toBe(expected.length === 0);
      expect(exported.report.losses, fixture.id).toEqual([]);
      expect(JSON.parse(exported.text).themes[0].base.document, fixture.id).toEqual(
        fixture.document,
      );
      const live = session();
      const imported = importThemeAuthoringDocument(live, exported.text);
      expect(imported.ok, fixture.id).toBe(true);
      if (!imported.ok) throw new TypeError(`${fixture.id}: ${imported.diagnostics[0].message}`);
      expect(exportThemeAuthoringDocument(imported.session).text, fixture.id).toBe(exported.text);
    }
  });

  it("rejects every frozen SC-01 invalid fixture atomically", () => {
    const black = {
      alpha: 1,
      colorSpace: "srgb",
      components: [0, 0, 0],
      hex: "#000000",
    };
    const fixtures = [
      {
        code: "INVALID_DTCG_NAME",
        document: { "bad.name": { $type: "color", $value: black } },
        id: "invalid-token-name",
        pointer: "/bad.name",
      },
      {
        code: "INVALID_DTCG_VALUE",
        document: {
          space: { $type: "dimension", sm: { $value: { unit: "rem", value: "1" } } },
        },
        id: "malformed-dimension-value",
        pointer: "/space/sm/$value/value",
      },
      {
        code: "ALIAS_CYCLE",
        document: {
          color: { $type: "color", a: { $value: "{color.b}" }, b: { $value: "{color.a}" } },
        },
        id: "alias-cycle",
        pointer: "/color/a/$value",
      },
      {
        code: "INVALID_DTCG_STRUCTURE",
        document: {
          alias: { $ref: "primary/$value", $type: "color" },
          primary: { $type: "color", $value: black },
        },
        id: "malformed-json-pointer",
        pointer: "/alias/$ref",
      },
      {
        code: "ALIAS_TARGET_MISSING",
        document: { alias: { $ref: "#/missing/$value", $type: "color" } },
        id: "missing-json-pointer-target",
        pointer: "/alias/$ref",
      },
      {
        code: "INVALID_DTCG_VALUE",
        document: {
          alias: { $type: "color", $value: { $ref: "#/primary/$value" } },
          primary: { $type: "color", $value: black },
        },
        id: "misplaced-json-pointer",
        pointer: "/alias/$value",
      },
    ] as const;
    for (const fixture of fixtures) {
      const live = session();
      const imported = importThemeAuthoringDocument(
        live,
        JSON.stringify(
          oneModeDocument(fixture.document, { marker: { $type: "number", $value: 0 } }),
        ),
      );
      expect(imported.ok, fixture.id).toBe(false);
      expect(imported.session, fixture.id).toBe(live);
      if (imported.ok) throw new TypeError(`${fixture.id} must be rejected.`);
      expect(imported.diagnostics[0].cause, fixture.id).toMatchObject({
        code: fixture.code,
        pointer: fixture.pointer,
      });
    }
  });

  it("rejects malformed reviewed Resolver bounds, member types, and source references atomically", () => {
    const inlineSource = { marker: { $type: "number", $value: 0 } };
    const modifier = {
      theme: {
        contexts: { dark: [inlineSource], light: [inlineSource] },
        default: "light",
      },
    };
    const fixtures = [
      {
        document: {
          modifiers: modifier,
          resolutionOrder: [],
          version: "2025-11-01",
        },
        id: "empty-resolver-resolution-order",
        pointer: "",
      },
      ...[
        ["resolver-source-ref-space", "bad ref with space"],
        ["resolver-source-ref-bad-percent", "bad%ZZ"],
        ["resolver-source-ref-non-pointer-fragment", "#not-a-json-pointer"],
      ].map(([id, reference]) => ({
        document: {
          resolutionOrder: [{ $ref: "#/sets/base" }],
          sets: { base: { sources: [{ $ref: reference }] } },
          version: "2025-11-01",
        },
        id,
        pointer: "/sets/base/sources/0/$ref",
      })),
      {
        document: {
          modifiers: modifier,
          resolutionOrder: [{ $ref: "#/modifiers/theme" }],
          sets: [],
          version: "2025-11-01",
        },
        id: "resolver-sets-wrong-type",
        pointer: "",
      },
      {
        document: {
          modifiers: "bad",
          resolutionOrder: [{ $ref: "#/sets/base" }],
          sets: { base: { sources: [inlineSource] } },
          version: "2025-11-01",
        },
        id: "resolver-modifiers-wrong-type",
        pointer: "",
      },
      {
        document: {
          modifiers: {
            theme: {
              contexts: { light: [inlineSource] },
              default: "light",
            },
          },
          resolutionOrder: [{ $ref: "#/modifiers/theme" }],
          version: "2025-11-01",
        },
        id: "resolver-modifier-single-context",
        pointer: "/modifiers/theme",
      },
      {
        document: {
          resolutionOrder: [{ $ref: "#/sets/base" }],
          sets: {
            base: {
              sources: [
                {
                  modifiers: modifier,
                  resolutionOrder: [{ $ref: "#/modifiers/theme" }],
                  version: "2025-11-01",
                },
              ],
            },
          },
          version: "2025-11-01",
        },
        id: "nested-resolver-inline-source",
        pointer: "/sets/base/sources/0",
      },
    ] as const;
    for (const fixture of fixtures) {
      const live = session();
      const imported = importThemeAuthoringDocument(
        live,
        JSON.stringify(
          oneModeDocument(fixture.document, { marker: { $type: "number", $value: 0 } }),
        ),
      );
      expect(imported.ok, fixture.id).toBe(false);
      expect(imported.session, fixture.id).toBe(live);
      if (imported.ok) throw new TypeError(`${fixture.id} must be rejected.`);
      expect(imported.diagnostics[0].cause, fixture.id).toMatchObject({
        code: "INVALID_DTCG_STRUCTURE",
        pointer: fixture.pointer,
      });
    }

    const withEmptyGroupSource = {
      resolutionOrder: [{ $ref: "#/sets/base" }],
      sets: {
        base: {
          sources: [{ empty: { $description: "A valid empty DTCG group." } }],
        },
      },
      version: "2025-11-01",
    };
    const accepted = createThemeAuthoringSession(
      oneModeDocument(withEmptyGroupSource, { marker: { $type: "number", $value: 0 } }),
    );
    if (!accepted.ok) throw new TypeError(JSON.stringify(accepted.diagnostics[0]));
    expect(accepted.session.preview.ok).toBe(false);
    const exported = exportThemeAuthoringDocument(accepted.session);
    expect(JSON.parse(exported.text).themes[0].base.document).toEqual(withEmptyGroupSource);
    expect(exported.report.losses).toEqual([]);
  });

  it("preserves the closed T02-recognized unsupported type and composite-reference matrix", () => {
    const valid = [
      {
        document: {
          border: {
            $type: "border",
            $value: {
              color: { colorSpace: "srgb", components: [0, 0, 0] },
              style: {
                dashArray: [
                  { unit: "px", value: 1 },
                  { unit: "rem", value: 0.25 },
                ],
                lineCap: "round",
              },
              width: { unit: "px", value: 1 },
            },
          },
        },
        expected: [["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_STROKE_STYLE", "/border/$value/style"]],
        id: "complex-border-stroke-style",
      },
      {
        document: {
          family: { $type: "fontFamily", $value: "Inter" },
          typography: {
            $type: "typography",
            $value: {
              fontFamily: "{family}",
              fontSize: { unit: "px", value: 16 },
              fontWeight: 400,
              letterSpacing: { unit: "px", value: 0 },
              lineHeight: 1.5,
            },
          },
        },
        expected: [
          ["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/family/$type"],
          ["PROPERTY_LEVEL_REF", "UNSUPPORTED_PROPERTY_ALIAS", "/typography/$value/fontFamily"],
        ],
        id: "typography-composite-token-reference",
      },
      {
        document: { family: { $type: "fontFamily", $value: ["Inter", "sans-serif"] } },
        expected: [["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/family/$type"]],
        id: "font-family-token",
      },
      {
        document: { weight: { $type: "fontWeight", $value: 450.5 } },
        expected: [["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/weight/$type"]],
        id: "font-weight-token",
      },
      {
        document: {
          black: {
            $type: "color",
            $value: { colorSpace: "srgb", components: [0, 0, 0] },
          },
          end: { $type: "number", $value: 1 },
          singleton: {
            $type: "gradient",
            $value: [
              {
                color: { colorSpace: "srgb", components: [1, 1, 1] },
                position: 0,
              },
              {
                color: { colorSpace: "srgb", components: [0.5, 0.5, 0.5] },
                position: 1,
              },
            ],
          },
          gradient: {
            $type: "gradient",
            $value: ["{singleton}", { color: "{black}", position: "{end}" }],
          },
        },
        expected: [
          ["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/gradient/$type"],
          ["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/singleton/$type"],
          ["PROPERTY_LEVEL_REF", "UNSUPPORTED_PROPERTY_ALIAS", "/gradient/$value/0"],
          ["PROPERTY_LEVEL_REF", "UNSUPPORTED_PROPERTY_ALIAS", "/gradient/$value/1/color"],
          ["PROPERTY_LEVEL_REF", "UNSUPPORTED_PROPERTY_ALIAS", "/gradient/$value/1/position"],
        ],
        id: "gradient-token-with-references",
      },
      {
        document: {
          dash: { $type: "dimension", $value: { unit: "px", value: 2 } },
          style: {
            $type: "strokeStyle",
            $value: { dashArray: ["{dash}", { unit: "px", value: 1 }], lineCap: "square" },
          },
        },
        expected: [
          ["ADDITIONAL_TOKEN_TYPES", "UNSUPPORTED_DTCG_TYPE", "/style/$type"],
          ["PROPERTY_LEVEL_REF", "UNSUPPORTED_PROPERTY_ALIAS", "/style/$value/dashArray/0"],
        ],
        id: "stroke-style-token-with-reference",
      },
    ] as const;

    for (const fixture of valid) {
      const admission = admitThemeAuthoringDocument(
        oneModeDocument(fixture.document, { marker: { $type: "number", $value: 0 } }),
      );
      if (!admission.ok) {
        throw new TypeError(`${fixture.id}: ${JSON.stringify(admission.diagnostics[0])}`);
      }
      expect(
        admission.report.preservedUnsupportedFeatures.map((feature) => [
          feature.featureId,
          feature.diagnostic.code,
          feature.diagnostic.pointer,
        ]),
        fixture.id,
      ).toEqual(fixture.expected);
      expect(admission.report.losses).toEqual([]);
      const created = createThemeAuthoringSession(admission.document);
      if (!created.ok) throw new TypeError(`${fixture.id}: session creation failed.`);
      expect(created.session.preview.ok).toBe(false);
      const exported = exportThemeAuthoringDocument(created.session);
      expect(JSON.parse(exported.text).themes[0].base.document).toEqual(fixture.document);
      const reimport = importThemeAuthoringDocument(created.session, exported.text);
      expect(reimport).toEqual({ changed: false, ok: true, session: created.session });
    }

    const schemaExactFontNames = admitThemeAuthoringDocument(
      oneModeDocument(
        { family: { $type: "fontFamily", $value: ["", " "] } },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(schemaExactFontNames.ok).toBe(true);

    const invalid = [
      [
        "complex-border-line-cap",
        {
          border: {
            $type: "border",
            $value: {
              color: { colorSpace: "srgb", components: [0, 0, 0] },
              style: { dashArray: [{ unit: "px", value: 1 }], lineCap: "rounded" },
              width: { unit: "px", value: 1 },
            },
          },
        },
        "INVALID_DTCG_VALUE",
        "/border/$value/style",
      ],
      [
        "typography-reference-type",
        {
          dimension: { $type: "dimension", $value: { unit: "px", value: 16 } },
          typography: {
            $type: "typography",
            $value: {
              fontFamily: "{dimension}",
              fontSize: { unit: "px", value: 16 },
              fontWeight: 400,
              letterSpacing: { unit: "px", value: 0 },
              lineHeight: 1.5,
            },
          },
        },
        "ALIAS_TYPE_MISMATCH",
        "/typography/$value/fontFamily",
      ],
      [
        "font-family-value",
        { family: { $type: "fontFamily", $value: [] } },
        "INVALID_DTCG_VALUE",
        "/family/$value",
      ],
      [
        "font-weight-value",
        { weight: { $type: "fontWeight", $value: 1001 } },
        "INVALID_DTCG_VALUE",
        "/weight/$value",
      ],
      [
        "gradient-stop-value",
        {
          gradient: {
            $type: "gradient",
            $value: [{ color: { colorSpace: "srgb", components: [0, 0, 0] } }],
          },
        },
        "INVALID_DTCG_VALUE",
        "/gradient/$value/0",
      ],
      [
        "empty-gradient-value",
        { gradient: { $type: "gradient", $value: [] } },
        "INVALID_DTCG_VALUE",
        "/gradient/$value",
      ],
      [
        "stroke-style-value",
        {
          style: {
            $type: "strokeStyle",
            $value: { dashArray: [{ unit: "em", value: 1 }], lineCap: "round" },
          },
        },
        "INVALID_DTCG_VALUE",
        "/style/$value",
      ],
      [
        "empty-stroke-dash-array",
        {
          style: {
            $type: "strokeStyle",
            $value: { dashArray: [], lineCap: "round" },
          },
        },
        "INVALID_DTCG_VALUE",
        "/style/$value",
      ],
      [
        "gradient-array-ref-wrong-shape",
        {
          gradient: {
            $type: "gradient",
            $value: [{ $ref: "#/typography/$value/fontSize" }],
          },
          typography: {
            $type: "typography",
            $value: {
              fontFamily: "Inter",
              fontSize: { unit: "px", value: 16 },
              fontWeight: 400,
              letterSpacing: { unit: "px", value: 0 },
              lineHeight: 1.5,
            },
          },
        },
        "ALIAS_TYPE_MISMATCH",
        "/gradient/$value/0/$ref",
      ],
      [
        "shadow-array-ref-wrong-shape",
        {
          shadow: {
            $type: "shadow",
            $value: [{ $ref: "#/typography/$value/fontSize" }],
          },
          typography: {
            $type: "typography",
            $value: {
              fontFamily: "Inter",
              fontSize: { unit: "px", value: 16 },
              fontWeight: 400,
              letterSpacing: { unit: "px", value: 0 },
              lineHeight: 1.5,
            },
          },
        },
        "ALIAS_TYPE_MISMATCH",
        "/shadow/$value/0/$ref",
      ],
    ] as const;
    for (const [id, document, code, pointer] of invalid) {
      const admission = admitThemeAuthoringDocument(
        oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
      );
      expect(admission.ok, id).toBe(false);
      if (admission.ok) throw new TypeError(`${id} must be rejected.`);
      expect(admission.diagnostics[0].cause, id).toMatchObject({ code, pointer });
    }

    const literalNestedGradient = admitThemeAuthoringDocument(
      oneModeDocument(
        {
          gradient: {
            $type: "gradient",
            $value: [
              [
                {
                  color: { colorSpace: "srgb", components: [0, 0, 0] },
                  position: 0,
                },
              ],
            ],
          },
        },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(literalNestedGradient.ok).toBe(false);
    if (literalNestedGradient.ok) {
      throw new TypeError("Only references, not literal nested arrays, may expand gradient stops.");
    }
    expect(literalNestedGradient.diagnostics[0].cause).toMatchObject({
      code: "INVALID_DTCG_VALUE",
      pointer: "/gradient/$value/0",
    });
  });

  it("validates group inheritance through curly, JSON Pointer, and group $ref deep merges", () => {
    const inherited = {
      $type: "color",
      inherited: {
        $value: { colorSpace: "srgb", components: [0.1, 0.2, 0.3] },
      },
    };
    const document = {
      base: inherited,
      curly: { $extends: "{base}", local: { $value: "{base.inherited}" } },
      pointer: { $extends: "#/base", local: { $value: "{base.inherited}" } },
      schema: { $ref: "#/base", local: { $value: "{base.inherited}" } },
    };
    const admission = admitThemeAuthoringDocument(
      oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
    );
    if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
    expect(
      admission.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
        featureId,
        diagnostic.pointer,
      ]),
    ).toEqual([
      ["GROUP_EXTENDS", "/curly/$extends"],
      ["GROUP_EXTENDS", "/pointer/$extends"],
      ["GROUP_EXTENDS", "/schema/$ref"],
    ]);

    const invalidOverride = admitThemeAuthoringDocument(
      oneModeDocument(
        {
          base: { $type: "number", inherited: { $value: 1 } },
          derived: { $extends: "{base}", inherited: { $value: "not-a-number" } },
        },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(invalidOverride.ok).toBe(false);
    if (invalidOverride.ok) throw new TypeError("A bad inherited override must be rejected.");
    expect(invalidOverride.diagnostics[0].cause).toMatchObject({
      code: "INVALID_DTCG_VALUE",
      pointer: "/derived/inherited/$value",
    });
  });

  it("preserves a valid __proto__ token through group inheritance, edits, history, and export", () => {
    const document = JSON.parse(`{
      "base":{"inherited":{"$type":"number","$value":1}},
      "derived":{"$extends":"{base}","__proto__":{"$type":"number","$value":2}}
    }`) as Record<string, unknown>;
    const created = createThemeAuthoringSession(
      oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
    );
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    expect(created.session.preview.ok).toBe(false);
    const initialExport = exportThemeAuthoringDocument(created.session);
    expect(
      initialExport.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
        featureId,
        diagnostic.pointer,
        diagnostic.tokenPath,
      ]),
    ).toEqual([["GROUP_EXTENDS", "/derived/$extends", "derived"]]);

    const edited = applyThemeAuthoringEdit(created.session, {
      kind: "set-literal",
      path: "derived.__proto__",
      sourceId: "test.base",
      themeId: "test-theme",
      type: "number",
      value: 3,
    });
    if (!edited.ok) throw new TypeError(JSON.stringify(edited.diagnostics[0]));
    const undone = undoThemeAuthoringEdit(edited.session);
    if (!undone.ok) throw new TypeError(JSON.stringify(undone.diagnostics[0]));
    expect(exportThemeAuthoringDocument(undone.session).text).toBe(initialExport.text);
    const redone = redoThemeAuthoringEdit(undone.session);
    if (!redone.ok) throw new TypeError(JSON.stringify(redone.diagnostics[0]));
    const exported = exportThemeAuthoringDocument(redone.session);
    const exportedBase = JSON.parse(exported.text).themes[0].base.document;
    expect(Object.hasOwn(exportedBase.derived, "__proto__")).toBe(true);
    expect(exportedBase.derived.__proto__).toEqual({ $type: "number", $value: 3 });
    expect(exportedBase.derived.$extends).toBe("{base}");
    expect(exported.report.losses).toEqual([]);
    expect(importThemeAuthoringDocument(redone.session, exported.text)).toEqual({
      changed: false,
      ok: true,
      session: redone.session,
    });
  });

  it("defers alias-cycle authority until ordered source overrides are composed", () => {
    const admission = admitThemeAuthoringDocument(
      oneModeDocument(
        {
          a: { $type: "number", $value: "{b}" },
          b: { $value: "{a}" },
        },
        { b: { $type: "number", $value: 1 } },
      ),
    );
    if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
    const created = createThemeAuthoringSession(admission.document);
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    expect(created.session.preview.ok).toBe(true);
    if (!created.session.preview.ok) throw new TypeError("Expected a composed preview.");
    expect(created.session.preview.tokens.a?.value).toBe(1);
    expect(created.session.preview.tokens.b?.value).toBe(1);
  });

  it("does not confuse ordinary token names with a Resolver document", () => {
    const namedLikeResolver = {
      modifiers: { $type: "number", $value: 1 },
      resolutionOrder: { $type: "number", $value: 2 },
      version: { $type: "number", $value: 3 },
    };
    const admission = admitThemeAuthoringDocument(
      oneModeDocument(namedLikeResolver, { marker: { $type: "number", $value: 0 } }),
    );
    if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
    expect(admission.report.preservedUnsupportedFeatures).toEqual([]);
    const created = createThemeAuthoringSession(admission.document);
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    expect(created.session.preview.ok).toBe(true);
  });

  it("projects array-composite references as one value without flattening", () => {
    const layer = (offset: number) => ({
      blur: { unit: "px", value: offset },
      color: { colorSpace: "srgb", components: [0, 0, 0] },
      offsetX: { unit: "px", value: offset },
      offsetY: { unit: "px", value: offset },
      spread: { unit: "px", value: 0 },
    });
    const document = {
      base: { $type: "shadow", $value: [layer(1), layer(2)] },
      composed: { $type: "shadow", $value: ["{base}", layer(3)] },
    };
    const admission = admitThemeAuthoringDocument(
      oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
    );
    if (!admission.ok) throw new TypeError(JSON.stringify(admission.diagnostics[0]));
    expect(
      admission.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
        featureId,
        diagnostic.pointer,
      ]),
    ).toContainEqual(["PROPERTY_LEVEL_REF", "/composed/$value/0"]);
    const created = createThemeAuthoringSession(admission.document);
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    expect(created.session.preview.ok).toBe(false);
    expect(
      JSON.parse(exportThemeAuthoringDocument(created.session).text).themes[0].base.document,
    ).toEqual(document);
  });

  it("preserves and discloses validated shadow inset literals and property references", () => {
    const layer = {
      blur: { unit: "px", value: 4 },
      color: { colorSpace: "srgb", components: [0, 0, 0] },
      offsetX: { unit: "px", value: 0 },
      offsetY: { unit: "px", value: 2 },
      spread: { unit: "px", value: 0 },
    };
    const document = {
      base: { $type: "shadow", $value: { ...layer, inset: true } },
      layered: {
        $type: "shadow",
        $value: [{ ...layer, inset: false }, { ...layer }],
      },
      derived: {
        $type: "shadow",
        $value: { ...layer, inset: { $ref: "#/base/$value/inset" } },
      },
    };
    const created = createThemeAuthoringSession(
      oneModeDocument(document, { marker: { $type: "number", $value: 0 } }),
    );
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    expect(created.session.preview.ok).toBe(false);
    const exported = exportThemeAuthoringDocument(created.session);
    expect(
      exported.report.preservedUnsupportedFeatures.map(({ featureId, diagnostic }) => [
        featureId,
        diagnostic.pointer,
        diagnostic.tokenPath,
      ]),
    ).toEqual([
      ["PROPERTY_LEVEL_REF", "/derived/$value/inset/$ref", "derived"],
      ["SHADOW_INSET", "/base/$value/inset", "base"],
      ["SHADOW_INSET", "/derived/$value/inset", "derived"],
      ["SHADOW_INSET", "/layered/$value/0/inset", "layered"],
    ]);
    expect(JSON.parse(exported.text).themes[0].base.document).toEqual(document);
    expect(exported.report.losses).toEqual([]);
    expect(importThemeAuthoringDocument(created.session, exported.text)).toEqual({
      changed: false,
      ok: true,
      session: created.session,
    });

    for (const [id, inset] of [
      ["shadow-inset-non-boolean", "yes"],
      ["shadow-inset-ref-wrong-shape", { $ref: "#/weight/$value" }],
    ] as const) {
      const invalidDocument = {
        shadow: { $type: "shadow", $value: { ...layer, inset } },
        weight: { $type: "number", $value: 1 },
      };
      const live = session();
      const imported = importThemeAuthoringDocument(
        live,
        JSON.stringify(
          oneModeDocument(invalidDocument, { marker: { $type: "number", $value: 0 } }),
        ),
      );
      expect(imported.ok, id).toBe(false);
      expect(imported.session, id).toBe(live);
      if (imported.ok) throw new TypeError(`${id} inset must be rejected.`);
      expect(imported.diagnostics[0].cause, id).toMatchObject({
        code: "INVALID_DTCG_VALUE",
        pointer: "/shadow/$value/inset",
      });
    }

    const emptyArray = admitThemeAuthoringDocument(
      oneModeDocument(
        { shadow: { $type: "shadow", $value: [] } },
        { marker: { $type: "number", $value: 0 } },
      ),
    );
    expect(emptyArray.ok).toBe(false);
    if (emptyArray.ok) throw new TypeError("An empty shadow array must be rejected.");
    expect(emptyArray.diagnostics[0].cause).toMatchObject({
      code: "LIMIT_EXCEEDED",
      pointer: "/shadow/$value",
    });
  });

  it("keeps opaque validated features unchanged through supported edits and self-roundtrip", () => {
    const opaque = {
      base: {
        $type: "fontFamily",
        family: { $value: ["Inter", "sans-serif"] },
      },
      derived: { $extends: "{base}", family: { $value: "Inter Tight" } },
      empty: { $description: "Retain me." },
      gamut: {
        $type: "color",
        $value: { colorSpace: "display-p3", components: [0.1, "none", 0.3] },
      },
    };
    const created = createThemeAuthoringSession(
      oneModeDocument(opaque, { marker: { $type: "number", $value: 0 } }),
    );
    if (!created.ok) throw new TypeError(JSON.stringify(created.diagnostics[0]));
    const changed = applyThemeAuthoringEdit(created.session, {
      kind: "create-literal",
      path: "safe.added",
      sourceId: "test.base",
      themeId: "test-theme",
      type: "number",
      value: 2,
    });
    if (!changed.ok) throw new TypeError(JSON.stringify(changed.diagnostics[0]));
    const exported = exportThemeAuthoringDocument(changed.session);
    const output = JSON.parse(exported.text).themes[0].base.document;
    expect(output.base).toEqual(opaque.base);
    expect(output.derived).toEqual(opaque.derived);
    expect(output.empty).toEqual(opaque.empty);
    expect(output.gamut).toEqual(opaque.gamut);
    expect(exported.report.losses).toEqual([]);
    const reimported = importThemeAuthoringDocument(changed.session, exported.text);
    expect(reimported).toEqual({ changed: false, ok: true, session: changed.session });
  });
});
