import { appendJsonPointer, createJsonPointer } from "@desen/protocol";

import type { DesenDiagnostic, JsonPointer } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "./catalog-resolution.js";
import {
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  normalizePublishExecutionPreflightLimits,
  preflightPublishExecution,
} from "./execution-preflight.js";
import type {
  PublishExecutionPreflightLimits,
  PublishExecutionPreflightResult,
  PublishExecutionPreflightSuccess,
} from "./execution-preflight.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import type { PublishFailure, PublishWarningDiagnostic } from "./publish-result.js";

/** Package-private diagnostic for cumulative preservation-authority drift. */
export const SOURCE_PRESERVATION_AUTHORITY_INVALID_CODE =
  "run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID" as const;

/** Package-private diagnostic for finite source-node trace exhaustion. */
export const SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE =
  "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED" as const;

/**
 * Finite output profile for the package-private M06-T06 preservation boundary.
 *
 * @remarks The nested profile is owned by M06-T05. The remaining limits bound the complete inert
 * component-node trace; a crossing rejects the whole intermediate rather than truncating it.
 */
export interface PublishSourcePreservationLimits {
  /** Exact finite profile inherited by M06-T01 through M06-T05. */
  readonly executionPreflight: Readonly<PublishExecutionPreflightLimits>;
  /** Maximum component-node identity entries admitted to the complete trace. */
  readonly maxSourceNodeTraceEntries: number;
  /** Maximum UTF-16 code units in one source-node JSON Pointer. */
  readonly maxSourceNodePointerCodeUnits: number;
  /** Maximum aggregate identity and pointer code units across the complete trace. */
  readonly maxAggregateSourceNodeTraceCodeUnits: number;
}

/** Default finite Publisher profile for Source preservation and component-node traceability. */
export const PUBLISH_SOURCE_PRESERVATION_LIMITS: Readonly<PublishSourcePreservationLimits> =
  Object.freeze({
    executionPreflight: PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
    maxSourceNodeTraceEntries: 25_000,
    maxSourceNodePointerCodeUnits: 4_096,
    maxAggregateSourceNodeTraceCodeUnits: 4_194_304,
  });

/**
 * Exact Source fields that may later become production document content.
 *
 * @remarks Every object or array member is retained by reference from the authenticated Source.
 * Catalog requirements remain separate because publication must pin them to package tuples.
 * `authoring`, Source `kind`, and Source `catalogs` are deliberately absent. This is not yet a
 * Bundle and no normalization has occurred.
 */
export interface PublishPreservedSourceDocument {
  readonly desen: DesenPreparedSourceFoundation["desen"];
  readonly entry: DesenPreparedSourceFoundation["entry"];
  readonly extensions?: DesenPreparedSourceFoundation["extensions"];
  readonly id: DesenPreparedSourceFoundation["id"];
  readonly surfaces: DesenPreparedSourceFoundation["surfaces"];
}

/** One inert, source-authored component-node identity relation. */
export interface PublishSourceNodeTraceEntry {
  readonly documentId: string;
  readonly surfaceId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly sourcePointer: JsonPointer;
}

/**
 * Complete component-node trace owned by the DESEN 0.1.0 unchanged-identifier strategy.
 *
 * @remarks Behavior identities are preserved inside `preservedDocument.surfaces`; they are not
 * fabricated as component-node trace entries.
 */
export interface PublishSourceTraceability {
  readonly strategy: "unchanged-node-identifiers";
  readonly sourceNodes: readonly PublishSourceNodeTraceEntry[];
}

/**
 * Complete nonterminal preservation authority prepared for authoring removal and normalization.
 *
 * @remarks All M06-T05 authorities cross by exact reference. `preservedDocument` is a shallow,
 * frozen projection whose nested values are those exact Source values. The trace contains strings
 * and JSON Pointers only; it grants no executable, runtime, host, Catalog, or adapter authority.
 */
export interface PublishSourcePreservationSuccess {
  readonly preservationPrepared: true;
  readonly source: DesenPreparedSourceFoundation;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly PublishWarningDiagnostic[];
  readonly obligations: readonly DesenExecutionContractObligation[];
  readonly preservedDocument: Readonly<PublishPreservedSourceDocument>;
  readonly sourceCatalogRequirements: DesenPreparedSourceFoundation["catalogs"];
  readonly traceability: Readonly<PublishSourceTraceability>;
}

/** Source preservation either prepares one complete authority or exposes no partials. */
export type PublishSourcePreservationResult = PublishSourcePreservationSuccess | PublishFailure;

type SourceSnapshot = DesenPreparedSourceFoundation;
type SurfaceSnapshot = SourceSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];

interface NodeVisit {
  readonly node: NodeSnapshot;
  readonly entry: Readonly<PublishSourceNodeTraceEntry>;
}

interface TraceBudget {
  scheduledEntries: number;
  aggregateCodeUnits: number;
}

type TraceBuildResult =
  | Readonly<{ status: "success"; sourceNodes: readonly PublishSourceNodeTraceEntry[] }>
  | Readonly<{ status: "authority-invalid" | "limit-exceeded" }>;

type ScheduleResult =
  | Readonly<{ status: "success"; visit: NodeVisit }>
  | Readonly<{ status: "authority-invalid" | "limit-exceeded" }>;

const PRESERVATION_LIMIT_KEYS = Object.freeze([
  "executionPreflight",
  "maxSourceNodeTraceEntries",
  "maxSourceNodePointerCodeUnits",
  "maxAggregateSourceNodeTraceCodeUnits",
] as const);
const PRESERVATION_LIMIT_KEY_SET: ReadonlySet<string> = new Set(PRESERVATION_LIMIT_KEYS);
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);
const NORMALIZATION_STAGE = "normalization" as const;

function hasOrdinaryObjectPrototype(value: object): boolean {
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

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function hasOwnDataProperty(object: object, key: PropertyKey): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor;
}

function isExecutionPreflightSuccess(
  result: PublishExecutionPreflightResult,
): result is PublishExecutionPreflightSuccess {
  return ownDataValue(result, "executionPreflighted") === true;
}

/**
 * Captures an exact own-data preservation profile before Source or Catalog-candidate observation.
 *
 * @internal Accessors, inherited members, symbols, extra keys, custom prototypes, and non-positive
 * integers are rejected. The nested M06-T05 profile is normalized by its owning boundary.
 */
export function normalizePublishSourcePreservationLimits(
  input: unknown,
): Readonly<PublishSourcePreservationLimits> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError();
    if (!hasOrdinaryObjectPrototype(input)) throw new TypeError();
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== PRESERVATION_LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !PRESERVATION_LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }

    for (const key of PRESERVATION_LIMIT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
    }

    const executionPreflight = normalizePublishExecutionPreflightLimits(
      ownDataValue(input, "executionPreflight"),
    );
    const maxSourceNodeTraceEntries = ownDataValue<number>(input, "maxSourceNodeTraceEntries");
    const maxSourceNodePointerCodeUnits = ownDataValue<number>(
      input,
      "maxSourceNodePointerCodeUnits",
    );
    const maxAggregateSourceNodeTraceCodeUnits = ownDataValue<number>(
      input,
      "maxAggregateSourceNodeTraceCodeUnits",
    );
    for (const value of [
      maxSourceNodeTraceEntries,
      maxSourceNodePointerCodeUnits,
      maxAggregateSourceNodeTraceCodeUnits,
    ]) {
      if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new TypeError();
    }

    return Object.freeze({
      executionPreflight,
      maxSourceNodeTraceEntries: maxSourceNodeTraceEntries as number,
      maxSourceNodePointerCodeUnits: maxSourceNodePointerCodeUnits as number,
      maxAggregateSourceNodeTraceCodeUnits: maxAggregateSourceNodeTraceCodeUnits as number,
    });
  } catch {
    throw new TypeError(
      "Source-preservation limits must be an exact own-data finite positive-integer profile.",
    );
  }
}

function preservationDiagnostic(
  code:
    | typeof SOURCE_PRESERVATION_AUTHORITY_INVALID_CODE
    | typeof SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE,
  message: string,
): Readonly<DesenDiagnostic<typeof code>> {
  return Object.freeze({ code, message, pointer: createJsonPointer() });
}

function preservationAuthorityFailure(): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      preservationDiagnostic(
        SOURCE_PRESERVATION_AUTHORITY_INVALID_CODE,
        "Source-preservation preflight could not authenticate its cumulative publication authority.",
      ),
      NORMALIZATION_STAGE,
    ),
  ]);
}

function preservationLimitFailure(): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      preservationDiagnostic(
        SOURCE_PRESERVATION_LIMIT_EXCEEDED_CODE,
        "Source-preservation trace output exceeded the finite Publisher profile.",
      ),
      NORMALIZATION_STAGE,
    ),
  ]);
}

function exactExecutionAuthority(execution: PublishExecutionPreflightSuccess): boolean {
  try {
    const source = execution.source;
    const sourceCatalogRequirements = ownDataValue<SourceSnapshot["catalogs"]>(source, "catalogs");
    const surfaces = ownDataValue<SourceSnapshot["surfaces"]>(source, "surfaces");
    return (
      typeof sourceCatalogRequirements === "object" &&
      sourceCatalogRequirements !== null &&
      Array.isArray(sourceCatalogRequirements) &&
      typeof surfaces === "object" &&
      surfaces !== null &&
      !Array.isArray(surfaces) &&
      hasOwnDataProperty(source, "desen") &&
      hasOwnDataProperty(source, "entry") &&
      hasOwnDataProperty(source, "id") &&
      execution.packages.length === execution.catalogSet.length &&
      execution.packages.every((entry, index) => entry.catalog === execution.catalogSet[index]) &&
      execution.requirementPackageIndexes.length === sourceCatalogRequirements.length &&
      execution.requirementPackageIndexes.every(
        (index) => Number.isSafeInteger(index) && index >= 0 && index < execution.packages.length,
      )
    );
  } catch {
    return false;
  }
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedOwnDataKeys(value: object): readonly string[] | undefined {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return undefined;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return undefined;
    }
  }
  return (keys as string[]).sort(compareUtf16);
}

function appendPath(pointer: JsonPointer, ...segments: readonly (number | string)[]): JsonPointer {
  let current = pointer;
  for (const segment of segments) current = appendJsonPointer(current, segment);
  return current;
}

function traceEntryCodeUnits(entry: PublishSourceNodeTraceEntry): number {
  return (
    entry.documentId.length +
    entry.surfaceId.length +
    entry.sourceNodeId.length +
    entry.capabilityId.length +
    entry.sourcePointer.length
  );
}

function scheduleNode(
  pending: NodeVisit[],
  node: unknown,
  documentId: string,
  surfaceId: string,
  sourcePointer: JsonPointer,
  limits: Readonly<PublishSourcePreservationLimits>,
  budget: TraceBudget,
): ScheduleResult {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return Object.freeze({ status: "authority-invalid" });
  }
  const sourceNodeId = ownDataValue<string>(node, "id");
  const capabilityId = ownDataValue<string>(node, "use");
  if (typeof sourceNodeId !== "string" || typeof capabilityId !== "string") {
    return Object.freeze({ status: "authority-invalid" });
  }

  const entry = Object.freeze({
    documentId,
    surfaceId,
    sourceNodeId,
    capabilityId,
    sourcePointer,
  }) satisfies Readonly<PublishSourceNodeTraceEntry>;
  const aggregateCodeUnits = budget.aggregateCodeUnits + traceEntryCodeUnits(entry);
  if (
    budget.scheduledEntries >= limits.maxSourceNodeTraceEntries ||
    sourcePointer.length > limits.maxSourceNodePointerCodeUnits ||
    aggregateCodeUnits > limits.maxAggregateSourceNodeTraceCodeUnits
  ) {
    return Object.freeze({ status: "limit-exceeded" });
  }

  budget.scheduledEntries += 1;
  budget.aggregateCodeUnits = aggregateCodeUnits;
  const visit = Object.freeze({ node: node as NodeSnapshot, entry });
  pending.push(visit);
  return Object.freeze({ status: "success", visit });
}

function ownArrayEntry(array: readonly unknown[], index: number): unknown {
  return ownDataValue(array, String(index));
}

function enqueueSlotNodes(
  pending: NodeVisit[],
  slots: unknown,
  pointer: JsonPointer,
  documentId: string,
  surfaceId: string,
  limits: Readonly<PublishSourcePreservationLimits>,
  budget: TraceBudget,
): TraceBuildResult["status"] {
  if (slots === undefined) return "success";
  if (typeof slots !== "object" || slots === null || Array.isArray(slots)) {
    return "authority-invalid";
  }
  const slotNames = sortedOwnDataKeys(slots);
  if (slotNames === undefined) return "authority-invalid";

  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex];
    if (slotName === undefined) return "authority-invalid";
    const nodes = ownDataValue<readonly unknown[]>(slots, slotName);
    if (!Array.isArray(nodes)) return "authority-invalid";
    for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex -= 1) {
      const node = ownArrayEntry(nodes, nodeIndex);
      if (node === undefined) return "authority-invalid";
      const scheduled = scheduleNode(
        pending,
        node,
        documentId,
        surfaceId,
        appendPath(pointer, slotName, nodeIndex),
        limits,
        budget,
      );
      if (scheduled.status !== "success") return scheduled.status;
    }
  }
  return "success";
}

function enqueueNodeChildren(
  pending: NodeVisit[],
  visit: NodeVisit,
  limits: Readonly<PublishSourcePreservationLimits>,
  budget: TraceBudget,
): TraceBuildResult["status"] {
  const { node, entry } = visit;

  // UTF-16 core-field order visits `behaviors` before `slots`. Because this is a LIFO worklist,
  // direct node slots are enqueued first and therefore observed after behavior-owned slot nodes.
  const nodeSlotsStatus = enqueueSlotNodes(
    pending,
    ownDataValue<NodeSnapshot["slots"]>(node, "slots"),
    appendJsonPointer(entry.sourcePointer, "slots"),
    entry.documentId,
    entry.surfaceId,
    limits,
    budget,
  );
  if (nodeSlotsStatus !== "success") return nodeSlotsStatus;

  const behaviors = ownDataValue<NodeSnapshot["behaviors"]>(node, "behaviors");
  if (behaviors === undefined) return "success";
  if (!Array.isArray(behaviors)) return "authority-invalid";
  for (let behaviorIndex = behaviors.length - 1; behaviorIndex >= 0; behaviorIndex -= 1) {
    const behavior = ownArrayEntry(behaviors, behaviorIndex);
    if (typeof behavior !== "object" || behavior === null || Array.isArray(behavior)) {
      return "authority-invalid";
    }
    const behaviorSlotsStatus = enqueueSlotNodes(
      pending,
      ownDataValue<BehaviorSnapshot["slots"]>(behavior, "slots"),
      appendPath(entry.sourcePointer, "behaviors", behaviorIndex, "slots"),
      entry.documentId,
      entry.surfaceId,
      limits,
      budget,
    );
    if (behaviorSlotsStatus !== "success") return behaviorSlotsStatus;
  }
  return "success";
}

/**
 * Builds a bounded component-node trace with an iterative source-graph walk.
 *
 * @remarks Surface and slot maps use exact UTF-16 code-unit order. Component arrays and behavior
 * arrays retain index order. Only schema-defined `root`, `behaviors`, and `slots` edges are
 * inspected; node-shaped values inside extension payloads remain opaque.
 */
function buildSourceNodeTrace(
  source: DesenPreparedSourceFoundation,
  limits: Readonly<PublishSourcePreservationLimits>,
): TraceBuildResult {
  try {
    const documentId = ownDataValue<string>(source, "id");
    const surfaces = ownDataValue<SourceSnapshot["surfaces"]>(source, "surfaces");
    if (
      typeof documentId !== "string" ||
      typeof surfaces !== "object" ||
      surfaces === null ||
      Array.isArray(surfaces)
    ) {
      return Object.freeze({ status: "authority-invalid" });
    }
    const surfaceKeys = sortedOwnDataKeys(surfaces);
    if (surfaceKeys === undefined) return Object.freeze({ status: "authority-invalid" });

    const pending: NodeVisit[] = [];
    const budget: TraceBudget = { scheduledEntries: 0, aggregateCodeUnits: 0 };
    for (let surfaceIndex = surfaceKeys.length - 1; surfaceIndex >= 0; surfaceIndex -= 1) {
      const surfaceKey = surfaceKeys[surfaceIndex];
      if (surfaceKey === undefined) return Object.freeze({ status: "authority-invalid" });
      const surface = ownDataValue<SurfaceSnapshot>(surfaces, surfaceKey);
      if (typeof surface !== "object" || surface === null || Array.isArray(surface)) {
        return Object.freeze({ status: "authority-invalid" });
      }
      const surfaceId = ownDataValue<string>(surface, "id");
      const root = ownDataValue<NodeSnapshot>(surface, "root");
      if (surfaceId !== surfaceKey || root === undefined) {
        return Object.freeze({ status: "authority-invalid" });
      }
      const scheduled = scheduleNode(
        pending,
        root,
        documentId,
        surfaceId,
        createJsonPointer(["surfaces", surfaceKey, "root"]),
        limits,
        budget,
      );
      if (scheduled.status !== "success") return Object.freeze({ status: scheduled.status });
    }

    const sourceNodes: PublishSourceNodeTraceEntry[] = [];
    while (pending.length > 0) {
      const visit = pending.pop();
      if (visit === undefined) return Object.freeze({ status: "authority-invalid" });
      sourceNodes.push(visit.entry);
      const childStatus = enqueueNodeChildren(pending, visit, limits, budget);
      if (childStatus !== "success") return Object.freeze({ status: childStatus });
    }
    return Object.freeze({
      status: "success",
      sourceNodes: Object.freeze(sourceNodes),
    });
  } catch {
    return Object.freeze({ status: "authority-invalid" });
  }
}

function preservedSourceDocument(
  source: DesenPreparedSourceFoundation,
): Readonly<PublishPreservedSourceDocument> | undefined {
  try {
    const desen = ownDataValue<DesenPreparedSourceFoundation["desen"]>(source, "desen");
    const entry = ownDataValue<string>(source, "entry");
    const id = ownDataValue<string>(source, "id");
    const surfaces = ownDataValue<SourceSnapshot["surfaces"]>(source, "surfaces");
    if (
      desen !== "0.1.0" ||
      typeof entry !== "string" ||
      typeof id !== "string" ||
      typeof surfaces !== "object" ||
      surfaces === null ||
      Array.isArray(surfaces)
    ) {
      return undefined;
    }

    const extensionsDescriptor = Object.getOwnPropertyDescriptor(source, "extensions");
    if (
      extensionsDescriptor !== undefined &&
      (!extensionsDescriptor.enumerable || !("value" in extensionsDescriptor))
    ) {
      return undefined;
    }
    return extensionsDescriptor === undefined
      ? Object.freeze({ desen, entry, id, surfaces })
      : Object.freeze({
          desen,
          entry,
          extensions: extensionsDescriptor.value as SourceSnapshot["extensions"],
          id,
          surfaces,
        });
  } catch {
    return undefined;
  }
}

/**
 * Runs M06-T05 exactly once, then proves lossless Source preservation and node traceability.
 *
 * @internal This nonterminal seam does not remove authoring from the authenticated Source. It
 * instead exposes a separate exact-field projection for later authoring removal and normalization.
 * It does not construct a Bundle, normalize data, calculate a digest or revision, or pin Catalog
 * tuples. Unknown extension payloads remain inert and uninspected.
 */
export function preflightPublishSourcePreservation(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishSourcePreservationLimits> = PUBLISH_SOURCE_PRESERVATION_LIMITS,
): PublishSourcePreservationResult {
  const limits = normalizePublishSourcePreservationLimits(limitInput);
  const execution = preflightPublishExecution(
    rawSourceInput,
    catalogPackageCandidatesInput,
    limits.executionPreflight,
  );
  if (!isExecutionPreflightSuccess(execution)) return execution;
  if (!exactExecutionAuthority(execution)) return preservationAuthorityFailure();

  const preservedDocument = preservedSourceDocument(execution.source);
  if (preservedDocument === undefined) return preservationAuthorityFailure();
  const sourceCatalogRequirements = ownDataValue<SourceSnapshot["catalogs"]>(
    execution.source,
    "catalogs",
  );
  if (sourceCatalogRequirements === undefined) return preservationAuthorityFailure();

  const trace = buildSourceNodeTrace(execution.source, limits);
  if (trace.status !== "success") {
    return trace.status === "authority-invalid"
      ? preservationAuthorityFailure()
      : preservationLimitFailure();
  }

  return Object.freeze({
    preservationPrepared: true,
    source: execution.source,
    catalogSet: execution.catalogSet,
    packages: execution.packages,
    requirementPackageIndexes: execution.requirementPackageIndexes,
    diagnostics: execution.diagnostics,
    obligations: execution.obligations,
    preservedDocument,
    sourceCatalogRequirements,
    traceability: Object.freeze({
      strategy: "unchanged-node-identifiers",
      sourceNodes: trace.sourceNodes,
    }),
  });
}
