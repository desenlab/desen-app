import { registerComponent } from "@desen/catalog-sdk";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const LABEL_MAX_LENGTH = 256;
const CONTENT_MAX_LENGTH = 1_024;
const TABLE_CELL_MAX_LENGTH = 2_048;

/** Maximum number of managed items or table rows admitted by the T09 contracts. */
export const STARTER_DATA_DISPLAY_MAX_ITEMS = 100;

/** Maximum number of explicit semantic columns admitted by the basic T09 Table. */
export const STARTER_TABLE_MAX_COLUMNS = 12;

/** Exact capability identifier for the DESEN Neutral Card. */
export const STARTER_CARD_CAPABILITY_ID = "run.desen.starter/Card";

/** Exact capability identifier for the DESEN Neutral Badge. */
export const STARTER_BADGE_CAPABILITY_ID = "run.desen.starter/Badge";

/** Exact capability identifier for the DESEN Neutral Avatar. */
export const STARTER_AVATAR_CAPABILITY_ID = "run.desen.starter/Avatar";

/** Exact capability identifier for the DESEN Neutral Alert. */
export const STARTER_ALERT_CAPABILITY_ID = "run.desen.starter/Alert";

/** Exact capability identifier for the DESEN Neutral List. */
export const STARTER_LIST_CAPABILITY_ID = "run.desen.starter/List";

/** Exact capability identifier for the DESEN Neutral basic Table. */
export const STARTER_TABLE_CAPABILITY_ID = "run.desen.starter/Table";

/** Exact capability identifier for the DESEN Neutral Skeleton. */
export const STARTER_SKELETON_CAPABILITY_ID = "run.desen.starter/Skeleton";

/** Exact capability identifier for the DESEN Neutral Progress indicator. */
export const STARTER_PROGRESS_CAPABILITY_ID = "run.desen.starter/Progress";

const HEX_COLOR_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
  ],
} as const);

const contentSlotAcceptsCategories = Object.freeze([
  "layout",
  "content",
  "input",
  "action",
  "overlay",
  "feedback",
  "complex",
] as const);

const dataDisplayStylePropertiesSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    color: HEX_COLOR_SCHEMA,
    backgroundColor: HEX_COLOR_SCHEMA,
    borderColor: HEX_COLOR_SCHEMA,
    borderRadius: { type: "number", minimum: 0, maximum: 64 },
    borderWidth: { type: "number", minimum: 0, maximum: 16 },
    paddingBlock: { type: "number", minimum: 0, maximum: 128 },
    paddingInline: { type: "number", minimum: 0, maximum: 128 },
    marginBlock: { type: "number", minimum: 0, maximum: 128 },
    marginInline: { type: "number", minimum: 0, maximum: 128 },
    fontFamily: { type: "string", enum: ["system", "serif", "mono"] },
    fontSize: { type: "number", minimum: 8, maximum: 96 },
    fontWeight: { type: "number", enum: [400, 500, 600, 700] },
    lineHeight: { type: "number", minimum: 1, maximum: 3 },
    letterSpacing: { type: "number", minimum: -4, maximum: 16 },
    width: { type: "number", minimum: 0, maximum: 4_096 },
    minWidth: { type: "number", minimum: 0, maximum: 4_096 },
    maxWidth: { type: "number", minimum: 0, maximum: 4_096 },
    minHeight: { type: "number", minimum: 0, maximum: 4_096 },
    maxHeight: { type: "number", minimum: 0, maximum: 4_096 },
    opacity: { type: "number", minimum: 0, maximum: 1 },
  },
} as const);

function stylePart(description: string) {
  return { description, propertiesSchema: dataDisplayStylePropertiesSchema } as const;
}

const toneSchema = Object.freeze({
  type: "string",
  enum: ["neutral", "info", "success", "warning", "error"],
  default: "neutral",
} as const);

const stableIdSchema = Object.freeze({
  type: "string",
  minLength: 1,
  maxLength: 128,
} as const);

const tableColumnSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: stableIdSchema,
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
  },
} as const);

const tableRowSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["id", "cells"],
  properties: {
    id: stableIdSchema,
    cells: {
      type: "object",
      additionalProperties: { type: "string", maxLength: TABLE_CELL_MAX_LENGTH },
    },
  },
} as const);

/** Immutable Catalog registration for a semantic Card with one explicit managed content slot. */
export const starterCardComponentRegistration = registerComponent({
  id: STARTER_CARD_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral semantic Card with an explicit managed content slot.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
      },
    },
    slots: {
      content: {
        required: true,
        minItems: 1,
        maxItems: STARTER_DATA_DISPLAY_MAX_ITEMS,
        acceptsCategories: contentSlotAcceptsCategories,
        description: "Ordered managed Card content.",
      },
    },
    styleParts: {
      root: stylePart("Stable Card article surface."),
      content: stylePart("Managed Card content region."),
    },
    authoring: {
      displayName: "Card",
      category: "Data display",
      icon: "card",
      defaultProps: { label: "Card" },
      scenarios: { ready: { props: { label: "Project summary" } } },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a concise, textual status Badge. */
export const starterBadgeComponentRegistration = registerComponent({
  id: STARTER_BADGE_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral textual status Badge; tone never carries meaning without its label.",
    category: "feedback",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        tone: toneSchema,
      },
    },
    styleParts: { root: stylePart("Stable Badge text and surface.") },
    visualStates: ["info", "success", "warning", "error"],
    authoring: {
      displayName: "Badge",
      category: "Feedback",
      icon: "badge",
      defaultProps: { label: "Status", tone: "neutral" },
      scenarios: {
        ready: { props: { label: "Ready", tone: "success" } },
        error: { props: { label: "Blocked", tone: "error" } },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for an initials-only Avatar with a required text alternative. */
export const starterAvatarComponentRegistration = registerComponent({
  id: STARTER_AVATAR_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral initials Avatar with a required text alternative and no unreviewed image source.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "initials"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        initials: { type: "string", minLength: 1, maxLength: 4 },
      },
    },
    styleParts: { root: stylePart("Stable Avatar surface and initials.") },
    authoring: {
      displayName: "Avatar",
      category: "Data display",
      icon: "avatar",
      defaultProps: { label: "Ada Lovelace", initials: "AL" },
      scenarios: { ready: { props: { label: "Ada Lovelace", initials: "AL" } } },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for an accessible textual feedback Alert. */
export const starterAlertComponentRegistration = registerComponent({
  id: STARTER_ALERT_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral textual feedback Alert with an explicit severity.",
    category: "feedback",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "tone"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        description: { type: "string", minLength: 1, maxLength: CONTENT_MAX_LENGTH },
        tone: toneSchema,
      },
    },
    styleParts: {
      root: stylePart("Stable Alert region and semantic severity surface."),
      title: stylePart("Visible Alert title."),
      description: stylePart("Visible Alert description."),
    },
    visualStates: ["info", "success", "warning", "error"],
    authoring: {
      displayName: "Alert",
      category: "Feedback",
      icon: "alert",
      defaultProps: {
        title: "Something needs attention",
        description: "Review the details before continuing.",
        tone: "warning",
      },
      scenarios: {
        error: {
          props: {
            title: "Could not save changes",
            description: "Your draft is still available locally.",
            tone: "error",
          },
        },
        ready: {
          props: {
            title: "Changes saved",
            description: "Your latest design is ready to review.",
            tone: "success",
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a semantic List with identity-matched managed item slots. */
export const starterListComponentRegistration = registerComponent({
  id: STARTER_LIST_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral semantic List with explicit ordered item slots and stable item identities.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "itemIds"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        itemIds: {
          type: "array",
          maxItems: STARTER_DATA_DISPLAY_MAX_ITEMS,
          uniqueItems: true,
          items: stableIdSchema,
        },
        ordered: { type: "boolean", default: false },
        emptyText: { type: "string", minLength: 1, maxLength: CONTENT_MAX_LENGTH },
      },
    },
    slots: {
      items: {
        required: true,
        minItems: 0,
        maxItems: STARTER_DATA_DISPLAY_MAX_ITEMS,
        acceptsCategories: contentSlotAcceptsCategories,
        description: "Ordered managed list items, matched one-to-one with itemIds.",
      },
    },
    styleParts: {
      root: stylePart("Stable semantic list boundary."),
      item: stylePart("One managed list item wrapper."),
      empty: stylePart("Visible empty-list feedback text."),
    },
    authoring: {
      displayName: "List",
      category: "Data display",
      icon: "list",
      defaultProps: {
        label: "Project tasks",
        itemIds: ["research", "prototype"],
        ordered: false,
      },
      scenarios: {
        ready: {
          props: {
            label: "Project tasks",
            itemIds: ["research", "prototype"],
            ordered: false,
          },
        },
        empty: { props: { label: "Project tasks", itemIds: [], emptyText: "No tasks yet." } },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a bounded native semantic Table. */
export const starterTableComponentRegistration = registerComponent({
  id: STARTER_TABLE_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral basic data Table with explicit columns, stable row identities, and no grid behavior.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["caption", "columns", "rows"],
      properties: {
        caption: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        columns: {
          type: "array",
          minItems: 1,
          maxItems: STARTER_TABLE_MAX_COLUMNS,
          items: tableColumnSchema,
        },
        rows: {
          type: "array",
          maxItems: STARTER_DATA_DISPLAY_MAX_ITEMS,
          items: tableRowSchema,
        },
        emptyText: { type: "string", minLength: 1, maxLength: CONTENT_MAX_LENGTH },
      },
    },
    styleParts: {
      root: stylePart("Stable native table boundary."),
      caption: stylePart("Visible table caption."),
      header: stylePart("Semantic column-header cells."),
      cell: stylePart("Semantic table data cells."),
      empty: stylePart("Visible empty-table feedback cell."),
    },
    authoring: {
      displayName: "Table",
      category: "Data display",
      icon: "table",
      defaultProps: {
        caption: "Project status",
        columns: [
          { id: "name", label: "Name" },
          { id: "status", label: "Status" },
        ],
        rows: [
          { id: "research", cells: { name: "Research", status: "Ready" } },
          { id: "prototype", cells: { name: "Prototype", status: "In progress" } },
        ],
      },
      scenarios: {
        ready: {
          props: {
            caption: "Project status",
            columns: [
              { id: "name", label: "Name" },
              { id: "status", label: "Status" },
            ],
            rows: [
              { id: "research", cells: { name: "Research", status: "Ready" } },
              { id: "prototype", cells: { name: "Prototype", status: "In progress" } },
            ],
          },
        },
        empty: {
          props: {
            caption: "Project status",
            columns: [
              { id: "name", label: "Name" },
              { id: "status", label: "Status" },
            ],
            rows: [],
            emptyText: "No project rows yet.",
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a labelled, non-content-bearing loading Skeleton. */
export const starterSkeletonComponentRegistration = registerComponent({
  id: STARTER_SKELETON_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral labelled loading Skeleton with finite visual dimensions.",
    category: "feedback",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        shape: { type: "string", enum: ["line", "circle", "rectangle"], default: "line" },
        width: { type: "number", minimum: 8, maximum: 4_096, default: 160 },
        height: { type: "number", minimum: 8, maximum: 4_096, default: 16 },
      },
    },
    styleParts: { root: stylePart("Stable loading Skeleton surface.") },
    visualStates: ["loading"],
    authoring: {
      displayName: "Skeleton",
      category: "Feedback",
      icon: "skeleton",
      defaultProps: { label: "Loading project details", shape: "line", width: 160, height: 16 },
      scenarios: {
        loading: {
          props: { label: "Loading project details", shape: "line", width: 160, height: 16 },
        },
      },
      resize: { horizontal: "resizable", vertical: "resizable" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a finite, labelled native Progress indicator. */
export const starterProgressComponentRegistration = registerComponent({
  id: STARTER_PROGRESS_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral finite Progress indicator with visible and accessible value text.",
    category: "feedback",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "value"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        value: { type: "number", minimum: 0, maximum: 100 },
        showValue: { type: "boolean", default: true },
      },
    },
    styleParts: {
      root: stylePart("Stable Progress region."),
      track: stylePart("Progress track surface."),
      indicator: stylePart("Progress indicator surface."),
      label: stylePart("Visible Progress label and value text."),
    },
    visualStates: ["loading", "complete"],
    authoring: {
      displayName: "Progress",
      category: "Feedback",
      icon: "progress",
      defaultProps: { label: "Uploading assets", value: 45, showValue: true },
      scenarios: {
        loading: { props: { label: "Uploading assets", value: 45, showValue: true } },
        ready: { props: { label: "Upload complete", value: 100, showValue: true } },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Resolved JSON-only props admitted by the starter Card contract. */
export type StarterCardProps = ComponentPropsOf<typeof starterCardComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Badge contract. */
export type StarterBadgeProps = ComponentPropsOf<typeof starterBadgeComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Avatar contract. */
export type StarterAvatarProps = ComponentPropsOf<typeof starterAvatarComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Alert contract. */
export type StarterAlertProps = ComponentPropsOf<typeof starterAlertComponentRegistration>;

/** Resolved JSON-only props admitted by the starter List contract. */
export interface StarterListProps {
  /** Accessible list name. */
  readonly label: string;
  /** Stable item identities matched one-to-one with the public `items` slot. */
  readonly itemIds: readonly string[];
  /** Selects a native ordered list when true. */
  readonly ordered?: boolean;
  /** Visible feedback for a deliberately empty list. */
  readonly emptyText?: string;
}

/** One closed semantic column admitted by the starter Table contract. */
export interface StarterTableColumn {
  /** Stable column identity. */
  readonly id: string;
  /** Visible semantic column heading. */
  readonly label: string;
}

/** One closed semantic row admitted by the starter Table contract. */
export interface StarterTableRow {
  /** Stable row identity. */
  readonly id: string;
  /** Text-only cells keyed exactly by the declared column identities. */
  readonly cells: Readonly<Record<string, string>>;
}

/** Resolved JSON-only props admitted by the starter Table contract. */
export interface StarterTableProps {
  /** Visible native table caption. */
  readonly caption: string;
  /** Ordered finite semantic table columns. */
  readonly columns: readonly StarterTableColumn[];
  /** Ordered finite semantic table rows. */
  readonly rows: readonly StarterTableRow[];
  /** Visible feedback for a deliberately empty table. */
  readonly emptyText?: string;
}

/** Resolved JSON-only props admitted by the starter Skeleton contract. */
export type StarterSkeletonProps = ComponentPropsOf<typeof starterSkeletonComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Progress contract. */
export type StarterProgressProps = ComponentPropsOf<typeof starterProgressComponentRegistration>;
