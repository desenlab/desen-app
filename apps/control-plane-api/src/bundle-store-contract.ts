/* eslint-disable @typescript-eslint/no-invalid-void-type -- Store callbacks are deliberately
 * receiver-independent at the host-owned persistence boundary. */

/**
 * Stable error classifications exposed by the local immutable Bundle store.
 *
 * @remarks Messages are deliberately fixed and never include a filesystem path, operating-system
 * error, or caller-owned value. A commit may already be durable when
 * `COMMIT_OUTCOME_INDETERMINATE` is reported; retrying the exact entry is the safe resolution.
 */
export type BundleStoreErrorCode =
  | "COMMIT_OUTCOME_INDETERMINATE"
  | "INVALID_ENTRY"
  | "INVALID_REVISION"
  | "INVALID_ROOT_DIRECTORY"
  | "STORAGE_IO_FAILURE"
  | "UNSAFE_STORAGE_PATH";

const BUNDLE_STORE_ERROR_MESSAGES: Readonly<Record<BundleStoreErrorCode, string>> = Object.freeze({
  COMMIT_OUTCOME_INDETERMINATE:
    "The immutable Bundle may have committed; retry the exact revision and bytes.",
  INVALID_ENTRY: "The immutable Bundle entry is malformed.",
  INVALID_REVISION: "The Bundle revision is not an exact lowercase SHA-256 digest.",
  INVALID_ROOT_DIRECTORY: "The Bundle store root directory is invalid.",
  STORAGE_IO_FAILURE: "The immutable Bundle store could not complete the filesystem operation.",
  UNSAFE_STORAGE_PATH: "The immutable Bundle store encountered an unsafe filesystem entry.",
});

/**
 * Redacted failure raised by the local immutable Bundle store.
 *
 * @remarks Callers may branch only on `code`. The error intentionally carries no raw filesystem
 * cause because local paths and platform error details are not part of the control-plane API.
 */
export class BundleStoreError extends Error {
  /** Stable reason for the rejected operation. */
  readonly code: BundleStoreErrorCode;

  /** Creates one fixed-message Bundle-store failure. */
  constructor(code: BundleStoreErrorCode) {
    super(BUNDLE_STORE_ERROR_MESSAGES[code]);
    this.name = "BundleStoreError";
    this.code = code;
  }
}

/**
 * Exact byte snapshot stored under one already verified, revision-closed Bundle identity.
 *
 * @remarks M07-T01 treats validation as a trusted caller precondition. M07-T02 will independently
 * parse and verify protocol version, revision, available source digest, and Bundle size before
 * activation. The store never canonicalizes, reformats, or adds publication metadata.
 */
export interface BundleStoreEntry {
  /** Exact lowercase `sha256:<64 hex>` Bundle revision used only as a fixed storage key. */
  readonly revision: string;
  /** Exact complete Bundle bytes; the store snapshots this view before its first asynchronous step. */
  readonly bytes: Readonly<Uint8Array>;
}

/** Controlled result of reading one immutable Bundle entry by exact revision. */
export type BundleStoreReadResult =
  | Readonly<{ readonly status: "found"; readonly entry: BundleStoreEntry }>
  | Readonly<{ readonly status: "missing" }>;

/**
 * Controlled result of attempting one immutable Bundle write.
 *
 * @remarks `unchanged` means the revision already owns byte-identical content. `conflict` means
 * different exact bytes already own the revision and remain untouched.
 */
export type BundleStorePutResult =
  | Readonly<{ readonly status: "stored" }>
  | Readonly<{ readonly status: "unchanged" }>
  | Readonly<{ readonly status: "conflict" }>;

/** Local persistent content-addressed repository for immutable Bundle bytes. */
export interface BundleStore {
  /** Reads one exact revision without exposing a filesystem path, descriptor, or shared byte view. */
  readonly getBundle: (this: void, revision: string) => Promise<BundleStoreReadResult>;
  /** Publishes one exact entry once, or reports byte identity/conflict without replacing it. */
  readonly putBundle: (this: void, entry: BundleStoreEntry) => Promise<BundleStorePutResult>;
}

/** Trusted host configuration for opening the local filesystem Bundle store. */
export interface OpenBundleStoreOptions {
  /**
   * Pre-existing absolute, application-owned local directory reserved for this store.
   *
   * @remarks The store does not create the root authority. Its leaf must not be a symbolic link.
   * The current POSIX profile assumes the application exclusively controls the directory; hostile
   * privileged mutation between path-based Node.js system calls is outside M07-T01.
   */
  readonly rootDirectory: string;
}
