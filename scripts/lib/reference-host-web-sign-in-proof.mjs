import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/reference-host-web-0.1.0-sign-in.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/REFERENCE-HOST-WEB-SIGN-IN.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const PROJECT_STATUS_RELATIVE_PATH = "PROJECT-STATUS.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "a7c83d438190ee45dae4714bd092e56282cb3db4c69c72eeaca44e2647683adb";
const HISTORICAL_ARTIFACT_BYTES = 21_847;
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const MAX_DOCUMENT_BYTES = 2_000_000;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
).get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
).get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
).get;

/** Absolute path to the immutable task-time M05-T08 proof artifact. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the immutable M05-T08 human-readable proof. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Absolute path to the exact M05-T08 Proof Matrix pins. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

/** Absolute path to the exact M05-T08 project-status pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROJECT_STATUS_PATH = path.join(
  WORKSPACE_ROOT,
  PROJECT_STATUS_RELATIVE_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "sha256:9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
    profile: "desen-runtime-react-interactions-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T07",
    path: "docs/proof/artifacts/reference-host-web-0.1.0-shell.json",
    sha256: "sha256:cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2",
    profile: "desen-reference-host-web-shell-v1",
    result: "PASS",
  }),
]);

/**
 * @deprecated Immutable task-time compatibility surface. Successor proofs must discover and own
 * their current prerequisites independently.
 */
export const REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS = Object.freeze(
  EXPECTED_PREREQUISITES.map(({ path: relativePath }) => relativePath),
);

/**
 * @deprecated Exact M05-T08 task-time inventory retained only for callers that imported the
 * former proof builder's named surface.
 */
export const REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS = Object.freeze([
  "apps/reference-host-web/index.html",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/README.md",
  "apps/reference-host-web/tsconfig.json",
  "apps/reference-host-web/src/application.tsx",
  "apps/reference-host-web/src/browser-profile.ts",
  "apps/reference-host-web/src/failure-view.tsx",
  "apps/reference-host-web/src/host-ports.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/managed-surface.tsx",
  "apps/reference-host-web/src/official-sign-in.ts",
  "apps/reference-host-web/src/recovery-authority.ts",
  "apps/reference-host-web/src/root-policy.ts",
  "apps/reference-host-web/src/root.tsx",
  "apps/reference-host-web/src/sign-in-http-handler.ts",
  "apps/reference-host-web/src/styles.css",
  "apps/reference-host-web/test/host-ports.test.ts",
  "apps/reference-host-web/test/main-lifecycle.test.tsx",
  "apps/reference-host-web/test/official-sign-in.test.tsx",
  "apps/reference-host-web/test/official-sign-in.types.ts",
  "apps/reference-host-web/test/public-api.types.ts",
  "apps/reference-host-web/test/recovery-authority.test.ts",
  "apps/reference-host-web/test/root-lifecycle.test.tsx",
  "apps/reference-host-web/test/root-policy.test.ts",
  "apps/reference-host-web/test/root-security.test.tsx",
  "apps/reference-host-web/test/sign-in-http-handler.test.ts",
  "examples/sign-in/official-derived.source.desen.json",
  "examples/sign-in/official-derived.bundle.desen.json",
  "packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.source.desen.json",
  "packages/protocol/upstream/0.1.0/snapshot/examples/sign-in.bundle.desen.json",
  "packages/reference-catalog-web/catalog.json",
  "packages/reference-catalog-web/package.json",
  "packages/reference-catalog-web/src/host-operations/sign-in.ts",
  "packages/reference-catalog-web/src/operations/sign-in.ts",
  "packages/reference-catalog-web/src/react-adapters/index.tsx",
  "dependency-cruiser.config.cjs",
  "package.json",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-reference-host-web-shell-proof.mjs",
  "scripts/lib/reference-host-web-shell-proof.mjs",
  "scripts/verify-reference-host-web-shell.mjs",
  "tests/reference-host-web-shell.test.mjs",
  "scripts/generate-reference-host-web-sign-in-proof.mjs",
  "scripts/lib/reference-host-web-sign-in-proof.mjs",
  "scripts/verify-reference-host-web-sign-in.mjs",
  "tests/reference-host-web-sign-in.test.mjs",
]);

/**
 * @deprecated Exact M05-T08 inspection inventory. This list is descriptive historical data and is
 * never read by the compatibility inspector.
 */
export const REFERENCE_HOST_WEB_SIGN_IN_INSPECTION_PATHS = Object.freeze([
  ...new Set([
    ...REFERENCE_HOST_WEB_SIGN_IN_TRACKED_PATHS,
    ...REFERENCE_HOST_WEB_SIGN_IN_PREREQUISITE_PATHS,
    "docs/proof/protocol-0.1.0-traceability.json",
  ]),
]);

const HISTORICAL_PRODUCTION_IMPORTS = Object.freeze(
  [
    ["apps/reference-host-web/src/application.tsx", "./managed-surface.js"],
    ["apps/reference-host-web/src/application.tsx", "@desen/runtime-react"],
    ["apps/reference-host-web/src/browser-profile.ts", "@desen/runtime-web"],
    ["apps/reference-host-web/src/browser-profile.ts", "@desen/runtime-core"],
    ["apps/reference-host-web/src/browser-profile.ts", "@desen/runtime-web"],
    ["apps/reference-host-web/src/failure-view.tsx", "@desen/runtime-react"],
    ["apps/reference-host-web/src/host-ports.ts", "@desen/runtime-web"],
    ["apps/reference-host-web/src/host-ports.ts", "./browser-profile.js"],
    ["apps/reference-host-web/src/host-ports.ts", "@desen/runtime-core"],
    ["apps/reference-host-web/src/host-ports.ts", "@desen/runtime-web"],
    ["apps/reference-host-web/src/main.tsx", "./styles.css"],
    ["apps/reference-host-web/src/main.tsx", "./official-sign-in.js"],
    ["apps/reference-host-web/src/main.tsx", "./root.js"],
    ["apps/reference-host-web/src/main.tsx", "./sign-in-http-handler.js"],
    ["apps/reference-host-web/src/managed-surface.tsx", "react"],
    ["apps/reference-host-web/src/managed-surface.tsx", "@desen/runtime-react"],
    ["apps/reference-host-web/src/managed-surface.tsx", "./failure-view.js"],
    ["apps/reference-host-web/src/managed-surface.tsx", "@desen/runtime-react"],
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      "@desen/reference-catalog-web/catalog.json",
    ],
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      "@desen/reference-catalog-web/host-operations",
    ],
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      "@desen/reference-catalog-web/react-adapters",
    ],
    ["apps/reference-host-web/src/official-sign-in.ts", "@desen/runtime-core"],
    ["apps/reference-host-web/src/official-sign-in.ts", "@desen/runtime-react"],
    ["apps/reference-host-web/src/official-sign-in.ts", "@desen/runtime-web"],
    [
      "apps/reference-host-web/src/official-sign-in.ts",
      "../../../examples/sign-in/official-derived.bundle.desen.json",
    ],
    ["apps/reference-host-web/src/official-sign-in.ts", "./host-ports.js"],
    ["apps/reference-host-web/src/official-sign-in.ts", "./root.js"],
    ["apps/reference-host-web/src/official-sign-in.ts", "@desen/runtime-core"],
    ["apps/reference-host-web/src/official-sign-in.ts", "@desen/runtime-react"],
    ["apps/reference-host-web/src/official-sign-in.ts", "./root.js"],
    ["apps/reference-host-web/src/recovery-authority.ts", "@desen/runtime-core"],
    ["apps/reference-host-web/src/recovery-authority.ts", "@desen/runtime-react"],
    ["apps/reference-host-web/src/recovery-authority.ts", "@desen/runtime-web"],
    ["apps/reference-host-web/src/root-policy.ts", "@desen/runtime-react"],
    ["apps/reference-host-web/src/root-policy.ts", "react-dom/client"],
    ["apps/reference-host-web/src/root.tsx", "react"],
    ["apps/reference-host-web/src/root.tsx", "react-dom/client"],
    ["apps/reference-host-web/src/root.tsx", "@desen/runtime-core"],
    ["apps/reference-host-web/src/root.tsx", "@desen/runtime-web"],
    ["apps/reference-host-web/src/root.tsx", "@desen/runtime-react"],
    ["apps/reference-host-web/src/root.tsx", "./application.js"],
    ["apps/reference-host-web/src/root.tsx", "./recovery-authority.js"],
    ["apps/reference-host-web/src/root.tsx", "./root-policy.js"],
    ["apps/reference-host-web/src/root.tsx", "react-dom/client"],
    ["apps/reference-host-web/src/root.tsx", "@desen/runtime-react"],
    ["apps/reference-host-web/src/root.tsx", "@desen/runtime-web"],
    ["apps/reference-host-web/src/root.tsx", "./recovery-authority.js"],
    ["apps/reference-host-web/src/root.tsx", "./root-policy.js"],
    [
      "apps/reference-host-web/src/sign-in-http-handler.ts",
      "@desen/reference-catalog-web/host-operations",
    ],
    ["apps/reference-host-web/src/sign-in-http-handler.ts", "@desen/runtime-core"],
    [
      "apps/reference-host-web/src/sign-in-http-handler.ts",
      "@desen/reference-catalog-web/host-operations",
    ],
    ["apps/reference-host-web/src/sign-in-http-handler.ts", "@desen/runtime-core"],
  ].map(([importer, specifier]) => Object.freeze({ importer, specifier })),
);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T08",
  result: "PASS",
  profile: "desen-reference-host-web-sign-in-v1",
  protocol: "0.1.0",
  target: "web-react",
  claim: Object.freeze({
    controlledOfficialDerivedFixture: true,
    canonicalManagedSurfacesPreserved: true,
    officialSignInExecuted: true,
    realFiveAdapterRegistryExecuted: true,
    realHeadlessSessionMounted: true,
    realRuntimeWebHostAuthorityUsed: true,
    fixedApplicationOwnedOperationBinding: true,
    pendingFailureEditedRetrySuccessNavigationExecuted: true,
    staleAuthoritySettlementContained: true,
    sameSurfacePendingPressSuppressed: true,
    persistedPageHideCompositionPreserved: true,
    finalPageHideCompositionDisposed: true,
    protocolBundleContainsTopLevelAuthoringState: false,
    publisherProducedFixture: false,
    realAuthenticationBackend: false,
    transportCancellationClaimed: false,
    handwrittenManagedTreeFullyAudited: false,
    browserE2eClaimed: false,
    nativeRuntimeClaimed: false,
    g05Closed: false,
  }),
  fixture: Object.freeze({
    source: Object.freeze({
      path: "examples/sign-in/official-derived.source.desen.json",
      bytes: 4_724,
      sha256: "sha256:a679ad21c0648414544e78efa231c2f058745a97331603ceeb78722231a71b4c",
      canonicalBytes: 2_029,
      digest: "sha256:b8e2d6bac855fb307aaeb0636becf93834f6faeda5464bdbfbc1e8d52f379635",
      containsAuthoring: true,
    }),
    bundle: Object.freeze({
      path: "examples/sign-in/official-derived.bundle.desen.json",
      bytes: 4_899,
      sha256: "sha256:334450fa1864bf280a30342090a46ba1d2f2dc96552b9430afdde5fcada902b0",
      canonicalBytes: 2_274,
      revision: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
      containsAuthoring: false,
    }),
    managedSurfaces: Object.freeze({
      canonicalBytes: 1_702,
      sha256: "sha256:44e37075d3bad3c4e749255a65651458a3c36dec8a4090816b647dac65dd0165",
      upstreamAndDerivedCanonicalIdentity: true,
      inventory: Object.freeze({
        surfaces: 2,
        nodes: 8,
        componentCapabilities: Object.freeze({
          Alert: 1,
          Button: 1,
          Stack: 2,
          Text: 2,
          TextField: 2,
        }),
        stateEntries: 2,
        resources: 0,
        actions: Object.freeze({
          navigate: 1,
          "operation.invoke": 1,
          "state.set": 2,
        }),
      }),
    }),
    catalog: Object.freeze({
      id: "run.desen.reference.sign-in",
      version: "0.1.0",
      target: "web-react",
      digest: "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
    }),
    validation: Object.freeze({
      sourceStructural: "PASS",
      bundleStructural: "PASS",
      catalogStructural: "PASS",
      catalogSemantic: "PASS",
      catalogExecutionSet: "PASS",
      sourceCumulativeExecution: "PASS",
      bundleCumulativeExecution: "PASS",
      invalidCapabilityProbeRejected: true,
      mismatchedCatalogDigestFixtureProbeRejected: true,
    }),
  }),
  integration: Object.freeze({
    documentId: "com.example.account-app",
    revision: "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb",
    entrySurface: "sign-in",
    successSurface: "home",
    operation: Object.freeze({
      capabilityId: "com.example.auth/signIn",
      invocationAlias: "signIn",
      effect: "network",
      input: Object.freeze(["email", "password"]),
      concurrency: "replace",
    }),
    navigation: Object.freeze({
      from: "sign-in",
      to: "home",
      browserPath: "/home",
      exactEmptyParams: true,
    }),
    httpBinding: Object.freeze({
      endpoint: "/api/sign-in",
      method: "POST",
      credentials: "same-origin",
      mode: "same-origin",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      maximumResponseBytes: 65_536,
      maximumResponseChunks: 1_024,
      acceptedAttemptsPerInvocation: 1,
      automaticRetries: 0,
      invalidCredentialsStatus: 401,
      otherFailures: "unavailable",
      outputSchemaOwner: "runtime-core",
      rawErrorsReported: false,
      credentialsReported: false,
    }),
    hostAuthority: Object.freeze({
      ports: Object.freeze([
        "navigation",
        "storage",
        "operations",
        "resources",
        "tokens",
        "context",
        "environment",
        "clock",
        "diagnostics",
      ]),
      bundleChoice: "module-owned-official-derived-bundle",
      catalogChoice: "module-owned-reference-catalog",
      adapterRegistryChoice: "module-owned-reference-react-adapters",
      arbitraryReactChildren: false,
      callerSelectedCapabilityId: false,
      callerSelectedRecoveryKey: false,
      rejectedActivationDisposesCreatedAuthorities: true,
      diagnostics: "bounded-redacted-code-only",
    }),
    exercisedFlow: Object.freeze([
      "edit",
      "pending",
      "declared-failure",
      "edited-retry",
      "success",
      "navigation",
      "stale-replacement-containment",
      "late-disposal-containment",
    ]),
  }),
  independentBuild: Object.freeze({
    tool: "vite@8.1.5",
    command: "vite build --outDir <isolated-directory> --emptyOutDir --logLevel error",
    independentBuilds: 2,
    deterministic: true,
    fileCount: 3,
    aggregateSha256: "sha256:0d87b5ccaec442a4e2777c952906046d6b3677ec648bf49120d0fa35290cad69",
    files: Object.freeze([
      Object.freeze({
        path: "assets/index-ClMarVVR.css",
        bytes: 1_637,
        sha256: "sha256:bbfe758b463bca14d58440da1cd0b7c60b3ac4f427ba4c8b41ac7744e2cd1672",
      }),
      Object.freeze({
        path: "assets/index-Cx4f_cRu.js",
        bytes: 1_046_950,
        sha256: "sha256:93d8c712a0bec5f6c89f237402532722e2a593e70be2c666c650dd3e1b112812",
      }),
      Object.freeze({
        path: "index.html",
        bytes: 480,
        sha256: "sha256:b3dd7ee7325927539f9a6387e1443ac5d1a3dc2d6a68268561b62f0b339d7118",
      }),
    ]),
  }),
  compatibility: Object.freeze({
    mode: "immutable-task-time-artifact",
    artifactRewritten: false,
    ownedPaths: Object.freeze([
      "scripts/generate-reference-host-web-shell-proof.mjs",
      "scripts/lib/reference-host-web-shell-proof.mjs",
      "scripts/verify-reference-host-web-shell.mjs",
      "tests/reference-host-web-shell.test.mjs",
    ]),
  }),
  tests: Object.freeze({
    fullAppCases: 40,
    focusedSignInCases: 8,
    focusedHttpCases: 9,
    focusedLifecycleCases: 1,
    focusedCases: 18,
    signInCompilerNegativeCases: 7,
    shellCompilerNegativeCases: 6,
    compilerNegativeCases: 13,
    historicalT07CompatibilityCases: 12,
    rootMutationTests: 14,
  }),
  sourceAssertions: 408,
  productionImports: 52,
  dynamicExecutableImports: 0,
  officialCompositionJsx: 0,
  trackedFiles: 46,
  traceability: Object.freeze({
    canonicalTrace: Object.freeze([
      "conformanceRules:C-015:7.3",
      "pipelineSteps:PIPE-008:6.3",
      "pipelineSteps:PIPE-022:24.2",
      "proseRules:R-007:5.5",
      "proseRules:R-056:16.3",
      "proseRules:R-064:18.1",
      "proseRules:R-091:22.3",
      "proseRules:R-112:26.3",
      "proseRules:R-113:26.4",
      "proseRules:R-115:26.7",
      "proseRules:R-146:16",
      "proseRules:R-147:17",
      "diagnostics:D-036:Appendix B",
    ]),
    normativeStatusChanges: Object.freeze([]),
    proofClaimStatusChanges: Object.freeze([]),
    normativeStatus: Object.freeze({ "N-036": "PLANNED" }),
    proofClaims: Object.freeze({
      "P-06": "PARTIAL",
      "P-07": "NOT_PROVEN",
      "P-10": "PARTIAL",
      "P-17": "PARTIAL",
    }),
    productionRuntimeConformance: "PLANNED",
    gate: "G05_OPEN_PENDING_M05_T09",
  }),
  historicalArtifactsRewritten: false,
  nonclaims: 10,
});

/** Controlled compatibility-reader failure for immutable M05-T08 evidence. */
export class ReferenceHostWebSignInEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceHostWebSignInEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceHostWebSignInEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(value, allowedKeys, operation) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${operation} options must be a plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${operation} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${operation} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `Historical M05-T08 ${operation} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `Historical M05-T08 ${operation} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (
    value !== undefined &&
    (typeof value !== "string" || value.length === 0 || value.includes("\0"))
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} must be a non-empty safe string.`,
    );
  }
  return value;
}

function optionalText(value, label) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalBytes(value, label) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} must be non-shared non-Proxy bytes.`,
    );
  }

  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `Historical M05-T08 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof ReferenceHostWebSignInEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} must not use shared backing memory.`,
    );
  }
  if (byteLength !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "REFERENCE_HOST_SIGN_IN_HISTORICAL_ARTIFACT_DRIFT",
      `Historical M05-T08 ${label} must contain exactly ${HISTORICAL_ARTIFACT_BYTES} bytes.`,
    );
  }

  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} backing memory is detached or invalid.`,
    );
  }
}

async function validateHistoricalWorkspaceRoot(value) {
  const candidate = optionalString(value, "workspaceRoot");
  if (candidate === undefined) return;
  if (candidate !== WORKSPACE_ROOT) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 workspaceRoot must be the exact canonical task-time workspace root.",
    );
  }
  let entry;
  let canonical;
  try {
    [entry, canonical] = await Promise.all([
      lstat(candidate, { bigint: true }),
      realpath(candidate),
    ]);
  } catch (error) {
    fail(
      "REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE",
      "Historical M05-T08 canonical workspace root could not be authenticated.",
      { cause: String(error) },
    );
  }
  if (!entry.isDirectory() || entry.isSymbolicLink() || canonical !== WORKSPACE_ROOT) {
    fail(
      "REFERENCE_HOST_SIGN_IN_INPUT_UNSAFE",
      "Historical M05-T08 canonical workspace root changed identity.",
    );
  }
}

function sameFileState(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function assertSafeParentIdentity(safePath, unsafeCode, temporaryPath = undefined) {
  let parentEntry;
  let canonicalParent;
  try {
    [parentEntry, canonicalParent] = await Promise.all([
      lstat(safePath.parentPath, { bigint: true }),
      realpath(safePath.parentPath),
    ]);
  } catch (error) {
    fail(unsafeCode, `Historical M05-T08 evidence parent changed unsafely.`, {
      cause: String(error),
    });
  }
  if (
    !parentEntry.isDirectory() ||
    parentEntry.isSymbolicLink() ||
    !sameFileIdentity(safePath.parentEntry, parentEntry) ||
    canonicalParent !== safePath.parentPath ||
    (temporaryPath !== undefined &&
      path.dirname(path.resolve(temporaryPath)) !== safePath.parentPath)
  ) {
    fail(unsafeCode, `Historical M05-T08 evidence parent changed identity.`);
  }
}

async function canonicalSafePath(filePath, unsafeCode) {
  const absolutePath = path.resolve(filePath);
  const parentPath = path.dirname(absolutePath);
  let parentEntry;
  let canonicalParent;
  try {
    [parentEntry, canonicalParent] = await Promise.all([
      lstat(parentPath, { bigint: true }),
      realpath(parentPath),
    ]);
  } catch (error) {
    fail(unsafeCode, `Historical M05-T08 evidence parent is unsafe: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (
    !parentEntry.isDirectory() ||
    parentEntry.isSymbolicLink() ||
    canonicalParent !== parentPath
  ) {
    fail(unsafeCode, `Historical M05-T08 evidence crosses a symlink parent: ${filePath}.`);
  }
  const safePath = Object.freeze({ absolutePath, parentPath, parentEntry });
  await assertSafeParentIdentity(safePath, unsafeCode);
  return safePath;
}

async function readRegularFile(filePath, missingCode, unsafeCode, maximumBytes, exactBytes) {
  const safePath = await canonicalSafePath(filePath, unsafeCode);
  let entry;
  let canonicalBefore;
  try {
    [entry, canonicalBefore] = await Promise.all([
      lstat(safePath.absolutePath, { bigint: true }),
      realpath(safePath.absolutePath),
    ]);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail(missingCode, `Historical M05-T08 evidence file is missing: ${filePath}.`);
    }
    fail(unsafeCode, `Historical M05-T08 evidence file is unsafe: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    canonicalBefore !== safePath.absolutePath ||
    entry.size > BigInt(maximumBytes) ||
    (exactBytes !== undefined && entry.size !== BigInt(exactBytes))
  ) {
    fail(unsafeCode, `Historical M05-T08 evidence is not a safe bounded file: ${filePath}.`);
  }

  let handle;
  try {
    handle = await open(
      safePath.absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || !sameFileState(entry, before)) {
      fail(unsafeCode, `Historical M05-T08 evidence changed identity before reading: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    const [after, currentEntry, parentAfter, canonicalAfter] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(safePath.absolutePath, { bigint: true }),
      lstat(safePath.parentPath, { bigint: true }),
      realpath(safePath.absolutePath),
    ]);
    if (
      bytes.length !== Number(before.size) ||
      bytes.length > maximumBytes ||
      (exactBytes !== undefined && bytes.length !== exactBytes) ||
      !sameFileState(before, after) ||
      !sameFileState(after, currentEntry) ||
      !sameFileState(safePath.parentEntry, parentAfter) ||
      canonicalAfter !== safePath.absolutePath
    ) {
      fail(unsafeCode, `Historical M05-T08 evidence changed during reading: ${filePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebSignInEvidenceError) throw error;
    fail(unsafeCode, `Historical M05-T08 evidence could not be read safely: ${filePath}.`, {
      cause: String(error),
    });
  } finally {
    try {
      await handle?.close();
    } catch {
      // Preserve the controlled read result or primary failure.
    }
  }
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function artifactProjection(artifact) {
  const fixture = artifact.fixture ?? {};
  const traceability = artifact.evidence?.traceability ?? {};
  return {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.protocol,
    target: artifact.target,
    claim: artifact.claim,
    fixture: {
      source: {
        path: fixture.source?.path,
        bytes: fixture.source?.bytes,
        sha256: fixture.source?.sha256,
        canonicalBytes: fixture.source?.canonicalBytes,
        digest: fixture.source?.digest,
        containsAuthoring: fixture.source?.containsAuthoring,
      },
      bundle: {
        path: fixture.bundle?.path,
        bytes: fixture.bundle?.bytes,
        sha256: fixture.bundle?.sha256,
        canonicalBytes: fixture.bundle?.canonicalBytes,
        revision: fixture.bundle?.revision,
        containsAuthoring: fixture.bundle?.containsAuthoring,
      },
      managedSurfaces: fixture.managedSurfaces,
      catalog: fixture.catalog,
      validation: fixture.validation,
    },
    integration: artifact.integration,
    independentBuild: artifact.independentBuild,
    compatibility: artifact.compatibility,
    tests: artifact.evidence?.tests,
    sourceAssertions: artifact.evidence?.sourceAssertions,
    productionImports: artifact.evidence?.productionImports,
    dynamicExecutableImports: artifact.evidence?.dynamicExecutableImports,
    officialCompositionJsx: artifact.evidence?.officialCompositionJsx,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    traceability: {
      canonicalTrace: Array.isArray(traceability.canonicalTrace)
        ? traceability.canonicalTrace.map(
            (entry) => `${entry?.collection}:${entry?.id}:${entry?.section}`,
          )
        : undefined,
      normativeStatusChanges: traceability.normativeStatusChanges,
      proofClaimStatusChanges: traceability.proofClaimStatusChanges,
      normativeStatus: traceability.normativeStatus,
      proofClaims: traceability.proofClaims,
      productionRuntimeConformance: traceability.productionRuntimeConformance,
      gate: traceability.gate,
    },
    historicalArtifactsRewritten: artifact.evidence?.historicalArtifactsRewritten,
    nonclaims: artifact.nonclaims?.length,
  };
}

function inspectHistoricalArtifact(bytes) {
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || sha256(bytes) !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "REFERENCE_HOST_SIGN_IN_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T08 artifact bytes changed.",
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "REFERENCE_HOST_SIGN_IN_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T08 artifact is not valid JSON.",
    );
  }
  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((entry) => entry?.path);
  const trackedPathsValid =
    trackedFiles.length === EXPECTED_SEMANTICS.trackedFiles &&
    new Set(trackedPaths).size === trackedPaths.length &&
    trackedFiles.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof entry.path === "string" &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0 &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.sha256),
    );
  if (
    !isDeepStrictEqual(artifactProjection(artifact), EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    !trackedPathsValid ||
    artifact.evidence?.focusedScripts?.length !== 4
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T08 artifact lost reviewed semantics or inventory.",
    );
  }
  return freezeJson(artifact);
}

function sectionText(markdown, heading, nextSection) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && nextSection(line));
  return lines.slice(start, end === -1 ? lines.length : end).join("\n");
}

function tableRowText(markdown, claimId) {
  const prefix = `| ${claimId} |`;
  const rows = markdown.split(/\r?\n/u).filter((line) => line.startsWith(prefix));
  if (rows.length !== 1) {
    fail(
      "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT",
      `Expected one exact Proof Matrix ${claimId} row.`,
    );
  }
  return rows[0];
}

function verifyLocationPin(location, pathToken, shaToken, associationToken, label) {
  const pathCount = location.split(pathToken).length - 1;
  const shaCount = location.split(shaToken).length - 1;
  const associationCount = location.split(associationToken).length - 1;
  if (pathCount !== 1 || shaCount !== 1 || associationCount !== 1) {
    fail(
      "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_DRIFT",
      `M05-T08 ${label} artifact path and SHA association moved, changed, or became ambiguous.`,
      { pathCount, shaCount, associationCount },
    );
  }
}

function verifyProofDocument(text) {
  verifyLocationPin(
    sectionText(text, "## Evidence artifact", (line) => line.startsWith("## ")),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\``,
    `- path: \`${ARTIFACT_RELATIVE_PATH}\`\n- SHA-256: \`sha256:${HISTORICAL_ARTIFACT_SHA256}\``,
    "proof document",
  );
}

function verifyDocumentation(proofText, matrixText, projectStatusText) {
  verifyProofDocument(proofText);
  const matrixPathToken = `\`${ARTIFACT_FILE_NAME}\``;
  const matrixShaToken = `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\``;
  for (const claimId of ["P-06", "P-10"]) {
    verifyLocationPin(
      tableRowText(matrixText, claimId),
      matrixPathToken,
      matrixShaToken,
      `${matrixPathToken} ${matrixShaToken}`,
      `Proof Matrix ${claimId} row`,
    );
  }
  verifyLocationPin(
    sectionText(matrixText, "## M05-T08", (line) => line.startsWith("## ")),
    matrixPathToken,
    matrixShaToken,
    `${matrixPathToken}\n${matrixShaToken}`,
    "Proof Matrix M05-T08 section",
  );
  verifyLocationPin(
    sectionText(
      projectStatusText,
      "M05-T08 evidence:",
      (line) => /^M\d{2}-T\d{2} evidence:$/u.test(line) || line.startsWith("## "),
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`${HISTORICAL_ARTIFACT_SHA256}\``,
    `- \`${ARTIFACT_RELATIVE_PATH}\`\n- artifact SHA-256:\n  \`${HISTORICAL_ARTIFACT_SHA256}\``,
    "Project Status",
  );
}

function exactHistoricalSha(value, label) {
  if (value !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      `Historical M05-T08 ${label} requires the exact immutable artifact SHA-256.`,
    );
  }
}

/** Verifies the unique immutable M05-T08 proof-document path and digest location. */
export function verifyReferenceHostWebSignInProofDocument(text, artifactSha256) {
  const boundedText = optionalText(text, "proofDocumentText");
  if (boundedText === undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 proof-document verification requires bounded text.",
    );
  }
  exactHistoricalSha(artifactSha256, "proof-document verification");
  verifyProofDocument(boundedText);
  return Object.freeze({ result: "PASS", exactReferences: 2 });
}

/** Verifies ten contextual immutable M05-T08 references across the reviewed status documents. */
export function verifyReferenceHostWebSignInDocumentation(
  proofText,
  matrixText,
  projectStatusText,
  artifactSha256,
) {
  const boundedProof = optionalText(proofText, "proofDocumentText");
  const boundedMatrix = optionalText(matrixText, "proofMatrixText");
  const boundedStatus = optionalText(projectStatusText, "projectStatusText");
  if (boundedProof === undefined || boundedMatrix === undefined || boundedStatus === undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 documentation verification requires three bounded texts.",
    );
  }
  exactHistoricalSha(artifactSha256, "documentation verification");
  verifyDocumentation(boundedProof, boundedMatrix, boundedStatus);
  return Object.freeze({ result: "PASS", exactReferences: 10 });
}

function historicalInspectionProjection(artifact) {
  const integration = artifact.integration;
  return freezeJson({
    prerequisites: artifact.prerequisites,
    fixtures: artifact.fixture,
    production: {
      documentId: integration.documentId,
      revision: integration.revision,
      entrySurface: integration.entrySurface,
      successSurface: integration.successSurface,
      operation: integration.operation,
      navigation: integration.navigation,
      httpBinding: integration.httpBinding,
      productionImports: HISTORICAL_PRODUCTION_IMPORTS,
      dynamicExecutableCalls: artifact.evidence.dynamicExecutableImports,
      officialCompositionJsx: artifact.evidence.officialCompositionJsx,
      t07Compatibility: artifact.compatibility,
    },
    tests: artifact.evidence.tests,
    traceability: artifact.evidence.traceability.canonicalTrace,
    sourceAssertions: artifact.evidence.sourceAssertions,
  });
}

/**
 * @deprecated Returns the frozen task-time M05-T08 inspection projection from the authenticated
 * artifact. It never reads successor workspace source, dependencies, tests, or build output.
 */
export async function inspectReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["workspaceRoot"], "inspect");
  await validateHistoricalWorkspaceRoot(options.workspaceRoot);
  const built = await buildReferenceHostWebSignInEvidence();
  return historicalInspectionProjection(built.artifact);
}

/** Reads exact immutable M05-T08 evidence without consulting current successor source or tests. */
export async function buildReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "artifactPath", "artifactBytes"],
    "build",
  );
  await validateHistoricalWorkspaceRoot(options.workspaceRoot);
  if (options.artifactPath !== undefined && options.artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH;
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const historicalBytes =
    artifactBytes ??
    (await readRegularFile(
      artifactPath,
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_MISSING",
      "REFERENCE_HOST_SIGN_IN_ARTIFACT_UNSAFE",
      HISTORICAL_ARTIFACT_BYTES,
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/** Verifies immutable M05-T08 bytes, reviewed semantics, inventory, and exact proof pins. */
export async function verifyReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "workspaceRoot",
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "projectStatusPath",
      "projectStatusText",
    ],
    "verify",
  );
  await validateHistoricalWorkspaceRoot(options.workspaceRoot);
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  const projectStatusPath = optionalString(options.projectStatusPath, "projectStatusPath");
  const projectStatusText = optionalText(options.projectStatusText, "projectStatusText");
  for (const [pathValue, textValue, label] of [
    [proofPath, proofDocumentText, "proof document"],
    [proofMatrixPath, proofMatrixText, "Proof Matrix"],
    [projectStatusPath, projectStatusText, "Project Status"],
  ]) {
    if (pathValue !== undefined && textValue !== undefined) {
      fail(
        "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
        `Historical M05-T08 verification accepts either ${label} path or text, not both.`,
      );
    }
  }
  const built = await buildReferenceHostWebSignInEvidence({
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const [proofText, matrixText, statusText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROOF_MATRIX_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    projectStatusText ??
      readRegularFile(
        projectStatusPath ?? DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_PROJECT_STATUS_PATH,
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_MISSING",
        "REFERENCE_HOST_SIGN_IN_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation(proofText, matrixText, statusText);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    compatibilityMode: COMPATIBILITY_MODE,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    sourceAssertions: EXPECTED_SEMANTICS.sourceAssertions,
    focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
    fullAppTests: EXPECTED_SEMANTICS.tests.fullAppCases,
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    traceEntries: EXPECTED_SEMANTICS.traceability.canonicalTrace.length,
    buildFiles: EXPECTED_SEMANTICS.independentBuild.fileCount,
    buildAggregateSha256: EXPECTED_SEMANTICS.independentBuild.aggregateSha256,
    exactDocumentationReferences: 10,
  });
}

/**
 * Authenticates immutable M05-T08 task-time bytes without writing any path.
 *
 * The historical "write" name remains only for API compatibility. Successor tasks cannot use it
 * to create, replace, touch, rename, or otherwise mutate either the canonical artifact or an
 * alternate destination.
 */
export async function writeReferenceHostWebSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["workspaceRoot", "sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  await validateHistoricalWorkspaceRoot(options.workspaceRoot);
  if (Object.hasOwn(options, "beforeAtomicRename")) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 writer is read-only and rejects atomic-write callbacks.",
    );
  }
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (sourceArtifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const requestedArtifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH;
  if (
    path.resolve(requestedArtifactPath) !==
    path.resolve(DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_OPTIONS_INVALID",
      "Historical M05-T08 writer is read-only and rejects alternate destinations.",
    );
  }

  const canonical = await buildReferenceHostWebSignInEvidence({
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
  });
  const authenticatedInput =
    sourceArtifactPath === undefined && artifactBytes === undefined
      ? canonical
      : await buildReferenceHostWebSignInEvidence({
          ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: options.workspaceRoot }),
          ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
          ...(artifactBytes === undefined ? {} : { artifactBytes }),
        });
  if (
    authenticatedInput.artifactSha256 !== canonical.artifactSha256 ||
    !authenticatedInput.artifactBytes.equals(canonical.artifactBytes)
  ) {
    fail(
      "REFERENCE_HOST_SIGN_IN_HISTORICAL_ARTIFACT_DRIFT",
      "Historical M05-T08 writer input differs from the canonical immutable artifact.",
    );
  }

  return Object.freeze({
    result: canonical.artifact.result,
    artifactPath: DEFAULT_REFERENCE_HOST_WEB_SIGN_IN_ARTIFACT_PATH,
    artifactSha256: canonical.artifactSha256,
    artifactBytes: canonical.artifactBytes.length,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    sourceAssertions: EXPECTED_SEMANTICS.sourceAssertions,
    focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
    fullAppTests: EXPECTED_SEMANTICS.tests.fullAppCases,
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    traceEntries: EXPECTED_SEMANTICS.traceability.canonicalTrace.length,
    buildFiles: EXPECTED_SEMANTICS.independentBuild.fileCount,
    buildAggregateSha256: EXPECTED_SEMANTICS.independentBuild.aggregateSha256,
    compatibilityMode: COMPATIBILITY_MODE,
    preserved: true,
  });
}
