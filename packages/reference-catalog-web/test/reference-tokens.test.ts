// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import {
  REFERENCE_TOKEN_DOCUMENT,
  REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
  REFERENCE_WEB_TOKEN_CSS_REFERENCES,
  REFERENCE_WEB_TOKEN_PROVIDER,
  REFERENCE_WEB_TOKEN_VALUES,
  resolveReferenceWebToken,
} from "../src/tokens/index.js";

const EXPECTED_CSS_PROPERTIES = Object.freeze([
  "--desen-color-action-primary",
  "--desen-color-border",
  "--desen-color-border-strong",
  "--desen-color-critical",
  "--desen-color-critical-surface",
  "--desen-color-critical-text",
  "--desen-color-info",
  "--desen-color-info-surface",
  "--desen-color-info-text",
  "--desen-color-on-action",
  "--desen-color-on-critical",
  "--desen-color-success",
  "--desen-color-success-surface",
  "--desen-color-success-text",
  "--desen-color-surface",
  "--desen-color-surface-disabled",
  "--desen-color-text",
  "--desen-color-warning",
  "--desen-color-warning-surface",
  "--desen-color-warning-text",
  "--desen-radius-control",
  "--desen-space-lg",
  "--desen-space-md",
  "--desen-space-sm",
  "--desen-space-xl",
  "--desen-space-xs",
]);

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("reference DTCG tokens and Web provider", () => {
  it("keeps the complete nested DTCG document recursively immutable", () => {
    expect(REFERENCE_TOKEN_DOCUMENT.color.$type).toBe("color");
    expect(REFERENCE_TOKEN_DOCUMENT.radius.$type).toBe("dimension");
    expect(REFERENCE_TOKEN_DOCUMENT.space.$type).toBe("dimension");
    expect(REFERENCE_TOKEN_DOCUMENT.color.info.base.$value).toBe("{color.action.primary}");
    expect(REFERENCE_TOKEN_DOCUMENT.color.content.onCritical.$value).toBe(
      "{color.content.onAction}",
    );
    expect(REFERENCE_TOKEN_DOCUMENT.color.action.primary.$value).toEqual({
      colorSpace: "srgb",
      components: [29 / 255, 78 / 255, 216 / 255],
      alpha: 1,
      hex: "#1d4ed8",
    });
    expect(REFERENCE_TOKEN_DOCUMENT.space.md.$value).toEqual({ value: 1, unit: "rem" });
    expectDeeplyFrozen(REFERENCE_TOKEN_DOCUMENT);
  });

  it("derives exactly the 26 component CSS custom properties without a wrapper", () => {
    expect(Object.keys(REFERENCE_WEB_TOKEN_CSS_PROPERTIES).sort()).toEqual(EXPECTED_CSS_PROPERTIES);
    expect(REFERENCE_WEB_TOKEN_PROVIDER.tokenPaths).toHaveLength(26);
    expect(Object.keys(REFERENCE_WEB_TOKEN_VALUES)).toHaveLength(26);
    expect(Object.keys(REFERENCE_WEB_TOKEN_CSS_REFERENCES)).toHaveLength(26);
    expect(Object.keys(REFERENCE_WEB_TOKEN_PROVIDER).sort()).toEqual([
      "cssProperties",
      "cssReferences",
      "resolve",
      "tokenPaths",
      "values",
    ]);
    expectDeeplyFrozen(REFERENCE_WEB_TOKEN_PROVIDER);
  });

  it("applies the exported custom-property map directly to an existing React host root", () => {
    const result = render(
      createElement("div", {
        "data-testid": "host-root",
        style: REFERENCE_WEB_TOKEN_CSS_PROPERTIES,
      }),
    );
    const hostRoot = result.getByTestId("host-root");

    expect(hostRoot.style.getPropertyValue("--desen-color-action-primary")).toBe("#1d4ed8");
    expect(hostRoot.style.getPropertyValue("--desen-space-md")).toBe("1rem");
    expect(hostRoot.childElementCount).toBe(0);
  });

  it("resolves direct colors, dimensions, and same-type aliases deterministically", () => {
    expect(resolveReferenceWebToken("color.action.primary")).toEqual({
      ok: true,
      token: "color.action.primary",
      value: "#1d4ed8",
      cssProperty: "--desen-color-action-primary",
      cssReference: "var(--desen-color-action-primary, #1d4ed8)",
    });
    expect(resolveReferenceWebToken("space.md")).toEqual({
      ok: true,
      token: "space.md",
      value: "1rem",
      cssProperty: "--desen-space-md",
      cssReference: "var(--desen-space-md, 1rem)",
    });
    expect(REFERENCE_WEB_TOKEN_VALUES["color.info.base"]).toBe(
      REFERENCE_WEB_TOKEN_VALUES["color.action.primary"],
    );
    expect(REFERENCE_WEB_TOKEN_VALUES["color.content.onCritical"]).toBe(
      REFERENCE_WEB_TOKEN_VALUES["color.content.onAction"],
    );
    expect(REFERENCE_WEB_TOKEN_CSS_PROPERTIES["--desen-radius-control"]).toBe("0.375rem");
  });

  it("returns an explicit immutable failure for every unknown spelling", () => {
    for (const token of [
      "",
      "color",
      "color.info",
      "color.info.unknown",
      "Color.info.base",
      "__proto__",
      "constructor",
      "{color.action.primary}",
    ]) {
      const result = resolveReferenceWebToken(token);
      expect(result).toEqual({ ok: false, code: "UNKNOWN_TOKEN", token });
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(() => resolveReferenceWebToken(42 as unknown as string)).toThrowError(
      new TypeError("Reference Web token names must be strings"),
    );
  });

  it("exposes detached frozen maps that reject runtime mutation", () => {
    expect(Object.isFrozen(REFERENCE_WEB_TOKEN_VALUES)).toBe(true);
    expect(Object.isFrozen(REFERENCE_WEB_TOKEN_CSS_PROPERTIES)).toBe(true);
    expect(Object.isFrozen(REFERENCE_WEB_TOKEN_CSS_REFERENCES)).toBe(true);
    expect(Reflect.set(REFERENCE_WEB_TOKEN_VALUES, "space.md", "999rem")).toBe(false);
    expect(Reflect.set(REFERENCE_WEB_TOKEN_CSS_PROPERTIES, "--desen-space-md", "999rem")).toBe(
      false,
    );
    expect(REFERENCE_WEB_TOKEN_VALUES["space.md"]).toBe("1rem");
    expect(REFERENCE_WEB_TOKEN_CSS_PROPERTIES["--desen-space-md"]).toBe("1rem");
  });
});
