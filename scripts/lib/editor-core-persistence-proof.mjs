import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdtemp, open, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { openLocalControlPlane } from "../../apps/control-plane-api/dist/index.js";
import * as editorCoreRuntime from "../../packages/editor-core/dist/index.js";
import {
  createLocalDesenEditorPersistencePort,
  LocalDesenEditorPersistenceConfigurationError,
} from "../../packages/editor-web/dist/index.js";
import { canonicalizeJsonBytes } from "../../packages/protocol/dist/index.js";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const { createDesenEditorDocument, createDesenEditorPersistencePort } = editorCoreRuntime;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_AUTHORITY_BYTES = 32 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-persistence.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-PERSISTENCE.md";
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 49_785,
  sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
});
const FROZEN_PROOF_DOCUMENT_PIN = Object.freeze({
  bytes: 4_631,
  sha256: "4076d45392de8662cfb52672550b6906341cf2c44be165017655c2ac3607ad26",
});
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const EDITOR_CORE_INDEX_SOURCE = "packages/editor-core/src/index.ts";
const EDITOR_CORE_INDEX_RUNTIME = "packages/editor-core/dist/index.js";
const EDITOR_CORE_INDEX_DECLARATION = "packages/editor-core/dist/index.d.ts";
const CONTINUOUS_VALIDATION_SOURCE = "packages/editor-core/src/continuous-validation.ts";
const CONTINUOUS_VALIDATION_RUNTIME = "packages/editor-core/dist/continuous-validation.js";
const CONTINUOUS_VALIDATION_DECLARATION = "packages/editor-core/dist/continuous-validation.d.ts";
const CONTINUOUS_VALIDATION_TEST = "packages/editor-core/test/continuous-validation.test.ts";
const CONTINUOUS_VALIDATION_TYPES = "packages/editor-core/test/continuous-validation.types.ts";
const TERMINAL_INTEGRATION_TEST = "packages/editor-core/test/terminal-integration.test.ts";
const SQLITE_FILE_NAME = "control-plane.sqlite3";
const ORIGIN = "http://127.0.0.1:43127";
const API_TOKEN = "m08-t08-persistence-proof-token-0000000001";
const WRONG_API_TOKEN = "m08-t08-persistence-wrong-token-000000001";
const SOURCE_KEY = "local-draft";
const UNCERTAIN_SOURCE_KEY = "uncertain-draft";
const NAMESPACED_EXTENSION_KEY = "com.example.editor-roundtrip";
const LEGACY_EXTENSION_KEY = "legacy-marker";
const PACKAGE_SCRIPT_PREFIX =
  "pnpm verify:control-plane-local-api && pnpm verify:editor-core-authoring-round-trip && pnpm --filter @desen/control-plane-api... build && pnpm --filter @desen/editor-web... build && pnpm --filter @desen/control-plane-api typecheck && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-web typecheck && pnpm --filter @desen/editor-core test:persistence && pnpm --filter @desen/editor-web test:local-source-persistence && pnpm --filter @desen/editor-core test:public-package && pnpm --filter @desen/editor-web test:public-package";
const PACKAGE_SCRIPTS = Object.freeze({
  "generate:editor-core-persistence": `${PACKAGE_SCRIPT_PREFIX} && node scripts/generate-editor-core-persistence-proof.mjs`,
  "verify:editor-core-persistence": `${PACKAGE_SCRIPT_PREFIX} && node scripts/verify-editor-core-persistence.mjs`,
  "test:editor-core-persistence": `${PACKAGE_SCRIPT_PREFIX} && node --test tests/editor-core-persistence.test.mjs`,
});
const CONTINUOUS_VALIDATION_PACKAGE_SCRIPT_PREFIX =
  "pnpm verify:editor-core-authoring-round-trip && pnpm --filter @desen/editor-core... build && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-core test:continuous-validation && pnpm --filter @desen/editor-core test:public-package";
const CONTINUOUS_VALIDATION_PACKAGE_SCRIPTS = Object.freeze({
  "generate:editor-core-continuous-validation": `${CONTINUOUS_VALIDATION_PACKAGE_SCRIPT_PREFIX} && node scripts/generate-editor-core-continuous-validation-proof.mjs`,
  "verify:editor-core-continuous-validation": `${CONTINUOUS_VALIDATION_PACKAGE_SCRIPT_PREFIX} && node scripts/verify-editor-core-continuous-validation.mjs`,
  "test:editor-core-continuous-validation": `${CONTINUOUS_VALIDATION_PACKAGE_SCRIPT_PREFIX} && node --test tests/editor-core-continuous-validation.test.mjs`,
});
const TERMINAL_INTEGRATION_PACKAGE_SCRIPT_PREFIX =
  "pnpm verify:editor-core-continuous-validation && pnpm verify:editor-core-persistence && pnpm --filter @desen/editor-core... build && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-core test:terminal-integration && pnpm --filter @desen/editor-core test:public-package";
const TERMINAL_INTEGRATION_PACKAGE_SCRIPTS = Object.freeze({
  "generate:editor-core-terminal-integration": `${TERMINAL_INTEGRATION_PACKAGE_SCRIPT_PREFIX} && node scripts/generate-editor-core-terminal-integration-proof.mjs`,
  "verify:editor-core-terminal-integration": `${TERMINAL_INTEGRATION_PACKAGE_SCRIPT_PREFIX} && node scripts/verify-editor-core-terminal-integration.mjs`,
  "test:editor-core-terminal-integration": `${TERMINAL_INTEGRATION_PACKAGE_SCRIPT_PREFIX} && node --test tests/editor-core-terminal-integration.test.mjs`,
});
const EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES = Object.freeze([
  "composes all 32 command APIs with immutable snapshots and an exact stable-identity ledger",
  "replays two independent command runs byte-for-byte without sharing result identity",
  "ends T09-valid with retained obligations and distinguishes authoring fingerprints from digests",
  "round-trips the terminal document through an injected T08 persistence adapter",
]);

const PERSISTENCE_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorPersistencePort"]);
const PERSISTENCE_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorPersistenceAdapter",
    "DesenEditorPersistenceAdapterFailureReason",
    "DesenEditorPersistenceAdapterReadResult",
    "DesenEditorPersistenceAdapterSourceRecord",
    "DesenEditorPersistenceAdapterWriteRequest",
    "DesenEditorPersistenceAdapterWriteResult",
    "DesenEditorPersistenceDiagnostic",
    "DesenEditorPersistenceDiagnosticCode",
    "DesenEditorPersistencePort",
    "DesenEditorSourceOpenResult",
    "DesenEditorSourceOpenSuccess",
    "DesenEditorSourceSaveRequest",
    "DesenEditorSourceSaveResult",
  ].sort(compareText),
);
const CONTINUOUS_VALIDATION_RUNTIME_EXPORTS = Object.freeze([
  "createDesenEditorContinuousValidator",
]);
const CONTINUOUS_VALIDATION_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorContinuousValidationReport",
    "DesenEditorContinuousValidator",
    "DesenEditorContinuousValidatorCreationFailure",
    "DesenEditorContinuousValidatorCreationResult",
    "DesenEditorContinuousValidatorCreationSuccess",
    "DesenEditorInvalidSubjectMapping",
  ].sort(compareText),
);
const EDITOR_CORE_MODULE_NAMES = Object.freeze([
  "index",
  "source-document",
  "stable-id-insert",
  "structural-edits",
  "content-edits",
  "state-binding-edits",
  "event-action-edits",
  "persistence",
  "continuous-validation",
]);
const EDITOR_CORE_EMITTED_PATHS = Object.freeze(
  EDITOR_CORE_MODULE_NAMES.flatMap((name) => [
    `packages/editor-core/dist/${name}.d.ts`,
    `packages/editor-core/dist/${name}.d.ts.map`,
    `packages/editor-core/dist/${name}.js`,
    `packages/editor-core/dist/${name}.js.map`,
  ]).sort(compareText),
);

const PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M07-T05",
    proofId: "control-plane-local-api",
    profile: "desen.control-plane.local-api-proof.v1",
    path: "docs/proof/artifacts/control-plane-api-0.1.0-local-api.json",
    bytes: 41_945,
    sha256: "144e8a46b3b41a1f98a022bf4c16dddb9d7415af4e5033322484d4bdd49c55b9",
  }),
  Object.freeze({
    task: "M08-T07",
    proofId: "editor-core-authoring-round-trip",
    profile: "desen.editor-core.authoring-round-trip-proof.v1",
    path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    bytes: 62_304,
    sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
  }),
]);

const TRACKED_SOURCE_PATHS = Object.freeze([
  FIXTURE_PATH,
  "package.json",
  "pnpm-lock.yaml",
  "apps/control-plane-api/package.json",
  "apps/control-plane-api/src/index.ts",
  "apps/control-plane-api/src/local-control-plane.ts",
  "apps/control-plane-api/src/local-control-plane-contract.ts",
  "apps/control-plane-api/src/local-control-plane-internal.ts",
  "apps/control-plane-api/src/local-control-plane-repository-internal.ts",
  "apps/control-plane-api/src/local-control-plane-sqlite-internal.ts",
  "apps/control-plane-api/test/local-control-plane.test.ts",
  "packages/editor-core/package.json",
  "packages/editor-core/README.md",
  EDITOR_CORE_INDEX_SOURCE,
  CONTINUOUS_VALIDATION_SOURCE,
  "packages/editor-core/src/persistence.ts",
  CONTINUOUS_VALIDATION_TEST,
  CONTINUOUS_VALIDATION_TYPES,
  TERMINAL_INTEGRATION_TEST,
  "packages/editor-core/test/persistence.test.ts",
  "packages/editor-core/test/persistence.types.ts",
  "packages/editor-core/test/public-package.mjs",
  "packages/editor-core/test/public-package.types.mts",
  "packages/editor-web/package.json",
  "packages/editor-web/src/index.ts",
  "packages/editor-web/src/local-source-json.ts",
  "packages/editor-web/src/local-source-persistence.ts",
  "packages/editor-web/test/local-source-persistence.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
  "packages/editor-web/tsconfig.build.json",
  "packages/editor-web/tsconfig.json",
  "packages/editor-web/tsconfig.public-package.json",
  "packages/protocol/package.json",
  "packages/runtime-core/package.json",
  "packages/validator/package.json",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/editor-core-persistence-proof.mjs",
  "scripts/generate-editor-core-persistence-proof.mjs",
  "scripts/verify-editor-core-persistence.mjs",
  "tests/editor-core-persistence.test.mjs",
  ...PREREQUISITE_PINS.map(({ path: prerequisitePath }) => prerequisitePath),
]);

const DISTRIBUTION_ROOTS = Object.freeze([
  "apps/control-plane-api/dist",
  "packages/editor-core/dist",
  "packages/editor-web/dist",
  "packages/protocol/dist",
  "packages/runtime-core/dist",
  "packages/validator/dist",
]);

const RETAINED_T08_RECEIPT_PATHS = Object.freeze(
  [
    FIXTURE_PATH,
    "apps/control-plane-api/package.json",
    "apps/control-plane-api/src/index.ts",
    "apps/control-plane-api/src/local-control-plane.ts",
    "apps/control-plane-api/src/local-control-plane-contract.ts",
    "apps/control-plane-api/src/local-control-plane-internal.ts",
    "apps/control-plane-api/src/local-control-plane-repository-internal.ts",
    "apps/control-plane-api/src/local-control-plane-sqlite-internal.ts",
    "apps/control-plane-api/test/local-control-plane.test.ts",
    "apps/control-plane-api/dist/index.js",
    "apps/control-plane-api/dist/local-control-plane.js",
    "packages/editor-core/src/persistence.ts",
    "packages/editor-core/test/persistence.test.ts",
    "packages/editor-core/test/persistence.types.ts",
    "packages/editor-core/dist/persistence.js",
    "packages/editor-core/dist/persistence.d.ts",
    "packages/editor-web/package.json",
    "packages/editor-web/src/index.ts",
    "packages/editor-web/src/local-source-json.ts",
    "packages/editor-web/src/local-source-persistence.ts",
    "packages/editor-web/test/local-source-persistence.test.ts",
    "packages/editor-web/test/public-package.mjs",
    "packages/editor-web/test/public-package.types.mts",
    "packages/editor-web/tsconfig.build.json",
    "packages/editor-web/tsconfig.json",
    "packages/editor-web/tsconfig.public-package.json",
    "packages/editor-web/dist/index.js",
    "packages/editor-web/dist/index.d.ts",
    "packages/editor-web/dist/local-source-json.js",
    "packages/editor-web/dist/local-source-json.d.ts",
    "packages/editor-web/dist/local-source-persistence.js",
    "packages/editor-web/dist/local-source-persistence.d.ts",
  ].sort(compareText),
);

const BUILD_OPTION_KEYS = Object.freeze([
  "fileOverrides",
  "m07PrerequisiteBytes",
  "m08PrerequisiteBytes",
  "runtime",
]);
const VERIFY_OPTION_KEYS = Object.freeze([
  "artifactBytes",
  "artifactPath",
  "buildOptions",
  "proofDocument",
  "proofDocumentPath",
]);
const WRITE_OPTION_KEYS = Object.freeze(["beforeAtomicRename", "destinationPath"]);

export const EDITOR_CORE_PERSISTENCE_PREREQUISITE_PINS = PREREQUISITE_PINS;
export const EDITOR_CORE_PERSISTENCE_PACKAGE_SCRIPTS = PACKAGE_SCRIPTS;

export const EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates frozen M07-T05 and M08-T07 plus current emitted integration bytes",
  "[lifecycle] proves create, open, unchanged, and update through the real local SQLite API",
  "[durability] proves two-port CAS, close-reopen durability, and independent Source keys",
  "[round-trip] preserves canonical authoring and all sixteen extension locations",
  "[adversarial] resolves uncertain commits and fails closed for malformed transport authority",
  "[determinism] two fresh M08-T08 evidence builds are byte-identical",
  "[mutation] rejects prerequisite, tracked-file, and runtime substitution",
  "[artifact] verifies exact bytes and one visible proof-document pin",
  "[writer] atomically commits exact bytes and protects an existing destination",
  "[options] rejects linked authority and active, inherited, proxy, or shared inputs",
]);

export const DEFAULT_EDITOR_CORE_PERSISTENCE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCorePersistenceProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCorePersistenceProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCorePersistenceProofError(code, message, details);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, visited = new Set()) {
  if (
    value === null ||
    typeof value !== "object" ||
    ArrayBuffer.isView(value) ||
    visited.has(value)
  ) {
    return value;
  }
  visited.add(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return Object.freeze(value);
}

function deeplyFrozen(value, visited = new Set()) {
  if (value === null || typeof value !== "object" || visited.has(value)) return true;
  visited.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => deeplyFrozen(child, visited));
}

function exactOwnData(input, allowedKeys, label) {
  try {
    if (
      input === undefined ||
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      utilTypes.isProxy(input) ||
      (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    ) {
      fail("OPTIONS_INVALID", `${label} must be one plain non-Proxy object.`);
    }
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
      fail("OPTIONS_INVALID", `${label} contains an unknown or symbolic key.`);
    }
    const captured = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail("OPTIONS_INVALID", `${label}.${key} must be enumerable own data.`);
      }
      captured[key] = descriptor.value;
    }
    return captured;
  } catch (error) {
    if (error instanceof EditorCorePersistenceProofError) throw error;
    fail("OPTIONS_INVALID", `${label} could not be captured without executing caller authority.`);
  }
}

function captureBytes(value, label) {
  try {
    if (!(value instanceof Uint8Array) || !(value.buffer instanceof ArrayBuffer)) {
      fail("OPTIONS_INVALID", `${label} must be private Buffer or Uint8Array bytes.`);
    }
    return Buffer.from(value);
  } catch (error) {
    if (error instanceof EditorCorePersistenceProofError) throw error;
    fail("OPTIONS_INVALID", `${label} bytes could not be copied safely.`);
  }
}

function captureFileOverrides(value) {
  if (value === undefined) return new Map();
  const captured = exactOwnData(value, TRACKED_SOURCE_PATHS, "fileOverrides");
  return new Map(
    Object.entries(captured).map(([relativePath, bytes]) => [
      relativePath,
      typeof bytes === "string" ? Buffer.from(bytes, "utf8") : captureBytes(bytes, relativePath),
    ]),
  );
}

function captureBuildOptions(raw) {
  if (raw === undefined) {
    return Object.freeze({
      fileOverrides: new Map(),
      m07PrerequisiteBytes: undefined,
      m08PrerequisiteBytes: undefined,
    });
  }
  const captured = exactOwnData(raw, BUILD_OPTION_KEYS, "buildOptions");
  if (captured.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "Caller runtime substitution cannot issue M08-T08 PASS.");
  }
  return Object.freeze({
    fileOverrides: captureFileOverrides(captured.fileOverrides),
    m07PrerequisiteBytes:
      captured.m07PrerequisiteBytes === undefined
        ? undefined
        : captureBytes(captured.m07PrerequisiteBytes, "m07PrerequisiteBytes"),
    m08PrerequisiteBytes:
      captured.m08PrerequisiteBytes === undefined
        ? undefined
        : captureBytes(captured.m08PrerequisiteBytes, "m08PrerequisiteBytes"),
  });
}

async function readNoFollow(absolutePath, label, maximumBytes = MAX_AUTHORITY_BYTES) {
  let handle;
  try {
    const canonicalParent = await realpath(path.dirname(absolutePath));
    if (canonicalParent !== path.dirname(absolutePath)) {
      fail("FILESYSTEM_UNSAFE", `${label} parent is not canonical.`);
    }
    const before = await lstat(absolutePath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", `${label} must be one regular single-link file.`);
    }
    if (before.size > maximumBytes) fail("AUTHORITY_LIMIT_EXCEEDED", `${label} is too large.`);
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile()) {
      fail("FILESYSTEM_UNSAFE", `${label} changed before its authority read.`);
    }
    const bytes = await handle.readFile();
    const after = await lstat(absolutePath);
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.byteLength ||
      after.mtimeNs !== opened.mtimeNs
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed during its authority read.`);
    }
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof EditorCorePersistenceProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} could not be read safely.`, String(error));
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function trackedBytes(relativePath, options) {
  const live = await readNoFollow(path.join(WORKSPACE_ROOT, relativePath), relativePath);
  const override = options.fileOverrides.get(relativePath);
  if (override !== undefined && !override.equals(live)) {
    fail("TRACKED_FILE_DRIFT", `Tracked M08-T08 authority drifted: ${relativePath}.`);
  }
  return override ?? live;
}

async function distributionPaths(relativeRoot) {
  const output = [];
  async function visit(relativeDirectory) {
    const absoluteDirectory = path.join(WORKSPACE_ROOT, relativeDirectory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) await visit(relativePath);
      else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts"))) {
        output.push(relativePath);
      } else if (entry.isSymbolicLink()) {
        fail("FILESYSTEM_UNSAFE", `Distribution contains a symbolic link: ${relativePath}.`);
      }
    }
  }
  await visit(relativeRoot);
  return output;
}

async function editorCoreEmittedPaths() {
  const relativeRoot = "packages/editor-core/dist";
  const entries = await readdir(path.join(WORKSPACE_ROOT, relativeRoot), {
    withFileTypes: true,
  });
  if (entries.some((entry) => entry.isSymbolicLink())) {
    fail("FILESYSTEM_UNSAFE", "The emitted editor-core package contains a symbolic link.");
  }
  const paths = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".js") ||
          entry.name.endsWith(".js.map") ||
          entry.name.endsWith(".d.ts") ||
          entry.name.endsWith(".d.ts.map")),
    )
    .map((entry) => path.posix.join(relativeRoot, entry.name))
    .sort(compareText);
  if (JSON.stringify(paths) !== JSON.stringify(EDITOR_CORE_EMITTED_PATHS)) {
    fail("EMITTED_PACKAGE_DRIFT", "The current editor-core package must emit exactly 36 files.", {
      actual: paths,
    });
  }
  return paths;
}

async function currentTrackedPaths() {
  const [distribution, editorEmitted] = await Promise.all([
    Promise.all(DISTRIBUTION_ROOTS.map((relativeRoot) => distributionPaths(relativeRoot))).then(
      (paths) => paths.flat(),
    ),
    editorCoreEmittedPaths(),
  ]);
  return Object.freeze(
    [...new Set([...TRACKED_SOURCE_PATHS, ...distribution, ...editorEmitted])].sort(compareText),
  );
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("JSON_INVALID", `${label} is not valid UTF-8 JSON.`);
  }
}

function exactNames(actual, expected, code, label) {
  const sortedActual = [...actual].sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    fail(code, `${label} drifted.`, { actual: sortedActual, expected: sortedExpected });
  }
  return Object.freeze(sortedActual);
}

function reexportedNames(bytes, label) {
  const source = bytes.toString("utf8");
  const runtime = [];
  const types = [];
  for (const match of source.matchAll(
    /\bexport\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+["'][^"']+["'];?/gu,
  )) {
    const target = match[1] === undefined ? runtime : types;
    for (const entry of match[2].split(",")) {
      const normalized = entry.trim().replace(/^type\s+/u, "");
      if (normalized === "") continue;
      target.push(normalized.split(/\s+as\s+/u).at(-1));
    }
  }
  if (runtime.length + types.length === 0) {
    fail("PUBLIC_SURFACE_DRIFT", `${label} lost its explicit re-export surface.`);
  }
  return Object.freeze({
    runtime: Object.freeze(runtime.sort(compareText)),
    types: Object.freeze(types.sort(compareText)),
  });
}

function directModuleExports(bytes, label) {
  const source = bytes.toString("utf8");
  const runtime = [];
  const types = [];
  for (const match of source.matchAll(
    /^\s*export\s+(?:declare\s+)?(interface|type|function|class|const)\s+([A-Za-z_$][\w$]*)/gmu,
  )) {
    (match[1] === "interface" || match[1] === "type" ? types : runtime).push(match[2]);
  }
  if (runtime.length + types.length === 0) {
    fail("EMITTED_PACKAGE_DRIFT", `${label} lost its direct export surface.`);
  }
  return Object.freeze({
    runtime: Object.freeze(runtime.sort(compareText)),
    types: Object.freeze(types.sort(compareText)),
  });
}

function staticEditorCoreEdges(files) {
  let edges = 0;
  for (const name of EDITOR_CORE_MODULE_NAMES) {
    const relativePath = `packages/editor-core/dist/${name}.js`;
    const source = files.get(relativePath).toString("utf8");
    edges += [...source.matchAll(/^(?:import|export)\s+.*\sfrom\s+["'][^"']+["'];?/gmu)].length;
  }
  if (edges !== 24) {
    fail("EMITTED_PACKAGE_DRIFT", "The current editor-core graph must retain 24 static edges.", {
      actual: edges,
    });
  }
  return edges;
}

function verifyEditorCoreCompatibility(files, t07Artifact) {
  const expectedRuntime = exactNames(
    [
      ...t07Artifact.publicApi.runtimeExports,
      ...PERSISTENCE_RUNTIME_EXPORTS,
      ...CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
    ],
    [
      ...t07Artifact.publicApi.runtimeExports,
      ...PERSISTENCE_RUNTIME_EXPORTS,
      ...CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
    ],
    "PUBLIC_SURFACE_DRIFT",
    "Expected current runtime export inventory",
  );
  const expectedTypes = exactNames(
    [
      ...t07Artifact.publicApi.typeExports,
      ...PERSISTENCE_TYPE_EXPORTS,
      ...CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ],
    [
      ...t07Artifact.publicApi.typeExports,
      ...PERSISTENCE_TYPE_EXPORTS,
      ...CONTINUOUS_VALIDATION_TYPE_EXPORTS,
    ],
    "PUBLIC_SURFACE_DRIFT",
    "Expected current type export inventory",
  );
  if (expectedRuntime.length !== 35 || expectedTypes.length !== 88) {
    fail("PUBLIC_SURFACE_DRIFT", "The retained T07 plus T08 and T09 inventories drifted.");
  }
  const sourceIndex = reexportedNames(
    files.get(EDITOR_CORE_INDEX_SOURCE),
    EDITOR_CORE_INDEX_SOURCE,
  );
  const emittedIndex = reexportedNames(
    files.get(EDITOR_CORE_INDEX_RUNTIME),
    EDITOR_CORE_INDEX_RUNTIME,
  );
  const emittedDeclaration = reexportedNames(
    files.get(EDITOR_CORE_INDEX_DECLARATION),
    EDITOR_CORE_INDEX_DECLARATION,
  );
  exactNames(
    sourceIndex.runtime,
    expectedRuntime,
    "PUBLIC_SURFACE_DRIFT",
    "Source runtime exports",
  );
  exactNames(sourceIndex.types, expectedTypes, "PUBLIC_SURFACE_DRIFT", "Source type exports");
  exactNames(
    emittedIndex.runtime,
    expectedRuntime,
    "EMITTED_PACKAGE_DRIFT",
    "Emitted runtime exports",
  );
  exactNames(
    emittedDeclaration.runtime,
    expectedRuntime,
    "EMITTED_PACKAGE_DRIFT",
    "Emitted declaration runtime exports",
  );
  exactNames(
    emittedDeclaration.types,
    expectedTypes,
    "EMITTED_PACKAGE_DRIFT",
    "Emitted declaration type exports",
  );
  exactNames(
    Object.keys(editorCoreRuntime),
    expectedRuntime,
    "PUBLIC_SURFACE_DRIFT",
    "Loaded public runtime exports",
  );
  for (const [relativePath, expected] of [
    [
      CONTINUOUS_VALIDATION_SOURCE,
      { runtime: CONTINUOUS_VALIDATION_RUNTIME_EXPORTS, types: CONTINUOUS_VALIDATION_TYPE_EXPORTS },
    ],
    [CONTINUOUS_VALIDATION_RUNTIME, { runtime: CONTINUOUS_VALIDATION_RUNTIME_EXPORTS, types: [] }],
    [
      CONTINUOUS_VALIDATION_DECLARATION,
      { runtime: CONTINUOUS_VALIDATION_RUNTIME_EXPORTS, types: CONTINUOUS_VALIDATION_TYPE_EXPORTS },
    ],
  ]) {
    const direct = directModuleExports(files.get(relativePath), relativePath);
    exactNames(
      direct.runtime,
      expected.runtime,
      "EMITTED_PACKAGE_DRIFT",
      `${relativePath} runtime exports`,
    );
    exactNames(
      direct.types,
      expected.types,
      "EMITTED_PACKAGE_DRIFT",
      `${relativePath} type exports`,
    );
  }
  return deepFreeze({
    currentPackageRuntimeExports: expectedRuntime,
    currentPackageTypeExports: expectedTypes,
    additiveSuccessor: {
      task: "M08-T09",
      authority: "COMPATIBILITY_ONLY_NOT_M08_T08_CLAIM_AUTHORITY",
      relationship: "ADDITIVE_SIBLING_SUCCESSOR",
      sourcePath: CONTINUOUS_VALIDATION_SOURCE,
      runtimePath: CONTINUOUS_VALIDATION_RUNTIME,
      declarationPath: CONTINUOUS_VALIDATION_DECLARATION,
      focusedTestPath: CONTINUOUS_VALIDATION_TEST,
      focusedTypesPath: CONTINUOUS_VALIDATION_TYPES,
      runtimeExports: CONTINUOUS_VALIDATION_RUNTIME_EXPORTS,
      typeExports: CONTINUOUS_VALIDATION_TYPE_EXPORTS,
      publicDeclarations: 7,
      tsdocDeclarations: 7,
      publicRuntimeCasesAdded: 1,
      publicCompilerNegativeAssertionsAdded: 6,
    },
    terminalProofSuccessor: {
      task: "M08-T10",
      authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
      focusedTestPath: TERMINAL_INTEGRATION_TEST,
      runtimeExportsAdded: 0,
      typeExportsAdded: 0,
      focusedRuntimeCases: EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES.length,
      publicRuntimeCasesAdded: 0,
      publicCompilerNegativeAssertionsAdded: 0,
    },
    currentEmittedFiles: EDITOR_CORE_EMITTED_PATHS.length,
    staticEsmEdges: staticEditorCoreEdges(files),
  });
}

async function authenticateFrozenArtifact() {
  const artifactBytes = await readNoFollow(
    DEFAULT_EDITOR_CORE_PERSISTENCE_ARTIFACT_PATH,
    "frozen M08-T08 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T08 artifact bytes differ from their reviewed pin.");
  }
  const proofDocumentBytes = await readNoFollow(
    path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH),
    "frozen M08-T08 proof document",
  );
  if (
    proofDocumentBytes.byteLength !== FROZEN_PROOF_DOCUMENT_PIN.bytes ||
    sha256(proofDocumentBytes) !== FROZEN_PROOF_DOCUMENT_PIN.sha256
  ) {
    fail(
      "PROOF_DOCUMENT_DRIFT",
      "The frozen M08-T08 proof document drifted from its reviewed pin.",
    );
  }
  const artifact = parseJson(artifactBytes, "frozen M08-T08 proof artifact");
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-persistence" ||
    artifact.profile !== "desen.editor-core.persistence-proof.v1" ||
    artifact.task !== "M08-T08" ||
    artifact.result !== "PASS" ||
    artifact.prerequisites?.length !== PREREQUISITE_PINS.length ||
    artifact.executionAuthority?.emittedDistributionReceipts !== 180 ||
    artifact.executionAuthority?.trackedFiles !== 218 ||
    artifact.trackedFiles?.length !== 218 ||
    artifact.tests?.editorCorePublicRuntimeCases !== 49 ||
    artifact.tests?.editorCorePublicCompilerNegativeAssertions !== 96 ||
    artifact.nonclaims?.length !== 8
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T08 artifact identity or claim projection drifted.");
  }
  const prerequisiteProjection = artifact.prerequisites.map(
    ({ task, proofId, profile, path: prerequisitePath, bytes, sha256: digest }) => ({
      task,
      proofId,
      profile,
      path: prerequisitePath,
      bytes,
      sha256: digest,
    }),
  );
  if (JSON.stringify(prerequisiteProjection) !== JSON.stringify(PREREQUISITE_PINS)) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T08 formal prerequisite list drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedT08Receipts(frozenArtifact, files) {
  const receiptByPath = new Map(
    frozenArtifact.trackedFiles.map((receipt) => [receipt.path, receipt]),
  );
  for (const relativePath of RETAINED_T08_RECEIPT_PATHS) {
    const receipt = receiptByPath.get(relativePath);
    const bytes = files.get(relativePath);
    if (receipt?.bytes !== bytes?.byteLength || receipt?.sha256 !== sha256(bytes)) {
      fail("RETAINED_T08_AUTHORITY_DRIFT", `Retained M08-T08 authority drifted: ${relativePath}.`);
    }
  }
}

async function authenticatePrerequisites(options) {
  const provided = [options.m07PrerequisiteBytes, options.m08PrerequisiteBytes];
  const evidence = [];
  for (let index = 0; index < PREREQUISITE_PINS.length; index += 1) {
    const pin = PREREQUISITE_PINS[index];
    const bytes =
      provided[index] ??
      (await readNoFollow(path.join(WORKSPACE_ROOT, pin.path), `${pin.task} prerequisite`));
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The exact frozen ${pin.task} receipt drifted.`);
    }
    const artifact = parseJson(bytes, `${pin.task} prerequisite`);
    if (
      artifact.schemaVersion !== 1 ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.task !== pin.task ||
      artifact.result !== "PASS"
    ) {
      fail("PREREQUISITE_DRIFT", `The frozen ${pin.task} PASS profile drifted.`);
    }
    evidence.push(
      Object.freeze({
        ...pin,
        result: "PASS",
        authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      }),
    );
  }
  if (provided.some((value) => value !== undefined)) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "Caller prerequisite bytes cannot issue PASS.");
  }
  return Object.freeze(evidence);
}

function extensionPayload(kind) {
  const extensions = JSON.parse(`{
    "${NAMESPACED_EXTENSION_KEY}": {
      "kind": "",
      "ordered": ["first", {"middle": true}, "first", null, [], {}],
      "apparentCore": {"id": "fake.id", "type": "event.emit", "name": "fake.event"},
      "unicode": ["İstanbul", "e\\u0301", "雪", "\\ud83d\\ude00"],
      "nullValue": null,
      "emptyObject": {},
      "emptyArray": [],
      "__proto__": {"retainedAsOwnData": true},
      "constructor": {"retainedAsOwnData": true},
      "prototype": {"retainedAsOwnData": true}
    },
    "${LEGACY_EXTENSION_KEY}": {"kind": "", "legalNonNamespaced": true},
    "__proto__": {"retainedAsOwnExtensionKey": true},
    "constructor": {"retainedAsOwnExtensionKey": true},
    "prototype": {"retainedAsOwnExtensionKey": true}
  }`);
  extensions[NAMESPACED_EXTENSION_KEY].kind = kind;
  extensions[LEGACY_EXTENSION_KEY].kind = kind;
  return extensions;
}

function authoringPayload(marker) {
  return JSON.parse(
    `{"canvas":{"sign-in":{"x":17,"y":23}},"selection":{"surfaceId":"sign-in","nodeId":"sign-in.title"},"viewport":{"marker":${JSON.stringify(marker)},"zoom":1.25},"ordered":["a","a","b"],"__proto__":{"retained":true},"constructor":{"retained":true},"apparentCore":{"id":"fake.node","on":{"save":[{"type":"event.emit","name":"fake"}]}}}`,
  );
}

function allExtensionActions() {
  return [
    {
      type: "state.set",
      path: "future.value",
      value: { $ref: "state.future", fallback: null },
      extensions: extensionPayload("action.state.set"),
    },
    {
      type: "state.toggle",
      path: "future.enabled",
      extensions: extensionPayload("action.state.toggle"),
    },
    {
      type: "navigate",
      surface: "future-surface",
      params: { tab: { $ref: "state.future" } },
      extensions: extensionPayload("action.navigate"),
    },
    {
      type: "operation.invoke",
      operation: "com.example.future/Save",
      as: "futureSave",
      input: { value: { $ref: "state.future" } },
      concurrency: "queue",
      onSuccess: [{ type: "event.emit", name: "future.saved" }],
      onFailure: [{ type: "resource.refresh", resource: "futureResource" }],
      extensions: extensionPayload("action.operation.invoke"),
    },
    {
      type: "resource.refresh",
      resource: "futureResource",
      extensions: extensionPayload("action.resource.refresh"),
    },
    {
      type: "component.command",
      target: "future.component",
      command: "futureCommand",
      input: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.component.command"),
    },
    {
      type: "event.emit",
      name: "future.event",
      payload: { value: { $ref: "state.future" } },
      extensions: extensionPayload("action.event.emit"),
    },
  ];
}

function preservationInput(validSource, marker) {
  const input = clone(validSource);
  const surface = input.surfaces["sign-in"];
  const root = surface.root;
  const title = root.slots.default[0];

  input.authoring = authoringPayload(marker);
  input.extensions = extensionPayload("document");
  input.catalogs[0].extensions = extensionPayload("source-catalog-requirement");
  surface.extensions = extensionPayload("surface");
  surface.state.email.extensions = extensionPayload("state");
  surface.resources.proof = {
    use: "com.example.data/Proof",
    input: { existing: { $ref: "state.email" } },
    policy: "manual",
    extensions: extensionPayload("resource-instance"),
  };
  root.extensions = extensionPayload("node");
  root.behaviors = [
    {
      id: "sign-in.behavior",
      use: "com.example.interactions/Preview",
      extensions: extensionPayload("behavior"),
    },
  ];
  root.on = { persistence: allExtensionActions() };
  title.repeat = {
    items: { $ref: "resource.proof.value", fallback: [] },
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 10,
    extensions: extensionPayload("repeat"),
  };
  title.variants = [
    {
      when: { op: "truthy", args: [true] },
      props: { marker },
      extensions: extensionPayload("variant"),
    },
  ];
  return input;
}

function extensionProjection(root) {
  const found = new Map();
  const pending = [root];
  const visited = new Set();
  while (pending.length > 0) {
    const value = pending.pop();
    if (value === null || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const extensionDescriptor = descriptors.extensions;
    if (extensionDescriptor !== undefined && "value" in extensionDescriptor) {
      const extensions = extensionDescriptor.value;
      const marker = extensions?.[NAMESPACED_EXTENSION_KEY];
      if (typeof marker?.kind === "string") {
        if (found.has(marker.kind)) fail("INTEGRATION_FAILED", "Extension kind was duplicated.");
        found.set(marker.kind, clone(extensions));
      }
    }
    for (const descriptor of Object.values(descriptors)) {
      if ("value" in descriptor) pending.push(descriptor.value);
    }
  }
  return [...found.entries()].sort(([left], [right]) => compareText(left, right));
}

function admittedDocument(input) {
  const result = createDesenEditorDocument(input);
  if (!result.ok) {
    fail("INTEGRATION_FAILED", "The reviewed persistence fixture was not structurally admitted.", {
      diagnostic: result.diagnostics[0]?.code,
    });
  }
  return result.document;
}

function expectStatus(result, status, label) {
  if (result?.status !== status) {
    fail("INTEGRATION_FAILED", `${label} returned ${String(result?.status)} instead of ${status}.`);
  }
  return result;
}

function createInjectedFetch(controlPlane, calls, options = {}) {
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== ORIGIN || url.search !== "" || url.hash !== "") {
      throw new TypeError("Unexpected injected local Source URL.");
    }
    calls.push(
      Object.freeze({
        method: request.method,
        path: url.pathname,
        bearer: request.headers.authorization === `Bearer ${API_TOKEN}`,
        redirect: request.redirect,
        precondition: request.headers["if-none-match"] ?? request.headers["if-match"] ?? null,
      }),
    );
    const response = await controlPlane.inject({
      method: request.method,
      path: url.pathname,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    });
    if (options.throwAfterPut === true && request.method === "PUT") {
      throw new Error("simulated response loss after durable dispatch");
    }
    return Object.freeze({
      status: response.statusCode,
      headers: response.headers,
      body: new Uint8Array(response.body),
    });
  };
}

function localErrorResponse(code) {
  return Object.freeze({
    status: 500,
    headers: Object.freeze({ "content-type": "application/json" }),
    body: new Uint8Array(
      Buffer.from(
        JSON.stringify({ error: { code, message: "Redacted local persistence failure." } }),
        "utf8",
      ),
    ),
  });
}

function markerOf(document) {
  return document.authoring?.viewport?.marker;
}

async function runIntegration(validSource) {
  const rootDirectory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "desen-m08-t08-persistence-proof-")),
  );
  const calls = [];
  const controls = [];
  try {
    if (typeof createDesenEditorPersistencePort !== "function") {
      fail("INTEGRATION_FAILED", "The public editor-core persistence factory is unavailable.");
    }
    const controlA = await openLocalControlPlane({ rootDirectory, apiToken: API_TOKEN });
    controls.push(controlA);
    const portA = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: createInjectedFetch(controlA, calls),
    });
    if (Reflect.ownKeys(portA).sort(compareText).join(",") !== "openSource,saveSource") {
      fail("INTEGRATION_FAILED", "The public editor-core persistence port widened its authority.");
    }

    expectStatus(await portA.openSource(SOURCE_KEY), "missing", "initial open");
    const createdDocument = admittedDocument(preservationInput(validSource, "created"));
    const created = expectStatus(
      await portA.saveSource({
        sourceKey: SOURCE_KEY,
        expectedGeneration: null,
        document: createdDocument,
      }),
      "created",
      "create",
    );
    if (created.generation !== 1) fail("INTEGRATION_FAILED", "Create generation was not one.");
    const opened = expectStatus(await portA.openSource(SOURCE_KEY), "opened", "first open");
    if (opened.generation !== 1 || markerOf(opened.document) !== "created") {
      fail("INTEGRATION_FAILED", "The created Source did not reopen exactly at generation one.");
    }
    const unchanged = expectStatus(
      await portA.saveSource({
        sourceKey: SOURCE_KEY,
        expectedGeneration: 1,
        document: opened.document,
      }),
      "unchanged",
      "unchanged save",
    );
    if (unchanged.generation !== 1) {
      fail("INTEGRATION_FAILED", "An unchanged Source advanced its generation.");
    }

    const updatedDocument = admittedDocument(preservationInput(validSource, "updated"));
    const updated = expectStatus(
      await portA.saveSource({
        sourceKey: SOURCE_KEY,
        expectedGeneration: 1,
        document: updatedDocument,
      }),
      "updated",
      "update",
    );
    if (updated.generation !== 2) fail("INTEGRATION_FAILED", "Update did not advance to two.");

    const controlB = await openLocalControlPlane({ rootDirectory, apiToken: API_TOKEN });
    controls.push(controlB);
    const portB = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: createInjectedFetch(controlB, calls),
    });
    const [observedA, observedB] = await Promise.all([
      portA.openSource(SOURCE_KEY),
      portB.openSource(SOURCE_KEY),
    ]);
    if (
      observedA.status !== "opened" ||
      observedB.status !== "opened" ||
      observedA.generation !== 2 ||
      observedB.generation !== 2
    ) {
      fail("INTEGRATION_FAILED", "Two ports did not observe the same generation before CAS.");
    }
    const raceDocument = admittedDocument(preservationInput(validSource, "race-winner"));
    const race = await Promise.all([
      portA.saveSource({ sourceKey: SOURCE_KEY, expectedGeneration: 2, document: raceDocument }),
      portB.saveSource({ sourceKey: SOURCE_KEY, expectedGeneration: 2, document: raceDocument }),
    ]);
    const raceStatuses = race.map(({ status }) => status).sort(compareText);
    if (raceStatuses.join(",") !== "conflict,updated") {
      fail(
        "INTEGRATION_FAILED",
        "The two-port CAS race did not yield one winner and one conflict.",
      );
    }
    const updatedRace = race.find(({ status }) => status === "updated");
    const conflictedRace = race.find(({ status }) => status === "conflict");
    if (updatedRace?.generation !== 3 || conflictedRace?.currentGeneration !== 3) {
      fail("INTEGRATION_FAILED", "The CAS winner/conflict generations were not both three.");
    }

    await Promise.all([controlA.close(), controlB.close()]);
    controls.length = 0;
    const sqlitePath = path.join(rootDirectory, SQLITE_FILE_NAME);
    const sqliteEntry = await lstat(sqlitePath);
    if (!sqliteEntry.isFile() || sqliteEntry.isSymbolicLink() || sqliteEntry.nlink !== 1) {
      fail("INTEGRATION_FAILED", "The durable SQLite authority was not one regular file.");
    }

    const controlC = await openLocalControlPlane({ rootDirectory, apiToken: API_TOKEN });
    controls.push(controlC);
    const portC = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: createInjectedFetch(controlC, calls),
    });
    const reopened = expectStatus(await portC.openSource(SOURCE_KEY), "opened", "restart open");
    const expectedBytes = canonicalizeJsonBytes(raceDocument);
    const reopenedBytes = canonicalizeJsonBytes(reopened.document);
    const expectedExtensions = extensionProjection(raceDocument);
    const reopenedExtensions = extensionProjection(reopened.document);
    if (
      reopened.generation !== 3 ||
      markerOf(reopened.document) !== "race-winner" ||
      !Buffer.from(reopenedBytes).equals(Buffer.from(expectedBytes)) ||
      JSON.stringify(reopened.document.authoring) !== JSON.stringify(raceDocument.authoring) ||
      JSON.stringify(reopenedExtensions) !== JSON.stringify(expectedExtensions) ||
      expectedExtensions.length !== 16 ||
      !deeplyFrozen(reopened)
    ) {
      fail("INTEGRATION_FAILED", "Close-reopen lost canonical authoring or extension values.");
    }
    const restartUnchanged = expectStatus(
      await portC.saveSource({
        sourceKey: SOURCE_KEY,
        expectedGeneration: 3,
        document: reopened.document,
      }),
      "unchanged",
      "restart unchanged save",
    );

    const uncertainDocument = admittedDocument(preservationInput(validSource, "uncertain"));
    const uncertainPort = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: createInjectedFetch(controlC, calls, { throwAfterPut: true }),
    });
    const uncertain = expectStatus(
      await uncertainPort.saveSource({
        sourceKey: UNCERTAIN_SOURCE_KEY,
        expectedGeneration: null,
        document: uncertainDocument,
      }),
      "indeterminate",
      "response-loss save",
    );
    const resolvedUncertain = expectStatus(
      await portC.openSource(UNCERTAIN_SOURCE_KEY),
      "opened",
      "uncertain reopen",
    );
    if (
      resolvedUncertain.generation !== 1 ||
      markerOf(resolvedUncertain.document) !== "uncertain"
    ) {
      fail("INTEGRATION_FAILED", "Reopen did not resolve the uncertain committed Source.");
    }

    const malformedReadPort = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: async () => ({
        status: 200,
        headers: { "content-type": "application/json", etag: '"g:1"' },
        body: Uint8Array.of(0xff),
      }),
    });
    const malformedRead = expectStatus(
      await malformedReadPort.openSource("malformed-read"),
      "failed",
      "malformed read",
    );
    const malformedWritePort = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: API_TOKEN,
      fetch: async () => ({ status: 200, headers: {}, body: new Uint8Array() }),
    });
    const malformedWrite = expectStatus(
      await malformedWritePort.saveSource({
        sourceKey: "malformed-write",
        expectedGeneration: null,
        document: raceDocument,
      }),
      "indeterminate",
      "malformed write",
    );
    const uncertainStorageCodes = [
      "STORAGE_IO_FAILURE",
      "UNSAFE_STORAGE_PATH",
      "METADATA_CORRUPT",
      "UNRECOGNIZED_POST_DISPATCH_FAILURE",
    ];
    const uncertainStorageResults = [];
    for (const [index, code] of uncertainStorageCodes.entries()) {
      const uncertainStoragePort = createLocalDesenEditorPersistencePort({
        origin: ORIGIN,
        apiToken: API_TOKEN,
        fetch: async () => localErrorResponse(code),
      });
      const result = expectStatus(
        await uncertainStoragePort.saveSource({
          sourceKey: `adversarial-${String(index + 1)}`,
          expectedGeneration: null,
          document: raceDocument,
        }),
        "indeterminate",
        `${code} write`,
      );
      if (result.diagnostic.code !== "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE") {
        fail("INTEGRATION_FAILED", `${code} was not classified as an uncertain commit.`);
      }
      uncertainStorageResults.push(Object.freeze({ code, status: result.status }));
    }
    const wrongAuthPort = createLocalDesenEditorPersistencePort({
      origin: ORIGIN,
      apiToken: WRONG_API_TOKEN,
      fetch: createInjectedFetch(controlC, calls),
    });
    const authenticationFailure = expectStatus(
      await wrongAuthPort.openSource(SOURCE_KEY),
      "failed",
      "wrong-token open",
    );
    const invalidKey = expectStatus(await portC.openSource("../draft"), "failed", "invalid key");
    if (
      malformedRead.diagnostic.code !== "run.desen.editor/PERSISTENCE_SOURCE_INVALID" ||
      malformedWrite.diagnostic.code !== "run.desen.editor/PERSISTENCE_COMMIT_INDETERMINATE" ||
      authenticationFailure.diagnostic.code !==
        "run.desen.editor/PERSISTENCE_AUTHENTICATION_REQUIRED" ||
      invalidKey.diagnostic.code !== "run.desen.editor/PERSISTENCE_SOURCE_INVALID"
    ) {
      fail("INTEGRATION_FAILED", "An adversarial persistence diagnostic drifted.");
    }
    let implicitFetchRejected = false;
    try {
      createLocalDesenEditorPersistencePort({ origin: ORIGIN, apiToken: API_TOKEN });
    } catch (error) {
      implicitFetchRejected = error instanceof LocalDesenEditorPersistenceConfigurationError;
    }
    if (!implicitFetchRejected) {
      fail("INTEGRATION_FAILED", "The Web adapter accepted implicit global fetch authority.");
    }

    return deepFreeze({
      transport: {
        publicControlPlaneFactory: "openLocalControlPlane",
        webAdapterFactory: "createLocalDesenEditorPersistencePort",
        neutralPortFactory: "createDesenEditorPersistencePort",
        persistencePortMethods: ["openSource", "saveSource"],
        storage: "REAL_OS_TEMP_SQLITE",
        sqliteFileName: SQLITE_FILE_NAME,
        sqliteRegularSingleLink: true,
        fetchAuthority: "EXPLICIT_INJECT_SHIM",
        implicitGlobalFetch: false,
        requestCount: calls.length,
        getRequests: calls.filter(({ method }) => method === "GET").length,
        putRequests: calls.filter(({ method }) => method === "PUT").length,
        redirectMode: calls.every(({ redirect }) => redirect === "error"),
        correctBearerRequests: calls.filter(({ bearer }) => bearer).length,
      },
      lifecycle: {
        initial: "missing",
        createdGeneration: created.generation,
        openedGeneration: opened.generation,
        unchangedGeneration: unchanged.generation,
        updatedGeneration: updated.generation,
        raceStatuses,
        raceWinnerGeneration: updatedRace.generation,
        raceConflictGeneration: conflictedRace.currentGeneration,
        restartGeneration: reopened.generation,
        restartUnchangedGeneration: restartUnchanged.generation,
      },
      durability: {
        independentControlPlaneInstances: 2,
        closeReopen: true,
        nativeSqlite: true,
        compareAndSetSingleWinner: true,
        staleWriterDidNotOverwrite: true,
      },
      roundTrip: {
        sourceKey: SOURCE_KEY,
        sourceDocumentId: reopened.document.id,
        sourceKeyIndependentOfDocumentId: SOURCE_KEY !== reopened.document.id,
        canonicalSha256: sha256(reopenedBytes),
        canonicalBytes: reopenedBytes.byteLength,
        canonicalEqualAfterRestart: true,
        authoringPreserved: true,
        extensionLocations: reopenedExtensions.length,
        extensionProjectionSha256: sha256(canonicalizeJsonBytes(reopenedExtensions)),
        detached: reopened.document !== raceDocument,
        recursivelyFrozen: deeplyFrozen(reopened),
      },
      uncertainty: {
        lostPutResponseStatus: uncertain.status,
        reopenResolvedGeneration: resolvedUncertain.generation,
        reopenResolvedMarker: markerOf(resolvedUncertain.document),
        noAutomaticRetry: true,
      },
      adversarial: {
        malformedReadCode: malformedRead.diagnostic.code,
        malformedWriteStatus: malformedWrite.status,
        uncertainPostDispatchStorageResults: uncertainStorageResults,
        authenticationFailureCode: authenticationFailure.diagnostic.code,
        invalidSourceKeyCode: invalidKey.diagnostic.code,
        implicitFetchRejected,
        platformDetailsLeaked: false,
      },
    });
  } finally {
    await Promise.all(controls.splice(0).map((control) => control.close().catch(() => undefined)));
    await rm(rootDirectory, { recursive: true, force: true });
  }
}

function testNames(source) {
  return [...source.matchAll(/^\s*(?:it|test)\(\s*["']([^"']+)["']/gmu)].map((match) => match[1]);
}

function countTypeAssertions(source) {
  return [...source.matchAll(/@ts-expect-error/gmu)].length;
}

function verifyTestAuthority(files) {
  const rootNames = testNames(files.get("tests/editor-core-persistence.test.mjs").toString("utf8"));
  if (JSON.stringify(rootNames) !== JSON.stringify(EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES)) {
    fail("TEST_INVENTORY_DRIFT", "The independent persistence root inventory drifted.");
  }
  const tests = {
    editorCoreFocusedRuntimeCases: testNames(
      files.get("packages/editor-core/test/persistence.test.ts").toString("utf8"),
    ).length,
    editorCoreFocusedCompilerNegativeAssertions: countTypeAssertions(
      files.get("packages/editor-core/test/persistence.types.ts").toString("utf8"),
    ),
    editorCoreContinuousValidationRuntimeCases: testNames(
      files.get(CONTINUOUS_VALIDATION_TEST).toString("utf8"),
    ).length,
    editorCoreContinuousValidationCompilerNegativeAssertions: countTypeAssertions(
      files.get(CONTINUOUS_VALIDATION_TYPES).toString("utf8"),
    ),
    editorCoreTerminalIntegrationRuntimeCases: testNames(
      files.get(TERMINAL_INTEGRATION_TEST).toString("utf8"),
    ).length,
    editorCorePublicRuntimeCases: testNames(
      files.get("packages/editor-core/test/public-package.mjs").toString("utf8"),
    ).length,
    editorCorePublicCompilerNegativeAssertions: countTypeAssertions(
      files.get("packages/editor-core/test/public-package.types.mts").toString("utf8"),
    ),
    editorWebFocusedRuntimeCases: testNames(
      files.get("packages/editor-web/test/local-source-persistence.test.ts").toString("utf8"),
    ).length,
    editorWebPublicRuntimeCases: testNames(
      files.get("packages/editor-web/test/public-package.mjs").toString("utf8"),
    ).length,
    editorWebPublicCompilerNegativeAssertions: countTypeAssertions(
      files.get("packages/editor-web/test/public-package.types.mts").toString("utf8"),
    ),
    rootProofCases: rootNames.length,
    rootTestNames: rootNames,
  };
  if (
    tests.editorCoreFocusedRuntimeCases !== 10 ||
    tests.editorCoreFocusedCompilerNegativeAssertions !== 21 ||
    tests.editorCoreContinuousValidationRuntimeCases !== 12 ||
    tests.editorCoreContinuousValidationCompilerNegativeAssertions !== 9 ||
    tests.editorCoreTerminalIntegrationRuntimeCases !==
      EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES.length ||
    JSON.stringify(testNames(files.get(TERMINAL_INTEGRATION_TEST).toString("utf8"))) !==
      JSON.stringify(EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES) ||
    tests.editorCorePublicRuntimeCases !== 50 ||
    tests.editorCorePublicCompilerNegativeAssertions !== 102 ||
    tests.editorWebFocusedRuntimeCases !== 12 ||
    tests.editorWebPublicRuntimeCases !== 3 ||
    tests.editorWebPublicCompilerNegativeAssertions !== 6 ||
    tests.rootProofCases !== EDITOR_CORE_PERSISTENCE_ROOT_TEST_NAMES.length
  ) {
    fail("TEST_INVENTORY_DRIFT", "The reviewed M08-T08 package or root test inventory drifted.", {
      actual: tests,
    });
  }
  return deepFreeze(tests);
}

function verifyPackageScriptAuthority(files) {
  const packageManifest = parseJson(files.get("package.json"), "package.json");
  const editorCoreManifest = parseJson(
    files.get("packages/editor-core/package.json"),
    "packages/editor-core/package.json",
  );
  if (
    packageManifest === null ||
    typeof packageManifest !== "object" ||
    Array.isArray(packageManifest) ||
    packageManifest.scripts === null ||
    typeof packageManifest.scripts !== "object" ||
    Array.isArray(packageManifest.scripts)
  ) {
    fail("PACKAGE_SCRIPT_DRIFT", "The root package script authority is malformed.");
  }
  const retained = Object.entries(PACKAGE_SCRIPTS).map(([name, command]) => {
    if (packageManifest.scripts[name] !== command) {
      fail("PACKAGE_SCRIPT_DRIFT", `The exact root package script drifted: ${name}.`);
    }
    return Object.freeze({ name, command });
  });
  const compatibilityOnlySuccessor = Object.entries(CONTINUOUS_VALIDATION_PACKAGE_SCRIPTS).map(
    ([name, command]) => {
      if (packageManifest.scripts[name] !== command) {
        fail("PACKAGE_SCRIPT_DRIFT", `The M08-T09 compatibility script drifted: ${name}.`);
      }
      return Object.freeze({ name, command });
    },
  );
  const terminalProofSuccessor = Object.entries(TERMINAL_INTEGRATION_PACKAGE_SCRIPTS).map(
    ([name, command]) => {
      if (packageManifest.scripts[name] !== command) {
        fail("PACKAGE_SCRIPT_DRIFT", `The M08-T10 compatibility script drifted: ${name}.`);
      }
      return Object.freeze({ name, command });
    },
  );
  if (
    editorCoreManifest?.scripts?.["test:persistence"] !== "vitest run test/persistence.test.ts" ||
    editorCoreManifest?.scripts?.["test:continuous-validation"] !==
      "vitest run test/continuous-validation.test.ts" ||
    editorCoreManifest?.scripts?.["test:terminal-integration"] !==
      "vitest run test/terminal-integration.test.ts"
  ) {
    fail("PACKAGE_SCRIPT_DRIFT", "The editor-core T08-T10 focused script surface drifted.");
  }
  return deepFreeze({
    retained,
    compatibilityOnlySuccessor,
    terminalProofSuccessor,
    editorCore: {
      persistence: editorCoreManifest.scripts["test:persistence"],
      continuousValidation: editorCoreManifest.scripts["test:continuous-validation"],
      terminalIntegration: editorCoreManifest.scripts["test:terminal-integration"],
    },
  });
}

/** Builds deterministic M08-T08 evidence through the real local SQLite integration. */
export async function buildEditorCorePersistenceEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const frozen = await authenticateFrozenArtifact();
  const prerequisites = await authenticatePrerequisites(options);
  const paths = await currentTrackedPaths();
  const files = new Map();
  for (const relativePath of paths)
    files.set(relativePath, await trackedBytes(relativePath, options));
  if (options.fileOverrides.size !== 0) {
    fail("TRACKED_FILE_OVERRIDE_REJECTED", "Caller file overrides cannot issue M08-T08 PASS.");
  }
  const validSource = parseJson(files.get(FIXTURE_PATH), FIXTURE_PATH);
  const integration = await runIntegration(validSource);
  const tests = verifyTestAuthority(files);
  const packageScripts = verifyPackageScriptAuthority(files);
  const t07Artifact = parseJson(
    files.get(PREREQUISITE_PINS[1].path),
    "frozen M08-T07 prerequisite",
  );
  const editorCoreCompatibility = verifyEditorCoreCompatibility(files, t07Artifact);
  assertRetainedT08Receipts(frozen.artifact, files);
  const trackedFiles = paths.map((relativePath) => {
    const bytes = files.get(relativePath);
    return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  });
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-persistence",
    profile: "desen.editor-core.persistence-proof.v1",
    task: "M08-T08",
    result: "PASS",
    prerequisites,
    claim: {
      protocol: "0.1.0",
      platformNeutralPort: true,
      webAdapterUsesExplicitTransport: true,
      realLocalControlPlane: true,
      realNativeSqlite: true,
      createOpenUpdateUnchanged: true,
      closeReopenDurability: true,
      generationCompareAndSet: true,
      authoringAndExtensionsPreserved: true,
      sourceKeyIndependentOfSourceId: true,
      uncertainCommitRequiresReopen: true,
      taskStatus: "DONE",
    },
    integration,
    executionAuthority: {
      workspacePublicPackageImports: true,
      emittedDistributionReceipts: trackedFiles.filter(({ path: relativePath }) =>
        DISTRIBUTION_ROOTS.some((root) => relativePath.startsWith(`${root}/`)),
      ).length,
      trackedFiles: trackedFiles.length,
      osTemporaryRoot: true,
      temporaryRootRemoved: true,
      nativeAddon: "better-sqlite3@13.0.3",
      networkListenerOpened: false,
      injectedAndListenerRouteImplementationShared: true,
    },
    tests,
    packageScripts,
    publicApi: {
      currentPackageRuntimeExports: editorCoreCompatibility.currentPackageRuntimeExports,
      currentPackageTypeExports: editorCoreCompatibility.currentPackageTypeExports,
      compatibilityOnlySuccessor: editorCoreCompatibility.additiveSuccessor,
      terminalProofSuccessor: editorCoreCompatibility.terminalProofSuccessor,
    },
    packageBoundary: {
      currentEmittedFiles: editorCoreCompatibility.currentEmittedFiles,
      staticEsmEdges: editorCoreCompatibility.staticEsmEdges,
      persistencePortRemainsPlatformNeutral: true,
      editorWebOwnsTransportAdapter: true,
    },
    trackedFiles,
    nonclaims: [
      "Input JSON whitespace, object-member order, and original lexical bytes are not preserved; canonical parsed Source values are.",
      "The proof uses the shared Fastify injection boundary and does not claim reverse-proxy, TLS, remote-bind, or public deployment behavior.",
      "Node.js, its ESM loader, Fastify, installed external dependency bytes, the native SQLite addon, operating system, and process environment remain trusted authorities.",
      "The Web adapter owns no filesystem path, SQLite handle, implicit global fetch, automatic retry, merge, list, or delete authority.",
      "An indeterminate PUT is resolved only by reopening; it is never converted into a definite failure or automatic retry.",
      "M08-T09 continuous-validation bytes are compatibility-only successor authority and are not part of the frozen M08-T08 claim.",
      "M08-T10 terminal-integration bytes are compatibility-only successor authority and are not part of the frozen M08-T08 claim.",
      "React renderer, DOM behavior, selection, and viewport policy remain outside M08-T08.",
      "Undo/redo, selection policy, viewport policy, multi-user synchronization, and remote persistence remain outside M08-T08.",
    ],
    reproduction: [
      "pnpm generate:editor-core-persistence",
      "pnpm verify:editor-core-persistence",
      "pnpm test:editor-core-persistence",
    ],
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      proofDocument: {
        path: PROOF_DOCUMENT_PATH,
        bytes: FROZEN_PROOF_DOCUMENT_PIN.bytes,
        sha256: FROZEN_PROOF_DOCUMENT_PIN.sha256,
      },
      retainedTaskTimeReceipts: RETAINED_T08_RECEIPT_PATHS.length,
      formalPrerequisiteTasks: PREREQUISITE_PINS.map(({ task }) => task),
    },
  });
  return Object.freeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    task: "M08-T08",
  });
}

function captureVerifyOptions(raw) {
  if (raw === undefined) return Object.freeze({});
  const captured = exactOwnData(raw, VERIFY_OPTION_KEYS, "verifyOptions");
  if (captured.artifactBytes !== undefined && captured.artifactPath !== undefined) {
    fail("OPTIONS_INVALID", "verifyOptions must select artifact bytes or a path, not both.");
  }
  if (captured.proofDocument !== undefined && captured.proofDocumentPath !== undefined) {
    fail("OPTIONS_INVALID", "verifyOptions must select proof text or a path, not both.");
  }
  for (const key of ["artifactPath", "proofDocumentPath"]) {
    if (
      captured[key] !== undefined &&
      (typeof captured[key] !== "string" || captured[key] === "")
    ) {
      fail("OPTIONS_INVALID", `verifyOptions.${key} must be a non-empty string.`);
    }
  }
  return Object.freeze({
    ...captured,
    artifactBytes:
      captured.artifactBytes === undefined
        ? undefined
        : captureBytes(captured.artifactBytes, "artifactBytes"),
  });
}

function assertProofDocument(proofDocument, artifactSha256) {
  if (typeof proofDocument !== "string") {
    fail("PROOF_DOCUMENT_DRIFT", "The proof document must be UTF-8 text.");
  }
  const pin = `Final artifact: \`sha256:${artifactSha256}\``;
  const lines = proofDocument.split(/\r?\n/u);
  if (
    lines.filter((line) => line === pin).length !== 1 ||
    lines.filter((line) => line === "Task: `M08-T08`").length !== 1 ||
    lines.filter((line) => line === "Result: `PASS`").length !== 1 ||
    /sha256:PENDING/u.test(proofDocument)
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The proof document lost its one visible final M08-T08 pin.");
  }
}

/** Rebuilds real integration evidence and verifies the committed artifact and proof pin. */
export async function verifyEditorCorePersistenceEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCorePersistenceEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes ??
    (await readNoFollow(
      path.resolve(options.artifactPath ?? DEFAULT_EDITOR_CORE_PERSISTENCE_ARTIFACT_PATH),
      "M08-T08 proof artifact",
    ));
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T08 artifact differs from fresh real evidence.");
  }
  const artifact = parseJson(artifactBytes, "M08-T08 proof artifact");
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-persistence" ||
    artifact.profile !== "desen.editor-core.persistence-proof.v1" ||
    artifact.task !== "M08-T08" ||
    artifact.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The M08-T08 artifact identity or PASS profile drifted.");
  }
  let proofDocument = options.proofDocument;
  if (proofDocument === undefined) {
    const proofBytes = await readNoFollow(
      path.resolve(options.proofDocumentPath ?? path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH)),
      "M08-T08 proof document",
    );
    try {
      proofDocument = new TextDecoder("utf-8", { fatal: true }).decode(proofBytes);
    } catch {
      fail("PROOF_DOCUMENT_DRIFT", "The M08-T08 proof document is not valid UTF-8.");
    }
  }
  assertProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: "M08-T08",
    result: "PASS",
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.trackedFiles.length,
    distributionFiles: built.artifact.executionAuthority.emittedDistributionReceipts,
    rootProofCases: built.artifact.tests.rootProofCases,
    currentTrackedFiles: built.currentCompatibility.trackedFiles.length,
    currentEditorCoreRuntimeExports:
      built.currentCompatibility.publicApi.currentPackageRuntimeExports.length,
    currentEditorCoreTypeExports:
      built.currentCompatibility.publicApi.currentPackageTypeExports.length,
    currentEditorCoreEmittedFiles: built.currentCompatibility.packageBoundary.currentEmittedFiles,
  });
}

function captureWriteOptions(raw) {
  if (raw === undefined) return Object.freeze({});
  const captured = exactOwnData(raw, WRITE_OPTION_KEYS, "writeOptions");
  if (captured.destinationPath !== undefined && typeof captured.destinationPath !== "string") {
    fail("OPTIONS_INVALID", "writeOptions.destinationPath must be a string.");
  }
  if (captured.destinationPath === "") {
    fail("OPTIONS_INVALID", "writeOptions.destinationPath must not be empty.");
  }
  if (
    captured.beforeAtomicRename !== undefined &&
    (typeof captured.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(captured.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  return Object.freeze(captured);
}

async function assertSafeDestination(destinationPath) {
  const absolutePath = path.resolve(destinationPath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  if (canonicalParent !== path.dirname(absolutePath)) {
    fail("FILESYSTEM_UNSAFE", "Artifact destination parent must be canonical.");
  }
  try {
    const entry = await lstat(absolutePath);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", "Existing artifact destination must be one regular file.");
    }
  } catch (error) {
    if (error instanceof EditorCorePersistenceProofError) throw error;
    if (error?.code !== "ENOENT") fail("FILESYSTEM_UNSAFE", "Destination is unsafe.");
  }
  return absolutePath;
}

/** Atomically writes fresh deterministic M08-T08 persistence evidence. */
export async function writeEditorCorePersistenceEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCorePersistenceEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_PERSISTENCE_ARTIFACT_PATH,
  );
  try {
    await writeAtomicProofArtifact({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "ARTIFACT_WRITE_FAILED",
      "The M08-T08 artifact was not atomically committed.",
      String(error),
    );
  }
  const committed = await readNoFollow(destinationPath, "committed M08-T08 artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_WRITE_FAILED", "Committed M08-T08 bytes differ from fresh evidence.");
  }
  return deepFreeze({
    task: "M08-T08",
    result: "PASS",
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
