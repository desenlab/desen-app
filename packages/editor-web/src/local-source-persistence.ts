/* eslint-disable @typescript-eslint/no-invalid-void-type -- The injected transport is deliberately
 * receiver-independent at the trusted-host boundary. */
import { createDesenEditorPersistencePort } from "@desen/editor-core";

import { parseLocalSourceJsonBytes } from "./local-source-json.js";

import type {
  DesenEditorPersistenceAdapterFailureReason,
  DesenEditorPersistenceAdapterReadResult,
  DesenEditorPersistenceAdapterWriteRequest,
  DesenEditorPersistenceAdapterWriteResult,
  DesenEditorPersistencePort,
} from "@desen/editor-core";

const LOCAL_SOURCE_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;
const GENERATION_ETAG_PATTERN = /^"g:([1-9][0-9]*)"$/u;
const JSON_MEDIA_TYPE_PATTERN = /^application\/json(?:;\s*charset=utf-8)?$/iu;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/u;
const MAX_SOURCE_BYTES = 8_388_608;
const MAX_ERROR_BYTES = 65_536;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_CODE_UNITS = 32_768;

/** Stable local Web-adapter configuration failure codes. */
export type LocalDesenEditorPersistenceConfigurationErrorCode =
  "INVALID_API_TOKEN" | "INVALID_FETCH" | "INVALID_ORIGIN" | "INVALID_OPTIONS";

const CONFIGURATION_ERROR_MESSAGES: Readonly<
  Record<LocalDesenEditorPersistenceConfigurationErrorCode, string>
> = Object.freeze({
  INVALID_API_TOKEN: "The local editor persistence token is invalid.",
  INVALID_FETCH: "The local editor persistence transport is invalid.",
  INVALID_ORIGIN: "The local editor persistence origin is invalid.",
  INVALID_OPTIONS: "The local editor persistence options are invalid.",
});

/** Redacted configuration failure raised before a local persistence port is created. */
export class LocalDesenEditorPersistenceConfigurationError extends Error {
  /** Stable reason for the rejected trusted-host configuration. */
  readonly code: LocalDesenEditorPersistenceConfigurationErrorCode;

  /** Creates one fixed-message local persistence configuration failure. */
  constructor(code: LocalDesenEditorPersistenceConfigurationErrorCode) {
    super(CONFIGURATION_ERROR_MESSAGES[code]);
    this.name = "LocalDesenEditorPersistenceConfigurationError";
    this.code = code;
  }
}

/** Exact local transport request emitted by the Web persistence adapter. */
export interface LocalDesenEditorPersistenceFetchRequest {
  /** Only GET and PUT are needed by the closed editable-Source profile. */
  readonly method: "GET" | "PUT";
  /** Exact fixed-loopback Source URL. */
  readonly url: string;
  /** Detached scalar headers, including the bearer credential and exact CAS precondition. */
  readonly headers: Readonly<Record<string, string>>;
  /** Canonical Source bytes for PUT; absent for GET. */
  readonly body?: Readonly<Uint8Array>;
  /** Redirects must fail so the bearer credential cannot follow to another origin. */
  readonly redirect: "error";
}

/** Detached response returned by the injected local Web transport. */
export interface LocalDesenEditorPersistenceFetchResponse {
  /** HTTP status returned by the exact M07-T05 Source route. */
  readonly status: number;
  /** Lowercase scalar response headers copied out of the platform response. */
  readonly headers: Readonly<Record<string, string>>;
  /** Fresh complete response bytes. */
  readonly body: Readonly<Uint8Array>;
}

/** Receiver-independent host transport used instead of an implicit global `fetch`. */
export type LocalDesenEditorPersistenceFetch = (
  this: void,
  request: LocalDesenEditorPersistenceFetchRequest,
) => Promise<LocalDesenEditorPersistenceFetchResponse>;

/** Trusted local Web configuration for one editor persistence port. */
export interface LocalDesenEditorPersistenceOptions {
  /** Exact `http://127.0.0.1:<port>` origin returned by the M07-T05 listener. */
  readonly origin: string;
  /** Visible-ASCII bearer token accepted by the local control plane. */
  readonly apiToken: string;
  /** Explicit transport binding; no browser-global fallback is used. */
  readonly fetch: LocalDesenEditorPersistenceFetch;
}

interface CapturedOptions {
  readonly origin: string;
  readonly apiToken: string;
  readonly fetch: LocalDesenEditorPersistenceFetch;
}

interface CapturedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

function ownData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function captureOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new LocalDesenEditorPersistenceConfigurationError("INVALID_ORIGIN");
  }
  const match = LOOPBACK_ORIGIN_PATTERN.exec(value);
  const port = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new LocalDesenEditorPersistenceConfigurationError("INVALID_ORIGIN");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LocalDesenEditorPersistenceConfigurationError("INVALID_ORIGIN");
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (parsed.port !== "" && Number(parsed.port) !== port) ||
    (parsed.port === "" && port !== 80)
  ) {
    throw new LocalDesenEditorPersistenceConfigurationError("INVALID_ORIGIN");
  }
  return value;
}

function captureOptions(value: unknown): CapturedOptions {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      throw new LocalDesenEditorPersistenceConfigurationError("INVALID_OPTIONS");
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      keys.some((key) => typeof key !== "string" || !["apiToken", "fetch", "origin"].includes(key))
    ) {
      throw new LocalDesenEditorPersistenceConfigurationError("INVALID_OPTIONS");
    }
    const origin = captureOrigin(ownData(value, "origin"));
    const apiToken = ownData(value, "apiToken");
    if (
      typeof apiToken !== "string" ||
      apiToken.length < 32 ||
      apiToken.length > 256 ||
      !VISIBLE_ASCII_PATTERN.test(apiToken)
    ) {
      throw new LocalDesenEditorPersistenceConfigurationError("INVALID_API_TOKEN");
    }
    const fetch = ownData(value, "fetch");
    if (typeof fetch !== "function") {
      throw new LocalDesenEditorPersistenceConfigurationError("INVALID_FETCH");
    }
    return Object.freeze({
      origin,
      apiToken,
      fetch: fetch as LocalDesenEditorPersistenceFetch,
    });
  } catch (error) {
    if (error instanceof LocalDesenEditorPersistenceConfigurationError) throw error;
    throw new LocalDesenEditorPersistenceConfigurationError("INVALID_OPTIONS");
  }
}

function captureHeaders(value: unknown): Readonly<Record<string, string>> | undefined {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      return undefined;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length > MAX_HEADER_COUNT ||
      keys.some(
        (key) =>
          typeof key !== "string" || key !== key.toLowerCase() || !HEADER_NAME_PATTERN.test(key),
      )
    ) {
      return undefined;
    }
    const headers: Record<string, string> = Object.create(null) as Record<string, string>;
    let codeUnits = 0;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      ) {
        return undefined;
      }
      codeUnits += key.length + descriptor.value.length;
      if (codeUnits > MAX_HEADER_CODE_UNITS) return undefined;
      headers[key] = descriptor.value;
    }
    return Object.freeze(headers);
  } catch {
    return undefined;
  }
}

function copyBody(value: unknown, maximum: number): Uint8Array | undefined {
  try {
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)) return undefined;
    if (value.byteLength > maximum) return undefined;
    return new Uint8Array(value);
  } catch {
    return undefined;
  }
}

function captureResponse(value: unknown, maximumBodyBytes: number): CapturedResponse | undefined {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      return undefined;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      keys.some((key) => typeof key !== "string" || !["body", "headers", "status"].includes(key))
    ) {
      return undefined;
    }
    const status = ownData(value, "status");
    const headers = captureHeaders(ownData(value, "headers"));
    const body = copyBody(ownData(value, "body"), maximumBodyBytes);
    return typeof status === "number" &&
      Number.isSafeInteger(status) &&
      status >= 100 &&
      status <= 599 &&
      headers !== undefined &&
      body !== undefined
      ? Object.freeze({ status, headers, body })
      : undefined;
  } catch {
    return undefined;
  }
}

function generationFromEtag(value: string | undefined): number | undefined {
  const match = value === undefined ? null : GENERATION_ETAG_PATTERN.exec(value);
  if (match === null) return undefined;
  const generation = Number(match[1]);
  return Number.isSafeInteger(generation) && generation > 0 ? generation : undefined;
}

function jsonMediaType(headers: Readonly<Record<string, string>>): boolean {
  const contentType = headers["content-type"];
  return contentType !== undefined && JSON_MEDIA_TYPE_PATTERN.test(contentType);
}

function exactOwnRecord(
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
    const captured: Record<string, unknown> = {};
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

function errorCode(response: CapturedResponse): string | undefined {
  if (!jsonMediaType(response.headers) || response.body.byteLength > MAX_ERROR_BYTES)
    return undefined;
  const parsed = parseLocalSourceJsonBytes(response.body);
  const envelope = exactOwnRecord(parsed, ["error"]);
  const detail = exactOwnRecord(envelope?.error, ["code", "message"]);
  return typeof detail?.code === "string" && typeof detail.message === "string"
    ? detail.code
    : undefined;
}

function failureReason(code: string | undefined): DesenEditorPersistenceAdapterFailureReason {
  switch (code) {
    case "AUTHENTICATION_REQUIRED":
      return "authentication-required";
    case "BODY_LIMIT_EXCEEDED":
    case "SOURCE_MATERIAL_LIMIT_EXCEEDED":
      return "source-limit-exceeded";
    case "INVALID_SOURCE_KEY":
    case "PRECONDITION_INVALID":
    case "PRECONDITION_REQUIRED":
    case "SOURCE_JSON_INVALID":
    case "SOURCE_SCHEMA_INVALID":
    case "UNSUPPORTED_MEDIA_TYPE":
      return "source-invalid";
    case "METADATA_BUSY":
      return "storage-busy";
    case "METADATA_CORRUPT":
      return "storage-corrupt";
    case "UNSAFE_STORAGE_PATH":
      return "unsafe-storage";
    default:
      return "storage-unavailable";
  }
}

function definiteWriteFailureReason(
  status: number,
  code: string | undefined,
): DesenEditorPersistenceAdapterFailureReason | undefined {
  const statusMatchesCode =
    (status === 401 && code === "AUTHENTICATION_REQUIRED") ||
    (status === 400 &&
      (code === "INVALID_SOURCE_KEY" ||
        code === "PRECONDITION_INVALID" ||
        code === "SOURCE_JSON_INVALID" ||
        code === "SOURCE_SCHEMA_INVALID")) ||
    (status === 413 &&
      (code === "BODY_LIMIT_EXCEEDED" || code === "SOURCE_MATERIAL_LIMIT_EXCEEDED")) ||
    (status === 415 && code === "UNSUPPORTED_MEDIA_TYPE") ||
    (status === 428 && code === "PRECONDITION_REQUIRED") ||
    (status === 503 && code === "METADATA_BUSY");
  return statusMatchesCode ? failureReason(code) : undefined;
}

function failed(
  reason: DesenEditorPersistenceAdapterFailureReason,
): DesenEditorPersistenceAdapterReadResult {
  return Object.freeze({ status: "failed", reason });
}

function writeFailed(
  reason: DesenEditorPersistenceAdapterFailureReason,
): DesenEditorPersistenceAdapterWriteResult {
  return Object.freeze({ status: "failed", reason });
}

function localSourceUrl(origin: string, sourceKey: string): string {
  return `${origin}/v1/sources/${sourceKey}`;
}

function requestHeaders(apiToken: string, precondition?: string): Readonly<Record<string, string>> {
  return Object.freeze({
    authorization: `Bearer ${apiToken}`,
    ...(precondition === undefined
      ? {}
      : precondition === "*"
        ? { "if-none-match": "*" }
        : { "if-match": precondition }),
    ...(precondition === undefined ? {} : { "content-type": "application/json" }),
  });
}

function writeSuccess(
  response: CapturedResponse,
  sourceKey: string,
): DesenEditorPersistenceAdapterWriteResult | undefined {
  if (!jsonMediaType(response.headers)) return undefined;
  const generation = generationFromEtag(response.headers.etag);
  const parsed = parseLocalSourceJsonBytes(response.body);
  const body = exactOwnRecord(parsed, ["generation", "sourceKey", "status"]);
  if (
    generation === undefined ||
    body === undefined ||
    body.generation !== generation ||
    body.sourceKey !== sourceKey
  ) {
    return undefined;
  }
  if (response.status === 201 && body.status === "created" && generation === 1) {
    return Object.freeze({ status: "created", generation: 1 });
  }
  if (response.status === 200 && body.status === "updated") {
    return Object.freeze({ status: "updated", generation });
  }
  if (response.status === 200 && body.status === "unchanged") {
    return Object.freeze({ status: "unchanged", generation });
  }
  return undefined;
}

function conflictResult(
  response: CapturedResponse,
): DesenEditorPersistenceAdapterWriteResult | undefined {
  if (response.status !== 412 || errorCode(response) !== "GENERATION_MISMATCH") return undefined;
  const etag = response.headers.etag;
  if (etag === undefined) return Object.freeze({ status: "conflict", currentGeneration: null });
  const currentGeneration = generationFromEtag(etag);
  return currentGeneration === undefined
    ? undefined
    : Object.freeze({ status: "conflict", currentGeneration });
}

function exhaustedResult(
  response: CapturedResponse,
): DesenEditorPersistenceAdapterWriteResult | undefined {
  if (response.status !== 409 || errorCode(response) !== "GENERATION_EXHAUSTED") return undefined;
  const generation = generationFromEtag(response.headers.etag);
  return generation === undefined
    ? undefined
    : Object.freeze({ status: "generation-exhausted", generation });
}

/**
 * Creates the Web adapter that binds editor-core persistence to the M07-T05 local Source API.
 *
 * @remarks The adapter sends complete canonical Source bytes, including root `authoring`, through
 * exact generation compare-and-set. It performs no retry, merge, delete, list, path selection, or
 * global-fetch fallback. A transport rejection or malformed response after PUT is indeterminate
 * because the durable commit may already have happened; callers resolve that state by reopening.
 */
export function createLocalDesenEditorPersistencePort(
  options: LocalDesenEditorPersistenceOptions,
): DesenEditorPersistencePort {
  const captured = captureOptions(options);
  return createDesenEditorPersistencePort(
    Object.freeze({
      readSource: async (sourceKey: string): Promise<DesenEditorPersistenceAdapterReadResult> => {
        if (!LOCAL_SOURCE_KEY_PATTERN.test(sourceKey)) return failed("source-invalid");
        let raw: LocalDesenEditorPersistenceFetchResponse;
        try {
          raw = await captured.fetch(
            Object.freeze({
              method: "GET" as const,
              url: localSourceUrl(captured.origin, sourceKey),
              headers: requestHeaders(captured.apiToken),
              redirect: "error" as const,
            }),
          );
        } catch {
          return failed("storage-unavailable");
        }
        const response = captureResponse(raw, MAX_SOURCE_BYTES);
        if (response === undefined) return failed("storage-unavailable");
        if (response.status === 200) {
          const generation = generationFromEtag(response.headers.etag);
          const value = jsonMediaType(response.headers)
            ? parseLocalSourceJsonBytes(response.body)
            : undefined;
          return generation === undefined || value === undefined
            ? failed("source-invalid")
            : Object.freeze({
                status: "found" as const,
                record: Object.freeze({ sourceKey, generation, value }),
              });
        }
        const code = errorCode(response);
        return response.status === 404 && code === "SOURCE_NOT_FOUND"
          ? Object.freeze({ status: "missing" as const })
          : failed(failureReason(code));
      },
      compareAndSetSource: async (
        request: DesenEditorPersistenceAdapterWriteRequest,
      ): Promise<DesenEditorPersistenceAdapterWriteResult> => {
        if (!LOCAL_SOURCE_KEY_PATTERN.test(request.sourceKey)) return writeFailed("source-invalid");
        const body = copyBody(request.bytes, MAX_SOURCE_BYTES);
        if (body === undefined || body.byteLength === 0) return writeFailed("source-invalid");
        const precondition =
          request.expectedGeneration === null ? "*" : `"g:${String(request.expectedGeneration)}"`;
        let raw: LocalDesenEditorPersistenceFetchResponse;
        try {
          raw = await captured.fetch(
            Object.freeze({
              method: "PUT" as const,
              url: localSourceUrl(captured.origin, request.sourceKey),
              headers: requestHeaders(captured.apiToken, precondition),
              body,
              redirect: "error" as const,
            }),
          );
        } catch {
          return Object.freeze({ status: "indeterminate" as const });
        }
        const response = captureResponse(raw, MAX_SOURCE_BYTES);
        if (response === undefined) return Object.freeze({ status: "indeterminate" as const });
        const success = writeSuccess(response, request.sourceKey);
        if (success !== undefined) return success;
        const conflict = conflictResult(response);
        if (conflict !== undefined) return conflict;
        const exhausted = exhaustedResult(response);
        if (exhausted !== undefined) return exhausted;
        const code = errorCode(response);
        const definiteFailure = definiteWriteFailureReason(response.status, code);
        if (definiteFailure === undefined) {
          return Object.freeze({ status: "indeterminate" as const });
        }
        return writeFailed(definiteFailure);
      },
    }),
  );
}
