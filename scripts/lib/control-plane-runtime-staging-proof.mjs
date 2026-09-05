import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import {
  readCheckpointedFrozenArtifact,
  verifyProofReaderCheckpoints,
} from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-STAGING.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const NORMATIVE_COVERAGE = "docs/proof/NORMATIVE-COVERAGE.md";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/runtime-staging-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/runtime-staging-internal.ts`;
const APP_IMPLEMENTATION = `${APP_DIRECTORY}/src/runtime-staging.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/runtime-staging.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-staging.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-staging-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-staging.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-staging-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-staging.test.mjs";
const BUNDLE_FIXTURE = "examples/sign-in/official-derived.bundle.desen.json";
const CATALOG_FIXTURE = "packages/reference-catalog-web/catalog.json";
const CATALOG_DISTRIBUTION = "packages/reference-catalog-web/dist";

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
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

const EXPECTED_PROTOCOL = "0.1.0";
const EXPECTED_REVISION = "sha256:6e539a76ddd0bc9b4eff82e73508b62a3980ae5dbc73dd85ccf0c1cae6957e13";
const EXPECTED_PACKAGE_ID = "run.desen.reference.sign-in";
const EXPECTED_PACKAGE_VERSION = "0.1.0";
const EXPECTED_TARGET = "web-react";
const EXPECTED_PACKAGE_DIGEST =
  "sha256:d4a4e7e2ea2d68ab8bff085d90e093f2d31b784f0f2fb089c6422ce33914b051";
const EXPECTED_ARTIFACT_COUNT = 80;
const EXPECTED_DISTRIBUTION_BYTES = 243_740;
const EXPECTED_PUBLIC_EXPORT_COUNT = 85;
const EXPECTED_PUBLIC_RUNTIME_EXPORT_COUNT = 28;
const EXPECTED_TSDOC_EXPORT_COUNT = 13;
const EXPECTED_PUBLIC_RUNTIME_KEYS = Object.freeze([
  "BUNDLE_INTEGRITY_LIMITS",
  "BUNDLE_PACKAGE_PREFLIGHT_LIMITS",
  "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
  "BUNDLE_RUNTIME_STAGING_LIMITS",
  "BundleStoreError",
  "INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE",
  "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
  "INVALID_INSTALLED_PACKAGE_CODE",
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
  "RUNTIME_STAGING_INTERNAL_FAILURE_CODE",
  "RUNTIME_STAGING_LIMIT_EXCEEDED_CODE",
  "RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE",
  "SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE",
  "openBundleStore",
  "openLocalControlPlane",
  "preflightBundlePackages",
  "preflightBundleReferences",
  "stageBundleRuntime",
  "verifyBundleStoreEntry",
]);

const EXPECTED_LIMITS = Object.freeze({
  maxPackages: 256,
  maxArtifactEntries: 256 * 1_024,
  maxArtifactBytes: 64 * 1_024 * 1_024,
  maxCapabilityEntries: 100_000,
  maxSurfaces: 256,
  maxSourceNodes: 25_000,
  maxStateEntries: 25_000,
  maxBehaviors: 25_000,
  maxHandlerPrograms: 25_000,
  maxResourceAliases: 25_000,
  maxOperationAliases: 25_000,
  maxRuntimeValidationObligations: 4_096,
  maxRuntimeObligationPointerCodeUnits: 4_096,
  maxAggregateRuntimeObligationCodeUnits: 1_048_576,
});

const EXPECTED_PACKAGES = Object.freeze([
  Object.freeze({
    id: EXPECTED_PACKAGE_ID,
    version: EXPECTED_PACKAGE_VERSION,
    target: EXPECTED_TARGET,
    packageDigest: EXPECTED_PACKAGE_DIGEST,
    artifactCount: EXPECTED_ARTIFACT_COUNT,
    artifactByteLength: EXPECTED_DISTRIBUTION_BYTES,
    componentCount: 5,
    behaviorCount: 0,
    operationCount: 1,
    resourceCount: 0,
  }),
]);

const EXPECTED_SURFACES = Object.freeze([
  Object.freeze({
    id: "home",
    sourceNodeCount: 2,
    behaviorCount: 0,
    handlerProgramCount: 0,
    stateEntryCount: 0,
    resourceAliasCount: 0,
    operationAliasCount: 0,
  }),
  Object.freeze({
    id: "sign-in",
    sourceNodeCount: 6,
    behaviorCount: 0,
    handlerProgramCount: 3,
    stateEntryCount: 2,
    resourceAliasCount: 0,
    operationAliasCount: 1,
  }),
]);

const TRACE_IDS = Object.freeze(["PIPE-006", "PIPE-015", "R-124", "R-126", "R-127"]);
const NORMATIVE_COVERAGE_EXPECTATIONS = Object.freeze([
  Object.freeze({
    id: "N-038",
    status: "PLANNED",
    contribution:
      "M07-T06 authenticates the exact immutable M07-T03 Catalog identity and exact T03 Bundle input, retains only a canonically and revision-identical execution-validated Bundle snapshot, re-closes copied artifact bytes, and builds bounded callback-free staged indexes without active-state mutation.",
  }),
  Object.freeze({
    id: "N-041",
    status: "PLANNED",
    contribution:
      "M07-T06 adds one immutable 14-field Runtime Staging Profile with exact-boundary or executable dominance coverage for every field; overflow rejects the complete candidate without truncation or partial authority.",
  }),
]);
const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "stages the exact official package snapshot as callback-free active-separated authority",
  "retains exact execution identity, staged byte copies, indexes, and sorted obligations privately",
  "stages from the T03-owned copies after caller artifact mutation",
  "rejects package-private byte drift before creating staged authority",
  "rejects forged authorities before observing any staging port",
  "keeps the T04 reference branch parallel while rejecting static execution-contract drift",
  "rejects execution Catalog contract drift without retaining partial package plans",
  "redacts thrown and disagreeing trusted execution ports as internal rejection",
  "copies trusted rejection diagnostics and fails closed on malformed diagnostic data",
  "creates independent deterministic candidates without a mutable global staged or active slot",
  "indexes nonzero behavior and resource contracts, instances, handlers, and aliases exactly",
  "rejects exact lower staging ceilings without returning truncated indexes",
  "fails closed when runtime-core cannot prepare one otherwise trusted handler program",
]);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "A staged candidate is not an active revision record.",
  "Previous-good state belongs to the later durable activation record.",
  "Staging exposes no durable generation.",
  "Exact artifact bytes remain package-private.",
  "Artifact paths remain package-private load-plan data.",
  "Staging cannot commit or activate itself.",
  "Public staged metadata is immutable.",
  "Public package summaries are immutable.",
  "A rejected staging result carries no partial authority.",
  "Integrity authority cannot bypass exact package preflight.",
  "T04 is a parallel reference branch, not the T06 staging input.",
  "A mutable channel record is discovery metadata, not staging authority.",
  "The staging brand cannot be manufactured structurally.",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T06 artifact and official staging receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in all five direct prerequisite artifacts",
  "[implementation] rejects staging authority, snapshot, index, or delegation drift",
  "[registration] rejects package-root, package-script, aggregate, or CI tuple drift",
  "[traceability] rejects exact trace owners and normative coverage rows",
  "[runtime] rejects changed identity, index, active-separation, or mutation receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[platform] rejects public-export, TSDoc, platform-boundary, or loader-authority drift",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest activation nonclaims",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node scripts/generate-control-plane-runtime-staging-proof.mjs",
  verify:
    "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node scripts/verify-control-plane-runtime-staging.mjs",
  test: "pnpm verify:control-plane-local-api && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-staging && node --test tests/control-plane-runtime-staging.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-runtime-staging",
  "scripts/verify-control-plane-runtime-staging.mjs",
  "tests/control-plane-runtime-staging.test.mjs",
]);

export const CONTROL_PLANE_RUNTIME_STAGING_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T03",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
    sha256: "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T05",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
  }),
  Object.freeze({
    task: "M02-T11",
    path: "docs/proof/artifacts/protocol-0.1.0-execution-contracts.json",
    sha256: "f7dc050b8a9e4e5d9ec2531312ca3ad68d0d03c46bda5c44ebf930884554f505",
  }),
  Object.freeze({
    task: "M04-T13",
    path: "docs/proof/artifacts/runtime-core-0.1.0-action-turns.json",
    sha256: "5b2f95b897116fdd9ff5320d8720e104d7b93f148d28bfcaf067c838785f9d87",
  }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTRACT,
  APP_INTERNAL,
  APP_IMPLEMENTATION,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
]);
export const DEFAULT_CONTROL_PLANE_RUNTIME_STAGING_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneRuntimeStagingEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeStagingEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeStagingEvidenceError(code, message, details);
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
    if (error instanceof ControlPlaneRuntimeStagingEvidenceError) throw error;
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
    if (error instanceof ControlPlaneRuntimeStagingEvidenceError) throw error;
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
    if (error instanceof ControlPlaneRuntimeStagingEvidenceError) throw error;
    fail("AUTHORITY_PARSE_FAILURE", `${label} is not valid JSON.`);
  }
}

function frozenReceiptMap(receipts, expectedPaths, label) {
  const paths = [...new Set(expectedPaths)].sort();
  if (!Array.isArray(receipts) || receipts.length !== paths.length) {
    fail("ARTIFACT_DRIFT", `The authenticated ${label} receipt inventory drifted.`);
  }
  const byPath = new Map();
  for (const receipt of receipts) {
    if (
      receipt === null ||
      typeof receipt !== "object" ||
      Array.isArray(receipt) ||
      typeof receipt.path !== "string" ||
      !Number.isSafeInteger(receipt.bytes) ||
      receipt.bytes <= 0 ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256) ||
      byPath.has(receipt.path)
    ) {
      fail("ARTIFACT_DRIFT", `The authenticated ${label} contains an invalid receipt.`);
    }
    byPath.set(receipt.path, Object.freeze({ bytes: receipt.bytes, sha256: receipt.sha256 }));
  }
  if (JSON.stringify([...byPath.keys()].sort()) !== JSON.stringify(paths)) {
    fail("ARTIFACT_DRIFT", `The authenticated ${label} path set drifted.`);
  }
  return byPath;
}

async function authenticatedFrozenArtifactProjection() {
  await verifyProofReaderCheckpoints();
  const frozen = await readCheckpointedFrozenArtifact("M07-T06");
  if (frozen.path !== ARTIFACT) {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T06 artifact path drifted.");
  }
  const artifact = parseJsonBytes(frozen.bytes, ARTIFACT);
  if (artifact.schemaVersion !== 1 || artifact.task !== "M07-T06" || artifact.result !== "PASS") {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T06 artifact identity drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(frozen.bytes),
    artifactSha256: frozen.sha256,
  });
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

function executableLimitFields(source, relativePath) {
  const sourceFile = parseTypescript(source, relativePath);
  const expected = new Set(Object.keys(EXPECTED_LIMITS));
  const observed = new Set();
  const observe = (name) => {
    if (expected.has(name)) observed.add(name);
  };
  const visit = (node) => {
    if (ts.isStringLiteral(node)) observe(node.text);
    if (ts.isPropertyAccessExpression(node)) observe(node.name.text);
    if (
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
    ) {
      observe(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze(Object.keys(EXPECTED_LIMITS).filter((field) => observed.has(field)));
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
  const frozenInventory = inventory.filter(
    ({ module }) => !module.startsWith("./runtime-activation"),
  );
  const staging = frozenInventory.filter(({ module }) => module.startsWith("./runtime-staging"));
  const expectedStaging = [
    ["BUNDLE_RUNTIME_STAGING_LIMITS", "./runtime-staging-contract.js", false],
    ["BundleRuntimeStagingAuthority", "./runtime-staging-contract.js", true],
    ["BundleRuntimeStagingDiagnostic", "./runtime-staging-contract.js", true],
    ["BundleRuntimeStagingLimits", "./runtime-staging-contract.js", true],
    ["BundleRuntimeStagingResult", "./runtime-staging-contract.js", true],
    ["BundleRuntimeStagingStage", "./runtime-staging-contract.js", true],
    ["INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY_CODE", "./runtime-staging-contract.js", false],
    ["RUNTIME_STAGING_INTERNAL_FAILURE_CODE", "./runtime-staging-contract.js", false],
    ["RUNTIME_STAGING_LIMIT_EXCEEDED_CODE", "./runtime-staging-contract.js", false],
    ["RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH_CODE", "./runtime-staging-contract.js", false],
    ["stageBundleRuntime", "./runtime-staging.js", false],
    ["StagedRuntimePackageSummary", "./runtime-staging-contract.js", true],
    ["StagedRuntimeSurfaceSummary", "./runtime-staging-contract.js", true],
  ].map(([exported, module, typeOnly]) => ({
    imported: exported,
    exported,
    module,
    typeOnly,
  }));
  expectedStaging.sort((left, right) => {
    const byName = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  if (
    frozenInventory.length !== EXPECTED_PUBLIC_EXPORT_COUNT ||
    frozenInventory.filter(({ typeOnly }) => !typeOnly).length !==
      EXPECTED_PUBLIC_RUNTIME_EXPORT_COUNT ||
    JSON.stringify(staging) !== JSON.stringify(expectedStaging) ||
    frozenInventory.some(({ exported }) =>
      [
        "readBundleRuntimeStagingAuthority",
        "isBundleRuntimeStagingAuthority",
        "stageBundleRuntimeInternal",
        "RuntimeStagingPorts",
      ].includes(exported),
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T06 public package-root inventory drifted.");
  }
  return deepFreeze(frozenInventory);
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

function assertAggregateAdjacency(script, predecessor, current) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const predecessorIndex = commands.indexOf(predecessor);
  const currentIndex = commands.indexOf(current);
  if (
    predecessorIndex < 0 ||
    currentIndex !== predecessorIndex + 1 ||
    commands.lastIndexOf(predecessor) !== predecessorIndex ||
    commands.lastIndexOf(current) !== currentIndex
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T06 aggregate tail drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_RUNTIME_STAGING_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "A direct M07-T06 prerequisite artifact drifted.", {
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

async function trackedFileReceipts(overrides, frozenReceipts) {
  const projection = frozenReceiptMap(frozenReceipts, TRACKED_TASK_FILES, "tracked-file");
  return Object.freeze(
    await Promise.all(
      TRACKED_TASK_FILES.map(async (relativePath) => {
        const bytes = await authorityBytes(relativePath, overrides);
        const frozenReceipt = Object.hasOwn(overrides, relativePath)
          ? undefined
          : projection.get(relativePath);
        return Object.freeze({
          path: relativePath,
          bytes: frozenReceipt?.bytes ?? bytes.byteLength,
          sha256: frozenReceipt?.sha256 ?? sha256(bytes),
        });
      }),
    ),
  );
}

async function fixtureReceipts(overrides) {
  return Object.freeze(
    await Promise.all(
      [
        Object.freeze({ role: "officialDerivedBundle", path: BUNDLE_FIXTURE }),
        Object.freeze({ role: "currentWebReactCatalog", path: CATALOG_FIXTURE }),
      ].map(async (fixture) => {
        const bytes = await authorityBytes(fixture.path, overrides);
        return Object.freeze({ ...fixture, bytes: bytes.byteLength, sha256: sha256(bytes) });
      }),
    ),
  );
}

async function distributionReceipts(frozenReceipts) {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const observed = (await readdir(distDirectory))
    .filter((name) => name.startsWith("runtime-staging") || name.startsWith("index."))
    .sort();
  const suffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];
  const expected = [
    "index",
    "runtime-staging",
    "runtime-staging-contract",
    "runtime-staging-internal",
  ]
    .flatMap((base) => suffixes.map((suffix) => `${base}${suffix}`))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The exact M07-T06 built distribution inventory drifted.", {
      observed,
    });
  }
  const relativePaths = observed.map((name) => `${APP_DIRECTORY}/dist/${name}`);
  const projection = frozenReceiptMap(frozenReceipts, relativePaths, "distribution");
  return Object.freeze(
    await Promise.all(
      observed.map(async (name) => {
        const relativePath = `${APP_DIRECTORY}/dist/${name}`;
        await safeReadAbsolute(path.join(ROOT, relativePath));
        const frozenReceipt = projection.get(relativePath);
        return Object.freeze({
          path: relativePath,
          bytes: frozenReceipt.bytes,
          sha256: frozenReceipt.sha256,
        });
      }),
    ),
  );
}

async function registrationProjection(overrides) {
  const [appPackageBytes, appIndexBytes, rootPackageBytes, ciBytes, inventoryBytes] =
    await Promise.all([
      authorityBytes(APP_PACKAGE, overrides),
      authorityBytes(APP_INDEX, overrides),
      authorityBytes(ROOT_PACKAGE, overrides),
      authorityBytes(CI_SOURCE, overrides),
      authorityBytes(CI_INVENTORY, overrides),
    ]);
  const appPackage = parseJsonBytes(appPackageBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootPackageBytes, ROOT_PACKAGE);
  const publicExports = publicExportInventory(fatalText(appIndexBytes, APP_INDEX), APP_INDEX);
  const dependencies = Object.fromEntries(
    Object.entries(appPackage.dependencies ?? {}).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  );
  const appProjection = {
    name: appPackage.name,
    main: appPackage.main,
    types: appPackage.types,
    exports: appPackage.exports?.["."],
    packageTest: appPackage.scripts?.["test:runtime-staging"],
    dependencies,
  };
  const expectedAppProjection = {
    name: "@desen/control-plane-api",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { types: "./dist/index.d.ts", import: "./dist/index.js" },
    packageTest: "vitest run test/runtime-staging.test.ts",
    dependencies: {
      "@desen/protocol": "workspace:*",
      "@desen/runtime-core": "workspace:*",
      "@desen/validator": "workspace:*",
      "better-sqlite3": "13.0.3",
      fastify: "5.12.2",
    },
  };
  if (JSON.stringify(appProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T06 package and dependency projection drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-runtime-staging"],
    verify: rootPackage.scripts?.["verify:control-plane-runtime-staging"],
    test: rootPackage.scripts?.["test:control-plane-runtime-staging"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact root M07-T06 commands drifted.");
  }
  assertAggregateAdjacency(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-local-api",
    "pnpm verify:control-plane-runtime-staging",
  );
  assertAggregateAdjacency(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-local-api",
    "pnpm test:control-plane-runtime-staging",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T06 modular-CI proof tuple drifted.");
  }
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "control-plane-local-api",
    aggregateTerminalTail: true,
    ciTuple: CI_TUPLE,
    ciTupleExactInRunnerAndInventory: true,
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
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T06"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T06 traceability authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

async function normativeCoverageProjection(overrides) {
  const source = fatalText(await authorityBytes(NORMATIVE_COVERAGE, overrides), NORMATIVE_COVERAGE);
  const rows = [];
  const evidenceSha256s = [];
  for (const expectation of NORMATIVE_COVERAGE_EXPECTATIONS) {
    const matchingLines = source
      .split("\n")
      .filter((line) => line.startsWith(`| ${expectation.id} |`));
    if (matchingLines.length !== 1) {
      fail("NORMATIVE_COVERAGE_DRIFT", `${expectation.id} must have one exact coverage row.`);
    }
    const cells = matchingLines[0].split("|").map((cell) => cell.trim());
    const owner = cells[4];
    const status = cells[5];
    const evidence = cells[6];
    const artifactPattern = new RegExp(
      `\`${ARTIFACT.replaceAll(".", "\\.")}\` \`sha256:([0-9a-f]{64})\``,
      "gu",
    );
    const evidenceMatches = [...evidence.matchAll(artifactPattern)];
    const observedStatuses = new Set(["PLANNED", "TESTED"]);
    if (
      cells.length !== 8 ||
      cells[1] !== expectation.id ||
      typeof owner !== "string" ||
      !owner.includes("M07-T06") ||
      !observedStatuses.has(status) ||
      typeof evidence !== "string" ||
      evidenceMatches.length !== 1
    ) {
      fail(
        "NORMATIVE_COVERAGE_DRIFT",
        `${expectation.id} lost its exact M07-T06 owner, status, contribution, or evidence pin.`,
      );
    }
    rows.push(
      Object.freeze({
        id: expectation.id,
        owner: "M07-T06",
        status: expectation.status,
        contribution: expectation.contribution,
        evidencePath: ARTIFACT,
      }),
    );
    evidenceSha256s.push(evidenceMatches[0][1]);
  }
  return deepFreeze({ rows, evidenceSha256s });
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, typeBytes, rootBytes] = await Promise.all([
    authorityBytes(APP_RUNTIME_TEST, overrides),
    authorityBytes(APP_TYPE_TEST, overrides),
    authorityBytes(ROOT_TEST, overrides),
  ]);
  const runtimeSource = fatalText(runtimeBytes, APP_RUNTIME_TEST);
  const runtimeNames = registeredTestNames(runtimeSource, APP_RUNTIME_TEST, ["it", "test"]);
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  const limitFields = executableLimitFields(runtimeSource, APP_RUNTIME_TEST);
  const expectedLimitFields = Object.freeze(Object.keys(EXPECTED_LIMITS));
  const nonzeroIndexCaseName =
    "indexes nonzero behavior and resource contracts, instances, handlers, and aliases exactly";
  if (
    JSON.stringify(runtimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES) ||
    JSON.stringify(limitFields) !== JSON.stringify(expectedLimitFields) ||
    runtimeNames.filter((name) => name === nonzeroIndexCaseName).length !== 1
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T06 focused or mutation-test authority drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: runtimeNames.length,
    packageRuntimeCaseNames: runtimeNames,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
    executableLimitFieldCount: limitFields.length,
    executableLimitFields: limitFields,
    nonzeroBehaviorResourceIndexCaseName: nonzeroIndexCaseName,
  });
}

function sourceBoundaryProjection(sourceByPath) {
  const allowedModules = [
    "@desen/protocol",
    "@desen/runtime-core",
    "@desen/validator",
    "node:util",
    "./package-preflight-contract.js",
    "./package-preflight-internal.js",
    "./package-preflight-web-react.js",
    "./runtime-staging-contract.js",
    "./runtime-staging-internal.js",
  ].sort();
  const observedModules = new Set();
  const forbiddenIdentifiers = new Set([
    "document",
    "window",
    "navigator",
    "HTMLElement",
    "WebSocket",
    "Worker",
    "fetch",
    "eval",
    "require",
  ]);
  const forbiddenPublicFields = new Set([
    "activeRevision",
    "previousGoodRevision",
    "generation",
    "load",
    "loader",
    "commit",
    "activate",
    "rollback",
    "channel",
    "hostPorts",
  ]);
  let exportedWithTsdoc = 0;
  for (const [relativePath, source] of Object.entries(sourceByPath)) {
    const sourceFile = parseTypescript(source, relativePath, "PLATFORM_BOUNDARY_DRIFT");
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        observedModules.add(node.moduleSpecifier.text);
      }
      if (
        node.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text))
      ) {
        fail("PLATFORM_BOUNDARY_DRIFT", "Runtime staging gained active platform or loader code.");
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (relativePath !== APP_INTERNAL) {
      for (const statement of sourceFile.statements) {
        if (statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.ExportKeyword)) {
          if (ts.getJSDocCommentsAndTags(statement).length === 0) {
            fail("PLATFORM_BOUNDARY_DRIFT", "A public M07-T06 export lost TSDoc authority.");
          }
          exportedWithTsdoc += 1;
        }
      }
    }
  }
  const contractFile = parseTypescript(sourceByPath[APP_CONTRACT], APP_CONTRACT);
  const publicFields = [];
  const visitContract = (node) => {
    if ((ts.isPropertySignature(node) || ts.isMethodSignature(node)) && node.name !== undefined) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      if (name !== "") publicFields.push(name);
    }
    ts.forEachChild(node, visitContract);
  };
  visitContract(contractFile);
  if (
    JSON.stringify([...observedModules].sort()) !== JSON.stringify(allowedModules) ||
    exportedWithTsdoc !== EXPECTED_TSDOC_EXPORT_COUNT ||
    publicFields.some((field) => forbiddenPublicFields.has(field))
  ) {
    fail("PLATFORM_BOUNDARY_DRIFT", "The M07-T06 import, TSDoc, or authority boundary drifted.");
  }
  return deepFreeze({
    allowedModules,
    observedModules: [...observedModules].sort(),
    exportedWithTsdoc,
    explicitAnyCount: Object.entries(sourceByPath).reduce(
      (total, [relativePath, source]) => total + explicitAnyCount(source, relativePath),
      0,
    ),
    reactDomCssBrowserOrAppImports: false,
    dynamicImportFetchEvalRequireOrWorker: false,
    forbiddenActiveOrLoaderPublicFields: false,
  });
}

async function implementationProjection(overrides) {
  const [contractBytes, internalBytes, implementationBytes] = await Promise.all([
    authorityBytes(APP_CONTRACT, overrides),
    authorityBytes(APP_INTERNAL, overrides),
    authorityBytes(APP_IMPLEMENTATION, overrides),
  ]);
  const contract = fatalText(contractBytes, APP_CONTRACT);
  const internal = fatalText(internalBytes, APP_INTERNAL);
  const implementation = fatalText(implementationBytes, APP_IMPLEMENTATION);
  const requiredAuthorities = [
    [contract, "export const BUNDLE_RUNTIME_STAGING_LIMITS", 1],
    [contract, "readonly stagedRevision: string;", 1],
    [contract, "readonly runtimeObligationCount: number;", 1],
    [internal, "readBundlePackagePreflightAuthority(packageAuthority)", 1],
    [internal, "const AUTHORITIES = new WeakMap<", 1],
    [internal, "calculatePackageDigest: calculateWebReactPackageDigest", 1],
    [internal, "validateExecutionCatalogSet: validateDesenExecutionCatalogSet", 1],
    [internal, "validateBundleExecutionContracts: validateDesenBundleExecutionContracts", 1],
    [internal, "prepareActionProgram: prepareRuntimeActionProgram", 1],
    [internal, "new Uint8Array(artifact.bytes)", 1],
    [internal, "readBundleRuntimeStagingAuthority", 2],
    [internal, "export function readStagedRuntimeArtifactBytes", 1],
    [implementation, "stageBundleRuntimeInternal(authority)", 1],
  ];
  if (
    requiredAuthorities.some(
      ([source, authority, count]) => source.split(authority).length - 1 !== count,
    )
  ) {
    fail("IMPLEMENTATION_DRIFT", "The staging identity, snapshot, index, or delegation drifted.");
  }
  const platform = sourceBoundaryProjection({
    [APP_CONTRACT]: contract,
    [APP_INTERNAL]: internal,
    [APP_IMPLEMENTATION]: implementation,
  });
  if (platform.explicitAnyCount !== 0) {
    fail("IMPLEMENTATION_DRIFT", "The M07-T06 implementation gained explicit any authority.");
  }
  return deepFreeze({
    packageAuthority: "readBundlePackagePreflightAuthority exact object identity",
    stagedAuthorityIdentity: "package-private WeakMap",
    packageSnapshots:
      "exact immutable T03 Catalog identity, canonically and revision-identical execution-validated Bundle snapshot, and independent artifact-byte/runtime-index copies",
    executionCatalogs: "validateDesenExecutionCatalogSet over exact T03 catalog authority",
    executionContracts:
      "validateDesenBundleExecutionContracts receives the exact T03 Bundle and stages only canonically and revision-identical validated output",
    actionPrograms: "prepareRuntimeActionProgram before activation",
    failureMode: "one terminal rejection without partial or active authority",
    activeStateMutation: false,
    executableLoaderAuthority: false,
    platform,
  });
}

async function listDistributionArtifacts() {
  const paths = [];
  async function visit(relativeDirectory) {
    const absoluteDirectory = path.join(ROOT, CATALOG_DISTRIBUTION, relativeDirectory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const relative = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        fail("UNSAFE_AUTHORITY", "The runtime package distribution contains a symbolic link.");
      }
      if (entry.isDirectory()) await visit(relative);
      else if (entry.isFile()) paths.push(relative);
      else fail("UNSAFE_AUTHORITY", "The runtime package distribution contains a special file.");
    }
  }
  await visit("");
  return Object.freeze(
    await Promise.all(
      paths.map(async (relative) =>
        Object.freeze({
          path: `dist/${relative}`,
          bytes: await safeReadAbsolute(path.join(ROOT, CATALOG_DISTRIBUTION, relative)),
        }),
      ),
    ),
  );
}

function requireAuthority(result, status, label) {
  if (result?.status !== status || result.authority === undefined) {
    fail("RUNTIME_PROBE_FAILED", `${label} did not produce exact authority.`);
  }
  return result.authority;
}

function rejectionReceipt(result) {
  return deepFreeze({
    status: result.status,
    stage: result.stage,
    codes: Array.isArray(result.diagnostics) ? result.diagnostics.map(({ code }) => code) : [],
    resultFrozen: Object.isFrozen(result),
    diagnosticsFrozen: Object.isFrozen(result.diagnostics),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  });
}

function publicGraphHasForbiddenAuthority(value) {
  const forbidden = new Set([
    "activeRevision",
    "previousGoodRevision",
    "generation",
    "bundle",
    "catalogSet",
    "artifacts",
    "artifactPaths",
    "load",
    "loader",
    "commit",
    "activate",
    "rollback",
    "channel",
    "hostPorts",
  ]);
  const pending = [value];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (forbidden.has(key) || typeof child === "function") return true;
      pending.push(child);
    }
  }
  return false;
}

async function runControlPlaneRuntimeStagingProbe() {
  const [
    controlPlane,
    packageInternal,
    stagingInternal,
    webReact,
    protocol,
    bundleBytes,
    catalogBytes,
    artifacts,
  ] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href),
    import(
      pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-internal.js")).href
    ),
    import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-staging-internal.js")).href),
    import(
      pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-web-react.js")).href
    ),
    import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
    safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
    safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE)),
    listDistributionArtifacts(),
  ]);
  const bundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
  const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);

  const packageAuthorityFor = (
    candidateArtifacts = artifacts,
    candidateBundle = bundle,
    candidateCatalog = catalog,
  ) => {
    const integrity = controlPlane.verifyBundleStoreEntry(
      {
        revision: candidateBundle.revision,
        bytes: protocol.canonicalizeJsonBytes(candidateBundle),
      },
      { status: "not-available" },
    );
    const integrityAuthority = requireAuthority(integrity, "verified", "Integrity probe");
    const packageResult = controlPlane.preflightBundlePackages(integrityAuthority, [
      Object.freeze({
        id: candidateCatalog.id,
        version: candidateCatalog.version,
        target: candidateCatalog.target,
        catalog: candidateCatalog,
        artifacts: candidateArtifacts,
      }),
    ]);
    return {
      integrity,
      packageResult,
      authority: requireAuthority(packageResult, "preflighted", "Package preflight probe"),
    };
  };

  const official = packageAuthorityFor();
  const reference = controlPlane.preflightBundleReferences(official.authority);
  const first = controlPlane.stageBundleRuntime(official.authority);
  const firstAuthority = requireAuthority(first, "staged", "Runtime staging probe");
  const firstRecord = stagingInternal.readBundleRuntimeStagingAuthority(firstAuthority);
  const packageRecord = packageInternal.readBundlePackagePreflightAuthority(official.authority);
  if (firstRecord === undefined || packageRecord === undefined) {
    fail("RUNTIME_PROBE_FAILED", "Private staging authority was not retained.");
  }
  const second = controlPlane.stageBundleRuntime(official.authority);
  const secondAuthority = requireAuthority(second, "staged", "Second staging probe");

  const callerArtifacts = artifacts.map((artifact) =>
    Object.freeze({ path: artifact.path, bytes: new Uint8Array(artifact.bytes) }),
  );
  const callerOwned = packageAuthorityFor(callerArtifacts);
  callerArtifacts[0].bytes.fill(0);
  const callerMutationResult = controlPlane.stageBundleRuntime(callerOwned.authority);

  const drifted = packageAuthorityFor();
  const driftedRecord = packageInternal.readBundlePackagePreflightAuthority(drifted.authority);
  const driftedByte = driftedRecord?.packages?.[0]?.artifacts?.[0]?.bytes;
  if (driftedByte === undefined) fail("RUNTIME_PROBE_FAILED", "Snapshot drift probe is absent.");
  driftedByte[0] = (driftedByte[0] ?? 0) ^ 0xff;
  const snapshotDriftResult = controlPlane.stageBundleRuntime(drifted.authority);

  const indexedCatalog = structuredClone(catalog);
  indexedCatalog.behaviors["com.example.interactions/Observe"] = {
    propsSchema: { type: "object", additionalProperties: false },
    attachTo: { categories: ["layout"] },
    events: {
      observed: { payloadSchema: { type: "object", additionalProperties: false } },
    },
  };
  indexedCatalog.resources["com.example.account/profile"] = {
    inputSchema: { type: "object", additionalProperties: false },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string" } },
    },
    errors: [],
    policies: ["manual"],
  };
  const indexedDigest = webReact.calculateWebReactPackageDigest(
    indexedCatalog,
    artifacts,
    EXPECTED_LIMITS.maxArtifactBytes,
  );
  indexedCatalog.packageDigest = indexedDigest.packageDigest;
  const indexedBundle = structuredClone(bundle);
  indexedBundle.requires.catalogs[0].digest = indexedDigest.packageDigest;
  indexedBundle.surfaces.home.root.behaviors = [
    {
      id: "home.observe",
      use: "com.example.interactions/Observe",
      on: { observed: [] },
    },
  ];
  indexedBundle.surfaces.home.resources.profile = {
    use: "com.example.account/profile",
    input: {},
    policy: "manual",
  };
  indexedBundle.revision = protocol.calculateDesenBundleRevision(indexedBundle);
  const indexedPackage = packageAuthorityFor(artifacts, indexedBundle, indexedCatalog);
  const indexedResult = controlPlane.stageBundleRuntime(indexedPackage.authority);
  const indexedAuthority = requireAuthority(indexedResult, "staged", "Indexed staging probe");
  const indexedRecord = stagingInternal.readBundleRuntimeStagingAuthority(indexedAuthority);
  if (indexedRecord === undefined) {
    fail("RUNTIME_PROBE_FAILED", "Nonzero behavior/resource indexes were not retained.");
  }
  const indexedBehaviorKey = protocol.canonicalizeJson(["home.layout", "home.observe"]);
  const indexedHandlerKey = protocol.canonicalizeJson([
    "behavior",
    "home.layout",
    "home.observe",
    "observed",
  ]);

  let forgedObservations = 0;
  const forgedAuthority = new Proxy(Object.freeze({ ...official.authority }), {
    get() {
      forgedObservations += 1;
      throw new Error("forged authority must not be inspected");
    },
    ownKeys() {
      forgedObservations += 1;
      throw new Error("forged authority must not be inspected");
    },
  });
  const forgedResult = controlPlane.stageBundleRuntime(forgedAuthority);
  const activeState = Object.freeze({
    activeRevision: `sha256:${"a".repeat(64)}`,
    previousGoodRevision: null,
    generation: 4,
  });
  const activeBefore = JSON.stringify(activeState);
  controlPlane.stageBundleRuntime(official.authority);

  const stagedArtifact = firstRecord.packages[0]?.artifacts[0];
  const packageArtifact = packageRecord.packages[0]?.artifacts[0];
  const firstStagedBytes = stagingInternal.readStagedRuntimeArtifactBytes(stagedArtifact);
  const secondStagedBytes = stagingInternal.readStagedRuntimeArtifactBytes(stagedArtifact);
  const artifactCopied =
    firstStagedBytes !== undefined &&
    firstStagedBytes !== packageArtifact?.bytes &&
    Buffer.from(firstStagedBytes).equals(Buffer.from(packageArtifact?.bytes ?? []));
  firstStagedBytes?.fill(0);
  const thirdStagedBytes = stagingInternal.readStagedRuntimeArtifactBytes(stagedArtifact);
  const artifactCopiesIndependent =
    secondStagedBytes !== undefined &&
    thirdStagedBytes !== undefined &&
    secondStagedBytes !== thirdStagedBytes &&
    Buffer.from(secondStagedBytes).equals(Buffer.from(thirdStagedBytes));
  return deepFreeze({
    publicModuleKeys: Object.keys(controlPlane).sort(),
    limits: controlPlane.BUNDLE_RUNTIME_STAGING_LIMITS,
    requiredRuntimeExportsPresent:
      typeof controlPlane.stageBundleRuntime === "function" &&
      Object.isFrozen(controlPlane.BUNDLE_RUNTIME_STAGING_LIMITS),
    privateInternalExportsAbsent:
      !Object.hasOwn(controlPlane, "readBundleRuntimeStagingAuthority") &&
      !Object.hasOwn(controlPlane, "isBundleRuntimeStagingAuthority") &&
      !Object.hasOwn(controlPlane, "stageBundleRuntimeInternal"),
    packageInput: {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      packageDigest: catalog.packageDigest,
      distributionFiles: artifacts.length,
      distributionBytes: artifacts.reduce(
        (total, artifact) => total + artifact.bytes.byteLength,
        0,
      ),
      packageAuthorityAuthenticated: packageInternal.isBundlePackagePreflightAuthority(
        official.authority,
      ),
    },
    exactSuccess: {
      status: first.status,
      resultFrozen: Object.isFrozen(first),
      authorityPublicKeys: Object.keys(firstAuthority).sort(),
      authorityFrozen: Object.isFrozen(firstAuthority),
      profile: firstAuthority.profile,
      profileVersion: firstAuthority.profileVersion,
      protocolVersion: firstAuthority.protocolVersion,
      stagedRevision: firstAuthority.stagedRevision,
      documentId: firstAuthority.documentId,
      entrySurfaceId: firstAuthority.entrySurfaceId,
      packages: firstAuthority.packages,
      surfaces: firstAuthority.surfaces,
      runtimeObligationCount: firstAuthority.runtimeObligationCount,
      packagesFrozen: Object.isFrozen(firstAuthority.packages),
      surfacesFrozen: Object.isFrozen(firstAuthority.surfaces),
      authenticated: stagingInternal.isBundleRuntimeStagingAuthority(firstAuthority),
      recordFrozen: Object.isFrozen(firstRecord),
      predecessorExact: firstRecord.packageAuthority === official.authority,
      packageRecordExact: firstRecord.packageRecord === packageRecord,
      catalogSetExact: firstRecord.catalogSet === packageRecord.catalogSet,
      bundleCopied: firstRecord.bundle !== packageRecord.integrityRecord.bundle,
      artifactCopied,
      artifactCopiesIndependent,
      artifactDigestExact:
        stagedArtifact?.digest ===
        protocol.sha256Digest(packageArtifact?.bytes ?? new Uint8Array()),
      artifactByPathIdentity:
        stagedArtifact !== undefined &&
        firstRecord.packages[0]?.artifactByPath[stagedArtifact.path] === stagedArtifact,
      privatePackageCount: firstRecord.packages.length,
      privateSurfaceIds: Object.keys(firstRecord.surfaces),
      privateComponentIds: Object.keys(firstRecord.capabilities.components),
      privateOperationIds: Object.keys(firstRecord.capabilities.operations),
      privateHandlerSelectors: Object.keys(firstRecord.entrySurface.handlers),
      privateOperationAliases: { ...firstRecord.entrySurface.operationAliases },
      privateObligationKinds: firstRecord.obligations.map(({ kind }) => kind),
      privateObligationPointers: firstRecord.obligations.map(({ pointer }) => pointer),
      publicForbiddenAuthorityAbsent: !publicGraphHasForbiddenAuthority(firstAuthority),
    },
    referenceParallel: {
      status: reference.status,
      authorityDistinct:
        reference.status === "preflighted" && reference.authority !== firstAuthority,
    },
    independentCandidates: {
      authorityIdentityDistinct: firstAuthority !== secondAuthority,
      publicMetadataEqual: JSON.stringify(firstAuthority) === JSON.stringify(secondAuthority),
      privateIdentityDistinct:
        firstRecord !== stagingInternal.readBundleRuntimeStagingAuthority(secondAuthority),
      shallowCloneAuthenticated: stagingInternal.isBundleRuntimeStagingAuthority(
        Object.freeze({ ...firstAuthority }),
      ),
    },
    callerMutation: {
      status: callerMutationResult.status,
      stagedRevision:
        callerMutationResult.status === "staged"
          ? callerMutationResult.authority.stagedRevision
          : null,
    },
    nonzeroIndexes: {
      status: indexedResult.status,
      stagedRevision: indexedAuthority.stagedRevision,
      behaviorCapabilityIds: Object.keys(indexedRecord.capabilities.behaviors),
      resourceCapabilityIds: Object.keys(indexedRecord.capabilities.resources),
      behaviorKeys: Object.keys(indexedRecord.surfaces.home.behaviors),
      handlerSelectors: Object.keys(indexedRecord.surfaces.home.handlers),
      resourceAliases: Object.keys(indexedRecord.surfaces.home.resources),
      behaviorIdentityExact:
        indexedRecord.surfaces.home.behaviors[indexedBehaviorKey]?.capabilityId ===
        "com.example.interactions/Observe",
      handlerIdentityExact:
        indexedRecord.surfaces.home.handlers[indexedHandlerKey]?.selector === indexedHandlerKey,
      resourceIdentityExact:
        indexedRecord.surfaces.home.resources.profile?.capabilityId ===
        "com.example.account/profile",
      publicHomeSummary: indexedAuthority.surfaces.find(({ id }) => id === "home"),
    },
    snapshotDrift: rejectionReceipt(snapshotDriftResult),
    forgedAuthority: {
      ...rejectionReceipt(forgedResult),
      observations: forgedObservations,
    },
    activeSeparation: {
      unchanged: JSON.stringify(activeState) === activeBefore,
      activeState,
    },
  });
}

function assertRuntimeReceipt(observedReceipt) {
  const observedPublicModuleKeys = observedReceipt.publicModuleKeys;
  if (
    !Array.isArray(observedPublicModuleKeys) ||
    new Set(observedPublicModuleKeys).size !== observedPublicModuleKeys.length ||
    EXPECTED_PUBLIC_RUNTIME_KEYS.some((key) => !observedPublicModuleKeys.includes(key))
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The M07-T06 public runtime surface drifted.");
  }
  const receipt = { ...observedReceipt, publicModuleKeys: EXPECTED_PUBLIC_RUNTIME_KEYS };
  const expectedKeys = [
    "activeSeparation",
    "callerMutation",
    "exactSuccess",
    "forgedAuthority",
    "independentCandidates",
    "limits",
    "nonzeroIndexes",
    "packageInput",
    "privateInternalExportsAbsent",
    "publicModuleKeys",
    "referenceParallel",
    "requiredRuntimeExportsPresent",
    "snapshotDrift",
  ];
  const success = receipt.exactSuccess;
  const expectedAuthorityKeys = [
    "documentId",
    "entrySurfaceId",
    "packages",
    "profile",
    "profileVersion",
    "protocolVersion",
    "runtimeObligationCount",
    "stagedRevision",
    "surfaces",
  ];
  if (
    JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys) ||
    receipt.requiredRuntimeExportsPresent !== true ||
    receipt.privateInternalExportsAbsent !== true ||
    JSON.stringify(receipt.publicModuleKeys) !== JSON.stringify(EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    JSON.stringify(receipt.limits) !== JSON.stringify(EXPECTED_LIMITS) ||
    receipt.packageInput?.id !== EXPECTED_PACKAGE_ID ||
    receipt.packageInput?.version !== EXPECTED_PACKAGE_VERSION ||
    receipt.packageInput?.target !== EXPECTED_TARGET ||
    receipt.packageInput?.packageDigest !== EXPECTED_PACKAGE_DIGEST ||
    receipt.packageInput?.distributionFiles !== EXPECTED_ARTIFACT_COUNT ||
    receipt.packageInput?.distributionBytes !== EXPECTED_DISTRIBUTION_BYTES ||
    receipt.packageInput?.packageAuthorityAuthenticated !== true ||
    success?.status !== "staged" ||
    success.resultFrozen !== true ||
    JSON.stringify(success.authorityPublicKeys) !== JSON.stringify(expectedAuthorityKeys) ||
    success.authorityFrozen !== true ||
    success.profile !== "desen.runtime-index-staging" ||
    success.profileVersion !== 1 ||
    success.protocolVersion !== EXPECTED_PROTOCOL ||
    success.stagedRevision !== EXPECTED_REVISION ||
    success.documentId !== "com.example.account-app" ||
    success.entrySurfaceId !== "sign-in" ||
    JSON.stringify(success.packages) !== JSON.stringify(EXPECTED_PACKAGES) ||
    JSON.stringify(success.surfaces) !== JSON.stringify(EXPECTED_SURFACES) ||
    success.runtimeObligationCount !== 7 ||
    success.packagesFrozen !== true ||
    success.surfacesFrozen !== true ||
    success.authenticated !== true ||
    success.recordFrozen !== true ||
    success.predecessorExact !== true ||
    success.packageRecordExact !== true ||
    success.catalogSetExact !== true ||
    success.bundleCopied !== true ||
    success.artifactCopied !== true ||
    success.artifactCopiesIndependent !== true ||
    success.artifactDigestExact !== true ||
    success.artifactByPathIdentity !== true ||
    success.privatePackageCount !== 1 ||
    JSON.stringify(success.privateSurfaceIds) !== JSON.stringify(["home", "sign-in"]) ||
    JSON.stringify(success.privateComponentIds) !==
      JSON.stringify([
        "com.example.ui/Alert",
        "com.example.ui/Button",
        "com.example.ui/Stack",
        "com.example.ui/Text",
        "com.example.ui/TextField",
      ]) ||
    JSON.stringify(success.privateOperationIds) !== JSON.stringify(["com.example.auth/signIn"]) ||
    JSON.stringify(success.privateHandlerSelectors) !==
      JSON.stringify([
        '["component","sign-in.email","change"]',
        '["component","sign-in.password","change"]',
        '["component","sign-in.submit","press"]',
      ]) ||
    JSON.stringify(success.privateOperationAliases) !==
      JSON.stringify({ signIn: "com.example.auth/signIn" }) ||
    success.privateObligationKinds.length !== 7 ||
    JSON.stringify(success.privateObligationPointers) !==
      JSON.stringify([...success.privateObligationPointers].sort()) ||
    success.publicForbiddenAuthorityAbsent !== true ||
    receipt.referenceParallel?.status !== "preflighted" ||
    receipt.referenceParallel.authorityDistinct !== true ||
    receipt.independentCandidates?.authorityIdentityDistinct !== true ||
    receipt.independentCandidates.publicMetadataEqual !== true ||
    receipt.independentCandidates.privateIdentityDistinct !== true ||
    receipt.independentCandidates.shallowCloneAuthenticated !== false ||
    receipt.callerMutation?.status !== "staged" ||
    receipt.callerMutation.stagedRevision !== EXPECTED_REVISION ||
    receipt.nonzeroIndexes?.status !== "staged" ||
    !/^sha256:[0-9a-f]{64}$/u.test(receipt.nonzeroIndexes.stagedRevision) ||
    receipt.nonzeroIndexes.stagedRevision === EXPECTED_REVISION ||
    JSON.stringify(receipt.nonzeroIndexes.behaviorCapabilityIds) !==
      JSON.stringify(["com.example.interactions/Observe"]) ||
    JSON.stringify(receipt.nonzeroIndexes.resourceCapabilityIds) !==
      JSON.stringify(["com.example.account/profile"]) ||
    JSON.stringify(receipt.nonzeroIndexes.behaviorKeys) !==
      JSON.stringify(['["home.layout","home.observe"]']) ||
    JSON.stringify(receipt.nonzeroIndexes.handlerSelectors) !==
      JSON.stringify(['["behavior","home.layout","home.observe","observed"]']) ||
    JSON.stringify(receipt.nonzeroIndexes.resourceAliases) !== JSON.stringify(["profile"]) ||
    receipt.nonzeroIndexes.behaviorIdentityExact !== true ||
    receipt.nonzeroIndexes.handlerIdentityExact !== true ||
    receipt.nonzeroIndexes.resourceIdentityExact !== true ||
    JSON.stringify(receipt.nonzeroIndexes.publicHomeSummary) !==
      JSON.stringify({
        id: "home",
        sourceNodeCount: 2,
        behaviorCount: 1,
        handlerProgramCount: 1,
        stateEntryCount: 0,
        resourceAliasCount: 1,
        operationAliasCount: 0,
      }) ||
    receipt.activeSeparation?.unchanged !== true ||
    receipt.activeSeparation.activeState?.generation !== 4
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T06 success or separation receipt drifted.");
  }
  for (const [candidate, stage, code] of [
    [
      receipt.snapshotDrift,
      "package-snapshots",
      "run.desen.control-plane/RUNTIME_STAGING_PACKAGE_SNAPSHOT_MISMATCH",
    ],
    [
      receipt.forgedAuthority,
      "package-authority",
      "run.desen.control-plane/INVALID_RUNTIME_STAGING_PACKAGE_AUTHORITY",
    ],
  ]) {
    if (
      candidate?.status !== "rejected" ||
      candidate.stage !== stage ||
      JSON.stringify(candidate.codes) !== JSON.stringify([code]) ||
      candidate.resultFrozen !== true ||
      candidate.diagnosticsFrozen !== true ||
      candidate.authorityAbsent !== true
    ) {
      fail("RUNTIME_PROBE_MISMATCH", `The ${code} staging receipt drifted.`);
    }
  }
  if (receipt.forgedAuthority.observations !== 0) {
    fail("RUNTIME_PROBE_MISMATCH", "A forged package authority was actively inspected.");
  }
  return deepFreeze(receipt);
}

export async function buildControlPlaneRuntimeStagingEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const frozen = await authenticatedFrozenArtifactProjection();
  const frozenArtifact = frozen.artifact;
  const trackedPaths = [
    ...TRACKED_TASK_FILES,
    TRACEABILITY,
    NORMATIVE_COVERAGE,
    BUNDLE_FIXTURE,
    CATALOG_FIXTURE,
  ];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_STAGING_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneRuntimeStagingProbe()
      : copyInertJson(captured.runtimeReceipt, "runtimeReceipt"),
  );
  const [
    prerequisites,
    fixtures,
    trackedFiles,
    distribution,
    registrations,
    traceRows,
    normativeCoverage,
    tests,
    implementation,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    fixtureReceipts(trackedFileBytes),
    trackedFileReceipts(trackedFileBytes, frozenArtifact.trackedFiles),
    distributionReceipts(frozenArtifact.distribution),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    normativeCoverageProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
  ]);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    profile: "desen.control-plane.runtime-staging-proof.v1",
    task: "M07-T06",
    result: "PASS",
    summary:
      "An exact M07-T03 package authority produces complete bounded runtime execution contracts, inert package load plans, private indexes, and dynamic obligations in a staged lifetime that is separate from durable active state.",
    prerequisites,
    fixtures,
    claims: {
      supportedProtocol: EXPECTED_PROTOCOL,
      supportedTargets: [EXPECTED_TARGET],
      profile: {
        id: "desen.runtime-index-staging",
        version: 1,
        immutableAndCallerIndependent: true,
      },
      authorityIngress: {
        exactM07T03IdentityRequired: true,
        exactCatalogIdentityRetained: true,
        exactT03BundleInputValidated: true,
        executionValidatedBundleSnapshotRetained: true,
        callerArtifactMutationResisted: runtimeReceipt.callerMutation.status === "staged",
        packagePrivateSnapshotDriftRejected: runtimeReceipt.snapshotDrift,
        forgedAuthority: runtimeReceipt.forgedAuthority,
        replacementBundleCatalogArtifactsOrLimitsAccepted: false,
      },
      officialSuccess: runtimeReceipt.exactSuccess,
      nonzeroBehaviorAndResourceIndexSuccess: runtimeReceipt.nonzeroIndexes,
      stagedPreparation: {
        executionCatalogValidationComplete: true,
        executionContractValidationComplete: true,
        completeDynamicObligationsRetained: true,
        actionProgramsPreparedBeforeActivation: true,
        packageArtifactsCopiedIntoPrivateInertPlans: true,
        capabilityIndexesPrepared: ["components", "behaviors", "operations", "resources"],
        surfaceIndexesPrepared: [
          "source nodes",
          "behaviors",
          "event programs",
          "state",
          "resource aliases",
          "operation aliases",
        ],
        executableModuleLoaderPrepared: false,
      },
      activeStagedSeparation: {
        stagedRevisionIsNotActivePointer: true,
        durableActiveRecordObservedOrMutated: false,
        currentActiveRecordUnchangedInProbe: runtimeReceipt.activeSeparation.unchanged,
        publicCommitActivateRollbackOrChannelAuthority: false,
        referencePreflightBranchRemainsParallel: runtimeReceipt.referenceParallel,
        deterministicIndependentCandidateIdentity: runtimeReceipt.independentCandidates,
      },
      limits: {
        directProfile: runtimeReceipt.limits,
        inheritedExactPackageCeilings: true,
        executableBoundaryOrDominanceFields: tests.executableLimitFields,
        exactLowerBoundaryRejectionsInFocusedTests: tests.executableLimitFieldCount,
        overflowPolicy: "reject-complete-candidate-without-truncation-or-partial-authority",
      },
      authority: {
        runtimeAuthenticated: runtimeReceipt.exactSuccess.authenticated,
        shallowCloneRejected: !runtimeReceipt.independentCandidates.shallowCloneAuthenticated,
        immutable: runtimeReceipt.exactSuccess.authorityFrozen,
        privatePredecessorExact: runtimeReceipt.exactSuccess.predecessorExact,
        rawBundleCatalogArtifactsProgramsOrObligationsPublic: false,
        activePreviousGoodGenerationChannelCommitOrHostAuthorityPublic: false,
      },
      failurePrecedence: [
        "authenticate exact M07-T03 package authority before private snapshot observation",
        "re-close copied artifact bytes under fixed package ceilings",
        "validate the exact execution Catalog set and Bundle execution contracts, retaining exact Catalog identity and a canonically and revision-identical execution-validated Bundle snapshot",
        "prepare bounded package, capability, surface, handler, alias, and obligation indexes",
        "create opaque immutable staged authority without observing or mutating durable active state",
      ],
      implementation,
      registrations,
      traceRows,
      coverageTransitions: {
        proofMatrixP12: "NOT_PROVEN",
        normativeN038: "PLANNED",
        normativeN041: "PLANNED",
        authenticatedRows: normativeCoverage.rows,
      },
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T07 still owns the exact identity join with M07-T04 and durable transactional commit of activeRevision and previousGoodRevision.",
      "M07-T08 through M07-T11 still own restart recovery, last-known-good restoration, fault injection, concurrency, and reference-host channel consumption.",
      "A successful M07-T06 result cannot load executable modules, commit, activate, roll back, mutate a channel, select a host adapter, or notify a host.",
      "M07-T06 prepares inert exact package load plans but deliberately grants no loader callback or arbitrary executable-code authority.",
      "P-12 remains NOT_PROVEN; G07 remains open until the complete activation and recovery chain passes.",
      "N-038 and N-041 are only partially covered by this staged branch and retain later milestone owners.",
      "The current authenticated target is Web-React; native targets require separately reviewed target packages and adapters.",
    ],
    reproduction: [
      "pnpm verify:control-plane-local-api",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-staging",
      "node scripts/generate-control-plane-runtime-staging-proof.mjs",
      "node scripts/verify-control-plane-runtime-staging.mjs",
      "node --test tests/control-plane-runtime-staging.test.mjs",
    ],
  });
  const currentCompatibilityText = await format(JSON.stringify(currentCompatibility), {
    parser: "json",
    printWidth: 100,
  });
  const currentCompatibilityBytes = Buffer.from(currentCompatibilityText, "utf8");
  return Object.freeze({
    artifact: frozenArtifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    currentCompatibilitySha256: sha256(currentCompatibilityBytes),
    normativeCoverageEvidenceSha256s: normativeCoverage.evidenceSha256s,
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

export async function verifyControlPlaneRuntimeStagingEvidence(options) {
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
  const built = await buildControlPlaneRuntimeStagingEvidence({
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
          artifactPath === undefined
            ? DEFAULT_CONTROL_PLANE_RUNTIME_STAGING_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T06 evidence artifact is not reproducible.");
  }
  if (
    built.normativeCoverageEvidenceSha256s.some(
      (evidenceSha256) => evidenceSha256 !== built.artifactSha256,
    )
  ) {
    fail(
      "NORMATIVE_COVERAGE_DRIFT",
      "The M07-T06 normative coverage rows do not pin the reproducible evidence artifact.",
    );
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
    task: "M07-T06",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    currentCompatibilitySha256: built.currentCompatibilitySha256,
    currentRevision: built.currentCompatibility.claims.officialSuccess.stagedRevision,
    currentPackageDigest:
      built.currentCompatibility.claims.officialSuccess.packages[0].packageDigest,
    currentDistributionBytes:
      built.currentCompatibility.claims.officialSuccess.packages[0].artifactByteLength,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    packages: built.artifact.claims.officialSuccess.packages.length,
    surfaces: built.artifact.claims.officialSuccess.surfaces.length,
    runtimeObligations: built.artifact.claims.officialSuccess.runtimeObligationCount,
  });
}

export async function writeControlPlaneRuntimeStagingEvidence(options) {
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
  const built = await buildControlPlaneRuntimeStagingEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_STAGING_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T06 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
