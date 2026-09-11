import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { migrateEditableProjectRecord } from "../src/project-migrations.js";

function project(order: "forward" | "reverse" = "forward"): Record<string, unknown> {
  const designSystem = {
    tokenSources: [
      {
        id: "base",
        document: {
          spacing: { $type: "dimension", md: { $value: { value: 1, unit: "rem" } } },
        },
      },
    ],
    recipes: [],
    assets: [],
  };
  const entries: readonly (readonly [string, unknown])[] = [
    ["kind", "desen.editable-project"],
    ["schemaVersion", 1],
    ["id", "project.round-trip"],
    ["source", JSON.parse(JSON.stringify(validSource))],
    ["designSystem", designSystem],
    ["connectionIntents", []],
    ["extensions", { "run.desen.roundtrip": { unicode: "İstanbul 雪 😀", retained: true } }],
  ];
  return Object.fromEntries(order === "forward" ? entries : [...entries].reverse());
}

describe("migrateEditableProjectRecord", () => {
  it("uses an explicit v1 identity migration with a loss-aware canonical round trip", () => {
    const first = migrateEditableProjectRecord(project("forward"));
    const second = migrateEditableProjectRecord(project("reverse"));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new TypeError("Expected v1 identity migration.");
    expect(first).toEqual(
      expect.objectContaining({
        fromSchemaVersion: 1,
        toSchemaVersion: 1,
        migrated: false,
        changes: [],
        losses: [],
        diagnostics: [],
      }),
    );
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const reopened = migrateEditableProjectRecord(JSON.parse(first.canonicalJson) as unknown);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new TypeError("Expected canonical reimport.");
    expect(reopened.record).toEqual(first.record);
    expect(reopened.canonicalJson).toBe(first.canonicalJson);
    expect(reopened.losses).toEqual([]);
  });

  it("rejects legacy and future versions without claiming a fictional migration", () => {
    for (const schemaVersion of [0, 2, "1"]) {
      const candidate = project();
      candidate.schemaVersion = schemaVersion;
      const result = migrateEditableProjectRecord(candidate);
      expect(result.ok).toBe(false);
      if (result.ok) throw new TypeError("Expected a closed migration registry.");
      expect(result.diagnostics[0]?.code).toBe("UNSUPPORTED_PROJECT_VERSION");
      expect(Object.hasOwn(result, "record")).toBe(false);
      expect(Object.hasOwn(result, "canonicalJson")).toBe(false);
    }
  });

  it("dispatches an unknown future root by version before applying the v1 field shape", () => {
    const result = migrateEditableProjectRecord({
      kind: "desen.editable-project",
      schemaVersion: 2,
      futureEnvelope: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected future schema rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_PROJECT_VERSION",
        pointer: "/schemaVersion",
      }),
    );
    expect(Object.hasOwn(result, "record")).toBe(false);
    expect(Object.hasOwn(result, "canonicalJson")).toBe(false);
  });
});
