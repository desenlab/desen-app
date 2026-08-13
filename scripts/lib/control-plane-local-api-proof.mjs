import { createImmutableControlPlaneProofReader } from "./control-plane-bundle-store-proof.mjs";

export class ControlPlaneLocalApiEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneLocalApiEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const READER = createImmutableControlPlaneProofReader({
  ErrorType: ControlPlaneLocalApiEvidenceError,
  artifactRelativePath: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
  proofDocumentRelativePath: "docs/proof/CONTROL-PLANE-LOCAL-API.md",
  task: "M07-T05",
  profile: "desen.control-plane.local-api-proof.v1",
  proofId: "control-plane-local-api",
  rootKeys: [
    "schemaVersion",
    "proofId",
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
    "publicFactory",
    "transport",
    "officialSource",
    "immutableBundles",
    "mutableChannel",
    "concurrencyAndRestart",
    "security",
    "separation",
    "implementation",
    "registrations",
    "traceRows",
    "coverageTransitions",
  ],
  trackedFiles: 22,
  distributionFiles: 28,
  prerequisites: 1,
  fixtures: 1,
  testCounts: {
    packageRuntimeCases: 16,
    compileTimeNegativeCases: 18,
    rootMutationCases: 16,
  },
  nonclaims: 10,
  reproduction: 7,
});

export const DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH = READER.defaultArtifactPath;
export const buildControlPlaneLocalApiEvidence = READER.build;
export const verifyControlPlaneLocalApiEvidence = READER.verify;
export const writeControlPlaneLocalApiEvidence = READER.write;
