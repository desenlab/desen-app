// @vitest-environment jsdom
import { act } from "react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";

// A cold production-entry import transforms the complete runtime graph. Loaded CI workers can
// legitimately exceed Vitest's 5 s default without indicating a runtime or lifecycle failure.
const PRODUCTION_ENTRY_TEST_TIMEOUT_MS = 15_000;

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return Object.freeze({ promise, resolve });
}

function pageHideEvent(persisted: boolean): Event {
  const event = new Event("pagehide");
  Object.defineProperty(event, "persisted", {
    enumerable: true,
    value: persisted,
  });
  return event;
}

function pageShowEvent(persisted: boolean): Event {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", {
    enumerable: true,
    value: persisted,
  });
  return event;
}

function channelResponse(generation: number): Response {
  const revision = officialDerivedSignInBundle.revision;
  const body = JSON.stringify({
    activation: { generation, revision },
    bundle: officialDerivedSignInBundle,
  });
  const response = new Response(body, {
    headers: {
      "content-length": String(new TextEncoder().encode(body).byteLength),
      "content-type": "application/json",
      etag: `"desen-active:g:${String(generation)}:${revision}"`,
    },
    status: 200,
  });
  Object.defineProperties(response, {
    redirected: { configurable: true, value: false },
    url: {
      configurable: true,
      value: new URL("/__desen/runtime/refresh", window.location.href).href,
    },
  });
  return response;
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
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it(
  "preserves the production composition across BFCache entry and disposes on final pagehide",
  async () => {
    const restoredResponse = deferred<unknown>();
    const fetchLike = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => channelResponse(1))
      .mockImplementationOnce(() => restoredResponse.promise as Promise<Response>);
    vi.stubGlobal("fetch", fetchLike);
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
      window.dispatchEvent(pageShowEvent(true));
    });
    expect(fetchLike).toHaveBeenCalledTimes(2);

    act(() => {
      window.dispatchEvent(pageHideEvent(false));
    });
    expect(document.getElementById("desen-reference-host-root")?.textContent).toBe("");

    await act(async () => {
      restoredResponse.resolve(channelResponse(2));
      await Promise.resolve();
    });
    expect(document.getElementById("desen-reference-host-root")?.textContent).toBe("");
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);

it(
  "keeps the host boot surface instead of falling back to the historical static Bundle",
  async () => {
    const fetchLike = vi.fn<typeof fetch>(async () => {
      const response = new Response(null, { status: 503 });
      Object.defineProperties(response, {
        redirected: { configurable: true, value: false },
        url: {
          configurable: true,
          value: new URL("/__desen/runtime/refresh", window.location.href).href,
        },
      });
      return response;
    });
    vi.stubGlobal("fetch", fetchLike);

    await act(async () => {
      await import("../src/main.js");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      await screen.findByRole("heading", { name: "Waiting for verified activation." }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in" })).toBeNull();
    expect(fetchLike).toHaveBeenCalledTimes(1);
  },
  PRODUCTION_ENTRY_TEST_TIMEOUT_MS,
);
