import { describe, expect, it } from "vitest";

import exampleCatalog from "../../protocol/upstream/0.1.0/snapshot/examples/catalog.web.example.json";
import {
  ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
  EXECUTION_VALUE_SAFETY_LIMITS,
  RESOLVED_ADAPTER_VALIDATION_LIMITS,
  createDesenResolvedAdapterValidationScope,
  validateDesenExecutionCatalogSet,
  validateDesenInteractionCatalogSet,
  validateDesenResolvedAdapterProps,
  validateDesenResolvedAdapterSlots,
  validateDesenResolvedAdapterStyle,
} from "../src/index.js";

import type {
  DesenAdapterCapabilityReference,
  DesenValidatedExecutionCatalogSet,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

interface ResultLike {
  readonly valid: boolean;
  readonly target: string;
  readonly diagnostics: readonly Readonly<{ readonly code: string; readonly pointer?: string }>[];
  readonly value?: unknown;
}

const TEXT_FIELD = "com.example.ui/TextField";
const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const BUTTON = "com.example.ui/Button";
const SORTABLE = "com.example.interactions/Sortable";
const INVALID_EXECUTION_CONTRACT = "run.desen.validator/INVALID_EXECUTION_CONTRACT";

const TEXT_FIELD_REFERENCE = Object.freeze({
  capabilityKind: "component",
  capabilityId: TEXT_FIELD,
} satisfies DesenAdapterCapabilityReference);

const SORTABLE_REFERENCE = Object.freeze({
  capabilityKind: "behavior",
  capabilityId: SORTABLE,
} satisfies DesenAdapterCapabilityReference);

const STACK_REFERENCE = Object.freeze({
  capabilityKind: "component",
  capabilityId: STACK,
} satisfies DesenAdapterCapabilityReference);

function cloneFixture<Value>(fixture: Value): Value {
  return JSON.parse(JSON.stringify(fixture)) as Value;
}

function record(value: unknown, label = "fixture value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function recordAt(root: unknown, path: readonly string[]): MutableRecord {
  let current = root;
  for (const segment of path) current = record(current, path.join("/"))[segment];
  return record(current, path.join("/"));
}

function receivingCatalogFixture(): unknown {
  const catalog = cloneFixture(exampleCatalog) as unknown;
  const stack = recordAt(catalog, ["components", STACK]);
  const stackSlots = record(stack.slots, "Stack slots");
  stackSlots.header = {
    required: true,
    maxItems: 1,
    accepts: [TEXT],
  };
  stackSlots.actions = {
    required: false,
    minItems: 1,
    maxItems: 2,
    acceptsCategories: ["action"],
  };
  const textFieldRoot = recordAt(catalog, ["components", TEXT_FIELD, "styleParts", "root"]);
  textFieldRoot.propertiesSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      color: { type: "string", pattern: "^#[0-9a-f]{6}$" },
      opacity: { type: "number", minimum: 0, maximum: 1 },
    },
  };
  const sortableIndicator = recordAt(catalog, [
    "behaviors",
    SORTABLE,
    "styleParts",
    "dropIndicator",
  ]);
  sortableIndicator.propertiesSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      color: { type: "string", pattern: "^#[0-9a-f]{6}$" },
    },
  };
  return catalog;
}

function receivingCatalogSet(): DesenValidatedExecutionCatalogSet {
  const result = validateDesenExecutionCatalogSet([receivingCatalogFixture()]);
  expect(result.valid).toBe(true);
  if (!result.valid) throw new TypeError("Expected execution Catalog preparation to pass.");
  return result.value;
}

function receivingScope(
  catalogs = receivingCatalogSet(),
  limits?: Parameters<typeof createDesenResolvedAdapterValidationScope>[1],
) {
  const result = createDesenResolvedAdapterValidationScope(catalogs, limits);
  expect(result.status).toBe("created");
  if (result.status !== "created")
    throw new TypeError("Expected receiving scope creation to pass.");
  return result.scope;
}

function validateProps(
  value: unknown,
  capability: DesenAdapterCapabilityReference = TEXT_FIELD_REFERENCE,
  catalogs = receivingCatalogSet(),
) {
  return validateDesenResolvedAdapterProps(value, capability, receivingScope(catalogs));
}

function validateStyle(
  value: unknown,
  capability: DesenAdapterCapabilityReference = TEXT_FIELD_REFERENCE,
  catalogs = receivingCatalogSet(),
) {
  return validateDesenResolvedAdapterStyle(value, capability, receivingScope(catalogs));
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

describe("M05 resolved adapter props receiving boundary", () => {
  it("validates complete component and behavior props through their exact schemas", () => {
    expect(validateProps({ label: "Email", value: "", secure: true })).toMatchObject({
      valid: true,
      target: "adapter-props",
      diagnostics: [],
    });
    expect(
      validateProps({ axis: "vertical", handle: "explicit" }, SORTABLE_REFERENCE),
    ).toMatchObject({
      valid: true,
      target: "adapter-props",
      diagnostics: [],
    });

    expectOnlyDiagnostic(validateProps({ label: "Email" }), "PROP_TYPE_MISMATCH", "/value");
    expectOnlyDiagnostic(
      validateProps({ label: "Email", value: 42 }),
      "PROP_TYPE_MISMATCH",
      "/value",
    );
    expectOnlyDiagnostic(
      validateProps({ label: "Email", value: "", private: true }),
      "UNKNOWN_PROP",
      "/private",
    );
    expectOnlyDiagnostic(
      validateProps({ axis: "diagonal" }, SORTABLE_REFERENCE),
      "PROP_TYPE_MISMATCH",
      "/axis",
    );
  });

  it("treats reference-shaped resolved values as inert receiving data", () => {
    expectOnlyDiagnostic(
      validateProps({ label: { $ref: "state.label" }, value: "" }),
      "PROP_TYPE_MISMATCH",
      "/label",
    );
  });

  it("returns a detached recursively immutable value and retains no caller state", () => {
    const caller = { value: "", label: "Email" };
    const result = validateProps(caller);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new TypeError("Expected resolved props to pass.");
    caller.label = "Changed";

    expect(result.value).toEqual({ label: "Email", value: "" });
    expect(result.value).not.toBe(caller);
    expectDeepFrozen(result);
  });
});

describe("M05 resolved adapter style receiving boundary", () => {
  it("validates base and declared visual states through exact semantic style parts", () => {
    const result = validateStyle({
      base: { root: { color: "#112233", opacity: 1 } },
      focus: { root: { opacity: 0.75 } },
    });
    expect(result).toMatchObject({
      valid: true,
      target: "adapter-style",
      diagnostics: [],
    });
    expectDeepFrozen(result);

    expect(
      validateStyle({ dragging: { dropIndicator: { color: "#abcdef" } } }, SORTABLE_REFERENCE),
    ).toMatchObject({ valid: true, target: "adapter-style" });
  });

  it("rejects unknown states, parts, properties, and invalid resolved property values", () => {
    expectOnlyDiagnostic(
      validateStyle({ hover: { root: { color: "#112233" } } }),
      "UNKNOWN_PROP",
      "/hover",
    );
    expectOnlyDiagnostic(validateStyle({ base: { private: {} } }), "UNKNOWN_PROP", "/base/private");
    expectOnlyDiagnostic(
      validateStyle({ base: { root: { private: true } } }),
      "UNKNOWN_PROP",
      "/base/root/private",
    );
    expectOnlyDiagnostic(
      validateStyle({ base: { root: { color: "red" } } }),
      "PROP_TYPE_MISMATCH",
      "/base/root/color",
    );
    expectOnlyDiagnostic(
      validateStyle({ base: { root: { opacity: 2 } } }),
      "PROP_TYPE_MISMATCH",
      "/base/root/opacity",
    );
    expectOnlyDiagnostic(
      validateStyle({ base: { root: null } }),
      "PROP_TYPE_MISMATCH",
      "/base/root",
    );
  });

  it("normalizes multi-failure order independently of caller insertion order", () => {
    const style = {
      zzz: { private: {} },
      base: {
        root: { opacity: "opaque", extra: true },
        private: {},
      },
    };
    const direct = validateStyle(style);
    const reversed = validateStyle(reverseObjectMemberOrder(style));

    expect(reversed).toEqual(direct);
    expect(diagnosticIdentity(direct)).toEqual([
      ["UNKNOWN_PROP", "/base/private"],
      ["UNKNOWN_PROP", "/base/root/extra"],
      ["PROP_TYPE_MISMATCH", "/base/root/opacity"],
      ["UNKNOWN_PROP", "/zzz"],
      ["UNKNOWN_PROP", "/zzz/private"],
    ]);
  });
});

describe("M05 resolved adapter named-slot receiving boundary", () => {
  it("validates final component and behavior slots by exact id or component category", () => {
    const component = validateDesenResolvedAdapterSlots(
      {
        actions: [{ capabilityId: BUTTON }],
        default: [{ capabilityId: TEXT }, { capabilityId: TEXT_FIELD }],
        header: [{ capabilityId: TEXT }],
      },
      STACK_REFERENCE,
      receivingScope(),
    );
    expect(component).toMatchObject({
      valid: true,
      target: "adapter-slots",
      diagnostics: [],
    });
    if (!component.valid) throw new TypeError("Expected component slot projection to pass.");
    expect(Object.keys(component.value)).toEqual(["actions", "default", "header"]);
    expectDeepFrozen(component);

    const behavior = validateDesenResolvedAdapterSlots(
      { dragPreview: [{ capabilityId: STACK }] },
      SORTABLE_REFERENCE,
      receivingScope(),
    );
    expect(behavior).toMatchObject({ valid: true, target: "adapter-slots" });
  });

  it("applies required presence and effective min/max to each final owner instance", () => {
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots({ default: [] }, STACK_REFERENCE, receivingScope()),
      "SLOT_CARDINALITY",
      "/header",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { actions: [], header: [{ capabilityId: TEXT }] },
        STACK_REFERENCE,
        receivingScope(),
      ),
      "SLOT_CARDINALITY",
      "/actions",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        {
          header: [{ capabilityId: TEXT }, { capabilityId: TEXT }],
        },
        STACK_REFERENCE,
        receivingScope(),
      ),
      "SLOT_CARDINALITY",
      "/header",
    );
  });

  it("distinguishes required presence from an explicit zero minimum", () => {
    const catalog = receivingCatalogFixture();
    const stackSlots = record(recordAt(catalog, ["components", STACK]).slots, "Stack slots");
    stackSlots.header = {
      required: true,
      minItems: 0,
    };
    const prepared = validateDesenExecutionCatalogSet([catalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected zero-minimum slot Catalog to prepare.");

    expect(
      validateDesenResolvedAdapterSlots(
        { header: [] },
        STACK_REFERENCE,
        receivingScope(prepared.value),
      ),
    ).toMatchObject({ valid: true, target: "adapter-slots" });
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots({}, STACK_REFERENCE, receivingScope(prepared.value)),
      "SLOT_CARDINALITY",
      "/header",
    );
  });

  it("treats an explicit empty acceptance union as reject-all", () => {
    const catalog = receivingCatalogFixture();
    const stackSlots = record(recordAt(catalog, ["components", STACK]).slots, "Stack slots");
    stackSlots.header = {
      required: true,
      accepts: [],
      acceptsCategories: [],
    };
    const prepared = validateDesenExecutionCatalogSet([catalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected empty-union slot Catalog to prepare.");

    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { header: [{ capabilityId: TEXT }] },
        STACK_REFERENCE,
        receivingScope(prepared.value),
      ),
      "SLOT_CHILD_REJECTED",
      "/header/0/capabilityId",
    );
  });

  it("rejects undeclared slots, unknown components, and disallowed behavior/category children", () => {
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { ghost: [], header: [{ capabilityId: TEXT }] },
        STACK_REFERENCE,
        receivingScope(),
      ),
      "UNKNOWN_SLOT",
      "/ghost",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        {
          header: [{ capabilityId: "com.example.missing/Child" }],
        },
        STACK_REFERENCE,
        receivingScope(),
      ),
      "UNKNOWN_CAPABILITY",
      "/header/0/capabilityId",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        {
          default: [{ capabilityId: "com.example.missing/UnrestrictedChild" }],
          header: [{ capabilityId: TEXT }],
        },
        STACK_REFERENCE,
        receivingScope(),
      ),
      "UNKNOWN_CAPABILITY",
      "/default/0/capabilityId",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { dragPreview: [{ capabilityId: BUTTON }] },
        SORTABLE_REFERENCE,
        receivingScope(),
      ),
      "SLOT_CHILD_REJECTED",
      "/dragPreview/0/capabilityId",
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { dragPreview: [{ capabilityId: SORTABLE }] },
        SORTABLE_REFERENCE,
        receivingScope(),
      ),
      "UNKNOWN_CAPABILITY",
      "/dragPreview/0/capabilityId",
    );
  });

  it("captures hostile slot projections without getters and consumes one shared entry budget", () => {
    let accessed = false;
    const accessor = {};
    Object.defineProperty(accessor, "header", {
      enumerable: true,
      get() {
        accessed = true;
        return [{ capabilityId: TEXT }];
      },
    });
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(accessor, STACK_REFERENCE, receivingScope()),
      INVALID_EXECUTION_CONTRACT,
      "",
    );
    expect(accessed).toBe(false);

    const scope = receivingScope(undefined, { maxSlotEntries: 2 });
    const first = validateDesenResolvedAdapterSlots(
      { dragPreview: [{ capabilityId: TEXT }] },
      SORTABLE_REFERENCE,
      scope,
    );
    expect(first.valid).toBe(true);
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots({ dragPreview: [] }, SORTABLE_REFERENCE, scope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );
  });

  it("bounds repeated declared-slot scans and child acceptance work cumulatively", () => {
    const catalog = receivingCatalogFixture();
    const stackSlots = record(recordAt(catalog, ["components", STACK]).slots, "Stack slots");
    for (let index = 0; index < 64; index += 1) {
      stackSlots[`required${String(index).padStart(2, "0")}`] = {
        required: true,
        minItems: 0,
      };
    }
    const prepared = validateDesenExecutionCatalogSet([catalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected large slot Catalog to prepare.");

    const repeatedScope = receivingScope(prepared.value, {
      maxSlotContractEvaluationSteps: 65,
    });
    const first = validateDesenResolvedAdapterSlots({}, STACK_REFERENCE, repeatedScope);
    expect(first.valid).toBe(false);
    expect(first.diagnostics).toHaveLength(65);
    expect(
      first.diagnostics.some(({ code }) => code === ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE),
    ).toBe(false);
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots({}, STACK_REFERENCE, repeatedScope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );

    expectOnlyDiagnostic(
      validateDesenResolvedAdapterSlots(
        { header: [{ capabilityId: TEXT }] },
        STACK_REFERENCE,
        receivingScope(receivingCatalogSet(), { maxSlotContractEvaluationSteps: 2 }),
      ),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );
  });
});

describe("M05 resolved adapter authority, hostile input, and finite limits", () => {
  it("creates exact lower-only scopes with monotonic per-channel counters", () => {
    const catalogs = receivingCatalogSet();
    const scope = receivingScope(catalogs, { maxPropValidations: 1 });
    expect(
      validateDesenResolvedAdapterProps({ label: "Email", value: "" }, TEXT_FIELD_REFERENCE, scope)
        .valid,
    ).toBe(true);
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterProps({ label: "Email", value: "" }, TEXT_FIELD_REFERENCE, scope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );
    expect(
      validateDesenResolvedAdapterProps(
        { label: "Email", value: "" },
        TEXT_FIELD_REFERENCE,
        receivingScope(catalogs, { maxPropValidations: 1 }),
      ).valid,
    ).toBe(true);

    expect(
      createDesenResolvedAdapterValidationScope(catalogs, {
        maxPropValidations: RESOLVED_ADAPTER_VALIDATION_LIMITS.maxPropValidations + 1,
      }),
    ).toEqual({ status: "invalid", reason: "invalid-limits" });
    expect(createDesenResolvedAdapterValidationScope(catalogs, { unknown: 1 } as never)).toEqual({
      status: "invalid",
      reason: "invalid-limits",
    });
  });

  it("shares one non-resetting schema budget across component and behavior props", () => {
    const catalog = receivingCatalogFixture();
    recordAt(catalog, ["components", TEXT_FIELD]).propsSchema = {};
    recordAt(catalog, ["behaviors", SORTABLE]).propsSchema = {};
    const prepared = validateDesenExecutionCatalogSet([catalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected simple receiving schemas to prepare.");
    const scope = receivingScope(prepared.value, { maxSchemaEvaluationSteps: 2 });

    expect(validateDesenResolvedAdapterProps({}, TEXT_FIELD_REFERENCE, scope).valid).toBe(true);
    expect(validateDesenResolvedAdapterProps({}, SORTABLE_REFERENCE, scope).valid).toBe(true);
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterProps({}, TEXT_FIELD_REFERENCE, scope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );
    expect(
      validateDesenResolvedAdapterProps(
        {},
        TEXT_FIELD_REFERENCE,
        receivingScope(prepared.value, { maxSchemaEvaluationSteps: 1 }),
      ).valid,
    ).toBe(true);
  });

  it("shares aggregate detached-JSON occurrence and string budgets before schema work", () => {
    const catalog = receivingCatalogFixture();
    recordAt(catalog, ["components", TEXT_FIELD]).propsSchema = { type: "object" };
    const prepared = validateDesenExecutionCatalogSet([catalog]);
    expect(prepared.valid).toBe(true);
    if (!prepared.valid) throw new TypeError("Expected simple receiving schema to prepare.");

    const occurrenceScope = receivingScope(prepared.value, {
      maxResolvedJsonOccurrences: 2,
    });
    expect(
      validateDesenResolvedAdapterProps({ x: 1 }, TEXT_FIELD_REFERENCE, occurrenceScope).valid,
    ).toBe(true);
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterProps({}, TEXT_FIELD_REFERENCE, occurrenceScope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );

    const stringScope = receivingScope(prepared.value, {
      maxResolvedJsonStringCodeUnits: 1,
    });
    expect(validateDesenResolvedAdapterProps({}, TEXT_FIELD_REFERENCE, stringScope).valid).toBe(
      true,
    );
    expectOnlyDiagnostic(
      validateDesenResolvedAdapterProps({ xx: null }, TEXT_FIELD_REFERENCE, stringScope),
      ADAPTER_VALIDATION_LIMIT_EXCEEDED_CODE,
      "",
    );
  });

  it("requires the exact factory-authenticated execution Catalog set and category", () => {
    const catalog = receivingCatalogFixture();
    const lower = validateDesenInteractionCatalogSet([catalog]);
    expect(lower.valid).toBe(true);
    if (!lower.valid) throw new TypeError("Expected interaction Catalog preparation to pass.");

    expectOnlyDiagnostic(
      validateDesenResolvedAdapterProps(
        { label: "Email", value: "" },
        TEXT_FIELD_REFERENCE,
        lower.value as never,
      ),
      INVALID_EXECUTION_CONTRACT,
      "",
    );
    expectOnlyDiagnostic(
      validateProps({}, { capabilityKind: "component", capabilityId: SORTABLE }),
      "UNKNOWN_CAPABILITY",
      "",
    );
    expectOnlyDiagnostic(
      validateProps(
        {},
        { capabilityKind: "behavior", capabilityId: "com.example.missing/Behavior" },
      ),
      "UNKNOWN_CAPABILITY",
      "",
    );
  });

  it("reads capability references only through an exact detached boundary", () => {
    const catalogs = receivingCatalogSet();
    const scope = receivingScope(catalogs);
    let accessed = false;
    const accessor = {
      capabilityKind: "component",
      get capabilityId() {
        accessed = true;
        return TEXT_FIELD;
      },
    };
    const cyclic: MutableRecord = {
      capabilityKind: "component",
      capabilityId: TEXT_FIELD,
    };
    cyclic.self = cyclic;
    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new TypeError("hostile selector");
        },
      },
    );

    for (const capability of [
      { ...TEXT_FIELD_REFERENCE, extra: true },
      accessor,
      cyclic,
      throwingProxy,
    ]) {
      expectOnlyDiagnostic(
        validateDesenResolvedAdapterProps(
          { label: "Email", value: "" },
          capability as never,
          scope,
        ),
        INVALID_EXECUTION_CONTRACT,
        "",
      );
    }
    expect(accessed).toBe(false);
  });

  it("contains getters, throwing proxies, cycles, custom prototypes, and non-finite values", () => {
    let accessed = false;
    const accessor: MutableRecord = { value: "" };
    Object.defineProperty(accessor, "label", {
      enumerable: true,
      get() {
        accessed = true;
        return "Email";
      },
    });
    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new TypeError("hostile props");
        },
      },
    );
    const cyclic: MutableRecord = { label: "Email", value: "" };
    cyclic.self = cyclic;
    const customPrototype = Object.assign(Object.create({ inherited: true }), {
      label: "Email",
      value: "",
    });

    for (const value of [
      accessor,
      throwingProxy,
      cyclic,
      customPrototype,
      { label: "Email", value: "", invalid: Number.NaN },
    ]) {
      expectOnlyDiagnostic(validateProps(value), "PROP_TYPE_MISMATCH", "");
    }
    expect(accessed).toBe(false);
  });

  it("fails closed above JSON-node, string, and depth limits without partial values", () => {
    const overNodes = {
      label: "Email",
      value: "",
      values: new Array(EXECUTION_VALUE_SAFETY_LIMITS.maxJsonNodes).fill(null),
    };
    const overString = {
      label: "x".repeat(EXECUTION_VALUE_SAFETY_LIMITS.maxStringCodeUnits + 1),
      value: "",
    };
    let nested: unknown = "leaf";
    for (let depth = 0; depth <= EXECUTION_VALUE_SAFETY_LIMITS.maxDepth; depth += 1) {
      nested = { child: nested };
    }
    const overDepth = { label: "Email", value: "", nested };

    for (const value of [overNodes, overString, overDepth]) {
      const result = validateProps(value);
      expectOnlyDiagnostic(result, "PROP_TYPE_MISMATCH", "");
      expect(Object.hasOwn(result, "value")).toBe(false);
      expectDeepFrozen(result);
    }
  });
});
