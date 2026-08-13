import { createImmutableControlPlaneProofReader } from "./control-plane-bundle-store-proof.mjs";

export class ControlPlaneBundleVerificationEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneBundleVerificationEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const READER = createImmutableControlPlaneProofReader({
  ErrorType: ControlPlaneBundleVerificationEvidenceError,
  artifactRelativePath: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json",
  proofDocumentRelativePath: "docs/proof/CONTROL-PLANE-BUNDLE-VERIFICATION.md",
  task: "M07-T02",
  profile: "desen.control-plane.bundle-verification-proof.v1",
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
    "failFastStructuralGuard",
    "publicBoundary",
    "limits",
    "officialBundle",
    "publicationBearingBundle",
    "completeBundleSizeProfile",
    "availableSourceLimits",
    "diagnostics",
    "authority",
    "precedence",
    "registrations",
    "traceRows",
  ],
  trackedFiles: 24,
  distributionFiles: 28,
  prerequisites: 6,
  fixtures: 2,
  testCounts: {
    packageRuntimeCases: 17,
    packageGuardCases: 6,
    packageFocusedCases: 23,
    compileTimeNegativeCases: 9,
    rootMutationCases: 16,
  },
  nonclaims: 7,
  reproduction: 7,
});

export const DEFAULT_CONTROL_PLANE_BUNDLE_VERIFICATION_ARTIFACT_PATH = READER.defaultArtifactPath;
export const buildControlPlaneBundleVerificationEvidence = READER.build;
export const verifyControlPlaneBundleVerificationEvidence = READER.verify;
export const writeControlPlaneBundleVerificationEvidence = READER.write;
