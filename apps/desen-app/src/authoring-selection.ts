import type { RuntimeReactDiagnosticIndex } from "@desen/runtime-react";
import type { AuthoringLayerNode, CatalogAuthoringModel } from "./authoring-data.js";

/** Inert App-owned identity for one selected Source component on an exact project route. */
export interface AuthoringComponentSelection {
  readonly kind: "component";
  readonly projectId: string;
  readonly surfaceId: string;
  readonly sourceNodeId: string;
  readonly capabilityId: string;
  readonly displayName: string;
  readonly conditional: boolean;
}

/** Callback-free runtime identity snapshot admitted by the selection projector. */
export interface AuthoringRenderedIdentitySnapshot {
  readonly surfaceId: string;
  readonly diagnosticIndex: RuntimeReactDiagnosticIndex;
}

/** Honest rendering state for one route-valid authoring selection. */
export type AuthoringSelectionProjection =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | Readonly<{ readonly status: "unavailable"; readonly selection: AuthoringComponentSelection }>
  | Readonly<{
      readonly status: "not-materialized";
      readonly selection: AuthoringComponentSelection;
    }>
  | Readonly<{
      readonly status: "materialized";
      readonly selection: AuthoringComponentSelection;
      readonly runtimeNodeIds: readonly string[];
    }>;

/** Creates a frozen component selection without retaining events, React values, or DOM objects. */
export function createAuthoringComponentSelection(
  input: Omit<AuthoringComponentSelection, "kind">,
): AuthoringComponentSelection {
  function requiredText(value: string, name: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`Authoring selection ${name} must be a non-empty string.`);
    }
    return value;
  }

  if (typeof input.conditional !== "boolean") {
    throw new TypeError("Authoring selection conditional must be a boolean.");
  }
  return Object.freeze({
    kind: "component",
    projectId: requiredText(input.projectId, "projectId"),
    surfaceId: requiredText(input.surfaceId, "surfaceId"),
    sourceNodeId: requiredText(input.sourceNodeId, "sourceNodeId"),
    capabilityId: requiredText(input.capabilityId, "capabilityId"),
    displayName: requiredText(input.displayName, "displayName"),
    conditional: input.conditional,
  });
}

/** Returns whether two selections identify the same exact authored component. */
export function isSameAuthoringComponentSelection(
  left: AuthoringComponentSelection | null,
  right: AuthoringComponentSelection,
): boolean {
  return (
    left !== null &&
    left.kind === right.kind &&
    left.projectId === right.projectId &&
    left.surfaceId === right.surfaceId &&
    left.sourceNodeId === right.sourceNodeId &&
    left.capabilityId === right.capabilityId &&
    left.displayName === right.displayName &&
    left.conditional === right.conditional
  );
}

function scheduleSlotChildren(pending: AuthoringLayerNode[], node: AuthoringLayerNode): void {
  for (const slot of node.slots) {
    for (const child of slot.children) pending.push(child);
  }
  for (const behavior of node.behaviors) {
    for (const slot of behavior.slots) {
      for (const child of slot.children) pending.push(child);
    }
  }
}

function isExactKnownSelection(
  selection: AuthoringComponentSelection,
  model: CatalogAuthoringModel,
): boolean {
  const surface = model.surfaces.find(({ id }) => id === selection.surfaceId);
  if (surface === undefined) return false;

  const pending = [surface.root];
  let exactMatches = 0;
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (node.id === selection.sourceNodeId) {
      if (
        node.capabilityId !== selection.capabilityId ||
        node.displayName !== selection.displayName ||
        node.conditional !== selection.conditional
      ) {
        return false;
      }
      exactMatches += 1;
    }
    scheduleSlotChildren(pending, node);
  }
  return exactMatches === 1;
}

/**
 * Projects a stable Source selection through the public callback-free runtime diagnostic index.
 *
 * @remarks The projector deliberately accepts no React element, platform handle, DOM node, style,
 * geometry, registry, session, prop, slot, or callback. Unknown and stale identities fail closed.
 */
export function projectAuthoringSelection(
  selection: AuthoringComponentSelection | null,
  route: Readonly<{ readonly projectId: string; readonly surfaceId: string }>,
  model: CatalogAuthoringModel,
  rendered: AuthoringRenderedIdentitySnapshot | undefined,
): AuthoringSelectionProjection {
  if (selection === null) return Object.freeze({ status: "idle" });
  if (
    selection.kind !== "component" ||
    selection.projectId !== route.projectId ||
    selection.surfaceId !== route.surfaceId ||
    !isExactKnownSelection(selection, model)
  ) {
    return Object.freeze({ status: "rejected" });
  }
  if (rendered === undefined) {
    return Object.freeze({ status: "unavailable", selection });
  }
  if (rendered.surfaceId !== route.surfaceId) {
    return Object.freeze({ status: "rejected" });
  }

  const runtimeNodeIds =
    rendered.diagnosticIndex.runtimeNodeIdsBySourceNodeId[selection.sourceNodeId];
  if (runtimeNodeIds === undefined) {
    return selection.conditional
      ? Object.freeze({ status: "not-materialized", selection })
      : Object.freeze({ status: "rejected" });
  }

  const componentRuntimeNodeIds: string[] = [];
  for (const runtimeNodeId of runtimeNodeIds) {
    const entry = rendered.diagnosticIndex.byRuntimeNodeId[runtimeNodeId];
    if (entry?.kind !== "component") continue;
    if (
      entry.sourceNodeId !== selection.sourceNodeId ||
      entry.capabilityId !== selection.capabilityId
    ) {
      return Object.freeze({ status: "rejected" });
    }
    componentRuntimeNodeIds.push(runtimeNodeId);
  }

  if (componentRuntimeNodeIds.length === 0) {
    return Object.freeze({ status: "rejected" });
  }
  return Object.freeze({
    status: "materialized",
    selection,
    runtimeNodeIds: Object.freeze(componentRuntimeNodeIds),
  });
}
