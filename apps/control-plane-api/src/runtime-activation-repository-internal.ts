/* eslint-disable @typescript-eslint/no-invalid-void-type -- Repository callbacks are deliberately
 * receiver-independent at the package-private persistence boundary. */

import { isSha256Digest } from "@desen/protocol";

import type { RuntimeActivationRecord } from "./runtime-activation-contract.js";

const MAX_GENERATION = Number.MAX_SAFE_INTEGER;

/** Stable package-private storage failures shared without loading the native SQLite adapter. */
export type RuntimeActivationStorageErrorCode =
  | "ACTIVATION_BUSY"
  | "ACTIVATION_CLOSED"
  | "ACTIVATION_CORRUPT"
  | "STORAGE_IO_FAILURE"
  | "UNSAFE_STORAGE_PATH";

const STORAGE_ERRORS = new WeakSet<object>();

function validStorageErrorCode(value: unknown): value is RuntimeActivationStorageErrorCode {
  switch (value) {
    case "ACTIVATION_BUSY":
    case "ACTIVATION_CLOSED":
    case "ACTIVATION_CORRUPT":
    case "STORAGE_IO_FAILURE":
    case "UNSAFE_STORAGE_PATH":
      return true;
    default:
      return false;
  }
}

/** Redacted authenticated package-private storage failure. @internal */
export class RuntimeActivationStorageError extends Error {
  /** Stable reason for the failed storage operation. */
  readonly code: RuntimeActivationStorageErrorCode;

  /** Creates one fixed internal failure classification with an inert own code field. */
  constructor(code: RuntimeActivationStorageErrorCode) {
    super("The runtime activation repository could not complete its storage operation.");
    this.name = "RuntimeActivationStorageError";
    this.code = code;
    Object.defineProperty(this, "code", {
      configurable: false,
      enumerable: true,
      value: code,
      writable: false,
    });
    STORAGE_ERRORS.add(this);
  }
}

/**
 * Reads only an authentic inert storage-error code without invoking caller-controlled accessors.
 *
 * @internal
 */
export function readRuntimeActivationStorageErrorCode(
  error: unknown,
): RuntimeActivationStorageErrorCode | undefined {
  try {
    if (error === null || typeof error !== "object" || !STORAGE_ERRORS.has(error)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.configurable !== false ||
      descriptor.enumerable !== true ||
      descriptor.writable !== false ||
      !validStorageErrorCode(descriptor.value)
    ) {
      return undefined;
    }
    return descriptor.value;
  } catch {
    return undefined;
  }
}

/** Controlled read of the singleton activation record. @internal */
export type RuntimeActivationRepositoryReadResult =
  | Readonly<{ readonly status: "found"; readonly record: RuntimeActivationRecord }>
  | Readonly<{ readonly status: "missing" }>;

/** Controlled atomic compare-and-set result produced by an activation repository. @internal */
export type RuntimeActivationRepositoryCommitResult =
  | Readonly<{ readonly status: "activated"; readonly record: RuntimeActivationRecord }>
  | Readonly<{
      readonly status: "precondition-failed";
      readonly current: RuntimeActivationRecord | null;
    }>
  | Readonly<{
      readonly status: "generation-exhausted";
      readonly current: RuntimeActivationRecord;
    }>
  | Readonly<{ readonly status: "recovery-required" }>;

/** Package-private persistence port for the one atomic active/previous-good record. @internal */
export interface RuntimeActivationRepository {
  /** Reads one detached complete record or reports that no activation has committed. */
  readonly get: (this: void) => RuntimeActivationRepositoryReadResult;
  /**
   * Commits the candidate only when durable state still equals the controller's authenticated
   * baseline and the caller's expected generation identifies that baseline.
   *
   * @remarks A baseline mismatch is recovery-required rather than an ordinary caller
   * precondition failure. This distinction prevents a deleted or same-generation externally
   * rewritten record from being accepted as a fresh state. The repository derives both active and
   * previous-good revisions; the caller cannot submit either value independently.
   */
  readonly commit: (
    this: void,
    expectedGeneration: number | null,
    authenticatedCurrent: RuntimeActivationRecord | null,
    candidateRevision: string,
  ) => RuntimeActivationRepositoryCommitResult;
  /** Idempotently closes the repository. */
  readonly close: (this: void) => void;
}

/** Options used only by the deterministic package-private memory adapter. @internal */
export interface InMemoryRuntimeActivationRepositoryOptions {
  /** Detached initial singleton record used by focused generation-boundary tests. */
  readonly initialRecord?: RuntimeActivationRecord;
}

/** Captures one exact inert runtime activation record for trusted persistence adapters. @internal */
export function captureRuntimeActivationRecord(value: unknown): RuntimeActivationRecord {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw new TypeError("Invalid activation record.");
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      !keys.includes("activeRevision") ||
      !keys.includes("previousGoodRevision") ||
      !keys.includes("generation")
    ) {
      throw new TypeError("Invalid activation record.");
    }
    const data = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError("Invalid activation record.");
      }
      return descriptor.value;
    };
    const activeRevision = data("activeRevision");
    const previousGoodRevision = data("previousGoodRevision");
    const generation = data("generation");
    if (
      !isSha256Digest(activeRevision) ||
      (previousGoodRevision !== null && !isSha256Digest(previousGoodRevision)) ||
      previousGoodRevision === activeRevision ||
      typeof generation !== "number" ||
      !Number.isSafeInteger(generation) ||
      generation < 0
    ) {
      throw new TypeError("Invalid activation record.");
    }
    return Object.freeze({ activeRevision, previousGoodRevision, generation });
  } catch {
    throw new TypeError("Invalid activation record.");
  }
}

function detached(record: RuntimeActivationRecord): RuntimeActivationRecord {
  return Object.freeze({ ...record });
}

function sameRecord(
  left: RuntimeActivationRecord | null,
  right: RuntimeActivationRecord | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.activeRevision === right.activeRevision &&
      left.previousGoodRevision === right.previousGoodRevision &&
      left.generation === right.generation)
  );
}

function nextRecord(
  current: RuntimeActivationRecord | null,
  candidateRevision: string,
): RuntimeActivationRecord {
  return Object.freeze({
    activeRevision: candidateRevision,
    previousGoodRevision:
      current === null
        ? null
        : current.activeRevision === candidateRevision
          ? current.previousGoodRevision
          : current.activeRevision,
    generation: current === null ? 0 : current.generation + 1,
  });
}

/** Creates a deterministic singleton repository used only by focused package tests. @internal */
export function createInMemoryRuntimeActivationRepository(
  options: InMemoryRuntimeActivationRepositoryOptions = {},
): RuntimeActivationRepository {
  let current =
    options.initialRecord === undefined
      ? null
      : captureRuntimeActivationRecord(options.initialRecord);
  let closed = false;

  const assertOpen = (): void => {
    if (closed) throw new TypeError("The activation repository is closed.");
  };

  return Object.freeze({
    get: () => {
      assertOpen();
      return current === null
        ? Object.freeze({ status: "missing" as const })
        : Object.freeze({ status: "found" as const, record: detached(current) });
    },
    commit: (
      expectedGeneration: number | null,
      authenticatedCurrent: RuntimeActivationRecord | null,
      candidateRevision: string,
    ): RuntimeActivationRepositoryCommitResult => {
      assertOpen();
      let capturedAuthenticatedCurrent: RuntimeActivationRecord | null;
      try {
        capturedAuthenticatedCurrent =
          authenticatedCurrent === null
            ? null
            : captureRuntimeActivationRecord(authenticatedCurrent);
      } catch {
        throw new TypeError("Invalid activation commit input.");
      }
      if (
        (expectedGeneration !== null &&
          (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)) ||
        !isSha256Digest(candidateRevision)
      ) {
        throw new TypeError("Invalid activation commit input.");
      }
      if (
        (current === null && expectedGeneration !== null) ||
        (current !== null && current.generation !== expectedGeneration)
      ) {
        return Object.freeze({
          status: "precondition-failed" as const,
          current: current === null ? null : detached(current),
        });
      }
      if (!sameRecord(current, capturedAuthenticatedCurrent)) {
        return Object.freeze({ status: "recovery-required" as const });
      }
      if (current?.generation === MAX_GENERATION) {
        return Object.freeze({
          status: "generation-exhausted" as const,
          current: detached(current),
        });
      }
      current = nextRecord(current, candidateRevision);
      return Object.freeze({ status: "activated" as const, record: detached(current) });
    },
    close: () => {
      closed = true;
    },
  });
}
