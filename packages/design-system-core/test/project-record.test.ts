import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import { admitEditableProjectRecord, EDITABLE_PROJECT_LIMITS } from "../src/project-record.js";

type MutableRecord = Record<string, unknown>;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function fixture(): MutableRecord {
  return {
    kind: "desen.editable-project",
    schemaVersion: 1,
    id: "project.sign-in",
    source: clone(validSource),
    designSystem: {
      tokenSources: [
        {
          id: "neutral.base",
          description: "Neutral base",
          document: {
            color: {
              $type: "color",
              text: {
                $value: {
                  colorSpace: "srgb",
                  components: [0, 0, 0],
                  alpha: 1,
                },
              },
            },
            $extensions: { "run.desen.fixture": { retained: true } },
          },
          extensions: { "run.desen.source": { retained: true } },
        },
      ],
      recipes: [
        {
          id: "recipe.card",
          name: "Card",
          description: "Metadata only",
          extensions: { "run.desen.recipe": { retained: true } },
        },
      ],
      assets: [
        {
          id: "asset.logo",
          name: "Logo",
          kind: "image",
          mediaType: "image/png",
          extensions: { "run.desen.asset": { retained: true } },
        },
      ],
      extensions: { "run.desen.system": { retained: true } },
    },
    connectionIntents: [
      {
        id: "intent.submit",
        status: "draft",
        surfaceId: "sign-in",
        nodeId: "sign-in.submit",
        label: "Later wiring",
        note: "No operation authority yet.",
        extensions: { "run.desen.intent": { retained: true } },
      },
    ],
    extensions: { "run.desen.project": { retained: true } },
  };
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

describe("admitEditableProjectRecord", () => {
  it("admits one detached, immutable App-owned envelope without changing Source bytes", () => {
    const input = fixture();
    const result = admitEditableProjectRecord(input);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected a valid editable project.");
    expect(result.record.kind).toBe("desen.editable-project");
    expect(result.record.schemaVersion).toBe(1);
    expect(result.record.source).toEqual(validSource);
    expect(result.record.source).not.toBe(input.source);
    expect(result.record.designSystem.tokenSources[0]?.document.$extensions).toEqual({
      "run.desen.fixture": { retained: true },
    });
    expect(result.record.connectionIntents[0]?.status).toBe("draft");
    expect(result.diagnostics).toEqual([]);
    expectDeepFrozen(result);

    input.id = "caller-mutated";
    expect(result.record.id).toBe("project.sign-in");
    expect(Object.isFrozen(input)).toBe(false);
  });

  it("rejects invalid Source and exposes no partial record", () => {
    const input = fixture();
    (input.source as MutableRecord).kind = "desen.bundle";
    const result = admitEditableProjectRecord(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected invalid Source rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ code: "INVALID_SOURCE", pointer: "/source/kind" }),
    );
    expect(Object.hasOwn(result, "record")).toBe(false);
    expectDeepFrozen(result);
  });

  it("rejects unknown fields, duplicate identities and executable connection states", () => {
    const unknown = fixture();
    unknown.storageGeneration = 1;
    expect(admitEditableProjectRecord(unknown)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [expect.objectContaining({ code: "INVALID_PROJECT", pointer: "" })],
      }),
    );

    const duplicate = fixture();
    const designSystem = duplicate.designSystem as MutableRecord;
    designSystem.assets = [
      { id: "asset.same", name: "A", kind: "image" },
      { id: "asset.same", name: "B", kind: "image" },
    ];
    expect(admitEditableProjectRecord(duplicate)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "INVALID_PROJECT", pointer: "/designSystem/assets" }),
        ],
      }),
    );

    const executable = fixture();
    (executable.connectionIntents as MutableRecord[])[0] = {
      id: "intent.bad",
      status: "ready",
      surfaceId: "sign-in",
      handler: "fetch('/hidden')",
    };
    expect(admitEditableProjectRecord(executable)).toEqual(
      expect.objectContaining({
        ok: false,
        diagnostics: [
          expect.objectContaining({ code: "INVALID_PROJECT", pointer: "/connectionIntents" }),
        ],
      }),
    );
  });

  it("rejects active, exotic, cyclic, sparse and non-finite input safely", () => {
    let getterInvocations = 0;
    const accessor = fixture();
    Object.defineProperty(accessor, "active", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return true;
      },
    });
    const custom = Object.assign(Object.create({ inherited: true }) as MutableRecord, fixture());
    const cyclic = fixture();
    cyclic.extensions = { self: cyclic };
    const sparse = fixture();
    (sparse.designSystem as MutableRecord).recipes = new Array(1);
    const nonFinite = fixture();
    nonFinite.extensions = { value: Number.POSITIVE_INFINITY };

    for (const input of [accessor, custom, cyclic, sparse, nonFinite]) {
      const result = admitEditableProjectRecord(input);
      expect(result.ok).toBe(false);
      if (result.ok) throw new TypeError("Expected unsafe project rejection.");
      expect(Object.hasOwn(result, "record")).toBe(false);
    }
    expect(getterInvocations).toBe(0);
  });

  it("bounds aggregate canonical bytes before producing a detached project", () => {
    const oversized = fixture();
    oversized.extensions = {
      chunks: Array.from({ length: 33 }, () => "x".repeat(262_144)),
    };

    const result = admitEditableProjectRecord(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected aggregate project-byte rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ code: "PROJECT_LIMIT_EXCEEDED" }),
    );
    expect(Object.hasOwn(result, "record")).toBe(false);
  });

  it("turns throwing and revoked Proxy containers into controlled failures", () => {
    let trapInvocations = 0;
    const throwing = new Proxy(fixture(), {
      ownKeys() {
        trapInvocations += 1;
        throw new Error("caller trap");
      },
    });
    const revocable = Proxy.revocable(fixture(), {});
    revocable.revoke();

    for (const input of [throwing, revocable.proxy]) {
      expect(() => admitEditableProjectRecord(input)).not.toThrow();
      const result = admitEditableProjectRecord(input);
      expect(result.ok).toBe(false);
      if (result.ok) throw new TypeError("Expected Proxy project rejection.");
      expect(result.diagnostics[0]?.code).toBe("UNSAFE_PROJECT_VALUE");
      expect(Object.hasOwn(result, "record")).toBe(false);
    }
    expect(trapInvocations).toBe(2);
  });

  it("enforces finite collection limits and rejects unknown schema versions", () => {
    const oversized = fixture();
    (oversized.designSystem as MutableRecord).assets = Array.from(
      { length: EDITABLE_PROJECT_LIMITS.maxAssets + 1 },
      (_, index) => ({ id: `asset.${index}`, name: "Asset", kind: "image" }),
    );
    const oversizedResult = admitEditableProjectRecord(oversized);
    expect(oversizedResult.ok).toBe(false);
    if (oversizedResult.ok) throw new TypeError("Expected collection limit rejection.");
    expect(oversizedResult.diagnostics[0]).toEqual(
      expect.objectContaining({ code: "INVALID_PROJECT", pointer: "/designSystem/assets" }),
    );

    const future = fixture();
    future.schemaVersion = 2;
    const futureResult = admitEditableProjectRecord(future);
    expect(futureResult.ok).toBe(false);
    if (futureResult.ok) throw new TypeError("Expected version rejection.");
    expect(futureResult.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_PROJECT_VERSION",
        pointer: "/schemaVersion",
      }),
    );
  });
});
