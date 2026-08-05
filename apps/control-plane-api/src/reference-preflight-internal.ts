import { canonicalizeJson, createCoreDiagnostic, createJsonPointer } from "@desen/protocol";
import { validateDesenBundleSemantics } from "@desen/validator";

import { readBundlePackagePreflightAuthority } from "./package-preflight-internal.js";
import {
  BUNDLE_REFERENCE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE,
  REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
} from "./reference-preflight-contract.js";

import type {
  CoreDiagnosticCode,
  DesenBundle,
  DesenCatalog,
  DesenDiagnosticContext,
  JsonPointer,
  JsonPointerSegment,
} from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";
import type { BundlePackagePreflightAuthority } from "./package-preflight-contract.js";
import type { BundlePackagePreflightAuthorityRecord } from "./package-preflight-internal.js";
import type {
  BundleReferencePreflightAuthority,
  BundleReferencePreflightDiagnostic,
  BundleReferencePreflightResult,
  BundleReferencePreflightStage,
  VerifiedBundleSurfaceReferences,
} from "./reference-preflight-contract.js";

type BundleSnapshot = ImmutableJson<DesenBundle>;
type SurfaceSnapshot = BundleSnapshot["surfaces"][string];
type NodeSnapshot = SurfaceSnapshot["root"];
type BehaviorSnapshot = NonNullable<NodeSnapshot["behaviors"]>[number];
type ActionSnapshot = NonNullable<NodeSnapshot["on"]>[string][number];
type PredicateSnapshot = NonNullable<NodeSnapshot["when"]>;
type CatalogSnapshot = ImmutableJson<DesenCatalog>;
type ComponentContract = CatalogSnapshot["components"][string];
type BehaviorContract = CatalogSnapshot["behaviors"][string];

interface ReferencePreflightPorts {
  readonly validateBundleSemantics: typeof validateDesenBundleSemantics;
}

interface CapabilityIndexes {
  readonly components: ReadonlyMap<string, ComponentContract>;
  readonly behaviors: ReadonlyMap<string, BehaviorContract>;
  readonly operations: ReadonlySet<string>;
  readonly resources: ReadonlySet<string>;
}

interface MutableSurfaceMetrics {
  sourceNodeCount: number;
  maximumMaterializedNodeCount: number;
  sourceTreeDepth: number;
  capabilityReferenceCount: number;
  actionCount: number;
  predicateNodeCount: number;
  settlementDepth: number;
}

interface ScanState {
  sourceNodes: number;
  actions: number;
  predicateNodes: number;
  references: number;
}

interface NodeWork {
  readonly node: NodeSnapshot;
  readonly pointer: readonly JsonPointerSegment[];
  readonly depth: number;
  readonly ancestorInstances: number;
}

interface ActionProgramWork {
  readonly actions: readonly ActionSnapshot[];
  readonly pointer: readonly JsonPointerSegment[];
  readonly settlementDepth: number;
}

interface CommandReference {
  readonly target: string;
  readonly command: string;
  readonly pointer: readonly JsonPointerSegment[];
}

interface ScanSuccess {
  readonly valid: true;
  readonly surfaces: readonly VerifiedBundleSurfaceReferences[];
}

interface ScanFailure {
  readonly valid: false;
  readonly stage: Extract<
    BundleReferencePreflightStage,
    "activation-limits" | "surface-capability-references"
  >;
  readonly diagnostic: BundleReferencePreflightDiagnostic;
}

type ScanResult = ScanSuccess | ScanFailure;

/** @internal Complete private T04 authority retained for staging and commit composition. */
export interface BundleReferencePreflightAuthorityRecord {
  readonly packageAuthority: BundlePackagePreflightAuthority;
  readonly packageRecord: BundlePackagePreflightAuthorityRecord;
  readonly bundle: BundleSnapshot;
  readonly surfaces: readonly VerifiedBundleSurfaceReferences[];
}

const ROOT_POINTER = createJsonPointer();
const AUTHORITIES = new WeakMap<
  BundleReferencePreflightAuthority,
  BundleReferencePreflightAuthorityRecord
>();
const DEFAULT_PORTS: ReferencePreflightPorts = Object.freeze({
  validateBundleSemantics: validateDesenBundleSemantics,
});
const PREDICATE_OPERATORS = new Set<string>([
  "all",
  "any",
  "not",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "exists",
  "truthy",
]);
const UNARY_PREDICATE_OPERATORS = new Set<string>(["not", "exists", "truthy"]);
const BINARY_PREDICATE_OPERATORS = new Set<string>([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
]);

function pointer(segments: readonly JsonPointerSegment[]): JsonPointer {
  return createJsonPointer(segments);
}

function sortedKeys(value: object): string[] {
  return Object.keys(value).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function extensionDiagnostic(
  code:
    typeof INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE | typeof REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
  message: string,
): BundleReferencePreflightDiagnostic {
  return Object.freeze({ code, message, pointer: ROOT_POINTER });
}

function rejection(
  stage: BundleReferencePreflightStage,
  diagnostics: readonly BundleReferencePreflightDiagnostic[],
): BundleReferencePreflightResult {
  return Object.freeze({
    status: "rejected",
    stage,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function internalRejection(): BundleReferencePreflightResult {
  return rejection("internal", [
    extensionDiagnostic(
      REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
      "Reference preflight could not complete its trusted implementation path.",
    ),
  ]);
}

function limitDiagnostic(
  segments: readonly JsonPointerSegment[],
): BundleReferencePreflightDiagnostic {
  return createCoreDiagnostic({
    code: "BUNDLE_LIMIT_EXCEEDED",
    message: "Bundle reference preflight exceeded the fixed activation profile.",
    pointer: pointer(segments),
  });
}

function limitFailure(segments: readonly JsonPointerSegment[]): ScanFailure {
  return Object.freeze({
    valid: false,
    stage: "activation-limits",
    diagnostic: limitDiagnostic(segments),
  });
}

function coreFailure(
  code: CoreDiagnosticCode,
  message: string,
  segments: readonly JsonPointerSegment[],
  context?: Readonly<DesenDiagnosticContext>,
): ScanFailure {
  return Object.freeze({
    valid: false,
    stage: "surface-capability-references",
    diagnostic: createCoreDiagnostic({
      code,
      message,
      pointer: pointer(segments),
      ...(context === undefined ? {} : { context }),
    }),
  });
}

function context(
  documentId: string,
  surfaceId?: string,
  subject?: Readonly<{ readonly kind: "node" | "behavior"; readonly id: string }>,
  capabilityId?: string,
): Readonly<DesenDiagnosticContext> {
  return Object.freeze({
    documentId,
    ...(surfaceId === undefined ? {} : { surfaceId }),
    ...(subject === undefined ? {} : { subject: Object.freeze(subject) }),
    ...(capabilityId === undefined ? {} : { capabilityId }),
  });
}

function chargeReference(
  state: ScanState,
  segments: readonly JsonPointerSegment[],
): ScanFailure | undefined {
  state.references += 1;
  return state.references > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences
    ? limitFailure(segments)
    : undefined;
}

function saturatingMultiply(left: number, right: number, saturation: number): number {
  if (left === 0 || right === 0) return 0;
  return left > Math.floor((saturation - 1) / right) ? saturation : left * right;
}

function saturatingAdd(left: number, right: number, saturation: number): number {
  return left >= saturation - right ? saturation : left + right;
}

function isPredicate(value: unknown): value is PredicateSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !Object.hasOwn(value, "op") || !Object.hasOwn(value, "args")) {
    return false;
  }
  const candidate = value as { readonly op?: unknown; readonly args?: unknown };
  if (
    typeof candidate.op !== "string" ||
    !PREDICATE_OPERATORS.has(candidate.op) ||
    !Array.isArray(candidate.args)
  ) {
    return false;
  }
  if (candidate.op === "all" || candidate.op === "any") {
    return candidate.args.length >= 1 && candidate.args.length <= 64;
  }
  if (UNARY_PREDICATE_OPERATORS.has(candidate.op)) return candidate.args.length === 1;
  return BINARY_PREDICATE_OPERATORS.has(candidate.op) && candidate.args.length === 2;
}

function scanPredicate(
  predicate: PredicateSnapshot,
  predicatePointer: readonly JsonPointerSegment[],
  state: ScanState,
  metrics: MutableSurfaceMetrics,
): ScanFailure | undefined {
  const pending: readonly Readonly<{
    readonly value: PredicateSnapshot;
    readonly pointer: readonly JsonPointerSegment[];
  }>[] = [{ value: predicate, pointer: predicatePointer }];
  const stack = [...pending];
  let expressionNodes = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    expressionNodes += 1;
    state.predicateNodes += 1;
    metrics.predicateNodeCount += 1;
    if (
      expressionNodes > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodesPerExpression ||
      state.predicateNodes > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateNodeOccurrences
    ) {
      return limitFailure(current.pointer);
    }
    if (current.value.args.length > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxPredicateArguments) {
      return limitFailure([...current.pointer, "args"]);
    }
    for (let index = current.value.args.length - 1; index >= 0; index -= 1) {
      const argument = current.value.args[index];
      if (isPredicate(argument)) {
        stack.push({ value: argument, pointer: [...current.pointer, "args", index] });
      }
    }
  }
  return undefined;
}

function capabilityIndexes(catalogSet: readonly CatalogSnapshot[]): CapabilityIndexes {
  const components = new Map<string, ComponentContract>();
  const behaviors = new Map<string, BehaviorContract>();
  const operations = new Set<string>();
  const resources = new Set<string>();
  for (const catalog of catalogSet) {
    for (const id of sortedKeys(catalog.components)) {
      const contract = catalog.components[id];
      if (contract !== undefined) components.set(id, contract);
    }
    for (const id of sortedKeys(catalog.behaviors)) {
      const contract = catalog.behaviors[id];
      if (contract !== undefined) behaviors.set(id, contract);
    }
    for (const id of sortedKeys(catalog.operations)) operations.add(id);
    for (const id of sortedKeys(catalog.resources)) resources.add(id);
  }
  return Object.freeze({ components, behaviors, operations, resources });
}

function scanActionPrograms(
  initialPrograms: readonly ActionProgramWork[],
  surfaceId: string,
  surface: SurfaceSnapshot,
  document: BundleSnapshot,
  indexes: CapabilityIndexes,
  nodeCapabilities: ReadonlyMap<string, string>,
  commandReferences: CommandReference[],
  state: ScanState,
  metrics: MutableSurfaceMetrics,
): ScanFailure | undefined {
  const programs = [...initialPrograms].reverse();
  const resources = new Set(sortedKeys(surface.resources));
  const surfaceIds = new Set(sortedKeys(document.surfaces));

  while (programs.length > 0) {
    const program = programs.pop();
    if (program === undefined) break;
    if (program.actions.length > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionsPerTurn) {
      return limitFailure(program.pointer);
    }
    if (program.settlementDepth > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSettlementDepth) {
      return limitFailure(program.pointer);
    }
    metrics.settlementDepth = Math.max(metrics.settlementDepth, program.settlementDepth);

    const nested: ActionProgramWork[] = [];
    for (let index = 0; index < program.actions.length; index += 1) {
      const action = program.actions[index];
      if (action === undefined) continue;
      const actionPointer = [...program.pointer, index];
      state.actions += 1;
      metrics.actionCount += 1;
      if (state.actions > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxActionOccurrences) {
        return limitFailure(actionPointer);
      }
      if (action.when !== undefined) {
        const predicateFailure = scanPredicate(
          action.when,
          [...actionPointer, "when"],
          state,
          metrics,
        );
        if (predicateFailure !== undefined) return predicateFailure;
      }

      switch (action.type) {
        case "navigate": {
          const charged = chargeReference(state, [...actionPointer, "surface"]);
          if (charged !== undefined) return charged;
          if (!surfaceIds.has(action.surface)) {
            return coreFailure(
              "ENTRY_NOT_FOUND",
              "A navigation action targets a surface that is not in this Bundle.",
              [...actionPointer, "surface"],
              context(document.id, surfaceId),
            );
          }
          break;
        }
        case "operation.invoke": {
          const charged = chargeReference(state, [...actionPointer, "operation"]);
          if (charged !== undefined) return charged;
          metrics.capabilityReferenceCount += 1;
          if (!indexes.operations.has(action.operation)) {
            return coreFailure(
              "UNKNOWN_CAPABILITY",
              "An operation action references an undeclared operation capability.",
              [...actionPointer, "operation"],
              context(document.id, surfaceId, undefined, action.operation),
            );
          }
          if (action.onSuccess !== undefined) {
            nested.push({
              actions: action.onSuccess,
              pointer: [...actionPointer, "onSuccess"],
              settlementDepth: program.settlementDepth + 1,
            });
          }
          if (action.onFailure !== undefined) {
            nested.push({
              actions: action.onFailure,
              pointer: [...actionPointer, "onFailure"],
              settlementDepth: program.settlementDepth + 1,
            });
          }
          break;
        }
        case "resource.refresh": {
          const charged = chargeReference(state, [...actionPointer, "resource"]);
          if (charged !== undefined) return charged;
          if (!resources.has(action.resource)) {
            return coreFailure(
              "REFERENCE_UNRESOLVED",
              "A resource refresh action references an undeclared surface resource.",
              [...actionPointer, "resource"],
              context(document.id, surfaceId),
            );
          }
          break;
        }
        case "component.command": {
          const targetCharge = chargeReference(state, [...actionPointer, "target"]);
          if (targetCharge !== undefined) return targetCharge;
          const commandCharge = chargeReference(state, [...actionPointer, "command"]);
          if (commandCharge !== undefined) return commandCharge;
          commandReferences.push(
            Object.freeze({
              target: action.target,
              command: action.command,
              pointer: actionPointer,
            }),
          );
          break;
        }
        case "event.emit": {
          const charged = chargeReference(state, [...actionPointer, "name"]);
          if (charged !== undefined) return charged;
          break;
        }
        case "state.set":
        case "state.toggle":
          break;
      }
    }
    for (let index = nested.length - 1; index >= 0; index -= 1) {
      const child = nested[index];
      if (child !== undefined) programs.push(child);
    }
  }

  for (const reference of commandReferences) {
    const componentId = nodeCapabilities.get(reference.target);
    if (componentId === undefined) {
      return coreFailure(
        "UNKNOWN_COMMAND",
        "A component command target is not a component node in this surface.",
        [...reference.pointer, "target"],
        context(document.id, surfaceId),
      );
    }
    const component = indexes.components.get(componentId);
    if (
      component === undefined ||
      component.commands === undefined ||
      !Object.hasOwn(component.commands, reference.command)
    ) {
      return coreFailure(
        "UNKNOWN_COMMAND",
        "A component command is not declared by the target capability.",
        [...reference.pointer, "command"],
        context(document.id, surfaceId, undefined, componentId),
      );
    }
  }
  return undefined;
}

function scanHandlers(
  handlers: NodeSnapshot["on"] | BehaviorSnapshot["on"],
  ownerPointer: readonly JsonPointerSegment[],
  contract: ComponentContract | BehaviorContract,
  programs: ActionProgramWork[],
  state: ScanState,
  documentId: string,
  surfaceId: string,
  subject: Readonly<{ readonly kind: "node" | "behavior"; readonly id: string }>,
): ScanFailure | undefined {
  if (handlers === undefined) return undefined;
  for (const eventName of sortedKeys(handlers)) {
    const eventPointer = [...ownerPointer, "on", eventName];
    const charged = chargeReference(state, eventPointer);
    if (charged !== undefined) return charged;
    if (contract.events === undefined || !Object.hasOwn(contract.events, eventName)) {
      return coreFailure(
        "UNKNOWN_EVENT",
        "An event handler references an event not declared by its capability.",
        eventPointer,
        context(documentId, surfaceId, subject),
      );
    }
    const actions = handlers[eventName];
    if (actions !== undefined)
      programs.push({ actions, pointer: eventPointer, settlementDepth: 0 });
  }
  return undefined;
}

function repeatFactor(
  node: NodeSnapshot,
  nodePointer: readonly JsonPointerSegment[],
): Readonly<{ readonly factor: number }> | ScanFailure {
  if (node.repeat === undefined) return Object.freeze({ factor: 1 });
  const declared = node.repeat.limit;
  const effective = Math.min(
    declared ?? BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances,
    BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxRepeatInstances,
  );
  if (Array.isArray(node.repeat.items)) {
    if (node.repeat.items.length > effective) {
      return limitFailure([...nodePointer, "repeat", "items"]);
    }
    return Object.freeze({ factor: node.repeat.items.length });
  }
  return Object.freeze({ factor: effective });
}

function pushSlotChildren(
  destination: NodeWork[],
  slots: NodeSnapshot["slots"] | BehaviorSnapshot["slots"],
  ownerPointer: readonly JsonPointerSegment[],
  depth: number,
  ancestorInstances: number,
): void {
  if (slots === undefined) return;
  for (const slotName of sortedKeys(slots)) {
    const children = slots[slotName];
    if (children === undefined) continue;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child !== undefined) {
        destination.push({
          node: child,
          pointer: [...ownerPointer, "slots", slotName, index],
          depth,
          ancestorInstances,
        });
      }
    }
  }
}

function scanSurface(
  document: BundleSnapshot,
  surfaceId: string,
  surface: SurfaceSnapshot,
  indexes: CapabilityIndexes,
  state: ScanState,
): ScanResult {
  const surfacePointer: readonly JsonPointerSegment[] = ["surfaces", surfaceId];
  const metrics: MutableSurfaceMetrics = {
    sourceNodeCount: 0,
    maximumMaterializedNodeCount: 0,
    sourceTreeDepth: 0,
    capabilityReferenceCount: 0,
    actionCount: 0,
    predicateNodeCount: 0,
    settlementDepth: 0,
  };
  const identities = new Set<string>();
  const nodeCapabilities = new Map<string, string>();
  const programs: ActionProgramWork[] = [];
  const commandReferences: CommandReference[] = [];

  for (const resourceName of sortedKeys(surface.resources)) {
    const resource = surface.resources[resourceName];
    if (resource === undefined) continue;
    const usePointer = [...surfacePointer, "resources", resourceName, "use"];
    const charged = chargeReference(state, usePointer);
    if (charged !== undefined) return charged;
    metrics.capabilityReferenceCount += 1;
    if (!indexes.resources.has(resource.use)) {
      return coreFailure(
        "UNKNOWN_CAPABILITY",
        "A surface resource references an undeclared resource capability.",
        usePointer,
        context(document.id, surfaceId, undefined, resource.use),
      );
    }
  }

  const pending: NodeWork[] = [
    { node: surface.root, pointer: [...surfacePointer, "root"], depth: 0, ancestorInstances: 1 },
  ];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    metrics.sourceNodeCount += 1;
    state.sourceNodes += 1;
    metrics.sourceTreeDepth = Math.max(metrics.sourceTreeDepth, current.depth);
    if (
      metrics.sourceNodeCount > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodesPerSurface ||
      state.sourceNodes > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceNodes ||
      current.depth > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceTreeDepth
    ) {
      return limitFailure(current.pointer);
    }

    const factor = repeatFactor(current.node, current.pointer);
    if (!("factor" in factor)) return factor;
    const currentInstances = saturatingMultiply(
      current.ancestorInstances,
      factor.factor,
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface + 1,
    );
    metrics.maximumMaterializedNodeCount = saturatingAdd(
      metrics.maximumMaterializedNodeCount,
      currentInstances,
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface + 1,
    );
    if (
      metrics.maximumMaterializedNodeCount >
      BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface
    ) {
      return limitFailure(current.pointer);
    }

    const nodeSubject = Object.freeze({ kind: "node" as const, id: current.node.id });
    if (identities.has(current.node.id)) {
      return coreFailure(
        "DUPLICATE_NODE_ID",
        "A node or behavior identifier is duplicated within its surface.",
        [...current.pointer, "id"],
        context(document.id, surfaceId, nodeSubject),
      );
    }
    identities.add(current.node.id);
    nodeCapabilities.set(current.node.id, current.node.use);

    const component = indexes.components.get(current.node.use);
    const usePointer = [...current.pointer, "use"];
    const componentCharge = chargeReference(state, usePointer);
    if (componentCharge !== undefined) return componentCharge;
    metrics.capabilityReferenceCount += 1;
    if (component === undefined) {
      return coreFailure(
        "UNKNOWN_CAPABILITY",
        "A node references an undeclared component capability.",
        usePointer,
        context(document.id, surfaceId, nodeSubject, current.node.use),
      );
    }
    if (current.node.when !== undefined) {
      const predicateFailure = scanPredicate(
        current.node.when,
        [...current.pointer, "when"],
        state,
        metrics,
      );
      if (predicateFailure !== undefined) return predicateFailure;
    }
    if (current.node.variants !== undefined) {
      for (let index = 0; index < current.node.variants.length; index += 1) {
        const variant = current.node.variants[index];
        if (variant === undefined) continue;
        const predicateFailure = scanPredicate(
          variant.when,
          [...current.pointer, "variants", index, "when"],
          state,
          metrics,
        );
        if (predicateFailure !== undefined) return predicateFailure;
      }
    }
    const nodeHandlerFailure = scanHandlers(
      current.node.on,
      current.pointer,
      component,
      programs,
      state,
      document.id,
      surfaceId,
      nodeSubject,
    );
    if (nodeHandlerFailure !== undefined) return nodeHandlerFailure;

    const children: NodeWork[] = [];
    if (current.node.behaviors !== undefined) {
      for (
        let behaviorIndex = 0;
        behaviorIndex < current.node.behaviors.length;
        behaviorIndex += 1
      ) {
        const behavior = current.node.behaviors[behaviorIndex];
        if (behavior === undefined) continue;
        const behaviorPointer = [...current.pointer, "behaviors", behaviorIndex];
        const behaviorSubject = Object.freeze({ kind: "behavior" as const, id: behavior.id });
        if (identities.has(behavior.id)) {
          return coreFailure(
            "DUPLICATE_NODE_ID",
            "A node or behavior identifier is duplicated within its surface.",
            [...behaviorPointer, "id"],
            context(document.id, surfaceId, behaviorSubject),
          );
        }
        identities.add(behavior.id);
        const behaviorContract = indexes.behaviors.get(behavior.use);
        const behaviorUsePointer = [...behaviorPointer, "use"];
        const behaviorCharge = chargeReference(state, behaviorUsePointer);
        if (behaviorCharge !== undefined) return behaviorCharge;
        metrics.capabilityReferenceCount += 1;
        if (behaviorContract === undefined) {
          return coreFailure(
            "UNKNOWN_CAPABILITY",
            "A behavior instance references an undeclared behavior capability.",
            behaviorUsePointer,
            context(document.id, surfaceId, behaviorSubject, behavior.use),
          );
        }
        const behaviorHandlerFailure = scanHandlers(
          behavior.on,
          behaviorPointer,
          behaviorContract,
          programs,
          state,
          document.id,
          surfaceId,
          behaviorSubject,
        );
        if (behaviorHandlerFailure !== undefined) return behaviorHandlerFailure;
        pushSlotChildren(
          children,
          behavior.slots,
          behaviorPointer,
          current.depth + 1,
          currentInstances,
        );
      }
    }
    pushSlotChildren(
      children,
      current.node.slots,
      current.pointer,
      current.depth + 1,
      currentInstances,
    );
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push(child);
    }
  }

  const actionFailure = scanActionPrograms(
    programs,
    surfaceId,
    surface,
    document,
    indexes,
    nodeCapabilities,
    commandReferences,
    state,
    metrics,
  );
  if (actionFailure !== undefined) return actionFailure;

  const verified = Object.freeze({ id: surfaceId, ...metrics });
  return Object.freeze({ valid: true, surfaces: Object.freeze([verified]) });
}

function scanBundle(bundle: BundleSnapshot, catalogSet: readonly CatalogSnapshot[]): ScanResult {
  const surfaceIds = sortedKeys(bundle.surfaces);
  if (surfaceIds.length > BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSurfaces) {
    return limitFailure(["surfaces"]);
  }
  const state: ScanState = { sourceNodes: 0, actions: 0, predicateNodes: 0, references: 0 };
  const entryCharge = chargeReference(state, ["entry"]);
  if (entryCharge !== undefined) return entryCharge;
  if (!Object.hasOwn(bundle.surfaces, bundle.entry)) {
    return coreFailure(
      "ENTRY_NOT_FOUND",
      "The declared entry surface does not exist.",
      ["entry"],
      context(bundle.id),
    );
  }
  const indexes = capabilityIndexes(catalogSet);
  const verifiedSurfaces: VerifiedBundleSurfaceReferences[] = [];
  for (const surfaceId of surfaceIds) {
    const surface = bundle.surfaces[surfaceId];
    if (surface === undefined) continue;
    if (surface.id !== surfaceId) {
      return coreFailure(
        "DUPLICATE_SURFACE_ID",
        "A surface identity differs from its map key.",
        ["surfaces", surfaceId, "id"],
        context(bundle.id, surfaceId),
      );
    }
    const result = scanSurface(bundle, surfaceId, surface, indexes, state);
    if (!result.valid) return result;
    const verified = result.surfaces[0];
    if (verified !== undefined) verifiedSurfaces.push(verified);
  }
  return Object.freeze({ valid: true, surfaces: Object.freeze(verifiedSurfaces) });
}

function createAuthority(
  packageAuthority: BundlePackagePreflightAuthority,
  packageRecord: BundlePackagePreflightAuthorityRecord,
  bundle: BundleSnapshot,
  surfaces: readonly VerifiedBundleSurfaceReferences[],
): BundleReferencePreflightResult {
  const authority = Object.freeze({
    profile: "desen.reference.activation-preflight",
    profileVersion: 1,
    protocolVersion: "0.1.0",
    revision: packageRecord.integrityRecord.revision,
    surfaces,
  }) as BundleReferencePreflightAuthority;
  AUTHORITIES.set(authority, Object.freeze({ packageAuthority, packageRecord, bundle, surfaces }));
  return Object.freeze({ status: "preflighted", authority });
}

/** @internal Authenticates and reads one exact live M07-T04 reference-preflight authority. */
export function readBundleReferencePreflightAuthority(
  authority: unknown,
): BundleReferencePreflightAuthorityRecord | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority as BundleReferencePreflightAuthority)
    : undefined;
}

/** @internal Returns whether a value is an exact live M07-T04 authority. */
export function isBundleReferencePreflightAuthority(
  value: unknown,
): value is BundleReferencePreflightAuthority {
  return readBundleReferencePreflightAuthority(value) !== undefined;
}

/** @internal Package-private implementation with injectable pure verification ports for tests. */
export function preflightBundleReferencesInternal(
  packageAuthority: BundlePackagePreflightAuthority,
  ports: ReferencePreflightPorts = DEFAULT_PORTS,
): BundleReferencePreflightResult {
  const packageRecord = readBundlePackagePreflightAuthority(packageAuthority);
  if (packageRecord === undefined) {
    return rejection("package-authority", [
      extensionDiagnostic(
        INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE,
        "Reference preflight requires an authentic installed-package authority.",
      ),
    ]);
  }

  try {
    const bundle = packageRecord.integrityRecord.bundle;
    const scan = scanBundle(bundle, packageRecord.catalogSet);
    if (!scan.valid) return rejection(scan.stage, [scan.diagnostic]);

    const semantics = ports.validateBundleSemantics(bundle, packageRecord.catalogSet);
    if (!semantics.valid) return internalRejection();
    if (canonicalizeJson(semantics.value) !== canonicalizeJson(bundle)) {
      return internalRejection();
    }
    return createAuthority(packageAuthority, packageRecord, bundle, scan.surfaces);
  } catch {
    return internalRejection();
  }
}
