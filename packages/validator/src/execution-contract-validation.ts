import {
  appendJsonPointer,
  canonicalizeJson,
  createCoreDiagnostic,
  parseJsonPointer,
} from "@desen/protocol";

import {
  validateDesenBindingContracts,
  validateDesenPreparedBindingSnapshot,
} from "./binding-contract-validation.js";
import {
  EVENT_PAYLOAD_SAFETY_LIMITS,
  snapshotResolvedJsonValue,
  validateDesenInteractionCatalogSet,
} from "./interaction-contract-validation.js";
import {
  applySchemaContract,
  inspectSchemaContractPath,
  validateSchemaContractGraph,
} from "./schema-instance-validation.js";
import {
  invalidExecutionContractDiagnostic,
  normalizeSemanticDiagnostics,
} from "./semantic-diagnostics.js";
import { compareText, isJsonObject, ROOT_POINTER } from "./validation-internals.js";

import type {
  CoreDiagnosticCode,
  DesenBundle,
  DesenCatalog,
  DesenDiagnosticContext,
  DesenSource,
  JsonPointer,
} from "@desen/protocol";
import type {
  DesenBindingContractObligation,
  DesenBindingContractObligationKind,
  DesenBindingContractTarget,
  DesenBindingExternalReferenceContract,
  DesenBindingExternalReferenceResolver,
} from "./binding-contract-validation.js";
import type {
  DesenResolvedJsonValue,
  DesenValidatedInteractionCatalogSet,
} from "./interaction-contract-validation.js";
import type { DesenSemanticDiagnostic } from "./semantic-diagnostics.js";
import type { DesenDocumentForTarget, ImmutableJson } from "./structural-validation.js";
import type { JsonObject, JsonValue } from "./validation-internals.js";

export { INVALID_EXECUTION_CONTRACT_CODE } from "./semantic-diagnostics.js";

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const EMPTY_OBLIGATIONS = Object.freeze([]) as readonly [];
const EMPTY_OBJECT = Object.freeze({}) as JsonObject;

/** A Source or Bundle root accepted by cumulative execution-contract validation. */
export type DesenExecutionContractTarget = DesenBindingContractTarget;

/** A resolved capability value channel enforced by the detached execution-value boundary. */
export type DesenExecutionValueContractKind =
  | "component-command-input"
  | "operation-input"
  | "operation-output"
  | "resource-input"
  | "resource-output";

/** Selects one exact prepared capability schema without retaining adapter or caller state. */
export type DesenExecutionValueContractReference =
  | Readonly<{
      readonly kind: "component-command-input";
      readonly capabilityId: string;
      readonly commandName: string;
    }>
  | Readonly<{
      readonly kind: "operation-input" | "operation-output" | "resource-input" | "resource-output";
      readonly capabilityId: string;
    }>;

/** Dynamic execution channel that must be checked after ValueSpec resolution or state mutation. */
export type DesenExecutionContractObligationKind =
  | DesenBindingContractObligationKind
  | "component-command-input"
  | "operation-input"
  | "resource-input"
  | "state-write";

/** One deterministic execution contract that remains unresolved after static validation. */
export interface DesenExecutionContractObligation {
  /** Contract channel requiring a later resolved-value or post-write check. */
  readonly kind: DesenExecutionContractObligationKind;
  /** Exact document location of the dynamic value or state target. */
  readonly pointer: JsonPointer;
  /** Stable document, surface, subject, and capability identities. */
  readonly context: Readonly<DesenDiagnosticContext>;
}

/** Successful cumulative T06→T11 Source or Bundle execution-contract validation. */
export interface DesenExecutionContractValidationSuccess<
  Target extends DesenExecutionContractTarget,
> {
  /** Confirms that every cumulative and statically decidable execution check passed. */
  readonly valid: true;
  /** Identifies the validated protocol root. */
  readonly target: Target;
  /** Independent recursively immutable document snapshot created by the T06 boundary. */
  readonly value: ImmutableJson<DesenDocumentForTarget<Target>>;
  /** Always empty on success. */
  readonly diagnostics: readonly [];
  /** Sorted unresolved component, operation, resource, and state channels. */
  readonly obligations: readonly DesenExecutionContractObligation[];
}

/** Failed cumulative execution validation with no trusted document value. */
export interface DesenExecutionContractValidationFailure<
  Target extends DesenExecutionContractTarget,
> {
  /** Confirms that one or more cumulative stages failed. */
  readonly valid: false;
  /** Identifies the attempted protocol root. */
  readonly target: Target;
  /** Sorted and de-duplicated T06 through T11 diagnostics. */
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
  /** Independently discovered dynamic obligations retained alongside static failures. */
  readonly obligations: readonly DesenExecutionContractObligation[];
}

/** Result of cumulative Source or Bundle execution-contract validation. */
export type DesenExecutionContractValidationResult<Target extends DesenExecutionContractTarget> =
  DesenExecutionContractValidationSuccess<Target> | DesenExecutionContractValidationFailure<Target>;

declare const validatedExecutionCatalogSetBrand: unique symbol;

/**
 * A T09 trusted catalog set whose operation and resource schemas passed T11 preparation.
 *
 * @remarks The nominal brand is backed by a private `WeakMap`; a cast cannot manufacture the
 * metadata required by document or detached resolved-value validation.
 */
export type DesenValidatedExecutionCatalogSet = DesenValidatedInteractionCatalogSet & {
  readonly [validatedExecutionCatalogSetBrand]: "DesenValidatedExecutionCatalogSet";
};

/** Successful preparation of execution contracts for one exact trusted catalog set. */
export interface DesenExecutionCatalogSetValidationSuccess {
  readonly valid: true;
  readonly target: "execution-catalog-set";
  readonly value: DesenValidatedExecutionCatalogSet;
  readonly diagnostics: readonly [];
}

/** Failed execution catalog preparation with no T11-trusted value. */
export interface DesenExecutionCatalogSetValidationFailure {
  readonly valid: false;
  readonly target: "execution-catalog-set";
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of preparing a catalog set for M02-T11 execution validation. */
export type DesenExecutionCatalogSetValidationResult =
  DesenExecutionCatalogSetValidationSuccess | DesenExecutionCatalogSetValidationFailure;

/** Successful validation of one detached resolved command, operation, or resource value. */
export interface DesenExecutionValueValidationSuccess {
  readonly valid: true;
  readonly target: "execution-value";
  readonly value: DesenResolvedJsonValue;
  readonly diagnostics: readonly [];
}

/** Failed detached execution-value validation with no trusted caller value. */
export interface DesenExecutionValueValidationFailure {
  readonly valid: false;
  readonly target: "execution-value";
  readonly diagnostics: readonly DesenSemanticDiagnostic[];
}

/** Result of validating a detached resolved execution value. */
export type DesenExecutionValueValidationResult =
  DesenExecutionValueValidationSuccess | DesenExecutionValueValidationFailure;

/** Deterministic inert-data limits shared with resolved component and behavior event payloads. */
export const EXECUTION_VALUE_SAFETY_LIMITS = EVENT_PAYLOAD_SAFETY_LIMITS;

type SourceSnapshot = ImmutableJson<DesenSource>;
type BundleSnapshot = ImmutableJson<DesenBundle>;
type DocumentSnapshot = SourceSnapshot | BundleSnapshot;
type CatalogSnapshot = ImmutableJson<DesenCatalog>;

interface CatalogIdentity {
  readonly index: number;
  readonly id: string;
  readonly version: string;
  readonly target: string;
}

interface CapabilityResolution {
  readonly catalogIndex: number;
  readonly contract: JsonObject;
}

interface ExecutionCatalogMetadata {
  readonly catalogs: readonly CatalogIdentity[];
  readonly components: ReadonlyMap<string, CapabilityResolution>;
  readonly operations: ReadonlyMap<string, CapabilityResolution>;
  readonly resources: ReadonlyMap<string, CapabilityResolution>;
  readonly byIdVersion: ReadonlyMap<string, readonly number[]>;
  readonly byExactTuple: ReadonlyMap<string, readonly number[]>;
}

interface SelectedExecutionContracts {
  readonly components: ReadonlyMap<string, CapabilityResolution>;
  readonly operations: ReadonlyMap<string, CapabilityResolution>;
  readonly resources: ReadonlyMap<string, CapabilityResolution>;
}

interface ResourceReferenceContract {
  readonly capabilityId: string;
  readonly contract: JsonObject;
}

interface OperationReferenceContract {
  readonly capabilityId: string;
  readonly contract: JsonObject;
}

interface SurfaceReferenceEnvironment {
  readonly resources: ReadonlyMap<string, ResourceReferenceContract>;
  readonly operations: ReadonlyMap<string, OperationReferenceContract>;
}

interface NodeWork {
  readonly node: JsonObject;
  readonly pointer: JsonPointer;
}

interface ActionWork {
  readonly action: JsonObject;
  readonly pointer: JsonPointer;
  readonly context: Readonly<DesenDiagnosticContext>;
}

interface ComponentTarget {
  readonly node: JsonObject;
  readonly resolution: CapabilityResolution;
}

interface SurfaceIndex {
  readonly actions: readonly ActionWork[];
  readonly components: ReadonlyMap<string, ComponentTarget>;
  readonly operations: ReadonlyMap<string, OperationReferenceContract>;
}

const EXECUTION_CATALOG_METADATA = new WeakMap<object, ExecutionCatalogMetadata>();

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

function compareDocumentPointers(left: JsonPointer, right: JsonPointer): number {
  const leftSegments = parseJsonPointer(left);
  const rightSegments = parseJsonPointer(right);
  const length = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = leftSegments[index] as string;
    const rightSegment = rightSegments[index] as string;
    if (leftSegment === rightSegment) continue;
    const leftIndex = /^(?:0|[1-9][0-9]*)$/.test(leftSegment) ? Number(leftSegment) : undefined;
    const rightIndex = /^(?:0|[1-9][0-9]*)$/.test(rightSegment) ? Number(rightSegment) : undefined;
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    return compareText(leftSegment, rightSegment);
  }
  return leftSegments.length - rightSegments.length;
}

function asObject(value: JsonValue | undefined): JsonObject | undefined {
  return value !== undefined && isJsonObject(value) ? value : undefined;
}

function asArray(value: JsonValue | undefined): readonly JsonValue[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function ownValue(object: JsonObject, field: string): JsonValue | undefined {
  return Object.hasOwn(object, field) ? object[field] : undefined;
}

function stringField(object: JsonObject, field: string): string | undefined {
  const value = ownValue(object, field);
  return typeof value === "string" ? value : undefined;
}

function identityKey(...parts: readonly string[]): string {
  return JSON.stringify(parts);
}

function addIndex(index: Map<string, number[]>, key: string, value: number): void {
  const existing = index.get(key);
  if (existing === undefined) index.set(key, [value]);
  else existing.push(value);
}

function freezeIndex(index: ReadonlyMap<string, number[]>): ReadonlyMap<string, readonly number[]> {
  return new Map([...index].map(([key, values]) => [key, Object.freeze([...values])] as const));
}

function immutableContext(
  context: Readonly<DesenDiagnosticContext>,
): Readonly<DesenDiagnosticContext> {
  const subject =
    context.subject === undefined
      ? undefined
      : Object.freeze({ kind: context.subject.kind, id: context.subject.id });
  return Object.freeze({
    ...(context.documentId === undefined ? {} : { documentId: context.documentId }),
    ...(context.surfaceId === undefined ? {} : { surfaceId: context.surfaceId }),
    ...(subject === undefined ? {} : { subject }),
    ...(context.capabilityId === undefined ? {} : { capabilityId: context.capabilityId }),
  });
}

function contextWithCapability(
  context: Readonly<DesenDiagnosticContext>,
  capabilityId: string,
): Readonly<DesenDiagnosticContext> {
  return immutableContext({ ...context, capabilityId });
}

function surfaceContext(documentId: string, surfaceId: string): Readonly<DesenDiagnosticContext> {
  return Object.freeze({ documentId, surfaceId });
}

function subjectContext(
  documentId: string,
  surfaceId: string,
  kind: "behavior" | "node",
  id: string,
  capabilityId: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    surfaceId,
    subject: Object.freeze({ kind, id }),
    capabilityId,
  });
}

function normalizeObligations(
  obligations: readonly (DesenBindingContractObligation | DesenExecutionContractObligation)[],
): readonly DesenExecutionContractObligation[] {
  const copied = obligations.map((obligation) =>
    Object.freeze({
      kind: obligation.kind as DesenExecutionContractObligationKind,
      pointer: obligation.pointer,
      context: immutableContext(obligation.context),
    }),
  );
  copied.sort((left, right) => {
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

  const unique: DesenExecutionContractObligation[] = [];
  let prior: string | undefined;
  for (const obligation of copied) {
    const key = JSON.stringify([
      obligation.pointer,
      obligation.kind,
      obligation.context.documentId,
      obligation.context.surfaceId,
      obligation.context.subject?.kind,
      obligation.context.subject?.id,
      obligation.context.capabilityId,
    ]);
    if (key !== prior) unique.push(obligation);
    prior = key;
  }
  return Object.freeze(unique);
}

function executionSuccess<Target extends DesenExecutionContractTarget>(
  target: Target,
  value: ImmutableJson<DesenDocumentForTarget<Target>>,
  obligations: readonly (DesenBindingContractObligation | DesenExecutionContractObligation)[],
): DesenExecutionContractValidationSuccess<Target> {
  return Object.freeze({
    valid: true,
    target,
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
    obligations: normalizeObligations(obligations),
  });
}

function executionFailure<Target extends DesenExecutionContractTarget>(
  target: Target,
  diagnostics: readonly DesenSemanticDiagnostic[],
  obligations: readonly (
    DesenBindingContractObligation | DesenExecutionContractObligation
  )[] = EMPTY_OBLIGATIONS,
): DesenExecutionContractValidationFailure<Target> {
  return Object.freeze({
    valid: false,
    target,
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

function catalogSuccess(
  value: DesenValidatedExecutionCatalogSet,
): DesenExecutionCatalogSetValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "execution-catalog-set",
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function catalogFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenExecutionCatalogSetValidationFailure {
  return Object.freeze({
    valid: false,
    target: "execution-catalog-set",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function executionValueSuccess(
  value: DesenResolvedJsonValue,
): DesenExecutionValueValidationSuccess {
  return Object.freeze({
    valid: true,
    target: "execution-value",
    value,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

function executionValueFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
): DesenExecutionValueValidationFailure {
  return Object.freeze({
    valid: false,
    target: "execution-value",
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
  });
}

function addExecutionCoreDiagnostic(
  diagnostics: DesenSemanticDiagnostic[],
  code: Extract<
    CoreDiagnosticCode,
    | "COMMAND_INPUT_INVALID"
    | "ENTRY_NOT_FOUND"
    | "OPERATION_INPUT_INVALID"
    | "OPERATION_OUTPUT_INVALID"
    | "REFERENCE_UNRESOLVED"
    | "RESOURCE_INPUT_INVALID"
    | "RESOURCE_OUTPUT_INVALID"
    | "STATE_WRITE_INVALID"
    | "UNKNOWN_CAPABILITY"
    | "UNKNOWN_COMMAND"
  >,
  pointer: JsonPointer,
  context?: Readonly<DesenDiagnosticContext>,
): void {
  const messages = {
    COMMAND_INPUT_INVALID: "A component command input does not satisfy its declared schema.",
    ENTRY_NOT_FOUND: "A navigation action targets a surface that is not in this document.",
    OPERATION_INPUT_INVALID: "An operation input does not satisfy its declared schema.",
    OPERATION_OUTPUT_INVALID: "An operation output does not satisfy its declared schema.",
    REFERENCE_UNRESOLVED: "A resource, operation, or action target is not declared in this scope.",
    RESOURCE_INPUT_INVALID: "A resource policy or input does not satisfy its declared contract.",
    RESOURCE_OUTPUT_INVALID: "A resource output does not satisfy its declared schema.",
    STATE_WRITE_INVALID: "A state action cannot produce a schema-compatible write at this path.",
    UNKNOWN_CAPABILITY: "The requested execution capability is not in the trusted catalog set.",
    UNKNOWN_COMMAND: "The requested component command or target is not declared.",
  } as const;
  diagnostics.push(
    createCoreDiagnostic({
      code,
      message: messages[code],
      pointer,
      ...(context === undefined ? {} : { context }),
    }),
  );
}

function rawObject(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function executionCatalogShapeDiagnostics(input: unknown): readonly DesenSemanticDiagnostic[] {
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(canonicalizeJson(input)) as unknown;
  } catch {
    return EMPTY_DIAGNOSTICS;
  }
  if (!Array.isArray(snapshot)) return EMPTY_DIAGNOSTICS;
  const diagnostics: DesenSemanticDiagnostic[] = [];

  snapshot.forEach((catalogValue, catalogIndex) => {
    const catalog = rawObject(catalogValue);
    if (catalog === undefined) return;
    for (const mapName of ["operations", "resources"] as const) {
      const capabilities = rawObject(
        Object.hasOwn(catalog, mapName) ? catalog[mapName] : undefined,
      );
      if (capabilities === undefined) continue;
      for (const capabilityId of sortedKeys(capabilities)) {
        const capability = rawObject(capabilities[capabilityId]);
        if (capability === undefined) continue;
        for (const schemaName of ["inputSchema", "outputSchema"] as const) {
          const schema = Object.hasOwn(capability, schemaName) ? capability[schemaName] : undefined;
          const issues = validateSchemaContractGraph(schema);
          for (const issue of issues) {
            if (issue.keyword !== "schemaGraphDepth" && issue.keyword !== "schemaGraphSize") {
              continue;
            }
            diagnostics.push(
              invalidExecutionContractDiagnostic(
                appendRelativePointer(
                  appendPath(ROOT_POINTER, catalogIndex, mapName, capabilityId, schemaName),
                  issue.pointer,
                ),
                { capabilityId },
              ),
            );
          }
        }
      }
    }
  });
  return normalizeSemanticDiagnostics(diagnostics);
}

function executionCatalogDiagnostics(
  catalogs: DesenValidatedInteractionCatalogSet,
): readonly DesenSemanticDiagnostic[] {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  (catalogs as readonly CatalogSnapshot[]).forEach((catalog, catalogIndex) => {
    for (const [mapName, capabilityMap] of [
      ["operations", catalog.operations],
      ["resources", catalog.resources],
    ] as const) {
      for (const capabilityId of sortedKeys(capabilityMap)) {
        const capability = capabilityMap[capabilityId];
        if (capability === undefined) continue;
        for (const schemaName of ["inputSchema", "outputSchema"] as const) {
          const schema = capability[schemaName];
          for (const issue of validateSchemaContractGraph(schema)) {
            diagnostics.push(
              invalidExecutionContractDiagnostic(
                appendRelativePointer(
                  appendPath(ROOT_POINTER, catalogIndex, mapName, capabilityId, schemaName),
                  issue.pointer,
                ),
                { capabilityId },
              ),
            );
          }
        }
      }
    }
  });
  return normalizeSemanticDiagnostics(diagnostics);
}

function buildExecutionMetadata(
  catalogs: DesenValidatedInteractionCatalogSet,
): ExecutionCatalogMetadata {
  const identities: CatalogIdentity[] = [];
  const components = new Map<string, CapabilityResolution>();
  const operations = new Map<string, CapabilityResolution>();
  const resources = new Map<string, CapabilityResolution>();
  const byIdVersion = new Map<string, number[]>();
  const byExactTuple = new Map<string, number[]>();

  (catalogs as readonly CatalogSnapshot[]).forEach((catalog, catalogIndex) => {
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
    for (const [destination, capabilityMap] of [
      [components, catalog.components],
      [operations, catalog.operations],
      [resources, catalog.resources],
    ] as const) {
      for (const capabilityId of sortedKeys(capabilityMap)) {
        const contract = capabilityMap[capabilityId];
        if (contract !== undefined) {
          destination.set(
            capabilityId,
            Object.freeze({
              catalogIndex,
              contract: contract as unknown as JsonObject,
            }),
          );
        }
      }
    }
  });
  return Object.freeze({
    catalogs: Object.freeze(identities),
    components,
    operations,
    resources,
    byIdVersion: freezeIndex(byIdVersion),
    byExactTuple: freezeIndex(byExactTuple),
  });
}

/**
 * Prepares unknown catalogs for cumulative M02-T11 execution-contract validation.
 *
 * @remarks The input first passes T06 through T09. T11 then admits operation and resource input
 * and output schemas through the same bounded, code-free local schema profile. It builds private
 * indexes but never compiles schemas, executes adapters, fetches references, or validates fixtures.
 */
export function validateDesenExecutionCatalogSet(
  input: unknown,
): DesenExecutionCatalogSetValidationResult {
  if (typeof input === "object" && input !== null && EXECUTION_CATALOG_METADATA.has(input)) {
    return catalogSuccess(input as DesenValidatedExecutionCatalogSet);
  }

  const shapeDiagnostics = executionCatalogShapeDiagnostics(input);
  if (shapeDiagnostics.length > 0) return catalogFailure(shapeDiagnostics);

  let interactions: ReturnType<typeof validateDesenInteractionCatalogSet>;
  try {
    interactions = validateDesenInteractionCatalogSet(input);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return catalogFailure([invalidExecutionContractDiagnostic(ROOT_POINTER)]);
  }
  if (!interactions.valid) return catalogFailure(interactions.diagnostics);

  const diagnostics = executionCatalogDiagnostics(interactions.value);
  if (diagnostics.length > 0) return catalogFailure(diagnostics);

  const value = interactions.value as DesenValidatedExecutionCatalogSet;
  EXECUTION_CATALOG_METADATA.set(value, buildExecutionMetadata(interactions.value));
  return catalogSuccess(value);
}

function selectedExecutionContracts(
  target: DesenExecutionContractTarget,
  document: DocumentSnapshot,
  metadata: ExecutionCatalogMetadata,
): SelectedExecutionContracts {
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

  const selected = <Value extends CapabilityResolution>(
    values: ReadonlyMap<string, Value>,
  ): ReadonlyMap<string, Value> =>
    new Map([...values].filter(([, resolution]) => selectedCatalogs.has(resolution.catalogIndex)));
  return Object.freeze({
    components: selected(metadata.components),
    operations: selected(metadata.operations),
    resources: selected(metadata.resources),
  });
}

function pushHandlerActions(
  handlers: JsonValue | undefined,
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
  pending: ActionWork[],
): void {
  const handlerMap = asObject(handlers);
  if (handlerMap === undefined) return;
  const eventNames = sortedKeys(handlerMap);
  for (let eventIndex = eventNames.length - 1; eventIndex >= 0; eventIndex -= 1) {
    const eventName = eventNames[eventIndex] as string;
    const actions = asArray(handlerMap[eventName]) ?? [];
    for (let actionIndex = actions.length - 1; actionIndex >= 0; actionIndex -= 1) {
      const action = asObject(actions[actionIndex]);
      if (action !== undefined) {
        pending.push({
          action,
          pointer: appendPath(pointer, eventName, actionIndex),
          context,
        });
      }
    }
  }
}

function pushNodeChildren(
  stack: NodeWork[],
  slots: JsonValue | undefined,
  pointer: JsonPointer,
): void {
  const slotMap = asObject(slots);
  if (slotMap === undefined) return;
  const slotNames = sortedKeys(slotMap);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex] as string;
    const children = asArray(slotMap[slotName]) ?? [];
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      const node = asObject(children[childIndex]);
      if (node !== undefined) {
        stack.push({ node, pointer: appendPath(pointer, slotName, childIndex) });
      }
    }
  }
}

function collectSurfaceActionsAndTargets(
  documentId: string,
  surfaceId: string,
  surface: JsonObject,
  selected: SelectedExecutionContracts,
  diagnostics: DesenSemanticDiagnostic[],
): SurfaceIndex {
  const root = asObject(ownValue(surface, "root"));
  const nodeStack: NodeWork[] =
    root === undefined
      ? []
      : [
          {
            node: root,
            pointer: appendPath(ROOT_POINTER, "surfaces", surfaceId, "root"),
          },
        ];
  const pendingActions: ActionWork[] = [];
  const actions: ActionWork[] = [];
  const components = new Map<string, ComponentTarget>();

  while (nodeStack.length > 0) {
    const work = nodeStack.pop() as NodeWork;
    const id = stringField(work.node, "id") as string;
    const capabilityId = stringField(work.node, "use") as string;
    const resolution = selected.components.get(capabilityId);
    if (resolution !== undefined) {
      components.set(id, Object.freeze({ node: work.node, resolution }));
    }
    const nodeContext = subjectContext(documentId, surfaceId, "node", id, capabilityId);
    pushHandlerActions(
      ownValue(work.node, "on"),
      appendJsonPointer(work.pointer, "on"),
      nodeContext,
      pendingActions,
    );
    pushNodeChildren(
      nodeStack,
      ownValue(work.node, "slots"),
      appendJsonPointer(work.pointer, "slots"),
    );

    const behaviors = asArray(ownValue(work.node, "behaviors")) ?? [];
    for (let behaviorIndex = behaviors.length - 1; behaviorIndex >= 0; behaviorIndex -= 1) {
      const behavior = asObject(behaviors[behaviorIndex]);
      if (behavior === undefined) continue;
      const behaviorPointer = appendPath(work.pointer, "behaviors", behaviorIndex);
      const behaviorId = stringField(behavior, "id") as string;
      const behaviorCapability = stringField(behavior, "use") as string;
      const context = subjectContext(
        documentId,
        surfaceId,
        "behavior",
        behaviorId,
        behaviorCapability,
      );
      pushHandlerActions(
        ownValue(behavior, "on"),
        appendJsonPointer(behaviorPointer, "on"),
        context,
        pendingActions,
      );
      pushNodeChildren(
        nodeStack,
        ownValue(behavior, "slots"),
        appendJsonPointer(behaviorPointer, "slots"),
      );
    }
  }

  while (pendingActions.length > 0) {
    const work = pendingActions.pop() as ActionWork;
    actions.push(work);
    if (work.action.type !== "operation.invoke") continue;
    for (const field of ["onFailure", "onSuccess"] as const) {
      const nested = asArray(ownValue(work.action, field)) ?? [];
      for (let index = nested.length - 1; index >= 0; index -= 1) {
        const action = asObject(nested[index]);
        if (action !== undefined) {
          pendingActions.push({
            action,
            pointer: appendPath(work.pointer, field, index),
            context: work.context,
          });
        }
      }
    }
  }
  actions.sort((left, right) => compareDocumentPointers(left.pointer, right.pointer));

  const operations = new Map<string, OperationReferenceContract>();
  for (const work of actions) {
    if (work.action.type !== "operation.invoke") continue;
    const capabilityId = stringField(work.action, "operation") as string;
    const alias = stringField(work.action, "as") as string;
    const resolution = selected.operations.get(capabilityId);
    if (resolution === undefined) continue;
    const existing = operations.get(alias);
    if (existing === undefined) {
      operations.set(alias, Object.freeze({ capabilityId, contract: resolution.contract }));
    } else if (existing.capabilityId !== capabilityId) {
      diagnostics.push(
        invalidExecutionContractDiagnostic(
          appendJsonPointer(work.pointer, "as"),
          contextWithCapability(work.context, capabilityId),
        ),
      );
    }
  }

  return Object.freeze({
    actions: Object.freeze(actions),
    components,
    operations,
  });
}

function addExecutionObligation(
  obligations: DesenExecutionContractObligation[],
  kind: Exclude<DesenExecutionContractObligationKind, DesenBindingContractObligationKind>,
  pointer: JsonPointer,
  context: Readonly<DesenDiagnosticContext>,
): void {
  obligations.push(Object.freeze({ kind, pointer, context: immutableContext(context) }));
}

function applyDocumentExecutionSchema(
  schema: JsonValue,
  value: JsonValue,
  basePointer: JsonPointer,
  code: "COMMAND_INPUT_INVALID" | "OPERATION_INPUT_INVALID" | "RESOURCE_INPUT_INVALID",
  obligationKind: "component-command-input" | "operation-input" | "resource-input",
  context: Readonly<DesenDiagnosticContext>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenExecutionContractObligation[],
): void {
  let result: ReturnType<typeof applySchemaContract>;
  try {
    result = applySchemaContract(schema, value, "complete");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    addExecutionCoreDiagnostic(diagnostics, code, basePointer, context);
    return;
  }
  for (const issue of result.issues) {
    addExecutionCoreDiagnostic(
      diagnostics,
      code,
      appendRelativePointer(basePointer, issue.pointer),
      context,
    );
  }
  for (const obligation of result.obligations) {
    addExecutionObligation(
      obligations,
      obligationKind,
      appendRelativePointer(basePointer, obligation.pointer),
      context,
    );
  }
}

function validateSurfaceResources(
  documentId: string,
  surfaceId: string,
  surface: JsonObject,
  selected: SelectedExecutionContracts,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenExecutionContractObligation[],
): ReadonlyMap<string, ResourceReferenceContract> {
  const references = new Map<string, ResourceReferenceContract>();
  const resources = asObject(ownValue(surface, "resources")) ?? EMPTY_OBJECT;
  for (const resourceName of sortedKeys(resources)) {
    const instance = asObject(resources[resourceName]);
    if (instance === undefined) continue;
    const capabilityId = stringField(instance, "use") as string;
    const resolution = selected.resources.get(capabilityId);
    if (resolution === undefined) continue;
    const pointer = appendPath(ROOT_POINTER, "surfaces", surfaceId, "resources", resourceName);
    const context = contextWithCapability(surfaceContext(documentId, surfaceId), capabilityId);
    references.set(resourceName, Object.freeze({ capabilityId, contract: resolution.contract }));

    const policies = asArray(ownValue(resolution.contract, "policies")) ?? [];
    const policy = stringField(instance, "policy") as string;
    if (!policies.includes(policy)) {
      addExecutionCoreDiagnostic(
        diagnostics,
        "RESOURCE_INPUT_INVALID",
        appendJsonPointer(pointer, "policy"),
        context,
      );
    }
    applyDocumentExecutionSchema(
      ownValue(resolution.contract, "inputSchema") as JsonValue,
      (ownValue(instance, "input") ?? EMPTY_OBJECT) as JsonValue,
      appendJsonPointer(pointer, "input"),
      "RESOURCE_INPUT_INVALID",
      "resource-input",
      context,
      diagnostics,
      obligations,
    );
  }
  return references;
}

function staticJsonValueType(
  value: JsonValue,
): "array" | "boolean" | "null" | "number" | "object" | "string" | undefined {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (!isJsonObject(value)) return "object";
  if (
    (Object.hasOwn(value, "$ref") && typeof value.$ref === "string") ||
    (Object.hasOwn(value, "$token") && typeof value.$token === "string") ||
    (Object.hasOwn(value, "$format") && isJsonObject(value.$format))
  ) {
    return undefined;
  }
  return "object";
}

function validateStateAction(
  work: ActionWork,
  states: JsonObject,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenExecutionContractObligation[],
): void {
  const pathText = stringField(work.action, "path") as string;
  const path = pathText.split(".");
  const stateName = path[0] as string;
  const state = asObject(states[stateName]);
  if (state === undefined) return; // T10 already reports the undeclared first segment.
  const schema = ownValue(state, "schema") as JsonValue;
  const nestedPath = path.slice(1);
  const pathPointer = appendJsonPointer(work.pointer, "path");
  const context = work.context;

  if (work.action.type === "state.toggle") {
    const inspection = inspectSchemaContractPath(schema, nestedPath);
    if (
      inspection.reachability === "impossible" ||
      (inspection.reachability === "possible" && !inspection.types.includes("boolean"))
    ) {
      addExecutionCoreDiagnostic(diagnostics, "STATE_WRITE_INVALID", pathPointer, context);
      return;
    }
    addExecutionObligation(obligations, "state-write", pathPointer, context);
    return;
  }

  const value = ownValue(work.action, "value") as JsonValue;
  const valuePointer = appendJsonPointer(work.pointer, "value");
  if (nestedPath.length > 0) {
    const inspection = inspectSchemaContractPath(schema, nestedPath);
    if (inspection.reachability === "impossible") {
      addExecutionCoreDiagnostic(diagnostics, "STATE_WRITE_INVALID", pathPointer, context);
      return;
    }
    const staticType = staticJsonValueType(value);
    if (
      inspection.reachability === "possible" &&
      staticType !== undefined &&
      !inspection.types.includes(staticType)
    ) {
      addExecutionCoreDiagnostic(diagnostics, "STATE_WRITE_INVALID", valuePointer, context);
      return;
    }
    // Existing sibling values participate in nested `required`, dependent, and conditional rules.
    // Applying an artificial partial ancestor here would reject valid writes, so the static layer
    // proves only definite path/type failures and requires a complete post-write runtime check.
    addExecutionObligation(obligations, "state-write", valuePointer, context);
    return;
  }

  let result: ReturnType<typeof applySchemaContract>;
  try {
    result = applySchemaContract(schema, value, "complete");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    addExecutionCoreDiagnostic(diagnostics, "STATE_WRITE_INVALID", valuePointer, context);
    return;
  }
  for (const issue of result.issues) {
    addExecutionCoreDiagnostic(
      diagnostics,
      "STATE_WRITE_INVALID",
      appendRelativePointer(valuePointer, issue.pointer),
      context,
    );
  }
  for (const obligation of result.obligations) {
    addExecutionObligation(
      obligations,
      "state-write",
      appendRelativePointer(valuePointer, obligation.pointer),
      context,
    );
  }
}

function validateSurfaceActions(
  surfaceId: string,
  surface: JsonObject,
  index: SurfaceIndex,
  selected: SelectedExecutionContracts,
  allSurfaceIds: ReadonlySet<string>,
  resources: ReadonlyMap<string, ResourceReferenceContract>,
  diagnostics: DesenSemanticDiagnostic[],
  obligations: DesenExecutionContractObligation[],
): void {
  const states = asObject(ownValue(surface, "state")) ?? EMPTY_OBJECT;
  for (const work of index.actions) {
    switch (work.action.type) {
      case "state.set":
      case "state.toggle":
        validateStateAction(work, states, diagnostics, obligations);
        break;
      case "navigate": {
        const destination = stringField(work.action, "surface") as string;
        if (!allSurfaceIds.has(destination)) {
          addExecutionCoreDiagnostic(
            diagnostics,
            "ENTRY_NOT_FOUND",
            appendJsonPointer(work.pointer, "surface"),
            work.context,
          );
        }
        break;
      }
      case "operation.invoke": {
        const capabilityId = stringField(work.action, "operation") as string;
        const resolution = selected.operations.get(capabilityId);
        if (resolution === undefined) break;
        const context = contextWithCapability(work.context, capabilityId);
        applyDocumentExecutionSchema(
          ownValue(resolution.contract, "inputSchema") as JsonValue,
          (ownValue(work.action, "input") ?? EMPTY_OBJECT) as JsonValue,
          appendJsonPointer(work.pointer, "input"),
          "OPERATION_INPUT_INVALID",
          "operation-input",
          context,
          diagnostics,
          obligations,
        );
        break;
      }
      case "resource.refresh": {
        const resourceName = stringField(work.action, "resource") as string;
        if (!resources.has(resourceName)) {
          addExecutionCoreDiagnostic(
            diagnostics,
            "REFERENCE_UNRESOLVED",
            appendJsonPointer(work.pointer, "resource"),
            work.context,
          );
        }
        break;
      }
      case "component.command": {
        const targetId = stringField(work.action, "target") as string;
        const target = index.components.get(targetId);
        if (target === undefined) {
          addExecutionCoreDiagnostic(
            diagnostics,
            "UNKNOWN_COMMAND",
            appendJsonPointer(work.pointer, "target"),
            work.context,
          );
          break;
        }
        const commandName = stringField(work.action, "command") as string;
        const commands = asObject(ownValue(target.resolution.contract, "commands"));
        const command = commands === undefined ? undefined : asObject(commands[commandName]);
        if (command === undefined) break; // T09 owns known-target command-name diagnostics.
        const targetCapabilityId = stringField(target.node, "use") as string;
        const context = subjectContext(
          work.context.documentId ?? "",
          work.context.surfaceId ?? "",
          "node",
          targetId,
          targetCapabilityId,
        );
        applyDocumentExecutionSchema(
          ownValue(command, "inputSchema") as JsonValue,
          (ownValue(work.action, "input") ?? EMPTY_OBJECT) as JsonValue,
          appendJsonPointer(work.pointer, "input"),
          "COMMAND_INPUT_INVALID",
          "component-command-input",
          context,
          diagnostics,
          obligations,
        );
        break;
      }
      default:
        // `event.emit` allowlists and host policy are explicit runtime responsibilities.
        break;
    }
  }
  void surfaceId;
}

function lifecycleReferenceContract(
  contract: JsonObject,
  path: readonly string[],
  lifecyclePresence: "always" | "maybe",
): DesenBindingExternalReferenceContract {
  const field = path[0];
  if (field === undefined) return Object.freeze({ kind: "missing" });
  if (field === "status" && path.length === 1) {
    return Object.freeze({
      kind: "fixed",
      presence: lifecyclePresence,
      types: Object.freeze(["string"] as const),
    });
  }
  if (field === "pending" && path.length === 1) {
    return Object.freeze({
      kind: "fixed",
      presence: lifecyclePresence,
      types: Object.freeze(["boolean"] as const),
    });
  }
  if (field === "error" && path.length === 2 && path[1] === "code") {
    return Object.freeze({
      kind: "fixed",
      presence: "maybe",
      types: Object.freeze(["string"] as const),
    });
  }
  if (field === "value") {
    return Object.freeze({
      kind: "schema",
      presence: "maybe",
      schema: ownValue(contract, "outputSchema"),
      path: Object.freeze(path.slice(1)),
    });
  }
  return Object.freeze({ kind: "missing" });
}

function executionReferenceResolver(
  environments: ReadonlyMap<string, SurfaceReferenceEnvironment>,
): DesenBindingExternalReferenceResolver {
  return (request) => {
    const environment = environments.get(request.surfaceId);
    if (environment === undefined || request.root.length === 0) {
      return Object.freeze({ kind: "invalid" });
    }
    if (request.namespace === "resource") {
      const resource = environment.resources.get(request.root);
      return resource === undefined
        ? Object.freeze({ kind: "invalid" })
        : lifecycleReferenceContract(resource.contract, request.path, "always");
    }
    const operation = environment.operations.get(request.root);
    return operation === undefined
      ? Object.freeze({ kind: "invalid" })
      : lifecycleReferenceContract(operation.contract, request.path, "maybe");
  };
}

function executionDocumentAnalysis(
  target: DesenExecutionContractTarget,
  document: DocumentSnapshot,
  catalogSet: DesenValidatedExecutionCatalogSet,
  metadata: ExecutionCatalogMetadata,
): Readonly<{
  diagnostics: readonly DesenSemanticDiagnostic[];
  obligations: readonly DesenExecutionContractObligation[];
}> {
  const diagnostics: DesenSemanticDiagnostic[] = [];
  const obligations: DesenExecutionContractObligation[] = [];
  const selected = selectedExecutionContracts(target, document, metadata);
  const snapshot = document as unknown as JsonObject;
  const surfaces = asObject(ownValue(snapshot, "surfaces")) ?? EMPTY_OBJECT;
  const surfaceIds = new Set(sortedKeys(surfaces));
  const environments = new Map<string, SurfaceReferenceEnvironment>();

  for (const surfaceId of sortedKeys(surfaces)) {
    const surface = asObject(surfaces[surfaceId]);
    if (surface === undefined) continue;
    const resources = validateSurfaceResources(
      document.id,
      surfaceId,
      surface,
      selected,
      diagnostics,
      obligations,
    );
    const index = collectSurfaceActionsAndTargets(
      document.id,
      surfaceId,
      surface,
      selected,
      diagnostics,
    );
    validateSurfaceActions(
      surfaceId,
      surface,
      index,
      selected,
      surfaceIds,
      resources,
      diagnostics,
      obligations,
    );
    environments.set(surfaceId, Object.freeze({ resources, operations: index.operations }));
  }

  diagnostics.push(
    ...validateDesenPreparedBindingSnapshot(
      document,
      catalogSet,
      executionReferenceResolver(environments),
    ),
  );
  return Object.freeze({
    diagnostics: normalizeSemanticDiagnostics(diagnostics),
    obligations: normalizeObligations(obligations),
  });
}

/**
 * Applies cumulative structural, semantic, binding, resource, operation, and action checks.
 *
 * @remarks T11 validates declared input contracts, lifecycle-reference paths, managed navigation,
 * resource refresh targets, static state writes, and component command targets/inputs. It does not
 * execute actions, authorize hosts, mount resources, invoke operations, select repeated component
 * instances, or claim that a conditional command target is currently live.
 */
export function validateDesenExecutionContracts<Target extends DesenExecutionContractTarget>(
  target: Target,
  input: unknown,
  catalogSet: DesenValidatedExecutionCatalogSet,
): DesenExecutionContractValidationResult<Target> {
  const bindings = validateDesenBindingContracts(target, input, catalogSet);
  if (!bindings.valid) {
    return executionFailure(target, bindings.diagnostics, bindings.obligations);
  }

  const metadata = EXECUTION_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) {
    const document = bindings.value as SourceSnapshot | BundleSnapshot;
    const pointer =
      target === "source"
        ? appendJsonPointer(ROOT_POINTER, "catalogs")
        : appendPath(ROOT_POINTER, "requires", "catalogs");
    return executionFailure(
      target,
      [invalidExecutionContractDiagnostic(pointer, { documentId: document.id })],
      bindings.obligations,
    );
  }

  const document = bindings.value as SourceSnapshot | BundleSnapshot;
  const execution = executionDocumentAnalysis(target, document, catalogSet, metadata);
  const obligations = [...bindings.obligations, ...execution.obligations];
  return execution.diagnostics.length === 0
    ? executionSuccess(target, bindings.value, obligations)
    : executionFailure(target, execution.diagnostics, obligations);
}

/** Validates a Source cumulatively through the M02-T11 execution-contract boundary. */
export function validateDesenSourceExecutionContracts(
  input: unknown,
  catalogSet: DesenValidatedExecutionCatalogSet,
): DesenExecutionContractValidationResult<"source"> {
  return validateDesenExecutionContracts("source", input, catalogSet);
}

/** Validates a Bundle cumulatively through the M02-T11 execution-contract boundary. */
export function validateDesenBundleExecutionContracts(
  input: unknown,
  catalogSet: DesenValidatedExecutionCatalogSet,
): DesenExecutionContractValidationResult<"bundle"> {
  return validateDesenExecutionContracts("bundle", input, catalogSet);
}

function selectorSnapshot(
  selector: DesenExecutionValueContractReference,
): Readonly<DesenExecutionValueContractReference> | undefined {
  const snapshot = snapshotResolvedJsonValue(selector) as JsonValue | undefined;
  if (snapshot === undefined || !isJsonObject(snapshot)) return undefined;
  const kind = stringField(snapshot, "kind");
  const capabilityId = stringField(snapshot, "capabilityId");
  if (kind === undefined || capabilityId === undefined) return undefined;
  if (kind === "component-command-input") {
    const commandName = stringField(snapshot, "commandName");
    if (
      commandName === undefined ||
      sortedKeys(snapshot).join("\u0000") !== "capabilityId\u0000commandName\u0000kind"
    ) {
      return undefined;
    }
    return Object.freeze({ kind, capabilityId, commandName });
  }
  if (
    kind !== "operation-input" &&
    kind !== "operation-output" &&
    kind !== "resource-input" &&
    kind !== "resource-output"
  ) {
    return undefined;
  }
  if (sortedKeys(snapshot).join("\u0000") !== "capabilityId\u0000kind") return undefined;
  return Object.freeze({ kind, capabilityId });
}

function resolvedDiagnosticCode(
  kind: DesenExecutionValueContractKind,
): Extract<
  CoreDiagnosticCode,
  | "COMMAND_INPUT_INVALID"
  | "OPERATION_INPUT_INVALID"
  | "OPERATION_OUTPUT_INVALID"
  | "RESOURCE_INPUT_INVALID"
  | "RESOURCE_OUTPUT_INVALID"
> {
  switch (kind) {
    case "component-command-input":
      return "COMMAND_INPUT_INVALID";
    case "operation-input":
      return "OPERATION_INPUT_INVALID";
    case "operation-output":
      return "OPERATION_OUTPUT_INVALID";
    case "resource-input":
      return "RESOURCE_INPUT_INVALID";
    case "resource-output":
      return "RESOURCE_OUTPUT_INVALID";
  }
}

function resolvedSchema(
  selector: Readonly<DesenExecutionValueContractReference>,
  metadata: ExecutionCatalogMetadata,
): Readonly<
  | { readonly valid: true; readonly schema: JsonValue }
  | {
      readonly valid: false;
      readonly code: "UNKNOWN_CAPABILITY" | "UNKNOWN_COMMAND";
    }
> {
  if (selector.kind === "component-command-input") {
    const component = metadata.components.get(selector.capabilityId);
    if (component === undefined) return Object.freeze({ valid: false, code: "UNKNOWN_CAPABILITY" });
    const commands = asObject(ownValue(component.contract, "commands"));
    const command = commands === undefined ? undefined : asObject(commands[selector.commandName]);
    return command === undefined
      ? Object.freeze({ valid: false, code: "UNKNOWN_COMMAND" })
      : Object.freeze({ valid: true, schema: ownValue(command, "inputSchema") as JsonValue });
  }

  const collection = selector.kind.startsWith("operation-")
    ? metadata.operations
    : metadata.resources;
  const resolution = collection.get(selector.capabilityId);
  if (resolution === undefined) return Object.freeze({ valid: false, code: "UNKNOWN_CAPABILITY" });
  const schemaName = selector.kind.endsWith("-input") ? "inputSchema" : "outputSchema";
  return Object.freeze({
    valid: true,
    schema: ownValue(resolution.contract, schemaName) as JsonValue,
  });
}

/**
 * Validates one resolved command, operation, or resource value against a prepared exact contract.
 *
 * @remarks Both selector and value cross a detached, bounded, recursively immutable JSON boundary.
 * `$ref`, `$token`, and `$format` property names are ordinary resolved data and cannot bypass the
 * selected schema. No adapter is called and no caller object is retained.
 */
export function validateDesenExecutionValue(
  value: unknown,
  selector: DesenExecutionValueContractReference,
  catalogSet: DesenValidatedExecutionCatalogSet,
): DesenExecutionValueValidationResult {
  const reference = selectorSnapshot(selector);
  if (reference === undefined) {
    return executionValueFailure([invalidExecutionContractDiagnostic(ROOT_POINTER)]);
  }
  const metadata = EXECUTION_CATALOG_METADATA.get(catalogSet);
  if (metadata === undefined) {
    return executionValueFailure([
      invalidExecutionContractDiagnostic(ROOT_POINTER, {
        capabilityId: reference.capabilityId,
      }),
    ]);
  }

  const selection = resolvedSchema(reference, metadata);
  if (!selection.valid) {
    const diagnostics: DesenSemanticDiagnostic[] = [];
    addExecutionCoreDiagnostic(diagnostics, selection.code, ROOT_POINTER, {
      capabilityId: reference.capabilityId,
    });
    return executionValueFailure(diagnostics);
  }

  const snapshot = snapshotResolvedJsonValue(value);
  const diagnosticCode = resolvedDiagnosticCode(reference.kind);
  if (snapshot === undefined) {
    const diagnostics: DesenSemanticDiagnostic[] = [];
    addExecutionCoreDiagnostic(diagnostics, diagnosticCode, ROOT_POINTER, {
      capabilityId: reference.capabilityId,
    });
    return executionValueFailure(diagnostics);
  }

  let result: ReturnType<typeof applySchemaContract>;
  try {
    result = applySchemaContract(selection.schema, snapshot, "complete", "resolved-value");
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    const diagnostics: DesenSemanticDiagnostic[] = [];
    addExecutionCoreDiagnostic(diagnostics, diagnosticCode, ROOT_POINTER, {
      capabilityId: reference.capabilityId,
    });
    return executionValueFailure(diagnostics);
  }
  if (result.issues.length === 0) return executionValueSuccess(snapshot);

  const diagnostics: DesenSemanticDiagnostic[] = [];
  for (const issue of result.issues) {
    addExecutionCoreDiagnostic(diagnostics, diagnosticCode, issue.pointer, {
      capabilityId: reference.capabilityId,
    });
  }
  return executionValueFailure(diagnostics);
}
