import { openBundleStore } from "../src/index.js";

import type {
  BundleStore,
  BundleStoreEntry,
  BundleStorePutResult,
  BundleStoreReadResult,
} from "../src/index.js";

declare const store: BundleStore;
declare const entry: BundleStoreEntry;
declare const read: BundleStoreReadResult;
declare const put: BundleStorePutResult;

void openBundleStore({ rootDirectory: "/absolute/application-owned/store" });
void store.getBundle(entry.revision);
void store.putBundle(entry);

if (read.status === "found") {
  const revision: string = read.entry.revision;
  const bytes: Readonly<Uint8Array> = read.entry.bytes;
  void revision;
  void bytes;
}

if (put.status === "conflict") {
  const status: "conflict" = put.status;
  void status;
}

// @ts-expect-error Bundle entries are immutable at the contract boundary.
entry.revision = "sha256:mutated";
// @ts-expect-error Exact bytes must be a Uint8Array view.
void store.putBundle({ revision: entry.revision, bytes: "{}" });
// @ts-expect-error The store deliberately exposes no mutable channel API in M07-T01.
void store.setChannel("preview", entry.revision);
// @ts-expect-error The store deliberately exposes no deletion API.
void store.deleteBundle(entry.revision);
