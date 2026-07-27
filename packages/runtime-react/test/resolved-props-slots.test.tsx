import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { disposeRuntimeHeadlessSession } from "@desen/runtime-core";

import { createRuntimeReactAdapterRegistry, renderRuntimeReactSurface } from "../src/index.js";
import {
  catalogComponents,
  cloneJson,
  createRuntimeReactSessionFixture,
  rootNode,
} from "./session-fixture.js";

import type { RuntimeReactSessionFixture, MutableJsonRecord } from "./session-fixture.js";
import type { RuntimeHeadlessSessionHandle } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactComponentAdapterProps,
  RuntimeReactRenderInput,
} from "../src/index.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const SORTABLE_ID = "com.example.interactions/Sortable";
const ADAPTER_LIMIT_CODE = "run.desen.validator/ADAPTER_VALIDATION_LIMIT_EXCEEDED";

interface AdapterObservations {
  readonly components: RuntimeReactComponentAdapterProps[];
  readonly behaviors: RuntimeReactBehaviorAdapterProps[];
}

function createObservingRegistry(
  observations: AdapterObservations,
  options: { readonly behavior?: boolean } = {},
): RuntimeReactAdapterRegistryHandle {
  const Component = (props: RuntimeReactComponentAdapterProps) => {
    observations.components.push(props);
    return (
      <section data-source={props.identity.sourceNodeId}>
        {props.slots.default}
        {props.slots.status}
      </section>
    );
  };
  const Text = (props: RuntimeReactComponentAdapterProps) => {
    observations.components.push(props);
    return <span data-source={props.identity.sourceNodeId}>{String(props.props.text ?? "")}</span>;
  };
  const Field = (props: RuntimeReactComponentAdapterProps) => {
    observations.components.push(props);
    return (
      <label data-source={props.identity.sourceNodeId}>{String(props.props.label ?? "")}</label>
    );
  };
  const Button = (props: RuntimeReactComponentAdapterProps) => {
    observations.components.push(props);
    return (
      <button data-source={props.identity.sourceNodeId}>{String(props.props.label ?? "")}</button>
    );
  };
  const Behavior = (props: RuntimeReactBehaviorAdapterProps) => {
    observations.behaviors.push(props);
    return (
      <aside data-behavior={props.behaviorId}>
        {props.slots.dragPreview}
        {props.children}
      </aside>
    );
  };
  const created = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: STACK_ID, component: Component },
      { capabilityId: TEXT_ID, component: Text },
      { capabilityId: TEXT_FIELD_ID, component: Field },
      { capabilityId: BUTTON_ID, component: Button },
    ],
    ...(options.behavior
      ? { behaviors: [{ capabilityId: SORTABLE_ID, component: Behavior }] }
      : {}),
  });
  if (created.status !== "created") throw new TypeError("Expected observer registry.");
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

function catalogCapability(catalog: MutableJsonRecord, id: string): MutableJsonRecord {
  return catalogComponents(catalog)[id] as MutableJsonRecord;
}

function propsSchema(capability: MutableJsonRecord): MutableJsonRecord {
  return capability.propsSchema as MutableJsonRecord;
}

function firstDefaultChild(bundle: MutableJsonRecord): MutableJsonRecord {
  const slots = rootNode(bundle).slots as MutableJsonRecord;
  return (slots.default as MutableJsonRecord[])[0] as MutableJsonRecord;
}

describe("resolved React adapter props and named-slot receiving boundary", () => {
  it("renders from raw mount-returned Catalog authority and rejects foreign authority", () => {
    const empty = createRuntimeReactSessionFixture({
      mutateBundle(bundle) {
        rootNode(bundle).when = { op: "eq", args: [1, 2] };
      },
    });
    const foreign = createRuntimeReactSessionFixture({
      mutateBundle(bundle) {
        rootNode(bundle).when = { op: "eq", args: [1, 2] };
      },
    });
    const created = createRuntimeReactAdapterRegistry({ components: [] });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    expect(renderFixture(empty, created.handle)).toMatchObject({
      status: "rendered",
      surface: { nodeCount: 0, behaviorCount: 0 },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        session: empty.session,
        snapshot: empty.snapshot,
        catalogSet: foreign.catalogSet,
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "INVALID_CATALOG_SET" },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        session: empty.session,
        snapshot: foreign.snapshot,
        catalogSet: empty.catalogSet,
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "INVALID_SESSION_SNAPSHOT" },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        session: empty.session,
        snapshot: cloneJson(empty.snapshot) as typeof empty.snapshot,
        catalogSet: empty.catalogSet,
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "INVALID_SESSION_SNAPSHOT" },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        session: Object.freeze({}) as RuntimeHeadlessSessionHandle,
        snapshot: empty.snapshot,
        catalogSet: empty.catalogSet,
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "INVALID_SESSION" },
    });
  });

  it("accepts no raw plan field or reconstructed authority at runtime", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const registry = createObservingRegistry(observations);
    const rawPlanInput = {
      registry,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
      plan: fixture.snapshot.plan,
    };

    expect(
      renderRuntimeReactSurface(rawPlanInput as unknown as RuntimeReactRenderInput),
    ).toMatchObject({
      status: "failed",
      failure: {
        code: "MALFORMED_RENDER_PLAN",
        channel: null,
        diagnostics: [],
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("delivers complete validated component props without applying schema defaults", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({
        payload: Object.freeze({
          $ref: "state.secret",
          $token: "brand.secret",
          $format: Object.freeze({ name: "uppercase" }),
        }),
      }),
      mutateCatalog(catalog) {
        const schema = propsSchema(catalogCapability(catalog, STACK_ID));
        const properties = schema.properties as MutableJsonRecord;
        properties.payload = { type: "object" };
      },
      mutateBundle(bundle) {
        const props = rootNode(bundle).props as MutableJsonRecord;
        delete props.gap;
        props.payload = { $ref: "context.payload" };
      },
    });
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createObservingRegistry(observations));
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    renderToStaticMarkup(result.surface.element);

    const stack = observations.components.find(
      ({ identity }) => identity.capabilityId === STACK_ID,
    );
    expect(stack).toBeDefined();
    expect(Object.hasOwn(stack?.props ?? {}, "gap")).toBe(false);
    expect(stack?.props.payload).toEqual({
      $ref: "state.secret",
      $token: "brand.secret",
      $format: { name: "uppercase" },
    });
    expect(Object.isFrozen(stack?.props.payload)).toBe(true);
  });

  it("rejects dynamically resolved component props with exact frozen diagnostics and identity", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ width: -1 }),
      mutateBundle(bundle) {
        const props = rootNode(bundle).props as MutableJsonRecord;
        props.maxWidth = { $ref: "context.width" };
      },
    });
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createObservingRegistry(observations));

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_COMPONENT_PROPS",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: "props",
        diagnostics: [
          {
            code: "PROP_TYPE_MISMATCH",
            pointer: "/maxWidth",
            context: { capabilityId: STACK_ID },
          },
        ],
      },
    });
    expect(observations.components).toEqual([]);
    if (result.status !== "failed") return;
    expect(Object.isFrozen(result.failure)).toBe(true);
    expect(Object.isFrozen(result.failure.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.failure.diagnostics[0])).toBe(true);
  });

  it("validates behavior props independently before either behavior or owner delivery", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ axis: "diagonal" }),
      mutateBundle(bundle) {
        rootNode(bundle).behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: { axis: { $ref: "context.axis" } },
          },
        ];
      },
    });
    const missingBehaviorObservations: AdapterObservations = {
      components: [],
      behaviors: [],
    };
    expect(
      renderFixture(fixture, createObservingRegistry(missingBehaviorObservations)),
    ).toMatchObject({
      status: "failed",
      failure: {
        code: "UNKNOWN_BEHAVIOR_CAPABILITY",
        sourceNodeId: "sign-in.layout",
        capabilityId: SORTABLE_ID,
      },
    });
    expect(missingBehaviorObservations.components).toEqual([]);

    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(
      fixture,
      createObservingRegistry(observations, { behavior: true }),
    );

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_BEHAVIOR_PROPS",
        sourceNodeId: "sign-in.layout",
        capabilityId: SORTABLE_ID,
        channel: "props",
        diagnostics: [{ code: "PROP_TYPE_MISMATCH", pointer: "/axis" }],
      },
    });
    expect(observations.components).toEqual([]);
    expect(observations.behaviors).toEqual([]);
  });

  it("projects multiple component and behavior slots in exact plan order without raw behavior data", () => {
    const fixture = createRuntimeReactSessionFixture({
      mutateCatalog(catalog) {
        const stack = catalogCapability(catalog, STACK_ID);
        const existing = stack.slots as MutableJsonRecord;
        stack.slots = {
          status: {
            required: false,
            minItems: 0,
            maxItems: 1,
            accepts: [TEXT_ID],
          },
          default: existing.default,
        };
      },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.slots = {
          status: [
            {
              id: "sign-in.status",
              use: TEXT_ID,
              props: { text: "Ready", role: "caption" },
            },
          ],
          default: [
            {
              id: "sign-in.first",
              use: TEXT_ID,
              props: { text: "First" },
            },
            {
              id: "sign-in.second",
              use: TEXT_ID,
              props: { text: "Second" },
            },
          ],
        };
        root.behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: { axis: "vertical" },
            slots: {
              dragPreview: [
                {
                  id: "sign-in.preview",
                  use: TEXT_ID,
                  props: { text: "Preview" },
                },
              ],
            },
          },
        ];
      },
    });
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(
      fixture,
      createObservingRegistry(observations, { behavior: true }),
    );
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    const html = renderToStaticMarkup(result.surface.element);

    const stack = observations.components.find(
      ({ identity }) => identity.capabilityId === STACK_ID,
    );
    const sortable = observations.behaviors[0];
    expect(Object.keys(stack?.slots ?? {})).toEqual(["default", "status"]);
    expect(Object.keys(sortable?.slots ?? {})).toEqual(["dragPreview"]);
    expect(Object.isFrozen(stack?.slots)).toBe(true);
    expect(Object.isFrozen(stack?.slots.default)).toBe(true);
    expect(Object.isFrozen(sortable?.slots.dragPreview)).toBe(true);
    expect(Object.hasOwn(stack ?? {}, "behaviors")).toBe(false);
    expect(html.indexOf(">First</span>")).toBeLessThan(html.indexOf(">Second</span>"));
    expect(html).toContain(">Ready</span>");
    expect(html).toContain(">Preview</span>");
  });

  it("rejects component and behavior slots emptied below their runtime cardinality", () => {
    const componentFixture = createRuntimeReactSessionFixture({
      mutateCatalog(catalog) {
        const stack = catalogCapability(catalog, STACK_ID);
        stack.slots = {
          ...(stack.slots as MutableJsonRecord),
          status: {
            required: false,
            minItems: 1,
            maxItems: 1,
            accepts: [TEXT_ID],
          },
        };
      },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.slots = {
          ...(root.slots as MutableJsonRecord),
          status: [
            {
              id: "sign-in.hidden-status",
              use: TEXT_ID,
              when: { op: "eq", args: [1, 2] },
              props: { text: "Hidden" },
            },
          ],
        };
      },
    });
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(componentFixture, createObservingRegistry(observations));

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_COMPONENT_SLOTS",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: "slots",
        diagnostics: [{ code: "SLOT_CARDINALITY", pointer: "/status" }],
      },
    });
    expect(observations.components).toEqual([]);

    const behaviorFixture = createRuntimeReactSessionFixture({
      mutateCatalog(catalog) {
        const behaviors = catalog.behaviors as MutableJsonRecord;
        const sortable = behaviors[SORTABLE_ID] as MutableJsonRecord;
        const slots = sortable.slots as MutableJsonRecord;
        slots.dragPreview = {
          ...(slots.dragPreview as MutableJsonRecord),
          minItems: 1,
        };
      },
      mutateBundle(bundle) {
        rootNode(bundle).behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: { axis: "vertical" },
            slots: {
              dragPreview: [
                {
                  id: "sign-in.hidden-preview",
                  use: TEXT_ID,
                  when: { op: "eq", args: [1, 2] },
                  props: { text: "Hidden" },
                },
              ],
            },
          },
        ];
      },
    });
    const behaviorResult = renderFixture(
      behaviorFixture,
      createObservingRegistry(observations, { behavior: true }),
    );
    expect(behaviorResult).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_BEHAVIOR_SLOTS",
        sourceNodeId: "sign-in.layout",
        capabilityId: SORTABLE_ID,
        channel: "slots",
        diagnostics: [{ code: "SLOT_CARDINALITY", pointer: "/dragPreview" }],
      },
    });
    expect(observations.behaviors).toEqual([]);
  });

  it("preflights a deep invalid child all-or-nothing before any adapter executes", () => {
    const fixture = createRuntimeReactSessionFixture({
      context: Object.freeze({ invalidText: 42 }),
      mutateBundle(bundle) {
        const child = firstDefaultChild(bundle);
        child.props = {
          ...(child.props as MutableJsonRecord),
          text: { $ref: "context.invalidText" },
        };
      },
    });
    const Component = vi.fn(({ slots }: RuntimeReactComponentAdapterProps) => (
      <Fragment>{slots.default}</Fragment>
    ));
    const created = createRuntimeReactAdapterRegistry({
      components: [
        { capabilityId: STACK_ID, component: Component },
        { capabilityId: TEXT_ID, component: Component },
        { capabilityId: TEXT_FIELD_ID, component: Component },
        { capabilityId: BUTTON_ID, component: Component },
      ],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const result = renderFixture(fixture, created.handle);

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_COMPONENT_PROPS",
        sourceNodeId: "sign-in.title",
        capabilityId: TEXT_ID,
        channel: "props",
      },
    });
    expect(result).not.toHaveProperty("surface");
    expect(Component).not.toHaveBeenCalled();
  });

  it("shares aggregate receiving budgets across every component and behavior in one render", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createObservingRegistry(observations), {
      maxPropValidations: 4,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
        sourceNodeId: "sign-in.submit",
        capabilityId: BUTTON_ID,
        channel: "props",
        diagnostics: [{ code: ADAPTER_LIMIT_CODE, pointer: "" }],
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("forwards the lower-only shared slot-contract work ceiling", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const result = renderFixture(fixture, createObservingRegistry(observations), {
      maxSlotContractEvaluationSteps: 0,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "RECEIVING_VALIDATION_LIMIT_EXCEEDED",
        sourceNodeId: "sign-in.layout",
        capabilityId: STACK_ID,
        channel: "slots",
        diagnostics: [{ code: ADAPTER_LIMIT_CODE, pointer: "" }],
      },
    });
    expect(observations.components).toEqual([]);
  });

  it("rejects hostile validation limits without getter execution or partial delivery", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const registry = createObservingRegistry(observations);
    let getterCalls = 0;
    const limits = Object.defineProperty({}, "maxPropValidations", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 1;
      },
    });
    const result = renderRuntimeReactSurface({
      registry,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
      limits,
    });

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "MALFORMED_RENDER_PLAN",
        channel: null,
        diagnostics: [],
      },
    });
    expect(getterCalls).toBe(0);
    expect(observations.components).toEqual([]);
  });

  it("authenticates after hostile limit reflection performs reentrant session disposal", () => {
    const fixture = createRuntimeReactSessionFixture();
    const observations: AdapterObservations = { components: [], behaviors: [] };
    const registry = createObservingRegistry(observations);
    let reflectionCalls = 0;
    const limits = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflectionCalls += 1;
          disposeRuntimeHeadlessSession(fixture.session);
          return Object.prototype;
        },
      },
    );

    expect(
      renderRuntimeReactSurface({
        registry,
        session: fixture.session,
        snapshot: fixture.snapshot,
        catalogSet: fixture.catalogSet,
        limits,
      }),
    ).toMatchObject({
      status: "failed",
      failure: {
        code: "INVALID_SESSION",
        channel: null,
        diagnostics: [],
      },
    });
    expect(reflectionCalls).toBe(1);
    expect(observations.components).toEqual([]);
  });
});
