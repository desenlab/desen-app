import { describe, expect, it } from "vitest";

import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
  PROJECT_WORKSPACE_KIND,
  PROJECT_WORKSPACE_SCHEMA_VERSION,
} from "../src/project-lifecycle.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "../src/reference-flow-workspace-profile.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";

import type {
  ProjectWorkspaceSaveRequest,
  ProjectWorkspaceStoragePort,
} from "../src/project-lifecycle.js";

function copy<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function flowSource(): unknown {
  const authority = readProjectWorkspaceProfileAuthority(REFERENCE_FLOW_WORKSPACE_PROFILE);
  if (authority.status !== "read")
    throw new TypeError("Expected reference-flow profile authority.");
  return copy(authority.profile.initialDocument);
}

function project(id = "workspace-one", source: unknown = flowSource()): unknown {
  return {
    kind: "desen.editable-project",
    schemaVersion: 1,
    id,
    source,
    designSystem: { tokenSources: [], recipes: [], assets: [] },
    connectionIntents: [],
  };
}

function names(): readonly { readonly id: string; readonly name: string }[] {
  return [
    { id: "start", name: "Start" },
    { id: "result", name: "Result" },
  ];
}

function requireController(
  storagePort: ProjectWorkspaceStoragePort = memoryPort(),
): NonNullable<ReturnType<typeof createProjectLifecycleController>> {
  const controller = createProjectLifecycleController({
    initialWorkspace: createEmptyProjectWorkspace(),
    storagePort,
  });
  expect(controller).not.toBeNull();
  if (controller === null) throw new TypeError("Expected lifecycle controller.");
  return controller;
}

function memoryPort(): ProjectWorkspaceStoragePort {
  let workspace: unknown = undefined;
  let currentGeneration: number | null = null;
  return Object.freeze({
    openWorkspace: async () =>
      currentGeneration === null
        ? { status: "missing" as const }
        : { status: "opened" as const, generation: currentGeneration, workspace },
    saveWorkspace: async (request: ProjectWorkspaceSaveRequest) => {
      if (request.expectedGeneration !== currentGeneration) {
        return { status: "conflict" as const, currentGeneration };
      }
      workspace = request.workspace;
      currentGeneration = (currentGeneration ?? 0) + 1;
      return {
        status: currentGeneration === 1 ? ("created" as const) : ("updated" as const),
        generation: currentGeneration,
      };
    },
  });
}

describe("ordinary project and surface lifecycle", () => {
  it("round-trips the complete T02 envelope, labels, ordering and recoverable project deletion", async () => {
    const storagePort = memoryPort();
    const controller = requireController(storagePort);
    expect(controller.createProject(project(), "Workspace One", names())).toBeNull();
    expect(controller.renameSurface("workspace-one", "result", "Success")).toBeNull();
    expect(controller.reorderSurfaces("workspace-one", ["result", "start"])).toBeNull();
    expect(await controller.save()).toEqual({ status: "created", generation: 1 });
    const exported = controller.exportProject("workspace-one");
    expect(exported).toContain('"id":"workspace-one"');

    expect(controller.deleteProject("workspace-one")).toBeNull();
    expect(controller.read().workspace.projects).toHaveLength(0);
    expect(controller.read().workspace.deletedProjects[0]?.surfaceOrder).toEqual([
      "result",
      "start",
    ]);
    expect(controller.recoverProject("workspace-one")).toBeNull();
    expect(controller.read().workspace.projects[0]?.surfaceNames).toEqual([
      { id: "start", name: "Start" },
      { id: "result", name: "Success" },
    ]);
    expect(await controller.save()).toEqual({ status: "updated", generation: 2 });

    const reopened = requireController(storagePort);
    expect(await reopened.open()).toEqual({ status: "opened", generation: 2 });
    expect(reopened.read().workspace.projects[0]).toEqual(controller.read().workspace.projects[0]);
  });

  it("keeps the last good registry on unsupported incoming versions and interrupted saves", async () => {
    let openCount = 0;
    const storagePort: ProjectWorkspaceStoragePort = Object.freeze({
      openWorkspace: async () => {
        openCount += 1;
        return {
          status: "opened" as const,
          generation: 1,
          workspace:
            openCount === 1
              ? {
                  kind: PROJECT_WORKSPACE_KIND,
                  schemaVersion: PROJECT_WORKSPACE_SCHEMA_VERSION,
                  projects: [],
                  deletedProjects: [],
                }
              : {
                  kind: PROJECT_WORKSPACE_KIND,
                  schemaVersion: 2,
                  projects: [],
                  deletedProjects: [],
                },
        };
      },
      saveWorkspace: async () => ({ status: "indeterminate" as const }),
    });
    const controller = requireController(storagePort);
    expect(await controller.open()).toEqual({ status: "opened", generation: 1 });
    expect(controller.createProject(project(), "Workspace One", names())).toBeNull();
    expect(await controller.save()).toEqual({ status: "indeterminate" });
    expect(controller.read().workspace.projects[0]?.id).toBe("workspace-one");
    expect(await controller.save()).toEqual({ status: "failed", reason: "reopen-required" });
    expect(await controller.open()).toEqual({
      status: "failed",
      reason: "unsupported-workspace-version",
    });
    expect(controller.read().workspace.projects[0]?.id).toBe("workspace-one");
  });

  it("requires coherent entry, frame and surface identities when applying next Source envelopes", () => {
    const controller = requireController();
    const original = project();
    expect(controller.createProject(original, "Workspace One", names())).toBeNull();

    const selected = copy(original) as { source: { entry: string } };
    selected.source.entry = "result";
    expect(controller.selectEntrySurface("workspace-one", selected, "result")).toBeNull();

    const frameChanged = copy(selected) as unknown as {
      source: { entry: string; authoring: { canvas: { result: { width: number } } } };
    };
    frameChanged.source.authoring.canvas.result.width = 640;
    expect(controller.updateSurfaceFrame("workspace-one", frameChanged, "result")).toBeNull();

    const incoherent = copy(frameChanged) as unknown as { source: { entry: string } };
    incoherent.source.entry = "missing";
    expect(controller.selectEntrySurface("workspace-one", incoherent, "missing")).toEqual({
      status: "failed",
      reason: "invalid-surface-registry",
    });
    expect(controller.read().workspace.projects[0]?.record.source.entry).toBe("result");
  });

  it("adds and deletes one complete Source surface atomically without permitting entry deletion", () => {
    const controller = requireController();
    const original = project();
    expect(controller.createProject(original, "Workspace One", names())).toBeNull();
    const initialOrder = controller.read().workspace.projects[0]?.surfaceOrder ?? [];
    expect(initialOrder).toEqual(["result", "start"]);

    const withReview = copy(original) as unknown as {
      source: {
        surfaces: Record<string, unknown>;
        authoring: { canvas: Record<string, unknown> };
      };
    };
    withReview.source.surfaces.review = {
      id: "review",
      state: {},
      resources: {},
      root: {
        id: "review.layout",
        use: "com.example.ui/Stack",
        props: { direction: "vertical", gap: "md", maxWidth: 420 },
      },
    };
    withReview.source.authoring.canvas.review = { x: 1040, y: 0, width: 420, height: 720 };
    expect(
      controller.addSurface("workspace-one", withReview, { id: "review", name: "Review" }),
    ).toBeNull();
    expect(controller.read().workspace.projects[0]?.surfaceOrder).toEqual([
      ...initialOrder,
      "review",
    ]);

    const withoutResult = copy(withReview) as unknown as {
      source: { surfaces: Record<string, unknown>; authoring: { canvas: Record<string, unknown> } };
    };
    delete withoutResult.source.surfaces.result;
    delete withoutResult.source.authoring.canvas.result;
    expect(controller.deleteSurface("workspace-one", withoutResult, "result")).toBeNull();
    expect(controller.read().workspace.projects[0]?.surfaceOrder).toEqual(["start", "review"]);
    expect(controller.deleteSurface("workspace-one", withoutResult, "start")).toEqual({
      status: "failed",
      reason: "invalid-surface-registry",
    });
  });

  it("does not save over a stale registry generation", async () => {
    const storagePort: ProjectWorkspaceStoragePort = Object.freeze({
      openWorkspace: async () => ({
        status: "opened" as const,
        generation: 3,
        workspace: createEmptyProjectWorkspace(),
      }),
      saveWorkspace: async () => ({ status: "conflict" as const, currentGeneration: 4 }),
    });
    const controller = requireController(storagePort);
    expect(await controller.open()).toEqual({ status: "opened", generation: 3 });
    expect(controller.createProject(project(), "Workspace One", names())).toBeNull();
    expect(await controller.save()).toEqual({ status: "conflict", currentGeneration: 4 });
    expect(controller.read().dirty).toBe(true);
    expect(controller.read().workspace.projects[0]?.id).toBe("workspace-one");
  });
});
