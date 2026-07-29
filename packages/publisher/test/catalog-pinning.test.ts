import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as DesenProtocol from "@desen/protocol";
import type * as SourceNormalization from "../src/source-normalization.js";

const protocolProbe = vi.hoisted(() => ({
  digestCalls: [] as unknown[],
  secondDigestMode: "normal" as "invalid" | "normal" | "throw",
}));

const normalizationProbe = vi.hoisted(() => ({
  calls: [] as unknown[][],
  lastResult: undefined as unknown,
  transform: undefined as undefined | ((result: unknown) => unknown),
}));

vi.mock("@desen/protocol", async (importOriginal) => {
  const protocol = await importOriginal<typeof DesenProtocol>();
  return {
    ...protocol,
    calculateDesenSourceDigest(source: unknown): string {
      protocolProbe.digestCalls.push(source);
      if (protocolProbe.digestCalls.length === 2) {
        if (protocolProbe.secondDigestMode === "throw") {
          throw new TypeError("Injected T08 Source-digest authentication failure.");
        }
        if (protocolProbe.secondDigestMode === "invalid") return "invalid";
      }
      return protocol.calculateDesenSourceDigest(source);
    },
  };
});

vi.mock("../src/source-normalization.js", async (importOriginal) => {
  const normalization = await importOriginal<typeof SourceNormalization>();
  return {
    ...normalization,
    preflightPublishSourceNormalization(
      ...args: Parameters<typeof normalization.preflightPublishSourceNormalization>
    ): ReturnType<typeof normalization.preflightPublishSourceNormalization> {
      normalizationProbe.calls.push(args);
      const result = normalization.preflightPublishSourceNormalization(...args);
      normalizationProbe.lastResult = result;
      return (normalizationProbe.transform?.(result) ?? result) as ReturnType<
        typeof normalization.preflightPublishSourceNormalization
      >;
    },
  };
});

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import { canonicalizeJson, parseJsonPointer } from "@desen/protocol";

import {
  preflightPublishCatalogPinning,
  type PublishCatalogPinningResult,
  type PublishCatalogPinningSuccess,
} from "../src/catalog-pinning.js";
import * as publicPublisher from "../src/index.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  type PublishSourceNormalizationSuccess,
} from "../src/source-normalization.js";
import type { PublishFailure } from "../src/publish-result.js";

type MutableRecord = Record<string, unknown>;

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

function candidate(catalog: unknown = clone(validCatalog)): MutableRecord {
  const identity = record(catalog);
  return {
    id: identity.id,
    version: identity.version,
    target: identity.target,
    observedPackageDigest: identity.packageDigest,
    catalog,
  };
}

function secondaryCatalog(): MutableRecord {
  const catalog = clone(validCatalog) as unknown;
  const value = record(catalog);
  value.id = "com.example.secondary-catalog";
  value.version = "2.3.4";
  value.target = "future-native";
  value.packageDigest = `sha256:${"2".repeat(64)}`;
  value.description = "An inert secondary Catalog used to prove positional package alignment.";
  value.components = {};
  value.behaviors = {};
  value.operations = {};
  value.resources = {};
  return value;
}

function publish(
  source: unknown = clone(validSource),
  catalogs: readonly unknown[] = [clone(validCatalog)],
  limits = PUBLISH_SOURCE_NORMALIZATION_LIMITS,
): PublishCatalogPinningResult {
  return preflightPublishCatalogPinning(
    JSON.stringify(source),
    catalogs.map((catalog) => candidate(catalog)),
    limits,
  );
}

function isSuccess(result: PublishCatalogPinningResult): result is PublishCatalogPinningSuccess {
  return Object.getOwnPropertyDescriptor(result, "catalogsPinned")?.value === true;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    if (Array.isArray(value)) pending.push(...value);
    else pending.push(...Object.values(value));
  }
}

function expectNoPartialAuthority(result: PublishFailure): void {
  for (const field of [
    "bundle",
    "value",
    "source",
    "catalogSet",
    "packages",
    "requirementPackageIndexes",
    "obligations",
    "preservedDocument",
    "sourceCatalogRequirements",
    "traceability",
    "normalizedDocument",
    "pinnedDocument",
    "sourceDigest",
    "requires",
    "revision",
    "publication",
    "catalogsPinned",
    "sourceNormalized",
    "preservationPrepared",
    "executionPreflighted",
    "capabilityPreflighted",
    "preflighted",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
  expectDeepFrozen(result);
}

function expectFailure(
  result: PublishCatalogPinningResult,
  expected: Readonly<{ stage: PublishFailure["stage"]; code: string; pointer: string }>,
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected Catalog pinning to fail.");
  expect(result).toMatchObject({ ok: false, stage: expected.stage });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: expected.code,
      pointer: expected.pointer,
      severity: "error",
      stage: expected.stage,
    }),
  );
  expectNoPartialAuthority(result);
}

function normalizedSuccess(result: unknown): PublishSourceNormalizationSuccess {
  if (
    typeof result !== "object" ||
    result === null ||
    Object.getOwnPropertyDescriptor(result, "sourceNormalized")?.value !== true
  ) {
    throw new TypeError("The injected mutation requires a successful T07 result.");
  }
  return result as PublishSourceNormalizationSuccess;
}

function reverseObjectMembers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectMembers(entry));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entry]) => [key, reverseObjectMembers(entry)]),
  );
}

describe("M06-T08 Catalog pinning", () => {
  beforeEach(() => {
    protocolProbe.digestCalls = [];
    protocolProbe.secondDigestMode = "normal";
    normalizationProbe.calls = [];
    normalizationProbe.lastResult = undefined;
    normalizationProbe.transform = undefined;
  });

  it("calls T07 exactly once, re-authenticates its exact Source, and carries every authority", () => {
    const result = publish();

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected Catalog pinning to succeed.");
    const normalization = normalizedSuccess(normalizationProbe.lastResult);
    expect(normalizationProbe.calls).toHaveLength(1);
    expect(protocolProbe.digestCalls).toHaveLength(2);
    expect(protocolProbe.digestCalls[0]).toBe(normalization.source);
    expect(protocolProbe.digestCalls[1]).toBe(normalization.source);
    expect(result.sourceDigest).toBe(normalization.sourceDigest);
    for (const field of [
      "source",
      "catalogSet",
      "packages",
      "requirementPackageIndexes",
      "diagnostics",
      "obligations",
      "preservedDocument",
      "sourceCatalogRequirements",
      "traceability",
      "normalizedDocument",
    ] as const) {
      expect(result[field]).toBe(normalization[field]);
    }

    expect(result.pinnedDocument).toEqual({
      kind: "desen.bundle",
      desen: "0.1.0",
      id: validSource.id,
      sourceDigest: result.sourceDigest,
      requires: {
        catalogs: [
          {
            id: validCatalog.id,
            version: validCatalog.version,
            target: validCatalog.target,
            digest: validCatalog.packageDigest,
          },
        ],
      },
      entry: validSource.entry,
      surfaces: result.normalizedDocument.surfaces,
      extensions: result.normalizedDocument.extensions,
    });
    expect(result.pinnedDocument.surfaces).toBe(result.normalizedDocument.surfaces);
    expect(result.pinnedDocument).not.toHaveProperty("revision");
    expect(result.pinnedDocument).not.toHaveProperty("publication");
    expect(result.pinnedDocument).not.toHaveProperty("catalogs");
    expect(result).not.toHaveProperty("ok");
    expect(result).not.toHaveProperty("bundle");
    expect(result).not.toHaveProperty("revision");
    expect(result).not.toHaveProperty("publication");
    expectDeepFrozen(result);
  });

  it("fills an omitted target only from the selected package and preserves duplicate positions and opaque extensions", () => {
    const source = clone(validSource) as unknown;
    const requirement = record(array(record(source).catalogs)[0]);
    delete requirement.target;
    requirement.location = "registry://must-never-enter-production";
    requirement.extensions = {
      "dev.desen.test/opaque": {
        authoring: "semantic-inside-extension",
        digest: "not-authority",
        location: "opaque-location",
        order: ["third", "first", "second"],
        target: "opaque-target",
      },
    };
    array(record(source).catalogs).push(clone(requirement));

    const result = publish(source);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected duplicate requirements to pin.");
    expect(result.requirementPackageIndexes).toEqual([0, 0]);
    expect(result.packages).toHaveLength(1);
    expect(result.pinnedDocument.requires.catalogs).toHaveLength(2);
    expect(result.pinnedDocument.requires.catalogs.map(({ target }) => target)).toEqual([
      validCatalog.target,
      validCatalog.target,
    ]);
    expect(result.pinnedDocument.requires.catalogs[0]?.extensions).toBe(
      result.sourceCatalogRequirements[0]?.extensions,
    );
    expect(result.pinnedDocument.requires.catalogs[1]?.extensions).toBe(
      result.sourceCatalogRequirements[1]?.extensions,
    );
    expect(
      result.pinnedDocument.requires.catalogs[0]?.extensions?.["dev.desen.test/opaque"],
    ).toEqual(record(requirement.extensions)["dev.desen.test/opaque"]);
    expect(canonicalizeJson(result.pinnedDocument)).not.toContain(
      "registry://must-never-enter-production",
    );
    expect(canonicalizeJson(result.pinnedDocument)).toContain("opaque-location");
    for (const exact of result.pinnedDocument.requires.catalogs) {
      expect(Object.keys(exact).sort()).toEqual([
        "digest",
        "extensions",
        "id",
        "target",
        "version",
      ]);
      expect(exact).not.toHaveProperty("location");
    }
    expectDeepFrozen(result);
  });

  it("keeps discovery location out of exact tuples while retaining it in Source-digest semantics", () => {
    const firstSource = clone(validSource) as unknown;
    const secondSource = clone(validSource) as unknown;
    record(array(record(firstSource).catalogs)[0]).location = "https://registry-a.invalid/catalog";
    record(array(record(secondSource).catalogs)[0]).location = "file:///private/discovery/catalog";

    const first = publish(firstSource);
    const second = publish(secondSource);

    expect(isSuccess(first)).toBe(true);
    expect(isSuccess(second)).toBe(true);
    if (!isSuccess(first) || !isSuccess(second)) {
      throw new TypeError("Expected discovery-location variants to pin.");
    }
    expect(canonicalizeJson(first.pinnedDocument.requires)).toBe(
      canonicalizeJson(second.pinnedDocument.requires),
    );
    expect(first.sourceDigest).not.toBe(second.sourceDigest);
    expect(first.pinnedDocument.sourceDigest).toBe(first.sourceDigest);
    expect(second.pinnedDocument.sourceDigest).toBe(second.sourceDigest);
    expect(first.pinnedDocument.requires.catalogs[0]).not.toHaveProperty("location");
    expect(second.pinnedDocument.requires.catalogs[0]).not.toHaveProperty("location");
  });

  it("uses positional alignment rather than candidate order and never deduplicates A-B-A requirements", () => {
    const source = clone(validSource) as unknown;
    const primaryRequirement = clone(array(record(source).catalogs)[0]);
    const secondary = secondaryCatalog();
    const secondaryRequirement = {
      id: secondary.id,
      version: secondary.version,
      target: secondary.target,
      location: "registry://secondary-discovery",
      extensions: { "dev.desen.test/order": ["B"] },
    };
    record(source).catalogs = [
      primaryRequirement,
      secondaryRequirement,
      {
        ...clone(record(primaryRequirement)),
        extensions: { "dev.desen.test/order": ["A-again"] },
      },
    ];

    const result = publish(source, [secondary, clone(validCatalog)]);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected positional Catalog pinning to succeed.");
    expect(result.requirementPackageIndexes).toEqual([0, 1, 0]);
    expect(result.packages.map(({ id }) => id)).toEqual([validCatalog.id, secondary.id]);
    expect(result.pinnedDocument.requires.catalogs.map(({ id }) => id)).toEqual([
      validCatalog.id,
      secondary.id,
      validCatalog.id,
    ]);
    expect(result.pinnedDocument.requires.catalogs.map(({ digest }) => digest)).toEqual([
      validCatalog.packageDigest,
      secondary.packageDigest,
      validCatalog.packageDigest,
    ]);
    expect(canonicalizeJson(result.pinnedDocument)).not.toContain("registry://secondary-discovery");
  });

  it("is deterministic across independent allocations, candidate order, and object member order", () => {
    const source = clone(validSource) as unknown;
    const secondary = secondaryCatalog();
    record(source).catalogs = [
      clone(array(record(source).catalogs)[0]),
      {
        id: secondary.id,
        version: secondary.version,
        target: secondary.target,
        extensions: { "dev.desen.test/semantic-order": [3, 1, 2] },
      },
    ];

    const first = publish(source, [secondary, clone(validCatalog)]);
    const second = publish(reverseObjectMembers(source), [
      reverseObjectMembers(validCatalog),
      reverseObjectMembers(secondary),
    ]);
    expect(isSuccess(first)).toBe(true);
    expect(isSuccess(second)).toBe(true);
    if (!isSuccess(first) || !isSuccess(second)) {
      throw new TypeError("Expected deterministic pinning runs to succeed.");
    }
    expect(canonicalizeJson(first.pinnedDocument)).toBe(canonicalizeJson(second.pinnedDocument));
    expect(first.sourceDigest).toBe(second.sourceDigest);
  });

  it("passes an authenticated inherited failure through by exact identity without observing partial authority", () => {
    const result = preflightPublishCatalogPinning('{"kind":"desen.source",', []);

    expect(result).toBe(normalizationProbe.lastResult);
    expect(normalizationProbe.calls).toHaveLength(1);
    expect(protocolProbe.digestCalls).toHaveLength(0);
    expectFailure(result, {
      stage: "json-parse",
      code: "run.desen.publisher/INVALID_SOURCE_JSON",
      pointer: "",
    });
  });

  it("fails atomically at source-digest for forged, invalid, or unavailable digest authority", () => {
    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      return Object.freeze({ ...success, sourceDigest: `sha256:${"0".repeat(64)}` });
    };
    const forged = publish();
    expectFailure(forged, {
      stage: "source-digest",
      code: "SOURCE_DIGEST_MISMATCH",
      pointer: "/sourceDigest",
    });

    normalizationProbe.transform = undefined;
    protocolProbe.digestCalls = [];
    protocolProbe.secondDigestMode = "invalid";
    const invalid = publish();
    expectFailure(invalid, {
      stage: "source-digest",
      code: "SOURCE_DIGEST_MISMATCH",
      pointer: "/sourceDigest",
    });

    protocolProbe.digestCalls = [];
    protocolProbe.secondDigestMode = "throw";
    const unavailable = publish();
    expectFailure(unavailable, {
      stage: "source-digest",
      code: "SOURCE_DIGEST_MISMATCH",
      pointer: "/sourceDigest",
    });
  });

  it("rejects out-of-range, fractional, sparse, and reordered positional alignment atomically", () => {
    for (const indexes of [[1], [0.5], [0, 0], Object.assign(new Array(1), {})]) {
      normalizationProbe.transform = (value) => {
        const success = normalizedSuccess(value);
        const replacement =
          indexes.length === 1 && !(0 in indexes)
            ? Object.freeze(indexes)
            : Object.freeze([...indexes]);
        return Object.freeze({ ...success, requirementPackageIndexes: replacement });
      };
      protocolProbe.digestCalls = [];
      const result = publish();
      expectFailure(result, {
        stage: "catalog-pinning",
        code: "CATALOG_VERSION_UNAVAILABLE",
        pointer:
          indexes.length === 2 || !(0 in indexes) ? "/requires/catalogs" : "/requires/catalogs/0",
      });
    }
  });

  it("rejects package identity and digest drift against the selected execution Catalog", () => {
    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      const selected = success.packages[0];
      if (selected === undefined) throw new TypeError("Expected one selected package.");
      return Object.freeze({
        ...success,
        packages: Object.freeze([Object.freeze({ ...selected, target: "guessed-web-target" })]),
      });
    };
    const identityDrift = publish();
    expectFailure(identityDrift, {
      stage: "catalog-pinning",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/requires/catalogs/0",
    });

    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      const selected = success.packages[0];
      if (selected === undefined) throw new TypeError("Expected one selected package.");
      return Object.freeze({
        ...success,
        packages: Object.freeze([
          Object.freeze({ ...selected, packageDigest: `sha256:${"9".repeat(64)}` }),
        ]),
      });
    };
    protocolProbe.digestCalls = [];
    const digestDrift = publish();
    expectFailure(digestDrift, {
      stage: "catalog-pinning",
      code: "CATALOG_DIGEST_MISMATCH",
      pointer: "/requires/catalogs/0",
    });
  });

  it("rejects inherited or custom-prototype success discriminators instead of leaking a shell", () => {
    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      const prototype = Object.freeze({ sourceNormalized: true });
      const shell = Object.create(prototype) as MutableRecord;
      for (const [key, entry] of Object.entries(success)) {
        if (key !== "sourceNormalized") shell[key] = entry;
      }
      return Object.freeze(shell);
    };
    const inherited = publish();
    expectFailure(inherited, {
      stage: "catalog-pinning",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/requires/catalogs",
    });
    expect(protocolProbe.digestCalls).toHaveLength(1);

    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      return Object.freeze(Object.assign(Object.create({}), success));
    };
    protocolProbe.digestCalls = [];
    const customPrototype = publish();
    expectFailure(customPrototype, {
      stage: "catalog-pinning",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/requires/catalogs",
    });
  });

  it("suppresses inherited warnings on a later atomic pinning failure and retains them by identity on success", () => {
    const catalog = clone(validCatalog) as unknown;
    record(record(catalog).components)["com.example.ui/Stack"] = {
      ...record(record(record(catalog).components)["com.example.ui/Stack"]),
      deprecated: true,
    };
    const successful = publish(clone(validSource), [catalog]);
    expect(isSuccess(successful)).toBe(true);
    if (!isSuccess(successful))
      throw new TypeError("Expected deprecated use to remain publishable.");
    const normalization = normalizedSuccess(normalizationProbe.lastResult);
    expect(successful.diagnostics).toBe(normalization.diagnostics);
    expect(successful.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "run.desen.publisher/DEPRECATED_CAPABILITY",
        severity: "warning",
      }),
    );

    normalizationProbe.transform = (value) => {
      const success = normalizedSuccess(value);
      return Object.freeze({
        ...success,
        requirementPackageIndexes: Object.freeze([1]),
      });
    };
    protocolProbe.digestCalls = [];
    const rejected = publish(clone(validSource), [catalog]);
    expectFailure(rejected, {
      stage: "catalog-pinning",
      code: "CATALOG_VERSION_UNAVAILABLE",
      pointer: "/requires/catalogs/0",
    });
    expect(rejected.diagnostics).not.toContainEqual(
      expect.objectContaining({ code: "run.desen.publisher/DEPRECATED_CAPABILITY" }),
    );
  });

  it("normalizes hostile limits before Source or candidate observation", () => {
    const accessor = vi.fn(() => PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation);
    const profile = Object.create(null) as MutableRecord;
    Object.defineProperties(profile, {
      sourcePreservation: { enumerable: true, get: accessor },
      maxNormalizedDocumentCanonicalBytes: { enumerable: true, value: 2_097_152 },
    });

    expect(() => publish(clone(validSource), [clone(validCatalog)], profile as never)).toThrow(
      TypeError,
    );
    expect(accessor).not.toHaveBeenCalled();
    expect(normalizationProbe.calls).toHaveLength(0);
    expect(protocolProbe.digestCalls).toHaveLength(0);
  });

  it("keeps the entire M06-T08 operation and all terminal data absent from the package root", () => {
    expect(Object.hasOwn(publicPublisher, "preflightPublishCatalogPinning")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "PUBLISH_CATALOG_PINNING_LIMITS")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "CATALOG_PINNING_AUTHORITY_INVALID_CODE")).toBe(false);

    const result = publish();
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected private T08 operation to succeed.");
    expect(result.pinnedDocument).not.toHaveProperty("revision");
    expect(result.pinnedDocument).not.toHaveProperty("publication");
    expect(result).not.toHaveProperty("bundle");
    expect(result).not.toHaveProperty("ok");
    expect(parseJsonPointer("/requires/catalogs/0")).toEqual(["requires", "catalogs", "0"]);
  });
});
