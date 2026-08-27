// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as RuntimeCore from "@desen/runtime-core";

const lifecycle = vi.hoisted(() => ({
  mounted: [] as object[],
  disposed: [] as object[],
}));

vi.mock("@desen/runtime-core", async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeCore>();

  return {
    ...actual,
    mountRuntimeHeadlessSession(
      input: Parameters<typeof actual.mountRuntimeHeadlessSession>[0],
    ): ReturnType<typeof actual.mountRuntimeHeadlessSession> {
      const result = actual.mountRuntimeHeadlessSession(input);
      if (result.status === "mounted") lifecycle.mounted.push(result.handle);
      return result;
    },
    disposeRuntimeHeadlessSession(
      handle: Parameters<typeof actual.disposeRuntimeHeadlessSession>[0],
    ): ReturnType<typeof actual.disposeRuntimeHeadlessSession> {
      lifecycle.disposed.push(handle);
      return actual.disposeRuntimeHeadlessSession(handle);
    },
  };
});

import { DesenAdapterCanvas } from "../src/adapter-canvas.js";
import { createAuthoringComponentSelection } from "../src/authoring-selection.js";

function componentSelection(
  sourceNodeId: string,
  capabilityId: string,
  displayName: string,
  conditional = false,
) {
  return createAuthoringComponentSelection({
    projectId: "account-app",
    surfaceId: "sign-in",
    sourceNodeId,
    capabilityId,
    displayName,
    conditional,
  });
}

describe("Desen App exact React adapter canvas", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    lifecycle.mounted.length = 0;
    lifecycle.disposed.length = 0;
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("renders the official-derived sign-in only through the shared real adapters", async () => {
    render(<DesenAdapterCanvas projectId="account-app" surfaceId="sign-in" />);

    const canvas = await screen.findByRole("group", { name: "Sign-in adapter canvas" });
    expect(canvas).toBeInstanceOf(HTMLFieldSetElement);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
    expect(within(canvas).getByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    const email = within(canvas).getByLabelText("Email") as HTMLInputElement;
    const password = within(canvas).getByLabelText("Password") as HTMLInputElement;
    const submit = within(canvas).getByRole("button", { name: "Sign in" });
    expect(email.type).toBe("text");
    expect(password.type).toBe("password");
    expect(email.matches(":disabled")).toBe(true);
    expect(password.matches(":disabled")).toBe(true);
    expect(submit.matches(":disabled")).toBe(true);
    expect(within(canvas).queryByRole("alert")).toBeNull();
    expect(screen.getByText("Design preview · controls are disabled.")).toBeTruthy();
    expect(document.querySelector("canvas")).toBeNull();
    expect(lifecycle.mounted).toHaveLength(1);
  });

  it("fails closed for every unsupported project or surface without mounting sign-in", () => {
    const view = render(<DesenAdapterCanvas projectId="account-app" surfaceId="recovery" />);

    expect(
      screen.getByText("No exact adapter preview is available for this surface."),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Sign-in adapter canvas" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(lifecycle.mounted).toHaveLength(0);

    view.rerender(<DesenAdapterCanvas projectId="checkout-pilot" surfaceId="sign-in" />);
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(lifecycle.mounted).toHaveLength(0);
  });

  it("removes a previous tree synchronously and disposes the exact route session", async () => {
    const view = render(<DesenAdapterCanvas projectId="account-app" surfaceId="sign-in" />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    const firstSession = lifecycle.mounted[0];
    expect(firstSession).toBeDefined();

    view.rerender(<DesenAdapterCanvas projectId="account-app" surfaceId="profile" />);

    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    await waitFor(() => {
      expect(lifecycle.disposed).toEqual([firstSession]);
    });
  });

  it("balances StrictMode replay and final unmount with exact session disposal", async () => {
    const view = render(
      <StrictMode>
        <DesenAdapterCanvas projectId="account-app" surfaceId="sign-in" />
      </StrictMode>,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    await waitFor(() => {
      expect(lifecycle.mounted).toHaveLength(2);
      expect(lifecycle.disposed).toEqual([lifecycle.mounted[0]]);
    });

    view.unmount();
    expect(lifecycle.disposed).toEqual([lifecycle.mounted[0], lifecycle.mounted[1]]);
  });

  it("renders Source-identity selection chrome as a sibling outside the managed subtree", async () => {
    render(
      <DesenAdapterCanvas
        projectId="account-app"
        selection={componentSelection("sign-in.email", "com.example.ui/TextField", "Text field")}
        surfaceId="sign-in"
      />,
    );

    const canvas = await screen.findByRole("group", { name: "Sign-in adapter canvas" });
    const overlay = await screen.findByRole("status", { name: "Selected layer preview" });
    const managedSubtree = document.querySelector("[data-managed-capability-subtree='true']");

    expect(overlay.textContent).toContain("Text field");
    expect(overlay.textContent).toContain("sign-in.email");
    expect(overlay.textContent).toContain("Visible in preview");
    expect(canvas.parentElement).toBe(overlay.parentElement);
    expect(canvas.contains(overlay)).toBe(false);
    expect(overlay.contains(canvas)).toBe(false);
    expect(managedSubtree).toBeTruthy();
    expect(managedSubtree?.contains(overlay)).toBe(false);
    expect((canvas as HTMLFieldSetElement).disabled).toBe(true);
  });

  it("keeps a selected conditional Source node honest when it is not materialized", async () => {
    render(
      <DesenAdapterCanvas
        projectId="account-app"
        selection={componentSelection("sign-in.error", "com.example.ui/Alert", "Alert", true)}
        surfaceId="sign-in"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    const overlay = screen.getByRole("status", { name: "Selected layer preview" });
    expect(overlay.getAttribute("data-materialized")).toBe("false");
    expect(overlay.textContent).toContain("Hidden by condition");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects stale and cross-route selection identities without exposing overlay chrome", async () => {
    const stale = createAuthoringComponentSelection({
      projectId: "other-project",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.email",
      capabilityId: "com.example.ui/TextField",
      displayName: "Text field",
      conditional: false,
    });
    const view = render(
      <DesenAdapterCanvas projectId="account-app" selection={stale} surfaceId="sign-in" />,
    );

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();

    const forged = createAuthoringComponentSelection({
      projectId: "account-app",
      surfaceId: "sign-in",
      sourceNodeId: "sign-in.forged",
      capabilityId: "com.example.ui/Alert",
      displayName: "Forged",
      conditional: true,
    });
    view.rerender(
      <DesenAdapterCanvas projectId="account-app" selection={forged} surfaceId="sign-in" />,
    );
    expect(screen.queryByRole("status", { name: "Selected layer preview" })).toBeNull();
  });
});
