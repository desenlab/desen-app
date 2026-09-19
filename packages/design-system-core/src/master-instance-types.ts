import type { DesenEditorDocument } from "@desen/editor-core";

type SourceSurface = DesenEditorDocument["surfaces"][string];
type SourceNode = SourceSurface["root"];
type SourceBehavior = NonNullable<SourceNode["behaviors"]>[number];

/** Finite graph and expansion budgets, subordinate to the whole-project JSON budget. */
export const EDITABLE_PROJECT_RECIPE_LIMITS = Object.freeze({
  maxDefinitions: 256,
  maxInstances: 2_048,
  maxTemplateOwners: 8_192,
  maxExpandedOwners: 8_192,
  maxCompositionDepth: 32,
  maxOverrides: 1_024,
  maxMappings: 8_192,
});

/** A component template containing ordinary Source fields and authoring-only slot children. */
export type EditableProjectRecipeNode = Omit<SourceNode, "slots" | "behaviors"> &
  Readonly<{
    /** Distinguishes an ordinary capability from a nested master occurrence. */
    kind: "node";
    /** Named capability slots containing templates in authored order. */
    slots?: Readonly<Record<string, readonly EditableProjectRecipeChild[]>>;
    /** Ordinary attached behaviors whose slots may contain nested compositions. */
    behaviors?: readonly EditableProjectRecipeBehavior[];
  }>;

/** A behavior template with ordinary Source fields and authoring-only slot children. */
export type EditableProjectRecipeBehavior = Omit<SourceBehavior, "slots"> &
  Readonly<{
    /** Named behavior slots containing templates in authored order. */
    slots?: Readonly<Record<string, readonly EditableProjectRecipeChild[]>>;
  }>;

/** A stable nested occurrence; materialization replaces it with ordinary Source nodes. */
export interface EditableProjectRecipeOccurrence {
  /** Authoring discriminator which never enters canonical Source. */
  readonly kind: "instance";
  /** Definition-local occurrence identity, stable across slot reordering. */
  readonly id: string;
  /** Exact project-local master definition. */
  readonly masterId: string;
  /** Overrides relative to this occurrence's definition and nested descendants. */
  readonly overrides: readonly EditableProjectInstanceOverride[];
}

/** Either a capability template or a nested master occurrence. */
export type EditableProjectRecipeChild =
  EditableProjectRecipeNode | EditableProjectRecipeOccurrence;

/** Stable conceptual identity; array positions are deliberately absent. */
export interface EditableProjectRecipeOwner {
  /** Ordered stable nested-occurrence IDs from the top-level instance. */
  readonly path: readonly string[];
  /** Definition owning the local identity. */
  readonly definitionId: string;
  /** The Source namespace owned by this mapping. */
  readonly kind: "node" | "behavior" | "state" | "resource" | "operation";
  /** Definition-local identity, including a state/resource/operation alias where appropriate. */
  readonly id: string;
}

/** A finite exposed property addressed by an explicit instance override. */
export type EditableProjectOverrideProperty =
  | Readonly<{
      /** One Catalog-declared component or behavior prop. */
      kind: "prop";
      /** Exact public prop name. */
      name: string;
    }>
  | Readonly<{
      /** One Catalog-declared visual property. */
      kind: "style";
      /** Exact public visual-state name. */
      state: string;
      /** Exact public style-part name. */
      part: string;
      /** Exact public style-property name. */
      name: string;
    }>;

/** An explicit value override; resetting removes this record rather than copying the master. */
export interface EditableProjectInstanceOverride {
  /** Conceptual component/behavior owner; other owner kinds cannot receive overrides. */
  readonly owner: EditableProjectRecipeOwner;
  /** Exposed contract field to replace. */
  readonly property: EditableProjectOverrideProperty;
  /** Ordinary DESEN ValueSpec, admitted together with the final complete Source. */
  readonly value: NonNullable<SourceNode["props"]>[string];
}

/** One named reusable composition with independently materialized local binding declarations. */
export interface EditableProjectMasterDefinition {
  /** Stable project-local master identity. */
  readonly id: string;
  /** Human-facing master name. */
  readonly name: string;
  /** Complete recipe tree, including stable nested occurrences. */
  readonly root: EditableProjectRecipeChild;
  /** Instance-local state declarations, copied and remapped during materialization. */
  readonly state: SourceSurface["state"];
  /** Instance-local resource declarations, copied and remapped during materialization. */
  readonly resources: SourceSurface["resources"];
}

/** Complete durable mapping of one conceptual owner to its ordinary Source identity. */
export interface EditableProjectInstanceMapping {
  /** Qualified conceptual owner. */
  readonly owner: EditableProjectRecipeOwner;
  /** Allocated ordinary Source node/behavior ID or binding alias. */
  readonly sourceId: string;
}

/** Durable linked instance with exact materialization and definition provenance. */
export interface EditableProjectMasterInstance {
  /** Stable project-local instance identity. */
  readonly id: string;
  /** Top-level master definition. */
  readonly masterId: string;
  /** Source surface containing the complete managed region. */
  readonly surfaceId: string;
  /** Root of the already-materialized Source subtree. */
  readonly rootId: string;
  /** Canonical digest of this definition and its transitive definition closure. */
  readonly definitionDigest: string;
  /** Canonical digest of the materialized subtree and owned state/resource declarations. */
  readonly materializedDigest: string;
  /** Every qualified conceptual owner has exactly one persistent Source mapping. */
  readonly mapping: readonly EditableProjectInstanceMapping[];
  /** Explicit local overrides applied after master/nested-occurrence defaults. */
  readonly overrides: readonly EditableProjectInstanceOverride[];
}

/** Authoring-only recipe authority in schema V2, separate from legacy inert recipe metadata. */
export interface EditableProjectRecipeGraph {
  /** Named definitions, uniquely identified across the project. */
  readonly definitions: readonly EditableProjectMasterDefinition[];
  /** Non-overlapping linked managed regions in canonical Source. */
  readonly instances: readonly EditableProjectMasterInstance[];
}
