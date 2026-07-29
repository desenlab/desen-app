import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import {
  validateDesenExecutionCatalogSet,
  validatePreparedDesenSourceReferences,
} from "@desen/validator";

import * as publicPublisher from "../src/index.js";
import {
  EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
} from "../src/execution-preflight.js";
import type { PublishExecutionPreflightLimits } from "../src/execution-preflight.js";
import {
  PUBLISH_SOURCE_PRESERVATION_LIMITS,
  SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE,
  preflightPublishSourcePreservation,
} from "../src/source-preservation.js";
import type {
  PublishSourceNodeTraceEntry,
  PublishSourcePreservationLimits,
  PublishSourcePreservationResult,
  PublishSourcePreservationSuccess,
} from "../src/source-preservation.js";
import type { PublishFailure } from "../src/publish-result.js";

type MutableRecord = Record<string, unknown>;

const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";

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
  overrides: Partial<Omit<PublishSourcePreservationLimits, "executionPreflight">>,
  executionPreflight: Readonly<PublishExecutionPreflightLimits> = PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
): Readonly<PublishSourcePreservationLimits> {
  return Object.freeze({
    ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
    ...overrides,
    executionPreflight,
  });
}

function executionLimits(
  overrides: Partial<Omit<PublishExecutionPreflightLimits, "sourcePreflight">>,
): Readonly<PublishExecutionPreflightLimits> {
  return Object.freeze({ ...PUBLISH_EXECUTION_PREFLIGHT_LIMITS, ...overrides });
}

function preflight(
  source: unknown,
  catalog: unknown = clone(validCatalog),
  profile: Readonly<PublishSourcePreservationLimits> = PUBLISH_SOURCE_PRESERVATION_LIMITS,
): PublishSourcePreservationResult {
  return preflightPublishSourcePreservation(JSON.stringify(source), [candidate(catalog)], profile);
}

function isSuccess(
  result: PublishSourcePreservationResult,
): result is PublishSourcePreservationSuccess {
  return Object.getOwnPropertyDescriptor(result, "preservationPrepared")?.value === true;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
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
    "preservationPrepared",
    "executionPreflighted",
    "capabilityPreflighted",
    "preflighted",
    "sourceDigest",
    "revision",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
}

function expectFailure(
  result: PublishSourcePreservationResult,
  stage: PublishFailure["stage"],
  code: string,
  pointer = "",
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected source-preservation preflight to fail.");
  expect(result).toMatchObject({ ok: false, stage });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, pointer, stage, severity: "error" }),
  );
  expectNoPartialAuthority(result);
  expectDeepFrozen(result);
}

function traceCodeUnits(entry: PublishSourceNodeTraceEntry): number {
  return (
    entry.documentId.length +
    entry.surfaceId.length +
    entry.sourceNodeId.length +
    entry.capabilityId.length +
    entry.sourcePointer.length
  );
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

function extensionRichSortableSource(): unknown {
  const source = clone(exampleSortableSource) as unknown;
  const surface = record(valueAt(source, ["surfaces", "tasks"]));
  const root = record(valueAt(source, ["surfaces", "tasks", "root"]));
  const behavior = record(valueAt(source, ["surfaces", "tasks", "root", "behaviors", 0]));
  const item = record(valueAt(source, ["surfaces", "tasks", "root", "slots", "default", 0]));
  const reorder = record(
    valueAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "on", "reorder", 0]),
  );

  record(source).extensions = {
    "dev.desen.test/root": {
      order: ["third", "first", "second"],
      fakeNode: {
        id: "extension.fake",
        use: TEXT,
        slots: { default: [{ id: "extension.child", use: TEXT }] },
      },
    },
  };
  record(valueAt(source, ["catalogs", 0])).extensions = {
    "dev.desen.test/requirement": ["z", "a", "m"],
  };
  surface.extensions = { "dev.desen.test/surface": { enabled: true } };
  surface.state = {
    filter: {
      schema: { type: "string" },
      initial: "",
      extensions: { "dev.desen.test/state": { order: [2, 0, 1] } },
    },
  };
  record(valueAt(source, ["surfaces", "tasks", "resources", "tasks"])).extensions = {
    "dev.desen.test/resource": { cache: ["first", "second"] },
  };
  root.extensions = { "dev.desen.test/node": { opaque: true } };
  root.variants = [
    {
      when: { op: "truthy", args: [true] },
      props: { direction: "horizontal" },
      extensions: { "dev.desen.test/variant": { declared: [1, 3, 2] } },
    },
  ];
  behavior.extensions = { "dev.desen.test/behavior": { id: behavior.id } };
  behavior.slots = {
    dragPreview: [
      {
        id: "tasks.preview",
        use: TEXT,
        props: { text: "Preview", role: "body" },
        extensions: {
          "dev.desen.test/behavior-slot-node": {
            fakeNode: { id: "extension.behavior.fake", use: TEXT },
          },
        },
      },
    ],
  };
  reorder.extensions = { "dev.desen.test/action": { queue: ["a", "c", "b"] } };
  reorder.onSuccess = [
    {
      type: "state.set",
      path: "filter",
      value: "done",
      extensions: { "dev.desen.test/nested-action": { terminal: true } },
    },
  ];
  item.extensions = { "dev.desen.test/repeated-node": { selected: false } };
  record(item.repeat).extensions = {
    "dev.desen.test/repeat": { keys: ["later", "earlier"] },
  };
  record(source).authoring = {
    fakeNode: { id: "authoring.fake", use: TEXT },
    order: ["editor-third", "editor-first", "editor-second"],
  };
  return source;
}

function utf16SurfaceFixture(): unknown {
  const source = clone(validSource) as unknown;
  const home = clone(valueAt(source, ["surfaces", "home"])) as unknown;
  const surfaceKeys = ["A:z", "A.z", "A-z"];
  const surfaces: MutableRecord = {};

  for (const key of surfaceKeys) {
    const surface = clone(home) as unknown;
    writeAt(surface, ["id"], key);
    writeAt(surface, ["root", "id"], `${key}.root`);
    const template = clone(valueAt(surface, ["root", "slots", "default", 0])) as unknown;
    const children = ["third", "first", "second"].map((suffix) => {
      const child = clone(template) as unknown;
      writeAt(child, ["id"], `${key}.${suffix}`);
      return child;
    });
    writeAt(surface, ["root", "slots", "default"], children);
    surfaces[key] = surface;
  }

  writeAt(source, ["entry"], "A-z");
  writeAt(source, ["surfaces"], surfaces);
  return source;
}

function deepNodeFixture(nodeCount: number): unknown {
  const source = clone(validSource) as unknown;
  const surface = clone(valueAt(source, ["surfaces", "home"])) as unknown;
  writeAt(source, ["surfaces"], { home: surface });
  writeAt(source, ["entry"], "home");
  const root = record(valueAt(source, ["surfaces", "home", "root"]));
  root.id = "deep.0";
  root.slots = { default: [] };

  let current = root;
  for (let index = 1; index < nodeCount; index += 1) {
    const terminal = index === nodeCount - 1;
    const child: MutableRecord = terminal
      ? {
          id: `deep.${index}`,
          use: TEXT,
          props: { text: "Terminal", role: "body" },
        }
      : {
          id: `deep.${index}`,
          use: STACK,
          props: { direction: "vertical" },
          slots: { default: [] },
        };
    array(record(current.slots).default).push(child);
    current = child;
  }
  return source;
}

describe("package-private source-preservation preflight", () => {
  it("carries exact T05 authority and prepares only the losslessly preserved Source fields", () => {
    const result = preflight(validSource);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected Source preservation to succeed.");
    expect(result).toMatchObject({
      preservationPrepared: true,
      diagnostics: [],
      requirementPackageIndexes: [0],
      traceability: { strategy: "unchanged-node-identifiers" },
    });
    expect(Object.keys(result).sort()).toEqual([
      "catalogSet",
      "diagnostics",
      "obligations",
      "packages",
      "preservationPrepared",
      "preservedDocument",
      "requirementPackageIndexes",
      "source",
      "sourceCatalogRequirements",
      "traceability",
    ]);
    expect(Object.keys(result.preservedDocument).sort()).toEqual([
      "desen",
      "entry",
      "extensions",
      "id",
      "surfaces",
    ]);
    expect(result.preservedDocument.surfaces).toBe(result.source.surfaces);
    expect(result.preservedDocument.extensions).toBe(result.source.extensions);
    expect(result.sourceCatalogRequirements).toBe(result.source.catalogs);
    expect(Object.hasOwn(result.source, "authoring")).toBe(true);
    expect(Object.hasOwn(result.preservedDocument, "authoring")).toBe(false);
    expect(Object.hasOwn(result.preservedDocument, "catalogs")).toBe(false);
    expect(Object.hasOwn(result.preservedDocument, "kind")).toBe(false);
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);

    const catalogsReauthenticated = validateDesenExecutionCatalogSet(result.catalogSet);
    expect(catalogsReauthenticated.valid).toBe(true);
    if (!catalogsReauthenticated.valid) {
      throw new TypeError("Expected execution Catalog authority.");
    }
    expect(catalogsReauthenticated.value).toBe(result.catalogSet);
    const sourceReauthenticated = validatePreparedDesenSourceReferences(
      result.source,
      result.catalogSet,
    );
    expect(sourceReauthenticated.valid).toBe(true);
    if (!sourceReauthenticated.valid) throw new TypeError("Expected exact Source authority.");
    expect(sourceReauthenticated.value).toBe(result.source);

    expect(result.traceability.sourceNodes).toEqual([
      {
        documentId: "com.example.account-app",
        surfaceId: "home",
        sourceNodeId: "home.layout",
        capabilityId: STACK,
        sourcePointer: "/surfaces/home/root",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "home",
        sourceNodeId: "home.title",
        capabilityId: TEXT,
        sourcePointer: "/surfaces/home/root/slots/default/0",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK,
        sourcePointer: "/surfaces/sign-in/root",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.title",
        capabilityId: TEXT,
        sourcePointer: "/surfaces/sign-in/root/slots/default/0",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.email",
        capabilityId: "com.example.ui/TextField",
        sourcePointer: "/surfaces/sign-in/root/slots/default/1",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.password",
        capabilityId: "com.example.ui/TextField",
        sourcePointer: "/surfaces/sign-in/root/slots/default/2",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.error",
        capabilityId: "com.example.ui/Alert",
        sourcePointer: "/surfaces/sign-in/root/slots/default/3",
      },
      {
        documentId: "com.example.account-app",
        surfaceId: "sign-in",
        sourceNodeId: "sign-in.submit",
        capabilityId: "com.example.ui/Button",
        sourcePointer: "/surfaces/sign-in/root/slots/default/4",
      },
    ]);
    for (const entry of result.traceability.sourceNodes) {
      const pointerSurfaceKey = entry.sourcePointer.split("/")[2];
      expect(entry.surfaceId).toBe(pointerSurfaceKey);
    }
    for (const absent of [
      "ok",
      "bundle",
      "kind",
      "sourceDigest",
      "revision",
      "normalized",
      "executionPreflighted",
    ]) {
      expect(Object.hasOwn(result, absent)).toBe(false);
    }
    expectDeepFrozen(result);
  });

  it("preserves every extension point and semantic array while treating payloads as opaque", () => {
    const result = preflight(extensionRichSortableSource());

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected extension-rich Source to pass.");
    expect(result.preservedDocument.extensions).toBe(result.source.extensions);
    expect(result.preservedDocument.surfaces).toBe(result.source.surfaces);
    expect(result.sourceCatalogRequirements).toBe(result.source.catalogs);
    expect(result.sourceCatalogRequirements[0]?.extensions).toBe(
      result.source.catalogs[0]?.extensions,
    );

    const root = result.preservedDocument.surfaces.tasks?.root;
    const sourceRoot = result.source.surfaces.tasks?.root;
    expect(root).toBe(sourceRoot);
    expect(root?.variants).toBe(sourceRoot?.variants);
    expect(root?.behaviors).toBe(sourceRoot?.behaviors);
    expect(root?.slots?.default).toBe(sourceRoot?.slots?.default);
    expect(root?.behaviors?.[0]?.slots?.dragPreview).toBe(
      sourceRoot?.behaviors?.[0]?.slots?.dragPreview,
    );
    expect(root?.behaviors?.[0]?.on?.reorder).toBe(sourceRoot?.behaviors?.[0]?.on?.reorder);
    expect(record(root?.behaviors?.[0]?.on?.reorder?.[0]).onSuccess).toBe(
      record(sourceRoot?.behaviors?.[0]?.on?.reorder?.[0]).onSuccess,
    );
    expect(root?.slots?.default?.[0]?.repeat?.extensions).toBe(
      sourceRoot?.slots?.default?.[0]?.repeat?.extensions,
    );
    expect(record(result.preservedDocument.extensions)["dev.desen.test/root"]).toEqual({
      order: ["third", "first", "second"],
      fakeNode: {
        id: "extension.fake",
        use: TEXT,
        slots: { default: [{ id: "extension.child", use: TEXT }] },
      },
    });
    expect(
      record(root?.behaviors?.[0]?.on?.reorder?.[0]?.extensions)["dev.desen.test/action"],
    ).toEqual({ queue: ["a", "c", "b"] });
    expect(record(root?.slots?.default?.[0]?.repeat?.extensions)["dev.desen.test/repeat"]).toEqual({
      keys: ["later", "earlier"],
    });
    expect(Object.hasOwn(result.source, "authoring")).toBe(true);
    expect(Object.hasOwn(result.preservedDocument, "authoring")).toBe(false);

    expect(
      result.traceability.sourceNodes.map(({ sourceNodeId, sourcePointer }) => ({
        sourceNodeId,
        sourcePointer,
      })),
    ).toEqual([
      { sourceNodeId: "tasks.list", sourcePointer: "/surfaces/tasks/root" },
      {
        sourceNodeId: "tasks.preview",
        sourcePointer: "/surfaces/tasks/root/behaviors/0/slots/dragPreview/0",
      },
      {
        sourceNodeId: "tasks.item",
        sourcePointer: "/surfaces/tasks/root/slots/default/0",
      },
    ]);
    const traceIds = result.traceability.sourceNodes.map(({ sourceNodeId }) => sourceNodeId);
    expect(traceIds).not.toContain("tasks.sort");
    expect(traceIds).not.toContain("extension.fake");
    expect(traceIds).not.toContain("extension.child");
    expect(traceIds).not.toContain("extension.behavior.fake");
    expect(traceIds).not.toContain("authoring.fake");
    expect(root?.behaviors?.[0]?.id).toBe("tasks.sort");
    expectDeepFrozen(result);
  });

  it("sorts maps by UTF-16 code units while retaining every semantic array index", () => {
    const result = preflight(utf16SurfaceFixture());

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected UTF-16 traversal fixture to pass.");
    expect(result.traceability.sourceNodes.map(({ sourceNodeId }) => sourceNodeId)).toEqual([
      "A-z.root",
      "A-z.third",
      "A-z.first",
      "A-z.second",
      "A.z.root",
      "A.z.third",
      "A.z.first",
      "A.z.second",
      "A:z.root",
      "A:z.third",
      "A:z.first",
      "A:z.second",
    ]);
    expect(Object.keys(result.preservedDocument.surfaces)).toEqual(["A-z", "A.z", "A:z"]);
    expect(
      result.preservedDocument.surfaces["A-z"]?.root.slots?.default?.map(({ id }) => id),
    ).toEqual(["A-z.third", "A-z.first", "A-z.second"]);
    expect(result.preservedDocument.surfaces).toBe(result.source.surfaces);
  });

  it("preserves duplicate Source requirements and their one-to-one package alignment", () => {
    const source = clone(validSource) as unknown;
    const firstRequirement = clone(valueAt(source, ["catalogs", 0])) as unknown;
    writeAt(firstRequirement, ["extensions"], { "dev.desen.test/duplicate": "second" });
    array(valueAt(source, ["catalogs"])).push(firstRequirement);

    const result = preflight(source);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected duplicate requirements to pass.");
    expect(result.sourceCatalogRequirements).toBe(result.source.catalogs);
    expect(result.sourceCatalogRequirements).toHaveLength(2);
    expect(result.sourceCatalogRequirements[1]?.extensions).toEqual({
      "dev.desen.test/duplicate": "second",
    });
    expect(result.packages).toHaveLength(1);
    expect(result.catalogSet).toHaveLength(1);
    expect(result.requirementPackageIndexes).toEqual([0, 0]);
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);
  });

  it("keeps equal node identifiers traceable when they belong to different surfaces", () => {
    const source = clone(validSource) as unknown;
    writeAt(source, ["surfaces", "sign-in", "root", "id"], "shared.root");
    writeAt(source, ["surfaces", "home", "root", "id"], "shared.root");

    const result = preflight(source);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected surface-scoped node identities to pass.");

    expect(
      result.traceability.sourceNodes
        .filter(({ sourceNodeId }) => sourceNodeId === "shared.root")
        .map(({ surfaceId, sourcePointer }) => ({ surfaceId, sourcePointer })),
    ).toEqual([
      { surfaceId: "home", sourcePointer: "/surfaces/home/root" },
      { surfaceId: "sign-in", sourcePointer: "/surfaces/sign-in/root" },
    ]);
  });

  it("accepts exact trace ceilings and rejects every one-below crossing without truncation", () => {
    const baseline = preflight(validSource);
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected baseline preservation preflight.");
    const entryCount = baseline.traceability.sourceNodes.length;
    const pointerCodeUnits = Math.max(
      ...baseline.traceability.sourceNodes.map(({ sourcePointer }) => sourcePointer.length),
    );
    const aggregateCodeUnits = baseline.traceability.sourceNodes.reduce(
      (total, entry) => total + traceCodeUnits(entry),
      0,
    );

    for (const profile of [
      limits({ maxSourceNodeTraceEntries: entryCount }),
      limits({ maxSourceNodePointerCodeUnits: pointerCodeUnits }),
      limits({ maxAggregateSourceNodeTraceCodeUnits: aggregateCodeUnits }),
    ]) {
      const result = preflight(validSource, clone(validCatalog), profile);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected an exact limit boundary to pass.");
      expect(result.traceability.sourceNodes).toHaveLength(entryCount);
    }

    for (const profile of [
      limits({ maxSourceNodeTraceEntries: entryCount - 1 }),
      limits({ maxSourceNodePointerCodeUnits: pointerCodeUnits - 1 }),
      limits({ maxAggregateSourceNodeTraceCodeUnits: aggregateCodeUnits - 1 }),
    ]) {
      expectFailure(
        preflight(validSource, clone(validCatalog), profile),
        "normalization",
        SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE,
      );
    }
  });

  it("carries the nested execution profile and exposes no preservation partial on T05 exhaustion", () => {
    const baseline = preflightPublishExecution(
      JSON.stringify(validSource),
      [candidate()],
      PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
    );
    expect("executionPreflighted" in baseline).toBe(true);
    if (!("executionPreflighted" in baseline)) {
      throw new TypeError("Expected baseline execution authority.");
    }
    const obligations = baseline.obligations.length;

    expect(
      isSuccess(
        preflight(
          validSource,
          clone(validCatalog),
          limits({}, executionLimits({ maxRuntimeValidationObligations: obligations })),
        ),
      ),
    ).toBe(true);
    expectFailure(
      preflight(
        validSource,
        clone(validCatalog),
        limits({}, executionLimits({ maxRuntimeValidationObligations: obligations - 1 })),
      ),
      "binding-compatibility",
      EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    );
  });

  it("passes every inherited T01–T05 failure through without stage or diagnostic remapping", () => {
    const candidates = [candidate()];
    const malformed = '{"kind":"desen.source",';
    expect(preflightPublishSourcePreservation(malformed, candidates)).toEqual(
      preflightPublishExecution(malformed, candidates),
    );

    const invalid = clone(validSource) as unknown;
    writeAt(invalid, ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value"], {
      $ref: "state.missing",
    });
    const raw = JSON.stringify(invalid);
    const result = preflightPublishSourcePreservation(raw, candidates);
    expect(result).toEqual(preflightPublishExecution(raw, candidates));
    expectFailure(
      result,
      "binding-compatibility",
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
    );
  });

  it("suppresses inherited warnings when the later trace envelope rejects preservation", () => {
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", STACK, "deprecated"], true);
    const successful = preflight(validSource, catalog);
    expect(isSuccess(successful)).toBe(true);
    if (!isSuccess(successful)) throw new TypeError("Expected warning-bearing preservation.");
    expect(successful.diagnostics.length).toBeGreaterThan(0);
    expect(
      successful.diagnostics.every(
        ({ code, severity }) =>
          code === "run.desen.publisher/DEPRECATED_CAPABILITY" && severity === "warning",
      ),
    ).toBe(true);

    const rejected = preflight(
      validSource,
      clone(catalog),
      limits({
        maxSourceNodeTraceEntries: successful.traceability.sourceNodes.length - 1,
      }),
    );
    expectFailure(rejected, "normalization", SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE);
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
      ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
      get maxSourceNodeTraceEntries() {
        return 1;
      },
    };
    expect(() => preflightPublishSourcePreservation(hostile, hostile, invalidLimits)).toThrow(
      TypeError,
    );
    expect(observed).toBe(false);
  });

  it("rejects inherited, accessor, symbolic, custom-prototype, and non-positive limit profiles", () => {
    const inherited = Object.create(PUBLISH_SOURCE_PRESERVATION_LIMITS) as object;
    const accessor = {
      ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
      get maxSourceNodePointerCodeUnits() {
        return 4_096;
      },
    };
    const symbolic = {
      ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
      [Symbol("extra")]: true,
    };
    const customPrototype = Object.assign(
      Object.create({ profile: true }) as MutableRecord,
      PUBLISH_SOURCE_PRESERVATION_LIMITS,
    );
    const nonPositive = {
      ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
      maxAggregateSourceNodeTraceCodeUnits: 0,
    };
    const invalidNested = {
      ...PUBLISH_SOURCE_PRESERVATION_LIMITS,
      executionPreflight: {
        ...PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
        maxRuntimeValidationObligations: Number.NaN,
      },
    };

    for (const profile of [
      inherited,
      accessor,
      symbolic,
      customPrototype,
      nonPositive,
      invalidNested,
    ]) {
      expect(() =>
        preflightPublishSourcePreservation(
          JSON.stringify(validSource),
          [candidate()],
          profile as Readonly<PublishSourcePreservationLimits>,
        ),
      ).toThrow(
        "Source-preservation limits must be an exact own-data finite positive-integer profile.",
      );
    }
  });

  it("uses an iterative walk for a deeply nested but admitted component graph", () => {
    const nodeCount = 48;
    const result = preflight(deepNodeFixture(nodeCount));

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected deep component graph to pass.");
    expect(result.traceability.sourceNodes).toHaveLength(nodeCount);
    expect(result.traceability.sourceNodes[0]?.sourceNodeId).toBe("deep.0");
    expect(result.traceability.sourceNodes.at(-1)?.sourceNodeId).toBe(`deep.${nodeCount - 1}`);
    expect(result.traceability.sourceNodes.at(-1)?.sourcePointer.endsWith("/slots/default/0")).toBe(
      true,
    );
  });

  it("ignores inherited success markers and optional graph edges", () => {
    const priorDiscriminator = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "preservationPrepared",
    );
    const priorSlots = Object.getOwnPropertyDescriptor(Object.prototype, "slots");
    const priorExtensions = Object.getOwnPropertyDescriptor(Object.prototype, "extensions");
    Object.defineProperty(Object.prototype, "preservationPrepared", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(Object.prototype, "slots", {
      configurable: true,
      value: {
        inherited: [{ id: "inherited.fake", use: TEXT }],
      },
    });
    Object.defineProperty(Object.prototype, "extensions", {
      configurable: true,
      value: { "dev.desen.test/inherited": { id: "inherited.extension.fake", use: TEXT } },
    });
    try {
      const malformed = preflightPublishSourcePreservation('{"kind":"desen.source",', [
        candidate(),
      ]);
      expect(isSuccess(malformed)).toBe(false);
      const result = preflight(validSource);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected own-data Source graph to pass.");
      expect(result.traceability.sourceNodes.map(({ sourceNodeId }) => sourceNodeId)).not.toContain(
        "inherited.fake",
      );
      expect(Object.hasOwn(result.preservedDocument, "extensions")).toBe(true);
    } finally {
      for (const [key, descriptor] of [
        ["preservationPrepared", priorDiscriminator],
        ["slots", priorSlots],
        ["extensions", priorExtensions],
      ] as const) {
        if (descriptor === undefined) Reflect.deleteProperty(Object.prototype, key);
        else Object.defineProperty(Object.prototype, key, descriptor);
      }
    }
  });

  it("is deterministic across caller member order and repeated independent runs", () => {
    const source = extensionRichSortableSource();
    const first = preflight(source, clone(validCatalog));
    const second = preflight(
      reverseObjectMemberOrder(source),
      reverseObjectMemberOrder(validCatalog),
    );
    const third = preflight(clone(source), clone(validCatalog));

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });

  it("remains package-private and exposes neither root API nor terminal publication data", () => {
    expect(Object.hasOwn(publicPublisher, "preflightPublishSourcePreservation")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "PUBLISH_SOURCE_PRESERVATION_LIMITS")).toBe(false);
    expect(Object.hasOwn(publicPublisher, "SOURCE_PRESERVATION_AUTHORITY_INVALID_CODE")).toBe(
      false,
    );
    expect(Object.hasOwn(publicPublisher, "SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE")).toBe(false);

    const result = preflight(validSource);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected nonterminal preservation success.");
    for (const forbidden of [
      "ok",
      "bundle",
      "revision",
      "sourceDigest",
      "requires",
      "publication",
      "normalized",
    ]) {
      expect(Object.hasOwn(result, forbidden)).toBe(false);
      expect(Object.hasOwn(result.preservedDocument, forbidden)).toBe(false);
    }
  });
});
