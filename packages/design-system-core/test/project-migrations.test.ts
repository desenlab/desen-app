import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "@desen/protocol";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  migrateEditableProjectRecord,
  SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS,
} from "../src/project-migrations.js";

function project(order: "forward" | "reverse" = "forward"): Record<string, unknown> {
  const designSystem = {
    tokenSources: [
      {
        id: "base",
        document: {
          spacing: { $type: "dimension", md: { $value: { value: 1, unit: "rem" } } },
          $extensions: { "run.desen.token-document": { retained: true } },
        },
        extensions: { "run.desen.source": { retained: true } },
      },
    ],
    recipes: [
      {
        id: "legacy.recipe",
        name: "Historical inert metadata",
        extensions: {
          "run.desen.recipe": {
            instanceOf: "not-a-graph-reference",
            definitions: [{ not: "a valid definition" }],
          },
        },
      },
    ],
    assets: [{ id: "logo", name: "Logo", kind: "image", extensions: { retained: true } }],
    extensions: { "run.desen.design-system": { retained: true } },
  };
  const entries: readonly (readonly [string, unknown])[] = [
    ["kind", "desen.editable-project"],
    ["schemaVersion", 1],
    ["id", "project.round-trip"],
    ["source", JSON.parse(JSON.stringify(validSource))],
    ["designSystem", designSystem],
    [
      "connectionIntents",
      [{ id: "intent", status: "draft", surfaceId: "sign-in", extensions: { retained: true } }],
    ],
    ["extensions", { "run.desen.roundtrip": { unicode: "İstanbul 雪 😀", retained: true } }],
  ];
  return Object.fromEntries(order === "forward" ? entries : [...entries].reverse());
}

describe("migrateEditableProjectRecord", () => {
  it("converts exact v1 by only changing its version and adding an empty graph", () => {
    const input = project("forward");
    const before = canonicalizeJson(input);
    const first = migrateEditableProjectRecord(input);
    const second = migrateEditableProjectRecord(project("reverse"));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new TypeError("Expected lossless v1 conversion.");
    expect(first).toEqual(
      expect.objectContaining({
        fromSchemaVersion: 1,
        toSchemaVersion: 2,
        migrated: true,
        changes: [
          { code: "SCHEMA_VERSION_UPDATED", pointer: "/schemaVersion", from: 1, to: 2 },
          { code: "RECIPE_GRAPH_ADDED", pointer: "/designSystem/recipeGraph" },
        ],
        losses: [],
        diagnostics: [],
      }),
    );
    expect(first.canonicalJson).toBe(second.canonicalJson);
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(canonicalizeJson(input)).toBe(before);
    expect(first.canonicalJson).toBe(
      canonicalizeJson({
        ...input,
        schemaVersion: 2,
        designSystem: {
          ...(input.designSystem as Record<string, unknown>),
          recipeGraph: { definitions: [], instances: [] },
        },
      }),
    );
    expect(first.record.source).not.toBe(input.source);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(first.changes[0])).toBe(true);
    expect(Object.isFrozen(first.record.designSystem.recipeGraph.definitions)).toBe(true);

    const reopened = migrateEditableProjectRecord(JSON.parse(first.canonicalJson) as unknown);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new TypeError("Expected canonical reimport.");
    expect(reopened.record).toEqual(first.record);
    expect(reopened.canonicalJson).toBe(first.canonicalJson);
    expect(reopened.losses).toEqual([]);
    expect(reopened).toEqual(
      expect.objectContaining({
        fromSchemaVersion: 2,
        toSchemaVersion: 2,
        migrated: false,
        changes: [],
      }),
    );
  });

  it("keeps the current v2 path byte-equivalent and reports no transformations", () => {
    const input = project();
    input.schemaVersion = 2;
    (input.designSystem as Record<string, unknown>).recipeGraph = {
      definitions: [
        {
          id: "label",
          name: "Reusable label",
          root: {
            kind: "node",
            id: "text",
            use: "com.example.ui/Text",
            props: { text: "Preserved current master" },
          },
          state: {},
          resources: {},
        },
      ],
      instances: [],
    };
    const result = migrateEditableProjectRecord(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected current version identity admission.");
    expect(result.canonicalJson).toBe(canonicalizeJson(input));
    expect(result).toEqual(
      expect.objectContaining({
        fromSchemaVersion: 2,
        toSchemaVersion: 2,
        migrated: false,
        changes: [],
        losses: [],
      }),
    );
    expect(SUPPORTED_EDITABLE_PROJECT_SCHEMA_VERSIONS).toEqual([1, 2]);
  });

  it("rejects unsupported versions without claiming a fictional migration", () => {
    for (const schemaVersion of [0, 3, "1", "2"]) {
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

  it("dispatches an unknown future root by version before applying a known field shape", () => {
    const result = migrateEditableProjectRecord({
      kind: "desen.editable-project",
      schemaVersion: 3,
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

  it("never reinterprets graph data smuggled into v1 or repairs malformed known envelopes", () => {
    const graphInV1 = project();
    (graphInV1.designSystem as Record<string, unknown>).recipeGraph = {
      definitions: [],
      instances: [],
    };
    const missingV2Graph = project();
    missingV2Graph.schemaVersion = 2;
    const invalidSource = project();
    (invalidSource.source as Record<string, unknown>).kind = "desen.bundle";

    for (const input of [graphInV1, missingV2Graph, invalidSource]) {
      const before = canonicalizeJson(input);
      const result = migrateEditableProjectRecord(input);
      expect(result.ok).toBe(false);
      expect(Object.hasOwn(result, "record")).toBe(false);
      expect(Object.hasOwn(result, "canonicalJson")).toBe(false);
      expect(canonicalizeJson(input)).toBe(before);
    }
  });

  it("captures inert input before dispatch without invoking schema-version accessors", () => {
    let invocations = 0;
    const accessor = project();
    Object.defineProperty(accessor, "schemaVersion", {
      enumerable: true,
      get() {
        invocations += 1;
        return 1;
      },
    });
    const futureAccessor = { kind: "desen.editable-project", schemaVersion: 3 };
    Object.defineProperty(futureAccessor, "futureField", {
      enumerable: true,
      get() {
        invocations += 1;
        return true;
      },
    });
    const cyclic = project();
    cyclic.extensions = { self: cyclic };
    const exotic = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      project(),
    );
    const sparse = project();
    (sparse.designSystem as Record<string, unknown>).recipes = new Array(1);
    const revocable = Proxy.revocable(project(), {});
    revocable.revoke();

    for (const input of [accessor, futureAccessor, cyclic, exotic, sparse, revocable.proxy]) {
      expect(() => migrateEditableProjectRecord(input)).not.toThrow();
      const result = migrateEditableProjectRecord(input);
      expect(result.ok).toBe(false);
      expect(Object.hasOwn(result, "record")).toBe(false);
      expect(Object.hasOwn(result, "canonicalJson")).toBe(false);
    }
    expect(invocations).toBe(0);
  });
});
