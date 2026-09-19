// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProjectAuthoringContext } from "../src/project-authoring-context.js";
import { DesenAppProduct } from "../src/product-bootstrap.js";
import { navigateDesenApp } from "../src/project-navigation.js";
import { createProjectAuthoringFixture } from "./project-authoring-fixture.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("contains visual master drafts, rejects foreign Source edits and discards without touching the live project", async () => {
  window.history.replaceState(null, "", "/projects/flow-app/surfaces/start");
  const fixture = createProjectAuthoringFixture();
  expect(fixture.addMaster().ok).toBe(true);
  await fixture.source.save();
  render(
    <StrictMode>
      <ProjectAuthoringContext.Provider value={fixture.project}>
        <DesenAppProduct
          persistencePort={fixture.options.persistencePort}
          workspaceProfile={fixture.options.profile}
        />
      </ProjectAuthoringContext.Provider>
    </StrictMode>,
  );
  fireEvent.click(await screen.findByText("My components", { exact: false, selector: "summary" }));
  const before = fixture.project.read();
  const writes = fixture.writes.length;
  fireEvent.click(screen.getByRole("button", { name: "Edit master" }));
  fireEvent.click(screen.getByRole("button", { name: "Select Text layer · label" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
    target: { value: "Draft title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply Text" }));
  expect(fixture.project.read().session).toBe(before.session);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  act(() => navigateDesenApp("/projects/flow-app/surfaces/result"));
  expect(window.location.pathname).toBe("/projects/flow-app/surfaces/start");
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByText(/Apply or discard the master draft before leaving/)).toBeTruthy();
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  for (const name of ["Save project", "Open project", "Run"]) {
    const button = screen.getByRole("button", { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(fixture.writes).toHaveLength(writes);
  fireEvent.click(screen.getByRole("button", { name: "Advanced Source" }));
  const field = screen.getByRole("textbox", { name: "Source JSON draft" }) as HTMLTextAreaElement;
  const candidate = JSON.parse(field.value) as {
    surfaces: { result: { root: { props: { gap: string } } } };
  };
  candidate.surfaces.result.root.props.gap = "lg";
  const invalidText = JSON.stringify(candidate);
  fireEvent.change(field, { target: { value: invalidText } });
  fireEvent.click(screen.getByRole("button", { name: "Validate and apply Source" }));
  expect(field.value).toBe(invalidText);
  expect(screen.getByText(/Source was not applied/)).toBeTruthy();
  expect(fixture.project.read().history).toBe(before.history);
  expect(
    (screen.getByRole("button", { name: "Apply master changes" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Discard master draft" }));
  expect(screen.queryByRole("region", { name: "Master draft" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Source JSON draft" })).toBeNull();
  expect(fixture.project.read().session).toBe(before.session);
  expect(fixture.project.read().history).toBe(before.history);
  expect(fixture.writes).toHaveLength(writes);
  act(() => navigateDesenApp("/projects/flow-app/surfaces/result"));
  expect(window.location.pathname).toBe("/projects/flow-app/surfaces/result");
  await act(async () => {
    cleanup();
    fixture.source.dispose();
    fixture.project.dispose();
    fixture.lifecycle.dispose();
  });
}, 20_000);
