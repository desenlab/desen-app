import { useEffect, useId, useMemo, useState } from "react";

import styles from "./application.module.css";
import { AUTHORING_RESPONSIVE_BREAKPOINTS } from "./authoring-styles.js";
import { formatStructuredJson } from "./structured-json.js";

import type { FormEvent } from "react";
import type { JsonPrimitive, JsonValue } from "@desen/catalog-sdk";
import type {
  AuthoringResponsiveBreakpoint,
  AuthoringResolvedStyleToken,
  AuthoringStyleControl,
  AuthoringStyleEdit,
  AuthoringStyleEditResult,
  AuthoringStyleModelResult,
  AuthoringStyleTarget,
  AuthoringStyleValueState,
} from "./authoring-styles.js";

const BASE_STYLE_TARGET: AuthoringStyleTarget = Object.freeze({ kind: "base" });

const NO_STYLE_VALUE: AuthoringStyleValueState = Object.freeze({ kind: "absent" });

/** Inputs required to render the closed, no-code visual-style authoring panel. */
export interface StylePanelProps {
  /** Closed style projection for the current selection; non-ready states remain non-editable. */
  readonly model: AuthoringStyleModelResult;
  /** Explicit, caller-resolved token choices. The edit boundary remains schema-authoritative. */
  readonly tokenOptions?: readonly AuthoringResolvedStyleToken[] | undefined;
  /** Currently selected desktop/base or app-owned responsive style layer. */
  readonly target?: AuthoringStyleTarget | undefined;
  /** Receives a sealed style-layer choice; raw responsive predicates are never exposed. */
  readonly onTargetChange?: ((target: AuthoringStyleTarget) => void) | undefined;
  /** Receives one closed style leaf mutation and returns its atomic validation outcome. */
  readonly onEdit?: ((edit: AuthoringStyleEdit) => AuthoringStyleEditResult) | undefined;
}

interface StyleControlFieldProps {
  readonly control: AuthoringStyleControl;
  readonly target: AuthoringStyleTarget;
  readonly value: AuthoringStyleValueState;
  readonly tokenOptions: readonly AuthoringResolvedStyleToken[];
  readonly editingEnabled: boolean;
  readonly onEdit: (edit: AuthoringStyleEdit) => void;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isStyleTarget(value: unknown): value is AuthoringStyleTarget {
  if (!isRecord(value)) return false;
  if (value.kind === "base") return Object.keys(value).length === 1;
  return (
    value.kind === "breakpoint" &&
    (value.breakpoint === "tablet" || value.breakpoint === "mobile") &&
    Object.keys(value).length === 2
  );
}

function targetForBreakpoint(breakpoint: AuthoringResponsiveBreakpoint): AuthoringStyleTarget {
  return Object.freeze({ kind: "breakpoint", breakpoint: breakpoint.id });
}

function targetLabel(target: AuthoringStyleTarget): string {
  if (target.kind === "base") return "Desktop";
  return target.breakpoint === "tablet" ? "Tablet" : "Mobile";
}

function selectedValue(
  control: AuthoringStyleControl,
  target: AuthoringStyleTarget,
): AuthoringStyleValueState {
  if (target.kind === "base") return control.base;
  return (
    control.responsive.find(({ breakpoint }) => breakpoint.id === target.breakpoint)?.value ??
    NO_STYLE_VALUE
  );
}

function valueForLiteralEditing(value: AuthoringStyleValueState): JsonValue | undefined {
  if (value.kind === "literal") return value.value;
  if (value.kind === "token") return value.resolvedValue;
  return undefined;
}

function valueStateLabel(value: AuthoringStyleValueState, target: AuthoringStyleTarget): string {
  if (value.kind === "absent") {
    return target.kind === "base" ? "Not set" : "Inherits current cascade";
  }
  if (value.kind === "token") return `Token · ${value.path}`;
  if (value.kind === "unresolved-token") return `Missing token · ${value.path}`;
  if (value.kind === "dynamic") return "Runtime value · locked";
  return "Literal override";
}

function valueFingerprint(value: AuthoringStyleValueState): string {
  if (value.kind === "absent") return "absent";
  if (value.kind === "token")
    return `token:${value.path}:${formatStructuredJson(value.resolvedValue)}`;
  if (value.kind === "unresolved-token") return `unresolved:${value.path}`;
  return `${value.kind}:${formatStructuredJson(value.value)}`;
}

function editFailureMessage(result: AuthoringStyleEditResult): string {
  if (result.ok) return "";
  if (result.reason === "catalog-invalid") {
    return "The current Catalog no longer admits this visual property.";
  }
  if (result.reason === "control-unavailable") {
    return "This exact style layer cannot be changed safely.";
  }
  if (result.reason === "responsive-variant-ambiguous") {
    return "This breakpoint has conflicting authored overrides and remains unchanged.";
  }
  if (result.reason === "responsive-variant-invalid") {
    return "This breakpoint override is not an app-owned responsive layer.";
  }
  if (result.reason === "selection-invalid") {
    return "The selected layer is no longer current.";
  }
  if (result.reason === "token-incompatible") {
    return "That token is not compatible with this visual property.";
  }
  if (result.reason === "token-unknown") return "That token is no longer available.";
  if (result.reason === "value-invalid") {
    return "Enter a value supported by this component’s visual contract.";
  }
  if (result.reason === "source-invalid") {
    return "This edit would make the Source invalid, so it was not applied.";
  }
  return "This visual property could not be updated safely.";
}

function primitiveText(value: JsonPrimitive): string {
  if (value === null) return "Null";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function enumOptions(control: AuthoringStyleControl): readonly JsonPrimitive[] {
  const schema = control.propertiesSchema;
  const options = schema.enum;
  if (!Array.isArray(options) || !options.every(isJsonPrimitive)) return Object.freeze([]);
  return Object.freeze([...options]);
}

function hasEditableLiteral(value: AuthoringStyleValueState): boolean {
  return value.kind !== "dynamic";
}

function styleEdit(
  kind: "reset" | "set-literal" | "set-token",
  target: AuthoringStyleTarget,
  control: AuthoringStyleControl,
  value?: JsonValue | string,
): AuthoringStyleEdit {
  if (kind === "reset") {
    return Object.freeze({ kind, target, part: control.part, property: control.property });
  }
  if (kind === "set-token") {
    return Object.freeze({
      kind,
      target,
      part: control.part,
      property: control.property,
      token: value as string,
    });
  }
  return Object.freeze({
    kind,
    target,
    part: control.part,
    property: control.property,
    value: value as JsonValue,
  });
}

function ControlHeading({
  control,
  target,
  value,
}: Readonly<{
  readonly control: AuthoringStyleControl;
  readonly target: AuthoringStyleTarget;
  readonly value: AuthoringStyleValueState;
}>) {
  return (
    <div className={styles.styleControlHeading}>
      <span>
        <strong>{control.property}</strong>
        <small>{control.part}</small>
      </span>
      <span className={styles.styleValueBadge}>{valueStateLabel(value, target)}</span>
    </div>
  );
}

function ControlProvenance({
  control,
  target,
}: Readonly<{
  readonly control: AuthoringStyleControl;
  readonly target: AuthoringStyleTarget;
}>) {
  const layers = [
    Object.freeze({ label: "Desktop", target: BASE_STYLE_TARGET, value: control.base }),
    ...control.responsive.map(({ breakpoint, value }) =>
      Object.freeze({ label: breakpoint.label, target: targetForBreakpoint(breakpoint), value }),
    ),
  ];
  return (
    <div aria-label={`${control.property} layer provenance`} className={styles.styleProvenance}>
      {layers.map((layer) => (
        <span
          className={
            layer.target.kind === target.kind &&
            (layer.target.kind === "base" ||
              (target.kind === "breakpoint" && layer.target.breakpoint === target.breakpoint))
              ? styles.styleProvenanceActive
              : undefined
          }
          key={layer.label}
        >
          <strong>{layer.label}</strong>
          <small>{valueStateLabel(layer.value, layer.target)}</small>
        </span>
      ))}
    </div>
  );
}

function StyleTokenSelector({
  control,
  target,
  value,
  tokenOptions,
  editingEnabled,
  onEdit,
}: Readonly<StyleControlFieldProps>) {
  const selectId = useId();
  const availableTokens = useMemo(() => {
    const paths = new Set<string>();
    return Object.freeze(
      tokenOptions.filter((token) => {
        if (!control.tokenTypes.includes(token.type)) return false;
        if (paths.has(token.path)) return false;
        paths.add(token.path);
        return token.path.length > 0;
      }),
    );
  }, [control.tokenTypes, tokenOptions]);
  const selectedToken =
    value.kind === "token" && availableTokens.some((token) => token.path === value.path)
      ? value.path
      : "";

  if (availableTokens.length === 0) return null;

  return (
    <label className={styles.styleTokenSelector} htmlFor={selectId}>
      <span>Design token</span>
      <select
        aria-label={`${control.property} design token for ${targetLabel(target)}`}
        disabled={!editingEnabled || !hasEditableLiteral(value)}
        id={selectId}
        onChange={(event) => {
          const path = event.currentTarget.value;
          if (path.length === 0 || !availableTokens.some((token) => token.path === path)) return;
          onEdit(styleEdit("set-token", target, control, path));
        }}
        value={selectedToken}
      >
        <option value="">
          {value.kind === "unresolved-token" ? `Missing · ${value.path}` : "Choose a token"}
        </option>
        {availableTokens.map((token) => (
          <option key={token.path} value={token.path}>
            {token.path} · {token.type}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResetStyleControl({
  control,
  target,
  value,
  editingEnabled,
  onEdit,
}: Readonly<StyleControlFieldProps>) {
  const canReset = editingEnabled && value.kind !== "absent" && value.kind !== "dynamic";
  return (
    <button
      aria-label={`Reset ${control.property} at ${targetLabel(target)}`}
      className={styles.styleResetButton}
      disabled={!canReset}
      onClick={() => onEdit(styleEdit("reset", target, control))}
      type="button"
    >
      Reset layer
    </button>
  );
}

function StyleBooleanControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const literal = valueForLiteralEditing(value);
  const checked = typeof literal === "boolean" && literal;
  return (
    <div className={styles.styleControlActions}>
      <label className={styles.switchControl}>
        <input
          aria-label={`${control.property} at ${targetLabel(target)}`}
          checked={checked}
          disabled={!editingEnabled || !hasEditableLiteral(value)}
          onChange={(event) =>
            onEdit(styleEdit("set-literal", target, control, event.currentTarget.checked))
          }
          role="switch"
          type="checkbox"
        />
        <span aria-hidden="true" className={styles.switchTrack} />
        <span>{checked ? "On" : "Off"}</span>
      </label>
      <ResetStyleControl {...props} />
    </div>
  );
}

function StyleEnumControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const options = enumOptions(control);
  const literal = valueForLiteralEditing(value);
  const selectedIndex = options.findIndex(
    (option) => JSON.stringify(option) === JSON.stringify(literal),
  );

  if (options.length === 0) return <StyleStructuredControl {...props} />;

  return (
    <div className={styles.styleControlActions}>
      <select
        aria-label={`${control.property} at ${targetLabel(target)}`}
        className={styles.stylePrimitiveInput}
        disabled={!editingEnabled || !hasEditableLiteral(value)}
        onChange={(event) => {
          const index = Number(event.currentTarget.value);
          const option = options[index];
          if (option === undefined) return;
          onEdit(styleEdit("set-literal", target, control, option));
        }}
        value={selectedIndex < 0 ? "" : String(selectedIndex)}
      >
        <option disabled value="">
          {value.kind === "absent" ? "Not set" : "Select a value"}
        </option>
        {options.map((option, index) => (
          <option key={`${index}:${primitiveText(option)}`} value={String(index)}>
            {primitiveText(option)}
          </option>
        ))}
      </select>
      <ResetStyleControl {...props} />
    </div>
  );
}

function StylePrimitiveControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const numeric = control.kind === "integer" || control.kind === "number";
  const currentLiteral = valueForLiteralEditing(value);
  const current =
    (numeric && typeof currentLiteral === "number") ||
    (!numeric && typeof currentLiteral === "string")
      ? String(currentLiteral)
      : "";
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  const fingerprint = valueFingerprint(value);

  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, fingerprint]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled || !hasEditableLiteral(value)) return;
    let next: JsonValue = draft;
    if (numeric) {
      const valueAsNumber = Number(draft);
      if (draft.trim() === "" || !Number.isFinite(valueAsNumber)) {
        setError("Enter a finite number.");
        return;
      }
      if (control.kind === "integer" && !Number.isInteger(valueAsNumber)) {
        setError("Enter a whole number.");
        return;
      }
      next = valueAsNumber;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next));
  }

  return (
    <form className={styles.stylePrimitiveForm} onSubmit={submit}>
      <div className={styles.styleControlActions}>
        <input
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-invalid={error.length > 0}
          aria-label={`${control.property} at ${targetLabel(target)}`}
          className={styles.stylePrimitiveInput}
          disabled={!editingEnabled || !hasEditableLiteral(value)}
          inputMode={numeric ? "decimal" : undefined}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setDirty(true);
            setError("");
          }}
          placeholder={value.kind === "absent" ? "Not set" : undefined}
          step={control.kind === "integer" ? 1 : numeric ? "any" : undefined}
          type={numeric ? "number" : "text"}
          value={draft}
        />
        <button
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !hasEditableLiteral(value) || !dirty}
          type="submit"
        >
          Apply
        </button>
        <ResetStyleControl {...props} />
      </div>
      {error.length > 0 ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

const COLOR_PROPERTIES = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
]);

const DIMENSION_PROPERTIES = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "padding",
  "paddingBlock",
  "paddingInline",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginBlock",
  "marginInline",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontSize",
  "letterSpacing",
  "insetTop",
  "insetRight",
  "insetBottom",
  "insetLeft",
  "translateX",
  "translateY",
]);

const SIZING_MODE_PROPERTIES = new Set(["width", "height"]);

const BORDER_STYLES = Object.freeze([
  "solid",
  "dashed",
  "dotted",
  "double",
  "groove",
  "inset",
  "outset",
  "ridge",
] as const);

const TYPOGRAPHY_FAMILIES = Object.freeze([
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

const TYPOGRAPHY_WEIGHTS = Object.freeze([
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
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

interface ColorDraft {
  readonly mode: "hex" | "srgb";
  readonly hex: string;
  readonly red: string;
  readonly green: string;
  readonly blue: string;
  readonly alpha: string;
}

interface DimensionDraft {
  readonly mode: "dimension" | "fill" | "hug";
  readonly value: string;
  readonly unit: "px" | "rem";
}

interface GradientStopDraft {
  readonly color: ColorDraft;
  readonly position: string;
}

interface GradientDraft {
  readonly angle: string;
  readonly stops: readonly GradientStopDraft[];
}

interface BorderDraft {
  readonly color: ColorDraft;
  readonly style: string;
  readonly width: DimensionDraft;
}

interface ShadowLayerDraft {
  readonly color: ColorDraft;
  readonly offsetX: DimensionDraft;
  readonly offsetY: DimensionDraft;
  readonly blur: DimensionDraft;
  readonly spread: DimensionDraft;
  readonly inset: boolean;
}

interface TypographyDraft {
  readonly families: readonly string[];
  readonly fontSize: DimensionDraft;
  readonly fontWeight: string;
  readonly letterSpacing: DimensionDraft;
  readonly lineHeight: string;
}

type TypedValueResult =
  | Readonly<{ readonly ok: true; readonly value: JsonValue }>
  | Readonly<{ readonly ok: false; readonly message: string }>;

function initialColorDraft(forceSrgb = false): ColorDraft {
  return Object.freeze({
    mode: forceSrgb ? "srgb" : "hex",
    hex: "#000000",
    red: "0",
    green: "0",
    blue: "0",
    alpha: "1",
  });
}

function numberText(value: unknown, fallback: string): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : fallback;
}

function colorDraft(value: JsonValue | undefined, forceSrgb = false): ColorDraft {
  if (typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(value)) {
    const red = Number.parseInt(value.slice(1, 3), 16) / 255;
    const green = Number.parseInt(value.slice(3, 5), 16) / 255;
    const blue = Number.parseInt(value.slice(5, 7), 16) / 255;
    const alpha = value.length === 9 ? Number.parseInt(value.slice(7, 9), 16) / 255 : 1;
    return Object.freeze({
      mode: forceSrgb ? "srgb" : "hex",
      hex: value,
      red: String(red),
      green: String(green),
      blue: String(blue),
      alpha: String(alpha),
    });
  }
  if (
    isRecord(value) &&
    value.colorSpace === "srgb" &&
    Array.isArray(value.components) &&
    value.components.length === 3
  ) {
    const [red, green, blue] = value.components;
    if ([red, green, blue].every((component) => typeof component === "number")) {
      return Object.freeze({
        mode: "srgb",
        hex: "#000000",
        red: numberText(red, "0"),
        green: numberText(green, "0"),
        blue: numberText(blue, "0"),
        alpha: numberText(value.alpha, "1"),
      });
    }
  }
  return initialColorDraft(forceSrgb);
}

function colorValue(draft: ColorDraft, forceSrgb = false): TypedValueResult {
  if (draft.mode === "hex" && !forceSrgb) {
    if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu.test(draft.hex)) {
      return Object.freeze({ ok: false, message: "Use a six- or eight-digit hexadecimal color." });
    }
    return Object.freeze({ ok: true, value: draft.hex });
  }
  const components = [Number(draft.red), Number(draft.green), Number(draft.blue)];
  const alpha = Number(draft.alpha);
  if (
    components.some((component) => !Number.isFinite(component) || component < 0 || component > 1) ||
    !Number.isFinite(alpha) ||
    alpha < 0 ||
    alpha > 1
  ) {
    return Object.freeze({
      ok: false,
      message: "sRGB channels and alpha must be between 0 and 1.",
    });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({ colorSpace: "srgb", components: Object.freeze(components), alpha }),
  });
}

function updateColorDraft(draft: ColorDraft, field: keyof ColorDraft, value: string): ColorDraft {
  return Object.freeze({ ...draft, [field]: value }) as ColorDraft;
}

function ColorFields({
  label,
  draft,
  forceSrgb = false,
  disabled,
  onChange,
}: Readonly<{
  readonly label: string;
  readonly draft: ColorDraft;
  readonly forceSrgb?: boolean | undefined;
  readonly disabled: boolean;
  readonly onChange: (next: ColorDraft) => void;
}>) {
  const colorInputValue = /^#[0-9a-f]{6}/iu.test(draft.hex) ? draft.hex.slice(0, 7) : "#000000";
  return (
    <div className={styles.styleTypedEditor}>
      <span className={styles.styleTypedLabel}>{label}</span>
      {!forceSrgb ? (
        <label className={styles.styleCompactField}>
          <span>Format</span>
          <select
            aria-label={`${label} format`}
            disabled={disabled}
            onChange={(event) =>
              onChange(updateColorDraft(draft, "mode", event.currentTarget.value))
            }
            value={draft.mode}
          >
            <option value="hex">Hex</option>
            <option value="srgb">sRGB</option>
          </select>
        </label>
      ) : null}
      {draft.mode === "hex" && !forceSrgb ? (
        <div className={styles.styleColorHexRow}>
          <input
            aria-label={`${label} picker`}
            disabled={disabled}
            onChange={(event) =>
              onChange(updateColorDraft(draft, "hex", event.currentTarget.value))
            }
            type="color"
            value={colorInputValue}
          />
          <label className={styles.styleCompactField}>
            <span>Hex</span>
            <input
              aria-label={`${label} hex`}
              disabled={disabled}
              onChange={(event) =>
                onChange(updateColorDraft(draft, "hex", event.currentTarget.value))
              }
              spellCheck={false}
              type="text"
              value={draft.hex}
            />
          </label>
        </div>
      ) : (
        <div className={styles.styleTypedGrid}>
          {(
            [
              ["Red", "red"],
              ["Green", "green"],
              ["Blue", "blue"],
              ["Alpha", "alpha"],
            ] as const
          ).map(([channelLabel, field]) => (
            <label className={styles.styleCompactField} key={field}>
              <span>{channelLabel}</span>
              <input
                aria-label={`${label} ${channelLabel.toLowerCase()}`}
                disabled={disabled}
                max="1"
                min="0"
                onChange={(event) =>
                  onChange(updateColorDraft(draft, field, event.currentTarget.value))
                }
                step="any"
                type="number"
                value={draft[field]}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function initialDimensionDraft(): DimensionDraft {
  return Object.freeze({ mode: "dimension", value: "0", unit: "px" });
}

function dimensionDraft(value: JsonValue | undefined, acceptsSizing: boolean): DimensionDraft {
  if (acceptsSizing && (value === "fill" || value === "hug")) {
    return Object.freeze({ mode: value, value: "0", unit: "px" });
  }
  if (isRecord(value) && (value.unit === "px" || value.unit === "rem")) {
    return Object.freeze({
      mode: "dimension",
      value: numberText(value.value, "0"),
      unit: value.unit,
    });
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Object.freeze({ mode: "dimension", value: String(value), unit: "px" });
  }
  return initialDimensionDraft();
}

function dimensionValue(draft: DimensionDraft): TypedValueResult {
  if (draft.mode === "fill" || draft.mode === "hug") {
    return Object.freeze({ ok: true, value: draft.mode });
  }
  const value = Number(draft.value);
  if (!Number.isFinite(value)) {
    return Object.freeze({ ok: false, message: "Enter a finite dimension value." });
  }
  return Object.freeze({ ok: true, value: Object.freeze({ value, unit: draft.unit }) });
}

function updateDimensionDraft(
  draft: DimensionDraft,
  field: keyof DimensionDraft,
  value: string,
): DimensionDraft {
  return Object.freeze({ ...draft, [field]: value }) as DimensionDraft;
}

function DimensionFields({
  label,
  draft,
  acceptsSizing = false,
  disabled,
  onChange,
}: Readonly<{
  readonly label: string;
  readonly draft: DimensionDraft;
  readonly acceptsSizing?: boolean | undefined;
  readonly disabled: boolean;
  readonly onChange: (next: DimensionDraft) => void;
}>) {
  return (
    <div className={styles.styleTypedEditor}>
      <span className={styles.styleTypedLabel}>{label}</span>
      <div className={styles.styleTypedGrid}>
        {acceptsSizing ? (
          <label className={styles.styleCompactField}>
            <span>Sizing</span>
            <select
              aria-label={`${label} sizing mode`}
              disabled={disabled}
              onChange={(event) =>
                onChange(updateDimensionDraft(draft, "mode", event.currentTarget.value))
              }
              value={draft.mode}
            >
              <option value="dimension">Fixed</option>
              <option value="fill">Fill</option>
              <option value="hug">Hug</option>
            </select>
          </label>
        ) : null}
        {draft.mode === "dimension" ? (
          <>
            <label className={styles.styleCompactField}>
              <span>Value</span>
              <input
                aria-label={`${label} value`}
                disabled={disabled}
                onChange={(event) =>
                  onChange(updateDimensionDraft(draft, "value", event.currentTarget.value))
                }
                step="any"
                type="number"
                value={draft.value}
              />
            </label>
            <label className={styles.styleCompactField}>
              <span>Unit</span>
              <select
                aria-label={`${label} unit`}
                disabled={disabled}
                onChange={(event) =>
                  onChange(updateDimensionDraft(draft, "unit", event.currentTarget.value))
                }
                value={draft.unit}
              >
                <option value="px">px</option>
                <option value="rem">rem</option>
              </select>
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}

function StructuredError({ error, id }: Readonly<{ readonly error: string; readonly id: string }>) {
  return error.length > 0 ? (
    <p className={styles.fieldError} id={id} role="alert">
      {error}
    </p>
  ) : null;
}

function StyleColorControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const fingerprint = valueFingerprint(value);
  const current = useMemo(() => colorDraft(valueForLiteralEditing(value)), [fingerprint]);
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [fingerprint, current]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = colorValue(draft);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <ColorFields
        disabled={!editingEnabled}
        draft={draft}
        label={control.property}
        onChange={(next) => {
          setDraft(next);
          setDirty(true);
          setError("");
        }}
      />
      <div className={styles.styleControlActions}>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function StyleDimensionControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const acceptsSizing = SIZING_MODE_PROPERTIES.has(control.property);
  const fingerprint = valueFingerprint(value);
  const current = useMemo(
    () => dimensionDraft(valueForLiteralEditing(value), acceptsSizing),
    [acceptsSizing, fingerprint],
  );
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [acceptsSizing, current, fingerprint]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = dimensionValue(draft);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <DimensionFields
        acceptsSizing={acceptsSizing}
        disabled={!editingEnabled}
        draft={draft}
        label={control.property}
        onChange={(next) => {
          setDraft(next);
          setDirty(true);
          setError("");
        }}
      />
      <div className={styles.styleControlActions}>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function initialGradientDraft(): GradientDraft {
  return Object.freeze({
    angle: "90",
    stops: Object.freeze([
      Object.freeze({ color: initialColorDraft(), position: "0" }),
      Object.freeze({
        color: Object.freeze({ ...initialColorDraft(), hex: "#ffffff" }),
        position: "100",
      }),
    ]),
  });
}

function gradientDraft(value: JsonValue | undefined): GradientDraft {
  if (!isRecord(value) || !Array.isArray(value.stops)) return initialGradientDraft();
  const stops = value.stops.filter(isRecord).map((stop) =>
    Object.freeze({
      color: colorDraft(stop.color as JsonValue),
      position: numberText(stop.position, "0"),
    }),
  );
  if (stops.length < 2 || stops.length > 4) return initialGradientDraft();
  return Object.freeze({ angle: numberText(value.angle, "90"), stops: Object.freeze(stops) });
}

function gradientValue(draft: GradientDraft): TypedValueResult {
  const angle = Number(draft.angle);
  if (!Number.isFinite(angle) || angle < 0 || angle > 360) {
    return Object.freeze({ ok: false, message: "Gradient angle must be between 0 and 360." });
  }
  if (draft.stops.length < 2 || draft.stops.length > 4) {
    return Object.freeze({ ok: false, message: "Use between two and four gradient stops." });
  }
  let priorPosition = -1;
  const stops: JsonValue[] = [];
  for (const stop of draft.stops) {
    const color = colorValue(stop.color);
    const position = Number(stop.position);
    if (!color.ok) return color;
    if (!Number.isFinite(position) || position < 0 || position > 100 || position < priorPosition) {
      return Object.freeze({
        ok: false,
        message: "Gradient stops must stay between 0 and 100 in visual order.",
      });
    }
    priorPosition = position;
    stops.push(Object.freeze({ color: color.value, position }));
  }
  return Object.freeze({ ok: true, value: Object.freeze({ angle, stops: Object.freeze(stops) }) });
}

function StyleGradientControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const fingerprint = valueFingerprint(value);
  const current = useMemo(() => gradientDraft(valueForLiteralEditing(value)), [fingerprint]);
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, fingerprint]);

  function update(next: GradientDraft): void {
    setDraft(next);
    setDirty(true);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = gradientValue(draft);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <label className={styles.styleCompactField}>
        <span>Angle</span>
        <input
          aria-label={`${control.property} angle`}
          disabled={!editingEnabled}
          max="360"
          min="0"
          onChange={(event) =>
            update(Object.freeze({ ...draft, angle: event.currentTarget.value }))
          }
          step="any"
          type="number"
          value={draft.angle}
        />
      </label>
      <div className={styles.styleNestedList}>
        {draft.stops.map((stop, index) => (
          <div className={styles.styleNestedCard} key={`${index}:${stop.position}`}>
            <div className={styles.styleNestedHeading}>
              <strong>Stop {index + 1}</strong>
              <button
                aria-label={`Remove ${control.property} stop ${index + 1}`}
                className={styles.styleInlineButton}
                disabled={!editingEnabled || draft.stops.length <= 2}
                onClick={() =>
                  update(
                    Object.freeze({
                      ...draft,
                      stops: Object.freeze(
                        draft.stops.filter((_, candidate) => candidate !== index),
                      ),
                    }),
                  )
                }
                type="button"
              >
                Remove
              </button>
            </div>
            <ColorFields
              disabled={!editingEnabled}
              draft={stop.color}
              label={`${control.property} stop ${index + 1} color`}
              onChange={(color) =>
                update(
                  Object.freeze({
                    ...draft,
                    stops: Object.freeze(
                      draft.stops.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? Object.freeze({ ...candidate, color })
                          : candidate,
                      ),
                    ),
                  }),
                )
              }
            />
            <label className={styles.styleCompactField}>
              <span>Position</span>
              <input
                aria-label={`${control.property} stop ${index + 1} position`}
                disabled={!editingEnabled}
                max="100"
                min="0"
                onChange={(event) =>
                  update(
                    Object.freeze({
                      ...draft,
                      stops: Object.freeze(
                        draft.stops.map((candidate, candidateIndex) =>
                          candidateIndex === index
                            ? Object.freeze({ ...candidate, position: event.currentTarget.value })
                            : candidate,
                        ),
                      ),
                    }),
                  )
                }
                step="any"
                type="number"
                value={stop.position}
              />
            </label>
          </div>
        ))}
      </div>
      <div className={styles.styleControlActions}>
        <button
          aria-label={`Add ${control.property} stop`}
          className={styles.styleInlineButton}
          disabled={!editingEnabled || draft.stops.length >= 4}
          onClick={() =>
            update(
              Object.freeze({
                ...draft,
                stops: Object.freeze([
                  ...draft.stops,
                  Object.freeze({ color: initialColorDraft(), position: "100" }),
                ]),
              }),
            )
          }
          type="button"
        >
          Add stop
        </button>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply gradient
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function initialBorderDraft(): BorderDraft {
  return Object.freeze({
    color: initialColorDraft(true),
    style: "solid",
    width: initialDimensionDraft(),
  });
}

function borderDraft(value: JsonValue | undefined): BorderDraft {
  if (!isRecord(value)) return initialBorderDraft();
  return Object.freeze({
    color: colorDraft(value.color as JsonValue, true),
    style: typeof value.style === "string" ? value.style : "solid",
    width: dimensionDraft(value.width as JsonValue, false),
  });
}

function borderValue(draft: BorderDraft): TypedValueResult {
  const color = colorValue(draft.color, true);
  const width = dimensionValue(draft.width);
  if (!color.ok) return color;
  if (!width.ok) return width;
  if (!BORDER_STYLES.includes(draft.style as (typeof BORDER_STYLES)[number])) {
    return Object.freeze({ ok: false, message: "Choose one supported border style." });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({ color: color.value, style: draft.style, width: width.value }),
  });
}

function StyleBorderControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const fingerprint = valueFingerprint(value);
  const current = useMemo(() => borderDraft(valueForLiteralEditing(value)), [fingerprint]);
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, fingerprint]);

  function update(next: BorderDraft): void {
    setDraft(next);
    setDirty(true);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = borderValue(draft);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <ColorFields
        disabled={!editingEnabled}
        draft={draft.color}
        forceSrgb
        label={`${control.property} color`}
        onChange={(color) => update(Object.freeze({ ...draft, color }))}
      />
      <label className={styles.styleCompactField}>
        <span>Style</span>
        <select
          aria-label={`${control.property} style`}
          disabled={!editingEnabled}
          onChange={(event) =>
            update(Object.freeze({ ...draft, style: event.currentTarget.value }))
          }
          value={draft.style}
        >
          {BORDER_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </label>
      <DimensionFields
        disabled={!editingEnabled}
        draft={draft.width}
        label={`${control.property} width`}
        onChange={(width) => update(Object.freeze({ ...draft, width }))}
      />
      <div className={styles.styleControlActions}>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply border
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function initialShadowLayerDraft(): ShadowLayerDraft {
  return Object.freeze({
    color: initialColorDraft(),
    offsetX: initialDimensionDraft(),
    offsetY: initialDimensionDraft(),
    blur: Object.freeze({ mode: "dimension", value: "4", unit: "px" }),
    spread: initialDimensionDraft(),
    inset: false,
  });
}

function shadowLayerDraft(value: unknown): ShadowLayerDraft {
  if (!isRecord(value)) return initialShadowLayerDraft();
  return Object.freeze({
    color: colorDraft(value.color as JsonValue),
    offsetX: dimensionDraft(value.offsetX as JsonValue, false),
    offsetY: dimensionDraft(value.offsetY as JsonValue, false),
    blur: dimensionDraft(value.blur as JsonValue, false),
    spread: dimensionDraft(value.spread as JsonValue, false),
    inset: value.inset === true,
  });
}

function shadowDraft(value: JsonValue | undefined): readonly ShadowLayerDraft[] {
  const rawLayers = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const layers = rawLayers.map(shadowLayerDraft);
  return Object.freeze(
    layers.length >= 1 && layers.length <= 4 ? layers : [initialShadowLayerDraft()],
  );
}

function shadowValue(layers: readonly ShadowLayerDraft[]): TypedValueResult {
  if (layers.length < 1 || layers.length > 4) {
    return Object.freeze({ ok: false, message: "Use between one and four shadow layers." });
  }
  const result: JsonValue[] = [];
  for (const layer of layers) {
    const color = colorValue(layer.color);
    const offsetX = dimensionValue(layer.offsetX);
    const offsetY = dimensionValue(layer.offsetY);
    const blur = dimensionValue(layer.blur);
    const spread = dimensionValue(layer.spread);
    if (!color.ok) return color;
    if (!offsetX.ok) return offsetX;
    if (!offsetY.ok) return offsetY;
    if (!blur.ok) return blur;
    if (!spread.ok) return spread;
    result.push(
      Object.freeze({
        color: color.value,
        offsetX: offsetX.value,
        offsetY: offsetY.value,
        blur: blur.value,
        spread: spread.value,
        ...(layer.inset ? { inset: true } : {}),
      }),
    );
  }
  return Object.freeze({
    ok: true,
    value: result.length === 1 ? (result[0] as JsonValue) : Object.freeze(result),
  });
}

function StyleShadowControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const fingerprint = valueFingerprint(value);
  const current = useMemo(() => shadowDraft(valueForLiteralEditing(value)), [fingerprint]);
  const [layers, setLayers] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setLayers(current);
    setDirty(false);
    setError("");
  }, [current, fingerprint]);

  function update(next: readonly ShadowLayerDraft[]): void {
    setLayers(Object.freeze([...next]));
    setDirty(true);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = shadowValue(layers);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <div className={styles.styleNestedList}>
        {layers.map((layer, index) => (
          <div className={styles.styleNestedCard} key={index}>
            <div className={styles.styleNestedHeading}>
              <strong>Layer {index + 1}</strong>
              <button
                aria-label={`Remove ${control.property} layer ${index + 1}`}
                className={styles.styleInlineButton}
                disabled={!editingEnabled || layers.length <= 1}
                onClick={() => update(layers.filter((_, candidate) => candidate !== index))}
                type="button"
              >
                Remove
              </button>
            </div>
            <ColorFields
              disabled={!editingEnabled}
              draft={layer.color}
              label={`${control.property} layer ${index + 1} color`}
              onChange={(color) =>
                update(
                  layers.map((candidate, candidateIndex) =>
                    candidateIndex === index ? Object.freeze({ ...candidate, color }) : candidate,
                  ),
                )
              }
            />
            <div className={styles.styleTypedGrid}>
              {(
                [
                  ["Offset X", "offsetX"],
                  ["Offset Y", "offsetY"],
                  ["Blur", "blur"],
                  ["Spread", "spread"],
                ] as const
              ).map(([label, field]) => (
                <DimensionFields
                  disabled={!editingEnabled}
                  draft={layer[field]}
                  key={field}
                  label={`${control.property} layer ${index + 1} ${label}`}
                  onChange={(dimension) =>
                    update(
                      layers.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? Object.freeze({ ...candidate, [field]: dimension })
                          : candidate,
                      ),
                    )
                  }
                />
              ))}
            </div>
            <label className={styles.switchControl}>
              <input
                aria-label={`${control.property} layer ${index + 1} inset`}
                checked={layer.inset}
                disabled={!editingEnabled}
                onChange={(event) =>
                  update(
                    layers.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? Object.freeze({ ...candidate, inset: event.currentTarget.checked })
                        : candidate,
                    ),
                  )
                }
                role="switch"
                type="checkbox"
              />
              <span aria-hidden="true" className={styles.switchTrack} />
              <span>Inset</span>
            </label>
          </div>
        ))}
      </div>
      <div className={styles.styleControlActions}>
        <button
          aria-label={`Add ${control.property} layer`}
          className={styles.styleInlineButton}
          disabled={!editingEnabled || layers.length >= 4}
          onClick={() => update([...layers, initialShadowLayerDraft()])}
          type="button"
        >
          Add layer
        </button>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply shadow
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function initialTypographyDraft(): TypographyDraft {
  return Object.freeze({
    families: Object.freeze(["system"]),
    fontSize: Object.freeze({ mode: "dimension", value: "1", unit: "rem" }),
    fontWeight: "400",
    letterSpacing: initialDimensionDraft(),
    lineHeight: "1.5",
  });
}

function typographyDraft(value: JsonValue | undefined): TypographyDraft {
  if (!isRecord(value)) return initialTypographyDraft();
  const rawFamilies = Array.isArray(value.fontFamily)
    ? value.fontFamily.filter((family): family is string => typeof family === "string")
    : typeof value.fontFamily === "string"
      ? [value.fontFamily]
      : ["system"];
  return Object.freeze({
    families: Object.freeze(
      rawFamilies.slice(0, 3).length > 0 ? rawFamilies.slice(0, 3) : ["system"],
    ),
    fontSize: dimensionDraft(value.fontSize as JsonValue, false),
    fontWeight:
      typeof value.fontWeight === "number" || typeof value.fontWeight === "string"
        ? String(value.fontWeight)
        : "400",
    letterSpacing: dimensionDraft(value.letterSpacing as JsonValue, false),
    lineHeight: numberText(value.lineHeight, "1.5"),
  });
}

function typographyValue(draft: TypographyDraft): TypedValueResult {
  const fontSize = dimensionValue(draft.fontSize);
  const letterSpacing = dimensionValue(draft.letterSpacing);
  const lineHeight = Number(draft.lineHeight);
  const families = draft.families.filter((family) => family.length > 0);
  const fontWeight = /^\d+$/u.test(draft.fontWeight) ? Number(draft.fontWeight) : draft.fontWeight;
  if (!fontSize.ok) return fontSize;
  if (!letterSpacing.ok) return letterSpacing;
  if (
    families.length < 1 ||
    families.length > 3 ||
    families.some(
      (family) => !TYPOGRAPHY_FAMILIES.includes(family as (typeof TYPOGRAPHY_FAMILIES)[number]),
    )
  ) {
    return Object.freeze({ ok: false, message: "Choose one to three supported font families." });
  }
  if (!TYPOGRAPHY_WEIGHTS.includes(draft.fontWeight as (typeof TYPOGRAPHY_WEIGHTS)[number])) {
    return Object.freeze({ ok: false, message: "Choose one supported font weight." });
  }
  if (!Number.isFinite(lineHeight) || lineHeight < 0.8 || lineHeight > 3) {
    return Object.freeze({ ok: false, message: "Line height must be between 0.8 and 3." });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      fontFamily: families.length === 1 ? (families[0] as string) : Object.freeze(families),
      fontSize: fontSize.value,
      fontWeight,
      letterSpacing: letterSpacing.value,
      lineHeight,
    }),
  });
}

function StyleTypographyControl(props: Readonly<StyleControlFieldProps>) {
  const { control, target, value, editingEnabled, onEdit } = props;
  const fingerprint = valueFingerprint(value);
  const current = useMemo(() => typographyDraft(valueForLiteralEditing(value)), [fingerprint]);
  const [draft, setDraft] = useState(current);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  useEffect(() => {
    setDraft(current);
    setDirty(false);
    setError("");
  }, [current, fingerprint]);

  function update(next: TypographyDraft): void {
    setDraft(next);
    setDirty(true);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty || !editingEnabled) return;
    const next = typographyValue(draft);
    if (!next.ok) {
      setError(next.message);
      return;
    }
    setError("");
    onEdit(styleEdit("set-literal", target, control, next.value));
  }

  return (
    <form className={styles.styleStructuredForm} onSubmit={submit}>
      <div className={styles.styleTypedGrid}>
        {[0, 1, 2].map((index) => (
          <label className={styles.styleCompactField} key={index}>
            <span>{index === 0 ? "Family" : `Fallback ${index}`}</span>
            <select
              aria-label={`${control.property} font family ${index + 1}`}
              disabled={!editingEnabled}
              onChange={(event) => {
                const families = [...draft.families];
                if (index === 0) families[0] = event.currentTarget.value;
                else if (event.currentTarget.value.length === 0) families.splice(index, 1);
                else families[index] = event.currentTarget.value;
                update(
                  Object.freeze({
                    ...draft,
                    families: Object.freeze(families.filter(Boolean).slice(0, 3)),
                  }),
                );
              }}
              value={draft.families[index] ?? ""}
            >
              {index > 0 ? <option value="">None</option> : null}
              {TYPOGRAPHY_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className={styles.styleCompactField}>
          <span>Weight</span>
          <select
            aria-label={`${control.property} font weight`}
            disabled={!editingEnabled}
            onChange={(event) =>
              update(Object.freeze({ ...draft, fontWeight: event.currentTarget.value }))
            }
            value={draft.fontWeight}
          >
            {TYPOGRAPHY_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.styleCompactField}>
          <span>Line height</span>
          <input
            aria-label={`${control.property} line height`}
            disabled={!editingEnabled}
            max="3"
            min="0.8"
            onChange={(event) =>
              update(Object.freeze({ ...draft, lineHeight: event.currentTarget.value }))
            }
            step="any"
            type="number"
            value={draft.lineHeight}
          />
        </label>
      </div>
      <DimensionFields
        disabled={!editingEnabled}
        draft={draft.fontSize}
        label={`${control.property} font size`}
        onChange={(fontSize) => update(Object.freeze({ ...draft, fontSize }))}
      />
      <DimensionFields
        disabled={!editingEnabled}
        draft={draft.letterSpacing}
        label={`${control.property} letter spacing`}
        onChange={(letterSpacing) => update(Object.freeze({ ...draft, letterSpacing }))}
      />
      <div className={styles.styleControlActions}>
        <button
          aria-describedby={error.length > 0 ? errorId : undefined}
          aria-label={`Apply ${control.property} at ${targetLabel(target)}`}
          className={styles.styleApplyButton}
          disabled={!editingEnabled || !dirty}
          type="submit"
        >
          Apply typography
        </button>
        <ResetStyleControl {...props} />
      </div>
      <StructuredError error={error} id={errorId} />
    </form>
  );
}

function UnsupportedStructuredDisclosure(props: Readonly<StyleControlFieldProps>) {
  const literal = valueForLiteralEditing(props.value);
  return (
    <div className={styles.styleUnsupportedDisclosure}>
      <p>
        This closed style value has no approved visual editor yet, so it remains read-only rather
        than exposing raw JSON or CSS editing.
      </p>
      <code>{literal === undefined ? "No resolved literal" : formatStructuredJson(literal)}</code>
      <div className={styles.styleControlActions}>
        <ResetStyleControl {...props} />
      </div>
    </div>
  );
}

function StyleStructuredControl(props: Readonly<StyleControlFieldProps>) {
  if (COLOR_PROPERTIES.has(props.control.property)) return <StyleColorControl {...props} />;
  if (DIMENSION_PROPERTIES.has(props.control.property)) return <StyleDimensionControl {...props} />;
  if (props.control.property === "backgroundGradient") return <StyleGradientControl {...props} />;
  if (props.control.property === "border") return <StyleBorderControl {...props} />;
  if (props.control.property === "boxShadow") return <StyleShadowControl {...props} />;
  if (props.control.property === "typography") return <StyleTypographyControl {...props} />;
  return <UnsupportedStructuredDisclosure {...props} />;
}

function StyleControlField(props: Readonly<StyleControlFieldProps>) {
  const { control, value } = props;
  return (
    <section className={styles.styleControl} data-control-kind={control.kind}>
      <ControlHeading control={control} target={props.target} value={value} />
      <ControlProvenance control={control} target={props.target} />
      {value.kind === "dynamic" ? (
        <p className={styles.styleControlHelp}>
          This runtime or advanced value is preserved as read-only.
        </p>
      ) : control.kind === "boolean" ? (
        <StyleBooleanControl {...props} />
      ) : control.kind === "enum" ? (
        <StyleEnumControl {...props} />
      ) : control.kind === "integer" || control.kind === "number" || control.kind === "string" ? (
        <StylePrimitiveControl {...props} />
      ) : (
        <StyleStructuredControl {...props} />
      )}
      <StyleTokenSelector {...props} />
      {control.description === undefined ? null : (
        <p className={styles.styleControlHelp}>{control.description}</p>
      )}
    </section>
  );
}

function StyleLayerSelector({
  target,
  breakpoints,
  disabled,
  onTargetChange,
}: Readonly<{
  readonly target: AuthoringStyleTarget;
  readonly breakpoints: readonly AuthoringResponsiveBreakpoint[];
  readonly disabled: boolean;
  readonly onTargetChange: (target: AuthoringStyleTarget) => void;
}>) {
  const groupId = useId();
  const layers = [
    Object.freeze({ label: "Desktop", target: BASE_STYLE_TARGET }),
    ...breakpoints.map((breakpoint) =>
      Object.freeze({ label: breakpoint.label, target: targetForBreakpoint(breakpoint) }),
    ),
  ];
  return (
    <fieldset className={styles.styleLayerSelector} disabled={disabled}>
      <legend id={groupId}>Style layer</legend>
      <div aria-labelledby={groupId} className={styles.styleLayerChoices} role="radiogroup">
        {layers.map((layer) => {
          const checked =
            layer.target.kind === target.kind &&
            (layer.target.kind === "base" ||
              (target.kind === "breakpoint" && layer.target.breakpoint === target.breakpoint));
          return (
            <label data-selected={checked ? "true" : "false"} key={layer.label}>
              <input
                checked={checked}
                name={`${groupId}-layer`}
                onChange={() => onTargetChange(layer.target)}
                type="radio"
              />
              <span>{layer.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function UnavailableStylePanel({ status }: Readonly<{ readonly status: "idle" | "rejected" }>) {
  return (
    <div className={styles.inspectorTabUnavailable}>
      <strong>
        {status === "idle" ? "Select a layer for styles" : "Style controls unavailable"}
      </strong>
      <p>
        {status === "idle"
          ? "Choose a Source layer to author its declared visual properties."
          : "The current selection does not expose a closed visual-style contract."}
      </p>
    </div>
  );
}

/**
 * Renders closed Catalog-declared visual controls for one selection and one exact responsive layer.
 *
 * @remarks This panel deliberately cannot edit CSS, JSX, arbitrary selectors, raw media queries,
 * or arbitrary Source paths. It only forwards the sealed mutations accepted by `authoring-styles`.
 */
export function StylePanel({
  model,
  tokenOptions = Object.freeze([]),
  target,
  onTargetChange,
  onEdit,
}: Readonly<StylePanelProps>) {
  const [notice, setNotice] = useState("");
  const safeTarget = isStyleTarget(target) ? target : undefined;
  const ready = model.status === "ready";
  const editingEnabled = ready && safeTarget !== undefined && onEdit !== undefined;

  useEffect(() => {
    setNotice("");
  }, [
    model.status,
    ready ? model.selection.sourceNodeId : null,
    safeTarget?.kind,
    safeTarget?.kind === "breakpoint" ? safeTarget.breakpoint : null,
  ]);

  if (!ready) return <UnavailableStylePanel status={model.status} />;
  if (safeTarget === undefined) {
    return (
      <div className={styles.inspectorTabUnavailable}>
        <strong>Style target unavailable</strong>
        <p>Choose a valid Desktop, Tablet, or Mobile layer before making a visual edit.</p>
      </div>
    );
  }

  function dispatch(edit: AuthoringStyleEdit): void {
    if (onEdit === undefined) {
      setNotice("Style editing is unavailable for this workspace.");
      return;
    }
    let result: AuthoringStyleEditResult;
    try {
      result = onEdit(edit);
    } catch {
      setNotice("Style editing is unavailable for this workspace.");
      return;
    }
    if (!result.ok) {
      setNotice(editFailureMessage(result));
      return;
    }
    const action =
      edit.kind === "reset" ? "Reset" : edit.kind === "set-token" ? "Applied token to" : "Updated";
    setNotice(`${action} ${edit.property} at ${targetLabel(edit.target)}.`);
  }

  return (
    <div className={styles.stylePanel} data-authoring-style="true">
      <div className={styles.stylePanelIntro}>
        <span>
          <strong>{model.component.displayName}</strong>
          <small>Closed visual contract</small>
        </span>
        <span className={styles.styleLayerSummary}>{targetLabel(safeTarget)}</span>
      </div>
      <StyleLayerSelector
        breakpoints={AUTHORING_RESPONSIVE_BREAKPOINTS}
        disabled={onTargetChange === undefined}
        onTargetChange={onTargetChange ?? (() => undefined)}
        target={safeTarget}
      />
      <div className={styles.stylePanelBody}>
        {model.parts.map((part) => (
          <section className={styles.stylePart} key={part.name}>
            <div className={styles.stylePartHeading}>
              <span>
                <strong>{part.name}</strong>
                {part.description === undefined ? null : <small>{part.description}</small>}
              </span>
              <small>{part.controls.length} controls</small>
            </div>
            {!part.controlsAvailable ? (
              <p className={styles.styleControlHelp}>
                This Catalog style part uses an open or unsupported schema and stays unavailable.
              </p>
            ) : part.controls.length === 0 ? (
              <p className={styles.styleControlHelp}>No directly authorable visual properties.</p>
            ) : (
              <div className={styles.styleControls}>
                {part.controls.map((control) => (
                  <StyleControlField
                    control={control}
                    editingEnabled={editingEnabled}
                    key={`${part.name}:${control.property}`}
                    onEdit={dispatch}
                    target={safeTarget}
                    tokenOptions={tokenOptions}
                    value={selectedValue(control, safeTarget)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
        {model.parts.length === 0 ? (
          <div className={styles.inspectorTabUnavailable}>
            <strong>No visual controls</strong>
            <p>This component does not declare any closed visual style parts.</p>
          </div>
        ) : null}
        {model.unmanagedResponsiveVariants.length > 0 ? (
          <p className={styles.styleUnmanagedNotice}>
            {model.unmanagedResponsiveVariants.length} unrelated or malformed responsive variant
            {model.unmanagedResponsiveVariants.length === 1 ? " is" : "s are"} preserved unchanged.
          </p>
        ) : null}
      </div>
      <p aria-live="polite" className={styles.styleNotice} role="status">
        {notice ||
          (editingEnabled
            ? "Visual edits remain local until Save source succeeds."
            : "Style controls are read-only for this workspace.")}
      </p>
    </div>
  );
}
