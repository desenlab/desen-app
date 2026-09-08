import { link, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  openLocalControlPlane,
} from "@desen/control-plane-api";
import { calculateDesenBundleRevision } from "@desen/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_HOST_MAX_DELIVERY_BYTES, openReferenceHostWebServer } from "../src/index.js";

import type { LocalControlPlane } from "@desen/control-plane-api";
import type { DesenBundle } from "@desen/protocol";
import type { ReferenceHostWebServer, ReferenceHostSignInHandler } from "../src/index.js";

const API_TOKEN = "m07-t11-reference-host-token-32-bytes";
const CHANNEL_NAME = "preview";
const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const INSTALLED_PACKAGE_DIRECTORY = join(WORKSPACE_ROOT, "packages/reference-catalog-web");
const CLIENT_BUILD_DIRECTORY = join(WORKSPACE_ROOT, "apps/reference-host-web/dist");
const EXACT_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-elem 'self'",
  "style-src-attr 'unsafe-inline'",
].join("; ");

const roots: string[] = [];
const apis: LocalControlPlane[] = [];
const servers: ReferenceHostWebServer[] = [];

async function temporaryRoot(prefix = "desen-reference-host-server-"): Promise<string> {
  const created = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  roots.push(created);
  return created;
}

async function environment(): Promise<
  Readonly<{
    readonly api: LocalControlPlane;
    readonly channelGeneration: number;
    readonly origin: string;
    readonly root: string;
    readonly revision: string;
  }>
> {
  const root = await temporaryRoot();
  const api = await openLocalControlPlane({ rootDirectory: root, apiToken: API_TOKEN });
  apis.push(api);
  const bytes = new Uint8Array(await readFile(BUNDLE_PATH));
  const bundle = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  const revision = String(bundle.revision);
  const headers = {
    authorization: `Bearer ${API_TOKEN}`,
    "content-type": LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  };
  expect(
    await api.inject({ method: "PUT", path: `/v1/bundles/${revision}`, headers, body: bytes }),
  ).toMatchObject({ statusCode: 201 });
  const channelResponse = await api.inject({
    method: "PUT",
    path: `/v1/channels/${CHANNEL_NAME}`,
    headers: { ...headers, "if-none-match": "*" },
    body: new TextEncoder().encode(JSON.stringify({ revision })),
  });
  expect(channelResponse).toMatchObject({ statusCode: 201 });
  const channel = JSON.parse(new TextDecoder().decode(channelResponse.body)) as Record<
    string,
    unknown
  >;
  const channelGeneration = Number(channel.generation);
  expect(channelGeneration).toBe(1);
  const listener = await api.listen(0);
  return Object.freeze({ api, channelGeneration, origin: listener.origin, root, revision });
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(servers.splice(0).map(async (server) => server.close()));
  await Promise.all(apis.splice(0).map(async (api) => api.close()));
  await Promise.all(
    roots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("reference host loopback Web server", () => {
  async function operationEnvironment(signIn: ReferenceHostSignInHandler) {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
      signIn,
    });
    servers.push(server);
    const { origin } = await server.listen(0);
    const headers = { origin, "content-type": "application/json" };
    const body = JSON.stringify({ email: "designer@example.test", password: "local-demo-pass" });
    return { server, origin, headers, body };
  }

  it("serves only the opt-in fixed same-origin operation with closed success and declared failure results", async () => {
    const handler = vi.fn<ReferenceHostSignInHandler>(() => ({
      status: "succeeded",
      output: { userId: "local-host-user" },
    }));
    const fixture = await operationEnvironment(handler);
    const post = () =>
      fetch(`${fixture.origin}/api/sign-in`, {
        method: "POST",
        headers: fixture.headers,
        body: fixture.body,
      });
    const success = await post();
    expect(success.status).toBe(200);
    expect(success.headers.get("content-type")).toBe("application/json");
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(await success.json()).toEqual({ userId: "local-host-user" });
    expect(handler.mock.calls[0]?.[0]).toEqual({
      email: "designer@example.test",
      password: "local-demo-pass",
    });
    expect(Object.isFrozen(handler.mock.calls[0]?.[0])).toBe(true);
    expect(handler.mock.calls[0]?.[1].aborted).toBe(false);
    handler.mockReturnValue({ status: "failed", code: "invalidCredentials" });
    const failure = await post();
    expect(failure.status).toBe(401);
    expect(await failure.json()).toEqual({ error: { code: "invalidCredentials" } });
    let reads = 0;
    for (const value of [
      { status: "failed", code: "unavailable" },
      { status: "succeeded", output: { userId: "secret", password: "must-not-leak" } },
      { status: "succeeded", output: { userId: "" } },
      { status: "succeeded", output: { userId: "x".repeat(4_097) } },
      Object.defineProperty({ status: "succeeded" }, "output", {
        enumerable: true,
        get() {
          reads += 1;
          return { userId: "secret" };
        },
      }),
    ]) {
      handler.mockReturnValue(value);
      const response = await post();
      expect(response.status).toBe(503);
      expect(await response.text()).toBe("");
    }
    expect(reads).toBe(0);
    const resultRoute = await fetch(`${fixture.origin}/result`);
    expect(resultRoute.status).toBe(200);
    expect(resultRoute.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });

  it("rejects ambient authority, malformed framing and oversized operation inputs before calling the handler", async () => {
    const handler = vi.fn();
    const fixture = await operationEnvironment(handler);
    const cases: RequestInit[] = [
      { headers: { "content-type": "application/json" } },
      { headers: { ...fixture.headers, origin: "http://127.0.0.1:1" } },
      { headers: { ...fixture.headers, cookie: "session=ambient" } },
      { headers: { ...fixture.headers, authorization: "Bearer ambient" } },
      { headers: { ...fixture.headers, "sec-fetch-site": "cross-site" } },
      { headers: { ...fixture.headers, "content-type": "text/plain" } },
      { headers: { ...fixture.headers, "content-encoding": "gzip" } },
      { body: '{"email":"first","email":"second","password":"secret"}' },
      { body: '{"email":"x","password":"secret","endpoint":"https://example.test"}' },
      { body: '{"email":"x","password":""}' },
      { body: '\uFEFF{"email":"x","password":"secret"}' },
      { body: JSON.stringify({ email: "x".repeat(4_097), password: "secret" }) },
      { body: "x".repeat(16_385) },
      { body: new Uint8Array([0xff]) },
    ];
    for (const candidate of cases) {
      const response = await fetch(`${fixture.origin}/api/sign-in`, {
        method: "POST",
        headers: fixture.headers,
        body: fixture.body,
        ...candidate,
      });
      expect([400, 403]).toContain(response.status);
      expect(await response.text()).toBe("");
    }
    for (const path of ["/api/sign-in?selector=other", "/api/%73ign-in", "/api/sign-in/other"]) {
      const response = await fetch(`${fixture.origin}${path}`, {
        method: "POST",
        headers: fixture.headers,
        body: fixture.body,
      });
      expect(response.status).not.toBe(200);
      await response.text();
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("aborts pending host operations on close and never publishes their late success", async () => {
    let resolve!: (value: unknown) => void;
    let started!: (signal: AbortSignal) => void;
    const observed = new Promise<AbortSignal>((done) => {
      started = done;
    });
    const fixture = await operationEnvironment((_input, signal) => {
      started(signal);
      return new Promise((done) => {
        resolve = done;
      });
    });
    const response = fetch(`${fixture.origin}/api/sign-in`, {
      method: "POST",
      headers: fixture.headers,
      body: fixture.body,
    }).then(
      (value) => value.status,
      () => "disconnected",
    );
    const signal = await observed;
    await fixture.server.close();
    expect(signal.aborted).toBe(true);
    resolve({ status: "succeeded", output: { userId: "late-must-not-publish" } });
    expect(await response).not.toBe(200);
  });

  it("aborts pending host operations when their browser disconnects", async () => {
    let started!: (signal: AbortSignal) => void;
    const observed = new Promise<AbortSignal>((done) => {
      started = done;
    });
    const fixture = await operationEnvironment((_input, signal) => {
      started(signal);
      return new Promise(() => undefined);
    });
    const abort = new AbortController();
    const response = fetch(`${fixture.origin}/api/sign-in`, {
      method: "POST",
      headers: fixture.headers,
      body: fixture.body,
      signal: abort.signal,
    }).catch(() => undefined);
    const signal = await observed;
    abort.abort();
    await response;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });

  it("fences a handler that ignores the fixed operation deadline", async () => {
    let started!: () => void;
    const observed = new Promise<void>((done) => {
      started = done;
    });
    const fixture = await operationEnvironment(() => {
      started();
      return new Promise(() => undefined);
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const response = fetch(`${fixture.origin}/api/sign-in`, {
      method: "POST",
      headers: fixture.headers,
      body: fixture.body,
    });
    await observed;
    await vi.advanceTimersByTimeAsync(10_000);
    vi.useRealTimers();
    expect((await response).status).toBe(503);
  });

  it("activates one exact published channel identity through the server's single controller", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    const activatePublishedRevision = server.activatePublishedRevision;
    const request = Object.freeze({
      channelName: CHANNEL_NAME,
      channelGeneration: fixture.channelGeneration,
      revision: fixture.revision,
    });

    await expect(activatePublishedRevision(request)).resolves.toEqual({
      status: "active",
      relationship: "activated",
      activeRevision: fixture.revision,
      activationGeneration: 0,
    });
    await expect(activatePublishedRevision(request)).resolves.toEqual({
      status: "active",
      relationship: "preserved",
      activeRevision: fixture.revision,
      activationGeneration: 0,
    });
  });

  it("rejects malformed or mismatched publication identities without activating a candidate", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    const wrongRevision = `sha256:${"0".repeat(64)}`;
    let accessorReads = 0;
    const accessorRequest = Object.defineProperty(
      {
        channelName: CHANNEL_NAME,
        channelGeneration: fixture.channelGeneration,
      },
      "revision",
      {
        enumerable: true,
        get() {
          accessorReads += 1;
          return fixture.revision;
        },
      },
    ) as Parameters<ReferenceHostWebServer["activatePublishedRevision"]>[0];
    const rejected = [
      {
        channelName: "release",
        channelGeneration: fixture.channelGeneration,
        revision: fixture.revision,
      },
      { channelName: CHANNEL_NAME, channelGeneration: 0, revision: fixture.revision },
      { channelName: CHANNEL_NAME, channelGeneration: 2, revision: fixture.revision },
      {
        channelName: CHANNEL_NAME,
        channelGeneration: fixture.channelGeneration,
        revision: wrongRevision,
      },
      {
        channelName: CHANNEL_NAME,
        channelGeneration: fixture.channelGeneration,
        revision: fixture.revision,
        hostId: "reference-host-web",
      },
    ];
    for (const request of rejected) {
      await expect(server.activatePublishedRevision(request)).resolves.toEqual({
        status: "failed",
      });
    }
    await expect(server.activatePublishedRevision(accessorRequest)).resolves.toEqual({
      status: "failed",
    });
    expect(accessorReads).toBe(0);

    await expect(
      server.activatePublishedRevision({
        channelName: CHANNEL_NAME,
        channelGeneration: fixture.channelGeneration,
        revision: fixture.revision,
      }),
    ).resolves.toEqual({
      status: "active",
      relationship: "activated",
      activeRevision: fixture.revision,
      activationGeneration: 0,
    });
  });

  it("never reports Active when the host preserves a different last-known-good revision", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    await expect(
      server.activatePublishedRevision({
        channelName: CHANNEL_NAME,
        channelGeneration: fixture.channelGeneration,
        revision: fixture.revision,
      }),
    ).resolves.toMatchObject({
      status: "active",
      activeRevision: fixture.revision,
    });

    const candidate = JSON.parse(await readFile(BUNDLE_PATH, "utf8")) as unknown as Record<
      string,
      unknown
    >;
    const requires = candidate.requires as { catalogs: Record<string, unknown>[] };
    requires.catalogs[0] = {
      ...requires.catalogs[0],
      digest: `sha256:${"0".repeat(64)}`,
    };
    candidate.revision = calculateDesenBundleRevision(candidate as unknown as DesenBundle);
    const rejectedRevision = String(candidate.revision);
    const headers = {
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
    };
    expect(
      await fixture.api.inject({
        method: "PUT",
        path: `/v1/bundles/${rejectedRevision}`,
        headers,
        body: new TextEncoder().encode(JSON.stringify(candidate)),
      }),
    ).toMatchObject({ statusCode: 201 });
    const moved = await fixture.api.inject({
      method: "PUT",
      path: `/v1/channels/${CHANNEL_NAME}`,
      headers: { ...headers, "if-match": `"g:${String(fixture.channelGeneration)}"` },
      body: new TextEncoder().encode(JSON.stringify({ revision: rejectedRevision })),
    });
    expect(moved).toMatchObject({ statusCode: 200 });
    const movedChannel = JSON.parse(new TextDecoder().decode(moved.body)) as Record<
      string,
      unknown
    >;
    const movedGeneration = Number(movedChannel.generation);
    expect(movedGeneration).toBe(2);

    await expect(
      server.activatePublishedRevision({
        channelName: CHANNEL_NAME,
        channelGeneration: movedGeneration,
        revision: rejectedRevision,
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("fails closed before refresh when unavailable and after the server lifetime closes", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    const activatePublishedRevision = server.activatePublishedRevision;
    const request = Object.freeze({
      channelName: CHANNEL_NAME,
      channelGeneration: fixture.channelGeneration,
      revision: fixture.revision,
    });
    await apis.shift()?.close();
    await expect(activatePublishedRevision(request)).resolves.toEqual({ status: "unavailable" });

    const close = server.close();
    servers.push(server);
    await close;
    await expect(activatePublishedRevision(request)).resolves.toEqual({ status: "unavailable" });
  });

  it("serves the exact active envelope and keeps server authorities out of the response", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    const listener = await server.listen(0);

    const response = await fetch(`${listener.origin}/__desen/runtime/refresh`, {
      method: "POST",
      headers: { origin: listener.origin },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const envelope = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("etag")).toBe(`"desen-active:g:0:${fixture.revision}"`);
    expect(bytes.byteLength).toBeLessThanOrEqual(REFERENCE_HOST_MAX_DELIVERY_BYTES);
    expect(Object.keys(envelope)).toEqual(["activation", "bundle"]);
    expect(envelope.activation).toEqual({ generation: 0, revision: fixture.revision });
    expect((envelope.bundle as Record<string, unknown>).revision).toBe(fixture.revision);
    expect(new TextDecoder().decode(bytes)).toBe(
      `{"activation":{"generation":0,"revision":"${fixture.revision}"},"bundle":${await readFile(BUNDLE_PATH, "utf8")}}`,
    );
    expect(new TextDecoder().decode(bytes)).not.toContain(API_TOKEN);
    expect(new TextDecoder().decode(bytes)).not.toContain(fixture.origin);
    expect(new TextDecoder().decode(bytes)).not.toContain(INSTALLED_PACKAGE_DIRECTORY);

    const index = await fetch(`${listener.origin}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(index.headers.get("content-security-policy")).toBe(EXACT_CONTENT_SECURITY_POLICY);
    expect(index.headers.get("content-security-policy")).not.toContain(
      "script-src 'unsafe-inline'",
    );

    const topLevelIndex = await fetch(`${listener.origin}/`, {
      headers: { "sec-fetch-site": "none" },
    });
    expect(topLevelIndex.status).toBe(200);

    const reloadedHome = await fetch(`${listener.origin}/home`, {
      headers: { "sec-fetch-site": "none" },
    });
    expect(reloadedHome.status).toBe(200);
    expect(await reloadedHome.text()).toBe(
      await readFile(join(CLIENT_BUILD_DIRECTORY, "index.html"), "utf8"),
    );
    expect((await fetch(`${listener.origin}/unknown`)).status).toBe(404);

    const topLevelRefresh = await fetch(`${listener.origin}/__desen/runtime/refresh`, {
      method: "POST",
      headers: { origin: listener.origin, "sec-fetch-site": "none" },
    });
    expect(topLevelRefresh.status).toBe(403);
  });

  it("rejects cross-origin, body-bearing, query, and wrong-method refresh requests", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    const listener = await server.listen(0);
    const endpoint = `${listener.origin}/__desen/runtime/refresh`;

    expect(
      (await fetch(endpoint, { method: "POST", headers: { origin: "https://desen.app" } })).status,
    ).toBe(403);
    expect(
      (
        await fetch(endpoint, {
          method: "POST",
          headers: { origin: listener.origin },
          body: "not-empty",
        })
      ).status,
    ).toBe(400);
    expect(
      (await fetch(`${endpoint}?revision=${fixture.revision}`, { method: "POST" })).status,
    ).toBe(400);
    expect((await fetch(endpoint, { method: "GET" })).status).toBe(405);
  });

  it("keeps the application authentication backend outside the reference server", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    servers.push(server);
    const listener = await server.listen(0);

    const response = await fetch(`${listener.origin}/api/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: listener.origin },
      body: JSON.stringify({ email: "user@example.com", password: "not-a-real-secret" }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(response.headers.get("content-length")).toBe("0");
  });

  it("shares concurrent close completion until the listener is stopped", async () => {
    const fixture = await environment();
    const server = await openReferenceHostWebServer({
      rootDirectory: fixture.root,
      installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
      clientBuildDirectory: CLIENT_BUILD_DIRECTORY,
      controlPlaneOrigin: fixture.origin,
      controlPlaneApiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    const listener = await server.listen(0);

    const first = server.close();
    const second = server.close();
    expect(second).toBe(first);
    await second;
    await expect(fetch(listener.origin)).rejects.toThrow();
    await expect(server.listen(0)).rejects.toThrow("invalid");
  });

  it("rejects a finite static inventory overflow before opening activation state", async () => {
    const buildRoot = await temporaryRoot("desen-reference-host-static-limit-");
    await mkdir(join(buildRoot, "assets"));
    await writeFile(join(buildRoot, "index.html"), "<!doctype html><main></main>");
    await Promise.all(
      Array.from({ length: 256 }, async (_unused, index) =>
        writeFile(join(buildRoot, "assets", `chunk-${String(index).padStart(3, "0")}.js`), "0"),
      ),
    );

    await expect(
      openReferenceHostWebServer({
        rootDirectory: buildRoot,
        installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
        clientBuildDirectory: buildRoot,
        controlPlaneOrigin: "http://127.0.0.1:4317",
        controlPlaneApiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).rejects.toThrow("fixed limits");
  });

  it("rejects too many empty static directories before opening activation state", async () => {
    const buildRoot = await temporaryRoot("desen-reference-host-static-directory-limit-");
    await writeFile(join(buildRoot, "index.html"), "<!doctype html><main></main>");
    await Promise.all(
      Array.from({ length: 256 }, async (_unused, index) =>
        mkdir(join(buildRoot, `empty-${String(index).padStart(3, "0")}`)),
      ),
    );

    await expect(
      openReferenceHostWebServer({
        rootDirectory: buildRoot,
        installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
        clientBuildDirectory: buildRoot,
        controlPlaneOrigin: "http://127.0.0.1:4317",
        controlPlaneApiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).rejects.toThrow("fixed limits");
  });

  it("rejects too many static directory entries before opening activation state", async () => {
    const buildRoot = await temporaryRoot("desen-reference-host-static-entry-limit-");
    await writeFile(join(buildRoot, "index.html"), "<!doctype html><main></main>");
    await Promise.all(
      Array.from({ length: 192 }, async (_unused, index) =>
        mkdir(join(buildRoot, `empty-${String(index).padStart(3, "0")}`)),
      ),
    );
    await Promise.all(
      Array.from({ length: 192 }, async (_unused, index) =>
        writeFile(join(buildRoot, `chunk-${String(index).padStart(3, "0")}.js`), "0"),
      ),
    );

    await expect(
      openReferenceHostWebServer({
        rootDirectory: buildRoot,
        installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
        clientBuildDirectory: buildRoot,
        controlPlaneOrigin: "http://127.0.0.1:4317",
        controlPlaneApiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).rejects.toThrow("fixed limits");
  });

  it("rejects a hard-linked static file before opening activation state", async () => {
    const root = await temporaryRoot("desen-reference-host-static-hard-link-");
    const buildRoot = join(root, "build");
    const externalIndex = join(root, "external-index.html");
    await mkdir(buildRoot);
    await writeFile(externalIndex, "<!doctype html><main></main>");
    await link(externalIndex, join(buildRoot, "index.html"));

    await expect(
      openReferenceHostWebServer({
        rootDirectory: root,
        installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
        clientBuildDirectory: buildRoot,
        controlPlaneOrigin: "http://127.0.0.1:4317",
        controlPlaneApiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).rejects.toThrow("unsafe");
  });
});
