/* eslint-disable @typescript-eslint/no-invalid-void-type -- Browser transports are explicit,
 * receiver-independent capabilities at the trusted local-publication boundary. */
import { createLocalDesenBundleChannelPublicationPort } from "@desen/editor-web";
import { isSha256Digest } from "@desen/protocol";

import { createFixedDestinationAuthoringPublicationPort } from "./authoring-publication.js";

import type {
  LocalDesenBundleChannelPublicationFetch,
  LocalDesenBundleChannelPublicationFetchRequest,
  LocalDesenBundleChannelPublicationFetchResponse,
} from "@desen/editor-web";
import type {
  AuthoringHostActivationRequest,
  AuthoringHostActivationSettlement,
  AuthoringPublicationPort,
} from "./authoring-publication.js";

/** Exact profile discriminator injected only by the trusted local DESEN launcher. */
export const DESEN_APP_LOCAL_PUBLICATION_PROFILE = "desen.app.local-publication.v1" as const;

const CONFIG_KEYS = Object.freeze([
  "activation",
  "controlPlane",
  "destination",
  "profile",
] as const);
const AUTHORITY_KEYS = Object.freeze(["apiToken", "origin"] as const);
const DESTINATION_KEYS = Object.freeze(["channelName", "hostId"] as const);
const ACTIVE_KEYS = Object.freeze([
  "activationGeneration",
  "activeRevision",
  "relationship",
  "status",
] as const);
const STATUS_KEYS = Object.freeze(["status"] as const);
const LOOPBACK_ORIGIN_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const LOCAL_IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;
const MAX_CHANNEL_RESPONSE_BYTES = 65_536;
const MAX_ACTIVATION_RESPONSE_BYTES = 8_192;
const MAX_BUNDLE_REQUEST_BYTES = 2_097_152;
const MAX_RESPONSE_CHUNKS = 1_024;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_CODE_UNITS = 32_768;
const FETCH_TIMEOUT_MILLISECONDS = 20_000;
const ACTIVATION_PATH = "/v1/activate-published-revision";

declare const __DESEN_APP_LOCAL_PUBLICATION_CONFIG__: unknown;

/** One exact loopback HTTP authority injected into the browser composition. */
export interface DesenAppLocalPublicationAuthorityConfig {
  /** Visible-ASCII bearer retained only by this local composition. */
  readonly apiToken: string;
  /** Exact fixed-loopback listener origin. */
  readonly origin: string;
}

/** Profile-owned publication destination admitted before any network effect. */
export interface DesenAppLocalPublicationDestinationConfig {
  /** Fixed local control-plane channel. */
  readonly channelName: string;
  /** Fixed installed reference-host identity. */
  readonly hostId: string;
}

/** Closed local publication configuration accepted by the normal DESEN product entry. */
export interface DesenAppLocalPublicationConfig {
  /** Exact versioned profile discriminator; unknown profiles fail closed. */
  readonly profile: typeof DESEN_APP_LOCAL_PUBLICATION_PROFILE;
  /** Browser-safe Bundle store and channel authority. */
  readonly controlPlane: DesenAppLocalPublicationAuthorityConfig;
  /** Independently authorized server-owned host activation bridge. */
  readonly activation: DesenAppLocalPublicationAuthorityConfig;
  /** Exact channel and host selected by trusted workspace configuration. */
  readonly destination: DesenAppLocalPublicationDestinationConfig;
}

/** Explicit browser fetch capability used by local publication composition. */
export type DesenAppLocalPublicationBrowserFetch = (
  this: void,
  input: string,
  init: RequestInit,
) => Promise<Response>;

/** Stable redacted reasons why local publication composition was rejected. */
export type DesenAppLocalPublicationConfigurationErrorCode = "INVALID_CONFIG" | "INVALID_FETCH";

const ERROR_MESSAGES: Readonly<Record<DesenAppLocalPublicationConfigurationErrorCode, string>> =
  Object.freeze({
    INVALID_CONFIG: "The DESEN local publication configuration is invalid.",
    INVALID_FETCH: "The DESEN local publication transport is invalid.",
  });

/** Redacted configuration failure that never includes a token, origin, or caller value. */
export class DesenAppLocalPublicationConfigurationError extends Error {
  /** Stable machine-readable classification. */
  readonly code: DesenAppLocalPublicationConfigurationErrorCode;

  /** Creates one fixed-message local-publication failure. */
  constructor(code: DesenAppLocalPublicationConfigurationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "DesenAppLocalPublicationConfigurationError";
    this.code = code;
  }
}

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

function captureOrigin(value: unknown): string | undefined {
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

function captureToken(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length >= 32 &&
    value.length <= 256 &&
    VISIBLE_ASCII_PATTERN.test(value)
    ? value
    : undefined;
}

/** Re-admits an untrusted injected value as one detached, frozen local publication profile. */
export function captureDesenAppLocalPublicationConfig(
  value: unknown,
): DesenAppLocalPublicationConfig {
  const config = exactOwnData(value, CONFIG_KEYS);
  const controlPlane = exactOwnData(config?.controlPlane, AUTHORITY_KEYS);
  const activation = exactOwnData(config?.activation, AUTHORITY_KEYS);
  const destination = exactOwnData(config?.destination, DESTINATION_KEYS);
  const controlPlaneOrigin = captureOrigin(controlPlane?.origin);
  const controlPlaneToken = captureToken(controlPlane?.apiToken);
  const activationOrigin = captureOrigin(activation?.origin);
  const activationToken = captureToken(activation?.apiToken);
  if (
    config?.profile !== DESEN_APP_LOCAL_PUBLICATION_PROFILE ||
    controlPlaneOrigin === undefined ||
    controlPlaneToken === undefined ||
    activationOrigin === undefined ||
    activationToken === undefined ||
    activationOrigin === controlPlaneOrigin ||
    activationToken === controlPlaneToken ||
    typeof destination?.channelName !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(destination.channelName) ||
    typeof destination.hostId !== "string" ||
    !LOCAL_IDENTIFIER_PATTERN.test(destination.hostId)
  ) {
    throw new DesenAppLocalPublicationConfigurationError("INVALID_CONFIG");
  }
  return Object.freeze({
    profile: DESEN_APP_LOCAL_PUBLICATION_PROFILE,
    controlPlane: Object.freeze({ origin: controlPlaneOrigin, apiToken: controlPlaneToken }),
    activation: Object.freeze({ origin: activationOrigin, apiToken: activationToken }),
    destination: Object.freeze({
      channelName: destination.channelName,
      hostId: destination.hostId,
    }),
  });
}

/** Reads the launcher-injected profile, or `null` in builds with no local publication authority. */
export function readInjectedDesenAppLocalPublicationConfig(): DesenAppLocalPublicationConfig | null {
  if (typeof __DESEN_APP_LOCAL_PUBLICATION_CONFIG__ === "undefined") return null;
  return captureDesenAppLocalPublicationConfig(__DESEN_APP_LOCAL_PUBLICATION_CONFIG__);
}

function captureBrowserFetch(value: unknown): DesenAppLocalPublicationBrowserFetch {
  if (typeof value !== "function") {
    throw new DesenAppLocalPublicationConfigurationError("INVALID_FETCH");
  }
  return value as DesenAppLocalPublicationBrowserFetch;
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = response.headers.get("content-length");
  let declaredLength: number | undefined;
  if (declared !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declared) || Number(declared) > maximumBytes) {
      throw new TypeError("The local publication response exceeds its fixed byte limit.");
    }
    declaredLength = Number(declared);
  }
  if (response.body === null) {
    if (declaredLength !== undefined && declaredLength !== 0) {
      throw new TypeError("The local publication response length is inconsistent.");
    }
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  let chunkCount = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      chunkCount += 1;
      const chunk = new Uint8Array(result.value);
      length += chunk.byteLength;
      if (length > maximumBytes || chunkCount > MAX_RESPONSE_CHUNKS) {
        await reader.cancel();
        throw new TypeError("The local publication response exceeds its fixed limits.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  if (declaredLength !== undefined && declaredLength !== length) {
    throw new TypeError("The local publication response length is inconsistent.");
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function captureResponseHeaders(response: Response): Readonly<Record<string, string>> {
  const headers: Record<string, string> = Object.create(null) as Record<string, string>;
  let count = 0;
  let codeUnits = 0;
  response.headers.forEach((value, name) => {
    count += 1;
    codeUnits += name.length + value.length;
    if (count <= MAX_HEADER_COUNT && codeUnits <= MAX_HEADER_CODE_UNITS) headers[name] = value;
  });
  if (count > MAX_HEADER_COUNT || codeUnits > MAX_HEADER_CODE_UNITS) {
    throw new TypeError("The local publication response headers exceed their fixed limit.");
  }
  return Object.freeze(headers);
}

async function browserRequest(
  browserFetch: DesenAppLocalPublicationBrowserFetch,
  input: string,
  init: RequestInit,
  maximumBytes: number,
): Promise<Readonly<{ response: Response; body: Uint8Array<ArrayBuffer> }>> {
  const abortController = new AbortController();
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = globalThis.setTimeout(() => {
      abortController.abort();
      reject(new TypeError("The local publication request exceeded its fixed time limit."));
    }, FETCH_TIMEOUT_MILLISECONDS);
  });
  try {
    const request = Promise.resolve().then(async () => {
      const response = await browserFetch(input, {
        ...init,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: abortController.signal,
      });
      if (!(response instanceof Response) || response.redirected) {
        throw new TypeError("The local publication response is invalid.");
      }
      return Object.freeze({ response, body: await readBoundedResponse(response, maximumBytes) });
    });
    return await Promise.race([request, deadline]);
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
  }
}

function captureChannelRequest(
  request: LocalDesenBundleChannelPublicationFetchRequest,
  config: DesenAppLocalPublicationConfig,
): Readonly<{
  body?: Uint8Array<ArrayBuffer>;
  headers: Readonly<Record<string, string>>;
  method: "GET" | "PUT";
  url: string;
}> {
  const parsed = new URL(request.url);
  const channelPath = `/v1/channels/${config.destination.channelName}`;
  const bundleRevision = parsed.pathname.startsWith("/v1/bundles/")
    ? parsed.pathname.slice("/v1/bundles/".length)
    : "";
  const validPath = parsed.pathname === channelPath || isSha256Digest(bundleRevision);
  const body = request.body === undefined ? undefined : new Uint8Array(request.body);
  if (
    parsed.origin !== config.controlPlane.origin ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !validPath ||
    request.redirect !== "error" ||
    (request.method === "GET" && body !== undefined) ||
    (request.method === "PUT" && (body === undefined || body.byteLength > MAX_BUNDLE_REQUEST_BYTES))
  ) {
    throw new TypeError("The local publication request escaped its fixed authority.");
  }
  return Object.freeze({
    method: request.method,
    url: request.url,
    headers: Object.freeze({ ...request.headers }),
    ...(body === undefined ? {} : { body }),
  });
}

function createChannelFetch(
  config: DesenAppLocalPublicationConfig,
  browserFetch: DesenAppLocalPublicationBrowserFetch,
): LocalDesenBundleChannelPublicationFetch {
  return async (
    request: LocalDesenBundleChannelPublicationFetchRequest,
  ): Promise<LocalDesenBundleChannelPublicationFetchResponse> => {
    const captured = captureChannelRequest(request, config);
    const { response, body } = await browserRequest(
      browserFetch,
      captured.url,
      {
        method: captured.method,
        headers: captured.headers,
        ...(captured.body === undefined ? {} : { body: captured.body }),
      },
      MAX_CHANNEL_RESPONSE_BYTES,
    );
    return Object.freeze({
      status: response.status,
      headers: captureResponseHeaders(response),
      body,
    });
  };
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

function captureActivationSettlement(
  value: unknown,
  request: AuthoringHostActivationRequest,
): AuthoringHostActivationSettlement | undefined {
  const statusOnly = exactOwnData(value, STATUS_KEYS, true);
  if (
    statusOnly?.status === "unavailable" ||
    statusOnly?.status === "failed" ||
    statusOnly?.status === "indeterminate"
  ) {
    return Object.freeze({ status: statusOnly.status });
  }
  const active = exactOwnData(value, ACTIVE_KEYS, true);
  if (
    active?.status !== "active" ||
    (active.relationship !== "activated" &&
      active.relationship !== "preserved" &&
      active.relationship !== "recovered") ||
    active.activeRevision !== request.revision ||
    !Number.isSafeInteger(active.activationGeneration) ||
    (active.activationGeneration as number) < 0
  ) {
    return undefined;
  }
  return Object.freeze({
    status: "active",
    relationship: active.relationship,
    activeRevision: active.activeRevision,
    activationGeneration: active.activationGeneration as number,
  });
}

async function activatePublishedRevision(
  config: DesenAppLocalPublicationConfig,
  browserFetch: DesenAppLocalPublicationBrowserFetch,
  request: AuthoringHostActivationRequest,
): Promise<AuthoringHostActivationSettlement> {
  const body = JSON.stringify(request);
  try {
    const result = await browserRequest(
      browserFetch,
      `${config.activation.origin}${ACTIVATION_PATH}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.activation.apiToken}`,
          "content-type": "application/json",
        },
        body,
      },
      MAX_ACTIVATION_RESPONSE_BYTES,
    );
    if (
      result.response.status !== 200 ||
      !/^application\/json(?:;\s*charset=utf-8)?$/iu.test(
        result.response.headers.get("content-type") ?? "",
      )
    ) {
      return Object.freeze({ status: "failed" });
    }
    return (
      captureActivationSettlement(parseJson(result.body), request) ??
      Object.freeze({ status: "indeterminate" as const })
    );
  } catch {
    return Object.freeze({ status: "indeterminate" });
  }
}

/** Creates a fixed-destination App port over browser-safe publication and host activation edges. */
export function createDesenAppLocalPublicationPort(
  configValue: unknown,
  browserFetchValue: unknown,
): AuthoringPublicationPort {
  const config = captureDesenAppLocalPublicationConfig(configValue);
  const browserFetch = captureBrowserFetch(browserFetchValue);
  const channelPort = createLocalDesenBundleChannelPublicationPort({
    origin: config.controlPlane.origin,
    apiToken: config.controlPlane.apiToken,
    channelName: config.destination.channelName,
    fetch: createChannelFetch(config, browserFetch),
  });
  return createFixedDestinationAuthoringPublicationPort({
    channelName: config.destination.channelName,
    hostId: config.destination.hostId,
    publishBundleToChannel: channelPort.publishBundleToChannel,
    activatePublishedRevision: (request) =>
      activatePublishedRevision(config, browserFetch, request),
  });
}

/** Creates the injected App publication port, or `null` when no local launcher configured it. */
export function createInjectedDesenAppLocalPublicationPort(
  browserFetchValue: unknown,
): AuthoringPublicationPort | null {
  const config = readInjectedDesenAppLocalPublicationConfig();
  return config === null ? null : createDesenAppLocalPublicationPort(config, browserFetchValue);
}
