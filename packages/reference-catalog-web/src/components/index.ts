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
export { Stack } from "./stack.js";
export { Text } from "./text.js";

export type {
  StackAlignment,
  StackCatalogProps,
  StackDirection,
  StackGap,
  TextCatalogProps,
  TextRole,
} from "./contracts.js";
export type { StackProps } from "./stack.js";
export type { TextProps } from "./text.js";
