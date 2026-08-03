import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { validateDesenStructure } from "@desen/validator";
import { beforeAll, describe, expect, it } from "vitest";

import { validatePackagePreflightCatalogGuard } from "../src/generated/0.1.0/package-preflight-catalog-guard.js";
import { guardPackagePreflightCatalogStructure } from "../src/package-preflight-schema-guard.js";

const FIXTURE_ROOT = resolve(import.meta.dirname, "../../..");
const OFFICIAL_CATALOG_PATH = join(
  FIXTURE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json",
);

let officialCatalog: Record<string, unknown>;

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function entries(value: unknown, label: string): readonly [string, Record<string, unknown>][] {
  return Object.entries(record(value, label)).map(([key, entry]) => [
    key,
    record(entry, `${label}/${key}`),
  ]);
}

function firstWithField(
  value: unknown,
  field: string,
  label: string,
): readonly [string, Record<string, unknown>] {
  const found = entries(value, label).find(([, entry]) => Object.hasOwn(entry, field));
  if (found === undefined) throw new TypeError(`${label} needs a ${field} fixture.`);
  return found;
}

beforeAll(async () => {
  officialCatalog = record(
    JSON.parse(await readFile(OFFICIAL_CATALOG_PATH, "utf8")),
    "Official Catalog",
  );
});

describe("M07-T03 deterministic fail-fast Catalog guard", () => {
  it("accepts the official Catalog with generated-root and exhaustive-validator parity", () => {
    expect(validatePackagePreflightCatalogGuard(officialCatalog)).toBe(true);
    expect(guardPackagePreflightCatalogStructure(officialCatalog)).toEqual({ valid: true });
    expect(validateDesenStructure("catalog", officialCatalog).valid).toBe(true);
  });

  it("matches exhaustive rejection for closed-root, required-field, and capability-shape drift", () => {
    const mutations = [
      { ...cloneJson(officialCatalog), unknownCoreField: true },
      (() => {
        const catalog = cloneJson(officialCatalog);
        delete catalog.packageDigest;
        return catalog;
      })(),
      { ...cloneJson(officialCatalog), components: { "com.example/invalid": null } },
    ];
    for (const mutation of mutations) {
      const guarded = guardPackagePreflightCatalogStructure(mutation);
      expect(guarded.valid).toBe(false);
      expect(validateDesenStructure("catalog", mutation).valid).toBe(false);
      if (!guarded.valid) expect(["SCHEMA_INVALID", "UNKNOWN_CORE_FIELD"]).toContain(guarded.code);
    }
  });

  it("covers every component, behavior, operation, and resource embedded-schema location", () => {
    const mutations: Record<string, unknown>[] = [];

    for (const groupName of ["components", "behaviors"] as const) {
      for (const [recordName, schemaName] of [
        ["events", "payloadSchema"],
        ["commands", "inputSchema"],
        ["styleParts", "propertiesSchema"],
      ] as const) {
        const catalog = cloneJson(officialCatalog);
        const group = record(catalog[groupName], groupName);
        const owners = entries(group, groupName);
        const [, owner] =
          owners.find(([, entry]) => Object.hasOwn(entry, recordName)) ??
          (owners[0] as [string, Record<string, unknown>]);
        if (!Object.hasOwn(owner, recordName)) {
          owner[recordName] = { synthetic: { [schemaName]: { type: "object" } } };
        }
        const [, nestedOwner] = entries(owner[recordName], recordName)[0] as [
          string,
          Record<string, unknown>,
        ];
        nestedOwner[schemaName] = { $schema: "https://json-schema.org/draft/2019-09/schema" };
        mutations.push(catalog);
      }

      const catalog = cloneJson(officialCatalog);
      const group = record(catalog[groupName], groupName);
      const [, owner] = firstWithField(group, "propsSchema", groupName);
      owner.propsSchema = { pattern: "[" };
      mutations.push(catalog);
    }

    for (const groupName of ["operations", "resources"] as const) {
      for (const schemaName of ["inputSchema", "outputSchema"] as const) {
        const catalog = cloneJson(officialCatalog);
        const [, owner] = entries(catalog[groupName], groupName)[0] as [
          string,
          Record<string, unknown>,
        ];
        owner[schemaName] = { $ref: "https://example.invalid/external-schema" };
        mutations.push(catalog);
      }
    }

    expect(mutations).toHaveLength(12);
    for (const mutation of mutations) {
      const guarded = guardPackagePreflightCatalogStructure(mutation);
      expect(guarded.valid).toBe(false);
      expect(validateDesenStructure("catalog", mutation).valid).toBe(false);
    }
  });

  it("returns only one stable first issue for a 10,000-declaration invalid root fanout", () => {
    const catalog = {
      ...cloneJson(officialCatalog),
      components: Object.fromEntries(
        Array.from({ length: 10_000 }, (_, index) => [
          `com.example.invalid/component-${String(index)}`,
          null,
        ]),
      ),
      behaviors: {},
      operations: {},
      resources: {},
    };
    const guarded = guardPackagePreflightCatalogStructure(catalog);
    expect(guarded).toMatchObject({ valid: false, code: "SCHEMA_INVALID" });
    if (!guarded.valid) expect(guarded.pointer).toMatch(/^\/components\//u);
  });

  it("returns only one first issue for 10,000 valid envelopes carrying invalid embedded schemas", () => {
    const catalog = {
      ...cloneJson(officialCatalog),
      components: Object.fromEntries(
        Array.from({ length: 10_000 }, (_, index) => [
          `com.example.invalid/embedded-${String(index)}`,
          {
            propsSchema: {
              $schema: "https://json-schema.org/draft/2019-09/schema",
              type: "object",
            },
          },
        ]),
      ),
      behaviors: {},
      operations: {},
      resources: {},
    };
    expect(validatePackagePreflightCatalogGuard(catalog)).toBe(true);
    const guarded = guardPackagePreflightCatalogStructure(catalog);
    expect(guarded).toMatchObject({ valid: false, code: "SCHEMA_INVALID" });
    if (!guarded.valid) expect(guarded.pointer).toMatch(/\/propsSchema\/\$schema$/u);
  });
});
