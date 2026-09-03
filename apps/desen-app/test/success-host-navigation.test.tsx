// @vitest-environment jsdom
import { StrictMode, act } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DesenAppApplication } from "../src/application.js";
import { createAuthoringIntegrationBinding } from "../src/authoring-integration.js";
import {
  REFERENCE_AUTHORING_WORKSPACE_PROFILE,
  REFERENCE_EDITOR_DOCUMENT,
} from "../src/reference-authoring-profile.js";
import { REFERENCE_SIGN_IN_WORKSPACE_PROFILE } from "../src/reference-sign-in-workspace-profile.js";

import type { RuntimeHostCallResult } from "@desen/runtime-core";
import type { AuthoringIntegrationOperationBinding } from "../src/authoring-integration.js";

function binding(invoke: AuthoringIntegrationOperationBinding["invoke"]) {
  const result = createAuthoringIntegrationBinding({
    profile: REFERENCE_AUTHORING_WORKSPACE_PROFILE,
    bindingId: "test-host",
    label: "Explicit test host",
    description: "Application-owned test connection.",
    operations: [{ capabilityId: "com.example.auth/signIn", effect: "network", invoke }],
  });
  if (result.status !== "created") throw new Error("Expected an authenticated test integration.");
  return result.binding;
}

async function mount(invoke: AuthoringIntegrationOperationBinding["invoke"]) {
  const integration = binding(invoke);
  render(
    <StrictMode>
      <DesenAppApplication
        workspaceProfile={REFERENCE_AUTHORING_WORKSPACE_PROFILE}
        integrationBinding={integration}
        initialDocument={REFERENCE_EDITOR_DOCUMENT}
      />
    </StrictMode>,
  );
  await screen.findByRole("group", { name: "Managed sign-in canvas" });
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  return integration;
}

async function inputAndSubmit() {
  const canvas = await screen.findByRole("group", { name: "Managed sign-in canvas" });
  await act(async () => {
    fireEvent.change(within(canvas).getByLabelText("Email"), {
      target: { value: "person@example.test" },
    });
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.change(within(canvas).getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(within(canvas).getByLabelText("Email")).toHaveProperty("value", "person@example.test");
    expect(within(canvas).getByLabelText("Password")).toHaveProperty("value", "test-password");
  });
  await act(async () => {
    fireEvent.click(within(canvas).getByRole("button", { name: "Sign in" }));
    await Promise.resolve();
  });
  return canvas;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("success, managed navigation and explicitly connected App Run", () => {
  it("uses only Catalog fixtures until Integration is selected, then restores the design origin", async () => {
    const original = JSON.stringify(REFERENCE_EDITOR_DOCUMENT);
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => ({
      status: "succeeded",
      value: { userId: "host-user" },
    }));
    await mount(invoke);
    const origin = await inputAndSubmit();
    fireEvent.click(screen.getByRole("button", { name: "Complete signIn fixture" }));
    const target = await screen.findByRole("group", { name: "Managed home canvas" });
    expect(within(target).getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(origin.isConnected).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/projects/account-app/surfaces/sign-in");
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    const restored = await screen.findByRole("group", { name: "Managed sign-in canvas" });
    expect(within(restored).getByLabelText("Email")).toHaveProperty("value", "");
    expect(restored).toHaveProperty("disabled", true);
    expect(JSON.stringify(REFERENCE_EDITOR_DOCUMENT)).toBe(original);
  });

  it("executes one connected host callback with live input and mounts its actual destination", async () => {
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => ({
      status: "succeeded",
      value: { userId: "host-user" },
    }));
    await mount(invoke);
    fireEvent.click(screen.getByRole("radio", { name: /^Integration/ }));
    const origin = await inputAndSubmit();
    const target = await screen.findByRole("group", { name: "Managed home canvas" });
    expect(within(target).getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0].input).toEqual({
      email: "person@example.test",
      password: "test-password",
    });
    expect(invoke.mock.calls[0]?.[1].aborted).toBe(false);
    expect(origin.isConnected).toBe(false);
    expect(screen.queryByRole("button", { name: /fixture/ })).toBeNull();
    expect(screen.getByRole("radio", { name: /^Production/ })).toHaveProperty("disabled", true);
  });

  it.each([
    { status: "succeeded", value: { userId: 4 } },
    { status: "failed", errorCode: "undeclared-private-error" },
    { status: "denied" },
  ] satisfies RuntimeHostCallResult[])(
    "does not navigate on an unaccepted host candidate: %j",
    async (response) => {
      const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => response);
      await mount(invoke);
      fireEvent.click(screen.getByRole("radio", { name: /^Integration/ }));
      await inputAndSubmit();
      await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByRole("group", { name: "Managed home canvas" })).toBeNull();
      expect(screen.getByRole("group", { name: "Managed sign-in canvas" })).toBeTruthy();
      expect(document.body.textContent).not.toContain("undeclared-private-error");
    },
  );

  it("aborts an outstanding Integration call and ignores late success after leaving Run", async () => {
    let settle: ((result: RuntimeHostCallResult) => void) | undefined;
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    await mount(invoke);
    fireEvent.click(screen.getByRole("radio", { name: /^Integration/ }));
    await inputAndSubmit();
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    const signal = invoke.mock.calls[0]?.[1];
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      settle?.({ status: "succeeded", value: { userId: "too-late" } });
      await Promise.resolve();
    });
    expect(screen.queryByRole("group", { name: "Managed home canvas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("radio", { name: /^Synthetic/ })).toHaveProperty("checked", true);
    expect(screen.getByRole("group", { name: "Managed sign-in canvas" })).toBeTruthy();
  });

  it("rejects a connection from a different opaque workspace profile", () => {
    const invoke = vi.fn<AuthoringIntegrationOperationBinding["invoke"]>(() => ({
      status: "denied",
    }));
    render(
      <DesenAppApplication
        workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}
        integrationBinding={binding(invoke)}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "not authenticated for this exact workspace",
    );
    expect(screen.queryByRole("group", { name: /^Managed/ })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
