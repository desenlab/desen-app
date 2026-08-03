import { preflightBundlePackagesInternal } from "./package-preflight-internal.js";

import type { BundleIntegrityAuthority } from "./bundle-verification-contract.js";
import type {
  BundlePackagePreflightResult,
  InstalledPackageCandidate,
} from "./package-preflight-contract.js";

/**
 * Resolves and independently verifies every exact installed package required by a verified Bundle.
 *
 * @remarks Resolution compares `id`, exact Semantic Version, and target literally before package
 * material is observed. The initial Web–React profile then snapshots the selected Catalog and every
 * artifact byte, reconstructs the versioned v1 package-digest framing, and closes the Bundle
 * requirement digest, Catalog self-digest, and independently calculated digest. The function does
 * not accept caller-observed digests, callbacks, loaders, filesystem locations, package roots,
 * module specifiers, registries, or mutable limits. Portable artifact identity paths remain inert
 * framed package data rather than acquisition or loading authority.
 * It performs no surface-reference preflight, staging, channel mutation, activation, or recovery.
 *
 * @returns A frozen authenticated authority only after the complete package set succeeds, or one
 * frozen redacted rejection carrying no partial Catalog/package authority.
 */
export function preflightBundlePackages(
  authority: BundleIntegrityAuthority,
  installedPackages: readonly InstalledPackageCandidate[],
): BundlePackagePreflightResult {
  return preflightBundlePackagesInternal(authority, installedPackages);
}
