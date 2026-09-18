import { registerComponent } from "@desen/catalog-sdk";

import { starterVisualStylePropertiesSchema } from "./visual-style-profile.js";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const LABEL_MAX_LENGTH = 256;
const CONTENT_MAX_LENGTH = 1_024;

/** Maximum number of inert child nodes admitted by T08 overlay content slots. */
export const STARTER_OVERLAY_CONTENT_MAX_ITEMS = 16;

/** Maximum number of ordered menu or accordion items admitted by the T08 contracts. */
export const STARTER_DISCLOSURE_MAX_ITEMS = 12;

/** Exact capability identifier for the starter Popover. */
export const STARTER_POPOVER_CAPABILITY_ID = "run.desen.starter/Popover";

/** Exact capability identifier for the starter Tooltip. */
export const STARTER_TOOLTIP_CAPABILITY_ID = "run.desen.starter/Tooltip";

/** Exact capability identifier for the starter Menu. */
export const STARTER_MENU_CAPABILITY_ID = "run.desen.starter/Menu";

/** Exact capability identifier for the starter Accordion. */
export const STARTER_ACCORDION_CAPABILITY_ID = "run.desen.starter/Accordion";

const contentAccepts = Object.freeze([
  "layout",
  "content",
  "input",
  "action",
  "overlay",
  "feedback",
  "complex",
] as const);

const itemSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 128 },
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  },
} as const);

const valueSchema = Object.freeze({
  type: "array",
  maxItems: STARTER_DISCLOSURE_MAX_ITEMS,
  uniqueItems: true,
  items: { type: "string", minLength: 1, maxLength: 128 },
} as const);

const stylePropertiesSchema = starterVisualStylePropertiesSchema("control");

function stylePart(description: string) {
  return { description, propertiesSchema: stylePropertiesSchema } as const;
}

function textProperty(defaultValue: string) {
  return {
    type: "string",
    minLength: 1,
    maxLength: LABEL_MAX_LENGTH,
    default: defaultValue,
  } as const;
}

const openChangeEvent = {
  description: "Emitted whenever the trusted open state changes.",
  payloadSchema: {
    $schema: JSON_SCHEMA_DIALECT,
    type: "object",
    additionalProperties: false,
    required: ["open"],
    properties: { open: { type: "boolean" } },
  },
} as const;

/** Immutable Catalog registration for a contained, focus-aware Popover. */
export const starterPopoverComponentRegistration = registerComponent({
  id: STARTER_POPOVER_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral anchored popover with a contained preview portal.",
    category: "overlay",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        triggerLabel: textProperty("Open popover"),
        title: textProperty("Popover title"),
        description: { ...textProperty("Popover description"), maxLength: CONTENT_MAX_LENGTH },
        closeLabel: textProperty("Close popover"),
        disabled: { type: "boolean", default: false },
      },
    },
    slots: {
      content: {
        required: true,
        minItems: 1,
        maxItems: STARTER_OVERLAY_CONTENT_MAX_ITEMS,
        acceptsCategories: contentAccepts,
        description: "Managed popover body content.",
      },
    },
    events: { openChange: openChangeEvent },
    styleParts: {
      root: stylePart("Stable popover boundary."),
      trigger: stylePart("Popover trigger control."),
      popup: stylePart("Contained popover surface."),
      title: stylePart("Popover heading."),
      description: stylePart("Popover descriptive text."),
      content: stylePart("Popover body content."),
      close: stylePart("Popover close control."),
    },
    visualStates: ["focus", "open", "disabled"],
    authoring: {
      displayName: "Popover",
      category: "Overlays",
      icon: "popover",
      defaultProps: {
        triggerLabel: "Open popover",
        title: "Popover title",
        description: "Popover description",
        closeLabel: "Close popover",
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            triggerLabel: "Open popover",
            title: "Popover title",
            description: "Popover description",
            closeLabel: "Close popover",
            disabled: false,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a contained hover/focus Tooltip. */
export const starterTooltipComponentRegistration = registerComponent({
  id: STARTER_TOOLTIP_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral accessible tooltip with a contained preview portal.",
    category: "feedback",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "content"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        content: { type: "string", minLength: 1, maxLength: CONTENT_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
      },
    },
    events: { openChange: openChangeEvent },
    styleParts: {
      root: stylePart("Stable tooltip boundary."),
      trigger: stylePart("Tooltip trigger control."),
      popup: stylePart("Contained tooltip surface."),
      arrow: stylePart("Tooltip directional arrow."),
    },
    visualStates: ["focus", "open", "disabled"],
    authoring: {
      displayName: "Tooltip",
      category: "Feedback",
      icon: "tooltip",
      defaultProps: { label: "Help", content: "Helpful context", disabled: false },
      scenarios: {
        default: { props: { label: "Help", content: "Helpful context", disabled: false } },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a keyboard-navigable Menu. */
export const starterMenuComponentRegistration = registerComponent({
  id: STARTER_MENU_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral menu with bounded data-only item identities.",
    category: "action",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["triggerLabel", "items"],
      properties: {
        triggerLabel: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        items: {
          type: "array",
          minItems: 1,
          maxItems: STARTER_DISCLOSURE_MAX_ITEMS,
          items: itemSchema,
        },
        disabled: { type: "boolean", default: false },
      },
    },
    events: {
      openChange: openChangeEvent,
      select: {
        description: "Emitted with the selected stable item identity.",
        payloadSchema: {
          $schema: JSON_SCHEMA_DIALECT,
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: { id: { type: "string", minLength: 1, maxLength: 128 } },
        },
      },
    },
    styleParts: {
      root: stylePart("Stable menu boundary."),
      trigger: stylePart("Menu trigger control."),
      popup: stylePart("Contained menu surface."),
      item: stylePart("Menu item surface."),
    },
    visualStates: ["focus", "open", "disabled", "highlighted"],
    authoring: {
      displayName: "Menu",
      category: "Actions",
      icon: "menu",
      defaultProps: {
        triggerLabel: "Open menu",
        items: [
          { id: "first", label: "First action" },
          { id: "second", label: "Second action" },
        ],
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            triggerLabel: "Open menu",
            items: [
              { id: "first", label: "First action" },
              { id: "second", label: "Second action" },
            ],
            disabled: false,
          },
        },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for an ordered keyboard-accessible Accordion. */
export const starterAccordionComponentRegistration = registerComponent({
  id: STARTER_ACCORDION_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral disclosure list with ordered public panel slots.",
    category: "overlay",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: STARTER_DISCLOSURE_MAX_ITEMS,
          items: itemSchema,
        },
        defaultValue: valueSchema,
        multiple: { type: "boolean", default: false },
        disabled: { type: "boolean", default: false },
      },
    },
    slots: {
      panels: {
        required: true,
        minItems: 1,
        maxItems: STARTER_DISCLOSURE_MAX_ITEMS,
        acceptsCategories: contentAccepts,
        description: "Ordered panel content; one node per item.",
      },
    },
    events: {
      valueChange: {
        description: "Emitted with the ordered expanded item identities.",
        payloadSchema: {
          $schema: JSON_SCHEMA_DIALECT,
          type: "object",
          additionalProperties: false,
          required: ["value"],
          properties: { value: valueSchema },
        },
      },
    },
    styleParts: {
      root: stylePart("Stable accordion boundary."),
      item: stylePart("Accordion item surface."),
      trigger: stylePart("Accordion disclosure trigger."),
      panel: stylePart("Accordion panel surface."),
    },
    visualStates: ["focus", "open", "disabled"],
    authoring: {
      displayName: "Accordion",
      category: "Disclosures",
      icon: "accordion",
      defaultProps: {
        items: [
          { id: "overview", label: "Overview" },
          { id: "details", label: "Details" },
        ],
        defaultValue: [],
        multiple: false,
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            items: [
              { id: "overview", label: "Overview" },
              { id: "details", label: "Details" },
            ],
            defaultValue: [],
            multiple: false,
            disabled: false,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** JSON-only Popover props admitted by the starter contract. */
export type StarterPopoverProps = ComponentPropsOf<typeof starterPopoverComponentRegistration>;
/** JSON-only Tooltip props admitted by the starter contract. */
export type StarterTooltipProps = ComponentPropsOf<typeof starterTooltipComponentRegistration>;
/** JSON-only Menu props admitted by the starter contract. */
export type StarterMenuProps = ComponentPropsOf<typeof starterMenuComponentRegistration>;
/** JSON-only Accordion props admitted by the starter contract. */
export type StarterAccordionProps = ComponentPropsOf<typeof starterAccordionComponentRegistration>;

export type StarterDisclosureItem = Readonly<{ id: string; label: string; disabled?: boolean }>;
