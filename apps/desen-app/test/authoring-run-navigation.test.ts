import { describe, expect, it, vi } from "vitest";

import {
  createAuthoringRunHostPorts,
  createAuthoringRunNavigationController,
} from "../src/authoring-run-navigation.js";
import { REFERENCE_EDITOR_DOCUMENT } from "../src/reference-authoring-profile.js";

import type { RuntimeNavigationRequest } from "@desen/runtime-core";
import type { AuthoringRunDestination } from "../src/authoring-run-navigation.js";

function request(overrides: Partial<RuntimeNavigationRequest> = {}): RuntimeNavigationRequest {
  return {
    context: {
      documentId: REFERENCE_EDITOR_DOCUMENT.id,
      revision: "preview-revision",
      surfaceId: "sign-in",
      requestId: "navigate-1",
    },
    targetSurfaceId: "home",
    params: { greeting: "Hello" },
    ...overrides,
  };
}

function controller(
  onNavigate = vi.fn<(destination: AuthoringRunDestination) => boolean>(() => true),
  isRunActive = () => true,
) {
  return {
    onNavigate,
    navigation: createAuthoringRunNavigationController({
      document: REFERENCE_EDITOR_DOCUMENT,
      revision: "preview-revision",
      surfaceId: "sign-in",
      isRunActive,
      onNavigate,
    }),
  };
}

describe("App-owned managed Run navigation", () => {
  it("starts inert and permits one detached in-document transition without mutating Source", () => {
    const sourceBefore = JSON.stringify(REFERENCE_EDITOR_DOCUMENT);
    const { navigation, onNavigate } = controller();
    const first = request();
    expect(navigation.navigationPort.navigate(first)).toEqual({ status: "denied" });
    navigation.activate();
    expect(navigation.navigationPort.navigate(first)).toEqual({ status: "succeeded" });
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith({
      surfaceId: "home",
      params: { greeting: "Hello" },
    });
    expect(onNavigate.mock.calls[0]?.[0]).not.toBe(first);
    navigation.activate();
    expect(navigation.navigationPort.navigate(first)).toEqual({ status: "denied" });
    expect(JSON.stringify(REFERENCE_EDITOR_DOCUMENT)).toBe(sourceBefore);
  });

  it.each(["documentId", "revision", "surfaceId", "requestId"] as const)(
    "denies mismatched or empty %s",
    (key) => {
      const { navigation, onNavigate } = controller();
      navigation.activate();
      const original = request();
      expect(
        navigation.navigationPort.navigate(
          request({ context: { ...original.context, [key]: key === "requestId" ? "" : "wrong" } }),
        ),
      ).toEqual({ status: "denied" });
      expect(onNavigate).not.toHaveBeenCalled();
    },
  );

  it("denies unknown surfaces, URLs, extra keys and accessor-bearing request data", () => {
    const { navigation, onNavigate } = controller();
    navigation.activate();
    for (const targetSurfaceId of ["missing", "/projects", "https://example.test", "__proto__"]) {
      expect(navigation.navigationPort.navigate(request({ targetSurfaceId }))).toEqual({
        status: "denied",
      });
    }
    expect(
      navigation.navigationPort.navigate({ ...request(), extra: true } as RuntimeNavigationRequest),
    ).toEqual({ status: "denied" });
    const getter = vi.fn(() => "home");
    const accessor = Object.defineProperty(request(), "targetSurfaceId", {
      enumerable: true,
      get: getter,
    });
    expect(navigation.navigationPort.navigate(accessor)).toEqual({ status: "denied" });
    expect(getter).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("checks Design mode synchronously and supports only nonterminal StrictMode replay", () => {
    let run = false;
    const { navigation, onNavigate } = controller(
      vi.fn(() => true),
      () => run,
    );
    navigation.activate();
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
    run = true;
    navigation.deactivate();
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
    navigation.activate();
    navigation.dispose();
    navigation.activate();
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("preserves the origin on callback denial and prevents reentrant navigation", () => {
    const onNavigate = vi.fn(() => false);
    const { navigation } = controller(onNavigate);
    navigation.activate();
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
    onNavigate.mockImplementation(() => {
      expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
      return true;
    });
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "succeeded" });
  });

  it("rechecks lifetime after policy callbacks and denies reentrancy before request capture", () => {
    const onNavigate = vi.fn(() => true);
    const navigation = createAuthoringRunNavigationController({
      document: REFERENCE_EDITOR_DOCUMENT,
      revision: "preview-revision",
      surfaceId: "sign-in",
      onNavigate,
      isRunActive: () => {
        expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
        navigation.deactivate();
        navigation.activate();
        return true;
      },
    });
    navigation.activate();
    expect(navigation.navigationPort.navigate(request())).toEqual({ status: "denied" });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("keeps all unrelated host families inert and exposes only detached navigation params", () => {
    const operations = { invoke: vi.fn(() => ({ status: "denied" as const })) };
    const navigation = { navigate: vi.fn(() => ({ status: "denied" as const })) };
    const params = { greeting: "Hello" };
    const ports = createAuthoringRunHostPorts(operations, navigation, params);
    params.greeting = "mutated";
    expect(ports.context.getSnapshot()).toEqual({ params: { greeting: "Hello" } });
    expect(ports.environment.getSnapshot()).toEqual({});
    expect(ports.clock.now()).toBe(1);
    expect(ports.storage.getBundle("revision")).toEqual({ status: "missing" });
    expect(ports.tokens.resolve({ context: request().context, token: "secret" })).toEqual({
      status: "missing",
    });
    expect(operations.invoke).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
