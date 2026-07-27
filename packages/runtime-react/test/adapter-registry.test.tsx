import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeReactAdapterRegistry,
  readRuntimeReactAdapterRegistry,
  renderRuntimeReactSurface,
} from "../src/index.js";

import type { RuntimeHeadlessNodePlan, RuntimeHeadlessSurfacePlan } from "@desen/runtime-core";
import type {
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactComponentAdapterProps,
} from "../src/index.js";

const BOX_ID = "run.desen.test/Box";
const TEXT_ID = "run.desen.test/Text";
const EMPHASIS_ID = "run.desen.test/Emphasis";
const ACCENT_ID = "run.desen.test/Accent";

function Box({ identity, slots }: RuntimeReactComponentAdapterProps) {
  return (
    <section data-runtime-node={identity.runtimeNodeId} data-source-node={identity.sourceNodeId}>
      {slots.default}
      {slots.status}
    </section>
  );
}

function Text({ identity, props }: RuntimeReactComponentAdapterProps) {
  return <p data-source-node={identity.sourceNodeId}>{String(props.text ?? "")}</p>;
}

function Emphasis({ behaviorId, children }: RuntimeReactBehaviorAdapterProps) {
  return <strong data-behavior={behaviorId}>{children}</strong>;
}

function Accent({ behaviorId, children }: RuntimeReactBehaviorAdapterProps) {
  return <mark data-behavior={behaviorId}>{children}</mark>;
}

function node(
  identity: string,
  use: string,
  options: Partial<
    Pick<RuntimeHeadlessNodePlan, "sourceNodeId" | "props" | "style" | "slots" | "behaviors">
  > = {},
): RuntimeHeadlessNodePlan {
  return Object.freeze({
    identity,
    sourceNodeId: options.sourceNodeId ?? identity,
    use,
    props: options.props ?? Object.freeze({}),
    style: options.style ?? Object.freeze({}),
    slots: options.slots ?? Object.freeze({}),
    behaviors: options.behaviors ?? Object.freeze([]),
  });
}

function plan(root: readonly RuntimeHeadlessNodePlan[]): RuntimeHeadlessSurfacePlan {
  return Object.freeze({
    documentId: "run.desen.test.document",
    surfaceId: "main",
    root: Object.freeze([...root]),
  });
}

function registry() {
  const result = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: BOX_ID, component: Box },
      { capabilityId: TEXT_ID, component: Text },
    ],
    behaviors: [{ capabilityId: EMPHASIS_ID, component: Emphasis }],
  });
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("registry setup failed");
  return result;
}

describe("React adapter registry and render-plan renderer", () => {
  it("captures exact static adapters without invoking or exposing them", () => {
    const Component = vi.fn(() => null);
    const created = createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: TEXT_ID, component: Component }],
    });

    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    expect(Component).not.toHaveBeenCalled();
    expect(created.snapshot).toEqual({
      componentCapabilityIds: [TEXT_ID],
      behaviorCapabilityIds: [],
    });
    expect(Object.isFrozen(created.snapshot)).toBe(true);
    expect(JSON.stringify(created.snapshot)).not.toContain("function");
    expect(created.snapshot).not.toHaveProperty("components");
    expect(readRuntimeReactAdapterRegistry(created.handle)).toEqual({
      status: "read",
      snapshot: created.snapshot,
    });
  });

  it("renders an ordinary root and descendants only through exact registry lookup", () => {
    const created = registry();
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([
        node("layout", BOX_ID, {
          slots: Object.freeze({
            default: Object.freeze([
              node("first", TEXT_ID, { props: Object.freeze({ text: "First" }) }),
              node("second", TEXT_ID, { props: Object.freeze({ text: "Second" }) }),
            ]),
          }),
        }),
      ]),
    });

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    const html = renderToStaticMarkup(result.surface.element);
    expect(result.surface.nodeCount).toBe(3);
    expect(html).toContain('<section data-runtime-node="layout" data-source-node="layout">');
    expect(html.indexOf(">First</p>")).toBeLessThan(html.indexOf(">Second</p>"));
  });

  it("treats every named slot, including status, as public plan data", () => {
    const created = registry();
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([
        node("layout", BOX_ID, {
          slots: Object.freeze({
            status: Object.freeze([
              node("status-message", TEXT_ID, {
                props: Object.freeze({ text: "Ready" }),
              }),
            ]),
          }),
        }),
      ]),
    });

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    expect(renderToStaticMarkup(result.surface.element)).toContain(">Ready</p>");
  });

  it("preflights the complete tree before any adapter executes", () => {
    const calls: string[] = [];
    const Counting = ({ identity }: RuntimeReactComponentAdapterProps) => {
      calls.push(identity.runtimeNodeId);
      return null;
    };
    const created = createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: BOX_ID, component: Counting }],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([
        node("known", BOX_ID, {
          slots: Object.freeze({
            default: Object.freeze([node("deep-unknown", "run.desen.test/Missing")]),
          }),
        }),
      ]),
    });

    expect(result).toEqual({
      status: "failed",
      failure: {
        code: "UNKNOWN_COMPONENT_CAPABILITY",
        runtimeNodeId: "deep-unknown",
        sourceNodeId: "deep-unknown",
        capabilityId: "run.desen.test/Missing",
      },
    });
    expect(calls).toEqual([]);
  });

  it("wraps an owner through exact behavior registration in source order", () => {
    const created = createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: TEXT_ID, component: Text }],
      behaviors: [
        { capabilityId: EMPHASIS_ID, component: Emphasis },
        { capabilityId: ACCENT_ID, component: Accent },
      ],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([
        node("message", TEXT_ID, {
          props: Object.freeze({ text: "Important" }),
          behaviors: Object.freeze([
            Object.freeze({
              identity: "message/emphasis",
              id: "emphasis",
              use: EMPHASIS_ID,
              props: Object.freeze({}),
              style: Object.freeze({}),
              slots: Object.freeze({}),
            }),
            Object.freeze({
              identity: "message/accent",
              id: "accent",
              use: ACCENT_ID,
              props: Object.freeze({}),
              style: Object.freeze({}),
              slots: Object.freeze({}),
            }),
          ]),
        }),
      ]),
    });

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    const html = renderToStaticMarkup(result.surface.element);
    expect(html).toContain('<strong data-behavior="emphasis"><mark data-behavior="accent">');
    expect(html).toContain(">Important</p>");
  });

  it("rejects duplicates, malformed registrations, and forged handles without fallback", () => {
    expect(
      createRuntimeReactAdapterRegistry({
        components: [
          { capabilityId: BOX_ID, component: Box },
          { capabilityId: BOX_ID, component: Text },
        ],
      }),
    ).toEqual({ status: "invalid", reason: "duplicate-capability" });
    expect(
      createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: "not-a-capability", component: Box }],
      }),
    ).toEqual({ status: "invalid", reason: "malformed-registration" });
    for (const capabilityId of [
      "foo_bar/Component",
      "a:b/Component",
      "ok.ns/9startsWithDigit",
      "ok.ns/Component/path",
    ]) {
      expect(
        createRuntimeReactAdapterRegistry({
          components: [{ capabilityId, component: Box }],
        }),
      ).toEqual({ status: "invalid", reason: "malformed-registration" });
    }
    const adversarialCapabilityId = `a${".a".repeat(40)}!`;
    const startedAt = Date.now();
    expect(
      createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: adversarialCapabilityId, component: Box }],
      }),
    ).toEqual({ status: "invalid", reason: "malformed-registration" });
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(
      createRuntimeReactAdapterRegistry({
        components: [
          {
            capabilityId: `${"a".repeat(50_000)}/Component`,
            component: Box,
          },
        ],
        limits: { maxIdentifierCodeUnits: 64 },
      }),
    ).toEqual({ status: "invalid", reason: "identifier-limit" });
    expect(
      readRuntimeReactAdapterRegistry(
        Object.freeze({}) as Parameters<typeof readRuntimeReactAdapterRegistry>[0],
      ),
    ).toEqual({ status: "invalid-handle" });
    expect(
      renderRuntimeReactSurface({
        registry: Object.freeze({}) as ReturnType<typeof registry>["handle"],
        plan: plan([]),
      }),
    ).toEqual({
      status: "failed",
      failure: {
        code: "INVALID_REGISTRY",
        runtimeNodeId: null,
        sourceNodeId: null,
        capabilityId: null,
      },
    });
  });

  it("rejects duplicate runtime identity and exact lower-only limit crossings", () => {
    const created = registry();
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([node("same", TEXT_ID), node("same", TEXT_ID)]),
      }),
    ).toEqual({
      status: "failed",
      failure: {
        code: "DUPLICATE_RUNTIME_IDENTITY",
        runtimeNodeId: "same",
        sourceNodeId: "same",
        capabilityId: TEXT_ID,
      },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([
          node("same", TEXT_ID, {
            behaviors: Object.freeze([
              Object.freeze({
                identity: "same",
                id: "emphasis",
                use: EMPHASIS_ID,
                props: Object.freeze({}),
                style: Object.freeze({}),
                slots: Object.freeze({}),
              }),
            ]),
          }),
        ]),
      }),
    ).toEqual({
      status: "failed",
      failure: {
        code: "DUPLICATE_RUNTIME_IDENTITY",
        runtimeNodeId: "same",
        sourceNodeId: "same",
        capabilityId: EMPHASIS_ID,
      },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([node("one", TEXT_ID), node("two", TEXT_ID)]),
        limits: { maxNodes: 1 },
      }),
    ).toEqual({
      status: "failed",
      failure: {
        code: "NODE_LIMIT_EXCEEDED",
        runtimeNodeId: "two",
        sourceNodeId: "two",
        capabilityId: TEXT_ID,
      },
    });

    const exactIdentifierLimit = createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: TEXT_ID, component: Text }],
      limits: { maxIdentifierCodeUnits: TEXT_ID.length },
    });
    expect(exactIdentifierLimit.status).toBe("created");
    expect(
      createRuntimeReactAdapterRegistry({
        components: [{ capabilityId: TEXT_ID, component: Text }],
        limits: { maxIdentifierCodeUnits: TEXT_ID.length - 1 },
      }),
    ).toEqual({ status: "invalid", reason: "identifier-limit" });

    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([
          node("parent", BOX_ID, {
            slots: Object.freeze({
              default: Object.freeze([node("child", TEXT_ID)]),
            }),
          }),
        ]),
        limits: { maxDepth: 0 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "DEPTH_LIMIT_EXCEEDED" },
    });

    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([
          node("owner", TEXT_ID, {
            behaviors: Object.freeze([
              Object.freeze({
                identity: "owner/emphasis",
                id: "emphasis",
                use: EMPHASIS_ID,
                props: Object.freeze({}),
                style: Object.freeze({}),
                slots: Object.freeze({}),
              }),
            ]),
          }),
        ]),
        limits: { maxBehaviors: 0 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "BEHAVIOR_LIMIT_EXCEEDED" },
    });

    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([
          node("slots", BOX_ID, {
            slots: Object.freeze({
              first: Object.freeze([]),
              second: Object.freeze([]),
            }),
          }),
        ]),
        limits: { maxSlotEntries: 1 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "SLOT_LIMIT_EXCEEDED" },
    });
  });

  it("detaches and freezes public JSON before an adapter can observe it", () => {
    const seen: RuntimeReactComponentAdapterProps[] = [];
    const Snapshot = (props: RuntimeReactComponentAdapterProps) => {
      seen.push(props);
      return <p>{String(props.props.text)}</p>;
    };
    const created = createRuntimeReactAdapterRegistry({
      components: [{ capabilityId: TEXT_ID, component: Snapshot }],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const inputProps = { text: "before", nested: { stable: true } };
    const inputStyle = { base: { root: { color: "blue" } } };
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([node("snapshot", TEXT_ID, { props: inputProps, style: inputStyle })]),
    });
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;

    inputProps.text = "after";
    inputProps.nested.stable = false;
    inputStyle.base.root.color = "red";
    expect(renderToStaticMarkup(result.surface.element)).toContain(">before</p>");
    expect(seen).toHaveLength(1);
    expect(seen[0]?.props).not.toBe(inputProps);
    expect(seen[0]?.style).not.toBe(inputStyle);
    expect(Object.isFrozen(seen[0]?.props)).toBe(true);
    expect(Object.isFrozen(seen[0]?.props.nested)).toBe(true);
    expect(Object.isFrozen(seen[0]?.style)).toBe(true);
  });

  it("does not inspect accessors or hostile proxies and returns no placeholder element", () => {
    let getterCalls = 0;
    const hostilePlan = Object.defineProperty({}, "documentId", {
      get() {
        getterCalls += 1;
        return "forged";
      },
    });
    const created = registry();
    const accessorRoots: RuntimeHeadlessNodePlan[] = [];
    Object.defineProperty(accessorRoots, "0", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return node("forged", TEXT_ID);
      },
    });
    accessorRoots.length = 1;
    const accessorResult = renderRuntimeReactSurface({
      registry: created.handle,
      plan: hostilePlan as RuntimeHeadlessSurfacePlan,
    });
    const accessorArrayResult = renderRuntimeReactSurface({
      registry: created.handle,
      plan: {
        documentId: "run.desen.test.document",
        surfaceId: "main",
        root: accessorRoots,
      },
    });
    const proxyResult = renderRuntimeReactSurface({
      registry: created.handle,
      plan: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("hostile reflection");
          },
        },
      ) as RuntimeHeadlessSurfacePlan,
    });
    const accessorProps = Object.defineProperty({}, "text", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "forged";
      },
    });
    const accessorPropsResult = renderRuntimeReactSurface({
      registry: created.handle,
      plan: plan([
        node("accessor-props", TEXT_ID, {
          props: accessorProps,
        }),
      ]),
    });
    const revokedPlan = Proxy.revocable({}, {});
    revokedPlan.revoke();
    const revokedPlanResult = renderRuntimeReactSurface({
      registry: created.handle,
      plan: revokedPlan.proxy as RuntimeHeadlessSurfacePlan,
    });
    const revokedRegistryInput = Proxy.revocable({}, {});
    revokedRegistryInput.revoke();

    expect(getterCalls).toBe(0);
    expect(accessorResult.status).toBe("failed");
    expect(accessorArrayResult.status).toBe("failed");
    expect(accessorPropsResult.status).toBe("failed");
    expect(proxyResult.status).toBe("failed");
    expect(revokedPlanResult.status).toBe("failed");
    expect(() =>
      createRuntimeReactAdapterRegistry(
        revokedRegistryInput.proxy as Parameters<typeof createRuntimeReactAdapterRegistry>[0],
      ),
    ).not.toThrow();
    expect(
      createRuntimeReactAdapterRegistry(
        revokedRegistryInput.proxy as Parameters<typeof createRuntimeReactAdapterRegistry>[0],
      ),
    ).toEqual({ status: "invalid", reason: "malformed-registration" });
    if (accessorResult.status === "failed") {
      expect(accessorResult).not.toHaveProperty("surface");
      expect(accessorResult.failure.code).toBe("MALFORMED_RENDER_PLAN");
    }
  });

  it("applies finite JSON and string budgets before adapter execution", () => {
    const created = registry();
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([
          node("json", TEXT_ID, {
            props: { nested: { tooDeep: true } },
          }),
        ]),
        limits: { maxJsonDepth: 1 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "JSON_DEPTH_LIMIT_EXCEEDED" },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([node("json", TEXT_ID)]),
        limits: { maxJsonOccurrences: 1 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "JSON_OCCURRENCE_LIMIT_EXCEEDED" },
    });
    expect(
      renderRuntimeReactSurface({
        registry: created.handle,
        plan: plan([node("json", TEXT_ID)]),
        limits: { maxStringCodeUnits: 1 },
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "STRING_LIMIT_EXCEEDED" },
    });
  });
});
