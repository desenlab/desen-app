/* eslint-disable @typescript-eslint/no-invalid-void-type -- The injected fetch and diagnostic
 * boundaries are deliberately receiver-independent. */
import { activateReferenceHostDeliveredSignIn } from "./official-sign-in.js";

import type { SignInHostOperationBinding } from "@desen/reference-catalog-web/host-operations";
import type {
  ReferenceHostOfficialSignInDiagnosticReporter,
  ReferenceHostOfficialSignInActivationResult,
} from "./official-sign-in.js";
import type { ReferenceHostRootHandle } from "./root.js";

const CHANNEL_REFRESH_ENDPOINT = "/__desen/runtime/refresh";
const MAX_CHANNEL_RESPONSE_BYTES = 2_101_248;
const MAX_CHANNEL_RESPONSE_CHUNKS = 1_024;
const CHANNEL_REFRESH_TIMEOUT_MS = 15_000;
const SHA256_REVISION_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const JSON_HEADERS = Object.freeze({ accept: "application/json" });
const OBJECT_PROTOTYPE = Object.getPrototypeOf({}) as object;
const UINT8_ARRAY_PROTOTYPE = Object.getPrototypeOf(new Uint8Array(0)) as object;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(UINT8_ARRAY_PROTOTYPE) as object;
const ARRAY_BUFFER_PROTOTYPE = Object.getPrototypeOf(new ArrayBuffer(0)) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_TAG_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  Symbol.toStringTag,
)?.get;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ARRAY_BUFFER_PROTOTYPE,
  "byteLength",
)?.get;

declare const REFERENCE_HOST_CHANNEL_DELIVERY_TYPE_BRAND: unique symbol;

/** Opaque lifecycle authority for the one fixed reference-host channel delivery boundary. */
export interface ReferenceHostChannelDeliveryHandle {
  readonly [REFERENCE_HOST_CHANNEL_DELIVERY_TYPE_BRAND]: true;
}

/** Exact fetch-compatible dependency for the fixed same-origin refresh endpoint. */
export type ReferenceHostChannelDeliveryFetch = (
  this: void,
  resource: typeof CHANNEL_REFRESH_ENDPOINT,
  init: RequestInit,
) => PromiseLike<unknown>;

/** Closed construction input for browser-side delivery and independently validated activation. */
export interface ReferenceHostChannelDeliveryCreateInput {
  /** Browser platform used only by the fixed runtime host policy. */
  readonly browser: Window;
  /** Receiver-independent fetch implementation used for the one fixed endpoint. */
  readonly fetch: ReferenceHostChannelDeliveryFetch;
  /** Redacted runtime diagnostic sink. */
  readonly reportDiagnostic: ReferenceHostOfficialSignInDiagnosticReporter;
  /** Existing independently managed React root whose current surface must be preserved on failure. */
  readonly root: ReferenceHostRootHandle;
  /** Fixed-capability sign-in binding; Bundle data cannot select another operation. */
  readonly signIn: SignInHostOperationBinding;
}

/** Closed, data-only result of one refresh attempt. */
export type ReferenceHostChannelRefreshResult =
  | Readonly<{
      readonly status: "activated";
      readonly relationship: Extract<
        ReferenceHostOfficialSignInActivationResult,
        { readonly status: "activated" }
      >["relationship"];
    }>
  | Readonly<{
      readonly status: "preserved";
      readonly reason:
        | "activation-rejected"
        | "disposed"
        | "http-rejected"
        | "invalid-handle"
        | "invalid-response"
        | "stale-response"
        | "transport-rejected"
        | "unchanged";
    }>;

interface CapturedDeliveryInput {
  readonly browser: Window;
  readonly fetch: ReferenceHostChannelDeliveryFetch;
  readonly reportDiagnostic: ReferenceHostOfficialSignInDiagnosticReporter;
  readonly root: ReferenceHostRootHandle;
  readonly signIn: SignInHostOperationBinding;
}

interface CapturedResponse {
  readonly response: object;
  readonly status: number;
}

interface CapturedSuccessResponsePolicy {
  readonly contentLength: number | undefined;
  readonly etag: string;
}

interface CapturedBodyReader {
  readonly reader: object;
  readonly read: (this: unknown) => unknown;
  readonly cancel: ((this: unknown) => unknown) | undefined;
  readonly releaseLock: ((this: unknown) => unknown) | undefined;
}

interface CapturedDelivery {
  readonly bundle: unknown;
  readonly identity: DeliveryIdentity;
}

interface DeliveryIdentity {
  readonly etag: string;
  readonly generation: number;
  readonly revision: string;
}

type AttemptFenceReason = "disposed" | "timeout";

interface AttemptFence {
  readonly promise: Promise<AttemptFenceReason>;
  readonly resolve: (reason: AttemptFenceReason) => void;
  reason: AttemptFenceReason | undefined;
}

type BoundedJsonReadResult =
  | Readonly<{ readonly status: "fenced"; readonly reason: AttemptFenceReason }>
  | Readonly<{ readonly status: "read"; readonly byteLength: number; readonly value: unknown }>
  | Readonly<{ readonly status: "rejected" }>;

interface ReferenceHostChannelDeliveryState {
  readonly input: CapturedDeliveryInput;
  abortController: AbortController | undefined;
  attemptFence: AttemptFence | undefined;
  currentIdentity: DeliveryIdentity | undefined;
  epoch: number;
  inFlight: Promise<ReferenceHostChannelRefreshResult> | undefined;
  lifecycle: "active" | "disposed";
  timeoutId: number | undefined;
}

const DELIVERIES = new WeakMap<
  ReferenceHostChannelDeliveryHandle,
  ReferenceHostChannelDeliveryState
>();
const DISPOSED_RESULT = Object.freeze({ status: "preserved", reason: "disposed" } as const);
const INVALID_HANDLE_RESULT = Object.freeze({
  status: "preserved",
  reason: "invalid-handle",
} as const);

function ownDataRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== OBJECT_PROTOTYPE && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (
      requiredKeys.some((key) => !keys.includes(key)) ||
      keys.some(
        (key) =>
          typeof key !== "string" || (!requiredKeys.includes(key) && !optionalKeys.includes(key)),
      )
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      if (typeof key !== "string") return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !("value" in descriptor)) {
        return undefined;
      }
      captured[key] = descriptor.value;
    }
    return captured;
  } catch {
    return undefined;
  }
}

function captureCreateInput(input: unknown): CapturedDeliveryInput | undefined {
  const captured = ownDataRecord(input, ["browser", "fetch", "reportDiagnostic", "root", "signIn"]);
  if (
    captured === undefined ||
    typeof captured.fetch !== "function" ||
    typeof captured.reportDiagnostic !== "function"
  ) {
    return undefined;
  }
  const signIn = ownDataRecord(captured.signIn, ["operationId", "invoke"]);
  if (
    signIn === undefined ||
    signIn.operationId !== "com.example.auth/signIn" ||
    typeof signIn.invoke !== "function"
  ) {
    return undefined;
  }
  return Object.freeze({
    browser: captured.browser as Window,
    fetch: captured.fetch as ReferenceHostChannelDeliveryFetch,
    reportDiagnostic: captured.reportDiagnostic as ReferenceHostOfficialSignInDiagnosticReporter,
    root: captured.root as ReferenceHostRootHandle,
    signIn: Object.freeze({
      operationId: "com.example.auth/signIn",
      invoke: signIn.invoke,
    }) as SignInHostOperationBinding,
  });
}

function captureResponse(response: unknown): CapturedResponse | undefined {
  try {
    if (response === null || typeof response !== "object") return undefined;
    const status = Reflect.get(response, "status");
    if (!Number.isInteger(status) || (status as number) < 100 || (status as number) > 599) {
      return undefined;
    }
    return Object.freeze({ response, status: status as number });
  } catch {
    return undefined;
  }
}

function responseHeader(response: object, name: string): string | null | undefined {
  try {
    const headers = Reflect.get(response, "headers");
    if (headers === null || typeof headers !== "object") return undefined;
    const get = Reflect.get(headers, "get");
    if (typeof get !== "function") return undefined;
    const value = Reflect.apply(get, headers, [name]);
    return value === null || typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function captureSuccessResponsePolicy(
  response: object,
  browser: Window,
): CapturedSuccessResponsePolicy | undefined {
  try {
    const redirected = Reflect.get(response, "redirected");
    const responseUrl = Reflect.get(response, "url");
    const expectedUrl = String(
      new URL(CHANNEL_REFRESH_ENDPOINT, browser.location as unknown as string),
    );
    const contentType = responseHeader(response, "content-type");
    const contentEncoding = responseHeader(response, "content-encoding");
    const etag = responseHeader(response, "etag");
    const contentLengthHeader = responseHeader(response, "content-length");
    if (
      redirected !== false ||
      responseUrl !== expectedUrl ||
      contentType !== "application/json" ||
      contentEncoding !== null ||
      typeof etag !== "string" ||
      contentLengthHeader === undefined
    ) {
      return undefined;
    }
    let contentLength: number | undefined;
    if (contentLengthHeader !== null) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(contentLengthHeader)) return undefined;
      contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength) || contentLength > MAX_CHANNEL_RESPONSE_BYTES) {
        return undefined;
      }
    }
    return Object.freeze({ contentLength, etag });
  } catch {
    return undefined;
  }
}

function createAttemptFence(): AttemptFence {
  let resolvePromise!: (reason: AttemptFenceReason) => void;
  const fence: AttemptFence = {
    promise: new Promise<AttemptFenceReason>((resolve) => {
      resolvePromise = resolve;
    }),
    reason: undefined,
    resolve(reason) {
      if (fence.reason !== undefined) return;
      fence.reason = reason;
      resolvePromise(reason);
    },
  };
  return fence;
}

function captureBodyReader(response: object): CapturedBodyReader | undefined {
  try {
    const body = Reflect.get(response, "body");
    if (body === null || typeof body !== "object") return undefined;
    const getReader = Reflect.get(body, "getReader");
    if (typeof getReader !== "function") return undefined;
    const reader = Reflect.apply(getReader, body, []);
    if (reader === null || typeof reader !== "object") return undefined;
    const read = Reflect.get(reader, "read");
    const cancel = Reflect.get(reader, "cancel");
    const releaseLock = Reflect.get(reader, "releaseLock");
    if (
      typeof read !== "function" ||
      (cancel !== undefined && typeof cancel !== "function") ||
      (releaseLock !== undefined && typeof releaseLock !== "function")
    ) {
      return undefined;
    }
    return Object.freeze({
      reader,
      read: read as (this: unknown) => unknown,
      cancel: cancel as ((this: unknown) => unknown) | undefined,
      releaseLock: releaseLock as ((this: unknown) => unknown) | undefined,
    });
  } catch {
    return undefined;
  }
}

function cancelBodyReader(reader: CapturedBodyReader): void {
  if (reader.cancel === undefined) return;
  try {
    void Promise.resolve(Reflect.apply(reader.cancel, reader.reader, [])).catch(() => undefined);
  } catch {
    // Transport cleanup cannot expose or replace the fixed public result.
  }
}

function releaseBodyReader(reader: CapturedBodyReader): void {
  if (reader.releaseLock === undefined) return;
  try {
    Reflect.apply(reader.releaseLock, reader.reader, []);
  } catch {
    // Reader cleanup cannot expose or replace the fixed public result.
  }
}

function cancelUnusedResponseBody(response: object): void {
  try {
    const body = Reflect.get(response, "body");
    if (body === null || typeof body !== "object") return;
    const cancel = Reflect.get(body, "cancel");
    if (typeof cancel !== "function") return;
    void Promise.resolve(Reflect.apply(cancel, body, [])).catch(() => undefined);
  } catch {
    // HTTP classification cannot be changed by unused-body cleanup.
  }
}

function captureReadResult(
  value: unknown,
): Readonly<{ readonly done: boolean; readonly value: unknown }> | undefined {
  const captured = ownDataRecord(value, ["done", "value"]);
  return captured !== undefined && typeof captured.done === "boolean"
    ? Object.freeze({ done: captured.done, value: captured.value })
    : undefined;
}

function captureResponseChunk(value: unknown, maximumBytes: number): Uint8Array | undefined {
  try {
    if (
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_TAG_GETTER === undefined ||
      ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined ||
      Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) !== "Uint8Array"
    ) {
      return undefined;
    }
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const bufferByteLength = Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, []);
    if (
      typeof byteOffset !== "number" ||
      typeof byteLength !== "number" ||
      typeof bufferByteLength !== "number" ||
      !Number.isSafeInteger(byteOffset) ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(bufferByteLength) ||
      !Number.isSafeInteger(maximumBytes) ||
      byteOffset < 0 ||
      byteLength <= 0 ||
      maximumBytes < 0 ||
      byteLength > maximumBytes ||
      byteOffset + byteLength > bufferByteLength
    ) {
      return undefined;
    }
    const copy = new Uint8Array(byteLength);
    copy.set(new Uint8Array(buffer as ArrayBuffer, byteOffset, byteLength));
    return copy;
  } catch {
    return undefined;
  }
}

async function readBoundedJsonResponse(
  response: object,
  fence: AttemptFence,
): Promise<BoundedJsonReadResult> {
  const reader = captureBodyReader(response);
  if (reader === undefined) return Object.freeze({ status: "rejected" });

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let chunkCount = 0;
  try {
    for (;;) {
      const read = Promise.resolve(Reflect.apply(reader.read, reader.reader, [])).then(
        (value) => Object.freeze({ status: "settled", value } as const),
        () => Object.freeze({ status: "failed" } as const),
      );
      const outcome = await Promise.race([
        read,
        fence.promise.then((reason) => Object.freeze({ status: "fenced", reason } as const)),
      ]);
      if (outcome.status === "fenced") {
        cancelBodyReader(reader);
        return Object.freeze({ status: "fenced", reason: outcome.reason });
      }
      if (outcome.status === "failed") {
        cancelBodyReader(reader);
        return Object.freeze({ status: "rejected" });
      }
      const result = captureReadResult(outcome.value);
      if (result === undefined) {
        cancelBodyReader(reader);
        return Object.freeze({ status: "rejected" });
      }
      if (result.done) {
        const bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        try {
          return Object.freeze({
            status: "read",
            byteLength: totalBytes,
            value: JSON.parse(
              new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
            ) as unknown,
          });
        } catch {
          return Object.freeze({ status: "rejected" });
        }
      }
      if (chunkCount >= MAX_CHANNEL_RESPONSE_CHUNKS) {
        cancelBodyReader(reader);
        return Object.freeze({ status: "rejected" });
      }
      const chunk = captureResponseChunk(result.value, MAX_CHANNEL_RESPONSE_BYTES - totalBytes);
      if (chunk === undefined) {
        cancelBodyReader(reader);
        return Object.freeze({ status: "rejected" });
      }
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
      chunkCount += 1;
    }
  } catch {
    cancelBodyReader(reader);
    return Object.freeze({ status: "rejected" });
  } finally {
    releaseBodyReader(reader);
  }
}

function captureDelivery(
  value: unknown,
  etag: string | null | undefined,
): CapturedDelivery | undefined {
  const envelope = ownDataRecord(value, ["activation", "bundle"]);
  if (envelope === undefined) return undefined;
  const activation = ownDataRecord(envelope.activation, ["generation", "revision"]);
  if (
    activation === undefined ||
    !Number.isSafeInteger(activation.generation) ||
    (activation.generation as number) < 0 ||
    typeof activation.revision !== "string" ||
    !SHA256_REVISION_PATTERN.test(activation.revision)
  ) {
    return undefined;
  }
  const bundle = ownDataRecord(
    envelope.bundle,
    ["kind", "desen", "id", "revision", "sourceDigest", "requires", "entry", "surfaces"],
    ["publication", "extensions"],
  );
  if (
    bundle === undefined ||
    bundle.kind !== "desen.bundle" ||
    bundle.desen !== "0.1.0" ||
    bundle.revision !== activation.revision
  ) {
    return undefined;
  }

  const generation = activation.generation as number;
  const expectedEtag = `"desen-active:g:${String(generation)}:${activation.revision}"`;
  if (etag !== expectedEtag) return undefined;
  return Object.freeze({
    bundle: envelope.bundle,
    identity: Object.freeze({
      etag: expectedEtag,
      generation,
      revision: activation.revision,
    }),
  });
}

function isLive(state: ReferenceHostChannelDeliveryState, epoch: number): boolean {
  return state.lifecycle === "active" && state.epoch === epoch;
}

function compareIdentity(
  current: DeliveryIdentity | undefined,
  candidate: DeliveryIdentity,
): "accept" | "stale" | "unchanged" | "invalid" {
  if (current === undefined) return "accept";
  if (candidate.generation < current.generation) return "stale";
  if (candidate.generation > current.generation) return "accept";
  if (candidate.revision === current.revision && candidate.etag === current.etag)
    return "unchanged";
  return "invalid";
}

async function performRefresh(
  state: ReferenceHostChannelDeliveryState,
  epoch: number,
  signal: AbortSignal,
  fence: AttemptFence,
): Promise<ReferenceHostChannelRefreshResult> {
  let pendingResponse: Promise<
    | Readonly<{ readonly status: "rejected" }>
    | Readonly<{ readonly status: "response"; readonly value: unknown }>
  >;
  try {
    const returned = Reflect.apply(state.input.fetch, undefined, [
      CHANNEL_REFRESH_ENDPOINT,
      Object.freeze({
        method: "POST",
        headers: JSON_HEADERS,
        cache: "no-store",
        credentials: "omit",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal,
      } satisfies RequestInit),
    ]);
    pendingResponse = Promise.resolve(returned).then(
      (value) => {
        if (fence.reason !== undefined) {
          const response = captureResponse(value);
          if (response !== undefined) cancelUnusedResponseBody(response.response);
        }
        return Object.freeze({ status: "response", value } as const);
      },
      () => Object.freeze({ status: "rejected" } as const),
    );
  } catch {
    return isLive(state, epoch)
      ? Object.freeze({ status: "preserved", reason: "transport-rejected" })
      : DISPOSED_RESULT;
  }
  const fetched = await Promise.race([
    pendingResponse,
    fence.promise.then((reason) => Object.freeze({ status: "fenced", reason } as const)),
  ]);
  if (fetched.status === "fenced") {
    return fetched.reason === "disposed"
      ? DISPOSED_RESULT
      : Object.freeze({ status: "preserved", reason: "transport-rejected" });
  }
  if (fetched.status === "rejected") {
    return isLive(state, epoch)
      ? Object.freeze({ status: "preserved", reason: "transport-rejected" })
      : DISPOSED_RESULT;
  }
  const rawResponse = fetched.value;
  if (!isLive(state, epoch)) {
    const response = captureResponse(rawResponse);
    if (response !== undefined) cancelUnusedResponseBody(response.response);
    return DISPOSED_RESULT;
  }

  const response = captureResponse(rawResponse);
  if (response === undefined) {
    return Object.freeze({ status: "preserved", reason: "invalid-response" });
  }
  if (response.status !== 200) {
    cancelUnusedResponseBody(response.response);
    return Object.freeze({ status: "preserved", reason: "http-rejected" });
  }
  const responsePolicy = captureSuccessResponsePolicy(response.response, state.input.browser);
  if (responsePolicy === undefined) {
    cancelUnusedResponseBody(response.response);
    return Object.freeze({ status: "preserved", reason: "invalid-response" });
  }

  const read = await readBoundedJsonResponse(response.response, fence);
  if (read.status === "fenced") {
    return read.reason === "disposed"
      ? DISPOSED_RESULT
      : Object.freeze({ status: "preserved", reason: "transport-rejected" });
  }
  if (
    read.status !== "read" ||
    (responsePolicy.contentLength !== undefined && responsePolicy.contentLength !== read.byteLength)
  ) {
    return Object.freeze({ status: "preserved", reason: "invalid-response" });
  }
  if (!isLive(state, epoch)) return DISPOSED_RESULT;
  const delivery = captureDelivery(read.value, responsePolicy.etag);
  if (delivery === undefined) {
    return Object.freeze({ status: "preserved", reason: "invalid-response" });
  }
  const comparison = compareIdentity(state.currentIdentity, delivery.identity);
  if (comparison === "stale") {
    return Object.freeze({ status: "preserved", reason: "stale-response" });
  }
  if (comparison === "unchanged") {
    return Object.freeze({ status: "preserved", reason: "unchanged" });
  }
  if (comparison === "invalid") {
    return Object.freeze({ status: "preserved", reason: "invalid-response" });
  }

  let activation: ReferenceHostOfficialSignInActivationResult;
  try {
    activation = activateReferenceHostDeliveredSignIn(state.input.root, {
      browser: state.input.browser,
      signIn: state.input.signIn,
      reportDiagnostic: state.input.reportDiagnostic,
      bundle: delivery.bundle,
    });
  } catch {
    return Object.freeze({ status: "preserved", reason: "activation-rejected" });
  }
  if (activation.status !== "activated") {
    return Object.freeze({ status: "preserved", reason: "activation-rejected" });
  }
  state.currentIdentity = delivery.identity;
  return Object.freeze({
    status: "activated",
    relationship: activation.relationship,
  });
}

/**
 * Creates one serialized browser delivery authority for the fixed same-origin channel endpoint.
 *
 * @remarks The caller cannot select a channel, control-plane origin, token, package path,
 * revision, Catalog, adapter registry, or previous-good identity. Each handle retains at most one
 * current durable identity and one in-flight request.
 *
 * @throws TypeError when the closed own-data input or fixed sign-in binding is malformed.
 */
export function createReferenceHostChannelDelivery(
  input: ReferenceHostChannelDeliveryCreateInput,
): ReferenceHostChannelDeliveryHandle {
  const captured = captureCreateInput(input);
  if (captured === undefined) throw new TypeError("Invalid reference-host channel input.");
  const handle = Object.freeze({}) as ReferenceHostChannelDeliveryHandle;
  DELIVERIES.set(handle, {
    input: captured,
    abortController: undefined,
    attemptFence: undefined,
    currentIdentity: undefined,
    epoch: 0,
    inFlight: undefined,
    lifecycle: "active",
    timeoutId: undefined,
  });
  return handle;
}

/**
 * Fetches and conditionally activates one newer durable delivery through the fixed runtime policy.
 *
 * @remarks Concurrent calls return the same promise and therefore perform one request. Only an
 * exact 200 JSON response, matching strong ETag, non-regressing durable generation, valid Bundle,
 * successful runtime mount, and successful root transfer may replace the current React surface.
 * Every other result preserves it. The complete response envelope is bounded to 2 MiB plus a
 * fixed 4 KiB metadata allowance, 1,024 non-empty chunks, and a 15-second request lifetime.
 */
export function refreshReferenceHostChannel(
  handle: ReferenceHostChannelDeliveryHandle,
): Promise<ReferenceHostChannelRefreshResult> {
  let state: ReferenceHostChannelDeliveryState | undefined;
  try {
    state = DELIVERIES.get(handle);
  } catch {
    return Promise.resolve(INVALID_HANDLE_RESULT);
  }
  if (state === undefined) return Promise.resolve(INVALID_HANDLE_RESULT);
  if (state.lifecycle === "disposed") return Promise.resolve(DISPOSED_RESULT);
  if (state.inFlight !== undefined) return state.inFlight;

  const epoch = state.epoch;
  const fence = createAttemptFence();
  const abortController = new AbortController();
  state.abortController = abortController;
  state.attemptFence = fence;
  state.timeoutId = state.input.browser.setTimeout(() => {
    if (state?.attemptFence !== fence || fence.reason !== undefined) return;
    try {
      abortController.abort();
    } catch {
      // The promise fence remains authoritative when platform cancellation rejects.
    }
    fence.resolve("timeout");
  }, CHANNEL_REFRESH_TIMEOUT_MS);
  const promise = performRefresh(state, epoch, abortController.signal, fence);
  state.inFlight = promise;
  const clearAttempt = () => {
    if (state?.inFlight !== promise) return;
    if (state.timeoutId !== undefined) state.input.browser.clearTimeout(state.timeoutId);
    state.inFlight = undefined;
    state.abortController = undefined;
    state.attemptFence = undefined;
    state.timeoutId = undefined;
  };
  void promise.then(clearAttempt, clearAttempt);
  return promise;
}

/** Terminally aborts and fences one delivery authority without disposing the separately owned root. */
export function disposeReferenceHostChannelDelivery(
  handle: ReferenceHostChannelDeliveryHandle,
): Readonly<{ readonly status: "disposed" | "already-disposed" | "invalid-handle" }> {
  let state: ReferenceHostChannelDeliveryState | undefined;
  try {
    state = DELIVERIES.get(handle);
  } catch {
    return Object.freeze({ status: "invalid-handle" });
  }
  if (state === undefined) return Object.freeze({ status: "invalid-handle" });
  if (state.lifecycle === "disposed") return Object.freeze({ status: "already-disposed" });
  state.lifecycle = "disposed";
  state.epoch += 1;
  const abortController = state.abortController;
  const attemptFence = state.attemptFence;
  const timeoutId = state.timeoutId;
  state.abortController = undefined;
  state.attemptFence = undefined;
  state.timeoutId = undefined;
  if (timeoutId !== undefined) state.input.browser.clearTimeout(timeoutId);
  try {
    abortController?.abort();
  } catch {
    // The epoch fence is authoritative even if platform cancellation rejects.
  }
  attemptFence?.resolve("disposed");
  return Object.freeze({ status: "disposed" });
}
