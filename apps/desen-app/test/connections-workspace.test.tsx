// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConnectionsWorkspace } from "../src/connections-workspace.js";
import { createProjectAuthoringFixture } from "./project-authoring-fixture.js";

describe("Connections workspace", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("saves, leaves, and reopens an incomplete intent without changing Source", () => {
    const fixture = createProjectAuthoringFixture();
    const before = fixture.project.read().session.record.source;
    const surfaceId = Object.keys(before.surfaces)[0] ?? "";
    const view = render(
      <ConnectionsWorkspace
        controller={fixture.project}
        record={fixture.project.read().session.record}
        surfaceId={surfaceId}
        surfaceName="Home"
      />,
    );
    cleanup = () => {
      view.unmount();
      fixture.project.dispose();
      fixture.lifecycle.dispose();
    };

    fireEvent.change(screen.getByLabelText("Connection label"), {
      target: { value: "Draft submit intent" },
    });
    fireEvent.change(screen.getByLabelText("Connection candidate name"), {
      target: { value: "submit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save incomplete draft" }));

    expect(screen.getByText(/Saved in the project as inert Connections metadata/u)).toBeTruthy();
    expect(fixture.project.read().session.record.source).toEqual(before);
    expect(screen.getByRole("button", { name: /Draft submit intent/u })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Draft submit intent/u }));
    expect((screen.getByLabelText("Connection label") as HTMLInputElement).value).toBe(
      "Draft submit intent",
    );
    expect(screen.getByRole("button", { name: /Draft submit intent/u }).textContent).toContain(
      "pending",
    );
  });
});
