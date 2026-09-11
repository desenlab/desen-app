import {
  DESEN_NEUTRAL_THEME_DOCUMENT,
  applyThemeAuthoringEdit,
  createThemeAuthoringSession,
  exportThemeAuthoringDocument,
  importThemeAuthoringDocument,
  redoThemeAuthoringEdit,
  selectThemeAuthoringMode,
  undoThemeAuthoringEdit,
} from "@desen/design-system-authoring";
import { useEffect, useState } from "react";

import type {
  ThemeAuthoringDiagnostic,
  ThemeAuthoringSession,
  ThemeAuthoringTransitionResult,
} from "@desen/design-system-authoring";
import type { CSSProperties } from "react";

interface TypographyDraft {
  readonly family: string;
  readonly fontSize: string;
  readonly fontSizeUnit: DimensionUnit;
  readonly fontWeight: string;
  readonly letterSpacing: string;
  readonly letterSpacingUnit: DimensionUnit;
  readonly lineHeight: string;
}

type DimensionUnit = "px" | "rem";

interface DimensionPreview {
  readonly unit: DimensionUnit;
  readonly value: number;
}

interface TypographyPreview {
  readonly family: readonly string[];
  readonly fontSize: DimensionPreview;
  readonly fontWeight: number | string;
  readonly letterSpacing: DimensionPreview;
  readonly lineHeight: number;
}

interface ColorDraft {
  readonly alpha: string;
  readonly blue: string;
  readonly green: string;
  readonly hex: string;
  readonly red: string;
}

interface WorkbenchStatus {
  readonly kind: "error" | "quiet" | "success";
  readonly message: string;
}

const NEUTRAL_THEME_ID = "desen-neutral";
const DEFAULT_TYPOGRAPHY = Object.freeze<TypographyPreview>({
  family: Object.freeze(["Inter", "ui-sans-serif", "sans-serif"]),
  fontSize: Object.freeze({ unit: "px", value: 16 }),
  fontWeight: 400,
  letterSpacing: Object.freeze({ unit: "px", value: 0 }),
  lineHeight: 1.5,
});
const CSS_FONT_WEIGHT_BY_DTCG_NAME = Object.freeze({
  black: 900,
  bold: 700,
  book: 400,
  "demi-bold": 600,
  "extra-black": 950,
  "extra-bold": 800,
  "extra-light": 200,
  hairline: 100,
  heavy: 900,
  light: 300,
  medium: 500,
  normal: 400,
  regular: 400,
  "semi-bold": 600,
  thin: 100,
  "ultra-black": 950,
  "ultra-bold": 800,
  "ultra-light": 200,
} as const);

function formatDiagnostics(diagnostics: readonly ThemeAuthoringDiagnostic[]): string {
  return diagnostics.map((issue) => `${issue.code}: ${issue.message}`).join(" ");
}

function createInitialSession(): ThemeAuthoringSession {
  const result = createThemeAuthoringSession(DESEN_NEUTRAL_THEME_DOCUMENT, {
    modeId: "light",
    themeId: NEUTRAL_THEME_ID,
  });
  if (!result.ok) {
    throw new TypeError(`DESEN Neutral could not open: ${formatDiagnostics(result.diagnostics)}`);
  }
  return result.session;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolvedValue(session: ThemeAuthoringSession, path: string): unknown {
  return session.preview.ok ? session.preview.tokens[path]?.value : undefined;
}

function colorToHex(value: unknown, fallback: string): string {
  if (!isRecord(value) || value.colorSpace !== "srgb" || !Array.isArray(value.components)) {
    return fallback;
  }
  const components = value.components;
  if (
    components.length !== 3 ||
    components.some((component) => typeof component !== "number" || !Number.isFinite(component))
  ) {
    return fallback;
  }
  return `#${components
    .map((component) => Math.round(Math.max(0, Math.min(1, component as number)) * 255))
    .map((component) => component.toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorToCss(value: unknown, fallback: string): string {
  if (!isRecord(value) || value.colorSpace !== "srgb" || !Array.isArray(value.components)) {
    return fallback;
  }
  const components = value.components;
  if (
    components.length !== 3 ||
    components.some((component) => typeof component !== "number" || !Number.isFinite(component))
  ) {
    return fallback;
  }
  const alpha = typeof value.alpha === "number" ? value.alpha : 1;
  return `color(srgb ${components.join(" ")} / ${alpha})`;
}

function colorDraftFromValue(value: unknown, fallback: string): ColorDraft {
  if (!isRecord(value) || value.colorSpace !== "srgb" || !Array.isArray(value.components)) {
    return { alpha: "1", blue: "0", green: "0", hex: fallback, red: "0" };
  }
  const [red, green, blue] = value.components;
  if (![red, green, blue].every((component) => typeof component === "number")) {
    return { alpha: "1", blue: "0", green: "0", hex: fallback, red: "0" };
  }
  return {
    alpha: String(typeof value.alpha === "number" ? value.alpha : 1),
    blue: String(blue),
    green: String(green),
    hex: colorToHex(value, fallback),
    red: String(red),
  };
}

function colorDraftFromHex(hex: string, currentAlpha: string): ColorDraft | undefined {
  if (!/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(hex)) return undefined;
  const normalized = hex.toLowerCase();
  const components = [1, 3, 5].map(
    (offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255,
  );
  return {
    alpha:
      normalized.length === 9
        ? String(Number.parseInt(normalized.slice(7, 9), 16) / 255)
        : currentAlpha,
    blue: String(components[2] ?? 0),
    green: String(components[1] ?? 0),
    hex: normalized,
    red: String(components[0] ?? 0),
  };
}

function dimensionValue(value: unknown): DimensionPreview | undefined {
  if (
    !isRecord(value) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    (value.unit !== "px" && value.unit !== "rem")
  ) {
    return undefined;
  }
  return { unit: value.unit, value: value.value };
}

function fontWeightToCss(value: number | string): number {
  if (typeof value === "number") return value;
  return (
    CSS_FONT_WEIGHT_BY_DTCG_NAME[value as keyof typeof CSS_FONT_WEIGHT_BY_DTCG_NAME] ??
    DEFAULT_TYPOGRAPHY.fontWeight
  );
}

function typographyFromSession(session: ThemeAuthoringSession): TypographyPreview {
  const value = resolvedValue(session, "typography.body");
  if (!isRecord(value)) return DEFAULT_TYPOGRAPHY;
  const rawFamily = value.fontFamily;
  const family =
    typeof rawFamily === "string"
      ? [rawFamily]
      : Array.isArray(rawFamily) && rawFamily.every((entry) => typeof entry === "string")
        ? rawFamily
        : DEFAULT_TYPOGRAPHY.family;
  const fontSize = dimensionValue(value.fontSize);
  const letterSpacing = dimensionValue(value.letterSpacing);
  const fontWeight = value.fontWeight;
  const lineHeight = value.lineHeight;
  return Object.freeze({
    family: Object.freeze([...family]),
    fontSize: fontSize ?? DEFAULT_TYPOGRAPHY.fontSize,
    fontWeight:
      typeof fontWeight === "number" || typeof fontWeight === "string"
        ? fontWeight
        : DEFAULT_TYPOGRAPHY.fontWeight,
    letterSpacing: letterSpacing ?? DEFAULT_TYPOGRAPHY.letterSpacing,
    lineHeight: typeof lineHeight === "number" ? lineHeight : DEFAULT_TYPOGRAPHY.lineHeight,
  });
}

function draftFromTypography(typography: TypographyPreview): TypographyDraft {
  return {
    family: typography.family.join(", "),
    fontSize: String(typography.fontSize.value),
    fontSizeUnit: typography.fontSize.unit,
    fontWeight: String(typography.fontWeight),
    letterSpacing: String(typography.letterSpacing.value),
    letterSpacingUnit: typography.letterSpacing.unit,
    lineHeight: String(typography.lineHeight),
  };
}

function aliasTargetFor(session: ThemeAuthoringSession, path: string): string {
  if (!session.preview.ok) return "";
  return session.preview.controls.find((control) => control.path === path)?.aliasTarget ?? "";
}

const INITIAL_SESSION = createInitialSession();
const INITIAL_TRANSFER = exportThemeAuthoringDocument(INITIAL_SESSION);

export function WorkbenchApplication() {
  const [session, setSession] = useState(INITIAL_SESSION);
  const [status, setStatus] = useState<WorkbenchStatus>({
    kind: "quiet",
    message: "DESEN Neutral is ready for local editing.",
  });
  const [colorDraft, setColorDraft] = useState(() =>
    colorDraftFromValue(resolvedValue(INITIAL_SESSION, "palette.action"), "#171717"),
  );
  const [typographyDraft, setTypographyDraft] = useState(() =>
    draftFromTypography(typographyFromSession(INITIAL_SESSION)),
  );
  const [aliasDraft, setAliasDraft] = useState(() =>
    aliasTargetFor(INITIAL_SESSION, "color.action"),
  );
  const [transferText, setTransferText] = useState(INITIAL_TRANSFER.text);
  const [roundTrip, setRoundTrip] = useState<"stable" | "unknown">("unknown");
  const [importRetention, setImportRetention] = useState<"retained" | "unknown">("unknown");
  const [themeNameDraft, setThemeNameDraft] = useState("DESEN Neutral");
  const [newThemeId, setNewThemeId] = useState("brand");
  const [newThemeName, setNewThemeName] = useState("Brand system");
  const [modeNameDraft, setModeNameDraft] = useState("Light");
  const [newModeId, setNewModeId] = useState("custom");
  const [newModeName, setNewModeName] = useState("Custom mode");
  const [tokenScope, setTokenScope] = useState<"base" | "mode">("base");
  const [newTokenPath, setNewTokenPath] = useState("palette.brand");
  const [newTokenTemplate, setNewTokenTemplate] = useState<"color" | "typography">("color");
  const [newAliasPath, setNewAliasPath] = useState("color.brand");
  const [newAliasTarget, setNewAliasTarget] = useState("palette.action");

  const currentTransfer = exportThemeAuthoringDocument(session);
  const previewTypography = typographyFromSession(session);
  const actionColorValue = resolvedValue(session, "color.action");
  const actionColor = colorToHex(resolvedValue(session, "color.action"), "#171717");
  const actionAlpha =
    isRecord(actionColorValue) && typeof actionColorValue.alpha === "number"
      ? actionColorValue.alpha
      : 1;
  const actionColorComponents =
    isRecord(actionColorValue) && Array.isArray(actionColorValue.components)
      ? actionColorValue.components.join(",")
      : "";
  const actionForegroundColor = colorToHex(resolvedValue(session, "color.onAction"), "#ffffff");
  const canvasColor = colorToHex(resolvedValue(session, "color.canvas"), "#fafafa");
  const surfaceColor = colorToHex(resolvedValue(session, "color.surface"), "#ffffff");
  const foregroundColor = colorToHex(resolvedValue(session, "color.foreground"), "#171717");
  const focusColor = colorToHex(resolvedValue(session, "color.focus"), "#2563eb");
  const mutedColor = colorToHex(resolvedValue(session, "color.muted"), "#525252");
  const borderColor = colorToHex(resolvedValue(session, "color.border"), "#e5e5e5");
  const selectedTheme = session.document.themes.find(
    (theme) => theme.id === session.selection.themeId,
  );
  const selectedMode = selectedTheme?.modes.find((mode) => mode.id === session.selection.modeId);
  const previewStyle = {
    "--preview-action": colorToCss(actionColorValue, actionColor),
    "--preview-action-foreground": colorToCss(
      resolvedValue(session, "color.onAction"),
      actionForegroundColor,
    ),
    "--preview-border": colorToCss(resolvedValue(session, "color.border"), borderColor),
    "--preview-canvas": colorToCss(resolvedValue(session, "color.canvas"), canvasColor),
    "--preview-font-family": previewTypography.family.join(", "),
    "--preview-font-size": `${previewTypography.fontSize.value}${previewTypography.fontSize.unit}`,
    "--preview-font-weight": String(fontWeightToCss(previewTypography.fontWeight)),
    "--preview-foreground": colorToCss(resolvedValue(session, "color.foreground"), foregroundColor),
    "--preview-focus": colorToCss(resolvedValue(session, "color.focus"), focusColor),
    "--preview-letter-spacing": `${previewTypography.letterSpacing.value}${previewTypography.letterSpacing.unit}`,
    "--preview-line-height": String(previewTypography.lineHeight),
    "--preview-muted": colorToCss(resolvedValue(session, "color.muted"), mutedColor),
    "--preview-surface": colorToCss(resolvedValue(session, "color.surface"), surfaceColor),
  } as CSSProperties;

  useEffect(() => {
    setColorDraft(colorDraftFromValue(resolvedValue(session, "palette.action"), "#171717"));
    setTypographyDraft(draftFromTypography(typographyFromSession(session)));
    setAliasDraft(aliasTargetFor(session, "color.action"));
    const theme = session.document.themes.find(({ id }) => id === session.selection.themeId);
    const mode = theme?.modes.find(({ id }) => id === session.selection.modeId);
    if (theme !== undefined) setThemeNameDraft(theme.name);
    if (mode !== undefined) setModeNameDraft(mode.name);
  }, [session.revision]);

  function acceptTransition(result: ThemeAuthoringTransitionResult, successMessage: string): void {
    setSession(result.session);
    setRoundTrip("unknown");
    setImportRetention("unknown");
    if (!result.ok) {
      setStatus({ kind: "error", message: formatDiagnostics(result.diagnostics) });
      return;
    }
    setStatus({
      kind: result.changed ? "success" : "quiet",
      message: result.changed ? successMessage : "The requested state was already selected.",
    });
  }

  function applyColor(): void {
    const components = [colorDraft.red, colorDraft.green, colorDraft.blue].map(Number);
    const alpha = Number(colorDraft.alpha);
    if (
      !/^#[\da-f]{6}(?:[\da-f]{2})?$/iu.test(colorDraft.hex) ||
      ![...components, alpha].every(Number.isFinite)
    ) {
      setStatus({ kind: "error", message: "Enter finite sRGB components and alpha." });
      return;
    }
    if (selectedMode === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "set-literal",
        path: "palette.action",
        sourceId: selectedMode.source.id,
        themeId: session.selection.themeId,
        type: "color",
        value: {
          alpha,
          colorSpace: "srgb",
          components: [components[0] ?? 0, components[1] ?? 0, components[2] ?? 0],
        },
      }),
      `${selectedMode.name} action color updated.`,
    );
  }

  function applyTypography(): void {
    const fontSize = Number(typographyDraft.fontSize);
    const trimmedWeight = typographyDraft.fontWeight.trim();
    const fontWeight = /^\d+$/u.test(trimmedWeight) ? Number(trimmedWeight) : trimmedWeight;
    const letterSpacing = Number(typographyDraft.letterSpacing);
    const lineHeight = Number(typographyDraft.lineHeight);
    const family = typographyDraft.family
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (
      family.length === 0 ||
      trimmedWeight.length === 0 ||
      ![fontSize, letterSpacing, lineHeight].every(Number.isFinite)
    ) {
      setStatus({
        kind: "error",
        message: "Typography requires a family and finite numeric values.",
      });
      return;
    }
    if (selectedTheme === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "set-literal",
        path: "typography.body",
        sourceId: selectedTheme.base.id,
        themeId: session.selection.themeId,
        type: "typography",
        value: {
          fontFamily: family,
          fontSize: { unit: typographyDraft.fontSizeUnit, value: fontSize },
          fontWeight,
          letterSpacing: { unit: typographyDraft.letterSpacingUnit, value: letterSpacing },
          lineHeight,
        },
      }),
      "Body typography updated as one composite token.",
    );
  }

  function applyAlias(): void {
    if (selectedTheme === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "set-alias",
        path: "color.action",
        sourceId: selectedTheme.base.id,
        targetPath: aliasDraft.trim(),
        themeId: session.selection.themeId,
        type: "color",
      }),
      `color.action now references ${aliasDraft.trim()}.`,
    );
  }

  function duplicateTheme(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        fromThemeId: session.selection.themeId,
        kind: "duplicate-theme",
        name: newThemeName.trim(),
        themeId: newThemeId.trim(),
      }),
      `Theme ${newThemeName.trim()} created from the selected foundation.`,
    );
  }

  function renameTheme(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "rename-theme",
        name: themeNameDraft.trim(),
        themeId: session.selection.themeId,
      }),
      "Theme renamed.",
    );
  }

  function deleteTheme(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "delete-theme",
        themeId: session.selection.themeId,
      }),
      "Theme deleted.",
    );
  }

  function duplicateMode(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        fromModeId: session.selection.modeId,
        kind: "duplicate-mode",
        modeId: newModeId.trim(),
        name: newModeName.trim(),
        themeId: session.selection.themeId,
      }),
      `Mode ${newModeName.trim()} created from the selected mode.`,
    );
  }

  function renameMode(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "rename-mode",
        modeId: session.selection.modeId,
        name: modeNameDraft.trim(),
        themeId: session.selection.themeId,
      }),
      "Mode renamed.",
    );
  }

  function deleteMode(): void {
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "delete-mode",
        modeId: session.selection.modeId,
        themeId: session.selection.themeId,
      }),
      "Mode deleted.",
    );
  }

  function authoringSourceId(): string | undefined {
    return tokenScope === "base" ? selectedTheme?.base.id : selectedMode?.source.id;
  }

  function createToken(): void {
    const sourceId = authoringSourceId();
    const value =
      newTokenTemplate === "color"
        ? resolvedValue(session, "color.action")
        : resolvedValue(session, "typography.body");
    if (sourceId === undefined || value === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "create-literal",
        path: newTokenPath.trim(),
        sourceId,
        themeId: session.selection.themeId,
        type: newTokenTemplate,
        value,
      }),
      `${newTokenPath.trim()} created from the resolved ${newTokenTemplate} value.`,
    );
  }

  function createAlias(): void {
    const sourceId = authoringSourceId();
    if (sourceId === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "create-alias",
        path: newAliasPath.trim(),
        sourceId,
        targetPath: newAliasTarget.trim(),
        themeId: session.selection.themeId,
        type: "color",
      }),
      `${newAliasPath.trim()} now references ${newAliasTarget.trim()}.`,
    );
  }

  function deleteToken(): void {
    const sourceId = authoringSourceId();
    if (sourceId === undefined) return;
    acceptTransition(
      applyThemeAuthoringEdit(session, {
        kind: "delete-token",
        path: newTokenPath.trim(),
        sourceId,
        themeId: session.selection.themeId,
      }),
      `${newTokenPath.trim()} deleted.`,
    );
  }

  function exportDocument(): void {
    const output = exportThemeAuthoringDocument(session);
    setTransferText(output.text);
    setRoundTrip("unknown");
    setImportRetention("unknown");
    setStatus({ kind: "success", message: "Canonical theme document exported without loss." });
  }

  function reimportCurrentExport(): void {
    const output = exportThemeAuthoringDocument(session);
    const result = importThemeAuthoringDocument(session, output.text);
    if (!result.ok) {
      setSession(result.session);
      setRoundTrip("unknown");
      setStatus({ kind: "error", message: formatDiagnostics(result.diagnostics) });
      return;
    }
    const reexport = exportThemeAuthoringDocument(result.session);
    const stable = reexport.text === output.text;
    setSession(result.session);
    setTransferText(reexport.text);
    setRoundTrip(stable ? "stable" : "unknown");
    setImportRetention("unknown");
    setStatus({
      kind: stable ? "success" : "error",
      message: stable
        ? "Export and reimport are byte-stable."
        : "The reimported document did not reproduce the canonical export.",
    });
  }

  function importDocument(): void {
    const before = exportThemeAuthoringDocument(session);
    const result = importThemeAuthoringDocument(session, transferText);
    setSession(result.session);
    setRoundTrip("unknown");
    if (!result.ok) {
      const retained = exportThemeAuthoringDocument(result.session).text === before.text;
      setImportRetention(retained ? "retained" : "unknown");
      setStatus({
        kind: "error",
        message: retained
          ? `Import rejected; working data retained. ${formatDiagnostics(result.diagnostics)}`
          : formatDiagnostics(result.diagnostics),
      });
      return;
    }
    const output = exportThemeAuthoringDocument(result.session);
    setTransferText(output.text);
    setImportRetention("unknown");
    setStatus({
      kind: result.changed ? "success" : "quiet",
      message: result.changed
        ? output.report.preservedUnsupportedFeatures.length > 0
          ? `Complete theme document imported; ${output.report.preservedUnsupportedFeatures.length} unsupported standard feature preserved and excluded from preview authority.`
          : "Complete theme document imported."
        : "Import matches working data.",
    });
  }

  return (
    <main
      className="workbench"
      data-alias-target={session.preview.ok ? aliasTargetFor(session, "color.action") : undefined}
      data-canonical-bytes={currentTransfer.report.canonicalBytes}
      data-color-action-alpha={session.preview.ok ? actionAlpha : undefined}
      data-color-action-components={session.preview.ok ? actionColorComponents : undefined}
      data-history-future={session.future.length}
      data-history-past={session.past.length}
      data-import-retention={importRetention}
      data-live-preview={session.preview.ok ? "ready" : "unavailable"}
      data-mode={session.selection.modeId}
      data-proof-ready="workbench"
      data-revision={session.revision}
      data-roundtrip={roundTrip}
      data-theme={session.selection.themeId}
    >
      <header className="topbar">
        <div className="brand-lockup" aria-label="DESEN theme workbench">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span>DESEN</span>
          <span className="product-label">Theme workbench</span>
        </div>
        <div className="session-meta" aria-label="Local session information">
          <span>Local only</span>
          <span aria-hidden="true">·</span>
          <span>Revision {session.revision}</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="editor-panel" aria-label="Theme controls">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Foundation</p>
              <h1>{selectedTheme?.name ?? "DESEN Neutral"}</h1>
            </div>
            <span className="status-dot">Editable</span>
          </div>

          <section className="control-section" aria-labelledby="mode-heading">
            <div className="section-heading">
              <h2 id="mode-heading">Appearance</h2>
              <span>{selectedTheme?.modes.length ?? 0} modes</span>
            </div>
            <label className="field field--section-lead">
              <span>Theme</span>
              <select
                aria-label="Theme"
                onChange={(event) => {
                  const theme = session.document.themes.find(
                    ({ id }) => id === event.currentTarget.value,
                  );
                  const mode = theme?.modes[0];
                  if (theme === undefined || mode === undefined) return;
                  acceptTransition(
                    selectThemeAuthoringMode(session, {
                      modeId: mode.id,
                      themeId: theme.id,
                    }),
                    `${theme.name} selected.`,
                  );
                }}
                value={session.selection.themeId}
              >
                {session.document.themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented-control" aria-label="Theme mode">
              {selectedTheme?.modes.map((mode) => (
                <button
                  aria-pressed={session.selection.modeId === mode.id}
                  className="segment"
                  key={mode.id}
                  onClick={() => {
                    acceptTransition(
                      selectThemeAuthoringMode(session, {
                        modeId: mode.id,
                        themeId: session.selection.themeId,
                      }),
                      `${mode.name} mode selected.`,
                    );
                  }}
                  type="button"
                >
                  <span className={`mode-glyph mode-glyph--${mode.id}`} aria-hidden="true" />
                  {mode.name}
                </button>
              ))}
            </div>
          </section>

          <section className="control-section" aria-labelledby="structure-heading">
            <div className="section-heading">
              <h2 id="structure-heading">Theme structure</h2>
              <span>Named &amp; local</span>
            </div>
            <div className="structure-stack">
              <div className="structure-block">
                <label className="field">
                  <span>Theme name</span>
                  <input
                    onChange={(event) => {
                      setThemeNameDraft(event.currentTarget.value);
                    }}
                    value={themeNameDraft}
                  />
                </label>
                <div className="button-row button-row--wrap">
                  <button className="secondary-button" onClick={renameTheme} type="button">
                    Rename theme
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={session.document.themes.length === 1}
                    onClick={deleteTheme}
                    type="button"
                  >
                    Delete theme
                  </button>
                </div>
              </div>

              <div className="structure-block">
                <div className="field-grid">
                  <label className="field">
                    <span>New theme ID</span>
                    <input
                      onChange={(event) => {
                        setNewThemeId(event.currentTarget.value);
                      }}
                      spellCheck={false}
                      value={newThemeId}
                    />
                  </label>
                  <label className="field">
                    <span>New theme name</span>
                    <input
                      onChange={(event) => {
                        setNewThemeName(event.currentTarget.value);
                      }}
                      value={newThemeName}
                    />
                  </label>
                </div>
                <button
                  className="secondary-button secondary-button--full"
                  onClick={duplicateTheme}
                  type="button"
                >
                  Duplicate selected theme
                </button>
              </div>

              <div className="structure-block">
                <label className="field">
                  <span>Mode name</span>
                  <input
                    onChange={(event) => {
                      setModeNameDraft(event.currentTarget.value);
                    }}
                    value={modeNameDraft}
                  />
                </label>
                <div className="button-row button-row--wrap">
                  <button className="secondary-button" onClick={renameMode} type="button">
                    Rename mode
                  </button>
                  <button
                    className="secondary-button destructive-button"
                    disabled={(selectedTheme?.modes.length ?? 0) === 1}
                    onClick={deleteMode}
                    type="button"
                  >
                    Delete mode
                  </button>
                </div>
              </div>

              <div className="structure-block">
                <div className="field-grid">
                  <label className="field">
                    <span>New mode ID</span>
                    <input
                      onChange={(event) => {
                        setNewModeId(event.currentTarget.value);
                      }}
                      spellCheck={false}
                      value={newModeId}
                    />
                  </label>
                  <label className="field">
                    <span>New mode name</span>
                    <input
                      onChange={(event) => {
                        setNewModeName(event.currentTarget.value);
                      }}
                      value={newModeName}
                    />
                  </label>
                </div>
                <button
                  className="secondary-button secondary-button--full"
                  onClick={duplicateMode}
                  type="button"
                >
                  Duplicate selected mode
                </button>
              </div>
            </div>
          </section>

          <section className="control-section" aria-labelledby="history-heading">
            <div className="section-heading">
              <h2 id="history-heading">History</h2>
              <span>{session.past.length} edits</span>
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                disabled={session.past.length === 0}
                onClick={() => {
                  acceptTransition(undoThemeAuthoringEdit(session), "Last document edit undone.");
                }}
                type="button"
              >
                Undo
              </button>
              <button
                className="secondary-button"
                disabled={session.future.length === 0}
                onClick={() => {
                  acceptTransition(redoThemeAuthoringEdit(session), "Document edit restored.");
                }}
                type="button"
              >
                Redo
              </button>
            </div>
          </section>

          <section className="control-section" aria-labelledby="color-heading">
            <div className="section-heading">
              <h2 id="color-heading">Action color</h2>
              <code>palette.action</code>
            </div>
            <div className="color-control">
              <label className="color-picker" aria-label="Action color picker">
                <input
                  onChange={(event) => {
                    const next = colorDraftFromHex(event.currentTarget.value, colorDraft.alpha);
                    if (next !== undefined) setColorDraft(next);
                  }}
                  type="color"
                  value={/^#[\da-f]{6}$/iu.test(colorDraft.hex) ? colorDraft.hex : "#171717"}
                />
              </label>
              <label className="field field--grow">
                <span>Hex value</span>
                <input
                  aria-label="Action color hex"
                  onChange={(event) => {
                    const hex = event.currentTarget.value;
                    setColorDraft(
                      colorDraftFromHex(hex, colorDraft.alpha) ?? { ...colorDraft, hex },
                    );
                  }}
                  spellCheck={false}
                  value={colorDraft.hex}
                />
              </label>
              <button className="icon-button" onClick={applyColor} type="button">
                Apply color
              </button>
            </div>
            <div className="component-grid" aria-label="Exact sRGB color channels">
              {(
                [
                  ["Red", "red"],
                  ["Green", "green"],
                  ["Blue", "blue"],
                  ["Alpha", "alpha"],
                ] as const
              ).map(([label, key]) => (
                <label className="field" key={key}>
                  <span>{label} · 0–1</span>
                  <input
                    aria-label={`sRGB ${label.toLowerCase()} component`}
                    inputMode="decimal"
                    onChange={(event) => {
                      setColorDraft({ ...colorDraft, [key]: event.currentTarget.value });
                    }}
                    value={colorDraft[key]}
                  />
                </label>
              ))}
            </div>
            <p className="control-note">
              Hex is a convenience view; exact validator-admitted channel and alpha decimals remain
              editable.
            </p>
          </section>

          <section className="control-section" aria-labelledby="type-heading">
            <div className="section-heading">
              <h2 id="type-heading">Body typography</h2>
              <span className="atomic-badge">Atomic composite</span>
            </div>
            <div className="field-grid">
              <label className="field field--wide">
                <span>Font family</span>
                <input
                  onChange={(event) => {
                    setTypographyDraft({ ...typographyDraft, family: event.currentTarget.value });
                  }}
                  value={typographyDraft.family}
                />
              </label>
              <label className="field">
                <span>Size</span>
                <span className="value-with-unit">
                  <input
                    aria-label="Font size value"
                    inputMode="decimal"
                    onChange={(event) => {
                      setTypographyDraft({
                        ...typographyDraft,
                        fontSize: event.currentTarget.value,
                      });
                    }}
                    value={typographyDraft.fontSize}
                  />
                  <select
                    aria-label="Font size unit"
                    onChange={(event) => {
                      setTypographyDraft({
                        ...typographyDraft,
                        fontSizeUnit: event.currentTarget.value as DimensionUnit,
                      });
                    }}
                    value={typographyDraft.fontSizeUnit}
                  >
                    <option value="px">px</option>
                    <option value="rem">rem</option>
                  </select>
                </span>
              </label>
              <label className="field">
                <span>Weight</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => {
                    setTypographyDraft({
                      ...typographyDraft,
                      fontWeight: event.currentTarget.value,
                    });
                  }}
                  value={typographyDraft.fontWeight}
                />
              </label>
              <label className="field">
                <span>Tracking</span>
                <span className="value-with-unit">
                  <input
                    aria-label="Letter spacing value"
                    inputMode="decimal"
                    onChange={(event) => {
                      setTypographyDraft({
                        ...typographyDraft,
                        letterSpacing: event.currentTarget.value,
                      });
                    }}
                    value={typographyDraft.letterSpacing}
                  />
                  <select
                    aria-label="Letter spacing unit"
                    onChange={(event) => {
                      setTypographyDraft({
                        ...typographyDraft,
                        letterSpacingUnit: event.currentTarget.value as DimensionUnit,
                      });
                    }}
                    value={typographyDraft.letterSpacingUnit}
                  >
                    <option value="px">px</option>
                    <option value="rem">rem</option>
                  </select>
                </span>
              </label>
              <label className="field">
                <span>Line height</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => {
                    setTypographyDraft({
                      ...typographyDraft,
                      lineHeight: event.currentTarget.value,
                    });
                  }}
                  value={typographyDraft.lineHeight}
                />
              </label>
            </div>
            <button
              className="primary-button primary-button--full"
              onClick={applyTypography}
              type="button"
            >
              Apply typography
            </button>
          </section>

          <section className="control-section" aria-labelledby="alias-heading">
            <div className="section-heading">
              <h2 id="alias-heading">Semantic alias</h2>
              <code>color.action</code>
            </div>
            <label className="field">
              <span>Target token path</span>
              <input
                aria-label="Action alias target"
                list="neutral-color-targets"
                onChange={(event) => {
                  setAliasDraft(event.currentTarget.value);
                }}
                spellCheck={false}
                value={aliasDraft}
              />
            </label>
            <datalist id="neutral-color-targets">
              <option value="palette.action" />
              <option value="palette.foreground" />
              <option value="palette.muted" />
            </datalist>
            <button
              className="secondary-button secondary-button--full"
              onClick={applyAlias}
              type="button"
            >
              Apply alias
            </button>
          </section>

          <section className="control-section" aria-labelledby="inventory-heading">
            <div className="section-heading">
              <h2 id="inventory-heading">Token inventory</h2>
              <span>Create &amp; remove</span>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Authoring scope</span>
                <select
                  aria-label="Token authoring scope"
                  onChange={(event) => {
                    setTokenScope(event.currentTarget.value as "base" | "mode");
                  }}
                  value={tokenScope}
                >
                  <option value="base">Theme base</option>
                  <option value="mode">Selected mode</option>
                </select>
              </label>
              <label className="field">
                <span>Literal template</span>
                <select
                  aria-label="Token literal template"
                  onChange={(event) => {
                    setNewTokenTemplate(event.currentTarget.value as "color" | "typography");
                  }}
                  value={newTokenTemplate}
                >
                  <option value="color">Resolved action color</option>
                  <option value="typography">Resolved body typography</option>
                </select>
              </label>
              <label className="field field--wide">
                <span>Token path</span>
                <input
                  aria-label="New token path"
                  onChange={(event) => {
                    setNewTokenPath(event.currentTarget.value);
                  }}
                  spellCheck={false}
                  value={newTokenPath}
                />
              </label>
            </div>
            <div className="button-row button-row--wrap">
              <button className="secondary-button" onClick={createToken} type="button">
                Create literal token
              </button>
              <button
                className="secondary-button destructive-button"
                onClick={deleteToken}
                type="button"
              >
                Delete token path
              </button>
            </div>
            <div className="inventory-divider" />
            <div className="field-grid">
              <label className="field">
                <span>New alias path</span>
                <input
                  onChange={(event) => {
                    setNewAliasPath(event.currentTarget.value);
                  }}
                  spellCheck={false}
                  value={newAliasPath}
                />
              </label>
              <label className="field">
                <span>Alias target path</span>
                <input
                  onChange={(event) => {
                    setNewAliasTarget(event.currentTarget.value);
                  }}
                  spellCheck={false}
                  value={newAliasTarget}
                />
              </label>
            </div>
            <button
              className="secondary-button secondary-button--full"
              onClick={createAlias}
              type="button"
            >
              Create whole-token alias
            </button>
            <p className="control-note">
              Every operation is admitted against every mode before it commits to local history.
            </p>
          </section>

          <details className="transfer-panel">
            <summary>Import &amp; export</summary>
            <p>
              Canonical JSON · {currentTransfer.report.canonicalBytes.toLocaleString("en-US")} bytes
              · {currentTransfer.report.losses.length} losses ·{" "}
              {currentTransfer.report.preservedUnsupportedFeatures.length} unsupported preserved
            </p>
            <label className="field">
              <span>Theme document</span>
              <textarea
                aria-label="Export/import document"
                onChange={(event) => {
                  setTransferText(event.currentTarget.value);
                }}
                spellCheck={false}
                value={transferText}
              />
            </label>
            <div className="transfer-actions">
              <button className="secondary-button" onClick={exportDocument} type="button">
                Export document
              </button>
              <button className="secondary-button" onClick={importDocument} type="button">
                Import document
              </button>
              <button className="secondary-button" onClick={reimportCurrentExport} type="button">
                Reimport current export
              </button>
            </div>
          </details>
        </aside>

        <section
          className="preview-stage"
          data-preview-color-action={session.preview.ok ? actionColor : undefined}
          data-preview-color-canvas={session.preview.ok ? canvasColor : undefined}
          data-preview-color-foreground={session.preview.ok ? foregroundColor : undefined}
          data-preview-color-muted={session.preview.ok ? mutedColor : undefined}
          data-preview-font-family={
            session.preview.ok ? previewTypography.family.join(", ") : undefined
          }
          data-preview-font-size={session.preview.ok ? previewTypography.fontSize.value : undefined}
          data-preview-font-size-unit={
            session.preview.ok ? previewTypography.fontSize.unit : undefined
          }
          data-preview-font-weight={session.preview.ok ? previewTypography.fontWeight : undefined}
          data-preview-letter-spacing={
            session.preview.ok ? previewTypography.letterSpacing.value : undefined
          }
          data-preview-letter-spacing-unit={
            session.preview.ok ? previewTypography.letterSpacing.unit : undefined
          }
          style={session.preview.ok ? previewStyle : undefined}
        >
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">Live preview</p>
              <h2>Foundation specimen</h2>
            </div>
            <span className="mode-pill">{session.selection.modeId}</span>
          </div>

          {session.preview.ok ? (
            <div className="preview-canvas">
              <article className="specimen-card">
                <div className="specimen-kicker">{selectedTheme?.name ?? "DESEN Neutral"}</div>
                <h3>Make the system yours.</h3>
                <p>
                  Edit foundation values on the left. This fixed specimen resolves the selected mode
                  immediately, without Publisher, Runtime, or application persistence.
                </p>
                <div className="specimen-actions">
                  <button className="specimen-primary" type="button">
                    Primary action
                  </button>
                  <button className="specimen-secondary" type="button">
                    Secondary
                  </button>
                </div>
                <label className="specimen-field">
                  <span>Project name</span>
                  <input defaultValue="Untitled composition" />
                </label>
                <div className="notice-card">
                  <span className="notice-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    <strong>Foundation connected</strong>
                    <small>Semantic aliases keep the preview coherent across modes.</small>
                  </span>
                </div>
              </article>

              <aside className="token-strip" aria-label="Resolved semantic colors">
                {[
                  ["Canvas", canvasColor],
                  ["Surface", surfaceColor],
                  ["Foreground", foregroundColor],
                  ["Action", actionColor],
                  ["Muted", mutedColor],
                  ["Border", borderColor],
                ].map(([label, value]) => (
                  <div className="token-chip" key={label}>
                    <span className="token-swatch" style={{ backgroundColor: value }} />
                    <span>
                      <strong>{label}</strong>
                      <code>{value}</code>
                    </span>
                  </div>
                ))}
              </aside>
            </div>
          ) : (
            <div aria-live="polite" className="preview-unavailable">
              <span className="preview-unavailable__badge">Preview blocked</span>
              <h3>Selected mode cannot be previewed safely.</h3>
              <p>
                The imported standard data is preserved exactly, but it is outside the frozen T02
                profile. DESEN does not substitute fallback tokens or render a partial specimen.
              </p>
              <code>{session.preview.diagnostics[0].code}</code>
            </div>
          )}

          <footer
            aria-live="polite"
            className={`workbench-status workbench-status--${status.kind}`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            <span aria-hidden="true">{status.kind === "error" ? "!" : "✓"}</span>
            {status.message}
          </footer>
        </section>
      </div>
    </main>
  );
}
