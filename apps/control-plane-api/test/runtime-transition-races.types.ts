import { openBundleRuntimeActivation } from "../src/index.js";
import * as publicApi from "../src/index.js";

import type {
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleRuntimeActivation,
  BundleRuntimeStagingAuthority,
  RuntimeActivationRecord,
} from "../src/index.js";

declare const activation: BundleRuntimeActivation;
declare const packageAuthority: BundlePackagePreflightAuthority;
declare const referenceAuthority: BundleReferencePreflightAuthority;
declare const stagingAuthority: BundleRuntimeStagingAuthority;
declare const durableRecord: RuntimeActivationRecord;

// Concurrency policy and durable lineage are repository-owned, not caller-selected inputs.
// @ts-expect-error Callers cannot choose a concurrency shortcut for activation.
void activation.activate(referenceAuthority, stagingAuthority, 0, { concurrency: "replace" });
// @ts-expect-error Callers cannot submit an active/previous-good record as a fourth argument.
void activation.activate(referenceAuthority, stagingAuthority, 0, durableRecord);
// @ts-expect-error A package authority cannot bypass T04 reference preflight.
void activation.activate(packageAuthority, stagingAuthority, 0);

// Restart reconstruction accepts exact package roles, never a caller-supplied durable record.
// @ts-expect-error Recovery cannot install a caller-provided record or generation.
void activation.recover(packageAuthority, null, durableRecord);
// @ts-expect-error A staging authority cannot stand in for a restart package authority.
void activation.recover(stagingAuthority, null);

void openBundleRuntimeActivation({
  rootDirectory: "/absolute/application-owned/desen-state",
  // @ts-expect-error Public opening exposes no connection-profile or transaction hook.
  beforeWriterProfileCheck: () => undefined,
});

// The race matrix adds no public repository, SQLite, or authority-inspection surface.
// @ts-expect-error Package-private SQLite opening remains absent from the public root.
void publicApi.openRuntimeActivationSqliteRepository;
// @ts-expect-error The native SQLite handle remains package-private.
void publicApi.runtimeActivationDatabase;
// @ts-expect-error Consumed staging authority cannot be reset or replayed by a caller.
stagingAuthority.reset();

void durableRecord;
