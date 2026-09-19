import {
  createDesenEditorContinuousValidator,
  createDesenEditorDocument,
} from "@desen/editor-core";
import { canonicalizeJson, digestCanonicalJson, isSha256Digest } from "@desen/protocol";

import { captureDesignSystemJson } from "./inert-json.js";
import {
  materializeRecipeInstance,
  RecipeMaterializationError,
  recipeDefinitionDigest,
  recipeOwnerKey,
  recipeSourceIdentityKey,
} from "./master-instance-materialization.js";
import { admitEditableProjectRecord } from "./project-record.js";
import { captureRecipeFromSource } from "./recipe-capture.js";
import { reconcileRecipeSourceEdits } from "./recipe-source-edits.js";
import { captureEditableProjectRecipeGraphShape } from "./recipe-graph.js";
import {
  cloneRecipeJson,
  indexRecipeSource,
  recipeSourceIdentities,
  recipeSourceReferences,
} from "./recipe-source.js";

import type { DesenEditorContinuousValidator } from "@desen/editor-core";
import type { DesignSystemJsonObject, DesignSystemJsonValue } from "./inert-json.js";
import type {
  EditableProjectInstanceOverride,
  EditableProjectMasterInstance,
  EditableProjectOverrideProperty,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
import type { EditableProjectRecord } from "./project-record.js";
import type {
  MutableRecipeJson,
  MutableRecipeSourceSurface,
  RecipeSourceLocation,
} from "./recipe-source.js";
import type {
  EditableProjectRecipeTransactionCommand,
  EditableProjectRecipeTransactionDiagnosticCode,
  EditableProjectRecipeTransactionResult,
  EditableProjectRecipeContractResult,
} from "./recipe-transaction-types.js";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u;
type MutableProject = MutableRecipeJson<EditableProjectRecord>;

class TransactionError extends Error {
  constructor(
    readonly code: EditableProjectRecipeTransactionDiagnosticCode,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: EditableProjectRecipeTransactionDiagnosticCode, message: string): never {
  throw new TransactionError(code, message);
}

function object(value: DesignSystemJsonValue | undefined): value is DesignSystemJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keys(value: DesignSystemJsonObject, fields: readonly string[]): void {
  if (
    Object.keys(value).length !== fields.length ||
    fields.some((field) => !Object.hasOwn(value, field))
  ) {
    fail("RECIPE_TRANSACTION_INVALID", "The recipe command fields are invalid.");
  }
}

function identifier(value: DesignSystemJsonValue | undefined): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    fail("RECIPE_TRANSACTION_INVALID", "The recipe command identity is invalid.");
  }
}

function command(input: unknown): EditableProjectRecipeTransactionCommand {
  const value = captureDesignSystemJson(input);
  if (!object(value) || !isSha256Digest(value.expectedProjectDigest)) {
    fail("RECIPE_TRANSACTION_INVALID", "An exact observed project digest is required.");
  }
  const base = ["type", "expectedProjectDigest"];
  switch (value.type) {
    case "source.apply":
      keys(value, [...base, "source"]);
      if (!object(value.source))
        fail("RECIPE_TRANSACTION_INVALID", "A complete ordinary Source is required.");
      break;
    case "master.create":
    case "master.update":
      keys(value, [
        ...base,
        "definition",
        ...(value.type === "master.update" ? ["expectedDefinitionDigest"] : []),
      ]);
      if (!object(value.definition))
        fail("RECIPE_TRANSACTION_INVALID", "A complete master definition is required.");
      identifier(value.definition.id);
      if (value.type === "master.update" && !isSha256Digest(value.expectedDefinitionDigest)) {
        fail("RECIPE_TRANSACTION_INVALID", "An exact observed definition digest is required.");
      }
      break;
    case "master.capture":
      keys(value, [...base, "masterId", "name", "surfaceId", "nodeId", "instanceId"]);
      for (const field of ["masterId", "surfaceId", "nodeId", "instanceId"])
        identifier(value[field]);
      if (
        typeof value.name !== "string" ||
        value.name.trim().length === 0 ||
        value.name.length > 512
      ) {
        fail("RECIPE_TRANSACTION_INVALID", "A finite master name is required.");
      }
      break;
    case "master.delete":
      keys(value, [...base, "masterId"]);
      identifier(value.masterId);
      break;
    case "instance.insert": {
      keys(value, [...base, "instanceId", "masterId", "destination"]);
      identifier(value.instanceId);
      identifier(value.masterId);
      const destination = value.destination;
      if (!object(destination))
        fail("RECIPE_TRANSACTION_INVALID", "An exact insertion destination is required.");
      keys(destination, ["surfaceId", "parentId", "slot", "index"]);
      for (const field of ["surfaceId", "parentId", "slot"]) identifier(destination[field]);
      if (
        !Number.isSafeInteger(destination.index) ||
        typeof destination.index !== "number" ||
        destination.index < 0
      ) {
        fail("RECIPE_TRANSACTION_INVALID", "The insertion index is invalid.");
      }
      break;
    }
    case "instance.override":
      keys(value, [...base, "instanceId", "override"]);
      identifier(value.instanceId);
      if (!object(value.override))
        fail("RECIPE_TRANSACTION_INVALID", "An explicit override is required.");
      break;
    case "instance.reset":
      keys(value, [...base, "instanceId", "owner", "property"]);
      identifier(value.instanceId);
      if (!object(value.owner) || !object(value.property))
        fail("RECIPE_TRANSACTION_INVALID", "An exact override address is required.");
      break;
    case "instance.detach":
    case "instance.delete":
      keys(value, [...base, "instanceId"]);
      identifier(value.instanceId);
      break;
    default:
      fail("RECIPE_TRANSACTION_INVALID", "The recipe command is not supported.");
  }
  return value as unknown as EditableProjectRecipeTransactionCommand;
}

function requireSurface(project: MutableProject, id: string): MutableRecipeSourceSurface {
  const surface = Object.hasOwn(project.source.surfaces, id)
    ? project.source.surfaces[id]
    : undefined;
  if (surface === undefined)
    fail("RECIPE_TARGET_INVALID", "The target Source surface does not exist.");
  return surface;
}

function requireInstance(
  graph: EditableProjectRecipeGraph,
  id: string,
): EditableProjectMasterInstance {
  const instance = graph.instances.find((item) => item.id === id);
  if (instance === undefined) fail("RECIPE_TARGET_INVALID", "The linked instance does not exist.");
  return instance;
}

function requireMaster(graph: EditableProjectRecipeGraph, id: string): void {
  if (!graph.definitions.some((item) => item.id === id))
    fail("RECIPE_TARGET_INVALID", "The master definition does not exist.");
}

function unusedMasterId(graph: EditableProjectRecipeGraph, id: string): void {
  if (graph.definitions.some((item) => item.id === id))
    fail("RECIPE_IDENTITY_CONFLICT", "The master identity already exists.");
}

function unusedInstanceId(graph: EditableProjectRecipeGraph, id: string): void {
  if (graph.instances.some((item) => item.id === id))
    fail("RECIPE_IDENTITY_CONFLICT", "The instance identity already exists.");
}

function containsMaster(root: EditableProjectRecipeChild, id: string): boolean {
  if (root.kind === "instance") return root.masterId === id;
  const children = [
    ...Object.values(root.slots ?? {}).flat(),
    ...(root.behaviors ?? []).flatMap((behavior) => Object.values(behavior.slots ?? {}).flat()),
  ];
  return children.some((child) => containsMaster(child, id));
}

function overrideKey(
  owner: EditableProjectRecipeOwner,
  property: EditableProjectOverrideProperty,
): string {
  return canonicalizeJson([recipeOwnerKey(owner), property]);
}

function removeLocation(location: RecipeSourceLocation): void {
  const children =
    location.slot === undefined ? undefined : location.parent?.slots?.[location.slot];
  if (children === undefined || location.index === undefined) {
    fail(
      "RECIPE_TARGET_INVALID",
      "A surface-root instance must be detached before its surface is deleted.",
    );
  }
  children.splice(location.index, 1);
}

function clearDeclarations(
  surface: MutableRecipeSourceSurface,
  instance: EditableProjectMasterInstance,
): void {
  const states = new Set(
    instance.mapping.filter(({ owner }) => owner.kind === "state").map(({ sourceId }) => sourceId),
  );
  const resources = new Set(
    instance.mapping
      .filter(({ owner }) => owner.kind === "resource")
      .map(({ sourceId }) => sourceId),
  );
  surface.state = Object.fromEntries(
    Object.entries(surface.state).filter(([name]) => !states.has(name)),
  );
  surface.resources = Object.fromEntries(
    Object.entries(surface.resources).filter(([name]) => !resources.has(name)),
  );
}

function validateCandidate(
  record: EditableProjectRecord,
  validator: DesenEditorContinuousValidator,
): void {
  if (!validator.validate(record.source).valid) {
    fail(
      "RECIPE_SEMANTIC_INVALID",
      "The complete Source does not satisfy the captured Catalog contracts.",
    );
  }
  const graph = record.designSystem.recipeGraph;
  let validationSurface = "recipe-validation";
  for (let index = 1; Object.hasOwn(record.source.surfaces, validationSurface); index++) {
    validationSurface = `recipe-validation.${String(index)}`;
  }
  for (const definition of graph.definitions) {
    const expanded = materializeRecipeInstance(graph, definition.id, "recipe-validation");
    const source = createDesenEditorDocument({
      ...record.source,
      entry: validationSurface,
      surfaces: {
        ...record.source.surfaces,
        [validationSurface]: {
          id: validationSurface,
          root: expanded.root,
          state: expanded.state,
          resources: expanded.resources,
        },
      },
    });
    if (!source.ok || !validator.validate(source.document).valid) {
      fail(
        "RECIPE_SEMANTIC_INVALID",
        "A master definition does not satisfy the captured Catalog contracts.",
      );
    }
  }
}

/**
 * Re-admits a complete persisted project and all recipe contracts against trusted Catalog data.
 *
 * @remarks This read-only boundary also checks unused definitions, which ordinary Source
 * validation cannot see. It neither repairs materialization nor rewrites the record. The App must
 * independently authenticate its workspace profile and preflight the exact Source with Publisher.
 */
export function validateEditableProjectRecipeContracts(
  input: unknown,
  catalogs: unknown,
): EditableProjectRecipeContractResult {
  try {
    const project = admitEditableProjectRecord(input);
    if (!project.ok) fail("RECIPE_PROJECT_INVALID", "The complete project could not be admitted.");
    const validator = createDesenEditorContinuousValidator(catalogs);
    if (!validator.ok)
      fail("RECIPE_CATALOG_INVALID", "The trusted Catalog data could not be admitted.");
    validateCandidate(project.record, validator.validator);
    return Object.freeze({
      ok: true,
      record: project.record,
      digest: digestCanonicalJson(project.record),
      catalogSetFingerprint: validator.validator.catalogSetFingerprint,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code: error instanceof TransactionError ? error.code : "RECIPE_MATERIALIZATION_REJECTED",
          message: "The complete project and recipe contracts were not admitted.",
        }),
      ] as const),
    });
  }
}

/**
 * Reads the exact transitive identity needed to edit an existing master without stale writes.
 *
 * @remarks Unknown/unsafe records, malformed identities and missing masters return `undefined`.
 * This read-only digest supplies no Catalog, preview, storage or publication authority.
 */
export function getEditableProjectMasterDefinitionDigest(
  input: unknown,
  masterId: unknown,
): string | undefined {
  if (typeof masterId !== "string" || !IDENTIFIER.test(masterId)) return undefined;
  const admitted = admitEditableProjectRecord(input);
  if (
    !admitted.ok ||
    !admitted.record.designSystem.recipeGraph.definitions.some(({ id }) => id === masterId)
  )
    return undefined;
  return recipeDefinitionDigest(admitted.record.designSystem.recipeGraph, masterId);
}

/**
 * Prepares one immutable, atomic master/instance candidate against explicit trusted Catalog data.
 *
 * @remarks Captures all input, rejects stale project/definition identities and validates every
 * resulting master and the complete ordinary Source. It performs no storage, UI or host action.
 * Before committing, the App must run its exact-profile Publisher preflight and recheck
 * `previousDigest`; this result alone never grants preview, persistence or Runtime authority.
 */
export function prepareEditableProjectRecipeTransaction(
  input: unknown,
  request: unknown,
  catalogs: unknown,
): EditableProjectRecipeTransactionResult {
  try {
    const operation = command(request);
    const admitted = admitEditableProjectRecord(input);
    if (!admitted.ok)
      fail("RECIPE_PROJECT_INVALID", "The preceding complete project could not be admitted.");
    const previous = admitted.record;
    const previousDigest = digestCanonicalJson(previous);
    if (operation.expectedProjectDigest !== previousDigest)
      fail("RECIPE_PROJECT_STALE", "The project changed after this operation was prepared.");
    const validator = createDesenEditorContinuousValidator(catalogs);
    if (!validator.ok)
      fail("RECIPE_CATALOG_INVALID", "The trusted Catalog data could not be admitted.");
    const project = cloneRecipeJson(previous);
    const original = previous.designSystem.recipeGraph;
    let graph: EditableProjectRecipeGraph = original;
    const affected = new Set<string>();
    let expectedSource: string | undefined;
    const removed = new Map<string, Set<string>>();
    function markRemoved(
      instance: EditableProjectMasterInstance,
      retained: ReadonlySet<string> = new Set(),
    ): void {
      const keys = removed.get(instance.surfaceId) ?? new Set<string>();
      for (const entry of instance.mapping) {
        const key = recipeSourceIdentityKey(entry.owner.kind, entry.sourceId);
        if (!retained.has(key)) keys.add(key);
      }
      removed.set(instance.surfaceId, keys);
    }

    switch (operation.type) {
      case "source.apply": {
        const source = createDesenEditorDocument(operation.source);
        if (!source.ok)
          fail("RECIPE_TRANSACTION_INVALID", "The complete Source could not be admitted.");
        const reconciled = reconcileRecipeSourceEdits(previous, source.document);
        graph = reconciled.graph;
        project.source = cloneRecipeJson(source.document);
        for (const instance of reconciled.deleted) {
          const surface = project.source.surfaces[instance.surfaceId];
          if (surface !== undefined) {
            const oldSurface = previous.source.surfaces[instance.surfaceId];
            for (const { owner, sourceId } of instance.mapping) {
              if (owner.kind !== "state" && owner.kind !== "resource") continue;
              const declarations = owner.kind === "state" ? surface.state : surface.resources;
              const oldDeclarations =
                owner.kind === "state" ? oldSurface?.state : oldSurface?.resources;
              if (
                Object.hasOwn(declarations, sourceId) &&
                canonicalizeJson(declarations[sourceId]) !==
                  canonicalizeJson(oldDeclarations?.[sourceId])
              )
                fail(
                  "RECIPE_REFERENCE_CONFLICT",
                  "An instance deletion cannot reuse or rewrite its owned declarations in the same Source edit.",
                );
            }
            clearDeclarations(surface, instance);
          }
          markRemoved(instance);
          affected.add(instance.id);
        }
        expectedSource = canonicalizeJson(project.source);
        break;
      }
      case "master.create":
        unusedMasterId(graph, operation.definition.id);
        graph = { ...graph, definitions: [...graph.definitions, operation.definition] };
        break;
      case "master.capture": {
        unusedMasterId(graph, operation.masterId);
        unusedInstanceId(graph, operation.instanceId);
        const surface = requireSurface(project, operation.surfaceId);
        const root = indexRecipeSource(surface).nodes.get(operation.nodeId)?.node;
        if (root === undefined)
          fail("RECIPE_TARGET_INVALID", "The selected component does not exist.");
        const captured = captureRecipeFromSource(graph, surface, root, operation);
        graph = captured.graph;
        for (const id of captured.affectedInstanceIds) affected.add(id);
        break;
      }
      case "master.update":
        requireMaster(graph, operation.definition.id);
        if (
          recipeDefinitionDigest(graph, operation.definition.id) !==
          operation.expectedDefinitionDigest
        ) {
          fail("RECIPE_DEFINITION_STALE", "The master changed after this definition was observed.");
        }
        graph = {
          ...graph,
          definitions: graph.definitions.map((definition) =>
            definition.id === operation.definition.id ? operation.definition : definition,
          ),
        };
        break;
      case "master.delete":
        requireMaster(graph, operation.masterId);
        if (
          graph.instances.some((instance) => instance.masterId === operation.masterId) ||
          graph.definitions.some((definition) =>
            containsMaster(definition.root, operation.masterId),
          )
        ) {
          fail(
            "RECIPE_REFERENCE_CONFLICT",
            "The master still has dependent instances or definitions.",
          );
        }
        graph = {
          ...graph,
          definitions: graph.definitions.filter(
            (definition) => definition.id !== operation.masterId,
          ),
        };
        break;
      case "instance.insert": {
        requireMaster(graph, operation.masterId);
        unusedInstanceId(graph, operation.instanceId);
        const destination = operation.destination;
        const surface = requireSurface(project, destination.surfaceId);
        const owner = indexRecipeSource(surface).owners.get(destination.parentId);
        if (owner === undefined)
          fail("RECIPE_TARGET_INVALID", "The insertion owner does not exist.");
        if (
          graph.instances.some(
            (instance) =>
              instance.surfaceId === destination.surfaceId &&
              instance.mapping.some(
                (entry) =>
                  (entry.owner.kind === "node" || entry.owner.kind === "behavior") &&
                  entry.sourceId === destination.parentId,
              ),
          )
        )
          fail("RECIPE_REFERENCE_CONFLICT", "Managed structure must be edited through its master.");
        const children =
          owner.slots !== undefined && Object.hasOwn(owner.slots, destination.slot)
            ? (owner.slots[destination.slot] ?? [])
            : [];
        if (destination.index > children.length)
          fail("RECIPE_TARGET_INVALID", "The insertion boundary does not exist.");
        const expanded = materializeRecipeInstance(
          graph,
          operation.masterId,
          operation.instanceId,
          [],
          [],
          recipeSourceIdentities(surface),
        );
        const slots = owner.slots ?? (Object.create(null) as NonNullable<typeof owner.slots>);
        children.splice(destination.index, 0, cloneRecipeJson(expanded.root));
        slots[destination.slot] = children;
        owner.slots = slots;
        Object.assign(surface.state, cloneRecipeJson(expanded.state));
        Object.assign(surface.resources, cloneRecipeJson(expanded.resources));
        graph = {
          ...graph,
          instances: [
            ...graph.instances,
            {
              id: operation.instanceId,
              masterId: operation.masterId,
              surfaceId: destination.surfaceId,
              rootId: expanded.root.id,
              definitionDigest: expanded.definitionDigest,
              materializedDigest: expanded.materializedDigest,
              mapping: expanded.mapping,
              overrides: [],
            },
          ],
        };
        affected.add(operation.instanceId);
        break;
      }
      case "instance.override":
      case "instance.reset": {
        const instance = requireInstance(graph, operation.instanceId);
        const candidate: EditableProjectInstanceOverride =
          operation.type === "instance.override"
            ? operation.override
            : { owner: operation.owner, property: operation.property, value: null };
        // Shape admission precedes reading any nested override address.
        captureEditableProjectRecipeGraphShape({
          ...graph,
          instances: graph.instances.map((item) =>
            item.id === instance.id ? { ...item, overrides: [candidate] } : item,
          ),
        });
        if (
          !instance.mapping.some(
            (entry) =>
              (entry.owner.kind === "node" || entry.owner.kind === "behavior") &&
              recipeOwnerKey(entry.owner) === recipeOwnerKey(candidate.owner),
          )
        ) {
          fail("RECIPE_TARGET_INVALID", "The override owner does not exist in this instance.");
        }
        const key = overrideKey(candidate.owner, candidate.property);
        const matching = instance.overrides.some(
          (item) => overrideKey(item.owner, item.property) === key,
        );
        const overrides =
          operation.type === "instance.reset"
            ? instance.overrides.filter((item) => overrideKey(item.owner, item.property) !== key)
            : matching
              ? instance.overrides.map((item) =>
                  overrideKey(item.owner, item.property) === key ? candidate : item,
                )
              : [...instance.overrides, candidate];
        graph = {
          ...graph,
          instances: graph.instances.map((item) =>
            item.id === instance.id ? { ...item, overrides } : item,
          ),
        };
        break;
      }
      case "instance.delete":
      case "instance.detach": {
        const instance = requireInstance(graph, operation.instanceId);
        if (operation.type === "instance.delete") {
          const surface = requireSurface(project, instance.surfaceId);
          const location = indexRecipeSource(surface).nodes.get(instance.rootId);
          if (location === undefined)
            fail("RECIPE_TARGET_INVALID", "The instance root does not exist.");
          removeLocation(location);
          clearDeclarations(surface, instance);
          markRemoved(instance);
        }
        graph = { ...graph, instances: graph.instances.filter((item) => item.id !== instance.id) };
        affected.add(instance.id);
        break;
      }
    }

    graph = captureEditableProjectRecipeGraphShape(graph);
    const reserved = new Map(
      Object.entries(previous.source.surfaces).map(([id, surface]) => [
        id,
        new Set(recipeSourceIdentities(surface)),
      ]),
    );
    const instances: EditableProjectMasterInstance[] = [];
    for (const instance of graph.instances) {
      const before = original.instances.find((item) => item.id === instance.id);
      if (
        before === undefined ||
        (instance.definitionDigest === recipeDefinitionDigest(graph, instance.masterId) &&
          canonicalizeJson(instance.overrides) === canonicalizeJson(before.overrides))
      ) {
        instances.push(instance);
        continue;
      }
      const surface = requireSurface(project, instance.surfaceId);
      const location = indexRecipeSource(surface).nodes.get(instance.rootId);
      if (location === undefined)
        fail("RECIPE_TARGET_INVALID", "An affected instance root does not exist.");
      const occupied = reserved.get(instance.surfaceId);
      const expanded = materializeRecipeInstance(
        graph,
        instance.masterId,
        instance.id,
        instance.mapping,
        instance.overrides,
        occupied,
      );
      const nextRoot = cloneRecipeJson(expanded.root);
      if (location.parent === undefined) surface.root = nextRoot;
      else {
        const children =
          location.slot === undefined ? undefined : location.parent.slots?.[location.slot];
        if (children === undefined || location.index === undefined)
          fail("RECIPE_TARGET_INVALID", "The instance position changed.");
        children[location.index] = nextRoot;
      }
      clearDeclarations(surface, before);
      Object.assign(surface.state, cloneRecipeJson(expanded.state));
      Object.assign(surface.resources, cloneRecipeJson(expanded.resources));
      const retained = new Set(
        expanded.mapping.map(({ owner, sourceId }) =>
          recipeSourceIdentityKey(owner.kind, sourceId),
        ),
      );
      markRemoved(before, retained);
      for (const entry of expanded.mapping) occupied?.add(entry.sourceId);
      instances.push({
        ...instance,
        rootId: expanded.root.id,
        mapping: expanded.mapping,
        definitionDigest: expanded.definitionDigest,
        materializedDigest: expanded.materializedDigest,
      });
      affected.add(instance.id);
    }
    for (const [surfaceId, identities] of removed) {
      const surface = project.source.surfaces[surfaceId];
      const references = surface === undefined ? [] : recipeSourceReferences(surface);
      if (references.some(({ kind, id }) => identities.has(recipeSourceIdentityKey(kind, id)))) {
        fail(
          "RECIPE_REFERENCE_CONFLICT",
          "The operation would remove a target still used by surviving wiring.",
        );
      }
    }
    if (expectedSource !== undefined && canonicalizeJson(project.source) !== expectedSource) {
      fail(
        "RECIPE_REFERENCE_CONFLICT",
        "The Source edit would silently replace an inherited value or managed declaration. Edit the master or reset the explicit override instead.",
      );
    }
    project.designSystem.recipeGraph = cloneRecipeJson({ ...graph, instances });
    const candidate = admitEditableProjectRecord(project);
    if (!candidate.ok)
      fail(
        "RECIPE_MATERIALIZATION_REJECTED",
        "The complete candidate failed project/materialization admission.",
      );
    validateCandidate(candidate.record, validator.validator);
    const digest = digestCanonicalJson(candidate.record);
    return Object.freeze({
      ok: true,
      changed: previousDigest !== digest,
      record: candidate.record,
      previousDigest,
      digest,
      catalogSetFingerprint: validator.validator.catalogSetFingerprint,
      affectedInstanceIds: Object.freeze([...affected].sort()),
      diagnostics: Object.freeze([]) as readonly [],
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze([
        Object.freeze({
          code:
            error instanceof TransactionError
              ? error.code
              : error instanceof RecipeMaterializationError
                ? "RECIPE_MATERIALIZATION_REJECTED"
                : "RECIPE_TRANSACTION_INVALID",
          message:
            error instanceof TransactionError || error instanceof RecipeMaterializationError
              ? error.message
              : "The recipe operation was rejected without producing a partial project.",
        }),
      ] as const),
    });
  }
}
