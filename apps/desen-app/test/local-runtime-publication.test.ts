import { afterEach, describe, expect, it, vi } from "vitest";

import { readAuthoringPublicationPortDestination } from "../src/authoring-publication.js";
import {
  DESEN_APP_LOCAL_PUBLICATION_PROFILE,
  DesenAppLocalPublicationConfigurationError,
  captureDesenAppLocalPublicationConfig,
  createDesenAppLocalPublicationPort,
  createInjectedDesenAppLocalPublicationPort,
  readInjectedDesenAppLocalPublicationConfig,
} from "../src/local-runtime-publication.js";

import type {
  AuthoringControlPlanePublicationRequest,
  AuthoringHostActivationRequest,
} from "../src/authoring-publication.js";
import type { DesenAppLocalPublicationBrowserFetch } from "../src/local-runtime-publication.js";

const CONTROL_PLANE_ORIGIN = "http://127.0.0.1:43127";
const ACTIVATION_ORIGIN = "http://127.0.0.1:43129";
const CONTROL_PLANE_TOKEN = "control-plane-publication-token-000001";
const ACTIVATION_TOKEN = "host-activation-publication-token-0002";
const CHANNEL_NAME = "preview";
const HOST_ID = "reference-host-web";
const REVISION = `sha256:${"a".repeat(64)}`;
const OTHER_REVISION = `sha256:${"b".repeat(64)}`;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const BUNDLE_BYTES = encoder.encode(
  JSON.stringify({
    kind: "desen.bundle",
    protocolVersion: "0.1.0",
    revision: REVISION,
  }),
);

function publicationConfig() {
  return {
    profile: DESEN_APP_LOCAL_PUBLICATION_PROFILE,
    controlPlane: {
      origin: CONTROL_PLANE_ORIGIN,
      apiToken: CONTROL_PLANE_TOKEN,
    },
    activation: {
      origin: ACTIVATION_ORIGIN,
      apiToken: ACTIVATION_TOKEN,
    },
    destination: {
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
    },
  };
}

function jsonResponse(
  status: number,
  value: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function missingChannelResponse(): Response {
  return jsonResponse(404, {
    error: {
      code: "CHANNEL_NOT_FOUND",
      message: "The requested channel was not found.",
    },
  });
}

function storedBundleResponse(): Response {
  return jsonResponse(201, { revision: REVISION, status: "stored" }, { etag: `"${REVISION}"` });
}

function createdChannelResponse(): Response {
  return jsonResponse(
    201,
    {
      channelName: CHANNEL_NAME,
      generation: 1,
      revision: REVISION,
      status: "created",
    },
    { etag: '"g:1"' },
  );
}

function activeResponse(revision = REVISION): Response {
  return jsonResponse(
    200,
    {
      status: "active",
      relationship: "activated",
      activeRevision: revision,
      activationGeneration: 3,
    },
    { "content-type": "application/json; charset=utf-8" },
  );
}

function publicationRequest(
  bundleBytes: Readonly<Uint8Array> = BUNDLE_BYTES,
): AuthoringControlPlanePublicationRequest {
  return {
    bundleBytes,
    channelName: CHANNEL_NAME,
    revision: REVISION,
  };
}

function activationRequest(): AuthoringHostActivationRequest {
  return {
    channelName: CHANNEL_NAME,
    channelGeneration: 1,
    hostId: HOST_ID,
    revision: REVISION,
  };
}

interface BrowserCall {
  readonly input: string;
  readonly init: RequestInit;
}

function queueBrowserFetch(responses: readonly (Response | Error)[]): {
  readonly calls: BrowserCall[];
  readonly fetch: DesenAppLocalPublicationBrowserFetch;
} {
  const queue = [...responses];
  const calls: BrowserCall[] = [];
  const fetch: DesenAppLocalPublicationBrowserFetch = vi.fn(async (input, init) => {
    calls.push(Object.freeze({ input, init }));
    const response = queue.shift();
    if (response === undefined) throw new Error("No queued local-publication response.");
    if (response instanceof Error) throw response;
    return response;
  });
  return { calls, fetch };
}

function expectInvalidConfig(value: unknown): void {
  expect(() => captureDesenAppLocalPublicationConfig(value)).toThrowError(
    DesenAppLocalPublicationConfigurationError,
  );
  try {
    captureDesenAppLocalPublicationConfig(value);
  } catch (error) {
    expect(error).toBeInstanceOf(DesenAppLocalPublicationConfigurationError);
    expect(error).toMatchObject({ code: "INVALID_CONFIG" });
    expect(String(error)).not.toContain(CONTROL_PLANE_TOKEN);
    expect(String(error)).not.toContain(ACTIVATION_TOKEN);
    expect(String(error)).not.toContain("foreign.example");
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Desen App local publication composition", () => {
  it("captures only the exact profile as a detached recursively frozen configuration", () => {
    const raw = publicationConfig();
    const captured = captureDesenAppLocalPublicationConfig(raw);

    raw.controlPlane.origin = "http://127.0.0.1:44001";
    raw.controlPlane.apiToken = "changed-control-plane-token-000001";
    raw.activation.origin = "http://127.0.0.1:44002";
    raw.activation.apiToken = "changed-host-activation-token-000002";
    raw.destination.channelName = "changed";
    raw.destination.hostId = "changed-host";

    expect(captured).toEqual(publicationConfig());
    expect(Reflect.ownKeys(captured).sort()).toEqual([
      "activation",
      "controlPlane",
      "destination",
      "profile",
    ]);
    expect(Reflect.ownKeys(captured.controlPlane).sort()).toEqual(["apiToken", "origin"]);
    expect(Reflect.ownKeys(captured.activation).sort()).toEqual(["apiToken", "origin"]);
    expect(Reflect.ownKeys(captured.destination).sort()).toEqual(["channelName", "hostId"]);
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.controlPlane)).toBe(true);
    expect(Object.isFrozen(captured.activation)).toBe(true);
    expect(Object.isFrozen(captured.destination)).toBe(true);
  });

  it.each([
    null,
    {},
    { ...publicationConfig(), extra: true },
    { ...publicationConfig(), profile: "desen.app.local-publication.v2" },
    {
      ...publicationConfig(),
      controlPlane: {
        ...publicationConfig().controlPlane,
        origin: "https://127.0.0.1:43127",
      },
    },
    {
      ...publicationConfig(),
      controlPlane: {
        ...publicationConfig().controlPlane,
        origin: "http://foreign.example:43127",
      },
    },
    {
      ...publicationConfig(),
      activation: {
        ...publicationConfig().activation,
        origin: CONTROL_PLANE_ORIGIN,
      },
    },
    {
      ...publicationConfig(),
      activation: {
        ...publicationConfig().activation,
        apiToken: CONTROL_PLANE_TOKEN,
      },
    },
    {
      ...publicationConfig(),
      controlPlane: { ...publicationConfig().controlPlane, extra: true },
    },
    {
      ...publicationConfig(),
      destination: { ...publicationConfig().destination, channelName: "Preview" },
    },
    {
      ...publicationConfig(),
      destination: { ...publicationConfig().destination, channelName: "p".repeat(65) },
    },
    {
      ...publicationConfig(),
      destination: { ...publicationConfig().destination, hostId: "reference_host_web" },
    },
    {
      ...publicationConfig(),
      activation: { ...publicationConfig().activation, apiToken: "short" },
    },
  ])(
    "rejects malformed, widened, remote, shared-authority, or invalid-destination config",
    (raw) => {
      expectInvalidConfig(raw);
    },
  );

  it("rejects accessor-backed configuration without evaluating the accessor", () => {
    const getter = vi.fn(() => publicationConfig().activation);
    const raw = Object.defineProperty(
      {
        profile: DESEN_APP_LOCAL_PUBLICATION_PROFILE,
        controlPlane: publicationConfig().controlPlane,
        destination: publicationConfig().destination,
      },
      "activation",
      { enumerable: true, get: getter },
    );

    expectInvalidConfig(raw);
    expect(getter).not.toHaveBeenCalled();
  });

  it("publishes and activates through the exact secured four-request browser sequence", async () => {
    const transport = queueBrowserFetch([
      missingChannelResponse(),
      storedBundleResponse(),
      createdChannelResponse(),
      activeResponse(),
    ]);
    const port = createDesenAppLocalPublicationPort(publicationConfig(), transport.fetch);

    expect(Object.isFrozen(port)).toBe(true);
    expect(readAuthoringPublicationPortDestination(port)).toEqual({
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
    });
    await expect(port.publishBundleToChannel(publicationRequest())).resolves.toEqual({
      status: "published",
      channelName: CHANNEL_NAME,
      revision: REVISION,
      bundleStatus: "stored",
      channelStatus: "created",
      channelGeneration: 1,
    });
    await expect(port.activatePublishedRevision(activationRequest())).resolves.toEqual({
      status: "active",
      relationship: "activated",
      activeRevision: REVISION,
      activationGeneration: 3,
    });

    expect(transport.calls).toHaveLength(4);
    expect(transport.calls.map(({ input }) => input)).toEqual([
      `${CONTROL_PLANE_ORIGIN}/v1/channels/${CHANNEL_NAME}`,
      `${CONTROL_PLANE_ORIGIN}/v1/bundles/${REVISION}`,
      `${CONTROL_PLANE_ORIGIN}/v1/channels/${CHANNEL_NAME}`,
      `${ACTIVATION_ORIGIN}/v1/activate-published-revision`,
    ]);
    expect(transport.calls.map(({ init }) => init.method)).toEqual(["GET", "PUT", "PUT", "POST"]);
    expect(transport.calls.map(({ init }) => Reflect.ownKeys(init).sort())).toEqual([
      ["cache", "credentials", "headers", "method", "mode", "redirect", "referrerPolicy", "signal"],
      [
        "body",
        "cache",
        "credentials",
        "headers",
        "method",
        "mode",
        "redirect",
        "referrerPolicy",
        "signal",
      ],
      [
        "body",
        "cache",
        "credentials",
        "headers",
        "method",
        "mode",
        "redirect",
        "referrerPolicy",
        "signal",
      ],
      [
        "body",
        "cache",
        "credentials",
        "headers",
        "method",
        "mode",
        "redirect",
        "referrerPolicy",
        "signal",
      ],
    ]);
    for (const { init } of transport.calls) {
      expect(init).toMatchObject({
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        referrerPolicy: "no-referrer",
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
    expect(transport.calls[0]?.init.headers).toEqual({
      authorization: `Bearer ${CONTROL_PLANE_TOKEN}`,
    });
    expect(transport.calls[1]?.init.headers).toEqual({
      authorization: `Bearer ${CONTROL_PLANE_TOKEN}`,
      "content-type": "application/json",
    });
    expect(transport.calls[1]?.init.body).toBeInstanceOf(Uint8Array);
    expect(Array.from(transport.calls[1]?.init.body as Uint8Array)).toEqual(
      Array.from(BUNDLE_BYTES),
    );
    expect(transport.calls[2]?.init.headers).toEqual({
      authorization: `Bearer ${CONTROL_PLANE_TOKEN}`,
      "content-type": "application/json",
      "if-none-match": "*",
    });
    expect(JSON.parse(decoder.decode(transport.calls[2]?.init.body as Uint8Array))).toEqual({
      revision: REVISION,
    });
    expect(transport.calls[3]?.init.headers).toEqual({
      authorization: `Bearer ${ACTIVATION_TOKEN}`,
      "content-type": "application/json",
    });
    expect(JSON.parse(transport.calls[3]?.init.body as string)).toEqual(activationRequest());
  });

  it("rejects per-request destination substitution before either transport is invoked", async () => {
    const transport = queueBrowserFetch([]);
    const port = createDesenAppLocalPublicationPort(publicationConfig(), transport.fetch);

    await expect(
      port.publishBundleToChannel({ ...publicationRequest(), channelName: "another-channel" }),
    ).resolves.toEqual({
      status: "failed",
      phase: "request",
      reason: "channel-invalid",
    });
    await expect(
      port.activatePublishedRevision({ ...activationRequest(), hostId: "another-host" }),
    ).resolves.toEqual({ status: "failed" });
    expect(transport.calls).toHaveLength(0);
  });

  it("treats an active response for another revision as indeterminate", async () => {
    const transport = queueBrowserFetch([activeResponse(OTHER_REVISION)]);
    const port = createDesenAppLocalPublicationPort(publicationConfig(), transport.fetch);

    await expect(port.activatePublishedRevision(activationRequest())).resolves.toEqual({
      status: "indeterminate",
    });
    expect(transport.calls).toHaveLength(1);
  });

  it("maps network loss according to whether an effect may already have committed", async () => {
    const readLoss = queueBrowserFetch([new Error("private channel read failure")]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        readLoss.fetch,
      ).publishBundleToChannel(publicationRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-read",
      reason: "storage-unavailable",
    });

    const bundleLoss = queueBrowserFetch([
      missingChannelResponse(),
      new Error("private Bundle response loss"),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        bundleLoss.fetch,
      ).publishBundleToChannel(publicationRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "bundle-write",
      revision: REVISION,
    });

    const channelLoss = queueBrowserFetch([
      missingChannelResponse(),
      storedBundleResponse(),
      new Error("private channel response loss"),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        channelLoss.fetch,
      ).publishBundleToChannel(publicationRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "channel-write",
      revision: REVISION,
      bundleStatus: "stored",
    });

    const activationLoss = queueBrowserFetch([new Error("private activation response loss")]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        activationLoss.fetch,
      ).activatePublishedRevision(activationRequest()),
    ).resolves.toEqual({ status: "indeterminate" });
  });

  it("contains oversized and malformed channel or activation responses", async () => {
    const oversizedChannel = queueBrowserFetch([
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": "65537",
        },
      }),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        oversizedChannel.fetch,
      ).publishBundleToChannel(publicationRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-read",
      reason: "storage-unavailable",
    });

    const malformedChannel = queueBrowserFetch([
      jsonResponse(200, { channelName: CHANNEL_NAME, generation: "one", revision: REVISION }),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        malformedChannel.fetch,
      ).publishBundleToChannel(publicationRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-read",
      reason: "channel-invalid",
    });

    for (const response of [
      new Response("{}", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": "8193",
        },
      }),
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "3" },
      }),
      new Response(null, {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "1" },
      }),
    ]) {
      const transport = queueBrowserFetch([response]);
      await expect(
        createDesenAppLocalPublicationPort(
          publicationConfig(),
          transport.fetch,
        ).activatePublishedRevision(activationRequest()),
      ).resolves.toEqual({ status: "indeterminate" });
    }

    const wrongMediaType = queueBrowserFetch([
      new Response(JSON.stringify({ status: "active" }), {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        wrongMediaType.fetch,
      ).activatePublishedRevision(activationRequest()),
    ).resolves.toEqual({ status: "failed" });
  });

  it("bounds response fragmentation and settles even when an injected fetch ignores abort", async () => {
    const fragmented = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 1_025; index += 1) {
          controller.enqueue(new Uint8Array([0x20]));
        }
        controller.close();
      },
    });
    const fragmentedTransport = queueBrowserFetch([
      new Response(fragmented, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ]);
    await expect(
      createDesenAppLocalPublicationPort(
        publicationConfig(),
        fragmentedTransport.fetch,
      ).activatePublishedRevision(activationRequest()),
    ).resolves.toEqual({ status: "indeterminate" });

    vi.useFakeTimers();
    const observed: { signal?: AbortSignal } = {};
    const ignoringFetch: DesenAppLocalPublicationBrowserFetch = vi.fn((_input, init) => {
      if (init.signal !== null && init.signal !== undefined) observed.signal = init.signal;
      return new Promise<Response>(() => undefined);
    });
    const pending = createDesenAppLocalPublicationPort(
      publicationConfig(),
      ignoringFetch,
    ).activatePublishedRevision(activationRequest());
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(pending).resolves.toEqual({ status: "indeterminate" });
    expect(observed.signal?.aborted).toBe(true);

    const bodyObserved: { signal?: AbortSignal } = {};
    const hangingBodyFetch: DesenAppLocalPublicationBrowserFetch = vi.fn(async (_input, init) => {
      if (init.signal !== null && init.signal !== undefined) bodyObserved.signal = init.signal;
      return new Response(
        new ReadableStream<Uint8Array>({
          pull: () => new Promise<void>(() => undefined),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const pendingBody = createDesenAppLocalPublicationPort(
      publicationConfig(),
      hangingBodyFetch,
    ).activatePublishedRevision(activationRequest());
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(pendingBody).resolves.toEqual({ status: "indeterminate" });
    expect(bodyObserved.signal?.aborted).toBe(true);
  });

  it("requires an explicit fetch and never falls back to ambient or absent injected authority", () => {
    expect(readInjectedDesenAppLocalPublicationConfig()).toBeNull();
    expect(createInjectedDesenAppLocalPublicationPort(undefined)).toBeNull();
    expect(() => createDesenAppLocalPublicationPort(publicationConfig(), undefined)).toThrowError(
      new DesenAppLocalPublicationConfigurationError("INVALID_FETCH"),
    );

    const ambientFetch = vi.fn();
    vi.stubGlobal("fetch", ambientFetch);
    vi.stubGlobal("__DESEN_APP_LOCAL_PUBLICATION_CONFIG__", publicationConfig());
    expect(readInjectedDesenAppLocalPublicationConfig()).toEqual(publicationConfig());
    expect(() => createInjectedDesenAppLocalPublicationPort(undefined)).toThrowError(
      new DesenAppLocalPublicationConfigurationError("INVALID_FETCH"),
    );
    expect(ambientFetch).not.toHaveBeenCalled();
  });
});
