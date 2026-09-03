import { request as httpRequest } from "node:http";
import { connect } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DesenAppLocalOperationHostError,
  openDesenAppLocalOperationHost,
} from "./local-operation-host.mjs";

const TOKEN = "local-operation-only-bearer-0123456789";
const ORIGIN = "http://127.0.0.1:5173";
const INPUT = { email: "designer@example.test", password: "local-demo-pass" };
const hosts = [];

async function startHost() {
  const host = await openDesenAppLocalOperationHost({ apiToken: TOKEN, allowedOrigin: ORIGIN });
  hosts.push(host);
  const listener = await host.listen(0);
  return { ...listener, host };
}

function post(origin, body = JSON.stringify(INPUT), headers = {}) {
  return fetch(`${origin}/api/sign-in`, {
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

describe("local reference operation HTTP host", () => {
  it("executes the explicit local account over real HTTP with a non-Catalog output", async () => {
    const host = await startHost();
    expect(host.address).toBe("127.0.0.1");
    expect(host.port).toBeGreaterThan(0);
    const response = await post(host.origin);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "local-host-user" });
    expect(response.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("accepts reordered, whitespace-formatted closed input without accepting duplicate members", async () => {
    const { origin } = await startHost();
    const response = await post(
      origin,
      '{ "password": "local-demo-pass", "email": "designer@example.test" }',
    );
    expect(response.status).toBe(200);
    expect(
      (await post(origin, '{"email":"designer@example.test","email":"local-demo-pass"}')).status,
    ).toBe(400);
  });

  it("returns only the declared public failure for a wrong account and never logs credentials", async () => {
    const error = vi.spyOn(console, "error");
    const log = vi.spyOn(console, "log");
    const { origin } = await startHost();
    const response = await post(
      origin,
      JSON.stringify({ ...INPUT, password: "wrong-private-value" }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "invalidCredentials" } });
    expect(error).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    { authorization: "Bearer other-authority" },
    { authorization: "" },
    { origin: "http://127.0.0.1:5174" },
    { origin: "null" },
    { origin: "" },
    { cookie: "ambient-session=must-not-authorize" },
  ])("denies a request outside exact editor origin, bearer or host authority", async (headers) => {
    const { origin } = await startHost();
    const response = await post(origin, JSON.stringify(INPUT), headers);
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain(INPUT.password);
    if (headers.origin !== undefined && headers.origin !== ORIGIN)
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects a foreign raw Host independently from the socket destination", async () => {
    const { origin } = await startHost();
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(
        `${origin}/api/sign-in`,
        {
          method: "POST",
          headers: {
            host: "foreign.example",
            origin: ORIGIN,
            authorization: `Bearer ${TOKEN}`,
            "content-type": "application/json",
          },
        },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode));
        },
      );
      request.once("error", reject);
      request.end(JSON.stringify(INPUT));
    });
    expect(status).toBe(403);
  });

  it("authorizes only the exact browser preflight and never exposes a credentialed CORS policy", async () => {
    const { origin } = await startHost();
    const response = await fetch(`${origin}/api/sign-in`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,authorization",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "authorization, content-type",
    );
    expect(response.headers.get("access-control-allow-methods")).toBe("POST");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    const denied = await fetch(`${origin}/api/sign-in`, {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "DELETE",
        "access-control-request-headers": "authorization,content-type,x-override",
      },
    });
    expect(denied.status).toBe(403);
  });

  it("closes endpoint, method and JSON media-type authority", async () => {
    const { origin } = await startHost();
    for (const path of ["/api/other", "/api/sign-in?endpoint=other", "/api/%73ign-in"]) {
      expect(
        (await fetch(`${origin}${path}`, { method: "POST", headers: { origin: ORIGIN } })).status,
      ).toBe(404);
    }
    expect((await fetch(`${origin}/api/sign-in`, { headers: { origin: ORIGIN } })).status).toBe(
      405,
    );
    expect(
      (await post(origin, JSON.stringify(INPUT), { "content-type": "text/plain" })).status,
    ).toBe(415);
    expect((await post(origin, JSON.stringify(INPUT), { "content-encoding": "gzip" })).status).toBe(
      415,
    );
  });

  it.each([
    "not-json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...INPUT, endpoint: "http://foreign.example" }),
    JSON.stringify({ email: "a", password: "" }),
    JSON.stringify({ email: "a".repeat(4_097), password: "b" }),
    '{"email":null,"password":"x"}',
    '{"email":"designer@example.test","password":"bad","password":"local-demo-pass"}',
  ])("rejects malformed and nonclosed credential JSON instead of guessing input", async (body) => {
    const { origin } = await startHost();
    expect((await post(origin, body)).status).toBe(400);
  });

  it("bounds both declared and chunked request bodies before account evaluation", async () => {
    const { origin } = await startHost();
    expect((await post(origin, "x".repeat(16_385))).status).toBe(413);
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(
        `${origin}/api/sign-in`,
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
  });

  it("rejects invalid UTF-8 and duplicate raw authority headers", async () => {
    const { origin } = await startHost();
    expect((await post(origin, new Uint8Array([0xff, 0xff]))).status).toBe(400);
    const status = await new Promise((resolve, reject) => {
      const request = httpRequest(
        `${origin}/api/sign-in`,
        {
          method: "POST",
          headers: {
            origin: [ORIGIN, ORIGIN],
            authorization: `Bearer ${TOKEN}`,
            "content-type": "application/json",
          },
        },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode));
        },
      );
      request.once("error", reject);
      request.end(JSON.stringify(INPUT));
    });
    expect(status).toBe(403);
  });

  it("closes idle sockets and revokes listener authority exactly once", async () => {
    const { host, origin, port } = await startHost();
    const socket = connect({ host: "127.0.0.1", port });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    const socketClosed = new Promise((resolve) => socket.once("close", resolve));
    await Promise.all([host.close(), host.close()]);
    await socketClosed;
    await expect(post(origin)).rejects.toThrow();
    await expect(host.listen(0)).rejects.toEqual(new DesenAppLocalOperationHostError());
  });

  it("supports safe close before listen and rejects a caller-selected listener port", async () => {
    const host = await openDesenAppLocalOperationHost({ apiToken: TOKEN, allowedOrigin: ORIGIN });
    hosts.push(host);
    await expect(host.listen(5174)).rejects.toEqual(new DesenAppLocalOperationHostError());
    await host.close();
    await expect(host.listen(0)).rejects.toEqual(new DesenAppLocalOperationHostError());
  });

  it.each([
    {},
    { apiToken: "short", allowedOrigin: ORIGIN },
    { apiToken: TOKEN, allowedOrigin: "https://foreign.example" },
    { apiToken: TOKEN, allowedOrigin: ORIGIN, endpoint: "/other" },
  ])("rejects malformed trusted composition without retaining raw values", async (options) => {
    await expect(openDesenAppLocalOperationHost(options)).rejects.toEqual(
      new DesenAppLocalOperationHostError(),
    );
  });
});
