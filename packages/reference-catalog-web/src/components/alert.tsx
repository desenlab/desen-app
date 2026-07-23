import type { CSSProperties } from "react";
import type { AlertCatalogProps, AlertTone } from "./interactive-contracts.js";

const TONE_STYLES = Object.freeze({
  info: Object.freeze({
    background: "var(--desen-color-info-surface, #eff6ff)",
    borderColor: "var(--desen-color-info, #1d4ed8)",
    color: "var(--desen-color-info-text, #1e3a8a)",
  }),
  success: Object.freeze({
    background: "var(--desen-color-success-surface, #f0fdf4)",
    borderColor: "var(--desen-color-success, #15803d)",
    color: "var(--desen-color-success-text, #14532d)",
  }),
  warning: Object.freeze({
    background: "var(--desen-color-warning-surface, #fffbeb)",
    borderColor: "var(--desen-color-warning, #a16207)",
    color: "var(--desen-color-warning-text, #713f12)",
  }),
  critical: Object.freeze({
    background: "var(--desen-color-critical-surface, #fef2f2)",
    borderColor: "var(--desen-color-critical, #b91c1c)",
    color: "var(--desen-color-critical-text, #7f1d1d)",
  }),
} satisfies Readonly<Record<AlertTone, CSSProperties>>);

const TONE_ROLES = Object.freeze({
  info: "status",
  success: "status",
  warning: "status",
  critical: "alert",
} satisfies Readonly<Record<AlertTone, "alert" | "status">>);

const ROOT_STYLE = Object.freeze({
  borderInlineStartStyle: "solid",
  borderInlineStartWidth: 4,
  borderRadius: "var(--desen-radius-control, 0.375rem)",
  padding: "var(--desen-space-sm, 0.5rem) var(--desen-space-md, 1rem)",
} satisfies CSSProperties);

/** Web–React properties for the leaf Alert implementation. */
export type AlertProps = AlertCatalogProps;

/**
 * Renders inert feedback text through a non-focusable live-region role.
 *
 * @remarks `critical` is assertive through the native `alert` role; lower-urgency tones use the
 * polite `status` role. Both roles carry their standard implicit live-region behavior, so the
 * component does not add redundant ARIA attributes or move keyboard focus.
 */
export function Alert({ text, tone }: AlertProps) {
  const style: CSSProperties = {
    ...ROOT_STYLE,
    ...TONE_STYLES[tone],
  };

  return (
    <div data-tone={tone} role={TONE_ROLES[tone]} style={style}>
      {text}
    </div>
  );
}
