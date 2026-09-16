// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProjectLifecycleNavigationGuard } from "../src/project-lifecycle-navigation.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { installDesenAppNavigationGuard, navigateDesenApp } from "../src/project-navigation.js";
import { createStarterProject } from "../src/starter-project.js";

import type { ProjectWorkspaceStoragePort } from "../src/project-lifecycle.js";

let removeGuard: (() => void) | null = null;

function controller() {
  const storagePort: ProjectWorkspaceStoragePort = Object.freeze({
    openWorkspace: async () => ({ status: "missing" as const }),
    saveWorkspace: async () => ({ status: "created" as const, generation: 1 }),
  });
  const created = createProjectLifecycleController({
    initialWorkspace: createEmptyProjectWorkspace(),
    storagePort,
  });
  if (created === null) throw new TypeError("Expected lifecycle controller.");
  return created;
}

describe("project lifecycle navigation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/projects");
  });

  afterEach(() => {
    removeGuard?.();
    removeGuard = null;
    vi.restoreAllMocks();
  });

  it("blocks rejected dirty navigation and restores a confirmed draft before the route changes", () => {
    const lifecycle = controller();
    const starter = createStarterProject("workspace-one");
    expect(
      lifecycle.createProject(starter.record, "Workspace One", starter.surfaceNames),
    ).toBeNull();
    const confirmDiscard = vi.fn(() => false);
    removeGuard = installDesenAppNavigationGuard(
      createProjectLifecycleNavigationGuard(lifecycle, confirmDiscard),
    );

    navigateDesenApp("/projects/workspace-one");
    expect(confirmDiscard).toHaveBeenCalledWith("/projects/workspace-one");
    expect(window.location.pathname).toBe("/projects");
    expect(lifecycle.read().workspace.projects).toHaveLength(1);

    confirmDiscard.mockReturnValue(true);
    navigateDesenApp("/projects/workspace-one");
    expect(window.location.pathname).toBe("/projects/workspace-one");
    expect(lifecycle.read().workspace.projects).toHaveLength(0);
    expect(lifecycle.read().dirty).toBe(false);
  });

  it("refuses to navigate while a save needs reopening", async () => {
    const storagePort: ProjectWorkspaceStoragePort = Object.freeze({
      openWorkspace: async () => ({ status: "missing" as const }),
      saveWorkspace: async () => ({ status: "indeterminate" as const }),
    });
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort,
    });
    if (lifecycle === null) throw new TypeError("Expected lifecycle controller.");
    const starter = createStarterProject("workspace-one");
    expect(
      lifecycle.createProject(starter.record, "Workspace One", starter.surfaceNames),
    ).toBeNull();
    expect(await lifecycle.save()).toEqual({ status: "indeterminate" });
    removeGuard = installDesenAppNavigationGuard(
      createProjectLifecycleNavigationGuard(lifecycle, () => true),
    );

    navigateDesenApp("/projects/workspace-one");
    expect(window.location.pathname).toBe("/projects");
  });
});
