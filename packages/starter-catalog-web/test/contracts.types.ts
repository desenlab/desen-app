import type {
  StarterButtonProps,
  StarterDialogProps,
  StarterSelectOption,
  StarterSelectProps,
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

// @ts-expect-error Executable callbacks are not part of the Button prop contract.
const callbackButton: StarterButtonProps = { label: "Save", onPress: () => undefined };

const invalidSelect: StarterSelectProps = {
  label: "Choose",
  // @ts-expect-error Select options require inert string values and labels.
  options: [{ value: 1, label: "One" }],
};

void [button, option, select, dialog, callbackButton, invalidSelect];
