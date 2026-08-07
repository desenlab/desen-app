import type {
  BundlePackagePreflightAuthority,
  BundleRuntimeActivation,
  BundleRuntimeActivationAuthority,
  BundleRuntimeRecoveryResult,
  RuntimeActivationRecord,
} from "../src/index.js";

declare const activation: BundleRuntimeActivation;
declare const activePackageAuthority: BundlePackagePreflightAuthority;
declare const previousGoodPackageAuthority: BundlePackagePreflightAuthority;
declare const result: BundleRuntimeRecoveryResult;
declare const rawRecord: RuntimeActivationRecord;
declare const activationAuthority: BundleRuntimeActivationAuthority;

const attempt: Promise<BundleRuntimeRecoveryResult> = activation.recover(
  activePackageAuthority,
  previousGoodPackageAuthority,
);
const initialAttempt: Promise<BundleRuntimeRecoveryResult> = activation.recover(
  activePackageAuthority,
  null,
);

if (result.status === "recovered") {
  const authority: BundleRuntimeActivationAuthority = result.authority;
  const record: RuntimeActivationRecord = authority;
  void record;
  // @ts-expect-error Recovered authority metadata is immutable.
  authority.generation = 0;
  // @ts-expect-error Recovery authority exposes no persistent record writer.
  authority.commit();
  // @ts-expect-error Recovery authority cannot authorize another recovery.
  authority.recover();
  // @ts-expect-error Recovery authority exposes no Bundle or installed-package bytes.
  void authority.bundle;
  // @ts-expect-error Recovery authority exposes no package or native-module loader.
  void authority.loader;
  // @ts-expect-error Recovery authority exposes no SQLite handle.
  void authority.sqlite;
}

if (result.status === "not-required") {
  const state: "empty" | "active" = result.state;
  void state;
  // @ts-expect-error A no-op recovery result carries no reconstructed authority.
  void result.authority;
}

if (result.status === "rejected") {
  const role: "active" | "previous-good" = result.role;
  const stage:
    | "package-authority"
    | "reference-preflight"
    | "runtime-staging"
    | "bundle-reclosure"
    | "internal" = result.stage;
  const diagnosticCode: string = result.diagnostics[0]?.code ?? "";
  void role;
  void stage;
  void diagnosticCode;
  // @ts-expect-error Rejected recovery never carries partial authority.
  void result.authority;
}

if (result.status === "recovery-required" && result.record !== null) {
  const record: RuntimeActivationRecord = result.record;
  void record;
  // @ts-expect-error A raw durable record cannot forge recovered runtime authority.
  const forged: BundleRuntimeActivationAuthority = result.record;
  void forged;
}

// @ts-expect-error A raw durable record is not an opaque package authority.
void activation.recover(rawRecord, null);
// @ts-expect-error An activation authority cannot replace the active package lineage.
void activation.recover(activationAuthority, null);
// @ts-expect-error Previous-good package authority is explicitly null or authentic authority.
void activation.recover(activePackageAuthority, undefined);
// @ts-expect-error Caller cannot add a record, revision, path, store, or loader argument.
void activation.recover(activePackageAuthority, previousGoodPackageAuthority, rawRecord);
// @ts-expect-error Recovery accepts package authority, not T07 active authority, in the fallback slot.
void activation.recover(activePackageAuthority, activationAuthority);

void attempt;
void initialAttempt;
