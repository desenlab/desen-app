import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_VALUE_SAFETY_LIMITS,
  createRuntimeResolutionSnapshot,
  evaluateRuntimeConditionalPresence,
  evaluateRuntimePredicate,
} from "../src/index.js";
import {
  prepareRuntimePredicateEvaluation,
  resolveRuntimePredicateOperands,
} from "../src/predicate-evaluation.js";

import type {
  RuntimePredicateEvaluation,
  RuntimePredicateSpec,
  RuntimeResolutionSnapshot,
  RuntimeResolutionSnapshotInput,
} from "../src/index.js";

function createSnapshotInput(): RuntimeResolutionSnapshotInput {
  return {
    state: {
      enabled: true,
      disabled: false,
      nullable: null,
      count: 2,
      zero: 0,
      empty: "",
      profile: { first: "Selman", role: "designer" },
      items: [
        { id: "one", label: "First" },
        { id: "two", label: "Second" },
      ],
    },
    context: { route: { tenant: "desenlab" } },
    resource: {
      ready: {
        status: "succeeded",
        pending: false,
        value: { total: 2 },
      },
      idle: { status: "idle", pending: false },
    },
    operation: {
      save: { status: "pending", pending: true },
    },
    event: { status: "unavailable" },
    item: { row: { id: "one" } },
    env: { locale: "tr-TR", platform: "web" },
  };
}

function asPredicate(value: unknown): RuntimePredicateSpec {
  return value as RuntimePredicateSpec;
}

function evaluate(
  predicate: unknown,
  snapshot = createRuntimeResolutionSnapshot(createSnapshotInput()),
): RuntimePredicateEvaluation {
  return evaluateRuntimePredicate(asPredicate(predicate), snapshot);
}

function expectEvaluated(
  predicate: unknown,
  value: boolean,
  diagnostics: readonly unknown[] = [],
): void {
  expect(evaluate(predicate)).toEqual({
    status: "evaluated",
    value,
    diagnostics,
  });
}

describe("evaluateRuntimePredicate", () => {
  it.each([
    [
      "all",
      {
        op: "all",
        args: [true, { op: "eq", args: [{ $ref: "state.count" }, 2] }],
      },
    ],
    ["any", { op: "any", args: [false, { op: "truthy", args: ["DESEN"] }] }],
    ["not", { op: "not", args: [false] }],
    [
      "eq",
      {
        op: "eq",
        args: [
          { b: 2, a: 1 },
          { a: 1, b: 2 },
        ],
      },
    ],
    [
      "neq",
      {
        op: "neq",
        args: [
          [1, 2],
          [2, 1],
        ],
      },
    ],
    ["gt", { op: "gt", args: [2, 1] }],
    ["gte", { op: "gte", args: [2, 2] }],
    ["lt", { op: "lt", args: ["A", "a"] }],
    ["lte", { op: "lte", args: ["same", "same"] }],
    ["in", { op: "in", args: [{ id: "one" }, [{ id: "one" }]] }],
    ["contains", { op: "contains", args: [["before", "after"], "after"] }],
    ["exists", { op: "exists", args: [{ $ref: "state.nullable" }] }],
    ["truthy", { op: "truthy", args: [{ ready: true }] }],
  ] as const)("implements the closed %s operator", (_operator, predicate) => {
    expectEvaluated(predicate, true);
  });

  it("supports the complete one-to-sixty-four boolean composition range", () => {
    for (let length = 1; length <= 64; length += 1) {
      expectEvaluated({ op: "all", args: new Array(length).fill(true) }, true);
      expectEvaluated({ op: "any", args: new Array(length).fill(false) }, false);
    }
    expectEvaluated({ op: "not", args: [true] }, false);
  });

  it("enforces every operator family's exact arity", () => {
    const invalidArities = [
      ...(["all", "any"] as const).flatMap((op) => [{ op, lengths: [0, 65] as const }]),
      ...(["not", "exists", "truthy"] as const).flatMap((op) => [{ op, lengths: [0, 2] as const }]),
      ...(["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"] as const).flatMap((op) => [
        { op, lengths: [0, 1, 3] as const },
      ]),
    ];
    for (const { op, lengths } of invalidArities) {
      for (const length of lengths) {
        expect(evaluate({ op, args: new Array(length).fill(true) })).toEqual({
          status: "invalid",
          pointer: "/args",
          reason: "malformed-predicate",
        });
      }
    }
  });

  it.each([
    ["null", null, false],
    ["false", false, false],
    ["zero", 0, false],
    ["empty string", "", false],
    ["empty array", [], false],
    ["empty object", {}, false],
    ["true", true, true],
    ["negative number", -1, true],
    ["non-empty string", "0", true],
    ["non-empty array", [0], true],
    ["non-empty object", { value: null }, true],
  ] as const)("applies the explicit truthy set to %s", (_label, value, expected) => {
    expectEvaluated({ op: "truthy", args: [value] }, expected);
  });

  it("uses canonical JSON identity for equality and array membership", () => {
    expectEvaluated(
      {
        op: "eq",
        args: [
          { b: [2, 1], a: -0 },
          { a: 0, b: [2, 1] },
        ],
      },
      true,
    );
    expectEvaluated(
      {
        op: "neq",
        args: [
          [1, 2],
          [2, 1],
        ],
      },
      true,
    );
    expectEvaluated(
      {
        op: "contains",
        args: [[{ nested: { z: 2, a: 1 } }], { nested: { a: 1, z: 2 } }],
      },
      true,
    );
    expectEvaluated(
      {
        op: "in",
        args: [{ nested: { z: 2, a: 1 } }, [{ nested: { a: 1, z: 2 } }]],
      },
      true,
    );
  });

  it("compares only same-kind numbers or UTF-16 strings and reports both incompatible values", () => {
    expectEvaluated({ op: "gt", args: [10, 2] }, true);
    expectEvaluated({ op: "gte", args: [10, 10] }, true);
    expectEvaluated({ op: "lt", args: ["\u{1f600}", "\ue000"] }, true);
    expectEvaluated({ op: "lte", args: ["a", "a"] }, true);

    expectEvaluated({ op: "gt", args: [1, "1"] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/1" },
    ]);
    expectEvaluated({ op: "lt", args: [false, {}] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" },
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/1" },
    ]);
  });

  it("keeps in and contains direction explicit for strings, arrays, and empty substrings", () => {
    expectEvaluated({ op: "in", args: ["sign", "design"] }, true);
    expectEvaluated({ op: "contains", args: ["design", "sign"] }, true);
    expectEvaluated({ op: "contains", args: ["design", ""] }, true);
    expectEvaluated({ op: "in", args: ["", "design"] }, true);
    expectEvaluated({ op: "contains", args: [[1, 2], 3] }, false);
    expectEvaluated({ op: "contains", args: ["e\u0301", "\u00e9"] }, false);
    expectEvaluated({ op: "in", args: ["\u00e9", "e\u0301"] }, false);
    expectEvaluated({ op: "contains", args: ["DESEN", "desen"] }, false);

    expectEvaluated({ op: "in", args: ["member", 7] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/1" },
    ]);
    expectEvaluated({ op: "contains", args: ["123", 2] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/1" },
    ]);
  });

  it("tests reference presence itself, including null, without evaluating fallback", () => {
    expectEvaluated({ op: "exists", args: [{ $ref: "state.nullable" }] }, true);
    expectEvaluated({ op: "exists", args: [{ $ref: "state.missing" }] }, false);
    expectEvaluated(
      {
        op: "exists",
        args: [
          {
            $ref: "state.missing",
            fallback: { $token: "fallback.must-not-materialize" },
          },
        ],
      },
      false,
    );
    expectEvaluated({ op: "exists", args: [{ $ref: "event.field" }] }, false);
    expectEvaluated({ op: "exists", args: ["state.nullable"] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" },
    ]);
  });

  it("keeps the presence probe aligned across all seven namespaces and lifecycle paths", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    for (const reference of [
      "state.nullable",
      "context.route.tenant",
      "resource.ready.status",
      "resource.ready.pending",
      "resource.ready.value.total",
      "operation.save.status",
      "operation.save.pending",
      "item.row.id",
      "env.platform",
    ]) {
      expect(evaluate({ op: "exists", args: [{ $ref: reference }] }, snapshot)).toEqual({
        status: "evaluated",
        value: true,
        diagnostics: [],
      });
    }

    for (const reference of [
      "state.unknown",
      "state.items.first.id",
      "resource.idle.value",
      "resource.ready.error.code",
      "resource.ready.status.extra",
      "operation.save.value",
      "event.field.id",
    ]) {
      expect(evaluate({ op: "exists", args: [{ $ref: reference }] }, snapshot)).toEqual({
        status: "evaluated",
        value: false,
        diagnostics: [],
      });
    }

    const eventSnapshot = createRuntimeResolutionSnapshot({
      ...createSnapshotInput(),
      event: { status: "available", value: { field: { id: "email" } } },
    });
    expect(evaluate({ op: "exists", args: [{ $ref: "event.field.id" }] }, eventSnapshot)).toEqual({
      status: "evaluated",
      value: true,
      diagnostics: [],
    });
  });

  it("does not short-circuit and preserves depth-first left-to-right diagnostic order", () => {
    expectEvaluated(
      {
        op: "any",
        args: [
          true,
          {
            op: "all",
            args: [
              { op: "gt", args: [{}, 1] },
              { op: "contains", args: [3, "x"] },
            ],
          },
          "not-a-boolean",
        ],
      },
      false,
      [
        {
          code: "PREDICATE_TYPE_MISMATCH",
          pointer: "/args/1/args/0/args/0",
        },
        {
          code: "PREDICATE_TYPE_MISMATCH",
          pointer: "/args/1/args/1/args/0",
        },
        { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/2" },
      ],
    );
  });

  it("distinguishes direct unresolved operands from a nested predicate that evaluated false", () => {
    const missing = { $ref: "state.missing" };
    expectEvaluated({ op: "neq", args: [missing, 1] }, false);
    expectEvaluated({ op: "not", args: [missing] }, false);
    expectEvaluated({ op: "any", args: [missing, true] }, false);
    expectEvaluated(
      {
        op: "any",
        args: [{ op: "truthy", args: [missing] }, true],
      },
      true,
    );
  });

  it("keeps token and format operands deferred instead of guessing a boolean", () => {
    expect(evaluate({ op: "truthy", args: [{ $token: "color.primary" }] })).toEqual({
      status: "deferred",
      form: "token",
      pointer: "/args/0/$token",
    });
    expect(
      evaluate({
        op: "eq",
        args: [
          "DESEN",
          {
            $format: {
              template: "{name}",
              values: { name: "DESEN" },
            },
          },
        ],
      }),
    ).toEqual({
      status: "deferred",
      form: "format",
      pointer: "/args/1/$format",
    });
  });

  it("treats only an exact valid nested predicate as executable predicate data", () => {
    const predicateShapedLiteral = { op: "eq", args: [1] };
    expectEvaluated(
      {
        op: "eq",
        args: [predicateShapedLiteral, { args: [1], op: "eq" }],
      },
      true,
    );
    expectEvaluated({ op: "all", args: [predicateShapedLiteral] }, false, [
      { code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" },
    ]);
    expect(evaluate({ op: "javascript", args: ["return true"] })).toEqual({
      status: "invalid",
      pointer: "/op",
      reason: "malformed-predicate",
    });
  });

  it.each([
    ["non-object root", 42, "", "malformed-predicate"],
    ["missing operator", { args: [true] }, "/op", "malformed-predicate"],
    ["unknown operator", { op: "execute", args: [true] }, "/op", "malformed-predicate"],
    [
      "extra root member",
      { op: "truthy", args: [true], execute: "code" },
      "/execute",
      "malformed-predicate",
    ],
    ["empty all", { op: "all", args: [] }, "/args", "malformed-predicate"],
    ["too many all", { op: "all", args: new Array(65).fill(true) }, "/args", "malformed-predicate"],
    ["wrong unary arity", { op: "not", args: [true, false] }, "/args", "malformed-predicate"],
    ["wrong binary arity", { op: "eq", args: [true] }, "/args", "malformed-predicate"],
    [
      "malformed reference",
      { op: "truthy", args: [{ $ref: "not a reference" }] },
      "/args/0/$ref",
      "malformed-reference",
    ],
    [
      "reserved expression key",
      { op: "truthy", args: [{ $eval: "state.enabled" }] },
      "/args/0/$eval",
      "reserved-literal-key",
    ],
  ] as const)("fails closed for %s", (_label, predicate, pointer, reason) => {
    expect(evaluate(predicate)).toEqual({ status: "invalid", pointer, reason });
  });

  it("rejects hostile language objects without invoking accessors or proxy traps beyond reflection", () => {
    const getter = vi.fn(() => "truthy");
    const accessorPredicate = { args: [true] };
    Object.defineProperty(accessorPredicate, "op", {
      enumerable: true,
      get: getter,
    });

    const cyclic: Record<string, unknown> = { op: "truthy", args: [] };
    cyclic.args = [cyclic];
    const sparse = { op: "all", args: new Array(1) };
    const hostile = new Proxy(
      { op: "truthy", args: [true] },
      {
        ownKeys() {
          throw new Error("hostile reflection");
        },
      },
    );

    for (const predicate of [accessorPredicate, cyclic, sparse, hostile, () => true]) {
      expect(evaluate(predicate)).toEqual({
        status: "invalid",
        pointer: "",
        reason: "unsafe-or-unbounded-json",
      });
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("enforces input depth/string limits and the aggregate resolved-value budget", () => {
    expect(
      evaluate({
        op: "truthy",
        args: ["x".repeat(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1)],
      }),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    let tooDeep: unknown = true;
    for (let depth = 0; depth <= RUNTIME_VALUE_SAFETY_LIMITS.maxDepth; depth += 1) {
      tooDeep = [tooDeep];
    }
    expect(evaluate({ op: "truthy", args: [tooDeep] })).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });

    const input = createSnapshotInput();
    (input.state as Record<string, unknown>).large = new Array(2_100).fill(null);
    (input.state as Record<string, unknown>).largeString = "x".repeat(
      Math.floor(RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits / 2) + 1,
    );
    const snapshot = createRuntimeResolutionSnapshot(input);
    expect(
      evaluate(
        {
          op: "all",
          args: [
            { op: "exists", args: [{ $ref: "state.large" }] },
            { op: "exists", args: [{ $ref: "state.large" }] },
          ],
        },
        snapshot,
      ),
    ).toEqual({
      status: "evaluated",
      value: true,
      diagnostics: [],
    });
    expect(
      evaluate(
        {
          op: "eq",
          args: [{ $ref: "state.large" }, { $ref: "state.large" }],
        },
        snapshot,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(
      evaluate(
        {
          op: "all",
          args: [
            { op: "exists", args: [{ $ref: "state.largeString" }] },
            { op: "exists", args: [{ $ref: "state.largeString" }] },
          ],
        },
        snapshot,
      ),
    ).toEqual({
      status: "evaluated",
      value: true,
      diagnostics: [],
    });
    const aggregateStringPredicate = asPredicate({
      op: "eq",
      args: [{ $ref: "state.largeString" }, { $ref: "state.largeString" }],
    });
    const preparedAggregateString = prepareRuntimePredicateEvaluation(aggregateStringPredicate);
    if ("status" in preparedAggregateString) {
      throw new Error("expected a prepared aggregate-string predicate");
    }
    expect(resolveRuntimePredicateOperands(preparedAggregateString, snapshot)).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(evaluate(aggregateStringPredicate, snapshot)).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
    expect(
      evaluate(
        {
          op: "all",
          args: [{ $token: "first-terminal" }, aggregateStringPredicate],
        },
        snapshot,
      ),
    ).toEqual({
      status: "deferred",
      form: "token",
      pointer: "/args/0/$token",
    });
    expect(
      evaluate(
        {
          op: "all",
          args: [aggregateStringPredicate, { $token: "later-terminal" }],
        },
        snapshot,
      ),
    ).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
  });

  it("accepts sixty-four predicate nodes and rejects a sixty-fifth", () => {
    const nestedPredicates = (count: number): unknown[] =>
      Array.from({ length: count }, () => ({ op: "truthy", args: [true] }));

    expect(evaluate({ op: "all", args: nestedPredicates(63) })).toEqual({
      status: "evaluated",
      value: true,
      diagnostics: [],
    });

    expect(evaluate({ op: "all", args: nestedPredicates(64) })).toEqual({
      status: "invalid",
      pointer: "",
      reason: "unsafe-or-unbounded-json",
    });
  });

  it("returns recursively frozen outcomes and ordered diagnostics", () => {
    const result = evaluate({ op: "gt", args: [false, 1] });
    expect(result).toEqual({
      status: "evaluated",
      value: false,
      diagnostics: [{ code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" }],
    });
    if (result.status !== "evaluated") throw new Error("expected evaluated predicate");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.diagnostics[0])).toBe(true);

    const invalid = evaluate({ op: "unknown", args: [true] });
    const tokenDeferred = evaluate({
      op: "truthy",
      args: [{ $token: "color.primary" }],
    });
    const formatDeferred = evaluate({
      op: "truthy",
      args: [{ $format: { template: "{value}", values: { value: true } } }],
    });
    for (const terminal of [invalid, tokenDeferred, formatDeferred]) {
      expect(Object.isFrozen(terminal)).toBe(true);
    }
  });

  it("rejects forged snapshots even when no reference lookup is otherwise necessary", () => {
    const forged = createSnapshotInput() as unknown as RuntimeResolutionSnapshot;
    expect(() =>
      evaluateRuntimePredicate(asPredicate({ op: "truthy", args: [true] }), forged),
    ).toThrowError("Runtime values require a factory-created resolution snapshot.");
    expect(() =>
      evaluateRuntimePredicate(asPredicate({ op: "unknown", args: [] }), forged),
    ).toThrowError("Runtime values require a factory-created resolution snapshot.");
  });
});

describe("evaluateRuntimeConditionalPresence", () => {
  it("maps omitted, true, and false conditions to explicit instantiation decisions", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(evaluateRuntimeConditionalPresence(undefined, snapshot)).toEqual({
      status: "evaluated",
      present: true,
      diagnostics: [],
    });
    expect(
      evaluateRuntimeConditionalPresence(
        asPredicate({ op: "eq", args: [{ $ref: "state.count" }, 2] }),
        snapshot,
      ),
    ).toEqual({
      status: "evaluated",
      present: true,
      diagnostics: [],
    });
    expect(
      evaluateRuntimeConditionalPresence(
        asPredicate({ op: "eq", args: [{ $ref: "state.count" }, 3] }),
        snapshot,
      ),
    ).toEqual({
      status: "evaluated",
      present: false,
      diagnostics: [],
    });
  });

  it("keeps evaluated false, invalid, and deferred absence distinguishable", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    expect(
      evaluateRuntimeConditionalPresence(asPredicate({ op: "all", args: ["wrong"] }), snapshot),
    ).toEqual({
      status: "evaluated",
      present: false,
      diagnostics: [{ code: "PREDICATE_TYPE_MISMATCH", pointer: "/args/0" }],
    });
    expect(
      evaluateRuntimeConditionalPresence(asPredicate({ op: "unknown", args: [true] }), snapshot),
    ).toEqual({
      status: "invalid",
      present: false,
      pointer: "/op",
      reason: "malformed-predicate",
    });
    expect(
      evaluateRuntimeConditionalPresence(
        asPredicate({ op: "truthy", args: [{ $token: "color.primary" }] }),
        snapshot,
      ),
    ).toEqual({
      status: "deferred",
      present: false,
      form: "token",
      pointer: "/args/0/$token",
    });
  });

  it("freezes every presence decision and retains the snapshot trust boundary", () => {
    const snapshot = createRuntimeResolutionSnapshot(createSnapshotInput());
    const omitted = evaluateRuntimeConditionalPresence(undefined, snapshot);
    const evaluated = evaluateRuntimeConditionalPresence(
      asPredicate({ op: "gt", args: [false, 1] }),
      snapshot,
    );
    const invalid = evaluateRuntimeConditionalPresence(
      asPredicate({ op: "unknown", args: [] }),
      snapshot,
    );
    const deferred = evaluateRuntimeConditionalPresence(
      asPredicate({ op: "truthy", args: [{ $token: "later" }] }),
      snapshot,
    );

    for (const outcome of [omitted, evaluated, invalid, deferred]) {
      expect(Object.isFrozen(outcome)).toBe(true);
    }
    if (omitted.status !== "evaluated" || evaluated.status !== "evaluated") {
      throw new Error("expected evaluated decisions");
    }
    expect(Object.isFrozen(omitted.diagnostics)).toBe(true);
    expect(Object.isFrozen(evaluated.diagnostics)).toBe(true);

    const forged = createSnapshotInput() as unknown as RuntimeResolutionSnapshot;
    expect(() => evaluateRuntimeConditionalPresence(undefined, forged)).toThrowError(
      "Runtime values require a factory-created resolution snapshot.",
    );
  });
});
