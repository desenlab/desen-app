import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { deriveComponentInspectorControls, registerComponent } from "@desen/catalog-sdk";
import {
  validateDesenInteractionCatalogSet,
  validateDesenSourceInteractionContracts,
} from "@desen/validator";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";

import type { ComponentInspectorControlPlan, ComponentManifest } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";

type JsonObject = Readonly<Record<string, unknown>>;

const AUTHORING_SURFACE_ID = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const REQUIRED_AUTHORING_FRAME_KEYS = Object.freeze(["height", "width", "x", "y"] as const);

/** Visual safety limits applied before Source canvas metadata can influence App layout. */
export const AUTHORING_CANVAS_FRAME_LIMITS = Object.freeze({
  maxHeight: 16_384,
  maxWidth: 16_384,
  minHeight: 1,
  minWidth: 1,
});

/** Exact dimensions of the selected authored page frame, with no placement authority. */
export interface AuthoringCanvasFrame {
  readonly width: number;
  readonly height: number;
  /** Factual dimension label; it intentionally does not infer a device category. */
  readonly label: string;
}

/** Stable reason why the selected Source frame could not be projected. */
export type AuthoringCanvasFrameRejectionReason =
  | "authoring-missing"
  | "canvas-invalid"
  | "canvas-missing"
  | "document-invalid"
  | "frame-invalid"
  | "frame-missing"
  | "surface-id-invalid"
  | "surface-missing";

/** Complete immutable success projection for one selected Source surface. */
export interface AuthoringCanvasFrameReady {
  readonly status: "ready";
  readonly frame: AuthoringCanvasFrame;
}

/** Fail-closed projection with no partial frame, coordinate, or fallback authority. */
export interface AuthoringCanvasFrameRejected {
  readonly status: "rejected";
  readonly reason: AuthoringCanvasFrameRejectionReason;
}

/** Closed active-canvas projection for the selected Source surface. */
export type AuthoringCanvasFrameProjection =
  AuthoringCanvasFrameReady | AuthoringCanvasFrameRejected;

function rejectedAuthoringCanvasFrame(
  reason: AuthoringCanvasFrameRejectionReason,
): AuthoringCanvasFrameRejected {
  return Object.freeze({ status: "rejected", reason });
}

function ownDataObject(value: unknown): JsonObject | undefined {
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

function ownDataValue(record: JsonObject, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor?.enumerable === true && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function hasOwnDataValue(record: JsonObject, key: string): boolean {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor?.enumerable === true && "value" in descriptor;
  } catch {
    return false;
  }
}

function hasExactAuthoringFrameKeys(record: JsonObject): boolean {
  try {
    const ownKeys = Reflect.ownKeys(record);
    return (
      ownKeys.length === REQUIRED_AUTHORING_FRAME_KEYS.length &&
      ownKeys.every(
        (key) =>
          typeof key === "string" &&
          REQUIRED_AUTHORING_FRAME_KEYS.some((requiredKey) => requiredKey === key),
      )
    );
  } catch {
    return false;
  }
}

function isBoundedPositiveSafeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isSafeCanvasCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function projectDeclaredAuthoringFrame(value: unknown): AuthoringCanvasFrame | undefined {
  const record = ownDataObject(value);
  if (record === undefined || !hasExactAuthoringFrameKeys(record)) return undefined;

  const width = ownDataValue(record, "width");
  const height = ownDataValue(record, "height");
  const x = ownDataValue(record, "x");
  const y = ownDataValue(record, "y");

  if (
    !isBoundedPositiveSafeInteger(
      width,
      AUTHORING_CANVAS_FRAME_LIMITS.minWidth,
      AUTHORING_CANVAS_FRAME_LIMITS.maxWidth,
    ) ||
    !isBoundedPositiveSafeInteger(
      height,
      AUTHORING_CANVAS_FRAME_LIMITS.minHeight,
      AUTHORING_CANVAS_FRAME_LIMITS.maxHeight,
    ) ||
    !isSafeCanvasCoordinate(x) ||
    !isSafeCanvasCoordinate(y)
  ) {
    return undefined;
  }

  // The active route owns centering. Source-space coordinates can describe a multi-frame source
  // workspace, but they cannot become CSS placement authority for this single selected surface.
  return Object.freeze({ width, height, label: `${width} × ${height} px` });
}

/**
 * Projects the selected Source surface's declared frame into inert App layout dimensions.
 *
 * The candidate crosses the same exact Catalog-aware validation boundary as the authoring model.
 * No default frame is fabricated, and Source-space x/y values are admitted but never exposed.
 */
export function projectAuthoringCanvasFrame(
  document: DesenEditorDocument,
  surfaceId: string,
): AuthoringCanvasFrameProjection {
  if (typeof surfaceId !== "string" || !AUTHORING_SURFACE_ID.test(surfaceId)) {
    return rejectedAuthoringCanvasFrame("surface-id-invalid");
  }

  let admittedDocument: unknown;
  try {
    const catalogSet = validateDesenInteractionCatalogSet([referenceCatalog]);
    if (!catalogSet.valid) return rejectedAuthoringCanvasFrame("document-invalid");
    const source = validateDesenSourceInteractionContracts(document, catalogSet.value);
    if (!source.valid) return rejectedAuthoringCanvasFrame("document-invalid");
    admittedDocument = source.value;
  } catch {
    return rejectedAuthoringCanvasFrame("document-invalid");
  }

  const documentRecord = ownDataObject(admittedDocument);
  if (documentRecord === undefined) return rejectedAuthoringCanvasFrame("document-invalid");

  const surfaces = ownDataObject(ownDataValue(documentRecord, "surfaces"));
  if (surfaces === undefined || !hasOwnDataValue(surfaces, surfaceId)) {
    return rejectedAuthoringCanvasFrame("surface-missing");
  }
  if (!hasOwnDataValue(documentRecord, "authoring")) {
    return rejectedAuthoringCanvasFrame("authoring-missing");
  }

  const authoring = ownDataObject(ownDataValue(documentRecord, "authoring"));
  if (authoring === undefined) return rejectedAuthoringCanvasFrame("canvas-invalid");
  if (!hasOwnDataValue(authoring, "canvas")) {
    return rejectedAuthoringCanvasFrame("canvas-missing");
  }

  const canvas = ownDataObject(ownDataValue(authoring, "canvas"));
  if (canvas === undefined) return rejectedAuthoringCanvasFrame("canvas-invalid");
  if (!hasOwnDataValue(canvas, surfaceId)) {
    return rejectedAuthoringCanvasFrame("frame-missing");
  }

  const frame = projectDeclaredAuthoringFrame(ownDataValue(canvas, surfaceId));
  return frame === undefined
    ? rejectedAuthoringCanvasFrame("frame-invalid")
    : Object.freeze({ status: "ready", frame });
}

interface CapabilityMetadata {
  readonly displayName: string;
  readonly slotContracts: readonly AuthoringSlotContract[];
}

/** One exact Catalog-declared named-slot contract projected for App-owned manipulation UI. */
export interface AuthoringSlotContract {
  readonly name: string;
  readonly required: boolean;
  readonly minimum: number;
  readonly maximum: number | null;
  readonly constrainsChildren: boolean;
  readonly acceptedCapabilityIds: readonly string[];
  readonly acceptedCategories: readonly string[];
  readonly description: string | undefined;
}

/** Authoring-safe component metadata projected from one exact Catalog component contract. */
export interface CatalogComponentSummary {
  readonly id: string;
  readonly displayName: string;
  readonly authoringCategory: string;
  readonly semanticCategory: string | undefined;
  readonly description: string | undefined;
  /** Exact inert authoring defaults staged for a newly inserted node before final validation. */
  readonly defaultProps: JsonObject;
  /** Complete Catalog-declared named-slot contracts in canonical name order. */
  readonly slotContracts: readonly AuthoringSlotContract[];
  /** Schema-authoritative control plan derived from this exact validated component manifest. */
  readonly inspector: ComponentInspectorControlPlan;
}

/** One named Source slot with child order preserved exactly. */
export interface AuthoringLayerSlot {
  readonly name: string;
  readonly children: readonly AuthoringLayerNode[];
}

/** One behavior attachment shown inside its owning component node. */
export interface AuthoringBehaviorLayer {
  readonly kind: "behavior";
  readonly id: string;
  readonly capabilityId: string;
  readonly displayName: string;
  readonly conditional: boolean;
  /** Complete Catalog-declared named-slot contracts in canonical name order. */
  readonly slotContracts: readonly AuthoringSlotContract[];
  readonly slots: readonly AuthoringLayerSlot[];
}

/** A read-only Source component whose label was resolved from the exact Catalog. */
export interface AuthoringLayerNode {
  readonly kind: "component";
  readonly id: string;
  readonly capabilityId: string;
  readonly displayName: string;
  readonly conditional: boolean;
  /** Exact immutable base props currently present on this Source node. */
  readonly props: JsonObject;
  readonly behaviors: readonly AuthoringBehaviorLayer[];
  /** Complete Catalog-declared named-slot contracts in canonical name order. */
  readonly slotContracts: readonly AuthoringSlotContract[];
  readonly slots: readonly AuthoringLayerSlot[];
}

/** One exact surface tree from the validator-authenticated Source snapshot. */
export interface AuthoringSurfaceTree {
  readonly id: string;
  readonly root: AuthoringLayerNode;
}

/** Catalog identity, component library, and exact Source trees admitted by M09-T02. */
export interface CatalogAuthoringModel {
  readonly catalog: {
    readonly id: string;
    readonly version: string;
    readonly target: string;
  };
  readonly components: readonly CatalogComponentSummary[];
  readonly surfaces: readonly AuthoringSurfaceTree[];
  /** Exact validator-admitted Catalog set reused by later App validation boundaries. */
  readonly validationCatalogs: readonly unknown[];
  /** Exact validator-admitted Source snapshot reused by later App mutation boundaries. */
  readonly validationDocument: DesenEditorDocument;
}

/** Fail-closed outcome of preparing the M09-T02 authoring read model. */
export type CatalogAuthoringModelResult =
  | Readonly<{ readonly ok: true; readonly model: CatalogAuthoringModel }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "catalog-invalid" | "projection-limit" | "source-invalid";
    }>;

const AUTHORING_READ_LIMITS = Object.freeze({
  maxIdentityOccurrencesPerSurface: 25_000,
  maxSourceTreeDepth: 64,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(path: string, expectation: string): never {
  throw new TypeError(`Authoring fixture ${path} must be ${expectation}.`);
}

class AuthoringProjectionLimitError extends Error {}

function readObject(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, "an object");
  }
  return value as JsonObject;
}

function readArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) return fail(path, "an array");
  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) return fail(path, "a non-empty string");
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") return fail(path, "a boolean");
  return value;
}

function readNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    return fail(path, "a non-negative integer");
  }
  return value as number;
}

function readStringArray(value: unknown, path: string): readonly string[] {
  return Object.freeze(
    readArray(value, path).map((item, index) => readString(item, `${path}[${index}]`)),
  );
}

function ownSlots(owner: JsonObject, path: string): JsonObject {
  if (!Object.hasOwn(owner, "slots")) return Object.freeze({});
  return readObject(owner.slots, `${path}.slots`);
}

function projectSlotContracts(
  contract: JsonObject,
  path: string,
): readonly AuthoringSlotContract[] {
  const slots: JsonObject = Object.hasOwn(contract, "slots")
    ? readObject(contract.slots, `${path}.slots`)
    : Object.freeze({});
  return Object.freeze(
    Object.keys(slots)
      .sort(compareText)
      .map((slotName) => {
        const slotPath = `${path}.slots[${JSON.stringify(slotName)}]`;
        const slot = readObject(slots[slotName], slotPath);
        const required = Object.hasOwn(slot, "required")
          ? readBoolean(slot.required, `${slotPath}.required`)
          : false;
        const minimum = Object.hasOwn(slot, "minItems")
          ? readNonNegativeInteger(slot.minItems, `${slotPath}.minItems`)
          : required
            ? 1
            : 0;
        const maximum = Object.hasOwn(slot, "maxItems")
          ? readNonNegativeInteger(slot.maxItems, `${slotPath}.maxItems`)
          : null;
        const acceptedCapabilityIds = Object.hasOwn(slot, "accepts")
          ? readStringArray(slot.accepts, `${slotPath}.accepts`)
          : Object.freeze([]);
        const acceptedCategories = Object.hasOwn(slot, "acceptsCategories")
          ? readStringArray(slot.acceptsCategories, `${slotPath}.acceptsCategories`)
          : Object.freeze([]);
        return Object.freeze({
          name: slotName,
          required,
          minimum,
          maximum,
          constrainsChildren:
            Object.hasOwn(slot, "accepts") || Object.hasOwn(slot, "acceptsCategories"),
          acceptedCapabilityIds,
          acceptedCategories,
          description: optionalString(slot.description),
        });
      }),
  );
}

function projectCapabilityMetadata(
  capabilityId: string,
  contractValue: unknown,
  path: string,
): CapabilityMetadata {
  const contract = readObject(contractValue, path);
  const authoring = optionalObject(contract.authoring);
  return Object.freeze({
    displayName: optionalString(authoring?.displayName) ?? capabilityId,
    slotContracts: projectSlotContracts(contract, path),
  });
}

function projectComponent(componentId: string, contractValue: unknown): CatalogComponentSummary {
  const path = `catalog.components[${JSON.stringify(componentId)}]`;
  const contract = readObject(contractValue, path);
  const authoring = optionalObject(contract.authoring);
  const semanticCategory = optionalString(contract.category);
  const inspector = deriveComponentInspectorControls(
    registerComponent({
      id: componentId,
      manifest: contract as ComponentManifest,
    }),
  );
  return Object.freeze({
    id: componentId,
    displayName: optionalString(authoring?.displayName) ?? componentId,
    authoringCategory: optionalString(authoring?.category) ?? semanticCategory ?? "Other",
    semanticCategory,
    description: optionalString(contract.description),
    defaultProps: optionalObject(authoring?.defaultProps) ?? Object.freeze({}),
    slotContracts: projectSlotContracts(contract, path),
    inspector,
  });
}

interface OwnerInspectionWork {
  readonly depth: number;
  readonly kind: "behavior" | "component";
  readonly owner: JsonObject;
  readonly path: string;
}

interface SurfaceReadBudget {
  scheduledIdentityOccurrences: number;
}

function scheduleOwnerInspection(
  pending: OwnerInspectionWork[],
  budget: SurfaceReadBudget,
  ownerValue: unknown,
  path: string,
  depth: number,
  kind: OwnerInspectionWork["kind"],
): void {
  if (
    budget.scheduledIdentityOccurrences >= AUTHORING_READ_LIMITS.maxIdentityOccurrencesPerSurface ||
    depth > AUTHORING_READ_LIMITS.maxSourceTreeDepth
  ) {
    throw new AuthoringProjectionLimitError();
  }
  budget.scheduledIdentityOccurrences += 1;
  pending.push({ depth, kind, owner: readObject(ownerValue, path), path });
}

function scheduleSlotChildren(
  pending: OwnerInspectionWork[],
  budget: SurfaceReadBudget,
  owner: JsonObject,
  path: string,
  depth: number,
): void {
  const slots = ownSlots(owner, path);
  const slotNames = Object.keys(slots).sort(compareText);
  for (let slotIndex = slotNames.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slotName = slotNames[slotIndex];
    if (slotName === undefined) continue;
    const slotPath = `${path}.slots[${JSON.stringify(slotName)}]`;
    const children = readArray(slots[slotName], slotPath);
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      const childPath = `${slotPath}[${childIndex}]`;
      scheduleOwnerInspection(
        pending,
        budget,
        children[childIndex],
        childPath,
        depth + 1,
        "component",
      );
    }
  }
}

function enforceSurfaceReadLimits(rootValue: unknown, path: string): void {
  const pending: OwnerInspectionWork[] = [];
  const budget: SurfaceReadBudget = { scheduledIdentityOccurrences: 0 };
  scheduleOwnerInspection(pending, budget, rootValue, path, 0, "component");

  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;

    scheduleSlotChildren(pending, budget, work.owner, work.path, work.depth);
    if (work.kind !== "component" || !Object.hasOwn(work.owner, "behaviors")) continue;
    const behaviors = readArray(work.owner.behaviors, `${work.path}.behaviors`);
    for (let index = behaviors.length - 1; index >= 0; index -= 1) {
      const behaviorPath = `${work.path}.behaviors[${index}]`;
      scheduleOwnerInspection(
        pending,
        budget,
        behaviors[index],
        behaviorPath,
        work.depth,
        "behavior",
      );
    }
  }
}

function projectSlots(
  owner: JsonObject,
  path: string,
  componentsById: ReadonlyMap<string, CapabilityMetadata>,
  behaviorsById: ReadonlyMap<string, CapabilityMetadata>,
  depth: number,
): readonly AuthoringLayerSlot[] {
  const slots = ownSlots(owner, path);
  return Object.freeze(
    Object.keys(slots)
      .sort(compareText)
      .map((slotName) => {
        const slotPath = `${path}.slots[${JSON.stringify(slotName)}]`;
        const children = readArray(slots[slotName], slotPath).map((child, index) =>
          projectLayerNode(
            child,
            `${slotPath}[${index}]`,
            componentsById,
            behaviorsById,
            depth + 1,
          ),
        );
        return Object.freeze({ name: slotName, children: Object.freeze(children) });
      }),
  );
}

function projectBehavior(
  value: unknown,
  path: string,
  componentsById: ReadonlyMap<string, CapabilityMetadata>,
  behaviorsById: ReadonlyMap<string, CapabilityMetadata>,
  depth: number,
): AuthoringBehaviorLayer {
  const behavior = readObject(value, path);
  const capabilityId = readString(behavior.use, `${path}.use`);
  const metadata = behaviorsById.get(capabilityId);
  if (metadata === undefined) {
    return fail(
      `${path}.use`,
      `a behavior declared by the validated Catalog; received ${capabilityId}`,
    );
  }
  return Object.freeze({
    kind: "behavior",
    id: readString(behavior.id, `${path}.id`),
    capabilityId,
    displayName: metadata.displayName,
    conditional: Object.hasOwn(behavior, "when"),
    slotContracts: metadata.slotContracts,
    slots: projectSlots(behavior, path, componentsById, behaviorsById, depth),
  });
}

function projectLayerNode(
  value: unknown,
  path: string,
  componentsById: ReadonlyMap<string, CapabilityMetadata>,
  behaviorsById: ReadonlyMap<string, CapabilityMetadata>,
  depth: number,
): AuthoringLayerNode {
  const node = readObject(value, path);
  const capabilityId = readString(node.use, `${path}.use`);
  const metadata = componentsById.get(capabilityId);
  if (metadata === undefined) {
    return fail(
      `${path}.use`,
      `a component declared by the validated Catalog; received ${capabilityId}`,
    );
  }
  const behaviors = Object.hasOwn(node, "behaviors")
    ? readArray(node.behaviors, `${path}.behaviors`).map((behavior, index) =>
        projectBehavior(
          behavior,
          `${path}.behaviors[${index}]`,
          componentsById,
          behaviorsById,
          depth,
        ),
      )
    : [];
  return Object.freeze({
    kind: "component",
    id: readString(node.id, `${path}.id`),
    capabilityId,
    displayName: metadata.displayName,
    conditional: Object.hasOwn(node, "when"),
    props: Object.hasOwn(node, "props")
      ? readObject(node.props, `${path}.props`)
      : Object.freeze({}),
    behaviors: Object.freeze(behaviors),
    slotContracts: metadata.slotContracts,
    slots: projectSlots(node, path, componentsById, behaviorsById, depth),
  });
}

/**
 * Creates a bounded read model only after the exact Catalog and Source pass cumulative validation.
 *
 * No partial model is returned on validation, catalog-resolution, or authoring-read-limit failure.
 */
export function prepareCatalogAuthoringModel(
  catalogValue: unknown,
  sourceValue: unknown,
): CatalogAuthoringModelResult {
  const catalogSet = validateDesenInteractionCatalogSet([catalogValue]);
  if (!catalogSet.valid) {
    return Object.freeze({ ok: false, reason: "catalog-invalid" });
  }
  const sourceResult = validateDesenSourceInteractionContracts(sourceValue, catalogSet.value);
  if (!sourceResult.valid) {
    return Object.freeze({ ok: false, reason: "source-invalid" });
  }

  try {
    const catalog = readObject(catalogSet.value[0], "catalog");
    const source = readObject(sourceResult.value, "source");
    const componentEntries = Object.entries(readObject(catalog.components, "catalog.components"));
    const behaviorEntries = Object.entries(optionalObject(catalog.behaviors) ?? Object.freeze({}));
    const components = Object.freeze(
      componentEntries
        .map(([componentId, component]) => projectComponent(componentId, component))
        .sort((left, right) => compareText(left.displayName, right.displayName)),
    );
    const componentsById = new Map(
      componentEntries.map(([componentId, component]) => [
        componentId,
        projectCapabilityMetadata(
          componentId,
          component,
          `catalog.components[${JSON.stringify(componentId)}]`,
        ),
      ]),
    );
    const behaviorsById = new Map(
      behaviorEntries.map(([behaviorId, behavior]) => [
        behaviorId,
        projectCapabilityMetadata(
          behaviorId,
          behavior,
          `catalog.behaviors[${JSON.stringify(behaviorId)}]`,
        ),
      ]),
    );
    const surfaces = Object.entries(readObject(source.surfaces, "source.surfaces"))
      .sort(([left], [right]) => compareText(left, right))
      .map(([surfaceId, surfaceValue]) => {
        const surfacePath = `source.surfaces[${JSON.stringify(surfaceId)}]`;
        const surface = readObject(surfaceValue, surfacePath);
        enforceSurfaceReadLimits(surface.root, `${surfacePath}.root`);
        return Object.freeze({
          id: surfaceId,
          root: projectLayerNode(
            surface.root,
            `${surfacePath}.root`,
            componentsById,
            behaviorsById,
            0,
          ),
        });
      });

    return Object.freeze({
      ok: true,
      model: Object.freeze({
        catalog: Object.freeze({
          id: readString(catalog.id, "catalog.id"),
          version: readString(catalog.version, "catalog.version"),
          target: readString(catalog.target, "catalog.target"),
        }),
        components,
        surfaces: Object.freeze(surfaces),
        validationCatalogs: catalogSet.value,
        validationDocument: sourceResult.value,
      }),
    });
  } catch (error) {
    if (error instanceof AuthoringProjectionLimitError) {
      return Object.freeze({ ok: false, reason: "projection-limit" });
    }
    throw error;
  }
}

const referenceAuthoringResult = prepareCatalogAuthoringModel(
  referenceCatalog,
  officialSignInSource,
);
if (!referenceAuthoringResult.ok) {
  throw new TypeError(`Reference authoring fixture rejected: ${referenceAuthoringResult.reason}.`);
}

/** Validator-authenticated reference Catalog and official Source projected for M09-T02. */
export const REFERENCE_AUTHORING_MODEL = referenceAuthoringResult.model;
