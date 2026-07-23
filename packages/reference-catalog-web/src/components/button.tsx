import type { CSSProperties } from "react";
import type {
  ButtonCatalogProps,
  ButtonPressPayload,
  ButtonVariant,
} from "./interactive-contracts.js";

const VARIANT_STYLES = Object.freeze({
  primary: Object.freeze({
    background: "var(--desen-color-action-primary, #1d4ed8)",
    borderColor: "var(--desen-color-action-primary, #1d4ed8)",
    color: "var(--desen-color-on-action, #ffffff)",
  }),
  secondary: Object.freeze({
    background: "var(--desen-color-surface, #ffffff)",
    borderColor: "var(--desen-color-border-strong, #374151)",
    color: "var(--desen-color-text, #111827)",
  }),
  danger: Object.freeze({
    background: "var(--desen-color-critical, #b91c1c)",
    borderColor: "var(--desen-color-critical, #b91c1c)",
    color: "var(--desen-color-on-critical, #ffffff)",
  }),
} satisfies Readonly<Record<ButtonVariant, CSSProperties>>);

const ROOT_STYLE = Object.freeze({
  alignItems: "center",
  borderStyle: "solid",
  borderWidth: 1,
  borderRadius: "var(--desen-radius-control, 0.375rem)",
  display: "inline-flex",
  font: "inherit",
  fontWeight: 600,
  justifyContent: "center",
  minHeight: "2.5rem",
  padding: "var(--desen-space-sm, 0.5rem) var(--desen-space-md, 1rem)",
} satisfies CSSProperties);

const INACTIVE_STYLE = Object.freeze({
  cursor: "not-allowed",
  opacity: 0.7,
} satisfies CSSProperties);

/**
 * Web–React properties for the reference Button implementation.
 *
 * @remarks `onPress` is a trusted adapter callback derived from the declared event payload. It is
 * not a Catalog prop and never exposes a mouse, pointer, keyboard, or DOM event.
 */
export type ButtonProps = Readonly<
  ButtonCatalogProps & {
    readonly onPress?: ((payload: ButtonPressPayload) => void) | undefined;
  }
>;

/**
 * Renders a native non-submit button and bridges activation to the inert `press` payload.
 *
 * @remarks Native `disabled` is reserved for the declared disabled state. Loading keeps the
 * control focusable, marks it busy and semantically disabled, and suppresses activation so focus
 * is not lost during an asynchronous operation. The visible label never changes implicitly.
 */
export function Button({
  disabled = false,
  label,
  loading = false,
  onPress,
  variant = "primary",
}: ButtonProps) {
  const inactive = disabled || loading;
  const style: CSSProperties = {
    ...ROOT_STYLE,
    ...VARIANT_STYLES[variant],
    ...(inactive ? INACTIVE_STYLE : {}),
    cursor: loading && !disabled ? "wait" : inactive ? "not-allowed" : "pointer",
  };

  return (
    <button
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      data-loading={loading ? "true" : undefined}
      data-variant={variant}
      disabled={disabled}
      onClick={() => {
        if (!inactive) onPress?.(Object.freeze({}));
      }}
      style={style}
      type="button"
    >
      {label}
    </button>
  );
}
