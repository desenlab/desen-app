import { createImmutableControlPlaneProofReader } from "./control-plane-bundle-store-proof.mjs";

export class ControlPlanePackagePreflightEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlanePackagePreflightEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const READER = createImmutableControlPlaneProofReader({
  ErrorType: ControlPlanePackagePreflightEvidenceError,
  artifactRelativePath: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
  proofDocumentRelativePath: "docs/proof/CONTROL-PLANE-PACKAGE-PREFLIGHT.md",
  task: "M07-T03",
  profile: "desen.control-plane.package-preflight-proof.v1",
  rootKeys: [
    "schemaVersion",
    "profile",
    "task",
    "result",
    "summary",
    "prerequisites",
    "fixtures",
    "claims",
    "trackedFiles",
    "distribution",
    "tests",
    "nonclaims",
    "reproduction",
  ],
  claimKeys: [
    "supportedProtocol",
    "supportedTargets",
    "failFastCatalogGuard",
    "currentPackage",
    "exactResolution",
    "digestClosure",
    "positionalRequirements",
    "authority",
    "failureSemantics",
    "limits",
    "implementation",
    "registrations",
    "traceRows",
  ],
  trackedFiles: 23,
  distributionFiles: 28,
  prerequisites: 5,
  fixtures: 2,
  testCounts: {
    packageRuntimeCases: 34,
    packageGuardCases: 5,
    packageFocusedCases: 39,
    compileTimeNegativeCases: 9,
    rootMutationCases: 16,
  },
  nonclaims: 7,
  reproduction: 9,
});

export const DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH = READER.defaultArtifactPath;
export const buildControlPlanePackagePreflightEvidence = READER.build;
export const verifyControlPlanePackagePreflightEvidence = READER.verify;
export const writeControlPlanePackagePreflightEvidence = READER.write;
