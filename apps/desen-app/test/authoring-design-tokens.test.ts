import { describe, expect, it } from "vitest";

import { resolveAuthoringDesignTokens } from "../src/authoring-design-tokens.js";
import { createStarterProject } from "../src/starter-project.js";

describe("resolveAuthoringDesignTokens", () => {
  it("uses the persisted DESEN Neutral T02 token sources for both authoring and runtime", () => {
    const project = createStarterProject("token-resolution").record;
    const resolution = resolveAuthoringDesignTokens(project);

    expect(resolution.status).toBe("resolved");
    if (resolution.status !== "resolved") throw new Error("Expected starter token resolution.");

    const colors = resolution.styleTokens.filter((token) => token.type === "color");
    const dimensions = resolution.styleTokens.filter((token) => token.type === "dimension");
    expect(colors.length).toBeGreaterThan(0);
    expect(dimensions.length).toBeGreaterThan(0);

    const selected = resolution.styleTokens[0];
    expect(selected).toBeDefined();
    if (selected === undefined) throw new Error("Expected a resolved starter token.");
    expect(resolution.resolveRuntimeToken(selected.path)).toEqual({
      status: "resolved",
      value: selected.resolvedValue,
    });
    expect(resolution.resolveRuntimeToken("missing.token")).toEqual({ status: "missing" });
  });

  it("fails closed when a persisted project has no admissible token selection", () => {
    const starter = createStarterProject("token-rejection").record;
    const resolution = resolveAuthoringDesignTokens({
      ...starter,
      designSystem: { ...starter.designSystem, tokenSources: [] },
    });

    expect(resolution).toEqual({ status: "rejected" });
  });

  it("shares an immutable deep canonical clone with the Runtime token port", () => {
    const project = createStarterProject("token-immutability").record;
    const resolution = resolveAuthoringDesignTokens(project);

    expect(resolution.status).toBe("resolved");
    if (resolution.status !== "resolved") throw new Error("Expected starter token resolution.");
    const color = resolution.styleTokens.find(
      (token) =>
        token.type === "color" &&
        typeof token.resolvedValue === "object" &&
        token.resolvedValue !== null &&
        !Array.isArray(token.resolvedValue),
    );
    expect(color).toBeDefined();
    if (color === undefined) throw new Error("Expected a structured sRGB starter color.");

    const value = color.resolvedValue as unknown as {
      readonly components: readonly number[];
    };
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.components)).toBe(true);
    expect(() => {
      (value.components as number[])[0] = 0.5;
    }).toThrow();
    expect(resolution.resolveRuntimeToken(color.path)).toEqual({
      status: "resolved",
      value: color.resolvedValue,
    });
  });
});
