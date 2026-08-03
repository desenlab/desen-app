import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { canonicalizeJsonBytes } from "@desen/protocol";
import { validateDesenBundle, validateDesenSource } from "@desen/validator";
import { beforeAll, describe, expect, it } from "vitest";

import { verifyBundleStoreEntryInternal } from "../src/bundle-verification-internal.js";
import { guardBundleVerificationStructure } from "../src/bundle-verification-schema-guard.js";

import type { BundleStoreEntry } from "../src/index.js";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const VALID_FIXTURE_DIRECTORY = join(
  WORKSPACE_ROOT,
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid",
);
const OFFICIAL_SOURCE_PATH = join(VALID_FIXTURE_DIRECTORY, "sign-in.source.json");
const OFFICIAL_BUNDLE_PATH = join(VALID_FIXTURE_DIRECTORY, "sign-in.bundle.json");

let officialSource: Record<string, unknown>;
let officialBundle: Record<string, unknown>;

function jsonRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

async function loadJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function entryForBundle(bundle: Record<string, unknown>): BundleStoreEntry {
  return { revision: String(bundle.revision), bytes: canonicalizeJsonBytes(bundle) };
}

function firstSurface(document: Record<string, unknown>): Record<string, unknown> {
  const surfaces = jsonRecord(document.surfaces, "surfaces");
  const surfaceId = Object.keys(surfaces).sort()[0];
  if (surfaceId === undefined) throw new TypeError("Expected one frozen surface.");
  return jsonRecord(surfaces[surfaceId], "surface");
}

function fanOutState(schema: Record<string, unknown>, count = 10_000): Record<string, unknown> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `s${index}`,
      { schema: cloneJson(schema), initial: null },
    ]),
  );
}

beforeAll(async () => {
  officialSource = jsonRecord(await loadJson(OFFICIAL_SOURCE_PATH), "official Source");
  officialBundle = jsonRecord(await loadJson(OFFICIAL_BUNDLE_PATH), "official Bundle");
});

describe("M07-T02 fail-fast structural guards", () => {
  it("matches exhaustive structural success across every frozen valid Source and Bundle fixture", async () => {
    const fixtureNames = (await readdir(VALID_FIXTURE_DIRECTORY)).sort();
    const documents = await Promise.all(
      fixtureNames
        .filter((name) => name.endsWith(".source.json") || name.endsWith(".bundle.json"))
        .map(async (name) => ({
          name,
          value: await loadJson(join(VALID_FIXTURE_DIRECTORY, name)),
        })),
    );
    expect(documents.length).toBeGreaterThan(0);
    for (const { name, value } of documents) {
      const target = name.endsWith(".source.json") ? "source" : "bundle";
      const guard = guardBundleVerificationStructure(target, value as never);
      const exhaustive =
        target === "source" ? validateDesenSource(value) : validateDesenBundle(value);
      expect(guard, name).toEqual({ valid: true });
      expect(exhaustive.valid, name).toBe(true);
    }
  });

  it("cuts off custom embedded-schema fan-out before either exhaustive validator", () => {
    const bundle = cloneJson(officialBundle);
    firstSurface(bundle).state = fanOutState({ $ref: "https://attacker.invalid/schema" });
    const source = cloneJson(officialSource);
    firstSurface(source).state = fanOutState({ $ref: "https://attacker.invalid/schema" });
    let bundleCalls = 0;
    let sourceCalls = 0;
    const ports = {
      validateBundle(value: unknown) {
        bundleCalls += 1;
        return validateDesenBundle(value);
      },
      validateSource(value: unknown) {
        sourceCalls += 1;
        return validateDesenSource(value);
      },
    };

    const bundleResult = verifyBundleStoreEntryInternal(
      entryForBundle(bundle),
      { status: "not-available" },
      ports,
    );
    expect(bundleResult).toMatchObject({
      status: "rejected",
      stage: "bundle-schema",
      diagnostics: [{ code: "SCHEMA_INVALID" }],
    });
    expect(bundleResult.status === "rejected" ? bundleResult.diagnostics : []).toHaveLength(1);
    expect(bundleCalls).toBe(0);

    const officialEntry = entryForBundle(officialBundle);
    const sourceResult = verifyBundleStoreEntryInternal(
      officialEntry,
      { status: "available", sourceBytes: canonicalizeJsonBytes(source) },
      ports,
    );
    expect(sourceResult).toMatchObject({
      status: "rejected",
      stage: "source-schema",
      diagnostics: [{ code: "SCHEMA_INVALID" }],
    });
    expect(sourceResult.status === "rejected" ? sourceResult.diagnostics : []).toHaveLength(1);
    expect(sourceCalls).toBe(0);
  });

  it("cuts off Draft meta-schema fan-out before exhaustive validation", () => {
    const bundle = cloneJson(officialBundle);
    firstSurface(bundle).state = fanOutState({ type: 7 });
    let exhaustiveCalls = 0;
    const result = verifyBundleStoreEntryInternal(
      entryForBundle(bundle),
      { status: "not-available" },
      {
        validateBundle(value: unknown) {
          exhaustiveCalls += 1;
          return validateDesenBundle(value);
        },
        validateSource: validateDesenSource,
      },
    );
    expect(result).toMatchObject({
      status: "rejected",
      stage: "bundle-schema",
      diagnostics: [{ code: "SCHEMA_INVALID" }],
    });
    expect(result.status === "rejected" ? result.diagnostics : []).toHaveLength(1);
    expect(exhaustiveCalls).toBe(0);
  });

  it("cuts off root child-array diagnostic fan-out before exhaustive validation", () => {
    const bundle = cloneJson(officialBundle);
    const root = jsonRecord(firstSurface(bundle).root, "surface root");
    root.slots = { default: Array.from({ length: 10_000 }, () => ({})) };
    let exhaustiveCalls = 0;
    const result = verifyBundleStoreEntryInternal(
      entryForBundle(bundle),
      { status: "not-available" },
      {
        validateBundle(value: unknown) {
          exhaustiveCalls += 1;
          return validateDesenBundle(value);
        },
        validateSource: validateDesenSource,
      },
    );

    expect(result).toMatchObject({
      status: "rejected",
      stage: "bundle-schema",
      diagnostics: [{ code: "SCHEMA_INVALID" }],
    });
    expect(result.status === "rejected" ? result.diagnostics : []).toHaveLength(1);
    expect(exhaustiveCalls).toBe(0);
  });

  it("stops one embedded schema at its first custom-profile issue", () => {
    const bundle = cloneJson(officialBundle);
    const invalidBranches = Array.from({ length: 10_000 }, () => ({
      $ref: "https://attacker.invalid/schema",
      pattern: "[",
    }));
    firstSurface(bundle).state = {
      unsafe: { schema: { allOf: invalidBranches }, initial: null },
    };
    let exhaustiveCalls = 0;
    const result = verifyBundleStoreEntryInternal(
      entryForBundle(bundle),
      { status: "not-available" },
      {
        validateBundle(value: unknown) {
          exhaustiveCalls += 1;
          return validateDesenBundle(value);
        },
        validateSource: validateDesenSource,
      },
    );

    expect(result).toMatchObject({
      status: "rejected",
      stage: "bundle-schema",
      diagnostics: [
        {
          code: "SCHEMA_INVALID",
          pointer: expect.stringContaining("/allOf/0/$ref"),
        },
      ],
    });
    expect(result.status === "rejected" ? result.diagnostics : []).toHaveLength(1);
    expect(exhaustiveCalls).toBe(0);
  });

  it("retains one stable root code and offending-property pointer", () => {
    const unknown = cloneJson(officialBundle);
    unknown.unexpected = true;
    expect(guardBundleVerificationStructure("bundle", unknown as never)).toEqual({
      valid: false,
      code: "UNKNOWN_CORE_FIELD",
      pointer: "/unexpected",
    });

    const missing = cloneJson(officialBundle);
    delete missing.entry;
    expect(guardBundleVerificationStructure("bundle", missing as never)).toEqual({
      valid: false,
      code: "SCHEMA_INVALID",
      pointer: "/entry",
    });
  });
});
