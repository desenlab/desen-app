/**
 * Local control-plane infrastructure for immutable DESEN Bundle storage, integrity verification,
 * exact installed-package preflight, and bounded surface-reference preflight.
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
export {
  BUNDLE_REFERENCE_PREFLIGHT_LIMITS,
  INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE,
  REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE,
} from "./reference-preflight-contract.js";
export { preflightBundleReferences } from "./reference-preflight.js";
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
  BundleReferencePreflightAuthority,
  BundleReferencePreflightDiagnostic,
  BundleReferencePreflightDiagnosticCode,
  BundleReferencePreflightLimits,
  BundleReferencePreflightResult,
  BundleReferencePreflightStage,
  VerifiedBundleSurfaceReferences,
} from "./reference-preflight-contract.js";
export type {
  BundleStore,
  BundleStoreEntry,
  BundleStoreErrorCode,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
