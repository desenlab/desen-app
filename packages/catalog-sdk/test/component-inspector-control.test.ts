import { describe, expect, it } from "vitest";

import { deriveComponentInspectorControls } from "../src/component-inspector-control.js";
import { registerComponent } from "../src/component-registration.js";

import type {
  ComponentInspectorControl,
  ComponentInspectorControlPlan,
} from "../src/component-inspector-control.js";
import type {
  ComponentManifestInput,
  RegisterComponentInput,
} from "../src/component-registration.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Object.keys(value)) {
    expectDeeplyFrozen((value as Record<string, unknown>)[key]);
  }
}

function onlyControl(plan: ComponentInspectorControlPlan): ComponentInspectorControl {
  const [control, ...rest] = plan.controls;
  if (control === undefined || rest.length !== 0) {
    throw new Error(`Expected one control, received ${plan.controls.length}.`);
  }
  return control;
}

function derive(manifest: ComponentManifestInput): ComponentInspectorControlPlan {
  return deriveComponentInspectorControls(
    registerComponent({
      id: "com.example.ui/Test",
      manifest,
    } as RegisterComponentInput),
  );
}

function createNestedSchema(depth: number): Record<string, unknown> {
  let schema: Record<string, unknown> = { type: "string" };
  for (let index = 1; index < depth; index += 1) {
    schema = {
      type: "object",
      additionalProperties: false,
      properties: { child: schema },
    };
  }
  return schema;
}

describe("deriveComponentInspectorControls", () => {
  it("derives canonical primitive controls, requiredness, pointers, and enum order", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["zeta", "choice", "count"],
        properties: {
          zeta: { type: "string" },
          text: { type: "string" },
          ratio: { type: "number" },
          enabled: { type: "boolean" },
          count: { type: "integer" },
          choice: { type: "string", enum: ["third", "first", "second"] },
        },
      },
    });

    expect(plan.controls.map(({ property }) => property)).toEqual([
      "choice",
      "count",
      "enabled",
      "ratio",
      "text",
      "zeta",
    ]);
    expect(plan.controls.map(({ kind }) => kind)).toEqual([
      "enum",
      "integer",
      "boolean",
      "number",
      "string",
      "string",
    ]);
    expect(plan.controls.map(({ required }) => required)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
    expect(plan.controls[0]).toMatchObject({
      kind: "enum",
      options: ["third", "first", "second"],
      valuePointer: "/choice",
      schemaPointer: "/propsSchema/properties/choice",
    });
  });

  it("derives recursively closed object groups and RFC 6901-escaped pointers", () => {
    const manifest = JSON.parse(`{
      "propsSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["profile/a~b"],
        "properties": {
          "profile/a~b": {
            "type": "object",
            "additionalProperties": false,
            "required": ["display/name~raw"],
            "properties": {
              "display/name~raw": { "type": "string" },
              "age": { "type": "integer" }
            }
          }
        }
      },
      "authoring": {
        "controls": {
          "profile/a~b": {
            "properties": {
              "display/name~raw": { "presentation": "multiline" }
            }
          }
        }
      }
    }`) as ComponentManifestInput;
    const plan = derive(manifest);
    const group = onlyControl(plan);

    expect(group).toMatchObject({
      kind: "group",
      property: "profile/a~b",
      required: true,
      valuePointer: "/profile~1a~0b",
      schemaPointer: "/propsSchema/properties/profile~1a~0b",
      hintPointer: "/authoring/controls/profile~1a~0b",
    });
    if (group.kind !== "group") throw new Error("Expected a group control.");
    expect(group.children).toEqual([
      {
        kind: "integer",
        property: "age",
        required: false,
        schemaPointer: "/propsSchema/properties/profile~1a~0b/properties/age",
        valuePointer: "/profile~1a~0b/age",
      },
      {
        kind: "string",
        property: "display/name~raw",
        required: true,
        schemaPointer: "/propsSchema/properties/profile~1a~0b/properties/display~1name~0raw",
        valuePointer: "/profile~1a~0b/display~1name~0raw",
      },
    ]);
    expect(group.children.every((control) => control.hint === undefined)).toBe(true);
  });

  it("retains complete authoring data while treating misleading hints as opaque sidecars", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["tone"],
        properties: {
          tone: { type: "string", enum: ["info", "warning"] },
          visible: { type: "boolean" },
        },
      },
      authoring: {
        displayName: "Alert",
        category: "Feedback",
        icon: "alert",
        defaultProps: { tone: "info", visible: true },
        controls: {
          ghost: {
            kind: "string",
          },
          tone: {
            kind: "number",
            required: false,
            options: ["invented"],
            presentation: "segmented",
          },
        },
        scenarios: {
          warning: {
            props: { tone: "warning" },
            fixtures: { message: "Synthetic warning" },
            state: { expanded: true },
            description: "Warning preview.",
            extensions: { "com.example/scenario": true },
          },
        },
        resize: { horizontal: "fill", vertical: "hug" },
        adapterFidelity: "approximate",
        differences: ["Animation is omitted."],
        extensions: { "com.example/owner": "design-system" },
      },
    });

    expect(plan.authoring).toEqual({
      adapterFidelity: "approximate",
      category: "Feedback",
      controls: {
        ghost: {
          kind: "string",
        },
        tone: {
          kind: "number",
          options: ["invented"],
          presentation: "segmented",
          required: false,
        },
      },
      defaultProps: { tone: "info", visible: true },
      differences: ["Animation is omitted."],
      displayName: "Alert",
      extensions: { "com.example/owner": "design-system" },
      icon: "alert",
      resize: { horizontal: "fill", vertical: "hug" },
      scenarios: {
        warning: {
          description: "Warning preview.",
          extensions: { "com.example/scenario": true },
          fixtures: { message: "Synthetic warning" },
          props: { tone: "warning" },
          state: { expanded: true },
        },
      },
    });
    expect(plan.controls[0]).toEqual({
      hint: {
        kind: "number",
        options: ["invented"],
        presentation: "segmented",
        required: false,
      },
      hintPointer: "/authoring/controls/tone",
      kind: "enum",
      options: ["info", "warning"],
      property: "tone",
      required: true,
      schemaPointer: "/propsSchema/properties/tone",
      valuePointer: "/tone",
    });
    expect(plan.controls[1]).not.toHaveProperty("hint");
    expect(plan.controls[1]).toMatchObject({
      kind: "boolean",
      property: "visible",
      required: false,
    });
    expect(plan.controls.some(({ property }) => property === "ghost")).toBe(false);
  });

  it("keeps every unsupported schema subtree visible through a reasoned fallback", () => {
    const cases: readonly (readonly [string, unknown, string])[] = [
      ["array", { type: "array", items: { type: "string" } }, "array"],
      ["open object", { type: "object", properties: { value: { type: "string" } } }, "open-object"],
      ["multi type", { type: ["string", "null"] }, "multi-type"],
      ["reference", { $ref: "#/$defs/name" }, "reference"],
      ["dynamic reference", { $dynamicRef: "#name" }, "reference"],
      ["allOf", { allOf: [{ type: "string" }] }, "combinator"],
      ["oneOf", { oneOf: [{ type: "string" }] }, "combinator"],
      ["conditional", { if: { type: "string" }, then: { minLength: 1 } }, "conditional"],
      ["dependent schema", { type: "object", dependentSchemas: {} }, "conditional"],
      ["pattern", { type: "string", pattern: "^[a-z]+$" }, "pattern"],
      [
        "pattern properties",
        { type: "object", additionalProperties: false, properties: {}, patternProperties: {} },
        "pattern",
      ],
      [
        "unevaluated properties",
        { type: "string", unevaluatedProperties: false },
        "unsupported-schema",
      ],
      ["property names", { type: "string", propertyNames: { minLength: 1 } }, "unsupported-schema"],
      ["prefix items", { type: "string", prefixItems: [{ type: "string" }] }, "unsupported-schema"],
      ["contains", { type: "string", contains: { const: "value" } }, "unsupported-schema"],
      [
        "definitions",
        { type: "string", $defs: { value: { type: "string" } } },
        "unsupported-schema",
      ],
      ["const", { type: "string", const: "fixed" }, "unsupported-schema"],
      ["empty enum", { type: "string", enum: [] }, "unsupported-schema"],
      ["structured enum", { enum: [{ mode: "fixed" }] }, "unsupported-schema"],
      ["type-mismatched enum", { type: "string", enum: ["valid", 1] }, "unsupported-schema"],
      ["unknown keyword", { type: "string", "x-example-control": true }, "unsupported-schema"],
      ["untyped", { minLength: 1 }, "unsupported-schema"],
      ["boolean schema", false, "unsupported-schema"],
    ];

    for (const [label, schema, reason] of cases) {
      const plan = derive({
        propsSchema: {
          type: "object",
          additionalProperties: false,
          properties: { value: schema },
        },
      } as ComponentManifestInput);

      expect(onlyControl(plan), label).toEqual({
        fallbackReason: reason,
        kind: "structured-json",
        property: "value",
        required: false,
        schemaPointer: "/propsSchema/properties/value",
        valuePointer: "/value",
      });
    }
  });

  it("retains supported constraint metadata in the authoritative schema snapshot", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        maxProperties: 2,
        properties: {
          amount: {
            type: "number",
            minimum: 0,
            exclusiveMaximum: 100,
            multipleOf: 0.5,
            default: 1,
            description: "Bounded amount.",
          },
          label: {
            type: "string",
            minLength: 1,
            maxLength: 20,
            format: "custom-label",
          },
        },
      },
    });

    expect(plan.controls.map(({ kind }) => kind)).toEqual(["number", "string"]);
    expect(plan.propsSchema).toMatchObject({
      minProperties: 1,
      maxProperties: 2,
      properties: {
        amount: {
          minimum: 0,
          exclusiveMaximum: 100,
          multipleOf: 0.5,
          default: 1,
          description: "Bounded amount.",
        },
        label: {
          minLength: 1,
          maxLength: 20,
          format: "custom-label",
        },
      },
    });
  });

  it("does not drop supported siblings when one child requires structured JSON", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          simple: { type: "boolean" },
          complex: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
      },
    });

    expect(plan.controls).toHaveLength(2);
    expect(plan.controls).toEqual([
      {
        fallbackReason: "combinator",
        kind: "structured-json",
        property: "complex",
        required: false,
        schemaPointer: "/propsSchema/properties/complex",
        valuePointer: "/complex",
      },
      {
        kind: "boolean",
        property: "simple",
        required: false,
        schemaPointer: "/propsSchema/properties/simple",
        valuePointer: "/simple",
      },
    ]);
  });

  it("uses canonical property order even for integer-like names", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          "2": { type: "string" },
          "10": {
            type: "object",
            additionalProperties: false,
            properties: {
              "2": { type: "boolean" },
              "10": { type: "boolean" },
            },
          },
          alpha: { type: "integer" },
        },
      },
    });

    expect(plan.controls.map(({ property }) => property)).toEqual(["10", "2", "alpha"]);
    const group = plan.controls[0];
    if (group?.kind !== "group")
      throw new Error("Expected integer-like property 10 to be a group.");
    expect(group.children.map(({ property }) => property)).toEqual(["10", "2"]);
  });

  it("keeps a whole-object enum visible through the root fallback", () => {
    const plan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        enum: [{ mode: "fixed" }],
        properties: {
          mode: { type: "string" },
        },
      },
    } as ComponentManifestInput);

    expect(onlyControl(plan)).toEqual({
      fallbackReason: "unsupported-schema",
      kind: "structured-json",
      property: null,
      required: true,
      schemaPointer: "/propsSchema",
      valuePointer: "",
    });
  });

  it("falls back instead of hiding required names that have no declared property", () => {
    const rootPlan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        required: ["missing"],
        properties: {},
      },
    });
    const nestedPlan = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          group: {
            type: "object",
            additionalProperties: false,
            required: ["missing"],
            properties: {},
          },
        },
      },
    });

    expect(onlyControl(rootPlan)).toMatchObject({
      kind: "structured-json",
      property: null,
      fallbackReason: "unsupported-schema",
    });
    expect(onlyControl(nestedPlan)).toMatchObject({
      kind: "structured-json",
      property: "group",
      fallbackReason: "unsupported-schema",
    });
  });

  it("uses one root fallback when the root schema is not an explicit closed object", () => {
    const openPlan = derive({
      propsSchema: {
        type: "object",
        properties: { visible: { type: "boolean" } },
      },
    });
    const referencePlan = derive({
      propsSchema: {
        $ref: "#/$defs/props",
        $defs: {
          props: {
            type: "object",
            additionalProperties: false,
            properties: { visible: { type: "boolean" } },
          },
        },
      },
    });

    expect(onlyControl(openPlan)).toEqual({
      fallbackReason: "open-object",
      kind: "structured-json",
      property: null,
      required: true,
      schemaPointer: "/propsSchema",
      valuePointer: "",
    });
    expect(onlyControl(referencePlan)).toMatchObject({
      fallbackReason: "reference",
      kind: "structured-json",
      property: null,
    });
  });

  it("accepts exactly 16 control levels and replaces deeper output with a root limit fallback", () => {
    const accepted = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { root: createNestedSchema(16) },
      },
    } as ComponentManifestInput);
    const rejected = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { root: createNestedSchema(17) },
      },
    } as ComponentManifestInput);

    expect(onlyControl(accepted).kind).toBe("group");
    expect(onlyControl(rejected)).toEqual({
      fallbackReason: "derivation-limit",
      kind: "structured-json",
      property: null,
      required: true,
      schemaPointer: "/propsSchema",
      valuePointer: "",
    });
  });

  it("accepts exactly 512 controls and returns no partial output at 513", () => {
    const createWideManifest = (count: number): ComponentManifestInput => {
      const properties: Record<string, { readonly type: "string" }> = {};
      for (let index = 0; index < count; index += 1) {
        properties[`property-${String(index).padStart(3, "0")}`] = { type: "string" };
      }
      return {
        propsSchema: {
          type: "object",
          additionalProperties: false,
          properties,
        },
      };
    };

    const accepted = derive(createWideManifest(512));
    const rejected = derive(createWideManifest(513));

    expect(accepted.controls).toHaveLength(512);
    expect(onlyControl(rejected)).toMatchObject({
      fallbackReason: "derivation-limit",
      kind: "structured-json",
      property: null,
    });
  });

  it("returns an exact detached and deeply frozen snapshot without changing the caller", () => {
    const manifest = {
      description: "Original",
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" } },
      },
      authoring: {
        defaultProps: { label: "Original" },
        controls: { label: { presentation: "multiline" } },
      },
    };
    const registration = registerComponent({
      id: "com.example.ui/Original",
      manifest,
    });
    const plan = deriveComponentInspectorControls(registration);

    expect(plan.propsSchema).not.toBe(registration.manifest.propsSchema);
    expect(plan.authoring).not.toBe(registration.manifest.authoring);
    expect(plan.controls[0]?.hint).not.toBe(registration.manifest.authoring?.controls?.label);
    expectDeeplyFrozen(plan);
    expect(Object.isFrozen(manifest)).toBe(false);
    expect(Object.isFrozen(manifest.propsSchema)).toBe(false);

    manifest.propsSchema.properties.label.type = "number";
    manifest.authoring.defaultProps.label = "Changed";
    manifest.authoring.controls.label.presentation = "changed";

    expect(plan.propsSchema).toMatchObject({
      properties: { label: { type: "string" } },
    });
    expect(plan.authoring?.defaultProps).toEqual({ label: "Original" });
    expect(plan.controls[0]?.hint).toEqual({ presentation: "multiline" });
  });

  it("rejects accessors and hostile non-JSON values without invoking getters", () => {
    let getterInvoked = false;
    const accessor = Object.defineProperty({}, "danger", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "changed";
      },
    });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const hostileValues = [
      accessor,
      { callback: () => undefined },
      { invalid: Number.NaN },
      { cycle },
      new Map([["value", true]]),
    ];

    for (const hostile of hostileValues) {
      expect(() =>
        deriveComponentInspectorControls({
          id: "com.example.ui/Hostile",
          manifest: {
            propsSchema: {
              type: "object",
              additionalProperties: false,
              properties: { value: { type: "string" } },
            },
            authoring: { controls: { value: hostile } },
          },
        } as never),
      ).toThrow(TypeError);
    }
    expect(getterInvoked).toBe(false);
  });

  it("handles prototype-like property and hint names without prototype pollution", () => {
    const manifest = JSON.parse(`{
      "propsSchema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["__proto__"],
        "properties": {
          "__proto__": { "type": "boolean" },
          "constructor": { "type": "string" },
          "prototype": { "enum": [null, false, "data"] }
        }
      },
      "authoring": {
        "controls": {
          "__proto__": { "presentation": "switch" },
          "constructor": { "presentation": "text" }
        }
      }
    }`) as ComponentManifestInput;
    const plan = derive(manifest);

    expect(plan.controls.map(({ property }) => property)).toEqual([
      "__proto__",
      "constructor",
      "prototype",
    ]);
    expect(plan.controls[0]).toMatchObject({
      kind: "boolean",
      required: true,
      hintPointer: "/authoring/controls/__proto__",
      valuePointer: "/__proto__",
    });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("is deterministic across object insertion order while preserving semantic array order", () => {
    const first = derive({
      authoring: { controls: { choice: { z: 1, a: 2 } }, displayName: "Choice" },
      propsSchema: {
        properties: {
          zeta: { type: "boolean" },
          choice: { enum: ["z", "a"] },
        },
        additionalProperties: false,
        type: "object",
      },
    });
    const second = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          choice: { enum: ["z", "a"] },
          zeta: { type: "boolean" },
        },
      },
      authoring: { displayName: "Choice", controls: { choice: { a: 2, z: 1 } } },
    });
    const reorderedOptions = derive({
      propsSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          choice: { enum: ["a", "z"] },
          zeta: { type: "boolean" },
        },
      },
      authoring: { displayName: "Choice", controls: { choice: { a: 2, z: 1 } } },
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(reorderedOptions));
  });
});
