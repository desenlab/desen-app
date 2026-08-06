import { stageBundleRuntimeInternal } from "./runtime-staging-internal.js";

import type { BundlePackagePreflightAuthority } from "./package-preflight-contract.js";
import type { BundleRuntimeStagingResult } from "./runtime-staging-contract.js";

/**
 * Stages exact runtime execution contracts, indexes, obligations, and inert package load plans.
 *
 * @remarks The sole input must be the exact opaque authority returned by M07-T03. The operation
 * authenticates that identity before reading its private Bundle, Catalog, or artifact snapshots,
 * re-closes the exact package bytes into a separate staged lifetime, and prepares no executable
 * callback or target adapter. Success is only a candidate: it cannot read or mutate a channel,
 * durable active revision, previous-good revision, generation, commit, recovery, or host state.
 * M07-T07 must independently join this exact staged identity with M07-T04 reference authority
 * before any activation transaction is permitted.
 *
 * @returns A frozen exact-identity staged authority after complete preparation, or a frozen
 * terminal rejection carrying no partial indexes, package bytes, active state, or commit power.
 */
export function stageBundleRuntime(
  authority: BundlePackagePreflightAuthority,
): BundleRuntimeStagingResult {
  return stageBundleRuntimeInternal(authority);
}
