import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-REFERENCE-PREFLIGHT.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/reference-preflight-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/reference-preflight-internal.ts`;
const APP_IMPLEMENTATION = `${APP_DIRECTORY}/src/reference-preflight.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/reference-preflight.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/reference-preflight.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const GENERATOR = "scripts/generate-control-plane-reference-preflight-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-reference-preflight.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-reference-preflight-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-reference-preflight.test.mjs";
const BUNDLE_FIXTURE = "examples/sign-in/official-derived.bundle.desen.json";
const CATALOG_FIXTURE = "packages/reference-catalog-web/catalog.json";
const CATALOG_PACKAGE_DIRECTORY = "packages/reference-catalog-web";

const MAX_AUTHORITY_BYTES = 16 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
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
const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";
const EXPECTED_PACKAGE_ID = "run.desen.reference.sign-in";
const EXPECTED_PACKAGE_VERSION = "0.1.0";
const EXPECTED_TARGET = "web-react";
const EXPECTED_PACKAGE_DIGEST =
  "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0";
const EXPECTED_ARTIFACT_COUNT = 80;
const EXPECTED_DISTRIBUTION_BYTES = 243_175;

const EXPECTED_LIMITS = Object.freeze({
  maxSurfaces: 256,
  maxSourceNodes: 25_000,
  maxSourceNodesPerSurface: 5_000,
  maxMaterializedNodesPerSurface: 5_000,
  maxSourceTreeDepth: 64,
  maxRepeatInstances: 1_000,
  maxActionsPerTurn: 64,
  maxActionOccurrences: 25_000,
  maxSettlementDepth: 16,
  maxPredicateArguments: 64,
  maxPredicateNodesPerExpression: 64,
  maxPredicateNodeOccurrences: 25_000,
  maxReferenceOccurrences: 25_000,
});

const EXPECTED_SURFACES = Object.freeze([
  Object.freeze({
    id: "home",
    sourceNodeCount: 2,
    maximumMaterializedNodeCount: 2,
    sourceTreeDepth: 1,
    capabilityReferenceCount: 2,
    actionCount: 0,
    predicateNodeCount: 0,
    settlementDepth: 0,
  }),
  Object.freeze({
    id: "sign-in",
    sourceNodeCount: 6,
    maximumMaterializedNodeCount: 6,
    sourceTreeDepth: 1,
    capabilityReferenceCount: 7,
    actionCount: 4,
    predicateNodeCount: 1,
    settlementDepth: 1,
  }),
]);

const TRACE_IDS = Object.freeze(["PIPE-007", "PIPE-014", "R-008", "R-123", "D-035"]);

const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T04 artifact and official reference receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in every direct prerequisite",
  "[implementation] rejects changed authority, traversal, limit, or public-entry receipts",
  "[registration] rejects package-root, package-script, aggregate, or CI tuple drift",
  "[traceability] rejects owner or identity drift in all five exact rows",
  "[runtime] rejects changed success, reference, precedence, or internal-failure receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest later-task nonclaims",
]);

const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "preflights the real T02→T03→T04 official-derived chain as opaque immutable authority",
  "rejects cloned, forged, proxied, and revoked package authorities before observing ports",
  "rejects unknown component, behavior, resource, and nested operation capabilities exactly",
  "accepts exact navigation, resource, command, and event references and rejects each unknown target",
  "accepts exactly 256 surfaces and rejects 257",
  "accepts 5,000 source nodes on one surface and rejects 5,001",
  "proves the 25,000 source-node aggregate is strictly dominated by the reference ceiling",
  "accepts source-tree depth 64 and rejects depth 65",
  "accepts 1,000 repeat instances, clamps a larger declaration, and rejects 1,001 instances",
  "accepts exactly 5,000 potential materialized nodes and rejects 5,001",
  "inherits predicate arguments from T02: 64 pass and 65 fail before T04",
  "keeps predicate-shaped literal objects distinct from exact nested predicates",
  "accepts 64 predicate nodes in one expression and rejects 65",
  "accepts exactly 25,000 predicate occurrences and rejects 25,001",
  "accepts 64 actions in one turn and rejects 65",
  "accepts exactly 25,000 action occurrences and rejects 25,001",
  "charges command target and command separately at the 25,000-reference boundary",
  "accepts settlement depth 16 and rejects depth 17",
  "maps an injected semantic-validator throw to one redacted internal rejection",
  "redacts an injected semantic-validation failure instead of forwarding its diagnostics",
  "rejects an injected semantic success whose Bundle differs from authenticated bytes",
  "calls the semantic validator once with authenticated snapshots and accepts exact success",
]);

const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "M07-T02 integrity authority cannot bypass exact installed-package preflight.",
  "Callers cannot provide a replacement Bundle, Catalog, callback, or limits.",
  "Opaque reference authority cannot be manufactured structurally.",
  "The public authority deliberately exposes no Bundle.",
  "The public authority deliberately exposes no Catalog set.",
  "The public authority deliberately exposes no installed-package bytes.",
  "Runtime execution-contract obligations belong to M07-T06, not this authority.",
  "Reference preflight does not stage runtime indexes.",
  "Reference preflight is not activation or durable-commit authority.",
  "Reference-preflight metadata is immutable.",
  "The fixed finite profile is immutable and caller-independent.",
  "Rejected preflight never carries a partial authority.",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node scripts/generate-control-plane-reference-preflight-proof.mjs",
  verify:
    "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node scripts/verify-control-plane-reference-preflight.mjs",
  test: "pnpm verify:control-plane-package-preflight && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:reference-preflight && node --test tests/control-plane-reference-preflight.test.mjs",
});

const CI_TUPLE = Object.freeze([
  "control-plane-reference-preflight",
  "scripts/verify-control-plane-reference-preflight.mjs",
  "tests/control-plane-reference-preflight.test.mjs",
]);

export const CONTROL_PLANE_REFERENCE_PREFLIGHT_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T03",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json",
    sha256: "79ec5f2d285868ecd7e08b4649b160087810b08346d7741796c09d14749f4628",
  }),
  Object.freeze({
    task: "M02-T07",
    path: "docs/proof/artifacts/protocol-0.1.0-semantic-foundation.json",
    sha256: "96048882670a6c23629ff686f61e14105a51bc6bcf287fff7ee372045782caa7",
  }),
  Object.freeze({
    task: "M02-T13",
    path: "docs/proof/artifacts/protocol-0.1.0-validator-diagnostic-micro-vectors.json",
    sha256: "3214a26a683d46a3b20c6ca400de44faa2c5e394f706a6e3e8d3d3628da78718",
  }),
  Object.freeze({
    task: "M04-T16",
    path: "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json",
    sha256: "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4",
  }),
  Object.freeze({
    task: "M05-T06",
    path: "docs/proof/artifacts/runtime-react-0.1.0-failure-boundary.json",
    sha256: "3192e4af418a370a65d7d815b1bdbf0140fa42914859f1baa76dd68641818723",
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

export const DEFAULT_CONTROL_PLANE_REFERENCE_PREFLIGHT_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneReferencePreflightEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneReferencePreflightEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneReferencePreflightEvidenceError(code, message, details);
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
    if (error instanceof ControlPlaneReferencePreflightEvidenceError) throw error;
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
    if (error instanceof ControlPlaneReferencePreflightEvidenceError) throw error;
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
    if (error instanceof ControlPlaneReferencePreflightEvidenceError) throw error;
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

function expectedPublicSourceExports() {
  const values = [
    ["BUNDLE_INTEGRITY_LIMITS", "./bundle-verification-contract.js"],
    ["BUNDLE_PACKAGE_PREFLIGHT_LIMITS", "./package-preflight-contract.js"],
    ["BUNDLE_REFERENCE_PREFLIGHT_LIMITS", "./reference-preflight-contract.js"],
    ["BundleStoreError", "./bundle-store-contract.js"],
    ["INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE", "./package-preflight-contract.js"],
    ["INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE", "./reference-preflight-contract.js"],
    ["INVALID_INSTALLED_PACKAGE_CODE", "./package-preflight-contract.js"],
    ["PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE", "./package-preflight-contract.js"],
    ["PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE", "./package-preflight-contract.js"],
    ["REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE", "./reference-preflight-contract.js"],
    ["SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE", "./bundle-verification-contract.js"],
    ["openBundleStore", "./bundle-store.js"],
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
    fail("REGISTRATION_DRIFT", "The exact M07-T04 public package-root inventory drifted.");
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
    fail("REGISTRATION_DRIFT", "The exact M07-T04 aggregate tail drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_REFERENCE_PREFLIGHT_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "A direct M07-T04 prerequisite artifact drifted.", {
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
  const receipts = [];
  for (const relativePath of TRACKED_TASK_FILES) {
    const bytes = await authorityBytes(relativePath, overrides);
    receipts.push(
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
  }
  return Object.freeze(receipts);
}

async function distributionReceipts() {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const observed = (await readdir(distDirectory))
    .filter((name) => name.startsWith("reference-preflight") || name.startsWith("index."))
    .sort();
  const suffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];
  const expected = [
    "reference-preflight-contract",
    "reference-preflight-internal",
    "reference-preflight",
    "index",
  ]
    .flatMap((base) => suffixes.map((suffix) => `${base}${suffix}`))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The exact M07-T04 built distribution inventory drifted.", {
      observed,
    });
  }
  return Object.freeze(
    await Promise.all(
      observed.map(async (name) => {
        const relativePath = `${APP_DIRECTORY}/dist/${name}`;
        const bytes = await safeReadAbsolute(path.join(ROOT, relativePath));
        return Object.freeze({
          path: relativePath,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
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
  const appProjection = {
    name: appPackage.name,
    main: appPackage.main,
    types: appPackage.types,
    exports: appPackage.exports?.["."],
    packageTest: appPackage.scripts?.["test:reference-preflight"],
    protocolDependency: appPackage.dependencies?.["@desen/protocol"],
    validatorDependency: appPackage.dependencies?.["@desen/validator"],
    referenceCatalogProductionDependency:
      appPackage.dependencies?.["@desen/reference-catalog-web"] ?? null,
  };
  const expectedAppProjection = {
    name: "@desen/control-plane-api",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { types: "./dist/index.d.ts", import: "./dist/index.js" },
    packageTest: "vitest run test/reference-preflight.test.ts",
    protocolDependency: "workspace:*",
    validatorDependency: "workspace:*",
    referenceCatalogProductionDependency: null,
  };
  if (JSON.stringify(appProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T04 package registration projection drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-reference-preflight"],
    verify: rootPackage.scripts?.["verify:control-plane-reference-preflight"],
    test: rootPackage.scripts?.["test:control-plane-reference-preflight"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact root M07-T04 commands drifted.");
  }
  assertAggregateTail(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-package-preflight",
    "pnpm verify:control-plane-reference-preflight",
    "pnpm lint",
  );
  assertAggregateTail(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-package-preflight",
    "pnpm test:control-plane-reference-preflight",
    "turbo run test",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T04 modular-CI proof tuple drifted.");
  }
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "control-plane-package-preflight",
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
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T04"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T04 traceability authority drifted.");
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
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  if (
    EXPECTED_RUNTIME_TEST_NAMES.length === 0 ||
    JSON.stringify(runtimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T04 focused or mutation-test authority drifted.");
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

async function implementationProjection(overrides) {
  const [contractBytes, internalBytes, implementationBytes] = await Promise.all([
    authorityBytes(APP_CONTRACT, overrides),
    authorityBytes(APP_INTERNAL, overrides),
    authorityBytes(APP_IMPLEMENTATION, overrides),
  ]);
  const contract = fatalText(contractBytes, APP_CONTRACT);
  const internal = fatalText(internalBytes, APP_INTERNAL);
  const implementation = fatalText(implementationBytes, APP_IMPLEMENTATION);
  for (const [source, relativePath] of [
    [contract, APP_CONTRACT],
    [internal, APP_INTERNAL],
    [implementation, APP_IMPLEMENTATION],
  ]) {
    parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  }
  const requiredAuthorities = [
    [contract, "export const BUNDLE_REFERENCE_PREFLIGHT_LIMITS", 1],
    [contract, "readonly maxSourceTreeDepth: number", 1],
    [contract, "readonly maxMaterializedNodesPerSurface: number", 1],
    [internal, "readBundlePackagePreflightAuthority(packageAuthority)", 1],
    [internal, "const AUTHORITIES = new WeakMap<", 1],
    [internal, "validateBundleSemantics: validateDesenBundleSemantics", 1],
    [internal, "ports.validateBundleSemantics(", 1],
    [internal, "BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxReferenceOccurrences", 1],
    [internal, "BUNDLE_REFERENCE_PREFLIGHT_LIMITS.maxMaterializedNodesPerSurface", 3],
    [internal, "readBundleReferencePreflightAuthority", 2],
    [implementation, "preflightBundleReferencesInternal(authority)", 1],
  ];
  if (
    requiredAuthorities.some(
      ([source, authority, count]) => source.split(authority).length - 1 !== count,
    ) ||
    /\bimport\(|\bfetch\(|https?:\/\//u.test(internal)
  ) {
    fail("IMPLEMENTATION_DRIFT", "The reference, limit, or authority implementation drifted.");
  }
  return deepFreeze({
    packageAuthority: "readBundlePackagePreflightAuthority exact object identity",
    traversal: "bounded deterministic own authenticated Bundle/Catalog snapshot",
    semanticAgreement: "validateDesenBundleSemantics over the authenticated Catalog set",
    authorityIdentity: "package-private WeakMap",
    failureMode: "one terminal stage with one immutable diagnostic and no partial authority",
    dynamicLoading: false,
    networkAcquisition: false,
    callerSelectedLimits: false,
  });
}

async function fixtureReceipts(overrides) {
  return Object.freeze(
    await Promise.all(
      [
        Object.freeze({ role: "officialDerivedBundle", path: BUNDLE_FIXTURE }),
        Object.freeze({ role: "currentWebReactCatalog", path: CATALOG_FIXTURE }),
      ].map(async (fixture) => {
        const bytes = await authorityBytes(fixture.path, overrides);
        return Object.freeze({
          ...fixture,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        });
      }),
    ),
  );
}

async function listRegularFiles(relativeDirectory) {
  const rootDirectory = path.join(ROOT, relativeDirectory);
  const output = [];
  async function visit(absoluteDirectory, relativePrefix) {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const absolute = path.join(absoluteDirectory, entry.name);
      const relative = relativePrefix === "" ? entry.name : `${relativePrefix}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        fail("UNSAFE_AUTHORITY", "The installed-package artifact inventory contains a symlink.");
      }
      if (entry.isDirectory()) {
        await visit(absolute, relative);
      } else if (entry.isFile()) {
        output.push(relative);
      } else {
        fail("UNSAFE_AUTHORITY", "The installed-package artifact inventory is not regular.");
      }
    }
  }
  await visit(rootDirectory, "");
  return Object.freeze(output);
}

async function currentWebReactPackageInput() {
  const catalogBytes = await safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE));
  const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);
  const distPaths = await listRegularFiles(`${CATALOG_PACKAGE_DIRECTORY}/dist`);
  if (distPaths.length !== EXPECTED_ARTIFACT_COUNT) {
    fail("RUNTIME_PROBE_MISMATCH", "The current Web-React distribution file count drifted.", {
      observed: distPaths.length,
    });
  }
  const artifacts = [];
  let distributionBytes = 0;
  for (const distPath of distPaths) {
    const bytes = await safeReadAbsolute(
      path.join(ROOT, CATALOG_PACKAGE_DIRECTORY, "dist", distPath),
      MAX_PACKAGE_BYTES,
    );
    distributionBytes += bytes.byteLength;
    artifacts.push(Object.freeze({ path: `dist/${distPath}`, bytes }));
  }
  if (distributionBytes !== EXPECTED_DISTRIBUTION_BYTES) {
    fail("RUNTIME_PROBE_MISMATCH", "The current Web-React distribution byte count drifted.", {
      observed: distributionBytes,
    });
  }
  return Object.freeze({ catalog, catalogBytes, artifacts: Object.freeze(artifacts) });
}

function rejectionReceipt(result) {
  return Object.freeze({
    status: result.status,
    stage: result.status === "rejected" ? result.stage : undefined,
    codes: result.status === "rejected" ? result.diagnostics.map(({ code }) => code) : [],
    pointers: result.status === "rejected" ? result.diagnostics.map(({ pointer }) => pointer) : [],
    resultFrozen: Object.isFrozen(result),
    diagnosticsFrozen:
      result.status === "rejected" &&
      Object.isFrozen(result.diagnostics) &&
      result.diagnostics.every((diagnostic) => Object.isFrozen(diagnostic)),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  });
}

function authorityReceipt(result, referenceInternal, packageAuthority) {
  if (result.status !== "preflighted") {
    return Object.freeze({ status: result.status, resultFrozen: Object.isFrozen(result) });
  }
  const record = referenceInternal.readBundleReferencePreflightAuthority(result.authority);
  return deepFreeze({
    status: result.status,
    resultFrozen: Object.isFrozen(result),
    authorityPublicKeys: Object.keys(result.authority).sort(),
    authorityFrozen: Object.isFrozen(result.authority),
    profile: result.authority.profile,
    profileVersion: result.authority.profileVersion,
    protocolVersion: result.authority.protocolVersion,
    revision: result.authority.revision,
    surfaces: result.authority.surfaces,
    surfacesFrozen:
      Object.isFrozen(result.authority.surfaces) &&
      result.authority.surfaces.every((surface) => Object.isFrozen(surface)),
    authenticated: referenceInternal.isBundleReferencePreflightAuthority(result.authority),
    recordPresent: record !== undefined,
    recordFrozen: record === undefined ? false : Object.isFrozen(record),
    predecessorExact: record?.packageAuthority === packageAuthority,
    privateSurfaceIdentity: record?.surfaces === result.authority.surfaces,
    rawBundlePublic: Object.hasOwn(result.authority, "bundle"),
    rawCatalogPublic: Object.hasOwn(result.authority, "catalogSet"),
    rawArtifactsPublic: Object.hasOwn(result.authority, "artifacts"),
    obligationsPublic: Object.hasOwn(result.authority, "obligations"),
    stagingPublic: Object.hasOwn(result.authority, "stage"),
    activationPublic: Object.hasOwn(result.authority, "activate"),
  });
}

function entryForBundle(bundle, protocol) {
  return Object.freeze({
    revision: bundle.revision,
    bytes: protocol.canonicalizeJsonBytes(bundle),
  });
}

function withRecalculatedRevision(bundle, protocol, mutate) {
  const candidate = structuredClone(bundle);
  mutate(candidate);
  candidate.revision = protocol.calculateDesenBundleRevision(candidate);
  return candidate;
}

function requireAuthority(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not yield ${expectedStatus} authority.`);
  }
  return result.authority;
}

export async function runControlPlaneReferencePreflightProbe() {
  const [controlPlane, packageInternal, referenceInternal, protocol, bundleBytes, input] =
    await Promise.all([
      import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/reference-preflight-internal.js")).href
      ),
      import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
      safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
      currentWebReactPackageInput(),
    ]);
  const bundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
  const installedPackage = Object.freeze({
    id: EXPECTED_PACKAGE_ID,
    version: EXPECTED_PACKAGE_VERSION,
    target: EXPECTED_TARGET,
    catalog: input.catalog,
    artifacts: input.artifacts,
  });

  const packageAuthorityFor = (candidateBundle) => {
    const integrity = controlPlane.verifyBundleStoreEntry(
      entryForBundle(candidateBundle, protocol),
      {
        status: "not-available",
      },
    );
    const integrityAuthority = requireAuthority(integrity, "verified", "Bundle integrity probe");
    const packageResult = controlPlane.preflightBundlePackages(integrityAuthority, [
      installedPackage,
    ]);
    return {
      integrity,
      packageResult,
      authority: requireAuthority(packageResult, "preflighted", "Package preflight probe"),
    };
  };

  const officialPackage = packageAuthorityFor(bundle);
  const exactSuccess = controlPlane.preflightBundleReferences(officialPackage.authority);

  const unknownComponentBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.surfaces.home.root.use = "com.example.ui/Unknown";
  });
  const unknownComponentPackage = packageAuthorityFor(unknownComponentBundle);
  const unknownComponent = controlPlane.preflightBundleReferences(
    unknownComponentPackage.authority,
  );

  const unknownOperationBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.surfaces["sign-in"].root.slots.default[4].on.press[0].operation =
      "com.example.auth/unknown";
  });
  const unknownOperationPackage = packageAuthorityFor(unknownOperationBundle);
  const unknownOperation = controlPlane.preflightBundleReferences(
    unknownOperationPackage.authority,
  );

  const unknownSurfaceBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.surfaces["sign-in"].root.slots.default[4].on.press[0].onSuccess[0].surface = "missing";
  });
  const unknownSurfacePackage = packageAuthorityFor(unknownSurfaceBundle);
  const unknownSurface = controlPlane.preflightBundleReferences(unknownSurfacePackage.authority);

  let forgedObservations = 0;
  const forgedAuthority = new Proxy(Object.freeze({ ...officialPackage.authority }), {
    get() {
      forgedObservations += 1;
      throw new Error("forged authority must not be inspected");
    },
    ownKeys() {
      forgedObservations += 1;
      throw new Error("forged authority must not be inspected");
    },
  });
  const forged = controlPlane.preflightBundleReferences(forgedAuthority);
  const internalFailure = referenceInternal.preflightBundleReferencesInternal(
    officialPackage.authority,
    Object.freeze({
      validateBundleSemantics() {
        throw new Error("redacted trusted-port failure");
      },
    }),
  );
  const successCloneAuthenticated =
    exactSuccess.status === "preflighted"
      ? referenceInternal.isBundleReferencePreflightAuthority(
          Object.freeze({ ...exactSuccess.authority }),
        )
      : true;

  return deepFreeze({
    publicModuleKeys: Object.keys(controlPlane).sort(),
    limits: controlPlane.BUNDLE_REFERENCE_PREFLIGHT_LIMITS,
    requiredRuntimeExportsPresent:
      typeof controlPlane.preflightBundleReferences === "function" &&
      Object.isFrozen(controlPlane.BUNDLE_REFERENCE_PREFLIGHT_LIMITS),
    privateInternalExportsAbsent:
      !Object.hasOwn(controlPlane, "readBundleReferencePreflightAuthority") &&
      !Object.hasOwn(controlPlane, "isBundleReferencePreflightAuthority") &&
      !Object.hasOwn(controlPlane, "preflightBundleReferencesInternal"),
    packageInput: {
      id: input.catalog.id,
      version: input.catalog.version,
      target: input.catalog.target,
      packageDigest: input.catalog.packageDigest,
      catalogBytes: input.catalogBytes.byteLength,
      distributionFiles: input.artifacts.length,
      distributionBytes: input.artifacts.reduce(
        (total, artifact) => total + artifact.bytes.byteLength,
        0,
      ),
      packageAuthorityAuthenticated: packageInternal.isBundlePackagePreflightAuthority(
        officialPackage.authority,
      ),
    },
    exactSuccess: authorityReceipt(exactSuccess, referenceInternal, officialPackage.authority),
    unknownComponent: rejectionReceipt(unknownComponent),
    unknownOperation: rejectionReceipt(unknownOperation),
    unknownSurface: rejectionReceipt(unknownSurface),
    forgedAuthority: { ...rejectionReceipt(forged), observations: forgedObservations },
    internalFailure: rejectionReceipt(internalFailure),
    successCloneAuthenticated,
  });
}

function assertRuntimeReceipt(receipt) {
  const expectedKeys = [
    "exactSuccess",
    "forgedAuthority",
    "internalFailure",
    "limits",
    "packageInput",
    "privateInternalExportsAbsent",
    "publicModuleKeys",
    "requiredRuntimeExportsPresent",
    "successCloneAuthenticated",
    "unknownComponent",
    "unknownOperation",
    "unknownSurface",
  ];
  const expectedAuthorityKeys = [
    "profile",
    "profileVersion",
    "protocolVersion",
    "revision",
    "surfaces",
  ];
  const success = receipt.exactSuccess;
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
    success?.status !== "preflighted" ||
    success.resultFrozen !== true ||
    JSON.stringify(success.authorityPublicKeys) !== JSON.stringify(expectedAuthorityKeys) ||
    success.authorityFrozen !== true ||
    success.profile !== "desen.reference.activation-preflight" ||
    success.profileVersion !== 1 ||
    success.protocolVersion !== EXPECTED_PROTOCOL ||
    success.revision !== EXPECTED_REVISION ||
    JSON.stringify(success.surfaces) !== JSON.stringify(EXPECTED_SURFACES) ||
    success.surfacesFrozen !== true ||
    success.authenticated !== true ||
    success.recordPresent !== true ||
    success.recordFrozen !== true ||
    success.predecessorExact !== true ||
    success.privateSurfaceIdentity !== true ||
    success.rawBundlePublic !== false ||
    success.rawCatalogPublic !== false ||
    success.rawArtifactsPublic !== false ||
    success.obligationsPublic !== false ||
    success.stagingPublic !== false ||
    success.activationPublic !== false ||
    receipt.successCloneAuthenticated !== false
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T04 success or authority receipt drifted.");
  }
  const failures = [
    [
      receipt.unknownComponent,
      "surface-capability-references",
      "UNKNOWN_CAPABILITY",
      "/surfaces/home/root/use",
    ],
    [
      receipt.unknownOperation,
      "surface-capability-references",
      "UNKNOWN_CAPABILITY",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/operation",
    ],
    [
      receipt.unknownSurface,
      "surface-capability-references",
      "ENTRY_NOT_FOUND",
      "/surfaces/sign-in/root/slots/default/4/on/press/0/onSuccess/0/surface",
    ],
    [
      receipt.forgedAuthority,
      "package-authority",
      "run.desen.control-plane/INVALID_BUNDLE_PACKAGE_AUTHORITY",
      "",
    ],
    [
      receipt.internalFailure,
      "internal",
      "run.desen.control-plane/REFERENCE_PREFLIGHT_INTERNAL_FAILURE",
      "",
    ],
  ];
  for (const [candidate, stage, code, pointer] of failures) {
    if (
      candidate?.status !== "rejected" ||
      candidate.stage !== stage ||
      JSON.stringify(candidate.codes) !== JSON.stringify([code]) ||
      JSON.stringify(candidate.pointers) !== JSON.stringify([pointer]) ||
      candidate.resultFrozen !== true ||
      candidate.diagnosticsFrozen !== true ||
      candidate.authorityAbsent !== true
    ) {
      fail("RUNTIME_PROBE_MISMATCH", `The ${code} reference-preflight receipt drifted.`);
    }
  }
  if (receipt.forgedAuthority.observations !== 0) {
    fail("RUNTIME_PROBE_MISMATCH", "A forged package authority was actively inspected.");
  }
  return deepFreeze(receipt);
}

export async function buildControlPlaneReferencePreflightEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const trackedPaths = [...TRACKED_TASK_FILES, TRACEABILITY, BUNDLE_FIXTURE, CATALOG_FIXTURE];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_REFERENCE_PREFLIGHT_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneReferencePreflightProbe()
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
    profile: "desen.control-plane.reference-preflight-proof.v1",
    task: "M07-T04",
    result: "PASS",
    summary:
      "An exact authenticated M07-T03 package authority passes bounded deterministic surface, capability, event, action-target, semantic-agreement, and whole-activation limit preflight before yielding opaque non-activation authority.",
    prerequisites,
    fixtures,
    claims: {
      supportedProtocol: EXPECTED_PROTOCOL,
      supportedTargets: [EXPECTED_TARGET],
      profile: {
        id: "desen.reference.activation-preflight",
        version: 1,
        immutableAndCallerIndependent: true,
      },
      authorityIngress: {
        exactM07T03IdentityRequired: true,
        forgedAuthority: runtimeReceipt.forgedAuthority,
        callbacksOrLoadersAccepted: false,
        replacementBundleOrCatalogAccepted: false,
      },
      officialSuccess: runtimeReceipt.exactSuccess,
      referenceClasses: [
        "Bundle entry surface",
        "managed navigation surface",
        "component capability",
        "behavior capability",
        "surface resource capability",
        "surface-local resource.refresh alias",
        "operation capability",
        "component and behavior event",
        "component command target and command",
      ],
      exactReferenceFailures: {
        unknownComponent: runtimeReceipt.unknownComponent,
        unknownOperation: runtimeReceipt.unknownOperation,
        unknownSurface: runtimeReceipt.unknownSurface,
        noSubstitution: true,
        deterministicFailFastTraversal: true,
      },
      limits: {
        directProfile: runtimeReceipt.limits,
        inheritedBundleCanonicalBytes: 2_097_152,
        inheritedPredicateArguments: 64,
        inheritedBoundedImmutableStructuralGraph: true,
        predicateArgumentLimitRecheckedAsDefenseInDepth: true,
        boundaryEvidence: {
          maxSurfaces: "exact-256-and-one-over",
          maxSourceNodes: "executable-dominance-by-equal-reference-occurrence-ceiling",
          maxSourceNodesPerSurface: "exact-5000-and-one-over",
          maxMaterializedNodesPerSurface: "exact-5000-and-one-over",
          maxSourceTreeDepth: "exact-64-and-one-over",
          maxRepeatInstances: "exact-1000-clamped-declaration-and-one-over-literal-array",
          maxActionsPerTurn: "exact-64-and-one-over",
          maxActionOccurrences: "exact-25000-and-one-over",
          maxSettlementDepth: "exact-16-and-one-over",
          maxPredicateArguments: "inherited-T02-structural-64-and-rejected-65",
          maxPredicateNodesPerExpression: "exact-64-and-one-over",
          maxPredicateNodeOccurrences: "exact-25000-and-one-over",
          maxReferenceOccurrences: "exact-25000-and-one-over-with-command-double-charge",
        },
        overflowPolicy: "reject-without-truncation-or-partial-authority",
        sourceDocumentDepthIsNotRuntimePlanDepth: true,
        dynamicRepeatCardinalityPredicted: false,
        dynamicRepeatUsesDeclaredEffectiveCeiling: true,
      },
      semanticAgreement: {
        cumulativeBundleSemantics: true,
        authenticatedInputAgreementRequired: true,
        internalFailure: runtimeReceipt.internalFailure,
        executionContractsPrepared: false,
        runtimeObligationsRetained: false,
      },
      authority: {
        runtimeAuthenticated: runtimeReceipt.exactSuccess.authenticated,
        shallowCloneRejected: !runtimeReceipt.successCloneAuthenticated,
        immutable: runtimeReceipt.exactSuccess.authorityFrozen,
        privatePredecessorExact: runtimeReceipt.exactSuccess.predecessorExact,
        rawBundleCatalogArtifactsOrObligationsPublic: false,
        stagingOrActivationAuthorityPublic: false,
      },
      failurePrecedence: [
        "authenticate exact M07-T03 package authority before private snapshot observation",
        "scan entry, surfaces, source tree, static references, programs, predicates, and declared expansion under fixed ceilings",
        "apply cumulative Bundle semantics to the same authenticated Bundle and Catalog snapshots",
        "create opaque immutable M07-T04 authority",
      ],
      implementation,
      registrations,
      traceRows,
      coverageTransitions: {
        proofMatrixP17: "PROVEN",
        proofMatrixP12: "NOT_PROVEN",
        normativeN038: "PLANNED",
        normativeN041: "PLANNED",
      },
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T05 still owns editable Source integration, immutable Bundle persistence integration, mutable channel pointers, and local transport behavior.",
      "M07-T06 still owns staged runtime indexes and active/staged state separation.",
      "M07-T07 through M07-T11 still own durable activation, last-known-good state, restart recovery, fault injection, concurrency, and reference-host channel consumption.",
      "A successful M07-T04 result cannot stage, commit, activate, mutate a channel, or notify a host.",
      "Dynamic repeat cardinality and runtime-resolved values are not predicted during static preflight; M07-T06 and the runtime keep their own bounded responsibilities.",
      "P-12 remains NOT_PROVEN; N-038 and N-041 retain later owners and remain PLANNED.",
      "M12-T05 still owns the final measured cross-system limit profile, and M12-T12 owns packed external-consumer integrity.",
      "The current authenticated target is Web-React; native targets require separately reviewed target packages and adapters.",
    ],
    reproduction: [
      "pnpm verify:control-plane-package-preflight",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:reference-preflight",
      "node scripts/generate-control-plane-reference-preflight-proof.mjs",
      "node scripts/verify-control-plane-reference-preflight.mjs",
      "node --test tests/control-plane-reference-preflight.test.mjs",
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

export async function verifyControlPlaneReferencePreflightEvidence(options) {
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
  const built = await buildControlPlaneReferencePreflightEvidence({
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
            ? DEFAULT_CONTROL_PLANE_REFERENCE_PREFLIGHT_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T04 evidence artifact is not reproducible.");
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
    task: "M07-T04",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    surfaces: built.artifact.claims.officialSuccess.surfaces.length,
  });
}

export async function writeControlPlaneReferencePreflightEvidence(options) {
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
  const built = await buildControlPlaneReferencePreflightEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_REFERENCE_PREFLIGHT_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T04 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
