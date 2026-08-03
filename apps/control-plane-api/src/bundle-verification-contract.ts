import type { DesenBundle, DesenCoreDiagnostic, DesenDiagnostic } from "@desen/protocol";
import type { DesenStructuralDiagnosticCode, ImmutableJson } from "@desen/validator";

declare const BUNDLE_INTEGRITY_AUTHORITY_BRAND: unique symbol;

/** Project-owned diagnostic code for finite available-Source ingress exhaustion. */
export const SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE =
  "run.desen.control-plane/SOURCE_MATERIAL_LIMIT_EXCEEDED" as const;

/** Finite parsing and complete-Bundle limits enforced by the M07-T02 integrity boundary. */
export interface BundleIntegrityLimits {
  /** Maximum raw UTF-8 bytes accepted for one stored Bundle entry. */
  readonly maxBundleUtf8Bytes: number;
  /** Maximum RFC 8785 canonical UTF-8 bytes accepted for the complete validated Bundle. */
  readonly maxBundleCanonicalUtf8Bytes: number;
  /** Maximum raw UTF-8 bytes accepted for independently available Source evidence. */
  readonly maxSourceUtf8Bytes: number;
  /** Maximum RFC 8785 canonical UTF-8 bytes accepted for the complete available Source. */
  readonly maxSourceCanonicalUtf8Bytes: number;
  /** Maximum object/array nesting depth accepted in either JSON document. */
  readonly maxJsonDepth: number;
  /** Maximum JSON value occurrences accepted in either document, excluding member names. */
  readonly maxJsonValueOccurrences: number;
  /** Maximum aggregate decoded UTF-16 code units across keys and strings in either document. */
  readonly maxDecodedStringCodeUnits: number;
  /** Maximum UTF-16 code units accepted in one raw JSON number token. */
  readonly maxNumberTokenCodeUnits: number;
}

/**
 * Frozen finite ingress profile for DESEN 0.1.0 Bundle integrity verification.
 *
 * @remarks The complete Bundle limits implement the Reference Profile's 2 MiB ceiling as exactly
 * 2,097,152 raw stored bytes and 2,097,152 RFC 8785 canonical UTF-8 bytes. The larger Source raw
 * and canonical allowances match the bounded Publisher ingress scale because authoring and
 * discovery data can be removed during publication. These project-owned parser budgets do not
 * redefine the protocol.
 */
export const BUNDLE_INTEGRITY_LIMITS: Readonly<BundleIntegrityLimits> = Object.freeze({
  maxBundleUtf8Bytes: 2_097_152,
  maxBundleCanonicalUtf8Bytes: 2_097_152,
  maxSourceUtf8Bytes: 8_388_608,
  maxSourceCanonicalUtf8Bytes: 8_388_608,
  maxJsonDepth: 256,
  maxJsonValueOccurrences: 262_144,
  maxDecodedStringCodeUnits: 4_194_304,
  maxNumberTokenCodeUnits: 1_024,
});

/** Exact availability envelope for Source evidence supplied during Bundle verification. */
export type BundleSourceMaterial =
  | Readonly<{
      /** No Source material is available, so the embedded digest remains uncorroborated. */
      readonly status: "not-available";
    }>
  | Readonly<{
      /** Source material is available and must independently match the Bundle's claimed digest. */
      readonly status: "available";
      /** Exact untrusted Source JSON bytes; the verifier snapshots this view synchronously. */
      readonly sourceBytes: Readonly<Uint8Array>;
    }>;

/**
 * Opaque factory-authenticated proof that one stored Bundle passed the M07-T02 integrity boundary.
 *
 * @remarks The handle exposes the independent immutable Bundle and safe integrity metadata needed
 * by later preflight, but no raw Bundle bytes or Source material. A structural clone or TypeScript
 * cast cannot create runtime authority because later control-plane stages authenticate the exact
 * object identity through package-private state.
 */
export interface BundleIntegrityAuthority {
  /** Independent recursively immutable Bundle snapshot that passed this exact boundary. */
  readonly bundle: ImmutableJson<DesenBundle>;
  /** Exact protocol version admitted by this verifier. */
  readonly protocolVersion: "0.1.0";
  /** Stored, embedded, and independently calculated Bundle revision. */
  readonly revision: string;
  /** Structurally validated digest claimed by the verified Bundle. */
  readonly sourceDigest: string;
  /** Whether real available Source bytes independently corroborated the claimed digest. */
  readonly sourceDigestVerification: "matched" | "not-available";
  /** Exact snapshotted stored byte length admitted at ingress. */
  readonly storedByteLength: number;
  /** Complete RFC 8785 canonical UTF-8 byte length admitted after schema validation. */
  readonly canonicalByteLength: number;
  readonly [BUNDLE_INTEGRITY_AUTHORITY_BRAND]: true;
}

/** Stable core and project-owned diagnostic codes that may reject Bundle integrity verification. */
export type BundleIntegrityDiagnosticCode =
  | DesenStructuralDiagnosticCode
  | "BUNDLE_LIMIT_EXCEEDED"
  | "REVISION_MISMATCH"
  | "SOURCE_DIGEST_MISMATCH"
  | typeof SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE;

/** Frozen, redacted diagnostic emitted by Bundle integrity verification. */
export type BundleIntegrityDiagnostic =
  | Readonly<
      DesenCoreDiagnostic<
        Exclude<BundleIntegrityDiagnosticCode, typeof SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE>
      >
    >
  | Readonly<DesenDiagnostic<typeof SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE>>;

/** Exact integrity substage that terminally rejected one verification attempt. */
export type BundleIntegrityVerificationStage =
  | "entry-capture"
  | "bundle-size"
  | "bundle-json"
  | "bundle-protocol"
  | "bundle-schema"
  | "bundle-revision"
  | "source-material"
  | "source-json"
  | "source-protocol"
  | "source-schema"
  | "source-digest"
  | "internal";

/**
 * Controlled result of verifying one immutable Bundle-store entry and optional Source evidence.
 *
 * @remarks Only `verified` carries an authenticated authority. Rejection is fail-closed and never
 * exposes parsed documents, claimed or calculated digests, caller byte views, or partial authority.
 */
export type BundleIntegrityVerificationResult =
  | Readonly<{
      /** Every M07-T02 check passed. */
      readonly status: "verified";
      /** Exact identity authenticated by later package-private activation stages. */
      readonly authority: BundleIntegrityAuthority;
    }>
  | Readonly<{
      /** At least one required M07-T02 check failed. */
      readonly status: "rejected";
      /** Exact closed verification boundary that rejected the attempt. */
      readonly stage: BundleIntegrityVerificationStage;
      /** Stable, immutable rejection diagnostics with no raw caller value or technical cause. */
      readonly diagnostics: readonly BundleIntegrityDiagnostic[];
    }>;
