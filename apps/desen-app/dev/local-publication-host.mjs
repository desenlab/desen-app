import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const LOOPBACK = "127.0.0.1";
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const ENDPOINT = "/v1/activate-published-revision";
const MAX_REQUEST_BYTES = 16_384;
const MAX_REQUEST_CHUNKS = 1_024;
const REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAX_DESTINATION_LENGTH = 512;
const REVISION = /^sha256:[0-9a-f]{64}$/u;
const JSON_WHITESPACE = "[\\x20\\t\\r\\n]*";
const JSON_STRING = '"(?:[^"\\\\\\u0000-\\u001f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
const JSON_INTEGER = "(?:0|[1-9][0-9]*)";
const REQUEST_MEMBER = `"(channelName|channelGeneration|hostId|revision)"${JSON_WHITESPACE}:${JSON_WHITESPACE}(${JSON_STRING}|${JSON_INTEGER})`;
const REQUEST_BODY = new RegExp(
  `^${JSON_WHITESPACE}\\{${JSON_WHITESPACE}${REQUEST_MEMBER}${JSON_WHITESPACE},${JSON_WHITESPACE}${REQUEST_MEMBER}${JSON_WHITESPACE},${JSON_WHITESPACE}${REQUEST_MEMBER}${JSON_WHITESPACE},${JSON_WHITESPACE}${REQUEST_MEMBER}${JSON_WHITESPACE}\\}${JSON_WHITESPACE}$`,
  "u",
);
const PRIVATE_FAILURE = Object.freeze({ error: { code: "LOCAL_PUBLICATION_UNAVAILABLE" } });
const INDETERMINATE = Object.freeze({ status: "indeterminate" });
const OPTION_KEYS = Object.freeze([
  "activatePublishedRevision",
  "allowedOrigin",
  "apiToken",
  "channelName",
  "hostId",
]);
const REQUEST_KEYS = Object.freeze(["channelGeneration", "channelName", "hostId", "revision"]);

/** A controlled local-publication failure without listener, token, request, or callback data. */
export class DesenAppLocalPublicationHostError extends Error {
  /** Creates one fixed and redacted local-publication service failure. */
  constructor() {
    super("The local publication activation service is unavailable.");
    this.name = "DesenAppLocalPublicationHostError";
  }
}

/**
 * Captures an exact ordinary object without invoking accessors or retaining the caller's object.
 *
 * @param {unknown} value
 * @param {readonly string[]} keys
 * @returns {Readonly<Record<string, unknown>> | undefined}
 */
function exactOwnData(value, keys) {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return undefined;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const captured = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

/**
 * @param {unknown} value
 * @returns {Readonly<{
 *   apiToken: string;
 *   allowedOrigin: string;
 *   channelName: string;
 *   hostId: string;
 *   activatePublishedRevision: (request: Readonly<{
 *     channelName: string;
 *     channelGeneration: number;
 *     hostId: string;
 *     revision: string;
 *   }>) => unknown;
 * }>}
 */
function captureOptions(value) {
  const captured = exactOwnData(value, OPTION_KEYS);
  try {
    const match =
      typeof captured?.allowedOrigin === "string"
        ? LOOPBACK_ORIGIN.exec(captured.allowedOrigin)
        : null;
    const port = match === null ? Number.NaN : Number(match[1]);
    if (
      typeof captured?.apiToken !== "string" ||
      captured.apiToken.length < 32 ||
      captured.apiToken.length > 256 ||
      !/^[\x21-\x7e]+$/u.test(captured.apiToken) ||
      typeof captured.allowedOrigin !== "string" ||
      !Number.isSafeInteger(port) ||
      port < 1 ||
      port > 65_535 ||
      new URL(captured.allowedOrigin).origin !== captured.allowedOrigin ||
      typeof captured.channelName !== "string" ||
      captured.channelName.length === 0 ||
      captured.channelName.length > MAX_DESTINATION_LENGTH ||
      typeof captured.hostId !== "string" ||
      captured.hostId.length === 0 ||
      captured.hostId.length > MAX_DESTINATION_LENGTH ||
      typeof captured.activatePublishedRevision !== "function"
    ) {
      throw new DesenAppLocalPublicationHostError();
    }
    return Object.freeze({
      apiToken: captured.apiToken,
      allowedOrigin: captured.allowedOrigin,
      channelName: captured.channelName,
      hostId: captured.hostId,
      activatePublishedRevision:
        /** @type {(request: Readonly<{
         *   channelName: string;
         *   channelGeneration: number;
         *   hostId: string;
         *   revision: string;
         * }>) => unknown} */ (captured.activatePublishedRevision),
    });
  } catch {
    throw new DesenAppLocalPublicationHostError();
  }
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @returns {boolean}
 */
function uniqueRequestHeaders(request) {
  if (request.rawHeaders.length > 128 || request.rawHeaders.length % 2 !== 0) return false;
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
 * Parses the closed activation wire profile without accepting duplicate, encoded, or extra keys.
 *
 * @param {string} body
 * @returns {Readonly<{
 *   channelName: string;
 *   channelGeneration: number;
 *   hostId: string;
 *   revision: string;
 * }> | undefined}
 */
function captureActivationRequest(body) {
  const match = REQUEST_BODY.exec(body);
  if (match === null) return undefined;
  /** @type {Record<string, unknown>} */
  const values = Object.create(null);
  try {
    for (let index = 1; index < match.length; index += 2) {
      const key = match[index];
      if (key === undefined || Object.hasOwn(values, key)) return undefined;
      values[key] = JSON.parse(match[index + 1] ?? "null");
    }
  } catch {
    return undefined;
  }
  if (
    Object.keys(values).length !== REQUEST_KEYS.length ||
    REQUEST_KEYS.some((key) => !Object.hasOwn(values, key)) ||
    typeof values.channelName !== "string" ||
    typeof values.channelGeneration !== "number" ||
    !Number.isSafeInteger(values.channelGeneration) ||
    values.channelGeneration <= 0 ||
    typeof values.hostId !== "string" ||
    typeof values.revision !== "string" ||
    !REVISION.test(values.revision)
  ) {
    return undefined;
  }
  return Object.freeze({
    channelName: values.channelName,
    channelGeneration: values.channelGeneration,
    hostId: values.hostId,
    revision: values.revision,
  });
}

/**
 * Projects a trusted callback result into the exact public host-activation settlement union.
 *
 * @param {unknown} value
 * @returns {Readonly<Record<string, unknown>> | undefined}
 */
function captureActivationSettlement(value) {
  const active = exactOwnData(value, [
    "activationGeneration",
    "activeRevision",
    "relationship",
    "status",
  ]);
  if (
    active?.status === "active" &&
    (active.relationship === "activated" ||
      active.relationship === "preserved" ||
      active.relationship === "recovered") &&
    typeof active.activeRevision === "string" &&
    REVISION.test(active.activeRevision) &&
    typeof active.activationGeneration === "number" &&
    Number.isSafeInteger(active.activationGeneration) &&
    active.activationGeneration >= 0
  ) {
    return Object.freeze({
      status: "active",
      relationship: active.relationship,
      activeRevision: active.activeRevision,
      activationGeneration: active.activationGeneration,
    });
  }
  const statusOnly = exactOwnData(value, ["status"]);
  return statusOnly?.status === "unavailable" ||
    statusOnly?.status === "failed" ||
    statusOnly?.status === "indeterminate"
    ? Object.freeze({ status: statusOnly.status })
    : undefined;
}

/**
 * @typedef {Readonly<{
 *   listen: (port: 0) => Promise<Readonly<{
 *     address: "127.0.0.1";
 *     port: number;
 *     origin: string;
 *   }>>;
 *   close: () => Promise<void>;
 * }>} DesenAppLocalPublicationHost
 */

/**
 * Opens one bounded, fixed-loopback host-activation bridge without starting a listener.
 *
 * @remarks The launcher-owned bearer authenticates the editor to one fixed channel and host. The
 * request cannot select a callback or endpoint, and its destination is verified before the trusted
 * activation callback runs. No token, request, callback value, or underlying error is logged or
 * persisted. Callback failures are projected to an explicit indeterminate settlement.
 *
 * @param {Readonly<{
 *   apiToken: string;
 *   allowedOrigin: string;
 *   channelName: string;
 *   hostId: string;
 *   activatePublishedRevision: (request: Readonly<{
 *     channelName: string;
 *     channelGeneration: number;
 *     hostId: string;
 *     revision: string;
 *   }>) => unknown;
 * }>} options Exact trusted local authority.
 * @returns {Promise<DesenAppLocalPublicationHost>} Idempotently revocable listener capability.
 */
export async function openDesenAppLocalPublicationHost(options) {
  const captured = captureOptions(options);
  const editorOrigin = captured.allowedOrigin;
  const channelName = captured.channelName;
  const hostId = captured.hostId;
  const activatePublishedRevision = captured.activatePublishedRevision;
  const expectedAuthorization = Buffer.from(`Bearer ${captured.apiToken}`, "utf8");
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
      response.on("error", () => undefined);
      const respond = (
        /** @type {number} */ status,
        /** @type {unknown} */ body = PRIVATE_FAILURE,
      ) => {
        if (response.destroyed || response.writableEnded) return;
        response.statusCode = status;
        response.setHeader("cache-control", "no-store");
        response.setHeader("x-content-type-options", "nosniff");
        response.setHeader("connection", "close");
        response.setHeader("vary", "Origin");
        if (allowedOrigin) response.setHeader("access-control-allow-origin", editorOrigin);
        if (status === 204) {
          response.setHeader("access-control-allow-methods", "POST");
          response.setHeader("access-control-allow-headers", "authorization, content-type");
          response.setHeader("content-length", "0");
          response.end();
          return;
        }
        const bytes = Buffer.from(JSON.stringify(body), "utf8");
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("content-length", String(bytes.byteLength));
        response.end(bytes);
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
        const bodyResult = await readBoundedBody(request);
        if (closed || response.destroyed) return;
        if (!bodyResult.ok) {
          respond(bodyResult.status);
          return;
        }
        const activationRequest = captureActivationRequest(bodyResult.body);
        if (
          activationRequest === undefined ||
          activationRequest.channelName !== channelName ||
          activationRequest.hostId !== hostId
        ) {
          respond(400);
          return;
        }

        let rawSettlement;
        try {
          rawSettlement = await activatePublishedRevision(activationRequest);
        } catch {
          rawSettlement = INDETERMINATE;
        }
        if (closed || response.destroyed) return;
        respond(200, captureActivationSettlement(rawSettlement) ?? INDETERMINATE);
      };
      void handle().catch(() => respond(503));
    },
  );
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 1;
  server.setTimeout(REQUEST_TIMEOUT_MILLISECONDS, (socket) => socket.destroy());
  server.on("clientError", (_error, socket) => socket.destroy());

  const listen = (/** @type {0} */ port) => {
    if (closed || port !== 0) return Promise.reject(new DesenAppLocalPublicationHostError());
    listenPromise ??= new Promise((resolve, reject) => {
      const onError = () => reject(new DesenAppLocalPublicationHostError());
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
          reject(new DesenAppLocalPublicationHostError());
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
              : reject(new DesenAppLocalPublicationHostError()),
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
