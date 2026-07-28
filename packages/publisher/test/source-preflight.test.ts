import { describe, expect, it } from "vitest";

import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCapability from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import { resolvePublishCatalogs } from "../src/catalog-resolution.js";
import { INVALID_SOURCE_JSON_CODE } from "../src/publish-result.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  preflightPublishSource,
} from "../src/source-preflight.js";

import type { PublishFailure } from "../src/publish-result.js";
import type {
  PublishSourcePreflightLimits,
  PublishSourcePreflightResult,
  PublishSourcePreflightSuccess,
} from "../src/source-preflight.js";

type MutableRecord = Record<string, unknown>;

interface FailureExpectation {
  readonly stage: string;
  readonly code: string;
  readonly pointer?: string;
}

interface CandidateObservation {
  readonly input: unknown;
  readonly count: () => number;
}

const ALTERNATE_DIGEST = `sha256:${"1".repeat(64)}`;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label = "test fixture value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function array(value: unknown, label = "test fixture value"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function valueAt(root: unknown, path: readonly (number | string)[]): unknown {
  let current = root;
  for (const segment of path) {
    current =
      typeof segment === "number"
        ? array(current, `test fixture path ${path.join("/")}`)[segment]
        : record(current, `test fixture path ${path.join("/")}`)[segment];
  }
  return current;
}

function writeAt(root: unknown, path: readonly (number | string)[], value: unknown): void {
  const field = path.at(-1);
  if (field === undefined) throw new TypeError("A test mutation path must not be empty.");
  const parent = valueAt(root, path.slice(0, -1));
  if (typeof field === "number") {
    array(parent)[field] = value;
  } else {
    record(parent)[field] = value;
  }
}

function candidate(
  catalog: unknown = clone(validCatalog),
  overrides: Partial<{
    id: string;
    version: string;
    target: string;
    observedPackageDigest: string;
  }> = {},
): MutableRecord {
  return {
    id: validCatalog.id,
    version: validCatalog.version,
    target: validCatalog.target,
    observedPackageDigest: validCatalog.packageDigest,
    catalog,
    ...overrides,
  };
}

function limits(
  overrides: Partial<PublishSourcePreflightLimits>,
): Readonly<PublishSourcePreflightLimits> {
  return Object.freeze({ ...PUBLISH_SOURCE_PREFLIGHT_LIMITS, ...overrides });
}

function preflight(
  source: unknown,
  candidates: unknown = [candidate()],
  profile: Readonly<PublishSourcePreflightLimits> = PUBLISH_SOURCE_PREFLIGHT_LIMITS,
): PublishSourcePreflightResult {
  return preflightPublishSource(JSON.stringify(source), candidates, profile);
}

function isSuccess(result: PublishSourcePreflightResult): result is PublishSourcePreflightSuccess {
  return "preflighted" in result;
}

function expectNoPartialAuthority(result: PublishFailure): void {
  for (const field of [
    "bundle",
    "value",
    "source",
    "catalogSet",
    "packages",
    "requirementPackageIndexes",
    "preflighted",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
}

function expectFailure(
  result: PublishSourcePreflightResult,
  expectation: FailureExpectation,
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected Source preflight to fail.");
  expect(result).toMatchObject({
    ok: false,
    stage: expectation.stage,
  });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: expectation.code,
      ...(expectation.pointer === undefined ? {} : { pointer: expectation.pointer }),
      severity: "error",
      stage: expectation.stage,
    }),
  );
  expectNoPartialAuthority(result);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  result.diagnostics.forEach((diagnostic) => expect(Object.isFrozen(diagnostic)).toBe(true));
}

function expectDeepFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, visited);
}

function observedCandidateInventory(): CandidateObservation {
  let observations = 0;
  const handler: ProxyHandler<object> = {
    get(target, key, receiver) {
      observations += 1;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      observations += 1;
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    getPrototypeOf(target) {
      observations += 1;
      return Reflect.getPrototypeOf(target);
    },
    has(target, key) {
      observations += 1;
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      observations += 1;
      return Reflect.ownKeys(target);
    },
  };
  const trackedCandidate = new Proxy(candidate(), handler);
  const trackedInventory = new Proxy([trackedCandidate], handler);
  return Object.freeze({
    input: trackedInventory,
    count: () => observations,
  });
}

function diagnosticCodeUnits(diagnostic: PublishFailure["diagnostics"][number]): number {
  const context = diagnostic.context;
  return (
    diagnostic.code.length +
    diagnostic.message.length +
    (diagnostic.pointer?.length ?? 0) +
    (context?.documentId?.length ?? 0) +
    (context?.surfaceId?.length ?? 0) +
    (context?.subject?.kind.length ?? 0) +
    (context?.subject?.id.length ?? 0) +
    (context?.capabilityId?.length ?? 0)
  );
}

describe("package-private Source preflight", () => {
  it("prepares the official Source into one detached, deeply frozen downstream authority", () => {
    const mutableCatalog = clone(validCatalog);
    const offered = candidate(mutableCatalog);
    const first = preflight(validSource, [offered]);
    const second = preflight(clone(validSource), [candidate()]);

    expect(isSuccess(first)).toBe(true);
    if (!isSuccess(first)) throw new TypeError("Expected Source preflight to succeed.");
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      preflighted: true,
      diagnostics: [],
      requirementPackageIndexes: [0],
    });
    expect(first.source).toEqual(validSource);
    expect(first.catalogSet).toHaveLength(1);
    expect(first.packages).toHaveLength(1);
    expect(first.packages[0]).toMatchObject({
      id: validCatalog.id,
      version: validCatalog.version,
      target: validCatalog.target,
      packageDigest: validCatalog.packageDigest,
    });
    expect(first.packages[0]?.catalog).toBe(first.catalogSet[0]);
    expect(Object.hasOwn(first, "ok")).toBe(false);
    expect(Object.hasOwn(first, "bundle")).toBe(false);
    expect(Object.keys(first).sort()).toEqual([
      "catalogSet",
      "diagnostics",
      "packages",
      "preflighted",
      "requirementPackageIndexes",
      "source",
    ]);
    expectDeepFrozen(first);

    mutableCatalog.description = "caller mutation after preflight";
    offered.observedPackageDigest = ALTERNATE_DIGEST;
    expect(first.catalogSet[0]?.description).not.toBe("caller mutation after preflight");
    expect(first.packages[0]?.packageDigest).toBe(validCatalog.packageDigest);
  });

  it("stops at the earliest Source phase and performs zero candidate observations", () => {
    const embeddedSchemaFailure = clone(validSource);
    writeAt(embeddedSchemaFailure, ["surfaces", "sign-in", "state", "email", "schema"], {
      type: "not-a-json-schema-type",
    });
    const missingEntry = clone(validSource);
    writeAt(missingEntry, ["entry"], "missing");

    const cases = [
      {
        name: "json parse",
        raw: '{"kind":"desen.source",',
        stage: "json-parse",
        code: INVALID_SOURCE_JSON_CODE,
      },
      {
        name: "root Source schema",
        raw: JSON.stringify(sourceUnknownCoreField),
        stage: "source-schema",
        code: "UNKNOWN_CORE_FIELD",
      },
      {
        name: "embedded Draft 2020-12 schema",
        raw: JSON.stringify(embeddedSchemaFailure),
        stage: "embedded-schema",
        code: "SCHEMA_INVALID",
      },
      {
        name: "intrinsic duplicate identity",
        raw: JSON.stringify(sourceDuplicateNodeId),
        stage: "source-semantics",
        code: "DUPLICATE_NODE_ID",
      },
      {
        name: "missing entry identity",
        raw: JSON.stringify(missingEntry),
        stage: "source-semantics",
        code: "ENTRY_NOT_FOUND",
      },
    ] as const;

    for (const testCase of cases) {
      const observed = observedCandidateInventory();
      const result = preflightPublishSource(testCase.raw, observed.input);
      expectFailure(result, { stage: testCase.stage, code: testCase.code });
      expect(observed.count(), `${testCase.name} observed candidate input`).toBe(0);
    }

    const observed = observedCandidateInventory();
    expect(isSuccess(preflightPublishSource(JSON.stringify(validSource), observed.input))).toBe(
      true,
    );
    expect(observed.count()).toBeGreaterThan(0);
  });

  it("preserves M06-T02 failures byte-for-byte instead of remapping their stages or diagnostics", () => {
    const namespaceSource = clone(validSource);
    const secondRequirement = {
      id: "com.example.second-catalog",
      version: validCatalog.version,
      target: validCatalog.target,
    };
    array(record(namespaceSource).catalogs).push(secondRequirement);

    const namespaceCandidates = (): unknown[] => {
      const secondCatalog = clone(validCatalog);
      secondCatalog.id = secondRequirement.id;
      return [
        candidate(),
        candidate(secondCatalog, {
          id: secondRequirement.id,
        }),
      ];
    };
    const cases = [
      {
        source: validSource,
        candidates: (): unknown[] => [],
        stage: "catalog-resolution",
        code: "CATALOG_VERSION_UNAVAILABLE",
      },
      {
        source: validSource,
        candidates: (): unknown[] => [
          candidate(validCatalog, { observedPackageDigest: ALTERNATE_DIGEST }),
        ],
        stage: "catalog-integrity",
        code: "CATALOG_DIGEST_MISMATCH",
      },
      {
        source: namespaceSource,
        candidates: namespaceCandidates,
        stage: "namespace-conflicts",
        code: "AMBIGUOUS_CAPABILITY",
      },
    ] as const;

    for (const testCase of cases) {
      const source = record(testCase.source);
      const expected = resolvePublishCatalogs(
        source.catalogs,
        testCase.candidates(),
        source.id as string,
      );
      const actual = preflight(testCase.source, testCase.candidates());
      expect(actual).toEqual(expected);
      expectFailure(actual, { stage: testCase.stage, code: testCase.code });
    }
  });

  it("runs Catalog integrity before Catalog-backed static-reference validation", () => {
    const unavailable = preflight(sourceUnknownCapability, []);
    expectFailure(unavailable, {
      stage: "catalog-resolution",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/catalogs/0",
    });

    const inconsistentDigest = preflight(sourceUnknownCapability, [
      candidate(validCatalog, { observedPackageDigest: ALTERNATE_DIGEST }),
    ]);
    expectFailure(inconsistentDigest, {
      stage: "catalog-integrity",
      code: "CATALOG_DIGEST_MISMATCH",
      pointer: "/catalogs/0",
    });

    const referenceFailure = preflight(sourceUnknownCapability);
    expectFailure(referenceFailure, {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
      pointer: "/surfaces/home/root/slots/default/0/use",
    });
  });

  it("rejects category-aware component, behavior, operation, and resource references", () => {
    const wrongOperationKind = clone(validSource);
    writeAt(
      wrongOperationKind,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "operation"],
      "com.example.ui/Button",
    );
    const wrongBehaviorKind = clone(exampleSortableSource);
    writeAt(
      wrongBehaviorKind,
      ["surfaces", "tasks", "root", "behaviors", 0, "use"],
      "com.example.ui/Stack",
    );
    const wrongResourceKind = clone(exampleStoreMapSource);
    writeAt(
      wrongResourceKind,
      ["surfaces", "stores", "resources", "stores", "use"],
      "com.example.auth/signIn",
    );
    const cases = [
      {
        source: sourceUnknownCapability,
        pointer: "/surfaces/home/root/slots/default/0/use",
      },
      {
        source: wrongBehaviorKind,
        pointer: "/surfaces/tasks/root/behaviors/0/use",
      },
      {
        source: wrongOperationKind,
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/operation",
      },
      {
        source: wrongResourceKind,
        pointer: "/surfaces/stores/resources/stores/use",
      },
    ];

    for (const testCase of cases) {
      expectFailure(preflight(testCase.source), {
        stage: "source-semantics",
        code: "UNKNOWN_CAPABILITY",
        pointer: testCase.pointer,
      });
    }
  });

  it("keeps T04 prop/event contracts and T05 dynamic bindings outside the T03 scope fence", () => {
    const invalidPropContract = clone(validSource);
    writeAt(
      invalidPropContract,
      ["surfaces", "home", "root", "slots", "default", 0, "props", "role"],
      42,
    );
    const unresolvedDynamicBinding = clone(validSource);
    writeAt(
      unresolvedDynamicBinding,
      ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value", "$ref"],
      "state.notDeclared",
    );

    for (const source of [sourceUnknownEvent, invalidPropContract, unresolvedDynamicBinding]) {
      const result = preflight(source);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected the T03 scope fence to pass.");
      expect(result.diagnostics).toEqual([]);
      expect(Object.hasOwn(result, "bundle")).toBe(false);
    }
  });

  it("enforces diagnostic count, pointer, and aggregate budgets at exact boundaries", () => {
    const multipleIdentityFailures = clone(sourceDuplicateNodeId);
    writeAt(multipleIdentityFailures, ["entry"], "missing");
    writeAt(multipleIdentityFailures, ["surfaces", "home", "id"], "mismatched-home");

    const unboundedIdentity = preflight(multipleIdentityFailures);
    expectFailure(unboundedIdentity, {
      stage: "source-semantics",
      code: "ENTRY_NOT_FOUND",
    });
    expect(unboundedIdentity.diagnostics).toHaveLength(3);

    const exactCount = preflight(
      multipleIdentityFailures,
      [candidate()],
      limits({ maxDiagnosticsPerStoppedStage: unboundedIdentity.diagnostics.length }),
    );
    expectFailure(exactCount, {
      stage: "source-semantics",
      code: "ENTRY_NOT_FOUND",
    });
    expect(exactCount.diagnostics).toHaveLength(unboundedIdentity.diagnostics.length);

    const exceededCount = preflight(
      multipleIdentityFailures,
      [candidate()],
      limits({ maxDiagnosticsPerStoppedStage: unboundedIdentity.diagnostics.length - 1 }),
    );
    expectFailure(exceededCount, {
      stage: "source-semantics",
      code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      pointer: "",
    });
    expect(exceededCount.diagnostics).toHaveLength(1);

    const reference = preflight(sourceUnknownCapability);
    expectFailure(reference, {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
    });
    expect(reference.diagnostics).toHaveLength(1);
    const referenceDiagnostic = reference.diagnostics[0];
    const pointerUnits = referenceDiagnostic.pointer?.length ?? 0;
    const aggregateUnits = diagnosticCodeUnits(referenceDiagnostic);

    const exactPointer = preflight(
      sourceUnknownCapability,
      [candidate()],
      limits({ maxDiagnosticPointerCodeUnits: pointerUnits }),
    );
    expectFailure(exactPointer, {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
    });

    const exceededPointer = preflight(
      sourceUnknownCapability,
      [candidate()],
      limits({ maxDiagnosticPointerCodeUnits: pointerUnits - 1 }),
    );
    expectFailure(exceededPointer, {
      stage: "source-semantics",
      code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      pointer: "",
    });

    const exactAggregate = preflight(
      sourceUnknownCapability,
      [candidate()],
      limits({ maxAggregateDiagnosticCodeUnits: aggregateUnits }),
    );
    expectFailure(exactAggregate, {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
    });

    const exceededAggregate = preflight(
      sourceUnknownCapability,
      [candidate()],
      limits({ maxAggregateDiagnosticCodeUnits: aggregateUnits - 1 }),
    );
    expectFailure(exceededAggregate, {
      stage: "source-semantics",
      code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      pointer: "",
    });

    const observed = observedCandidateInventory();
    const longAncestor = "x".repeat(
      PUBLISH_SOURCE_PREFLIGHT_LIMITS.maxDiagnosticPointerCodeUnits + 1,
    );
    const inheritedJsonFailure = preflightPublishSource(
      `{"${longAncestor}":{"duplicate":1,"duplicate":2}}`,
      observed.input,
    );
    expectFailure(inheritedJsonFailure, {
      stage: "json-parse",
      code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      pointer: "",
    });
    expect(observed.count()).toBe(0);

    const inheritedCatalogFailure = preflight(
      validSource,
      [],
      limits({ maxAggregateDiagnosticCodeUnits: 1 }),
    );
    expectFailure(inheritedCatalogFailure, {
      stage: "catalog-resolution",
      code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
      pointer: "",
    });
  });

  it("rejects hostile custom limit profiles without invoking accessors or leaking their values", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      { ...PUBLISH_SOURCE_PREFLIGHT_LIMITS },
      "maxDiagnosticsPerStoppedStage",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("PRIVATE-PREFLIGHT-LIMIT");
        },
      },
    );
    const missing = { ...PUBLISH_SOURCE_PREFLIGHT_LIMITS } as MutableRecord;
    Reflect.deleteProperty(missing, "maxDiagnosticsPerStoppedStage");
    const extra = { ...PUBLISH_SOURCE_PREFLIGHT_LIMITS, extra: 1 };
    const nonEnumerable = { ...PUBLISH_SOURCE_PREFLIGHT_LIMITS };
    Object.defineProperty(nonEnumerable, "maxDiagnosticsPerStoppedStage", {
      enumerable: false,
      value: PUBLISH_SOURCE_PREFLIGHT_LIMITS.maxDiagnosticsPerStoppedStage,
    });
    const revoked = Proxy.revocable({ ...PUBLISH_SOURCE_PREFLIGHT_LIMITS }, {});
    revoked.revoke();

    for (const profile of [
      limits({ maxDiagnosticsPerStoppedStage: 0 }),
      missing,
      extra,
      accessor,
      nonEnumerable,
      revoked.proxy,
    ]) {
      expect(() =>
        preflightPublishSource(
          JSON.stringify(validSource),
          [candidate()],
          profile as PublishSourcePreflightLimits,
        ),
      ).toThrow("exact own-data positive-integer profile");
    }
    expect(getterCalls).toBe(0);
  });

  it("returns one atomic failure shell when late static validation rejects the Source", () => {
    const result = preflight(sourceUnknownCapability);
    expectFailure(result, {
      stage: "source-semantics",
      code: "UNKNOWN_CAPABILITY",
      pointer: "/surfaces/home/root/slots/default/0/use",
    });
    expectDeepFrozen(result);
    expect(JSON.stringify(result)).not.toContain("observedPackageDigest");
    expect(JSON.stringify(result)).not.toContain("requirementPackageIndexes");
  });
});
