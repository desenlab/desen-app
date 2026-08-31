import type { JsonValue } from "@desen/catalog-sdk";
import type { DesenEditorDocument } from "@desen/editor-core";
import type { AuthoringOperationAliasOption } from "./behavior-controls.js";

type SourceNode = DesenEditorDocument["surfaces"][string]["root"];
type SourceBehavior = NonNullable<SourceNode["behaviors"]>[number];
type SourceAction = NonNullable<SourceNode["on"]>[string][number];

const MAX_OWNER_OCCURRENCES = 25_000;
const MAX_ACTION_OCCURRENCES = 25_000;
const REFERENCE_SAFE_ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,127}$/u;

/** Bounded, callback-free behavior information needed by selected-layer controls. */
export type AuthoringBehaviorProjection =
  | Readonly<{
      readonly status: "ready";
      readonly currentWhen: JsonValue | null;
      readonly inputConnectionStateName: string | null;
      readonly operationAliases: readonly AuthoringOperationAliasOption[];
    }>
  | Readonly<{ readonly status: "rejected" }>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactReference(value: unknown, expected: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 1 &&
    keys[0] === "$ref" &&
    (value as Readonly<Record<string, unknown>>).$ref === expected
  );
}

function isExactCanonicalInputWrite(action: SourceAction, stateName: string): boolean {
  const keys = Object.keys(action);
  return (
    keys.length === 3 &&
    keys.includes("type") &&
    keys.includes("path") &&
    keys.includes("value") &&
    action.type === "state.set" &&
    action.path === stateName &&
    exactReference(action.value, "event.value")
  );
}

function inputConnectionStateName(node: SourceNode): string | null {
  const value = node.props?.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const reference = (value as Readonly<Record<string, unknown>>).$ref;
  if (
    Object.keys(value).length !== 1 ||
    typeof reference !== "string" ||
    !reference.startsWith("state.")
  ) {
    return null;
  }
  const stateName = reference.slice("state.".length);
  const writes = (node.on?.change ?? []).filter(
    (action) => action.type === "state.set" && action.path === stateName,
  );
  const write = writes[0];
  return writes.length === 1 && write !== undefined && isExactCanonicalInputWrite(write, stateName)
    ? stateName
    : null;
}

/**
 * Projects current condition data and operation result names from one exact Source surface.
 *
 * @remarks Operation names come only from authored `operation.invoke` actions. Conflicting reuse of
 * an alias by different operations is excluded rather than guessed. Traversal is bounded and does
 * not execute, resolve, or retain any host authority.
 */
export function projectAuthoringBehaviorControls(
  document: DesenEditorDocument,
  surfaceId: string,
  selectedNodeId: string,
): AuthoringBehaviorProjection {
  const surface = document.surfaces[surfaceId];
  if (surface === undefined || selectedNodeId.length === 0) {
    return Object.freeze({ status: "rejected" });
  }

  const nodes: SourceNode[] = [surface.root];
  const actions: SourceAction[] = [];
  const aliases = new Map<string, string>();
  const conflictedAliases = new Set<string>();
  let selected: SourceNode | null = null;
  let ownersVisited = 0;
  let ownersScheduled = 1;
  let actionsVisited = 0;
  let actionsScheduled = 0;

  const scheduleActions = (
    on: Readonly<Record<string, readonly SourceAction[]>> | undefined,
  ): boolean => {
    if (on === undefined) return true;
    for (const actionList of Object.values(on)) {
      for (const action of actionList) {
        actionsScheduled += 1;
        if (actionsScheduled > MAX_ACTION_OCCURRENCES) return false;
        actions.push(action);
      }
    }
    return true;
  };

  const scheduleNode = (node: SourceNode): boolean => {
    ownersScheduled += 1;
    if (ownersScheduled > MAX_OWNER_OCCURRENCES) return false;
    nodes.push(node);
    return true;
  };

  while (nodes.length > 0) {
    const node = nodes.pop();
    if (node === undefined) continue;
    ownersVisited += 1;
    if (ownersVisited > MAX_OWNER_OCCURRENCES) return Object.freeze({ status: "rejected" });
    if (node.id === selectedNodeId) {
      if (selected !== null) return Object.freeze({ status: "rejected" });
      selected = node;
    }
    if (!scheduleActions(node.on)) return Object.freeze({ status: "rejected" });
    for (const children of Object.values(node.slots ?? {})) {
      for (const child of children) {
        if (!scheduleNode(child)) return Object.freeze({ status: "rejected" });
      }
    }
    for (const behavior of node.behaviors ?? []) {
      ownersVisited += 1;
      if (ownersVisited > MAX_OWNER_OCCURRENCES) return Object.freeze({ status: "rejected" });
      if (!scheduleActions(behavior.on)) return Object.freeze({ status: "rejected" });
      for (const children of Object.values((behavior as SourceBehavior).slots ?? {})) {
        for (const child of children) {
          if (!scheduleNode(child)) return Object.freeze({ status: "rejected" });
        }
      }
    }
  }

  while (actions.length > 0) {
    const action = actions.pop();
    if (action === undefined) continue;
    actionsVisited += 1;
    if (actionsVisited > MAX_ACTION_OCCURRENCES) return Object.freeze({ status: "rejected" });
    if (action.type !== "operation.invoke") continue;
    if (!REFERENCE_SAFE_ALIAS_PATTERN.test(action.as)) {
      for (const nested of action.onSuccess ?? []) {
        actionsScheduled += 1;
        if (actionsScheduled > MAX_ACTION_OCCURRENCES) {
          return Object.freeze({ status: "rejected" });
        }
        actions.push(nested);
      }
      for (const nested of action.onFailure ?? []) {
        actionsScheduled += 1;
        if (actionsScheduled > MAX_ACTION_OCCURRENCES) {
          return Object.freeze({ status: "rejected" });
        }
        actions.push(nested);
      }
      continue;
    }
    const previous = aliases.get(action.as);
    if (previous !== undefined && previous !== action.operation) {
      conflictedAliases.add(action.as);
      aliases.delete(action.as);
    } else if (!conflictedAliases.has(action.as)) {
      aliases.set(action.as, action.operation);
    }
    for (const nested of action.onSuccess ?? []) {
      actionsScheduled += 1;
      if (actionsScheduled > MAX_ACTION_OCCURRENCES) {
        return Object.freeze({ status: "rejected" });
      }
      actions.push(nested);
    }
    for (const nested of action.onFailure ?? []) {
      actionsScheduled += 1;
      if (actionsScheduled > MAX_ACTION_OCCURRENCES) {
        return Object.freeze({ status: "rejected" });
      }
      actions.push(nested);
    }
  }

  if (selected === null) return Object.freeze({ status: "rejected" });
  const operationAliases = Object.freeze(
    [...aliases]
      .sort(([left], [right]) => compareText(left, right))
      .map(([alias, operationId]) => Object.freeze({ alias, operationId })),
  );
  return Object.freeze({
    status: "ready",
    currentWhen: (selected.when ?? null) as JsonValue | null,
    inputConnectionStateName: inputConnectionStateName(selected),
    operationAliases,
  });
}
