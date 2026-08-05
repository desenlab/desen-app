import { BUNDLE_REFERENCE_PREFLIGHT_LIMITS, preflightBundleReferences } from "../src/index.js";

import type {
  BundleIntegrityAuthority,
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleReferencePreflightResult,
  VerifiedBundleSurfaceReferences,
} from "../src/index.js";

declare const integrityAuthority: BundleIntegrityAuthority;
declare const packageAuthority: BundlePackagePreflightAuthority;
declare const referenceAuthority: BundleReferencePreflightAuthority;
declare const result: BundleReferencePreflightResult;

void preflightBundleReferences(packageAuthority);

if (result.status === "preflighted") {
  const accepted: BundleReferencePreflightAuthority = result.authority;
  const profile: "desen.reference.activation-preflight" = accepted.profile;
  const profileVersion: 1 = accepted.profileVersion;
  const protocol: "0.1.0" = accepted.protocolVersion;
  const surface: VerifiedBundleSurfaceReferences | undefined = accepted.surfaces[0];
  void profile;
  void profileVersion;
  void protocol;
  void surface;
} else {
  const stage: string = result.stage;
  const code: string = result.diagnostics[0]?.code ?? "";
  void stage;
  void code;
}

// @ts-expect-error M07-T02 integrity authority cannot bypass exact installed-package preflight.
void preflightBundleReferences(integrityAuthority);
// @ts-expect-error Callers cannot provide a replacement Bundle, Catalog, callback, or limits.
void preflightBundleReferences(packageAuthority, BUNDLE_REFERENCE_PREFLIGHT_LIMITS);
// @ts-expect-error Opaque reference authority cannot be manufactured structurally.
const forged: BundleReferencePreflightAuthority = {
  profile: "desen.reference.activation-preflight",
  profileVersion: 1,
  protocolVersion: "0.1.0",
  revision: "sha256:forged",
  surfaces: [],
};
// @ts-expect-error The public authority deliberately exposes no Bundle.
void referenceAuthority.bundle;
// @ts-expect-error The public authority deliberately exposes no Catalog set.
void referenceAuthority.catalogSet;
// @ts-expect-error The public authority deliberately exposes no installed-package bytes.
void referenceAuthority.packages;
// @ts-expect-error Runtime execution-contract obligations belong to M07-T06, not this authority.
void referenceAuthority.runtimeObligationCount;
// @ts-expect-error Reference preflight does not stage runtime indexes.
void referenceAuthority.stage();
// @ts-expect-error Reference preflight is not activation or durable-commit authority.
void referenceAuthority.activate();
// @ts-expect-error Reference-preflight metadata is immutable.
referenceAuthority.surfaces[0] = referenceAuthority.surfaces[0] as VerifiedBundleSurfaceReferences;
// @ts-expect-error The fixed finite profile is immutable and caller-independent.
BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxSourceTreeDepth = 128;
// @ts-expect-error Rejected preflight never carries a partial authority.
if (result.status === "rejected") void result.authority;

void forged;
