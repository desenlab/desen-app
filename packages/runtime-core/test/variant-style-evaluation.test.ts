import { describe, expect, it, vi } from "vitest";

import { canonicalizeJson } from "@desen/protocol";

import {
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeResolutionSnapshot,
  evaluateRuntimeVariantOverrides,
} from "../src/index.js";

import type {
  RuntimeResolutionSnapshot,
  RuntimeResolutionSnapshotInput,
  RuntimeTokenRequest,
  RuntimeTokenResolution,
  RuntimeValueMaterializationContext,
  RuntimeVariantEvaluationInput,
  RuntimeVariantOverridesEvaluated,
  RuntimeVariantOverridesEvaluation,
} from "../src/index.js";

function createSnapshotInput(): RuntimeResolutionSnapshotInput {
  return {
    state: {
      enabled: true,
      disabled: false,
      nullable: null,
      count: 2,
      label: "DESEN",
      profile: { role: "designer" },
    },
    context: { route: { tenant: "desenlab" } },
    resource: {},
    operation: {},
    event: { status: "unavailable" },
    item: {},
    env: { locale: "tr-TR", platform: "web" },
  };
}

function createContext(
  resolve: (request: RuntimeTokenRequest) => RuntimeTokenResolution = () => ({
    status: "missing",
  }),
): RuntimeValueMaterializationContext {
  return {
    requestContext: {
      documentId: "com.desen.variant-test",
      revision: `sha256:${"5".repeat(64)}`,
      surfaceId: "main",
      requestId: "variant-evaluation-1",
    },
    tokens: { resolve },
  };
}

function asInput(value: unknown): RuntimeVariantEvaluationInput {
  return value as RuntimeVariantEvaluationInput;
}

function evaluated(result: RuntimeVariantOverridesEvaluation): RuntimeVariantOverridesEvaluated {
  expect(result.status).toBe("evaluated");
  if (result.status !== "evaluated") throw new Error("Expected evaluated variant overrides.");
  return result;
}

function evaluate(
  input: unknown,
  context = createContext(),
  snapshot = createRuntimeResolutionSnapshot(createSnapshotInput()),
): RuntimeVariantOverridesEvaluation {
  return evaluateRuntimeVariantOverrides(asInput(input), snapshot, context);
}

function expectRecursivelyFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectRecursivelyFrozen(child);
}

describe("evaluateRuntimeVariantOverrides", () => {
  it("applies base values first and matching variants in exact document order", () => {
    const input = {
      props: {
        config: { first: 1, retained: true },
        label: "Base",
        nullable: "base",
      },
      style: {
        default: {
          icon: { size: 16 },
          root: { color: "blue", padding: 4 },
        },
        hover: { root: { color: "green" } },
      },
      variants: [
        {
          when: { op: "eq", args: [{ $ref: "state.enabled" }, true] },
          props: {
            config: { first: 9 },
            label: "First match",
            nullable: null,
          },
          style: {
            default: {
              root: { color: "red", opacity: 0.8 },
            },
          },
        },
        {
          when: { op: "eq", args: [{ $ref: "state.disabled" }, true] },
          props: { label: "Must not apply" },
          style: { default: { root: { color: "black" } } },
        },
        {
          when: { op: "truthy", args: [{ $ref: "state.label" }] },
          props: { label: "Last match" },
          style: {
            default: { root: { padding: 8 } },
            focus: { root: { outline: "solid" } },
          },
        },
      ],
    };

    const result = evaluated(evaluate(input));

    expect(result.matchingVariantIndices).toEqual([0, 2]);
    expect(result.effectiveProps).toEqual({
      config: { first: 9 },
      label: "Last match",
      nullable: null,
    });
    expect(result.effectiveStyle).toEqual({
      default: {
        icon: { size: 16 },
        root: { color: "red", opacity: 0.8, padding: 8 },
      },
      focus: { root: { outline: "solid" } },
      hover: { root: { color: "green" } },
    });
    expect(result.sources).toEqual({
      props: {
        config: "/variants/0/props/config",
        label: "/variants/2/props/label",
        nullable: "/variants/0/props/nullable",
      },
      style: {
        default: {
          icon: { size: "/style/default/icon/size" },
          root: {
            color: "/variants/0/style/default/root/color",
            opacity: "/variants/0/style/default/root/opacity",
            padding: "/variants/2/style/default/root/padding",
          },
        },
        focus: {
          root: { outline: "/variants/2/style/focus/root/outline" },
        },
        hover: { root: { color: "/style/hover/root/color" } },
      },
    });
    expect(result.diagnostics).toEqual([]);

    // A prop is one indivisible ValueSpec leaf; its literal object is not deep-merged.
    expect(result.effectiveProps.config).not.toHaveProperty("retained");
    // JSON null is a winning value, not a deletion instruction.
    expect(Object.hasOwn(result.effectiveProps, "nullable")).toBe(true);
  });

  it("makes array order observable and lets only later matching paths win", () => {
    const first = {
      when: { op: "eq", args: [1, 1] },
      props: { label: "first", untouched: "from-first" },
      style: { default: { root: { color: "red" } } },
    };
    const second = {
      when: { op: "eq", args: [2, 2] },
      props: { label: "second" },
      style: { default: { root: { color: "green" } } },
    };

    const forward = evaluated(evaluate({ variants: [first, second] }));
    const reversed = evaluated(evaluate({ variants: [second, first] }));

    expect(forward.matchingVariantIndices).toEqual([0, 1]);
    expect(forward.effectiveProps).toEqual({
      label: "second",
      untouched: "from-first",
    });
    expect(forward.effectiveStyle).toEqual({
      default: { root: { color: "green" } },
    });
    expect(reversed.effectiveProps).toEqual({
      label: "first",
      untouched: "from-first",
    });
    expect(reversed.effectiveStyle).toEqual({
      default: { root: { color: "red" } },
    });
  });

  it("returns empty immutable maps when no base or variant values are declared", () => {
    const result = evaluated(evaluate({}));

    expect(result).toEqual({
      status: "evaluated",
      effectiveProps: {},
      effectiveStyle: {},
      sources: { props: {}, style: {} },
      matchingVariantIndices: [],
      diagnostics: [],
    });
    expectRecursivelyFrozen(result);
  });

  it("detaches, canonicalizes, recursively freezes, and source-maps effective ValueSpecs", () => {
    const input = {
      props: {
        "aria/label~raw": { nested: ["original", { value: 1 }] },
        z: "last",
        a: "first",
      },
      style: {
        default: {
          root: {
            token: { $token: "output.must-remain-inert" },
          },
        },
      },
      variants: [
        {
          when: { op: "eq", args: [true, true] },
          props: { "aria/label~raw": { nested: ["winner"] } },
        },
      ],
    };
    const resolve = vi.fn(() => ({ status: "resolved" as const, value: "resolved" }));

    const result = evaluated(evaluate(input, createContext(resolve)));

    expect(result.effectiveProps).toEqual({
      a: "first",
      "aria/label~raw": { nested: ["winner"] },
      z: "last",
    });
    expect(result.effectiveStyle).toEqual({
      default: {
        root: { token: { $token: "output.must-remain-inert" } },
      },
    });
    expect(result.sources.props["aria/label~raw"]).toBe("/variants/0/props/aria~1label~0raw");
    expect(resolve).not.toHaveBeenCalled();
    expectRecursivelyFrozen(result);

    const firstVariant = input.variants[0];
    if (firstVariant === undefined) throw new Error("Expected the mutation-isolation fixture.");
    input.props["aria/label~raw"].nested[0] = "caller mutation";
    firstVariant.props["aria/label~raw"].nested[0] = "winner mutation";
    input.style.default.root.token.$token = "mutated";
    expect(result.effectiveProps["aria/label~raw"]).toEqual({ nested: ["winner"] });
    expect(result.effectiveStyle.default?.root?.token).toEqual({
      $token: "output.must-remain-inert",
    });
  });

  it("preserves numeric prop names and complete immutable provenance without key-order semantics", () => {
    const result = evaluated(
      evaluate({
        props: {
          "2": "two",
          "10": "ten-base",
          a: "alpha",
        },
        variants: [
          {
            when: { op: "eq", args: [true, true] },
            props: { "10": "ten-winner" },
          },
        ],
      }),
    );

    expect(result.effectiveProps).toEqual({
      "2": "two",
      "10": "ten-winner",
      a: "alpha",
    });
    expect(result.sources.props).toEqual({
      "2": "/props/2",
      "10": "/variants/0/props/10",
      a: "/props/a",
    });
    expect(Object.isFrozen(result.effectiveProps)).toBe(true);
    expect(Object.isFrozen(result.sources.props)).toBe(true);
    expect(Reflect.set(result.effectiveProps, "2", "mutated")).toBe(false);
    expect(Reflect.set(result.sources.props, "10", "/mutated")).toBe(false);

    // Canonical JSON owns deterministic serialization; JavaScript's numeric-key enumeration is
    // deliberately not promoted into protocol array-order or UTF-16 ordering semantics.
    expect(canonicalizeJson(result.effectiveProps)).toBe(
      '{"10":"ten-winner","2":"two","a":"alpha"}',
    );
    expect(canonicalizeJson(result.sources.props)).toBe(
      '{"10":"/variants/0/props/10","2":"/props/2","a":"/props/a"}',
    );
  });

  it("materializes token and format predicate operands with exact position pairing", () => {
    const calls: RuntimeTokenRequest[] = [];
    const receivers: unknown[] = [];
    const resolve = vi.fn(function (this: unknown, request: RuntimeTokenRequest) {
      receivers.push(this);
      calls.push(request);
      const values: Record<string, string> = {
        left: "L",
        right: "RIGHT",
        needle: "I",
      };
      return { status: "resolved" as const, value: values[request.token] ?? "unknown" };
    });
    const input = {
      props: { inertToken: { $token: "output.must-not-resolve" } },
      variants: [
        {
          when: {
            op: "eq",
            args: [
              {
                $format: {
                  template: "{left}>{right}>{again}",
                  values: {
                    left: { $token: "left" },
                    right: { $token: "right" },
                    again: { $token: "left" },
                  },
                },
              },
              "L>RIGHT>L",
            ],
          },
          props: { ordered: true },
        },
        {
          when: {
            op: "contains",
            args: [{ $token: "right" }, { $token: "needle" }],
          },
          props: { paired: true },
        },
        {
          when: {
            op: "contains",
            args: [{ $token: "needle" }, { $token: "right" }],
          },
          props: { reversed: "must-not-apply" },
        },
      ],
    };

    const first = evaluated(evaluate(input, createContext(resolve)));

    expect(first.matchingVariantIndices).toEqual([0, 1]);
    expect(first.effectiveProps).toEqual({
      inertToken: { $token: "output.must-not-resolve" },
      ordered: true,
      paired: true,
    });
    expect(resolve.mock.calls.map(([request]) => request.token)).toEqual([
      "left",
      "right",
      "needle",
    ]);
    expect(receivers).toEqual([undefined, undefined, undefined]);
    for (const request of calls) {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.context)).toBe(true);
    }

    // The shared cache is scoped to one complete evaluation turn.
    evaluated(evaluate(input, createContext(resolve)));
    expect(resolve).toHaveBeenCalledTimes(6);
  });

  it("treats missing predicate values as false while keeping resolved null distinct", () => {
    const resolve = vi.fn((request: RuntimeTokenRequest): RuntimeTokenResolution => {
      if (request.token === "nullable") return { status: "resolved", value: null };
      return { status: "missing" };
    });

    const result = evaluated(
      evaluate(
        {
          props: { base: true },
          variants: [
            {
              when: { op: "eq", args: [{ $token: "missing" }, "fallback"] },
              props: { missingMatched: true },
            },
            {
              when: { op: "eq", args: [{ $ref: "state.notThere" }, "fallback"] },
              props: { referenceMatched: true },
            },
            {
              when: { op: "eq", args: [{ $token: "nullable" }, null] },
              props: { nullableMatched: true },
            },
          ],
        },
        createContext(resolve),
      ),
    );

    expect(result.matchingVariantIndices).toEqual([2]);
    expect(result.effectiveProps).toEqual({ base: true, nullableMatched: true });
    expect(resolve.mock.calls.map(([request]) => request.token)).toEqual(["missing", "nullable"]);
  });

  it("uses status-only exists semantics and never evaluates a missing reference fallback", () => {
    const resolve = vi.fn(() => ({ status: "resolved" as const, value: "must not be read" }));

    const result = evaluated(
      evaluate(
        {
          variants: [
            {
              when: {
                op: "exists",
                args: [
                  {
                    $ref: "state.notThere",
                    fallback: { $token: "fallback.must-not-resolve" },
                  },
                ],
              },
              props: { absent: true },
            },
            {
              when: {
                op: "exists",
                args: [{ $ref: "state.nullable" }],
              },
              props: { nullIsPresent: true },
            },
          ],
        },
        createContext(resolve),
      ),
    );

    expect(result.matchingVariantIndices).toEqual([1]);
    expect(result.effectiveProps).toEqual({ nullIsPresent: true });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("prefixes ordered predicate diagnostics without changing valid false evaluation", () => {
    const result = evaluated(
      evaluate({
        variants: [
          {
            when: { op: "gt", args: [1, "1"] },
            props: { first: true },
          },
          {
            when: { op: "lt", args: [false, {}] },
            props: { second: true },
          },
        ],
      }),
    );

    expect(result.matchingVariantIndices).toEqual([]);
    expect(result.effectiveProps).toEqual({});
    expect(result.diagnostics).toEqual([
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/variants/0/when/args/1",
      },
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/variants/1/when/args/0",
      },
      {
        code: "PREDICATE_TYPE_MISMATCH",
        pointer: "/variants/1/when/args/1",
      },
    ]);
    expectRecursivelyFrozen(result.diagnostics);
  });

  it("redacts provider exceptions, malformed envelopes, promises, and hostile results", () => {
    const hostile = new Proxy(
      { status: "resolved", value: "secret" },
      {
        ownKeys() {
          throw new Error("private reflection failure");
        },
      },
    );
    const providerResults = [
      () => {
        throw new Error("private provider failure");
      },
      () => ({ status: "resolved" }),
      () => ({ status: "missing", extra: true }),
      () => Promise.resolve({ status: "resolved", value: "late" }),
      () => hostile,
    ];

    for (const provider of providerResults) {
      const result = evaluate(
        {
          props: { base: "must-not-leak-as-partial" },
          variants: [
            {
              when: { op: "eq", args: [{ $token: "unsafe" }, "value"] },
              props: { selected: true },
            },
          ],
        },
        createContext(provider as never),
      );

      expect(result).toEqual({
        status: "failed",
        code: "ADAPTER_FAILURE",
        pointer: "/variants/0/when/args/0/$token",
        adapter: "token-provider",
      });
      expect("effectiveProps" in result).toBe(false);
      expect("diagnostics" in result).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private");
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("validates the complete input before making the first provider call", () => {
    const resolve = vi.fn(() => ({ status: "resolved" as const, value: true }));
    const result = evaluate(
      {
        variants: [
          {
            when: { op: "eq", args: [{ $token: "would-run-first" }, true] },
            props: { first: true },
          },
          {
            when: { op: "eq", args: [true, true] },
            style: {
              default: {
                root: {
                  invalid: { $format: { template: "{missing}", values: {} } },
                },
              },
            },
          },
        ],
      },
      createContext(resolve),
    );

    expect(result).toEqual({
      status: "invalid",
      pointer: "/variants/1/style/default/root/invalid/$format/template",
      reason: "malformed-format",
    });
    expect(resolve).not.toHaveBeenCalled();
    expect("effectiveProps" in result).toBe(false);
  });

  it("prevalidates every predicate format before invoking an earlier token provider", () => {
    const resolve = vi.fn((request: RuntimeTokenRequest): RuntimeTokenResolution => {
      void request;
      return { status: "resolved", value: true };
    });
    const result = evaluate(
      {
        variants: [
          {
            when: {
              op: "eq",
              args: [{ $token: "would-run-first" }, true],
            },
            props: { first: true },
          },
          {
            when: {
              op: "eq",
              args: [
                {
                  $format: {
                    template: "{expected}",
                    values: { unexpected: "value" },
                  },
                },
                "value",
              ],
            },
            props: { second: true },
          },
        ],
      },
      createContext(resolve),
    );

    expect(result).toEqual({
      status: "invalid",
      pointer: "/variants/1/when/args/0/$format/template",
      reason: "malformed-format",
    });
    expect(resolve).not.toHaveBeenCalled();
    expect("effectiveProps" in result).toBe(false);
    expect("diagnostics" in result).toBe(false);
  });

  it("reports an outer format profile error before nested format value errors", () => {
    const resolve = vi.fn((request: RuntimeTokenRequest): RuntimeTokenResolution => {
      void request;
      return { status: "resolved", value: "must not be requested" };
    });
    const result = evaluate(
      {
        props: {
          x: {
            $format: {
              template: "{outerMissing}",
              values: {
                nested: {
                  $format: {
                    template: "{innerMissing}",
                    values: {},
                  },
                },
              },
            },
          },
        },
      },
      createContext(resolve),
    );

    expect(resolve).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "invalid",
      pointer: "/props/x/$format/template",
      reason: "malformed-format",
    });
    expect("effectiveProps" in result).toBe(false);
    expect("diagnostics" in result).toBe(false);
  });

  it("shape-validates raw base references without materializing snapshot values", () => {
    const huge = "x".repeat(600_000);
    const snapshotInput = createSnapshotInput();
    const snapshot = createRuntimeResolutionSnapshot({
      ...snapshotInput,
      state: { ...snapshotInput.state, huge },
    });
    const resolve = vi.fn((request: RuntimeTokenRequest): RuntimeTokenResolution => {
      void request;
      return {
        status: "resolved",
        value: "must not be requested",
      };
    });

    const outcome = evaluate(
      {
        props: {
          label: {
            $format: {
              template: "{x}{x}",
              values: { x: { $ref: "state.huge" } },
            },
          },
          rawReference: { $ref: "state.huge" },
        },
        variants: [
          {
            when: { op: "eq", args: [true, true] },
            props: { label: "winner" },
          },
        ],
      },
      createContext(resolve),
      snapshot,
    );
    expect(resolve).not.toHaveBeenCalled();

    const result = evaluated(outcome);

    // Resolving the nested reference during input validation would create a 1.2M-character
    // format result and fail the safety budget before the winning variant could replace it.
    expect(result.matchingVariantIndices).toEqual([0]);
    expect(result.effectiveProps).toEqual({
      label: "winner",
      rawReference: { $ref: "state.huge" },
    });
    expect(result.sources.props).toEqual({
      label: "/variants/0/props/label",
      rawReference: "/props/rawReference",
    });
  });

  it.each([
    [
      "an unknown structural root field",
      { slots: { default: [] } },
      "/slots",
      "malformed-variant-overrides",
    ],
    ["a non-array variants field", { variants: {} }, "/variants", "malformed-variant-overrides"],
    [
      "a variant missing when",
      { variants: [{ props: { label: "x" } }] },
      "/variants/0/when",
      "malformed-variant-overrides",
    ],
    [
      "a variant without props or style",
      { variants: [{ when: { op: "eq", args: [1, 1] } }] },
      "/variants/0",
      "malformed-variant-overrides",
    ],
    [
      "a structural variant field",
      {
        variants: [
          {
            when: { op: "eq", args: [1, 1] },
            props: {},
            slots: { default: [] },
          },
        ],
      },
      "/variants/0/slots",
      "malformed-variant-overrides",
    ],
    [
      "a non-object extension bag",
      {
        variants: [
          {
            when: { op: "eq", args: [1, 1] },
            props: {},
            extensions: [],
          },
        ],
      },
      "/variants/0/extensions",
      "malformed-variant-overrides",
    ],
    [
      "an invalid style state",
      { style: { "bad state": { root: { color: "red" } } } },
      "/style/bad state",
      "malformed-variant-overrides",
    ],
    [
      "an invalid style nesting level",
      { style: { default: { root: "red" } } },
      "/style/default/root",
      "malformed-variant-overrides",
    ],
    [
      "a reserved literal ValueSpec key",
      { props: { value: { $executable: "no" } } },
      "/props/value/$executable",
      "reserved-literal-key",
    ],
    [
      "an invalid predicate arity",
      {
        variants: [
          {
            when: { op: "eq", args: [1] },
            props: { value: true },
          },
        ],
      },
      "/variants/0/when/args",
      "malformed-predicate",
    ],
  ] as const)("rejects %s with an exact pointer", (_label, input, pointer, reason) => {
    expect(evaluate(input)).toEqual({ status: "invalid", pointer, reason });
  });

  it("accepts opaque extension JSON but cannot give it structural meaning", () => {
    const result = evaluated(
      evaluate({
        props: { base: true },
        variants: [
          {
            when: { op: "eq", args: [true, true] },
            props: { selected: true },
            extensions: {
              "example.com/plugin": {
                slots: { default: [{ use: "dangerous" }] },
                executable: "ignored",
              },
            },
          },
        ],
      }),
    );

    expect(result.effectiveProps).toEqual({ base: true, selected: true });
    expect(result).not.toHaveProperty("extensions");
    expect(result).not.toHaveProperty("slots");
  });

  it("rejects hostile language values without executing accessors", () => {
    const getter = vi.fn(() => ({ label: "must not execute" }));
    const accessor = {};
    Object.defineProperty(accessor, "props", { enumerable: true, get: getter });

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    const sparseVariants = new Array(1);
    const decoratedVariants: unknown[] = [];
    Object.defineProperty(decoratedVariants, "extra", {
      enumerable: true,
      value: "decorated",
    });

    const hostileProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("must be contained");
        },
      },
    );

    for (const input of [
      accessor,
      { props: { executable: () => true } },
      { props: { promised: Promise.resolve("late") } },
      { props: cycle },
      { variants: sparseVariants },
      { variants: decoratedVariants },
      { props: { number: Number.NaN } },
      hostileProxy,
    ]) {
      expect(evaluate(input)).toEqual({
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      });
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("enforces depth, node, and string limits at the inert input boundary", () => {
    const oversizedString = "x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1);
    const oversizedArray = new Array(RUNTIME_VALUE_SAFETY_LIMITS.maxJsonNodes).fill(null);
    let tooDeep: Record<string, unknown> = {};
    const deepRoot = tooDeep;
    for (let depth = 0; depth <= RUNTIME_VALUE_SAFETY_LIMITS.maxDepth; depth += 1) {
      const next: Record<string, unknown> = {};
      tooDeep.next = next;
      tooDeep = next;
    }

    for (const input of [
      { props: { text: oversizedString } },
      { props: { values: oversizedArray } },
      { props: { value: deepRoot } },
    ]) {
      expect(evaluate(input)).toEqual({
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      });
    }
  });

  it("enforces one aggregate materialized-value budget across predicate occurrences", () => {
    const large = "x".repeat(600_000);
    const resolve = vi.fn((request: RuntimeTokenRequest) => {
      void request;
      return {
        status: "resolved" as const,
        value: large,
      };
    });
    const result = evaluate(
      {
        variants: [
          {
            when: { op: "truthy", args: [{ $token: "large.shared" }] },
            props: { first: true },
          },
          {
            when: { op: "truthy", args: [{ $token: "large.shared" }] },
            props: { second: true },
          },
          {
            when: { op: "truthy", args: [{ $token: "must-not-run" }] },
            props: { third: true },
          },
        ],
      },
      createContext(resolve),
    );

    expect(result).toEqual({
      status: "invalid",
      pointer: "/variants/1/when/args/0",
      reason: "unsafe-or-unbounded-json",
    });
    expect(resolve.mock.calls.map(([request]) => request.token)).toEqual(["large.shared"]);
    expect("effectiveProps" in result).toBe(false);
    expect("diagnostics" in result).toBe(false);
  });

  it("stops after the first terminal provider failure and exposes no partial composition", () => {
    const resolve = vi.fn((request: RuntimeTokenRequest): RuntimeTokenResolution => {
      if (request.token === "first") return { status: "resolved", value: true };
      if (request.token === "failure") throw new Error("private");
      return { status: "resolved", value: true };
    });
    const result = evaluate(
      {
        props: { base: true },
        variants: [
          {
            when: { op: "eq", args: [{ $token: "first" }, true] },
            props: { first: true },
          },
          {
            when: { op: "eq", args: [{ $token: "failure" }, true] },
            props: { second: true },
          },
          {
            when: { op: "eq", args: [{ $token: "after" }, true] },
            props: { third: true },
          },
        ],
      },
      createContext(resolve),
    );

    expect(result).toEqual({
      status: "failed",
      code: "ADAPTER_FAILURE",
      pointer: "/variants/1/when/args/0/$token",
      adapter: "token-provider",
    });
    expect(resolve.mock.calls.map(([request]) => request.token)).toEqual(["first", "failure"]);
    expect("effectiveProps" in result).toBe(false);
  });

  it("rejects forged snapshots and malformed contexts before input or host inspection", () => {
    const resolve = vi.fn(() => ({ status: "resolved" as const, value: true }));
    const inputGetter = vi.fn(() => []);
    const hostileInput = {};
    Object.defineProperty(hostileInput, "variants", {
      enumerable: true,
      get: inputGetter,
    });

    expect(() =>
      evaluateRuntimeVariantOverrides(
        asInput(hostileInput),
        createSnapshotInput() as unknown as RuntimeResolutionSnapshot,
        createContext(resolve),
      ),
    ).toThrow(TypeError);
    expect(inputGetter).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    const invalidContexts = [
      {},
      {
        requestContext: createContext().requestContext,
        tokens: { resolve, extra: true },
      },
      {
        requestContext: { ...createContext().requestContext, extra: true },
        tokens: { resolve },
      },
      {
        requestContext: createContext().requestContext,
        tokens: {},
      },
    ];
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    for (const context of invalidContexts) {
      expect(() =>
        evaluateRuntimeVariantOverrides(
          asInput(hostileInput),
          snapshot,
          context as RuntimeValueMaterializationContext,
        ),
      ).toThrow(TypeError);
    }
    expect(inputGetter).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
});
