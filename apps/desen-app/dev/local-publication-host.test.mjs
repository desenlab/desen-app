import { request as httpRequest } from "node:http";
import { connect } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DesenAppLocalPublicationHostError,
  openDesenAppLocalPublicationHost,
} from "./local-publication-host.mjs";

const TOKEN = "local-publication-only-bearer-0123456789";
const ORIGIN = "http://127.0.0.1:5173";
const CHANNEL_NAME = "preview";
const HOST_ID = "reference-host-web";
const REVISION = `sha256:${"a".repeat(64)}`;
const OTHER_REVISION = `sha256:${"b".repeat(64)}`;
const INPUT = Object.freeze({
  channelName: CHANNEL_NAME,
  channelGeneration: 7,
  hostId: HOST_ID,
  revision: REVISION,
});
const ACTIVE = Object.freeze({
  status: "active",
  relationship: "activated",
  activeRevision: REVISION,
  activationGeneration: 11,
});
const hosts = [];

async function startHost(activatePublishedRevision = async () => ACTIVE) {
  const host = await openDesenAppLocalPublicationHost({
    apiToken: TOKEN,
    allowedOrigin: ORIGIN,
    channelName: CHANNEL_NAME,
    hostId: HOST_ID,
    activatePublishedRevision,
  });
  hosts.push(host);
  const listener = await host.listen(0);
  return { ...listener, host };
}

function post(origin, body = JSON.stringify(INPUT), headers = {}) {
  return fetch(`${origin}/v1/activate-published-revision`, {
    method: "POST",
    redirect: "error",
    body,
    headers: {
      origin: ORIGIN,
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...headers,
    },
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(hosts.splice(0).map((host) => host.close()));
});

describe("local publication activation HTTP host", () => {
  it("projects one exact successful fixed-destination activation over real HTTP", async () => {
    const callback = vi.fn(async (request) => {
      expect(Object.isFrozen(request)).toBe(true);
      expect(Reflect.ownKeys(request).sort()).toEqual([
        "channelGeneration",
        "channelName",
        "hostId",
        "revision",
      ]);
      return ACTIVE;
    });
    const listener = await startHost(callback);
    const response = await post(listener.origin);
    const body = await response.text();

    expect(listener.address).toBe("127.0.0.1");
    expect(listener.port).toBeGreaterThan(0);
    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toEqual(ACTIVE);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-length")).toBe(String(Buffer.byteLength(body)));
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(callback).toHaveBeenCalledExactlyOnceWith(INPUT);
  });

  it.each([
    Object.freeze({ status: "unavailable" }),
    Object.freeze({ status: "failed" }),
    Object.freeze({ status: "indeterminate" }),
  ])("returns HTTP 200 with the exact closed $status callback settlement", async (settlement) => {
    const { origin } = await startHost(async () => settlement);
    const response = await post(origin);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settlement);
  });

  it("accepts reordered closed request JSON and rejects a wrong destination before callback", async () => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    const reordered = await post(
      origin,
      `{ "revision": "${REVISION}", "hostId": "${HOST_ID}", "channelGeneration": 7, "channelName": "${CHANNEL_NAME}" }`,
    );
    expect(reordered.status).toBe(200);
    expect(callback).toHaveBeenCalledTimes(1);

    for (const candidate of [
      { ...INPUT, channelName: "other" },
      { ...INPUT, hostId: "other-host" },
      { ...INPUT, channelGeneration: 0 },
      { ...INPUT, revision: "sha256:not-a-revision" },
    ]) {
      expect((await post(origin, JSON.stringify(candidate))).status).toBe(400);
    }
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each([
    "not-json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...INPUT, endpoint: "http://foreign.example" }),
    JSON.stringify({ ...INPUT, channelGeneration: 1.5 }),
    JSON.stringify({ ...INPUT, channelGeneration: Number.MAX_SAFE_INTEGER + 1 }),
    JSON.stringify({ ...INPUT, revision: OTHER_REVISION, extra: null }),
    `{"channelName":"${CHANNEL_NAME}","channelName":"${CHANNEL_NAME}","channelGeneration":7,"hostId":"${HOST_ID}","revision":"${REVISION}"}`,
    `{"channel\\u004eame":"${CHANNEL_NAME}","channelGeneration":7,"hostId":"${HOST_ID}","revision":"${REVISION}"}`,
  ])("rejects malformed, duplicated, encoded, or nonclosed activation JSON", async (body) => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    expect((await post(origin, body)).status).toBe(400);
    expect(callback).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: "Bearer other-authority" },
    { authorization: "" },
    { origin: "http://127.0.0.1:5174" },
    { origin: "null" },
    { origin: "" },
    { cookie: "ambient-session=must-not-authorize" },
  ])("denies requests outside exact origin, bearer, and cookie-free authority", async (headers) => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    const response = await post(origin, JSON.stringify(INPUT), headers);
    const body = await response.text();
    expect(response.status).toBe(403);
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain(CHANNEL_NAME);
    expect(body).not.toContain(HOST_ID);
    expect(body).not.toContain(REVISION);
    expect(callback).not.toHaveBeenCalled();
    if (headers.origin !== undefined && headers.origin !== ORIGIN) {
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("rejects foreign Host and duplicate raw authority headers", async () => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    const rawStatus = (headers) =>
      new Promise((resolve, reject) => {
        const request = httpRequest(
          `${origin}/v1/activate-published-revision`,
          { method: "POST", headers },
          (response) => {
            response.resume();
            response.once("end", () => resolve(response.statusCode));
          },
        );
        request.once("error", reject);
        request.end(JSON.stringify(INPUT));
      });
    expect(
      await rawStatus({
        host: "foreign.example",
        origin: ORIGIN,
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      }),
    ).toBe(403);
    expect(
      await rawStatus({
        origin: [ORIGIN, ORIGIN],
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      }),
    ).toBe(403);
    expect(callback).not.toHaveBeenCalled();
  });

  it("authorizes only the exact preflight without exposing credentialed CORS", async () => {
    const { origin } = await startHost();
    const allowed = await fetch(`${origin}/v1/activate-published-revision`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,authorization",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(allowed.headers.get("access-control-allow-methods")).toBe("POST");
    expect(allowed.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
    expect(allowed.headers.get("access-control-allow-credentials")).toBeNull();

    const denied = await fetch(`${origin}/v1/activate-published-revision`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "authorization,content-type,x-override",
      },
    });
    expect(denied.status).toBe(403);
  });

  it("closes endpoint, method, media type, encoding, UTF-8, and request-size authority", async () => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    for (const path of [
      "/v1/other",
      "/v1/activate-published-revision?host=other",
      "/v1/%61ctivate-published-revision",
    ]) {
      expect(
        (await fetch(`${origin}${path}`, { method: "POST", headers: { origin: ORIGIN } })).status,
      ).toBe(404);
    }
    expect(
      (await fetch(`${origin}/v1/activate-published-revision`, { headers: { origin: ORIGIN } }))
        .status,
    ).toBe(405);
    expect(
      (await post(origin, JSON.stringify(INPUT), { "content-type": "text/plain" })).status,
    ).toBe(415);
    expect((await post(origin, JSON.stringify(INPUT), { "content-encoding": "gzip" })).status).toBe(
      415,
    );
    expect((await post(origin, new Uint8Array([0xff, 0xff]))).status).toBe(400);
    expect((await post(origin, "x".repeat(16_385))).status).toBe(413);
    expect(callback).not.toHaveBeenCalled();
  });

  it("bounds a chunked request body before invoking the activation callback", async () => {
    const callback = vi.fn(async () => ACTIVE);
    const { origin } = await startHost(callback);
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(
        `${origin}/v1/activate-published-revision`,
        {
          method: "POST",
          headers: {
            origin: ORIGIN,
            authorization: `Bearer ${TOKEN}`,
            "content-type": "application/json",
            "transfer-encoding": "chunked",
          },
        },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode));
        },
      );
      request.once("error", reject);
      request.write("x".repeat(8_192));
      request.end("x".repeat(8_193));
    });
    expect(status).toBe(413);
    expect(callback).not.toHaveBeenCalled();
  });

  it("projects invalid, accessor-backed, and thrown callback outcomes to indeterminate", async () => {
    const error = vi.spyOn(console, "error");
    const log = vi.spyOn(console, "log");
    let accessorInvoked = false;
    const candidates = [
      undefined,
      { status: "failed", privateDetail: TOKEN },
      {
        status: "active",
        relationship: "activated",
        activeRevision: "sha256:invalid",
        activationGeneration: 1,
      },
      Object.defineProperty({}, "status", {
        enumerable: true,
        get() {
          accessorInvoked = true;
          return "failed";
        },
      }),
      new Error(`private callback ${TOKEN} ${REVISION}`),
    ];
    for (const candidate of candidates) {
      const callback =
        candidate instanceof Error
          ? async () => {
              throw candidate;
            }
          : async () => candidate;
      const { origin, host } = await startHost(callback);
      const response = await post(origin);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(JSON.parse(body)).toEqual({ status: "indeterminate" });
      expect(body).not.toContain(TOKEN);
      expect(body).not.toContain(REVISION);
      await host.close();
    }
    expect(accessorInvoked).toBe(false);
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects malformed trusted options without invoking accessors or retaining private values", async () => {
    const callback = vi.fn(async () => ACTIVE);
    const candidates = [
      {},
      {
        apiToken: "short",
        allowedOrigin: ORIGIN,
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        activatePublishedRevision: callback,
      },
      {
        apiToken: TOKEN,
        allowedOrigin: "https://foreign.example",
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        activatePublishedRevision: callback,
      },
      {
        apiToken: TOKEN,
        allowedOrigin: ORIGIN,
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        activatePublishedRevision: callback,
        endpoint: "/other",
      },
      Object.assign(Object.create(null), {
        apiToken: TOKEN,
        allowedOrigin: ORIGIN,
        channelName: CHANNEL_NAME,
        hostId: HOST_ID,
        activatePublishedRevision: callback,
      }),
    ];
    let accessorInvoked = false;
    candidates.push(
      Object.defineProperty(
        {
          allowedOrigin: ORIGIN,
          channelName: CHANNEL_NAME,
          hostId: HOST_ID,
          activatePublishedRevision: callback,
        },
        "apiToken",
        {
          enumerable: true,
          get() {
            accessorInvoked = true;
            return TOKEN;
          },
        },
      ),
    );

    for (const options of candidates) {
      const rejection = await openDesenAppLocalPublicationHost(options).catch((reason) => reason);
      expect(rejection).toEqual(new DesenAppLocalPublicationHostError());
      expect(rejection.message).not.toContain(TOKEN);
      expect(rejection.message).not.toContain(CHANNEL_NAME);
      expect(rejection.message).not.toContain(HOST_ID);
    }
    expect(accessorInvoked).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it("reuses listen(0), closes idle sockets, and revokes authority exactly once", async () => {
    const opened = await openDesenAppLocalPublicationHost({
      apiToken: TOKEN,
      allowedOrigin: ORIGIN,
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      activatePublishedRevision: async () => ACTIVE,
    });
    hosts.push(opened);
    const first = await opened.listen(0);
    const second = await opened.listen(0);
    expect(second).toBe(first);

    const socket = connect({ host: "127.0.0.1", port: first.port });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const socketClosed = new Promise((resolve) => socket.once("close", resolve));
    await Promise.all([opened.close(), opened.close()]);
    await socketClosed;
    await expect(post(first.origin)).rejects.toThrow();
    await expect(opened.listen(0)).rejects.toEqual(new DesenAppLocalPublicationHostError());
  });

  it("supports close before listen and rejects a caller-selected listener port", async () => {
    const host = await openDesenAppLocalPublicationHost({
      apiToken: TOKEN,
      allowedOrigin: ORIGIN,
      channelName: CHANNEL_NAME,
      hostId: HOST_ID,
      activatePublishedRevision: async () => ACTIVE,
    });
    hosts.push(host);
    await expect(host.listen(5174)).rejects.toEqual(new DesenAppLocalPublicationHostError());
    await host.close();
    await host.close();
    await expect(host.listen(0)).rejects.toEqual(new DesenAppLocalPublicationHostError());
  });
});
