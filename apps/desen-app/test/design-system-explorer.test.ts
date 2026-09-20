import { describe, expect, it } from "vitest";

import {
  prepareDesignSystemExplorer,
  type DesignSystemExplorerModel,
} from "../src/design-system-explorer.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/reference-authoring-profile.js";

function requireExplorer(): DesignSystemExplorerModel {
  const result = prepareDesignSystemExplorer(REFERENCE_AUTHORING_MODEL, {
    adapterCapabilityIds: [
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
      "com.example.ui/Button",
    ],
  });
  if (!result.ok) throw new Error(`Expected explorer projection: ${result.reason}.`);
  return result.model;
}

describe("Design System explorer projection", () => {
  it("derives searchable component documentation from the admitted Catalog and Source", () => {
    const model = requireExplorer();
    const button = model.components.find(({ displayName }) => displayName === "Button");

    expect(button).toBeDefined();
    expect(button?.props.map(({ name }) => name)).toContain("label");
    expect(button?.events.map(({ name }) => name)).toContain("press");
    expect(button?.visualStates).toContain("base");
    expect(button?.scenarios.length).toBeGreaterThan(0);
    expect(model.usageTotal).toBeGreaterThan(0);
    expect(model.sourceFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("makes a missing runtime adapter visible without executing Catalog data", () => {
    const result = prepareDesignSystemExplorer(REFERENCE_AUTHORING_MODEL, {
      adapterCapabilityIds: [],
    });
    if (!result.ok) throw new Error(`Expected explorer projection: ${result.reason}.`);

    expect(result.model.adapterMismatchCount).toBe(result.model.components.length);
    expect(result.model.components.every(({ adapterStatus }) => adapterStatus === "missing")).toBe(
      true,
    );
    expect(
      result.model.components.every(({ scenarios }) =>
        scenarios.every(({ propsText }) => !propsText.includes("function")),
      ),
    ).toBe(true);
  });

  it("keeps the default foundation scales deterministic when no host tokens are installed", () => {
    const model = requireExplorer();
    expect(model.foundations.colors.map(({ name }) => name)).toEqual([
      "surface",
      "canvas",
      "text",
      "muted",
      "border",
      "accent",
    ]);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.components)).toBe(true);
  });
});
