import type { DesenBundle, DesenCoreDiagnostic, DesenDiagnostic } from "@desen/protocol";
import type { DesenSemanticExtensionDiagnosticCode, ImmutableJson } from "@desen/validator";

/**
 * Stable project diagnostic emitted when raw Source text is not interoperable JSON.
 *
 * @remarks This code covers syntax failure, duplicate decoded object member names, invalid Unicode,
 * and non-finite numeric values before a DESEN document exists. `SCHEMA_INVALID` remains reserved
 * for a parsed document that fails a normative DESEN schema.
 */
export const INVALID_SOURCE_JSON_CODE = "run.desen.publisher/INVALID_SOURCE_JSON" as const;

/**
 * Stable project diagnostic emitted when raw Source parsing exceeds a finite publisher budget.
 */
export const SOURCE_LIMIT_EXCEEDED_CODE = "run.desen.publisher/SOURCE_LIMIT_EXCEEDED" as const;

/**
 * Stable project diagnostic emitted when Source data uses a deprecated Catalog capability.
 *
 * @remarks Deprecation remains non-blocking while the exact package is available. The diagnostic
 * never authorizes replacement selection and never repeats caller-controlled Catalog prose.
 */
export const DEPRECATED_CAPABILITY_CODE = "run.desen.publisher/DEPRECATED_CAPABILITY" as const;

const PUBLISHER_DIAGNOSTIC_DATA = [
  [INVALID_SOURCE_JSON_CODE, "Raw Source input is not interoperable JSON.", "json-parse", "error"],
  [
    SOURCE_LIMIT_EXCEEDED_CODE,
    "Raw Source parsing exceeded the finite Publisher profile.",
    "json-parse",
    "error",
  ],
  [
    DEPRECATED_CAPABILITY_CODE,
    "Source data uses a deprecated Catalog capability.",
    "capability-contracts",
    "warning",
  ],
] as const;

/**
 * Ordered publication stages implemented by the local DESEN 0.1.0 Publisher.
 *
 * @remarks The order mirrors the sixteen required steps in SPEC Section 25.1. Optional signing and
 * publication metadata are outside M06 and remain assigned to the release profile.
 */
export const PUBLISH_PIPELINE_STAGES = Object.freeze([
  "json-parse",
  "source-schema",
  "embedded-schema",
  "source-semantics",
  "catalog-resolution",
  "catalog-integrity",
  "namespace-conflicts",
  "capability-contracts",
  "state-and-control-flow",
  "binding-compatibility",
  "source-digest",
  "authoring-removal",
  "normalization",
  "catalog-pinning",
  "bundle-validation",
  "bundle-revision",
] as const);

/** One required DESEN 0.1.0 publication stage in normative execution order. */
export type PublishPipelineStage = (typeof PUBLISH_PIPELINE_STAGES)[number];

/** Project diagnostic codes owned by the platform-neutral Publisher. */
export type PublisherExtensionDiagnosticCode = (typeof PUBLISHER_DIAGNOSTIC_DATA)[number][0];

/** Project diagnostic codes introduced by the package-private M06-T02 Catalog boundary. */
export type CatalogResolutionExtensionDiagnosticCode =
  "run.desen.publisher/INVALID_CATALOG_INPUT" | "run.desen.publisher/CATALOG_LIMIT_EXCEEDED";

/** Project diagnostic introduced by the package-private M06-T03 Source-preflight boundary. */
export type SourcePreflightExtensionDiagnosticCode =
  "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED";

/** Project diagnostic introduced by the package-private M06-T04 capability-preflight boundary. */
export type CapabilityPreflightExtensionDiagnosticCode =
  "run.desen.publisher/CAPABILITY_PREFLIGHT_LIMIT_EXCEEDED";

/** Stable diagnostic code owned by the DESEN Publisher implementation. */
export type PublisherDiagnosticCode = PublisherExtensionDiagnosticCode;

/** Immutable metadata for one Publisher-owned diagnostic code. */
export interface PublisherDiagnosticDefinition {
  /** Stable collision-resistant diagnostic identity. */
  readonly code: PublisherDiagnosticCode;
  /** Safe canonical meaning; instance messages may add non-sensitive context. */
  readonly meaning: string;
  /** Publication stage that owns this diagnostic in the current implementation profile. */
  readonly defaultStage: PublishPipelineStage;
  /** Default blocking category for this diagnostic. */
  readonly defaultSeverity: PublishDiagnosticSeverity;
}

/** Every non-core diagnostic code that the Publisher may currently relay or emit. */
export type PublishExtensionDiagnosticCode =
  | DesenSemanticExtensionDiagnosticCode
  | PublisherExtensionDiagnosticCode
  | CatalogResolutionExtensionDiagnosticCode
  | SourcePreflightExtensionDiagnosticCode
  | CapabilityPreflightExtensionDiagnosticCode;

/** Whether a publication diagnostic blocks Bundle emission. */
export type PublishDiagnosticSeverity = "error" | "warning";

type PublisherDiagnosticByCode = {
  readonly [Code in PublisherDiagnosticCode]: Readonly<{
    code: Code;
    meaning: Extract<
      (typeof PUBLISHER_DIAGNOSTIC_DATA)[number],
      readonly [Code, string, string, string]
    >[1];
    defaultStage: Extract<
      (typeof PUBLISHER_DIAGNOSTIC_DATA)[number],
      readonly [Code, string, string, string]
    >[2];
    defaultSeverity: Extract<
      (typeof PUBLISHER_DIAGNOSTIC_DATA)[number],
      readonly [Code, string, string, string]
    >[3];
  }>;
};

const PUBLISHER_DIAGNOSTIC_BY_CODE = Object.freeze(
  Object.fromEntries(
    PUBLISHER_DIAGNOSTIC_DATA.map(([code, meaning, defaultStage, defaultSeverity]) => [
      code,
      Object.freeze({ code, meaning, defaultStage, defaultSeverity }),
    ]),
  ),
) as PublisherDiagnosticByCode;

/**
 * Frozen registry of project-owned Publisher diagnostics in stable declaration order.
 *
 * @remarks Core and Validator diagnostics retain their respective upstream registries. This
 * registry documents only codes introduced by the Publisher and does not authenticate arbitrary
 * caller-created objects.
 */
export const PUBLISHER_DIAGNOSTIC_REGISTRY: readonly PublisherDiagnosticDefinition[] =
  Object.freeze(PUBLISHER_DIAGNOSTIC_DATA.map(([code]) => PUBLISHER_DIAGNOSTIC_BY_CODE[code]));

/** Tests whether an unknown value is a Publisher-owned diagnostic code. */
export function isPublisherDiagnosticCode(value: unknown): value is PublisherDiagnosticCode {
  return typeof value === "string" && Object.hasOwn(PUBLISHER_DIAGNOSTIC_BY_CODE, value);
}

/**
 * Looks up immutable metadata for a possible Publisher-owned diagnostic code.
 *
 * @returns The stable definition, or `undefined` for core, Validator, and unknown codes.
 */
export function getPublisherDiagnosticDefinition(
  code: unknown,
): PublisherDiagnosticDefinition | undefined {
  return isPublisherDiagnosticCode(code) ? PUBLISHER_DIAGNOSTIC_BY_CODE[code] : undefined;
}

interface PublishDiagnosticMetadata<Severity extends PublishDiagnosticSeverity> {
  /** Required publication stage that observed the diagnostic. */
  readonly stage: PublishPipelineStage;
  /**
   * Publisher-local emission category.
   *
   * @remarks Severity is deliberately separate from Appendix B `classification`. A core
   * diagnostic retains its normative classification unchanged.
   */
  readonly severity: Severity;
}

/** A core Appendix B diagnostic annotated with its publication stage and severity. */
export type PublishCoreDiagnostic<
  Severity extends PublishDiagnosticSeverity = PublishDiagnosticSeverity,
> = Readonly<DesenCoreDiagnostic & PublishDiagnosticMetadata<Severity>>;

/** A documented namespaced diagnostic annotated with its publication stage and severity. */
export type PublishExtensionDiagnostic<
  Severity extends PublishDiagnosticSeverity = PublishDiagnosticSeverity,
> = Readonly<DesenDiagnostic<PublishExtensionDiagnosticCode> & PublishDiagnosticMetadata<Severity>>;

/** One immutable diagnostic in a publication report. */
export type PublishDiagnostic<
  Severity extends PublishDiagnosticSeverity = PublishDiagnosticSeverity,
> = PublishCoreDiagnostic<Severity> | PublishExtensionDiagnostic<Severity>;

/** A diagnostic that prevents publication and therefore cannot accompany a successful Bundle. */
export type PublishErrorDiagnostic = PublishDiagnostic<"error">;

/** A non-blocking diagnostic that may accompany a successfully published Bundle. */
export type PublishWarningDiagnostic = PublishDiagnostic<"warning">;

/**
 * Successful terminal publication.
 *
 * @remarks Only a recursively immutable, fully validated Bundle may cross this boundary. A
 * successful result can contain warnings but never an error diagnostic.
 */
export interface PublishSuccess {
  /** Discriminates a completed publication from a rejection. */
  readonly ok: true;
  /** Complete immutable DESEN Bundle produced by every required publication stage. */
  readonly bundle: ImmutableJson<DesenBundle>;
  /** Deterministically ordered non-blocking diagnostics. */
  readonly diagnostics: readonly PublishWarningDiagnostic[];
}

/**
 * Rejected terminal publication.
 *
 * @remarks The result deliberately has no `bundle` member. Its non-empty diagnostics begin with an
 * error, so unresolved correctness can never be mistaken for a successful or partially emitted
 * Bundle.
 */
export interface PublishFailure {
  /** Discriminates a rejection from a completed publication. */
  readonly ok: false;
  /** First required stage that could not prove publication correctness. */
  readonly stage: PublishPipelineStage;
  /** Non-empty, deterministic diagnostic report with a blocking error first. */
  readonly diagnostics: readonly [PublishErrorDiagnostic, ...PublishDiagnostic[]];
}

/**
 * Closed terminal result of DESEN Source-to-Bundle publication.
 *
 * @remarks M06-T01 establishes this contract before the full publisher entry point exists. Later
 * tasks may return the union only after either producing a fully validated immutable Bundle or
 * rejecting without any `bundle` property.
 */
export type PublishResult = PublishSuccess | PublishFailure;
