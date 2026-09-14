import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import {
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_BOX_CAPABILITY_ID,
  STARTER_CHECKBOX_CAPABILITY_ID,
  STARTER_COMBOBOX_CAPABILITY_ID,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_TEMPLATE,
  STARTER_CATALOG_VERSION,
  STARTER_COMPONENT_REGISTRATIONS,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_DIALOG_CONTENT_MAX_ITEMS,
  STARTER_GRID_CAPABILITY_ID,
  STARTER_HEADING_CAPABILITY_ID,
  STARTER_ICON_CAPABILITY_ID,
  STARTER_IMAGE_CAPABILITY_ID,
  STARTER_LAYOUT_CONTENT_MAX_ITEMS,
  STARTER_NUMBER_FIELD_CAPABILITY_ID,
  STARTER_NUMERIC_MAX_STEP,
  STARTER_NUMERIC_MAXIMUM,
  STARTER_NUMERIC_MINIMUM,
  STARTER_RADIO_GROUP_CAPABILITY_ID,
  STARTER_RADIO_GROUP_MAX_OPTIONS,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_SELECTION_MAX_OPTIONS,
  STARTER_SEPARATOR_CAPABILITY_ID,
  STARTER_SLIDER_CAPABILITY_ID,
  STARTER_STACK_CAPABILITY_ID,
  STARTER_SWITCH_CAPABILITY_ID,
  STARTER_TABS_CAPABILITY_ID,
  STARTER_TABS_MAX_ITEMS,
  STARTER_TEXT_AREA_CAPABILITY_ID,
  STARTER_TEXT_CAPABILITY_ID,
  STARTER_TEXT_FIELD_CAPABILITY_ID,
  STARTER_SELECT_MAX_OPTIONS,
  starterButtonComponentRegistration,
  starterBoxComponentRegistration,
  starterCheckboxComponentRegistration,
  starterComboboxComponentRegistration,
  starterDialogComponentRegistration,
  starterGridComponentRegistration,
  starterHeadingComponentRegistration,
  starterIconComponentRegistration,
  starterImageComponentRegistration,
  starterNumberFieldComponentRegistration,
  starterRadioGroupComponentRegistration,
  starterSelectComponentRegistration,
  starterSeparatorComponentRegistration,
  starterSliderComponentRegistration,
  starterStackComponentRegistration,
  starterSwitchComponentRegistration,
  starterTabsComponentRegistration,
  starterTextAreaComponentRegistration,
  starterTextComponentRegistration,
  starterTextFieldComponentRegistration,
} from "../src/contracts.js";
import {
  STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH,
  STARTER_TEMPLATE_MAX_RESERVED_IDS,
  createStarterNodeTemplate,
} from "../src/templates.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectDeeplyFrozen(nested);
}

describe("starter component contracts", () => {
  it("registers the exact ordered capability inventory without fabricating a package digest", () => {
    expect(STARTER_COMPONENT_REGISTRATIONS.map(({ id }) => id)).toEqual([
      STARTER_BUTTON_CAPABILITY_ID,
      STARTER_SELECT_CAPABILITY_ID,
      STARTER_DIALOG_CAPABILITY_ID,
      STARTER_BOX_CAPABILITY_ID,
      STARTER_STACK_CAPABILITY_ID,
      STARTER_GRID_CAPABILITY_ID,
      STARTER_TEXT_CAPABILITY_ID,
      STARTER_HEADING_CAPABILITY_ID,
      STARTER_IMAGE_CAPABILITY_ID,
      STARTER_ICON_CAPABILITY_ID,
      STARTER_SEPARATOR_CAPABILITY_ID,
      STARTER_TEXT_FIELD_CAPABILITY_ID,
      STARTER_TEXT_AREA_CAPABILITY_ID,
      STARTER_CHECKBOX_CAPABILITY_ID,
      STARTER_RADIO_GROUP_CAPABILITY_ID,
      STARTER_SWITCH_CAPABILITY_ID,
      STARTER_COMBOBOX_CAPABILITY_ID,
      STARTER_TABS_CAPABILITY_ID,
      STARTER_SLIDER_CAPABILITY_ID,
      STARTER_NUMBER_FIELD_CAPABILITY_ID,
    ]);
    expect(STARTER_CATALOG_TEMPLATE).toMatchObject({
      id: STARTER_CATALOG_ID,
      version: STARTER_CATALOG_VERSION,
      target: STARTER_CATALOG_TARGET,
      components: STARTER_COMPONENT_REGISTRATIONS,
    });
    expect(Object.hasOwn(STARTER_CATALOG_TEMPLATE, "packageDigest")).toBe(false);
    expect(Object.hasOwn(STARTER_CATALOG_TEMPLATE, "kind")).toBe(false);
    expectDeeplyFrozen(STARTER_CATALOG_TEMPLATE);
  });

  it("keeps Button props and press payload closed and inert", () => {
    expect(starterButtonComponentRegistration.manifest.propsSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        disabled: { type: "boolean" },
        loading: { type: "boolean" },
      },
    });
    expect(starterButtonComponentRegistration.manifest.events.press.payloadSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(
      Object.hasOwn(
        starterButtonComponentRegistration.manifest.events.press.payloadSchema,
        "properties",
      ),
    ).toBe(false);
    expect(Object.keys(starterButtonComponentRegistration.manifest.propsSchema.properties)).toEqual(
      ["disabled", "label", "loading"],
    );
  });

  it("upgrades Select in place with stable data-only identities and a legacy migration spelling", () => {
    const optionsSchema =
      starterSelectComponentRegistration.manifest.propsSchema.properties.options;
    expect(optionsSchema).toMatchObject({
      type: "array",
      maxItems: STARTER_SELECTION_MAX_OPTIONS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        oneOf: [{ required: ["id"] }, { required: ["value"] }],
      },
    });
    expect(STARTER_SELECT_MAX_OPTIONS).toBe(STARTER_SELECTION_MAX_OPTIONS);
    expect(starterSelectComponentRegistration.manifest.propsSchema.required).toEqual([
      "label",
      "options",
    ]);
    expect(starterSelectComponentRegistration.manifest.propsSchema.not).toEqual({
      required: ["value", "defaultValue"],
    });
    expect(
      starterSelectComponentRegistration.manifest.propsSchema.properties.defaultValue,
    ).toMatchObject({ type: "string", minLength: 1, maxLength: 128 });
    expect(
      starterSelectComponentRegistration.manifest.styleParts.root.propertiesSchema.properties
        .padding,
    ).toMatchObject({ type: "number", minimum: 0, maximum: 128 });
    expect(starterSelectComponentRegistration.manifest.events.change.payloadSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: { type: "string" } },
    });
    expect(
      Object.keys(starterSelectComponentRegistration.manifest.propsSchema.properties).sort(),
    ).toEqual(["defaultValue", "disabled", "label", "options", "value"]);
    expect(starterSelectComponentRegistration.manifest.authoring.defaultProps).toMatchObject({
      options: [{ id: "option-1", label: "Option 1", disabled: false }],
      defaultValue: "option-1",
    });
  });

  it("requires bounded Dialog content from only the exact starter inventory", () => {
    expect(starterDialogComponentRegistration.manifest.slots.content).toEqual({
      required: true,
      minItems: 1,
      maxItems: STARTER_DIALOG_CONTENT_MAX_ITEMS,
      accepts: [
        STARTER_BUTTON_CAPABILITY_ID,
        STARTER_SELECT_CAPABILITY_ID,
        STARTER_DIALOG_CAPABILITY_ID,
      ],
      description: "Managed dialog body content.",
    });
    expect(
      starterDialogComponentRegistration.manifest.events.openChange.payloadSchema,
    ).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["open"],
      properties: { open: { type: "boolean" } },
    });
  });

  it("preserves the original finite neutral property schema on the Button and Dialog controls", () => {
    const hexColor = {
      anyOf: [
        { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
      ],
    };
    const registrations = [starterButtonComponentRegistration, starterDialogComponentRegistration];
    for (const registration of registrations) {
      for (const stylePart of Object.values(registration.manifest.styleParts)) {
        expect(stylePart.propertiesSchema).toMatchObject({
          type: "object",
          additionalProperties: false,
          properties: {
            color: hexColor,
            backgroundColor: hexColor,
            borderColor: hexColor,
            borderRadius: { type: "number", minimum: 0, maximum: 64 },
            padding: { type: "number", minimum: 0, maximum: 128 },
            fontSize: { type: "number", minimum: 8, maximum: 96 },
          },
        });
      }
      expectDeeplyFrozen(registration);
    }
  });

  it("admits finite logical layout, typography, and closed content contracts", () => {
    const layouts = [
      starterBoxComponentRegistration,
      starterStackComponentRegistration,
      starterGridComponentRegistration,
    ];
    for (const registration of layouts) {
      expect(registration.manifest.category).toBe("layout");
      expect(registration.manifest.slots.default).toMatchObject({
        required: true,
        minItems: 1,
        maxItems: STARTER_LAYOUT_CONTENT_MAX_ITEMS,
        acceptsCategories: [
          "layout",
          "content",
          "input",
          "action",
          "overlay",
          "feedback",
          "complex",
        ],
      });
      expect(registration.manifest.styleParts.root.propertiesSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        properties: {
          paddingBlock: { type: "number", minimum: 0, maximum: 512 },
          paddingInline: { type: "number", minimum: 0, maximum: 512 },
          width: { anyOf: [{ type: "number" }, { type: "string", enum: ["fill", "hug"] }] },
          overflow: { type: "string", enum: ["visible", "hidden", "auto"] },
          justifyContent: {
            type: "string",
            enum: ["start", "center", "end", "between", "around", "evenly"],
          },
        },
      });
      expectDeeplyFrozen(registration);
    }
    expect(starterStackComponentRegistration.manifest.propsSchema.properties.direction).toEqual({
      type: "string",
      enum: ["vertical", "horizontal"],
      default: "vertical",
    });
    expect(starterGridComponentRegistration.manifest.propsSchema.properties.columns).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 12,
      default: 2,
    });
    expect(starterTextComponentRegistration.manifest.propsSchema.required).toEqual(["text"]);
    expect(starterHeadingComponentRegistration.manifest.propsSchema.properties.level).toEqual({
      type: "integer",
      minimum: 1,
      maximum: 6,
      default: 2,
    });
    expect(starterImageComponentRegistration.manifest.propsSchema.properties.source).toEqual({
      type: "string",
      enum: ["neutral-horizon", "neutral-grid"],
    });
    expect(
      Object.hasOwn(
        starterImageComponentRegistration.manifest.styleParts.root.propertiesSchema.properties,
        "color",
      ),
    ).toBe(false);
    expect(
      Object.hasOwn(
        starterIconComponentRegistration.manifest.styleParts.root.propertiesSchema.properties,
        "color",
      ),
    ).toBe(true);
    expect(starterIconComponentRegistration.manifest.propsSchema.properties.name).toEqual({
      type: "string",
      enum: ["arrow-right", "check", "close", "info", "menu", "plus", "search"],
    });
    expect(
      starterSeparatorComponentRegistration.manifest.propsSchema.properties.orientation,
    ).toEqual({
      type: "string",
      enum: ["horizontal", "vertical"],
      default: "horizontal",
    });
  });

  it("keeps the T06 form controls finite, labelled, styleable, and event-closed", () => {
    const textControls = [
      starterTextFieldComponentRegistration,
      starterTextAreaComponentRegistration,
    ];
    for (const registration of textControls) {
      expect(registration.manifest.category).toBe("input");
      expect(registration.manifest.propsSchema.required).toEqual(["label"]);
      expect(registration.manifest.events.change.payloadSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["value"],
        properties: { value: { type: "string" } },
      });
      expect(Object.keys(registration.manifest.styleParts)).toEqual([
        "control",
        "error",
        "help",
        "label",
        "root",
      ]);
      expectDeeplyFrozen(registration);
    }
    expect(starterTextAreaComponentRegistration.manifest.propsSchema.properties.rows).toEqual({
      type: "integer",
      minimum: 2,
      maximum: 12,
      default: 4,
    });
    for (const registration of [
      starterCheckboxComponentRegistration,
      starterSwitchComponentRegistration,
    ]) {
      expect(registration.manifest.propsSchema.required).toEqual(["label"]);
      expect(registration.manifest.events.change.payloadSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["checked"],
        properties: { checked: { type: "boolean" } },
      });
      expectDeeplyFrozen(registration);
    }
    const options = starterRadioGroupComponentRegistration.manifest.propsSchema.properties.options;
    expect(starterRadioGroupComponentRegistration.manifest.propsSchema.required).toEqual([
      "label",
      "options",
    ]);
    expect(options).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: STARTER_RADIO_GROUP_MAX_OPTIONS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["value", "label"],
      },
    });
    expect(
      starterRadioGroupComponentRegistration.manifest.events.change.payloadSchema,
    ).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: { type: "string", maxLength: 128 } },
    });
    expectDeeplyFrozen(starterRadioGroupComponentRegistration);
  });

  it("keeps the T07 selection, tab, and numeric controls closed, bounded, and data-only", () => {
    const selectOptions =
      starterSelectComponentRegistration.manifest.propsSchema.properties.options;
    expect(selectOptions).toMatchObject({
      type: "array",
      maxItems: STARTER_SELECTION_MAX_OPTIONS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        oneOf: [{ required: ["id"] }, { required: ["value"] }],
      },
    });
    const comboboxOptions =
      starterComboboxComponentRegistration.manifest.propsSchema.properties.options;
    expect(comboboxOptions).toMatchObject({
      type: "array",
      maxItems: STARTER_SELECTION_MAX_OPTIONS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
      },
    });
    expect(Object.keys(comboboxOptions.items.properties)).not.toContain("value");
    for (const registration of [
      starterSelectComponentRegistration,
      starterComboboxComponentRegistration,
    ]) {
      expect(registration.manifest.events.change.payloadSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["value"],
        properties: { value: { type: "string", minLength: 1, maxLength: 128 } },
      });
      expectDeeplyFrozen(registration);
    }
    expect(starterComboboxComponentRegistration.manifest.propsSchema.properties.filterMode).toEqual(
      { type: "string", enum: ["contains", "startsWith"], default: "contains" },
    );
    expect(
      Object.keys(starterComboboxComponentRegistration.manifest.propsSchema.properties).sort(),
    ).not.toContain("filter");
    expect(
      Object.keys(starterComboboxComponentRegistration.manifest.propsSchema.properties).sort(),
    ).not.toContain("renderItem");

    expect(starterTabsComponentRegistration.manifest.propsSchema.properties.tabs).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: STARTER_TABS_MAX_ITEMS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
      },
    });
    expect(starterTabsComponentRegistration.manifest.slots.panels).toMatchObject({
      required: true,
      minItems: 1,
      maxItems: STARTER_TABS_MAX_ITEMS,
      acceptsCategories: ["layout", "content", "input", "action", "overlay", "feedback", "complex"],
    });
    expect(starterTabsComponentRegistration.manifest.events.change.payloadSchema).toMatchObject({
      required: ["value"],
      properties: { value: { type: "string", minLength: 1, maxLength: 128 } },
    });
    expectDeeplyFrozen(starterTabsComponentRegistration);

    for (const registration of [
      starterSliderComponentRegistration,
      starterNumberFieldComponentRegistration,
    ]) {
      expect(registration.manifest.propsSchema.required).toEqual([
        "label",
        "value",
        "min",
        "max",
        "step",
      ]);
      expect(registration.manifest.propsSchema.properties).toMatchObject({
        value: {
          type: "number",
          minimum: STARTER_NUMERIC_MINIMUM,
          maximum: STARTER_NUMERIC_MAXIMUM,
        },
        min: { type: "number", minimum: STARTER_NUMERIC_MINIMUM, maximum: STARTER_NUMERIC_MAXIMUM },
        max: { type: "number", minimum: STARTER_NUMERIC_MINIMUM, maximum: STARTER_NUMERIC_MAXIMUM },
        step: { type: "number", exclusiveMinimum: 0, maximum: STARTER_NUMERIC_MAX_STEP },
      });
      expect(registration.manifest.events.change.payloadSchema).toMatchObject({
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
      });
      expectDeeplyFrozen(registration);
    }
  });
});

describe("starter node templates", () => {
  it("creates deterministic frozen Button and Select leaves", () => {
    const button = createStarterNodeTemplate({
      capabilityId: STARTER_BUTTON_CAPABILITY_ID,
      idPrefix: "surface.button",
    });
    const select = createStarterNodeTemplate({
      capabilityId: STARTER_SELECT_CAPABILITY_ID,
      idPrefix: "surface.select",
    });

    expect(button).toEqual({
      id: "surface.button",
      use: STARTER_BUTTON_CAPABILITY_ID,
      props: { disabled: false, label: "Button", loading: false },
    });
    expect(select).toEqual({
      id: "surface.select",
      use: STARTER_SELECT_CAPABILITY_ID,
      props: {
        defaultValue: "option-1",
        disabled: false,
        label: "Select",
        options: [{ disabled: false, id: "option-1", label: "Option 1" }],
      },
    });
    expectDeeplyFrozen(button);
    expectDeeplyFrozen(select);
    expect(
      canonicalizeJson(
        createStarterNodeTemplate({
          capabilityId: STARTER_BUTTON_CAPABILITY_ID,
          idPrefix: "surface.button",
        }),
      ),
    ).toBe(canonicalizeJson(button));
  });

  it("creates deterministic frozen leaves for every T06 form control", () => {
    const field = createStarterNodeTemplate({
      capabilityId: STARTER_TEXT_FIELD_CAPABILITY_ID,
      idPrefix: "surface.field",
    });
    const textarea = createStarterNodeTemplate({
      capabilityId: STARTER_TEXT_AREA_CAPABILITY_ID,
      idPrefix: "surface.textarea",
    });
    const checkbox = createStarterNodeTemplate({
      capabilityId: STARTER_CHECKBOX_CAPABILITY_ID,
      idPrefix: "surface.checkbox",
    });
    const radio = createStarterNodeTemplate({
      capabilityId: STARTER_RADIO_GROUP_CAPABILITY_ID,
      idPrefix: "surface.radio",
    });
    const toggle = createStarterNodeTemplate({
      capabilityId: STARTER_SWITCH_CAPABILITY_ID,
      idPrefix: "surface.switch",
    });
    expect(field).toMatchObject({ use: STARTER_TEXT_FIELD_CAPABILITY_ID, id: "surface.field" });
    expect(textarea).toMatchObject({
      use: STARTER_TEXT_AREA_CAPABILITY_ID,
      id: "surface.textarea",
    });
    expect(checkbox).toMatchObject({ use: STARTER_CHECKBOX_CAPABILITY_ID, id: "surface.checkbox" });
    expect(radio).toMatchObject({ use: STARTER_RADIO_GROUP_CAPABILITY_ID, id: "surface.radio" });
    if (radio.props === undefined || !Array.isArray(radio.props.options))
      throw new Error("Expected RadioGroup template options");
    expect(radio.props.options).toHaveLength(2);
    expect(radio.props.options[0]).toEqual({
      disabled: false,
      label: "Option 1",
      value: "option-1",
    });
    expect(toggle).toMatchObject({ use: STARTER_SWITCH_CAPABILITY_ID, id: "surface.switch" });
    for (const node of [field, textarea, checkbox, radio, toggle]) expectDeeplyFrozen(node);
  });

  it("creates deterministic complete T07 selection, tabs, and numeric templates", () => {
    const combobox = createStarterNodeTemplate({
      capabilityId: STARTER_COMBOBOX_CAPABILITY_ID,
      idPrefix: "surface.combobox",
    });
    const tabs = createStarterNodeTemplate({
      capabilityId: STARTER_TABS_CAPABILITY_ID,
      idPrefix: "surface.tabs",
    });
    const slider = createStarterNodeTemplate({
      capabilityId: STARTER_SLIDER_CAPABILITY_ID,
      idPrefix: "surface.slider",
    });
    const numberField = createStarterNodeTemplate({
      capabilityId: STARTER_NUMBER_FIELD_CAPABILITY_ID,
      idPrefix: "surface.number-field",
    });

    expect(combobox).toMatchObject({
      id: "surface.combobox",
      use: STARTER_COMBOBOX_CAPABILITY_ID,
      props: {
        options: [
          { id: "option-1", label: "Option 1", disabled: false },
          { id: "option-2", label: "Option 2", disabled: false },
        ],
        filterMode: "contains",
      },
    });
    expect(tabs).toMatchObject({
      id: "surface.tabs",
      use: STARTER_TABS_CAPABILITY_ID,
      props: {
        tabs: [
          { id: "first", label: "First", disabled: false },
          { id: "second", label: "Second", disabled: false },
        ],
        value: "first",
      },
      slots: {
        panels: [
          { id: "surface.tabs.first", use: STARTER_TEXT_CAPABILITY_ID },
          { id: "surface.tabs.second", use: STARTER_TEXT_CAPABILITY_ID },
        ],
      },
    });
    expect(slider).toMatchObject({
      id: "surface.slider",
      use: STARTER_SLIDER_CAPABILITY_ID,
      props: { min: 0, max: 100, step: 1, value: 50 },
    });
    expect(numberField).toMatchObject({
      id: "surface.number-field",
      use: STARTER_NUMBER_FIELD_CAPABILITY_ID,
      props: { min: 1, max: 12, step: 1, value: 2 },
    });
    for (const node of [combobox, tabs, slider, numberField]) expectDeeplyFrozen(node);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_TABS_CAPABILITY_ID,
        idPrefix: "surface.tabs",
        reservedIds: ["surface.tabs.second"],
      }),
    ).toThrow(/identity collision/u);
  });

  it("creates a complete Dialog subtree with one required managed child", () => {
    const dialog = createStarterNodeTemplate({
      capabilityId: STARTER_DIALOG_CAPABILITY_ID,
      idPrefix: "surface.dialog",
      reservedIds: ["surface.existing"],
    });

    expect(dialog).toMatchObject({
      id: "surface.dialog",
      use: STARTER_DIALOG_CAPABILITY_ID,
      slots: {
        content: [
          {
            id: "surface.dialog.content",
            use: STARTER_BUTTON_CAPABILITY_ID,
            props: { label: "Continue" },
          },
        ],
      },
    });
    expectDeeplyFrozen(dialog);
    expect(JSON.stringify(dialog)).not.toContain("instanceOf");
  });

  it("creates complete nested layout templates and inert content leaves", () => {
    const box = createStarterNodeTemplate({
      capabilityId: STARTER_BOX_CAPABILITY_ID,
      idPrefix: "surface.box",
    });
    const grid = createStarterNodeTemplate({
      capabilityId: STARTER_GRID_CAPABILITY_ID,
      idPrefix: "surface.grid",
    });
    const image = createStarterNodeTemplate({
      capabilityId: STARTER_IMAGE_CAPABILITY_ID,
      idPrefix: "surface.image",
    });
    expect(box).toMatchObject({
      id: "surface.box",
      use: STARTER_BOX_CAPABILITY_ID,
      slots: { default: [{ id: "surface.box.content", use: STARTER_TEXT_CAPABILITY_ID }] },
    });
    expect(grid).toMatchObject({
      id: "surface.grid",
      use: STARTER_GRID_CAPABILITY_ID,
      slots: {
        default: [
          { id: "surface.grid.first", use: STARTER_TEXT_CAPABILITY_ID },
          { id: "surface.grid.second", use: STARTER_TEXT_CAPABILITY_ID },
        ],
      },
    });
    expect(image).toEqual({
      id: "surface.image",
      use: STARTER_IMAGE_CAPABILITY_ID,
      props: { alt: "Neutral landscape", fit: "cover", source: "neutral-horizon" },
    });
    expectDeeplyFrozen(box);
    expectDeeplyFrozen(grid);
    expectDeeplyFrozen(image);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_GRID_CAPABILITY_ID,
        idPrefix: "surface.grid",
        reservedIds: ["surface.grid.second"],
      }),
    ).toThrow(/identity collision/u);
  });

  it("rejects unknown capabilities, invalid prefixes, excess inventory, and all collisions", () => {
    const unsafeCreate = createStarterNodeTemplate as (input: unknown) => unknown;
    expect(() =>
      unsafeCreate({ capabilityId: "run.desen.starter/Unknown", idPrefix: "unknown" }),
    ).toThrow(/unknown starter capability/u);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_BUTTON_CAPABILITY_ID,
        idPrefix: "1-invalid",
      }),
    ).toThrow(/local identifier/u);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_DIALOG_CAPABILITY_ID,
        idPrefix: `a${"b".repeat(STARTER_TEMPLATE_ID_PREFIX_MAX_LENGTH)}`,
      }),
    ).toThrow(/at most 120/u);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_BUTTON_CAPABILITY_ID,
        idPrefix: "duplicate",
        reservedIds: ["duplicate"],
      }),
    ).toThrow(/identity collision/u);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_DIALOG_CAPABILITY_ID,
        idPrefix: "dialog",
        reservedIds: ["dialog.content"],
      }),
    ).toThrow(/identity collision/u);
    expect(() =>
      createStarterNodeTemplate({
        capabilityId: STARTER_SELECT_CAPABILITY_ID,
        idPrefix: "select",
        reservedIds: Array.from(
          { length: STARTER_TEMPLATE_MAX_RESERVED_IDS + 1 },
          (_, index) => `reserved-${index}`,
        ),
      }),
    ).toThrow(/at most 25000/u);
  });

  it("rejects extra or executable wrapper data before constructing a node", () => {
    const unsafeCreate = createStarterNodeTemplate as (input: unknown) => unknown;
    expect(() =>
      unsafeCreate({
        capabilityId: STARTER_BUTTON_CAPABILITY_ID,
        idPrefix: "button",
        callback: () => undefined,
      }),
    ).toThrow(/expected only/u);
    expect(() =>
      unsafeCreate({
        capabilityId: STARTER_BUTTON_CAPABILITY_ID,
        idPrefix: "button",
        extra: true,
      }),
    ).toThrow(/expected only/u);

    let getterCalls = 0;
    const accessorInput = Object.defineProperty(
      { capabilityId: STARTER_BUTTON_CAPABILITY_ID, idPrefix: "button" },
      "reservedIds",
      {
        enumerable: true,
        get() {
          getterCalls += 1;
          return [];
        },
      },
    );
    expect(() => unsafeCreate(accessorInput)).toThrow(/finite dense array/u);
    expect(getterCalls).toBe(0);

    const inheritedInput = Object.create({ inherited: true }) as Record<string, unknown>;
    inheritedInput.capabilityId = STARTER_BUTTON_CAPABILITY_ID;
    inheritedInput.idPrefix = "button";
    expect(() => unsafeCreate(inheritedInput)).toThrow(/plain or null-prototype/u);
  });
});
