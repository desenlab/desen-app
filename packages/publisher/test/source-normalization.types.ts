import type { DesenBundle } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
  ImmutableJson,
} from "@desen/validator";

import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import type {
  PublishExtensionDiagnosticCode,
  PublishFailure,
  PublishWarningDiagnostic,
} from "../src/publish-result.js";
import {
  PUBLISH_SOURCE_NORMALIZATION_LIMITS,
  preflightPublishSourceNormalization,
  type PublishNormalizedDocument,
  type PublishSourceNormalizationLimits,
  type PublishSourceNormalizationResult,
  type PublishSourceNormalizationSuccess,
} from "../src/source-normalization.js";
import type {
  PublishPreservedSourceDocument,
  PublishSourcePreservationSuccess,
  PublishSourceTraceability,
} from "../src/source-preservation.js";
// @ts-expect-error Source-normalization types remain absent from the package root.
import type { PublishSourceNormalizationSuccess as PublicSourceNormalizationSuccess } from "../src/index.js";

declare const limits: PublishSourceNormalizationLimits;
declare const result: PublishSourceNormalizationResult;
declare const success: PublishSourceNormalizationSuccess;
declare const failure: PublishFailure;
declare const preservationSuccess: PublishSourcePreservationSuccess;
declare const source: DesenPreparedSourceFoundation;
declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const warning: PublishWarningDiagnostic;
declare const obligation: DesenExecutionContractObligation;
declare const preservedDocument: Readonly<PublishPreservedSourceDocument>;
declare const traceability: Readonly<PublishSourceTraceability>;
declare const normalizedDocument: ImmutableJson<PublishNormalizedDocument>;
declare const bundle: ImmutableJson<DesenBundle>;
declare const unknownInput: unknown;
declare const publicSuccess: PublicSourceNormalizationSuccess;

type NormalizedSurface =
  PublishSourceNormalizationSuccess["normalizedDocument"]["surfaces"][string];
declare const normalizedNode: NormalizedSurface["root"];
declare const normalizedChildren: NonNullable<NormalizedSurface["root"]["slots"]>[string];
declare const normalizedExtensions: NonNullable<
  PublishSourceNormalizationSuccess["normalizedDocument"]["extensions"]
>;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<
    Equal<PublishSourceNormalizationResult, PublishSourceNormalizationSuccess | PublishFailure>
  >,
  Expect<Equal<PublishSourceNormalizationSuccess["sourceNormalized"], true>>,
  Expect<Equal<PublishSourceNormalizationSuccess["sourceDigest"], string>>,
  Expect<Equal<PublishSourceNormalizationSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<Equal<PublishSourceNormalizationSuccess["catalogSet"], DesenValidatedExecutionCatalogSet>>,
  Expect<
    Equal<PublishSourceNormalizationSuccess["packages"], readonly PublishResolvedCatalogPackage[]>
  >,
  Expect<Equal<PublishSourceNormalizationSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<
    Equal<PublishSourceNormalizationSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>
  >,
  Expect<
    Equal<
      PublishSourceNormalizationSuccess["obligations"],
      readonly DesenExecutionContractObligation[]
    >
  >,
  Expect<
    Equal<
      PublishSourceNormalizationSuccess["preservedDocument"],
      Readonly<PublishPreservedSourceDocument>
    >
  >,
  Expect<
    Equal<
      PublishSourceNormalizationSuccess["sourceCatalogRequirements"],
      DesenPreparedSourceFoundation["catalogs"]
    >
  >,
  Expect<
    Equal<PublishSourceNormalizationSuccess["traceability"], Readonly<PublishSourceTraceability>>
  >,
  Expect<
    Equal<
      PublishSourceNormalizationSuccess["normalizedDocument"],
      ImmutableJson<PublishNormalizedDocument>
    >
  >,
  Expect<Equal<PublishNormalizedDocument["kind"], "desen.bundle">>,
  Expect<
    Equal<
      Extract<
        PublishExtensionDiagnosticCode,
        "run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID"
      >,
      "run.desen.publisher/SOURCE_NORMALIZATION_AUTHORITY_INVALID"
    >
  >,
  Expect<
    Equal<
      Extract<
        PublishExtensionDiagnosticCode,
        "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED"
      >,
      "run.desen.publisher/SOURCE_NORMALIZATION_LIMIT_EXCEEDED"
    >
  >,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishSourceNormalizationResult>(
  preflightPublishSourceNormalization(unknownInput, unknownInput, limits),
);
expectType<PublishSourceNormalizationLimits>(PUBLISH_SOURCE_NORMALIZATION_LIMITS);
expectType<string>(success.sourceDigest);
expectType<DesenPreparedSourceFoundation>(success.source);
expectType<DesenValidatedExecutionCatalogSet>(success.catalogSet);
expectType<PublishResolvedCatalogPackage | undefined>(success.packages[0]);
expectType<number | undefined>(success.requirementPackageIndexes[0]);
expectType<PublishWarningDiagnostic | undefined>(success.diagnostics[0]);
expectType<DesenExecutionContractObligation | undefined>(success.obligations[0]);
expectType<Readonly<PublishPreservedSourceDocument>>(success.preservedDocument);
expectType<DesenPreparedSourceFoundation["catalogs"]>(success.sourceCatalogRequirements);
expectType<Readonly<PublishSourceTraceability>>(success.traceability);
expectType<ImmutableJson<PublishNormalizedDocument>>(success.normalizedDocument);
expectType<"desen.bundle">(success.normalizedDocument.kind);
expectType(source);
expectType(catalogSet);
expectType(resolvedPackage);
expectType(warning);
expectType(obligation);
expectType(preservedDocument);
expectType(traceability);
expectType(normalizedDocument);
expectType(bundle);
expectType(publicSuccess);

// @ts-expect-error An M06-T06 shell is not the M06-T07 normalization authority.
expectType<PublishSourceNormalizationSuccess>(preservationSuccess);
// @ts-expect-error An incomplete normalized document is not a terminal DESEN Bundle.
expectType<ImmutableJson<DesenBundle>>(success.normalizedDocument);
// @ts-expect-error Source normalization remains package-private, not a package-root operation.
await import("../src/index.js").then((publisher) => publisher.preflightPublishSourceNormalization);
// @ts-expect-error The normalization discriminator is immutable.
success.sourceNormalized = true;
// @ts-expect-error The calculated Source digest is immutable.
success.sourceDigest = "sha256:changed";
// @ts-expect-error Exact pre-normalization Source authority cannot be replaced.
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
// @ts-expect-error Source Catalog requirement order is immutable.
success.sourceCatalogRequirements.push(success.sourceCatalogRequirements[0]);
// @ts-expect-error Source Catalog discovery metadata remains immutable.
success.sourceCatalogRequirements[0].location = "changed";
// @ts-expect-error Traceability cannot be replaced.
success.traceability = traceability;
// @ts-expect-error Source-node trace order is immutable.
success.traceability.sourceNodes.push(success.traceability.sourceNodes[0]);
// @ts-expect-error The detached normalized document cannot be replaced.
success.normalizedDocument = normalizedDocument;
// @ts-expect-error Normalized document kind is immutable.
success.normalizedDocument.kind = "desen.bundle";
// @ts-expect-error Normalized document identity is immutable.
success.normalizedDocument.id = "changed";
// @ts-expect-error Normalized surface map is immutable.
success.normalizedDocument.surfaces = success.preservedDocument.surfaces;
// @ts-expect-error Normalized component nodes are recursively immutable.
normalizedNode.id = "changed";
// @ts-expect-error Normalized semantic arrays are immutable.
normalizedChildren.push(normalizedNode);
// @ts-expect-error Normalized extension JSON is recursively immutable.
normalizedExtensions["dev.desen.test/value"] = null;
// @ts-expect-error Root authoring is absent from the normalized production document.
void success.normalizedDocument.authoring;
// @ts-expect-error Loose Source Catalog requirements are absent from the normalized document.
void success.normalizedDocument.catalogs;
// @ts-expect-error Exact Catalog tuple authority remains unpinned.
void success.normalizedDocument.requires;
// @ts-expect-error The calculated Source digest remains outside the normalized document.
void success.normalizedDocument.sourceDigest;
// @ts-expect-error Bundle revision is not calculated by M06-T07.
void success.normalizedDocument.revision;
// @ts-expect-error Publication metadata is not attached by M06-T07.
void success.normalizedDocument.publication;
// @ts-expect-error Target selection is not embedded in the normalized production document.
void success.normalizedDocument.target;
// @ts-expect-error The T07 success has no lower M06-T06 discriminator.
void success.preservationPrepared;
// @ts-expect-error The T07 success has no lower M06-T05 discriminator.
void success.executionPreflighted;
// @ts-expect-error The T07 success has no terminal discriminator.
void success.ok;
// @ts-expect-error The nonterminal T07 success exposes no Bundle.
void success.bundle;
// @ts-expect-error No exact Catalog requirements are pinned by M06-T07.
void success.requires;
// @ts-expect-error No Bundle revision is calculated by M06-T07.
void success.revision;
// @ts-expect-error Nested Source-preservation limits are immutable.
limits.sourcePreservation.maxSourceNodeTraceEntries = 1;
// @ts-expect-error The normalized canonical-byte ceiling is immutable.
limits.maxNormalizedDocumentCanonicalBytes = 1;

if ("sourceNormalized" in result) {
  result.sourceDigest satisfies string;
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedExecutionCatalogSet;
  result.preservedDocument satisfies Readonly<PublishPreservedSourceDocument>;
  result.sourceCatalogRequirements satisfies DesenPreparedSourceFoundation["catalogs"];
  result.traceability satisfies Readonly<PublishSourceTraceability>;
  result.normalizedDocument satisfies ImmutableJson<PublishNormalizedDocument>;
  // @ts-expect-error The success discriminator remains immutable after narrowing.
  result.sourceNormalized = true;
} else {
  result satisfies PublishFailure;
  // @ts-expect-error A failed normalization exposes no Source authority.
  void result.source;
  // @ts-expect-error A failed normalization exposes no Catalog authority.
  void result.catalogSet;
  // @ts-expect-error A failed normalization exposes no selected packages.
  void result.packages;
  // @ts-expect-error A failed normalization exposes no requirement alignment.
  void result.requirementPackageIndexes;
  // @ts-expect-error A failed normalization exposes no runtime obligations.
  void result.obligations;
  // @ts-expect-error A failed normalization exposes no preserved projection.
  void result.preservedDocument;
  // @ts-expect-error A failed normalization exposes no Source Catalog requirements.
  void result.sourceCatalogRequirements;
  // @ts-expect-error A failed normalization exposes no traceability.
  void result.traceability;
  // @ts-expect-error A failed normalization exposes no normalized document.
  void result.normalizedDocument;
  // @ts-expect-error A failed normalization exposes no Source digest.
  void result.sourceDigest;
  // @ts-expect-error A failed normalization exposes no Bundle.
  void result.bundle;
}

// @ts-expect-error The closed failure shell cannot be treated as normalization authority.
expectType<PublishSourceNormalizationSuccess>(failure);
