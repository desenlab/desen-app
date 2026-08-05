import type { CoreDiagnosticCode, DesenCoreDiagnostic, DesenDiagnostic } from "@desen/protocol";

declare const BUNDLE_REFERENCE_PREFLIGHT_AUTHORITY_BRAND: unique symbol;

/** Project-owned diagnostic for a forged or stale M07-T03 package authority. */
export const INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE =
  "run.desen.control-plane/INVALID_BUNDLE_PACKAGE_AUTHORITY" as const;

/** Project-owned diagnostic for an unexpected reference-preflight implementation failure. */
export const REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE =
  "run.desen.control-plane/REFERENCE_PREFLIGHT_INTERNAL_FAILURE" as const;

/** Exact implementation-owned limits for M07-T04 activation admission. */
export interface BundleReferencePreflightLimits {
  /** Maximum surfaces admitted in one Bundle. */
  readonly maxSurfaces: number;
  /** Maximum source component nodes admitted across the complete Bundle. */
  readonly maxSourceNodes: number;
  /** Maximum source component nodes admitted on one surface before dynamic materialization. */
  readonly maxSourceNodesPerSurface: number;
  /** Maximum conservatively possible materialized nodes admitted on one surface. */
  readonly maxMaterializedNodesPerSurface: number;
  /** Maximum zero-based source component-tree depth, with the root at depth zero. */
  readonly maxSourceTreeDepth: number;
  /** Maximum instances contributed by one repeat declaration. */
  readonly maxRepeatInstances: number;
  /** Maximum direct actions admitted in one event or settlement turn. */
  readonly maxActionsPerTurn: number;
  /** Maximum action occurrences admitted across the complete Bundle. */
  readonly maxActionOccurrences: number;
  /** Maximum nested operation-settlement depth. */
  readonly maxSettlementDepth: number;
  /** Maximum arguments admitted by one predicate node. */
  readonly maxPredicateArguments: number;
  /** Maximum predicate nodes admitted in one predicate expression. */
  readonly maxPredicateNodesPerExpression: number;
  /** Maximum predicate-node occurrences admitted across the complete Bundle. */
  readonly maxPredicateNodeOccurrences: number;
  /** Maximum surface, target, event, command, and capability references admitted in one Bundle. */
  readonly maxReferenceOccurrences: number;
}

/**
 * Frozen finite profile for M07-T04 surface/capability reference and activation-limit preflight.
 *
 * @remarks The Reference Profile values are enforced before staging. Aggregate ceilings are local
 * implementation limits chosen to keep complete-Bundle admission bounded. Callers cannot widen or
 * replace this profile; later runtime stages independently re-enforce their own dynamic limits.
 */
export const BUNDLE_REFERENCE_PREFLIGHT_LIMITS: Readonly<BundleReferencePreflightLimits> =
  Object.freeze({
    maxSurfaces: 256,
    maxSourceNodes: 25_000,
    maxSourceNodesPerSurface: 5_000,
    maxMaterializedNodesPerSurface: 5_000,
    maxSourceTreeDepth: 64,
    maxRepeatInstances: 1_000,
    maxActionsPerTurn: 64,
    maxActionOccurrences: 25_000,
    maxSettlementDepth: 16,
    maxPredicateArguments: 64,
    maxPredicateNodesPerExpression: 64,
    maxPredicateNodeOccurrences: 25_000,
    maxReferenceOccurrences: 25_000,
  });

/** Safe immutable audit metadata for one Bundle surface accepted by M07-T04 preflight. */
export interface VerifiedBundleSurfaceReferences {
  /** Exact surface identifier. */
  readonly id: string;
  /** Number of source component nodes before conditional or repeat materialization. */
  readonly sourceNodeCount: number;
  /** Conservative maximum materialized-node count under literal and declared repeat bounds. */
  readonly maximumMaterializedNodeCount: number;
  /** Maximum zero-based source component-tree depth, with the root at depth zero. */
  readonly sourceTreeDepth: number;
  /** Number of component, behavior, resource, and operation capability references. */
  readonly capabilityReferenceCount: number;
  /** Number of direct action occurrences across event and settlement programs. */
  readonly actionCount: number;
  /** Number of predicate nodes across node, Variant, and action conditions. */
  readonly predicateNodeCount: number;
  /** Deepest possible operation-settlement program nesting. */
  readonly settlementDepth: number;
}

/**
 * Opaque proof that one exact M07-T03 Bundle/package authority passed reference and limit preflight.
 *
 * @remarks Later M07 stages authenticate exact object identity through package-private state. The
 * visible value carries no Bundle, Catalog, package bytes, runtime index, staging operation,
 * channel mutation, activation operation, executable callback, or mutable limit authority.
 */
export interface BundleReferencePreflightAuthority {
  /** Stable implementation profile used for this activation preflight. */
  readonly profile: "desen.reference.activation-preflight";
  /** Version of the stable implementation profile. */
  readonly profileVersion: 1;
  /** Exact protocol version inherited from the authenticated package authority. */
  readonly protocolVersion: "0.1.0";
  /** Exact verified Bundle revision to which this reference authority is bound. */
  readonly revision: string;
  /** Source and maximum declared-expansion audit for every surface in code-unit order. */
  readonly surfaces: readonly VerifiedBundleSurfaceReferences[];
  readonly [BUNDLE_REFERENCE_PREFLIGHT_AUTHORITY_BRAND]: true;
}

/** Stable reference-preflight substage that terminally rejected one attempt. */
export type BundleReferencePreflightStage =
  "package-authority" | "activation-limits" | "surface-capability-references" | "internal";

/** Core and project-owned diagnostic codes emitted by M07-T04 preflight. */
export type BundleReferencePreflightDiagnosticCode =
  | CoreDiagnosticCode
  | typeof INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE
  | typeof REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE;

type BundleReferencePreflightExtensionDiagnosticCode = Exclude<
  BundleReferencePreflightDiagnosticCode,
  CoreDiagnosticCode
>;

/** Frozen diagnostic emitted by surface/capability reference and finite-limit preflight. */
export type BundleReferencePreflightDiagnostic =
  | Readonly<DesenCoreDiagnostic>
  | Readonly<DesenDiagnostic<BundleReferencePreflightExtensionDiagnosticCode>>;

/** Controlled all-or-nothing result of M07-T04 reference and finite-limit preflight. */
export type BundleReferencePreflightResult =
  | Readonly<{
      /** Every M07-T04 static reference and fixed finite-profile check passed. */
      readonly status: "preflighted";
      /** Runtime-authenticated authority for the exact verified Bundle/package/reference relation. */
      readonly authority: BundleReferencePreflightAuthority;
    }>
  | Readonly<{
      /** At least one reference, contract, authority, or finite-limit check failed. */
      readonly status: "rejected";
      /** Exact causal boundary that stopped preflight. */
      readonly stage: BundleReferencePreflightStage;
      /** Stable immutable diagnostics without Bundle, Catalog, package, or executable authority. */
      readonly diagnostics: readonly BundleReferencePreflightDiagnostic[];
    }>;
