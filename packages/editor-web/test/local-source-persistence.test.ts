import { canonicalizeJsonBytes } from "@desen/protocol";
import { createDesenEditorDocument } from "@desen/editor-core";
import { describe, expect, it } from "vitest";

import validSource from "../../protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";

import {
  createLocalDesenEditorPersistencePort,
  LocalDesenEditorPersistenceConfigurationError,
} from "../src/index.js";
import { parseLocalSourceJsonBytes } from "../src/local-source-json.js";

import type {
  LocalDesenEditorPersistenceFetch,
  LocalDesenEditorPersistenceFetchRequest,
  LocalDesenEditorPersistenceFetchResponse,
} from "../src/index.js";

const ORIGIN = "http://127.0.0.1:43127";
const API_TOKEN = "test-only-local-editor-token-00000001";
const encoder = new TextEncoder();

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

function bytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function response(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): LocalDesenEditorPersistenceFetchResponse {
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
): LocalDesenEditorPersistenceFetchResponse {
  return response(status, { error: { code, message: "redacted" } }, headers);
}

function documentFixture() {
  const input = clone(validSource);
  const record = input as Record<string, unknown>;
  record.authoring = {
    selection: { nodeId: "sign-in.email", surfaceId: "sign-in" },
    extensions: { "com.example.editor": { duplicateOrder: ["a", "a", "b"] } },
  };
  record.extensions = {
    "com.example.persisted": {
      unicode: "İstanbul 🌉",
      empty: {},
      nullable: null,
    },
  };
  const admitted = createDesenEditorDocument(input);
  if (!admitted.ok) throw new TypeError("Expected the persistence fixture to be admitted.");
  return admitted.document;
}

function expectDeepFrozen(root: unknown): void {
  const pending = [root];
  const visited = new Set<object>();
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null || visited.has(value)) continue;
    visited.add(value);
    expect(Object.isFrozen(value)).toBe(true);
    pending.push(...Object.values(value));
  }
}

function queueTransport(
  responses: readonly (
    | LocalDesenEditorPersistenceFetchResponse
    | Error
    | ((
        request: LocalDesenEditorPersistenceFetchRequest,
      ) => LocalDesenEditorPersistenceFetchResponse)
  )[],
): {
  readonly calls: LocalDesenEditorPersistenceFetchRequest[];
  readonly fetch: LocalDesenEditorPersistenceFetch;
} {
  const queue = [...responses];
  const calls: LocalDesenEditorPersistenceFetchRequest[] = [];
  const fetch: LocalDesenEditorPersistenceFetch = async (request) => {
    calls.push(request);
    const next = queue.shift();
    if (next === undefined) throw new Error("No queued response.");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(request) : next;
  };
  return { calls, fetch };
}

function portFor(fetch: LocalDesenEditorPersistenceFetch) {
  return createLocalDesenEditorPersistencePort({ origin: ORIGIN, apiToken: API_TOKEN, fetch });
}

describe("parseLocalSourceJsonBytes", () => {
  it("rejects BOMs, escaped-equivalent duplicate names, lone surrogates, and trailing data", () => {
    expect(parseLocalSourceJsonBytes(Uint8Array.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]))).toBe(
      undefined,
    );
    expect(parseLocalSourceJsonBytes(bytes({ safe: true }))).toEqual({ safe: true });
    expect(parseLocalSourceJsonBytes(encoder.encode('{"kind":1,"\\u006bind":2}'))).toBe(undefined);
    expect(parseLocalSourceJsonBytes(encoder.encode('"\\ud800"'))).toBe(undefined);
    expect(parseLocalSourceJsonBytes(encoder.encode("{} true"))).toBe(undefined);
  });

  it("holds the exact nesting and finite number-token boundaries", () => {
    const depth256 = `${"[".repeat(256)}0${"]".repeat(256)}`;
    const depth257 = `[${depth256}]`;
    const number1024 = `0.${"0".repeat(1_022)}`;
    const number1025 = `${number1024}0`;

    expect(parseLocalSourceJsonBytes(encoder.encode(depth256))).toBeDefined();
    expect(parseLocalSourceJsonBytes(encoder.encode(depth257))).toBe(undefined);
    expect(parseLocalSourceJsonBytes(encoder.encode(number1024))).toBe(0);
    expect(parseLocalSourceJsonBytes(encoder.encode(number1025))).toBe(undefined);
  });

  it("holds the exact decoded-string and value-occurrence boundaries", () => {
    const stringAtLimit = `"${"a".repeat(4_194_304)}"`;
    const valuesAtLimit = `[${"null,".repeat(262_142)}null]`;
    const valuesOverLimit = `[${"null,".repeat(262_143)}null]`;

    expect((parseLocalSourceJsonBytes(encoder.encode(stringAtLimit)) as string).length).toBe(
      4_194_304,
    );
    expect(parseLocalSourceJsonBytes(encoder.encode(`${stringAtLimit.slice(0, -1)}a"`))).toBe(
      undefined,
    );
    expect((parseLocalSourceJsonBytes(encoder.encode(valuesAtLimit)) as unknown[]).length).toBe(
      262_143,
    );
    expect(parseLocalSourceJsonBytes(encoder.encode(valuesOverLimit))).toBe(undefined);
  });
});

describe("createLocalDesenEditorPersistencePort", () => {
  it("opens exact local Source bytes through one authenticated no-redirect GET", async () => {
    const source = documentFixture();
    const transport = queueTransport([
      response(200, source, { etag: '"g:7"' }),
      errorResponse(404, "SOURCE_NOT_FOUND"),
    ]);
    const port = portFor(transport.fetch);

    const opened = await port.openSource("draft");
    expect(opened.status).toBe("opened");
    if (opened.status !== "opened") throw new TypeError("Expected the Source to open.");
    expect(opened.generation).toBe(7);
    expect(opened.document).toEqual(source);
    expect(opened.document).not.toBe(source);
    expectDeepFrozen(opened);

    expect(transport.calls[0]).toEqual({
      method: "GET",
      url: `${ORIGIN}/v1/sources/draft`,
      headers: { authorization: `Bearer ${API_TOKEN}` },
      redirect: "error",
    });
    expect(await port.openSource("missing")).toEqual({ status: "missing" });
  });

  it("rejects malformed UTF-8, duplicate members, invalid media, and invalid ETags", async () => {
    const sourceText = JSON.stringify(documentFixture());
    const duplicate = encoder.encode(
      sourceText.replace('"kind":"desen.source"', '"kind":"desen.source","kind":"desen.source"'),
    );
    const transport = queueTransport([
      response(200, Uint8Array.from([0xff]), { etag: '"g:1"' }),
      response(200, duplicate, { etag: '"g:1"' }),
      {
        status: 200,
        headers: { "content-type": "text/plain", etag: '"g:1"' },
        body: encoder.encode(sourceText),
      },
      response(200, documentFixture(), { etag: '"g:0"' }),
    ]);
    const port = portFor(transport.fetch);

    for (const key of ["bad-utf8", "duplicate", "media", "etag"]) {
      const result = await port.openSource(key);
      expect(result.status).toBe("failed");
      if (result.status !== "failed") throw new TypeError("Expected a controlled open failure.");
      expect(result.diagnostic.code).toBe("run.desen.editor/PERSISTENCE_SOURCE_INVALID");
    }
  });

  it("captures prototype-sensitive response headers as inert own data", async () => {
    const headers = Object.create(null) as Record<string, string>;
    headers["content-type"] = "application/json";
    headers.etag = '"g:1"';
    headers.__proto__ = "inert-header";
    const transport = queueTransport([
      {
        status: 200,
        headers,
        body: bytes(documentFixture()),
      },
    ]);

    const result = await portFor(transport.fetch).openSource("draft");
    expect(result.status).toBe("opened");
    expect(Object.getPrototypeOf(headers)).toBeNull();
    expect(Object.hasOwn(headers, "__proto__")).toBe(true);
  });

  it("maps create, update, unchanged, conflict, and generation exhaustion exactly", async () => {
    const source = documentFixture();
    const maximum = Number.MAX_SAFE_INTEGER;
    const transport = queueTransport([
      response(201, { generation: 1, sourceKey: "draft", status: "created" }, { etag: '"g:1"' }),
      response(200, { generation: 2, sourceKey: "draft", status: "updated" }, { etag: '"g:2"' }),
      response(200, { generation: 2, sourceKey: "draft", status: "unchanged" }, { etag: '"g:2"' }),
      errorResponse(412, "GENERATION_MISMATCH", { etag: '"g:3"' }),
      errorResponse(409, "GENERATION_EXHAUSTED", { etag: `"g:${String(maximum)}"` }),
    ]);
    const port = portFor(transport.fetch);

    expect(
      await port.saveSource({ sourceKey: "draft", expectedGeneration: null, document: source }),
    ).toEqual({ status: "created", generation: 1 });
    expect(
      await port.saveSource({ sourceKey: "draft", expectedGeneration: 1, document: source }),
    ).toEqual({ status: "updated", generation: 2 });
    expect(
      await port.saveSource({ sourceKey: "draft", expectedGeneration: 2, document: source }),
    ).toEqual({ status: "unchanged", generation: 2 });
    expect(
      await port.saveSource({ sourceKey: "draft", expectedGeneration: 2, document: source }),
    ).toEqual({ status: "conflict", currentGeneration: 3 });
    expect(
      await port.saveSource({ sourceKey: "draft", expectedGeneration: maximum, document: source }),
    ).toEqual({ status: "generation-exhausted", generation: maximum });

    const createRequest = transport.calls[0];
    expect(createRequest?.method).toBe("PUT");
    expect(createRequest?.headers).toEqual({
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": "application/json",
      "if-none-match": "*",
    });
    expect(createRequest?.redirect).toBe("error");
    expect(createRequest?.body).toEqual(canonicalizeJsonBytes(source));
    expect(transport.calls[1]?.headers["if-match"]).toBe('"g:1"');
  });

  it("keeps read failure definite and every lost or malformed PUT response indeterminate", async () => {
    const source = documentFixture();
    const readTransport = queueTransport([new Error("secret read failure")]);
    const read = await portFor(readTransport.fetch).openSource("draft");
    expect(read.status).toBe("failed");
    if (read.status !== "failed") throw new TypeError("Expected a controlled read failure.");
    expect(read.diagnostic.code).toBe("run.desen.editor/PERSISTENCE_STORAGE_UNAVAILABLE");
    expect(read.diagnostic.message).not.toContain("secret");

    const writeTransport = queueTransport([
      new Error("response lost after put"),
      { status: 200, headers: {}, body: new Uint8Array() },
      errorResponse(503, "COMMIT_OUTCOME_INDETERMINATE"),
    ]);
    const port = portFor(writeTransport.fetch);
    for (const generation of [1, 2, 3]) {
      const result = await port.saveSource({
        sourceKey: "draft",
        expectedGeneration: generation,
        document: source,
      });
      expect(result.status).toBe("indeterminate");
    }
    expect(writeTransport.calls).toHaveLength(3);
  });

  it("maps redacted local failures without retries or storage detail", async () => {
    const source = documentFixture();
    const transport = queueTransport([
      errorResponse(401, "AUTHENTICATION_REQUIRED"),
      errorResponse(413, "SOURCE_MATERIAL_LIMIT_EXCEEDED"),
      errorResponse(503, "METADATA_BUSY"),
      errorResponse(400, "SOURCE_SCHEMA_INVALID"),
    ]);
    const port = portFor(transport.fetch);
    const expected = [
      "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED",
      "run.desen.editor/PERSISTENCE_SOURCE_LIMIT_EXCEEDED",
      "run.desen.editor/PERSISTENCE_STORAGE_BUSY",
      "run.desen.editor/PERSISTENCE_SOURCE_INVALID",
    ];
    for (const code of expected) {
      const result = await port.saveSource({
        sourceKey: "draft",
        expectedGeneration: 1,
        document: source,
      });
      expect(result.status).toBe("failed");
      if (result.status !== "failed") throw new TypeError("Expected a definite local failure.");
      expect(result.diagnostic.code).toBe(code);
    }
    expect(transport.calls).toHaveLength(expected.length);
  });

  it("treats every PUT failure that may follow a durable commit as indeterminate", async () => {
    const source = documentFixture();
    const transport = queueTransport([
      errorResponse(500, "STORAGE_IO_FAILURE"),
      errorResponse(500, "UNSAFE_STORAGE_PATH"),
      errorResponse(500, "METADATA_CORRUPT"),
      errorResponse(500, "INTERNAL_FAILURE"),
      errorResponse(200, "AUTHENTICATION_REQUIRED"),
      errorResponse(401, "SOURCE_SCHEMA_INVALID"),
      errorResponse(500, "METADATA_BUSY"),
    ]);
    const port = portFor(transport.fetch);

    for (const generation of [1, 2, 3, 4, 5, 6, 7]) {
      const result = await port.saveSource({
        sourceKey: "draft",
        expectedGeneration: generation,
        document: source,
      });
      expect(result.status).toBe("indeterminate");
      if (result.status !== "indeterminate") {
        throw new TypeError("Expected an uncertain post-dispatch outcome.");
      }
      expect(result.diagnostic.code).toBe("run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE");
    }
    expect(transport.calls).toHaveLength(7);
  });

  it("rejects non-loopback origins, weak tokens, implicit fetch, and active option shapes", () => {
    const fetch = queueTransport([]).fetch;
    const invalid = [
      { origin: "https://127.0.0.1:43127", apiToken: API_TOKEN, fetch },
      { origin: "http://localhost:43127", apiToken: API_TOKEN, fetch },
      { origin: ORIGIN, apiToken: "short", fetch },
      { origin: ORIGIN, apiToken: API_TOKEN, fetch: undefined },
      { origin: ORIGIN, apiToken: API_TOKEN, fetch, extra: true },
      Object.defineProperty({ origin: ORIGIN, apiToken: API_TOKEN }, "fetch", {
        enumerable: true,
        get() {
          throw new Error("must not escape");
        },
      }),
    ];

    for (const options of invalid) {
      expect(() => createLocalDesenEditorPersistencePort(options as never)).toThrow(
        LocalDesenEditorPersistenceConfigurationError,
      );
    }
  });

  it("accepts the canonical explicit default HTTP port returned by a local listener", async () => {
    const transport = queueTransport([errorResponse(404, "SOURCE_NOT_FOUND")]);
    const port = createLocalDesenEditorPersistencePort({
      origin: "http://127.0.0.1:80",
      apiToken: API_TOKEN,
      fetch: transport.fetch,
    });

    await expect(port.openSource("draft")).resolves.toEqual({ status: "missing" });
    expect(transport.calls[0]?.url).toBe("http://127.0.0.1:80/v1/sources/draft");
  });
});
