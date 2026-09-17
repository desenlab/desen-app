// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CanvasManipulationControls } from "../src/canvas-manipulation-controls.js";
import { createAuthoringCanvasViewport } from "../src/authoring-direct-manipulation.js";

describe("Canvas manipulation controls", () => {
  it("keeps viewport operations in App-owned accessible chrome", () => {
    const pans: { x: number; y: number }[] = [];
    const resizes: { width: number; height: number }[] = [];
    const zooms: string[] = [];
    const { container } = render(
      <CanvasManipulationControls
        disabled={false}
        frame={{ width: 420, height: 720 }}
        onPan={(delta) => pans.push(delta)}
        onReset={() => zooms.push("reset")}
        onResize={(delta) => resizes.push(delta)}
        onZoom={(direction) => zooms.push(direction)}
        selectedSourceNodeIds={["sign-in.email", "sign-in.password"]}
        viewport={createAuthoringCanvasViewport({ panX: 0, panY: 0, zoom: 1 })}
      />,
    );

    expect(screen.getByText("2 layers selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in canvas" }));
    fireEvent.click(screen.getByRole("button", { name: "Pan canvas left" }));
    fireEvent.click(screen.getByRole("button", { name: "Make preview frame wider" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset canvas view" }));
    expect(zooms).toEqual(["in", "reset"]);
    expect(pans).toEqual([{ x: -48, y: 0 }]);
    expect(resizes).toEqual([{ width: 80, height: 0 }]);
    expect(container.querySelector("[data-canvas-manipulation='true']")).toBeTruthy();
  });
});
