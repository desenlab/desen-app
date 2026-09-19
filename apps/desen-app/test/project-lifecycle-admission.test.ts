import { describe, expect, it, vi } from "vitest";

import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { createStarterProject } from "../src/starter-project.js";

import type {
  ProjectLifecycleController,
  ProjectWorkspaceOpenResult,
  ProjectWorkspaceRecord,
  ProjectWorkspaceSaveResult,
} from "../src/project-lifecycle.js";

function workspace(): ProjectWorkspaceRecord {
  const starter = createStarterProject("admission-test");
  return Object.freeze({
    ...createEmptyProjectWorkspace(),
    projects: [
      {
        id: starter.record.id,
        name: "Project",
        record: starter.record,
        surfaceOrder: ["home"],
        surfaceNames: starter.surfaceNames,
      },
    ],
  });
}

describe("project lifecycle pre-replacement admission", () => {
  it.each([
    { status: "created", generation: 1 },
    { status: "updated", generation: 3 },
    { status: "updated", generation: 8 },
    { status: "unchanged", generation: 4 },
    { status: "updated", generation: Number.NaN },
    { status: "unrecognized" },
  ])("does not establish a baseline from an incoherent save receipt %j", async (receipt) => {
    const controller = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: {
        openWorkspace: async () => ({ status: "opened", generation: 3, workspace: workspace() }),
        saveWorkspace: async () => receipt as ProjectWorkspaceSaveResult,
      },
    });
    if (controller === null) throw new Error("Missing controller.");
    await controller.open();
    controller.renameProject("admission-test", "Changed");
    const before = controller.read();
    expect(await controller.save()).toEqual({ status: "indeterminate" });
    expect(controller.read().savedWorkspace).toBe(before.savedWorkspace);
    expect(controller.read().workspace).toBe(before.workspace);
    expect(controller.read().generation).toBe(3);
    expect(controller.read().dirty).toBe(true);
    expect(controller.discardChanges()).toEqual({ status: "failed", reason: "reopen-required" });
    expect(await controller.save()).toEqual({ status: "failed", reason: "reopen-required" });
  });

  it("preserves an uncertain write and requires reopen when the host throws after dispatch", async () => {
    const controller = createProjectLifecycleController({
      initialWorkspace: workspace(),
      storagePort: {
        openWorkspace: async () => ({ status: "missing" }),
        saveWorkspace: async () => {
          throw new Error("A commit may have reached storage.");
        },
      },
    });
    if (controller === null) throw new Error("Missing controller.");
    const before = controller.read();
    expect(await controller.save()).toEqual({ status: "indeterminate" });
    expect(controller.read().workspace).toBe(before.workspace);
    expect(controller.read().savedWorkspace).toBeNull();
    expect(controller.read().reopenRequired).toBe(true);
  });
  it("checks the complete migrated workspace, including recoverable members, before open replacement", async () => {
    const initial = workspace();
    const removed = initial.projects[0];
    if (removed === undefined) throw new Error("Missing project.");
    const incoming = { ...initial, projects: [], deletedProjects: [removed] };
    const seen: ProjectWorkspaceRecord[] = [];
    let controller: ProjectLifecycleController | null = null;
    controller = createProjectLifecycleController({
      initialWorkspace: initial,
      storagePort: {
        openWorkspace: async () => ({ status: "opened", generation: 7, workspace: incoming }),
        saveWorkspace: async () => ({ status: "failed" }),
      },
      admitWorkspace: (candidate) => {
        seen.push(candidate);
        if (controller !== null) {
          expect(controller.read().workspace).toEqual(initial);
          expect(controller.read().generation).toBeNull();
          expect(controller.read().pending).toBe("opening");
          expect(Object.isFrozen(candidate.deletedProjects)).toBe(true);
        }
        return candidate.deletedProjects.length === 0;
      },
    });
    if (controller === null) throw new Error("Missing controller.");
    const before = controller.read();
    expect(await controller.open()).toEqual({ status: "failed", reason: "invalid-workspace" });
    expect(controller.read().workspace).toBe(before.workspace);
    expect(controller.read().savedWorkspace).toBe(before.savedWorkspace);
    expect(controller.read().generation).toBe(before.generation);
    expect(seen).toHaveLength(2);
  });

  it.each([false, undefined, 1, Promise.resolve(true)])(
    "rejects a non-true preflight result without publishing a candidate (%s)",
    async (result) => {
      let reject = false;
      const controller = createProjectLifecycleController({
        initialWorkspace: workspace(),
        storagePort: {
          openWorkspace: async () => ({ status: "opened", generation: 2, workspace: workspace() }),
          saveWorkspace: async () => ({ status: "failed" }),
        },
        admitWorkspace: (() => (reject ? result : true)) as never,
      });
      if (controller === null) throw new Error("Missing controller.");
      reject = true;
      const before = controller.read();
      expect(await controller.open()).toEqual({ status: "failed", reason: "invalid-workspace" });
      expect(controller.read().workspace).toBe(before.workspace);
    },
  );

  it("captures the callback once without invoking an accessor and treats thrown preflight as rejection", async () => {
    const getter = vi.fn(() => () => true);
    const base = {
      initialWorkspace: workspace(),
      storagePort: {
        openWorkspace: async () => ({
          status: "opened" as const,
          generation: 1,
          workspace: workspace(),
        }),
        saveWorkspace: async () => ({ status: "failed" as const }),
      },
    };
    const hostile = Object.defineProperty({ ...base }, "admitWorkspace", {
      enumerable: true,
      get: getter,
    });
    expect(createProjectLifecycleController(hostile as never)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    let fail = false;
    const options = {
      ...base,
      admitWorkspace: () => {
        if (fail) throw new Error("Private implementation detail.");
        return true;
      },
    };
    const controller = createProjectLifecycleController(options);
    if (controller === null) throw new Error("Missing controller.");
    options.admitWorkspace = () => true;
    fail = true;
    const before = controller.read();
    expect(await controller.open()).toEqual({ status: "failed", reason: "invalid-workspace" });
    expect(controller.read().workspace).toBe(before.workspace);
    expect(controller.renameProject("admission-test", "Rejected")).toEqual({
      status: "failed",
      reason: "invalid-workspace",
    });
    expect(controller.read().workspace).toBe(before.workspace);
  });

  it("blocks reentrant edits, discard and save while validating a complete mutation", async () => {
    let controller: ProjectLifecycleController | null = null;
    const results: unknown[] = [];
    const saves: Promise<unknown>[] = [];
    controller = createProjectLifecycleController({
      initialWorkspace: workspace(),
      storagePort: {
        openWorkspace: async () => ({ status: "missing" }),
        saveWorkspace: async () => ({ status: "failed" }),
      },
      admitWorkspace: () => {
        if (controller !== null) {
          results.push(
            controller.renameProject("admission-test", "Reentrant"),
            controller.discardChanges(),
          );
          saves.push(controller.save());
        }
        return true;
      },
    });
    if (controller === null) throw new Error("Missing controller.");
    expect(controller.renameProject("admission-test", "Allowed")).toBeNull();
    expect(results).toEqual(Array(2).fill({ status: "failed", reason: "operation-in-progress" }));
    expect(await Promise.all(saves)).toEqual([
      { status: "failed", reason: "operation-in-progress" },
    ]);
    expect(controller.read().workspace.projects[0]?.name).toBe("Allowed");
  });

  it("does not revive a disposed controller when a pending open or save settles", async () => {
    let finishOpen: (result: ProjectWorkspaceOpenResult) => void = () => undefined;
    let finishSave: (result: ProjectWorkspaceSaveResult) => void = () => undefined;
    const make = () =>
      createProjectLifecycleController({
        initialWorkspace: workspace(),
        storagePort: {
          openWorkspace: () =>
            new Promise((resolve) => {
              finishOpen = resolve;
            }),
          saveWorkspace: () =>
            new Promise((resolve) => {
              finishSave = resolve;
            }),
        },
      });
    const opening = make();
    const saving = make();
    if (opening === null || saving === null) throw new Error("Missing controller.");
    const open = opening.open();
    const save = saving.save();
    opening.dispose();
    saving.dispose();
    const openBefore = opening.read();
    const saveBefore = saving.read();
    finishOpen({ status: "opened", generation: 9, workspace: workspace() });
    finishSave({ status: "created", generation: 1 });
    expect(await open).toEqual({ status: "failed", reason: "disposed" });
    expect(await save).toEqual({ status: "failed", reason: "disposed" });
    expect(opening.read()).toBe(openBefore);
    expect(saving.read()).toBe(saveBefore);
  });

  it("rechecks disposal after trusted preflight and before replacing the workspace", () => {
    let controller: ProjectLifecycleController | null = null;
    controller = createProjectLifecycleController({
      initialWorkspace: workspace(),
      storagePort: {
        openWorkspace: async () => ({ status: "missing" }),
        saveWorkspace: async () => ({ status: "failed" }),
      },
      admitWorkspace: () => {
        controller?.dispose();
        return true;
      },
    });
    if (controller === null) throw new Error("Missing controller.");
    const before = controller.read();
    expect(controller.renameProject("admission-test", "Must not replace")).toEqual({
      status: "failed",
      reason: "disposed",
    });
    expect(controller.read().workspace).toBe(before.workspace);
  });
});
