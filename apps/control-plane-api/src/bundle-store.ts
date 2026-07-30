import { openBundleStoreInternal } from "./bundle-store-internal.js";

import type { BundleStore, OpenBundleStoreOptions } from "./bundle-store-contract.js";

/**
 * Opens the local content-addressed immutable Bundle store.
 *
 * @remarks The store persists exact caller-snapshotted bytes under a fixed path derived only from
 * an exact lowercase SHA-256 revision. It uses an exclusive same-directory temporary, durable
 * flush, and a no-clobber hard-link commit so concurrent writers cannot replace an existing
 * revision. This is a local POSIX filesystem profile; M07-T02 owns Bundle integrity verification
 * and M07-T05 owns the eventual control-plane API and mutable channel pointers.
 */
export function openBundleStore(options: OpenBundleStoreOptions): Promise<BundleStore> {
  return openBundleStoreInternal(options);
}
