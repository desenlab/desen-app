import { RecipeMaterializationError } from "./master-instance-materialization.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { EditableProjectRecipeOwner } from "./master-instance-types.js";

/** Internal mutable copy type; only detached, admitted JSON reaches recipe editing helpers. */
export type MutableRecipeJson<Value> = Value extends readonly (infer Item)[]
  ? MutableRecipeJson<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableRecipeJson<Value[Key]> }
    : Value;

/** Ordinary Source types shared by the internal recipe transaction helpers. */
export type RecipeSourceSurface = DesenEditorDocument["surfaces"][string];
/** An ordinary component, without authoring-only recipe discriminators. */
export type RecipeSourceNode = RecipeSourceSurface["root"];
/** Ordinary attached behavior with its own handlers and slots. */
export type RecipeSourceBehavior = NonNullable<RecipeSourceNode["behaviors"]>[number];
/** Component and behavior owners share one surface-local Source identity namespace. */
export type RecipeSourceOwner = RecipeSourceNode | RecipeSourceBehavior;
/** Source action, including recursive operation settlement handlers. */
export type RecipeSourceAction = NonNullable<RecipeSourceNode["on"]>[string][number];
/** Detached Source surface edited only before final complete-project admission. */
export type MutableRecipeSourceSurface = MutableRecipeJson<RecipeSourceSurface>;
type MutableNode = MutableRecipeJson<RecipeSourceNode>;
type MutableOwner = MutableRecipeJson<RecipeSourceOwner>;

/** Exact component location; a missing parent identifies a surface root. */
export interface RecipeSourceLocation {
  readonly node: MutableNode;
  readonly parent?: MutableOwner;
  readonly slot?: string;
  readonly index?: number;
}

/** Structural lookup over the entire shared component/behavior namespace. */
export interface RecipeSourceIndex {
  readonly nodes: Map<string, RecipeSourceLocation>;
  readonly owners: Map<string, MutableOwner>;
}

/** Namespace-qualified ordinary Source reference, never inferred from arbitrary strings. */
export interface RecipeSourceReference {
  readonly kind: EditableProjectRecipeOwner["kind"];
  readonly id: string;
}

/** Clones only already captured/admitted inert data, without invoking caller objects. */
export function cloneRecipeJson<Value>(value: Value): MutableRecipeJson<Value> {
  return JSON.parse(JSON.stringify(value)) as MutableRecipeJson<Value>;
}

/** Indexes a detached Source surface and rejects ambiguous node/behavior identities. */
export function indexRecipeSource(surface: MutableRecipeSourceSurface): RecipeSourceIndex {
  const nodes = new Map<string, RecipeSourceLocation>();
  const owners = new Map<string, MutableOwner>();
  function reserve(value: MutableOwner): void {
    if (owners.has(value.id)) throw new RecipeMaterializationError("ambiguous-source-identity");
    owners.set(value.id, value);
  }
  function slots(owner: MutableOwner): void {
    for (const [slot, children] of Object.entries(owner.slots ?? {})) {
      children.forEach((node, index) => visit({ node, parent: owner, slot, index }));
    }
  }
  function visit(location: RecipeSourceLocation): void {
    const node = location.node;
    reserve(node);
    nodes.set(node.id, location);
    slots(node);
    for (const behavior of node.behaviors ?? []) {
      reserve(behavior);
      slots(behavior);
    }
  }
  visit({ node: surface.root });
  return { nodes, owners };
}

/** Walks schema-owned component/behavior positions, optionally excluding nested managed regions. */
export function visitRecipeSourceOwners(
  root: RecipeSourceNode,
  visit: (owner: RecipeSourceOwner, kind: "node" | "behavior") => void,
  excludedRoots: ReadonlySet<string> = new Set(),
): void {
  if (excludedRoots.has(root.id)) return;
  visit(root, "node");
  for (const children of Object.values(root.slots ?? {})) {
    for (const child of children) visitRecipeSourceOwners(child, visit, excludedRoots);
  }
  for (const behavior of root.behaviors ?? []) {
    visit(behavior, "behavior");
    for (const children of Object.values(behavior.slots ?? {})) {
      for (const child of children) visitRecipeSourceOwners(child, visit, excludedRoots);
    }
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function values(value: unknown, report: (reference: RecipeSourceReference) => void): void {
  const record = object(value);
  if (record !== undefined) for (const child of Object.values(record)) binding(child, report);
}

function binding(value: unknown, report: (reference: RecipeSourceReference) => void): void {
  if (Array.isArray(value)) {
    for (const child of value) binding(child, report);
    return;
  }
  const record = object(value);
  if (record === undefined) return;
  if (typeof record.$ref === "string") {
    const [kind, id] = record.$ref.split(".");
    if ((kind === "state" || kind === "resource" || kind === "operation") && id !== undefined) {
      report({ kind, id });
    }
    if (Object.hasOwn(record, "fallback")) binding(record.fallback, report);
  } else if (Object.hasOwn(record, "$format")) {
    values(object(record.$format)?.values, report);
  } else if (!Object.hasOwn(record, "$token")) {
    values(record, report);
  }
}

function actions(
  items: readonly RecipeSourceAction[],
  report: (reference: RecipeSourceReference) => void,
  declare: (alias: string) => void,
): void {
  for (const action of items) {
    binding(action.when, report);
    if (action.type === "state.set" || action.type === "state.toggle") {
      const id = action.path.split(".")[0];
      if (id !== undefined) report({ kind: "state", id });
      if (action.type === "state.set") binding(action.value, report);
    } else if (action.type === "resource.refresh") {
      report({ kind: "resource", id: action.resource });
    } else if (action.type === "component.command") {
      report({ kind: "node", id: action.target });
      values(action.input, report);
    } else if (action.type === "operation.invoke") {
      declare(action.as);
      values(action.input, report);
      actions(action.onSuccess ?? [], report, declare);
      actions(action.onFailure ?? [], report, declare);
    } else if (action.type === "navigate") {
      values(action.params, report);
    } else if (action.type === "event.emit") {
      values(action.payload, report);
    }
  }
}

/** Collects references/declarations from semantic owner fields, preserving opaque extensions. */
export function inspectRecipeSourceOwner(
  owner: RecipeSourceOwner,
  report: (reference: RecipeSourceReference) => void,
  declare: (alias: string) => void,
): void {
  values(owner.props, report);
  binding(owner.style, report);
  if ("when" in owner) binding(owner.when, report);
  if ("repeat" in owner) {
    binding(owner.repeat?.items, report);
    binding(owner.repeat?.key, report);
  }
  if ("variants" in owner) {
    for (const variant of owner.variants ?? []) {
      binding(variant.when, report);
      values(variant.props, report);
      binding(variant.style, report);
    }
  }
  for (const items of Object.values(owner.on ?? {})) actions(items, report, declare);
}

/** Inspects resource input ValueSpecs, not schema data, state initials or opaque extensions. */
export function inspectRecipeResource(
  resource: RecipeSourceSurface["resources"][string],
  report: (reference: RecipeSourceReference) => void,
): void {
  values(resource.input, report);
}

/** Collects all schema-owned references after an atomic candidate is fully materialized. */
export function recipeSourceReferences(
  surface: RecipeSourceSurface,
): readonly RecipeSourceReference[] {
  const references: RecipeSourceReference[] = [];
  const report = (reference: RecipeSourceReference): void => {
    references.push(reference);
  };
  visitRecipeSourceOwners(surface.root, (owner) =>
    inspectRecipeSourceOwner(owner, report, () => undefined),
  );
  for (const resource of Object.values(surface.resources)) inspectRecipeResource(resource, report);
  return references;
}

/** Reserves every existing identity before allocation, including unmanaged operation aliases. */
export function recipeSourceIdentities(surface: RecipeSourceSurface): ReadonlySet<string> {
  const identities = new Set([...Object.keys(surface.state), ...Object.keys(surface.resources)]);
  visitRecipeSourceOwners(surface.root, (owner) => {
    identities.add(owner.id);
    inspectRecipeSourceOwner(
      owner,
      () => undefined,
      (alias) => {
        identities.add(alias);
      },
    );
  });
  return identities;
}
