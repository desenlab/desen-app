import { canonicalizeJson } from "@desen/protocol";

import {
  materializeRecipeInstance,
  RecipeMaterializationError,
  recipeSourceIdentityKey,
} from "./master-instance-materialization.js";
import { captureEditableProjectRecipeGraphShape } from "./recipe-graph.js";
import {
  inspectRecipeResource,
  inspectRecipeSourceOwner,
  recipeSourceIdentities,
  visitRecipeSourceOwners,
} from "./recipe-source.js";

import type {
  EditableProjectInstanceMapping,
  EditableProjectMasterDefinition,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
import type {
  RecipeSourceNode,
  RecipeSourceReference,
  RecipeSourceSurface,
} from "./recipe-source.js";

/** Internal input already captured by the whole-project transaction boundary. */
export interface RecipeCaptureInput {
  readonly masterId: string;
  readonly name: string;
  readonly instanceId: string;
  readonly surfaceId: string;
}

/** Graph-only capture result: the ordinary Source must remain unchanged. */
export interface RecipeCaptureResult {
  readonly graph: EditableProjectRecipeGraph;
  readonly affectedInstanceIds: readonly string[];
}

/**
 * Turns an existing Source composition into a master while preserving every ordinary identity.
 *
 * @remarks Nested managed regions become explicit occurrences, not flattened relationships.
 * External/unresolved or cross-occurrence binding scopes reject rather than silently rebinding.
 */
export function captureRecipeFromSource(
  graph: EditableProjectRecipeGraph,
  surface: RecipeSourceSurface,
  root: RecipeSourceNode,
  input: RecipeCaptureInput,
  includeUnreferencedDeclarations = false,
): RecipeCaptureResult {
  const sameSurface = graph.instances.filter((instance) => instance.surfaceId === input.surfaceId);
  if (
    sameSurface.some(
      (instance) =>
        instance.rootId !== root.id &&
        instance.mapping.some(
          ({ owner, sourceId }) => owner.kind === "node" && sourceId === root.id,
        ),
    )
  )
    throw new RecipeMaterializationError("managed-structural-edit");

  const containedIds = new Set<string>();
  visitRecipeSourceOwners(root, (owner) => {
    containedIds.add(owner.id);
  });
  const nested = sameSurface.filter((instance) => containedIds.has(instance.rootId));
  const nestedRoots = new Map(nested.map((instance) => [instance.rootId, instance]));
  const nestedBindings = new Set(
    nested.flatMap((instance) =>
      instance.mapping
        .filter(
          ({ owner }) =>
            owner.kind === "state" || owner.kind === "resource" || owner.kind === "operation",
        )
        .map(({ owner, sourceId }) => recipeSourceIdentityKey(owner.kind, sourceId)),
    ),
  );
  const mapping: EditableProjectInstanceMapping[] = [];
  function reserve(kind: EditableProjectRecipeOwner["kind"], id: string): void {
    mapping.push({ owner: { path: [], definitionId: input.masterId, kind, id }, sourceId: id });
  }
  function convert(node: RecipeSourceNode): EditableProjectRecipeChild {
    const instance = nestedRoots.get(node.id);
    if (instance !== undefined) {
      for (const entry of instance.mapping) {
        mapping.push({ ...entry, owner: { ...entry.owner, path: [node.id, ...entry.owner.path] } });
      }
      return {
        kind: "instance",
        id: node.id,
        masterId: instance.masterId,
        overrides: instance.overrides,
      };
    }
    reserve("node", node.id);
    const slots = (value: NonNullable<RecipeSourceNode["slots"]>) =>
      Object.fromEntries(
        Object.entries(value).map(([name, children]) => [name, children.map(convert)]),
      );
    const { slots: nodeSlots, behaviors, ...fields } = node;
    return {
      ...fields,
      kind: "node",
      ...(nodeSlots === undefined ? {} : { slots: slots(nodeSlots) }),
      ...(behaviors === undefined
        ? {}
        : {
            behaviors: behaviors.map((behavior) => {
              reserve("behavior", behavior.id);
              const { slots: behaviorSlots, ...fields } = behavior;
              return {
                ...fields,
                ...(behaviorSlots === undefined ? {} : { slots: slots(behaviorSlots) }),
              };
            }),
          }),
    };
  }
  const template = convert(root);
  const references: RecipeSourceReference[] = [];
  const declarations = new Set<string>();
  const report = (reference: RecipeSourceReference): void => {
    references.push(reference);
  };
  visitRecipeSourceOwners(
    root,
    (owner) =>
      inspectRecipeSourceOwner(owner, report, (alias) => {
        declarations.add(alias);
      }),
    new Set(nestedRoots.keys()),
  );
  for (const alias of [...declarations].sort()) reserve("operation", alias);
  const state: Record<string, RecipeSourceSurface["state"][string]> = Object.create(null);
  const resources: Record<string, RecipeSourceSurface["resources"][string]> = Object.create(null);
  const seen = new Set<string>();
  // An isolated master-edit surface owns all non-nested declarations, including unused ones.
  // Ordinary subtree capture must continue to copy only its referenced binding closure.
  if (includeUnreferencedDeclarations) {
    for (const kind of ["state", "resource"] as const) {
      const values = kind === "state" ? surface.state : surface.resources;
      for (const id of Object.keys(values).sort()) {
        if (!nestedBindings.has(recipeSourceIdentityKey(kind, id))) references.push({ kind, id });
      }
    }
  }
  // The iterator also visits dependencies appended by resource inputs; seen closes cycles.
  for (const reference of references) {
    const { kind, id } = reference;
    const key = recipeSourceIdentityKey(kind, id);
    if (seen.has(key)) continue;
    seen.add(key);
    if (nestedBindings.has(key))
      throw new RecipeMaterializationError("cross-occurrence-binding-conflict");
    if (kind === "state") {
      const declaration = Object.hasOwn(surface.state, id) ? surface.state[id] : undefined;
      if (declaration === undefined) throw new RecipeMaterializationError("unresolved-state");
      reserve("state", id);
      state[id] = declaration;
    } else if (kind === "resource") {
      const declaration = Object.hasOwn(surface.resources, id) ? surface.resources[id] : undefined;
      if (declaration === undefined) throw new RecipeMaterializationError("unresolved-resource");
      reserve("resource", id);
      resources[id] = declaration;
      inspectRecipeResource(declaration, report);
    } else if (kind === "operation" && !declarations.has(id)) {
      throw new RecipeMaterializationError("unresolved-operation");
    }
  }
  const definition: EditableProjectMasterDefinition = {
    id: input.masterId,
    name: input.name,
    root: template,
    state,
    resources,
  };
  const retired = new Set(nested.map((instance) => instance.id));
  const shaped = captureEditableProjectRecipeGraphShape({
    definitions: [...graph.definitions, definition],
    instances: graph.instances.filter((instance) => !retired.has(instance.id)),
  });
  const expanded = materializeRecipeInstance(
    shaped,
    input.masterId,
    input.instanceId,
    mapping,
    [],
    recipeSourceIdentities(surface),
  );
  if (canonicalizeJson(expanded.root) !== canonicalizeJson(root)) {
    throw new RecipeMaterializationError("capture-source-conflict");
  }
  return {
    graph: {
      ...shaped,
      instances: [
        ...shaped.instances,
        {
          id: input.instanceId,
          masterId: input.masterId,
          surfaceId: input.surfaceId,
          rootId: expanded.root.id,
          definitionDigest: expanded.definitionDigest,
          materializedDigest: expanded.materializedDigest,
          mapping: expanded.mapping,
          overrides: [],
        },
      ],
    },
    affectedInstanceIds: [...retired, input.instanceId].sort(),
  };
}
