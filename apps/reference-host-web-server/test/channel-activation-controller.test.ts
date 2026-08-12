import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  openLocalControlPlane,
} from "@desen/control-plane-api";
import { calculateDesenBundleRevision } from "@desen/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  openReferenceHostChannelActivationController,
  readReferenceHostDeliveryBytes,
} from "../src/channel-activation-controller.js";

import type { LocalControlPlane } from "@desen/control-plane-api";
import type { DesenBundle } from "@desen/protocol";
import type { ReferenceHostChannelActivationController } from "../src/channel-activation-controller.js";

const API_TOKEN = "m07-t11-reference-host-token-32-bytes";
const CHANNEL_NAME = "preview";
const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");
const INSTALLED_PACKAGE_DIRECTORY = join(WORKSPACE_ROOT, "packages/reference-catalog-web");

interface BundleFixture {
  readonly bundle: DesenBundle;
  readonly bytes: Uint8Array;
  readonly revision: string;
}

const roots: string[] = [];
const apis: LocalControlPlane[] = [];
const controllers: ReferenceHostChannelActivationController[] = [];

function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

async function officialFixture(): Promise<BundleFixture> {
  const bytes = new Uint8Array(await readFile(BUNDLE_PATH));
  const bundle = JSON.parse(new TextDecoder().decode(bytes)) as DesenBundle;
  return Object.freeze({ bundle, bytes, revision: bundle.revision });
}

function variantFixture(
  source: DesenBundle,
  mutate: (bundle: Record<string, unknown>) => void,
): BundleFixture {
  const bundle = cloneJson(source) as unknown as Record<string, unknown>;
  mutate(bundle);
  bundle.revision = calculateDesenBundleRevision(bundle as unknown as DesenBundle);
  const typed = bundle as unknown as DesenBundle;
  return Object.freeze({
    bundle: typed,
    bytes: new TextEncoder().encode(JSON.stringify(typed)),
    revision: typed.revision,
  });
}

async function temporaryRoot(): Promise<string> {
  const created = await realpath(await mkdtemp(join(tmpdir(), "desen-reference-host-channel-")));
  roots.push(created);
  return created;
}

function authenticatedHeaders(): Readonly<Record<string, string>> {
  return Object.freeze({
    authorization: `Bearer ${API_TOKEN}`,
    "content-type": LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  });
}

async function putBundle(api: LocalControlPlane, fixture: BundleFixture): Promise<void> {
  expect(
    await api.inject({
      method: "PUT",
      path: `/v1/bundles/${fixture.revision}`,
      headers: authenticatedHeaders(),
      body: fixture.bytes,
    }),
  ).toMatchObject({ statusCode: 201 });
}

async function putChannel(
  api: LocalControlPlane,
  revision: string,
  expectedGeneration: number | null,
): Promise<number> {
  const response = await api.inject({
    method: "PUT",
    path: `/v1/channels/${CHANNEL_NAME}`,
    headers: {
      ...authenticatedHeaders(),
      ...(expectedGeneration === null
        ? { "if-none-match": "*" }
        : { "if-match": `"g:${String(expectedGeneration)}"` }),
    },
    body: new TextEncoder().encode(JSON.stringify({ revision })),
  });
  expect(response.statusCode).toBe(expectedGeneration === null ? 201 : 200);
  const body = JSON.parse(new TextDecoder().decode(response.body)) as Record<string, unknown>;
  return Number(body.generation);
}

async function setup(
  fixtures: readonly BundleFixture[],
  initialRevision: string,
): Promise<
  Readonly<{ readonly api: LocalControlPlane; readonly origin: string; readonly root: string }>
> {
  const root = await temporaryRoot();
  const api = await openLocalControlPlane({ rootDirectory: root, apiToken: API_TOKEN });
  apis.push(api);
  for (const fixture of fixtures) await putBundle(api, fixture);
  await putChannel(api, initialRevision, null);
  const listener = await api.listen(0);
  return Object.freeze({ api, origin: listener.origin, root });
}

async function openController(
  fixture: Readonly<{ readonly origin: string; readonly root: string }>,
): Promise<ReferenceHostChannelActivationController> {
  const controller = await openReferenceHostChannelActivationController({
    rootDirectory: fixture.root,
    installedPackageDirectory: INSTALLED_PACKAGE_DIRECTORY,
    controlPlaneOrigin: fixture.origin,
    controlPlaneApiToken: API_TOKEN,
    channelName: CHANNEL_NAME,
  });
  controllers.push(controller);
  return controller;
}

function deferred(): Readonly<{
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}> {
  let resolver: (() => void) | undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolver = resolvePromise;
  });
  if (resolver === undefined) throw new TypeError("Deferred resolver was not initialized.");
  return Object.freeze({ promise, resolve: resolver });
}

function installInjectedControlPlaneTransport(api: LocalControlPlane, origin: string): void {
  vi.stubGlobal(
    "fetch",
    async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = new URL(String(input));
      if (url.origin !== origin) throw new TypeError("Unexpected control-plane test origin.");
      const authorization = new Headers(init?.headers).get("authorization");
      const injected = await api.inject({
        method: "GET",
        path: url.pathname,
        ...(authorization === null ? {} : { headers: { authorization } }),
      });
      const bytes = new Uint8Array(injected.body);
      const body = new ReadableStream<Uint8Array>({
        start(controller): void {
          if (bytes.byteLength > 0) controller.enqueue(bytes);
          controller.close();
        },
      });
      return {
        status: injected.statusCode,
        redirected: false,
        url: url.href,
        headers: new Headers(injected.headers),
        body,
      } as Response;
    },
  );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  controllers.splice(0).forEach((controller) => controller.close());
  await Promise.all(apis.splice(0).map(async (api) => api.close()));
  await Promise.all(
    roots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

describe("reference host channel activation controller", () => {
  it("[valid-a-activation-delivery] activates and exposes the first valid candidate", async () => {
    const a = await officialFixture();
    const environment = await setup([a], a.revision);
    const controller = await openController(environment);

    const result = await controller.refresh();

    expect(result).toMatchObject({
      status: "available",
      relationship: "activated",
      delivery: { activation: { generation: 0, revision: a.revision } },
    });
    expect(controller.readDelivery()?.etag).toBe(`"desen-active:g:0:${a.revision}"`);
    expect(readReferenceHostDeliveryBytes(controller)?.bytes).toEqual(
      new TextEncoder().encode(
        `{"activation":{"generation":0,"revision":"${a.revision}"},"bundle":${new TextDecoder().decode(a.bytes)}}`,
      ),
    );
  });

  it("[invalid-b-preserves-a] retains the authenticated A delivery", async () => {
    const a = await officialFixture();
    const b = variantFixture(a.bundle, (bundle) => {
      const requires = bundle.requires as { catalogs: Record<string, unknown>[] };
      requires.catalogs[0] = { ...requires.catalogs[0], digest: `sha256:${"0".repeat(64)}` };
    });
    const environment = await setup([a, b], a.revision);
    const controller = await openController(environment);
    expect((await controller.refresh()).status).toBe("available");
    const before = controller.readDelivery();

    await putChannel(environment.api, b.revision, 1);
    const result = await controller.refresh();

    expect(result).toMatchObject({
      status: "available",
      relationship: "preserved",
      delivery: { activation: { generation: 0, revision: a.revision } },
    });
    expect(controller.readDelivery()).toBe(before);
    expect(readReferenceHostDeliveryBytes(controller)?.bytes).toEqual(
      new TextEncoder().encode(
        `{"activation":{"generation":0,"revision":"${a.revision}"},"bundle":${new TextDecoder().decode(a.bytes)}}`,
      ),
    );
  });

  it("[valid-c-replaces-a] commits C with A as previous-good", async () => {
    const a = await officialFixture();
    const c = variantFixture(a.bundle, (bundle) => {
      bundle.sourceDigest = `sha256:${"c".repeat(64)}`;
    });
    const environment = await setup([a, c], a.revision);
    const controller = await openController(environment);
    expect((await controller.refresh()).status).toBe("available");

    await putChannel(environment.api, c.revision, 1);
    const result = await controller.refresh();

    expect(result).toMatchObject({
      status: "available",
      relationship: "activated",
      delivery: { activation: { generation: 1, revision: c.revision } },
    });
    expect(controller.readDelivery()?.etag).toBe(`"desen-active:g:1:${c.revision}"`);
  });

  it("[restart-recovers-before-delivery] withholds C until complete reconstruction", async () => {
    const a = await officialFixture();
    const c = variantFixture(a.bundle, (bundle) => {
      bundle.sourceDigest = `sha256:${"c".repeat(64)}`;
    });
    const environment = await setup([a, c], a.revision);
    const first = await openController(environment);
    expect((await first.refresh()).status).toBe("available");
    await putChannel(environment.api, c.revision, 1);
    expect((await first.refresh()).status).toBe("available");
    first.close();

    const restarted = await openController(environment);
    expect(restarted.readDelivery()).toBeUndefined();
    const recovered = await restarted.refresh();

    expect(recovered).toMatchObject({
      status: "available",
      relationship: "recovered",
      delivery: { activation: { generation: 1, revision: c.revision } },
    });
  });

  it("[stale-refresh-fenced] retries once against the newer channel snapshot", async () => {
    const a = await officialFixture();
    const c = variantFixture(a.bundle, (bundle) => {
      bundle.sourceDigest = `sha256:${"c".repeat(64)}`;
    });
    const environment = await setup([a, c], a.revision);
    const originalFetch = globalThis.fetch;
    let switched = false;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (!switched && String(input).includes(`/v1/bundles/${a.revision}`)) {
        switched = true;
        await putChannel(environment.api, c.revision, 1);
      }
      return response;
    });
    const controller = await openController(environment);

    const result = await controller.refresh();

    expect(result).toMatchObject({
      status: "available",
      relationship: "activated",
      delivery: { activation: { generation: 0, revision: c.revision } },
    });
  });

  it("[late-refresh-after-close-fenced] prevents publication after disposal", async () => {
    const a = await officialFixture();
    const environment = await setup([a], a.revision);
    const entered = deferred();
    const release = deferred();
    const originalFetch = globalThis.fetch;
    let delayed = false;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      if (!delayed && String(input).includes(`/v1/channels/${CHANNEL_NAME}`)) {
        delayed = true;
        entered.resolve();
        await release.promise;
      }
      return originalFetch(input, init);
    });
    const controller = await openController(environment);
    const pending = controller.refresh();
    await entered.promise;

    controller.close();
    release.resolve();

    await expect(pending).resolves.toEqual({ status: "closed" });
    expect(controller.readDelivery()).toBeUndefined();
  });

  it("exercises A-B-C preservation and restart recovery without socket authority", async () => {
    const a = await officialFixture();
    const b = variantFixture(a.bundle, (bundle) => {
      const requires = bundle.requires as { catalogs: Record<string, unknown>[] };
      requires.catalogs[0] = { ...requires.catalogs[0], digest: `sha256:${"0".repeat(64)}` };
    });
    const c = variantFixture(a.bundle, (bundle) => {
      bundle.sourceDigest = `sha256:${"c".repeat(64)}`;
    });
    const root = await temporaryRoot();
    const api = await openLocalControlPlane({ rootDirectory: root, apiToken: API_TOKEN });
    apis.push(api);
    await putBundle(api, a);
    await putBundle(api, b);
    await putBundle(api, c);
    await putChannel(api, a.revision, null);
    const origin = "http://127.0.0.1:4317";
    installInjectedControlPlaneTransport(api, origin);
    const environment = Object.freeze({ origin, root });
    const first = await openController(environment);

    expect(await first.refresh()).toMatchObject({
      status: "available",
      relationship: "activated",
      delivery: { activation: { generation: 0, revision: a.revision } },
    });
    await putChannel(api, b.revision, 1);
    expect(await first.refresh()).toMatchObject({
      status: "available",
      relationship: "preserved",
      delivery: { activation: { generation: 0, revision: a.revision } },
    });
    await putChannel(api, c.revision, 2);
    expect(await first.refresh()).toMatchObject({
      status: "available",
      relationship: "activated",
      delivery: { activation: { generation: 1, revision: c.revision } },
    });
    first.close();

    const restarted = await openController(environment);
    expect(restarted.readDelivery()).toBeUndefined();
    expect(await restarted.refresh()).toMatchObject({
      status: "available",
      relationship: "recovered",
      delivery: { activation: { generation: 1, revision: c.revision } },
    });
  });
});
