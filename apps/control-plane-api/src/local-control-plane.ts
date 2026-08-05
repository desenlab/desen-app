import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { URL } from "node:url";

import { BundleStoreError } from "./bundle-store-contract.js";
import { openBundleStore } from "./bundle-store.js";
import {
  LOCAL_CONTROL_PLANE_LIMITS,
  LocalControlPlaneError,
} from "./local-control-plane-contract.js";
import { createLocalControlPlaneApplication } from "./local-control-plane-internal.js";

import type {
  LocalControlPlane,
  OpenLocalControlPlaneOptions,
} from "./local-control-plane-contract.js";

const METADATA_FILE_NAME = "control-plane.sqlite3";
const VISIBLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;

interface CapturedOpenOptions {
  readonly rootDirectory: string;
  readonly apiToken: string;
  readonly allowedOrigins: readonly string[];
}

function ownData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && descriptor.enumerable && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function captureAllowedOrigins(value: unknown): readonly string[] {
  if (value === undefined) return Object.freeze([]);
  try {
    if (
      !Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > LOCAL_CONTROL_PLANE_LIMITS.maxAllowedOrigins
    ) {
      throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== value.length + 1 ||
      keys[keys.length - 1] !== "length" ||
      keys.slice(0, -1).some((key, index) => key !== String(index))
    ) {
      throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
    }
    const origins: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      const candidate =
        descriptor !== undefined && descriptor.enumerable && "value" in descriptor
          ? descriptor.value
          : undefined;
      if (
        typeof candidate !== "string" ||
        candidate.length === 0 ||
        candidate.length > LOCAL_CONTROL_PLANE_LIMITS.maxOriginCodeUnits ||
        candidate === "null"
      ) {
        throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
      }
      let parsed: URL;
      try {
        parsed = new URL(candidate);
      } catch {
        throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
      }
      if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.pathname !== "/" ||
        parsed.search !== "" ||
        parsed.hash !== "" ||
        parsed.origin !== candidate
      ) {
        throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
      }
      origins.push(candidate);
    }
    if (new Set(origins).size !== origins.length) {
      throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
    }
    return Object.freeze(origins);
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
  }
}

function captureOpenOptions(value: unknown): CapturedOpenOptions {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      throw new LocalControlPlaneError("INVALID_ROOT_DIRECTORY");
    }
    const keys = Reflect.ownKeys(value);
    const allowedKeys = new Set(["allowedOrigins", "apiToken", "rootDirectory"]);
    if (
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key)) ||
      !keys.includes("rootDirectory") ||
      !keys.includes("apiToken")
    ) {
      throw new LocalControlPlaneError("INVALID_ROOT_DIRECTORY");
    }
    const rootDirectory = ownData(value, "rootDirectory");
    if (
      typeof rootDirectory !== "string" ||
      rootDirectory.length === 0 ||
      rootDirectory.includes("\0") ||
      !path.isAbsolute(rootDirectory)
    ) {
      throw new LocalControlPlaneError("INVALID_ROOT_DIRECTORY");
    }
    const apiToken = ownData(value, "apiToken");
    if (
      typeof apiToken !== "string" ||
      !VISIBLE_ASCII_PATTERN.test(apiToken) ||
      Buffer.byteLength(apiToken, "utf8") < LOCAL_CONTROL_PLANE_LIMITS.minApiTokenUtf8Bytes ||
      Buffer.byteLength(apiToken, "utf8") > LOCAL_CONTROL_PLANE_LIMITS.maxApiTokenUtf8Bytes
    ) {
      throw new LocalControlPlaneError("INVALID_API_TOKEN");
    }
    const allowedOriginsDescriptor = Object.getOwnPropertyDescriptor(value, "allowedOrigins");
    if (
      keys.includes("allowedOrigins") &&
      (allowedOriginsDescriptor === undefined ||
        !allowedOriginsDescriptor.enumerable ||
        !("value" in allowedOriginsDescriptor))
    ) {
      throw new LocalControlPlaneError("INVALID_ALLOWED_ORIGIN");
    }
    return Object.freeze({
      rootDirectory: path.resolve(rootDirectory),
      apiToken,
      allowedOrigins: captureAllowedOrigins(allowedOriginsDescriptor?.value),
    });
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    throw new LocalControlPlaneError("INVALID_ROOT_DIRECTORY");
  }
}

function systemErrorCode(error: unknown): string | undefined {
  try {
    if (error === null || typeof error !== "object") return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    return descriptor !== undefined && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

async function captureCanonicalRoot(rootDirectory: string): Promise<string> {
  try {
    const entry = await lstat(rootDirectory);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new LocalControlPlaneError("UNSAFE_STORAGE_PATH");
    }
    return await realpath(rootDirectory);
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    return systemErrorCode(error) === "ENOENT"
      ? Promise.reject(new LocalControlPlaneError("INVALID_ROOT_DIRECTORY"))
      : Promise.reject(new LocalControlPlaneError("STORAGE_IO_FAILURE"));
  }
}

function fromBundleStoreError(error: BundleStoreError): LocalControlPlaneError {
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

/**
 * Opens one authenticated local Source, immutable Bundle, and mutable channel service.
 *
 * @remarks The returned listener can bind only exact IPv4 loopback. SQLite stores editable Source
 * bytes and channel generations in a separate metadata file; immutable Bundle bytes continue to
 * use the M07-T01 content-addressed store. Opening this factory dynamically loads the pinned native
 * SQLite adapter. Merely importing the package root does not load a native addon.
 */
export async function openLocalControlPlane(
  options: OpenLocalControlPlaneOptions,
): Promise<LocalControlPlane> {
  const captured = captureOpenOptions(options);
  const canonicalRoot = await captureCanonicalRoot(captured.rootDirectory);
  try {
    const bundleStore = await openBundleStore({ rootDirectory: captured.rootDirectory });
    const sqlite = await import("./local-control-plane-sqlite-internal.js");
    const metadata = sqlite.openLocalControlPlaneSqliteRepositories(
      path.join(canonicalRoot, METADATA_FILE_NAME),
    );
    try {
      return createLocalControlPlaneApplication({
        apiToken: captured.apiToken,
        allowedOrigins: captured.allowedOrigins,
        bundleStore,
        sourceRepository: metadata.sourceRepository,
        channelRepository: metadata.channelRepository,
        closeMetadata: metadata.close,
      });
    } catch (error) {
      metadata.close();
      throw error;
    }
  } catch (error) {
    if (error instanceof LocalControlPlaneError) throw error;
    if (error instanceof BundleStoreError) throw fromBundleStoreError(error);
    try {
      const descriptor =
        error !== null && typeof error === "object"
          ? Object.getOwnPropertyDescriptor(error, "code")
          : undefined;
      const code = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
      if (
        code === "METADATA_BUSY" ||
        code === "METADATA_CORRUPT" ||
        code === "STORAGE_IO_FAILURE" ||
        code === "UNSAFE_STORAGE_PATH"
      ) {
        throw new LocalControlPlaneError(code);
      }
    } catch (mapped) {
      if (mapped instanceof LocalControlPlaneError) throw mapped;
    }
    throw new LocalControlPlaneError("INTERNAL_FAILURE");
  }
}
