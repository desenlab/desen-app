import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol";

import { captureDesignSystemJson } from "./inert-json.js";
import { EDITABLE_PROJECT_RECIPE_LIMITS } from "./master-instance-types.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type {
  EditableProjectInstanceMapping,
  EditableProjectInstanceOverride,
  EditableProjectMasterDefinition,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = Record<string, Json>;
type Surface = DesenEditorDocument["surfaces"][string];
type OwnerKind = EditableProjectRecipeOwner["kind"];
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;

/** Internal controlled rejection; no partial materialization escapes a failed transaction. */
export class RecipeMaterializationError extends Error {
  /** Stable reason used by the graph/transaction admission boundaries. */
  readonly reason: string;

  /** Creates a bounded failure without including arbitrary caller data. */
  constructor(reason: string) {
    super(`Recipe materialization rejected: ${reason}.`);
    this.name = "RecipeMaterializationError";
    this.reason = reason;
  }
}

/** Complete ordinary Source content and durable identity provenance for one instance. */
export interface RecipeMaterialization {
  /** Ordinary materialized component subtree. */
  readonly root: Surface["root"];
  /** Instance-local remapped state declarations. */
  readonly state: Surface["state"];
  /** Instance-local remapped resource declarations. */
  readonly resources: Surface["resources"];
  /** Complete stable mapping, sorted by qualified conceptual identity. */
  readonly mapping: readonly EditableProjectInstanceMapping[];
  /** Identity of the complete transitive master definition closure. */
  readonly definitionDigest: string;
  /** Identity of the emitted subtree and its owned binding declarations. */
  readonly materializedDigest: string;
}

interface Scope {
  readonly definition: EditableProjectMasterDefinition;
  readonly path: readonly string[];
}

function fail(reason: string): never {
  throw new RecipeMaterializationError(reason);
}

function required<Value>(value: Value | undefined, reason: string): Value {
  if (value === undefined) fail(reason);
  return value;
}

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function dictionary(): JsonObject {
  return Object.create(null) as JsonObject;
}

/** Stable unambiguous key; punctuation in user IDs cannot create tuple collisions. */
export function recipeOwnerKey(owner: EditableProjectRecipeOwner): string {
  return JSON.stringify([owner.path, owner.definitionId, owner.kind, owner.id]);
}

/** Ordinary identity key; only components and behaviors share their Source namespace. */
export function recipeSourceIdentityKey(kind: OwnerKind, id: string): string {
  return JSON.stringify([kind === "behavior" ? "node" : kind, id]);
}

function owner(scope: Scope, kind: OwnerKind, id: string): EditableProjectRecipeOwner {
  return { path: scope.path, definitionId: scope.definition.id, kind, id };
}

function visitChildren(child: EditableProjectRecipeChild, visit: (masterId: string) => void): void {
  if (child.kind === "instance") {
    visit(child.masterId);
    return;
  }
  for (const children of Object.values(child.slots ?? {})) {
    for (const item of children) visitChildren(item, visit);
  }
  for (const behavior of child.behaviors ?? []) {
    for (const children of Object.values(behavior.slots ?? {})) {
      for (const item of children) visitChildren(item, visit);
    }
  }
}

/** Authenticates the reachable definition closure, rejecting recursion before expansion. */
export function recipeDefinitionDigest(
  graph: EditableProjectRecipeGraph,
  masterId: string,
): string {
  const definitions = new Map(graph.definitions.map((definition) => [definition.id, definition]));
  const active = new Set<string>();
  const retained = new Map<string, EditableProjectMasterDefinition>();
  function visit(id: string, depth: number): void {
    if (depth > EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth) fail("composition-limit");
    if (active.has(id)) fail("recursive-definition");
    if (retained.has(id)) return;
    const definition = definitions.get(id);
    if (definition === undefined) fail("missing-definition");
    active.add(id);
    visitChildren(definition.root, (nested) => visit(nested, depth + 1));
    active.delete(id);
    retained.set(id, definition);
  }
  visit(masterId, 0);
  return digestCanonicalJson(
    [...retained.values()].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    ),
  );
}

/**
 * Expands an already shape-admitted graph in two passes without changing caller state.
 *
 * @remarks This internal helper grants no Catalog or publication authority. The caller must
 * structurally admit and semantically validate the complete resulting Source before committing.
 */
export function materializeRecipeInstance(
  graph: EditableProjectRecipeGraph,
  masterId: string,
  instanceId: string,
  previousMapping: readonly EditableProjectInstanceMapping[] = [],
  overrides: readonly EditableProjectInstanceOverride[] = [],
  reservedIds: ReadonlySet<string> = new Set(),
): RecipeMaterialization {
  const definitionDigest = recipeDefinitionDigest(graph, masterId);
  const definitions = new Map(graph.definitions.map((definition) => [definition.id, definition]));
  const identities = new Map<string, EditableProjectRecipeOwner>();
  const widths = new Map<string, number>();
  const operationUses = new Map<string, string>();
  const occurrenceTargets = new Map<string, EditableProjectRecipeOwner>();
  const scopes: Scope[] = [];
  const nestedOverrides: { scope: Scope; values: readonly EditableProjectInstanceOverride[] }[] =
    [];
  let expanded = 0;

  function register(scope: Scope, kind: OwnerKind, id: string): void {
    // Allocation must not sanitize an invalid template into seemingly valid ordinary Source.
    if (!IDENTIFIER.test(id)) fail("invalid-local-identity");
    const address = owner(scope, kind, id);
    const key = recipeOwnerKey(address);
    if (identities.has(key)) fail("duplicate-conceptual-owner");
    if (++expanded > EDITABLE_PROJECT_RECIPE_LIMITS.maxExpandedOwners) fail("expansion-limit");
    identities.set(key, address);
    widths.set(key, 128);
  }

  function collectActions(value: unknown, scope: Scope): void {
    if (!Array.isArray(value)) return;
    for (const entry of value) {
      const action = object(entry);
      if (action === undefined) fail("invalid-action");
      if (action.type === "operation.invoke") {
        if (typeof action.as !== "string" || typeof action.operation !== "string") {
          fail("invalid-operation");
        }
        const key = recipeOwnerKey(owner(scope, "operation", action.as));
        const previous = operationUses.get(key);
        if (previous !== undefined && previous !== action.operation)
          fail("operation-alias-conflict");
        if (previous === undefined) {
          register(scope, "operation", action.as);
          operationUses.set(key, action.operation);
        }
        collectActions(action.onSuccess, scope);
        collectActions(action.onFailure, scope);
      }
      if (action.type === "state.set" || action.type === "state.toggle") {
        if (typeof action.path !== "string") fail("invalid-state-path");
        const root = action.path.split(".")[0] as string;
        const key = recipeOwnerKey(owner(scope, "state", root));
        const width = widths.get(key);
        if (width === undefined) fail("unresolved-state");
        widths.set(key, Math.min(width, 128 - (action.path.length - root.length)));
      }
    }
  }

  function collectOn(value: unknown, scope: Scope): void {
    const on = object(value);
    if (on !== undefined) for (const actions of Object.values(on)) collectActions(actions, scope);
  }

  function definitionScope(id: string, occurrencePath: readonly string[], depth: number): Scope {
    if (depth > EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth) fail("composition-limit");
    const definition = definitions.get(id);
    if (definition === undefined) fail("missing-definition");
    const scope = { definition, path: occurrencePath };
    scopes.push(scope);
    for (const name of Object.keys(definition.state).sort()) register(scope, "state", name);
    for (const name of Object.keys(definition.resources).sort()) register(scope, "resource", name);
    collect(definition.root, scope, depth);
    return scope;
  }

  function collect(child: EditableProjectRecipeChild, scope: Scope, depth: number): void {
    if (depth > EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth) fail("composition-limit");
    if (child.kind === "instance") {
      const nested = definitionScope(child.masterId, [...scope.path, child.id], depth + 1);
      let targetScope = nested;
      let target = nested.definition.root;
      while (target.kind === "instance") {
        const definition = required(definitions.get(target.masterId), "missing-definition");
        targetScope = { definition, path: [...targetScope.path, target.id] };
        target = definition.root;
      }
      occurrenceTargets.set(
        recipeOwnerKey(owner(scope, "node", child.id)),
        owner(targetScope, "node", target.id),
      );
      nestedOverrides.push({ scope: nested, values: child.overrides });
      return;
    }
    register(scope, "node", child.id);
    collectOn(child.on, scope);
    for (const behavior of child.behaviors ?? []) {
      register(scope, "behavior", behavior.id);
      collectOn(behavior.on, scope);
      for (const name of Object.keys(behavior.slots ?? {}).sort()) {
        for (const item of behavior.slots?.[name] ?? []) collect(item, scope, depth + 1);
      }
    }
    for (const name of Object.keys(child.slots ?? {}).sort()) {
      for (const item of child.slots?.[name] ?? []) collect(item, scope, depth + 1);
    }
  }

  const topScope = definitionScope(masterId, [], 0);
  const old = new Map<string, string>();
  const oldSourceIds = new Set<string>();
  const oldTargets = new Set<string>();
  for (const entry of previousMapping) {
    const key = recipeOwnerKey(entry.owner);
    const target = recipeSourceIdentityKey(entry.owner.kind, entry.sourceId);
    if (old.has(key) || oldTargets.has(target)) fail("duplicate-mapping");
    old.set(key, entry.sourceId);
    oldSourceIds.add(entry.sourceId);
    oldTargets.add(target);
  }
  // Removed identities remain reserved for the whole transaction, preventing accidental rebinding.
  const occupied = new Set([...reservedIds, ...oldSourceIds]);
  const allocated = new Map<string, string>();
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const key of [...identities.keys()].sort()) {
    const width = widths.get(key) as number;
    if (width < 1) fail("identity-width-limit");
    const retained = old.get(key);
    if (retained !== undefined) {
      if (retained.length > width) fail("retained-identity-width-conflict");
      allocated.set(key, retained);
      continue;
    }
    let candidate: string | undefined;
    for (let attempt = 0; attempt < EDITABLE_PROJECT_RECIPE_LIMITS.maxMappings; attempt++) {
      const hash = digestCanonicalJson([instanceId, key, attempt]).slice(7);
      const id = `${letters[Number.parseInt(hash.slice(0, 2), 16) % letters.length]}${hash}`.slice(
        0,
        width,
      );
      if (!occupied.has(id)) {
        candidate = id;
        break;
      }
    }
    if (candidate === undefined) fail("identity-collision-limit");
    occupied.add(candidate);
    allocated.set(key, candidate);
  }

  function resolve(scope: Scope, kind: OwnerKind, id: string): string {
    const key = recipeOwnerKey(owner(scope, kind, id));
    const nestedTarget = occurrenceTargets.get(key);
    const result = allocated.get(nestedTarget === undefined ? key : recipeOwnerKey(nestedTarget));
    if (result === undefined) fail(`unresolved-${kind}`);
    return result;
  }

  function rewriteValue(value: Json, scope: Scope): Json {
    if (Array.isArray(value)) return value.map((item) => rewriteValue(item, scope));
    const record = object(value);
    if (record === undefined) return value;
    if (typeof record.$ref === "string") {
      const [namespace, name, ...tail] = record.$ref.split(".");
      let reference = record.$ref;
      if (namespace === "state" || namespace === "resource" || namespace === "operation") {
        if (name === undefined) fail("invalid-reference");
        reference = [namespace, resolve(scope, namespace, name), ...tail].join(".");
      }
      const result: JsonObject = { ...record, $ref: reference };
      if (Object.hasOwn(record, "fallback"))
        result.fallback = rewriteValue(required(record.fallback, "invalid-fallback"), scope);
      return result;
    }
    if (Object.hasOwn(record, "$token")) return clone(record);
    if (Object.hasOwn(record, "$format")) {
      const format = object(record.$format);
      const values = object(format?.values);
      if (format === undefined || values === undefined) fail("invalid-format");
      return { ...record, $format: { ...format, values: rewriteValues(values, scope) } };
    }
    return rewriteValues(record, scope);
  }

  function rewriteValues(values: JsonObject, scope: Scope): JsonObject {
    const output = dictionary();
    for (const [name, value] of Object.entries(values)) output[name] = rewriteValue(value, scope);
    return output;
  }

  function rewritePredicate(value: Json, scope: Scope): Json {
    const predicate = object(value);
    if (predicate === undefined || !Array.isArray(predicate.args)) fail("invalid-predicate");
    return {
      ...predicate,
      args: predicate.args.map((argument) => {
        const item = object(argument);
        return item !== undefined &&
          Object.keys(item).length === 2 &&
          typeof item.op === "string" &&
          Array.isArray(item.args)
          ? rewritePredicate(argument, scope)
          : rewriteValue(argument, scope);
      }),
    };
  }

  function rewriteStyle(style: Json, scope: Scope): Json {
    const states = object(style);
    if (states === undefined) fail("invalid-style");
    const result = dictionary();
    for (const [state, value] of Object.entries(states)) {
      const parts = object(value);
      if (parts === undefined) fail("invalid-style");
      const rewritten = dictionary();
      for (const [part, members] of Object.entries(parts)) {
        const properties = object(members);
        if (properties === undefined) fail("invalid-style");
        rewritten[part] = rewriteValues(properties, scope);
      }
      result[state] = rewritten;
    }
    return result;
  }

  function rewriteActions(value: Json, scope: Scope): Json[] {
    if (!Array.isArray(value)) fail("invalid-actions");
    return value.map((entry) => {
      const action = object(clone(entry));
      if (action === undefined) fail("invalid-action");
      if (action.when !== undefined) action.when = rewritePredicate(action.when, scope);
      if (action.type === "state.set" || action.type === "state.toggle") {
        if (typeof action.path !== "string") fail("invalid-state-path");
        const [name, ...tail] = action.path.split(".");
        action.path = [resolve(scope, "state", required(name, "invalid-state-path")), ...tail].join(
          ".",
        );
        if (action.type === "state.set")
          action.value = rewriteValue(required(action.value, "invalid-state-value"), scope);
      } else if (action.type === "operation.invoke") {
        action.as = resolve(scope, "operation", action.as as string);
        if (action.onSuccess !== undefined)
          action.onSuccess = rewriteActions(action.onSuccess, scope);
        if (action.onFailure !== undefined)
          action.onFailure = rewriteActions(action.onFailure, scope);
      } else if (action.type === "resource.refresh") {
        action.resource = resolve(scope, "resource", action.resource as string);
      } else if (action.type === "component.command") {
        // Commands target components, never a behavior with the same spelling.
        action.target = resolve(scope, "node", action.target as string);
      }
      for (const field of ["input", "params", "payload"]) {
        if (action[field] !== undefined) {
          const values = object(action[field]);
          if (values === undefined) fail("invalid-action-values");
          action[field] = rewriteValues(values, scope);
        }
      }
      return action;
    });
  }

  const rendered = new Map<string, JsonObject>();
  function renderOwner(value: unknown, scope: Scope, kind: "node" | "behavior"): JsonObject {
    const result = object(clone(value));
    if (result === undefined || typeof result.id !== "string") fail("invalid-owner");
    const localId = result.id;
    delete result.kind;
    delete result.slots;
    delete result.behaviors;
    result.id = resolve(scope, kind, localId);
    if (result.props !== undefined) {
      const props = object(result.props);
      if (props === undefined) fail("invalid-props");
      result.props = rewriteValues(props, scope);
    }
    if (result.style !== undefined) result.style = rewriteStyle(result.style, scope);
    if (result.when !== undefined) result.when = rewritePredicate(result.when, scope);
    if (result.repeat !== undefined) {
      const repeat = object(result.repeat);
      if (repeat === undefined) fail("invalid-repeat");
      result.repeat = {
        ...repeat,
        items: rewriteValue(required(repeat.items, "invalid-repeat"), scope),
        key: rewriteValue(required(repeat.key, "invalid-repeat"), scope),
      };
    }
    if (result.variants !== undefined) {
      if (!Array.isArray(result.variants)) fail("invalid-variants");
      result.variants = result.variants.map((value) => {
        const variant = object(value);
        if (variant === undefined) fail("invalid-variant");
        const output: JsonObject = {
          ...variant,
          when: rewritePredicate(required(variant.when, "invalid-variant"), scope),
        };
        if (variant.props !== undefined) {
          const props = object(variant.props);
          if (props === undefined) fail("invalid-props");
          output.props = rewriteValues(props, scope);
        }
        if (variant.style !== undefined) output.style = rewriteStyle(variant.style, scope);
        return output;
      });
    }
    if (result.on !== undefined) {
      const on = object(result.on);
      if (on === undefined) fail("invalid-handlers");
      const output = dictionary();
      for (const [event, actions] of Object.entries(on))
        output[event] = rewriteActions(actions, scope);
      result.on = output;
    }
    rendered.set(recipeOwnerKey(owner(scope, kind, localId)), result);
    return result;
  }

  function renderSlots(
    slots: Readonly<Record<string, readonly EditableProjectRecipeChild[]>>,
    scope: Scope,
  ): JsonObject {
    const result = dictionary();
    for (const [name, children] of Object.entries(slots)) {
      result[name] = children.map((child) => render(child, scope));
    }
    return result;
  }

  function render(child: EditableProjectRecipeChild, scope: Scope): JsonObject {
    if (child.kind === "instance") {
      const definition = required(definitions.get(child.masterId), "missing-definition");
      return render(definition.root, { definition, path: [...scope.path, child.id] });
    }
    const result = renderOwner(child, scope, "node");
    if (child.slots !== undefined) result.slots = renderSlots(child.slots, scope);
    if (child.behaviors !== undefined) {
      result.behaviors = child.behaviors.map((behavior) => {
        const output = renderOwner(behavior, scope, "behavior");
        if (behavior.slots !== undefined) output.slots = renderSlots(behavior.slots, scope);
        return output;
      });
    }
    return result;
  }

  const root = render(topScope.definition.root, topScope);
  function applyOverrides(values: readonly EditableProjectInstanceOverride[], scope: Scope): void {
    for (const override of values) {
      const qualified = { ...override.owner, path: [...scope.path, ...override.owner.path] };
      const target = rendered.get(recipeOwnerKey(qualified));
      if (target === undefined) fail("override-owner-conflict");
      const definition = definitions.get(qualified.definitionId);
      if (definition === undefined) fail("override-owner-conflict");
      const value = rewriteValue(clone(override.value) as Json, {
        definition,
        path: qualified.path,
      });
      if (override.property.kind === "prop") {
        const props = object(target.props) ?? dictionary();
        props[override.property.name] = value;
        target.props = props;
      } else {
        const style = object(target.style) ?? dictionary();
        const state = object(style[override.property.state]) ?? dictionary();
        const part = object(state[override.property.part]) ?? dictionary();
        part[override.property.name] = value;
        state[override.property.part] = part;
        style[override.property.state] = state;
        target.style = style;
      }
    }
  }
  // Collection is postorder: inner defaults precede outer occurrence overrides and instance edits.
  for (const nested of nestedOverrides) applyOverrides(nested.values, nested.scope);
  applyOverrides(overrides, topScope);
  const state = dictionary();
  const resources = dictionary();
  for (const scope of scopes) {
    for (const [name, declaration] of Object.entries(scope.definition.state)) {
      state[resolve(scope, "state", name)] = clone(declaration) as Json;
    }
    for (const [name, declaration] of Object.entries(scope.definition.resources)) {
      const resource = clone(declaration) as unknown as JsonObject;
      const input = object(resource.input);
      if (input === undefined) fail("invalid-resource");
      resource.input = rewriteValues(input, scope);
      resources[resolve(scope, "resource", name)] = resource;
    }
  }
  const mapping = [...identities.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, address]) => ({
      owner: address,
      sourceId: required(allocated.get(key), "unallocated-identity"),
    }));
  const emitted = { root, state, resources };
  return captureDesignSystemJson({
    ...emitted,
    mapping,
    definitionDigest,
    materializedDigest: digestCanonicalJson(emitted),
  }) as unknown as RecipeMaterialization;
}

/** Compares complete canonical materializations without lexical JSON assumptions. */
export function equalRecipeMaterialization(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left) === canonicalizeJson(right);
}
