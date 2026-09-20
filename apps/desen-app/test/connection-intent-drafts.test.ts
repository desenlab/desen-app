import { describe, expect, it } from "vitest";

import {
  applyConnectionIntentDraft,
  createConnectionIntentDraft,
  discardConnectionIntentDraft,
  listConnectionIntentDrafts,
  listConnectionTargets,
  readConnectionIntentDraft,
  saveConnectionIntentDraft,
} from "../src/connection-intent-drafts.js";
import { createProjectAuthoringFixture } from "./project-authoring-fixture.js";

function form(fixture: ReturnType<typeof createProjectAuthoringFixture>, id = "intent.first") {
  const record = fixture.project.read().session.record;
  const surfaceId = Object.keys(record.source.surfaces)[0] ?? "";
  const target = listConnectionTargets(record.source, surfaceId)[0];
  if (target === undefined) throw new Error("Fixture has no Source target.");
  return {
    id,
    surfaceId,
    nodeId: target.id,
    label: "Later connection",
    note: "Keep this form inert until a later task.",
    candidate: { kind: "event" as const, name: "submit" },
  };
}

describe("Connections workspace inert drafts", () => {
  it("keeps a pending form beside unchanged valid Source and reopens it", () => {
    const fixture = createProjectAuthoringFixture();
    const before = fixture.project.read().session.record;
    const saved = saveConnectionIntentDraft(before, form(fixture));
    expect(saved).toEqual({ ok: true, record: expect.any(Object) });
    if (!saved.ok) throw new Error("Expected pending intent to save.");
    expect(saved.record.source).toEqual(before.source);
    expect(saved.record.connectionIntents[0]).toMatchObject({ status: "draft" });
    expect(listConnectionIntentDrafts(saved.record, form(fixture).surfaceId)).toEqual([
      expect.objectContaining({ phase: "pending", nodeId: form(fixture).nodeId }),
    ]);
    expect(readConnectionIntentDraft(saved.record, "intent.first")).toMatchObject({
      label: "Later connection",
      candidate: { kind: "event", name: "submit" },
    });
    fixture.project.dispose();
    fixture.lifecycle.dispose();
  });

  it("applies and discards independently without writing executable Source", () => {
    const fixture = createProjectAuthoringFixture();
    const before = fixture.project.read().session.record;
    const pending = saveConnectionIntentDraft(before, form(fixture));
    if (!pending.ok) throw new Error("Expected pending intent to save.");
    const applied = applyConnectionIntentDraft(pending.record, form(fixture));
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error("Expected inert intent to apply.");
    expect(listConnectionIntentDrafts(applied.record, form(fixture).surfaceId)[0]?.phase).toBe(
      "applied",
    );
    expect(applied.record.source).toEqual(before.source);
    const discarded = discardConnectionIntentDraft(applied.record, "intent.first");
    expect(discarded.ok).toBe(true);
    if (!discarded.ok) throw new Error("Expected intent to discard.");
    expect(discarded.record.connectionIntents).toEqual([]);
    expect(discarded.record.source).toEqual(before.source);
    fixture.project.dispose();
    fixture.lifecycle.dispose();
  });

  it("rejects stale targets and executable-looking candidates", () => {
    const fixture = createProjectAuthoringFixture();
    const before = fixture.project.read().session.record;
    const draft = form(fixture);
    expect(
      saveConnectionIntentDraft(before, {
        ...draft,
        nodeId: "node.no-longer-present",
      }),
    ).toEqual({ ok: false, reason: "stale-target" });
    expect(
      createConnectionIntentDraft({
        ...draft,
        candidate: { kind: "event", name: "submit", handler: "execute()" },
      }),
    ).toEqual({ ok: false, reason: "draft-invalid" });
    fixture.project.dispose();
    fixture.lifecycle.dispose();
  });
});
