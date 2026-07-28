import { createHash } from "node:crypto";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/reference-host-web-0.1.0-shell.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_PATH = "docs/proof/REFERENCE-HOST-WEB-SHELL.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";
const PROJECT_STATUS_PATH = "PROJECT-STATUS.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "cafaf8e9ec0b8be207344b25e076541b395c83e348f665dc7b97e5c4cb4000f2";
const HISTORICAL_ARTIFACT_BYTES = 16_213;
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

/** Absolute path to the immutable task-time M05-T07 proof artifact. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the immutable M05-T07 human-readable proof. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_PATH,
);

/** Absolute path to the exact M05-T07 Proof Matrix pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_PATH,
);

/** Absolute path to the exact M05-T07 project-status pin. */
export const DEFAULT_REFERENCE_HOST_WEB_SHELL_PROJECT_STATUS_PATH = path.join(
  WORKSPACE_ROOT,
  PROJECT_STATUS_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T06",
    path: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
    sha256: "sha256:3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723",
    profile: "desen-runtime-react-failure-boundary-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T01",
    path: "docs/proof/artifacts/runtime-core-0.1.0-host-ports.json",
    sha256: "sha256:5a53cfc9698339a2e9da72c496c1b204e0da138da3d3c1efdc1fe0b5c0e4f190",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T10",
    path: "docs/proof/artifacts/runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "sha256:f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
    result: "PASS",
  }),
  Object.freeze({
    task: "M02-T02",
    path: "docs/proof/artifacts/protocol-0.1.0-traceability.json",
    sha256: "sha256:749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514",
    result: "PASS",
  }),
]);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T07",
  result: "PASS",
  profile: "desen-reference-host-web-shell-v1",
  protocol: "0.1.0",
  target: "web-react",
  claim: Object.freeze({
    independentlyBuiltApplication: true,
    dedicatedDesenReactRoot: true,
    explicitNinePortHostBoundary: true,
    staticHostFailureSurface: true,
    rawRootErrorTelemetry: false,
    arbitraryManagedReactTreeInput: false,
    handwrittenManagedTreeFullyAudited: false,
    officialSignInExecuted: false,
  }),
  hostShell: Object.freeze({
    package: "@desen/reference-host-web",
    build: Object.freeze({
      tool: "vite@8.1.5",
      independentBuilds: 2,
      deterministic: true,
      fileCount: 3,
      aggregateSha256: "sha256:e8c6a400c4507763f96172109d8aa8931f7707f5885d9ae5ec9ec0b90276a2c8",
      files: Object.freeze([
        Object.freeze({
          path: "assets/index-BOcgSXd_.js",
          bytes: 339_777,
          sha256: "sha256:c6c5a47f41ff68762a67a818ff4a9cc46112a784772e3a2b6cdfcda6d86f6ad6",
        }),
        Object.freeze({
          path: "assets/index-ClMarVVR.css",
          bytes: 1_637,
          sha256: "sha256:bbfe758b463bca14d58440da1cd0b7c60b3ac4f427ba4c8b41ac7744e2cd1672",
        }),
        Object.freeze({
          path: "index.html",
          bytes: 480,
          sha256: "sha256:9913a1c8445d26c48f4160665db8151b19c254852abbc62e60c152854986491e",
        }),
      ]),
    }),
    composition: Object.freeze({
      applicationStates: Object.freeze(["booting", "surface", "unavailable"]),
      managedInput: "RuntimeReactLiveSurfaceInput",
      liveRenderer: "useRuntimeReactSurface",
      productionBoundary: "RuntimeReactSurfaceBoundary",
      arbitraryReactChildren: false,
      capabilitySpecificComposition: false,
      finalSourceImportAuditOwner: "M05-T09",
    }),
    rootPolicy: Object.freeze({
      dedicatedClientRoot: true,
      onCaughtError: "ignoreRuntimeReactRootCaughtError",
      onUncaughtError: "fixed-redacted-host-diagnostic",
      onRecoverableError: "fixed-redacted-host-diagnostic",
      rawErrorInspected: false,
      rawErrorForwarded: false,
      uncaughtFailureTerminallyRevokesAuthorities: true,
      terminalFencePrecedesObservability: true,
      fullRootUnmountFailure: "fixed-redacted-host-diagnostic",
      failedUnmountRetainsContainerClaim: true,
      idempotentDisposal: true,
    }),
    recovery: Object.freeze({
      authorityInputs: Object.freeze(["session", "registry", "catalogSet", "hostAuthority"]),
      hostAuthorityAuthentication: "exact-session-handle-and-original-host-port-aggregate-identity",
      hostAuthorityAuthenticationReturnsPorts: false,
      hostAuthorityAuthenticationReflectsIntoPorts: false,
      adapterAuthorityAuthentication: "exact-current-snapshot-and-catalog-set",
      documentAuthorityAuthentication:
        "exact-active-runtime-web-authority-and-session-document-revision",
      registryAuthorityAuthentication: "factory-authenticated-runtime-react-registry-handle",
      activationCommitAfterAllAuthenticators: true,
      replacementReentryFence: true,
      ordinaryPublicationChangesKey: false,
      explicitRetryChangesKey: true,
      authorityReplacementChangesKey: true,
      bundleOrRevisionInputChannel: false,
      rootLocalIsolation: true,
    }),
  }),
  browserHostAuthority: Object.freeze({
    package: "@desen/runtime-web",
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
    callbackCount: 14,
    capturedBy: "createRuntimeHostPorts",
    constructionInvokesCallbacks: false,
    navigationIdentity: "exact-document-and-revision",
    documentAuthorityAuthentication: "exact-active-authority-document-and-revision-pair",
    documentAuthorityAuthenticationReturnsExecutableAuthority: false,
    environmentBoundary: "bounded-detached-frozen-json",
    clockBoundary: "nondecreasing-finite-epoch-milliseconds",
    terminalCallbackFence: true,
    channelFetchingClaimed: false,
    indexedDbActivationClaimed: false,
    lastKnownGoodClaimed: false,
  }),
  publicApi: Object.freeze({
    runtimeExports: Object.freeze([
      "authenticateRuntimeWebHostDocumentAuthority",
      "createRuntimeWebBrowserPlatform",
      "createRuntimeWebHostAuthority",
      "disposeRuntimeWebHostAuthority",
      "readRuntimeWebHostAuthority",
    ]),
    typeExports: Object.freeze([
      "RuntimeWebBrowserPlatformCreateInput",
      "RuntimeWebBrowserPlatformCreateResult",
      "RuntimeWebBrowserPlatformHandle",
      "RuntimeWebHostAuthorityCreateInput",
      "RuntimeWebHostAuthorityCreateResult",
      "RuntimeWebHostAuthorityDisposeResult",
      "RuntimeWebHostAuthorityHandle",
      "RuntimeWebHostAuthorityReadResult",
      "RuntimeWebHostDocumentAuthorityInput",
      "RuntimeWebHostDocumentAuthorityResult",
    ]),
  }),
  tests: Object.freeze({
    appFocusedCases: 22,
    runtimeFocusedCases: 15,
    runtimeCoreFocusedCases: 55,
    runtimeCoreSecurityCases: 5,
    focusedCases: 92,
    appCompilerNegativeCases: 6,
    runtimeCompilerNegativeCases: 14,
    runtimeCoreCompilerNegativeCases: 33,
    compilerNegativeCases: 53,
    rootMutationTests: 33,
  }),
  sourceAssertions: 902,
  productionImports: 113,
  dynamicExecutableImports: 0,
  trackedFiles: 42,
  traceability: Object.freeze({
    canonicalTrace: Object.freeze([
      Object.freeze({
        collection: "proseRules",
        id: "R-019",
        section: "9.1",
        disposition: "partial-host-wrapper-evidence",
      }),
      Object.freeze({
        collection: "proseRules",
        id: "R-105",
        section: "24.5",
        disposition: "explicit-host-navigation-port-wired",
      }),
      Object.freeze({
        collection: "invariants",
        id: "A-013",
        section: "Appendix A",
        disposition: "host-owned-integration-profile",
      }),
    ]),
    normativeStatusChanges: Object.freeze([]),
    proofClaimStatusChanges: Object.freeze([]),
    productionRuntimeConformance: "PLANNED",
    proofClaims: Object.freeze({
      "P-06": "PARTIAL",
      "P-07": "NOT_PROVEN",
      "P-17": "PARTIAL",
    }),
  }),
  historicalArtifactsRewritten: false,
  nonclaims: 10,
});

/** Controlled compatibility-reader failure for immutable M05-T07 evidence. */
export class ReferenceHostWebShellEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ReferenceHostWebShellEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new ReferenceHostWebShellEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} options must be a plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
        `Historical M05-T07 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
        `Historical M05-T07 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} must be a non-empty string.`,
    );
  }
  return value;
}

function optionalText(value, label) {
  const text = optionalString(value, label);
  if (text !== undefined && Buffer.byteLength(text, "utf8") > MAX_DOCUMENT_BYTES) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
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
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} must be non-shared non-Proxy bytes.`,
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
        "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
        `Historical M05-T07 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof ReferenceHostWebShellEvidenceError) throw error;
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} must not use shared backing memory.`,
    );
  }
  if (byteLength !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "REFERENCE_HOST_SHELL_HISTORICAL_ARTIFACT_DRIFT",
      `Historical M05-T07 ${label} must contain exactly ${HISTORICAL_ARTIFACT_BYTES} bytes.`,
    );
  }

  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      `Historical M05-T07 ${label} backing memory is detached or invalid.`,
    );
  }
}

async function readRegularFile(filePath, missingCode, unsafeCode, maximumBytes, exactBytes) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail(missingCode, `Historical M05-T07 evidence file is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (
    !entry.isFile() ||
    entry.isSymbolicLink() ||
    entry.size > maximumBytes ||
    (exactBytes !== undefined && entry.size !== exactBytes)
  ) {
    fail(unsafeCode, `Historical M05-T07 evidence is not a safe bounded file: ${filePath}.`);
  }

  let handle;
  try {
    handle = await open(filePath, "r");
    const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(filePath)]);
    if (
      !openedEntry.isFile() ||
      !currentEntry.isFile() ||
      currentEntry.isSymbolicLink() ||
      openedEntry.dev !== currentEntry.dev ||
      openedEntry.ino !== currentEntry.ino
    ) {
      fail(unsafeCode, `Historical M05-T07 evidence changed identity while opening: ${filePath}.`);
    }
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes || (exactBytes !== undefined && bytes.length !== exactBytes)) {
      fail(unsafeCode, `Historical M05-T07 evidence has an invalid byte size: ${filePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof ReferenceHostWebShellEvidenceError) throw error;
    fail(unsafeCode, `Historical M05-T07 evidence could not be read safely: ${filePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function artifactProjection(artifact) {
  return {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.protocol,
    target: artifact.target,
    claim: artifact.claim,
    hostShell: {
      package: artifact.hostShell?.package,
      build: artifact.hostShell?.build,
      composition: artifact.hostShell?.composition,
      rootPolicy: artifact.hostShell?.rootPolicy,
      recovery: artifact.hostShell?.recovery,
    },
    browserHostAuthority: artifact.browserHostAuthority,
    publicApi: artifact.publicApi,
    tests: artifact.evidence?.tests,
    sourceAssertions: artifact.evidence?.sourceAssertions,
    productionImports: artifact.evidence?.productionImports,
    dynamicExecutableImports: artifact.evidence?.dynamicExecutableImports,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    traceability: artifact.evidence?.traceability,
    historicalArtifactsRewritten: artifact.evidence?.historicalArtifactsRewritten,
    nonclaims: artifact.nonclaims?.length,
  };
}

function inspectHistoricalArtifact(bytes) {
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES || sha256(bytes) !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "REFERENCE_HOST_SHELL_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T07 artifact bytes changed.",
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "REFERENCE_HOST_SHELL_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T07 artifact is not valid JSON.",
    );
  }
  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((entry) => entry?.path);
  const trackedPathsValid =
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
      "REFERENCE_HOST_SHELL_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T07 artifact lost reviewed semantics or inventory.",
    );
  }
  return freezeJson(artifact);
}

function sectionLines(markdown, heading, nextSection) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && nextSection(line));
  return lines.slice(start, end === -1 ? lines.length : end);
}

function verifyLocationPin(lines, pathToken, shaToken, associationToken) {
  const section = lines.join("\n");
  if (
    section.split(pathToken).length - 1 !== 1 ||
    section.split(shaToken).length - 1 !== 1 ||
    section.split(associationToken).length - 1 !== 1
  ) {
    fail(
      "REFERENCE_HOST_SHELL_PROOF_PIN_DRIFT",
      "M05-T07 artifact path and SHA association moved, changed, or became ambiguous.",
    );
  }
}

function verifyDocumentation(proofText, matrixText, projectStatusText) {
  verifyLocationPin(
    sectionLines(proofText, "## Evidence artifact", (line) => line.startsWith("## ")),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\``,
    `\`${ARTIFACT_RELATIVE_PATH}\`\n\n\`sha256:${HISTORICAL_ARTIFACT_SHA256}\``,
  );
  verifyLocationPin(
    sectionLines(matrixText, "## M05-T07", (line) => line.startsWith("## ")),
    `\`${ARTIFACT_FILE_NAME}\``,
    `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\``,
    `\`${ARTIFACT_FILE_NAME}\`\n\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`,
  );
  verifyLocationPin(
    sectionLines(
      projectStatusText,
      "M05-T07 evidence:",
      (line) => /^M\d{2}-T\d{2} evidence:$/u.test(line) || line.startsWith("## "),
    ),
    `\`${ARTIFACT_RELATIVE_PATH}\``,
    `\`${HISTORICAL_ARTIFACT_SHA256}\``,
    `- \`${ARTIFACT_RELATIVE_PATH}\`\n- artifact SHA-256:\n  \`${HISTORICAL_ARTIFACT_SHA256}\``,
  );
}

/**
 * Reads exact immutable M05-T07 evidence without consulting current successor source or tests.
 */
export async function buildReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  if (options.artifactPath !== undefined && options.artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      "Historical M05-T07 build accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const artifactPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH;
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const historicalBytes =
    artifactBytes ??
    (await readRegularFile(
      artifactPath,
      "REFERENCE_HOST_SHELL_ARTIFACT_MISSING",
      "REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE",
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

/** Verifies immutable M05-T07 bytes, reviewed semantics, inventory, and exact proof pins. */
export async function verifyReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
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
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      "Historical M05-T07 verification accepts either artifactPath or artifactBytes, not both.",
    );
  }
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  const projectStatusPath = optionalString(options.projectStatusPath, "projectStatusPath");
  const projectStatusText = optionalText(options.projectStatusText, "projectStatusText");
  const built = await buildReferenceHostWebShellEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const [proofText, matrixText, statusText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_PATH,
        "REFERENCE_HOST_SHELL_PROOF_MISSING",
        "REFERENCE_HOST_SHELL_PROOF_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_REFERENCE_HOST_WEB_SHELL_PROOF_MATRIX_PATH,
        "REFERENCE_HOST_SHELL_PROOF_MISSING",
        "REFERENCE_HOST_SHELL_PROOF_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    projectStatusText ??
      readRegularFile(
        projectStatusPath ?? DEFAULT_REFERENCE_HOST_WEB_SHELL_PROJECT_STATUS_PATH,
        "REFERENCE_HOST_SHELL_PROOF_MISSING",
        "REFERENCE_HOST_SHELL_PROOF_UNSAFE",
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
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    buildFiles: EXPECTED_SEMANTICS.hostShell.build.fileCount,
    buildAggregateSha256: EXPECTED_SEMANTICS.hostShell.build.aggregateSha256,
    exactDocumentationReferences: 6,
  });
}

/** Atomically copies only exact already-authenticated immutable M05-T07 task-time bytes. */
export async function writeReferenceHostWebShellEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  if (sourceArtifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "REFERENCE_HOST_SHELL_OPTIONS_INVALID",
      "Historical M05-T07 writer accepts either sourceArtifactPath or artifactBytes, not both.",
    );
  }
  const destinationPath =
    optionalString(options.artifactPath, "artifactPath") ??
    DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildReferenceHostWebShellEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  if (
    sourceArtifactPath === undefined &&
    artifactBytes === undefined &&
    path.resolve(destinationPath) === path.resolve(DEFAULT_REFERENCE_HOST_WEB_SHELL_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      result: built.artifact.result,
      artifactPath: path.resolve(destinationPath),
      artifactSha256: built.artifactSha256,
      artifactBytes: built.artifactBytes.length,
      trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
      focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
      compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
      rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
      buildFiles: EXPECTED_SEMANTICS.hostShell.build.fileCount,
      compatibilityMode: COMPATIBILITY_MODE,
      preserved: true,
    });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("REFERENCE_HOST_SHELL_ARTIFACT_UNSAFE", "Atomic M05-T07 copy failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: path.resolve(destinationPath),
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: EXPECTED_SEMANTICS.trackedFiles,
    focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    buildFiles: EXPECTED_SEMANTICS.hostShell.build.fileCount,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}
