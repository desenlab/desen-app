import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
  DesenValidatedInteractionCatalogSet,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import {
  PUBLISH_EXECUTION_PREFLIGHT_LIMITS,
  preflightPublishExecution,
  type PublishExecutionPreflightLimits,
  type PublishExecutionPreflightResult,
  type PublishExecutionPreflightSuccess,
} from "../src/execution-preflight.js";
import type { PublishFailure, PublishWarningDiagnostic } from "../src/publish-result.js";

declare const limits: PublishExecutionPreflightLimits;
declare const result: PublishExecutionPreflightResult;
declare const success: PublishExecutionPreflightSuccess;
declare const failure: PublishFailure;
declare const source: DesenPreparedSourceFoundation;
declare const lowerCatalogSet: DesenValidatedInteractionCatalogSet;
declare const executionCatalogSet: DesenValidatedExecutionCatalogSet;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const obligation: DesenExecutionContractObligation;
declare const unknownInput: unknown;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<Equal<PublishExecutionPreflightResult, PublishExecutionPreflightSuccess | PublishFailure>>,
  Expect<Equal<PublishExecutionPreflightSuccess["executionPreflighted"], true>>,
  Expect<Equal<PublishExecutionPreflightSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<Equal<PublishExecutionPreflightSuccess["catalogSet"], DesenValidatedExecutionCatalogSet>>,
  Expect<
    Equal<PublishExecutionPreflightSuccess["packages"], readonly PublishResolvedCatalogPackage[]>
  >,
  Expect<Equal<PublishExecutionPreflightSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<
    Equal<PublishExecutionPreflightSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>
  >,
  Expect<
    Equal<
      PublishExecutionPreflightSuccess["obligations"],
      readonly DesenExecutionContractObligation[]
    >
  >,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishExecutionPreflightResult>(
  preflightPublishExecution(unknownInput, unknownInput, limits),
);
expectType<PublishExecutionPreflightLimits>(PUBLISH_EXECUTION_PREFLIGHT_LIMITS);
expectType<DesenPreparedSourceFoundation>(success.source);
expectType<DesenValidatedExecutionCatalogSet>(success.catalogSet);
expectType<PublishResolvedCatalogPackage | undefined>(success.packages[0]);
expectType<number | undefined>(success.requirementPackageIndexes[0]);
expectType<PublishWarningDiagnostic | undefined>(success.diagnostics[0]);
expectType<DesenExecutionContractObligation | undefined>(success.obligations[0]);
expectType(source);
expectType(executionCatalogSet);
expectType(resolvedPackage);
expectType(obligation);

// @ts-expect-error An interaction-only Catalog lacks private execution-contract metadata.
expectType<DesenValidatedExecutionCatalogSet>(lowerCatalogSet);
// @ts-expect-error Execution preflight remains package-private, not a package-root operation.
await import("../src/index.js").then((publisher) => publisher.preflightPublishExecution);
// @ts-expect-error Execution-preflight success is immutable.
success.executionPreflighted = true;
// @ts-expect-error Prepared Source authority cannot be replaced.
success.source = source;
// @ts-expect-error Execution Catalog authority is immutable.
success.catalogSet.push(success.catalogSet[0]);
// @ts-expect-error Selected package order is immutable.
success.packages.push(resolvedPackage);
// @ts-expect-error Requirement/package alignment is immutable.
success.requirementPackageIndexes[0] = 1;
// @ts-expect-error Warning diagnostics are immutable.
success.diagnostics.push(success.diagnostics[0]);
// @ts-expect-error Runtime obligations are immutable.
success.obligations.push(obligation);
// @ts-expect-error Runtime-obligation identity is immutable.
success.obligations[0].kind = "state-write";
// @ts-expect-error Runtime-obligation pointers are immutable.
success.obligations[0].pointer = "";
// @ts-expect-error Runtime-obligation context is immutable.
success.obligations[0].context.documentId = "changed";
// @ts-expect-error A successful execution intermediate has no T04 discriminator.
void success.capabilityPreflighted;
// @ts-expect-error A successful execution intermediate has no lower-stage discriminator.
void success.preflighted;
// @ts-expect-error A successful execution intermediate deliberately has no terminal discriminator.
void success.ok;
// @ts-expect-error A successful execution intermediate deliberately has no Bundle.
void success.bundle;
// @ts-expect-error Nested Source-preflight limits are immutable.
limits.sourcePreflight.maxDiagnosticsPerStoppedStage = 1;
// @ts-expect-error Runtime-obligation count limit is immutable.
limits.maxRuntimeValidationObligations = 1;
// @ts-expect-error Runtime-obligation pointer limit is immutable.
limits.maxRuntimeObligationPointerCodeUnits = 1;
// @ts-expect-error Runtime-obligation aggregate limit is immutable.
limits.maxAggregateRuntimeObligationCodeUnits = 1;

if ("executionPreflighted" in result) {
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedExecutionCatalogSet;
  result.diagnostics satisfies readonly PublishWarningDiagnostic[];
  result.obligations satisfies readonly DesenExecutionContractObligation[];
  // @ts-expect-error The execution discriminator is immutable.
  result.executionPreflighted = true;
} else {
  result satisfies PublishFailure;
  // @ts-expect-error A failed preflight exposes no prepared Source authority.
  void result.source;
  // @ts-expect-error A failed preflight exposes no trusted Catalog authority.
  void result.catalogSet;
  // @ts-expect-error A failed preflight exposes no selected package tuple.
  void result.packages;
  // @ts-expect-error A failed preflight exposes no requirement/package alignment.
  void result.requirementPackageIndexes;
  // @ts-expect-error A failed preflight exposes no obligations.
  void result.obligations;
  // @ts-expect-error A failed preflight exposes no Bundle.
  void result.bundle;
}

// @ts-expect-error The closed failure shell cannot be treated as execution authority.
expectType<PublishExecutionPreflightSuccess>(failure);
