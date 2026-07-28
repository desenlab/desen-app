import { describe, expect, it, vi } from "vitest";

import {
  RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS,
  buildRuntimeReactDiagnosticIndex,
} from "../src/diagnostic-index.js";

import type { RuntimeReactDiagnosticIndexBinding } from "../src/diagnostic-index.js";

const COMPONENT_A = Object.freeze({
  kind: "component",
  runtimeNodeId: "runtime-b",
  sourceNodeId: "source-shared",
  capabilityId: "run.desen.test/Card",
} as const);
const COMPONENT_B = Object.freeze({
  kind: "component",
  runtimeNodeId: "runtime-a",
  sourceNodeId: "source-shared",
  capabilityId: "run.desen.test/Card",
} as const);
const BEHAVIOR_A = Object.freeze({
  kind: "behavior",
  runtimeNodeId: "behavior-z",
  sourceNodeId: "source-shared",
  capabilityId: "run.desen.test/Sortable",
  behaviorId: "sort",
  ownerRuntimeNodeId: "runtime-b",
} as const);
const BEHAVIOR_B = Object.freeze({
  kind: "behavior",
  runtimeNodeId: "behavior-a",
  sourceNodeId: "source-shared",
  capabilityId: "run.desen.test/Sortable",
  behaviorId: "sort",
  ownerRuntimeNodeId: "runtime-a",
} as const);

function built(bindings: readonly RuntimeReactDiagnosticIndexBinding[]) {
  const result = buildRuntimeReactDiagnosticIndex(bindings);
  expect(result.status).toBe("built");
  if (result.status !== "built") throw new TypeError(`Unexpected failure: ${result.reason}`);
  return result.index;
}

describe("runtime React diagnostic index", () => {
  it("builds deterministic forward and one-to-many inverse lookups", () => {
    const index = built([BEHAVIOR_A, COMPONENT_A, BEHAVIOR_B, COMPONENT_B]);
    expect(Object.keys(index.byRuntimeNodeId)).toEqual([
      "behavior-a",
      "behavior-z",
      "runtime-a",
      "runtime-b",
    ]);
    expect(index.byRuntimeNodeId["runtime-a"]).toEqual(COMPONENT_B);
    expect(index.byRuntimeNodeId["behavior-z"]).toEqual(BEHAVIOR_A);
    expect(index.runtimeNodeIdsBySourceNodeId["source-shared"]).toEqual([
      "behavior-a",
      "behavior-z",
      "runtime-a",
      "runtime-b",
    ]);
    expect(index.runtimeNodeIdsByBehaviorId.sort).toEqual(["behavior-a", "behavior-z"]);

    const permuted = built([COMPONENT_B, BEHAVIOR_B, COMPONENT_A, BEHAVIOR_A]);
    expect(JSON.stringify(permuted)).toBe(JSON.stringify(index));
  });

  it("returns deeply frozen callback-free JSON without retaining caller records", () => {
    const caller = {
      kind: "component" as const,
      runtimeNodeId: "runtime",
      sourceNodeId: "source",
      capabilityId: "run.desen.test/Card",
    };
    const index = built([caller]);
    expect(Object.getPrototypeOf(index.byRuntimeNodeId)).toBeNull();
    expect(Object.getPrototypeOf(index.runtimeNodeIdsBySourceNodeId)).toBeNull();
    expect(Object.getPrototypeOf(index.runtimeNodeIdsByBehaviorId)).toBeNull();
    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.byRuntimeNodeId)).toBe(true);
    expect(Object.isFrozen(index.byRuntimeNodeId.runtime)).toBe(true);
    expect(Object.isFrozen(index.runtimeNodeIdsBySourceNodeId.source)).toBe(true);

    caller.sourceNodeId = "mutated";
    expect(index.byRuntimeNodeId.runtime?.sourceNodeId).toBe("source");
    expect(JSON.parse(JSON.stringify(index))).toEqual({
      byRuntimeNodeId: {
        runtime: {
          kind: "component",
          runtimeNodeId: "runtime",
          sourceNodeId: "source",
          capabilityId: "run.desen.test/Card",
        },
      },
      runtimeNodeIdsBySourceNodeId: { source: ["runtime"] },
      runtimeNodeIdsByBehaviorId: {},
    });
    expect(() => {
      (index.runtimeNodeIdsBySourceNodeId.source as string[]).push("later");
    }).toThrow(TypeError);
  });

  it("never mutates an older index when a successor is built", () => {
    const first = built([COMPONENT_A]);
    const firstBytes = JSON.stringify(first);
    const second = built([COMPONENT_A, COMPONENT_B]);
    expect(second).not.toBe(first);
    expect(JSON.stringify(first)).toBe(firstBytes);
    expect(first.runtimeNodeIdsBySourceNodeId["source-shared"]).toEqual(["runtime-b"]);
    expect(second.runtimeNodeIdsBySourceNodeId["source-shared"]).toEqual([
      "runtime-a",
      "runtime-b",
    ]);
  });

  it("uses null-prototype records for prototype-sensitive identifiers", () => {
    const index = built([
      {
        kind: "component",
        runtimeNodeId: "__proto__",
        sourceNodeId: "constructor",
        capabilityId: "run.desen.test/Card",
      },
      {
        kind: "behavior",
        runtimeNodeId: "toString",
        sourceNodeId: "constructor",
        capabilityId: "run.desen.test/Sortable",
        behaviorId: "__proto__",
        ownerRuntimeNodeId: "__proto__",
      },
    ]);
    expect(Object.hasOwn(index.byRuntimeNodeId, "__proto__")).toBe(true);
    expect(index.byRuntimeNodeId.__proto__?.runtimeNodeId).toBe("__proto__");
    expect(index.runtimeNodeIdsBySourceNodeId.constructor).toEqual(["__proto__", "toString"]);
    expect(Object.hasOwn(index.runtimeNodeIdsByBehaviorId, "__proto__")).toBe(true);
    expect(index.runtimeNodeIdsByBehaviorId.__proto__).toEqual(["toString"]);
  });

  it("applies lower-only aggregate limits without returning a partial index", () => {
    expect(RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS).toEqual({
      maxBindings: 25_000,
      maxIdentifierOccurrences: 115_000,
      maxIdentifierCodeUnits: 4_194_304,
    });
    expect(buildRuntimeReactDiagnosticIndex([COMPONENT_A], { maxBindings: 0 })).toEqual({
      status: "invalid",
      reason: "binding-limit",
    });
    expect(
      buildRuntimeReactDiagnosticIndex([COMPONENT_A], { maxIdentifierOccurrences: 2 }),
    ).toEqual({
      status: "invalid",
      reason: "identifier-occurrence-limit",
    });
    expect(buildRuntimeReactDiagnosticIndex([COMPONENT_A], { maxIdentifierCodeUnits: 1 })).toEqual({
      status: "invalid",
      reason: "identifier-code-unit-limit",
    });
    expect(
      buildRuntimeReactDiagnosticIndex(
        [
          {
            kind: "component",
            runtimeNodeId: "same",
            sourceNodeId: "same",
            capabilityId: "same",
          },
        ],
        { maxIdentifierCodeUnits: 4 },
      ).status,
    ).toBe("built");
    expect(
      buildRuntimeReactDiagnosticIndex([], {
        maxBindings: RUNTIME_REACT_DIAGNOSTIC_INDEX_LIMITS.maxBindings + 1,
      }),
    ).toEqual({ status: "invalid", reason: "invalid-limits" });
    expect(buildRuntimeReactDiagnosticIndex([], { maxBindings: -1 })).toEqual({
      status: "invalid",
      reason: "invalid-limits",
    });
  });

  it("admits the complete 5,000-component plus 20,000-behavior renderer ceiling", () => {
    const components = Array.from({ length: 5_000 }, (_, index) => ({
      kind: "component" as const,
      runtimeNodeId: `c${String(index).padStart(4, "0")}`,
      sourceNodeId: "source",
      capabilityId: "component",
    }));
    const behaviors = Array.from({ length: 20_000 }, (_, index) => ({
      kind: "behavior" as const,
      runtimeNodeId: `b${String(index).padStart(5, "0")}`,
      sourceNodeId: "source",
      capabilityId: "behavior",
      behaviorId: "attached",
      ownerRuntimeNodeId: `c${String(index % 5_000).padStart(4, "0")}`,
    }));
    const complete = [...components, ...behaviors];
    const result = buildRuntimeReactDiagnosticIndex(complete);
    expect(result.status).toBe("built");
    if (result.status !== "built") return;
    expect(Object.keys(result.index.byRuntimeNodeId)).toHaveLength(25_000);
    expect(result.index.runtimeNodeIdsBySourceNodeId.source).toHaveLength(25_000);
    expect(result.index.runtimeNodeIdsByBehaviorId.attached).toHaveLength(20_000);

    expect(
      buildRuntimeReactDiagnosticIndex(complete, { maxIdentifierOccurrences: 114_999 }),
    ).toEqual({
      status: "invalid",
      reason: "identifier-occurrence-limit",
    });
  });

  it("rejects malformed identities, duplicate runtime ids, and incoherent behavior owners", () => {
    expect(
      buildRuntimeReactDiagnosticIndex([
        COMPONENT_A,
        { ...COMPONENT_B, runtimeNodeId: COMPONENT_A.runtimeNodeId },
      ]),
    ).toEqual({ status: "invalid", reason: "duplicate-runtime-node" });
    expect(buildRuntimeReactDiagnosticIndex([BEHAVIOR_A])).toEqual({
      status: "invalid",
      reason: "unknown-behavior-owner",
    });
    expect(
      buildRuntimeReactDiagnosticIndex([
        COMPONENT_A,
        { ...BEHAVIOR_A, sourceNodeId: "different-source" },
      ]),
    ).toEqual({ status: "invalid", reason: "behavior-owner-mismatch" });
    expect(buildRuntimeReactDiagnosticIndex([{ ...COMPONENT_A, runtimeNodeId: "" }])).toEqual({
      status: "invalid",
      reason: "invalid-input",
    });
    expect(
      buildRuntimeReactDiagnosticIndex([
        { ...COMPONENT_A, props: Object.freeze({ secret: true }) },
      ] as never),
    ).toEqual({ status: "invalid", reason: "invalid-input" });

    const sparse = new Array(1) as RuntimeReactDiagnosticIndexBinding[];
    expect(buildRuntimeReactDiagnosticIndex(sparse)).toEqual({
      status: "invalid",
      reason: "invalid-input",
    });
  });

  it("contains hostile reflection and never invokes or retains executable extras", () => {
    const callback = vi.fn();
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(accessor, {
      kind: { enumerable: true, value: "component" },
      runtimeNodeId: { enumerable: true, value: "runtime" },
      sourceNodeId: { enumerable: true, get: callback },
      capabilityId: { enumerable: true, value: "run.desen.test/Card" },
    });
    expect(buildRuntimeReactDiagnosticIndex([accessor] as never)).toEqual({
      status: "invalid",
      reason: "invalid-input",
    });
    expect(callback).not.toHaveBeenCalled();

    const target = { ...COMPONENT_A };
    const revoked = Proxy.revocable(target, {});
    revoked.revoke();
    expect(buildRuntimeReactDiagnosticIndex([revoked.proxy] as never)).toEqual({
      status: "invalid",
      reason: "invalid-input",
    });
  });
});
