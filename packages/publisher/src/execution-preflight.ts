import { createJsonPointer } from "@desen/protocol";
import {
  validateDesenExecutionCatalogSet,
  validateDesenPreparedSourcePublicationContracts,
} from "@desen/validator";

import type { DesenDiagnostic } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenSemanticDiagnostic,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";

import {
  preflightPublishCapabilities,
  type PublishCapabilityPreflightResult,
  type PublishCapabilityPreflightSuccess,
} from "./capability-preflight.js";
import type { PublishResolvedCatalogPackage } from "./catalog-resolution.js";
import { annotatePublishErrorDiagnostic, createPublishFailure } from "./publish-diagnostics.js";
import type {
  PublishErrorDiagnostic,
  PublishFailure,
  PublishPipelineStage,
  PublishWarningDiagnostic,
} from "./publish-result.js";
import {
  PUBLISH_SOURCE_PREFLIGHT_LIMITS,
  normalizePublishSourcePreflightLimits,
  publishDiagnosticsExceedSourcePreflightLimits,
} from "./source-preflight.js";
import type { PublishSourcePreflightLimits } from "./source-preflight.js";

/** Package-private diagnostic for cumulative execution-preflight authority drift. */
export const EXECUTION_PREFLIGHT_AUTHORITY_INVALID_CODE =
  "run.desen.publisher/EXECUTION_PREFLIGHT_AUTHORITY_INVALID" as const;

/** Package-private diagnostic for finite execution-preflight report exhaustion. */
export const EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE =
  "run.desen.publisher/EXECUTION_PREFLIGHT_LIMIT_EXCEEDED" as const;

/** Finite report profile for the package-private M06-T05 publication boundary. */
export interface PublishExecutionPreflightLimits {
  /** Exact finite profile inherited by M06-T01 through M06-T04. */
  readonly sourcePreflight: Readonly<PublishSourcePreflightLimits>;
  /** Maximum complete runtime-validation obligations admitted to a successful intermediate. */
  readonly maxRuntimeValidationObligations: number;
  /** Maximum UTF-16 code units in one runtime-obligation JSON Pointer. */
  readonly maxRuntimeObligationPointerCodeUnits: number;
  /** Maximum aggregate obligation kind, pointer, and identity-context code units. */
  readonly maxAggregateRuntimeObligationCodeUnits: number;
}

/**
 * Default finite Publisher profile for static execution compatibility.
 *
 * @remarks The obligation count matches the Validator's per-schema graph ceiling. The aggregate
 * ceiling independently prevents a large set of long Source identities or pointers from crossing
 * this package boundary. A crossing rejects publication; obligations are never truncated.
 */
export const PUBLISH_EXECUTION_PREFLIGHT_LIMITS: Readonly<PublishExecutionPreflightLimits> =
  Object.freeze({
    sourcePreflight: PUBLISH_SOURCE_PREFLIGHT_LIMITS,
    maxRuntimeValidationObligations: 4_096,
    maxRuntimeObligationPointerCodeUnits: 4_096,
    maxAggregateRuntimeObligationCodeUnits: 1_048_576,
  });

/**
 * Complete nonterminal Source execution authority prepared for normalization and publication.
 *
 * @remarks Source, package selection, requirement alignment, Catalog identity, and warnings are
 * the exact M06-T04 authorities. The Catalog array additionally carries the Validator's private
 * execution-contract metadata. `obligations` is the complete bounded handoff for values or writes
 * that cannot be proved statically. This package-private intermediate has neither `ok` nor
 * `bundle`.
 */
export interface PublishExecutionPreflightSuccess {
  readonly executionPreflighted: true;
  readonly source: DesenPreparedSourceFoundation;
  readonly catalogSet: DesenValidatedExecutionCatalogSet;
  readonly packages: readonly PublishResolvedCatalogPackage[];
  readonly requirementPackageIndexes: readonly number[];
  readonly diagnostics: readonly PublishWarningDiagnostic[];
  readonly obligations: readonly DesenExecutionContractObligation[];
}

/** Execution preflight either prepares complete downstream authority or exposes no partials. */
export type PublishExecutionPreflightResult = PublishExecutionPreflightSuccess | PublishFailure;

const EXECUTION_LIMIT_KEYS = Object.freeze([
  "sourcePreflight",
  "maxRuntimeValidationObligations",
  "maxRuntimeObligationPointerCodeUnits",
  "maxAggregateRuntimeObligationCodeUnits",
] as const);
const EXECUTION_LIMIT_KEY_SET: ReadonlySet<string> = new Set(EXECUTION_LIMIT_KEYS);
const EXECUTION_OBLIGATION_KINDS = new Set<DesenExecutionContractObligation["kind"]>([
  "behavior-prop",
  "behavior-style-part-property",
  "component-command-input",
  "component-prop",
  "operation-input",
  "resource-input",
  "state-write",
  "style-part-property",
]);
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

function isCapabilityPreflightSuccess(
  result: PublishCapabilityPreflightResult,
): result is PublishCapabilityPreflightSuccess {
  return ownDataValue(result, "capabilityPreflighted") === true;
}

/**
 * Captures an exact own-data execution-preflight limit profile before Source observation.
 *
 * @internal Accessors, inherited values, symbols, extra keys, non-positive integers, and custom
 * prototypes are rejected. The nested M06-T03 profile is independently normalized by its owning
 * boundary.
 */
export function normalizePublishExecutionPreflightLimits(
  input: unknown,
): Readonly<PublishExecutionPreflightLimits> {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) throw new TypeError();
    if (!hasOrdinaryObjectPrototype(input)) throw new TypeError();
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== EXECUTION_LIMIT_KEYS.length ||
      keys.some((key) => typeof key !== "string" || !EXECUTION_LIMIT_KEY_SET.has(key))
    ) {
      throw new TypeError();
    }

    for (const key of EXECUTION_LIMIT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new TypeError();
      }
    }

    const sourcePreflight = normalizePublishSourcePreflightLimits(
      ownDataValue(input, "sourcePreflight"),
    );
    const maxRuntimeValidationObligations = ownDataValue<number>(
      input,
      "maxRuntimeValidationObligations",
    );
    const maxRuntimeObligationPointerCodeUnits = ownDataValue<number>(
      input,
      "maxRuntimeObligationPointerCodeUnits",
    );
    const maxAggregateRuntimeObligationCodeUnits = ownDataValue<number>(
      input,
      "maxAggregateRuntimeObligationCodeUnits",
    );
    for (const value of [
      maxRuntimeValidationObligations,
      maxRuntimeObligationPointerCodeUnits,
      maxAggregateRuntimeObligationCodeUnits,
    ]) {
      if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new TypeError();
    }

    return Object.freeze({
      sourcePreflight,
      maxRuntimeValidationObligations: maxRuntimeValidationObligations as number,
      maxRuntimeObligationPointerCodeUnits: maxRuntimeObligationPointerCodeUnits as number,
      maxAggregateRuntimeObligationCodeUnits: maxAggregateRuntimeObligationCodeUnits as number,
    });
  } catch {
    throw new TypeError(
      "Execution preflight limits must be an exact own-data finite positive-integer profile.",
    );
  }
}

function executionDiagnostic(
  code:
    | typeof EXECUTION_PREFLIGHT_AUTHORITY_INVALID_CODE
    | typeof EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
  message: string,
): Readonly<DesenDiagnostic<typeof code>> {
  return Object.freeze({ code, message, pointer: createJsonPointer() });
}

function executionAuthorityFailure(): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      executionDiagnostic(
        EXECUTION_PREFLIGHT_AUTHORITY_INVALID_CODE,
        "Execution preflight could not authenticate its cumulative publication authority.",
      ),
      "capability-contracts",
    ),
  ]);
}

function executionLimitFailure(stage: PublishPipelineStage): PublishFailure {
  return createPublishFailure([
    annotatePublishErrorDiagnostic(
      executionDiagnostic(
        EXECUTION_PREFLIGHT_LIMIT_EXCEEDED_CODE,
        "Execution preflight output exceeded the finite Publisher profile.",
      ),
      stage,
    ),
  ]);
}

function stoppedExecutionFailure(
  diagnostics: readonly DesenSemanticDiagnostic[],
  stage: PublishPipelineStage,
  limits: Readonly<PublishSourcePreflightLimits>,
): PublishFailure {
  const errors: PublishErrorDiagnostic[] = diagnostics.map((diagnostic) =>
    annotatePublishErrorDiagnostic(diagnostic, stage),
  );
  return publishDiagnosticsExceedSourcePreflightLimits(errors, limits)
    ? executionLimitFailure(stage)
    : createPublishFailure(errors);
}

function exactCapabilityAuthority(
  capability: PublishCapabilityPreflightSuccess,
  catalogSet: DesenValidatedExecutionCatalogSet,
): boolean {
  return (
    catalogSet === capability.catalogSet &&
    capability.packages.length === catalogSet.length &&
    capability.packages.every((entry, index) => entry.catalog === catalogSet[index]) &&
    capability.requirementPackageIndexes.every(
      (index) => Number.isSafeInteger(index) && index >= 0 && index < capability.packages.length,
    )
  );
}

function obligationCodeUnits(obligation: DesenExecutionContractObligation): number {
  const context = obligation.context;
  const subject = context.subject;
  return (
    obligation.kind.length +
    obligation.pointer.length +
    (context.documentId?.length ?? 0) +
    (context.surfaceId?.length ?? 0) +
    (subject?.kind.length ?? 0) +
    (subject?.id.length ?? 0) +
    (context.capabilityId?.length ?? 0)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareObligations(
  left: DesenExecutionContractObligation,
  right: DesenExecutionContractObligation,
): number {
  for (const [leftValue, rightValue] of [
    [left.pointer, right.pointer],
    [left.kind, right.kind],
    [left.context.documentId, right.context.documentId],
    [left.context.surfaceId, right.context.surfaceId],
    [left.context.subject?.kind, right.context.subject?.kind],
    [left.context.subject?.id, right.context.subject?.id],
    [left.context.capabilityId, right.context.capabilityId],
  ] as const) {
    const order = compareText(leftValue ?? "", rightValue ?? "");
    if (order !== 0) return order;
  }
  return 0;
}

function obligationsAreCompleteAndBounded(
  obligations: readonly DesenExecutionContractObligation[],
  limits: Readonly<PublishExecutionPreflightLimits>,
): boolean {
  if (obligations.length > limits.maxRuntimeValidationObligations) return false;

  let aggregateCodeUnits = 0;
  let prior: DesenExecutionContractObligation | undefined;
  for (const obligation of obligations) {
    if (
      !EXECUTION_OBLIGATION_KINDS.has(obligation.kind) ||
      obligation.pointer.length > limits.maxRuntimeObligationPointerCodeUnits
    ) {
      return false;
    }
    if (prior !== undefined && compareObligations(prior, obligation) >= 0) return false;
    prior = obligation;

    aggregateCodeUnits += obligationCodeUnits(obligation);
    if (aggregateCodeUnits > limits.maxAggregateRuntimeObligationCodeUnits) return false;
  }
  return true;
}

/**
 * Runs M06-T04 internally, then proves cumulative static execution compatibility.
 *
 * @internal Resource and operation schemas are prepared before Source state/control-flow checks.
 * One Validator walk preserves emission-site provenance across `capability-contracts`,
 * `state-and-control-flow`, and `binding-compatibility`; diagnostic codes and pointers are never
 * reinterpreted to guess a stage. Dynamic values are not resolved here. Their exact normalized
 * obligations cross only a complete, bounded success.
 */
export function preflightPublishExecution(
  rawSourceInput: unknown,
  catalogPackageCandidatesInput: unknown,
  limitInput: Readonly<PublishExecutionPreflightLimits> = PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
): PublishExecutionPreflightResult {
  const limits = normalizePublishExecutionPreflightLimits(limitInput);
  const capability = preflightPublishCapabilities(
    rawSourceInput,
    catalogPackageCandidatesInput,
    limits.sourcePreflight,
  );
  if (!isCapabilityPreflightSuccess(capability)) return capability;

  const executionCatalogs = validateDesenExecutionCatalogSet(capability.catalogSet);
  if (!executionCatalogs.valid) {
    return stoppedExecutionFailure(
      executionCatalogs.diagnostics,
      "capability-contracts",
      limits.sourcePreflight,
    );
  }
  if (!exactCapabilityAuthority(capability, executionCatalogs.value)) {
    return executionAuthorityFailure();
  }

  const sourceContracts = validateDesenPreparedSourcePublicationContracts(
    capability.source,
    executionCatalogs.value,
  );
  if (!sourceContracts.valid) {
    return stoppedExecutionFailure(
      sourceContracts.diagnostics,
      sourceContracts.phase,
      limits.sourcePreflight,
    );
  }
  if (sourceContracts.value !== capability.source) {
    return executionAuthorityFailure();
  }

  if (!obligationsAreCompleteAndBounded(sourceContracts.obligations, limits)) {
    return executionLimitFailure("binding-compatibility");
  }

  return Object.freeze({
    executionPreflighted: true,
    source: capability.source,
    catalogSet: executionCatalogs.value,
    packages: capability.packages,
    requirementPackageIndexes: capability.requirementPackageIndexes,
    diagnostics: capability.diagnostics,
    obligations: sourceContracts.obligations,
  });
}
