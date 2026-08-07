/**
 * Local DESEN control-plane infrastructure for editable Source storage, immutable Bundle
 * distribution, mutable channel discovery, integrity verification, exact installed-package
 * preflight, bounded surface-reference preflight, and isolated runtime-index staging.
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
export {
  BUNDLE_RUNTIME_STAGING_LIMITS,
  INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE,
  RUNTIME_STAGING_INTERNAL_FAILURE_CODE,
  RUNTIME_STAGING_LIMIT_EXCEEDED_CODE,
  RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE,
} from "./runtime-staging-contract.js";
export { stageBundleRuntime } from "./runtime-staging.js";
export {
  INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE,
  RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE,
  RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE,
  RuntimeActivationError,
} from "./runtime-activation-contract.js";
export { openBundleRuntimeActivation } from "./runtime-activation.js";
export { verifyBundleStoreEntry } from "./bundle-verification.js";
export { openBundleStore } from "./bundle-store.js";
export {
  LOCAL_CONTROL_PLANE_ERROR_MESSAGES,
  LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN,
  LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE,
  LOCAL_CONTROL_PLANE_LIMITS,
  LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS,
  LocalControlPlaneError,
} from "./local-control-plane-contract.js";
export { openLocalControlPlane } from "./local-control-plane.js";

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
  BundleRuntimeStagingAuthority,
  BundleRuntimeStagingDiagnostic,
  BundleRuntimeStagingLimits,
  BundleRuntimeStagingResult,
  BundleRuntimeStagingStage,
  StagedRuntimePackageSummary,
  StagedRuntimeSurfaceSummary,
} from "./runtime-staging-contract.js";
export type {
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationDiagnostic,
  BundleRuntimeActivationResult,
  BundleRuntimeActivationStage,
  BundleRuntimeActivationState,
  OpenBundleRuntimeActivationOptions,
  RuntimeActivationErrorCode,
  RuntimeActivationRecord,
} from "./runtime-activation-contract.js";
export type {
  BundleStore,
  BundleStoreEntry,
  BundleStoreErrorCode,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
export type {
  LocalControlPlane,
  LocalControlPlaneBundlePutResult,
  LocalControlPlaneBundleReadResult,
  LocalControlPlaneBundleRecord,
  LocalControlPlaneChannelPutBody,
  LocalControlPlaneChannelPutResult,
  LocalControlPlaneChannelReadResult,
  LocalControlPlaneChannelRecord,
  LocalControlPlaneErrorCode,
  LocalControlPlaneErrorDetail,
  LocalControlPlaneErrorEnvelope,
  LocalControlPlaneHttpStatusCode,
  LocalControlPlaneInjectMethod,
  LocalControlPlaneInjectRequest,
  LocalControlPlaneInjectResponse,
  LocalControlPlaneLimits,
  LocalControlPlaneListenResult,
  LocalControlPlaneSourcePutResult,
  LocalControlPlaneSourceReadResult,
  LocalControlPlaneSourceRecord,
  OpenLocalControlPlaneOptions,
} from "./local-control-plane-contract.js";
