import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-HEADLESS-SIGN-IN.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";

/** Absolute path to the immutable task-time M04-T16/G04 headless sign-in artifact. */
export const DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T03",
    artifact: "runtime-core-0.1.0-token-format-resolution.json",
    sha256: "be2d07ae32537ef5c2aec04c783f2cfb30cbcc500a85020172e2b8715a98800f",
  }),
  Object.freeze({
    task: "M04-T04",
    artifact: "runtime-core-0.1.0-predicate-evaluation.json",
    sha256: "14b74cd4f0c35e76edd77858443edf8515b3a60a247afe75131095d5a0c3bcf1",
  }),
  Object.freeze({
    task: "M04-T05",
    artifact: "runtime-core-0.1.0-variant-style-evaluation.json",
    sha256: "46fb343d6639998c1b75403271a0e765c214b32880385ebe30bd649bd60d369e",
  }),
  Object.freeze({
    task: "M04-T06",
    artifact: "runtime-core-0.1.0-local-state-identity.json",
    sha256: "4183404aa991af06740a22bc62ff42028ed584edd6feb158095408904a764b13",
  }),
  Object.freeze({
    task: "M04-T07",
    artifact: "runtime-core-0.1.0-repeat-materialization.json",
    sha256: "45ba72f21f936931d087982d8a52e6b4d226a33ed5693c2d3d6bf9158fddb02d",
  }),
  Object.freeze({
    task: "M04-T08",
    artifact: "runtime-core-0.1.0-resource-lifecycle.json",
    sha256: "2d6ab2e5b6a480e922425faa109e13cc5d388a5de00b2604cbfec62345b01c82",
  }),
  Object.freeze({
    task: "M04-T09",
    artifact: "runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
  }),
  Object.freeze({
    task: "M04-T10",
    artifact: "runtime-core-0.1.0-state-navigation-actions.json",
    sha256: "f9eddfdf915ace33d77df6491de39ad84e9d60d56e2269433c223a79696ad140",
  }),
  Object.freeze({
    task: "M04-T11",
    artifact: "runtime-core-0.1.0-operation-resource-actions.json",
    sha256: "b955cc9f3399d2dbb1895036828c6ab01dbd78ac198c3be5824720f2802295a7",
  }),
  Object.freeze({
    task: "M04-T12",
    artifact: "runtime-core-0.1.0-command-event-actions.json",
    sha256: "8098184e5c25857a108e93dd4638556f1af0446fad9847b8ce44c9f8c2d79be4",
  }),
  Object.freeze({
    task: "M04-T13",
    artifact: "runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    task: "M04-T14",
    artifact: "runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
  Object.freeze({
    task: "M04-T15",
    artifact: "runtime-core-0.1.0-reactive-reevaluation.json",
    sha256: "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
  }),
]);

const EXPECTED_SCENARIOS = Object.freeze({
  success: Object.freeze({
    runs: 2,
    canonicalEqual: true,
    traceEntries: 6,
    canonicalCodeUnits: 13_808,
    sha256: "4322fcc0a4c927ff29e406ec6d975afd8cd926110c9d76d7afdbe8cff064f009",
  }),
  failureRetry: Object.freeze({
    runs: 2,
    canonicalEqual: true,
    traceEntries: 8,
    canonicalCodeUnits: 20_571,
    sha256: "9cb9fcaa75e5486e2d34111b6258ab944115cd7e69421d88da47c68e2be581c5",
  }),
  staleReplacement: Object.freeze({
    runs: 2,
    canonicalEqual: true,
    traceEntries: 10,
    canonicalCodeUnits: 29_374,
    sha256: "10fcb7dafa7a067f7a9e83437c0bdbee2c8a297db3374d6b88fc723cd02809d1",
  }),
});

const EXPECTED_PUBLIC_API = Object.freeze({
  runtimeExports: 7,
  typeExports: 22,
  totalExports: 29,
  moduleExports: 35,
  tsdocDeclarations: 35,
});

const EXPECTED_LIMITS = Object.freeze({
  maxNodes: 5_000,
  maxDepth: 128,
  maxBindingCandidates: 5_000,
  maxEventHandlerBindings: 5_000,
  maxSurfaceTransitions: 64,
  maxSnapshotGeneration: Number.MAX_SAFE_INTEGER,
  maxPlanJsonOccurrences: 262_144,
  maxPlanCodeUnits: 4_194_304,
});

const EXPECTED_SOURCE_INVARIANTS = Object.freeze({
  materialization: Object.freeze({
    ingressAuthorityChecks: 2,
    frozenSurfaceChecks: 5,
    completeTraversalChecks: 6,
    repeatChecks: 3,
    resolutionChecks: 5,
    commitmentChecks: 4,
    sidecarAuthenticationChecks: 3,
    finiteLimitChecks: 5,
    imports: 11,
    platformEffects: 0,
  }),
  session: Object.freeze({
    unknownIngressChecks: 5,
    exactPackageChecks: 4,
    sharedHostChecks: 5,
    commitmentJoinChecks: 6,
    eventOriginChecks: 6,
    sevenNamespaceChecks: 7,
    reconciliationChecks: 8,
    settlementObservationChecks: 6,
    navigationChecks: 5,
    disposalChecks: 6,
    finiteLimitChecks: 8,
    imports: 17,
    platformEffects: 0,
  }),
});

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M04-T16",
  gate: "G04",
  result: "PASS",
  protocol: "0.1.0",
  target: "platform-neutral",
  taskStatusChanges: Object.freeze(["M04-T16:NOT_STARTED->DONE"]),
  gateStatusChanges: Object.freeze(["G04:NOT_STARTED->DONE"]),
  normativeStatusChanges: Object.freeze(["N-003:PLANNED->TESTED"]),
  publicApi: EXPECTED_PUBLIC_API,
  limits: EXPECTED_LIMITS,
  sourceInvariants: EXPECTED_SOURCE_INVARIANTS,
  deterministicRuns: 6,
  sessionsPerScenario: 2,
  scenarioCount: 3,
  scenarios: EXPECTED_SCENARIOS,
  traceEntries: 48,
  traceCanonicalCodeUnits: 127_563,
  traceSha256: "50f0005ec5447e673a46f91a7daf1be52827f0e7fc7d3941976ed1e8ceb798ce",
  executableValues: 0,
  platformValues: 0,
  staleNavigations: 0,
  frozenTraceEnvelopes: 58,
  focusedTestRegistrations: 34,
  focusedTests: 34,
  compilerNegativeCases: 11,
  rootMutationTests: 24,
  trackedFiles: 21,
  auditedTraceRules: 72,
  currentTraceRules: 67,
  deferredTraceRules: 5,
  verifierTransfers: 4,
  documentation: Object.freeze({
    normativeStatusChanges: 1,
    proofMatrixStatusChanges: 0,
    taskStatusChanges: 2,
    findings: 3,
  }),
  deferredClaims: 6,
});

/** Controlled compatibility-verifier failure for immutable M04-T16/G04 evidence. */
export class RuntimeCoreHeadlessSignInEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreHeadlessSignInEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreHeadlessSignInEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function captureOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail(
      "HEADLESS_OPTIONS_INVALID",
      `Historical M04-T16 ${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "HEADLESS_OPTIONS_INVALID",
      `Historical M04-T16 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "HEADLESS_OPTIONS_INVALID",
      `Historical M04-T16 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "HEADLESS_OPTIONS_INVALID",
        `Historical M04-T16 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "HEADLESS_OPTIONS_INVALID",
        `Historical M04-T16 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function readRegularFile(filePath) {
  let entry;
  try {
    entry = await lstat(filePath);
  } catch (error) {
    fail("HEADLESS_ARTIFACT_MISSING", `Historical M04-T16 artifact is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      "HEADLESS_ARTIFACT_UNSAFE",
      `Historical M04-T16 artifact must be a regular non-symlink file: ${filePath}.`,
    );
  }
  return readFile(filePath);
}

function artifactBytes(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail("HEADLESS_OPTIONS_INVALID", `Historical M04-T16 ${label} must be a non-Proxy Buffer.`);
  }
  return Buffer.from(value);
}

function optionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    fail("HEADLESS_OPTIONS_INVALID", `Historical M04-T16 ${label} must be a string.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("HEADLESS_OPTIONS_INVALID", `Historical M04-T16 ${label} must be a non-Proxy function.`);
  }
  return value;
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "HEADLESS_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M04-T16/G04 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "HEADLESS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T16/G04 artifact is not valid JSON.",
    );
  }
  const verifierCompatibility = artifact.evidence?.historicalVerifierCompatibility;
  const referenceCompatibility = artifact.evidence?.historicalReferenceParityCompatibility;
  const actual = {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    gate: artifact.gate,
    result: artifact.result,
    protocol: artifact.claim?.protocol,
    target: artifact.claim?.target,
    taskStatusChanges: artifact.claim?.taskStatusChanges,
    gateStatusChanges: artifact.claim?.gateStatusChanges,
    normativeStatusChanges: artifact.claim?.normativeStatusChanges,
    publicApi: artifact.publicApi,
    limits: artifact.limits,
    sourceInvariants: artifact.sourceInvariants,
    deterministicRuns: artifact.runtime?.deterministicRuns,
    sessionsPerScenario: artifact.runtime?.sessionsPerScenario,
    scenarioCount: artifact.runtime?.scenarioCount,
    scenarios: artifact.runtime?.scenarios,
    traceEntries: artifact.runtime?.traceEntries,
    traceCanonicalCodeUnits: artifact.runtime?.traceCanonicalCodeUnits,
    traceSha256: artifact.runtime?.traceSha256,
    executableValues: artifact.runtime?.executableValues,
    platformValues: artifact.runtime?.platformValues,
    staleNavigations: artifact.runtime?.staleNavigations,
    frozenTraceEnvelopes: artifact.runtime?.frozenTraceEnvelopes,
    focusedTestRegistrations: artifact.evidence?.focusedTestRegistrations,
    focusedTests: artifact.evidence?.focusedTests,
    compilerNegativeCases: artifact.evidence?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.rootMutationTests,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    auditedTraceRules: artifact.evidence?.traceAssignments?.auditedBaseline?.uniqueRules,
    currentTraceRules: artifact.evidence?.traceAssignments?.currentApplicable?.uniqueRules,
    deferredTraceRules: artifact.evidence?.traceAssignments?.classifications?.["future-deferred"],
    verifierTransfers:
      verifierCompatibility?.currentOwnerTask === "M04-T16"
        ? (verifierCompatibility.transferredPaths?.length ?? 0) +
          (referenceCompatibility?.transferredPaths?.length ?? 0)
        : 0,
    documentation: artifact.documentation,
    deferredClaims: artifact.deferred?.length,
  };
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    verifierCompatibility?.historicalTask !== "M02-T09" ||
    verifierCompatibility?.currentOwnerTask !== "M04-T16" ||
    verifierCompatibility?.unknownOrRegressiveStatusAccepted !== false ||
    referenceCompatibility?.historicalTask !== "M03-T09" ||
    referenceCompatibility?.currentOwnerTask !== "M04-T16" ||
    referenceCompatibility?.unknownOrRegressiveStatusAccepted !== false ||
    artifact.runtime?.trace === undefined
  ) {
    fail(
      "HEADLESS_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T16/G04 artifact lost its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return Object.freeze(artifact);
}

function sectionLines(markdown, heading, code) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) fail(code, `Expected one exact ${heading} section.`);
  const start = indexes[0];
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return Object.freeze({
    all: lines,
    section: lines.slice(start, next === -1 ? lines.length : next),
  });
}

function countContaining(lines, needle) {
  return lines.filter((line) => line.includes(needle)).length;
}

function verifyDocumentation(proofText, matrixText) {
  const proof = sectionLines(proofText, "## Evidence boundary", "HEADLESS_PROOF_PIN_DRIFT");
  if (
    countContaining(proof.all, ARTIFACT_RELATIVE_PATH) !== 1 ||
    countContaining(proof.all, HISTORICAL_ARTIFACT_SHA256) !== 1 ||
    countContaining(proof.section, `\`${ARTIFACT_RELATIVE_PATH}\`.`) !== 1 ||
    countContaining(proof.section, `\`${HISTORICAL_ARTIFACT_SHA256}\`.`) !== 1
  ) {
    fail(
      "HEADLESS_PROOF_PIN_DRIFT",
      "M04-T16 proof artifact path or SHA moved, changed, or became ambiguous.",
    );
  }

  const matrix = sectionLines(matrixText, "## M04-T16 / G04", "HEADLESS_PROOF_PIN_DRIFT");
  const artifactName = path.basename(ARTIFACT_RELATIVE_PATH);
  if (
    countContaining(matrix.all, artifactName) !== 3 ||
    countContaining(matrix.all, HISTORICAL_ARTIFACT_SHA256) !== 1 ||
    matrix.section.filter((line) => line === `\`${artifactName}\``).length !== 1 ||
    matrix.section.filter((line) => line === `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`).length !==
      1
  ) {
    fail(
      "HEADLESS_PROOF_PIN_DRIFT",
      "M04-T16 Proof Matrix artifact path or SHA moved, changed, or became ambiguous.",
    );
  }
}

function summarizeEvidence(evidence, compatibilityMode = undefined) {
  const artifact = evidence.artifact;
  const runtime = artifact.runtime;
  const summary = {
    result: "PASS",
    artifactSha256: evidence.artifactSha256,
    runtimeExports: artifact.publicApi.runtimeExports,
    typeExports: artifact.publicApi.typeExports,
    moduleExports: artifact.publicApi.moduleExports,
    tsdocDeclarations: artifact.publicApi.tsdocDeclarations,
    focusedTests: artifact.evidence.focusedTests,
    compilerNegativeCases: artifact.evidence.compilerNegativeCases,
    rootMutationTests: artifact.evidence.rootMutationTests,
    traceRules: artifact.evidence.traceAssignments.auditedBaseline.uniqueRules,
    currentTraceRules: artifact.evidence.traceAssignments.currentApplicable.uniqueRules,
    deferredTraceRules: artifact.evidence.traceAssignments.classifications["future-deferred"],
    historicalVerifierTransfers: 4,
    normativeStatusChanges: artifact.documentation.normativeStatusChanges,
    proofMatrixStatusChanges: artifact.documentation.proofMatrixStatusChanges,
    trackedFiles: artifact.evidence.trackedFiles.length,
    deterministicRuns: runtime.deterministicRuns,
    sessionsPerScenario: runtime.sessionsPerScenario,
    scenarioCount: runtime.scenarioCount,
    scenarios: runtime.scenarios,
    traceEntries: runtime.traceEntries,
    traceCanonicalCodeUnits: runtime.traceCanonicalCodeUnits,
    traceSha256: runtime.traceSha256,
    jsonOccurrences: runtime.jsonOccurrences,
    executableValues: runtime.executableValues,
    platformValues: runtime.platformValues,
    ingressRejections: runtime.ingressRejections,
    successOperationCalls: runtime.successOperationCalls,
    successNavigationCalls: runtime.successNavigationCalls,
    failureRetryAttempts: runtime.failureRetryAttempts,
    staleRaceAttempts: runtime.staleRaceAttempts,
    staleNavigations: runtime.staleNavigations,
    exactOnceSubscriptionCleanups: runtime.exactOnceSubscriptionCleanups,
    frozenTraceEnvelopes: runtime.frozenTraceEnvelopes,
  };
  if (compatibilityMode !== undefined) summary.compatibilityMode = compatibilityMode;
  return Object.freeze(summary);
}

/**
 * Reads only the exact immutable M04-T16/G04 artifact and its reviewed semantic inventory.
 *
 * @remarks M05-T04 owns all current headless-session source, API, and command-attachment
 * verification. Successor source, runtime modules, probes, prerequisites, and build overrides are
 * deliberately outside this historical compatibility reader.
 */
export async function buildRuntimeCoreHeadlessSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const resolvedPath = artifactPath ?? DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH;
  const historicalBytes = injectedBytes ?? (await readRegularFile(resolvedPath));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M04-T16/G04 bytes, semantics, inventory, and exact documentation pins. */
export async function verifyRuntimeCoreHeadlessSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofDocumentText",
      "proofMatrixText",
      "proofPath",
      "proofMatrixPath",
    ],
    "verify",
  );
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const proofDocumentText = optionalString(options.proofDocumentText, "proofDocumentText");
  const proofMatrixText = optionalString(options.proofMatrixText, "proofMatrixText");
  const proofPath = optionalString(options.proofPath, "proofPath");
  const proofMatrixPath = optionalString(options.proofMatrixPath, "proofMatrixPath");
  const built = await buildRuntimeCoreHeadlessSignInEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const [proofText, matrixText] = await Promise.all([
    proofDocumentText ??
      readFile(proofPath ?? path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH), "utf8"),
    proofMatrixText ??
      readFile(proofMatrixPath ?? path.join(WORKSPACE_ROOT, PROOF_MATRIX_PATH), "utf8"),
  ]);
  verifyDocumentation(proofText, matrixText);
  return summarizeEvidence(built, "immutable-task-time-artifact");
}

/** Atomically copies only exact already-authenticated immutable M04-T16/G04 bytes. */
export async function writeRuntimeCoreHeadlessSignInEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeCoreHeadlessSignInEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const artifactPath = destinationPath ?? DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH;
  if (
    path.resolve(artifactPath) === path.resolve(DEFAULT_RUNTIME_CORE_HEADLESS_SIGN_IN_ARTIFACT_PATH)
  ) {
    return Object.freeze({
      ...summarizeEvidence(built, "immutable-task-time-artifact"),
      artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
      preserved: true,
    });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("HEADLESS_ARTIFACT_UNSAFE", "Atomic M04-T16 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    ...summarizeEvidence(built, "immutable-task-time-artifact"),
    artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
  });
}
