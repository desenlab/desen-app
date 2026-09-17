import { describe, expect, it } from "vitest";

import {
  AUTHORING_STYLE_PREVIEW_VIEWPORTS,
  createAuthoringStylePreviewHostPorts,
} from "../src/authoring-style-preview-runtime.js";

describe("createAuthoringStylePreviewHostPorts", () => {
  it("exposes only the selected App-owned responsive viewport and resolved project tokens", () => {
    const ports = createAuthoringStylePreviewHostPorts(
      { invoke: () => ({ status: "denied" }) },
      { navigate: () => ({ status: "denied" }) },
      undefined,
      ({ token }) =>
        token === "color.brand"
          ? Object.freeze({ status: "resolved" as const, value: "#123456" })
          : Object.freeze({ status: "missing" as const }),
      "mobile",
    );

    expect(ports.environment.getSnapshot()).toEqual({
      platform: "web",
      viewport: AUTHORING_STYLE_PREVIEW_VIEWPORTS.mobile,
    });
    expect(ports.tokens.resolve({ context: {} as never, token: "color.brand" })).toEqual({
      status: "resolved",
      value: "#123456",
    });
    expect(ports.tokens.resolve({ context: {} as never, token: "unknown" })).toEqual({
      status: "missing",
    });
  });

  it("refuses unknown viewport identifiers instead of accepting free-form environment data", () => {
    expect(() =>
      createAuthoringStylePreviewHostPorts(
        { invoke: () => ({ status: "denied" }) },
        { navigate: () => ({ status: "denied" }) },
        undefined,
        () => ({ status: "missing" }),
        "watch" as never,
      ),
    ).toThrow("known responsive viewport");
  });

  it("keeps a resizable base canvas and its Runtime viewport in lockstep", () => {
    const ports = createAuthoringStylePreviewHostPorts(
      { invoke: () => ({ status: "denied" }) },
      { navigate: () => ({ status: "denied" }) },
      undefined,
      () => ({ status: "missing" }),
      "desktop",
      { width: 390, height: 844 },
    );

    expect(ports.environment.getSnapshot()).toEqual({
      platform: "web",
      viewport: { height: 844, orientation: "portrait", width: 390 },
    });
  });

  it("rejects free-form or non-base preview-frame authority", () => {
    expect(() =>
      createAuthoringStylePreviewHostPorts(
        { invoke: () => ({ status: "denied" }) },
        { navigate: () => ({ status: "denied" }) },
        undefined,
        () => ({ status: "missing" }),
        "desktop",
        { width: 0, height: 844 },
      ),
    ).toThrow("bounded positive integer");
    expect(() =>
      createAuthoringStylePreviewHostPorts(
        { invoke: () => ({ status: "denied" }) },
        { navigate: () => ({ status: "denied" }) },
        undefined,
        () => ({ status: "missing" }),
        "mobile",
        { width: 390, height: 844 },
      ),
    ).toThrow("Only the base desktop");
  });
});
