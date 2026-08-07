import { canonicalizeJson, createJsonPointer } from "@desen/protocol";

import { BundleStoreError } from "./bundle-store-contract.js";
import { readBundlePackagePreflightAuthority } from "./package-preflight-internal.js";
import {
  preflightBundleReferencesInternal,
  readBundleReferencePreflightAuthority,
} from "./reference-preflight-internal.js";
import {
  INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE,
  RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE,
  RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE,
  RuntimeActivationError,
} from "./runtime-activation-contract.js";
import {
  consumeBundleRuntimeStagingAuthority,
  readBundleRuntimeStagingAuthority,
  stageBundleRuntimeInternal,
} from "./runtime-staging-internal.js";
import { verifyBundleStoreEntry } from "./bundle-verification.js";

import type { BundleStore, BundleStoreErrorCode } from "./bundle-store-contract.js";
import type { BundleIntegrityAuthority } from "./bundle-verification-contract.js";
import type { BundlePackagePreflightAuthority } from "./package-preflight-contract.js";
import type { BundlePackagePreflightAuthorityRecord } from "./package-preflight-internal.js";
import type { BundleReferencePreflightAuthorityRecord } from "./reference-preflight-internal.js";
import type {
  BundleRuntimeActivationDiagnostic,
  BundleRuntimeRecoveryResult,
  BundleRuntimeRecoveryRole,
  RuntimeActivationRecord,
} from "./runtime-activation-contract.js";
import type { BundleRuntimeStagingAuthorityRecord } from "./runtime-staging-internal.js";
import type { BundleRuntimeStagingAuthority } from "./runtime-staging-contract.js";

/** One independently reconstructed active or previous-good runtime lineage. @internal */
export interface BundleRuntimeRecoveryLineageRecord {
  readonly referenceRecord: BundleReferencePreflightAuthorityRecord;
  readonly stagingRecord: BundleRuntimeStagingAuthorityRecord;
  readonly reclosedIntegrityAuthority: BundleIntegrityAuthority;
}

/** Complete synchronous recovery preparation consumed before Bundle-store I/O. @internal */
export interface CapturedBundleRuntimeRecovery {
  readonly activationRecord: RuntimeActivationRecord;
  readonly active: Omit<BundleRuntimeRecoveryLineageRecord, "reclosedIntegrityAuthority">;
  readonly previousGood: Omit<
    BundleRuntimeRecoveryLineageRecord,
    "reclosedIntegrityAuthority"
  > | null;
}

/** Complete reconstruction after both required Bundle entries close independently. @internal */
export interface ReclosedBundleRuntimeRecovery {
  readonly activationRecord: RuntimeActivationRecord;
  readonly active: BundleRuntimeRecoveryLineageRecord;
  readonly previousGood: BundleRuntimeRecoveryLineageRecord | null;
}

type RecoveryRejection = Extract<BundleRuntimeRecoveryResult, { readonly status: "rejected" }>;
type PreparedLineage = Omit<BundleRuntimeRecoveryLineageRecord, "reclosedIntegrityAuthority">;
interface UnconsumedPreparedLineage extends PreparedLineage {
  readonly stagingAuthority: BundleRuntimeStagingAuthority;
}

const ROOT_POINTER = createJsonPointer();

function diagnostic(code: string, message: string): BundleRuntimeActivationDiagnostic {
  return Object.freeze({ code, message, pointer: ROOT_POINTER });
}

function rejection(
  role: BundleRuntimeRecoveryRole,
  stage: RecoveryRejection["stage"],
  diagnostics: readonly BundleRuntimeActivationDiagnostic[],
): RecoveryRejection {
  return Object.freeze({
    status: "rejected",
    role,
    stage,
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function packageAuthorityRejection(role: BundleRuntimeRecoveryRole): RecoveryRejection {
  return rejection(role, "package-authority", [
    diagnostic(
      INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE,
      "Runtime recovery requires the exact package authority for the durable revision role.",
    ),
  ]);
}

function internalRejection(role: BundleRuntimeRecoveryRole): RecoveryRejection {
  return rejection(role, "internal", [
    diagnostic(
      RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE,
      "Runtime recovery could not complete its trusted implementation path.",
    ),
  ]);
}

function bundleReclosureRejection(role: BundleRuntimeRecoveryRole): RecoveryRejection {
  return rejection(role, "bundle-reclosure", [
    diagnostic(
      RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE,
      "The durable Bundle no longer matches the exact recovered runtime lineage.",
    ),
  ]);
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

function revisionOf(record: BundlePackagePreflightAuthorityRecord): string {
  return record.integrityRecord.revision;
}

interface CapturedPackageRole {
  readonly role: BundleRuntimeRecoveryRole;
  readonly authority: BundlePackagePreflightAuthority;
  readonly record: BundlePackagePreflightAuthorityRecord;
}

function capturePackageRole(
  role: BundleRuntimeRecoveryRole,
  authority: BundlePackagePreflightAuthority,
  revision: string,
): CapturedPackageRole | RecoveryRejection {
  const record = readBundlePackagePreflightAuthority(authority);
  return record === undefined || revisionOf(record) !== revision
    ? packageAuthorityRejection(role)
    : Object.freeze({ role, authority, record });
}

export function isBundleRuntimeRecoveryRejection(
  value:
    | CapturedPackageRole
    | PreparedLineage
    | UnconsumedPreparedLineage
    | BundleRuntimeRecoveryLineageRecord
    | CapturedBundleRuntimeRecovery
    | ReclosedBundleRuntimeRecovery
    | RecoveryRejection,
): value is RecoveryRejection {
  return Object.hasOwn(value, "status");
}

function prepareLineage(role: CapturedPackageRole): UnconsumedPreparedLineage | RecoveryRejection {
  const reference = preflightBundleReferencesInternal(role.authority);
  if (reference.status !== "preflighted") {
    return rejection(role.role, "reference-preflight", reference.diagnostics);
  }
  const referenceRecord = readBundleReferencePreflightAuthority(reference.authority);
  if (
    referenceRecord === undefined ||
    referenceRecord.packageAuthority !== role.authority ||
    referenceRecord.packageRecord !== role.record
  ) {
    return internalRejection(role.role);
  }

  const staging = stageBundleRuntimeInternal(role.authority);
  if (staging.status !== "staged") {
    return rejection(role.role, "runtime-staging", staging.diagnostics);
  }
  const stagingRecord = readBundleRuntimeStagingAuthority(staging.authority);
  if (
    stagingRecord === undefined ||
    stagingRecord.packageAuthority !== role.authority ||
    stagingRecord.packageRecord !== role.record
  ) {
    return internalRejection(role.role);
  }
  return Object.freeze({ referenceRecord, stagingAuthority: staging.authority, stagingRecord });
}

function consumePreparedLineage(
  role: BundleRuntimeRecoveryRole,
  prepared: UnconsumedPreparedLineage,
): PreparedLineage | RecoveryRejection {
  const consumed = consumeBundleRuntimeStagingAuthority(prepared.stagingAuthority);
  if (consumed === undefined || consumed !== prepared.stagingRecord) {
    return internalRejection(role);
  }
  return Object.freeze({ referenceRecord: prepared.referenceRecord, stagingRecord: consumed });
}

/**
 * Captures both package roles and rebuilds T04/T06 without crossing an asynchronous boundary.
 *
 * @internal The function first authenticates every caller-supplied role. It therefore performs no
 * Bundle-store I/O and consumes no internal staging lifetime when either package identity is
 * forged, swapped, omitted, unexpectedly supplied, or revision-mismatched.
 */
export function captureBundleRuntimeRecovery(
  activationRecord: RuntimeActivationRecord,
  activePackageAuthority: BundlePackagePreflightAuthority,
  previousGoodPackageAuthority: BundlePackagePreflightAuthority | null,
): CapturedBundleRuntimeRecovery | RecoveryRejection {
  const active = capturePackageRole(
    "active",
    activePackageAuthority,
    activationRecord.activeRevision,
  );
  if (isBundleRuntimeRecoveryRejection(active)) return active;

  let previousGood: CapturedPackageRole | null = null;
  if (activationRecord.previousGoodRevision === null) {
    if (previousGoodPackageAuthority !== null) return packageAuthorityRejection("previous-good");
  } else {
    if (previousGoodPackageAuthority === null) return packageAuthorityRejection("previous-good");
    const captured = capturePackageRole(
      "previous-good",
      previousGoodPackageAuthority,
      activationRecord.previousGoodRevision,
    );
    if (isBundleRuntimeRecoveryRejection(captured)) return captured;
    previousGood = captured;
  }

  const unconsumedActive = prepareLineage(active);
  if (isBundleRuntimeRecoveryRejection(unconsumedActive)) return unconsumedActive;
  const unconsumedPrevious = previousGood === null ? null : prepareLineage(previousGood);
  if (unconsumedPrevious !== null && isBundleRuntimeRecoveryRejection(unconsumedPrevious)) {
    return unconsumedPrevious;
  }

  // Both roles now agree on their exact T03/T04/T06 lineage. Consume every internal candidate in
  // this same synchronous turn so no abandoned staging authority can later become restart proof.
  const preparedActive = consumePreparedLineage("active", unconsumedActive);
  if (isBundleRuntimeRecoveryRejection(preparedActive)) return preparedActive;
  const preparedPrevious =
    unconsumedPrevious === null
      ? null
      : consumePreparedLineage("previous-good", unconsumedPrevious);
  if (preparedPrevious !== null && isBundleRuntimeRecoveryRejection(preparedPrevious)) {
    return preparedPrevious;
  }
  return Object.freeze({
    activationRecord,
    active: preparedActive,
    previousGood: preparedPrevious,
  });
}

function sameReclosedBundle(
  prepared: PreparedLineage,
  authority: BundleIntegrityAuthority,
): boolean {
  const expected = prepared.stagingRecord.packageRecord.integrityRecord;
  try {
    const canonical = canonicalizeJson(authority.bundle);
    return (
      authority.protocolVersion === expected.protocolVersion &&
      authority.revision === expected.revision &&
      authority.sourceDigest === expected.sourceDigest &&
      canonical === canonicalizeJson(expected.bundle) &&
      canonical === canonicalizeJson(prepared.referenceRecord.bundle) &&
      canonical === canonicalizeJson(prepared.stagingRecord.bundle)
    );
  } catch {
    return false;
  }
}

async function recloseLineage(
  bundleStore: BundleStore,
  role: BundleRuntimeRecoveryRole,
  prepared: PreparedLineage,
): Promise<BundleRuntimeRecoveryLineageRecord | RecoveryRejection> {
  const revision = prepared.stagingRecord.packageRecord.integrityRecord.revision;
  let durableEntry;
  try {
    const read = await bundleStore.getBundle(revision);
    if (read.status !== "found" || read.entry.revision !== revision) {
      return bundleReclosureRejection(role);
    }
    durableEntry = read.entry;
  } catch (error) {
    const storeCode = readBundleStoreErrorCode(error);
    if (storeCode === undefined) return internalRejection(role);
    const operational = mapBundleStoreOperationalError(storeCode);
    if (operational !== undefined) throw operational;
    return bundleReclosureRejection(role);
  }

  const reclosed = verifyBundleStoreEntry(durableEntry, Object.freeze({ status: "not-available" }));
  if (reclosed.status !== "verified" || !sameReclosedBundle(prepared, reclosed.authority)) {
    return bundleReclosureRejection(role);
  }
  return Object.freeze({ ...prepared, reclosedIntegrityAuthority: reclosed.authority });
}

/** Recloses every required Bundle after all T04/T06 lifetimes have been consumed. @internal */
export async function recloseBundleRuntimeRecovery(
  bundleStore: BundleStore,
  captured: CapturedBundleRuntimeRecovery,
  assertContinue: () => void,
): Promise<ReclosedBundleRuntimeRecovery | RecoveryRejection> {
  const active = await recloseLineage(bundleStore, "active", captured.active);
  if (isBundleRuntimeRecoveryRejection(active)) return active;
  // Closing the owning controller while the active read is pending must not start new I/O for the
  // previous-good role. The callback is host-owned and invokes no caller code.
  assertContinue();
  const previousGood =
    captured.previousGood === null
      ? null
      : await recloseLineage(bundleStore, "previous-good", captured.previousGood);
  if (previousGood !== null && isBundleRuntimeRecoveryRejection(previousGood)) {
    return previousGood;
  }
  return Object.freeze({
    activationRecord: captured.activationRecord,
    active,
    previousGood,
  });
}
