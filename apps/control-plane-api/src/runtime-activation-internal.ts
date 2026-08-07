import { canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { BundleStoreError } from "./bundle-store-contract.js";
import { verifyBundleStoreEntry } from "./bundle-verification.js";
import { readBundleReferencePreflightAuthority } from "./reference-preflight-internal.js";
import {
  INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE,
  RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE,
  RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE,
  RuntimeActivationError,
} from "./runtime-activation-contract.js";
import {
  consumeBundleRuntimeStagingAuthority,
  readBundleRuntimeStagingAuthority,
} from "./runtime-staging-internal.js";

import type { BundleStore } from "./bundle-store-contract.js";
import type { BundleStoreErrorCode } from "./bundle-store-contract.js";
import type { BundleIntegrityAuthority } from "./bundle-verification-contract.js";
import type { BundleReferencePreflightAuthority } from "./reference-preflight-contract.js";
import type { BundleReferencePreflightAuthorityRecord } from "./reference-preflight-internal.js";
import type {
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationDiagnostic,
  BundleRuntimeActivationResult,
  BundleRuntimeActivationStage,
  BundleRuntimeActivationState,
  RuntimeActivationRecord,
} from "./runtime-activation-contract.js";
import { readRuntimeActivationStorageErrorCode } from "./runtime-activation-repository-internal.js";
import type { RuntimeActivationRepository } from "./runtime-activation-repository-internal.js";
import type { BundleRuntimeStagingAuthority } from "./runtime-staging-contract.js";
import type { BundleRuntimeStagingAuthorityRecord } from "./runtime-staging-internal.js";

/** Package-private dependencies for one open transactional activation service. @internal */
export interface BundleRuntimeActivationInternalOptions {
  /** Immutable Bundle store opened from the same application-owned root as activation metadata. */
  readonly bundleStore: BundleStore;
  /** Separate singleton durable activation repository. */
  readonly repository: RuntimeActivationRepository;
}

/** Complete private authority retained after one certain durable commit. @internal */
export interface BundleRuntimeActivationAuthorityRecord {
  readonly activationRecord: RuntimeActivationRecord;
  readonly referenceRecord: BundleReferencePreflightAuthorityRecord;
  readonly stagingRecord: BundleRuntimeStagingAuthorityRecord;
  readonly reclosedIntegrityAuthority: BundleIntegrityAuthority;
}

interface CapturedActivationAttempt {
  readonly expectedGeneration: number | null;
  readonly referenceRecord: BundleReferencePreflightAuthorityRecord;
  readonly stagingRecord: BundleRuntimeStagingAuthorityRecord;
}

const ROOT_POINTER = createJsonPointer();
const AUTHORITIES = new WeakMap<
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationAuthorityRecord
>();

function revokeAuthority(authority: BundleRuntimeActivationAuthority | undefined): void {
  if (authority !== undefined) AUTHORITIES.delete(authority);
}

function diagnostic(code: string, message: string): BundleRuntimeActivationDiagnostic {
  return Object.freeze({ code, message, pointer: ROOT_POINTER });
}

function rejection(
  stage: BundleRuntimeActivationStage,
  code: string,
  message: string,
): BundleRuntimeActivationResult {
  return Object.freeze({
    status: "rejected",
    stage,
    diagnostics: Object.freeze([diagnostic(code, message)]),
  });
}

function invalidAuthorityRejection(
  stage: Extract<BundleRuntimeActivationStage, "authority-join" | "candidate-lifetime">,
): BundleRuntimeActivationResult {
  return rejection(
    stage,
    INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE,
    "Runtime activation requires one exact unconsumed T04/T06 authority join.",
  );
}

function internalRejection(): BundleRuntimeActivationResult {
  return rejection(
    "internal",
    RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE,
    "Runtime activation could not complete its trusted implementation path.",
  );
}

function bundleReclosureRejection(): BundleRuntimeActivationResult {
  return rejection(
    "bundle-reclosure",
    RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE,
    "The durable Bundle no longer matches the exact staged runtime candidate.",
  );
}

function validExpectedGeneration(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
}

function isCapturedActivationAttempt(
  value: CapturedActivationAttempt | BundleRuntimeActivationResult,
): value is CapturedActivationAttempt {
  // Rejections are ordinary frozen records, so inherited fields must never select the success path.
  return Object.hasOwn(value, "expectedGeneration");
}

function captureAttempt(
  referenceAuthority: BundleReferencePreflightAuthority,
  stagingAuthority: BundleRuntimeStagingAuthority,
  expectedGeneration: number | null,
): CapturedActivationAttempt | BundleRuntimeActivationResult {
  if (!validExpectedGeneration(expectedGeneration))
    return invalidAuthorityRejection("authority-join");
  const referenceRecord = readBundleReferencePreflightAuthority(referenceAuthority);
  const observedStagingRecord = readBundleRuntimeStagingAuthority(stagingAuthority);
  if (referenceRecord === undefined || observedStagingRecord === undefined) {
    return invalidAuthorityRejection("authority-join");
  }
  if (
    referenceRecord.packageAuthority !== observedStagingRecord.packageAuthority ||
    referenceRecord.packageRecord !== observedStagingRecord.packageRecord
  ) {
    return invalidAuthorityRejection("authority-join");
  }
  const stagingRecord = consumeBundleRuntimeStagingAuthority(stagingAuthority);
  if (stagingRecord === undefined || stagingRecord !== observedStagingRecord) {
    return invalidAuthorityRejection("candidate-lifetime");
  }
  return Object.freeze({ expectedGeneration, referenceRecord, stagingRecord });
}

function sameReclosedBundle(
  attempt: CapturedActivationAttempt,
  authority: BundleIntegrityAuthority,
): boolean {
  const expected = attempt.stagingRecord.packageRecord.integrityRecord;
  try {
    return (
      authority.protocolVersion === expected.protocolVersion &&
      authority.revision === expected.revision &&
      authority.sourceDigest === expected.sourceDigest &&
      canonicalizeJson(authority.bundle) === canonicalizeJson(expected.bundle) &&
      canonicalizeJson(authority.bundle) === canonicalizeJson(attempt.referenceRecord.bundle) &&
      canonicalizeJson(authority.bundle) === canonicalizeJson(attempt.stagingRecord.bundle)
    );
  } catch {
    return false;
  }
}

function publicRecord(record: RuntimeActivationRecord): RuntimeActivationRecord {
  return Object.freeze({
    activeRevision: record.activeRevision,
    previousGoodRevision: record.previousGoodRevision,
    generation: record.generation,
  });
}

function createAuthority(
  attempt: CapturedActivationAttempt,
  record: RuntimeActivationRecord,
  reclosedIntegrityAuthority: BundleIntegrityAuthority,
): BundleRuntimeActivationResult {
  const authority = Object.freeze({
    profile: "desen.runtime-activation",
    profileVersion: 1,
    protocolVersion: "0.1.0",
    documentId: attempt.stagingRecord.bundle.id,
    entrySurfaceId: attempt.stagingRecord.bundle.entry,
    ...publicRecord(record),
  }) as BundleRuntimeActivationAuthority;
  AUTHORITIES.set(
    authority,
    Object.freeze({
      activationRecord: publicRecord(record),
      referenceRecord: attempt.referenceRecord,
      stagingRecord: attempt.stagingRecord,
      reclosedIntegrityAuthority,
    }),
  );
  return Object.freeze({ status: "activated", authority });
}

function readBundleStoreErrorCode(error: unknown): BundleStoreErrorCode | undefined {
  try {
    if (!(error instanceof BundleStoreError)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(error, "code");
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    switch (descriptor.value) {
      case "COMMIT_OUTCOME_INDETERMINATE":
      case "INVALID_ENTRY":
      case "INVALID_REVISION":
      case "INVALID_ROOT_DIRECTORY":
      case "STORAGE_IO_FAILURE":
      case "UNSAFE_STORAGE_PATH":
        return descriptor.value;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function mapStorageError(error: unknown): RuntimeActivationError | undefined {
  const code = readRuntimeActivationStorageErrorCode(error);
  return code === undefined ? undefined : new RuntimeActivationError(code);
}

function mapBundleStoreOperationalError(
  code: BundleStoreErrorCode,
): RuntimeActivationError | undefined {
  switch (code) {
    case "INVALID_ENTRY":
    case "INVALID_REVISION":
      return undefined;
    case "INVALID_ROOT_DIRECTORY":
      return new RuntimeActivationError("INVALID_ROOT_DIRECTORY");
    case "UNSAFE_STORAGE_PATH":
      return new RuntimeActivationError("UNSAFE_STORAGE_PATH");
    case "COMMIT_OUTCOME_INDETERMINATE":
    case "STORAGE_IO_FAILURE":
      return new RuntimeActivationError("STORAGE_IO_FAILURE");
  }
}

async function activateCaptured(
  options: BundleRuntimeActivationInternalOptions,
  attempt: CapturedActivationAttempt,
  authenticatedCurrent: RuntimeActivationRecord | null,
  canCommit: () => boolean,
  publish: (authority: BundleRuntimeActivationAuthority) => void,
): Promise<BundleRuntimeActivationResult> {
  const revision = attempt.stagingRecord.packageRecord.integrityRecord.revision;
  let durableEntry;
  try {
    const read = await options.bundleStore.getBundle(revision);
    if (read.status !== "found" || read.entry.revision !== revision) {
      return bundleReclosureRejection();
    }
    durableEntry = read.entry;
  } catch (error) {
    const storeCode = readBundleStoreErrorCode(error);
    if (storeCode === undefined) return internalRejection();
    const operational = mapBundleStoreOperationalError(storeCode);
    if (operational !== undefined) throw operational;
    return bundleReclosureRejection();
  }

  const reclosed = verifyBundleStoreEntry(durableEntry, Object.freeze({ status: "not-available" }));
  if (reclosed.status !== "verified" || !sameReclosedBundle(attempt, reclosed.authority)) {
    return bundleReclosureRejection();
  }

  // A callback-free state read may discover drift while Bundle reclosure awaits I/O. Once that
  // happens, this consumed attempt must not revive the controller or publish new authority.
  if (!canCommit()) return Object.freeze({ status: "recovery-required" });

  try {
    const committed = options.repository.commit(
      attempt.expectedGeneration,
      authenticatedCurrent,
      revision,
    );
    switch (committed.status) {
      case "activated": {
        const activated = createAuthority(attempt, committed.record, reclosed.authority);
        if (activated.status !== "activated") return internalRejection();
        publish(activated.authority);
        return activated;
      }
      case "precondition-failed":
        return Object.freeze({
          status: "precondition-failed",
          current: committed.current === null ? null : publicRecord(committed.current),
        });
      case "generation-exhausted":
        return Object.freeze({
          status: "generation-exhausted",
          current: publicRecord(committed.current),
        });
      case "recovery-required":
        return Object.freeze({ status: "recovery-required" });
    }
  } catch (error) {
    const mapped = mapStorageError(error);
    if (mapped !== undefined) throw mapped;
    return internalRejection();
  }
}

/** @internal Authenticates and reads one exact in-process M07-T07 activation authority. */
export function readBundleRuntimeActivationAuthority(
  authority: unknown,
): BundleRuntimeActivationAuthorityRecord | undefined {
  return typeof authority === "object" && authority !== null
    ? AUTHORITIES.get(authority as BundleRuntimeActivationAuthority)
    : undefined;
}

/** Creates one closed transactional activation service over injected durable dependencies. @internal */
export function createBundleRuntimeActivationInternal(
  options: BundleRuntimeActivationInternalOptions,
): BundleRuntimeActivation {
  let closed = false;
  let inFlight = false;
  let currentAuthority: BundleRuntimeActivationAuthority | undefined;
  let recoveryRecord: RuntimeActivationRecord | null | undefined;

  try {
    const initial = options.repository.get();
    if (initial.status === "found") recoveryRecord = publicRecord(initial.record);
  } catch (error) {
    const mapped = mapStorageError(error);
    if (mapped !== undefined) throw mapped;
    throw new RuntimeActivationError("STORAGE_IO_FAILURE");
  }

  const revokeCurrent = (): void => {
    revokeAuthority(currentAuthority);
    currentAuthority = undefined;
  };

  const enterRecovery = (record: RuntimeActivationRecord | null): void => {
    revokeCurrent();
    recoveryRecord = record === null ? null : publicRecord(record);
  };

  const currentMatches = (record: RuntimeActivationRecord | null): boolean =>
    currentAuthority !== undefined &&
    record !== null &&
    currentAuthority.activeRevision === record.activeRevision &&
    currentAuthority.previousGoodRevision === record.previousGoodRevision &&
    currentAuthority.generation === record.generation;

  const readState: BundleRuntimeActivation["readState"] = (): BundleRuntimeActivationState => {
    if (closed) throw new RuntimeActivationError("ACTIVATION_CLOSED");
    if (recoveryRecord !== undefined) {
      return Object.freeze({ status: "recovery-required", record: recoveryRecord });
    }
    try {
      const durable = options.repository.get();
      if (durable.status === "missing") {
        if (currentAuthority !== undefined) {
          enterRecovery(null);
          return Object.freeze({ status: "recovery-required", record: null });
        }
        revokeCurrent();
        return Object.freeze({ status: "empty" });
      }
      if (currentAuthority !== undefined && currentMatches(durable.record)) {
        return Object.freeze({ status: "active", authority: currentAuthority });
      }
      const record = publicRecord(durable.record);
      enterRecovery(durable.record);
      return Object.freeze({
        status: "recovery-required",
        record,
      });
    } catch (error) {
      const mapped = mapStorageError(error);
      if (mapped !== undefined) throw mapped;
      throw new RuntimeActivationError("STORAGE_IO_FAILURE");
    }
  };

  const activate: BundleRuntimeActivation["activate"] = (
    referenceAuthority,
    stagingAuthority,
    expectedGeneration,
  ) => {
    if (closed) return Promise.reject(new RuntimeActivationError("ACTIVATION_CLOSED"));
    if (inFlight) return Promise.reject(new RuntimeActivationError("ACTIVATION_BUSY"));
    if (recoveryRecord !== undefined) {
      return Promise.resolve(Object.freeze({ status: "recovery-required" }));
    }
    inFlight = true;
    const captured = captureAttempt(referenceAuthority, stagingAuthority, expectedGeneration);
    if (!isCapturedActivationAttempt(captured)) {
      inFlight = false;
      return Promise.resolve(captured);
    }
    const authenticatedCurrent =
      currentAuthority === undefined ? null : publicRecord(currentAuthority);
    return activateCaptured(
      options,
      captured,
      authenticatedCurrent,
      () => {
        if (closed) throw new RuntimeActivationError("ACTIVATION_CLOSED");
        return recoveryRecord === undefined;
      },
      (authority) => {
        revokeCurrent();
        currentAuthority = authority;
        recoveryRecord = undefined;
      },
    )
      .then((result) => {
        if (result.status === "recovery-required" && recoveryRecord === undefined) {
          enterRecovery(null);
        } else if (
          (result.status === "precondition-failed" || result.status === "generation-exhausted") &&
          !currentMatches(result.current) &&
          (currentAuthority !== undefined || result.current !== null)
        ) {
          enterRecovery(result.current);
        }
        return result;
      })
      .finally(() => {
        inFlight = false;
      });
  };

  const close: BundleRuntimeActivation["close"] = () => {
    if (closed) return;
    try {
      options.repository.close();
      revokeCurrent();
      closed = true;
    } catch (error) {
      const mapped = mapStorageError(error);
      if (mapped !== undefined) throw mapped;
      throw new RuntimeActivationError("STORAGE_IO_FAILURE");
    }
  };

  return Object.freeze({ readState, activate, close });
}
