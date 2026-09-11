import type { StarterButtonProps, StarterDialogProps, StarterSelectProps } from "../src/index.js";
import { createStarterNodeTemplate } from "../src/index.js";

const button: StarterButtonProps = { label: "Continue", disabled: false };
const select: StarterSelectProps = {
  label: "Typeface",
  options: [{ value: "sans", label: "Sans" }],
};
const dialog: StarterDialogProps = { title: "Details" };
void [button, select, dialog];

// @ts-expect-error A native callback is not a Catalog prop.
const callback: StarterButtonProps = { label: "Continue", onClick: () => undefined };
// @ts-expect-error A render function is not a Catalog prop.
const render: StarterSelectProps = { label: "Select", options: [], render: () => null };
// @ts-expect-error A portal target cannot be provided by document data.
const target: StarterDialogProps = { container: "body" };
const item: StarterSelectProps = {
  label: "Select",
  // @ts-expect-error Select items are inert labelled string values, not executable children.
  options: [{ value: "one", label: () => null }],
};
void [callback, render, target, item];

// @ts-expect-error No arbitrary capability or module selector can request a starter template.
createStarterNodeTemplate({ capabilityId: "@base-ui/react/dialog", idPrefix: "dialog" });
