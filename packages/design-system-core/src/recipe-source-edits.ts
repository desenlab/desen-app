import { canonicalizeJson } from "@desen/protocol";

import { RecipeMaterializationError, recipeOwnerKey } from "./master-instance-materialization.js";
import { cloneRecipeJson, indexRecipeSource, visitRecipeSourceOwners } from "./recipe-source.js";

import type { DesignSystemJsonObject, DesignSystemJsonValue } from "./inert-json.js";
import type {
  EditableProjectInstanceOverride,
  EditableProjectMasterInstance,
  EditableProjectOverrideProperty,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
import type { EditableProjectRecord } from "./project-record.js";
import type { MutableRecipeJson, RecipeSourceNode, RecipeSourceOwner } from "./recipe-source.js";

interface Field {
  readonly property: EditableProjectOverrideProperty;
  readonly value: EditableProjectInstanceOverride["value"];
}

function object(value: DesignSystemJsonValue | undefined): DesignSystemJsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as DesignSystemJsonObject)
    : undefined;
}

function conflict(message: string): never {
  throw new RecipeMaterializationError(message);
}

function fieldKey(property: EditableProjectOverrideProperty): string {
  return canonicalizeJson(property);
}

function fields(owner: RecipeSourceOwner): Map<string, Field> {
  const result = new Map<string, Field>();
  for (const [name, value] of Object.entries(owner.props ?? {})) {
    const property = { kind: "prop" as const, name };
    result.set(fieldKey(property), { property, value });
  }
  for (const [state, parts] of Object.entries(owner.style ?? {})) {
    for (const [part, properties] of Object.entries(parts)) {
      for (const [name, value] of Object.entries(properties)) {
        const property = { kind: "style" as const, state, part, name };
        result.set(fieldKey(property), { property, value });
      }
    }
  }
  return result;
}

function structure(root: RecipeSourceNode): string {
  const candidate = cloneRecipeJson(root);
  visitRecipeSourceOwners(candidate, (owner) => {
    const mutable = owner as MutableRecipeJson<RecipeSourceOwner>;
    delete mutable.props;
    delete mutable.style;
  });
  return canonicalizeJson(candidate);
}

/** Inverts only schema-owned ValueSpec references; literal strings and token identities stay data. */
function recipeValue(
  value: DesignSystemJsonValue,
  instance: EditableProjectMasterInstance,
  owner: EditableProjectRecipeOwner,
): DesignSystemJsonValue {
  if (Array.isArray(value)) return value.map((item) => recipeValue(item, instance, owner));
  const record = object(value);
  if (record === undefined) return value;
  const convertValues = (values: DesignSystemJsonObject): DesignSystemJsonObject =>
    Object.fromEntries(
      Object.entries(values).map(([key, item]) => [key, recipeValue(item, instance, owner)]),
    );
  if (typeof record.$ref === "string") {
    const [kind, sourceId, ...tail] = record.$ref.split(".");
    let reference = record.$ref;
    if (kind === "state" || kind === "resource" || kind === "operation") {
      const local = instance.mapping.find(
        (entry) =>
          entry.owner.kind === kind &&
          entry.sourceId === sourceId &&
          entry.owner.definitionId === owner.definitionId &&
          canonicalizeJson(entry.owner.path) === canonicalizeJson(owner.path),
      );
      if (local === undefined) conflict("instance-override-binding-scope-conflict");
      reference = [kind, local.owner.id, ...tail].join(".");
    }
    return {
      ...record,
      $ref: reference,
      ...(Object.hasOwn(record, "fallback")
        ? { fallback: recipeValue(record.fallback as DesignSystemJsonValue, instance, owner) }
        : {}),
    };
  }
  if (Object.hasOwn(record, "$token")) return record;
  if (Object.hasOwn(record, "$format")) {
    const format = object(record.$format);
    const values = object(format?.values);
    if (format === undefined || values === undefined) conflict("instance-override-format-conflict");
    return { ...record, $format: { ...format, values: convertValues(values) } };
  }
  return convertValues(record);
}

/**
 * Maps existing visual Source mutations back to explicit instance metadata without widening
 * structural or binding authority. Final materialization must still equal the requested Source.
 */
export function reconcileRecipeSourceEdits(
  previous: EditableProjectRecord,
  source: EditableProjectRecord["source"],
): Readonly<{
  graph: EditableProjectRecipeGraph;
  deleted: readonly EditableProjectMasterInstance[];
}> {
  const graph = previous.designSystem.recipeGraph;
  const oldSource = cloneRecipeJson(previous.source);
  const nextSource = cloneRecipeJson(source);
  const previousIndexes = new Map(
    Object.entries(oldSource.surfaces).map(([id, surface]) => [id, indexRecipeSource(surface)]),
  );
  const nextIndexes = new Map(
    Object.entries(nextSource.surfaces).map(([id, surface]) => [id, indexRecipeSource(surface)]),
  );
  const instances: EditableProjectMasterInstance[] = [];
  const deleted: EditableProjectMasterInstance[] = [];
  for (const instance of graph.instances) {
    const oldIndex = previousIndexes.get(instance.surfaceId);
    const nextIndex = nextIndexes.get(instance.surfaceId);
    const oldRoot = oldIndex?.nodes.get(instance.rootId)?.node;
    const nextRoot = nextIndex?.nodes.get(instance.rootId)?.node;
    if (oldRoot === undefined) conflict("instance-source-root-missing");
    if (nextRoot === undefined) {
      if (
        instance.mapping.some(
          ({ owner, sourceId }) =>
            (owner.kind === "node" || owner.kind === "behavior") && nextIndex?.owners.has(sourceId),
        )
      )
        conflict("instance-partial-delete-conflict");
      // Source IDs are surface-local. Ignore pre-existing equal spellings elsewhere, but do not
      // interpret newly relocated managed owners as deletion plus an implicitly detached copy.
      for (const [surfaceId, index] of nextIndexes) {
        if (surfaceId === instance.surfaceId) continue;
        const prior = previousIndexes.get(surfaceId);
        if (
          instance.mapping.some(
            ({ owner, sourceId }) =>
              (owner.kind === "node" || owner.kind === "behavior") &&
              index.owners.has(sourceId) &&
              !prior?.owners.has(sourceId),
          )
        )
          conflict("instance-cross-surface-move-requires-explicit-detach");
      }
      deleted.push(instance);
      continue;
    }
    if (structure(oldRoot) !== structure(nextRoot))
      conflict("managed-structure-requires-master-update-or-detach");
    let overrides = [...instance.overrides];
    for (const { owner, sourceId } of instance.mapping) {
      if (owner.kind !== "node" && owner.kind !== "behavior") continue;
      const oldOwner = oldIndex?.owners.get(sourceId);
      const nextOwner = nextIndex?.owners.get(sourceId);
      if (oldOwner === undefined || nextOwner === undefined)
        conflict("instance-source-owner-missing");
      const oldFields = fields(oldOwner);
      const nextFields = fields(nextOwner);
      for (const key of new Set([...oldFields.keys(), ...nextFields.keys()])) {
        const oldField = oldFields.get(key);
        const nextField = nextFields.get(key);
        if (
          oldField !== undefined &&
          nextField !== undefined &&
          canonicalizeJson(oldField.value) === canonicalizeJson(nextField.value)
        )
          continue;
        const matches = (override: EditableProjectInstanceOverride): boolean =>
          recipeOwnerKey(override.owner) === recipeOwnerKey(owner) &&
          fieldKey(override.property) === key;
        if (nextField === undefined) overrides = overrides.filter((override) => !matches(override));
        else {
          const override: EditableProjectInstanceOverride = {
            owner,
            property: nextField.property,
            value: recipeValue(
              nextField.value,
              instance,
              owner,
            ) as EditableProjectInstanceOverride["value"],
          };
          overrides = overrides.some(matches)
            ? overrides.map((existing) => (matches(existing) ? override : existing))
            : [...overrides, override];
        }
      }
    }
    instances.push({ ...instance, overrides });
  }
  return { graph: { ...graph, instances }, deleted };
}
