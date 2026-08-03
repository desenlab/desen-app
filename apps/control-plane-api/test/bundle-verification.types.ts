import { BUNDLE_INTEGRITY_LIMITS, verifyBundleStoreEntry } from "../src/index.js";

import type {
  BundleIntegrityAuthority,
  BundleIntegrityVerificationResult,
  BundleSourceMaterial,
  BundleStoreEntry,
} from "../src/index.js";

declare const entry: BundleStoreEntry;
declare const authority: BundleIntegrityAuthority;
declare const result: BundleIntegrityVerificationResult;

const unavailable = { status: "not-available" } as const satisfies BundleSourceMaterial;
const available = {
  status: "available",
  sourceBytes: new Uint8Array(),
} as const satisfies BundleSourceMaterial;

void verifyBundleStoreEntry(entry, unavailable);
void verifyBundleStoreEntry(entry, available);

if (result.status === "verified") {
  const verified: BundleIntegrityAuthority = result.authority;
  void verified;
} else {
  const stage: string = result.stage;
  const code: string = result.diagnostics[0]?.code ?? "";
  void stage;
  void code;
}

// @ts-expect-error Source availability must be supplied explicitly.
void verifyBundleStoreEntry(entry);
// @ts-expect-error Caller-selected limits or helper injection cannot weaken the fixed profile.
void verifyBundleStoreEntry(entry, unavailable, { maxBundleUtf8Bytes: 1 });
// @ts-expect-error Available Source evidence must carry a Uint8Array byte view.
void verifyBundleStoreEntry(entry, { status: "available", sourceBytes: "{}" });
// @ts-expect-error The opaque authority cannot be created structurally.
const forgedAuthority: BundleIntegrityAuthority = {};
const protocolVersion: "0.1.0" = authority.protocolVersion;
const sourceStatus: "matched" | "not-available" = authority.sourceDigestVerification;
void protocolVersion;
void sourceStatus;
// @ts-expect-error An authority exposes no raw byte view.
void authority.bytes;
// @ts-expect-error Integrity authority grants no activation, channel, or package-resolution API.
void authority.activate();
// @ts-expect-error The verified Bundle snapshot is recursively immutable.
authority.bundle.id = "mutated";
// @ts-expect-error Rejected results never carry partial authority.
if (result.status === "rejected") void result.authority;
// @ts-expect-error The finite verification profile is immutable.
BUNDLE_INTEGRITY_LIMITS.maxBundleUtf8Bytes = 1;

void forgedAuthority;
