import type { DesenBundle } from "@desen/protocol";
import type {
  DesenExecutionContractObligation,
  DesenPreparedSourceFoundation,
  DesenValidatedExecutionCatalogSet,
  ImmutableJson,
} from "@desen/validator";

import {
  preflightPublishCatalogPinning,
  type PublishCatalogPinnedDocument,
  type PublishCatalogPinningResult,
  type PublishCatalogPinningSuccess,
  type PublishPinnedCatalogRequirement,
} from "../src/catalog-pinning.js";
import type { PublishResolvedCatalogPackage } from "../src/catalog-resolution.js";
import type { PublishFailure, PublishWarningDiagnostic } from "../src/publish-result.js";
import type {
  PublishNormalizedDocument,
  PublishSourceNormalizationLimits,
  PublishSourceNormalizationSuccess,
} from "../src/source-normalization.js";
import type {
  PublishPreservedSourceDocument,
  PublishSourceTraceability,
} from "../src/source-preservation.js";
// @ts-expect-error Catalog-pinning types remain absent from the package root.
import type { PublishCatalogPinningSuccess as PublicCatalogPinningSuccess } from "../src/index.js";

declare const limits: PublishSourceNormalizationLimits;
declare const result: PublishCatalogPinningResult;
declare const success: PublishCatalogPinningSuccess;
declare const failure: PublishFailure;
declare const normalizationSuccess: PublishSourceNormalizationSuccess;
declare const source: DesenPreparedSourceFoundation;
declare const catalogSet: DesenValidatedExecutionCatalogSet;
declare const selectedPackage: PublishResolvedCatalogPackage;
declare const warning: PublishWarningDiagnostic;
declare const obligation: DesenExecutionContractObligation;
declare const preservedDocument: Readonly<PublishPreservedSourceDocument>;
declare const traceability: Readonly<PublishSourceTraceability>;
declare const normalizedDocument: ImmutableJson<PublishNormalizedDocument>;
declare const pinnedDocument: ImmutableJson<PublishCatalogPinnedDocument>;
declare const exactRequirement: PublishPinnedCatalogRequirement;
declare const bundle: ImmutableJson<DesenBundle>;
declare const unknownInput: unknown;
declare const publicSuccess: PublicCatalogPinningSuccess;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;

type Expect<Condition extends true> = Condition;

type PinnedCatalog = PublishCatalogPinningSuccess["pinnedDocument"]["requires"]["catalogs"][number];
type PinnedSurface = PublishCatalogPinningSuccess["pinnedDocument"]["surfaces"][string];
type PinnedExtensions = NonNullable<PublishPinnedCatalogRequirement["extensions"]>;

declare const pinnedCatalog: PinnedCatalog;
declare const pinnedNode: PinnedSurface["root"];
declare const pinnedChildren: NonNullable<PinnedSurface["root"]["slots"]>[string];
declare const pinnedExtensions: PinnedExtensions;

declare const contractAssertions: readonly [
  Expect<Equal<PublishCatalogPinningResult, PublishCatalogPinningSuccess | PublishFailure>>,
  Expect<Equal<PublishCatalogPinningSuccess["catalogsPinned"], true>>,
  Expect<Equal<PublishCatalogPinningSuccess["sourceDigest"], string>>,
  Expect<Equal<PublishCatalogPinningSuccess["source"], DesenPreparedSourceFoundation>>,
  Expect<Equal<PublishCatalogPinningSuccess["catalogSet"], DesenValidatedExecutionCatalogSet>>,
  Expect<Equal<PublishCatalogPinningSuccess["packages"], readonly PublishResolvedCatalogPackage[]>>,
  Expect<Equal<PublishCatalogPinningSuccess["requirementPackageIndexes"], readonly number[]>>,
  Expect<Equal<PublishCatalogPinningSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>>,
  Expect<
    Equal<PublishCatalogPinningSuccess["obligations"], readonly DesenExecutionContractObligation[]>
  >,
  Expect<
    Equal<
      PublishCatalogPinningSuccess["preservedDocument"],
      Readonly<PublishPreservedSourceDocument>
    >
  >,
  Expect<
    Equal<
      PublishCatalogPinningSuccess["sourceCatalogRequirements"],
      DesenPreparedSourceFoundation["catalogs"]
    >
  >,
  Expect<Equal<PublishCatalogPinningSuccess["traceability"], Readonly<PublishSourceTraceability>>>,
  Expect<
    Equal<
      PublishCatalogPinningSuccess["normalizedDocument"],
      ImmutableJson<PublishNormalizedDocument>
    >
  >,
  Expect<
    Equal<
      PublishCatalogPinningSuccess["pinnedDocument"],
      ImmutableJson<PublishCatalogPinnedDocument>
    >
  >,
  Expect<Equal<PublishCatalogPinnedDocument["kind"], "desen.bundle">>,
  Expect<Equal<PublishPinnedCatalogRequirement["target"], string>>,
  Expect<Equal<PublishPinnedCatalogRequirement["digest"], string>>,
  Expect<Equal<PinnedCatalog, ImmutableJson<PublishPinnedCatalogRequirement>>>,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishCatalogPinningResult>(
  preflightPublishCatalogPinning(unknownInput, unknownInput, limits),
);
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
expectType<ImmutableJson<PublishCatalogPinnedDocument>>(success.pinnedDocument);
expectType<readonly ImmutableJson<PublishPinnedCatalogRequirement>[]>(
  success.pinnedDocument.requires.catalogs,
);
expectType<string>(pinnedCatalog.id);
expectType<string>(pinnedCatalog.version);
expectType<string>(pinnedCatalog.target);
expectType<string>(pinnedCatalog.digest);
expectType(source);
expectType(catalogSet);
expectType(selectedPackage);
expectType(warning);
expectType(obligation);
expectType(preservedDocument);
expectType(traceability);
expectType(normalizedDocument);
expectType(pinnedDocument);
expectType(exactRequirement);
expectType(bundle);
expectType(publicSuccess);

// @ts-expect-error An M06-T07 authority is not an M06-T08 Catalog-pinning authority.
expectType<PublishCatalogPinningSuccess>(normalizationSuccess);
// @ts-expect-error The nonterminal pinned document has no revision and is not a DESEN Bundle.
expectType<ImmutableJson<DesenBundle>>(success.pinnedDocument);
// @ts-expect-error Catalog pinning remains package-private, not a package-root operation.
await import("../src/index.js").then((publisher) => publisher.preflightPublishCatalogPinning);
// @ts-expect-error The success discriminator is immutable.
success.catalogsPinned = true;
// @ts-expect-error The authenticated Source digest is immutable.
success.sourceDigest = `sha256:${"0".repeat(64)}`;
// @ts-expect-error Exact Source authority cannot be replaced.
success.source = source;
// @ts-expect-error Execution Catalog authority is immutable.
success.catalogSet.push(success.catalogSet[0]);
// @ts-expect-error Selected package order is immutable.
success.packages.push(selectedPackage);
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
// @ts-expect-error Source discovery metadata remains immutable.
success.sourceCatalogRequirements[0].location = "changed";
// @ts-expect-error Traceability cannot be replaced.
success.traceability = traceability;
// @ts-expect-error Source-node trace order is immutable.
success.traceability.sourceNodes.push(success.traceability.sourceNodes[0]);
// @ts-expect-error The normalized predecessor cannot be replaced.
success.normalizedDocument = normalizedDocument;
// @ts-expect-error The pinned production document cannot be replaced.
success.pinnedDocument = pinnedDocument;
// @ts-expect-error The carried digest inside the document is immutable.
success.pinnedDocument.sourceDigest = `sha256:${"1".repeat(64)}`;
// @ts-expect-error Exact Catalog requirement order is immutable.
success.pinnedDocument.requires.catalogs.push(pinnedCatalog);
// @ts-expect-error Exact target is required and immutable.
pinnedCatalog.target = "changed";
// @ts-expect-error Exact digest is required and immutable.
pinnedCatalog.digest = `sha256:${"2".repeat(64)}`;
// @ts-expect-error Requirement extensions remain recursively immutable.
pinnedExtensions["dev.desen.test/value"] = null;
// @ts-expect-error Pinned component nodes remain recursively immutable.
pinnedNode.id = "changed";
// @ts-expect-error Pinned semantic arrays remain recursively immutable.
pinnedChildren.push(pinnedNode);
// @ts-expect-error Source discovery location never enters an exact Bundle requirement.
void pinnedCatalog.location;
// @ts-expect-error Loose Source Catalog requirements are absent from the pinned document.
void success.pinnedDocument.catalogs;
// @ts-expect-error Authoring data is absent from the pinned document.
void success.pinnedDocument.authoring;
// @ts-expect-error Bundle revision remains uncalculated at T08.
void success.pinnedDocument.revision;
// @ts-expect-error Publication metadata remains absent at T08.
void success.pinnedDocument.publication;
// @ts-expect-error T08 does not retain the lower T07 success discriminator.
void success.sourceNormalized;
// @ts-expect-error T08 has no terminal discriminator.
void success.ok;
// @ts-expect-error T08 emits no terminal Bundle.
void success.bundle;
// @ts-expect-error T08 calculates no standalone revision.
void success.revision;
// @ts-expect-error T08 attaches no publication metadata.
void success.publication;

if ("catalogsPinned" in result) {
  result.sourceDigest satisfies string;
  result.source satisfies DesenPreparedSourceFoundation;
  result.catalogSet satisfies DesenValidatedExecutionCatalogSet;
  result.pinnedDocument satisfies ImmutableJson<PublishCatalogPinnedDocument>;
  result.pinnedDocument.requires
    .catalogs satisfies readonly ImmutableJson<PublishPinnedCatalogRequirement>[];
  // @ts-expect-error The narrowed success discriminator remains immutable.
  result.catalogsPinned = true;
} else {
  result satisfies PublishFailure;
  // @ts-expect-error A failed pinning exposes no Source authority.
  void result.source;
  // @ts-expect-error A failed pinning exposes no Catalog authority.
  void result.catalogSet;
  // @ts-expect-error A failed pinning exposes no selected packages.
  void result.packages;
  // @ts-expect-error A failed pinning exposes no positional alignment.
  void result.requirementPackageIndexes;
  // @ts-expect-error A failed pinning exposes no warnings.
  void result.warningDiagnostics;
  // @ts-expect-error A failed pinning exposes no runtime obligations.
  void result.obligations;
  // @ts-expect-error A failed pinning exposes no preserved Source projection.
  void result.preservedDocument;
  // @ts-expect-error A failed pinning exposes no loose Source requirements.
  void result.sourceCatalogRequirements;
  // @ts-expect-error A failed pinning exposes no traceability authority.
  void result.traceability;
  // @ts-expect-error A failed pinning exposes no normalized predecessor.
  void result.normalizedDocument;
  // @ts-expect-error A failed pinning exposes no pinned production document.
  void result.pinnedDocument;
  // @ts-expect-error A failed pinning exposes no Source digest.
  void result.sourceDigest;
  // @ts-expect-error A failed pinning exposes no exact requirements.
  void result.requires;
  // @ts-expect-error A failed pinning exposes no revision.
  void result.revision;
  // @ts-expect-error A failed pinning exposes no Bundle.
  void result.bundle;
}

failure satisfies PublishFailure;
