import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const LOOPBACK = "127.0.0.1";
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const ENDPOINT = "/api/sign-in";
const MAX_REQUEST_BYTES = 16_384;
const MAX_REQUEST_CHUNKS = 1_024;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const JSON_STRING = '"(?:[^"\\\\\\u0000-\\u001f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
const CREDENTIALS_BODY = new RegExp(
  `^\\s*\\{\\s*"(email|password)"\\s*:\\s*(${JSON_STRING})\\s*,\\s*"(email|password)"\\s*:\\s*(${JSON_STRING})\\s*\\}\\s*$`,
  "u",
);
const PRIVATE_FAILURE = Object.freeze({ error: { code: "LOCAL_OPERATION_UNAVAILABLE" } });

/** A controlled local-service error without listener, token, request or underlying error data. */
export class DesenAppLocalOperationHostError extends Error {
  /** Creates one redacted local-operation service failure. */
  constructor() {
    super("The local reference operation service is unavailable.");
    this.name = "DesenAppLocalOperationHostError";
  }
}

/**
 * @param {unknown} value
 * @returns {Readonly<{apiToken: string; allowedOrigin: string}>}
 */
function captureOptions(value) {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw new DesenAppLocalOperationHostError();
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("apiToken") || !keys.includes("allowedOrigin")) {
      throw new DesenAppLocalOperationHostError();
    }
    const token = Object.getOwnPropertyDescriptor(value, "apiToken");
    const origin = Object.getOwnPropertyDescriptor(value, "allowedOrigin");
    if (
      token?.enumerable !== true ||
      !("value" in token) ||
      origin?.enumerable !== true ||
      !("value" in origin) ||
      typeof token.value !== "string" ||
      token.value.length < 32 ||
      token.value.length > 256 ||
      !/^[\x21-\x7e]+$/u.test(token.value) ||
      typeof origin.value !== "string"
    ) {
      throw new DesenAppLocalOperationHostError();
    }
    const match = LOOPBACK_ORIGIN.exec(origin.value);
    const port = match === null ? Number.NaN : Number(match[1]);
    if (
      !Number.isSafeInteger(port) ||
      port < 1 ||
      port > 65_535 ||
      new URL(origin.value).origin !== origin.value
    ) {
      throw new DesenAppLocalOperationHostError();
    }
    return Object.freeze({ apiToken: token.value, allowedOrigin: origin.value });
  } catch {
    throw new DesenAppLocalOperationHostError();
  }
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @returns {boolean}
 */
function uniqueRequestHeaders(request) {
  if (request.rawHeaders.length > 128) return false;
  const seen = new Set();
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    const name = request.rawHeaders[index]?.toLowerCase();
    if (name === undefined || seen.has(name)) return false;
    seen.add(name);
  }
  return true;
}

/**
 * @param {unknown} value
 * @param {Buffer} expected
 * @returns {boolean}
 */
function authorized(value, expected) {
  if (typeof value !== "string" || value.length !== expected.length) return false;
  const candidate = Buffer.from(value, "utf8");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<Readonly<{ok: true; body: string}> | Readonly<{ok: false; status: number}>>}
 */
function readBoundedBody(request) {
  return new Promise((resolve) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let length = 0;
    let settled = false;
    const finish = (
      /** @type {Readonly<{ok: true; body: string}> | Readonly<{ok: false; status: number}>} */ result,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      request.removeListener("data", onData);
      request.removeListener("end", onEnd);
      request.removeListener("aborted", onAbort);
      request.removeListener("error", onAbort);
      resolve(result);
    };
    const onAbort = () => finish(Object.freeze({ ok: false, status: 400 }));
    const onData = (/** @type {Buffer} */ chunk) => {
      length += chunk.length;
      if (length > MAX_REQUEST_BYTES || chunks.length >= MAX_REQUEST_CHUNKS) {
        finish(Object.freeze({ ok: false, status: 413 }));
        request.resume();
        return;
      }
      chunks.push(Buffer.from(chunk));
    };
    const onEnd = () => {
      try {
        const body = new TextDecoder("utf-8", { fatal: true }).decode(
          Buffer.concat(chunks, length),
        );
        finish(Object.freeze({ ok: true, body }));
      } catch {
        finish(Object.freeze({ ok: false, status: 400 }));
      }
    };
    const timeout = setTimeout(
      () => finish(Object.freeze({ ok: false, status: 408 })),
      REQUEST_TIMEOUT_MILLISECONDS,
    );
    timeout.unref();
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("aborted", onAbort);
    request.once("error", onAbort);
  });
}

/**
 * Parses the closed two-string wire profile without accepting duplicate or extra JSON members.
 *
 * @param {string} body
 * @returns {Readonly<{email: string; password: string}> | undefined}
 */
function captureCredentials(body) {
  const match = CREDENTIALS_BODY.exec(body);
  if (match === null || match[1] === match[3]) return undefined;
  try {
    const first = JSON.parse(match[2] ?? "null");
    const second = JSON.parse(match[4] ?? "null");
    const email = match[1] === "email" ? first : second;
    const password = match[1] === "password" ? first : second;
    if (
      typeof email !== "string" ||
      email.length > 4_096 ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 4_096
    ) {
      return undefined;
    }
    return Object.freeze({ email, password });
  } catch {
    return undefined;
  }
}

/**
 * @typedef {Readonly<{
 *   listen: (port: 0) => Promise<Readonly<{address: "127.0.0.1"; port: number; origin: string}>>;
 *   close: () => Promise<void>;
 * }>} DesenAppLocalOperationHost
 */

/**
 * Opens one bounded, fixed-loopback reference operation host without starting a listener.
 *
 * @remarks This opt-in local integration uses the explicitly documented test-only account
 * `designer@example.test` / `local-demo-pass`; it is not production authentication. The separate
 * launcher-lifetime bearer authenticates the editor, not the test account. No request, token,
 * password, output, or underlying error is logged or persisted. Source data cannot choose this
 * handler or endpoint; only trusted application composition injects its listener authority.
 *
 * @param {Readonly<{apiToken: string; allowedOrigin: string}>} options Exact trusted local authority.
 * @returns {Promise<DesenAppLocalOperationHost>} Idempotently revocable listener capability.
 */
export async function openDesenAppLocalOperationHost(options) {
  const { apiToken, allowedOrigin: editorOrigin } = captureOptions(options);
  const expectedAuthorization = Buffer.from(`Bearer ${apiToken}`, "utf8");
  let closed = false;
  /** @type {Readonly<{address: "127.0.0.1"; port: number; origin: string}> | undefined} */
  let listener;
  /** @type {Promise<Readonly<{address: "127.0.0.1"; port: number; origin: string}>> | undefined} */
  let listenPromise;
  /** @type {Promise<void> | undefined} */
  let closePromise;

  const server = createServer(
    {
      maxHeaderSize: 8_192,
      headersTimeout: REQUEST_TIMEOUT_MILLISECONDS,
      requestTimeout: REQUEST_TIMEOUT_MILLISECONDS,
    },
    (request, response) => {
      const allowedOrigin = request.headers.origin === editorOrigin;
      request.on("error", () => undefined);
      const respond = (
        /** @type {number} */ status,
        /** @type {unknown} */ body = PRIVATE_FAILURE,
      ) => {
        if (response.destroyed || response.writableEnded) return;
        response.statusCode = status;
        response.setHeader("cache-control", "no-store");
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("x-content-type-options", "nosniff");
        response.setHeader("connection", "close");
        response.setHeader("vary", "Origin");
        if (allowedOrigin) response.setHeader("access-control-allow-origin", editorOrigin);
        if (status === 204) {
          response.setHeader("access-control-allow-methods", "POST");
          response.setHeader("access-control-allow-headers", "authorization, content-type");
          response.end();
        } else {
          response.end(JSON.stringify(body));
        }
      };
      const handle = async () => {
        if (
          closed ||
          listener === undefined ||
          !uniqueRequestHeaders(request) ||
          !allowedOrigin ||
          request.headers.host !== `${LOOPBACK}:${listener.port}` ||
          request.headers.cookie !== undefined
        ) {
          respond(403);
          return;
        }
        if (request.url !== ENDPOINT) {
          respond(404);
          return;
        }
        if (request.method === "OPTIONS") {
          const headers = request.headers["access-control-request-headers"];
          const names =
            typeof headers === "string"
              ? headers
                  .toLowerCase()
                  .split(",")
                  .map((name) => name.trim())
                  .sort()
              : [];
          respond(
            request.headers["access-control-request-method"] === "POST" &&
              names.join(",") === "authorization,content-type"
              ? 204
              : 403,
          );
          return;
        }
        if (request.method !== "POST") {
          respond(405);
          return;
        }
        if (!authorized(request.headers.authorization, expectedAuthorization)) {
          respond(403);
          return;
        }
        if (
          request.headers["content-encoding"] !== undefined ||
          typeof request.headers["content-type"] !== "string" ||
          !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers["content-type"])
        ) {
          respond(415);
          return;
        }
        const declaredLength = request.headers["content-length"];
        if (
          declaredLength !== undefined &&
          (!/^(?:0|[1-9][0-9]*)$/u.test(declaredLength) ||
            Number(declaredLength) > MAX_REQUEST_BYTES)
        ) {
          respond(413);
          return;
        }
        const result = await readBoundedBody(request);
        if (closed || response.destroyed) return;
        if (!result.ok) {
          respond(result.status);
          return;
        }
        const input = captureCredentials(result.body);
        if (input === undefined) {
          respond(400);
          return;
        }
        if (input.email !== "designer@example.test" || input.password !== "local-demo-pass") {
          respond(401, { error: { code: "invalidCredentials" } });
          return;
        }
        respond(200, { userId: "local-host-user" });
      };
      void handle().catch(() => respond(503));
    },
  );
  server.maxConnections = 32;
  server.setTimeout(REQUEST_TIMEOUT_MILLISECONDS, (socket) => socket.destroy());
  server.on("clientError", (_error, socket) => {
    socket.destroy();
  });

  const listen = (/** @type {0} */ port) => {
    if (closed || port !== 0) return Promise.reject(new DesenAppLocalOperationHostError());
    listenPromise ??= new Promise((resolve, reject) => {
      const onError = () => reject(new DesenAppLocalOperationHostError());
      server.once("error", onError);
      server.listen({ host: LOOPBACK, port: 0, exclusive: true }, () => {
        server.removeListener("error", onError);
        const address = server.address();
        if (
          closed ||
          address === null ||
          typeof address === "string" ||
          address.address !== LOOPBACK
        ) {
          reject(new DesenAppLocalOperationHostError());
          return;
        }
        listener = Object.freeze({
          address: LOOPBACK,
          port: address.port,
          origin: `http://${LOOPBACK}:${address.port}`,
        });
        resolve(listener);
      });
    });
    return listenPromise;
  };
  const close = () => {
    closed = true;
    closePromise ??= (async () => {
      await listenPromise?.catch(() => undefined);
      try {
        if (!server.listening) return;
        await new Promise((resolve, reject) => {
          server.close((error) =>
            error === undefined
              ? resolve(undefined)
              : reject(new DesenAppLocalOperationHostError()),
          );
          server.closeAllConnections();
        });
      } finally {
        listener = undefined;
        expectedAuthorization.fill(0);
      }
    })();
    return closePromise;
  };
  return Object.freeze({ listen, close });
}
