import { stageBundleRuntime } from "../src/index.js";

import type {
  BundleIntegrityAuthority,
  BundlePackagePreflightAuthority,
  BundleReferencePreflightAuthority,
  BundleRuntimeStagingAuthority,
  BundleRuntimeStagingResult,
  LocalControlPlaneChannelRecord,
} from "../src/index.js";

declare const packageAuthority: BundlePackagePreflightAuthority;
declare const integrityAuthority: BundleIntegrityAuthority;
declare const referenceAuthority: BundleReferencePreflightAuthority;
declare const channelRecord: LocalControlPlaneChannelRecord;
declare const result: BundleRuntimeStagingResult;

const acceptedResult: BundleRuntimeStagingResult = stageBundleRuntime(packageAuthority);
void acceptedResult;

if (result.status === "staged") {
  const accepted: BundleRuntimeStagingAuthority = result.authority;
  const revision: string = accepted.stagedRevision;
  const packageId: string | undefined = accepted.packages[0]?.id;
  const surfaceId: string | undefined = accepted.surfaces[0]?.id;
  void revision;
  void packageId;
  void surfaceId;

  // @ts-expect-error A staged candidate is not an active revision record.
  void accepted.activeRevision;
  // @ts-expect-error Previous-good state belongs to the later durable activation record.
  void accepted.previousGoodRevision;
  // @ts-expect-error Staging exposes no durable generation.
  void accepted.generation;
  // @ts-expect-error Exact artifact bytes remain package-private.
  void accepted.packages[0]?.bytes;
  // @ts-expect-error Artifact paths remain package-private load-plan data.
  void accepted.packages[0]?.artifactPaths;
  // @ts-expect-error Staging cannot commit or activate itself.
  accepted.commit();
  // @ts-expect-error Public staged metadata is immutable.
  accepted.stagedRevision = "sha256:forged";
  const firstPackage = accepted.packages[0];
  if (firstPackage !== undefined) {
    // @ts-expect-error Public package summaries are immutable.
    accepted.packages[0] = firstPackage;
  }
} else {
  const stage: string = result.stage;
  void stage;
  // @ts-expect-error A rejected staging result carries no partial authority.
  void result.authority;
}

// @ts-expect-error Integrity authority cannot bypass exact package preflight.
stageBundleRuntime(integrityAuthority);
// @ts-expect-error T04 is a parallel reference branch, not the T06 staging input.
stageBundleRuntime(referenceAuthority);
// @ts-expect-error A mutable channel record is discovery metadata, not staging authority.
stageBundleRuntime(channelRecord);

// @ts-expect-error The staging brand cannot be manufactured structurally.
const forged: BundleRuntimeStagingAuthority = {
  profile: "desen.runtime-index-staging",
  profileVersion: 1,
  protocolVersion: "0.1.0",
  stagedRevision: "sha256:forged",
  documentId: "forged",
  entrySurfaceId: "forged",
  packages: [],
  surfaces: [],
  runtimeObligationCount: 0,
};
void forged;
