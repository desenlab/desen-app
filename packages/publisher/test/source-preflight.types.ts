import type { DesenSource } from "@desen/protocol";
import type {
  DesenPreparedSourceFoundation,
  DesenValidatedCatalogSet,
  ImmutableJson,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import type { PublishFailure } from "../src/publish-result.js";
import {
  preflightPublishSource,
  type PublishSourcePreflightLimits,
  type PublishSourcePreflightResult,
  type PublishSourcePreflightSuccess,
} from "../src/source-preflight.js";

declare const limits: PublishSourcePreflightLimits;
declare const result: PublishSourcePreflightResult;
declare const success: PublishSourcePreflightSuccess;
declare const failure: PublishFailure;
declare const preparedSource: DesenPreparedSourceFoundation;
declare const catalogSet: DesenValidatedCatalogSet;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const ordinarySource: ImmutableJson<DesenSource>;
declare const unknownInput: unknown;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<Equal<PublishSourcePreflightResult, PublishSourcePreflightSuccess | PublishFailure>>,
  Expect<Equal<PublishSourcePreflightSuccess["preflighted"], true>>,
  Expect<Equal<PublishSourcePreflightSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<Equal<PublishSourcePreflightSuccess["catalogSet"], DesenValidatedCatalogSet>>,
  Expect<
    Equal<PublishSourcePreflightSuccess["packages"], readonly PublishResolvedCatalogPackage[]>
  >,
  Expect<Equal<PublishSourcePreflightSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<Equal<PublishSourcePreflightSuccess["diagnostics"], readonly []>>,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishSourcePreflightResult>(preflightPublishSource("{}", unknownInput, limits));
expectType<DesenPreparedSourceFoundation>(success.source);
expectType<DesenValidatedCatalogSet>(success.catalogSet);
expectType<PublishResolvedCatalogPackage | undefined>(success.packages[0]);
expectType<number | undefined>(success.requirementPackageIndexes[0]);
expectType(preparedSource);
expectType(catalogSet);
expectType(resolvedPackage);

// @ts-expect-error A structurally identical Source cannot forge the private prepared authority.
expectType<DesenPreparedSourceFoundation>(ordinarySource);
// @ts-expect-error The finite Source-preflight profile is immutable.
limits.maxDiagnosticsPerStoppedStage = 0;
// @ts-expect-error Prepared Source data is recursively immutable.
success.source.id = "com.example.changed";
// @ts-expect-error The trusted Catalog set is immutable.
success.catalogSet.push(success.catalogSet[0]);
// @ts-expect-error Selected package order is immutable.
success.packages.push(resolvedPackage);
// @ts-expect-error Requirement/package alignment is immutable.
success.requirementPackageIndexes[0] = 1;
// @ts-expect-error A successful preflight intermediate deliberately has no terminal discriminator.
void success.ok;
// @ts-expect-error A successful preflight intermediate deliberately has no Bundle.
void success.bundle;

if ("preflighted" in result) {
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedCatalogSet;
  result.diagnostics satisfies readonly [];
  // @ts-expect-error The preflight discriminator is immutable.
  result.preflighted = true;
  // @ts-expect-error Successful Source authority cannot be replaced.
  result.source = preparedSource;
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
  // @ts-expect-error A failed preflight exposes no Bundle.
  void result.bundle;
}

// @ts-expect-error The closed failure shell cannot be treated as successful preflight authority.
expectType<PublishSourcePreflightSuccess>(failure);
