// @vitest-environment jsdom

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  StarterComboboxReactAdapter,
  StarterNumberFieldReactAdapter,
  StarterSelectReactAdapter,
  StarterSliderReactAdapter,
  StarterSurfaceBoundary,
  StarterTabsReactAdapter,
} from "../src/react-adapters.js";

import type {
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

type T07Capability = "Select" | "Combobox" | "Tabs" | "Slider" | "NumberField";

function harness(
  capability: T07Capability,
  props: Readonly<Record<string, unknown>>,
  slots: RuntimeReactComponentAdapterProps["slots"] = {},
  style: RuntimeReactComponentAdapterProps["style"] = { base: {} },
) {
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
    slots,
    style,
    interactions,
  };
  return { input, events };
}

function withinBoundary(element: ReturnType<typeof createElement>) {
  return renderToString(createElement(StarterSurfaceBoundary, { children: element }));
}

describe("M10A-T07 selection and numeric Web adapters", () => {
  it("preserves Select's legacy value/default behavior while admitting stable id data", () => {
    const legacy = harness("Select", {
      label: "Legacy typeface",
      options: [{ value: "paused", label: "Paused", disabled: true }],
      defaultValue: "paused",
    });
    const current = harness("Select", {
      label: "Current typeface",
      options: [{ id: "serif", label: "Serif" }],
      value: "serif",
    });

    expect(withinBoundary(createElement(StarterSelectReactAdapter, legacy.input))).toContain(
      "Legacy typeface",
    );
    expect(withinBoundary(createElement(StarterSelectReactAdapter, current.input))).toContain(
      "Current typeface",
    );
    expect(legacy.events).toEqual([]);
    expect(current.events).toEqual([]);
  });

  it("keeps Select's pre-T07 uniform padding surface without widening form controls", () => {
    const legacy = harness(
      "Select",
      {
        label: "Legacy spacing",
        options: [{ value: "sans", label: "Sans" }],
        defaultValue: "sans",
      },
      {},
      { base: { root: { padding: 12 } } },
    );
    expect(withinBoundary(createElement(StarterSelectReactAdapter, legacy.input))).toContain(
      "padding:12px",
    );
  });

  it("keeps Combobox filtering finite and adapter-owned instead of admitting a filter or renderer", () => {
    const combobox = harness("Combobox", {
      label: "Find a region",
      options: [
        { id: "north", label: "Northern region" },
        { id: "south", label: "Southern region" },
      ],
      value: "",
      placeholder: "Search regions",
      filterMode: "startsWith",
    });
    expect(withinBoundary(createElement(StarterComboboxReactAdapter, combobox.input))).toContain(
      "Find a region",
    );

    for (const props of [
      {
        label: "Find a region",
        options: [{ id: "north", label: "Northern region" }],
        filter: () => true,
      },
      {
        label: "Find a region",
        options: [{ id: "north", label: "Northern region" }],
        renderItem: () => null,
      },
      {
        label: "Find a region",
        options: [{ value: "north", label: "Northern region" }],
      },
    ]) {
      const unsafe = harness("Combobox", props);
      expect(() =>
        withinBoundary(createElement(StarterComboboxReactAdapter, unsafe.input)),
      ).toThrow("STARTER_ADAPTER_INPUT_INVALID");
    }
  });

  it("requires Tabs to pair stable tab data with exactly one ordered public panel per tab", () => {
    const tabs = harness(
      "Tabs",
      {
        label: "Sections",
        tabs: [
          { id: "overview", label: "Overview" },
          { id: "details", label: "Details" },
        ],
        value: "overview",
        orientation: "horizontal",
      },
      { panels: ["Overview panel", "Details panel"] },
    );
    const html = renderToString(createElement(StarterTabsReactAdapter, tabs.input));
    expect(html).toContain("Sections");
    expect(html).toContain("Overview panel");

    for (const invalid of [
      harness(
        "Tabs",
        {
          label: "Sections",
          tabs: [
            { id: "overview", label: "Overview" },
            { id: "overview", label: "Duplicate" },
          ],
          value: "overview",
        },
        { panels: ["One", "Two"] },
      ),
      harness(
        "Tabs",
        {
          label: "Sections",
          tabs: [{ id: "overview", label: "Overview" }],
          value: "overview",
        },
        { panels: ["One", "Extra"] },
      ),
      harness(
        "Tabs",
        {
          label: "Sections",
          tabs: [{ id: "overview", label: "Overview" }],
          value: "missing",
        },
        { panels: ["One"] },
      ),
    ]) {
      expect(() => renderToString(createElement(StarterTabsReactAdapter, invalid.input))).toThrow(
        "STARTER_ADAPTER_INPUT_INVALID",
      );
    }
  });

  it("admits only finite, in-range, step-aligned numeric data and never a renderer", () => {
    const slider = harness("Slider", {
      label: "Opacity",
      value: 50,
      min: 0,
      max: 100,
      step: 5,
      helpText: "Bounded opacity.",
    });
    const numberField = harness("NumberField", {
      label: "Columns",
      value: 2,
      min: 1,
      max: 12,
      step: 1,
    });
    expect(renderToString(createElement(StarterSliderReactAdapter, slider.input))).toContain(
      "Opacity",
    );
    expect(
      renderToString(createElement(StarterNumberFieldReactAdapter, numberField.input)),
    ).toContain("Columns");

    for (const [capability, props] of [
      ["Slider", { label: "Opacity", value: Number.NaN, min: 0, max: 100, step: 1 }],
      ["Slider", { label: "Opacity", value: 101, min: 0, max: 100, step: 1 }],
      ["NumberField", { label: "Columns", value: 2, min: 1, max: 12, step: 0 }],
      ["NumberField", { label: "Columns", value: 2, min: 12, max: 1, step: 1 }],
      [
        "NumberField",
        {
          label: "Columns",
          value: 2,
          min: 1,
          max: 12,
          step: 1,
          renderValue: () => null,
        },
      ],
    ] as const) {
      const invalid = harness(capability, props);
      const Adapter =
        capability === "Slider" ? StarterSliderReactAdapter : StarterNumberFieldReactAdapter;
      expect(() => renderToString(createElement(Adapter, invalid.input))).toThrow(
        "STARTER_ADAPTER_INPUT_INVALID",
      );
    }
  });
});
