/**
 * Local control-plane infrastructure for immutable DESEN Bundle storage and integrity verification.
 *
 * @packageDocumentation
 */

export { BundleStoreError } from "./bundle-store-contract.js";
export {
  BUNDLE_INTEGRITY_LIMITS,
  SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
} from "./bundle-verification-contract.js";
export { verifyBundleStoreEntry } from "./bundle-verification.js";
export { openBundleStore } from "./bundle-store.js";

export type {
  BundleIntegrityAuthority,
  BundleIntegrityDiagnostic,
  BundleIntegrityDiagnosticCode,
  BundleIntegrityLimits,
  BundleIntegrityVerificationResult,
  BundleIntegrityVerificationStage,
  BundleSourceMaterial,
} from "./bundle-verification-contract.js";
export type {
  BundleStore,
  BundleStoreEntry,
  BundleStoreErrorCode,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
