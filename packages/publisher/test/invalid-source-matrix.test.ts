import { describe, expect, it } from "vitest";

import sourceDuplicateNodeId from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-duplicate-node-id.json";
import sourceUnknownCapability from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-capability.json";
import sourceUnknownCoreField from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-core-field.json";
import sourceUnknownEvent from "../../protocol/upstream/0.1.0/snapshot/conformance/invalid/source-unknown-event.json";
import officialSourceFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
import officialCatalogFixture from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
import exampleSortableSource from "../../protocol/upstream/0.1.0/snapshot/examples/sortable-list.source.desen.json";
import exampleStoreMapSource from "../../protocol/upstream/0.1.0/snapshot/examples/store-map.source.desen.json";

import {
  DEPRECATED_CAPABILITY_CODE,
  getPublisherDiagnosticDefinition,
  isPublisherDiagnosticCode,
  PUBLISH_SOURCE_JSON_LIMITS,
  PUBLISHER_DIAGNOSTIC_REGISTRY,
  publishDesenSource,
} from "../src/index.js";

import type {
  PublishCatalogPackageCandidate,
  PublishFailure,
  PublishResult,
  PublishSuccess,
} from "../src/index.js";

type MutableJsonRecord = Record<string, unknown>;
type Mutation = (source: MutableJsonRecord) => void;

interface PublicationInput {
  readonly rawSource: string;
  readonly candidates: readonly PublishCatalogPackageCandidate[];
}

interface InvalidPublicationCase {
  readonly id: string;
  readonly name: string;
  readonly trace: string;
  readonly stage: PublishFailure["stage"];
  readonly code: string;
  readonly makeInput: () => PublicationInput;
  readonly suppressesWarnings?: true;
  readonly forbiddenFragments?: readonly string[];
  readonly requiredDiagnosticCapabilityIds?: readonly string[];
}

interface LongSlotTraceOptions {
  readonly leaf: MutableJsonRecord;
  readonly state: MutableJsonRecord;
  readonly acceptedCategories: readonly string[];
  readonly deprecatedText?: true;
}

const ALTERNATE_DIGEST = `sha256:${"1".repeat(64)}`;
const CATALOG_CANDIDATE_LIMIT_CROSSING = 1_025;
const CATALOG_REQUIREMENT_LIMIT_CROSSING = 257;
const CATALOG_IDENTITY_LIMIT_CROSSING_CODE_UNITS = 4_097;
const CATALOG_DEPTH_LIMIT_CROSSING = 129;
const CATALOG_VALUE_LIMIT_CROSSING = 100_001;
const CATALOG_STRING_LIMIT_CROSSING_CODE_UNITS = 4_194_305;
const CATALOG_SINGLE_BYTE_LIMIT_CONTROL_CODE_UNITS = 2_800_000;
const CATALOG_AGGREGATE_BYTE_LIMIT_CONTROL_CODE_UNITS = 1_900_000;
const CATALOG_AGGREGATE_BYTE_LIMIT_CATALOGS = 6;
const CATALOG_DIAGNOSTIC_LIMIT_CROSSING = 1_025;
const CATALOG_CAPABILITIES_PER_AGGREGATE_CATALOG = 34_000;
const CATALOG_AGGREGATE_CAPABILITY_CATALOGS = 3;
const NAMESPACE_DIAGNOSTIC_LIMIT_CROSSING = 1_025;
const CAPABILITY_DIAGNOSTIC_POINTER_KEY_CODE_UNITS = 4_097;
const CAPABILITY_DIAGNOSTIC_AGGREGATE_COUNT = 1_024;
const CAPABILITY_DIAGNOSTIC_AGGREGATE_KEY_PREFIX_CODE_UNITS = 1_018;
const DEPRECATED_WARNING_LIMIT_CROSSING = 1_025;
const DEPRECATED_WARNING_AGGREGATE_COUNT = 1_024;
const DEPRECATED_WARNING_AGGREGATE_DOCUMENT_ID_CODE_UNITS = 1_024;
const RUNTIME_OBLIGATION_LIMIT = 4_096;
const OFFICIAL_NON_EMAIL_WRITE_OBLIGATIONS = 6;
const EXACT_EMAIL_WRITE_ACTIONS = RUNTIME_OBLIGATION_LIMIT - OFFICIAL_NON_EMAIL_WRITE_OBLIGATIONS;
const EXCESS_EMAIL_WRITE_ACTIONS = EXACT_EMAIL_WRITE_ACTIONS + 1;
const RUNTIME_OBLIGATION_POINTER_LIMIT = 4_096;
const HOME_TITLE_PROP_POINTER_PREFIX = "/surfaces/home/root/slots/default/0/props/";
const EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS =
  RUNTIME_OBLIGATION_POINTER_LIMIT - HOME_TITLE_PROP_POINTER_PREFIX.length;
const RUNTIME_OBLIGATION_AGGREGATE_LIMIT = 1_048_576;
const MAX_POINTER_AGGREGATE_PROP_COUNT = 251;
const EXACT_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS = 806;
const EXCESS_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS = EXACT_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS + 1;
const OFFICIAL_RUNTIME_OBLIGATION_AGGREGATE_CODE_UNITS = 984;
const HOME_TITLE_COMPONENT_PROP_CONTEXT_CODE_UNITS = 74;
const FINAL_BUNDLE_MAX_SUCCESS_PAYLOAD_CODE_UNITS = 2_094_967;
const FINAL_BUNDLE_FIRST_FAILURE_PAYLOAD_CODE_UNITS = 2_094_968;
const FINAL_BUNDLE_LIMIT_PAYLOAD_CODE_UNITS = 2_095_000;
const NORMALIZATION_LAST_ADMITTED_PAYLOAD_CODE_UNITS = 2_095_322;
const NORMALIZATION_FIRST_FAILURE_PAYLOAD_CODE_UNITS = 2_095_323;
const NORMALIZATION_LIMIT_PAYLOAD_CODE_UNITS = 2_096_000;
const SOURCE_NODE_TRACE_LIMIT_CROSSING = 25_001;
const SOURCE_NODE_POINTER_SLOT_CODE_UNITS = 128;
const SOURCE_NODE_POINTER_STACK_COUNT = 31;
const SOURCE_NODE_AGGREGATE_CHILDREN = 15_000;
const SOURCE_NODE_AGGREGATE_DOCUMENT_ID_CODE_UNITS = 256;
const INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS = 60_000;

const EXPECTED_PUBLISHER_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.publisher/INVALID_SOURCE_JSON",
  "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
  "run.desen.publisher/DEPRECATED_CAPABILITY",
  "run.desen.publisher/INVALID_CATALOG_INPUT",
  "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/EXECUTION_PREFLIGHT_AUTHORITY_INVALID",
  "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID",
  "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
  "run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID",
  "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED",
  "run.desen.publisher/BUNDLE_VALIDATION_AUTHORITY_INVALID",
] as const);

const TOTAL_PUBLIC_STAGES_WITHOUT_DATA_NEGATIVES = Object.freeze([
  "source-digest",
  "authoring-removal",
  "catalog-pinning",
  "bundle-revision",
] as const);

const PARTIAL_AUTHORITY_FIELDS = Object.freeze([
  "bundle",
  "value",
  "source",
  "catalogSet",
  "packages",
  "requirementPackageIndexes",
  "preflighted",
  "capabilityPreflighted",
  "executionPreflighted",
  "preserved",
  "preservedDocument",
  "sourceNodeTrace",
  "normalized",
  "normalizedDocument",
  "catalogsPinned",
  "pinnedDocument",
  "sourceCatalogRequirements",
  "sourceDigest",
  "obligations",
  "traceability",
  "revision",
] as const);

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function record(value: unknown, label = "test fixture value"): MutableJsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value as MutableJsonRecord;
}

function array(value: unknown, label = "test fixture value"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be a JSON array.`);
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

function freshCandidate(
  catalog: unknown = cloneJson(officialCatalogFixture),
  overrides: Partial<Omit<PublishCatalogPackageCandidate, "catalog">> = {},
): PublishCatalogPackageCandidate {
  const identity = record(catalog, "Catalog fixture");
  return {
    id: String(identity.id),
    version: String(identity.version),
    target: String(identity.target),
    observedPackageDigest: String(identity.packageDigest),
    catalog,
    ...overrides,
  };
}

function officialInput(sourceMutation?: Mutation, catalogMutation?: Mutation): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Official Source");
  const catalog = record(cloneJson(officialCatalogFixture), "Official Catalog");
  sourceMutation?.(source);
  catalogMutation?.(catalog);
  return {
    rawSource: JSON.stringify(source),
    candidates: [freshCandidate(catalog)],
  };
}

function fixtureInput(source: unknown): PublicationInput {
  return {
    rawSource: JSON.stringify(source),
    candidates: [freshCandidate()],
  };
}

function sourceAndCatalogInput(source: unknown, catalog: unknown): PublicationInput {
  return {
    rawSource: JSON.stringify(source),
    candidates: [freshCandidate(catalog)],
  };
}

function catalogSetInput(catalogs: readonly MutableJsonRecord[]): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Multi-Catalog Source");
  source.catalogs = catalogs.map((catalog) => ({
    id: String(catalog.id),
    version: String(catalog.version),
    target: String(catalog.target),
  }));
  return {
    rawSource: JSON.stringify(source),
    candidates: catalogs.map((catalog) => freshCandidate(catalog)),
  };
}

function emptyCapabilityCatalog(id: string): MutableJsonRecord {
  const catalog = record(cloneJson(officialCatalogFixture), "Empty-capability Catalog");
  catalog.id = id;
  catalog.components = {};
  catalog.behaviors = {};
  catalog.operations = {};
  catalog.resources = {};
  catalog.extensions = {};
  return catalog;
}

function sourceSchemaDiagnosticCountInput(): PublicationInput {
  return officialInput((source) => {
    for (let index = 0; index < 1_025; index += 1) {
      source[`unknown${index}`] = true;
    }
  });
}

function sourceSchemaDiagnosticPointerInput(): PublicationInput {
  return officialInput((source) => {
    source["x".repeat(4_097)] = true;
  });
}

function sourceSchemaDiagnosticAggregateInput(): PublicationInput {
  return officialInput((source) => {
    for (let index = 0; index < 1_024; index += 1) {
      source[`${"x".repeat(1_018)}${String(index).padStart(6, "0")}`] = true;
    }
  });
}

function inheritedRawJsonPointerLimitInput(): PublicationInput {
  const ancestor = "x".repeat(4_097);
  return {
    rawSource: `{"${ancestor}":{"duplicate":1,"duplicate":2}}`,
    candidates: [freshCandidate()],
  };
}

function inheritedCatalogDiagnosticAggregateInput(): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Catalog-report aggregate Source");
  source.id = "D".repeat(4_096);
  source.catalogs = Array.from({ length: 256 }, (_, index) => ({
    id: `com.example.missing-${index}`,
    version: "1.0.0",
    target: "web-react",
  }));
  return {
    rawSource: JSON.stringify(source),
    candidates: [],
  };
}

function catalogRequirementLimitInput(): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Requirement-limit Source");
  source.catalogs = Array.from({ length: CATALOG_REQUIREMENT_LIMIT_CROSSING }, () =>
    cloneJson(officialSourceFixture.catalogs[0]),
  );
  return {
    rawSource: JSON.stringify(source),
    candidates: [freshCandidate()],
  };
}

function catalogIdentityLimitInput(): PublicationInput {
  return {
    rawSource: JSON.stringify(officialSourceFixture),
    candidates: [
      freshCandidate(),
      {
        id: "x".repeat(CATALOG_IDENTITY_LIMIT_CROSSING_CODE_UNITS),
        version: "1.0.0",
        target: "unselected",
        observedPackageDigest: ALTERNATE_DIGEST,
        catalog: null,
      },
    ],
  };
}

function catalogDepthLimitInput(): PublicationInput {
  return officialInput(undefined, (catalog) => {
    const extensionRoot: MutableJsonRecord = {};
    catalog.extensions = { nested: extensionRoot };
    let cursor = extensionRoot;
    for (let depth = 0; depth < CATALOG_DEPTH_LIMIT_CROSSING; depth += 1) {
      const next: MutableJsonRecord = {};
      cursor.next = next;
      cursor = next;
    }
  });
}

function catalogValueLimitInput(): PublicationInput {
  return officialInput(undefined, (catalog) => {
    catalog.extensions = {
      values: Array.from({ length: CATALOG_VALUE_LIMIT_CROSSING }, () => null),
    };
  });
}

function catalogStringLimitInput(): PublicationInput {
  return officialInput(undefined, (catalog) => {
    catalog.extensions = {
      payload: "x".repeat(CATALOG_STRING_LIMIT_CROSSING_CODE_UNITS),
    };
  });
}

function catalogSingleByteLimitInput(): PublicationInput {
  return officialInput(undefined, (catalog) => {
    catalog.extensions = {
      payload: "\u0001".repeat(CATALOG_SINGLE_BYTE_LIMIT_CONTROL_CODE_UNITS),
    };
  });
}

function catalogAggregateByteLimitInput(): PublicationInput {
  const catalogs = Array.from({ length: CATALOG_AGGREGATE_BYTE_LIMIT_CATALOGS }, (_, index) => {
    const catalog = emptyCapabilityCatalog(`com.example.aggregate-bytes-${index}`);
    catalog.extensions = {
      payload: "\u0001".repeat(CATALOG_AGGREGATE_BYTE_LIMIT_CONTROL_CODE_UNITS),
    };
    return catalog;
  });
  return catalogSetInput(catalogs);
}

function catalogDiagnosticLimitInput(): PublicationInput {
  return officialInput(undefined, (catalog) => {
    for (let index = 0; index < CATALOG_DIAGNOSTIC_LIMIT_CROSSING; index += 1) {
      catalog[`unknown${index}`] = true;
    }
  });
}

function catalogAggregateCapabilityLimitInput(): PublicationInput {
  const catalogs = Array.from(
    { length: CATALOG_AGGREGATE_CAPABILITY_CATALOGS },
    (_, catalogIndex) => {
      const catalog = emptyCapabilityCatalog(`com.example.aggregate-capabilities-${catalogIndex}`);
      const components = record(catalog.components, "Aggregate component map");
      for (
        let capabilityIndex = 0;
        capabilityIndex < CATALOG_CAPABILITIES_PER_AGGREGATE_CATALOG;
        capabilityIndex += 1
      ) {
        components[`com.example.c${catalogIndex}/C${capabilityIndex}`] = {
          propsSchema: {},
        };
      }
      return catalog;
    },
  );
  return catalogSetInput(catalogs);
}

function namespaceDiagnosticLimitInput(): PublicationInput {
  const catalogs = Array.from({ length: 2 }, (_, catalogIndex) => {
    const catalog = emptyCapabilityCatalog(`com.example.namespace-report-${catalogIndex}`);
    const components = record(catalog.components, "Namespace component map");
    for (let index = 0; index < NAMESPACE_DIAGNOSTIC_LIMIT_CROSSING; index += 1) {
      components[`com.example.shared/C${index}`] = { propsSchema: {} };
    }
    return catalog;
  });
  return catalogSetInput(catalogs);
}

function capabilityDiagnosticPointerLimitInput(): PublicationInput {
  return officialInput((source) => {
    const props = record(
      valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
      "Home title props",
    );
    props["x".repeat(CAPABILITY_DIAGNOSTIC_POINTER_KEY_CODE_UNITS)] = true;
  });
}

function capabilityDiagnosticAggregateLimitInput(): PublicationInput {
  return officialInput((source) => {
    const props = record(
      valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
      "Home title props",
    );
    for (let index = 0; index < CAPABILITY_DIAGNOSTIC_AGGREGATE_COUNT; index += 1) {
      props[
        `${"x".repeat(CAPABILITY_DIAGNOSTIC_AGGREGATE_KEY_PREFIX_CODE_UNITS)}${String(
          index,
        ).padStart(6, "0")}`
      ] = true;
    }
  });
}

function sourceWithExecutionDefects(
  capabilityDefect: boolean,
  controlFlowDefect: boolean,
  bindingDefect: boolean,
): MutableJsonRecord {
  const source = record(
    cloneJson(capabilityDefect ? sourceUnknownEvent : officialSourceFixture),
    "Execution-precedence Source",
  );
  if (controlFlowDefect) {
    writeAt(source, ["surfaces", "sign-in", "root", "when"], {
      op: "gt",
      args: [true, 1],
    });
  }
  if (bindingDefect) {
    writeAt(source, ["surfaces", "sign-in", "root", "slots", "default", 1, "props", "value"], {
      $ref: "state.missing",
    });
  }
  return source;
}

function sourceNodeTraceLimitInput(): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Source-node trace-limit Source");
  source.entry = "trace";
  source.surfaces = {
    trace: {
      id: "trace",
      state: {},
      resources: {},
      root: {
        id: "trace.root",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
        slots: {
          default: Array.from({ length: SOURCE_NODE_TRACE_LIMIT_CROSSING - 1 }, (_, index) => ({
            id: `trace.node-${index}`,
            use: "com.example.ui/Text",
            props: { text: "Trace" },
          })),
        },
      },
    },
  };
  Reflect.deleteProperty(source, "authoring");
  return fixtureInput(source);
}

function longSlotTraceInput(options: LongSlotTraceOptions): PublicationInput {
  const slotName = "s".repeat(SOURCE_NODE_POINTER_SLOT_CODE_UNITS);
  let node = options.leaf;
  for (let index = SOURCE_NODE_POINTER_STACK_COUNT - 1; index >= 0; index -= 1) {
    node = {
      id: `n${index}`,
      use: "com.example.ui/Stack",
      props: { direction: "vertical" },
      slots: { [slotName]: [node] },
    };
  }

  return officialInput(
    (source) => {
      source.entry = "trace";
      source.surfaces = {
        trace: {
          id: "trace",
          state: options.state,
          resources: {},
          root: node,
        },
      };
      Reflect.deleteProperty(source, "authoring");
    },
    (catalog) => {
      const slots = record(
        valueAt(catalog, ["components", "com.example.ui/Stack", "slots"]),
        "Stack slot contracts",
      );
      slots[slotName] = {
        required: false,
        minItems: 0,
        acceptsCategories: options.acceptedCategories,
      };
      if (options.deprecatedText === true) {
        const text = record(
          valueAt(catalog, ["components", "com.example.ui/Text"]),
          "Text Catalog declaration",
        );
        text.deprecated = true;
      }
    },
  );
}

function flatTextTraceInput(
  childCount: number,
  documentId: string | undefined,
  deprecatedText: boolean,
): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Flat Text trace Source");
  if (documentId !== undefined) source.id = documentId;
  source.entry = "trace";
  source.surfaces = {
    trace: {
      id: "trace",
      state: {},
      resources: {},
      root: {
        id: "trace.root",
        use: "com.example.ui/Stack",
        props: { direction: "vertical" },
        slots: {
          default: Array.from({ length: childCount }, (_, index) => ({
            id: `n${index}`,
            use: "com.example.ui/Text",
            props: { text: "x" },
          })),
        },
      },
    },
  };
  Reflect.deleteProperty(source, "authoring");
  const catalog = record(cloneJson(officialCatalogFixture), "Flat Text trace Catalog");
  if (deprecatedText) {
    const text = record(
      valueAt(catalog, ["components", "com.example.ui/Text"]),
      "Text Catalog declaration",
    );
    text.deprecated = true;
  }
  return sourceAndCatalogInput(source, catalog);
}

function deprecatedWarningCountLimitInput(): PublicationInput {
  return flatTextTraceInput(DEPRECATED_WARNING_LIMIT_CROSSING, undefined, true);
}

function deprecatedWarningPointerLimitInput(): PublicationInput {
  return longSlotTraceInput({
    leaf: {
      id: "leaf",
      use: "com.example.ui/Text",
      props: { text: "x" },
    },
    state: {},
    acceptedCategories: ["layout", "content"],
    deprecatedText: true,
  });
}

function deprecatedWarningAggregateLimitInput(): PublicationInput {
  return flatTextTraceInput(
    DEPRECATED_WARNING_AGGREGATE_COUNT,
    "D".repeat(DEPRECATED_WARNING_AGGREGATE_DOCUMENT_ID_CODE_UNITS),
    true,
  );
}

function sourceNodePointerLimitInput(): PublicationInput {
  return longSlotTraceInput({
    leaf: {
      id: "leaf",
      use: "com.example.ui/Text",
      props: { text: "x" },
    },
    state: {},
    acceptedCategories: ["layout", "content"],
  });
}

function sourceNodeAggregateLimitInput(): PublicationInput {
  return flatTextTraceInput(
    SOURCE_NODE_AGGREGATE_CHILDREN,
    "D".repeat(SOURCE_NODE_AGGREGATE_DOCUMENT_ID_CODE_UNITS),
    false,
  );
}

function pressActions(source: unknown): unknown[] {
  return array(
    valueAt(source, ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press"]),
    "Sign-in press actions",
  );
}

function sourceWithEmailWriteActions(actionCount: number): MutableJsonRecord {
  const source = record(cloneJson(officialSourceFixture), "Obligation-limit Source");
  const actions = array(
    valueAt(source, ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change"]),
    "Email change actions",
  );
  actions.length = 0;
  for (let index = 0; index < actionCount; index += 1) {
    actions.push({
      type: "state.set",
      path: "email",
      value: { $ref: "event.value" },
    });
  }
  return source;
}

function executionDiagnosticLimitInput(actionCount: number, documentId?: string): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Execution-diagnostic-limit Source");
  if (documentId !== undefined) source.id = documentId;
  writeAt(
    source,
    ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change"],
    Array.from({ length: actionCount }, () => ({
      type: "state.set",
      path: "email",
      value: 42,
    })),
  );
  return fixtureInput(source);
}

function executionDiagnosticPointerLimitInput(): PublicationInput {
  return longSlotTraceInput({
    leaf: {
      id: "leaf",
      use: "com.example.ui/Button",
      props: { label: "x" },
      on: {
        press: [
          {
            type: "state.set",
            path: "email",
            value: 42,
          },
        ],
      },
    },
    state: {
      email: {
        schema: { type: "string" },
        initial: "",
      },
    },
    acceptedCategories: ["layout", "action"],
  });
}

function obligationPropKey(index: number, codeUnits: number): string {
  const suffix = String(index).padStart(8, "0");
  if (codeUnits < suffix.length) {
    throw new TypeError("An obligation property key must admit its stable numeric suffix.");
  }
  return `${"p".repeat(codeUnits - suffix.length)}${suffix}`;
}

function obligationPropInput(
  maxPointerPropCount: number,
  tailPropKeyCodeUnits?: number,
): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Obligation-pointer Source");
  const catalog = record(cloneJson(officialCatalogFixture), "Obligation-pointer Catalog");
  const props = record(
    valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
    "Home title props",
  );
  const propertySchemas = record(
    valueAt(catalog, ["components", "com.example.ui/Text", "propsSchema", "properties"]),
    "Text property schemas",
  );
  for (let index = 0; index < maxPointerPropCount; index += 1) {
    const key = obligationPropKey(index, EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS);
    props[key] = { $ref: "context.runtimeTitle", fallback: "Welcome" };
    propertySchemas[key] = { type: "string" };
  }
  if (tailPropKeyCodeUnits !== undefined) {
    const key = obligationPropKey(maxPointerPropCount, tailPropKeyCodeUnits);
    props[key] = { $ref: "context.runtimeTitle", fallback: "Welcome" };
    propertySchemas[key] = { type: "string" };
  }
  return sourceAndCatalogInput(source, catalog);
}

function namespaceConflictInput(): PublicationInput {
  const source = record(cloneJson(officialSourceFixture), "Namespace-conflict Source");
  const secondCatalogId = "com.example.second-web-catalog";
  array(source.catalogs, "Source Catalog requirements").push({
    id: secondCatalogId,
    version: officialCatalogFixture.version,
    target: officialCatalogFixture.target,
  });

  const secondCatalog = record(
    cloneJson(officialCatalogFixture),
    "Second namespace-conflicting Catalog",
  );
  secondCatalog.id = secondCatalogId;
  return {
    rawSource: JSON.stringify(source),
    candidates: [freshCandidate(), freshCandidate(secondCatalog)],
  };
}

function catalogCandidateLimitInput(): PublicationInput {
  const minimalCandidate = (): PublishCatalogPackageCandidate => ({
    id: "com.example.unselected",
    version: "1.0.0",
    target: "test",
    observedPackageDigest: ALTERNATE_DIGEST,
    catalog: null,
  });
  return {
    rawSource: JSON.stringify(officialSourceFixture),
    candidates: Array.from({ length: CATALOG_CANDIDATE_LIMIT_CROSSING }, minimalCandidate),
  };
}

function candidateInputSnapshot(candidates: readonly PublishCatalogPackageCandidate[]): string {
  const serialized = JSON.stringify(candidates);
  if (serialized === undefined) throw new TypeError("Candidate input must be serializable.");
  return serialized;
}

function expectRecursivelyFrozen(root: unknown): void {
  const pending: unknown[] = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor) pending.push(descriptor.value);
    }
  }
}

function publishWithoutInputMutation(input: PublicationInput): PublishResult {
  const rawBefore = input.rawSource;
  const candidatesBefore = candidateInputSnapshot(input.candidates);
  const result = publishDesenSource(input.rawSource, input.candidates);
  expect(input.rawSource).toBe(rawBefore);
  expect(candidateInputSnapshot(input.candidates)).toBe(candidatesBefore);
  return result;
}

function expectFailure(
  result: PublishResult,
  testCase: InvalidPublicationCase,
): asserts result is PublishFailure {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError(`Expected ${testCase.id} to reject publication.`);

  expect(Object.keys(result).sort()).toEqual(["diagnostics", "ok", "stage"]);
  expect(result.stage).toBe(testCase.stage);
  expect(result.diagnostics.length).toBeGreaterThan(0);
  expect(result.diagnostics[0]).toMatchObject({
    code: testCase.code,
    severity: "error",
    stage: testCase.stage,
  });
  expect(result.diagnostics.every(({ severity }) => severity === "error")).toBe(true);
  for (const field of PARTIAL_AUTHORITY_FIELDS) {
    expect(Object.hasOwn(result, field), `${testCase.id} exposed ${field}`).toBe(false);
  }
  expectRecursivelyFrozen(result);

  const serialized = JSON.stringify(result);
  for (const fragment of testCase.forbiddenFragments ?? []) {
    expect(serialized).not.toContain(fragment);
  }
  if (testCase.suppressesWarnings === true) {
    expect(result.diagnostics.some(({ code }) => code === DEPRECATED_CAPABILITY_CODE)).toBe(false);
    expect(result.diagnostics.some(({ severity }) => severity === "warning")).toBe(false);
  }
  if (testCase.requiredDiagnosticCapabilityIds !== undefined) {
    const capabilityIds = new Set(
      result.diagnostics.map(({ context }) => context?.capabilityId).filter(Boolean),
    );
    for (const capabilityId of testCase.requiredDiagnosticCapabilityIds) {
      expect(capabilityIds.has(capabilityId), `${testCase.id} omitted ${capabilityId}`).toBe(true);
    }
  }
}

function expectSuccess(result: PublishResult, label: string): asserts result is PublishSuccess {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(`Expected ${label} to publish.`);
  expect(Object.keys(result).sort()).toEqual(["bundle", "diagnostics", "ok"]);
  for (const field of PARTIAL_AUTHORITY_FIELDS) {
    if (field !== "bundle")
      expect(Object.hasOwn(result, field), `${label} exposed ${field}`).toBe(false);
  }
  expectRecursivelyFrozen(result);
}

const INVALID_PUBLICATION_CASES: readonly InvalidPublicationCase[] = Object.freeze([
  {
    id: "PIPE-025-malformed-json",
    name: "malformed raw JSON stops before a Source exists",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/INVALID_SOURCE_JSON",
    makeInput: () => ({
      rawSource: '{"kind":"desen.source",',
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-duplicate-member",
    name: "duplicate decoded object names remain non-interoperable",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/INVALID_SOURCE_JSON",
    makeInput: () => ({
      rawSource: '{"kind":"desen.source","\\u006b\\u0069\\u006e\\u0064":"desen.source"}',
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-inherited-diagnostic-pointer-limit",
    name: "an inherited JSON diagnostic pointer beyond 4,096 units is rebound safely",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: inheritedRawJsonPointerLimitInput,
  },
  {
    id: "PIPE-025-raw-source-limit",
    name: "one byte beyond the public raw Source ceiling fails closed",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    makeInput: () => ({
      rawSource: " ".repeat(PUBLISH_SOURCE_JSON_LIMITS.maxSourceUtf8Bytes + 1),
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-lone-surrogate",
    name: "an escaped lone surrogate is rejected as non-interoperable Unicode",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/INVALID_SOURCE_JSON",
    makeInput: () => ({
      rawSource: '{"value":"\\ud800"}',
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-nonfinite-number",
    name: "a JSON number that converts to infinity is rejected before schema work",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/INVALID_SOURCE_JSON",
    makeInput: () => ({
      rawSource: '{"value":1e400}',
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-depth-limit",
    name: "the 257th JSON container level crosses the public depth ceiling",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    makeInput: () => ({
      rawSource: `${"[".repeat(257)}0${"]".repeat(257)}`,
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-value-limit",
    name: "one JSON value occurrence beyond 262,144 fails closed",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    makeInput: () => ({
      rawSource: `[${"0,".repeat(262_143)}0]`,
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-decoded-string-limit",
    name: "one decoded UTF-16 unit beyond 4,194,304 fails closed",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    makeInput: () => ({
      rawSource: `"${"x".repeat(PUBLISH_SOURCE_JSON_LIMITS.maxDecodedStringCodeUnits + 1)}"`,
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-025-number-token-limit",
    name: "one numeric-token code unit beyond 1,024 fails before conversion",
    trace: "PIPE-025",
    stage: "json-parse",
    code: "run.desen.publisher/SOURCE_LIMIT_EXCEEDED",
    makeInput: () => ({
      rawSource: `1${"0".repeat(PUBLISH_SOURCE_JSON_LIMITS.maxNumberTokenCodeUnits)}`,
      candidates: [freshCandidate()],
    }),
  },
  {
    id: "PIPE-026-source-schema",
    name: "a structurally invalid Source emits no Bundle",
    trace: "PIPE-026",
    stage: "source-schema",
    code: "UNKNOWN_CORE_FIELD",
    makeInput: () => fixtureInput(sourceUnknownCoreField),
  },
  {
    id: "PIPE-026-source-root-type",
    name: "a parsed non-object Source fails structural validation",
    trace: "PIPE-026",
    stage: "source-schema",
    code: "SCHEMA_INVALID",
    makeInput: () => fixtureInput([]),
  },
  {
    id: "PIPE-026-diagnostic-count-limit",
    name: "1,025 structural diagnostics collapse to one bounded failure",
    trace: "PIPE-026",
    stage: "source-schema",
    code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: sourceSchemaDiagnosticCountInput,
  },
  {
    id: "PIPE-026-diagnostic-pointer-limit",
    name: "a structural diagnostic pointer beyond 4,096 units fails closed",
    trace: "PIPE-026",
    stage: "source-schema",
    code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: sourceSchemaDiagnosticPointerInput,
  },
  {
    id: "PIPE-026-diagnostic-aggregate-limit",
    name: "an exact-count structural report beyond the aggregate budget fails closed",
    trace: "PIPE-026",
    stage: "source-schema",
    code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: sourceSchemaDiagnosticAggregateInput,
  },
  {
    id: "PIPE-027-embedded-schema",
    name: "an invalid embedded Draft 2020-12 schema fails before semantics",
    trace: "PIPE-027",
    stage: "embedded-schema",
    code: "SCHEMA_INVALID",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "sign-in", "state", "email", "schema"], {
          type: "not-a-json-schema-type",
        });
      }),
  },
  {
    id: "PIPE-028-duplicate-node-id",
    name: "duplicate Source node identity fails intrinsic semantics",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "DUPLICATE_NODE_ID",
    makeInput: () => fixtureInput(sourceDuplicateNodeId),
  },
  {
    id: "PIPE-028-static-reference",
    name: "a missing static capability reference emits no Bundle",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "UNKNOWN_CAPABILITY",
    makeInput: () => fixtureInput(sourceUnknownCapability),
  },
  {
    id: "PIPE-028-behavior-reference-category",
    name: "an existing component cannot satisfy a behavior reference",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "UNKNOWN_CAPABILITY",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "use"], "com.example.ui/Stack");
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-028-resource-reference-category",
    name: "an existing operation cannot satisfy a resource reference",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "UNKNOWN_CAPABILITY",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
        ["surfaces", "stores", "resources", "stores", "use"],
        "com.example.auth/signIn",
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-028-missing-entry",
    name: "a missing entry surface fails intrinsic Source semantics",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "ENTRY_NOT_FOUND",
    makeInput: () =>
      officialInput((source) => {
        source.entry = "missing";
      }),
  },
  {
    id: "PIPE-028-surface-key-id-mismatch",
    name: "a surface map key that disagrees with its id is rejected",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "DUPLICATE_SURFACE_ID",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "id"], "mismatched-home");
      }),
  },
  {
    id: "PIPE-028-invalid-semver",
    name: "a non-exact Catalog requirement version fails Source semantics",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "run.desen.validator/INVALID_SEMVER",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["catalogs", 0, "version"], "latest");
      }),
  },
  {
    id: "PIPE-028-wrong-capability-category",
    name: "an existing component cannot satisfy an operation reference",
    trace: "PIPE-028",
    stage: "source-semantics",
    code: "UNKNOWN_CAPABILITY",
    makeInput: () =>
      officialInput((source) => {
        writeAt(
          source,
          ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "operation"],
          "com.example.ui/Button",
        );
      }),
  },
  {
    id: "PIPE-029-missing-catalog",
    name: "a missing exact Catalog package is never substituted",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "CATALOG_VERSION_UNAVAILABLE",
    makeInput: () => ({
      rawSource: JSON.stringify(officialSourceFixture),
      candidates: [],
    }),
  },
  {
    id: "PIPE-029-ambiguous-catalog",
    name: "two exact Catalog candidates are rejected as ambiguous",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "CATALOG_VERSION_UNAVAILABLE",
    makeInput: () => ({
      rawSource: JSON.stringify(officialSourceFixture),
      candidates: [freshCandidate(), freshCandidate()],
    }),
  },
  {
    id: "PIPE-029-incompatible-target",
    name: "a target-incompatible Catalog candidate cannot satisfy the requirement",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "CATALOG_VERSION_UNAVAILABLE",
    makeInput: () => ({
      rawSource: JSON.stringify(officialSourceFixture),
      candidates: [freshCandidate(undefined, { target: "ios-swiftui" })],
    }),
  },
  {
    id: "PIPE-029-candidate-limit",
    name: "one candidate beyond the finite public inventory fails before selection",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogCandidateLimitInput,
  },
  {
    id: "PIPE-029-malformed-candidate",
    name: "a candidate envelope with an extra authority field is rejected",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/INVALID_CATALOG_INPUT",
    makeInput: () => ({
      rawSource: JSON.stringify(officialSourceFixture),
      candidates: [
        {
          ...freshCandidate(),
          unexpectedAuthority: true,
        } as PublishCatalogPackageCandidate,
      ],
    }),
  },
  {
    id: "PIPE-029-requirement-limit",
    name: "one Source requirement beyond the 256-entry ceiling fails closed",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogRequirementLimitInput,
  },
  {
    id: "PIPE-029-identity-limit",
    name: "one unselected candidate identity beyond 4,096 units fails globally",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogIdentityLimitInput,
  },
  {
    id: "PIPE-029-document-identity-limit",
    name: "a Source document identity beyond 4,096 units fails before package observation",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.id = "D".repeat(4_097);
      }),
  },
  {
    id: "PIPE-029-requirement-identity-limit",
    name: "a Source Catalog requirement identity beyond 4,096 units fails closed",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["catalogs", 0, "id"], "x".repeat(4_097));
      }),
  },
  {
    id: "PIPE-029-inherited-diagnostic-aggregate-limit",
    name: "an inherited Catalog report beyond the aggregate budget is rebound safely",
    trace: "PIPE-029",
    stage: "catalog-resolution",
    code: "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: inheritedCatalogDiagnosticAggregateInput,
  },
  {
    id: "PIPE-030-catalog-schema",
    name: "an invalid selected Catalog schema fails integrity",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "UNKNOWN_CORE_FIELD",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        catalog.unknownCoreField = true;
      }),
  },
  {
    id: "PIPE-030-catalog-digest",
    name: "a package observation that disagrees with Catalog digest fails integrity",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "CATALOG_DIGEST_MISMATCH",
    makeInput: () => ({
      rawSource: JSON.stringify(officialSourceFixture),
      candidates: [freshCandidate(undefined, { observedPackageDigest: ALTERNATE_DIGEST })],
    }),
  },
  {
    id: "PIPE-030-catalog-identity-mismatch",
    name: "a selected package envelope cannot override its inner Catalog identity",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/INVALID_CATALOG_INPUT",
    makeInput: () => {
      const catalog = record(cloneJson(officialCatalogFixture), "Identity-mismatch Catalog");
      catalog.id = "com.example.other-catalog";
      return {
        rawSource: JSON.stringify(officialSourceFixture),
        candidates: [
          freshCandidate(catalog, {
            id: String(record(officialCatalogFixture, "Official Catalog fixture").id),
          }),
        ],
      };
    },
  },
  {
    id: "PIPE-030-location-cannot-establish-trust",
    name: "a discovery location cannot override a mismatched observed package digest",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "CATALOG_DIGEST_MISMATCH",
    forbiddenFragments: ["https://attacker.invalid/catalog"],
    makeInput: () => {
      const input = officialInput((source) => {
        writeAt(source, ["catalogs", 0, "location"], "https://attacker.invalid/catalog");
      });
      return {
        rawSource: input.rawSource,
        candidates: input.candidates.map((candidate) => ({
          ...candidate,
          observedPackageDigest: ALTERNATE_DIGEST,
        })),
      };
    },
  },
  {
    id: "PIPE-030-malformed-catalog-json",
    name: "a selected Catalog with a lone surrogate is not inert JSON",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/INVALID_CATALOG_INPUT",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        catalog.extensions = { invalidUnicode: "\ud800" };
      }),
  },
  {
    id: "PIPE-030-catalog-depth-limit",
    name: "a selected Catalog beyond the 128-level depth ceiling fails closed",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogDepthLimitInput,
  },
  {
    id: "PIPE-030-catalog-value-limit",
    name: "a selected Catalog beyond 100,000 values fails closed",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogValueLimitInput,
  },
  {
    id: "PIPE-030-catalog-string-limit",
    name: "a selected Catalog beyond 4,194,304 string units fails closed",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogStringLimitInput,
  },
  {
    id: "PIPE-030-catalog-single-byte-limit",
    name: "escaped control data crosses the honest 16 MiB single-Catalog ceiling",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogSingleByteLimitInput,
  },
  {
    id: "PIPE-030-catalog-aggregate-byte-limit",
    name: "six individually admitted Catalogs cross the 64 MiB aggregate ceiling",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogAggregateByteLimitInput,
  },
  {
    id: "PIPE-030-catalog-diagnostic-limit",
    name: "1,025 Catalog schema diagnostics collapse to one bounded failure",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogDiagnosticLimitInput,
  },
  {
    id: "PIPE-030-catalog-capability-limit",
    name: "capabilities admitted per Catalog cross the 100,000 aggregate ceiling",
    trace: "PIPE-030",
    stage: "catalog-integrity",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: catalogAggregateCapabilityLimitInput,
  },
  {
    id: "PIPE-031-namespace-conflict",
    name: "duplicate capability identity across exact Catalogs fails atomically",
    trace: "PIPE-031",
    stage: "namespace-conflicts",
    code: "AMBIGUOUS_CAPABILITY",
    requiredDiagnosticCapabilityIds: [
      "com.example.ui/Stack",
      "com.example.interactions/Sortable",
      "com.example.auth/signIn",
      "com.example.stores/list",
    ],
    makeInput: namespaceConflictInput,
  },
  {
    id: "PIPE-031-namespace-diagnostic-limit",
    name: "1,025 cross-Catalog conflicts collapse to one bounded failure",
    trace: "PIPE-031",
    stage: "namespace-conflicts",
    code: "run.desen.publisher/CATALOG_LIMIT_EXCEEDED",
    makeInput: namespaceDiagnosticLimitInput,
  },
  {
    id: "PIPE-032-unknown-prop",
    name: "an undeclared literal component prop fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_PROP",
    makeInput: () =>
      officialInput((source) => {
        const props = record(
          valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
          "Home title props",
        );
        props.ghost = true;
      }),
  },
  {
    id: "PIPE-032-required-prop",
    name: "an omitted required component prop fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () =>
      officialInput((source) => {
        Reflect.deleteProperty(
          record(
            valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
            "Home title props",
          ),
          "text",
        );
      }),
  },
  {
    id: "PIPE-032-prop-type",
    name: "a literal component prop type mismatch fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props", "role"], 42);
      }),
  },
  {
    id: "PIPE-032-variant-prop",
    name: "a Variant component prop type mismatch fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () =>
      officialInput((source) => {
        writeAt(
          source,
          ["surfaces", "home", "root", "slots", "default", 0, "variants"],
          [
            {
              when: { op: "truthy", args: [true] },
              props: { role: 42 },
            },
          ],
        );
      }),
  },
  {
    id: "PIPE-032-unknown-slot",
    name: "an undeclared component slot fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_SLOT",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "slots"], {
          ghost: [],
        });
      }),
  },
  {
    id: "PIPE-032-leaf-slot",
    name: "children attached to a leaf component slot fail terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_SLOT",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "slots"], {
          default: [
            {
              id: "home.title.child",
              use: "com.example.ui/Text",
              props: { text: "Child" },
            },
          ],
        });
      }),
  },
  {
    id: "PIPE-032-required-slot",
    name: "an omitted required component slot fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CARDINALITY",
    makeInput: () =>
      officialInput(
        (source) => {
          Reflect.deleteProperty(record(valueAt(source, ["surfaces", "home", "root"])), "slots");
        },
        (catalog) => {
          writeAt(
            catalog,
            ["components", "com.example.ui/Stack", "slots", "default", "required"],
            true,
          );
          writeAt(
            catalog,
            ["components", "com.example.ui/Stack", "slots", "default", "minItems"],
            1,
          );
        },
      ),
  },
  {
    id: "PIPE-032-slot-cardinality",
    name: "a Catalog slot cardinality violation fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CARDINALITY",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(catalog, ["components", "com.example.ui/Stack", "slots", "default", "maxItems"], 0);
      }),
  },
  {
    id: "PIPE-032-slot-child",
    name: "a child category rejected by its parent slot fails publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CHILD_REJECTED",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(
          catalog,
          ["components", "com.example.ui/Stack", "slots", "default", "acceptsCategories"],
          ["action"],
        );
      }),
  },
  {
    id: "PIPE-032-component-style-part",
    name: "an undeclared component style part fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_PROP",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
          base: { ghost: {} },
        });
      }),
  },
  {
    id: "PIPE-032-component-visual-state",
    name: "an undeclared component visual state fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_PROP",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
          ghost: { text: {} },
        });
      }),
  },
  {
    id: "PIPE-032-component-style-property",
    name: "a component style-property schema mismatch fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () =>
      officialInput(
        (source) => {
          writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "style"], {
            base: { text: { color: 42 } },
          });
        },
        (catalog) => {
          writeAt(
            catalog,
            ["components", "com.example.ui/Text", "styleParts", "text", "propertiesSchema"],
            {
              type: "object",
              additionalProperties: false,
              properties: { color: { type: "string" } },
            },
          );
        },
      ),
  },
  {
    id: "PIPE-032-behavior-prop",
    name: "a behavior prop schema mismatch fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "props", "axis"], 42);
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-slot",
    name: "an undeclared behavior slot fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_SLOT",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "slots"], {
        ghost: [],
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-slot-required",
    name: "an omitted required behavior slot fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CARDINALITY",
    makeInput: () => {
      const catalog = record(cloneJson(officialCatalogFixture), "Required behavior-slot Catalog");
      writeAt(
        catalog,
        ["behaviors", "com.example.interactions/Sortable", "slots", "dragPreview", "required"],
        true,
      );
      writeAt(
        catalog,
        ["behaviors", "com.example.interactions/Sortable", "slots", "dragPreview", "minItems"],
        1,
      );
      return sourceAndCatalogInput(cloneJson(exampleSortableSource), catalog);
    },
  },
  {
    id: "PIPE-032-behavior-slot-cardinality",
    name: "a behavior slot above its maximum cardinality fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CARDINALITY",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "slots"], {
        dragPreview: [
          {
            id: "tasks.preview-one",
            use: "com.example.ui/Text",
            props: { text: "One" },
          },
          {
            id: "tasks.preview-two",
            use: "com.example.ui/Text",
            props: { text: "Two" },
          },
        ],
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-slot-child",
    name: "a child rejected by its behavior slot fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "SLOT_CHILD_REJECTED",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      const catalog = record(cloneJson(officialCatalogFixture), "Rejecting behavior-slot Catalog");
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "slots"], {
        dragPreview: [
          {
            id: "tasks.preview",
            use: "com.example.ui/Text",
            props: { text: "Preview" },
          },
        ],
      });
      writeAt(
        catalog,
        [
          "behaviors",
          "com.example.interactions/Sortable",
          "slots",
          "dragPreview",
          "acceptsCategories",
        ],
        [],
      );
      return sourceAndCatalogInput(source, catalog);
    },
  },
  {
    id: "PIPE-032-behavior-event",
    name: "an undeclared behavior event fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_EVENT",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "on"], {
        teleport: [],
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-style-part",
    name: "an undeclared behavior style part fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_PROP",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "style"], {
        base: { privatePart: {} },
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-visual-state",
    name: "an undeclared behavior visual state fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_PROP",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "style"], {
        ghost: { dropIndicator: {} },
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-behavior-style-property",
    name: "a behavior style-property schema mismatch fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "PROP_TYPE_MISMATCH",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      const catalog = record(cloneJson(officialCatalogFixture), "Behavior style Catalog");
      writeAt(source, ["surfaces", "tasks", "root", "behaviors", 0, "style"], {
        base: { dropIndicator: { color: 42 } },
      });
      writeAt(
        catalog,
        [
          "behaviors",
          "com.example.interactions/Sortable",
          "styleParts",
          "dropIndicator",
          "propertiesSchema",
        ],
        {
          type: "object",
          additionalProperties: false,
          properties: { color: { type: "string" } },
        },
      );
      return sourceAndCatalogInput(source, catalog);
    },
  },
  {
    id: "PIPE-032-behavior-attachment",
    name: "a behavior attached to a rejected component category fails publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "BEHAVIOR_ATTACHMENT_INVALID",
    makeInput: () => {
      const catalog = record(cloneJson(officialCatalogFixture), "Attachment Catalog");
      writeAt(catalog, ["behaviors", "com.example.interactions/Sortable", "attachTo"], {
        categories: ["action"],
      });
      return sourceAndCatalogInput(cloneJson(exampleSortableSource), catalog);
    },
  },
  {
    id: "PIPE-032-behavior-conflict",
    name: "two exclusive behavior instances on one node fail publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "BEHAVIOR_CONFLICT",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      array(valueAt(source, ["surfaces", "tasks", "root", "behaviors"])).push({
        id: "tasks.sort-secondary",
        use: "com.example.interactions/Sortable",
        props: { axis: "vertical", handle: "item" },
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-unknown-command",
    name: "an undeclared component command fails terminal publication",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_COMMAND",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
        ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "command"],
        "teleport",
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-invalid-component-contract",
    name: "an unresolved component schema reference fails Catalog preparation",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.validator/INVALID_COMPONENT_CONTRACT",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(catalog, ["components", "com.example.ui/Text", "propsSchema"], {
          $ref: "#/$defs/missing",
        });
      }),
  },
  {
    id: "PIPE-032-invalid-interaction-contract",
    name: "an unsafe event payload pattern fails interaction preparation",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.validator/INVALID_INTERACTION_CONTRACT",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(
          catalog,
          ["components", "com.example.ui/TextField", "events", "change", "payloadSchema"],
          {
            type: "object",
            properties: { value: { type: "string", pattern: "^(a+)+$" } },
          },
        );
      }),
  },
  {
    id: "PIPE-032-diagnostic-limit",
    name: "1,025 static capability errors collapse to one bounded failure",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        const props = record(
          valueAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props"]),
          "Home title props",
        );
        for (let index = 0; index < 1_025; index += 1) {
          props[`ghost${index}`] = true;
        }
      }),
  },
  {
    id: "PIPE-032-diagnostic-pointer-limit",
    name: "a static capability diagnostic pointer beyond 4,096 units fails closed",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: capabilityDiagnosticPointerLimitInput,
  },
  {
    id: "PIPE-032-diagnostic-aggregate-limit",
    name: "an exact-count static capability report beyond the aggregate budget fails closed",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: capabilityDiagnosticAggregateLimitInput,
  },
  {
    id: "PIPE-032-warning-count-limit",
    name: "1,025 deprecated capability warnings fail closed instead of truncating",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: deprecatedWarningCountLimitInput,
  },
  {
    id: "PIPE-032-warning-pointer-limit",
    name: "a deprecated capability warning pointer beyond 4,096 units fails closed",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: deprecatedWarningPointerLimitInput,
  },
  {
    id: "PIPE-032-warning-aggregate-limit",
    name: "an exact-count warning report beyond the aggregate budget fails closed",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: deprecatedWarningAggregateLimitInput,
  },
  {
    id: "PIPE-032-capability-precedence",
    name: "stage eight wins over simultaneous stage-nine and stage-ten defects",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "UNKNOWN_EVENT",
    makeInput: () => fixtureInput(sourceWithExecutionDefects(true, true, true)),
  },
  {
    id: "PIPE-032-resource-input",
    name: "a Source resource policy absent from its Catalog fails capability use",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "RESOURCE_INPUT_INVALID",
    makeInput: () => {
      const catalog = record(cloneJson(officialCatalogFixture), "Resource policy Catalog");
      writeAt(catalog, ["resources", "com.example.tasks/list", "policies"], ["manual"]);
      return sourceAndCatalogInput(cloneJson(exampleSortableSource), catalog);
    },
  },
  {
    id: "PIPE-032-resource-input-value",
    name: "a statically invalid literal resource input fails capability use",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "RESOURCE_INPUT_INVALID",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "resources", "tasks", "input", "ghost"], true);
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-operation-input",
    name: "a statically invalid literal operation input fails capability use",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "OPERATION_INPUT_INVALID",
    makeInput: () =>
      officialInput((source) => {
        writeAt(
          source,
          ["surfaces", "sign-in", "root", "slots", "default", 4, "on", "press", 0, "input"],
          {
            email: "person@example.com",
            password: "",
          },
        );
      }),
  },
  {
    id: "PIPE-032-command-input",
    name: "a statically invalid literal command input fails capability use",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "COMMAND_INPUT_INVALID",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
        ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "input", "bounds"],
        42,
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-032-invalid-execution-contract",
    name: "an unresolved operation output schema fails execution Catalog preparation",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(catalog, ["operations", "com.example.auth/signIn", "outputSchema"], {
          $ref: "#/$defs/missing",
        });
      }),
  },
  {
    id: "PIPE-032-invalid-resource-execution-contract",
    name: "an unresolved resource input schema fails execution Catalog preparation",
    trace: "PIPE-032",
    stage: "capability-contracts",
    code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
    makeInput: () =>
      officialInput(undefined, (catalog) => {
        writeAt(catalog, ["resources", "com.example.tasks/list", "inputSchema"], {
          $ref: "#/$defs/missing",
        });
      }),
  },
  {
    id: "PIPE-033-control-flow-precedence",
    name: "stage nine wins over a simultaneous stage-ten defect",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "PREDICATE_TYPE_MISMATCH",
    makeInput: () => fixtureInput(sourceWithExecutionDefects(false, true, true)),
  },
  {
    id: "PIPE-033-diagnostic-count-limit",
    name: "1,025 execution diagnostics fail closed instead of truncating",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () => executionDiagnosticLimitInput(1_025),
  },
  {
    id: "PIPE-033-diagnostic-pointer-limit",
    name: "an execution diagnostic pointer beyond 4,096 units fails closed",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: executionDiagnosticPointerLimitInput,
  },
  {
    id: "PIPE-033-diagnostic-aggregate-limit",
    name: "an exact-count execution report beyond the aggregate budget fails closed",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () => executionDiagnosticLimitInput(1_024, "D".repeat(1_024)),
  },
  {
    id: "PIPE-033-predicate-type",
    name: "an isolated predicate operand type mismatch fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "PREDICATE_TYPE_MISMATCH",
    makeInput: () => fixtureInput(sourceWithExecutionDefects(false, true, false)),
  },
  {
    id: "PIPE-033-operation-alias-conflict",
    name: "one operation alias cannot identify two different capabilities",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.validator/INVALID_EXECUTION_CONTRACT",
    makeInput: () =>
      officialInput(
        (source) => {
          const firstInvocation = record(
            pressActions(source)[0],
            "Official sign-in operation invocation",
          );
          pressActions(source).push({
            ...cloneJson(firstInvocation),
            operation: "com.example.auth/signOut",
          });
        },
        (catalog) => {
          const operations = record(catalog.operations, "Catalog operations");
          operations["com.example.auth/signOut"] = cloneJson(operations["com.example.auth/signIn"]);
        },
      ),
  },
  {
    id: "PIPE-033-repeat-items",
    name: "a statically non-iterable repeat input fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "REPEAT_ITEMS_INVALID",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"], 42);
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-033-repeat-key",
    name: "duplicate resolved repeat keys fail control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "REPEAT_KEY_INVALID",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(
        source,
        ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"],
        [
          { id: "same", title: "First" },
          { id: "same", title: "Second" },
        ],
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-033-repeat-limit",
    name: "a literal repeat exceeding its declared limit fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(
        source,
        ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"],
        [
          { id: "one", title: "One" },
          { id: "two", title: "Two" },
        ],
      );
      writeAt(source, ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "limit"], 1);
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-033-repeat-alias-shadow",
    name: "a nested repeat cannot shadow an active lexical alias",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "repeat"], {
        items: [{ id: "outer" }],
        as: "task",
        key: { $ref: "item.task.id" },
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-033-navigation-target",
    name: "a navigation action targeting a missing surface fails control flow",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "ENTRY_NOT_FOUND",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).unshift({ type: "navigate", surface: "missing" });
      }),
  },
  {
    id: "PIPE-033-state-path",
    name: "a definitely missing nested state path fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "STATE_WRITE_INVALID",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).unshift({
          type: "state.set",
          path: "email.missing",
          value: "person@example.com",
        });
      }),
  },
  {
    id: "PIPE-033-state-root",
    name: "an undeclared root state path fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "STATE_WRITE_INVALID",
    makeInput: () =>
      officialInput((source) => {
        writeAt(
          source,
          ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change", 0, "path"],
          "missing.value",
        );
      }),
  },
  {
    id: "PIPE-033-state-toggle",
    name: "a toggle of a definitely non-boolean state value fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "STATE_WRITE_INVALID",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).unshift({
          type: "state.toggle",
          path: "email",
        });
      }),
  },
  {
    id: "PIPE-033-resource-target",
    name: "a refresh action targeting a missing resource fails control flow",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).unshift({
          type: "resource.refresh",
          resource: "missing",
        });
      }),
  },
  {
    id: "PIPE-033-command-target",
    name: "a command action targeting a missing node fails control flow",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "UNKNOWN_COMMAND",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).unshift({
          type: "component.command",
          target: "missing",
          command: "focus",
          input: {},
        });
      }),
  },
  {
    id: "PIPE-033-state-write",
    name: "a statically invalid state write fails control-flow semantics",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "STATE_WRITE_INVALID",
    makeInput: () =>
      officialInput((source) => {
        writeAt(
          source,
          ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change", 0, "value"],
          42,
        );
      }),
  },
  {
    id: "PIPE-034-binding-precedence",
    name: "stage ten rejects a static mismatch and suppresses earlier warnings",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    suppressesWarnings: true,
    forbiddenFragments: ["PRIVATE RETIREMENT TEXT", "private/replacement"],
    makeInput: () => {
      const source = sourceWithExecutionDefects(false, false, true);
      const catalog = record(cloneJson(officialCatalogFixture), "Deprecated Catalog");
      const stack = record(
        valueAt(catalog, ["components", "com.example.ui/Stack"]),
        "Stack Catalog declaration",
      );
      stack.deprecated = "PRIVATE RETIREMENT TEXT";
      stack.replacement = "private/replacement";
      return {
        rawSource: JSON.stringify(source),
        candidates: [freshCandidate(catalog)],
      };
    },
  },
  {
    id: "PIPE-034-lexical-binding",
    name: "an isolated lexical state reference fails binding compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () => fixtureInput(sourceWithExecutionDefects(false, false, true)),
  },
  {
    id: "PIPE-034-event-scope",
    name: "an event reference outside a declared handler fails binding compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props", "text"], {
          $ref: "event.value",
        });
      }),
  },
  {
    id: "PIPE-034-settlement-event-scope",
    name: "an operation settlement action cannot retain its parent component event scope",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "sign-in", "root", "slots", "default", 1, "on", "change", 0], {
          type: "operation.invoke",
          operation: "com.example.auth/signIn",
          as: "emailProbe",
          input: {
            email: { $ref: "state.email" },
            password: { $ref: "state.password" },
          },
          onSuccess: [
            {
              type: "state.set",
              path: "email",
              value: { $ref: "event.value" },
            },
          ],
        });
      }),
  },
  {
    id: "PIPE-034-repeat-body-reference",
    name: "every literal repeat item must satisfy an unfallbacked body reference",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(
        source,
        ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"],
        [{ id: "one" }, { id: "two", title: "Two" }],
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-034-repeat-items-alias-scope",
    name: "a repeat alias is not in scope inside its own items expression",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () => {
      const source = cloneJson(exampleSortableSource);
      writeAt(source, ["surfaces", "tasks", "root", "slots", "default", 0, "repeat", "items"], {
        $ref: "item.task.children",
      });
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-033-state-initial",
    name: "a state initial value must satisfy its declared schema before binding compatibility",
    trace: "PIPE-033",
    stage: "state-and-control-flow",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () =>
      officialInput((source) => {
        writeAt(source, ["surfaces", "sign-in", "state", "email", "initial"], 42);
      }),
  },
  {
    id: "PIPE-034-format-binding",
    name: "a format template with an unresolved placeholder fails compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
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
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-034-format-extra",
    name: "a format value without a matching placeholder fails compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
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
        "Selected store",
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-034-format-malformed",
    name: "an unclosed format placeholder fails compatibility without regex evaluation",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.validator/INVALID_BINDING_CONTRACT",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
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
        "Selected store: {id",
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-034-operation-lifecycle-binding",
    name: "a definitely closed operation output path fails compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () =>
      officialInput((source) => {
        pressActions(source).push({
          type: "event.emit",
          name: "operation-probe",
          payload: {
            value: { $ref: "operation.signIn.value.missing" },
          },
        });
      }),
  },
  {
    id: "PIPE-034-resource-lifecycle-binding",
    name: "a resource field unavailable in its lifecycle fails compatibility",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "REFERENCE_UNRESOLVED",
    makeInput: () => {
      const source = cloneJson(exampleStoreMapSource);
      writeAt(
        source,
        ["surfaces", "stores", "root", "slots", "default", 1, "on", "press", 0, "input", "bounds"],
        { $ref: "resource.stores.value.missing" },
      );
      return fixtureInput(source);
    },
  },
  {
    id: "PIPE-034-obligation-pointer-limit",
    name: "one pointer unit beyond 4,096 rejects the complete obligation report",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () => obligationPropInput(0, EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS + 1),
  },
  {
    id: "PIPE-034-obligation-aggregate-limit",
    name: "one aggregate unit beyond 1,048,576 rejects the complete obligation report",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () =>
      obligationPropInput(
        MAX_POINTER_AGGREGATE_PROP_COUNT,
        EXCESS_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS,
      ),
  },
  {
    id: "PIPE-034-obligation-limit",
    name: "one runtime obligation beyond the finite public ceiling is never truncated",
    trace: "PIPE-034",
    stage: "binding-compatibility",
    code: "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED",
    makeInput: () => fixtureInput(sourceWithEmailWriteActions(EXCESS_EMAIL_WRITE_ACTIONS)),
  },
  {
    id: "PIPE-039-first-final-bundle-limit",
    name: "one payload unit beyond the exact successful Bundle boundary fails admission",
    trace: "PIPE-039",
    stage: "bundle-validation",
    code: "BUNDLE_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.extensions = {
          payload: "x".repeat(FINAL_BUNDLE_FIRST_FAILURE_PAYLOAD_CODE_UNITS),
        };
      }),
  },
  {
    id: "PIPE-039-last-normalization-admitted",
    name: "the last normalized payload still reaches final Bundle admission",
    trace: "PIPE-039",
    stage: "bundle-validation",
    code: "BUNDLE_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.extensions = {
          payload: "x".repeat(NORMALIZATION_LAST_ADMITTED_PAYLOAD_CODE_UNITS),
        };
      }),
  },
  {
    id: "PIPE-037-first-normalization-limit",
    name: "one payload unit beyond normalization admission fails at stage thirteen",
    trace: "PIPE-037",
    stage: "normalization",
    code: "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.extensions = {
          payload: "x".repeat(NORMALIZATION_FIRST_FAILURE_PAYLOAD_CODE_UNITS),
        };
      }),
  },
  {
    id: "PIPE-037-source-node-trace-limit",
    name: "one component node beyond the complete Source trace ceiling fails closed",
    trace: "PIPE-037",
    stage: "normalization",
    code: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    makeInput: sourceNodeTraceLimitInput,
  },
  {
    id: "PIPE-037-source-node-pointer-limit",
    name: "a complete Source trace pointer beyond 4,096 units fails closed",
    trace: "PIPE-037",
    stage: "normalization",
    code: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    makeInput: sourceNodePointerLimitInput,
  },
  {
    id: "PIPE-037-source-node-aggregate-limit",
    name: "a sub-count Source trace beyond the aggregate budget fails closed",
    trace: "PIPE-037",
    stage: "normalization",
    code: "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED",
    makeInput: sourceNodeAggregateLimitInput,
  },
  {
    id: "PIPE-037-normalization-limit",
    name: "the larger extensions vector stops at the real normalization ceiling",
    trace: "PIPE-037",
    stage: "normalization",
    code: "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.extensions = {
          payload: "x".repeat(NORMALIZATION_LIMIT_PAYLOAD_CODE_UNITS),
        };
      }),
  },
  {
    id: "PIPE-039-final-bundle-limit",
    name: "the smaller extensions vector reaches and fails final Bundle admission",
    trace: "PIPE-039",
    stage: "bundle-validation",
    code: "BUNDLE_LIMIT_EXCEEDED",
    makeInput: () =>
      officialInput((source) => {
        source.extensions = {
          payload: "x".repeat(FINAL_BUNDLE_LIMIT_PAYLOAD_CODE_UNITS),
        };
      }),
  },
]);

describe("M06-T11 public invalid-Source no-Bundle matrix", () => {
  it.each(INVALID_PUBLICATION_CASES)(
    "$id — $name",
    (testCase) => {
      const first = publishWithoutInputMutation(testCase.makeInput());
      const second = publishWithoutInputMutation(testCase.makeInput());

      expectFailure(first, testCase);
      expectFailure(second, testCase);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "pins exact trace coverage without inventing public data negatives for total stages",
    () => {
      expect(new Set(INVALID_PUBLICATION_CASES.map(({ trace }) => trace))).toEqual(
        new Set([
          "PIPE-025",
          "PIPE-026",
          "PIPE-027",
          "PIPE-028",
          "PIPE-029",
          "PIPE-030",
          "PIPE-031",
          "PIPE-032",
          "PIPE-033",
          "PIPE-034",
          "PIPE-037",
          "PIPE-039",
        ]),
      );
      const rejectedStages = new Set(INVALID_PUBLICATION_CASES.map(({ stage }) => stage));
      for (const stage of TOTAL_PUBLIC_STAGES_WITHOUT_DATA_NEGATIVES) {
        expect(rejectedStages.has(stage)).toBe(false);
      }

      const registryCodes = PUBLISHER_DIAGNOSTIC_REGISTRY.map(({ code }) => code);
      const registryCodeSet = new Set<string>(registryCodes);
      expect(registryCodes).toEqual(EXPECTED_PUBLISHER_DIAGNOSTIC_CODES);
      expect(registryCodeSet.size).toBe(PUBLISHER_DIAGNOSTIC_REGISTRY.length);
      expect(Object.isFrozen(PUBLISHER_DIAGNOSTIC_REGISTRY)).toBe(true);
      for (const definition of PUBLISHER_DIAGNOSTIC_REGISTRY) {
        expect(Object.isFrozen(definition)).toBe(true);
        expect(isPublisherDiagnosticCode(definition.code)).toBe(true);
        expect(getPublisherDiagnosticDefinition(definition.code)).toBe(definition);
      }
      expect(isPublisherDiagnosticCode("run.desen.publisher/UNKNOWN")).toBe(false);
      expect(getPublisherDiagnosticDefinition("run.desen.publisher/UNKNOWN")).toBeUndefined();

      const emittedPublisherCodes = new Set(
        INVALID_PUBLICATION_CASES.map(({ code }) => code).filter((code) =>
          code.startsWith("run.desen.publisher/"),
        ),
      );
      for (const code of emittedPublisherCodes) {
        expect(registryCodeSet.has(code)).toBe(true);
      }
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes the unmodified official golden through every total public stage",
    () => {
      const first = publishWithoutInputMutation(officialInput());
      const second = publishWithoutInputMutation(officialInput());
      expectSuccess(first, "official golden");
      expectSuccess(second, "repeated official golden");
      expect(first.diagnostics).toEqual([]);
      expect(first.bundle.revision).toBe(
        "sha256:43eef0f11f9bcc4c13fc1eb5691ee974859001fbb4aeee8051948e7c8e195601",
      );
      expect(first.bundle.sourceDigest).toBe(
        "sha256:40c294047299b521a46b51d8a72bfbeeaad8a69a9b9045a306139830b7674878",
      );
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes a dynamic context.runtimeTitle obligation without guessing its value",
    () => {
      const makeInput = (): PublicationInput =>
        officialInput((source) => {
          writeAt(source, ["surfaces", "home", "root", "slots", "default", 0, "props", "text"], {
            $ref: "context.runtimeTitle",
            fallback: "Welcome",
          });
        });
      const first = publishWithoutInputMutation(makeInput());
      const second = publishWithoutInputMutation(makeInput());
      expectSuccess(first, "dynamic context obligation");
      expectSuccess(second, "repeated dynamic context obligation");
      expect(
        valueAt(first.bundle, ["surfaces", "home", "root", "slots", "default", 0, "props", "text"]),
      ).toEqual({
        $ref: "context.runtimeTitle",
        fallback: "Welcome",
      });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes the exact 4,096-obligation positive boundary without exposing obligations",
    () => {
      expect(EXACT_EMAIL_WRITE_ACTIONS + OFFICIAL_NON_EMAIL_WRITE_OBLIGATIONS).toBe(
        RUNTIME_OBLIGATION_LIMIT,
      );
      const firstInput = fixtureInput(sourceWithEmailWriteActions(EXACT_EMAIL_WRITE_ACTIONS));
      const secondInput = fixtureInput(sourceWithEmailWriteActions(EXACT_EMAIL_WRITE_ACTIONS));
      const first = publishWithoutInputMutation(firstInput);
      const second = publishWithoutInputMutation(secondInput);
      expectSuccess(first, "exact runtime-obligation boundary");
      expectSuccess(second, "repeated exact runtime-obligation boundary");
      expect(first.diagnostics).toEqual([]);
      expect(
        array(
          valueAt(first.bundle, [
            "surfaces",
            "sign-in",
            "root",
            "slots",
            "default",
            1,
            "on",
            "change",
          ]),
        ),
      ).toHaveLength(EXACT_EMAIL_WRITE_ACTIONS);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes an obligation pointer at exactly 4,096 code units",
    () => {
      expect(
        HOME_TITLE_PROP_POINTER_PREFIX.length + EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS,
      ).toBe(RUNTIME_OBLIGATION_POINTER_LIMIT);
      const first = publishWithoutInputMutation(
        obligationPropInput(0, EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS),
      );
      const second = publishWithoutInputMutation(
        obligationPropInput(0, EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS),
      );
      expectSuccess(first, "exact obligation-pointer boundary");
      expectSuccess(second, "repeated exact obligation-pointer boundary");
      const key = obligationPropKey(0, EXACT_RUNTIME_OBLIGATION_PROP_KEY_CODE_UNITS);
      expect(
        valueAt(first.bundle, ["surfaces", "home", "root", "slots", "default", 0, "props", key]),
      ).toEqual({
        $ref: "context.runtimeTitle",
        fallback: "Welcome",
      });
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes obligations at exactly 1,048,576 aggregate code units",
    () => {
      expect(
        OFFICIAL_RUNTIME_OBLIGATION_AGGREGATE_CODE_UNITS +
          MAX_POINTER_AGGREGATE_PROP_COUNT *
            (HOME_TITLE_COMPONENT_PROP_CONTEXT_CODE_UNITS + RUNTIME_OBLIGATION_POINTER_LIMIT) +
          HOME_TITLE_COMPONENT_PROP_CONTEXT_CODE_UNITS +
          HOME_TITLE_PROP_POINTER_PREFIX.length +
          EXACT_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS,
      ).toBe(RUNTIME_OBLIGATION_AGGREGATE_LIMIT);
      const first = publishWithoutInputMutation(
        obligationPropInput(
          MAX_POINTER_AGGREGATE_PROP_COUNT,
          EXACT_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS,
        ),
      );
      const second = publishWithoutInputMutation(
        obligationPropInput(
          MAX_POINTER_AGGREGATE_PROP_COUNT,
          EXACT_AGGREGATE_TAIL_PROP_KEY_CODE_UNITS,
        ),
      );
      expectSuccess(first, "exact obligation-aggregate boundary");
      expectSuccess(second, "repeated exact obligation-aggregate boundary");
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "publishes the exact largest payload admitted by final Bundle validation",
    () => {
      const makeInput = (): PublicationInput =>
        officialInput((source) => {
          source.extensions = {
            payload: "x".repeat(FINAL_BUNDLE_MAX_SUCCESS_PAYLOAD_CODE_UNITS),
          };
        });
      const first = publishWithoutInputMutation(makeInput());
      const second = publishWithoutInputMutation(makeInput());
      expectSuccess(first, "exact final-Bundle payload boundary");
      expectSuccess(second, "repeated final-Bundle payload boundary");
      expect(String(valueAt(first.bundle, ["extensions", "payload"]))).toHaveLength(
        FINAL_BUNDLE_MAX_SUCCESS_PAYLOAD_CODE_UNITS,
      );
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );

  it(
    "emits only fixed sanitized deprecation warnings on complete success",
    () => {
      const makeInput = (): PublicationInput =>
        officialInput(undefined, (catalog) => {
          const stack = record(
            valueAt(catalog, ["components", "com.example.ui/Stack"]),
            "Stack Catalog declaration",
          );
          stack.deprecated = "PRIVATE RETIREMENT TEXT";
          stack.replacement = "private/replacement";
        });
      const first = publishWithoutInputMutation(makeInput());
      const second = publishWithoutInputMutation(makeInput());
      expectSuccess(first, "deprecated-capability warning vector");
      expectSuccess(second, "repeated deprecated-capability warning vector");
      expect(first.diagnostics).toHaveLength(2);
      expect(first.diagnostics.map(({ pointer }) => pointer)).toEqual([
        "/surfaces/home/root/use",
        "/surfaces/sign-in/root/use",
      ]);
      for (const diagnostic of first.diagnostics) {
        expect(diagnostic).toMatchObject({
          code: DEPRECATED_CAPABILITY_CODE,
          message: "Source data uses a deprecated Catalog capability.",
          severity: "warning",
          stage: "capability-contracts",
        });
      }
      expect(JSON.stringify(first.diagnostics)).not.toContain("PRIVATE RETIREMENT TEXT");
      expect(JSON.stringify(first.diagnostics)).not.toContain("private/replacement");
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    },
    INVALID_SOURCE_MATRIX_TEST_TIMEOUT_MILLISECONDS,
  );
});
