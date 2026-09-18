import { deriveComponentInspectorControls, registerComponent } from "@desen/catalog-sdk";
import { canonicalizeJson } from "@desen/protocol";
import {
  validateDesenInteractionCatalogSet,
  validateDesenSourceInteractionContracts,
} from "@desen/validator";

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
  catalogValues: unknown,
): AuthoringCanvasFrameProjection {
  if (typeof surfaceId !== "string" || !AUTHORING_SURFACE_ID.test(surfaceId)) {
    return rejectedAuthoringCanvasFrame("surface-id-invalid");
  }

  let admittedDocument: unknown;
  try {
    const catalogSet = validateDesenInteractionCatalogSet(normalizeCatalogSetInput(catalogValues));
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

/**
 * One exact Catalog-declared semantic style part, retained as inert schema data for App-owned
 * authoring controls. This is not a CSS escape hatch: callers must still address only a declared
 * property through a separately validated authoring boundary.
 */
export interface AuthoringStylePartContract {
  readonly name: string;
  readonly description: string | undefined;
  /** Detached, recursively frozen `propertiesSchema` for this exact declared part. */
  readonly propertiesSchema: JsonObject;
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
  /** Complete Catalog-declared semantic style parts in canonical name order. */
  readonly styleParts: readonly AuthoringStylePartContract[];
  /** Exact declared visual-state names in Catalog declaration order; `base` remains implicit. */
  readonly visualStates: readonly string[];
  /**
   * Exact Catalog-declared preview-adapter fidelity, if both the claim and its differences list
   * are well-formed. This deliberately avoids constructing an Inspector plan merely to render
   * the preview-fidelity disclosure.
   */
  readonly previewAdapter: CatalogPreviewAdapterDeclaration | undefined;
}

/** Cheap, inert preview-fidelity metadata projected without deriving Inspector controls. */
export interface CatalogPreviewAdapterDeclaration {
  readonly fidelity: "approximate" | "equivalent" | "same";
  readonly differences: readonly string[];
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

/** One exact identity in the validator-authenticated Catalog set. */
export interface CatalogAuthoringIdentity {
  readonly id: string;
  readonly version: string;
  readonly target: string;
}

/** Catalog identities, merged component library, and exact Source trees admitted for authoring. */
export interface CatalogAuthoringModel {
  /**
   * First Catalog identity retained for transitional single-Catalog presentation compatibility.
   * New composition code must use {@link catalogs} when identity completeness matters.
   */
  readonly catalog: CatalogAuthoringIdentity;
  /** Complete Catalog identities in validator-admitted input order. */
  readonly catalogs: readonly CatalogAuthoringIdentity[];
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

/**
 * Validator-admitted contracts are retained privately by the model identity, never surfaced as
 * caller-editable App data. Inspector derivation is intentionally deferred until an Inspector
 * selection asks for one exact component; normal canvas/library startup must not eagerly derive
 * every Catalog component's full schema-control tree.
 */
interface AdmittedInspectorRegistration {
  readonly id: string;
  readonly manifest: ComponentManifest;
}

const INSPECTOR_REGISTRATIONS_BY_MODEL = new WeakMap<
  CatalogAuthoringModel,
  ReadonlyMap<string, AdmittedInspectorRegistration>
>();
const INSPECTOR_PLANS_BY_MANIFEST = new WeakMap<object, ComponentInspectorControlPlan>();

function normalizeCatalogSetInput(catalogValueOrSet: unknown): readonly unknown[] {
  return Array.isArray(catalogValueOrSet) ? catalogValueOrSet : [catalogValueOrSet];
}

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

function deepFreezeJson(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeJson(item);
  } else {
    for (const key of Object.keys(value)) {
      deepFreezeJson((value as Record<string, unknown>)[key]);
    }
  }
  return Object.freeze(value);
}

/** Creates a detached immutable JSON-object snapshot after the Catalog validation boundary. */
function snapshotJsonObject(value: unknown, path: string): JsonObject {
  const snapshot = JSON.parse(canonicalizeJson(value)) as unknown;
  return deepFreezeJson(readObject(snapshot, path)) as JsonObject;
}

function projectCatalogIdentity(catalog: JsonObject, path: string): CatalogAuthoringIdentity {
  return Object.freeze({
    id: readString(catalog.id, `${path}.id`),
    version: readString(catalog.version, `${path}.version`),
    target: readString(catalog.target, `${path}.target`),
  });
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

function projectStyleParts(
  contract: JsonObject,
  path: string,
): readonly AuthoringStylePartContract[] {
  const styleParts: JsonObject = Object.hasOwn(contract, "styleParts")
    ? readObject(contract.styleParts, `${path}.styleParts`)
    : Object.freeze({});
  return Object.freeze(
    Object.keys(styleParts)
      .sort(compareText)
      .map((partName) => {
        const partPath = `${path}.styleParts[${JSON.stringify(partName)}]`;
        const part = readObject(styleParts[partName], partPath);
        return Object.freeze({
          name: partName,
          description: optionalString(part.description),
          propertiesSchema: snapshotJsonObject(
            part.propertiesSchema,
            `${partPath}.propertiesSchema`,
          ),
        });
      }),
  );
}

function projectVisualStates(contract: JsonObject, path: string): readonly string[] {
  if (!Object.hasOwn(contract, "visualStates")) return Object.freeze([]);
  // Declaration order is observable authoring intent, unlike map-key order for named style parts.
  return readStringArray(contract.visualStates, `${path}.visualStates`);
}

function projectPreviewAdapterDeclaration(
  contract: JsonObject,
): CatalogPreviewAdapterDeclaration | undefined {
  const authoring = optionalObject(contract.authoring);
  if (authoring === undefined || !Object.hasOwn(authoring, "adapterFidelity")) return undefined;
  const fidelity = authoring.adapterFidelity;
  if (fidelity !== "same" && fidelity !== "equivalent" && fidelity !== "approximate") {
    return undefined;
  }
  const differences = Object.hasOwn(authoring, "differences") ? authoring.differences : [];
  if (!Array.isArray(differences)) {
    return undefined;
  }
  if (!differences.every((difference) => typeof difference === "string")) {
    return undefined;
  }
  return Object.freeze({
    fidelity,
    differences: Object.freeze([...differences]),
  });
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

function projectComponent(
  componentId: string,
  contractValue: unknown,
  path: string,
): CatalogComponentSummary {
  const contract = readObject(contractValue, path);
  const authoring = optionalObject(contract.authoring);
  const semanticCategory = optionalString(contract.category);
  return Object.freeze({
    id: componentId,
    displayName: optionalString(authoring?.displayName) ?? componentId,
    authoringCategory: optionalString(authoring?.category) ?? semanticCategory ?? "Other",
    semanticCategory,
    description: optionalString(contract.description),
    defaultProps: optionalObject(authoring?.defaultProps) ?? Object.freeze({}),
    slotContracts: projectSlotContracts(contract, path),
    styleParts: projectStyleParts(contract, path),
    visualStates: projectVisualStates(contract, path),
    previewAdapter: projectPreviewAdapterDeclaration(contract),
  });
}

/**
 * Derives the schema-authoritative Inspector plan only for one previously admitted component.
 *
 * @remarks The model must come directly from {@link prepareCatalogAuthoringModel}; forged or
 * stale model-shaped values have no private registration binding and fail closed. The SDK remains
 * the sole registration and control-derivation authority, while each immutable manifest has at
 * most one cached plan for the lifetime of this module.
 */
export function resolveCatalogComponentInspector(
  model: CatalogAuthoringModel,
  componentId: string,
): ComponentInspectorControlPlan | undefined {
  const registrations = INSPECTOR_REGISTRATIONS_BY_MODEL.get(model);
  const registration = registrations?.get(componentId);
  if (registration === undefined) return undefined;

  const cached = INSPECTOR_PLANS_BY_MANIFEST.get(registration.manifest);
  if (cached !== undefined) return cached;

  try {
    const inspector = deriveComponentInspectorControls(
      registerComponent({
        id: registration.id,
        manifest: registration.manifest,
      }),
    );
    INSPECTOR_PLANS_BY_MANIFEST.set(registration.manifest, inspector);
    return inspector;
  } catch {
    return undefined;
  }
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
 * Creates a bounded read model only after the exact Catalog set and Source pass cumulative
 * validation.
 *
 * @remarks A single Catalog value remains accepted as shorthand for a one-entry set. Capabilities
 * from every admitted Catalog are merged only after set-wide uniqueness validation succeeds. No
 * partial model is returned on validation, catalog-resolution, or authoring-read-limit failure.
 */
export function prepareCatalogAuthoringModel(
  catalogValueOrSet: unknown,
  sourceValue: unknown,
): CatalogAuthoringModelResult {
  let catalogSet: ReturnType<typeof validateDesenInteractionCatalogSet>;
  try {
    catalogSet = validateDesenInteractionCatalogSet(normalizeCatalogSetInput(catalogValueOrSet));
  } catch {
    return Object.freeze({ ok: false, reason: "catalog-invalid" });
  }
  if (!catalogSet.valid) {
    return Object.freeze({ ok: false, reason: "catalog-invalid" });
  }
  let sourceResult: ReturnType<typeof validateDesenSourceInteractionContracts>;
  try {
    sourceResult = validateDesenSourceInteractionContracts(sourceValue, catalogSet.value);
  } catch {
    return Object.freeze({ ok: false, reason: "source-invalid" });
  }
  if (!sourceResult.valid) {
    return Object.freeze({ ok: false, reason: "source-invalid" });
  }

  try {
    const catalogs = catalogSet.value.map((catalogValue, index) =>
      readObject(catalogValue, `catalogs[${index}]`),
    );
    const catalog = catalogs[0];
    if (catalog === undefined) return Object.freeze({ ok: false, reason: "catalog-invalid" });
    const source = readObject(sourceResult.value, "source");
    const componentEntries = catalogs.flatMap((catalogEntry, catalogIndex) =>
      Object.entries(
        readObject(catalogEntry.components, `catalogs[${catalogIndex}].components`),
      ).map(([capabilityId, contract]) =>
        Object.freeze({
          capabilityId,
          contract,
          path: `catalogs[${catalogIndex}].components[${JSON.stringify(capabilityId)}]`,
        }),
      ),
    );
    const behaviorEntries = catalogs.flatMap((catalogEntry, catalogIndex) =>
      Object.entries(optionalObject(catalogEntry.behaviors) ?? Object.freeze({})).map(
        ([capabilityId, contract]) =>
          Object.freeze({
            capabilityId,
            contract,
            path: `catalogs[${catalogIndex}].behaviors[${JSON.stringify(capabilityId)}]`,
          }),
      ),
    );
    const components = Object.freeze(
      componentEntries
        .map(({ capabilityId, contract, path }) => projectComponent(capabilityId, contract, path))
        .sort(
          (left, right) =>
            compareText(left.displayName, right.displayName) || compareText(left.id, right.id),
        ),
    );
    const componentsById = new Map(
      componentEntries.map(({ capabilityId, contract, path }) => [
        capabilityId,
        projectCapabilityMetadata(capabilityId, contract, path),
      ]),
    );
    const behaviorsById = new Map(
      behaviorEntries.map(({ capabilityId, contract, path }) => [
        capabilityId,
        projectCapabilityMetadata(capabilityId, contract, path),
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

    const model: CatalogAuthoringModel = Object.freeze({
      catalog: projectCatalogIdentity(catalog, "catalogs[0]"),
      catalogs: Object.freeze(
        catalogs.map((catalogEntry, index) =>
          projectCatalogIdentity(catalogEntry, `catalogs[${index}]`),
        ),
      ),
      components,
      surfaces: Object.freeze(surfaces),
      validationCatalogs: catalogSet.value,
      validationDocument: sourceResult.value,
    });
    INSPECTOR_REGISTRATIONS_BY_MODEL.set(
      model,
      new Map(
        componentEntries.map(({ capabilityId, contract }) => [
          capabilityId,
          Object.freeze({ id: capabilityId, manifest: contract as ComponentManifest }),
        ]),
      ),
    );
    return Object.freeze({ ok: true, model });
  } catch (error) {
    if (error instanceof AuthoringProjectionLimitError) {
      return Object.freeze({ ok: false, reason: "projection-limit" });
    }
    throw error;
  }
}
