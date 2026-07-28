// @vitest-environment jsdom

import { Fragment, StrictMode, Suspense, useEffect } from "react";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dispatchRuntimeHeadlessSessionEvent,
  readRuntimeHeadlessSession,
} from "@desen/runtime-core";

import { createRuntimeReactAdapterRegistry, renderRuntimeReactSurface } from "../src/index.js";
import { createRuntimeReactSessionFixture, rootNode } from "./session-fixture.js";

import type { ReactElement } from "react";
import type { RuntimeJsonObject, RuntimeJsonValue } from "@desen/runtime-core";
import type {
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactCommandAttachmentResult,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentCommandPort,
  RuntimeReactInteractionPort,
} from "../src/index.js";
import type { MutableJsonRecord, RuntimeReactSessionFixture } from "./session-fixture.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const SORTABLE_ID = "com.example.interactions/Sortable";

interface InteractionObservations {
  readonly ports: Map<string, RuntimeReactInteractionPort>;
  readonly attachments: Map<string, RuntimeReactCommandAttachmentResult[]>;
  readonly renderAttachments: RuntimeReactCommandAttachmentResult[];
  readonly commandInvocations: Readonly<{
    readonly sourceNodeId: string;
    readonly commandName: string;
    readonly input: unknown;
  }>[];
  readonly behaviorAttachments: RuntimeReactCommandAttachmentResult[];
}

function commandOnlyFixture(): RuntimeReactSessionFixture {
  return createRuntimeReactSessionFixture({
    mutateBundle(bundle) {
      const children = ((rootNode(bundle).slots as MutableJsonRecord).default ??
        []) as MutableJsonRecord[];
      const submit = children[4] as MutableJsonRecord;
      const handlers = submit.on as MutableJsonRecord;
      const press = handlers.press as unknown[];
      press.unshift({
        type: "component.command",
        target: "sign-in.password",
        command: "focus",
        input: {},
      });
    },
  });
}

function behaviorFixture(): RuntimeReactSessionFixture {
  return createRuntimeReactSessionFixture({
    mutateBundle(bundle) {
      rootNode(bundle).behaviors = [
        {
          id: "sign-in.sortable",
          use: SORTABLE_ID,
          props: { axis: "vertical", handle: "item" },
          on: {
            reorder: [
              {
                type: "state.set",
                path: "email",
                value: { $ref: "event.itemKey" },
              },
            ],
          },
        },
      ];
    },
  });
}

function createObservingRegistry(
  observations: InteractionObservations,
  options: {
    readonly includeBehavior?: boolean;
    readonly renderTimeAttach?: boolean;
  } = {},
) {
  function Component(props: RuntimeReactComponentAdapterProps) {
    observations.ports.set(props.identity.sourceNodeId, props.interactions);
    if (options.renderTimeAttach && props.identity.sourceNodeId === "sign-in.password") {
      observations.renderAttachments.push(
        props.interactions.attachCommands({
          invoke: () => Object.freeze({ status: "succeeded" }),
        }),
      );
    }
    useEffect(() => {
      if (props.identity.capabilityId !== TEXT_FIELD_ID) return;
      const commands: RuntimeReactComponentCommandPort = Object.freeze({
        invoke(commandName: string, input: RuntimeJsonObject) {
          expect(this).toBeUndefined();
          observations.commandInvocations.push({
            sourceNodeId: props.identity.sourceNodeId,
            commandName,
            input,
          });
          return Object.freeze({ status: "succeeded" });
        },
      });
      const attachment = props.interactions.attachCommands(commands);
      const attempts = observations.attachments.get(props.identity.sourceNodeId) ?? [];
      attempts.push(attachment);
      observations.attachments.set(props.identity.sourceNodeId, attempts);
    }, [props.identity.capabilityId, props.identity.sourceNodeId, props.interactions]);
    return <Fragment>{props.slots.default}</Fragment>;
  }

  function Behavior(props: RuntimeReactBehaviorAdapterProps) {
    observations.ports.set(props.identity.runtimeNodeId, props.interactions);
    useEffect(() => {
      observations.behaviorAttachments.push(
        props.interactions.attachCommands({
          invoke: () => Object.freeze({ status: "succeeded" }),
        }),
      );
    }, [props.interactions]);
    return <Fragment>{props.children}</Fragment>;
  }

  const result = createRuntimeReactAdapterRegistry({
    components: [
      { capabilityId: STACK_ID, component: Component },
      { capabilityId: TEXT_ID, component: Component },
      { capabilityId: TEXT_FIELD_ID, component: Component },
      { capabilityId: BUTTON_ID, component: Component },
    ],
    ...(options.includeBehavior
      ? { behaviors: [{ capabilityId: SORTABLE_ID, component: Behavior }] }
      : {}),
  });
  if (result.status !== "created") throw new TypeError("Expected interaction registry.");
  return result.handle;
}

function observations(): InteractionObservations {
  return {
    ports: new Map(),
    attachments: new Map(),
    renderAttachments: [],
    commandInvocations: [],
    behaviorAttachments: [],
  };
}

function compiledSurface(
  fixture: RuntimeReactSessionFixture,
  registry: ReturnType<typeof createObservingRegistry>,
): ReactElement {
  const result = renderRuntimeReactSurface({
    registry,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
  });
  expect(result.status).toBe("rendered");
  if (result.status !== "rendered") throw new TypeError("Expected rendered surface.");
  return result.surface.element;
}

function latestSnapshot(fixture: RuntimeReactSessionFixture) {
  const result = readRuntimeHeadlessSession(fixture.session);
  expect(result.status).toBe("read");
  if (result.status !== "read") throw new TypeError("Expected live session.");
  return result.snapshot;
}

function runtimeInstanceId(fixture: RuntimeReactSessionFixture, sourceNodeId: string): string {
  const binding = latestSnapshot(fixture).bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === sourceNodeId,
  );
  if (binding === undefined) throw new TypeError(`Missing binding for ${sourceNodeId}.`);
  return binding.runtimeInstanceId;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authenticated React interaction wiring", () => {
  it("keeps server rendering callback-free and grants no command authority without a commit", async () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen, { renderTimeAttach: true });
    expect(() => renderToString(compiledSurface(fixture, registry))).not.toThrow();
    expect(seen.renderAttachments).not.toHaveLength(0);
    expect(seen.renderAttachments.every(({ status }) => status === "unavailable")).toBe(true);
    expect(seen.attachments.size).toBe(0);
    expect(seen.commandInvocations).toEqual([]);

    const direct = dispatchRuntimeHeadlessSessionEvent(fixture.session, {
      snapshot: fixture.snapshot,
      runtimeInstanceId: runtimeInstanceId(fixture, "sign-in.submit"),
      eventName: "press",
      payload: {},
    });
    expect(direct.status).toBe("dispatched");
    if (direct.status === "dispatched") {
      await expect(direct.completion).resolves.toMatchObject({ status: "terminated" });
    }
    expect(seen.commandInvocations).toEqual([]);
  });

  it("rejects initial pre-commit command capture, then attaches in the committed passive effect", () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen, { renderTimeAttach: true });
    const view = render(compiledSurface(fixture, registry));

    expect(seen.renderAttachments).not.toHaveLength(0);
    expect(seen.renderAttachments.every(({ status }) => status === "unavailable")).toBe(true);
    expect([...seen.attachments.values()].flat().every(({ status }) => status === "attached")).toBe(
      true,
    );
    expect(
      [...seen.attachments.values()].flat().some(({ status }) => status === "unavailable"),
    ).toBe(false);
    view.unmount();
  });

  it("routes exact component events and command callbacks without leaking a newer snapshot", async () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen);
    const view = render(compiledSurface(fixture, registry));
    const button = seen.ports.get("sign-in.submit");
    const password = seen.ports.get("sign-in.password");
    const email = seen.ports.get("sign-in.email");
    const passwordAttachment = seen.attachments
      .get("sign-in.password")
      ?.find(
        (result): result is Extract<RuntimeReactCommandAttachmentResult, { status: "attached" }> =>
          result.status === "attached",
      );
    expect(button).toBeDefined();
    expect(password).toBeDefined();
    expect(email).toBeDefined();
    expect(passwordAttachment).toBeDefined();
    if (
      button === undefined ||
      password === undefined ||
      email === undefined ||
      passwordAttachment === undefined
    ) {
      return;
    }

    expect(email.dispatchEvent("change", {})).toEqual({ status: "rejected" });
    expect(button.dispatchEvent("unknown", {})).toEqual({ status: "rejected" });
    const dispatched = button.dispatchEvent("press", {});
    expect(dispatched.status).toBe("dispatched");
    expect(Object.isFrozen(dispatched)).toBe(true);
    if (dispatched.status !== "dispatched") return;
    await expect(dispatched.completion).resolves.toBeUndefined();
    expect(seen.commandInvocations).toEqual([
      {
        sourceNodeId: "sign-in.password",
        commandName: "focus",
        input: {},
      },
    ]);
    expect(Object.isFrozen(seen.commandInvocations[0]?.input)).toBe(true);

    expect(password.detachCommands(passwordAttachment.attachment)).toEqual({
      status: "detached",
    });
    expect(password.detachCommands(passwordAttachment.attachment)).toEqual({
      status: "already-detached",
    });
    expect(email.detachCommands(passwordAttachment.attachment)).toEqual({
      status: "rejected",
    });
    const changed = email.dispatchEvent("change", { value: "new@example.com" });
    expect(changed.status).toBe("dispatched");
    if (changed.status === "dispatched") await changed.completion;
    expect(latestSnapshot(fixture).state.email).toBe("new@example.com");
    expect(button.dispatchEvent("press", {})).toEqual({ status: "rejected" });
    expect(
      password.attachCommands({
        invoke: () => Object.freeze({ status: "succeeded" }),
      }),
    ).toEqual({ status: "rejected" });
    view.unmount();
  });

  it("rejects malformed and foreign command authority while supersession stays owner-safe", async () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen);
    const view = render(compiledSurface(fixture, registry));
    const button = seen.ports.get("sign-in.submit");
    const email = seen.ports.get("sign-in.email");
    const password = seen.ports.get("sign-in.password");
    const emailAttachment = seen.attachments
      .get("sign-in.email")
      ?.find(
        (result): result is Extract<RuntimeReactCommandAttachmentResult, { status: "attached" }> =>
          result.status === "attached",
      );
    expect(button).toBeDefined();
    expect(email).toBeDefined();
    expect(password).toBeDefined();
    expect(emailAttachment).toBeDefined();
    if (
      button === undefined ||
      email === undefined ||
      password === undefined ||
      emailAttachment === undefined
    ) {
      return;
    }

    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "invoke", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return () => Object.freeze({ status: "succeeded" });
      },
    });
    expect(password.attachCommands(accessor as RuntimeReactComponentCommandPort)).toEqual({
      status: "rejected",
    });
    expect(getterCalls).toBe(0);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(() =>
      password.attachCommands(revoked.proxy as RuntimeReactComponentCommandPort),
    ).not.toThrow();
    expect(password.attachCommands(revoked.proxy as RuntimeReactComponentCommandPort)).toEqual({
      status: "rejected",
    });
    expect(password.detachCommands(emailAttachment.attachment)).toEqual({
      status: "rejected",
    });

    const oldInvoke = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    const currentInvoke = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    const oldOwner = password.attachCommands({ invoke: oldInvoke });
    const currentOwner = password.attachCommands({ invoke: currentInvoke });
    expect(oldOwner.status).toBe("attached");
    expect(currentOwner.status).toBe("attached");
    if (oldOwner.status !== "attached" || currentOwner.status !== "attached") return;
    expect(password.detachCommands(oldOwner.attachment)).toEqual({
      status: "already-detached",
    });
    const dispatched = button.dispatchEvent("press", {});
    expect(dispatched.status).toBe("dispatched");
    if (dispatched.status === "dispatched") await dispatched.completion;
    expect(oldInvoke).not.toHaveBeenCalled();
    expect(currentInvoke).toHaveBeenCalledTimes(1);
    expect(password.detachCommands(currentOwner.attachment)).toEqual({
      status: "detached",
    });
    view.unmount();
  });

  it("does not admit authority when hostile reflection synchronously unmounts its commit", async () => {
    const eventFixture = commandOnlyFixture();
    const eventSeen = observations();
    const eventRegistry = createObservingRegistry(eventSeen);
    const eventView = render(compiledSurface(eventFixture, eventRegistry));
    const button = eventSeen.ports.get("sign-in.submit");
    expect(button).toBeDefined();
    if (button === undefined) return;
    let payloadTrapCalls = 0;
    const hostilePayload = new Proxy(
      {},
      {
        getPrototypeOf(subject) {
          payloadTrapCalls += 1;
          eventView.unmount();
          return Reflect.getPrototypeOf(subject);
        },
      },
    ) as RuntimeJsonValue;
    expect(button.dispatchEvent("press", hostilePayload)).toEqual({
      status: "unavailable",
    });
    expect(payloadTrapCalls).toBeGreaterThan(0);
    expect(eventSeen.commandInvocations).toHaveLength(0);

    const commandFixture = commandOnlyFixture();
    const commandSeen = observations();
    const commandRegistry = createObservingRegistry(commandSeen);
    const commandView = render(compiledSurface(commandFixture, commandRegistry));
    const password = commandSeen.ports.get("sign-in.password");
    expect(password).toBeDefined();
    if (password === undefined) return;
    const hostileInvoke = vi.fn(() => Object.freeze({ status: "succeeded" as const }));
    let commandTrapCalls = 0;
    const hostileCommands = new Proxy(
      { invoke: hostileInvoke },
      {
        getPrototypeOf(subject) {
          commandTrapCalls += 1;
          commandView.unmount();
          return Reflect.getPrototypeOf(subject);
        },
      },
    );
    expect(password.attachCommands(hostileCommands)).toEqual({
      status: "unavailable",
    });
    expect(commandTrapCalls).toBeGreaterThan(0);

    const current = latestSnapshot(commandFixture);
    const direct = dispatchRuntimeHeadlessSessionEvent(commandFixture.session, {
      snapshot: current,
      runtimeInstanceId: runtimeInstanceId(commandFixture, "sign-in.submit"),
      eventName: "press",
      payload: {},
    });
    expect(direct.status).toBe("dispatched");
    if (direct.status === "dispatched") await direct.completion;
    expect(hostileInvoke).not.toHaveBeenCalled();
  });

  it("detaches surviving command ownership on unmount even when the adapter omits cleanup", async () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen);
    const view = render(compiledSurface(fixture, registry));
    const button = seen.ports.get("sign-in.submit");
    const password = seen.ports.get("sign-in.password");
    const passwordAttachment = seen.attachments
      .get("sign-in.password")
      ?.find(
        (result): result is Extract<RuntimeReactCommandAttachmentResult, { status: "attached" }> =>
          result.status === "attached",
      );
    expect(button).toBeDefined();
    expect(password).toBeDefined();
    expect(passwordAttachment).toBeDefined();
    if (button === undefined || password === undefined || passwordAttachment === undefined) return;
    const first = button.dispatchEvent("press", {});
    expect(first.status).toBe("dispatched");
    if (first.status !== "dispatched") return;
    await first.completion;
    expect(seen.commandInvocations).toHaveLength(1);

    view.unmount();
    expect(button.dispatchEvent("press", {})).toEqual({ status: "unavailable" });
    expect(
      password.attachCommands({
        invoke: () => Object.freeze({ status: "succeeded" }),
      }),
    ).toEqual({ status: "unavailable" });
    expect(password.detachCommands(passwordAttachment.attachment)).toEqual({
      status: "unavailable",
    });
    const current = latestSnapshot(fixture);
    const direct = dispatchRuntimeHeadlessSessionEvent(fixture.session, {
      snapshot: current,
      runtimeInstanceId: runtimeInstanceId(fixture, "sign-in.submit"),
      eventName: "press",
      payload: {},
    });
    expect(direct.status).toBe("dispatched");
    if (direct.status === "dispatched") await direct.completion;
    expect(seen.commandInvocations).toHaveLength(1);
  });

  it("dispatches behavior events but never grants behavior command authority", async () => {
    const fixture = behaviorFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen, { includeBehavior: true });
    const view = render(compiledSurface(fixture, registry));
    expect(seen.behaviorAttachments).toEqual([{ status: "unavailable" }]);
    const behavior = latestSnapshot(fixture).bindings.find(
      (binding) => binding.kind === "behavior",
    );
    expect(behavior).toBeDefined();
    if (behavior === undefined) return;
    const port = seen.ports.get(behavior.runtimeInstanceId);
    expect(port).toBeDefined();
    if (port === undefined) return;
    const dispatched = port.dispatchEvent("reorder", {
      fromIndex: 0,
      toIndex: 1,
      itemKey: "moved@example.com",
    });
    expect(dispatched.status).toBe("dispatched");
    if (dispatched.status === "dispatched") await dispatched.completion;
    expect(latestSnapshot(fixture).state.email).toBe("moved@example.com");
    view.unmount();
  });

  it("reattaches safely under StrictMode without leaving the simulated mount live", async () => {
    const fixture = commandOnlyFixture();
    const seen = observations();
    const registry = createObservingRegistry(seen);
    const view = render(<StrictMode>{compiledSurface(fixture, registry)}</StrictMode>);
    const attempts = [...seen.attachments.values()].flat();
    expect(attempts.length).toBeGreaterThanOrEqual(4);
    expect(attempts.every(({ status }) => status === "attached")).toBe(true);
    const button = seen.ports.get("sign-in.submit");
    expect(button).toBeDefined();
    if (button === undefined) return;
    const dispatched = button.dispatchEvent("press", {});
    expect(dispatched.status).toBe("dispatched");
    if (dispatched.status === "dispatched") await dispatched.completion;
    expect(seen.commandInvocations).toHaveLength(1);
    view.unmount();
  });

  it("creates no command authority for a suspended render that never commits", async () => {
    const fixture = commandOnlyFixture();
    const attempts: RuntimeReactCommandAttachmentResult[] = [];
    const never = new Promise<never>(() => undefined);
    function Suspended(props: RuntimeReactComponentAdapterProps): ReactElement {
      attempts.push(
        props.interactions.attachCommands({
          invoke: () => Object.freeze({ status: "succeeded" }),
        }),
      );
      throw never;
    }
    const result = createRuntimeReactAdapterRegistry({
      components: [
        { capabilityId: STACK_ID, component: Suspended },
        { capabilityId: TEXT_ID, component: () => null },
        { capabilityId: TEXT_FIELD_ID, component: () => null },
        { capabilityId: BUTTON_ID, component: () => null },
      ],
    });
    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    const compiled = renderRuntimeReactSurface({
      registry: result.handle,
      session: fixture.session,
      snapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    });
    expect(compiled.status).toBe("rendered");
    if (compiled.status !== "rendered") return;
    const view = render(<Suspense fallback={<p>pending</p>}>{compiled.surface.element}</Suspense>);
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every(({ status }) => status === "unavailable")).toBe(true);
    await act(async () => {
      view.unmount();
    });
  });
});
