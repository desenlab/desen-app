import type { DesenBundle } from "@desen/protocol";
import type { ImmutableJson } from "@desen/validator";

import {
  publishDesenSource,
  type PublishCatalogPackageCandidate,
  type PublishFailure,
  type PublishResult,
  type PublishSuccess,
  type PublishWarningDiagnostic,
} from "../src/index.js";
import {
  PUBLISH_BUNDLE_PUBLICATION_LIMITS,
  normalizePublishBundlePublicationLimits,
  publishDesenSourceWithLimits,
  type PublishBundlePublicationLimits,
} from "../src/bundle-publication.js";
// @ts-expect-error The private limit profile is absent from the package root.
import type { PublishBundlePublicationLimits as PublicBundleLimits } from "../src/index.js";

declare const sourceText: string;
declare const candidate: PublishCatalogPackageCandidate;
declare const candidates: readonly PublishCatalogPackageCandidate[];
declare const result: PublishResult;
declare const success: PublishSuccess;
declare const failure: PublishFailure;
declare const warning: PublishWarningDiagnostic;
declare const bundle: ImmutableJson<DesenBundle>;
declare const limits: PublishBundlePublicationLimits;
declare const publicLimits: PublicBundleLimits;

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type Expect<Condition extends true> = Condition;

declare const contractAssertions: readonly [
  Expect<Equal<ReturnType<typeof publishDesenSource>, PublishResult>>,
  Expect<Equal<PublishResult, PublishSuccess | PublishFailure>>,
  Expect<Equal<PublishSuccess["bundle"], ImmutableJson<DesenBundle>>>,
  Expect<Equal<PublishSuccess["diagnostics"], readonly PublishWarningDiagnostic[]>>,
  Expect<Equal<PublishBundlePublicationLimits["maxBundleCanonicalBytes"], number>>,
];

function expectType<Value>(value: Value): Value {
  return value;
}

expectType(contractAssertions);
expectType<PublishResult>(publishDesenSource(sourceText, candidates));
expectType<PublishResult>(
  publishDesenSourceWithLimits(sourceText, candidates, PUBLISH_BUNDLE_PUBLICATION_LIMITS),
);
expectType<Readonly<PublishBundlePublicationLimits>>(
  normalizePublishBundlePublicationLimits(limits),
);
expectType<ImmutableJson<DesenBundle>>(success.bundle);
expectType<readonly PublishWarningDiagnostic[]>(success.diagnostics);
expectType<string>(candidate.id);
expectType<string>(candidate.version);
expectType<string>(candidate.target);
expectType<string>(candidate.observedPackageDigest);
expectType<unknown>(candidate.catalog);
expectType(bundle);
expectType(warning);
expectType(publicLimits);

// @ts-expect-error Public publication accepts raw JSON text, not a parsed object.
publishDesenSource({}, candidates);
// @ts-expect-error Candidate inventory is required.
publishDesenSource(sourceText);
// @ts-expect-error Public publication has no caller-adjustable third argument.
publishDesenSource(sourceText, candidates, limits);
publishDesenSource(sourceText, [
  // @ts-expect-error A candidate requires an id.
  { version: "1.0.0", target: "web", observedPackageDigest: "x", catalog: {} },
]);
publishDesenSource(sourceText, [
  // @ts-expect-error A candidate requires an exact version.
  { id: "x", target: "web", observedPackageDigest: "x", catalog: {} },
]);
publishDesenSource(sourceText, [
  // @ts-expect-error A candidate requires a target.
  { id: "x", version: "1.0.0", observedPackageDigest: "x", catalog: {} },
]);
// @ts-expect-error A candidate requires an observed package digest.
publishDesenSource(sourceText, [{ id: "x", version: "1.0.0", target: "web", catalog: {} }]);
publishDesenSource(sourceText, [
  // @ts-expect-error A candidate requires Catalog input.
  { id: "x", version: "1.0.0", target: "web", observedPackageDigest: "x" },
]);
// @ts-expect-error Candidate identity is immutable.
candidate.id = "changed";
// @ts-expect-error Candidate version is immutable.
candidate.version = "2.0.0";
// @ts-expect-error Candidate target is immutable.
candidate.target = "changed";
// @ts-expect-error Candidate digest observation is immutable.
candidate.observedPackageDigest = "changed";
// @ts-expect-error Candidate Catalog authority is immutable.
candidate.catalog = {};
// @ts-expect-error Readonly candidate inventories cannot be appended to.
candidates.push(candidate);
// @ts-expect-error Success discriminator is immutable.
success.ok = true;
// @ts-expect-error Terminal Bundle cannot be replaced.
success.bundle = bundle;
// @ts-expect-error Success diagnostics cannot be replaced.
success.diagnostics = [];
// @ts-expect-error Success diagnostics are immutable.
success.diagnostics.push(warning);
// @ts-expect-error Bundle revision is immutable.
success.bundle.revision = "sha256:changed";
// @ts-expect-error Bundle Source digest is immutable.
success.bundle.sourceDigest = "sha256:changed";
// @ts-expect-error Bundle entry is immutable.
success.bundle.entry = "changed";
// @ts-expect-error Bundle exact requirements are immutable.
success.bundle.requires.catalogs.push(success.bundle.requires.catalogs[0]);
// @ts-expect-error Exact package digest is immutable.
success.bundle.requires.catalogs[0].digest = "sha256:changed";
// @ts-expect-error Surface map is immutable.
success.bundle.surfaces.main = success.bundle.entry;
// @ts-expect-error Failure discriminator is immutable.
failure.ok = false;
// @ts-expect-error Failure stage is immutable.
failure.stage = "bundle-validation";
// @ts-expect-error Failure diagnostics are immutable.
failure.diagnostics.push(failure.diagnostics[0]);
// @ts-expect-error A failure structurally has no Bundle.
void failure.bundle;
// @ts-expect-error A failure structurally has no revision.
void failure.revision;
// @ts-expect-error A failure structurally has no partial value.
void failure.value;
// @ts-expect-error A failure structurally has no Source authority.
void failure.source;
// @ts-expect-error A failure structurally has no Catalog authority.
void failure.catalogSet;
// @ts-expect-error A failure structurally has no obligations.
void failure.obligations;
// @ts-expect-error The default maximum is immutable.
PUBLISH_BUNDLE_PUBLICATION_LIMITS.maxBundleCanonicalBytes = 0;
// @ts-expect-error The nested predecessor profile is immutable.
PUBLISH_BUNDLE_PUBLICATION_LIMITS.catalogPinning.maxNormalizedDocumentCanonicalBytes = 0;
// @ts-expect-error A typed limit profile requires its nested predecessor profile.
const incompleteLimits: PublishBundlePublicationLimits = { maxBundleCanonicalBytes: 1 };
expectType(incompleteLimits);
// @ts-expect-error Private publication still requires a complete limit profile.
publishDesenSourceWithLimits(sourceText, candidates, { maxBundleCanonicalBytes: 1 });
// @ts-expect-error The private publication operation is absent from the package root.
await import("../src/index.js").then((publisher) => publisher.publishDesenSourceWithLimits);
// @ts-expect-error The private default profile is absent from the package root.
await import("../src/index.js").then((publisher) => publisher.PUBLISH_BUNDLE_PUBLICATION_LIMITS);
// @ts-expect-error The T08 preflight remains absent from the package root.
await import("../src/index.js").then((publisher) => publisher.preflightPublishCatalogPinning);

if (result.ok) {
  result satisfies PublishSuccess;
  result.bundle satisfies ImmutableJson<DesenBundle>;
  // @ts-expect-error Success has no failure stage.
  void result.stage;
  // @ts-expect-error Narrowed success remains immutable.
  result.bundle = bundle;
} else {
  result satisfies PublishFailure;
  // @ts-expect-error Narrowed failure has no Bundle.
  void result.bundle;
  // @ts-expect-error Narrowed failure has no warnings-only success report.
  void result.warningDiagnostics;
}
