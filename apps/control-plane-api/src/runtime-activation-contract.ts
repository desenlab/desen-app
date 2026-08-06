/* eslint-disable @typescript-eslint/no-invalid-void-type -- Activation methods are deliberately
 * receiver-independent at the host-owned durable boundary. */

import type { DesenDiagnostic } from "@desen/protocol";

import type { BundleReferencePreflightAuthority } from "./reference-preflight-contract.js";
import type { BundleRuntimeStagingAuthority } from "./runtime-staging-contract.js";

declare const BUNDLE_RUNTIME_ACTIVATION_AUTHORITY_BRAND: unique symbol;

/** Project-owned diagnostic for a forged, mismatched, or already consumed activation authority. */
export const INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE =
  "run.desen.control-plane/INVALID_RUNTIME_ACTIVATION_AUTHORITY" as const;

/** Project-owned diagnostic for a durable Bundle that no longer closes to the staged candidate. */
export const RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE =
  "run.desen.control-plane/RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED" as const;

/** Project-owned diagnostic for an unexpected trusted activation-path failure. */
export const RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE =
  "run.desen.control-plane/RUNTIME_ACTIVATION_INTERNAL_FAILURE" as const;

/** Stable failure classifications exposed while opening or operating durable activation state. */
export type RuntimeActivationErrorCode =
  | "ACTIVATION_BUSY"
  | "ACTIVATION_CLOSED"
  | "ACTIVATION_CORRUPT"
  | "INVALID_ROOT_DIRECTORY"
  | "STORAGE_IO_FAILURE"
  | "UNSAFE_STORAGE_PATH";

const RUNTIME_ACTIVATION_ERROR_MESSAGES: Readonly<Record<RuntimeActivationErrorCode, string>> =
  Object.freeze({
    ACTIVATION_BUSY: "The durable runtime activation record is busy.",
    ACTIVATION_CLOSED: "The durable runtime activation service is closed.",
    ACTIVATION_CORRUPT: "The durable runtime activation record is inconsistent.",
    INVALID_ROOT_DIRECTORY: "The runtime activation root directory is invalid.",
    STORAGE_IO_FAILURE: "The runtime activation service could not complete the storage operation.",
    UNSAFE_STORAGE_PATH: "The runtime activation service encountered an unsafe storage entry.",
  });

/** Redacted operational failure raised by the durable runtime activation boundary. */
export class RuntimeActivationError extends Error {
  /** Stable reason for the failed operation. */
  readonly code: RuntimeActivationErrorCode;

  /** Creates one fixed-message failure without retaining a path, SQL statement, or technical cause. */
  constructor(code: RuntimeActivationErrorCode) {
    super(RUNTIME_ACTIVATION_ERROR_MESSAGES[code]);
    this.name = "RuntimeActivationError";
    this.code = code;
  }
}

/** One complete durable active/previous-good compare-and-set record. */
export interface RuntimeActivationRecord {
  /** Exact Bundle revision visible to new runtime materialization. */
  readonly activeRevision: string;
  /** Prior distinct active revision retained as last known good, or `null` on the first commit. */
  readonly previousGoodRevision: string | null;
  /** Nonnegative safe-integer generation assigned by the durable transaction. */
  readonly generation: number;
}

/**
 * Opaque proof that one exact T04/T06 candidate join committed as a complete durable record.
 *
 * @remarks The visible fields are immutable audit metadata. The authority carries no Bundle,
 * Catalog, artifact bytes, loader, callback, channel mutation, rollback, recovery, adapter, or
 * host-effect operation. Package-private state retains the exact staged runtime indexes for later
 * host composition. Restart recovery is deliberately owned by M07-T08.
 */
export interface BundleRuntimeActivationAuthority extends RuntimeActivationRecord {
  /** Stable implementation profile for the M07-T07 transactional activation boundary. */
  readonly profile: "desen.runtime-activation";
  /** Version of the stable implementation profile. */
  readonly profileVersion: 1;
  /** Exact protocol version inherited from the joined T03 authority. */
  readonly protocolVersion: "0.1.0";
  /** Exact document identifier retained by the committed staged candidate. */
  readonly documentId: string;
  /** Exact entry surface retained by the committed staged candidate. */
  readonly entrySurfaceId: string;
  readonly [BUNDLE_RUNTIME_ACTIVATION_AUTHORITY_BRAND]: true;
}

/** Stable boundary that terminally rejected one activation attempt before a durable commit. */
export type BundleRuntimeActivationStage =
  "authority-join" | "candidate-lifetime" | "bundle-reclosure" | "internal";

/** Stable immutable diagnostic emitted by M07-T07 runtime activation. */
export type BundleRuntimeActivationDiagnostic = Readonly<DesenDiagnostic<string>>;

/** Controlled result of one exact generation-guarded activation attempt. */
export type BundleRuntimeActivationResult =
  | Readonly<{
      /** The complete active/previous-good record committed durably. */
      readonly status: "activated";
      /** Exact in-process authority corresponding to the committed staged indexes. */
      readonly authority: BundleRuntimeActivationAuthority;
    }>
  | Readonly<{
      /** The expected generation did not identify the complete current record. */
      readonly status: "precondition-failed";
      /** Detached current durable record, or `null` when no activation record exists. */
      readonly current: RuntimeActivationRecord | null;
    }>
  | Readonly<{
      /** The current generation cannot be incremented without losing integer identity. */
      readonly status: "generation-exhausted";
      /** Detached unchanged current durable record. */
      readonly current: RuntimeActivationRecord;
    }>
  | Readonly<{
      /** Activation stopped before commit and left durable state unchanged. */
      readonly status: "rejected";
      /** Exact causal boundary that rejected the consumed attempt. */
      readonly stage: BundleRuntimeActivationStage;
      /** Stable immutable diagnostics without private runtime or storage data. */
      readonly diagnostics: readonly BundleRuntimeActivationDiagnostic[];
    }>
  | Readonly<{
      /** Durable state cannot be authenticated, so callers must use the later recovery boundary. */
      readonly status: "recovery-required";
    }>;

/** Callback-free observation of one open transactional activation service. */
export type BundleRuntimeActivationState =
  | Readonly<{
      /** No durable activation has committed. */
      readonly status: "empty";
    }>
  | Readonly<{
      /** The record belongs to a certain successful commit in this exact process lifetime. */
      readonly status: "active";
      /** Exact authenticated in-process activation authority. */
      readonly authority: BundleRuntimeActivationAuthority;
    }>
  | Readonly<{
      /** Durable state exists without a corresponding authenticated in-process staging lifetime. */
      readonly status: "recovery-required";
      /** Detached durable record, or `null` when a commit outcome is currently indeterminate. */
      readonly record: RuntimeActivationRecord | null;
    }>;

/** Open host-owned transactional activation service over one local DESEN state root. */
export interface BundleRuntimeActivation {
  /**
   * Reads callback-free activation state without authenticating a record recovered from disk.
   *
   * @remarks A record found after open, changed by another process, or missing after this
   * controller published a current authority is returned only as `recovery-required`. M07-T08 owns
   * validation and restoration of such durable state.
   */
  readonly readState: (this: void) => BundleRuntimeActivationState;
  /**
   * Consumes one exact joined T04/T06 candidate and commits it only at `expectedGeneration`.
   *
   * @remarks `null` means that no durable record is expected. The first successful activation is
   * generation zero. A valid joined staging authority is consumed synchronously before the first
   * asynchronous Bundle-store read and cannot be retried, even after rejection or CAS loss. The
   * controller also binds the attempt to its complete authenticated current record so deletion or
   * same-generation external replacement cannot be mistaken for a fresh or matching state.
   */
  readonly activate: (
    this: void,
    referenceAuthority: BundleReferencePreflightAuthority,
    stagingAuthority: BundleRuntimeStagingAuthority,
    expectedGeneration: number | null,
  ) => Promise<BundleRuntimeActivationResult>;
  /** Idempotently closes the owned activation database and revokes future operations. */
  readonly close: (this: void) => void;
}

/** Trusted host configuration for opening one durable runtime activation service. */
export interface OpenBundleRuntimeActivationOptions {
  /**
   * Pre-existing absolute application-owned directory containing the immutable Bundle store.
   *
   * @remarks The separate `runtime-activation.sqlite3` record is created beneath this canonical
   * root. The root and database leaf must not be symbolic links.
   */
  readonly rootDirectory: string;
}
