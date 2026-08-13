import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm, stat, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import {
  readCheckpointedFrozenArtifact,
  verifyProofReaderCheckpoints,
} from "../ci/proof-reader-checkpoints.mjs";
import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACT = "docs/proof/artifacts/control-plane-api-0.1.0-runtime-activation.json";
const PROOF_DOCUMENT = "docs/proof/CONTROL-PLANE-RUNTIME-ACTIVATION.md";
const TRACEABILITY = "docs/proof/protocol-0.1.0-traceability.json";
const NORMATIVE_COVERAGE = "docs/proof/NORMATIVE-COVERAGE.md";
const PROOF_MATRIX = "docs/proof/PROOF-MATRIX.md";
const FINDINGS = "docs/plan/PROTOCOL-FINDINGS.md";
const ADR = "docs/adr/0013-durable-runtime-activation-record.md";
const APP_DIRECTORY = "apps/control-plane-api";
const APP_PACKAGE = `${APP_DIRECTORY}/package.json`;
const APP_INDEX = `${APP_DIRECTORY}/src/index.ts`;
const APP_CONTRACT = `${APP_DIRECTORY}/src/runtime-activation-contract.ts`;
const APP_INTERNAL = `${APP_DIRECTORY}/src/runtime-activation-internal.ts`;
const APP_REPOSITORY = `${APP_DIRECTORY}/src/runtime-activation-repository-internal.ts`;
const APP_SQLITE = `${APP_DIRECTORY}/src/runtime-activation-sqlite-internal.ts`;
const APP_FACTORY = `${APP_DIRECTORY}/src/runtime-activation.ts`;
const APP_STAGING_INTERNAL = `${APP_DIRECTORY}/src/runtime-staging-internal.ts`;
const APP_RUNTIME_TEST = `${APP_DIRECTORY}/test/runtime-activation.test.ts`;
const APP_TYPE_TEST = `${APP_DIRECTORY}/test/runtime-activation.types.ts`;
const ROOT_PACKAGE = "package.json";
const CI_SOURCE = "scripts/run-ci-quality-gate.mjs";
const CI_INVENTORY = "scripts/ci/exhaustive-workload-inventory.mjs";
const SHARED_STATE_AUTHORITY = "scripts/ci/shared-state-authority.mjs";
const GENERATOR = "scripts/generate-control-plane-runtime-activation-proof.mjs";
const VERIFIER = "scripts/verify-control-plane-runtime-activation.mjs";
const PROOF_LIBRARY = "scripts/lib/control-plane-runtime-activation-proof.mjs";
const ATOMIC_WRITER = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST = "tests/control-plane-runtime-activation.test.mjs";
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
const execFileAsync = promisify(execFile);

const EXPECTED_REVISION = "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb";
const REVISION_A = `sha256:${"a".repeat(64)}`;
const REVISION_B = `sha256:${"b".repeat(64)}`;
const TRACE_IDS = Object.freeze([
  "PIPE-007",
  "PIPE-016",
  "PIPE-017",
  "R-008",
  "R-102",
  "R-126",
  "A-008",
  "A-009",
]);

const EXPECTED_RUNTIME_TEST_NAMES = Object.freeze([
  "commits generation zero and transfers the exact staged authority out of T06",
  "rejects equal-revision authorities from distinct private T03 lineages without consuming T06",
  "rejects forged, cloned, proxied, and already consumed pairs before Bundle-store I/O",
  "authenticates storage failures without inspecting hostile values or trusting a forged name",
  "admits only one in-flight attempt and does not consume a busy candidate",
  "terminally consumes a valid candidate when the same-root Bundle cannot be reclosed",
  "propagates Bundle-store operational failures without writing or disguising them as reclosure",
  "rejects same-key bytes whose embedded revision and staged content do not reclose",
  "increments same-revision commits, derives previous-good, and revokes superseded authorities",
  "preserves the authenticated current authority on a definite stale CAS loss",
  "opens a preexisting record only as recovery-required and blocks activation without consumption",
  "reopens a public durable record as raw recovery state rather than active authority",
  "enters sticky recovery when authenticated durable state disappears or is rewritten",
  "rolls back a definite before-COMMIT failure and admits a fresh candidate retry",
  "turns a post-COMMIT failure into recovery-required and revokes the prior current authority",
  "allows one winner across two SQLite connections at the same expected generation",
  "consumes a generation-exhausted candidate without changing the authenticated current slot",
  "keeps generation exhaustion and repository close deterministic",
  "redacts statement-acquisition failure and closes the partially opened repository",
  "rejects unsafe SQLite leaves and sidecars plus schema drift and corruption",
  "rejects malformed roots and revokes service operations after close",
]);
const EXPECTED_TYPE_NEGATIVE_CLAIMS = Object.freeze([
  "A visible record cannot forge the private activation-authority brand.",
  "Caller cannot replace the transaction-derived active revision.",
  "Caller cannot replace the transaction-derived previous-good revision.",
  "Activation authority exposes no staged Bundle or runtime index.",
  "Activation authority exposes no package loader.",
  "Activation authority exposes no mutable release channel.",
  "Activation authority exposes no repository handle.",
  "Activation authority exposes no SQLite handle.",
  "Activation authority grants no recovery or rollback operation.",
  "Restart recovery belongs to M07-T08, not this authority.",
  "A raw recovered record is deliberately not authenticated as an authority.",
  "The caller cannot submit active or previous-good revisions.",
  "Expected generation must be a nonnegative number or null.",
  "T04 authority cannot replace the T06 staging branch.",
  "T06 authority cannot replace the T04 reference branch.",
  "Public opening accepts no arbitrary database path.",
  "Public opening accepts no caller-provided repository.",
  "Public opening accepts no caller-provided Bundle store seam.",
  "Public opening accepts no caller-selected active revision.",
  "Package-private repository construction is not exported publicly.",
  "Package-private SQLite opening is not exported publicly.",
  "Package-private authority inspection is not exported publicly.",
  "Package-private owned-resource assembly is not exported publicly.",
  "Package-private storage errors are not exported publicly.",
  "Package-private storage-error authentication is not exported publicly.",
]);
const EXPECTED_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds the exact versioned M07-T07 artifact and activation receipt",
  "[determinism] two independent evidence builds produce byte-identical artifacts",
  "[authority] verifies exact artifact bytes and one final proof-document pin",
  "[artifact] rejects one changed evidence byte",
  "[proof] rejects pending, wrong, duplicate, or missing final pins",
  "[prerequisites] rejects one changed byte in all three direct immutable artifacts",
  "[implementation] rejects authority-join, consume, reclosure, CAS, or recovery drift",
  "[registration] rejects package-root, package-script, aggregate, CI, or policy drift",
  "[traceability] rejects exact activation trace-owner drift",
  "[coverage] rejects P-12, N-004/N-038/N-041, or PF-075/PF-076 truth drift",
  "[runtime] rejects changed join, transition, rollback, recovery, or native-load receipts",
  "[tests] rejects skipped focused cases or removed compile-time negatives",
  "[platform] rejects public-export, TSDoc, private-export, or native-import drift",
  "[filesystem] rejects symlinked artifact and proof-document authority",
  "[writer] atomically writes exact deterministic evidence bytes",
  "[writer] preserves the old destination and removes a tampered temporary",
  "[options] rejects unknown, accessor-backed, shared-memory, or hostile authority",
  "[immutability] freezes the evidence graph and preserves T08-T11 nonclaims",
]);

const ROOT_SCRIPT_COMMANDS = Object.freeze({
  generate:
    "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/generate-control-plane-runtime-activation-proof.mjs",
  verify:
    "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node scripts/verify-control-plane-runtime-activation.mjs",
  test: "pnpm verify:control-plane-runtime-staging && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/control-plane-api test:runtime-activation && node --test tests/control-plane-runtime-activation.test.mjs",
});
const CI_TUPLE = Object.freeze([
  "control-plane-runtime-activation",
  "scripts/verify-control-plane-runtime-activation.mjs",
  "tests/control-plane-runtime-activation.test.mjs",
]);

export const CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T01",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-bundle-store.json",
    sha256: "698be7d5610d1732ad991bf7e58131e81d2c34ffa888f65ec3c7916334f54795",
  }),
  Object.freeze({
    task: "M07-T04",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-reference-preflight.json",
    sha256: "29555326d51073c50937519d8706049ad17287079cc3ef4dc7060bb3a3225394",
  }),
  Object.freeze({
    task: "M07-T06",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-runtime-staging.json",
    sha256: "d025da5329d5b56b9b46e7292a08883386a151add5e419edf2a9345425319494",
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
  APP_STAGING_INTERNAL,
  APP_RUNTIME_TEST,
  APP_TYPE_TEST,
  ADR,
  GENERATOR,
  VERIFIER,
  PROOF_LIBRARY,
  ATOMIC_WRITER,
  ROOT_TEST,
  ROOT_PACKAGE,
  CI_SOURCE,
  CI_INVENTORY,
  SHARED_STATE_AUTHORITY,
]);
export const DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH = path.join(ROOT, ARTIFACT);

export class ControlPlaneRuntimeActivationEvidenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ControlPlaneRuntimeActivationEvidenceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new ControlPlaneRuntimeActivationEvidenceError(code, message, details);
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
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
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
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
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
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
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
  const frozen = await readCheckpointedFrozenArtifact("M07-T07");
  if (frozen.path !== ARTIFACT) {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T07 artifact path drifted.");
  }
  const artifact = parseJsonBytes(frozen.bytes, ARTIFACT);
  if (artifact.schemaVersion !== 1 || artifact.task !== "M07-T07" || artifact.result !== "PASS") {
    fail("ARTIFACT_DRIFT", "The checkpoint-authenticated M07-T07 artifact identity drifted.");
  }
  return artifact;
}

function parseTypescript(source, relativePath, code = "TEST_AUTHORITY_DRIFT") {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  if (sourceFile.parseDiagnostics.length > 0)
    fail(code, `${relativePath} is not valid TypeScript.`);
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
  if (cases.length === 0) fail("TEST_AUTHORITY_DRIFT", `${relativePath} has no type negatives.`);
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

function publicExportInventory(source) {
  const sourceFile = parseTypescript(source, APP_INDEX, "REGISTRATION_DRIFT");
  const inventory = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause) || statement.moduleSpecifier === undefined) {
      fail("REGISTRATION_DRIFT", "The package root contains a non-explicit export.");
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
    const byName = left.exported.localeCompare(right.exported);
    return byName === 0 ? Number(left.typeOnly) - Number(right.typeOnly) : byName;
  });
  const expectedNames = [
    "BundleRuntimeActivation",
    "BundleRuntimeActivationAuthority",
    "BundleRuntimeActivationDiagnostic",
    "BundleRuntimeActivationResult",
    "BundleRuntimeActivationStage",
    "BundleRuntimeActivationState",
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "OpenBundleRuntimeActivationOptions",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RuntimeActivationError",
    "RuntimeActivationErrorCode",
    "RuntimeActivationRecord",
    "openBundleRuntimeActivation",
  ].sort();
  const frozenInventory = inventory.filter(
    ({ module, exported }) =>
      !module.startsWith("./runtime-activation") || expectedNames.includes(exported),
  );
  const names = frozenInventory
    .filter(({ module }) => module.startsWith("./runtime-activation"))
    .map(({ exported }) => exported)
    .sort();
  if (
    JSON.stringify(names) !== JSON.stringify(expectedNames) ||
    inventory.some(({ exported }) =>
      [
        "createBundleRuntimeActivationInternal",
        "createOwnedBundleRuntimeActivationInternal",
        "createInMemoryRuntimeActivationRepository",
        "openRuntimeActivationSqliteRepository",
        "readBundleRuntimeActivationAuthority",
        "RuntimeActivationStorageError",
        "readRuntimeActivationStorageErrorCode",
      ].includes(exported),
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 public package-root inventory drifted.");
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

function assertTaskTimeAdjacent(script, predecessor, current) {
  if (typeof script !== "string") fail("REGISTRATION_DRIFT", "An aggregate script is absent.");
  const commands = script.split(" && ");
  const currentIndex = commands.indexOf(current);
  if (
    currentIndex < 1 ||
    commands[currentIndex - 1] !== predecessor ||
    commands.lastIndexOf(predecessor) !== currentIndex - 1 ||
    commands.lastIndexOf(current) !== currentIndex
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 aggregate adjacency drifted.");
  }
}

async function prerequisiteReceipts(overrides) {
  return deepFreeze(
    await Promise.all(
      CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS.map(async (pin) => {
        const bytes = await authorityBytes(pin.path, overrides);
        const actual = sha256(bytes);
        if (actual !== pin.sha256) {
          fail("PREREQUISITE_DRIFT", `The immutable ${pin.task} prerequisite drifted.`, {
            task: pin.task,
            path: pin.path,
            expectedSha256: pin.sha256,
            actualSha256: actual,
          });
        }
        return Object.freeze({ ...pin, bytes: bytes.byteLength });
      }),
    ),
  );
}

async function trackedFileReceipts(overrides, frozenReceipts) {
  const projection = frozenReceiptMap(frozenReceipts, TRACKED_TASK_FILES, "tracked-file");
  return deepFreeze(
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

async function listDistributionFiles() {
  const directory = path.join(ROOT, APP_DIRECTORY, "dist");
  const output = [];
  const visit = async (relative) => {
    const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) fail("UNSAFE_AUTHORITY", "Distribution authority is symlinked.");
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) output.push(child);
      else fail("UNSAFE_AUTHORITY", "Distribution authority is not a regular file.");
    }
  };
  await visit("");
  return output;
}

async function distributionReceipts(frozenReceipts) {
  const required = [
    "index.js",
    "index.d.ts",
    "runtime-activation-contract.js",
    "runtime-activation-contract.d.ts",
    "runtime-activation-internal.js",
    "runtime-activation-repository-internal.js",
    "runtime-activation-sqlite-internal.js",
    "runtime-activation.js",
  ];
  const files = await listDistributionFiles();
  if (required.some((file) => !files.includes(file))) {
    fail("DISTRIBUTION_DRIFT", "The built M07-T07 distribution is incomplete.");
  }
  const activationFiles = files.filter((file) => file.startsWith("runtime-activation"));
  const relativePaths = activationFiles.map(
    (relativePath) => `${APP_DIRECTORY}/dist/${relativePath}`,
  );
  const projection = frozenReceiptMap(frozenReceipts, relativePaths, "distribution");
  return deepFreeze(
    await Promise.all(
      activationFiles.map(async (relativePath) => {
        await safeReadAbsolute(path.join(ROOT, APP_DIRECTORY, "dist", relativePath));
        const frozenReceipt = projection.get(`${APP_DIRECTORY}/dist/${relativePath}`);
        return Object.freeze({
          path: `apps/control-plane-api/dist/${relativePath}`,
          bytes: frozenReceipt.bytes,
          sha256: frozenReceipt.sha256,
        });
      }),
    ),
  );
}

async function registrationProjection(overrides) {
  const [appBytes, indexBytes, rootBytes, ciBytes, inventoryBytes, sharedStateBytes] =
    await Promise.all(
      [APP_PACKAGE, APP_INDEX, ROOT_PACKAGE, CI_SOURCE, CI_INVENTORY, SHARED_STATE_AUTHORITY].map(
        (relativePath) => authorityBytes(relativePath, overrides),
      ),
    );
  const app = parseJsonBytes(appBytes, APP_PACKAGE);
  const rootPackage = parseJsonBytes(rootBytes, ROOT_PACKAGE);
  if (
    app.name !== "@desen/control-plane-api" ||
    app.scripts?.["test:runtime-activation"] !== "vitest run test/runtime-activation.test.ts" ||
    app.dependencies?.["better-sqlite3"] !== "13.0.3" ||
    app.exports?.["."]?.import !== "./dist/index.js" ||
    app.exports?.["."]?.types !== "./dist/index.d.ts"
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 application registration drifted.");
  }
  const rootScripts = {
    generate: rootPackage.scripts?.["generate:control-plane-runtime-activation"],
    verify: rootPackage.scripts?.["verify:control-plane-runtime-activation"],
    test: rootPackage.scripts?.["test:control-plane-runtime-activation"],
  };
  if (JSON.stringify(rootScripts) !== JSON.stringify(ROOT_SCRIPT_COMMANDS)) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 root commands drifted.");
  }
  assertTaskTimeAdjacent(
    rootPackage.scripts?.check,
    "pnpm verify:control-plane-runtime-staging",
    "pnpm verify:control-plane-runtime-activation",
  );
  assertTaskTimeAdjacent(
    rootPackage.scripts?.test,
    "pnpm test:control-plane-runtime-staging",
    "pnpm test:control-plane-runtime-activation",
  );
  if (
    exactTupleCount(fatalText(ciBytes, CI_SOURCE), CI_TUPLE) !== 1 ||
    exactTupleCount(fatalText(inventoryBytes, CI_INVENTORY), CI_TUPLE) !== 1
  ) {
    fail("REGISTRATION_DRIFT", "The exact M07-T07 modular-CI tuple drifted.");
  }
  const sharedState = fatalText(sharedStateBytes, SHARED_STATE_AUTHORITY);
  const exactArrayMember = (declaration, member) => {
    const start = sharedState.indexOf(declaration);
    const end = sharedState.indexOf("]);", start);
    if (start < 0 || end < 0) return false;
    const block = sharedState.slice(start, end);
    return block.split(JSON.stringify(member)).length - 1 === 1;
  };
  if (
    !sharedState.includes(
      'CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE"',
    ) ||
    !/"control-plane-runtime-activation":\s*NATIVE_ADDON_POLICIES\.CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE/u.test(
      sharedState,
    ) ||
    !/"test-control-plane-runtime-activation":\s*NATIVE_ADDON_POLICIES\.CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE/u.test(
      sharedState,
    ) ||
    !exactArrayMember(
      "export const CHILD_PROCESS_VERIFIER_PROOF_IDS = Object.freeze([",
      "control-plane-runtime-activation",
    ) ||
    !exactArrayMember(
      "export const NATIVE_ADDON_PROOF_IDS = Object.freeze([",
      "control-plane-runtime-activation",
    ) ||
    !exactArrayMember(
      "export const NATIVE_ADDON_ROOT_STEP_IDS = Object.freeze([",
      "test-control-plane-runtime-activation",
    )
  ) {
    fail("REGISTRATION_DRIFT", "The exact child/native shared-state authority drifted.");
  }
  return deepFreeze({
    applicationScript: app.scripts["test:runtime-activation"],
    rootScripts,
    aggregateImmediatePredecessor: "control-plane-runtime-staging",
    aggregateImmediateSuccessors: { check: "lint", test: "turbo run test" },
    ciTuple: CI_TUPLE,
    ciTupleExactInRunnerAndInventory: true,
    verifierChildProcessAuthority: true,
    nativeAddonAuthority: "CONTROL_PLANE_RUNTIME_ACTIVATION_SQLITE",
    publicExports: publicExportInventory(fatalText(indexBytes, APP_INDEX)),
  });
}

function collectTraceRows(value, found = []) {
  if (Array.isArray(value)) {
    for (const child of value) collectTraceRows(child, found);
  } else if (value !== null && typeof value === "object") {
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
    rows.some((row, index) => row.id !== TRACE_IDS[index] || !row.owners?.includes("M07-T07"))
  ) {
    fail("TRACEABILITY_DRIFT", "The exact M07-T07 trace-owner authority drifted.");
  }
  return deepFreeze(copyInertJson(rows, "traceRows"));
}

function markdownTableRow(source, id, label) {
  const lines = source.split("\n");
  const matching = lines.filter((line) => line.startsWith(`| ${id} |`));
  if (matching.length !== 1) fail("COVERAGE_DRIFT", `The ${label} row is not unique.`);
  return matching[0];
}

function findingStatus(source, id) {
  const heading = `## ${id} —`;
  const start = source.indexOf(heading);
  const next = source.indexOf("\n## ", start + heading.length);
  if (start < 0) fail("COVERAGE_DRIFT", `${id} is absent.`);
  const section = source.slice(start, next < 0 ? source.length : next);
  const statuses = [...section.matchAll(/^- Status: (.+)$/gmu)].map((match) => match[1]);
  if (statuses.length !== 1) fail("COVERAGE_DRIFT", `${id} status is not unique.`);
  return { status: statuses[0], section };
}

async function coverageProjection(overrides) {
  const [normative, matrix, findings] = await Promise.all(
    [NORMATIVE_COVERAGE, PROOF_MATRIX, FINDINGS].map(async (relativePath) =>
      fatalText(await authorityBytes(relativePath, overrides), relativePath),
    ),
  );
  const n004 = markdownTableRow(normative, "N-004", "N-004");
  const n038 = markdownTableRow(normative, "N-038", "N-038");
  const n041 = markdownTableRow(normative, "N-041", "N-041");
  const p12 = markdownTableRow(matrix, "P-12", "P-12");
  const pf075 = findingStatus(findings, "PF-075");
  const pf076 = findingStatus(findings, "PF-076");
  if (
    !/\| (?:PLANNED|TESTED)\s+\|/u.test(n004) ||
    !/\| (?:PLANNED|TESTED)\s+\|/u.test(n038) ||
    !/\| PLANNED\s+\|/u.test(n041) ||
    !/\| NOT_PROVEN\s+\|/u.test(p12) ||
    pf075.status !== "OPEN" ||
    pf076.status !== "OPEN" ||
    !pf075.section.includes("one-shot") ||
    !pf075.section.includes("do not consume") ||
    !pf076.section.includes("runtime-activation.sqlite3") ||
    !pf076.section.includes("recovery-required")
  ) {
    fail("COVERAGE_DRIFT", "The exact M07-T07 coverage truth drifted.");
  }
  return deepFreeze({
    proofMatrixP12: "NOT_PROVEN",
    normativeN004: "PLANNED",
    normativeN004Contribution:
      "M07-T07 proves one exact preflight-joined, complete-Bundle-reclosed atomic record transition; M07-T09 still owns every precommit fault boundary before N-004 can advance.",
    normativeN038: "PLANNED",
    normativeN041: "PLANNED",
    findingPF075: "OPEN",
    findingPF076: "OPEN",
  });
}

async function packageTestProjection(overrides) {
  const [runtimeBytes, typeBytes, rootBytes] = await Promise.all(
    [APP_RUNTIME_TEST, APP_TYPE_TEST, ROOT_TEST].map((relativePath) =>
      authorityBytes(relativePath, overrides),
    ),
  );
  const runtimeNames = registeredTestNames(
    fatalText(runtimeBytes, APP_RUNTIME_TEST),
    APP_RUNTIME_TEST,
    ["it", "test"],
  );
  const typeCases = compilerNegativeCases(fatalText(typeBytes, APP_TYPE_TEST), APP_TYPE_TEST);
  const rootNames = registeredTestNames(fatalText(rootBytes, ROOT_TEST), ROOT_TEST, ["test"]);
  const frozenRuntimeNames = runtimeNames.filter((name) =>
    EXPECTED_RUNTIME_TEST_NAMES.includes(name),
  );
  if (
    JSON.stringify(frozenRuntimeNames) !== JSON.stringify(EXPECTED_RUNTIME_TEST_NAMES) ||
    JSON.stringify(typeCases) !== JSON.stringify(EXPECTED_TYPE_NEGATIVE_CLAIMS) ||
    JSON.stringify(rootNames) !== JSON.stringify(EXPECTED_ROOT_TEST_NAMES)
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact M07-T07 focused or mutation tests drifted.");
  }
  return deepFreeze({
    packageRuntimeCases: EXPECTED_RUNTIME_TEST_NAMES.length,
    packageRuntimeCaseNames: EXPECTED_RUNTIME_TEST_NAMES,
    compileTimeNegativeCases: typeCases.length,
    compileTimeNegativeClaims: typeCases,
    rootMutationCases: rootNames.length,
    rootMutationCaseNames: rootNames,
  });
}

function assertRequiredAuthorities(sourceByPath, authorities) {
  for (const [relativePath, fragments] of Object.entries(authorities)) {
    const source = sourceByPath[relativePath];
    for (const fragment of fragments) {
      if (!source.includes(fragment)) {
        fail("IMPLEMENTATION_DRIFT", `A required M07-T07 authority drifted in ${relativePath}.`);
      }
    }
  }
}

function tsdocProjection(sourceByPath) {
  const documented = [];
  for (const relativePath of [APP_CONTRACT, APP_FACTORY]) {
    const sourceFile = parseTypescript(sourceByPath[relativePath], relativePath, "PLATFORM_DRIFT");
    for (const statement of sourceFile.statements) {
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        continue;
      }
      const name =
        statement.name?.text ?? statement.declarationList?.declarations?.[0]?.name?.text ?? null;
      if (name === null || ts.getJSDocCommentsAndTags(statement).length === 0) {
        fail("PLATFORM_DRIFT", `A public M07-T07 export lacks TSDoc in ${relativePath}.`);
      }
      documented.push(name);
    }
  }
  const frozenDocumented = [
    "BundleRuntimeActivation",
    "BundleRuntimeActivationAuthority",
    "BundleRuntimeActivationDiagnostic",
    "BundleRuntimeActivationResult",
    "BundleRuntimeActivationStage",
    "BundleRuntimeActivationState",
    "INVALID_RUNTIME_ACTIVATION_AUTHORITY_CODE",
    "OpenBundleRuntimeActivationOptions",
    "RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_ACTIVATION_INTERNAL_FAILURE_CODE",
    "RuntimeActivationError",
    "RuntimeActivationErrorCode",
    "RuntimeActivationRecord",
    "createOwnedBundleRuntimeActivationInternal",
    "openBundleRuntimeActivation",
  ].sort();
  if (frozenDocumented.some((name) => !documented.includes(name))) {
    fail("PLATFORM_DRIFT", "The exact M07-T07 documented public surface drifted.");
  }
  return Object.freeze(frozenDocumented);
}

async function implementationProjection(overrides) {
  const paths = [
    APP_CONTRACT,
    APP_INTERNAL,
    APP_REPOSITORY,
    APP_SQLITE,
    APP_FACTORY,
    APP_STAGING_INTERNAL,
  ];
  const sourceByPath = Object.fromEntries(
    await Promise.all(
      paths.map(async (relativePath) => [
        relativePath,
        fatalText(await authorityBytes(relativePath, overrides), relativePath),
      ]),
    ),
  );
  if (
    paths.some((relativePath) => explicitAnyCount(sourceByPath[relativePath], relativePath) > 0)
  ) {
    fail("IMPLEMENTATION_DRIFT", "M07-T07 contains explicit any authority.");
  }
  assertRequiredAuthorities(sourceByPath, {
    [APP_CONTRACT]: [
      'readonly status: "activated";',
      'readonly status: "precondition-failed";',
      'readonly status: "generation-exhausted";',
      'readonly status: "recovery-required";',
      "readonly activeRevision: string;",
      "readonly previousGoodRevision: string | null;",
      "readonly generation: number;",
      "referenceAuthority: BundleReferencePreflightAuthority",
      "stagingAuthority: BundleRuntimeStagingAuthority",
      "expectedGeneration: number | null",
    ],
    [APP_INTERNAL]: [
      "referenceRecord.packageAuthority !== observedStagingRecord.packageAuthority",
      "referenceRecord.packageRecord !== observedStagingRecord.packageRecord",
      'Object.hasOwn(value, "expectedGeneration")',
      "consumeBundleRuntimeStagingAuthority(stagingAuthority)",
      "await options.bundleStore.getBundle(revision)",
      'Object.freeze({ status: "not-available" })',
      "canonicalizeJson(attempt.referenceRecord.bundle)",
      "canonicalizeJson(attempt.stagingRecord.bundle)",
      "const authenticatedCurrent =",
      "attempt.expectedGeneration,\n      authenticatedCurrent,\n      revision,",
      'if (!canCommit()) return Object.freeze({ status: "recovery-required" });',
      'result.status === "recovery-required" && recoveryRecord === undefined',
      'if (inFlight) return Promise.reject(new RuntimeActivationError("ACTIVATION_BUSY"))',
      "enterRecovery(null)",
      'return Object.freeze({ status: "recovery-required", record: null });',
      "revokeCurrent();",
      "function readBundleStoreErrorCode(error: unknown)",
      "if (!(error instanceof BundleStoreError)) return undefined;",
      "function mapBundleStoreOperationalError",
      "if (operational !== undefined) throw operational;",
      "readRuntimeActivationStorageErrorCode(error)",
    ],
    [APP_REPOSITORY]: [
      "const MAX_GENERATION = Number.MAX_SAFE_INTEGER;",
      "const STORAGE_ERRORS = new WeakSet<object>();",
      "STORAGE_ERRORS.add(this);",
      "export function readRuntimeActivationStorageErrorCode",
      'Object.getOwnPropertyDescriptor(error, "code")',
      "current.activeRevision === candidateRevision",
      "current.previousGoodRevision",
      "current.activeRevision",
      "current.generation + 1",
      "current?.generation === MAX_GENERATION",
      "!sameRecord(current, capturedAuthenticatedCurrent)",
      'status: "precondition-failed" as const',
      'status: "generation-exhausted" as const',
    ],
    [APP_SQLITE]: [
      'import Database from "better-sqlite3";',
      'const DATABASE_SIDECAR_SUFFIXES = Object.freeze(["-journal", "-shm", "-wal"] as const);',
      '") STRICT"',
      'database.pragma("journal_mode = WAL")',
      'database.pragma("synchronous = FULL")',
      'database.pragma("trusted_schema = OFF")',
      'openDatabase.exec("BEGIN IMMEDIATE");',
      'pragmaInteger(database, "user_version") !== SCHEMA_VERSION',
      "!sameRecord(current, capturedAuthenticatedCurrent)",
      "hooks.beforeCommit?.()",
      "hooks.afterCommit?.()",
      'hooks.afterPrepareStatement?.("read")',
      'hooks.afterPrepareStatement?.("insert")',
      'hooks.afterPrepareStatement?.("update")',
      'return Object.freeze({ status: "recovery-required" })',
      "assertStorageIdentity(storage.path, storage.identity)",
    ],
    [APP_FACTORY]: [
      'const ACTIVATION_DATABASE_FILE_NAME = "runtime-activation.sqlite3";',
      'await import("./runtime-activation-sqlite-internal.js")',
      "path.join(canonicalRoot, ACTIVATION_DATABASE_FILE_NAME)",
      "openBundleStore({ rootDirectory: canonicalRoot })",
      "createOwnedBundleRuntimeActivationInternal(bundleStore, repository)",
    ],
    [APP_STAGING_INTERNAL]: [
      "export function consumeBundleRuntimeStagingAuthority",
      "AUTHORITIES.delete(stagingAuthority)",
    ],
  });
  const internal = sourceByPath[APP_INTERNAL];
  const repository = sourceByPath[APP_REPOSITORY];
  const sqlite = sourceByPath[APP_SQLITE];
  const repositoryCas = repository.indexOf("(current === null && expectedGeneration !== null)");
  const repositoryBaseline = repository.indexOf(
    "!sameRecord(current, capturedAuthenticatedCurrent)",
    repositoryCas,
  );
  const sqliteWriter = sqlite.indexOf('openDatabase.exec("BEGIN IMMEDIATE")');
  const sqliteSchemaReauthentication = sqlite.indexOf(
    "assertExactSchema(openDatabase)",
    sqliteWriter,
  );
  const sqliteRead = sqlite.indexOf("const current = readCurrent();", sqliteWriter);
  const sqliteCas = sqlite.indexOf("(current === null && expectedGeneration !== null)", sqliteRead);
  const sqliteBaseline = sqlite.indexOf(
    "!sameRecord(current, capturedAuthenticatedCurrent)",
    sqliteCas,
  );
  const livenessGuard = internal.indexOf("if (!canCommit())");
  const durableCommit = internal.indexOf("const committed = options.repository.commit(");
  if (
    internal.indexOf("consumeBundleRuntimeStagingAuthority(stagingAuthority)") >
      internal.indexOf("await options.bundleStore.getBundle(revision)") ||
    repositoryCas < 0 ||
    repositoryBaseline <= repositoryCas ||
    sqliteWriter < 0 ||
    sqliteSchemaReauthentication <= sqliteWriter ||
    sqliteRead <= sqliteSchemaReauthentication ||
    sqliteCas <= sqliteRead ||
    sqliteBaseline <= sqliteCas ||
    livenessGuard < 0 ||
    durableCommit <= livenessGuard ||
    [APP_CONTRACT, APP_INTERNAL, APP_REPOSITORY, APP_FACTORY, APP_STAGING_INTERNAL].some(
      (relativePath) => sourceByPath[relativePath].includes('from "better-sqlite3"'),
    ) ||
    sourceByPath[APP_FACTORY].includes('import Database from "better-sqlite3";')
  ) {
    fail("IMPLEMENTATION_DRIFT", "The one-shot-before-await or lazy-native boundary drifted.");
  }
  return deepFreeze({
    authorityJoin:
      "exact shared T03 packageAuthority and packageRecord identity, then one-shot T06 consume",
    bundleReclosure: "same-root immutable T01 read plus complete canonical T02 integrity reclosure",
    repository:
      "caller supplies expected generation while the controller supplies its authenticated complete baseline; repository derives one complete successor record",
    transitions: {
      firstGeneration: 0,
      differentRevisionPreservesCurrentAsPreviousGood: true,
      sameRevisionAdvancesAndPreservesPreviousGood: true,
      stalePresenceMismatchAndExhaustionWriteNothing: true,
      authenticatedBaselineDriftRequiresRecovery: true,
    },
    sqlite: {
      fileName: "runtime-activation.sqlite3",
      schemaVersion: 1,
      strictSingletonRow: true,
      journalMode: "WAL",
      synchronous: "FULL",
      trustedSchema: false,
      busyTimeoutMilliseconds: 5_000,
      immediateCas: true,
      liveSchemaReauthenticatedUnderWriterLock: true,
      parentDatabaseAndSidecarsRevalidated: true,
      precommitRollback: true,
      indeterminateCommitRevokesRepository: true,
    },
    nativeSqliteImportLazy: true,
    hostileStorageErrorsAuthenticatedWithoutAccessors: true,
    operationalBundleStoreFailuresPropagateAsRedactedRuntimeErrors: true,
    failedControllerInitializationClosesOwnedRepository: true,
    explicitAnyTypes: 0,
    documentedActivationSourceExports: tsdocProjection(sourceByPath),
  });
}

async function listCatalogArtifacts() {
  const root = path.join(ROOT, CATALOG_DISTRIBUTION);
  const paths = [];
  const visit = async (relative) => {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) fail("UNSAFE_AUTHORITY", "Catalog distribution is symlinked.");
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) paths.push(child);
      else fail("UNSAFE_AUTHORITY", "Catalog distribution contains a special entry.");
    }
  };
  await visit("");
  return Object.freeze(
    await Promise.all(
      paths.map(async (relative) =>
        Object.freeze({
          path: `dist/${relative}`,
          bytes: await safeReadAbsolute(path.join(root, relative)),
        }),
      ),
    ),
  );
}

function requireAuthority(result, status, label) {
  if (result?.status !== status || result.authority === undefined) {
    fail("RUNTIME_PROBE_MISMATCH", `${label} did not produce exact authority.`);
  }
  return result.authority;
}

function publicRecord(record) {
  return record === null
    ? null
    : {
        activeRevision: record.activeRevision,
        previousGoodRevision: record.previousGoodRevision,
        generation: record.generation,
      };
}

function rejectionReceipt(result) {
  return {
    status: result.status,
    stage: result.stage,
    codes: Array.isArray(result.diagnostics) ? result.diagnostics.map(({ code }) => code) : [],
    frozen: Object.isFrozen(result),
    authorityAbsent: !Object.hasOwn(result, "authority"),
  };
}

function runtimeErrorCode(error) {
  return error !== null && typeof error === "object" && typeof error.code === "string"
    ? error.code
    : null;
}

/** Runs the bounded native M07-T07 child probe against the built package. */
export async function runControlPlaneRuntimeActivationProbeInCurrentProcess(controlPlane) {
  const temporaryDirectories = [];
  const services = new Set();
  const repositories = new Set();
  const makeRoot = async (prefix) => {
    const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
    temporaryDirectories.push(directory);
    return directory;
  };
  try {
    const [
      packageInternal,
      referenceInternal,
      stagingInternal,
      activationInternal,
      repositoryInternal,
      sqliteInternal,
      protocol,
      bundleBytes,
      catalogBytes,
      artifacts,
    ] = await Promise.all([
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/package-preflight-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/reference-preflight-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-staging-internal.js")).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-internal.js")).href
      ),
      import(
        pathToFileURL(
          path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-repository-internal.js"),
        ).href
      ),
      import(
        pathToFileURL(path.join(ROOT, APP_DIRECTORY, "dist/runtime-activation-sqlite-internal.js"))
          .href
      ),
      import(pathToFileURL(path.join(ROOT, "packages/protocol/dist/index.js")).href),
      safeReadAbsolute(path.join(ROOT, BUNDLE_FIXTURE)),
      safeReadAbsolute(path.join(ROOT, CATALOG_FIXTURE)),
      listCatalogArtifacts(),
    ]);
    const bundle = parseJsonBytes(bundleBytes, BUNDLE_FIXTURE);
    const catalog = parseJsonBytes(catalogBytes, CATALOG_FIXTURE);
    const canonicalBundleBytes = protocol.canonicalizeJsonBytes(bundle);
    if (bundle.revision !== EXPECTED_REVISION) {
      fail("RUNTIME_PROBE_MISMATCH", "The fixed activation Bundle revision drifted.");
    }

    const lineage = () => {
      const integrity = controlPlane.verifyBundleStoreEntry(
        { revision: bundle.revision, bytes: canonicalBundleBytes },
        Object.freeze({ status: "not-available" }),
      );
      const integrityAuthority = requireAuthority(integrity, "verified", "Integrity");
      const packages = controlPlane.preflightBundlePackages(integrityAuthority, [
        Object.freeze({
          id: catalog.id,
          version: catalog.version,
          target: catalog.target,
          catalog,
          artifacts,
        }),
      ]);
      const packageAuthority = requireAuthority(packages, "preflighted", "Package preflight");
      const reference = controlPlane.preflightBundleReferences(packageAuthority);
      const referenceAuthority = requireAuthority(reference, "preflighted", "Reference preflight");
      const staging = controlPlane.stageBundleRuntime(packageAuthority);
      const stagingAuthority = requireAuthority(staging, "staged", "Runtime staging");
      const packageRecord = packageInternal.readBundlePackagePreflightAuthority(packageAuthority);
      const referenceRecord =
        referenceInternal.readBundleReferencePreflightAuthority(referenceAuthority);
      const stagingRecord = stagingInternal.readBundleRuntimeStagingAuthority(stagingAuthority);
      if (
        packageRecord === undefined ||
        referenceRecord === undefined ||
        stagingRecord === undefined
      ) {
        fail("RUNTIME_PROBE_MISMATCH", "A private activation predecessor is absent.");
      }
      return {
        packageAuthority,
        packageRecord,
        referenceAuthority,
        referenceRecord,
        stagingAuthority,
        stagingRecord,
      };
    };

    const rootDirectory = await makeRoot("desen-m07-t07-public-");
    const bundleStore = await controlPlane.openBundleStore({ rootDirectory });
    const stored = await bundleStore.putBundle({
      revision: bundle.revision,
      bytes: canonicalBundleBytes,
    });
    const service = await controlPlane.openBundleRuntimeActivation({ rootDirectory });
    services.add(service);
    const beforeState = service.readState();
    const firstLineage = lineage();
    const first = await service.activate(
      firstLineage.referenceAuthority,
      firstLineage.stagingAuthority,
      null,
    );
    const firstAuthority = requireAuthority(first, "activated", "First activation");
    const firstPrivate = activationInternal.readBundleRuntimeActivationAuthority(firstAuthority);
    const activeState = service.readState();
    if (firstPrivate === undefined || activeState.status !== "active") {
      fail("RUNTIME_PROBE_MISMATCH", "The committed activation authority is absent.");
    }
    const secondStaging = controlPlane.stageBundleRuntime(firstLineage.packageAuthority);
    const secondStagingAuthority = requireAuthority(secondStaging, "staged", "Same revision stage");
    const secondStagingRecord =
      stagingInternal.readBundleRuntimeStagingAuthority(secondStagingAuthority);
    const second = await service.activate(
      firstLineage.referenceAuthority,
      secondStagingAuthority,
      0,
    );
    const secondAuthority = requireAuthority(second, "activated", "Same revision activation");
    const secondPrivate = activationInternal.readBundleRuntimeActivationAuthority(secondAuthority);
    if (secondStagingRecord === undefined || secondPrivate === undefined) {
      fail("RUNTIME_PROBE_MISMATCH", "The second activation authority is absent.");
    }
    const secondCurrentBeforeClose =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === secondPrivate;

    const mismatchLeft = lineage();
    const mismatchRight = lineage();
    const mismatch = await service.activate(
      mismatchLeft.referenceAuthority,
      mismatchRight.stagingAuthority,
      1,
    );
    const mismatchStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(mismatchRight.stagingAuthority) ===
      mismatchRight.stagingRecord;

    const busyLineage = lineage();
    const busySecondStage = controlPlane.stageBundleRuntime(busyLineage.packageAuthority);
    const busySecondAuthority = requireAuthority(busySecondStage, "staged", "Busy second stage");
    const busySecondRecord = stagingInternal.readBundleRuntimeStagingAuthority(busySecondAuthority);
    let releaseRead;
    const waitingStore = {
      getBundle: () =>
        new Promise((resolve) => {
          releaseRead = resolve;
        }),
      putBundle: async () => Object.freeze({ status: "unchanged" }),
    };
    const busyRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(busyRepository);
    const busyController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: waitingStore,
      repository: busyRepository,
    });
    services.add(busyController);
    const busyWinnerPromise = busyController.activate(
      busyLineage.referenceAuthority,
      busyLineage.stagingAuthority,
      null,
    );
    let busyLoserCode = null;
    try {
      await busyController.activate(busyLineage.referenceAuthority, busySecondAuthority, null);
    } catch (error) {
      busyLoserCode = runtimeErrorCode(error);
    }
    const busyLoserStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(busySecondAuthority) === busySecondRecord;
    releaseRead(
      Object.freeze({
        status: "found",
        entry: Object.freeze({ revision: bundle.revision, bytes: canonicalBundleBytes }),
      }),
    );
    const busyWinner = await busyWinnerPromise;

    const missingLineage = lineage();
    const missingRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(missingRepository);
    const missingController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: {
        getBundle: async () => Object.freeze({ status: "missing" }),
        putBundle: async () => Object.freeze({ status: "unchanged" }),
      },
      repository: missingRepository,
    });
    services.add(missingController);
    const missing = await missingController.activate(
      missingLineage.referenceAuthority,
      missingLineage.stagingAuthority,
      null,
    );
    const missingConsumed =
      stagingInternal.readBundleRuntimeStagingAuthority(missingLineage.stagingAuthority) ===
      undefined;
    const missingDurable = missingRepository.get();

    const vanishingLineage = lineage();
    const vanishingInnerRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    let durableRecordVanished = false;
    const vanishingRepository = Object.freeze({
      get: () =>
        durableRecordVanished
          ? Object.freeze({ status: "missing" })
          : vanishingInnerRepository.get(),
      commit: (expectedGeneration, authenticatedCurrent, candidateRevision) =>
        vanishingInnerRepository.commit(
          expectedGeneration,
          authenticatedCurrent,
          candidateRevision,
        ),
      close: () => vanishingInnerRepository.close(),
    });
    repositories.add(vanishingRepository);
    const vanishingController = activationInternal.createBundleRuntimeActivationInternal({
      bundleStore: {
        getBundle: async () =>
          Object.freeze({
            status: "found",
            entry: Object.freeze({ revision: bundle.revision, bytes: canonicalBundleBytes }),
          }),
        putBundle: async () => Object.freeze({ status: "unchanged" }),
      },
      repository: vanishingRepository,
    });
    services.add(vanishingController);
    const vanishingFirst = await vanishingController.activate(
      vanishingLineage.referenceAuthority,
      vanishingLineage.stagingAuthority,
      null,
    );
    const vanishingAuthority = requireAuthority(
      vanishingFirst,
      "activated",
      "Vanishing-record activation",
    );
    durableRecordVanished = true;
    const vanishedState = vanishingController.readState();
    const blockedAfterVanish = lineage();
    const vanishedActivation = await vanishingController.activate(
      blockedAfterVanish.referenceAuthority,
      blockedAfterVanish.stagingAuthority,
      null,
    );
    const vanishedCandidateStillStaged =
      stagingInternal.readBundleRuntimeStagingAuthority(blockedAfterVanish.stagingAuthority) ===
      blockedAfterVanish.stagingRecord;
    const vanishedAuthorityRevoked =
      activationInternal.readBundleRuntimeActivationAuthority(vanishingAuthority) === undefined;

    const transitionRepository = repositoryInternal.createInMemoryRuntimeActivationRepository();
    repositories.add(transitionRepository);
    const transitionA = transitionRepository.commit(null, null, REVISION_A);
    const transitionB = transitionRepository.commit(0, transitionA.record, REVISION_B);
    const transitionSameB = transitionRepository.commit(1, transitionB.record, REVISION_B);
    const transitionBackA = transitionRepository.commit(2, transitionSameB.record, REVISION_A);
    const beforeStale = transitionRepository.get();
    const stale = transitionRepository.commit(1, transitionBackA.record, REVISION_B);
    const afterStale = transitionRepository.get();
    const exhaustedRepository = repositoryInternal.createInMemoryRuntimeActivationRepository({
      initialRecord: Object.freeze({
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: Number.MAX_SAFE_INTEGER,
      }),
    });
    repositories.add(exhaustedRepository);
    const exhaustedBefore = exhaustedRepository.get();
    const exhausted = exhaustedRepository.commit(
      Number.MAX_SAFE_INTEGER,
      exhaustedBefore.record,
      REVISION_B,
    );
    const exhaustedAfter = exhaustedRepository.get();

    const rollbackPath = path.join(rootDirectory, "rollback-activation.sqlite3");
    const rollbackRepository = sqliteInternal.openRuntimeActivationSqliteRepository(rollbackPath, {
      beforeCommit() {
        throw new Error("proof precommit fault");
      },
    });
    repositories.add(rollbackRepository);
    let rollbackCode = null;
    try {
      rollbackRepository.commit(null, null, REVISION_A);
    } catch (error) {
      rollbackCode = runtimeErrorCode(error);
    }
    const rollbackCurrent = rollbackRepository.get();
    rollbackRepository.close();
    repositories.delete(rollbackRepository);

    const statementFailurePath = path.join(rootDirectory, "statement-failure-activation.sqlite3");
    const preparedBeforeFailure = [];
    let statementFailureCode = null;
    try {
      sqliteInternal.openRuntimeActivationSqliteRepository(statementFailurePath, {
        afterPrepareStatement(statement) {
          preparedBeforeFailure.push(statement);
          if (statement === "read") throw new Error("proof statement-acquisition fault");
        },
      });
    } catch (error) {
      statementFailureCode = runtimeErrorCode(error);
    }
    const statementRecoveryRepository =
      sqliteInternal.openRuntimeActivationSqliteRepository(statementFailurePath);
    repositories.add(statementRecoveryRepository);
    const statementRecoveryState = statementRecoveryRepository.get();

    const indeterminatePath = path.join(rootDirectory, "indeterminate-activation.sqlite3");
    const indeterminateRepository = sqliteInternal.openRuntimeActivationSqliteRepository(
      indeterminatePath,
      {
        afterCommit() {
          throw new Error("proof postcommit fault");
        },
      },
    );
    const indeterminate = indeterminateRepository.commit(null, null, REVISION_A);
    let revokedCode = null;
    try {
      indeterminateRepository.get();
    } catch (error) {
      revokedCode = runtimeErrorCode(error);
    }
    const recoveredRepository =
      sqliteInternal.openRuntimeActivationSqliteRepository(indeterminatePath);
    repositories.add(recoveredRepository);
    const recoveredRecord = recoveredRepository.get();
    const indeterminateStat = await stat(indeterminatePath);

    const unsafePath = path.join(rootDirectory, "unsafe-sidecar.sqlite3");
    await symlink(path.join(rootDirectory, "missing-sidecar-target"), `${unsafePath}-wal`);
    let unsafeSidecarCode = null;
    try {
      sqliteInternal.openRuntimeActivationSqliteRepository(unsafePath);
    } catch (error) {
      unsafeSidecarCode = runtimeErrorCode(error);
    }

    const rawRoot = await makeRoot("desen-m07-t07-raw-");
    const rawPath = path.join(rawRoot, "runtime-activation.sqlite3");
    const rawRepository = sqliteInternal.openRuntimeActivationSqliteRepository(rawPath);
    rawRepository.commit(null, null, REVISION_A);
    rawRepository.close();
    const rawService = await controlPlane.openBundleRuntimeActivation({ rootDirectory: rawRoot });
    services.add(rawService);
    const rawState = rawService.readState();

    const ExternalDatabase = createRequire(path.join(ROOT, APP_PACKAGE))("better-sqlite3");
    const directDeletionLineage = lineage();
    const directDeletionDatabase = new ExternalDatabase(
      path.join(rootDirectory, "runtime-activation.sqlite3"),
    );
    directDeletionDatabase.exec("DELETE FROM runtime_activation WHERE singleton = 1");
    directDeletionDatabase.close();
    const directDeletion = await service.activate(
      directDeletionLineage.referenceAuthority,
      directDeletionLineage.stagingAuthority,
      null,
    );
    const directDeletionCandidateConsumed =
      stagingInternal.readBundleRuntimeStagingAuthority(directDeletionLineage.stagingAuthority) ===
      undefined;
    const directDeletionAuthorityRevoked =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === undefined;
    const directDeletionObserver = sqliteInternal.openRuntimeActivationSqliteRepository(
      path.join(rootDirectory, "runtime-activation.sqlite3"),
    );
    const directDeletionDurable = directDeletionObserver.get();
    directDeletionObserver.close();

    service.close();
    services.delete(service);
    const secondRevokedAfterClose =
      activationInternal.readBundleRuntimeActivationAuthority(secondAuthority) === undefined;
    let closedCode = null;
    try {
      service.readState();
    } catch (error) {
      closedCode = runtimeErrorCode(error);
    }

    return deepFreeze({
      publicModuleKeys: Object.keys(controlPlane).sort(),
      publicSurface: {
        factoryPresent: typeof controlPlane.openBundleRuntimeActivation === "function",
        privateFactoriesAbsent:
          !Object.hasOwn(controlPlane, "createBundleRuntimeActivationInternal") &&
          !Object.hasOwn(controlPlane, "openRuntimeActivationSqliteRepository") &&
          !Object.hasOwn(controlPlane, "readBundleRuntimeActivationAuthority"),
        serviceKeys: Object.keys(rawService).sort(),
        serviceFrozen: Object.isFrozen(rawService),
      },
      officialActivation: {
        storeStatus: stored.status,
        beforeState: beforeState.status,
        status: first.status,
        record: publicRecord(firstAuthority),
        authorityKeys: Object.keys(firstAuthority).sort(),
        authorityFrozen: Object.isFrozen(firstAuthority),
        exactPrivateJoin:
          firstPrivate.referenceRecord === firstLineage.referenceRecord &&
          firstPrivate.stagingRecord === firstLineage.stagingRecord &&
          firstPrivate.referenceRecord.packageAuthority ===
            firstPrivate.stagingRecord.packageAuthority &&
          firstPrivate.referenceRecord.packageRecord === firstPrivate.stagingRecord.packageRecord,
        stagedConsumed:
          stagingInternal.readBundleRuntimeStagingAuthority(firstLineage.stagingAuthority) ===
          undefined,
        canonicalReclosureExact:
          protocol.canonicalizeJson(firstPrivate.reclosedIntegrityAuthority.bundle) ===
            protocol.canonicalizeJson(bundle) &&
          firstPrivate.reclosedIntegrityAuthority.revision === bundle.revision,
        activeStateSameAuthority: activeState.authority === firstAuthority,
      },
      sameRevision: {
        status: second.status,
        record: publicRecord(secondAuthority),
        stagedConsumed:
          stagingInternal.readBundleRuntimeStagingAuthority(secondStagingAuthority) === undefined,
        stagedRecordTransferredExact: secondPrivate.stagingRecord === secondStagingRecord,
        supersededAuthorityRevoked:
          activationInternal.readBundleRuntimeActivationAuthority(firstAuthority) === undefined,
        currentAuthorityAuthenticated: secondCurrentBeforeClose,
      },
      lifetime: {
        mismatch: rejectionReceipt(mismatch),
        mismatchDidNotConsume: mismatchStillStaged,
        busyLoserCode,
        busyLoserDidNotConsume: busyLoserStillStaged,
        busyWinnerStatus: busyWinner.status,
        missingReclosure: rejectionReceipt(missing),
        missingCandidateConsumed: missingConsumed,
        missingDurableStatus: missingDurable.status,
      },
      transitions: {
        firstA: publicRecord(transitionA.record),
        aToB: publicRecord(transitionB.record),
        sameB: publicRecord(transitionSameB.record),
        bToA: publicRecord(transitionBackA.record),
        staleStatus: stale.status,
        staleCurrent: publicRecord(stale.current),
        staleNoWrite: JSON.stringify(beforeStale) === JSON.stringify(afterStale),
        exhaustedStatus: exhausted.status,
        exhaustedCurrent: publicRecord(exhausted.current),
        exhaustedNoWrite: JSON.stringify(exhaustedBefore) === JSON.stringify(exhaustedAfter),
      },
      durability: {
        precommitFailureCode: rollbackCode,
        precommitRollbackStatus: rollbackCurrent.status,
        statementAcquisitionFailureCode: statementFailureCode,
        statementsPreparedBeforeFailure: preparedBeforeFailure,
        statementAcquisitionReopenStatus: statementRecoveryState.status,
        indeterminateStatus: indeterminate.status,
        indeterminateRepositoryRevokedCode: revokedCode,
        recoveredRecord: publicRecord(recoveredRecord.record),
        databaseRegular: indeterminateStat.isFile(),
        databaseSingleLink: indeterminateStat.nlink === 1,
        unsafeSidecarCode,
      },
      recovery: {
        preexistingStatus: rawState.status,
        preexistingRecord: publicRecord(rawState.record),
        activeAuthorityAbsent: !Object.hasOwn(rawState, "authority"),
        vanishedStatus: vanishedState.status,
        vanishedRecord: publicRecord(vanishedState.record),
        vanishedAuthorityRevoked,
        blockedActivationStatus: vanishedActivation.status,
        blockedCandidateNotConsumed: vanishedCandidateStillStaged,
        directDeletionStatus: directDeletion.status,
        directDeletionCandidateConsumed,
        directDeletionAuthorityRevoked,
        directDeletionDurableStatus: directDeletionDurable.status,
      },
      lifecycle: { closedReadCode: closedCode, closeRevokedCurrent: secondRevokedAfterClose },
    });
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The built M07-T07 child runtime probe failed.");
  } finally {
    for (const service of services) {
      try {
        service.close();
      } catch {
        // Preserve the first proof failure while best-effort revoking native state.
      }
    }
    for (const repository of repositories) {
      try {
        repository.close();
      } catch {
        // Preserve the first proof failure while best-effort revoking native state.
      }
    }
    await Promise.all(
      temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
    );
  }
}

export async function runControlPlaneRuntimeActivationProbe() {
  const proofLibraryUrl = pathToFileURL(path.join(ROOT, PROOF_LIBRARY)).href;
  const program = [
    'const Module = (await import("node:module")).default;',
    "const originalLoad = Module._load;",
    "let nativeLoads = 0;",
    'Module._load = function(request, parent, isMain) { if (typeof request === "string" && request.includes("better-sqlite3")) nativeLoads += 1; return Reflect.apply(originalLoad, this, [request, parent, isMain]); };',
    `const [controlPlane, proof] = await Promise.all([import("@desen/control-plane-api"), import(${JSON.stringify(proofLibraryUrl)})]);`,
    'const [{ mkdtemp, realpath, rm }, os, path] = await Promise.all([import("node:fs/promises"), import("node:os"), import("node:path")]);',
    'const lazyRoot = await realpath(await mkdtemp(path.join(os.default.tmpdir(), "desen-m07-t07-lazy-")));',
    "const beforeOpen = nativeLoads;",
    "let lazyService;",
    "let loadedByPublicFactory = false;",
    "try { lazyService = await controlPlane.openBundleRuntimeActivation({ rootDirectory: lazyRoot }); loadedByPublicFactory = nativeLoads > beforeOpen; } finally { try { lazyService?.close(); } finally { await rm(lazyRoot, { force: true, recursive: true }); } }",
    "const receipt = await proof.runControlPlaneRuntimeActivationProbeInCurrentProcess(controlPlane);",
    "const nativeImport = { beforeOpen, loadedByPublicFactory };",
    "Module._load = originalLoad;",
    "process.stdout.write(JSON.stringify({ ...receipt, nativeImport }));",
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
        maxBuffer: 2 * 1_024 * 1_024,
        timeout: 60_000,
      },
    );
    return deepFreeze(
      copyInertJson(
        parseJsonBytes(Buffer.from(stdout, "utf8"), "runtime activation child probe"),
        "runtimeReceipt",
      ),
    );
  } catch (error) {
    if (error instanceof ControlPlaneRuntimeActivationEvidenceError) throw error;
    fail("RUNTIME_PROBE_MISMATCH", "The bounded M07-T07 child runtime probe failed.");
  }
}

function expectedRuntimeReceipt() {
  return {
    publicModuleKeys: [],
    publicSurface: {
      factoryPresent: true,
      privateFactoriesAbsent: true,
      serviceKeys: ["activate", "close", "readState"],
      serviceFrozen: true,
    },
    officialActivation: {
      storeStatus: "stored",
      beforeState: "empty",
      status: "activated",
      record: {
        activeRevision: EXPECTED_REVISION,
        previousGoodRevision: null,
        generation: 0,
      },
      authorityKeys: [
        "activeRevision",
        "documentId",
        "entrySurfaceId",
        "generation",
        "previousGoodRevision",
        "profile",
        "profileVersion",
        "protocolVersion",
      ],
      authorityFrozen: true,
      exactPrivateJoin: true,
      stagedConsumed: true,
      canonicalReclosureExact: true,
      activeStateSameAuthority: true,
    },
    sameRevision: {
      status: "activated",
      record: {
        activeRevision: EXPECTED_REVISION,
        previousGoodRevision: null,
        generation: 1,
      },
      stagedConsumed: true,
      stagedRecordTransferredExact: true,
      supersededAuthorityRevoked: true,
      currentAuthorityAuthenticated: true,
    },
    lifetime: {
      mismatch: {
        status: "rejected",
        stage: "authority-join",
        codes: ["run.desen.control-plane/INVALID_RUNTIME_ACTIVATION_AUTHORITY"],
        frozen: true,
        authorityAbsent: true,
      },
      mismatchDidNotConsume: true,
      busyLoserCode: "ACTIVATION_BUSY",
      busyLoserDidNotConsume: true,
      busyWinnerStatus: "activated",
      missingReclosure: {
        status: "rejected",
        stage: "bundle-reclosure",
        codes: ["run.desen.control-plane/RUNTIME_ACTIVATION_BUNDLE_RECLOSURE_FAILED"],
        frozen: true,
        authorityAbsent: true,
      },
      missingCandidateConsumed: true,
      missingDurableStatus: "missing",
    },
    transitions: {
      firstA: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      aToB: { activeRevision: REVISION_B, previousGoodRevision: REVISION_A, generation: 1 },
      sameB: { activeRevision: REVISION_B, previousGoodRevision: REVISION_A, generation: 2 },
      bToA: { activeRevision: REVISION_A, previousGoodRevision: REVISION_B, generation: 3 },
      staleStatus: "precondition-failed",
      staleCurrent: {
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: 3,
      },
      staleNoWrite: true,
      exhaustedStatus: "generation-exhausted",
      exhaustedCurrent: {
        activeRevision: REVISION_A,
        previousGoodRevision: REVISION_B,
        generation: Number.MAX_SAFE_INTEGER,
      },
      exhaustedNoWrite: true,
    },
    durability: {
      precommitFailureCode: "STORAGE_IO_FAILURE",
      precommitRollbackStatus: "missing",
      statementAcquisitionFailureCode: "STORAGE_IO_FAILURE",
      statementsPreparedBeforeFailure: ["read"],
      statementAcquisitionReopenStatus: "missing",
      indeterminateStatus: "recovery-required",
      indeterminateRepositoryRevokedCode: "ACTIVATION_CLOSED",
      recoveredRecord: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      databaseRegular: true,
      databaseSingleLink: true,
      unsafeSidecarCode: "UNSAFE_STORAGE_PATH",
    },
    recovery: {
      preexistingStatus: "recovery-required",
      preexistingRecord: { activeRevision: REVISION_A, previousGoodRevision: null, generation: 0 },
      activeAuthorityAbsent: true,
      vanishedStatus: "recovery-required",
      vanishedRecord: null,
      vanishedAuthorityRevoked: true,
      blockedActivationStatus: "recovery-required",
      blockedCandidateNotConsumed: true,
      directDeletionStatus: "recovery-required",
      directDeletionCandidateConsumed: true,
      directDeletionAuthorityRevoked: true,
      directDeletionDurableStatus: "missing",
    },
    lifecycle: { closedReadCode: "ACTIVATION_CLOSED", closeRevokedCurrent: true },
    nativeImport: { beforeOpen: 0, loadedByPublicFactory: true },
  };
}

function assertRuntimeReceipt(receipt) {
  if (!Array.isArray(receipt.publicModuleKeys)) {
    fail("RUNTIME_PROBE_MISMATCH", "The built public module inventory is absent.");
  }
  const frozenServiceKeys = ["activate", "close", "readState"];
  const laterRuntimeKeys = new Set([
    "INVALID_RUNTIME_RECOVERY_PACKAGE_AUTHORITY_CODE",
    "RUNTIME_RECOVERY_BUNDLE_RECLOSURE_FAILED_CODE",
    "RUNTIME_RECOVERY_INTERNAL_FAILURE_CODE",
  ]);
  const frozenPublicModuleKeys = receipt.publicModuleKeys.filter(
    (key) => !laterRuntimeKeys.has(key),
  );
  if (
    !Array.isArray(receipt.publicSurface?.serviceKeys) ||
    frozenServiceKeys.some((key) => !receipt.publicSurface.serviceKeys.includes(key))
  ) {
    fail("RUNTIME_PROBE_MISMATCH", "The M07-T07 activation service surface drifted.");
  }
  const projected = {
    ...receipt,
    publicModuleKeys: [],
    publicSurface: { ...receipt.publicSurface, serviceKeys: frozenServiceKeys },
  };
  if (JSON.stringify(projected) !== JSON.stringify(expectedRuntimeReceipt())) {
    fail("RUNTIME_PROBE_MISMATCH", "The exact M07-T07 runtime receipt drifted.");
  }
  return deepFreeze({
    ...projected,
    publicModuleKeys: frozenPublicModuleKeys,
  });
}

export async function buildControlPlaneRuntimeActivationEvidence(options) {
  const captured = exactOwnDataOptions(
    options,
    new Set(["prerequisiteBytes", "runtimeReceipt", "trackedFileBytes"]),
    "build options",
  );
  const frozenArtifact = await authenticatedFrozenArtifactProjection();
  const trackedPaths = [
    ...TRACKED_TASK_FILES,
    TRACEABILITY,
    NORMATIVE_COVERAGE,
    PROOF_MATRIX,
    FINDINGS,
  ];
  const trackedFileBytes = captureByteOverrides(
    captured.trackedFileBytes,
    trackedPaths,
    "trackedFileBytes",
  );
  const prerequisiteBytes = captureByteOverrides(
    captured.prerequisiteBytes,
    CONTROL_PLANE_RUNTIME_ACTIVATION_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
    "prerequisiteBytes",
  );
  const runtimeReceipt = assertRuntimeReceipt(
    captured.runtimeReceipt === undefined
      ? await runControlPlaneRuntimeActivationProbe()
      : copyInertJson(captured.runtimeReceipt, "runtimeReceipt"),
  );
  const [
    prerequisites,
    trackedFiles,
    distribution,
    registrations,
    traceRows,
    coverage,
    tests,
    implementation,
  ] = await Promise.all([
    prerequisiteReceipts(prerequisiteBytes),
    trackedFileReceipts(trackedFileBytes, frozenArtifact.trackedFiles),
    distributionReceipts(frozenArtifact.distribution),
    registrationProjection(trackedFileBytes),
    traceProjection(trackedFileBytes),
    coverageProjection(trackedFileBytes),
    packageTestProjection(trackedFileBytes),
    implementationProjection(trackedFileBytes),
  ]);
  const expectedRuntimeKeys = registrations.publicExports
    .filter(({ typeOnly }) => !typeOnly)
    .map(({ exported }) => exported)
    .sort();
  if (JSON.stringify(runtimeReceipt.publicModuleKeys) !== JSON.stringify(expectedRuntimeKeys)) {
    fail("RUNTIME_PROBE_MISMATCH", "Built runtime exports disagree with the package-root source.");
  }
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "control-plane-runtime-activation",
    profile: "desen.control-plane.runtime-activation-proof.v1",
    task: "M07-T07",
    result: "PASS",
    summary:
      "The built Web control plane authenticates one exact T04/T06 private lineage, consumes its staged authority before asynchronous work, recloses the complete Bundle from the same immutable T01 store, and commits active, previous-good, and generation as one repository-derived durable record before publishing in-process authority.",
    prerequisites,
    claims: {
      authorityJoin: {
        exactPrivateLineage: runtimeReceipt.officialActivation.exactPrivateJoin,
        stagedCandidateConsumedBeforeFirstAwait: true,
        successfulCandidateConsumed: runtimeReceipt.officialActivation.stagedConsumed,
        mismatchedCandidateNotConsumed: runtimeReceipt.lifetime.mismatchDidNotConsume,
        busyCandidateNotConsumed: runtimeReceipt.lifetime.busyLoserDidNotConsume,
        admittedRejectedCandidateConsumed: runtimeReceipt.lifetime.missingCandidateConsumed,
        supersededActivationAuthorityRevoked:
          runtimeReceipt.sameRevision.supersededAuthorityRevoked,
      },
      sameApplicationBundleReclosure: {
        immutableStorePrerequisite: "M07-T01",
        completeCanonicalEquality: runtimeReceipt.officialActivation.canonicalReclosureExact,
        missingEntryRejectedBeforeCommit:
          runtimeReceipt.lifetime.missingReclosure.stage === "bundle-reclosure",
        missingEntryLeftRepositoryEmpty: runtimeReceipt.lifetime.missingDurableStatus === "missing",
      },
      officialFirstActivation: runtimeReceipt.officialActivation,
      sameRevisionActivation: runtimeReceipt.sameRevision,
      durableTransitions: runtimeReceipt.transitions,
      rollbackAndRecovery: {
        ...runtimeReceipt.durability,
        preexistingRawRecord: runtimeReceipt.recovery,
        activeAuthorityPublishedForRawRecord: false,
      },
      publicBoundary: runtimeReceipt.publicSurface,
      lazyNativeImport: runtimeReceipt.nativeImport,
      implementation,
      registrations,
      traceRows,
      coverageTransitions: coverage,
    },
    trackedFiles,
    distribution,
    tests,
    nonclaims: [
      "M07-T08 still owns validation and reconstruction of durable activation authority after restart or an indeterminate commit.",
      "M07-T09 still owns exhaustive boundary fault injection before, during, and after durable commit.",
      "M07-T10 still owns the complete A → invalid B → valid C, concurrent-writer, race, and restart matrices.",
      "M07-T11 still owns mutable-channel consumption and reference-host notification without treating discovery metadata as activation authority.",
      "P-12 remains NOT_PROVEN because invalid activation preservation across restart requires M07-T08 through M07-T11 and M10-T07.",
      "N-004 remains PLANNED: M07-T07 proves one exact atomic record transition, while M07-T09 still owns every precommit fault boundary required to advance the clause.",
      "N-038 and N-041 remain PLANNED; this task proves the exact transactional slice, not every invalid precommit boundary or final measured cross-system limit profile.",
      "PF-075 and PF-076 remain OPEN implementation findings while their local one-shot and durable-CAS decisions are executable here.",
      "The activation record grants no rollback method, package loader, adapter execution, rendering, channel mutation, host callback, signing, network distribution, or npm publication authority.",
      "SQLite is the Web application adapter only; Android and iOS require native repositories preserving the same observable record, CAS, atomicity, and recovery rules.",
    ],
    reproduction: [
      "pnpm verify:control-plane-runtime-staging",
      "pnpm --filter @desen/control-plane-api... build",
      "pnpm --filter @desen/control-plane-api typecheck",
      "pnpm --filter @desen/control-plane-api test:runtime-activation",
      "node scripts/generate-control-plane-runtime-activation-proof.mjs",
      "node scripts/verify-control-plane-runtime-activation.mjs",
      "node --test tests/control-plane-runtime-activation.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), { parser: "json", printWidth: 100 });
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

export async function verifyControlPlaneRuntimeActivationEvidence(options) {
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
  const built = await buildControlPlaneRuntimeActivationEvidence({
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
            ? DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH
            : artifactPath,
        )
      : captureBytes(captured.artifactBytes, "artifactBytes");
  if (!byteEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M07-T07 evidence artifact is not reproducible.");
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
    fail("PROOF_PIN_DRIFT", "The proof document lacks one exact final M07-T07 artifact pin.");
  }
  return Object.freeze({
    task: "M07-T07",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    packageRuntimeCases: built.artifact.tests.packageRuntimeCases,
    compileTimeNegativeCases: built.artifact.tests.compileTimeNegativeCases,
    rootMutationCases: built.artifact.tests.rootMutationCases,
    prerequisiteArtifacts: built.artifact.prerequisites.length,
    traceRows: built.artifact.claims.traceRows.length,
  });
}

export async function writeControlPlaneRuntimeActivationEvidence(options) {
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
  const built = await buildControlPlaneRuntimeActivationEvidence();
  const artifactPath = requestedPath ?? DEFAULT_CONTROL_PLANE_RUNTIME_ACTIVATION_ARTIFACT_PATH;
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: captured.beforeAtomicRename,
    });
  } catch {
    fail("ARTIFACT_WRITE_FAILED", "The M07-T07 artifact could not be committed atomically.");
  }
  return Object.freeze({
    artifactPath: path.resolve(artifactPath),
    artifactSha256: built.artifactSha256,
  });
}
