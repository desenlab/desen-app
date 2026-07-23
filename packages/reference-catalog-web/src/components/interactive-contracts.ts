import { registerComponent } from "@desen/catalog-sdk";

import type { ComponentPropsOf, JsonSchemaValue } from "@desen/catalog-sdk";

/**
 * Exact capability identifier used by the frozen DESEN Web Catalog example.
 *
 * @remarks The official sign-in Source binds two state entries through this capability's declared
 * `change` event.
 */
export const TEXT_FIELD_CAPABILITY_ID = "com.example.ui/TextField";

/**
 * Exact capability identifier used by the frozen DESEN Web Catalog example.
 *
 * @remarks The official sign-in Source invokes its operation from this capability's declared
 * `press` event.
 */
export const BUTTON_CAPABILITY_ID = "com.example.ui/Button";

/**
 * Exact capability identifier used by the frozen DESEN Web Catalog example.
 *
 * @remarks The official sign-in Source conditionally renders this capability after a failed
 * operation.
 */
export const ALERT_CAPABILITY_ID = "com.example.ui/Alert";

/**
 * Immutable Catalog registration for the reference TextField capability.
 *
 * @remarks The registration mirrors the frozen DESEN 0.1.0 Web Catalog exactly. Its event payload
 * and focus-command input remain inert schemas; executable React callbacks and refs are supplied
 * only by the trusted Web adapter boundary.
 */
export const textFieldComponentRegistration = registerComponent({
  id: TEXT_FIELD_CAPABILITY_ID,
  manifest: {
    description: "Text input.",
    category: "input",
    propsSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["label", "value"],
      properties: {
        label: {
          type: "string",
        },
        value: {
          type: "string",
        },
        placeholder: {
          type: "string",
        },
        secure: {
          type: "boolean",
        },
        disabled: {
          type: "boolean",
        },
        invalid: {
          type: "boolean",
        },
      },
    },
    events: {
      change: {
        payloadSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
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
    commands: {
      focus: {
        inputSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
        },
      },
    },
    styleParts: {
      root: {
        propertiesSchema: {
          type: "object",
        },
      },
      label: {
        propertiesSchema: {
          type: "object",
        },
      },
      control: {
        propertiesSchema: {
          type: "object",
        },
      },
      message: {
        propertiesSchema: {
          type: "object",
        },
      },
    },
    visualStates: ["focus", "disabled", "invalid"],
    authoring: {
      displayName: "Text field",
      category: "Inputs",
      icon: "text-field",
      defaultProps: {
        label: "Label",
        value: "",
      },
      scenarios: {
        default: {
          props: {
            label: "Email",
            value: "",
          },
        },
        invalid: {
          props: {
            label: "Email",
            value: "bad",
            invalid: true,
          },
        },
      },
      resize: {
        horizontal: "fill",
        vertical: "hug",
      },
      adapterFidelity: "same",
    },
  },
});

/**
 * Immutable Catalog registration for the reference Button capability.
 *
 * @remarks The registration contains only the data contract. The trusted Web implementation maps
 * native activation to the declared empty `press` payload without exposing a DOM event.
 */
export const buttonComponentRegistration = registerComponent({
  id: BUTTON_CAPABILITY_ID,
  manifest: {
    description: "Action button.",
    category: "action",
    propsSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["label"],
      properties: {
        label: {
          type: "string",
        },
        variant: {
          type: "string",
          enum: ["primary", "secondary", "danger"],
        },
        loading: {
          type: "boolean",
        },
        disabled: {
          type: "boolean",
        },
      },
    },
    events: {
      press: {
        payloadSchema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          additionalProperties: false,
        },
      },
    },
    styleParts: {
      root: {
        propertiesSchema: {
          type: "object",
        },
      },
      label: {
        propertiesSchema: {
          type: "object",
        },
      },
      leadingIcon: {
        propertiesSchema: {
          type: "object",
        },
      },
    },
    visualStates: ["hover", "focus", "pressed", "disabled", "loading"],
    authoring: {
      displayName: "Button",
      category: "Actions",
      icon: "button",
      defaultProps: {
        label: "Button",
        variant: "primary",
        loading: false,
      },
      scenarios: {
        default: {
          props: {
            label: "Continue",
            variant: "primary",
          },
        },
        loading: {
          props: {
            label: "Continue",
            variant: "primary",
            loading: true,
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
 * Immutable Catalog registration for the reference Alert capability.
 *
 * @remarks The frozen Catalog names the highest-urgency tone `critical`; the conflicting
 * abbreviated prose example's `danger` spelling is not admitted into this exact contract.
 */
export const alertComponentRegistration = registerComponent({
  id: ALERT_CAPABILITY_ID,
  manifest: {
    description: "Feedback message.",
    category: "feedback",
    propsSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["tone", "text"],
      properties: {
        tone: {
          type: "string",
          enum: ["info", "success", "warning", "critical"],
        },
        text: {
          type: "string",
        },
      },
    },
    styleParts: {
      root: {
        propertiesSchema: {
          type: "object",
        },
      },
      icon: {
        propertiesSchema: {
          type: "object",
        },
      },
      text: {
        propertiesSchema: {
          type: "object",
        },
      },
    },
    authoring: {
      displayName: "Alert",
      category: "Feedback",
      icon: "alert",
      defaultProps: {
        tone: "info",
        text: "Message",
      },
      resize: {
        horizontal: "fill",
        vertical: "hug",
      },
      adapterFidelity: "same",
    },
  },
});

/** Resolved, JSON-only properties declared by the TextField Catalog contract. */
export type TextFieldCatalogProps = ComponentPropsOf<typeof textFieldComponentRegistration>;

/** Exact inert payload declared for the TextField `change` event. */
export type TextFieldChangePayload = JsonSchemaValue<
  (typeof textFieldComponentRegistration.manifest.events)["change"]["payloadSchema"]
>;

/** Exact empty input object declared for the TextField `focus` command. */
export type TextFieldFocusInput = JsonSchemaValue<
  (typeof textFieldComponentRegistration.manifest.commands)["focus"]["inputSchema"]
>;

/** Resolved, JSON-only properties declared by the Button Catalog contract. */
export type ButtonCatalogProps = ComponentPropsOf<typeof buttonComponentRegistration>;

/** Button presentation variant declared by the Catalog contract. */
export type ButtonVariant = NonNullable<ButtonCatalogProps["variant"]>;

/** Exact inert payload declared for the Button `press` event. */
export type ButtonPressPayload = JsonSchemaValue<
  (typeof buttonComponentRegistration.manifest.events)["press"]["payloadSchema"]
>;

/** Resolved, JSON-only properties declared by the Alert Catalog contract. */
export type AlertCatalogProps = ComponentPropsOf<typeof alertComponentRegistration>;

/** Alert feedback tone declared by the Catalog contract. */
export type AlertTone = AlertCatalogProps["tone"];
