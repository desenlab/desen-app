import { describe, expect, it, vi } from "vitest";

import type { RuntimeOperationRequest } from "@desen/runtime-core";

import {
  AUTHORING_FIXTURE_CONTEXT_MODEL,
  AUTHORING_SIGN_IN_FIXTURE_OUTCOMES,
  createAuthoringSignInFixtureController,
} from "../src/authoring-fixtures.js";

function expectDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      expectDeeplyFrozen(descriptor.value);
    }
  }
}

function operationRequest(
  overrides: Partial<RuntimeOperationRequest> = {},
): RuntimeOperationRequest {
  return {
    context: {
      documentId: "com.example.account-app",
      revision: `sha256:${"1".repeat(64)}`,
      surfaceId: "sign-in",
      requestId: "operation:signIn:1",
    },
    capabilityId: "com.example.auth/signIn",
    invocationAlias: "signIn",
    input: { email: "person@example.test", password: "fixture-secret" },
    effect: "network",
    ...overrides,
  };
}

function createController() {
  return createAuthoringSignInFixtureController({
    documentId: "com.example.account-app",
    revision: `sha256:${"1".repeat(64)}`,
    surfaceId: "sign-in",
  });
}

describe("Desen App authoring fixture inventory", () => {
  it("shows synthetic, integration, and production context without activating real bindings", () => {
    expect(AUTHORING_FIXTURE_CONTEXT_MODEL).toEqual({
      activeId: "synthetic",
      disclosure: "Synthetic Catalog data. Integration and production calls are off.",
      options: [
        {
          id: "synthetic",
          label: "Synthetic",
          availability: "active",
          description: "Uses inert authoring fixtures from the authenticated Catalog manifest.",
        },
        {
          id: "integration",
          label: "Integration",
          availability: "unavailable",
          description: "No integration binding is connected in this authoring preview.",
        },
        {
          id: "production",
          label: "Production",
          availability: "unavailable",
          description: "Production calls are off in this authoring preview.",
        },
      ],
    });
    expectDeeplyFrozen(AUTHORING_FIXTURE_CONTEXT_MODEL);
  });

  it("offers only exact success and declared invalid-credentials fixtures", () => {
    expect(AUTHORING_SIGN_IN_FIXTURE_OUTCOMES).toEqual([
      {
        id: "success",
        label: "Success · user-1",
        kind: "success",
        capabilityId: "com.example.auth/signIn",
        fixtureValue: { userId: "user-1" },
      },
      {
        id: "invalidCredentials",
        label: "Invalid credentials",
        kind: "error",
        capabilityId: "com.example.auth/signIn",
        fixtureValue: {},
      },
    ]);
    const serialized = JSON.stringify(AUTHORING_SIGN_IN_FIXTURE_OUTCOMES);
    expect(serialized).not.toContain("pending");
    expect(serialized).not.toContain("unavailable");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("password");
    expectDeeplyFrozen(AUTHORING_SIGN_IN_FIXTURE_OUTCOMES);
  });
});

describe("Desen App deferred sign-in fixture controller", () => {
  it("publishes a real pending lifecycle before explicit successful settlement", async () => {
    const controller = createController();
    const snapshots: unknown[] = [];
    controller.subscribe((snapshot) => snapshots.push(snapshot));

    const invocation = controller.operationPort.invoke(operationRequest());
    expect(invocation).toBeInstanceOf(Promise);
    expect(controller.read()).toEqual({
      status: "pending",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
    expect(controller.selectOutcome("invalidCredentials")).toEqual({
      status: "rejected",
      reason: "pending",
    });

    let settled = false;
    void Promise.resolve(invocation).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    expect(controller.completePending()).toEqual({ status: "completed", outcomeId: "success" });
    await expect(Promise.resolve(invocation)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(controller.read()).toEqual({
      status: "succeeded",
      selectedOutcomeId: "success",
      completedOutcomeId: "success",
    });
    expect(snapshots).toEqual([
      { status: "pending", selectedOutcomeId: "success", completedOutcomeId: null },
      { status: "succeeded", selectedOutcomeId: "success", completedOutcomeId: "success" },
    ]);
    snapshots.forEach(expectDeeplyFrozen);
  });

  it("settles the selected declared public failure without replacing the host port", async () => {
    const controller = createController();
    const operationPort = controller.operationPort;
    const invoke = operationPort.invoke;

    expect(controller.selectOutcome("invalidCredentials")).toMatchObject({ status: "selected" });
    expect(controller.operationPort).toBe(operationPort);
    expect(controller.operationPort.invoke).toBe(invoke);

    const invocation = controller.operationPort.invoke(operationRequest());
    expect(controller.completePending()).toEqual({
      status: "completed",
      outcomeId: "invalidCredentials",
    });
    await expect(Promise.resolve(invocation)).resolves.toEqual({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    expect(controller.read()).toEqual({
      status: "failed",
      selectedOutcomeId: "invalidCredentials",
      completedOutcomeId: "invalidCredentials",
    });

    expect(controller.selectOutcome("success")).toMatchObject({ status: "selected" });
    expect(controller.operationPort).toBe(operationPort);
    expect(controller.operationPort.invoke).toBe(invoke);
    expect(controller.read()).toEqual({
      status: "idle",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
  });

  it.each([
    ["wrong capability", { capabilityId: "com.example.auth/other" }],
    ["wrong alias", { invocationAlias: "other" }],
    ["wrong effect", { effect: "external" as const }],
  ])("denies a forged request with %s without starting lifecycle", async (_label, overrides) => {
    const controller = createController();
    const result = controller.operationPort.invoke(operationRequest(overrides));

    await expect(Promise.resolve(result)).resolves.toEqual({ status: "denied" });
    expect(controller.read()).toEqual({
      status: "idle",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
    expect(controller.completePending()).toEqual({ status: "ignored", reason: "not-pending" });
  });

  it.each([
    ["wrong document", { documentId: "com.example.other-app" }],
    ["wrong revision", { revision: `sha256:${"2".repeat(64)}` }],
    ["wrong surface", { surfaceId: "home" }],
    ["empty request id", { requestId: "" }],
  ])("denies a request with %s context", async (_label, contextOverride) => {
    const controller = createController();
    const request = operationRequest();
    const result = controller.operationPort.invoke(
      operationRequest({ context: { ...request.context, ...contextOverride } }),
    );

    await expect(Promise.resolve(result)).resolves.toEqual({ status: "denied" });
    expect(controller.read().status).toBe("idle");
  });

  it("rejects inherited or accessor-backed authorization fields without invoking them", async () => {
    const controller = createController();
    const inherited = Object.create(operationRequest()) as RuntimeOperationRequest;
    const capabilityGetter = vi.fn(() => "com.example.auth/signIn");
    const accessorBacked = operationRequest();
    Object.defineProperty(accessorBacked, "capabilityId", {
      enumerable: true,
      get: capabilityGetter,
    });

    await expect(Promise.resolve(controller.operationPort.invoke(inherited))).resolves.toEqual({
      status: "denied",
    });
    await expect(Promise.resolve(controller.operationPort.invoke(accessorBacked))).resolves.toEqual(
      { status: "denied" },
    );
    expect(capabilityGetter).not.toHaveBeenCalled();
    expect(controller.read().status).toBe("idle");
  });

  it("rejects inherited or accessor-backed request context without invoking getters", async () => {
    const controller = createController();
    const validContext = operationRequest().context;
    const inheritedContextRequest = operationRequest({
      context: Object.create(validContext) as RuntimeOperationRequest["context"],
    });
    const requestIdGetter = vi.fn(() => "operation:signIn:2");
    const accessorContext = { ...validContext };
    Object.defineProperty(accessorContext, "requestId", {
      enumerable: true,
      get: requestIdGetter,
    });
    const contextGetter = vi.fn(() => validContext);
    const accessorRequest = operationRequest();
    Object.defineProperty(accessorRequest, "context", {
      enumerable: true,
      get: contextGetter,
    });

    await expect(
      Promise.resolve(controller.operationPort.invoke(inheritedContextRequest)),
    ).resolves.toEqual({ status: "denied" });
    await expect(
      Promise.resolve(
        controller.operationPort.invoke(
          operationRequest({ context: accessorContext as RuntimeOperationRequest["context"] }),
        ),
      ),
    ).resolves.toEqual({ status: "denied" });
    await expect(
      Promise.resolve(controller.operationPort.invoke(accessorRequest)),
    ).resolves.toEqual({ status: "denied" });
    expect(requestIdGetter).not.toHaveBeenCalled();
    expect(contextGetter).not.toHaveBeenCalled();
    expect(controller.read().status).toBe("idle");
  });

  it("captures the expected preview identity without retaining caller ownership", async () => {
    const expected = {
      documentId: "com.example.account-app",
      revision: `sha256:${"1".repeat(64)}`,
      surfaceId: "sign-in",
    };
    const controller = createAuthoringSignInFixtureController(expected);
    expected.documentId = "com.example.forged";
    expected.revision = `sha256:${"9".repeat(64)}`;
    expected.surfaceId = "forged";

    const invocation = controller.operationPort.invoke(operationRequest());
    expect(controller.read().status).toBe("pending");
    controller.completePending();
    await expect(Promise.resolve(invocation)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
  });

  it("rejects malformed expected preview identity before creating authority", () => {
    const inherited = Object.create({
      documentId: "com.example.account-app",
      revision: `sha256:${"1".repeat(64)}`,
      surfaceId: "sign-in",
    });
    const accessor = {
      documentId: "com.example.account-app",
      revision: `sha256:${"1".repeat(64)}`,
      get surfaceId() {
        return "sign-in";
      },
    };

    expect(() => createAuthoringSignInFixtureController(inherited)).toThrow(TypeError);
    expect(() => createAuthoringSignInFixtureController(accessor)).toThrow(TypeError);
    expect(() =>
      createAuthoringSignInFixtureController({
        documentId: "com.example.account-app",
        revision: "",
        surfaceId: "sign-in",
      }),
    ).toThrow(TypeError);
  });

  it("revokes admission synchronously during cleanup and reactivates only the same live lifetime", async () => {
    const controller = createController();
    const pending = controller.operationPort.invoke(operationRequest());

    controller.deactivate();
    expect(controller.operationPort.invoke(operationRequest())).toEqual({ status: "denied" });
    await expect(Promise.resolve(pending)).resolves.toEqual({ status: "denied" });
    expect(controller.read()).toEqual({
      status: "idle",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
    expect(controller.completePending()).toEqual({ status: "ignored", reason: "inactive" });
    expect(controller.selectOutcome("invalidCredentials")).toEqual({
      status: "rejected",
      reason: "inactive",
    });

    controller.activate();
    expect(controller.selectOutcome("invalidCredentials")).toMatchObject({ status: "selected" });
    const replayInvocation = controller.operationPort.invoke(operationRequest());
    expect(controller.read().status).toBe("pending");
    controller.completePending();
    await expect(Promise.resolve(replayInvocation)).resolves.toEqual({
      status: "failed",
      errorCode: "invalidCredentials",
    });

    controller.dispose();
    controller.activate();
    expect(controller.operationPort.invoke(operationRequest())).toEqual({ status: "denied" });
  });

  it("revokes pending work on disposal and ignores late settlement", async () => {
    const controller = createController();
    const invocation = controller.operationPort.invoke(operationRequest());

    controller.dispose();
    await expect(Promise.resolve(invocation)).resolves.toEqual({ status: "denied" });
    expect(controller.read()).toEqual({
      status: "disposed",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
    expect(controller.completePending()).toEqual({ status: "ignored", reason: "disposed" });
    expect(controller.selectOutcome("invalidCredentials")).toEqual({
      status: "rejected",
      reason: "disposed",
    });
    await expect(
      Promise.resolve(controller.operationPort.invoke(operationRequest())),
    ).resolves.toEqual({ status: "denied" });
  });

  it("revokes a replaced transport while preserving the stable operation port", async () => {
    const controller = createController();
    const operationPort = controller.operationPort;
    const first = controller.operationPort.invoke(operationRequest());
    const second = controller.operationPort.invoke(
      operationRequest({
        context: { ...operationRequest().context, requestId: "operation:signIn:2" },
      }),
    );

    await expect(Promise.resolve(first)).resolves.toEqual({ status: "denied" });
    expect(controller.operationPort).toBe(operationPort);
    expect(controller.read().status).toBe("pending");
    controller.completePending();
    await expect(Promise.resolve(second)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
  });

  it("never reads, retains, or logs operation input and password data", async () => {
    const controller = createController();
    const secret = "unique-password-that-must-not-be-retained";
    const inputAccess = vi.fn(() => {
      throw new Error("operation input must remain opaque");
    });
    const request = operationRequest();
    Object.defineProperty(request, "input", {
      enumerable: true,
      get: inputAccess,
    });
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];

    const invocation = controller.operationPort.invoke(request);
    expect(inputAccess).not.toHaveBeenCalled();
    expect(JSON.stringify(controller.read())).not.toContain(secret);
    expect(JSON.stringify(controller)).not.toContain(secret);
    controller.completePending();
    await expect(Promise.resolve(invocation)).resolves.toEqual({
      status: "succeeded",
      value: { userId: "user-1" },
    });
    expect(inputAccess).not.toHaveBeenCalled();
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it("rejects unknown outcome values without changing the controller", () => {
    const controller = createController();
    expect(controller.selectOutcome("pending" as never)).toEqual({
      status: "rejected",
      reason: "unknown-outcome",
    });
    expect(controller.selectOutcome("unavailable" as never)).toEqual({
      status: "rejected",
      reason: "unknown-outcome",
    });
    expect(controller.read()).toEqual({
      status: "idle",
      selectedOutcomeId: "success",
      completedOutcomeId: null,
    });
  });
});
