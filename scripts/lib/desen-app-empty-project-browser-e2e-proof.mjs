import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-EMPTY-PROJECT-BROWSER-E2E.md";
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

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

/** Exact immutable M10-T01 artifact authenticated by this historical reader. */
export const DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN = Object.freeze({
  path: ARTIFACT_RELATIVE_PATH,
  bytes: 10_259,
  sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
});

const PROOF_DOCUMENT_PIN = Object.freeze({
  path: PROOF_DOCUMENT_RELATIVE_PATH,
  bytes: 3_338,
  sha256: "e48cd45ae61700754b4d71f5bbd2b9f3a84dc0cb224f551e4af0bee79080244f",
});

/** Exact immutable M09/G09 predecessor recorded by the M10-T01 artifact. */
export const DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN = Object.freeze({
  task: "M09-T14",
  gate: "G09",
  proofId: "desen-app-publish-activation",
  path: "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json",
  bytes: 24_763,
  sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  profile: "desen.app.publish-activation-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact 11 task-time reader case names retained inside the immutable M10-T01 artifact. */
export const DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact completed M09/G09 predecessor",
  "[bootstrap] retains an explicitly empty admitted Source and exact Catalog identity",
  "[browser] retains one real-browser empty-project-to-saved-sign-in scenario",
  "[drag] distinguishes native Components and Layers gestures from forged transfer data",
  "[persistence] saves through the public persistence port and re-admits canonical Source",
  "[parity] keeps the same declared 420 by 720 frame and static content in Design and Run",
  "[dependency] pins Playwright and Chromium configuration to exact workspace contracts",
  "[boundary] keeps T02 through T04 runtime lifecycle claims outside M10-T01",
  "[determinism] builds byte-identical detached evidence and exact tracked receipts",
  "[policy] rejects weakened source, browser, package, lockfile, and parent authority",
  "[verification] rejects artifact, proof-report, option, and destination drift",
]);

/** Default location of the immutable M10-T01 artifact. */
export const DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);

const EXPECTED_CLAIM = deepFreeze({
  taskStatus: "DONE",
  p08Status: "PROVEN",
  beginsFromExplicitlyEmptySource: true,
  exactCatalogResolved: true,
  visualAuthoringCovered: true,
  nativeComponentDragCovered: true,
  nativeLayerDragCovered: true,
  forgedDataTransferRejected: true,
  authoredDeletionCovered: true,
  exactSourceSavedAndReadBack: true,
  savedSourceStructurallyAdmitted: true,
  designRunStaticParityCovered: true,
  runtimeInputAndPendingCovered: false,
  invalidCredentialsAndPublicFailureCovered: false,
  successNavigationAndHostOperationCovered: false,
  remoteDeploymentCovered: false,
  g10Closed: false,
});

const EXPECTED_TESTS = deepFreeze({
  browserCommand: "pnpm test:e2e",
  browserSpec: "apps/desen-app/e2e/empty-project-to-sign-in.pw.ts",
  browserTestName:
    "authors and saves a valid sign-in Source from the empty project in a real browser",
  browserTestDeclarations: 1,
  configuredProjects: ["chromium"],
  workers: 1,
  retries: 0,
  proofReaderCommand: "node --test tests/desen-app-empty-project-browser-e2e.test.mjs",
  verifierCommand: "node scripts/verify-desen-app-empty-project-browser-e2e.mjs",
  rootTestNames: DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES,
  browserExecutedByVerifier: false,
});

const EXPECTED_TRACKED_RECEIPTS = deepFreeze([
  {
    path: "apps/desen-app/e2e/empty-project-to-sign-in.pw.ts",
    bytes: 12_760,
    sha256: "1f13768de1b0c0e05eba68263b7457c16d66ce2c491134b4118661031f9cb808",
  },
  {
    path: "apps/desen-app/e2e/index.html",
    bytes: 424,
    sha256: "d201d15b3703a9d5e052dc16ba842b9ab389dff1ea7467a5a94d8c2dc48f1b55",
  },
  {
    path: "apps/desen-app/e2e/playwright.config.ts",
    bytes: 1_202,
    sha256: "63fd82a40ff1b680c51b2a7559596feb20c725d38cae934c967f9d84a3449aca",
  },
  {
    path: "apps/desen-app/e2e/proof-application.tsx",
    bytes: 4_199,
    sha256: "7e34238fb5ab8b681ef79ccfc072ca3c8abf4dff00e7a3f12474a31b50600079",
  },
  {
    path: "apps/desen-app/e2e/tsconfig.json",
    bytes: 195,
    sha256: "7cf22f55c324616d8f23ad47f013f8fa7c9343a8e7073825d455f2afa5158072",
  },
  {
    path: "apps/desen-app/e2e/vite.config.ts",
    bytes: 314,
    sha256: "52bdbfd8631beeee4ce8641d51717e9a4ecb89e3de4f3a8279d071b1346bb899",
  },
  {
    path: "apps/desen-app/package.json",
    bytes: 4_070,
    sha256: "e49cce1d8397330f3e3f14a1cfdee8dd9f110f86ec9b40df961942b3301b06bc",
  },
  {
    path: "apps/desen-app/src/application.tsx",
    bytes: 126_618,
    sha256: "622fdf26123d54de5a0e17015e6525f73bb7569facef36e5d4583340d8fd5090",
  },
  {
    path: "apps/desen-app/src/reference-empty-project.ts",
    bytes: 1_781,
    sha256: "66015c0ac0d1c13dd609906ca45f176a8a4b820d0ff756569c678278039e5170",
  },
  {
    path: "apps/desen-app/test/application.test.tsx",
    bytes: 107_788,
    sha256: "931f3097888c3f3e8c1636acd01d92975bdcbf06b37a6a55bb767dad1d905c7b",
  },
  {
    path: "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json",
    bytes: 24_763,
    sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  },
  {
    path: "package.json",
    bytes: 97_624,
    sha256: "f45ef03a961c037d7e0d998a38b12f9febba38b4a9a6de8d01b0ca9b785249eb",
  },
  {
    path: "pnpm-lock.yaml",
    bytes: 131_118,
    sha256: "c4c058fdf383422e9da36ea248a6937411ef8bb8dc4089e078f0aa28f98474c2",
  },
  {
    path: "scripts/generate-desen-app-empty-project-browser-e2e-proof.mjs",
    bytes: 823,
    sha256: "b8b7457b964bbc1d89ac7bf7da3eb64b414297572c51356466efe2d1cd426637",
  },
  {
    path: "scripts/lib/atomic-proof-artifact.mjs",
    bytes: 3_444,
    sha256: "4995bf5e3f1100f136a8a8553f84ab30e4c09d4bb38784a66f3d1aafae6df70d",
  },
  {
    path: "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
    bytes: 32_299,
    sha256: "4e6028de6295368ca28ee78c16224e8f1fc5d0cd47c22ab7e444ed98e80e0993",
  },
  {
    path: "scripts/verify-desen-app-empty-project-browser-e2e.mjs",
    bytes: 881,
    sha256: "e56a8f350ebdb66718f46559d49444876fce7e524b78a8d6aba206386d77314e",
  },
  {
    path: "tests/desen-app-empty-project-browser-e2e.test.mjs",
    bytes: 10_946,
    sha256: "700f250e90848eb9eace69a4472de0afbe06690e3bc9aec982d1d0e54431b296",
  },
]);

const EXPECTED_PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
  "scripts/generate-desen-app-empty-project-browser-e2e-proof.mjs",
  "scripts/verify-desen-app-empty-project-browser-e2e.mjs",
  "tests/desen-app-empty-project-browser-e2e.test.mjs",
]);

const EXPECTED_NONCLAIMS = Object.freeze([
  "M10-T01 proves only empty-project visual authoring, persistence, validation, and Design/Run static parity for the sign-in Source.",
  "M10-T02 input dispatch and visible pending state remain NOT_PROVEN by this artifact.",
  "M10-T03 invalid-credentials and public failure rendering remain NOT_PROVEN by this artifact.",
  "M10-T04 successful navigation and one real host operation remain NOT_PROVEN by this artifact.",
  "Remote deployment and G10 closure remain NOT_PROVEN.",
  "The deterministic proof reader never launches a browser; an exact-head Browser E2E job must execute the pinned scenario.",
  "No hosted-CI pass is inferred from locally generated artifact bytes alone.",
]);

/** Stable fail-closed error raised by the immutable M10-T01 reader. */
export class DesenAppEmptyProjectBrowserE2eProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppEmptyProjectBrowserE2eProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppEmptyProjectBrowserE2eProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function captureOptions(value, allowedKeys, operation) {
  if (value === undefined) return Object.freeze(Object.create(null));
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    fail("OPTIONS_INVALID", `Historical M10-T01 ${operation} options must be one inert object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("OPTIONS_INVALID", `Historical M10-T01 ${operation} options are not safely inspectable.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "OPTIONS_INVALID",
      `Historical M10-T01 ${operation} options contain an unknown, inherited, or symbol field.`,
    );
  }
  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("OPTIONS_INVALID", `Historical M10-T01 option ${JSON.stringify(key)} is unsafe.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "OPTIONS_INVALID",
        `Historical M10-T01 option ${JSON.stringify(key)} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty path string.`);
  }
  return path.resolve(value);
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail("OPTIONS_INVALID", `${label} must be one non-Proxy function.`);
  }
  return value;
}

function optionalBytes(value, label, exactBytes, driftCode) {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared Buffer or Uint8Array bytes.`);
  }
  let prototype;
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    prototype = Object.getPrototypeOf(value);
    if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) {
      fail("OPTIONS_INVALID", `${label} must use the exact Buffer or Uint8Array prototype.`);
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof DesenAppEmptyProjectBrowserE2eProofError) throw error;
    fail("OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail("OPTIONS_INVALID", `${label} must not use shared backing memory.`);
  }
  if (byteLength !== exactBytes) {
    fail(driftCode, `${label} has an invalid exact byte length.`, {
      expectedBytes: exactBytes,
      actualBytes: byteLength,
    });
  }
  try {
    const captured = new Uint8Array(byteLength);
    captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
    return Buffer.from(captured);
  } catch {
    fail("OPTIONS_INVALID", `${label} backing memory is detached or invalid.`);
  }
}

async function readBoundedHandle(handle, maximumBytes) {
  const captured = Buffer.allocUnsafe(maximumBytes + 1);
  let offset = 0;
  while (offset <= maximumBytes) {
    const { bytesRead } = await handle.read(captured, offset, maximumBytes + 1 - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return Buffer.from(captured.subarray(0, offset));
}

async function readExactRegularFile(filePath, label, exactBytes, unsafeCode) {
  const absolutePath = path.resolve(filePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail(unsafeCode, `${label} is missing or inaccessible.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size !== exactBytes) {
    fail(unsafeCode, `${label} must be one exact-size regular non-symlink file.`);
  }
  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const [openedEntry, currentEntry] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      !openedEntry.isFile() ||
      !currentEntry.isFile() ||
      currentEntry.isSymbolicLink() ||
      openedEntry.dev !== currentEntry.dev ||
      openedEntry.ino !== currentEntry.ino ||
      openedEntry.size !== exactBytes ||
      currentEntry.size !== exactBytes
    ) {
      fail(unsafeCode, `${label} changed identity while it was opened.`);
    }
    const bytes = await readBoundedHandle(handle, exactBytes);
    if (bytes.byteLength !== exactBytes) {
      fail(unsafeCode, `${label} changed byte length while it was read.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppEmptyProjectBrowserE2eProofError) throw error;
    fail(unsafeCode, `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

function decodeExactUtf8(bytes, label, driftCode) {
  const text = Buffer.from(bytes).toString("utf8");
  if (text.includes("\0") || !Buffer.from(text, "utf8").equals(Buffer.from(bytes))) {
    fail(driftCode, `${label} must be exact UTF-8 text.`);
  }
  return text;
}

function exactObjectKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value), expectedKeys)
  );
}

function assertHistoricalArtifactSemantics(artifact) {
  const boundary = artifact?.boundary;
  const receiptPaths = Array.isArray(boundary?.trackedReceipts)
    ? boundary.trackedReceipts.map((receipt) => receipt?.path)
    : [];
  if (
    !exactObjectKeys(artifact, [
      "schemaVersion",
      "proofId",
      "profile",
      "task",
      "gate",
      "protocol",
      "target",
      "prerequisites",
      "claim",
      "authority",
      "tests",
      "boundary",
      "result",
      "nonclaims",
    ]) ||
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "desen-app-empty-project-browser-e2e" ||
    artifact.profile !== "desen.app.empty-project-browser-e2e-proof.v1" ||
    artifact.task !== "M10-T01" ||
    artifact.gate !== null ||
    artifact.protocol !== "0.1.0" ||
    artifact.target !== "web-react" ||
    artifact.result !== "PASS" ||
    !isDeepStrictEqual(artifact.prerequisites, [DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN]) ||
    !isDeepStrictEqual(artifact.claim, EXPECTED_CLAIM) ||
    !isDeepStrictEqual(artifact.tests, EXPECTED_TESTS) ||
    artifact.authority?.source?.exactCatalogIdentity !==
      "run.desen.reference.sign-in@0.1.0#web-react" ||
    artifact.authority?.source?.nativeDragCalls !== 2 ||
    artifact.authority?.source?.persistencePortReal !== true ||
    artifact.authority?.source?.structuralReadmission !== true ||
    !isDeepStrictEqual(artifact.authority?.source?.frame, {
      preset: "portrait",
      width: 420,
      height: 720,
    }) ||
    artifact.authority?.source?.browserExecutionPerformedByReader !== false ||
    artifact.authority?.package?.playwrightVersion !== "1.62.1" ||
    artifact.authority?.execution?.browserRerunOwnedByProofReader !== false ||
    !exactObjectKeys(boundary, [
      "trackedFiles",
      "trackedReceipts",
      "proofReaderPaths",
      "parentArtifacts",
      "immutableInputs",
      "sourceSymlinksRejected",
      "browserExecutionSeparateFromStaticReader",
    ]) ||
    boundary.trackedFiles !== EXPECTED_TRACKED_RECEIPTS.length ||
    !isDeepStrictEqual(boundary.trackedReceipts, EXPECTED_TRACKED_RECEIPTS) ||
    !isDeepStrictEqual(boundary.proofReaderPaths, EXPECTED_PROOF_READER_PATHS) ||
    boundary.parentArtifacts !== 1 ||
    boundary.immutableInputs !== true ||
    boundary.sourceSymlinksRejected !== true ||
    boundary.browserExecutionSeparateFromStaticReader !== true ||
    new Set(receiptPaths).size !== EXPECTED_TRACKED_RECEIPTS.length ||
    !isDeepStrictEqual(artifact.nonclaims, EXPECTED_NONCLAIMS)
  ) {
    fail(
      "ARTIFACT_DRIFT",
      "The immutable M10-T01 artifact lost its canonical schema, claims, or task-time receipts.",
    );
  }
}

function inspectHistoricalArtifact(bytes) {
  const actualSha256 = sha256(bytes);
  const pin = DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || actualSha256 !== pin.sha256) {
    fail("ARTIFACT_DRIFT", "The immutable M10-T01 artifact bytes changed.", {
      expectedBytes: pin.bytes,
      actualBytes: bytes.byteLength,
      expectedSha256: pin.sha256,
      actualSha256,
    });
  }
  const text = decodeExactUtf8(bytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  let artifact;
  try {
    artifact = JSON.parse(text);
  } catch {
    fail("ARTIFACT_DRIFT", "The immutable M10-T01 artifact is not valid JSON.");
  }
  assertHistoricalArtifactSemantics(artifact);
  return deepFreeze(artifact);
}

function occurrenceCount(text, marker) {
  return text.split(marker).length - 1;
}

function inspectProofDocument(bytes) {
  const actualSha256 = sha256(bytes);
  if (bytes.byteLength !== PROOF_DOCUMENT_PIN.bytes || actualSha256 !== PROOF_DOCUMENT_PIN.sha256) {
    fail("PROOF_DOCUMENT_DRIFT", "The immutable M10-T01 proof report bytes changed.", {
      expectedBytes: PROOF_DOCUMENT_PIN.bytes,
      actualBytes: bytes.byteLength,
      expectedSha256: PROOF_DOCUMENT_PIN.sha256,
      actualSha256,
    });
  }
  const text = decodeExactUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const digestMarker = `Final artifact: \`sha256:${DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.sha256}\``;
  const exactHeader = [
    "# Desen App empty-project browser E2E",
    "",
    "Task: M10-T01",
    "",
    "Status: DONE",
    "",
    "P-08: PROVEN",
    "",
    "T02+: NOT_PROVEN",
    "",
    digestMarker,
    "",
    "## Scope",
  ].join("\n");
  if (
    !text.startsWith(exactHeader) ||
    occurrenceCount(text, "Task: M10-T01") !== 1 ||
    occurrenceCount(text, "Status: DONE") !== 1 ||
    occurrenceCount(text, "P-08: PROVEN") !== 1 ||
    occurrenceCount(text, "T02+: NOT_PROVEN") !== 1 ||
    occurrenceCount(text, "Final artifact:") !== 1 ||
    occurrenceCount(text, digestMarker) !== 1 ||
    text.includes("sha256:PENDING")
  ) {
    fail(
      "PROOF_DOCUMENT_DRIFT",
      "The immutable M10-T01 proof report lost its single exact contextual artifact pin.",
    );
  }
}

function summarizeEvidence(built) {
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    compatibilityMode: built.compatibilityMode,
    prerequisites: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    browserTestDeclarations: built.artifact.tests.browserTestDeclarations,
    playwrightVersion: built.artifact.authority.package.playwrightVersion,
    configuredProjects: built.artifact.tests.configuredProjects,
    p08Status: built.artifact.claim.p08Status,
    t02PlusStatus: "NOT_PROVEN",
    browserExecutedByVerifier: false,
  });
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/**
 * Reads exact immutable M10-T01 task-time evidence without consulting current source, package,
 * workflow, predecessor, browser harness, or Playwright state.
 */
export async function buildDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactBytes", "artifactPath"], "build");
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
    "ARTIFACT_DRIFT",
  );
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail(
      "OPTIONS_INVALID",
      "Historical M10-T01 build accepts artifactPath or artifactBytes, not both.",
    );
  }
  const historicalBytes =
    artifactBytes ??
    (await readExactRegularFile(
      artifactPath ?? DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
      "Immutable M10-T01 artifact",
      DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
      "ARTIFACT_UNSAFE",
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.sha256,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/** Verifies immutable M10-T01 artifact semantics, task-time receipts, and exact proof report. */
export async function verifyDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "proofDocument", "proofDocumentPath"],
    "verify",
  );
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
    "ARTIFACT_DRIFT",
  );
  const proofDocumentPath = optionalPath(options.proofDocumentPath, "proofDocumentPath");
  const proofDocument = optionalBytes(
    options.proofDocument,
    "proofDocument",
    PROOF_DOCUMENT_PIN.bytes,
    "PROOF_DOCUMENT_DRIFT",
  );
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail("OPTIONS_INVALID", "Historical M10-T01 verify accepts one artifact authority.");
  }
  if (proofDocumentPath !== undefined && proofDocument !== undefined) {
    fail("OPTIONS_INVALID", "Historical M10-T01 verify accepts one proof-report authority.");
  }
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const reportBytes =
    proofDocument ??
    (await readExactRegularFile(
      proofDocumentPath ?? DEFAULT_PROOF_DOCUMENT_PATH,
      "Immutable M10-T01 proof report",
      PROOF_DOCUMENT_PIN.bytes,
      "PROOF_DOCUMENT_UNSAFE",
    ));
  inspectProofDocument(reportBytes);
  return Object.freeze({
    ...summarizeEvidence(built),
    proofDocumentBytes: PROOF_DOCUMENT_PIN.bytes,
    proofDocumentSha256: PROOF_DOCUMENT_PIN.sha256,
  });
}

/**
 * Preserves the tracked M10-T01 artifact or copies only its authenticated historical bytes to an
 * alternate safe destination.
 */
export async function writeDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalPath(options.sourceArtifactPath, "sourceArtifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PIN.bytes,
    "ARTIFACT_DRIFT",
  );
  const destinationPath = optionalPath(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (sourceArtifactPath !== undefined && artifactBytes !== undefined) {
    fail("OPTIONS_INVALID", "Historical M10-T01 writer accepts one artifact source.");
  }
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const requestedPath =
    destinationPath ?? DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH;
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedPath),
      canonicalDestinationPath(DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T01 destination could not be resolved safely.", {
      cause: String(error),
    });
  }
  if (artifactPath === trackedArtifactPath) {
    const authenticated = await buildDesenAppEmptyProjectBrowserE2eEvidence({
      artifactPath: trackedArtifactPath,
    });
    return Object.freeze({
      ...summarizeEvidence(authenticated),
      artifactPath,
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
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M10-T01 historical artifact copy failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    ...summarizeEvidence(built),
    artifactPath,
    preserved: false,
  });
}
