import { preflightBundleReferencesInternal } from "./reference-preflight-internal.js";

import type { BundlePackagePreflightAuthority } from "./package-preflight-contract.js";
import type { BundleReferencePreflightResult } from "./reference-preflight-contract.js";

/**
 * Preflights every M07-T04 static reference and fixed finite-profile limit in one Bundle.
 *
 * @remarks The sole input must be the exact opaque authority returned by M07-T03. The function
 * reads the already authenticated private Bundle and package snapshots, applies a bounded
 * Reference Profile scan, and requires independent semantic-validator agreement. It accepts no
 * Bundle, Catalog, callback, loader, path, network location, or caller-selected limit. Success
 * grants no execution-contract, staging, channel, active-pointer, durable-commit, last-known-good,
 * or adapter-execution power.
 *
 * @returns A frozen exact-identity authority only after complete preflight, or a frozen terminal
 * rejection carrying no partial Bundle, Catalog, package, obligation, staging, or activation data.
 */
export function preflightBundleReferences(
  authority: BundlePackagePreflightAuthority,
): BundleReferencePreflightResult {
  return preflightBundleReferencesInternal(authority);
}
