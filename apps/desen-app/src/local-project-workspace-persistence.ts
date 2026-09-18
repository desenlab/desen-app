import { canonicalizeJson } from "@desen/protocol";

import {
  DesenAppLocalRuntimeConfigurationError,
  captureDesenAppLocalRuntimeConfig,
  readInjectedDesenAppLocalRuntimeConfig,
} from "./local-runtime-persistence.js";
import { admitProjectWorkspaceRecord } from "./project-lifecycle.js";

import type { DesenAppLocalRuntimeBrowserFetch } from "./local-runtime-persistence.js";
import type {
  ProjectWorkspaceSaveResult,
  ProjectWorkspaceStoragePort,
} from "./project-lifecycle.js";

const WORKSPACE_KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u;
const GENERATION_ETAG_PATTERN = /^"g:([1-9][0-9]*)"$/u;
const JSON_MEDIA_TYPE = "application/json";
const MAX_PROJECT_WORKSPACE_BYTES = 8_388_608;
const MAX_RESPONSE_HEADERS = 64;
const MAX_RESPONSE_HEADER_CODE_UNITS = 32_768;
const MAX_RESPONSE_CHUNKS = 1_024;
const FETCH_TIMEOUT_MILLISECONDS = 20_000;
const REQUEST_KEYS = Object.freeze(["expectedGeneration", "workspace"] as const);
const RECEIPT_KEYS = Object.freeze(["generation", "status", "workspaceKey"] as const);
const ERROR_ENVELOPE_KEYS = Object.freeze(["error"] as const);
const ERROR_KEYS = Object.freeze(["code", "message"] as const);

/** Fixed local persistence identity for one complete application project workspace. */
export interface DesenAppLocalProjectWorkspacePersistenceOptions {
  /** Independent lowercase storage identity; product wiring must not reuse a Source key or project id. */
  readonly workspaceKey: string;
}

function exactOwnData(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
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

function captureWorkspaceKey(value: unknown): string {
  if (typeof value !== "string" || !WORKSPACE_KEY_PATTERN.test(value)) {
    throw new DesenAppLocalRuntimeConfigurationError("INVALID_CONFIG");
  }
  return value;
}

function captureOptions(value: unknown): DesenAppLocalProjectWorkspacePersistenceOptions {
  const captured = exactOwnData(value, ["workspaceKey"]);
  return Object.freeze({ workspaceKey: captureWorkspaceKey(captured?.workspaceKey) });
}

function captureBrowserFetch(value: unknown): DesenAppLocalRuntimeBrowserFetch {
  if (typeof value !== "function") {
    throw new DesenAppLocalRuntimeConfigurationError("INVALID_FETCH");
  }
  return value as DesenAppLocalRuntimeBrowserFetch;
}

function contentIsJson(response: Response): boolean {
  return /^application\/json(?:;\s*charset=utf-8)?$/iu.test(
    response.headers.get("content-type") ?? "",
  );
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return undefined;
  }
}

function generationFromEtag(value: string | null): number | undefined {
  const match = value === null ? null : GENERATION_ETAG_PATTERN.exec(value);
  const generation = match === null ? Number.NaN : Number(match[1]);
  return Number.isSafeInteger(generation) && generation > 0 ? generation : undefined;
}

function errorCode(value: unknown): string | undefined {
  const envelope = exactOwnData(value, ERROR_ENVELOPE_KEYS);
  const error = exactOwnData(envelope?.error, ERROR_KEYS);
  return typeof error?.code === "string" && typeof error.message === "string"
    ? error.code
    : undefined;
}

function saveReceipt(
  value: unknown,
  workspaceKey: string,
  statusCode: number,
  etagGeneration: number | undefined,
):
  | Exclude<
      ProjectWorkspaceSaveResult,
      { readonly status: "conflict" | "failed" | "indeterminate" }
    >
  | undefined {
  const receipt = exactOwnData(value, RECEIPT_KEYS);
  if (
    receipt?.workspaceKey !== workspaceKey ||
    typeof receipt.generation !== "number" ||
    !Number.isSafeInteger(receipt.generation) ||
    receipt.generation < 1 ||
    receipt.generation !== etagGeneration
  ) {
    return undefined;
  }
  if (statusCode === 201 && receipt.status === "created" && receipt.generation === 1) {
    return Object.freeze({ status: "created", generation: 1 });
  }
  if (statusCode === 200 && receipt.status === "updated") {
    return Object.freeze({ status: "updated", generation: receipt.generation });
  }
  if (statusCode === 200 && receipt.status === "unchanged") {
    return Object.freeze({ status: "unchanged", generation: receipt.generation });
  }
  return undefined;
}

function responseContentLength(response: Response): number | undefined {
  const value = response.headers.get("content-length");
  if (value === null || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

async function readBoundedResponseBody(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = responseContentLength(response);
  if (declaredLength !== undefined && declaredLength > MAX_PROJECT_WORKSPACE_BYTES) {
    throw new TypeError("The project-workspace response exceeds its fixed byte limit.");
  }
  if (response.body === null) {
    if (declaredLength !== undefined && declaredLength !== 0) {
      throw new TypeError("The project-workspace response length is inconsistent.");
    }
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let chunkCount = 0;
  let length = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      chunkCount += 1;
      const chunk = new Uint8Array(result.value);
      length += chunk.byteLength;
      if (length > MAX_PROJECT_WORKSPACE_BYTES || chunkCount > MAX_RESPONSE_CHUNKS) {
        await reader.cancel();
        throw new TypeError("The project-workspace response exceeds its fixed limits.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  if (declaredLength !== undefined && declaredLength !== length) {
    throw new TypeError("The project-workspace response length is inconsistent.");
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function captureResponseHeaders(response: Response): void {
  let count = 0;
  let codeUnits = 0;
  response.headers.forEach((value, name) => {
    count += 1;
    codeUnits += name.length + value.length;
  });
  if (count > MAX_RESPONSE_HEADERS || codeUnits > MAX_RESPONSE_HEADER_CODE_UNITS) {
    throw new TypeError("The project-workspace response headers exceed their fixed limit.");
  }
}

async function browserRequest(
  browserFetch: DesenAppLocalRuntimeBrowserFetch,
  url: string,
  init: RequestInit,
): Promise<Readonly<{ readonly body: Uint8Array<ArrayBuffer>; readonly response: Response }>> {
  const abortController = new AbortController();
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeout = globalThis.setTimeout(() => {
      abortController.abort();
      reject(new TypeError("The project-workspace request exceeded its fixed time limit."));
    }, FETCH_TIMEOUT_MILLISECONDS);
  });
  try {
    const request = Promise.resolve().then(async () => {
      const response = await browserFetch(url, {
        ...init,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
        referrerPolicy: "no-referrer",
        signal: abortController.signal,
      });
      if (!(response instanceof Response) || response.redirected) {
        throw new TypeError("The project-workspace response is invalid.");
      }
      captureResponseHeaders(response);
      return Object.freeze({ response, body: await readBoundedResponseBody(response) });
    });
    return await Promise.race([request, deadline]);
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout);
  }
}

function saveRequestBody(request: unknown): string | undefined {
  const captured = exactOwnData(request, REQUEST_KEYS);
  const expectedGeneration = captured?.expectedGeneration;
  if (
    expectedGeneration !== null &&
    (!Number.isSafeInteger(expectedGeneration) || (expectedGeneration as number) < 1)
  ) {
    return undefined;
  }
  const admitted = admitProjectWorkspaceRecord(captured?.workspace);
  if (!admitted.ok) return undefined;
  try {
    const body = canonicalizeJson(admitted.workspace);
    const length = new TextEncoder().encode(body).byteLength;
    return length > 0 && length <= MAX_PROJECT_WORKSPACE_BYTES ? body : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Creates a narrow browser `ProjectWorkspaceStoragePort` over the local authenticated transport.
 *
 * @remarks The port always writes one complete, app-admitted project registry through a distinct
 * `/v1/project-workspaces/:workspaceKey` authority. It has no route to `/v1/sources`, no Source
 * extension surface, and no token or runtime-host authority.
 */
export function createDesenAppLocalProjectWorkspaceStoragePort(
  configValue: unknown,
  browserFetchValue: unknown,
  optionsValue: unknown,
): ProjectWorkspaceStoragePort {
  const config = captureDesenAppLocalRuntimeConfig(configValue);
  const browserFetch = captureBrowserFetch(browserFetchValue);
  const options = captureOptions(optionsValue);
  const url = `${config.controlPlane.origin}/v1/project-workspaces/${options.workspaceKey}`;

  const openWorkspace: ProjectWorkspaceStoragePort["openWorkspace"] = async () => {
    try {
      const result = await browserRequest(browserFetch, url, {
        method: "GET",
        headers: { authorization: `Bearer ${config.controlPlane.apiToken}` },
      });
      const parsed = contentIsJson(result.response) ? parseJson(result.body) : undefined;
      if (result.response.status === 404 && errorCode(parsed) === "PROJECT_WORKSPACE_NOT_FOUND") {
        return Object.freeze({ status: "missing" });
      }
      const generation = generationFromEtag(result.response.headers.get("etag"));
      const admitted = admitProjectWorkspaceRecord(parsed);
      if (result.response.status !== 200 || generation === undefined || !admitted.ok) {
        return Object.freeze({ status: "failed" });
      }
      return Object.freeze({
        status: "opened",
        generation,
        workspace: admitted.workspace,
      });
    } catch {
      return Object.freeze({ status: "failed" });
    }
  };

  const saveWorkspace: ProjectWorkspaceStoragePort["saveWorkspace"] = async (request) => {
    const body = saveRequestBody(request);
    const expectedGeneration = exactOwnData(request, REQUEST_KEYS)?.expectedGeneration;
    if (
      body === undefined ||
      (expectedGeneration !== null && typeof expectedGeneration !== "number")
    ) {
      return Object.freeze({ status: "failed" });
    }
    try {
      const result = await browserRequest(browserFetch, url, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${config.controlPlane.apiToken}`,
          "content-type": JSON_MEDIA_TYPE,
          ...(expectedGeneration === null
            ? { "if-none-match": "*" }
            : { "if-match": `"g:${String(expectedGeneration)}"` }),
        },
        body,
      });
      const parsed = contentIsJson(result.response) ? parseJson(result.body) : undefined;
      const generation = generationFromEtag(result.response.headers.get("etag"));
      const receipt = saveReceipt(parsed, options.workspaceKey, result.response.status, generation);
      if (receipt !== undefined) return receipt;
      if (result.response.status === 412 && errorCode(parsed) === "GENERATION_MISMATCH") {
        return Object.freeze({ status: "conflict", currentGeneration: generation ?? null });
      }
      if (
        result.response.status === 400 ||
        result.response.status === 409 ||
        result.response.status === 413 ||
        result.response.status === 415 ||
        result.response.status === 428
      ) {
        return Object.freeze({ status: "failed" });
      }
      return Object.freeze({ status: "indeterminate" });
    } catch {
      return Object.freeze({ status: "indeterminate" });
    }
  };

  return Object.freeze({ openWorkspace, saveWorkspace });
}

/** Creates the injected local project-workspace port, or `null` outside the local launcher. */
export function createInjectedDesenAppLocalProjectWorkspaceStoragePort(
  browserFetchValue: unknown,
  optionsValue: unknown,
): ProjectWorkspaceStoragePort | null {
  const config = readInjectedDesenAppLocalRuntimeConfig();
  return config === null
    ? null
    : createDesenAppLocalProjectWorkspaceStoragePort(config, browserFetchValue, optionsValue);
}
