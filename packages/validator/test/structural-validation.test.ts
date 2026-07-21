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
  validateDesenBundle,
  validateDesenCatalog,
  validateDesenSource,
  validateDesenStructure,
} from "../src/index.js";
import { jsonEqual, unicodeLength } from "../src/standalone-runtime.js";
import { isAbsoluteUri, isUriReference } from "../src/uri-reference.js";

import type {
  DesenStructuralDiagnostic,
  DesenStructuralTarget,
  DesenStructuralValidationResult,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

interface LocatorCase {
  readonly label: string;
  readonly target: DesenStructuralTarget;
  readonly fixture: unknown;
  readonly path: readonly string[];
  readonly expectedPointer: string;
}

const INVALID_SCHEMA = Object.freeze({ type: "not-a-type" });
const SOURCE_SCHEMA_PATH = ["surfaces", "sign-in", "state", "email", "schema"] as const;
const SOURCE_SCHEMA_POINTER = "/surfaces/sign-in/state/email/schema";
const COMPONENT_ID = "com.example.ui/TextField";
const BEHAVIOR_ID = "com.example.interactions/Sortable";
const OPERATION_ID = "com.example.auth/signIn";
const RESOURCE_ID = "com.example.stores/list";

function cloneFixture<Value>(fixture: Value): Value {
  return JSON.parse(JSON.stringify(fixture)) as Value;
}

function mutableRecord(value: unknown, label = "test fixture value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function recordAt(root: unknown, path: readonly string[]): MutableRecord {
  let current = mutableRecord(root, "test fixture root");
  for (const segment of path) {
    current = mutableRecord(current[segment], `test fixture path ${path.join("/")}`);
  }
  return current;
}

function writeAt(root: unknown, path: readonly string[], value: unknown): void {
  if (path.length === 0) throw new TypeError("A test mutation path must not be empty.");

  let current = mutableRecord(root, "test fixture root");
  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];
    if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
      const child: MutableRecord = {};
      current[segment] = child;
      current = child;
    } else {
      current = existing as MutableRecord;
    }
  }

  const field = path.at(-1);
  if (field === undefined) throw new TypeError("A test mutation field must exist.");
  current[field] = value;
}

function sourceWithEmbeddedSchema(schema: unknown): unknown {
  const source = cloneFixture(validSource);
  writeAt(source, SOURCE_SCHEMA_PATH, schema);
  return source;
}

function diagnosticIdentity(
  diagnostics: readonly DesenStructuralDiagnostic[],
): readonly (readonly [string, string | undefined])[] {
  return diagnostics.map(({ code, pointer }) => [code, pointer] as const);
}

function expectSingleDiagnostic(
  result: DesenStructuralValidationResult<DesenStructuralTarget>,
  code: DesenStructuralDiagnostic["code"],
  pointer: string,
): void {
  expect(result.valid).toBe(false);
  if (result.valid) throw new TypeError("Expected a structural-validation failure.");
  expect(diagnosticIdentity(result.diagnostics)).toEqual([[code, pointer]]);
}

const LOCATOR_CASES: readonly LocatorCase[] = [
  {
    label: "Source surface state schema",
    target: "source",
    fixture: validSource,
    path: SOURCE_SCHEMA_PATH,
    expectedPointer: `${SOURCE_SCHEMA_POINTER}/type`,
  },
  {
    label: "Bundle surface state schema",
    target: "bundle",
    fixture: validBundle,
    path: SOURCE_SCHEMA_PATH,
    expectedPointer: `${SOURCE_SCHEMA_POINTER}/type`,
  },
  {
    label: "component propsSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["components", COMPONENT_ID, "propsSchema"],
    expectedPointer: "/components/com.example.ui~1TextField/propsSchema/type",
  },
  {
    label: "component event payloadSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["components", COMPONENT_ID, "events", "change", "payloadSchema"],
    expectedPointer: "/components/com.example.ui~1TextField/events/change/payloadSchema/type",
  },
  {
    label: "component command inputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["components", COMPONENT_ID, "commands", "focus", "inputSchema"],
    expectedPointer: "/components/com.example.ui~1TextField/commands/focus/inputSchema/type",
  },
  {
    label: "component style-part propertiesSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["components", COMPONENT_ID, "styleParts", "root", "propertiesSchema"],
    expectedPointer: "/components/com.example.ui~1TextField/styleParts/root/propertiesSchema/type",
  },
  {
    label: "behavior propsSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["behaviors", BEHAVIOR_ID, "propsSchema"],
    expectedPointer: "/behaviors/com.example.interactions~1Sortable/propsSchema/type",
  },
  {
    label: "behavior event payloadSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["behaviors", BEHAVIOR_ID, "events", "reorder", "payloadSchema"],
    expectedPointer:
      "/behaviors/com.example.interactions~1Sortable/events/reorder/payloadSchema/type",
  },
  {
    label: "behavior command inputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["behaviors", BEHAVIOR_ID, "commands", "probe", "inputSchema"],
    expectedPointer:
      "/behaviors/com.example.interactions~1Sortable/commands/probe/inputSchema/type",
  },
  {
    label: "behavior style-part propertiesSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["behaviors", BEHAVIOR_ID, "styleParts", "dropIndicator", "propertiesSchema"],
    expectedPointer:
      "/behaviors/com.example.interactions~1Sortable/styleParts/dropIndicator/propertiesSchema/type",
  },
  {
    label: "operation inputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["operations", OPERATION_ID, "inputSchema"],
    expectedPointer: "/operations/com.example.auth~1signIn/inputSchema/type",
  },
  {
    label: "operation outputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["operations", OPERATION_ID, "outputSchema"],
    expectedPointer: "/operations/com.example.auth~1signIn/outputSchema/type",
  },
  {
    label: "resource inputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["resources", RESOURCE_ID, "inputSchema"],
    expectedPointer: "/resources/com.example.stores~1list/inputSchema/type",
  },
  {
    label: "resource outputSchema",
    target: "catalog",
    fixture: validCatalog,
    path: ["resources", RESOURCE_ID, "outputSchema"],
    expectedPointer: "/resources/com.example.stores~1list/outputSchema/type",
  },
];

describe("DESEN 0.1.0 structural roots", () => {
  it("accepts each frozen conformance root through its dedicated entry point", () => {
    const sourceResult = validateDesenSource(validSource);
    const bundleResult = validateDesenBundle(validBundle);
    const catalogResult = validateDesenCatalog(validCatalog);

    expect(sourceResult).toMatchObject({ valid: true, target: "source", diagnostics: [] });
    expect(bundleResult).toMatchObject({ valid: true, target: "bundle", diagnostics: [] });
    expect(catalogResult).toMatchObject({ valid: true, target: "catalog", diagnostics: [] });
  });

  it.each([
    ["example catalog", "catalog", exampleCatalog],
    ["example bundle", "bundle", exampleBundle],
    ["example sign-in source", "source", exampleSource],
    ["example sortable-list source", "source", exampleSortableSource],
    ["example store-map source", "source", exampleStoreMapSource],
  ] as const)("accepts the frozen %s", (_label, target, fixture) => {
    expect(validateDesenStructure(target, fixture)).toMatchObject({ valid: true, target });
  });

  it("rejects a root with the wrong target and an unknown runtime target", () => {
    expect(validateDesenBundle(validSource)).toMatchObject({ valid: false, target: "bundle" });
    expect(() => validateDesenStructure("future" as "source", validSource)).toThrow(TypeError);
  });
});

describe("root diagnostic mapping", () => {
  it("maps the frozen unknown core-field vector to UNKNOWN_CORE_FIELD at its exact pointer", () => {
    expectSingleDiagnostic(
      validateDesenSource(sourceUnknownCoreField),
      "UNKNOWN_CORE_FIELD",
      "/script",
    );
  });

  it("maps a missing required property to SCHEMA_INVALID at the missing-property pointer", () => {
    const source = cloneFixture(validSource);
    delete mutableRecord(source).id;

    const result = validateDesenSource(source);
    expectSingleDiagnostic(result, "SCHEMA_INVALID", "/id");
    if (!result.valid) expect(result.diagnostics[0]?.classification).toBe("schema");
  });

  it("maps an unknown nested field to UNKNOWN_CORE_FIELD with RFC 6901 escaping", () => {
    const source = cloneFixture(validSource);
    recordAt(source, ["surfaces", "sign-in", "state", "email"])["future/~"] = true;

    expectSingleDiagnostic(
      validateDesenSource(source),
      "UNKNOWN_CORE_FIELD",
      "/surfaces/sign-in/state/email/future~1~0",
    );
  });

  it("maps an invalid property name to SCHEMA_INVALID and de-duplicates Ajv sub-errors", () => {
    const source = cloneFixture(validSource);
    const surfaces = recordAt(source, ["surfaces"]);
    surfaces["bad/name~"] = surfaces["sign-in"];
    delete surfaces["sign-in"];

    expectSingleDiagnostic(validateDesenSource(source), "SCHEMA_INVALID", "/surfaces/bad~1name~0");
  });

  it("maps an explicitly unsupported string version only to UNSUPPORTED_PROTOCOL", () => {
    const source = cloneFixture(validSource);
    mutableRecord(source).desen = "0.2.0";

    const result = validateDesenSource(source);
    expectSingleDiagnostic(result, "UNSUPPORTED_PROTOCOL", "/desen");
    if (!result.valid) expect(result.diagnostics[0]?.classification).toBe("activation");
  });

  it("keeps a non-string protocol version as a schema error", () => {
    const source = cloneFixture(validSource);
    mutableRecord(source).desen = 1;

    expectSingleDiagnostic(validateDesenSource(source), "SCHEMA_INVALID", "/desen");
  });

  it("does not expose invalid values in explanatory messages", () => {
    const source = cloneFixture(validSource);
    mutableRecord(source).kind = "do-not-echo-this-value";
    const result = validateDesenSource(source);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.diagnostics.every(({ message }) => !message.includes("do-not-echo-this-value")),
      ).toBe(true);
    }
  });
});

describe("embedded JSON Schema discovery", () => {
  it("covers all 14 Source, Bundle, component, behavior, operation, and resource locators", () => {
    expect(LOCATOR_CASES).toHaveLength(14);

    for (const locator of LOCATOR_CASES) {
      const document = cloneFixture(locator.fixture);
      writeAt(document, locator.path, INVALID_SCHEMA);
      const result = validateDesenStructure(locator.target, document);

      expectSingleDiagnostic(result, "SCHEMA_INVALID", locator.expectedPointer);
    }
  });

  it("stops after an invalid root instead of traversing embedded schemas", () => {
    const source = sourceWithEmbeddedSchema(INVALID_SCHEMA);
    mutableRecord(source).script = "unknown core field";
    const result = validateDesenSource(source);

    expectSingleDiagnostic(result, "UNKNOWN_CORE_FIELD", "/script");
    if (!result.valid) {
      expect(
        result.diagnostics.some(({ pointer }) => pointer === `${SOURCE_SCHEMA_POINTER}/type`),
      ).toBe(false);
    }
  });
});

describe("embedded JSON Schema policy", () => {
  it("rejects a foreign dialect at the exact nested $schema pointer", () => {
    const source = sourceWithEmbeddedSchema({
      type: "object",
      properties: {
        value: {
          $schema: "https://json-schema.org/draft/2019-09/schema",
          type: "string",
        },
      },
    });

    expectSingleDiagnostic(
      validateDesenSource(source),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/properties/value/$schema`,
    );
  });

  it.each([
    ["$ref", { $ref: "https://schemas.example.invalid/value.json" }],
    ["$dynamicRef", { $dynamicRef: "https://schemas.example.invalid/value.json#value" }],
  ] as const)("rejects an external %s without resolution", (keyword, schema) => {
    expectSingleDiagnostic(
      validateDesenSource(sourceWithEmbeddedSchema(schema)),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/${keyword}`,
    );
  });

  it.each([
    ["space", { $ref: "# bad" }],
    ["malformed percent escape", { $ref: "#%ZZ" }],
    ["malformed dynamic reference", { $dynamicRef: "#%0G" }],
  ] as const)("rejects a local reference with %s", (_label, schema) => {
    const keyword = "$ref" in schema ? "$ref" : "$dynamicRef";
    expectSingleDiagnostic(
      validateDesenSource(sourceWithEmbeddedSchema(schema)),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/${keyword}`,
    );
  });

  it("rejects malformed schema and vocabulary identifiers", () => {
    expectSingleDiagnostic(
      validateDesenSource(sourceWithEmbeddedSchema({ $id: "http://[invalid", type: "string" })),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/$id`,
    );
    expectSingleDiagnostic(
      validateDesenSource(
        sourceWithEmbeddedSchema({
          $vocabulary: { "not a uri": true },
          type: "string",
        }),
      ),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/$vocabulary/not a uri`,
    );
  });

  it("accepts an empty $id fragment and rejects a non-empty fragment", () => {
    expect(
      validateDesenSource(
        sourceWithEmbeddedSchema({
          $id: "https://schemas.example.test/embedded#",
          type: "string",
        }),
      ),
    ).toMatchObject({ valid: true, target: "source" });

    expectSingleDiagnostic(
      validateDesenSource(
        sourceWithEmbeddedSchema({
          $id: "https://schemas.example.test/embedded#named",
          type: "string",
        }),
      ),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/$id`,
    );
  });

  it("rejects invalid regular expressions in pattern and patternProperties", () => {
    expectSingleDiagnostic(
      validateDesenSource(sourceWithEmbeddedSchema({ type: "string", pattern: "[" })),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/pattern`,
    );

    expectSingleDiagnostic(
      validateDesenSource(
        sourceWithEmbeddedSchema({
          type: "object",
          patternProperties: { "bad[/~": { type: "string" } },
        }),
      ),
      "SCHEMA_INVALID",
      `${SOURCE_SCHEMA_POINTER}/patternProperties/bad[~1~0`,
    );
  });

  it("accepts local references, an omitted dialect, annotations, and custom keywords", () => {
    const schemas = [
      {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $defs: { text: { type: "string" } },
        $ref: "#/$defs/text",
      },
      { $ref: "" },
      {
        type: "string",
        format: "com.example/custom-format",
        "com.example/custom-keyword": { policy: "host-owned" },
      },
      {
        $id: "https://schemas.example.test/embedded",
        $vocabulary: { "https://json-schema.org/draft/2020-12/vocab/core": true },
        type: "string",
      },
    ] as const;

    for (const schema of schemas) {
      expect(validateDesenSource(sourceWithEmbeddedSchema(schema))).toMatchObject({
        valid: true,
        target: "source",
      });
    }
  });
});

describe("standalone JSON helpers", () => {
  it("counts astral Unicode characters as one code point", () => {
    expect(unicodeLength("A😀𝄞")).toBe(3);
    expect(unicodeLength("plain")).toBe(5);
  });

  it("matches deeply nested inert JSON without depending on object insertion order", () => {
    expect(jsonEqual({ a: [1, { b: true }], c: null }, { c: null, a: [1, { b: true }] })).toBe(
      true,
    );
    expect(jsonEqual([1, { b: true }], [1, { b: false }])).toBe(false);
    expect(jsonEqual({ 0: "value" }, ["value"])).toBe(false);
  });

  it("keeps generated uniqueItems validation connected to the local equality helper", () => {
    const catalog = cloneFixture(validCatalog);
    recordAt(catalog, ["components", COMPONENT_ID]).visualStates = ["focus", "focus"];

    expectSingleDiagnostic(
      validateDesenCatalog(catalog),
      "SCHEMA_INVALID",
      "/components/com.example.ui~1TextField/visualStates",
    );
  });
});

describe("RFC 3986 schema identifier syntax", () => {
  it.each([
    "",
    "#",
    "#/$defs/value",
    "relative/path",
    "../schema",
    "urn:example:test",
    "https://schemas.example.test/a?b=c#part",
    "http://[2001:db8::1]:8080/schema",
    "http://[v1.fe]:80/schema",
    "http://[V1.fe]/schema",
  ])("accepts the valid URI reference %s", (reference) => {
    expect(isUriReference(reference)).toBe(true);
  });

  it.each([
    "# bad",
    "#%ZZ",
    "http://[invalid",
    "http://[not-an-ip-literal]",
    "http://host:abc",
    "http://a@b@c",
    "http://[2001:db8:::1]",
    "1:not-a-scheme",
  ])("rejects the malformed URI reference %s", (reference) => {
    expect(isUriReference(reference)).toBe(false);
  });

  it("distinguishes absolute vocabulary URIs from relative references", () => {
    expect(isAbsoluteUri("https://json-schema.org/draft/2020-12/vocab/core")).toBe(true);
    expect(isAbsoluteUri("urn:example:vocabulary")).toBe(true);
    expect(isAbsoluteUri("relative/vocabulary")).toBe(false);
    expect(isAbsoluteUri("#vocabulary")).toBe(false);
  });
});

describe("M02-T06 semantic scope fence", () => {
  it.each([
    ["duplicate node identity", "source", sourceDuplicateNodeId],
    ["unknown capability", "source", sourceUnknownCapability],
    ["unknown event", "source", sourceUnknownEvent],
    ["bundle revision mismatch", "bundle", bundleRevisionMismatch],
    ["bundle catalog digest mismatch", "bundle", bundleCatalogDigestMismatch],
  ] as const)("leaves %s to its later validation stage", (_label, target, fixture) => {
    expect(validateDesenStructure(target, fixture)).toMatchObject({
      valid: true,
      target,
      diagnostics: [],
    });
  });
});

describe("inert input boundary and immutable results", () => {
  it("copies without mutating or retaining the caller's document", () => {
    const source = cloneFixture(validSource);
    const before = cloneFixture(source);
    const originalId = mutableRecord(source).id;
    const result = validateDesenSource(source);

    expect(result.valid).toBe(true);
    expect(source).toEqual(before);
    expect(Object.isFrozen(source)).toBe(false);
    if (!result.valid) throw new TypeError("Expected a structural-validation success.");
    expect(result.value).not.toBe(source);

    mutableRecord(source).id = "caller-mutated-after-validation";
    expect(mutableRecord(result.value).id).toBe(originalId);
  });

  it("rejects accessors without invoking them", () => {
    let getterInvocations = 0;
    const hostile = Object.defineProperty({}, "desen", {
      enumerable: true,
      get() {
        getterInvocations += 1;
        return "0.1.0";
      },
    });

    expectSingleDiagnostic(validateDesenSource(hostile), "SCHEMA_INVALID", "");
    expect(getterInvocations).toBe(0);
  });

  it.each([
    [
      "cyclic objects",
      (() => {
        const cyclic: MutableRecord = {};
        cyclic.self = cyclic;
        return cyclic;
      })(),
    ],
    ["sparse arrays", new Array(1)],
    [
      "custom prototypes",
      (() => {
        class CustomDocument {
          readonly desen = "0.1.0";
        }
        return new CustomDocument();
      })(),
    ],
    ["non-finite numbers", { value: Number.NaN }],
    ["undefined properties", { value: undefined }],
  ] as const)("rejects %s as non-inert JSON", (_label, input) => {
    expectSingleDiagnostic(validateDesenSource(input), "SCHEMA_INVALID", "");
  });

  it("deep-freezes the success snapshot, result shell, and empty diagnostics", () => {
    const result = validateDesenSource(validSource);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected a structural-validation success.");

    const value = mutableRecord(result.value);
    const surfaces = recordAt(value, ["surfaces"]);
    const signIn = recordAt(value, ["surfaces", "sign-in"]);
    const state = recordAt(value, ["surfaces", "sign-in", "state"]);
    const emailSchema = recordAt(value, ["surfaces", "sign-in", "state", "email", "schema"]);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(surfaces)).toBe(true);
    expect(Object.isFrozen(signIn)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(emailSchema)).toBe(true);
  });

  it("freezes failure diagnostics and their result shell", () => {
    const result = validateDesenSource(sourceUnknownCoreField);
    expect(result.valid).toBe(false);
    if (result.valid) throw new TypeError("Expected a structural-validation failure.");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(result.diagnostics.every(Object.isFrozen)).toBe(true);
  });
});

describe("deterministic diagnostics", () => {
  function invalidSourceWithInsertionOrder(order: readonly string[]): unknown {
    const source = cloneFixture(validSource);
    const root = mutableRecord(source);
    delete root.id;
    root.desen = "9.9.9";
    for (const field of order) root[field] = true;

    const surfaces = recordAt(source, ["surfaces"]);
    surfaces["bad/name~"] = surfaces["sign-in"];
    delete surfaces["sign-in"];
    return source;
  }

  it("sorts, escapes, and de-duplicates independently of object insertion order", () => {
    const first = validateDesenSource(invalidSourceWithInsertionOrder(["z/field", "a~field"]));
    const second = validateDesenSource(invalidSourceWithInsertionOrder(["a~field", "z/field"]));

    expect(first.valid).toBe(false);
    expect(second.valid).toBe(false);
    if (first.valid || second.valid)
      throw new TypeError("Expected structural-validation failures.");

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(diagnosticIdentity(first.diagnostics)).toEqual([
      ["UNKNOWN_CORE_FIELD", "/a~0field"],
      ["UNSUPPORTED_PROTOCOL", "/desen"],
      ["SCHEMA_INVALID", "/id"],
      ["SCHEMA_INVALID", "/surfaces/bad~1name~0"],
      ["UNKNOWN_CORE_FIELD", "/z~1field"],
    ]);

    const identities = diagnosticIdentity(first.diagnostics).map(
      ([code, pointer]) => `${code}\u0000${pointer ?? ""}`,
    );
    expect(new Set(identities).size).toBe(identities.length);
  });
});
