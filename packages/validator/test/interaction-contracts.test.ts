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
import { validateDesenComponentCatalogSet } from "../src/component-contract-validation.js";
import {
  EVENT_PAYLOAD_SAFETY_LIMITS,
  INVALID_INTERACTION_CONTRACT_CODE,
  validateDesenBundleInteractionContracts,
  validateDesenEventPayload,
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
  readonly obligations?: readonly ObligationLike[];
  readonly value?: unknown;
}

interface EventSelector {
  readonly capabilityKind: "behavior" | "component";
  readonly capabilityId: string;
  readonly eventName: string;
}

const STACK = "com.example.ui/Stack";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const TEXT = "com.example.ui/Text";
const SORTABLE = "com.example.interactions/Sortable";
const SIGN_IN_OPERATION = "com.example.auth/signIn";
const INVALID_INTERACTION_CONTRACT = "run.desen.validator/INVALID_INTERACTION_CONTRACT";

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

function expectDiagnosticCode(result: ResultLike, code: string): void {
  expect(result.valid).toBe(false);
  expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
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

function withObjectPrototypeProperty<Value>(property: string, value: Value, run: () => void): void {
  const priorDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, property);
  Object.defineProperty(Object.prototype, property, { configurable: true, value });
  try {
    run();
  } finally {
    if (priorDescriptor === undefined) Reflect.deleteProperty(Object.prototype, property);
    else Object.defineProperty(Object.prototype, property, priorDescriptor);
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

function node(id: string, use: string, props?: MutableRecord): MutableRecord {
  return { id, use, ...(props === undefined ? {} : { props }) };
}

function behaviorInstance(id: string, use = SORTABLE): MutableRecord {
  return { id, use };
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

function behavior(catalog: unknown, capabilityId = SORTABLE): MutableRecord {
  return recordAt(catalog, ["behaviors", capabilityId]);
}

function addBehavior(
  catalog: unknown,
  capabilityId: string,
  options: {
    readonly channels?: readonly string[];
    readonly compatibleWith?: readonly string[];
    readonly attachTo?: MutableRecord;
    readonly commands?: MutableRecord;
  } = {},
): MutableRecord {
  const contract: MutableRecord = {
    propsSchema: { type: "object", additionalProperties: false },
    attachTo: options.attachTo ?? { categories: ["layout"] },
  };
  if (options.channels !== undefined || options.compatibleWith !== undefined) {
    contract.composition = {
      ...(options.channels === undefined ? {} : { exclusiveChannels: [...options.channels] }),
      ...(options.compatibleWith === undefined
        ? {}
        : { compatibleWith: [...options.compatibleWith] }),
    };
  }
  if (options.commands !== undefined) contract.commands = options.commands;
  recordAt(catalog, ["behaviors"])[capabilityId] = contract;
  return contract;
}

function nestedNotSchema(depth: number): unknown {
  let schema: unknown = true;
  for (let index = 0; index < depth; index += 1) schema = { not: schema };
  return schema;
}

function interactionCatalogSet(catalogs: readonly unknown[] = [validCatalog]) {
  const result = validateDesenInteractionCatalogSet(catalogs);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected interaction catalog preparation to pass.");
  return result.value;
}

function validateSource(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenSourceInteractionContracts(input, interactionCatalogSet(catalogs));
}

function validateBundle(input: unknown, catalogs: readonly unknown[] = [validCatalog]) {
  return validateDesenBundleInteractionContracts(input, interactionCatalogSet(catalogs));
}

function validateEvent(
  payload: unknown,
  selector: EventSelector,
  catalogs: readonly unknown[] = [validCatalog],
) {
  return validateDesenEventPayload(payload, selector, interactionCatalogSet(catalogs));
}

function sourceWithBehavior(
  instance: MutableRecord,
  owner: MutableRecord = node("layout", STACK, { direction: "vertical" }),
): unknown {
  owner.behaviors = [instance];
  return minimalSource(owner);
}

function commandSource(action: MutableRecord): unknown {
  const actor = node("actor", BUTTON, { label: "Run" });
  actor.on = { press: [action] };
  const target = node("field", TEXT_FIELD, { label: "Name", value: "" });
  const root = node("layout", STACK, { direction: "vertical" });
  root.slots = { default: [actor, target] };
  return minimalSource(root);
}

describe("M02-T09 cumulative boundary and frozen corpus", () => {
  it("accepts the frozen valid roots and interaction examples", () => {
    expect(validateSource(validSource).valid).toBe(true);
    expect(validateBundle(validBundle).valid).toBe(true);
    expect(validateSource(exampleSortableSource, [exampleCatalog]).valid).toBe(true);
    expect(validateSource(exampleStoreMapSource, [exampleCatalog]).valid).toBe(true);
  });

  it("preserves T06, T07, and T08 failures before interaction checks", () => {
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

    const invalidComponent = minimalSource(node("button", BUTTON, { label: 42 }));
    expectOnlyDiagnostic(
      validateSource(invalidComponent),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/props/label",
    );
  });

  it("carries forward the shared node/behavior identity rule owned by R-069", () => {
    const source = cloneFixture(exampleSortableSource) as unknown;
    writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "id"], "tasks.list");
    expectOnlyDiagnostic(
      validateSource(source, [exampleCatalog]),
      "DUPLICATE_NODE_ID",
      "/surfaces/tasks/root/behaviors/0/id",
    );
  });

  it("rejects a genuine lower-stage catalog set passed through a forged T09 brand", () => {
    const lowerStage = validateDesenComponentCatalogSet([validCatalog]);
    expect(lowerStage.valid).toBe(true);
    if (!lowerStage.valid) throw new TypeError("Expected T08 catalog preparation to pass.");

    expectOnlyDiagnostic(
      validateDesenSourceInteractionContracts(validSource, lowerStage.value as never),
      INVALID_INTERACTION_CONTRACT,
      "/catalogs",
    );
  });

  it("rejects the official unknown-event vector at its exact frozen pointer", () => {
    expectOnlyDiagnostic(
      validateSource(sourceUnknownEvent),
      "UNKNOWN_EVENT",
      "/surfaces/home/root/slots/default/0/on/teleport",
    );
  });

  it("retains T08 and behavior obligations in one sorted immutable result", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    writeAt(catalog, ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"], {
      type: "object",
      additionalProperties: false,
      properties: { color: { type: "string" } },
    });
    const source = cloneFixture(validSource) as unknown;
    writeAt(
      source,
      ["surfaces", "sign-in", "root", "behaviors"],
      [
        {
          id: "sign-in.sort",
          use: SORTABLE,
          props: { axis: { $ref: "state.axis", fallback: "vertical" } },
          style: {
            base: { dropIndicator: { color: { $token: "color.drag.indicator" } } },
          },
        },
      ],
    );

    const result = validateSource(source, [catalog]);
    expect(result.valid).toBe(true);
    expect(result.obligations.map(({ kind, pointer }) => ({ kind, pointer }))).toEqual([
      {
        kind: "behavior-prop",
        pointer: "/surfaces/sign-in/root/behaviors/0/props/axis",
      },
      {
        kind: "behavior-style-part-property",
        pointer: "/surfaces/sign-in/root/behaviors/0/style/base/dropIndicator/color",
      },
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
    expectDeepFrozen(result);
  });

  it("keeps revision integrity outside T09", () => {
    expect(validateBundle(bundleRevisionMismatch).valid).toBe(true);
  });
});

describe("M02-T09 behavior props, styles, states, and slots", () => {
  it("validates behavior props and records dynamic siblings despite static failures", () => {
    const unknown = behaviorInstance("sort");
    unknown.props = { axis: "vertical", ghost: true };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(unknown)),
      "UNKNOWN_PROP",
      "/surfaces/main/root/behaviors/0/props/ghost",
    );

    const mismatch = behaviorInstance("sort");
    mismatch.props = { axis: 42 };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(mismatch)),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/behaviors/0/props/axis",
    );

    const catalog = cloneFixture(validCatalog) as unknown;
    behavior(catalog).propsSchema = {
      type: "object",
      additionalProperties: false,
      required: ["axis", "handle"],
      properties: {
        axis: { enum: ["vertical", "horizontal", "both"] },
        handle: { enum: ["item", "explicit"] },
      },
    };
    const dynamic = behaviorInstance("sort");
    dynamic.props = {
      axis: { $ref: "state.axis", fallback: "vertical" },
      handle: "wrong",
    };
    const dynamicResult = validateSource(sourceWithBehavior(dynamic), [catalog]);
    expectOnlyDiagnostic(
      dynamicResult,
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/behaviors/0/props/handle",
    );
    expect(dynamicResult.obligations).toMatchObject([
      {
        kind: "behavior-prop",
        pointer: "/surfaces/main/root/behaviors/0/props/axis",
      },
    ]);
  });

  it("checks behavior visual states, parts, properties, and dynamic values", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    writeAt(catalog, ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"], {
      type: "object",
      additionalProperties: false,
      required: ["color"],
      properties: { color: { type: "string" } },
    });

    const passing = behaviorInstance("sort");
    passing.style = {
      base: { dropIndicator: { color: "blue" } },
      dragging: { dropIndicator: { color: "red" } },
    };
    expect(validateSource(sourceWithBehavior(passing), [catalog]).valid).toBe(true);

    const unknownState = behaviorInstance("sort");
    unknownState.style = { ghost: { dropIndicator: { color: "red" } } };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(unknownState), [catalog]),
      "UNKNOWN_PROP",
      "/surfaces/main/root/behaviors/0/style/ghost",
    );

    const unknownPart = behaviorInstance("sort");
    unknownPart.style = { base: { privatePart: {} } };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(unknownPart), [catalog]),
      "UNKNOWN_PROP",
      "/surfaces/main/root/behaviors/0/style/base/privatePart",
    );

    const inheritedPart = behaviorInstance("sort");
    inheritedPart.style = { base: { toString: {} } };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(inheritedPart), [catalog]),
      "UNKNOWN_PROP",
      "/surfaces/main/root/behaviors/0/style/base/toString",
    );

    const mismatch = behaviorInstance("sort");
    mismatch.style = { base: { dropIndicator: { color: 42 } } };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(mismatch), [catalog]),
      "PROP_TYPE_MISMATCH",
      "/surfaces/main/root/behaviors/0/style/base/dropIndicator/color",
    );

    const dynamic = behaviorInstance("sort");
    dynamic.style = {
      base: { dropIndicator: { color: { $token: "color.drag.indicator" } } },
    };
    const result = validateSource(sourceWithBehavior(dynamic), [catalog]);
    expect(result.valid).toBe(true);
    expect(result.obligations).toMatchObject([
      {
        kind: "behavior-style-part-property",
        pointer: "/surfaces/main/root/behaviors/0/style/base/dropIndicator/color",
      },
    ]);
  });

  it("ignores inherited visual-state declarations on capabilities that omit them", () => {
    withObjectPrototypeProperty("visualStates", ["ghost"], () => {
      const component = node("layout", STACK, { direction: "vertical" });
      component.style = { ghost: { root: {} } };
      expectOnlyDiagnostic(
        validateSource(minimalSource(component)),
        "UNKNOWN_PROP",
        "/surfaces/main/root/style/ghost",
      );
    });
  });

  it("enforces unknown, required, minimum, and maximum behavior slots", () => {
    const unknown = behaviorInstance("sort");
    unknown.slots = { ghost: [] };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(unknown)),
      "UNKNOWN_SLOT",
      "/surfaces/main/root/behaviors/0/slots/ghost",
    );

    const inherited = behaviorInstance("sort");
    inherited.slots = { toString: [] };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(inherited)),
      "UNKNOWN_SLOT",
      "/surfaces/main/root/behaviors/0/slots/toString",
    );

    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = recordAt(catalog, ["behaviors", SORTABLE, "slots", "dragPreview"]);
    slot.required = true;
    slot.minItems = 1;
    slot.maxItems = 1;

    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(behaviorInstance("sort")), [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/behaviors/0/slots/dragPreview",
    );

    const tooMany = behaviorInstance("sort");
    tooMany.slots = {
      dragPreview: [
        node("preview-one", TEXT, { text: "One" }),
        node("preview-two", TEXT, { text: "Two" }),
      ],
    };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(tooMany), [catalog]),
      "SLOT_CARDINALITY",
      "/surfaces/main/root/behaviors/0/slots/dragPreview",
    );
  });

  it("applies exact-ID/category OR acceptance and a present empty reject-all union", () => {
    const exactCatalog = cloneFixture(validCatalog) as unknown;
    const exactSlot = recordAt(exactCatalog, ["behaviors", SORTABLE, "slots", "dragPreview"]);
    exactSlot.accepts = [BUTTON];
    delete exactSlot.acceptsCategories;
    const exact = behaviorInstance("sort");
    exact.slots = { dragPreview: [node("preview", BUTTON, { label: "Preview" })] };
    expect(validateSource(sourceWithBehavior(exact), [exactCatalog]).valid).toBe(true);

    const categoryCatalog = cloneFixture(exactCatalog);
    const categorySlot = recordAt(categoryCatalog, ["behaviors", SORTABLE, "slots", "dragPreview"]);
    categorySlot.accepts = [BUTTON];
    categorySlot.acceptsCategories = ["content"];
    const category = behaviorInstance("sort");
    category.slots = { dragPreview: [node("preview", TEXT, { text: "Preview" })] };
    expect(validateSource(sourceWithBehavior(category), [categoryCatalog]).valid).toBe(true);

    const emptyCatalog = cloneFixture(categoryCatalog);
    const emptySlot = recordAt(emptyCatalog, ["behaviors", SORTABLE, "slots", "dragPreview"]);
    emptySlot.accepts = [];
    emptySlot.acceptsCategories = [];
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(category), [emptyCatalog]),
      "SLOT_CHILD_REJECTED",
      "/surfaces/main/root/behaviors/0/slots/dragPreview/0/use",
    );
  });

  it("rejects impossible behavior slot ranges during catalog preparation", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    const slot = recordAt(catalog, ["behaviors", SORTABLE, "slots", "dragPreview"]);
    slot.required = true;
    delete slot.minItems;
    slot.maxItems = 0;

    expectOnlyDiagnostic(
      validateDesenInteractionCatalogSet([catalog]),
      INVALID_INTERACTION_CONTRACT,
      "/0/behaviors/com.example.interactions~1Sortable/slots/dragPreview",
    );
  });
});

describe("M02-T09 behavior attachment", () => {
  it("accepts exact capability, category, and exact OR-union matches", () => {
    const exactCatalog = cloneFixture(validCatalog) as unknown;
    behavior(exactCatalog).attachTo = { capabilities: [STACK] };
    expect(validateSource(sourceWithBehavior(behaviorInstance("sort")), [exactCatalog]).valid).toBe(
      true,
    );

    const categoryCatalog = cloneFixture(validCatalog) as unknown;
    behavior(categoryCatalog).attachTo = { categories: ["layout"] };
    expect(
      validateSource(sourceWithBehavior(behaviorInstance("sort")), [categoryCatalog]).valid,
    ).toBe(true);

    const unionCatalog = cloneFixture(validCatalog) as unknown;
    behavior(unionCatalog).attachTo = {
      capabilities: [BUTTON],
      categories: ["layout"],
    };
    expect(validateSource(sourceWithBehavior(behaviorInstance("sort")), [unionCatalog]).valid).toBe(
      true,
    );
  });

  it("rejects wrong categories and present empty attachment unions", () => {
    const wrongCatalog = cloneFixture(validCatalog) as unknown;
    behavior(wrongCatalog).attachTo = { categories: ["action"] };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(behaviorInstance("sort")), [wrongCatalog]),
      "BEHAVIOR_ATTACHMENT_INVALID",
      "/surfaces/main/root/behaviors/0/use",
    );

    const emptyCatalog = cloneFixture(validCatalog) as unknown;
    behavior(emptyCatalog).attachTo = { capabilities: [] };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(behaviorInstance("sort")), [emptyCatalog]),
      "BEHAVIOR_ATTACHMENT_INVALID",
      "/surfaces/main/root/behaviors/0/use",
    );
  });
});

describe("M02-T09 mutual behavior conflict profile", () => {
  const firstId = "com.example.interactions/First";
  const secondId = "com.example.interactions/Second";
  const thirdId = "com.example.interactions/Third";

  function conflictSource(...capabilityIds: readonly string[]): unknown {
    const root = node("layout", STACK, { direction: "vertical" });
    root.behaviors = capabilityIds.map((use, index) =>
      behaviorInstance(`behavior-${String(index + 1)}`, use),
    );
    return minimalSource(root);
  }

  it("accepts disjoint exclusive channels", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    addBehavior(catalog, firstId, { channels: ["pointer-drag"] });
    addBehavior(catalog, secondId, { channels: ["keyboard-focus"] });
    expect(validateSource(conflictSource(firstId, secondId), [catalog]).valid).toBe(true);
  });

  it("rejects a shared channel without compatibility at the later attachment", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    addBehavior(catalog, firstId, { channels: ["pointer-drag"] });
    addBehavior(catalog, secondId, { channels: ["pointer-drag"] });
    expectOnlyDiagnostic(
      validateSource(conflictSource(firstId, secondId), [catalog]),
      "BEHAVIOR_CONFLICT",
      "/surfaces/main/root/behaviors/1/use",
    );
  });

  it("rejects unilateral compatibility and accepts mutual compatibility", () => {
    const unilateral = cloneFixture(validCatalog) as unknown;
    addBehavior(unilateral, firstId, {
      channels: ["pointer-drag"],
      compatibleWith: [secondId],
    });
    addBehavior(unilateral, secondId, { channels: ["pointer-drag"] });
    expectOnlyDiagnostic(
      validateSource(conflictSource(firstId, secondId), [unilateral]),
      "BEHAVIOR_CONFLICT",
      "/surfaces/main/root/behaviors/1/use",
    );

    const mutual = cloneFixture(unilateral);
    writeAt(mutual, ["behaviors", secondId, "composition", "compatibleWith"], [firstId]);
    expect(validateSource(conflictSource(firstId, secondId), [mutual]).valid).toBe(true);
  });

  it("requires explicit self compatibility for two instances of one capability", () => {
    const conflicting = cloneFixture(validCatalog) as unknown;
    addBehavior(conflicting, firstId, { channels: ["pointer-drag"] });
    expectOnlyDiagnostic(
      validateSource(conflictSource(firstId, firstId), [conflicting]),
      "BEHAVIOR_CONFLICT",
      "/surfaces/main/root/behaviors/1/use",
    );

    const compatible = cloneFixture(conflicting);
    writeAt(compatible, ["behaviors", firstId, "composition", "compatibleWith"], [firstId]);
    expect(validateSource(conflictSource(firstId, firstId), [compatible]).valid).toBe(true);
  });

  it("finds the missing edge in a three-behavior compatibility graph deterministically", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    addBehavior(catalog, firstId, {
      channels: ["pointer-drag"],
      compatibleWith: [secondId],
    });
    addBehavior(catalog, secondId, {
      channels: ["pointer-drag"],
      compatibleWith: [firstId, thirdId],
    });
    addBehavior(catalog, thirdId, {
      channels: ["pointer-drag"],
      compatibleWith: [secondId],
    });
    expectOnlyDiagnostic(
      validateSource(conflictSource(firstId, secondId, thirdId), [catalog]),
      "BEHAVIOR_CONFLICT",
      "/surfaces/main/root/behaviors/2/use",
    );
  });
});

describe("M02-T09 component and behavior events", () => {
  it("accepts declared handlers and rejects component events case-sensitively", () => {
    const passing = node("field", TEXT_FIELD, { label: "Name", value: "" });
    passing.on = { change: [] };
    expect(validateSource(minimalSource(passing)).valid).toBe(true);

    const unknown = cloneFixture(passing);
    unknown.on = { Change: [] };
    expectOnlyDiagnostic(
      validateSource(minimalSource(unknown)),
      "UNKNOWN_EVENT",
      "/surfaces/main/root/on/Change",
    );
  });

  it("accepts declared behavior handlers and rejects unknown behavior events", () => {
    const passing = behaviorInstance("sort");
    passing.on = { reorder: [] };
    expect(validateSource(sourceWithBehavior(passing)).valid).toBe(true);

    const unknown = behaviorInstance("sort");
    unknown.on = { teleport: [] };
    expectOnlyDiagnostic(
      validateSource(sourceWithBehavior(unknown)),
      "UNKNOWN_EVENT",
      "/surfaces/main/root/behaviors/0/on/teleport",
    );
  });

  it("does not inherit event declarations from object prototypes", () => {
    const component = node("field", TEXT_FIELD, { label: "Name", value: "" });
    component.on = { toString: [] };
    expectOnlyDiagnostic(
      validateSource(minimalSource(component)),
      "UNKNOWN_EVENT",
      "/surfaces/main/root/on/toString",
    );
  });

  it("ignores an inherited event map when a capability omits events", () => {
    withObjectPrototypeProperty("events", { ghost: { payloadSchema: {} } }, () => {
      const component = node("layout", STACK, { direction: "vertical" });
      component.on = { ghost: [] };
      expectOnlyDiagnostic(
        validateSource(minimalSource(component)),
        "UNKNOWN_EVENT",
        "/surfaces/main/root/on/ghost",
      );
      expectOnlyDiagnostic(
        validateEvent({}, { capabilityKind: "component", capabilityId: STACK, eventName: "ghost" }),
        "UNKNOWN_EVENT",
        "",
      );
    });
  });
});

describe("M02-T09 known-target command names and T11 fences", () => {
  it("accepts a declared command on a forward-declared target", () => {
    expect(
      validateSource(
        commandSource({
          type: "component.command",
          target: "field",
          command: "focus",
          input: {},
        }),
      ).valid,
    ).toBe(true);
  });

  it("rejects an unknown command when its target is known", () => {
    expectOnlyDiagnostic(
      validateSource(
        commandSource({
          type: "component.command",
          target: "field",
          command: "teleport",
          input: {},
        }),
      ),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/slots/default/0/on/press/0/command",
    );
  });

  it("does not inherit command declarations from object prototypes", () => {
    expectOnlyDiagnostic(
      validateSource(
        commandSource({
          type: "component.command",
          target: "field",
          command: "toString",
          input: {},
        }),
      ),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/slots/default/0/on/press/0/command",
    );
  });

  it("ignores an inherited command map when a capability omits commands", () => {
    withObjectPrototypeProperty("commands", { ghost: { inputSchema: {} } }, () => {
      expectOnlyDiagnostic(
        validateSource(
          commandSource({
            type: "component.command",
            target: "layout",
            command: "ghost",
            input: {},
          }),
        ),
        "UNKNOWN_COMMAND",
        "/surfaces/main/root/slots/default/0/on/press/0/command",
      );
    });
  });

  it("walks nested settlement actions after building the complete target index", () => {
    expectOnlyDiagnostic(
      validateSource(
        commandSource({
          type: "operation.invoke",
          operation: SIGN_IN_OPERATION,
          as: "signIn",
          input: {},
          onSuccess: [
            {
              type: "component.command",
              target: "field",
              command: "teleport",
              input: {},
            },
          ],
        }),
      ),
      "UNKNOWN_COMMAND",
      "/surfaces/main/root/slots/default/0/on/press/0/onSuccess/0/command",
    );
  });

  it("leaves missing targets and command input mismatches to T11", () => {
    const missingTarget = commandSource({
      type: "component.command",
      target: "missing",
      command: "teleport",
      input: { arbitrary: true },
    });
    expect(validateSource(missingTarget).valid).toBe(true);

    const invalidInput = commandSource({
      type: "component.command",
      target: "field",
      command: "focus",
      input: { unexpected: true },
    });
    expect(validateSource(invalidInput).valid).toBe(true);
  });
});

describe("M02-T09 resolved event payload contracts", () => {
  it("validates component and behavior payloads at value-relative pointers", () => {
    const componentSelector: EventSelector = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      eventName: "change",
    };
    const validComponent = validateEvent({ value: "Selman" }, componentSelector);
    expect(validComponent.valid).toBe(true);
    expect(validComponent.target).toBe("event-payload");

    expectOnlyDiagnostic(
      validateEvent({ value: 42 }, componentSelector),
      "EVENT_PAYLOAD_INVALID",
      "/value",
    );

    const behaviorSelector: EventSelector = {
      capabilityKind: "behavior",
      capabilityId: SORTABLE,
      eventName: "reorder",
    };
    expect(
      validateEvent({ fromIndex: 0, toIndex: 1, itemKey: "task-1" }, behaviorSelector).valid,
    ).toBe(true);
    expectOnlyDiagnostic(
      validateEvent({ fromIndex: 0, toIndex: -1, itemKey: "task-1" }, behaviorSelector),
      "EVENT_PAYLOAD_INVALID",
      "/toIndex",
    );
  });

  it("treats ValueSpec-shaped `$ref` objects as ordinary resolved JSON", () => {
    const validLiteralCatalog = cloneFixture(validCatalog) as unknown;
    writeAt(validLiteralCatalog, ["components", TEXT_FIELD, "events", "change", "payloadSchema"], {
      type: "object",
      additionalProperties: false,
      required: ["$ref"],
      properties: { $ref: { type: "string" } },
    });
    const selector: EventSelector = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      eventName: "change",
    };
    expect(
      validateEvent({ $ref: "real-payload-data" }, selector, [validLiteralCatalog]).valid,
    ).toBe(true);

    const mismatchCatalog = cloneFixture(validLiteralCatalog);
    writeAt(
      mismatchCatalog,
      ["components", TEXT_FIELD, "events", "change", "payloadSchema", "properties", "$ref", "type"],
      "number",
    );
    expectOnlyDiagnostic(
      validateEvent({ $ref: "must-not-bypass" }, selector, [mismatchCatalog]),
      "EVENT_PAYLOAD_INVALID",
      "/$ref",
    );
  });

  it("returns UNKNOWN_EVENT for wrong kind, capability id, or event name", () => {
    for (const selector of [
      {
        capabilityKind: "behavior" as const,
        capabilityId: TEXT_FIELD,
        eventName: "change",
      },
      {
        capabilityKind: "component" as const,
        capabilityId: "com.example.ui/Missing",
        eventName: "change",
      },
      {
        capabilityKind: "component" as const,
        capabilityId: TEXT_FIELD,
        eventName: "missing",
      },
    ]) {
      expectDiagnosticCode(validateEvent({ value: "x" }, selector), "UNKNOWN_EVENT");
    }
  });

  it("requires an own event declaration even when Object.prototype is polluted", () => {
    const selector: EventSelector = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      eventName: "toString",
    };
    expectOnlyDiagnostic(validateEvent({}, selector), "UNKNOWN_EVENT", "");

    const priorDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, "payloadSchema");
    Object.defineProperty(Object.prototype, "payloadSchema", {
      configurable: true,
      value: {},
    });
    try {
      expectOnlyDiagnostic(
        validateEvent({}, { ...selector, eventName: "__proto__" }),
        "UNKNOWN_EVENT",
        "",
      );
    } finally {
      if (priorDescriptor === undefined) Reflect.deleteProperty(Object.prototype, "payloadSchema");
      else Object.defineProperty(Object.prototype, "payloadSchema", priorDescriptor);
    }
  });

  it("copies and deeply freezes a successful payload independently of the caller", () => {
    const selector: EventSelector = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      eventName: "change",
    };
    const payload = { value: "before" };
    const result = validateEvent(payload, selector);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected event payload validation to pass.");
    payload.value = "after";

    expect(result.value).toEqual({ value: "before" });
    expect(result.value).not.toBe(payload);
    expectDeepFrozen(result);
  });

  it("contains hostile, cyclic, custom-prototype, and non-finite payload inputs", () => {
    const selector: EventSelector = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
      eventName: "change",
    };

    let accessed = false;
    const accessorPayload: MutableRecord = {};
    Object.defineProperty(accessorPayload, "value", {
      enumerable: true,
      get() {
        accessed = true;
        return "secret";
      },
    });
    expectDiagnosticCode(validateEvent(accessorPayload, selector), "EVENT_PAYLOAD_INVALID");
    expect(accessed).toBe(false);

    const cyclic: MutableRecord = { value: "x" };
    cyclic.self = cyclic;
    expectDiagnosticCode(validateEvent(cyclic, selector), "EVENT_PAYLOAD_INVALID");

    const customPrototype = Object.create({ inherited: true }) as MutableRecord;
    customPrototype.value = "x";
    expectDiagnosticCode(validateEvent(customPrototype, selector), "EVENT_PAYLOAD_INVALID");

    expectDiagnosticCode(validateEvent({ value: Number.NaN }, selector), "EVENT_PAYLOAD_INVALID");
  });
});

describe("M02-T09 public event payload safety limits", () => {
  const selector: EventSelector = {
    capabilityKind: "component",
    capabilityId: TEXT_FIELD,
    eventName: "change",
  };

  function openPayloadCatalogSet() {
    const catalog = cloneFixture(validCatalog) as unknown;
    writeAt(catalog, ["components", TEXT_FIELD, "events", "change", "payloadSchema"], {});
    return interactionCatalogSet([catalog]);
  }

  function nestedPayload(depth: number): unknown {
    let value: unknown = null;
    for (let level = 0; level < depth; level += 1) value = [value];
    return value;
  }

  function payloadWithNodeCount(nodeCount: number): unknown {
    return Array.from({ length: nodeCount - 1 }, () => null);
  }

  it("exports the exact reviewed payload limits", () => {
    expect(EVENT_PAYLOAD_SAFETY_LIMITS).toEqual({
      maxDepth: 128,
      maxJsonNodes: 4_096,
      maxStringCodeUnits: 1_048_576,
    });
    expectDeepFrozen(EVENT_PAYLOAD_SAFETY_LIMITS);
  });

  it("accepts depth 128 and rejects depth 129", () => {
    const catalogs = openPayloadCatalogSet();
    expect(validateDesenEventPayload(nestedPayload(128), selector, catalogs).valid).toBe(true);
    expectOnlyDiagnostic(
      validateDesenEventPayload(nestedPayload(129), selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
  });

  it("accepts 4096 JSON nodes and rejects 4097", () => {
    const catalogs = openPayloadCatalogSet();
    expect(validateDesenEventPayload(payloadWithNodeCount(4_096), selector, catalogs).valid).toBe(
      true,
    );
    expectOnlyDiagnostic(
      validateDesenEventPayload(payloadWithNodeCount(4_097), selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
  });

  it("applies the same 4096-node boundary to wide objects", () => {
    const catalogs = openPayloadCatalogSet();
    const objectWithProperties = (propertyCount: number): Record<string, null> =>
      Object.fromEntries(
        Array.from({ length: propertyCount }, (_, index) => [`key${index}`, null] as const),
      );

    expect(validateDesenEventPayload(objectWithProperties(4_095), selector, catalogs).valid).toBe(
      true,
    );
    expectOnlyDiagnostic(
      validateDesenEventPayload(objectWithProperties(4_096), selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
  });

  it("accepts 1048576 string code units and rejects 1048577", () => {
    const catalogs = openPayloadCatalogSet();
    expect(validateDesenEventPayload("x".repeat(1_048_576), selector, catalogs).valid).toBe(true);
    expectOnlyDiagnostic(
      validateDesenEventPayload("x".repeat(1_048_577), selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
  });

  it("bounds repeated shared containers before canonical serialization can expand them", () => {
    const catalogs = openPayloadCatalogSet();
    let payload: unknown = null;
    let ownKeyInspections = 0;
    for (let level = 0; level < 30; level += 1) {
      const shared = [payload, payload];
      payload = new Proxy(shared, {
        ownKeys(target) {
          ownKeyInspections += 1;
          if (ownKeyInspections >= EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes) {
            throw new TypeError("Repeated-container traversal exceeded its reviewed bound.");
          }
          return Reflect.ownKeys(target);
        },
      });
    }

    expectOnlyDiagnostic(
      validateDesenEventPayload(payload, selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
    expect(ownKeyInspections).toBeLessThan(EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes);
  });

  it("reserves queued children inside the node budget for nested wide arrays", () => {
    const catalogs = openPayloadCatalogSet();
    let payload: unknown = null;
    let descriptorInspections = 0;
    for (let level = 0; level < 128; level += 1) {
      const values = Array.from<unknown>({ length: 1_000 }).fill(null);
      values[0] = payload;
      payload = new Proxy(values, {
        getOwnPropertyDescriptor(target, property) {
          descriptorInspections += 1;
          if (descriptorInspections >= 10_000) {
            throw new TypeError("Queued payload work exceeded its reviewed bound.");
          }
          return Reflect.getOwnPropertyDescriptor(target, property);
        },
      });
    }

    expectOnlyDiagnostic(
      validateDesenEventPayload(payload, selector, catalogs),
      "EVENT_PAYLOAD_INVALID",
      "",
    );
    expect(descriptorInspections).toBeLessThan(5_000);
  });
});

describe("M02-T09 bounded interaction schema preparation", () => {
  it("fails closed at a deeply nested behavior schema before recursive validation", () => {
    const catalog = cloneFixture(validCatalog) as unknown;
    behavior(catalog).propsSchema = nestedNotSchema(800);
    expectOnlyDiagnostic(
      validateDesenInteractionCatalogSet([catalog]),
      INVALID_INTERACTION_CONTRACT,
      "/0/behaviors/com.example.interactions~1Sortable/propsSchema",
    );
  });

  const unsafeSchemaCases = [
    {
      label: "component event",
      path: ["components", TEXT_FIELD, "events", "change", "payloadSchema"] as const,
      pointer:
        "/0/components/com.example.ui~1TextField/events/change/payloadSchema/properties/value/pattern",
    },
    {
      label: "component command",
      path: ["components", TEXT_FIELD, "commands", "focus", "inputSchema"] as const,
      pointer:
        "/0/components/com.example.ui~1TextField/commands/focus/inputSchema/properties/value/pattern",
    },
    {
      label: "behavior props",
      path: ["behaviors", SORTABLE, "propsSchema"] as const,
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/propsSchema/properties/value/pattern",
    },
    {
      label: "behavior event",
      path: ["behaviors", SORTABLE, "events", "reorder", "payloadSchema"] as const,
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/events/reorder/payloadSchema/properties/value/pattern",
    },
    {
      label: "behavior command",
      path: ["behaviors", SORTABLE, "commands", "probe", "inputSchema"] as const,
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/commands/probe/inputSchema/properties/value/pattern",
    },
    {
      label: "behavior style part",
      path: ["behaviors", SORTABLE, "styleParts", "dropIndicator", "propertiesSchema"] as const,
      pointer:
        "/0/behaviors/com.example.interactions~1Sortable/styleParts/dropIndicator/propertiesSchema/properties/value/pattern",
    },
  ] as const;

  for (const schemaCase of unsafeSchemaCases) {
    it(`rejects an unsafe ${schemaCase.label} pattern at its exact pointer`, () => {
      const catalog = cloneFixture(validCatalog) as unknown;
      if (schemaCase.label === "behavior command") {
        behavior(catalog).commands = { probe: { inputSchema: {} } };
      }
      writeAt(catalog, schemaCase.path, {
        type: "object",
        properties: { value: { type: "string", pattern: "^(a+)+$" } },
      });
      expectOnlyDiagnostic(
        validateDesenInteractionCatalogSet([catalog]),
        INVALID_INTERACTION_CONTRACT,
        schemaCase.pointer,
      );
    });
  }
});

describe("M02-T09 immutability, deterministic ordering, and dispatcher parity", () => {
  it("returns deeply frozen catalog, document, failure, and payload results", () => {
    const catalogs = validateDesenInteractionCatalogSet([validCatalog]);
    expect(catalogs.valid).toBe(true);
    expectDeepFrozen(catalogs);

    const source = validateSource(validSource);
    expect(source.valid).toBe(true);
    expectDeepFrozen(source);

    const failure = validateSource(sourceUnknownEvent);
    expect(failure.valid).toBe(false);
    expectDeepFrozen(failure);

    const payload = validateEvent(
      { value: "x" },
      { capabilityKind: "component", capabilityId: TEXT_FIELD, eventName: "change" },
    );
    expect(payload.valid).toBe(true);
    expectDeepFrozen(payload);
  });

  it("isolates a validated document from later caller mutation", () => {
    const input = cloneFixture(validSource) as unknown;
    const result = validateSource(input);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected Source interaction validation to pass.");
    writeAt(input, ["entry"], "changed-after-validation");
    expect(record(result.value).entry).toBe("sign-in");
  });

  it("normalizes diagnostics and obligations independently of object insertion order", () => {
    const instance = behaviorInstance("sort");
    instance.props = {
      ghost: true,
      axis: { $ref: "state.axis", fallback: "vertical" },
      handle: 42,
    };
    instance.on = { teleport: [] };
    const first = sourceWithBehavior(instance);
    const second = reverseObjectMemberOrder(first);
    const firstResult = validateSource(first);
    const secondResult = validateSource(second);
    expect(firstResult.diagnostics).toEqual(secondResult.diagnostics);
    expect(firstResult.obligations).toEqual(secondResult.obligations);
  });

  it("keeps specialized Source and Bundle APIs equal to the generic dispatcher", () => {
    const catalogs = interactionCatalogSet();
    expect(validateDesenInteractionContracts("source", validSource, catalogs)).toEqual(
      validateDesenSourceInteractionContracts(validSource, catalogs),
    );
    expect(validateDesenInteractionContracts("bundle", validBundle, catalogs)).toEqual(
      validateDesenBundleInteractionContracts(validBundle, catalogs),
    );
  });

  it("exports the reviewed namespaced diagnostic identity", () => {
    expect(INVALID_INTERACTION_CONTRACT_CODE).toBe(INVALID_INTERACTION_CONTRACT);
  });
});
