import { useId, useImperativeHandle, useRef } from "react";

import type { CSSProperties, Ref } from "react";
import type { TextFieldCatalogProps, TextFieldChangePayload } from "./interactive-contracts.js";

const ROOT_STYLE = Object.freeze({
  display: "grid",
  gap: "var(--desen-space-xs, 0.25rem)",
} satisfies CSSProperties);

const LABEL_STYLE = Object.freeze({
  color: "var(--desen-color-text, #111827)",
  fontWeight: 600,
} satisfies CSSProperties);

const CONTROL_STYLE = Object.freeze({
  background: "var(--desen-color-surface, #ffffff)",
  border: "1px solid var(--desen-color-border, #6b7280)",
  borderRadius: "var(--desen-radius-control, 0.375rem)",
  color: "var(--desen-color-text, #111827)",
  font: "inherit",
  minWidth: 0,
  padding: "var(--desen-space-sm, 0.5rem)",
} satisfies CSSProperties);

const INVALID_CONTROL_STYLE = Object.freeze({
  borderColor: "var(--desen-color-critical, #b91c1c)",
} satisfies CSSProperties);

const DISABLED_CONTROL_STYLE = Object.freeze({
  background: "var(--desen-color-surface-disabled, #f3f4f6)",
  cursor: "not-allowed",
  opacity: 0.7,
} satisfies CSSProperties);

declare const textFieldHandleBrand: unique symbol;

/**
 * Narrow imperative surface used to implement the declared TextField `focus` command.
 *
 * @remarks The handle deliberately exposes no DOM node. A renderer adapter validates the command's
 * schema-derived empty input before calling this trusted method.
 */
export interface TextFieldHandle {
  /** Prevents structurally compatible DOM elements from being accepted as command handles. */
  readonly [textFieldHandleBrand]: true;

  /** Moves focus to the native text control when it is available and enabled. */
  focus(): void;
}

/**
 * Web–React properties for the reference TextField implementation.
 *
 * @remarks Catalog properties remain JSON-only. `onChange` and `ref` are trusted adapter bindings,
 * not DESEN props, and they expose neither a native event nor the underlying input element.
 */
export type TextFieldProps = Readonly<
  TextFieldCatalogProps & {
    readonly onChange?: ((payload: TextFieldChangePayload) => void) | undefined;
    readonly ref?: Ref<TextFieldHandle> | undefined;
  }
>;

/**
 * Renders a controlled, visibly labelled native text input.
 *
 * @remarks `secure` selects the native password mode, `disabled` uses native disabled semantics,
 * and `invalid` maps only to `aria-invalid` because the Catalog declares no field-level error
 * message. The change bridge copies the current string into a fresh frozen inert payload.
 */
export function TextField({
  disabled = false,
  invalid = false,
  label,
  onChange,
  placeholder,
  ref,
  secure = false,
  value,
}: TextFieldProps) {
  const controlId = useId();
  const controlRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(
    ref,
    () =>
      Object.freeze({
        focus() {
          if (!disabled) controlRef.current?.focus();
        },
      }) as TextFieldHandle,
    [disabled],
  );

  const controlStyle: CSSProperties = {
    ...CONTROL_STYLE,
    ...(invalid ? INVALID_CONTROL_STYLE : {}),
    ...(disabled ? DISABLED_CONTROL_STYLE : {}),
  };

  return (
    <div style={ROOT_STYLE}>
      <label htmlFor={controlId} style={LABEL_STYLE}>
        {label}
      </label>
      <input
        aria-invalid={invalid || undefined}
        disabled={disabled}
        id={controlId}
        onChange={(event) => {
          if (disabled || onChange === undefined) return;
          onChange(Object.freeze({ value: event.currentTarget.value }));
        }}
        placeholder={placeholder}
        ref={controlRef}
        style={controlStyle}
        type={secure ? "password" : "text"}
        value={value}
      />
    </div>
  );
}
