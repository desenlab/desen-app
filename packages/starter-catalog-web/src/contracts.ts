import { registerComponent } from "@desen/catalog-sdk";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

/** Exact Catalog identity reserved for the DESEN Neutral Web starter package. */
export const STARTER_CATALOG_ID = "run.desen.starter.web";

/** Initial Catalog contract version for the bounded M10A-T01 starter slice. */
export const STARTER_CATALOG_VERSION = "0.1.0";

/** Target implemented by the initial DESEN Neutral starter package. */
export const STARTER_CATALOG_TARGET = "web-react";

/** Exact capability identifier for the starter Button. */
export const STARTER_BUTTON_CAPABILITY_ID = "run.desen.starter/Button";

/** Exact capability identifier for the starter Select. */
export const STARTER_SELECT_CAPABILITY_ID = "run.desen.starter/Select";

/** Exact capability identifier for the starter Dialog. */
export const STARTER_DIALOG_CAPABILITY_ID = "run.desen.starter/Dialog";

/** Maximum number of inert options admitted by the T01 Select contract. */
export const STARTER_SELECT_MAX_OPTIONS = 100;

/** Maximum number of Source children admitted by the T01 Dialog content slot. */
export const STARTER_DIALOG_CONTENT_MAX_ITEMS = 16;

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const HEX_COLOR_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
  ],
} as const);

const neutralStylePropertiesSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    color: {
      ...HEX_COLOR_SCHEMA,
      description: "Resolved six- or eight-digit hexadecimal foreground color.",
    },
    backgroundColor: {
      ...HEX_COLOR_SCHEMA,
      description: "Resolved six- or eight-digit hexadecimal background color.",
    },
    borderColor: {
      ...HEX_COLOR_SCHEMA,
      description: "Resolved six- or eight-digit hexadecimal border color.",
    },
    borderRadius: {
      type: "number",
      minimum: 0,
      maximum: 64,
      description: "Corner radius in CSS pixels.",
    },
    padding: {
      type: "number",
      minimum: 0,
      maximum: 128,
      description: "Uniform padding in CSS pixels.",
    },
    fontSize: {
      type: "number",
      minimum: 8,
      maximum: 96,
      description: "Font size in CSS pixels.",
    },
  },
} as const);

function neutralStylePart(description: string) {
  return {
    description,
    propertiesSchema: neutralStylePropertiesSchema,
  } as const;
}

/**
 * Immutable Catalog registration for the DESEN Neutral Button capability.
 *
 * @remarks The contract admits only inert label and state data. Native activation is projected by
 * the trusted adapter as the declared empty `press` payload.
 */
export const starterButtonComponentRegistration = registerComponent({
  id: STARTER_BUTTON_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral action button.",
    category: "action",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: {
          type: "string",
          minLength: 1,
          maxLength: 256,
        },
        disabled: {
          type: "boolean",
          default: false,
        },
        loading: {
          type: "boolean",
          default: false,
        },
      },
    },
    events: {
      press: {
        description: "Emitted after an admitted user activation.",
        payloadSchema: {
          $schema: JSON_SCHEMA_DIALECT,
          type: "object",
          additionalProperties: false,
        },
      },
    },
    styleParts: {
      root: neutralStylePart("Stable outer action surface."),
      label: neutralStylePart("Visible button label."),
    },
    visualStates: ["hover", "focus", "pressed", "disabled", "loading"],
    authoring: {
      displayName: "Button",
      category: "Actions",
      icon: "button",
      defaultProps: {
        label: "Button",
        disabled: false,
        loading: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Continue",
            disabled: false,
            loading: false,
          },
        },
        loading: {
          props: {
            label: "Continue",
            disabled: false,
            loading: true,
          },
        },
        disabled: {
          props: {
            label: "Continue",
            disabled: true,
            loading: false,
          },
        },
      },
      resize: {
        horizontal: "hug",
        vertical: "hug",
      },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral Select capability.
 *
 * @remarks Options are bounded inert records. Their values must be unique at the trusted adapter
 * boundary because JSON Schema cannot express uniqueness of one object member across an array.
 */
export const starterSelectComponentRegistration = registerComponent({
  id: STARTER_SELECT_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral single-value select.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "options"],
      properties: {
        label: {
          type: "string",
          minLength: 1,
          maxLength: 256,
        },
        options: {
          type: "array",
          maxItems: STARTER_SELECT_MAX_OPTIONS,
          uniqueItems: true,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["value", "label"],
            properties: {
              value: {
                type: "string",
                minLength: 1,
                maxLength: 128,
              },
              label: {
                type: "string",
                minLength: 1,
                maxLength: 256,
              },
              disabled: {
                type: "boolean",
                default: false,
              },
            },
          },
        },
        defaultValue: {
          type: "string",
          minLength: 1,
          maxLength: 128,
        },
        disabled: {
          type: "boolean",
          default: false,
        },
      },
    },
    events: {
      change: {
        description: "Emitted with the newly selected inert option value.",
        payloadSchema: {
          $schema: JSON_SCHEMA_DIALECT,
          type: "object",
          additionalProperties: false,
          required: ["value"],
          properties: {
            value: {
              type: "string",
            },
          },
        },
      },
    },
    styleParts: {
      root: neutralStylePart("Stable outer select surface."),
      label: neutralStylePart("Visible select label."),
      trigger: neutralStylePart("Interactive select trigger."),
      popup: neutralStylePart("Portaled options popup."),
      item: neutralStylePart("One selectable option."),
    },
    visualStates: ["hover", "focus", "open", "selected", "highlighted", "disabled"],
    authoring: {
      displayName: "Select",
      category: "Inputs",
      icon: "select",
      defaultProps: {
        label: "Select",
        options: [{ value: "option-1", label: "Option 1", disabled: false }],
        defaultValue: "option-1",
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Select an option",
            options: [
              { value: "first", label: "First", disabled: false },
              { value: "second", label: "Second", disabled: false },
            ],
            defaultValue: "first",
            disabled: false,
          },
        },
        disabled: {
          props: {
            label: "Select an option",
            options: [{ value: "first", label: "First", disabled: false }],
            defaultValue: "first",
            disabled: true,
          },
        },
      },
      resize: {
        horizontal: "resizable",
        vertical: "hug",
      },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral Dialog capability.
 *
 * @remarks Trigger and close controls are trusted internal Base UI buttons. The required `content`
 * slot contains only declared DESEN children and never exposes React nodes or callbacks as props.
 */
export const starterDialogComponentRegistration = registerComponent({
  id: STARTER_DIALOG_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral modal dialog.",
    category: "overlay",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        triggerLabel: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          default: "Open dialog",
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          default: "Dialog title",
        },
        description: {
          type: "string",
          minLength: 1,
          maxLength: 1_024,
          default: "Dialog description",
        },
        closeLabel: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          default: "Close dialog",
        },
        disabled: {
          type: "boolean",
          default: false,
        },
      },
    },
    slots: {
      content: {
        required: true,
        minItems: 1,
        maxItems: STARTER_DIALOG_CONTENT_MAX_ITEMS,
        accepts: [
          STARTER_BUTTON_CAPABILITY_ID,
          STARTER_SELECT_CAPABILITY_ID,
          STARTER_DIALOG_CAPABILITY_ID,
        ],
        description: "Managed dialog body content.",
      },
    },
    events: {
      openChange: {
        description: "Emitted whenever the trusted dialog open state changes.",
        payloadSchema: {
          $schema: JSON_SCHEMA_DIALECT,
          type: "object",
          additionalProperties: false,
          required: ["open"],
          properties: {
            open: {
              type: "boolean",
            },
          },
        },
      },
    },
    styleParts: {
      root: neutralStylePart("Stable dialog boundary."),
      trigger: neutralStylePart("Internal dialog trigger."),
      backdrop: neutralStylePart("Modal backdrop."),
      popup: neutralStylePart("Portaled dialog surface."),
      title: neutralStylePart("Dialog heading."),
      description: neutralStylePart("Dialog descriptive text."),
      close: neutralStylePart("Internal close control."),
    },
    visualStates: ["focus", "open", "disabled"],
    authoring: {
      displayName: "Dialog",
      category: "Overlays",
      icon: "dialog",
      defaultProps: {
        triggerLabel: "Open dialog",
        title: "Dialog title",
        description: "Dialog description",
        closeLabel: "Close dialog",
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            triggerLabel: "Open dialog",
            title: "Dialog title",
            description: "Dialog description",
            closeLabel: "Close dialog",
            disabled: false,
          },
        },
        disabled: {
          props: {
            triggerLabel: "Open dialog",
            title: "Dialog title",
            description: "Dialog description",
            closeLabel: "Close dialog",
            disabled: true,
          },
        },
      },
      resize: {
        horizontal: "resizable",
        vertical: "hug",
      },
      adapterFidelity: "same",
    },
  },
});

/** Resolved JSON-only props admitted by the starter Button contract. */
export type StarterButtonProps = ComponentPropsOf<typeof starterButtonComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Select contract. */
export type StarterSelectProps = ComponentPropsOf<typeof starterSelectComponentRegistration>;

/** One inert option admitted by the starter Select contract. */
export type StarterSelectOption = StarterSelectProps["options"][number];

/** Resolved JSON-only props admitted by the starter Dialog contract. */
export type StarterDialogProps = ComponentPropsOf<typeof starterDialogComponentRegistration>;

/**
 * Deterministically ordered, recursively frozen M10A-T01 component inventory.
 *
 * @remarks Inventory order is Button, Select, Dialog. It is data for later Catalog composition and
 * grants no adapter or package trust by itself.
 */
export const STARTER_COMPONENT_REGISTRATIONS = Object.freeze([
  starterButtonComponentRegistration,
  starterSelectComponentRegistration,
  starterDialogComponentRegistration,
] as const);

/**
 * Digest-free input template for later starter Catalog construction.
 *
 * @remarks This value is deliberately not a `desen.catalog`: it has no `packageDigest`, `kind`, or
 * release authority. The package-digest owner must bind reviewed emitted bytes before calling the
 * Catalog builder.
 */
export const STARTER_CATALOG_TEMPLATE = Object.freeze({
  id: STARTER_CATALOG_ID,
  version: STARTER_CATALOG_VERSION,
  target: STARTER_CATALOG_TARGET,
  description: "DESEN Neutral Web–React starter capability contracts.",
  components: STARTER_COMPONENT_REGISTRATIONS,
});
