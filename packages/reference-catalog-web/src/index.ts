/**
 * Accessible real Web-React components and exact capability manifests shared by Desen App and the reference host.
 *
 * @packageDocumentation
 */

export {
  createWebReactPackageDigest,
  encodeWebReactPackageDigestPreimage,
  verifyWebReactPackageDigest,
  WEB_REACT_PACKAGE_DIGEST_PLACEHOLDER,
  WEB_REACT_PACKAGE_DIGEST_PROFILE,
} from "./package-digest-profile.js";

export type {
  WebReactPackageArtifactInput,
  WebReactPackageDigestCalculationInput,
  WebReactPackageDigest,
  WebReactPackageDigestEntry,
  WebReactPackageDigestVerificationInput,
} from "./package-digest-profile.js";
