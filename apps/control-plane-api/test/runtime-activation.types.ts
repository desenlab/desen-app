import { openBundleRuntimeActivation } from "../src/index.js";
import * as publicApi from "../src/index.js";

import type {
  BundleReferencePreflightAuthority,
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeActivationResult,
  BundleRuntimeStagingAuthority,
  RuntimeActivationRecord,
} from "../src/index.js";

declare const referenceAuthority: BundleReferencePreflightAuthority;
declare const stagingAuthority: BundleRuntimeStagingAuthority;
declare const activation: BundleRuntimeActivation;
declare const result: BundleRuntimeActivationResult;

const recordOnly: RuntimeActivationRecord = {
  activeRevision: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  previousGoodRevision: null,
  generation: 0,
};
// @ts-expect-error A visible record cannot forge the private activation-authority brand.
const forgedAuthority: BundleRuntimeActivationAuthority = recordOnly;

const opening: Promise<BundleRuntimeActivation> = openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
});
const attempt: Promise<BundleRuntimeActivationResult> = activation.activate(
  referenceAuthority,
  stagingAuthority,
  null,
);

if (result.status === "activated") {
  const authority: BundleRuntimeActivationAuthority = result.authority;
  const record: RuntimeActivationRecord = authority;
  void record;
  // @ts-expect-error Caller cannot replace the transaction-derived active revision.
  authority.activeRevision = "sha256:forged";
  // @ts-expect-error Caller cannot replace the transaction-derived previous-good revision.
  authority.previousGoodRevision = null;
  // @ts-expect-error Activation authority exposes no staged Bundle or runtime index.
  void authority.bundle;
  // @ts-expect-error Activation authority exposes no package loader.
  void authority.loader;
  // @ts-expect-error Activation authority exposes no mutable release channel.
  void authority.channel;
  // @ts-expect-error Activation authority exposes no repository handle.
  void authority.repository;
  // @ts-expect-error Activation authority exposes no SQLite handle.
  void authority.sqlite;
  // @ts-expect-error Activation authority grants no recovery or rollback operation.
  authority.rollback();
  // @ts-expect-error Restart recovery belongs to M07-T08, not this authority.
  authority.recover();
}

const observed = activation.readState();
if (observed.status === "recovery-required" && observed.record !== null) {
  // @ts-expect-error A raw recovered record is deliberately not authenticated as an authority.
  const recoveredAuthority: BundleRuntimeActivationAuthority = observed.record;
  void recoveredAuthority;
}

// @ts-expect-error The caller cannot submit active or previous-good revisions.
void activation.activate(referenceAuthority, stagingAuthority, null, {
  activeRevision: "sha256:forged",
  previousGoodRevision: null,
});
// @ts-expect-error Expected generation must be a nonnegative number or null.
void activation.activate(referenceAuthority, stagingAuthority, "0");
// @ts-expect-error T04 authority cannot replace the T06 staging branch.
void activation.activate(referenceAuthority, referenceAuthority, null);
// @ts-expect-error T06 authority cannot replace the T04 reference branch.
void activation.activate(stagingAuthority, stagingAuthority, null);
void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public opening accepts no arbitrary database path.
  databaseFilePath: "/tmp/forged.sqlite3",
});
void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public opening accepts no caller-provided repository.
  repository: {},
});
void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public opening accepts no caller-provided Bundle store seam.
  bundleStore: {},
});
void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public opening accepts no caller-selected active revision.
  activeRevision: recordOnly.activeRevision,
});

// @ts-expect-error Package-private repository construction is not exported publicly.
void publicApi.createInMemoryRuntimeActivationRepository;
// @ts-expect-error Package-private SQLite opening is not exported publicly.
void publicApi.openRuntimeActivationSqliteRepository;
// @ts-expect-error Package-private authority inspection is not exported publicly.
void publicApi.readBundleRuntimeActivationAuthority;
// @ts-expect-error Package-private owned-resource assembly is not exported publicly.
void publicApi.createOwnedBundleRuntimeActivationInternal;
// @ts-expect-error Package-private storage errors are not exported publicly.
void publicApi.RuntimeActivationStorageError;
// @ts-expect-error Package-private storage-error authentication is not exported publicly.
void publicApi.readRuntimeActivationStorageErrorCode;

void opening;
void attempt;
void forgedAuthority;
