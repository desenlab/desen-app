import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  parseJsonPointer,
} from "@desen/protocol";

import { applySchemaContract, validateSchemaContractGraph } from "./schema-instance-validation.js";
import {
  invalidComponentContractDiagnostic,
  normalizeSemanticDiagnostics,
} from "./semantic-diagnostics.js";
import { validateDesenCatalogSet, validateDesenSemanticFoundation } from "./semantic-validation.js";
import { compareText, ROOT_POINTER } from "./validation-internals.js";

import type {
  DesenBundle,
  DesenCatalog,
  DesenDiagnosticContext,
  DesenSource,
  JsonPointer,
} from "@desen/protocol";
import type { DesenSemanticDiagnostic } from "./semantic-diagnostics.js";
import type {
  DesenValidatedCatalogSet,
  DesenSemanticValidationResult,
} from "./semantic-validation.js";
import type { DesenDocumentForTarget, ImmutableJson } from "./structural-validation.js";
import type { JsonObject } from "./validation-internals.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_OBLIGATIONS = Object.freeze([]) as readonly [];
const EMPTY_OBJECT = Object.freeze({}) as JsonObject;

/** A Source or Bundle root accepted by component-contract validation. */
export type DesenComponentContractTarget = "bundle" | "source";

/** The unresolved component-contract channel that must be checked after value resolution. */
export type DesenComponentContractObligationKind = "component-prop" | "style-part-property";

/**
 * A deterministic requirement to validate a dynamic value after its DESEN binding is resolved.
 *
 * @remarks M02-T08 never guesses values for `$ref`, `$token`, or `$format`. The pointer identifies
 * the dynamic ValueSpec in the immutable Source or Bundle, while context identifies its component
 * owner. A later publisher or runtime must discharge the obligation before passing resolved data
 * to executable capability code.
 */
export interface DesenComponentContractObligation {
  /** Contract channel that contains the unresolved dynamic value. */
  readonly kind: DesenComponentContractObligationKind;
  /** Exact dynamic ValueSpec location in the Source or Bundle. */
  readonly pointer: JsonPointer;
  /** Stable document, surface, node, and component identities. */
  readonly context: Readonly<DesenDiagnosticContext>;
}

/** Successful cumulative T06→T07→T08 component-contract validation. */
export interface DesenComponentContractValidationSuccess<
  Target extends DesenComponentContractTarget,
> {
  /** Confirms that no structurally, semantically, or statically provable contract error exists. */
  readonly valid: true;
  /** Identifies the validated protocol root. */
  readonly target: Target;
  /** Independent recursively immutable document snapshot created by the T06 boundary. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
  /** Dynamic values that still require validation after resolution. */
  readonly obligations: readonly DesenComponentContractObligation[];
}

/** Failed cumulative component-contract validation with no trusted document value. */
export interface DesenComponentContractValidationFailure<
  Target extends DesenComponentContractTarget,
> {
  /** Confirms that one or more cumulative validation stages failed. */
  readonly valid: false;
  /** Identifies the attempted protocol root. */
  readonly target: Target;
  /** Sorted, de-duplicated T06, T07, or T08 diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  /** Dynamic obligations found independently of the reported static contract failures. */
  readonly obligations: readonly DesenComponentContractObligation[];
}

/** Result of cumulative Source or Bundle component-contract validation. */
export type DesenComponentContractValidationResult<Target extends DesenComponentContractTarget> =
  DesenComponentContractValidationSuccess<Target> | DesenComponentContractValidationFailure<Target>;

declare const validatedComponentCatalogSetBrand: unique symbol;

/**
 * A T07 trusted catalog set whose component contracts also passed the M02-T08 preparation stage.
 *
 * @remarks The nominal brand is backed by a private runtime `WeakMap`. A cast cannot create the
 * component metadata required by document validation.
 */
export type DesenValidatedComponentCatalogSet = DesenValidatedCatalogSet & {
  readonly [validatedComponentCatalogSetBrand]: "DesenValidatedComponentCatalogSet";
};

/** Successful preparation of component-contract metadata for a trusted catalog set. */
export interface DesenComponentCatalogSetValidationSuccess {
  /** Confirms the T07 set and every component slot contract passed preparation. */
  readonly valid: true;
  /** Distinguishes this stage from the lower-level T07 catalog-set result. */
  readonly target: "component-catalog-set";
  /** The same immutable catalogs, now carrying private T08 trust metadata. */
  readonly value: DesenValidatedComponentCatalogSet;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
}

/** Failed component catalog-set preparation with no T08-trusted value. */
export interface DesenComponentCatalogSetValidationFailure {
  /** Confirms the set did not pass the cumulative catalog boundary. */
  readonly valid: false;
  /** Distinguishes this stage from validation of a protocol document root. */
  readonly target: "component-catalog-set";
  /** Sorted, de-duplicated T06, T07, or T08 catalog diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of preparing a catalog set for M02-T08 component-contract validation. */
export type DesenComponentCatalogSetValidationResult =
  DesenComponentCatalogSetValidationSuccess | DesenComponentCatalogSetValidationFailure;

type SourceSnapshot = ImmutableJson<DesenSource>;
type BundleSnapshot = ImmutableJson<DesenBundle>;
type DocumentSnapshot = SourceSnapshot | BundleSnapshot;
type SurfaceSnapshot = DocumentSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type ComponentSnapshot = CatalogSnapshot["components"][string];
type SlotSnapshot = NonNullable<ComponentSnapshot["slots"]>[string];
type StyleSnapshot = NonNullable<NodeSnapshot["style"]>;

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

interface ComponentCatalogMetadata {
  readonly catalogs: readonly CatalogIdentity[];
  readonly components: ReadonlyMap<string, ComponentResolution>;
  readonly byIdVersion: ReadonlyMap<string, readonly number[]>;
  readonly byExactTuple: ReadonlyMap<string, readonly number[]>;
}

interface NodeWork {
  readonly node: NodeSnapshot;
  readonly pointer: JsonPointer;
  readonly documentId: string;
  readonly surfaceId: string;
}

const COMPONENT_CATALOG_METADATA = new WeakMap<object, ComponentCatalogMetadata>();

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

function immutableContext(
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

function normalizeObligations(
  obligations: readonly DesenComponentContractObligation[],
): readonly DesenComponentContractObligation[] {
  const ordered = [...obligations].sort((left, right) => {
    const pointerOrder = compareText(left.pointer, right.pointer);
    if (pointerOrder !== 0) return pointerOrder;
    const kindOrder = compareText(left.kind, right.kind);
    if (kindOrder !== 0) return kindOrder;
    const leftContext = left.context;
    const rightContext = right.context;
    for (const [leftValue, rightValue] of [
      [leftContext.documentId, rightContext.documentId],
      [leftContext.surfaceId, rightContext.surfaceId],
      [leftContext.subject?.id, rightContext.subject?.id],
      [leftContext.capabilityId, rightContext.capabilityId],
    ] as const) {
      const order = compareText(leftValue ?? "", rightValue ?? "");
      if (order !== 0) return order;
    }
    return 0;
  });

  const unique: DesenComponentContractObligation[] = [];
  let previousKey: string | undefined;
  for (const obligation of ordered) {
    const key = JSON.stringify([
      obligation.pointer,
      obligation.kind,
      obligation.context.documentId,
      obligation.context.surfaceId,
      obligation.context.subject?.id,
      obligation.context.capabilityId,
    ]);
    if (key !== previousKey) unique.push(obligation);
    previousKey = key;
  }
  return Object.freeze(unique);
}

function componentCatalogSetSuccess(
  value: DesenValidatedComponentCatalogSet,
): DesenComponentCatalogSetValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "component-catalog-set",
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function componentCatalogSetFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenComponentCatalogSetValidationFailure {
  return Object.freeze({
    valid: false,
    target: "component-catalog-set",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function contractSuccess<Target extends DesenComponentContractTarget>(
  target: Target,
  value: ImmutableJson<DesenDocumentForTarget<Target>>,
  obligations: readonly DesenComponentContractObligation[],
): DesenComponentContractValidationSuccess<Target> {
  return Object.freeze({
    valid: true,
    target,
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
    obligations: normalizeObligations(obligations),
  });
}

function contractFailure<Target extends DesenComponentContractTarget>(
  target: Target,
  diagnostics: readonly DesenSemanticDiagnostic[],
  obligations: readonly DesenComponentContractObligation[] = EMPTY_OBLIGATIONS,
): DesenComponentContractValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

function buildComponentMetadata(catalogs: DesenValidatedCatalogSet): ComponentCatalogMetadata {
  const identities: CatalogIdentity[] = [];
  const components = new Map<string, ComponentResolution>();
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
  });

  return Object.freeze({
    catalogs: Object.freeze(identities),
    components,
    byIdVersion: freezeIndex(byIdVersion),
    byExactTuple: freezeIndex(byExactTuple),
  });
}

function effectiveMinimum(slot: SlotSnapshot): number {
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
      invalidComponentContractDiagnostic(appendRelativePointer(basePointer, graphIssue.pointer), {
        capabilityId,
      }),
    );
  }
}

function rawObject(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function componentCatalogShapeDiagnostics(input: unknown): readonly DesenSemanticDiagnostic[] {
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
      diagnostics.push(invalidComponentContractDiagnostic(pointer, { capabilityId }));
    }
  };

  snapshot.forEach((catalogValue, catalogIndex) => {
    const catalog = rawObject(catalogValue);
    const components = rawObject(
      catalog !== undefined && Object.hasOwn(catalog, "components")
        ? catalog.components
        : undefined,
    );
    if (components === undefined) return;
    for (const componentId of sortedKeys(components)) {
      const component = rawObject(components[componentId]);
      if (component === undefined) continue;
      const componentPointer = appendPath(ROOT_POINTER, catalogIndex, "components", componentId);
      inspectSchema(
        component.propsSchema,
        appendJsonPointer(componentPointer, "propsSchema"),
        componentId,
      );
      const styleParts = rawObject(
        Object.hasOwn(component, "styleParts") ? component.styleParts : undefined,
      );
      if (styleParts === undefined) continue;
      for (const partName of sortedKeys(styleParts)) {
        const part = rawObject(styleParts[partName]);
        if (part !== undefined) {
          inspectSchema(
            part.propertiesSchema,
            appendPath(componentPointer, "styleParts", partName, "propertiesSchema"),
            componentId,
          );
        }
      }
    }
  });

  return normalizeSemanticDiagnostics(diagnostics);
}

function componentCatalogDiagnostics(
  catalogs: DesenValidatedCatalogSet,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  catalogs.forEach((catalog, catalogIndex) => {
    for (const componentId of sortedKeys(catalog.components)) {
      const component = catalog.components[componentId];
      if (component === undefined) continue;
      const componentPointer = appendPath(ROOT_POINTER, catalogIndex, "components", componentId);
      addSchemaGraphDiagnostics(
        component.propsSchema,
        appendJsonPointer(componentPointer, "propsSchema"),
        componentId,
        diagnostics,
      );
      const styleParts = Object.hasOwn(component, "styleParts") ? component.styleParts : undefined;
      if (styleParts !== undefined) {
        for (const partName of sortedKeys(styleParts)) {
          const part = styleParts[partName];
          if (part !== undefined) {
            addSchemaGraphDiagnostics(
              part.propertiesSchema,
              appendPath(componentPointer, "styleParts", partName, "propertiesSchema"),
              componentId,
              diagnostics,
            );
          }
        }
      }
      const slots = Object.hasOwn(component, "slots") ? component.slots : undefined;
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
              invalidComponentContractDiagnostic(appendPath(componentPointer, "slots", slotName), {
                capabilityId: componentId,
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
 * Prepares unknown catalogs for cumulative M02-T08 component-contract validation.
 *
 * @remarks The input first passes the exact T07 trusted catalog-set boundary. The T08 stage then
 * rejects component slot contracts whose maximum is below their effective minimum, rejects
 * unusable local schema graphs and patterns outside the bounded host-safe profile, and builds
 * private, garbage-collectable component/category indexes. It does not compile schemas, execute
 * generated code, fetch references, mutate catalogs, or validate behavior contracts.
 */
export function validateDesenComponentCatalogSet(
  input: unknown,
): DesenComponentCatalogSetValidationResult {
  if (typeof input === "object" && input !== null) {
    const existing = COMPONENT_CATALOG_METADATA.get(input);
    if (existing !== undefined) {
      return componentCatalogSetSuccess(input as DesenValidatedComponentCatalogSet);
    }
  }

  const shapeDiagnostics = componentCatalogShapeDiagnostics(input);
  if (shapeDiagnostics.length > 0) return componentCatalogSetFailure(shapeDiagnostics);

  let foundation: ReturnType<typeof validateDesenCatalogSet>;
  try {
    foundation = validateDesenCatalogSet(input);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return componentCatalogSetFailure([invalidComponentContractDiagnostic(ROOT_POINTER)]);
  }
  if (!foundation.valid) return componentCatalogSetFailure(foundation.diagnostics);
  const diagnostics = componentCatalogDiagnostics(foundation.value);
  if (diagnostics.length > 0) return componentCatalogSetFailure(diagnostics);

  const value = foundation.value as DesenValidatedComponentCatalogSet;
  COMPONENT_CATALOG_METADATA.set(value, buildComponentMetadata(foundation.value));
  return componentCatalogSetSuccess(value);
}

function selectedComponents(
  target: DesenComponentContractTarget,
  document: DocumentSnapshot,
  metadata: ComponentCatalogMetadata,
): ReadonlyMap<string, ComponentResolution> {
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

  return new Map(
    [...metadata.components].filter(([, resolution]) =>
      selectedCatalogs.has(resolution.catalogIndex),
    ),
  );
}

function addContractDiagnostic(
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
          ? "A component property, visual state, or style part is not declared by its capability."
          : "A statically known component contract value does not satisfy its declared schema.",
      pointer,
      context,
    }),
  );
}

function applyValueSchema(
  schema: JsonObject,
  value: JsonObject,
  mode: "complete" | "patch",
  basePointer: JsonPointer,
  obligationKind: DesenComponentContractObligationKind,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenComponentContractObligation[],
): void {
  const result = applySchemaContract(schema, value, mode);
  for (const issue of result.issues) {
    addContractDiagnostic(
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

function validateStyle(
  style: StyleSnapshot | undefined,
  mode: "complete" | "patch",
  stylePointer: JsonPointer,
  component: ComponentSnapshot,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenComponentContractObligation[],
): void {
  if (style === undefined) return;
  const visualStates = new Set(
    Object.hasOwn(component, "visualStates") ? (component.visualStates ?? []) : [],
  );
  const styleParts = Object.hasOwn(component, "styleParts") ? (component.styleParts ?? {}) : {};

  for (const stateName of sortedKeys(style)) {
    const statePointer = appendJsonPointer(stylePointer, stateName);
    if (stateName !== "base" && !visualStates.has(stateName)) {
      addContractDiagnostic("UNKNOWN_PROP", statePointer, context, diagnostics);
    }
    const parts = style[stateName];
    if (parts === undefined) continue;
    for (const partName of sortedKeys(parts)) {
      const partPointer = appendJsonPointer(statePointer, partName);
      const partContract = Object.hasOwn(styleParts, partName) ? styleParts[partName] : undefined;
      if (partContract === undefined) {
        addContractDiagnostic("UNKNOWN_PROP", partPointer, context, diagnostics);
        continue;
      }
      const values = parts[partName];
      if (values === undefined) continue;
      applyValueSchema(
        partContract.propertiesSchema as JsonObject,
        values as JsonObject,
        mode,
        partPointer,
        "style-part-property",
        context,
        diagnostics,
        obligations,
      );
    }
  }
}

function pushBehaviorSlotChildren(
  stack: NodeWork[],
  behaviors: readonly BehaviorSnapshot[] | undefined,
  nodePointer: JsonPointer,
  documentId: string,
  surfaceId: string,
): void {
  if (behaviors === undefined) return;
  for (let behaviorIndex = behaviors.length - 1; behaviorIndex >= 0; behaviorIndex -= 1) {
    const behavior = behaviors[behaviorIndex] as BehaviorSnapshot;
    if (!Object.hasOwn(behavior, "slots") || behavior.slots === undefined) continue;
    const behaviorPointer = appendPath(nodePointer, "behaviors", behaviorIndex);
    const slotNames = sortedKeys(behavior.slots);
    for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
      const slotName = slotNames[slotIndex] as string;
      const children = behavior.slots[slotName] ?? [];
      for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
        stack.push({
          node: children[childIndex] as NodeSnapshot,
          pointer: appendPath(behaviorPointer, "slots", slotName, childIndex),
          documentId,
          surfaceId,
        });
      }
    }
  }
}

function validateSlots(
  stack: NodeWork[],
  work: NodeWork,
  component: ComponentSnapshot,
  components: ReadonlyMap<string, ComponentResolution>,
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
): void {
  const contracts = Object.hasOwn(component, "slots") ? (component.slots ?? {}) : {};
  const slots = Object.hasOwn(work.node, "slots") ? (work.node.slots ?? {}) : {};

  for (const slotName of sortedKeys(contracts)) {
    const contract = Object.hasOwn(contracts, slotName) ? contracts[slotName] : undefined;
    if (
      contract !== undefined &&
      Object.hasOwn(contract, "required") &&
      contract.required === true &&
      !Object.hasOwn(slots, slotName)
    ) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "SLOT_CARDINALITY",
          message: "A required component slot is missing.",
          pointer: appendPath(work.pointer, "slots", slotName),
          context,
        }),
      );
    }
  }

  const slotNames = sortedKeys(slots);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = slots[slotName] ?? [];
    const slotPointer = appendPath(work.pointer, "slots", slotName);
    const contract = Object.hasOwn(contracts, slotName) ? contracts[slotName] : undefined;

    if (contract === undefined) {
      diagnostics.push(
        createCoreDiagnostic({
          code: "UNKNOWN_SLOT",
          message: "A component node uses a slot that its capability does not declare.",
          pointer: slotPointer,
          context,
        }),
      );
    } else {
      const minimum = effectiveMinimum(contract);
      if (
        children.length < minimum ||
        (Object.hasOwn(contract, "maxItems") &&
          contract.maxItems !== undefined &&
          children.length > contract.maxItems)
      ) {
        diagnostics.push(
          createCoreDiagnostic({
            code: "SLOT_CARDINALITY",
            message: "A component slot contains a disallowed number of child nodes.",
            pointer: slotPointer,
            context,
          }),
        );
      }

      const constrainsChildren =
        Object.hasOwn(contract, "accepts") || Object.hasOwn(contract, "acceptsCategories");
      if (constrainsChildren) {
        const acceptedIds = new Set(
          Object.hasOwn(contract, "accepts") ? (contract.accepts ?? []) : [],
        );
        const acceptedCategories = new Set(
          Object.hasOwn(contract, "acceptsCategories") ? (contract.acceptsCategories ?? []) : [],
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
                  "A child component does not match its slot's accepted identity or category.",
                pointer: appendPath(slotPointer, childIndex, "use"),
                context,
              }),
            );
          }
        });
      }
    }

    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({
        node: children[childIndex] as NodeSnapshot,
        pointer: appendJsonPointer(slotPointer, childIndex),
        documentId: work.documentId,
        surfaceId: work.surfaceId,
      });
    }
  }
}

function validateNode(
  stack: NodeWork[],
  work: NodeWork,
  components: ReadonlyMap<string, ComponentResolution>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenComponentContractObligation[],
): void {
  const resolution = components.get(work.node.use);
  if (resolution === undefined) return;
  const component = resolution.contract;
  const context = immutableContext(work.documentId, work.surfaceId, work.node);

  applyValueSchema(
    component.propsSchema as JsonObject,
    (Object.hasOwn(work.node, "props")
      ? (work.node.props ?? EMPTY_OBJECT)
      : EMPTY_OBJECT) as JsonObject,
    "complete",
    appendPath(work.pointer, "props"),
    "component-prop",
    context,
    diagnostics,
    obligations,
  );
  validateStyle(
    Object.hasOwn(work.node, "style") ? work.node.style : undefined,
    "complete",
    appendPath(work.pointer, "style"),
    component,
    context,
    diagnostics,
    obligations,
  );

  const variants = Object.hasOwn(work.node, "variants") ? (work.node.variants ?? []) : [];
  variants.forEach((variant, variantIndex) => {
    const variantPointer = appendPath(work.pointer, "variants", variantIndex);
    if (Object.hasOwn(variant, "props") && variant.props !== undefined) {
      applyValueSchema(
        component.propsSchema as JsonObject,
        variant.props as JsonObject,
        "patch",
        appendPath(variantPointer, "props"),
        "component-prop",
        context,
        diagnostics,
        obligations,
      );
    }
    validateStyle(
      Object.hasOwn(variant, "style") ? variant.style : undefined,
      "patch",
      appendPath(variantPointer, "style"),
      component,
      context,
      diagnostics,
      obligations,
    );
  });

  validateSlots(stack, work, component, components, context, diagnostics);
  pushBehaviorSlotChildren(
    stack,
    Object.hasOwn(work.node, "behaviors") ? work.node.behaviors : undefined,
    work.pointer,
    work.documentId,
    work.surfaceId,
  );
}

function componentContractDiagnostics(
  document: DocumentSnapshot,
  components: ReadonlyMap<string, ComponentResolution>,
): Readonly<{
  diagnostics: readonly DesenSemanticDiagnostic[];
  obligations: readonly DesenComponentContractObligation[];
}> {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const obligations: DesenComponentContractObligation[] = [];
  const stack: NodeWork[] = [];

  const surfaceIds = sortedKeys(document.surfaces);
  for (let surfaceIndex = surfaceIds.length - 1; surfaceIndex >= 0; surfaceIndex -= 1) {
    const surfaceId = surfaceIds[surfaceIndex] as string;
    const surface = document.surfaces[surfaceId];
    if (surface === undefined) continue;
    stack.push({
      node: surface.root,
      pointer: appendPath(ROOT_POINTER, "surfaces", surfaceId, "root"),
      documentId: document.id,
      surfaceId,
    });
  }

  while (stack.length > 0) {
    validateNode(stack, stack.pop() as NodeWork, components, diagnostics, obligations);
  }

  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

/**
 * Applies cumulative structural, semantic-foundation, and component-contract validation.
 *
 * @remarks The exact value returned by {@link validateDesenComponentCatalogSet} is required. T06
 * structural or T07 semantic failure short-circuits this stage. T08 validates only component-node
 * base props, variant prop patches, slots, visual states, style parts, and statically known style
 * values. It traverses component children inside behavior slots but deliberately leaves behavior
 * contracts, events, commands, bindings, predicates, resources, operations, and actions to their
 * assigned later stages. Dynamic ValueSpecs become explicit obligations rather than guessed data.
 */
export function validateDesenComponentContracts<Target extends DesenComponentContractTarget>(
  target: Target,
  input: unknown,
  catalogSet: DesenValidatedComponentCatalogSet,
): DesenComponentContractValidationResult<Target> {
  const foundation = validateDesenSemanticFoundation(
    target,
    input,
    catalogSet,
  ) as DesenSemanticValidationResult<Target>;
  if (!foundation.valid) return contractFailure(target, foundation.diagnostics);

  const metadata = COMPONENT_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) {
    const document = foundation.value as SourceSnapshot | BundleSnapshot;
    const pointer =
      target === "source"
        ? appendPath(ROOT_POINTER, "catalogs")
        : appendPath(ROOT_POINTER, "requires", "catalogs");
    return contractFailure(target, [
      invalidComponentContractDiagnostic(pointer, { documentId: document.id }),
    ]);
  }

  const document = foundation.value as SourceSnapshot | BundleSnapshot;
  const components = selectedComponents(target, document, metadata);
  const contracts = componentContractDiagnostics(document, components);
  return contracts.diagnostics.length === 0
    ? contractSuccess(target, foundation.value, contracts.obligations)
    : contractFailure(target, contracts.diagnostics, contracts.obligations);
}

/** Validates a Source through T08 against one prepared component catalog set. */
export function validateDesenSourceComponentContracts(
  input: unknown,
  catalogSet: DesenValidatedComponentCatalogSet,
): DesenComponentContractValidationResult<"source"> {
  return validateDesenComponentContracts("source", input, catalogSet);
}

/** Validates a Bundle through T08 against one prepared component catalog set. */
export function validateDesenBundleComponentContracts(
  input: unknown,
  catalogSet: DesenValidatedComponentCatalogSet,
): DesenComponentContractValidationResult<"bundle"> {
  return validateDesenComponentContracts("bundle", input, catalogSet);
}
