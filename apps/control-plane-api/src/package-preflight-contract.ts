import type { DesenCoreDiagnostic, DesenDiagnostic } from "@desen/protocol";
import type { DesenStructuralDiagnosticCode } from "@desen/validator";

declare const BUNDLE_PACKAGE_PREFLIGHT_AUTHORITY_BRAND: unique symbol;

/** Project-owned diagnostic for a forged or stale M07-T02 integrity authority. */
export const INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE =
  "run.desen.control-plane/INVALID_BUNDLE_INTEGRITY_AUTHORITY" as const;

/** Project-owned diagnostic for malformed or unsafe installed-package material. */
export const INVALID_INSTALLED_PACKAGE_CODE =
  "run.desen.control-plane/INVALID_INSTALLED_PACKAGE" as const;

/** Project-owned diagnostic for installed-package work that exceeds the fixed local profile. */
export const PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE =
  "run.desen.control-plane/PACKAGE_PREFLIGHT_LIMIT_EXCEEDED" as const;

/** Project-owned diagnostic for an unexpected package-preflight implementation failure. */
export const PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE =
  "run.desen.control-plane/PACKAGE_PREFLIGHT_INTERNAL_FAILURE" as const;

/** Exact implementation-owned limits for M07-T03 installed-package preflight. */
export interface BundlePackagePreflightLimits {
  /** Maximum exact Catalog requirements admitted from one verified Bundle. */
  readonly maxRequirements: number;
  /** Maximum installed-package candidates admitted into one closed inventory. */
  readonly maxCandidates: number;
  /** Maximum UTF-16 code units admitted in one package identity field. */
  readonly maxIdentityStringCodeUnits: number;
  /** Maximum canonical UTF-8 bytes admitted for one selected Catalog. */
  readonly maxCatalogCanonicalBytes: number;
  /** Maximum aggregate canonical UTF-8 bytes across selected Catalogs. */
  readonly maxAggregateCatalogCanonicalBytes: number;
  /** Maximum JSON container depth admitted in one selected Catalog. */
  readonly maxCatalogDepth: number;
  /** Maximum JSON value occurrences admitted in one selected Catalog. */
  readonly maxCatalogValueOccurrences: number;
  /** Maximum enumerable own data members admitted on one Catalog JSON object. */
  readonly maxCatalogObjectMembers: number;
  /** Maximum aggregate decoded string code units admitted in one selected Catalog. */
  readonly maxCatalogStringCodeUnits: number;
  /** Maximum capability declarations admitted across the selected Catalog set. */
  readonly maxCapabilityDeclarations: number;
  /** Maximum artifacts admitted for one installed package, excluding canonical `catalog.json`. */
  readonly maxArtifactsPerPackage: number;
  /** Maximum lowercase-ASCII bytes admitted in one portable artifact path. */
  readonly maxArtifactPathBytes: number;
  /** Maximum exact bytes admitted in one package entry. */
  readonly maxArtifactEntryBytes: number;
  /** Maximum complete Web–React v1 framed bytes admitted for one package. */
  readonly maxPackagePreimageBytes: number;
  /** Maximum aggregate framed bytes across all selected packages. */
  readonly maxAggregatePackagePreimageBytes: number;
  /** Maximum diagnostics retained by one stopped package-resolution stage. */
  readonly maxDiagnostics: number;
}

/**
 * Frozen finite profile for M07-T03 exact installed-package resolution and digest verification.
 *
 * @remarks These are local implementation ceilings rather than universal DESEN 0.1.0 constants.
 * The per-package artifact, path, entry, Catalog, and preimage values reproduce the versioned
 * Web–React package-digest v1 profile. M07-T04 still owns whole-activation limits.
 */
export const BUNDLE_PACKAGE_PREFLIGHT_LIMITS: Readonly<BundlePackagePreflightLimits> =
  Object.freeze({
    maxRequirements: 256,
    maxCandidates: 1_024,
    maxIdentityStringCodeUnits: 4_096,
    maxCatalogCanonicalBytes: 16 * 1_024 * 1_024,
    maxAggregateCatalogCanonicalBytes: 64 * 1_024 * 1_024,
    maxCatalogDepth: 128,
    maxCatalogValueOccurrences: 100_000,
    maxCatalogObjectMembers: 100_000,
    maxCatalogStringCodeUnits: 4 * 1_024 * 1_024,
    maxCapabilityDeclarations: 100_000,
    maxArtifactsPerPackage: 1_024,
    maxArtifactPathBytes: 240,
    maxArtifactEntryBytes: 16 * 1_024 * 1_024,
    maxPackagePreimageBytes: 64 * 1_024 * 1_024,
    maxAggregatePackagePreimageBytes: 64 * 1_024 * 1_024,
    maxDiagnostics: 256,
  });

/** One exact enumerable-data target artifact offered as installed package material. */
export interface InstalledPackageArtifact {
  /** Portable package-relative path interpreted only by the statically selected target profile. */
  readonly path: string;
  /** Exact artifact bytes; package preflight snapshots the complete supplied view synchronously. */
  readonly bytes: Readonly<Uint8Array>;
}

/** One host-approved enumerable-data package candidate offered to exact Bundle preflight. */
export interface InstalledPackageCandidate {
  /** Exact installed Catalog package identifier used for resolution before material inspection. */
  readonly id: string;
  /** Exact installed Semantic Version used without range or newest-version substitution. */
  readonly version: string;
  /** Exact installed target used without case or Unicode normalization. */
  readonly target: string;
  /** Untrusted inert enumerable Catalog data whose identity and self-digest must match the bytes. */
  readonly catalog: unknown;
  /** Complete target-profile artifact inventory, excluding the projected `catalog.json` entry. */
  readonly artifacts: readonly InstalledPackageArtifact[];
}

/** Safe immutable audit metadata for one exact installed package accepted by preflight. */
export interface VerifiedInstalledPackage {
  /** Exact Catalog package identifier. */
  readonly id: string;
  /** Exact Catalog package Semantic Version. */
  readonly version: string;
  /** Exact target profile. */
  readonly target: "web-react";
  /** Digest independently recalculated from the complete framed package material. */
  readonly packageDigest: string;
  /** Statically selected target-profile identifier. */
  readonly digestProfile: "desen.web-react.package-digest";
  /** Statically selected target-profile version. */
  readonly digestProfileVersion: 1;
  /** Number of exact target artifacts, excluding the projected Catalog entry. */
  readonly artifactCount: number;
  /** Complete versioned package-digest preimage length without exposing its bytes. */
  readonly framedByteLength: number;
}

/**
 * Opaque proof that one M07-T02 Bundle authority resolved every exact installed package tuple.
 *
 * @remarks Later M07 stages authenticate exact object identity through package-private state. The
 * visible value carries no Catalog, artifact bytes, loader, module specifier, executable callback,
 * staging operation, channel mutation, or activation operation.
 */
export interface BundlePackagePreflightAuthority {
  /** Exact protocol version inherited from the authenticated Bundle integrity authority. */
  readonly protocolVersion: "0.1.0";
  /** Exact verified Bundle revision to which this package authority is bound. */
  readonly revision: string;
  /** Unique selected packages in first-requirement order. */
  readonly packages: readonly VerifiedInstalledPackage[];
  /** Positional mapping from every Bundle requirement to one unique selected package. */
  readonly requirementPackageIndexes: readonly number[];
  readonly [BUNDLE_PACKAGE_PREFLIGHT_AUTHORITY_BRAND]: true;
}

/** Stable package-preflight substage that terminally rejected one attempt. */
export type BundlePackagePreflightStage =
  | "integrity-authority"
  | "package-requirements"
  | "package-inventory"
  | "package-resolution"
  | "package-catalog"
  | "package-digest"
  | "catalog-set"
  | "internal";

/** Core and project-owned diagnostic codes emitted by installed-package preflight. */
export type BundlePackagePreflightDiagnosticCode =
  | DesenStructuralDiagnosticCode
  | "AMBIGUOUS_CAPABILITY"
  | "CATALOG_DIGEST_MISMATCH"
  | "CATALOG_VERSION_UNAVAILABLE"
  | "run.desen.validator/INVALID_SEMVER"
  | typeof INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE
  | typeof INVALID_INSTALLED_PACKAGE_CODE
  | typeof PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE
  | typeof PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE;

type BundlePackagePreflightCoreDiagnosticCode =
  | DesenStructuralDiagnosticCode
  | "AMBIGUOUS_CAPABILITY"
  | "CATALOG_DIGEST_MISMATCH"
  | "CATALOG_VERSION_UNAVAILABLE";

type BundlePackagePreflightExtensionDiagnosticCode = Exclude<
  BundlePackagePreflightDiagnosticCode,
  BundlePackagePreflightCoreDiagnosticCode
>;

/** Frozen redacted diagnostic emitted by exact installed-package preflight. */
export type BundlePackagePreflightDiagnostic =
  | Readonly<DesenCoreDiagnostic<BundlePackagePreflightCoreDiagnosticCode>>
  | Readonly<DesenDiagnostic<BundlePackagePreflightExtensionDiagnosticCode>>;

/** Controlled all-or-nothing result of exact installed-package preflight. */
export type BundlePackagePreflightResult =
  | Readonly<{
      /** Every Bundle requirement resolved to one exact independently verified package. */
      readonly status: "preflighted";
      /** Runtime-authenticated authority for the exact verified Bundle/package relation. */
      readonly authority: BundlePackagePreflightAuthority;
    }>
  | Readonly<{
      /** At least one required package check failed. */
      readonly status: "rejected";
      /** Exact causal boundary that stopped preflight. */
      readonly stage: BundlePackagePreflightStage;
      /** Stable immutable diagnostics without package bytes, paths, or technical causes. */
      readonly diagnostics: readonly BundlePackagePreflightDiagnostic[];
    }>;
