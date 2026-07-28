// @vitest-environment jsdom

import { useEffect, useState } from "react";
import { cleanup, render } from "@testing-library/react";
import { disposeRuntimeHeadlessSession } from "@desen/runtime-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  createRuntimeReactAdapterRegistry,
  createRuntimeReactReconciliationKey,
  renderRuntimeReactSurface,
} from "../src/index.js";
import {
  catalogComponents,
  createReactiveRuntimeReactSessionFixture as mountReactiveRuntimeReactSessionFixture,
  createRuntimeReactSessionFixture as mountRuntimeReactSessionFixture,
  rootNode,
} from "./session-fixture.js";

import type { ReactElement } from "react";
import type { RuntimeHeadlessSessionSnapshot } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactComponentAdapterProps,
} from "../src/index.js";
import type {
  MutableJsonRecord,
  ReactiveRuntimeReactSessionFixture,
  RuntimeReactSessionFixture,
  RuntimeReactSessionFixtureOptions,
} from "./session-fixture.js";

const STACK_ID = "com.example.ui/Stack";
const ALTERNATE_STACK_ID = "com.example.ui/AlternateStack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const ALERT_ID = "com.example.ui/Alert";
const SORTABLE_ID = "com.example.interactions/Sortable";
const fixtureDisposers: (() => void)[] = [];

interface LifecycleTracker {
  readonly mounts: string[];
  readonly unmounts: string[];
}

interface StatefulAdapters {
  readonly Component: (props: RuntimeReactComponentAdapterProps) => ReactElement;
  readonly Behavior: (props: RuntimeReactBehaviorAdapterProps) => ReactElement;
  readonly tracker: LifecycleTracker;
}

interface DomElement {
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
  closest(selector: string): DomElement | null;
}

interface DomContainer {
  querySelector(selector: string): DomElement | null;
  querySelectorAll(selector: string): readonly DomElement[];
}

function createStatefulAdapters(): StatefulAdapters {
  let nextInstance = 0;
  const tracker: LifecycleTracker = { mounts: [], unmounts: [] };

  function Component(props: RuntimeReactComponentAdapterProps): ReactElement {
    const [instance] = useState(() => `component:${String(++nextInstance)}`);
    useEffect(() => {
      const observation = `${props.identity.sourceNodeId}:${instance}`;
      tracker.mounts.push(observation);
      return () => {
        tracker.unmounts.push(observation);
      };
    }, [instance, props.identity.sourceNodeId]);
    return (
      <section
        data-capability={props.identity.capabilityId}
        data-instance={instance}
        data-source-node={props.identity.sourceNodeId}
      >
        {typeof props.props.text === "string" ? (
          <span data-repeated-label={props.props.text}>{props.props.text}</span>
        ) : null}
        {props.slots.default}
      </section>
    );
  }

  function Behavior(props: RuntimeReactBehaviorAdapterProps): ReactElement {
    const [instance] = useState(() => `behavior:${String(++nextInstance)}`);
    useEffect(() => {
      const observation = `${props.behaviorId}:${instance}`;
      tracker.mounts.push(observation);
      return () => {
        tracker.unmounts.push(observation);
      };
    }, [instance, props.behaviorId]);
    return (
      <div
        data-behavior-id={props.behaviorId}
        data-capability={props.identity.capabilityId}
        data-instance={instance}
      >
        {props.children}
      </div>
    );
  }

  return { Component, Behavior, tracker };
}

function registry(
  adapters: StatefulAdapters,
  options: {
    readonly stackRemountOnProps?: readonly string[];
    readonly behaviorRemountOnProps?: readonly string[];
    readonly includeBehavior?: boolean;
  } = {},
): RuntimeReactAdapterRegistryHandle {
  const created = createRuntimeReactAdapterRegistry({
    components: [
      {
        capabilityId: STACK_ID,
        component: adapters.Component,
        ...(options.stackRemountOnProps === undefined
          ? {}
          : { remountOnProps: options.stackRemountOnProps }),
      },
      {
        capabilityId: TEXT_ID,
        component: adapters.Component,
      },
      {
        capabilityId: TEXT_FIELD_ID,
        component: adapters.Component,
      },
      {
        capabilityId: BUTTON_ID,
        component: adapters.Component,
      },
      {
        capabilityId: ALERT_ID,
        component: adapters.Component,
      },
    ],
    ...(options.includeBehavior
      ? {
          behaviors: [
            {
              capabilityId: SORTABLE_ID,
              component: adapters.Behavior,
              ...(options.behaviorRemountOnProps === undefined
                ? {}
                : { remountOnProps: options.behaviorRemountOnProps }),
            },
          ],
        }
      : {}),
  });
  if (created.status !== "created") throw new TypeError("Expected reconciliation test registry.");
  return created.handle;
}

function compile(
  fixture: RuntimeReactSessionFixture,
  adapterRegistry: RuntimeReactAdapterRegistryHandle,
  snapshot: RuntimeHeadlessSessionSnapshot = fixture.snapshot,
): ReactElement {
  const result = renderRuntimeReactSurface({
    registry: adapterRegistry,
    session: fixture.session,
    snapshot,
    catalogSet: fixture.catalogSet,
  });
  if (result.status !== "rendered") {
    throw new TypeError(
      `Expected a rendered reconciliation surface: ${JSON.stringify(result.failure)}`,
    );
  }
  return result.surface.element;
}

function componentInstance(container: unknown, sourceNodeId: string): string {
  const element = (container as DomContainer).querySelector(`[data-source-node="${sourceNodeId}"]`);
  const instance = element?.getAttribute("data-instance");
  if (instance === null || instance === undefined) {
    throw new TypeError(`Missing component instance for ${sourceNodeId}.`);
  }
  return instance;
}

function behaviorInstance(container: unknown, behaviorId: string): string {
  const element = (container as DomContainer).querySelector(`[data-behavior-id="${behaviorId}"]`);
  const instance = element?.getAttribute("data-instance");
  if (instance === null || instance === undefined) {
    throw new TypeError(`Missing behavior instance for ${behaviorId}.`);
  }
  return instance;
}

function runtimeId(
  fixture: RuntimeReactSessionFixture,
  sourceNodeId: string,
  snapshot: RuntimeHeadlessSessionSnapshot = fixture.snapshot,
): string {
  const binding = snapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === sourceNodeId,
  );
  if (binding === undefined) throw new TypeError(`Missing runtime binding for ${sourceNodeId}.`);
  return binding.runtimeInstanceId;
}

function extendStackPropSchema(
  catalog: MutableJsonRecord,
  name: string,
  schema: MutableJsonRecord,
): void {
  const stack = catalogComponents(catalog)[STACK_ID] as MutableJsonRecord;
  const propsSchema = stack.propsSchema as MutableJsonRecord;
  const properties = propsSchema.properties as MutableJsonRecord;
  properties[name] = schema;
}

function createRuntimeReactSessionFixture(
  options: RuntimeReactSessionFixtureOptions = {},
): RuntimeReactSessionFixture {
  const fixture = mountRuntimeReactSessionFixture(options);
  fixtureDisposers.push(() => {
    disposeRuntimeHeadlessSession(fixture.session);
  });
  return fixture;
}

function createReactiveRuntimeReactSessionFixture(
  options: RuntimeReactSessionFixtureOptions = {},
): ReactiveRuntimeReactSessionFixture {
  const fixture = mountReactiveRuntimeReactSessionFixture(options);
  fixtureDisposers.push(fixture.dispose);
  return fixture;
}

afterEach(() => {
  cleanup();
  for (const dispose of fixtureDisposers.splice(0).reverse()) dispose();
});

describe("rendered React reconciliation", () => {
  it("preserves a real component instance across same-session ordinary prop, style, and slot publications", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: {
        direction: "vertical",
        padding: 4,
        showExtra: false,
      },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.props = {
          direction: { $ref: "context.direction" },
          gap: "lg",
          maxWidth: 640,
        };
        root.style = {
          base: { root: { padding: { $ref: "context.padding" } } },
        };
        const slots = root.slots as MutableJsonRecord;
        const children = slots.default as MutableJsonRecord[];
        children.push({
          id: "sign-in.extra",
          use: TEXT_ID,
          when: {
            op: "truthy",
            args: [{ $ref: "context.showExtra" }],
          },
          props: { text: "Extra slot child", role: "caption" },
        });
      },
    });
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters);
    const view = render(compile(fixture, adapterRegistry));
    const initialInstance = componentInstance(view.container, "sign-in.layout");
    const successor = await fixture.publishContext({
      direction: "horizontal",
      padding: 12,
      showExtra: true,
    });

    expect(runtimeId(fixture, "sign-in.layout", successor)).toBe(
      runtimeId(fixture, "sign-in.layout"),
    );
    view.rerender(compile(fixture, adapterRegistry, successor));

    expect(componentInstance(view.container, "sign-in.layout")).toBe(initialInstance);
    expect(view.getByText("Extra slot child")).toBeDefined();
    expect(
      adapters.tracker.mounts.filter((entry) => entry.startsWith("sign-in.layout:")),
    ).toHaveLength(1);
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.layout:")),
    ).toHaveLength(0);
  });

  it("remounts on same-session declared prop presence and value publications, including missing versus null", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: {},
      mutateCatalog(catalog) {
        extendStackPropSchema(catalog, "reconcileMarker", {
          type: ["string", "null"],
        });
      },
      mutateBundle(bundle) {
        rootNode(bundle).props = {
          ...(rootNode(bundle).props as MutableJsonRecord),
          reconcileMarker: { $ref: "context.marker" },
        };
      },
    });
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters, {
      stackRemountOnProps: ["reconcileMarker"],
    });
    const view = render(compile(fixture, adapterRegistry));
    const missingInstance = componentInstance(view.container, "sign-in.layout");

    const presentNull = await fixture.publishContext({ marker: null });
    view.rerender(compile(fixture, adapterRegistry, presentNull));
    const nullInstance = componentInstance(view.container, "sign-in.layout");
    const presentValue = await fixture.publishContext({ marker: "fresh" });
    view.rerender(compile(fixture, adapterRegistry, presentValue));
    const valueInstance = componentInstance(view.container, "sign-in.layout");

    expect(nullInstance).not.toBe(missingInstance);
    expect(valueInstance).not.toBe(nullInstance);
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.layout:")),
    ).toHaveLength(2);
  });

  it("preserves an instance when a same-session declared object publication changes only semantic key order", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: {
        config: { zeta: 1, alpha: true },
        direction: "vertical",
      },
      mutateCatalog(catalog) {
        extendStackPropSchema(catalog, "reconcileConfig", {
          type: "object",
          additionalProperties: false,
          required: ["alpha", "zeta"],
          properties: {
            alpha: { type: "boolean" },
            zeta: { type: "number" },
          },
        });
      },
      mutateBundle(bundle) {
        rootNode(bundle).props = {
          ...(rootNode(bundle).props as MutableJsonRecord),
          direction: { $ref: "context.direction" },
          reconcileConfig: { $ref: "context.config" },
        };
      },
    });
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters, {
      stackRemountOnProps: ["reconcileConfig"],
    });
    const view = render(compile(fixture, adapterRegistry));
    const initialInstance = componentInstance(view.container, "sign-in.layout");
    const successor = await fixture.publishContext({
      config: { alpha: true, zeta: 1 },
      direction: "horizontal",
    });

    view.rerender(compile(fixture, adapterRegistry, successor));

    expect(componentInstance(view.container, "sign-in.layout")).toBe(initialInstance);
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.layout:")),
    ).toHaveLength(0);
  });

  it("uses the capability-sensitive canonical key to remount one adapter component function", () => {
    let nextInstance = 0;
    const unmounts: string[] = [];
    function CapabilityAdapter({ capabilityId }: { readonly capabilityId: string }): ReactElement {
      const [instance] = useState(() => `capability:${String(++nextInstance)}`);
      useEffect(
        () => () => {
          unmounts.push(instance);
        },
        [instance],
      );
      return (
        <output data-capability={capabilityId} data-instance={instance}>
          {capabilityId}
        </output>
      );
    }
    const reconciliationKey = (capabilityId: string): string =>
      createRuntimeReactReconciliationKey({
        runtimeNodeId: "stable-runtime-node",
        capabilityId,
        props: {},
        remountOnProps: [],
      });
    const firstKey = reconciliationKey(STACK_ID);
    const secondKey = reconciliationKey(ALTERNATE_STACK_ID);
    expect(secondKey).not.toBe(firstKey);
    const view = render(<CapabilityAdapter key={firstKey} capabilityId={STACK_ID} />);
    const container = view.container as unknown as DomContainer;
    const initialInstance = container
      .querySelector("[data-instance]")
      ?.getAttribute("data-instance");

    view.rerender(<CapabilityAdapter key={secondKey} capabilityId={ALTERNATE_STACK_ID} />);

    expect(container.querySelector("[data-instance]")?.getAttribute("data-instance")).not.toBe(
      initialInstance,
    );
    expect(container.querySelector("[data-capability]")?.getAttribute("data-capability")).toBe(
      ALTERNATE_STACK_ID,
    );
    expect(unmounts).toEqual([initialInstance]);
  });

  it("remounts identical runtime identities at the boundary between two distinct sessions", () => {
    const first = createRuntimeReactSessionFixture();
    const second = createRuntimeReactSessionFixture();
    expect(runtimeId(first, "sign-in.layout")).toBe(runtimeId(second, "sign-in.layout"));
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters);
    const view = render(compile(first, adapterRegistry));
    const initialInstance = componentInstance(view.container, "sign-in.layout");

    view.rerender(compile(second, adapterRegistry));

    expect(componentInstance(view.container, "sign-in.layout")).not.toBe(initialInstance);
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.layout:")),
    ).toHaveLength(1);
  });

  it("applies the same same-session ordinary-change and declared-remount policy to behavior wrappers", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: { axis: "vertical" },
      mutateBundle(bundle) {
        rootNode(bundle).behaviors = [
          {
            id: "sign-in.sortable",
            use: SORTABLE_ID,
            props: {
              axis: { $ref: "context.axis" },
              handle: { $ref: "context.handle" },
            },
          },
        ];
      },
    });
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters, {
      includeBehavior: true,
      behaviorRemountOnProps: ["handle"],
    });
    const view = render(compile(fixture, adapterRegistry));
    const initialInstance = behaviorInstance(view.container, "sign-in.sortable");

    const ordinaryChange = await fixture.publishContext({ axis: "horizontal" });
    view.rerender(compile(fixture, adapterRegistry, ordinaryChange));
    expect(behaviorInstance(view.container, "sign-in.sortable")).toBe(initialInstance);
    const declaredChange = await fixture.publishContext({
      axis: "horizontal",
      handle: "item",
    });
    view.rerender(compile(fixture, adapterRegistry, declaredChange));
    expect(behaviorInstance(view.container, "sign-in.sortable")).not.toBe(initialInstance);
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.sortable:")),
    ).toHaveLength(1);
  });

  it("preserves same-session repeated sibling instances through reorder and unmounts only a removed key", async () => {
    const alpha = { id: "alpha", title: "Alpha" };
    const beta = { id: "beta", title: "Beta" };
    const gamma = { id: "gamma", title: "Gamma" };
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: { items: [alpha, beta, gamma] },
      mutateBundle(bundle) {
        const root = rootNode(bundle);
        root.slots = {
          default: [
            {
              id: "sign-in.repeated",
              use: TEXT_ID,
              repeat: {
                items: { $ref: "context.items" },
                as: "item",
                key: { $ref: "item.item.id" },
              },
              props: {
                text: { $ref: "item.item.title" },
                role: "body",
              },
            },
          ],
        };
      },
    });
    const adapters = createStatefulAdapters();
    const adapterRegistry = registry(adapters);
    const view = render(compile(fixture, adapterRegistry));
    const instances = (): Readonly<Record<string, string>> =>
      Object.fromEntries(
        [
          ...(view.container as unknown as DomContainer).querySelectorAll("[data-repeated-label]"),
        ].map((label) => {
          const owner = label.closest("[data-instance]");
          const instance = owner?.getAttribute("data-instance");
          if (instance === null || instance === undefined) {
            throw new TypeError("Missing repeated component instance.");
          }
          return [label.textContent ?? "", instance];
        }),
      );
    const initialInstances = instances();

    const reordered = await fixture.publishContext({ items: [gamma, alpha, beta] });
    view.rerender(compile(fixture, adapterRegistry, reordered));
    expect(instances()).toEqual(initialInstances);
    const removed = await fixture.publishContext({ items: [gamma, alpha] });
    view.rerender(compile(fixture, adapterRegistry, removed));

    expect(instances()).toEqual({
      Alpha: initialInstances.Alpha,
      Gamma: initialInstances.Gamma,
    });
    expect(
      adapters.tracker.unmounts.filter((entry) => entry.startsWith("sign-in.repeated:")),
    ).toHaveLength(1);
  });
});
