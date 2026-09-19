import { describe, expect, it } from "vitest";
import {
  createAuthoringPersistenceController,
  authenticateAuthoringPersistenceControllerProfile,
} from "../src/authoring-persistence.js";
import { createProjectWorkspaceAuthoringPersistencePort } from "../src/project-workspace-authoring-persistence.js";
import { REFERENCE_FLOW_WORKSPACE_PROFILE as profile } from "../src/reference-flow-workspace-profile.js";
import { createProjectAuthoringFixture as setup } from "./project-authoring-fixture.js";
import type { ProjectWorkspaceSaveResult } from "../src/project-lifecycle.js";

describe("aggregate-backed existing Source persistence controls", () => {
  it("creates, saves Source-identical master metadata, undoes and reopens the exact aggregate", async () => {
    const fixture = setup();
    const { source, project, writes } = fixture;
    expect(authenticateAuthoringPersistenceControllerProfile(source, profile).status).toBe(
      "authenticated",
    );
    expect(await source.open()).toEqual({ status: "missing" });
    expect(await source.save()).toEqual({ status: "created", generation: 1 });
    expect(source.read().dirty).toBe(false);
    const before = project.read();
    expect(fixture.addMaster().ok).toBe(true);
    expect(source.read().session).toBe(project.read().session);
    expect(source.read().session.document).toEqual(before.session.document);
    expect(source.read().dirty).toBe(true);
    expect(await source.save()).toEqual({ status: "updated", generation: 2 });
    const saved = project.read();
    expect(writes[1]?.workspace.projects[0]?.record).toEqual(saved.session.record);
    expect(source.read().dirty).toBe(false);
    expect(project.undo(saved.session.digest).ok).toBe(true);
    expect(source.read().dirty).toBe(true);
    const opened = await source.open();
    expect(opened.status).toBe("opened");
    if (opened.status !== "opened") throw new Error("Open failed.");
    expect(source.read().session).toBe(opened.session);
    expect(project.read().session.record).toEqual(saved.session.record);
    expect(source.read().dirty).toBe(false);
    expect(source.read()).toBe(source.read());
  });

  it("routes legacy Source replacement into whole-project history without a second draft", () => {
    const { project, source } = setup();
    const before = project.read();
    const document = { ...before.session.document, extensions: { note: "Visual edit" } };
    expect(source.replaceAuthoredDocument(document).ok).toBe(true);
    expect(project.read().session.document).toEqual(document);
    expect(source.read().session).toBe(project.read().session);
    expect(project.read().history.past).toHaveLength(1);
    expect(project.undo(project.read().session.digest).ok).toBe(true);
    expect(source.read().session.document).toEqual(before.session.document);
  });

  it("locks the aggregate before pending-save observers can change Source-identical metadata", async () => {
    const fixture = setup();
    let release: (result: ProjectWorkspaceSaveResult) => void = () => undefined;
    fixture.setSave(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const attempts: unknown[] = [];
    const unsubscribe = fixture.source.subscribe(() => {
      if (fixture.source.read().pending === "saving") attempts.push(fixture.addMaster());
    });
    const before = fixture.project.read().session.record;
    const saving = fixture.source.save();
    expect(fixture.source.read().pending).toBe("saving");
    expect(attempts.length).toBeGreaterThan(0);
    expect(
      attempts.every(
        (attempt) =>
          JSON.stringify(attempt) ===
          JSON.stringify({ ok: false, reason: "operation-in-progress" }),
      ),
    ).toBe(true);
    expect(fixture.writes[0]?.workspace.projects[0]?.record).toEqual(before);
    release({ status: "created", generation: 1 });
    expect((await saving).status).toBe("created");
    unsubscribe();
    expect(
      attempts.every(
        (attempt) =>
          JSON.stringify(attempt) ===
          JSON.stringify({ ok: false, reason: "operation-in-progress" }),
      ),
    ).toBe(true);
    expect(fixture.project.read().session.record).toEqual(before);
  });

  it("preserves current project/history when stored unused-master semantics are invalid", async () => {
    const fixture = setup();
    expect(fixture.addMaster().ok).toBe(true);
    await fixture.source.save();
    const before = fixture.project.read();
    const workspace = fixture.writes[0]?.workspace;
    if (workspace === undefined) throw new Error("Missing saved workspace.");
    const invalid = JSON.parse(JSON.stringify(workspace)) as {
      projects: {
        record: { designSystem: { recipeGraph: { definitions: { root: { use: string } }[] } } };
      }[];
    };
    const definition = invalid.projects[0]?.record.designSystem.recipeGraph.definitions[0];
    if (definition === undefined) throw new Error("Missing master.");
    definition.root.use = "foreign.ui/Unknown";
    fixture.setStored(invalid, 2);
    expect((await fixture.source.open()).status).toBe("failed");
    expect(fixture.project.read().session).toBe(before.session);
    expect(fixture.project.read().history).toBe(before.history);
    expect(fixture.source.read().generation).toBe(1);
  });

  it("rejects forged controllers, standalone Source ports and a different lifecycle pairing", () => {
    const fixture = setup();
    expect(
      createAuthoringPersistenceController({
        ...fixture.options,
        projectAuthoringController: { ...fixture.project },
      }),
    ).toEqual({ ok: false, reason: "profile-invalid" });
    expect(
      createAuthoringPersistenceController({
        ...fixture.options,
        persistencePort: { ...fixture.options.persistencePort },
      }),
    ).toEqual({ ok: false, reason: "port-invalid" });
    const other = setup();
    expect(
      createProjectWorkspaceAuthoringPersistencePort({
        ...fixture.bridgeOptions,
        lifecycle: other.lifecycle,
      }),
    ).toEqual({ ok: false });
  });
});
