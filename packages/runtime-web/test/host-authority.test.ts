import { describe, expect, it, vi } from "vitest";

import {
  authenticateRuntimeWebHostDocumentAuthority,
  createRuntimeWebBrowserPlatform,
  createRuntimeWebHostAuthority,
  disposeRuntimeWebHostAuthority,
  readRuntimeWebHostAuthority,
} from "../src/index.js";

import type {
  RuntimeWebBrowserPlatformCreateInput,
  RuntimeWebBrowserPlatformHandle,
  RuntimeWebHostAuthorityCreateInput,
  RuntimeWebHostAuthorityHandle,
} from "../src/index.js";
import type { RuntimeHostPorts, RuntimeNavigationRequest } from "@desen/runtime-core";

const DOCUMENT_ID = "run.desen.reference.sign-in";
const REVISION = `sha256:${"a".repeat(64)}`;
const NEXT_REVISION = `sha256:${"b".repeat(64)}`;
const REQUEST_CONTEXT = Object.freeze({
  documentId: DOCUMENT_ID,
  revision: REVISION,
  surfaceId: "sign-in",
  requestId: "request-1",
});

function browserPlatformInput(): RuntimeWebBrowserPlatformCreateInput {
  return {
    environment: {
      getSnapshot: vi.fn(() => ({
        viewport: { width: 1280, height: 720, orientation: "landscape" },
        pointer: "fine",
        colorScheme: "dark",
        reducedMotion: false,
        locale: "tr-TR",
        platform: "web",
      })),
      subscribe: vi.fn((listener: () => void) => {
        void listener;
        return vi.fn();
      }),
    },
    clock: {
      now: vi.fn(() => 1_785_000_000_000),
    },
  };
}

function createdPlatform(
  input: RuntimeWebBrowserPlatformCreateInput = browserPlatformInput(),
): RuntimeWebBrowserPlatformHandle {
  const result = createRuntimeWebBrowserPlatform(input);
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("test platform was rejected");
  return result.handle;
}

function hostDelegateInput() {
  return {
    navigation: {
      navigate: vi.fn(() => ({ status: "succeeded" as const })),
    },
    storage: {
      getBundle: vi.fn(() => ({ status: "missing" as const })),
      putBundle: vi.fn(() => ({ status: "stored" as const })),
      readActivation: vi.fn(() => ({ status: "missing" as const })),
      commitActivation: vi.fn(() => ({
        status: "committed" as const,
        record: {
          activeRevision: REVISION,
          previousGoodRevision: null,
          generation: 0,
        },
      })),
    },
    operations: {
      invoke: vi.fn(() => ({
        status: "succeeded" as const,
        value: { authenticated: true },
      })),
    },
    resources: {
      load: vi.fn(() => ({
        status: "failed" as const,
        errorCode: "offline",
      })),
    },
    tokens: {
      resolve: vi.fn(() => ({
        status: "resolved" as const,
        value: "#1d4ed8",
      })),
    },
    context: {
      getSnapshot: vi.fn(() => ({ tenant: "tenant-1" })),
      subscribe: vi.fn((listener: () => void) => {
        void listener;
        return vi.fn();
      }),
    },
    diagnostics: {
      report: vi.fn(),
    },
  };
}

function authorityInput(
  platform: RuntimeWebBrowserPlatformHandle,
  delegates = hostDelegateInput(),
): RuntimeWebHostAuthorityCreateInput {
  return {
    platform,
    documentId: DOCUMENT_ID,
    revision: REVISION,
    ...delegates,
  };
}

function createdAuthority(
  input: RuntimeWebHostAuthorityCreateInput = authorityInput(createdPlatform()),
): RuntimeWebHostAuthorityHandle {
  const result = createRuntimeWebHostAuthority(input);
  expect(result.status).toBe("created");
  if (result.status !== "created") throw new Error("test authority was rejected");
  return result.handle;
}

function activePorts(handle: RuntimeWebHostAuthorityHandle): RuntimeHostPorts {
  const result = readRuntimeWebHostAuthority(handle);
  expect(result.status).toBe("active");
  if (result.status !== "active") throw new Error("test authority was not active");
  return result.hostPorts;
}

function navigationRequest(
  context: RuntimeNavigationRequest["context"] = REQUEST_CONTEXT,
): RuntimeNavigationRequest {
  return {
    context,
    targetSurfaceId: "success",
    params: { source: "sign-in" },
  };
}

function operationRequest() {
  return {
    context: REQUEST_CONTEXT,
    capabilityId: "com.example.auth/signIn",
    invocationAlias: "signIn",
    input: { email: "person@example.test", password: "synthetic-only" },
    effect: "network" as const,
  };
}

function resourceRequest() {
  return {
    context: { ...REQUEST_CONTEXT, requestId: "request-2" },
    instanceId: "profile",
    capabilityId: "com.example.profile/current",
    input: {},
  };
}

function allMockCallbacks(input: object): readonly ReturnType<typeof vi.fn>[] {
  const callbacks: ReturnType<typeof vi.fn>[] = [];
  for (const port of Object.values(input)) {
    if (typeof port !== "object" || port === null) continue;
    for (const value of Object.values(port)) {
      if (typeof value === "function" && "mock" in value) {
        callbacks.push(value as ReturnType<typeof vi.fn>);
      }
    }
  }
  return callbacks;
}

describe("runtime-web browser platform and host authority", () => {
  it("captures exact own-data factories without invoking any of the fourteen host callbacks", () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    const platformResult = createRuntimeWebBrowserPlatform(platformInput);
    expect(platformResult.status).toBe("created");
    if (platformResult.status !== "created") return;

    const authorityResult = createRuntimeWebHostAuthority(
      authorityInput(platformResult.handle, delegates),
    );
    expect(authorityResult.status).toBe("created");
    if (authorityResult.status !== "created") return;

    for (const callback of [...allMockCallbacks(platformInput), ...allMockCallbacks(delegates)]) {
      expect(callback).not.toHaveBeenCalled();
    }

    const read = readRuntimeWebHostAuthority(authorityResult.handle);
    expect(read.status).toBe("active");
    if (read.status !== "active") return;
    expect(Object.isFrozen(read)).toBe(true);
    expect(Object.isFrozen(read.hostPorts)).toBe(true);
    expect(Object.keys(read.hostPorts)).toEqual([
      "navigation",
      "storage",
      "operations",
      "resources",
      "tokens",
      "context",
      "environment",
      "clock",
      "diagnostics",
    ]);
    expect(
      Object.values(read.hostPorts).reduce(
        (count, port) =>
          count + Object.values(port).filter((value) => typeof value === "function").length,
        0,
      ),
    ).toBe(14);
    for (const port of Object.values(read.hostPorts)) {
      expect(Object.isFrozen(port)).toBe(true);
      for (const key of Object.keys(port)) {
        expect(Object.getOwnPropertyDescriptor(port, key)).toMatchObject({
          value: expect.any(Function),
        });
      }
    }
  });

  it("authenticates only the exact configured document and revision without exposing authority", () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput), delegates));

    const authenticated = authenticateRuntimeWebHostDocumentAuthority(handle, {
      documentId: DOCUMENT_ID,
      revision: REVISION,
    });
    expect(authenticated).toEqual({ status: "authenticated" });
    expect(Object.isFrozen(authenticated)).toBe(true);
    expect(Reflect.ownKeys(authenticated)).toEqual(["status"]);
    expect("hostPorts" in authenticated).toBe(false);
    expect("delegates" in authenticated).toBe(false);

    const documentMismatch = authenticateRuntimeWebHostDocumentAuthority(handle, {
      documentId: "run.desen.reference.other",
      revision: REVISION,
    });
    const revisionMismatch = authenticateRuntimeWebHostDocumentAuthority(handle, {
      documentId: DOCUMENT_ID,
      revision: NEXT_REVISION,
    });
    expect(documentMismatch).toEqual({ status: "mismatched-document-authority" });
    expect(revisionMismatch).toEqual({ status: "mismatched-document-authority" });
    expect(Object.isFrozen(documentMismatch)).toBe(true);
    expect(Object.isFrozen(revisionMismatch)).toBe(true);
    for (const callback of [...allMockCallbacks(platformInput), ...allMockCallbacks(delegates)]) {
      expect(callback).not.toHaveBeenCalled();
    }
    expect(disposeRuntimeWebHostAuthority(handle).status).toBe("disposed");
  });

  it("captures an exact own-data envelope without accessors, property gets, or inner reflection", () => {
    const handle = createdAuthority();
    let propertyGets = 0;
    const proxiedEnvelope = new Proxy(
      {
        documentId: DOCUMENT_ID,
        revision: REVISION,
      },
      {
        get() {
          propertyGets += 1;
          throw new Error("document authority must use own-data descriptors");
        },
      },
    );
    expect(authenticateRuntimeWebHostDocumentAuthority(handle, proxiedEnvelope)).toEqual({
      status: "authenticated",
    });
    expect(propertyGets).toBe(0);

    let accessorReads = 0;
    const accessorEnvelope = { revision: REVISION };
    Object.defineProperty(accessorEnvelope, "documentId", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return DOCUMENT_ID;
      },
    });
    expect(authenticateRuntimeWebHostDocumentAuthority(handle, accessorEnvelope as never)).toEqual({
      status: "malformed-request",
    });
    expect(accessorReads).toBe(0);

    let innerReflections = 0;
    const hostileDocumentId = new Proxy(
      {},
      {
        get() {
          innerReflections += 1;
          throw new Error("inner values must remain inert");
        },
        getPrototypeOf() {
          innerReflections += 1;
          throw new Error("inner values must remain inert");
        },
        ownKeys() {
          innerReflections += 1;
          throw new Error("inner values must remain inert");
        },
      },
    );
    expect(
      authenticateRuntimeWebHostDocumentAuthority(handle, {
        documentId: hostileDocumentId,
        revision: REVISION,
      } as never),
    ).toEqual({ status: "malformed-request" });
    expect(innerReflections).toBe(0);

    const nonEnumerableEnvelope = { documentId: DOCUMENT_ID };
    Object.defineProperty(nonEnumerableEnvelope, "revision", {
      enumerable: false,
      value: REVISION,
    });
    const symbolicEnvelope = {
      documentId: DOCUMENT_ID,
      revision: REVISION,
      [Symbol("hidden")]: true,
    };
    for (const input of [
      [],
      Object.assign(Object.create({}), {
        documentId: DOCUMENT_ID,
        revision: REVISION,
      }),
      {},
      { documentId: DOCUMENT_ID },
      { documentId: DOCUMENT_ID, revision: REVISION, hostPorts: {} },
      { documentId: "", revision: REVISION },
      { documentId: `${DOCUMENT_ID}\u0000`, revision: REVISION },
      { documentId: DOCUMENT_ID, revision: "not-a-revision" },
      nonEnumerableEnvelope,
      symbolicEnvelope,
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("reflection denied");
          },
        },
      ),
    ]) {
      const result = authenticateRuntimeWebHostDocumentAuthority(handle, input as never);
      expect(result).toEqual({ status: "malformed-request" });
      expect(Object.isFrozen(result)).toBe(true);
    }

    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(authenticateRuntimeWebHostDocumentAuthority(handle, revoked.proxy as never)).toEqual({
      status: "malformed-request",
    });
    expect(disposeRuntimeWebHostAuthority(handle).status).toBe("disposed");
  });

  it("short-circuits disposed and forged handles before reflecting over caller input", () => {
    const handle = createdAuthority();
    expect(disposeRuntimeWebHostAuthority(handle).status).toBe("disposed");
    let reflections = 0;
    const hostileInput = new Proxy(
      {},
      {
        getPrototypeOf() {
          reflections += 1;
          throw new Error("must not reflect");
        },
        ownKeys() {
          reflections += 1;
          throw new Error("must not reflect");
        },
        getOwnPropertyDescriptor() {
          reflections += 1;
          throw new Error("must not reflect");
        },
      },
    );
    const forged = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("must not reflect forged handles");
        },
      },
    ) as RuntimeWebHostAuthorityHandle;

    const disposed = authenticateRuntimeWebHostDocumentAuthority(handle, hostileInput as never);
    const invalid = authenticateRuntimeWebHostDocumentAuthority(forged, hostileInput as never);
    expect(disposed).toEqual({ status: "disposed" });
    expect(invalid).toEqual({ status: "invalid-authority" });
    expect(
      authenticateRuntimeWebHostDocumentAuthority(null as never, hostileInput as never),
    ).toEqual({ status: "invalid-authority" });
    expect(reflections).toBe(0);
    expect(Object.isFrozen(disposed)).toBe(true);
    expect(Object.isFrozen(invalid)).toBe(true);
  });

  it("rechecks the exact authority after request reflection reenters disposal", () => {
    const handle = createdAuthority();
    const reentrantInput = new Proxy(
      {
        documentId: DOCUMENT_ID,
        revision: REVISION,
      },
      {
        getPrototypeOf(input) {
          expect(disposeRuntimeWebHostAuthority(handle)).toEqual({
            status: "disposed",
            unsubscribed: 0,
          });
          return Reflect.getPrototypeOf(input);
        },
      },
    );

    expect(authenticateRuntimeWebHostDocumentAuthority(handle, reentrantInput)).toEqual({
      status: "disposed",
    });
    expect(readRuntimeWebHostAuthority(handle)).toEqual({ status: "disposed" });
  });

  it("delegates all trusted ports and detaches browser environment snapshots", async () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput), delegates));
    const ports = activePorts(handle);

    expect(ports.navigation.navigate(navigationRequest())).toEqual({ status: "succeeded" });
    await expect(Promise.resolve(ports.storage.getBundle(REVISION))).resolves.toEqual({
      status: "missing",
    });
    await expect(
      Promise.resolve(
        ports.storage.putBundle({
          revision: REVISION,
          bytes: new Uint8Array([1, 2, 3]),
        }),
      ),
    ).resolves.toEqual({ status: "stored" });
    await expect(Promise.resolve(ports.storage.readActivation())).resolves.toEqual({
      status: "missing",
    });
    await expect(
      Promise.resolve(
        ports.storage.commitActivation({
          expectedGeneration: null,
          activeRevision: REVISION,
          previousGoodRevision: null,
        }),
      ),
    ).resolves.toMatchObject({ status: "committed" });
    await expect(Promise.resolve(ports.operations.invoke(operationRequest()))).resolves.toEqual({
      status: "succeeded",
      value: { authenticated: true },
    });
    await expect(Promise.resolve(ports.resources.load(resourceRequest()))).resolves.toEqual({
      status: "failed",
      errorCode: "offline",
    });
    expect(
      ports.tokens.resolve({
        context: { ...REQUEST_CONTEXT, requestId: "request-3" },
        token: "color.action.primary",
      }),
    ).toEqual({ status: "resolved", value: "#1d4ed8" });
    expect(ports.context.getSnapshot()).toEqual({ tenant: "tenant-1" });

    const source = platformInput.environment.getSnapshot();
    vi.mocked(platformInput.environment.getSnapshot).mockReturnValueOnce(source);
    const environment = ports.environment.getSnapshot();
    expect(environment).toEqual(source);
    expect(environment).not.toBe(source);
    expect(Object.isFrozen(environment)).toBe(true);
    expect(Object.isFrozen(environment.viewport)).toBe(true);
    expect(ports.clock.now()).toBe(1_785_000_000_000);

    const diagnostic = {
      code: "run.desen.runtime-web/HOST_OBSERVED",
      message: "Safe diagnostic.",
    } as Parameters<RuntimeHostPorts["diagnostics"]["report"]>[0];
    expect(() => ports.diagnostics.report(diagnostic)).not.toThrow();
    expect(delegates.diagnostics.report).toHaveBeenCalledWith(diagnostic);
  });

  it("asserts the exact configured document and revision before navigation delegation", () => {
    const delegates = hostDelegateInput();
    const handle = createdAuthority(authorityInput(createdPlatform(), delegates));
    const ports = activePorts(handle);

    expect(ports.navigation.navigate(navigationRequest())).toEqual({ status: "succeeded" });
    expect(delegates.navigation.navigate).toHaveBeenCalledTimes(1);

    expect(
      ports.navigation.navigate(
        navigationRequest({ ...REQUEST_CONTEXT, documentId: "other.document" }),
      ),
    ).toEqual({ status: "denied" });
    expect(
      ports.navigation.navigate(navigationRequest({ ...REQUEST_CONTEXT, revision: NEXT_REVISION })),
    ).toEqual({ status: "denied" });
    expect(delegates.navigation.navigate).toHaveBeenCalledTimes(1);

    const contextGetter = vi.fn(() => REQUEST_CONTEXT);
    const accessorRequest = {
      get context() {
        return contextGetter();
      },
      targetSurfaceId: "success",
      params: {},
    } as unknown as RuntimeNavigationRequest;
    expect(ports.navigation.navigate(accessorRequest)).toEqual({ status: "denied" });
    expect(contextGetter).not.toHaveBeenCalled();

    const hostileRequest = new Proxy(navigationRequest(), {
      ownKeys() {
        throw new Error("secret request trap");
      },
    });
    expect(ports.navigation.navigate(hostileRequest)).toEqual({ status: "denied" });
    expect(delegates.navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("denies a navigation result when the delegate reentrantly disposes its authority", () => {
    const platform = createdPlatform();
    const delegates = hostDelegateInput();
    const control: { handle?: RuntimeWebHostAuthorityHandle } = {};
    delegates.navigation.navigate.mockImplementation(() => {
      if (control.handle !== undefined) disposeRuntimeWebHostAuthority(control.handle);
      return { status: "succeeded" };
    });
    const result = createRuntimeWebHostAuthority(authorityInput(platform, delegates));
    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    control.handle = result.handle;
    const ports = activePorts(result.handle);

    expect(ports.navigation.navigate(navigationRequest())).toEqual({ status: "denied" });
    expect(readRuntimeWebHostAuthority(result.handle)).toEqual({ status: "disposed" });
  });

  it("keeps environment observations inert and returns the last valid snapshot on hostile input", () => {
    const platformInput = browserPlatformInput();
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput)));
    const ports = activePorts(handle);
    const baseline = ports.environment.getSnapshot();

    const getter = vi.fn(() => "not data");
    const accessorSnapshot = {};
    Object.defineProperty(accessorSnapshot, "locale", {
      enumerable: true,
      get: getter,
    });
    vi.mocked(platformInput.environment.getSnapshot).mockReturnValueOnce(accessorSnapshot as never);
    expect(ports.environment.getSnapshot()).toBe(baseline);
    expect(getter).not.toHaveBeenCalled();

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    vi.mocked(platformInput.environment.getSnapshot).mockReturnValueOnce(cyclic as never);
    expect(ports.environment.getSnapshot()).toBe(baseline);

    vi.mocked(platformInput.environment.getSnapshot).mockImplementationOnce(() => {
      throw new Error("secret platform error");
    });
    expect(ports.environment.getSnapshot()).toBe(baseline);

    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("secret prototype trap");
        },
      },
    );
    vi.mocked(platformInput.environment.getSnapshot).mockReturnValueOnce(hostile);
    expect(ports.environment.getSnapshot()).toBe(baseline);
  });

  it("provides a non-decreasing epoch clock without sampling it during construction", () => {
    const platformInput = browserPlatformInput();
    const now = vi.mocked(platformInput.clock.now);
    now
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(90)
      .mockReturnValueOnce(Number.NaN)
      .mockReturnValueOnce(150)
      .mockImplementationOnce(() => {
        throw new Error("secret clock error");
      });
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput)));
    const ports = activePorts(handle);

    expect(now).not.toHaveBeenCalled();
    expect([
      ports.clock.now(),
      ports.clock.now(),
      ports.clock.now(),
      ports.clock.now(),
      ports.clock.now(),
    ]).toEqual([100, 100, 100, 150, 150]);
  });

  it("fences subscriptions, unsubscribes exactly once, and ignores late notices", () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    let contextNotice: (() => void) | undefined;
    let environmentNotice: (() => void) | undefined;
    const contextUnsubscribe = vi.fn();
    const environmentUnsubscribe = vi.fn();
    delegates.context.subscribe.mockImplementation((listener) => {
      contextNotice = listener;
      return contextUnsubscribe;
    });
    vi.mocked(platformInput.environment.subscribe).mockImplementation((listener) => {
      environmentNotice = listener;
      return environmentUnsubscribe;
    });
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput), delegates));
    const ports = activePorts(handle);
    const contextListener = vi.fn();
    const environmentListener = vi.fn();
    const unsubscribeContext = ports.context.subscribe(contextListener);
    const unsubscribeEnvironment = ports.environment.subscribe(environmentListener);

    contextNotice?.();
    environmentNotice?.();
    expect(contextListener).toHaveBeenCalledTimes(1);
    expect(environmentListener).toHaveBeenCalledTimes(1);

    unsubscribeContext();
    unsubscribeContext();
    expect(contextUnsubscribe).toHaveBeenCalledTimes(1);
    expect(disposeRuntimeWebHostAuthority(handle)).toEqual({ status: "disposed", unsubscribed: 1 });
    expect(environmentUnsubscribe).toHaveBeenCalledTimes(1);

    contextNotice?.();
    environmentNotice?.();
    unsubscribeEnvironment();
    expect(contextListener).toHaveBeenCalledTimes(1);
    expect(environmentListener).toHaveBeenCalledTimes(1);
    expect(environmentUnsubscribe).toHaveBeenCalledTimes(1);
    expect(disposeRuntimeWebHostAuthority(handle)).toEqual({
      status: "already-disposed",
      unsubscribed: 0,
    });
  });

  it("redacts hostile subscription and diagnostic failures from public outcomes", () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    delegates.context.subscribe.mockImplementation(() => {
      throw new Error("secret context failure");
    });
    delegates.diagnostics.report.mockImplementation(() => {
      throw new Error("secret telemetry failure");
    });
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput), delegates));
    const ports = activePorts(handle);

    expect(() => ports.context.subscribe(vi.fn())).toThrowError(
      "Runtime web subscription could not be established.",
    );
    expect(() =>
      ports.diagnostics.report({
        code: "run.desen.runtime-web/SAFE",
        message: "Safe.",
      } as Parameters<RuntimeHostPorts["diagnostics"]["report"]>[0]),
    ).not.toThrow();

    vi.mocked(platformInput.environment.subscribe).mockReturnValueOnce("invalid" as never);
    expect(() => ports.environment.subscribe(vi.fn())).toThrowError(
      "Runtime web subscription could not be established.",
    );

    vi.mocked(platformInput.environment.subscribe).mockReturnValueOnce(() => {
      throw new Error("secret unsubscribe failure");
    });
    ports.environment.subscribe(vi.fn());
    const disposal = disposeRuntimeWebHostAuthority(handle);
    expect(disposal).toEqual({ status: "disposed", unsubscribed: 1 });
    expect(Object.keys(disposal)).toEqual(["status", "unsubscribed"]);
    expect(JSON.stringify(disposal)).not.toContain("secret");
  });

  it("terminally fences every callback before reflecting over late caller input", async () => {
    const platformInput = browserPlatformInput();
    const delegates = hostDelegateInput();
    const handle = createdAuthority(authorityInput(createdPlatform(platformInput), delegates));
    const ports = activePorts(handle);
    expect(disposeRuntimeWebHostAuthority(handle)).toEqual({
      status: "disposed",
      unsubscribed: 0,
    });
    const baselineCalls = [...allMockCallbacks(platformInput), ...allMockCallbacks(delegates)].map(
      (callback) => callback.mock.calls.length,
    );

    const hostileNavigation = new Proxy(navigationRequest(), {
      ownKeys() {
        throw new Error("late request must not be reflected");
      },
    });
    expect(ports.navigation.navigate(hostileNavigation)).toEqual({ status: "denied" });
    await expect(Promise.resolve(ports.storage.getBundle(REVISION))).resolves.toEqual({
      status: "missing",
    });
    await expect(
      Promise.resolve(ports.storage.putBundle({ revision: REVISION, bytes: new Uint8Array([1]) })),
    ).resolves.toEqual({ status: "conflict" });
    await expect(Promise.resolve(ports.storage.readActivation())).resolves.toEqual({
      status: "missing",
    });
    await expect(
      Promise.resolve(
        ports.storage.commitActivation({
          expectedGeneration: null,
          activeRevision: REVISION,
          previousGoodRevision: null,
        }),
      ),
    ).resolves.toEqual({ status: "conflict", generation: null });
    await expect(Promise.resolve(ports.operations.invoke(operationRequest()))).resolves.toEqual({
      status: "denied",
    });
    await expect(Promise.resolve(ports.resources.load(resourceRequest()))).resolves.toEqual({
      status: "denied",
    });
    expect(
      ports.tokens.resolve({
        context: REQUEST_CONTEXT,
        token: "color.action.primary",
      }),
    ).toEqual({ status: "missing" });
    expect(ports.context.getSnapshot()).toEqual({});
    expect(ports.environment.getSnapshot()).toEqual({});
    expect(ports.clock.now()).toBe(0);
    expect(() =>
      ports.diagnostics.report({
        code: "run.desen.runtime-web/LATE",
        message: "Late.",
      } as Parameters<RuntimeHostPorts["diagnostics"]["report"]>[0]),
    ).not.toThrow();
    expect(() => ports.context.subscribe(vi.fn())()).not.toThrow();
    expect(() => ports.environment.subscribe(vi.fn())()).not.toThrow();

    const callbacks = [...allMockCallbacks(platformInput), ...allMockCallbacks(delegates)];
    expect(callbacks.map((callback) => callback.mock.calls.length)).toEqual(baselineCalls);
    expect(readRuntimeWebHostAuthority(handle)).toEqual({ status: "disposed" });
  });

  it("rejects forged, accessor-backed, extra, and reflection-hostile factory inputs", () => {
    const platformGetter = vi.fn(() => browserPlatformInput().environment);
    const accessorPlatformInput = { clock: browserPlatformInput().clock };
    Object.defineProperty(accessorPlatformInput, "environment", {
      enumerable: true,
      get: platformGetter,
    });
    expect(
      createRuntimeWebBrowserPlatform(
        accessorPlatformInput as unknown as RuntimeWebBrowserPlatformCreateInput,
      ),
    ).toEqual({ status: "rejected", reason: "malformed-input" });
    expect(platformGetter).not.toHaveBeenCalled();

    const hostilePlatformInput = new Proxy(browserPlatformInput(), {
      ownKeys() {
        throw new Error("secret ownKeys trap");
      },
    });
    expect(createRuntimeWebBrowserPlatform(hostilePlatformInput)).toEqual({
      status: "rejected",
      reason: "malformed-input",
    });

    const platform = createdPlatform();
    const delegates = hostDelegateInput();
    expect(
      createRuntimeWebHostAuthority({
        ...authorityInput(platform, delegates),
        scheduler: {},
      } as unknown as RuntimeWebHostAuthorityCreateInput),
    ).toEqual({ status: "rejected", reason: "malformed-input" });
    expect(
      createRuntimeWebHostAuthority(
        authorityInput({} as RuntimeWebBrowserPlatformHandle, delegates),
      ),
    ).toEqual({ status: "rejected", reason: "invalid-browser-platform" });
    expect(
      createRuntimeWebHostAuthority({
        ...authorityInput(platform, delegates),
        revision: "not-a-revision",
      }),
    ).toEqual({ status: "rejected", reason: "invalid-document-identity" });

    const navigateGetter = vi.fn(() => delegates.navigation.navigate);
    const accessorNavigation = {};
    Object.defineProperty(accessorNavigation, "navigate", {
      enumerable: true,
      get: navigateGetter,
    });
    expect(
      createRuntimeWebHostAuthority({
        ...authorityInput(platform, delegates),
        navigation: accessorNavigation as RuntimeWebHostAuthorityCreateInput["navigation"],
      }),
    ).toEqual({ status: "rejected", reason: "invalid-host-ports" });
    expect(navigateGetter).not.toHaveBeenCalled();

    const hostileInput = new Proxy(authorityInput(platform, delegates), {
      getPrototypeOf() {
        throw new Error("secret prototype trap");
      },
    });
    expect(createRuntimeWebHostAuthority(hostileInput)).toEqual({
      status: "rejected",
      reason: "malformed-input",
    });
  });

  it("authenticates handles without reflecting over forgeries and returns exact frozen results", () => {
    const forged = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("must not reflect forged authority");
        },
      },
    ) as RuntimeWebHostAuthorityHandle;
    const read = readRuntimeWebHostAuthority(forged);
    const disposal = disposeRuntimeWebHostAuthority(forged);

    expect(read).toEqual({ status: "invalid-authority" });
    expect(disposal).toEqual({ status: "invalid-authority", unsubscribed: 0 });
    expect(Object.isFrozen(read)).toBe(true);
    expect(Object.isFrozen(disposal)).toBe(true);
    expect(Object.keys(read)).toEqual(["status"]);
    expect(Object.keys(disposal)).toEqual(["status", "unsubscribed"]);
  });
});
