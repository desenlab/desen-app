import { createCoreDiagnostic } from "@desen/protocol";
import { describe, expect, it, vi } from "vitest";

import { createRuntimeHostPorts } from "../src/index.js";

import type { RuntimeHostPorts } from "../src/index.js";

function createHostPortInput() {
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
          activeRevision: `sha256:${"1".repeat(64)}`,
          previousGoodRevision: null,
          generation: 0,
        },
      })),
    },
    operations: {
      invoke: vi.fn(() => ({
        status: "succeeded" as const,
        value: { userId: "user-1" },
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
      getSnapshot: vi.fn(() => ({ route: { tenant: "tenant-1" } })),
      subscribe: vi.fn(() => vi.fn()),
    },
    environment: {
      getSnapshot: vi.fn(() => ({
        viewport: { width: 1280, height: 720, orientation: "landscape" },
        pointer: "fine",
        colorScheme: "dark",
        reducedMotion: false,
        locale: "tr-TR",
        platform: "web",
      })),
      subscribe: vi.fn(() => vi.fn()),
    },
    clock: {
      now: vi.fn(() => 1_789_000_000_000),
    },
    diagnostics: {
      report: vi.fn(),
    },
  };
}

function asRuntimeHostPorts(value: unknown): RuntimeHostPorts {
  return value as RuntimeHostPorts;
}

describe("createRuntimeHostPorts", () => {
  it("captures every required callback by identity without invoking or freezing caller objects", () => {
    const input = createHostPortInput();
    const ports = createRuntimeHostPorts(input);

    expect(Object.isFrozen(ports)).toBe(true);
    for (const port of Object.values(ports)) expect(Object.isFrozen(port)).toBe(true);

    expect(ports.navigation.navigate).toBe(input.navigation.navigate);
    expect(ports.storage.getBundle).toBe(input.storage.getBundle);
    expect(ports.storage.putBundle).toBe(input.storage.putBundle);
    expect(ports.storage.readActivation).toBe(input.storage.readActivation);
    expect(ports.storage.commitActivation).toBe(input.storage.commitActivation);
    expect(ports.operations.invoke).toBe(input.operations.invoke);
    expect(ports.resources.load).toBe(input.resources.load);
    expect(ports.tokens.resolve).toBe(input.tokens.resolve);
    expect(ports.context.getSnapshot).toBe(input.context.getSnapshot);
    expect(ports.context.subscribe).toBe(input.context.subscribe);
    expect(ports.environment.getSnapshot).toBe(input.environment.getSnapshot);
    expect(ports.environment.subscribe).toBe(input.environment.subscribe);
    expect(ports.clock.now).toBe(input.clock.now);
    expect(ports.diagnostics.report).toBe(input.diagnostics.report);

    for (const port of Object.values(input)) {
      expect(Object.isFrozen(port)).toBe(false);
      for (const callback of Object.values(port)) {
        if (typeof callback === "function") expect(callback).not.toHaveBeenCalled();
      }
    }
  });

  it("keeps the captured boundary stable when caller-owned port objects are later changed", () => {
    const input = createHostPortInput();
    const originalNavigate = input.navigation.navigate;
    const originalInvoke = input.operations.invoke;
    const ports = createRuntimeHostPorts(input);

    input.navigation.navigate = vi.fn(() => ({ status: "succeeded" as const }));
    input.operations.invoke = vi.fn(() => ({
      status: "succeeded" as const,
      value: { userId: "mutated" },
    }));

    expect(ports.navigation.navigate).toBe(originalNavigate);
    expect(ports.operations.invoke).toBe(originalInvoke);
  });

  it("carries only explicit request data and controlled result envelopes across each port", async () => {
    const input = createHostPortInput();
    const ports = createRuntimeHostPorts(input);
    const context = {
      documentId: "com.example.sign-in",
      revision: `sha256:${"2".repeat(64)}`,
      surfaceId: "sign-in",
      requestId: "request-1",
    };

    const navigationRequest = {
      context,
      targetSurfaceId: "home",
      params: { source: "sign-in" },
    } as const;
    expect(ports.navigation.navigate(navigationRequest)).toEqual({ status: "succeeded" });

    const operationRequest = {
      context,
      capabilityId: "com.example.auth/signIn",
      invocationAlias: "signIn",
      input: { email: "person@example.test", password: "synthetic-only" },
      effect: "network",
    } as const;
    await expect(Promise.resolve(ports.operations.invoke(operationRequest))).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });

    const resourceRequest = {
      context: { ...context, requestId: "request-2" },
      instanceId: "stores",
      capabilityId: "com.example.stores/list",
      input: { region: "eu" },
    } as const;
    await expect(Promise.resolve(ports.resources.load(resourceRequest))).resolves.toEqual({
      status: "failed",
      errorCode: "offline",
    });

    expect(
      ports.tokens.resolve({
        context: { ...context, requestId: "request-3" },
        token: "color.action.primary",
      }),
    ).toEqual({ status: "resolved", value: "#1d4ed8" });
    expect(ports.context.getSnapshot()).toEqual({ route: { tenant: "tenant-1" } });
    expect(ports.environment.getSnapshot()).toMatchObject({
      viewport: { width: 1280, height: 720 },
      platform: "web",
    });
    expect(ports.clock.now()).toBe(1_789_000_000_000);

    const diagnostic = createCoreDiagnostic({
      code: "OPERATION_DENIED",
      message: "The current host policy denied the operation.",
    });
    ports.diagnostics.report(diagnostic);
    expect(input.diagnostics.report).toHaveBeenCalledWith(diagnostic);

    expect(JSON.parse(JSON.stringify(operationRequest))).toEqual(operationRequest);
    expect(JSON.parse(JSON.stringify(resourceRequest))).toEqual(resourceRequest);
    expect(JSON.parse(JSON.stringify(navigationRequest))).toEqual(navigationRequest);
  });

  it("keeps success, declared failure, policy denial, and missing lookup outcomes distinct", () => {
    const success = { status: "succeeded", value: { ok: true } } as const;
    const failure = { status: "failed", errorCode: "invalidCredentials" } as const;
    const denial = { status: "denied" } as const;
    const missingToken = { status: "missing" } as const;

    expect(new Set([success.status, failure.status, denial.status, missingToken.status]).size).toBe(
      4,
    );
    expect("value" in denial).toBe(false);
    expect("errorCode" in denial).toBe(false);
    expect("value" in missingToken).toBe(false);
  });

  it.each([
    ["null aggregate", null],
    ["array aggregate", []],
    [
      "missing port",
      (() => {
        const { diagnostics, ...missing } = createHostPortInput();
        void diagnostics;
        return missing;
      })(),
    ],
    ["extra top-level port", { ...createHostPortInput(), scheduler: { schedule: vi.fn() } }],
    [
      "non-function callback",
      {
        ...createHostPortInput(),
        clock: { now: 123 },
      },
    ],
  ])("rejects %s", (_label, input) => {
    expect(() => createRuntimeHostPorts(asRuntimeHostPorts(input))).toThrowError(
      /^Invalid runtime host ports at \//,
    );
  });

  it("rejects accessor-backed, inherited, and reflection-hostile entries without invoking them", () => {
    const aggregateGetter = vi.fn(() => createHostPortInput().navigation);
    const aggregateWithGetter = createHostPortInput();
    Object.defineProperty(aggregateWithGetter, "navigation", {
      enumerable: true,
      configurable: true,
      get: aggregateGetter,
    });
    expect(() => createRuntimeHostPorts(asRuntimeHostPorts(aggregateWithGetter))).toThrowError(
      "/navigation: required property must be a data property",
    );
    expect(aggregateGetter).not.toHaveBeenCalled();

    const methodGetter = vi.fn(() => createHostPortInput().navigation.navigate);
    const portWithGetter = createHostPortInput();
    Object.defineProperty(portWithGetter.navigation, "navigate", {
      enumerable: true,
      configurable: true,
      get: methodGetter,
    });
    expect(() => createRuntimeHostPorts(asRuntimeHostPorts(portWithGetter))).toThrowError(
      "/navigation/navigate: required property must be a data property",
    );
    expect(methodGetter).not.toHaveBeenCalled();

    const inheritedNavigation = Object.create({
      navigate: createHostPortInput().navigation.navigate,
    }) as object;
    expect(() =>
      createRuntimeHostPorts(
        asRuntimeHostPorts({ ...createHostPortInput(), navigation: inheritedNavigation }),
      ),
    ).toThrowError("/navigation/navigate: required own property is missing");

    const hostileAggregate = new Proxy(createHostPortInput(), {
      ownKeys: () => {
        throw new Error("hostile ownKeys");
      },
    });
    expect(() => createRuntimeHostPorts(asRuntimeHostPorts(hostileAggregate))).toThrowError(
      "/: own keys could not be read safely",
    );

    const hostileNavigation = new Proxy(createHostPortInput().navigation, {
      getOwnPropertyDescriptor: () => {
        throw new Error("hostile descriptor");
      },
    });
    expect(() =>
      createRuntimeHostPorts(
        asRuntimeHostPorts({ ...createHostPortInput(), navigation: hostileNavigation }),
      ),
    ).toThrowError("/navigation/navigate: property descriptor could not be read safely");
  });
});
