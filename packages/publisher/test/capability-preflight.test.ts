import { describe, expect, it } from "vitest";

import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import validCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";
import {
  validateDesenInteractionCatalogSet,
  validatePreparedDesenSourceReferences,
} from "@desen/validator";

import {
  CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  preflightPublishCapabilities,
} from "../src/capability-preflight.js";
import {
  DEPRECATED_CAPABILITY_CODE,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
  getPublisherDiagnosticDefinition,
  isPublisherDiagnosticCode,
} from "../src/publish-result.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  preflightPublishSource,
} from "../src/source-preflight.js";

import type {
  PublishCapabilityPreflightResult,
  PublishCapabilityPreflightSuccess,
} from "../src/capability-preflight.js";
import type { PublishFailure } from "../src/publish-result.js";
import type { PublishSourcePreflightLimits } from "../src/source-preflight.js";

type MutableRecord = Record<string, unknown>;

interface FailureExpectation {
  readonly code: string;
  readonly pointer?: string;
}

const SORTABLE = "com.example.interactions/Sortable";
const MAP = "com.example.maps/Map";
const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const TASK_LIST = "com.example.tasks/list";
const TASK_REORDER = "com.example.tasks/reorder";

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
  overrides: Partial<PublishSourcePreflightLimits>,
): Readonly<PublishSourcePreflightLimits> {
  return Object.freeze({ ...PUBLISH_SOURCE_PREFLIGHT_LIMITS, ...overrides });
}

function preflight(
  source: unknown,
  catalog: unknown = clone(validCatalog),
  profile: Readonly<PublishSourcePreflightLimits> = PUBLISH_SOURCE_PREFLIGHT_LIMITS,
): PublishCapabilityPreflightResult {
  return preflightPublishCapabilities(JSON.stringify(source), [candidate(catalog)], profile);
}

function isSuccess(
  result: PublishCapabilityPreflightResult,
): result is PublishCapabilityPreflightSuccess {
  return "capabilityPreflighted" in result;
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
    "obligations",
  ]) {
    expect(Object.hasOwn(result, field)).toBe(false);
  }
  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
}

function expectFailure(
  result: PublishCapabilityPreflightResult,
  expectation: FailureExpectation,
): asserts result is PublishFailure {
  expect(isSuccess(result)).toBe(false);
  if (isSuccess(result)) throw new TypeError("Expected capability preflight to fail.");
  expect(result).toMatchObject({ ok: false, stage: "capability-contracts" });
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: expectation.code,
      ...(expectation.pointer === undefined ? {} : { pointer: expectation.pointer }),
      severity: "error",
      stage: "capability-contracts",
    }),
  );
  expectNoPartialAuthority(result);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.diagnostics)).toBe(true);
  result.diagnostics.forEach((diagnostic) => expect(Object.isFrozen(diagnostic)).toBe(true));
}

function expectDeepFrozen(value: unknown, visited = new Set<object>()): void {
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeepFrozen(child, visited);
}

function diagnosticCodeUnits(
  diagnostic: PublishCapabilityPreflightSuccess["diagnostics"][number],
): number {
  const context = diagnostic.context;
  return (
    diagnostic.code.length +
    diagnostic.message.length +
    (diagnostic.pointer?.length ?? 0) +
    (context?.documentId?.length ?? 0) +
    (context?.surfaceId?.length ?? 0) +
    (context?.subject?.kind.length ?? 0) +
    (context?.subject?.id.length ?? 0) +
    (context?.capabilityId?.length ?? 0)
  );
}

function deprecatedSortableFixtures(): { readonly source: unknown; readonly catalog: unknown } {
  const source = clone(exampleSortableSource) as unknown;
  const catalog = clone(validCatalog) as unknown;

  record(valueAt(catalog, ["components", STACK])).deprecated = true;
  record(valueAt(catalog, ["components", TEXT])).deprecated = false;
  record(valueAt(catalog, ["behaviors", SORTABLE])).deprecated = "PRIVATE BEHAVIOR NOTICE";
  record(valueAt(catalog, ["behaviors", SORTABLE])).replacement = "private/replacement";
  record(valueAt(catalog, ["resources", TASK_LIST])).deprecated = true;
  record(valueAt(catalog, ["operations", TASK_REORDER])).deprecated = "PRIVATE OPERATION NOTICE";

  const action = record(
    valueAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "on", "reorder", 0]),
  );
  action.onSuccess = [
    {
      type: "operation.invoke",
      operation: TASK_REORDER,
      as: "repeatReorder",
      input: {},
    },
  ];
  return Object.freeze({ source, catalog });
}

describe("package-private capability preflight", () => {
  it("upgrades exact T03 authorities without exposing a terminal or dynamic-obligation shell", () => {
    const catalog = clone(validCatalog);
    const result = preflight(validSource, catalog);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected capability preflight to succeed.");
    expect(result).toMatchObject({
      capabilityPreflighted: true,
      diagnostics: [],
      requirementPackageIndexes: [0],
    });
    expect(result.source).toEqual(validSource);
    expect(result.catalogSet).toHaveLength(1);
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.catalog).toBe(result.catalogSet[0]);
    expect(Object.hasOwn(result, "preflighted")).toBe(false);
    expect(Object.hasOwn(result, "ok")).toBe(false);
    expect(Object.hasOwn(result, "bundle")).toBe(false);
    expect(Object.hasOwn(result, "obligations")).toBe(false);
    expect(Object.keys(result).sort()).toEqual([
      "capabilityPreflighted",
      "catalogSet",
      "diagnostics",
      "packages",
      "requirementPackageIndexes",
      "source",
    ]);

    const authenticatedAgain = validateDesenInteractionCatalogSet(result.catalogSet);
    expect(authenticatedAgain.valid).toBe(true);
    if (!authenticatedAgain.valid) throw new TypeError("Expected interaction authority.");
    expect(authenticatedAgain.value).toBe(result.catalogSet);
    const sourceAuthenticatedAgain = validatePreparedDesenSourceReferences(
      result.source,
      result.catalogSet,
    );
    expect(sourceAuthenticatedAgain.valid).toBe(true);
    if (!sourceAuthenticatedAgain.valid) throw new TypeError("Expected exact Source authority.");
    expect(sourceAuthenticatedAgain.value).toBe(result.source);
    expectDeepFrozen(result);
  });

  it("accepts official component, behavior, resource, operation, command, and dynamic examples", () => {
    for (const source of [validSource, exampleSortableSource, exampleStoreMapSource]) {
      const result = preflight(source);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected the official example to pass.");
      expect(result.diagnostics).toEqual([]);
      expect(Object.hasOwn(result, "obligations")).toBe(false);
    }
  });

  it("passes every earlier T03 failure through without stage remapping or partial authority", () => {
    const cases = [
      { raw: '{"kind":"desen.source",', candidates: [candidate()] },
      { raw: JSON.stringify(validSource), candidates: [] },
    ] as const;

    for (const testCase of cases) {
      const expected = preflightPublishSource(testCase.raw, testCase.candidates);
      const actual = preflightPublishCapabilities(testCase.raw, testCase.candidates);
      expect(actual).toEqual(expected);
      expect(isSuccess(actual)).toBe(false);
      if (isSuccess(actual)) throw new TypeError("Expected the T03 stage to fail.");
      expectNoPartialAuthority(actual);
      expect(actual.stage).not.toBe("capability-contracts");
    }
  });

  it("prepares all interaction schemas before observing Source capability contracts", () => {
    const cases = [
      {
        path: ["components", TEXT_FIELD, "events", "change", "payloadSchema"] as const,
        pointer:
          "/0/components/com.example.ui~1TextField/events/change/payloadSchema/properties/value/pattern",
      },
      {
        path: ["components", TEXT_FIELD, "commands", "focus", "inputSchema"] as const,
        pointer:
          "/0/components/com.example.ui~1TextField/commands/focus/inputSchema/properties/value/pattern",
      },
      {
        path: ["behaviors", SORTABLE, "propsSchema"] as const,
        pointer:
          "/0/behaviors/com.example.interactions~1Sortable/propsSchema/properties/value/pattern",
      },
      {
        path: ["behaviors", SORTABLE, "events", "reorder", "payloadSchema"] as const,
        pointer:
          "/0/behaviors/com.example.interactions~1Sortable/events/reorder/payloadSchema/properties/value/pattern",
      },
      {
        path: ["behaviors", SORTABLE, "commands", "probe", "inputSchema"] as const,
        pointer:
          "/0/behaviors/com.example.interactions~1Sortable/commands/probe/inputSchema/properties/value/pattern",
        addBehaviorCommand: true,
      },
      {
        path: ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"] as const,
        pointer:
          "/0/behaviors/com.example.interactions~1Sortable/styleParts/dropIndicator/propertiesSchema/properties/value/pattern",
      },
    ] as const;

    for (const testCase of cases) {
      const catalog = clone(validCatalog) as unknown;
      if ("addBehaviorCommand" in testCase) {
        record(valueAt(catalog, ["behaviors", SORTABLE])).commands = {
          probe: { inputSchema: {} },
        };
      }
      writeAt(catalog, testCase.path, {
        type: "object",
        properties: { value: { type: "string", pattern: "^(a+)+$" } },
      });

      expectFailure(preflight(validSource, catalog), {
        code: "run.desen.validator/INVALID_INTERACTION_CONTRACT",
        pointer: testCase.pointer,
      });
    }
  });

  it("blocks the full static component and interaction contract surface at stage eight", () => {
    const unknownProp = clone(validSource) as unknown;
    record(
      valueAt(unknownProp, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
    ).ghost = true;

    const requiredProp = clone(validSource) as unknown;
    Reflect.deleteProperty(
      record(valueAt(requiredProp, ["surfaces", "home", "root", "slots", "default", 0, "props"])),
      "text",
    );

    const componentProp = clone(validSource) as unknown;
    writeAt(
      componentProp,
      ["surfaces", "home", "root", "slots", "default", 0, "props", "role"],
      42,
    );

    const componentVariant = clone(validSource) as unknown;
    writeAt(
      componentVariant,
      ["surfaces", "home", "root", "slots", "default", 0, "variants"],
      [{ when: { op: "truthy", args: [true] }, props: { role: 42 } }],
    );

    const componentSlot = clone(validSource) as unknown;
    writeAt(componentSlot, ["surfaces", "home", "root", "slots", "default", 0, "slots"], {
      ghost: [],
    });

    const leafSlot = clone(validSource) as unknown;
    writeAt(leafSlot, ["surfaces", "home", "root", "slots", "default", 0, "slots"], {
      default: [
        {
          id: "home.title.child",
          use: TEXT,
          props: { text: "Child" },
        },
      ],
    });

    const requiredSlot = clone(validSource) as unknown;
    Reflect.deleteProperty(record(valueAt(requiredSlot, ["surfaces", "home", "root"])), "slots");
    const requiredSlotCatalog = clone(validCatalog) as unknown;
    writeAt(requiredSlotCatalog, ["components", STACK, "slots", "default", "required"], true);
    writeAt(requiredSlotCatalog, ["components", STACK, "slots", "default", "minItems"], 1);

    const cardinalityCatalog = clone(validCatalog) as unknown;
    writeAt(cardinalityCatalog, ["components", STACK, "slots", "default", "maxItems"], 0);

    const rejectedChildCatalog = clone(validCatalog) as unknown;
    writeAt(
      rejectedChildCatalog,
      ["components", STACK, "slots", "default", "acceptsCategories"],
      ["action"],
    );

    const componentStylePart = clone(validSource) as unknown;
    writeAt(componentStylePart, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
      base: { ghost: {} },
    });

    const componentVisualState = clone(validSource) as unknown;
    writeAt(componentVisualState, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
      ghost: { text: {} },
    });

    const componentStyleProperty = clone(validSource) as unknown;
    writeAt(componentStyleProperty, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
      base: { text: { color: 42 } },
    });
    const componentStylePropertyCatalog = clone(validCatalog) as unknown;
    writeAt(
      componentStylePropertyCatalog,
      ["components", TEXT, "styleParts", "text", "propertiesSchema"],
      {
        type: "object",
        additionalProperties: false,
        properties: { color: { type: "string" } },
      },
    );

    const behaviorProp = clone(exampleSortableSource) as unknown;
    writeAt(behaviorProp, ["surfaces", "tasks", "root", "behaviors", 0, "props", "axis"], 42);

    const behaviorSlot = clone(exampleSortableSource) as unknown;
    writeAt(behaviorSlot, ["surfaces", "tasks", "root", "behaviors", 0, "slots"], {
      ghost: [],
    });

    const behaviorEvent = clone(exampleSortableSource) as unknown;
    writeAt(behaviorEvent, ["surfaces", "tasks", "root", "behaviors", 0, "on"], { teleport: [] });

    const behaviorConflict = clone(exampleSortableSource) as unknown;
    array(valueAt(behaviorConflict, ["surfaces", "tasks", "root", "behaviors"])).push({
      id: "tasks.sort-secondary",
      use: SORTABLE,
      props: { axis: "vertical", handle: "item" },
    });

    const behaviorStyle = clone(exampleSortableSource) as unknown;
    writeAt(behaviorStyle, ["surfaces", "tasks", "root", "behaviors", 0, "style"], {
      base: { dropIndicator: { color: 42 } },
    });
    const behaviorStyleCatalog = clone(validCatalog) as unknown;
    writeAt(
      behaviorStyleCatalog,
      ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"],
      {
        type: "object",
        additionalProperties: false,
        properties: { color: { type: "string" } },
      },
    );

    const command = clone(exampleStoreMapSource) as unknown;
    writeAt(
      command,
      ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "command"],
      "teleport",
    );

    const attachmentCatalog = clone(validCatalog) as unknown;
    writeAt(attachmentCatalog, ["behaviors", SORTABLE, "attachTo"], {
      categories: ["action"],
    });

    const cases = [
      {
        source: unknownProp,
        catalog: validCatalog,
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/home/root/slots/default/0/props/ghost",
      },
      {
        source: requiredProp,
        catalog: validCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/home/root/slots/default/0/props/text",
      },
      {
        source: componentProp,
        catalog: validCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/home/root/slots/default/0/props/role",
      },
      {
        source: componentVariant,
        catalog: validCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/home/root/slots/default/0/variants/0/props/role",
      },
      {
        source: componentSlot,
        catalog: validCatalog,
        code: "UNKNOWN_SLOT",
        pointer: "/surfaces/home/root/slots/default/0/slots/ghost",
      },
      {
        source: leafSlot,
        catalog: validCatalog,
        code: "UNKNOWN_SLOT",
        pointer: "/surfaces/home/root/slots/default/0/slots/default",
      },
      {
        source: requiredSlot,
        catalog: requiredSlotCatalog,
        code: "SLOT_CARDINALITY",
        pointer: "/surfaces/home/root/slots/default",
      },
      {
        source: validSource,
        catalog: cardinalityCatalog,
        code: "SLOT_CARDINALITY",
        pointer: "/surfaces/home/root/slots/default",
      },
      {
        source: validSource,
        catalog: rejectedChildCatalog,
        code: "SLOT_CHILD_REJECTED",
        pointer: "/surfaces/home/root/slots/default/0/use",
      },
      {
        source: componentStylePart,
        catalog: validCatalog,
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/home/root/slots/default/0/style/base/ghost",
      },
      {
        source: componentVisualState,
        catalog: validCatalog,
        code: "UNKNOWN_PROP",
        pointer: "/surfaces/home/root/slots/default/0/style/ghost",
      },
      {
        source: componentStyleProperty,
        catalog: componentStylePropertyCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/home/root/slots/default/0/style/base/text/color",
      },
      {
        source: behaviorProp,
        catalog: validCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/tasks/root/behaviors/0/props/axis",
      },
      {
        source: behaviorSlot,
        catalog: validCatalog,
        code: "UNKNOWN_SLOT",
        pointer: "/surfaces/tasks/root/behaviors/0/slots/ghost",
      },
      {
        source: behaviorEvent,
        catalog: validCatalog,
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/tasks/root/behaviors/0/on/teleport",
      },
      {
        source: behaviorConflict,
        catalog: validCatalog,
        code: "BEHAVIOR_CONFLICT",
        pointer: "/surfaces/tasks/root/behaviors/1/use",
      },
      {
        source: behaviorStyle,
        catalog: behaviorStyleCatalog,
        code: "PROP_TYPE_MISMATCH",
        pointer: "/surfaces/tasks/root/behaviors/0/style/base/dropIndicator/color",
      },
      {
        source: sourceUnknownEvent,
        catalog: validCatalog,
        code: "UNKNOWN_EVENT",
        pointer: "/surfaces/home/root/slots/default/0/on/teleport",
      },
      {
        source: command,
        catalog: validCatalog,
        code: "UNKNOWN_COMMAND",
        pointer: "/surfaces/stores/root/slots/default/1/on/press/0/command",
      },
      {
        source: exampleSortableSource,
        catalog: attachmentCatalog,
        code: "BEHAVIOR_ATTACHMENT_INVALID",
        pointer: "/surfaces/tasks/root/behaviors/0/use",
      },
    ] as const;

    for (const testCase of cases) {
      expectFailure(preflight(testCase.source, testCase.catalog), testCase);
    }
  });

  it("honors an exact slot accepts ID independently of category acceptance", () => {
    const source = clone(validSource) as unknown;
    writeAt(source, ["entry"], "home");
    writeAt(source, ["surfaces"], {
      home: valueAt(source, ["surfaces", "home"]),
    });
    const catalog = clone(validCatalog) as unknown;
    writeAt(catalog, ["components", STACK, "slots", "default", "accepts"], [TEXT]);
    writeAt(catalog, ["components", STACK, "slots", "default", "acceptsCategories"], ["action"]);

    const result = preflight(source, catalog);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected exact accepted child ID to pass.");
    expect(result.diagnostics).toEqual([]);
  });

  it("pins the public deprecated warning definition, guard, lookup, and immutability", () => {
    expect(PUBLISHER_DIAGNOSTIC_REGISTRY).toContainEqual({
      code: DEPRECATED_CAPABILITY_CODE,
      meaning: "Source data uses a deprecated Catalog capability.",
      defaultStage: "capability-contracts",
      defaultSeverity: "warning",
    });
    expect(isPublisherDiagnosticCode(DEPRECATED_CAPABILITY_CODE)).toBe(true);
    expect(isPublisherDiagnosticCode("run.desen.publisher/UNKNOWN")).toBe(false);
    expect(getPublisherDiagnosticDefinition(DEPRECATED_CAPABILITY_CODE)).toEqual({
      code: DEPRECATED_CAPABILITY_CODE,
      meaning: "Source data uses a deprecated Catalog capability.",
      defaultStage: "capability-contracts",
      defaultSeverity: "warning",
    });
    expect(getPublisherDiagnosticDefinition("UNKNOWN")).toBeUndefined();
    expect(Object.isFrozen(PUBLISHER_DIAGNOSTIC_REGISTRY)).toBe(true);
    const definition = getPublisherDiagnosticDefinition(DEPRECATED_CAPABILITY_CODE);
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it("ignores inherited optional values without creating phantom capability use sites", () => {
    const operationAction = {
      type: "operation.invoke",
      operation: TASK_REORDER,
      as: "prototype.operation",
      input: {},
    } as const;
    const cases = [
      {
        key: "deprecated",
        value: true,
        source: validSource,
        catalog: validCatalog,
        expectedPointers: [],
      },
      {
        key: "behaviors",
        value: [{ id: "prototype.behavior", use: SORTABLE, props: { axis: "vertical" } }],
        source: validSource,
        catalogMutation: ["behaviors", SORTABLE] as const,
        expectedPointers: [],
      },
      {
        key: "on",
        value: { polluted: [operationAction] },
        source: validSource,
        catalogMutation: ["operations", TASK_REORDER] as const,
        expectedPointers: [],
      },
      {
        key: "slots",
        value: {
          polluted: [{ id: "prototype.node", use: MAP, props: {} }],
        },
        source: validSource,
        catalogMutation: ["components", MAP] as const,
        expectedPointers: [],
      },
      {
        key: "onSuccess",
        value: [operationAction],
        source: exampleSortableSource,
        catalogMutation: ["operations", TASK_REORDER] as const,
        expectedPointers: ["/surfaces/tasks/root/behaviors/0/on/reorder/0/operation"],
      },
      {
        key: "onFailure",
        value: [operationAction],
        source: exampleSortableSource,
        catalogMutation: ["operations", TASK_REORDER] as const,
        expectedPointers: ["/surfaces/tasks/root/behaviors/0/on/reorder/0/operation"],
      },
    ] as const;

    for (const testCase of cases) {
      const catalog = clone("catalog" in testCase ? testCase.catalog : validCatalog) as unknown;
      if ("catalogMutation" in testCase) {
        record(valueAt(catalog, testCase.catalogMutation)).deprecated = true;
      }
      const prior = Object.getOwnPropertyDescriptor(Object.prototype, testCase.key);
      let result: PublishCapabilityPreflightResult;
      Object.defineProperty(Object.prototype, testCase.key, {
        configurable: true,
        value: testCase.value,
        writable: true,
      });
      try {
        result = preflight(testCase.source, catalog);
      } finally {
        if (prior === undefined) Reflect.deleteProperty(Object.prototype, testCase.key);
        else Object.defineProperty(Object.prototype, testCase.key, prior);
      }

      expect(isSuccess(result), testCase.key).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected inherited values to be ignored.");
      expect(
        result.diagnostics.map((diagnostic) => diagnostic.pointer),
        testCase.key,
      ).toEqual(testCase.expectedPointers);
    }
  });

  it("does not accept an inherited lower-stage success discriminator", () => {
    const baseline = preflightPublishCapabilities('{"kind":"desen.source",', [candidate()]);
    const prior = Object.getOwnPropertyDescriptor(Object.prototype, "preflighted");
    let polluted: PublishCapabilityPreflightResult;
    Object.defineProperty(Object.prototype, "preflighted", {
      configurable: true,
      value: true,
      writable: true,
    });
    try {
      polluted = preflightPublishCapabilities('{"kind":"desen.source",', [candidate()]);
    } finally {
      if (prior === undefined) Reflect.deleteProperty(Object.prototype, "preflighted");
      else Object.defineProperty(Object.prototype, "preflighted", prior);
    }

    expect(polluted).toEqual(baseline);
    expect(isSuccess(polluted)).toBe(false);
    if (isSuccess(polluted)) throw new TypeError("Expected inherited discriminator rejection.");
    expect(polluted.stage).toBe("json-parse");
    expectNoPartialAuthority(polluted);
  });

  it("emits fixed, deterministic warnings for exact deprecated use sites including nested actions", () => {
    const { source, catalog } = deprecatedSortableFixtures();
    const result = preflight(source, catalog);

    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result))
      throw new TypeError("Expected deprecation warnings to be non-blocking.");
    expect(result.diagnostics).toHaveLength(5);
    expect(result.diagnostics.map((diagnostic) => diagnostic.pointer)).toEqual([
      "/surfaces/tasks/resources/tasks/use",
      "/surfaces/tasks/root/behaviors/0/on/reorder/0/onSuccess/0/operation",
      "/surfaces/tasks/root/behaviors/0/on/reorder/0/operation",
      "/surfaces/tasks/root/behaviors/0/use",
      "/surfaces/tasks/root/use",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.context)).toEqual([
      {
        documentId: "com.example.task-list",
        surfaceId: "tasks",
        capabilityId: TASK_LIST,
      },
      {
        documentId: "com.example.task-list",
        surfaceId: "tasks",
        subject: { kind: "behavior", id: "tasks.sort" },
        capabilityId: TASK_REORDER,
      },
      {
        documentId: "com.example.task-list",
        surfaceId: "tasks",
        subject: { kind: "behavior", id: "tasks.sort" },
        capabilityId: TASK_REORDER,
      },
      {
        documentId: "com.example.task-list",
        surfaceId: "tasks",
        subject: { kind: "behavior", id: "tasks.sort" },
        capabilityId: SORTABLE,
      },
      {
        documentId: "com.example.task-list",
        surfaceId: "tasks",
        subject: { kind: "node", id: "tasks.list" },
        capabilityId: STACK,
      },
    ]);
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic).toMatchObject({
        code: DEPRECATED_CAPABILITY_CODE,
        message: "Source data uses a deprecated Catalog capability.",
        stage: "capability-contracts",
        severity: "warning",
      });
      expect(diagnostic.message).not.toContain("PRIVATE");
      expect(JSON.stringify(diagnostic)).not.toContain("private/replacement");
      expect(Object.isFrozen(diagnostic)).toBe(true);
      expect(Object.isFrozen(diagnostic.context)).toBe(true);
      if (diagnostic.context?.subject !== undefined) {
        expect(Object.isFrozen(diagnostic.context.subject)).toBe(true);
      }
    }
    expect(Object.isFrozen(result.diagnostics)).toBe(true);

    const second = preflight(clone(source), clone(catalog));
    expect(second).toEqual(result);
  });

  it("does not warn for false deprecations and suppresses all warning discovery after a static error", () => {
    const falseCatalog = clone(validCatalog) as unknown;
    record(valueAt(falseCatalog, ["components", TEXT])).deprecated = false;
    const passing = preflight(validSource, falseCatalog);
    expect(isSuccess(passing)).toBe(true);
    if (!isSuccess(passing)) throw new TypeError("Expected false deprecation to pass.");
    expect(passing.diagnostics).toEqual([]);

    record(valueAt(falseCatalog, ["components", TEXT])).deprecated = "PRIVATE NOTICE";
    const failing = preflight(sourceUnknownEvent, falseCatalog);
    expectFailure(failing, {
      code: "UNKNOWN_EVENT",
      pointer: "/surfaces/home/root/slots/default/0/on/teleport",
    });
    expect(failing.diagnostics.some((diagnostic) => diagnostic.severity === "warning")).toBe(false);
    expect(JSON.stringify(failing)).not.toContain("PRIVATE NOTICE");
  });

  it("enforces warning count, pointer, and aggregate budgets at exact boundaries", () => {
    const { source, catalog } = deprecatedSortableFixtures();
    const unbounded = preflight(source, catalog);
    expect(isSuccess(unbounded)).toBe(true);
    if (!isSuccess(unbounded)) throw new TypeError("Expected warning fixture to pass.");

    const warningCount = unbounded.diagnostics.length;
    const longestPointer = Math.max(
      ...unbounded.diagnostics.map((diagnostic) => diagnostic.pointer?.length ?? 0),
    );
    const aggregateCodeUnits = unbounded.diagnostics.reduce(
      (total, diagnostic) => total + diagnosticCodeUnits(diagnostic),
      0,
    );

    const exactProfiles = [
      limits({ maxDiagnosticsPerStoppedStage: warningCount }),
      limits({ maxDiagnosticPointerCodeUnits: longestPointer }),
      limits({ maxAggregateDiagnosticCodeUnits: aggregateCodeUnits }),
    ];
    for (const profile of exactProfiles) {
      const result = preflight(source, catalog, profile);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) throw new TypeError("Expected exact warning budget to pass.");
      expect(result.diagnostics).toEqual(unbounded.diagnostics);
    }

    const exceededProfiles = [
      limits({ maxDiagnosticsPerStoppedStage: warningCount - 1 }),
      limits({ maxDiagnosticPointerCodeUnits: longestPointer - 1 }),
      limits({ maxAggregateDiagnosticCodeUnits: aggregateCodeUnits - 1 }),
    ];
    for (const profile of exceededProfiles) {
      expectFailure(preflight(source, catalog, profile), {
        code: CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        pointer: "",
      });
    }
  });

  it("replaces an over-budget Validator error report with one redacted stage-eight error", () => {
    const invalid = clone(validSource) as unknown;
    writeAt(invalid, ["surfaces", "home", "root", "slots", "default", 0, "props"], {
      text: 42,
      role: 42,
      ghost: true,
    });
    expectFailure(
      preflight(
        invalid,
        validCatalog,
        limits({
          maxDiagnosticsPerStoppedStage: 1,
        }),
      ),
      {
        code: CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        pointer: "",
      },
    );
  });

  it("retains T05 dynamic values as unexposed later-stage work without guessing compatibility", () => {
    const dynamic = clone(validSource) as unknown;
    writeAt(dynamic, ["surfaces", "home", "root", "slots", "default", 0, "props", "text"], {
      $format: { template: "{value}", values: { value: { $ref: "state.future" } } },
    });

    const result = preflight(dynamic);
    expect(isSuccess(result)).toBe(true);
    if (!isSuccess(result)) throw new TypeError("Expected dynamic value to remain deferred.");
    expect(result.diagnostics).toEqual([]);
    expect(Object.hasOwn(result, "obligations")).toBe(false);
  });
});
