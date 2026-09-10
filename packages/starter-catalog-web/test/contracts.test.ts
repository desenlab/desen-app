import { canonicalizeJson } from "@desen/protocol";
import { describe, expect, it } from "vitest";

import {
  STARTER_BUTTON_CAPABILITY_ID,
  STARTER_CATALOG_ID,
  STARTER_CATALOG_TARGET,
  STARTER_CATALOG_TEMPLATE,
  STARTER_CATALOG_VERSION,
  STARTER_COMPONENT_REGISTRATIONS,
  STARTER_DIALOG_CAPABILITY_ID,
  STARTER_DIALOG_CONTENT_MAX_ITEMS,
  STARTER_SELECT_CAPABILITY_ID,
  STARTER_SELECT_MAX_OPTIONS,
  starterButtonComponentRegistration,
  starterDialogComponentRegistration,
  starterSelectComponentRegistration,
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

  it("bounds Select options and exposes only the declared JSON change payload", () => {
    const optionsSchema =
      starterSelectComponentRegistration.manifest.propsSchema.properties.options;
    expect(optionsSchema).toMatchObject({
      type: "array",
      maxItems: STARTER_SELECT_MAX_OPTIONS,
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["value", "label"],
      },
    });
    expect(starterSelectComponentRegistration.manifest.propsSchema.required).toEqual([
      "label",
      "options",
    ]);
    expect(starterSelectComponentRegistration.manifest.events.change.payloadSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: { value: { type: "string" } },
    });
    expect(Object.keys(starterSelectComponentRegistration.manifest.propsSchema.properties)).toEqual(
      ["defaultValue", "disabled", "label", "options"],
    );
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

  it("uses one finite closed neutral property schema on every declared style part", () => {
    const hexColor = {
      anyOf: [
        { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        { type: "string", pattern: "^#[0-9A-Fa-f]{8}$" },
      ],
    };
    const registrations = STARTER_COMPONENT_REGISTRATIONS;
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
        options: [{ disabled: false, label: "Option 1", value: "option-1" }],
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
