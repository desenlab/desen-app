// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ALERT_CAPABILITY_ID,
  BUTTON_CAPABILITY_ID,
  TEXT_FIELD_CAPABILITY_ID,
  Alert,
  Button,
  TextField,
  alertComponentRegistration,
  buttonComponentRegistration,
  textFieldComponentRegistration,
} from "../src/components/index.js";

import type {
  ButtonPressPayload,
  TextFieldChangePayload,
  TextFieldHandle,
} from "../src/components/index.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

afterEach(cleanup);

describe("reference TextField, Button, and Alert capabilities", () => {
  it("registers the three exact closed interaction contracts as immutable data", () => {
    expect(TEXT_FIELD_CAPABILITY_ID).toBe("com.example.ui/TextField");
    expect(BUTTON_CAPABILITY_ID).toBe("com.example.ui/Button");
    expect(ALERT_CAPABILITY_ID).toBe("com.example.ui/Alert");
    expect(textFieldComponentRegistration.id).toBe(TEXT_FIELD_CAPABILITY_ID);
    expect(buttonComponentRegistration.id).toBe(BUTTON_CAPABILITY_ID);
    expect(alertComponentRegistration.id).toBe(ALERT_CAPABILITY_ID);
    expect(textFieldComponentRegistration.manifest.propsSchema.additionalProperties).toBe(false);
    expect(buttonComponentRegistration.manifest.propsSchema.additionalProperties).toBe(false);
    expect(alertComponentRegistration.manifest.propsSchema.additionalProperties).toBe(false);
    expect(textFieldComponentRegistration.manifest.events.change.payloadSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: { type: "string" } },
    });
    expect(textFieldComponentRegistration.manifest.commands.focus.inputSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
    });
    expect(buttonComponentRegistration.manifest.events.press.payloadSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
    });
    expect(alertComponentRegistration.manifest.propsSchema.properties.tone.enum).toEqual([
      "info",
      "success",
      "warning",
      "critical",
    ]);
    expectDeeplyFrozen(textFieldComponentRegistration);
    expectDeeplyFrozen(buttonComponentRegistration);
    expectDeeplyFrozen(alertComponentRegistration);
  });

  it("associates every visible TextField label with one unique native input", () => {
    const { container } = render(
      <>
        <TextField label="Email" value="" placeholder="name@example.test" />
        <TextField label="Password" value="secret" secure />
      </>,
    );
    const labels = [...container.querySelectorAll("label")];
    const controls = [...container.querySelectorAll("input")];

    expect(labels).toHaveLength(2);
    expect(controls).toHaveLength(2);
    expect(labels.map((label) => label.htmlFor)).toEqual(controls.map((control) => control.id));
    expect(new Set(controls.map((control) => control.id)).size).toBe(2);
    expect(controls[0]?.type).toBe("text");
    expect(controls[0]?.placeholder).toBe("name@example.test");
    expect(controls[1]?.type).toBe("password");
    expect(controls[1]?.value).toBe("secret");
  });

  it("maps TextField invalid and disabled states without inventing error content", () => {
    const { container } = render(<TextField disabled invalid label="Account" value="locked" />);
    const control = container.querySelector("input");

    expect(control?.disabled).toBe(true);
    expect(control?.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(container.querySelector("[aria-errormessage]")).toBeNull();
    expect(container.textContent).toBe("Account");
  });

  it("emits a fresh frozen exact TextField change payload and no DOM event", () => {
    const payloads: TextFieldChangePayload[] = [];
    const { container } = render(
      <TextField label="Email" onChange={(payload) => payloads.push(payload)} value="" />,
    );
    const control = container.querySelector("input");
    expect(control).not.toBeNull();

    fireEvent.change(control as HTMLInputElement, { target: { value: "first@example.test" } });
    fireEvent.change(control as HTMLInputElement, { target: { value: "second@example.test" } });

    expect(payloads).toEqual([{ value: "first@example.test" }, { value: "second@example.test" }]);
    expect(payloads[0]).not.toBe(payloads[1]);
    for (const payload of payloads) {
      expect(Object.keys(payload)).toEqual(["value"]);
      expect(Object.isFrozen(payload)).toBe(true);
      expect(Reflect.set(payload, "value", "forged")).toBe(false);
      expect("nativeEvent" in payload).toBe(false);
      expect("target" in payload).toBe(false);
    }
  });

  it("suppresses TextField change and focus bridges while disabled", () => {
    let changes = 0;
    const handle = createRef<TextFieldHandle>();
    const { container } = render(
      <TextField
        disabled
        label="Disabled"
        onChange={() => {
          changes += 1;
        }}
        ref={handle}
        value=""
      />,
    );
    const control = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(control, { target: { value: "ignored" } });
    handle.current?.focus();

    expect(changes).toBe(0);
    expect(document.activeElement).not.toBe(control);
  });

  it("exposes only the narrow frozen TextField focus command handle", () => {
    const handle = createRef<TextFieldHandle>();
    const { container } = render(<TextField label="Focusable" ref={handle} value="" />);
    const control = container.querySelector("input");

    expect(handle.current).not.toBeNull();
    expect(Object.keys(handle.current ?? {})).toEqual(["focus"]);
    expect(Object.isFrozen(handle.current)).toBe(true);
    expect("current" in (handle.current ?? {})).toBe(false);
    handle.current?.focus();
    expect(document.activeElement).toBe(control);
  });

  it("emits fresh frozen empty Button press payloads from native activation", () => {
    const payloads: ButtonPressPayload[] = [];
    const { getByRole } = render(
      <Button label="Continue" onPress={(payload) => payloads.push(payload)} />,
    );
    const button = getByRole("button", { name: "Continue" }) as HTMLButtonElement;

    expect(button.type).toBe("button");
    expect(button.dataset.variant).toBe("primary");
    fireEvent.click(button);
    button.click();

    expect(payloads).toEqual([{}, {}]);
    expect(payloads[0]).not.toBe(payloads[1]);
    for (const payload of payloads) {
      expect(Object.keys(payload)).toEqual([]);
      expect(Object.isFrozen(payload)).toBe(true);
      expect(Reflect.set(payload, "forged", true)).toBe(false);
    }
  });

  it("suppresses Button press while preserving focus during loading", () => {
    let presses = 0;
    const { getByRole, rerender } = render(
      <Button
        label="Continue"
        loading
        onPress={() => {
          presses += 1;
        }}
      />,
    );
    const loadingButton = getByRole("button", { name: "Continue" }) as HTMLButtonElement;

    expect(loadingButton.disabled).toBe(false);
    expect(loadingButton.getAttribute("aria-busy")).toBe("true");
    expect(loadingButton.getAttribute("aria-disabled")).toBe("true");
    loadingButton.focus();
    expect(document.activeElement).toBe(loadingButton);
    fireEvent.click(loadingButton);
    loadingButton.click();
    expect(presses).toBe(0);

    rerender(
      <Button
        disabled
        label="Continue"
        onPress={() => {
          presses += 1;
        }}
      />,
    );
    const disabledButton = getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(disabledButton.disabled).toBe(true);
    fireEvent.click(disabledButton);
    disabledButton.click();
    expect(presses).toBe(0);
  });

  it("maps every Button variant without creating toggle or submit semantics", () => {
    const { container } = render(
      <>
        <Button label="Primary" variant="primary" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Danger" variant="danger" />
      </>,
    );
    const buttons = [...container.querySelectorAll("button")];

    expect(buttons.map((button) => button.dataset.variant)).toEqual([
      "primary",
      "secondary",
      "danger",
    ]);
    expect(buttons.every((button) => button.type === "button")).toBe(true);
    expect(container.querySelector("[aria-pressed]")).toBeNull();
  });

  it("uses polite status roles for ordinary Alert tones and alert only for critical", () => {
    const { container } = render(
      <>
        <Alert text="Information" tone="info" />
        <Alert text="Saved" tone="success" />
        <Alert text="Review this" tone="warning" />
        <Alert text="Sign-in failed" tone="critical" />
      </>,
    );

    expect(
      [...container.querySelectorAll("[role='status']")].map((node) => node.textContent),
    ).toEqual(["Information", "Saved", "Review this"]);
    expect(container.querySelector("[role='alert']")?.textContent).toBe("Sign-in failed");
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("keeps TextField, Button, and Alert strings inert", () => {
    const hostile =
      '<img src=x onerror="globalThis.compromised=true"><script>globalThis.bad=true</script>';
    const { container } = render(
      <>
        <TextField label={hostile} placeholder={hostile} value={hostile} />
        <Button label={hostile} />
        <Alert text={hostile} tone="critical" />
      </>,
    );
    const input = container.querySelector("input");

    expect(input?.value).toBe(hostile);
    expect(input?.placeholder).toBe(hostile);
    expect(container.querySelector("label")?.textContent).toBe(hostile);
    expect(container.querySelector("button")?.textContent).toBe(hostile);
    expect(container.querySelector("[role='alert']")?.textContent).toBe(hostile);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
