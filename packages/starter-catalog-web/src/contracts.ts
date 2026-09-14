import { registerComponent } from "@desen/catalog-sdk";

import {
  starterBoxComponentRegistration,
  starterGridComponentRegistration,
  starterHeadingComponentRegistration,
  starterIconComponentRegistration,
  starterImageComponentRegistration,
  starterSeparatorComponentRegistration,
  starterStackComponentRegistration,
  starterTextComponentRegistration,
} from "./layout-content-contracts.js";
import {
  starterCheckboxComponentRegistration,
  starterRadioGroupComponentRegistration,
  starterSwitchComponentRegistration,
  starterTextAreaComponentRegistration,
  starterTextFieldComponentRegistration,
} from "./form-control-contracts.js";
import {
  starterComboboxComponentRegistration,
  starterNumberFieldComponentRegistration,
  starterSelectT07ComponentRegistration,
  starterSliderComponentRegistration,
  starterTabsComponentRegistration,
} from "./selection-numeric-contracts.js";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

/** Exact Catalog identity reserved for the DESEN Neutral Web starter package. */
export const STARTER_CATALOG_ID = "run.desen.starter.web";

/** Current additive Catalog contract version for the bounded M10A-T07 starter slice. */
export const STARTER_CATALOG_VERSION = "0.4.0";

/** Target implemented by the current DESEN Neutral starter package. */
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

/** Current T07 extension of the original Select capability under its unchanged capability id. */
export const starterSelectComponentRegistration = starterSelectT07ComponentRegistration;

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

/** One inert option admitted by the upgraded Select contract. */
export type StarterSelectOption =
  | Readonly<{ id: string; label: string; disabled?: boolean; value?: never }>
  | Readonly<{ value: string; label: string; disabled?: boolean; id?: never }>;

/**
 * Public JSON-only props for the upgraded Select contract.
 *
 * @remarks This explicit type retains the exact legacy-or-id option union. The generic schema
 * helper cannot express `anyOf` without widening a property to `unknown` at the TypeScript edge.
 */
export interface StarterSelectProps {
  readonly label: string;
  readonly options: readonly StarterSelectOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly disabled?: boolean;
}

/** Resolved JSON-only props admitted by the starter Dialog contract. */
export type StarterDialogProps = ComponentPropsOf<typeof starterDialogComponentRegistration>;

/**
 * Deterministically ordered, recursively frozen starter component inventory.
 *
 * @remarks T01's Button/Select/Dialog and T05's layout/content capabilities retain their original
 * order. T06 appends its finite form controls without creating a second Button capability. This is
 * data for later Catalog composition and grants no adapter or package trust by itself.
 */
export const STARTER_COMPONENT_REGISTRATIONS = Object.freeze([
  starterButtonComponentRegistration,
  starterSelectComponentRegistration,
  starterDialogComponentRegistration,
  starterBoxComponentRegistration,
  starterStackComponentRegistration,
  starterGridComponentRegistration,
  starterTextComponentRegistration,
  starterHeadingComponentRegistration,
  starterImageComponentRegistration,
  starterIconComponentRegistration,
  starterSeparatorComponentRegistration,
  starterTextFieldComponentRegistration,
  starterTextAreaComponentRegistration,
  starterCheckboxComponentRegistration,
  starterRadioGroupComponentRegistration,
  starterSwitchComponentRegistration,
  starterComboboxComponentRegistration,
  starterTabsComponentRegistration,
  starterSliderComponentRegistration,
  starterNumberFieldComponentRegistration,
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

export {
  STARTER_BOX_CAPABILITY_ID,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_LAYOUT_CONTENT_MAX_ITEMS,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  starterBoxComponentRegistration,
  starterGridComponentRegistration,
  starterHeadingComponentRegistration,
  starterIconComponentRegistration,
  starterImageComponentRegistration,
  starterSeparatorComponentRegistration,
  starterStackComponentRegistration,
  starterTextComponentRegistration,
} from "./layout-content-contracts.js";
export type {
  StarterBoxProps,
  StarterGridProps,
  StarterHeadingProps,
  StarterIconProps,
  StarterImageProps,
  StarterSeparatorProps,
  StarterStackProps,
  StarterTextProps,
} from "./layout-content-contracts.js";
export {
  STARTER_CHECKBOX_CAPABILITY_ID,
  STARTER_RADIO_GROUP_CAPABILITY_ID,
  STARTER_RADIO_GROUP_MAX_OPTIONS,
  STARTER_SWITCH_CAPABILITY_ID,
  STARTER_TEXT_AREA_CAPABILITY_ID,
  STARTER_TEXT_FIELD_CAPABILITY_ID,
  starterCheckboxComponentRegistration,
  starterRadioGroupComponentRegistration,
  starterSwitchComponentRegistration,
  starterTextAreaComponentRegistration,
  starterTextFieldComponentRegistration,
} from "./form-control-contracts.js";
export {
  STARTER_COMBOBOX_CAPABILITY_ID,
  STARTER_NUMBER_FIELD_CAPABILITY_ID,
  STARTER_NUMERIC_MAX_STEP,
  STARTER_NUMERIC_MAXIMUM,
  STARTER_NUMERIC_MINIMUM,
  STARTER_SELECTION_MAX_OPTIONS,
  STARTER_SLIDER_CAPABILITY_ID,
  STARTER_TABS_CAPABILITY_ID,
  STARTER_TABS_MAX_ITEMS,
  starterComboboxComponentRegistration,
  starterNumberFieldComponentRegistration,
  starterSliderComponentRegistration,
  starterTabsComponentRegistration,
} from "./selection-numeric-contracts.js";
export type {
  StarterComboboxOption,
  StarterComboboxProps,
  StarterNumberFieldProps,
  StarterSliderProps,
  StarterTab,
  StarterTabsProps,
  StarterT07SelectOption,
  StarterT07SelectProps,
} from "./selection-numeric-contracts.js";
export type {
  StarterCheckboxProps,
  StarterRadioGroupOption,
  StarterRadioGroupProps,
  StarterSwitchProps,
  StarterTextAreaProps,
  StarterTextFieldProps,
} from "./form-control-contracts.js";
