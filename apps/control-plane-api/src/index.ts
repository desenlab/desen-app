/**
 * Local control-plane infrastructure for immutable DESEN Bundle storage, integrity verification,
 * and exact installed-package preflight.
 *
 * @packageDocumentation
 */

export { BundleStoreError } from "./bundle-store-contract.js";
export {
  BUNDLE_INTEGRITY_LIMITS,
  SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE,
} from "./bundle-verification-contract.js";
export {
  BUNDLE_PACKAGE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE,
  INVALID_INSTALLED_PACKAGE_CODE,
  PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE,
  PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
} from "./package-preflight-contract.js";
export { preflightBundlePackages } from "./package-preflight.js";
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
  BundlePackagePreflightAuthority,
  BundlePackagePreflightDiagnostic,
  BundlePackagePreflightDiagnosticCode,
  BundlePackagePreflightLimits,
  BundlePackagePreflightResult,
  BundlePackagePreflightStage,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
  VerifiedInstalledPackage,
} from "./package-preflight-contract.js";
export type {
  BundleStore,
  BundleStoreEntry,
  BundleStoreErrorCode,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
