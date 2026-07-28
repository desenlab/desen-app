// @vitest-environment jsdom

import { StrictMode, Suspense, useLayoutEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { calculateDesenBundleRevision } from "@desen/protocol";
import {
  createRuntimeHostPorts,
  dispatchRuntimeHeadlessSessionEvent,
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
  subscribeRuntimeHeadlessSession,
  unsubscribeRuntimeHeadlessSession,
} from "@desen/runtime-core";

import { useRuntimeReactSessionSurface } from "../src/session-surface.js";
import { cloneJson, createRuntimeReactSessionFixture } from "./session-fixture.js";

import frozenSignInBundle from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import type { ReactElement } from "react";
import type {
  RuntimeHeadlessSessionHandle,
  RuntimeHeadlessSessionSnapshot,
  RuntimeJsonObject,
} from "@desen/runtime-core";
import type {
  RuntimeReactSessionSurfaceInput,
  RuntimeReactSessionSurfaceResult,
} from "../src/session-surface.js";
import type { MutableJsonRecord, RuntimeReactSessionFixture } from "./session-fixture.js";

const fixtures = new Set<RuntimeReactSessionFixture>();

function trackedFixture(): RuntimeReactSessionFixture {
  const fixture = createRuntimeReactSessionFixture();
  fixtures.add(fixture);
  return fixture;
}

function inertPorts() {
  return createRuntimeHostPorts({
    navigation: { navigate: () => ({ status: "succeeded" }) },
    storage: {
      getBundle: () => ({ status: "missing" }),
      putBundle: () => ({ status: "stored" }),
      readActivation: () => ({ status: "missing" }),
      commitActivation: (request) => ({
        status: "committed",
        record: {
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        },
      }),
    },
    operations: { invoke: () => ({ status: "denied" }) },
    resources: { load: () => ({ status: "denied" }) },
    tokens: { resolve: () => ({ status: "missing" }) },
    context: {
      getSnapshot: () => Object.freeze({}) as RuntimeJsonObject,
      subscribe: () => () => undefined,
    },
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
    diagnostics: { report: () => undefined },
  });
}

function limitedFixture(maxSubscriptions: number): RuntimeReactSessionFixture {
  const bundle = cloneJson(frozenSignInBundle) as unknown as MutableJsonRecord;
  bundle.revision = calculateDesenBundleRevision(bundle);
  const catalog = cloneJson(frozenWebCatalog);
  const mounted = mountRuntimeHeadlessSession({
    bundle,
    catalogs: [catalog],
    hostPorts: inertPorts(),
    limits: { maxSubscriptions },
  });
  if (mounted.status !== "mounted") {
    throw new TypeError(`Expected limited fixture to mount: ${mounted.reason}.`);
  }
  const fixture = Object.freeze({
    session: mounted.handle,
    snapshot: mounted.snapshot,
    catalogSet: mounted.catalogSet,
  });
  fixtures.add(fixture);
  return fixture;
}

function currentSnapshot(fixture: RuntimeReactSessionFixture): RuntimeHeadlessSessionSnapshot {
  const read = readRuntimeHeadlessSession(fixture.session);
  if (read.status !== "read")
    throw new TypeError(`Expected live fixture, received ${read.status}.`);
  return read.snapshot;
}

function emailRuntimeInstanceId(snapshot: RuntimeHeadlessSessionSnapshot): string {
  const binding = snapshot.bindings.find(
    (candidate) => candidate.kind === "component" && candidate.sourceNodeId === "sign-in.email",
  );
  if (binding === undefined) throw new TypeError("Expected sign-in.email binding.");
  return binding.runtimeInstanceId;
}

function publishEmail(fixture: RuntimeReactSessionFixture, value: string): Promise<unknown> {
  const snapshot = currentSnapshot(fixture);
  const dispatched = dispatchRuntimeHeadlessSessionEvent(fixture.session, {
    snapshot,
    runtimeInstanceId: emailRuntimeInstanceId(snapshot),
    eventName: "change",
    payload: { value },
  });
  if (dispatched.status !== "dispatched") {
    throw new TypeError(`Expected dispatched change, received ${dispatched.status}.`);
  }
  return dispatched.completion;
}

interface ProbeProps {
  readonly session: RuntimeHeadlessSessionHandle;
  readonly serverSnapshot: RuntimeHeadlessSessionSnapshot;
  readonly observations?: RuntimeReactSessionSurfaceResult[];
  readonly suspendWith?: Promise<never>;
}

function Probe({ session, serverSnapshot, observations, suspendWith }: ProbeProps): ReactElement {
  const result = useRuntimeReactSessionSurface({ session, serverSnapshot });
  observations?.push(result);
  if (suspendWith !== undefined) throw suspendWith;
  return (
    <output data-testid="session-result">
      {result.status === "ready"
        ? `ready:${result.snapshot.documentId}:${result.snapshot.generation}`
        : `failed:${result.reason}`}
    </output>
  );
}

function RawProbe({
  input,
  observations,
}: {
  readonly input: RuntimeReactSessionSurfaceInput;
  readonly observations: RuntimeReactSessionSurfaceResult[];
}): ReactElement {
  const result = useRuntimeReactSessionSurface(input);
  observations.push(result);
  return (
    <output data-testid="session-result">
      {result.status === "ready" ? "ready" : `failed:${result.reason}`}
    </output>
  );
}

afterEach(() => {
  cleanup();
  for (const fixture of fixtures) disposeRuntimeHeadlessSession(fixture.session);
  fixtures.clear();
});

describe("React headless-session surface store", () => {
  it("publishes exact snapshots and preserves the wrapper for repeated reads", async () => {
    const fixture = trackedFixture();
    const observations: RuntimeReactSessionSurfaceResult[] = [];
    const view = render(
      <Probe
        session={fixture.session}
        serverSnapshot={fixture.snapshot}
        observations={observations}
      />,
    );
    const initial = observations.at(-1);
    expect(initial?.status).toBe("ready");
    if (initial?.status !== "ready") return;
    expect(initial.snapshot).toBe(fixture.snapshot);
    expect(Object.isFrozen(initial)).toBe(true);

    view.rerender(
      <Probe
        session={fixture.session}
        serverSnapshot={fixture.snapshot}
        observations={observations}
      />,
    );
    expect(observations.at(-1)).toBe(initial);

    await act(async () => {
      await publishEmail(fixture, "new@example.com");
      await Promise.resolve();
    });
    const published = observations.at(-1);
    expect(published?.status).toBe("ready");
    if (published?.status !== "ready") return;
    expect(published).not.toBe(initial);
    expect(published.snapshot).toBe(currentSnapshot(fixture));
    expect(published.snapshot.generation).toBeGreaterThan(initial.snapshot.generation);
    expect(initial.snapshot.state.email).not.toBe("new@example.com");
    expect(published.snapshot.state.email).toBe("new@example.com");
  });

  it("holds at most one subscription through StrictMode replay and releases it on unmount", () => {
    const fixture = limitedFixture(1);
    const view = render(
      <StrictMode>
        <Probe session={fixture.session} serverSnapshot={fixture.snapshot} />
      </StrictMode>,
    );
    expect(view.getByText(/^ready:/u)).toBeDefined();
    expect(subscribeRuntimeHeadlessSession(fixture.session, () => undefined)).toEqual({
      status: "subscription-limit",
    });

    view.unmount();
    const afterUnmount = subscribeRuntimeHeadlessSession(fixture.session, () => undefined);
    expect(afterUnmount.status).toBe("subscribed");
    if (afterUnmount.status === "subscribed") {
      expect(unsubscribeRuntimeHeadlessSession(afterUnmount.subscription)).toEqual({
        status: "unsubscribed",
      });
    }
  });

  it("switches exact session ownership before queued old-session notices can publish", async () => {
    const first = limitedFixture(1);
    const second = limitedFixture(1);
    const observations: RuntimeReactSessionSurfaceResult[] = [];
    const view = render(
      <Probe session={first.session} serverSnapshot={first.snapshot} observations={observations} />,
    );

    let firstCompletion: Promise<unknown> | undefined;
    act(() => {
      firstCompletion = publishEmail(first, "queued@old.example");
      view.rerender(
        <Probe
          session={second.session}
          serverSnapshot={second.snapshot}
          observations={observations}
        />,
      );
    });
    await act(async () => {
      await firstCompletion;
      await Promise.resolve();
    });

    const afterSwitch = observations.at(-1);
    expect(afterSwitch?.status).toBe("ready");
    if (afterSwitch?.status !== "ready") return;
    expect(afterSwitch.snapshot).toBe(currentSnapshot(second));
    expect(afterSwitch.snapshot.state.email).not.toBe("queued@old.example");

    const oldAdmission = subscribeRuntimeHeadlessSession(first.session, () => undefined);
    expect(oldAdmission.status).toBe("subscribed");
    if (oldAdmission.status === "subscribed") {
      unsubscribeRuntimeHeadlessSession(oldAdmission.subscription);
    }
    expect(subscribeRuntimeHeadlessSession(second.session, () => undefined)).toEqual({
      status: "subscription-limit",
    });

    await act(async () => {
      await publishEmail(second, "current@new.example");
      await Promise.resolve();
    });
    const current = observations.at(-1);
    expect(current?.status).toBe("ready");
    if (current?.status === "ready") {
      expect(current.snapshot).toBe(currentSnapshot(second));
      expect(current.snapshot.state.email).toBe("current@new.example");
    }
  });

  it("replaces initially readable UI with an explicit subscription-limit failure", () => {
    const fixture = limitedFixture(0);
    const view = render(<Probe session={fixture.session} serverSnapshot={fixture.snapshot} />);
    expect(view.getByText("failed:subscription-limit")).toBeDefined();
  });

  it("publishes terminal disposal without retaining the previous managed snapshot", async () => {
    const fixture = trackedFixture();
    const observations: RuntimeReactSessionSurfaceResult[] = [];
    const view = render(
      <Probe
        session={fixture.session}
        serverSnapshot={fixture.snapshot}
        observations={observations}
      />,
    );
    expect(view.getByText(/^ready:/u)).toBeDefined();

    await act(async () => {
      expect(disposeRuntimeHeadlessSession(fixture.session).status).toBe("disposed");
      await Promise.resolve();
    });
    expect(view.getByText("failed:disposed")).toBeDefined();
    const terminal = observations.at(-1);
    expect(terminal).toEqual({ status: "failed", reason: "disposed" });
    expect(terminal).not.toHaveProperty("snapshot");
  });

  it("fails closed when disposal wins between render and commit-time subscription", () => {
    const fixture = limitedFixture(1);

    function DisposeOnCommit(): ReactElement {
      useLayoutEffect(() => {
        disposeRuntimeHeadlessSession(fixture.session);
      }, []);
      return <Probe session={fixture.session} serverSnapshot={fixture.snapshot} />;
    }

    const view = render(<DisposeOnCommit />);
    expect(view.getByText("failed:disposed")).toBeDefined();
  });

  it("classifies forged handles, stale server snapshots, and accessor input without throwing", () => {
    const fixture = trackedFixture();
    const invalidObservations: RuntimeReactSessionSurfaceResult[] = [];
    const invalidHandle = Object.freeze({}) as RuntimeHeadlessSessionHandle;
    const invalid = render(
      <Probe
        session={invalidHandle}
        serverSnapshot={fixture.snapshot}
        observations={invalidObservations}
      />,
    );
    expect(invalid.getByText("failed:invalid-handle")).toBeDefined();
    invalid.unmount();

    const clonedSnapshot = cloneJson(fixture.snapshot);
    expect(
      renderToString(<Probe session={fixture.session} serverSnapshot={clonedSnapshot} />),
    ).toContain("failed:invalid-server-snapshot");

    let getterCalls = 0;
    const hostile = Object.defineProperties(
      {},
      {
        session: {
          enumerable: true,
          get() {
            getterCalls += 1;
            return fixture.session;
          },
        },
        serverSnapshot: {
          enumerable: true,
          value: fixture.snapshot,
        },
      },
    ) as RuntimeReactSessionSurfaceInput;
    const malformedObservations: RuntimeReactSessionSurfaceResult[] = [];
    const malformed = render(<RawProbe input={hostile} observations={malformedObservations} />);
    expect(malformed.getByText("failed:malformed-input")).toBeDefined();
    expect(getterCalls).toBe(0);
  });

  it("uses the exact server snapshot during SSR without acquiring a subscription", () => {
    const zeroCapacity = limitedFixture(0);
    expect(
      renderToString(
        <Probe session={zeroCapacity.session} serverSnapshot={zeroCapacity.snapshot} />,
      ),
    ).toContain(`ready:${zeroCapacity.snapshot.documentId}:${zeroCapacity.snapshot.generation}`);

    const fixture = limitedFixture(1);
    const observations: RuntimeReactSessionSurfaceResult[] = [];
    const html = renderToString(
      <Probe
        session={fixture.session}
        serverSnapshot={fixture.snapshot}
        observations={observations}
      />,
    );
    expect(html).toContain(`ready:${fixture.snapshot.documentId}:${fixture.snapshot.generation}`);
    const serverResult = observations.at(-1);
    expect(serverResult?.status).toBe("ready");
    if (serverResult?.status === "ready") {
      expect(serverResult.snapshot).toBe(fixture.snapshot);
    }

    const admission = subscribeRuntimeHeadlessSession(fixture.session, () => undefined);
    expect(admission.status).toBe("subscribed");
    if (admission.status === "subscribed") {
      unsubscribeRuntimeHeadlessSession(admission.subscription);
    }
  });

  it("grants no subscription authority to Suspense work that never commits", () => {
    const fixture = limitedFixture(1);
    const never = new Promise<never>(() => undefined);
    const view = render(
      <Suspense fallback={<p data-testid="fallback">pending</p>}>
        <Probe session={fixture.session} serverSnapshot={fixture.snapshot} suspendWith={never} />
      </Suspense>,
    );
    expect(view.getByText("pending")).toBeDefined();
    const admission = subscribeRuntimeHeadlessSession(fixture.session, () => undefined);
    expect(admission.status).toBe("subscribed");
    if (admission.status === "subscribed") {
      unsubscribeRuntimeHeadlessSession(admission.subscription);
    }
    view.unmount();
  });

  it("retries a suspended render from the newest exact snapshot", async () => {
    const fixture = limitedFixture(1);
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let suspended = true;

    function RetryProbe(): ReactElement {
      const result = useRuntimeReactSessionSurface({
        session: fixture.session,
        serverSnapshot: fixture.snapshot,
      });
      if (suspended) throw pending;
      return (
        <output data-testid="session-result">
          {result.status === "ready"
            ? `ready:${result.snapshot.generation}:${String(result.snapshot.state.email)}`
            : `failed:${result.reason}`}
        </output>
      );
    }

    const view = render(
      <Suspense fallback={<p data-testid="fallback">pending</p>}>
        <RetryProbe />
      </Suspense>,
    );
    expect(view.getByText("pending")).toBeDefined();
    await act(async () => {
      await publishEmail(fixture, "during-suspense@example.com");
      suspended = false;
      release?.();
      await pending;
      await Promise.resolve();
    });
    const current = currentSnapshot(fixture);
    expect(view.getByText(`ready:${current.generation}:during-suspense@example.com`)).toBeDefined();
  });

  it("does not let an abandoned old-session retry replace a newer live session", async () => {
    const first = limitedFixture(1);
    const second = limitedFixture(1);
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    const view = render(
      <Suspense fallback={<p data-testid="fallback">pending</p>}>
        <Probe
          session={first.session}
          serverSnapshot={first.snapshot}
          suspendWith={pending as Promise<never>}
        />
      </Suspense>,
    );
    expect(view.getByText("pending")).toBeDefined();
    view.rerender(
      <Suspense fallback={<p data-testid="fallback">pending</p>}>
        <Probe session={second.session} serverSnapshot={second.snapshot} />
      </Suspense>,
    );
    expect(view.getByText(new RegExp(`^ready:${second.snapshot.documentId}:`, "u"))).toBeDefined();

    await act(async () => {
      release?.();
      await pending;
      await Promise.resolve();
    });
    expect(view.getByText(new RegExp(`^ready:${second.snapshot.documentId}:`, "u"))).toBeDefined();
    expect(subscribeRuntimeHeadlessSession(second.session, () => undefined)).toEqual({
      status: "subscription-limit",
    });
    const firstAdmission = subscribeRuntimeHeadlessSession(first.session, () => undefined);
    expect(firstAdmission.status).toBe("subscribed");
    if (firstAdmission.status === "subscribed") {
      unsubscribeRuntimeHeadlessSession(firstAdmission.subscription);
    }
  });
});
