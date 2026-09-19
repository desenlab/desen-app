import { describe, expect, it } from "vitest";
import {
  admitEditableProjectRecord,
  getEditableProjectMasterDefinitionDigest,
} from "@desen/design-system-core";
import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";
import { setDesenEditorOwnerProp } from "@desen/editor-core";
import { createStarterNodeTemplate, STARTER_TEXT_CAPABILITY_ID } from "@desen/starter-catalog-web";

import { createProjectAuthoringController } from "../src/project-authoring-controller.js";
import {
  createProjectWorkspaceAuthoringAdmission,
  prepareProjectAuthoringSession,
} from "../src/project-authoring-session.js";
import {
  createEmptyProjectWorkspace,
  createProjectLifecycleController,
} from "../src/project-lifecycle.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE as profile } from "../src/starter-neutral-workspace-profile.js";
import { createStarterProject } from "../src/starter-project.js";
import { createProjectWorkspaceAuthoringPersistencePort } from "../src/project-workspace-authoring-persistence.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE } from "../src/reference-flow-workspace-profile.js";
import { readProjectWorkspaceProfileAuthority } from "../src/project-workspace-profile.js";

import type { EditableProjectRecord } from "@desen/design-system-core";
import type { ProjectAuthoringController } from "../src/project-authoring-controller.js";
import type {
  ProjectWorkspaceSaveRequest,
  ProjectWorkspaceSaveResult,
  ProjectWorkspaceStoragePort,
} from "../src/project-lifecycle.js";

function project(): EditableProjectRecord {
  const starter = createStarterProject("desen-neutral");
  const home = starter.record.source.surfaces.home;
  if (home === undefined) throw new Error("Missing starter surface.");
  const admitted = admitEditableProjectRecord({
    ...starter.record,
    source: {
      ...starter.record.source,
      surfaces: {
        home: {
          ...home,
          root: {
            ...home.root,
            slots: {
              default: [
                createStarterNodeTemplate({
                  capabilityId: STARTER_TEXT_CAPABILITY_ID,
                  idPrefix: "title",
                }),
              ],
            },
          },
        },
      },
    },
  });
  if (!admitted.ok) throw new Error("Invalid test project.");
  return admitted.record;
}

function memory() {
  let stored: unknown;
  let generation: number | null = null;
  const writes: ProjectWorkspaceSaveRequest[] = [];
  let nextSave:
    ((request: ProjectWorkspaceSaveRequest) => Promise<ProjectWorkspaceSaveResult>) | null = null;
  const port: ProjectWorkspaceStoragePort = {
    openWorkspace: async () =>
      generation === null
        ? { status: "missing" }
        : { status: "opened", generation, workspace: stored },
    saveWorkspace: async (request) => {
      writes.push(request);
      if (nextSave !== null) return nextSave(request);
      if (request.expectedGeneration !== generation)
        return { status: "conflict", currentGeneration: generation };
      const created = generation === null;
      generation = (generation ?? 0) + 1;
      stored = request.workspace;
      return { status: created ? "created" : "updated", generation };
    },
  };
  return {
    port,
    writes,
    replaceStored: (workspace: unknown, nextGeneration: number) => {
      stored = workspace;
      generation = nextGeneration;
    },
    useSave: (save: typeof nextSave) => {
      nextSave = save;
    },
  };
}

function setup() {
  const storage = memory();
  const record = project();
  const lifecycle = createProjectLifecycleController({
    initialWorkspace: createEmptyProjectWorkspace(),
    storagePort: storage.port,
    admitWorkspace: createProjectWorkspaceAuthoringAdmission([profile]),
  });
  if (lifecycle === null) throw new Error("Lifecycle unavailable.");
  expect(
    lifecycle.createProject(record, "DESEN Neutral", [{ id: "home", name: "Home" }]),
  ).toBeNull();
  const controller = createProjectAuthoringController({
    profile,
    initialProject: record,
    lifecycle,
  });
  if (controller === null) throw new Error("Authoring unavailable.");
  return { storage, record, lifecycle, controller };
}

function recipe(controller: ProjectAuthoringController, command: Record<string, unknown>) {
  const result = controller.applyRecipe({
    ...command,
    expectedProjectDigest: controller.read().session.digest,
  });
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error("Recipe rejected.");
  return result.state;
}

function capture(controller: ProjectAuthoringController) {
  const rootId = controller.read().session.document.surfaces.home?.root.slots?.default?.[0]?.id;
  if (rootId === undefined) throw new Error("Missing capture root.");
  return recipe(controller, {
    type: "master.capture",
    masterId: "master.title",
    name: "Title",
    surfaceId: "home",
    nodeId: rootId,
    instanceId: "first",
  });
}

function insert(controller: ProjectAuthoringController, instanceId: string) {
  return recipe(controller, {
    type: "instance.insert",
    masterId: "master.title",
    instanceId,
    destination: {
      surfaceId: "home",
      parentId: controller.read().session.document.surfaces.home?.root.id,
      slot: "default",
      index: 1,
    },
  });
}

// These are multi-operation integrations with the real installed Catalog and Publisher, not
// mocked unit transitions. Bound each complete journey while retaining every actual preflight.
// The three save/reopen/history journeys below exceeded 30s on hosted runners (the longest
// observed 50.7s); give only those integrations a 60s budget, not every test in this suite.
describe("aggregate project authoring authority", { timeout: 30_000 }, () => {
  it("keeps a cross-surface master update in one aggregate history step", () => {
    const authority = readProjectWorkspaceProfileAuthority(REFERENCE_FLOW_WORKSPACE_PROFILE);
    if (authority.status !== "read") throw new Error("Missing installed profile.");
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
    if (!admitted.ok) throw new Error("Invalid profile project.");
    const lifecycle = createProjectLifecycleController({
      initialWorkspace: createEmptyProjectWorkspace(),
      storagePort: memory().port,
      admitWorkspace: createProjectWorkspaceAuthoringAdmission([REFERENCE_FLOW_WORKSPACE_PROFILE]),
    });
    if (lifecycle === null) throw new Error("Lifecycle unavailable.");
    const controller = createProjectAuthoringController({
      profile: REFERENCE_FLOW_WORKSPACE_PROFILE,
      initialProject: admitted.record,
      lifecycle,
    });
    if (controller === null) throw new Error("Controller unavailable.");
    const definition = {
      id: "shared",
      name: "Shared text",
      root: { kind: "node", id: "label", use: "com.example.ui/Text", props: { text: "Original" } },
      state: {},
      resources: {},
    };
    recipe(controller, { type: "master.create", definition });
    for (const surfaceId of ["start", "result"])
      recipe(controller, {
        type: "instance.insert",
        instanceId: `instance.${surfaceId}`,
        masterId: definition.id,
        destination: { surfaceId, parentId: `${surfaceId}.layout`, slot: "default", index: 0 },
      });
    const before = controller.read();
    const after = recipe(controller, {
      type: "master.update",
      definition: {
        ...definition,
        root: { ...definition.root, props: { text: "Updated across surfaces" } },
      },
      expectedDefinitionDigest: getEditableProjectMasterDefinitionDigest(
        before.session.record,
        definition.id,
      ),
    });
    for (const surfaceId of ["start", "result"]) {
      const oldNode = before.session.document.surfaces[surfaceId]?.root.slots?.default?.[0];
      const nextNode = after.session.document.surfaces[surfaceId]?.root.slots?.default?.[0];
      expect(nextNode?.id).toBe(oldNode?.id);
      expect(nextNode?.props?.text).toBe("Updated across surfaces");
    }
    expect(after.history.past).toHaveLength(before.history.past.length + 1);
    expect(controller.undo(after.session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(before.session.record);
    expect(controller.redo(before.session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(after.session.record);
    controller.dispose();
    lifecycle.dispose();
  });
  it("updates linked instances, preserves override and detached Source, and restores the whole project with undo/redo", async () => {
    const { controller, lifecycle, storage } = setup();
    capture(controller);
    insert(controller, "second");
    insert(controller, "third");
    const second = controller
      .read()
      .session.record.designSystem.recipeGraph.instances.find(({ id }) => id === "second");
    const owner = second?.mapping.find(({ sourceId }) => sourceId === second.rootId)?.owner;
    if (owner === undefined) throw new Error("Missing owner.");
    recipe(controller, {
      type: "instance.override",
      instanceId: "second",
      override: {
        owner,
        property: { kind: "prop", name: "text" },
        value: "Local label",
      },
    });
    recipe(controller, { type: "instance.detach", instanceId: "third" });
    const before = controller.read();
    const master = before.session.record.designSystem.recipeGraph.definitions[0];
    if (master === undefined || master.root.kind !== "node") throw new Error("Missing master.");
    const after = recipe(controller, {
      type: "master.update",
      definition: {
        ...master,
        root: {
          ...master.root,
          props: { ...master.root.props, text: "Shared label" },
        },
      },
      expectedDefinitionDigest: getEditableProjectMasterDefinitionDigest(
        before.session.record,
        master.id,
      ),
    });
    const labels = after.session.document.surfaces.home?.root.slots?.default?.map(
      ({ props }) => props?.text,
    );
    expect(labels).toEqual([
      "Shared label",
      before.session.document.surfaces.home?.root.slots?.default?.[1]?.props?.text,
      "Local label",
    ]);
    expect(after.session.document).toBe(after.session.record.source);
    expect(after.history.record).toBe(after.session.record);
    expect(after.session.preview.ok).toBe(true);
    expect(controller.undo(after.session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(before.session.record);
    expect(controller.redo(controller.read().session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(after.session.record);
    const save = controller.captureForSave(controller.read().session.document);
    expect(save).toBe(controller.read().session.record);
    expect(lifecycle.replaceProjectRecord("desen-neutral", save)).toBeNull();
    expect(await lifecycle.save()).toEqual({ status: "created", generation: 1 });
    expect(storage.writes[0]?.workspace.projects[0]?.record).toEqual(after.session.record);
    expect(controller.read().dirty).toBe(false);
    const reopened = await lifecycle.open();
    expect(reopened.status).toBe("opened");
    expect(controller.read().session.record).toEqual(after.session.record);
    expect(controller.read().history.past).toHaveLength(0);
    expect(controller.read().session.preview.revision).toBe(after.session.preview.revision);
  }, 60_000);

  it("treats metadata-only detach as dirty, retains its exact Source and clears dirty by undo or discard", async () => {
    const { controller, lifecycle } = setup();
    const linked = capture(controller);
    expect(lifecycle.replaceProjectRecord("desen-neutral", linked.session.record)).toBeNull();
    await lifecycle.save();
    const detached = recipe(controller, { type: "instance.detach", instanceId: "first" });
    expect(detached.session.document).toEqual(linked.session.document);
    expect(detached.session.preview.revision).toBe(linked.session.preview.revision);
    expect(detached.dirty).toBe(true);
    expect(controller.undo(detached.session.digest).ok).toBe(true);
    expect(controller.read().dirty).toBe(false);
    expect(controller.redo(controller.read().session.digest).ok).toBe(true);
    expect(controller.read().dirty).toBe(true);
    expect(controller.discard(controller.read().session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(linked.session.record);
    expect(controller.read().history.past).toHaveLength(0);
    expect(controller.read().history.future).toHaveLength(0);
    expect(controller.read().dirty).toBe(false);
  }, 60_000);

  it("rejects stale and managed structural Source edits without changing any authoring state", () => {
    const { controller } = setup();
    capture(controller);
    const before = controller.read();
    const source = structuredClone(before.session.document);
    const home = source.surfaces.home;
    const text = home?.root.slots?.default?.[0];
    if (home === undefined || text === undefined) throw new Error("Missing text.");
    const candidate = {
      ...source,
      surfaces: {
        home: {
          ...home,
          root: {
            ...home.root,
            slots: {
              default: [{ ...text, on: {}, props: { ...text.props, text: "Local override" } }],
            },
          },
        },
      },
    };
    expect(controller.replaceSource(before.session.digest, candidate).ok).toBe(false);
    expect(controller.read()).toBe(before);
    expect(controller.replaceProject(`sha256:${"0".repeat(64)}`, before.session.record)).toEqual({
      ok: false,
      reason: "project-stale",
    });
    expect(controller.read()).toBe(before);
    expect(controller.captureForSave(candidate)).toBeNull();
    expect(controller.read()).toBe(before);
    for (const invalid of [undefined, null, 0, ""]) {
      expect(controller.replaceProject(invalid as never, before.session.record)).toEqual({
        ok: false,
        reason: "project-stale",
      });
      expect(controller.undo(invalid as never)).toEqual({ ok: false, reason: "project-stale" });
      expect(controller.read()).toBe(before);
    }
  });

  it("turns an ordinary editor prop command into one durable override/history transaction", async () => {
    const { controller, lifecycle } = setup();
    capture(controller);
    insert(controller, "second");
    const before = controller.read();
    const instance = before.session.record.designSystem.recipeGraph.instances[0];
    if (instance === undefined) throw new Error("Missing instance.");
    const edit = setDesenEditorOwnerProp(before.session.document, {
      surfaceId: instance.surfaceId,
      ownerId: instance.rootId,
      name: "text",
      value: "Local title",
    });
    if (!edit.ok) throw new Error("Editor rejected the fixture.");
    let notifications = 0;
    const unsubscribe = controller.subscribe(() => {
      notifications += 1;
    });
    const changed = controller.replaceSource(before.session.digest, edit.document);
    expect(changed.ok).toBe(true);
    expect(notifications).toBe(1);
    unsubscribe();
    const after = controller.read();
    expect(after.session.document).toEqual(edit.document);
    expect(after.session.record.designSystem.recipeGraph.instances[0]?.overrides).toEqual([
      {
        owner: instance.mapping.find(({ sourceId }) => sourceId === instance.rootId)?.owner,
        property: { kind: "prop", name: "text" },
        value: "Local title",
      },
    ]);
    expect(after.session.record.designSystem.recipeGraph.instances[1]).toEqual(
      before.session.record.designSystem.recipeGraph.instances[1],
    );
    expect(after.history.past).toHaveLength(before.history.past.length + 1);
    expect(after.dirty).toBe(true);
    expect(after.session.preview.ok).toBe(true);
    expect(controller.undo(after.session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(before.session.record);
    expect(controller.redo(controller.read().session.digest).ok).toBe(true);
    expect(controller.read().session.record).toEqual(after.session.record);
    expect(
      lifecycle.replaceProjectRecord(
        "desen-neutral",
        controller.captureForSave(after.session.document),
      ),
    ).toBeNull();
    expect(await lifecycle.save()).toEqual({ status: "created", generation: 1 });
    expect(controller.read().dirty).toBe(false);
    expect((await lifecycle.open()).status).toBe("opened");
    expect(controller.read().session.record).toEqual(after.session.record);
    expect(controller.read().session.preview.revision).toBe(after.session.preview.revision);
  }, 60_000);

  it("accepts unmanaged Source edits, preserving all metadata and canonical no-op redo", () => {
    const { controller, record } = setup();
    const candidate = { ...record.source, extensions: { note: "ordinary edit" } };
    expect(controller.replaceSource(controller.read().session.digest, candidate).ok).toBe(true);
    expect(controller.read().session.record.designSystem).toEqual(record.designSystem);
    expect(controller.undo(controller.read().session.digest).ok).toBe(true);
    const before = controller.read();
    expect(controller.replaceSource(before.session.digest, before.session.document)).toEqual({
      ok: true,
      changed: false,
      state: before,
    });
    expect(controller.read()).toBe(before);
    expect(controller.read().history.future).toHaveLength(1);
  });

  it("blocks edits/history during the shared save and retains the candidate after indeterminate storage", async () => {
    const { controller, lifecycle, storage } = setup();
    capture(controller);
    const snapshot = controller.read();
    expect(lifecycle.replaceProjectRecord("desen-neutral", snapshot.session.record)).toBeNull();
    let resolveSave: (result: ProjectWorkspaceSaveResult) => void = () => undefined;
    storage.useSave(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const save = lifecycle.save();
    expect(controller.read().pending).toBe("saving");
    expect(controller.undo(snapshot.session.digest)).toEqual({
      ok: false,
      reason: "operation-in-progress",
    });
    expect(controller.captureForSave(snapshot.session.document)).toBeNull();
    resolveSave({ status: "indeterminate" });
    expect((await save).status).toBe("indeterminate");
    expect(controller.read().session).toBe(snapshot.session);
    expect(controller.read().history).toBe(snapshot.history);
    expect(controller.read().dirty).toBe(true);
    expect(controller.discard(snapshot.session.digest)).toEqual({
      ok: false,
      reason: "reopen-required",
    });
  });

  it("rejects incompatible opened projects, including unused masters, before changing lifecycle or authoring authority", async () => {
    const { controller, lifecycle, storage } = setup();
    capture(controller);
    expect(
      lifecycle.replaceProjectRecord("desen-neutral", controller.read().session.record),
    ).toBeNull();
    await lifecycle.save();
    const previous = lifecycle.read();
    const authored = controller.read();
    const invalid = {
      ...authored.session.record,
      designSystem: {
        ...authored.session.record.designSystem,
        recipeGraph: {
          ...authored.session.record.designSystem.recipeGraph,
          definitions: [
            ...authored.session.record.designSystem.recipeGraph.definitions,
            {
              id: "unused",
              name: "Unknown",
              root: { kind: "node", id: "foreign", use: "unknown.ui/Widget" },
              state: {},
              resources: {},
            },
          ],
        },
      },
    };
    expect(admitEditableProjectRecord(invalid).ok).toBe(true);
    storage.replaceStored(
      {
        ...previous.workspace,
        projects: previous.workspace.projects.map((item) => ({ ...item, record: invalid })),
      },
      2,
    );
    expect(await lifecycle.open()).toEqual({ status: "failed", reason: "invalid-workspace" });
    expect(lifecycle.read().workspace).toBe(previous.workspace);
    expect(lifecycle.read().generation).toBe(previous.generation);
    expect(controller.read().session).toBe(authored.session);
    expect(controller.read().history).toBe(authored.history);
    expect(storage.writes).toHaveLength(1);
  });

  it("rejects foreign profile identity and preserves opaque project metadata", () => {
    const record = project();
    expect(prepareProjectAuthoringSession({} as never, record)).toEqual({
      ok: false,
      reason: "profile-invalid",
    });
    expect(prepareProjectAuthoringSession(profile, { ...record, id: "foreign" })).toEqual({
      ok: false,
      reason: "project-mismatch",
    });
    const candidate = { ...record, extensions: { note: { arbitrary: "$ref state.literal" } } };
    const prepared = prepareProjectAuthoringSession(profile, candidate);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error("Expected session.");
    expect(canonicalizeJson(prepared.session.record)).toBe(canonicalizeJson(candidate));
    expect(prepared.session.digest).toBe(digestCanonicalJson(candidate));
  });

  it("blocks reentrant mutation from candidate reflection and disposes without writing", () => {
    const { controller, record, storage } = setup();
    let reentrant: unknown;
    const candidate = new Proxy(record, {
      ownKeys(target) {
        reentrant = controller.undo(controller.read().session.digest);
        return Reflect.ownKeys(target);
      },
    });
    expect(controller.replaceProject(controller.read().session.digest, candidate).ok).toBe(true);
    expect(reentrant).toEqual({ ok: false, reason: "operation-in-progress" });
    const history = controller.read().history;
    controller.dispose();
    expect(controller.read().history).toBe(history);
    expect(controller.undo(controller.read().session.digest)).toEqual({
      ok: false,
      reason: "disposed",
    });
    expect(storage.writes).toHaveLength(0);
  });

  it("saves Source-identical detach through the existing Source port as a whole-project generation", async () => {
    const { controller, lifecycle, storage, record } = setup();
    const bridge = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: record,
      projectName: "DESEN Neutral",
      sourceKey: "desen-neutral-source",
      surfaceNames: [{ id: "home", name: "Home" }],
      authoringController: controller,
    });
    if (!bridge.ok) throw new Error("Bridge unavailable.");
    const linked = capture(controller);
    const reentrantEdits: unknown[] = [];
    const unsubscribe = lifecycle.subscribe(() => {
      if (controller.read().pending === "saving")
        reentrantEdits.push(controller.undo(controller.read().session.digest));
    });
    expect(
      await bridge.persistencePort.saveSource({
        sourceKey: "desen-neutral-source",
        expectedGeneration: null,
        document: linked.session.document,
      }),
    ).toEqual({ status: "created", generation: 1 });
    const detached = recipe(controller, { type: "instance.detach", instanceId: "first" });
    expect(detached.dirty).toBe(true);
    expect(detached.session.document).toEqual(linked.session.document);
    expect(
      await bridge.persistencePort.saveSource({
        sourceKey: "desen-neutral-source",
        expectedGeneration: 1,
        document: detached.session.document,
      }),
    ).toEqual({ status: "updated", generation: 2 });
    expect(storage.writes).toHaveLength(2);
    unsubscribe();
    expect(reentrantEdits.length).toBeGreaterThan(0);
    expect(
      reentrantEdits.every(
        (result) =>
          JSON.stringify(result) === JSON.stringify({ ok: false, reason: "operation-in-progress" }),
      ),
    ).toBe(true);
    expect(
      storage.writes[0]?.workspace.projects[0]?.record.designSystem.recipeGraph.instances,
    ).toHaveLength(1);
    expect(
      storage.writes[1]?.workspace.projects[0]?.record.designSystem.recipeGraph.instances,
    ).toHaveLength(0);
    expect(controller.read().dirty).toBe(false);
    expect((await bridge.persistencePort.openSource("desen-neutral-source")).status).toBe("opened");
    expect(controller.read().session.record).toEqual(detached.session.record);
  });

  it("releases only the save edit lock when the trusted bridge throws, preserving the full draft", async () => {
    const { controller, storage } = setup();
    const before = controller.read();
    await expect(
      controller.saveSnapshot(before.session.document, async (snapshot) => {
        expect(snapshot).toBe(before.session.record);
        expect(controller.read().pending).toBe("saving");
        expect(controller.discard(before.session.digest)).toEqual({
          ok: false,
          reason: "operation-in-progress",
        });
        throw new Error("Bridge rejected before dispatch.");
      }),
    ).rejects.toThrow("Bridge rejected before dispatch.");
    expect(controller.read().pending).toBeNull();
    expect(controller.read().session).toBe(before.session);
    expect(controller.read().history).toBe(before.history);
    expect(controller.read().baseline).toBe(before.baseline);
    expect(storage.writes).toHaveLength(0);
  });

  it("does not combine stale Source with the latest recipe metadata or write after a CAS conflict", async () => {
    const { controller, lifecycle, storage, record } = setup();
    const bridge = createProjectWorkspaceAuthoringPersistencePort({
      lifecycle,
      initialProject: record,
      projectName: "DESEN Neutral",
      sourceKey: "desen-neutral-source",
      surfaceNames: [{ id: "home", name: "Home" }],
      authoringController: controller,
    });
    if (!bridge.ok) throw new Error("Bridge unavailable.");
    capture(controller);
    insert(controller, "second");
    const before = controller.read();
    const workspaceBefore = lifecycle.read().workspace;
    expect(
      (
        await bridge.persistencePort.saveSource({
          sourceKey: "desen-neutral-source",
          expectedGeneration: null,
          document: record.source,
        })
      ).status,
    ).toBe("failed");
    expect(storage.writes).toHaveLength(0);
    expect(controller.read()).toBe(before);
    expect(lifecycle.read().workspace).toBe(workspaceBefore);
    storage.useSave(async () => ({ status: "conflict", currentGeneration: 4 }));
    expect(
      await bridge.persistencePort.saveSource({
        sourceKey: "desen-neutral-source",
        expectedGeneration: null,
        document: before.session.document,
      }),
    ).toEqual({ status: "conflict", currentGeneration: 4 });
    expect(controller.read().session).toBe(before.session);
    expect(controller.read().history).toBe(before.history);
    expect(controller.read().dirty).toBe(true);
    expect(controller.read().baseline).toEqual(record);
    expect(storage.writes).toHaveLength(1);
  });
});
