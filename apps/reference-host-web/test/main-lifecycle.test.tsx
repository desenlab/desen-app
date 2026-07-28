// @vitest-environment jsdom
import { act } from "react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// A cold production-entry import transforms the complete runtime graph. Loaded CI workers can
// legitimately exceed Vitest's 5 s default without indicating a runtime or lifecycle failure.
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
  document.body.innerHTML = '<div id="desen-reference-host-root"></div>';
  window.history.replaceState(null, "", "/");
  vi.resetModules();
});

afterEach(() => {
  act(() => {
    window.dispatchEvent(pageHideEvent(false));
  });
  document.body.replaceChildren();
});

it(
  "preserves the production composition across BFCache entry and disposes on final pagehide",
  async () => {
    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
    });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();

    act(() => {
      window.dispatchEvent(pageHideEvent(true));
    });
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(document.getElementById("desen-reference-host-root")?.textContent).toContain("Sign in");

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-reference-host-root")?.textContent).toBe("");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);
