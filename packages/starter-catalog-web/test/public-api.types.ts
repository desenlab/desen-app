import type {
  StarterButtonProps,
  StarterCheckboxProps,
  StarterDialogProps,
  StarterRadioGroupProps,
  StarterSelectProps,
  StarterSwitchProps,
  StarterTextAreaProps,
  StarterTextFieldProps,
} from "../src/index.js";
import { createStarterNodeTemplate } from "../src/index.js";

const button: StarterButtonProps = { label: "Continue", disabled: false };
const select: StarterSelectProps = {
  label: "Typeface",
  options: [{ value: "sans", label: "Sans" }],
};
const dialog: StarterDialogProps = { title: "Details" };
const textField: StarterTextFieldProps = { label: "Name", value: "Ada" };
const textArea: StarterTextAreaProps = { label: "Notes", rows: 4 };
const checkbox: StarterCheckboxProps = { label: "Accept terms", checked: false };
const radioGroup: StarterRadioGroupProps = {
  label: "Plan",
  options: [{ label: "Starter", value: "starter" }],
  value: "starter",
};
const toggle: StarterSwitchProps = { label: "Enable notifications", checked: true };
void [button, select, dialog, textField, textArea, checkbox, radioGroup, toggle];

// @ts-expect-error A native callback is not a Catalog prop.
const callback: StarterButtonProps = { label: "Continue", onClick: () => undefined };
// @ts-expect-error A render function is not a Catalog prop.
const render: StarterSelectProps = { label: "Select", options: [], render: () => null };
// @ts-expect-error A portal target cannot be provided by document data.
const target: StarterDialogProps = { container: "body" };
// @ts-expect-error Form controls carry JSON state, never a native callback.
const formCallback: StarterTextFieldProps = { label: "Name", onChange: () => undefined };
// @ts-expect-error Checkbox state must be boolean.
const invalidChecked: StarterCheckboxProps = { label: "Accept", checked: "yes" };
// @ts-expect-error Radio options must be finite inert records.
const invalidOption: StarterRadioGroupProps = { label: "Plan", options: [{ value: "one" }] };
const item: StarterSelectProps = {
  label: "Select",
  // @ts-expect-error Select items are inert labelled string values, not executable children.
  options: [{ value: "one", label: () => null }],
};
void [callback, render, target, formCallback, invalidChecked, invalidOption, item];

// @ts-expect-error No arbitrary capability or module selector can request a starter template.
createStarterNodeTemplate({ capabilityId: "@base-ui/react/dialog", idPrefix: "dialog" });
