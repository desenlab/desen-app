// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { admitEditableProjectRecord } from "@desen/design-system-core";
import { createStarterNodeTemplate, STARTER_TEXT_CAPABILITY_ID } from "@desen/starter-catalog-web";
import { createStarterProject } from "../src/starter-project.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE as profile } from "../src/starter-neutral-workspace-profile.js";
import { StarterWorkspaceProduct } from "../src/starter-workspace-product.js";
import { createProjectAuthoringController } from "../src/project-authoring-controller.js";
import { createProjectWorkspaceAuthoringAdmission } from "../src/project-authoring-session.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { createProjectWorkspaceAuthoringPersistencePort } from "../src/project-workspace-authoring-persistence.js";
import { createProjectAuthoringFixture } from "./project-authoring-fixture.js";
import { ProjectAuthoringContext } from "../src/project-authoring-context.js";
import { DesenAppProduct } from "../src/product-bootstrap.js";
import { navigateDesenApp } from "../src/project-navigation.js";

import type {
  ProjectWorkspaceRecord,
  ProjectWorkspaceSaveRequest,
} from "../src/project-lifecycle.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("preserves rejected managed Source drafts and carries project history across surface remounts", async () => {
  window.history.replaceState(null, "", "/projects/flow-app/surfaces/start");
  const fixture = createProjectAuthoringFixture();
  expect(fixture.addMaster().ok).toBe(true);
  for (const surfaceId of ["start", "result"]) {
    const root = fixture.project.read().session.document.surfaces[surfaceId]?.root;
    if (root === undefined) throw new Error("Missing surface.");
    expect(
      fixture.project.applyRecipe({
        type: "instance.insert",
        expectedProjectDigest: fixture.project.read().session.digest,
        instanceId: `instance.${surfaceId}`,
        masterId: "title",
        destination: { surfaceId, parentId: root.id, slot: "default", index: 0 },
      }).ok,
    ).toBe(true);
  }
  await fixture.source.save();
  render(
    <ProjectAuthoringContext.Provider value={fixture.project}>
      <DesenAppProduct
        persistencePort={fixture.options.persistencePort}
        workspaceProfile={fixture.options.profile}
      />
    </ProjectAuthoringContext.Provider>,
  );
  await screen.findByRole("button", { name: "Advanced Source" });
  const before = fixture.project.read();
  fireEvent.click(screen.getByRole("button", { name: "Advanced Source" }));
  const invalid = JSON.parse(JSON.stringify(before.session.document)) as {
    surfaces: { start: { root: { slots: { default: { on?: object }[] } } } };
  };
  const child = invalid.surfaces.start.root.slots.default[0];
  if (child === undefined) throw new Error("Missing child.");
  child.on = {};
  const text = JSON.stringify(invalid);
  fireEvent.change(screen.getByRole("textbox", { name: "Source JSON draft" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Validate and apply Source" }));
  expect(
    (screen.getByRole("textbox", { name: "Source JSON draft" }) as HTMLTextAreaElement).value,
  ).toBe(text);
  expect(fixture.project.read().session).toBe(before.session);
  expect(fixture.project.read().history).toBe(before.history);
  expect(screen.getByText(/Source was not applied/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Discard Source draft" }));
  const first = before.session.record.designSystem.recipeGraph.instances[0];
  if (first === undefined) throw new Error("Missing instance.");
  fireEvent.click(screen.getByRole("button", { name: `Select Text layer · ${first.rootId}` }));
  fireEvent.click(screen.getByText("My components", { exact: false, selector: "summary" }));
  fireEvent.click(screen.getByRole("button", { name: "Detach instance" }));
  const detached = fixture.project.read().session.record;
  expect(detached.source).toEqual(before.session.document);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  act(() => navigateDesenApp("/projects/flow-app/surfaces/result"));
  expect(window.location.pathname).toBe("/projects/flow-app/surfaces/result");
  expect(confirm).not.toHaveBeenCalled();
  expect(fixture.project.read().session.record).toEqual(detached);
  fireEvent.click(screen.getByRole("button", { name: "Undo last authoring edit" }));
  expect(fixture.project.read().session.record).toEqual(before.session.record);
  expect(fixture.project.read().dirty).toBe(false);
  await act(async () => {
    cleanup();
    fixture.source.dispose();
    fixture.project.dispose();
    fixture.lifecycle.dispose();
  });
}, 15_000);

// This full real-Catalog UI journey includes draft/history and repeated persistence admission.
// Hosted execution reached 225.9s; retain all steps and bound this integration at five minutes.
it("authors linked components in normal DESEN Neutral, retaining aggregate history and metadata-only saves", async () => {
  window.history.replaceState(null, "", "/projects/desen-neutral/surfaces/home");
  const starter = createStarterProject("desen-neutral");
  const home = starter.record.source.surfaces.home;
  if (home === undefined) throw new Error("Missing home.");
  const title = createStarterNodeTemplate({
    capabilityId: STARTER_TEXT_CAPABILITY_ID,
    idPrefix: "title",
  });
  const admission = admitEditableProjectRecord({
    ...starter.record,
    source: {
      ...starter.record.source,
      surfaces: { home: { ...home, root: { ...home.root, slots: { default: [title] } } } },
    },
  });
  if (!admission.ok) throw new Error("Invalid fixture.");
  let stored: ProjectWorkspaceRecord | undefined;
  let generation = 0;
  const writes: ProjectWorkspaceSaveRequest[] = [];
  const lifecycle = createProjectLifecycleController({
    initialWorkspace: createEmptyProjectWorkspace(),
    admitWorkspace: createProjectWorkspaceAuthoringAdmission([profile]),
    storagePort: {
      openWorkspace: async () =>
        stored === undefined
          ? { status: "missing" }
          : { status: "opened", generation, workspace: stored },
      saveWorkspace: async (request) => {
        writes.push(request);
        stored = request.workspace;
        generation += 1;
        return generation === 1
          ? { status: "created", generation: 1 }
          : { status: "updated", generation };
      },
    },
  });
  if (lifecycle === null) throw new Error("Missing lifecycle.");
  expect(
    lifecycle.createProject(admission.record, "DESEN Neutral", starter.surfaceNames),
  ).toBeNull();
  await lifecycle.save();
  const project = createProjectAuthoringController({
    profile,
    lifecycle,
    initialProject: admission.record,
  });
  if (project === null) throw new Error("Missing project controller.");
  const bridge = createProjectWorkspaceAuthoringPersistencePort({
    lifecycle,
    initialProject: admission.record,
    projectName: "DESEN Neutral",
    sourceKey: "desen-neutral-source",
    surfaceNames: starter.surfaceNames,
    authoringController: project,
  });
  if (!bridge.ok) throw new Error("Missing bridge.");
  render(
    <StrictMode>
      <StarterWorkspaceProduct
        authoringController={project}
        lifecycle={lifecycle}
        initialProject={admission.record}
        persistencePort={bridge.persistencePort}
      />
    </StrictMode>,
  );
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: `Select Text layer · ${title.id}` },
      { timeout: 20_000 },
    ),
  );
  fireEvent.click(screen.getByText("My components", { exact: false, selector: "summary" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Component name" }), {
    target: { value: "Heading" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create master from selection" }));
  expect(project.read().session.record.designSystem.recipeGraph.definitions).toHaveLength(1);
  expect(project.read().session.record.designSystem.recipeGraph.instances).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Insert linked instance" }));
  expect(project.read().session.record.designSystem.recipeGraph.instances).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Insert linked instance" }));
  expect(project.read().session.record.designSystem.recipeGraph.instances).toHaveLength(3);
  fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
    target: { value: "My local title" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply Text" }));
  expect(
    project.read().session.record.designSystem.recipeGraph.instances[0]?.overrides,
  ).toHaveLength(1);
  expect(screen.getByRole("button", { name: /^Reset override text ·/u })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^Reset override text ·/u }));
  expect(
    project.read().session.record.designSystem.recipeGraph.instances[0]?.overrides,
  ).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  await waitFor(() => expect(project.read().dirty).toBe(false), { timeout: 20_000 });
  const linked = project.read().session.record;
  fireEvent.click(screen.getByRole("button", { name: "Detach instance" }));
  const detached = project.read().session.record;
  expect(detached.source).toEqual(linked.source);
  expect(detached.designSystem.recipeGraph.instances).toHaveLength(2);
  expect((screen.getByRole("button", { name: "Save project" }) as HTMLButtonElement).disabled).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Undo last authoring edit" }));
  expect(project.read().session.record).toEqual(linked);
  expect((screen.getByRole("button", { name: "Save project" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Redo authoring edit" }));
  expect(project.read().session.record).toEqual(detached);
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  await waitFor(() => expect(project.read().dirty).toBe(false), { timeout: 20_000 });
  expect(writes.at(-1)?.workspace.projects[0]?.record).toEqual(detached);
  fireEvent.click(screen.getByRole("button", { name: "Open project" }));
  await screen.findByRole(
    "button",
    { name: `Select Text layer · ${title.id}` },
    { timeout: 20_000 },
  );
  expect(project.read().session.record).toEqual(detached);
  expect(project.read().history.past).toHaveLength(0);
  const local = detached.designSystem.recipeGraph.instances[0];
  if (local === undefined) throw new Error("Missing linked instance.");
  fireEvent.click(screen.getByRole("button", { name: `Select Text layer · ${local.rootId}` }));
  fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
    target: { value: "Local stays" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply Text" }));
  const beforeMaster = project.read();
  const detachedNode = beforeMaster.session.document.surfaces.home?.root.slots?.default?.find(
    ({ id }) => id === title.id,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit master" }));
  expect(screen.getByRole("region", { name: "Master draft" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Save project" }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect((screen.getByRole("button", { name: "Run" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: `Select Text layer · ${title.id}` }));
  fireEvent.change(screen.getByRole("textbox", { name: "Text" }), {
    target: { value: "Master updated visually" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply Text" }));
  expect(project.read().session).toBe(beforeMaster.session);
  expect(project.read().history).toBe(beforeMaster.history);
  fireEvent.click(screen.getByRole("button", { name: "Undo last authoring edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Redo authoring edit" }));
  expect(project.read().history).toBe(beforeMaster.history);
  fireEvent.click(screen.getByRole("button", { name: "Apply master changes" }));
  expect(screen.queryByRole("region", { name: "Master draft" })).toBeNull();
  const applied = project.read();
  expect(applied.history.past.length).toBe(beforeMaster.history.past.length + 1);
  const nodes = applied.session.document.surfaces.home?.root.slots?.default;
  expect(nodes?.find(({ id }) => id === title.id)).toEqual(detachedNode);
  for (const instance of beforeMaster.session.record.designSystem.recipeGraph.instances) {
    expect(nodes?.find(({ id }) => id === instance.rootId)?.props?.text).toBe(
      instance.id === local.id ? "Local stays" : "Master updated visually",
    );
    expect(
      applied.session.record.designSystem.recipeGraph.instances.find(({ id }) => id === instance.id)
        ?.mapping,
    ).toEqual(instance.mapping);
  }
  fireEvent.click(screen.getByRole("button", { name: "Undo last authoring edit" }));
  expect(project.read().session.record).toEqual(beforeMaster.session.record);
  fireEvent.click(screen.getByRole("button", { name: "Redo authoring edit" }));
  expect(project.read().session.record).toEqual(applied.session.record);
  fireEvent.click(screen.getByRole("button", { name: "Save project" }));
  await waitFor(() => expect(project.read().dirty).toBe(false), { timeout: 20_000 });
  fireEvent.click(screen.getByRole("button", { name: "Open project" }));
  await waitFor(() => expect(project.read().history.past).toHaveLength(0), { timeout: 20_000 });
  expect(project.read().session.record).toEqual(applied.session.record);
  expect(writes.at(-1)?.workspace.projects[0]?.record).toEqual(applied.session.record);
  await act(async () => {
    cleanup();
    project.dispose();
    lifecycle.dispose();
  });
}, 300_000);
