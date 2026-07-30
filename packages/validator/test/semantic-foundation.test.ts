import { describe, expect, it } from "vitest";

import bundleCatalogDigestMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-catalog-digest-mismatch.json";
import bundleRevisionMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-revision-mismatch.json";
import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCapability from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import exampleBundle from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json";
import exampleSource from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  prepareDesenSourceFoundation,
  validateDesenBundleSemantics,
  validateDesenCatalogSemantics,
  validateDesenCatalogSet,
  validatePreparedDesenSourceReferences,
  validateDesenSourceSemantics,
} from "../src/semantic-validation.js";

type MutableRecord = Record<string, unknown>;

interface DiagnosticLike {
  readonly code: string;
  readonly pointer?: string;
}

interface ValidationResultLike {
  readonly valid: boolean;
  readonly diagnostics: readonly DiagnosticLike[];
}

const COMPONENT_ID = "com.example.ui/TextField";
const BEHAVIOR_ID = "com.example.interactions/Sortable";
const OPERATION_ID = "com.example.auth/signIn";
const UNKNOWN_COMPONENT_ID = "com.example.missing/Component";
const UNKNOWN_BEHAVIOR_ID = "com.example.missing/Behavior";
const UNKNOWN_OPERATION_ID = "com.example.missing/Operation";
const UNKNOWN_RESOURCE_ID = "com.example.missing/Resource";
const INVALID_SEMVER = "run.desen.validator/INVALID_SEMVER";
const REQUIREMENT_MISMATCH = "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH";

function cloneFixture<Value>(fixture: Value): Value {
  return JSON.parse(JSON.stringify(fixture)) as Value;
}

function mutableRecord(value: unknown, label = "test fixture value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function mutableArray(value: unknown, label = "test fixture value"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function valueAt(root: unknown, path: readonly (number | string)[]): unknown {
  let current = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      current = mutableArray(current, `test fixture path ${path.join("/")}`)[segment];
    } else {
      current = mutableRecord(current, `test fixture path ${path.join("/")}`)[segment];
    }
  }
  return current;
}

function recordAt(root: unknown, path: readonly (number | string)[] = []): MutableRecord {
  return mutableRecord(valueAt(root, path), `test fixture path ${path.join("/")}`);
}

function writeAt(root: unknown, path: readonly (number | string)[], value: unknown): void {
  if (path.length === 0) throw new TypeError("A test mutation path must not be empty.");

  const parent = valueAt(root, path.slice(0, -1));
  const field = path.at(-1);
  if (field === undefined) throw new TypeError("A test mutation field must exist.");
  if (typeof field === "number") {
    mutableArray(parent)[field] = value;
  } else {
    mutableRecord(parent)[field] = value;
  }
}

function deleteAt(root: unknown, path: readonly (number | string)[]): void {
  if (path.length === 0) throw new TypeError("A test mutation path must not be empty.");

  const parent = valueAt(root, path.slice(0, -1));
  const field = path.at(-1);
  if (typeof field !== "string") throw new TypeError("Only object fields may be deleted.");
  Reflect.deleteProperty(mutableRecord(parent), field);
}

function diagnosticIdentity(
  diagnostics: readonly DiagnosticLike[],
): readonly (readonly [string, string | undefined])[] {
  return diagnostics.map(({ code, pointer }) => [code, pointer] as const);
}

function expectDiagnostic(result: ValidationResultLike, code: string, pointer: string): void {
  expect(result.valid).toBe(false);
  expect(diagnosticIdentity(result.diagnostics)).toContainEqual([code, pointer]);
}

function expectCode(result: ValidationResultLike, code: string): void {
  expect(result.valid).toBe(false);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(code);
}

function expectOnlyDiagnostic(result: ValidationResultLike, code: string, pointer: string): void {
  expect(result.valid).toBe(false);
  expect(diagnosticIdentity(result.diagnostics)).toEqual([[code, pointer]]);
}

function trustedCatalogSet(catalogs: readonly unknown[] = [validCatalog]) {
  const result = validateDesenCatalogSet(catalogs);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected a validated catalog set.");
  return result.value;
}

function validateSource(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenSourceSemantics(input, trustedCatalogSet(catalogs));
}

function validateBundle(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenBundleSemantics(input, trustedCatalogSet(catalogs));
}

function matchingSourceAndCatalog(version: string): readonly [unknown, unknown] {
  const source = cloneFixture(validSource);
  const catalog = cloneFixture(validCatalog);
  writeAt(source, ["catalogs", 0, "version"], version);
  writeAt(catalog, ["version"], version);
  return [source, catalog];
}

function matchingBundleAndCatalog(version: string): readonly [unknown, unknown] {
  const bundle = cloneFixture(validBundle);
  const catalog = cloneFixture(validCatalog);
  writeAt(bundle, ["requires", "catalogs", 0, "version"], version);
  writeAt(catalog, ["version"], version);
  return [bundle, catalog];
}

function singleCapabilityCatalog(
  capabilityId: string,
  category: "behaviors" | "components" | "operations" | "resources",
  id = "com.example.secondary-catalog",
): unknown {
  const catalog = cloneFixture(validCatalog);
  const capability = recordAt(catalog, [category, capabilityId]);
  writeAt(catalog, ["id"], id);
  writeAt(catalog, ["components"], {});
  writeAt(catalog, ["behaviors"], {});
  writeAt(catalog, ["operations"], {});
  writeAt(catalog, ["resources"], {});
  writeAt(catalog, [category, capabilityId], capability);
  return catalog;
}

function expectDeepFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, visited);
}

describe("phase-aware Source foundation", () => {
  it("prepares one detached, deeply frozen Source without serializing its runtime brand", () => {
    const mutable = cloneFixture(validSource);
    const result = prepareDesenSourceFoundation(mutable);

    expect(result).toMatchObject({
      valid: true,
      target: "source-foundation",
      diagnostics: [],
    });
    if (!result.valid) throw new TypeError("Expected Source preparation to pass.");
    expect(result.value).not.toBe(mutable);
    expect(Reflect.ownKeys(result.value).every((key) => typeof key === "string")).toBe(true);
    expectDeepFrozen(result);
  });

  it("distinguishes root, embedded-schema, and intrinsic identity failures", () => {
    const embedded = cloneFixture(validSource);
    writeAt(embedded, ["surfaces", "sign-in", "state", "email", "schema"], {
      type: "not-a-json-schema-type",
    });

    const cases = [
      [prepareDesenSourceFoundation(sourceUnknownCoreField), "root-schema", "UNKNOWN_CORE_FIELD"],
      [prepareDesenSourceFoundation(embedded), "embedded-schema", "SCHEMA_INVALID"],
      [prepareDesenSourceFoundation(sourceDuplicateNodeId), "identity", "DUPLICATE_NODE_ID"],
    ] as const;
    for (const [result, phase, code] of cases) {
      expect(result.valid).toBe(false);
      if (result.valid) throw new TypeError("Expected Source preparation to fail.");
      expect(result.phase).toBe(phase);
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
      expect(Object.hasOwn(result, "value")).toBe(false);
      expectDeepFrozen(result);
    }
  });

  it("finalizes exact Catalog relations and category-aware references only for prepared Sources", () => {
    const prepared = prepareDesenSourceFoundation(validSource);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected Source preparation to pass.");
    expect(
      validatePreparedDesenSourceReferences(prepared.value, trustedCatalogSet()),
    ).toMatchObject({ valid: true, diagnostics: [] });

    const unknown = prepareDesenSourceFoundation(sourceUnknownCapability);
    expect(unknown.valid).toBe(true);
    if (!unknown.valid) throw new TypeError("Expected intrinsic Source preparation to pass.");
    expectOnlyDiagnostic(
      validatePreparedDesenSourceReferences(unknown.value, trustedCatalogSet()),
      "UNKNOWN_CAPABILITY",
      "/surfaces/home/root/slots/default/0/use",
    );
  });

  it("rejects cloned or cast Source values and forged Catalog authority at runtime", () => {
    const prepared = prepareDesenSourceFoundation(validSource);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected Source preparation to pass.");

    const clone = cloneFixture(prepared.value) as typeof prepared.value;
    expectOnlyDiagnostic(
      validatePreparedDesenSourceReferences(clone, trustedCatalogSet()),
      "SCHEMA_INVALID",
      "",
    );

    const forgedCatalogSet = cloneFixture([validCatalog]) as unknown as ReturnType<
      typeof trustedCatalogSet
    >;
    expectOnlyDiagnostic(
      validatePreparedDesenSourceReferences(prepared.value, forgedCatalogSet),
      REQUIREMENT_MISMATCH,
      "/catalogs",
    );
  });
});

describe("M02-T07 frozen roots and stage boundaries", () => {
  it("accepts all three frozen valid conformance roots", () => {
    expect(validateDesenCatalogSemantics(validCatalog)).toMatchObject({
      valid: true,
      target: "catalog",
      diagnostics: [],
    });
    const catalogSetResult = validateDesenCatalogSet([validCatalog]);
    expect(catalogSetResult).toMatchObject({
      valid: true,
      target: "catalog-set",
      diagnostics: [],
    });
    if (!catalogSetResult.valid) throw new TypeError("Expected a valid catalog set.");

    expect(validateDesenSourceSemantics(validSource, catalogSetResult.value)).toMatchObject({
      valid: true,
      target: "source",
      diagnostics: [],
    });
    expect(validateDesenBundleSemantics(validBundle, catalogSetResult.value)).toMatchObject({
      valid: true,
      target: "bundle",
      diagnostics: [],
    });
  });

  it("accepts all five frozen example documents", () => {
    const catalogSet = trustedCatalogSet([exampleCatalog]);
    const results = [
      validateDesenCatalogSemantics(exampleCatalog),
      validateDesenSourceSemantics(exampleSource, catalogSet),
      validateDesenBundleSemantics(exampleBundle, catalogSet),
      validateDesenSourceSemantics(exampleSortableSource, catalogSet),
      validateDesenSourceSemantics(exampleStoreMapSource, catalogSet),
    ];

    expect(results.map(({ valid }) => valid)).toEqual([true, true, true, true, true]);
    expect(results.every(({ diagnostics }) => diagnostics.length === 0)).toBe(true);
  });

  it("emits the official duplicate-node diagnostic at the second occurrence", () => {
    expectOnlyDiagnostic(
      validateSource(sourceDuplicateNodeId),
      "DUPLICATE_NODE_ID",
      "/surfaces/home/root/slots/default/1/id",
    );
  });

  it("emits the official unknown-capability diagnostic at the exact use site", () => {
    expectOnlyDiagnostic(
      validateSource(sourceUnknownCapability),
      "UNKNOWN_CAPABILITY",
      "/surfaces/home/root/slots/default/0/use",
    );
  });

  it.each([
    ["unknown event", "source", sourceUnknownEvent],
    ["bundle revision mismatch", "bundle", bundleRevisionMismatch],
    ["catalog digest mismatch", "bundle", bundleCatalogDigestMismatch],
  ] as const)("leaves %s to its later owner", (_label, target, fixture) => {
    const result = target === "source" ? validateSource(fixture) : validateBundle(fixture);
    expect(result).toMatchObject({ valid: true, target, diagnostics: [] });
  });

  it("short-circuits semantic traversal when structural validation fails", () => {
    const source = cloneFixture(sourceUnknownCoreField);
    writeAt(source, ["entry"], "missing");
    writeAt(source, ["surfaces", "home", "root", "use"], UNKNOWN_COMPONENT_ID);

    expectOnlyDiagnostic(validateSource(source), "UNKNOWN_CORE_FIELD", "/script");
  });

  it("retains the literal-object dollar-property prohibition at the structural boundary", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "sign-in", "root", "props", "future"], {
      $illegal: true,
    });
    writeAt(source, ["entry"], "missing");

    const result = validateSource(source);
    expectDiagnostic(result, "SCHEMA_INVALID", "/surfaces/sign-in/root/props/future/$illegal");
    expect(result.diagnostics.some(({ code }) => code === "ENTRY_NOT_FOUND")).toBe(false);
  });
});

describe("surface, node, and behavior identity", () => {
  it("requires entry to identify an existing surface", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["entry"], "missing");

    expectOnlyDiagnostic(validateSource(source), "ENTRY_NOT_FOUND", "/entry");
  });

  it("requires every surface map key to equal its internal id", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "home", "id"], "sign-in");

    expectOnlyDiagnostic(validateSource(source), "DUPLICATE_SURFACE_ID", "/surfaces/home/id");
  });

  it("detects a nested node collision anywhere in one surface", () => {
    const source = cloneFixture(exampleStoreMapSource);
    writeAt(
      source,
      ["surfaces", "stores", "root", "slots", "default", 0, "slots", "popup", 0, "id"],
      "stores.layout",
    );

    expectOnlyDiagnostic(
      validateSource(source, [exampleCatalog]),
      "DUPLICATE_NODE_ID",
      "/surfaces/stores/root/slots/default/0/slots/popup/0/id",
    );
  });

  it("places behavior instances in the same surface identity namespace as nodes", () => {
    const source = cloneFixture(exampleSortableSource);
    writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "id"], "tasks.list");

    expectOnlyDiagnostic(
      validateSource(source, [exampleCatalog]),
      "DUPLICATE_NODE_ID",
      "/surfaces/tasks/root/behaviors/0/id",
    );
  });

  it("allows the same node identity on different surfaces", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "home", "root", "id"], "sign-in.layout");

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("applies the same entry and identity rules to Bundles", () => {
    const bundle = cloneFixture(validBundle);
    writeAt(bundle, ["entry"], "missing");
    writeAt(bundle, ["surfaces", "home", "id"], "wrong-home");

    const result = validateBundle(bundle);
    expectDiagnostic(result, "ENTRY_NOT_FOUND", "/entry");
    expectDiagnostic(result, "DUPLICATE_SURFACE_ID", "/surfaces/home/id");
  });
});

describe("resolved catalog namespace and capability references", () => {
  it("resolves component, behavior, operation, and resource references", () => {
    const catalogSet = trustedCatalogSet([exampleCatalog]);

    expect(validateDesenSourceSemantics(exampleSource, catalogSet).valid).toBe(true);
    expect(validateDesenSourceSemantics(exampleSortableSource, catalogSet).valid).toBe(true);
    expect(validateDesenSourceSemantics(exampleStoreMapSource, catalogSet).valid).toBe(true);
  });

  it.each([
    {
      category: "component",
      source: () => {
        const source = cloneFixture(validSource);
        writeAt(source, ["surfaces", "sign-in", "root", "use"], UNKNOWN_COMPONENT_ID);
        return source;
      },
      catalogs: [validCatalog],
      pointer: "/surfaces/sign-in/root/use",
    },
    {
      category: "behavior",
      source: () => {
        const source = cloneFixture(exampleSortableSource);
        writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "use"], UNKNOWN_BEHAVIOR_ID);
        return source;
      },
      catalogs: [exampleCatalog],
      pointer: "/surfaces/tasks/root/behaviors/0/use",
    },
    {
      category: "operation",
      source: () => {
        const source = cloneFixture(validSource);
        writeAt(
          source,
          ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "operation"],
          UNKNOWN_OPERATION_ID,
        );
        return source;
      },
      catalogs: [validCatalog],
      pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/operation",
    },
    {
      category: "resource",
      source: () => {
        const source = cloneFixture(exampleStoreMapSource);
        writeAt(source, ["surfaces", "stores", "resources", "stores", "use"], UNKNOWN_RESOURCE_ID);
        return source;
      },
      catalogs: [exampleCatalog],
      pointer: "/surfaces/stores/resources/stores/use",
    },
  ] as const)(
    "rejects an unknown $category capability at its exact usage",
    ({ source, catalogs, pointer }) => {
      expectOnlyDiagnostic(validateSource(source(), catalogs), "UNKNOWN_CAPABILITY", pointer);
    },
  );

  it("does not resolve an identifier through the wrong capability category", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "sign-in", "root", "use"], BEHAVIOR_ID);

    expectOnlyDiagnostic(
      validateSource(source),
      "UNKNOWN_CAPABILITY",
      "/surfaces/sign-in/root/use",
    );
  });

  it("rejects a capability id repeated across categories in one catalog", () => {
    const catalog = cloneFixture(validCatalog);
    const behavior = cloneFixture(recordAt(catalog, ["behaviors", BEHAVIOR_ID]));
    writeAt(catalog, ["behaviors", COMPONENT_ID], behavior);

    expectOnlyDiagnostic(
      validateDesenCatalogSet([catalog]),
      "AMBIGUOUS_CAPABILITY",
      "/0/behaviors/com.example.ui~1TextField",
    );
  });

  it("rejects a capability id repeated across catalogs with an escaped pointer", () => {
    const secondCatalog = singleCapabilityCatalog(COMPONENT_ID, "components");

    expectOnlyDiagnostic(
      validateDesenCatalogSet([validCatalog, secondCatalog]),
      "AMBIGUOUS_CAPABILITY",
      "/1/components/com.example.ui~1TextField",
    );
  });
});

describe("exact catalog requirements and open target strings", () => {
  it("accepts an optional Source target when id and version match", () => {
    const source = cloneFixture(validSource);
    deleteAt(source, ["catalogs", 0, "target"]);

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("accepts a non-Web target without normalizing it when both sides match exactly", () => {
    const source = cloneFixture(validSource);
    const catalog = cloneFixture(validCatalog);
    writeAt(source, ["catalogs", 0, "target"], "ios-swiftui");
    writeAt(catalog, ["target"], "ios-swiftui");

    expect(validateSource(source, [catalog])).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("rejects Source target substitution or case normalization", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, "target"], "Web-React");

    expectOnlyDiagnostic(validateSource(source), REQUIREMENT_MISMATCH, "/catalogs/0");
  });

  it("rejects a Bundle target that does not exactly match the installed catalog", () => {
    const bundle = cloneFixture(validBundle);
    writeAt(bundle, ["requires", "catalogs", 0, "target"], "web");

    expectOnlyDiagnostic(validateBundle(bundle), REQUIREMENT_MISMATCH, "/requires/catalogs/0");
  });

  it.each([
    ["id", "com.example.undeclared-catalog"],
    ["version", "1.0.1"],
  ] as const)("rejects an undeclared Source catalog %s", (field, value) => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, field], value);

    expectOnlyDiagnostic(validateSource(source), REQUIREMENT_MISMATCH, "/catalogs/0");
  });

  it("treats a Source location as a discovery hint, not package authority", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, "location"], "https://untrusted.example/catalog.json");

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("allows the trusted catalog pool to contain an undeclared extra catalog", () => {
    const secondary = singleCapabilityCatalog(OPERATION_ID, "operations");
    const operations = recordAt(secondary, ["operations"]);
    operations["com.example.secondary/ping"] = operations[OPERATION_ID];
    Reflect.deleteProperty(operations, OPERATION_ID);

    expect(validateSource(validSource, [validCatalog, secondary])).toMatchObject({
      valid: true,
      diagnostics: [],
    });
  });

  it("does not expose capabilities from a trusted catalog the Source did not declare", () => {
    const secondary = singleCapabilityCatalog(OPERATION_ID, "operations");
    const operations = recordAt(secondary, ["operations"]);
    operations["com.example.secondary/ping"] = operations[OPERATION_ID];
    Reflect.deleteProperty(operations, OPERATION_ID);
    const source = cloneFixture(validSource);
    writeAt(
      source,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "operation"],
      "com.example.secondary/ping",
    );

    expectOnlyDiagnostic(
      validateSource(source, [validCatalog, secondary]),
      "UNKNOWN_CAPABILITY",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/operation",
    );
  });

  it("retains identity diagnostics without capability cascades after a requirement mismatch", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, "id"], "com.example.undeclared-catalog");
    writeAt(source, ["entry"], "missing");
    writeAt(source, ["surfaces", "home", "id"], "wrong-home");
    writeAt(source, ["surfaces", "home", "root", "use"], UNKNOWN_COMPONENT_ID);

    const result = validateSource(source);
    expect(result.valid).toBe(false);
    expect(diagnosticIdentity(result.diagnostics)).toEqual([
      [REQUIREMENT_MISMATCH, "/catalogs/0"],
      ["ENTRY_NOT_FOUND", "/entry"],
      ["DUPLICATE_SURFACE_ID", "/surfaces/home/id"],
    ]);
  });
});

describe("strict Semantic Versioning", () => {
  const VALID_VERSIONS = [
    "0.0.0",
    "1.2.3",
    "1.2.3-alpha",
    "1.2.3-alpha.1",
    "1.2.3-0A-a",
    "1.2.3+build.001",
    "1.2.3-alpha.1+build.001",
    "999999999999999999999999.2.3",
  ] as const;

  const SCHEMA_GAP_VERSIONS = ["1.0.0-01", "1.0.0-alpha..1", "1.0.0+build..1"] as const;

  const INVALID_SOURCE_VERSIONS = [
    ...SCHEMA_GAP_VERSIONS,
    "01.0.0",
    "1.01.0",
    "1.0.01",
    "1.0",
    "1.0.0-",
    "1.0.0+",
    "v1.0.0",
    "^1.0.0",
    ">=1.0.0",
    "1.0.0 || 2.0.0",
    " 1.0.0",
  ] as const;

  it.each(VALID_VERSIONS)(
    "accepts exact SemVer %s in catalogs, Sources, and Bundles",
    (version) => {
      const [source, sourceCatalog] = matchingSourceAndCatalog(version);
      const [bundle, bundleCatalog] = matchingBundleAndCatalog(version);

      expect(validateDesenCatalogSet([sourceCatalog])).toMatchObject({
        valid: true,
        diagnostics: [],
      });
      expect(validateSource(source, [sourceCatalog])).toMatchObject({
        valid: true,
        diagnostics: [],
      });
      expect(validateBundle(bundle, [bundleCatalog])).toMatchObject({
        valid: true,
        diagnostics: [],
      });
    },
  );

  it.each(SCHEMA_GAP_VERSIONS)(
    "closes the frozen catalog-schema gap for invalid SemVer %s",
    (version) => {
      const catalog = cloneFixture(validCatalog);
      writeAt(catalog, ["version"], version);

      expectOnlyDiagnostic(validateDesenCatalogSet([catalog]), INVALID_SEMVER, "/0/version");
    },
  );

  it.each(SCHEMA_GAP_VERSIONS)(
    "closes the frozen Bundle-schema gap for invalid SemVer %s",
    (version) => {
      const bundle = cloneFixture(validBundle);
      writeAt(bundle, ["requires", "catalogs", 0, "version"], version);

      expectDiagnostic(validateBundle(bundle), INVALID_SEMVER, "/requires/catalogs/0/version");
    },
  );

  it.each(INVALID_SOURCE_VERSIONS)("rejects non-exact Source version %s", (version) => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, "version"], version);

    expectDiagnostic(validateSource(source), INVALID_SEMVER, "/catalogs/0/version");
  });

  it.each(["01.0.0", "1.01.0", "1.0.01", "1.0", "1.0.0-", "^1.0.0"] as const)(
    "preserves frozen structural rejection for catalog version %s",
    (version) => {
      const catalog = cloneFixture(validCatalog);
      writeAt(catalog, ["version"], version);

      expectDiagnostic(validateDesenCatalogSet([catalog]), "SCHEMA_INVALID", "/0/version");
    },
  );
});

describe("extension opacity and preservation", () => {
  it("preserves unknown extensions without assigning them core semantics", () => {
    const source = cloneFixture(validSource);
    const extension = {
      entry: "missing",
      id: "sign-in.layout",
      nested: {
        id: "sign-in.layout",
        use: UNKNOWN_COMPONENT_ID,
        $ref: "state.missing",
      },
      enabled: true,
      values: [1, "two", null],
    };
    writeAt(source, ["extensions", "com.example.future"], extension);

    const result = validateSource(source);
    expect(result).toMatchObject({ valid: true, diagnostics: [] });
    if (!result.valid) throw new TypeError("Expected semantic validation to succeed.");
    expect(recordAt(result.value, ["extensions"])["com.example.future"]).toEqual(extension);
  });

  it("does not hard-fail an extension key that is not reverse-domain formatted", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["extensions", "future"], { enabled: true });

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("preserves extensions at nested core extension points", () => {
    const source = cloneFixture(validSource);
    const extension = { futureMeaning: { use: UNKNOWN_COMPONENT_ID } };
    writeAt(source, ["surfaces", "sign-in", "root", "extensions"], {
      "com.example.node": extension,
    });

    const result = validateSource(source);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected semantic validation to succeed.");
    expect(
      recordAt(result.value, ["surfaces", "sign-in", "root", "extensions"])["com.example.node"],
    ).toEqual(extension);
  });
});

describe("inert trust boundary and immutable semantic results", () => {
  it("copies without mutating or retaining the caller's Source", () => {
    const source = cloneFixture(validSource);
    const before = cloneFixture(source);
    const result = validateSource(source);

    expect(source).toEqual(before);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected semantic validation to succeed.");
    expect(result.value).not.toBe(source);

    writeAt(source, ["id"], "caller-mutated-after-validation");
    expect(recordAt(result.value).id).toBe("com.example.account-app");
  });

  it("copies catalogs before branding the trusted set", () => {
    const catalog = cloneFixture(validCatalog);
    const catalogSet = trustedCatalogSet([catalog]);
    writeAt(catalog, ["components"], {});

    expect(validateDesenSourceSemantics(validSource, catalogSet)).toMatchObject({
      valid: true,
      diagnostics: [],
    });
  });

  it("rejects Source accessors without invoking them", () => {
    let getterInvocations = 0;
    const hostile = Object.defineProperty({}, "desen", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return "0.1.0";
      },
    });

    expectOnlyDiagnostic(validateSource(hostile), "SCHEMA_INVALID", "");
    expect(getterInvocations).toBe(0);
  });

  it("rejects hostile catalog accessors without invoking them", () => {
    let getterInvocations = 0;
    const hostile = Object.defineProperty({}, "kind", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return "desen.catalog";
      },
    });

    expectCode(validateDesenCatalogSet([hostile]), "SCHEMA_INVALID");
    expect(getterInvocations).toBe(0);
  });

  it("ignores inherited optional Source fields throughout semantic traversal", () => {
    const operationAction = {
      type: "operation.invoke",
      operation: UNKNOWN_OPERATION_ID,
      as: "prototype.operation",
      input: {},
    } as const;
    const sourceWithoutTarget = cloneFixture(validSource);
    deleteAt(sourceWithoutTarget, ["catalogs", 0, "target"]);
    const cases = [
      {
        key: "target",
        value: "prototype-target",
        source: sourceWithoutTarget,
        catalogs: [validCatalog],
      },
      {
        key: "behaviors",
        value: [
          {
            id: "prototype.behavior",
            use: UNKNOWN_BEHAVIOR_ID,
            props: {},
          },
        ],
        source: validSource,
        catalogs: [validCatalog],
      },
      {
        key: "on",
        value: { polluted: [operationAction] },
        source: validSource,
        catalogs: [validCatalog],
      },
      {
        key: "slots",
        value: {
          polluted: [
            {
              id: "prototype.node",
              use: UNKNOWN_COMPONENT_ID,
              props: {},
            },
          ],
        },
        source: validSource,
        catalogs: [validCatalog],
      },
      {
        key: "onSuccess",
        value: [operationAction],
        source: exampleSortableSource,
        catalogs: [exampleCatalog],
      },
      {
        key: "onFailure",
        value: [operationAction],
        source: exampleSortableSource,
        catalogs: [exampleCatalog],
      },
    ] as const;

    for (const testCase of cases) {
      const prior = Object.getOwnPropertyDescriptor(Object.prototype, testCase.key);
      let result: ReturnType<typeof validateSource>;
      Object.defineProperty(Object.prototype, testCase.key, {
        configurable: true,
        value: testCase.value,
        writable: true,
      });
      try {
        result = validateSource(testCase.source, testCase.catalogs);
      } finally {
        if (prior === undefined) Reflect.deleteProperty(Object.prototype, testCase.key);
        else Object.defineProperty(Object.prototype, testCase.key, prior);
      }

      expect(result, testCase.key).toMatchObject({ valid: true, diagnostics: [] });
    }
  });

  it("rejects cyclic Source and catalog inputs", () => {
    const cyclicSource: MutableRecord = {};
    cyclicSource.self = cyclicSource;
    const cyclicCatalog: MutableRecord = {};
    cyclicCatalog.self = cyclicCatalog;

    expectOnlyDiagnostic(validateSource(cyclicSource), "SCHEMA_INVALID", "");
    expectCode(validateDesenCatalogSet([cyclicCatalog]), "SCHEMA_INVALID");
  });

  it("does not trust a caller-cast array as a validated catalog set", () => {
    const fakeCatalogSet = cloneFixture([validCatalog]) as unknown as ReturnType<
      typeof trustedCatalogSet
    >;

    expectCode(validateDesenSourceSemantics(validSource, fakeCatalogSet), REQUIREMENT_MISMATCH);
  });

  it("reports strict SemVer independently of a forged catalog set", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["catalogs", 0, "version"], "1.0.0-01");
    const fakeCatalogSet = cloneFixture([validCatalog]) as unknown as ReturnType<
      typeof trustedCatalogSet
    >;

    const result = validateDesenSourceSemantics(source, fakeCatalogSet);
    expectDiagnostic(result, REQUIREMENT_MISMATCH, "/catalogs");
    expectDiagnostic(result, INVALID_SEMVER, "/catalogs/0/version");
  });

  it("deep-freezes the catalog set and successful semantic snapshot", () => {
    const catalogSetResult = validateDesenCatalogSet([validCatalog]);
    expect(catalogSetResult.valid).toBe(true);
    if (!catalogSetResult.valid) throw new TypeError("Expected a validated catalog set.");
    const sourceResult = validateDesenSourceSemantics(validSource, catalogSetResult.value);
    expect(sourceResult.valid).toBe(true);
    if (!sourceResult.valid) throw new TypeError("Expected semantic validation to succeed.");

    expectDeepFrozen(catalogSetResult);
    expectDeepFrozen(sourceResult);
  });

  it("freezes failure diagnostics and result shells", () => {
    const result = validateSource(sourceUnknownCapability);
    expect(result.valid).toBe(false);
    if (result.valid) throw new TypeError("Expected semantic validation to fail.");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(result.diagnostics.every(Object.isFrozen)).toBe(true);
  });
});

describe("deterministic semantic diagnostics", () => {
  function invalidSourceWithSurfaceOrder(order: readonly string[]): unknown {
    const source = cloneFixture(sourceDuplicateNodeId);
    writeAt(source, ["entry"], "missing");
    writeAt(source, ["surfaces", "home", "id"], "wrong-home");
    writeAt(source, ["surfaces", "home", "root", "use"], UNKNOWN_COMPONENT_ID);

    const surfaces = recordAt(source, ["surfaces"]);
    const originals = cloneFixture(surfaces);
    for (const key of Object.keys(surfaces)) Reflect.deleteProperty(surfaces, key);
    for (const key of order) surfaces[key] = originals[key];
    return source;
  }

  it("sorts and de-duplicates independently of object insertion order", () => {
    const first = validateSource(invalidSourceWithSurfaceOrder(["sign-in", "home"]));
    const second = validateSource(invalidSourceWithSurfaceOrder(["home", "sign-in"]));

    expect(first.valid).toBe(false);
    expect(second.valid).toBe(false);
    expect(first.diagnostics).toEqual(second.diagnostics);

    const identities = diagnosticIdentity(first.diagnostics).map(
      ([code, pointer]) => `${code}\u0000${pointer ?? ""}`,
    );
    expect(new Set(identities).size).toBe(identities.length);
  });
});

describe("M02-T08 through M02-T11 semantic scope fences", () => {
  it("leaves prop, slot, style-part, and visual-state contracts to M02-T08", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "sign-in", "root", "props", "futureProp"], 123);
    writeAt(source, ["surfaces", "sign-in", "root", "slots", "futureSlot"], []);
    writeAt(source, ["surfaces", "sign-in", "root", "style"], {
      futureState: { futurePart: { color: "red" } },
    });

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("leaves event contracts and behavior attachment to M02-T09", () => {
    expect(validateSource(sourceUnknownEvent)).toMatchObject({ valid: true, diagnostics: [] });

    const source = cloneFixture(exampleSortableSource);
    writeAt(source, ["surfaces", "tasks", "root", "use"], "com.example.ui/Text");
    expect(validateSource(source, [exampleCatalog])).toMatchObject({
      valid: true,
      diagnostics: [],
    });
  });

  it("leaves state values, references, predicates, and repeat aliases to M02-T10", () => {
    const source = cloneFixture(validSource);
    writeAt(source, ["surfaces", "sign-in", "state", "email", "initial"], 42);
    writeAt(source, ["surfaces", "sign-in", "root", "props", "future"], {
      $ref: "state.missing",
    });
    writeAt(source, ["surfaces", "sign-in", "root", "when"], {
      op: "truthy",
      args: [{ $ref: "state.missing" }],
    });

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });

    const repeated = cloneFixture(exampleSortableSource);
    writeAt(repeated, ["surfaces", "tasks", "root", "slots", "default", 0, "slots"], {
      nested: [
        {
          id: "tasks.item.nested",
          use: "com.example.ui/Text",
          repeat: {
            items: { $ref: "resource.tasks.value" },
            as: "task",
            key: { $ref: "item.task.id" },
          },
        },
      ],
    });
    expect(validateSource(repeated, [exampleCatalog])).toMatchObject({
      valid: true,
      diagnostics: [],
    });
  });

  it("leaves operation inputs and navigation targets to M02-T11", () => {
    const source = cloneFixture(validSource);
    writeAt(
      source,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "input"],
      { unexpected: true },
    );
    writeAt(
      source,
      [
        "surfaces",
        "sign-in",
        "root",
        "slots",
        "default",
        4,
        "on",
        "press",
        0,
        "onSuccess",
        0,
        "surface",
      ],
      "missing",
    );

    expect(validateSource(source)).toMatchObject({ valid: true, diagnostics: [] });
  });

  it("leaves known resource input contracts to M02-T11", () => {
    const source = cloneFixture(exampleStoreMapSource);
    writeAt(source, ["surfaces", "stores", "resources", "stores", "input"], {
      unexpected: true,
    });

    expect(validateSource(source, [exampleCatalog])).toMatchObject({
      valid: true,
      diagnostics: [],
    });
  });
});
