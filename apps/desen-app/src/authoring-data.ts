import referenceCatalog from "@desen/reference-catalog-web/catalog.json";
import { deriveComponentInspectorControls, registerComponent } from "@desen/catalog-sdk";
import {
  validateDesenInteractionCatalogSet,
  validateDesenSourceInteractionContracts,
} from "@desen/validator";

import officialSignInSource from "../../../examples/sign-in/official-derived.source.desen.json";

import type { ComponentInspectorControlPlan, ComponentManifest } from "@desen/catalog-sdk";

type JsonObject = Readonly<Record<string, unknown>>;

interface CapabilityMetadata {
  readonly displayName: string;
}

/** Authoring-safe component metadata projected from one exact Catalog component contract. */
export interface CatalogComponentSummary {
  readonly id: string;
  readonly displayName: string;
  readonly authoringCategory: string;
  readonly semanticCategory: string | undefined;
  readonly description: string | undefined;
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

function ownSlots(owner: JsonObject, path: string): JsonObject {
  if (!Object.hasOwn(owner, "slots")) return Object.freeze({});
  return readObject(owner.slots, `${path}.slots`);
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
