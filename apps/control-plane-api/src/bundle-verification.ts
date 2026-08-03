import { verifyBundleStoreEntryInternal } from "./bundle-verification-internal.js";

import type {
  BundleIntegrityVerificationResult,
  BundleSourceMaterial,
} from "./bundle-verification-contract.js";
import type { BundleStoreEntry } from "./bundle-store-contract.js";

/**
 * Verifies one stored byte entry as an exact DESEN 0.1.0 Bundle before package preflight.
 *
 * @remarks The synchronous boundary snapshots genuine non-shared byte views, parses both documents
 * under fixed finite I-JSON rules, validates the frozen schemas, enforces the complete canonical
 * Bundle-size profile, closes the stored/embedded/recomputed revision triple, and independently
 * recalculates the Source digest when Source bytes are available. It performs no package resolution,
 * staging, activation, channel mutation, last-known-good update, or recovery action.
 *
 * @returns A frozen authenticated authority only after every applicable check succeeds, otherwise
 * a frozen redacted diagnostic result with no partial document or authority.
 */
export function verifyBundleStoreEntry(
  entry: BundleStoreEntry,
  sourceMaterial: BundleSourceMaterial,
): BundleIntegrityVerificationResult {
  return verifyBundleStoreEntryInternal(entry, sourceMaterial);
}
