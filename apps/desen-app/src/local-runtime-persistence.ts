/* eslint-disable @typescript-eslint/no-invalid-void-type -- The browser fetch capability is
 * deliberately receiver-independent at the trusted local-runtime boundary. */
import { createLocalDesenEditorPersistencePort } from "@desen/editor-web";

import type { DesenEditorPersistencePort } from "@desen/editor-core";
import type {
  LocalDesenEditorPersistenceFetch,
  LocalDesenEditorPersistenceFetchRequest,
  LocalDesenEditorPersistenceFetchResponse,
} from "@desen/editor-web";

/** Exact profile discriminator injected only by the trusted local Desen App launcher. */
export const DESEN_APP_LOCAL_RUNTIME_PROFILE = "desen.app.local-runtime.v1" as const;

const LOCAL_RUNTIME_CONFIG_KEYS = Object.freeze(["controlPlane", "profile"] as const);
const LOCAL_CONTROL_PLANE_CONFIG_KEYS = Object.freeze(["apiToken", "origin"] as const);
const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const SOURCE_PATH_PATTERN = /^\/v1\/sources\/[a-z][a-z0-9-]{0,63}$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;
const MAX_RESPONSE_BYTES = 8_388_608;
const MAX_RESPONSE_HEADER_COUNT = 64;
const MAX_RESPONSE_HEADER_CODE_UNITS = 32_768;
const FETCH_TIMEOUT_MILLISECONDS = 20_000;

declare const __DESEN_APP_LOCAL_RUNTIME_CONFIG__: unknown;

/** Exact injected local control-plane identity consumed by the Desen App browser composition. */
export interface DesenAppLocalControlPlaneRuntimeConfig {
  /** Visible-ASCII bearer secret generated afresh by the trusted local launcher. */
  readonly apiToken: string;
  /** Exact fixed-loopback origin returned by the local control-plane listener. */
  readonly origin: string;
}

/** Closed local runtime configuration accepted by the normal Desen App browser entry. */
export interface DesenAppLocalRuntimeConfig {
  /** Exact versioned profile discriminator; unknown profiles fail closed. */
  readonly profile: typeof DESEN_APP_LOCAL_RUNTIME_PROFILE;
  /** One exact local control-plane authority for Source persistence. */
  readonly controlPlane: DesenAppLocalControlPlaneRuntimeConfig;
}

/** Explicit browser fetch capability used by the local persistence composition. */
export type DesenAppLocalRuntimeBrowserFetch = (
  this: void,
  input: string,
  init: RequestInit,
) => Promise<Response>;

/** Stable redacted reasons why local browser persistence composition was rejected. */
export type DesenAppLocalRuntimeConfigurationErrorCode = "INVALID_CONFIG" | "INVALID_FETCH";

const CONFIGURATION_ERROR_MESSAGES: Readonly<
  Record<DesenAppLocalRuntimeConfigurationErrorCode, string>
> = Object.freeze({
  INVALID_CONFIG: "The Desen App local runtime configuration is invalid.",
  INVALID_FETCH: "The Desen App local runtime transport is invalid.",
});

/** Redacted local-runtime composition failure that never includes a bearer token or caller value. */
export class DesenAppLocalRuntimeConfigurationError extends Error {
  /** Stable machine-readable classification for the rejected local composition. */
  readonly code: DesenAppLocalRuntimeConfigurationErrorCode;

  /** Creates one fixed-message local-runtime configuration failure. */
  constructor(code: DesenAppLocalRuntimeConfigurationErrorCode) {
    super(CONFIGURATION_ERROR_MESSAGES[code]);
    this.name = "DesenAppLocalRuntimeConfigurationError";
    this.code = code;
  }
}

function exactOwnDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
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
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

function captureLoopbackOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 128) return undefined;
  const match = LOOPBACK_ORIGIN_PATTERN.exec(value);
  const port = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" &&
      parsed.hostname === "127.0.0.1" &&
      parsed.port === String(port) &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.pathname === "/" &&
      parsed.search === "" &&
      parsed.hash === ""
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

function captureApiToken(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 256 &&
    VISIBLE_ASCII_PATTERN.test(value)
    ? value
    : undefined;
}

/**
 * Re-admits one untrusted injected value as the exact local Desen App runtime configuration.
 *
 * @remarks The returned copy is detached and frozen. Extra keys, accessors, remote origins,
 * unknown profiles, and malformed credentials fail with one redacted fixed-message error.
 */
export function captureDesenAppLocalRuntimeConfig(value: unknown): DesenAppLocalRuntimeConfig {
  const config = exactOwnDataRecord(value, LOCAL_RUNTIME_CONFIG_KEYS);
  const controlPlane = exactOwnDataRecord(config?.controlPlane, LOCAL_CONTROL_PLANE_CONFIG_KEYS);
  const origin = captureLoopbackOrigin(controlPlane?.origin);
  const apiToken = captureApiToken(controlPlane?.apiToken);
  if (
    config?.profile !== DESEN_APP_LOCAL_RUNTIME_PROFILE ||
    origin === undefined ||
    apiToken === undefined
  ) {
    throw new DesenAppLocalRuntimeConfigurationError("INVALID_CONFIG");
  }
  return Object.freeze({
    profile: DESEN_APP_LOCAL_RUNTIME_PROFILE,
    controlPlane: Object.freeze({ apiToken, origin }),
  });
}

/**
 * Reads the Vite-injected local runtime configuration, or `null` in ordinary production builds.
 *
 * @remarks The local launcher supplies this compile-time define from an in-memory random token.
 * The token is never sourced from application code or a checked-in environment file. A present
 * but malformed value fails closed rather than silently disabling persistence.
 */
export function readInjectedDesenAppLocalRuntimeConfig(): DesenAppLocalRuntimeConfig | null {
  if (typeof __DESEN_APP_LOCAL_RUNTIME_CONFIG__ === "undefined") return null;
  return captureDesenAppLocalRuntimeConfig(__DESEN_APP_LOCAL_RUNTIME_CONFIG__);
}

function captureBrowserFetch(value: unknown): DesenAppLocalRuntimeBrowserFetch {
  if (typeof value !== "function") {
    throw new DesenAppLocalRuntimeConfigurationError("INVALID_FETCH");
  }
  return value as DesenAppLocalRuntimeBrowserFetch;
}

function captureSourceRequest(
  request: LocalDesenEditorPersistenceFetchRequest,
  origin: string,
): Readonly<{
  readonly body?: Uint8Array<ArrayBuffer>;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: "GET" | "PUT";
  readonly url: string;
}> {
  const parsed = new URL(request.url);
  if (
    parsed.origin !== origin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !SOURCE_PATH_PATTERN.test(parsed.pathname) ||
    request.redirect !== "error"
  ) {
    throw new TypeError("The local Source request escaped its fixed authority.");
  }
  const body = request.body === undefined ? undefined : new Uint8Array(request.body);
  if ((request.method === "GET" && body !== undefined) || (request.method === "PUT" && !body)) {
    throw new TypeError("The local Source request body does not match its method.");
  }
  return Object.freeze({
    method: request.method,
    url: request.url,
    headers: Object.freeze({ ...request.headers }),
    ...(body === undefined ? {} : { body }),
  });
}

function responseContentLength(response: Response): number | undefined {
  const value = response.headers.get("content-length");
  if (value === null || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

async function readBoundedResponseBody(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = responseContentLength(response);
  if (declaredLength !== undefined && declaredLength > MAX_RESPONSE_BYTES) {
    throw new TypeError("The local persistence response exceeds its fixed byte limit.");
  }
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = new Uint8Array(result.value);
      length += chunk.byteLength;
      if (length > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new TypeError("The local persistence response exceeds its fixed byte limit.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function captureResponseHeaders(response: Response): Readonly<Record<string, string>> {
  const headers: Record<string, string> = Object.create(null) as Record<string, string>;
  let count = 0;
  let codeUnits = 0;
  response.headers.forEach((value, name) => {
    count += 1;
    codeUnits += name.length + value.length;
    if (count <= MAX_RESPONSE_HEADER_COUNT && codeUnits <= MAX_RESPONSE_HEADER_CODE_UNITS) {
      headers[name] = value;
    }
  });
  if (count > MAX_RESPONSE_HEADER_COUNT || codeUnits > MAX_RESPONSE_HEADER_CODE_UNITS) {
    throw new TypeError("The local persistence response headers exceed their fixed limit.");
  }
  return Object.freeze(headers);
}

function createLoopbackFetchBinding(
  config: DesenAppLocalRuntimeConfig,
  browserFetch: DesenAppLocalRuntimeBrowserFetch,
): LocalDesenEditorPersistenceFetch {
  return async (
    request: LocalDesenEditorPersistenceFetchRequest,
  ): Promise<LocalDesenEditorPersistenceFetchResponse> => {
    const capturedRequest = captureSourceRequest(request, config.controlPlane.origin);
    const abortController = new AbortController();
    const timeout = globalThis.setTimeout(() => {
      abortController.abort();
    }, FETCH_TIMEOUT_MILLISECONDS);
    try {
      const response = await browserFetch(capturedRequest.url, {
        method: capturedRequest.method,
        headers: capturedRequest.headers,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: abortController.signal,
        ...(capturedRequest.body === undefined ? {} : { body: capturedRequest.body }),
      });
      if (!(response instanceof Response) || response.redirected) {
        throw new TypeError("The local persistence response is invalid.");
      }
      const headers = captureResponseHeaders(response);
      const body = await readBoundedResponseBody(response);
      return Object.freeze({ status: response.status, headers, body });
    } finally {
      globalThis.clearTimeout(timeout);
    }
  };
}

/**
 * Creates the normal Desen App persistence port for one admitted local runtime configuration.
 *
 * @remarks The browser fetch capability is mandatory and captured explicitly; there is no ambient
 * global fallback. Requests remain fixed to the injected loopback authority, omit credentials and
 * referrers, reject redirects, enforce a finite timeout, and bound response bytes before handing
 * them to the existing generation-CAS Web adapter.
 */
export function createDesenAppLocalPersistencePort(
  configValue: unknown,
  browserFetchValue: unknown,
): DesenEditorPersistencePort {
  const config = captureDesenAppLocalRuntimeConfig(configValue);
  const browserFetch = captureBrowserFetch(browserFetchValue);
  return createLocalDesenEditorPersistencePort({
    origin: config.controlPlane.origin,
    apiToken: config.controlPlane.apiToken,
    fetch: createLoopbackFetchBinding(config, browserFetch),
  });
}

/**
 * Creates the injected local persistence port, or `null` when no local launcher configured it.
 *
 * @remarks A malformed present config or invalid fetch capability throws the same controlled,
 * redacted configuration error as the explicit factory.
 */
export function createInjectedDesenAppLocalPersistencePort(
  browserFetchValue: unknown,
): DesenEditorPersistencePort | null {
  const config = readInjectedDesenAppLocalRuntimeConfig();
  return config === null ? null : createDesenAppLocalPersistencePort(config, browserFetchValue);
}
