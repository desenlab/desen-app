import { openBundleRuntimeActivation } from "../src/index.js";
import * as publicApi from "../src/index.js";

import type {
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleRuntimeActivation,
  BundleRuntimeActivationResult,
  BundleRuntimeRecoveryResult,
  BundleRuntimeStagingAuthority,
} from "../src/index.js";

declare const activation: BundleRuntimeActivation;
declare const packageAuthority: BundlePackagePreflightAuthority;
declare const referenceAuthority: BundleReferencePreflightAuthority;
declare const stagingAuthority: BundleRuntimeStagingAuthority;
declare const activationResult: BundleRuntimeActivationResult;
declare const recoveryResult: BundleRuntimeRecoveryResult;

// Fault seams remain package-private test infrastructure and cannot alter the public opening.
void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public callers cannot install transaction fault hooks.
  transactionHooks: {},
});

// Public activation and recovery accept only their exact authenticated inputs.
// @ts-expect-error Public callers cannot inject a commit fault into an activation attempt.
void activation.activate(referenceAuthority, stagingAuthority, null, { fault: "after-commit" });
// @ts-expect-error Public callers cannot inject durable state into restart recovery.
void activation.recover(packageAuthority, null, { generation: 42 });
// @ts-expect-error T03 package authority cannot stand in for T04 reference authority.
void activation.activate(packageAuthority, stagingAuthority, null);
// @ts-expect-error T04 reference authority cannot stand in for a recovery package authority.
void activation.recover(referenceAuthority, null);

if (activationResult.status === "recovery-required") {
  // @ts-expect-error An indeterminate commit outcome grants no active authority.
  void activationResult.authority;
}

if (recoveryResult.status === "rejected") {
  // @ts-expect-error A failed reconstruction grants no recovered authority.
  void recoveryResult.authority;
}

// Package-private seams used by this executable matrix are deliberately absent from the API.
// @ts-expect-error Internal activation construction is not a public fault-injection surface.
void publicApi.createBundleRuntimeActivationInternal;
// @ts-expect-error Internal SQLite repository opening is not publicly callable.
void publicApi.openRuntimeActivationSqliteRepository;
// @ts-expect-error Transaction hooks are not exported as public protocol capability.
void publicApi.RuntimeActivationTransactionHooks;
