// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Alert,
  Button,
  STACK_CAPABILITY_ID,
  TEXT_CAPABILITY_ID,
  Stack,
  Text,
  TextField,
  stackComponentRegistration,
  textComponentRegistration,
} from "../src/components/index.js";
import { StackReactAdapter } from "../src/react-adapters/index.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

const STACK_ADAPTER_IDENTITY = Object.freeze({
  capabilityId: "com.example.ui/Stack",
  runtimeNodeId: "runtime:sign-in.layout",
  sourceNodeId: "sign-in.layout",
});

const EMPTY_STACK_STYLE = Object.freeze({
  base: Object.freeze({}),
}) as RuntimeReactComponentAdapterProps["style"];

const UNAVAILABLE_STACK_INTERACTIONS = Object.freeze({
  attachCommands: () => Object.freeze({ status: "unavailable" } as const),
  detachCommands: () => Object.freeze({ status: "unavailable" } as const),
  dispatchEvent: () => Object.freeze({ status: "unavailable" } as const),
} satisfies RuntimeReactInteractionPort);

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

function layoutContract(element: HTMLElement) {
  return Object.freeze({
    maxWidth: element.style.maxWidth,
    minWidth: element.style.minWidth,
    width: element.style.width,
  });
}

function adapterStack(children: readonly ReactNode[]) {
  return (
    <StackReactAdapter
      identity={STACK_ADAPTER_IDENTITY}
      interactions={UNAVAILABLE_STACK_INTERACTIONS}
      props={Object.freeze({ direction: "vertical", gap: "md", maxWidth: 420 })}
      slots={Object.freeze({ default: Object.freeze([...children]) })}
      style={EMPTY_STACK_STYLE}
    />
  );
}

afterEach(cleanup);

describe("reference Stack and Text capabilities", () => {
  it("registers exact closed public contracts as detached immutable data", () => {
    expect(STACK_CAPABILITY_ID).toBe("com.example.ui/Stack");
    expect(TEXT_CAPABILITY_ID).toBe("com.example.ui/Text");
    expect(stackComponentRegistration.id).toBe(STACK_CAPABILITY_ID);
    expect(textComponentRegistration.id).toBe(TEXT_CAPABILITY_ID);
    expect(stackComponentRegistration.manifest.propsSchema.additionalProperties).toBe(false);
    expect(textComponentRegistration.manifest.propsSchema.additionalProperties).toBe(false);
    expect(stackComponentRegistration.manifest.slots?.default).toEqual({
      required: false,
      minItems: 0,
      acceptsCategories: ["layout", "content", "input", "action", "feedback", "complex"],
    });
    expectDeeplyFrozen(stackComponentRegistration);
    expectDeeplyFrozen(textComponentRegistration);
  });

  it("renders Stack as a neutral flex container while preserving child order", () => {
    const { container } = render(
      <Stack direction="horizontal" gap="md" maxWidth={420} align="center">
        <Text text="First" />
        <Text text="Second" role="caption" />
      </Stack>,
    );
    const stack = container.firstElementChild;

    expect(stack?.tagName).toBe("DIV");
    expect(stack?.getAttribute("role")).toBeNull();
    expect(stack?.getAttribute("tabindex")).toBeNull();
    expect(
      [...((stack?.children ?? []) as HTMLCollection)].map((child) => child.textContent),
    ).toEqual(["First", "Second"]);
    expect((stack as HTMLElement).style.display).toBe("flex");
    expect((stack as HTMLElement).style.flexDirection).toBe("row");
    expect((stack as HTMLElement).style.gap).toBe("var(--desen-space-md, 1rem)");
    expect((stack as HTMLElement).style.maxWidth).toBe("420px");
    expect((stack as HTMLElement).style.minWidth).toBe("0px");
    expect((stack as HTMLElement).style.width).toBe("100%");
    expect((stack as HTMLElement).style.alignItems).toBe("center");
  });

  it("keeps a maxWidth layout frame independent from conditional child content", () => {
    const { container, rerender } = render(
      <Stack direction="vertical" maxWidth={420}>
        <Text text="Sign in" role="heading" />
        <TextField label="Email" value="" />
        <TextField label="Password" secure value="" />
        <Button label="Sign in" />
      </Stack>,
    );
    const frame = container.firstElementChild as HTMLElement;
    const baseline = layoutContract(frame);

    rerender(
      <Stack direction="vertical" maxWidth={420}>
        <Text text="Sign in" role="heading" />
        <TextField label="Email" value="" />
        <TextField label="Password" secure value="" />
        <Alert text="Sign-in failed. Check your details and try again." tone="critical" />
        <Button label="Sign in" />
      </Stack>,
    );

    expect(layoutContract(frame)).toEqual(baseline);
    expect(baseline).toEqual({ maxWidth: "420px", minWidth: "0px", width: "100%" });
    expect(within(frame).getByRole("alert").textContent).toBe(
      "Sign-in failed. Check your details and try again.",
    );
    expect(frame.style.position).toBe("");
    expect(frame.style.transform).toBe("");
  });

  it("preserves the same frame contract through the public Stack React adapter", () => {
    const baselineChildren = Object.freeze([
      <Text key="title" role="heading" text="Sign in" />,
      <TextField key="email" label="Email" value="" />,
      <Button key="submit" label="Sign in" />,
    ]);
    const { container, rerender } = render(adapterStack(baselineChildren));
    const frame = container.firstElementChild as HTMLElement;
    const baseline = layoutContract(frame);

    rerender(
      adapterStack(
        Object.freeze([
          ...baselineChildren.slice(0, 2),
          <Alert
            key="invalid-credentials"
            text="Sign-in failed. Check your details and try again."
            tone="critical"
          />,
          baselineChildren[2],
        ]),
      ),
    );

    expect(container.firstElementChild).toBe(frame);
    expect(layoutContract(frame)).toEqual(baseline);
    expect(baseline).toEqual({ maxWidth: "420px", minWidth: "0px", width: "100%" });
    expect(within(frame).getByRole("alert")).toBeTruthy();
  });

  it("keeps Stack defaults deterministic and does not invent spacing", () => {
    const { container } = render(<Stack />);
    const stack = container.firstElementChild as HTMLElement;

    expect(stack.style.flexDirection).toBe("column");
    expect(stack.style.gap).toBe("");
    expect(stack.style.maxWidth).toBe("");
    expect(stack.style.alignItems).toBe("");
  });

  it("maps Text roles to native non-interactive semantics", () => {
    const { container } = render(
      <>
        <Text text="Body" />
        <Text text="Heading" role="heading" />
        <Text text="Caption" role="caption" />
      </>,
    );

    expect(container.querySelector("p")?.textContent).toBe("Body");
    expect(container.querySelector("h2")?.textContent).toBe("Heading");
    expect(container.querySelector("small")?.textContent).toBe("Caption");
    expect(container.querySelector("[role]")).toBeNull();
  });

  it("renders hostile markup-like text as inert escaped content", () => {
    const hostileText = '<img src=x onerror="globalThis.compromised=true"><script>bad()</script>';
    const { container } = render(<Text text={hostileText} />);

    expect(container.textContent).toBe(hostileText);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});
