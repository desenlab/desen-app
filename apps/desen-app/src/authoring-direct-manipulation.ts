import type { CatalogAuthoringModel, AuthoringLayerNode } from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

/** The bounded, App-owned viewport state for a Design canvas. It never enters Source. */
export interface AuthoringCanvasViewport {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

/**
 * An App-only preview frame size. It is deliberately distinct from Source canvas metadata:
 * resizing it changes neither an authored surface nor an adapter-rendered component.
 */
export interface AuthoringCanvasPreviewFrame {
  readonly width: number;
  readonly height: number;
}

/** A route-bound, callback-free group selection projected from the current Source tree. */
export interface AuthoringDirectManipulationSelection {
  readonly primary: AuthoringComponentSelection;
  readonly selections: readonly AuthoringComponentSelection[];
  readonly sourceNodeIds: readonly string[];
}

/** Honest outcome for a current direct-manipulation selection projection. */
export type AuthoringDirectManipulationSelectionProjection =
  | Readonly<{ readonly status: "idle" }>
  | Readonly<{ readonly status: "rejected" }>
  | Readonly<{
      readonly status: "ready";
      readonly selection: AuthoringDirectManipulationSelection;
    }>;

export const AUTHORING_CANVAS_MIN_ZOOM = 0.5;
export const AUTHORING_CANVAS_MAX_ZOOM = 2;
export const AUTHORING_CANVAS_PAN_LIMIT = 2_048;
export const AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS = Object.freeze({
  maxHeight: 16_384,
  maxWidth: 16_384,
  minHeight: 1,
  minWidth: 1,
});
const ZOOM_STEPS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 2]);
const MAX_SELECTION_SIZE = 256;

function validFinite(value: unknown, limit: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
}

function exactViewport(value: AuthoringCanvasViewport): AuthoringCanvasViewport | undefined {
  if (
    !validFinite(value.zoom, AUTHORING_CANVAS_MAX_ZOOM) ||
    value.zoom < AUTHORING_CANVAS_MIN_ZOOM ||
    !validFinite(value.panX, AUTHORING_CANVAS_PAN_LIMIT) ||
    !validFinite(value.panY, AUTHORING_CANVAS_PAN_LIMIT)
  ) {
    return undefined;
  }
  return Object.freeze({ panX: value.panX, panY: value.panY, zoom: value.zoom });
}

/** Creates a bounded viewport from inert numeric state only. */
export function createAuthoringCanvasViewport(
  input: Readonly<Partial<AuthoringCanvasViewport>> = Object.freeze({}),
): AuthoringCanvasViewport {
  const candidate = {
    panX: input.panX ?? 0,
    panY: input.panY ?? 0,
    zoom: input.zoom ?? 1,
  } satisfies AuthoringCanvasViewport;
  const captured = exactViewport(candidate);
  if (captured === undefined)
    throw new TypeError("Canvas viewport must use bounded finite values.");
  return captured;
}

/** Pans an exact viewport without persisting geometry or changing authored Source. */
export function panAuthoringCanvasViewport(
  viewport: AuthoringCanvasViewport,
  delta: Readonly<{ readonly x: number; readonly y: number }>,
): AuthoringCanvasViewport {
  const captured = exactViewport(viewport);
  if (
    captured === undefined ||
    !validFinite(delta.x, AUTHORING_CANVAS_PAN_LIMIT) ||
    !validFinite(delta.y, AUTHORING_CANVAS_PAN_LIMIT)
  ) {
    throw new TypeError("Canvas pan requires an exact viewport and bounded finite delta.");
  }
  return createAuthoringCanvasViewport({
    panX: Math.max(
      -AUTHORING_CANVAS_PAN_LIMIT,
      Math.min(AUTHORING_CANVAS_PAN_LIMIT, captured.panX + delta.x),
    ),
    panY: Math.max(
      -AUTHORING_CANVAS_PAN_LIMIT,
      Math.min(AUTHORING_CANVAS_PAN_LIMIT, captured.panY + delta.y),
    ),
    zoom: captured.zoom,
  });
}

/** Moves to the next reviewed zoom step while leaving the ephemeral viewport pan intact. */
export function zoomAuthoringCanvasViewport(
  viewport: AuthoringCanvasViewport,
  direction: "in" | "out",
): AuthoringCanvasViewport {
  const captured = exactViewport(viewport);
  if (captured === undefined) throw new TypeError("Canvas zoom requires an exact viewport.");
  const currentIndex = ZOOM_STEPS.indexOf(captured.zoom);
  const nearestIndex =
    currentIndex >= 0
      ? currentIndex
      : ZOOM_STEPS.reduce(
          (nearest, candidate, index) =>
            Math.abs(candidate - captured.zoom) <
            Math.abs((ZOOM_STEPS[nearest] ?? captured.zoom) - captured.zoom)
              ? index
              : nearest,
          0,
        );
  const nextIndex = Math.max(
    0,
    Math.min(ZOOM_STEPS.length - 1, nearestIndex + (direction === "in" ? 1 : -1)),
  );
  const nextZoom = ZOOM_STEPS[nextIndex];
  if (nextZoom === undefined) throw new TypeError("Canvas zoom step is unavailable.");
  return createAuthoringCanvasViewport({
    panX: captured.panX,
    panY: captured.panY,
    zoom: nextZoom,
  });
}

/** Restores the Design canvas view without changing source selection or authored data. */
export function resetAuthoringCanvasViewport(): AuthoringCanvasViewport {
  return createAuthoringCanvasViewport();
}

function exactPreviewFrame(
  value: AuthoringCanvasPreviewFrame,
): AuthoringCanvasPreviewFrame | undefined {
  if (
    !Number.isSafeInteger(value.width) ||
    value.width < AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.minWidth ||
    value.width > AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.maxWidth ||
    !Number.isSafeInteger(value.height) ||
    value.height < AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.minHeight ||
    value.height > AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.maxHeight
  ) {
    return undefined;
  }
  return Object.freeze({ height: value.height, width: value.width });
}

/** Validates inert preview dimensions without writing the declared Source frame. */
export function createAuthoringCanvasPreviewFrame(
  input: AuthoringCanvasPreviewFrame,
): AuthoringCanvasPreviewFrame {
  const captured = exactPreviewFrame(input);
  if (captured === undefined) {
    throw new TypeError("Canvas preview frame must use bounded positive integer dimensions.");
  }
  return captured;
}

/**
 * Resizes only the App preview frame. The bounded result is safe for CSS layout and remains
 * separate from Source; T12 owns authored responsive and component-sizing edits.
 */
export function resizeAuthoringCanvasPreviewFrame(
  frame: AuthoringCanvasPreviewFrame,
  delta: Readonly<{ readonly width: number; readonly height: number }>,
): AuthoringCanvasPreviewFrame {
  const captured = exactPreviewFrame(frame);
  if (
    captured === undefined ||
    !Number.isSafeInteger(delta.width) ||
    !Number.isSafeInteger(delta.height)
  ) {
    throw new TypeError("Canvas preview resize requires exact bounded integer dimensions.");
  }
  return createAuthoringCanvasPreviewFrame({
    width: Math.max(
      AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.minWidth,
      Math.min(AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.maxWidth, captured.width + delta.width),
    ),
    height: Math.max(
      AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.minHeight,
      Math.min(AUTHORING_CANVAS_PREVIEW_FRAME_LIMITS.maxHeight, captured.height + delta.height),
    ),
  });
}

function scheduleChildren(pending: AuthoringLayerNode[], node: AuthoringLayerNode): void {
  for (const slot of [...node.slots].reverse()) {
    for (const child of [...slot.children].reverse()) pending.push(child);
  }
  for (const behavior of [...node.behaviors].reverse()) {
    for (const slot of [...behavior.slots].reverse()) {
      for (const child of [...slot.children].reverse()) pending.push(child);
    }
  }
}

function sourceNodes(
  model: CatalogAuthoringModel,
  surfaceId: string,
): readonly AuthoringLayerNode[] | undefined {
  const surface = model.surfaces.find((candidate) => candidate.id === surfaceId);
  if (surface === undefined) return undefined;
  const nodes: AuthoringLayerNode[] = [];
  const pending = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    nodes.push(node);
    scheduleChildren(pending, node);
  }
  return Object.freeze(nodes);
}

function exactSelectionMatchesNode(
  selection: AuthoringComponentSelection,
  route: Readonly<{ readonly projectId: string; readonly surfaceId: string }>,
  node: AuthoringLayerNode,
): boolean {
  return (
    selection.kind === "component" &&
    selection.projectId === route.projectId &&
    selection.surfaceId === route.surfaceId &&
    selection.sourceNodeId === node.id &&
    selection.capabilityId === node.capabilityId &&
    selection.displayName === node.displayName &&
    selection.conditional === node.conditional
  );
}

/**
 * Re-authorizes a multi-selection against one current Source surface.
 *
 * @remarks This accepts no DOM, runtime identity, geometry, adapter instance, or callback. A stale
 * selection is rejected as a whole rather than silently dropping one selected layer.
 */
export function projectAuthoringDirectManipulationSelection(
  selections: readonly AuthoringComponentSelection[],
  route: Readonly<{ readonly projectId: string; readonly surfaceId: string }>,
  model: CatalogAuthoringModel,
): AuthoringDirectManipulationSelectionProjection {
  if (!Array.isArray(selections) || selections.length > MAX_SELECTION_SIZE) {
    return Object.freeze({ status: "rejected" });
  }
  if (selections.length === 0) return Object.freeze({ status: "idle" });
  const nodes = sourceNodes(model, route.surfaceId);
  if (nodes === undefined) return Object.freeze({ status: "rejected" });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const byNodeId = new Map<string, AuthoringComponentSelection>();
  for (const selection of selections) {
    const node = nodeById.get(selection.sourceNodeId);
    if (
      node === undefined ||
      byNodeId.has(selection.sourceNodeId) ||
      !exactSelectionMatchesNode(selection, route, node)
    ) {
      return Object.freeze({ status: "rejected" });
    }
    byNodeId.set(selection.sourceNodeId, selection);
  }
  const orderedSelections = nodes
    .map((node) => byNodeId.get(node.id))
    .filter((selection): selection is AuthoringComponentSelection => selection !== undefined);
  const primary = selections.at(-1);
  if (primary === undefined || !byNodeId.has(primary.sourceNodeId)) {
    return Object.freeze({ status: "rejected" });
  }
  return Object.freeze({
    status: "ready",
    selection: Object.freeze({
      primary,
      selections: Object.freeze(orderedSelections),
      sourceNodeIds: Object.freeze(orderedSelections.map(({ sourceNodeId }) => sourceNodeId)),
    }),
  });
}

/** Adds or removes an exact layer identity without retaining a platform event or DOM reference. */
export function toggleAuthoringDirectManipulationSelection(
  current: readonly AuthoringComponentSelection[],
  candidate: AuthoringComponentSelection,
  extend: boolean,
): readonly AuthoringComponentSelection[] {
  if (!extend) return Object.freeze([candidate]);
  const currentIndex = current.findIndex(
    ({ sourceNodeId }) => sourceNodeId === candidate.sourceNodeId,
  );
  if (currentIndex < 0) return Object.freeze([...current, candidate]);
  return Object.freeze(current.filter((_, index) => index !== currentIndex));
}
