import type {
  EditableProjectInstanceOverride,
  EditableProjectMasterDefinition,
  EditableProjectOverrideProperty,
  EditableProjectRecipeOwner,
} from "./master-instance-types.js";
import type { EditableProjectRecord } from "./project-record.js";

interface RecipeTransactionBase {
  /** Exact complete-project digest captured when the user began the operation. */
  readonly expectedProjectDigest: string;
}

/** Exact insertion boundary in an ordinary component- or behavior-owned Source slot. */
export interface EditableProjectInstanceDestination {
  /** Existing project surface map key. */
  readonly surfaceId: string;
  /** Existing unmanaged component or behavior that owns the destination slot. */
  readonly parentId: string;
  /** Catalog-declared named slot. */
  readonly slot: string;
  /** Zero-based insertion boundary; zero creates an absent slot. */
  readonly index: number;
}

/** Data-only command for preparing one atomic recipe change over a complete project. */
export type EditableProjectRecipeTransactionCommand = RecipeTransactionBase &
  (
    | Readonly<{
        /** Applies an ordinary Source edit while retaining coherent master/instance relationships. */
        type: "source.apply";
        /**
         * Complete requested Source. Managed prop/style edits become explicit scoped overrides;
         * managed structural edits reject unless a whole instance is intentionally deleted.
         */
        source: EditableProjectRecord["source"];
      }>
    | Readonly<{
        /** Creates a new named definition without inserting an instance. */
        type: "master.create";
        /** Complete new authoring definition, including explicit nested occurrences. */
        definition: EditableProjectMasterDefinition;
      }>
    | Readonly<{
        /** Makes an existing ordinary subtree reusable without changing its Source. */
        type: "master.capture";
        /** Unique project-local definition identity. */
        masterId: string;
        /** Human-facing master name. */
        name: string;
        /** Existing surface containing the selected composition. */
        surfaceId: string;
        /** Selected component root; managed descendants become nested occurrences. */
        nodeId: string;
        /** Unique identity of the new top-level linked instance. */
        instanceId: string;
      }>
    | Readonly<{
        /** Updates one definition and all directly or transitively dependent instances. */
        type: "master.update";
        /** Replacement with the same definition identity; child identities are authored explicitly. */
        definition: EditableProjectMasterDefinition;
        /** Exact digest of the previously observed definition's transitive closure. */
        expectedDefinitionDigest: string;
      }>
    | Readonly<{
        /** Deletes an unused definition; dependants require an explicit preceding edit. */
        type: "master.delete";
        /** Existing project-local master identity. */
        masterId: string;
      }>
    | Readonly<{
        /** Materializes a new linked instance at an ordinary Source insertion boundary. */
        type: "instance.insert";
        /** Unique project-local instance identity. */
        instanceId: string;
        /** Existing project-local master identity. */
        masterId: string;
        /** Complete destination; managed structural edits require a master update. */
        destination: EditableProjectInstanceDestination;
      }>
    | Readonly<{
        /** Adds or replaces one explicit instance-local override. */
        type: "instance.override";
        /** Existing linked instance identity. */
        instanceId: string;
        /** Exact conceptual owner, contract field and ordinary ValueSpec. */
        override: EditableProjectInstanceOverride;
      }>
    | Readonly<{
        /** Removes an override, restoring the current master/default value. */
        type: "instance.reset";
        /** Existing linked instance identity. */
        instanceId: string;
        /** Exact conceptual owner of the overridden field. */
        owner: EditableProjectRecipeOwner;
        /** Exact prop/style field to reset. */
        property: EditableProjectOverrideProperty;
      }>
    | Readonly<{
        /** Removes only the authoring relationship, preserving the complete Source exactly. */
        type: "instance.detach";
        /** Existing linked instance identity. */
        instanceId: string;
      }>
    | Readonly<{
        /** Deletes a non-root instance and its owned declarations without dangling surviving wiring. */
        type: "instance.delete";
        /** Existing linked instance identity. */
        instanceId: string;
      }>
  );

/** Stable classification of a rejected whole-project recipe candidate. */
export type EditableProjectRecipeTransactionDiagnosticCode =
  | "RECIPE_TRANSACTION_INVALID"
  | "RECIPE_PROJECT_INVALID"
  | "RECIPE_PROJECT_STALE"
  | "RECIPE_DEFINITION_STALE"
  | "RECIPE_TARGET_INVALID"
  | "RECIPE_IDENTITY_CONFLICT"
  | "RECIPE_REFERENCE_CONFLICT"
  | "RECIPE_CATALOG_INVALID"
  | "RECIPE_SEMANTIC_INVALID"
  | "RECIPE_MATERIALIZATION_REJECTED";

/** Bounded diagnostic; caller data and partial candidate contents never escape on failure. */
export interface EditableProjectRecipeTransactionDiagnostic {
  /** Stable failure category. */
  readonly code: EditableProjectRecipeTransactionDiagnosticCode;
  /** Redacted explanation of the rejected operation. */
  readonly message: string;
}

/** Complete semantically checked candidate; the App still owns Publisher preflight and commit. */
export interface EditableProjectRecipeTransactionSuccess {
  /** Confirms that the entire candidate, never a partial edit, is available. */
  readonly ok: true;
  /** Whether complete canonical project data differs from the observed predecessor. */
  readonly changed: boolean;
  /** Detached immutable candidate with ordinary materialized Source. */
  readonly record: EditableProjectRecord;
  /** Captured predecessor identity; the App must recheck it before committing. */
  readonly previousDigest: string;
  /** Exact complete candidate identity. */
  readonly digest: string;
  /** Identity of the exact Catalog set used for all candidate and definition checks. */
  readonly catalogSetFingerprint: string;
  /** Sorted identities of inserted, updated, detached or deleted instance relationships. */
  readonly affectedInstanceIds: readonly string[];
  /** No diagnostics accompany a successful candidate. */
  readonly diagnostics: readonly [];
}

/** Failed candidate preparation, with no changed project, Source or allocated identity result. */
export interface EditableProjectRecipeTransactionFailure {
  /** Confirms that no candidate is available. */
  readonly ok: false;
  /** One finite reason for rejection. */
  readonly diagnostics: readonly [EditableProjectRecipeTransactionDiagnostic];
}

/** Controlled result of preparing a data-only atomic master/instance operation. */
export type EditableProjectRecipeTransactionResult =
  EditableProjectRecipeTransactionSuccess | EditableProjectRecipeTransactionFailure;

/** Read-only whole-project and recipe-contract admission; no history or runtime authority. */
export type EditableProjectRecipeContractResult =
  | Readonly<{
      /** Confirms Source and every used or unused definition satisfy the supplied Catalogs. */
      ok: true;
      /** Complete detached project whose managed regions equal their stored materialization. */
      record: EditableProjectRecord;
      /** Exact canonical identity of that complete record. */
      digest: string;
      /** Identity of the explicitly supplied, admitted Catalog set. */
      catalogSetFingerprint: string;
    }>
  | EditableProjectRecipeTransactionFailure;
