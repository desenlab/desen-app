import { createRef } from "react";

import {
  Alert,
  Button,
  TextField,
  alertComponentRegistration,
  buttonComponentRegistration,
  textFieldComponentRegistration,
} from "../src/components/index.js";

import type { ChangeEvent } from "react";
import type {
  AlertCatalogProps,
  AlertProps,
  ButtonCatalogProps,
  ButtonPressPayload,
  ButtonProps,
  TextFieldCatalogProps,
  TextFieldChangePayload,
  TextFieldFocusInput,
  TextFieldHandle,
  TextFieldProps,
} from "../src/components/index.js";

const textFieldId: "com.example.ui/TextField" = textFieldComponentRegistration.id;
const buttonId: "com.example.ui/Button" = buttonComponentRegistration.id;
const alertId: "com.example.ui/Alert" = alertComponentRegistration.id;
const changePayload: TextFieldChangePayload = { value: "next" };
const focusInput: TextFieldFocusInput = {};
const pressPayload: ButtonPressPayload = {};
const textFieldHandle = createRef<TextFieldHandle>();
const textFieldProps: TextFieldProps = {
  label: "Email",
  value: "",
  onChange: (payload) => void payload.value,
  ref: textFieldHandle,
};
const textFieldWithExplicitlyAbsentBindings: TextFieldProps = {
  label: "Email",
  value: "",
  onChange: undefined,
  ref: undefined,
};
const buttonProps: ButtonProps = {
  label: "Continue",
  variant: "primary",
  onPress: (payload) => void payload,
};
const buttonWithExplicitlyAbsentBinding: ButtonProps = {
  label: "Continue",
  onPress: undefined,
};
const alertProps: AlertProps = { tone: "critical", text: "Failed" };
const textFieldCatalogProps: TextFieldCatalogProps = { label: "Email", value: "" };
const buttonCatalogProps: ButtonCatalogProps = { label: "Continue" };
const alertCatalogProps: AlertCatalogProps = { tone: "info", text: "Notice" };
void textFieldId;
void buttonId;
void alertId;
void changePayload;
void focusInput;
void pressPayload;
void textFieldProps;
void textFieldWithExplicitlyAbsentBindings;
void buttonProps;
void buttonWithExplicitlyAbsentBinding;
void alertProps;
void textFieldCatalogProps;
void buttonCatalogProps;
void alertCatalogProps;

// @ts-expect-error M03-T06-N01 TextField requires its visible label.
TextField({ value: "" });

// @ts-expect-error M03-T06-N02 TextField requires its controlled string value.
TextField({ label: "Email" });

// @ts-expect-error M03-T06-N03 TextField has no declared child slot.
TextField({ label: "Email", value: "", children: "Undeclared child" });

// @ts-expect-error M03-T06-N04 TextField exposes no arbitrary native input properties.
TextField({ label: "Email", value: "", name: "private-form-field" });

// @ts-expect-error M03-T06-N05 TextField boolean properties remain schema-derived booleans.
TextField({ label: "Email", value: "", invalid: "yes" });

const catalogPropsWithChangeBinding: TextFieldCatalogProps = {
  label: "Email",
  value: "",
  // @ts-expect-error M03-T06-N06 Trusted callbacks never become inert Catalog props.
  onChange: () => undefined,
};
void catalogPropsWithChangeBinding;

TextField({
  label: "Email",
  value: "",
  // @ts-expect-error M03-T06-N07 The change bridge receives inert data, not a native React event.
  onChange: (event: ChangeEvent<HTMLInputElement>) => void event,
});

const nativeInputRef = createRef<HTMLInputElement>();
// @ts-expect-error M03-T06-N08 TextField exposes a command handle rather than its DOM input.
TextField({ label: "Email", value: "", ref: nativeInputRef });

const invalidFocusInput: TextFieldFocusInput = {
  // @ts-expect-error M03-T06-N09 The focus command input schema is exactly empty.
  unexpected: true,
};
void invalidFocusInput;

// @ts-expect-error M03-T06-N10 Button requires its accessible label.
Button({});

// @ts-expect-error M03-T06-N11 Button variants are limited to the frozen Catalog enum.
Button({ label: "Continue", variant: "tertiary" });

// @ts-expect-error M03-T06-N12 Button has no child slot; its label is a Catalog prop.
Button({ label: "Continue", children: "Undeclared child" });

// @ts-expect-error M03-T06-N13 Button never exposes a native click event surface.
Button({ label: "Continue", onClick: () => undefined });

const catalogPropsWithPressBinding: ButtonCatalogProps = {
  label: "Continue",
  // @ts-expect-error M03-T06-N14 Trusted callbacks never become inert Catalog props.
  onPress: () => undefined,
};
void catalogPropsWithPressBinding;

// @ts-expect-error M03-T06-N15 Alert requires its tone.
Alert({ text: "Notice" });

// @ts-expect-error M03-T06-N16 Alert requires its inert text.
Alert({ tone: "info" });

// @ts-expect-error M03-T06-N17 Alert uses critical; danger belongs only to Button variant.
Alert({ tone: "danger", text: "Failed" });

// @ts-expect-error M03-T06-N18 Alert is a leaf and has no declared child slot.
Alert({ tone: "info", text: "Notice", children: "Undeclared child" });

// @ts-expect-error M03-T06-N19 Alert exposes no raw-HTML rendering surface.
Alert({ tone: "info", text: "Notice", dangerouslySetInnerHTML: { __html: "unsafe" } });

function cannotMutateChangePayload(payload: TextFieldChangePayload): void {
  // @ts-expect-error M03-T06-N20 Event payloads are readonly inert data.
  payload.value = "forged";
}
void cannotMutateChangePayload;

const invalidPressPayload: ButtonPressPayload = {
  // @ts-expect-error M03-T06-N21 The press payload schema is exactly empty.
  unexpected: true,
};
void invalidPressPayload;

// @ts-expect-error M03-T06-N22 Catalog props remain JSON-exact and reject explicit undefined.
const invalidUndefinedCatalogProp: ButtonCatalogProps = { label: "Continue", variant: undefined };
void invalidUndefinedCatalogProp;
