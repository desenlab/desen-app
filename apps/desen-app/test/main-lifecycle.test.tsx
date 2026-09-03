// @vitest-environment jsdom
import { act } from "react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js";

import type { DesenEditorPersistencePort } from "@desen/editor-core";

const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;

function pageHideEvent(persisted: boolean): Event {
  const event = new Event("pagehide");
  Object.defineProperty(event, "persisted", {
    enumerable: true,
    value: persisted,
  });
  return event;
}

function persistencePort(
  openSource: DesenEditorPersistencePort["openSource"],
): DesenEditorPersistencePort {
  return Object.freeze({
    openSource,
    saveSource: async () => Object.freeze({ status: "created" as const, generation: 1 as const }),
  });
}

function injectPersistencePort(port: DesenEditorPersistencePort | null) {
  const createInjectedDesenAppLocalPersistencePort = vi.fn((browserFetchValue: unknown) => {
    void browserFetchValue;
    return port;
  });
  vi.doMock("../src/local-runtime-persistence.js", () => ({
    createInjectedDesenAppLocalPersistencePort,
  }));
  return createInjectedDesenAppLocalPersistencePort;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  document.body.innerHTML = '<div id="desen-app-root"></div>';
  window.history.replaceState(null, "", "/");
  vi.resetModules();
  vi.doUnmock("../src/local-runtime-persistence.js");
});

afterEach(() => {
  act(() => {
    window.dispatchEvent(pageHideEvent(false));
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it(
  "normalizes the root and mounts the empty durable product workspace",
  async () => {
    const startupFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", startupFetch);
    const replaceState = vi.spyOn(window.history, "replaceState");
    const createPersistence = injectPersistencePort(
      persistencePort(async () => Object.freeze({ status: "missing" as const })),
    );

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/projects");
    expect(window.location.pathname).toBe("/projects");
    expect(await screen.findByRole("heading", { level: 1, name: "Projects" })).toBeTruthy();
    expect(screen.getByText("0 projects")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "New project" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(document.getElementById("desen-app-root")?.textContent).not.toContain("Checkout pilot");
    expect(createPersistence).toHaveBeenCalledTimes(1);
    expect(createPersistence.mock.calls[0]?.[0]).toEqual(expect.any(Function));
    const capturedFetch = createPersistence.mock.calls[0]?.[0] as (
      input: string,
      init: RequestInit,
    ) => Promise<Response>;
    const replacementFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", replacementFetch);
    await capturedFetch("http://127.0.0.1:43127/probe", { method: "GET" });
    expect(startupFetch).toHaveBeenCalledTimes(1);
    expect(replacementFetch).not.toHaveBeenCalled();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "preserves an opened product Source for BFCache and unmounts only on final pagehide",
  async () => {
    window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");
    injectPersistencePort(
      persistencePort(async () =>
        Object.freeze({
          status: "opened" as const,
          generation: 3,
          document: EMPTY_REFERENCE_PROJECT_DOCUMENT,
        }),
      ),
    );

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Select Stack layer · sign-in.layout" }),
    ).toBeTruthy();

    act(() => {
      window.dispatchEvent(pageHideEvent(true));
    });
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(document.getElementById("desen-app-root")?.textContent).toContain("Generation 3");

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-app-root")?.textContent).toBe("");

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-app-root")?.textContent).toBe("");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "fails closed without mounting fixture data when no runtime persistence was configured",
  async () => {
    injectPersistencePort(null);

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(
      await screen.findByRole("heading", { name: "DESEN could not open this workspace." }),
    ).toBeTruthy();
    expect(screen.getByText(/No fixture project was substituted/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Account app" })).toBeNull();
    expect(screen.queryByRole("group", { name: /^Managed / })).toBeNull();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "throws before composing persistence when the production root container is absent",
  async () => {
    const createPersistence = injectPersistencePort(null);
    document.body.replaceChildren();

    await expect(import("../src/main.js")).rejects.toThrow(
      "The Desen App root container is missing.",
    );
    expect(document.body.textContent).toBe("");
    expect(createPersistence).not.toHaveBeenCalled();
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);
