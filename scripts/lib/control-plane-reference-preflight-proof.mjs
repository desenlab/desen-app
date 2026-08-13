import { createImmutableControlPlaneProofReader } from "./control-plane-bundle-store-proof.mjs";

export class ControlPlaneReferencePreflightEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneReferencePreflightEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const READER = createImmutableControlPlaneProofReader({
  ErrorType: ControlPlaneReferencePreflightEvidenceError,
  artifactRelativePath: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
  proofDocumentRelativePath: "docs/proof/CONTROL-PLANE-REFERENCE-PREFLIGHT.md",
  task: "M07-T04",
  profile: "desen.control-plane.reference-preflight-proof.v1",
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
    "profile",
    "authorityIngress",
    "officialSuccess",
    "referenceClasses",
    "exactReferenceFailures",
    "limits",
    "semanticAgreement",
    "authority",
    "failurePrecedence",
    "implementation",
    "registrations",
    "traceRows",
    "coverageTransitions",
  ],
  trackedFiles: 15,
  distributionFiles: 16,
  prerequisites: 5,
  fixtures: 2,
  testCounts: {
    packageRuntimeCases: 22,
    compileTimeNegativeCases: 12,
    rootMutationCases: 16,
  },
  nonclaims: 8,
  reproduction: 7,
});

export const DEFAULT_CONTROL_PLANE_REFERENCE_PREFLIGHT_ARTIFACT_PATH = READER.defaultArtifactPath;
export const buildControlPlaneReferencePreflightEvidence = READER.build;
export const verifyControlPlaneReferencePreflightEvidence = READER.verify;
export const writeControlPlaneReferencePreflightEvidence = READER.write;
