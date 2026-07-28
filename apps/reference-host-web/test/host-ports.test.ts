// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { disposeRuntimeWebHostAuthority, readRuntimeWebHostAuthority } from "@desen/runtime-web";

import { createReferenceHostWebPorts } from "../src/host-ports.js";

import type {
  RuntimeContextPort,
  RuntimeActivationCommitRequest,
  RuntimeDiagnosticsPort,
  RuntimeNavigationPort,
  RuntimeOperationPort,
  RuntimeResourcePort,
  RuntimeStoragePort,
  RuntimeTokenPort,
} from "@desen/runtime-core";
import type { ReferenceHostWebPortsCreateInput } from "../src/host-ports.js";

const DOCUMENT_ID = "com.desen.reference-host";
const REVISION = `sha256:${"a".repeat(64)}`;

interface ControlledBrowser {
  readonly browser: Window;
  readonly mediaQueryRemovals: readonly ReturnType<typeof vi.fn>[];
  readonly removeWindowListener: ReturnType<typeof vi.fn>;
  failEnvironmentRead: boolean;
}

function controlledBrowser(): ControlledBrowser {
  const control: ControlledBrowser = {
    browser: undefined as unknown as Window,
    mediaQueryRemovals: [],
    removeWindowListener: vi.fn(),
    failEnvironmentRead: false,
  };
  const mediaQueryRemovals: ReturnType<typeof vi.fn>[] = [];
  const browser = {
    get innerWidth() {
      if (control.failEnvironmentRead) {
        throw new Error("temporary private browser failure");
      }
      return 1280;
    },
    innerHeight: 720,
    navigator: { language: "en-US" },
    performance: {
      timeOrigin: 1_785_000_000_000,
      now: () => 10,
    },
    addEventListener: vi.fn(),
    removeEventListener: control.removeWindowListener,
    matchMedia: vi.fn((query: string) => {
      const removeEventListener = vi.fn();
      mediaQueryRemovals.push(removeEventListener);
      return {
        matches: query === "(pointer: fine)",
        addEventListener: vi.fn(),
        removeEventListener,
      };
    }),
  } as unknown as Window;
  Object.assign(control, {
    browser,
    mediaQueryRemovals,
  });
  return control;
}

function trustedPorts(
  calls: string[],
): Omit<ReferenceHostWebPortsCreateInput, "browser" | "documentId" | "revision"> {
  const navigation: RuntimeNavigationPort = Object.freeze({
    navigate: () => {
      calls.push("navigate");
      return Object.freeze({ status: "succeeded" });
    },
  });
  const storage: RuntimeStoragePort = Object.freeze({
    getBundle: () => {
      calls.push("getBundle");
      return Object.freeze({ status: "missing" });
    },
    putBundle: () => {
      calls.push("putBundle");
      return Object.freeze({ status: "stored" });
    },
    readActivation: () => {
      calls.push("readActivation");
      return Object.freeze({ status: "missing" });
    },
    commitActivation: (request: RuntimeActivationCommitRequest) => {
      calls.push("commitActivation");
      return Object.freeze({
        status: "committed",
        record: Object.freeze({
          activeRevision: request.activeRevision,
          previousGoodRevision: request.previousGoodRevision,
          generation: (request.expectedGeneration ?? -1) + 1,
        }),
      });
    },
  });
  const operations: RuntimeOperationPort = Object.freeze({
    invoke: () => {
      calls.push("invoke");
      return Object.freeze({ status: "denied" });
    },
  });
  const resources: RuntimeResourcePort = Object.freeze({
    load: () => {
      calls.push("load");
      return Object.freeze({ status: "denied" });
    },
  });
  const tokens: RuntimeTokenPort = Object.freeze({
    resolve: () => {
      calls.push("resolveToken");
      return Object.freeze({ status: "missing" });
    },
  });
  const context: RuntimeContextPort = Object.freeze({
    getSnapshot: () => {
      calls.push("getContextSnapshot");
      return Object.freeze({});
    },
    subscribe: () => {
      calls.push("subscribeContext");
      return () => undefined;
    },
  });
  const diagnostics: RuntimeDiagnosticsPort = Object.freeze({
    report: () => {
      calls.push("reportDiagnostic");
    },
  });
  return Object.freeze({
    navigation,
    storage,
    operations,
    resources,
    tokens,
    context,
    diagnostics,
  });
}

describe("reference-host browser port composition", () => {
  it("captures nine ports and fourteen callbacks without invoking host or browser code", () => {
    const calls: string[] = [];
    const created = createReferenceHostWebPorts({
      browser: window,
      documentId: DOCUMENT_ID,
      revision: REVISION,
      ...trustedPorts(calls),
    });
    expect(created.status).toBe("created");
    expect(calls).toEqual([]);
    if (created.status !== "created") throw new TypeError("expected created authority");

    const read = readRuntimeWebHostAuthority(created.handle);
    expect(read.status).toBe("active");
    if (read.status !== "active") throw new TypeError("expected active authority");
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
      Object.values(read.hostPorts).reduce((count, port) => count + Object.keys(port).length, 0),
    ).toBe(14);
    expect(Object.isFrozen(read.hostPorts)).toBe(true);

    const environment = read.hostPorts.environment.getSnapshot();
    expect(environment).toMatchObject({
      platform: "web",
      viewport: {
        width: expect.any(Number),
        height: expect.any(Number),
        orientation: expect.stringMatching(/^(?:landscape|portrait)$/u),
      },
      pointer: expect.stringMatching(/^(?:coarse|fine|none)$/u),
      colorScheme: expect.stringMatching(/^(?:dark|light)$/u),
      reducedMotion: expect.any(Boolean),
      locale: expect.any(String),
    });
    expect(read.hostPorts.clock.now()).toBeGreaterThan(0);
    expect(calls).toEqual([]);
  });

  it("publishes lazy browser invalidations and removes them terminally", () => {
    const created = createReferenceHostWebPorts({
      browser: window,
      documentId: DOCUMENT_ID,
      revision: REVISION,
      ...trustedPorts([]),
    });
    if (created.status !== "created") throw new TypeError("expected created authority");
    const read = readRuntimeWebHostAuthority(created.handle);
    if (read.status !== "active") throw new TypeError("expected active authority");
    const listener = vi.fn();
    const unsubscribe = read.hostPorts.environment.subscribe(listener);

    window.dispatchEvent(new Event("resize"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    unsubscribe();
    window.dispatchEvent(new Event("resize"));
    expect(listener).toHaveBeenCalledTimes(1);

    const second = vi.fn();
    read.hostPorts.environment.subscribe(second);
    expect(disposeRuntimeWebHostAuthority(created.handle)).toEqual({
      status: "disposed",
      unsubscribed: 1,
    });
    window.dispatchEvent(new Event("resize"));
    expect(second).not.toHaveBeenCalled();
    expect(read.hostPorts.environment.getSnapshot()).toEqual({});
    expect(read.hostPorts.operations.invoke({} as never)).toEqual({ status: "denied" });
  });

  it("preserves the last valid environment when a temporary browser read becomes hostile", () => {
    const controlled = controlledBrowser();
    const created = createReferenceHostWebPorts({
      browser: controlled.browser,
      documentId: DOCUMENT_ID,
      revision: REVISION,
      ...trustedPorts([]),
    });
    if (created.status !== "created") throw new TypeError("expected created authority");
    const read = readRuntimeWebHostAuthority(created.handle);
    if (read.status !== "active") throw new TypeError("expected active authority");

    const baseline = read.hostPorts.environment.getSnapshot();
    expect(baseline).toMatchObject({
      platform: "web",
      viewport: { width: 1280, height: 720 },
      pointer: "fine",
    });

    controlled.failEnvironmentRead = true;
    const retained = read.hostPorts.environment.getSnapshot();
    expect(retained).toEqual(baseline);
    expect(retained).not.toEqual({ platform: "web" });
  });

  it("attempts every registered browser cleanup when one listener removal throws", () => {
    const controlled = controlledBrowser();
    controlled.removeWindowListener.mockImplementation((type: string) => {
      if (type === "languagechange") {
        throw new Error("temporary private listener failure");
      }
    });
    const created = createReferenceHostWebPorts({
      browser: controlled.browser,
      documentId: DOCUMENT_ID,
      revision: REVISION,
      ...trustedPorts([]),
    });
    if (created.status !== "created") throw new TypeError("expected created authority");
    const read = readRuntimeWebHostAuthority(created.handle);
    if (read.status !== "active") throw new TypeError("expected active authority");

    const unsubscribe = read.hostPorts.environment.subscribe(() => undefined);
    expect(controlled.mediaQueryRemovals).toHaveLength(4);
    unsubscribe();

    expect(controlled.removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(controlled.removeWindowListener).toHaveBeenCalledWith(
      "languagechange",
      expect.any(Function),
    );
    for (const removeMediaQueryListener of controlled.mediaQueryRemovals) {
      expect(removeMediaQueryListener).toHaveBeenCalledWith("change", expect.any(Function));
    }
  });

  it("enforces exact document and revision navigation identity", () => {
    const calls: string[] = [];
    const created = createReferenceHostWebPorts({
      browser: window,
      documentId: DOCUMENT_ID,
      revision: REVISION,
      ...trustedPorts(calls),
    });
    if (created.status !== "created") throw new TypeError("expected created authority");
    const read = readRuntimeWebHostAuthority(created.handle);
    if (read.status !== "active") throw new TypeError("expected active authority");
    const request = {
      context: {
        documentId: DOCUMENT_ID,
        revision: REVISION,
        surfaceId: "sign-in",
        requestId: "navigation-1",
      },
      targetSurfaceId: "home",
      params: {},
    } as const;

    expect(read.hostPorts.navigation.navigate(request)).toEqual({ status: "succeeded" });
    expect(calls).toEqual(["navigate"]);
    expect(
      read.hostPorts.navigation.navigate({
        ...request,
        context: { ...request.context, revision: `sha256:${"b".repeat(64)}` },
      }),
    ).toEqual({ status: "denied" });
    expect(calls).toEqual(["navigate"]);
  });

  it("rejects accessor and hostile composition envelopes without invoking hooks", () => {
    let getterCalls = 0;
    const accessorInput = Object.defineProperties(
      {},
      {
        browser: { enumerable: true, value: window },
        documentId: { enumerable: true, value: DOCUMENT_ID },
        revision: { enumerable: true, value: REVISION },
        navigation: {
          enumerable: true,
          get() {
            getterCalls += 1;
            return trustedPorts([]).navigation;
          },
        },
        storage: { enumerable: true, value: trustedPorts([]).storage },
        operations: { enumerable: true, value: trustedPorts([]).operations },
        resources: { enumerable: true, value: trustedPorts([]).resources },
        tokens: { enumerable: true, value: trustedPorts([]).tokens },
        context: { enumerable: true, value: trustedPorts([]).context },
        diagnostics: { enumerable: true, value: trustedPorts([]).diagnostics },
      },
    );
    expect(createReferenceHostWebPorts(accessorInput as ReferenceHostWebPortsCreateInput)).toEqual({
      status: "rejected",
      reason: "malformed-input",
    });
    expect(getterCalls).toBe(0);

    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("hostile composition");
        },
      },
    );
    expect(createReferenceHostWebPorts(hostile as ReferenceHostWebPortsCreateInput)).toEqual({
      status: "rejected",
      reason: "malformed-input",
    });
  });
});
