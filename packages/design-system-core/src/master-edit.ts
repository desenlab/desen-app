import { canonicalizeJson, isSha256Digest } from "@desen/protocol";

import { captureDesignSystemJson } from "./inert-json.js";
import {
  materializeRecipeInstance,
  RecipeMaterializationError,
} from "./master-instance-materialization.js";
import { captureRecipeFromSource } from "./recipe-capture.js";
import {
  prepareEditableProjectRecipeTransaction,
  validateEditableProjectRecipeContracts,
} from "./recipe-transactions.js";

import type {
  EditableProjectMasterDraft,
  EditableProjectMasterDraftResult,
} from "./master-edit-types.js";
import type {
  EditableProjectInstanceMapping,
  EditableProjectMasterInstance,
  EditableProjectRecipeChild,
  EditableProjectRecipeGraph,
  EditableProjectRecipeOccurrence,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
import type { EditableProjectRecord } from "./project-record.js";
import type {
  EditableProjectRecipeTransactionDiagnosticCode,
  EditableProjectRecipeTransactionFailure,
  EditableProjectRecipeTransactionResult,
} from "./recipe-transaction-types.js";

const drafts = new WeakSet<EditableProjectMasterDraft>();

function failure(
  code: EditableProjectRecipeTransactionDiagnosticCode,
  message: string,
): EditableProjectRecipeTransactionFailure {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, message })] as const),
  });
}

function occurrences(root: EditableProjectRecipeChild): readonly EditableProjectRecipeOccurrence[] {
  if (root.kind === "instance") return [root];
  return [
    ...Object.values(root.slots ?? {}).flat(),
    ...(root.behaviors ?? []).flatMap((behavior) => Object.values(behavior.slots ?? {}).flat()),
  ].flatMap(occurrences);
}

function rootOwner(
  graph: EditableProjectRecipeGraph,
  occurrence: EditableProjectRecipeOccurrence,
): EditableProjectRecipeOwner {
  const path = [occurrence.id];
  let masterId = occurrence.masterId;
  for (;;) {
    const definition = graph.definitions.find((item) => item.id === masterId);
    if (definition === undefined) throw new RecipeMaterializationError("missing-definition");
    if (definition.root.kind === "node") {
      return { path, definitionId: masterId, kind: "node", id: definition.root.id };
    }
    path.push(definition.root.id);
    masterId = definition.root.masterId;
  }
}

function unusedInstanceId(instances: readonly EditableProjectMasterInstance[]): string {
  const occupied = new Set(instances.map((instance) => instance.id));
  let id = "master-draft";
  for (let index = 1; occupied.has(id); index++) id = `master-draft.${String(index)}`;
  return id;
}

/**
 * Opens a definition-default projection for the same visual tools used to edit ordinary Source.
 *
 * @remarks The exact request has `masterId`, `surfaceId`, and `expectedProjectDigest` fields.
 * Parent-owned conceptual identities become editable ordinary IDs; nested occurrences remain
 * linked managed regions. Instance overrides never become master defaults. This projection has
 * no persistence or publication authority; the App must isolate it and preflight its preview.
 */
export function createEditableProjectMasterDraft(
  input: unknown,
  request: unknown,
  catalogs: unknown,
): EditableProjectMasterDraftResult {
  try {
    const value = captureDesignSystemJson(request);
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 3 ||
      !Object.hasOwn(value, "masterId") ||
      !Object.hasOwn(value, "surfaceId") ||
      !Object.hasOwn(value, "expectedProjectDigest")
    ) {
      return failure(
        "RECIPE_TRANSACTION_INVALID",
        "An exact visual master-edit request is required.",
      );
    }
    const { masterId, surfaceId, expectedProjectDigest } = value as Record<string, unknown>;
    if (
      typeof masterId !== "string" ||
      typeof surfaceId !== "string" ||
      !isSha256Digest(expectedProjectDigest)
    ) {
      return failure(
        "RECIPE_TRANSACTION_INVALID",
        "The visual master-edit identities are invalid.",
      );
    }
    const baseline = validateEditableProjectRecipeContracts(input, catalogs);
    if (!baseline.ok) return baseline;
    if (baseline.digest !== expectedProjectDigest)
      return failure(
        "RECIPE_PROJECT_STALE",
        "The project changed before the master draft was opened.",
      );
    const graph = baseline.record.designSystem.recipeGraph;
    const definition = graph.definitions.find((item) => item.id === masterId);
    const surface = Object.hasOwn(baseline.record.source.surfaces, surfaceId)
      ? baseline.record.source.surfaces[surfaceId]
      : undefined;
    if (definition === undefined || surface === undefined)
      return failure("RECIPE_TARGET_INVALID", "The master or editing surface does not exist.");

    const nested = occurrences(definition.root);
    const seed = materializeRecipeInstance(graph, masterId, "master-draft");
    const localMapping: EditableProjectInstanceMapping[] = seed.mapping
      .filter(({ owner }) => owner.path.length === 0)
      .map(({ owner }) => ({ owner, sourceId: owner.id }));
    for (const occurrence of nested) {
      localMapping.push({ owner: rootOwner(graph, occurrence), sourceId: occurrence.id });
    }
    // Reserve all local aliases before allocating nested identities. Parent references can then
    // round-trip through existing materialization without an independent inverse wire rewriter.
    const expanded = materializeRecipeInstance(
      graph,
      masterId,
      "master-draft",
      localMapping,
      [],
      new Set(localMapping.map(({ sourceId }) => sourceId)),
    );
    const instances = graph.instances.filter((instance) => instance.surfaceId !== surfaceId);
    for (const occurrence of nested) {
      const mapping = expanded.mapping
        .filter(({ owner }) => owner.path[0] === occurrence.id)
        .map((entry) => ({ ...entry, owner: { ...entry.owner, path: entry.owner.path.slice(1) } }));
      const id = unusedInstanceId(instances);
      const materialized = materializeRecipeInstance(
        graph,
        occurrence.masterId,
        id,
        mapping,
        occurrence.overrides,
      );
      instances.push({
        id,
        masterId: occurrence.masterId,
        surfaceId,
        rootId: materialized.root.id,
        definitionDigest: materialized.definitionDigest,
        materializedDigest: materialized.materializedDigest,
        mapping: materialized.mapping,
        overrides: occurrence.overrides,
      });
    }
    const record = baseline.record;
    const projected = validateEditableProjectRecipeContracts(
      {
        ...record,
        source: {
          ...record.source,
          surfaces: {
            ...record.source.surfaces,
            [surfaceId]: {
              ...surface,
              root: expanded.root,
              state: expanded.state,
              resources: expanded.resources,
            },
          },
        },
        designSystem: { ...record.designSystem, recipeGraph: { ...graph, instances } },
      },
      catalogs,
    );
    if (!projected.ok) return projected;
    const draft: EditableProjectMasterDraft = Object.freeze({
      expectedProjectDigest,
      expectedDefinitionDigest: expanded.definitionDigest,
      catalogSetFingerprint: baseline.catalogSetFingerprint,
      masterId,
      surfaceId,
      record: projected.record,
    });
    drafts.add(draft);
    return Object.freeze({ ok: true, draft });
  } catch {
    return failure(
      "RECIPE_MATERIALIZATION_REJECTED",
      "The visual master draft could not be prepared without changing its meaning.",
    );
  }
}

function outsideDraftScope(record: EditableProjectRecord, surfaceId: string): string {
  const surface = record.source.surfaces[surfaceId];
  if (surface === undefined) throw new RecipeMaterializationError("missing-editing-surface");
  const surfaceMetadata = Object.fromEntries(
    Object.entries(surface).filter(([key]) => !["root", "state", "resources"].includes(key)),
  );
  const graph = record.designSystem.recipeGraph;
  return canonicalizeJson({
    ...record,
    source: {
      ...record.source,
      surfaces: { ...record.source.surfaces, [surfaceId]: surfaceMetadata },
    },
    designSystem: {
      ...record.designSystem,
      recipeGraph: {
        ...graph,
        instances: graph.instances.filter((instance) => instance.surfaceId !== surfaceId),
      },
    },
  });
}

/**
 * Converts one authentic isolated visual draft into an atomic update of the original project.
 *
 * @remarks Only the draft surface's composition and its nested instance relationships may change.
 * Unused local declarations survive; changed Catalogs, foreign edits, recursive composition,
 * stale projects and conflicting instance overrides reject without publishing a partial project.
 * The App must still recheck the result's predecessor and preflight Publisher before committing.
 */
export function prepareEditableProjectMasterDraftUpdate(
  input: unknown,
  draft: unknown,
  edited: unknown,
  catalogs: unknown,
): EditableProjectRecipeTransactionResult {
  if (
    draft === null ||
    typeof draft !== "object" ||
    !drafts.has(draft as EditableProjectMasterDraft)
  ) {
    return failure(
      "RECIPE_TRANSACTION_INVALID",
      "Only an authentic visual master draft may be applied.",
    );
  }
  const handle = draft as EditableProjectMasterDraft;
  try {
    const baseline = validateEditableProjectRecipeContracts(input, catalogs);
    if (!baseline.ok) return baseline;
    if (baseline.digest !== handle.expectedProjectDigest)
      return failure(
        "RECIPE_PROJECT_STALE",
        "The project changed while the master draft was open.",
      );
    if (baseline.catalogSetFingerprint !== handle.catalogSetFingerprint)
      return failure("RECIPE_CATALOG_INVALID", "The master draft's Catalog authority changed.");
    const candidate = validateEditableProjectRecipeContracts(edited, catalogs);
    if (!candidate.ok) return candidate;
    if (
      outsideDraftScope(candidate.record, handle.surfaceId) !==
      outsideDraftScope(handle.record, handle.surfaceId)
    ) {
      return failure(
        "RECIPE_REFERENCE_CONFLICT",
        "The draft contains changes outside the selected master composition.",
      );
    }
    const graph = candidate.record.designSystem.recipeGraph;
    const original = graph.definitions.find((definition) => definition.id === handle.masterId);
    const surface = candidate.record.source.surfaces[handle.surfaceId];
    if (original === undefined || surface === undefined)
      return failure("RECIPE_TARGET_INVALID", "The selected master draft is no longer available.");
    const captured = captureRecipeFromSource(
      { ...graph, definitions: graph.definitions.filter((item) => item.id !== handle.masterId) },
      surface,
      surface.root,
      {
        masterId: handle.masterId,
        name: original.name,
        instanceId: unusedInstanceId(graph.instances),
        surfaceId: handle.surfaceId,
      },
      true,
    );
    const definition = captured.graph.definitions.find((item) => item.id === handle.masterId);
    if (definition === undefined) throw new RecipeMaterializationError("missing-draft-definition");
    return prepareEditableProjectRecipeTransaction(
      baseline.record,
      {
        type: "master.update",
        definition,
        expectedProjectDigest: handle.expectedProjectDigest,
        expectedDefinitionDigest: handle.expectedDefinitionDigest,
      },
      catalogs,
    );
  } catch {
    return failure(
      "RECIPE_MATERIALIZATION_REJECTED",
      "The master draft was rejected without changing the project or its instances.",
    );
  }
}
