import { describe, expect, it } from "vitest";

import bundleCatalogDigestMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-catalog-digest-mismatch.json";
import bundleRevisionMismatch from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/bundle-revision-mismatch.json";
import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import exampleCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import exampleSignInBundle from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json";
import exampleSignInSource from "../../protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import { validateDesenSourceBindingContracts } from "../src/binding-contract-validation.js";
import {
  INVALID_EXECUTION_CONTRACT_CODE,
  validateDesenBundleExecutionContracts,
  validateDesenExecutionCatalogSet,
  validateDesenExecutionContracts,
  validateDesenExecutionValue,
  validateDesenSourceExecutionContracts,
} from "../src/execution-contract-validation.js";
import { validateDesenInteractionCatalogSet } from "../src/interaction-contract-validation.js";

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
  readonly obligations?: readonly ObligationLike[];
  readonly value?: unknown;
}

type ExecutionValueSelector =
  | {
      readonly kind: "component-command-input";
      readonly capabilityId: string;
      readonly commandName: string;
    }
  | {
      readonly kind: "operation-input" | "operation-output" | "resource-input" | "resource-output";
      readonly capabilityId: string;
    };

const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const SORTABLE = "com.example.interactions/Sortable";
const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";
const INVALID_EXECUTION_CONTRACT = "run.desen.validator/INVALID_EXECUTION_CONTRACT";

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

function stateEntry(schema: MutableRecord, initial: unknown): MutableRecord {
  return { schema, initial };
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

function buttonWithActions(actions: readonly MutableRecord[]): MutableRecord {
  const actor = node("actor", BUTTON, { label: "Run" });
  actor.on = { press: [...actions] };
  return actor;
}

function sourceWithActions(
  actions: readonly MutableRecord[],
  options: {
    readonly state?: MutableRecord;
    readonly resources?: MutableRecord;
    readonly siblings?: readonly MutableRecord[];
  } = {},
): unknown {
  const actor = buttonWithActions(actions);
  if ((options.siblings?.length ?? 0) === 0) {
    return minimalSource(actor, options.state, options.resources);
  }
  const root = stackNode("layout");
  root.slots = { default: [actor, ...(options.siblings ?? [])] };
  return minimalSource(root, options.state, options.resources);
}

function addOperation(
  catalog: unknown,
  capabilityId: string,
  inputSchema: MutableRecord,
  outputSchema: MutableRecord,
): MutableRecord {
  const capability: MutableRecord = {
    inputSchema,
    outputSchema,
    errors: [],
    effect: "none",
  };
  recordAt(catalog, ["operations"])[capabilityId] = capability;
  return capability;
}

function addResource(
  catalog: unknown,
  capabilityId: string,
  inputSchema: MutableRecord,
  outputSchema: MutableRecord,
  policies: readonly string[] = ["mount", "manual", "once"],
): MutableRecord {
  const capability: MutableRecord = {
    inputSchema,
    outputSchema,
    errors: [],
    policies: [...policies],
  };
  recordAt(catalog, ["resources"])[capabilityId] = capability;
  return capability;
}

function addComponentCommand(
  catalog: unknown,
  capabilityId: string,
  commandName: string,
  inputSchema: MutableRecord,
): void {
  const component = recordAt(catalog, ["components", capabilityId]);
  const commands = Object.hasOwn(component, "commands")
    ? record(component.commands, `${capabilityId}.commands`)
    : {};
  commands[commandName] = { inputSchema };
  component.commands = commands;
}

function executionCatalogSet(catalogs: readonly unknown[] = [validCatalog]) {
  const result = validateDesenExecutionCatalogSet(catalogs);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected execution catalog preparation to pass.");
  return result.value;
}

function interactionCatalogSet(catalogs: readonly unknown[] = [validCatalog]) {
  const result = validateDesenInteractionCatalogSet(catalogs);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected interaction catalog preparation to pass.");
  return result.value;
}

function validateSource(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenSourceExecutionContracts(input, executionCatalogSet(catalogs));
}

function validateBundle(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenBundleExecutionContracts(input, executionCatalogSet(catalogs));
}

function validateExecutionValue(
  value: unknown,
  selector: ExecutionValueSelector,
  catalogs: readonly unknown[] = [validCatalog],
) {
  return validateDesenExecutionValue(value, selector, executionCatalogSet(catalogs));
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

function expectObligation(result: ResultLike, kind: string, pointer: string): void {
  expect(result.valid).toBe(true);
  expect(result.obligations ?? []).toContainEqual(expect.objectContaining({ kind, pointer }));
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

function signInAction(alias = "request"): MutableRecord {
  return {
    type: "operation.invoke",
    operation: SIGN_IN,
    as: alias,
    input: { email: "person@example.com", password: "secret" },
  };
}

describe("M02-T11 cumulative boundary and frozen corpus", () => {
  it("accepts the exact frozen valid Catalog, Source, Bundle, and all five examples", () => {
    for (const catalog of [validCatalog, exampleCatalog]) {
      const result = validateDesenExecutionCatalogSet([catalog]);
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toEqual([]);
    }

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

  it("preserves T06 through T10 document failures exactly", () => {
    const invalidBinding = minimalSource(textNode("text"));
    writeAt(invalidBinding, ["surfaces", "main", "root", "when"], {
      op: "gt",
      args: [true, 1],
    });
    const interactions = interactionCatalogSet();
    const executions = executionCatalogSet();

    for (const input of [
      sourceUnknownCoreField,
      sourceDuplicateNodeId,
      sourceUnknownEvent,
      invalidBinding,
    ]) {
      expect(validateDesenSourceExecutionContracts(input, executions)).toEqual(
        validateDesenSourceBindingContracts(input, interactions),
      );
    }
  });

  it("rejects a genuine T09 catalog set passed through a forged T11 brand", () => {
    const lowerStage = validateDesenInteractionCatalogSet([validCatalog]);
    expect(lowerStage.valid).toBe(true);
    if (!lowerStage.valid) throw new TypeError("Expected T09 catalog preparation to pass.");

    expectOnlyDiagnostic(
      validateDesenSourceExecutionContracts(validSource, lowerStage.value as never),
      INVALID_EXECUTION_CONTRACT,
      "/catalogs",
    );
  });

  it("keeps Bundle revision and catalog-digest failures in their later integrity scope", () => {
    expect(validateBundle(bundleRevisionMismatch).valid).toBe(true);
    expect(validateBundle(bundleCatalogDigestMismatch).valid).toBe(true);
  });
});

describe("M02-T11 bounded operation and resource catalog preparation", () => {
  const schemaCases = [
    {
      path: ["operations", SIGN_IN, "inputSchema"] as const,
      pointer: "/0/operations/com.example.auth~1signIn/inputSchema/properties/value/pattern",
    },
    {
      path: ["operations", SIGN_IN, "outputSchema"] as const,
      pointer: "/0/operations/com.example.auth~1signIn/outputSchema/properties/value/pattern",
    },
    {
      path: ["resources", STORES, "inputSchema"] as const,
      pointer: "/0/resources/com.example.stores~1list/inputSchema/properties/value/pattern",
    },
    {
      path: ["resources", STORES, "outputSchema"] as const,
      pointer: "/0/resources/com.example.stores~1list/outputSchema/properties/value/pattern",
    },
  ];

  it("fails closed independently in all four execution schema channels", () => {
    for (const schemaCase of schemaCases) {
      const catalog = cloneFixture(validCatalog) as unknown;
      writeAt(catalog, schemaCase.path, {
        type: "object",
        properties: { value: { type: "string", pattern: "^(a+)+$" } },
      });
      expectOnlyDiagnostic(
        validateDesenExecutionCatalogSet([catalog]),
        INVALID_EXECUTION_CONTRACT,
        schemaCase.pointer,
      );
    }
  });

  it("prepares own catalog fields rather than prototype-inherited operation or resource maps", () => {
    const priorOperations = Object.getOwnPropertyDescriptor(Object.prototype, "operations");
    const priorResources = Object.getOwnPropertyDescriptor(Object.prototype, "resources");
    Object.defineProperties(Object.prototype, {
      operations: {
        configurable: true,
        value: { inherited: { inputSchema: {}, outputSchema: {} } },
      },
      resources: {
        configurable: true,
        value: { inherited: { inputSchema: {}, outputSchema: {} } },
      },
    });
    try {
      expect(validateDesenExecutionCatalogSet([validCatalog]).valid).toBe(true);
    } finally {
      if (priorOperations === undefined) Reflect.deleteProperty(Object.prototype, "operations");
      else Object.defineProperty(Object.prototype, "operations", priorOperations);
      if (priorResources === undefined) Reflect.deleteProperty(Object.prototype, "resources");
      else Object.defineProperty(Object.prototype, "resources", priorResources);
    }
  });
});

describe("M02-T11 resource declarations, inputs, policies, and lifecycle references", () => {
  const SEARCH_RESOURCE = "com.example.search/results";

  function searchCatalog(): unknown {
    const catalog = cloneFixture(validCatalog) as unknown;
    addResource(
      catalog,
      SEARCH_RESOURCE,
      {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["items"],
        properties: {
          items: { type: "array", items: { type: "string" } },
          count: { type: "integer" },
        },
      },
      ["manual", "mount"],
    );
    return catalog;
  }

  it("accepts a supported policy and validates statically known resource input", () => {
    const source = minimalSource(
      textNode("text"),
      {},
      {
        search: { use: SEARCH_RESOURCE, input: { query: "desen" }, policy: "manual" },
      },
    );
    expect(validateSource(source, [searchCatalog()]).valid).toBe(true);
  });

  it("maps an unsupported policy to RESOURCE_INPUT_INVALID at the policy", () => {
    const source = minimalSource(
      textNode("text"),
      {},
      {
        search: { use: SEARCH_RESOURCE, input: { query: "desen" }, policy: "once" },
      },
    );
    expectOnlyDiagnostic(
      validateSource(source, [searchCatalog()]),
      "RESOURCE_INPUT_INVALID",
      "/surfaces/main/resources/search/policy",
    );
  });

  it("reports a static resource input mismatch at the exact input-relative pointer", () => {
    const source = minimalSource(
      textNode("text"),
      {},
      {
        search: { use: SEARCH_RESOURCE, input: { query: 42 }, policy: "manual" },
      },
    );
    expectOnlyDiagnostic(
      validateSource(source, [searchCatalog()]),
      "RESOURCE_INPUT_INVALID",
      "/surfaces/main/resources/search/input/query",
    );
  });

  it("retains a dynamic resource input as an exact later-validation obligation", () => {
    const source = minimalSource(
      textNode("text"),
      {},
      {
        search: {
          use: SEARCH_RESOURCE,
          input: { query: { $ref: "context.searchQuery" } },
          policy: "mount",
        },
      },
    );
    const result = validateSource(source, [searchCatalog()]);
    expectObligation(result, "resource-input", "/surfaces/main/resources/search/input/query");
  });

  it("accepts only the declared lifecycle fields and output-schema paths", () => {
    const probe = {
      type: "event.emit",
      name: "resource-probe",
      payload: {
        status: { $ref: "resource.search.status" },
        pending: { $ref: "resource.search.pending" },
        value: { $ref: "resource.search.value" },
        items: { $ref: "resource.search.value.items" },
        error: { $ref: "resource.search.error.code" },
      },
    };
    const source = sourceWithActions([probe], {
      resources: {
        search: { use: SEARCH_RESOURCE, input: { query: "desen" }, policy: "manual" },
      },
    });
    expect(validateSource(source, [searchCatalog()]).valid).toBe(true);
  });

  it("rejects unknown resources and definitely closed output paths even with lexical fallbacks", () => {
    const resources = {
      search: { use: SEARCH_RESOURCE, input: { query: "desen" }, policy: "manual" },
    };
    const unknownResource = sourceWithActions(
      [
        {
          type: "event.emit",
          name: "probe",
          payload: { value: { $ref: "resource.ghost.value", fallback: [] } },
        },
      ],
      { resources },
    );
    expectOnlyDiagnostic(
      validateSource(unknownResource, [searchCatalog()]),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/press/0/payload/value/$ref",
    );

    const unknownPath = sourceWithActions(
      [
        {
          type: "event.emit",
          name: "probe",
          payload: { value: { $ref: "resource.search.value.missing" } },
        },
      ],
      { resources },
    );
    expectOnlyDiagnostic(
      validateSource(unknownPath, [searchCatalog()]),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/press/0/payload/value/$ref",
    );

    const fallback = sourceWithActions(
      [
        {
          type: "event.emit",
          name: "probe",
          payload: {
            value: { $ref: "resource.search.value.missing", fallback: "unavailable" },
          },
        },
      ],
      { resources },
    );
    expect(validateSource(fallback, [searchCatalog()]).valid).toBe(true);
  });

  it("feeds definite lifecycle types back into predicate validation", () => {
    const actor = buttonWithActions([]);
    actor.when = { op: "gt", args: [{ $ref: "resource.search.pending" }, 1] };
    const source = minimalSource(
      actor,
      {},
      {
        search: { use: SEARCH_RESOURCE, input: { query: "desen" }, policy: "manual" },
      },
    );
    expectOnlyDiagnostic(
      validateSource(source, [searchCatalog()]),
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/main/root/when/args/0",
    );
  });
});

describe("M02-T11 operation aliases, inputs, and lifecycle references", () => {
  it("validates a statically known operation input", () => {
    expect(validateSource(sourceWithActions([signInAction()])).valid).toBe(true);

    const invalid = signInAction();
    record(invalid.input).password = "";
    expectOnlyDiagnostic(
      validateSource(sourceWithActions([invalid])),
      "OPERATION_INPUT_INVALID",
      "/surfaces/main/root/on/press/0/input/password",
    );
  });

  it("retains dynamic operation inputs as exact later-validation obligations", () => {
    const action = signInAction();
    action.input = {
      email: { $ref: "state.email" },
      password: { $ref: "context.password" },
    };
    const result = validateSource(
      sourceWithActions([action], {
        state: { email: stateEntry({ type: "string" }, "person@example.com") },
      }),
    );
    expectObligation(result, "operation-input", "/surfaces/main/root/on/press/0/input/email");
    expectObligation(result, "operation-input", "/surfaces/main/root/on/press/0/input/password");
  });

  it("indexes aliases surface-wide before checking lifecycle references", () => {
    const source = sourceWithActions([
      {
        type: "event.emit",
        name: "operation-probe",
        payload: {
          status: { $ref: "operation.request.status" },
          pending: { $ref: "operation.request.pending" },
          value: { $ref: "operation.request.value" },
          user: { $ref: "operation.request.value.userId" },
          error: { $ref: "operation.request.error.code" },
        },
      },
      signInAction("request"),
    ]);
    expect(validateSource(source).valid).toBe(true);
  });

  it("rejects unknown aliases and closed output paths without letting fallback create an alias", () => {
    const unknownAlias = sourceWithActions([
      {
        type: "event.emit",
        name: "probe",
        payload: { value: { $ref: "operation.ghost.value", fallback: {} } },
      },
    ]);
    expectOnlyDiagnostic(
      validateSource(unknownAlias),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/press/0/payload/value/$ref",
    );

    const unknownPath = sourceWithActions([
      signInAction("request"),
      {
        type: "event.emit",
        name: "probe",
        payload: { value: { $ref: "operation.request.value.missing" } },
      },
    ]);
    expectOnlyDiagnostic(
      validateSource(unknownPath),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/press/1/payload/value/$ref",
    );
  });

  it("allows one alias to share one exact operation but rejects a conflicting capability", () => {
    expect(
      validateSource(sourceWithActions([signInAction("shared"), signInAction("shared")])).valid,
    ).toBe(true);

    const catalog = cloneFixture(validCatalog) as unknown;
    const SIGN_OUT = "com.example.auth/signOut";
    addOperation(
      catalog,
      SIGN_OUT,
      { type: "object", additionalProperties: false, properties: {} },
      { type: "object", additionalProperties: false, properties: {} },
    );
    const conflicting = {
      type: "operation.invoke",
      operation: SIGN_OUT,
      as: "shared",
      input: {},
    };
    expectOnlyDiagnostic(
      validateSource(sourceWithActions([signInAction("shared"), conflicting]), [catalog]),
      INVALID_EXECUTION_CONTRACT,
      "/surfaces/main/root/on/press/1/as",
    );

    const manyActions: MutableRecord[] = Array.from({ length: 11 }, (_, index) => ({
      type: "event.emit",
      name: `filler-${index}`,
    }));
    manyActions[2] = signInAction("ordered");
    manyActions[10] = { ...conflicting, as: "ordered" };
    expectOnlyDiagnostic(
      validateSource(sourceWithActions(manyActions), [catalog]),
      INVALID_EXECUTION_CONTRACT,
      "/surfaces/main/root/on/press/10/as",
    );
  });

  it("applies operation input contracts to Bundle actions at the same relative pointer", () => {
    const bundle = cloneFixture(validBundle) as unknown;
    writeAt(
      bundle,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "input", "password"],
      "",
    );
    expectOnlyDiagnostic(
      validateBundle(bundle),
      "OPERATION_INPUT_INVALID",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/input/password",
    );
  });
});

describe("M02-T11 navigation and resource.refresh targets", () => {
  it("accepts declared navigation and refresh targets", () => {
    const source = sourceWithActions(
      [
        { type: "navigate", surface: "home", params: { from: "main" } },
        { type: "resource.refresh", resource: "stores" },
      ],
      {
        resources: { stores: { use: STORES, input: {}, policy: "manual" } },
      },
    );
    recordAt(source, ["surfaces"]).home = {
      id: "home",
      state: {},
      resources: {},
      root: textNode("home.text", "Home"),
    };
    expect(validateSource(source).valid).toBe(true);
  });

  it("reports a missing navigation target at the action surface field", () => {
    expectOnlyDiagnostic(
      validateSource(sourceWithActions([{ type: "navigate", surface: "missing" }])),
      "ENTRY_NOT_FOUND",
      "/surfaces/main/root/on/press/0/surface",
    );
  });

  it("cannot treat an external-looking string as a core navigation target", () => {
    expectOnlyDiagnostic(
      validateSource(sourceWithActions([{ type: "navigate", surface: "https:" }])),
      "ENTRY_NOT_FOUND",
      "/surfaces/main/root/on/press/0/surface",
    );
  });

  it("reports a missing refresh instance at the action resource field", () => {
    expectOnlyDiagnostic(
      validateSource(sourceWithActions([{ type: "resource.refresh", resource: "missing" }])),
      "REFERENCE_UNRESOLVED",
      "/surfaces/main/root/on/press/0/resource",
    );
  });
});

describe("M02-T11 component command targets and inputs", () => {
  function commandCatalog(): unknown {
    const catalog = cloneFixture(validCatalog) as unknown;
    addComponentCommand(catalog, TEXT_FIELD, "focus", {
      type: "object",
      additionalProperties: false,
      required: ["selectAll"],
      properties: { selectAll: { type: "boolean" } },
    });
    return catalog;
  }

  function commandSource(input: unknown, target = "field"): unknown {
    return sourceWithActions([{ type: "component.command", target, command: "focus", input }], {
      siblings: [node("field", TEXT_FIELD, { label: "Name", value: "" })],
    });
  }

  it("accepts a declared same-surface component target and valid command input", () => {
    expect(validateSource(commandSource({ selectAll: true }), [commandCatalog()]).valid).toBe(true);
  });

  it("reports a missing or cross-surface target at the target member", () => {
    expectOnlyDiagnostic(
      validateSource(commandSource({ selectAll: true }, "missing"), [commandCatalog()]),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/slots/default/0/on/press/0/target",
    );

    const crossSurface = sourceWithActions([
      {
        type: "component.command",
        target: "other.field",
        command: "focus",
        input: { selectAll: true },
      },
    ]);
    recordAt(crossSurface, ["surfaces"]).other = {
      id: "other",
      state: {},
      resources: {},
      root: node("other.field", TEXT_FIELD, { label: "Other", value: "" }),
    };
    expectOnlyDiagnostic(
      validateSource(crossSurface, [commandCatalog()]),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/on/press/0/target",
    );
  });

  it("does not redirect component.command to a behavior command", () => {
    const catalog = commandCatalog();
    recordAt(catalog, ["behaviors", SORTABLE]).commands = {
      focus: {
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: ["selectAll"],
          properties: { selectAll: { type: "boolean" } },
        },
      },
    };
    const actor = buttonWithActions([
      {
        type: "component.command",
        target: "sort",
        command: "focus",
        input: { selectAll: true },
      },
    ]);
    const root = stackNode("layout");
    root.behaviors = [{ id: "sort", use: SORTABLE }];
    root.slots = { default: [actor] };

    expectOnlyDiagnostic(
      validateSource(minimalSource(root), [catalog]),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/slots/default/0/on/press/0/target",
    );
  });

  it("validates command input and treats omitted input as an empty object", () => {
    const invalidInput = validateSource(commandSource({ selectAll: "yes" }), [commandCatalog()]);
    expectOnlyDiagnostic(
      invalidInput,
      "COMMAND_INPUT_INVALID",
      "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    );
    expect(invalidInput.diagnostics[0]?.context).toEqual({
      documentId: "com.example.account-app",
      surfaceId: "main",
      subject: { kind: "node", id: "field" },
      capabilityId: TEXT_FIELD,
    });

    const source = commandSource({ selectAll: true });
    deleteAt(source, [
      "surfaces",
      "main",
      "root",
      "slots",
      "default",
      0,
      "on",
      "press",
      0,
      "input",
    ]);
    expectOnlyDiagnostic(
      validateSource(source, [commandCatalog()]),
      "COMMAND_INPUT_INVALID",
      "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    );
  });

  it("retains a dynamic command input as an exact later-validation obligation", () => {
    const result = validateSource(commandSource({ selectAll: { $ref: "context.selectAll" } }), [
      commandCatalog(),
    ]);
    expectObligation(
      result,
      "component-command-input",
      "/surfaces/main/root/slots/default/0/on/press/0/input/selectAll",
    );
  });

  it("accepts a declared target whose conditional runtime liveness is not statically known", () => {
    const target = node("field", TEXT_FIELD, { label: "Name", value: "" });
    target.when = { op: "truthy", args: [{ $ref: "context.showField" }] };
    const source = sourceWithActions(
      [
        {
          type: "component.command",
          target: "field",
          command: "focus",
          input: { selectAll: false },
        },
      ],
      { siblings: [target] },
    );
    expect(validateSource(source, [commandCatalog()]).valid).toBe(true);
  });
});

describe("M02-T11 state.set and state.toggle contracts", () => {
  function profileState(): MutableRecord {
    return {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          required: ["name", "enabled"],
          properties: {
            name: { type: "string" },
            enabled: { type: "boolean" },
          },
        },
        { name: "Ada", enabled: false },
      ),
    };
  }

  it("accepts compatible root and nested writes plus boolean toggles", () => {
    const source = sourceWithActions(
      [
        {
          type: "state.set",
          path: "profile",
          value: { name: "Grace", enabled: true },
        },
        { type: "state.set", path: "profile.name", value: "Lin" },
        { type: "state.toggle", path: "profile.enabled" },
      ],
      { state: profileState() },
    );
    expect(validateSource(source).valid).toBe(true);
  });

  it("rejects an incompatible state.set value at the value member", () => {
    const source = sourceWithActions([{ type: "state.set", path: "profile.name", value: 42 }], {
      state: profileState(),
    });
    expectOnlyDiagnostic(
      validateSource(source),
      "STATE_WRITE_INVALID",
      "/surfaces/main/root/on/press/0/value",
    );
  });

  it("rejects a definitely missing nested state path at the path member", () => {
    const source = sourceWithActions(
      [{ type: "state.set", path: "profile.missing", value: "value" }],
      { state: profileState() },
    );
    expectOnlyDiagnostic(
      validateSource(source),
      "STATE_WRITE_INVALID",
      "/surfaces/main/root/on/press/0/path",
    );
  });

  it("rejects state.toggle when its target is definitely not boolean", () => {
    const source = sourceWithActions([{ type: "state.toggle", path: "profile.name" }], {
      state: profileState(),
    });
    expectOnlyDiagnostic(
      validateSource(source),
      "STATE_WRITE_INVALID",
      "/surfaces/main/root/on/press/0/path",
    );
  });

  it("defers open or union state paths whose runtime type is not statically certain", () => {
    const state = {
      open: stateEntry({ type: "object", additionalProperties: true }, {}),
      union: stateEntry({ type: ["boolean", "string"] }, false),
    };
    const source = sourceWithActions(
      [
        { type: "state.set", path: "open.future", value: { any: "json" } },
        { type: "state.toggle", path: "union" },
      ],
      { state },
    );
    expect(validateSource(source).valid).toBe(true);
  });

  it("does not treat unchanged required siblings as missing during a deep nested write", () => {
    const state = {
      profile: stateEntry(
        {
          type: "object",
          additionalProperties: false,
          required: ["address"],
          properties: {
            address: {
              type: "object",
              additionalProperties: false,
              required: ["street", "postalCode"],
              properties: {
                street: { type: "string" },
                postalCode: { type: "string" },
              },
            },
          },
        },
        { address: { street: "First", postalCode: "34000" } },
      ),
    };
    const result = validateSource(
      sourceWithActions([{ type: "state.set", path: "profile.address.street", value: "Second" }], {
        state,
      }),
    );
    expectObligation(result, "state-write", "/surfaces/main/root/on/press/0/value");

    const dynamic = validateSource(
      sourceWithActions(
        [
          {
            type: "state.set",
            path: "profile.address.street",
            value: { $ref: "context.nextStreet" },
          },
        ],
        { state },
      ),
    );
    expectObligation(dynamic, "state-write", "/surfaces/main/root/on/press/0/value");
  });
});

describe("M02-T11 detached resolved execution values", () => {
  const operationInput: ExecutionValueSelector = {
    kind: "operation-input",
    capabilityId: SIGN_IN,
  };
  const operationOutput: ExecutionValueSelector = {
    kind: "operation-output",
    capabilityId: SIGN_IN,
  };
  const resourceInput: ExecutionValueSelector = {
    kind: "resource-input",
    capabilityId: STORES,
  };
  const resourceOutput: ExecutionValueSelector = {
    kind: "resource-output",
    capabilityId: STORES,
  };

  it("validates all four operation/resource input and output channels", () => {
    expect(
      validateExecutionValue({ email: "person@example.com", password: "secret" }, operationInput)
        .valid,
    ).toBe(true);
    expectOnlyDiagnostic(
      validateExecutionValue({ email: "person@example.com", password: "" }, operationInput),
      "OPERATION_INPUT_INVALID",
      "/password",
    );

    expect(validateExecutionValue({ userId: "user-1" }, operationOutput).valid).toBe(true);
    expectOnlyDiagnostic(
      validateExecutionValue({ userId: 1 }, operationOutput),
      "OPERATION_OUTPUT_INVALID",
      "/userId",
    );

    expect(validateExecutionValue({}, resourceInput).valid).toBe(true);
    expectOnlyDiagnostic(
      validateExecutionValue({ extra: true }, resourceInput),
      "RESOURCE_INPUT_INVALID",
      "/extra",
    );

    expect(validateExecutionValue({ items: [], bounds: {} }, resourceOutput).valid).toBe(true);
    expectOnlyDiagnostic(
      validateExecutionValue({ items: [] }, resourceOutput),
      "RESOURCE_OUTPUT_INVALID",
      "/bounds",
    );
  });

  it("validates resolved component command input through the exact selector", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    addComponentCommand(catalog, TEXT_FIELD, "focus", {
      type: "object",
      additionalProperties: false,
      required: ["selectAll"],
      properties: { selectAll: { type: "boolean" } },
    });
    const selector: ExecutionValueSelector = {
      kind: "component-command-input",
      capabilityId: TEXT_FIELD,
      commandName: "focus",
    };

    expect(validateExecutionValue({ selectAll: true }, selector, [catalog]).valid).toBe(true);
    expectOnlyDiagnostic(
      validateExecutionValue({ selectAll: "yes" }, selector, [catalog]),
      "COMMAND_INPUT_INVALID",
      "/selectAll",
    );
  });

  it("treats ValueSpec-shaped resolved output members as ordinary inert JSON", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const operation = recordAt(catalog, ["operations", SIGN_IN]);
    operation.outputSchema = {
      type: "object",
      additionalProperties: false,
      required: ["$ref"],
      properties: { $ref: { type: "number" } },
    };

    expectOnlyDiagnostic(
      validateExecutionValue({ $ref: "state.not-a-binding" }, operationOutput, [catalog]),
      "OPERATION_OUTPUT_INVALID",
      "/$ref",
    );
  });

  it("copies and deeply freezes a successful resolved value independently of the caller", () => {
    const output = { userId: "before" };
    const result = validateExecutionValue(output, operationOutput);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected operation output validation to pass.");
    output.userId = "after";

    expect(result.value).toEqual({ userId: "before" });
    expect(result.value).not.toBe(output);
    expectDeepFrozen(result);
  });

  it("contains accessors, cycles, custom prototypes, and non-finite resolved values", () => {
    let accessed = false;
    const accessorOutput: MutableRecord = {};
    Object.defineProperty(accessorOutput, "userId", {
      enumerable: true,
      get() {
        accessed = true;
        return "secret";
      },
    });
    expectOnlyDiagnostic(
      validateExecutionValue(accessorOutput, operationOutput),
      "OPERATION_OUTPUT_INVALID",
      "",
    );
    expect(accessed).toBe(false);

    const cyclic: MutableRecord = { userId: "user-1" };
    cyclic.self = cyclic;
    expectOnlyDiagnostic(
      validateExecutionValue(cyclic, operationOutput),
      "OPERATION_OUTPUT_INVALID",
      "",
    );

    const customPrototype = Object.create({ inherited: true }) as MutableRecord;
    customPrototype.userId = "user-1";
    expectOnlyDiagnostic(
      validateExecutionValue(customPrototype, operationOutput),
      "OPERATION_OUTPUT_INVALID",
      "",
    );

    expectOnlyDiagnostic(
      validateExecutionValue({ userId: Number.NaN }, operationOutput),
      "OPERATION_OUTPUT_INVALID",
      "",
    );
  });

  it("rejects unknown selector capabilities and command names without guessing", () => {
    expectOnlyDiagnostic(
      validateExecutionValue(
        {},
        { kind: "operation-output", capabilityId: "com.example.missing/operation" },
      ),
      "UNKNOWN_CAPABILITY",
      "",
    );
    expectOnlyDiagnostic(
      validateExecutionValue(
        {},
        {
          kind: "component-command-input",
          capabilityId: TEXT_FIELD,
          commandName: "missing",
        },
      ),
      "UNKNOWN_COMMAND",
      "",
    );
  });

  it("reads selectors only through the detached exact-shape boundary", () => {
    const catalogs = executionCatalogSet();
    let accessed = false;
    const accessor = {
      kind: "operation-output",
      get capabilityId() {
        accessed = true;
        return SIGN_IN;
      },
    };
    const cyclic: MutableRecord = {
      kind: "operation-output",
      capabilityId: SIGN_IN,
    };
    cyclic.self = cyclic;
    const customPrototype = Object.assign(Object.create({ inherited: true }), {
      kind: "operation-output",
      capabilityId: SIGN_IN,
    });

    for (const selector of [
      { kind: "operation-output", capabilityId: SIGN_IN, extra: true },
      accessor,
      cyclic,
      customPrototype,
    ]) {
      expectOnlyDiagnostic(
        validateDesenExecutionValue({}, selector as never, catalogs),
        INVALID_EXECUTION_CONTRACT,
        "",
      );
    }
    expect(accessed).toBe(false);
  });
});

describe("M02-T11 determinism, immutability, dispatcher parity, and scope fences", () => {
  it("returns deeply frozen isolated catalog, Source, and failure results", () => {
    const catalogResult = validateDesenExecutionCatalogSet([validCatalog]);
    expect(catalogResult.valid).toBe(true);
    expectDeepFrozen(catalogResult);

    const input = cloneFixture(validSource) as unknown;
    const sourceResult = validateSource(input);
    expect(sourceResult.valid).toBe(true);
    expectDeepFrozen(sourceResult);
    writeAt(input, ["entry"], "changed-after-validation");
    if (!sourceResult.valid) throw new TypeError("Expected Source execution validation to pass.");
    expect(record(sourceResult.value).entry).toBe("sign-in");

    const failure = validateSource(
      sourceWithActions([{ type: "resource.refresh", resource: "missing" }]),
    );
    expect(failure.valid).toBe(false);
    expectDeepFrozen(failure);
  });

  it("normalizes diagnostics and execution obligations independently of object insertion order", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const SEARCH = "com.example.search/query";
    addResource(
      catalog,
      SEARCH,
      {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      {},
    );
    const source = sourceWithActions(
      [
        { type: "navigate", surface: "missing" },
        signInAction("request"),
        { type: "resource.refresh", resource: "ghost" },
      ],
      {
        resources: {
          search: {
            use: SEARCH,
            input: { query: { $ref: "context.query" } },
            policy: "mount",
          },
        },
      },
    );

    expect(validateSource(source, [catalog])).toEqual(
      validateSource(reverseObjectMemberOrder(source), [reverseObjectMemberOrder(catalog)]),
    );
  });

  it("keeps specialized Source and Bundle APIs equal to the generic dispatcher", () => {
    const catalogs = executionCatalogSet();
    expect(validateDesenExecutionContracts("source", validSource, catalogs)).toEqual(
      validateDesenSourceExecutionContracts(validSource, catalogs),
    );
    expect(validateDesenExecutionContracts("bundle", validBundle, catalogs)).toEqual(
      validateDesenBundleExecutionContracts(validBundle, catalogs),
    );
  });

  it("does not execute host policy, event allowlists, concurrency, or action-turn limits", () => {
    const actions: MutableRecord[] = [
      signInAction("shared"),
      { ...signInAction("shared"), concurrency: "replace" },
      { ...signInAction("shared"), concurrency: "queue" },
    ];
    for (let index = 0; index < 65; index += 1) {
      actions.push({ type: "event.emit", name: `host-event-${index}`, payload: { index } });
    }
    expect(validateSource(sourceWithActions(actions)).valid).toBe(true);
  });

  it("exports the reviewed namespaced diagnostic identity", () => {
    expect(INVALID_EXECUTION_CONTRACT_CODE).toBe(INVALID_EXECUTION_CONTRACT);
  });
});
