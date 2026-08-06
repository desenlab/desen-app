import type { DesenDiagnostic } from "@desen/protocol";

declare const BUNDLE_RUNTIME_STAGING_AUTHORITY_BRAND: unique symbol;

/** Project-owned diagnostic for a forged or stale M07-T03 package authority. */
export const INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE =
  "run.desen.control-plane/INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY" as const;

/** Project-owned diagnostic for drift inside an already verified package snapshot. */
export const RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE =
  "run.desen.control-plane/RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH" as const;

/** Project-owned diagnostic for staged-index work that exceeds the fixed local profile. */
export const RUNTIME_STAGING_LIMIT_EXCEEDED_CODE =
  "run.desen.control-plane/RUNTIME_STAGING_LIMIT_EXCEEDED" as const;

/** Project-owned diagnostic for an unexpected trusted staging-path failure. */
export const RUNTIME_STAGING_INTERNAL_FAILURE_CODE =
  "run.desen.control-plane/RUNTIME_STAGING_INTERNAL_FAILURE" as const;

/** Exact implementation-owned limits for M07-T06 runtime-index staging. */
export interface BundleRuntimeStagingLimits {
  /** Maximum exact package snapshots retained by one staged candidate. */
  readonly maxPackages: number;
  /** Maximum exact artifact entries retained across all staged package load plans. */
  readonly maxArtifactEntries: number;
  /** Maximum exact artifact bytes retained across all staged package load plans. */
  readonly maxArtifactBytes: number;
  /** Maximum capability contracts indexed across all four Catalog categories. */
  readonly maxCapabilityEntries: number;
  /** Maximum Bundle surfaces indexed by one staged candidate. */
  readonly maxSurfaces: number;
  /** Maximum source nodes indexed across all Bundle surfaces. */
  readonly maxSourceNodes: number;
  /** Maximum surface-local state entries indexed across all Bundle surfaces. */
  readonly maxStateEntries: number;
  /** Maximum attached behaviors indexed across all source nodes. */
  readonly maxBehaviors: number;
  /** Maximum prepared component or behavior event programs retained by one candidate. */
  readonly maxHandlerPrograms: number;
  /** Maximum resource aliases retained across all surfaces. */
  readonly maxResourceAliases: number;
  /** Maximum operation aliases retained across all prepared action programs. */
  readonly maxOperationAliases: number;
  /** Maximum complete dynamic execution obligations retained by one candidate. */
  readonly maxRuntimeValidationObligations: number;
  /** Maximum UTF-16 code units in one dynamic execution-obligation JSON Pointer. */
  readonly maxRuntimeObligationPointerCodeUnits: number;
  /** Maximum aggregate obligation kind, pointer, and identity-context code units. */
  readonly maxAggregateRuntimeObligationCodeUnits: number;
}

/**
 * Frozen finite profile for exact M07-T06 runtime-index staging.
 *
 * @remarks These are local implementation ceilings rather than universal DESEN 0.1.0 constants.
 * Package, artifact, capability, surface, and source-node ceilings do not widen the already proved
 * M07-T03/M07-T04 admission profiles. Obligation ceilings intentionally match the bounded
 * Publisher-to-runtime handoff. A crossing rejects the complete staged candidate; no index or
 * obligation is truncated.
 */
export const BUNDLE_RUNTIME_STAGING_LIMITS: Readonly<BundleRuntimeStagingLimits> = Object.freeze({
  maxPackages: 256,
  maxArtifactEntries: 256 * 1_024,
  maxArtifactBytes: 64 * 1_024 * 1_024,
  maxCapabilityEntries: 100_000,
  maxSurfaces: 256,
  maxSourceNodes: 25_000,
  maxStateEntries: 25_000,
  maxBehaviors: 25_000,
  maxHandlerPrograms: 25_000,
  maxResourceAliases: 25_000,
  maxOperationAliases: 25_000,
  maxRuntimeValidationObligations: 4_096,
  maxRuntimeObligationPointerCodeUnits: 4_096,
  maxAggregateRuntimeObligationCodeUnits: 1_048_576,
});

/** Callback-free audit summary for one exact package retained by a staged load plan. */
export interface StagedRuntimePackageSummary {
  /** Exact package identifier inherited from M07-T03. */
  readonly id: string;
  /** Exact package Semantic Version inherited from M07-T03. */
  readonly version: string;
  /** Exact statically selected target profile. */
  readonly target: "web-react";
  /** Independently reclosed digest of the staged Catalog and artifact copies. */
  readonly packageDigest: string;
  /** Number of inert artifact entries retained privately for this package. */
  readonly artifactCount: number;
  /** Aggregate exact bytes retained privately for this package's inert load plan. */
  readonly artifactByteLength: number;
  /** Number of component contracts contributed by this package. */
  readonly componentCount: number;
  /** Number of behavior contracts contributed by this package. */
  readonly behaviorCount: number;
  /** Number of operation contracts contributed by this package. */
  readonly operationCount: number;
  /** Number of resource contracts contributed by this package. */
  readonly resourceCount: number;
}

/** Callback-free audit summary for one exact surface runtime index. */
export interface StagedRuntimeSurfaceSummary {
  /** Exact surface identifier retained by the private staged index. */
  readonly id: string;
  /** Number of source component nodes indexed before repeat materialization. */
  readonly sourceNodeCount: number;
  /** Number of attached behavior declarations indexed across those source nodes. */
  readonly behaviorCount: number;
  /** Number of component and behavior event programs prepared through runtime-core. */
  readonly handlerProgramCount: number;
  /** Number of surface-local state entries indexed for later materialization. */
  readonly stateEntryCount: number;
  /** Number of surface-local resource aliases indexed for later materialization. */
  readonly resourceAliasCount: number;
  /** Number of distinct operation aliases discovered in prepared action programs. */
  readonly operationAliasCount: number;
}

/**
 * Opaque proof that one exact M07-T03 package authority produced complete staged runtime indexes.
 *
 * @remarks The explicit `stagedRevision` is not an active pointer. Later M07 stages authenticate
 * exact object identity through package-private state. This visible value contains no Bundle,
 * Catalog, artifact path or bytes, executable callback, loader, channel mutation, active revision,
 * previous-good revision, generation, durable commit, activation, rollback, adapter, or host
 * authority.
 */
export interface BundleRuntimeStagingAuthority {
  /** Stable implementation profile used to prepare the private runtime indexes. */
  readonly profile: "desen.runtime-index-staging";
  /** Version of the stable implementation profile. */
  readonly profileVersion: 1;
  /** Exact protocol version inherited from the authenticated package authority. */
  readonly protocolVersion: "0.1.0";
  /** Exact candidate revision staged independently from durable active state. */
  readonly stagedRevision: string;
  /** Exact document identifier retained by the validated staged Bundle. */
  readonly documentId: string;
  /** Exact entry surface identifier retained by the private surface index. */
  readonly entrySurfaceId: string;
  /** Package load-plan summaries in first-requirement package order. */
  readonly packages: readonly StagedRuntimePackageSummary[];
  /** Surface index summaries in code-unit order. */
  readonly surfaces: readonly StagedRuntimeSurfaceSummary[];
  /** Complete number of dynamic runtime checks retained for later materialization. */
  readonly runtimeObligationCount: number;
  readonly [BUNDLE_RUNTIME_STAGING_AUTHORITY_BRAND]: true;
}

/** Stable causal boundary that terminally rejected one staging attempt. */
export type BundleRuntimeStagingStage =
  | "package-authority"
  | "package-snapshots"
  | "execution-catalogs"
  | "execution-contracts"
  | "runtime-indexes"
  | "internal";

/** Stable immutable diagnostic emitted by M07-T06 runtime-index staging. */
export type BundleRuntimeStagingDiagnostic = Readonly<DesenDiagnostic<string>>;

/** Controlled all-or-nothing result of exact M07-T06 runtime-index staging. */
export type BundleRuntimeStagingResult =
  | Readonly<{
      /** Complete package load plans, execution contracts, obligations, and indexes were staged. */
      readonly status: "staged";
      /** Runtime-authenticated candidate authority with no active-state mutation power. */
      readonly authority: BundleRuntimeStagingAuthority;
    }>
  | Readonly<{
      /** Staging stopped without creating partial or active authority. */
      readonly status: "rejected";
      /** Exact causal boundary that stopped staging. */
      readonly stage: BundleRuntimeStagingStage;
      /** Stable immutable diagnostics without private staged data or technical causes. */
      readonly diagnostics: readonly BundleRuntimeStagingDiagnostic[];
    }>;
