// @vitest-environment jsdom
import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import frozenSignInBundle from "../../../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import { mountRuntimeHeadlessSession, readRuntimeHeadlessSession } from "@desen/runtime-core";
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import {
  createRuntimeWebBrowserPlatform,
  createRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "@desen/runtime-web";

import { ReferenceHostManagedSurface } from "../src/managed-surface.js";
import {
  activateReferenceHostSurface,
  authorizeReferenceHostRootRecovery,
  createReferenceHostRoot,
  disposeReferenceHostRoot,
  readReferenceHostRoot,
} from "../src/root.js";

import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";
import type {
  RuntimeContextPort,
  RuntimeDiagnosticsPort,
  RuntimeNavigationPort,
  RuntimeOperationPort,
  RuntimeResourcePort,
  RuntimeStoragePort,
  RuntimeTokenPort,
} from "@desen/runtime-core";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";
import type { ReferenceHostRootHandle } from "../src/root.js";

describe("reference-host root lifecycle", () => {
  let container: HTMLDivElement;
  const roots: ReferenceHostRootHandle[] = [];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    cleanup();
    for (const root of roots) {
      act(() => {
        disposeReferenceHostRoot(root);
      });
    }
    roots.length = 0;
    container.remove();
  });

  it("claims one container, renders boot infrastructure, and disposes idempotently", () => {
    let root: ReferenceHostRootHandle | undefined;
    act(() => {
      root = createReferenceHostRoot({
        container,
        reportDiagnostic: () => undefined,
      });
    });
    if (root === undefined) throw new TypeError("expected root");
    const createdRoot = root;
    roots.push(createdRoot);

    expect(container.textContent).toContain("Waiting for verified activation.");
    expect(readReferenceHostRoot(createdRoot)).toEqual({
      status: "active",
      phase: "booting",
      recoveryKey: null,
    });
    expect(() =>
      createReferenceHostRoot({
        container,
        reportDiagnostic: () => undefined,
      }),
    ).toThrowError("Reference-host container already has a live root.");

    expect(authorizeReferenceHostRootRecovery(createdRoot)).toEqual({ status: "unavailable" });
    act(() => {
      expect(disposeReferenceHostRoot(createdRoot)).toEqual({ status: "disposed" });
    });
    expect(disposeReferenceHostRoot(createdRoot)).toEqual({ status: "already-disposed" });
    expect(readReferenceHostRoot(createdRoot)).toEqual({ status: "disposed" });
    expect(authorizeReferenceHostRootRecovery(createdRoot)).toEqual({ status: "disposed" });

    let replacement: ReferenceHostRootHandle | undefined;
    act(() => {
      replacement = createReferenceHostRoot({
        container,
        reportDiagnostic: () => undefined,
      });
    });
    if (replacement === undefined) throw new TypeError("expected replacement root");
    roots.push(replacement);
  });

  it("rejects accessor-backed creation input without invoking the reporter getter", () => {
    let getterCalls = 0;
    const input = Object.defineProperties(
      {},
      {
        container: { enumerable: true, value: container },
        reportDiagnostic: {
          enumerable: true,
          get() {
            getterCalls += 1;
            return () => undefined;
          },
        },
      },
    );
    expect(() => createReferenceHostRoot(input as never)).toThrowError(
      "Invalid reference-host root input.",
    );
    expect(getterCalls).toBe(0);
  });

  it("routes a controlled invalid session only to the static host failure view", () => {
    const invalidInput = Object.freeze({
      registry: Object.freeze({}),
      session: Object.freeze({}),
      serverSnapshot: Object.freeze({}),
      catalogSet: Object.freeze({}),
    }) as unknown as RuntimeReactLiveSurfaceInput;

    render(
      <ReferenceHostManagedSurface
        input={invalidInput}
        onRequestRecovery={() => undefined}
        recoveryKey="test-only-host-epoch"
      />,
    );
    const text = screen.getByRole("alert").textContent;
    expect(text).toContain("The managed interface stopped safely.");
    expect(text).toContain("SESSION_INVALID_HANDLE");
    expect(text).not.toContain("Error");
  });

  it("preserves ordinary publications and advances only explicit recovery or authority replacement", () => {
    const mounted = createMountedSurface();
    const { hostAuthority, surface } = mounted;
    let root: ReferenceHostRootHandle | undefined;
    act(() => {
      root = createReferenceHostRoot({
        container,
        reportDiagnostic: () => undefined,
      });
    });
    if (root === undefined) throw new TypeError("expected root");
    const createdRoot = root;
    roots.push(createdRoot);

    act(() => {
      expect(activateReferenceHostSurface(createdRoot, { surface, hostAuthority })).toEqual({
        status: "activated",
        relationship: "initial",
      });
    });
    expect(readReferenceHostRoot(createdRoot)).toMatchObject({
      status: "active",
      phase: "surface",
      recoveryKey: "reference-host-authority:0:retry:0",
    });

    act(() => {
      expect(
        activateReferenceHostSurface(createdRoot, {
          surface: Object.freeze({
            ...surface,
          }) as unknown as RuntimeReactLiveSurfaceInput,
          hostAuthority,
        }),
      ).toEqual({
        status: "activated",
        relationship: "preserved",
      });
    });
    expect(readReferenceHostRoot(createdRoot)).toMatchObject({
      recoveryKey: "reference-host-authority:0:retry:0",
    });

    act(() => {
      expect(authorizeReferenceHostRootRecovery(createdRoot)).toEqual({
        status: "authorized",
      });
    });
    expect(readReferenceHostRoot(createdRoot)).toMatchObject({
      recoveryKey: "reference-host-authority:0:retry:1",
    });

    act(() => {
      const replacementRegistry = createRuntimeReactAdapterRegistry({ components: [] });
      if (replacementRegistry.status !== "created") {
        throw new TypeError("expected replacement registry");
      }
      expect(
        activateReferenceHostSurface(createdRoot, {
          surface: Object.freeze({
            ...surface,
            registry: replacementRegistry.handle,
          }),
          hostAuthority,
        }),
      ).toEqual({
        status: "activated",
        relationship: "replaced",
      });
    });
    expect(readReferenceHostRoot(createdRoot)).toMatchObject({
      recoveryKey: "reference-host-authority:1:retry:0",
    });

    act(() => {
      expect(disposeReferenceHostRoot(createdRoot)).toEqual({ status: "disposed" });
    });
    expect(readRuntimeWebHostAuthority(hostAuthority)).toEqual({ status: "disposed" });
    expect(readRuntimeHeadlessSession(mounted.session)).toEqual({ status: "disposed" });
  });
});

function createMountedSurface(): {
  readonly hostAuthority: RuntimeWebHostAuthorityHandle;
  readonly session: Parameters<typeof readRuntimeHeadlessSession>[0];
  readonly surface: RuntimeReactLiveSurfaceInput;
} {
  const hostAuthority = createHostAuthority();
  const hostRead = readRuntimeWebHostAuthority(hostAuthority);
  if (hostRead.status !== "active") throw new TypeError("expected active host authority");
  const mounted = mountRuntimeHeadlessSession({
    bundle: frozenSignInBundle,
    catalogs: [frozenWebCatalog],
    hostPorts: hostRead.hostPorts,
  });
  if (mounted.status !== "mounted") throw new TypeError(`expected mount: ${mounted.reason}`);
  const registry = createRuntimeReactAdapterRegistry({ components: [] });
  if (registry.status !== "created") throw new TypeError(`expected registry: ${registry.reason}`);
  return Object.freeze({
    hostAuthority,
    session: mounted.handle,
    surface: Object.freeze({
      registry: registry.handle,
      session: mounted.handle,
      serverSnapshot: mounted.snapshot,
      catalogSet: mounted.catalogSet,
    }),
  });
}

function createHostAuthority(): RuntimeWebHostAuthorityHandle {
  const platform = createRuntimeWebBrowserPlatform({
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
  });
  if (platform.status !== "created") throw new TypeError("expected platform");

  const navigation: RuntimeNavigationPort = {
    navigate: () => ({ status: "succeeded" }),
  };
  const storage: RuntimeStoragePort = {
    getBundle: () => ({ status: "missing" }),
    putBundle: () => ({ status: "conflict" }),
    readActivation: () => ({ status: "missing" }),
    commitActivation: () => ({ status: "conflict", generation: null }),
  };
  const operations: RuntimeOperationPort = { invoke: () => ({ status: "denied" }) };
  const resources: RuntimeResourcePort = { load: () => ({ status: "denied" }) };
  const tokens: RuntimeTokenPort = { resolve: () => ({ status: "missing" }) };
  const context: RuntimeContextPort = {
    getSnapshot: () => Object.freeze({}),
    subscribe: () => () => undefined,
  };
  const diagnostics: RuntimeDiagnosticsPort = { report: () => undefined };
  const authority = createRuntimeWebHostAuthority({
    platform: platform.handle,
    documentId: frozenSignInBundle.id,
    revision: frozenSignInBundle.revision,
    navigation,
    storage,
    operations,
    resources,
    tokens,
    context,
    diagnostics,
  });
  if (authority.status !== "created") throw new TypeError("expected host authority");
  return authority.handle;
}
