import { describe, expect, it } from "vitest";

import { resolveDesignTokens } from "../src/token-resolver.js";

import type { DesignTokenResolutionRequest } from "../src/token-resolver.js";

const RED = { colorSpace: "srgb", components: [1, 0, 0] } as const;
const BLUE = { colorSpace: "srgb", components: [0, 0, 1] } as const;
const GREEN = { colorSpace: "srgb", components: [0, 1, 0] } as const;

function request(input: unknown): DesignTokenResolutionRequest {
  return input as DesignTokenResolutionRequest;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

describe("resolveDesignTokens", () => {
  it("overlays ordered sources before resolving aliases", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          description: "Base source",
          extensions: { "com.desen/context": "base" },
          document: {
            color: {
              $type: "color",
              brand: { $description: "Brand", $value: RED },
              action: { $value: "{color.brand}" },
            },
          },
        },
        {
          id: "mode.dark",
          document: { color: { $type: "color", brand: { $value: BLUE } } },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected selected sources to resolve.");
    expect(result.sourceIds).toEqual(["base", "mode.dark"]);
    expect(result.tokenPaths).toEqual(["color.action", "color.brand"]);
    expect(result.tokens["color.brand"]).toEqual(
      expect.objectContaining({
        aliasChain: [],
        origin: { kind: "source", sourceId: "mode.dark", sourceIndex: 1 },
        value: BLUE,
      }),
    );
    expect(result.tokens["color.action"]).toEqual(
      expect.objectContaining({
        aliasChain: ["color.brand"],
        metadata: {},
        origin: { kind: "source", sourceId: "base", sourceIndex: 0 },
        value: BLUE,
      }),
    );
    expectDeepFrozen(result);
  });

  it("infers an untyped base alias from a typed target introduced by a later source", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: { semantic: { action: { $value: "{palette.brand}" } } },
        },
        {
          id: "mode.dark",
          document: { palette: { $type: "color", brand: { $value: BLUE } } },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected complete-overlay alias type inference.");
    expect(result.tokens["semantic.action"]).toEqual(
      expect.objectContaining({
        aliasChain: ["palette.brand"],
        origin: { kind: "source", sourceId: "base", sourceIndex: 0 },
        type: "color",
        value: BLUE,
      }),
    );
    expect(result.tokens["palette.brand"]?.origin).toEqual({
      kind: "source",
      sourceId: "mode.dark",
      sourceIndex: 1,
    });
    expectDeepFrozen(result);
  });

  it("resolves an untyped alias from its target before a parent group type", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: {
            base: { $type: "number", $value: 1 },
            dimensionParent: {
              $type: "dimension",
              alias: { $value: "{base}" },
            },
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected reference-first DTCG type inference.");
    expect(result.tokens["dimensionParent.alias"]).toEqual(
      expect.objectContaining({ aliasChain: ["base"], type: "number", value: 1 }),
    );
  });

  it("applies literal overrides last and lets aliases observe them", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: {
            color: {
              $type: "color",
              action: { $value: "{color.brand}" },
              brand: { $description: "Retained metadata", $value: RED },
            },
          },
        },
      ],
      literalOverrides: [{ path: "color.brand", type: "color", value: GREEN }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected literal override resolution.");
    expect(result.tokens["color.brand"]).toEqual(
      expect.objectContaining({
        metadata: { $description: "Retained metadata" },
        origin: { kind: "literal-override", overrideIndex: 0 },
        value: GREEN,
      }),
    );
    expect(result.tokens["color.action"]?.value).toEqual(GREEN);
  });

  it("applies a literal override to every path admitted by the DTCG name grammar", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: { " leading": { $type: "number", $value: 1 } },
        },
      ],
      literalOverrides: [{ path: " leading", type: "number", value: 2 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected an existing DTCG path to be overrideable.");
    expect(result.tokens[" leading"]?.value).toBe(2);
  });

  it("is deterministic across input object key order", () => {
    const first = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: {
            z: { token: { $value: 1 }, $type: "number" },
            a: { token: { $value: 2 }, $type: "number" },
          },
        },
      ],
    });
    const second = resolveDesignTokens({
      sources: [
        {
          document: {
            a: { $type: "number", token: { $value: 2 } },
            z: { $type: "number", token: { $value: 1 } },
          },
          id: "base",
        },
      ],
    });
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("rejects alias cycles with no partial token map", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: {
            value: {
              $type: "number",
              a: { $value: "{value.b}" },
              b: { $value: "{value.a}" },
            },
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected cycle rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ code: "ALIAS_CYCLE", tokenPath: "value.a" }),
    );
    expect(Object.hasOwn(result, "tokens")).toBe(false);
  });

  it.each([
    [
      "missing target",
      { number: { $type: "number", a: { $value: "{number.missing}" } } },
      "ALIAS_TARGET_MISSING",
    ],
    [
      "type mismatch",
      {
        color: { $type: "color", a: { $type: "color", $value: "{number.a}" } },
        number: { $type: "number", a: { $value: 1 } },
      },
      "ALIAS_TYPE_MISMATCH",
    ],
  ])("rejects an alias with a %s", (_label, document, code) => {
    const result = resolveDesignTokens({ sources: [{ id: "base", document }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe(code);
  });

  it.each([
    [
      "missing target",
      [
        { id: "base", document: { alias: { $value: "{later.missing}" } } },
        {
          id: "mode",
          document: { later: { $type: "number", present: { $value: 1 } } },
        },
      ],
      "ALIAS_TARGET_MISSING",
    ],
    [
      "type mismatch",
      [
        {
          id: "base",
          document: { alias: { $type: "number", $value: "{later.target}" } },
        },
        {
          id: "mode",
          document: { later: { $type: "color", target: { $value: BLUE } } },
        },
      ],
      "ALIAS_TYPE_MISMATCH",
    ],
    [
      "cycle",
      [
        { id: "base", document: { first: { $value: "{second}" } } },
        { id: "mode", document: { second: { $value: "{first}" } } },
      ],
      "ALIAS_CYCLE",
    ],
  ])("rejects a completed cross-source alias graph with a %s", (_label, sources, code) => {
    const result = resolveDesignTokens(request({ sources }));
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected cross-source alias rejection.");
    expect(result.diagnostics[0]?.code).toBe(code);
    expect(result.rejectedSource).toEqual({
      id: "base",
      index: 0,
      snapshot: sources[0]?.document,
    });
    expect(Object.hasOwn(result, "tokens")).toBe(false);
    expectDeepFrozen(result);
  });

  it("does not let deferred alias closure hide unsupported data later in a source", () => {
    const result = resolveDesignTokens({
      sources: [
        {
          id: "base",
          document: {
            alias: { $value: "{later.target}" },
            unsupported: {
              $type: "color",
              $value: { colorSpace: "display-p3", components: [1, 0, 0] },
            },
          },
        },
        {
          id: "mode",
          document: { later: { $type: "number", target: { $value: 1 } } },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected complete source validation before alias closure.");
    expect(result.diagnostics[0]?.code).toBe("UNSUPPORTED_COLOR_SPACE");
    expect(result.rejectedSource?.id).toBe("base");
    expect(Object.hasOwn(result, "tokens")).toBe(false);
  });

  it("rejects a source overlay that changes an existing token type", () => {
    const result = resolveDesignTokens({
      sources: [
        { id: "base", document: { value: { $type: "number", $value: 1 } } },
        {
          id: "mode",
          document: { value: { $type: "dimension", $value: { value: 1, unit: "px" } } },
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe("SOURCE_TYPE_MISMATCH");
  });

  it.each([
    [
      "alias literal",
      [{ path: "value", type: "number", value: "{other}" }],
      "INVALID_LITERAL_OVERRIDE",
    ],
    ["missing path", [{ path: "other", type: "number", value: 2 }], "INVALID_LITERAL_OVERRIDE"],
    [
      "type change",
      [{ path: "value", type: "dimension", value: { value: 2, unit: "px" } }],
      "INVALID_LITERAL_OVERRIDE",
    ],
    [
      "duplicate path",
      [
        { path: "value", type: "number", value: 2 },
        { path: "value", type: "number", value: 3 },
      ],
      "DUPLICATE_LITERAL_OVERRIDE",
    ],
  ])("rejects a %s override", (_label, literalOverrides, code) => {
    const result = resolveDesignTokens(
      request({
        sources: [{ id: "base", document: { value: { $type: "number", $value: 1 } } }],
        literalOverrides,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe(code);
  });

  it("propagates an unsupported source snapshot", () => {
    const document = {
      color: {
        $type: "color",
        brand: { $value: { colorSpace: "display-p3", components: [1, 0, 0] } },
      },
    };
    const result = resolveDesignTokens(request({ sources: [{ id: "mode.p3", document }] }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected unsupported source rejection.");
    expect(result.diagnostics[0]?.classification).toBe("UNSUPPORTED_DTCG_FEATURE");
    expect(result.rejectedSource).toEqual({ id: "mode.p3", index: 0, snapshot: document });
    expectDeepFrozen(result);
  });

  it("rejects empty and duplicate source selections", () => {
    const empty = resolveDesignTokens({ sources: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.diagnostics[0]?.code).toBe("EMPTY_SOURCE_LIST");

    const duplicate = resolveDesignTokens({
      sources: [
        { id: "base", document: { a: { $type: "number", $value: 1 } } },
        { id: "base", document: { a: { $type: "number", $value: 2 } } },
      ],
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.diagnostics[0]?.code).toBe("DUPLICATE_SOURCE_ID");
  });

  it("rejects unsafe source descriptors without invoking accessors", () => {
    let invocations = 0;
    const source = Object.defineProperty({ id: "base" }, "document", {
      enumerable: true,
      get() {
        invocations += 1;
        return { value: { $type: "number", $value: 1 } };
      },
    });
    const result = resolveDesignTokens(request({ sources: [source] }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.diagnostics[0]?.code).toBe("INVALID_SOURCE_DESCRIPTOR");
    expect(invocations).toBe(0);
  });

  it("contains throwing and revoked request proxies as controlled failures", () => {
    let trapInvocations = 0;
    const throwingRequest = new Proxy(
      { sources: [] },
      {
        ownKeys() {
          trapInvocations += 1;
          throw new Error("caller trap");
        },
      },
    );
    const throwingResult = resolveDesignTokens(request(throwingRequest));
    expect(throwingResult.ok).toBe(false);
    if (!throwingResult.ok) {
      expect(throwingResult.diagnostics[0]?.code).toBe("INVALID_SOURCE_DESCRIPTOR");
      expect(Object.hasOwn(throwingResult, "tokens")).toBe(false);
    }
    expect(trapInvocations).toBeGreaterThan(0);

    const revokedRequest = Proxy.revocable({ sources: [] }, {});
    revokedRequest.revoke();
    const revokedRequestResult = resolveDesignTokens(request(revokedRequest.proxy));
    expect(revokedRequestResult.ok).toBe(false);
    if (!revokedRequestResult.ok) {
      expect(revokedRequestResult.diagnostics[0]?.code).toBe("INVALID_SOURCE_DESCRIPTOR");
    }

    const revokedSources = Proxy.revocable<unknown[]>([], {});
    revokedSources.revoke();
    const revokedSourcesResult = resolveDesignTokens(request({ sources: revokedSources.proxy }));
    expect(revokedSourcesResult.ok).toBe(false);
    if (!revokedSourcesResult.ok) {
      expect(revokedSourcesResult.diagnostics[0]?.code).toBe("INVALID_SOURCE_DESCRIPTOR");
      expect(Object.hasOwn(revokedSourcesResult, "tokens")).toBe(false);
    }
  });
});
