import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json";
const ARTIFACT_FILE_NAME = path.basename(ARTIFACT_RELATIVE_PATH);
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/RUNTIME-REACT-FAILURE-BOUNDARY.md";
const PROOF_MATRIX_RELATIVE_PATH = "docs/proof/PROOF-MATRIX.md";
const NORMATIVE_COVERAGE_RELATIVE_PATH = "docs/proof/NORMATIVE-COVERAGE.md";
const PROTOCOL_FINDINGS_RELATIVE_PATH = "docs/plan/PROTOCOL-FINDINGS.md";
const HISTORICAL_ARTIFACT_SHA256 =
  "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723";
const HISTORICAL_ARTIFACT_BYTES = 9_534;
const COMPATIBILITY_MODE = "immutable-task-time-artifact";
const MAX_DOCUMENT_BYTES = 2_000_000;
const EXPECTED_DOCUMENT_DIGESTS = Object.freeze({
  proof: Object.freeze({
    bytes: 3_694,
    sha256: "dfe2253457b06dfbd486d139686714230c4dd6caaf87dfe7303b0c3ab98b665a",
  }),
  matrixSection: Object.freeze({
    bytes: 1_920,
    sha256: "4b405518d29c43aa8b6d83986368ff57d5fce0b7c6e770e9185c573dba976ab1",
  }),
  matrixRow: Object.freeze({
    bytes: 1_419,
    sha256: "450bea9a186791336402acb16b16e97653a55b1c2ff74a396f4d9b94eb0a3cb5",
  }),
  normativeRow: Object.freeze({
    bytes: 894,
    sha256: "9d77f73cebc4c585dfb9122449936fa9ed488f342407ad4a927bbf1c6c6aaa86",
  }),
  findingSection: Object.freeze({
    bytes: 4_045,
    sha256: "1fec6a3da881bf6926d8091e1f79dc47b5aec044452c95fb88d16a16c9cadeb4",
  }),
});
const BUFFER_CONSTRUCTOR = Buffer;
const BUFFER_ALLOC = Buffer.alloc;
const BUFFER_BYTE_LENGTH = Buffer.byteLength;
const BUFFER_FROM = Buffer.from;
const OBJECT_HAS_OWN = Object.hasOwn;
const UINT8_ARRAY_CONSTRUCTOR = Uint8Array;
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(UINT8_ARRAY_CONSTRUCTOR.prototype);
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

/** Absolute path to the immutable task-time M05-T06 proof artifact. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

/** Absolute path to the immutable M05-T06 human-readable proof. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_DOCUMENT_RELATIVE_PATH,
);

/** Absolute path to the exact M05-T06 Proof Matrix pins. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_MATRIX_PATH = path.join(
  WORKSPACE_ROOT,
  PROOF_MATRIX_RELATIVE_PATH,
);

/** Absolute path to the exact current N-037 projection. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_NORMATIVE_COVERAGE_PATH = path.join(
  WORKSPACE_ROOT,
  NORMATIVE_COVERAGE_RELATIVE_PATH,
);

/** Absolute path to the current PF-055 successor-ownership projection. */
export const DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_FINDINGS_PATH = path.join(
  WORKSPACE_ROOT,
  PROTOCOL_FINDINGS_RELATIVE_PATH,
);

const EXPECTED_PREREQUISITES = Object.freeze([
  Object.freeze({
    task: "M05-T05",
    path: "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json",
    sha256: "sha256:292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb",
    profile: "desen-runtime-react-reconciliation-diagnostics-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M05-T02",
    path: "docs/proof/artifacts/runtime-react-0.1.0-resolved-props-slots.json",
    sha256: "sha256:f668dc0d3d0e9e8edb239323fd82037b8afc2004dbe8eace56dcd4c510ed22e0",
    profile: "desen-runtime-react-resolved-props-slots-v1",
    result: "PASS",
  }),
  Object.freeze({
    task: "M04-T09",
    path: "docs/proof/artifacts/runtime-core-0.1.0-operation-lifecycle.json",
    sha256: "sha256:7b2300a78bb9903abe1f182792362d374edb5b948ee9f8f69dc018ccf9cc8301",
    result: "PASS",
  }),
  Object.freeze({
    task: "M02-T05",
    path: "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
    sha256: "sha256:e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b",
    profile: "desen-diagnostics-json-pointer-v1",
  }),
  Object.freeze({
    task: "M02-T02",
    path: "docs/proof/artifacts/protocol-0.1.0-traceability.json",
    sha256: "sha256:749cbae719a5deb216e9ed3be171eb710b47fc547f4f270dbba21bb14c2af514",
    protocol: "0.1.0",
    result: "PASS",
  }),
]);

const EXPECTED_CLAIM = Object.freeze({
  wholeSurfaceFailClosed: true,
  safeNodeLocalSiblingContinuationClaimed: false,
  exactAttribution: "leaf-component-only",
  behaviorExactAttribution: false,
  nonLeafExactAttribution: false,
  cleanupExactAttribution: false,
  honestNullAttributionWhenOriginUnavailable: true,
  explicitUnknownCapabilityFailure: true,
  productionPlaceholderGuessing: false,
  rawAdapterPayloadExposed: false,
});

const EXPECTED_BOUNDARY = Object.freeze({
  package: "@desen/runtime-react",
  failureCode: "ADAPTER_FAILURE",
  containment: "whole-surface",
  publicVariants: Object.freeze(["component", "unattributed"]),
  publicFailureFields: Object.freeze([
    "adapterKind",
    "behaviorId",
    "capabilityId",
    "code",
    "runtimeNodeId",
    "sourceNodeId",
  ]),
  rawPublicFields: Object.freeze([]),
  identityPolicy: Object.freeze({
    exact: "leaf component with no managed DESEN descendants",
    unattributed:
      "behavior, non-leaf, descendant, removal, or other origin React cannot expose safely",
    unattributedIdentityValue: null,
  }),
  provenanceBranches: Object.freeze({
    structure: "two-always-mounted-sibling-boundaries",
    managed: "RuntimeReactManagedBranchBoundary",
    host: "RuntimeReactHostBranchBoundary",
  }),
  hostFailureRenderer: Object.freeze({
    selectedBy: "trusted-static-host-code",
    bundleOrCatalogAuthority: false,
    privateFreshCarrier: true,
    cause: "exact-host-thrown-value",
    classifiedAsAdapterFailure: false,
  }),
  recovery: Object.freeze({
    mode: "sticky-after-adapter-failure",
    authority: "explicit-host-recoveryKey",
    implicitResultRetry: false,
    implicitPublicationRetry: false,
    implicitReconciliationKeyRetry: false,
  }),
  unknownCapability: Object.freeze({
    phase: "all-or-nothing-preflight",
    adapterExecutionBeforeFailure: false,
    placeholder: false,
    hostFailureSurfaceRequired: true,
  }),
  rootCaughtError: Object.freeze({
    handler: "ignoreRuntimeReactRootCaughtError",
    handlerType: "RuntimeReactRootCaughtErrorHandler",
    scope: "dedicated-DESEN-root-only",
    rawPayloadInspection: false,
    rawPayloadForwarding: false,
    sharedRootPolicyClaimed: false,
    referenceHostWiringOwner: "M05-T07",
  }),
  integrationScope: Object.freeze({
    resultAuthority: "host-trusted-runtime-result",
    arbitraryUntrustedResultParser: false,
    moduleInstanceRequirement: "one-deduplicated-@desen/runtime-react-instance-per-React-tree",
    omittedRecoveryKey: "safe-never-retry",
    hostCleanupCarrier:
      "managed-to-failure-and-failure-to-managed-transitions-while-branch-boundary-mounted",
    fullRootUnmountCleanupOwner: "M05-T07-host-onUncaughtError-policy",
  }),
});

const EXPECTED_PUBLIC_API = Object.freeze({
  runtimeExports: Object.freeze([
    "RuntimeReactSurfaceBoundary",
    "ignoreRuntimeReactRootCaughtError",
  ]),
  typeExports: Object.freeze([
    "RuntimeReactAdapterFailure",
    "RuntimeReactComponentAdapterFailure",
    "RuntimeReactRootCaughtErrorHandler",
    "RuntimeReactSurfaceBoundaryProps",
    "RuntimeReactSurfaceBoundaryResult",
    "RuntimeReactSurfaceFailure",
    "RuntimeReactSurfaceFailureRenderer",
    "RuntimeReactUnattributedAdapterFailure",
  ]),
});

const EXPECTED_TRACKED_PATHS = Object.freeze([
  "packages/runtime-react/package.json",
  "packages/runtime-react/src/adapter-error-boundary.tsx",
  "packages/runtime-react/src/index.ts",
  "packages/runtime-react/src/interactions.tsx",
  "packages/runtime-react/src/render-plan.tsx",
  "packages/runtime-react/src/root-error-policy.ts",
  "packages/runtime-react/src/surface-boundary.tsx",
  "packages/runtime-react/test/failure-boundary.test.tsx",
  "packages/runtime-react/test/failure-boundary.types.ts",
  "scripts/generate-runtime-react-failure-boundary-proof.mjs",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/runtime-react-failure-boundary-proof.mjs",
  "scripts/lib/runtime-react-reconciliation-diagnostics-proof.mjs",
  "scripts/verify-runtime-react-failure-boundary.mjs",
  "tests/runtime-react-failure-boundary.test.mjs",
  "tests/runtime-react-reconciliation-diagnostics.test.mjs",
]);

const EXPECTED_TRACEABILITY = Object.freeze({
  canonicalTrace: Object.freeze(["R-112", "R-113", "R-115", "A-012", "D-036"]),
  normative: Object.freeze({
    id: "N-037",
    status: "TESTED",
    owners: "M05-T06",
  }),
  proofClaim: Object.freeze({
    id: "P-17",
    status: "PARTIAL",
    remainingOwner: "M07-T04",
  }),
  taskLocalApplicability: Object.freeze({
    id: "D-009",
    status: "DEFERRED",
    remainingOwner: "M06-T11",
  }),
});

const EXPECTED_NONCLAIMS = Object.freeze([
  "React event-handler exception containment",
  "arbitrary asynchronous exception containment",
  "server-render error-boundary containment",
  "node-local sibling continuation when React cannot expose safe failure provenance",
  "automatic retry after ordinary result, publication, or reconciliation-key changes",
  "raw caught-error suppression for non-DESEN code in a shared React root",
  "host onUncaughtError or onRecoverableError policy",
  "failure-branch cleanup carrier classification during full React root unmount",
  "validation of an arbitrary untrusted object passed as the boundary result",
  "cross-copy private carrier recognition when multiple runtime-react module instances share one tree",
]);

const EXPECTED_SEMANTICS = Object.freeze({
  schemaVersion: 1,
  task: "M05-T06",
  result: "PASS",
  profile: "desen-runtime-react-failure-boundary-v1",
  protocol: "0.1.0",
  target: "web-react",
  claim: EXPECTED_CLAIM,
  boundary: EXPECTED_BOUNDARY,
  publicApi: EXPECTED_PUBLIC_API,
  focusedScript: "pnpm --filter @desen/runtime-react test:failure-boundary",
  tests: Object.freeze({
    focusedCases: 22,
    compilerNegativeCases: 9,
    rootMutationTests: 25,
  }),
  sourceAssertions: 64,
  dynamicExecutableImports: 0,
  trackedPaths: EXPECTED_TRACKED_PATHS,
  verifierExecutionProfile: "static-source-package-prerequisite-and-focused-test-inventory",
  historicalArtifactsRewritten: false,
  traceability: EXPECTED_TRACEABILITY,
  nonclaims: EXPECTED_NONCLAIMS,
});

/** Controlled compatibility-reader failure for immutable M05-T06 evidence. */
export class RuntimeReactFailureBoundaryEvidenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "RuntimeReactFailureBoundaryEvidenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new RuntimeReactFailureBoundaryEvidenceError(code, message, details);
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
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} options must be a plain own-data object.`,
    );
  }

  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} options could not be captured safely.`,
    );
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} options contain unknown, inherited, or symbol keys.`,
    );
  }

  const captured = Object.create(null);
  for (const key of keys) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail(
        "FAILURE_BOUNDARY_OPTIONS_INVALID",
        `Historical M05-T06 ${label} option ${key} could not be captured safely.`,
      );
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail(
        "FAILURE_BOUNDARY_OPTIONS_INVALID",
        `Historical M05-T06 ${label} option ${key} must be enumerable own data.`,
      );
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function optionalString(value, label) {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} must be a non-empty string.`,
    );
  }
  return value;
}

function optionalPath(value, label) {
  const candidate = optionalString(value, label);
  if (
    candidate !== undefined &&
    (candidate.includes("\0") ||
      !path.isAbsolute(candidate) ||
      path.resolve(candidate) !== candidate)
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} must be an exact absolute path without dot segments.`,
    );
  }
  return candidate;
}

function optionalText(value, label) {
  const text = optionalString(value, label);
  if (
    text !== undefined &&
    Reflect.apply(BUFFER_BYTE_LENGTH, BUFFER_CONSTRUCTOR, [text, "utf8"]) > MAX_DOCUMENT_BYTES
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} exceeds its bounded UTF-8 byte limit.`,
    );
  }
  return text;
}

function optionalCallback(value, label) {
  if (value !== undefined && (typeof value !== "function" || utilTypes.isProxy(value))) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} must be a non-Proxy function.`,
    );
  }
  return value;
}

function hasOwn(value, key) {
  return Reflect.apply(OBJECT_HAS_OWN, Object, [value, key]);
}

function assertExclusivePair(left, right, label) {
  if (left !== undefined && right !== undefined) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} accepts exactly one explicit source, not both.`,
    );
  }
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
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} must be non-shared non-Proxy bytes.`,
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
        "FAILURE_BOUNDARY_OPTIONS_INVALID",
        `Historical M05-T06 ${label} must use the exact Buffer or Uint8Array prototype.`,
      );
    }
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
  } catch (error) {
    if (error instanceof RuntimeReactFailureBoundaryEvidenceError) throw error;
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} could not be captured safely.`,
    );
  }
  if (utilTypes.isSharedArrayBuffer(backingBuffer)) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} must not use shared backing memory.`,
    );
  }
  let source;
  try {
    // Creating a view performs a detached-buffer check without copying attacker-sized input.
    source = new UINT8_ARRAY_CONSTRUCTOR(backingBuffer, byteOffset, byteLength);
  } catch {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} backing memory is detached or invalid.`,
    );
  }
  if (byteLength !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT",
      `Historical M05-T06 ${label} must contain exactly ${HISTORICAL_ARTIFACT_BYTES} bytes.`,
      { expected: HISTORICAL_ARTIFACT_BYTES, actual: byteLength },
    );
  }

  try {
    const captured = new UINT8_ARRAY_CONSTRUCTOR(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, captured, [source]);
    return Reflect.apply(BUFFER_FROM, BUFFER_CONSTRUCTOR, [captured]);
  } catch {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      `Historical M05-T06 ${label} backing memory is detached or invalid.`,
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

async function assertSafeParentIdentity(safePath, unsafeCode) {
  let parentEntry;
  let canonicalParent;
  try {
    [parentEntry, canonicalParent] = await Promise.all([
      lstat(safePath.parentPath, { bigint: true }),
      realpath(safePath.parentPath),
    ]);
  } catch (error) {
    fail(unsafeCode, "Historical M05-T06 evidence parent changed unsafely.", {
      cause: String(error),
    });
  }
  if (
    !parentEntry.isDirectory() ||
    parentEntry.isSymbolicLink() ||
    !sameFileIdentity(safePath.parentEntry, parentEntry) ||
    canonicalParent !== safePath.parentPath
  ) {
    fail(unsafeCode, "Historical M05-T06 evidence parent changed identity.");
  }
}

async function canonicalSafePath(filePath, unsafeCode) {
  const absolutePath = path.resolve(filePath);
  const parentPath = path.dirname(absolutePath);
  if (absolutePath !== filePath) {
    fail(unsafeCode, `Historical M05-T06 evidence path is not exact: ${filePath}.`);
  }

  let parentBefore;
  let parentAfter;
  let canonicalParent;
  try {
    [parentBefore, canonicalParent] = await Promise.all([
      lstat(parentPath, { bigint: true }),
      realpath(parentPath),
    ]);
    parentAfter = await lstat(parentPath, { bigint: true });
  } catch (error) {
    fail(unsafeCode, `Historical M05-T06 evidence parent is unsafe: ${filePath}.`, {
      cause: String(error),
    });
  }
  if (
    !parentBefore.isDirectory() ||
    parentBefore.isSymbolicLink() ||
    !parentAfter.isDirectory() ||
    parentAfter.isSymbolicLink() ||
    !sameFileIdentity(parentBefore, parentAfter) ||
    canonicalParent !== parentPath
  ) {
    fail(unsafeCode, `Historical M05-T06 evidence crosses a symlink parent: ${filePath}.`);
  }
  return Object.freeze({ absolutePath, parentPath, parentEntry: parentAfter });
}

async function readExactOpenHandleBytes(handle, expectedLength) {
  const bytes = Reflect.apply(BUFFER_ALLOC, BUFFER_CONSTRUCTOR, [expectedLength]);
  let offset = 0;
  while (offset < expectedLength) {
    const { bytesRead } = await handle.read(bytes, offset, expectedLength - offset, offset);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  const trailing = Reflect.apply(BUFFER_ALLOC, BUFFER_CONSTRUCTOR, [1]);
  const { bytesRead: trailingBytes } = await handle.read(trailing, 0, 1, expectedLength);
  if (offset !== expectedLength || trailingBytes !== 0) {
    throw new TypeError("Historical M05-T06 open file byte length changed.");
  }
  return bytes;
}

async function readRegularFile(
  filePath,
  missingCode,
  unsafeCode,
  maximumBytes,
  exactBytes = undefined,
) {
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
      fail(missingCode, `Historical M05-T06 evidence file is missing: ${filePath}.`);
    }
    fail(unsafeCode, `Historical M05-T06 evidence file is unsafe: ${filePath}.`, {
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
    fail(unsafeCode, `Historical M05-T06 evidence is not a safe bounded file: ${filePath}.`);
  }

  let handle;
  try {
    handle = await open(
      safePath.absolutePath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      !sameFileState(entry, before) ||
      before.size > BigInt(maximumBytes) ||
      (exactBytes !== undefined && before.size !== BigInt(exactBytes))
    ) {
      fail(unsafeCode, `Historical M05-T06 evidence changed before reading: ${filePath}.`);
    }
    const bytes = await readExactOpenHandleBytes(handle, Number(before.size));
    const [after, currentEntry, canonicalAfter] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(safePath.absolutePath, { bigint: true }),
      realpath(safePath.absolutePath),
    ]);
    await assertSafeParentIdentity(safePath, unsafeCode);
    if (
      bytes.length !== Number(before.size) ||
      bytes.length > maximumBytes ||
      (exactBytes !== undefined && bytes.length !== exactBytes) ||
      !sameFileState(before, after) ||
      !sameFileState(after, currentEntry) ||
      currentEntry.isSymbolicLink() ||
      canonicalAfter !== safePath.absolutePath
    ) {
      fail(unsafeCode, `Historical M05-T06 evidence changed during reading: ${filePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof RuntimeReactFailureBoundaryEvidenceError) throw error;
    fail(unsafeCode, `Historical M05-T06 evidence could not be read safely: ${filePath}.`, {
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

async function inspectAtomicParent(parentPath, expectedIdentity = undefined) {
  if (!path.isAbsolute(parentPath) || path.resolve(parentPath) !== parentPath) {
    throw new TypeError("Historical M05-T06 atomic parent path is not exact.");
  }
  const before = await lstat(parentPath, { bigint: true });
  const canonical = await realpath(parentPath);
  const after = await lstat(parentPath, { bigint: true });
  if (
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    canonical !== parentPath ||
    !sameFileIdentity(before, after) ||
    (expectedIdentity !== undefined && !sameFileIdentity(expectedIdentity, after))
  ) {
    throw new TypeError("Historical M05-T06 atomic parent identity or canonical path changed.");
  }
  return after;
}

async function inspectOptionalAtomicDestination(artifactPath) {
  let entry;
  try {
    entry = await lstat(artifactPath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new TypeError(
      "Historical M05-T06 atomic destination must be absent or a regular non-symlink file.",
    );
  }
  if ((await realpath(artifactPath)) !== artifactPath) {
    throw new TypeError("Historical M05-T06 atomic destination path is not canonical.");
  }
  return entry;
}

async function removeTrustedAtomicTemporary({
  parentPath,
  parentIdentity,
  temporaryPath,
  temporaryIdentity,
}) {
  try {
    await inspectAtomicParent(parentPath, parentIdentity);
  } catch {
    // Never unlink through a replaced, symlinked, or identity-lost parent.
    return;
  }
  let entry;
  try {
    entry = await lstat(temporaryPath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    return;
  }
  if (!entry.isFile() || entry.isSymbolicLink() || !sameFileIdentity(entry, temporaryIdentity)) {
    return;
  }
  try {
    await unlink(temporaryPath);
  } catch {
    // Cleanup is best-effort after the primary controlled failure.
  }
}

async function writeAuthenticatedAtomicCopy({ artifactPath, artifactBytes, beforeAtomicRename }) {
  const parentPath = path.dirname(artifactPath);
  const parentIdentity = await inspectAtomicParent(parentPath);
  await inspectOptionalAtomicDestination(artifactPath);
  const temporaryPath = path.join(
    parentPath,
    `.${path.basename(artifactPath)}.${randomBytes(12).toString("hex")}.tmp`,
  );
  const expectedBytes = Reflect.apply(BUFFER_FROM, BUFFER_CONSTRUCTOR, [artifactBytes]);
  const handle = await open(
    temporaryPath,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_RDWR |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0),
    0o600,
  );
  let handleOpen = true;
  let temporaryIdentity;
  try {
    temporaryIdentity = await handle.stat({ bigint: true });
    if (!temporaryIdentity.isFile()) {
      throw new TypeError("Historical M05-T06 atomic temporary is not a regular file.");
    }
    await handle.writeFile(expectedBytes);
    await handle.sync();
    if (beforeAtomicRename !== undefined) {
      await beforeAtomicRename(Object.freeze({ artifactPath, temporaryPath }));
    }

    await inspectAtomicParent(parentPath, parentIdentity);
    const [handleEntry, pathEntry, temporaryBytes] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(temporaryPath, { bigint: true }),
      readExactOpenHandleBytes(handle, expectedBytes.length),
    ]);
    if (
      !handleEntry.isFile() ||
      !pathEntry.isFile() ||
      pathEntry.isSymbolicLink() ||
      !sameFileIdentity(temporaryIdentity, handleEntry) ||
      !sameFileIdentity(handleEntry, pathEntry) ||
      handleEntry.size !== BigInt(expectedBytes.length) ||
      sha256(temporaryBytes) !== HISTORICAL_ARTIFACT_SHA256
    ) {
      throw new TypeError(
        "Historical M05-T06 atomic temporary identity or bytes changed before rename.",
      );
    }
    await inspectAtomicParent(parentPath, parentIdentity);
    await inspectOptionalAtomicDestination(artifactPath);
    await inspectAtomicParent(parentPath, parentIdentity);
    await handle.close();
    handleOpen = false;
    await rename(temporaryPath, artifactPath);

    await inspectAtomicParent(parentPath, parentIdentity);
    const [committedEntry, committedCanonical] = await Promise.all([
      lstat(artifactPath, { bigint: true }),
      realpath(artifactPath),
    ]);
    if (
      !committedEntry.isFile() ||
      committedEntry.isSymbolicLink() ||
      !sameFileIdentity(temporaryIdentity, committedEntry) ||
      committedEntry.size !== BigInt(expectedBytes.length) ||
      committedCanonical !== artifactPath
    ) {
      throw new TypeError(
        "Historical M05-T06 committed artifact identity or canonical path changed.",
      );
    }
    const committedBytes = await readRegularFile(
      artifactPath,
      "FAILURE_BOUNDARY_ARTIFACT_MISSING",
      "FAILURE_BOUNDARY_ARTIFACT_UNSAFE",
      HISTORICAL_ARTIFACT_BYTES,
      HISTORICAL_ARTIFACT_BYTES,
    );
    if (sha256(committedBytes) !== HISTORICAL_ARTIFACT_SHA256) {
      throw new TypeError("Historical M05-T06 committed artifact bytes differ from input.");
    }
    return Object.freeze({ artifactPath: committedCanonical });
  } catch (error) {
    if (handleOpen) {
      try {
        await handle.close();
      } catch {
        // Preserve the primary atomic-write failure.
      }
    }
    if (temporaryIdentity !== undefined) {
      await removeTrustedAtomicTemporary({
        parentPath,
        parentIdentity,
        temporaryPath,
        temporaryIdentity,
      });
    }
    throw error;
  }
}

function freezeJson(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const member of Object.values(value)) freezeJson(member);
  return Object.freeze(value);
}

function artifactSemantics(artifact) {
  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  return {
    schemaVersion: artifact.schemaVersion,
    task: artifact.task,
    result: artifact.result,
    profile: artifact.profile,
    protocol: artifact.protocol,
    target: artifact.target,
    claim: artifact.claim,
    boundary: artifact.boundary,
    publicApi: artifact.publicApi,
    focusedScript: artifact.evidence?.focusedScript,
    tests: artifact.evidence?.tests,
    sourceAssertions: artifact.evidence?.sourceAssertions,
    dynamicExecutableImports: artifact.evidence?.dynamicExecutableImports,
    trackedPaths: trackedFiles.map((entry) => entry?.path),
    verifierExecutionProfile: artifact.evidence?.verifierExecutionProfile,
    historicalArtifactsRewritten: artifact.evidence?.historicalArtifactsRewritten,
    traceability: artifact.evidence?.traceability,
    nonclaims: artifact.nonclaims,
  };
}

function inspectHistoricalArtifact(bytes) {
  if (bytes.length !== HISTORICAL_ARTIFACT_BYTES) {
    fail(
      "FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T06 artifact byte length changed.",
      { expected: HISTORICAL_ARTIFACT_BYTES, actual: bytes.length },
    );
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== HISTORICAL_ARTIFACT_SHA256) {
    fail(
      "FAILURE_BOUNDARY_HISTORICAL_ARTIFACT_DRIFT",
      "Immutable task-time M05-T06 artifact bytes changed.",
      { expected: HISTORICAL_ARTIFACT_SHA256, actual: actualSha256 },
    );
  }

  let artifact;
  try {
    artifact = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    fail(
      "FAILURE_BOUNDARY_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T06 artifact is not valid JSON.",
    );
  }

  const trackedFiles = Array.isArray(artifact.evidence?.trackedFiles)
    ? artifact.evidence.trackedFiles
    : [];
  const trackedPaths = trackedFiles.map((entry) => entry?.path);
  const trackedInventoryValid =
    trackedFiles.length === EXPECTED_TRACKED_PATHS.length &&
    new Set(trackedPaths).size === trackedPaths.length &&
    trackedFiles.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        Object.getPrototypeOf(entry) === Object.prototype &&
        typeof entry.path === "string" &&
        Number.isSafeInteger(entry.bytes) &&
        entry.bytes >= 0 &&
        /^sha256:[0-9a-f]{64}$/u.test(entry.sha256),
    );
  const actual = artifactSemantics(artifact);
  if (
    !isDeepStrictEqual(actual, EXPECTED_SEMANTICS) ||
    !isDeepStrictEqual(artifact.prerequisites, EXPECTED_PREREQUISITES) ||
    !trackedInventoryValid
  ) {
    fail(
      "FAILURE_BOUNDARY_HISTORICAL_SEMANTIC_DRIFT",
      "Immutable task-time M05-T06 artifact lost its reviewed semantics or inventory.",
      { expected: EXPECTED_SEMANTICS, actual },
    );
  }
  return freezeJson(artifact);
}

function sectionLines(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const indexes = lines.flatMap((line, index) => (line === heading ? [index] : []));
  if (indexes.length !== 1) {
    fail("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT", `Expected one exact ${heading} section.`);
  }
  const start = indexes[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start, end === -1 ? lines.length : end);
}

function exactRow(markdown, id) {
  const rows = markdown.split(/\r?\n/u).filter((line) => line.startsWith(`| ${id} |`));
  if (rows.length !== 1) {
    fail("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT", `Expected one exact ${id} row.`);
  }
  return rows[0];
}

function canonicalizeExactTableRow(row, expectedCellCount, label) {
  const fields = row.split("|");
  if (fields.length !== expectedCellCount + 2 || fields[0] !== "" || fields.at(-1) !== "") {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      `${label} no longer has its exact table-cell structure.`,
      { expectedCellCount, actualCellCount: Math.max(0, fields.length - 2) },
    );
  }
  const cells = fields.slice(1, -1).map((field) => field.replace(/^[ \t]+|[ \t]+$/gu, ""));
  if (cells.some((cell) => cell.length === 0)) {
    fail("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT", `${label} contains an empty semantic table cell.`);
  }
  return `| ${cells.join(" | ")} |`;
}

function verifyLocationPin(lines, artifactPath, artifactSha256, label) {
  const section = lines.join("\n");
  const pathToken = `\`${artifactPath}\``;
  const shaToken = `\`sha256:${artifactSha256}\``;
  if (
    section.split(pathToken).length - 1 !== 1 ||
    section.split(shaToken).length - 1 !== 1 ||
    section.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      `${label} artifact path or SHA moved, changed, or became ambiguous.`,
    );
  }
}

function verifyNeedles(lines, needles, label) {
  const section = lines.join("\n").replace(/\s+/gu, " ");
  for (const needle of needles) {
    if (!section.includes(needle.replace(/\s+/gu, " "))) {
      fail("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT", `${label} lost reviewed semantics.`, {
        needle,
      });
    }
  }
}

function countToken(text, token) {
  return text.split(token).length - 1;
}

function verifyExactTextDigest(text, expected, label) {
  const actual = {
    bytes: Reflect.apply(BUFFER_BYTE_LENGTH, BUFFER_CONSTRUCTOR, [text, "utf8"]),
    sha256: sha256(text),
  };
  if (!isDeepStrictEqual(actual, expected)) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      `${label} changed outside its exact reviewed semantic body.`,
      { expected, actual },
    );
  }
}

function verifyGlobalPinCounts(text, artifactPath, expectedPathCount, expectedShaCount, label) {
  const actualPathCount = countToken(text, artifactPath);
  const actualShaCount = countToken(text, HISTORICAL_ARTIFACT_SHA256);
  if (
    actualPathCount !== expectedPathCount ||
    actualShaCount !== expectedShaCount ||
    text.includes("[PENDING_FINAL_ARTIFACT_SHA256]")
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      `${label} contains missing, duplicate, pending, or displaced historical pins.`,
      {
        expectedPathCount,
        actualPathCount,
        expectedShaCount,
        actualShaCount,
      },
    );
  }
}

function verifyDocumentation(proofText, matrixText, normativeText, findingsText) {
  const proofEvidenceSection = sectionLines(proofText, "## Evidence artifact");
  const matrixSection = sectionLines(matrixText, "## M05-T06");
  const findingSection = sectionLines(
    findingsText,
    "## PF-055 — React failure containment is whole-surface when exact origin is unavailable",
  );
  const p17 = exactRow(matrixText, "P-17");
  const n037 = exactRow(normativeText, "N-037");

  verifyExactTextDigest(proofText, EXPECTED_DOCUMENT_DIGESTS.proof, "Human-readable proof");
  verifyExactTextDigest(
    matrixSection.join("\n"),
    EXPECTED_DOCUMENT_DIGESTS.matrixSection,
    "Proof Matrix M05-T06 section",
  );
  verifyExactTextDigest(
    canonicalizeExactTableRow(p17, 8, "Proof Matrix P-17 row"),
    EXPECTED_DOCUMENT_DIGESTS.matrixRow,
    "Proof Matrix P-17 row",
  );
  verifyExactTextDigest(
    canonicalizeExactTableRow(n037, 6, "N-037 row"),
    EXPECTED_DOCUMENT_DIGESTS.normativeRow,
    "N-037 row",
  );
  verifyExactTextDigest(
    findingSection.join("\n"),
    EXPECTED_DOCUMENT_DIGESTS.findingSection,
    "PF-055 section",
  );
  verifyGlobalPinCounts(proofText, ARTIFACT_RELATIVE_PATH, 1, 1, "Human-readable proof");
  verifyGlobalPinCounts(matrixText, ARTIFACT_FILE_NAME, 2, 2, "Proof Matrix");
  verifyGlobalPinCounts(normativeText, ARTIFACT_RELATIVE_PATH, 1, 1, "Normative coverage");

  verifyLocationPin(
    proofEvidenceSection,
    ARTIFACT_RELATIVE_PATH,
    HISTORICAL_ARTIFACT_SHA256,
    "Human-readable proof",
  );
  verifyNeedles(
    proofText.split(/\r?\n/u),
    [
      "whole-surface fail-closed",
      "leaf component",
      "null identity",
      "two always-mounted sibling",
      "`recoveryKey`",
      "no placeholder",
      "`ignoreRuntimeReactRootCaughtError`",
      "full React-root unmount",
      "immutable task-time M05-T06 artifact",
      "does not rebuild evidence from current successor source",
    ],
    "Human-readable proof",
  );

  verifyLocationPin(
    matrixSection,
    ARTIFACT_FILE_NAME,
    HISTORICAL_ARTIFACT_SHA256,
    "Proof Matrix section",
  );

  const p17Cells = p17.split("|").map((cell) => cell.trim());
  if (
    p17Cells[3] !== "M02-T13, M04-T13–M04-T17, M05-T06, M07-T04" ||
    p17Cells[4] !== "PARTIAL" ||
    !p17Cells[6]?.includes("M07-T04") ||
    p17Cells[6]?.includes("M05-T06")
  ) {
    fail(
      "FAILURE_BOUNDARY_DOCUMENTATION_DRIFT",
      "P-17 lost its exact M05-T06 partial-proof state or M07-T04 remainder.",
    );
  }
  verifyLocationPin([p17], ARTIFACT_FILE_NAME, HISTORICAL_ARTIFACT_SHA256, "P-17");

  const n037Cells = n037.split("|").map((cell) => cell.trim());
  if (n037Cells[4] !== "M05-T06" || n037Cells[5] !== "TESTED") {
    fail("FAILURE_BOUNDARY_DOCUMENTATION_DRIFT", "N-037 lost its exact M05-T06 tested state.");
  }
  verifyLocationPin([n037], ARTIFACT_RELATIVE_PATH, HISTORICAL_ARTIFACT_SHA256, "N-037");

  verifyNeedles(
    findingSection,
    [
      "- Status: OPEN",
      "Containment is whole-surface.",
      "every identity field",
      "trusted runtime results",
      "one deduplicated",
      "omitted `recoveryKey` deliberately means never retry",
      "cleanup during complete React-root",
      "M05-T07 now wires",
      "M05-T08 now exercises",
      "M05-T09 now proves",
      "M06-T11 still owns",
      "M07-T04 owns",
    ],
    "PF-055",
  );
}

/**
 * Reads exact immutable M05-T06 evidence without consulting current successor source or tests.
 */
export async function buildRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions, ["artifactPath", "artifactBytes"], "build");
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  assertExclusivePair(artifactPath, options.artifactBytes, "build artifactPath/artifactBytes");
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const historicalBytes =
    artifactBytes ??
    (await readRegularFile(
      artifactPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
      "FAILURE_BOUNDARY_ARTIFACT_MISSING",
      "FAILURE_BOUNDARY_ARTIFACT_UNSAFE",
      HISTORICAL_ARTIFACT_BYTES,
      HISTORICAL_ARTIFACT_BYTES,
    ));
  const artifact = inspectHistoricalArtifact(historicalBytes);
  return Object.freeze({
    artifact,
    artifactBytes: Reflect.apply(BUFFER_FROM, BUFFER_CONSTRUCTOR, [historicalBytes]),
    artifactSha256: HISTORICAL_ARTIFACT_SHA256,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}

/** Verifies immutable M05-T06 bytes, reviewed semantics, inventory, and exact current proof pins. */
export async function verifyRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    [
      "artifactPath",
      "artifactBytes",
      "proofPath",
      "proofDocumentText",
      "proofMatrixPath",
      "proofMatrixText",
      "normativeCoveragePath",
      "normativeCoverageText",
      "findingsPath",
      "findingsText",
    ],
    "verify",
  );
  const artifactPath = optionalPath(options.artifactPath, "artifactPath");
  assertExclusivePair(
    artifactPath,
    options.artifactBytes,
    "verification artifactPath/artifactBytes",
  );
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const proofPath = optionalPath(options.proofPath, "proofPath");
  const proofDocumentText = optionalText(options.proofDocumentText, "proofDocumentText");
  assertExclusivePair(proofPath, proofDocumentText, "proofPath/proofDocumentText");
  const proofMatrixPath = optionalPath(options.proofMatrixPath, "proofMatrixPath");
  const proofMatrixText = optionalText(options.proofMatrixText, "proofMatrixText");
  assertExclusivePair(proofMatrixPath, proofMatrixText, "proofMatrixPath/proofMatrixText");
  const normativeCoveragePath = optionalPath(
    options.normativeCoveragePath,
    "normativeCoveragePath",
  );
  const normativeCoverageText = optionalText(
    options.normativeCoverageText,
    "normativeCoverageText",
  );
  assertExclusivePair(
    normativeCoveragePath,
    normativeCoverageText,
    "normativeCoveragePath/normativeCoverageText",
  );
  const findingsPath = optionalPath(options.findingsPath, "findingsPath");
  const findingsText = optionalText(options.findingsText, "findingsText");
  assertExclusivePair(findingsPath, findingsText, "findingsPath/findingsText");
  const built = await buildRuntimeReactFailureBoundaryEvidence({
    ...(artifactPath === undefined ? {} : { artifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  const [proofText, matrixText, normativeText, findingText] = await Promise.all([
    proofDocumentText ??
      readRegularFile(
        proofPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    proofMatrixText ??
      readRegularFile(
        proofMatrixPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_PROOF_MATRIX_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    normativeCoverageText ??
      readRegularFile(
        normativeCoveragePath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_NORMATIVE_COVERAGE_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
    findingsText ??
      readRegularFile(
        findingsPath ?? DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_FINDINGS_PATH,
        "FAILURE_BOUNDARY_DOCUMENTATION_MISSING",
        "FAILURE_BOUNDARY_DOCUMENTATION_UNSAFE",
        MAX_DOCUMENT_BYTES,
      ).then((bytes) => bytes.toString("utf8")),
  ]);
  verifyDocumentation(proofText, matrixText, normativeText, findingText);
  return Object.freeze({
    result: built.artifact.result,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    compatibilityMode: COMPATIBILITY_MODE,
    prerequisitePins: EXPECTED_PREREQUISITES.length,
    trackedFiles: EXPECTED_TRACKED_PATHS.length,
    sourceAssertions: EXPECTED_SEMANTICS.sourceAssertions,
    focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    publicRuntimeExports: EXPECTED_PUBLIC_API.runtimeExports.length,
    publicTypeExports: EXPECTED_PUBLIC_API.typeExports.length,
    nonclaims: EXPECTED_NONCLAIMS.length,
    normativeStatus: "N-037:TESTED",
    proofStatus: "P-17:PARTIAL",
    taskLocalApplicabilityStatus: "D-009:DEFERRED",
    exactDocumentationReferences: 4,
  });
}

/** Atomically copies only exact already-authenticated immutable M05-T06 task-time bytes. */
export async function writeRuntimeReactFailureBoundaryEvidence(rawOptions = undefined) {
  const options = captureOptions(
    rawOptions,
    ["sourceArtifactPath", "artifactBytes", "artifactPath", "beforeAtomicRename"],
    "write",
  );
  const sourceArtifactPath = optionalPath(options.sourceArtifactPath, "sourceArtifactPath");
  assertExclusivePair(
    sourceArtifactPath,
    options.artifactBytes,
    "writer sourceArtifactPath/artifactBytes",
  );
  const artifactBytes = optionalBytes(options.artifactBytes, "artifactBytes");
  const destinationWasExplicit = hasOwn(options, "artifactPath");
  if (destinationWasExplicit && options.artifactPath === undefined) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      "Historical M05-T06 explicit artifactPath must not be undefined.",
    );
  }
  const destinationPath =
    optionalPath(options.artifactPath, "artifactPath") ??
    DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH;
  const beforeAtomicRename = optionalCallback(options.beforeAtomicRename, "beforeAtomicRename");
  if (!destinationWasExplicit && beforeAtomicRename !== undefined) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      "Historical M05-T06 no-op default writer does not accept an atomic-rename callback.",
    );
  }
  if (
    !destinationWasExplicit &&
    (sourceArtifactPath !== undefined || artifactBytes !== undefined)
  ) {
    fail(
      "FAILURE_BOUNDARY_OPTIONS_INVALID",
      "Historical M05-T06 no-op default writer does not accept a source override.",
    );
  }
  if (
    destinationWasExplicit &&
    destinationPath === DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH
  ) {
    fail(
      "FAILURE_BOUNDARY_ARTIFACT_UNSAFE",
      "Immutable task-time M05-T06 artifact cannot be an explicit write destination.",
    );
  }
  const built = await buildRuntimeReactFailureBoundaryEvidence({
    ...(sourceArtifactPath === undefined ? {} : { artifactPath: sourceArtifactPath }),
    ...(artifactBytes === undefined ? {} : { artifactBytes }),
  });
  if (!destinationWasExplicit) {
    return Object.freeze({
      result: built.artifact.result,
      artifactPath: DEFAULT_RUNTIME_REACT_FAILURE_BOUNDARY_ARTIFACT_PATH,
      artifactSha256: built.artifactSha256,
      artifactBytes: built.artifactBytes.length,
      trackedFiles: EXPECTED_TRACKED_PATHS.length,
      focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
      compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
      rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
      compatibilityMode: COMPATIBILITY_MODE,
      preserved: true,
    });
  }
  let atomicResult;
  try {
    atomicResult = await writeAuthenticatedAtomicCopy({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename,
    });
  } catch (error) {
    fail("FAILURE_BOUNDARY_ARTIFACT_UNSAFE", "Atomic M05-T06 compatibility write failed safely.", {
      cause: String(error),
    });
  }
  return Object.freeze({
    result: built.artifact.result,
    artifactPath: atomicResult.artifactPath,
    artifactSha256: built.artifactSha256,
    artifactBytes: built.artifactBytes.length,
    trackedFiles: EXPECTED_TRACKED_PATHS.length,
    focusedTests: EXPECTED_SEMANTICS.tests.focusedCases,
    compilerNegativeCases: EXPECTED_SEMANTICS.tests.compilerNegativeCases,
    rootMutationTests: EXPECTED_SEMANTICS.tests.rootMutationTests,
    compatibilityMode: COMPATIBILITY_MODE,
  });
}
