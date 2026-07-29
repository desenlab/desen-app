import { describe, expect, it } from "vitest";

import officialBundleFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import officialSourceFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import officialCatalogFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import {
  calculateDesenBundleRevision,
  canonicalizeJson,
  canonicalizeJsonBytes,
  sha256Hex,
} from "@desen/protocol";

import * as publisherPackageRoot from "../src/index.js";
import { publishDesenSource } from "../src/index.js";
import type {
  PublishCatalogPackageCandidate,
  PublishResult,
  PublishSuccess,
} from "../src/index.js";

const OFFICIAL_REVISION = "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601";
const OFFICIAL_SOURCE_DIGEST =
  "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878";
const OFFICIAL_PUBLICATION_FREE_BUNDLE_SHA256 =
  "fac0ee3d559528af2f4274cdfb21979463cbadd419f2faba584263cc8b4c0247";
const OFFICIAL_PUBLICATION_FREE_BUNDLE_BYTES = 2_173;

type MutableJsonRecord = Record<string, unknown>;

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label: string): MutableJsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value as MutableJsonRecord;
}

function reverseRootMembers(value: unknown, label: string): MutableJsonRecord {
  return Object.fromEntries(Object.entries(record(value, label)).reverse());
}

function freshCandidate(reverseCatalogRoot = false): PublishCatalogPackageCandidate {
  const clonedCatalog = cloneJson(officialCatalogFixture);
  const catalog = reverseCatalogRoot
    ? reverseRootMembers(clonedCatalog, "Official Catalog")
    : record(clonedCatalog, "Official Catalog");
  return {
    id: String(catalog.id),
    version: String(catalog.version),
    target: String(catalog.target),
    observedPackageDigest: String(catalog.packageDigest),
    catalog,
  };
}

function expectSuccess(result: PublishResult): asserts result is PublishSuccess {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("Expected the official Source publication to succeed.");
}

function expectRecursivelyFrozen(root: unknown): void {
  const pending: unknown[] = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor) pending.push(descriptor.value);
    }
  }
}

function collectGraphObjects(root: unknown): Set<object> {
  const objects = new Set<object>();
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || objects.has(value)) continue;
    objects.add(value);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor) pending.push(descriptor.value);
    }
  }
  return objects;
}

function expectDisjointGraphs(left: unknown, right: unknown): void {
  const leftObjects = collectGraphObjects(left);
  const rightObjects = collectGraphObjects(right);
  for (const object of leftObjects) expect(rightObjects.has(object)).toBe(false);
}

function projectOfficialBundleWithoutRootPublication(
  fixture: unknown = officialBundleFixture,
): MutableJsonRecord {
  const projected = record(cloneJson(fixture), "Official Bundle");
  const keysBefore = Object.keys(projected);
  const publication = Object.getOwnPropertyDescriptor(projected, "publication");
  if (
    publication === undefined ||
    !publication.enumerable ||
    !("value" in publication) ||
    publication.value === null ||
    typeof publication.value !== "object" ||
    Array.isArray(publication.value)
  ) {
    throw new TypeError("The frozen official Bundle must contain one root publication object.");
  }
  if (!Reflect.deleteProperty(projected, "publication")) {
    throw new TypeError("The root publication member could not be projected.");
  }
  expect(Object.keys(projected).sort()).toEqual(
    keysBefore.filter((key) => key !== "publication").sort(),
  );
  return projected;
}

function publishOfficial(
  source: unknown = cloneJson(officialSourceFixture),
  candidate: PublishCatalogPackageCandidate = freshCandidate(),
): Readonly<{
  result: PublishResult;
  sourceText: string;
  candidate: PublishCatalogPackageCandidate;
}> {
  const sourceText = JSON.stringify(source);
  return {
    result: publishDesenSource(sourceText, [candidate]),
    sourceText,
    candidate,
  };
}

describe("M06-T10 official Source-to-Bundle golden", () => {
  it("matches the frozen official Bundle after removing exactly root publication", () => {
    const expected = projectOfficialBundleWithoutRootPublication();
    const source = cloneJson(officialSourceFixture);
    const candidate = freshCandidate();
    const sourceBefore = canonicalizeJson(source);
    const catalogBefore = canonicalizeJson(candidate.catalog);

    const result = publishDesenSource(JSON.stringify(source), [candidate]);
    expectSuccess(result);

    const actualBytes = canonicalizeJsonBytes(result.bundle);
    const expectedBytes = canonicalizeJsonBytes(expected);
    expect(actualBytes).toEqual(expectedBytes);
    expect(actualBytes.byteLength).toBe(OFFICIAL_PUBLICATION_FREE_BUNDLE_BYTES);
    expect(sha256Hex(actualBytes)).toBe(OFFICIAL_PUBLICATION_FREE_BUNDLE_SHA256);
    expect(result.bundle.revision).toBe(OFFICIAL_REVISION);
    expect(result.bundle.sourceDigest).toBe(OFFICIAL_SOURCE_DIGEST);
    expect(calculateDesenBundleRevision(result.bundle)).toBe(OFFICIAL_REVISION);
    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(result).sort()).toEqual(["bundle", "diagnostics", "ok"]);
    expect(Object.hasOwn(result.bundle, "publication")).toBe(false);
    expect(Object.hasOwn(result.bundle, "authoring")).toBe(false);
    expect(canonicalizeJson(source)).toBe(sourceBefore);
    expect(canonicalizeJson(candidate.catalog)).toBe(catalogBefore);
    expectDisjointGraphs(result.bundle, candidate);
    expectDisjointGraphs(result.bundle, expected);
    expectRecursivelyFrozen(result);
  });

  it("publishes two fresh independent fixture graphs to byte-identical immutable Bundles", () => {
    const firstSource = cloneJson(officialSourceFixture);
    const secondSource = cloneJson(officialSourceFixture);
    const firstCandidate = freshCandidate();
    const secondCandidate = freshCandidate();
    expect(firstSource).not.toBe(secondSource);
    expect(firstCandidate).not.toBe(secondCandidate);
    expectDisjointGraphs(firstSource, secondSource);
    expectDisjointGraphs(firstCandidate, secondCandidate);

    const first = publishOfficial(firstSource, firstCandidate);
    const second = publishOfficial(secondSource, secondCandidate);
    expectSuccess(first.result);
    expectSuccess(second.result);

    const firstBytes = canonicalizeJsonBytes(first.result.bundle);
    const secondBytes = canonicalizeJsonBytes(second.result.bundle);
    expect(firstBytes).toEqual(secondBytes);
    expect(first.result.bundle.revision).toBe(second.result.bundle.revision);
    expect(first.result.bundle.sourceDigest).toBe(second.result.bundle.sourceDigest);
    expect(first.result).not.toBe(second.result);
    expect(first.result.bundle).not.toBe(second.result.bundle);
    expect(first.result.diagnostics).not.toBe(second.result.diagnostics);
    expectDisjointGraphs(first.result.bundle, second.result.bundle);
    expectDisjointGraphs(first.result.bundle, firstCandidate);
    expectDisjointGraphs(second.result.bundle, secondCandidate);
    expectRecursivelyFrozen(first.result);
    expectRecursivelyFrozen(second.result);
  });

  it("gives root object-member allocation order no publication authority", () => {
    const baseline = publishOfficial();
    const reorderedSource = reverseRootMembers(cloneJson(officialSourceFixture), "Official Source");
    const sourceOrderOnly = publishOfficial(reorderedSource, freshCandidate());
    const catalogOrderOnly = publishOfficial(
      cloneJson(officialSourceFixture),
      freshCandidate(true),
    );
    expect(baseline.sourceText).not.toBe(sourceOrderOnly.sourceText);
    expect(JSON.stringify(baseline.candidate.catalog)).not.toBe(
      JSON.stringify(catalogOrderOnly.candidate.catalog),
    );
    expectSuccess(baseline.result);
    const sourceOrderResult = sourceOrderOnly.result;
    const catalogOrderResult = catalogOrderOnly.result;
    expectSuccess(sourceOrderResult);
    expectSuccess(catalogOrderResult);

    const baselineBytes = canonicalizeJsonBytes(baseline.result.bundle);
    for (const result of [sourceOrderResult, catalogOrderResult]) {
      expect(canonicalizeJsonBytes(result.bundle)).toEqual(baselineBytes);
      expect(result.bundle.revision).toBe(OFFICIAL_REVISION);
      expect(result.bundle.sourceDigest).toBe(OFFICIAL_SOURCE_DIGEST);
    }
  });

  it("keeps root authoring outside both the official digest and terminal Bundle", () => {
    const baseline = publishOfficial();
    const changedSource = record(cloneJson(officialSourceFixture), "Official Source");
    changedSource.authoring = {
      canvas: { privateEditorState: { selected: ["sign-in.submit"], zoom: 1.75 } },
    };
    const changed = publishOfficial(changedSource, freshCandidate());
    expectSuccess(baseline.result);
    expectSuccess(changed.result);

    expect(canonicalizeJsonBytes(changed.result.bundle)).toEqual(
      canonicalizeJsonBytes(baseline.result.bundle),
    );
    expect(changed.result.bundle.sourceDigest).toBe(OFFICIAL_SOURCE_DIGEST);
    expect(Object.hasOwn(changed.result.bundle, "authoring")).toBe(false);
  });

  it("projects no field except root publication from official-golden authority", () => {
    const baseline = projectOfficialBundleWithoutRootPublication();
    const metadataChanged = record(cloneJson(officialBundleFixture), "Official Bundle");
    metadataChanged.publication = {
      publishedAt: "2099-12-31T23:59:59Z",
      publisher: "metadata-only-change",
    };
    expect(canonicalizeJson(projectOfficialBundleWithoutRootPublication(metadataChanged))).toBe(
      canonicalizeJson(baseline),
    );

    const nestedPublication = record(cloneJson(officialBundleFixture), "Official Bundle");
    nestedPublication.extensions = {
      "dev.desen.test/nested": { publication: { semantic: true } },
    };
    const nestedProjection = projectOfficialBundleWithoutRootPublication(nestedPublication);
    expect(nestedProjection.extensions).toEqual({
      "dev.desen.test/nested": { publication: { semantic: true } },
    });

    const semanticMutation = projectOfficialBundleWithoutRootPublication();
    semanticMutation.entry = "changed";
    expect(canonicalizeJson(semanticMutation)).not.toBe(canonicalizeJson(baseline));
  });

  it("uses only the public Publisher package root", () => {
    expect(publisherPackageRoot.publishDesenSource).toBe(publishDesenSource);
    expect(Object.hasOwn(publisherPackageRoot, "publishDesenSourceWithLimits")).toBe(false);
    expect(Object.hasOwn(publisherPackageRoot, "preflightPublishCatalogPinning")).toBe(false);
  });
});
