import type {
  AuthoringBehaviorLayer,
  AuthoringLayerNode,
  CatalogAuthoringModel,
} from "./authoring-data.js";
import type { AuthoringSlotRoute } from "./authoring-slots.js";

/** Conservative fidelity states exposed by the App for one preview surface. */
export type PreviewFidelityKind = "approximate" | "undeclared" | "equivalent" | "same";

/** Disclosure used when an approximate adapter omits its Catalog differences. */
export const APPROXIMATE_FIDELITY_FALLBACK =
  "The Catalog declares approximate adapter fidelity but provides no differences.";

const PREVIEW_PROJECT_ID = "account-app";

/** One unique component capability used by the selected Source surface. */
export interface PreviewFidelityEntry {
  readonly capabilityId: string;
  readonly displayName: string;
  readonly kind: PreviewFidelityKind;
  readonly differences: readonly string[];
}

/** Fail-closed, surface-local preview-fidelity projection. */
export type PreviewFidelityProjection =
  | Readonly<{ readonly status: "rejected" }>
  | Readonly<{
      readonly status: "ready";
      readonly kind: PreviewFidelityKind;
      readonly entries: readonly PreviewFidelityEntry[];
    }>;

const FIDELITY_PRECEDENCE: Readonly<Record<PreviewFidelityKind, number>> = Object.freeze({
  same: 0,
  equivalent: 1,
  undeclared: 2,
  approximate: 3,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownDataValue(
  record: Readonly<Record<string, unknown>>,
  key: string,
): { readonly present: boolean; readonly value: unknown } | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (descriptor === undefined) return Object.freeze({ present: false, value: undefined });
  if (descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
  return Object.freeze({ present: true, value: descriptor.value });
}

function captureRoute(route: AuthoringSlotRoute): AuthoringSlotRoute | undefined {
  if (!isRecord(route)) return undefined;
  const keys = Reflect.ownKeys(route);
  if (keys.length !== 2 || keys.some((key) => key !== "projectId" && key !== "surfaceId")) {
    return undefined;
  }
  const projectId = ownDataValue(route, "projectId");
  const surfaceId = ownDataValue(route, "surfaceId");
  if (
    projectId?.present !== true ||
    surfaceId?.present !== true ||
    typeof projectId.value !== "string" ||
    projectId.value.length === 0 ||
    typeof surfaceId.value !== "string" ||
    surfaceId.value.length === 0
  ) {
    return undefined;
  }
  return Object.freeze({ projectId: projectId.value, surfaceId: surfaceId.value });
}

function collectComponentCapabilityIds(root: AuthoringLayerNode): readonly string[] | undefined {
  const capabilityIds = new Set<string>();
  const visited = new WeakSet<object>();
  const pending: (AuthoringBehaviorLayer | AuthoringLayerNode)[] = [root];

  while (pending.length > 0) {
    const owner = pending.pop();
    if (owner === undefined) continue;
    if (!isRecord(owner)) return undefined;
    if (visited.has(owner)) continue;
    visited.add(owner);

    if (owner.kind === "component") {
      if (typeof owner.capabilityId !== "string" || owner.capabilityId.length === 0)
        return undefined;
      capabilityIds.add(owner.capabilityId);
      if (!Array.isArray(owner.behaviors)) return undefined;
      for (let index = owner.behaviors.length - 1; index >= 0; index -= 1) {
        const behavior = owner.behaviors[index];
        if (behavior === undefined) return undefined;
        pending.push(behavior);
      }
    } else if (owner.kind !== "behavior") {
      return undefined;
    }

    if (!Array.isArray(owner.slots)) return undefined;
    for (let slotIndex = owner.slots.length - 1; slotIndex >= 0; slotIndex -= 1) {
      const slot = owner.slots[slotIndex];
      if (slot === undefined || !Array.isArray(slot.children)) return undefined;
      for (let childIndex = slot.children.length - 1; childIndex >= 0; childIndex -= 1) {
        const child = slot.children[childIndex];
        if (child === undefined) return undefined;
        pending.push(child);
      }
    }
  }

  return Object.freeze([...capabilityIds].sort(compareText));
}

function readEntry(model: CatalogAuthoringModel, capabilityId: string): PreviewFidelityEntry {
  const matches = model.components.filter((component) => component.id === capabilityId);
  if (matches.length !== 1) {
    return Object.freeze({
      capabilityId,
      displayName: capabilityId,
      kind: "undeclared",
      differences: Object.freeze([]),
    });
  }

  const component = matches[0];
  const displayName =
    typeof component?.displayName === "string" && component.displayName.length > 0
      ? component.displayName
      : capabilityId;
  const authoring = component?.inspector.authoring;
  if (!isRecord(authoring)) {
    return Object.freeze({
      capabilityId,
      displayName,
      kind: "undeclared",
      differences: Object.freeze([]),
    });
  }

  const fidelityProperty = ownDataValue(authoring, "adapterFidelity");
  const differencesProperty = ownDataValue(authoring, "differences");
  const fidelity = fidelityProperty?.present === true ? fidelityProperty.value : undefined;
  const validFidelity =
    fidelity === "same" || fidelity === "equivalent" || fidelity === "approximate";
  const differencesValue = differencesProperty?.present === true ? differencesProperty.value : [];
  const validDifferences =
    differencesProperty !== undefined &&
    Array.isArray(differencesValue) &&
    differencesValue.every((difference) => typeof difference === "string");

  if (!validFidelity || !validDifferences) {
    const declaredDifferences = validDifferences
      ? Object.freeze([...differencesValue])
      : Object.freeze([]);
    return Object.freeze({
      capabilityId,
      displayName,
      kind: "undeclared",
      differences: declaredDifferences,
    });
  }

  const differences =
    fidelity === "approximate" && differencesValue.length === 0
      ? Object.freeze([APPROXIMATE_FIDELITY_FALLBACK])
      : Object.freeze([...differencesValue]);
  return Object.freeze({ capabilityId, displayName, kind: fidelity, differences });
}

/**
 * Projects the complete Catalog-declared adapter fidelity for components present on one surface.
 *
 * @remarks This reads only the public authoring model. It never traverses validation Catalogs,
 * validation Source data, a runtime registry, React elements, or private adapter state.
 */
export function projectPreviewFidelity(
  model: CatalogAuthoringModel,
  route: AuthoringSlotRoute,
): PreviewFidelityProjection {
  try {
    const capturedRoute = captureRoute(route);
    if (
      capturedRoute === undefined ||
      capturedRoute.projectId !== PREVIEW_PROJECT_ID ||
      !Array.isArray(model.surfaces)
    ) {
      return Object.freeze({ status: "rejected" });
    }
    const surfaces = model.surfaces.filter((surface) => surface.id === capturedRoute.surfaceId);
    if (surfaces.length !== 1) return Object.freeze({ status: "rejected" });
    const surface = surfaces[0];
    if (surface === undefined) return Object.freeze({ status: "rejected" });

    const capabilityIds = collectComponentCapabilityIds(surface.root);
    if (
      capabilityIds === undefined ||
      capabilityIds.length === 0 ||
      !Array.isArray(model.components)
    ) {
      return Object.freeze({ status: "rejected" });
    }
    const entries = Object.freeze(
      capabilityIds.map((capabilityId) => readEntry(model, capabilityId)),
    );
    const kind = entries.reduce<PreviewFidelityKind>(
      (current, entry) =>
        FIDELITY_PRECEDENCE[entry.kind] > FIDELITY_PRECEDENCE[current] ? entry.kind : current,
      "same",
    );
    return Object.freeze({ status: "ready", kind, entries });
  } catch {
    return Object.freeze({ status: "rejected" });
  }
}
