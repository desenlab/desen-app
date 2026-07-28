// @vitest-environment jsdom

import { Fragment, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
} from "@desen/runtime-core";

import { createRuntimeReactAdapterRegistry, useRuntimeReactSurface } from "../src/index.js";
import { createRuntimeReactSessionFixture } from "./session-fixture.js";

import type { ReactElement } from "react";
import type { RuntimeHeadlessSessionSnapshot, RuntimeJsonObject } from "@desen/runtime-core";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
  RuntimeReactLiveSurfaceInput,
  RuntimeReactLiveSurfaceResult,
} from "../src/index.js";
import type { RuntimeReactSessionFixture } from "./session-fixture.js";

const COMPONENT_CAPABILITIES = Object.freeze([
  "com.example.ui/Alert",
  "com.example.ui/Button",
  "com.example.ui/Stack",
  "com.example.ui/Text",
  "com.example.ui/TextField",
]);
const fixtures = new Set<RuntimeReactSessionFixture>();
const interactionPorts = new Map<string, RuntimeReactInteractionPort>();
let nextInstance = 0;

function textContent(value: unknown): string | null {
  return (value as { readonly textContent: string | null }).textContent;
}

function attribute(value: unknown, name: string): string | null {
  return (value as { getAttribute(attributeName: string): string | null }).getAttribute(name);
}

function currentSnapshot(fixture: RuntimeReactSessionFixture): RuntimeHeadlessSessionSnapshot {
  const result = readRuntimeHeadlessSession(fixture.session);
  if (result.status !== "read") {
    throw new TypeError(`Expected a live session, received ${result.status}.`);
  }
  return result.snapshot;
}

function emailRuntimeId(snapshot: RuntimeHeadlessSessionSnapshot): string {
  const binding = snapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === "sign-in.email",
  );
  if (binding === undefined) throw new TypeError("Expected the sign-in.email binding.");
  return binding.runtimeInstanceId;
}

function createRegistry(
  options: Readonly<{
    readonly tag?: string;
    readonly ports?: Map<string, RuntimeReactInteractionPort>;
  }> = {},
): RuntimeReactAdapterRegistryHandle {
  const ports = options.ports ?? interactionPorts;
  const tag = options.tag ?? "default";

  function Adapter(props: RuntimeReactComponentAdapterProps): ReactElement {
    ports.set(props.identity.sourceNodeId, props.interactions);
    const [instance] = useState(() => {
      nextInstance += 1;
      return nextInstance;
    });
    const children = Object.keys(props.slots).flatMap((name) => props.slots[name] ?? []);
    return (
      <Fragment>
        {props.identity.sourceNodeId === "sign-in.email" ? (
          <output data-registry={tag} data-testid="email-adapter">
            {String((props.props as RuntimeJsonObject).value)}:{instance}
          </output>
        ) : null}
        {children}
      </Fragment>
    );
  }

  const result = createRuntimeReactAdapterRegistry({
    components: COMPONENT_CAPABILITIES.map((capabilityId) => ({
      capabilityId,
      component: Adapter,
    })),
  });
  if (result.status !== "created") throw new TypeError("Expected a live-surface registry.");
  return result.handle;
}

function LiveProbe({
  input,
  observations,
}: {
  readonly input: RuntimeReactLiveSurfaceInput;
  readonly observations?: RuntimeReactLiveSurfaceResult[];
}): ReactElement {
  const result = useRuntimeReactSurface(input);
  observations?.push(result);
  return result.status === "rendered" ? (
    result.surface.element
  ) : (
    <output data-testid="live-failure">
      {result.failure.kind === "session"
        ? `session:${result.failure.reason}`
        : `render:${result.failure.failure.code}`}
    </output>
  );
}

afterEach(() => {
  cleanup();
  for (const fixture of fixtures) disposeRuntimeHeadlessSession(fixture.session);
  fixtures.clear();
  interactionPorts.clear();
  nextInstance = 0;
});

describe("live authenticated React surface", () => {
  it("recompiles exact published snapshots without remounting compatible adapter instances", async () => {
    const fixture = createRuntimeReactSessionFixture();
    fixtures.add(fixture);
    const registry = createRegistry();
    const view = render(
      <LiveProbe
        input={{
          registry,
          session: fixture.session,
          serverSnapshot: fixture.snapshot,
          catalogSet: fixture.catalogSet,
        }}
      />,
    );
    const initial = textContent(view.getByTestId("email-adapter"));
    expect(initial).toMatch(/^:([0-9]+)$/u);

    const snapshot = currentSnapshot(fixture);
    const dispatched = dispatchRuntimeHeadlessSessionEvent(fixture.session, {
      snapshot,
      runtimeInstanceId: emailRuntimeId(snapshot),
      eventName: "change",
      payload: { value: "live@example.com" },
    });
    expect(dispatched.status).toBe("dispatched");
    if (dispatched.status !== "dispatched") return;
    await act(async () => {
      await dispatched.completion;
      await Promise.resolve();
    });

    expect(textContent(view.getByTestId("email-adapter"))).toBe(
      `live@example.com:${initial?.split(":")[1]}`,
    );
  });

  it("removes the previous managed element tree when the session becomes terminal", async () => {
    const fixture = createRuntimeReactSessionFixture();
    fixtures.add(fixture);
    const view = render(
      <LiveProbe
        input={{
          registry: createRegistry(),
          session: fixture.session,
          serverSnapshot: fixture.snapshot,
          catalogSet: fixture.catalogSet,
        }}
      />,
    );
    expect(view.queryByTestId("email-adapter")).not.toBeNull();

    await act(async () => {
      expect(disposeRuntimeHeadlessSession(fixture.session)).toMatchObject({
        status: "disposed",
      });
      await Promise.resolve();
    });

    expect(view.queryByTestId("email-adapter")).toBeNull();
    expect(textContent(view.getByTestId("live-failure"))).toBe("session:disposed");
  });

  it("remounts the managed tree on session switch and ignores an old queued publication", async () => {
    const first = createRuntimeReactSessionFixture();
    const second = createRuntimeReactSessionFixture();
    fixtures.add(first);
    fixtures.add(second);
    const registry = createRegistry();
    const view = render(
      <LiveProbe
        input={{
          registry,
          session: first.session,
          serverSnapshot: first.snapshot,
          catalogSet: first.catalogSet,
        }}
      />,
    );
    const firstText = textContent(view.getByTestId("email-adapter"));
    const oldPort = interactionPorts.get("sign-in.email");
    expect(oldPort).toBeDefined();
    if (oldPort === undefined) return;
    const queued = oldPort.dispatchEvent("change", { value: "old-session@example.com" });
    expect(queued.status).toBe("dispatched");

    view.rerender(
      <LiveProbe
        input={{
          registry,
          session: second.session,
          serverSnapshot: second.snapshot,
          catalogSet: second.catalogSet,
        }}
      />,
    );

    const secondText = textContent(view.getByTestId("email-adapter"));
    expect(secondText).toMatch(/^:([0-9]+)$/u);
    expect(secondText).not.toBe(firstText);
    expect(oldPort.dispatchEvent("change", { value: "stale@example.com" })).toEqual({
      status: "unavailable",
    });

    if (queued.status === "dispatched") {
      await act(async () => {
        await queued.completion;
        await Promise.resolve();
      });
    }
    expect(textContent(view.getByTestId("email-adapter"))).toBe(secondText);

    const currentPort = interactionPorts.get("sign-in.email");
    expect(currentPort).toBeDefined();
    if (currentPort === undefined) return;
    const current = currentPort.dispatchEvent("change", { value: "new-session@example.com" });
    expect(current.status).toBe("dispatched");
    if (current.status === "dispatched") {
      await act(async () => {
        await current.completion;
        await Promise.resolve();
      });
    }
    expect(textContent(view.getByTestId("email-adapter"))).toBe(
      `new-session@example.com:${secondText?.split(":")[1]}`,
    );
  });

  it("remounts adapter and interaction authority when the registry changes within one session", async () => {
    const fixture = createRuntimeReactSessionFixture();
    fixtures.add(fixture);
    const firstPorts = new Map<string, RuntimeReactInteractionPort>();
    const secondPorts = new Map<string, RuntimeReactInteractionPort>();
    const firstRegistry = createRegistry({ tag: "first", ports: firstPorts });
    const secondRegistry = createRegistry({ tag: "second", ports: secondPorts });
    const input = {
      session: fixture.session,
      serverSnapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    };
    const view = render(
      <LiveProbe
        input={{
          registry: firstRegistry,
          ...input,
        }}
      />,
    );
    const firstAdapter = view.getByTestId("email-adapter");
    const firstInstance = textContent(firstAdapter);
    expect(attribute(firstAdapter, "data-registry")).toBe("first");
    const oldPort = firstPorts.get("sign-in.email");
    expect(oldPort).toBeDefined();
    if (oldPort === undefined) return;

    view.rerender(
      <LiveProbe
        input={{
          registry: secondRegistry,
          ...input,
        }}
      />,
    );

    const secondAdapter = view.getByTestId("email-adapter");
    expect(attribute(secondAdapter, "data-registry")).toBe("second");
    expect(textContent(secondAdapter)).not.toBe(firstInstance);
    expect(oldPort.dispatchEvent("change", { value: "stale-registry@example.com" })).toEqual({
      status: "unavailable",
    });
    const newPort = secondPorts.get("sign-in.email");
    expect(newPort).toBeDefined();
    expect(newPort).not.toBe(oldPort);
    if (newPort === undefined) return;

    const dispatched = newPort.dispatchEvent("change", {
      value: "new-registry@example.com",
    });
    expect(dispatched.status).toBe("dispatched");
    if (dispatched.status !== "dispatched") return;
    await act(async () => {
      await dispatched.completion;
      await Promise.resolve();
    });

    expect(textContent(view.getByTestId("email-adapter"))).toMatch(
      /^new-registry@example\.com:[0-9]+$/u,
    );
    expect(attribute(view.getByTestId("email-adapter"), "data-registry")).toBe("second");
  });

  it("reports render authentication failure without guessing a fallback surface", () => {
    const fixture = createRuntimeReactSessionFixture();
    fixtures.add(fixture);
    const observations: RuntimeReactLiveSurfaceResult[] = [];
    const view = render(
      <LiveProbe
        observations={observations}
        input={{
          registry: createRegistry(),
          session: fixture.session,
          serverSnapshot: fixture.snapshot,
          catalogSet: Object.freeze({}) as never,
        }}
      />,
    );

    expect(view.queryByTestId("email-adapter")).toBeNull();
    expect(textContent(view.getByTestId("live-failure"))).toBe("render:INVALID_CATALOG_SET");
    expect(observations.at(-1)).toMatchObject({
      status: "failed",
      failure: {
        kind: "render",
        failure: { code: "INVALID_CATALOG_SET" },
      },
    });
  });
});
