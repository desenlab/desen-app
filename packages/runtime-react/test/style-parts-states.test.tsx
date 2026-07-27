import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createRuntimeReactAdapterRegistry, renderRuntimeReactSurface } from "../src/index.js";
import {
  catalogComponents,
  createRuntimeReactSessionFixture,
  rootNode,
} from "./session-fixture.js";

import type { MutableJsonRecord, RuntimeReactSessionFixture } from "./session-fixture.js";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactComponentAdapterProps,
  RuntimeReactRenderInput,
  RuntimeReactSemanticStyle,
} from "../src/index.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const SORTABLE_ID = "com.example.interactions/Sortable";
const ADAPTER_LIMIT_CODE = "run.desen.validator/ADAPTER_VALIDATION_LIMIT_EXCEEDED";

interface StyleObservations {
  readonly components: RuntimeReactComponentAdapterProps[];
  readonly behaviors: RuntimeReactBehaviorAdapterProps[];
}

function createStyleRegistry(
  observations: StyleObservations,
  options: {
    readonly component?: (props: RuntimeReactComponentAdapterProps) => ReturnType<typeof Fragment>;
    readonly behavior?: boolean;
  } = {},
): RuntimeReactAdapterRegistryHandle {
  const Component =
    options.component ??
    ((props: RuntimeReactComponentAdapterProps) => {
      observations.components.push(props);
      return <Fragment>{props.slots.default}</Fragment>;
    });
  const Behavior = (props: RuntimeReactBehaviorAdapterProps) => {
    observations.behaviors.push(props);
    return <Fragment>{props.children}</Fragment>;
  };
  const created = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: STACK_ID, component: Component },
      { capabilityId: TEXT_ID, component: Component },
      { capabilityId: TEXT_FIELD_ID, component: Component },
      { capabilityId: BUTTON_ID, component: Component },
    ],
    ...(options.behavior
      ? { behaviors: [{ capabilityId: SORTABLE_ID, component: Behavior }] }
      : {}),
  });
  if (created.status !== "created") throw new TypeError("Expected style adapter registry.");
  return created.handle;
}

function renderFixture(
  fixture: RuntimeReactSessionFixture,
  registry: RuntimeReactAdapterRegistryHandle,
  limits?: RuntimeReactRenderInput["limits"],
) {
  return renderRuntimeReactSurface({
    registry,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
    ...(limits === undefined ? {} : { limits }),
  });
}

function behaviorCatalog(catalog: MutableJsonRecord): MutableJsonRecord {
  const behaviors = catalog.behaviors as MutableJsonRecord;
  return behaviors[SORTABLE_ID] as MutableJsonRecord;
}

function recursivelyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) =>
    child !== null && typeof child === "object" ? recursivelyFrozen(child) : true,
  );
}

describe("semantic React style-part and visual-state boundary", () => {
  it("delivers complete immutable base and declared-state maps to component and behavior adapters", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ selectedBackground: "#224466" }),
      mutateCatalog(catalog) {
        const stack = catalogComponents(catalog)[STACK_ID] as MutableJsonRecord;
        stack.visualStates = ["selected"];
      },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.style = {
          base: { root: { padding: 8 } },
          selected: {
            root: { background: { $ref: "context.selectedBackground" } },
          },
        };
        root.behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: { axis: "vertical" },
            style: {
              base: { dropIndicator: { opacity: 0.25 } },
              dragging: { dropIndicator: { opacity: 1 } },
            },
          },
        ];
      },
    });
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations, { behavior: true }));
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    renderToStaticMarkup(result.surface.element);

    const root = observations.components.find(({ identity }) => identity.capabilityId === STACK_ID);
    expect(root?.style).toEqual({
      base: { root: { padding: 8 } },
      selected: { root: { background: "#224466" } },
    });
    expect(observations.behaviors[0]?.style).toEqual({
      base: { dropIndicator: { opacity: 0.25 } },
      dragging: { dropIndicator: { opacity: 1 } },
    });
    expect(recursivelyFrozen(root?.style)).toBe(true);
    expect(recursivelyFrozen(observations.behaviors[0]?.style)).toBe(true);
  });

  it("keeps statically unknown states, parts, and properties outside session ingress", () => {
    const invalidStyles = [
      { privateState: { root: {} } },
      { base: { privatePart: {} } },
      { base: { root: { privateProperty: true } } },
    ];

    for (const style of invalidStyles) {
      expect(() =>
        createRuntimeReactSessionFixture({
          mutateBundle(bundle) {
            rootNode(bundle).style = style;
          },
        }),
      ).toThrow(/UNKNOWN_PROP/u);
    }
  });

  it("rejects a dynamically resolved component style atomically with exact style identity", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ background: true }),
      mutateBundle(bundle) {
        rootNode(bundle).style = {
          base: {
            root: { background: { $ref: "context.background" } },
          },
        };
      },
    });
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations));

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_COMPONENT_STYLE",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: "style",
        diagnostics: [
          {
            code: "PROP_TYPE_MISMATCH",
            pointer: "/base/root/background",
            context: { capabilityId: STACK_ID },
          },
        ],
      },
    });
    expect(observations.components).toEqual([]);
    if (result.status !== "failed") return;
    expect(recursivelyFrozen(result.failure)).toBe(true);
  });

  it("rejects a dynamically resolved behavior style before behavior or owner delivery", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ indicatorColor: 42 }),
      mutateCatalog(catalog) {
        const sortable = behaviorCatalog(catalog);
        const parts = sortable.styleParts as MutableJsonRecord;
        const indicator = parts.dropIndicator as MutableJsonRecord;
        indicator.propertiesSchema = {
          type: "object",
          additionalProperties: false,
          properties: { color: { type: "string" } },
        };
      },
      mutateBundle(bundle) {
        rootNode(bundle).behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: { axis: "vertical" },
            style: {
              base: {
                dropIndicator: {
                  color: { $ref: "context.indicatorColor" },
                },
              },
            },
          },
        ];
      },
    });
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations, { behavior: true }));

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_BEHAVIOR_STYLE",
        sourceNodeId: "sign-in.layout",
        capabilityId: SORTABLE_ID,
        channel: "style",
        diagnostics: [
          {
            code: "PROP_TYPE_MISMATCH",
            pointer: "/base/dropIndicator/color",
          },
        ],
      },
    });
    expect(observations.components).toEqual([]);
    expect(observations.behaviors).toEqual([]);
  });

  it("contains deeply nested style input before any React adapter executes", () => {
    let nested: unknown = "leaf";
    for (let depth = 0; depth < 16; depth += 1) nested = { child: nested };
    const fixture = createRuntimeReactSessionFixture({
      mutateBundle(bundle) {
        rootNode(bundle).style = {
          base: { root: { background: nested } },
        };
      },
    });
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations), {
      maxJsonDepth: 6,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "JSON_DEPTH_LIMIT_EXCEEDED",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: null,
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("shares the style-validation budget across the complete component tree", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations), {
      maxStyleValidations: 4,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
        sourceNodeId: "sign-in.submit",
        capabilityId: BUTTON_ID,
        channel: "style",
        diagnostics: [{ code: ADAPTER_LIMIT_CODE, pointer: "" }],
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("shares one schema-evaluation budget across props and style validation", () => {
    const fixture = createRuntimeReactSessionFixture({
      mutateCatalog(catalog) {
        const stack = catalogComponents(catalog)[STACK_ID] as MutableJsonRecord;
        stack.propsSchema = { type: "object" };
        const styleParts = stack.styleParts as MutableJsonRecord;
        const root = styleParts.root as MutableJsonRecord;
        root.propertiesSchema = {
          type: "object",
          additionalProperties: false,
          properties: { color: { type: "string" } },
        };
      },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.props = {};
        root.style = { base: { root: { color: "red" } } };
      },
    });
    const observations: StyleObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createStyleRegistry(observations), {
      maxSchemaEvaluationSteps: 1,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: "style",
        diagnostics: [
          {
            code: ADAPTER_LIMIT_CODE,
            pointer: "/base/root",
          },
        ],
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("leaves declared-state activation entirely inside the capability adapter", () => {
    const fixture = createRuntimeReactSessionFixture({
      mutateCatalog(catalog) {
        const stack = catalogComponents(catalog)[STACK_ID] as MutableJsonRecord;
        stack.visualStates = ["selected"];
      },
      mutateBundle(bundle) {
        rootNode(bundle).style = {
          base: { root: { background: "white" } },
          selected: { root: { background: "blue" } },
        };
      },
    });

    const renderWithAdapterState = (
      activeState: "base" | "selected",
    ): { readonly html: string; readonly style: RuntimeReactSemanticStyle | undefined } => {
      const observations: StyleObservations = { components: [], behaviors: [] };
      const Component = (props: RuntimeReactComponentAdapterProps) => {
        observations.components.push(props);
        const background = props.style[activeState]?.root?.background;
        return (
          <section data-active-state={activeState} data-background={String(background ?? "")}>
            {props.slots.default}
          </section>
        );
      };
      const result = renderFixture(
        fixture,
        createStyleRegistry(observations, { component: Component }),
      );
      expect(result.status).toBe("rendered");
      if (result.status !== "rendered") return { html: "", style: undefined };
      return {
        html: renderToStaticMarkup(result.surface.element),
        style: observations.components.find(({ identity }) => identity.capabilityId === STACK_ID)
          ?.style,
      };
    };

    const base = renderWithAdapterState("base");
    const selected = renderWithAdapterState("selected");
    expect(base.html).toContain('data-active-state="base" data-background="white"');
    expect(selected.html).toContain('data-active-state="selected" data-background="blue"');
    expect(selected.style).toEqual(base.style);
    expect(selected.style).toEqual({
      base: { root: { background: "white" } },
      selected: { root: { background: "blue" } },
    });
  });
});
