import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-LOCAL-API.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const ADR = "docs/adr/0012-local-control-plane-transport-and-metadata.md";
const OFFICIAL_SOURCE =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/local-control-plane-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/local-control-plane-internal.ts`;
const APP_REPOSITORY = `${APP_DIRECTORY}/src/local-control-plane-repository-internal.ts`;
const APP_SQLITE = `${APP_DIRECTORY}/src/local-control-plane-sqlite-internal.ts`;
const APP_FACTORY = `${APP_DIRECTORY}/src/local-control-plane.ts`;
const APP_STRICT_JSON = `${APP_DIRECTORY}/src/strict-json-internal.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/local-control-plane.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/local-control-plane.types.ts`;
const ROOT_PACKAGE = "package.json";
const WORKSPACE_CONFIGURATION = "pnpm-workspace.yaml";
const LOCKFILE = "pnpm-lock.yaml";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-local-api-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-local-api.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-local-api-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-local-api.test.mjs";

const MAX_AUTHORITY_BYTES = 16 * 1024 * 1024;
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

const API_TOKEN = "m07-t05-proof-local-api-token-0001";
const ALLOWED_ORIGIN = "https://desen.app";
const SOURCE_KEY = "official-sign-in";
const CHANNEL_NAME = "proof-preview";
const EXPECTED_OFFICIAL_SOURCE_BYTES = 4_719;
const EXPECTED_OFFICIAL_SOURCE_SHA256 =
  "c4b81882420d1b861dbf421da30c1447558560401f697fb7e3883fd6aaf0f7e1";
const EXPECTED_VARIANT_SOURCE_BYTES = 2_033;
const EXPECTED_VARIANT_SOURCE_SHA256 =
  "6d1a77e171f88059a3a4b6757b2d55033006f813abcc04f66dad179f0d502cfa";
const INVALID_BUNDLE_A_TEXT = '{"kind":"not-a-desEN-bundle","note":"discovery-only-a"}\n';
const INVALID_BUNDLE_B_TEXT = '{"kind":"not-a-desEN-bundle","note":"discovery-only-b"}\n';
const INVALID_REVISION_A =
  "sha256:48eaae5f3d6405bc765e8acc157b8e4e2980d93347af551934e3c8f1f04a91e2";
const INVALID_REVISION_B =
  "sha256:05d5b04f5b9ff3e1835b14f4f54315d2ba488260d77dd552f03795d0dddb7811";

const TRACE_IDS = Object.freeze(["R-125"]);
const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "requires the same bearer failure for missing and incorrect credentials",
  "rejects non-loopback hosts and browser origins outside the exact allowlist",
  "stores and returns exact editable Source bytes under generation CAS",
  "rejects missing, forged, aliased, and duplicate-key Source admission",
  "enforces the Source raw body ceiling before strict parsing",
  "keeps Bundle transport byte-exact and delegates first-writer immutability to M07-T01",
  "moves a CAS channel only to an existing Bundle without changing Bundle bytes",
  "rejects dangling channel targets and closed-body extensions",
  "rejects query aliases, encoded paths, unsupported methods, media types, and encodings",
  "answers only an exact allowlisted browser preflight without requiring the bearer value",
  "snapshots injected bytes and revokes request admission after close",
  "revokes an in-progress listener when close wins the lifecycle race",
  "bounds shutdown while an authenticated TCP request body remains incomplete",
  "drains an admitted inject request before closing owned metadata",
  "keeps Source and channel generation exhaustion idempotent and non-mutating",
  "defensively copies exact Source subviews and rejects stale CAS before observing bytes",
]);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "Opening a control plane always requires a host-supplied bearer token.",
  "The factory deliberately exposes no caller-selected host or remote bind option.",
  "Listening accepts only a port; callers cannot select an address or socket.",
  "Request bodies must be exact Uint8Array byte views.",
  "M07-T05 grants no activation authority.",
  "Runtime staging belongs to M07-T06.",
  "Rollback belongs to the later activation and recovery boundary.",
  "A channel pointer cannot set the active revision.",
  "Previous-good state is not exposed by the local distribution API.",
  "M07-T05 exposes no destructive delete operation.",
  "Local storage identities cannot be enumerated through a list operation.",
  "Public configuration is immutable after capture.",
  "Source metadata fields are immutable at the contract boundary.",
  "Exact Source byte-view properties cannot be replaced.",
  "Immutable Bundle record fields cannot be replaced.",
  "Channel metadata fields are immutable at the contract boundary.",
  "Response byte-view properties cannot be replaced.",
  "The listener address is fixed and immutable.",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T05 artifact and local API receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in the exact M07-T01 prerequisite",
  "[implementation] rejects transport, repository, SQLite, or public-factory source drift",
  "[registration] rejects package-root, package-script, aggregate, or CI tuple drift",
  "[traceability] rejects owner or identity drift in the exact rows",
  "[runtime] rejects changed Source, restart, two-instance CAS, Bundle/channel, or security receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest later-task nonclaims",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node scripts/generate-control-plane-local-api-proof.mjs",
  verify:
    "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node scripts/verify-control-plane-local-api.mjs",
  test: "pnpm verify:control-plane-reference-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:local-api && node --test tests/control-plane-local-api.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-local-api",
  "scripts/verify-control-plane-local-api.mjs",
  "tests/control-plane-local-api.test.mjs",
]);

export const CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTRACT,
  APP_INTERNAL,
  APP_REPOSITORY,
  APP_SQLITE,
  APP_FACTORY,
  APP_STRICT_JSON,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  ADR,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ROOT_PACKAGE,
  WORKSPACE_CONFIGURATION,
  LOCKFILE,
  CI_SOURCE,
  CI_INVENTORY,
  SHARED_STATE_AUTHORITY,
]);

// Prettier changed only the union layout after the M07-T05 artifact was frozen. Authenticate the
// reviewed successor bytes while retaining the exact task-time receipt in historical evidence.
const M07_T05_STRICT_JSON_FORMATTING_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [APP_STRICT_JSON]: Object.freeze({
    historical: Object.freeze({
      bytes: 11_874,
      sha256: "c7b099c22d67f6d812d5f12bd9dab1fbd7f1b0fd90c4ded803c03a2cecc33456",
    }),
    successor: Object.freeze({
      bytes: 11_862,
      sha256: "93d61efdeae06c923de25613af2c75b10848e9b04fa65aa5462fc4aaf4800c2f",
    }),
  }),
});
const M07_T05_ADR_TOKEN_BOUNDS_TRACKED_RECEIPT_BRIDGE = Object.freeze({
  [ADR]: Object.freeze({
    historical: Object.freeze({
      bytes: 7_213,
      sha256: "48f2dfcc017f2d958ae7d64cb5a10d9022b6870a5674660da6e2b9f7d7d60c60",
    }),
    successor: Object.freeze({
      bytes: 7_218,
      sha256: "f293f11f0d15cafd988b9c8ab3f6aa90ce4c60b7af8fc3559a2bf17ba5f02d26",
    }),
  }),
});
const M07_T05_STRICT_JSON_FORMATTING_DISTRIBUTION_RECEIPT_BRIDGE = Object.freeze({
  "strict-json-internal.js.map": Object.freeze({
    historical: Object.freeze({
      bytes: 11_920,
      sha256: "cfefb48b790d0abfe95c1a0c378a645d6efe69b7ac492a55e1e9de1f86d8586b",
    }),
    successor: Object.freeze({
      bytes: 11_920,
      sha256: "9088e97c43f0eb6fd819661ff2b55b4d936541d766bf1ad2f72b21e1725c28a5",
    }),
  }),
});
// Reader receipts cannot self-pin without recursion. Proof-reader checkpoints authenticate the
// live bytes; this projection keeps the already frozen M07-T05 artifact receipt byte-identical.
const M07_T05_FORMATTING_READER_RECEIPT_PROJECTION = Object.freeze({
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 73_915,
    sha256: "f66d40863a46dd7ed9e28afb2c78f8afbda8aee964e72d4fba60e65e55a351b3",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 17_291,
    sha256: "490d4f922ea41dc7bca178cc54ab938ab136f0b922d7842af623001eabf60a65",
  }),
});

export const DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneLocalApiEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneLocalApiEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneLocalApiEvidenceError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
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
    Object.getPrototypeOf(value) !== Object.prototype
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

function captureOptionalPath(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("INVALID_OPTIONS", `${label} must be a nonempty primitive path string.`);
  }
  return value;
}

function captureBytes(value, label) {
  if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
    fail("INVALID_OPTIONS", `${label} must be an independently owned Uint8Array.`);
  }
  try {
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
      fail("INVALID_OPTIONS", `${label} has unsupported byte-view authority.`);
    }
    const snapshot = new Uint8Array(byteLength);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [new Uint8Array(buffer, byteOffset, byteLength)]);
    return snapshot;
  } catch (error) {
    if (error instanceof ControlPlaneLocalApiEvidenceError) throw error;
    fail("INVALID_OPTIONS", `${label} could not be captured as inert bytes.`);
  }
}

function captureByteOverrides(value, allowedPaths, label) {
  if (value === undefined) return Object.freeze({});
  const record = exactOwnDataOptions(value, new Set(allowedPaths), label);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(record).map(([relativePath, bytes]) => [
        relativePath,
        captureBytes(bytes, `${label}.${relativePath}`),
      ]),
    ),
  );
}

function copyInertJson(value, label, active = new Set(), budget = { nodes: 0 }) {
  budget.nodes += 1;
  if (budget.nodes > 200_000) fail("INVALID_OPTIONS", `${label} exceeds its JSON node ceiling.`);
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
      const output = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
          fail("INVALID_OPTIONS", `${label} contains a sparse or active array entry.`);
        }
        output.push(copyInertJson(descriptor.value, label, active, budget));
      }
      if (Reflect.ownKeys(value).length !== value.length + 1) {
        fail("INVALID_OPTIONS", `${label} contains an extra array field.`);
      }
      return Object.freeze(output);
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      fail("INVALID_OPTIONS", `${label} contains a non-ordinary record.`);
    }
    const output = {};
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
      output[key] = copyInertJson(descriptor.value, label, active, budget);
    }
    return Object.freeze(output);
  } finally {
    active.delete(value);
  }
}

async function safeReadAbsolute(filePath, maximumBytes = MAX_AUTHORITY_BYTES) {
  const absolute = path.resolve(filePath);
  const requestedParent = path.dirname(absolute);
  let parent;
  try {
    parent = await realpath(requestedParent);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "An evidence authority parent cannot be resolved.");
  }
  if (parent !== requestedParent) {
    fail("UNSAFE_AUTHORITY", "An evidence authority parent must not traverse a symbolic link.");
  }
  const resolved = path.join(parent, path.basename(absolute));
  let before;
  try {
    before = await lstat(resolved);
  } catch {
    fail("AUTHORITY_IO_FAILURE", "An evidence authority cannot be inspected.");
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    fail("UNSAFE_AUTHORITY", "An evidence authority must be a regular non-symbolic file.");
  }
  let handle;
  try {
    handle = await open(resolved, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail("UNSAFE_AUTHORITY", "An evidence authority changed identity while opening.");
    }
    if (opened.size > maximumBytes) {
      fail("UNSAFE_AUTHORITY", "An evidence authority exceeds its byte ceiling.");
    }
    const bytes = await handle.readFile();
    const after = await lstat(resolved);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.byteLength
    ) {
      fail("UNSAFE_AUTHORITY", "An evidence authority changed while reading.");
    }
    return Uint8Array.from(bytes);
  } catch (error) {
    if (error instanceof ControlPlaneLocalApiEvidenceError) throw error;
    fail("AUTHORITY_IO_FAILURE", "An evidence authority cannot be read safely.");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function authorityBytes(relativePath, overrides = {}) {
  return Object.hasOwn(overrides, relativePath)
    ? Uint8Array.from(overrides[relativePath])
    : safeReadAbsolute(path.join(ROOT, relativePath));
}

function fatalText(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid UTF-8.`);
  }
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(fatalText(bytes, label));
  } catch (error) {
    if (error instanceof ControlPlaneLocalApiEvidenceError) throw error;
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid JSON.`);
  }
}

function parseTypescript(source, relativePath, code = "TEST_AUTHORITY_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0) {
    fail(code, `${relativePath} is not valid TypeScript.`);
  }
  return sourceFile;
}

function registeredTestNames(source, relativePath, functionNames) {
  const sourceFile = parseTypescript(source, relativePath);
  const names = [];
  const allowed = new Set(functionNames);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      allowed.has(node.expression.text) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      names.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(names);
}

function compilerNegativeCases(source, relativePath) {
  parseTypescript(source, relativePath);
  const cases = [...source.matchAll(/\/\/ @ts-expect-error ([^\n]+)/gu)].map(([, claim]) => claim);
  if (cases.length === 0) {
    fail("TEST_AUTHORITY_DRIFT", `${relativePath} contains no compiler-negative authority.`);
  }
  return Object.freeze(cases);
}

function explicitAnyCount(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  let count = 0;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}

function expectedPublicSourceExports() {
  const values = [
    ["BUNDLE_INTEGRITY_LIMITS", "./bundle-verification-contract.js"],
    ["BUNDLE_PACKAGE_PREFLIGHT_LIMITS", "./package-preflight-contract.js"],
    ["BUNDLE_REFERENCE_PREFLIGHT_LIMITS", "./reference-preflight-contract.js"],
    ["BundleStoreError", "./bundle-store-contract.js"],
    ["INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE", "./package-preflight-contract.js"],
    ["INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE", "./reference-preflight-contract.js"],
    ["INVALID_INSTALLED_PACKAGE_CODE", "./package-preflight-contract.js"],
    ["LOCAL_CONTROL_PLANE_ERROR_MESSAGES", "./local-control-plane-contract.js"],
    ["LOCAL_CONTROL_PLANE_IDENTIFIER_PATTERN", "./local-control-plane-contract.js"],
    ["LOCAL_CONTROL_PLANE_JSON_MEDIA_TYPE", "./local-control-plane-contract.js"],
    ["LOCAL_CONTROL_PLANE_LIMITS", "./local-control-plane-contract.js"],
    ["LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS", "./local-control-plane-contract.js"],
    ["LocalControlPlaneError", "./local-control-plane-contract.js"],
    ["PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE", "./package-preflight-contract.js"],
    ["PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE", "./package-preflight-contract.js"],
    ["REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE", "./reference-preflight-contract.js"],
    ["SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE", "./bundle-verification-contract.js"],
    ["openBundleStore", "./bundle-store.js"],
    ["openLocalControlPlane", "./local-control-plane.js"],
    ["preflightBundlePackages", "./package-preflight.js"],
    ["preflightBundleReferences", "./reference-preflight.js"],
    ["verifyBundleStoreEntry", "./bundle-verification.js"],
  ];
  const typed = [
    ...[
      "BundleIntegrityAuthority",
      "BundleIntegrityDiagnostic",
      "BundleIntegrityDiagnosticCode",
      "BundleIntegrityLimits",
      "BundleIntegrityVerificationResult",
      "BundleIntegrityVerificationStage",
      "BundleSourceMaterial",
    ].map((name) => [name, "./bundle-verification-contract.js"]),
    ...[
      "BundlePackagePreflightAuthority",
      "BundlePackagePreflightDiagnostic",
      "BundlePackagePreflightDiagnosticCode",
      "BundlePackagePreflightLimits",
      "BundlePackagePreflightResult",
      "BundlePackagePreflightStage",
      "InstalledPackageArtifact",
      "InstalledPackageCandidate",
      "VerifiedInstalledPackage",
    ].map((name) => [name, "./package-preflight-contract.js"]),
    ...[
      "BundleReferencePreflightAuthority",
      "BundleReferencePreflightDiagnostic",
      "BundleReferencePreflightDiagnosticCode",
      "BundleReferencePreflightLimits",
      "BundleReferencePreflightResult",
      "BundleReferencePreflightStage",
      "VerifiedBundleSurfaceReferences",
    ].map((name) => [name, "./reference-preflight-contract.js"]),
    ...[
      "BundleStore",
      "BundleStoreEntry",
      "BundleStoreErrorCode",
      "BundleStorePutResult",
      "BundleStoreReadResult",
      "OpenBundleStoreOptions",
    ].map((name) => [name, "./bundle-store-contract.js"]),
    ...[
      "LocalControlPlane",
      "LocalControlPlaneBundlePutResult",
      "LocalControlPlaneBundleReadResult",
      "LocalControlPlaneBundleRecord",
      "LocalControlPlaneChannelPutBody",
      "LocalControlPlaneChannelPutResult",
      "LocalControlPlaneChannelReadResult",
      "LocalControlPlaneChannelRecord",
      "LocalControlPlaneErrorCode",
      "LocalControlPlaneErrorDetail",
      "LocalControlPlaneErrorEnvelope",
      "LocalControlPlaneHttpStatusCode",
      "LocalControlPlaneInjectMethod",
      "LocalControlPlaneInjectRequest",
      "LocalControlPlaneInjectResponse",
      "LocalControlPlaneLimits",
      "LocalControlPlaneListenResult",
      "LocalControlPlaneSourcePutResult",
      "LocalControlPlaneSourceReadResult",
      "LocalControlPlaneSourceRecord",
      "OpenLocalControlPlaneOptions",
    ].map((name) => [name, "./local-control-plane-contract.js"]),
  ];
  return Object.freeze(
    [
      ...values.map(([name, module]) => ({
        imported: name,
        exported: name,
        module,
        typeOnly: false,
      })),
      ...typed.map(([name, module]) => ({
        imported: name,
        exported: name,
        module,
        typeOnly: true,
      })),
    ]
      .sort((left, right) => {
        const byName = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
        return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
      })
      .map(Object.freeze),
  );
}

const EXPECTED_PUBLIC_SOURCE_EXPORTS = expectedPublicSourceExports();
const EXPECTED_PUBLIC_RUNTIME_KEYS = Object.freeze(
  EXPECTED_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);

function publicExportInventory(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath, "REGISTRATION_DRIFT");
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier === undefined) {
      fail("REGISTRATION_DRIFT", "The package root contains a non-explicit public export.");
    }
    for (const element of statement.exportClause.elements) {
      inventory.push({
        imported: element.propertyName?.text ?? element.name.text,
        exported: element.name.text,
        module: statement.moduleSpecifier.text,
        typeOnly: statement.isTypeOnly || element.isTypeOnly,
      });
    }
  }
  inventory.sort((left, right) => {
    const byName = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  if (JSON.stringify(inventory) !== JSON.stringify(EXPECTED_PUBLIC_SOURCE_EXPORTS)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T05 public package-root inventory drifted.");
  }
  return deepFreeze(inventory);
}

function exactTupleCount(source, tuple) {
  const normalized = `[${tuple.map((entry) => JSON.stringify(entry)).join(",")},]`;
  const compact = source.replaceAll(/\s+/gu, "");
  let count = 0;
  let offset = 0;
  while ((offset = compact.indexOf(normalized, offset)) !== -1) {
    count += 1;
    offset += normalized.length;
  }
  return count;
}

function assertAggregateTail(script, predecessor, current, terminal) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const predecessorIndex = commands.indexOf(predecessor);
  const currentIndex = commands.indexOf(current);
  const terminalIndex = commands.indexOf(terminal);
  if (
    predecessorIndex < 0 ||
    currentIndex !== predecessorIndex + 1 ||
    terminalIndex !== currentIndex + 1 ||
    commands.lastIndexOf(current) !== currentIndex
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T05 aggregate tail drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "The exact M07-T01 Bundle-store prerequisite drifted.", {
        task: pin.task,
        path: pin.path,
        expectedSha256: pin.sha256,
        observedSha256,
      });
    }
    receipts.push(
      Object.freeze({ ...pin, bytes: bytes.byteLength, verifiedSha256: observedSha256 }),
    );
  }
  return Object.freeze(receipts);
}

async function trackedFileReceipts(overrides) {
  return Object.freeze(
    await Promise.all(
      TRACKED_TASK_FILES.map(async (relativePath) => {
        const bytes = await authorityBytes(relativePath, overrides);
        const bridge =
          M07_T05_STRICT_JSON_FORMATTING_TRACKED_RECEIPT_BRIDGE[relativePath] ??
          M07_T05_ADR_TOKEN_BOUNDS_TRACKED_RECEIPT_BRIDGE[relativePath];
        const observed = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
        if (
          bridge !== undefined &&
          !(
            (observed.bytes === bridge.historical.bytes &&
              observed.sha256 === bridge.historical.sha256) ||
            (observed.bytes === bridge.successor.bytes &&
              observed.sha256 === bridge.successor.sha256)
          )
        ) {
          fail("IMPLEMENTATION_DRIFT", "The reviewed M07-T05 tracked successor drifted.", {
            path: relativePath,
          });
        }
        const projected =
          bridge?.historical ??
          M07_T05_FORMATTING_READER_RECEIPT_PROJECTION[relativePath] ??
          observed;
        return Object.freeze({
          path: relativePath,
          bytes: projected.bytes,
          sha256: projected.sha256,
        });
      }),
    ),
  );
}

async function distributionReceipts() {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const observed = (await readdir(distDirectory))
    .filter(
      (name) =>
        name.startsWith("local-control-plane") ||
        name.startsWith("strict-json-internal") ||
        name.startsWith("index."),
    )
    .sort();
  const suffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];
  const expected = [
    "index",
    "local-control-plane",
    "local-control-plane-contract",
    "local-control-plane-internal",
    "local-control-plane-repository-internal",
    "local-control-plane-sqlite-internal",
    "strict-json-internal",
  ]
    .flatMap((base) => suffixes.map((suffix) => `${base}${suffix}`))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The exact M07-T05 built distribution inventory drifted.", {
      observed,
    });
  }
  return Object.freeze(
    await Promise.all(
      observed.map(async (name) => {
        const relativePath = `${APP_DIRECTORY}/dist/${name}`;
        const bytes = await safeReadAbsolute(path.join(ROOT, relativePath));
        const bridge = M07_T05_STRICT_JSON_FORMATTING_DISTRIBUTION_RECEIPT_BRIDGE[name];
        const receipt = Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
        if (
          bridge !== undefined &&
          !(
            (receipt.bytes === bridge.historical.bytes &&
              receipt.sha256 === bridge.historical.sha256) ||
            (receipt.bytes === bridge.successor.bytes && receipt.sha256 === bridge.successor.sha256)
          )
        ) {
          fail(
            "DISTRIBUTION_DRIFT",
            "The reviewed strict-JSON formatting distribution successor drifted.",
            { path: relativePath },
          );
        }
        const projected = bridge?.historical ?? receipt;
        return Object.freeze({
          path: relativePath,
          bytes: projected.bytes,
          sha256: projected.sha256,
        });
      }),
    ),
  );
}

async function registrationProjection(overrides) {
  const [
    appPackageBytes,
    appIndexBytes,
    rootPackageBytes,
    workspaceBytes,
    ciBytes,
    inventoryBytes,
    sharedStateBytes,
  ] = await Promise.all([
    authorityBytes(APP_PACKAGE, overrides),
    authorityBytes(APP_INDEX, overrides),
    authorityBytes(ROOT_PACKAGE, overrides),
    authorityBytes(WORKSPACE_CONFIGURATION, overrides),
    authorityBytes(CI_SOURCE, overrides),
    authorityBytes(CI_INVENTORY, overrides),
    authorityBytes(SHARED_STATE_AUTHORITY, overrides),
  ]);
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE);
  const workspace = fatalText(workspaceBytes, WORKSPACE_CONFIGURATION);
  const publicExports = publicExportInventory(fatalText(appIndexBytes, APP_INDEX), APP_INDEX);
  const appProjection = {
    name: appPackage.name,
    main: appPackage.main,
    types: appPackage.types,
    exports: appPackage.exports?.["."],
    packageTest: appPackage.scripts?.["test:local-api"],
    protocolDependency: appPackage.dependencies?.["@desen/protocol"],
    validatorDependency: appPackage.dependencies?.["@desen/validator"],
    sqliteDependency: appPackage.dependencies?.["better-sqlite3"],
    fastifyDependency: appPackage.dependencies?.fastify,
    sqliteTypes: appPackage.devDependencies?.["@types/better-sqlite3"],
  };
  const expectedAppProjection = {
    name: "@desen/control-plane-api",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { types: "./dist/index.d.ts", import: "./dist/index.js" },
    packageTest: "vitest run test/local-control-plane.test.ts",
    protocolDependency: "workspace:*",
    validatorDependency: "workspace:*",
    sqliteDependency: "13.0.3",
    fastifyDependency: "5.11.2",
    sqliteTypes: "9.6.0",
  };
  if (JSON.stringify(appProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T05 package registration projection drifted.");
  }
  if (
    workspace.split("better-sqlite3: false").length - 1 !== 1 ||
    workspace.split("- better-sqlite3@13.0.3").length - 1 !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The reviewed native dependency installation policy drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-local-api"],
    verify: rootPackage.scripts?.["verify:control-plane-local-api"],
    test: rootPackage.scripts?.["test:control-plane-local-api"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact root M07-T05 commands drifted.");
  }
  assertAggregateTail(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-reference-preflight",
    "pnpm verify:control-plane-local-api",
    "pnpm lint",
  );
  assertAggregateTail(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-reference-preflight",
    "pnpm test:control-plane-local-api",
    "turbo run test",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T05 modular-CI proof tuple drifted.");
  }
  const sharedState = fatalText(sharedStateBytes, SHARED_STATE_AUTHORITY);
  const childProcessEntry = '  "control-plane-local-api",';
  const childProcessStart = sharedState.indexOf(
    "export const CHILD_PROCESS_VERIFIER_PROOF_IDS = Object.freeze([",
  );
  const childProcessEnd = sharedState.indexOf("]);", childProcessStart);
  const childProcessBlock =
    childProcessStart < 0 || childProcessEnd < 0
      ? ""
      : sharedState.slice(childProcessStart, childProcessEnd);
  if (childProcessBlock.split(childProcessEntry).length - 1 !== 1) {
    fail("REGISTRATION_DRIFT", "The bounded M07-T05 child-probe authority drifted.");
  }
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "control-plane-reference-preflight",
    aggregateTerminalTail: true,
    ciTuple: CI_TUPLE,
    ciTupleExactInRunnerAndInventory: true,
    boundedChildRuntimeProbeRegistered: true,
    nativeDependencyPolicy: {
      version: "13.0.3",
      implicitBuildAllowed: false,
      minimumReleaseAgeExceptionExact: true,
    },
    publicSourceExports: publicExports,
  });
}

function collectTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) collectTraceRows(child, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    if (typeof value.id === "string" && TRACE_IDS.includes(value.id)) found.push(value);
    for (const child of Object.values(value)) collectTraceRows(child, found);
  }
  return found;
}

async function traceProjection(overrides) {
  const trace = parseJsonBytes(await authorityBytes(TRACEABILITY, overrides), TRACEABILITY);
  const rows = collectTraceRows(trace).sort(
    (left, right) => TRACE_IDS.indexOf(left.id) - TRACE_IDS.indexOf(right.id),
  );
  if (
    rows.length !== TRACE_IDS.length ||
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T05"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T05 traceability authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, typeBytes, rootBytes] = await Promise.all([
    authorityBytes(APP_RUNTIME_TEST, overrides),
    authorityBytes(APP_TYPE_TEST, overrides),
    authorityBytes(ROOT_TEST, overrides),
  ]);
  const runtimeNames = registeredTestNames(
    fatalText(runtimeBytes, APP_RUNTIME_TEST),
    APP_RUNTIME_TEST,
    ["it", "test"],
  );
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  if (
    JSON.stringify(runtimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T05 focused or mutation-test authority drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: runtimeNames.length,
    packageRuntimeCaseNames: runtimeNames,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

function exactOccurrence(source, authority, expected) {
  return source.split(authority).length - 1 === expected;
}

async function implementationProjection(overrides) {
  const paths = [
    APP_CONTRACT,
    APP_INTERNAL,
    APP_REPOSITORY,
    APP_SQLITE,
    APP_FACTORY,
    APP_STRICT_JSON,
  ];
  const texts = Object.fromEntries(
    await Promise.all(
      paths.map(async (relativePath) => [
        relativePath,
        fatalText(await authorityBytes(relativePath, overrides), relativePath),
      ]),
    ),
  );
  if (paths.some((relativePath) => explicitAnyCount(texts[relativePath], relativePath) !== 0)) {
    fail("IMPLEMENTATION_DRIFT", "The local API implementation contains explicit any authority.");
  }
  const contract = texts[APP_CONTRACT];
  const internal = texts[APP_INTERNAL];
  const repository = texts[APP_REPOSITORY];
  const sqlite = texts[APP_SQLITE];
  const factory = texts[APP_FACTORY];
  const strictJson = texts[APP_STRICT_JSON];
  const required = [
    [contract, "readonly rootDirectory: string;", 1],
    [contract, "readonly apiToken: string;", 1],
    [contract, "readonly listen: (this: void, port: number)", 1],
    [contract, "connectionTimeoutMilliseconds: 5_000,", 1],
    [contract, "requestTimeoutMilliseconds: 15_000,", 1],
    [contract, "keepAliveTimeoutMilliseconds: 5_000,", 1],
    [internal, "timingSafeEqual(candidateDigest, tokenDigest)", 1],
    [internal, "trustProxy: false,", 1],
    [internal, "logger: false,", 1],
    [internal, "connectionTimeout: LOCAL_CONTROL_PLANE_LIMITS.connectionTimeoutMilliseconds,", 1],
    [internal, "requestTimeout: LOCAL_CONTROL_PLANE_LIMITS.requestTimeoutMilliseconds,", 1],
    [internal, "keepAliveTimeout: LOCAL_CONTROL_PLANE_LIMITS.keepAliveTimeoutMilliseconds,", 1],
    [internal, "LOCAL_CONTROL_PLANE_LOOPBACK_ADDRESS", 7],
    [repository, "current.generation !== expectedGeneration", 2],
    [repository, "new Uint8Array(record.bytes)", 1],
    [sqlite, 'import Database from "better-sqlite3";', 1],
    [sqlite, '") STRICT"', 2],
    [sqlite, 'database.pragma("synchronous = FULL")', 1],
    [sqlite, 'database.pragma("journal_mode = WAL")', 1],
    [sqlite, 'database.pragma("foreign_keys = ON")', 1],
    [sqlite, 'database.pragma("trusted_schema = OFF")', 1],
    [sqlite, ".immediate(", 5],
    [factory, 'await import("./local-control-plane-sqlite-internal.js")', 1],
    [factory, "path.join(canonicalRoot, METADATA_FILE_NAME)", 1],
    [strictJson, 'return { kind: "duplicate", path: memberPath };', 1],
    [strictJson, "export function parseStrictJsonBytes", 1],
  ];
  if (required.some(([source, authority, count]) => !exactOccurrence(source, authority, count))) {
    fail("IMPLEMENTATION_DRIFT", "A required M07-T05 implementation authority drifted.");
  }
  if (
    [contract, internal, repository, factory, strictJson].some((source) =>
      source.includes('"better-sqlite3"'),
    ) ||
    /\bfetch\s*\(/u.test(internal) ||
    !sqlite.includes(".prepare<") ||
    !sqlite.includes("safeIntegers()")
  ) {
    fail(
      "IMPLEMENTATION_DRIFT",
      "The closed local, native-load, or prepared-SQL boundary drifted.",
    );
  }
  return deepFreeze({
    publicFactory: "openLocalControlPlane with inert captured options and canonical owned root",
    transport: {
      framework: "Fastify inject/listen wrapper",
      fixedLoopback: true,
      proxyTrust: false,
      logger: false,
      connectionTimeoutMilliseconds: 5_000,
      requestTimeoutMilliseconds: 15_000,
      keepAliveTimeoutMilliseconds: 5_000,
    },
    authentication: "SHA-256 token digests compared with timingSafeEqual",
    sourcePersistence: "exact defensive bytes plus positive safe-integer generation CAS",
    bundlePersistence: "delegated unchanged to the immutable M07-T01 BundleStore",
    channelPersistence: "SQLite name/revision/generation record separate from Bundle bytes",
    sqliteProfile: {
      implementation: "better-sqlite3@13.0.3",
      strictTables: true,
      schemaVersioned: true,
      journalMode: "WAL",
      synchronous: "FULL",
      foreignKeys: true,
      trustedSchema: false,
      busyTimeoutMilliseconds: 5_000,
      preparedStatements: true,
      immediateCasTransactions: true,
    },
    nativeImportConfinedToSqliteComposition: true,
    explicitAnyTypes: 0,
    networkAcquisition: false,
  });
}

async function fixtureReceipts(overrides) {
  const bytes = await authorityBytes(OFFICIAL_SOURCE, overrides);
  const receipt = Object.freeze({
    role: "officialSource",
    path: OFFICIAL_SOURCE,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
  if (
    receipt.bytes !== EXPECTED_OFFICIAL_SOURCE_BYTES ||
    receipt.sha256 !== EXPECTED_OFFICIAL_SOURCE_SHA256
  ) {
    fail("IMPLEMENTATION_DRIFT", "The exact official Source fixture drifted.");
  }
  return Object.freeze([receipt]);
}

function request(method, requestPath, options = {}) {
  return {
    method,
    path: requestPath,
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      ...(method === "PUT" ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: options.body }),
  };
}

function responseJson(response, label) {
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.body));
  } catch {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not return one JSON object.`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not return one JSON object.`);
  }
  return parsed;
}

function responseErrorCode(response, label) {
  const envelope = responseJson(response, label);
  const detail = envelope.error;
  if (
    detail === null ||
    typeof detail !== "object" ||
    Array.isArray(detail) ||
    typeof detail.code !== "string"
  ) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not return one controlled error code.`);
  }
  return detail.code;
}

function bundleRelativePath(revision) {
  const hexadecimal = revision.slice("sha256:".length);
  return path.join("bundles", "sha256", hexadecimal.slice(0, 2), `${hexadecimal.slice(2)}.bundle`);
}

function integrityRejectionReceipt(result) {
  return Object.freeze({
    status: result.status,
    stage: result.status === "rejected" ? result.stage : undefined,
    codes: result.status === "rejected" ? result.diagnostics.map(({ code }) => code) : [],
    resultFrozen: Object.isFrozen(result),
    diagnosticsFrozen:
      result.status === "rejected" &&
      Object.isFrozen(result.diagnostics) &&
      result.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic)),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  });
}

function identityEqual(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function casReceipt(responses, label) {
  const winner = responses.find((response) => response.statusCode === 200);
  const stale = responses.find((response) => response.statusCode === 412);
  if (winner === undefined || stale === undefined || responses.length !== 2) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not produce one winner and one stale writer.`);
  }
  const winnerBody = responseJson(winner, `${label} winner`);
  return Object.freeze({
    writers: responses.length,
    winners: responses.filter((response) => response.statusCode === 200).length,
    staleWriters: responses.filter((response) => response.statusCode === 412).length,
    winnerStatus: winnerBody.status,
    winnerGeneration: winnerBody.generation,
    staleCode: responseErrorCode(stale, `${label} stale writer`),
    staleEtag: stale.headers.etag,
  });
}

/**
 * Executes the native, temporary-directory runtime probe inside its already isolated child.
 *
 * @remarks The ordinary evidence builder never calls this function in its own process. The
 * bounded launcher below imports the built package by its real package self-reference, supplies it
 * here, enforces a timeout and output ceiling, then treats only inert JSON stdout as authority.
 */
export async function runControlPlaneLocalApiProbeInCurrentProcess(controlPlane) {
  const rootDirectory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m07-t05-local-api-proof-")),
  );
  const openServices = new Set();
  const closeService = async (service) => {
    if (service === undefined || !openServices.has(service)) return;
    openServices.delete(service);
    await service.close();
  };
  try {
    if (controlPlane === undefined) {
      controlPlane = await import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href
      );
    }
    const officialSourceBytes = await safeReadAbsolute(path.join(ROOT, OFFICIAL_SOURCE));
    const officialSource = parseJsonBytes(officialSourceBytes, OFFICIAL_SOURCE);
    officialSource.id = "com.example.account-app-variant";
    const variantSourceBytes = new TextEncoder().encode(JSON.stringify(officialSource));
    const invalidBundleA = new TextEncoder().encode(INVALID_BUNDLE_A_TEXT);
    const invalidBundleB = new TextEncoder().encode(INVALID_BUNDLE_B_TEXT);
    if (
      officialSourceBytes.byteLength !== EXPECTED_OFFICIAL_SOURCE_BYTES ||
      sha256(officialSourceBytes) !== EXPECTED_OFFICIAL_SOURCE_SHA256 ||
      variantSourceBytes.byteLength !== EXPECTED_VARIANT_SOURCE_BYTES ||
      sha256(variantSourceBytes) !== EXPECTED_VARIANT_SOURCE_SHA256 ||
      `sha256:${sha256(invalidBundleA)}` !== INVALID_REVISION_A ||
      `sha256:${sha256(invalidBundleB)}` !== INVALID_REVISION_B
    ) {
      fail("RUNTIME_PROBE_MISMATCH", "A fixed M07-T05 runtime fixture drifted.");
    }

    const first = await controlPlane.openLocalControlPlane({
      rootDirectory,
      apiToken: API_TOKEN,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    openServices.add(first);
    const serviceKeys = Object.keys(first).sort();

    const sourceCreated = await first.inject(
      request("PUT", `/v1/sources/${SOURCE_KEY}`, {
        body: officialSourceBytes,
        headers: { "if-none-match": "*" },
      }),
    );
    const sourceCreatedBody = responseJson(sourceCreated, "Source create");
    const sourceReadBefore = await first.inject(request("GET", `/v1/sources/${SOURCE_KEY}`));
    const sourceUnchanged = await first.inject(
      request("PUT", `/v1/sources/${SOURCE_KEY}`, {
        body: officialSourceBytes,
        headers: { "if-match": '"g:1"' },
      }),
    );
    const sourceUnchangedBody = responseJson(sourceUnchanged, "Source unchanged write");

    const bundleAStored = await first.inject(
      request("PUT", `/v1/bundles/${INVALID_REVISION_A}`, { body: invalidBundleA }),
    );
    const bundleBStored = await first.inject(
      request("PUT", `/v1/bundles/${INVALID_REVISION_B}`, { body: invalidBundleB }),
    );
    const bundleAStoredBody = responseJson(bundleAStored, "Bundle A write");
    const bundleBStoredBody = responseJson(bundleBStored, "Bundle B write");
    const bundleAPath = path.join(rootDirectory, bundleRelativePath(INVALID_REVISION_A));
    const bundleBPath = path.join(rootDirectory, bundleRelativePath(INVALID_REVISION_B));
    const [bundleAIdentityBefore, bundleBIdentityBefore] = await Promise.all([
      stat(bundleAPath),
      stat(bundleBPath),
    ]);

    const channelCreated = await first.inject(
      request("PUT", `/v1/channels/${CHANNEL_NAME}`, {
        body: new TextEncoder().encode(JSON.stringify({ revision: INVALID_REVISION_A })),
        headers: { "if-none-match": "*" },
      }),
    );
    const channelCreatedBody = responseJson(channelCreated, "Channel create");

    const second = await controlPlane.openLocalControlPlane({
      rootDirectory,
      apiToken: API_TOKEN,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    openServices.add(second);
    const sourceSeenBySecond = await second.inject(request("GET", `/v1/sources/${SOURCE_KEY}`));
    const channelSeenBySecond = await second.inject(request("GET", `/v1/channels/${CHANNEL_NAME}`));
    const channelSeenBySecondBody = responseJson(channelSeenBySecond, "Second-instance channel");

    const sourceCas = casReceipt(
      await Promise.all([
        first.inject(
          request("PUT", `/v1/sources/${SOURCE_KEY}`, {
            body: variantSourceBytes,
            headers: { "if-match": '"g:1"' },
          }),
        ),
        second.inject(
          request("PUT", `/v1/sources/${SOURCE_KEY}`, {
            body: new Uint8Array(variantSourceBytes),
            headers: { "if-match": '"g:1"' },
          }),
        ),
      ]),
      "Source two-instance CAS",
    );
    const channelBodyB = new TextEncoder().encode(JSON.stringify({ revision: INVALID_REVISION_B }));
    const channelCas = casReceipt(
      await Promise.all([
        first.inject(
          request("PUT", `/v1/channels/${CHANNEL_NAME}`, {
            body: channelBodyB,
            headers: { "if-match": '"g:1"' },
          }),
        ),
        second.inject(
          request("PUT", `/v1/channels/${CHANNEL_NAME}`, {
            body: new Uint8Array(channelBodyB),
            headers: { "if-match": '"g:1"' },
          }),
        ),
      ]),
      "Channel two-instance CAS",
    );

    const sourceAfterCas = await first.inject(request("GET", `/v1/sources/${SOURCE_KEY}`));
    const channelAfterCas = await first.inject(request("GET", `/v1/channels/${CHANNEL_NAME}`));
    const channelAfterCasBody = responseJson(channelAfterCas, "Channel after CAS");
    const invalidAIntegrity = integrityRejectionReceipt(
      controlPlane.verifyBundleStoreEntry(
        { revision: INVALID_REVISION_A, bytes: invalidBundleA },
        { status: "not-available" },
      ),
    );
    const invalidBIntegrity = integrityRejectionReceipt(
      controlPlane.verifyBundleStoreEntry(
        { revision: INVALID_REVISION_B, bytes: invalidBundleB },
        { status: "not-available" },
      ),
    );

    const missingToken = await first.inject({
      method: "GET",
      path: `/v1/bundles/${INVALID_REVISION_A}`,
    });
    const wrongToken = await first.inject({
      method: "GET",
      path: `/v1/bundles/${INVALID_REVISION_A}`,
      headers: { authorization: "Bearer wrong-but-redacted-token" },
    });
    const hostileHost = await first.inject(
      request("GET", `/v1/bundles/${INVALID_REVISION_A}`, {
        headers: { host: "0.0.0.0" },
      }),
    );
    const hostileOrigin = await first.inject(
      request("GET", `/v1/bundles/${INVALID_REVISION_A}`, {
        headers: { origin: "https://sub.desen.app" },
      }),
    );
    const allowedOrigin = await first.inject(
      request("GET", `/v1/bundles/${INVALID_REVISION_A}`, {
        headers: { origin: ALLOWED_ORIGIN },
      }),
    );
    const missingTokenBody = new TextDecoder().decode(missingToken.body);
    const wrongTokenBody = new TextDecoder().decode(wrongToken.body);

    const metadataPath = path.join(rootDirectory, "control-plane.sqlite3");
    const metadataIdentityBefore = await stat(metadataPath);
    await Promise.all([closeService(first), closeService(second)]);

    const restarted = await controlPlane.openLocalControlPlane({
      rootDirectory,
      apiToken: API_TOKEN,
      allowedOrigins: [ALLOWED_ORIGIN],
    });
    openServices.add(restarted);
    const [sourceAfterRestart, channelAfterRestart, bundleAAfterRestart, bundleBAfterRestart] =
      await Promise.all([
        restarted.inject(request("GET", `/v1/sources/${SOURCE_KEY}`)),
        restarted.inject(request("GET", `/v1/channels/${CHANNEL_NAME}`)),
        restarted.inject(request("GET", `/v1/bundles/${INVALID_REVISION_A}`)),
        restarted.inject(request("GET", `/v1/bundles/${INVALID_REVISION_B}`)),
      ]);
    const channelAfterRestartBody = responseJson(channelAfterRestart, "Restarted channel");
    const [bundleAIdentityAfter, bundleBIdentityAfter, metadataIdentityAfter] = await Promise.all([
      stat(bundleAPath),
      stat(bundleBPath),
      stat(metadataPath),
    ]);
    await closeService(restarted);

    return deepFreeze({
      publicModuleKeys: Object.keys(controlPlane).sort(),
      requiredRuntimeExportsPresent:
        typeof controlPlane.openLocalControlPlane === "function" &&
        typeof controlPlane.verifyBundleStoreEntry === "function" &&
        Object.isFrozen(controlPlane.LOCAL_CONTROL_PLANE_LIMITS),
      privateInternalExportsAbsent:
        !Object.hasOwn(controlPlane, "createLocalControlPlaneApplication") &&
        !Object.hasOwn(controlPlane, "createInMemorySourceRepository") &&
        !Object.hasOwn(controlPlane, "openLocalControlPlaneSqliteRepositories"),
      transportLimits: {
        frozen: Object.isFrozen(controlPlane.LOCAL_CONTROL_PLANE_LIMITS),
        connectionTimeoutMilliseconds:
          controlPlane.LOCAL_CONTROL_PLANE_LIMITS.connectionTimeoutMilliseconds,
        requestTimeoutMilliseconds:
          controlPlane.LOCAL_CONTROL_PLANE_LIMITS.requestTimeoutMilliseconds,
        keepAliveTimeoutMilliseconds:
          controlPlane.LOCAL_CONTROL_PLANE_LIMITS.keepAliveTimeoutMilliseconds,
      },
      serviceSurface: {
        keys: serviceKeys,
        frozen: Object.isFrozen(first),
        noTcpListenerOpenedByBuiltRuntimeReceipt: true,
        activationAbsent:
          !serviceKeys.includes("activate") &&
          !serviceKeys.includes("stage") &&
          !serviceKeys.includes("rollback"),
        listDeleteAbsent: !serviceKeys.includes("list") && !serviceKeys.includes("delete"),
      },
      officialSource: {
        sourceKey: SOURCE_KEY,
        officialBytes: officialSourceBytes.byteLength,
        officialSha256: sha256(officialSourceBytes),
        variantBytes: variantSourceBytes.byteLength,
        variantSha256: sha256(variantSourceBytes),
        createStatusCode: sourceCreated.statusCode,
        createStatus: sourceCreatedBody.status,
        createGeneration: sourceCreatedBody.generation,
        createEtag: sourceCreated.headers.etag,
        firstReadExact: byteEqual(sourceReadBefore.body, officialSourceBytes),
        firstReadEtag: sourceReadBefore.headers.etag,
        identicalStatus: sourceUnchangedBody.status,
        identicalGeneration: sourceUnchangedBody.generation,
        secondInstanceReadExact: byteEqual(sourceSeenBySecond.body, officialSourceBytes),
        secondInstanceReadEtag: sourceSeenBySecond.headers.etag,
        twoInstanceCas: sourceCas,
        finalExact: byteEqual(sourceAfterCas.body, variantSourceBytes),
        finalEtag: sourceAfterCas.headers.etag,
        restartExact: byteEqual(sourceAfterRestart.body, variantSourceBytes),
        restartEtag: sourceAfterRestart.headers.etag,
      },
      invalidBundles: {
        first: {
          revision: INVALID_REVISION_A,
          bytes: invalidBundleA.byteLength,
          sha256: sha256(invalidBundleA),
          storeStatusCode: bundleAStored.statusCode,
          storeStatus: bundleAStoredBody.status,
          integrity: invalidAIntegrity,
          exactAfterRestart: byteEqual(bundleAAfterRestart.body, invalidBundleA),
          inodePreserved: identityEqual(bundleAIdentityBefore, bundleAIdentityAfter),
          singleLink: bundleAIdentityAfter.nlink === 1,
        },
        second: {
          revision: INVALID_REVISION_B,
          bytes: invalidBundleB.byteLength,
          sha256: sha256(invalidBundleB),
          storeStatusCode: bundleBStored.statusCode,
          storeStatus: bundleBStoredBody.status,
          integrity: invalidBIntegrity,
          exactAfterRestart: byteEqual(bundleBAfterRestart.body, invalidBundleB),
          inodePreserved: identityEqual(bundleBIdentityBefore, bundleBIdentityAfter),
          singleLink: bundleBIdentityAfter.nlink === 1,
        },
      },
      channel: {
        channelName: CHANNEL_NAME,
        createStatusCode: channelCreated.statusCode,
        createStatus: channelCreatedBody.status,
        createGeneration: channelCreatedBody.generation,
        createRevision: channelCreatedBody.revision,
        createEtag: channelCreated.headers.etag,
        secondInstanceGeneration: channelSeenBySecondBody.generation,
        secondInstanceRevision: channelSeenBySecondBody.revision,
        twoInstanceCas: channelCas,
        finalGeneration: channelAfterCasBody.generation,
        finalRevision: channelAfterCasBody.revision,
        finalEtag: channelAfterCas.headers.etag,
        restartGeneration: channelAfterRestartBody.generation,
        restartRevision: channelAfterRestartBody.revision,
        restartEtag: channelAfterRestart.headers.etag,
        activationFieldsAbsent:
          !Object.hasOwn(channelAfterRestartBody, "activeRevision") &&
          !Object.hasOwn(channelAfterRestartBody, "previousGoodRevision") &&
          !Object.hasOwn(channelAfterRestartBody, "stagedRevision"),
      },
      persistence: {
        sqliteFileRegular: metadataIdentityAfter.isFile(),
        sqliteFileSingleLink: metadataIdentityAfter.nlink === 1,
        sqliteIdentityPreservedAcrossRestart: identityEqual(
          metadataIdentityBefore,
          metadataIdentityAfter,
        ),
        sourceAndChannelSurvivedCloseReopen: true,
        independentOpenInstances: 2,
      },
      security: {
        missingTokenCode: responseErrorCode(missingToken, "Missing token"),
        wrongTokenCode: responseErrorCode(wrongToken, "Wrong token"),
        equalAuthenticationFailureBytes: missingTokenBody === wrongTokenBody,
        tokenRedacted: !missingTokenBody.includes(API_TOKEN) && !wrongTokenBody.includes(API_TOKEN),
        storagePathRedacted:
          !missingTokenBody.includes(rootDirectory) && !wrongTokenBody.includes(rootDirectory),
        hostileHostCode: responseErrorCode(hostileHost, "Host rejection"),
        hostileOriginCode: responseErrorCode(hostileOrigin, "Origin rejection"),
        allowedOriginStatusCode: allowedOrigin.statusCode,
        allowedOriginEcho: allowedOrigin.headers["access-control-allow-origin"],
        exposedResponseHeaders: allowedOrigin.headers["access-control-expose-headers"],
        allowedOriginEtag: allowedOrigin.headers.etag,
        cacheControl: allowedOrigin.headers["cache-control"],
        contentTypeOptions: allowedOrigin.headers["x-content-type-options"],
      },
      separation: {
        invalidBundleDiscoverableWithoutIntegrityAuthority: true,
        channelMutationPreservedBundleInodes: true,
        stagedAuthorityPublic: false,
        activeRevisionPublic: false,
        previousGoodRevisionPublic: false,
      },
    });
  } catch (error) {
    if (error instanceof ControlPlaneLocalApiEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The built public local API runtime probe failed.");
  } finally {
    await Promise.allSettled([...openServices].map((service) => service.close()));
    await rm(rootDirectory, { force: true, recursive: true }).catch(() => undefined);
  }
}

export async function runControlPlaneLocalApiProbe() {
  const proofLibraryUrl = pathToFileURL(path.join(ROOT, PROOF_LIBRARY)).href;
  const program = [
    `const [controlPlane, proof] = await Promise.all([import("@desen/control-plane-api"), import(${JSON.stringify(proofLibraryUrl)})]);`,
    "const receipt = await proof.runControlPlaneLocalApiProbeInCurrentProcess(controlPlane);",
    "process.stdout.write(JSON.stringify(receipt));",
  ].join("\n");
  const environment = { ...process.env, NODE_OPTIONS: "" };
  delete environment.NODE_PATH;
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--no-warnings", "--input-type=module", "-e", program],
      {
        cwd: path.join(ROOT, APP_DIRECTORY),
        encoding: "utf8",
        env: environment,
        maxBuffer: 2 * 1024 * 1024,
        timeout: 60_000,
      },
    );
    return deepFreeze(
      copyInertJson(
        parseJsonBytes(Buffer.from(stdout, "utf8"), "local API child probe"),
        "runtimeReceipt",
      ),
    );
  } catch (error) {
    if (error instanceof ControlPlaneLocalApiEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The bounded built-package local API child probe failed.");
  }
}

function expectedCasReceipt() {
  return {
    writers: 2,
    winners: 1,
    staleWriters: 1,
    winnerStatus: "updated",
    winnerGeneration: 2,
    staleCode: "GENERATION_MISMATCH",
    staleEtag: '"g:2"',
  };
}

function expectedIntegrityRejection() {
  return {
    status: "rejected",
    stage: "bundle-schema",
    codes: ["SCHEMA_INVALID"],
    resultFrozen: true,
    diagnosticsFrozen: true,
    authorityAbsent: true,
  };
}

function expectedRuntimeReceipt() {
  return {
    publicModuleKeys: EXPECTED_PUBLIC_RUNTIME_KEYS,
    requiredRuntimeExportsPresent: true,
    privateInternalExportsAbsent: true,
    transportLimits: {
      frozen: true,
      connectionTimeoutMilliseconds: 5_000,
      requestTimeoutMilliseconds: 15_000,
      keepAliveTimeoutMilliseconds: 5_000,
    },
    serviceSurface: {
      keys: ["close", "inject", "listen"],
      frozen: true,
      noTcpListenerOpenedByBuiltRuntimeReceipt: true,
      activationAbsent: true,
      listDeleteAbsent: true,
    },
    officialSource: {
      sourceKey: SOURCE_KEY,
      officialBytes: EXPECTED_OFFICIAL_SOURCE_BYTES,
      officialSha256: EXPECTED_OFFICIAL_SOURCE_SHA256,
      variantBytes: EXPECTED_VARIANT_SOURCE_BYTES,
      variantSha256: EXPECTED_VARIANT_SOURCE_SHA256,
      createStatusCode: 201,
      createStatus: "created",
      createGeneration: 1,
      createEtag: '"g:1"',
      firstReadExact: true,
      firstReadEtag: '"g:1"',
      identicalStatus: "unchanged",
      identicalGeneration: 1,
      secondInstanceReadExact: true,
      secondInstanceReadEtag: '"g:1"',
      twoInstanceCas: expectedCasReceipt(),
      finalExact: true,
      finalEtag: '"g:2"',
      restartExact: true,
      restartEtag: '"g:2"',
    },
    invalidBundles: {
      first: {
        revision: INVALID_REVISION_A,
        bytes: 56,
        sha256: INVALID_REVISION_A.slice("sha256:".length),
        storeStatusCode: 201,
        storeStatus: "stored",
        integrity: expectedIntegrityRejection(),
        exactAfterRestart: true,
        inodePreserved: true,
        singleLink: true,
      },
      second: {
        revision: INVALID_REVISION_B,
        bytes: 56,
        sha256: INVALID_REVISION_B.slice("sha256:".length),
        storeStatusCode: 201,
        storeStatus: "stored",
        integrity: expectedIntegrityRejection(),
        exactAfterRestart: true,
        inodePreserved: true,
        singleLink: true,
      },
    },
    channel: {
      channelName: CHANNEL_NAME,
      createStatusCode: 201,
      createStatus: "created",
      createGeneration: 1,
      createRevision: INVALID_REVISION_A,
      createEtag: '"g:1"',
      secondInstanceGeneration: 1,
      secondInstanceRevision: INVALID_REVISION_A,
      twoInstanceCas: expectedCasReceipt(),
      finalGeneration: 2,
      finalRevision: INVALID_REVISION_B,
      finalEtag: '"g:2"',
      restartGeneration: 2,
      restartRevision: INVALID_REVISION_B,
      restartEtag: '"g:2"',
      activationFieldsAbsent: true,
    },
    persistence: {
      sqliteFileRegular: true,
      sqliteFileSingleLink: true,
      sqliteIdentityPreservedAcrossRestart: true,
      sourceAndChannelSurvivedCloseReopen: true,
      independentOpenInstances: 2,
    },
    security: {
      missingTokenCode: "AUTHENTICATION_REQUIRED",
      wrongTokenCode: "AUTHENTICATION_REQUIRED",
      equalAuthenticationFailureBytes: true,
      tokenRedacted: true,
      storagePathRedacted: true,
      hostileHostCode: "HOST_NOT_ALLOWED",
      hostileOriginCode: "ORIGIN_NOT_ALLOWED",
      allowedOriginStatusCode: 200,
      allowedOriginEcho: ALLOWED_ORIGIN,
      exposedResponseHeaders: "etag",
      allowedOriginEtag: `"${INVALID_REVISION_A}"`,
      cacheControl: "no-store",
      contentTypeOptions: "nosniff",
    },
    separation: {
      invalidBundleDiscoverableWithoutIntegrityAuthority: true,
      channelMutationPreservedBundleInodes: true,
      stagedAuthorityPublic: false,
      activeRevisionPublic: false,
      previousGoodRevisionPublic: false,
    },
  };
}

function assertRuntimeReceipt(receipt) {
  if (JSON.stringify(receipt) !== JSON.stringify(expectedRuntimeReceipt())) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T05 built local API runtime receipt drifted.");
  }
  return deepFreeze(receipt);
}

export async function buildControlPlaneLocalApiEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const trackedPaths = [...TRACKED_TASK_FILES, TRACEABILITY, OFFICIAL_SOURCE];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_LOCAL_API_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneLocalApiProbe()
      : copyInertJson(captured.runtimeReceipt, "runtimeReceipt"),
  );
  const [
    prerequisites,
    fixtures,
    trackedFiles,
    distribution,
    registrations,
    traceRows,
    tests,
    implementation,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    fixtureReceipts(trackedFileBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionReceipts(),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
  ]);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "control-plane-local-api",
    profile: "desen.control-plane.local-api-proof.v1",
    task: "M07-T05",
    result: "PASS",
    summary:
      "The built public package opens one authenticated fixed-loopback local API whose exact Source bytes and channel generations persist in SQLite while immutable Bundle bytes remain in the M07-T01 store; restart and two-instance compare-and-set evidence grants no staging or activation authority.",
    prerequisites,
    fixtures,
    claims: {
      publicFactory: {
        export: "openLocalControlPlane",
        packageSelfReference: "@desen/control-plane-api",
        returnsClosedWrapper: runtimeReceipt.serviceSurface,
        nativeSqliteLoadedOnlyWhenOpened: true,
      },
      transport: {
        routes: [
          "GET /v1/sources/:sourceKey",
          "PUT /v1/sources/:sourceKey",
          "GET /v1/bundles/:revision",
          "PUT /v1/bundles/:revision",
          "GET /v1/channels/:channelName",
          "PUT /v1/channels/:channelName",
        ],
        injectAndListenShareApplication: true,
        listenerAddress: "127.0.0.1",
        networkListenerUsedByBuiltRuntimeReceipt: false,
        fixedLoopbackListenerUsedByFocusedLifecycleCase: true,
        finiteTimeouts: runtimeReceipt.transportLimits,
        contentType: "application/json",
        exactIdentifierGrammar: "^[a-z][a-z0-9-]{0,63}$",
      },
      officialSource: runtimeReceipt.officialSource,
      immutableBundles: {
        first: runtimeReceipt.invalidBundles.first,
        second: runtimeReceipt.invalidBundles.second,
        integrityOrPreflightImpliedByStorage: false,
        exactM07T01FirstWriterSemanticsRetained: true,
      },
      mutableChannel: runtimeReceipt.channel,
      concurrencyAndRestart: {
        sourceTwoInstanceCas: runtimeReceipt.officialSource.twoInstanceCas,
        channelTwoInstanceCas: runtimeReceipt.channel.twoInstanceCas,
        persistence: runtimeReceipt.persistence,
        identicalCurrentGenerationDoesNotAdvance: true,
        staleEvenWhenProposedValueMatchesWinner: true,
      },
      security: runtimeReceipt.security,
      separation: runtimeReceipt.separation,
      implementation,
      registrations,
      traceRows,
      coverageTransitions: {
        normativeN019: "TESTED",
        proofMatrixP12: "NOT_PROVEN",
        findingPF074: "OPEN_WITH_LOCAL_PROFILE",
      },
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T05 stores and distributes candidates; it does not authenticate a Bundle for runtime use.",
      "A mutable channel is a discovery pointer and is never an active, staged, committed, recovered, or previous-good revision.",
      "M07-T06 still owns staged runtime indexes and active/staged state separation.",
      "M07-T07 still owns one durable transactional activeRevision and previousGoodRevision record.",
      "M07-T08 through M07-T10 still own restart recovery, fault injection, invalid-candidate rejection, concurrent activation, and last-known-good behavior.",
      "M07-T11 still owns channel consumption by the separately built reference host.",
      "The built child runtime receipt uses Fastify injection; one focused lifecycle case opens only fixed loopback, and neither claims reverse-proxy, TLS, remote, public-service, or multi-tenant deployment behavior.",
      "The local bearer token profile does not define public credential issuance, rotation, revocation, or desen.run service authentication.",
      "P-12 remains NOT_PROVEN until the later staging, atomic activation, and recovery tasks close the full chain.",
      "The current application surface is Web-first; native targets still require separately reviewed adapters and host integrations.",
    ],
    reproduction: [
      "pnpm verify:control-plane-reference-preflight",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:local-api",
      "node scripts/generate-control-plane-local-api-proof.mjs",
      "node scripts/verify-control-plane-local-api.mjs",
      "node --test tests/control-plane-local-api.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    runtimeReceipt,
  });
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactMentions = [
    ...document.matchAll(new RegExp(ARTIFACT.replaceAll(".", "\\."), "gu")),
  ];
  const hashMentions = [...document.matchAll(new RegExp(`sha256:${artifactSha256}`, "gu"))];
  return (
    artifactMentions.length === 1 &&
    hashMentions.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

function captureProofDocument(value) {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_AUTHORITY_BYTES) {
    fail("INVALID_OPTIONS", "proofDocument must be a bounded primitive string.");
  }
  return value;
}

export async function verifyControlPlaneLocalApiEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set([
      "artifactBytes",
      "artifactPath",
      "prerequisiteBytes",
      "proofDocument",
      "proofDocumentPath",
      "runtimeReceipt",
      "trackedFileBytes",
    ]),
    "verify options",
  );
  const built = await buildControlPlaneLocalApiEvidence({
    ...(captured.prerequisiteBytes === undefined
      ? {}
      : { prerequisiteBytes: captured.prerequisiteBytes }),
    ...(captured.runtimeReceipt === undefined ? {} : { runtimeReceipt: captured.runtimeReceipt }),
    ...(captured.trackedFileBytes === undefined
      ? {}
      : { trackedFileBytes: captured.trackedFileBytes }),
  });
  const artifactPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  const proofDocumentPath = captureOptionalPath(captured.proofDocumentPath, "proofDocumentPath");
  const artifactBytes =
    captured.artifactBytes === undefined
      ? await safeReadAbsolute(
          artifactPath === undefined ? DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T05 evidence artifact is not reproducible.");
  }
  const proofDocument =
    captured.proofDocument === undefined
      ? fatalText(
          await safeReadAbsolute(
            proofDocumentPath === undefined ? path.join(ROOT, PROOF_DOCUMENT) : proofDocumentPath,
          ),
          PROOF_DOCUMENT,
        )
      : captureProofDocument(captured.proofDocument);
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail("PROOF_PIN_DRIFT", "The proof document does not contain one exact final artifact pin.");
  }
  return Object.freeze({
    task: "M07-T05",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
  });
}

export async function writeControlPlaneLocalApiEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["artifactPath", "beforeAtomicRename"]),
    "write options",
  );
  const requestedPath = captureOptionalPath(captured.artifactPath, "artifactPath");
  if (
    captured.beforeAtomicRename !== undefined &&
    typeof captured.beforeAtomicRename !== "function"
  ) {
    fail("INVALID_OPTIONS", "beforeAtomicRename must be a function when supplied.");
  }
  const built = await buildControlPlaneLocalApiEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_LOCAL_API_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T05 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
