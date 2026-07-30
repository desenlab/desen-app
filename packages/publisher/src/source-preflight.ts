import { createJsonPointer } from "@desen/protocol";
import {
  prepareDesenSourceFoundation,
  validatePreparedDesenSourceReferences,
} from "@desen/validator";

import { resolvePublishCatalogs } from "./catalog-resolution.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import { parseSourceJson } from "./source-json.js";

import type { DesenDiagnostic, DesenDiagnosticContext } from "@desen/protocol";
import type {
  DesenPreparedSourceFoundation,
  DesenSemanticDiagnostic,
  DesenValidatedCatalogSet,
} from "@desen/validator";
import type {
  PublishCatalogResolutionResult,
  PublishCatalogResolutionSuccess,
  PublishResolvedCatalogPackage,
} from "./catalog-resolution.js";
import type {
  PublishErrorDiagnostic,
  PublishDiagnostic,
  PublishFailure,
  PublishPipelineStage,
} from "./publish-result.js";

/** Package-private diagnostic for bounded Source-preflight report exhaustion. */
export const SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE =
  "run.desen.publisher/SOURCE_PREFLIGHT_LIMIT_EXCEEDED" as const;

/** Finite diagnostic-output profile for one stopped Source-preflight stage. */
export interface PublishSourcePreflightLimits {
  /** Maximum normalized diagnostics returned by one Source-preflight stage. */
  readonly maxDiagnosticsPerStoppedStage: number;
  /** Maximum UTF-16 code units in one diagnostic JSON Pointer. */
  readonly maxDiagnosticPointerCodeUnits: number;
  /** Maximum aggregate UTF-16 code units in diagnostic text and identity context. */
  readonly maxAggregateDiagnosticCodeUnits: number;
}

/** Default project-owned Source-preflight diagnostic limits. */
export const PUBLISH_SOURCE_PREFLIGHT_LIMITS: Readonly<PublishSourcePreflightLimits> =
  Object.freeze({
    maxDiagnosticsPerStoppedStage: 1_024,
    maxDiagnosticPointerCodeUnits: 4_096,
    maxAggregateDiagnosticCodeUnits: 1_048_576,
  });

/**
 * Complete nonterminal Source authority prepared for later publication stages.
 *
 * @remarks Every field is the exact immutable authority returned by the Validator or M06-T02.
 * Copying, serializing, or reconstructing these values does not reproduce their private runtime
 * brands. This intermediate is package-private and deliberately has neither `ok` nor `bundle`.
 */
export interface PublishSourcePreflightSuccess {
  readonly preflighted: true;
  readonly source: DesenPreparedSourceFoundation;
  readonly catalogSet: DesenValidatedCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly [];
}

/** Source preflight either prepares complete downstream authority or exposes no partial value. */
export type PublishSourcePreflightResult = PublishSourcePreflightSuccess | PublishFailure;

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const PREFLIGHT_LIMIT_KEYS = Object.freeze([
  "maxDiagnosticsPerStoppedStage",
  "maxDiagnosticPointerCodeUnits",
  "maxAggregateDiagnosticCodeUnits",
] as const);
const PREFLIGHT_LIMIT_KEY_SET: ReadonlySet<string> = new Set(PREFLIGHT_LIMIT_KEYS);
const FUNCTION_TO_STRING = Function.prototype.toString;
const NATIVE_OBJECT_CONSTRUCTOR_SOURCE = Reflect.apply(FUNCTION_TO_STRING, Object, []);

function hasOrdinaryObjectPrototype(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype === null) return true;
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
  return (
    Object.getPrototypeOf(prototype) === null &&
    constructor !== undefined &&
    "value" in constructor &&
    typeof constructor.value === "function" &&
    Reflect.apply(FUNCTION_TO_STRING, constructor.value, []) === NATIVE_OBJECT_CONSTRUCTOR_SOURCE
  );
}

function ownDataValue<Value>(object: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && "value" in descriptor
    ? (descriptor.value as Value)
    : undefined;
}

function isCatalogResolutionSuccess(
  result: PublishCatalogResolutionResult,
): result is PublishCatalogResolutionSuccess {
  return ownDataValue(result, "resolved") === true;
}

/**
 * Captures the exact finite diagnostic profile shared by package-private preflight stages.
 *
 * @internal This helper is not exported from the package root. It rejects inherited properties,
 * accessors, symbols, extra keys, and non-positive or unsafe integers before Source observation.
 */
export function normalizePublishSourcePreflightLimits(
  input: unknown,
): Readonly<PublishSourcePreflightLimits> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError();
    if (!hasOrdinaryObjectPrototype(input)) throw new TypeError();
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== PREFLIGHT_LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !PREFLIGHT_LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }

    const values: Record<string, number> = Object.create(null) as Record<string, number>;
    for (const key of PREFLIGHT_LIMIT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        !Number.isSafeInteger(descriptor.value) ||
        descriptor.value <= 0
      ) {
        throw new TypeError();
      }
      values[key] = descriptor.value;
    }
    return Object.freeze({
      maxDiagnosticsPerStoppedStage: values.maxDiagnosticsPerStoppedStage as number,
      maxDiagnosticPointerCodeUnits: values.maxDiagnosticPointerCodeUnits as number,
      maxAggregateDiagnosticCodeUnits: values.maxAggregateDiagnosticCodeUnits as number,
    });
  } catch {
    throw new TypeError(
      "Source preflight limits must be an exact own-data positive-integer profile.",
    );
  }
}

/**
 * Counts the exact diagnostic and identity-context code units charged by the preflight profile.
 *
 * @internal Later package-private stages use this primitive to maintain linear-time incremental
 * budgets while preserving the same accounting as whole-report validation.
 */
export function publishDiagnosticCodeUnits(
  diagnostic: DesenSemanticDiagnostic | PublishDiagnostic,
): number {
  const pointer = ownDataValue<string>(diagnostic, "pointer");
  const context = ownDataValue<Readonly<DesenDiagnosticContext>>(diagnostic, "context");
  const subject =
    context === undefined
      ? undefined
      : ownDataValue<NonNullable<DesenDiagnosticContext["subject"]>>(context, "subject");
  return (
    diagnostic.code.length +
    diagnostic.message.length +
    (pointer?.length ?? 0) +
    (ownDataValue<string>(context ?? {}, "documentId")?.length ?? 0) +
    (ownDataValue<string>(context ?? {}, "surfaceId")?.length ?? 0) +
    (ownDataValue<string>(subject ?? {}, "kind")?.length ?? 0) +
    (ownDataValue<string>(subject ?? {}, "id")?.length ?? 0) +
    (ownDataValue<string>(context ?? {}, "capabilityId")?.length ?? 0)
  );
}

function preflightLimitFailure(stage: PublishPipelineStage): PublishFailure {
  const diagnostic = Object.freeze({
    code: SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE,
    message: "Source preflight diagnostics exceeded the finite Publisher profile.",
    pointer: createJsonPointer(),
  }) satisfies Readonly<DesenDiagnostic<typeof SOURCE_PREFLIGHT_LIMIT_EXCEEDED_CODE>>;
  return createPublishFailure([annotatePublishErrorDiagnostic(diagnostic, stage)]);
}

/**
 * Tests one normalized diagnostic report against the common Source-preflight output ceiling.
 *
 * @internal Callers must replace an over-budget report with one redacted same-stage error rather
 * than truncate it or expose a partial authority.
 */
export function publishDiagnosticsExceedSourcePreflightLimits(
  diagnostics: readonly (DesenSemanticDiagnostic | PublishDiagnostic)[],
  limits: Readonly<PublishSourcePreflightLimits>,
): boolean {
  if (
    diagnostics.length > limits.maxDiagnosticsPerStoppedStage ||
    diagnostics.some(
      (diagnostic) =>
        (ownDataValue<string>(diagnostic, "pointer")?.length ?? 0) >
        limits.maxDiagnosticPointerCodeUnits,
    )
  ) {
    return true;
  }

  let aggregateCodeUnits = 0;
  for (const diagnostic of diagnostics) {
    aggregateCodeUnits += publishDiagnosticCodeUnits(diagnostic);
    if (aggregateCodeUnits > limits.maxAggregateDiagnosticCodeUnits) {
      return true;
    }
  }
  return false;
}

function boundedExistingFailure(
  failure: PublishFailure,
  limits: Readonly<PublishSourcePreflightLimits>,
): PublishFailure {
  return publishDiagnosticsExceedSourcePreflightLimits(failure.diagnostics, limits)
    ? preflightLimitFailure(failure.stage)
    : failure;
}

function stoppedStageFailure(
  stage: PublishPipelineStage,
  diagnostics: readonly DesenSemanticDiagnostic[],
  limits: Readonly<PublishSourcePreflightLimits>,
): PublishFailure {
  if (publishDiagnosticsExceedSourcePreflightLimits(diagnostics, limits)) {
    return preflightLimitFailure(stage);
  }

  const annotated: PublishErrorDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    annotated.push(annotatePublishErrorDiagnostic(diagnostic, stage));
  }
  return createPublishFailure(annotated);
}

function sourceFoundationStage(
  phase: "embedded-schema" | "identity" | "root-schema",
): PublishPipelineStage {
  switch (phase) {
    case "root-schema":
      return "source-schema";
    case "embedded-schema":
      return "embedded-schema";
    case "identity":
      return "source-semantics";
  }
}

/**
 * Runs strict Source ingress, phased Source validation, exact Catalog authority, and static refs.
 *
 * @internal Candidate packages remain completely unobserved until root, embedded-schema, and
 * intrinsic identity checks succeed. Catalog-backed reference existence is necessarily finalized
 * only after the Catalog authority is structurally valid, digest-consistent, and namespace-clean.
 * Any failure returns the closed M06-T01 shell without Source, Catalog, package, alignment, or
 * Bundle partials.
 */
export function preflightPublishSource(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishSourcePreflightLimits> = PUBLISH_SOURCE_PREFLIGHT_LIMITS,
): PublishSourcePreflightResult {
  const limits = normalizePublishSourcePreflightLimits(limitInput);
  const parsed = parseSourceJson(rawSourceInput);
  if (!parsed.ok) return boundedExistingFailure(parsed, limits);

  const foundation = prepareDesenSourceFoundation(parsed.value);
  if (!foundation.valid) {
    return stoppedStageFailure(
      sourceFoundationStage(foundation.phase),
      foundation.diagnostics,
      limits,
    );
  }

  const resolution = resolvePublishCatalogs(
    foundation.value.catalogs,
    catalogPackageCandidatesInput,
    foundation.value.id,
  );
  if (!isCatalogResolutionSuccess(resolution)) return boundedExistingFailure(resolution, limits);

  const references = validatePreparedDesenSourceReferences(foundation.value, resolution.catalogSet);
  if (!references.valid) {
    return stoppedStageFailure("source-semantics", references.diagnostics, limits);
  }

  return Object.freeze({
    preflighted: true,
    source: foundation.value,
    catalogSet: resolution.catalogSet,
    packages: resolution.packages,
    requirementPackageIndexes: resolution.requirementPackageIndexes,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
