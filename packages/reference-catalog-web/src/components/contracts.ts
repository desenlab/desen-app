import { registerComponent } from "@desen/catalog-sdk";

import type { ComponentPropsOf } from "@desen/catalog-sdk";

/**
 * Exact capability identifier used by the frozen DESEN Web Catalog example.
 *
 * @remarks Keeping the reference implementation on the example identifier lets the official
 * sign-in fixture resolve without a project-specific translation layer.
 */
export const STACK_CAPABILITY_ID = "com.example.ui/Stack";

/**
 * Exact capability identifier used by the frozen DESEN Web Catalog example.
 *
 * @remarks Keeping the reference implementation on the example identifier lets the official
 * sign-in fixture resolve without a project-specific translation layer.
 */
export const TEXT_CAPABILITY_ID = "com.example.ui/Text";

/**
 * Immutable Catalog registration for the reference Stack capability.
 *
 * @remarks The manifest is intentionally data-only and mirrors the frozen DESEN 0.1.0 Web Catalog
 * example. React children are represented by the declared `default` slot, never by `propsSchema`.
 */
export const stackComponentRegistration = registerComponent({
  id: STACK_CAPABILITY_ID,
  manifest: {
    description: "Linear layout container.",
    category: "layout",
    propsSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        direction: {
          type: "string",
          enum: ["vertical", "horizontal"],
          default: "vertical",
        },
        gap: {
          type: "string",
          enum: ["none", "xs", "sm", "md", "lg", "xl"],
        },
        maxWidth: {
          type: "number",
          exclusiveMinimum: 0,
        },
        align: {
          type: "string",
          enum: ["start", "center", "end", "stretch"],
        },
      },
    },
    slots: {
      default: {
        required: false,
        minItems: 0,
        acceptsCategories: ["layout", "content", "input", "action", "feedback", "complex"],
      },
    },
    styleParts: {
      root: {
        propertiesSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
          properties: {
            background: {
              type: ["string", "object"],
            },
            padding: {
              type: ["string", "number", "object"],
            },
            borderRadius: {
              type: ["string", "number", "object"],
            },
          },
        },
      },
    },
    authoring: {
      displayName: "Stack",
      category: "Layout",
      icon: "stack",
      defaultProps: {
        direction: "vertical",
        gap: "md",
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
 * Immutable Catalog registration for the reference Text capability.
 *
 * @remarks Text accepts only inert string content. It has no slot, event, command, or executable
 * HTML surface.
 */
export const textComponentRegistration = registerComponent({
  id: TEXT_CAPABILITY_ID,
  manifest: {
    description: "Text content.",
    category: "content",
    propsSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: {
        text: {
          type: "string",
        },
        role: {
          type: "string",
          enum: ["body", "heading", "caption"],
        },
      },
    },
    styleParts: {
      text: {
        propertiesSchema: {
          type: "object",
        },
      },
    },
    authoring: {
      displayName: "Text",
      category: "Content",
      icon: "text",
      defaultProps: {
        text: "Text",
        role: "body",
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
 * Resolved, JSON-only properties declared by the Stack Catalog contract.
 *
 * @remarks This type deliberately excludes React children. Children enter the Web renderer only
 * after the runtime materializes the manifest's declared `default` slot.
 */
export type StackCatalogProps = ComponentPropsOf<typeof stackComponentRegistration>;

/** Stack layout direction declared by the Catalog contract. */
export type StackDirection = NonNullable<StackCatalogProps["direction"]>;

/** Stack spacing option declared by the Catalog contract. */
export type StackGap = NonNullable<StackCatalogProps["gap"]>;

/** Stack cross-axis alignment declared by the Catalog contract. */
export type StackAlignment = NonNullable<StackCatalogProps["align"]>;

/** Resolved, JSON-only properties declared by the Text Catalog contract. */
export type TextCatalogProps = ComponentPropsOf<typeof textComponentRegistration>;

/** Semantic text role declared by the Catalog contract. */
export type TextRole = NonNullable<TextCatalogProps["role"]>;
