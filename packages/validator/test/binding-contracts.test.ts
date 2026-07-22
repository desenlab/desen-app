import { describe, expect, it } from "vitest";

import bundleRevisionMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-revision-mismatch.json";
import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import exampleSignInBundle from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json";
import exampleSignInSource from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  INVALID_BINDING_CONTRACT_CODE,
  validateDesenBindingContracts,
  validateDesenBundleBindingContracts,
  validateDesenSourceBindingContracts,
} from "../src/binding-contract-validation.js";
import { validateDesenComponentCatalogSet } from "../src/component-contract-validation.js";
import {
  validateDesenInteractionCatalogSet,
  validateDesenInteractionContracts,
  validateDesenSourceInteractionContracts,
} from "../src/interaction-contract-validation.js";

type MutableRecord = Record<string, unknown>;

interface DiagnosticLike {
  readonly code: string;
  readonly pointer?: string;
}

interface ObligationLike {
  readonly kind: string;
  readonly pointer: string;
}

interface ResultLike {
  readonly valid: boolean;
  readonly target: string;
  readonly diagnostics: readonly DiagnosticLike[];
  readonly obligations: readonly ObligationLike[];
  readonly value?: unknown;
}

const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const SORTABLE = "com.example.interactions/Sortable";
const SIGN_IN = "com.example.auth/signIn";
const INVALID_BINDING_CONTRACT = "run.desen.validator/INVALID_BINDING_CONTRACT";

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

function node(id: string, use: string, props?: MutableRecord): MutableRecord {
  return { id, use, ...(props === undefined ? {} : { props }) };
}

function textNode(id: string, text: unknown = "Text"): MutableRecord {
  return node(id, TEXT, { text });
}

function stackNode(id: string): MutableRecord {
  return node(id, STACK, { direction: "vertical" });
}

function buttonWithActions(actions: readonly MutableRecord[]): MutableRecord {
  const button = node("action", BUTTON, { label: "Run" });
  button.on = { press: [...actions] };
  return button;
}

function textFieldWithActions(actions: readonly MutableRecord[]): MutableRecord {
  const field = node("field", TEXT_FIELD, { label: "Field", value: "" });
  field.on = { change: [...actions] };
  return field;
}

function minimalSource(
  root: MutableRecord,
  state: MutableRecord = {},
  resources: MutableRecord = {},
): unknown {
  const source = cloneFixture(validSource) as unknown;
  writeAt(source, ["entry"], "main");
  writeAt(source, ["surfaces"], {
    main: { id: "main", state, resources, root },
  });
  deleteAt(source, ["authoring"]);
  return source;
}

function stateEntry(schema: MutableRecord, initial: unknown): MutableRecord {
  return { schema, initial };
}

function interactionCatalogSet() {
  const result = validateDesenInteractionCatalogSet([validCatalog]);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected interaction catalog preparation to pass.");
  return result.value;
}

function validateSource(input: unknown) {
  return validateDesenSourceBindingContracts(input, interactionCatalogSet());
}

function validateBundle(input: unknown) {
  return validateDesenBundleBindingContracts(input, interactionCatalogSet());
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

function reverseObjectMemberOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => reverseObjectMemberOrder(entry));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reverseObjectMemberOrder(child)]),
  );
}

function predicateSource(predicate: MutableRecord, state: MutableRecord = {}): unknown {
  const text = textNode("predicate");
  text.when = predicate;
  return minimalSource(text, state);
}

function repeatedText(
  id: string,
  items: unknown,
  alias: string,
  key: unknown,
  text: unknown = "Text",
): MutableRecord {
  const repeated = textNode(id, text);
  repeated.repeat = { items, as: alias, key };
  return repeated;
}

describe("M02-T10 cumulative boundary", () => {
  it("accepts the frozen valid Source, Bundle, and every Source/Bundle example", () => {
    for (const source of [
      validSource,
      exampleSignInSource,
      exampleSortableSource,
      exampleStoreMapSource,
    ]) {
      const result = validateSource(source);
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    }
    for (const bundle of [validBundle, exampleSignInBundle]) {
      const result = validateBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    }
  });

  it("carries T06, T07, T08, and T09 failures forward byte-for-byte", () => {
    const t08Failure = cloneFixture(validSource) as unknown;
    recordAt(t08Failure, ["surfaces", "sign-in", "root", "props"]).unknown = true;
    const catalogs = interactionCatalogSet();

    for (const input of [
      sourceUnknownCoreField,
      sourceDuplicateNodeId,
      t08Failure,
      sourceUnknownEvent,
    ]) {
      expect(validateDesenSourceBindingContracts(input, catalogs)).toEqual(
        validateDesenSourceInteractionContracts(input, catalogs),
      );
    }

    expect(validateDesenBundleBindingContracts(bundleRevisionMismatch, catalogs)).toEqual(
      validateDesenInteractionContracts("bundle", bundleRevisionMismatch, catalogs),
    );
  });

  it("preserves all four T09 obligation kinds on a T10 failure", () => {
    const root = stackNode("layout");
    root.props = { direction: { $token: "layout.direction" } };
    root.style = {
      base: { root: { padding: { $token: "space.default" } } },
    };
    root.behaviors = [
      {
        id: "sort",
        use: SORTABLE,
        props: { axis: { $token: "sort.axis" } },
        style: {
          base: { dropIndicator: { opacity: { $token: "opacity.drag" } } },
        },
      },
    ];
    root.when = { op: "exists", args: [true] };
    const source = minimalSource(root);
    const catalogs = interactionCatalogSet();
    const interaction = validateDesenSourceInteractionContracts(source, catalogs);
    const binding = validateDesenSourceBindingContracts(source, catalogs);

    expect(interaction.valid).toBe(true);
    expect(binding.valid).toBe(false);
    expect(binding.obligations).toEqual(interaction.obligations);
    expect(binding.obligations.map(({ kind }) => kind)).toEqual([
      "behavior-prop",
      "behavior-style-part-property",
      "component-prop",
      "style-part-property",
    ]);
    expectOnlyDiagnostic(binding, "PREDICATE_TYPE_MISMATCH", "/surfaces/main/root/when/args/0");
  });

  it("rejects a lower-stage catalog set passed through a forged T09 brand", () => {
    const lowerStage = validateDesenComponentCatalogSet([validCatalog]);
    expect(lowerStage.valid).toBe(true);
    if (!lowerStage.valid) throw new TypeError("Expected T08 catalog preparation to pass.");

    expectOnlyDiagnostic(
      validateDesenSourceBindingContracts(validSource, lowerStage.value as never),
      "run.desen.validator/INVALID_INTERACTION_CONTRACT",
      "/catalogs",
    );
  });

  it("ignores prototype-inherited optional node fields", () => {
    const previousRepeat = Object.getOwnPropertyDescriptor(Object.prototype, "repeat");
    Object.defineProperty(Object.prototype, "repeat", {
      configurable: true,
      enumerable: true,
      value: { items: "not-an-array", as: "inherited", key: "inherited" },
      writable: true,
    });

    try {
      expect(validateSource(minimalSource(textNode("text"))).valid).toBe(true);
    } finally {
      if (previousRepeat === undefined) Reflect.deleteProperty(Object.prototype, "repeat");
      else Object.defineProperty(Object.prototype, "repeat", previousRepeat);
    }
  });
});

describe("M02-T10 state contracts and state references", () => {
  it("validates state initials in resolved-value mode, including null and ordinary $ref data", () => {
    const state = {
      bindingLookingData: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          required: ["$ref"],
          properties: { $ref: { type: "string" } },
        },
        { $ref: "state.not-a-binding" },
      ),
      nullable: stateEntry({ type: ["string", "null"] }, null),
    };

    expect(validateSource(minimalSource(textNode("text"), state)).valid).toBe(true);
  });

  it("reports an initial value at the exact state-relative pointer", () => {
    const source = minimalSource(textNode("text"), {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: { name: { type: "string" } },
        },
        { name: 42 },
      ),
    });

    expectOnlyDiagnostic(
      validateSource(source),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/state/profile/initial/name",
    );
  });

  it("applies the bounded schema graph profile to state declarations", () => {
    const source = minimalSource(textNode("text"), {
      unsafe: stateEntry({ type: "string", pattern: "^(a+)+$" }, "a"),
    });

    expectOnlyDiagnostic(
      validateSource(source),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/state/unsafe/schema/pattern",
    );
  });

  it("keeps state references surface-local", () => {
    const source = cloneFixture(validSource) as unknown;
    writeAt(source, ["entry"], "alpha");
    writeAt(source, ["surfaces"], {
      alpha: {
        id: "alpha",
        state: {},
        resources: {},
        root: textNode("alpha.text", { $ref: "state.shared" }),
      },
      beta: {
        id: "beta",
        state: { shared: stateEntry({ type: "string" }, "beta") },
        resources: {},
        root: textNode("beta.text"),
      },
    });
    deleteAt(source, ["authoring"]);

    expectOnlyDiagnostic(
      validateSource(source),
      "REFERENCE_UNRESOLVED",
      "/surfaces/alpha/root/props/text/$ref",
    );
  });

  it("rejects a definitely impossible nested state path but permits a usable fallback", () => {
    const state = {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: { name: { type: "string" } },
        },
        { name: "Ada" },
      ),
    };
    const withoutFallback = minimalSource(
      textNode("text", { $ref: "state.profile.missing" }),
      state,
    );
    const withFallback = minimalSource(
      textNode("text", { $ref: "state.profile.missing", fallback: "Unknown" }),
      state,
    );

    expectOnlyDiagnostic(
      validateSource(withoutFallback),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/props/text/$ref",
    );
    expect(validateSource(withFallback).valid).toBe(true);
  });

  it("treats a declared null state value as present rather than unresolved", () => {
    const source = minimalSource(textNode("text", { $ref: "state.selection" }), {
      selection: stateEntry({ type: "null" }, null),
    });
    expect(validateSource(source).valid).toBe(true);
  });

  it("does not let fallback rescue an undeclared lexical state name", () => {
    const source = minimalSource(textNode("text", { $ref: "state.ghost", fallback: "fallback" }));
    expectOnlyDiagnostic(
      validateSource(source),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/props/text/$ref",
    );
  });
});

describe("M02-T10 event reference scopes", () => {
  it("resolves component event fields in the immediate handler turn", () => {
    const source = minimalSource(
      textFieldWithActions([{ type: "state.set", path: "value", value: { $ref: "event.value" } }]),
      { value: stateEntry({ type: "string" }, "") },
    );
    expect(validateSource(source).valid).toBe(true);
  });

  it("resolves behavior event fields in the immediate handler turn", () => {
    const root = stackNode("layout");
    root.behaviors = [
      {
        id: "sort",
        use: SORTABLE,
        on: {
          reorder: [
            {
              type: "event.emit",
              name: "sorted",
              payload: {
                itemKey: { $ref: "event.itemKey" },
                from: { $ref: "event.fromIndex" },
                to: { $ref: "event.toIndex" },
              },
            },
          ],
        },
      },
    ];
    expect(validateSource(minimalSource(root)).valid).toBe(true);
  });

  it("rejects event references outside a declared handler", () => {
    expectOnlyDiagnostic(
      validateSource(minimalSource(textNode("text", { $ref: "event.value" }))),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/props/text/$ref",
    );
  });

  it("clears event scope before operation settlement actions", () => {
    const source = minimalSource(
      textFieldWithActions([
        {
          type: "operation.invoke",
          operation: SIGN_IN,
          as: "signIn",
          input: {},
          onSuccess: [{ type: "state.set", path: "value", value: { $ref: "event.value" } }],
        },
      ]),
      { value: stateEntry({ type: "string" }, "") },
    );

    expectOnlyDiagnostic(
      validateSource(source),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/change/0/onSuccess/0/value/$ref",
    );
  });
});

describe("M02-T10 format bindings", () => {
  it("accepts exact placeholder/value equality and repeated placeholders", () => {
    const source = minimalSource(
      textNode("text", {
        $format: {
          template: "{name} — {name}",
          values: { name: { $ref: "state.name" } },
        },
      }),
      { name: stateEntry({ type: "string" }, "Ada") },
    );
    expect(validateSource(source).valid).toBe(true);
  });

  it("reports a missing placeholder value at the template", () => {
    const source = minimalSource(
      textNode("text", { $format: { template: "Hello {name}", values: {} } }),
    );
    expectOnlyDiagnostic(
      validateSource(source),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/root/props/text/$format/template",
    );
  });

  it("reports an extra value at its escaped value key", () => {
    const source = minimalSource(
      textNode("text", { $format: { template: "Hello", values: { name: "Ada" } } }),
    );
    expectOnlyDiagnostic(
      validateSource(source),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/root/props/text/$format/values/name",
    );
  });

  it("rejects malformed opening and closing braces without regex evaluation", () => {
    for (const template of ["Hello {name", "Hello name}", "Hello {{name}"]) {
      const source = minimalSource(
        textNode("text", { $format: { template, values: { name: "Ada" } } }),
      );
      expectDiagnostic(
        validateSource(source),
        INVALID_BINDING_CONTRACT,
        "/surfaces/main/root/props/text/$format/template",
      );
    }
  });
});

describe("M02-T10 predicate typing", () => {
  it("requires exists to receive a direct reference", () => {
    expectOnlyDiagnostic(
      validateSource(predicateSource({ op: "exists", args: ["literal"] })),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
    expect(
      validateSource(predicateSource({ op: "exists", args: [{ $ref: "context.optional" }] })).valid,
    ).toBe(true);
  });

  it("accepts same-category ordered operands and rejects a definite category mismatch", () => {
    expect(validateSource(predicateSource({ op: "gt", args: [2, 1] })).valid).toBe(true);
    expect(validateSource(predicateSource({ op: "lte", args: ["a", "z"] })).valid).toBe(true);
    expectOnlyDiagnostic(
      validateSource(predicateSource({ op: "gt", args: [1, "2"] })),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/1",
    );
  });

  it("rejects definitely unordered state types while accepting unknown host types", () => {
    const booleanState = { flag: stateEntry({ type: "boolean" }, false) };
    expectOnlyDiagnostic(
      validateSource(
        predicateSource({ op: "gte", args: [{ $ref: "state.flag" }, 1] }, booleanState),
      ),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
    expect(
      validateSource(predicateSource({ op: "gte", args: [{ $ref: "context.rank" }, 1] })).valid,
    ).toBe(true);
  });

  it("does not let an ordered reference fallback hide a resolved null primary", () => {
    const state = { selection: stateEntry({ type: "null" }, null) };
    expectOnlyDiagnostic(
      validateSource(
        predicateSource({ op: "gt", args: [{ $ref: "state.selection", fallback: 0 }, 1] }, state),
      ),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });

  it("checks invalid fallbacks independently from typed and unknown primaries", () => {
    const state = {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          properties: { rank: { type: "number" } },
        },
        {},
      ),
    };

    expectOnlyDiagnostic(
      validateSource(
        predicateSource(
          { op: "gt", args: [{ $ref: "state.profile.rank", fallback: false }, 1] },
          state,
        ),
      ),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
    expectOnlyDiagnostic(
      validateSource(
        predicateSource({ op: "gt", args: [{ $ref: "context.rank", fallback: false }, 1] }),
      ),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });

  it("preserves fallback alternatives through direct item fields for predicate typing", () => {
    const repeated = repeatedText(
      "row",
      [{ rank: { $ref: "context.rank", fallback: false } }],
      "row",
      "stable",
    );
    repeated.when = { op: "gt", args: [{ $ref: "item.row.rank" }, 1] };

    expectOnlyDiagnostic(
      validateSource(minimalSource(repeated)),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });

  it("keeps predicate-shaped fallback objects as ordinary ValueSpec data", () => {
    expectOnlyDiagnostic(
      validateSource(
        predicateSource({
          op: "all",
          args: [{ $ref: "context.guard", fallback: { op: "eq", args: [1, 1] } }],
        }),
      ),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });

  it("treats definitely missing predicate references as false without weakening lexical scope", () => {
    const state = {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          properties: { name: { type: "string" } },
        },
        { name: "Ada" },
      ),
    };

    for (const predicate of [
      { op: "truthy", args: [{ $ref: "state.profile.missing" }] },
      { op: "exists", args: [{ $ref: "state.profile.missing" }] },
    ]) {
      expect(validateSource(predicateSource(predicate, state)).valid).toBe(true);
    }

    for (const reference of ["state.ghost", "item.row.id"]) {
      expectOnlyDiagnostic(
        validateSource(predicateSource({ op: "exists", args: [{ $ref: reference }] }, state)),
        "REFERENCE_UNRESOLVED",
        "/surfaces/main/root/when/args/0/$ref",
      );
    }
  });

  it("checks in and contains only when collection types are statically definite", () => {
    for (const predicate of [
      { op: "in", args: ["a", ["a", "b"]] },
      { op: "in", args: ["a", "alphabet"] },
      { op: "contains", args: [[1, 2], 2] },
      { op: "contains", args: ["alphabet", "a"] },
      { op: "contains", args: [{ $ref: "resource.items.value" }, { any: "value" }] },
    ]) {
      expect(validateSource(predicateSource(predicate)).valid).toBe(true);
    }

    expectOnlyDiagnostic(
      validateSource(predicateSource({ op: "in", args: ["a", { value: "a" }] })),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/1",
    );
    expectOnlyDiagnostic(
      validateSource(predicateSource({ op: "contains", args: ["alphabet", 1] })),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/1",
    );
    expectOnlyDiagnostic(
      validateSource(predicateSource({ op: "in", args: [1, "alphabet"] })),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });
});

describe("M02-T10 repeat and alias contracts", () => {
  it("accepts literal array items, scalar unique keys, and alias references in the node body", () => {
    const repeated = repeatedText(
      "row",
      [
        { id: "a", title: "Alpha" },
        { id: "b", title: "Beta" },
      ],
      "row",
      { $ref: "item.row.id" },
      { $ref: "item.row.title" },
    );
    expect(validateSource(minimalSource(repeated)).valid).toBe(true);
  });

  it("rejects statically non-array repeat items", () => {
    const repeated = repeatedText("row", "not-an-array", "row", "static");
    expectOnlyDiagnostic(
      validateSource(minimalSource(repeated)),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/main/root/repeat/items",
    );
  });

  it("does not let a repeat fallback hide a resolved null or an invalid fallback", () => {
    const nullPrimary = repeatedText(
      "null-primary",
      { $ref: "state.selection", fallback: [] },
      "row",
      { $ref: "item.row.id" },
    );
    expectOnlyDiagnostic(
      validateSource(
        minimalSource(nullPrimary, {
          selection: stateEntry({ type: "null" }, null),
        }),
      ),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/main/root/repeat/items",
    );

    const unknownPrimary = repeatedText(
      "unknown-primary",
      { $ref: "resource.items.value", fallback: "not-an-array" },
      "row",
      { $ref: "item.row.id" },
    );
    expectOnlyDiagnostic(
      validateSource(minimalSource(unknownPrimary)),
      "REPEAT_ITEMS_INVALID",
      "/surfaces/main/root/repeat/items",
    );
  });

  it("reports direct-array limit overflow even when members are dynamic", () => {
    const repeated = repeatedText(
      "row",
      [{ $ref: "context.first" }, { $ref: "context.second" }],
      "row",
      { $ref: "item.row.id" },
    );
    record(repeated.repeat).limit = 1;
    expectOnlyDiagnostic(
      validateSource(minimalSource(repeated)),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/root/repeat/limit",
    );
  });

  it("accepts an empty literal repeat without treating its lexical alias as unresolved", () => {
    const repeated = repeatedText("row", [], "row", { $ref: "item.row.id" });
    expect(validateSource(minimalSource(repeated)).valid).toBe(true);
  });

  it("rejects non-scalar and duplicate static repeat keys", () => {
    const nonScalar = repeatedText("row", [{ id: "a" }], "row", { invalid: true });
    expectOnlyDiagnostic(
      validateSource(minimalSource(nonScalar)),
      "REPEAT_KEY_INVALID",
      "/surfaces/main/root/repeat/key",
    );

    const duplicate = repeatedText("row", [{ id: "same" }, { id: "same" }], "row", {
      $ref: "item.row.id",
    });
    expectOnlyDiagnostic(
      validateSource(minimalSource(duplicate)),
      "REPEAT_KEY_INVALID",
      "/surfaces/main/root/repeat/key",
    );
  });

  it("detects duplicate keys despite unrelated dynamic item fields", () => {
    const duplicate = repeatedText(
      "row",
      [
        { id: "same", title: { $ref: "context.firstTitle" } },
        { id: "same", title: { $ref: "context.secondTitle" } },
      ],
      "row",
      { $ref: "item.row.id" },
      { $ref: "item.row.title" },
    );
    expectOnlyDiagnostic(
      validateSource(minimalSource(duplicate)),
      "REPEAT_KEY_INVALID",
      "/surfaces/main/root/repeat/key",
    );
  });

  it("preserves fallback alternatives through direct item fields for repeat keys", () => {
    const repeated = repeatedText(
      "row",
      [{ id: { $ref: "context.id", fallback: { invalid: true } } }],
      "row",
      { $ref: "item.row.id" },
    );

    expectOnlyDiagnostic(
      validateSource(minimalSource(repeated)),
      "REPEAT_KEY_INVALID",
      "/surfaces/main/root/repeat/key",
    );
  });

  it("defers a dynamic repeat key instead of selecting its outer fallback statically", () => {
    const repeated = repeatedText(
      "row",
      [{ id: { $ref: "context.firstKey" } }, { id: { $ref: "context.secondKey" } }],
      "row",
      { $ref: "item.row.id", fallback: "fallback" },
    );

    expect(validateSource(minimalSource(repeated)).valid).toBe(true);
  });

  it("requires every direct item template to satisfy an unfallbacked body reference", () => {
    const items = [{ id: "a" }, { id: "b", title: "Beta" }];
    const withoutFallback = repeatedText(
      "without-fallback",
      items,
      "row",
      { $ref: "item.row.id" },
      { $ref: "item.row.title" },
    );
    const withFallback = repeatedText(
      "with-fallback",
      items,
      "row",
      { $ref: "item.row.id" },
      { $ref: "item.row.title", fallback: "Untitled" },
    );

    expectOnlyDiagnostic(
      validateSource(minimalSource(withoutFallback)),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/props/text/$ref",
    );
    expect(validateSource(minimalSource(withFallback)).valid).toBe(true);
  });

  it("keeps numeric and string keys distinct but canonicalizes negative zero", () => {
    const distinct = repeatedText("row", [{ id: 1 }, { id: "1" }], "row", { $ref: "item.row.id" });
    expect(validateSource(minimalSource(distinct)).valid).toBe(true);

    const sameNumber = repeatedText("row", [{ id: -0 }, { id: 0 }], "row", { $ref: "item.row.id" });
    expectOnlyDiagnostic(
      validateSource(minimalSource(sameNumber)),
      "REPEAT_KEY_INVALID",
      "/surfaces/main/root/repeat/key",
    );
  });

  it("rejects nested alias shadowing while allowing the same alias in disjoint siblings", () => {
    const parent = stackNode("parent");
    parent.repeat = {
      items: [{ id: "parent" }],
      as: "row",
      key: { $ref: "item.row.id" },
    };
    parent.slots = {
      default: [
        repeatedText(
          "child",
          [{ id: "child", title: "Child" }],
          "row",
          { $ref: "item.row.id" },
          { $ref: "item.row.title" },
        ),
      ],
    };
    expectOnlyDiagnostic(
      validateSource(minimalSource(parent)),
      INVALID_BINDING_CONTRACT,
      "/surfaces/main/root/slots/default/0/repeat/as",
    );

    const siblings = stackNode("siblings");
    siblings.slots = {
      default: [
        repeatedText(
          "first",
          [{ id: "a", title: "A" }],
          "row",
          { $ref: "item.row.id" },
          { $ref: "item.row.title" },
        ),
        repeatedText(
          "second",
          [{ id: "b", title: "B" }],
          "row",
          { $ref: "item.row.id" },
          { $ref: "item.row.title" },
        ),
      ],
    };
    expect(validateSource(minimalSource(siblings)).valid).toBe(true);
  });

  it("does not activate a repeat's own alias inside its items expression", () => {
    const repeated = repeatedText("row", { $ref: "item.row.children" }, "row", {
      $ref: "item.row.id",
    });
    expectOnlyDiagnostic(
      validateSource(minimalSource(repeated)),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/repeat/items/$ref",
    );
  });
});

describe("M02-T10 narrow state writes and T11 fences", () => {
  it("checks only the declared first state path segment for set and toggle", () => {
    const source = minimalSource(
      buttonWithActions([
        { type: "state.set", path: "profile.name", value: "Grace" },
        { type: "state.toggle", path: "profile.enabled" },
      ]),
      {
        profile: stateEntry(
          {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              enabled: { type: "boolean" },
            },
          },
          { name: "Ada", enabled: false },
        ),
      },
    );
    expect(validateSource(source).valid).toBe(true);
  });

  it("reports undeclared state.set and state.toggle roots at their path fields", () => {
    const source = minimalSource(
      buttonWithActions([
        { type: "state.set", path: "missing.value", value: 1 },
        { type: "state.toggle", path: "ghost" },
      ]),
    );
    const result = validateSource(source);
    expect(diagnosticIdentity(result)).toEqual([
      ["STATE_WRITE_INVALID", "/surfaces/main/root/on/press/0/path"],
      ["STATE_WRITE_INVALID", "/surfaces/main/root/on/press/1/path"],
    ]);
  });

  it("leaves resource, operation, navigation, refresh, and unknown command targets to T11", () => {
    const source = minimalSource(
      buttonWithActions([
        {
          type: "navigate",
          surface: "missing-surface",
          params: {
            resource: { $ref: "resource.missing.value" },
            operation: { $ref: "operation.missing.output" },
          },
        },
        { type: "resource.refresh", resource: "missing-resource" },
        {
          type: "component.command",
          target: "missing-node",
          command: "missingCommand",
          input: { value: { $ref: "context.commandInput" } },
        },
        {
          type: "operation.invoke",
          operation: SIGN_IN,
          as: "request",
          input: {
            email: { $ref: "env.email" },
            password: { $ref: "operation.previous.password" },
          },
        },
      ]),
    );
    expect(validateSource(source).valid).toBe(true);
  });
});

describe("M02-T10 determinism, immutability, and dispatcher parity", () => {
  it("returns deeply frozen isolated success and failure results", () => {
    const input = minimalSource(textNode("text", "before")) as MutableRecord;
    const success = validateSource(input);
    expect(success.valid).toBe(true);
    expectDeepFrozen(success);
    recordAt(input, ["surfaces", "main", "root", "props"]).text = "after";
    if (!success.valid) throw new TypeError("Expected binding validation to pass.");
    expect(recordAt(success.value, ["surfaces", "main", "root", "props"]).text).toBe("before");

    const failure = validateSource(minimalSource(textNode("text", { $ref: "state.missing" })));
    expect(failure.valid).toBe(false);
    expectDeepFrozen(failure);
  });

  it("is deterministic under reversed object member insertion order", () => {
    const root = textNode("text", {
      $format: { template: "{missing}", values: { extra: { $ref: "state.ghost" } } },
    });
    root.when = { op: "gt", args: [1, "2"] };
    const source = minimalSource(root, {
      invalid: stateEntry({ type: "number" }, "not-a-number"),
    });

    expect(validateSource(source)).toEqual(validateSource(reverseObjectMemberOrder(source)));
  });

  it("matches the generic dispatcher for Source and Bundle", () => {
    const catalogs = interactionCatalogSet();
    expect(validateDesenBindingContracts("source", validSource, catalogs)).toEqual(
      validateDesenSourceBindingContracts(validSource, catalogs),
    );
    expect(validateDesenBindingContracts("bundle", validBundle, catalogs)).toEqual(
      validateDesenBundleBindingContracts(validBundle, catalogs),
    );
  });

  it("walks a deeply nested component tree without recursive T10 traversal", () => {
    let root = textNode("leaf");
    for (let depth = 0; depth < 300; depth += 1) {
      const parent = stackNode(`stack-${depth}`);
      parent.slots = { default: [root] };
      root = parent;
    }
    const result = validateSource(minimalSource(root));
    expect(result.valid).toBe(true);
    expectDeepFrozen(result);
  });

  it("exports the reviewed namespaced diagnostic identity", () => {
    expect(INVALID_BINDING_CONTRACT_CODE).toBe(INVALID_BINDING_CONTRACT);
  });
});
