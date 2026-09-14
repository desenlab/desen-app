import { registerComponent } from "@desen/catalog-sdk";

/** Exact capability identifier for the starter searchable single-selection field. */
export const STARTER_COMBOBOX_CAPABILITY_ID = "run.desen.starter/Combobox";

/** Exact capability identifier for the starter tabbed content composition. */
export const STARTER_TABS_CAPABILITY_ID = "run.desen.starter/Tabs";

/** Exact capability identifier for the starter single-value numeric slider. */
export const STARTER_SLIDER_CAPABILITY_ID = "run.desen.starter/Slider";

/** Exact capability identifier for the starter bounded number field. */
export const STARTER_NUMBER_FIELD_CAPABILITY_ID = "run.desen.starter/NumberField";

/** Maximum number of inert options admitted by the T07 selection controls. */
export const STARTER_SELECTION_MAX_OPTIONS = 100;

/** Maximum number of tabs and ordered public panels admitted by the T07 Tabs contract. */
export const STARTER_TABS_MAX_ITEMS = 12;

/** Inclusive lower finite limit admitted by the starter numeric controls. */
export const STARTER_NUMERIC_MINIMUM = -100_000;

/** Inclusive upper finite limit admitted by the starter numeric controls. */
export const STARTER_NUMERIC_MAXIMUM = 100_000;

/** Largest finite positive step admitted by the starter numeric controls. */
export const STARTER_NUMERIC_MAX_STEP = 100_000;

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const LABEL_MAX_LENGTH = 256;
const OPTION_ID_MAX_LENGTH = 128;
const MESSAGE_MAX_LENGTH = 512;
const CONTENT_SLOT_ACCEPTS_CATEGORIES = Object.freeze([
  "layout",
  "content",
  "input",
  "action",
  "overlay",
  "feedback",
  "complex",
] as const);

const HEX_COLOR_SCHEMA = Object.freeze({
  anyOf: [
    { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
  ],
} as const);

/**
 * One public selection option. `value` remains a temporary compatibility spelling for T01
 * Sources; T07-created templates always write the unambiguous `id` spelling.
 */
const selectionOptionSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["label"],
  // `oneOf` deliberately rejects records that contain both migration spellings. The adapter uses
  // the same normalized identity rule, so schema admission and runtime admission cannot disagree.
  oneOf: [{ required: ["id"] }, { required: ["value"] }],
  properties: {
    id: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
    value: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  },
} as const);

/** Strict id-only option schema used by T07-native selection controls. */
const stableSelectionOptionSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  },
} as const);

const tabSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  },
} as const);

const selectionStylePropertiesSchema = Object.freeze({
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
    // Retained for pre-T07 Select Sources; new surfaces can use logical padding axes.
    padding: { type: "number", minimum: 0, maximum: 128 },
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

const stringChangePayloadSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: { value: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH } },
} as const);

const numericChangePayloadSchema = Object.freeze({
  $schema: JSON_SCHEMA_DIALECT,
  type: "object",
  additionalProperties: false,
  required: ["value"],
  properties: {
    value: {
      type: "number",
      minimum: STARTER_NUMERIC_MINIMUM,
      maximum: STARTER_NUMERIC_MAXIMUM,
    },
  },
} as const);

function selectionStylePart(description: string) {
  return { description, propertiesSchema: selectionStylePropertiesSchema } as const;
}

function standardSelectionStyleParts() {
  return {
    root: selectionStylePart("Stable outer control composition and safe layout surface."),
    label: selectionStylePart("Visible label associated with the semantic control."),
    control: selectionStylePart("Interactive control surface without private adapter access."),
  } as const;
}

function numericProps() {
  return {
    label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
    value: {
      type: "number",
      minimum: STARTER_NUMERIC_MINIMUM,
      maximum: STARTER_NUMERIC_MAXIMUM,
    },
    min: {
      type: "number",
      minimum: STARTER_NUMERIC_MINIMUM,
      maximum: STARTER_NUMERIC_MAXIMUM,
    },
    max: {
      type: "number",
      minimum: STARTER_NUMERIC_MINIMUM,
      maximum: STARTER_NUMERIC_MAXIMUM,
    },
    step: { type: "number", exclusiveMinimum: 0, maximum: STARTER_NUMERIC_MAX_STEP },
    helpText: { type: "string", minLength: 1, maxLength: MESSAGE_MAX_LENGTH },
    disabled: { type: "boolean", default: false },
  } as const;
}

/**
 * Immutable Catalog registration for the existing DESEN Neutral Select capability.
 *
 * @remarks T07 upgrades T01's Select to support a controlled stable selected identity. A legacy
 * `value` option spelling remains readable only so existing fixed proof Sources are not silently
 * invalidated; new authoring data uses `id`. Neither spelling permits a renderer or callback.
 */
export const starterSelectT07ComponentRegistration = registerComponent({
  id: "run.desen.starter/Select",
  manifest: {
    description: "DESEN Neutral single-value select with stable data-only option identities.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      not: { required: ["value", "defaultValue"] },
      required: ["label", "options"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        options: {
          type: "array",
          maxItems: STARTER_SELECTION_MAX_OPTIONS,
          uniqueItems: true,
          items: selectionOptionSchema,
        },
        value: { type: "string", maxLength: OPTION_ID_MAX_LENGTH, default: "" },
        defaultValue: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description: "Emitted with one normalized stable option identity.",
        payloadSchema: stringChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardSelectionStyleParts(),
      trigger: selectionStylePart("Interactive select trigger."),
      popup: selectionStylePart("Contained options popup."),
      item: selectionStylePart("One selectable data option."),
    },
    visualStates: ["hover", "focus", "open", "selected", "highlighted", "disabled", "empty"],
    authoring: {
      displayName: "Select",
      category: "Inputs",
      icon: "select",
      defaultProps: {
        label: "Select",
        options: [{ id: "option-1", label: "Option 1", disabled: false }],
        defaultValue: "option-1",
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Select an option",
            options: [
              { id: "first", label: "First", disabled: false },
              { id: "second", label: "Second", disabled: false },
            ],
            value: "first",
            disabled: false,
          },
        },
        empty: { props: { label: "Select an option", options: [], value: "", disabled: false } },
        disabled: {
          props: {
            label: "Select an option",
            options: [{ id: "first", label: "First", disabled: false }],
            value: "first",
            disabled: true,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the DESEN Neutral Combobox capability.
 *
 * @remarks Filtering is an adapter-owned finite string operation selected only by the two-item
 * `filterMode` enum. The Catalog deliberately has no filter expression or item-renderer prop.
 */
export const starterComboboxComponentRegistration = registerComponent({
  id: STARTER_COMBOBOX_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral searchable single-value combobox with bounded local filtering.",
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
          maxItems: STARTER_SELECTION_MAX_OPTIONS,
          uniqueItems: true,
          items: stableSelectionOptionSchema,
        },
        value: { type: "string", maxLength: OPTION_ID_MAX_LENGTH, default: "" },
        placeholder: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        filterMode: { type: "string", enum: ["contains", "startsWith"], default: "contains" },
        disabled: { type: "boolean", default: false },
      },
    },
    events: {
      change: {
        description: "Emitted with one selected stable option identity.",
        payloadSchema: stringChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardSelectionStyleParts(),
      input: selectionStylePart("Native searchable combobox input."),
      trigger: selectionStylePart("Popup trigger adjacent to the searchable input."),
      popup: selectionStylePart("Contained result popup."),
      item: selectionStylePart("One filtered result item."),
      empty: selectionStylePart("Visible no-results message."),
    },
    visualStates: ["hover", "focus", "open", "selected", "highlighted", "disabled", "empty"],
    authoring: {
      displayName: "Combobox",
      category: "Inputs",
      icon: "combobox",
      defaultProps: {
        label: "Find an option",
        options: [
          { id: "option-1", label: "Option 1", disabled: false },
          { id: "option-2", label: "Option 2", disabled: false },
        ],
        value: "",
        placeholder: "Search options",
        filterMode: "contains",
        disabled: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Find a region",
            options: [
              { id: "north", label: "Northern region", disabled: false },
              { id: "south", label: "Southern region", disabled: false },
            ],
            value: "",
            placeholder: "Search regions",
            filterMode: "contains",
            disabled: false,
          },
        },
        empty: {
          props: {
            label: "Find a region",
            options: [],
            value: "",
            placeholder: "Search regions",
            filterMode: "contains",
            disabled: false,
          },
        },
        disabled: {
          props: {
            label: "Find a region",
            options: [{ id: "north", label: "Northern region", disabled: false }],
            value: "north",
            placeholder: "Search regions",
            filterMode: "startsWith",
            disabled: true,
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for tabbed composition with one ordered public panel slot.
 *
 * @remarks The nth public `panels` child is paired to the nth inert tab identity. The adapter
 * rejects an unequal count rather than guessing a DOM target or accepting an item renderer.
 */
export const starterTabsComponentRegistration = registerComponent({
  id: STARTER_TABS_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral tabs with stable identities and one ordered public panel slot.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "tabs", "value"],
      properties: {
        label: { type: "string", minLength: 1, maxLength: LABEL_MAX_LENGTH },
        tabs: {
          type: "array",
          minItems: 1,
          maxItems: STARTER_TABS_MAX_ITEMS,
          uniqueItems: true,
          items: tabSchema,
        },
        value: { type: "string", minLength: 1, maxLength: OPTION_ID_MAX_LENGTH },
        disabled: { type: "boolean", default: false },
        orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" },
      },
    },
    slots: {
      panels: {
        required: true,
        minItems: 1,
        maxItems: STARTER_TABS_MAX_ITEMS,
        acceptsCategories: CONTENT_SLOT_ACCEPTS_CATEGORIES,
        description:
          "Ordered public panels paired by index with the declared inert tab identities.",
      },
    },
    events: {
      change: {
        description: "Emitted with the newly selected stable tab identity.",
        payloadSchema: stringChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardSelectionStyleParts(),
      list: selectionStylePart("Semantic tablist surface."),
      tab: selectionStylePart("One selectable tab."),
      indicator: selectionStylePart("Visible active-tab indicator."),
      panel: selectionStylePart("One public panel wrapper."),
    },
    visualStates: ["hover", "focus", "selected", "disabled"],
    authoring: {
      displayName: "Tabs",
      category: "Inputs",
      icon: "tabs",
      defaultProps: {
        label: "Sections",
        tabs: [
          { id: "first", label: "First", disabled: false },
          { id: "second", label: "Second", disabled: false },
        ],
        value: "first",
        disabled: false,
        orientation: "horizontal",
      },
      scenarios: {
        default: {
          props: {
            label: "Sections",
            tabs: [
              { id: "overview", label: "Overview", disabled: false },
              { id: "details", label: "Details", disabled: false },
            ],
            value: "overview",
            disabled: false,
            orientation: "horizontal",
          },
        },
        disabled: {
          props: {
            label: "Sections",
            tabs: [
              { id: "overview", label: "Overview", disabled: false },
              { id: "details", label: "Details", disabled: true },
            ],
            value: "overview",
            disabled: false,
            orientation: "horizontal",
          },
        },
      },
      resize: { horizontal: "resizable", vertical: "resizable" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for the bounded DESEN Neutral single-value slider. */
export const starterSliderComponentRegistration = registerComponent({
  id: STARTER_SLIDER_CAPABILITY_ID,
  manifest: {
    description: "DESEN Neutral single-value slider with finite min, max, step, and value bounds.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "value", "min", "max", "step"],
      properties: numericProps(),
    },
    events: {
      change: {
        description: "Emitted with one finite in-range, step-aligned numeric value.",
        payloadSchema: numericChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardSelectionStyleParts(),
      track: selectionStylePart("Visible slider track."),
      indicator: selectionStylePart("Visible completed slider range."),
      thumb: selectionStylePart("Interactive slider thumb."),
      value: selectionStylePart("Visible finite numeric value."),
      help: selectionStylePart("Optional bounded supporting text."),
    },
    visualStates: ["hover", "focus", "selected", "disabled"],
    authoring: {
      displayName: "Slider",
      category: "Inputs",
      icon: "slider",
      defaultProps: {
        label: "Opacity",
        value: 50,
        min: 0,
        max: 100,
        step: 1,
        helpText: "Choose a value between 0 and 100.",
        disabled: false,
      },
      scenarios: {
        default: {
          props: { label: "Opacity", value: 50, min: 0, max: 100, step: 1, disabled: false },
        },
        disabled: {
          props: { label: "Opacity", value: 50, min: 0, max: 100, step: 1, disabled: true },
        },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for the bounded DESEN Neutral number field. */
export const starterNumberFieldComponentRegistration = registerComponent({
  id: STARTER_NUMBER_FIELD_CAPABILITY_ID,
  manifest: {
    description:
      "DESEN Neutral number field with finite min, max, step, and controlled value bounds.",
    category: "input",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["label", "value", "min", "max", "step"],
      properties: numericProps(),
    },
    events: {
      change: {
        description: "Emitted with one finite in-range, step-aligned numeric value.",
        payloadSchema: numericChangePayloadSchema,
      },
    },
    styleParts: {
      ...standardSelectionStyleParts(),
      input: selectionStylePart("Native numeric input surface."),
      increment: selectionStylePart("Trusted increment control."),
      decrement: selectionStylePart("Trusted decrement control."),
      value: selectionStylePart("Visible finite numeric value."),
      help: selectionStylePart("Optional bounded supporting text."),
    },
    visualStates: ["hover", "focus", "disabled"],
    authoring: {
      displayName: "Number field",
      category: "Inputs",
      icon: "number-field",
      defaultProps: {
        label: "Columns",
        value: 2,
        min: 1,
        max: 12,
        step: 1,
        helpText: "Choose a whole number from 1 to 12.",
        disabled: false,
      },
      scenarios: {
        default: {
          props: { label: "Columns", value: 2, min: 1, max: 12, step: 1, disabled: false },
        },
        disabled: {
          props: { label: "Columns", value: 2, min: 1, max: 12, step: 1, disabled: true },
        },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** One inert id-only option admitted by T07-native selection controls. */
export interface StarterComboboxOption {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Public JSON-only props admitted by the Combobox contract. */
export interface StarterComboboxProps {
  readonly label: string;
  readonly options: readonly StarterComboboxOption[];
  readonly value?: string;
  readonly placeholder?: string;
  readonly filterMode?: "contains" | "startsWith";
  readonly disabled?: boolean;
}

/** One inert stable tab descriptor admitted by the Tabs contract. */
export interface StarterTab {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Public JSON-only props admitted by the Tabs contract. */
export interface StarterTabsProps {
  readonly label: string;
  readonly tabs: readonly StarterTab[];
  readonly value: string;
  readonly disabled?: boolean;
  readonly orientation?: "horizontal" | "vertical";
}

/** Public JSON-only props shared by the bounded numeric controls. */
interface StarterNumericProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly helpText?: string;
  readonly disabled?: boolean;
}

/** Public JSON-only props admitted by the Slider contract. */
export type StarterSliderProps = StarterNumericProps;

/** Public JSON-only props admitted by the NumberField contract. */
export type StarterNumberFieldProps = StarterNumericProps;

/** Backward-compatible public type name for the upgraded Select contract. */
export type StarterT07SelectProps = Readonly<{
  label: string;
  options: readonly (
    | Readonly<{ id: string; label: string; disabled?: boolean; value?: never }>
    | Readonly<{ value: string; label: string; disabled?: boolean; id?: never }>
  )[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
}>;

/** One inert option admitted by the upgraded starter Select contract. */
export type StarterT07SelectOption = StarterT07SelectProps["options"][number];
