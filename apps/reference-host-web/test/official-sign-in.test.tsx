// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";

import {
  activateReferenceHostOfficialSignIn,
  REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID,
  REFERENCE_HOST_OFFICIAL_SIGN_IN_REVISION,
} from "../src/official-sign-in.js";
import {
  createReferenceHostRoot,
  disposeReferenceHostRoot,
  readReferenceHostRoot,
} from "../src/root.js";
import { createReferenceHostSignInHttpBinding } from "../src/sign-in-http-handler.js";

import type { SignInHostOperationHandler } from "@desen/reference-catalog-web/host-operations";
import type { ReferenceHostOfficialSignInDiagnostic } from "../src/official-sign-in.js";
import type { ReferenceHostRootHandle } from "../src/root.js";

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (reason: unknown) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

function activate(
  root: ReferenceHostRootHandle,
  handler: SignInHostOperationHandler,
  diagnostics: ReferenceHostOfficialSignInDiagnostic[],
) {
  return activateReferenceHostOfficialSignIn(root, {
    browser: window,
    signIn: bindReferenceSignInHostOperation(handler),
    reportDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    },
  });
}

async function settle<Value>(deferredValue: Deferred<Value>, value: Value): Promise<void> {
  await act(async () => {
    deferredValue.resolve(value);
    await deferredValue.promise;
    await Promise.resolve();
  });
}

async function renderSignIn(
  root: ReferenceHostRootHandle,
  handler: SignInHostOperationHandler,
  diagnostics: ReferenceHostOfficialSignInDiagnostic[],
): Promise<void> {
  let result: ReturnType<typeof activate> | undefined;
  act(() => {
    result = activate(root, handler, diagnostics);
  });
  expect(result).toEqual({ status: "activated", relationship: "initial" });
  await screen.findByRole("heading", { name: "Sign in" });
}

async function changeField(label: "Email" | "Password", value: string): Promise<HTMLInputElement> {
  const field = screen.getByLabelText(label) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(field, { target: { value } });
    await Promise.resolve();
  });
  await waitFor(() => expect(field.value).toBe(value));
  return field;
}

describe("official-derived sign-in in the independent reference host", () => {
  let container: HTMLDivElement;
  let root: ReferenceHostRootHandle;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.history.replaceState(null, "", "/");
    container = document.createElement("div");
    document.body.append(container);
    act(() => {
      root = createReferenceHostRoot({
        container,
        reportDiagnostic: () => undefined,
      });
    });
  });

  afterEach(() => {
    act(() => {
      disposeReferenceHostRoot(root);
    });
    cleanup();
    container.remove();
  });

  it("runs pending, declared failure, edited retry, success, and navigation through real adapters", async () => {
    const calls: Readonly<{ email: string; password: string }>[] = [];
    const attempts: Deferred<unknown>[] = [];
    const diagnostics: ReferenceHostOfficialSignInDiagnostic[] = [];
    const handler: SignInHostOperationHandler = (input) => {
      calls.push(input);
      const attempt = deferred<unknown>();
      attempts.push(attempt);
      return attempt.promise;
    };
    await renderSignIn(root, handler, diagnostics);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(email).toHaveProperty("type", "text");
    expect(password).toHaveProperty("type", "password");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls).toEqual([]);

    await changeField("Email", "first@example.com");
    await changeField("Password", "first-password");
    expect(email).toHaveProperty("value", "first@example.com");
    expect(password).toHaveProperty("value", "first-password");
    expect(calls).toEqual([]);

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.dblClick(button);
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("data-loading")).toBe("true");
    expect(Object.isFrozen(calls[0])).toBe(true);
    expect(calls[0]).toEqual({
      email: "first@example.com",
      password: "first-password",
    });

    expect(calls).toHaveLength(1);

    await changeField("Email", "second@example.com");
    await changeField("Password", "second-password");
    expect(calls[0]).toEqual({
      email: "first@example.com",
      password: "first-password",
    });

    await settle(
      attempts[0] as Deferred<unknown>,
      Object.freeze({ status: "failed", errorCode: "invalidCredentials" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign-in failed. Check your details and try again.",
    );
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(window.location.pathname).toBe("/");

    fireEvent.click(button);
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(calls[1]).toEqual({
      email: "second@example.com",
      password: "second-password",
    });

    await settle(
      attempts[1] as Deferred<unknown>,
      Object.freeze({
        status: "succeeded",
        value: Object.freeze({ userId: "private-user-id-must-not-render" }),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.location.pathname).toBe("/home");
    expect(container.textContent).not.toContain("private-user-id-must-not-render");
    expect(diagnostics).toEqual([]);
  });

  it("runs the production HTTP binding through runtime, real adapters, retry, and navigation", async () => {
    const diagnostics: ReferenceHostOfficialSignInDiagnostic[] = [];
    const fetchLike = vi.fn(async () => {
      if (fetchLike.mock.calls.length === 1) {
        return new Response('{"private":"must-not-be-read"}', { status: 401 });
      }
      return new Response('{"userId":"http-private-user"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    let activation: ReturnType<typeof activateReferenceHostOfficialSignIn> | undefined;
    act(() => {
      activation = activateReferenceHostOfficialSignIn(root, {
        browser: window,
        signIn: createReferenceHostSignInHttpBinding(fetchLike),
        reportDiagnostic(diagnostic) {
          diagnostics.push(diagnostic);
        },
      });
    });
    expect(activation).toEqual({ status: "activated", relationship: "initial" });
    await screen.findByRole("heading", { name: "Sign in" });

    await changeField("Email", "http@example.com");
    await changeField("Password", "http-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign-in failed. Check your details and try again.",
    );
    expect(fetchLike).toHaveBeenCalledTimes(1);
    expect(fetchLike).toHaveBeenNthCalledWith(
      1,
      "/api/sign-in",
      expect.objectContaining({
        method: "POST",
        body: '{"email":"http@example.com","password":"http-password"}',
        credentials: "same-origin",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(fetchLike).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/home");
    expect(container.textContent).not.toContain("http-private-user");
    expect(diagnostics).toEqual([]);
  });

  it("denies an empty-password contract input before I/O and keeps service failure generic", async () => {
    const calls: unknown[] = [];
    const diagnostics: ReferenceHostOfficialSignInDiagnostic[] = [];
    const attempt = deferred<unknown>();
    await renderSignIn(
      root,
      (input) => {
        calls.push(input);
        return attempt.promise;
      },
      diagnostics,
    );

    await changeField("Email", "person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(calls).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("aria-busy")).toBe(false);

    await changeField("Password", "password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await settle(attempt, Object.freeze({ status: "failed", errorCode: "unavailable" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign-in failed. Check your details and try again.",
    );
    expect(window.location.pathname).toBe("/");
  });

  it("contains a pending same-document authority after exact session and host replacement", async () => {
    const diagnostics: ReferenceHostOfficialSignInDiagnostic[] = [];
    const oldAttempt = deferred<unknown>();
    const oldCalls: unknown[] = [];
    await renderSignIn(
      root,
      (input) => {
        oldCalls.push(input);
        return oldAttempt.promise;
      },
      diagnostics,
    );
    const oldEmail = screen.getByLabelText("Email");
    const oldButton = screen.getByRole("button", { name: "Sign in" });
    await changeField("Email", "old@example.com");
    await changeField("Password", "old-password");
    fireEvent.click(oldButton);
    await waitFor(() => expect(oldCalls).toHaveLength(1));

    const currentAttempt = deferred<unknown>();
    const currentCalls: unknown[] = [];
    let replacement: ReturnType<typeof activate> | undefined;
    act(() => {
      replacement = activate(
        root,
        (input) => {
          currentCalls.push(input);
          return currentAttempt.promise;
        },
        diagnostics,
      );
    });
    expect(replacement).toEqual({ status: "activated", relationship: "replaced" });
    await screen.findByRole("heading", { name: "Sign in" });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "");
    expect(readReferenceHostRoot(root)).toMatchObject({
      status: "active",
      phase: "surface",
    });

    fireEvent.change(oldEmail, { target: { value: "revoked@example.com" } });
    fireEvent.click(oldButton);
    expect(oldCalls).toHaveLength(1);

    await settle(
      oldAttempt,
      Object.freeze({
        status: "succeeded",
        value: Object.freeze({ userId: "stale-private-user" }),
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByText("Welcome")).toBeNull();
    expect(container.textContent).not.toContain("stale-private-user");

    await changeField("Email", "current@example.com");
    await changeField("Password", "current-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(currentCalls).toHaveLength(1));
    await settle(
      currentAttempt,
      Object.freeze({
        status: "succeeded",
        value: Object.freeze({ userId: "current-private-user" }),
      }),
    );
    expect(await screen.findByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(window.location.pathname).toBe("/home");
  });

  it("redacts rejected host failures, permits explicit retry, and ignores late disposal results", async () => {
    const emailSentinel = "credential-sentinel@example.com";
    const passwordSentinel = "password-sentinel";
    const rawErrorSentinel = "raw-error-sentinel";
    const diagnostics: ReferenceHostOfficialSignInDiagnostic[] = [];
    const successfulRetry = deferred<unknown>();
    let calls = 0;
    await renderSignIn(
      root,
      () => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error(rawErrorSentinel));
        return successfulRetry.promise;
      },
      diagnostics,
    );
    await changeField("Email", emailSentinel);
    await changeField("Password", passwordSentinel);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(diagnostics.some(({ code }) => code === "ADAPTER_FAILURE")).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("aria-busy")).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.location.pathname).toBe("/");
    expect(JSON.stringify(diagnostics)).not.toContain(emailSentinel);
    expect(JSON.stringify(diagnostics)).not.toContain(passwordSentinel);
    expect(JSON.stringify(diagnostics)).not.toContain(rawErrorSentinel);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(calls).toBe(2));
    act(() => {
      expect(disposeReferenceHostRoot(root)).toEqual({ status: "disposed" });
    });
    await settle(
      successfulRetry,
      Object.freeze({
        status: "succeeded",
        value: Object.freeze({ userId: "late-private-user" }),
      }),
    );
    expect(container.textContent).toBe("");
    expect(window.location.pathname).toBe("/");
    expect(readReferenceHostRoot(root)).toEqual({ status: "disposed" });
  });

  it("cleans host and session authorities when root activation cannot transfer ownership", () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const handler = vi.fn();
    const fakeRoot = Object.freeze({}) as ReferenceHostRootHandle;
    try {
      expect(
        activateReferenceHostOfficialSignIn(fakeRoot, {
          browser: window,
          signIn: bindReferenceSignInHostOperation(handler),
          reportDiagnostic: () => undefined,
        }),
      ).toEqual({ status: "rejected", reason: "root-activation-failed" });
      expect(handler).not.toHaveBeenCalled();
      expect(removeWindowListener).toHaveBeenCalled();
    } finally {
      removeWindowListener.mockRestore();
    }
  });

  it("rejects accessor-backed composition input without invoking it", () => {
    let getterCalls = 0;
    const input = Object.defineProperties(
      {},
      {
        browser: { enumerable: true, value: window },
        signIn: {
          enumerable: true,
          get() {
            getterCalls += 1;
            return bindReferenceSignInHostOperation(() => undefined);
          },
        },
        reportDiagnostic: { enumerable: true, value: () => undefined },
      },
    );
    expect(activateReferenceHostOfficialSignIn(root, input as never)).toEqual({
      status: "rejected",
      reason: "malformed-input",
    });
    expect(getterCalls).toBe(0);
  });

  it("pins the exact controlled document and revision identities", () => {
    expect(REFERENCE_HOST_OFFICIAL_SIGN_IN_DOCUMENT_ID).toBe("com.example.account-app");
    expect(REFERENCE_HOST_OFFICIAL_SIGN_IN_REVISION).toBe(
      "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    );
  });
});
