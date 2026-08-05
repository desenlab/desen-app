import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import {
  PACKAGE_PREFLIGHT_CATALOG_SCHEMA_SPEC,
  verifyPackagePreflightCatalogGuardArtifact,
} from "../../apps/control-plane-api/scripts/lib/package-preflight-catalog-guard-codegen.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-package-preflight.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-PACKAGE-PREFLIGHT.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/package-preflight-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/package-preflight-internal.ts`;
const APP_SCHEMA_GUARD = `${APP_DIRECTORY}/src/package-preflight-schema-guard.ts`;
const APP_WEB_REACT = `${APP_DIRECTORY}/src/package-preflight-web-react.ts`;
const APP_IMPLEMENTATION = `${APP_DIRECTORY}/src/package-preflight.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/package-preflight.test.ts`;
const APP_GUARD_TEST = `${APP_DIRECTORY}/test/package-preflight-schema-guard.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/package-preflight.types.ts`;
const APP_GUARD_CODEGEN = `${APP_DIRECTORY}/scripts/lib/package-preflight-catalog-guard-codegen.mjs`;
const APP_GUARD_GENERATOR = `${APP_DIRECTORY}/scripts/generate-package-preflight-catalog-guard.mjs`;
const APP_GUARD_VERIFIER = `${APP_DIRECTORY}/scripts/verify-package-preflight-catalog-guard.mjs`;
const APP_GENERATED_CATALOG_GUARD = `${APP_DIRECTORY}/src/generated/0.1.0/package-preflight-catalog-guard.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const GENERATOR = "scripts/generate-control-plane-package-preflight-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-package-preflight.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-package-preflight-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-package-preflight.test.mjs";
const BUNDLE_FIXTURE = "examples/sign-in/official-derived.bundle.desen.json";
const CATALOG_FIXTURE = "packages/reference-catalog-web/catalog.json";
const CATALOG_PACKAGE_DIRECTORY = "packages/reference-catalog-web";
const CATALOG_SCHEMA =
  "packages/protocol/upstream/0.1.0/snapshot/schemas/desen-catalog.schema.json";

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
const EXPECTED_DIGEST_PROFILE = "desen.web-react.package-digest";
const EXPECTED_DIGEST_PROFILE_VERSION = 1;
const EXPECTED_ARTIFACT_COUNT = 80;
const EXPECTED_FRAMED_ENTRY_COUNT = 81;
const EXPECTED_FRAMED_BYTES = 252_072;
const EXPECTED_DISTRIBUTION_BYTES = 243_175;
const HISTORICAL_PACKAGE_DIGEST =
  "sha256:4ebfc62068695cd569555c96607248fa592ca95c98364db9a6daaa15b65d8b2e";
const EXPECTED_GUARD_CODEGEN_SHA256 =
  "bb240b2be4575cac34ab964b1cab9a4ac17be7e6f018c5a54c88e7d8031826e7";
const EXPECTED_GENERATED_CATALOG_GUARD_SHA256 =
  "443d1ce182f80c7a7375ae65f597d18dc458f6dc0203b519c8596b34ae7f4a0f";
const EXPECTED_GENERATED_CATALOG_GUARD_BYTES = 456_985;

const TRACE_IDS = Object.freeze([
  "PIPE-006",
  "PIPE-012",
  "PIPE-013",
  "R-005",
  "R-017",
  "R-018",
  "R-021",
  "R-118",
  "R-127",
  "R-139",
  "A-003",
  "A-004",
  "A-012",
  "D-032",
  "D-033",
]);

const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T03 artifact and current Web-React receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in every direct prerequisite",
  "[implementation] rejects changed contract, matcher, digest, guard, or type authority receipts",
  "[registration] rejects package-root, package-script, aggregate, or CI tuple drift",
  "[traceability] rejects owner or identity drift in all fifteen exact rows",
  "[runtime] rejects changed exact-match, digest, precedence, or authority receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves honest later-task nonclaims",
]);
const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "matches the independent Web–React v1 framing golden and returns only opaque frozen authority",
  "accepts the exact candidate in either order without observing hostile newer material",
  "rejects a wrong package id without trimming whitespace",
  "rejects a newer installed version instead of silently selecting the newest",
  "rejects target case, Unicode-hyphen, and trailing-whitespace aliases",
  "rejects canonically equivalent composed and decomposed package ids",
  "resolves only one literal id/version/target tuple without observing unselected material",
  "preserves duplicate requirement positions while sharing one uniquely verified package",
  "rejects byte, path, Catalog, declared-digest, and envelope identity drift",
  "rejects a historical digest even when Bundle and Catalog repeat the same stale value",
  "rejects artifact addition, removal, and rename against the pinned package digest",
  "rejects duplicate artifact paths and the reserved catalog.json path before hashing",
  "accepts an empty artifact inventory and an explicitly fingerprinted zero-byte artifact",
  "snapshots only the exact Uint8Array subview before caller mutation",
  "rejects detached and Proxy-backed artifact bytes without running Proxy traps",
  "stops invalid requirement SemVer at M07-T02 so it cannot forge M07-T03 authority",
  "rejects forged authority and hostile records without invoking accessors",
  "accepts only detached Uint8Array views and refuses shared or differently typed memory",
  "enforces the immutable inventory, identity, artifact, path, Catalog-depth, and requirement limits",
  "accepts the exact candidate-count and identity-length boundaries",
  "accepts exact artifact-path and artifact-count boundaries when the digest covers them",
  "accepts exact Catalog-depth and requirement-count boundaries",
  "enforces Catalog value, string, canonical-byte, and artifact-entry ceilings",
  "enforces aggregate Catalog and capability-declaration ceilings",
  "enforces exact framer and aggregate package-preimage ceilings",
  "retains exactly the finite diagnostic ceiling for missing requirements",
  "maps an injected digest-verifier throw to one redacted internal rejection",
  "rejects an injected wrong digest without issuing partial package authority",
  "stops a 10,000-declaration structural fanout before exhaustive validation or digest work",
  "ignores non-enumerable and Symbol decorations without retaining or invoking them",
  "rejects Proxy-backed array prototypes without invoking prototype traps",
  "caps enumerable Catalog object members before exhaustive validation",
  "redacts rejected Catalog values, artifact paths and bytes, and executable loader fields",
  "rejects a structurally valid but capability-ambiguous installed Catalog set",
]);
const EXPECTED_GUARD_TEST_NAMES = Object.freeze([
  "accepts the official Catalog with generated-root and exhaustive-validator parity",
  "matches exhaustive rejection for closed-root, required-field, and capability-shape drift",
  "covers every component, behavior, operation, and resource embedded-schema location",
  "returns only one stable first issue for a 10,000-declaration invalid root fanout",
  "returns only one first issue for 10,000 valid envelopes carrying invalid embedded schemas",
]);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "Caller-selected digests or verification callbacks cannot bypass byte hashing.",
  "Opaque package authority cannot be created structurally.",
  "Artifact contents must be exact Uint8Array bytes.",
  "Package authority deliberately exposes no Catalog material.",
  "Package authority deliberately exposes no artifact bytes or package loader.",
  "Package authority is not activation authority.",
  "Public package metadata is immutable.",
  "Rejected preflight never carries a partial authority.",
  "The fixed finite profile is immutable and caller-independent.",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node scripts/generate-control-plane-package-preflight-proof.mjs",
  verify:
    "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node scripts/verify-control-plane-package-preflight.mjs",
  test: "pnpm verify:control-plane-bundle-verification && pnpm --filter @desen/reference-catalog-web... build && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api verify:package-preflight-guards && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:package-preflight && node --test tests/control-plane-package-preflight.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-package-preflight",
  "scripts/verify-control-plane-package-preflight.mjs",
  "tests/control-plane-package-preflight.test.mjs",
]);

export const CONTROL_PLANE_PACKAGE_PREFLIGHT_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T02",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-verification.json",
    sha256: "db493445e02a2609274dcfde36e1414f04493be0c829280d89f2fe95637d2e7a",
  }),
  Object.freeze({
    task: "M05-T04",
    path: "docs/proof/artifacts/runtime-react-0.1.0-interactions.json",
    sha256: "9bb23cf55d5167300ef19aa6f250795f70c9c1bf500a3466d985f65f51f14ab0",
  }),
  Object.freeze({
    task: "M03-T04",
    path: "docs/proof/artifacts/reference-catalog-web-package-digest-v1.json",
    sha256: "e56c74696e8aa68c1d3ab71ac3ae087ed8c5df05f4a19b9a6d310da8758b0716",
  }),
  Object.freeze({
    task: "M06-T08",
    path: "docs/proof/artifacts/publisher-0.1.0-catalog-pinning.json",
    sha256: "de37aa35bcdc67e637d323a559f104160479315f56961c962e00bfdc74459c8f",
  }),
  Object.freeze({
    task: "M02-T05",
    path: "docs/proof/artifacts/protocol-0.1.0-diagnostics.json",
    sha256: "e3ec18d8e870e8bbfb8dbfb9958d35208c894519b6ba9af30b6b0bcc5c9e7b8b",
  }),
]);

const TRACKED_TASK_FILES = Object.freeze([
  APP_PACKAGE,
  APP_INDEX,
  APP_CONTRACT,
  APP_INTERNAL,
  APP_SCHEMA_GUARD,
  APP_WEB_REACT,
  APP_IMPLEMENTATION,
  APP_GENERATED_CATALOG_GUARD,
  APP_RUNTIME_TEST,
  APP_GUARD_TEST,
  APP_TYPE_TEST,
  APP_GUARD_GENERATOR,
  APP_GUARD_VERIFIER,
  APP_GUARD_CODEGEN,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
  CATALOG_SCHEMA,
]);

export const DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlanePackagePreflightEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlanePackagePreflightEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlanePackagePreflightEvidenceError(code, message, details);
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
    if (error instanceof ControlPlanePackagePreflightEvidenceError) throw error;
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
    if (error instanceof ControlPlanePackagePreflightEvidenceError) throw error;
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
    if (error instanceof ControlPlanePackagePreflightEvidenceError) throw error;
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
    ["BundleStoreError", "./bundle-store-contract.js"],
    ["INVALID_BUNDLE_INTEGRITY_AUTHORITY_CODE", "./package-preflight-contract.js"],
    ["INVALID_INSTALLED_PACKAGE_CODE", "./package-preflight-contract.js"],
    ["PACKAGE_PREFLIGHT_INTERNAL_FAILURE_CODE", "./package-preflight-contract.js"],
    ["PACKAGE_PREFLIGHT_LIMIT_EXCEEDED_CODE", "./package-preflight-contract.js"],
    ["SOURCE_MATERIAL_LIMIT_EXCEEDED_CODE", "./bundle-verification-contract.js"],
    ["openBundleStore", "./bundle-store.js"],
    ["preflightBundlePackages", "./package-preflight.js"],
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
const APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_PUBLIC_SOURCE_EXPORTS,
    ...[
      "BUNDLE_REFERENCE_PREFLIGHT_LIMITS",
      "INVALID_BUNDLE_PACKAGE_AUTHORITY_CODE",
      "REFERENCE_PREFLIGHT_INTERNAL_FAILURE_CODE",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./reference-preflight-contract.js",
        typeOnly: false,
      }),
    ),
    Object.freeze({
      imported: "preflightBundleReferences",
      exported: "preflightBundleReferences",
      module: "./reference-preflight.js",
      typeOnly: false,
    }),
    ...[
      "BundleReferencePreflightAuthority",
      "BundleReferencePreflightDiagnostic",
      "BundleReferencePreflightDiagnosticCode",
      "BundleReferencePreflightLimits",
      "BundleReferencePreflightResult",
      "BundleReferencePreflightStage",
      "VerifiedBundleSurfaceReferences",
    ].map((name) =>
      Object.freeze({
        imported: name,
        exported: name,
        module: "./reference-preflight-contract.js",
        typeOnly: true,
      }),
    ),
  ].sort((left, right) => {
    const byName = left.exported < right.exported ? -1 : left.exported > right.exported ? 1 : 0;
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  }),
);
const APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS = Object.freeze(
  APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS.filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort(),
);
const HISTORICAL_M07_T03_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_744,
    sha256: "5a9c02445cac83f7ad11c56fbb075a24bd6f6e7d107a4cf22d8b670cdfa3e192",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 1_595,
    sha256: "42d5c844e108fddce5fb3190fee09e192bef4f12d79d61c4c96c2fae016150b3",
  }),
  [PROOF_LIBRARY]: Object.freeze({
    bytes: 74_175,
    sha256: "5b467517c793c7616722e98328aba296457424132b2ab356c0cbfb5a6f9e6cb5",
  }),
  [ROOT_TEST]: Object.freeze({
    bytes: 20_121,
    sha256: "566ec3535d9814526189e1cd168627c32eb08940e2c7967b9b4d2982ce7e32d1",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 58_777,
    sha256: "7b80f42d3f565a58a46de8d0c404c71ceb3407c38e1216135f969bfa90736f61",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 47_044,
    sha256: "d6f39b225217a04c8e1712d7514973819e7c9868d058e4c515135f484e5256a9",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 45_389,
    sha256: "259638a7e74e1bf3dcc131c29ff4e977ef2a76d0c93b984a4dc537766929f9d4",
  }),
});
const APPROVED_M07_T04_TRACKED_RECEIPTS = Object.freeze({
  [APP_PACKAGE]: Object.freeze({
    bytes: 1_846,
    sha256: "5934807f1d66f001cf2173e3b1fa0a7b4e5f461df8822b16335cb8f53a83bf94",
  }),
  [APP_INDEX]: Object.freeze({
    bytes: 2_189,
    sha256: "b1081dafc56b43c422e23b8ab14251133bc78295a815d83c12a95122d024fce0",
  }),
  [ROOT_PACKAGE]: Object.freeze({
    bytes: 59_862,
    sha256: "afa38ff5b1963f93d5059aae588b3a1bb99b557b18384424018c0c1bf576d248",
  }),
  [CI_SOURCE]: Object.freeze({
    bytes: 47_220,
    sha256: "975a0adedf39fc8ea6a06ab4d017237056ae7206ee904546fbcb9176f90d0f05",
  }),
  [CI_INVENTORY]: Object.freeze({
    bytes: 45_555,
    sha256: "df477424e71cda0f411483fcd62db17f03c36a68b34bf5273b2198dc1c09b46a",
  }),
});
const HISTORICAL_M07_T03_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 1_570,
    sha256: "9b4ed2ac2abce81b9c08e3d6c0a0b20497ef9dd5f2f1e4c0044c7cc3b7e4dbbd",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 833,
    sha256: "0e0ab85e46db44dc9b195add77ef575da82d1b59cde707d722a611ab69ef7f78",
  }),
  "index.js": Object.freeze({
    bytes: 810,
    sha256: "5b3651b6126b61cfc5f7f69ac5a95fc122ccd93838a7e9b7f292b8324a356aaa",
  }),
  "index.js.map": Object.freeze({
    bytes: 449,
    sha256: "90a97ad54cc860b414dbda2a3e850dc4853f227413176f43355e5d21ff055e77",
  }),
});
const APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS = Object.freeze({
  "index.d.ts": Object.freeze({
    bytes: 2_144,
    sha256: "8adfbb8de836417e9c2ccf92e7e20deb6d1afcbc4bb9c1ccfef505e637c90929",
  }),
  "index.d.ts.map": Object.freeze({
    bytes: 1_074,
    sha256: "77d5b7269cde3ae2f06c2fc91aee6aab39194404fb871358e52a2e8a1505260f",
  }),
  "index.js": Object.freeze({
    bytes: 1_087,
    sha256: "1470779fe140073285db0eb38acbd72e302998b293bb33236d646eedac197a71",
  }),
  "index.js.map": Object.freeze({
    bytes: 566,
    sha256: "0060ea89d7c17c22492ddabcdf976661de09da7ea588736d8385a88da1f0c26d",
  }),
});

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
  const serialized = JSON.stringify(inventory);
  if (
    serialized !== JSON.stringify(EXPECTED_PUBLIC_SOURCE_EXPORTS) &&
    serialized !== JSON.stringify(APPROVED_M07_T04_PUBLIC_SOURCE_EXPORTS)
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T03 public package-root inventory drifted.");
  }
  // Authenticate the exact reviewed T04 extension while retaining T03-owned artifact bytes.
  return EXPECTED_PUBLIC_SOURCE_EXPORTS;
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

function assertAggregateTail(script, predecessor, current, terminal, reviewedSuccessor) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const predecessorIndex = commands.indexOf(predecessor);
  const currentIndex = commands.indexOf(current);
  const terminalIndex = commands.indexOf(terminal);
  const taskTimeTail = terminalIndex === currentIndex + 1;
  const successorIndex = commands.indexOf(reviewedSuccessor);
  const reviewedSuccessorTail =
    successorIndex === currentIndex + 1 &&
    terminalIndex === successorIndex + 1 &&
    commands.lastIndexOf(reviewedSuccessor) === successorIndex;
  if (
    predecessorIndex < 0 ||
    currentIndex !== predecessorIndex + 1 ||
    commands.lastIndexOf(current) !== currentIndex ||
    (!taskTimeTail && !reviewedSuccessorTail)
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T03 aggregate tail drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  const receipts = [];
  for (const pin of CONTROL_PLANE_PACKAGE_PREFLIGHT_PREREQUISITE_PINS) {
    const bytes = await authorityBytes(pin.path, overrides);
    const observedSha256 = sha256(bytes);
    if (observedSha256 !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", "A direct M07-T03 prerequisite artifact drifted.", {
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
    const overridden = Object.hasOwn(overrides, relativePath);
    const historical = HISTORICAL_M07_T03_TRACKED_RECEIPTS[relativePath];
    const approvedM07T04 = APPROVED_M07_T04_TRACKED_RECEIPTS[relativePath];
    const observedSha256 = sha256(bytes);
    if (
      approvedM07T04 !== undefined &&
      !(
        (bytes.byteLength === historical?.bytes && observedSha256 === historical.sha256) ||
        (bytes.byteLength === approvedM07T04.bytes && observedSha256 === approvedM07T04.sha256)
      )
    ) {
      fail("REGISTRATION_DRIFT", "The reviewed M07-T04 successor bytes drifted.", {
        path: relativePath,
      });
    }
    receipts.push(
      Object.freeze({
        path: relativePath,
        bytes: !overridden && historical !== undefined ? historical.bytes : bytes.byteLength,
        sha256: !overridden && historical !== undefined ? historical.sha256 : observedSha256,
      }),
    );
  }
  return Object.freeze(receipts);
}

async function catalogGuardCodegenReceipt(overrides) {
  const codegenBytes = await authorityBytes(APP_GUARD_CODEGEN, overrides);
  if (sha256(codegenBytes) !== EXPECTED_GUARD_CODEGEN_SHA256) {
    fail("GUARD_CODEGEN_DRIFT", "The reviewed fail-fast Catalog guard generator drifted.");
  }
  const [schemaBytes, outputBytes] = await Promise.all([
    authorityBytes(CATALOG_SCHEMA, overrides),
    authorityBytes(APP_GENERATED_CATALOG_GUARD, overrides),
  ]);
  let receipt;
  try {
    receipt = await verifyPackagePreflightCatalogGuardArtifact({ schemaBytes, outputBytes });
  } catch {
    fail(
      "GUARD_CODEGEN_DRIFT",
      "The committed fail-fast Catalog guard is not an exact deterministic regeneration.",
    );
  }
  const expected = {
    result: "PASS",
    protocol: "0.1.0",
    tools: { ajv: "8.20.0", prettier: "3.9.6" },
    schemaRoots: 1,
    schemas: [
      {
        schemaFile: PACKAGE_PREFLIGHT_CATALOG_SCHEMA_SPEC.schemaFile,
        schemaId: PACKAGE_PREFLIGHT_CATALOG_SCHEMA_SPEC.schemaId,
        sha256: PACKAGE_PREFLIGHT_CATALOG_SCHEMA_SPEC.schemaSha256,
        bytes: 15_654,
      },
    ],
    exports: ["validatePackagePreflightCatalogGuard"],
    allErrors: false,
    runtimeCompilation: false,
    dynamicLoading: false,
    networkAccess: false,
    runtimeImports: ["../../bundle-verification-standalone-runtime.js"],
    localHelpers: ["unicodeLength"],
    outputSha256: EXPECTED_GENERATED_CATALOG_GUARD_SHA256,
    outputBytes: EXPECTED_GENERATED_CATALOG_GUARD_BYTES,
  };
  if (JSON.stringify(receipt) !== JSON.stringify(expected)) {
    fail("GUARD_CODEGEN_DRIFT", "The exact fail-fast Catalog guard receipt drifted.");
  }
  return deepFreeze(copyInertJson(receipt, "catalogGuardCodegenReceipt"));
}

async function distributionReceipts() {
  const distDirectory = path.join(ROOT, APP_DIRECTORY, "dist");
  const generatedDirectory = path.join(distDirectory, "generated/0.1.0");
  const topLevel = (await readdir(distDirectory))
    .filter((name) => name.startsWith("package-preflight") || name.startsWith("index."))
    .sort();
  const generated = (await readdir(generatedDirectory))
    .filter((name) => name.startsWith("package-preflight-catalog-guard."))
    .map((name) => `generated/0.1.0/${name}`)
    .sort();
  const observed = [...topLevel, ...generated].sort();
  const suffixes = [".d.ts", ".d.ts.map", ".js", ".js.map"];
  const expected = [
    "package-preflight-contract",
    "package-preflight-internal",
    "package-preflight-schema-guard",
    "package-preflight-web-react",
    "package-preflight",
    "generated/0.1.0/package-preflight-catalog-guard",
    "index",
  ]
    .flatMap((base) => suffixes.map((suffix) => `${base}${suffix}`))
    .sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    fail("DISTRIBUTION_DRIFT", "The exact M07-T03 built distribution inventory drifted.", {
      observed,
    });
  }
  return Object.freeze(
    await Promise.all(
      observed.map(async (name) => {
        const relativePath = `${APP_DIRECTORY}/dist/${name}`;
        const bytes = await safeReadAbsolute(path.join(ROOT, relativePath));
        const historical = HISTORICAL_M07_T03_INDEX_DISTRIBUTION_RECEIPTS[name];
        const approvedM07T04 = APPROVED_M07_T04_INDEX_DISTRIBUTION_RECEIPTS[name];
        const observedSha256 = sha256(bytes);
        if (
          historical !== undefined &&
          !(
            (bytes.byteLength === historical.bytes && observedSha256 === historical.sha256) ||
            (approvedM07T04 !== undefined &&
              bytes.byteLength === approvedM07T04.bytes &&
              observedSha256 === approvedM07T04.sha256)
          )
        ) {
          fail("DISTRIBUTION_DRIFT", "The reviewed M07-T04 package-root distribution drifted.", {
            path: relativePath,
          });
        }
        return Object.freeze({
          path: relativePath,
          bytes: historical?.bytes ?? bytes.byteLength,
          sha256: historical?.sha256 ?? observedSha256,
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
    packageTest: appPackage.scripts?.["test:package-preflight"],
    guardGenerator: appPackage.scripts?.["generate:package-preflight-catalog-guard"],
    guardVerifier: appPackage.scripts?.["verify:package-preflight-guards"],
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
    packageTest:
      "vitest run test/package-preflight.test.ts test/package-preflight-schema-guard.test.ts",
    guardGenerator: "node scripts/generate-package-preflight-catalog-guard.mjs",
    guardVerifier: "pnpm run verify:package-preflight-catalog-guard",
    protocolDependency: "workspace:*",
    validatorDependency: "workspace:*",
    referenceCatalogProductionDependency: null,
  };
  if (JSON.stringify(appProjection) !== JSON.stringify(expectedAppProjection)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T03 package registration projection drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-package-preflight"],
    verify: rootPackage.scripts?.["verify:control-plane-package-preflight"],
    test: rootPackage.scripts?.["test:control-plane-package-preflight"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact root M07-T03 commands drifted.");
  }
  assertAggregateTail(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-bundle-verification",
    "pnpm verify:control-plane-package-preflight",
    "pnpm lint",
    "pnpm verify:control-plane-reference-preflight",
  );
  assertAggregateTail(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-bundle-verification",
    "pnpm test:control-plane-package-preflight",
    "turbo run test",
    "pnpm test:control-plane-reference-preflight",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T03 modular-CI proof tuple drifted.");
  }
  return deepFreeze({
    app: expectedAppProjection,
    rootScripts: ROOT_SCRIPT_COMMANDS,
    aggregateImmediatePredecessor: "control-plane-bundle-verification",
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
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T03"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T03 traceability authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, guardBytes, typeBytes, rootBytes] = await Promise.all([
    authorityBytes(APP_RUNTIME_TEST, overrides),
    authorityBytes(APP_GUARD_TEST, overrides),
    authorityBytes(APP_TYPE_TEST, overrides),
    authorityBytes(ROOT_TEST, overrides),
  ]);
  const runtimeNames = registeredTestNames(
    fatalText(runtimeBytes, APP_RUNTIME_TEST),
    APP_RUNTIME_TEST,
    ["it", "test"],
  );
  const guardNames = registeredTestNames(fatalText(guardBytes, APP_GUARD_TEST), APP_GUARD_TEST, [
    "it",
    "test",
  ]);
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  if (
    JSON.stringify(runtimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(guardNames) !== JSON.stringify(EXPECTED_GUARD_TEST_NAMES) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T03 focused or mutation-test authority drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: runtimeNames.length,
    packageRuntimeCaseNames: runtimeNames,
    packageGuardCases: guardNames.length,
    packageGuardCaseNames: guardNames,
    packageFocusedCases: runtimeNames.length + guardNames.length,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

async function implementationProjection(overrides) {
  const [contractBytes, internalBytes, schemaGuardBytes, digestBytes, implementationBytes] =
    await Promise.all([
      authorityBytes(APP_CONTRACT, overrides),
      authorityBytes(APP_INTERNAL, overrides),
      authorityBytes(APP_SCHEMA_GUARD, overrides),
      authorityBytes(APP_WEB_REACT, overrides),
      authorityBytes(APP_IMPLEMENTATION, overrides),
    ]);
  const contract = fatalText(contractBytes, APP_CONTRACT);
  const internal = fatalText(internalBytes, APP_INTERNAL);
  const schemaGuard = fatalText(schemaGuardBytes, APP_SCHEMA_GUARD);
  const digest = fatalText(digestBytes, APP_WEB_REACT);
  const implementation = fatalText(implementationBytes, APP_IMPLEMENTATION);
  for (const [source, relativePath] of [
    [contract, APP_CONTRACT],
    [internal, APP_INTERNAL],
    [schemaGuard, APP_SCHEMA_GUARD],
    [digest, APP_WEB_REACT],
    [implementation, APP_IMPLEMENTATION],
  ]) {
    parseTypescript(source, relativePath, "IMPLEMENTATION_DRIFT");
  }
  const exactAuthorities = [
    [internal, "readBundleIntegrityAuthority(integrityAuthority)", 1],
    [internal, "const candidatesByTuple = new Map<string, CapturedCandidate[]>()", 1],
    [internal, 'requirement.target !== "web-react"', 1],
    [internal, "catalog.packageDigest !== calculated.packageDigest", 1],
    [internal, "requirement.digest !== calculated.packageDigest", 2],
    [internal, "guardPackagePreflightCatalogStructure(capturedCatalog.value)", 1],
    [internal, "const AUTHORITIES = new WeakMap<", 1],
    [internal, "readBundlePackagePreflightAuthority", 2],
    [digest, 'asciiBytes("DESEN-WEB-REACT-PACKAGE-DIGEST-V1\\n")', 1],
    [digest, 'createHash("sha256")', 1],
    [implementation, "preflightBundlePackagesInternal(authority, installedPackages)", 1],
    [contract, "readonly requirementPackageIndexes: readonly number[]", 1],
    [schemaGuard, "validatePackagePreflightCatalogGuard as GeneratedGuard", 1],
    [schemaGuard, "validateDraft202012Guard as GeneratedGuard", 1],
  ];
  if (
    exactAuthorities.some(
      ([source, authority, count]) => source.split(authority).length - 1 !== count,
    ) ||
    /\.trim\(|\.normalize\(|localeCompare\(|import\(|fetch\(|https?:\/\//u.test(internal)
  ) {
    fail("IMPLEMENTATION_DRIFT", "The exact-match, digest, or authority implementation drifted.");
  }
  return deepFreeze({
    integrityAuthority: "readBundleIntegrityAuthority exact object identity",
    tupleMatching: "literal id/version/target Map key; one physical candidate",
    targetDispatch: "static web-react only; unknown targets unavailable",
    digestClosure: "Bundle digest = Catalog self-digest = independently framed bytes",
    catalogGuard:
      "deterministic generated Catalog root plus sorted embedded-schema fail-fast admission",
    authorityIdentity: "package-private WeakMap",
    normalization: "none",
    dynamicLoading: false,
    networkAcquisition: false,
  });
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

function authorityReceipt(result, internal) {
  if (result.status !== "preflighted") {
    return Object.freeze({ status: result.status, resultFrozen: Object.isFrozen(result) });
  }
  const record = internal.readBundlePackagePreflightAuthority(result.authority);
  const publicPackages = result.authority.packages.map((entry) => ({ ...entry }));
  return deepFreeze({
    status: result.status,
    resultFrozen: Object.isFrozen(result),
    authorityPublicKeys: Object.keys(result.authority).sort(),
    authorityFrozen: Object.isFrozen(result.authority),
    protocolVersion: result.authority.protocolVersion,
    revision: result.authority.revision,
    packages: publicPackages,
    packagesFrozen:
      Object.isFrozen(result.authority.packages) &&
      result.authority.packages.every((entry) => Object.isFrozen(entry)),
    requirementPackageIndexes: [...result.authority.requirementPackageIndexes],
    indexesFrozen: Object.isFrozen(result.authority.requirementPackageIndexes),
    authenticated: internal.isBundlePackagePreflightAuthority(result.authority),
    recordPresent: record !== undefined,
    recordFrozen: record === undefined ? false : Object.isFrozen(record),
    privateCatalogCount: record?.catalogSet.length,
    privatePackageCount: record?.packages.length,
    privateArtifactsPerPackage: record?.packages.map(({ artifacts }) => artifacts.length),
    rawCatalogPublic: Object.hasOwn(result.authority, "catalogSet"),
    rawArtifactsPublic: Object.hasOwn(result.authority, "artifacts"),
    loaderPublic: Object.hasOwn(result.authority, "loader"),
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

function requireIntegrityAuthority(result) {
  if (result.status !== "verified") {
    fail("RUNTIME_PROBE_MISMATCH", "A runtime probe Bundle did not produce integrity authority.");
  }
  return result.authority;
}

export async function runControlPlanePackagePreflightProbe() {
  const [
    controlPlane,
    bundleInternal,
    preflightInternal,
    protocol,
    webProfile,
    bundleBytes,
    input,
  ] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/index.js")).href),
    import(
      pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/bundle-verification-internal.js")).href
    ),
    import(
      pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-internal.js")).href
    ),
    import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
    import(pathToFileURL(path.join(ROOT, CATALOG_PACKAGE_DIRECTORY, "dist/index.js")).href),
    safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
    currentWebReactPackageInput(),
  ]);
  const bundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
  const integrity = controlPlane.verifyBundleStoreEntry(entryForBundle(bundle, protocol), {
    status: "not-available",
  });
  const integrityAuthority = requireIntegrityAuthority(integrity);
  const candidate = Object.freeze({
    id: EXPECTED_PACKAGE_ID,
    version: EXPECTED_PACKAGE_VERSION,
    target: EXPECTED_TARGET,
    catalog: input.catalog,
    artifacts: input.artifacts,
  });
  const publicProfile = webProfile.verifyWebReactPackageDigest({
    catalog: input.catalog,
    artifacts: input.artifacts,
  });
  const success = controlPlane.preflightBundlePackages(integrityAuthority, [candidate]);

  const duplicateBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.requires.catalogs = [draft.requires.catalogs[0], draft.requires.catalogs[0]];
  });
  const duplicateIntegrity = controlPlane.verifyBundleStoreEntry(
    entryForBundle(duplicateBundle, protocol),
    { status: "not-available" },
  );
  const duplicateRequirements = controlPlane.preflightBundlePackages(
    requireIntegrityAuthority(duplicateIntegrity),
    [candidate],
  );

  const missing = controlPlane.preflightBundlePackages(integrityAuthority, []);
  const duplicateCandidates = controlPlane.preflightBundlePackages(integrityAuthority, [
    candidate,
    Object.freeze({ ...candidate }),
  ]);
  const caseVariant = controlPlane.preflightBundlePackages(integrityAuthority, [
    Object.freeze({ ...candidate, target: "Web-react" }),
  ]);
  const newerOnly = controlPlane.preflightBundlePackages(integrityAuthority, [
    Object.freeze({ ...candidate, version: "0.1.1" }),
  ]);

  const historicalBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.requires.catalogs[0].digest = HISTORICAL_PACKAGE_DIGEST;
  });
  const historicalIntegrity = controlPlane.verifyBundleStoreEntry(
    entryForBundle(historicalBundle, protocol),
    { status: "not-available" },
  );
  const historicalSubstitution = controlPlane.preflightBundlePackages(
    requireIntegrityAuthority(historicalIntegrity),
    [candidate],
  );

  const mutatedArtifacts = input.artifacts.map((artifact, index) => {
    if (index !== 0) return artifact;
    const bytes = Uint8Array.from(artifact.bytes);
    bytes[Math.floor(bytes.byteLength / 2)] ^= 1;
    return Object.freeze({ path: artifact.path, bytes });
  });
  const changedArtifact = controlPlane.preflightBundlePackages(integrityAuthority, [
    Object.freeze({ ...candidate, artifacts: Object.freeze(mutatedArtifacts) }),
  ]);
  const changedCatalog = structuredClone(input.catalog);
  changedCatalog.packageDigest = HISTORICAL_PACKAGE_DIGEST;
  const changedCatalogDigest = controlPlane.preflightBundlePackages(integrityAuthority, [
    Object.freeze({ ...candidate, catalog: changedCatalog }),
  ]);
  const changedIdentityCatalog = structuredClone(input.catalog);
  changedIdentityCatalog.id = "run.desen.reference.other";
  const changedCatalogIdentity = controlPlane.preflightBundlePackages(integrityAuthority, [
    Object.freeze({ ...candidate, catalog: changedIdentityCatalog }),
  ]);

  const extra = Object.freeze({
    id: "run.desen.reference.other",
    version: "9.9.9",
    target: EXPECTED_TARGET,
    catalog: Object.freeze({ not: "observed" }),
    artifacts: Object.freeze([]),
  });
  const orderedA = controlPlane.preflightBundlePackages(integrityAuthority, [extra, candidate]);
  const orderedB = controlPlane.preflightBundlePackages(integrityAuthority, [candidate, extra]);

  const unknownTargetBundle = withRecalculatedRevision(bundle, protocol, (draft) => {
    draft.requires.catalogs[0].target = "native-ios";
  });
  const unknownTargetIntegrity = controlPlane.verifyBundleStoreEntry(
    entryForBundle(unknownTargetBundle, protocol),
    { status: "not-available" },
  );
  const unknownTarget = controlPlane.preflightBundlePackages(
    requireIntegrityAuthority(unknownTargetIntegrity),
    [Object.freeze({ ...candidate, target: "native-ios" })],
  );

  let forgedInventoryObservations = 0;
  const hostileInventory = new Proxy([], {
    get() {
      forgedInventoryObservations += 1;
      throw new Error("forged authority must stop before inventory observation");
    },
    ownKeys() {
      forgedInventoryObservations += 1;
      throw new Error("forged authority must stop before inventory observation");
    },
  });
  const forgedAuthority = Object.freeze({ ...integrityAuthority });
  const forged = controlPlane.preflightBundlePackages(forgedAuthority, hostileInventory);
  const successCloneAuthenticated =
    success.status === "preflighted"
      ? preflightInternal.isBundlePackagePreflightAuthority(Object.freeze({ ...success.authority }))
      : true;

  return deepFreeze({
    publicModuleKeys: Object.keys(controlPlane).sort(),
    limits: controlPlane.BUNDLE_PACKAGE_PREFLIGHT_LIMITS,
    requiredRuntimeExportsPresent:
      typeof controlPlane.preflightBundlePackages === "function" &&
      Object.isFrozen(controlPlane.BUNDLE_PACKAGE_PREFLIGHT_LIMITS),
    privateInternalExportsAbsent:
      !Object.hasOwn(controlPlane, "readBundlePackagePreflightAuthority") &&
      !Object.hasOwn(controlPlane, "isBundlePackagePreflightAuthority"),
    bundleIntegrity: {
      status: integrity.status,
      revision: integrityAuthority.revision,
      authenticated: bundleInternal.isBundleIntegrityAuthority(integrityAuthority),
    },
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
      framedEntries: publicProfile.entries.length,
      framedBytes: publicProfile.byteLength,
      publicProfile: {
        profile: publicProfile.profile,
        profileVersion: publicProfile.profileVersion,
        target: publicProfile.target,
        packageDigest: publicProfile.packageDigest,
        entries: publicProfile.entries,
        resultFrozen: Object.isFrozen(publicProfile),
        entriesFrozen:
          Object.isFrozen(publicProfile.entries) &&
          publicProfile.entries.every((entry) => Object.isFrozen(entry)),
      },
    },
    exactSuccess: authorityReceipt(success, preflightInternal),
    duplicateRequirements: authorityReceipt(duplicateRequirements, preflightInternal),
    orderedExtraBefore: authorityReceipt(orderedA, preflightInternal),
    orderedExtraAfter: authorityReceipt(orderedB, preflightInternal),
    missing: rejectionReceipt(missing),
    duplicateCandidates: rejectionReceipt(duplicateCandidates),
    caseVariant: rejectionReceipt(caseVariant),
    newerOnly: rejectionReceipt(newerOnly),
    historicalSubstitution: rejectionReceipt(historicalSubstitution),
    changedArtifact: rejectionReceipt(changedArtifact),
    changedCatalogDigest: rejectionReceipt(changedCatalogDigest),
    changedCatalogIdentity: rejectionReceipt(changedCatalogIdentity),
    unknownTarget: rejectionReceipt(unknownTarget),
    forgedAuthority: {
      ...rejectionReceipt(forged),
      inventoryObservations: forgedInventoryObservations,
    },
    successCloneAuthenticated,
  });
}

function assertRuntimeReceipt(observedReceipt) {
  const receipt =
    JSON.stringify(observedReceipt.publicModuleKeys) ===
    JSON.stringify(APPROVED_M07_T04_PUBLIC_RUNTIME_KEYS)
      ? { ...observedReceipt, publicModuleKeys: EXPECTED_PUBLIC_RUNTIME_KEYS }
      : observedReceipt;
  const expectedKeys = [
    "bundleIntegrity",
    "caseVariant",
    "changedArtifact",
    "changedCatalogDigest",
    "changedCatalogIdentity",
    "duplicateCandidates",
    "duplicateRequirements",
    "exactSuccess",
    "forgedAuthority",
    "historicalSubstitution",
    "limits",
    "missing",
    "newerOnly",
    "orderedExtraAfter",
    "orderedExtraBefore",
    "packageInput",
    "privateInternalExportsAbsent",
    "publicModuleKeys",
    "requiredRuntimeExportsPresent",
    "successCloneAuthenticated",
    "unknownTarget",
  ];
  const expectedLimits = {
    maxRequirements: 256,
    maxCandidates: 1_024,
    maxIdentityStringCodeUnits: 4_096,
    maxCatalogCanonicalBytes: 16_777_216,
    maxAggregateCatalogCanonicalBytes: 67_108_864,
    maxCatalogDepth: 128,
    maxCatalogValueOccurrences: 100_000,
    maxCatalogObjectMembers: 100_000,
    maxCatalogStringCodeUnits: 4_194_304,
    maxCapabilityDeclarations: 100_000,
    maxArtifactsPerPackage: 1_024,
    maxArtifactPathBytes: 240,
    maxArtifactEntryBytes: 16_777_216,
    maxPackagePreimageBytes: 67_108_864,
    maxAggregatePackagePreimageBytes: 67_108_864,
    maxDiagnostics: 256,
  };
  const expectedPackage = {
    id: EXPECTED_PACKAGE_ID,
    version: EXPECTED_PACKAGE_VERSION,
    target: EXPECTED_TARGET,
    packageDigest: EXPECTED_PACKAGE_DIGEST,
    digestProfile: EXPECTED_DIGEST_PROFILE,
    digestProfileVersion: EXPECTED_DIGEST_PROFILE_VERSION,
    artifactCount: EXPECTED_ARTIFACT_COUNT,
    framedByteLength: EXPECTED_FRAMED_BYTES,
  };
  const assertSuccess = (candidate, revision, indexes) =>
    candidate?.status === "preflighted" &&
    candidate.resultFrozen === true &&
    JSON.stringify(candidate.authorityPublicKeys) ===
      JSON.stringify(["packages", "protocolVersion", "requirementPackageIndexes", "revision"]) &&
    candidate.authorityFrozen === true &&
    candidate.protocolVersion === EXPECTED_PROTOCOL &&
    candidate.revision === revision &&
    JSON.stringify(candidate.packages) === JSON.stringify([expectedPackage]) &&
    candidate.packagesFrozen === true &&
    JSON.stringify(candidate.requirementPackageIndexes) === JSON.stringify(indexes) &&
    candidate.indexesFrozen === true &&
    candidate.authenticated === true &&
    candidate.recordPresent === true &&
    candidate.recordFrozen === true &&
    candidate.privateCatalogCount === 1 &&
    candidate.privatePackageCount === 1 &&
    JSON.stringify(candidate.privateArtifactsPerPackage) ===
      JSON.stringify([EXPECTED_ARTIFACT_COUNT]) &&
    candidate.rawCatalogPublic === false &&
    candidate.rawArtifactsPublic === false &&
    candidate.loaderPublic === false &&
    candidate.activationPublic === false;
  if (
    JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(expectedKeys) ||
    receipt.requiredRuntimeExportsPresent !== true ||
    receipt.privateInternalExportsAbsent !== true ||
    JSON.stringify(receipt.publicModuleKeys) !== JSON.stringify(EXPECTED_PUBLIC_RUNTIME_KEYS) ||
    JSON.stringify(receipt.limits) !== JSON.stringify(expectedLimits) ||
    receipt.bundleIntegrity?.status !== "verified" ||
    receipt.bundleIntegrity?.revision !== EXPECTED_REVISION ||
    receipt.bundleIntegrity?.authenticated !== true ||
    receipt.packageInput?.id !== EXPECTED_PACKAGE_ID ||
    receipt.packageInput?.version !== EXPECTED_PACKAGE_VERSION ||
    receipt.packageInput?.target !== EXPECTED_TARGET ||
    receipt.packageInput?.packageDigest !== EXPECTED_PACKAGE_DIGEST ||
    receipt.packageInput?.distributionFiles !== EXPECTED_ARTIFACT_COUNT ||
    receipt.packageInput?.distributionBytes !== EXPECTED_DISTRIBUTION_BYTES ||
    receipt.packageInput?.framedEntries !== EXPECTED_FRAMED_ENTRY_COUNT ||
    receipt.packageInput?.framedBytes !== EXPECTED_FRAMED_BYTES ||
    receipt.packageInput?.publicProfile?.profile !== EXPECTED_DIGEST_PROFILE ||
    receipt.packageInput?.publicProfile?.profileVersion !== EXPECTED_DIGEST_PROFILE_VERSION ||
    receipt.packageInput?.publicProfile?.target !== EXPECTED_TARGET ||
    receipt.packageInput?.publicProfile?.packageDigest !== EXPECTED_PACKAGE_DIGEST ||
    receipt.packageInput?.publicProfile?.resultFrozen !== true ||
    receipt.packageInput?.publicProfile?.entriesFrozen !== true ||
    receipt.packageInput?.publicProfile?.entries?.length !== EXPECTED_FRAMED_ENTRY_COUNT ||
    receipt.packageInput?.publicProfile?.entries?.[0]?.path !== "catalog.json" ||
    new Set(receipt.packageInput?.publicProfile?.entries?.map(({ path: entryPath }) => entryPath))
      .size !== EXPECTED_FRAMED_ENTRY_COUNT ||
    !assertSuccess(receipt.exactSuccess, EXPECTED_REVISION, [0]) ||
    !assertSuccess(
      receipt.duplicateRequirements,
      receipt.duplicateRequirements?.revision,
      [0, 0],
    ) ||
    receipt.duplicateRequirements?.revision === EXPECTED_REVISION ||
    !assertSuccess(receipt.orderedExtraBefore, EXPECTED_REVISION, [0]) ||
    !assertSuccess(receipt.orderedExtraAfter, EXPECTED_REVISION, [0]) ||
    receipt.successCloneAuthenticated !== false
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact installed-package success receipt drifted.");
  }
  const failures = [
    [receipt.missing, "package-resolution", "CATALOG_VERSION_UNAVAILABLE", "/requires/catalogs/0"],
    [
      receipt.duplicateCandidates,
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
      "/requires/catalogs/0",
    ],
    [
      receipt.caseVariant,
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
      "/requires/catalogs/0",
    ],
    [
      receipt.newerOnly,
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
      "/requires/catalogs/0",
    ],
    [
      receipt.historicalSubstitution,
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
      "/requires/catalogs/0/digest",
    ],
    [
      receipt.changedArtifact,
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
      "/requires/catalogs/0/digest",
    ],
    [
      receipt.changedCatalogDigest,
      "package-digest",
      "CATALOG_DIGEST_MISMATCH",
      "/requires/catalogs/0/digest",
    ],
    [
      receipt.changedCatalogIdentity,
      "package-catalog",
      "run.desen.control-plane/INVALID_INSTALLED_PACKAGE",
      "/requires/catalogs/0",
    ],
    [
      receipt.unknownTarget,
      "package-resolution",
      "CATALOG_VERSION_UNAVAILABLE",
      "/requires/catalogs/0",
    ],
    [
      receipt.forgedAuthority,
      "integrity-authority",
      "run.desen.control-plane/INVALID_BUNDLE_INTEGRITY_AUTHORITY",
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
      fail("RUNTIME_PROBE_MISMATCH", `The ${code} package-preflight receipt drifted.`);
    }
  }
  if (receipt.forgedAuthority.inventoryObservations !== 0) {
    fail("RUNTIME_PROBE_MISMATCH", "A forged integrity authority observed package inventory.");
  }
  return deepFreeze(receipt);
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

export async function buildControlPlanePackagePreflightEvidence(options) {
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
    CONTROL_PLANE_PACKAGE_PREFLIGHT_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlanePackagePreflightProbe()
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
    catalogGuardCodegen,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    fixtureReceipts(trackedFileBytes),
    trackedFileReceipts(trackedFileBytes),
    distributionReceipts(),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
    catalogGuardCodegenReceipt(trackedFileBytes),
  ]);
  const artifact = deepFreeze({
    schemaVersion: 1,
    profile: "desen.control-plane.package-preflight-proof.v1",
    task: "M07-T03",
    result: "PASS",
    summary:
      "An authenticated Bundle authority resolves every literal package tuple to one installed package whose actual Catalog and Web-React bytes reproduce the exact required digest before yielding opaque preflight authority.",
    prerequisites,
    fixtures,
    claims: {
      supportedProtocol: EXPECTED_PROTOCOL,
      supportedTargets: [EXPECTED_TARGET],
      failFastCatalogGuard: {
        generation: catalogGuardCodegen,
        admissionBeforeExhaustiveValidation: true,
        firstIssueOnly: true,
      },
      currentPackage: {
        id: EXPECTED_PACKAGE_ID,
        version: EXPECTED_PACKAGE_VERSION,
        target: EXPECTED_TARGET,
        packageDigest: EXPECTED_PACKAGE_DIGEST,
        digestProfile: EXPECTED_DIGEST_PROFILE,
        digestProfileVersion: EXPECTED_DIGEST_PROFILE_VERSION,
        artifactCount: EXPECTED_ARTIFACT_COUNT,
        framedEntryCount: EXPECTED_FRAMED_ENTRY_COUNT,
        framedByteLength: EXPECTED_FRAMED_BYTES,
        distributionByteLength: EXPECTED_DISTRIBUTION_BYTES,
        publicProfile: runtimeReceipt.packageInput.publicProfile,
      },
      exactResolution: {
        equality: "literal-code-unit id + exact SemVer + literal target",
        physicalCandidateCardinality: "exactly-one",
        trimming: false,
        caseFolding: false,
        unicodeNormalization: false,
        ranges: false,
        newestOrBestMatch: false,
        candidateOrderSelection: false,
        locationOrLoaderSubstitution: false,
        missing: runtimeReceipt.missing,
        duplicatePhysicalCandidates: runtimeReceipt.duplicateCandidates,
        caseVariant: runtimeReceipt.caseVariant,
        newerOnly: runtimeReceipt.newerOnly,
        unknownTarget: runtimeReceipt.unknownTarget,
      },
      digestClosure: {
        relation: "Bundle requirement digest = Catalog packageDigest = actual framed package bytes",
        publicProfileParity: runtimeReceipt.packageInput.publicProfile.packageDigest,
        exactSuccess: runtimeReceipt.exactSuccess,
        historicalDigestSubstitution: runtimeReceipt.historicalSubstitution,
        changedArtifact: runtimeReceipt.changedArtifact,
        changedCatalogDigest: runtimeReceipt.changedCatalogDigest,
        changedCatalogIdentity: runtimeReceipt.changedCatalogIdentity,
      },
      positionalRequirements: {
        duplicateRequirementPositionsPreserved: true,
        duplicateRequirements: runtimeReceipt.duplicateRequirements,
        unusedCandidateOrderIndependent:
          JSON.stringify(runtimeReceipt.orderedExtraBefore.packages) ===
            JSON.stringify(runtimeReceipt.orderedExtraAfter.packages) &&
          JSON.stringify(runtimeReceipt.orderedExtraBefore.requirementPackageIndexes) ===
            JSON.stringify(runtimeReceipt.orderedExtraAfter.requirementPackageIndexes),
      },
      authority: {
        inputIntegrityAuthorityAuthenticated: runtimeReceipt.bundleIntegrity.authenticated,
        forgedAuthorityRejectedBeforeInventoryObservation:
          runtimeReceipt.forgedAuthority.inventoryObservations === 0,
        returnedOnlyOnCompleteSuccess: true,
        runtimeAuthenticated: runtimeReceipt.exactSuccess.authenticated,
        shallowCloneRejected: !runtimeReceipt.successCloneAuthenticated,
        immutable: runtimeReceipt.exactSuccess.authorityFrozen,
        rawCatalogOrArtifactsPublic: false,
        executableLoaderPublic: false,
        activationAuthorityPublic: false,
      },
      failureSemantics: {
        unavailableCode: "CATALOG_VERSION_UNAVAILABLE",
        digestMismatchCode: "CATALOG_DIGEST_MISMATCH",
        noPartialAuthority: true,
        precedence: [
          "authenticate exact M07-T02 authority before inventory observation",
          "capture fixed finite Bundle requirements",
          "capture fixed finite installed-package inventory shells",
          "resolve each literal id/version/target tuple to exactly one physical candidate",
          "capture and structurally validate the selected Catalog",
          "capture every exact target artifact and independently frame its digest",
          "close Bundle digest, Catalog self-digest, and actual-byte digest equality",
          "validate the complete selected Catalog set",
          "create opaque immutable M07-T03 authority",
        ],
      },
      limits: runtimeReceipt.limits,
      implementation,
      registrations,
      traceRows,
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T04 still owns surface and capability reference preflight plus whole-activation limits.",
      "M07-T05 still owns immutable Bundle persistence integration, mutable channel pointers, and local transport API behavior.",
      "M07-T06 through M07-T11 still own staging, activation, last-known-good state, recovery, fault injection, concurrency, and reference-host channel consumption.",
      "M12-T12 still owns npm-packed distribution, dependency-tree, and clean external-consumer integrity.",
      "Publication signatures, publisher authenticity, registry transport, discovery, download, upgrade negotiation, and dependency installation are not verified here.",
      "The current implementation and proof support only the Web-React target; native targets require separately reviewed static profiles.",
      "Successful package preflight exposes no Catalog bytes, target artifacts, module specifier, callback, loader, staging operation, channel mutation, or activation operation.",
    ],
    reproduction: [
      "pnpm verify:control-plane-bundle-verification",
      "pnpm --filter @desen/reference-catalog-web... build",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api verify:package-preflight-guards",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:package-preflight",
      "node scripts/generate-control-plane-package-preflight-proof.mjs",
      "node scripts/verify-control-plane-package-preflight.mjs",
      "node --test tests/control-plane-package-preflight.test.mjs",
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

export async function verifyControlPlanePackagePreflightEvidence(options) {
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
  const built = await buildControlPlanePackagePreflightEvidence({
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
            ? DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T03 evidence artifact is not reproducible.");
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
    task: "M07-T03",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    packageGuardCases: built.artifact.tests.packageGuardCases,
    packageFocusedCases: built.artifact.tests.packageFocusedCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    installedArtifacts: built.artifact.claims.currentPackage.artifactCount,
  });
}

export async function writeControlPlanePackagePreflightEvidence(options) {
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
  const built = await buildControlPlanePackagePreflightEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_PACKAGE_PREFLIGHT_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T03 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
