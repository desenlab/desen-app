import { describe, expect, it } from "vitest";

import { admitDtcgTokenDocument } from "../src/token-document.js";
import { DESIGN_TOKEN_PROFILE } from "../src/token-types.js";

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

function completeDocument(): Record<string, unknown> {
  const color = { colorSpace: "srgb", components: [0.1, 0.2, 0.3], alpha: 0.8 };
  const dimension = { value: 8, unit: "px" };
  const duration = { value: 180, unit: "ms" };
  const easing = [0.2, 0, 0, 1];
  return {
    border: {
      $type: "border",
      focus: { $value: { color, style: "solid", width: { value: 2, unit: "px" } } },
    },
    color: {
      $description: "Palette",
      $type: "color",
      brand: {
        $deprecated: "Prefer color.accent after the next release.",
        $description: "Brand",
        $extensions: { "com.desen/source": { editor: "picker" } },
        $value: color,
      },
      brandAlias: { $value: "{color.brand}" },
    },
    motion: {
      duration: { $type: "duration", fast: { $value: duration } },
      easing: { $type: "cubicBezier", standard: { $value: easing } },
      transition: {
        $type: "transition",
        enter: { $value: { delay: { value: 0, unit: "ms" }, duration, timingFunction: easing } },
      },
    },
    number: { $type: "number", opacity: { $value: 0.6 } },
    shadow: {
      $type: "shadow",
      raised: {
        $value: {
          blur: { value: 12, unit: "px" },
          color,
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 4, unit: "px" },
          spread: { value: -1, unit: "px" },
        },
      },
    },
    space: { $type: "dimension", md: { $value: dimension } },
    type: {
      $type: "typography",
      body: {
        $value: {
          fontFamily: ["Inter", "sans-serif"],
          fontSize: { value: 16, unit: "px" },
          fontWeight: 450,
          letterSpacing: { value: 0, unit: "px" },
          lineHeight: 1.5,
        },
      },
    },
  };
}

describe("admitDtcgTokenDocument", () => {
  it("admits every bounded value family and preserves DTCG metadata", () => {
    const input = completeDocument();
    const result = admitDtcgTokenDocument(input, "base");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected the complete token document to be admitted.");
    expect(result.tokenPaths).toEqual([
      "border.focus",
      "color.brand",
      "color.brandAlias",
      "motion.duration.fast",
      "motion.easing.standard",
      "motion.transition.enter",
      "number.opacity",
      "shadow.raised",
      "space.md",
      "type.body",
    ]);
    expect(result.tokens["color.brand"]?.metadata).toEqual({
      $deprecated: "Prefer color.accent after the next release.",
      $description: "Brand",
      $extensions: { "com.desen/source": { editor: "picker" } },
    });
    expect(result.document).toEqual(input);
    expectDeepFrozen(result);
  });

  it("infers an untyped alias from its target before considering a parent group type", () => {
    const result = admitDtcgTokenDocument({
      base: { $type: "number", $value: 1 },
      chained: { $value: "{dimensionParent.alias}" },
      dimensionParent: {
        $type: "dimension",
        alias: { $value: "{base}" },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected reference-first DTCG type inference.");
    expect(result.tokens["dimensionParent.alias"]?.type).toBe("number");
    expect(result.tokens.chained?.type).toBe("number");
  });

  it("keeps standalone admission closed when an untyped alias target is external", () => {
    const input = { semantic: { action: { $value: "{mode.brand}" } } };
    const result = admitDtcgTokenDocument(input, "base");

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected standalone alias closure to remain strict.");
    expect(result.diagnostics[0]?.code).toBe("ALIAS_TARGET_MISSING");
    expect(result.snapshot).toEqual(input);
    expectDeepFrozen(result);
  });

  it("inherits group deprecation metadata and honors a token override", () => {
    const result = admitDtcgTokenDocument({
      group: {
        $deprecated: "Use the replacement group.",
        $type: "number",
        inherited: { $description: "Legacy token", $value: 1 },
        nested: { inherited: { $value: 3 } },
        retained: { $deprecated: false, $value: 2 },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new TypeError("Expected group deprecation inheritance.");
    expect(result.tokens["group.inherited"]?.metadata).toEqual({
      $deprecated: "Use the replacement group.",
      $description: "Legacy token",
    });
    expect(result.tokens["group.nested.inherited"]?.metadata).toEqual({
      $deprecated: "Use the replacement group.",
    });
    expect(result.tokens["group.retained"]?.metadata).toEqual({ $deprecated: false });
  });

  it("returns a detached, key-deterministic snapshot without freezing caller data", () => {
    const first = {
      z: { $type: "number", token: { $value: 1 } },
      a: { $type: "number", token: { $value: 2 } },
    };
    const second = {
      a: { token: { $value: 2 }, $type: "number" },
      z: { token: { $value: 1 }, $type: "number" },
    };
    const firstResult = admitDtcgTokenDocument(first);
    const secondResult = admitDtcgTokenDocument(second);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    if (!firstResult.ok || !secondResult.ok)
      throw new TypeError("Expected deterministic snapshots.");
    expect(JSON.stringify(firstResult.document)).toBe(JSON.stringify(secondResult.document));
    expect(firstResult.document).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(false);

    first.z.token.$value = 99;
    expect(firstResult.tokens["z.token"]?.value).toBe(1);
  });

  it("returns safely captured unsupported documents without stripping their feature", () => {
    const displayP3 = {
      color: {
        $type: "color",
        brand: { $value: { colorSpace: "display-p3", components: [0.1, 0.2, 0.3] } },
      },
    };
    const result = admitDtcgTokenDocument(displayP3, "wide-gamut");

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected unsupported color-space rejection.");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        classification: "UNSUPPORTED_DTCG_FEATURE",
        code: "UNSUPPORTED_COLOR_SPACE",
        sourceId: "wide-gamut",
        tokenPath: "color.brand",
      }),
    ]);
    expect(result.snapshot).toEqual(displayP3);
    expectDeepFrozen(result);
  });

  it.each([
    ["unknown token type", { value: { $type: "gradient", $value: [] } }, "UNSUPPORTED_DTCG_TYPE"],
    [
      "group extension syntax",
      { group: { $extends: "{other}", token: { $type: "number", $value: 1 } } },
      "UNSUPPORTED_DTCG_MEMBER",
    ],
    [
      "property alias",
      {
        type: {
          $type: "typography",
          body: {
            $value: {
              fontFamily: "{family.body}",
              fontSize: { value: 16, unit: "px" },
              fontWeight: 400,
              letterSpacing: { value: 0, unit: "px" },
              lineHeight: 1.5,
            },
          },
        },
      },
      "UNSUPPORTED_PROPERTY_ALIAS",
    ],
  ])("classifies %s as an explicit unsupported feature", (_label, input, code) => {
    const result = admitDtcgTokenDocument(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected unsupported feature rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ classification: "UNSUPPORTED_DTCG_FEATURE", code }),
    );
    expect(result.snapshot).toEqual(input);
  });

  it.each([
    ["missing type", { value: { $value: 1 } }, "MISSING_DTCG_TYPE"],
    [
      "mixed token and group",
      { value: { $type: "number", $value: 1, child: {} } },
      "INVALID_DTCG_STRUCTURE",
    ],
    ["empty group", { empty: { $type: "number" } }, "EMPTY_DTCG_GROUP"],
    ["invalid name", { "bad.name": { $type: "number", $value: 1 } }, "INVALID_DTCG_NAME"],
    ["non-finite value", { value: { $type: "number", $value: Number.NaN } }, "UNSAFE_DTCG_VALUE"],
    ["numeric overflow", { value: { $type: "number", $value: 1_000_000_001 } }, "LIMIT_EXCEEDED"],
    [
      "malformed composite",
      { border: { $type: "border", $value: { color: {}, style: "solid" } } },
      "INVALID_DTCG_VALUE",
    ],
  ])("rejects %s as invalid DTCG", (_label, input, code) => {
    const result = admitDtcgTokenDocument(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected invalid DTCG rejection.");
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({ classification: "INVALID_DTCG", code }),
    );
  });

  it("rejects accessors without invoking them and exposes no unsafe snapshot", () => {
    let invocations = 0;
    const token = Object.defineProperty({}, "$value", {
      enumerable: true,
      get() {
        invocations += 1;
        return 1;
      },
    });
    Object.defineProperty(token, "$type", { enumerable: true, value: "number" });

    const result = admitDtcgTokenDocument({ token });
    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected unsafe accessor rejection.");
    expect(result.diagnostics[0]?.code).toBe("UNSAFE_DTCG_VALUE");
    expect(result.snapshot).toBeUndefined();
    expect(invocations).toBe(0);
  });

  it("contains throwing and revoked proxy inputs as controlled failures", () => {
    let trapInvocations = 0;
    const throwing = new Proxy(
      { value: { $type: "number", $value: 1 } },
      {
        ownKeys() {
          trapInvocations += 1;
          throw new Error("caller trap");
        },
      },
    );
    const throwingResult = admitDtcgTokenDocument(throwing);
    expect(throwingResult.ok).toBe(false);
    if (!throwingResult.ok) {
      expect(throwingResult.diagnostics[0]?.code).toBe("UNSAFE_DTCG_VALUE");
      expect(throwingResult.snapshot).toBeUndefined();
    }
    expect(trapInvocations).toBeGreaterThan(0);

    const revocable = Proxy.revocable({ value: { $type: "number", $value: 1 } }, {});
    revocable.revoke();
    const revokedResult = admitDtcgTokenDocument(revocable.proxy);
    expect(revokedResult.ok).toBe(false);
    if (!revokedResult.ok) {
      expect(revokedResult.diagnostics[0]?.code).toBe("UNSAFE_DTCG_VALUE");
      expect(revokedResult.snapshot).toBeUndefined();
    }
  });

  it("rejects a non-string source id without inspecting or retaining it", () => {
    let trapInvocations = 0;
    const sourceId = new Proxy(
      {},
      {
        get() {
          trapInvocations += 1;
          throw new Error("caller trap");
        },
        ownKeys() {
          trapInvocations += 1;
          throw new Error("caller trap");
        },
      },
    );
    const result = admitDtcgTokenDocument(
      { value: { $type: "number", $value: 1 } },
      sourceId as unknown as string,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new TypeError("Expected invalid source-id rejection.");
    expect(result.diagnostics[0]?.code).toBe("UNSAFE_DTCG_VALUE");
    expect(Object.hasOwn(result.diagnostics[0], "sourceId")).toBe(false);
    expect(result.snapshot).toBeUndefined();
    expect(trapInvocations).toBe(0);
  });

  it("rejects cyclic and over-depth JSON before semantic traversal", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const cyclicResult = admitDtcgTokenDocument(cyclic);
    expect(cyclicResult.ok).toBe(false);
    if (!cyclicResult.ok) expect(cyclicResult.diagnostics[0]?.code).toBe("UNSAFE_DTCG_VALUE");

    let nested: Record<string, unknown> = { $type: "number", $value: 1 };
    for (let index = 0; index <= DESIGN_TOKEN_PROFILE.limits.maxJsonDepth; index += 1) {
      nested = { nested };
    }
    const depthResult = admitDtcgTokenDocument(nested);
    expect(depthResult.ok).toBe(false);
    if (!depthResult.ok) expect(depthResult.diagnostics[0]?.code).toBe("LIMIT_EXCEEDED");
  });
});
