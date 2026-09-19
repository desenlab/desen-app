import { describe, expect, it } from "vitest";

import { createProjectWorkspaceAuthoringPersistencePort } from "../src/project-workspace-authoring-persistence.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { createStarterProject } from "../src/starter-project.js";

import type {
  ProjectWorkspaceOpenResult,
  ProjectWorkspaceSaveRequest,
  ProjectWorkspaceSaveResult,
} from "../src/project-lifecycle.js";

function createMemoryWorkspaceStorage(
  initial?: Readonly<{ readonly generation: number; readonly workspace: unknown }>,
) {
  let generation: number | null = initial?.generation ?? null;
  let workspace: unknown = initial?.workspace;
  return Object.freeze({
    openWorkspace: async (): Promise<ProjectWorkspaceOpenResult> =>
      generation === null
        ? Object.freeze({ status: "missing" })
        : Object.freeze({ status: "opened", generation, workspace }),
    saveWorkspace: async (
      request: ProjectWorkspaceSaveRequest,
    ): Promise<ProjectWorkspaceSaveResult> => {
      if (request.expectedGeneration !== generation) {
        return Object.freeze({ status: "conflict", currentGeneration: generation });
      }
      if (generation === null) {
        generation = 1;
        workspace = request.workspace;
        return Object.freeze({ status: "created", generation });
      }
      workspace = request.workspace;
      generation += 1;
      return Object.freeze({ status: "updated", generation });
    },
  });
}

describe("createProjectWorkspaceAuthoringPersistencePort", () => {
  it("creates and reopens a Source through one persisted aggregate T02 workspace", async () => {
    const starter = createStarterProject("aggregate-persistence");
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: createMemoryWorkspaceStorage(),
    });
    expect(lifecycle).not.toBeNull();
    if (lifecycle === null) throw new Error("Expected lifecycle controller.");
    const created = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: starter.record,
      projectName: "Aggregate persistence",
      sourceKey: "aggregate-persistence-source",
      surfaceNames: starter.surfaceNames,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("Expected aggregate persistence bridge.");

    expect(await created.persistencePort.openSource("aggregate-persistence-source")).toEqual({
      status: "missing",
    });
    const saved = await created.persistencePort.saveSource({
      sourceKey: "aggregate-persistence-source",
      expectedGeneration: null,
      document: starter.record.source,
    });
    expect(saved).toEqual({ status: "created", generation: 1 });

    const reopened = await created.persistencePort.openSource("aggregate-persistence-source");
    expect(reopened.status).toBe("opened");
    if (reopened.status !== "opened") throw new Error("Expected persisted Source.");
    expect(reopened.document).toEqual(starter.record.source);
    expect(lifecycle.read().workspace.projects[0]?.record.designSystem.tokenSources).toEqual(
      starter.record.designSystem.tokenSources,
    );
  });

  it("does not use an unrelated source key as a second storage namespace", async () => {
    const starter = createStarterProject("aggregate-key");
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: createMemoryWorkspaceStorage(),
    });
    if (lifecycle === null) throw new Error("Expected lifecycle controller.");
    const bridge = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: starter.record,
      projectName: "Aggregate key",
      sourceKey: "aggregate-key-source",
      surfaceNames: starter.surfaceNames,
    });
    if (!bridge.ok) throw new Error("Expected aggregate persistence bridge.");

    const opened = await bridge.persistencePort.openSource("other-source");
    expect(opened.status).toBe("failed");
    if (opened.status !== "failed") throw new Error("Expected controlled rejection.");
    expect(opened.diagnostic.code).toBe("run.desen.editor/PERSISTENCE_UNSAFE_STORAGE");
    expect(lifecycle.read().workspace.projects).toHaveLength(0);
  });

  it("creates a missing Source through an existing aggregate generation fence", async () => {
    const starter = createStarterProject("aggregate-existing");
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: createMemoryWorkspaceStorage({
        generation: 1,
        workspace: createEmptyProjectWorkspace(),
      }),
    });
    if (lifecycle === null) throw new Error("Expected lifecycle controller.");
    const bridge = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: starter.record,
      projectName: "Aggregate existing",
      sourceKey: "aggregate-existing-source",
      surfaceNames: starter.surfaceNames,
    });
    if (!bridge.ok) throw new Error("Expected aggregate persistence bridge.");

    expect(await bridge.persistencePort.openSource("aggregate-existing-source")).toEqual({
      status: "missing",
    });
    await expect(
      bridge.persistencePort.saveSource({
        sourceKey: "aggregate-existing-source",
        expectedGeneration: null,
        document: starter.record.source,
      }),
    ).resolves.toEqual({ status: "created", generation: 1 });
    expect(lifecycle.read().generation).toBe(2);
    expect(lifecycle.read().workspace.projects[0]?.record.source).toEqual(starter.record.source);

    // Aggregate generation two must not be mistaken for Source generation two. The next Source
    // write still fences on logical Source generation one and maps it to aggregate generation two.
    await expect(
      bridge.persistencePort.saveSource({
        sourceKey: "aggregate-existing-source",
        expectedGeneration: 2,
        document: starter.record.source,
      }),
    ).resolves.toEqual({ status: "conflict", currentGeneration: 1 });
    expect(lifecycle.read().generation).toBe(2);

    await expect(
      bridge.persistencePort.saveSource({
        sourceKey: "aggregate-existing-source",
        expectedGeneration: 1,
        document: starter.record.source,
      }),
    ).resolves.toEqual({ status: "updated", generation: 2 });
    expect(lifecycle.read().generation).toBe(3);
  });

  it("rejects a malformed aggregate creation generation rather than coercing it to Source generation one", async () => {
    const starter = createStarterProject("aggregate-generation");
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: Object.freeze({
        openWorkspace: async (): Promise<ProjectWorkspaceOpenResult> =>
          Object.freeze({ status: "missing" }),
        saveWorkspace: async (): Promise<ProjectWorkspaceSaveResult> =>
          Object.freeze({ status: "created", generation: 7 }),
      }),
    });
    if (lifecycle === null) throw new Error("Expected lifecycle controller.");
    const bridge = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: starter.record,
      projectName: "Aggregate generation",
      sourceKey: "aggregate-generation-source",
      surfaceNames: starter.surfaceNames,
    });
    if (!bridge.ok) throw new Error("Expected aggregate persistence bridge.");

    await expect(
      bridge.persistencePort.saveSource({
        sourceKey: "aggregate-generation-source",
        expectedGeneration: null,
        document: starter.record.source,
      }),
    ).resolves.toMatchObject({
      status: "indeterminate",
      diagnostic: { code: "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE" },
    });
    expect(lifecycle.read().generation).toBeNull();
    expect(lifecycle.read().savedWorkspace).toBeNull();
    expect(lifecycle.read().dirty).toBe(true);
    expect(lifecycle.read().reopenRequired).toBe(true);
  });
});
