import { registerComponent } from "@desen/catalog-sdk";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

/** Exact capability identifier for the starter TextField. */
export const STARTER_TEXT_FIELD_CAPABILITY_ID = "run.desen.starter/TextField";

/** Exact capability identifier for the starter TextArea. */
export const STARTER_TEXT_AREA_CAPABILITY_ID = "run.desen.starter/TextArea";

/** Exact capability identifier for the starter Checkbox. */
export const STARTER_CHECKBOX_CAPABILITY_ID = "run.desen.starter/Checkbox";

/** Exact capability identifier for the starter RadioGroup. */
export const STARTER_RADIO_GROUP_CAPABILITY_ID = "run.desen.starter/RadioGroup";

/** Exact capability identifier for the starter Switch. */
export const STARTER_SWITCH_CAPABILITY_ID = "run.desen.starter/Switch";

/** Maximum number of inert options admitted by the RadioGroup contract. */
export const STARTER_RADIO_GROUP_MAX_OPTIONS = 100;

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const TEXT_VALUE_MAX_LENGTH = 4_096;
const LABEL_MAX_LENGTH = 256;
const MESSAGE_MAX_LENGTH = 512;
const OPTION_VALUE_MAX_LENGTH = 128;
const TEXT_AREA_MIN_ROWS = 2;
const TEXT_AREA_MAX_ROWS = 12;

const HEX_COLOR_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
  ],
} as const);

/**
 * The bounded styling vocabulary deliberately shared by every public form part.
 *
 * @remarks The closed schema prevents a style override from reaching private adapter DOM or
 * arbitrary CSS while still exposing the neutral surface, typography, border, and spacing values
 * needed to compose an accessible field.
 */
const neutralFormStylePropertiesSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  properties: {
    color: { ...HEX_COLOR_SCHEMA, description: "Resolved six- or eight-digit foreground color." },
    backgroundColor: {
      ...HEX_COLOR_SCHEMA,
      description: "Resolved six- or eight-digit solid background color.",
    },
    borderColor: { ...HEX_COLOR_SCHEMA, description: "Resolved border color." },
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

const textChangePayloadSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: { type: "string", maxLength: TEXT_VALUE_MAX_LENGTH },
  },
} as const);

const radioChangePayloadSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: { type: "string", maxLength: OPTION_VALUE_MAX_LENGTH },
  },
} as const);

const checkedChangePayloadSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  required: ["checked"],
  properties: {
    checked: { type: "boolean" },
  },
} as const);

const radioOptionSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["value", "label"],
  properties: {
    value: { type: "string", minLength: 1, maxLength: OPTION_VALUE_MAX_LENGTH },
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  },
} as const);

function neutralFormStylePart(description: string) {
  return {
    description,
    propertiesSchema: neutralFormStylePropertiesSchema,
  } as const;
}

function standardFormStyleParts() {
  return {
    root: neutralFormStylePart("Stable outer field composition and safe layout surface."),
    label: neutralFormStylePart("Visible label that remains associated with its semantic control."),
    control: neutralFormStylePart(
      "Native control surface without exposing private adapter structure.",
    ),
    help: neutralFormStylePart("Supplementary help text associated with the semantic control."),
    error: neutralFormStylePart("Validation message associated with the semantic control."),
  } as const;
}

/**
 * Immutable Catalog registration for the DESEN Neutral TextField capability.
 *
 * @remarks The registration contains only controlled, inert JSON data. The trusted adapter owns
 * native input events and projects only the declared `change` value payload across the boundary.
 */
export const starterTextFieldComponentRegistration = registerComponent({
  id: STARTER_TEXT_FIELD_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral single-line text field with label, help, and error composition.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        value: { type: "string", maxLength: TEXT_VALUE_MAX_LENGTH, default: "" },
        placeholder: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        error: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        required: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description:
          "Emitted with the controlled text value after an admitted native input change.",
        payloadSchema: textChangePayloadSchema,
      },
    },
    styleParts: standardFormStyleParts(),
    visualStates: ["hover", "focus", "disabled", "required", "invalid"],
    authoring: {
      displayName: "Text field",
      category: "Inputs",
      icon: "text-field",
      defaultProps: {
        label: "Label",
        value: "",
        placeholder: "Enter text",
        helpText: "Helpful supporting text.",
        disabled: false,
        required: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Email address",
            value: "",
            placeholder: "name@example.com",
            helpText: "We will use this for account notifications.",
            disabled: false,
            required: true,
          },
        },
        invalid: {
          props: {
            label: "Email address",
            value: "invalid",
            error: "Enter a valid email address.",
            disabled: false,
            required: true,
          },
        },
        disabled: {
          props: {
            label: "Email address",
            value: "name@example.com",
            disabled: true,
            required: false,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral TextArea capability.
 *
 * @remarks Rows are a finite visual hint only; the trusted adapter preserves the same inert value
 * boundary and label/help/error relationships as {@link starterTextFieldComponentRegistration}.
 */
export const starterTextAreaComponentRegistration = registerComponent({
  id: STARTER_TEXT_AREA_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral multi-line text field with bounded rows and accessible composition.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        value: { type: "string", maxLength: TEXT_VALUE_MAX_LENGTH, default: "" },
        placeholder: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        error: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        required: { type: "boolean", default: false },
        rows: {
          type: "integer",
          minimum: TEXT_AREA_MIN_ROWS,
          maximum: TEXT_AREA_MAX_ROWS,
          default: 4,
        },
      },
    },
    events: {
      change: {
        description:
          "Emitted with the controlled multi-line value after an admitted native change.",
        payloadSchema: textChangePayloadSchema,
      },
    },
    styleParts: standardFormStyleParts(),
    visualStates: ["hover", "focus", "disabled", "required", "invalid"],
    authoring: {
      displayName: "Text area",
      category: "Inputs",
      icon: "text-area",
      defaultProps: {
        label: "Description",
        value: "",
        placeholder: "Describe your work",
        helpText: "Use a few clear sentences.",
        disabled: false,
        required: false,
        rows: 4,
      },
      scenarios: {
        default: {
          props: {
            label: "Project description",
            value: "",
            placeholder: "Describe the project",
            helpText: "This appears in the project overview.",
            disabled: false,
            required: true,
            rows: 4,
          },
        },
        invalid: {
          props: {
            label: "Project description",
            value: "",
            error: "Add a project description.",
            disabled: false,
            required: true,
            rows: 4,
          },
        },
        disabled: {
          props: {
            label: "Project description",
            value: "This field is currently unavailable.",
            disabled: true,
            required: false,
            rows: 4,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "resizable" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral Checkbox capability.
 *
 * @remarks The trusted adapter keeps the native checkbox semantic and exposes only its boolean
 * controlled state; no DOM event, callback, or indeterminate implementation detail is admitted.
 */
export const starterCheckboxComponentRegistration = registerComponent({
  id: STARTER_CHECKBOX_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral checkbox with label, help, and error composition.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        checked: { type: "boolean", default: false },
        helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        error: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        required: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description: "Emitted with the controlled checked state after an admitted native change.",
        payloadSchema: checkedChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardFormStyleParts(),
      indicator: neutralFormStylePart(
        "Visible checked indicator without exposing native internals.",
      ),
    },
    visualStates: ["hover", "focus", "checked", "disabled", "required", "invalid"],
    authoring: {
      displayName: "Checkbox",
      category: "Inputs",
      icon: "checkbox",
      defaultProps: {
        label: "Accept terms",
        checked: false,
        helpText: "You can review these terms before continuing.",
        disabled: false,
        required: false,
      },
      scenarios: {
        unchecked: {
          props: {
            label: "Accept terms",
            checked: false,
            helpText: "You can review these terms before continuing.",
            disabled: false,
            required: true,
          },
        },
        checked: {
          props: {
            label: "Accept terms",
            checked: true,
            disabled: false,
            required: true,
          },
        },
        invalid: {
          props: {
            label: "Accept terms",
            checked: false,
            error: "You must accept the terms to continue.",
            disabled: false,
            required: true,
          },
        },
        disabled: {
          props: {
            label: "Accept terms",
            checked: true,
            disabled: true,
            required: false,
          },
        },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral RadioGroup capability.
 *
 * @remarks Options are finite inert records. `uniqueItems` rejects duplicate complete records;
 * the trusted adapter additionally rejects duplicate option values and a selected value absent
 * from the current options, because JSON Schema cannot express either cross-record relationship.
 */
export const starterRadioGroupComponentRegistration = registerComponent({
  id: STARTER_RADIO_GROUP_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral single-choice radio group with accessible option composition.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "options"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        options: {
          type: "array",
          minItems: 1,
          maxItems: STARTER_RADIO_GROUP_MAX_OPTIONS,
          uniqueItems: true,
          items: radioOptionSchema,
        },
        value: { type: "string", maxLength: OPTION_VALUE_MAX_LENGTH, default: "" },
        helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        error: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        required: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description: "Emitted with the newly selected inert option value.",
        payloadSchema: radioChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardFormStyleParts(),
      option: neutralFormStylePart("One visible radio option and its safe spacing surface."),
      optionLabel: neutralFormStylePart("Visible label text associated with one radio control."),
      indicator: neutralFormStylePart(
        "Visible selected-state indicator without private DOM access.",
      ),
    },
    visualStates: ["hover", "focus", "selected", "disabled", "required", "invalid"],
    authoring: {
      displayName: "Radio group",
      category: "Inputs",
      icon: "radio-group",
      defaultProps: {
        label: "Choose an option",
        options: [
          { value: "option-1", label: "Option 1", disabled: false },
          { value: "option-2", label: "Option 2", disabled: false },
        ],
        value: "option-1",
        helpText: "Choose the option that works best for you.",
        disabled: false,
        required: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Plan",
            options: [
              { value: "starter", label: "Starter", disabled: false },
              { value: "team", label: "Team", disabled: false },
            ],
            value: "starter",
            helpText: "You can change this later.",
            disabled: false,
            required: true,
          },
        },
        invalid: {
          props: {
            label: "Plan",
            options: [
              { value: "starter", label: "Starter", disabled: false },
              { value: "team", label: "Team", disabled: false },
            ],
            value: "",
            error: "Choose a plan to continue.",
            disabled: false,
            required: true,
          },
        },
        disabled: {
          props: {
            label: "Plan",
            options: [{ value: "starter", label: "Starter", disabled: false }],
            value: "starter",
            disabled: true,
            required: false,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral Switch capability.
 *
 * @remarks The visible track and thumb are separately styleable public parts, while the native
 * switch semantics and event handling remain private to the trusted adapter.
 */
export const starterSwitchComponentRegistration = registerComponent({
  id: STARTER_SWITCH_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral switch with label, help, and error composition.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        checked: { type: "boolean", default: false },
        helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        error: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        required: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description: "Emitted with the controlled checked state after an admitted native change.",
        payloadSchema: checkedChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardFormStyleParts(),
      track: neutralFormStylePart(
        "Visible switch track without exposing private adapter structure.",
      ),
      thumb: neutralFormStylePart(
        "Visible switch thumb without exposing private adapter structure.",
      ),
    },
    visualStates: ["hover", "focus", "checked", "disabled", "required", "invalid"],
    authoring: {
      displayName: "Switch",
      category: "Inputs",
      icon: "switch",
      defaultProps: {
        label: "Enable notifications",
        checked: false,
        helpText: "Receive updates about important account activity.",
        disabled: false,
        required: false,
      },
      scenarios: {
        unchecked: {
          props: {
            label: "Enable notifications",
            checked: false,
            helpText: "Receive updates about important account activity.",
            disabled: false,
            required: false,
          },
        },
        checked: {
          props: {
            label: "Enable notifications",
            checked: true,
            disabled: false,
            required: false,
          },
        },
        disabled: {
          props: {
            label: "Enable notifications",
            checked: true,
            disabled: true,
            required: false,
          },
        },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Resolved JSON-only props admitted by the starter TextField contract. */
export type StarterTextFieldProps = ComponentPropsOf<typeof starterTextFieldComponentRegistration>;

/** Resolved JSON-only props admitted by the starter TextArea contract. */
export type StarterTextAreaProps = ComponentPropsOf<typeof starterTextAreaComponentRegistration>;

/** Resolved JSON-only props admitted by the starter Checkbox contract. */
export type StarterCheckboxProps = ComponentPropsOf<typeof starterCheckboxComponentRegistration>;

/** Resolved JSON-only props admitted by the starter RadioGroup contract. */
export type StarterRadioGroupProps = ComponentPropsOf<
  typeof starterRadioGroupComponentRegistration
>;

/** One inert option admitted by the starter RadioGroup contract. */
export type StarterRadioGroupOption = StarterRadioGroupProps["options"][number];

/** Resolved JSON-only props admitted by the starter Switch contract. */
export type StarterSwitchProps = ComponentPropsOf<typeof starterSwitchComponentRegistration>;
