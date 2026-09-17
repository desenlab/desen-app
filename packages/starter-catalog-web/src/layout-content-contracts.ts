import { registerComponent } from "@desen/catalog-sdk";

import { starterVisualStylePropertiesSchema } from "./visual-style-profile.js";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const CONTENT_SLOT_ACCEPTS_CATEGORIES = Object.freeze([
  "layout",
  "content",
  "input",
  "action",
  "overlay",
  "feedback",
  "complex",
] as const);

const layoutStylePropertiesSchema = starterVisualStylePropertiesSchema("layout");
const typographyStylePropertiesSchema = starterVisualStylePropertiesSchema("typography");
const imageStylePropertiesSchema = starterVisualStylePropertiesSchema("image");
const iconStylePropertiesSchema = starterVisualStylePropertiesSchema("media");
const separatorStylePropertiesSchema = starterVisualStylePropertiesSchema("separator");

function layoutStylePart(description: string) {
  return { description, propertiesSchema: layoutStylePropertiesSchema } as const;
}

function typographyStylePart(description: string) {
  return { description, propertiesSchema: typographyStylePropertiesSchema } as const;
}

function imageStylePart(description: string) {
  return { description, propertiesSchema: imageStylePropertiesSchema } as const;
}

function iconStylePart(description: string) {
  return { description, propertiesSchema: iconStylePropertiesSchema } as const;
}

function separatorStylePart(description: string) {
  return { description, propertiesSchema: separatorStylePropertiesSchema } as const;
}

/** Exact capability identifier for the DESEN Neutral Box layout primitive. */
export const STARTER_BOX_CAPABILITY_ID = "run.desen.starter/Box";

/** Exact capability identifier for the DESEN Neutral Stack layout primitive. */
export const STARTER_STACK_CAPABILITY_ID = "run.desen.starter/Stack";

/** Exact capability identifier for the DESEN Neutral Grid layout primitive. */
export const STARTER_GRID_CAPABILITY_ID = "run.desen.starter/Grid";

/** Exact capability identifier for the DESEN Neutral Text content primitive. */
export const STARTER_TEXT_CAPABILITY_ID = "run.desen.starter/Text";

/** Exact capability identifier for the DESEN Neutral Heading content primitive. */
export const STARTER_HEADING_CAPABILITY_ID = "run.desen.starter/Heading";

/** Exact capability identifier for the DESEN Neutral built-in Image primitive. */
export const STARTER_IMAGE_CAPABILITY_ID = "run.desen.starter/Image";

/** Exact capability identifier for the DESEN Neutral built-in Icon primitive. */
export const STARTER_ICON_CAPABILITY_ID = "run.desen.starter/Icon";

/** Exact capability identifier for the DESEN Neutral Separator primitive. */
export const STARTER_SEPARATOR_CAPABILITY_ID = "run.desen.starter/Separator";

/** Maximum number of direct children admitted by one finite T05 layout slot. */
export const STARTER_LAYOUT_CONTENT_MAX_ITEMS = 100;

/** Immutable Catalog registration for the semantic Box layout primitive. */
export const starterBoxComponentRegistration = registerComponent({
  id: STARTER_BOX_CAPABILITY_ID,
  manifest: {
    description: "Neutral semantic grouping container with one managed content slot.",
    category: "layout",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        dir: { type: "string", enum: ["ltr", "rtl"], default: "ltr" },
      },
    },
    slots: {
      default: {
        required: true,
        minItems: 1,
        maxItems: STARTER_LAYOUT_CONTENT_MAX_ITEMS,
        acceptsCategories: CONTENT_SLOT_ACCEPTS_CATEGORIES,
        description: "Ordered managed content within the semantic grouping container.",
      },
    },
    styleParts: { root: layoutStylePart("Box container surface and logical layout properties.") },
    authoring: {
      displayName: "Box",
      category: "Layout",
      icon: "box",
      defaultProps: { dir: "ltr" },
      scenarios: { default: { props: { dir: "ltr" } } },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for the semantic Stack layout primitive. */
export const starterStackComponentRegistration = registerComponent({
  id: STARTER_STACK_CAPABILITY_ID,
  manifest: {
    description: "Neutral logical flex layout with ordered managed content.",
    category: "layout",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        direction: { type: "string", enum: ["vertical", "horizontal"], default: "vertical" },
        wrap: { type: "boolean", default: false },
        dir: { type: "string", enum: ["ltr", "rtl"], default: "ltr" },
      },
    },
    slots: {
      default: {
        required: true,
        minItems: 1,
        maxItems: STARTER_LAYOUT_CONTENT_MAX_ITEMS,
        acceptsCategories: CONTENT_SLOT_ACCEPTS_CATEGORIES,
        description: "Ordered children arranged by the declared logical flex direction.",
      },
    },
    styleParts: { root: layoutStylePart("Stack flex surface and logical layout properties.") },
    authoring: {
      displayName: "Stack",
      category: "Layout",
      icon: "stack",
      defaultProps: { direction: "vertical", wrap: false, dir: "ltr" },
      scenarios: {
        vertical: { props: { direction: "vertical", wrap: false, dir: "ltr" } },
        horizontal: { props: { direction: "horizontal", wrap: true, dir: "ltr" } },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for the semantic Grid layout primitive. */
export const starterGridComponentRegistration = registerComponent({
  id: STARTER_GRID_CAPABILITY_ID,
  manifest: {
    description: "Neutral finite-column CSS grid with ordered managed content.",
    category: "layout",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        columns: { type: "integer", minimum: 1, maximum: 12, default: 2 },
        flow: { type: "string", enum: ["row", "column"], default: "row" },
        dir: { type: "string", enum: ["ltr", "rtl"], default: "ltr" },
      },
    },
    slots: {
      default: {
        required: true,
        minItems: 1,
        maxItems: STARTER_LAYOUT_CONTENT_MAX_ITEMS,
        acceptsCategories: CONTENT_SLOT_ACCEPTS_CATEGORIES,
        description: "Ordered grid cells; placement remains the browser's safe normal flow.",
      },
    },
    styleParts: { root: layoutStylePart("Grid surface and finite sizing/alignment properties.") },
    authoring: {
      displayName: "Grid",
      category: "Layout",
      icon: "grid",
      defaultProps: { columns: 2, flow: "row", dir: "ltr" },
      scenarios: {
        twoColumns: { props: { columns: 2, flow: "row", dir: "ltr" } },
        rtl: { props: { columns: 3, flow: "row", dir: "rtl" } },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for inert paragraph text. */
export const starterTextComponentRegistration = registerComponent({
  id: STARTER_TEXT_CAPABILITY_ID,
  manifest: {
    description: "Neutral inert paragraph text rendered without HTML parsing.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: { text: { type: "string", minLength: 1, maxLength: 4_096 } },
    },
    styleParts: { root: typographyStylePart("Paragraph typography and safe box appearance.") },
    authoring: {
      displayName: "Text",
      category: "Content",
      icon: "text",
      defaultProps: { text: "Text" },
      scenarios: { default: { props: { text: "A clear, readable paragraph." } } },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for an inert semantic HTML heading. */
export const starterHeadingComponentRegistration = registerComponent({
  id: STARTER_HEADING_CAPABILITY_ID,
  manifest: {
    description: "Neutral semantic HTML heading with a bounded level.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: { type: "string", minLength: 1, maxLength: 256 },
        level: { type: "integer", minimum: 1, maximum: 6, default: 2 },
      },
    },
    styleParts: { root: typographyStylePart("Heading typography and safe box appearance.") },
    authoring: {
      displayName: "Heading",
      category: "Content",
      icon: "heading",
      defaultProps: { text: "Heading", level: 2 },
      scenarios: {
        h1: { props: { text: "Page title", level: 1 } },
        h2: { props: { text: "Section title", level: 2 } },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for one closed set of trusted local placeholder images. */
export const starterImageComponentRegistration = registerComponent({
  id: STARTER_IMAGE_CAPABILITY_ID,
  manifest: {
    description: "Neutral built-in image rendered from a closed trusted in-package source set.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["source", "alt"],
      properties: {
        source: { type: "string", enum: ["neutral-horizon", "neutral-grid"] },
        alt: { type: "string", minLength: 1, maxLength: 256 },
        fit: { type: "string", enum: ["cover", "contain"], default: "cover" },
      },
    },
    styleParts: {
      root: imageStylePart(
        "Image frame, dimensions, and safe visual appearance; foreground color is unsupported.",
      ),
    },
    authoring: {
      displayName: "Image",
      category: "Content",
      icon: "image",
      defaultProps: { source: "neutral-horizon", alt: "Neutral landscape", fit: "cover" },
      scenarios: {
        cover: { props: { source: "neutral-horizon", alt: "Neutral landscape", fit: "cover" } },
        contain: { props: { source: "neutral-grid", alt: "Neutral grid", fit: "contain" } },
      },
      resize: { horizontal: "resizable", vertical: "resizable" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for one closed set of trusted vector icon names. */
export const starterIconComponentRegistration = registerComponent({
  id: STARTER_ICON_CAPABILITY_ID,
  manifest: {
    description:
      "Neutral trusted vector icon with an explicit accessible name or decorative state.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      required: ["name", "label"],
      properties: {
        name: {
          type: "string",
          enum: ["arrow-right", "check", "close", "info", "menu", "plus", "search"],
        },
        label: { type: "string", minLength: 1, maxLength: 128 },
        decorative: { type: "boolean", default: false },
      },
    },
    styleParts: { root: iconStylePart("Icon size, color, and safe box appearance.") },
    authoring: {
      displayName: "Icon",
      category: "Content",
      icon: "icon",
      defaultProps: { name: "info", label: "Information", decorative: false },
      scenarios: {
        labelled: { props: { name: "info", label: "Information", decorative: false } },
        decorative: { props: { name: "check", label: "Completed", decorative: true } },
      },
      resize: { horizontal: "hug", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Immutable Catalog registration for a semantic horizontal or vertical separator. */
export const starterSeparatorComponentRegistration = registerComponent({
  id: STARTER_SEPARATOR_CAPABILITY_ID,
  manifest: {
    description: "Neutral semantic horizontal or vertical content separator.",
    category: "content",
    propsSchema: {
      $schema: JSON_SCHEMA_DIALECT,
      type: "object",
      additionalProperties: false,
      properties: {
        orientation: { type: "string", enum: ["horizontal", "vertical"], default: "horizontal" },
      },
    },
    styleParts: {
      root: separatorStylePart("Visible separator color, dimensions, and safe logical spacing."),
    },
    authoring: {
      displayName: "Separator",
      category: "Content",
      icon: "separator",
      defaultProps: { orientation: "horizontal" },
      scenarios: {
        horizontal: { props: { orientation: "horizontal" } },
        vertical: { props: { orientation: "vertical" } },
      },
      resize: { horizontal: "resizable", vertical: "hug" },
      adapterFidelity: "same",
    },
  },
});

/** Resolved JSON-only props admitted by the Box contract. */
export type StarterBoxProps = ComponentPropsOf<typeof starterBoxComponentRegistration>;

/** Resolved JSON-only props admitted by the Stack contract. */
export type StarterStackProps = ComponentPropsOf<typeof starterStackComponentRegistration>;

/** Resolved JSON-only props admitted by the Grid contract. */
export type StarterGridProps = ComponentPropsOf<typeof starterGridComponentRegistration>;

/** Resolved JSON-only props admitted by the Text contract. */
export type StarterTextProps = ComponentPropsOf<typeof starterTextComponentRegistration>;

/** Resolved JSON-only props admitted by the Heading contract. */
export type StarterHeadingProps = ComponentPropsOf<typeof starterHeadingComponentRegistration>;

/** Resolved JSON-only props admitted by the built-in Image contract. */
export type StarterImageProps = ComponentPropsOf<typeof starterImageComponentRegistration>;

/** Resolved JSON-only props admitted by the built-in Icon contract. */
export type StarterIconProps = ComponentPropsOf<typeof starterIconComponentRegistration>;

/** Resolved JSON-only props admitted by the Separator contract. */
export type StarterSeparatorProps = ComponentPropsOf<typeof starterSeparatorComponentRegistration>;
