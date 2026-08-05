/* eslint-disable @typescript-eslint/no-invalid-void-type -- Internal ports and closed callbacks are
 * deliberately receiver-independent at the local control-plane boundary. */

import { createHash, timingSafeEqual } from "node:crypto";
import { types as utilTypes } from "node:util";

import { isSha256Digest } from "@desen/protocol";
import Fastify from "fastify";

import { BundleStoreError } from "./bundle-store-contract.js";
import { guardBundleVerificationStructure } from "./bundle-verification-schema-guard.js";
import {
  LOCAL_CONTROL_PLANE_ERROR_MESSAGES,
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  LOCAL_CONTROL_PLANE_LIMITS,
  LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS,
  LocalControlPlaneError,
} from "./local-control-plane-contract.js";
import { LocalControlPlaneRepositoryError } from "./local-control-plane-repository-internal.js";
import { canonicalJsonByteLengthWithin, parseStrictJsonBytes } from "./strict-json-internal.js";

import type { BundleStore } from "./bundle-store-contract.js";
import type {
  LocalControlPlane,
  LocalControlPlaneErrorCode,
  LocalControlPlaneHttpStatusCode,
  LocalControlPlaneInjectRequest,
  LocalControlPlaneInjectResponse,
  LocalControlPlaneListenResult,
} from "./local-control-plane-contract.js";
import type {
  ChannelRecord,
  ChannelRepository,
  RepositoryReadResult,
  SourceRecord,
  SourceRepository,
} from "./local-control-plane-repository-internal.js";
import type { StrictJsonLimits, StrictJsonObject } from "./strict-json-internal.js";
import type { FastifyInstance, FastifyReply, FastifyRequest, RawServerDefault } from "fastify";

/** Package-private dependencies for one local HTTP application. @internal */
export interface LocalControlPlaneApplicationOptions {
  /** Exact snapshotted token accepted by the local HTTP boundary. */
  readonly apiToken: string;
  /** Already validated exact browser origins. */
  readonly allowedOrigins: readonly string[];
  /** Existing immutable Bundle store from M07-T01. */
  readonly bundleStore: BundleStore;
  /** Editable Source metadata repository. */
  readonly sourceRepository: SourceRepository;
  /** Mutable discovery-channel metadata repository. */
  readonly channelRepository: ChannelRepository;
  /** Closes the owned metadata repository after HTTP admission stops. */
  readonly closeMetadata: (this: void) => void | Promise<void>;
}

interface CapturedLocalControlPlaneRuntime {
  readonly bundleStore: BundleStore;
  readonly sourceRepository: SourceRepository;
  readonly channelRepository: ChannelRepository;
  readonly closeMetadata: (this: void) => void | Promise<void>;
}

interface IdentifierParams {
  readonly sourceKey: string;
}

interface RevisionParams {
  readonly revision: string;
}

interface ChannelParams {
  readonly channelName: string;
}

interface BufferBodyRoute<Params> {
  readonly Params: Params;
  readonly Body: Buffer;
}

interface ParamsOnlyRoute<Params> {
  readonly Params: Params;
}

type MutablePrecondition =
  | Readonly<{ readonly mode: "create" }>
  | Readonly<{ readonly mode: "update"; readonly generation: number }>;

const SOURCE_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  maxDecodedStringCodeUnits: LOCAL_CONTROL_PLANE_LIMITS.maxDecodedStringCodeUnits,
  maxDepth: LOCAL_CONTROL_PLANE_LIMITS.maxJsonDepth,
  maxNumberTokenCodeUnits: LOCAL_CONTROL_PLANE_LIMITS.maxNumberTokenCodeUnits,
  maxValueOccurrences: LOCAL_CONTROL_PLANE_LIMITS.maxJsonValueOccurrences,
});
const CHANNEL_JSON_LIMITS: StrictJsonLimits = Object.freeze({
  maxDecodedStringCodeUnits: 128,
  maxDepth: 2,
  maxNumberTokenCodeUnits: 32,
  maxValueOccurrences: 2,
});
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const GENERATION_ETAG_PATTERN = /^"g:([1-9][0-9]*)"$/u;
const LOOPBACK_HOST_PATTERN = /^127\.0\.0\.1(?::(0|[1-9][0-9]{0,4}))?$/u;
const MAX_REQUEST_TARGET_CODE_UNITS = 4_096;
const EMPTY_BYTES = Object.freeze(new Uint8Array());
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;

function isLocalIdentifier(value: string): boolean {
  return IDENTIFIER_PATTERN.test(value);
}

function generationEtag(generation: number): string {
  return `"g:${String(generation)}"`;
}

function bundleEtag(revision: string): string {
  return `"${revision}"`;
}

function errorEnvelope(code: LocalControlPlaneErrorCode): string {
  return JSON.stringify({
    error: {
      code,
      message: LOCAL_CONTROL_PLANE_ERROR_MESSAGES[code],
    },
  });
}

function sendError(
  reply: FastifyReply,
  statusCode: LocalControlPlaneHttpStatusCode,
  code: LocalControlPlaneErrorCode,
): FastifyReply {
  return reply
    .code(statusCode)
    .header("content-type", LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE)
    .send(errorEnvelope(code));
}

function sendJson(
  reply: FastifyReply,
  statusCode: 200 | 201,
  value: Readonly<Record<string, number | string>>,
): FastifyReply {
  return reply
    .code(statusCode)
    .header("content-type", LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE)
    .send(JSON.stringify(value));
}

function stringHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
}

function hasHeader(request: FastifyRequest, name: string): boolean {
  return request.headers[name] !== undefined;
}

function validLoopbackHost(value: string | undefined): boolean {
  if (value === undefined) return false;
  const match = LOOPBACK_HOST_PATTERN.exec(value);
  if (match === null) return false;
  const port = match[1];
  return port === undefined || Number(port) <= 65_535;
}

function authenticated(authorization: string | undefined, tokenDigest: Buffer): boolean {
  const candidate =
    authorization?.startsWith("Bearer ") === true ? authorization.slice("Bearer ".length) : "";
  const candidateDigest = createHash("sha256").update(candidate, "utf8").digest();
  return timingSafeEqual(candidateDigest, tokenDigest);
}

function mutablePrecondition(
  request: FastifyRequest,
): MutablePrecondition | LocalControlPlaneError {
  const ifMatch = stringHeader(request, "if-match");
  const ifNoneMatch = stringHeader(request, "if-none-match");
  if (ifMatch === undefined && ifNoneMatch === undefined) {
    return new LocalControlPlaneError("PRECONDITION_REQUIRED");
  }
  if (
    (ifMatch !== undefined && ifNoneMatch !== undefined) ||
    (hasHeader(request, "if-match") && ifMatch === undefined) ||
    (hasHeader(request, "if-none-match") && ifNoneMatch === undefined)
  ) {
    return new LocalControlPlaneError("PRECONDITION_INVALID");
  }
  if (ifNoneMatch !== undefined) {
    return ifNoneMatch === "*"
      ? Object.freeze({ mode: "create" })
      : new LocalControlPlaneError("PRECONDITION_INVALID");
  }
  const match = GENERATION_ETAG_PATTERN.exec(ifMatch as string);
  if (match === null) return new LocalControlPlaneError("INVALID_GENERATION");
  const generation = Number(match[1]);
  return Number.isSafeInteger(generation) && generation > 0
    ? Object.freeze({ mode: "update", generation })
    : new LocalControlPlaneError("INVALID_GENERATION");
}

function preconditionStatus(
  precondition: MutablePrecondition,
  current: RepositoryReadResult<SourceRecord | ChannelRecord>,
):
  | Readonly<{ readonly valid: true }>
  | Readonly<{ readonly valid: false; readonly generation: number | null }> {
  if (precondition.mode === "create") {
    return current.status === "missing"
      ? Object.freeze({ valid: true })
      : Object.freeze({ valid: false, generation: current.record.generation });
  }
  return current.status === "found" && current.record.generation === precondition.generation
    ? Object.freeze({ valid: true })
    : Object.freeze({
        valid: false,
        generation: current.status === "found" ? current.record.generation : null,
      });
}

function sendGenerationMismatch(reply: FastifyReply, generation: number | null): FastifyReply {
  if (generation !== null) reply.header("etag", generationEtag(generation));
  return sendError(reply, 412, "GENERATION_MISMATCH");
}

function mapBundleStoreError(error: BundleStoreError): LocalControlPlaneError {
  switch (error.code) {
    case "COMMIT_OUTCOME_INDETERMINATE":
      return new LocalControlPlaneError("COMMIT_OUTCOME_INDETERMINATE");
    case "INVALID_ENTRY":
      return new LocalControlPlaneError("INVALID_REQUEST");
    case "INVALID_REVISION":
      return new LocalControlPlaneError("INVALID_REVISION");
    case "INVALID_ROOT_DIRECTORY":
      return new LocalControlPlaneError("INVALID_ROOT_DIRECTORY");
    case "STORAGE_IO_FAILURE":
      return new LocalControlPlaneError("STORAGE_IO_FAILURE");
    case "UNSAFE_STORAGE_PATH":
      return new LocalControlPlaneError("UNSAFE_STORAGE_PATH");
  }
}

function publicFailure(error: unknown): LocalControlPlaneError {
  if (error instanceof LocalControlPlaneError) return error;
  if (error instanceof BundleStoreError) return mapBundleStoreError(error);
  if (error instanceof LocalControlPlaneRepositoryError) {
    switch (error.code) {
      case "INVALID_CHANNEL_NAME":
        return new LocalControlPlaneError("INVALID_CHANNEL_NAME");
      case "INVALID_CHANNEL_REVISION":
        return new LocalControlPlaneError("INVALID_REVISION");
      case "INVALID_GENERATION":
        return new LocalControlPlaneError("INVALID_GENERATION");
      case "INVALID_SOURCE_KEY":
        return new LocalControlPlaneError("INVALID_SOURCE_KEY");
      case "DUPLICATE_INITIAL_RECORD":
      case "INVALID_INITIAL_RECORDS":
      case "INVALID_SOURCE_BYTES":
        return new LocalControlPlaneError("INTERNAL_FAILURE");
    }
  }
  if (
    error !== null &&
    typeof error === "object" &&
    !Array.isArray(error) &&
    !utilTypes.isProxy(error)
  ) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(error, "code");
      const code = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
      if (
        code === "METADATA_BUSY" ||
        code === "METADATA_CORRUPT" ||
        code === "STORAGE_IO_FAILURE" ||
        code === "UNSAFE_STORAGE_PATH"
      ) {
        return new LocalControlPlaneError(code);
      }
    } catch {
      return new LocalControlPlaneError("INTERNAL_FAILURE");
    }
  }
  return new LocalControlPlaneError("INTERNAL_FAILURE");
}

function failureStatus(error: LocalControlPlaneError): LocalControlPlaneHttpStatusCode {
  switch (error.code) {
    case "AUTHENTICATION_REQUIRED":
      return 401;
    case "ORIGIN_NOT_ALLOWED":
    case "HOST_NOT_ALLOWED":
      return 403;
    case "SOURCE_NOT_FOUND":
    case "BUNDLE_NOT_FOUND":
    case "CHANNEL_NOT_FOUND":
    case "ROUTE_NOT_FOUND":
      return 404;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "BUNDLE_BYTES_CONFLICT":
    case "GENERATION_EXHAUSTED":
      return 409;
    case "GENERATION_MISMATCH":
      return 412;
    case "BODY_LIMIT_EXCEEDED":
    case "SOURCE_MATERIAL_LIMIT_EXCEEDED":
      return 413;
    case "UNSUPPORTED_MEDIA_TYPE":
      return 415;
    case "PRECONDITION_REQUIRED":
      return 428;
    case "COMMIT_OUTCOME_INDETERMINATE":
    case "METADATA_BUSY":
      return 503;
    case "INTERNAL_FAILURE":
    case "METADATA_CORRUPT":
    case "STORAGE_IO_FAILURE":
    case "UNSAFE_STORAGE_PATH":
    case "SERVER_STATE_INVALID":
      return 500;
    case "CONTENT_ENCODING_NOT_ALLOWED":
    case "INVALID_ALLOWED_ORIGIN":
    case "INVALID_API_TOKEN":
    case "INVALID_CHANNEL_BODY":
    case "INVALID_CHANNEL_NAME":
    case "INVALID_GENERATION":
    case "INVALID_PORT":
    case "INVALID_REQUEST":
    case "INVALID_REVISION":
    case "INVALID_ROOT_DIRECTORY":
    case "INVALID_SOURCE_KEY":
    case "PRECONDITION_INVALID":
    case "SOURCE_JSON_INVALID":
    case "SOURCE_SCHEMA_INVALID":
      return 400;
  }
}

function sendPublicFailure(reply: FastifyReply, error: unknown): FastifyReply {
  const publicError = publicFailure(error);
  return sendError(reply, failureStatus(publicError), publicError.code);
}

function requestPathIsResource(path: string): boolean {
  return /^\/v1\/(?:sources|bundles|channels)\/[^/]+$/u.test(path);
}

function requestedCorsHeaders(value: string | undefined): readonly string[] | undefined {
  if (value === undefined || value.trim() === "") return Object.freeze([]);
  const fields = value.split(",").map((field) => field.trim().toLowerCase());
  if (
    fields.some((field) => !/^[a-z0-9-]+$/u.test(field)) ||
    new Set(fields).size !== fields.length
  ) {
    return undefined;
  }
  const allowed = new Set(["authorization", "content-type", "if-match", "if-none-match"]);
  if (fields.some((field) => !allowed.has(field))) return undefined;
  return Object.freeze([...fields].sort());
}

function registerPreflight(
  app: FastifyInstance,
  path: "/v1/bundles/:revision" | "/v1/channels/:channelName" | "/v1/sources/:sourceKey",
): void {
  app.options(path, (request, reply) => {
    const origin = stringHeader(request, "origin");
    if (origin === undefined) return sendError(reply, 403, "ORIGIN_NOT_ALLOWED");
    const requestedMethod = stringHeader(request, "access-control-request-method");
    if (requestedMethod !== "GET" && requestedMethod !== "PUT") {
      return sendError(reply, 405, "METHOD_NOT_ALLOWED");
    }
    const identity = (request.raw.url ?? "").split("/").at(-1) ?? "";
    if (path.startsWith("/v1/sources/") && !isLocalIdentifier(identity)) {
      return sendError(reply, 400, "INVALID_SOURCE_KEY");
    }
    if (path.startsWith("/v1/channels/") && !isLocalIdentifier(identity)) {
      return sendError(reply, 400, "INVALID_CHANNEL_NAME");
    }
    if (path.startsWith("/v1/bundles/") && !isSha256Digest(identity)) {
      return sendError(reply, 400, "INVALID_REVISION");
    }
    const headers = requestedCorsHeaders(stringHeader(request, "access-control-request-headers"));
    if (headers === undefined || !headers.includes("authorization")) {
      return sendError(reply, 400, "INVALID_REQUEST");
    }
    const preconditionHeaders =
      Number(headers.includes("if-match")) + Number(headers.includes("if-none-match"));
    const mutableRoute = path.startsWith("/v1/sources/") || path.startsWith("/v1/channels/");
    const exactHeaders =
      requestedMethod === "GET"
        ? headers.length === 1
        : mutableRoute
          ? headers.length === 3 && headers.includes("content-type") && preconditionHeaders === 1
          : headers.length === 2 && headers.includes("content-type") && preconditionHeaders === 0;
    if (!exactHeaders) {
      return sendError(reply, 400, "INVALID_REQUEST");
    }
    return reply
      .code(204)
      .header("access-control-allow-methods", requestedMethod)
      .header("access-control-allow-headers", headers.join(", "))
      .header("access-control-max-age", "600")
      .send();
  });
}

function registerSourceRoutes(app: FastifyInstance, repository: SourceRepository): void {
  app.get<ParamsOnlyRoute<IdentifierParams>>("/v1/sources/:sourceKey", async (request, reply) => {
    const { sourceKey } = request.params;
    if (!isLocalIdentifier(sourceKey)) return sendError(reply, 400, "INVALID_SOURCE_KEY");
    try {
      const result = repository.get(sourceKey);
      if (result.status === "missing") return sendError(reply, 404, "SOURCE_NOT_FOUND");
      reply
        .code(200)
        .header("content-type", LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE)
        .header("etag", generationEtag(result.record.generation))
        .send(Buffer.from(result.record.bytes));
    } catch (error) {
      return sendPublicFailure(reply, error);
    }
  });

  app.put<BufferBodyRoute<IdentifierParams>>(
    "/v1/sources/:sourceKey",
    { bodyLimit: LOCAL_CONTROL_PLANE_LIMITS.maxSourceUtf8Bytes },
    async (request, reply) => {
      const { sourceKey } = request.params;
      if (!isLocalIdentifier(sourceKey)) return sendError(reply, 400, "INVALID_SOURCE_KEY");
      const precondition = mutablePrecondition(request);
      if (precondition instanceof LocalControlPlaneError) {
        return sendPublicFailure(reply, precondition);
      }
      try {
        const current = repository.get(sourceKey);
        const check = preconditionStatus(precondition, current);
        if (!check.valid) return sendGenerationMismatch(reply, check.generation);

        const parsed = parseStrictJsonBytes(request.body, SOURCE_JSON_LIMITS);
        if (parsed.status === "rejected") {
          return sendError(
            reply,
            parsed.issue.kind === "limit" ? 413 : 400,
            parsed.issue.kind === "limit"
              ? "SOURCE_MATERIAL_LIMIT_EXCEEDED"
              : "SOURCE_JSON_INVALID",
          );
        }
        if (
          canonicalJsonByteLengthWithin(
            parsed.value,
            LOCAL_CONTROL_PLANE_LIMITS.maxSourceCanonicalUtf8Bytes,
          ) === undefined
        ) {
          return sendError(reply, 413, "SOURCE_MATERIAL_LIMIT_EXCEEDED");
        }
        if (!guardBundleVerificationStructure("source", parsed.value).valid) {
          return sendError(reply, 400, "SOURCE_SCHEMA_INVALID");
        }

        const result =
          precondition.mode === "create"
            ? repository.create(sourceKey, request.body)
            : repository.update(sourceKey, precondition.generation, request.body);
        if (result.status === "precondition-failed") {
          return sendGenerationMismatch(reply, result.current?.generation ?? null);
        }
        if (result.status === "generation-exhausted") {
          reply.header("etag", generationEtag(result.current.generation));
          return sendError(reply, 409, "GENERATION_EXHAUSTED");
        }
        reply.header("etag", generationEtag(result.record.generation));
        return sendJson(reply, result.status === "created" ? 201 : 200, {
          generation: result.record.generation,
          sourceKey,
          status: result.status,
        });
      } catch (error) {
        return sendPublicFailure(reply, error);
      }
    },
  );
}

function registerBundleRoutes(app: FastifyInstance, store: BundleStore): void {
  app.get<ParamsOnlyRoute<RevisionParams>>("/v1/bundles/:revision", async (request, reply) => {
    const { revision } = request.params;
    if (!isSha256Digest(revision)) return sendError(reply, 400, "INVALID_REVISION");
    try {
      const result = await store.getBundle(revision);
      if (result.status === "missing") return sendError(reply, 404, "BUNDLE_NOT_FOUND");
      reply
        .code(200)
        .header("content-type", LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE)
        .header("etag", bundleEtag(revision))
        .send(Buffer.from(result.entry.bytes));
    } catch (error) {
      return sendPublicFailure(reply, error);
    }
  });

  app.put<BufferBodyRoute<RevisionParams>>(
    "/v1/bundles/:revision",
    { bodyLimit: LOCAL_CONTROL_PLANE_LIMITS.maxBundleUtf8Bytes },
    async (request, reply) => {
      const { revision } = request.params;
      if (!isSha256Digest(revision)) return sendError(reply, 400, "INVALID_REVISION");
      if (request.body.byteLength === 0) return sendError(reply, 400, "INVALID_REQUEST");
      try {
        const result = await store.putBundle({ revision, bytes: request.body });
        if (result.status === "conflict") {
          return sendError(reply, 409, "BUNDLE_BYTES_CONFLICT");
        }
        reply.header("etag", bundleEtag(revision));
        return sendJson(reply, result.status === "stored" ? 201 : 200, {
          revision,
          status: result.status,
        });
      } catch (error) {
        return sendPublicFailure(reply, error);
      }
    },
  );
}

function channelRevision(bytes: Uint8Array): string | undefined {
  const parsed = parseStrictJsonBytes(bytes, CHANNEL_JSON_LIMITS);
  if (parsed.status === "rejected") return undefined;
  if (parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return undefined;
  }
  const object = parsed.value as StrictJsonObject;
  const keys = Object.keys(object);
  return keys.length === 1 && keys[0] === "revision" && isSha256Digest(object.revision)
    ? object.revision
    : undefined;
}

function registerChannelRoutes(
  app: FastifyInstance,
  repository: ChannelRepository,
  store: BundleStore,
): void {
  app.get<ParamsOnlyRoute<ChannelParams>>("/v1/channels/:channelName", async (request, reply) => {
    const { channelName } = request.params;
    if (!isLocalIdentifier(channelName)) return sendError(reply, 400, "INVALID_CHANNEL_NAME");
    try {
      const result = repository.get(channelName);
      if (result.status === "missing") return sendError(reply, 404, "CHANNEL_NOT_FOUND");
      reply.header("etag", generationEtag(result.record.generation));
      return sendJson(reply, 200, {
        channelName,
        generation: result.record.generation,
        revision: result.record.revision,
      });
    } catch (error) {
      return sendPublicFailure(reply, error);
    }
  });

  app.put<BufferBodyRoute<ChannelParams>>(
    "/v1/channels/:channelName",
    { bodyLimit: LOCAL_CONTROL_PLANE_LIMITS.maxChannelBodyUtf8Bytes },
    async (request, reply) => {
      const { channelName } = request.params;
      if (!isLocalIdentifier(channelName)) return sendError(reply, 400, "INVALID_CHANNEL_NAME");
      const precondition = mutablePrecondition(request);
      if (precondition instanceof LocalControlPlaneError) {
        return sendPublicFailure(reply, precondition);
      }
      try {
        const current = repository.get(channelName);
        const check = preconditionStatus(precondition, current);
        if (!check.valid) return sendGenerationMismatch(reply, check.generation);
        const revision = channelRevision(request.body);
        if (revision === undefined) return sendError(reply, 400, "INVALID_CHANNEL_BODY");
        const bundle = await store.getBundle(revision);
        if (bundle.status === "missing") return sendError(reply, 409, "BUNDLE_NOT_FOUND");
        const result =
          precondition.mode === "create"
            ? repository.create(channelName, revision)
            : repository.update(channelName, precondition.generation, revision);
        if (result.status === "precondition-failed") {
          return sendGenerationMismatch(reply, result.current?.generation ?? null);
        }
        if (result.status === "generation-exhausted") {
          reply.header("etag", generationEtag(result.current.generation));
          return sendError(reply, 409, "GENERATION_EXHAUSTED");
        }
        reply.header("etag", generationEtag(result.record.generation));
        return sendJson(reply, result.status === "created" ? 201 : 200, {
          channelName,
          generation: result.record.generation,
          revision: result.record.revision,
          status: result.status,
        });
      } catch (error) {
        return sendPublicFailure(reply, error);
      }
    },
  );
}

function captureBody(value: unknown): Buffer | undefined {
  if (value === undefined) return undefined;
  try {
    if (
      !ArrayBuffer.isView(value) ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER === undefined
    ) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    const tag = Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) as unknown;
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as unknown;
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as unknown;
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as unknown;
    if (
      tag !== "Uint8Array" ||
      !(buffer instanceof ArrayBuffer) ||
      typeof byteLength !== "number" ||
      typeof byteOffset !== "number" ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength < 0
    ) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    throw new LocalControlPlaneError("INVALID_REQUEST");
  }
}

function captureHeaders(value: unknown): Readonly<Record<string, string>> {
  if (value === undefined) {
    return Object.freeze({ host: LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS });
  }
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    const result: Record<string, string> = {};
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32) throw new LocalControlPlaneError("INVALID_REQUEST");
    for (const key of keys) {
      if (typeof key !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(key)) {
        throw new LocalControlPlaneError("INVALID_REQUEST");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string" ||
        descriptor.value.includes("\r") ||
        descriptor.value.includes("\n")
      ) {
        throw new LocalControlPlaneError("INVALID_REQUEST");
      }
      const normalized = key.toLowerCase();
      if (Object.hasOwn(result, normalized)) throw new LocalControlPlaneError("INVALID_REQUEST");
      result[normalized] = descriptor.value;
    }
    if (!Object.hasOwn(result, "host")) result.host = LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS;
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    throw new LocalControlPlaneError("INVALID_REQUEST");
  }
}

function captureInjectRequest(value: unknown): Readonly<{
  readonly method: LocalControlPlaneInjectRequest["method"];
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer | undefined;
}> {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    const allowedKeys = new Set(["body", "headers", "method", "path"]);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    const readData = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
        ? descriptor.value
        : undefined;
    };
    const method = readData("method");
    const path = readData("path");
    if (
      !["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"].includes(method as string) ||
      typeof path !== "string" ||
      path.length === 0 ||
      path.length > MAX_REQUEST_TARGET_CODE_UNITS
    ) {
      throw new LocalControlPlaneError("INVALID_REQUEST");
    }
    return Object.freeze({
      method: method as LocalControlPlaneInjectRequest["method"],
      path,
      headers: captureHeaders(readData("headers")),
      body: captureBody(readData("body")),
    });
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    throw new LocalControlPlaneError("INVALID_REQUEST");
  }
}

function captureResponseHeaders(
  value: Readonly<Record<string, string | string[] | number | undefined>>,
): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number") {
      headers[name.toLowerCase()] = String(entry);
    } else if (Array.isArray(entry)) {
      headers[name.toLowerCase()] = entry.join(", ");
    }
  }
  return Object.freeze(headers);
}

function captureStatusCode(value: number): LocalControlPlaneHttpStatusCode {
  const allowed: readonly number[] = [
    200, 201, 204, 400, 401, 403, 404, 405, 409, 412, 413, 415, 428, 500, 503,
  ];
  if (!allowed.includes(value)) throw new LocalControlPlaneError("INTERNAL_FAILURE");
  return value as LocalControlPlaneHttpStatusCode;
}

function createFastifyApplication(
  options: CapturedLocalControlPlaneRuntime,
  tokenDigest: Buffer,
  allowedOrigins: ReadonlySet<string>,
): FastifyInstance<RawServerDefault> {
  const app = Fastify({
    ajv: {
      customOptions: {
        allErrors: false,
        coerceTypes: false,
        removeAdditional: false,
        useDefaults: false,
      },
    },
    bodyLimit: LOCAL_CONTROL_PLANE_LIMITS.maxSourceUtf8Bytes,
    connectionTimeout: LOCAL_CONTROL_PLANE_LIMITS.connectionTimeoutMilliseconds,
    exposeHeadRoutes: false,
    keepAliveTimeout: LOCAL_CONTROL_PLANE_LIMITS.keepAliveTimeoutMilliseconds,
    logger: false,
    requestTimeout: LOCAL_CONTROL_PLANE_LIMITS.requestTimeoutMilliseconds,
    trustProxy: false,
  });

  app.removeContentTypeParser(LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE);
  app.addContentTypeParser(
    LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
    { parseAs: "buffer" },
    (_request, body, done) => done(null, Buffer.from(body)),
  );

  app.addHook("onRequest", (request, reply, done) => {
    reply.header("cache-control", "no-store").header("x-content-type-options", "nosniff");
    if (!validLoopbackHost(stringHeader(request, "host"))) {
      sendError(reply, 403, "HOST_NOT_ALLOWED");
      done();
      return;
    }
    const origin = stringHeader(request, "origin");
    if (hasHeader(request, "origin") && (origin === undefined || !allowedOrigins.has(origin))) {
      sendError(reply, 403, "ORIGIN_NOT_ALLOWED");
      done();
      return;
    }
    if (origin !== undefined) {
      reply.header("access-control-allow-origin", origin).header("vary", "Origin");
      if (request.method !== "OPTIONS") {
        reply.header("access-control-expose-headers", "etag");
      }
    }
    if (
      request.method !== "OPTIONS" &&
      !authenticated(stringHeader(request, "authorization"), tokenDigest)
    ) {
      sendError(reply, 401, "AUTHENTICATION_REQUIRED");
      done();
      return;
    }
    const rawTarget = request.raw.url;
    if (
      rawTarget === undefined ||
      rawTarget.length === 0 ||
      rawTarget.length > MAX_REQUEST_TARGET_CODE_UNITS ||
      !rawTarget.startsWith("/") ||
      rawTarget.includes("?") ||
      rawTarget.includes("#") ||
      rawTarget.includes("%")
    ) {
      sendError(reply, 400, "INVALID_REQUEST");
      done();
      return;
    }
    const encoding = stringHeader(request, "content-encoding");
    if (hasHeader(request, "content-encoding") && encoding !== "identity") {
      sendError(reply, 400, "CONTENT_ENCODING_NOT_ALLOWED");
      done();
      return;
    }
    if (request.method === "PUT") {
      if (stringHeader(request, "content-type") !== LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE) {
        sendError(reply, 415, "UNSUPPORTED_MEDIA_TYPE");
        done();
        return;
      }
    } else if (
      request.method === "GET" &&
      (hasHeader(request, "content-type") ||
        hasHeader(request, "transfer-encoding") ||
        (stringHeader(request, "content-length") ?? "0") !== "0")
    ) {
      sendError(reply, 400, "INVALID_REQUEST");
      done();
      return;
    }
    done();
  });

  app.setErrorHandler((error, _request, reply) => {
    const code = Object.getOwnPropertyDescriptor(error, "code")?.value;
    if (code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      sendError(reply, 413, "BODY_LIMIT_EXCEEDED");
      return;
    }
    if (code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      sendError(reply, 415, "UNSUPPORTED_MEDIA_TYPE");
      return;
    }
    sendError(reply, 500, "INTERNAL_FAILURE");
  });

  registerSourceRoutes(app, options.sourceRepository);
  registerBundleRoutes(app, options.bundleStore);
  registerChannelRoutes(app, options.channelRepository, options.bundleStore);
  registerPreflight(app, "/v1/sources/:sourceKey");
  registerPreflight(app, "/v1/bundles/:revision");
  registerPreflight(app, "/v1/channels/:channelName");

  app.setNotFoundHandler((request, reply) => {
    const path = request.raw.url ?? "";
    return sendError(
      reply,
      requestPathIsResource(path) ? 405 : 404,
      requestPathIsResource(path) ? "METHOD_NOT_ALLOWED" : "ROUTE_NOT_FOUND",
    );
  });
  return app;
}

function createCapturedLocalControlPlaneApplication(
  options: CapturedLocalControlPlaneRuntime,
  tokenDigest: Buffer,
  allowedOrigins: ReadonlySet<string>,
): LocalControlPlane {
  const app = createFastifyApplication(options, tokenDigest, allowedOrigins);
  let state: "closed" | "closing" | "listening" | "open" | "starting" = "open";
  let closePromise: Promise<void> | undefined;
  let listenPromise: Promise<LocalControlPlaneListenResult> | undefined;
  const inFlightInjects = new Set<Promise<void>>();

  const inject: LocalControlPlane["inject"] = async (request) => {
    if (state === "closed" || state === "closing") {
      throw new LocalControlPlaneError("SERVER_STATE_INVALID");
    }
    const captured = captureInjectRequest(request);
    let releaseGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    if (releaseGate === undefined) throw new LocalControlPlaneError("INTERNAL_FAILURE");
    inFlightInjects.add(gate);
    try {
      const response = await app.inject({
        method: captured.method,
        url: captured.path,
        headers: captured.headers,
        ...(captured.body === undefined ? {} : { payload: captured.body }),
      });
      return Object.freeze({
        statusCode: captureStatusCode(response.statusCode),
        headers: captureResponseHeaders(response.headers),
        body:
          response.rawPayload.byteLength === 0 ? EMPTY_BYTES : new Uint8Array(response.rawPayload),
      }) as LocalControlPlaneInjectResponse;
    } catch (error) {
      throw publicFailure(error);
    } finally {
      inFlightInjects.delete(gate);
      releaseGate();
    }
  };

  const listen: LocalControlPlane["listen"] = (port) => {
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
      return Promise.reject(new LocalControlPlaneError("INVALID_PORT"));
    }
    if (state !== "open") {
      return Promise.reject(new LocalControlPlaneError("SERVER_STATE_INVALID"));
    }
    state = "starting";
    listenPromise = (async () => {
      try {
        await app.listen({ host: LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS, port });
        const address = app.server.address();
        if (
          state !== "starting" ||
          address === null ||
          typeof address === "string" ||
          address.address !== LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS
        ) {
          throw new LocalControlPlaneError("SERVER_STATE_INVALID");
        }
        state = "listening";
        return Object.freeze({
          address: LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS,
          port: address.port,
          origin: `http://${LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS}:${String(address.port)}`,
        }) as LocalControlPlaneListenResult;
      } catch (error) {
        if (state === "starting") state = "open";
        if (error instanceof LocalControlPlaneError) throw error;
        throw new LocalControlPlaneError("INTERNAL_FAILURE");
      }
    })();
    return listenPromise;
  };

  const close: LocalControlPlane["close"] = () => {
    if (closePromise !== undefined) return closePromise;
    state = "closing";
    closePromise = (async () => {
      let applicationFailure: unknown;
      if (listenPromise !== undefined) {
        try {
          await listenPromise;
        } catch {
          // A concurrent close deliberately revokes an in-progress listener result.
        }
      }
      try {
        await app.close();
      } catch (error) {
        applicationFailure = error;
      }
      await Promise.all([...inFlightInjects]);
      try {
        await options.closeMetadata();
      } catch (error) {
        if (applicationFailure === undefined) applicationFailure = error;
      }
      state = "closed";
      if (applicationFailure !== undefined) throw publicFailure(applicationFailure);
    })();
    return closePromise;
  };

  return Object.freeze({ close, inject, listen });
}

/** Creates one closed local HTTP service over injected persistent repositories. @internal */
export function createLocalControlPlaneApplication(
  options: LocalControlPlaneApplicationOptions,
): LocalControlPlane {
  const tokenDigest = createHash("sha256").update(options.apiToken, "utf8").digest();
  const allowedOrigins = new Set(options.allowedOrigins);
  return createCapturedLocalControlPlaneApplication(
    Object.freeze({
      bundleStore: options.bundleStore,
      sourceRepository: options.sourceRepository,
      channelRepository: options.channelRepository,
      closeMetadata: options.closeMetadata,
    }),
    tokenDigest,
    allowedOrigins,
  );
}
