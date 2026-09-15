// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  StarterAccordionReactAdapter,
  StarterMenuReactAdapter,
  StarterPopoverReactAdapter,
  StarterSurfaceBoundary,
  StarterTooltipReactAdapter,
} from "../src/react-adapters.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(() => {
  document.body.innerHTML = "";
});

function input(
  capability: "Popover" | "Tooltip" | "Menu" | "Accordion",
  props: Record<string, unknown>,
  slots = {},
) {
  const events: { name: string; payload: unknown }[] = [];
  const interactions = Object.freeze({
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
  return {
    events,
    input: {
      identity: {
        capabilityId: `run.desen.starter/${capability}`,
        sourceNodeId: "t08",
        runtimeNodeId: `t08:${capability}`,
      },
      props: props as RuntimeReactComponentAdapterProps["props"],
      slots: slots as RuntimeReactComponentAdapterProps["slots"],
      style: { base: {} },
      interactions,
    } as RuntimeReactComponentAdapterProps,
  };
}

describe("M10A-T08 overlay and disclosure adapters", () => {
  it("opens and closes a Popover in the owned portal and returns open events", () => {
    const sample = input(
      "Popover",
      { triggerLabel: "Details", title: "Details", description: "More", closeLabel: "Close" },
      { content: ["Popover body"] },
    );
    const view = render(
      <StarterSurfaceBoundary>
        <StarterPopoverReactAdapter {...sample.input} />
      </StarterSurfaceBoundary>,
    );
    fireEvent.click(view.getByRole("button", { name: "Details" }));
    expect(view.getByRole("dialog")).toBeTruthy();
    expect(view.container.querySelector("[data-desen-starter-portals]")?.textContent).toContain(
      "Popover body",
    );
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(sample.events.map(({ name, payload }) => ({ name, payload }))).toEqual([
      { name: "openChange", payload: { open: true } },
      { name: "openChange", payload: { open: false } },
    ]);
  });

  it("keeps Menu item selection data-only and disabled items inert", () => {
    const sample = input("Menu", {
      triggerLabel: "Actions",
      items: [
        { id: "edit", label: "Edit" },
        { id: "remove", label: "Remove", disabled: true },
      ],
    });
    const view = render(
      <StarterSurfaceBoundary>
        <StarterMenuReactAdapter {...sample.input} />
      </StarterSurfaceBoundary>,
    );
    fireEvent.click(view.getByRole("button", { name: "Actions" }));
    fireEvent.click(view.getByRole("menuitem", { name: "Edit" }));
    expect(sample.events).toContainEqual({ name: "select", payload: { id: "edit" } });
    expect(view.queryByRole("menuitem", { name: "Remove" })).toBeNull();
  });

  it("projects Accordion panel slots in order and dispatches stable expanded values", () => {
    const sample = input(
      "Accordion",
      {
        items: [
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
        ],
      },
      { panels: ["First panel", "Second panel"] },
    );
    const view = render(<StarterAccordionReactAdapter {...sample.input} />);
    fireEvent.click(view.getByRole("button", { name: "One" }));
    expect(view.getByText("First panel")).toBeTruthy();
    expect(sample.events).toContainEqual({ name: "valueChange", payload: { value: ["one"] } });
  });

  it("renders Tooltip closed on the server and rejects forged portal authority or missing slots", () => {
    const tooltip = input("Tooltip", { label: "Help", content: "Helpful context" });
    expect(
      renderToString(
        <StarterSurfaceBoundary>
          <StarterTooltipReactAdapter {...tooltip.input} />
        </StarterSurfaceBoundary>,
      ),
    ).toContain("Help");
    const popover = input("Popover", { triggerLabel: "Open" });
    expect(() =>
      renderToString(
        <StarterSurfaceBoundary>
          <StarterPopoverReactAdapter {...popover.input} />
        </StarterSurfaceBoundary>,
      ),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    expect(() =>
      renderToString(
        <StarterSurfaceBoundary>
          <StarterTooltipReactAdapter
            {...tooltip.input}
            props={{ ...tooltip.input.props, container: "body" }}
          />
        </StarterSurfaceBoundary>,
      ),
    ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
  });

  it("does not require a document body fallback for overlay portals", async () => {
    const sample = input("Menu", { triggerLabel: "Actions", items: [{ id: "one", label: "One" }] });
    expect(() => render(<StarterMenuReactAdapter {...sample.input} />)).toThrow(
      "STARTER_PORTAL_BOUNDARY_REQUIRED",
    );
    await act(async () => undefined);
  });
});
