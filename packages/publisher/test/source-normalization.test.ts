import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as DesenProtocol from "@desen/protocol";

const digestProbe = vi.hoisted(() => ({
  active: false,
  completed: false,
  returnInvalidDigest: false,
  throwOnCalculate: false,
  calls: [] as unknown[],
  normalizationObservedAfterDigest: [] as boolean[],
}));

vi.mock("@desen/protocol", async (importOriginal) => {
  const protocol = await importOriginal<typeof DesenProtocol>();
  return {
    ...protocol,
    calculateDesenSourceDigest(source: unknown): string {
      digestProbe.calls.push(source);
      if (digestProbe.throwOnCalculate) throw new TypeError("Injected digest authority failure.");
      if (digestProbe.returnInvalidDigest) return "invalid";
      const digest = protocol.calculateDesenSourceDigest(source);
      digestProbe.completed = true;
      return digest;
    },
    canonicalizeJson(value: unknown): string {
      const kind =
        typeof value === "object" && value !== null
          ? Object.getOwnPropertyDescriptor(value, "kind")?.value
          : undefined;
      if (digestProbe.active && kind === "desen.bundle") {
        digestProbe.normalizationObservedAfterDigest.push(digestProbe.completed);
      }
      return protocol.canonicalizeJson(value);
    },
  };
});

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import sortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import {
  calculateDesenSourceDigest,
  canonicalizeJson,
  canonicalizeJsonBytes,
  isSha256Digest,
  parseJsonPointer,
} from "@desen/protocol";

import * as publicPublisher from "../src/index.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE,
  SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
  preflightPublishSourceNormalization,
} from "../src/source-normalization.js";
import type {
  PublishSourceNormalizationLimits,
  PublishSourceNormalizationResult,
  PublishSourceNormalizationSuccess,
} from "../src/source-normalization.js";
import {
  SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE,
  preflightPublishSourcePreservation,
} from "../src/source-preservation.js";
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
  if (typeof field === "number") array(parent)[field] = value;
  else record(parent)[field] = value;
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

function limits(
  maxNormalizedDocumentCanonicalBytes: number,
): Readonly<PublishSourceNormalizationLimits> {
  return Object.freeze({
    sourcePreservation: PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation,
    maxNormalizedDocumentCanonicalBytes,
  });
}

function preflight(
  source: unknown,
  catalog: unknown = clone(validCatalog),
  profile: Readonly<PublishSourceNormalizationLimits> = PUBLISH_SOURCE_NORMALIZATION_LIMITS,
): PublishSourceNormalizationResult {
  return preflightPublishSourceNormalization(JSON.stringify(source), [candidate(catalog)], profile);
}

function isSuccess(
  result: PublishSourceNormalizationResult,
): result is PublishSourceNormalizationSuccess {
  return Object.getOwnPropertyDescriptor(result, "sourceNormalized")?.value === true;
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
    "diagnosticsWarnings",
    "obligations",
    "preservedDocument",
    "sourceCatalogRequirements",
    "traceability",
    "normalizedDocument",
    "sourceNormalized",
    "preservationPrepared",
    "executionPreflighted",
    "capabilityPreflighted",
    "preflighted",
    "sourceDigest",
    "requires",
    "revision",
    "publication",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
}

function expectFailure(
  result: PublishSourceNormalizationResult,
  stage: PublishFailure["stage"],
  code: string,
  pointer = "",
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected Source normalization to fail.");
  expect(result).toMatchObject({ ok: false, stage });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, pointer, stage, severity: "error" }),
  );
  expectNoPartialAuthority(result);
  expectDeepFrozen(result);
}

function reverseObjectMemberOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectMemberOrder(entry));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entry]) => [key, reverseObjectMemberOrder(entry)]),
  );
}

function valueAtPointer(root: unknown, pointer: string): unknown {
  let current = root;
  for (const token of parseJsonPointer(pointer)) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(token)) {
        throw new TypeError(`Test pointer token ${token} is not an array index.`);
      }
      current = current[Number(token)];
    } else {
      current = record(current, `test pointer ${pointer}`)[token];
    }
  }
  return current;
}

function extensionRichSource(): unknown {
  const source = clone(sortableSource) as unknown;
  record(source).authoring = {
    kind: "desen.bundle",
    revision: "must-not-cross",
    requires: { catalogs: [{ target: "must-not-cross" }] },
    sourceDigest: "must-not-cross",
    nested: { id: "authoring.fake", use: "com.example.ui/Text" },
  };
  record(source).extensions = JSON.parse(`{
    "dev.desen.test/root": {
      "10": "ten",
      "2": "two",
      "01": "leading-zero",
      "__proto__": {"safe": true},
      "constructor": {"safe": true},
      "prototype": {"safe": true},
      "authoring": {"nested": "must-cross"},
      "order": ["third", "first", "second"],
      "fakeNode": {"id": "extension.fake", "use": "com.example.ui/Text"}
    }
  }`) as unknown;
  record(valueAt(source, ["catalogs", 0])).extensions = {
    "dev.desen.test/discovery": {
      order: ["location-third", "location-first", "location-second"],
    },
  };
  record(valueAt(source, ["surfaces", "tasks"])).extensions = {
    "dev.desen.test/surface": { enabled: true },
  };
  record(valueAt(source, ["surfaces", "tasks", "resources", "tasks"])).extensions = {
    "dev.desen.test/resource": { policyOrder: ["mount", "manual", "once"] },
  };
  record(valueAt(source, ["surfaces", "tasks", "root"])).extensions = {
    "dev.desen.test/node": { order: [3, 1, 2] },
  };
  record(valueAt(source, ["surfaces", "tasks", "root", "behaviors", 0])).extensions = {
    "dev.desen.test/behavior": { attached: true },
  };
  record(
    valueAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "on", "reorder", 0]),
  ).extensions = {
    "dev.desen.test/action": { order: ["queued", "accepted"] },
  };
  const repeatedNode = record(
    valueAt(source, ["surfaces", "tasks", "root", "slots", "default", 0]),
  );
  repeatedNode.extensions = {
    "dev.desen.test/repeated-node": { position: 0 },
  };
  record(repeatedNode.repeat).extensions = {
    "dev.desen.test/repeat": { examples: ["later", "earlier"] },
  };
  return source;
}

describe("package-private Source authoring-removal and normalization preflight", () => {
  beforeEach(() => {
    digestProbe.active = false;
    digestProbe.completed = false;
    digestProbe.returnInvalidDigest = false;
    digestProbe.throwOnCalculate = false;
    digestProbe.calls.length = 0;
    digestProbe.normalizationObservedAfterDigest.length = 0;
  });

  it("carries exact T06 authority and emits only one detached normalized production document", () => {
    const result = preflight(validSource);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected Source normalization to succeed.");
    expect(result).toMatchObject({
      sourceNormalized: true,
      diagnostics: [],
      requirementPackageIndexes: [0],
      normalizedDocument: {
        kind: "desen.bundle",
        desen: "0.1.0",
        id: "com.example.account-app",
        entry: "sign-in",
      },
    });
    expect(Object.keys(result).sort()).toEqual([
      "catalogSet",
      "diagnostics",
      "normalizedDocument",
      "obligations",
      "packages",
      "preservedDocument",
      "requirementPackageIndexes",
      "source",
      "sourceCatalogRequirements",
      "sourceDigest",
      "sourceNormalized",
      "traceability",
    ]);
    expect(Object.keys(result.normalizedDocument).sort()).toEqual([
      "desen",
      "entry",
      "extensions",
      "id",
      "kind",
      "surfaces",
    ]);

    expect(result.preservedDocument.surfaces).toBe(result.source.surfaces);
    expect(result.preservedDocument.extensions).toBe(result.source.extensions);
    expect(result.sourceCatalogRequirements).toBe(result.source.catalogs);
    expect(result.sourceDigest).toBe(calculateDesenSourceDigest(result.source));
    expect(isSha256Digest(result.sourceDigest)).toBe(true);
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);
    expect(result.normalizedDocument).not.toBe(result.preservedDocument);
    expect(result.normalizedDocument.surfaces).not.toBe(result.preservedDocument.surfaces);
    expect(result.normalizedDocument.surfaces).toEqual(result.preservedDocument.surfaces);
    expect(result.normalizedDocument.extensions).not.toBe(result.preservedDocument.extensions);
    expect(result.normalizedDocument.extensions).toEqual(result.preservedDocument.extensions);

    for (const forbidden of [
      "authoring",
      "catalogs",
      "requires",
      "sourceDigest",
      "revision",
      "publication",
      "bundle",
      "target",
    ]) {
      expect(Object.hasOwn(result.normalizedDocument, forbidden)).toBe(false);
    }
    for (const forbidden of ["ok", "bundle", "requires", "revision", "publication"]) {
      expect(Object.hasOwn(result, forbidden)).toBe(false);
    }
    expectDeepFrozen(result);
  });

  it("removes only root authoring while preserving opaque nested authoring and hostile-looking keys", () => {
    const source = extensionRichSource();
    const result = preflight(source);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected extension-rich Source to normalize.");
    expect(Object.hasOwn(result.source, "authoring")).toBe(true);
    expect(result.source.authoring).toEqual(record(source).authoring);
    expect(Object.hasOwn(result.normalizedDocument, "authoring")).toBe(false);

    const extension = record(record(result.normalizedDocument.extensions)["dev.desen.test/root"]);
    expect(extension).toEqual(record(record(result.source.extensions)["dev.desen.test/root"]));
    expect(extension.authoring).toEqual({ nested: "must-cross" });
    expect(extension.__proto__).toEqual({ safe: true });
    expect(extension.constructor).toEqual({ safe: true });
    expect(extension.prototype).toEqual({ safe: true });
    expect(extension.fakeNode).toEqual({
      id: "extension.fake",
      use: "com.example.ui/Text",
    });
    expectDeepFrozen(result.normalizedDocument);
  });

  it("keeps every semantic array in order and changes no parsed production value", () => {
    const result = preflight(extensionRichSource());

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected ordered Source to normalize.");
    const sourceRoot = result.preservedDocument.surfaces.tasks?.root;
    const normalizedRoot = result.normalizedDocument.surfaces.tasks?.root;
    expect(normalizedRoot).toEqual(sourceRoot);
    expect(normalizedRoot?.behaviors?.map(({ id }) => id)).toEqual(
      sourceRoot?.behaviors?.map(({ id }) => id),
    );
    expect(normalizedRoot?.slots?.default?.map(({ id }) => id)).toEqual(
      sourceRoot?.slots?.default?.map(({ id }) => id),
    );
    expect(normalizedRoot?.behaviors?.[0]?.on?.reorder).toEqual(
      sourceRoot?.behaviors?.[0]?.on?.reorder,
    );
    expect(record(normalizedRoot?.extensions)["dev.desen.test/node"]).toEqual({ order: [3, 1, 2] });
    expect(
      record(normalizedRoot?.slots?.default?.[0]?.repeat?.extensions)["dev.desen.test/repeat"],
    ).toEqual({ examples: ["later", "earlier"] });
    expect(
      record(record(result.normalizedDocument.extensions)["dev.desen.test/root"]).order,
    ).toEqual(["third", "first", "second"]);
  });

  it("is RFC 8785 byte-stable without assigning semantic meaning to object enumeration order", () => {
    const source = extensionRichSource();
    const first = preflight(source, clone(validCatalog));
    const reordered = preflight(
      reverseObjectMemberOrder(source),
      reverseObjectMemberOrder(validCatalog),
    );
    const repeated = preflight(clone(source), clone(validCatalog));

    expect(isSuccess(first)).toBe(true);
    expect(isSuccess(reordered)).toBe(true);
    expect(isSuccess(repeated)).toBe(true);
    if (!isSuccess(first) || !isSuccess(reordered) || !isSuccess(repeated)) {
      throw new TypeError("Expected deterministic normalization runs.");
    }
    expect(reordered.normalizedDocument).toEqual(first.normalizedDocument);
    expect(repeated.normalizedDocument).toEqual(first.normalizedDocument);
    expect(canonicalizeJsonBytes(reordered.normalizedDocument)).toEqual(
      canonicalizeJsonBytes(first.normalizedDocument),
    );
    expect(canonicalizeJsonBytes(repeated.normalizedDocument)).toEqual(
      canonicalizeJsonBytes(first.normalizedDocument),
    );

    const extension = record(record(first.normalizedDocument.extensions)["dev.desen.test/root"]);
    expect(extension["10"]).toBe("ten");
    expect(extension["2"]).toBe("two");
    expect(extension["01"]).toBe("leading-zero");
    expect(canonicalizeJson(first.normalizedDocument)).toBe(
      canonicalizeJson(reordered.normalizedDocument),
    );
  });

  it("makes normalized output independent of root authoring while retaining each exact Source", () => {
    const firstSource = clone(validSource) as unknown;
    const secondSource = clone(validSource) as unknown;
    record(firstSource).authoring = {
      fixtures: { user: "synthetic-a" },
      largeEditorState: "a".repeat(64_000),
    };
    record(secondSource).authoring = {
      fixtures: { user: "synthetic-b" },
      largeEditorState: "b".repeat(96_000),
      revision: "editor-only",
    };

    const first = preflight(firstSource);
    const second = preflight(secondSource);
    expect(isSuccess(first)).toBe(true);
    expect(isSuccess(second)).toBe(true);
    if (!isSuccess(first) || !isSuccess(second)) {
      throw new TypeError("Expected authoring-only variants to normalize.");
    }
    expect(first.normalizedDocument).toEqual(second.normalizedDocument);
    expect(canonicalizeJsonBytes(first.normalizedDocument)).toEqual(
      canonicalizeJsonBytes(second.normalizedDocument),
    );
    expect(first.source.authoring).toEqual(record(firstSource).authoring);
    expect(second.source.authoring).toEqual(record(secondSource).authoring);
    expect(first.source.authoring).not.toEqual(second.source.authoring);
    expect(first.sourceDigest).toBe(second.sourceDigest);
  });

  it("calculates the Source digest before authoring removal and normalized-document canonicalization", () => {
    digestProbe.active = true;
    const result = preflight(validSource);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected ordered normalization success.");
    expect(digestProbe.calls).toEqual([result.source]);
    expect(digestProbe.normalizationObservedAfterDigest.length).toBeGreaterThan(0);
    expect(digestProbe.normalizationObservedAfterDigest.every(Boolean)).toBe(true);
    expect(result.sourceDigest).toBe(calculateDesenSourceDigest(result.source));
    expect(Object.hasOwn(result.normalizedDocument, "sourceDigest")).toBe(false);
  });

  it("fails closed at source-digest when digest authority throws or returns an invalid digest", () => {
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", "com.example.ui/Stack", "deprecated"], true);
    digestProbe.throwOnCalculate = true;

    const thrown = preflight(validSource, catalog);
    expectFailure(thrown, "source-digest", SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE);
    expect(digestProbe.calls).toHaveLength(1);
    expect(
      thrown.diagnostics.some(({ code }) => code === "run.desen.publisher/DEPRECATED_CAPABILITY"),
    ).toBe(false);

    digestProbe.calls.length = 0;
    digestProbe.throwOnCalculate = false;
    digestProbe.returnInvalidDigest = true;
    const malformed = preflight(validSource, catalog);
    expectFailure(malformed, "source-digest", SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE);
    expect(digestProbe.calls).toHaveLength(1);
  });

  it("performs only minimal normalization without defaults or empty-member deletion", () => {
    const omittedDefault = clone(validSource) as unknown;
    const omittedAction = record(
      valueAt(omittedDefault, [
        "surfaces",
        "sign-in",
        "root",
        "slots",
        "default",
        4,
        "on",
        "press",
        0,
      ]),
    );
    Reflect.deleteProperty(omittedAction, "concurrency");

    const explicitDefault = clone(validSource) as unknown;
    writeAt(
      explicitDefault,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "concurrency"],
      "reject",
    );

    const emptyMembers = clone(validSource) as unknown;
    const emptyNode = record(
      valueAt(emptyMembers, ["surfaces", "home", "root", "slots", "default", 0]),
    );
    emptyNode.slots = {};
    emptyNode.style = {};
    emptyNode.variants = [];
    emptyNode.behaviors = [];
    emptyNode.on = {};
    emptyNode.extensions = {};

    const omittedResult = preflight(omittedDefault);
    const explicitResult = preflight(explicitDefault);
    const emptyResult = preflight(emptyMembers);
    expect(isSuccess(omittedResult)).toBe(true);
    expect(isSuccess(explicitResult)).toBe(true);
    expect(isSuccess(emptyResult)).toBe(true);
    if (!isSuccess(omittedResult) || !isSuccess(explicitResult) || !isSuccess(emptyResult)) {
      throw new TypeError("Expected minimal-normalization fixtures to pass.");
    }

    const omittedNormalizedAction = record(
      valueAt(omittedResult.normalizedDocument, [
        "surfaces",
        "sign-in",
        "root",
        "slots",
        "default",
        4,
        "on",
        "press",
        0,
      ]),
    );
    const explicitNormalizedAction = record(
      valueAt(explicitResult.normalizedDocument, [
        "surfaces",
        "sign-in",
        "root",
        "slots",
        "default",
        4,
        "on",
        "press",
        0,
      ]),
    );
    expect(Object.hasOwn(omittedNormalizedAction, "concurrency")).toBe(false);
    expect(explicitNormalizedAction.concurrency).toBe("reject");

    const normalizedEmptyNode = record(
      valueAt(emptyResult.normalizedDocument, ["surfaces", "home", "root", "slots", "default", 0]),
    );
    expect(normalizedEmptyNode).toMatchObject({
      slots: {},
      style: {},
      variants: [],
      behaviors: [],
      on: {},
      extensions: {},
    });
    for (const field of ["slots", "style", "variants", "behaviors", "on", "extensions"]) {
      expect(Object.hasOwn(normalizedEmptyNode, field)).toBe(true);
    }

    const absentAuthoring = clone(validSource) as unknown;
    Reflect.deleteProperty(record(absentAuthoring), "authoring");
    const emptyAuthoring = clone(validSource) as unknown;
    record(emptyAuthoring).authoring = {};
    const absentResult = preflight(absentAuthoring);
    const emptyAuthoringResult = preflight(emptyAuthoring);
    expect(isSuccess(absentResult)).toBe(true);
    expect(isSuccess(emptyAuthoringResult)).toBe(true);
    if (!isSuccess(absentResult) || !isSuccess(emptyAuthoringResult)) {
      throw new TypeError("Expected absent and empty authoring variants to pass.");
    }
    expect(canonicalizeJsonBytes(absentResult.normalizedDocument)).toEqual(
      canonicalizeJsonBytes(emptyAuthoringResult.normalizedDocument),
    );
  });

  it("keeps loose Source requirements separate and never fabricates exact package tuples", () => {
    const source = clone(validSource) as unknown;
    const duplicate = clone(valueAt(source, ["catalogs", 0])) as unknown;
    writeAt(duplicate, ["location"], "registry://editor-only-discovery");
    writeAt(duplicate, ["extensions"], { "dev.desen.test/requirement": ["second", "first"] });
    array(valueAt(source, ["catalogs"])).push(duplicate);

    const result = preflight(source);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected duplicate requirements to normalize.");
    expect(result.sourceCatalogRequirements).toBe(result.source.catalogs);
    expect(result.sourceCatalogRequirements).toHaveLength(2);
    expect(result.requirementPackageIndexes).toEqual([0, 0]);
    expect(result.packages).toHaveLength(1);
    expect(result.normalizedDocument).not.toHaveProperty("catalogs");
    expect(result.normalizedDocument).not.toHaveProperty("requires");
    expect(canonicalizeJson(result.normalizedDocument)).not.toContain(
      "registry://editor-only-discovery",
    );
  });

  it("carries the complete unchanged, surface-scoped source-node trace", () => {
    const source = clone(validSource) as unknown;
    writeAt(source, ["surfaces", "sign-in", "root", "id"], "shared.root");
    writeAt(source, ["surfaces", "home", "root", "id"], "shared.root");

    const result = preflight(source);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected surface-scoped identities to normalize.");
    expect(result.traceability.strategy).toBe("unchanged-node-identifiers");
    expect(
      result.traceability.sourceNodes
        .filter(({ sourceNodeId }) => sourceNodeId === "shared.root")
        .map(({ surfaceId, sourcePointer }) => ({ surfaceId, sourcePointer })),
    ).toEqual([
      { surfaceId: "home", sourcePointer: "/surfaces/home/root" },
      { surfaceId: "sign-in", sourcePointer: "/surfaces/sign-in/root" },
    ]);
    for (const trace of result.traceability.sourceNodes) {
      const normalizedNode = record(
        valueAtPointer(result.normalizedDocument, trace.sourcePointer),
        trace.sourcePointer,
      );
      expect(normalizedNode.id).toBe(trace.sourceNodeId);
      expect(normalizedNode.use).toBe(trace.capabilityId);
    }
  });

  it("admits the exact canonical-byte boundary and rejects one byte below without partials", () => {
    const baseline = preflight(extensionRichSource());
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected normalization baseline.");
    const canonicalBytes = canonicalizeJsonBytes(baseline.normalizedDocument).length;

    const exact = preflight(extensionRichSource(), clone(validCatalog), limits(canonicalBytes));
    expect(isSuccess(exact)).toBe(true);
    if (!isSuccess(exact)) throw new TypeError("Expected exact byte ceiling to pass.");
    expect(canonicalizeJsonBytes(exact.normalizedDocument)).toHaveLength(canonicalBytes);

    expectFailure(
      preflight(extensionRichSource(), clone(validCatalog), limits(canonicalBytes - 1)),
      "normalization",
      SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    );
    expectFailure(
      preflight(validSource, clone(validCatalog), limits(0)),
      "normalization",
      SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    );
  });

  it("measures UTF-8 canonical bytes rather than JavaScript code units", () => {
    const source = clone(validSource) as unknown;
    record(source).extensions = {
      "dev.desen.test/unicode": { value: "😀é" },
    };
    const baseline = preflight(source);
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected Unicode Source to normalize.");
    const canonical = canonicalizeJson(baseline.normalizedDocument);
    const canonicalBytes = canonicalizeJsonBytes(baseline.normalizedDocument).length;
    expect(canonicalBytes).toBeGreaterThan(canonical.length);

    expect(isSuccess(preflight(source, clone(validCatalog), limits(canonicalBytes)))).toBe(true);
    expectFailure(
      preflight(source, clone(validCatalog), limits(canonicalBytes - 1)),
      "normalization",
      SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE,
    );
  });

  it("passes representative T01–T06 failures through without stage or diagnostic remapping", () => {
    const malformed = '{"kind":"desen.source",';

    const unknownRoot = clone(validSource) as unknown;
    record(unknownRoot).ghost = true;

    const unknownProp = clone(validSource) as unknown;
    record(
      valueAt(unknownProp, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
    ).ghost = true;

    const invalidBinding = clone(validSource) as unknown;
    writeAt(
      invalidBinding,
      ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value"],
      { $ref: "state.missing" },
    );

    const cases: readonly Readonly<{
      raw: string;
      candidates: readonly unknown[];
      stage: PublishFailure["stage"];
      code: string;
      pointer?: string;
    }>[] = [
      {
        raw: malformed,
        candidates: [candidate()],
        stage: "json-parse",
        code: "run.desen.publisher/INVALID_SOURCE_JSON",
      },
      {
        raw: JSON.stringify(validSource),
        candidates: [],
        stage: "catalog-resolution",
        code: "CATALOG_VERSION_UNAVAILABLE",
        pointer: "/catalogs/0",
      },
      {
        raw: JSON.stringify(unknownRoot),
        candidates: [candidate()],
        stage: "source-schema",
        code: "UNKNOWN_CORE_FIELD",
        pointer: "/ghost",
      },
      {
        raw: JSON.stringify(unknownProp),
        candidates: [candidate()],
        stage: "capability-contracts",
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/home/root/slots/default/0/props/ghost",
      },
      {
        raw: JSON.stringify(invalidBinding),
        candidates: [candidate()],
        stage: "binding-compatibility",
        code: "REFERENCE_UNRESOLVED",
        pointer: "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
      },
    ];

    for (const testCase of cases) {
      const actual = preflightPublishSourceNormalization(testCase.raw, testCase.candidates);
      const inherited = preflightPublishSourcePreservation(testCase.raw, testCase.candidates);
      expect(actual).toEqual(inherited);
      expectFailure(actual, testCase.stage, testCase.code, testCase.pointer);
    }

    const preservationProfile = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      sourcePreservation: {
        ...PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation,
        maxSourceNodeTraceEntries: 1,
      },
    };
    const actual = preflight(validSource, clone(validCatalog), preservationProfile);
    const inherited = preflightPublishSourcePreservation(
      JSON.stringify(validSource),
      [candidate()],
      preservationProfile.sourcePreservation,
    );
    expect(actual).toEqual(inherited);
    expectFailure(actual, "normalization", SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE);
  });

  it("suppresses inherited warnings when the later normalized-byte envelope rejects output", () => {
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", "com.example.ui/Stack", "deprecated"], true);
    const successful = preflight(validSource, catalog);
    expect(isSuccess(successful)).toBe(true);
    if (!isSuccess(successful)) throw new TypeError("Expected warning-bearing normalization.");
    expect(successful.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "run.desen.publisher/DEPRECATED_CAPABILITY",
        severity: "warning",
      }),
    );

    const rejected = preflight(validSource, clone(catalog), limits(0));
    expectFailure(rejected, "normalization", SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE);
    expect(rejected.diagnostics.every(({ severity }) => severity === "error")).toBe(true);
    expect(
      rejected.diagnostics.some(({ code }) => code === "run.desen.publisher/DEPRECATED_CAPABILITY"),
    ).toBe(false);
  });

  it("normalizes the complete limit profile before observing Source or Catalog candidates", () => {
    let observed = false;
    const hostile = new Proxy(
      {},
      {
        get() {
          observed = true;
          throw new Error("must not be observed");
        },
        ownKeys() {
          observed = true;
          throw new Error("must not be observed");
        },
      },
    );
    const invalidLimits = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      get maxNormalizedDocumentCanonicalBytes() {
        return 2_097_152;
      },
    };
    expect(() => preflightPublishSourceNormalization(hostile, hostile, invalidLimits)).toThrow(
      TypeError,
    );
    expect(observed).toBe(false);
  });

  it("rejects non-data, non-exact, non-finite, fractional, and unsafe profiles", () => {
    const inherited = Object.create(PUBLISH_SOURCE_NORMALIZATION_LIMITS) as object;
    const accessor = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      get maxNormalizedDocumentCanonicalBytes() {
        return 2_097_152;
      },
    };
    const symbolic = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      [Symbol("extra")]: true,
    };
    const customPrototype = Object.assign(
      Object.create({ profile: true }) as MutableRecord,
      PUBLISH_SOURCE_NORMALIZATION_LIMITS,
    );
    const nullPrototype = Object.assign(
      Object.create(null) as MutableRecord,
      PUBLISH_SOURCE_NORMALIZATION_LIMITS,
    );
    const spoofPrototype = Object.create(null) as MutableRecord;
    Object.defineProperty(spoofPrototype, "constructor", {
      configurable: true,
      enumerable: false,
      value: Object,
      writable: true,
    });
    const spoofedObjectPrototype = Object.assign(
      Object.create(spoofPrototype) as MutableRecord,
      PUBLISH_SOURCE_NORMALIZATION_LIMITS,
    );
    const negative = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      maxNormalizedDocumentCanonicalBytes: -1,
    };
    const unsafe = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      maxNormalizedDocumentCanonicalBytes: Number.MAX_SAFE_INTEGER + 1,
    };
    const missing = {
      sourcePreservation: PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation,
    };
    const fractional = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      maxNormalizedDocumentCanonicalBytes: 1.5,
    };
    const notANumber = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      maxNormalizedDocumentCanonicalBytes: Number.NaN,
    };
    const infinite = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      maxNormalizedDocumentCanonicalBytes: Number.POSITIVE_INFINITY,
    };
    const invalidNested = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      sourcePreservation: {
        ...PUBLISH_SOURCE_NORMALIZATION_LIMITS.sourcePreservation,
        maxSourceNodeTraceEntries: -1,
      },
    };
    const extra = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
      extra: true,
    };
    const nonEnumerable = {
      ...PUBLISH_SOURCE_NORMALIZATION_LIMITS,
    };
    Object.defineProperty(nonEnumerable, "maxNormalizedDocumentCanonicalBytes", {
      enumerable: false,
      value: 2_097_152,
    });

    for (const profile of [
      null,
      false,
      "invalid",
      [],
      inherited,
      accessor,
      symbolic,
      customPrototype,
      nullPrototype,
      spoofedObjectPrototype,
      negative,
      unsafe,
      missing,
      fractional,
      notANumber,
      infinite,
      invalidNested,
      extra,
      nonEnumerable,
    ]) {
      expect(() =>
        preflightPublishSourceNormalization(
          JSON.stringify(validSource),
          [candidate()],
          profile as Readonly<PublishSourceNormalizationLimits>,
        ),
      ).toThrow(
        "Source-normalization limits must be an exact own-data finite non-negative-integer profile.",
      );
    }
  });

  it("publishes no package-root API and grants no terminal or target-specific authority", () => {
    expect(Object.hasOwn(publicPublisher, "preflightPublishSourceNormalization")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "PUBLISH_SOURCE_NORMALIZATION_LIMITS")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "SOURCE_NORMALIZATION_AUTHORITY_INVALID_CODE")).toBe(
      false,
    );
    expect(Object.hasOwn(publicPublisher, "SOURCE_NORMALIZATION_LIMIT_EXCEEDED_CODE")).toBe(false);

    const result = preflight(validSource);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected nonterminal normalization success.");
    expect(PUBLISH_SOURCE_NORMALIZATION_LIMITS.maxNormalizedDocumentCanonicalBytes).toBe(2_097_152);
    for (const forbidden of [
      "bundle",
      "requires",
      "revision",
      "publication",
      "target",
      "adapter",
      "runtime",
    ]) {
      expect(Object.hasOwn(result, forbidden)).toBe(false);
      expect(Object.hasOwn(result.normalizedDocument, forbidden)).toBe(false);
    }
    expect(isSha256Digest(result.sourceDigest)).toBe(true);
    expect(Object.hasOwn(result.normalizedDocument, "sourceDigest")).toBe(false);
  });
});
