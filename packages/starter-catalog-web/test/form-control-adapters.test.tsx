// @vitest-environment jsdom

import { StrictMode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  StarterCheckboxReactAdapter,
  StarterRadioGroupReactAdapter,
  StarterSwitchReactAdapter,
  StarterTextAreaReactAdapter,
  StarterTextFieldReactAdapter,
} from "../src/react-adapters.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(cleanup);

type T06Capability = "TextField" | "TextArea" | "Checkbox" | "RadioGroup" | "Switch";

function harness(capability: T06Capability, props: Readonly<Record<string, unknown>>) {
  const events: { name: string; payload: unknown }[] = [];
  const interactions = Object.freeze({
    dispatchEvent(name, payload) {
      events.push({ name, payload });
      return Object.freeze({ status: "dispatched", completion: Promise.resolve() });
    },
    attachCommands: () => Object.freeze({ status: "unavailable" }),
    detachCommands: () => Object.freeze({ status: "unavailable" }),
  } satisfies RuntimeReactInteractionPort);
  const input: RuntimeReactComponentAdapterProps = {
    identity: {
      capabilityId: `run.desen.starter/${capability}`,
      sourceNodeId: `source.${capability}`,
      runtimeNodeId: `runtime.${capability}`,
    },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots: {},
    style: { base: {} },
    interactions,
  };
  return { input, events };
}

describe("M10A-T06 form control Web adapters", () => {
  it("renders real labelled form semantics with immutable help and error relationships", () => {
    const field = harness("TextField", {
      label: "Email address",
      value: "",
      helpText: "Used for account notices.",
      error: "Enter a valid address.",
      required: true,
    });
    const area = harness("TextArea", {
      label: "Project description",
      value: "",
      helpText: "A short description is enough.",
      rows: 5,
    });
    const checkbox = harness("Checkbox", {
      label: "Accept terms",
      checked: false,
      error: "Terms are required.",
      required: true,
    });
    const radio = harness("RadioGroup", {
      label: "Plan",
      options: [
        { value: "starter", label: "Starter" },
        { value: "team", label: "Team" },
      ],
      value: "starter",
      helpText: "You can change this later.",
    });
    const toggle = harness("Switch", {
      label: "Enable notifications",
      checked: false,
      helpText: "Only important account activity.",
    });
    const view = render(
      <StrictMode>
        <StarterTextFieldReactAdapter {...field.input} />
        <StarterTextAreaReactAdapter {...area.input} />
        <StarterCheckboxReactAdapter {...checkbox.input} />
        <StarterRadioGroupReactAdapter {...radio.input} />
        <StarterSwitchReactAdapter {...toggle.input} />
      </StrictMode>,
    );

    const input = view.getByRole("textbox", { name: "Email address" });
    const textarea = view.getByRole("textbox", { name: "Project description" });
    const checkboxControl = view.getByRole("checkbox", { name: "Accept terms" });
    const group = view.getByRole("radiogroup", { name: "Plan" });
    const starter = view.getByRole("radio", { name: "Starter" });
    const switchControl = view.getByRole("switch", { name: "Enable notifications" });

    expect(input.tagName).toBe("INPUT");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect((textarea as HTMLTextAreaElement).rows).toBe(5);
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toContain(
      "Email address",
    );
    expect(document.querySelector(`label[for="${textarea.id}"]`)?.textContent).toContain(
      "Project description",
    );
    const checkboxLabel = view.getByText("Accept terms").closest("label");
    const switchLabel = view.getByText("Enable notifications").closest("label");
    expect(checkboxLabel).not.toBeNull();
    expect(switchLabel).not.toBeNull();
    expect(checkboxLabel?.htmlFor).toBeTruthy();
    expect(switchLabel?.htmlFor).toBeTruthy();
    expect(document.getElementById(checkboxLabel?.htmlFor ?? "")?.tagName).toBe("INPUT");
    expect(document.getElementById(switchLabel?.htmlFor ?? "")?.tagName).toBe("INPUT");
    expect(
      document.getElementById(checkboxControl.getAttribute("aria-labelledby") ?? "")?.textContent,
    ).toContain("Accept terms");
    expect(
      document.getElementById(switchControl.getAttribute("aria-labelledby") ?? "")?.textContent,
    ).toContain("Enable notifications");
    expect(checkboxControl.getAttribute("aria-invalid")).toBe("true");
    expect(starter.getAttribute("aria-checked")).toBe("true");
    expect(group.getAttribute("aria-describedby")).toContain("help");
    expect(switchControl.getAttribute("aria-describedby")).toContain("help");
    const inputDescriptions = input.getAttribute("aria-describedby");
    expect(inputDescriptions).toContain("help");
    expect(inputDescriptions).toContain("error");
    expect(
      document.getElementById(input.getAttribute("aria-errormessage") ?? "")?.textContent,
    ).toBe("Enter a valid address.");
    expect(view.getByText("Enter a valid address.").getAttribute("role")).toBe("alert");
    fireEvent.click(checkboxLabel as HTMLLabelElement);
    fireEvent.click(switchLabel as HTMLLabelElement);
    expect(checkbox.events).toEqual([{ name: "change", payload: { checked: true } }]);
    expect(toggle.events).toEqual([{ name: "change", payload: { checked: true } }]);
  });

  it("projects only declared controlled JSON payloads from native interaction", () => {
    const field = harness("TextField", { label: "Name", value: "" });
    const area = harness("TextArea", { label: "Notes", value: "" });
    const checkbox = harness("Checkbox", { label: "Subscribe", checked: false });
    const radio = harness("RadioGroup", {
      label: "Plan",
      options: [
        { value: "starter", label: "Starter" },
        { value: "team", label: "Team" },
      ],
      value: "starter",
    });
    const toggle = harness("Switch", { label: "Notify", checked: false });
    const view = render(
      <>
        <StarterTextFieldReactAdapter {...field.input} />
        <StarterTextAreaReactAdapter {...area.input} />
        <StarterCheckboxReactAdapter {...checkbox.input} />
        <StarterRadioGroupReactAdapter {...radio.input} />
        <StarterSwitchReactAdapter {...toggle.input} />
      </>,
    );
    const fieldControl = view.getByRole("textbox", { name: "Name" });
    const areaControl = view.getByRole("textbox", { name: "Notes" });
    fieldControl.focus();
    expect(document.activeElement).toBe(fieldControl);
    fireEvent.change(fieldControl, { target: { value: "Ada" } });
    fireEvent.change(areaControl, { target: { value: "A durable note" } });
    fireEvent.click(view.getByRole("checkbox", { name: "Subscribe" }));
    fireEvent.click(view.getByRole("radio", { name: "Team" }));
    fireEvent.click(view.getByRole("switch", { name: "Notify" }));

    expect(field.events).toEqual([{ name: "change", payload: { value: "Ada" } }]);
    expect(area.events).toEqual([{ name: "change", payload: { value: "A durable note" } }]);
    expect(checkbox.events).toEqual([{ name: "change", payload: { checked: true } }]);
    expect(radio.events).toEqual([{ name: "change", payload: { value: "team" } }]);
    expect(toggle.events).toEqual([{ name: "change", payload: { checked: true } }]);
    for (const event of [
      field.events[0],
      area.events[0],
      checkbox.events[0],
      radio.events[0],
      toggle.events[0],
    ])
      expect(Object.isFrozen(event?.payload)).toBe(true);
  });

  it("keeps keyboard focus visible, allows declared style states, and never lets styling replace semantics", () => {
    const field = harness("TextField", { label: "Styled field", value: "" });
    const view = render(
      <StarterTextFieldReactAdapter
        {...field.input}
        style={{
          base: { control: { borderColor: "#112233", borderWidth: 2, paddingInline: 16 } },
          focus: { label: { color: "#aabbcc" } },
        }}
      />,
    );
    const control = view.getByRole("textbox", { name: "Styled field" });
    expect(control.style.borderColor).toBe("rgb(17, 34, 51)");
    expect(control.style.borderWidth).toBe("2px");
    expect(control.style.paddingInline).toBe("16px");
    fireEvent.focus(control);
    expect(view.getByText("Styled field").style.color).toBe("rgb(170, 187, 204)");
    expect(control.getAttribute("aria-labelledby")).toBeTruthy();
    expect(control.getAttribute("id")).toBeTruthy();
    expect(() =>
      render(
        <StarterTextFieldReactAdapter
          {...field.input}
          style={{ base: { control: { position: "fixed" } } }}
        />,
      ),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
  });

  it("projects every admitted RadioGroup state through its public parts without silently dropping a style", () => {
    const radio = harness("RadioGroup", {
      label: "Styled plan",
      options: [
        { value: "starter", label: "Starter" },
        { value: "team", label: "Team" },
      ],
      value: "starter",
      error: "Choose an admitted plan.",
      required: true,
    });
    const view = render(
      <StarterRadioGroupReactAdapter
        {...radio.input}
        style={{
          base: {
            control: { borderColor: "#101112" },
            option: { borderColor: "#131415" },
            optionLabel: { color: "#161718" },
            indicator: { backgroundColor: "#191a1b" },
          },
          selected: { control: { backgroundColor: "#1c1d1e" } },
          required: { option: { borderWidth: 2 } },
          invalid: { optionLabel: { color: "#1f2021" } },
          hover: { option: { marginInline: 12 } },
          focus: { optionLabel: { fontWeight: 700 } },
        }}
      />,
    );
    const group = view.getByRole("radiogroup", { name: "Styled plan" });
    const starter = view.getByRole("radio", { name: "Starter" });
    const team = view.getByRole("radio", { name: "Team" });
    const starterLabel = view.getByText("Starter");
    const teamLabel = view.getByText("Team");

    expect(group.style.backgroundColor).toBe("rgb(28, 29, 30)");
    expect(starter.style.borderWidth).toBe("2px");
    expect(starterLabel.style.color).toBe("rgb(31, 32, 33)");
    fireEvent.pointerEnter(starter);
    expect(starter.style.marginInline).toBe("12px");
    expect(team.style.marginInline).not.toBe("12px");
    fireEvent.focus(starter);
    expect(starterLabel.style.fontWeight).toBe("700");
    expect(teamLabel.style.fontWeight).not.toBe("700");
  });

  it("suppresses events for disabled controls and rejects invalid values, payload inputs, and duplicate radio values", () => {
    const field = harness("TextField", { label: "Disabled field", value: "", disabled: true });
    const checkbox = harness("Checkbox", {
      label: "Disabled checkbox",
      checked: false,
      disabled: true,
    });
    const radio = harness("RadioGroup", {
      label: "Disabled plan",
      options: [{ value: "starter", label: "Starter" }],
      value: "starter",
      disabled: true,
    });
    const toggle = harness("Switch", { label: "Disabled switch", checked: false, disabled: true });
    const view = render(
      <>
        <StarterTextFieldReactAdapter {...field.input} />
        <StarterCheckboxReactAdapter {...checkbox.input} />
        <StarterRadioGroupReactAdapter {...radio.input} />
        <StarterSwitchReactAdapter {...toggle.input} />
      </>,
    );
    expect(
      (view.getByRole("textbox", { name: "Disabled field" }) as HTMLInputElement).disabled,
    ).toBe(true);
    fireEvent.change(view.getByRole("textbox", { name: "Disabled field" }), {
      target: { value: "ignored" },
    });
    fireEvent.click(view.getByRole("checkbox", { name: "Disabled checkbox" }));
    fireEvent.click(view.getByRole("radio", { name: "Starter" }));
    fireEvent.click(view.getByRole("switch", { name: "Disabled switch" }));
    fireEvent.click(view.getByText("Disabled checkbox").closest("label") as HTMLLabelElement);
    fireEvent.click(view.getByText("Starter").closest("label") as HTMLLabelElement);
    fireEvent.click(view.getByText("Disabled switch").closest("label") as HTMLLabelElement);
    expect(field.events).toEqual([]);
    expect(checkbox.events).toEqual([]);
    expect(radio.events).toEqual([]);
    expect(toggle.events).toEqual([]);

    const unsafeField = harness("TextField", { label: "Unsafe", value: () => "not JSON" });
    expect(() => renderToString(<StarterTextFieldReactAdapter {...unsafeField.input} />)).toThrow(
      "STARTER_ADAPTER_INPUT_INVALID",
    );
    const duplicateRadio = harness("RadioGroup", {
      label: "Duplicate",
      options: [
        { value: "same", label: "First" },
        { value: "same", label: "Second" },
      ],
      value: "same",
    });
    expect(() =>
      renderToString(<StarterRadioGroupReactAdapter {...duplicateRadio.input} />),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    const unknownValueRadio = harness("RadioGroup", {
      label: "Unknown",
      options: [{ value: "known", label: "Known" }],
      value: "other",
    });
    expect(() =>
      renderToString(<StarterRadioGroupReactAdapter {...unknownValueRadio.input} />),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
  });

  it("server-renders the five form controls without native event or application-state authority", () => {
    const field = harness("TextField", { label: "Name", value: "Ada" });
    const area = harness("TextArea", { label: "Notes", value: "Safe text" });
    const checkbox = harness("Checkbox", { label: "Subscribe", checked: true });
    const radio = harness("RadioGroup", {
      label: "Plan",
      options: [{ value: "starter", label: "Starter" }],
      value: "starter",
    });
    const toggle = harness("Switch", { label: "Notify", checked: true });
    const html = renderToString(
      <>
        <StarterTextFieldReactAdapter {...field.input} />
        <StarterTextAreaReactAdapter {...area.input} />
        <StarterCheckboxReactAdapter {...checkbox.input} />
        <StarterRadioGroupReactAdapter {...radio.input} />
        <StarterSwitchReactAdapter {...toggle.input} />
      </>,
    );
    expect(html).toContain("Name");
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="switch"');
    expect(field.events).toEqual([]);
    expect(area.events).toEqual([]);
    expect(checkbox.events).toEqual([]);
    expect(radio.events).toEqual([]);
    expect(toggle.events).toEqual([]);
  });
});
