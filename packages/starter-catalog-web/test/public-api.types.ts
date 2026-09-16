import type {
  StarterButtonProps,
  StarterCardProps,
  StarterListProps,
  StarterTableProps,
  StarterProgressProps,
  StarterCheckboxProps,
  StarterComboboxProps,
  StarterDialogProps,
  StarterNumberFieldProps,
  StarterRadioGroupProps,
  StarterSelectProps,
  StarterSliderProps,
  StarterSwitchProps,
  StarterTabsProps,
  StarterTextAreaProps,
  StarterTextFieldProps,
} from "../src/index.js";
import { createStarterNodeTemplate } from "../src/index.js";

const button: StarterButtonProps = { label: "Continue", disabled: false };
const card: StarterCardProps = { label: "Project summary" };
const list: StarterListProps = { label: "Project tasks", itemIds: ["research"] };
const table: StarterTableProps = {
  caption: "Project status",
  columns: [{ id: "name", label: "Name" }],
  rows: [{ id: "research", cells: { name: "Research" } }],
};
const progress: StarterProgressProps = { label: "Uploading", value: 45 };
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
const combobox: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  value: "north",
  filterMode: "startsWith",
};
const tabs: StarterTabsProps = {
  label: "Sections",
  tabs: [
    { id: "overview", label: "Overview" },
    { id: "details", label: "Details" },
  ],
  value: "overview",
};
const slider: StarterSliderProps = { label: "Opacity", value: 50, min: 0, max: 100, step: 1 };
const numberField: StarterNumberFieldProps = {
  label: "Columns",
  value: 2,
  min: 1,
  max: 12,
  step: 1,
};
void [
  button,
  card,
  list,
  table,
  progress,
  select,
  dialog,
  textField,
  textArea,
  checkbox,
  radioGroup,
  toggle,
  combobox,
  tabs,
  slider,
  numberField,
];

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
const unsafeComboboxFilter: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  // @ts-expect-error A user function cannot define Catalog filtering.
  filterMode: () => true,
};
const unsafeComboboxRenderer: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  // @ts-expect-error Rendering remains inside the trusted adapter.
  renderItem: () => null,
};
const unsafeTabs: StarterTabsProps = {
  label: "Sections",
  // @ts-expect-error Tabs require an inert stable id alongside every label.
  tabs: [{ label: "Overview" }],
  value: "overview",
};
const unsafeNumeric: StarterNumberFieldProps = {
  label: "Columns",
  // @ts-expect-error Numeric values cannot carry executable data.
  value: () => 2,
  min: 1,
  max: 12,
  step: 1,
};
const unsafeTable: StarterTableProps = {
  caption: "Project status",
  columns: [{ id: "name", label: "Name" }],
  // @ts-expect-error Table cells are inert text, never executable renderers.
  rows: [{ id: "research", cells: { name: () => null } }],
};
void [
  callback,
  render,
  target,
  formCallback,
  invalidChecked,
  invalidOption,
  item,
  unsafeComboboxFilter,
  unsafeComboboxRenderer,
  unsafeTabs,
  unsafeNumeric,
  unsafeTable,
];

// @ts-expect-error No arbitrary capability or module selector can request a starter template.
createStarterNodeTemplate({ capabilityId: "@base-ui/react/dialog", idPrefix: "dialog" });
