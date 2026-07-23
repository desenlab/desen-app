/**
 * Accessible real Web–React components and their schema-authoritative DESEN registrations.
 *
 * @packageDocumentation
 */

export {
  STACK_CAPABILITY_ID,
  TEXT_CAPABILITY_ID,
  stackComponentRegistration,
  textComponentRegistration,
} from "./contracts.js";
export {
  ALERT_CAPABILITY_ID,
  BUTTON_CAPABILITY_ID,
  TEXT_FIELD_CAPABILITY_ID,
  alertComponentRegistration,
  buttonComponentRegistration,
  textFieldComponentRegistration,
} from "./interactive-contracts.js";
export { Alert } from "./alert.js";
export { Button } from "./button.js";
export { Stack } from "./stack.js";
export { Text } from "./text.js";
export { TextField } from "./text-field.js";

export type {
  StackAlignment,
  StackCatalogProps,
  StackDirection,
  StackGap,
  TextCatalogProps,
  TextRole,
} from "./contracts.js";
export type {
  AlertCatalogProps,
  AlertTone,
  ButtonCatalogProps,
  ButtonPressPayload,
  ButtonVariant,
  TextFieldCatalogProps,
  TextFieldChangePayload,
  TextFieldFocusInput,
} from "./interactive-contracts.js";
export type { AlertProps } from "./alert.js";
export type { ButtonProps } from "./button.js";
export type { StackProps } from "./stack.js";
export type { TextProps } from "./text.js";
export type { TextFieldHandle, TextFieldProps } from "./text-field.js";
