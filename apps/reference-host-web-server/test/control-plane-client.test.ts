import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  openLocalControlPlane,
} from "@desen/control-plane-api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createReferenceHostControlPlaneClient } from "../src/control-plane-client.js";

import type { LocalControlPlane } from "@desen/control-plane-api";

const API_TOKEN = "m07-t11-reference-host-token-32-bytes";
const CHANNEL_NAME = "preview";
const WORKSPACE_ROOT = resolve(import.meta.dirname, "../../..");
const BUNDLE_PATH = join(WORKSPACE_ROOT, "examples/sign-in/official-derived.bundle.desen.json");

const opened: LocalControlPlane[] = [];
const roots: string[] = [];

async function root(): Promise<string> {
  const created = await realpath(await mkdtemp(join(tmpdir(), "desen-reference-host-client-")));
  roots.push(created);
  return created;
}

async function putFixture(api: LocalControlPlane): Promise<string> {
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
  expect(
    await api.inject({
      method: "PUT",
      path: `/v1/channels/${CHANNEL_NAME}`,
      headers: { ...headers, "if-none-match": "*" },
      body: new TextEncoder().encode(JSON.stringify({ revision })),
    }),
  ).toMatchObject({ statusCode: 201 });
  return revision;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(opened.splice(0).map(async (api) => api.close()));
  await Promise.all(
    roots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })),
  );
});

function exactResponse(url: string, mediaType: string, etag: string, value: unknown): Response {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const body = new ReadableStream<Uint8Array>({
    start(controller): void {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    status: 200,
    redirected: false,
    url,
    headers: new Headers({
      "content-length": String(bytes.byteLength),
      "content-type": mediaType,
      etag,
    }),
    body,
  } as Response;
}

function exactByteResponse(
  url: string,
  mediaType: string,
  etag: string,
  bytes: Uint8Array,
): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller): void {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    status: 200,
    redirected: false,
    url,
    headers: new Headers({
      "content-length": String(bytes.byteLength),
      "content-type": mediaType,
      etag,
    }),
    body,
  } as Response;
}

function rejectingResponse(
  url: string,
  options: Readonly<{
    readonly contentLength?: string;
    readonly contentType?: string;
  }> = {},
): Readonly<{ readonly cancel: ReturnType<typeof vi.fn>; readonly response: Response }> {
  const cancel = vi.fn(async () => undefined);
  return Object.freeze({
    cancel,
    response: {
      status: 200,
      redirected: false,
      url,
      headers: new Headers({
        "content-length": options.contentLength ?? "1",
        "content-type": options.contentType ?? "text/plain",
      }),
      body: Object.freeze({ cancel }),
    } as unknown as Response,
  });
}

describe("reference host real control-plane client", () => {
  it("[loopback-bearer-enforced] authenticates both fixed T05 reads", async () => {
    const api = await openLocalControlPlane({ rootDirectory: await root(), apiToken: API_TOKEN });
    opened.push(api);
    const revision = await putFixture(api);
    const listener = await api.listen(0);

    const valid = createReferenceHostControlPlaneClient({
      origin: listener.origin,
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });
    const channel = await valid.readChannel();
    expect(channel).toEqual({
      status: "found",
      value: { channelName: CHANNEL_NAME, generation: 1, revision },
    });
    const bundle = await valid.readBundle(revision);
    expect(bundle.status).toBe("found");
    if (bundle.status !== "found") throw new TypeError("Expected the exact Bundle response.");
    expect(bundle.value.revision).toBe(revision);
    expect(bundle.value.bytes).toEqual(new Uint8Array(await readFile(BUNDLE_PATH)));

    const denied = createReferenceHostControlPlaneClient({
      origin: listener.origin,
      apiToken: "wrong-reference-host-token-32-bytes",
      channelName: CHANNEL_NAME,
    });
    expect(await denied.readChannel()).toEqual({ status: "unavailable" });
    expect(await denied.readBundle(revision)).toEqual({ status: "unavailable" });
  });

  it("rejects non-loopback origins and malformed trusted inputs before network work", () => {
    expect(() =>
      createReferenceHostControlPlaneClient({
        origin: "https://desen.app",
        apiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).toThrow("configuration is invalid");
    expect(() =>
      createReferenceHostControlPlaneClient({
        origin: "http://127.0.0.1:4317/path",
        apiToken: API_TOKEN,
        channelName: CHANNEL_NAME,
      }),
    ).toThrow("configuration is invalid");
    expect(() =>
      createReferenceHostControlPlaneClient({
        origin: "http://127.0.0.1:4317",
        apiToken: API_TOKEN,
        channelName: "../preview",
      }),
    ).toThrow("configuration is invalid");
  });

  it("pins the exact official response media type independently for each T05 read route", async () => {
    const origin = "http://127.0.0.1:4317";
    const revision = `sha256:${"a".repeat(64)}`;
    const channelUrl = `${origin}/v1/channels/${CHANNEL_NAME}`;
    const bundleUrl = `${origin}/v1/bundles/${revision}`;
    const client = createReferenceHostControlPlaneClient({
      origin,
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          exactResponse(channelUrl, "application/json; charset=utf-8", '"g:1"', {
            channelName: CHANNEL_NAME,
            generation: 1,
            revision,
          }),
        )
        .mockResolvedValueOnce(
          exactResponse(bundleUrl, "application/json", `"${revision}"`, {
            kind: "desen.bundle",
          }),
        ),
    );
    expect(await client.readChannel()).toMatchObject({ status: "found" });
    expect(await client.readBundle(revision)).toMatchObject({ status: "found" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          exactResponse(channelUrl, "application/json", '"g:1"', {
            channelName: CHANNEL_NAME,
            generation: 1,
            revision,
          }),
        )
        .mockResolvedValueOnce(
          exactResponse(bundleUrl, "application/json; charset=utf-8", `"${revision}"`, {
            kind: "desen.bundle",
          }),
        ),
    );
    expect(await client.readChannel()).toEqual({ status: "unavailable" });
    expect(await client.readBundle(revision)).toEqual({ status: "unavailable" });
  });

  it("cancels an unread response body when exact response identity is rejected", async () => {
    const origin = "http://127.0.0.1:4317";
    const url = `${origin}/v1/channels/${CHANNEL_NAME}`;
    const rejected = rejectingResponse(url);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rejected.response),
    );
    const client = createReferenceHostControlPlaneClient({
      origin,
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });

    expect(await client.readChannel()).toEqual({ status: "unavailable" });
    expect(rejected.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels an unread response body when its declared length is invalid", async () => {
    const origin = "http://127.0.0.1:4317";
    const url = `${origin}/v1/channels/${CHANNEL_NAME}`;
    const rejected = rejectingResponse(url, {
      contentLength: "513",
      contentType: "application/json; charset=utf-8",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rejected.response),
    );
    const client = createReferenceHostControlPlaneClient({
      origin,
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });

    expect(await client.readChannel()).toEqual({ status: "unavailable" });
    expect(rejected.cancel).toHaveBeenCalledTimes(1);
  });

  it("rejects a BOM-prefixed channel body instead of normalizing its framing", async () => {
    const origin = "http://127.0.0.1:4317";
    const url = `${origin}/v1/channels/${CHANNEL_NAME}`;
    const revision = `sha256:${"a".repeat(64)}`;
    const json = new TextEncoder().encode(
      JSON.stringify({ channelName: CHANNEL_NAME, generation: 1, revision }),
    );
    const bytes = new Uint8Array(json.byteLength + 3);
    bytes.set([0xef, 0xbb, 0xbf]);
    bytes.set(json, 3);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => exactByteResponse(url, "application/json; charset=utf-8", '"g:1"', bytes)),
    );
    const client = createReferenceHostControlPlaneClient({
      origin,
      apiToken: API_TOKEN,
      channelName: CHANNEL_NAME,
    });

    expect(await client.readChannel()).toEqual({ status: "unavailable" });
  });
});
