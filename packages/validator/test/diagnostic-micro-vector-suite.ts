import type {
  DesenEventContractReference,
  DesenEventPayloadValidationResult,
  DesenExecutionCatalogSetValidationResult,
  DesenExecutionContractValidationResult,
  DesenExecutionValueContractReference,
  DesenExecutionValueValidationResult,
  DesenValidatedExecutionCatalogSet,
} from "../src/index.js";

type MutableRecord = Record<string, unknown>;

interface DiagnosticLike {
  readonly code: string;
  readonly classification?: string;
  readonly pointer?: string;
  readonly context?: unknown;
}

interface ResultLike {
  readonly valid: boolean;
  readonly diagnostics: readonly DiagnosticLike[];
}

interface ValidatorApi {
  readonly validateDesenExecutionCatalogSet: (
    input: unknown,
  ) => DesenExecutionCatalogSetValidationResult;
  readonly validateDesenSourceExecutionContracts: (
    input: unknown,
    catalogSet: DesenValidatedExecutionCatalogSet,
  ) => DesenExecutionContractValidationResult<"source">;
  readonly validateDesenEventPayload: (
    payload: unknown,
    selector: DesenEventContractReference,
    catalogSet: DesenValidatedExecutionCatalogSet,
  ) => DesenEventPayloadValidationResult;
  readonly validateDesenExecutionValue: (
    value: unknown,
    selector: DesenExecutionValueContractReference,
    catalogSet: DesenValidatedExecutionCatalogSet,
  ) => DesenExecutionValueValidationResult;
}

interface FrozenFixtures {
  readonly validCatalog: unknown;
  readonly validSource: unknown;
}

type Invocation =
  | Readonly<{ readonly route: "catalog-set"; readonly catalogs: readonly unknown[] }>
  | Readonly<{
      readonly route: "source";
      readonly catalogs: readonly unknown[];
      readonly source: unknown;
    }>
  | Readonly<{
      readonly route: "event-payload";
      readonly catalogs: readonly unknown[];
      readonly payload: unknown;
      readonly selector: DesenEventContractReference;
    }>
  | Readonly<{
      readonly route: "execution-value";
      readonly catalogs: readonly unknown[];
      readonly value: unknown;
      readonly selector: DesenExecutionValueContractReference;
    }>;

interface VectorDefinition {
  readonly id: string;
  readonly traceId?: string;
  readonly scope: "core" | "extension";
  readonly code: string;
  readonly classification?: string;
  readonly pointer: string;
  readonly context?: unknown;
  readonly mutation: string;
  readonly positive: () => Invocation;
  readonly negative: () => Invocation;
}

const STACK = "com.example.ui/Stack";
const TEXT = "com.example.ui/Text";
const TEXT_FIELD = "com.example.ui/TextField";
const BUTTON = "com.example.ui/Button";
const SORTABLE = "com.example.interactions/Sortable";
const SIGN_IN = "com.example.auth/signIn";
const STORES = "com.example.stores/list";

const EXCLUDED_CORE_DIAGNOSTICS = Object.freeze([
  "OPERATION_DENIED",
  "ACTION_LIMIT_EXCEEDED",
  "REVISION_MISMATCH",
  "SOURCE_DIGEST_MISMATCH",
  "CATALOG_DIGEST_MISMATCH",
  "CATALOG_VERSION_UNAVAILABLE",
  "BUNDLE_LIMIT_EXCEEDED",
  "ADAPTER_FAILURE",
]);

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label = "micro-vector value"): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as MutableRecord;
}

function array(value: unknown, label = "micro-vector value"): unknown[] {
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

function stateEntry(schema: MutableRecord, initial: unknown): MutableRecord {
  return { schema, initial };
}

function minimalSource(
  validSource: unknown,
  root: MutableRecord,
  state: MutableRecord = {},
  resources: MutableRecord = {},
): unknown {
  const source = cloneJson(validSource);
  writeAt(source, ["entry"], "main");
  writeAt(source, ["surfaces"], {
    main: { id: "main", state, resources, root },
  });
  deleteAt(source, ["authoring"]);
  return source;
}

function withCatalog(fixtures: FrozenFixtures, mutate?: (catalog: MutableRecord) => void): unknown {
  const catalog = cloneJson(fixtures.validCatalog);
  if (mutate !== undefined) mutate(record(catalog));
  return catalog;
}

function sourceInvocation(
  fixtures: FrozenFixtures,
  source: unknown,
  catalog = withCatalog(fixtures),
): Invocation {
  return Object.freeze({ route: "source", catalogs: Object.freeze([catalog]), source });
}

function catalogInvocation(catalog: unknown): Invocation {
  return Object.freeze({ route: "catalog-set", catalogs: Object.freeze([catalog]) });
}

function eventInvocation(
  fixtures: FrozenFixtures,
  payload: unknown,
  selector: DesenEventContractReference,
): Invocation {
  return Object.freeze({
    route: "event-payload",
    catalogs: Object.freeze([withCatalog(fixtures)]),
    payload,
    selector,
  });
}

function valueInvocation(
  fixtures: FrozenFixtures,
  value: unknown,
  selector: DesenExecutionValueContractReference,
): Invocation {
  return Object.freeze({
    route: "execution-value",
    catalogs: Object.freeze([withCatalog(fixtures)]),
    value,
    selector,
  });
}

function behaviorRoot(instanceCount: number): MutableRecord {
  const root = node("layout", STACK, { direction: "vertical" });
  root.behaviors = Array.from({ length: instanceCount }, (_, index) => ({
    id: `sortable-${String(index + 1)}`,
    use: SORTABLE,
  }));
  return root;
}

function actionSource(
  fixtures: FrozenFixtures,
  action: MutableRecord,
  state: MutableRecord = {},
): unknown {
  const actor = node("actor", BUTTON, { label: "Run" });
  actor.on = { press: [action] };
  return minimalSource(fixtures.validSource, actor, state);
}

function coreVector(
  definition: Omit<VectorDefinition, "scope"> & { readonly traceId: string },
): VectorDefinition {
  return Object.freeze({ ...definition, scope: "core" });
}

function extensionVector(
  definition: Omit<VectorDefinition, "classification" | "scope" | "traceId">,
): VectorDefinition {
  return Object.freeze({ ...definition, scope: "extension" });
}

function buildDefinitions(fixtures: FrozenFixtures): readonly VectorDefinition[] {
  const source = () => cloneJson(fixtures.validSource);
  const catalog = () => withCatalog(fixtures);
  const text = (id = "text", value: unknown = "Text") => node(id, TEXT, { text: value });
  const stack = (id = "layout") => node(id, STACK, { direction: "vertical" });
  const eventSelector = Object.freeze({
    capabilityKind: "component" as const,
    capabilityId: TEXT_FIELD,
    eventName: "change",
  });
  const operationInput = Object.freeze({ kind: "operation-input" as const, capabilityId: SIGN_IN });
  const operationOutput = Object.freeze({
    kind: "operation-output" as const,
    capabilityId: SIGN_IN,
  });
  const resourceInput = Object.freeze({ kind: "resource-input" as const, capabilityId: STORES });
  const resourceOutput = Object.freeze({
    kind: "resource-output" as const,
    capabilityId: STORES,
  });
  const focusInput = Object.freeze({
    kind: "component-command-input" as const,
    capabilityId: TEXT_FIELD,
    commandName: "focus",
  });
  const documentContext = Object.freeze({ documentId: "com.example.account-app" });
  const surfaceContext = Object.freeze({
    documentId: "com.example.account-app",
    surfaceId: "main",
  });
  const capabilityContext = (capabilityId: string) => Object.freeze({ capabilityId });
  const subjectContext = (
    surfaceId: string,
    kind: "behavior" | "node",
    id: string,
    capabilityId?: string,
  ) =>
    Object.freeze({
      documentId: "com.example.account-app",
      surfaceId,
      subject: Object.freeze({ kind, id }),
      ...(capabilityId === undefined ? {} : { capabilityId }),
    });

  return Object.freeze([
    coreVector({
      id: "schema-invalid",
      traceId: "D-001",
      code: "SCHEMA_INVALID",
      classification: "schema",
      pointer: "/id",
      mutation: "remove-required-document-id",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        deleteAt(changed, ["id"]);
        return sourceInvocation(fixtures, changed);
      },
    }),
    coreVector({
      id: "unknown-core-field",
      traceId: "D-002",
      code: "UNKNOWN_CORE_FIELD",
      classification: "schema",
      pointer: "/script",
      mutation: "add-closed-core-field",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        record(changed).script = "alert";
        return sourceInvocation(fixtures, changed);
      },
    }),
    coreVector({
      id: "duplicate-surface-id",
      traceId: "D-003",
      code: "DUPLICATE_SURFACE_ID",
      classification: "semantic",
      pointer: "/surfaces/home/id",
      context: Object.freeze({
        documentId: "com.example.account-app",
        surfaceId: "home",
      }),
      mutation: "mismatch-surface-key-and-id",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        writeAt(changed, ["surfaces", "home", "id"], "sign-in");
        return sourceInvocation(fixtures, changed);
      },
    }),
    coreVector({
      id: "duplicate-node-id",
      traceId: "D-004",
      code: "DUPLICATE_NODE_ID",
      classification: "semantic",
      pointer: "/surfaces/main/root/slots/default/1/id",
      context: subjectContext("main", "node", "same"),
      mutation: "duplicate-second-child-id",
      positive: () => {
        const root = stack();
        root.slots = { default: [text("first"), text("second")] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = stack();
        root.slots = { default: [text("same"), text("same")] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "entry-not-found",
      traceId: "D-005",
      code: "ENTRY_NOT_FOUND",
      classification: "semantic",
      pointer: "/entry",
      context: documentContext,
      mutation: "point-entry-at-missing-surface",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        writeAt(changed, ["entry"], "missing");
        return sourceInvocation(fixtures, changed);
      },
    }),
    coreVector({
      id: "unknown-capability",
      traceId: "D-006",
      code: "UNKNOWN_CAPABILITY",
      classification: "catalog",
      pointer: "/surfaces/main/root/use",
      context: subjectContext("main", "node", "layout", "com.example.missing/Component"),
      mutation: "replace-component-with-undeclared-id",
      positive: () => sourceInvocation(fixtures, minimalSource(fixtures.validSource, stack())),
      negative: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, node("layout", "com.example.missing/Component")),
        ),
    }),
    coreVector({
      id: "ambiguous-capability",
      traceId: "D-007",
      code: "AMBIGUOUS_CAPABILITY",
      classification: "catalog",
      pointer: "/0/behaviors/com.example.ui~1TextField",
      context: capabilityContext(TEXT_FIELD),
      mutation: "reuse-component-id-in-behavior-category",
      positive: () => catalogInvocation(catalog()),
      negative: () => {
        const changed = catalog();
        recordAt(changed, ["behaviors"])[TEXT_FIELD] = cloneJson(
          recordAt(changed, ["behaviors", SORTABLE]),
        );
        return catalogInvocation(changed);
      },
    }),
    coreVector({
      id: "unknown-prop",
      traceId: "D-008",
      code: "UNKNOWN_PROP",
      classification: "catalog",
      pointer: "/surfaces/main/root/props/ghost",
      context: subjectContext("main", "node", "layout", STACK),
      mutation: "add-undeclared-component-prop",
      positive: () => sourceInvocation(fixtures, minimalSource(fixtures.validSource, stack())),
      negative: () =>
        sourceInvocation(
          fixtures,
          minimalSource(
            fixtures.validSource,
            node("layout", STACK, { direction: "vertical", ghost: true }),
          ),
        ),
    }),
    coreVector({
      id: "prop-type-mismatch",
      traceId: "D-009",
      code: "PROP_TYPE_MISMATCH",
      classification: "catalog/runtime",
      pointer: "/surfaces/main/root/props/direction",
      context: subjectContext("main", "node", "layout", STACK),
      mutation: "replace-enum-prop-with-invalid-literal",
      positive: () => sourceInvocation(fixtures, minimalSource(fixtures.validSource, stack())),
      negative: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, node("layout", STACK, { direction: "diagonal" })),
        ),
    }),
    coreVector({
      id: "unknown-slot",
      traceId: "D-010",
      code: "UNKNOWN_SLOT",
      classification: "catalog",
      pointer: "/surfaces/main/root/slots/ghost",
      context: subjectContext("main", "node", "layout", STACK),
      mutation: "add-undeclared-empty-slot",
      positive: () => sourceInvocation(fixtures, minimalSource(fixtures.validSource, stack())),
      negative: () => {
        const root = stack();
        root.slots = { ghost: [] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "slot-cardinality",
      traceId: "D-011",
      code: "SLOT_CARDINALITY",
      classification: "catalog",
      pointer: "/surfaces/main/root/slots/default",
      context: subjectContext("main", "node", "layout", STACK),
      mutation: "make-omitted-slot-required",
      positive: () => sourceInvocation(fixtures, minimalSource(fixtures.validSource, stack())),
      negative: () => {
        const changedCatalog = withCatalog(fixtures, (value) => {
          const slot = recordAt(value, ["components", STACK, "slots", "default"]);
          slot.required = true;
          delete slot.minItems;
        });
        return sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, stack()),
          changedCatalog,
        );
      },
    }),
    coreVector({
      id: "slot-child-rejected",
      traceId: "D-012",
      code: "SLOT_CHILD_REJECTED",
      classification: "catalog",
      pointer: "/surfaces/main/root/slots/default/0/use",
      context: subjectContext("main", "node", "layout", STACK),
      mutation: "restrict-slot-to-action-category",
      positive: () => {
        const root = stack();
        root.slots = { default: [text()] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = stack();
        root.slots = { default: [text()] };
        const changedCatalog = withCatalog(fixtures, (value) => {
          const slot = recordAt(value, ["components", STACK, "slots", "default"]);
          slot.acceptsCategories = ["action"];
          delete slot.accepts;
        });
        return sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, root),
          changedCatalog,
        );
      },
    }),
    coreVector({
      id: "unknown-event",
      traceId: "D-013",
      code: "UNKNOWN_EVENT",
      classification: "catalog",
      pointer: "/surfaces/main/root/on/teleport",
      context: subjectContext("main", "node", "button", BUTTON),
      mutation: "rename-declared-button-event",
      positive: () => {
        const root = node("button", BUTTON, { label: "Run" });
        root.on = { press: [] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = node("button", BUTTON, { label: "Run" });
        root.on = { teleport: [] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "event-payload-invalid",
      traceId: "D-014",
      code: "EVENT_PAYLOAD_INVALID",
      classification: "runtime",
      pointer: "/value",
      context: capabilityContext(TEXT_FIELD),
      mutation: "replace-resolved-event-string-with-number",
      positive: () => eventInvocation(fixtures, { value: "Ada" }, eventSelector),
      negative: () => eventInvocation(fixtures, { value: 42 }, eventSelector),
    }),
    coreVector({
      id: "unknown-command",
      traceId: "D-015",
      code: "UNKNOWN_COMMAND",
      classification: "catalog",
      pointer: "",
      context: capabilityContext(TEXT_FIELD),
      mutation: "select-undeclared-component-command",
      positive: () => valueInvocation(fixtures, {}, focusInput),
      negative: () => valueInvocation(fixtures, {}, { ...focusInput, commandName: "teleport" }),
    }),
    coreVector({
      id: "command-input-invalid",
      traceId: "D-016",
      code: "COMMAND_INPUT_INVALID",
      classification: "runtime",
      pointer: "/unexpected",
      context: capabilityContext(TEXT_FIELD),
      mutation: "add-closed-command-input-field",
      positive: () => valueInvocation(fixtures, {}, focusInput),
      negative: () => valueInvocation(fixtures, { unexpected: true }, focusInput),
    }),
    coreVector({
      id: "behavior-attachment-invalid",
      traceId: "D-017",
      code: "BEHAVIOR_ATTACHMENT_INVALID",
      classification: "catalog",
      pointer: "/surfaces/main/root/behaviors/0/use",
      context: subjectContext("main", "behavior", "sortable-1", SORTABLE),
      mutation: "replace-accepted-owner-category",
      positive: () =>
        sourceInvocation(fixtures, minimalSource(fixtures.validSource, behaviorRoot(1))),
      negative: () => {
        const changedCatalog = withCatalog(fixtures, (value) => {
          recordAt(value, ["behaviors", SORTABLE]).attachTo = { categories: ["action"] };
        });
        return sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, behaviorRoot(1)),
          changedCatalog,
        );
      },
    }),
    coreVector({
      id: "behavior-conflict",
      traceId: "D-018",
      code: "BEHAVIOR_CONFLICT",
      classification: "catalog",
      pointer: "/surfaces/main/root/behaviors/1/use",
      context: subjectContext("main", "behavior", "sortable-2", SORTABLE),
      mutation: "attach-second-exclusive-behavior",
      positive: () =>
        sourceInvocation(fixtures, minimalSource(fixtures.validSource, behaviorRoot(1))),
      negative: () =>
        sourceInvocation(fixtures, minimalSource(fixtures.validSource, behaviorRoot(2))),
    }),
    coreVector({
      id: "state-write-invalid",
      traceId: "D-019",
      code: "STATE_WRITE_INVALID",
      classification: "runtime",
      pointer: "/surfaces/main/root/on/press/0/value",
      context: subjectContext("main", "node", "actor", BUTTON),
      mutation: "replace-state-write-string-with-number",
      positive: () =>
        sourceInvocation(
          fixtures,
          actionSource(
            fixtures,
            { type: "state.set", path: "label", value: "next" },
            {
              label: stateEntry({ type: "string" }, "current"),
            },
          ),
        ),
      negative: () =>
        sourceInvocation(
          fixtures,
          actionSource(
            fixtures,
            { type: "state.set", path: "label", value: 42 },
            {
              label: stateEntry({ type: "string" }, "current"),
            },
          ),
        ),
    }),
    coreVector({
      id: "reference-unresolved",
      traceId: "D-020",
      code: "REFERENCE_UNRESOLVED",
      classification: "runtime",
      pointer: "/surfaces/main/root/props/text/$ref",
      context: subjectContext("main", "node", "text", TEXT),
      mutation: "remove-referenced-state-declaration",
      positive: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, text("text", { $ref: "state.label" }), {
            label: stateEntry({ type: "string" }, "ready"),
          }),
        ),
      negative: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, text("text", { $ref: "state.label" })),
        ),
    }),
    coreVector({
      id: "predicate-type-mismatch",
      traceId: "D-021",
      code: "PREDICATE_TYPE_MISMATCH",
      classification: "runtime",
      pointer: "/surfaces/main/root/when/args/0",
      context: subjectContext("main", "node", "text", TEXT),
      mutation: "replace-ordered-number-with-boolean",
      positive: () => {
        const root = text();
        root.when = { op: "gt", args: [2, 1] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = text();
        root.when = { op: "gt", args: [true, 1] };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "repeat-items-invalid",
      traceId: "D-022",
      code: "REPEAT_ITEMS_INVALID",
      classification: "runtime",
      pointer: "/surfaces/main/root/repeat/items",
      context: subjectContext("main", "node", "text", TEXT),
      mutation: "replace-repeat-array-with-string",
      positive: () => {
        const root = text();
        root.repeat = { items: [], as: "row", key: { $ref: "item.row.id" } };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = text();
        root.repeat = { items: "not-an-array", as: "row", key: "static" };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "repeat-key-invalid",
      traceId: "D-023",
      code: "REPEAT_KEY_INVALID",
      classification: "runtime",
      pointer: "/surfaces/main/root/repeat/key",
      context: subjectContext("main", "node", "text", TEXT),
      mutation: "duplicate-resolved-repeat-key",
      positive: () => {
        const root = text();
        root.repeat = {
          items: [{ id: "first" }, { id: "second" }],
          as: "row",
          key: { $ref: "item.row.id" },
        };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
      negative: () => {
        const root = text();
        root.repeat = {
          items: [{ id: "same" }, { id: "same" }],
          as: "row",
          key: { $ref: "item.row.id" },
        };
        return sourceInvocation(fixtures, minimalSource(fixtures.validSource, root));
      },
    }),
    coreVector({
      id: "operation-input-invalid",
      traceId: "D-024",
      code: "OPERATION_INPUT_INVALID",
      classification: "runtime",
      pointer: "/password",
      context: capabilityContext(SIGN_IN),
      mutation: "replace-nonempty-operation-password-with-empty-string",
      positive: () =>
        valueInvocation(
          fixtures,
          { email: "person@example.com", password: "secret" },
          operationInput,
        ),
      negative: () =>
        valueInvocation(fixtures, { email: "person@example.com", password: "" }, operationInput),
    }),
    coreVector({
      id: "operation-output-invalid",
      traceId: "D-025",
      code: "OPERATION_OUTPUT_INVALID",
      classification: "runtime",
      pointer: "/userId",
      context: capabilityContext(SIGN_IN),
      mutation: "replace-operation-output-string-with-number",
      positive: () => valueInvocation(fixtures, { userId: "user-1" }, operationOutput),
      negative: () => valueInvocation(fixtures, { userId: 1 }, operationOutput),
    }),
    coreVector({
      id: "resource-input-invalid",
      traceId: "D-027",
      code: "RESOURCE_INPUT_INVALID",
      classification: "runtime",
      pointer: "/extra",
      context: capabilityContext(STORES),
      mutation: "add-closed-resource-input-field",
      positive: () => valueInvocation(fixtures, {}, resourceInput),
      negative: () => valueInvocation(fixtures, { extra: true }, resourceInput),
    }),
    coreVector({
      id: "resource-output-invalid",
      traceId: "D-028",
      code: "RESOURCE_OUTPUT_INVALID",
      classification: "runtime",
      pointer: "/bounds",
      context: capabilityContext(STORES),
      mutation: "remove-required-resource-output-field",
      positive: () => valueInvocation(fixtures, { items: [], bounds: {} }, resourceOutput),
      negative: () => valueInvocation(fixtures, { items: [] }, resourceOutput),
    }),
    coreVector({
      id: "unsupported-protocol",
      traceId: "D-034",
      code: "UNSUPPORTED_PROTOCOL",
      classification: "activation",
      pointer: "/desen",
      mutation: "replace-supported-protocol-version",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        writeAt(changed, ["desen"], "0.2.0");
        return sourceInvocation(fixtures, changed);
      },
    }),
    extensionVector({
      id: "invalid-semver",
      code: "run.desen.validator/INVALID_SEMVER",
      pointer: "/0/version",
      mutation: "introduce-leading-zero-prerelease",
      positive: () => catalogInvocation(catalog()),
      negative: () => {
        const changed = catalog();
        writeAt(changed, ["version"], "1.0.0-01");
        return catalogInvocation(changed);
      },
    }),
    extensionVector({
      id: "catalog-requirement-mismatch",
      code: "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH",
      pointer: "/catalogs/0",
      context: documentContext,
      mutation: "change-required-target-case",
      positive: () => sourceInvocation(fixtures, source()),
      negative: () => {
        const changed = source();
        writeAt(changed, ["catalogs", 0, "target"], "Web-React");
        return sourceInvocation(fixtures, changed);
      },
    }),
    extensionVector({
      id: "invalid-component-contract",
      code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
      pointer: "/0/components/com.example.ui~1Button/propsSchema/properties/label/pattern",
      context: capabilityContext(BUTTON),
      mutation: "add-unsafe-component-pattern",
      positive: () => catalogInvocation(catalog()),
      negative: () => {
        const changed = catalog();
        recordAt(changed, ["components", BUTTON, "propsSchema", "properties", "label"]).pattern =
          "^(a+)+$";
        return catalogInvocation(changed);
      },
    }),
    extensionVector({
      id: "invalid-interaction-contract",
      code: "run.desen.validator/INVALID_INTERACTION_CONTRACT",
      pointer: "/0/behaviors/com.example.interactions~1Sortable/slots/dragPreview",
      context: capabilityContext(SORTABLE),
      mutation: "make-behavior-slot-range-impossible",
      positive: () => catalogInvocation(catalog()),
      negative: () => {
        const changed = catalog();
        const slot = recordAt(changed, ["behaviors", SORTABLE, "slots", "dragPreview"]);
        slot.required = true;
        delete slot.minItems;
        slot.maxItems = 0;
        return catalogInvocation(changed);
      },
    }),
    extensionVector({
      id: "invalid-binding-contract",
      code: "run.desen.validator/INVALID_BINDING_CONTRACT",
      pointer: "/surfaces/main/state/label/initial",
      context: surfaceContext,
      mutation: "replace-state-initial-string-with-number",
      positive: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, text(), {
            label: stateEntry({ type: "string" }, "ready"),
          }),
        ),
      negative: () =>
        sourceInvocation(
          fixtures,
          minimalSource(fixtures.validSource, text(), {
            label: stateEntry({ type: "string" }, 42),
          }),
        ),
    }),
    extensionVector({
      id: "invalid-execution-contract",
      code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
      pointer: "/0/operations/com.example.auth~1signIn/inputSchema/properties/value/pattern",
      context: capabilityContext(SIGN_IN),
      mutation: "add-unsafe-operation-input-pattern",
      positive: () => catalogInvocation(catalog()),
      negative: () => {
        const changed = catalog();
        recordAt(changed, ["operations", SIGN_IN]).inputSchema = {
          type: "object",
          properties: { value: { type: "string", pattern: "^(a+)+$" } },
        };
        return catalogInvocation(changed);
      },
    }),
  ]);
}

function executeInvocation(api: ValidatorApi, invocation: Invocation): ResultLike {
  const catalogs = api.validateDesenExecutionCatalogSet(invocation.catalogs);
  if (invocation.route === "catalog-set" || !catalogs.valid) return catalogs;

  switch (invocation.route) {
    case "source":
      return api.validateDesenSourceExecutionContracts(invocation.source, catalogs.value);
    case "event-payload":
      return api.validateDesenEventPayload(invocation.payload, invocation.selector, catalogs.value);
    case "execution-value":
      return api.validateDesenExecutionValue(invocation.value, invocation.selector, catalogs.value);
  }
}

function normalizeDiagnostics(diagnostics: readonly DiagnosticLike[]) {
  return Object.freeze(
    diagnostics.map(({ code, classification, pointer, context }) =>
      Object.freeze({
        code,
        ...(classification === undefined ? {} : { classification }),
        ...(pointer === undefined ? {} : { pointer }),
        ...(context === undefined ? {} : { context }),
      }),
    ),
  );
}

interface CapturedOwnProperty {
  readonly key: PropertyKey;
  readonly descriptor: PropertyDescriptor;
}

interface CapturedObject {
  readonly extensible: boolean;
  readonly prototype: object | null;
  readonly properties: readonly CapturedOwnProperty[];
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

/**
 * Captures the complete own-property graph without invoking accessors.
 *
 * JSON serialization is intentionally insufficient here: Symbols, non-enumerable properties,
 * descriptor changes, prototype changes, and object replacement are all observable mutations.
 */
function captureObjectGraph(root: unknown): ReadonlyMap<object, CapturedObject> {
  const captured = new Map<object, CapturedObject>();
  const pending: object[] = isObjectLike(root) ? [root] : [];

  while (pending.length > 0) {
    const value = pending.pop();
    if (value === undefined || captured.has(value)) continue;

    const properties = Reflect.ownKeys(value).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        throw new TypeError("An own property disappeared while its graph was being captured.");
      }

      if (Object.hasOwn(descriptor, "value") && isObjectLike(descriptor.value)) {
        pending.push(descriptor.value);
      } else {
        if (isObjectLike(descriptor.get)) pending.push(descriptor.get);
        if (isObjectLike(descriptor.set)) pending.push(descriptor.set);
      }

      return Object.freeze({ key, descriptor: Object.freeze({ ...descriptor }) });
    });

    captured.set(
      value,
      Object.freeze({
        extensible: Object.isExtensible(value),
        prototype: Object.getPrototypeOf(value) as object | null,
        properties: Object.freeze(properties),
      }),
    );
  }

  return captured;
}

function descriptorUnchanged(expected: PropertyDescriptor, observed: PropertyDescriptor): boolean {
  if (
    expected.configurable !== observed.configurable ||
    expected.enumerable !== observed.enumerable ||
    Object.hasOwn(expected, "value") !== Object.hasOwn(observed, "value")
  ) {
    return false;
  }

  if (Object.hasOwn(expected, "value")) {
    return expected.writable === observed.writable && Object.is(expected.value, observed.value);
  }

  return Object.is(expected.get, observed.get) && Object.is(expected.set, observed.set);
}

function objectGraphUnchanged(captured: ReadonlyMap<object, CapturedObject>): boolean {
  for (const [value, expected] of captured) {
    if (
      Object.isExtensible(value) !== expected.extensible ||
      Object.getPrototypeOf(value) !== expected.prototype
    ) {
      return false;
    }

    const keys = Reflect.ownKeys(value);
    if (keys.length !== expected.properties.length) return false;

    for (let index = 0; index < keys.length; index += 1) {
      const property = expected.properties[index];
      const key = keys[index];
      if (property === undefined || key === undefined || !Object.is(key, property.key))
        return false;

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptorUnchanged(property.descriptor, descriptor)) {
        return false;
      }
    }
  }

  return true;
}

function isDeepFrozen(root: unknown): boolean {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      continue;
    }
    if (!isObjectLike(value) || visited.has(value)) return false;

    const prototype = Object.getPrototypeOf(value) as object | null;
    const isArray = Array.isArray(value);
    if (!isArray && prototype !== Object.prototype && prototype !== null) return false;

    visited.add(value);
    if (!Object.isFrozen(value)) return false;

    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) return false;
    if (
      isArray &&
      (keys.length !== value.length + 1 ||
        keys.at(-1) !== "length" ||
        !Array.from({ length: value.length }, (_, index) => String(index)).every(
          (key, index) => keys[index] === key,
        ))
    ) {
      return false;
    }

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      // Accessors can expose mutable state that cannot be proven frozen without invoking code.
      if (descriptor === undefined || !Object.hasOwn(descriptor, "value")) return false;
      // Hidden data and collection/internal-slot objects are not part of inert JSON results.
      if ((!isArray || key !== "length") && descriptor.enumerable !== true) return false;
      pending.push(descriptor.value);
    }
  }
  return true;
}

function sameOwnPropertyGraph(leftRoot: unknown, rightRoot: unknown): boolean {
  const leftToRight = new Map<object, object>();
  const rightToLeft = new Map<object, object>();

  function visit(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (!isObjectLike(left) || !isObjectLike(right)) return false;

    const knownRight = leftToRight.get(left);
    const knownLeft = rightToLeft.get(right);
    if (knownRight !== undefined || knownLeft !== undefined) {
      return knownRight === right && knownLeft === left;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);

    if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
    const leftKeys = Reflect.ownKeys(left);
    const rightKeys = Reflect.ownKeys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    for (let index = 0; index < leftKeys.length; index += 1) {
      const leftKey = leftKeys[index];
      const rightKey = rightKeys[index];
      if (leftKey === undefined || rightKey === undefined || !Object.is(leftKey, rightKey)) {
        return false;
      }

      const leftDescriptor = Object.getOwnPropertyDescriptor(left, leftKey);
      const rightDescriptor = Object.getOwnPropertyDescriptor(right, rightKey);
      if (
        leftDescriptor === undefined ||
        rightDescriptor === undefined ||
        leftDescriptor.configurable !== rightDescriptor.configurable ||
        leftDescriptor.enumerable !== rightDescriptor.enumerable ||
        Object.hasOwn(leftDescriptor, "value") !== Object.hasOwn(rightDescriptor, "value")
      ) {
        return false;
      }

      if (Object.hasOwn(leftDescriptor, "value")) {
        if (
          leftDescriptor.writable !== rightDescriptor.writable ||
          !visit(leftDescriptor.value, rightDescriptor.value)
        ) {
          return false;
        }
      } else if (
        !Object.is(leftDescriptor.get, rightDescriptor.get) ||
        !Object.is(leftDescriptor.set, rightDescriptor.set)
      ) {
        return false;
      }
    }

    return true;
  }

  return visit(leftRoot, rightRoot);
}

function expectedDiagnostic(definition: VectorDefinition) {
  return Object.freeze({
    code: definition.code,
    ...(definition.classification === undefined
      ? {}
      : { classification: definition.classification }),
    pointer: definition.pointer,
    ...(definition.context === undefined ? {} : { context: definition.context }),
  });
}

function observe(
  api: ValidatorApi,
  createInvocation: () => Invocation,
): Readonly<{
  valid: boolean;
  diagnostics: ReturnType<typeof normalizeDiagnostics>;
  deepFrozen: boolean;
  inputUnchanged: boolean;
  repeatable: boolean;
}> {
  const firstInvocation = createInvocation();
  const firstInput = captureObjectGraph(firstInvocation);
  const first = executeInvocation(api, firstInvocation);
  const firstInputUnchanged = objectGraphUnchanged(firstInput);

  const secondInvocation = createInvocation();
  const secondInput = captureObjectGraph(secondInvocation);
  const second = executeInvocation(api, secondInvocation);
  const secondInputUnchanged = objectGraphUnchanged(secondInput);
  const firstDiagnostics = normalizeDiagnostics(first.diagnostics);
  return Object.freeze({
    valid: first.valid,
    diagnostics: firstDiagnostics,
    deepFrozen: isDeepFrozen(first) && isDeepFrozen(second),
    inputUnchanged: firstInputUnchanged && secondInputUnchanged,
    repeatable: sameOwnPropertyGraph(first, second),
  });
}

/**
 * Runs the exact M02-T13 positive/negative diagnostic micro-vector contract against a validator
 * API and the frozen valid Source/Catalog fixtures supplied by the caller.
 *
 * @remarks The helper is test-only and is deliberately not exported by `@desen/validator`.
 * Every pair crosses one documented boundary, retains the exact diagnostic identity and pointer,
 * and records output immutability, caller-input isolation, and repeated-run determinism.
 */
export function runValidatorDiagnosticMicroVectorSuite(
  api: ValidatorApi,
  fixtures: FrozenFixtures,
) {
  const definitions = buildDefinitions(fixtures);
  const cases = definitions.map((definition) => {
    const positive = observe(api, definition.positive);
    const negative = observe(api, definition.negative);
    const expected = expectedDiagnostic(definition);
    const pass =
      positive.valid &&
      positive.diagnostics.length === 0 &&
      positive.deepFrozen &&
      positive.inputUnchanged &&
      positive.repeatable &&
      !negative.valid &&
      negative.diagnostics.length === 1 &&
      JSON.stringify(negative.diagnostics[0]) === JSON.stringify(expected) &&
      negative.deepFrozen &&
      negative.inputUnchanged &&
      negative.repeatable;

    return Object.freeze({
      id: definition.id,
      ...(definition.traceId === undefined ? {} : { traceId: definition.traceId }),
      scope: definition.scope,
      route: definition.positive().route,
      mutation: definition.mutation,
      expected,
      positive,
      negative,
      pass,
    });
  });
  const core = cases.filter(({ scope }) => scope === "core").length;
  const extensions = cases.filter(({ scope }) => scope === "extension").length;

  return Object.freeze({
    profile: "desen-validator-diagnostic-micro-vectors-v1",
    protocolVersion: "0.1.0",
    excludedCoreDiagnostics: EXCLUDED_CORE_DIAGNOSTICS,
    cases: Object.freeze(cases),
    summary: Object.freeze({
      diagnosticCodes: cases.length,
      core,
      extensions,
      positiveVectors: cases.length,
      negativeVectors: cases.length,
      passingPairs: cases.filter(({ pass }) => pass).length,
      pass: cases.every(({ pass }) => pass),
    }),
  });
}
