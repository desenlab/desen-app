import type { JsonPointer } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import type {
  PublishExecutionPreflightSuccess,
  PublishExecutionPreflightLimits,
} from "../src/execution-preflight.js";
import {
  PUBLISH_SOURCE_PRESERVATION_LIMITS,
  preflightPublishSourcePreservation,
  type PublishPreservedSourceDocument,
  type PublishSourceNodeTraceEntry,
  type PublishSourcePreservationLimits,
  type PublishSourcePreservationResult,
  type PublishSourcePreservationSuccess,
  type PublishSourceTraceability,
} from "../src/source-preservation.js";
import type {
  PublishExtensionDiagnosticCode,
  PublishFailure,
  PublishWarningDiagnostic,
} from "../src/publish-result.js";
// @ts-expect-error Source-preservation types remain absent from the package root.
import type { PublishSourcePreservationSuccess as PublicPublishSourcePreservationSuccess } from "../src/index.js";

declare const limits: PublishSourcePreservationLimits;
declare const result: PublishSourcePreservationResult;
declare const success: PublishSourcePreservationSuccess;
declare const failure: PublishFailure;
declare const executionSuccess: PublishExecutionPreflightSuccess;
declare const executionLimits: PublishExecutionPreflightLimits;
declare const source: DesenPreparedSourceFoundation;
declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const obligation: DesenExecutionContractObligation;
declare const warning: PublishWarningDiagnostic;
declare const traceEntry: PublishSourceNodeTraceEntry;
declare const preservedDocument: Readonly<PublishPreservedSourceDocument>;
declare const traceability: Readonly<PublishSourceTraceability>;
declare const unknownInput: unknown;
declare const publicSuccess: PublicPublishSourcePreservationSuccess;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<Equal<PublishSourcePreservationResult, PublishSourcePreservationSuccess | PublishFailure>>,
  Expect<Equal<PublishSourcePreservationSuccess["preservationPrepared"], true>>,
  Expect<Equal<PublishSourcePreservationSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<Equal<PublishSourcePreservationSuccess["catalogSet"], DesenValidatedExecutionCatalogSet>>,
  Expect<
    Equal<PublishSourcePreservationSuccess["packages"], readonly PublishResolvedCatalogPackage[]>
  >,
  Expect<Equal<PublishSourcePreservationSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<
    Equal<PublishSourcePreservationSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>
  >,
  Expect<
    Equal<
      PublishSourcePreservationSuccess["obligations"],
      readonly DesenExecutionContractObligation[]
    >
  >,
  Expect<
    Equal<
      PublishSourcePreservationSuccess["preservedDocument"],
      Readonly<PublishPreservedSourceDocument>
    >
  >,
  Expect<
    Equal<
      PublishSourcePreservationSuccess["sourceCatalogRequirements"],
      DesenPreparedSourceFoundation["catalogs"]
    >
  >,
  Expect<
    Equal<PublishSourcePreservationSuccess["traceability"], Readonly<PublishSourceTraceability>>
  >,
  Expect<Equal<PublishSourceTraceability["strategy"], "unchanged-node-identifiers">>,
  Expect<Equal<PublishSourceTraceability["sourceNodes"], readonly PublishSourceNodeTraceEntry[]>>,
  Expect<Equal<PublishSourceNodeTraceEntry["sourcePointer"], JsonPointer>>,
  Expect<
    Equal<
      Extract<
        PublishExtensionDiagnosticCode,
        "run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID"
      >,
      "run.desen.publisher/SOURCE_PRESERVATION_AUTHORITY_INVALID"
    >
  >,
  Expect<
    Equal<
      Extract<
        PublishExtensionDiagnosticCode,
        "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED"
      >,
      "run.desen.publisher/SOURCE_PRESERVATION_LIMIT_EXCEEDED"
    >
  >,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishSourcePreservationResult>(
  preflightPublishSourcePreservation(unknownInput, unknownInput, limits),
);
expectType<PublishSourcePreservationLimits>(PUBLISH_SOURCE_PRESERVATION_LIMITS);
expectType<DesenPreparedSourceFoundation>(success.source);
expectType<DesenValidatedExecutionCatalogSet>(success.catalogSet);
expectType<PublishResolvedCatalogPackage | undefined>(success.packages[0]);
expectType<number | undefined>(success.requirementPackageIndexes[0]);
expectType<PublishWarningDiagnostic | undefined>(success.diagnostics[0]);
expectType<DesenExecutionContractObligation | undefined>(success.obligations[0]);
expectType<DesenPreparedSourceFoundation["catalogs"]>(success.sourceCatalogRequirements);
expectType<Readonly<PublishPreservedSourceDocument>>(success.preservedDocument);
expectType<Readonly<PublishSourceTraceability>>(success.traceability);
expectType<PublishSourceNodeTraceEntry | undefined>(success.traceability.sourceNodes[0]);
expectType<JsonPointer>(traceEntry.sourcePointer);
expectType(source);
expectType(catalogSet);
expectType(resolvedPackage);
expectType(obligation);
expectType(warning);
expectType(executionLimits);
expectType(publicSuccess);

// @ts-expect-error An M06-T05 shell is not the M06-T06 preservation authority.
expectType<PublishSourcePreservationSuccess>(executionSuccess);
// @ts-expect-error Source preservation remains package-private, not a package-root operation.
await import("../src/index.js").then((publisher) => publisher.preflightPublishSourcePreservation);
// @ts-expect-error The preservation discriminator is immutable.
success.preservationPrepared = true;
// @ts-expect-error Exact Source authority cannot be replaced.
success.source = source;
// @ts-expect-error Execution Catalog authority is immutable.
success.catalogSet.push(success.catalogSet[0]);
// @ts-expect-error Selected package order is immutable.
success.packages.push(resolvedPackage);
// @ts-expect-error Requirement/package alignment is immutable.
success.requirementPackageIndexes[0] = 1;
// @ts-expect-error Warning diagnostics are immutable.
success.diagnostics.push(warning);
// @ts-expect-error Runtime obligations are immutable.
success.obligations.push(obligation);
// @ts-expect-error The preserved projection cannot be replaced.
success.preservedDocument = preservedDocument;
// @ts-expect-error Preserved document identity is immutable.
success.preservedDocument.id = "changed";
// @ts-expect-error Preserved surfaces are immutable.
success.preservedDocument.surfaces = success.source.surfaces;
// @ts-expect-error Nested preserved nodes remain immutable.
success.preservedDocument.surfaces[success.preservedDocument.entry].root.id = "changed";
// @ts-expect-error Authoring is intentionally absent from the production-field projection.
void success.preservedDocument.authoring;
// @ts-expect-error Source Catalog requirements remain separate from the projection.
void success.preservedDocument.catalogs;
// @ts-expect-error Source kind is not copied into the preserved production-field projection.
void success.preservedDocument.kind;
// @ts-expect-error Source requirement order is immutable.
success.sourceCatalogRequirements.push(success.sourceCatalogRequirements[0]);
// @ts-expect-error A Source Catalog discovery hint cannot be rewritten.
success.sourceCatalogRequirements[0].location = "changed";
// @ts-expect-error Traceability cannot be replaced.
success.traceability = traceability;
// @ts-expect-error The trace strategy is immutable and closed.
success.traceability.strategy = "changed";
// @ts-expect-error Source-node trace order is immutable.
success.traceability.sourceNodes.push(traceEntry);
// @ts-expect-error A trace entry is immutable.
success.traceability.sourceNodes[0].sourceNodeId = "changed";
// @ts-expect-error Component-node entries do not fabricate behavior identity.
void success.traceability.sourceNodes[0].behaviorId;
// @ts-expect-error A preservation success has no lower M06-T05 discriminator.
void success.executionPreflighted;
// @ts-expect-error A preservation success has no lower M06-T04 discriminator.
void success.capabilityPreflighted;
// @ts-expect-error A preservation success has no lower M06-T03 discriminator.
void success.preflighted;
// @ts-expect-error A nonterminal preservation success has no terminal discriminator.
void success.ok;
// @ts-expect-error A nonterminal preservation success has no Bundle.
void success.bundle;
// @ts-expect-error No Source digest is calculated by M06-T06.
void success.sourceDigest;
// @ts-expect-error No Bundle revision is calculated by M06-T06.
void success.revision;
// @ts-expect-error Nested execution limits are immutable.
limits.executionPreflight.maxRuntimeValidationObligations = 1;
// @ts-expect-error Source-node count limit is immutable.
limits.maxSourceNodeTraceEntries = 1;
// @ts-expect-error Source-node pointer limit is immutable.
limits.maxSourceNodePointerCodeUnits = 1;
// @ts-expect-error Source-node aggregate limit is immutable.
limits.maxAggregateSourceNodeTraceCodeUnits = 1;

if ("preservationPrepared" in result) {
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedExecutionCatalogSet;
  result.preservedDocument satisfies Readonly<PublishPreservedSourceDocument>;
  result.sourceCatalogRequirements satisfies DesenPreparedSourceFoundation["catalogs"];
  result.traceability satisfies Readonly<PublishSourceTraceability>;
  // @ts-expect-error The preservation discriminator remains immutable after narrowing.
  result.preservationPrepared = true;
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
  // @ts-expect-error A failed preflight exposes no preserved Source projection.
  void result.preservedDocument;
  // @ts-expect-error A failed preflight exposes no Source Catalog requirements.
  void result.sourceCatalogRequirements;
  // @ts-expect-error A failed preflight exposes no source-node trace.
  void result.traceability;
  // @ts-expect-error A failed preflight exposes no Bundle.
  void result.bundle;
}

// @ts-expect-error The closed failure shell cannot be treated as preservation authority.
expectType<PublishSourcePreservationSuccess>(failure);
