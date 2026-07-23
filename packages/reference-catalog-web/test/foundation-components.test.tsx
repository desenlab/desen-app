// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  STACK_CAPABILITY_ID,
  TEXT_CAPABILITY_ID,
  Stack,
  Text,
  stackComponentRegistration,
  textComponentRegistration,
} from "../src/components/index.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
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
    expect((stack as HTMLElement).style.alignItems).toBe("center");
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
