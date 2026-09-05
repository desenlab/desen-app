import { createRequire } from "node:module";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import type { FastifyReply, FastifyRequest } from "fastify";

interface UriComponents {
  readonly scheme?: string;
  readonly host?: string;
  readonly port?: string | number;
  readonly path?: string;
  readonly error?: string;
}

interface UriApi {
  parse(input: string): UriComponents;
  normalize(input: string): string;
  serialize(input: UriComponents): string;
  resolve(base: string, reference: string): string;
  equal(left: string, right: string): boolean;
}

const requireFromTest = createRequire(import.meta.url);
const requireFromFastify = createRequire(requireFromTest.resolve("fastify"));
const requireFromCompiler = createRequire(requireFromFastify.resolve("@fastify/ajv-compiler"));
const requireFromAjv = createRequire(requireFromCompiler.resolve("ajv"));
const requireFromSerializer = createRequire(requireFromFastify.resolve("fast-json-stringify"));

// Resolve each consumer's installed dependency; a root-only probe could miss the second major.
const uriGraphs = [
  { consumer: "Fastify schema compiler", consumerRequire: requireFromCompiler },
  { consumer: "Ajv", consumerRequire: requireFromAjv },
  { consumer: "Fastify response serializer", consumerRequire: requireFromSerializer },
].map(({ consumer, consumerRequire }) => {
  const entry = consumerRequire.resolve("fast-uri");
  return { consumer, uri: consumerRequire(entry) as UriApi };
});

describe.each(uriGraphs)("SEC-01 installed fast-uri for $consumer", ({ uri }) => {
  it.each([
    ["encoded scheme delimiters", "%2f%2fevil.example:/pwn", "URI scheme is malformed."],
    ["legacy encoded scheme", "%u002f%u002fevil.example:/pwn", "URI scheme is malformed."],
    [
      "scheme control characters",
      "%0d%0aSet-Cookie:%20sid=attacker:/p",
      "URI scheme is malformed.",
    ],
    ["invalid IPv6 suffix", "http://[::not-valid]/private", "URI host is malformed."],
    ["unclosed host bracket", "http://[fe80", "URI host is malformed."],
    ["bracket authority confusion", "http://user@[@127.0.0.1:8123/admin", "URI host is malformed."],
  ])("rejects %s without rewriting it into an admitted URI", (_label, input, error) => {
    expect(uri.parse(input).error).toBe(error);
    expect(uri.normalize(input)).toBe(input);
    expect(uri.equal(input, input)).toBe(false);
    expect(() => uri.resolve("https://trusted.example/", input)).toThrow(error);
  });

  it("rejects authority injection through a component port", () => {
    expect(() =>
      uri.serialize({
        scheme: "http",
        host: "trusted.example",
        port: "@127.0.0.1:8124",
        path: "/app",
      }),
    ).toThrow(/port/i);
  });

  it("canonicalizes a scheme-relative international host before producing a URL", () => {
    const resolved = uri.resolve("https://trusted.example/base", "//ｅxample.com/path");
    expect(resolved).toBe("https://example.com/path");
    expect(uri.parse(resolved).host).toBe(new URL(resolved).hostname);
  });

  it("does not decode nested hostname escapes into a different destination", () => {
    const encodedLocalhost = "http://%256c%256f%2563%2561%256c%2568%256f%2573%2574/";
    expect(uri.normalize(encodedLocalhost)).toBe(encodedLocalhost);
    expect(uri.equal(encodedLocalhost, "http://localhost/")).toBe(false);
    expect(uri.resolve("https://trusted.example/base", "//127%252e0%252e0%252e1/private")).toBe(
      "https://127%252e0%252e0%252e1/private",
    );
  });

  it("decodes current unreserved hostname escapes while preserving encoded percent signs", () => {
    expect(uri.normalize("x://%65xample.com/")).toBe("x://example.com/");
    expect(uri.normalize("x://%2565xample.com/")).toBe("x://%2565xample.com/");
    expect(uri.serialize({ scheme: "x", host: "%2565xample.com", path: "/" })).toBe(
      "x://%2565xample.com/",
    );
  });

  it("preserves valid local references, numeric ports, and IPv6 addresses", () => {
    expect(uri.resolve("https://trusted.example/schema", "#/$defs/value")).toBe(
      "https://trusted.example/schema#/$defs/value",
    );
    expect(uri.serialize({ scheme: "http", host: "127.0.0.1", port: 4177, path: "/app" })).toBe(
      "http://127.0.0.1:4177/app",
    );
    expect(uri.parse("http://[2001:db8::1]/").error).toBeUndefined();
    expect(uri.normalize("http://[2001:db8::1]/")).toBe("http://[2001:db8::1]/");
  });
});

describe("SEC-01 installed Fastify security regressions", () => {
  it.each([false, 1])(
    "does not trust spoofed forwarding headers with trustProxy=%s",
    async (trustProxy) => {
      // The removed numeric form remains a runtime input from untyped callers and must fail closed.
      const app = Fastify({ trustProxy: trustProxy as false });
      try {
        app.get("/identity", async (request) => ({
          ip: request.ip,
          host: request.host,
          protocol: request.protocol,
        }));
        const response = await app.inject({
          method: "GET",
          url: "/identity",
          remoteAddress: "203.0.113.7",
          headers: {
            host: "trusted.example",
            "x-forwarded-for": "192.0.2.123",
            "x-forwarded-host": "attacker.example",
            "x-forwarded-proto": "https",
          },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          ip: "203.0.113.7",
          host: "trusted.example",
          protocol: "http",
        });
      } finally {
        await app.close();
      }
    },
  );

  it("delivers the validated root primitive and rejects values outside its bounds", async () => {
    const app = Fastify();
    let handlerCalls = 0;
    try {
      app.post(
        "/number",
        { schema: { body: { type: "integer", minimum: 1, maximum: 10 } } },
        async (request) => {
          handlerCalls += 1;
          return { value: request.body, type: typeof request.body };
        },
      );
      const accepted = await app.inject({
        method: "POST",
        url: "/number",
        headers: { "content-type": "application/json" },
        payload: '"10"',
      });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toEqual({ value: 10, type: "number" });
      const rejected = await app.inject({
        method: "POST",
        url: "/number",
        headers: { "content-type": "application/json" },
        payload: '"11"',
      });
      expect(rejected.statusCode).toBe(400);
      expect(handlerCalls).toBe(1);
    } finally {
      await app.close();
    }
  });

  it("enforces canonical-case header dependencies", async () => {
    const app = Fastify();
    let handlerCalls = 0;
    try {
      app.get(
        "/headers",
        {
          schema: {
            headers: {
              type: "object",
              properties: {
                "X-Action": { type: "string" },
                "X-Action-Token": { const: "test-token" },
              },
              dependencies: { "X-Action": ["X-Action-Token"] },
            },
          },
        },
        async () => {
          handlerCalls += 1;
          return { accepted: true };
        },
      );
      expect(
        (await app.inject({ url: "/headers", headers: { "X-Action": "write" } })).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            url: "/headers",
            headers: { "X-Action": "write", "X-Action-Token": "wrong" },
          })
        ).statusCode,
      ).toBe(400);
      expect(handlerCalls).toBe(0);
      expect(
        (
          await app.inject({
            url: "/headers",
            headers: { "X-Action": "write", "X-Action-Token": "test-token" },
          })
        ).statusCode,
      ).toBe(200);
      expect(handlerCalls).toBe(1);
    } finally {
      await app.close();
    }
  });

  it.each(["body", "querystring", "query", "params", "headers"] as const)(
    "enforces boolean false for the %s schema",
    async (part) => {
      const app = Fastify();
      let handlerCalls = 0;
      try {
        app.post("/deny/:id", { schema: { [part]: false } }, async () => {
          handlerCalls += 1;
          return { accepted: true };
        });
        const rejected = await app.inject({
          method: "POST",
          url: "/deny/item?value=1",
          payload: { value: 1 },
        });
        expect(rejected.statusCode).toBe(400);
        expect(handlerCalls).toBe(0);
      } finally {
        await app.close();
      }
    },
  );

  it("does not unwrap attacker-owned value or error keys after async validation", async () => {
    const app = Fastify();
    try {
      app.post(
        "/async",
        {
          schema: {
            body: {
              $async: true,
              type: "object",
              additionalProperties: false,
              required: ["action", "value", "error"],
              properties: {
                action: { const: "read" },
                value: { type: "object" },
                error: { type: "string" },
              },
            },
          },
        },
        async (request) => request.body,
      );
      const body = { action: "read", value: { action: "write" }, error: "caller-data" };
      const accepted = await app.inject({ method: "POST", url: "/async", payload: body });
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toEqual(body);
      expect(
        (await app.inject({ method: "POST", url: "/async", payload: { ...body, action: "write" } }))
          .statusCode,
      ).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("rejects malformed URLs before another plugin's protected fallback can run", async () => {
    const app = Fastify();
    let privateHandlerCalls = 0;
    try {
      app.register(
        async (publicApp) => {
          publicApp.setNotFoundHandler((_request, reply) => reply.send({ public: true }));
        },
        { prefix: "/public" },
      );
      app.register(
        async (privateApp) => {
          privateApp.setNotFoundHandler(
            {
              preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
                if (request.headers.authorization !== "Bearer test-token")
                  return reply.code(401).send({ error: "unauthorized" });
              },
            },
            (_request: FastifyRequest, reply: FastifyReply) => {
              privateHandlerCalls += 1;
              return reply.send({ private: true });
            },
          );
        },
        { prefix: "/private" },
      );
      expect((await app.inject({ method: "DELETE", url: "/public/%c0" })).statusCode).toBe(400);
      expect((await app.inject({ method: "DELETE", url: "/private/missing" })).statusCode).toBe(
        401,
      );
      expect(privateHandlerCalls).toBe(0);
      expect(
        (
          await app.inject({
            method: "DELETE",
            url: "/private/missing",
            headers: { authorization: "Bearer test-token" },
          })
        ).statusCode,
      ).toBe(200);
      expect(privateHandlerCalls).toBe(1);
    } finally {
      await app.close();
    }
  });
});
