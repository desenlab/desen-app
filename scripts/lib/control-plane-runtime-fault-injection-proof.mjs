import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-fault-injection.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-FAULT-INJECTION.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_TEST = `${APP_DIRECTORY}/test/runtime-fault-injection.test.ts`;
const APP_TEST_SUPPORT = `${APP_DIRECTORY}/test/runtime-fault-injection-support.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-fault-injection.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-fault-injection-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-fault-injection.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-fault-injection-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-fault-injection.test.mjs";
const DIST_INDEX = `${APP_DIRECTORY}/dist/index.js`;
const DIST_TYPES = `${APP_DIRECTORY}/dist/index.d.ts`;

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const MAX_INERT_JSON_NODES = 200_000;
const MAX_INERT_JSON_DEPTH = 512;
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

const PROOF_ID = "control-plane-runtime-fault-injection";
const APP_SUITE_NAME = "M07-T09 bounded activation fault matrix";
const APP_TEST_SHA256 = "c654b23a18d1386b287073796d5f6a887dead9fd2c891efdd8aa2e3d47047f67";
const APP_TEST_SUPPORT_SHA256 = "4b9d00a34bc6fe6fa0c31e7f32e8f2fa835da9c01745e723a77a3f9bcd5cffc5";
const APP_TYPE_TEST_SHA256 = "70ba16f2896f97a8957d8e47ad07f76536e42dcacfe23d8afe34e05d2f726212";
const ROOT_TEST_SHA256 = "2ca667b80b65557dc0cbbf60b09d503ccb7aee14c36f4743c6798e3e7916a673";
const EXPECTED_PUBLIC_EXPORT_INVENTORY_SHA256 =
  "c3daff8c4df98edc5beaa3f64cb8805613ed5cb29b55aed771346ba3b8949e43";

const EXPECTED_FAULT_CASE_IDS = Object.freeze([
  "channel-invalid-discovery",
  "immutable-fetch-missing",
  "integrity-bundle-size",
  "integrity-bundle-json",
  "integrity-unsupported-protocol",
  "integrity-revision-mismatch",
  "integrity-source-digest-mismatch",
  "package-resolution-missing",
  "package-digest-mismatch",
  "reference-capability-unknown",
  "reference-depth-limit",
  "staging-execution-contract",
  "commit-definite-precommit",
  "commit-postcommit-indeterminate",
  "recovery-package-authority",
  "recovery-reference-preflight",
  "recovery-runtime-staging",
  "recovery-previous-good-reclosure",
  "recovery-final-record-drift",
]);

const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "[channel-invalid-discovery] keeps an invalid channel candidate outside active authority",
  "[immutable-fetch-missing] stops a disappeared channel target before integrity",
  "[integrity-bundle-size] rejects the raw byte ceiling before parsing",
  "[integrity-bundle-json] rejects malformed immutable bytes before protocol checks",
  "[integrity-unsupported-protocol] rejects forward-version guessing before revision work",
  "[integrity-revision-mismatch] rejects valid Bundle bytes under a substituted key",
  "[integrity-source-digest-mismatch] rejects independently supplied Source drift",
  "[package-resolution-missing] preserves A when the exact package tuple is unavailable",
  "[package-digest-mismatch] preserves A when installed artifact bytes drift",
  "[reference-capability-unknown] rejects an unknown capability before staging",
  "[reference-depth-limit] rejects depth 65 before runtime indexes",
  "[staging-execution-contract] rejects static contract drift without partial indexes",
  "[commit-definite-precommit] rolls back real SQLite and keeps A current",
  "[commit-postcommit-indeterminate] recovers only the complete durable winner",
  "[recovery-package-authority] rejects swapped durable roles without writing",
  "[recovery-reference-preflight] rejects an externally selected invalid reference lineage",
  "[recovery-runtime-staging] rejects an externally selected invalid execution lineage",
  "[recovery-previous-good-reclosure] publishes neither role when fallback bytes disappear",
  "[recovery-final-record-drift] lets the final durable observation win",
  "keeps the exact fault-case inventory closed and duplicate-free",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node scripts/generate-control-plane-runtime-fault-injection-proof.mjs",
  verify:
    "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node scripts/verify-control-plane-runtime-fault-injection.mjs",
  test: "pnpm verify:control-plane-runtime-recovery && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-fault-injection && node --test tests/control-plane-runtime-fault-injection.test.mjs",
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
  Object.freeze({ id: "PIPE-006", owners: ["M07-T03", "M07-T06"], tests: ["M07-T09"] }),
  Object.freeze({
    id: "PIPE-007",
    owners: ["M07-T04", "M07-T07"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({ id: "PIPE-009", owners: ["M07-T01", "M07-T11"], tests: ["M07-T09"] }),
  Object.freeze({ id: "PIPE-010", owners: ["M07-T02"], tests: ["M07-T09"] }),
  Object.freeze({
    id: "PIPE-011",
    owners: ["M07-T02"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({
    id: "PIPE-012",
    owners: ["M07-T03"],
    tests: ["M07-T09", "M10-T07"],
  }),
  Object.freeze({
    id: "PIPE-013",
    owners: ["M07-T03"],
    tests: ["M07-T09", "M10-T07"],
  }),
  Object.freeze({ id: "PIPE-014", owners: ["M07-T04"], tests: ["M07-T09"] }),
  Object.freeze({ id: "PIPE-015", owners: ["M07-T06"], tests: ["M07-T09"] }),
  Object.freeze({
    id: "PIPE-016",
    owners: ["M07-T07"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({
    id: "R-008",
    owners: ["M07-T04", "M07-T07"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({
    id: "R-016",
    owners: ["M02-T06", "M02-T07"],
    tests: ["M02-T13", "M07-T09"],
  }),
  Object.freeze({
    id: "R-031",
    owners: ["M06-T09", "M07-T02"],
    tests: ["M07-T09", "M10-T07"],
  }),
  Object.freeze({
    id: "R-102",
    owners: ["M07-T07", "M07-T09"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({
    id: "R-126",
    owners: ["M07-T06", "M07-T07"],
    tests: ["M07-T09", "M07-T10"],
  }),
  Object.freeze({
    id: "R-127",
    owners: ["M07-T03", "M07-T06", "M12-T03"],
    tests: ["M07-T09", "M12-T03"],
  }),
  Object.freeze({
    id: "R-138",
    owners: ["M02-T06", "M07-T02"],
    tests: ["M02-T13", "M07-T09"],
  }),
  Object.freeze({ id: "A-008", owners: ["M07-T07"], tests: ["M07-T09", "M07-T10"] }),
  Object.freeze({
    id: "D-030",
    owners: ["M02-T05", "M02-T04", "M07-T02"],
    tests: ["M02-T04", "M07-T09"],
  }),
  Object.freeze({
    id: "D-031",
    owners: ["M02-T05", "M06-T08", "M07-T02"],
    tests: ["M06-T10", "M07-T09"],
  }),
  Object.freeze({
    id: "D-034",
    owners: ["M02-T05", "M02-T06", "M07-T02"],
    tests: ["M02-T13", "M07-T09"],
  }),
  Object.freeze({
    id: "D-035",
    owners: ["M02-T05", "M07-T02", "M07-T04"],
    tests: ["M07-T09", "M12-T05"],
  }),
]);

const PIPELINE_SOURCE_FILES = Object.freeze([
  `${APP_DIRECTORY}/src/strict-json-internal.ts`,
  `${APP_DIRECTORY}/src/bundle-store-contract.ts`,
  `${APP_DIRECTORY}/src/bundle-store-internal.ts`,
  `${APP_DIRECTORY}/src/bundle-store.ts`,
  `${APP_DIRECTORY}/src/bundle-verification-contract.ts`,
  `${APP_DIRECTORY}/src/bundle-verification-internal.ts`,
  `${APP_DIRECTORY}/src/bundle-verification-schema-guard.ts`,
  `${APP_DIRECTORY}/src/bundle-verification-standalone-runtime.ts`,
  `${APP_DIRECTORY}/src/bundle-verification.ts`,
  `${APP_DIRECTORY}/src/generated/0.1.0/bundle-verification-guards.ts`,
  `${APP_DIRECTORY}/src/generated/0.1.0/package-preflight-catalog-guard.ts`,
  `${APP_DIRECTORY}/src/package-preflight-contract.ts`,
  `${APP_DIRECTORY}/src/package-preflight-internal.ts`,
  `${APP_DIRECTORY}/src/package-preflight-schema-guard.ts`,
  `${APP_DIRECTORY}/src/package-preflight-web-react.ts`,
  `${APP_DIRECTORY}/src/package-preflight.ts`,
  `${APP_DIRECTORY}/src/reference-preflight-contract.ts`,
  `${APP_DIRECTORY}/src/reference-preflight-internal.ts`,
  `${APP_DIRECTORY}/src/reference-preflight.ts`,
  `${APP_DIRECTORY}/src/runtime-staging-contract.ts`,
  `${APP_DIRECTORY}/src/runtime-staging-internal.ts`,
  `${APP_DIRECTORY}/src/runtime-staging.ts`,
  `${APP_DIRECTORY}/src/runtime-activation-contract.ts`,
  `${APP_DIRECTORY}/src/runtime-activation-internal.ts`,
  `${APP_DIRECTORY}/src/runtime-activation-repository-internal.ts`,
  `${APP_DIRECTORY}/src/runtime-activation-sqlite-internal.ts`,
  `${APP_DIRECTORY}/src/runtime-activation.ts`,
  `${APP_DIRECTORY}/src/runtime-recovery-internal.ts`,
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
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
  ...PIPELINE_SOURCE_FILES,
]);

export const CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS = Object.freeze([
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
]);

export const CONTROL_PLANE_RUNTIME_FAULT_INJECTION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact M07-T09 boundary-fault artifact from the executable suite",
  "[determinism] two independent evidence builds are byte-identical",
  "[prerequisites] rejects drift in every immutable M07-T01 through M07-T08 artifact",
  "[runtime] rejects one changed executable fault-suite receipt field",
  "[implementation] rejects public-export growth and removal of one fault boundary",
  "[traceability] rejects every M07-T09 assignment mutation and one extra assignment",
  "[artifact] verifies exact bytes and rejects one changed byte",
  "[writer] atomically writes deterministic evidence and preserves the destination on failure",
  "[options] rejects unknown, accessor, proxy, and shared-memory inputs",
  "[filesystem] rejects artifact and proof symlinks plus invalid UTF-8 proof authority",
  "[immutability] freezes the full graph and preserves M07-T10, M07-T11, and G07 nonclaims",
]);

export const DEFAULT_CONTROL_PLANE_RUNTIME_FAULT_INJECTION_ARTIFACT_PATH = path.join(
  ROOT,
  ARTIFACT,
);

export class ControlPlaneRuntimeFaultInjectionEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeFaultInjectionEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeFaultInjectionEvidenceError(code, message, details);
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
    if (error instanceof ControlPlaneRuntimeFaultInjectionEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured safely.`);
  }
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }, depth = 0) {
  budget.nodes += 1;
  if (depth > MAX_INERT_JSON_DEPTH || budget.nodes > MAX_INERT_JSON_NODES) {
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
    const after = await lstat(resolved, { bigint: true });
    await canonicalParent(requestedParent, parentBefore);
    if (
      total !== expectedBytes ||
      total > maximumBytes ||
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      !sameAuthorityIdentity(after, opened)
    ) {
      fail("UNSAFE_AUTHORITY", "A proof authority changed while reading.");
    }
    return Uint8Array.from(target.subarray(0, total));
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeFaultInjectionEvidenceError) throw error;
    fail("AUTHORITY_IO_FAILURE", "A proof authority cannot be read safely.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function workspaceBytes(relativePath, overrides) {
  return overrides[relativePath] ?? safeReadAbsolute(path.join(ROOT, relativePath));
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
    if (error instanceof ControlPlaneRuntimeFaultInjectionEvidenceError) throw error;
    fail(code, `${label} is not valid JSON.`);
  }
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseTypescript(source, relativePath, code = "SOURCE_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0)
    fail(code, `${relativePath} is not valid TypeScript.`);
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

export const CONTROL_PLANE_RUNTIME_FAULT_INJECTION_EXPECTED_SUITE_RECEIPT = deepFreeze({
  suiteName: APP_SUITE_NAME,
  caseIds: [...EXPECTED_FAULT_CASE_IDS],
  tests: EXPECTED_RUNTIME_TEST_NAMES.map((title) => ({
    ancestorTitles: [APP_SUITE_NAME],
    fullName: `${APP_SUITE_NAME} ${title}`,
    status: "passed",
    title,
  })),
});

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS) {
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
    exactTopLevelConst(sourceFile, "M07_T09_FAULT_CASE_IDS"),
    "M07_T09_FAULT_CASE_IDS",
  );
  if (JSON.stringify(caseIds) !== JSON.stringify(EXPECTED_FAULT_CASE_IDS)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact 19-case M07-T09 boundary inventory drifted.");
  }
  const describes = allCalls(sourceFile, "describe");
  if (
    describes.length !== 1 ||
    describes[0].arguments.length < 2 ||
    !ts.isStringLiteral(describes[0].arguments[0]) ||
    describes[0].arguments[0].text !== APP_SUITE_NAME
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact focused M07-T09 describe authority drifted.");
  }
  const names = allCalls(sourceFile, "it").map((call) => {
    if (call.arguments.length < 2 || !ts.isStringLiteral(call.arguments[0])) {
      fail("TEST_AUTHORITY_DRIFT", "Every focused M07-T09 test must have one literal title.");
    }
    return call.arguments[0].text;
  });
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES)) {
    fail("TEST_AUTHORITY_DRIFT", "The exact 20-test M07-T09 executable inventory drifted.");
  }
  return deepFreeze({ suiteName: APP_SUITE_NAME, caseIds, names });
}

function compilerNegativeInventory(source) {
  const sourceFile = parseTypescript(source, APP_TYPE_TEST, "TEST_AUTHORITY_DRIFT");
  const directives = [];
  const pattern = /@ts-expect-error\s+([^\r\n]+)/gu;
  for (const match of source.matchAll(pattern)) directives.push(match[1].trim());
  if (directives.length !== 10) {
    fail("TEST_AUTHORITY_DRIFT", "The M07-T09 compiler-negative inventory must contain 10 cases.");
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
      fail("TEST_AUTHORITY_DRIFT", "Every root proof test must have one literal title.");
    }
    names.push(call.arguments[0].text);
  }
  if (
    allCalls(sourceFile, "test").length !== names.length ||
    JSON.stringify(names) !== JSON.stringify(CONTROL_PLANE_RUNTIME_FAULT_INJECTION_ROOT_TEST_NAMES)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact direct root mutation-test inventory drifted.");
  }
  return names;
}

function assertExactSourceSha(bytes, relativePath, expectedSha256) {
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedSha256) {
    fail("TEST_AUTHORITY_DRIFT", `${relativePath} exact executable authority drifted.`, {
      path: relativePath,
      expectedSha256,
      actualSha256,
    });
  }
}

async function testProjection(overrides) {
  const [appBytes, supportBytes, typeBytes, rootBytes] = await Promise.all([
    workspaceBytes(APP_TEST, overrides),
    workspaceBytes(APP_TEST_SUPPORT, overrides),
    workspaceBytes(APP_TYPE_TEST, overrides),
    workspaceBytes(ROOT_TEST, overrides),
  ]);
  assertExactSourceSha(appBytes, APP_TEST, APP_TEST_SHA256);
  assertExactSourceSha(supportBytes, APP_TEST_SUPPORT, APP_TEST_SUPPORT_SHA256);
  assertExactSourceSha(typeBytes, APP_TYPE_TEST, APP_TYPE_TEST_SHA256);
  assertExactSourceSha(rootBytes, ROOT_TEST, ROOT_TEST_SHA256);
  const runtime = runtimeTestInventory(fatalText(appBytes, APP_TEST));
  const compilerNegativeClaims = compilerNegativeInventory(fatalText(typeBytes, APP_TYPE_TEST));
  const rootNames = rootTestInventory(fatalText(rootBytes, ROOT_TEST));
  return deepFreeze({
    packageRuntimeCases: runtime.names.length,
    packageRuntimeCaseNames: runtime.names,
    faultCaseIds: runtime.caseIds,
    compilerNegativeCases: compilerNegativeClaims.length,
    compilerNegativeClaims,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
    sourceReceipts: {
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
    JSON.stringify(CONTROL_PLANE_RUNTIME_FAULT_INJECTION_EXPECTED_SUITE_RECEIPT)
  ) {
    fail("RUNTIME_SUITE_MISMATCH", "The exact executable M07-T09 Vitest receipt drifted.");
  }
  return deepFreeze(receipt);
}

export async function runControlPlaneRuntimeFaultInjectionSuite() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "pnpm",
      [
        "--filter",
        "@desen/control-plane-api",
        "exec",
        "vitest",
        "run",
        "test/runtime-fault-injection.test.ts",
        "--reporter=json",
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, CI: "1" },
        maxBuffer: 8 * 1_024 * 1_024,
        timeout: 180_000,
      },
    ));
  } catch {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T09 Vitest process did not pass.");
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T09 Vitest receipt was not valid JSON.");
  }
  if (
    report.success !== true ||
    report.numTotalTests !== EXPECTED_RUNTIME_TEST_NAMES.length ||
    report.numPassedTests !== EXPECTED_RUNTIME_TEST_NAMES.length ||
    !Array.isArray(report.testResults) ||
    report.testResults.length !== 1 ||
    !Array.isArray(report.testResults[0]?.assertionResults)
  ) {
    fail("RUNTIME_SUITE_FAILED", "The focused M07-T09 Vitest result was incomplete.");
  }
  const tests = report.testResults[0].assertionResults.map((result) => ({
    ancestorTitles: result.ancestorTitles,
    fullName: result.fullName,
    status: result.status,
    title: result.title,
  }));
  return expectedSuiteReceipt({
    suiteName: APP_SUITE_NAME,
    caseIds: EXPECTED_FAULT_CASE_IDS,
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
    (value.owners?.includes?.("M07-T09") || value.tests?.includes?.("M07-T09"))
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
    fail("TRACE_DRIFT", "The exact M07-T09 trace-row cardinality drifted.");
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (byId.size !== rows.length) fail("TRACE_DRIFT", "An M07-T09 trace identity is duplicated.");
  const projection = [];
  for (const expected of EXPECTED_TRACE_ROWS) {
    const row = byId.get(expected.id);
    if (
      row === undefined ||
      JSON.stringify(row.owners) !== JSON.stringify(expected.owners) ||
      JSON.stringify(row.tests) !== JSON.stringify(expected.tests)
    ) {
      fail("TRACE_DRIFT", `The exact ${expected.id} M07-T09 assignment drifted.`);
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
  const [rootPackageBytes, appPackageBytes, ciBytes, inventoryBytes] = await Promise.all([
    workspaceBytes(ROOT_PACKAGE, overrides),
    workspaceBytes(APP_PACKAGE, overrides),
    workspaceBytes(CI_SOURCE, overrides),
    workspaceBytes(CI_INVENTORY, overrides),
  ]);
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE, "REGISTRATION_DRIFT");
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE, "REGISTRATION_DRIFT");
  if (
    rootPackage.scripts?.["generate:control-plane-runtime-fault-injection"] !==
      ROOT_SCRIPT_COMMANDS.generate ||
    rootPackage.scripts?.["verify:control-plane-runtime-fault-injection"] !==
      ROOT_SCRIPT_COMMANDS.verify ||
    rootPackage.scripts?.["test:control-plane-runtime-fault-injection"] !==
      ROOT_SCRIPT_COMMANDS.test ||
    appPackage.scripts?.["test:runtime-fault-injection"] !==
      "vitest run test/runtime-fault-injection.test.ts"
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
      import(`${pathToFileURL(path.join(ROOT, CI_INVENTORY)).href}?m07-t09-proof=1`),
      import(`${pathToFileURL(path.join(ROOT, SHARED_STATE_AUTHORITY)).href}?m07-t09-proof=1`),
    ]);
    workloadInventory = inventoryModule.createExhaustiveWorkloadInventory();
    sharedPair = sharedModule.classifyProofPairState(PROOF_ID);
  } catch {
    fail("REGISTRATION_DRIFT", "Executable CI or shared-state registration could not be loaded.");
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
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
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
      nativeAddonPolicy: "CONTROL_PLANE_RUNTIME_FAULT_INJECTION_SQLITE",
      filesystemCompatibilityPolicy: "NONE",
      barrier: false,
    },
  };
  if (JSON.stringify(sharedPair) !== JSON.stringify(expectedSharedPair)) {
    fail("REGISTRATION_DRIFT", "The exact shared-state proof-pair authority drifted.");
  }
  return deepFreeze({
    appRuntimeScript: appPackage.scripts["test:runtime-fault-injection"],
    rootScripts: { ...ROOT_SCRIPT_COMMANDS },
    ciTuple: tuple,
    workloadProofUnit: proofUnits[0],
    sharedState: copyInertJson(sharedPair, "sharedState"),
  });
}

async function publicBoundaryProjection(overrides) {
  const indexBytes = await workspaceBytes(APP_INDEX, overrides);
  const exports = publicExportInventory(fatalText(indexBytes, APP_INDEX));
  let publicModuleKeys;
  try {
    const module = await import(
      `${pathToFileURL(path.join(ROOT, DIST_INDEX)).href}?m07-t09-proof=1`
    );
    publicModuleKeys = Object.keys(module).sort(compareText);
  } catch {
    fail("PUBLIC_EXPORT_DRIFT", "The built public control-plane module could not be loaded.");
  }
  if (JSON.stringify(publicModuleKeys) !== JSON.stringify(EXPECTED_RUNTIME_PUBLIC_MODULE_KEYS)) {
    fail("PUBLIC_EXPORT_DRIFT", "The exact built runtime public-module surface drifted.");
  }
  return deepFreeze({
    exports,
    runtimeModuleKeys: publicModuleKeys,
    noFaultHookExported: !exports.entries.some(({ exported }) => /fault|hook/iu.test(exported)),
  });
}

async function distributionProjection() {
  return fileReceipts([DIST_INDEX, DIST_TYPES], Object.freeze({}));
}

export async function buildControlPlaneRuntimeFaultInjectionEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeSuiteReceipt", "trackedFileBytes"]),
    "build options",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_FAULT_INJECTION_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    TRACKED_TASK_FILES,
    "trackedFileBytes",
  );
  const runtimeSuiteReceipt = expectedSuiteReceipt(
    captured.runtimeSuiteReceipt === undefined
      ? await runControlPlaneRuntimeFaultInjectionSuite()
      : captured.runtimeSuiteReceipt,
  );
  const [
    prerequisites,
    trackedFiles,
    distribution,
    publicBoundary,
    registrations,
    tests,
    traceRows,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    fileReceipts(TRACKED_TASK_FILES, trackedFileBytes),
    distributionProjection(),
    publicBoundaryProjection(trackedFileBytes),
    registrationProjection(trackedFileBytes),
    testProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
  ]);

  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: PROOF_ID,
    profile: "desen.control-plane.runtime-fault-injection-proof.v1",
    task: "M07-T09",
    result: "PASS",
    summary:
      "The Web control plane executes a closed 19-boundary fault matrix across channel discovery, immutable fetch, integrity, package resolution, reference preflight, staging, durable commit, and restart recovery; every rejected precommit candidate leaves the authenticated A record active, while an indeterminate postcommit outcome publishes no candidate until complete recovery authenticates the durable winner.",
    prerequisites,
    claims: {
      boundaryMatrix: {
        closed: true,
        duplicateFree: true,
        caseCount: EXPECTED_FAULT_CASE_IDS.length,
        caseIds: EXPECTED_FAULT_CASE_IDS,
        executableTestCount: runtimeSuiteReceipt.tests.length,
        stages: [
          "channel-discovery",
          "immutable-fetch",
          "integrity",
          "package-resolution",
          "reference-preflight",
          "runtime-staging",
          "durable-commit",
          "restart-recovery",
        ],
      },
      failureInvariant: {
        rejectedPrecommitCandidateNeverActive: true,
        authenticatedBaselineRemainsCurrent: true,
        durableBaselineRemainsUnchanged: true,
        definiteCommitFailureRollsBack: true,
        indeterminateCommitPublishesNoAuthority: true,
        indeterminateCommitRequiresCompleteWinnerRecovery: true,
        failedTwoLineageRecoveryPublishesNeitherRole: true,
        finalDurableObservationWins: true,
      },
      publicBoundary,
      registrations,
      traceRows,
      coverageTruth: {
        normativeN004: "TESTED",
        normativeN038: "PLANNED",
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
      "M07-T10 still owns the complete A to invalid B to valid C sequence, same- and different-candidate races, concurrent activation, explicit journal-mode decision, and restart race matrix.",
      "M07-T11 still owns mutable-channel consumption and notification by the separately built reference host.",
      "P-12 remains NOT_PROVEN until M07-T10, M07-T11, and M10-T07 close product-level invalid-publication recovery.",
      "N-038 and N-041 remain PLANNED; this bounded matrix does not claim every later invalid-input sequence or the final measured whole-system limit profile.",
      "G07 remains NOT_STARTED until every M07 task and the I07-04 historical-reader cleanup complete.",
      "No public fault hook, transaction callback, repository, SQLite handle, package loader, or alternate activation API was added.",
      "The application-owned local root remains trusted; this proof makes no tamper-proof, hostile-administrator, or independently anchored anti-rollback claim.",
      "SQLite is the first Web persistence adapter only; future Android and iOS repositories must preserve the same observable atomicity and recovery invariants.",
    ],
    reproduction: [
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-fault-injection",
      "node scripts/generate-control-plane-runtime-fault-injection-proof.mjs",
      "node scripts/verify-control-plane-runtime-fault-injection.mjs",
      "node --test tests/control-plane-runtime-fault-injection.test.mjs",
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

export async function verifyControlPlaneRuntimeFaultInjectionEvidence(options) {
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
  const built = await buildControlPlaneRuntimeFaultInjectionEvidence({
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
          artifactPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_FAULT_INJECTION_ARTIFACT_PATH,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!Buffer.from(artifactBytes).equals(Buffer.from(built.artifactBytes))) {
    fail("ARTIFACT_DRIFT", "The committed M07-T09 fault-injection artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(proofDocumentPath ?? path.join(ROOT, PROOF_DOCUMENT)),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T09 artifact pin.");
  }
  return Object.freeze({
    task: "M07-T09",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    faultCases: built.artifact.claims.boundaryMatrix.caseCount,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compilerNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    traceRows: built.artifact.claims.traceRows.length,
  });
}

export async function writeControlPlaneRuntimeFaultInjectionEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename", "runtimeSuiteReceipt"]),
    "write options",
  );
  const artifactPath =
    captureOptionalPath(captured.artifactPath, "artifactPath") ??
    DEFAULT_CONTROL_PLANE_RUNTIME_FAULT_INJECTION_ARTIFACT_PATH;
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  const built = await buildControlPlaneRuntimeFaultInjectionEvidence({
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
    fail("ARTIFACT_WRITE_FAILED", "The M07-T09 artifact could not be committed atomically.");
  }
  return Object.freeze({ artifactPath, artifactSha256: built.artifactSha256 });
}
