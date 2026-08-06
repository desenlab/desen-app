import { connect } from "node:net";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  LOCAL_CONTROL_PLANE_LIMITS,
} from "../src/local-control-plane-contract.js";
import { createLocalControlPlaneApplication } from "../src/local-control-plane-internal.js";
import {
  createInMemoryChannelRepository,
  createInMemorySourceRepository,
} from "../src/local-control-plane-repository-internal.js";

import type { BundleStore, BundleStoreEntry } from "../src/bundle-store-contract.js";
import type {
  LocalControlPlane,
  LocalControlPlaneError,
  LocalControlPlaneInjectRequest,
  LocalControlPlaneInjectResponse,
} from "../src/local-control-plane-contract.js";

const API_TOKEN = "m07-t05-local-api-token-32-bytes";
const ALLOWED_ORIGIN = "https://desen.app";
const REVISION_A = `sha256:${"a".repeat(64)}`;
const REVISION_B = `sha256:${"b".repeat(64)}`;
const OFFICIAL_SOURCE_PATH = resolve(
  import.meta.dirname,
  "../../../packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json",
);
const textDecoder = new TextDecoder();

let officialSourceBytes: Uint8Array;
let variantSourceBytes: Uint8Array;
let opened: LocalControlPlane[] = [];

function json(value: LocalControlPlaneInjectResponse): Record<string, unknown> {
  const decoded = JSON.parse(textDecoder.decode(value.body)) as unknown;
  if (decoded === null || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new TypeError("Expected one JSON object response.");
  }
  return decoded as Record<string, unknown>;
}

function errorCode(response: LocalControlPlaneInjectResponse): string {
  const envelope = json(response);
  const error = envelope.error;
  if (error === null || typeof error !== "object" || Array.isArray(error)) {
    throw new TypeError("Expected one controlled error envelope.");
  }
  const code = (error as Record<string, unknown>).code;
  if (typeof code !== "string") throw new TypeError("Expected one controlled error code.");
  return code;
}

function createMemoryBundleStore(initialEntries: readonly BundleStoreEntry[] = []): BundleStore {
  const entries = new Map<string, Uint8Array>(
    initialEntries.map((entry) => [entry.revision, new Uint8Array(entry.bytes)]),
  );
  return Object.freeze({
    getBundle: async (revision: string) => {
      const bytes = entries.get(revision);
      return bytes === undefined
        ? Object.freeze({ status: "missing" as const })
        : Object.freeze({
            status: "found" as const,
            entry: Object.freeze({ revision, bytes: new Uint8Array(bytes) }),
          });
    },
    putBundle: async (entry: BundleStoreEntry) => {
      const current = entries.get(entry.revision);
      if (current === undefined) {
        entries.set(entry.revision, new Uint8Array(entry.bytes));
        return Object.freeze({ status: "stored" as const });
      }
      return Buffer.from(current).equals(Buffer.from(entry.bytes))
        ? Object.freeze({ status: "unchanged" as const })
        : Object.freeze({ status: "conflict" as const });
    },
  });
}

function createApi(bundleStore: BundleStore = createMemoryBundleStore()): LocalControlPlane {
  const api = createLocalControlPlaneApplication({
    apiToken: API_TOKEN,
    allowedOrigins: [ALLOWED_ORIGIN],
    bundleStore,
    channelRepository: createInMemoryChannelRepository(),
    sourceRepository: createInMemorySourceRepository(),
    closeMetadata: () => undefined,
  });
  opened.push(api);
  return api;
}

function deferred(): Readonly<{ readonly promise: Promise<void>; readonly resolve: () => void }> {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolveDeferred) => {
    resolvePromise = resolveDeferred;
  });
  if (resolvePromise === undefined) throw new TypeError("Deferred resolver was not initialized.");
  return Object.freeze({ promise, resolve: resolvePromise });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });
}

function request(
  method: LocalControlPlaneInjectRequest["method"],
  path: string,
  options: Readonly<{
    readonly body?: Uint8Array;
    readonly headers?: Readonly<Record<string, string>>;
  }> = {},
): LocalControlPlaneInjectRequest {
  return {
    method,
    path,
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      ...(method === "PUT" ? { "content-type": LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE } : {}),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: options.body }),
  };
}

async function putBundle(
  api: LocalControlPlane,
  revision: string,
  bytes: Uint8Array,
): Promise<LocalControlPlaneInjectResponse> {
  return api.inject(request("PUT", `/v1/bundles/${revision}`, { body: bytes }));
}

beforeAll(async () => {
  officialSourceBytes = new Uint8Array(await readFile(OFFICIAL_SOURCE_PATH));
  const source = JSON.parse(textDecoder.decode(officialSourceBytes)) as Record<string, unknown>;
  source.id = "com.example.account-app-variant";
  variantSourceBytes = new TextEncoder().encode(JSON.stringify(source));
});

afterEach(async () => {
  const current = opened;
  opened = [];
  await Promise.all(current.map((api) => api.close()));
});

describe("M07-T05 closed local control-plane HTTP profile", () => {
  it("requires the same bearer failure for missing and incorrect credentials", async () => {
    const api = createApi();
    const missing = await api.inject({ method: "GET", path: `/v1/bundles/${REVISION_A}` });
    const wrong = await api.inject({
      method: "GET",
      path: `/v1/bundles/${REVISION_A}`,
      headers: { authorization: "Bearer definitely-not-the-token" },
    });

    expect(missing.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(missing.body).toEqual(wrong.body);
    expect(errorCode(missing)).toBe("AUTHENTICATION_REQUIRED");
    expect(textDecoder.decode(missing.body)).not.toContain(API_TOKEN);
  });

  it("rejects non-loopback hosts and browser origins outside the exact allowlist", async () => {
    const api = createApi();
    const hostileHost = await api.inject(
      request("GET", `/v1/bundles/${REVISION_A}`, { headers: { host: "0.0.0.0" } }),
    );
    const hostileOrigin = await api.inject(
      request("GET", `/v1/bundles/${REVISION_A}`, {
        headers: { origin: "https://sub.desen.app" },
      }),
    );
    const allowed = await api.inject(
      request("GET", `/v1/bundles/${REVISION_A}`, { headers: { origin: ALLOWED_ORIGIN } }),
    );

    expect(errorCode(hostileHost)).toBe("HOST_NOT_ALLOWED");
    expect(errorCode(hostileOrigin)).toBe("ORIGIN_NOT_ALLOWED");
    expect(allowed.statusCode).toBe(404);
    expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("stores and returns exact editable Source bytes under generation CAS", async () => {
    const api = createApi();
    const created = await api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body: officialSourceBytes,
        headers: { "if-none-match": "*", origin: ALLOWED_ORIGIN },
      }),
    );
    expect(created.statusCode).toBe(201);
    expect(created.headers.etag).toBe('"g:1"');
    expect(json(created)).toMatchObject({ generation: 1, sourceKey: "sign-in", status: "created" });

    const fetched = await api.inject(
      request("GET", "/v1/sources/sign-in", { headers: { origin: ALLOWED_ORIGIN } }),
    );
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers.etag).toBe('"g:1"');
    expect(fetched.headers["access-control-expose-headers"]).toBe("etag");
    expect(fetched.body).toEqual(officialSourceBytes);

    const unchanged = await api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body: officialSourceBytes,
        headers: { "if-match": '"g:1"', origin: ALLOWED_ORIGIN },
      }),
    );
    expect(json(unchanged)).toMatchObject({ generation: 1, status: "unchanged" });

    const updated = await api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body: variantSourceBytes,
        headers: { "if-match": '"g:1"' },
      }),
    );
    expect(json(updated)).toMatchObject({ generation: 2, status: "updated" });

    const stale = await api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body: officialSourceBytes,
        headers: { "if-match": '"g:1"', origin: ALLOWED_ORIGIN },
      }),
    );
    expect(stale.statusCode).toBe(412);
    expect(stale.headers.etag).toBe('"g:2"');
    expect(stale.headers["access-control-expose-headers"]).toBe("etag");
    expect(errorCode(stale)).toBe("GENERATION_MISMATCH");
  });

  it("rejects missing, forged, aliased, and duplicate-key Source admission", async () => {
    const api = createApi();
    const missing = await api.inject(
      request("PUT", "/v1/sources/sign-in", { body: officialSourceBytes }),
    );
    const aliased = await api.inject(
      request("PUT", "/v1/sources/Sign-In", {
        body: officialSourceBytes,
        headers: { "if-none-match": "*" },
      }),
    );
    const duplicate = new TextEncoder().encode(
      textDecoder
        .decode(officialSourceBytes)
        .replace('"kind": "desen.source"', '"kind":"desen.source","kind":"desen.source"'),
    );
    const duplicateResult = await api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body: duplicate,
        headers: { "if-none-match": "*" },
      }),
    );

    expect(missing.statusCode).toBe(428);
    expect(errorCode(missing)).toBe("PRECONDITION_REQUIRED");
    expect(errorCode(aliased)).toBe("INVALID_SOURCE_KEY");
    expect(errorCode(duplicateResult)).toBe("SOURCE_JSON_INVALID");
  });

  it("enforces the Source raw body ceiling before strict parsing", async () => {
    const api = createApi();
    const overLimit = new Uint8Array(LOCAL_CONTROL_PLANE_LIMITS.maxSourceUtf8Bytes + 1);
    overLimit.fill(0x20);
    const response = await api.inject(
      request("PUT", "/v1/sources/large", {
        body: overLimit,
        headers: { "if-none-match": "*" },
      }),
    );
    expect(response.statusCode).toBe(413);
    expect(errorCode(response)).toBe("BODY_LIMIT_EXCEEDED");
  });

  it("keeps Bundle transport byte-exact and delegates first-writer immutability to M07-T01", async () => {
    const api = createApi();
    const intentionallyInvalidBundle = Uint8Array.from([0xff, 0x00, 0x7b]);
    const created = await putBundle(api, REVISION_A, intentionallyInvalidBundle);
    const unchanged = await putBundle(api, REVISION_A, new Uint8Array(intentionallyInvalidBundle));
    const conflict = await putBundle(api, REVISION_A, Uint8Array.from([0x7b, 0x7d]));
    const fetched = await api.inject(request("GET", `/v1/bundles/${REVISION_A}`));

    expect(json(created)).toEqual({ revision: REVISION_A, status: "stored" });
    expect(json(unchanged)).toEqual({ revision: REVISION_A, status: "unchanged" });
    expect(conflict.statusCode).toBe(409);
    expect(errorCode(conflict)).toBe("BUNDLE_BYTES_CONFLICT");
    expect(fetched.body).toEqual(intentionallyInvalidBundle);
  });

  it("moves a CAS channel only to an existing Bundle without changing Bundle bytes", async () => {
    const bundleA = Uint8Array.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x31, 0x7d]);
    const bundleB = Uint8Array.from([0x7b, 0x22, 0x62, 0x22, 0x3a, 0x32, 0x7d]);
    const api = createApi();
    await putBundle(api, REVISION_A, bundleA);
    await putBundle(api, REVISION_B, bundleB);

    const created = await api.inject(
      request("PUT", "/v1/channels/preview", {
        body: new TextEncoder().encode(JSON.stringify({ revision: REVISION_A })),
        headers: { "if-none-match": "*" },
      }),
    );
    expect(json(created)).toMatchObject({
      channelName: "preview",
      generation: 1,
      revision: REVISION_A,
      status: "created",
    });

    const updated = await api.inject(
      request("PUT", "/v1/channels/preview", {
        body: new TextEncoder().encode(JSON.stringify({ revision: REVISION_B })),
        headers: { "if-match": '"g:1"' },
      }),
    );
    expect(json(updated)).toMatchObject({ generation: 2, revision: REVISION_B, status: "updated" });

    const stale = await api.inject(
      request("PUT", "/v1/channels/preview", {
        body: new TextEncoder().encode(JSON.stringify({ revision: REVISION_A })),
        headers: { "if-match": '"g:1"' },
      }),
    );
    expect(errorCode(stale)).toBe("GENERATION_MISMATCH");

    const fetchedA = await api.inject(request("GET", `/v1/bundles/${REVISION_A}`));
    const fetchedB = await api.inject(request("GET", `/v1/bundles/${REVISION_B}`));
    expect(fetchedA.body).toEqual(bundleA);
    expect(fetchedB.body).toEqual(bundleB);
  });

  it("rejects dangling channel targets and closed-body extensions", async () => {
    const api = createApi();
    const missing = await api.inject(
      request("PUT", "/v1/channels/preview", {
        body: new TextEncoder().encode(JSON.stringify({ revision: REVISION_A })),
        headers: { "if-none-match": "*" },
      }),
    );
    const extended = await api.inject(
      request("PUT", "/v1/channels/preview", {
        body: new TextEncoder().encode(JSON.stringify({ active: true, revision: REVISION_A })),
        headers: { "if-none-match": "*" },
      }),
    );
    expect(missing.statusCode).toBe(409);
    expect(errorCode(missing)).toBe("BUNDLE_NOT_FOUND");
    expect(errorCode(extended)).toBe("INVALID_CHANNEL_BODY");
  });

  it("rejects query aliases, encoded paths, unsupported methods, media types, and encodings", async () => {
    const api = createApi();
    const query = await api.inject(request("GET", `/v1/bundles/${REVISION_A}?x=1`));
    const encoded = await api.inject(request("GET", "/v1/sources/%70review"));
    const method = await api.inject(request("DELETE", "/v1/sources/preview"));
    const media = await api.inject(
      request("PUT", "/v1/sources/preview", {
        body: officialSourceBytes,
        headers: { "content-type": "application/json; charset=utf-8", "if-none-match": "*" },
      }),
    );
    const encoding = await api.inject(
      request("PUT", "/v1/sources/preview", {
        body: officialSourceBytes,
        headers: { "content-encoding": "gzip", "if-none-match": "*" },
      }),
    );

    expect(errorCode(query)).toBe("INVALID_REQUEST");
    expect(errorCode(encoded)).toBe("INVALID_REQUEST");
    expect(errorCode(method)).toBe("METHOD_NOT_ALLOWED");
    expect(errorCode(media)).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(errorCode(encoding)).toBe("CONTENT_ENCODING_NOT_ALLOWED");
  });

  it("answers only an exact allowlisted browser preflight without requiring the bearer value", async () => {
    const api = createApi();
    const allowed = await api.inject({
      method: "OPTIONS",
      path: "/v1/channels/preview",
      headers: {
        origin: ALLOWED_ORIGIN,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization, content-type, if-match",
      },
    });
    const denied = await api.inject({
      method: "OPTIONS",
      path: "/v1/channels/preview",
      headers: {
        origin: "https://attacker.example",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization, content-type, if-match",
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.body).toHaveLength(0);
    expect(allowed.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(errorCode(denied)).toBe("ORIGIN_NOT_ALLOWED");
  });

  it("snapshots injected bytes and revokes request admission after close", async () => {
    const api = createApi();
    const body = new Uint8Array(officialSourceBytes);
    const pending = api.inject(
      request("PUT", "/v1/sources/sign-in", {
        body,
        headers: { "if-none-match": "*" },
      }),
    );
    body.fill(0);
    expect((await pending).statusCode).toBe(201);
    await api.close();
    await expect(api.inject(request("GET", "/v1/sources/sign-in"))).rejects.toMatchObject({
      code: "SERVER_STATE_INVALID",
    } satisfies Partial<LocalControlPlaneError>);
  });

  it("revokes an in-progress listener when close wins the lifecycle race", async () => {
    const api = createApi();
    const listening = api.listen(0);
    const closing = api.close();

    await expect(listening).rejects.toMatchObject({ code: "SERVER_STATE_INVALID" });
    await expect(closing).resolves.toBeUndefined();
    await expect(api.inject(request("GET", `/v1/bundles/${REVISION_A}`))).rejects.toMatchObject({
      code: "SERVER_STATE_INVALID",
    } satisfies Partial<LocalControlPlaneError>);
  });

  it(
    "bounds shutdown while an authenticated TCP request body remains incomplete",
    async () => {
      const api = createApi();
      const listener = await api.listen(0);
      const socket = connect({ host: listener.address, port: listener.port });
      socket.on("error", () => undefined);
      const socketClosed = new Promise<void>((resolveClosed) => {
        socket.once("close", () => resolveClosed());
      });
      await new Promise<void>((resolveConnected, rejectConnected) => {
        socket.once("connect", resolveConnected);
        socket.once("error", rejectConnected);
      });

      const partialRequest = [
        "PUT /v1/sources/partial HTTP/1.1",
        `Host: ${listener.address}:${String(listener.port)}`,
        `Authorization: Bearer ${API_TOKEN}`,
        `Content-Type: ${LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE}`,
        "If-None-Match: *",
        "Content-Length: 100",
        "Connection: keep-alive",
        "",
        "{",
      ].join("\r\n");
      await new Promise<void>((resolveWritten, rejectWritten) => {
        socket.write(partialRequest, (error) => {
          if (error === undefined || error === null) resolveWritten();
          else rejectWritten(error);
        });
      });
      await wait(100);

      let closeSettled = false;
      const closing = api.close().finally(() => {
        closeSettled = true;
      });
      await wait(100);
      expect(closeSettled).toBe(false);

      const resolvedWithinBound = await Promise.race([
        closing.then(() => true),
        wait(LOCAL_CONTROL_PLANE_LIMITS.connectionTimeoutMilliseconds + 2_000).then(() => false),
      ]);
      expect(resolvedWithinBound).toBe(true);
      await closing;
      await socketClosed;
      expect(socket.destroyed).toBe(true);
    },
    LOCAL_CONTROL_PLANE_LIMITS.connectionTimeoutMilliseconds + 4_000,
  );

  it("drains an admitted inject request before closing owned metadata", async () => {
    const entered = deferred();
    const release = deferred();
    let metadataCloseCount = 0;
    const bundleStore: BundleStore = Object.freeze({
      getBundle: async () => {
        entered.resolve();
        await release.promise;
        return Object.freeze({ status: "missing" as const });
      },
      putBundle: async () => Object.freeze({ status: "stored" as const }),
    });
    const api = createLocalControlPlaneApplication({
      apiToken: API_TOKEN,
      allowedOrigins: [],
      bundleStore,
      channelRepository: createInMemoryChannelRepository(),
      sourceRepository: createInMemorySourceRepository(),
      closeMetadata: () => {
        metadataCloseCount += 1;
      },
    });
    opened.push(api);

    const pending = api.inject(request("GET", `/v1/bundles/${REVISION_A}`));
    await entered.promise;
    const closing = api.close();
    let closed = false;
    void closing.then(() => {
      closed = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(metadataCloseCount).toBe(0);

    release.resolve();
    expect((await pending).statusCode).toBe(404);
    await expect(closing).resolves.toBeUndefined();
    expect(metadataCloseCount).toBe(1);
  });

  it("keeps Source and channel generation exhaustion idempotent and non-mutating", () => {
    const maximum = Number.MAX_SAFE_INTEGER;
    const sourceRepository = createInMemorySourceRepository({
      initialRecords: [
        { sourceKey: "draft", generation: maximum, bytes: Uint8Array.from([1, 2, 3]) },
      ],
    });
    expect(sourceRepository.update("draft", maximum, Uint8Array.from([1, 2, 3]))).toMatchObject({
      status: "unchanged",
      record: { generation: maximum },
    });
    expect(sourceRepository.update("draft", maximum, Uint8Array.from([4, 5, 6]))).toMatchObject({
      status: "generation-exhausted",
      current: { generation: maximum, bytes: Uint8Array.from([1, 2, 3]) },
    });

    const channelRepository = createInMemoryChannelRepository({
      initialRecords: [{ channelName: "preview", revision: REVISION_A, generation: maximum }],
    });
    expect(channelRepository.update("preview", maximum, REVISION_A)).toMatchObject({
      status: "unchanged",
      record: { generation: maximum },
    });
    expect(channelRepository.update("preview", maximum, REVISION_B)).toMatchObject({
      status: "generation-exhausted",
      current: { generation: maximum, revision: REVISION_A },
    });
  });

  it("defensively copies exact Source subviews and rejects stale CAS before observing bytes", () => {
    const repository = createInMemorySourceRepository();
    const backing = Uint8Array.from([9, 1, 2, 3, 9]);
    const exact = backing.subarray(1, 4);
    expect(repository.create("draft", exact)).toMatchObject({ status: "created" });
    backing.fill(0);
    const firstRead = repository.get("draft");
    expect(firstRead).toMatchObject({
      status: "found",
      record: { generation: 1, bytes: Uint8Array.from([1, 2, 3]) },
    });
    if (firstRead.status !== "found") throw new TypeError("Expected the stored Source record.");
    (firstRead.record.bytes as Uint8Array).fill(8);
    expect(repository.get("draft")).toMatchObject({
      record: { bytes: Uint8Array.from([1, 2, 3]) },
    });

    const hostileBytes = new Proxy(new Uint8Array([7]), {});
    expect(repository.update("draft", 2, hostileBytes)).toMatchObject({
      status: "precondition-failed",
      current: { generation: 1 },
    });
  });
});
