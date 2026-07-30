/**
 * Local control-plane infrastructure for immutable DESEN Bundle storage.
 *
 * @packageDocumentation
 */

export { BundleStoreError } from "./bundle-store-contract.js";
export { openBundleStore } from "./bundle-store.js";

export type {
  BundleStore,
  BundleStoreEntry,
  BundleStoreErrorCode,
  BundleStorePutResult,
  BundleStoreReadResult,
  OpenBundleStoreOptions,
} from "./bundle-store-contract.js";
