import assert from "node:assert/strict";
import test from "node:test";
import { TextEncoder } from "node:util";

import {
  createLocalDesenEditorPersistencePort,
  LocalDesenEditorPersistenceConfigurationError,
} from "@desen/editor-web";
import * as editorWeb from "@desen/editor-web";

const ORIGIN = "http://127.0.0.1:43127";
const API_TOKEN = "public-package-local-editor-token-000001";
const encoder = new TextEncoder();

test("emitted editor-web root has the exact M08-T08 runtime surface", () => {
  assert.deepEqual(Object.keys(editorWeb).sort(), [
    "LocalDesenEditorPersistenceConfigurationError",
    "createLocalDesenEditorPersistencePort",
  ]);
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
});
