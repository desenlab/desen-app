import {
  DESIGN_TOKEN_PROFILE,
  admitEditableProjectRecord,
  createEditableProjectHistory,
  createEditableProjectMasterDraft,
  migrateEditableProjectRecord,
  getEditableProjectMasterDefinitionDigest,
  prepareEditableProjectRecipeTransaction,
  prepareEditableProjectMasterDraftUpdate,
  recordEditableProjectHistory,
  redoEditableProjectHistory,
  resolveDesignTokens,
  undoEditableProjectHistory,
  validateEditableProjectRecipeContracts,
} from "@desen/design-system-core";

import type {
  DesignTokenResolutionRequest,
  DtcgColorValue,
  EditableProjectRecord,
  EditableProjectRecordV1,
  EditableProjectRecordV2,
  EditableProjectHistory,
  EditableProjectRecipeGraph,
  EditableProjectRecipeTransactionCommand,
  EditableProjectRecipeTransactionResult,
  EditableProjectRecipeContractResult,
  EditableProjectMasterDraft,
  EditableProjectMasterDraftResult,
} from "@desen/design-system-core";

declare const input: unknown;
declare const catalogs: unknown;
declare const recipeCommand: EditableProjectRecipeTransactionCommand;

const masterDraft: EditableProjectMasterDraftResult = createEditableProjectMasterDraft(
  input,
  input,
  catalogs,
);
if (masterDraft.ok) {
  const handle: EditableProjectMasterDraft = masterDraft.draft;
  const applied: EditableProjectRecipeTransactionResult = prepareEditableProjectMasterDraftUpdate(
    input,
    handle,
    input,
    catalogs,
  );
  // @ts-expect-error draft provenance fields cannot be rewritten
  handle.expectedProjectDigest = "changed";
  // @ts-expect-error projected master Source is immutable
  handle.record.source.id = "changed";
  void applied;
} else {
  // @ts-expect-error rejected draft creation exposes no partial projection
  void masterDraft.draft;
}
// @ts-expect-error explicit Catalog authority is required
createEditableProjectMasterDraft(input, input);
// @ts-expect-error committing a visual draft also requires Catalog authority
prepareEditableProjectMasterDraftUpdate(input, input, input);

const contracts: EditableProjectRecipeContractResult = validateEditableProjectRecipeContracts(
  input,
  catalogs,
);
if (contracts.ok) {
  // @ts-expect-error contract admission exposes immutable project data
  contracts.record.id = "replacement";
} else {
  // @ts-expect-error rejected contract admission cannot expose partial project authority
  void contracts.record;
}
// @ts-expect-error explicit Catalog authority is required even for read-only contract admission
validateEditableProjectRecipeContracts(input);

const recipeResult: EditableProjectRecipeTransactionResult =
  prepareEditableProjectRecipeTransaction(input, recipeCommand, catalogs);
if (recipeResult.ok) {
  const fingerprint: string = recipeResult.catalogSetFingerprint;
  const masterDigest: string | undefined = getEditableProjectMasterDefinitionDigest(
    recipeResult.record,
    "master.title",
  );
  // @ts-expect-error successful candidates are recursively immutable
  recipeResult.record.designSystem.recipeGraph.instances.push({});
  void fingerprint;
  void masterDigest;
} else {
  // @ts-expect-error failed operations never expose partial candidates
  const partial = recipeResult.record;
  void partial;
}
// @ts-expect-error explicit trusted Catalog data is mandatory
prepareEditableProjectRecipeTransaction(input, recipeCommand);
// @ts-expect-error an observed project digest is required for every command
const staleCommand: EditableProjectRecipeTransactionCommand = {
  type: "instance.detach",
  instanceId: "instance",
};
void staleCommand;

const admission = admitEditableProjectRecord(input);
if (admission.ok) {
  const project: EditableProjectRecord = admission.record;
  const current: EditableProjectRecordV2 = project;
  const schemaVersion: 2 = current.schemaVersion;
  const visualEdit: EditableProjectRecipeTransactionCommand = {
    type: "source.apply",
    expectedProjectDigest: "sha256:observed",
    source: current.source,
  };
  // @ts-expect-error a Source edit cannot omit its observed whole-project digest
  const staleVisualEdit: EditableProjectRecipeTransactionCommand = {
    type: "source.apply",
    source: current.source,
  };
  void visualEdit;
  void staleVisualEdit;
  void schemaVersion;
  const request: DesignTokenResolutionRequest = {
    sources: project.designSystem.tokenSources,
  };
  const resolution = resolveDesignTokens(request);
  if (resolution.ok) {
    const color = resolution.tokens["color.brand"]?.value;
    void color;

    // @ts-expect-error resolved maps are immutable
    resolution.tokens["color.brand"] = {} as never;
  }

  // @ts-expect-error admitted project identities are immutable
  project.id = "changed";
}

const migration = migrateEditableProjectRecord(input);
if (migration.ok) {
  const migrated: boolean = migration.migrated;
  const losses: readonly [] = migration.losses;
  void migrated;
  void losses;
}

const history = createEditableProjectHistory(input);
if (history !== undefined) {
  const typed: EditableProjectHistory = history;
  const graph: EditableProjectRecipeGraph = typed.record.designSystem.recipeGraph;
  const recorded = recordEditableProjectHistory(history, input);
  const undo = undoEditableProjectHistory(recorded.history);
  const redo = redoEditableProjectHistory(undo.history);
  // @ts-expect-error recipes and history snapshots remain immutable through the public boundary
  graph.instances.push({});
  // @ts-expect-error history cannot be mutated by consumers
  redo.history.record = typed.record;
}

declare const legacy: EditableProjectRecordV1;
const legacyVersion: 1 = legacy.schemaVersion;
// @ts-expect-error legacy metadata does not acquire authoring graph semantics
const legacyGraph = legacy.designSystem.recipeGraph;
void legacyVersion;
void legacyGraph;

const color: DtcgColorValue = {
  colorSpace: "srgb",
  components: [0, 0, 0],
};
const version: "2025.10" = DESIGN_TOKEN_PROFILE.formatVersion;

// @ts-expect-error the closed profile does not type a wide-gamut color literal
const unsupportedColor: DtcgColorValue = { colorSpace: "display-p3", components: [1, 0, 0] };

// @ts-expect-error selected token sources are required
const missingSources: DesignTokenResolutionRequest = {};

void color;
void version;
void unsupportedColor;
void missingSources;
