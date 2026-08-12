// @vitest-environment jsdom
import { act } from "react";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";

import officialDerivedSignInBundle from "../../../examples/sign-in/official-derived.bundle.desen.json";
import {
  createReferenceHostChannelDelivery,
  disposeReferenceHostChannelDelivery,
  refreshReferenceHostChannel,
} from "../src/channel-delivery.js";
import {
  createReferenceHostRoot,
  disposeReferenceHostRoot,
  readReferenceHostRoot,
} from "../src/root.js";

import type { ReferenceHostChannelDeliveryFetch } from "../src/channel-delivery.js";
import type { ReferenceHostRootHandle } from "../src/root.js";

interface Deferred<Value> {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
}

interface ResponseOptions {
  readonly contentEncoding?: string;
  readonly contentLength?: string | null;
  readonly contentType?: string;
  readonly etag?: string;
  readonly redirected?: boolean;
  readonly status?: number;
  readonly url?: string;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return Object.freeze({ promise, resolve });
}

function revisionOf(bundle: unknown): string {
  const descriptor = Object.getOwnPropertyDescriptor(bundle, "revision");
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    typeof descriptor.value !== "string"
  ) {
    throw new TypeError("Test Bundle has no revision.");
  }
  return descriptor.value;
}

function deliveryEnvelope(generation: number, bundle: unknown): unknown {
  return {
    activation: { generation, revision: revisionOf(bundle) },
    bundle,
  };
}

function channelResponse(
  generation: number,
  bundle: unknown = officialDerivedSignInBundle,
  options: ResponseOptions = {},
  envelope: unknown = deliveryEnvelope(generation, bundle),
): Response {
  const status = options.status ?? 200;
  const body = status === 204 ? null : JSON.stringify(envelope);
  const headers = new Headers();
  headers.set("content-type", options.contentType ?? "application/json");
  headers.set(
    "etag",
    options.etag ?? `"desen-active:g:${String(generation)}:${revisionOf(bundle)}"`,
  );
  if (options.contentEncoding !== undefined) {
    headers.set("content-encoding", options.contentEncoding);
  }
  if (options.contentLength !== null && body !== null) {
    headers.set(
      "content-length",
      options.contentLength ?? String(new TextEncoder().encode(body).byteLength),
    );
  }
  const response = new Response(body, { headers, status });
  Object.defineProperties(response, {
    redirected: { configurable: true, value: options.redirected ?? false },
    url: {
      configurable: true,
      value: options.url ?? new URL("/__desen/runtime/refresh", window.location.href).href,
    },
  });
  return response;
}

function cloneBundle(): Record<string, unknown> {
  return structuredClone(officialDerivedSignInBundle) as Record<string, unknown>;
}

describe("reference-host browser channel delivery", () => {
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
    vi.useRealTimers();
    cleanup();
    container.remove();
  });

  function createDelivery(fetch: ReferenceHostChannelDeliveryFetch) {
    return createReferenceHostChannelDelivery({
      browser: window,
      fetch,
      reportDiagnostic: () => undefined,
      root,
      signIn: bindReferenceSignInHostOperation(() =>
        Object.freeze({ status: "failed", errorCode: "unavailable" }),
      ),
    });
  }

  it("requests only the fixed bodyless same-origin endpoint and activates the exact Bundle", async () => {
    const fetchLike = vi.fn(async () => channelResponse(7));
    const delivery = createDelivery(fetchLike);

    let result: Awaited<ReturnType<typeof refreshReferenceHostChannel>> | undefined;
    await act(async () => {
      result = await refreshReferenceHostChannel(delivery);
    });

    expect(result).toEqual({ status: "activated", relationship: "initial" });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(fetchLike).toHaveBeenCalledTimes(1);
    const [resource, init] = fetchLike.mock.calls[0] as unknown as [string, RequestInit];
    expect(resource).toBe("/__desen/runtime/refresh");
    expect(resource).not.toContain("?");
    expect(Object.hasOwn(init, "body")).toBe(false);
    expect(Object.isFrozen(init)).toBe(true);
    expect(init).toMatchObject({
      cache: "no-store",
      credentials: "omit",
      method: "POST",
      mode: "same-origin",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(readReferenceHostRoot(root)).toMatchObject({ status: "active", phase: "surface" });
  });

  it("coalesces concurrent refresh calls into one request and one promise", async () => {
    const pending = deferred<unknown>();
    const fetchLike = vi.fn(() => pending.promise);
    const delivery = createDelivery(fetchLike);

    const first = refreshReferenceHostChannel(delivery);
    const second = refreshReferenceHostChannel(delivery);
    expect(second).toBe(first);
    expect(fetchLike).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(channelResponse(1));
      expect(await first).toEqual({ status: "activated", relationship: "initial" });
    });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeTruthy();
  });

  it("keeps the current surface for malformed, redirected, encoded, and rejected responses", async () => {
    const responses: unknown[] = [
      channelResponse(2),
      channelResponse(3, officialDerivedSignInBundle, {
        etag: `"desen-active:g:3:sha256:${"0".repeat(64)}"`,
      }),
      channelResponse(3, officialDerivedSignInBundle, {
        url: new URL("/other", window.location.href).href,
      }),
      channelResponse(3, officialDerivedSignInBundle, { redirected: true }),
      channelResponse(3, officialDerivedSignInBundle, { contentEncoding: "gzip" }),
      channelResponse(3, officialDerivedSignInBundle, { contentLength: "1" }),
      channelResponse(
        3,
        officialDerivedSignInBundle,
        {},
        {
          activation: {
            generation: 3,
            revision: revisionOf(officialDerivedSignInBundle),
          },
          bundle: officialDerivedSignInBundle,
          token: "token-must-not-leak",
          upstream: "upstream-must-not-leak",
          path: "path-must-not-leak",
          previousGoodRevision: "previous-good-must-not-leak",
        },
      ),
      channelResponse(3, officialDerivedSignInBundle, { status: 204 }),
    ];
    const delivery = createDelivery(vi.fn(async () => responses.shift()));
    await act(async () => {
      expect(await refreshReferenceHostChannel(delivery)).toEqual({
        status: "activated",
        relationship: "initial",
      });
    });
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "surface-state-must-survive" } });

    for (let index = 0; index < 7; index += 1) {
      let result: Awaited<ReturnType<typeof refreshReferenceHostChannel>> | undefined;
      await act(async () => {
        result = await refreshReferenceHostChannel(delivery);
      });
      expect(result?.status).toBe("preserved");
      expect(screen.getByLabelText("Email")).toHaveProperty("value", "surface-state-must-survive");
    }
    expect(container.textContent).not.toContain("token-must-not-leak");
    expect(container.textContent).not.toContain("upstream-must-not-leak");
    expect(container.textContent).not.toContain("path-must-not-leak");
    expect(container.textContent).not.toContain("previous-good-must-not-leak");
  });

  it("[browser-mount-preserves-good] preserves A when a higher-generation Bundle fails the real session mount", async () => {
    const invalidBundle = cloneBundle();
    const surfaces = invalidBundle.surfaces as Record<string, unknown>;
    const signInSurface = surfaces["sign-in"] as Record<string, unknown>;
    const rootNode = signInSurface.root as Record<string, unknown>;
    const props = rootNode.props as Record<string, unknown>;
    props.gap = "revision-mismatch-mutation";

    const responses = [channelResponse(1), channelResponse(2, invalidBundle)];
    const delivery = createDelivery(vi.fn(async () => responses.shift()));
    await act(async () => {
      await refreshReferenceHostChannel(delivery);
    });
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "authenticated-a-state" } });

    let result: Awaited<ReturnType<typeof refreshReferenceHostChannel>> | undefined;
    await act(async () => {
      result = await refreshReferenceHostChannel(delivery);
    });
    expect(result).toEqual({ status: "preserved", reason: "activation-rejected" });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "authenticated-a-state");
    expect(readReferenceHostRoot(root)).toMatchObject({ status: "active", phase: "surface" });
  });

  it("deduplicates the current durable identity and rejects a regressing generation", async () => {
    const responses = [channelResponse(4), channelResponse(4), channelResponse(3)];
    const delivery = createDelivery(vi.fn(async () => responses.shift()));
    await act(async () => {
      await refreshReferenceHostChannel(delivery);
    });
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "identity-state" } });

    await act(async () => {
      expect(await refreshReferenceHostChannel(delivery)).toEqual({
        status: "preserved",
        reason: "unchanged",
      });
      expect(await refreshReferenceHostChannel(delivery)).toEqual({
        status: "preserved",
        reason: "stale-response",
      });
    });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "identity-state");
  });

  it("replaces the mounted authority only after a newer delivery mounts successfully", async () => {
    const responses = [channelResponse(1), channelResponse(2)];
    const delivery = createDelivery(vi.fn(async () => responses.shift()));
    await act(async () => {
      await refreshReferenceHostChannel(delivery);
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "old-session-state" },
    });

    await act(async () => {
      expect(await refreshReferenceHostChannel(delivery)).toEqual({
        status: "activated",
        relationship: "replaced",
      });
    });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "");
    expect(container.textContent).not.toContain("old-session-state");
  });

  it("times out a fetch that ignores abort and admits a later clean refresh", async () => {
    vi.useFakeTimers();
    const never = new Promise<unknown>(() => undefined);
    const fetchLike = vi
      .fn<ReferenceHostChannelDeliveryFetch>()
      .mockImplementationOnce(() => never)
      .mockImplementationOnce(async () => channelResponse(1));
    const delivery = createDelivery(fetchLike);

    const first = refreshReferenceHostChannel(delivery);
    const firstSignal = (fetchLike.mock.calls[0]?.[1] as RequestInit | undefined)?.signal;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(await first).toEqual({ status: "preserved", reason: "transport-rejected" });
    expect(firstSignal?.aborted).toBe(true);

    vi.useRealTimers();
    await act(async () => {
      expect(await refreshReferenceHostChannel(delivery)).toEqual({
        status: "activated",
        relationship: "initial",
      });
    });
    expect(fetchLike).toHaveBeenCalledTimes(2);
  });

  it("settles disposal immediately and fences a fetch response that arrives late", async () => {
    const late = deferred<unknown>();
    const fetchLike = vi
      .fn<ReferenceHostChannelDeliveryFetch>()
      .mockImplementationOnce(async () => channelResponse(1))
      .mockImplementationOnce(() => late.promise);
    const delivery = createDelivery(fetchLike);
    await act(async () => {
      await refreshReferenceHostChannel(delivery);
    });
    const email = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "current-surface" } });

    const pending = refreshReferenceHostChannel(delivery);
    await act(async () => {
      expect(disposeReferenceHostChannelDelivery(delivery)).toEqual({ status: "disposed" });
      expect(await pending).toEqual({ status: "preserved", reason: "disposed" });
    });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "current-surface");

    await act(async () => {
      late.resolve(channelResponse(2));
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Email")).toHaveProperty("value", "current-surface");
    expect(await refreshReferenceHostChannel(delivery)).toEqual({
      status: "preserved",
      reason: "disposed",
    });
  });
});
