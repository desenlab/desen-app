import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json";
const HISTORICAL_ARTIFACT_SHA256 =
  "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa";
const PROOF_DOCUMENT_PATH = "docs/proof/RUNTIME-CORE-AUDIT-HARDENING.md";
const PROOF_MATRIX_PATH = "docs/proof/PROOF-MATRIX.md";

/** Absolute path to the immutable task-time M04-T17/G04 audit-hardening artifact. */
export const DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M04-T13",
    path: "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
  Object.freeze({
    task: "M04-T14",
    path: "docs/proof/artifacts/runtime-core-0.1.0-adapter-bridges.json",
    sha256: "bfdeddbffd458941464620e0af2013d374bf8e64068ca060d33651ddeb2660c7",
  }),
  Object.freeze({
    task: "M04-T15",
    path: "docs/proof/artifacts/runtime-core-0.1.0-reactive-reevaluation.json",
    sha256: "7e412daf9e2e8f08f40a4b093430775414aa1df4a9b14d690d2bf45966cbec67",
  }),
  Object.freeze({
    task: "M04-T16",
    path: "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json",
    sha256: "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4",
  }),
  Object.freeze({
    task: "M02-T08",
    path: "docs/proof/artifacts/protocol-0.1.0-component-contracts.json",
    sha256: "71cd73475a1c59f734870051bcd6d26a8a2b7bf83caf9bed3d3882da467014ac",
  }),
]);

const EXPECTED_PUBLIC_API = Object.freeze({
  publicRuntimeExports: 2,
  publicTypeExports: 4,
  internalModuleExports: 3,
  tsdocDeclarations: 9,
  maxSubscriptions: 256,
});

const EXPECTED_PROBE = Object.freeze({
  internalModuleObserver: "function",
  internalRootLeaks: Object.freeze([]),
  maxSubscriptions: 256,
  publicSessionFunctions: Object.freeze([
    "subscribeRuntimeHeadlessSession",
    "unsubscribeRuntimeHeadlessSession",
  ]),
});

const EXPECTED_PLATFORM_BOUNDARY = Object.freeze({
  productionFiles: 23,
  modules: Object.freeze([
    "./action-evaluation.js",
    "./action-turns.js",
    "./adapter-bridges.js",
    "./command-event-actions.js",
    "./command-event-ports.js",
    "./headless-materialization.js",
    "./host-ports.js",
    "./local-state.js",
    "./node-identity.js",
    "./operation-lifecycle.js",
    "./operation-resource-actions.js",
    "./predicate-evaluation.js",
    "./reactive-host-ports.js",
    "./reactive-reevaluation.js",
    "./repeat-materialization.js",
    "./resource-lifecycle.js",
    "./runtime-json-snapshot.js",
    "./state-navigation-actions.js",
    "./token-format-resolution.js",
    "./value-resolution.js",
    "./variant-style-evaluation.js",
    "@desen/protocol",
    "@desen/validator",
    "@desen/validator/schema-contract",
    "@desen/validator/schema-contract-syntax",
  ]),
  reactDomBrowserImports: 0,
});

const EXPECTED_TASK_ROWS = Object.freeze([
  Object.freeze({
    id: "M04-T17",
    line: 106,
    sha256: "ff6129b6849409ac02a174fd77cb4e9746171003c3f8024adf4270904ef297ce",
  }),
  Object.freeze({
    id: "G04",
    line: 107,
    sha256: "18c2440d4dd5b732a4e01785c4e9361e19177bb803282d7b675dcfc746643735",
  }),
]);

const EXPECTED_NORMATIVE_ROWS = Object.freeze([
  Object.freeze({
    id: "N-026",
    line: 65,
    owners: "M02-T08, M04-T02, M05-T02",
    status: "PLANNED",
    correctionDate: "2026-07-27",
    sha256: "cab59ebf0a8387e625931e5f178719027ecb043693420c2122abfbeb96d7c7a4",
  }),
  Object.freeze({
    id: "N-028",
    line: 67,
    owners: "M02-T08, M05-T03",
    status: "TESTED",
    correctionDate: null,
    sha256: "fd324729cd2f61c604a01c78ad7eb295b4ab97feb3438a39131c46a5d47ddca0",
  }),
  Object.freeze({
    id: "N-029",
    line: 68,
    owners: "M02-T08, M05-T03",
    status: "PLANNED",
    correctionDate: "2026-07-27",
    sha256: "980b38a99fc536ab20ccbbd41444d6c2b50de1a1818e720a82f718ca084870f8",
  }),
]);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M04-T17",
  gate: "G04",
  result: "PASS",
  profile: "desen-runtime-core-audit-hardening-v1",
  taskStatus: "DONE",
  gateStatus: "DONE",
  publicApi: EXPECTED_PUBLIC_API,
  probe: EXPECTED_PROBE,
  platformBoundary: EXPECTED_PLATFORM_BOUNDARY,
  settlementNotification:
    "finite pre-reserved FIFO; exactly once after finalization; no same-tick coalescing loss",
  taskRows: EXPECTED_TASK_ROWS,
  normativeRows: EXPECTED_NORMATIVE_ROWS,
  historicalProjection: Object.freeze([
    Object.freeze({ id: "N-026", status: "TESTED" }),
    Object.freeze({ id: "N-028", status: "TESTED" }),
    Object.freeze({ id: "N-029", status: "TESTED" }),
  ]),
  currentStatuses: Object.freeze([
    Object.freeze({ id: "N-026", status: "PLANNED" }),
    Object.freeze({ id: "N-028", status: "TESTED" }),
    Object.freeze({ id: "N-029", status: "PLANNED" }),
  ]),
  corrections: Object.freeze(["N-026:TESTED->PLANNED", "N-029:TESTED->PLANNED"]),
  finding: Object.freeze({
    path: "docs/plan/PROTOCOL-FINDINGS.md",
    heading:
      "## PF-049 — Post-G04 audit corrections require explicit runtime notification and proof migration",
    line: 1704,
    sha256: "04125b2eb2d3bb280b35e23c053c7fce822598e8dc0c058499b5d1f4b4a8b01b",
  }),
  transferredOwnership: 11,
  focusedRegistrations: 69,
  focusedTests: 77,
  compilerNegativeCases: 14,
  rootMutationTests: 13,
  trackedFiles: 21,
  normalizedProofDocumentSha256: "1fb69696767bd6da65d7350b8c8fca5dda017f86d49fff45a46925ad2c0263e2",
  finalArtifactReferences:
    "normalized outside artifact bytes; exact proof and Proof Matrix sections are verified separately",
  deferredClaims: 3,
});

/** Controlled compatibility-verifier failure for immutable M04-T17/G04 evidence. */
export class RuntimeCoreAuditHardeningEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeCoreAuditHardeningEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeCoreAuditHardeningEvidenceError(code, message, details);
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
      "AUDIT_OPTIONS_INVALID",
      `Historical M04-T17 ${label} options must be a plain own-data object.`,
    );
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "AUDIT_OPTIONS_INVALID",
      `Historical M04-T17 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "AUDIT_OPTIONS_INVALID",
      `Historical M04-T17 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "AUDIT_OPTIONS_INVALID",
        `Historical M04-T17 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "AUDIT_OPTIONS_INVALID",
        `Historical M04-T17 ${label} option ${key} must be enumerable own data.`,
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
    fail("AUDIT_ARTIFACT_MISSING", `Historical M04-T17 artifact is missing: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      "AUDIT_ARTIFACT_UNSAFE",
      `Historical M04-T17 artifact must be a regular non-symlink file: ${filePath}.`,
    );
  }
  return readFile(filePath);
}

function artifactBytes(value, label) {
  if (value === undefined) return undefined;
  if (!Buffer.isBuffer(value) || utilTypes.isProxy(value)) {
    fail("AUDIT_OPTIONS_INVALID", `Historical M04-T17 ${label} must be a non-Proxy Buffer.`);
  }
  return Buffer.from(value);
}

function optionalString(value, label) {
  if (value !== undefined && typeof value !== "string") {
    fail("AUDIT_OPTIONS_INVALID", `Historical M04-T17 ${label} must be a string.`);
  }
  return value;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("AUDIT_OPTIONS_INVALID", `Historical M04-T17 ${label} must be a non-Proxy function.`);
  }
  return value;
}

function rowProjection(rows) {
  return rows?.map(({ id, line, sha256: digest }) => ({ id, line, sha256: digest }));
}

function normativeProjection(rows) {
  return rows?.map(({ id, line, owners, status, correctionDate, sha256: digest }) => ({
    id,
    line,
    owners,
    status,
    correctionDate,
    sha256: digest,
  }));
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "AUDIT_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M04-T17/G04 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }
  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "AUDIT_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T17/G04 artifact is not valid JSON.",
    );
  }
  const actual = {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    gate: artifact.gate,
    result: artifact.result,
    profile: artifact.profile,
    taskStatus: artifact.claim?.taskStatus,
    gateStatus: artifact.claim?.gateStatus,
    publicApi: artifact.runtime?.publicApi,
    probe: artifact.runtime?.probe,
    platformBoundary: artifact.runtime?.platformBoundary,
    settlementNotification: artifact.runtime?.settlementNotification,
    taskRows: rowProjection(artifact.migration?.taskLedger?.rows),
    normativeRows: normativeProjection(artifact.migration?.normative?.rows),
    historicalProjection: artifact.migration?.normative?.historicalProjection,
    currentStatuses: artifact.migration?.normative?.currentStatuses,
    corrections: artifact.migration?.normative?.corrections,
    finding: artifact.migration?.finding,
    transferredOwnership: artifact.migration?.transferredOwnership?.length,
    focusedRegistrations: artifact.evidence?.tests?.focusedRegistrations,
    focusedTests: artifact.evidence?.tests?.focusedTests,
    compilerNegativeCases: artifact.evidence?.tests?.compilerNegativeCases,
    rootMutationTests: artifact.evidence?.tests?.rootMutationTests,
    trackedFiles: artifact.evidence?.trackedFiles?.length,
    normalizedProofDocumentSha256: artifact.evidence?.normalizedProofDocumentSha256,
    finalArtifactReferences: artifact.evidence?.finalArtifactReferences,
    deferredClaims: artifact.deferred?.length,
  };
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    artifact.migration?.transferredOwnership?.some(
      (entry) => entry.ownerTask !== "M04-T17" || typeof entry.path !== "string",
    )
  ) {
    fail(
      "AUDIT_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M04-T17/G04 artifact lost its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return Object.freeze(artifact);
}

function sectionLines(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("AUDIT_PROOF_PIN_DRIFT", `Expected one exact ${heading} section.`);
  }
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
  const proof = sectionLines(proofText, "## Evidence artifact");
  if (
    countContaining(proof.all, ARTIFACT_RELATIVE_PATH) !== 1 ||
    countContaining(proof.all, HISTORICAL_ARTIFACT_SHA256) !== 1 ||
    proof.section.filter((line) => line === `\`${ARTIFACT_RELATIVE_PATH}\``).length !== 1 ||
    proof.section.filter((line) => line === `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`).length !==
      1
  ) {
    fail(
      "AUDIT_PROOF_PIN_DRIFT",
      "M04-T17 proof artifact path or SHA moved, changed, or became ambiguous.",
    );
  }

  const matrix = sectionLines(matrixText, "## M04-T17 / G04 audit hardening");
  if (
    countContaining(matrix.all, path.basename(ARTIFACT_RELATIVE_PATH)) !== 3 ||
    countContaining(matrix.all, HISTORICAL_ARTIFACT_SHA256) !== 1 ||
    matrix.section.filter((line) => line === `\`${ARTIFACT_RELATIVE_PATH}\``).length !== 1 ||
    matrix.section.filter((line) => line === `\`sha256:${HISTORICAL_ARTIFACT_SHA256}\`.`).length !==
      1
  ) {
    fail(
      "AUDIT_PROOF_PIN_DRIFT",
      "M04-T17 Proof Matrix artifact path or SHA moved, changed, or became ambiguous.",
    );
  }
}

function summarizeEvidence(evidence, compatibilityMode = undefined) {
  const artifact = evidence.artifact;
  const summary = {
    result: "PASS",
    artifactSha256: evidence.artifactSha256,
    trackedFiles: artifact.evidence.trackedFiles.length,
    rootMutationTests: artifact.evidence.tests.rootMutationTests,
    focusedTests: artifact.evidence.tests.focusedTests,
    compilerNegativeCases: artifact.evidence.tests.compilerNegativeCases,
    publicRuntimeExports: artifact.runtime.publicApi.publicRuntimeExports,
    publicTypeExports: artifact.runtime.publicApi.publicTypeExports,
    internalModuleExports: artifact.runtime.publicApi.internalModuleExports,
    normativeCorrections: artifact.migration.normative.corrections.length,
  };
  if (compatibilityMode !== undefined) summary.compatibilityMode = compatibilityMode;
  return Object.freeze(summary);
}

/**
 * Reads only the exact immutable M04-T17/G04 artifact and its reviewed semantic inventory.
 *
 * @remarks M05-T04 owns current headless-session source/API verification. Successor builds,
 * runtime probes, source overrides, and prerequisite injection cannot enter this historical
 * compatibility reader.
 */
export async function buildRuntimeCoreAuditHardeningEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalString(options.artifactPath, "artifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const resolvedPath = artifactPath ?? DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH;
  const historicalBytes = injectedBytes ?? (await readRegularFile(resolvedPath));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
  });
}

/** Verifies immutable M04-T17/G04 bytes, semantics, inventory, and exact documentation pins. */
export async function verifyRuntimeCoreAuditHardeningEvidence(rawOptions = undefined) {
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
  const built = await buildRuntimeCoreAuditHardeningEvidence({
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

/** Atomically copies only exact already-authenticated immutable M04-T17/G04 bytes. */
export async function writeRuntimeCoreAuditHardeningEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalString(options.sourceArtifactPath, "sourceArtifactPath");
  const injectedBytes = artifactBytes(options.artifactBytes, "artifactBytes");
  const destinationPath = optionalString(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  const built = await buildRuntimeCoreAuditHardeningEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(injectedBytes === undefined ? {} : { artifactBytes: injectedBytes }),
  });
  const artifactPath = destinationPath ?? DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH;
  if (
    path.resolve(artifactPath) === path.resolve(DEFAULT_RUNTIME_CORE_AUDIT_HARDENING_ARTIFACT_PATH)
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
    fail("AUDIT_ARTIFACT_UNSAFE", "Atomic M04-T17 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    ...summarizeEvidence(built, "immutable-task-time-artifact"),
    artifactPath: pathToFileURL(path.resolve(artifactPath)).pathname,
  });
}
