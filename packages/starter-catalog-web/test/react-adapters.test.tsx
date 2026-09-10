// @vitest-environment jsdom

import { StrictMode, act, createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";

import {
  STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  StarterButtonReactAdapter,
  StarterDialogReactAdapter,
  StarterSelectReactAdapter,
  StarterSurfaceBoundary,
} from "../src/react-adapters.js";
import { STARTER_COMPONENT_REGISTRATIONS } from "../src/contracts.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(cleanup);

function harness(
  capability: "Button" | "Select" | "Dialog",
  props: Readonly<Record<string, unknown>>,
) {
  const events: { name: string; payload: unknown }[] = [];
  const port = Object.freeze({
    dispatchEvent(name, payload) {
      events.push({ name, payload });
      return Object.freeze({ status: "dispatched", completion: Promise.resolve() });
    },
    attachCommands() {
      return Object.freeze({ status: "unavailable" });
    },
    detachCommands() {
      return Object.freeze({ status: "unavailable" });
    },
  } satisfies RuntimeReactInteractionPort);
  const input: RuntimeReactComponentAdapterProps = {
    identity: {
      capabilityId: `run.desen.starter/${capability}`,
      sourceNodeId: "sample",
      runtimeNodeId: "sample:instance",
    },
    props: props as RuntimeReactComponentAdapterProps["props"],
    slots: {},
    style: { base: {} },
    interactions: port,
  };
  return { input, events };
}

describe("M10A-T01 static starter adapter boundary", () => {
  it("registers exactly the Catalog inventory once, with immutable remount policy", () => {
    const result = createRuntimeReactAdapterRegistry(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT);
    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("registry rejected");
    expect(result.snapshot.componentCapabilityIds).toEqual(
      STARTER_COMPONENT_REGISTRATIONS.map(({ id }) => id).sort(),
    );
    expect(Object.isFrozen(STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT)).toBe(true);
    for (const registration of STARTER_WEB_REACT_ADAPTER_REGISTRY_INPUT.components)
      expect(Object.isFrozen(registration)).toBe(true);
  });

  it("projects Button activation to a fresh frozen empty JSON object", () => {
    const { input, events } = harness("Button", { label: "Continue" });
    const view = render(<StarterButtonReactAdapter {...input} />);
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    fireEvent.click(view.getByRole("button", { name: "Continue" }));
    expect(events).toEqual([
      { name: "press", payload: {} },
      { name: "press", payload: {} },
    ]);
    expect(events[0]?.payload).not.toBe(events[1]?.payload);
    expect(Object.isFrozen(events[0]?.payload)).toBe(true);
    expect(JSON.stringify(events)).toBe(
      '[{"name":"press","payload":{}},{"name":"press","payload":{}}]',
    );
  });

  it("keeps a loading Button focused but suppresses both loading and disabled activation", () => {
    const { input, events } = harness("Button", { label: "Continue" });
    const view = render(<StarterButtonReactAdapter {...input} />);
    const button = view.getByRole("button");
    button.focus();
    view.rerender(
      <StarterButtonReactAdapter {...input} props={{ label: "Continue", loading: true }} />,
    );
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    view.rerender(
      <StarterButtonReactAdapter {...input} props={{ label: "Continue", disabled: true }} />,
    );
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(events).toEqual([]);
  });

  it("projects only declared finite style properties and preserves the visible focus outline", () => {
    const { input } = harness("Button", { label: "Styled" });
    const view = render(
      <StarterButtonReactAdapter
        {...input}
        style={{
          base: { root: { backgroundColor: "#123456", borderRadius: 12 } },
          focus: { label: { color: "#aabbcc" } },
        }}
      />,
    );
    const button = view.getByRole("button");
    expect(button.style.backgroundColor).toBe("rgb(18, 52, 86)");
    expect(button.style.borderRadius).toBe("12px");
    fireEvent.focus(button);
    expect(view.getByText("Styled").style.color).toBe("rgb(170, 187, 204)");
    expect(button.style.outline).toBe("");
  });

  it("survives StrictMode replay, compatible re-render, unmount and fresh mount without duplicate events", () => {
    const { input, events } = harness("Button", { label: "First" });
    const view = render(
      <StrictMode>
        <StarterSurfaceBoundary>
          <StarterButtonReactAdapter {...input} />
        </StarterSurfaceBoundary>
      </StrictMode>,
    );
    const button = view.getByRole("button");
    view.rerender(
      <StrictMode>
        <StarterSurfaceBoundary>
          <StarterButtonReactAdapter {...input} props={{ label: "Second" }} />
        </StarterSurfaceBoundary>
      </StrictMode>,
    );
    expect(view.getByRole("button")).toBe(button);
    fireEvent.click(button);
    view.unmount();
    fireEvent.click(button);
    expect(events).toHaveLength(1);
    const remount = render(
      <StrictMode>
        <StarterSurfaceBoundary>
          <StarterButtonReactAdapter {...input} />
        </StarterSurfaceBoundary>
      </StrictMode>,
    );
    expect(remount.getByRole("button")).not.toBe(button);
    fireEvent.click(remount.getByRole("button"));
    expect(events).toHaveLength(2);
  });

  it("server-renders and hydrates the three bounded closed controls without mismatches or render-time events", async () => {
    const button = harness("Button", { label: "Continue" });
    const select = harness("Select", {
      label: "Typeface",
      options: [{ value: "sans", label: "Sans" }],
      defaultValue: "sans",
    });
    const dialog = harness("Dialog", {
      triggerLabel: "Open details",
      title: "Details",
      description: "Sample content",
      closeLabel: "Close",
    });
    const tree = (
      <StrictMode>
        <StarterSurfaceBoundary>
          <StarterButtonReactAdapter {...button.input} />
          <StarterSelectReactAdapter {...select.input} />
          <StarterDialogReactAdapter
            {...dialog.input}
            slots={{
              content: [
                createElement(StarterButtonReactAdapter, { ...button.input, key: "content" }),
              ],
            }}
          />
        </StarterSurfaceBoundary>
      </StrictMode>
    );
    const html = renderToString(tree);
    expect(html).toContain("Continue");
    expect(html).not.toContain('role="dialog"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, {
        onRecoverableError: (error) => {
          errors.push(error);
        },
      });
    });
    expect(errors).toEqual([]);
    expect(button.events).toEqual([]);
    expect(select.events).toEqual([]);
    expect(dialog.events).toEqual([]);
    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });

  it.each([
    { label: "Bad", onClick: () => undefined },
    { label: createElement("b", {}, "Not JSON") },
    { label: "Bad", render: "module:untrusted" },
    { label: "Bad", container: "body" },
    { label: "Bad", dangerouslySetInnerHTML: { __html: "<script>" } },
  ])("rejects executable/React-node/unknown prop injection before rendering", (props) => {
    const { input } = harness("Button", props);
    expect(() => renderToString(<StarterButtonReactAdapter {...input} />)).toThrow();
  });

  it.each([
    { base: { privatePart: { color: "#ffffff" } } },
    { base: { root: { position: "fixed" } } },
    { base: { root: { backgroundColor: "url(https://untrusted.invalid)" } } },
    { base: { root: { padding: 129 } } },
    { unknownState: { root: { padding: 8 } } },
  ])("rejects unknown style authority and unsafe values", (style) => {
    const { input } = harness("Button", { label: "Bad" });
    expect(() => renderToString(<StarterButtonReactAdapter {...input} style={style} />)).toThrow(
      "STARTER_ADAPTER_INPUT_INVALID",
    );
  });

  it("rejects a capability mismatch and an unsatisfied required slot", () => {
    const button = harness("Button", { label: "Bad" });
    expect(() =>
      renderToString(
        <StarterButtonReactAdapter
          {...button.input}
          identity={{ ...button.input.identity, capabilityId: "run.desen.starter/Unknown" }}
        />,
      ),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    const dialog = harness("Dialog", {
      triggerLabel: "Open",
      title: "Details",
      description: "Details",
      closeLabel: "Close",
    });
    expect(() =>
      renderToString(
        <StarterSurfaceBoundary>
          <StarterDialogReactAdapter {...dialog.input} />
        </StarterSurfaceBoundary>,
      ),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
  });

  it("refuses a missing approved portal boundary instead of falling back to document.body", () => {
    const { input } = harness("Select", {
      label: "Typeface",
      options: [{ value: "sans", label: "Sans" }],
    });
    expect(() => renderToString(<StarterSelectReactAdapter {...input} />)).toThrow(
      "STARTER_PORTAL_BOUNDARY_REQUIRED",
    );
  });

  it("rejects a portal target moved outside its owned surface on the next adapter render", () => {
    const { input } = harness("Select", {
      label: "Typeface",
      options: [{ value: "sans", label: "Sans" }],
    });
    const tree = (label: string) => (
      <StarterSurfaceBoundary>
        <StarterSelectReactAdapter {...input} props={{ ...input.props, label }} />
      </StarterSurfaceBoundary>
    );
    const view = render(tree("Typeface"));
    const target = view.container.querySelector("[data-desen-starter-portals]");
    if (target === null) throw new Error("Expected committed portal target");
    const outside = document.createElement("div");
    document.body.append(outside);
    outside.append(target);
    try {
      expect(() => view.rerender(tree("Changed typeface"))).toThrow(
        "STARTER_PORTAL_BOUNDARY_INVALID",
      );
      expect(outside.querySelector("[role='listbox']")).toBeNull();
    } finally {
      outside.remove();
    }
  });

  it("applies declared Dialog text defaults without relying on JSON Schema mutation", () => {
    const { input } = harness("Dialog", {});
    const html = renderToString(
      <StarterSurfaceBoundary>
        <StarterDialogReactAdapter
          {...input}
          slots={{ content: ["Inert admitted test content"] }}
        />
      </StarterSurfaceBoundary>,
    );
    expect(html).toContain("Open dialog");
  });

  it("rejects duplicate option identities and a nonexistent initial selection", () => {
    for (const props of [
      {
        label: "Typeface",
        options: [
          { value: "sans", label: "Sans" },
          { value: "sans", label: "Other" },
        ],
      },
      { label: "Typeface", options: [{ value: "sans", label: "Sans" }], defaultValue: "missing" },
    ]) {
      const { input } = harness("Select", props);
      expect(() =>
        renderToString(
          <StarterSurfaceBoundary>
            <StarterSelectReactAdapter {...input} />
          </StarterSurfaceBoundary>,
        ),
      ).toThrow("STARTER_SELECT_OPTIONS_INVALID");
    }
  });
});
