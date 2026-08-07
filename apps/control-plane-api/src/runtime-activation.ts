import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";

import { BundleStoreError } from "./bundle-store-contract.js";
import { openBundleStore } from "./bundle-store.js";
import { RuntimeActivationError } from "./runtime-activation-contract.js";
import { createBundleRuntimeActivationInternal } from "./runtime-activation-internal.js";
import { readRuntimeActivationStorageErrorCode } from "./runtime-activation-repository-internal.js";

import type { BundleRuntimeActivation } from "./runtime-activation-contract.js";
import type { OpenBundleRuntimeActivationOptions } from "./runtime-activation-contract.js";
import type { BundleStore } from "./bundle-store-contract.js";
import type { RuntimeActivationRepository } from "./runtime-activation-repository-internal.js";

const ACTIVATION_DATABASE_FILE_NAME = "runtime-activation.sqlite3";

function captureRootDirectory(value: unknown): string {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    ) {
      throw new RuntimeActivationError("INVALID_ROOT_DIRECTORY");
    }
    const keys = Reflect.ownKeys(value);
    const descriptor = Object.getOwnPropertyDescriptor(value, "rootDirectory");
    if (
      keys.length !== 1 ||
      keys[0] !== "rootDirectory" ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 ||
      descriptor.value.includes("\0") ||
      !path.isAbsolute(descriptor.value)
    ) {
      throw new RuntimeActivationError("INVALID_ROOT_DIRECTORY");
    }
    return path.resolve(descriptor.value);
  } catch (error) {
    if (error instanceof RuntimeActivationError) throw error;
    throw new RuntimeActivationError("INVALID_ROOT_DIRECTORY");
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
      throw new RuntimeActivationError("UNSAFE_STORAGE_PATH");
    }
    return await realpath(rootDirectory);
  } catch (error) {
    if (error instanceof RuntimeActivationError) throw error;
    throw new RuntimeActivationError(
      systemErrorCode(error) === "ENOENT" ? "INVALID_ROOT_DIRECTORY" : "STORAGE_IO_FAILURE",
    );
  }
}

function fromBundleStoreError(error: BundleStoreError): RuntimeActivationError {
  switch (error.code) {
    case "INVALID_ROOT_DIRECTORY":
      return new RuntimeActivationError("INVALID_ROOT_DIRECTORY");
    case "UNSAFE_STORAGE_PATH":
      return new RuntimeActivationError("UNSAFE_STORAGE_PATH");
    case "COMMIT_OUTCOME_INDETERMINATE":
    case "INVALID_ENTRY":
    case "INVALID_REVISION":
    case "STORAGE_IO_FAILURE":
      return new RuntimeActivationError("STORAGE_IO_FAILURE");
  }
}

/**
 * Transfers one already-open repository into the activation controller or closes it on failure.
 *
 * @internal This ownership seam exists for focused failure cleanup tests and is not public API.
 */
export function createOwnedBundleRuntimeActivationInternal(
  bundleStore: BundleStore,
  repository: RuntimeActivationRepository,
): BundleRuntimeActivation {
  try {
    return createBundleRuntimeActivationInternal({ bundleStore, repository });
  } catch (error) {
    try {
      repository.close();
    } catch {
      // Preserve the already redacted initialization failure; cleanup is best effort.
    }
    throw error;
  }
}

/**
 * Opens the transactional activation and restart-recovery service beneath one application-owned
 * local root.
 *
 * @remarks The factory reopens the same immutable T01 Bundle store and creates an independent
 * `runtime-activation.sqlite3` singleton record. The pinned native SQLite adapter is loaded only
 * when this factory is called; importing the package root remains native-addon-free. Callers
 * cannot inject a store, repository, database path, active revision, or previous-good revision.
 */
export async function openBundleRuntimeActivation(
  options: OpenBundleRuntimeActivationOptions,
): Promise<BundleRuntimeActivation> {
  const requestedRoot = captureRootDirectory(options);
  const canonicalRoot = await captureCanonicalRoot(requestedRoot);
  try {
    const bundleStore = await openBundleStore({ rootDirectory: canonicalRoot });
    const sqlite = await import("./runtime-activation-sqlite-internal.js");
    const repository = sqlite.openRuntimeActivationSqliteRepository(
      path.join(canonicalRoot, ACTIVATION_DATABASE_FILE_NAME),
    );
    return createOwnedBundleRuntimeActivationInternal(bundleStore, repository);
  } catch (error) {
    if (error instanceof RuntimeActivationError) throw error;
    if (error instanceof BundleStoreError) throw fromBundleStoreError(error);
    const code = readRuntimeActivationStorageErrorCode(error);
    throw new RuntimeActivationError(code ?? "STORAGE_IO_FAILURE");
  }
}
