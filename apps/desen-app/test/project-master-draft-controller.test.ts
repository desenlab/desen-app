import { afterEach, describe, expect, it } from "vitest";
import { setDesenEditorOwnerProp } from "@desen/editor-core";

import { createProjectMasterDraftController } from "../src/project-master-draft-controller.js";
import { STARTER_NEUTRAL_WORKSPACE_PROFILE } from "../src/starter-neutral-workspace-profile.js";
import { createProjectAuthoringFixture } from "./project-authoring-fixture.js";

import type { ProjectMasterDraftController } from "../src/project-master-draft-controller.js";
import type { ProjectAuthoringTestFixture } from "./project-authoring-fixture.js";
import type { ProjectAuthoringResult } from "../src/project-authoring-controller.js";
import type { ProjectWorkspaceSaveResult } from "../src/project-lifecycle.js";

const lifetimes: (() => void)[] = [];
afterEach(() => {
  for (const dispose of lifetimes.splice(0).reverse()) dispose();
});

async function fixture(): Promise<ProjectAuthoringTestFixture> {
  const value = createProjectAuthoringFixture();
  lifetimes.push(() => {
    value.source.dispose();
    value.project.dispose();
    value.lifecycle.dispose();
  });
  expect(value.addMaster().ok).toBe(true);
  const root = value.project.read().session.document.surfaces.start?.root;
  if (root === undefined) throw new Error("Missing fixture root.");
  expect(
    value.project.applyRecipe({
      type: "instance.insert",
      masterId: "title",
      instanceId: "title",
      expectedProjectDigest: value.project.read().session.digest,
      destination: { surfaceId: "start", parentId: root.id, slot: "default", index: 0 },
    }).ok,
  ).toBe(true);
  expect((await value.source.save()).status).toBe("created");
  return value;
}

function open(value: ProjectAuthoringTestFixture): ProjectMasterDraftController {
  const result = createProjectMasterDraftController(
    value.project,
    value.options.profile,
    "title",
    "start",
    value.project.read().session.digest,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  lifetimes.push(result.controller.dispose);
  return result.controller;
}

function textEdit(draft: ProjectMasterDraftController, text: string): ProjectAuthoringResult {
  const state = draft.read();
  const edit = setDesenEditorOwnerProp(state.session.document, {
    surfaceId: "start",
    ownerId: "label",
    name: "text",
    value: text,
  });
  if (!edit.ok) throw new Error("Invalid fixture edit.");
  return draft.replaceSource(state.session.digest, edit.document);
}

describe("visual master draft controller", () => {
  it("preflights isolated edits, undo/redo and applies exactly one live history step before save/reopen", async () => {
    const value = await fixture();
    const before = value.project.read();
    const draft = open(value);
    expect(draft.read().session.record).toBe(draft.read().history.record);
    expect(textEdit(draft, "Changed master").ok).toBe(true);
    const edited = draft.read();
    expect(edited.dirty).toBe(true);
    expect(edited.session.preview.ok).toBe(true);
    expect(value.project.read().session).toBe(before.session);
    expect(value.project.read().history).toBe(before.history);
    expect(value.project.captureForSave(edited.session.document)).toBeNull();
    expect(value.writes).toHaveLength(1);
    expect(draft.undo(edited.session.digest).ok).toBe(true);
    expect(draft.read().dirty).toBe(false);
    expect(draft.redo(draft.read().session.digest).ok).toBe(true);
    expect(draft.read().session.record).toEqual(edited.session.record);
    expect(draft.apply(edited.session.digest).ok).toBe(true);
    expect(draft.read().disposed).toBe(true);
    const applied = value.project.read();
    expect(applied.history.past.length).toBe(before.history.past.length + 1);
    expect(applied.session.document.surfaces.start?.root.slots?.default?.[0]?.props?.text).toBe(
      "Changed master",
    );
    expect(value.writes).toHaveLength(1);
    expect(value.project.undo(applied.session.digest).ok).toBe(true);
    expect(value.project.read().session.record).toEqual(before.session.record);
    expect(value.project.read().dirty).toBe(false);
    expect(value.project.redo(value.project.read().session.digest).ok).toBe(true);
    expect((await value.source.save()).status).toBe("updated");
    expect((await value.source.open()).status).toBe("opened");
    expect(value.project.read().session.record).toEqual(applied.session.record);
  });

  it("discards only the isolated draft and preserves pre-existing unsaved live edits", async () => {
    const value = await fixture();
    const current = value.project.read();
    const changed = setDesenEditorOwnerProp(current.session.document, {
      surfaceId: "result",
      ownerId: "result.layout",
      name: "gap",
      value: "lg",
    });
    if (!changed.ok) throw new Error("Invalid fixture edit.");
    expect(value.project.replaceSource(current.session.digest, changed.document).ok).toBe(true);
    const before = value.project.read();
    const draft = open(value);
    expect(textEdit(draft, "Not applied").ok).toBe(true);
    draft.dispose();
    expect(value.project.read()).toBe(before);
    expect(before.dirty).toBe(true);
    expect(draft.apply(draft.read().session.digest)).toEqual({ ok: false, reason: "disposed" });
    expect(value.writes).toHaveLength(1);
  });

  it("rejects foreign edits and removal of an overridden conceptual owner", async () => {
    const value = await fixture();
    expect(
      value.project.applyRecipe({
        type: "instance.override",
        instanceId: "title",
        expectedProjectDigest: value.project.read().session.digest,
        override: {
          owner: { path: [], definitionId: "title", kind: "node", id: "label" },
          property: { kind: "prop", name: "text" },
          value: "Local",
        },
      }).ok,
    ).toBe(true);
    const draft = open(value);
    const before = draft.read();
    const source = before.session.document;
    const start = source.surfaces.start;
    if (start === undefined) throw new Error("Missing editing surface.");
    const replacement = {
      ...source,
      surfaces: {
        ...source.surfaces,
        start: { ...start, root: { ...start.root, id: "newLabel" } },
      },
    };
    expect(draft.replaceSource(before.session.digest, replacement).ok).toBe(false);
    const foreign = setDesenEditorOwnerProp(source, {
      surfaceId: "result",
      ownerId: "result.layout",
      name: "gap",
      value: "lg",
    });
    if (!foreign.ok) throw new Error("Invalid fixture edit.");
    expect(draft.replaceSource(before.session.digest, foreign.document).ok).toBe(false);
    expect(
      draft.applyRecipe({
        type: "master.delete",
        masterId: "title",
        expectedProjectDigest: before.session.digest,
      }).ok,
    ).toBe(false);
    expect(
      draft.applyRecipe({
        type: "instance.insert",
        masterId: "title",
        instanceId: "foreign",
        expectedProjectDigest: before.session.digest,
        destination: { surfaceId: "result", parentId: "result.layout", slot: "default", index: 0 },
      }).ok,
    ).toBe(false);
    expect(draft.read()).toBe(before);
    expect(value.writes).toHaveLength(1);
  });

  it("preserves the draft on stale live replacement and rejects foreign profile authority", async () => {
    const value = await fixture();
    const draft = open(value);
    expect(textEdit(draft, "Draft").ok).toBe(true);
    const before = draft.read();
    expect(
      createProjectMasterDraftController(
        value.project,
        STARTER_NEUTRAL_WORKSPACE_PROFILE,
        "title",
        "start",
        value.project.read().session.digest,
      ),
    ).toEqual({ ok: false, reason: "profile-invalid" });
    expect(
      value.project.applyRecipe({
        type: "instance.detach",
        instanceId: "title",
        expectedProjectDigest: value.project.read().session.digest,
      }).ok,
    ).toBe(true);
    const live = value.project.read();
    expect(draft.read().unavailable).toBe(true);
    expect(draft.read().session).toBe(before.session);
    expect(draft.apply(before.session.digest)).toEqual({ ok: false, reason: "project-stale" });
    expect(value.project.read()).toBe(live);
  });

  it("shares lifecycle locks without losing the draft and fences reentrant observers", async () => {
    const value = await fixture();
    const draft = open(value);
    let release: ((result: ProjectWorkspaceSaveResult) => void) | undefined;
    value.setSave(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const reentrant: ProjectAuthoringResult[] = [];
    const unsubscribe = draft.subscribe(() => {
      reentrant.push(textEdit(draft, "Reentrant"));
    });
    const saved = value.source.save();
    expect(draft.read().pending).toBe("saving");
    expect(textEdit(draft, "During save")).toEqual({ ok: false, reason: "operation-in-progress" });
    if (release === undefined) throw new Error("Missing pending write.");
    release({ status: "updated", generation: 2 });
    await saved;
    expect(draft.read().pending).toBeNull();
    expect(textEdit(draft, "After save").ok).toBe(true);
    expect(reentrant.length).toBeGreaterThan(0);
    expect(reentrant.every((result) => !result.ok)).toBe(true);
    unsubscribe();
    expect(draft.read().history.past).toHaveLength(1);
  });

  it("contains hostile command reflection without changing the draft", async () => {
    const value = await fixture();
    const draft = open(value);
    const before = draft.read();
    expect(
      draft.applyRecipe(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error("Unsafe command");
            },
          },
        ),
      ).ok,
    ).toBe(false);
    let reads = 0;
    expect(
      draft.applyRecipe({
        get type() {
          reads++;
          return "instance.detach";
        },
      }).ok,
    ).toBe(false);
    expect(reads).toBe(0);
    expect(draft.read()).toBe(before);
  });
});
