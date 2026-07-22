import { describe, expect, it } from "vitest";

import bundleRevisionMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-revision-mismatch.json";
import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCapability from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import exampleCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  validateDesenBundleComponentContracts,
  validateDesenComponentCatalogSet,
  validateDesenSourceComponentContracts,
} from "../src/component-contract-validation.js";
import { validateDesenCatalogSet } from "../src/semantic-validation.js";

type MutableRecord = Record<string, unknown>;

interface DiagnosticLike {
  readonly code: string;
  readonly pointer?: string;
}

interface ResultLike {
  readonly valid: boolean;
  readonly diagnostics: readonly DiagnosticLike[];
  readonly obligations?: readonly { readonly kind: string; readonly pointer: string }[];
}

const BUTTON = "com.example.ui/Button";
const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const SORTABLE = "com.example.interactions/Sortable";
const INVALID_COMPONENT_CONTRACT = "run.desen.validator/INVALID_COMPONENT_CONTRACT";

function cloneFixture<Value>(fixture: Value): Value {
  return JSON.parse(JSON.stringify(fixture)) as Value;
}

function record(value: unknown, label = "fixture value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function array(value: unknown, label = "fixture value"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
  return value;
}

function valueAt(root: unknown, path: readonly (number | string)[]): unknown {
  let current = root;
  for (const segment of path) {
    current =
      typeof segment === "number"
        ? array(current, path.join("/"))[segment]
        : record(current, path.join("/"))[segment];
  }
  return current;
}

function recordAt(root: unknown, path: readonly (number | string)[]): MutableRecord {
  return record(valueAt(root, path), path.join("/"));
}

function writeAt(root: unknown, path: readonly (number | string)[], value: unknown): void {
  const parent = valueAt(root, path.slice(0, -1));
  const field = path.at(-1);
  if (typeof field === "number") array(parent)[field] = value;
  else if (field !== undefined) record(parent)[field] = value;
}

function deleteAt(root: unknown, path: readonly (number | string)[]): void {
  const parent = valueAt(root, path.slice(0, -1));
  const field = path.at(-1);
  if (typeof field !== "string") throw new TypeError("Only object fields may be deleted.");
  Reflect.deleteProperty(record(parent), field);
}

function diagnosticIdentity(
  result: ResultLike,
): readonly (readonly [string, string | undefined])[] {
  return result.diagnostics.map(({ code, pointer }) => [code, pointer] as const);
}

function expectOnlyDiagnostic(result: ResultLike, code: string, pointer: string): void {
  expect(result.valid).toBe(false);
  expect(diagnosticIdentity(result)).toEqual([[code, pointer]]);
}

function expectDiagnostic(result: ResultLike, code: string, pointer: string): void {
  expect(result.valid).toBe(false);
  expect(diagnosticIdentity(result)).toContainEqual([code, pointer]);
}

function componentCatalogSet(catalogs: readonly unknown[] = [validCatalog]) {
  const result = validateDesenComponentCatalogSet(catalogs);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected component catalog preparation to pass.");
  return result.value;
}

function validateSource(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenSourceComponentContracts(input, componentCatalogSet(catalogs));
}

function validateBundle(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenBundleComponentContracts(input, componentCatalogSet(catalogs));
}

function minimalSource(root: MutableRecord): unknown {
  const source = cloneFixture(validSource) as unknown;
  writeAt(source, ["entry"], "main");
  writeAt(source, ["surfaces"], {
    main: { id: "main", state: {}, resources: {}, root },
  });
  deleteAt(source, ["authoring"]);
  return source;
}

function node(id: string, use: string, props?: MutableRecord): MutableRecord {
  return { id, use, ...(props === undefined ? {} : { props }) };
}

function fanOutContractSchema(level: number): MutableRecord {
  const definitions: MutableRecord = { leaf: true };
  for (let index = 0; index <= level; index += 1) {
    const target = index === 0 ? "leaf" : `level${index - 1}`;
    definitions[`level${index}`] = {
      allOf: [{ $ref: `#/$defs/${target}` }, { $ref: `#/$defs/${target}` }],
    };
  }
  return { $defs: definitions, $ref: `#/$defs/level${level}` };
}

function nestedNotContractSchema(depth: number): unknown {
  let schema: unknown = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

function component(catalog: unknown, capabilityId: string): MutableRecord {
  return recordAt(catalog, ["components", capabilityId]);
}

function defaultSlot(catalog: unknown): MutableRecord {
  return recordAt(catalog, ["components", STACK, "slots", "default"]);
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

describe("M02-T08 cumulative boundary and frozen corpus", () => {
  it("accepts the frozen valid Source and Bundle with deterministic dynamic obligations", () => {
    const source = validateSource(validSource);
    const bundle = validateBundle(validBundle);

    expect(source.valid).toBe(true);
    expect(bundle.valid).toBe(true);
    expect(source.obligations).toEqual(bundle.obligations);
    expect(source.obligations.map(({ kind, pointer }) => ({ kind, pointer }))).toEqual([
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/1/props/value",
      },
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/2/props/value",
      },
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/4/props/loading",
      },
    ]);
    expectDeepFrozen(source);
    expectDeepFrozen(bundle);
  });

  it("accepts the frozen Map and Sortable examples without interpreting behavior contracts", () => {
    const catalogSet = componentCatalogSet([exampleCatalog]);
    const map = validateDesenSourceComponentContracts(exampleStoreMapSource, catalogSet);
    const sortable = validateDesenSourceComponentContracts(exampleSortableSource, catalogSet);

    expect(map.valid).toBe(true);
    expect(sortable.valid).toBe(true);
    expect(map.obligations.length).toBeGreaterThan(0);
    expect(sortable.obligations.length).toBeGreaterThan(0);
  });

  it("preserves T06 and T07 failures without running component contracts", () => {
    expectOnlyDiagnostic(validateSource(sourceUnknownCoreField), "UNKNOWN_CORE_FIELD", "/script");
    expectOnlyDiagnostic(
      validateSource(sourceDuplicateNodeId),
      "DUPLICATE_NODE_ID",
      "/surfaces/home/root/slots/default/1/id",
    );
    expectOnlyDiagnostic(
      validateSource(sourceUnknownCapability),
      "UNKNOWN_CAPABILITY",
      "/surfaces/home/root/slots/default/0/use",
    );
  });

  it("leaves official unknown events and Bundle revision integrity to later tasks", () => {
    expect(validateSource(sourceUnknownEvent).valid).toBe(true);
    expect(validateBundle(bundleRevisionMismatch).valid).toBe(true);
  });

  it("rejects a forged higher-stage catalog brand even when the T07 set is genuine", () => {
    const lowerStage = validateDesenCatalogSet([validCatalog]);
    expect(lowerStage.valid).toBe(true);
    if (!lowerStage.valid) throw new TypeError("Expected T07 catalog preparation to pass.");

    expectOnlyDiagnostic(
      validateDesenSourceComponentContracts(validSource, lowerStage.value as never),
      INVALID_COMPONENT_CONTRACT,
      "/catalogs",
    );
  });
});

describe("M02-T08 component schema preparation", () => {
  it("fails closed at the component schema pointer before deep T06 recursion", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = nestedNotContractSchema(800);

    const result = validateDesenComponentCatalogSet([catalog]);
    expectOnlyDiagnostic(
      result,
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema",
    );
    expectDeepFrozen(result);
  });

  it("contains T06 recursion failures outside the T08 component-schema fence", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    recordAt(catalog, ["behaviors", SORTABLE]).propsSchema = nestedNotContractSchema(5_000);

    const result = validateDesenComponentCatalogSet([catalog]);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(({ code }) => code === "SCHEMA_INVALID")).toBe(true);
    expectDeepFrozen(result);
  });

  it("does not execute accessors while performing the early shape check", () => {
    let accessed = false;
    const hostileCatalog: MutableRecord = {};
    Object.defineProperty(hostileCatalog, "components", {
      enumerable: true,
      get() {
        accessed = true;
        return {};
      },
    });

    expectOnlyDiagnostic(validateDesenComponentCatalogSet([hostileCatalog]), "SCHEMA_INVALID", "");
    expect(accessed).toBe(false);

    const hostileProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new TypeError("hostile proxy");
        },
      },
    );
    expectOnlyDiagnostic(validateDesenComponentCatalogSet([hostileProxy]), "SCHEMA_INVALID", "");
  });

  it("rejects unresolved local refs before any document value can be blamed", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = { $ref: "#/$defs/missing" };

    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([catalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/$ref",
    );
  });

  it("rejects duplicate cross-kind anchors at the second anchor's exact pointer", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = {
      $defs: {
        first: { $anchor: "same" },
        second: { $dynamicAnchor: "same" },
      },
    };

    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([catalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/$defs/second/$dynamicAnchor",
    );
  });

  it("rejects unsafe component and style-part patterns during catalog preparation", () => {
    const propsCatalog = cloneFixture(validCatalog) as unknown;
    component(propsCatalog, BUTTON).propsSchema = {
      type: "object",
      properties: { label: { type: "string", pattern: "^(a+)+$" } },
    };
    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([propsCatalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/properties/label/pattern",
    );

    const styleCatalog = cloneFixture(validCatalog) as unknown;
    writeAt(styleCatalog, ["components", BUTTON, "styleParts", "root", "propertiesSchema"], {
      patternProperties: { "^a+b+$": true },
    });
    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([styleCatalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/styleParts/root/propertiesSchema/patternProperties/^a+b+$",
    );

    const pathologicalCatalog = cloneFixture(validCatalog) as unknown;
    component(pathologicalCatalog, BUTTON).propsSchema = {
      pattern: "^.*a{1024}a{1024}a{1024}$",
    };
    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([pathologicalCatalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/pattern",
    );

    const boundedCatalog = cloneFixture(validCatalog) as unknown;
    component(boundedCatalog, BUTTON).propsSchema = {
      patternProperties: { abcdefghijklmnop: true },
    };
    expect(validateDesenComponentCatalogSet([boundedCatalog]).valid).toBe(true);
    component(boundedCatalog, BUTTON).propsSchema = {
      patternProperties: { abcdefghijklmnopq: true },
    };
    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([boundedCatalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/patternProperties/abcdefghijklmnopq",
    );
  });

  it("rejects duplicate canonical resource ids at the second id", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = {
      $id: "https://example.com/schemas/root.json",
      $defs: {
        first: { $id: "parts/../shared" },
        second: { $id: "./shared#" },
      },
    };

    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([catalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema/$defs/second/$id",
    );
  });

  it("rejects schema ref/combinator fan-out above the deterministic evaluation budget", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = fanOutContractSchema(13);

    expectOnlyDiagnostic(
      validateDesenComponentCatalogSet([catalog]),
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Button/propsSchema",
    );
  });
});

describe("M02-T08 component props and variant patches", () => {
  it("rejects unknown, mismatched, missing, and nested-invalid literal props", () => {
    const unknown = minimalSource(node("button", BUTTON, { label: "Go", ghost: true }));
    expectOnlyDiagnostic(
      validateSource(unknown),
      "UNKNOWN_PROP",
      "/surfaces/main/root/props/ghost",
    );

    const mismatch = minimalSource(node("button", BUTTON, { label: "Go", variant: "ghost" }));
    expectOnlyDiagnostic(
      validateSource(mismatch),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/props/variant",
    );

    const missing = minimalSource(node("button", BUTTON, {}));
    expectOnlyDiagnostic(
      validateSource(missing),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/props/label",
    );

    const nested = minimalSource(
      node("map", "com.example.maps/Map", {
        center: { latitude: 91, longitude: 28 },
        zoom: 11,
        mapStyle: "light",
      }),
    );
    expectOnlyDiagnostic(
      validateSource(nested),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/props/center/latitude",
    );
  });

  it("applies local refs and complete-object cross-property constraints without mutation", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const button = component(catalog, BUTTON);
    button.propsSchema = {
      $defs: { label: { type: "string", minLength: 2 } },
      type: "object",
      additionalProperties: false,
      required: ["label"],
      dependentRequired: { label: ["enabled"] },
      properties: {
        label: { $ref: "#/$defs/label" },
        enabled: { type: "boolean", default: true },
      },
    };
    const source = minimalSource(node("button", BUTTON, { label: "x" }));
    const before = JSON.stringify(source);
    const result = validateSource(source, [catalog]);

    expectDiagnostic(result, "PROP_TYPE_MISMATCH", "/surfaces/main/root/props/label");
    expectDiagnostic(result, "PROP_TYPE_MISMATCH", "/surfaces/main/root/props/enabled");
    expect(JSON.stringify(source)).toBe(before);
    expect(recordAt(source, ["surfaces", "main", "root", "props"]).enabled).toBeUndefined();
  });

  it("records dynamic values while retaining independently provable sibling failures", () => {
    const source = minimalSource(
      node("button", BUTTON, {
        label: "Go",
        loading: { $ref: "state.loading", fallback: false },
        variant: "ghost",
      }),
    );
    const result = validateSource(source);

    expectOnlyDiagnostic(result, "PROP_TYPE_MISMATCH", "/surfaces/main/root/props/variant");
    expect(result.obligations).toMatchObject([
      { kind: "component-prop", pointer: "/surfaces/main/root/props/loading" },
    ]);
  });

  it("treats variant props as patches while checking supplied unknown and literal values", () => {
    const passing = minimalSource(node("button", BUTTON, { label: "Go" }));
    writeAt(
      passing,
      ["surfaces", "main", "root", "variants"],
      [{ when: { op: "truthy", args: [true] }, props: { loading: true } }],
    );
    expect(validateSource(passing).valid).toBe(true);

    const unknown = cloneFixture(passing);
    writeAt(unknown, ["surfaces", "main", "root", "variants", 0, "props"], { ghost: true });
    expectOnlyDiagnostic(
      validateSource(unknown),
      "UNKNOWN_PROP",
      "/surfaces/main/root/variants/0/props/ghost",
    );

    const mismatch = cloneFixture(passing);
    writeAt(mismatch, ["surfaces", "main", "root", "variants", 0, "props"], {
      loading: "yes",
    });
    expectOnlyDiagnostic(
      validateSource(mismatch),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/variants/0/props/loading",
    );
  });

  it("keeps unseen base props unknown inside variant unevaluatedProperties applicators", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = {
      type: "object",
      required: ["label", "variant"],
      properties: {
        label: { type: "string" },
        variant: { type: "string" },
      },
      not: {
        properties: { label: true },
        unevaluatedProperties: false,
      },
    };
    const source = minimalSource(node("button", BUTTON, { label: "Base", variant: "primary" }));
    writeAt(
      source,
      ["surfaces", "main", "root", "variants"],
      [{ when: { op: "truthy", args: [true] }, props: { label: "Changed" } }],
    );

    expect(validateSource(source, [catalog]).valid).toBe(true);
  });

  it("RFC 6901-escapes hostile but structurally legal prop names", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    component(catalog, BUTTON).propsSchema = {
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: { label: { type: "string" }, "a/b~c": { type: "number" } },
    };
    const source = minimalSource(node("button", BUTTON, { label: "Go", "a/b~c": "wrong" }));
    expectOnlyDiagnostic(
      validateSource(source, [catalog]),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/props/a~1b~0c",
    );
  });
});

describe("M02-T08 component slot contracts", () => {
  it("rejects undeclared slots, including empty slots and children on protocol leaves", () => {
    const emptyUnknown = minimalSource(node("stack", STACK, { direction: "vertical" }));
    writeAt(emptyUnknown, ["surfaces", "main", "root", "slots"], { ghost: [] });
    expectOnlyDiagnostic(
      validateSource(emptyUnknown),
      "UNKNOWN_SLOT",
      "/surfaces/main/root/slots/ghost",
    );

    const leaf = minimalSource(node("button", BUTTON, { label: "Go" }));
    writeAt(leaf, ["surfaces", "main", "root", "slots"], {
      default: [node("text", TEXT, { text: "Child" })],
    });
    expectOnlyDiagnostic(validateSource(leaf), "UNKNOWN_SLOT", "/surfaces/main/root/slots/default");
  });

  it("enforces required presence and the documented effective minimum", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = defaultSlot(catalog);
    slot.required = true;
    delete slot.minItems;

    const missing = minimalSource(node("stack", STACK, { direction: "vertical" }));
    expectOnlyDiagnostic(
      validateSource(missing, [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/slots/default",
    );

    const empty = cloneFixture(missing);
    writeAt(empty, ["surfaces", "main", "root", "slots"], { default: [] });
    expectOnlyDiagnostic(
      validateSource(empty, [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/slots/default",
    );

    slot.minItems = 0;
    expect(validateSource(empty, [catalog]).valid).toBe(true);
  });

  it("applies minimum and maximum only when an optional slot is present", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = defaultSlot(catalog);
    slot.required = false;
    slot.minItems = 2;
    slot.maxItems = 3;

    const omitted = minimalSource(node("stack", STACK, { direction: "vertical" }));
    expect(validateSource(omitted, [catalog]).valid).toBe(true);

    const one = cloneFixture(omitted);
    writeAt(one, ["surfaces", "main", "root", "slots"], {
      default: [node("text", TEXT, { text: "One" })],
    });
    expectOnlyDiagnostic(
      validateSource(one, [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/slots/default",
    );

    const four = cloneFixture(one);
    writeAt(
      four,
      ["surfaces", "main", "root", "slots", "default"],
      [
        node("text1", TEXT, { text: "1" }),
        node("text2", TEXT, { text: "2" }),
        node("text3", TEXT, { text: "3" }),
        node("text4", TEXT, { text: "4" }),
      ],
    );
    expectOnlyDiagnostic(
      validateSource(four, [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/slots/default",
    );
  });

  it("combines accepted IDs and categories with exact logical OR", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = defaultSlot(catalog);
    slot.accepts = [TEXT];
    slot.acceptsCategories = ["action"];
    const source = minimalSource(node("stack", STACK, { direction: "vertical" }));
    writeAt(source, ["surfaces", "main", "root", "slots"], {
      default: [
        node("text", TEXT, { text: "Accepted by id" }),
        node("button", BUTTON, { label: "Accepted by category" }),
      ],
    });
    expect(validateSource(source, [catalog]).valid).toBe(true);

    const rejected = cloneFixture(source);
    writeAt(
      rejected,
      ["surfaces", "main", "root", "slots", "default"],
      [node("field", "com.example.ui/TextField", { label: "Field", value: "" })],
    );
    expectOnlyDiagnostic(
      validateSource(rejected, [catalog]),
      "SLOT_CHILD_REJECTED",
      "/surfaces/main/root/slots/default/0/use",
    );
  });

  it("distinguishes absent acceptance fields from a present empty reject-all union", () => {
    const unrestrictedCatalog = cloneFixture(validCatalog) as unknown;
    const unrestrictedSlot = defaultSlot(unrestrictedCatalog);
    delete unrestrictedSlot.accepts;
    delete unrestrictedSlot.acceptsCategories;
    const source = minimalSource(node("stack", STACK, { direction: "vertical" }));
    writeAt(source, ["surfaces", "main", "root", "slots"], {
      default: [node("button", BUTTON, { label: "Go" })],
    });
    expect(validateSource(source, [unrestrictedCatalog]).valid).toBe(true);

    const rejectAllCatalog = cloneFixture(unrestrictedCatalog);
    defaultSlot(rejectAllCatalog).accepts = [];
    expectOnlyDiagnostic(
      validateSource(source, [rejectAllCatalog]),
      "SLOT_CHILD_REJECTED",
      "/surfaces/main/root/slots/default/0/use",
    );
  });

  it("rejects a category-only child with no category and avoids cascades for unknown children", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    defaultSlot(catalog).acceptsCategories = ["content"];
    delete defaultSlot(catalog).accepts;
    delete component(catalog, TEXT).category;
    const source = minimalSource(node("stack", STACK, { direction: "vertical" }));
    writeAt(source, ["surfaces", "main", "root", "slots"], {
      default: [node("text", TEXT, { text: "No category" })],
    });
    expectOnlyDiagnostic(
      validateSource(source, [catalog]),
      "SLOT_CHILD_REJECTED",
      "/surfaces/main/root/slots/default/0/use",
    );

    expectOnlyDiagnostic(
      validateSource(sourceUnknownCapability),
      "UNKNOWN_CAPABILITY",
      "/surfaces/home/root/slots/default/0/use",
    );
  });

  it("rejects impossible catalog slot ranges before document validation", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = defaultSlot(catalog);
    slot.required = true;
    delete slot.minItems;
    slot.maxItems = 0;

    const result = validateDesenComponentCatalogSet([catalog]);
    expectOnlyDiagnostic(
      result,
      INVALID_COMPONENT_CONTRACT,
      "/0/components/com.example.ui~1Stack/slots/default",
    );
  });
});

describe("M02-T08 visual-state and style-part contracts", () => {
  it("accepts base and declared states but rejects unknown states and parts", () => {
    const passing = minimalSource(node("button", BUTTON, { label: "Go" }));
    writeAt(passing, ["surfaces", "main", "root", "style"], {
      base: { root: {} },
      hover: { label: {} },
    });
    expect(validateSource(passing).valid).toBe(true);

    const unknownState = cloneFixture(passing);
    writeAt(unknownState, ["surfaces", "main", "root", "style"], {
      ghost: { root: {} },
    });
    expectOnlyDiagnostic(
      validateSource(unknownState),
      "UNKNOWN_PROP",
      "/surfaces/main/root/style/ghost",
    );

    const unknownPart = cloneFixture(passing);
    writeAt(unknownPart, ["surfaces", "main", "root", "style"], {
      base: { ghost: {} },
    });
    expectOnlyDiagnostic(
      validateSource(unknownPart),
      "UNKNOWN_PROP",
      "/surfaces/main/root/style/base/ghost",
    );
  });

  it("applies style property schemas and records dynamic tokens without guessing", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    writeAt(catalog, ["components", BUTTON, "styleParts", "root", "propertiesSchema"], {
      type: "object",
      additionalProperties: false,
      properties: { color: { type: "string" } },
    });

    const unknown = minimalSource(node("button", BUTTON, { label: "Go" }));
    writeAt(unknown, ["surfaces", "main", "root", "style"], {
      base: { root: { ghost: true } },
    });
    expectOnlyDiagnostic(
      validateSource(unknown, [catalog]),
      "UNKNOWN_PROP",
      "/surfaces/main/root/style/base/root/ghost",
    );

    const mismatch = cloneFixture(unknown);
    writeAt(mismatch, ["surfaces", "main", "root", "style"], {
      base: { root: { color: 42 } },
    });
    expectOnlyDiagnostic(
      validateSource(mismatch, [catalog]),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/style/base/root/color",
    );

    const dynamic = cloneFixture(mismatch);
    writeAt(dynamic, ["surfaces", "main", "root", "style"], {
      base: { root: { color: { $token: "color.action" } } },
    });
    const dynamicResult = validateSource(dynamic, [catalog]);
    expect(dynamicResult.valid).toBe(true);
    expect(dynamicResult.obligations).toMatchObject([
      {
        kind: "style-part-property",
        pointer: "/surfaces/main/root/style/base/root/color",
      },
    ]);
  });

  it("validates variant style as a patch and does not require whole style-part objects", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    writeAt(catalog, ["components", BUTTON, "styleParts", "root", "propertiesSchema"], {
      type: "object",
      additionalProperties: false,
      required: ["color", "padding"],
      properties: { color: { type: "string" }, padding: { type: "number" } },
    });
    const source = minimalSource(node("button", BUTTON, { label: "Go" }));
    writeAt(source, ["surfaces", "main", "root", "style"], {
      base: { root: { color: "red", padding: 4 } },
    });
    writeAt(
      source,
      ["surfaces", "main", "root", "variants"],
      [
        {
          when: { op: "truthy", args: [true] },
          style: { hover: { root: { color: "blue" } } },
        },
      ],
    );
    expect(validateSource(source, [catalog]).valid).toBe(true);

    writeAt(source, ["surfaces", "main", "root", "variants", 0, "style"], {
      hover: { root: { color: 42 } },
    });
    expectOnlyDiagnostic(
      validateSource(source, [catalog]),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/variants/0/style/hover/root/color",
    );
  });

  it("leaves behavior prop, slot, and style contracts to T09 while validating child components", () => {
    const root = node("button", BUTTON, { label: "Go" });
    root.behaviors = [
      {
        id: "sortable",
        use: SORTABLE,
        props: { axis: 42 },
        style: { ghost: { privatePart: { hidden: true } } },
        slots: { preview: [node("preview", TEXT, { text: "Preview" })] },
      },
    ];
    expect(validateSource(minimalSource(root)).valid).toBe(true);

    writeAt(root, ["behaviors", 0, "slots", "preview", 0, "props", "text"], 42);
    expectOnlyDiagnostic(
      validateSource(minimalSource(root)),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/behaviors/0/slots/preview/0/props/text",
    );
  });
});

describe("M02-T08 determinism and iterative traversal", () => {
  it("returns the same sorted diagnostics for reversed object insertion order", () => {
    const first = minimalSource(
      node("button", BUTTON, { label: 42, ghost: true, variant: "ghost" }),
    );
    const second = minimalSource(
      node("button", BUTTON, { variant: "ghost", ghost: true, label: 42 }),
    );
    expect(validateSource(first).diagnostics).toEqual(validateSource(second).diagnostics);
  });

  it("walks a deep component slot tree without recursive contract traversal", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = defaultSlot(catalog);
    delete slot.accepts;
    delete slot.acceptsCategories;
    let current = node("leaf", TEXT, { text: "Leaf" });
    for (let index = 119; index >= 0; index -= 1) {
      const parent = node(`stack${index}`, STACK, { direction: "vertical" });
      parent.slots = { default: [current] };
      current = parent;
    }
    expect(validateSource(minimalSource(current), [catalog]).valid).toBe(true);
  });
});
