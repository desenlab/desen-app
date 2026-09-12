// @vitest-environment jsdom

import { createElement } from "react";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  StarterBoxReactAdapter,
  StarterGridReactAdapter,
  StarterHeadingReactAdapter,
  StarterIconReactAdapter,
  StarterImageReactAdapter,
  StarterSeparatorReactAdapter,
  StarterStackReactAdapter,
  StarterTextReactAdapter,
} from "../src/react-adapters.js";
import {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
} from "../src/contracts.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(() => {
  document.body.replaceChildren();
});

function input(
  capabilityId: string,
  props: Readonly<Record<string, unknown>>,
  slots: RuntimeReactComponentAdapterProps["slots"] = {},
  style: RuntimeReactComponentAdapterProps["style"] = { base: {} },
): RuntimeReactComponentAdapterProps {
  const interactions = Object.freeze({
    dispatchEvent: () => Object.freeze({ status: "unavailable" }),
    attachCommands: () => Object.freeze({ status: "unavailable" }),
    detachCommands: () => Object.freeze({ status: "unavailable" }),
  } satisfies RuntimeReactInteractionPort);
  return {
    identity: { capabilityId, sourceNodeId: "sample", runtimeNodeId: "sample:instance" },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots,
    style,
    interactions,
  };
}

describe("M10A-T05 layout and content Web adapters", () => {
  it("renders nested logical layout slots with RTL-safe inline alignment", () => {
    const text = input(STARTER_TEXT_CAPABILITY_ID, { text: "Nested content" });
    const box = input(
      STARTER_BOX_CAPABILITY_ID,
      { dir: "rtl" },
      { default: [createElement(StarterTextReactAdapter, { ...text, key: "text" })] },
      {
        base: {
          root: {
            borderColor: "#112233",
            borderWidth: 2,
            paddingInline: 12,
            marginInline: 8,
            textAlign: "start",
          },
        },
      },
    );
    const stack = input(
      STARTER_STACK_CAPABILITY_ID,
      { direction: "horizontal", wrap: true, dir: "rtl" },
      { default: [createElement(StarterBoxReactAdapter, { ...box, key: "box" })] },
      {
        base: {
          root: {
            gap: 16,
            width: "fill",
            justifyContent: "between",
            alignItems: "start",
          },
        },
      },
    );
    const view = render(<StarterStackReactAdapter {...stack} />);
    const stackElement = view.container.firstElementChild as HTMLElement;
    const boxElement = stackElement.firstElementChild as HTMLElement;
    expect(stackElement.getAttribute("dir")).toBe("rtl");
    expect(stackElement.style.flexDirection).toBe("row");
    expect(stackElement.style.flexWrap).toBe("wrap");
    expect(stackElement.style.justifyContent).toBe("space-between");
    expect(stackElement.style.alignItems).toBe("flex-start");
    expect(stackElement.style.gap).toBe("16px");
    expect(stackElement.style.width).toBe("100%");
    expect(boxElement.getAttribute("dir")).toBe("rtl");
    expect(boxElement.style.paddingInline).toBe("12px");
    expect(boxElement.style.marginInline).toBe("8px");
    expect(boxElement.style.marginLeft).toBe("");
    expect(boxElement.style.textAlign).toBe("start");
    expect(boxElement.style.borderStyle).toBe("solid");
    expect(boxElement.style.borderWidth).toBe("2px");
    expect(view.getByText("Nested content").tagName).toBe("P");
  });

  it("renders finite grid flow and all leaf semantic content without document-controlled markup", () => {
    const first = input(STARTER_TEXT_CAPABILITY_ID, { text: "First" });
    const second = input(STARTER_TEXT_CAPABILITY_ID, { text: "Second" });
    const grid = input(
      STARTER_GRID_CAPABILITY_ID,
      { columns: 3, flow: "column", dir: "ltr" },
      {
        default: [
          createElement(StarterTextReactAdapter, { ...first, key: "first" }),
          createElement(StarterTextReactAdapter, { ...second, key: "second" }),
        ],
      },
      { base: { root: { gap: 12, overflow: "auto", maxWidth: 640 } } },
    );
    const heading = input(STARTER_HEADING_CAPABILITY_ID, { text: "Safe heading", level: 3 });
    const image = input(STARTER_IMAGE_CAPABILITY_ID, {
      source: "neutral-grid",
      alt: "Neutral grid",
      fit: "contain",
    });
    const icon = input(STARTER_ICON_CAPABILITY_ID, {
      name: "info",
      label: "Information",
      decorative: false,
    });
    const decorativeIcon = input(STARTER_ICON_CAPABILITY_ID, {
      name: "check",
      label: "Completed",
      decorative: true,
    });
    const horizontal = input(
      STARTER_SEPARATOR_CAPABILITY_ID,
      { orientation: "horizontal" },
      {},
      { base: { root: { backgroundColor: "#E5E5E5", height: 2 } } },
    );
    const vertical = input(STARTER_SEPARATOR_CAPABILITY_ID, { orientation: "vertical" });
    const view = render(
      <>
        <StarterGridReactAdapter {...grid} />
        <StarterHeadingReactAdapter {...heading} />
        <StarterImageReactAdapter {...image} />
        <StarterIconReactAdapter {...icon} />
        <StarterIconReactAdapter {...decorativeIcon} />
        <StarterSeparatorReactAdapter {...horizontal} />
        <StarterSeparatorReactAdapter {...vertical} />
      </>,
    );
    const gridElement = view.getByText("First").parentElement as HTMLElement;
    expect(gridElement.style.display).toBe("grid");
    expect(gridElement.style.gridAutoFlow).toBe("column");
    expect(gridElement.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(gridElement.style.gridTemplateRows).toBe("repeat(1, minmax(0, auto))");
    expect(gridElement.style.overflow).toBe("auto");
    expect(view.getByRole("heading", { level: 3, name: "Safe heading" }).tagName).toBe("H3");
    const imageElement = view.getByRole("img", { name: "Neutral grid" }) as HTMLImageElement;
    expect(imageElement.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(imageElement.style.objectFit).toBe("contain");
    expect(view.getByRole("img", { name: "Information" }).tagName).toBe("svg");
    const iconElements = view.container.querySelectorAll("svg");
    expect(iconElements[1]?.getAttribute("aria-hidden")).toBe("true");
    const horizontalSeparator = view.container.querySelector("hr") as HTMLElement;
    expect(horizontalSeparator).not.toBeNull();
    expect(horizontalSeparator.style.backgroundColor).toBe("rgb(229, 229, 229)");
    expect(horizontalSeparator.style.height).toBe("2px");
    expect(
      view
        .getAllByRole("separator", { hidden: true })
        .find((element) => element.getAttribute("aria-orientation") === "vertical")
        ?.getAttribute("aria-orientation"),
    ).toBe("vertical");
  });

  it("server-renders only inert text nodes, trusted local media, and semantic elements", () => {
    const text = input(STARTER_TEXT_CAPABILITY_ID, { text: "<script>not executable</script>" });
    const heading = input(STARTER_HEADING_CAPABILITY_ID, { text: "Title", level: 1 });
    const image = input(STARTER_IMAGE_CAPABILITY_ID, {
      source: "neutral-horizon",
      alt: "Neutral horizon",
    });
    const html = renderToString(
      <>
        <StarterTextReactAdapter {...text} />
        <StarterHeadingReactAdapter {...heading} />
        <StarterImageReactAdapter {...image} />
      </>,
    );
    expect(html).toContain("&lt;script&gt;not executable&lt;/script&gt;");
    expect(html).toContain("<h1");
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("<script>");
  });

  it.each([
    [StarterBoxReactAdapter, input(STARTER_BOX_CAPABILITY_ID, { dir: "auto" }, { default: ["x"] })],
    [
      StarterStackReactAdapter,
      input(STARTER_STACK_CAPABILITY_ID, { direction: "diagonal" }, { default: ["x"] }),
    ],
    [
      StarterGridReactAdapter,
      input(STARTER_GRID_CAPABILITY_ID, { columns: 13 }, { default: ["x"] }),
    ],
    [
      StarterTextReactAdapter,
      input(STARTER_TEXT_CAPABILITY_ID, { text: createElement("b", {}, "x") }),
    ],
    [
      StarterImageReactAdapter,
      input(STARTER_IMAGE_CAPABILITY_ID, {
        source: "https://untrusted.invalid/image.png",
        alt: "Unsafe remote image",
      }),
    ],
    [
      StarterImageReactAdapter,
      input(
        STARTER_IMAGE_CAPABILITY_ID,
        { source: "neutral-horizon", alt: "Neutral horizon" },
        {},
        { base: { root: { color: "#112233" } } },
      ),
    ],
    [
      StarterIconReactAdapter,
      input(STARTER_ICON_CAPABILITY_ID, { name: "<svg onload=alert(1)>", label: "Unsafe" }),
    ],
    [
      StarterSeparatorReactAdapter,
      input(STARTER_SEPARATOR_CAPABILITY_ID, { orientation: "diagonal" }),
    ],
    [
      StarterSeparatorReactAdapter,
      input(
        STARTER_SEPARATOR_CAPABILITY_ID,
        { orientation: "horizontal" },
        {},
        { base: { root: { borderColor: "#E5E5E5" } } },
      ),
    ],
  ])(
    "rejects invalid dimensions, executable content, and closed prop or ineffective-style violations",
    (Adapter, props) => {
      expect(() => render(createElement(Adapter, props))).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    },
  );

  it.each([
    { base: { root: { width: -1 } } },
    { base: { root: { width: "calc(100% - 1px)" } } },
    { base: { root: { marginLeft: 10 } } },
    { base: { root: { selector: ".private [data-state]" } } },
    { base: { root: { backgroundColor: "url(https://untrusted.invalid)" } } },
    { hover: { root: { gap: 8 } } },
  ])("rejects unknown style authority, private selectors, and invalid dimensions", (style) => {
    const stack = input(
      STARTER_STACK_CAPABILITY_ID,
      { direction: "vertical" },
      { default: ["x"] },
      style,
    );
    expect(() => render(<StarterStackReactAdapter {...stack} />)).toThrow(
      "STARTER_ADAPTER_INPUT_INVALID",
    );
  });

  it("rejects missing required layout slots before a semantic container can render", () => {
    const box = input(STARTER_BOX_CAPABILITY_ID, { dir: "ltr" });
    expect(() => render(<StarterBoxReactAdapter {...box} />)).toThrow(
      "STARTER_ADAPTER_INPUT_INVALID",
    );
  });
});
