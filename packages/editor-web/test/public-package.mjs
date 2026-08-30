import assert from "node:assert/strict";
import test from "node:test";
import { TextEncoder } from "node:util";

import {
  createLocalDesenBundleChannelPublicationPort,
  createLocalDesenEditorPersistencePort,
  LocalDesenBundleChannelPublicationConfigurationError,
  LocalDesenEditorPersistenceConfigurationError,
} from "@desen/editor-web";
import * as editorWeb from "@desen/editor-web";

const ORIGIN = "http://127.0.0.1:43127";
const API_TOKEN = "public-package-local-editor-token-000001";
const encoder = new TextEncoder();

test("emitted editor-web root has the exact local adapter runtime surface", () => {
  assert.deepEqual(Object.keys(editorWeb).sort(), [
    "LocalDesenBundleChannelPublicationConfigurationError",
    "LocalDesenEditorPersistenceConfigurationError",
    "createLocalDesenBundleChannelPublicationPort",
    "createLocalDesenEditorPersistencePort",
  ]);
});

test("emitted publication port keeps its channel fixed in trusted configuration", async () => {
  const revision = `sha256:${"a".repeat(64)}`;
  const calls = [];
  const responses = [
    {
      status: 404,
      headers: { "content-type": "application/json" },
      body: encoder.encode(
        JSON.stringify({ error: { code: "CHANNEL_NOT_FOUND", message: "Channel not found." } }),
      ),
    },
    {
      status: 201,
      headers: { "content-type": "application/json", etag: `"${revision}"` },
      body: encoder.encode(JSON.stringify({ revision, status: "stored" })),
    },
    {
      status: 201,
      headers: { "content-type": "application/json", etag: '"g:1"' },
      body: encoder.encode(
        JSON.stringify({
          channelName: "preview",
          generation: 1,
          revision,
          status: "created",
        }),
      ),
    },
  ];
  const port = createLocalDesenBundleChannelPublicationPort({
    origin: ORIGIN,
    apiToken: API_TOKEN,
    channelName: "preview",
    fetch: async (request) => {
      calls.push(request);
      const next = responses.shift();
      if (next === undefined) throw new Error("Unexpected publication request.");
      return next;
    },
  });

  assert.deepEqual(
    await port.publishBundleToChannel({
      revision,
      bundleBytes: encoder.encode(JSON.stringify({ revision })),
    }),
    {
      status: "published",
      channelName: "preview",
      revision,
      bundleStatus: "stored",
      channelStatus: "created",
      channelGeneration: 1,
    },
  );
  assert.equal(calls[0].url, `${ORIGIN}/v1/channels/preview`);
  assert.equal(calls[2].headers["if-none-match"], "*");
});

test("emitted local persistence port opens a missing Source through the injected transport", async () => {
  const calls = [];
  const port = createLocalDesenEditorPersistencePort({
    origin: ORIGIN,
    apiToken: API_TOKEN,
    fetch: async (request) => {
      calls.push(request);
      return {
        status: 404,
        headers: { "content-type": "application/json" },
        body: encoder.encode(
          JSON.stringify({ error: { code: "SOURCE_NOT_FOUND", message: "Source not found." } }),
        ),
      };
    },
  });

  assert.deepEqual(await port.openSource("draft"), { status: "missing" });
  assert.deepEqual(calls, [
    {
      method: "GET",
      url: `${ORIGIN}/v1/sources/draft`,
      headers: { authorization: `Bearer ${API_TOKEN}` },
      redirect: "error",
    },
  ]);
});

test("emitted configuration errors remain redacted and stable", () => {
  assert.throws(
    () =>
      createLocalDesenEditorPersistencePort({
        origin: "https://example.com",
        apiToken: API_TOKEN,
        fetch: async () => {
          throw new Error("must not run");
        },
      }),
    (error) => {
      assert.ok(error instanceof LocalDesenEditorPersistenceConfigurationError);
      assert.equal(error.code, "INVALID_ORIGIN");
      assert.equal(error.message, "The local editor persistence origin is invalid.");
      assert.equal(error.message.includes(API_TOKEN), false);
      return true;
    },
  );
  assert.throws(
    () =>
      createLocalDesenBundleChannelPublicationPort({
        origin: ORIGIN,
        apiToken: API_TOKEN,
        channelName: "Preview",
        fetch: async () => {
          throw new Error("must not run");
        },
      }),
    (error) => {
      assert.ok(error instanceof LocalDesenBundleChannelPublicationConfigurationError);
      assert.equal(error.code, "INVALID_CHANNEL_NAME");
      assert.equal(error.message.includes(API_TOKEN), false);
      return true;
    },
  );
});
