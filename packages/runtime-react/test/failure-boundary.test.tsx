// @vitest-environment jsdom

import { StrictMode, Suspense, useLayoutEffect, useState } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { disposeRuntimeHeadlessSession } from "@desen/runtime-core";

import {
  RuntimeReactSurfaceBoundary,
  createRuntimeReactAdapterRegistry,
  ignoreRuntimeReactRootCaughtError,
  renderRuntimeReactSurface,
  useRuntimeReactSurface,
} from "../src/index.js";
import {
  catalogComponents,
  createReactiveRuntimeReactSessionFixture,
  createRuntimeReactSessionFixture,
  rootNode,
} from "./session-fixture.js";

import type { ReactElement } from "react";
import type {
  RuntimeReactAdapterRegistryHandle,
  RuntimeReactBehaviorAdapterComponent,
  RuntimeReactBehaviorAdapterProps,
  RuntimeReactCommandAttachmentHandle,
  RuntimeReactComponentAdapterComponent,
  RuntimeReactComponentAdapterProps,
  RuntimeReactInteractionPort,
  RuntimeReactLiveSurfaceInput,
  RuntimeReactRenderResult,
  RuntimeReactSurfaceFailure,
  RuntimeReactSurfaceFailureRenderer,
} from "../src/index.js";
import type { MutableJsonRecord, RuntimeReactSessionFixture } from "./session-fixture.js";

const STACK_ID = "com.example.ui/Stack";
const TEXT_ID = "com.example.ui/Text";
const TEXT_FIELD_ID = "com.example.ui/TextField";
const BUTTON_ID = "com.example.ui/Button";
const ALERT_ID = "com.example.ui/Alert";
const SORTABLE_ID = "com.example.interactions/Sortable";
const COMPONENT_CAPABILITIES = Object.freeze([
  ALERT_ID,
  BUTTON_ID,
  STACK_ID,
  TEXT_ID,
  TEXT_FIELD_ID,
]);
const fixtures = new Set<RuntimeReactSessionFixture>();

interface DomContainer {
  querySelector(selector: string): unknown | null;
}

function select(container: unknown, selector: string): unknown | null {
  return (container as DomContainer).querySelector(selector);
}

function textContent(value: unknown): string | null {
  return (value as { readonly textContent: string | null }).textContent;
}

function capturedThrow(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new TypeError("Expected the operation to throw.");
}

interface RegistryOptions {
  readonly component?: RuntimeReactComponentAdapterComponent;
  readonly behavior?: RuntimeReactBehaviorAdapterComponent;
  readonly omittedComponent?: string;
  readonly includeBehavior?: boolean;
  readonly textFieldRemountOnProps?: readonly string[];
}

function slotChildren(props: RuntimeReactComponentAdapterProps): readonly ReactElement[] {
  return Object.keys(props.slots).flatMap(
    (name) => props.slots[name] ?? [],
  ) as readonly ReactElement[];
}

function HealthyComponent(props: RuntimeReactComponentAdapterProps): ReactElement {
  return (
    <section
      data-capability={props.identity.capabilityId}
      data-source-node={props.identity.sourceNodeId}
    >
      {slotChildren(props)}
    </section>
  );
}

function HealthyBehavior(props: RuntimeReactBehaviorAdapterProps): ReactElement {
  return (
    <div data-behavior-id={props.behaviorId} data-source-node={props.identity.sourceNodeId}>
      {props.children}
    </div>
  );
}

function createRegistry(options: RegistryOptions = {}): RuntimeReactAdapterRegistryHandle {
  const result = createRuntimeReactAdapterRegistry({
    components: COMPONENT_CAPABILITIES.filter(
      (capabilityId) => capabilityId !== options.omittedComponent,
    ).map((capabilityId) => ({
      capabilityId,
      component: options.component ?? HealthyComponent,
      ...(capabilityId === TEXT_FIELD_ID && options.textFieldRemountOnProps !== undefined
        ? { remountOnProps: options.textFieldRemountOnProps }
        : {}),
    })),
    ...(options.includeBehavior
      ? {
          behaviors: [
            {
              capabilityId: SORTABLE_ID,
              component: options.behavior ?? HealthyBehavior,
            },
          ],
        }
      : {}),
  });
  if (result.status !== "created") throw new TypeError(`Registry failed: ${result.reason}`);
  return result.handle;
}

function trackFixture(fixture: RuntimeReactSessionFixture): RuntimeReactSessionFixture {
  fixtures.add(fixture);
  return fixture;
}

function compile(
  fixture: RuntimeReactSessionFixture,
  registry: RuntimeReactAdapterRegistryHandle,
): RuntimeReactRenderResult {
  return renderRuntimeReactSurface({
    registry,
    session: fixture.session,
    snapshot: fixture.snapshot,
    catalogSet: fixture.catalogSet,
  });
}

function failureRenderer(
  failures: RuntimeReactSurfaceFailure[],
): RuntimeReactSurfaceFailureRenderer {
  return (failure) => {
    failures.push(failure);
    const code =
      failure.kind === "session"
        ? failure.reason
        : failure.kind === "adapter"
          ? failure.failure.code
          : failure.failure.code;
    return (
      <output data-failure-kind={failure.kind} data-testid="safe-failure">
        {code}
      </output>
    );
  };
}

function addSortableBehavior(bundle: MutableJsonRecord): void {
  const slots = rootNode(bundle).slots as MutableJsonRecord;
  const children = slots.default as MutableJsonRecord[];
  children.push({
    id: "sign-in.sortable-layout",
    use: STACK_ID,
    props: {
      direction: "vertical",
      gap: "sm",
      maxWidth: 240,
    },
    slots: {
      default: [
        {
          id: "sign-in.sortable-label",
          use: TEXT_ID,
          props: { text: "Sortable region", role: "body" },
        },
      ],
    },
    behaviors: [
      {
        id: "sign-in.sortable",
        use: SORTABLE_ID,
        props: { axis: "vertical" },
      },
    ],
  });
}

function LiveBoundaryProbe({
  input,
  renderFailure,
}: {
  readonly input: RuntimeReactLiveSurfaceInput;
  readonly renderFailure: RuntimeReactSurfaceFailureRenderer;
}): ReactElement {
  const result = useRuntimeReactSurface(input);
  return <RuntimeReactSurfaceBoundary result={result} renderFailure={renderFailure} />;
}

afterEach(() => {
  cleanup();
  for (const fixture of fixtures) disposeRuntimeHeadlessSession(fixture.session);
  fixtures.clear();
});

describe("production React failure boundary", () => {
  it("offers a dedicated-root caught-error policy that never inspects raw React payloads", () => {
    let trapCalls = 0;
    const hostile = new Proxy(Object.create(null), {
      get() {
        trapCalls += 1;
        throw new Error("caught-error-get-secret");
      },
      getPrototypeOf() {
        trapCalls += 1;
        throw new Error("caught-error-prototype-secret");
      },
      ownKeys() {
        trapCalls += 1;
        throw new Error("caught-error-keys-secret");
      },
    });

    expect(() => ignoreRuntimeReactRootCaughtError(hostile, hostile)).not.toThrow();
    expect(trapCalls).toBe(0);
  });

  it("keeps unknown component capability as an explicit all-or-nothing preflight failure", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const calls = vi.fn();
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          calls(props.identity);
          return <HealthyComponent {...props} />;
        },
        omittedComponent: TEXT_ID,
      }),
    );

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "UNKNOWN_COMPONENT_CAPABILITY",
        sourceNodeId: "sign-in.title",
        capabilityId: TEXT_ID,
      },
    });
    expect(calls).not.toHaveBeenCalled();

    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );
    expect(textContent(view.getByTestId("safe-failure"))).toBe("UNKNOWN_COMPONENT_CAPABILITY");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      kind: "render",
      failure: { code: "UNKNOWN_COMPONENT_CAPABILITY" },
    });
  });

  it("keeps unknown behavior capability outside adapters and outside ADAPTER_FAILURE", () => {
    const fixture = trackFixture(
      createRuntimeReactSessionFixture({
        mutateBundle: (bundle) => addSortableBehavior(bundle),
      }),
    );
    const calls = vi.fn();
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          calls(props.identity);
          return <HealthyComponent {...props} />;
        },
      }),
    );

    expect(result).toMatchObject({
      status: "failed",
      failure: {
        code: "UNKNOWN_BEHAVIOR_CAPABILITY",
        sourceNodeId: "sign-in.sortable-layout",
        capabilityId: SORTABLE_ID,
      },
    });
    expect(calls).not.toHaveBeenCalled();
    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );
    expect(textContent(view.getByTestId("safe-failure"))).toBe("UNKNOWN_BEHAVIOR_CAPABILITY");
    expect(failures[0]?.kind).toBe("render");
  });

  it("contains an exact leaf-component exception at the whole surface with frozen redacted data", () => {
    const secret = "secret-adapter-message";
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") throw new Error(secret);
          return <HealthyComponent {...props} />;
        },
      }),
    );
    expect(result.status).toBe("rendered");

    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) expect(failure).toEqual(failures[0]);
    expect(failures[0]).toEqual({
      kind: "adapter",
      failure: {
        code: "ADAPTER_FAILURE",
        adapterKind: "component",
        runtimeNodeId: expect.any(String),
        sourceNodeId: "sign-in.email",
        capabilityId: TEXT_FIELD_ID,
        behaviorId: null,
      },
    });
    expect(Object.isFrozen(failures[0])).toBe(true);
    if (failures[0]?.kind !== "adapter") throw new TypeError("Expected adapter failure.");
    expect(Object.isFrozen(failures[0].failure)).toBe(true);
    expect(Reflect.ownKeys(failures[0].failure).sort()).toEqual(
      ["adapterKind", "behaviorId", "capabilityId", "code", "runtimeNodeId", "sourceNodeId"].sort(),
    );
    expect(JSON.stringify(failures[0])).not.toContain(secret);
    expect(JSON.stringify(failures[0])).not.toMatch(/error|stack|cause|componentStack/u);
  });

  it("does not guess behavior identity when a wrapper and its managed child share one boundary", () => {
    const fixture = trackFixture(
      createRuntimeReactSessionFixture({
        mutateBundle: (bundle) => addSortableBehavior(bundle),
      }),
    );
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        includeBehavior: true,
        behavior: () => {
          throw "behavior-secret";
        },
      }),
    );

    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );
    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) expect(failure).toEqual(failures[0]);
    expect(failures[0]).toEqual({
      kind: "adapter",
      failure: {
        code: "ADAPTER_FAILURE",
        adapterKind: null,
        runtimeNodeId: null,
        sourceNodeId: null,
        capabilityId: null,
        behaviorId: null,
      },
    });
    expect(JSON.stringify(failures[0])).not.toContain("behavior-secret");
  });

  it("removes the complete behavior chain when its inner component adapter fails", () => {
    const fixture = trackFixture(
      createRuntimeReactSessionFixture({
        mutateBundle: (bundle) => addSortableBehavior(bundle),
      }),
    );
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        includeBehavior: true,
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.sortable-layout") {
            throw new Error("inner-component-secret");
          }
          return <HealthyComponent {...props} />;
        },
      }),
    );

    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-behavior-id]")).toBeNull();
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) {
      expect(failure).toEqual({
        kind: "adapter",
        failure: {
          code: "ADAPTER_FAILURE",
          adapterKind: null,
          runtimeNodeId: null,
          sourceNodeId: null,
          capabilityId: null,
          behaviorId: null,
        },
      });
    }
    expect(JSON.stringify(failures)).not.toContain("inner-component-secret");
  });

  it("revokes a committed failed component's interaction and command authority", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    let crash: (() => void) | undefined;
    let failedPort: RuntimeReactInteractionPort | undefined;

    function StatefulAdapter(props: RuntimeReactComponentAdapterProps): ReactElement {
      const [shouldCrash, setShouldCrash] = useState(false);
      if (props.identity.sourceNodeId === "sign-in.email") {
        failedPort = props.interactions;
        crash = () => setShouldCrash(true);
        if (shouldCrash) throw new Error("committed-secret");
      }
      return <HealthyComponent {...props} />;
    }

    const result = compile(fixture, createRegistry({ component: StatefulAdapter }));
    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );
    expect(failedPort).toBeDefined();
    expect(crash).toBeDefined();
    if (failedPort === undefined || crash === undefined) return;
    const attachment = failedPort.attachCommands({
      invoke: () => ({ status: "succeeded" }),
    });
    expect(attachment.status).toBe("attached");

    act(() => crash?.());

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failedPort.dispatchEvent("change", { value: "stale@example.com" })).toEqual({
      status: "unavailable",
    });
    if (attachment.status === "attached") {
      expect(failedPort.detachCommands(attachment.attachment)).toEqual({
        status: "unavailable",
      });
    }
  });

  it("contains a layout-effect crash and revokes authority acquired earlier in that commit", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    let failedPort: RuntimeReactInteractionPort | undefined;
    let failedAttachment: RuntimeReactCommandAttachmentHandle | undefined;

    function LayoutEffectCrashAdapter(props: RuntimeReactComponentAdapterProps): ReactElement {
      useLayoutEffect(() => {
        if (props.identity.sourceNodeId !== "sign-in.email") return;
        failedPort = props.interactions;
        const attachment = props.interactions.attachCommands({
          invoke: () => ({ status: "succeeded" }),
        });
        if (attachment.status === "attached") {
          failedAttachment = attachment.attachment;
        }
        throw new Error("layout-effect-secret");
      }, [props.identity.sourceNodeId, props.interactions]);
      return <HealthyComponent {...props} />;
    }

    const view = render(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, createRegistry({ component: LayoutEffectCrashAdapter }))}
        renderFailure={failureRenderer(failures)}
      />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failedPort).toBeDefined();
    expect(failedAttachment).toBeDefined();
    if (failedPort === undefined || failedAttachment === undefined) return;
    expect(failedPort.dispatchEvent("change", { value: "revoked@example.com" })).toEqual({
      status: "unavailable",
    });
    expect(failedPort.detachCommands(failedAttachment)).toEqual({
      status: "unavailable",
    });
    expect(JSON.stringify(failures)).not.toContain("layout-effect-secret");
  });

  it("keeps the outer surface safe when a removed adapter throws from cleanup", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    const renderFailure = failureRenderer(failures);
    let crashOnCleanup = false;

    function CleanupCrashAdapter(props: RuntimeReactComponentAdapterProps): ReactElement {
      useLayoutEffect(() => {
        if (props.identity.sourceNodeId !== "sign-in.email") return;
        return () => {
          if (crashOnCleanup) throw new Error("cleanup-secret");
        };
      }, [props.identity.sourceNodeId]);
      return <HealthyComponent {...props} />;
    }

    const completeRegistry = createRegistry({ component: CleanupCrashAdapter });
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, completeRegistry)}
        renderFailure={renderFailure}
      />,
    );
    expect(select(view.container, '[data-source-node="sign-in.email"]')).not.toBeNull();

    crashOnCleanup = true;
    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={compile(
          fixture,
          createRegistry({
            component: CleanupCrashAdapter,
            omittedComponent: TEXT_ID,
          }),
        )}
        renderFailure={renderFailure}
      />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.at(-1)).toEqual({
      kind: "adapter",
      failure: {
        code: "ADAPTER_FAILURE",
        adapterKind: null,
        runtimeNodeId: null,
        sourceNodeId: null,
        capabilityId: null,
        behaviorId: null,
      },
    });
    expect(JSON.stringify(failures)).not.toContain("cleanup-secret");
  });

  it("does not blame a live parent when a conditional child throws during removal", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: { showEmail: true },
      mutateBundle(bundle) {
        const slots = rootNode(bundle).slots as MutableJsonRecord;
        const children = slots.default as MutableJsonRecord[];
        const email = children.find((candidate) => candidate.id === "sign-in.email");
        if (email === undefined) throw new TypeError("Missing email fixture.");
        email.when = {
          op: "truthy",
          args: [{ $ref: "context.showEmail" }],
        };
      },
    });
    fixtures.add(fixture);
    const failures: RuntimeReactSurfaceFailure[] = [];
    let crashOnCleanup = false;

    function ConditionalCleanupAdapter(props: RuntimeReactComponentAdapterProps): ReactElement {
      useLayoutEffect(() => {
        if (props.identity.sourceNodeId !== "sign-in.email") return;
        return () => {
          if (crashOnCleanup) throw new Error("conditional-cleanup-secret");
        };
      }, [props.identity.sourceNodeId]);
      return <HealthyComponent {...props} />;
    }

    const registry = createRegistry({ component: ConditionalCleanupAdapter });
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, registry)}
        renderFailure={failureRenderer(failures)}
      />,
    );
    expect(select(view.container, '[data-source-node="sign-in.email"]')).not.toBeNull();

    crashOnCleanup = true;
    const successor = await fixture.publishContext({ showEmail: false });
    const next = renderRuntimeReactSurface({
      registry,
      session: fixture.session,
      snapshot: successor,
      catalogSet: fixture.catalogSet,
    });
    view.rerender(
      <RuntimeReactSurfaceBoundary result={next} renderFailure={failureRenderer(failures)} />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.at(-1)).toEqual({
      kind: "adapter",
      failure: {
        code: "ADAPTER_FAILURE",
        adapterKind: null,
        runtimeNodeId: null,
        sourceNodeId: null,
        capabilityId: null,
        behaviorId: null,
      },
    });
    expect(JSON.stringify(failures)).not.toContain("sign-in.layout");
    expect(JSON.stringify(failures)).not.toContain("conditional-cleanup-secret");
  });

  it("preserves host provenance when failure UI throws while being removed", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const hostCleanupError = new Error("host-failure-cleanup");
    const observedFailures: RuntimeReactSurfaceFailure[] = [];
    let crashOnCleanup = false;

    function HostFailureUi(): ReactElement {
      useLayoutEffect(
        () => () => {
          if (crashOnCleanup) throw hostCleanupError;
        },
        [],
      );
      return <output data-testid="host-cleanup-failure">safe</output>;
    }

    const failed = compile(
      fixture,
      createRegistry({
        omittedComponent: TEXT_ID,
      }),
    );
    const healthy = compile(fixture, createRegistry());
    const renderFailure: RuntimeReactSurfaceFailureRenderer = (failure) => {
      observedFailures.push(failure);
      return <HostFailureUi />;
    };
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={failed}
        renderFailure={renderFailure}
        recoveryKey="host-cleanup-1"
      />,
    );
    expect(view.getByTestId("host-cleanup-failure")).toBeDefined();

    crashOnCleanup = true;
    const propagated = capturedThrow(() =>
      view.rerender(
        <RuntimeReactSurfaceBoundary
          result={healthy}
          renderFailure={renderFailure}
          recoveryKey="host-cleanup-1"
        />,
      ),
    );
    crashOnCleanup = false;

    expect(propagated).toMatchObject({
      name: "RuntimeReactFailureRendererThrow",
      message: "The host-owned DESEN failure renderer threw.",
    });
    expect((propagated as { readonly cause?: unknown }).cause).toBe(hostCleanupError);
    expect(observedFailures.length).toBeGreaterThan(0);
    expect(observedFailures.every((failure) => failure.kind === "render")).toBe(true);
  });

  it("classifies a hostile thrown Proxy without invoking its prototype trap", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    let prototypeTrapCalls = 0;
    const hostile = new Proxy(Object.create(null), {
      getPrototypeOf() {
        prototypeTrapCalls += 1;
        throw new Error("prototype-trap-secret");
      },
    });
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") throw hostile;
          return <HealthyComponent {...props} />;
        },
      }),
    );

    const view = render(
      <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(prototypeTrapCalls).toBe(0);
    expect(failures.at(-1)).toMatchObject({
      kind: "adapter",
      failure: {
        adapterKind: "component",
        sourceNodeId: "sign-in.email",
      },
    });
    expect(JSON.stringify(failures)).not.toContain("prototype-trap-secret");
  });

  it("removes a live managed tree and revokes old ports when a replacement registry lacks a capability", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    const ports = new Map<string, RuntimeReactInteractionPort>();
    const component: RuntimeReactComponentAdapterComponent = (props) => {
      ports.set(props.identity.sourceNodeId, props.interactions);
      return <HealthyComponent {...props} />;
    };
    const completeRegistry = createRegistry({ component });
    const missingRegistry = createRegistry({ component, omittedComponent: TEXT_ID });
    const liveInput = (
      registry: RuntimeReactAdapterRegistryHandle,
    ): RuntimeReactLiveSurfaceInput => ({
      registry,
      session: fixture.session,
      serverSnapshot: fixture.snapshot,
      catalogSet: fixture.catalogSet,
    });
    const view = render(
      <LiveBoundaryProbe
        input={liveInput(completeRegistry)}
        renderFailure={failureRenderer(failures)}
      />,
    );
    const oldPort = ports.get("sign-in.email");
    expect(oldPort).toBeDefined();
    expect(select(view.container, '[data-source-node="sign-in.layout"]')).not.toBeNull();
    if (oldPort === undefined) return;

    view.rerender(
      <LiveBoundaryProbe
        input={liveInput(missingRegistry)}
        renderFailure={failureRenderer(failures)}
      />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("UNKNOWN_COMPONENT_CAPABILITY");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(oldPort.dispatchEvent("change", { value: "stale@example.com" })).toEqual({
      status: "unavailable",
    });
    expect(failures.at(-1)).toMatchObject({
      kind: "render",
      failure: { code: "UNKNOWN_COMPONENT_CAPABILITY" },
    });
  });

  it("keeps a failure sticky until the host explicitly authorizes recovery", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    let shouldCrash = true;
    let emailCalls = 0;
    const adapter: RuntimeReactComponentAdapterComponent = (props) => {
      if (props.identity.sourceNodeId === "sign-in.email") {
        emailCalls += 1;
        if (shouldCrash) throw new Error("transient");
      }
      return <HealthyComponent {...props} />;
    };
    const firstRegistry = createRegistry({ component: adapter });
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, firstRegistry)}
        renderFailure={failureRenderer(failures)}
        recoveryKey="authority-1"
      />,
    );
    expect(view.getByTestId("safe-failure")).toBeDefined();
    expect(emailCalls).toBeGreaterThan(0);
    const callsAfterFailure = emailCalls;
    shouldCrash = false;

    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, firstRegistry)}
        renderFailure={failureRenderer(failures)}
        recoveryKey="authority-1"
      />,
    );
    expect(view.getByTestId("safe-failure")).toBeDefined();
    expect(emailCalls).toBe(callsAfterFailure);

    const replacementRegistry = createRegistry({ component: adapter });
    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, replacementRegistry)}
        renderFailure={failureRenderer(failures)}
        recoveryKey="authority-1"
      />,
    );
    expect(view.getByTestId("safe-failure")).toBeDefined();
    expect(emailCalls).toBe(callsAfterFailure);

    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={compile(fixture, replacementRegistry)}
        renderFailure={failureRenderer(failures)}
        recoveryKey="authority-2"
      />,
    );
    expect(view.queryByTestId("safe-failure")).toBeNull();
    expect(select(view.container, '[data-source-node="sign-in.email"]')).not.toBeNull();
    expect(emailCalls).toBeGreaterThan(callsAfterFailure);
  });

  it("does not turn a reconciliation-key change into an implicit crash retry", async () => {
    const fixture = createReactiveRuntimeReactSessionFixture({
      context: { crashMarker: true },
      mutateCatalog(catalog) {
        const textField = catalogComponents(catalog)[TEXT_FIELD_ID] as MutableJsonRecord;
        const propsSchema = textField.propsSchema as MutableJsonRecord;
        const properties = propsSchema.properties as MutableJsonRecord;
        properties.crashMarker = { type: "boolean" };
      },
      mutateBundle(bundle) {
        const slots = rootNode(bundle).slots as MutableJsonRecord;
        const children = slots.default as MutableJsonRecord[];
        const email = children.find((candidate) => candidate.id === "sign-in.email");
        if (email === undefined) throw new TypeError("Missing email fixture.");
        email.props = {
          ...(email.props as MutableJsonRecord),
          crashMarker: { $ref: "context.crashMarker" },
        };
      },
    });
    fixtures.add(fixture);
    const failures: RuntimeReactSurfaceFailure[] = [];
    const adapter: RuntimeReactComponentAdapterComponent = (props) => {
      if (props.identity.sourceNodeId === "sign-in.email" && props.props.crashMarker === true) {
        throw new Error("remount-controlled");
      }
      return <HealthyComponent {...props} />;
    };
    const registry = createRegistry({
      component: adapter,
      textFieldRemountOnProps: ["crashMarker"],
    });
    const initial = compile(fixture, registry);
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={initial}
        renderFailure={failureRenderer(failures)}
        recoveryKey="attempt-1"
      />,
    );
    expect(view.getByTestId("safe-failure")).toBeDefined();

    const successor = await fixture.publishContext({ crashMarker: false });
    const next = renderRuntimeReactSurface({
      registry,
      session: fixture.session,
      snapshot: successor,
      catalogSet: fixture.catalogSet,
    });
    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={next}
        renderFailure={failureRenderer(failures)}
        recoveryKey="attempt-1"
      />,
    );
    expect(view.getByTestId("safe-failure")).toBeDefined();

    view.rerender(
      <RuntimeReactSurfaceBoundary
        result={next}
        renderFailure={failureRenderer(failures)}
        recoveryKey="attempt-2"
      />,
    );
    expect(view.queryByTestId("safe-failure")).toBeNull();
    expect(select(view.container, '[data-source-node="sign-in.email"]')).not.toBeNull();
  });

  it("does not classify Suspense thenables as adapter failures", async () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    let ready = false;
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapter: RuntimeReactComponentAdapterComponent = (props) => {
      if (props.identity.sourceNodeId === "sign-in.email" && !ready) throw pending;
      return <HealthyComponent {...props} />;
    };
    const result = compile(fixture, createRegistry({ component: adapter }));
    const view = render(
      <Suspense fallback={<output data-testid="suspended">suspended</output>}>
        <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />
      </Suspense>,
    );
    expect(view.getByTestId("suspended")).toBeDefined();
    expect(failures).toHaveLength(0);

    await act(async () => {
      ready = true;
      release?.();
      await pending;
    });
    expect(view.queryByTestId("suspended")).toBeNull();
    expect(select(view.container, '[data-source-node="sign-in.email"]')).not.toBeNull();
    expect(failures).toHaveLength(0);
  });

  it("preserves whole-surface containment under React StrictMode replay", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") {
            throw new Error("strict-mode-secret");
          }
          return <HealthyComponent {...props} />;
        },
      }),
    );

    const view = render(
      <StrictMode>
        <RuntimeReactSurfaceBoundary result={result} renderFailure={failureRenderer(failures)} />
      </StrictMode>,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(select(view.container, "[data-source-node]")).toBeNull();
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) {
      expect(failure).toMatchObject({
        kind: "adapter",
        failure: {
          adapterKind: "component",
          sourceNodeId: "sign-in.email",
          capabilityId: TEXT_FIELD_ID,
        },
      });
    }
    expect(JSON.stringify(failures)).not.toContain("strict-mode-secret");
  });

  it("propagates a host failure-renderer exception without blaming an ancestor adapter", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const hostError = new Error("host-failure-renderer");
    const observedFailures: RuntimeReactSurfaceFailure[] = [];
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") {
            throw new Error("adapter-error");
          }
          return <HealthyComponent {...props} />;
        },
      }),
    );

    const propagated = capturedThrow(() =>
      render(
        <RuntimeReactSurfaceBoundary
          result={result}
          renderFailure={(failure) => {
            observedFailures.push(failure);
            throw hostError;
          }}
        />,
      ),
    );

    expect(propagated).not.toBe(hostError);
    expect(propagated).toMatchObject({
      name: "RuntimeReactFailureRendererThrow",
      message: "The host-owned DESEN failure renderer threw.",
    });
    expect((propagated as { readonly cause?: unknown }).cause).toBe(hostError);
    expect(observedFailures.length).toBeGreaterThan(0);
    for (const failure of observedFailures) {
      expect(failure).toMatchObject({
        kind: "adapter",
        failure: {
          adapterKind: "component",
          sourceNodeId: "sign-in.email",
          capabilityId: TEXT_FIELD_ID,
        },
      });
    }
  });

  it("does not permanently exempt a host-thrown Error object when an adapter reuses it later", () => {
    const firstFixture = trackFixture(createRuntimeReactSessionFixture());
    const sharedError = new Error("shared-host-and-adapter-secret");
    const firstResult = compile(
      firstFixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") throw new Error("first-crash");
          return <HealthyComponent {...props} />;
        },
      }),
    );

    const firstThrow = capturedThrow(() =>
      render(
        <RuntimeReactSurfaceBoundary
          result={firstResult}
          renderFailure={() => {
            throw sharedError;
          }}
        />,
      ),
    );
    expect((firstThrow as { readonly cause?: unknown }).cause).toBe(sharedError);
    cleanup();

    const secondFixture = trackFixture(createRuntimeReactSessionFixture());
    const failures: RuntimeReactSurfaceFailure[] = [];
    const secondResult = compile(
      secondFixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") throw sharedError;
          return <HealthyComponent {...props} />;
        },
      }),
    );
    const view = render(
      <RuntimeReactSurfaceBoundary
        result={secondResult}
        renderFailure={failureRenderer(failures)}
      />,
    );

    expect(textContent(view.getByTestId("safe-failure"))).toBe("ADAPTER_FAILURE");
    expect(failures.at(-1)).toMatchObject({
      kind: "adapter",
      failure: {
        adapterKind: "component",
        sourceNodeId: "sign-in.email",
      },
    });
    expect(JSON.stringify(failures)).not.toContain(sharedError.message);
  });

  it("lets a nested controlled failure renderer escape without blaming the outer adapter", () => {
    const innerFixture = trackFixture(createRuntimeReactSessionFixture());
    const innerResult = compile(
      innerFixture,
      createRegistry({
        omittedComponent: TEXT_ID,
      }),
    );
    expect(innerResult.status).toBe("failed");

    const outerFixture = trackFixture(createRuntimeReactSessionFixture());
    const hostError = new Error("nested-host-renderer");
    const outerFailures: RuntimeReactSurfaceFailure[] = [];
    let innerCalls = 0;
    const outerResult = compile(
      outerFixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId !== "sign-in.email") {
            return <HealthyComponent {...props} />;
          }
          return (
            <RuntimeReactSurfaceBoundary
              result={innerResult}
              renderFailure={() => {
                innerCalls += 1;
                throw hostError;
              }}
            />
          );
        },
      }),
    );

    const propagated = capturedThrow(() =>
      render(
        <RuntimeReactSurfaceBoundary
          result={outerResult}
          renderFailure={failureRenderer(outerFailures)}
        />,
      ),
    );

    expect((propagated as { readonly cause?: unknown }).cause).toBe(hostError);
    expect(innerCalls).toBeGreaterThan(0);
    expect(outerFailures).toHaveLength(0);
  });

  it("does not wrap a nested host-failure carrier again inside outer failure UI", () => {
    const innerFixture = trackFixture(createRuntimeReactSessionFixture());
    const outerFixture = trackFixture(createRuntimeReactSessionFixture());
    const innerResult = compile(innerFixture, createRegistry({ omittedComponent: TEXT_ID }));
    const outerResult = compile(outerFixture, createRegistry({ omittedComponent: TEXT_ID }));
    const hostError = new Error("nested-host-failure-ui");

    const propagated = capturedThrow(() =>
      render(
        <RuntimeReactSurfaceBoundary
          result={outerResult}
          renderFailure={() => (
            <RuntimeReactSurfaceBoundary
              result={innerResult}
              renderFailure={() => {
                throw hostError;
              }}
            />
          )}
        />,
      ),
    );

    expect(propagated).toMatchObject({
      name: "RuntimeReactFailureRendererThrow",
      message: "The host-owned DESEN failure renderer threw.",
    });
    expect((propagated as { readonly cause?: unknown }).cause).toBe(hostError);
  });

  it("documents the React SSR boundary by propagating adapter errors to the server host", () => {
    const fixture = trackFixture(createRuntimeReactSessionFixture());
    const serverError = new Error("server-host-must-catch");
    const renderer = vi.fn(() => <output>unused</output>);
    const result = compile(
      fixture,
      createRegistry({
        component: (props) => {
          if (props.identity.sourceNodeId === "sign-in.email") throw serverError;
          return <HealthyComponent {...props} />;
        },
      }),
    );

    expect(() =>
      renderToString(<RuntimeReactSurfaceBoundary result={result} renderFailure={renderer} />),
    ).toThrow(serverError);
    expect(renderer).not.toHaveBeenCalled();
  });
});
