import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";

import type {
  CatalogAuthoringModel,
  CatalogComponentSummary,
  AuthoringLayerNode,
} from "./authoring-data.js";

type JsonObject = Readonly<Record<string, unknown>>;

const MAX_COMPONENTS = 4_096;
const MAX_TEXT = 512;

/** A safe, display-only description of one schema property. */
export interface DesignSystemPropDoc {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly enumValues: readonly string[];
  readonly defaultValue: unknown;
}

/** A Catalog-declared event or command, never an executable callback. */
export interface DesignSystemInteractionDoc {
  readonly name: string;
  readonly description: string | undefined;
  readonly payloadShape: string;
}

/** A safe scenario snapshot rendered as text by the Design System UI. */
export interface DesignSystemScenarioDoc {
  readonly id: string;
  readonly props: unknown;
  readonly propsText: string;
}

/** Documentation for one component generated from one admitted Catalog contract. */
export interface DesignSystemComponentDoc {
  readonly id: string;
  readonly displayName: string;
  readonly category: string;
  readonly description: string | undefined;
  readonly usageGuidance: string;
  readonly usageCount: number;
  readonly adapterStatus: "ready" | "missing";
  readonly contractStatus: "ready" | "mismatch";
  readonly props: readonly DesignSystemPropDoc[];
  readonly events: readonly DesignSystemInteractionDoc[];
  readonly commands: readonly DesignSystemInteractionDoc[];
  readonly slots: CatalogComponentSummary["slotContracts"];
  readonly parts: CatalogComponentSummary["styleParts"];
  readonly visualStates: readonly string[];
  readonly scenarios: readonly DesignSystemScenarioDoc[];
}

/** One foundation value documented without exposing CSS or executable implementation authority. */
export interface DesignSystemFoundationToken {
  readonly name: string;
  readonly value: string;
  readonly type: "color" | "dimension" | "number" | "typography";
  readonly source: "DESEN Neutral" | "workspace runtime";
}

/** Immutable foundation scales shown above the component gallery. */
export interface DesignSystemFoundations {
  readonly colors: readonly DesignSystemFoundationToken[];
  readonly spacing: readonly DesignSystemFoundationToken[];
  readonly typography: readonly DesignSystemFoundationToken[];
  readonly radii: readonly DesignSystemFoundationToken[];
}

/** Complete App-owned Design System explorer projection. */
export interface DesignSystemExplorerModel {
  readonly status: "ready";
  readonly catalog: Readonly<{
    readonly id: string;
    readonly version: string;
    readonly target: string;
  }>;
  readonly catalogs: readonly Readonly<{
    readonly id: string;
    readonly version: string;
    readonly target: string;
  }>[];
  readonly sourceFingerprint: string;
  readonly foundations: DesignSystemFoundations;
  readonly components: readonly DesignSystemComponentDoc[];
  readonly usageTotal: number;
  readonly adapterMismatchCount: number;
}

export type DesignSystemExplorerResult =
  | Readonly<{ readonly ok: true; readonly model: DesignSystemExplorerModel }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "catalog-invalid" | "source-invalid" | "documentation-invalid";
    }>;

export interface DesignSystemExplorerOptions {
  /** Callback-free registry inventory captured by the trusted workspace profile. */
  readonly adapterCapabilityIds?: readonly string[];
  /** Host-installed token values. Keys are displayed as inert documentation only. */
  readonly tokenCssProperties?: Readonly<Record<string, string>>;
}

const DEFAULT_FOUNDATIONS: DesignSystemFoundations = Object.freeze({
  colors: Object.freeze([
    Object.freeze({ name: "surface", value: "#ffffff", type: "color", source: "DESEN Neutral" }),
    Object.freeze({ name: "canvas", value: "#f7f7f8", type: "color", source: "DESEN Neutral" }),
    Object.freeze({ name: "text", value: "#17181a", type: "color", source: "DESEN Neutral" }),
    Object.freeze({ name: "muted", value: "#6b7078", type: "color", source: "DESEN Neutral" }),
    Object.freeze({ name: "border", value: "#d9dce1", type: "color", source: "DESEN Neutral" }),
    Object.freeze({ name: "accent", value: "#17181a", type: "color", source: "DESEN Neutral" }),
  ]),
  spacing: Object.freeze([
    Object.freeze({ name: "xs", value: "0.25rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "sm", value: "0.5rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "md", value: "0.75rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "lg", value: "1rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "xl", value: "1.5rem", type: "dimension", source: "DESEN Neutral" }),
  ]),
  typography: Object.freeze([
    Object.freeze({
      name: "body",
      value: "system / 1rem / 1.5",
      type: "typography",
      source: "DESEN Neutral",
    }),
    Object.freeze({
      name: "label",
      value: "system / 0.875rem / 1.35",
      type: "typography",
      source: "DESEN Neutral",
    }),
    Object.freeze({
      name: "heading",
      value: "system / 1.5rem / 1.2",
      type: "typography",
      source: "DESEN Neutral",
    }),
    Object.freeze({
      name: "code",
      value: "mono / 0.8125rem / 1.45",
      type: "typography",
      source: "DESEN Neutral",
    }),
  ]),
  radii: Object.freeze([
    Object.freeze({ name: "sm", value: "0.375rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "md", value: "0.625rem", type: "dimension", source: "DESEN Neutral" }),
    Object.freeze({ name: "pill", value: "999px", type: "dimension", source: "DESEN Neutral" }),
  ]),
});

function ownObject(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
    }
  } catch {
    return undefined;
  }
  return value as JsonObject;
}

function own(value: JsonObject, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function objectEntries(value: unknown): readonly (readonly [string, unknown])[] | undefined {
  const record = ownObject(value);
  if (record === undefined) return undefined;
  return Object.keys(record).map((key) => [key, own(record, key)] as const);
}

function boundedText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_TEXT) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 32) return undefined;
  }
  return value;
}

function cloneJson(value: unknown): unknown {
  try {
    return JSON.parse(canonicalizeJson(value)) as unknown;
  } catch {
    return undefined;
  }
}

function schemaType(schema: JsonObject): string {
  const type = own(schema, "type");
  if (typeof type === "string") return type;
  if (Array.isArray(type) && type.every((item) => typeof item === "string")) {
    return type.join(" | ");
  }
  if (Array.isArray(own(schema, "enum"))) return "enum";
  if (Array.isArray(own(schema, "anyOf"))) return "choice";
  if (Array.isArray(own(schema, "oneOf"))) return "choice";
  return "value";
}

function schemaShape(schemaValue: unknown): string {
  const schema = ownObject(schemaValue);
  if (schema === undefined) return "unknown";
  const properties = objectEntries(own(schema, "properties"));
  if (properties === undefined || properties.length === 0) return schemaType(schema);
  return `${schemaType(schema)} · ${properties.length} properties`;
}

function interactionDocs(value: unknown): readonly DesignSystemInteractionDoc[] {
  const entries = objectEntries(value) ?? [];
  return Object.freeze(
    entries
      .map(([name, raw]) => {
        const record = ownObject(raw);
        if (record === undefined || name.length === 0) return undefined;
        return Object.freeze({
          name,
          description: boundedText(own(record, "description")),
          payloadShape: schemaShape(own(record, "payloadSchema") ?? own(record, "inputSchema")),
        });
      })
      .filter((item): item is DesignSystemInteractionDoc => item !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name, "en-US")),
  );
}

function propDocs(schemaValue: unknown, defaultProps: JsonObject): readonly DesignSystemPropDoc[] {
  const schema = ownObject(schemaValue);
  const properties =
    objectEntries(schema === undefined ? undefined : own(schema, "properties")) ?? [];
  const required = new Set(
    (schema === undefined ? undefined : own(schema, "required")) instanceof Array
      ? (own(schema as JsonObject, "required") as unknown[]).filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  );
  return Object.freeze(
    properties
      .map(([name, raw]) => {
        const property = ownObject(raw);
        if (property === undefined) return undefined;
        const enumValues = own(property, "enum");
        const defaults = own(defaultProps, name);
        return Object.freeze({
          name,
          type: schemaType(property),
          required: required.has(name),
          enumValues: Object.freeze(
            Array.isArray(enumValues)
              ? enumValues.filter((item): item is string => typeof item === "string")
              : [],
          ),
          defaultValue: cloneJson(defaults),
        });
      })
      .filter((item): item is DesignSystemPropDoc => item !== undefined)
      .sort((left, right) => left.name.localeCompare(right.name, "en-US")),
  );
}

function scenarioDocs(value: unknown): readonly DesignSystemScenarioDoc[] {
  const entries = objectEntries(value) ?? [];
  const scenarios: DesignSystemScenarioDoc[] = [];
  for (const [id, raw] of entries) {
    const record = ownObject(raw);
    if (record === undefined || id.length === 0) continue;
    const props = cloneJson(own(record, "props"));
    if (props === undefined) continue;
    let propsText: string;
    try {
      propsText = canonicalizeJson(props);
    } catch {
      continue;
    }
    scenarios.push(Object.freeze({ id, props, propsText }));
  }
  return Object.freeze(scenarios.sort((left, right) => left.id.localeCompare(right.id, "en-US")));
}

function findComponentContract(
  catalogs: readonly unknown[],
  componentId: string,
): JsonObject | undefined {
  for (const catalogValue of catalogs) {
    const catalog = ownObject(catalogValue);
    const components = catalog === undefined ? undefined : ownObject(own(catalog, "components"));
    const candidate = components === undefined ? undefined : own(components, componentId);
    const contract = ownObject(candidate);
    if (contract !== undefined) return contract;
  }
  return undefined;
}

function usageCounts(model: CatalogAuthoringModel): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: AuthoringLayerNode): void => {
    counts.set(node.capabilityId, (counts.get(node.capabilityId) ?? 0) + 1);
    for (const slot of node.slots) {
      for (const child of slot.children) visit(child);
    }
    for (const behavior of node.behaviors) {
      for (const slot of behavior.slots) {
        for (const child of slot.children) visit(child);
      }
    }
  };
  for (const surface of model.surfaces) visit(surface.root);
  return counts;
}

function foundationWithRuntimeTokens(
  options: DesignSystemExplorerOptions,
): DesignSystemFoundations {
  const entries = Object.entries(options.tokenCssProperties ?? {})
    .filter(([name, value]) => name.startsWith("--") && typeof value === "string")
    .sort(([left], [right]) => left.localeCompare(right, "en-US"));
  if (entries.length === 0) return DEFAULT_FOUNDATIONS;
  const runtimeTokens = entries.slice(0, 256).map(([name, value]) =>
    Object.freeze({
      name,
      value,
      type: "number" as const,
      source: "workspace runtime" as const,
    }),
  );
  return Object.freeze({
    ...DEFAULT_FOUNDATIONS,
    spacing: Object.freeze([...DEFAULT_FOUNDATIONS.spacing, ...runtimeTokens]),
  });
}

/**
 * Builds the Design System projection from the already admitted Catalog and Source model.
 *
 * The result contains only inert JSON and text. It never imports or invokes a component adapter,
 * never interprets a schema as code, and reports missing runtime adapters per component so a
 * schema/adapter drift is visible instead of silently producing a documentation success state.
 */
export function prepareDesignSystemExplorer(
  model: CatalogAuthoringModel,
  options: DesignSystemExplorerOptions = {},
): DesignSystemExplorerResult {
  if (
    model.components.length > MAX_COMPONENTS ||
    model.catalogs.length === 0 ||
    model.components.some((component) => component.id.length === 0)
  ) {
    return Object.freeze({ ok: false, reason: "catalog-invalid" });
  }

  const counts = usageCounts(model);
  const adapterIds =
    options.adapterCapabilityIds === undefined ? null : new Set(options.adapterCapabilityIds);
  const components: DesignSystemComponentDoc[] = [];
  for (const summary of model.components) {
    const contract = findComponentContract(model.validationCatalogs, summary.id);
    if (contract === undefined) {
      components.push(
        Object.freeze({
          id: summary.id,
          displayName: summary.displayName,
          category: summary.authoringCategory,
          description: summary.description,
          usageGuidance: "Repair the Catalog contract before using this capability.",
          usageCount: counts.get(summary.id) ?? 0,
          adapterStatus: adapterIds === null || adapterIds.has(summary.id) ? "ready" : "missing",
          contractStatus: "mismatch",
          props: Object.freeze([]),
          events: Object.freeze([]),
          commands: Object.freeze([]),
          slots: Object.freeze([]),
          parts: Object.freeze([]),
          visualStates: Object.freeze([]),
          scenarios: Object.freeze([]),
        }),
      );
      continue;
    }
    const authoring = ownObject(own(contract, "authoring"));
    const defaultProps =
      ownObject(own(authoring ?? Object.freeze({}), "defaultProps")) ?? Object.freeze({});
    const docs = Object.freeze({
      id: summary.id,
      displayName: summary.displayName,
      category: summary.authoringCategory,
      description: summary.description,
      usageGuidance:
        summary.slotContracts.length > 0
          ? "Compose this capability through its declared slots, then style its named parts. Wire events separately in Connections."
          : summary.visualStates.length > 0
            ? "Start with the declared props, review each visual state, and keep behavior wiring separate from design."
            : "Use the declared props and style parts; add behavior later through the managed Connections boundary.",
      usageCount: counts.get(summary.id) ?? 0,
      adapterStatus:
        adapterIds === null || adapterIds.has(summary.id)
          ? ("ready" as const)
          : ("missing" as const),
      contractStatus: "ready" as const,
      props: propDocs(own(contract, "propsSchema"), defaultProps),
      events: interactionDocs(own(contract, "events")),
      commands: interactionDocs(own(contract, "commands")),
      slots: Object.freeze(summary.slotContracts),
      parts: Object.freeze(summary.styleParts),
      visualStates: Object.freeze(["base", ...summary.visualStates]),
      scenarios: scenarioDocs(own(authoring ?? Object.freeze({}), "scenarios")),
    });
    components.push(docs);
  }

  const adapterMismatchCount = components.filter(
    ({ adapterStatus, contractStatus }) =>
      adapterStatus === "missing" || contractStatus === "mismatch",
  ).length;
  const usageTotal = [...counts.values()].reduce((total, count) => total + count, 0);
  let sourceFingerprint: string;
  try {
    sourceFingerprint = digestCanonicalJson(model.validationDocument);
  } catch {
    return Object.freeze({ ok: false, reason: "source-invalid" });
  }

  return Object.freeze({
    ok: true,
    model: Object.freeze({
      status: "ready",
      catalog: model.catalog,
      catalogs: Object.freeze([...model.catalogs]),
      sourceFingerprint,
      foundations: foundationWithRuntimeTokens(options),
      components: Object.freeze(
        components.sort((left, right) =>
          left.displayName.localeCompare(right.displayName, "en-US"),
        ),
      ),
      usageTotal,
      adapterMismatchCount,
    }),
  });
}
