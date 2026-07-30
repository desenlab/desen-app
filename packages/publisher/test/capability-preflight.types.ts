import type {
  DesenPreparedSourceFoundation,
  DesenValidatedCatalogSet,
  DesenValidatedInteractionCatalogSet,
} from "@desen/validator";

import {
  preflightPublishCapabilities,
  type PublishCapabilityPreflightResult,
  type PublishCapabilityPreflightSuccess,
} from "../src/capability-preflight.js";
import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import type { PublishFailure, PublishWarningDiagnostic } from "../src/publish-result.js";
import type { PublishSourcePreflightLimits } from "../src/source-preflight.js";

declare const limits: PublishSourcePreflightLimits;
declare const result: PublishCapabilityPreflightResult;
declare const success: PublishCapabilityPreflightSuccess;
declare const failure: PublishFailure;
declare const source: DesenPreparedSourceFoundation;
declare const lowerCatalogSet: DesenValidatedCatalogSet;
declare const interactionCatalogSet: DesenValidatedInteractionCatalogSet;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const unknownInput: unknown;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<
    Equal<PublishCapabilityPreflightResult, PublishCapabilityPreflightSuccess | PublishFailure>
  >,
  Expect<Equal<PublishCapabilityPreflightSuccess["capabilityPreflighted"], true>>,
  Expect<Equal<PublishCapabilityPreflightSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<
    Equal<PublishCapabilityPreflightSuccess["catalogSet"], DesenValidatedInteractionCatalogSet>
  >,
  Expect<
    Equal<PublishCapabilityPreflightSuccess["packages"], readonly PublishResolvedCatalogPackage[]>
  >,
  Expect<Equal<PublishCapabilityPreflightSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<
    Equal<PublishCapabilityPreflightSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>
  >,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishCapabilityPreflightResult>(
  preflightPublishCapabilities(unknownInput, unknownInput, limits),
);
expectType<DesenPreparedSourceFoundation>(success.source);
expectType<DesenValidatedInteractionCatalogSet>(success.catalogSet);
expectType<PublishResolvedCatalogPackage | undefined>(success.packages[0]);
expectType<number | undefined>(success.requirementPackageIndexes[0]);
expectType<PublishWarningDiagnostic | undefined>(success.diagnostics[0]);
expectType(source);
expectType(interactionCatalogSet);
expectType(resolvedPackage);

// @ts-expect-error A lower-stage Catalog authority lacks private interaction-contract metadata.
expectType<DesenValidatedInteractionCatalogSet>(lowerCatalogSet);
// @ts-expect-error Capability preflight remains package-private, not a package-root operation.
await import("../src/index.js").then((publisher) => publisher.preflightPublishCapabilities);
// @ts-expect-error Capability-preflight success is immutable.
success.capabilityPreflighted = true;
// @ts-expect-error Prepared Source authority cannot be replaced.
success.source = source;
// @ts-expect-error Interaction Catalog authority is immutable.
success.catalogSet.push(success.catalogSet[0]);
// @ts-expect-error Selected package order is immutable.
success.packages.push(resolvedPackage);
// @ts-expect-error Requirement/package alignment is immutable.
success.requirementPackageIndexes[0] = 1;
// @ts-expect-error Warning diagnostics are immutable.
success.diagnostics.push(success.diagnostics[0]);
// @ts-expect-error A successful capability intermediate has no lower-stage discriminator.
void success.preflighted;
// @ts-expect-error A successful capability intermediate deliberately has no terminal discriminator.
void success.ok;
// @ts-expect-error A successful capability intermediate deliberately has no Bundle.
void success.bundle;
// @ts-expect-error Dynamic binding obligations belong to M06-T05.
void success.obligations;

if ("capabilityPreflighted" in result) {
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedInteractionCatalogSet;
  result.diagnostics satisfies readonly PublishWarningDiagnostic[];
  // @ts-expect-error The capability discriminator is immutable.
  result.capabilityPreflighted = true;
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

// @ts-expect-error The closed failure shell cannot be treated as capability authority.
expectType<PublishCapabilityPreflightSuccess>(failure);
