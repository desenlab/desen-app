import { createDesenEditorDocument } from "@desen/editor-core";
import { canonicalizeJson, isSha256Digest } from "@desen/protocol";

import { createEditableProjectDiagnostic } from "./diagnostics.js";
import { captureDesignSystemJson, InertJsonCaptureError } from "./inert-json.js";
import {
  materializeRecipeInstance,
  RecipeMaterializationError,
  recipeOwnerKey,
  recipeSourceIdentityKey,
} from "./master-instance-materialization.js";
import { EDITABLE_PROJECT_RECIPE_LIMITS } from "./master-instance-types.js";

import type { DesenEditorDocument } from "@desen/editor-core";
import type { EditableProjectDiagnostic } from "./diagnostics.js";
import type { DesignSystemJsonObject, DesignSystemJsonValue } from "./inert-json.js";
import type {
  EditableProjectInstanceOverride,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";

type JsonObject = DesignSystemJsonObject;
type SourceNode = DesenEditorDocument["surfaces"][string]["root"];
type SourceAction = NonNullable<SourceNode["on"]>[string][number];

interface SurfaceIndex {
  readonly nodes: Map<string, SourceNode>;
  readonly operationDeclarations: Map<string, Set<string>>;
}
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
const COMPONENT_KEYS = [
  "props",
  "slots",
  "style",
  "when",
  "repeat",
  "variants",
  "behaviors",
  "on",
  "extensions",
];
const BEHAVIOR_KEYS = ["props", "slots", "style", "on", "extensions"];
const OWNER_KINDS = ["node", "behavior", "state", "resource", "operation"];

/** Internal graph admission result; failure never includes partially admitted graph data. */
export type EditableProjectRecipeGraphAdmissionResult =
  | Readonly<{ ok: true; graph: EditableProjectRecipeGraph }>
  | Readonly<{ ok: false; diagnostics: readonly EditableProjectDiagnostic[] }>;

function object(value: DesignSystemJsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keys(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function id(value: DesignSystemJsonValue | undefined): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function assert(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new RecipeMaterializationError(reason);
}

function admitOwner(value: DesignSystemJsonValue | undefined): asserts value is JsonObject {
  assert(
    object(value) && keys(value, ["path", "definitionId", "kind", "id"]),
    "invalid-owner-address",
  );
  assert(
    Array.isArray(value.path) &&
      value.path.length <= EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth &&
      value.path.every(id) &&
      id(value.definitionId) &&
      id(value.id) &&
      typeof value.kind === "string" &&
      OWNER_KINDS.includes(value.kind),
    "invalid-owner-address",
  );
}

function admitOverrides(value: DesignSystemJsonValue | undefined): void {
  assert(Array.isArray(value), "invalid-overrides");
  assert(value.length <= EDITABLE_PROJECT_RECIPE_LIMITS.maxOverrides, "override-limit");
  const seen = new Set<string>();
  for (const override of value) {
    assert(object(override) && keys(override, ["owner", "property", "value"]), "invalid-override");
    admitOwner(override.owner);
    assert(
      override.owner.kind === "node" || override.owner.kind === "behavior",
      "invalid-override-owner",
    );
    const property = override.property;
    assert(object(property), "invalid-override-property");
    assert(
      (property.kind === "prop" && keys(property, ["kind", "name"]) && id(property.name)) ||
        (property.kind === "style" &&
          keys(property, ["kind", "name", "part", "state"]) &&
          id(property.name) &&
          id(property.part) &&
          id(property.state)),
      "invalid-override-property",
    );
    const typed = override as unknown as EditableProjectInstanceOverride;
    const key = canonicalizeJson([recipeOwnerKey(typed.owner), typed.property]);
    assert(!seen.has(key), "duplicate-override");
    seen.add(key);
  }
}

function admitGraphShape(value: DesignSystemJsonValue): EditableProjectRecipeGraph {
  assert(object(value) && keys(value, ["definitions", "instances"]), "invalid-graph");
  assert(Array.isArray(value.definitions) && Array.isArray(value.instances), "invalid-graph");
  assert(
    value.definitions.length <= EDITABLE_PROJECT_RECIPE_LIMITS.maxDefinitions &&
      value.instances.length <= EDITABLE_PROJECT_RECIPE_LIMITS.maxInstances,
    "graph-collection-limit",
  );
  const definitions = new Set<string>();
  let owners = 0;

  for (const definition of value.definitions) {
    assert(
      object(definition) && keys(definition, ["id", "name", "root", "state", "resources"]),
      "invalid-definition",
    );
    assert(id(definition.id) && !definitions.has(definition.id), "duplicate-definition");
    definitions.add(definition.id);
    assert(
      typeof definition.name === "string" &&
        definition.name.trim().length > 0 &&
        definition.name.length <= 512 &&
        object(definition.state) &&
        object(definition.resources),
      "invalid-definition",
    );
    const localIds = new Set<string>();

    function reserve(value: DesignSystemJsonValue | undefined): void {
      assert(id(value) && !localIds.has(value), "duplicate-template-identity");
      assert(++owners <= EDITABLE_PROJECT_RECIPE_LIMITS.maxTemplateOwners, "template-owner-limit");
      localIds.add(value);
    }

    function slots(value: DesignSystemJsonValue | undefined, depth: number): void {
      if (value === undefined) return;
      assert(object(value), "invalid-template-slots");
      for (const [name, children] of Object.entries(value)) {
        assert(id(name) && Array.isArray(children), "invalid-template-slots");
        for (const child of children) node(child, depth + 1);
      }
    }

    function node(value: DesignSystemJsonValue | undefined, depth: number): void {
      assert(depth <= EDITABLE_PROJECT_RECIPE_LIMITS.maxCompositionDepth, "template-depth-limit");
      assert(object(value), "invalid-template-node");
      reserve(value.id);
      if (value.kind === "instance") {
        assert(
          keys(value, ["kind", "id", "masterId", "overrides"]) && id(value.masterId),
          "invalid-occurrence",
        );
        admitOverrides(value.overrides);
        return;
      }
      assert(
        value.kind === "node" &&
          keys(value, ["kind", "id", "use"], COMPONENT_KEYS) &&
          typeof value.use === "string",
        "invalid-template-node",
      );
      slots(value.slots, depth);
      if (value.behaviors !== undefined) {
        assert(Array.isArray(value.behaviors), "invalid-template-behaviors");
        for (const behavior of value.behaviors) {
          assert(
            object(behavior) &&
              keys(behavior, ["id", "use"], BEHAVIOR_KEYS) &&
              typeof behavior.use === "string",
            "invalid-template-behavior",
          );
          reserve(behavior.id);
          slots(behavior.slots, depth);
        }
      }
    }
    node(definition.root, 0);
  }

  const instances = new Set<string>();
  for (const instance of value.instances) {
    assert(
      object(instance) &&
        keys(instance, [
          "id",
          "masterId",
          "surfaceId",
          "rootId",
          "definitionDigest",
          "materializedDigest",
          "mapping",
          "overrides",
        ]),
      "invalid-instance",
    );
    assert(id(instance.id) && !instances.has(instance.id), "duplicate-instance");
    instances.add(instance.id);
    assert(
      id(instance.masterId) &&
        definitions.has(instance.masterId) &&
        id(instance.surfaceId) &&
        id(instance.rootId) &&
        isSha256Digest(instance.definitionDigest) &&
        isSha256Digest(instance.materializedDigest),
      "invalid-instance-identity",
    );
    assert(
      Array.isArray(instance.mapping) &&
        instance.mapping.length > 0 &&
        instance.mapping.length <= EDITABLE_PROJECT_RECIPE_LIMITS.maxMappings,
      "mapping-limit",
    );
    const addresses = new Set<string>();
    const targets = new Set<string>();
    for (const mapping of instance.mapping) {
      assert(
        object(mapping) && keys(mapping, ["owner", "sourceId"]) && id(mapping.sourceId),
        "invalid-mapping",
      );
      admitOwner(mapping.owner);
      const key = recipeOwnerKey(mapping.owner as unknown as EditableProjectRecipeOwner);
      const target = recipeSourceIdentityKey(
        (mapping.owner as unknown as EditableProjectRecipeOwner).kind,
        mapping.sourceId,
      );
      assert(!addresses.has(key) && !targets.has(target), "duplicate-mapping");
      addresses.add(key);
      targets.add(target);
    }
    admitOverrides(instance.overrides);
  }
  return value as unknown as EditableProjectRecipeGraph;
}

function indexSurface(root: SourceNode): SurfaceIndex {
  const nodes = new Map<string, SourceNode>();
  const identities = new Set<string>();
  const operationDeclarations = new Map<string, Set<string>>();
  function actions(items: readonly SourceAction[], ownerId: string): void {
    for (const action of items) {
      if (action.type !== "operation.invoke") continue;
      const owners = operationDeclarations.get(action.as) ?? new Set<string>();
      owners.add(ownerId);
      operationDeclarations.set(action.as, owners);
      actions(action.onSuccess ?? [], ownerId);
      actions(action.onFailure ?? [], ownerId);
    }
  }
  function visit(node: SourceNode): void {
    assert(!identities.has(node.id), "ambiguous-source-identity");
    identities.add(node.id);
    nodes.set(node.id, node);
    for (const items of Object.values(node.on ?? {})) actions(items, node.id);
    for (const children of Object.values(node.slots ?? {}))
      for (const child of children) visit(child);
    for (const behavior of node.behaviors ?? []) {
      assert(!identities.has(behavior.id), "ambiguous-source-identity");
      identities.add(behavior.id);
      for (const items of Object.values(behavior.on ?? {})) actions(items, behavior.id);
      for (const children of Object.values(behavior.slots ?? {}))
        for (const child of children) visit(child);
    }
  }
  visit(root);
  return { nodes, operationDeclarations };
}

function verifyMaterializations(
  graph: EditableProjectRecipeGraph,
  source: DesenEditorDocument,
): void {
  let work = 0;
  // Validate even unused definitions; a stored draft cannot conceal malformed Source templates.
  for (const definition of graph.definitions) {
    const expanded = materializeRecipeInstance(graph, definition.id, "recipe-validation");
    work += expanded.mapping.length;
    assert(work <= EDITABLE_PROJECT_RECIPE_LIMITS.maxExpandedOwners, "admission-expansion-limit");
    const candidate = createDesenEditorDocument({
      ...source,
      entry: "recipe-validation",
      surfaces: {
        "recipe-validation": {
          id: "recipe-validation",
          root: expanded.root,
          state: expanded.state,
          resources: expanded.resources,
        },
      },
    });
    assert(candidate.ok, "invalid-template-source");
  }
  const indexes = new Map<string, SurfaceIndex>();
  const owned = new Set<string>();
  for (const instance of graph.instances) {
    const surface = source.surfaces[instance.surfaceId];
    assert(surface !== undefined, "missing-instance-surface");
    let index = indexes.get(instance.surfaceId);
    if (index === undefined) {
      index = indexSurface(surface.root);
      indexes.set(instance.surfaceId, index);
    }
    const storedRoot = index.nodes.get(instance.rootId);
    assert(storedRoot !== undefined, "missing-instance-root");
    const expected = materializeRecipeInstance(
      graph,
      instance.masterId,
      instance.id,
      instance.mapping,
      instance.overrides,
    );
    work += expected.mapping.length;
    assert(work <= EDITABLE_PROJECT_RECIPE_LIMITS.maxExpandedOwners, "admission-expansion-limit");
    assert(expected.definitionDigest === instance.definitionDigest, "stale-definition");
    assert(
      expected.materializedDigest === instance.materializedDigest &&
        expected.root.id === instance.rootId &&
        canonicalizeJson(expected.root) === canonicalizeJson(storedRoot),
      "managed-source-drift",
    );
    assert(
      canonicalizeJson(expected.mapping) === canonicalizeJson(instance.mapping),
      "mapping-drift",
    );
    const actionOwners = new Set(
      instance.mapping
        .filter(({ owner }) => owner.kind === "node" || owner.kind === "behavior")
        .map(({ sourceId }) => sourceId),
    );
    for (const entry of instance.mapping) {
      // Components and behaviors share a namespace; binding aliases have separate Source maps.
      const kind = entry.owner.kind === "behavior" ? "node" : entry.owner.kind;
      const key = JSON.stringify([instance.surfaceId, kind, entry.sourceId]);
      assert(!owned.has(key), "overlapping-instances");
      owned.add(key);
      if (entry.owner.kind === "operation") {
        // Protocol permits same-capability alias sharing, but a managed instance must own its
        // invocation lifecycle. External reads remain legal; external declarations do not.
        const declarations = index.operationDeclarations.get(entry.sourceId);
        assert(
          declarations !== undefined && [...declarations].every((id) => actionOwners.has(id)),
          "operation-ownership-conflict",
        );
      }
    }
    for (const [name, declaration] of Object.entries(expected.state)) {
      assert(
        Object.hasOwn(surface.state, name) &&
          canonicalizeJson(surface.state[name]) === canonicalizeJson(declaration),
        "managed-state-drift",
      );
    }
    for (const [name, declaration] of Object.entries(expected.resources)) {
      assert(
        Object.hasOwn(surface.resources, name) &&
          canonicalizeJson(surface.resources[name]) === canonicalizeJson(declaration),
        "managed-resource-drift",
      );
    }
  }
}

/**
 * Admits finite recipe metadata only when every managed region reproduces the stored Source.
 *
 * @remarks Definitions grant authoring authority only. Catalog contracts are independently checked
 * by the transaction's captured continuous validator before it commits a complete project.
 */
export function admitEditableProjectRecipeGraph(
  input: unknown,
  source: DesenEditorDocument,
): EditableProjectRecipeGraphAdmissionResult {
  try {
    const graph = captureEditableProjectRecipeGraphShape(input);
    verifyMaterializations(graph, source);
    return Object.freeze({ ok: true, graph });
  } catch (error) {
    const limited =
      error instanceof InertJsonCaptureError
        ? error.code === "JSON_LIMIT_EXCEEDED"
        : error instanceof RecipeMaterializationError && error.reason.endsWith("limit");
    const unsafe = error instanceof InertJsonCaptureError && error.code === "UNSAFE_JSON_VALUE";
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        createEditableProjectDiagnostic(
          limited ? "PROJECT_LIMIT_EXCEEDED" : unsafe ? "UNSAFE_PROJECT_VALUE" : "INVALID_PROJECT",
          "/designSystem/recipeGraph",
          error instanceof RecipeMaterializationError
            ? error.message
            : "Recipe graph admission failed without producing a partial project.",
        ),
      ]),
    });
  }
}

/**
 * Captures and checks only the finite graph shape for internal transaction preparation.
 *
 * @remarks This is not project admission: definition expansion and stored-Source equality must
 * still pass before returning a complete candidate. Failures throw the controlled internal error.
 */
export function captureEditableProjectRecipeGraphShape(input: unknown): EditableProjectRecipeGraph {
  return admitGraphShape(captureDesignSystemJson(input));
}
