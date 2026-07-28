// @vitest-environment jsdom

import { StrictMode, Suspense, cloneElement, createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import currentCatalog from "../catalog.json";
import {
  AlertReactAdapter,
  ButtonReactAdapter,
  REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT,
  REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS,
  StackReactAdapter,
  TextFieldReactAdapter,
  TextReactAdapter,
  alertReactAdapterRegistration,
  buttonReactAdapterRegistration,
  stackReactAdapterRegistration,
  textFieldReactAdapterRegistration,
  textReactAdapterRegistration,
} from "../src/react-adapters/index.js";

import type {
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactComponentCommandPort,
  RuntimeReactInteractionPort,
} from "@desen/runtime-react";

afterEach(cleanup);

const IDENTITY = Object.freeze({
  runtimeNodeId: "runtime:test",
  sourceNodeId: "source:test",
  capabilityId: "com.example.ui/Test",
});
const EMPTY_SLOTS = Object.freeze({});
const EMPTY_STYLE = Object.freeze({ base: Object.freeze({}) });
const NEVER = new Promise<never>(() => undefined);

interface DispatchedEvent {
  readonly name: string;
  readonly payload: unknown;
}

interface AttachedCommand {
  readonly commands: RuntimeReactComponentCommandPort;
  readonly attachment: RuntimeReactCommandAttachmentHandle;
}

interface InteractionHarness {
  readonly port: RuntimeReactInteractionPort;
  readonly events: DispatchedEvent[];
  readonly attached: AttachedCommand[];
  readonly detached: RuntimeReactCommandAttachmentHandle[];
}

function interactionHarness(): InteractionHarness {
  const events: DispatchedEvent[] = [];
  const attached: AttachedCommand[] = [];
  const detached: RuntimeReactCommandAttachmentHandle[] = [];
  let sequence = 0;
  const port = Object.freeze({
    dispatchEvent(name, payload) {
      events.push(Object.freeze({ name, payload }));
      return Object.freeze({
        status: "dispatched",
        completion: Promise.resolve(),
      });
    },
    attachCommands(commands) {
      sequence += 1;
      const attachment = Object.freeze({
        sequence,
      }) as unknown as RuntimeReactCommandAttachmentHandle;
      attached.push(Object.freeze({ commands, attachment }));
      return Object.freeze({ status: "attached", attachment });
    },
    detachCommands(attachment) {
      detached.push(attachment);
      return Object.freeze({ status: "detached" });
    },
  } satisfies RuntimeReactInteractionPort);
  return { port, events, attached, detached };
}

function adapterProps(
  props: Readonly<Record<string, unknown>>,
  interactions: RuntimeReactInteractionPort,
  options: Readonly<{
    slots?: RuntimeReactComponentAdapterProps["slots"];
    style?: RuntimeReactComponentAdapterProps["style"];
  }> = {},
): RuntimeReactComponentAdapterProps {
  return Object.freeze({
    identity: IDENTITY,
    props: Object.freeze(props) as RuntimeReactComponentAdapterProps["props"],
    slots: options.slots ?? EMPTY_SLOTS,
    style: options.style ?? (EMPTY_STYLE as unknown as RuntimeReactComponentAdapterProps["style"]),
    interactions,
  });
}

function adapterElement(
  Adapter: RuntimeReactComponentAdapterComponent,
  props: Readonly<Record<string, unknown>>,
  interactions: RuntimeReactInteractionPort,
  options?: Parameters<typeof adapterProps>[2],
) {
  return createElement(Adapter, adapterProps(props, interactions, options));
}

function SuspendForever(): never {
  // Suspense requires the pending thenable itself so React abandons the uncommitted primary tree.
  throw NEVER;
}

function declaredInteractionNames(contract: object, key: "commands" | "events"): string[] {
  const descriptor = Object.getOwnPropertyDescriptor(contract, key);
  return descriptor !== undefined &&
    "value" in descriptor &&
    typeof descriptor.value === "object" &&
    descriptor.value !== null &&
    !Array.isArray(descriptor.value)
    ? Object.keys(descriptor.value as Record<string, unknown>).sort()
    : [];
}

describe("reference Web runtime React adapters", () => {
  it("exports one frozen static five-component factory input", () => {
    expect(REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS).toEqual([
      stackReactAdapterRegistration,
      textReactAdapterRegistration,
      textFieldReactAdapterRegistration,
      buttonReactAdapterRegistration,
      alertReactAdapterRegistration,
    ]);
    expect(
      REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS.map(({ capabilityId }) => capabilityId),
    ).toEqual([
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
      "com.example.ui/Button",
      "com.example.ui/Alert",
    ]);
    expect(
      REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS.map(({ component }) => component),
    ).toEqual([
      StackReactAdapter,
      TextReactAdapter,
      TextFieldReactAdapter,
      ButtonReactAdapter,
      AlertReactAdapter,
    ]);
    expect(Object.isFrozen(REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT)).toBe(true);
    expect(Object.isFrozen(REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS)).toBe(true);
    for (const registration of REFERENCE_WEB_REACT_COMPONENT_ADAPTER_REGISTRATIONS) {
      expect(Object.isFrozen(registration)).toBe(true);
    }

    const created = createRuntimeReactAdapterRegistry(REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT);
    expect(created.status).toBe("created");
    if (created.status === "created") {
      const catalogComponentIds = Object.keys(currentCatalog.components).sort();
      const catalogBehaviorIds = Object.keys(currentCatalog.behaviors).sort();
      expect(created.snapshot.componentCapabilityIds).toEqual(catalogComponentIds);
      expect(created.snapshot.behaviorCapabilityIds).toEqual(catalogBehaviorIds);
      expect(
        Object.fromEntries(
          Object.entries(currentCatalog.components)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([capabilityId, contract]) => [
              capabilityId,
              {
                commands: declaredInteractionNames(contract, "commands"),
                events: declaredInteractionNames(contract, "events"),
              },
            ]),
        ),
      ).toEqual({
        "com.example.ui/Alert": { commands: [], events: [] },
        "com.example.ui/Button": { commands: [], events: ["press"] },
        "com.example.ui/Stack": { commands: [], events: [] },
        "com.example.ui/Text": { commands: [], events: [] },
        "com.example.ui/TextField": { commands: ["focus"], events: ["change"] },
      });
    }
  });

  it("renders all five real components through explicit schema and slot mappings", () => {
    const interactions = interactionHarness();
    const slots = Object.freeze({
      default: Object.freeze([
        cloneElement(
          adapterElement(
            TextReactAdapter,
            { role: "caption", text: "Nested content" },
            interactions.port,
          ),
          { key: "nested-text" },
        ),
      ]),
    });
    const { container, getByRole, getByText } = render(
      <>
        {adapterElement(
          StackReactAdapter,
          { align: "center", direction: "vertical", gap: "sm", maxWidth: 480 },
          interactions.port,
          { slots },
        )}
        {adapterElement(
          TextFieldReactAdapter,
          { label: "Email", placeholder: "name@example.test", value: "" },
          interactions.port,
        )}
        {adapterElement(
          ButtonReactAdapter,
          { label: "Continue", variant: "secondary" },
          interactions.port,
        )}
        {adapterElement(AlertReactAdapter, { text: "Ready", tone: "success" }, interactions.port)}
      </>,
    );

    expect(getByText("Nested content").tagName).toBe("SMALL");
    expect(getByRole("textbox", { name: "Email" })).toHaveProperty(
      "placeholder",
      "name@example.test",
    );
    expect(getByRole("button", { name: "Continue" }).getAttribute("data-variant")).toBe(
      "secondary",
    );
    expect(getByRole("status").textContent).toBe("Ready");
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("dispatches fresh inert Button press payloads without native-event authority", () => {
    const interactions = interactionHarness();
    const { getByRole } = render(
      adapterElement(
        ButtonReactAdapter,
        { label: "Continue", variant: "primary" },
        interactions.port,
      ),
    );
    const button = getByRole("button", { name: "Continue" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(interactions.events.map(({ name }) => name)).toEqual(["press", "press"]);
    expect(interactions.events.map(({ payload }) => payload)).toEqual([{}, {}]);
    expect(interactions.events[0]?.payload).not.toBe(interactions.events[1]?.payload);
    for (const { payload } of interactions.events) {
      expect(Object.isFrozen(payload)).toBe(true);
      expect(payload).not.toHaveProperty("nativeEvent");
      expect(payload).not.toHaveProperty("target");
      expect(payload).not.toHaveProperty("currentTarget");
    }
  });

  it("dispatches fresh inert TextField change payloads without input or event leakage", () => {
    const interactions = interactionHarness();
    const { getByRole } = render(
      adapterElement(TextFieldReactAdapter, { label: "Email", value: "" }, interactions.port),
    );
    const input = getByRole("textbox", { name: "Email" });

    fireEvent.change(input, { target: { value: "first@example.test" } });
    fireEvent.change(input, { target: { value: "second@example.test" } });

    expect(interactions.events).toHaveLength(2);
    expect(interactions.events.map(({ name }) => name)).toEqual(["change", "change"]);
    expect(interactions.events.map(({ payload }) => payload)).toEqual([
      { value: "first@example.test" },
      { value: "second@example.test" },
    ]);
    expect(interactions.events[0]?.payload).not.toBe(interactions.events[1]?.payload);
    for (const { payload } of interactions.events) {
      expect(Object.isFrozen(payload)).toBe(true);
      expect(payload).not.toHaveProperty("nativeEvent");
      expect(payload).not.toHaveProperty("target");
      expect(payload).not.toHaveProperty("currentTarget");
    }
  });

  it("attaches the narrow focus command only after commit and denies every other input", () => {
    const interactions = interactionHarness();
    const element = adapterElement(
      TextFieldReactAdapter,
      { label: "Email", value: "" },
      interactions.port,
    );
    expect(interactions.attached).toHaveLength(0);

    const { getByRole } = render(element);
    expect(interactions.attached).toHaveLength(1);
    const command = interactions.attached[0]?.commands;
    expect(Object.isFrozen(command)).toBe(true);
    expect(command?.invoke("unknown", {})).toEqual({ status: "denied" });
    expect(command?.invoke("focus", { unexpected: true })).toEqual({
      status: "denied",
    });
    expect(command?.invoke("focus", Object.create({ inherited: true }))).toEqual({
      status: "denied",
    });
    expect(command?.invoke("focus", {})).toEqual({ status: "succeeded" });
    expect(document.activeElement).toBe(getByRole("textbox", { name: "Email" }));
    expect(command).not.toHaveProperty("current");
    expect(command).not.toHaveProperty("element");
    expect(command).not.toHaveProperty("node");
  });

  it("detaches each exact attachment on disabled and interaction-port supersession and unmount", () => {
    const first = interactionHarness();
    const second = interactionHarness();
    const { rerender, unmount } = render(
      adapterElement(TextFieldReactAdapter, { label: "Email", value: "" }, first.port),
    );
    const firstAttachment = first.attached[0];
    expect(firstAttachment).toBeDefined();

    rerender(
      adapterElement(
        TextFieldReactAdapter,
        { disabled: true, label: "Email", value: "" },
        first.port,
      ),
    );
    expect(first.detached).toEqual([firstAttachment?.attachment]);
    expect(first.attached).toHaveLength(2);
    expect(firstAttachment?.commands.invoke("focus", {})).toEqual({
      status: "denied",
    });
    expect(first.attached[1]?.commands.invoke("focus", {})).toEqual({
      status: "denied",
    });

    rerender(adapterElement(TextFieldReactAdapter, { label: "Email", value: "" }, second.port));
    expect(first.detached).toEqual([firstAttachment?.attachment, first.attached[1]?.attachment]);
    expect(second.attached).toHaveLength(1);

    unmount();
    expect(second.detached).toEqual([second.attached[0]?.attachment]);
  });

  it("balances StrictMode replay without retaining superseded command authority", () => {
    const interactions = interactionHarness();
    const { unmount } = render(
      <StrictMode>
        {adapterElement(TextFieldReactAdapter, { label: "Email", value: "" }, interactions.port)}
      </StrictMode>,
    );

    expect(interactions.attached).toHaveLength(2);
    expect(interactions.detached).toEqual([interactions.attached[0]?.attachment]);
    expect(interactions.attached[0]?.commands.invoke("focus", {})).toEqual({
      status: "denied",
    });
    expect(interactions.attached[1]?.commands.invoke("focus", {})).toEqual({
      status: "succeeded",
    });

    unmount();
    expect(interactions.detached).toEqual([
      interactions.attached[0]?.attachment,
      interactions.attached[1]?.attachment,
    ]);
  });

  it("creates no command authority during SSR or an abandoned Suspense render", () => {
    const serverInteractions = interactionHarness();
    const html = renderToString(
      adapterElement(
        TextFieldReactAdapter,
        { label: "Server email", value: "" },
        serverInteractions.port,
      ),
    );
    expect(html).toContain("Server email");
    expect(serverInteractions.attached).toHaveLength(0);
    expect(serverInteractions.detached).toHaveLength(0);

    const abandonedInteractions = interactionHarness();
    const { getByText, unmount } = render(
      <Suspense fallback={<span>Suspended</span>}>
        {adapterElement(
          TextFieldReactAdapter,
          { label: "Abandoned email", value: "" },
          abandonedInteractions.port,
        )}
        <SuspendForever />
      </Suspense>,
    );
    expect(getByText("Suspended")).toBeDefined();
    expect(abandonedInteractions.attached).toHaveLength(0);
    expect(abandonedInteractions.detached).toHaveLength(0);
    unmount();
    expect(abandonedInteractions.attached).toHaveLength(0);
    expect(abandonedInteractions.detached).toHaveLength(0);
  });

  it("never spreads semantic style or undeclared props onto native elements", () => {
    const interactions = interactionHarness();
    const hostileText = '<img src=x onerror="compromised()"><script>bad()</script>';
    const hostileStyle = Object.freeze({
      base: Object.freeze({
        root: Object.freeze({
          dangerouslySetInnerHTML: Object.freeze({ __html: "<strong>forged</strong>" }),
          href: "https://example.test/",
          role: "application",
        }),
      }),
    }) as unknown as RuntimeReactComponentAdapterProps["style"];
    const { container, getByRole } = render(
      <>
        {adapterElement(
          StackReactAdapter,
          {
            children: "forged",
            direction: "vertical",
            onClick: () => {
              throw new Error("must not execute");
            },
            role: "application",
            tabIndex: 0,
          },
          interactions.port,
          {
            slots: Object.freeze({
              default: Object.freeze([
                cloneElement(
                  adapterElement(
                    TextReactAdapter,
                    { dangerouslySetInnerHTML: {}, text: hostileText },
                    interactions.port,
                  ),
                  { key: "hostile-text" },
                ),
              ]),
            }),
            style: hostileStyle,
          },
        )}
        {adapterElement(
          TextFieldReactAdapter,
          { "data-private": "forged", label: "Email", name: "private", value: "" },
          interactions.port,
          { style: hostileStyle },
        )}
        {adapterElement(
          ButtonReactAdapter,
          { href: "https://example.test/", label: "Continue", role: "link" },
          interactions.port,
          { style: hostileStyle },
        )}
        {adapterElement(AlertReactAdapter, { text: "Notice", tone: "info" }, interactions.port, {
          style: hostileStyle,
        })}
      </>,
    );

    expect(container.querySelector("[role='application']")).toBeNull();
    expect(container.querySelector("[role='link']")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.querySelector("[name='private']")).toBeNull();
    expect(container.querySelector("[data-private]")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain(hostileText);
    expect(getByRole("textbox", { name: "Email" })).toBeDefined();
    expect(getByRole("button", { name: "Continue" })).toBeDefined();
  });
});
