// @vitest-environment jsdom
import { act } from "react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;

function pageHideEvent(persisted: boolean): Event {
  const event = new Event("pagehide");
  Object.defineProperty(event, "persisted", {
    enumerable: true,
    value: persisted,
  });
  return event;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  document.body.innerHTML = '<div id="desen-app-root"></div>';
  window.history.replaceState(null, "", "/");
  vi.resetModules();
});

afterEach(() => {
  act(() => {
    window.dispatchEvent(pageHideEvent(false));
  });
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it(
  "normalizes the root and mounts the production projects shell",
  async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });

    expect(replaceState).toHaveBeenCalledWith(null, "", "/projects");
    expect(window.location.pathname).toBe("/projects");
    expect(await screen.findByRole("heading", { level: 1, name: "Projects" })).toBeTruthy();
    expect(document.getElementById("desen-app-root")?.textContent).toContain("Account app");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "preserves the mounted shell for BFCache and unmounts only on final pagehide",
  async () => {
    window.history.replaceState(null, "", "/projects/account-app/surfaces/sign-in");

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 2, name: "Sign in" })).toBeTruthy();

    act(() => {
      window.dispatchEvent(pageHideEvent(true));
    });
    expect(screen.getByRole("heading", { level: 2, name: "Sign-in" })).toBeTruthy();
    expect(document.getElementById("desen-app-root")?.textContent).toContain(
      "Design preview · controls are disabled.",
    );

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
  "throws before mounting when the production root container is absent",
  async () => {
    document.body.replaceChildren();

    await expect(import("../src/main.js")).rejects.toThrow(
      "The Desen App root container is missing.",
    );
    expect(document.body.textContent).toBe("");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);
