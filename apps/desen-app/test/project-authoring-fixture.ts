import { admitEditableProjectRecord } from "@desen/design-system-core";
import { createAuthoringPersistenceController } from "../src/authoring-persistence.js";
import { createProjectAuthoringController } from "../src/project-authoring-controller.js";
import { createProjectWorkspaceAuthoringAdmission } from "../src/project-authoring-session.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { createProjectWorkspaceAuthoringPersistencePort } from "../src/project-workspace-authoring-persistence.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE as profile } from "../src/reference-flow-workspace-profile.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";

import type {
  ProjectLifecycleController,
  ProjectWorkspaceSaveRequest,
  ProjectWorkspaceSaveResult,
  ProjectWorkspaceStoragePort,
} from "../src/project-lifecycle.js";
import type {
  ProjectAuthoringController,
  ProjectAuthoringResult,
} from "../src/project-authoring-controller.js";
import type {
  AuthoringPersistenceController,
  AuthoringPersistenceControllerOptions,
} from "../src/authoring-persistence.js";
import type { ProjectWorkspaceAuthoringPersistenceOptions } from "../src/project-workspace-authoring-persistence.js";

type Save = (request: ProjectWorkspaceSaveRequest) => Promise<ProjectWorkspaceSaveResult>;

/** Explicit test-fixture boundary avoids serializing the entire inferred Source schema. */
export interface ProjectAuthoringTestFixture {
  readonly project: ProjectAuthoringController;
  readonly lifecycle: ProjectLifecycleController;
  readonly source: AuthoringPersistenceController;
  readonly options: AuthoringPersistenceControllerOptions;
  readonly bridgeOptions: ProjectWorkspaceAuthoringPersistenceOptions;
  readonly writes: ProjectWorkspaceSaveRequest[];
  readonly addMaster: () => ProjectAuthoringResult;
  readonly setStored: (value: unknown, generation: number) => void;
  readonly setSave: (save: Save | null) => void;
}

/** Real lightweight profile, aggregate lifecycle and paired Source bridge for integration tests. */
export function createProjectAuthoringFixture(): ProjectAuthoringTestFixture {
  const authority = readProjectWorkspaceProfileAuthority(profile);
  if (authority.status !== "read") throw new Error("Profile unavailable.");
  const admitted = admitEditableProjectRecord({
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: authority.profile.project.id,
    source: authority.profile.initialDocument,
    designSystem: {
      tokenSources: [],
      recipes: [],
      assets: [],
      recipeGraph: { definitions: [], instances: [] },
    },
    connectionIntents: [],
  });
  if (!admitted.ok) throw new Error("Project unavailable.");
  let stored: unknown;
  let generation: number | null = null;
  let customSave:
    ((request: ProjectWorkspaceSaveRequest) => Promise<ProjectWorkspaceSaveResult>) | null = null;
  const writes: ProjectWorkspaceSaveRequest[] = [];
  const storage: ProjectWorkspaceStoragePort = {
    openWorkspace: async () =>
      generation === null
        ? { status: "missing" }
        : { status: "opened", generation, workspace: stored },
    saveWorkspace: async (request) => {
      writes.push(request);
      if (customSave !== null) return customSave(request);
      if (request.expectedGeneration !== generation)
        return { status: "conflict", currentGeneration: generation };
      stored = request.workspace;
      const created = generation === null;
      generation = (generation ?? 0) + 1;
      return { status: created ? "created" : "updated", generation };
    },
  };
  const lifecycle = createProjectLifecycleController({
    initialWorkspace: createEmptyProjectWorkspace(),
    storagePort: storage,
    admitWorkspace: createProjectWorkspaceAuthoringAdmission([profile]),
  });
  if (lifecycle === null) throw new Error("Lifecycle unavailable.");
  const project = createProjectAuthoringController({
    profile,
    initialProject: admitted.record,
    lifecycle,
  });
  if (project === null) throw new Error("Authoring unavailable.");
  const bridgeOptions = {
    lifecycle,
    initialProject: admitted.record,
    projectName: authority.profile.project.name,
    sourceKey: authority.profile.sourceKey,
    surfaceNames: authority.profile.project.surfaces.map(({ sourceId, name }) => ({
      id: sourceId,
      name,
    })),
    authoringController: project,
  };
  const bridge = createProjectWorkspaceAuthoringPersistencePort(bridgeOptions);
  if (!bridge.ok) throw new Error("Bridge unavailable.");
  const options = {
    profile,
    document: admitted.record.source,
    persistencePort: bridge.persistencePort,
    route: { projectId: admitted.record.id, surfaceId: authority.profile.sourceSurfaceId },
    projectAuthoringController: project,
  };
  const created = createAuthoringPersistenceController(options);
  if (!created.ok) throw new Error(`Persistence unavailable: ${created.reason}`);
  const addMaster = () =>
    project.applyRecipe({
      type: "master.create",
      expectedProjectDigest: project.read().session.digest,
      definition: {
        id: "title",
        name: "Title",
        root: { kind: "node", id: "label", use: "com.example.ui/Text", props: { text: "Shared" } },
        state: {},
        resources: {},
      },
    });
  return {
    project,
    lifecycle,
    source: created.controller,
    options,
    bridgeOptions,
    writes,
    addMaster,
    setStored: (value: unknown, nextGeneration: number) => {
      stored = value;
      generation = nextGeneration;
    },
    setSave: (save: typeof customSave) => {
      customSave = save;
    },
  };
}
