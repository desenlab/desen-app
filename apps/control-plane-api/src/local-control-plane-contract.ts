/* eslint-disable @typescript-eslint/no-invalid-void-type -- Public callbacks are deliberately
 * receiver-independent at the closed local transport boundary. */

/** Exact IPv4 loopback address used by every M07-T05 network listener. */
export const LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS = "127.0.0.1" as const;

/** Exact media type admitted and emitted by the local DESEN control-plane API. */
export const LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE = "application/json" as const;

/** Exact grammar for local Source keys and channel names. */
export const LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN = "^[a-z][a-z0-9-]{0,63}$" as const;

/** Finite transport, JSON, identity, and concurrency limits for the M07-T05 local profile. */
export interface LocalControlPlaneLimits {
  /** Maximum milliseconds a connected HTTP socket may remain inactive. */
  readonly connectionTimeoutMilliseconds: number;
  /** Maximum milliseconds allowed to receive one complete HTTP request. */
  readonly requestTimeoutMilliseconds: number;
  /** Maximum milliseconds an idle HTTP keep-alive socket remains open. */
  readonly keepAliveTimeoutMilliseconds: number;
  /** Maximum raw UTF-8 bytes accepted for one editable Source. */
  readonly maxSourceUtf8Bytes: number;
  /** Maximum RFC 8785 canonical UTF-8 bytes accepted for one editable Source. */
  readonly maxSourceCanonicalUtf8Bytes: number;
  /** Maximum raw bytes accepted for one immutable Bundle transport request. */
  readonly maxBundleUtf8Bytes: number;
  /** Maximum raw UTF-8 bytes accepted for one closed channel request body. */
  readonly maxChannelBodyUtf8Bytes: number;
  /** Maximum code units accepted in one Source key or channel name. */
  readonly maxIdentifierCodeUnits: number;
  /** Minimum visible-ASCII UTF-8 bytes required for one bearer token. */
  readonly minApiTokenUtf8Bytes: number;
  /** Maximum visible-ASCII UTF-8 bytes retained from one bearer token. */
  readonly maxApiTokenUtf8Bytes: number;
  /** Maximum exact browser origins admitted by trusted host configuration. */
  readonly maxAllowedOrigins: number;
  /** Maximum code units accepted in one configured browser origin. */
  readonly maxOriginCodeUnits: number;
  /** Maximum object/array nesting depth accepted in Source and channel JSON. */
  readonly maxJsonDepth: number;
  /** Maximum JSON value occurrences accepted in one Source document. */
  readonly maxJsonValueOccurrences: number;
  /** Maximum aggregate decoded UTF-16 code units accepted across Source keys and strings. */
  readonly maxDecodedStringCodeUnits: number;
  /** Maximum code units accepted in one raw JSON number token. */
  readonly maxNumberTokenCodeUnits: number;
  /** Largest exact compare-and-set generation exposed through JavaScript and JSON. */
  readonly maxGeneration: number;
}

/**
 * Frozen finite profile for local Source, Bundle, channel, and HTTP admission.
 *
 * @remarks These are implementation limits, not new DESEN 0.1.0 protocol constants. Source
 * limits match the independently reviewed bounded Source ingress profile. Bundle transport uses
 * the Reference Profile's 2 MiB raw ceiling but does not claim integrity verification.
 */
export const LOCAL_CONTROL_PLANE_LIMITS: Readonly<LocalControlPlaneLimits> = Object.freeze({
  connectionTimeoutMilliseconds: 5_000,
  requestTimeoutMilliseconds: 15_000,
  keepAliveTimeoutMilliseconds: 5_000,
  maxSourceUtf8Bytes: 8_388_608,
  maxSourceCanonicalUtf8Bytes: 8_388_608,
  maxBundleUtf8Bytes: 2_097_152,
  maxChannelBodyUtf8Bytes: 256,
  maxIdentifierCodeUnits: 64,
  minApiTokenUtf8Bytes: 32,
  maxApiTokenUtf8Bytes: 256,
  maxAllowedOrigins: 16,
  maxOriginCodeUnits: 2_048,
  maxJsonDepth: 256,
  maxJsonValueOccurrences: 262_144,
  maxDecodedStringCodeUnits: 4_194_304,
  maxNumberTokenCodeUnits: 1_024,
  maxGeneration: Number.MAX_SAFE_INTEGER,
});

/** Stable failure classifications exposed by the closed local control plane. */
export type LocalControlPlaneErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "BODY_LIMIT_EXCEEDED"
  | "BUNDLE_BYTES_CONFLICT"
  | "BUNDLE_NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "COMMIT_OUTCOME_INDETERMINATE"
  | "CONTENT_ENCODING_NOT_ALLOWED"
  | "GENERATION_EXHAUSTED"
  | "GENERATION_MISMATCH"
  | "HOST_NOT_ALLOWED"
  | "INTERNAL_FAILURE"
  | "INVALID_ALLOWED_ORIGIN"
  | "INVALID_API_TOKEN"
  | "INVALID_CHANNEL_BODY"
  | "INVALID_CHANNEL_NAME"
  | "INVALID_GENERATION"
  | "INVALID_PORT"
  | "INVALID_REQUEST"
  | "INVALID_REVISION"
  | "INVALID_ROOT_DIRECTORY"
  | "INVALID_SOURCE_KEY"
  | "METADATA_BUSY"
  | "METADATA_CORRUPT"
  | "METHOD_NOT_ALLOWED"
  | "ORIGIN_NOT_ALLOWED"
  | "PRECONDITION_INVALID"
  | "PRECONDITION_REQUIRED"
  | "ROUTE_NOT_FOUND"
  | "SERVER_STATE_INVALID"
  | "SOURCE_JSON_INVALID"
  | "SOURCE_MATERIAL_LIMIT_EXCEEDED"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_SCHEMA_INVALID"
  | "STORAGE_IO_FAILURE"
  | "UNSAFE_STORAGE_PATH"
  | "UNSUPPORTED_MEDIA_TYPE";

/** Fixed redacted messages for every public local-control-plane failure code. */
export const LOCAL_CONTROL_PLANE_ERROR_MESSAGES: Readonly<
  Record<LocalControlPlaneErrorCode, string>
> = Object.freeze({
  AUTHENTICATION_REQUIRED: "Valid local control-plane authentication is required.",
  BODY_LIMIT_EXCEEDED: "The request body exceeds the fixed local control-plane limit.",
  BUNDLE_BYTES_CONFLICT: "Different immutable Bundle bytes already own this revision.",
  BUNDLE_NOT_FOUND: "The requested immutable Bundle revision was not found.",
  CHANNEL_NOT_FOUND: "The requested channel was not found.",
  COMMIT_OUTCOME_INDETERMINATE:
    "The immutable Bundle may have committed; retry the exact revision and bytes.",
  CONTENT_ENCODING_NOT_ALLOWED: "Encoded request bodies are not accepted.",
  GENERATION_EXHAUSTED: "The mutable record has exhausted its finite generation range.",
  GENERATION_MISMATCH: "The compare-and-set generation does not match the current record.",
  HOST_NOT_ALLOWED: "The request host is not allowed by the local profile.",
  INTERNAL_FAILURE: "The local control plane could not complete the request.",
  INVALID_ALLOWED_ORIGIN: "The configured browser origin is invalid.",
  INVALID_API_TOKEN: "The configured local control-plane token is invalid.",
  INVALID_CHANNEL_BODY: "The channel request body is malformed.",
  INVALID_CHANNEL_NAME: "The channel name is invalid.",
  INVALID_GENERATION: "The compare-and-set generation is invalid.",
  INVALID_PORT: "The requested loopback port is invalid.",
  INVALID_REQUEST: "The local control-plane request is malformed.",
  INVALID_REVISION: "The Bundle revision is not an exact lowercase SHA-256 digest.",
  INVALID_ROOT_DIRECTORY: "The local control-plane root directory is invalid.",
  INVALID_SOURCE_KEY: "The editable Source key is invalid.",
  METADATA_BUSY: "The local metadata repository is busy.",
  METADATA_CORRUPT: "The local metadata repository is inconsistent.",
  METHOD_NOT_ALLOWED: "The request method is not allowed for this route.",
  ORIGIN_NOT_ALLOWED: "The browser origin is not allowed by the local profile.",
  PRECONDITION_INVALID: "The compare-and-set HTTP precondition is malformed.",
  PRECONDITION_REQUIRED: "An exact compare-and-set HTTP precondition is required.",
  ROUTE_NOT_FOUND: "The local control-plane route was not found.",
  SERVER_STATE_INVALID:
    "The local control plane cannot perform this operation in its current state.",
  SOURCE_JSON_INVALID: "The editable Source is not strict interoperable JSON.",
  SOURCE_MATERIAL_LIMIT_EXCEEDED: "The editable Source exceeds a fixed finite JSON limit.",
  SOURCE_NOT_FOUND: "The requested editable Source was not found.",
  SOURCE_SCHEMA_INVALID: "The editable Source root envelope is invalid.",
  STORAGE_IO_FAILURE: "The local control plane could not complete the storage operation.",
  UNSAFE_STORAGE_PATH: "The local control plane encountered an unsafe storage entry.",
  UNSUPPORTED_MEDIA_TYPE: "The request media type is not supported.",
});

/** Redacted failure raised while configuring or operating the local control plane. */
export class LocalControlPlaneError extends Error {
  /** Stable reason for the rejected operation. */
  readonly code: LocalControlPlaneErrorCode;

  /** Creates one fixed-message local-control-plane failure. */
  constructor(code: LocalControlPlaneErrorCode) {
    super(LOCAL_CONTROL_PLANE_ERROR_MESSAGES[code]);
    this.name = "LocalControlPlaneError";
    this.code = code;
  }
}

/** Stable JSON error detail returned by the local HTTP boundary. */
export interface LocalControlPlaneErrorDetail {
  /** Stable machine-readable failure code. */
  readonly code: LocalControlPlaneErrorCode;
  /** Fixed redacted message associated with `code`. */
  readonly message: string;
}

/** Closed JSON error envelope returned by the local HTTP boundary. */
export interface LocalControlPlaneErrorEnvelope {
  /** Redacted failure detail with no caller value, path, token, stack, SQL, or technical cause. */
  readonly error: LocalControlPlaneErrorDetail;
}

/** Trusted host configuration for opening one local control-plane instance. */
export interface OpenLocalControlPlaneOptions {
  /**
   * Pre-existing absolute, application-owned directory reserved for local DESEN state.
   *
   * @remarks Immutable Bundle files and mutable metadata remain physically and logically
   * separate beneath this root. The root must not be a symbolic link.
   */
  readonly rootDirectory: string;
  /**
   * Visible-ASCII bearer secret required by every data request.
   *
   * @remarks The implementation snapshots this value and retains only its SHA-256 digest. It is
   * never returned, logged, stored in Source or Bundle data, or accepted through a URL or cookie.
   */
  readonly apiToken: string;
  /**
   * Exact browser origins admitted by CORS and Origin enforcement.
   *
   * @remarks Omission is the secure default and admits no browser origin. Wildcards, `null`, URL
   * paths, credentials, fragments, suffix matches, and implicit port equivalence are prohibited.
   */
  readonly allowedOrigins?: readonly string[];
}

/** Uppercase HTTP methods accepted by the in-memory request dispatcher. */
export type LocalControlPlaneInjectMethod =
  "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";

/** Minimal immutable request supplied to the closed in-memory HTTP dispatcher. */
export interface LocalControlPlaneInjectRequest {
  /** Exact uppercase method; unsupported methods receive the ordinary controlled HTTP response. */
  readonly method: LocalControlPlaneInjectMethod;
  /** Absolute-path request target, including any deliberately tested query string. */
  readonly path: string;
  /** Detached scalar request headers keyed by their HTTP field names. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Exact request bytes; the dispatcher snapshots the view before asynchronous work. */
  readonly body?: Readonly<Uint8Array>;
}

/** HTTP status codes emitted by the closed local control-plane surface. */
export type LocalControlPlaneHttpStatusCode =
  200 | 201 | 204 | 400 | 401 | 403 | 404 | 405 | 409 | 412 | 413 | 415 | 428 | 500 | 503;

/** Minimal immutable response returned by the closed in-memory HTTP dispatcher. */
export interface LocalControlPlaneInjectResponse {
  /** Controlled response status. */
  readonly statusCode: LocalControlPlaneHttpStatusCode;
  /** Detached scalar response headers keyed by lowercase HTTP field names. */
  readonly headers: Readonly<Record<string, string>>;
  /** Fresh exact response bytes, or an empty view for a response with no body. */
  readonly body: Readonly<Uint8Array>;
}

/** Successful fixed-loopback listener identity. */
export interface LocalControlPlaneListenResult {
  /** Exact IPv4 loopback address; callers cannot select another bind address. */
  readonly address: typeof LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS;
  /** Actual bound TCP port, including an operating-system-selected port when zero was requested. */
  readonly port: number;
  /** Exact HTTP origin derived only from the fixed address and actual port. */
  readonly origin: string;
}

/**
 * Closed local Source, immutable Bundle, and mutable channel service.
 *
 * @remarks `inject` and `listen` expose the same authenticated routes. The service deliberately
 * has no list, delete, publish, package-resolution, reference-preflight, staging, commit,
 * activation, rollback, recovery, active-revision, or previous-good authority.
 */
export interface LocalControlPlane {
  /** Dispatches one request without opening a TCP listener and returns a detached response. */
  readonly inject: (
    this: void,
    request: LocalControlPlaneInjectRequest,
  ) => Promise<LocalControlPlaneInjectResponse>;
  /**
   * Starts the service on exact IPv4 loopback and the requested port.
   *
   * @remarks Port zero requests one operating-system-selected ephemeral port. No host, socket,
   * proxy, TLS, or remote-bind option is accepted by this local profile.
   */
  readonly listen: (this: void, port: number) => Promise<LocalControlPlaneListenResult>;
  /** Stops request admission, drains owned work, closes local metadata, and revokes the instance. */
  readonly close: (this: void) => Promise<void>;
}

/** Exact editable Source bytes stored under one local storage identity and CAS generation. */
export interface LocalControlPlaneSourceRecord {
  /** Local storage identity, independent of the DESEN Source document's `id`. */
  readonly sourceKey: string;
  /** Current positive safe-integer compare-and-set generation. */
  readonly generation: number;
  /** Exact persisted strict-JSON Source bytes returned through a fresh view. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Controlled result of reading one editable Source record. */
export type LocalControlPlaneSourceReadResult =
  | Readonly<{ readonly status: "found"; readonly record: LocalControlPlaneSourceRecord }>
  | Readonly<{ readonly status: "missing" }>;

/** Controlled result of one compare-and-set editable Source write. */
export type LocalControlPlaneSourcePutResult =
  | Readonly<{ readonly status: "created"; readonly generation: 1 }>
  | Readonly<{ readonly status: "updated"; readonly generation: number }>
  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>
  | Readonly<{
      readonly status: "precondition-failed";
      readonly currentGeneration: number | null;
    }>
  | Readonly<{ readonly status: "generation-exhausted"; readonly generation: number }>;

/** Exact immutable Bundle bytes addressed only by one lowercase SHA-256 revision. */
export interface LocalControlPlaneBundleRecord {
  /** Exact content-addressed storage key. */
  readonly revision: string;
  /** Exact stored bytes returned through a fresh view. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Controlled result of reading one immutable Bundle record. */
export type LocalControlPlaneBundleReadResult =
  | Readonly<{ readonly status: "found"; readonly record: LocalControlPlaneBundleRecord }>
  | Readonly<{ readonly status: "missing" }>;

/** Controlled result of one immutable exact-byte Bundle write. */
export type LocalControlPlaneBundlePutResult =
  | Readonly<{ readonly status: "stored" }>
  | Readonly<{ readonly status: "unchanged" }>
  | Readonly<{ readonly status: "conflict" }>;

/**
 * Mutable discovery pointer from one local channel name to one existing immutable Bundle.
 *
 * @remarks This record is not a staged, active, previous-good, committed, or recovered revision.
 * Its generation protects only concurrent channel metadata updates.
 */
export interface LocalControlPlaneChannelRecord {
  /** Exact local channel name. */
  readonly channelName: string;
  /** Existing immutable Bundle revision selected as an untrusted discovery candidate. */
  readonly revision: string;
  /** Current positive safe-integer compare-and-set generation. */
  readonly generation: number;
}

/** Controlled result of reading one mutable channel pointer. */
export type LocalControlPlaneChannelReadResult =
  | Readonly<{ readonly status: "found"; readonly record: LocalControlPlaneChannelRecord }>
  | Readonly<{ readonly status: "missing" }>;

/** Controlled result of one compare-and-set channel pointer write. */
export type LocalControlPlaneChannelPutResult =
  | Readonly<{ readonly status: "created"; readonly generation: 1 }>
  | Readonly<{ readonly status: "updated"; readonly generation: number }>
  | Readonly<{ readonly status: "unchanged"; readonly generation: number }>
  | Readonly<{
      readonly status: "precondition-failed";
      readonly currentGeneration: number | null;
    }>
  | Readonly<{ readonly status: "generation-exhausted"; readonly generation: number }>
  | Readonly<{ readonly status: "bundle-missing" }>;

/** Closed JSON request body for one mutable channel compare-and-set write. */
export interface LocalControlPlaneChannelPutBody {
  /** Existing immutable Bundle revision to expose as an untrusted discovery candidate. */
  readonly revision: string;
}
