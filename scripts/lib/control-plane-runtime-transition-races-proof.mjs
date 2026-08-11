import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import { constants as osConstants, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-transition-races.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-TRANSITION-RACES.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTROLLER_SOURCE = `${APP_DIRECTORY}/src/runtime-activation-internal.ts`;
const APP_SQLITE_SOURCE = `${APP_DIRECTORY}/src/runtime-activation-sqlite-internal.ts`;
const APP_TEST = `${APP_DIRECTORY}/test/runtime-transition-races.test.ts`;
const APP_TEST_SUPPORT = `${APP_DIRECTORY}/test/runtime-fault-injection-support.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-transition-races.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-transition-races-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-transition-races.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-transition-races-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-transition-races.test.mjs";
const DIST_INDEX = `${APP_DIRECTORY}/dist/index.js`;
const DIST_TYPES = `${APP_DIRECTORY}/dist/index.d.ts`;
const VITEST_CLI = path.join(ROOT, "node_modules/vitest/vitest.mjs");

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES = 8 * 1_024 * 1_024;
const KNOWN_RUNTIME_SUITE_SIGNALS = Object.freeze(
  Object.keys(osConstants.signals)
    .filter((signal) => /^SIG[A-Z0-9]+$/u.test(signal))
    .sort(),
);
const VITEST_CONFIG_SOURCE =
  "export default { test: { cache: false, fileParallelism: false, maxWorkers: 1 } };\n";
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
const UINT8_ARRAY_SET = Uint8Array.prototype.set;
const execFileAsync = promisify(execFile);

const PROOF_ID = "control-plane-runtime-transition-races";
const APP_SUITE_NAME = "M07-T10 ordered activation transition and race matrix";

// These exact executable receipts are filled only after the implementation and both test files
// are final. They make a later same-shaped body rewrite visible instead of trusting names alone.
const APP_CONTROLLER_SOURCE_SHA256 =
  "a166fc51237c4d7b3389282fd424b5156c2d782c3fceab37f424fead93629880";
const APP_SQLITE_SOURCE_SHA256 = "cec7d1437d7e222facdc5681ae720ec6bc3b77fe3f9f5fac7493481f868be164";
const APP_TEST_SHA256 = "4263aa47e7f6d647fe9e08acd19dc305fd53f0acc06383c9b300381a27a008f2";
const APP_TEST_SUPPORT_SHA256 = "4b9d00a34bc6fe6fa0c31e7f32e8f2fa835da9c01745e723a77a3f9bcd5cffc5";
const APP_TYPE_TEST_SHA256 = "ddda51882a5783b9a3fe291da84fbddd7d7cb298a91c6f0a1ec4ae7515a8d0d8";
const ROOT_TEST_SHA256 = "5b0bed4eeedf4971ca18d2f698f9e7702c4fc3d8ee728231ef3b30fff204dcbc";
const EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256 =
  "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43";
const EXPECTED_REGISTRATION_AUTHORITY_SHA256 = Object.freeze({
  [CI_SOURCE]: "fdb79dcf8e5fa46e6a22e07e04fc1623214ea0af164b3dde2d876531479177f3",
  [CI_INVENTORY]: "3b411b2866820003896a7fe6e41fb5fca2db84300687e07d10ab92ce5fdb407f",
  [SHARED_STATE_AUTHORITY]: "f7827f300a9a53edc6a0c41bf1246df53d5ab21c4cd4e67c6452a2cb95c74e99",
});

const EXPECTED_TRANSITION_CASE_IDS = Object.freeze([
  "ordered-unsupported-protocol",
  "ordered-revision-mismatch",
  "ordered-source-digest-mismatch",
  "ordered-package-missing",
  "ordered-package-digest-mismatch",
  "ordered-reference-capability",
  "ordered-reference-limit",
  "ordered-staging-contract",
  "same-candidate-race",
  "different-candidate-race",
  "recovery-activation-race",
  "activation-recovery-race",
  "restart-stale-reconstruction",
  "journal-mode-external-transition",
  "journal-mode-writer-reauthentication",
]);

const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "[ordered-unsupported-protocol] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-revision-mismatch] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-source-digest-mismatch] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-package-missing] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-package-digest-mismatch] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-reference-capability] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-reference-limit] preserves A, rejects B, activates C, and recovers C over A",
  "[ordered-staging-contract] preserves A, rejects B, activates C, and recovers C over A",
  "[same-candidate-race] commits one winner, fences one loser, and requires fresh staging",
  "[different-candidate-race] commits one winner, fences one loser, and preserves exact lineage",
  "[recovery-activation-race] rejects stale reconstruction after a concurrent durable winner",
  "[activation-recovery-race] revokes recovered A after a delayed C commit wins",
  "[restart-stale-reconstruction] publishes only the exact durable winner after restart",
  "[journal-mode-external-transition] rejects a live external journal transition and continues safely",
  "[journal-mode-writer-reauthentication] fails closed on transaction-time profile drift",
  "keeps the exact transition-case inventory closed and duplicate-free",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node scripts/generate-control-plane-runtime-transition-races-proof.mjs",
  verify:
    "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node scripts/verify-control-plane-runtime-transition-races.mjs",
  test: "pnpm verify:control-plane-runtime-fault-injection && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-transition-races && node --test tests/control-plane-runtime-transition-races.test.mjs",
});

const EXPECTED_RUNTIME_PUBLIC_MODULE_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
  "BUNDLE_RUNTIME_STAGING_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
  "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
  "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
  "INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE",
  "LOCAL_CONTROL_PLANE_ERROR_MESSAGES",
  "LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN",
  "LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE",
  "LOCAL_CONTROL_PLANE_LIMITS",
  "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS",
  "LocalControlPlaneError",
  "PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE",
  "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
  "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
  "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
  "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
  "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  "RUNTIME_STAGING_INTERNAL_FAILURE_CODE",
  "RUNTIME_STAGING_LIMIT_EXCEEDED_CODE",
  "RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE",
  "RuntimeActivationError",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleRuntimeActivation",
  "openBundleStore",
  "openLocalControlPlane",
  "preflightBundlePackages",
  "preflightBundleReferences",
  "stageBundleRuntime",
  "verifyBundleStoreEntry",
]);

const EXPECTED_TRACE_ROWS = Object.freeze([
  Object.freeze({ id: "C-023", owners: ["M04-T16", "M07-T10"], tests: ["M10-T07", "M12-T08"] }),
  Object.freeze({ id: "PIPE-005", owners: ["M06-T09", "M07-T01"], tests: ["M06-T10", "M07-T10"] }),
  Object.freeze({ id: "PIPE-007", owners: ["M07-T04", "M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "PIPE-011", owners: ["M07-T02"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "PIPE-016", owners: ["M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "PIPE-017", owners: ["M07-T07", "M07-T08"], tests: ["M07-T10", "M10-T07"] }),
  Object.freeze({ id: "R-007", owners: ["M06-T09", "M07-T02"], tests: ["M05-T08", "M07-T10"] }),
  Object.freeze({ id: "R-008", owners: ["M07-T04", "M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "R-012", owners: ["M06-T09", "M07-T01"], tests: ["M06-T10", "M07-T10"] }),
  Object.freeze({ id: "R-102", owners: ["M07-T07", "M07-T09"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({
    id: "R-125",
    owners: ["M03-T10", "M07-T01", "M07-T05"],
    tests: ["M03-T10", "M07-T10"],
  }),
  Object.freeze({ id: "R-126", owners: ["M07-T06", "M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "A-007", owners: ["M03-T10", "M07-T01"], tests: ["M03-T10", "M07-T10"] }),
  Object.freeze({ id: "A-008", owners: ["M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({ id: "A-009", owners: ["M07-T07", "M07-T08"], tests: ["M07-T10", "M10-T07"] }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTROLLER_SOURCE,
  APP_SQLITE_SOURCE,
  APP_TEST,
  APP_TEST_SUPPORT,
  APP_TYPE_TEST,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
  SHARED_STATE_AUTHORITY,
  TRACEABILITY,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
]);
// Generator/verifier infrastructure is recorded from the live workspace only. Unlike semantic
// task inputs, these files have no inert projection that could authenticate supplied replacement
// bytes, so the test override seam must not accept them.
const TRACKED_FILE_OVERRIDE_PATHS = Object.freeze(
  TRACKED_TASK_FILES.filter(
    (relativePath) =>
      relativePath !== GENERATOR &&
      relativePath !== VERIFIER &&
      relativePath !== PROOF_LIBRARY &&
      relativePath !== ATOMIC_WRITER,
  ),
);

export const CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    bytes: 22_396,
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "M07-T02",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json",
    bytes: 48_642,
    sha256: "db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a",
  }),
  Object.freeze({
    task: "M07-T03",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
    bytes: 62_743,
    sha256: "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    bytes: 34_612,
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T05",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
    bytes: 41_945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
  }),
  Object.freeze({
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    bytes: 47_622,
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
  }),
  Object.freeze({
    task: "M07-T07",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json",
    bytes: 49_892,
    sha256: "3129a8e40c837a1c49d7fe206de794e0f7f7e130dc7e5e90a012b9e38bf07334",
  }),
  Object.freeze({
    task: "M07-T08",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-recovery.json",
    bytes: 44_224,
    sha256: "c65d4f2de1407fffb891b5d3ba2fc8a3a8d4e3f0fb76c8b8f2719be6b310b3f9",
  }),
  Object.freeze({
    task: "M07-T09",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json",
    bytes: 64_493,
    sha256: "9d0f764e35f5400fa662874784fba6f6492a39a0e60557fe1a9c7d7eab5407c9",
  }),
]);

export const CONTROL_PLANE_RUNTIME_TRANSITION_RACES_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact M07-T10 ordered-transition and two-way race artifact",
  "[determinism] two independent evidence builds are byte-identical",
  "[prerequisites] rejects drift in every immutable M07-T01 through M07-T09 artifact",
  "[runtime] rejects case-inventory drift and a changed executable suite receipt",
  "[implementation] rejects profile-guard removal and public-export growth",
  "[registration] binds every captured CI byte source to its executable authority",
  "[traceability] rejects every missing M07-T10 assignment and one extra assignment",
  "[artifact] verifies exact bytes and rejects one changed byte",
  "[writer] atomically writes deterministic evidence and preserves the destination on failure",
  "[options] rejects unknown, accessor, proxy, cyclic, and shared-memory inputs",
  "[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority",
  "[immutability] recursively freezes the graph and preserves later-scope nonclaims",
]);

export const DEFAULT_CONTROL_PLANE_RUNTIME_TRANSITION_RACES_ARTIFACT_PATH = path.join(
  ROOT,
  ARTIFACT,
);

export class ControlPlaneRuntimeTransitionRacesEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeTransitionRacesEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeTransitionRacesEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    typeof value !== "object" ||
    value === null ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    fail("INVALID_OPTIONS", `${label} must be one ordinary own-data record.`);
  }
  const result = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.has(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("INVALID_OPTIONS", `${label} contains an unsupported or active field.`);
    }
    result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

function captureBytes(value, label) {
  try {
    if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
      fail("INVALID_OPTIONS", `${label} must be an authentic Uint8Array.`);
    }
    if (
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined ||
      TYPED_ARRAY_BYTE_OFFSET_GETTER === undefined
    ) {
      fail("INVALID_OPTIONS", `${label} cannot be captured by this runtime.`);
    }
    const buffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    const byteLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
    const byteOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []);
    if (
      utilTypes.isSharedArrayBuffer(buffer) ||
      !utilTypes.isAnyArrayBuffer(buffer) ||
      !Number.isSafeInteger(byteLength) ||
      !Number.isSafeInteger(byteOffset) ||
      byteLength < 0 ||
      byteOffset < 0 ||
      byteLength > MAX_AUTHORITY_BYTES
    ) {
      fail("INVALID_OPTIONS", `${label} must be bounded and nonshared.`);
    }
    const copy = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, copy, [new Uint8Array(buffer, byteOffset, byteLength)]);
    return copy;
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeTransitionRacesEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured safely.`);
  }
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }, depth = 0) {
  budget.nodes += 1;
  if (depth > 512 || budget.nodes > 200_000) {
    fail("INVALID_OPTIONS", `${label} exceeds its finite inert-JSON budget.`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("INVALID_OPTIONS", `${label} contains a non-finite number.`);
    return value;
  }
  if (typeof value !== "object" || utilTypes.isProxy(value) || active.has(value)) {
    fail("INVALID_OPTIONS", `${label} must contain only acyclic inert JSON.`);
  }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail("INVALID_OPTIONS", `${label} contains a non-ordinary array.`);
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1) {
        fail("INVALID_OPTIONS", `${label} contains a sparse or extended array.`);
      }
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          fail("INVALID_OPTIONS", `${label} contains an active array entry.`);
        }
        result.push(copyInertJson(descriptor.value, label, active, budget, depth + 1));
      }
      return Object.freeze(result);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("INVALID_OPTIONS", `${label} contains a non-ordinary record.`);
    }
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        typeof key !== "string" ||
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        fail("INVALID_OPTIONS", `${label} contains an active or symbolic field.`);
      }
      result[key] = copyInertJson(descriptor.value, label, active, budget, depth + 1);
    }
    return Object.freeze(result);
  } finally {
    active.delete(value);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  const captured = exactOwnDataOptions(value, new Set(allowedPaths), label);
  const result = {};
  for (const [relativePath, bytes] of Object.entries(captured)) {
    result[relativePath] = captureBytes(bytes, `${label}.${relativePath}`);
  }
  return Object.freeze(result);
}

function sameAuthorityIdentity(left, right) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

async function canonicalParent(requestedParent, expectedIdentity) {
  let entry;
  let canonical;
  try {
    entry = await lstat(requestedParent, { bigint: true });
    canonical = await realpath(requestedParent);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "A proof authority parent cannot be resolved.");
  }
  if (
    !entry.isDirectory() ||
    entry.isSymbolicLink() ||
    entry.nlink < 1n ||
    canonical !== requestedParent
  ) {
    fail("UNSAFE_AUTHORITY", "A proof authority parent must be one canonical directory.");
  }
  if (expectedIdentity !== undefined && !sameAuthorityIdentity(entry, expectedIdentity)) {
    fail("UNSAFE_AUTHORITY", "A proof authority parent changed while reading.");
  }
  return entry;
}

async function safeReadAbsolute(absolutePath, maximumBytes = MAX_AUTHORITY_BYTES) {
  const requested = path.resolve(absolutePath);
  const requestedParent = path.dirname(requested);
  const parentBefore = await canonicalParent(requestedParent);
  const resolved = path.join(requestedParent, path.basename(requested));
  let before;
  try {
    before = await lstat(resolved, { bigint: true });
  } catch {
    fail("AUTHORITY_IO_FAILURE", "A proof authority cannot be inspected.");
  }
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size > BigInt(maximumBytes)
  ) {
    fail("UNSAFE_AUTHORITY", "A proof authority must be one bounded regular single-link file.");
  }
  let handle;
  try {
    handle = await open(resolved, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || opened.nlink !== 1n || !sameAuthorityIdentity(opened, before)) {
      fail("UNSAFE_AUTHORITY", "A proof authority changed identity while opening.");
    }
    await canonicalParent(requestedParent, parentBefore);
    const expectedBytes = Number(opened.size);
    const target = Buffer.alloc(expectedBytes + 1);
    let total = 0;
    while (total < target.byteLength) {
      const { bytesRead } = await handle.read(target, total, target.byteLength - total, total);
      if (bytesRead === 0) break;
      total += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (total !== expectedBytes || total > maximumBytes || !sameAuthorityIdentity(after, opened)) {
      fail("UNSAFE_AUTHORITY", "A proof authority changed while reading.");
    }
    await canonicalParent(requestedParent, parentBefore);
    return new Uint8Array(target.subarray(0, total));
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeTransitionRacesEvidenceError) throw error;
    fail("AUTHORITY_IO_FAILURE", "A proof authority could not be read safely.");
  } finally {
    try {
      await handle?.close();
    } catch {
      // The primary authority result is already determined.
    }
  }
}

async function workspaceBytes(relativePath, overrides) {
  return Object.hasOwn(overrides, relativePath)
    ? overrides[relativePath]
    : safeReadAbsolute(path.join(ROOT, relativePath));
}

function fatalText(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("SOURCE_DRIFT", `${label} is not valid UTF-8.`);
  }
}

function parseJsonBytes(bytes, label, code = "SOURCE_DRIFT") {
  try {
    return JSON.parse(fatalText(bytes, label));
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeTransitionRacesEvidenceError) throw error;
    fail(code, `${label} is not valid JSON.`);
  }
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseTypescript(source, relativePath, code = "SOURCE_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(code, `${relativePath} is not valid TypeScript.`);
  }
  return sourceFile;
}

function expressionTarget(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = expressionTarget(expression.expression);
    return owner === undefined ? undefined : `${owner}.${expression.name.text}`;
  }
  return undefined;
}

function callTarget(call) {
  return expressionTarget(call.expression);
}

function allCalls(sourceFile, target) {
  const matches = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && callTarget(node) === target) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return matches;
}

function publicExportInventory(source) {
  const sourceFile = parseTypescript(source, APP_INDEX, "PUBLIC_EXPORT_DRIFT");
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
      if (
        ts.isExportAssignment(statement) ||
        modifiers?.some(
          ({ kind }) =>
            kind === ts.SyntaxKind.ExportKeyword || kind === ts.SyntaxKind.DefaultKeyword,
        )
      ) {
        fail("PUBLIC_EXPORT_DRIFT", "The package root contains a non-list export declaration.");
      }
      continue;
    }
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause) ||
      statement.moduleSpecifier === undefined ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      fail("PUBLIC_EXPORT_DRIFT", "The package root contains a non-explicit export declaration.");
    }
    for (const element of statement.exportClause.elements) {
      inventory.push({
        exported: element.name.text,
        imported: element.propertyName?.text ?? element.name.text,
        module: statement.moduleSpecifier.text,
        typeOnly: statement.isTypeOnly || element.isTypeOnly,
      });
    }
  }
  inventory.sort((left, right) => {
    const byName = compareText(left.exported, right.exported);
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  const inventorySha256 = sha256(Buffer.from(JSON.stringify(inventory), "utf8"));
  if (inventory.length !== 105 || inventorySha256 !== EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256) {
    fail("PUBLIC_EXPORT_DRIFT", "The exact package-root public export inventory drifted.", {
      expectedCount: 105,
      actualCount: inventory.length,
      expectedSha256: EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256,
      actualSha256: inventorySha256,
    });
  }
  return deepFreeze({ entries: inventory, count: inventory.length, sha256: inventorySha256 });
}

export const CONTROL_PLANE_RUNTIME_TRANSITION_RACES_EXPECTED_SUITE_RECEIPT = deepFreeze({
  suiteName: APP_SUITE_NAME,
  caseIds: [...EXPECTED_TRANSITION_CASE_IDS],
  tests: EXPECTED_RUNTIME_TEST_NAMES.map((title) => ({
    ancestorTitles: [APP_SUITE_NAME],
    fullName: `${APP_SUITE_NAME} ${title}`,
    status: "passed",
    title,
  })),
});

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS) {
    const bytes = await workspaceBytes(pin.path, overrides);
    const actualSha256 = sha256(bytes);
    if (bytes.byteLength !== pin.bytes || actualSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite drifted.`, {
        task: pin.task,
        expectedBytes: pin.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: pin.sha256,
        actualSha256,
      });
    }
    const artifact = parseJsonBytes(bytes, pin.path, "PREREQUISITE_DRIFT");
    if (artifact.task !== pin.task || artifact.result !== "PASS") {
      fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} artifact identity drifted.`);
    }
    receipts.push({ ...pin });
  }
  return deepFreeze(receipts);
}

async function fileReceipts(paths, overrides) {
  return deepFreeze(
    await Promise.all(
      [...new Set(paths)].sort().map(async (relativePath) => {
        const bytes = await workspaceBytes(relativePath, overrides);
        return { path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) };
      }),
    ),
  );
}

function literalStringArray(initializer, label) {
  let expression = initializer;
  while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
    expression = expression.expression;
  }
  if (
    ts.isCallExpression(expression) &&
    callTarget(expression) === "Object.freeze" &&
    expression.arguments.length === 1
  ) {
    [expression] = expression.arguments;
    while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
      expression = expression.expression;
    }
  }
  if (!ts.isArrayLiteralExpression(expression)) {
    fail("TEST_AUTHORITY_DRIFT", `${label} must be one literal frozen array.`);
  }
  return expression.elements.map((element) => {
    if (!ts.isStringLiteral(element) && !ts.isNoSubstitutionTemplateLiteral(element)) {
      fail("TEST_AUTHORITY_DRIFT", `${label} contains a nonliteral entry.`);
    }
    return element.text;
  });
}

function exactTopLevelConst(sourceFile, name) {
  const matches = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push({ declaration, statement });
      }
    }
  }
  if (
    matches.length !== 1 ||
    (matches[0].statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    matches[0].declaration.initializer === undefined
  ) {
    fail("TEST_AUTHORITY_DRIFT", `${name} is not one exact top-level const declaration.`);
  }
  return matches[0].declaration.initializer;
}

function runtimeTestInventory(source) {
  const sourceFile = parseTypescript(source, APP_TEST, "TEST_AUTHORITY_DRIFT");
  const caseIds = literalStringArray(
    exactTopLevelConst(sourceFile, "TRANSITION_CASE_IDS"),
    "TRANSITION_CASE_IDS",
  );
  if (
    JSON.stringify(caseIds) !== JSON.stringify(EXPECTED_TRANSITION_CASE_IDS) ||
    new Set(caseIds).size !== caseIds.length
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact closed 15-case M07-T10 inventory drifted.");
  }
  const describes = allCalls(sourceFile, "describe");
  if (
    describes.length !== 1 ||
    describes[0].arguments.length < 2 ||
    !ts.isStringLiteral(describes[0].arguments[0]) ||
    describes[0].arguments[0].text !== APP_SUITE_NAME
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The focused M07-T10 describe authority drifted.");
  }
  const names = allCalls(sourceFile, "it").map((call) => {
    if (call.arguments.length < 2 || !ts.isStringLiteral(call.arguments[0])) {
      fail("TEST_AUTHORITY_DRIFT", "Every focused M07-T10 test needs one literal title.");
    }
    return call.arguments[0].text;
  });
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact 16-test M07-T10 executable inventory drifted.");
  }
  for (let index = 0; index < caseIds.length; index += 1) {
    if (!names[index].startsWith(`[${caseIds[index]}]`)) {
      fail("TEST_AUTHORITY_DRIFT", "A stable case id is not bound to its exact test title.");
    }
  }
  return deepFreeze({ suiteName: APP_SUITE_NAME, caseIds, names });
}

function compilerNegativeInventory(source) {
  const sourceFile = parseTypescript(source, APP_TYPE_TEST, "TEST_AUTHORITY_DRIFT");
  const directives = [...source.matchAll(/@ts-expect-error\s+([^\r\n]+)/gu)].map((match) =>
    match[1].trim(),
  );
  if (directives.length !== 9 || new Set(directives).size !== directives.length) {
    fail("TEST_AUTHORITY_DRIFT", "The M07-T10 compiler-negative inventory must contain 9 cases.");
  }
  const publicImports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "../src/index.js",
  );
  if (publicImports.length !== 3) {
    fail("TEST_AUTHORITY_DRIFT", "Compiler-negative cases must consume the public package root.");
  }
  return deepFreeze(directives);
}

function rootTestInventory(source) {
  const sourceFile = parseTypescript(source, ROOT_TEST, "TEST_AUTHORITY_DRIFT");
  const names = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      callTarget(statement.expression) !== "test"
    ) {
      continue;
    }
    const call = statement.expression;
    if (call.arguments.length < 2 || !ts.isStringLiteral(call.arguments[0])) {
      fail("TEST_AUTHORITY_DRIFT", "Every root proof test needs one literal title.");
    }
    names.push(call.arguments[0].text);
  }
  if (
    allCalls(sourceFile, "test").length !== names.length ||
    JSON.stringify(names) !== JSON.stringify(CONTROL_PLANE_RUNTIME_TRANSITION_RACES_ROOT_TEST_NAMES)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact direct root mutation-test inventory drifted.");
  }
  return names;
}

function assertExactSourceSha(bytes, relativePath, expectedSha256, code = "SOURCE_RECEIPT_DRIFT") {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    fail(code, `${relativePath} exact executable authority drifted.`, {
      path: relativePath,
      expectedSha256,
      actualSha256,
    });
  }
}

function assertSameAuthorityBytes(expectedBytes, actualBytes, relativePath, code, phase) {
  const expectedSha256 = sha256(expectedBytes);
  const actualSha256 = sha256(actualBytes);
  if (actualBytes.byteLength !== expectedBytes.byteLength || actualSha256 !== expectedSha256) {
    fail(code, `${relativePath} changed across its ${phase} authority window.`, {
      path: relativePath,
      expectedBytes: expectedBytes.byteLength,
      actualBytes: actualBytes.byteLength,
      expectedSha256,
      actualSha256,
    });
  }
}

function profileGuardProjection(source) {
  const sourceFile = parseTypescript(source, APP_SQLITE_SOURCE, "IMPLEMENTATION_DRIFT");
  const profileCalls = allCalls(sourceFile, "assertConnectionProfile");
  const openDatabaseCalls = profileCalls.filter(
    (call) => ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === "openDatabase",
  );
  const initialDatabaseCalls = profileCalls.filter(
    (call) => ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === "database",
  );
  const beginRead = source.indexOf('openDatabase.exec("BEGIN");');
  const beginWrite = source.indexOf('openDatabase.exec("BEGIN IMMEDIATE");');
  const commit = source.indexOf('openDatabase.exec("COMMIT");', beginWrite);
  const profilePositions = openDatabaseCalls.map((call) => call.getStart(sourceFile)).sort();
  if (
    profileCalls.length !== 4 ||
    initialDatabaseCalls.length !== 1 ||
    openDatabaseCalls.length !== 3 ||
    beginRead < 0 ||
    beginWrite < 0 ||
    commit < 0 ||
    !(beginRead < profilePositions[0] && profilePositions[0] < beginWrite) ||
    !(beginWrite < profilePositions[1] && profilePositions[1] < commit) ||
    !(commit < profilePositions[2]) ||
    !source.includes('database.pragma("journal_mode", { simple: true }) !== "wal"') ||
    !source.includes('database.pragma("journal_mode = WAL")')
  ) {
    fail(
      "IMPLEMENTATION_DRIFT",
      "The complete open/read/writer/postcommit SQLite profile guard placement drifted.",
    );
  }
  return deepFreeze({
    initialProfileChecks: initialDatabaseCalls.length,
    transactionProfileChecks: openDatabaseCalls.length,
    readTransactionReauthentication: true,
    writerPreDmlReauthentication: true,
    postCommitReauthentication: true,
    journalModeEstablishedAsWal: true,
    profileDriftFailsClosedWithoutRepair: true,
  });
}

async function testProjection(overrides) {
  const [controllerBytes, sqliteBytes, appBytes, supportBytes, typeBytes, rootBytes] =
    await Promise.all([
      workspaceBytes(APP_CONTROLLER_SOURCE, overrides),
      workspaceBytes(APP_SQLITE_SOURCE, overrides),
      workspaceBytes(APP_TEST, overrides),
      workspaceBytes(APP_TEST_SUPPORT, overrides),
      workspaceBytes(APP_TYPE_TEST, overrides),
      workspaceBytes(ROOT_TEST, overrides),
    ]);
  const runtime = runtimeTestInventory(fatalText(appBytes, APP_TEST));
  const compilerNegativeClaims = compilerNegativeInventory(fatalText(typeBytes, APP_TYPE_TEST));
  const rootNames = rootTestInventory(fatalText(rootBytes, ROOT_TEST));
  const profileGuards = profileGuardProjection(fatalText(sqliteBytes, APP_SQLITE_SOURCE));
  assertExactSourceSha(controllerBytes, APP_CONTROLLER_SOURCE, APP_CONTROLLER_SOURCE_SHA256);
  assertExactSourceSha(sqliteBytes, APP_SQLITE_SOURCE, APP_SQLITE_SOURCE_SHA256);
  assertExactSourceSha(appBytes, APP_TEST, APP_TEST_SHA256);
  assertExactSourceSha(supportBytes, APP_TEST_SUPPORT, APP_TEST_SUPPORT_SHA256);
  assertExactSourceSha(typeBytes, APP_TYPE_TEST, APP_TYPE_TEST_SHA256);
  assertExactSourceSha(rootBytes, ROOT_TEST, ROOT_TEST_SHA256);
  return deepFreeze({
    packageRuntimeCases: runtime.names.length,
    packageRuntimeCaseNames: runtime.names,
    transitionCaseIds: runtime.caseIds,
    compilerNegativeCases: compilerNegativeClaims.length,
    compilerNegativeClaims,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
    profileGuards,
    sourceReceipts: {
      controller: {
        path: APP_CONTROLLER_SOURCE,
        bytes: controllerBytes.byteLength,
        sha256: sha256(controllerBytes),
      },
      sqlite: {
        path: APP_SQLITE_SOURCE,
        bytes: sqliteBytes.byteLength,
        sha256: sha256(sqliteBytes),
      },
      runtime: { path: APP_TEST, bytes: appBytes.byteLength, sha256: sha256(appBytes) },
      support: {
        path: APP_TEST_SUPPORT,
        bytes: supportBytes.byteLength,
        sha256: sha256(supportBytes),
      },
      types: { path: APP_TYPE_TEST, bytes: typeBytes.byteLength, sha256: sha256(typeBytes) },
      root: { path: ROOT_TEST, bytes: rootBytes.byteLength, sha256: sha256(rootBytes) },
    },
  });
}

function expectedSuiteReceipt(value) {
  const receipt = copyInertJson(value, "runtimeSuiteReceipt");
  if (
    JSON.stringify(receipt) !==
    JSON.stringify(CONTROL_PLANE_RUNTIME_TRANSITION_RACES_EXPECTED_SUITE_RECEIPT)
  ) {
    fail("RUNTIME_SUITE_MISMATCH", "The exact executable M07-T10 Vitest receipt drifted.");
  }
  return deepFreeze(receipt);
}

function runtimeSuiteErrorData(error, key) {
  if (error === null || typeof error !== "object") return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function runtimeSuiteOutput(value) {
  if (typeof value !== "string") {
    return Object.freeze({ bytes: 0, sha256: sha256(Buffer.from("", "utf8")), text: "" });
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES) {
    return Object.freeze({ bytes, sha256: null, text: "" });
  }
  return Object.freeze({ bytes, sha256: sha256(Buffer.from(value, "utf8")), text: value });
}

function runtimeSuiteFailureReport(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return Object.freeze({
      failedCaseIds: Object.freeze([]),
      failedSuiteCount: null,
      failedTestCount: null,
      observed: false,
    });
  }
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    return Object.freeze({
      failedCaseIds: Object.freeze([]),
      failedSuiteCount: null,
      failedTestCount: null,
      observed: false,
    });
  }
  const failedCaseIds = [];
  if (Array.isArray(report.testResults) && report.testResults.length <= 4) {
    for (const result of report.testResults) {
      if (!Array.isArray(result?.assertionResults) || result.assertionResults.length > 64) continue;
      for (const assertion of result.assertionResults) {
        if (assertion?.status !== "failed" || typeof assertion.title !== "string") continue;
        const index = EXPECTED_RUNTIME_TEST_NAMES.indexOf(assertion.title);
        if (index < 0) continue;
        const caseId = EXPECTED_TRANSITION_CASE_IDS[index] ?? "closed-transition-inventory";
        if (!failedCaseIds.includes(caseId)) failedCaseIds.push(caseId);
      }
    }
  }
  return Object.freeze({
    failedCaseIds: Object.freeze(failedCaseIds),
    failedSuiteCount:
      Number.isSafeInteger(report.numFailedTestSuites) &&
      report.numFailedTestSuites >= 0 &&
      report.numFailedTestSuites <= 4
        ? report.numFailedTestSuites
        : null,
    failedTestCount:
      Number.isSafeInteger(report.numFailedTests) &&
      report.numFailedTests >= 0 &&
      report.numFailedTests <= EXPECTED_RUNTIME_TEST_NAMES.length
        ? report.numFailedTests
        : null,
    observed: true,
  });
}

function runtimeSuiteFailureCategory(errorCode, killed, diagnosticText, report) {
  if (killed === true || errorCode === "ETIMEDOUT") return "TIMEOUT_OR_TERMINATION";
  if (
    errorCode === "ERR_ACCESS_DENIED" ||
    errorCode === "EACCES" ||
    errorCode === "EPERM" ||
    /ERR_ACCESS_DENIED|Access to this API has been restricted|\bEACCES\b|\bEPERM\b|permission denied/iu.test(
      diagnosticText,
    )
  ) {
    return "ACCESS_DENIED";
  }
  if (/Promise resolution is still pending/iu.test(diagnosticText)) return "PENDING_PROMISE";
  if (
    /ERR_DLOPEN_FAILED|better_sqlite3\.node|Could not locate the bindings file|invalid ELF header|wrong ELF class/iu.test(
      diagnosticText,
    )
  ) {
    return "NATIVE_ADDON_LOAD_FAILED";
  }
  if (
    /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|Cannot find (?:module|package)|Failed to resolve entry for package/iu.test(
      diagnosticText,
    )
  ) {
    return "MODULE_RESOLUTION_FAILED";
  }
  if (/\bSQLITE_(?:BUSY|CANTOPEN|CORRUPT|IOERR|LOCKED|NOTADB|READONLY)\b/iu.test(diagnosticText)) {
    return "SQLITE_FAILED";
  }
  if (/ERR_WORKER|Failed to start worker|Worker exited unexpectedly/iu.test(diagnosticText)) {
    return "WORKER_BOOTSTRAP_FAILED";
  }
  if ((report.failedTestCount ?? 0) > 0) return "TEST_ASSERTION_FAILED";
  if ((report.failedSuiteCount ?? 0) > 0) return "TEST_SUITE_FAILED";
  return "CHILD_PROCESS_FAILED";
}

function runtimeSuiteDeniedAuthority(category, diagnosticText) {
  if (category !== "ACCESS_DENIED") return null;
  if (/--allow-fs-read|FileSystemRead/iu.test(diagnosticText)) return "FS_READ";
  if (/--allow-fs-write|FileSystemWrite/iu.test(diagnosticText)) return "FS_WRITE";
  if (/--allow-child-process|ChildProcess/iu.test(diagnosticText)) return "CHILD_PROCESS";
  if (/--allow-worker|WorkerThreads/iu.test(diagnosticText)) return "WORKER_THREADS";
  if (/--allow-addons|Addons/iu.test(diagnosticText)) return "NATIVE_ADDONS";
  return "UNKNOWN";
}

/**
 * Reduces a nested test-process failure to bounded, path-free diagnostics.
 *
 * Reporter text is used only for fixed category matching. Returned identities come exclusively
 * from the code-owned 16-test inventory; arbitrary output is represented by size and digest.
 */
export function summarizeControlPlaneRuntimeTransitionRacesSuiteFailure(error) {
  const stdout = runtimeSuiteOutput(runtimeSuiteErrorData(error, "stdout"));
  const stderr = runtimeSuiteOutput(runtimeSuiteErrorData(error, "stderr"));
  const report = runtimeSuiteFailureReport(stdout.text);
  const errorCode = runtimeSuiteErrorData(error, "code");
  const killed = runtimeSuiteErrorData(error, "killed");
  const diagnosticText = `${stderr.text}\n${stdout.text}`;
  const category = runtimeSuiteFailureCategory(errorCode, killed, diagnosticText, report);
  const signal = runtimeSuiteErrorData(error, "signal");
  return Object.freeze({
    category,
    deniedAuthority: runtimeSuiteDeniedAuthority(category, diagnosticText),
    exitCode: Number.isSafeInteger(errorCode) ? errorCode : null,
    failedCaseIds: report.failedCaseIds,
    failedSuiteCount: report.failedSuiteCount,
    failedTestCount: report.failedTestCount,
    reportObserved: report.observed,
    signal:
      typeof signal === "string" && KNOWN_RUNTIME_SUITE_SIGNALS.includes(signal) ? signal : null,
    stderrBytes: stderr.bytes,
    stderrSha256: stderr.sha256,
    stdoutBytes: stdout.bytes,
    stdoutSha256: stdout.sha256,
  });
}

async function executeControlPlaneRuntimeTransitionRacesVitest() {
  let configDirectory;
  let processError;
  let result;
  const environment = { ...process.env, CI: "1" };
  delete environment.NODE_PATH;
  try {
    configDirectory = await realpath(
      await mkdtemp(path.join(tmpdir(), "desen-m07-t10-vitest-config-")),
    );
    const configPath = path.join(configDirectory, "vitest.config.mjs");
    await writeFile(configPath, VITEST_CONFIG_SOURCE, { flag: "wx", mode: 0o600 });
    result = await execFileAsync(
      process.execPath,
      [
        VITEST_CLI,
        "run",
        "test/runtime-transition-races.test.ts",
        "--reporter=json",
        "--config",
        configPath,
        "--configLoader=native",
        "--no-cache",
        "--no-file-parallelism",
        "--maxWorkers=1",
        "--pool=forks",
      ],
      {
        cwd: path.join(ROOT, APP_DIRECTORY),
        encoding: "utf8",
        env: environment,
        maxBuffer: MAX_RUNTIME_SUITE_DIAGNOSTIC_BYTES,
        timeout: 240_000,
      },
    );
  } catch (error) {
    processError = error;
  } finally {
    if (configDirectory !== undefined) {
      try {
        await rm(configDirectory, { force: false, recursive: true });
      } catch (error) {
        processError ??= error;
      }
    }
  }
  if (processError !== undefined) throw processError;
  return result;
}

export async function runControlPlaneRuntimeTransitionRacesSuite() {
  let stdout;
  try {
    ({ stdout } = await executeControlPlaneRuntimeTransitionRacesVitest());
  } catch (error) {
    fail(
      "RUNTIME_SUITE_FAILED",
      "The focused M07-T10 Vitest process did not pass.",
      summarizeControlPlaneRuntimeTransitionRacesSuiteFailure(error),
    );
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T10 Vitest receipt was not valid JSON.");
  }
  if (
    report?.success !== true ||
    report.numTotalTests !== EXPECTED_RUNTIME_TEST_NAMES.length ||
    report.numPassedTests !== EXPECTED_RUNTIME_TEST_NAMES.length ||
    !Array.isArray(report.testResults) ||
    report.testResults.length !== 1 ||
    !Array.isArray(report.testResults[0]?.assertionResults)
  ) {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T10 Vitest result was incomplete.");
  }
  const tests = report.testResults[0].assertionResults.map((result) => ({
    ancestorTitles: result.ancestorTitles,
    fullName: result.fullName,
    status: result.status,
    title: result.title,
  }));
  return expectedSuiteReceipt({
    suiteName: APP_SUITE_NAME,
    caseIds: EXPECTED_TRANSITION_CASE_IDS,
    tests,
  });
}

function findTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) findTraceRows(child, found);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  if (
    typeof value.id === "string" &&
    (value.owners?.includes?.("M07-T10") || value.tests?.includes?.("M07-T10"))
  ) {
    found.push(value);
  }
  for (const child of Object.values(value)) findTraceRows(child, found);
  return found;
}

async function traceProjection(overrides) {
  const bytes = await workspaceBytes(TRACEABILITY, overrides);
  const authority = parseJsonBytes(bytes, TRACEABILITY, "TRACE_DRIFT");
  const rows = findTraceRows(authority);
  if (rows.length !== EXPECTED_TRACE_ROWS.length) {
    fail("TRACE_DRIFT", "The exact M07-T10 trace-row cardinality drifted.");
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (byId.size !== rows.length) fail("TRACE_DRIFT", "An M07-T10 trace identity is duplicated.");
  const projection = [];
  for (const expected of EXPECTED_TRACE_ROWS) {
    const row = byId.get(expected.id);
    if (
      row === undefined ||
      JSON.stringify(row.owners) !== JSON.stringify(expected.owners) ||
      JSON.stringify(row.tests) !== JSON.stringify(expected.tests)
    ) {
      fail("TRACE_DRIFT", `The exact ${expected.id} M07-T10 assignment drifted.`);
    }
    projection.push(copyInertJson(row, `trace row ${expected.id}`));
  }
  return deepFreeze(projection);
}

function exactTupleCount(source, relativePath, expectedTuple) {
  const sourceFile = parseTypescript(source, relativePath, "REGISTRATION_DRIFT");
  let count = 0;
  const visit = (node) => {
    if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length === expectedTuple.length &&
      node.elements.every(
        (element, index) => ts.isStringLiteral(element) && element.text === expectedTuple[index],
      )
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (count !== 1) fail("REGISTRATION_DRIFT", `${relativePath} lacks one exact proof tuple.`);
}

async function registrationProjection(overrides) {
  const [rootPackageBytes, appPackageBytes, ciBytes, inventoryBytes, sharedStateBytes] =
    await Promise.all([
      workspaceBytes(ROOT_PACKAGE, overrides),
      workspaceBytes(APP_PACKAGE, overrides),
      workspaceBytes(CI_SOURCE, overrides),
      workspaceBytes(CI_INVENTORY, overrides),
      workspaceBytes(SHARED_STATE_AUTHORITY, overrides),
    ]);
  // Semantic projections are executed from the live modules below. Bind every captured CI byte
  // source to that reviewed executable generation first so an override cannot mix fake receipts
  // with live behavior and manufacture internally inconsistent evidence.
  for (const [relativePath, bytes] of [
    [CI_SOURCE, ciBytes],
    [CI_INVENTORY, inventoryBytes],
    [SHARED_STATE_AUTHORITY, sharedStateBytes],
  ]) {
    assertExactSourceSha(
      bytes,
      relativePath,
      EXPECTED_REGISTRATION_AUTHORITY_SHA256[relativePath],
      "REGISTRATION_DRIFT",
    );
  }
  const capturedRegistrationBytes = new Map([
    [CI_SOURCE, ciBytes],
    [CI_INVENTORY, inventoryBytes],
    [SHARED_STATE_AUTHORITY, sharedStateBytes],
  ]);
  for (const [relativePath, capturedBytes] of capturedRegistrationBytes) {
    assertSameAuthorityBytes(
      capturedBytes,
      await safeReadAbsolute(path.join(ROOT, relativePath)),
      relativePath,
      "REGISTRATION_DRIFT",
      "pre-import",
    );
  }
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE, "REGISTRATION_DRIFT");
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE, "REGISTRATION_DRIFT");
  if (
    rootPackage.scripts?.[`generate:${PROOF_ID}`] !== ROOT_SCRIPT_COMMANDS.generate ||
    rootPackage.scripts?.[`verify:${PROOF_ID}`] !== ROOT_SCRIPT_COMMANDS.verify ||
    rootPackage.scripts?.[`test:${PROOF_ID}`] !== ROOT_SCRIPT_COMMANDS.test ||
    appPackage.scripts?.["test:runtime-transition-races"] !==
      "vitest run test/runtime-transition-races.test.ts"
  ) {
    fail("REGISTRATION_DRIFT", "The exact package-script registration drifted.");
  }
  const tuple = [PROOF_ID, VERIFIER, ROOT_TEST];
  exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_SOURCE, tuple);
  exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_INVENTORY, tuple);

  let workloadInventory;
  let sharedPair;
  try {
    const [inventoryModule, sharedModule] = await Promise.all([
      import(
        `${pathToFileURL(path.join(ROOT, CI_INVENTORY)).href}?m07-t10-proof=${sha256(inventoryBytes)}`
      ),
      import(
        `${pathToFileURL(path.join(ROOT, SHARED_STATE_AUTHORITY)).href}?m07-t10-proof=${sha256(sharedStateBytes)}`
      ),
    ]);
    workloadInventory = inventoryModule.createExhaustiveWorkloadInventory();
    sharedPair = sharedModule.classifyProofPairState(PROOF_ID);
  } catch {
    fail("REGISTRATION_DRIFT", "Executable CI or shared-state registration could not be loaded.");
  }
  for (const [relativePath, capturedBytes] of capturedRegistrationBytes) {
    assertSameAuthorityBytes(
      capturedBytes,
      await safeReadAbsolute(path.join(ROOT, relativePath)),
      relativePath,
      "REGISTRATION_DRIFT",
      "post-import",
    );
  }
  const proofUnits = workloadInventory.proofUnits.filter(({ id }) => id === PROOF_ID);
  if (
    proofUnits.length !== 1 ||
    proofUnits[0].verifierNodeId !== `verify-${PROOF_ID}` ||
    proofUnits[0].rootTestNodeId !== `test-${PROOF_ID}`
  ) {
    fail("REGISTRATION_DRIFT", "The exhaustive workload inventory proof unit drifted.");
  }
  const expectedSharedPair = {
    proofId: PROOF_ID,
    barrier: false,
    verifier: {
      schemaVersion: 2,
      stepId: `verify-${PROOF_ID}`,
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: `verify-${PROOF_ID}`,
      ports: [],
      childProcessPolicy: "VERIFIER_RUNTIME_PROBE",
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_TRANSITION_RACES_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
    rootTest: {
      schemaVersion: 2,
      stepId: `test-${PROOF_ID}`,
      executionClass: "PROOF_OS_TEMP_ISOLATED",
      workspaceReads: ["."],
      workspaceWrites: [],
      tempPolicy: "RUNNER_SCOPED_OS",
      tempKey: `test-${PROOF_ID}`,
      ports: [],
      childProcessPolicy: "NODE_TEST_HARNESS",
      nativeAddonPolicy: "NONE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  };
  if (JSON.stringify(sharedPair) !== JSON.stringify(expectedSharedPair)) {
    fail("REGISTRATION_DRIFT", "The exact shared-state proof-pair authority drifted.");
  }
  return deepFreeze({
    appRuntimeScript: appPackage.scripts["test:runtime-transition-races"],
    rootScripts: { ...ROOT_SCRIPT_COMMANDS },
    ciTuple: tuple,
    workloadProofUnit: proofUnits[0],
    sharedState: copyInertJson(sharedPair, "sharedState"),
  });
}

async function publicBoundaryAndDistributionProjection(overrides) {
  const [packageBytes, indexBytes, distIndexBytes, distTypesBytes] = await Promise.all([
    workspaceBytes(APP_PACKAGE, overrides),
    workspaceBytes(APP_INDEX, overrides),
    safeReadAbsolute(path.join(ROOT, DIST_INDEX)),
    safeReadAbsolute(path.join(ROOT, DIST_TYPES)),
  ]);
  const packageManifest = parseJsonBytes(packageBytes, APP_PACKAGE, "PUBLIC_EXPORT_DRIFT");
  const publicPackageShape = {
    name: packageManifest.name,
    version: packageManifest.version,
    private: packageManifest.private,
    type: packageManifest.type,
    sideEffects: packageManifest.sideEffects,
    main: packageManifest.main,
    types: packageManifest.types,
    exports: packageManifest.exports,
    files: packageManifest.files,
  };
  const expectedPublicPackageShape = {
    name: "@desen/control-plane-api",
    version: "0.0.0",
    private: true,
    type: "module",
    sideEffects: false,
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    files: ["dist", "README.md"],
  };
  if (JSON.stringify(publicPackageShape) !== JSON.stringify(expectedPublicPackageShape)) {
    fail("PUBLIC_EXPORT_DRIFT", "The exact package public-entry boundary drifted.");
  }
  const exports = publicExportInventory(fatalText(indexBytes, APP_INDEX));
  let publicModuleKeys;
  try {
    const module = await import(
      `${pathToFileURL(path.join(ROOT, DIST_INDEX)).href}?m07-t10-proof=${sha256(distIndexBytes)}`
    );
    publicModuleKeys = Object.keys(module).sort(compareText);
  } catch {
    fail("PUBLIC_EXPORT_DRIFT", "The built public control-plane module could not be loaded.");
  }
  if (JSON.stringify(publicModuleKeys) !== JSON.stringify(EXPECTED_RUNTIME_PUBLIC_MODULE_KEYS)) {
    fail("PUBLIC_EXPORT_DRIFT", "The exact built runtime public-module surface drifted.");
  }
  const [distIndexAfter, distTypesAfter] = await Promise.all([
    safeReadAbsolute(path.join(ROOT, DIST_INDEX)),
    safeReadAbsolute(path.join(ROOT, DIST_TYPES)),
  ]);
  assertSameAuthorityBytes(
    distIndexBytes,
    distIndexAfter,
    DIST_INDEX,
    "PUBLIC_EXPORT_DRIFT",
    "runtime-import",
  );
  assertSameAuthorityBytes(
    distTypesBytes,
    distTypesAfter,
    DIST_TYPES,
    "PUBLIC_EXPORT_DRIFT",
    "runtime-import",
  );
  return deepFreeze({
    publicBoundary: {
      packageShape: copyInertJson(publicPackageShape, "publicPackageShape"),
      exports,
      runtimeModuleKeys: publicModuleKeys,
      noRaceOrSqliteSurfaceAdded: !exports.entries.some(({ exported }) =>
        /race|sqlite|repository|journal|profile/iu.test(exported),
      ),
    },
    distribution: [
      { path: DIST_INDEX, bytes: distIndexBytes.byteLength, sha256: sha256(distIndexBytes) },
      { path: DIST_TYPES, bytes: distTypesBytes.byteLength, sha256: sha256(distTypesBytes) },
    ].sort((left, right) => compareText(left.path, right.path)),
  });
}

export async function buildControlPlaneRuntimeTransitionRacesEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeSuiteReceipt", "trackedFileBytes"]),
    "build options",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_TRANSITION_RACES_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    TRACKED_FILE_OVERRIDE_PATHS,
    "trackedFileBytes",
  );
  const runtimeSuiteReceipt = expectedSuiteReceipt(
    captured.runtimeSuiteReceipt === undefined
      ? await runControlPlaneRuntimeTransitionRacesSuite()
      : captured.runtimeSuiteReceipt,
  );
  const [prerequisites, trackedFiles, boundaryAndDistribution, registrations, tests, traceRows] =
    await Promise.all([
      prerequisiteReceipts(prerequisiteBytes),
      fileReceipts(TRACKED_TASK_FILES, trackedFileBytes),
      publicBoundaryAndDistributionProjection(trackedFileBytes),
      registrationProjection(trackedFileBytes),
      testProjection(trackedFileBytes),
      traceProjection(trackedFileBytes),
    ]);
  const { distribution, publicBoundary } = boundaryAndDistribution;

  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: PROOF_ID,
    profile: "desen.control-plane.runtime-transition-races-proof.v1",
    task: "M07-T10",
    result: "PASS",
    summary:
      "The Web control plane proves a closed A-to-invalid-B-to-valid-C matrix, deterministic same- and different-candidate CAS races, both recovery/activation interleavings, exact restart reconstruction, and full SQLite profile reauthentication at every authority-bearing transaction boundary without adding a public race or persistence API.",
    prerequisites,
    claims: {
      transitionMatrix: {
        closed: true,
        duplicateFree: true,
        caseCount: EXPECTED_TRANSITION_CASE_IDS.length,
        caseIds: EXPECTED_TRANSITION_CASE_IDS,
        executableTestCount: runtimeSuiteReceipt.tests.length,
        invalidCandidateStages: [
          "bundle-protocol",
          "bundle-revision",
          "source-digest",
          "package-resolution",
          "package-digest",
          "surface-capability-references",
          "activation-limits",
          "execution-contracts",
        ],
      },
      orderedSequenceInvariant: {
        validABecomesDurableAuthority: true,
        invalidBNeverBecomesMemoryAuthority: true,
        invalidBNeverChangesDurableAuthority: true,
        invalidBDoesNotPoisonController: true,
        validCBecomesActiveWithPreviousGoodA: true,
        restartPublishesOnlyExactDurableCOverA: true,
      },
      concurrencyInvariant: {
        sameCandidateHasOneDurableWinner: true,
        differentCandidatesHaveOneDurableWinner: true,
        loserReturnsExactCurrentRecord: true,
        generationFencePreventsStaleCommit: true,
        losingStagingAuthorityIsConsumed: true,
        retryRequiresFreshStagingAuthority: true,
        recoveryBeforeActivationCannotKeepStaleA: true,
        activationBeforeRecoveryCannotPublishStaleA: true,
        finalDurableWinnerIsRestartAuthority: true,
      },
      storageProfileDecision: {
        databaseJournalMode: "WAL",
        externalLiveTransitionObservedPolicy: "LOCKED_OR_REJECTED",
        completeProfileReauthenticatedInsideReadTransaction: true,
        completeProfileReauthenticatedInsideWriterTransactionBeforeDml: true,
        completeProfileReauthenticatedAfterCommitBeforePublication: true,
        profileDriftFailsClosed: true,
        profileDriftIsNeverSilentlyRepaired: true,
        implementation: tests.profileGuards,
      },
      publicBoundary,
      registrations,
      traceRows,
      coverageTruth: {
        normativeN004: "TESTED",
        normativeN038: "TESTED",
        normativeN041: "PLANNED",
        proofMatrixP12: "NOT_PROVEN",
        gateG07: "NOT_STARTED",
      },
    },
    runtimeSuiteReceipt,
    tests,
    trackedFiles,
    distribution,
    nonclaims: [
      "M07-T11 still owns mutable-channel consumption and notification by the separately built reference host.",
      "P-12 remains NOT_PROVEN until M07-T11 and M10-T07 close separately built host and product-level restart behavior.",
      "N-041 remains PLANNED until the final measured whole-system finite limit profile is complete.",
      "G07 remains NOT_STARTED until M07-T11 and the I07-04 historical-reader cleanup complete.",
      "This task does not treat a mutable channel as activation authority and does not prove reference-host channel consumption.",
      "No public race hook, transaction callback, repository, SQLite handle, profile setter, or alternate activation API was added.",
      "The application-owned local root remains trusted; this proof makes no tamper-proof, hostile-administrator, or independently anchored anti-rollback claim.",
      "SQLite is the first Web persistence adapter only; future Android and iOS repositories must preserve the same observable atomicity, fencing, and recovery invariants.",
    ],
    reproduction: [
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-transition-races",
      "node scripts/generate-control-plane-runtime-transition-races-proof.mjs",
      "node scripts/verify-control-plane-runtime-transition-races.mjs",
      "node --test tests/control-plane-runtime-transition-races.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), { parser: "json", printWidth: 100 });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeSuiteReceipt,
  });
}

function captureOptionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("INVALID_OPTIONS", `${label} must be a nonempty primitive path string.`);
  }
  return path.resolve(value);
}

function captureProofDocument(value) {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES
  ) {
    fail("INVALID_OPTIONS", "proofDocument must be one bounded primitive string.");
  }
  return value;
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactLine = `Artifact: \`${ARTIFACT}\``;
  const receiptLine = `Final receipt: \`sha256:${artifactSha256}\``;
  return (
    document.split(artifactLine).length - 1 === 1 &&
    document.split(receiptLine).length - 1 === 1 &&
    document.match(new RegExp(ARTIFACT.replaceAll(".", "\\."), "gu"))?.length === 1 &&
    document.match(/Final receipt: `sha256:[0-9a-f]{64}`/gu)?.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

export async function verifyControlPlaneRuntimeTransitionRacesEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set([
      "artifactBytes",
      "artifactPath",
      "prerequisiteBytes",
      "proofDocument",
      "proofDocumentPath",
      "runtimeSuiteReceipt",
      "trackedFileBytes",
    ]),
    "verify options",
  );
  const built = await buildControlPlaneRuntimeTransitionRacesEvidence({
    ...(captured.prerequisiteBytes === undefined
      ? {}
      : { prerequisiteBytes: captured.prerequisiteBytes }),
    ...(captured.runtimeSuiteReceipt === undefined
      ? {}
      : { runtimeSuiteReceipt: captured.runtimeSuiteReceipt }),
    ...(captured.trackedFileBytes === undefined
      ? {}
      : { trackedFileBytes: captured.trackedFileBytes }),
  });
  const artifactPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  const proofDocumentPath = captureOptionalPath(captured.proofDocumentPath, "proofDocumentPath");
  const artifactBytes =
    captured.artifactBytes === undefined
      ? await safeReadAbsolute(
          artifactPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_TRANSITION_RACES_ARTIFACT_PATH,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!Buffer.from(artifactBytes).equals(Buffer.from(built.artifactBytes))) {
    fail("ARTIFACT_DRIFT", "The committed M07-T10 transition-race artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT)),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T10 artifact pin.");
  }
  return Object.freeze({
    task: "M07-T10",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    transitionCases: built.artifact.claims.transitionMatrix.caseCount,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compilerNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    traceRows: built.artifact.claims.traceRows.length,
  });
}

export async function writeControlPlaneRuntimeTransitionRacesEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename", "runtimeSuiteReceipt"]),
    "write options",
  );
  const artifactPath =
    captureOptionalPath(captured.artifactPath, "artifactPath") ??
    DEFAULT_CONTROL_PLANE_RUNTIME_TRANSITION_RACES_ARTIFACT_PATH;
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  const built = await buildControlPlaneRuntimeTransitionRacesEvidence({
    ...(captured.runtimeSuiteReceipt === undefined
      ? {}
      : { runtimeSuiteReceipt: captured.runtimeSuiteReceipt }),
  });
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T10 artifact could not be committed atomically.");
  }
  return Object.freeze({ artifactPath, artifactSha256: built.artifactSha256 });
}
