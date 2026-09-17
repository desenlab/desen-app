import {
  createDesenEditorContinuousValidator,
  deleteDesenEditorNode,
  insertDesenEditorNode,
  moveDesenEditorNode,
  reorderDesenEditorNode,
  setDesenEditorOwnerProp,
} from "@desen/editor-core";
import { canonicalizeJsonBytes } from "@desen/protocol";

import { prepareCatalogAuthoringModel } from "./authoring-data.js";

import type { JsonValue } from "@desen/catalog-sdk";
import type {
  DesenEditorContentValue,
  DesenEditorContinuousValidationReport,
  DesenEditorDocument,
} from "@desen/editor-core";
import type {
  AuthoringBehaviorLayer,
  AuthoringLayerNode,
  AuthoringSlotContract,
  CatalogAuthoringModel,
  CatalogComponentSummary,
} from "./authoring-data.js";
import type { AuthoringComponentSelection } from "./authoring-selection.js";

const SLOT_INSERT_PROFILE = Object.freeze({
  maxDefaultPropTransitions: 256,
  maxAggregateSnapshotWorkBytes: 33_554_432,
});

const VALIDATOR_BY_MODEL = new WeakMap<
  CatalogAuthoringModel,
  ReturnType<typeof createDesenEditorContinuousValidator>
>();

type InsertionAdmissionCacheEntry = Readonly<{
  readonly maximumIndex: number;
  readonly compatibility: AuthoringSlotInsertionCompatibility;
}>;

type PlacementAdmissionBase =
  | Extract<AuthoringSlotPlacementCompatibility, { readonly accepted: false }>
  | Readonly<{
      readonly accepted: true;
      readonly operation: "move" | "reorder";
      readonly sourceIndex: number;
    }>;

type PlacementAdmissionCacheEntry = Readonly<{
  readonly maximumIndex: number;
  readonly base: PlacementAdmissionBase;
}>;

const INSERTION_ADMISSION_BY_MODEL = new WeakMap<
  CatalogAuthoringModel,
  Map<string, InsertionAdmissionCacheEntry>
>();
const PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<
  CatalogAuthoringModel,
  Map<string, PlacementAdmissionCacheEntry>
>();
const BATCH_PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<
  CatalogAuthoringModel,
  Map<string, Readonly<{ readonly accepted: boolean }>>
>();
const BATCH_PLACEMENT_ADMISSION_CACHE_LIMIT = 256;

/** Exact App route that may authorize named-slot manipulation. */
export interface AuthoringSlotRoute {
  readonly projectId: string;
  readonly surfaceId: string;
}

/** Stable App-owned identity for one Catalog-declared Source slot. */
export interface AuthoringSlotSelection {
  readonly kind: "slot";
  readonly projectId: string;
  readonly surfaceId: string;
  readonly ownerKind: "behavior" | "component";
  readonly ownerId: string;
  readonly ownerCapabilityId: string;
  readonly slot: string;
}

/** One exact insertion or existing-node placement request from App-owned authoring chrome. */
export type AuthoringSlotEdit =
  | Readonly<{ readonly kind: "insert"; readonly componentId: string; readonly index: number }>
  | Readonly<{ readonly kind: "place"; readonly nodeId: string; readonly index: number }>;

/** Maximum number of independently re-authorized nodes in one direct-manipulation transaction. */
export const AUTHORING_SLOT_BATCH_PLACEMENT_MAX_NODES = 256;

/** Stable operation selected after current Source placement is re-derived. */
export type AuthoringSlotOperation = "delete" | "insert" | "move" | "reorder";

/** Successful atomic named-slot mutation over one fresh immutable Source. */
export interface AuthoringSlotEditSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly nodeId: string;
  readonly operation: AuthoringSlotOperation;
}

/** UI-safe reason why a named-slot request produced no Source. */
export type AuthoringSlotEditFailureReason =
  | "acceptance-rejected"
  | "cardinality-rejected"
  | "catalog-invalid"
  | "cycle-rejected"
  | "defaults-invalid"
  | "edit-rejected"
  | "preview-unavailable"
  | "source-invalid"
  | "target-invalid";

/** Atomic named-slot failure with no partial document or allocated identity. */
export interface AuthoringSlotEditFailure {
  readonly ok: false;
  readonly reason: AuthoringSlotEditFailureReason;
  /** Complete rejected-candidate diagnostics when continuous validation reached that boundary. */
  readonly validationReport?: DesenEditorContinuousValidationReport;
}

/** Complete result of one App-owned named-slot edit. */
export type AuthoringSlotEditResult = AuthoringSlotEditFailure | AuthoringSlotEditSuccess;

/** Honest dry-run result for an atomic selected-layer placement. */
export type AuthoringSlotBatchPlacementCompatibility =
  | Readonly<{
      readonly accepted: true;
      readonly changesSource: boolean;
      readonly operation: "mixed" | "move" | "noop" | "reorder";
    }>
  | Readonly<{
      readonly accepted: false;
      readonly reason:
        "acceptance-rejected" | "cardinality-rejected" | "cycle-rejected" | "target-invalid";
    }>;

/** Successful atomic placement of one or more already-existing Source nodes. */
export interface AuthoringSlotBatchPlacementSuccess {
  readonly ok: true;
  readonly document: DesenEditorDocument;
  readonly nodeIds: readonly string[];
  readonly operation: "mixed" | "move" | "noop" | "reorder";
}

/** Complete result of an App-owned multi-layer placement. */
export type AuthoringSlotBatchPlacementResult =
  AuthoringSlotEditFailure | AuthoringSlotBatchPlacementSuccess;

/** One route-valid slot joined to its exact current Source owner. */
export type AuthoringSlotProjection =
  | Readonly<{ readonly status: "rejected" }>
  | Readonly<{
      readonly status: "ready";
      readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
      readonly slot: AuthoringSlotState;
      readonly selection: AuthoringSlotSelection;
    }>;

/** Current Source presence and ordered children joined to one Catalog-declared named slot. */
export interface AuthoringSlotState {
  readonly name: string;
  readonly present: boolean;
  readonly contract: AuthoringSlotContract;
  readonly children: readonly AuthoringLayerNode[];
}

/** Honest compatibility result for one Catalog component at a current named-slot boundary. */
export type AuthoringSlotComponentCompatibility =
  | Readonly<{ readonly accepted: true; readonly reason: "accepted" }>
  | Readonly<{
      readonly accepted: false;
      readonly reason: "contract-rejected" | "maximum-reached";
    }>;

/** Honest insert readiness after receiving-slot and minimal-node construction checks. */
export type AuthoringSlotInsertionCompatibility =
  | Readonly<{ readonly accepted: true; readonly reason: "accepted" }>
  | Readonly<{
      readonly accepted: false;
      readonly reason:
        | "component-template-unavailable"
        | "contract-rejected"
        | "defaults-invalid"
        | "default-profile-exceeded"
        | "maximum-reached"
        | "minimum-unreachable"
        | "target-invalid";
    }>;

/** Honest current-node placement result used to disable impossible move and reorder targets. */
export type AuthoringSlotPlacementCompatibility =
  | Readonly<{
      readonly accepted: true;
      readonly operation: "move" | "reorder";
      readonly finalIndex: number;
      readonly changesSource: boolean;
    }>
  | Readonly<{
      readonly accepted: false;
      readonly reason:
        "acceptance-rejected" | "cardinality-rejected" | "cycle-rejected" | "target-invalid";
    }>;

/** Honest readiness for removing one currently selected non-root Source component. */
export type AuthoringNodeDeletionCompatibility =
  | Readonly<{ readonly accepted: true; readonly reason: "accepted" }>
  | Readonly<{
      readonly accepted: false;
      readonly reason: "cardinality-rejected" | "target-invalid";
    }>;

interface NodePlacement {
  readonly node: AuthoringLayerNode;
  readonly owner: AuthoringBehaviorLayer | AuthoringLayerNode;
  readonly slot: AuthoringSlotState;
  readonly index: number;
}

interface PendingNode {
  readonly node: AuthoringLayerNode;
  readonly placement: NodePlacement | null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactOwnData(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    return undefined;
  }
  const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function admissionKey(selection: AuthoringSlotSelection, subjectId: string): string {
  return JSON.stringify([
    selection.projectId,
    selection.surfaceId,
    selection.ownerKind,
    selection.ownerId,
    selection.ownerCapabilityId,
    selection.slot,
    subjectId,
  ]);
}

function insertionAdmissions(
  model: CatalogAuthoringModel,
): Map<string, InsertionAdmissionCacheEntry> {
  let admissions = INSERTION_ADMISSION_BY_MODEL.get(model);
  if (admissions === undefined) {
    admissions = new Map();
    INSERTION_ADMISSION_BY_MODEL.set(model, admissions);
  }
  return admissions;
}

function placementAdmissions(
  model: CatalogAuthoringModel,
): Map<string, PlacementAdmissionCacheEntry> {
  let admissions = PLACEMENT_ADMISSION_BY_MODEL.get(model);
  if (admissions === undefined) {
    admissions = new Map();
    PLACEMENT_ADMISSION_BY_MODEL.set(model, admissions);
  }
  return admissions;
}

function materializePlacementCompatibility(
  base: PlacementAdmissionBase,
  index: number,
): AuthoringSlotPlacementCompatibility {
  if (!base.accepted) return base;
  const finalIndex = base.operation === "reorder" && index > base.sourceIndex ? index - 1 : index;
  return Object.freeze({
    accepted: true,
    operation: base.operation,
    finalIndex,
    changesSource: base.operation === "move" || finalIndex !== base.sourceIndex,
  });
}

function captureRoute(route: AuthoringSlotRoute): AuthoringSlotRoute | undefined {
  try {
    const fields = exactOwnData(route, ["projectId", "surfaceId"]);
    if (
      fields === undefined ||
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({ projectId: fields.projectId, surfaceId: fields.surfaceId });
  } catch {
    return undefined;
  }
}

function captureSelection(selection: AuthoringSlotSelection): AuthoringSlotSelection | undefined {
  try {
    const fields = exactOwnData(selection, [
      "kind",
      "ownerCapabilityId",
      "ownerId",
      "ownerKind",
      "projectId",
      "slot",
      "surfaceId",
    ]);
    if (
      fields === undefined ||
      fields.kind !== "slot" ||
      (fields.ownerKind !== "behavior" && fields.ownerKind !== "component") ||
      !isNonEmptyString(fields.ownerCapabilityId) ||
      !isNonEmptyString(fields.ownerId) ||
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.slot) ||
      !isNonEmptyString(fields.surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "slot",
      ownerCapabilityId: fields.ownerCapabilityId,
      ownerId: fields.ownerId,
      ownerKind: fields.ownerKind,
      projectId: fields.projectId,
      slot: fields.slot,
      surfaceId: fields.surfaceId,
    });
  } catch {
    return undefined;
  }
}

function captureComponentSelection(
  selection: AuthoringComponentSelection,
): AuthoringComponentSelection | undefined {
  try {
    const fields = exactOwnData(selection, [
      "capabilityId",
      "conditional",
      "displayName",
      "kind",
      "projectId",
      "sourceNodeId",
      "surfaceId",
    ]);
    if (
      fields === undefined ||
      fields.kind !== "component" ||
      typeof fields.conditional !== "boolean" ||
      !isNonEmptyString(fields.capabilityId) ||
      !isNonEmptyString(fields.displayName) ||
      !isNonEmptyString(fields.projectId) ||
      !isNonEmptyString(fields.sourceNodeId) ||
      !isNonEmptyString(fields.surfaceId)
    ) {
      return undefined;
    }
    return Object.freeze({
      kind: "component",
      projectId: fields.projectId,
      surfaceId: fields.surfaceId,
      sourceNodeId: fields.sourceNodeId,
      capabilityId: fields.capabilityId,
      displayName: fields.displayName,
      conditional: fields.conditional,
    });
  } catch {
    return undefined;
  }
}

function captureEdit(edit: AuthoringSlotEdit): AuthoringSlotEdit | undefined {
  try {
    const keys = Reflect.ownKeys(edit);
    if (keys.length !== 3 || keys.some((key) => typeof key !== "string")) return undefined;
    const fields: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(edit, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      fields[key] = descriptor.value;
    }
    if (fields.kind === "insert") {
      if (
        !Object.hasOwn(fields, "componentId") ||
        !Object.hasOwn(fields, "index") ||
        !Object.hasOwn(fields, "kind") ||
        !isNonEmptyString(fields.componentId) ||
        !Number.isSafeInteger(fields.index) ||
        (fields.index as number) < 0
      ) {
        return undefined;
      }
      return Object.freeze({
        kind: "insert",
        componentId: fields.componentId,
        index: fields.index as number,
      });
    }
    if (fields.kind === "place") {
      if (
        !Object.hasOwn(fields, "index") ||
        !Object.hasOwn(fields, "kind") ||
        !Object.hasOwn(fields, "nodeId") ||
        !isNonEmptyString(fields.nodeId) ||
        !Number.isSafeInteger(fields.index) ||
        (fields.index as number) < 0
      ) {
        return undefined;
      }
      return Object.freeze({
        kind: "place",
        nodeId: fields.nodeId,
        index: fields.index as number,
      });
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function slotOwnerMatches(
  owner: AuthoringBehaviorLayer | AuthoringLayerNode,
  selection: AuthoringSlotSelection,
): boolean {
  return (
    owner.kind === selection.ownerKind &&
    owner.id === selection.ownerId &&
    owner.capabilityId === selection.ownerCapabilityId
  );
}

function surfacePending(
  model: CatalogAuthoringModel,
  surfaceId: string,
): PendingNode[] | undefined {
  const surface = model.surfaces.find(({ id }) => id === surfaceId);
  return surface === undefined ? undefined : [{ node: surface.root, placement: null }];
}

function scheduleChildren(
  pending: PendingNode[],
  owner: AuthoringBehaviorLayer | AuthoringLayerNode,
  contractsBySet: WeakMap<
    readonly AuthoringSlotContract[],
    ReadonlyMap<string, AuthoringSlotContract>
  >,
) {
  if (owner.slots.length === 0) return;
  let contracts = contractsBySet.get(owner.slotContracts);
  if (contracts === undefined) {
    contracts = new Map(owner.slotContracts.map((contract) => [contract.name, contract]));
    contractsBySet.set(owner.slotContracts, contracts);
  }
  for (let slotIndex = owner.slots.length - 1; slotIndex >= 0; slotIndex -= 1) {
    const slot = owner.slots[slotIndex];
    if (slot === undefined) continue;
    const contract = contracts.get(slot.name);
    if (contract === undefined) continue;
    const state = Object.freeze({
      name: slot.name,
      present: true,
      contract,
      children: slot.children,
    });
    for (let childIndex = slot.children.length - 1; childIndex >= 0; childIndex -= 1) {
      const node = slot.children[childIndex];
      if (node === undefined) continue;
      pending.push({ node, placement: { node, owner, slot: state, index: childIndex } });
    }
  }
}

function slotState(
  owner: AuthoringBehaviorLayer | AuthoringLayerNode,
  name: string,
): AuthoringSlotState | undefined {
  const contract = owner.slotContracts.find((candidate) => candidate.name === name);
  if (contract === undefined) return undefined;
  const sourceSlot = owner.slots.find((candidate) => candidate.name === name);
  return Object.freeze({
    name,
    present: sourceSlot !== undefined,
    contract,
    children: sourceSlot?.children ?? Object.freeze([]),
  });
}

function findSlotProjection(
  model: CatalogAuthoringModel,
  selection: AuthoringSlotSelection,
): AuthoringSlotProjection {
  const pending = surfacePending(model, selection.surfaceId);
  if (pending === undefined) return Object.freeze({ status: "rejected" });
  const contractsBySet = new WeakMap<
    readonly AuthoringSlotContract[],
    ReadonlyMap<string, AuthoringSlotContract>
  >();
  let match: AuthoringBehaviorLayer | AuthoringLayerNode | undefined;
  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    const node = work.node;
    if (slotOwnerMatches(node, selection)) {
      if (match !== undefined) return Object.freeze({ status: "rejected" });
      match = node;
    }
    for (const behavior of node.behaviors) {
      if (slotOwnerMatches(behavior, selection)) {
        if (match !== undefined) return Object.freeze({ status: "rejected" });
        match = behavior;
      }
      scheduleChildren(pending, behavior, contractsBySet);
    }
    scheduleChildren(pending, node, contractsBySet);
  }
  const slot = match === undefined ? undefined : slotState(match, selection.slot);
  return match === undefined || slot === undefined
    ? Object.freeze({ status: "rejected" })
    : Object.freeze({ status: "ready", owner: match, slot, selection });
}

function findNodePlacement(
  model: CatalogAuthoringModel,
  surfaceId: string,
  nodeId: string,
): NodePlacement | null | undefined {
  const pending = surfacePending(model, surfaceId);
  if (pending === undefined) return undefined;
  const contractsBySet = new WeakMap<
    readonly AuthoringSlotContract[],
    ReadonlyMap<string, AuthoringSlotContract>
  >();
  let matched: NodePlacement | null | undefined;
  while (pending.length > 0) {
    const work = pending.pop();
    if (work === undefined) continue;
    if (work.node.id === nodeId) {
      if (matched !== undefined) return undefined;
      matched = work.placement;
    }
    for (const behavior of work.node.behaviors) {
      scheduleChildren(pending, behavior, contractsBySet);
    }
    scheduleChildren(pending, work.node, contractsBySet);
  }
  return matched;
}

function nodeContainsOwner(root: AuthoringLayerNode, selection: AuthoringSlotSelection): boolean {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (slotOwnerMatches(node, selection)) return true;
    for (const behavior of node.behaviors) {
      if (slotOwnerMatches(behavior, selection)) return true;
      for (const slot of behavior.slots) {
        for (const child of slot.children) pending.push(child);
      }
    }
    for (const slot of node.slots) {
      for (const child of slot.children) pending.push(child);
    }
  }
  return false;
}

function captureBatchNodeIds(nodeIds: readonly string[]): readonly string[] | undefined {
  if (
    !Array.isArray(nodeIds) ||
    nodeIds.length === 0 ||
    nodeIds.length > AUTHORING_SLOT_BATCH_PLACEMENT_MAX_NODES
  ) {
    return undefined;
  }
  const captured: string[] = [];
  const seen = new Set<string>();
  for (const nodeId of nodeIds) {
    if (!isNonEmptyString(nodeId) || seen.has(nodeId)) return undefined;
    seen.add(nodeId);
    captured.push(nodeId);
  }
  return Object.freeze(captured);
}

function sameSlotPlacement(placement: NodePlacement, selection: AuthoringSlotSelection): boolean {
  return (
    placement.owner.kind === selection.ownerKind &&
    placement.owner.id === selection.ownerId &&
    placement.slot.name === selection.slot
  );
}

function nodeContainsSelectedDescendant(
  root: AuthoringLayerNode,
  selectedNodeIds: ReadonlySet<string>,
): boolean {
  const pending: AuthoringLayerNode[] = [];
  for (const slot of root.slots) {
    for (const child of slot.children) pending.push(child);
  }
  for (const behavior of root.behaviors) {
    for (const slot of behavior.slots) {
      for (const child of slot.children) pending.push(child);
    }
  }
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (selectedNodeIds.has(node.id)) return true;
    for (const slot of node.slots) {
      for (const child of slot.children) pending.push(child);
    }
    for (const behavior of node.behaviors) {
      for (const slot of behavior.slots) {
        for (const child of slot.children) pending.push(child);
      }
    }
  }
  return false;
}

/**
 * Re-establishes the one stable tree order used by direct selection, regardless of click or
 * caller order. Structural placement must never make a drag outcome depend on event ordering.
 */
function sourceOrderedBatchNodeIds(
  model: CatalogAuthoringModel,
  surfaceId: string,
  selectedNodeIds: ReadonlySet<string>,
): readonly string[] | undefined {
  const surface = model.surfaces.find((candidate) => candidate.id === surfaceId);
  if (surface === undefined) return undefined;
  const ordered: string[] = [];
  const pending: AuthoringLayerNode[] = [surface.root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) continue;
    if (selectedNodeIds.has(node.id)) ordered.push(node.id);
    for (const slot of [...node.slots].reverse()) {
      for (const child of [...slot.children].reverse()) pending.push(child);
    }
    for (const behavior of [...node.behaviors].reverse()) {
      for (const slot of [...behavior.slots].reverse()) {
        for (const child of [...slot.children].reverse()) pending.push(child);
      }
    }
  }
  return ordered.length === selectedNodeIds.size ? Object.freeze(ordered) : undefined;
}

function sourceSlotKey(placement: NodePlacement): string {
  return JSON.stringify([placement.owner.kind, placement.owner.id, placement.slot.name]);
}

type ReadyAuthoringSlotProjection = Extract<AuthoringSlotProjection, { readonly status: "ready" }>;

interface AuthoringSlotBatchPlacementPlan {
  readonly changesSource: boolean;
  readonly entries: readonly Readonly<{
    readonly nodeId: string;
    readonly placement: NodePlacement;
    readonly sameTarget: boolean;
  }>[];
  readonly insertionIndex: number;
  readonly nodeIds: readonly string[];
  readonly operation: "mixed" | "move" | "noop" | "reorder";
  readonly target: ReadyAuthoringSlotProjection;
}

type AuthoringSlotBatchPlacementAnalysis =
  | Readonly<{
      readonly accepted: false;
      readonly reason: Extract<
        AuthoringSlotBatchPlacementCompatibility,
        { readonly accepted: false }
      >["reason"];
    }>
  | Readonly<{
      readonly accepted: true;
      readonly plan: AuthoringSlotBatchPlacementPlan;
    }>;

function batchPlacementFailure(
  reason: Extract<AuthoringSlotBatchPlacementCompatibility, { readonly accepted: false }>["reason"],
): AuthoringSlotBatchPlacementAnalysis {
  return Object.freeze({ accepted: false, reason });
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Builds one closed, Source-derived plan for a group placement before any candidate is changed.
 * The plan rejects a partial group rather than trying to salvage the valid members.
 */
function analyzeAuthoringSlotBatchPlacement(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
  selection: AuthoringSlotSelection,
  nodeIds: readonly string[],
  index: number,
): AuthoringSlotBatchPlacementAnalysis {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  const capturedNodeIds = captureBatchNodeIds(nodeIds);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedNodeIds === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    return batchPlacementFailure("target-invalid");
  }
  const target = findSlotProjection(model, capturedSelection);
  if (target.status !== "ready" || index > target.slot.children.length) {
    return batchPlacementFailure("target-invalid");
  }

  const selectedNodeIds = new Set(capturedNodeIds);
  const sourceOrderedNodeIds = sourceOrderedBatchNodeIds(
    model,
    capturedRoute.surfaceId,
    selectedNodeIds,
  );
  if (sourceOrderedNodeIds === undefined) return batchPlacementFailure("target-invalid");
  const entries: Readonly<{
    readonly nodeId: string;
    readonly placement: NodePlacement;
    readonly sameTarget: boolean;
  }>[] = [];
  const removalsBySourceSlot = new Map<
    string,
    Readonly<{ readonly count: number; readonly placement: NodePlacement }>
  >();
  let incomingCount = 0;

  for (const nodeId of sourceOrderedNodeIds) {
    const placement = findNodePlacement(model, capturedRoute.surfaceId, nodeId);
    if (placement === undefined || placement === null)
      return batchPlacementFailure("target-invalid");
    const component = model.components.find(({ id }) => id === placement.node.capabilityId);
    if (component === undefined || !acceptsComponent(target.slot, component)) {
      return batchPlacementFailure("acceptance-rejected");
    }
    if (nodeContainsOwner(placement.node, capturedSelection)) {
      return batchPlacementFailure("cycle-rejected");
    }
    const sameTarget = sameSlotPlacement(placement, capturedSelection);
    entries.push(Object.freeze({ nodeId, placement, sameTarget }));
    if (sameTarget) continue;
    incomingCount += 1;
    const key = sourceSlotKey(placement);
    const existing = removalsBySourceSlot.get(key);
    removalsBySourceSlot.set(key, Object.freeze({ count: (existing?.count ?? 0) + 1, placement }));
  }

  for (const entry of entries) {
    if (nodeContainsSelectedDescendant(entry.placement.node, selectedNodeIds)) {
      return batchPlacementFailure("cycle-rejected");
    }
  }
  for (const { count, placement } of removalsBySourceSlot.values()) {
    if (placement.slot.children.length - count < placement.slot.contract.minimum) {
      return batchPlacementFailure("cardinality-rejected");
    }
  }
  const finalTargetLength = target.slot.children.length + incomingCount;
  if (
    (target.slot.contract.maximum !== null && finalTargetLength > target.slot.contract.maximum) ||
    (!target.slot.present && finalTargetLength < target.slot.contract.minimum)
  ) {
    return batchPlacementFailure("cardinality-rejected");
  }

  const selectedTargetBeforeBoundary = entries.filter(
    ({ placement, sameTarget }) => sameTarget && placement.index < index,
  ).length;
  const insertionIndex = index - selectedTargetBeforeBoundary;
  const selectedTargetIds = new Set(
    entries.filter(({ sameTarget }) => sameTarget).map(({ nodeId }) => nodeId),
  );
  const remainingTargetIds = target.slot.children
    .map(({ id }) => id)
    .filter((nodeId) => !selectedTargetIds.has(nodeId));
  const expectedTargetIds = [
    ...remainingTargetIds.slice(0, insertionIndex),
    ...sourceOrderedNodeIds,
    ...remainingTargetIds.slice(insertionIndex),
  ];
  const changesSource =
    incomingCount > 0 ||
    !arraysEqual(
      target.slot.children.map(({ id }) => id),
      expectedTargetIds,
    );
  const sameTargetCount = entries.length - incomingCount;
  const operation = !changesSource
    ? "noop"
    : incomingCount === 0
      ? "reorder"
      : sameTargetCount === 0
        ? "move"
        : "mixed";
  return Object.freeze({
    accepted: true,
    plan: Object.freeze({
      changesSource,
      entries: Object.freeze(entries),
      insertionIndex,
      nodeIds: sourceOrderedNodeIds,
      operation,
      target,
    }),
  });
}

function acceptsComponent(slot: AuthoringSlotState, component: CatalogComponentSummary): boolean {
  if (!slot.contract.constrainsChildren) return true;
  return (
    slot.contract.acceptedCapabilityIds.includes(component.id) ||
    (component.semanticCategory !== undefined &&
      slot.contract.acceptedCategories.includes(component.semanticCategory))
  );
}

function insertionIdBase(componentId: string): string {
  const tail = componentId.split("/").at(-1) ?? "component";
  let slug = "";
  for (const character of tail) {
    const code = character.charCodeAt(0);
    const supported =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      character === "." ||
      character === "_" ||
      character === ":" ||
      character === "-";
    slug += supported ? character.toLocaleLowerCase("en-US") : "-";
    if (slug.length >= 123) break;
  }
  return `node.${slug || "component"}`;
}

function validateCandidate(
  model: CatalogAuthoringModel,
  candidate: DesenEditorDocument,
): DesenEditorDocument | undefined {
  const report = validationReportForCandidate(model, candidate);
  return report?.valid === true ? candidate : undefined;
}

function validationReportForCandidate(
  model: CatalogAuthoringModel,
  candidate: DesenEditorDocument,
): DesenEditorContinuousValidationReport | undefined {
  let prepared = VALIDATOR_BY_MODEL.get(model);
  if (prepared === undefined) {
    prepared = createDesenEditorContinuousValidator(model.validationCatalogs);
    VALIDATOR_BY_MODEL.set(model, prepared);
  }
  if (!prepared.ok) return undefined;
  return prepared.validator.validate(candidate);
}

type AuthoringSlotBatchCandidateResult =
  | Readonly<{ readonly ok: true; readonly document: DesenEditorDocument }>
  | Readonly<{
      readonly ok: false;
      readonly reason: "command-rejected" | "validation-rejected";
      readonly validationReport?: DesenEditorContinuousValidationReport;
    }>;

/**
 * Executes the already-authorized group plan against a detached Editor Core candidate only.
 * No caller can observe an intermediate document: this is shared by dry-run admission and the
 * final App mutation so their verdicts cannot drift at structural-depth or validation limits.
 */
function buildAuthoringSlotBatchCandidate(
  model: CatalogAuthoringModel,
  route: AuthoringSlotRoute,
  selection: AuthoringSlotSelection,
  plan: AuthoringSlotBatchPlacementPlan,
): AuthoringSlotBatchCandidateResult {
  let candidate = model.validationDocument;
  if (plan.entries.every(({ sameTarget }) => !sameTarget)) {
    // A reverse sequence of moves at the same boundary produces source order directly. This
    // avoids a second full reorder pass through the bounded 256-node cross-target group.
    for (const nodeId of [...plan.nodeIds].reverse()) {
      const changed = moveDesenEditorNode(candidate, {
        surfaceId: route.surfaceId,
        parentId: selection.ownerId,
        slot: selection.slot,
        nodeId,
        index: plan.insertionIndex,
      });
      if (!changed.ok) return Object.freeze({ ok: false, reason: "command-rejected" });
      candidate = changed.document;
    }
  } else {
    let targetLength = plan.target.slot.children.length;
    for (const entry of plan.entries) {
      const changed = entry.sameTarget
        ? reorderDesenEditorNode(candidate, {
            surfaceId: route.surfaceId,
            parentId: selection.ownerId,
            slot: selection.slot,
            nodeId: entry.nodeId,
            index: targetLength - 1,
          })
        : moveDesenEditorNode(candidate, {
            surfaceId: route.surfaceId,
            parentId: selection.ownerId,
            slot: selection.slot,
            nodeId: entry.nodeId,
            index: targetLength,
          });
      if (!changed.ok) return Object.freeze({ ok: false, reason: "command-rejected" });
      candidate = changed.document;
      if (!entry.sameTarget) targetLength += 1;
    }
    for (const [offset, nodeId] of plan.nodeIds.entries()) {
      const changed = reorderDesenEditorNode(candidate, {
        surfaceId: route.surfaceId,
        parentId: selection.ownerId,
        slot: selection.slot,
        nodeId,
        index: plan.insertionIndex + offset,
      });
      if (!changed.ok) return Object.freeze({ ok: false, reason: "command-rejected" });
      candidate = changed.document;
    }
  }
  const validationReport = validationReportForCandidate(model, candidate);
  return validationReport?.valid === true
    ? Object.freeze({ ok: true, document: candidate })
    : Object.freeze({
        ok: false,
        reason: "validation-rejected" as const,
        ...(validationReport === undefined ? {} : { validationReport }),
      });
}

function batchPlacementAdmissionKey(plan: AuthoringSlotBatchPlacementPlan): string {
  const selection = plan.target.selection;
  return JSON.stringify([
    selection.projectId,
    selection.surfaceId,
    selection.ownerKind,
    selection.ownerId,
    selection.ownerCapabilityId,
    selection.slot,
    plan.nodeIds,
  ]);
}

/**
 * Caches structural admission per immutable model, selected group, and target slot—not boundary.
 * Reordering a preflighted group cannot affect the candidate's depth or Catalog validity, while
 * avoiding one full detached-command sequence for every visual insertion boundary in a large tree.
 */
function batchPlacementCandidateIsAdmitted(
  model: CatalogAuthoringModel,
  route: AuthoringSlotRoute,
  selection: AuthoringSlotSelection,
  plan: AuthoringSlotBatchPlacementPlan,
): boolean {
  let admissions = BATCH_PLACEMENT_ADMISSION_BY_MODEL.get(model);
  if (admissions === undefined) {
    admissions = new Map();
    BATCH_PLACEMENT_ADMISSION_BY_MODEL.set(model, admissions);
  }
  const key = batchPlacementAdmissionKey(plan);
  const cached = admissions.get(key);
  if (cached !== undefined) return cached.accepted;
  const accepted = buildAuthoringSlotBatchCandidate(model, route, selection, plan).ok;
  if (admissions.size >= BATCH_PLACEMENT_ADMISSION_CACHE_LIMIT) admissions.clear();
  admissions.set(key, Object.freeze({ accepted }));
  return accepted;
}

function withinDefaultProfile(
  document: DesenEditorDocument,
  component: CatalogComponentSummary,
): boolean {
  const transitionCount = Object.keys(component.defaultProps).length + 1;
  if (transitionCount - 1 > SLOT_INSERT_PROFILE.maxDefaultPropTransitions) return false;
  try {
    const snapshotBytes =
      canonicalizeJsonBytes(document).byteLength +
      canonicalizeJsonBytes(component.defaultProps).byteLength;
    return (
      snapshotBytes <=
      Math.floor(SLOT_INSERT_PROFILE.maxAggregateSnapshotWorkBytes / transitionCount)
    );
  } catch {
    return false;
  }
}

function stageDefaultProps(
  document: DesenEditorDocument,
  surfaceId: string,
  nodeId: string,
  component: CatalogComponentSummary,
): DesenEditorDocument | undefined {
  const properties = Object.keys(component.defaultProps);
  if (!withinDefaultProfile(document, component)) return undefined;
  properties.sort(compareText);

  let candidate = document;
  for (const property of properties) {
    const value = component.defaultProps[property] as JsonValue | undefined;
    if (value === undefined) return undefined;
    const changed = setDesenEditorOwnerProp(candidate, {
      surfaceId,
      ownerId: nodeId,
      name: property,
      value: value as DesenEditorContentValue,
    });
    if (!changed.ok) return undefined;
    candidate = changed.document;
  }
  return candidate;
}

function failure(
  reason: AuthoringSlotEditFailureReason,
  validationReport?: DesenEditorContinuousValidationReport,
): AuthoringSlotEditFailure {
  return Object.freeze({
    ok: false,
    reason,
    ...(validationReport === undefined ? {} : { validationReport }),
  });
}

/** Creates a frozen named-slot identity without retaining React, DOM, drag-event, or adapter data. */
export function createAuthoringSlotSelection(
  input: Omit<AuthoringSlotSelection, "kind">,
): AuthoringSlotSelection {
  const candidate = Object.freeze({ kind: "slot" as const, ...input });
  const captured = captureSelection(candidate);
  if (captured === undefined)
    throw new TypeError("Authoring slot selection must be exact inert data.");
  return captured;
}

/** Returns whether two App-owned slot identities name the same exact route and Source owner. */
export function isSameAuthoringSlotSelection(
  left: AuthoringSlotSelection | null,
  right: AuthoringSlotSelection,
): boolean {
  return (
    left !== null &&
    left.kind === right.kind &&
    left.projectId === right.projectId &&
    left.surfaceId === right.surfaceId &&
    left.ownerKind === right.ownerKind &&
    left.ownerId === right.ownerId &&
    left.ownerCapabilityId === right.ownerCapabilityId &&
    left.slot === right.slot
  );
}

/** Re-authorizes one slot identity against the exact current route and immutable authoring model. */
export function projectAuthoringSlotSelection(
  selection: AuthoringSlotSelection,
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
): AuthoringSlotProjection {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId
  ) {
    return Object.freeze({ status: "rejected" });
  }
  return findSlotProjection(model, capturedSelection);
}

/** Explains whether one current Catalog component may be appended to a current named slot. */
export function evaluateAuthoringSlotComponent(
  slot: AuthoringSlotState,
  component: CatalogComponentSummary,
): AuthoringSlotComponentCompatibility {
  if (slot.contract.maximum !== null && slot.children.length >= slot.contract.maximum) {
    return Object.freeze({ accepted: false, reason: "maximum-reached" });
  }
  return acceptsComponent(slot, component)
    ? Object.freeze({ accepted: true, reason: "accepted" })
    : Object.freeze({ accepted: false, reason: "contract-rejected" });
}

/** Dry-runs whether one current Catalog component can become a validator-admitted minimal child. */
export function evaluateAuthoringSlotInsertion(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
  selection: AuthoringSlotSelection,
  componentId: string,
  index: number,
): AuthoringSlotInsertionCompatibility {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId ||
    !isNonEmptyString(componentId) ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  const admissions = insertionAdmissions(model);
  const key = admissionKey(capturedSelection, componentId);
  const cached = admissions.get(key);
  if (cached !== undefined) {
    return index > cached.maximumIndex
      ? Object.freeze({ accepted: false, reason: "target-invalid" })
      : cached.compatibility;
  }
  const projection = findSlotProjection(model, capturedSelection);
  if (projection.status !== "ready" || index > projection.slot.children.length) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  function remember(
    compatibility: AuthoringSlotInsertionCompatibility,
  ): AuthoringSlotInsertionCompatibility {
    admissions.set(
      key,
      Object.freeze({
        maximumIndex: projection.status === "ready" ? projection.slot.children.length : -1,
        compatibility,
      }),
    );
    return compatibility;
  }
  const component = model.components.find(({ id }) => id === componentId);
  if (component === undefined) {
    return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
  }
  const receiving = evaluateAuthoringSlotComponent(projection.slot, component);
  if (!receiving.accepted) return remember(receiving);
  if (
    !projection.slot.present &&
    projection.slot.children.length + 1 < projection.slot.contract.minimum
  ) {
    return remember(Object.freeze({ accepted: false, reason: "minimum-unreachable" }));
  }
  if (component.slotContracts.some(({ required }) => required)) {
    return remember(Object.freeze({ accepted: false, reason: "component-template-unavailable" }));
  }
  if (!withinDefaultProfile(model.validationDocument, component)) {
    return remember(Object.freeze({ accepted: false, reason: "default-profile-exceeded" }));
  }
  const inserted = insertDesenEditorNode(model.validationDocument, {
    surfaceId: capturedRoute.surfaceId,
    parentId: capturedSelection.ownerId,
    slot: capturedSelection.slot,
    index,
    idBase: insertionIdBase(component.id),
    use: component.id,
  });
  if (!inserted.ok) {
    return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
  }
  const staged = stageDefaultProps(
    inserted.document,
    capturedRoute.surfaceId,
    inserted.insertedNodeId,
    component,
  );
  if (staged === undefined || validateCandidate(model, staged) === undefined) {
    return remember(Object.freeze({ accepted: false, reason: "defaults-invalid" }));
  }
  return remember(Object.freeze({ accepted: true, reason: "accepted" }));
}

/** Re-authorizes one current Source node against an exact move or reorder boundary without editing. */
export function evaluateAuthoringSlotPlacement(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
  selection: AuthoringSlotSelection,
  nodeId: string,
  index: number,
): AuthoringSlotPlacementCompatibility {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId ||
    !isNonEmptyString(nodeId) ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  const admissions = placementAdmissions(model);
  const key = admissionKey(capturedSelection, nodeId);
  const cached = admissions.get(key);
  if (cached !== undefined) {
    return index > cached.maximumIndex
      ? Object.freeze({ accepted: false, reason: "target-invalid" })
      : materializePlacementCompatibility(cached.base, index);
  }
  const projection = findSlotProjection(model, capturedSelection);
  if (projection.status !== "ready" || index > projection.slot.children.length) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  const maximumIndex = projection.slot.children.length;
  function remember(base: PlacementAdmissionBase): AuthoringSlotPlacementCompatibility {
    admissions.set(key, Object.freeze({ maximumIndex, base }));
    return materializePlacementCompatibility(base, index);
  }
  const placement = findNodePlacement(model, capturedRoute.surfaceId, nodeId);
  if (placement === undefined || placement === null) {
    return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
  }
  const sameSlot =
    placement.owner.kind === capturedSelection.ownerKind &&
    placement.owner.id === capturedSelection.ownerId &&
    placement.slot.name === capturedSelection.slot;
  if (sameSlot) {
    const finalIndex = index > placement.index ? index - 1 : index;
    const changed = reorderDesenEditorNode(model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      parentId: capturedSelection.ownerId,
      slot: capturedSelection.slot,
      nodeId,
      index: finalIndex,
    });
    if (!changed.ok || validateCandidate(model, changed.document) === undefined) {
      return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
    }
    return remember(
      Object.freeze({ accepted: true, operation: "reorder", sourceIndex: placement.index }),
    );
  }
  if (placement.slot.children.length - 1 < placement.slot.contract.minimum) {
    return remember(Object.freeze({ accepted: false, reason: "cardinality-rejected" }));
  }
  const component = model.components.find(({ id }) => id === placement.node.capabilityId);
  if (component === undefined) {
    return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
  }
  const receiving = evaluateAuthoringSlotComponent(projection.slot, component);
  if (!receiving.accepted) {
    return remember(
      Object.freeze({
        accepted: false,
        reason:
          receiving.reason === "maximum-reached" ? "cardinality-rejected" : "acceptance-rejected",
      }),
    );
  }
  if (
    !projection.slot.present &&
    projection.slot.children.length + 1 < projection.slot.contract.minimum
  ) {
    return remember(Object.freeze({ accepted: false, reason: "cardinality-rejected" }));
  }
  if (nodeContainsOwner(placement.node, capturedSelection)) {
    return remember(Object.freeze({ accepted: false, reason: "cycle-rejected" }));
  }
  const changed = moveDesenEditorNode(model.validationDocument, {
    surfaceId: capturedRoute.surfaceId,
    parentId: capturedSelection.ownerId,
    slot: capturedSelection.slot,
    nodeId,
    index,
  });
  if (!changed.ok || validateCandidate(model, changed.document) === undefined) {
    return remember(Object.freeze({ accepted: false, reason: "target-invalid" }));
  }
  return remember(
    Object.freeze({ accepted: true, operation: "move", sourceIndex: placement.index }),
  );
}

/**
 * Re-authorizes an entire selected group before enabling a direct canvas placement.
 *
 * @remarks All selected nodes are evaluated against one immutable Source snapshot. A rejected
 * member rejects the whole group, so a native drag or keyboard "Place" action can never apply a
 * prefix of the requested move.
 */
export function evaluateAuthoringSlotBatchPlacement(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
  selection: AuthoringSlotSelection,
  nodeIds: readonly string[],
  index: number,
): AuthoringSlotBatchPlacementCompatibility {
  const analysis = analyzeAuthoringSlotBatchPlacement(route, model, selection, nodeIds, index);
  if (!analysis.accepted) return Object.freeze({ accepted: false, reason: analysis.reason });
  if (
    analysis.plan.changesSource &&
    !batchPlacementCandidateIsAdmitted(model, route, selection, analysis.plan)
  ) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  return Object.freeze({
    accepted: true,
    changesSource: analysis.plan.changesSource,
    operation: analysis.plan.operation,
  });
}

/**
 * Applies one preflighted multi-layer placement through public Editor Core structural commands.
 *
 * @remarks The intermediate detached candidates are private to this function. Cross-target groups
 * insert directly at one boundary in reverse source order. Groups containing target siblings first
 * normalize at the tail, then reorder to avoid selected-sibling index drift. Both preserve source
 * order. The final validator result is the sole commit candidate; any
 * rejected command or validation result returns no document, allocation, or partial source.
 */
export function applyAuthoringSlotBatchPlacement(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringSlotRoute,
  selection: AuthoringSlotSelection,
  nodeIds: readonly string[],
  index: number,
): AuthoringSlotBatchPlacementResult {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  const capturedNodeIds = captureBatchNodeIds(nodeIds);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedNodeIds === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId ||
    !Number.isSafeInteger(index) ||
    index < 0
  ) {
    return failure("edit-rejected");
  }
  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  const analysis = analyzeAuthoringSlotBatchPlacement(
    capturedRoute,
    prepared.model,
    capturedSelection,
    capturedNodeIds,
    index,
  );
  if (!analysis.accepted) return failure(analysis.reason);
  const plan = analysis.plan;
  if (!plan.changesSource) {
    return Object.freeze({
      ok: true,
      document,
      nodeIds: plan.nodeIds,
      operation: "noop",
    });
  }
  const candidate = buildAuthoringSlotBatchCandidate(
    prepared.model,
    capturedRoute,
    capturedSelection,
    plan,
  );
  return !candidate.ok
    ? candidate.reason === "validation-rejected"
      ? failure("source-invalid", candidate.validationReport)
      : failure("edit-rejected")
    : Object.freeze({
        ok: true,
        document: candidate.document,
        nodeIds: plan.nodeIds,
        operation: plan.operation,
      });
}

/** Re-authorizes whether the exact current selection may be removed from its owning named slot. */
export function evaluateAuthoringNodeDeletion(
  route: AuthoringSlotRoute,
  model: CatalogAuthoringModel,
  selection: AuthoringComponentSelection,
): AuthoringNodeDeletionCompatibility {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureComponentSelection(selection);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId
  ) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  const placement = findNodePlacement(
    model,
    capturedRoute.surfaceId,
    capturedSelection.sourceNodeId,
  );
  if (
    placement === undefined ||
    placement === null ||
    placement.node.capabilityId !== capturedSelection.capabilityId ||
    placement.node.displayName !== capturedSelection.displayName ||
    placement.node.conditional !== capturedSelection.conditional
  ) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  if (placement.slot.children.length - 1 < placement.slot.contract.minimum) {
    return Object.freeze({ accepted: false, reason: "cardinality-rejected" });
  }
  const changed = deleteDesenEditorNode(model.validationDocument, {
    surfaceId: capturedRoute.surfaceId,
    nodeId: capturedSelection.sourceNodeId,
  });
  if (!changed.ok || validateCandidate(model, changed.document) === undefined) {
    return Object.freeze({ accepted: false, reason: "target-invalid" });
  }
  return Object.freeze({ accepted: true, reason: "accepted" });
}

/**
 * Removes one exact selected subtree through public Editor Core and complete current validation.
 *
 * @remarks The current route, selection, Source placement, capability identity, and source-slot
 * minimum are re-derived for every call. Root deletion and any deletion that would cross the
 * effective minimum fail without exposing a partial document. Publisher preflight and the atomic
 * session preview replacement remain the caller's final commit boundary.
 */
export function applyAuthoringNodeDelete(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringSlotRoute,
  selection: AuthoringComponentSelection,
): AuthoringSlotEditResult {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureComponentSelection(selection);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId
  ) {
    return failure("edit-rejected");
  }
  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  const placement = findNodePlacement(
    prepared.model,
    capturedRoute.surfaceId,
    capturedSelection.sourceNodeId,
  );
  if (
    placement === undefined ||
    placement === null ||
    placement.node.capabilityId !== capturedSelection.capabilityId ||
    placement.node.displayName !== capturedSelection.displayName ||
    placement.node.conditional !== capturedSelection.conditional
  ) {
    return failure("target-invalid");
  }
  if (placement.slot.children.length - 1 < placement.slot.contract.minimum) {
    return failure("cardinality-rejected");
  }

  const changed = deleteDesenEditorNode(prepared.model.validationDocument, {
    surfaceId: capturedRoute.surfaceId,
    nodeId: capturedSelection.sourceNodeId,
  });
  if (!changed.ok) return failure("target-invalid");
  const validationReport = validationReportForCandidate(prepared.model, changed.document);
  return validationReport?.valid !== true
    ? failure("source-invalid", validationReport)
    : Object.freeze({
        ok: true,
        document: changed.document,
        nodeId: capturedSelection.sourceNodeId,
        operation: "delete",
      });
}

/**
 * Applies an insertion, cross-slot move, or same-slot reorder through public Editor Core commands.
 *
 * @remarks DOM drop data is never accepted as authority. Route, target, edit, current placement,
 * slot contract, Catalog defaults, and component category are re-derived from one validator-admitted
 * Source and Catalog snapshot. Insert defaults are staged privately and only the final candidate is
 * continuously validated. Every rejection preserves the caller's document and exposes no allocated
 * identity or partial Source. A component whose own Catalog contract requires a materialized slot
 * is rejected as `defaults-invalid`: the current public Editor Core insert command intentionally
 * creates one minimal leaf, and this App layer does not invent a private subtree transaction.
 */
export function applyAuthoringSlotEdit(
  document: DesenEditorDocument,
  catalogValue: unknown,
  route: AuthoringSlotRoute,
  selection: AuthoringSlotSelection,
  edit: AuthoringSlotEdit,
): AuthoringSlotEditResult {
  const capturedRoute = captureRoute(route);
  const capturedSelection = captureSelection(selection);
  const capturedEdit = captureEdit(edit);
  if (
    capturedRoute === undefined ||
    capturedSelection === undefined ||
    capturedEdit === undefined ||
    capturedSelection.projectId !== capturedRoute.projectId ||
    capturedSelection.surfaceId !== capturedRoute.surfaceId
  ) {
    return failure("edit-rejected");
  }

  const prepared = prepareCatalogAuthoringModel(catalogValue, document);
  if (!prepared.ok) {
    return failure(prepared.reason === "catalog-invalid" ? "catalog-invalid" : "source-invalid");
  }
  const projection = findSlotProjection(prepared.model, capturedSelection);
  if (projection.status !== "ready") return failure("target-invalid");
  if (capturedEdit.index > projection.slot.children.length) return failure("edit-rejected");

  if (capturedEdit.kind === "insert") {
    const component = prepared.model.components.find(({ id }) => id === capturedEdit.componentId);
    if (component === undefined) return failure("acceptance-rejected");
    const compatibility = evaluateAuthoringSlotInsertion(
      capturedRoute,
      prepared.model,
      capturedSelection,
      component.id,
      capturedEdit.index,
    );
    if (!compatibility.accepted && compatibility.reason !== "defaults-invalid") {
      return failure(
        compatibility.reason === "maximum-reached" || compatibility.reason === "minimum-unreachable"
          ? "cardinality-rejected"
          : compatibility.reason === "contract-rejected"
            ? "acceptance-rejected"
            : compatibility.reason === "target-invalid"
              ? "target-invalid"
              : "defaults-invalid",
      );
    }
    const inserted = insertDesenEditorNode(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      parentId: capturedSelection.ownerId,
      slot: capturedSelection.slot,
      index: capturedEdit.index,
      idBase: insertionIdBase(component.id),
      use: component.id,
    });
    if (!inserted.ok) return failure("edit-rejected");
    const staged = stageDefaultProps(
      inserted.document,
      capturedRoute.surfaceId,
      inserted.insertedNodeId,
      component,
    );
    if (staged === undefined) return failure("defaults-invalid");
    const validationReport = validationReportForCandidate(prepared.model, staged);
    return validationReport?.valid !== true
      ? failure("defaults-invalid", validationReport)
      : Object.freeze({
          ok: true,
          document: staged,
          nodeId: inserted.insertedNodeId,
          operation: "insert",
        });
  }

  const placement = findNodePlacement(prepared.model, capturedRoute.surfaceId, capturedEdit.nodeId);
  if (placement === undefined || placement === null) return failure("target-invalid");
  const component = prepared.model.components.find(({ id }) => id === placement.node.capabilityId);
  if (component === undefined) return failure("source-invalid");

  const sameSlot =
    placement.owner.kind === capturedSelection.ownerKind &&
    placement.owner.id === capturedSelection.ownerId &&
    placement.slot.name === capturedSelection.slot;
  let changed: ReturnType<typeof moveDesenEditorNode> | ReturnType<typeof reorderDesenEditorNode>;
  let operation: "move" | "reorder";
  if (sameSlot) {
    const finalIndex =
      capturedEdit.index > placement.index ? capturedEdit.index - 1 : capturedEdit.index;
    changed = reorderDesenEditorNode(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      parentId: capturedSelection.ownerId,
      slot: capturedSelection.slot,
      nodeId: capturedEdit.nodeId,
      index: finalIndex,
    });
    operation = "reorder";
  } else {
    if (placement.slot.children.length - 1 < placement.slot.contract.minimum) {
      return failure("cardinality-rejected");
    }
    const compatibility = evaluateAuthoringSlotComponent(projection.slot, component);
    if (!compatibility.accepted) {
      return failure(
        compatibility.reason === "maximum-reached" ? "cardinality-rejected" : "acceptance-rejected",
      );
    }
    if (
      !projection.slot.present &&
      projection.slot.children.length + 1 < projection.slot.contract.minimum
    ) {
      return failure("cardinality-rejected");
    }
    changed = moveDesenEditorNode(prepared.model.validationDocument, {
      surfaceId: capturedRoute.surfaceId,
      parentId: capturedSelection.ownerId,
      slot: capturedSelection.slot,
      nodeId: capturedEdit.nodeId,
      index: capturedEdit.index,
    });
    operation = "move";
  }
  if (!changed.ok) return failure("edit-rejected");
  const validationReport = validationReportForCandidate(prepared.model, changed.document);
  return validationReport?.valid !== true
    ? failure("source-invalid", validationReport)
    : Object.freeze({
        ok: true,
        document: changed.document,
        nodeId: capturedEdit.nodeId,
        operation,
      });
}
