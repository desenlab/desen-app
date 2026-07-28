/* eslint-disable @typescript-eslint/no-invalid-void-type -- `this: void` is the deliberate
 * receiver-independent injected fetch boundary. */
import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";
import { RUNTIME_VALUE_SAFETY_LIMITS, snapshotRuntimeJsonValue } from "@desen/runtime-core";

import type {
  SignInHostOperationBinding,
  SignInHostOperationHandler,
} from "@desen/reference-catalog-web/host-operations";
import type { RuntimeJsonValue } from "@desen/runtime-core";

const SIGN_IN_ENDPOINT = "/api/sign-in";
const MAX_SIGN_IN_RESPONSE_BYTES = 64 * 1024;
const MAX_SIGN_IN_RESPONSE_CHUNKS = 1_024;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
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
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
const JSON_HEADERS = Object.freeze({
  accept: "application/json",
  "content-type": "application/json",
});
const INVALID_CREDENTIALS = Object.freeze({
  status: "failed",
  errorCode: "invalidCredentials",
} as const);
const UNAVAILABLE = Object.freeze({
  status: "failed",
  errorCode: "unavailable",
} as const);

interface CapturedSignInInput {
  readonly email: string;
  readonly password: string;
}

interface CapturedResponse {
  readonly status: number;
  readonly response: object;
}

interface CapturedBodyReader {
  readonly reader: object;
  readonly read: (this: unknown) => unknown;
  readonly cancel: ((this: unknown) => unknown) | undefined;
  readonly releaseLock: ((this: unknown) => unknown) | undefined;
}

/**
 * Exact fetch-compatible dependency accepted by the reference sign-in HTTP binding.
 *
 * @remarks The binding always supplies the literal same-origin `/api/sign-in` resource and a
 * frozen POST request. A production application may inject the platform `fetch` function or a
 * receiver-independent wrapper. The return value remains unknown until the binding safely
 * captures its HTTP status and bounded response-body reader.
 */
export type ReferenceHostSignInFetch = (
  this: void,
  resource: typeof SIGN_IN_ENDPOINT,
  init: RequestInit,
) => PromiseLike<unknown>;

function captureSignInInput(input: unknown): CapturedSignInInput | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 2 ||
      !keys.includes("email") ||
      !keys.includes("password") ||
      keys.some((key) => typeof key !== "string" || (key !== "email" && key !== "password"))
    ) {
      return undefined;
    }
    const email = Object.getOwnPropertyDescriptor(input, "email");
    const password = Object.getOwnPropertyDescriptor(input, "password");
    if (
      email === undefined ||
      password === undefined ||
      email.enumerable !== true ||
      password.enumerable !== true ||
      !("value" in email) ||
      !("value" in password) ||
      typeof email.value !== "string" ||
      typeof password.value !== "string" ||
      email.value.length === 0 ||
      password.value.length === 0 ||
      email.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits ||
      password.value.length > RUNTIME_VALUE_SAFETY_LIMITS.maxStringCodeUnits - email.value.length
    ) {
      return undefined;
    }
    return Object.freeze({
      email: email.value,
      password: password.value,
    });
  } catch {
    return undefined;
  }
}

function captureResponse(response: unknown): CapturedResponse | undefined {
  try {
    if (response === null || typeof response !== "object") return undefined;
    const status = Reflect.get(response, "status");
    if (!Number.isInteger(status) || (status as number) < 100 || (status as number) > 599) {
      return undefined;
    }
    return Object.freeze({
      status: status as number,
      response,
    });
  } catch {
    return undefined;
  }
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

async function cancelBodyReader(reader: CapturedBodyReader): Promise<void> {
  if (reader.cancel === undefined) return;
  try {
    await Reflect.apply(reader.cancel, reader.reader, []);
  } catch {
    // Transport cleanup cannot expose or replace the declared public failure.
  }
}

function releaseBodyReader(reader: CapturedBodyReader): void {
  if (reader.releaseLock === undefined) return;
  try {
    Reflect.apply(reader.releaseLock, reader.reader, []);
  } catch {
    // Reader cleanup cannot expose or replace the declared public result.
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
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      !keys.includes("done") ||
      !keys.includes("value") ||
      keys.some((key) => typeof key !== "string")
    ) {
      return undefined;
    }
    const done = Object.getOwnPropertyDescriptor(value, "done");
    const chunk = Object.getOwnPropertyDescriptor(value, "value");
    if (
      done === undefined ||
      chunk === undefined ||
      done.enumerable !== true ||
      chunk.enumerable !== true ||
      !("value" in done) ||
      !("value" in chunk) ||
      typeof done.value !== "boolean"
    ) {
      return undefined;
    }
    return Object.freeze({ done: done.value, value: chunk.value });
  } catch {
    return undefined;
  }
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

async function readBoundedJsonResponse(response: object): Promise<RuntimeJsonValue | undefined> {
  const reader = captureBodyReader(response);
  if (reader === undefined) return undefined;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let chunkCount = 0;
  try {
    for (;;) {
      const result = captureReadResult(await Reflect.apply(reader.read, reader.reader, []));
      if (result === undefined) {
        await cancelBodyReader(reader);
        return undefined;
      }
      if (result.done) {
        const bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          return undefined;
        }
        return snapshotRuntimeJsonValue(parsed);
      }
      if (chunkCount >= MAX_SIGN_IN_RESPONSE_CHUNKS) {
        await cancelBodyReader(reader);
        return undefined;
      }
      const chunk = captureResponseChunk(result.value, MAX_SIGN_IN_RESPONSE_BYTES - totalBytes);
      if (chunk === undefined) {
        await cancelBodyReader(reader);
        return undefined;
      }
      chunks.push(chunk);
      totalBytes += chunk.byteLength;
      chunkCount += 1;
    }
  } catch {
    await cancelBodyReader(reader);
    return undefined;
  } finally {
    releaseBodyReader(reader);
  }
}

async function invokeSignIn(fetchLike: ReferenceHostSignInFetch, input: unknown): Promise<unknown> {
  const captured = captureSignInInput(input);
  if (captured === undefined) return UNAVAILABLE;

  let body: string;
  try {
    body = JSON.stringify(captured);
  } catch {
    return UNAVAILABLE;
  }

  let rawResponse: unknown;
  try {
    rawResponse = await Reflect.apply(fetchLike, undefined, [
      SIGN_IN_ENDPOINT,
      Object.freeze({
        method: "POST",
        headers: JSON_HEADERS,
        body,
        cache: "no-store",
        credentials: "same-origin",
        mode: "same-origin",
        redirect: "error",
        referrerPolicy: "no-referrer",
      } satisfies RequestInit),
    ]);
  } catch {
    return UNAVAILABLE;
  }

  const response = captureResponse(rawResponse);
  if (response === undefined) return UNAVAILABLE;
  if (response.status === 401) {
    cancelUnusedResponseBody(response.response);
    return INVALID_CREDENTIALS;
  }
  if (response.status < 200 || response.status >= 300) {
    cancelUnusedResponseBody(response.response);
    return UNAVAILABLE;
  }

  const value = await readBoundedJsonResponse(response.response);
  if (value === undefined) return UNAVAILABLE;
  return Object.freeze({
    status: "succeeded",
    value: value as RuntimeJsonValue,
  });
}

/**
 * Creates the trusted reference-host binding for the fixed same-origin sign-in endpoint.
 *
 * @remarks Each accepted invocation performs exactly one `POST /api/sign-in` request with
 * same-origin credentials and no cache or redirect following. HTTP 401 becomes the declared
 * `invalidCredentials` failure. Every other HTTP failure, network rejection, malformed response,
 * oversized or excessively fragmented response body, or JSON parse failure becomes the declared
 * `unavailable` failure without logging, inspecting, or forwarding a raw error. Successful bodies
 * are decoded from at most 64 KiB across at most 1,024 non-empty stream chunks before parsing.
 * Unused bodies from classified HTTP failures receive one best-effort cancellation request.
 *
 * A successfully parsed bounded JSON value is deliberately returned without applying the
 * operation output schema; runtime-core remains the sole owner of Catalog-authenticated output
 * validation. The binding performs no retry, timeout, token storage, or authentication-session
 * policy. It cancels a response-body reader that violates the local byte/chunk budget, but does
 * not claim cancellation of the already-started fetch itself.
 *
 * @throws TypeError when `fetchLike` is not callable.
 */
export function createReferenceHostSignInHttpBinding(
  fetchLike: ReferenceHostSignInFetch,
): SignInHostOperationBinding {
  if (typeof fetchLike !== "function") {
    throw new TypeError("Reference-host sign-in fetch dependency must be a function.");
  }
  const handler: SignInHostOperationHandler = (input) => invokeSignIn(fetchLike, input);
  return bindReferenceSignInHostOperation(handler);
}
