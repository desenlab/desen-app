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
import type { DesenEditorContentValue, DesenEditorDocument } from "@desen/editor-core";
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
  | "defaults-invalid"
  | "edit-rejected"
  | "preview-unavailable"
  | "source-invalid"
  | "target-invalid";

/** Atomic named-slot failure with no partial document or allocated identity. */
export interface AuthoringSlotEditFailure {
  readonly ok: false;
  readonly reason: AuthoringSlotEditFailureReason;
}

/** Complete result of one App-owned named-slot edit. */
export type AuthoringSlotEditResult = AuthoringSlotEditFailure | AuthoringSlotEditSuccess;

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
  let prepared = VALIDATOR_BY_MODEL.get(model);
  if (prepared === undefined) {
    prepared = createDesenEditorContinuousValidator(model.validationCatalogs);
    VALIDATOR_BY_MODEL.set(model, prepared);
  }
  if (!prepared.ok) return undefined;
  const report = prepared.validator.validate(candidate);
  return report.valid ? candidate : undefined;
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

function failure(reason: AuthoringSlotEditFailureReason): AuthoringSlotEditFailure {
  return Object.freeze({ ok: false, reason });
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
  const compatibility = evaluateAuthoringNodeDeletion(
    capturedRoute,
    prepared.model,
    capturedSelection,
  );
  if (!compatibility.accepted) return failure(compatibility.reason);

  const changed = deleteDesenEditorNode(prepared.model.validationDocument, {
    surfaceId: capturedRoute.surfaceId,
    nodeId: capturedSelection.sourceNodeId,
  });
  if (!changed.ok) return failure("edit-rejected");
  const validated = validateCandidate(prepared.model, changed.document);
  return validated === undefined
    ? failure("source-invalid")
    : Object.freeze({
        ok: true,
        document: validated,
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
    if (!compatibility.accepted) {
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
    const validated = validateCandidate(prepared.model, staged);
    return validated === undefined
      ? failure("defaults-invalid")
      : Object.freeze({
          ok: true,
          document: validated,
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
  const validated = validateCandidate(prepared.model, changed.document);
  return validated === undefined
    ? failure("source-invalid")
    : Object.freeze({
        ok: true,
        document: validated,
        nodeId: capturedEdit.nodeId,
        operation,
      });
}
