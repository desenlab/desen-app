import { canonicalizeJsonBytes } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  createEditableProjectHistory,
  EDITABLE_PROJECT_HISTORY_LIMITS,
  recordEditableProjectHistory,
  redoEditableProjectHistory,
  undoEditableProjectHistory,
} from "../src/project-history.js";

import type {
  EditableProjectHistory,
  EditableProjectHistoryResult,
} from "../src/project-history.js";

type MutableRecord = Record<string, unknown>;

function fixture(note = "Initial authoring note"): MutableRecord {
  return {
    kind: "desen.editable-project",
    schemaVersion: 2,
    id: "project.history",
    source: JSON.parse(JSON.stringify(validSource)) as unknown,
    designSystem: {
      tokenSources: [],
      recipes: [],
      assets: [],
      recipeGraph: { definitions: [], instances: [] },
    },
    connectionIntents: [{ id: "intent.submit", status: "draft", surfaceId: "sign-in", note }],
  };
}

function created(candidate: unknown = fixture(), limit?: number): EditableProjectHistory {
  const history = createEditableProjectHistory(candidate, limit);
  if (history === undefined) throw new TypeError("Expected an admitted project history.");
  return history;
}

function transitioned(result: EditableProjectHistoryResult): EditableProjectHistory {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected an admitted history transition.");
  return result.history;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null) continue;
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

function retainedByteCount(history: EditableProjectHistory): number {
  return [
    history.record,
    ...history.past.map(({ record }) => record),
    ...history.future.map(({ record }) => record),
  ].reduce((total, record) => total + canonicalizeJsonBytes(record).byteLength, 0);
}

describe("complete editable-project history", () => {
  it("captures a detached immutable aggregate and its complete canonical byte count", () => {
    const input = fixture();
    const history = created(input);

    expect(history.record).toEqual(input);
    expect(history.record).not.toBe(input);
    expect(history.record.source).not.toBe(input.source);
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(history.limit).toBe(100);
    expect(history.retainedBytes).toBe(canonicalizeJsonBytes(input).byteLength);
    expectDeepFrozen(history);

    input.id = "caller.changed";
    expect(history.record.id).toBe("project.history");
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("undoes and redoes metadata-only changes even while Source stays byte-identical", () => {
    const initial = created();
    const sourceBytes = canonicalizeJsonBytes(initial.record.source);
    const changed = transitioned(recordEditableProjectHistory(initial, fixture("A later note")));

    expect(changed.past).toHaveLength(1);
    expect(changed.past[0]?.record).toBe(initial.record);
    expect(changed.record.connectionIntents[0]?.note).toBe("A later note");
    expect(canonicalizeJsonBytes(changed.record.source)).toEqual(sourceBytes);
    expect(initial.past).toEqual([]);
    expect(initial.record.connectionIntents[0]?.note).toBe("Initial authoring note");

    const undone = transitioned(undoEditableProjectHistory(changed));
    expect(undone.record).toBe(initial.record);
    expect(undone.future[0]?.record).toBe(changed.record);
    expect(undone.retainedBytes).toBe(changed.retainedBytes);
    const redone = transitioned(redoEditableProjectHistory(undone));
    expect(redone.record).toBe(changed.record);
    expect(redone.future).toEqual([]);
    expect(redone.retainedBytes).toBe(retainedByteCount(redone));
    expectDeepFrozen(redone);
  });

  it("restores Source and authoring metadata together in one transition", () => {
    const initial = created();
    const candidate = fixture("Source and metadata changed together");
    (candidate.source as MutableRecord).authoring = { canvas: { changed: true } };
    const changed = transitioned(recordEditableProjectHistory(initial, candidate));
    expect(changed.record.source).not.toEqual(initial.record.source);
    const undone = transitioned(undoEditableProjectHistory(changed));
    expect(canonicalizeJsonBytes(undone.record)).toEqual(canonicalizeJsonBytes(initial.record));
    const redone = transitioned(redoEditableProjectHistory(undone));
    expect(canonicalizeJsonBytes(redone.record)).toEqual(canonicalizeJsonBytes(candidate));
  });

  it("keeps the exact history and redo branch for a canonical whole-project no-op", () => {
    const initial = created();
    const changed = transitioned(recordEditableProjectHistory(initial, fixture("Changed")));
    const undone = transitioned(undoEditableProjectHistory(changed));
    const reordered = Object.fromEntries(Object.entries(fixture()).reverse());
    const result = recordEditableProjectHistory(undone, reordered);

    expect(result).toEqual({ ok: true, changed: false, history: undone });
    expect(result.history).toBe(undone);
    expect(result.history.future[0]?.record).toBe(changed.record);
    expect(transitioned(redoEditableProjectHistory(result.history)).record).toBe(changed.record);
  });

  it("clears redo only after a valid new edit and preserves earlier immutable branches", () => {
    const initial = created();
    const second = transitioned(recordEditableProjectHistory(initial, fixture("Second")));
    const third = transitioned(recordEditableProjectHistory(second, fixture("Third")));
    const undone = transitioned(undoEditableProjectHistory(third));
    const branch = transitioned(recordEditableProjectHistory(undone, fixture("New branch")));

    expect(branch.future).toEqual([]);
    expect(branch.past.map(({ record }) => record.connectionIntents[0]?.note)).toEqual([
      "Initial authoring note",
      "Second",
    ]);
    expect(undone.future[0]?.record).toBe(third.record);
    expect(transitioned(redoEditableProjectHistory(undone)).record).toBe(third.record);
    expect(branch.retainedBytes).toBe(retainedByteCount(branch));
  });

  it("returns the unchanged history for empty undo and redo", () => {
    const initial = created();
    for (const transition of [undoEditableProjectHistory, redoEditableProjectHistory]) {
      const result = transition(initial);
      expect(result.ok).toBe(false);
      expect(result.history).toBe(initial);
      if (result.ok) throw new TypeError("Expected an empty-history rejection.");
      expect(result.diagnostics[0].code).toBe("HISTORY_EMPTY");
      expectDeepFrozen(result);
    }
  });

  it("bounds retained past entries and preserves the limit through undo and redo", () => {
    const initial = created(fixture("First"), 2);
    const second = transitioned(recordEditableProjectHistory(initial, fixture("Second")));
    const third = transitioned(recordEditableProjectHistory(second, fixture("Third")));
    const fourth = transitioned(recordEditableProjectHistory(third, fixture("Fourth")));

    expect(fourth.past.map(({ record }) => record.connectionIntents[0]?.note)).toEqual([
      "Second",
      "Third",
    ]);
    const firstUndo = transitioned(undoEditableProjectHistory(fourth));
    const secondUndo = transitioned(undoEditableProjectHistory(firstUndo));
    expect(secondUndo.record.connectionIntents[0]?.note).toBe("Second");
    expect(secondUndo.future).toHaveLength(2);
    expect(undoEditableProjectHistory(secondUndo).ok).toBe(false);
    const firstRedo = transitioned(redoEditableProjectHistory(secondUndo));
    const secondRedo = transitioned(redoEditableProjectHistory(firstRedo));
    expect(secondRedo.record).toBe(fourth.record);
    expect(secondRedo.retainedBytes).toBe(fourth.retainedBytes);
    expect(secondRedo.past).toHaveLength(2);
  });

  it.each([0, -1, 1.5, 513, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid history limit %s before inspecting the candidate",
    (limit) => {
      let reads = 0;
      const candidate = {
        get kind() {
          reads += 1;
          return "desen.editable-project";
        },
      };
      expect(createEditableProjectHistory(candidate, limit)).toBeUndefined();
      expect(reads).toBe(0);
    },
  );

  it("accepts both finite history-limit endpoints", () => {
    expect(created(fixture(), 1).limit).toBe(1);
    expect(created(fixture(), EDITABLE_PROJECT_HISTORY_LIMITS.maxEntries).limit).toBe(512);
  });

  it("rejects invalid records and project-identity replacement without losing redo", () => {
    const initial = created();
    const changed = transitioned(recordEditableProjectHistory(initial, fixture("Changed")));
    const undone = transitioned(undoEditableProjectHistory(changed));
    const invalid = fixture();
    invalid.source = { kind: "desen.bundle" };
    const foreign = fixture();
    foreign.id = "project.foreign";

    expect(createEditableProjectHistory(invalid)).toBeUndefined();
    for (const [candidate, expectedCode] of [
      [invalid, "HISTORY_RECORD_INVALID"],
      [foreign, "HISTORY_PROJECT_MISMATCH"],
    ] as const) {
      const result = recordEditableProjectHistory(undone, candidate);
      expect(result.ok).toBe(false);
      expect(result.history).toBe(undone);
      if (result.ok) throw new TypeError("Expected record rejection.");
      expect(result.diagnostics[0].code).toBe(expectedCode);
      expect(transitioned(redoEditableProjectHistory(result.history)).record).toBe(changed.record);
    }
  });

  it("rejects active input without invoking its getter or changing the current history", () => {
    const initial = created();
    let reads = 0;
    const candidate = fixture();
    Object.defineProperty(candidate, "extensions", {
      enumerable: true,
      get() {
        reads += 1;
        return { active: true };
      },
    });

    expect(createEditableProjectHistory(candidate)).toBeUndefined();
    const result = recordEditableProjectHistory(initial, candidate);
    expect(result.ok).toBe(false);
    expect(result.history).toBe(initial);
    expect(reads).toBe(0);
  });

  it("rejects forged, serialized, active and revoked histories before reading their members", () => {
    const initial = created();
    let reads = 0;
    const active = {
      get record() {
        reads += 1;
        throw new Error("History getter must not execute.");
      },
    };
    const revoked = Proxy.revocable(initial, {});
    revoked.revoke();
    const candidates = [
      { ...initial },
      JSON.parse(JSON.stringify(initial)) as unknown,
      active,
      revoked.proxy,
      null,
      42,
    ];
    for (const candidate of candidates) {
      const forged = candidate as EditableProjectHistory;
      for (const result of [
        recordEditableProjectHistory(forged, fixture("Ignored")),
        undoEditableProjectHistory(forged),
        redoEditableProjectHistory(forged),
      ]) {
        expect(result.ok).toBe(false);
        expect(result.history).toBe(forged);
        if (result.ok) throw new TypeError("Expected history-provenance rejection.");
        expect(result.diagnostics[0].code).toBe("HISTORY_STATE_INVALID");
      }
    }
    expect(reads).toBe(0);
  });

  it("rejects a throwing record proxy with a controlled unchanged-history result", () => {
    const initial = created();
    const candidate = new Proxy(fixture(), {
      ownKeys() {
        throw new Error("Caller-owned reflection failed.");
      },
    });
    expect(createEditableProjectHistory(candidate)).toBeUndefined();
    const result = recordEditableProjectHistory(initial, candidate);
    expect(result.ok).toBe(false);
    expect(result.history).toBe(initial);
  });

  it("evicts oldest snapshots when retained canonical bytes exceed the aggregate budget", () => {
    const large = fixture("Large snapshot 0");
    large.extensions = { chunks: Array.from({ length: 30 }, () => "x".repeat(262_144)) };
    let history = created(large);
    const recordBytes = history.retainedBytes;
    const fits = Math.floor(EDITABLE_PROJECT_HISTORY_LIMITS.maxRetainedBytes / recordBytes);
    expect(fits).toBeGreaterThan(1);

    for (let index = 1; index <= fits; index += 1) {
      history = transitioned(
        recordEditableProjectHistory(history, {
          ...large,
          connectionIntents: [
            {
              id: "intent.submit",
              status: "draft",
              surfaceId: "sign-in",
              note: `Large snapshot ${index}`,
            },
          ],
        }),
      );
    }
    expect(history.past).toHaveLength(fits - 1);
    expect(history.past[0]?.record.connectionIntents[0]?.note).toBe("Large snapshot 1");
    expect(history.record.connectionIntents[0]?.note).toBe(`Large snapshot ${fits}`);
    expect(history.retainedBytes).toBeLessThanOrEqual(
      EDITABLE_PROJECT_HISTORY_LIMITS.maxRetainedBytes,
    );
    expect(history.retainedBytes).toBe(recordBytes * fits);

    const undone = transitioned(undoEditableProjectHistory(history));
    expect(undone.retainedBytes).toBe(history.retainedBytes);
    expect(transitioned(redoEditableProjectHistory(undone)).record).toBe(history.record);
  }, 30_000);
});
