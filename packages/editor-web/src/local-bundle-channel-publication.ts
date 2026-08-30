/* eslint-disable @typescript-eslint/no-invalid-void-type -- The injected transport and public
 * publication method are deliberately receiver-independent at the trusted-host boundary. */

import { parseLocalSourceJsonBytes } from "./local-source-json.js";

const LOCAL_IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;
const GENERATION_ETAG_PATTERN = /^"g:([1-9][0-9]*)"$/u;
const JSON_MEDIA_TYPE_PATTERN = /^application\/json(?:;\s*charset=utf-8)?$/iu;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9a-z-]+$/u;
const MAX_BUNDLE_BYTES = 2_097_152;
const MAX_RESPONSE_BYTES = 65_536;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_CODE_UNITS = 32_768;

/** Stable configuration failures for one local Bundle/channel publication port. */
export type LocalDesenBundleChannelPublicationConfigurationErrorCode =
  | "INVALID_API_TOKEN"
  | "INVALID_CHANNEL_NAME"
  | "INVALID_FETCH"
  | "INVALID_OPTIONS"
  | "INVALID_ORIGIN";

const CONFIGURATION_ERROR_MESSAGES: Readonly<
  Record<LocalDesenBundleChannelPublicationConfigurationErrorCode, string>
> = Object.freeze({
  INVALID_API_TOKEN: "The local publication token is invalid.",
  INVALID_CHANNEL_NAME: "The local publication channel name is invalid.",
  INVALID_FETCH: "The local publication transport is invalid.",
  INVALID_OPTIONS: "The local publication options are invalid.",
  INVALID_ORIGIN: "The local publication origin is invalid.",
});

/** Redacted configuration failure raised before a local publication port is created. */
export class LocalDesenBundleChannelPublicationConfigurationError extends Error {
  /** Stable reason for the rejected trusted-host configuration. */
  readonly code: LocalDesenBundleChannelPublicationConfigurationErrorCode;

  /** Creates one fixed-message local publication configuration failure. */
  constructor(code: LocalDesenBundleChannelPublicationConfigurationErrorCode) {
    super(CONFIGURATION_ERROR_MESSAGES[code]);
    this.name = "LocalDesenBundleChannelPublicationConfigurationError";
    this.code = code;
  }
}

/** Exact local transport request emitted by the Web publication adapter. */
export interface LocalDesenBundleChannelPublicationFetchRequest {
  /** Only GET and PUT are needed by the closed immutable-Bundle/fixed-channel profile. */
  readonly method: "GET" | "PUT";
  /** Exact fixed-loopback Bundle or configured-channel URL. */
  readonly url: string;
  /** Detached scalar headers, including bearer credentials and channel CAS preconditions. */
  readonly headers: Readonly<Record<string, string>>;
  /** Exact Bundle bytes or closed channel JSON bytes for PUT; absent for GET. */
  readonly body?: Readonly<Uint8Array>;
  /** Redirects fail so the bearer credential cannot follow to another origin. */
  readonly redirect: "error";
}

/** Detached response returned by the injected local publication transport. */
export interface LocalDesenBundleChannelPublicationFetchResponse {
  /** HTTP status returned by the exact M07-T05 Bundle or channel route. */
  readonly status: number;
  /** Lowercase scalar response headers copied out of the platform response. */
  readonly headers: Readonly<Record<string, string>>;
  /** Fresh complete response bytes. */
  readonly body: Readonly<Uint8Array>;
}

/** Receiver-independent host transport used instead of an implicit global `fetch`. */
export type LocalDesenBundleChannelPublicationFetch = (
  this: void,
  request: LocalDesenBundleChannelPublicationFetchRequest,
) => Promise<LocalDesenBundleChannelPublicationFetchResponse>;

/** Trusted local Web configuration for one immutable-Bundle/fixed-channel publication port. */
export interface LocalDesenBundleChannelPublicationOptions<ChannelName extends string = string> {
  /** Exact `http://127.0.0.1:<port>` origin returned by the M07-T05 listener. */
  readonly origin: string;
  /** Visible-ASCII bearer token accepted by the local control plane. */
  readonly apiToken: string;
  /** Fixed channel selected by trusted host configuration, never by Bundle data. */
  readonly channelName: ChannelName;
  /** Explicit transport binding; no browser-global fallback is used. */
  readonly fetch: LocalDesenBundleChannelPublicationFetch;
}

/** One exact immutable Bundle request prepared by the public Publisher boundary. */
export interface LocalDesenBundleChannelPublicationRequest {
  /** Complete canonical Bundle bytes to store without transformation. */
  readonly bundleBytes: Readonly<Uint8Array>;
  /** Exact lowercase Bundle revision that addresses those bytes. */
  readonly revision: string;
}

/** Definite immutable-Bundle write receipt returned before the channel CAS. */
export type LocalDesenBundlePublicationStatus = "stored" | "unchanged";

/** Definite fixed-channel CAS receipt. */
export type LocalDesenChannelPublicationStatus = "created" | "updated" | "unchanged";

/** Stage whose controlled publication request failed without an ambiguous commit. */
export type LocalDesenBundleChannelPublicationFailurePhase =
  "request" | "channel-read" | "bundle-write" | "channel-write";

/** Stable redacted reason for one definite local publication failure. */
export type LocalDesenBundleChannelPublicationFailureReason =
  | "access-denied"
  | "authentication-required"
  | "bundle-bytes-conflict"
  | "bundle-invalid"
  | "bundle-limit-exceeded"
  | "bundle-missing"
  | "channel-invalid"
  | "generation-exhausted"
  | "storage-busy"
  | "storage-corrupt"
  | "storage-unavailable"
  | "unsafe-storage";

/** Successful immutable Bundle write followed by one exact fixed-channel CAS. */
export interface LocalDesenBundleChannelPublicationSuccess<ChannelName extends string = string> {
  readonly status: "published";
  readonly channelName: ChannelName;
  readonly revision: string;
  readonly bundleStatus: LocalDesenBundlePublicationStatus;
  readonly channelStatus: LocalDesenChannelPublicationStatus;
  readonly channelGeneration: number;
}

/** Channel CAS conflict after the immutable Bundle was definitely stored or already present. */
export interface LocalDesenBundleChannelPublicationConflict {
  readonly status: "conflict";
  readonly revision: string;
  readonly bundleStatus: LocalDesenBundlePublicationStatus;
  readonly currentGeneration: number | null;
}

/** Commit outcome that cannot be classified safely after one mutating request was dispatched. */
export type LocalDesenBundleChannelPublicationIndeterminate =
  | Readonly<{
      readonly status: "indeterminate";
      readonly phase: "bundle-write";
      readonly revision: string;
    }>
  | Readonly<{
      readonly status: "indeterminate";
      readonly phase: "channel-write";
      readonly revision: string;
      readonly bundleStatus: LocalDesenBundlePublicationStatus;
    }>;

/** Definite failure before any channel change. */
export type LocalDesenBundleChannelPublicationFailure =
  | Readonly<{
      readonly status: "failed";
      readonly phase: "request" | "channel-read" | "bundle-write";
      readonly reason: LocalDesenBundleChannelPublicationFailureReason;
    }>
  | Readonly<{
      readonly status: "failed";
      readonly phase: "channel-write";
      readonly reason: LocalDesenBundleChannelPublicationFailureReason;
      readonly revision: string;
      readonly bundleStatus: LocalDesenBundlePublicationStatus;
    }>;

/** Closed result of one Bundle write and fixed-channel compare-and-set attempt. */
export type LocalDesenBundleChannelPublicationResult<ChannelName extends string = string> =
  | LocalDesenBundleChannelPublicationSuccess<ChannelName>
  | LocalDesenBundleChannelPublicationConflict
  | LocalDesenBundleChannelPublicationIndeterminate
  | LocalDesenBundleChannelPublicationFailure;

/** Browser-safe publication authority over one trusted fixed local channel. */
export interface LocalDesenBundleChannelPublicationPort<ChannelName extends string = string> {
  /** Writes exact Bundle bytes, then moves the configured channel using the initial snapshot CAS. */
  readonly publishBundleToChannel: (
    this: void,
    request: LocalDesenBundleChannelPublicationRequest,
  ) => Promise<LocalDesenBundleChannelPublicationResult<ChannelName>>;
}

interface CapturedOptions {
  readonly origin: string;
  readonly apiToken: string;
  readonly channelName: string;
  readonly fetch: LocalDesenBundleChannelPublicationFetch;
}

interface CapturedPublicationRequest {
  readonly revision: string;
  readonly bundleBytes: Uint8Array;
}

interface CapturedResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
}

type ChannelSnapshot =
  | Readonly<{ readonly status: "missing" }>
  | Readonly<{
      readonly status: "found";
      readonly generation: number;
      readonly revision: string;
    }>;

function exactOwnData(
  value: unknown,
  keys: readonly string[],
  allowNullPrototype = false,
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && !(allowNullPrototype && prototype === null)) {
      return undefined;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        return undefined;
      }
      result[key] = descriptor.value;
    }
    return Object.freeze(result);
  } catch {
    return undefined;
  }
}

function captureOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_ORIGIN");
  }
  const match = LOOPBACK_ORIGIN_PATTERN.exec(value);
  const port = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_ORIGIN");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_ORIGIN");
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
    throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_ORIGIN");
  }
  return value;
}

function captureOptions(value: unknown): CapturedOptions {
  try {
    const values = exactOwnData(value, ["apiToken", "channelName", "fetch", "origin"], true);
    if (values === undefined) {
      throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_OPTIONS");
    }
    const origin = captureOrigin(values.origin);
    const apiToken = values.apiToken;
    if (
      typeof apiToken !== "string" ||
      apiToken.length < 32 ||
      apiToken.length > 256 ||
      !VISIBLE_ASCII_PATTERN.test(apiToken)
    ) {
      throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_API_TOKEN");
    }
    if (
      typeof values.channelName !== "string" ||
      !LOCAL_IDENTIFIER_PATTERN.test(values.channelName)
    ) {
      throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_CHANNEL_NAME");
    }
    if (typeof values.fetch !== "function") {
      throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_FETCH");
    }
    return Object.freeze({
      origin,
      apiToken,
      channelName: values.channelName,
      fetch: values.fetch as LocalDesenBundleChannelPublicationFetch,
    });
  } catch (error) {
    if (error instanceof LocalDesenBundleChannelPublicationConfigurationError) throw error;
    throw new LocalDesenBundleChannelPublicationConfigurationError("INVALID_OPTIONS");
  }
}

function copyBody(value: unknown, maximum: number): Uint8Array | undefined {
  try {
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)) return undefined;
    if (value.byteLength === 0 || value.byteLength > maximum) return undefined;
    return new Uint8Array(value);
  } catch {
    return undefined;
  }
}

function capturePublicationRequest(value: unknown): CapturedPublicationRequest | undefined {
  const values = exactOwnData(value, ["bundleBytes", "revision"], true);
  if (values === undefined || typeof values.revision !== "string") return undefined;
  if (!SHA256_DIGEST_PATTERN.test(values.revision)) return undefined;
  const bundleBytes = copyBody(values.bundleBytes, MAX_BUNDLE_BYTES);
  return bundleBytes === undefined
    ? undefined
    : Object.freeze({ revision: values.revision, bundleBytes });
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

function captureResponse(value: unknown): CapturedResponse | undefined {
  try {
    const values = exactOwnData(value, ["body", "headers", "status"], true);
    if (values === undefined) return undefined;
    const headers = captureHeaders(values.headers);
    const body = copyResponseBody(values.body);
    return typeof values.status === "number" &&
      Number.isSafeInteger(values.status) &&
      values.status >= 100 &&
      values.status <= 599 &&
      headers !== undefined &&
      body !== undefined
      ? Object.freeze({ status: values.status, headers, body })
      : undefined;
  } catch {
    return undefined;
  }
}

function copyResponseBody(value: unknown): Uint8Array | undefined {
  try {
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)) return undefined;
    if (value.byteLength > MAX_RESPONSE_BYTES) return undefined;
    return new Uint8Array(value);
  } catch {
    return undefined;
  }
}

function positiveGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function generationFromEtag(value: string | undefined): number | undefined {
  const match = value === undefined ? null : GENERATION_ETAG_PATTERN.exec(value);
  if (match === null) return undefined;
  const generation = Number(match[1]);
  return positiveGeneration(generation) ? generation : undefined;
}

function jsonMediaType(headers: Readonly<Record<string, string>>): boolean {
  const contentType = headers["content-type"];
  return contentType !== undefined && JSON_MEDIA_TYPE_PATTERN.test(contentType);
}

function parsedJsonRecord(
  response: CapturedResponse,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (!jsonMediaType(response.headers)) return undefined;
  return exactOwnData(parseLocalSourceJsonBytes(response.body), keys);
}

function errorCode(response: CapturedResponse): string | undefined {
  const envelope = parsedJsonRecord(response, ["error"]);
  const detail = exactOwnData(envelope?.error, ["code", "message"]);
  return typeof detail?.code === "string" && typeof detail.message === "string"
    ? detail.code
    : undefined;
}

function failureReason(code: string | undefined): LocalDesenBundleChannelPublicationFailureReason {
  switch (code) {
    case "AUTHENTICATION_REQUIRED":
      return "authentication-required";
    case "HOST_NOT_ALLOWED":
    case "ORIGIN_NOT_ALLOWED":
      return "access-denied";
    case "BODY_LIMIT_EXCEEDED":
      return "bundle-limit-exceeded";
    case "BUNDLE_BYTES_CONFLICT":
      return "bundle-bytes-conflict";
    case "BUNDLE_NOT_FOUND":
      return "bundle-missing";
    case "GENERATION_EXHAUSTED":
      return "generation-exhausted";
    case "INVALID_CHANNEL_BODY":
    case "INVALID_CHANNEL_NAME":
    case "INVALID_GENERATION":
    case "PRECONDITION_INVALID":
    case "PRECONDITION_REQUIRED":
      return "channel-invalid";
    case "INVALID_REQUEST":
    case "INVALID_REVISION":
    case "UNSUPPORTED_MEDIA_TYPE":
      return "bundle-invalid";
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

function readFailureReason(
  response: CapturedResponse,
): LocalDesenBundleChannelPublicationFailureReason {
  return failureReason(errorCode(response));
}

function definiteBundleWriteFailure(
  response: CapturedResponse,
): LocalDesenBundleChannelPublicationFailureReason | undefined {
  const code = errorCode(response);
  const definite =
    (response.status === 400 && (code === "INVALID_REQUEST" || code === "INVALID_REVISION")) ||
    (response.status === 401 && code === "AUTHENTICATION_REQUIRED") ||
    (response.status === 403 && (code === "HOST_NOT_ALLOWED" || code === "ORIGIN_NOT_ALLOWED")) ||
    (response.status === 409 && code === "BUNDLE_BYTES_CONFLICT") ||
    (response.status === 413 && code === "BODY_LIMIT_EXCEEDED") ||
    (response.status === 415 && code === "UNSUPPORTED_MEDIA_TYPE");
  return definite ? failureReason(code) : undefined;
}

function definiteChannelWriteFailure(
  response: CapturedResponse,
  expectedGeneration: number | null,
): LocalDesenBundleChannelPublicationFailureReason | undefined {
  const code = errorCode(response);
  const ordinary =
    (response.status === 400 &&
      (code === "INVALID_CHANNEL_BODY" ||
        code === "INVALID_CHANNEL_NAME" ||
        code === "INVALID_GENERATION" ||
        code === "PRECONDITION_INVALID")) ||
    (response.status === 401 && code === "AUTHENTICATION_REQUIRED") ||
    (response.status === 403 && (code === "HOST_NOT_ALLOWED" || code === "ORIGIN_NOT_ALLOWED")) ||
    (response.status === 409 && code === "BUNDLE_NOT_FOUND") ||
    (response.status === 413 && code === "BODY_LIMIT_EXCEEDED") ||
    (response.status === 415 && code === "UNSUPPORTED_MEDIA_TYPE") ||
    (response.status === 428 && code === "PRECONDITION_REQUIRED") ||
    (response.status === 503 && code === "METADATA_BUSY");
  if (ordinary) return failureReason(code);
  if (response.status !== 409 || code !== "GENERATION_EXHAUSTED") return undefined;
  const generation = generationFromEtag(response.headers.etag);
  return generation === Number.MAX_SAFE_INTEGER && expectedGeneration === generation
    ? "generation-exhausted"
    : undefined;
}

function failed(
  phase: "request" | "channel-read" | "bundle-write",
  reason: LocalDesenBundleChannelPublicationFailureReason,
): LocalDesenBundleChannelPublicationFailure {
  return Object.freeze({ status: "failed", phase, reason });
}

function channelFailed(
  reason: LocalDesenBundleChannelPublicationFailureReason,
  request: CapturedPublicationRequest,
  bundleStatus: LocalDesenBundlePublicationStatus,
): LocalDesenBundleChannelPublicationFailure {
  return Object.freeze({
    status: "failed",
    phase: "channel-write",
    reason,
    revision: request.revision,
    bundleStatus,
  });
}

function authorizationHeaders(apiToken: string): Readonly<Record<string, string>> {
  return Object.freeze({ authorization: `Bearer ${apiToken}` });
}

function putHeaders(
  apiToken: string,
  expectedGeneration?: number | null,
): Readonly<Record<string, string>> {
  return Object.freeze({
    authorization: `Bearer ${apiToken}`,
    "content-type": "application/json",
    ...(expectedGeneration === undefined
      ? {}
      : expectedGeneration === null
        ? { "if-none-match": "*" }
        : { "if-match": `"g:${String(expectedGeneration)}"` }),
  });
}

function channelUrl(options: CapturedOptions): string {
  return `${options.origin}/v1/channels/${options.channelName}`;
}

function bundleUrl(options: CapturedOptions, revision: string): string {
  return `${options.origin}/v1/bundles/${revision}`;
}

async function readChannelSnapshot(
  options: CapturedOptions,
): Promise<ChannelSnapshot | LocalDesenBundleChannelPublicationFailure> {
  let raw: LocalDesenBundleChannelPublicationFetchResponse;
  try {
    raw = await options.fetch(
      Object.freeze({
        method: "GET" as const,
        url: channelUrl(options),
        headers: authorizationHeaders(options.apiToken),
        redirect: "error" as const,
      }),
    );
  } catch {
    return failed("channel-read", "storage-unavailable");
  }
  const response = captureResponse(raw);
  if (response === undefined) return failed("channel-read", "storage-unavailable");
  if (response.status === 404 && errorCode(response) === "CHANNEL_NOT_FOUND") {
    return Object.freeze({ status: "missing" });
  }
  if (response.status !== 200) return failed("channel-read", readFailureReason(response));
  const body = parsedJsonRecord(response, ["channelName", "generation", "revision"]);
  const generation = generationFromEtag(response.headers.etag);
  if (
    body === undefined ||
    body.channelName !== options.channelName ||
    !positiveGeneration(body.generation) ||
    body.generation !== generation ||
    typeof body.revision !== "string" ||
    !SHA256_DIGEST_PATTERN.test(body.revision)
  ) {
    return failed("channel-read", "channel-invalid");
  }
  return Object.freeze({ status: "found", generation: body.generation, revision: body.revision });
}

function bundleSuccess(
  response: CapturedResponse,
  revision: string,
): LocalDesenBundlePublicationStatus | undefined {
  if (response.headers.etag !== `"${revision}"`) return undefined;
  const body = parsedJsonRecord(response, ["revision", "status"]);
  if (body?.revision !== revision) return undefined;
  if (response.status === 201 && body.status === "stored") return "stored";
  if (response.status === 200 && body.status === "unchanged") return "unchanged";
  return undefined;
}

function channelSuccess(
  response: CapturedResponse,
  options: CapturedOptions,
  request: CapturedPublicationRequest,
  snapshot: ChannelSnapshot,
):
  | Readonly<{
      readonly status: LocalDesenChannelPublicationStatus;
      readonly generation: number;
    }>
  | undefined {
  const body = parsedJsonRecord(response, ["channelName", "generation", "revision", "status"]);
  const generation = generationFromEtag(response.headers.etag);
  if (
    body === undefined ||
    body.channelName !== options.channelName ||
    body.revision !== request.revision ||
    !positiveGeneration(body.generation) ||
    body.generation !== generation
  ) {
    return undefined;
  }
  if (
    snapshot.status === "missing" &&
    response.status === 201 &&
    body.status === "created" &&
    generation === 1
  ) {
    return Object.freeze({ status: "created", generation: 1 });
  }
  if (snapshot.status !== "found" || response.status !== 200) return undefined;
  if (
    body.status === "updated" &&
    snapshot.generation < Number.MAX_SAFE_INTEGER &&
    generation === snapshot.generation + 1
  ) {
    return Object.freeze({ status: "updated", generation });
  }
  if (
    body.status === "unchanged" &&
    snapshot.revision === request.revision &&
    generation === snapshot.generation
  ) {
    return Object.freeze({ status: "unchanged", generation });
  }
  return undefined;
}

function conflictGeneration(
  response: CapturedResponse,
  expectedGeneration: number | null,
): number | null | undefined {
  if (response.status !== 412 || errorCode(response) !== "GENERATION_MISMATCH") return undefined;
  const etag = response.headers.etag;
  if (etag === undefined) return expectedGeneration === null ? undefined : null;
  const currentGeneration = generationFromEtag(etag);
  if (currentGeneration === undefined || currentGeneration === expectedGeneration) return undefined;
  return currentGeneration;
}

/**
 * Creates a browser-safe adapter for one exact local Bundle store and one fixed mutable channel.
 *
 * @remarks Every attempt snapshots the channel before writing the immutable Bundle, then uses that
 * initial generation as the sole channel compare-and-set precondition. It never retries a channel
 * conflict or uses an implicit global fetch. Bundle PUT ambiguity is safely retryable only with the
 * same revision and bytes; channel PUT ambiguity remains explicitly indeterminate. Moving a channel
 * is discovery intent only and grants no staging, activation, or active-revision authority.
 */
export function createLocalDesenBundleChannelPublicationPort<const ChannelName extends string>(
  options: LocalDesenBundleChannelPublicationOptions<ChannelName>,
): LocalDesenBundleChannelPublicationPort<ChannelName> {
  const captured = captureOptions(options);

  const publishBundleToChannel: LocalDesenBundleChannelPublicationPort<ChannelName>["publishBundleToChannel"] =
    async (input) => {
      const request = capturePublicationRequest(input);
      if (request === undefined) return failed("request", "bundle-invalid");

      const snapshot = await readChannelSnapshot(captured);
      if (snapshot.status === "failed") return snapshot;

      let rawBundle: LocalDesenBundleChannelPublicationFetchResponse;
      try {
        rawBundle = await captured.fetch(
          Object.freeze({
            method: "PUT" as const,
            url: bundleUrl(captured, request.revision),
            headers: putHeaders(captured.apiToken),
            body: new Uint8Array(request.bundleBytes),
            redirect: "error" as const,
          }),
        );
      } catch {
        return Object.freeze({
          status: "indeterminate",
          phase: "bundle-write",
          revision: request.revision,
        });
      }
      const bundleResponse = captureResponse(rawBundle);
      if (bundleResponse === undefined) {
        return Object.freeze({
          status: "indeterminate",
          phase: "bundle-write",
          revision: request.revision,
        });
      }
      const bundleStatus = bundleSuccess(bundleResponse, request.revision);
      if (bundleStatus === undefined) {
        const reason = definiteBundleWriteFailure(bundleResponse);
        return reason === undefined
          ? Object.freeze({
              status: "indeterminate" as const,
              phase: "bundle-write" as const,
              revision: request.revision,
            })
          : failed("bundle-write", reason);
      }

      const expectedGeneration = snapshot.status === "missing" ? null : snapshot.generation;
      const channelBody = new TextEncoder().encode(JSON.stringify({ revision: request.revision }));
      let rawChannel: LocalDesenBundleChannelPublicationFetchResponse;
      try {
        rawChannel = await captured.fetch(
          Object.freeze({
            method: "PUT" as const,
            url: channelUrl(captured),
            headers: putHeaders(captured.apiToken, expectedGeneration),
            body: channelBody,
            redirect: "error" as const,
          }),
        );
      } catch {
        return Object.freeze({
          status: "indeterminate",
          phase: "channel-write",
          revision: request.revision,
          bundleStatus,
        });
      }
      const channelResponse = captureResponse(rawChannel);
      if (channelResponse === undefined) {
        return Object.freeze({
          status: "indeterminate",
          phase: "channel-write",
          revision: request.revision,
          bundleStatus,
        });
      }
      const success = channelSuccess(channelResponse, captured, request, snapshot);
      if (success !== undefined) {
        return Object.freeze({
          status: "published",
          channelName: captured.channelName as ChannelName,
          revision: request.revision,
          bundleStatus,
          channelStatus: success.status,
          channelGeneration: success.generation,
        });
      }
      const currentGeneration = conflictGeneration(channelResponse, expectedGeneration);
      if (currentGeneration !== undefined) {
        return Object.freeze({
          status: "conflict",
          revision: request.revision,
          bundleStatus,
          currentGeneration,
        });
      }
      const reason = definiteChannelWriteFailure(channelResponse, expectedGeneration);
      return reason === undefined
        ? Object.freeze({
            status: "indeterminate" as const,
            phase: "channel-write" as const,
            revision: request.revision,
            bundleStatus,
          })
        : channelFailed(reason, request, bundleStatus);
    };

  return Object.freeze({ publishBundleToChannel });
}
