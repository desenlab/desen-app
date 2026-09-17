import { describe, expect, it } from "vitest";

import {
  AUTHORING_CANVAS_MAX_ZOOM,
  AUTHORING_CANVAS_MIN_ZOOM,
  createAuthoringCanvasPreviewFrame,
  createAuthoringCanvasViewport,
  panAuthoringCanvasViewport,
  projectAuthoringDirectManipulationSelection,
  resetAuthoringCanvasViewport,
  resizeAuthoringCanvasPreviewFrame,
  toggleAuthoringDirectManipulationSelection,
  zoomAuthoringCanvasViewport,
} from "../src/authoring-direct-manipulation.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";
import { REFERENCE_AUTHORING_MODEL } from "../src/reference-authoring-profile.js";

const ROUTE = Object.freeze({ projectId: "account-app", surfaceId: "sign-in" });

function emailSelection() {
  return createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: "sign-in.email",
    capabilityId: "com.example.ui/TextField",
    displayName: "Text field",
    conditional: false,
  });
}

function passwordSelection() {
  return createAuthoringComponentSelection({
    projectId: ROUTE.projectId,
    surfaceId: ROUTE.surfaceId,
    sourceNodeId: "sign-in.password",
    capabilityId: "com.example.ui/TextField",
    displayName: "Text field",
    conditional: false,
  });
}

describe("Desen App direct-manipulation authority", () => {
  it("keeps viewport state bounded, frozen, and separate from authored Source", () => {
    const initial = createAuthoringCanvasViewport();
    const panned = panAuthoringCanvasViewport(initial, { x: 48, y: -32 });
    const zoomed = zoomAuthoringCanvasViewport(panned, "in");

    expect(initial).toEqual({ panX: 0, panY: 0, zoom: 1 });
    expect(panned).toEqual({ panX: 48, panY: -32, zoom: 1 });
    expect(zoomed).toEqual({ panX: 48, panY: -32, zoom: 1.25 });
    expect(Object.isFrozen(zoomed)).toBe(true);
    expect(resetAuthoringCanvasViewport()).toEqual(initial);
    expect(() => createAuthoringCanvasViewport({ zoom: AUTHORING_CANVAS_MIN_ZOOM - 0.01 })).toThrow(
      "Canvas viewport",
    );
    expect(() => createAuthoringCanvasViewport({ zoom: AUTHORING_CANVAS_MAX_ZOOM + 0.01 })).toThrow(
      "Canvas viewport",
    );
  });

  it("resizes only a bounded inert preview frame and never Source canvas metadata", () => {
    const declared = createAuthoringCanvasPreviewFrame({ width: 420, height: 720 });
    const resized = resizeAuthoringCanvasPreviewFrame(declared, { width: 80, height: -80 });

    expect(declared).toEqual({ width: 420, height: 720 });
    expect(resized).toEqual({ width: 500, height: 640 });
    expect(Object.isFrozen(resized)).toBe(true);
    expect(() => createAuthoringCanvasPreviewFrame({ width: 0, height: 720 })).toThrow(
      "Canvas preview frame",
    );
    expect(() => resizeAuthoringCanvasPreviewFrame(resized, { width: 0.5, height: 0 })).toThrow(
      "Canvas preview resize",
    );
  });

  it("projects a stable ordered multi-selection from exact current Source identities", () => {
    const selected = toggleAuthoringDirectManipulationSelection([], passwordSelection(), false);
    const extended = toggleAuthoringDirectManipulationSelection(selected, emailSelection(), true);
    const projection = projectAuthoringDirectManipulationSelection(
      extended,
      ROUTE,
      REFERENCE_AUTHORING_MODEL,
    );

    expect(projection.status).toBe("ready");
    if (projection.status !== "ready") throw new Error("Expected admitted multi-selection.");
    expect(projection.selection.primary.sourceNodeId).toBe("sign-in.email");
    expect(projection.selection.sourceNodeIds).toEqual(["sign-in.email", "sign-in.password"]);
    expect(Object.isFrozen(projection.selection.selections)).toBe(true);
    expect(Object.isFrozen(projection.selection.sourceNodeIds)).toBe(true);
  });

  it("rejects stale, duplicate, and cross-route selected layers as one atomic boundary", () => {
    const email = emailSelection();
    const forged = createAuthoringComponentSelection({
      ...email,
      sourceNodeId: "sign-in.missing",
    });

    expect(
      projectAuthoringDirectManipulationSelection([email, email], ROUTE, REFERENCE_AUTHORING_MODEL),
    ).toEqual({ status: "rejected" });
    expect(
      projectAuthoringDirectManipulationSelection([forged], ROUTE, REFERENCE_AUTHORING_MODEL),
    ).toEqual({ status: "rejected" });
    expect(
      projectAuthoringDirectManipulationSelection(
        [email],
        { projectId: "other", surfaceId: "sign-in" },
        REFERENCE_AUTHORING_MODEL,
      ),
    ).toEqual({ status: "rejected" });
  });
});
