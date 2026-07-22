import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  parseJsonPointer,
} from "@desen/protocol";

import {
  validateDesenComponentCatalogSet,
  validateDesenComponentContracts,
} from "./component-contract-validation.js";
import { applySchemaContract, validateSchemaContractGraph } from "./schema-instance-validation.js";
import {
  invalidInteractionContractDiagnostic,
  normalizeSemanticDiagnostics,
} from "./semantic-diagnostics.js";
import { compareText, ROOT_POINTER } from "./validation-internals.js";

import type {
  DesenBundle,
  DesenCatalog,
  DesenDiagnosticContext,
  DesenSource,
  JsonPointer,
} from "@desen/protocol";
import type {
  DesenComponentContractObligationKind,
  DesenComponentContractTarget,
  DesenValidatedComponentCatalogSet,
} from "./component-contract-validation.js";
import type { DesenSemanticDiagnostic } from "./semantic-diagnostics.js";
import type { DesenDocumentForTarget, ImmutableJson } from "./structural-validation.js";
import type { JsonObject, JsonValue } from "./validation-internals.js";

export { INVALID_INTERACTION_CONTRACT_CODE } from "./semantic-diagnostics.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_OBLIGATIONS = Object.freeze([]) as readonly [];
const EMPTY_OBJECT = Object.freeze({}) as JsonObject;
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);

/** A Source or Bundle root accepted by cumulative interaction-contract validation. */
export type DesenInteractionContractTarget = DesenComponentContractTarget;

/** A capability kind that owns an event payload contract. */
export type DesenEventCapabilityKind = "behavior" | "component";

/** A JSON value copied and recursively frozen by the resolved event-payload boundary. */
export type DesenResolvedJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly DesenResolvedJsonValue[]
  | { readonly [key: string]: DesenResolvedJsonValue };

/** The unresolved interaction channel that must be checked after DESEN value resolution. */
export type DesenInteractionContractObligationKind =
  DesenComponentContractObligationKind | "behavior-prop" | "behavior-style-part-property";

/**
 * A deterministic requirement to validate one dynamic component or behavior value after resolution.
 */
export interface DesenInteractionContractObligation {
  /** Contract channel that contains the unresolved dynamic value. */
  readonly kind: DesenInteractionContractObligationKind;
  /** Exact ValueSpec location in the immutable Source or Bundle. */
  readonly pointer: JsonPointer;
  /** Stable document, surface, subject, and capability identities. */
  readonly context: Readonly<DesenDiagnosticContext>;
}

/** Successful cumulative T06→T07→T08→T09 interaction-contract validation. */
export interface DesenInteractionContractValidationSuccess<
  Target extends DesenInteractionContractTarget,
> {
  /** Confirms that no cumulative or statically provable interaction error exists. */
  readonly valid: true;
  /** Identifies the validated protocol root. */
  readonly target: Target;
  /** Independent recursively immutable document snapshot created by the T06 boundary. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
  /** Dynamic component and behavior values that still require resolved-value validation. */
  readonly obligations: readonly DesenInteractionContractObligation[];
}

/** Failed cumulative interaction validation with no trusted document value. */
export interface DesenInteractionContractValidationFailure<
  Target extends DesenInteractionContractTarget,
> {
  /** Confirms that one or more cumulative stages failed. */
  readonly valid: false;
  /** Identifies the attempted protocol root. */
  readonly target: Target;
  /** Sorted, de-duplicated T06 through T09 diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  /** Dynamic obligations discovered independently of the reported static failures. */
  readonly obligations: readonly DesenInteractionContractObligation[];
}

/** Result of cumulative Source or Bundle interaction-contract validation. */
export type DesenInteractionContractValidationResult<
  Target extends DesenInteractionContractTarget,
> =
  | DesenInteractionContractValidationSuccess<Target>
  | DesenInteractionContractValidationFailure<Target>;

declare const validatedInteractionCatalogSetBrand: unique symbol;

/**
 * A T08 trusted catalog set whose behavior, event, and command contracts passed T09 preparation.
 *
 * @remarks The nominal brand is backed by a private runtime `WeakMap`. A cast cannot create the
 * metadata required by document or event-payload validation.
 */
export type DesenValidatedInteractionCatalogSet = DesenValidatedComponentCatalogSet & {
  readonly [validatedInteractionCatalogSetBrand]: "DesenValidatedInteractionCatalogSet";
};

/** Successful preparation of interaction contracts for one trusted catalog set. */
export interface DesenInteractionCatalogSetValidationSuccess {
  /** Confirms every cumulative catalog stage passed. */
  readonly valid: true;
  /** Distinguishes this boundary from protocol-document validation. */
  readonly target: "interaction-catalog-set";
  /** The same immutable catalogs, now carrying private T09 trust metadata. */
  readonly value: DesenValidatedInteractionCatalogSet;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed interaction catalog-set preparation with no T09-trusted value. */
export interface DesenInteractionCatalogSetValidationFailure {
  /** Confirms that the catalog set did not pass cumulative preparation. */
  readonly valid: false;
  /** Distinguishes this boundary from protocol-document validation. */
  readonly target: "interaction-catalog-set";
  /** Sorted, de-duplicated cumulative catalog diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of preparing a catalog set for M02-T09 interaction validation. */
export type DesenInteractionCatalogSetValidationResult =
  DesenInteractionCatalogSetValidationSuccess | DesenInteractionCatalogSetValidationFailure;

/** Identifies one declared component or behavior event without retaining adapter state. */
export interface DesenEventContractReference {
  /** Whether the event belongs to a component adapter or behavior adapter. */
  readonly capabilityKind: DesenEventCapabilityKind;
  /** Exact fully qualified capability identifier. */
  readonly capabilityId: string;
  /** Exact declared event name. */
  readonly eventName: string;
}

/** Successful validation of one resolved adapter event payload. */
export interface DesenEventPayloadValidationSuccess {
  /** Confirms the event exists and its payload passed the declared schema. */
  readonly valid: true;
  /** Identifies the dedicated resolved-payload boundary. */
  readonly target: "event-payload";
  /** Independent recursively immutable payload snapshot. */
  readonly value: DesenResolvedJsonValue;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed event-payload validation with no trusted payload value. */
export interface DesenEventPayloadValidationFailure {
  /** Confirms the event lookup, snapshot, or payload schema failed. */
  readonly valid: false;
  /** Identifies the dedicated resolved-payload boundary. */
  readonly target: "event-payload";
  /** Sorted, de-duplicated event or catalog diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of validating one resolved component or behavior event payload. */
export type DesenEventPayloadValidationResult =
  DesenEventPayloadValidationSuccess | DesenEventPayloadValidationFailure;

/** Deterministic limits applied before an event payload reaches its declared schema. */
export const EVENT_PAYLOAD_SAFETY_LIMITS = Object.freeze({
  maxDepth: 128,
  maxJsonNodes: 4_096,
  maxStringCodeUnits: 1_048_576,
} as const);

type SourceSnapshot = ImmutableJson<DesenSource>;
type BundleSnapshot = ImmutableJson<DesenBundle>;
type DocumentSnapshot = SourceSnapshot | BundleSnapshot;
type SurfaceSnapshot = DocumentSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorInstanceSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type ActionSnapshot = NonNullable<NodeSnapshot["on"]>[string][number];
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type ComponentSnapshot = CatalogSnapshot["components"][string];
type BehaviorContractSnapshot = CatalogSnapshot["behaviors"][string];
type BehaviorSlotSnapshot = NonNullable<BehaviorContractSnapshot["slots"]>[string];
type StyleSnapshot = NonNullable<BehaviorInstanceSnapshot["style"]>;

interface CatalogIdentity {
  readonly index: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
}

interface ComponentResolution {
  readonly catalogIndex: number;
  readonly contract: ComponentSnapshot;
}

interface BehaviorResolution {
  readonly catalogIndex: number;
  readonly contract: BehaviorContractSnapshot;
}

interface InteractionCatalogMetadata {
  readonly catalogs: readonly CatalogIdentity[];
  readonly components: ReadonlyMap<string, ComponentResolution>;
  readonly behaviors: ReadonlyMap<string, BehaviorResolution>;
  readonly byIdVersion: ReadonlyMap<string, readonly number[]>;
  readonly byExactTuple: ReadonlyMap<string, readonly number[]>;
}

interface SelectedInteractions {
  readonly components: ReadonlyMap<string, ComponentResolution>;
  readonly behaviors: ReadonlyMap<string, BehaviorResolution>;
}

interface NodeWork {
  readonly node: NodeSnapshot;
  readonly pointer: JsonPointer;
  readonly documentId: string;
  readonly surfaceId: string;
}

interface ActionWork {
  readonly action: ActionSnapshot;
  readonly pointer: JsonPointer;
}

interface NodeTarget {
  readonly node: NodeSnapshot;
  readonly resolution: ComponentResolution;
}

const INTERACTION_CATALOG_METADATA = new WeakMap<object, InteractionCatalogMetadata>();

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  return segments.reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    pointer,
  );
}

function appendRelativePointer(base: JsonPointer, relative: JsonPointer): JsonPointer {
  return parseJsonPointer(relative).reduce<JsonPointer>(
    (current, segment) => appendJsonPointer(current, segment),
    base,
  );
}

function sortedKeys(object: object): readonly string[] {
  return Object.keys(object).sort(compareText);
}

function identityKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function addIndex(index: Map<string, number[]>, key: string, value: number): void {
  const values = index.get(key);
  if (values === undefined) index.set(key, [value]);
  else values.push(value);
}

function freezeIndex(index: ReadonlyMap<string, number[]>): ReadonlyMap<string, readonly number[]> {
  return new Map([...index].map(([key, values]) => [key, Object.freeze([...values])] as const));
}

function nodeContext(
  documentId: string,
  surfaceId: string,
  node: NodeSnapshot,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    subject: Object.freeze({ kind: "node" as const, id: node.id }),
    capabilityId: node.use,
  });
}

function behaviorContext(
  documentId: string,
  surfaceId: string,
  behavior: BehaviorInstanceSnapshot,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    subject: Object.freeze({ kind: "behavior" as const, id: behavior.id }),
    capabilityId: behavior.use,
  });
}

function normalizeObligations(
  obligations: readonly DesenInteractionContractObligation[],
): readonly DesenInteractionContractObligation[] {
  const ordered = [...obligations].sort((left, right) => {
    const pointerOrder = compareText(left.pointer, right.pointer);
    if (pointerOrder !== 0) return pointerOrder;
    const kindOrder = compareText(left.kind, right.kind);
    if (kindOrder !== 0) return kindOrder;
    for (const [leftValue, rightValue] of [
      [left.context.documentId, right.context.documentId],
      [left.context.surfaceId, right.context.surfaceId],
      [left.context.subject?.kind, right.context.subject?.kind],
      [left.context.subject?.id, right.context.subject?.id],
      [left.context.capabilityId, right.context.capabilityId],
    ] as const) {
      const order = compareText(leftValue ?? "", rightValue ?? "");
      if (order !== 0) return order;
    }
    return 0;
  });

  const unique: DesenInteractionContractObligation[] = [];
  let previousKey: string | undefined;
  for (const obligation of ordered) {
    const key = JSON.stringify([
      obligation.pointer,
      obligation.kind,
      obligation.context.documentId,
      obligation.context.surfaceId,
      obligation.context.subject?.kind,
      obligation.context.subject?.id,
      obligation.context.capabilityId,
    ]);
    if (key !== previousKey) unique.push(obligation);
    previousKey = key;
  }
  return Object.freeze(unique);
}

function catalogSetSuccess(
  value: DesenValidatedInteractionCatalogSet,
): DesenInteractionCatalogSetValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "interaction-catalog-set",
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function catalogSetFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenInteractionCatalogSetValidationFailure {
  return Object.freeze({
    valid: false,
    target: "interaction-catalog-set",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function interactionSuccess<Target extends DesenInteractionContractTarget>(
  target: Target,
  value: ImmutableJson<DesenDocumentForTarget<Target>>,
  obligations: readonly DesenInteractionContractObligation[],
): DesenInteractionContractValidationSuccess<Target> {
  return Object.freeze({
    valid: true,
    target,
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
    obligations: normalizeObligations(obligations),
  });
}

function interactionFailure<Target extends DesenInteractionContractTarget>(
  target: Target,
  diagnostics: readonly DesenSemanticDiagnostic[],
  obligations: readonly DesenInteractionContractObligation[] = EMPTY_OBLIGATIONS,
): DesenInteractionContractValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

function payloadSuccess(value: JsonValue): DesenEventPayloadValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "event-payload",
    value: value as DesenResolvedJsonValue,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function payloadFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenEventPayloadValidationFailure {
  return Object.freeze({
    valid: false,
    target: "event-payload",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function buildInteractionMetadata(
  catalogs: DesenValidatedComponentCatalogSet,
): InteractionCatalogMetadata {
  const identities: CatalogIdentity[] = [];
  const components = new Map<string, ComponentResolution>();
  const behaviors = new Map<string, BehaviorResolution>();
  const byIdVersion = new Map<string, number[]>();
  const byExactTuple = new Map<string, number[]>();

  catalogs.forEach((catalog, catalogIndex) => {
    identities.push(
      Object.freeze({
        index: catalogIndex,
        id: catalog.id,
        version: catalog.version,
        target: catalog.target,
      }),
    );
    addIndex(byIdVersion, identityKey(catalog.id, catalog.version), catalogIndex);
    addIndex(byExactTuple, identityKey(catalog.id, catalog.version, catalog.target), catalogIndex);
    for (const componentId of sortedKeys(catalog.components)) {
      const contract = catalog.components[componentId];
      if (contract !== undefined) {
        components.set(componentId, Object.freeze({ catalogIndex, contract }));
      }
    }
    for (const behaviorId of sortedKeys(catalog.behaviors)) {
      const contract = catalog.behaviors[behaviorId];
      if (contract !== undefined) {
        behaviors.set(behaviorId, Object.freeze({ catalogIndex, contract }));
      }
    }
  });

  return Object.freeze({
    catalogs: Object.freeze(identities),
    components,
    behaviors,
    byIdVersion: freezeIndex(byIdVersion),
    byExactTuple: freezeIndex(byExactTuple),
  });
}

function rawObject(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function inspectRawContractMap(
  owner: Readonly<Record<string, unknown>>,
  mapName: "commands" | "events",
  schemaName: "inputSchema" | "payloadSchema",
  ownerPointer: JsonPointer,
  capabilityId: string,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const contracts = rawObject(Object.hasOwn(owner, mapName) ? owner[mapName] : undefined);
  if (contracts === undefined) return;
  for (const contractName of sortedKeys(contracts)) {
    const contract = rawObject(contracts[contractName]);
    if (contract === undefined) continue;
    const schema = Object.hasOwn(contract, schemaName) ? contract[schemaName] : undefined;
    if (
      validateSchemaContractGraph(schema).some(
        ({ keyword }) => keyword === "schemaGraphDepth" || keyword === "schemaGraphSize",
      )
    ) {
      diagnostics.push(
        invalidInteractionContractDiagnostic(
          appendPath(ownerPointer, mapName, contractName, schemaName),
          { capabilityId },
        ),
      );
    }
  }
}

function interactionCatalogShapeDiagnostics(input: unknown): readonly DesenSemanticDiagnostic[] {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(canonicalizeJson(input)) as unknown;
  } catch {
    return EMPTY_DIAGNOSTICS;
  }
  if (!Array.isArray(snapshot)) return EMPTY_DIAGNOSTICS;
  const diagnostics: DesenSemanticDiagnostic[] = [];

  const inspectSchema = (schema: unknown, pointer: JsonPointer, capabilityId: string): void => {
    if (
      validateSchemaContractGraph(schema).some(
        ({ keyword }) => keyword === "schemaGraphDepth" || keyword === "schemaGraphSize",
      )
    ) {
      diagnostics.push(invalidInteractionContractDiagnostic(pointer, { capabilityId }));
    }
  };

  snapshot.forEach((catalogValue, catalogIndex) => {
    const catalog = rawObject(catalogValue);
    if (catalog === undefined) return;
    const components = rawObject(
      Object.hasOwn(catalog, "components") ? catalog.components : undefined,
    );
    if (components !== undefined) {
      for (const componentId of sortedKeys(components)) {
        const component = rawObject(components[componentId]);
        if (component === undefined) continue;
        inspectRawContractMap(
          component,
          "events",
          "payloadSchema",
          appendPath(ROOT_POINTER, catalogIndex, "components", componentId),
          componentId,
          diagnostics,
        );
        inspectRawContractMap(
          component,
          "commands",
          "inputSchema",
          appendPath(ROOT_POINTER, catalogIndex, "components", componentId),
          componentId,
          diagnostics,
        );
      }
    }

    const behaviors = rawObject(
      Object.hasOwn(catalog, "behaviors") ? catalog.behaviors : undefined,
    );
    if (behaviors === undefined) return;
    for (const behaviorId of sortedKeys(behaviors)) {
      const behavior = rawObject(behaviors[behaviorId]);
      if (behavior === undefined) continue;
      const behaviorPointer = appendPath(ROOT_POINTER, catalogIndex, "behaviors", behaviorId);
      inspectSchema(
        behavior.propsSchema,
        appendJsonPointer(behaviorPointer, "propsSchema"),
        behaviorId,
      );
      inspectRawContractMap(
        behavior,
        "events",
        "payloadSchema",
        behaviorPointer,
        behaviorId,
        diagnostics,
      );
      inspectRawContractMap(
        behavior,
        "commands",
        "inputSchema",
        behaviorPointer,
        behaviorId,
        diagnostics,
      );
      const styleParts = rawObject(
        Object.hasOwn(behavior, "styleParts") ? behavior.styleParts : undefined,
      );
      if (styleParts === undefined) continue;
      for (const partName of sortedKeys(styleParts)) {
        const part = rawObject(styleParts[partName]);
        if (part !== undefined) {
          inspectSchema(
            part.propertiesSchema,
            appendPath(behaviorPointer, "styleParts", partName, "propertiesSchema"),
            behaviorId,
          );
        }
      }
    }
  });

  return normalizeSemanticDiagnostics(diagnostics);
}

function effectiveMinimum(slot: BehaviorSlotSnapshot): number {
  const minimum = Object.hasOwn(slot, "minItems") ? slot.minItems : undefined;
  const required = Object.hasOwn(slot, "required") && slot.required === true;
  return minimum ?? (required ? 1 : 0);
}

function addSchemaGraphDiagnostics(
  schema: unknown,
  basePointer: JsonPointer,
  capabilityId: string,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  for (const graphIssue of validateSchemaContractGraph(schema)) {
    diagnostics.push(
      invalidInteractionContractDiagnostic(appendRelativePointer(basePointer, graphIssue.pointer), {
        capabilityId,
      }),
    );
  }
}

function interactionCatalogDiagnostics(
  catalogs: DesenValidatedComponentCatalogSet,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  catalogs.forEach((catalog, catalogIndex) => {
    for (const componentId of sortedKeys(catalog.components)) {
      const component = catalog.components[componentId];
      if (component === undefined) continue;
      const componentPointer = appendPath(ROOT_POINTER, catalogIndex, "components", componentId);
      const events = Object.hasOwn(component, "events") ? component.events : undefined;
      if (events !== undefined) {
        for (const eventName of sortedKeys(events)) {
          const event = events[eventName];
          if (event !== undefined) {
            addSchemaGraphDiagnostics(
              event.payloadSchema,
              appendPath(componentPointer, "events", eventName, "payloadSchema"),
              componentId,
              diagnostics,
            );
          }
        }
      }
      const commands = Object.hasOwn(component, "commands") ? component.commands : undefined;
      if (commands !== undefined) {
        for (const commandName of sortedKeys(commands)) {
          const command = commands[commandName];
          if (command !== undefined) {
            addSchemaGraphDiagnostics(
              command.inputSchema,
              appendPath(componentPointer, "commands", commandName, "inputSchema"),
              componentId,
              diagnostics,
            );
          }
        }
      }
    }

    for (const behaviorId of sortedKeys(catalog.behaviors)) {
      const behavior = catalog.behaviors[behaviorId];
      if (behavior === undefined) continue;
      const behaviorPointer = appendPath(ROOT_POINTER, catalogIndex, "behaviors", behaviorId);
      addSchemaGraphDiagnostics(
        behavior.propsSchema,
        appendJsonPointer(behaviorPointer, "propsSchema"),
        behaviorId,
        diagnostics,
      );
      const events = Object.hasOwn(behavior, "events") ? behavior.events : undefined;
      if (events !== undefined) {
        for (const eventName of sortedKeys(events)) {
          const event = events[eventName];
          if (event !== undefined) {
            addSchemaGraphDiagnostics(
              event.payloadSchema,
              appendPath(behaviorPointer, "events", eventName, "payloadSchema"),
              behaviorId,
              diagnostics,
            );
          }
        }
      }
      const commands = Object.hasOwn(behavior, "commands") ? behavior.commands : undefined;
      if (commands !== undefined) {
        for (const commandName of sortedKeys(commands)) {
          const command = commands[commandName];
          if (command !== undefined) {
            addSchemaGraphDiagnostics(
              command.inputSchema,
              appendPath(behaviorPointer, "commands", commandName, "inputSchema"),
              behaviorId,
              diagnostics,
            );
          }
        }
      }
      const styleParts = Object.hasOwn(behavior, "styleParts") ? behavior.styleParts : undefined;
      if (styleParts !== undefined) {
        for (const partName of sortedKeys(styleParts)) {
          const part = styleParts[partName];
          if (part !== undefined) {
            addSchemaGraphDiagnostics(
              part.propertiesSchema,
              appendPath(behaviorPointer, "styleParts", partName, "propertiesSchema"),
              behaviorId,
              diagnostics,
            );
          }
        }
      }
      const slots = Object.hasOwn(behavior, "slots") ? behavior.slots : undefined;
      if (slots !== undefined) {
        for (const slotName of sortedKeys(slots)) {
          const slot = slots[slotName];
          if (
            slot !== undefined &&
            Object.hasOwn(slot, "maxItems") &&
            slot.maxItems !== undefined &&
            slot.maxItems < effectiveMinimum(slot)
          ) {
            diagnostics.push(
              invalidInteractionContractDiagnostic(appendPath(behaviorPointer, "slots", slotName), {
                capabilityId: behaviorId,
              }),
            );
          }
        }
      }
    }
  });
  return normalizeSemanticDiagnostics(diagnostics);
}

/**
 * Prepares unknown catalogs for cumulative M02-T09 interaction-contract validation.
 *
 * @remarks The input first passes T06 through T08. T09 then admits behavior prop/style schemas,
 * component and behavior event payload schemas, and component and behavior command input schemas
 * through the same bounded host-safe profile. Behavior slot ranges are checked for coherence. No
 * schema is compiled, no reference is fetched, and no document or catalog selects executable code.
 */
export function validateDesenInteractionCatalogSet(
  input: unknown,
): DesenInteractionCatalogSetValidationResult {
  if (typeof input === "object" && input !== null) {
    const existing = INTERACTION_CATALOG_METADATA.get(input);
    if (existing !== undefined) {
      return catalogSetSuccess(input as DesenValidatedInteractionCatalogSet);
    }
  }

  const shapeDiagnostics = interactionCatalogShapeDiagnostics(input);
  if (shapeDiagnostics.length > 0) return catalogSetFailure(shapeDiagnostics);

  let componentCatalogs: ReturnType<typeof validateDesenComponentCatalogSet>;
  try {
    componentCatalogs = validateDesenComponentCatalogSet(input);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return catalogSetFailure([invalidInteractionContractDiagnostic(ROOT_POINTER)]);
  }
  if (!componentCatalogs.valid) return catalogSetFailure(componentCatalogs.diagnostics);

  const diagnostics = interactionCatalogDiagnostics(componentCatalogs.value);
  if (diagnostics.length > 0) return catalogSetFailure(diagnostics);

  const value = componentCatalogs.value as DesenValidatedInteractionCatalogSet;
  INTERACTION_CATALOG_METADATA.set(value, buildInteractionMetadata(componentCatalogs.value));
  return catalogSetSuccess(value);
}

/**
 * Returns one immutable event payload schema from the private T09 preparation boundary.
 *
 * @internal This module-only bridge lets later cumulative validator stages inspect a declared
 * event shape without duplicating catalog indexes or weakening the nominal catalog-set brand. An
 * object that merely resembles {@link DesenValidatedInteractionCatalogSet} has no `WeakMap`
 * metadata and therefore cannot expose a schema through this function.
 */
export function getPreparedDesenEventPayloadSchema(
  catalogSet: DesenValidatedInteractionCatalogSet,
  capabilityKind: DesenEventCapabilityKind,
  capabilityId: string,
  eventName: string,
): unknown | undefined {
  if (
    (capabilityKind !== "component" && capabilityKind !== "behavior") ||
    typeof capabilityId !== "string" ||
    typeof eventName !== "string"
  ) {
    return undefined;
  }

  const metadata = INTERACTION_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) return undefined;
  const capability =
    capabilityKind === "component"
      ? metadata.components.get(capabilityId)?.contract
      : metadata.behaviors.get(capabilityId)?.contract;
  const events =
    capability !== undefined && Object.hasOwn(capability, "events") ? capability.events : undefined;
  if (events === undefined || !Object.hasOwn(events, eventName)) return undefined;
  return events[eventName]?.payloadSchema;
}

function selectedInteractions(
  target: DesenInteractionContractTarget,
  document: DocumentSnapshot,
  metadata: InteractionCatalogMetadata,
): SelectedInteractions {
  const selectedCatalogs = new Set<number>();
  const requirements =
    target === "source"
      ? (document as SourceSnapshot).catalogs
      : (document as BundleSnapshot).requires.catalogs;

  requirements.forEach((requirement) => {
    const requirementTarget = Object.hasOwn(requirement, "target") ? requirement.target : undefined;
    const matches =
      target === "source" && requirementTarget === undefined
        ? metadata.byIdVersion.get(identityKey(requirement.id, requirement.version))
        : metadata.byExactTuple.get(
            identityKey(requirement.id, requirement.version, requirementTarget ?? ""),
          );
    if (matches?.length === 1) selectedCatalogs.add(matches[0] as number);
  });

  return Object.freeze({
    components: new Map(
      [...metadata.components].filter(([, resolution]) =>
        selectedCatalogs.has(resolution.catalogIndex),
      ),
    ),
    behaviors: new Map(
      [...metadata.behaviors].filter(([, resolution]) =>
        selectedCatalogs.has(resolution.catalogIndex),
      ),
    ),
  });
}

function addBehaviorContractDiagnostic(
  code: "PROP_TYPE_MISMATCH" | "UNKNOWN_PROP",
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  diagnostics.push(
    createCoreDiagnostic({
      code,
      message:
        code === "UNKNOWN_PROP"
          ? "A behavior property, visual state, or style part is not declared by its capability."
          : "A statically known behavior contract value does not satisfy its declared schema.",
      pointer,
      context,
    }),
  );
}

function applyBehaviorValueSchema(
  schema: JsonObject,
  value: JsonObject,
  basePointer: JsonPointer,
  obligationKind: "behavior-prop" | "behavior-style-part-property",
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenInteractionContractObligation[],
): void {
  let result: ReturnType<typeof applySchemaContract>;
  try {
    result = applySchemaContract(schema, value, "complete");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    addBehaviorContractDiagnostic("PROP_TYPE_MISMATCH", basePointer, context, diagnostics);
    return;
  }
  for (const issue of result.issues) {
    addBehaviorContractDiagnostic(
      issue.kind === "unknown-property" ? "UNKNOWN_PROP" : "PROP_TYPE_MISMATCH",
      appendRelativePointer(basePointer, issue.pointer),
      context,
      diagnostics,
    );
  }
  for (const obligation of result.obligations) {
    obligations.push(
      Object.freeze({
        kind: obligationKind,
        pointer: appendRelativePointer(basePointer, obligation.pointer),
        context,
      }),
    );
  }
}

function validateBehaviorStyle(
  style: StyleSnapshot | undefined,
  stylePointer: JsonPointer,
  contract: BehaviorContractSnapshot,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenInteractionContractObligation[],
): void {
  if (style === undefined) return;
  const visualStates = new Set(
    Object.hasOwn(contract, "visualStates") ? (contract.visualStates ?? []) : [],
  );
  const styleParts = Object.hasOwn(contract, "styleParts") ? (contract.styleParts ?? {}) : {};

  for (const stateName of sortedKeys(style)) {
    const statePointer = appendJsonPointer(stylePointer, stateName);
    if (stateName !== "base" && !visualStates.has(stateName)) {
      addBehaviorContractDiagnostic("UNKNOWN_PROP", statePointer, context, diagnostics);
    }
    const parts = style[stateName];
    if (parts === undefined) continue;
    for (const partName of sortedKeys(parts)) {
      const partPointer = appendJsonPointer(statePointer, partName);
      const partContract = Object.hasOwn(styleParts, partName) ? styleParts[partName] : undefined;
      if (partContract === undefined) {
        addBehaviorContractDiagnostic("UNKNOWN_PROP", partPointer, context, diagnostics);
        continue;
      }
      const values = parts[partName];
      if (values === undefined) continue;
      applyBehaviorValueSchema(
        partContract.propertiesSchema as JsonObject,
        values as JsonObject,
        partPointer,
        "behavior-style-part-property",
        context,
        diagnostics,
        obligations,
      );
    }
  }
}

function pushNodeChildren(
  stack: NodeWork[],
  children: readonly NodeSnapshot[],
  pointer: JsonPointer,
  documentId: string,
  surfaceId: string,
): void {
  for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
    stack.push({
      node: children[childIndex] as NodeSnapshot,
      pointer: appendJsonPointer(pointer, childIndex),
      documentId,
      surfaceId,
    });
  }
}

function validateBehaviorSlots(
  stack: NodeWork[],
  behavior: BehaviorInstanceSnapshot,
  behaviorPointer: JsonPointer,
  contract: BehaviorContractSnapshot,
  components: ReadonlyMap<string, ComponentResolution>,
  documentId: string,
  surfaceId: string,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const contracts = Object.hasOwn(contract, "slots") ? (contract.slots ?? {}) : {};
  const slots = Object.hasOwn(behavior, "slots") ? (behavior.slots ?? {}) : {};

  for (const slotName of sortedKeys(contracts)) {
    const slotContract = Object.hasOwn(contracts, slotName) ? contracts[slotName] : undefined;
    if (
      slotContract !== undefined &&
      Object.hasOwn(slotContract, "required") &&
      slotContract.required === true &&
      !Object.hasOwn(slots, slotName)
    ) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "SLOT_CARDINALITY",
          message: "A required behavior slot is missing.",
          pointer: appendPath(behaviorPointer, "slots", slotName),
          context,
        }),
      );
    }
  }

  const slotNames = sortedKeys(slots);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = slots[slotName] ?? [];
    const slotPointer = appendPath(behaviorPointer, "slots", slotName);
    const slotContract = Object.hasOwn(contracts, slotName) ? contracts[slotName] : undefined;

    if (slotContract === undefined) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "UNKNOWN_SLOT",
          message: "A behavior instance uses a slot that its capability does not declare.",
          pointer: slotPointer,
          context,
        }),
      );
    } else {
      const minimum = effectiveMinimum(slotContract);
      if (
        children.length < minimum ||
        (Object.hasOwn(slotContract, "maxItems") &&
          slotContract.maxItems !== undefined &&
          children.length > slotContract.maxItems)
      ) {
        diagnostics.push(
          createCoreDiagnostic({
            code: "SLOT_CARDINALITY",
            message: "A behavior slot contains a disallowed number of child nodes.",
            pointer: slotPointer,
            context,
          }),
        );
      }

      const constrainsChildren =
        Object.hasOwn(slotContract, "accepts") || Object.hasOwn(slotContract, "acceptsCategories");
      if (constrainsChildren) {
        const acceptedIds = new Set(
          Object.hasOwn(slotContract, "accepts") ? (slotContract.accepts ?? []) : [],
        );
        const acceptedCategories = new Set(
          Object.hasOwn(slotContract, "acceptsCategories")
            ? (slotContract.acceptsCategories ?? [])
            : [],
        );
        children.forEach((child, childIndex) => {
          const childResolution = components.get(child.use);
          if (childResolution === undefined) return;
          const category = Object.hasOwn(childResolution.contract, "category")
            ? childResolution.contract.category
            : undefined;
          if (
            !acceptedIds.has(child.use) &&
            (category === undefined || !acceptedCategories.has(category))
          ) {
            diagnostics.push(
              createCoreDiagnostic({
                code: "SLOT_CHILD_REJECTED",
                message:
                  "A child component does not match its behavior slot's accepted identity or category.",
                pointer: appendPath(slotPointer, childIndex, "use"),
                context,
              }),
            );
          }
        });
      }
    }

    pushNodeChildren(
      stack,
      children as readonly NodeSnapshot[],
      slotPointer,
      documentId,
      surfaceId,
    );
  }
}

function pushHandlerActions(
  actions: readonly ActionSnapshot[],
  handlerPointer: JsonPointer,
  actionStack: ActionWork[],
): void {
  for (let actionIndex = actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
    actionStack.push({
      action: actions[actionIndex] as ActionSnapshot,
      pointer: appendJsonPointer(handlerPointer, actionIndex),
    });
  }
}

function validateEventHandlers(
  handlers: Readonly<Record<string, readonly ActionSnapshot[]>> | undefined,
  declarations: Readonly<Record<string, unknown>> | undefined,
  ownerPointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
  actionStack: ActionWork[],
  diagnostics: DesenSemanticDiagnostic[],
): void {
  if (handlers === undefined) return;
  for (const eventName of sortedKeys(handlers)) {
    const handlerPointer = appendPath(ownerPointer, "on", eventName);
    if (declarations === undefined || !Object.hasOwn(declarations, eventName)) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "UNKNOWN_EVENT",
          message: "An event handler targets an event not declared by its capability.",
          pointer: handlerPointer,
          context,
        }),
      );
    }
    pushHandlerActions(handlers[eventName] ?? [], handlerPointer, actionStack);
  }
}

function validateAttachment(
  behaviorPointer: JsonPointer,
  behaviorContract: BehaviorContractSnapshot,
  parentNode: NodeSnapshot,
  parentComponent: ComponentSnapshot,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const allowedCapabilities = new Set(
    Object.hasOwn(behaviorContract.attachTo, "capabilities")
      ? (behaviorContract.attachTo.capabilities ?? [])
      : [],
  );
  const allowedCategories = new Set(
    Object.hasOwn(behaviorContract.attachTo, "categories")
      ? (behaviorContract.attachTo.categories ?? [])
      : [],
  );
  const category = Object.hasOwn(parentComponent, "category")
    ? parentComponent.category
    : undefined;
  const accepted =
    allowedCapabilities.has(parentNode.use) ||
    (category !== undefined && allowedCategories.has(category));
  if (accepted) return;

  diagnostics.push(
    createCoreDiagnostic({
      code: "BEHAVIOR_ATTACHMENT_INVALID",
      message: "The behavior cannot attach to this component identity or category.",
      pointer: appendJsonPointer(behaviorPointer, "use"),
      context,
    }),
  );
}

function mutuallyCompatible(
  leftUse: string,
  left: BehaviorContractSnapshot,
  rightUse: string,
  right: BehaviorContractSnapshot,
): boolean {
  const leftComposition = Object.hasOwn(left, "composition") ? left.composition : undefined;
  const rightComposition = Object.hasOwn(right, "composition") ? right.composition : undefined;
  return (
    new Set(
      leftComposition !== undefined && Object.hasOwn(leftComposition, "compatibleWith")
        ? (leftComposition.compatibleWith ?? [])
        : [],
    ).has(rightUse) &&
    new Set(
      rightComposition !== undefined && Object.hasOwn(rightComposition, "compatibleWith")
        ? (rightComposition.compatibleWith ?? [])
        : [],
    ).has(leftUse)
  );
}

function validateBehaviorConflicts(
  behaviors: readonly BehaviorInstanceSnapshot[],
  resolutions: readonly (BehaviorResolution | undefined)[],
  nodePointer: JsonPointer,
  documentId: string,
  surfaceId: string,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const ownersByChannel = new Map<string, Map<string, BehaviorContractSnapshot>>();

  behaviors.forEach((behavior, behaviorIndex) => {
    const resolution = resolutions[behaviorIndex];
    if (resolution === undefined) return;
    const composition = Object.hasOwn(resolution.contract, "composition")
      ? resolution.contract.composition
      : undefined;
    const channels = [
      ...new Set(
        composition !== undefined && Object.hasOwn(composition, "exclusiveChannels")
          ? (composition.exclusiveChannels ?? [])
          : [],
      ),
    ].sort(compareText);
    const priorCapabilities = new Map<string, BehaviorContractSnapshot>();
    channels.forEach((channel) => {
      ownersByChannel.get(channel)?.forEach((contract, capabilityId) => {
        priorCapabilities.set(capabilityId, contract);
      });
    });

    let conflict = false;
    for (const [priorUse, priorContract] of [...priorCapabilities].sort(([left], [right]) =>
      compareText(left, right),
    )) {
      if (!mutuallyCompatible(priorUse, priorContract, behavior.use, resolution.contract)) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "BEHAVIOR_CONFLICT",
          message:
            "Attached behaviors share an exclusive channel without mutual declared compatibility.",
          pointer: appendPath(nodePointer, "behaviors", behaviorIndex, "use"),
          context: behaviorContext(documentId, surfaceId, behavior),
        }),
      );
    }

    channels.forEach((channel) => {
      const owners = ownersByChannel.get(channel);
      if (owners === undefined) {
        ownersByChannel.set(channel, new Map([[behavior.use, resolution.contract]]));
      } else {
        owners.set(behavior.use, resolution.contract);
      }
    });
  });
}

function validateBehaviorInstance(
  stack: NodeWork[],
  actionStack: ActionWork[],
  behavior: BehaviorInstanceSnapshot,
  behaviorIndex: number,
  work: NodeWork,
  parentComponent: ComponentSnapshot,
  interactions: SelectedInteractions,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenInteractionContractObligation[],
): BehaviorResolution | undefined {
  const behaviorPointer = appendPath(work.pointer, "behaviors", behaviorIndex);
  const resolution = interactions.behaviors.get(behavior.use);
  if (resolution === undefined) return undefined;
  const contract = resolution.contract;
  const context = behaviorContext(work.documentId, work.surfaceId, behavior);

  validateAttachment(behaviorPointer, contract, work.node, parentComponent, context, diagnostics);
  applyBehaviorValueSchema(
    contract.propsSchema as JsonObject,
    (Object.hasOwn(behavior, "props")
      ? (behavior.props ?? EMPTY_OBJECT)
      : EMPTY_OBJECT) as JsonObject,
    appendPath(behaviorPointer, "props"),
    "behavior-prop",
    context,
    diagnostics,
    obligations,
  );
  validateBehaviorStyle(
    Object.hasOwn(behavior, "style") ? behavior.style : undefined,
    appendPath(behaviorPointer, "style"),
    contract,
    context,
    diagnostics,
    obligations,
  );
  validateBehaviorSlots(
    stack,
    behavior,
    behaviorPointer,
    contract,
    interactions.components,
    work.documentId,
    work.surfaceId,
    context,
    diagnostics,
  );
  validateEventHandlers(
    Object.hasOwn(behavior, "on") ? behavior.on : undefined,
    Object.hasOwn(contract, "events") ? contract.events : undefined,
    behaviorPointer,
    context,
    actionStack,
    diagnostics,
  );
  return resolution;
}

function pushComponentSlotChildren(stack: NodeWork[], work: NodeWork): void {
  const slots = Object.hasOwn(work.node, "slots") ? (work.node.slots ?? {}) : {};
  const slotNames = sortedKeys(slots);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = slots[slotName] ?? [];
    pushNodeChildren(
      stack,
      children as readonly NodeSnapshot[],
      appendPath(work.pointer, "slots", slotName),
      work.documentId,
      work.surfaceId,
    );
  }
}

function validateNodeInteractions(
  stack: NodeWork[],
  actionStack: ActionWork[],
  nodeTargets: Map<string, NodeTarget>,
  work: NodeWork,
  interactions: SelectedInteractions,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenInteractionContractObligation[],
): void {
  const componentResolution = interactions.components.get(work.node.use);
  if (componentResolution === undefined) return;
  nodeTargets.set(
    work.node.id,
    Object.freeze({ node: work.node, resolution: componentResolution }),
  );
  const context = nodeContext(work.documentId, work.surfaceId, work.node);

  validateEventHandlers(
    Object.hasOwn(work.node, "on") ? work.node.on : undefined,
    Object.hasOwn(componentResolution.contract, "events")
      ? componentResolution.contract.events
      : undefined,
    work.pointer,
    context,
    actionStack,
    diagnostics,
  );

  const behaviors = Object.hasOwn(work.node, "behaviors") ? (work.node.behaviors ?? []) : [];
  const resolutions: (BehaviorResolution | undefined)[] = [];
  behaviors.forEach((behavior, behaviorIndex) => {
    resolutions.push(
      validateBehaviorInstance(
        stack,
        actionStack,
        behavior,
        behaviorIndex,
        work,
        componentResolution.contract,
        interactions,
        diagnostics,
        obligations,
      ),
    );
  });
  validateBehaviorConflicts(
    behaviors,
    resolutions,
    work.pointer,
    work.documentId,
    work.surfaceId,
    diagnostics,
  );
  pushComponentSlotChildren(stack, work);
}

function pushNestedActions(actionWork: ActionWork, actionStack: ActionWork[]): void {
  if (actionWork.action.type !== "operation.invoke") return;
  for (const [field, actions] of [
    ["onFailure", actionWork.action.onFailure],
    ["onSuccess", actionWork.action.onSuccess],
  ] as const) {
    if (actions === undefined) continue;
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      actionStack.push({
        action: actions[index] as ActionSnapshot,
        pointer: appendPath(actionWork.pointer, field, index),
      });
    }
  }
}

function validateKnownCommandNames(
  actionStack: ActionWork[],
  nodeTargets: ReadonlyMap<string, NodeTarget>,
  documentId: string,
  surfaceId: string,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  while (actionStack.length > 0) {
    const work = actionStack.pop() as ActionWork;
    pushNestedActions(work, actionStack);
    if (work.action.type !== "component.command") continue;

    const target = nodeTargets.get(work.action.target);
    // Missing, behavior, conditional-liveness, and resolved-input semantics belong to M02-T11.
    if (target === undefined) continue;
    const commands = Object.hasOwn(target.resolution.contract, "commands")
      ? target.resolution.contract.commands
      : undefined;
    if (commands !== undefined && Object.hasOwn(commands, work.action.command)) continue;
    diagnostics.push(
      createCoreDiagnostic({
        code: "UNKNOWN_COMMAND",
        message: "A known component target does not declare the requested command.",
        pointer: appendJsonPointer(work.pointer, "command"),
        context: nodeContext(documentId, surfaceId, target.node),
      }),
    );
  }
}

function surfaceInteractionDiagnostics(
  document: DocumentSnapshot,
  surfaceId: string,
  surface: SurfaceSnapshot,
  interactions: SelectedInteractions,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenInteractionContractObligation[],
): void {
  const stack: NodeWork[] = [
    {
      node: surface.root,
      pointer: appendPath(ROOT_POINTER, "surfaces", surfaceId, "root"),
      documentId: document.id,
      surfaceId,
    },
  ];
  const actionStack: ActionWork[] = [];
  const nodeTargets = new Map<string, NodeTarget>();

  while (stack.length > 0) {
    validateNodeInteractions(
      stack,
      actionStack,
      nodeTargets,
      stack.pop() as NodeWork,
      interactions,
      diagnostics,
      obligations,
    );
  }
  validateKnownCommandNames(actionStack, nodeTargets, document.id, surfaceId, diagnostics);
}

function interactionDocumentDiagnostics(
  document: DocumentSnapshot,
  interactions: SelectedInteractions,
): Readonly<{
  diagnostics: readonly DesenSemanticDiagnostic[];
  obligations: readonly DesenInteractionContractObligation[];
}> {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const obligations: DesenInteractionContractObligation[] = [];

  for (const surfaceId of sortedKeys(document.surfaces)) {
    const surface = document.surfaces[surfaceId];
    if (surface !== undefined) {
      surfaceInteractionDiagnostics(
        document,
        surfaceId,
        surface,
        interactions,
        diagnostics,
        obligations,
      );
    }
  }
  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

/**
 * Applies cumulative structural, semantic, component, behavior, event, and command-name checks.
 *
 * @remarks The exact set returned by {@link validateDesenInteractionCatalogSet} is required. T09
 * validates behavior props, slots, styles and attachment/conflict rules, component and behavior
 * event names, and command names only when a component target is already statically known. It
 * intentionally leaves event-reference paths to T10 and command targets, liveness, resolved input,
 * resources, operations, navigation, and other action semantics to T11 and the runtime.
 */
export function validateDesenInteractionContracts<Target extends DesenInteractionContractTarget>(
  target: Target,
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenInteractionContractValidationResult<Target> {
  const components = validateDesenComponentContracts(target, input, catalogSet);
  if (!components.valid) {
    return interactionFailure(
      target,
      components.diagnostics,
      components.obligations as readonly DesenInteractionContractObligation[],
    );
  }

  const metadata = INTERACTION_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) {
    const document = components.value as SourceSnapshot | BundleSnapshot;
    const pointer =
      target === "source"
        ? appendPath(ROOT_POINTER, "catalogs")
        : appendPath(ROOT_POINTER, "requires", "catalogs");
    return interactionFailure(
      target,
      [invalidInteractionContractDiagnostic(pointer, { documentId: document.id })],
      components.obligations as readonly DesenInteractionContractObligation[],
    );
  }

  const document = components.value as SourceSnapshot | BundleSnapshot;
  const selected = selectedInteractions(target, document, metadata);
  const interactions = interactionDocumentDiagnostics(document, selected);
  const obligations = [
    ...(components.obligations as readonly DesenInteractionContractObligation[]),
    ...interactions.obligations,
  ];
  return interactions.diagnostics.length === 0
    ? interactionSuccess(target, components.value, obligations)
    : interactionFailure(target, interactions.diagnostics, obligations);
}

/** Validates a Source cumulatively through the M02-T09 interaction-contract boundary. */
export function validateDesenSourceInteractionContracts(
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenInteractionContractValidationResult<"source"> {
  return validateDesenInteractionContracts("source", input, catalogSet);
}

/** Validates a Bundle cumulatively through the M02-T09 interaction-contract boundary. */
export function validateDesenBundleInteractionContracts(
  input: unknown,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenInteractionContractValidationResult<"bundle"> {
  return validateDesenInteractionContracts("bundle", input, catalogSet);
}

interface JsonSnapshotVisit {
  readonly kind: "visit";
  readonly source: unknown;
  readonly depth: number;
  readonly assign: (value: JsonValue) => void;
}

interface JsonSnapshotLeave {
  readonly kind: "leave";
  readonly source: object;
}

type JsonSnapshotWork = JsonSnapshotLeave | JsonSnapshotVisit;

function hasJsonObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  return (
    Object.getPrototypeOf(prototype) === null &&
    constructor !== undefined &&
    "value" in constructor &&
    typeof constructor.value === "function" &&
    Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE
  );
}

function enumerableDataValue(
  owner: object,
  key: PropertyKey,
): { readonly valid: true; readonly value: unknown } | { readonly valid: false } {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? { valid: true, value: descriptor.value }
    : { valid: false };
}

function freezeJsonSnapshot(snapshot: JsonValue): JsonValue {
  const pending: JsonValue[] = [snapshot];
  const containers: (JsonObject | readonly JsonValue[])[] = [];
  while (pending.length > 0) {
    const value = pending.pop() as JsonValue;
    if (typeof value !== "object" || value === null) continue;
    containers.push(value);
    if (Array.isArray(value)) pending.push(...value);
    else pending.push(...Object.values(value));
  }
  for (let index = containers.length - 1; index >= 0; index -= 1) {
    Object.freeze(containers[index]);
  }
  return snapshot;
}

// Count every JSON occurrence while copying data descriptors, before canonical serialization.
// This order keeps shared, acyclic containers from expanding beyond the public node budget.
function inertBoundedJsonSnapshot(input: unknown): JsonValue | undefined {
  const root: { value?: JsonValue } = {};
  const activeContainers = new WeakSet<object>();
  const pending: JsonSnapshotWork[] = [
    {
      kind: "visit",
      source: input,
      depth: 0,
      assign(value) {
        root.value = value;
      },
    },
  ];
  let discoveredNodes = 1;
  let stringCodeUnits = 0;

  try {
    while (pending.length > 0) {
      const work = pending.pop() as JsonSnapshotWork;
      if (work.kind === "leave") {
        activeContainers.delete(work.source);
        continue;
      }

      if (work.depth > EVENT_PAYLOAD_SAFETY_LIMITS.maxDepth) {
        return undefined;
      }

      const { source } = work;
      if (source === null || typeof source === "boolean") {
        work.assign(source);
        continue;
      }
      if (typeof source === "number") {
        if (!Number.isFinite(source)) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source === "string") {
        stringCodeUnits += source.length;
        if (stringCodeUnits > EVENT_PAYLOAD_SAFETY_LIMITS.maxStringCodeUnits) return undefined;
        work.assign(source);
        continue;
      }
      if (typeof source !== "object" || activeContainers.has(source)) return undefined;

      activeContainers.add(source);
      pending.push({ kind: "leave", source });

      if (Array.isArray(source)) {
        const lengthDescriptor = Object.getOwnPropertyDescriptor(source, "length");
        if (
          lengthDescriptor === undefined ||
          !("value" in lengthDescriptor) ||
          typeof lengthDescriptor.value !== "number" ||
          !Number.isInteger(lengthDescriptor.value) ||
          lengthDescriptor.value < 0 ||
          lengthDescriptor.value > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes ||
          (lengthDescriptor.value > 0 && work.depth >= EVENT_PAYLOAD_SAFETY_LIMITS.maxDepth)
        ) {
          return undefined;
        }
        const length = lengthDescriptor.value;
        const ownKeys = Reflect.ownKeys(source);
        if (
          ownKeys.length !== length + 1 ||
          ownKeys.some((key) => typeof key === "symbol") ||
          !ownKeys.includes("length")
        ) {
          return undefined;
        }

        discoveredNodes += length;
        const destination: JsonValue[] = new Array<JsonValue>(length);
        work.assign(destination);
        for (let index = length - 1; index >= 0; index -= 1) {
          const element = enumerableDataValue(source, String(index));
          if (!element.valid) return undefined;
          pending.push({
            kind: "visit",
            source: element.value,
            depth: work.depth + 1,
            assign(value) {
              destination[index] = value;
            },
          });
        }
        continue;
      }

      if (!hasJsonObjectPrototype(source)) return undefined;
      const ownKeys = Reflect.ownKeys(source);
      if (
        ownKeys.length > EVENT_PAYLOAD_SAFETY_LIMITS.maxJsonNodes - discoveredNodes ||
        (ownKeys.length > 0 && work.depth >= EVENT_PAYLOAD_SAFETY_LIMITS.maxDepth) ||
        ownKeys.some((key) => typeof key === "symbol")
      ) {
        return undefined;
      }
      const keys = (ownKeys as string[]).sort(compareText);
      discoveredNodes += keys.length;
      const destination = Object.create(null) as Record<string, JsonValue>;
      work.assign(destination);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index] as string;
        stringCodeUnits += key.length;
        if (stringCodeUnits > EVENT_PAYLOAD_SAFETY_LIMITS.maxStringCodeUnits) return undefined;
        const property = enumerableDataValue(source, key);
        if (!property.valid) return undefined;
        pending.push({
          kind: "visit",
          source: property.value,
          depth: work.depth + 1,
          assign(value) {
            destination[key] = value;
          },
        });
      }
    }

    if (root.value === undefined) return undefined;
    const snapshot = JSON.parse(canonicalizeJson(root.value)) as JsonValue;
    return freezeJsonSnapshot(snapshot);
  } catch {
    return undefined;
  }
}

function eventReferenceSnapshot(input: unknown): Readonly<DesenEventContractReference> | undefined {
  const snapshot = inertBoundedJsonSnapshot(input);
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot))
    return undefined;
  const record = snapshot as JsonObject;
  if (
    !Object.hasOwn(record, "capabilityKind") ||
    !Object.hasOwn(record, "capabilityId") ||
    !Object.hasOwn(record, "eventName") ||
    (record.capabilityKind !== "component" && record.capabilityKind !== "behavior") ||
    typeof record.capabilityId !== "string" ||
    typeof record.eventName !== "string"
  ) {
    return undefined;
  }
  return Object.freeze({
    capabilityKind: record.capabilityKind,
    capabilityId: record.capabilityId,
    eventName: record.eventName,
  });
}

function unknownEventDiagnostic(
  reference: Readonly<DesenEventContractReference> | undefined,
): DesenSemanticDiagnostic {
  return createCoreDiagnostic({
    code: "UNKNOWN_EVENT",
    message: "The requested component or behavior event contract is not declared.",
    pointer: ROOT_POINTER,
    ...(reference === undefined ? {} : { context: { capabilityId: reference.capabilityId } }),
  });
}

function eventPayloadDiagnostic(
  pointer: JsonPointer,
  reference: Readonly<DesenEventContractReference>,
): DesenSemanticDiagnostic {
  return createCoreDiagnostic({
    code: "EVENT_PAYLOAD_INVALID",
    message: "The resolved adapter event payload does not satisfy its declared schema.",
    pointer,
    context: { capabilityId: reference.capabilityId },
  });
}

/**
 * Validates one resolved adapter event payload against a prepared component or behavior contract.
 *
 * @remarks The payload is copied through RFC 8785-compatible JSON, bounded, and recursively frozen
 * before schema evaluation. `$ref`, `$token`, and `$format` property names are ordinary resolved
 * payload data here, never DESEN binding instructions. The function does not execute adapters,
 * retain caller objects, fetch schemas, or create a runtime event scope.
 */
export function validateDesenEventPayload(
  payload: unknown,
  event: DesenEventContractReference,
  catalogSet: DesenValidatedInteractionCatalogSet,
): DesenEventPayloadValidationResult {
  const reference = eventReferenceSnapshot(event);
  if (reference === undefined) return payloadFailure([unknownEventDiagnostic(undefined)]);

  const metadata = INTERACTION_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) {
    return payloadFailure([
      invalidInteractionContractDiagnostic(ROOT_POINTER, {
        capabilityId: reference.capabilityId,
      }),
    ]);
  }

  const payloadSchema = getPreparedDesenEventPayloadSchema(
    catalogSet,
    reference.capabilityKind,
    reference.capabilityId,
    reference.eventName,
  );
  if (payloadSchema === undefined) return payloadFailure([unknownEventDiagnostic(reference)]);

  const snapshot = inertBoundedJsonSnapshot(payload);
  if (snapshot === undefined) {
    return payloadFailure([eventPayloadDiagnostic(ROOT_POINTER, reference)]);
  }

  let result: ReturnType<typeof applySchemaContract>;
  try {
    result = applySchemaContract(payloadSchema, snapshot, "complete", "resolved-value");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return payloadFailure([eventPayloadDiagnostic(ROOT_POINTER, reference)]);
  }
  if (result.issues.length === 0) return payloadSuccess(snapshot);
  return payloadFailure(
    result.issues.map((issue) => eventPayloadDiagnostic(issue.pointer, reference)),
  );
}
