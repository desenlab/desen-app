/* eslint-disable @typescript-eslint/no-invalid-void-type -- Public read methods are deliberately
 * receiver-independent at this closed loopback transport boundary. */
import {
  LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN,
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  LOCAL_CONTROL_PLANE_LIMITS,
} from "@desen/control-plane-api";

const REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const CHANNEL_ETAG_PATTERN = /^"g:([1-9][0-9]*)"$/u;
const IDENTIFIER_PATTERN = new RegExp(LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN, "u");
const MAX_CHANNEL_RESPONSE_BYTES = 512;
const MAX_RESPONSE_CHUNKS = 1_024;
const CHANNEL_RESPONSE_MEDIA_TYPE = `${LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE}; charset=utf-8`;
const BUNDLE_RESPONSE_MEDIA_TYPE = LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE;

/** Immutable channel discovery record authenticated by the loopback transport boundary. */
export interface ReferenceHostChannelRecord {
  /** Exact configured channel name. */
  readonly channelName: string;
  /** Positive safe-integer mutable channel generation. */
  readonly generation: number;
  /** Exact immutable Bundle revision selected by the channel snapshot. */
  readonly revision: string;
}

/** Exact stored Bundle bytes authenticated against their transport revision and ETag. */
export interface ReferenceHostBundleEntry {
  /** Exact lowercase SHA-256 revision requested from the control plane. */
  readonly revision: string;
  /** Fresh bounded response bytes; callers never receive a network stream or bearer authority. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Closed loopback read result that deliberately exposes no response body or technical error. */
export type ReferenceHostControlPlaneReadResult<Value> =
  | Readonly<{ readonly status: "found"; readonly value: Value }>
  | Readonly<{ readonly status: "unavailable" }>;

/** Trusted configuration for one fixed-channel loopback control-plane client. */
export interface CreateReferenceHostControlPlaneClientOptions {
  /** Exact `http://127.0.0.1:<port>` origin returned by the local control plane. */
  readonly origin: string;
  /** Visible-ASCII bearer secret retained only by this Node.js application. */
  readonly apiToken: string;
  /** Fixed application-owned channel name; Bundle data cannot replace it. */
  readonly channelName: string;
}

/** Narrow read-only client for the two T05 routes required by reference-host activation. */
export interface ReferenceHostControlPlaneClient {
  /** Reads and completely validates the configured channel snapshot. */
  readonly readChannel: (
    this: void,
  ) => Promise<ReferenceHostControlPlaneReadResult<ReferenceHostChannelRecord>>;
  /** Reads one exact immutable Bundle through the bearer-authenticated loopback route. */
  readonly readBundle: (
    this: void,
    revision: string,
  ) => Promise<ReferenceHostControlPlaneReadResult<ReferenceHostBundleEntry>>;
}

function exactLoopbackOrigin(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 128) return undefined;
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u.exec(value);
  if (match === null) return undefined;
  const port = Number(match[1]);
  return Number.isSafeInteger(port) && port >= 1 && port <= 65_535 ? value : undefined;
}

function validBearer(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= LOCAL_CONTROL_PLANE_LIMITS.minApiTokenUtf8Bytes &&
    value.length <= LOCAL_CONTROL_PLANE_LIMITS.maxApiTokenUtf8Bytes &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function exactOwnDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))
  ) {
    return undefined;
  }
  const captured: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      return undefined;
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

async function boundedResponseBytes(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array | undefined> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLength)) return undefined;
    const claimed = Number(contentLength);
    if (!Number.isSafeInteger(claimed) || claimed < 1 || claimed > maximumBytes) return undefined;
  }
  const body = response.body;
  if (body === null) return undefined;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let chunkCount = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = next.value;
      if (chunk.byteLength === 0) continue;
      chunkCount += 1;
      byteLength += chunk.byteLength;
      if (chunkCount > MAX_RESPONSE_CHUNKS || byteLength > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
      chunks.push(new Uint8Array(chunk));
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return undefined;
  } finally {
    reader.releaseLock();
  }
  if (byteLength === 0 || (contentLength !== null && Number(contentLength) !== byteLength)) {
    return undefined;
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Rejected transport cleanup cannot change the closed public result.
  }
}

function responseIdentityIsExact(
  response: Response,
  requestedUrl: string,
  expectedMediaType: string,
): boolean {
  return (
    response.redirected === false &&
    response.url === requestedUrl &&
    response.headers.get("content-type") === expectedMediaType &&
    response.headers.get("content-encoding") === null
  );
}

async function get(
  url: string,
  apiToken: string,
  maximumBytes: number,
  expectedMediaType: string,
): Promise<Readonly<{ readonly response: Response; readonly bytes: Uint8Array }> | undefined> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: Object.freeze({
        accept: LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
        authorization: `Bearer ${apiToken}`,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(LOCAL_CONTROL_PLANE_LIMITS.requestTimeoutMilliseconds),
    });
    if (response.status !== 200 || !responseIdentityIsExact(response, url, expectedMediaType)) {
      await cancelResponseBody(response);
      return undefined;
    }
    const bytes = await boundedResponseBytes(response, maximumBytes);
    if (bytes === undefined) {
      await cancelResponseBody(response);
      return undefined;
    }
    return Object.freeze({ response, bytes });
  } catch {
    return undefined;
  }
}

/**
 * Creates a read-only client for one exact local control-plane origin and channel.
 *
 * @throws {TypeError} When trusted configuration is not the closed loopback profile.
 */
export function createReferenceHostControlPlaneClient(
  options: CreateReferenceHostControlPlaneClientOptions,
): ReferenceHostControlPlaneClient {
  const captured = exactOwnDataRecord(options, ["origin", "apiToken", "channelName"]);
  const origin = exactLoopbackOrigin(captured?.origin);
  const apiToken = captured?.apiToken;
  const channelName = captured?.channelName;
  if (
    origin === undefined ||
    !validBearer(apiToken) ||
    typeof channelName !== "string" ||
    !IDENTIFIER_PATTERN.test(channelName)
  ) {
    throw new TypeError("The reference host control-plane configuration is invalid.");
  }

  return Object.freeze({
    async readChannel(): Promise<ReferenceHostControlPlaneReadResult<ReferenceHostChannelRecord>> {
      const url = `${origin}/v1/channels/${channelName}`;
      const read = await get(
        url,
        apiToken,
        MAX_CHANNEL_RESPONSE_BYTES,
        CHANNEL_RESPONSE_MEDIA_TYPE,
      );
      if (read === undefined) return Object.freeze({ status: "unavailable" });
      const etag = read.response.headers.get("etag");
      const etagMatch = etag === null ? null : CHANNEL_ETAG_PATTERN.exec(etag);
      try {
        const parsed = JSON.parse(
          new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(read.bytes),
        );
        const record = exactOwnDataRecord(parsed, ["channelName", "generation", "revision"]);
        const generation = record?.generation;
        const revision = record?.revision;
        if (
          record?.channelName !== channelName ||
          typeof generation !== "number" ||
          !Number.isSafeInteger(generation) ||
          generation < 1 ||
          generation > LOCAL_CONTROL_PLANE_LIMITS.maxGeneration ||
          typeof revision !== "string" ||
          !REVISION_PATTERN.test(revision) ||
          etagMatch === null ||
          Number(etagMatch[1]) !== generation
        ) {
          return Object.freeze({ status: "unavailable" });
        }
        return Object.freeze({
          status: "found",
          value: Object.freeze({ channelName, generation, revision }),
        });
      } catch {
        return Object.freeze({ status: "unavailable" });
      }
    },
    async readBundle(
      revision: string,
    ): Promise<ReferenceHostControlPlaneReadResult<ReferenceHostBundleEntry>> {
      if (!REVISION_PATTERN.test(revision)) return Object.freeze({ status: "unavailable" });
      const url = `${origin}/v1/bundles/${revision}`;
      const read = await get(
        url,
        apiToken,
        LOCAL_CONTROL_PLANE_LIMITS.maxBundleUtf8Bytes,
        BUNDLE_RESPONSE_MEDIA_TYPE,
      );
      if (read === undefined || read.response.headers.get("etag") !== `"${revision}"`) {
        return Object.freeze({ status: "unavailable" });
      }
      return Object.freeze({
        status: "found",
        value: Object.freeze({ revision, bytes: new Uint8Array(read.bytes) }),
      });
    },
  });
}
