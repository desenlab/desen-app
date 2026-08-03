import { BUNDLE_PACKAGE_PREFLIGHT_LIMITS, preflightBundlePackages } from "../src/index.js";

import type {
  BundleIntegrityAuthority,
  BundlePackagePreflightAuthority,
  BundlePackagePreflightResult,
  InstalledPackageArtifact,
  InstalledPackageCandidate,
  VerifiedInstalledPackage,
} from "../src/index.js";

declare const integrityAuthority: BundleIntegrityAuthority;
declare const packageAuthority: BundlePackagePreflightAuthority;
declare const result: BundlePackagePreflightResult;

const artifact = {
  path: "dist/adapter.js",
  bytes: new Uint8Array(),
} as const satisfies InstalledPackageArtifact;
const candidate = {
  id: "com.example.package",
  version: "1.0.0",
  target: "web-react",
  catalog: {},
  artifacts: [artifact],
} as const satisfies InstalledPackageCandidate;

void preflightBundlePackages(integrityAuthority, [candidate]);

if (result.status === "preflighted") {
  const accepted: BundlePackagePreflightAuthority = result.authority;
  const metadata: VerifiedInstalledPackage | undefined = accepted.packages[0];
  const packageIndex: number | undefined = accepted.requirementPackageIndexes[0];
  const profile: "desen.web-react.package-digest" | undefined = metadata?.digestProfile;
  const profileVersion: 1 | undefined = metadata?.digestProfileVersion;
  void accepted;
  void packageIndex;
  void profile;
  void profileVersion;
} else {
  const stage: string = result.stage;
  const code: string = result.diagnostics[0]?.code ?? "";
  void stage;
  void code;
}

// @ts-expect-error Caller-selected digests or verification callbacks cannot bypass byte hashing.
void preflightBundlePackages(integrityAuthority, [candidate], () => candidate.id);
// @ts-expect-error Opaque package authority cannot be created structurally.
const forgedAuthority: BundlePackagePreflightAuthority = {
  protocolVersion: "0.1.0",
  revision: "sha256:forged",
  packages: [],
  requirementPackageIndexes: [],
};
// @ts-expect-error Artifact contents must be exact Uint8Array bytes.
const invalidArtifact: InstalledPackageArtifact = { path: "dist/adapter.js", bytes: "code" };
// @ts-expect-error Package authority deliberately exposes no Catalog material.
void packageAuthority.catalog;
// @ts-expect-error Package authority deliberately exposes no artifact bytes or package loader.
void packageAuthority.loadPackage();
// @ts-expect-error Package authority is not activation authority.
void packageAuthority.activate();
// @ts-expect-error Public package metadata is immutable.
packageAuthority.packages[0] = packageAuthority.packages[0] as VerifiedInstalledPackage;
// @ts-expect-error Rejected preflight never carries a partial authority.
if (result.status === "rejected") void result.authority;
// @ts-expect-error The fixed finite profile is immutable and caller-independent.
BUNDLE_PACKAGE_PREFLIGHT_LIMITS.maxCandidates = 1;

void forgedAuthority;
void invalidArtifact;
