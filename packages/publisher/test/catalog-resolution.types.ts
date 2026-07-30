import type {
  PublishCatalogPackageCandidate,
  PublishCatalogResolutionResult,
  PublishCatalogResolutionSuccess,
  PublishCatalogResolutionLimits,
  PublishResolvedCatalogPackage,
} from "../src/catalog-resolution.js";

declare const candidate: PublishCatalogPackageCandidate;
declare const limits: PublishCatalogResolutionLimits;
declare const resolvedPackage: PublishResolvedCatalogPackage;
declare const success: PublishCatalogResolutionSuccess;
declare const result: PublishCatalogResolutionResult;

candidate.id satisfies string;
candidate.catalog satisfies unknown;
limits.maxCandidates satisfies number;
resolvedPackage.catalog.kind satisfies "desen.catalog";
success.catalogSet[0]?.target satisfies string | undefined;
success.requirementPackageIndexes[0] satisfies number | undefined;

// @ts-expect-error Candidate identity is immutable after entry into the resolver boundary.
candidate.id = "com.example.changed";
// @ts-expect-error The finite profile is immutable.
limits.maxCandidates = 0;
// @ts-expect-error Selected package tuples are immutable.
resolvedPackage.packageDigest = "sha256:changed";
// @ts-expect-error Selected package order cannot be mutated.
success.packages.push(resolvedPackage);
// @ts-expect-error Requirement alignment cannot be rewritten.
success.requirementPackageIndexes[0] = 1;
// @ts-expect-error A successful intermediate result deliberately has no Bundle.
void success.bundle;

if ("resolved" in result) {
  result.catalogSet satisfies PublishCatalogResolutionSuccess["catalogSet"];
  const firstCatalog = result.catalogSet[0];
  if (firstCatalog !== undefined) {
    // @ts-expect-error The branded Catalog set is recursively immutable.
    firstCatalog.target = "other";
  }
} else {
  result.stage satisfies string;
  // @ts-expect-error Failure exposes no partial Catalog authority.
  void result.catalogSet;
  // @ts-expect-error Failure exposes no selected package tuple.
  void result.packages;
  // @ts-expect-error Failure exposes no Bundle.
  void result.bundle;
}
