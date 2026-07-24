// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert, Button, Stack, Text, TextField } from "../src/components/index.js";
import { REFERENCE_WEB_IMPLEMENTATION_METADATA } from "../src/parity/index.js";

import type {
  ButtonPressPayload,
  TextFieldChangePayload,
  TextFieldHandle,
} from "../src/components/index.js";

afterEach(cleanup);

describe("reference Web cumulative parity contracts", () => {
  it("guarantees exact fresh frozen event payloads without native-event leakage", () => {
    const changes: TextFieldChangePayload[] = [];
    const presses: ButtonPressPayload[] = [];
    const { container, getByRole } = render(
      <>
        <TextField label="Email" onChange={(payload) => changes.push(payload)} value="" />
        <Button label="Continue" onPress={(payload) => presses.push(payload)} />
      </>,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    const button = getByRole("button", { name: "Continue" });

    fireEvent.change(input, { target: { value: "first@example.test" } });
    fireEvent.change(input, { target: { value: "second@example.test" } });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(changes).toEqual([{ value: "first@example.test" }, { value: "second@example.test" }]);
    expect(presses).toEqual([{}, {}]);
    expect(changes[0]).not.toBe(changes[1]);
    expect(presses[0]).not.toBe(presses[1]);
    for (const payload of [...changes, ...presses]) {
      expect(Object.isFrozen(payload)).toBe(true);
      expect("nativeEvent" in payload).toBe(false);
      expect("target" in payload).toBe(false);
      expect("currentTarget" in payload).toBe(false);
    }
    expect(
      REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/TextField"]?.trustedBindings
        .events,
    ).toEqual({ change: "onChange" });
    expect(
      REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/Button"]?.trustedBindings
        .events,
    ).toEqual({ press: "onPress" });
  });

  it("implements only the declared focus command through a narrow frozen handle", () => {
    const enabledHandle = createRef<TextFieldHandle>();
    const disabledHandle = createRef<TextFieldHandle>();
    const { container } = render(
      <>
        <TextField label="Enabled" ref={enabledHandle} value="" />
        <TextField disabled label="Disabled" ref={disabledHandle} value="" />
      </>,
    );
    const controls = [...container.querySelectorAll("input")];

    expect(Object.keys(enabledHandle.current ?? {})).toEqual(["focus"]);
    expect(Object.isFrozen(enabledHandle.current)).toBe(true);
    expect("current" in (enabledHandle.current ?? {})).toBe(false);
    expect(
      REFERENCE_WEB_IMPLEMENTATION_METADATA.components["com.example.ui/TextField"]?.trustedBindings
        .commands,
    ).toEqual({ focus: "ref.focus" });
    for (const [capabilityId, contract] of Object.entries(
      REFERENCE_WEB_IMPLEMENTATION_METADATA.components,
    )) {
      if (capabilityId !== "com.example.ui/TextField") {
        expect(contract.declared.commands).toEqual([]);
        expect(contract.trustedBindings.commands).toEqual({});
      }
    }

    enabledHandle.current?.focus();
    expect(document.activeElement).toBe(controls[0]);
    disabledHandle.current?.focus();
    expect(document.activeElement).not.toBe(controls[1]);
  });

  it("preserves cumulative native accessibility semantics and declared content order", () => {
    const { container, getByRole } = render(
      <Stack direction="vertical">
        <Text role="heading" text="Sign in" />
        <TextField invalid label="Email" value="" />
        <Button label="Continue" loading />
        <Alert text="Try again" tone="critical" />
      </Stack>,
    );
    const root = container.firstElementChild;
    const label = container.querySelector("label");
    const input = container.querySelector("input");
    const button = getByRole("button", { name: "Continue" });
    const alert = getByRole("alert");

    expect(root?.tagName).toBe("DIV");
    expect(root?.getAttribute("role")).toBeNull();
    expect(root?.getAttribute("tabindex")).toBeNull();
    expect([...((root?.children ?? []) as HTMLCollection)].map((node) => node.tagName)).toEqual([
      "H2",
      "DIV",
      "BUTTON",
      "DIV",
    ]);
    expect(label?.htmlFor).toBe(input?.id);
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect((button as HTMLButtonElement).type).toBe("button");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(alert.textContent).toBe("Try again");
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("keeps undeclared DOM, raw-HTML, and executable values outside component output", () => {
    const hostileText = '<img src=x onerror="globalThis.compromised=true"><script>bad()</script>';
    const forgedStackProps = {
      role: "application",
      tabIndex: 0,
      onClick: () => {
        throw new Error("must not run");
      },
      children: <Text text={hostileText} />,
    } as unknown as Parameters<typeof Stack>[0];
    const forgedTextProps = {
      text: hostileText,
      dangerouslySetInnerHTML: { __html: "<strong>forged</strong>" },
    } as unknown as Parameters<typeof Text>[0];
    const forgedButtonProps = {
      label: hostileText,
      role: "link",
      href: "https://example.test/",
      onClick: () => {
        throw new Error("must not run");
      },
    } as unknown as Parameters<typeof Button>[0];
    const { container } = render(
      <>
        <Stack {...forgedStackProps} />
        <Text {...forgedTextProps} />
        <Button {...forgedButtonProps} />
      </>,
    );

    expect(container.querySelector("[role='application']")).toBeNull();
    expect(container.querySelector("[role='link']")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain(hostileText);
  });
});
