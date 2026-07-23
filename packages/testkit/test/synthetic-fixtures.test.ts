import { registerOperation, registerResource } from "@desen/catalog-sdk";
import { describe, expect, it } from "vitest";

import {
  createSyntheticFixtureSnapshot,
  lookupSyntheticOperationError,
  lookupSyntheticOperationSuccess,
  lookupSyntheticResourceFixture,
  SYNTHETIC_FIXTURE_CONTEXT,
} from "../src/index.js";

import type {
  CreateSyntheticFixtureSnapshotInput,
  SyntheticFixtureSnapshot,
  SyntheticFixtureValue,
} from "../src/index.js";
import type { RegisteredOperation, RegisteredResource } from "@desen/catalog-sdk";

function operation(
  id = "com.example.math/calculate",
  fixtures: Readonly<Record<string, SyntheticFixtureValue>> = {
    success: {
      zeta: "last",
      result: { value: 42 },
    },
    errors: {
      INVALID_INPUT: { field: "synthetic-input" },
    },
  },
) {
  return registerOperation({
    id,
    manifest: {
      description: "Host-owned calculation contract.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "number" } },
      },
      outputSchema: {
        type: "object",
        properties: { result: { type: "object" } },
      },
      errors: [{ code: "INVALID_INPUT" }, { code: "UNAVAILABLE" }],
      effect: "none",
      authoring: {
        fixtures,
        extensions: { note: "This metadata must not enter the fixture snapshot." },
      },
      extensions: { owner: "identity" },
    },
  });
}

function resource(id = "com.example.records/list") {
  return registerResource({
    id,
    manifest: {
      description: "Host-owned record lookup contract.",
      inputSchema: { type: "object" },
      outputSchema: { type: "array" },
      errors: [{ code: "UNAVAILABLE" }],
      policies: ["mount", "manual"],
      cacheHints: { ttlSeconds: 30 },
      authoring: {
        fixtures: {
          populated: [{ id: "synthetic-record" }],
          empty: [],
        },
        extensions: { note: "This metadata must not enter the fixture snapshot." },
      },
    },
  });
}

function snapshot(
  operations: readonly RegisteredOperation[] = [operation()],
  resources: readonly RegisteredResource[] = [resource()],
): SyntheticFixtureSnapshot {
  return createSyntheticFixtureSnapshot({
    context: SYNTHETIC_FIXTURE_CONTEXT,
    operations,
    resources,
  });
}

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Object.keys(value)) {
    expectDeeplyFrozen((value as Record<string, unknown>)[key]);
  }
}

function invoke(input: unknown): SyntheticFixtureSnapshot {
  return createSyntheticFixtureSnapshot(input as CreateSyntheticFixtureSnapshotInput);
}

function forgedOperation(
  fixtures: unknown,
  errors: readonly Readonly<{ code: string }>[] = [{ code: "DECLARED" }],
): RegisteredOperation {
  return {
    id: "com.example.operations/forged",
    manifest: {
      inputSchema: {},
      outputSchema: {},
      errors,
      effect: "none",
      authoring: { fixtures },
    },
  } as unknown as RegisteredOperation;
}

describe("synthetic fixture snapshots", () => {
  it("projects only authoring fixtures into detached canonical deeply frozen JSON", () => {
    const calculation = operation("com.example.z/calculate");
    const calculate = operation("com.example.a/calculate", {
      success: { zebra: 1, alpha: { zulu: false, beta: true } },
    });
    const records = resource();
    const result = snapshot([calculation, calculate], [records]);

    expect(result).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      operations: {
        "com.example.a/calculate": {
          success: { alpha: { beta: true, zulu: false }, zebra: 1 },
        },
        "com.example.z/calculate": {
          errors: {
            INVALID_INPUT: { field: "synthetic-input" },
          },
          success: {
            result: { value: 42 },
            zeta: "last",
          },
        },
      },
      resources: {
        "com.example.records/list": {
          empty: [],
          populated: [{ id: "synthetic-record" }],
        },
      },
    });
    expect(Object.keys(result.operations)).toEqual([
      "com.example.a/calculate",
      "com.example.z/calculate",
    ]);
    expect(Object.keys(result.operations["com.example.a/calculate"]?.success ?? {})).toEqual([
      "alpha",
      "zebra",
    ]);
    expect(Object.keys(result.operations["com.example.z/calculate"] ?? {})).toEqual([
      "errors",
      "success",
    ]);
    expect(result.operations["com.example.z/calculate"]?.success).not.toBe(
      calculation.manifest.authoring?.fixtures?.success,
    );
    expect(result.resources["com.example.records/list"]).not.toBe(
      records.manifest.authoring?.fixtures,
    );
    expect(result.operations["com.example.z/calculate"]).not.toHaveProperty("description");
    expect(result.operations["com.example.z/calculate"]).not.toHaveProperty("inputSchema");
    expect(result.resources["com.example.records/list"]).not.toHaveProperty("cacheHints");
    expect(result.context).not.toBe(SYNTHETIC_FIXTURE_CONTEXT);
    expectDeeplyFrozen(result);
  });

  it("returns detached frozen found results for operation success and public errors", () => {
    const fixtures = snapshot();
    const success = lookupSyntheticOperationSuccess(fixtures, "com.example.math/calculate");
    const error = lookupSyntheticOperationError(
      fixtures,
      "com.example.math/calculate",
      "INVALID_INPUT",
    );

    expect(success).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "found",
      value: {
        result: { value: 42 },
        zeta: "last",
      },
    });
    expect(error).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "found",
      value: { field: "synthetic-input" },
    });
    if (success.status === "found") {
      expect(success.value).not.toBe(fixtures.operations["com.example.math/calculate"]?.success);
    }
    expectDeeplyFrozen(success);
    expectDeeplyFrozen(error);
  });

  it("returns detached frozen found results for named resource outputs", () => {
    const fixtures = snapshot();
    const result = lookupSyntheticResourceFixture(
      fixtures,
      "com.example.records/list",
      "populated",
    );

    expect(result).toEqual({
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "found",
      value: [{ id: "synthetic-record" }],
    });
    if (result.status === "found") {
      expect(result.value).not.toBe(fixtures.resources["com.example.records/list"]?.populated);
    }
    expectDeeplyFrozen(result);
  });

  it("represents every absent capability, path, or fixture with an explicit missing result", () => {
    const fixtures = snapshot();
    const missing = {
      context: SYNTHETIC_FIXTURE_CONTEXT,
      status: "missing",
    };

    expect(lookupSyntheticOperationSuccess(fixtures, "com.example.missing/run")).toEqual(missing);
    expect(
      lookupSyntheticOperationError(fixtures, "com.example.math/calculate", "UNAVAILABLE"),
    ).toEqual(missing);
    expect(
      lookupSyntheticOperationError(fixtures, "com.example.math/calculate", "NOT_DECLARED"),
    ).toEqual(missing);
    expect(
      lookupSyntheticResourceFixture(fixtures, "com.example.records/list", "not-declared"),
    ).toEqual(missing);
    expect(lookupSyntheticResourceFixture(fixtures, "com.example.missing/list", "default")).toEqual(
      missing,
    );
    expectDeeplyFrozen(lookupSyntheticOperationSuccess(fixtures, "com.example.missing/run"));
  });

  it("keeps registered capabilities with no authoring fixtures as explicit empty maps", () => {
    const noFixtureOperation = operation("com.example.operations/noFixture", {});
    const noFixtureResource = registerResource({
      id: "com.example.resources/noFixture",
      manifest: {
        inputSchema: {},
        outputSchema: {},
        errors: [],
        policies: ["manual"],
      },
    });
    const result = snapshot([noFixtureOperation], [noFixtureResource]);

    expect(result.operations).toEqual({
      "com.example.operations/noFixture": {},
    });
    expect(result.resources).toEqual({
      "com.example.resources/noFixture": {},
    });
  });

  it("rejects operation error fixtures whose codes are not publicly declared", () => {
    const invalid = forgedOperation({
      errors: { NOT_DECLARED: { message: "Synthetic failure" } },
    });

    expect(() => snapshot([invalid], [])).toThrowError(
      /error code "NOT_DECLARED" is not declared by the operation/,
    );
  });

  it("rejects operations that omit their required public-error declaration", () => {
    const withoutErrors = {
      id: "com.example.operations/noErrors",
      manifest: {
        inputSchema: {},
        outputSchema: {},
        effect: "none",
        authoring: { fixtures: { success: { synthetic: true } } },
      },
    } as unknown as RegisteredOperation;

    expect(() => snapshot([withoutErrors], [])).toThrowError(
      /expected the required public-error array/,
    );
  });

  it("requires the exported context singleton and rejects duplicate capability ids", () => {
    expect(() =>
      invoke({
        context: { ...SYNTHETIC_FIXTURE_CONTEXT },
        operations: [],
        resources: [],
      }),
    ).toThrowError(/expected SYNTHETIC_FIXTURE_CONTEXT/);
    const first = operation("com.example.operations/duplicate", {});
    const second = operation("com.example.operations/duplicate", {});
    expect(() => snapshot([first, second], [])).toThrowError(/duplicate operation id/);
    const firstResource = resource("com.example.resources/duplicate");
    const secondResource = resource("com.example.resources/duplicate");
    expect(() => snapshot([], [firstResource, secondResource])).toThrowError(
      /duplicate resource id/,
    );
  });

  it("rejects wrong capability categories and ids reused across categories", () => {
    const calculation = operation("com.example.shared/capability");
    const records = resource("com.example.shared/capability");

    expect(() => snapshot([records as unknown as RegisteredOperation], [])).toThrowError(
      /expected a declared operation effect/,
    );
    expect(() => snapshot([], [calculation as unknown as RegisteredResource])).toThrowError(
      /expected unique declared resource policies/,
    );
    expect(() => snapshot([calculation], [records])).toThrowError(
      /is already registered as an operation/,
    );
  });

  it("rejects bounded-depth, node-count, and canonical-byte overflows as stable TypeErrors", () => {
    let deep: Record<string, unknown> = {};
    for (let depth = 0; depth < 100; depth += 1) deep = { next: deep };

    const tooDeep = () => snapshot([forgedOperation({ success: deep })], []);
    const tooWide = () =>
      snapshot(
        [forgedOperation({ success: Array.from({ length: 20_001 }, (_, index) => index) })],
        [],
      );
    const tooLarge = () => snapshot([forgedOperation({ success: "x".repeat(1_048_577) })], []);

    for (const [invokeInvalid, pattern] of [
      [tooDeep, /64-level depth limit/],
      [tooWide, /20000-node limit/],
      [tooLarge, /1048576-byte canonical input limit/],
    ] as const) {
      expect(invokeInvalid).toThrowError(TypeError);
      expect(invokeInvalid).toThrowError(pattern);
    }
  });

  it("rejects forged snapshots and non-string lookup paths before property coercion", () => {
    let trapCalls = 0;
    const forged = new Proxy(
      {},
      {
        get() {
          trapCalls += 1;
          return {};
        },
      },
    ) as SyntheticFixtureSnapshot;

    expect(() =>
      lookupSyntheticOperationSuccess(forged, "com.example.math/calculate"),
    ).toThrowError(/expected a snapshot created by createSyntheticFixtureSnapshot/);
    expect(trapCalls).toBe(0);

    const fixtures = snapshot();
    const forgedName = {
      toString() {
        trapCalls += 1;
        return "com.example.math/calculate";
      },
    };
    expect(() =>
      lookupSyntheticOperationSuccess(fixtures, forgedName as unknown as string),
    ).toThrowError(/expected a string/);
    expect(trapCalls).toBe(0);
  });

  it("rejects binding fields, unsupported operation fixture paths, and extra wrapper data", () => {
    const calculation = operation();
    const cases: readonly unknown[] = [
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [calculation],
        resources: [],
        endpoint: "https://production.invalid",
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [calculation],
        resources: [],
        execute: () => null,
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [calculation],
        resources: [],
        mode: "production",
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [{ ...calculation, endpoint: "https://production.invalid" }],
        resources: [],
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [
          {
            ...calculation,
            manifest: {
              ...calculation.manifest,
              execute: "forged-binding",
            },
          },
        ],
        resources: [],
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [],
        resources: [
          {
            ...resource(),
            manifest: {
              ...resource().manifest,
              endpoint: "https://production.invalid",
            },
          },
        ],
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [forgedOperation({ success: {}, loading: {} })],
        resources: [],
      },
      {
        context: SYNTHETIC_FIXTURE_CONTEXT,
        operations: [forgedOperation({ success: {}, callback: () => null })],
        resources: [],
      },
    ];

    for (const value of cases) {
      expect(() => invoke(value)).toThrow(TypeError);
    }
  });

  it("rejects accessors, cycles, exotic objects, and non-finite fixture numbers", () => {
    let getterCalls = 0;
    const accessorFixture: Record<string, unknown> = {};
    Object.defineProperty(accessorFixture, "success", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return {};
      },
    });

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    const invalidFixtures = [
      accessorFixture,
      { success: cycle },
      { success: new Date(0) },
      { success: new Map([["synthetic", true]]) },
      { success: Number.NaN },
      { success: Number.POSITIVE_INFINITY },
    ];
    for (const fixtures of invalidFixtures) {
      expect(() => snapshot([forgedOperation(fixtures)], [])).toThrow(TypeError);
    }
    expect(getterCalls).toBe(0);
  });
});
