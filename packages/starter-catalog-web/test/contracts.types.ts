import type {
  StarterButtonProps,
  StarterComboboxProps,
  StarterDialogProps,
  StarterNumberFieldProps,
  StarterSelectOption,
  StarterSelectProps,
  StarterSliderProps,
  StarterTabsProps,
} from "../src/contracts.js";

const button: StarterButtonProps = { label: "Save", disabled: false, loading: false };
const option: StarterSelectOption = { value: "one", label: "One", disabled: false };
const select: StarterSelectProps = {
  label: "Choose",
  options: [option],
  defaultValue: "one",
};
const dialog: StarterDialogProps = {
  triggerLabel: "Open",
  title: "Title",
  description: "Description",
  closeLabel: "Close",
};
const combobox: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  filterMode: "contains",
};
const tabs: StarterTabsProps = {
  label: "Sections",
  tabs: [{ id: "overview", label: "Overview" }],
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

// @ts-expect-error Executable callbacks are not part of the Button prop contract.
const callbackButton: StarterButtonProps = { label: "Save", onPress: () => undefined };

const invalidSelect: StarterSelectProps = {
  label: "Choose",
  // @ts-expect-error Select options require inert string values and labels.
  options: [{ value: 1, label: "One" }],
};

const invalidCombobox: StarterComboboxProps = {
  label: "Find a region",
  // @ts-expect-error New Combobox data has stable ids, never the legacy Select value spelling.
  options: [{ value: "north", label: "Northern region" }],
};
const invalidFilterMode: StarterComboboxProps = {
  label: "Find a region",
  options: [{ id: "north", label: "Northern region" }],
  // @ts-expect-error A filter is selected from an inert finite enum, never a callback.
  filterMode: () => true,
};
const invalidTabs: StarterTabsProps = {
  label: "Sections",
  // @ts-expect-error Stable tab identities and labels are required.
  tabs: [{ label: "Overview" }],
  value: "overview",
};
const invalidSlider: StarterSliderProps = {
  label: "Opacity",
  // @ts-expect-error Numeric Catalog fields are numbers, not executable renderers.
  value: () => 50,
  min: 0,
  max: 100,
  step: 1,
};

void [
  button,
  option,
  select,
  dialog,
  combobox,
  tabs,
  slider,
  numberField,
  callbackButton,
  invalidSelect,
  invalidCombobox,
  invalidFilterMode,
  invalidTabs,
  invalidSlider,
];
