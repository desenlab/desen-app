import { describe, expect, it } from "vitest";

import validCatalogFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  PUBLISH_CATALOG_RESOLUTION_LIMITS,
  resolvePublishCatalogs,
} from "../src/catalog-resolution.js";

import type { PublishCatalogResolutionLimits } from "../src/catalog-resolution.js";

type MutableRecord = Record<string, unknown>;

const DIGEST_B = `sha256:${"1".repeat(64)}`;

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected a mutable test record.");
  }
  return value as MutableRecord;
}

function requirement(
  overrides: Partial<{
    id: string;
    version: string;
    target: string;
    location: string;
  }> = {},
): MutableRecord {
  return {
    id: validCatalogFixture.id,
    version: validCatalogFixture.version,
    target: validCatalogFixture.target,
    ...overrides,
  };
}

function candidate(
  catalog: unknown = clone(validCatalogFixture),
  overrides: Partial<{
    id: string;
    version: string;
    target: string;
    observedPackageDigest: string;
  }> = {},
): MutableRecord {
  return {
    id: validCatalogFixture.id,
    version: validCatalogFixture.version,
    target: validCatalogFixture.target,
    observedPackageDigest: validCatalogFixture.packageDigest,
    catalog,
    ...overrides,
  };
}

function limits(
  overrides: Partial<PublishCatalogResolutionLimits>,
): Readonly<PublishCatalogResolutionLimits> {
  return Object.freeze({ ...PUBLISH_CATALOG_RESOLUTION_LIMITS, ...overrides });
}

function expectFailure(
  result: ReturnType<typeof resolvePublishCatalogs>,
  stage: string,
  code: string,
  pointer: string,
): void {
  expect("resolved" in result).toBe(false);
  if ("resolved" in result) throw new TypeError("Expected Catalog resolution to fail.");
  expect(result).toMatchObject({ ok: false, stage });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, pointer, severity: "error", stage }),
  );
  expect(Object.hasOwn(result, "bundle")).toBe(false);
  expect(Object.hasOwn(result, "catalogSet")).toBe(false);
  expect(Object.hasOwn(result, "packages")).toBe(false);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
}

function expectDeepFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, visited);
}

describe("package-private exact Catalog resolution", () => {
  it("selects one exact tuple, detaches it, and returns no Bundle-shaped partial value", () => {
    const catalog = clone(validCatalogFixture);
    const offered = candidate(catalog);
    const result = resolvePublishCatalogs([requirement()], [offered], "com.example.document");

    expect("resolved" in result && result.resolved).toBe(true);
    if (!("resolved" in result)) throw new TypeError("Expected Catalog resolution to succeed.");
    expect(result.packages).toHaveLength(1);
    expect(result.requirementPackageIndexes).toEqual([0]);
    expect(result.packages[0]).toMatchObject({
      id: validCatalogFixture.id,
      version: validCatalogFixture.version,
      target: validCatalogFixture.target,
      packageDigest: validCatalogFixture.packageDigest,
    });
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);
    expect(result.packages[0]?.catalog).not.toBe(catalog);
    expect(result.diagnostics).toEqual([]);
    expect(Object.hasOwn(result, "bundle")).toBe(false);
    expectDeepFrozen(result);

    record(catalog).description = "caller mutation";
    record(offered).observedPackageDigest = DIGEST_B;
    expect(result.packages[0]?.catalog.description).not.toBe("caller mutation");
    expect(result.packages[0]?.packageDigest).toBe(validCatalogFixture.packageDigest);
  });

  it("preserves duplicate Source requirement alignment while selecting one semantic package", () => {
    const requirements = [
      requirement({ location: "https://first.invalid/catalog.json" }),
      requirement({ location: "file:///second-untrusted-hint.json" }),
    ];
    const result = resolvePublishCatalogs(requirements, [candidate()]);

    expect("resolved" in result).toBe(true);
    if (!("resolved" in result)) throw new TypeError("Expected Catalog resolution to succeed.");
    expect(result.packages).toHaveLength(1);
    expect(result.catalogSet).toHaveLength(1);
    expect(result.requirementPackageIndexes).toEqual([0, 0]);
    expect(JSON.stringify(result)).not.toContain("first.invalid");
    expect(JSON.stringify(result)).not.toContain("file://");
  });

  it("resolves an omitted target only when id/version has exactly one candidate", () => {
    const withoutTarget = requirement();
    delete withoutTarget.target;
    const unique = resolvePublishCatalogs([withoutTarget], [candidate()]);
    expect("resolved" in unique).toBe(true);

    const otherTargetCatalog = clone(validCatalogFixture) as MutableRecord;
    otherTargetCatalog.target = "native-swift";
    const ambiguous = resolvePublishCatalogs(
      [withoutTarget],
      [
        candidate(),
        candidate(otherTargetCatalog, {
          target: "native-swift",
        }),
      ],
    );
    expectFailure(ambiguous, "catalog-resolution", "CATALOG_VERSION_UNAVAILABLE", "/catalogs/0");
  });

  it("rejects missing candidates instead of selecting a range, latest version, or location hint", () => {
    for (const missingRequirement of [
      requirement({ version: "1.0.1" }),
      requirement({ target: "Web-React" }),
      requirement({ id: `${validCatalogFixture.id} ` }),
      requirement({ id: validCatalogFixture.id.replace("example", "e\u0301xample") }),
      requirement({ location: "https://trusted-looking.invalid/catalog.json", target: "other" }),
    ]) {
      const result = resolvePublishCatalogs([missingRequirement], [candidate()]);
      expectFailure(result, "catalog-resolution", "CATALOG_VERSION_UNAVAILABLE", "/catalogs/0");
    }
  });

  it("rejects multiple candidates for one exact target even when one appears first or has matching bytes", () => {
    const changedDigestCatalog = clone(validCatalogFixture) as MutableRecord;
    changedDigestCatalog.packageDigest = DIGEST_B;
    const differentDigest = candidate(changedDigestCatalog, {
      observedPackageDigest: DIGEST_B,
    });

    for (const candidates of [
      [candidate(), differentDigest],
      [differentDigest, candidate()],
      [candidate(), candidate()],
    ]) {
      const result = resolvePublishCatalogs([requirement()], candidates);
      expectFailure(result, "catalog-resolution", "CATALOG_VERSION_UNAVAILABLE", "/catalogs/0");
    }
  });

  it("rejects malformed candidate envelopes globally without reading an active Catalog getter", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      {
        id: validCatalogFixture.id,
        version: validCatalogFixture.version,
        target: validCatalogFixture.target,
        observedPackageDigest: validCatalogFixture.packageDigest,
      },
      "catalog",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return validCatalogFixture;
        },
      },
    );
    const result = resolvePublishCatalogs([requirement()], [accessor]);

    expectFailure(
      result,
      "catalog-resolution",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
      "/catalogs",
    );
    expect(getterCalls).toBe(0);
  });

  it("contains reflection failures from revoked and throwing Proxy inputs", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    let trapCalls = 0;
    const throwing = new Proxy(candidate(), {
      ownKeys() {
        trapCalls += 1;
        throw new Error("private proxy error");
      },
    });

    for (const hostile of [revoked.proxy, throwing]) {
      const result = resolvePublishCatalogs([requirement()], [hostile]);
      expectFailure(
        result,
        "catalog-resolution",
        "run.desen.publisher/INVALID_CATALOG_INPUT",
        "/catalogs",
      );
      expect(JSON.stringify(result)).not.toContain("private proxy error");
    }
    expect(trapCalls).toBeGreaterThan(0);
  });

  it("captures a stateful Catalog Proxy once before canonicalization", () => {
    const target = clone(validCatalogFixture) as MutableRecord;
    target.description = "bounded";
    let descriptionReads = 0;
    const stateful = new Proxy(target, {
      getOwnPropertyDescriptor(object, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
        if (key !== "description" || descriptor === undefined) return descriptor;
        descriptionReads += 1;
        return {
          ...descriptor,
          value: descriptionReads === 1 ? "bounded" : "x".repeat(20_000),
        };
      },
    });
    const result = resolvePublishCatalogs(
      [requirement()],
      [candidate(stateful)],
      undefined,
      limits({ maxCatalogStringCodeUnits: 12_000 }),
    );

    expect("resolved" in result).toBe(true);
    if (!("resolved" in result)) throw new TypeError("Expected one-pass capture to succeed.");
    expect(result.catalogSet[0]?.description).toBe("bounded");
    expect(descriptionReads).toBe(1);
  });

  it("rejects own undefined target, invalid document identity, and malformed unselected envelopes", () => {
    const undefinedTarget = requirement();
    undefinedTarget.target = undefined;
    expectFailure(
      resolvePublishCatalogs([undefinedTarget], [candidate()]),
      "catalog-resolution",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
      "/catalogs",
    );

    expectFailure(
      resolvePublishCatalogs([requirement()], [candidate()], "\ud800"),
      "catalog-resolution",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
      "/catalogs",
    );

    expectFailure(
      resolvePublishCatalogs(
        [requirement()],
        [
          candidate(),
          candidate(validCatalogFixture, {
            id: "com.example.unselected",
            version: "latest",
            observedPackageDigest: "bad",
          }),
        ],
      ),
      "catalog-resolution",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
      "/catalogs",
    );
  });

  it("rejects cycles, invalid Unicode, non-finite numbers, and decorated arrays in selected Catalogs", () => {
    const cyclic = clone(validCatalogFixture) as MutableRecord;
    cyclic.extensions = {};
    record(cyclic.extensions).self = cyclic;

    const invalidUnicode = clone(validCatalogFixture) as MutableRecord;
    invalidUnicode.description = "\ud800";

    const nonFinite = clone(validCatalogFixture) as MutableRecord;
    nonFinite.description = Number.POSITIVE_INFINITY;

    const decoratedArray = clone(validCatalogFixture) as MutableRecord;
    decoratedArray.authoring = { values: [] };
    const values = record(decoratedArray.authoring).values as unknown[];
    Object.defineProperty(values, "extra", { enumerable: true, value: true });

    for (const catalog of [cyclic, invalidUnicode, nonFinite, decoratedArray]) {
      expectFailure(
        resolvePublishCatalogs([requirement()], [candidate(catalog)]),
        "catalog-integrity",
        "run.desen.publisher/INVALID_CATALOG_INPUT",
        "/catalogs/0",
      );
    }
  });

  it("rejects invalid Catalog JSON and schema at the integrity stage", () => {
    const accessorCatalog = Object.defineProperty({}, "kind", {
      enumerable: true,
      get() {
        throw new Error("must not escape");
      },
    });
    const invalidSchemaCatalog = clone(validCatalogFixture) as MutableRecord;
    delete invalidSchemaCatalog.resources;

    for (const invalidCatalog of [accessorCatalog, invalidSchemaCatalog]) {
      const result = resolvePublishCatalogs([requirement()], [candidate(invalidCatalog)]);
      expect("resolved" in result).toBe(false);
      if ("resolved" in result) throw new TypeError("Expected Catalog resolution to fail.");
      expect(result.stage).toBe("catalog-integrity");
      expect(result.diagnostics[0]?.pointer).toBe("/catalogs/0");
      expect(Object.hasOwn(result, "bundle")).toBe(false);
    }
  });

  it("rejects envelope identity and package-digest inconsistencies at Catalog integrity", () => {
    const mismatchedIdentity = clone(validCatalogFixture) as MutableRecord;
    mismatchedIdentity.id = "com.example.other";
    const identityResult = resolvePublishCatalogs([requirement()], [candidate(mismatchedIdentity)]);
    expectFailure(
      identityResult,
      "catalog-integrity",
      "run.desen.publisher/INVALID_CATALOG_INPUT",
      "/catalogs/0",
    );

    const digestResult = resolvePublishCatalogs(
      [requirement()],
      [candidate(validCatalogFixture, { observedPackageDigest: DIGEST_B })],
    );
    expectFailure(digestResult, "catalog-integrity", "CATALOG_DIGEST_MISMATCH", "/catalogs/0");
  });

  it("detects cross-Catalog namespace conflicts only after exact integrity passes", () => {
    const second = clone(validCatalogFixture) as MutableRecord;
    second.id = "com.example.second-catalog";
    const result = resolvePublishCatalogs(
      [requirement(), requirement({ id: "com.example.second-catalog" })],
      [candidate(), candidate(second, { id: "com.example.second-catalog" })],
      "com.example.document",
    );

    expectFailure(result, "namespace-conflicts", "AMBIGUOUS_CAPABILITY", "/catalogs/1");
    if ("resolved" in result) throw new TypeError("Expected a namespace failure.");
    expect(result.diagnostics[0]?.context).toMatchObject({
      documentId: "com.example.document",
    });
    expect(result.diagnostics[0]?.context?.capabilityId).toMatch(/^com\.example\./u);
    expect(JSON.stringify(result)).not.toContain("/components/");
  });

  it("enforces finite requirement and candidate counts before resolution", () => {
    const tooManyRequirements = resolvePublishCatalogs(
      [requirement(), requirement()],
      [candidate()],
      undefined,
      limits({ maxRequirements: 1 }),
    );
    expectFailure(
      tooManyRequirements,
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      "/catalogs",
    );

    const tooManyCandidates = resolvePublishCatalogs(
      [requirement()],
      [candidate(), candidate()],
      undefined,
      limits({ maxCandidates: 1 }),
    );
    expectFailure(
      tooManyCandidates,
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      "/catalogs",
    );
  });

  it("caps resolution diagnostics and identity strings before indexing candidates", () => {
    const diagnostics = resolvePublishCatalogs(
      [
        requirement({ id: "com.example.missing-one" }),
        requirement({ id: "com.example.missing-two" }),
      ],
      [candidate()],
      undefined,
      limits({ maxDiagnostics: 1 }),
    );
    expectFailure(
      diagnostics,
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      "/catalogs",
    );
    if ("resolved" in diagnostics) throw new TypeError("Expected diagnostic limit failure.");
    expect(diagnostics.diagnostics).toHaveLength(1);

    const identity = resolvePublishCatalogs(
      [requirement()],
      [candidate()],
      "document-id",
      limits({ maxIdentityStringCodeUnits: 4 }),
    );
    expectFailure(
      identity,
      "catalog-resolution",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      "/catalogs",
    );
    if ("resolved" in identity) throw new TypeError("Expected identity limit failure.");
    expect(identity.diagnostics[0]?.context).toBeUndefined();
    expect(JSON.stringify(identity)).not.toContain("document-id");
  });

  it("enforces selected Catalog depth, value, string, byte, and capability limits", () => {
    const profiles = [
      [limits({ maxCatalogDepth: 1 }), "/catalogs/0"],
      [limits({ maxCatalogValueOccurrences: 10 }), "/catalogs/0"],
      [limits({ maxCatalogStringCodeUnits: 10 }), "/catalogs/0"],
      [
        limits({
          maxCatalogCanonicalBytes: 1,
          maxAggregateCatalogCanonicalBytes: 1,
        }),
        "/catalogs/0",
      ],
      [limits({ maxCapabilityDeclarations: 1 }), "/catalogs/0"],
    ];
    for (const [profile, pointer] of profiles) {
      const result = resolvePublishCatalogs(
        [requirement()],
        [candidate()],
        undefined,
        profile as Readonly<PublishCatalogResolutionLimits>,
      );
      expectFailure(
        result,
        "catalog-integrity",
        "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
        pointer as string,
      );
    }
  });

  it("stops oversized Catalog strings and keys before scanning Unicode beyond the budget", () => {
    const oversizedWithLateInvalidSurrogate = `${"x".repeat(20_000)}\ud800`;
    const valueCatalog = clone(validCatalogFixture) as MutableRecord;
    valueCatalog.description = oversizedWithLateInvalidSurrogate;
    const keyCatalog = clone(validCatalogFixture) as MutableRecord;
    keyCatalog[oversizedWithLateInvalidSurrogate] = null;

    for (const catalog of [valueCatalog, keyCatalog]) {
      const result = resolvePublishCatalogs(
        [requirement()],
        [candidate(catalog)],
        undefined,
        limits({ maxCatalogStringCodeUnits: 12_000 }),
      );
      expectFailure(
        result,
        "catalog-integrity",
        "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
        "/catalogs/0",
      );
    }
  });

  it("enforces the aggregate selected-Catalog byte ceiling independently", () => {
    const second = clone(validCatalogFixture) as MutableRecord;
    second.id = "com.example.second-catalog";
    second.components = {};
    second.behaviors = {};
    second.operations = {};
    second.resources = {};
    const result = resolvePublishCatalogs(
      [requirement(), requirement({ id: "com.example.second-catalog" })],
      [candidate(), candidate(second, { id: "com.example.second-catalog" })],
      undefined,
      limits({
        maxCatalogCanonicalBytes: 11_500,
        maxAggregateCatalogCanonicalBytes: 11_500,
      }),
    );
    expect("resolved" in result).toBe(false);
    if ("resolved" in result) throw new TypeError("Expected aggregate Catalog limit failure.");
    expect(result.stage).toBe("catalog-integrity");
    expect(result.diagnostics[0]?.code).toBe("run.desen.publisher/CATALOG_LIMIT_EXCEEDED");
  });

  it("caps namespace diagnostics before a hostile Catalog set can emit an unbounded report", () => {
    const second = clone(validCatalogFixture) as MutableRecord;
    second.id = "com.example.second-catalog";
    const result = resolvePublishCatalogs(
      [requirement(), requirement({ id: "com.example.second-catalog" })],
      [candidate(), candidate(second, { id: "com.example.second-catalog" })],
      undefined,
      limits({ maxDiagnostics: 1 }),
    );
    expectFailure(
      result,
      "namespace-conflicts",
      "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
      "/catalogs",
    );
    if ("resolved" in result) throw new TypeError("Expected diagnostic-limit failure.");
    expect(result.diagnostics).toHaveLength(1);
  });

  it("is deterministic across candidate allocations and never exposes input indexes", () => {
    const first = resolvePublishCatalogs([requirement()], [candidate()]);
    const second = resolvePublishCatalogs(clone([requirement()]), clone([candidate()]));
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toContain("candidateIndex");
    expect(JSON.stringify(first)).not.toContain("observedPackageDigest");
  });

  it("rejects invalid custom limit profiles as programmer errors", () => {
    expect(() =>
      resolvePublishCatalogs(
        [requirement()],
        [candidate()],
        undefined,
        limits({ maxCandidates: 0 }),
      ),
    ).toThrow("exact own-data positive-integer profile");
    expect(() =>
      resolvePublishCatalogs(
        [requirement()],
        [candidate()],
        undefined,
        limits({
          maxCatalogCanonicalBytes: 10,
          maxAggregateCatalogCanonicalBytes: 5,
        }),
      ),
    ).toThrow("cannot exceed");
  });

  it("rejects missing, extra, accessor, non-enumerable, and revoked limit profiles without leakage", () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      { ...PUBLISH_CATALOG_RESOLUTION_LIMITS },
      "maxCandidates",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("PRIVATE-LIMIT-SECRET");
        },
      },
    );
    const missing = { ...PUBLISH_CATALOG_RESOLUTION_LIMITS } as MutableRecord;
    delete missing.maxCandidates;
    const extra = { ...PUBLISH_CATALOG_RESOLUTION_LIMITS, extra: 1 };
    const nonEnumerable = { ...PUBLISH_CATALOG_RESOLUTION_LIMITS };
    Object.defineProperty(nonEnumerable, "maxCandidates", {
      enumerable: false,
      value: PUBLISH_CATALOG_RESOLUTION_LIMITS.maxCandidates,
    });
    const revoked = Proxy.revocable({ ...PUBLISH_CATALOG_RESOLUTION_LIMITS }, {});
    revoked.revoke();

    for (const profile of [missing, extra, accessor, nonEnumerable, revoked.proxy]) {
      expect(() =>
        resolvePublishCatalogs(
          [requirement()],
          [candidate()],
          undefined,
          profile as PublishCatalogResolutionLimits,
        ),
      ).toThrow("exact own-data positive-integer profile");
    }
    expect(getterCalls).toBe(0);
  });
});
