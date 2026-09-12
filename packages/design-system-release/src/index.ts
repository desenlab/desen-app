/**
 * Platform-neutral immutable design-system release identity and store contracts for DESEN.
 *
 * @packageDocumentation
 */

export {
  DESIGN_SYSTEM_RELEASE_KIND,
  DESIGN_SYSTEM_RELEASE_LIMITS,
  DESIGN_SYSTEM_RELEASE_REFERENCE_KIND,
  DESIGN_SYSTEM_RELEASE_SCHEMA_VERSION,
  createDesignSystemRelease,
  createDesignSystemReleaseStore,
  createHostProfileReleaseReference,
  readDesignSystemRelease,
  verifyDesignSystemRelease,
  DesignSystemReleaseError,
} from "./release.js";

export type {
  DesignSystemReleaseAssetInput,
  DesignSystemReleaseAssetSnapshot,
  DesignSystemReleaseDependency,
  DesignSystemReleaseErrorCode,
  DesignSystemReleaseInput,
  DesignSystemReleaseRecipeInput,
  DesignSystemReleaseRecipeSnapshot,
  DesignSystemReleaseReference,
  DesignSystemReleaseResult,
  DesignSystemReleaseSnapshot,
  DesignSystemReleaseStore,
  DesignSystemReleaseStoreEntry,
  DesignSystemReleaseStoreError,
  DesignSystemReleaseStorePutResult,
  DesignSystemReleaseStoreReadResult,
  DesignSystemReleaseTokenSourceInput,
  DesignSystemReleaseTokenSourceSnapshot,
  DesignSystemReleaseVerification,
  HostProfileReleaseReferenceInput,
} from "./release.js";
