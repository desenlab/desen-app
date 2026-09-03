/* eslint-disable @typescript-eslint/no-invalid-void-type -- The injected browser transport is
 * deliberately receiver-independent at this trusted local integration boundary. */
import { bindReferenceSignInHostOperation } from "@desen/reference-catalog-web/host-operations";
import { snapshotRuntimeJsonValue } from "@desen/runtime-core";

import type { RuntimeHostCallResult, RuntimeOperationRequest } from "@desen/runtime-core";

/** Exact compile-time profile for a separately authorized local operation service. */
export const DESEN_APP_LOCAL_OPERATION_PROFILE = "desen.app.local-operation.v1" as const;

const ENDPOINT_PATH = "/api/sign-in";
const MAX_REQUEST_BYTES = 16_384;
const MAX_RESPONSE_BYTES = 65_536;
const MAX_RESPONSE_CHUNKS = 1_024;
const MAX_HEADER_COUNT = 64;
const MAX_HEADER_CODE_UNITS = 16_384;
const TIMEOUT_MILLISECONDS = 15_000;
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const DENIED = Object.freeze({ status: "denied" } as const);
const UNAVAILABLE = Object.freeze({ status: "failed", errorCode: "unavailable" } as const);
const INVALID_CREDENTIALS = Object.freeze({
  status: "failed",
  errorCode: "invalidCredentials",
} as const);

declare const __DESEN_APP_LOCAL_OPERATION_CONFIG__: unknown;

/** Closed application-owned local operation authority, never supplied by a DESEN document. */
export interface DesenAppLocalOperationConfig {
  /** Versioned, closed local integration profile. */
  readonly profile: typeof DESEN_APP_LOCAL_OPERATION_PROFILE;
  /** Exact loopback origin minted by the local operation listener. */
  readonly origin: string;
  /** Fresh launcher-lifetime bearer, independent of the Source persistence credential. */
  readonly apiToken: string;
}

/** Explicit fetch capability; there is no ambient transport fallback. */
export type DesenAppLocalOperationFetch = (
  this: void,
  input: string,
  init: RequestInit,
) => Promise<Response>;

/** Revocable callable consumed only by the App's authenticated Integration session. */
export type DesenAppLocalSignInOperation = (
  request: RuntimeOperationRequest,
  signal: AbortSignal,
) => Promise<RuntimeHostCallResult>;

/** Redacted composition failure that exposes neither configuration nor caller values. */
export class DesenAppLocalOperationConfigurationError extends Error {
  /** Stable classification of a rejected trusted composition. */
  readonly code: "INVALID_CONFIG" | "INVALID_FETCH";

  /** Creates a fixed-message configuration failure without retaining its cause. */
  constructor(code: "INVALID_CONFIG" | "INVALID_FETCH") {
    super(
      code === "INVALID_CONFIG"
        ? "The local operation configuration is invalid."
        : "The local operation transport is invalid.",
    );
    this.name = "DesenAppLocalOperationConfigurationError";
    this.code = code;
  }
}

function ownDataRecord(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const actualKeys = Reflect.ownKeys(value);
    if (
      actualKeys.length !== keys.length ||
      actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    ) {
      return undefined;
    }
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) return undefined;
      captured[key] = descriptor.value;
    }
    return Object.freeze(captured);
  } catch {
    return undefined;
  }
}

/** Captures an exact detached local config; unknown profiles, origins and active fields fail closed. */
export function captureDesenAppLocalOperationConfig(value: unknown): DesenAppLocalOperationConfig {
  const config = ownDataRecord(value, ["profile", "origin", "apiToken"]);
  const origin = config?.origin;
  const token = config?.apiToken;
  const match = typeof origin === "string" ? LOOPBACK_ORIGIN.exec(origin) : null;
  const port = match === null ? Number.NaN : Number(match[1]);
  if (
    config?.profile !== DESEN_APP_LOCAL_OPERATION_PROFILE ||
    typeof origin !== "string" ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535 ||
    new URL(origin).origin !== origin ||
    typeof token !== "string" ||
    token.length < 32 ||
    token.length > 256 ||
    !/^[\x21-\x7e]+$/u.test(token)
  ) {
    throw new DesenAppLocalOperationConfigurationError("INVALID_CONFIG");
  }
  return Object.freeze({ profile: DESEN_APP_LOCAL_OPERATION_PROFILE, origin, apiToken: token });
}

/** Reads only the trusted launcher define, or `null` when no local Integration host was installed. */
export function readInjectedDesenAppLocalOperationConfig(): DesenAppLocalOperationConfig | null {
  if (typeof __DESEN_APP_LOCAL_OPERATION_CONFIG__ === "undefined") return null;
  return captureDesenAppLocalOperationConfig(__DESEN_APP_LOCAL_OPERATION_CONFIG__);
}

function captureCredentials(request: RuntimeOperationRequest):
  | Readonly<{
      readonly email: string;
      readonly password: string;
    }>
  | undefined {
  const captured = ownDataRecord(request, [
    "context",
    "capabilityId",
    "invocationAlias",
    "input",
    "effect",
  ]);
  // The parent Integration authority binds the exact session and alias. This transport cannot
  // be redirected to a different executable capability even if that parent is called directly.
  if (captured?.capabilityId !== "com.example.auth/signIn" || captured.effect !== "network") {
    return undefined;
  }
  const input = ownDataRecord(captured.input, ["email", "password"]);
  if (
    typeof input?.email !== "string" ||
    input.email.length > 4_096 ||
    typeof input.password !== "string" ||
    input.password.length === 0 ||
    input.password.length > 4_096
  ) {
    return undefined;
  }
  return Object.freeze({ email: input.email, password: input.password });
}

function validResponse(response: Response, endpoint: string): boolean {
  if (
    !(response instanceof Response) ||
    response.redirected ||
    (response.url !== "" && response.url !== endpoint)
  ) {
    return false;
  }
  let count = 0;
  let codeUnits = 0;
  response.headers.forEach((value, name) => {
    count += 1;
    codeUnits += name.length + value.length;
  });
  const contentType = response.headers.get("content-type");
  const encoding = response.headers.get("content-encoding");
  const rawLength = response.headers.get("content-length");
  return (
    count <= MAX_HEADER_COUNT &&
    codeUnits <= MAX_HEADER_CODE_UNITS &&
    contentType !== null &&
    /^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType) &&
    (encoding === null || encoding === "identity") &&
    (rawLength === null ||
      (/^(?:0|[1-9][0-9]*)$/u.test(rawLength) && Number(rawLength) <= MAX_RESPONSE_BYTES))
  );
}

function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array> | undefined): void {
  try {
    void reader?.cancel().catch(() => undefined);
  } catch {
    // Revocation and public settlement never depend on response cleanup cooperating.
  }
}

async function invokeTransport(
  config: DesenAppLocalOperationConfig,
  fetchLike: DesenAppLocalOperationFetch,
  credentials: Readonly<{ readonly email: string; readonly password: string }>,
  callerSignal: AbortSignal,
): Promise<RuntimeHostCallResult> {
  const body = JSON.stringify(credentials);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return DENIED;
  const endpoint = `${config.origin}${ENDPOINT_PATH}`;
  const transport = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let interruptedResult: RuntimeHostCallResult | undefined;
  let settleInterruption: (result: RuntimeHostCallResult) => void = () => undefined;
  const interruption = new Promise<RuntimeHostCallResult>((resolve) => {
    settleInterruption = resolve;
  });
  const interrupt = (result: RuntimeHostCallResult) => {
    if (interruptedResult !== undefined) return;
    interruptedResult = result;
    transport.abort();
    cancelReader(reader);
    settleInterruption(result);
  };
  const revoke = () => interrupt(DENIED);
  callerSignal.addEventListener("abort", revoke, { once: true });
  if (callerSignal.aborted) revoke();
  const timeout = globalThis.setTimeout(() => interrupt(UNAVAILABLE), TIMEOUT_MILLISECONDS);

  const execute = async (): Promise<RuntimeHostCallResult> => {
    try {
      if (interruptedResult !== undefined) return interruptedResult;
      const response = await Reflect.apply(fetchLike, undefined, [
        endpoint,
        Object.freeze({
          method: "POST",
          headers: Object.freeze({
            accept: "application/json",
            authorization: `Bearer ${config.apiToken}`,
            "content-type": "application/json",
          }),
          body,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          mode: "cors",
          referrerPolicy: "no-referrer",
          signal: transport.signal,
        } satisfies RequestInit),
      ]);
      if (interruptedResult !== undefined) {
        if (response instanceof Response) void response.body?.cancel().catch(() => undefined);
        return interruptedResult;
      }
      if (!validResponse(response, endpoint)) {
        if (response instanceof Response) void response.body?.cancel().catch(() => undefined);
        return UNAVAILABLE;
      }
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => undefined);
        return response.status === 401 ? INVALID_CREDENTIALS : UNAVAILABLE;
      }
      if (response.body === null) return UNAVAILABLE;
      const responseReader = response.body.getReader();
      reader = responseReader;
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const next = await responseReader.read();
        if (interruptedResult !== undefined) return interruptedResult;
        if (next.done) break;
        if (
          !(next.value instanceof Uint8Array) ||
          chunks.length >= MAX_RESPONSE_CHUNKS ||
          bytes + next.value.byteLength > MAX_RESPONSE_BYTES
        ) {
          cancelReader(reader);
          return UNAVAILABLE;
        }
        const chunk = new Uint8Array(next.value);
        bytes += chunk.byteLength;
        chunks.push(chunk);
      }
      const combined = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const value = snapshotRuntimeJsonValue(
        JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined)),
      );
      return value === undefined ? UNAVAILABLE : Object.freeze({ status: "succeeded", value });
    } catch {
      cancelReader(reader);
      return interruptedResult ?? UNAVAILABLE;
    } finally {
      try {
        reader?.releaseLock();
      } catch {
        // A cancelled pending reader may still be releasing its platform-owned lock.
      }
    }
  };

  try {
    return await Promise.race([execute(), interruption]);
  } finally {
    globalThis.clearTimeout(timeout);
    callerSignal.removeEventListener("abort", revoke);
  }
}

/**
 * Binds the fixed reference capability to a bounded, revocable, real local HTTP operation.
 *
 * @remarks Only trusted App composition supplies config and fetch. Source data selects neither
 * endpoint nor executable handler. This local reference account is not production authentication;
 * Runtime remains the owner of Catalog output validation and stale-session publication. Caller
 * cancellation returns denial even if a transport ignores abort; timeout and transport failures
 * return only the declared public `unavailable` code, without raw error or credential disclosure.
 */
export function createDesenAppLocalSignInOperation(
  configValue: unknown,
  fetchLikeValue: unknown,
): DesenAppLocalSignInOperation {
  const config = captureDesenAppLocalOperationConfig(configValue);
  if (typeof fetchLikeValue !== "function") {
    throw new DesenAppLocalOperationConfigurationError("INVALID_FETCH");
  }
  const fetchLike = fetchLikeValue as DesenAppLocalOperationFetch;
  return async (request, signal) => {
    try {
      if (!(signal instanceof AbortSignal) || signal.aborted) return DENIED;
      const credentials = captureCredentials(request);
      if (credentials === undefined || signal.aborted) return DENIED;
      const binding = bindReferenceSignInHostOperation((input) =>
        invokeTransport(config, fetchLike, input, signal),
      );
      return await (binding.invoke(credentials) as Promise<RuntimeHostCallResult>);
    } catch {
      return UNAVAILABLE;
    }
  };
}
