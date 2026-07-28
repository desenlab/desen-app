// @vitest-environment jsdom
import { vi } from "vitest";

import frozenSignInBundle from "../../../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.bundle.json";
import frozenWebCatalog from "../../../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";

import type { RootOptions } from "react-dom/client";

interface MockReactRootRecord {
  readonly container: Element;
  readonly options: RootOptions | undefined;
  readonly render: ReturnType<typeof vi.fn>;
  readonly unmount: ReturnType<typeof vi.fn>;
  unmountFailure: unknown;
}

const reactRootControl = vi.hoisted(() => ({
  records: [] as MockReactRootRecord[],
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn((container: Element, options?: RootOptions) => {
    const record: MockReactRootRecord = {
      container,
      options,
      render: vi.fn(() => undefined),
      unmount: vi.fn(),
      unmountFailure: undefined,
    };
    record.unmount.mockImplementation(() => {
      if (record.unmountFailure !== undefined) throw record.unmountFailure;
    });
    reactRootControl.records.push(record);
    return Object.freeze({
      render: record.render,
      unmount: record.unmount,
    });
  }),
}));

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  disposeRuntimeHeadlessSession,
  mountRuntimeHeadlessSession,
  readRuntimeHeadlessSession,
} from "@desen/runtime-core";
import { createRuntimeReactAdapterRegistry } from "@desen/runtime-react";
import {
  createRuntimeWebBrowserPlatform,
  createRuntimeWebHostAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "@desen/runtime-web";

import {
  activateReferenceHostSurface,
  authorizeReferenceHostRootRecovery,
  createReferenceHostRoot,
  disposeReferenceHostRoot,
  readReferenceHostRoot,
} from "../src/root.js";

import type { RuntimeHeadlessSessionHandle, RuntimeHostPorts } from "@desen/runtime-core";
import type { RuntimeReactLiveSurfaceInput } from "@desen/runtime-react";
import type { RuntimeWebHostAuthorityHandle } from "@desen/runtime-web";

interface MountedSurface {
  readonly authority: RuntimeWebHostAuthorityHandle;
  readonly session: RuntimeHeadlessSessionHandle;
  readonly surface: RuntimeReactLiveSurfaceInput;
}

interface HostileValue {
  readonly value: unknown;
  readonly reflections: () => number;
}

describe("reference-host root security fences", () => {
  const containers: Element[] = [];

  beforeEach(() => {
    reactRootControl.records.length = 0;
  });

  afterEach(() => {
    for (const container of containers) container.remove();
    containers.length = 0;
  });

  it("terminally revokes the exact root, session, and host authority without inspecting uncaught values", () => {
    const reporter = vi.fn();
    const container = appendContainer();
    const root = createReferenceHostRoot({ container, reportDiagnostic: reporter });
    const mounted = createMountedSurface();

    expect(
      activateReferenceHostSurface(root, {
        surface: mounted.surface,
        hostAuthority: mounted.authority,
      }),
    ).toEqual({ status: "activated", relationship: "initial" });

    const hostileError = createHostileValue();
    const hostileInfo = createHostileValue();
    const rootOptions = firstReactRoot().options;
    if (rootOptions?.onUncaughtError === undefined) {
      throw new TypeError("Expected an uncaught-root policy callback.");
    }
    rootOptions.onUncaughtError(hostileError.value, hostileInfo.value as never);

    expect(hostileError.reflections()).toBe(0);
    expect(hostileInfo.reflections()).toBe(0);
    expect(readReferenceHostRoot(root)).toEqual({ status: "disposed" });
    expect(readRuntimeHeadlessSession(mounted.session)).toEqual({ status: "disposed" });
    expect(readRuntimeWebHostAuthority(mounted.authority)).toEqual({ status: "disposed" });
    expect(firstReactRoot().unmount).not.toHaveBeenCalled();
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith({
      code: "REFERENCE_HOST_ROOT_UNCAUGHT",
      source: "reference-host-web",
    });
  });

  it("rejects a session mounted through a host configured for another document authority", () => {
    const container = appendContainer();
    const root = createReferenceHostRoot({
      container,
      reportDiagnostic: () => undefined,
    });
    const mounted = createMountedSurface(() => undefined, {
      documentId: "com.desen.reference-host.other",
      revision: `sha256:${"a".repeat(64)}`,
    });

    expect(
      activateReferenceHostSurface(root, {
        surface: mounted.surface,
        hostAuthority: mounted.authority,
      }),
    ).toEqual({ status: "mismatched-host-authority" });
    expect(readReferenceHostRoot(root)).toEqual({
      status: "active",
      phase: "booting",
      recoveryKey: null,
    });

    // A rejected activation does not transfer either exact authority to the root.
    expect(readRuntimeHeadlessSession(mounted.session).status).toBe("read");
    expect(readRuntimeWebHostAuthority(mounted.authority).status).toBe("active");
    expect(disposeRuntimeHeadlessSession(mounted.session).status).toBe("disposed");
    expect(disposeRuntimeWebHostAuthority(mounted.authority).status).toBe("disposed");
    expect(disposeReferenceHostRoot(root)).toEqual({ status: "disposed" });
  });

  it("rejects a forged executable registry before transferring session or host ownership", () => {
    const container = appendContainer();
    const root = createReferenceHostRoot({
      container,
      reportDiagnostic: () => undefined,
    });
    const mounted = createMountedSurface();

    expect(
      activateReferenceHostSurface(root, {
        surface: Object.freeze({
          ...mounted.surface,
          registry: Object.freeze({}),
        }) as unknown as RuntimeReactLiveSurfaceInput,
        hostAuthority: mounted.authority,
      }),
    ).toEqual({ status: "invalid-registry-authority" });
    expect(readReferenceHostRoot(root)).toEqual({
      status: "active",
      phase: "booting",
      recoveryKey: null,
    });

    expect(readRuntimeHeadlessSession(mounted.session).status).toBe("read");
    expect(readRuntimeWebHostAuthority(mounted.authority).status).toBe("active");
    expect(disposeRuntimeHeadlessSession(mounted.session).status).toBe("disposed");
    expect(disposeRuntimeWebHostAuthority(mounted.authority).status).toBe("disposed");
    expect(disposeReferenceHostRoot(root)).toEqual({ status: "disposed" });
  });

  it("rejects reentrant replacement, recovery, and disposal without installing or leaking a third authority", () => {
    const container = appendContainer();
    const root = createReferenceHostRoot({
      container,
      reportDiagnostic: () => undefined,
    });
    let reentrantActivation: ReturnType<typeof activateReferenceHostSurface> | undefined;
    let reentrantRecovery: ReturnType<typeof authorizeReferenceHostRootRecovery> | undefined;
    let reentrantDisposal: ReturnType<typeof disposeReferenceHostRoot> | undefined;
    let cleanupCalls = 0;

    const third = createMountedSurface();
    const first = createMountedSurface(() => {
      cleanupCalls += 1;
      reentrantActivation = activateReferenceHostSurface(root, {
        surface: third.surface,
        hostAuthority: third.authority,
      });
      reentrantRecovery = authorizeReferenceHostRootRecovery(root);
      reentrantDisposal = disposeReferenceHostRoot(root);
    });
    const second = createMountedSurface();

    expect(
      activateReferenceHostSurface(root, {
        surface: first.surface,
        hostAuthority: first.authority,
      }),
    ).toEqual({ status: "activated", relationship: "initial" });

    expect(
      activateReferenceHostSurface(root, {
        surface: second.surface,
        hostAuthority: second.authority,
      }),
    ).toEqual({ status: "disposed" });

    expect(cleanupCalls).toBe(1);
    expect(reentrantActivation).toEqual({ status: "transition-in-progress" });
    expect(reentrantRecovery).toEqual({ status: "transition-in-progress" });
    expect(reentrantDisposal).toEqual({ status: "disposed" });
    expect(readReferenceHostRoot(root)).toEqual({ status: "disposed" });
    expect(readRuntimeHeadlessSession(first.session)).toEqual({ status: "disposed" });
    expect(readRuntimeWebHostAuthority(first.authority)).toEqual({ status: "disposed" });
    expect(readRuntimeHeadlessSession(second.session)).toEqual({ status: "disposed" });
    expect(readRuntimeWebHostAuthority(second.authority)).toEqual({ status: "disposed" });

    // Rejected activation never transfers caller ownership of the third authority to the root.
    expect(readRuntimeHeadlessSession(third.session).status).toBe("read");
    expect(readRuntimeWebHostAuthority(third.authority).status).toBe("active");
    expect(disposeRuntimeHeadlessSession(third.session).status).toBe("disposed");
    expect(disposeRuntimeWebHostAuthority(third.authority).status).toBe("disposed");
    expect(firstReactRoot().render).toHaveBeenCalledTimes(2);
    expect(firstReactRoot().unmount).toHaveBeenCalledTimes(1);
  });

  it("tombstones failed unmounts while releasing only containers with confirmed unmounts", () => {
    const reporter = vi.fn();
    const failedContainer = appendContainer();
    const failedRoot = createReferenceHostRoot({
      container: failedContainer,
      reportDiagnostic: reporter,
    });
    firstReactRoot().unmountFailure = new Error("test-only opaque unmount failure");

    expect(disposeReferenceHostRoot(failedRoot)).toEqual({ status: "disposed" });
    expect(readReferenceHostRoot(failedRoot)).toEqual({ status: "disposed" });
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith({
      code: "REFERENCE_HOST_ROOT_UNMOUNT_FAILED",
      source: "reference-host-web",
    });
    expect(() =>
      createReferenceHostRoot({
        container: failedContainer,
        reportDiagnostic: () => undefined,
      }),
    ).toThrowError("Reference-host container already has a live root.");

    const releasedContainer = appendContainer();
    const releasedRoot = createReferenceHostRoot({
      container: releasedContainer,
      reportDiagnostic: () => undefined,
    });
    expect(disposeReferenceHostRoot(releasedRoot)).toEqual({ status: "disposed" });

    const replacement = createReferenceHostRoot({
      container: releasedContainer,
      reportDiagnostic: () => undefined,
    });
    expect(readReferenceHostRoot(replacement)).toEqual({
      status: "active",
      phase: "booting",
      recoveryKey: null,
    });
    expect(disposeReferenceHostRoot(replacement)).toEqual({ status: "disposed" });
  });

  function appendContainer(): HTMLDivElement {
    const container = document.createElement("div");
    document.body.append(container);
    containers.push(container);
    return container;
  }
});

function firstReactRoot(): MockReactRootRecord {
  const record = reactRootControl.records[0];
  if (record === undefined) throw new TypeError("Expected one mocked React root.");
  return record;
}

function createHostileValue(): HostileValue {
  let reflections = 0;
  const reject = (): never => {
    reflections += 1;
    throw new TypeError("Raw failure data must remain opaque.");
  };
  return Object.freeze({
    value: new Proxy(Object.create(null) as object, {
      defineProperty: reject,
      deleteProperty: reject,
      get: reject,
      getOwnPropertyDescriptor: reject,
      getPrototypeOf: reject,
      has: reject,
      isExtensible: reject,
      ownKeys: reject,
      preventExtensions: reject,
      set: reject,
      setPrototypeOf: reject,
    }),
    reflections: () => reflections,
  });
}

function createMountedSurface(
  onContextCleanup: () => void = () => undefined,
  identity: Readonly<{ readonly documentId: string; readonly revision: string }> = Object.freeze({
    documentId: frozenSignInBundle.id,
    revision: frozenSignInBundle.revision,
  }),
): MountedSurface {
  const platform = createRuntimeWebBrowserPlatform({
    environment: {
      getSnapshot: () => Object.freeze({ platform: "web" }),
      subscribe: () => () => undefined,
    },
    clock: { now: () => 1 },
  });
  if (platform.status !== "created") throw new TypeError("Expected a browser platform.");

  const authority = createRuntimeWebHostAuthority({
    platform: platform.handle,
    documentId: identity.documentId,
    revision: identity.revision,
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
      getSnapshot: () => Object.freeze({}),
      subscribe: () => onContextCleanup,
    },
    diagnostics: { report: () => undefined },
  });
  if (authority.status !== "created") throw new TypeError("Expected a web host authority.");
  const hostRead = readRuntimeWebHostAuthority(authority.handle);
  if (hostRead.status !== "active") throw new TypeError("Expected active host ports.");

  const mounted = mountRuntimeHeadlessSession({
    bundle: frozenSignInBundle,
    catalogs: [frozenWebCatalog],
    hostPorts: hostRead.hostPorts as RuntimeHostPorts,
  });
  if (mounted.status !== "mounted") {
    disposeRuntimeWebHostAuthority(authority.handle);
    throw new TypeError(`Expected mounted sign-in session: ${mounted.reason}`);
  }
  const registry = createRuntimeReactAdapterRegistry({ components: [] });
  if (registry.status !== "created") {
    disposeRuntimeHeadlessSession(mounted.handle);
    disposeRuntimeWebHostAuthority(authority.handle);
    throw new TypeError(`Expected executable registry: ${registry.reason}`);
  }
  return Object.freeze({
    authority: authority.handle,
    session: mounted.handle,
    surface: Object.freeze({
      registry: registry.handle,
      session: mounted.handle,
      serverSnapshot: mounted.snapshot,
      catalogSet: mounted.catalogSet,
    }),
  });
}
