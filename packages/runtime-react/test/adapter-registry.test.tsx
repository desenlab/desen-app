import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createRuntimeReactAdapterRegistry,
  readRuntimeReactAdapterRegistry,
  renderRuntimeReactSurface,
} from "../src/index.js";
import { createRuntimeReactSessionFixture } from "./session-fixture.js";

import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactRenderLimitProfile,
} from "../src/index.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";

function Stack({ identity, slots }: RuntimeReactComponentAdapterProps) {
  return (
    <section data-runtime-node={identity.runtimeNodeId} data-source-node={identity.sourceNodeId}>
      {slots.default}
    </section>
  );
}

function Text({ identity, props }: RuntimeReactComponentAdapterProps) {
  return <p data-source-node={identity.sourceNodeId}>{String(props.text ?? "")}</p>;
}

function Field({ identity, props }: RuntimeReactComponentAdapterProps) {
  return <label data-source-node={identity.sourceNodeId}>{String(props.label ?? "")}</label>;
}

function Button({ identity, props }: RuntimeReactComponentAdapterProps) {
  return <button data-source-node={identity.sourceNodeId}>{String(props.label ?? "")}</button>;
}

function registry(
  overrides: {
    readonly stack?: RuntimeReactComponentAdapterComponent;
    readonly includeText?: boolean;
  } = {},
) {
  const result = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: STACK_ID, component: overrides.stack ?? Stack },
      ...(overrides.includeText === false ? [] : [{ capabilityId: TEXT_ID, component: Text }]),
      { capabilityId: TEXT_FIELD_ID, component: Field },
      { capabilityId: BUTTON_ID, component: Button },
    ],
  });
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("registry setup failed");
  return result;
}

function renderFixture(
  handle: RuntimeReactAdapterRegistryHandle,
  limits?: RuntimeReactRenderLimitProfile,
) {
  const fixture = createRuntimeReactSessionFixture();
  return renderRuntimeReactSurface({
    registry: handle,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
    ...(limits === undefined ? {} : { limits }),
  });
}

describe("React adapter registry and authenticated render-plan renderer", () => {
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

  it("renders an authenticated ordinary root and descendants through exact registry lookup", () => {
    const created = registry();
    const result = renderFixture(created.handle);

    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    const html = renderToStaticMarkup(result.surface.element);
    expect(result.surface.nodeCount).toBe(5);
    expect(html).toContain('data-source-node="sign-in.layout"');
    expect(html.indexOf(">Sign in</p>")).toBeLessThan(html.indexOf(">Email</label>"));
    expect(html.indexOf(">Email</label>")).toBeLessThan(html.indexOf(">Password</label>"));
  });

  it("preflights the complete authenticated tree before returning any React element", () => {
    const calls: string[] = [];
    const CountingStack = ({ identity }: RuntimeReactComponentAdapterProps) => {
      calls.push(identity.runtimeNodeId);
      return null;
    };
    const created = registry({ stack: CountingStack, includeText: false });
    const result = renderFixture(created.handle);

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "UNKNOWN_COMPONENT_CAPABILITY",
        sourceNodeId: "sign-in.title",
        capabilityId: TEXT_ID,
        channel: null,
        diagnostics: [],
      },
    });
    expect(result).not.toHaveProperty("surface");
    expect(calls).toEqual([]);
  });

  it("rejects duplicate and malformed registrations without fallback", () => {
    expect(
      createRuntimeReactAdapterRegistry({
        components: [
          { capabilityId: TEXT_ID, component: Text },
          { capabilityId: TEXT_ID, component: Stack },
        ],
      }),
    ).toEqual({ status: "invalid", reason: "duplicate-capability" });
    for (const capabilityId of [
      "not-a-capability",
      "foo_bar/Component",
      "a:b/Component",
      "ok.ns/9startsWithDigit",
      "ok.ns/Component/path",
    ]) {
      expect(
        createRuntimeReactAdapterRegistry({
          components: [{ capabilityId, component: Text }],
        }),
      ).toEqual({ status: "invalid", reason: "malformed-registration" });
    }
    expect(
      createRuntimeReactAdapterRegistry({
        components: [
          {
            capabilityId: `${"a".repeat(50_000)}/Component`,
            component: Text,
          },
        ],
        limits: { maxIdentifierCodeUnits: 64 },
      }),
    ).toEqual({ status: "invalid", reason: "identifier-limit" });
  });

  it("rejects forged registry handles before session or plan consumption", () => {
    const fixture = createRuntimeReactSessionFixture();
    const result = renderRuntimeReactSurface({
      registry: Object.freeze({}) as RuntimeReactAdapterRegistryHandle,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    });

    expect(result).toEqual({
      status: "failed",
      failure: {
        code: "INVALID_REGISTRY",
        runtimeNodeId: null,
        sourceNodeId: null,
        capabilityId: null,
        channel: null,
        diagnostics: [],
      },
    });
  });

  it("enforces exact lower-only node, depth, slot, JSON, and string ceilings", () => {
    const created = registry();
    expect(renderFixture(created.handle, { maxNodes: 4 })).toMatchObject({
      status: "failed",
      failure: { code: "NODE_LIMIT_EXCEEDED" },
    });
    expect(renderFixture(created.handle, { maxDepth: 0 })).toMatchObject({
      status: "failed",
      failure: { code: "DEPTH_LIMIT_EXCEEDED" },
    });
    expect(renderFixture(created.handle, { maxSlotEntries: 4 })).toMatchObject({
      status: "failed",
      failure: { code: "SLOT_LIMIT_EXCEEDED" },
    });
    expect(renderFixture(created.handle, { maxJsonDepth: 0 })).toMatchObject({
      status: "failed",
      failure: { code: "JSON_DEPTH_LIMIT_EXCEEDED" },
    });
    expect(renderFixture(created.handle, { maxStringCodeUnits: 1 })).toMatchObject({
      status: "failed",
      failure: { code: "STRING_LIMIT_EXCEEDED" },
    });
    expect(
      renderFixture(created.handle, {
        maxNodes: Number.MAX_SAFE_INTEGER,
      }),
    ).toMatchObject({
      status: "failed",
      failure: { code: "MALFORMED_RENDER_PLAN" },
    });
  });

  it("delivers only detached and recursively frozen props and semantic style maps", () => {
    const seen: RuntimeReactComponentAdapterProps[] = [];
    const Snapshot = (props: RuntimeReactComponentAdapterProps) => {
      seen.push(props);
      return <p>{String(props.props.text ?? "")}</p>;
    };
    const created = createRuntimeReactAdapterRegistry({
      components: [
        { capabilityId: STACK_ID, component: Stack },
        { capabilityId: TEXT_ID, component: Snapshot },
        { capabilityId: TEXT_FIELD_ID, component: Field },
        { capabilityId: BUTTON_ID, component: Button },
      ],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const fixture = createRuntimeReactSessionFixture();
    const rawText = fixture.snapshot.plan.root[0]?.slots.default?.[0];
    const result = renderRuntimeReactSurface({
      registry: created.handle,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    });
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    renderToStaticMarkup(result.surface.element);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.props).not.toBe(rawText?.props);
    expect(seen[0]?.style).not.toBe(rawText?.style);
    expect(Object.isFrozen(seen[0]?.props)).toBe(true);
    expect(Object.isFrozen(seen[0]?.style)).toBe(true);
    expect(Object.isFrozen(seen[0]?.slots)).toBe(true);
  });

  it("rejects accessor-backed and hostile input envelopes without invoking getters", () => {
    let getterCalls = 0;
    const created = registry();
    const fixture = createRuntimeReactSessionFixture();
    const accessorInput = {
      registry: created.handle,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    };
    Object.defineProperty(accessorInput, "session", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return fixture.session;
      },
    });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();

    expect(
      renderRuntimeReactSurface(
        accessorInput as unknown as Parameters<typeof renderRuntimeReactSurface>[0],
      ),
    ).toMatchObject({
      status: "failed",
      failure: { code: "MALFORMED_RENDER_PLAN" },
    });
    expect(() =>
      renderRuntimeReactSurface(revoked.proxy as Parameters<typeof renderRuntimeReactSurface>[0]),
    ).not.toThrow();
    expect(getterCalls).toBe(0);
  });

  it("keeps interaction authority inert until the dedicated event and command task", () => {
    const seen: RuntimeReactComponentAdapterProps[] = [];
    const Inspect = (props: RuntimeReactComponentAdapterProps) => {
      seen.push(props);
      return <>{props.slots.default}</>;
    };
    const created = createRuntimeReactAdapterRegistry({
      components: [
        { capabilityId: STACK_ID, component: Inspect },
        { capabilityId: TEXT_ID, component: Text },
        { capabilityId: TEXT_FIELD_ID, component: Field },
        { capabilityId: BUTTON_ID, component: Button },
      ],
    });
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    const result = renderFixture(created.handle);
    expect(result.status).toBe("rendered");
    if (result.status !== "rendered") return;
    renderToStaticMarkup(result.surface.element);

    expect(seen[0]?.interactions.dispatchEvent("press", {})).toEqual({
      status: "unavailable",
    });
    expect(
      seen[0]?.interactions.attachCommands({ invoke: () => ({ status: "succeeded" }) }),
    ).toEqual({ status: "unavailable" });
  });

  it("keeps registry snapshots and all failure envelopes recursively immutable", () => {
    const created = registry();
    const fixture = createRuntimeReactSessionFixture();
    const result = renderRuntimeReactSurface({
      registry: Object.freeze({}) as RuntimeReactAdapterRegistryHandle,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    });

    expect(Object.isFrozen(created.snapshot)).toBe(true);
    expect(Object.isFrozen(created.snapshot.componentCapabilityIds)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(Object.isFrozen(result.failure)).toBe(true);
    expect(Object.isFrozen(result.failure.diagnostics)).toBe(true);
  });
});
