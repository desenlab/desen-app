import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DESEN_APP_LOCAL_OPERATION_PROFILE,
  DesenAppLocalOperationConfigurationError,
  captureDesenAppLocalOperationConfig,
  createDesenAppLocalSignInOperation,
  readInjectedDesenAppLocalOperationConfig,
} from "../src/local-operation-binding.js";

import type { RuntimeOperationRequest } from "@desen/runtime-core";
import type { DesenAppLocalOperationFetch } from "../src/local-operation-binding.js";

const TOKEN = "operation-only-test-bearer-0123456789";
const ORIGIN = "http://127.0.0.1:43128";
const config = () => ({
  profile: DESEN_APP_LOCAL_OPERATION_PROFILE,
  origin: ORIGIN,
  apiToken: TOKEN,
});
const request = (): RuntimeOperationRequest =>
  Object.freeze({
    context: Object.freeze({
      documentId: "local-flow",
      revision: `sha256:${"a".repeat(64)}`,
      surfaceId: "entry",
      requestId: "request-1",
    }),
    capabilityId: "com.example.auth/signIn",
    invocationAlias: "authenticate",
    effect: "network",
    input: Object.freeze({ email: "designer@example.test", password: "local-demo-pass" }),
  });
const successResponse = () =>
  new Response('{"userId":"local-host-user"}', {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("local operation binding", () => {
  it("captures a detached exact config and keeps injection absent unless explicitly installed", () => {
    const raw = config();
    const captured = captureDesenAppLocalOperationConfig(raw);
    raw.apiToken = "changed";
    expect(captured).toEqual(config());
    expect(Object.isFrozen(captured)).toBe(true);
    expect(readInjectedDesenAppLocalOperationConfig()).toBeNull();
    vi.stubGlobal("__DESEN_APP_LOCAL_OPERATION_CONFIG__", config());
    expect(readInjectedDesenAppLocalOperationConfig()).toEqual(config());
  });

  it.each([
    null,
    {},
    { ...config(), extra: true },
    { ...config(), profile: "desen.app.local-runtime.v1" },
    { ...config(), origin: "http://localhost:43128" },
    { ...config(), origin: "https://127.0.0.1:43128" },
    { ...config(), origin: "http://127.0.0.1:0" },
    { ...config(), origin: "http://127.0.0.1:65536" },
    { ...config(), origin: `${ORIGIN}/api/sign-in` },
    { ...config(), apiToken: "short" },
  ])("rejects unknown or redirected configuration without disclosing its bearer", (raw) => {
    expect(() => captureDesenAppLocalOperationConfig(raw)).toThrowError(
      new DesenAppLocalOperationConfigurationError("INVALID_CONFIG"),
    );
  });

  it("does not evaluate accessor configuration and requires an explicit fetch capability", () => {
    const getter = vi.fn(() => ORIGIN);
    const raw = Object.defineProperty(config(), "origin", { get: getter, enumerable: true });
    expect(() => captureDesenAppLocalOperationConfig(raw)).toThrowError(
      "The local operation configuration is invalid.",
    );
    expect(getter).not.toHaveBeenCalled();
    expect(() => createDesenAppLocalSignInOperation(config(), undefined)).toThrowError(
      new DesenAppLocalOperationConfigurationError("INVALID_FETCH"),
    );
  });

  it("uses the fixed host binding and one bounded fetch without ambient credentials", async () => {
    const fetchLike: DesenAppLocalOperationFetch = vi.fn(async () => successResponse());
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    const signal = new AbortController().signal;
    const result = await invoke(request(), signal);
    expect(result).toEqual({ status: "succeeded", value: { userId: "local-host-user" } });
    expect(result).not.toEqual({ status: "succeeded", value: { userId: "user-1" } });
    expect(fetchLike).toHaveBeenCalledExactlyOnceWith(
      `${ORIGIN}/api/sign-in`,
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(request().input),
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${TOKEN}`,
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    { ...request(), capabilityId: "com.example.other/send" },
    { ...request(), effect: "external" },
    { ...request(), input: { email: "a", password: "" } },
    { ...request(), input: { email: "a", password: "b", endpoint: "/other" } },
    { ...request(), input: { email: "a".repeat(4_097), password: "b" } },
    { ...request(), input: { email: "a", password: "\u0000".repeat(4_096) } },
  ])("denies wrong authority and over-budget request bodies before transport", async (raw) => {
    const fetchLike = vi.fn(async () => successResponse());
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    expect(await invoke(raw as RuntimeOperationRequest, new AbortController().signal)).toEqual({
      status: "denied",
    });
    expect(fetchLike).not.toHaveBeenCalled();
  });

  it("does not inspect credentials for a denied capability or access active input fields", async () => {
    const getter = vi.fn(() => "local-demo-pass");
    const fetchLike = vi.fn(async () => successResponse());
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    const input = Object.defineProperty({ email: "designer@example.test" }, "password", {
      enumerable: true,
      get: getter,
    });
    expect(
      await invoke(
        { ...request(), input } as RuntimeOperationRequest,
        new AbortController().signal,
      ),
    ).toEqual({ status: "denied" });
    expect(getter).not.toHaveBeenCalled();
    expect(fetchLike).not.toHaveBeenCalled();
  });

  it("returns only the declared error classification and leaves output schema authority to Runtime", async () => {
    const responses = [
      new Response('{"error":"private detail"}', {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
      new Response('{"error":"private detail"}', {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
      new Response('{"different":"field"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ];
    const invoke = createDesenAppLocalSignInOperation(config(), async () => responses.shift());
    expect(await invoke(request(), new AbortController().signal)).toEqual({
      status: "failed",
      errorCode: "invalidCredentials",
    });
    expect(await invoke(request(), new AbortController().signal)).toEqual({
      status: "failed",
      errorCode: "unavailable",
    });
    expect(await invoke(request(), new AbortController().signal)).toEqual({
      status: "succeeded",
      value: { different: "field" },
    });
  });

  it.each([
    () => new Response("not json", { headers: { "content-type": "application/json" } }),
    () => new Response('{"userId":"x"}'),
    () =>
      new Response("{}", {
        headers: { "content-type": "application/json", "content-length": "65537" },
      }),
    () =>
      new Response("{}", {
        headers: { "content-type": "application/json", "content-length": "1e3" },
      }),
    () =>
      new Response("{}", {
        headers: { "content-type": "application/json", "content-encoding": "gzip" },
      }),
    () =>
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          ...Object.fromEntries(Array.from({ length: 65 }, (_, index) => [`x-${index}`, "a"])),
        },
      }),
    () =>
      new Response("{}", {
        headers: { "content-type": "application/json", "x-large": "x".repeat(16_385) },
      }),
    () =>
      new Response(new Uint8Array([0xff, 0xff]), {
        headers: { "content-type": "application/json" },
      }),
    () => new Response("1e999", { headers: { "content-type": "application/json" } }),
    () => Object.defineProperty(successResponse(), "redirected", { value: true }),
    () =>
      Object.defineProperty(successResponse(), "url", {
        value: "https://foreign.example/api/sign-in",
      }),
  ])(
    "contains invalid responses without exposing payloads or guessing success",
    async (response) => {
      const invoke = createDesenAppLocalSignInOperation(config(), async () => response());
      expect(await invoke(request(), new AbortController().signal)).toEqual({
        status: "failed",
        errorCode: "unavailable",
      });
    },
  );

  it.each(["bytes", "chunks"])(
    "cancels a response that exceeds its streaming %s bound",
    async (kind) => {
      const cancel = vi.fn();
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array(kind === "bytes" ? 65_537 : 0));
        },
        cancel,
      });
      const invoke = createDesenAppLocalSignInOperation(
        config(),
        async () => new Response(stream, { headers: { "content-type": "application/json" } }),
      );
      expect(await invoke(request(), new AbortController().signal)).toEqual({
        status: "failed",
        errorCode: "unavailable",
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it("denies pre-aborted calls without reading inputs or starting fetch", async () => {
    const abort = new AbortController();
    abort.abort();
    const fetchLike = vi.fn(async () => successResponse());
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    expect(await invoke(request(), abort.signal)).toEqual({ status: "denied" });
    expect(fetchLike).not.toHaveBeenCalled();
  });

  it("revokes a noncooperative fetch and cancels its late successful response", async () => {
    let complete: (response: Response) => void = () => undefined;
    let transportSignal: AbortSignal | undefined;
    const fetchLike: DesenAppLocalOperationFetch = async (_input, init) => {
      transportSignal = init.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        complete = resolve;
      });
    };
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({ cancel }), {
      headers: { "content-type": "application/json" },
    });
    const abort = new AbortController();
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    const pending = invoke(request(), abort.signal);
    abort.abort();
    expect(await pending).toEqual({ status: "denied" });
    expect(transportSignal?.aborted).toBe(true);
    complete(response);
    await Promise.resolve();
    await Promise.resolve();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending body read when the exact Integration session is revoked", async () => {
    let signalRead: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      signalRead = resolve;
    });
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream<Uint8Array>(
        {
          pull() {
            signalRead();
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
      { headers: { "content-type": "application/json" } },
    );
    const abort = new AbortController();
    const invoke = createDesenAppLocalSignInOperation(config(), async () => response);
    const pending = invoke(request(), abort.signal);
    await reading;
    abort.abort();
    expect(await pending).toEqual({ status: "denied" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("bounds even a noncooperative fetch by one fixed timeout with no retry", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchLike = vi.fn(async (_input: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });
    const invoke = createDesenAppLocalSignInOperation(config(), fetchLike);
    const pending = invoke(request(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toEqual({ status: "failed", errorCode: "unavailable" });
    expect(signal?.aborted).toBe(true);
    expect(fetchLike).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("redacts thrown transport values rather than retaining causes or messages", async () => {
    const invoke = createDesenAppLocalSignInOperation(config(), async () => {
      throw new Error(`${TOKEN} local-demo-pass private transport detail`);
    });
    expect(await invoke(request(), new AbortController().signal)).toEqual({
      status: "failed",
      errorCode: "unavailable",
    });
  });
});
