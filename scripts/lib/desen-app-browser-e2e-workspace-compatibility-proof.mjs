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
  "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-BROWSER-E2E-WORKSPACE-COMPATIBILITY.md";
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)?.get;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)?.get;

/** Exact immutable M10-T01-COMPAT artifact authenticated by this historical reader. */
export const DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN = Object.freeze({
  path: ARTIFACT_RELATIVE_PATH,
  bytes: 16_025,
  sha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
});

const PROOF_DOCUMENT_PIN = Object.freeze({
  path: PROOF_DOCUMENT_RELATIVE_PATH,
  bytes: 3_180,
  sha256: "e5746d95870e4443299a9ac668e125c5304e6435cd7ac6f8e8b016b6a470dacf",
});

/** Exact immutable M10-T01 predecessor recorded by the compatibility artifact. */
export const DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN = Object.freeze({
  task: "M10-T01",
  gate: null,
  proofId: "desen-app-empty-project-browser-e2e",
  path: "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json",
  bytes: 10_259,
  sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
  profile: "desen.app.empty-project-browser-e2e-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent immutable-reader tests retained for the corrective receipt. */
export const DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact immutable compatibility receipt and predecessor",
  "[bootstrap] retains the recorded empty admitted Source and exact Catalog identity",
  "[browser] retains the recorded real Chromium authoring scenario",
  "[drag] retains native Components and Layers gestures plus forged-drag rejection",
  "[persistence] retains canonical save, read-back, and structural re-admission",
  "[parity] retains the declared 420 by 720 Design and Run frame",
  "[workspace] retains dedicated package, boundary, workflow, and Playwright authority",
  "[boundary] keeps T02 through T04 runtime lifecycle claims outside the receipt",
  "[determinism] reads byte-identical frozen evidence without consulting current sources",
  "[policy] rejects mutated artifact bytes and unsafe authority inputs",
  "[verification] rejects proof-report, destination, and option drift",
]);

/** Default location of the immutable corrective artifact. */
export const DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);

/** Stable fail-closed error raised by the immutable compatibility reader. */
export class DesenAppBrowserE2eWorkspaceCompatibilityProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppBrowserE2eWorkspaceCompatibilityProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppBrowserE2eWorkspaceCompatibilityProofError(code, message, details);
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
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail("OPTIONS_INVALID", `Historical compatibility ${operation} options must be inert data.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("OPTIONS_INVALID", `Historical compatibility ${operation} options are unsafe.`);
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail("OPTIONS_INVALID", `Historical compatibility ${operation} options contain drift.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `Historical compatibility option ${String(key)} must be own data.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty path.`);
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
    fail("OPTIONS_INVALID", `${label} must be exact Buffer or Uint8Array bytes.`);
  }
  let backingBuffer;
  let byteLength;
  let byteOffset;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) {
      fail("OPTIONS_INVALID", `${label} has an unsupported prototype.`);
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError) throw error;
    fail("OPTIONS_INVALID", `${label} could not be captured.`);
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail("OPTIONS_INVALID", `${label} must not use shared memory.`);
  }
  if (byteLength !== exactBytes) {
    fail(driftCode, `${label} has an invalid exact byte length.`, {
      expectedBytes: exactBytes,
      actualBytes: byteLength,
    });
  }
  const captured = new Uint8Array(byteLength);
  captured.set(new Uint8Array(backingBuffer, byteOffset, byteLength));
  return Buffer.from(captured);
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
    const [opened, current] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      !opened.isFile() ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino ||
      opened.size !== exactBytes ||
      current.size !== exactBytes
    ) {
      fail(unsafeCode, `${label} changed identity while open.`);
    }
    const bytes = Buffer.allocUnsafe(exactBytes + 1);
    let offset = 0;
    while (offset <= exactBytes) {
      const { bytesRead } = await handle.read(bytes, offset, exactBytes + 1 - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== exactBytes) fail(unsafeCode, `${label} changed length while read.`);
    return Buffer.from(bytes.subarray(0, offset));
  } catch (error) {
    if (error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError) throw error;
    fail(unsafeCode, `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

function decodeExactUtf8(bytes, label, code) {
  const text = Buffer.from(bytes).toString("utf8");
  if (text.includes("\0") || !Buffer.from(text).equals(Buffer.from(bytes))) {
    fail(code, `${label} must be exact UTF-8 text.`);
  }
  return text;
}

function assertHistoricalArtifactSemantics(artifact) {
  const claim = artifact?.claim;
  const source = artifact?.authority?.source;
  const packageAuthority = artifact?.authority?.package;
  const boundary = artifact?.boundary;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-browser-e2e-workspace-compatibility" ||
    artifact?.profile !== "desen.app.browser-e2e-workspace-compatibility-proof.v1" ||
    artifact?.task !== "M10-T01" ||
    artifact?.compatibilityReceipt !== "M10-T01-COMPAT" ||
    artifact?.gate !== null ||
    artifact?.protocol !== "0.1.0" ||
    artifact?.target !== "web-react" ||
    artifact?.result !== "PASS" ||
    !isDeepStrictEqual(artifact?.prerequisites, [
      DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN,
    ]) ||
    claim?.taskStatus !== "DONE" ||
    claim?.correctiveReceiptOnly !== true ||
    claim?.dedicatedBoundaryPolicyCovered !== true ||
    claim?.p08Status !== "PROVEN" ||
    claim?.beginsFromExplicitlyEmptySource !== true ||
    claim?.visualAuthoringCovered !== true ||
    claim?.nativeComponentDragCovered !== true ||
    claim?.nativeLayerDragCovered !== true ||
    claim?.forgedDataTransferRejected !== true ||
    claim?.exactSourceSavedAndReadBack !== true ||
    claim?.savedSourceStructurallyAdmitted !== true ||
    claim?.designRunStaticParityCovered !== true ||
    claim?.runtimeInputAndPendingCovered !== false ||
    claim?.invalidCredentialsAndPublicFailureCovered !== false ||
    claim?.successNavigationAndHostOperationCovered !== false ||
    claim?.remoteDeploymentCovered !== false ||
    claim?.g10Closed !== false ||
    source?.exactCatalogIdentity !== "run.desen.reference.sign-in@0.1.0#web-react" ||
    source?.nativeDragCalls !== 2 ||
    source?.persistencePortReal !== true ||
    source?.canonicalSavedSourceReadBack !== true ||
    source?.structuralReadmission !== true ||
    !isDeepStrictEqual(source?.frame, { preset: "portrait", width: 420, height: 720 }) ||
    packageAuthority?.browserPackageName !== "@desen/app-browser-e2e" ||
    packageAuthority?.dedicatedWorkspaceOwnership !== true ||
    packageAuthority?.playwrightVersion !== "1.62.1" ||
    artifact?.tests?.browserCommand !== "pnpm --filter @desen/app-browser-e2e test:e2e" ||
    artifact?.tests?.browserTestDeclarations !== 1 ||
    artifact?.tests?.browserExecutedByVerifier !== false ||
    boundary?.trackedFiles !== 32 ||
    boundary?.trackedReceipts?.length !== 32 ||
    boundary?.parentArtifacts !== 1 ||
    boundary?.immutableInputs !== true ||
    boundary?.sourceSymlinksRejected !== true ||
    boundary?.browserExecutionSeparateFromStaticReader !== true ||
    !Array.isArray(artifact?.nonclaims) ||
    artifact.nonclaims.length !== 8
  ) {
    fail("ARTIFACT_DRIFT", "The immutable compatibility artifact lost canonical semantics.");
  }
}

function inspectHistoricalArtifact(bytes) {
  const pin = DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN;
  const actualSha256 = sha256(bytes);
  if (bytes.byteLength !== pin.bytes || actualSha256 !== pin.sha256) {
    fail("ARTIFACT_DRIFT", "The immutable compatibility artifact bytes changed.", {
      expectedBytes: pin.bytes,
      actualBytes: bytes.byteLength,
      expectedSha256: pin.sha256,
      actualSha256,
    });
  }
  let artifact;
  try {
    artifact = JSON.parse(decodeExactUtf8(bytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT"));
  } catch (error) {
    if (error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError) throw error;
    fail("ARTIFACT_DRIFT", "The immutable compatibility artifact is not valid JSON.");
  }
  assertHistoricalArtifactSemantics(artifact);
  return deepFreeze(artifact);
}

function inspectProofDocument(bytes) {
  const actualSha256 = sha256(bytes);
  if (bytes.byteLength !== PROOF_DOCUMENT_PIN.bytes || actualSha256 !== PROOF_DOCUMENT_PIN.sha256) {
    fail("PROOF_DOCUMENT_DRIFT", "The immutable compatibility report bytes changed.", {
      expectedBytes: PROOF_DOCUMENT_PIN.bytes,
      actualBytes: bytes.byteLength,
      expectedSha256: PROOF_DOCUMENT_PIN.sha256,
      actualSha256,
    });
  }
  const text = decodeExactUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const artifactMarker = `Compatibility artifact: \`sha256:${DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256}\``;
  const parentMarker = `Historical artifact: \`sha256:${DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN.sha256}\``;
  const exactHeader = [
    "# Desen App browser E2E workspace compatibility",
    "",
    "Task: M10-T01",
    "",
    "Compatibility receipt: M10-T01-COMPAT",
    "",
    "Status: DONE",
    "",
    "P-08: PROVEN",
    "",
    "T02+: NOT_PROVEN",
    "",
    parentMarker,
    "",
    artifactMarker,
  ].join("\n");
  if (!text.startsWith(exactHeader) || text.includes("sha256:PENDING")) {
    fail("PROOF_DOCUMENT_DRIFT", "The immutable compatibility report lost exact authority.");
  }
}

function summarizeEvidence(built) {
  return deepFreeze({
    task: built.artifact.task,
    compatibilityReceipt: built.artifact.compatibilityReceipt,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    compatibilityMode: built.compatibilityMode,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    browserExecutedByVerifier: false,
  });
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Reads immutable M10-T01-COMPAT evidence without consulting current product or harness files. */
export async function buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
  const options = captureOptions(rawOptions, ["artifactBytes", "artifactPath"], "build");
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
    "ARTIFACT_DRIFT",
  );
  if (artifactPath !== undefined && artifactBytes !== undefined) {
    fail("OPTIONS_INVALID", "Historical compatibility build accepts one artifact authority.");
  }
  const historicalBytes =
    artifactBytes ??
    (await readExactRegularFile(
      artifactPath ?? DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
      "Immutable compatibility artifact",
      DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
      "ARTIFACT_UNSAFE",
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Buffer.from(historicalBytes),
    artifactSha256: DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.sha256,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/** Compatibility alias retained for callers of the former live source-policy API. */
export function verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy() {
  fail(
    "HISTORICAL_READER_ONLY",
    "M10-T01-COMPAT is immutable; current source policy belongs to its append-only successor.",
  );
}

/** Verifies exact historical artifact and proof-report bytes. */
export async function verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
  const options = captureOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "proofDocument", "proofDocumentPath"],
    "verify",
  );
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
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
    fail("OPTIONS_INVALID", "Historical compatibility verify accepts one artifact authority.");
  }
  if (proofDocumentPath !== undefined && proofDocument !== undefined) {
    fail("OPTIONS_INVALID", "Historical compatibility verify accepts one report authority.");
  }
  const built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const reportBytes =
    proofDocument ??
    (await readExactRegularFile(
      proofDocumentPath ?? DEFAULT_PROOF_DOCUMENT_PATH,
      "Immutable compatibility report",
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

/** Preserves the tracked artifact or copies only authenticated historical bytes elsewhere. */
export async function writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalPath(options.sourceArtifactPath, "sourceArtifactPath");
  const artifactBytes = optionalBytes(
    options.artifactBytes,
    "artifactBytes",
    DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PIN.bytes,
    "ARTIFACT_DRIFT",
  );
  const destinationPath = optionalPath(options.artifactPath, "artifactPath");
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (sourceArtifactPath !== undefined && artifactBytes !== undefined) {
    fail("OPTIONS_INVALID", "Historical compatibility writer accepts one artifact source.");
  }
  const built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const requestedPath =
    destinationPath ?? DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH;
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedPath),
      canonicalDestinationPath(DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The compatibility destination is unsafe.", {
      cause: String(error),
    });
  }
  if (artifactPath === trackedArtifactPath) {
    const authenticated = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence({
      artifactPath,
    });
    return Object.freeze({ ...summarizeEvidence(authenticated), artifactPath, preserved: true });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Historical compatibility copy failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({ ...summarizeEvidence(built), artifactPath, preserved: false });
}
