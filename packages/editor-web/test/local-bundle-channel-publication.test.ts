import { describe, expect, it } from "vitest";

import {
  createLocalDesenBundleChannelPublicationPort,
  LocalDesenBundleChannelPublicationConfigurationError,
} from "../src/index.js";

import type {
  LocalDesenBundleChannelPublicationFetch,
  LocalDesenBundleChannelPublicationFetchRequest,
  LocalDesenBundleChannelPublicationFetchResponse,
} from "../src/index.js";

const ORIGIN = "http://127.0.0.1:43127";
const API_TOKEN = "test-only-local-publication-token-000001";
const CHANNEL_NAME = "preview";
const REVISION_A = `sha256:${"a".repeat(64)}`;
const REVISION_B = `sha256:${"b".repeat(64)}`;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

const BUNDLE_BYTES = bytes({
  kind: "desen.bundle",
  protocolVersion: "0.1.0",
  revision: REVISION_A,
});

function response(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): LocalDesenBundleChannelPublicationFetchResponse {
  return {
    status,
    headers: { "content-type": "application/json", ...headers },
    body: body instanceof Uint8Array ? body : bytes(body),
  };
}

function errorResponse(
  status: number,
  code: string,
  headers: Readonly<Record<string, string>> = {},
): LocalDesenBundleChannelPublicationFetchResponse {
  return response(status, { error: { code, message: "redacted" } }, headers);
}

function missingChannel(): LocalDesenBundleChannelPublicationFetchResponse {
  return errorResponse(404, "CHANNEL_NOT_FOUND");
}

function foundChannel(
  revision: string,
  generation: number,
): LocalDesenBundleChannelPublicationFetchResponse {
  return response(
    200,
    { channelName: CHANNEL_NAME, generation, revision },
    { etag: `"g:${String(generation)}"` },
  );
}

function bundleStored(revision = REVISION_A): LocalDesenBundleChannelPublicationFetchResponse {
  return response(201, { revision, status: "stored" }, { etag: `"${revision}"` });
}

function bundleUnchanged(revision = REVISION_A): LocalDesenBundleChannelPublicationFetchResponse {
  return response(200, { revision, status: "unchanged" }, { etag: `"${revision}"` });
}

function channelCreated(revision = REVISION_A): LocalDesenBundleChannelPublicationFetchResponse {
  return response(
    201,
    { channelName: CHANNEL_NAME, generation: 1, revision, status: "created" },
    { etag: '"g:1"' },
  );
}

function channelUpdated(
  revision: string,
  generation: number,
): LocalDesenBundleChannelPublicationFetchResponse {
  return response(
    200,
    { channelName: CHANNEL_NAME, generation, revision, status: "updated" },
    { etag: `"g:${String(generation)}"` },
  );
}

function channelUnchanged(
  revision: string,
  generation: number,
): LocalDesenBundleChannelPublicationFetchResponse {
  return response(
    200,
    { channelName: CHANNEL_NAME, generation, revision, status: "unchanged" },
    { etag: `"g:${String(generation)}"` },
  );
}

function queueTransport(
  responses: readonly (
    | LocalDesenBundleChannelPublicationFetchResponse
    | Error
    | ((
        request: LocalDesenBundleChannelPublicationFetchRequest,
      ) => LocalDesenBundleChannelPublicationFetchResponse)
  )[],
): {
  readonly calls: LocalDesenBundleChannelPublicationFetchRequest[];
  readonly fetch: LocalDesenBundleChannelPublicationFetch;
} {
  const queue = [...responses];
  const calls: LocalDesenBundleChannelPublicationFetchRequest[] = [];
  const fetch: LocalDesenBundleChannelPublicationFetch = async (request) => {
    calls.push(request);
    const next = queue.shift();
    if (next === undefined) throw new Error("No queued response.");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(request) : next;
  };
  return { calls, fetch };
}

function portFor(fetch: LocalDesenBundleChannelPublicationFetch) {
  return createLocalDesenBundleChannelPublicationPort({
    origin: ORIGIN,
    apiToken: API_TOKEN,
    channelName: CHANNEL_NAME,
    fetch,
  });
}

function publishRequest(revision = REVISION_A, bundleBytes: Readonly<Uint8Array> = BUNDLE_BYTES) {
  return { revision, bundleBytes };
}

describe("createLocalDesenBundleChannelPublicationPort", () => {
  it("publishes to a missing fixed channel in the exact GET, Bundle PUT, channel CAS order", async () => {
    const transport = queueTransport([missingChannel(), bundleStored(), channelCreated()]);

    await expect(
      portFor(transport.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "published",
      channelName: CHANNEL_NAME,
      revision: REVISION_A,
      bundleStatus: "stored",
      channelStatus: "created",
      channelGeneration: 1,
    });

    expect(transport.calls).toHaveLength(3);
    expect(transport.calls[0]).toEqual({
      method: "GET",
      url: `${ORIGIN}/v1/channels/${CHANNEL_NAME}`,
      headers: { authorization: `Bearer ${API_TOKEN}` },
      redirect: "error",
    });
    expect(transport.calls[1]).toEqual({
      method: "PUT",
      url: `${ORIGIN}/v1/bundles/${REVISION_A}`,
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
      },
      body: BUNDLE_BYTES,
      redirect: "error",
    });
    expect(transport.calls[2]).toEqual({
      method: "PUT",
      url: `${ORIGIN}/v1/channels/${CHANNEL_NAME}`,
      headers: {
        authorization: `Bearer ${API_TOKEN}`,
        "content-type": "application/json",
        "if-none-match": "*",
      },
      body: bytes({ revision: REVISION_A }),
      redirect: "error",
    });
    expect(transport.calls.every(({ redirect }) => redirect === "error")).toBe(true);
  });

  it("updates and preserves existing channel generations with exact If-Match CAS", async () => {
    const transport = queueTransport([
      foundChannel(REVISION_B, 7),
      bundleUnchanged(),
      channelUpdated(REVISION_A, 8),
      foundChannel(REVISION_A, 8),
      bundleUnchanged(),
      channelUnchanged(REVISION_A, 8),
    ]);
    const port = portFor(transport.fetch);

    await expect(port.publishBundleToChannel(publishRequest())).resolves.toEqual({
      status: "published",
      channelName: CHANNEL_NAME,
      revision: REVISION_A,
      bundleStatus: "unchanged",
      channelStatus: "updated",
      channelGeneration: 8,
    });
    await expect(port.publishBundleToChannel(publishRequest())).resolves.toEqual({
      status: "published",
      channelName: CHANNEL_NAME,
      revision: REVISION_A,
      bundleStatus: "unchanged",
      channelStatus: "unchanged",
      channelGeneration: 8,
    });

    expect(transport.calls[2]?.headers["if-match"]).toBe('"g:7"');
    expect(transport.calls[5]?.headers["if-match"]).toBe('"g:8"');
    expect(transport.calls).toHaveLength(6);
  });

  it("returns the exact channel conflict without retrying or overwriting a concurrent winner", async () => {
    const transport = queueTransport([
      foundChannel(REVISION_B, 4),
      bundleStored(),
      errorResponse(412, "GENERATION_MISMATCH", { etag: '"g:5"' }),
    ]);

    await expect(
      portFor(transport.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "conflict",
      revision: REVISION_A,
      bundleStatus: "stored",
      currentGeneration: 5,
    });
    expect(transport.calls).toHaveLength(3);
    expect(transport.calls[2]?.headers["if-match"]).toBe('"g:4"');
  });

  it("distinguishes pre-mutation read failures from Bundle and channel commit ambiguity", async () => {
    const readTransport = queueTransport([new Error("read secret")]);
    await expect(
      portFor(readTransport.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-read",
      reason: "storage-unavailable",
    });
    expect(readTransport.calls).toHaveLength(1);

    const bundleTransport = queueTransport([
      missingChannel(),
      new Error("response lost after Bundle PUT"),
    ]);
    await expect(
      portFor(bundleTransport.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "bundle-write",
      revision: REVISION_A,
    });
    expect(bundleTransport.calls).toHaveLength(2);

    const channelTransport = queueTransport([
      missingChannel(),
      bundleUnchanged(),
      new Error("response lost after channel PUT"),
    ]);
    await expect(
      portFor(channelTransport.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "channel-write",
      revision: REVISION_A,
      bundleStatus: "unchanged",
    });
    expect(channelTransport.calls).toHaveLength(3);
  });

  it("keeps malformed or mismatched post-PUT responses indeterminate", async () => {
    const malformedBundle = queueTransport([
      missingChannel(),
      response(201, { revision: REVISION_B, status: "stored" }, { etag: `"${REVISION_B}"` }),
    ]);
    await expect(
      portFor(malformedBundle.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "bundle-write",
      revision: REVISION_A,
    });

    const malformedChannel = queueTransport([
      foundChannel(REVISION_B, 3),
      bundleStored(),
      channelUpdated(REVISION_A, 9),
    ]);
    await expect(
      portFor(malformedChannel.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "indeterminate",
      phase: "channel-write",
      revision: REVISION_A,
      bundleStatus: "stored",
    });
  });

  it("retains definite Bundle and channel failures without issuing unsafe retries", async () => {
    const bundleConflict = queueTransport([
      missingChannel(),
      errorResponse(409, "BUNDLE_BYTES_CONFLICT"),
    ]);
    await expect(
      portFor(bundleConflict.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "bundle-write",
      reason: "bundle-bytes-conflict",
    });
    expect(bundleConflict.calls).toHaveLength(2);

    const bundleMissing = queueTransport([
      foundChannel(REVISION_B, 5),
      bundleUnchanged(),
      errorResponse(409, "BUNDLE_NOT_FOUND"),
    ]);
    await expect(
      portFor(bundleMissing.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-write",
      reason: "bundle-missing",
      revision: REVISION_A,
      bundleStatus: "unchanged",
    });
    expect(bundleMissing.calls).toHaveLength(3);

    const maximum = Number.MAX_SAFE_INTEGER;
    const exhausted = queueTransport([
      foundChannel(REVISION_B, maximum),
      bundleStored(),
      errorResponse(409, "GENERATION_EXHAUSTED", {
        etag: `"g:${String(maximum)}"`,
      }),
    ]);
    await expect(
      portFor(exhausted.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-write",
      reason: "generation-exhausted",
      revision: REVISION_A,
      bundleStatus: "stored",
    });
    expect(exhausted.calls).toHaveLength(3);
  });

  it("maps authenticated and busy failures to closed redacted reasons", async () => {
    const unauthorized = queueTransport([errorResponse(401, "AUTHENTICATION_REQUIRED")]);
    await expect(
      portFor(unauthorized.fetch).publishBundleToChannel(publishRequest()),
    ).resolves.toEqual({
      status: "failed",
      phase: "channel-read",
      reason: "authentication-required",
    });

    const busy = queueTransport([
      foundChannel(REVISION_B, 2),
      bundleStored(),
      errorResponse(503, "METADATA_BUSY"),
    ]);
    await expect(portFor(busy.fetch).publishBundleToChannel(publishRequest())).resolves.toEqual({
      status: "failed",
      phase: "channel-write",
      reason: "storage-busy",
      revision: REVISION_A,
      bundleStatus: "stored",
    });
  });

  it("rejects invalid publication requests before transport and snapshots admitted bytes", async () => {
    const unused = queueTransport([]);
    const port = portFor(unused.fetch);
    for (const request of [
      { revision: "sha256:ABC", bundleBytes: BUNDLE_BYTES },
      { revision: REVISION_A, bundleBytes: new Uint8Array() },
      { revision: REVISION_A, bundleBytes: BUNDLE_BYTES, channelName: "attacker" },
      Object.defineProperty({ revision: REVISION_A }, "bundleBytes", {
        enumerable: true,
        get() {
          throw new Error("must not execute");
        },
      }),
    ]) {
      await expect(port.publishBundleToChannel(request as never)).resolves.toEqual({
        status: "failed",
        phase: "request",
        reason: "bundle-invalid",
      });
    }
    expect(unused.calls).toHaveLength(0);

    const admittedBytes = new Uint8Array(BUNDLE_BYTES);
    const transport = queueTransport([
      () => {
        admittedBytes.fill(0);
        return missingChannel();
      },
      (request) => {
        expect(decoder.decode(request.body)).toBe(decoder.decode(BUNDLE_BYTES));
        return bundleStored();
      },
      channelCreated(),
    ]);
    await expect(
      portFor(transport.fetch).publishBundleToChannel(publishRequest(REVISION_A, admittedBytes)),
    ).resolves.toMatchObject({ status: "published" });
  });

  it("rejects non-loopback, active, weak, dynamic-channel, and implicit-fetch configuration", () => {
    const fetch = queueTransport([]).fetch;
    let accessorExecuted = false;
    const accessor = Object.defineProperty(
      { origin: ORIGIN, apiToken: API_TOKEN, channelName: CHANNEL_NAME },
      "fetch",
      {
        enumerable: true,
        get() {
          accessorExecuted = true;
          throw new Error("must not escape");
        },
      },
    );
    const invalid = [
      { origin: "https://127.0.0.1:43127", apiToken: API_TOKEN, channelName: CHANNEL_NAME, fetch },
      { origin: "http://localhost:43127", apiToken: API_TOKEN, channelName: CHANNEL_NAME, fetch },
      { origin: ORIGIN, apiToken: "short", channelName: CHANNEL_NAME, fetch },
      { origin: ORIGIN, apiToken: API_TOKEN, channelName: "Preview", fetch },
      { origin: ORIGIN, apiToken: API_TOKEN, channelName: CHANNEL_NAME, fetch: undefined },
      { origin: ORIGIN, apiToken: API_TOKEN, channelName: CHANNEL_NAME, fetch, extra: true },
      accessor,
    ];

    for (const options of invalid) {
      expect(() => createLocalDesenBundleChannelPublicationPort(options as never)).toThrow(
        LocalDesenBundleChannelPublicationConfigurationError,
      );
    }
    expect(accessorExecuted).toBe(false);
  });

  it("accepts the explicit default loopback port and never selects a channel per request", async () => {
    const transport = queueTransport([missingChannel(), bundleStored(), channelCreated()]);
    const port = createLocalDesenBundleChannelPublicationPort({
      origin: "http://127.0.0.1:80",
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
      fetch: transport.fetch,
    });

    await expect(port.publishBundleToChannel(publishRequest())).resolves.toMatchObject({
      status: "published",
    });
    expect(transport.calls[0]?.url).toBe(`http://127.0.0.1:80/v1/channels/${CHANNEL_NAME}`);
    expect(transport.calls[2]?.url).toBe(`http://127.0.0.1:80/v1/channels/${CHANNEL_NAME}`);
  });
});
