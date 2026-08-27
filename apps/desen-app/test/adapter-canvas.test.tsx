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
    expect(within(canvas).getByText("Design preview · controls are disabled.")).toBeTruthy();
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
});
