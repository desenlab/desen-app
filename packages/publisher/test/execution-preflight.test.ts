import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  validateDesenExecutionCatalogSet,
  validatePreparedDesenSourceReferences,
} from "@desen/validator";

import { preflightPublishCapabilities } from "../src/capability-preflight.js";
import {
  EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
} from "../src/execution-preflight.js";
import type {
  PublishExecutionPreflightLimits,
  PublishExecutionPreflightResult,
  PublishExecutionPreflightSuccess,
} from "../src/execution-preflight.js";
import type { PublishFailure } from "../src/publish-result.js";

type MutableRecord = Record<string, unknown>;

const SIGN_IN = "com.example.auth/signIn";
const SORTABLE = "com.example.interactions/Sortable";
const STACK = "com.example.ui/Stack";
const TASKS = "com.example.tasks/list";

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
  overrides: Partial<Omit<PublishExecutionPreflightLimits, "sourcePreflight">>,
): Readonly<PublishExecutionPreflightLimits> {
  return Object.freeze({ ...PUBLISH_EXECUTION_PREFLIGHT_LIMITS, ...overrides });
}

function preflight(
  source: unknown,
  catalog: unknown = clone(validCatalog),
  profile: Readonly<PublishExecutionPreflightLimits> = PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
): PublishExecutionPreflightResult {
  return preflightPublishExecution(JSON.stringify(source), [candidate(catalog)], profile);
}

function isSuccess(
  result: PublishExecutionPreflightResult,
): result is PublishExecutionPreflightSuccess {
  return Object.hasOwn(result, "executionPreflighted");
}

function expectNoPartialAuthority(result: PublishFailure): void {
  for (const field of [
    "bundle",
    "value",
    "source",
    "catalogSet",
    "packages",
    "requirementPackageIndexes",
    "preflighted",
    "capabilityPreflighted",
    "executionPreflighted",
    "obligations",
    "phase",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
}

function expectFailure(
  result: PublishExecutionPreflightResult,
  stage: PublishFailure["stage"],
  code: string,
  pointer: string,
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected execution preflight to fail.");
  expect(result).toMatchObject({ ok: false, stage });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({ code, pointer, stage, severity: "error" }),
  );
  expectNoPartialAuthority(result);
  expectDeepFrozen(result);
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

function obligationCodeUnits(
  obligation: PublishExecutionPreflightSuccess["obligations"][number],
): number {
  const { context } = obligation;
  return (
    obligation.kind.length +
    obligation.pointer.length +
    (context.documentId?.length ?? 0) +
    (context.surfaceId?.length ?? 0) +
    (context.subject?.kind.length ?? 0) +
    (context.subject?.id.length ?? 0) +
    (context.capabilityId?.length ?? 0)
  );
}

function pressActions(source: unknown): unknown[] {
  return array(
    valueAt(source, ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press"]),
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

function dynamicBehaviorAndResourceFixtures(): {
  readonly source: unknown;
  readonly catalog: unknown;
} {
  const source = clone(exampleSortableSource) as unknown;
  const catalog = clone(validCatalog) as unknown;
  const surface = record(valueAt(source, ["surfaces", "tasks"]));
  surface.state = {
    axis: {
      schema: { type: "string", enum: ["vertical", "horizontal", "both"] },
      initial: "vertical",
    },
  };
  writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "props", "axis"], {
    $ref: "state.axis",
  });
  writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "style"], {
    base: {
      dropIndicator: {
        color: { $token: "color.drag.indicator" },
      },
    },
  });
  writeAt(source, ["surfaces", "tasks", "resources", "tasks", "input"], {
    filter: { $ref: "context.taskFilter" },
  });
  writeAt(catalog, ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"], {
    type: "object",
    additionalProperties: false,
    properties: { color: { type: "string" } },
  });
  writeAt(catalog, ["resources", TASKS, "inputSchema"], {
    type: "object",
    additionalProperties: false,
    required: ["filter"],
    properties: { filter: { type: "string" } },
  });
  return Object.freeze({ source, catalog });
}

describe("package-private execution preflight", () => {
  it("upgrades exact T04 authorities and records the official normalized obligation set", () => {
    const sourceInput = clone(validSource);
    const catalogInput = clone(validCatalog);
    const result = preflight(sourceInput, catalogInput);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected execution preflight to succeed.");
    expect(result).toMatchObject({
      executionPreflighted: true,
      diagnostics: [],
      requirementPackageIndexes: [0],
    });
    expect(Object.keys(result).sort()).toEqual([
      "catalogSet",
      "diagnostics",
      "executionPreflighted",
      "obligations",
      "packages",
      "requirementPackageIndexes",
      "source",
    ]);
    expect(result.source).not.toBe(sourceInput);
    expect(result.catalogSet[0]).not.toBe(catalogInput);
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);
    expect(result.obligations.map(({ kind, pointer }) => ({ kind, pointer }))).toEqual([
      {
        kind: "state-write",
        pointer: "/surfaces/sign-in/root/slots/default/1/on/change/0/value",
      },
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/1/props/value",
      },
      {
        kind: "state-write",
        pointer: "/surfaces/sign-in/root/slots/default/2/on/change/0/value",
      },
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/2/props/value",
      },
      {
        kind: "operation-input",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/input/email",
      },
      {
        kind: "operation-input",
        pointer: "/surfaces/sign-in/root/slots/default/4/on/press/0/input/password",
      },
      {
        kind: "component-prop",
        pointer: "/surfaces/sign-in/root/slots/default/4/props/loading",
      },
    ]);
    expect(result.obligations.every((entry) => entry.context.documentId === result.source.id)).toBe(
      true,
    );
    expect(
      result.obligations.some(
        ({ kind }) =>
          kind === ("operation-output" as never) || kind === ("resource-output" as never),
      ),
    ).toBe(false);

    const catalogsReauthenticated = validateDesenExecutionCatalogSet(result.catalogSet);
    expect(catalogsReauthenticated.valid).toBe(true);
    if (!catalogsReauthenticated.valid)
      throw new TypeError("Expected execution Catalog authority.");
    expect(catalogsReauthenticated.value).toBe(result.catalogSet);
    const sourceReauthenticated = validatePreparedDesenSourceReferences(
      result.source,
      result.catalogSet,
    );
    expect(sourceReauthenticated.valid).toBe(true);
    if (!sourceReauthenticated.valid) throw new TypeError("Expected exact Source authority.");
    expect(sourceReauthenticated.value).toBe(result.source);
    expect(Object.hasOwn(result, "capabilityPreflighted")).toBe(false);
    expect(Object.hasOwn(result, "ok")).toBe(false);
    expect(Object.hasOwn(result, "bundle")).toBe(false);
    expectDeepFrozen(result);
  });

  it("accepts the official examples and covers every document-obligation kind", () => {
    const dynamic = dynamicBehaviorAndResourceFixtures();
    const cases = [
      preflight(validSource),
      preflight(exampleSortableSource),
      preflight(exampleStoreMapSource),
      preflight(dynamic.source, dynamic.catalog),
    ];
    const kinds = new Set<string>();
    for (const result of cases) {
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected official execution fixture to pass.");
      result.obligations.forEach(({ kind }) => kinds.add(kind));
      expectDeepFrozen(result);
    }
    expect([...kinds].sort()).toEqual([
      "behavior-prop",
      "behavior-style-part-property",
      "component-command-input",
      "component-prop",
      "operation-input",
      "resource-input",
      "state-write",
      "style-part-property",
    ]);
  });

  it("passes inherited T01–T04 failures through byte-for-byte without remapping", () => {
    const malformed = '{"kind":"desen.source",';
    const candidates = [candidate()];
    expect(preflightPublishExecution(malformed, candidates)).toEqual(
      preflightPublishCapabilities(malformed, candidates),
    );

    const invalid = clone(validSource) as unknown;
    writeAt(invalid, ["surfaces", "sign-in", "root", "slots", "default", 4, "props", "label"], 42);
    const raw = JSON.stringify(invalid);
    expect(preflightPublishExecution(raw, candidates)).toEqual(
      preflightPublishCapabilities(raw, candidates),
    );
  });

  it("prepares resource and operation input/output contracts before Source execution analysis", () => {
    for (const [path, pointer] of [
      [
        ["operations", SIGN_IN, "outputSchema"],
        "/0/operations/com.example.auth~1signIn/outputSchema/$ref",
      ],
      [
        ["resources", "com.example.stores/list", "inputSchema"],
        "/0/resources/com.example.stores~1list/inputSchema/$ref",
      ],
    ] as const) {
      const catalog = clone(validCatalog) as unknown;
      writeAt(catalog, path, { $ref: "#/$defs/missing" });
      expectFailure(
        preflight(validSource, catalog),
        "capability-contracts",
        "run.desen.validator/INVALID_EXECUTION_CONTRACT",
        pointer,
      );
    }
  });

  it("maps Source capability-use violations to capability-contracts", () => {
    const unsupportedPolicy = clone(exampleSortableSource) as unknown;
    const unsupportedPolicyCatalog = clone(validCatalog) as unknown;
    writeAt(unsupportedPolicyCatalog, ["resources", TASKS, "policies"], ["manual"]);
    expectFailure(
      preflight(unsupportedPolicy, unsupportedPolicyCatalog),
      "capability-contracts",
      "RESOURCE_INPUT_INVALID",
      "/surfaces/tasks/resources/tasks/policy",
    );

    const operationInput = clone(validSource) as unknown;
    writeAt(
      operationInput,
      ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "input"],
      {
        email: "person@example.com",
        password: "",
      },
    );
    expectFailure(
      preflight(operationInput),
      "capability-contracts",
      "OPERATION_INPUT_INVALID",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/input/password",
    );

    const commandInput = clone(exampleStoreMapSource) as unknown;
    writeAt(
      commandInput,
      ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "input", "bounds"],
      42,
    );
    expectFailure(
      preflight(commandInput),
      "capability-contracts",
      "COMMAND_INPUT_INVALID",
      "/surfaces/stores/root/slots/default/1/on/press/0/input/bounds",
    );
  });

  it("maps predicate, repeat, state, navigation, refresh, and command targets to state/control flow", () => {
    const predicate = clone(validSource) as unknown;
    writeAt(predicate, ["surfaces", "sign-in", "root", "when"], {
      op: "gt",
      args: [true, 1],
    });
    expectFailure(
      preflight(predicate),
      "state-and-control-flow",
      "PREDICATE_TYPE_MISMATCH",
      "/surfaces/sign-in/root/when/args/0",
    );

    const repeat = clone(exampleSortableSource) as unknown;
    writeAt(repeat, ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"], 42);
    expectFailure(
      preflight(repeat),
      "state-and-control-flow",
      "REPEAT_ITEMS_INVALID",
      "/surfaces/tasks/root/slots/default/0/repeat/items",
    );

    const navigation = clone(validSource) as unknown;
    pressActions(navigation).unshift({ type: "navigate", surface: "missing" });
    expectFailure(
      preflight(navigation),
      "state-and-control-flow",
      "ENTRY_NOT_FOUND",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/surface",
    );

    const refresh = clone(validSource) as unknown;
    pressActions(refresh).unshift({ type: "resource.refresh", resource: "missing" });
    expectFailure(
      preflight(refresh),
      "state-and-control-flow",
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/resource",
    );

    const commandTarget = clone(validSource) as unknown;
    pressActions(commandTarget).unshift({
      type: "component.command",
      target: "missing",
      command: "focus",
      input: {},
    });
    expectFailure(
      preflight(commandTarget),
      "state-and-control-flow",
      "UNKNOWN_COMMAND",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/target",
    );

    const stateWrite = clone(validSource) as unknown;
    writeAt(
      stateWrite,
      ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change", 0, "value"],
      42,
    );
    expectFailure(
      preflight(stateWrite),
      "state-and-control-flow",
      "STATE_WRITE_INVALID",
      "/surfaces/sign-in/root/slots/default/1/on/change/0/value",
    );
  });

  it("maps lexical, format, and lifecycle incompatibility to binding-compatibility", () => {
    const missingState = clone(validSource) as unknown;
    writeAt(
      missingState,
      ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value"],
      { $ref: "state.missing" },
    );
    expectFailure(
      preflight(missingState),
      "binding-compatibility",
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
    );

    const format = clone(exampleStoreMapSource) as unknown;
    writeAt(
      format,
      [
        "surfaces",
        "stores",
        "root",
        "slots",
        "default",
        0,
        "slots",
        "popup",
        0,
        "props",
        "text",
        "$format",
        "template",
      ],
      "Selected store: {missing}",
    );
    expectFailure(
      preflight(format),
      "binding-compatibility",
      "run.desen.validator/INVALID_BINDING_CONTRACT",
      "/surfaces/stores/root/slots/default/0/slots/popup/0/props/text/$format/template",
    );

    const lifecycle = clone(exampleStoreMapSource) as unknown;
    writeAt(
      lifecycle,
      ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "input", "bounds"],
      { $ref: "resource.stores.value.missing" },
    );
    expectFailure(
      preflight(lifecycle),
      "binding-compatibility",
      "REFERENCE_UNRESOLVED",
      "/surfaces/stores/root/slots/default/1/on/press/0/input/bounds/$ref",
    );
  });

  it("selects the earliest normative phase when independent defects coexist", () => {
    const allThree = clone(exampleSortableSource) as unknown;
    const capabilityCatalog = clone(validCatalog) as unknown;
    writeAt(capabilityCatalog, ["resources", TASKS, "policies"], ["manual"]);
    writeAt(allThree, ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"], 42);
    writeAt(allThree, ["surfaces", "tasks", "root", "slots", "default", 0, "props", "text"], {
      $ref: "state.missing",
    });
    expectFailure(
      preflight(allThree, capabilityCatalog),
      "capability-contracts",
      "RESOURCE_INPUT_INVALID",
      "/surfaces/tasks/resources/tasks/policy",
    );

    const stateAndBinding = clone(exampleSortableSource) as unknown;
    writeAt(
      stateAndBinding,
      ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"],
      42,
    );
    writeAt(
      stateAndBinding,
      ["surfaces", "tasks", "root", "slots", "default", 0, "props", "text"],
      { $ref: "state.missing" },
    );
    expectFailure(
      preflight(stateAndBinding),
      "state-and-control-flow",
      "REPEAT_ITEMS_INVALID",
      "/surfaces/tasks/root/slots/default/0/repeat/items",
    );
  });

  it("preserves T04 warnings byte-for-byte only on a complete T05 success", () => {
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", STACK, "deprecated"], "PRIVATE RETIREMENT TEXT");
    writeAt(catalog, ["components", STACK, "replacement"], "private/replacement");
    const raw = JSON.stringify(validSource);
    const candidates = [candidate(catalog)];
    const capability = preflightPublishCapabilities(raw, candidates);
    const execution = preflightPublishExecution(raw, candidates);
    expect("capabilityPreflighted" in capability).toBe(true);
    expect(isSuccess(execution)).toBe(true);
    if (!("capabilityPreflighted" in capability) || !isSuccess(execution)) {
      throw new TypeError("Expected both preflight stages to succeed.");
    }
    expect(execution.diagnostics).toEqual(capability.diagnostics);
    expect(JSON.stringify(execution.diagnostics)).not.toContain("PRIVATE RETIREMENT TEXT");
    expect(JSON.stringify(execution.diagnostics)).not.toContain("private/replacement");
  });

  it("suppresses lower-stage warnings when a later execution phase blocks publication", () => {
    const source = clone(validSource) as unknown;
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", STACK, "deprecated"], true);
    writeAt(source, ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value"], {
      $ref: "state.missing",
    });

    const result = preflight(source, catalog);
    expectFailure(
      result,
      "binding-compatibility",
      "REFERENCE_UNRESOLVED",
      "/surfaces/sign-in/root/slots/default/1/props/value/$ref",
    );
    expect(result.diagnostics.every(({ severity }) => severity === "error")).toBe(true);
    expect(
      result.diagnostics.some(({ code }) => code === "run.desen.publisher/DEPRECATED_CAPABILITY"),
    ).toBe(false);
  });

  it("accepts exact obligation ceilings and rejects one-below without truncation", () => {
    const baseline = preflight(validSource);
    expect(isSuccess(baseline)).toBe(true);
    if (!isSuccess(baseline)) throw new TypeError("Expected baseline execution preflight.");
    const obligationCount = baseline.obligations.length;
    const pointerCodeUnits = Math.max(...baseline.obligations.map(({ pointer }) => pointer.length));
    const aggregateCodeUnits = baseline.obligations.reduce(
      (total, obligation) => total + obligationCodeUnits(obligation),
      0,
    );

    for (const profile of [
      limits({ maxRuntimeValidationObligations: obligationCount }),
      limits({ maxRuntimeObligationPointerCodeUnits: pointerCodeUnits }),
      limits({ maxAggregateRuntimeObligationCodeUnits: aggregateCodeUnits }),
    ]) {
      expect(isSuccess(preflight(validSource, clone(validCatalog), profile))).toBe(true);
    }

    for (const profile of [
      limits({ maxRuntimeValidationObligations: obligationCount - 1 }),
      limits({ maxRuntimeObligationPointerCodeUnits: pointerCodeUnits - 1 }),
      limits({ maxAggregateRuntimeObligationCodeUnits: aggregateCodeUnits - 1 }),
    ]) {
      expectFailure(
        preflight(validSource, clone(validCatalog), profile),
        "binding-compatibility",
        EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        "",
      );
    }
  });

  it("normalizes the limit profile before observing Source or Catalog candidates", () => {
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
      ...PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
      get maxRuntimeValidationObligations() {
        return 1;
      },
    };
    expect(() => preflightPublishExecution(hostile, hostile, invalidLimits)).toThrow(TypeError);
    expect(observed).toBe(false);
  });

  it("ignores inherited lower-stage success and optional Source data", () => {
    const priorCapability = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "capabilityPreflighted",
    );
    const priorResources = Object.getOwnPropertyDescriptor(Object.prototype, "resources");
    Object.defineProperty(Object.prototype, "capabilityPreflighted", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(Object.prototype, "resources", {
      configurable: true,
      value: {
        inherited: {
          use: TASKS,
          input: { unexpected: true },
          policy: "unsupported",
        },
      },
    });
    try {
      const malformed = '{"kind":"desen.source",';
      expect(preflightPublishExecution(malformed, [candidate()])).toEqual(
        preflightPublishCapabilities(malformed, [candidate()]),
      );
      expect(isSuccess(preflight(validSource))).toBe(true);
    } finally {
      if (priorCapability === undefined) {
        Reflect.deleteProperty(Object.prototype, "capabilityPreflighted");
      } else {
        Object.defineProperty(Object.prototype, "capabilityPreflighted", priorCapability);
      }
      if (priorResources === undefined) Reflect.deleteProperty(Object.prototype, "resources");
      else Object.defineProperty(Object.prototype, "resources", priorResources);
    }
  });

  it("is deterministic across caller member order and repeated independent runs", () => {
    const first = preflight(validSource, clone(validCatalog));
    const second = preflight(
      reverseObjectMemberOrder(validSource),
      reverseObjectMemberOrder(validCatalog),
    );
    const third = preflight(clone(validSource), clone(validCatalog));
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });
});
