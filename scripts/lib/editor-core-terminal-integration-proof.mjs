import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-TERMINAL-INTEGRATION.md";
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 325_549,
  sha256: "5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b",
});
const SOURCE_FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const ROOT_PACKAGE_PATH = "package.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const PACKAGE_README_PATH = "packages/editor-core/README.md";
const PACKAGE_TEST_PATH = "packages/editor-core/test/terminal-integration.test.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-terminal-integration-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-terminal-integration-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-terminal-integration.mjs";
const ROOT_TEST_PATH = "tests/editor-core-terminal-integration.test.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";

const EDITOR_MODULE_NAMES = Object.freeze([
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
const EDITOR_SOURCE_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.map((name) => `packages/editor-core/src/${name}.ts`),
);
const EDITOR_RUNTIME_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.map((name) => `packages/editor-core/dist/${name}.js`),
);
const EDITOR_DECLARATION_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.map((name) => `packages/editor-core/dist/${name}.d.ts`),
);
const DIST_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.flatMap((name) => [
    `packages/editor-core/dist/${name}.d.ts`,
    `packages/editor-core/dist/${name}.d.ts.map`,
    `packages/editor-core/dist/${name}.js`,
    `packages/editor-core/dist/${name}.js.map`,
  ]),
);
const PROTOCOL_RUNTIME_PATHS = Object.freeze([
  "packages/protocol/dist/canonicalization.js",
  "packages/protocol/dist/diagnostics.js",
  "packages/protocol/dist/index.js",
  "packages/protocol/dist/json-pointer.js",
]);
const VALIDATOR_RUNTIME_PATHS = Object.freeze([
  "packages/validator/dist/binding-contract-validation.js",
  "packages/validator/dist/component-contract-validation.js",
  "packages/validator/dist/embedded-schema-validation.js",
  "packages/validator/dist/execution-contract-validation.js",
  "packages/validator/dist/generated/0.1.0/structural-validators.js",
  "packages/validator/dist/index.js",
  "packages/validator/dist/interaction-contract-validation.js",
  "packages/validator/dist/schema-instance-validation.js",
  "packages/validator/dist/semantic-diagnostics.js",
  "packages/validator/dist/semantic-validation.js",
  "packages/validator/dist/standalone-runtime.js",
  "packages/validator/dist/structural-diagnostics.js",
  "packages/validator/dist/structural-validation.js",
  "packages/validator/dist/uri-reference.js",
  "packages/validator/dist/validation-internals.js",
]);
const DEPENDENCY_RUNTIME_PATHS = Object.freeze([
  "packages/protocol/package.json",
  "packages/validator/package.json",
  ...PROTOCOL_RUNTIME_PATHS,
  ...VALIDATOR_RUNTIME_PATHS,
]);
const ISOLATED_RUNTIME_PATHS = Object.freeze([
  PACKAGE_PATH,
  ...EDITOR_RUNTIME_PATHS,
  ...DEPENDENCY_RUNTIME_PATHS,
]);
const EDITOR_SOURCE_DIRECTORY = "packages/editor-core/src";
const EDITOR_DIST_DIRECTORY = "packages/editor-core/dist";
const EXPECTED_EDITOR_SOURCE_INVENTORY = Object.freeze([...EDITOR_SOURCE_PATHS].sort(compareText));
const EXPECTED_EDITOR_DIST_INVENTORY = Object.freeze([...DIST_PATHS].sort(compareText));

const HISTORICAL_PACKAGE_TEST_PATHS = Object.freeze(
  [
    "source-document",
    "stable-id-insert",
    "structural-edits",
    "content-edits",
    "state-binding-edits",
    "event-action-edits",
    "authoring-round-trip",
    "persistence",
    "continuous-validation",
  ].flatMap((name) => [
    `packages/editor-core/test/${name}.test.ts`,
    `packages/editor-core/test/${name}.types.ts`,
  ]),
);
const TRACKED_PATHS = Object.freeze([
  SOURCE_FIXTURE_PATH,
  CATALOG_FIXTURE_PATH,
  ROOT_PACKAGE_PATH,
  "tsconfig.base.json",
  PACKAGE_PATH,
  PACKAGE_README_PATH,
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  ...EDITOR_SOURCE_PATHS,
  ...DIST_PATHS,
  ...HISTORICAL_PACKAGE_TEST_PATHS,
  PACKAGE_TEST_PATH,
  PUBLIC_TEST_PATH,
  PUBLIC_TYPES_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
  PROOF_LIBRARY_PATH,
  GENERATOR_PATH,
  VERIFIER_PATH,
  ROOT_TEST_PATH,
]);
const CURRENT_COMPATIBILITY_ONLY_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  PACKAGE_README_PATH,
  PROOF_LIBRARY_PATH,
  ROOT_TEST_PATH,
]);
const CURRENT_PACKAGE_README_COMPLETION_CLAUSE =
  "M08-T10 terminal integration and G08 are `DONE`; `N-012`, `N-014`, `N-018`, `S-002`, and `S-003` are `TESTED`, P-18 is `PROVEN`, and M08 is 10/10. M09 follows the completed editor-core closeout; global next-task ownership remains in project status documents.";
const CURRENT_PACKAGE_README_TERMINAL_CLAUSE =
  "M08-T10 is a proof-only closure over the existing API and adds no production helper or public export.";
const RETAINED_T10_RECEIPT_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !CURRENT_COMPATIBILITY_ONLY_PATHS.includes(relativePath)),
);

const MUTATION_COMMANDS = Object.freeze([
  "insertDesenEditorNode",
  "deleteDesenEditorNode",
  "moveDesenEditorNode",
  "reorderDesenEditorNode",
  "setDesenEditorOwnerProp",
  "deleteDesenEditorOwnerProp",
  "setDesenEditorOwnerStyleProperty",
  "deleteDesenEditorOwnerStyleProperty",
  "setDesenEditorNodeCondition",
  "clearDesenEditorNodeCondition",
  "insertDesenEditorVariant",
  "deleteDesenEditorVariant",
  "reorderDesenEditorVariant",
  "setDesenEditorVariantCondition",
  "setDesenEditorVariantProp",
  "deleteDesenEditorVariantProp",
  "setDesenEditorVariantStyleProperty",
  "deleteDesenEditorVariantStyleProperty",
  "insertDesenEditorStateDeclaration",
  "deleteDesenEditorStateDeclaration",
  "setDesenEditorStateSchema",
  "setDesenEditorStateInitial",
  "setDesenEditorNodeRepeatItems",
  "setDesenEditorNodeRepeatKey",
  "setDesenEditorResourceInput",
  "deleteDesenEditorResourceInput",
  "insertDesenEditorEventHandler",
  "deleteDesenEditorEventHandler",
  "insertDesenEditorAction",
  "replaceDesenEditorAction",
  "deleteDesenEditorAction",
  "reorderDesenEditorAction",
]);

const FORBIDDEN_PLATFORM_IDENTIFIERS = Object.freeze(
  new Set([
    "React",
    "ReactDOM",
    "Document",
    "Window",
    "Element",
    "Node",
    "NodeList",
    "window",
    "navigator",
    "HTMLElement",
    "HTMLDocument",
    "CSSStyleDeclaration",
    "CSSStyleSheet",
    "customElements",
    "MutationObserver",
    "XMLHttpRequest",
    "WebSocket",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "fetch",
    "process",
    "Buffer",
    "require",
    "__dirname",
    "__filename",
  ]),
);

export const EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M08-T01",
    path: "docs/proof/artifacts/editor-core-0.1.0-source-document.json",
    bytes: 23_270,
    sha256: "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
    proofId: "editor-core-source-document",
    profile: "desen.editor-core.source-document-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T02",
    path: "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json",
    bytes: 19_561,
    sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
    proofId: "editor-core-stable-id-insert",
    profile: "desen.editor-core.stable-id-insert-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T03",
    path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
    bytes: 22_402,
    sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
    proofId: "editor-core-structural-edits",
    profile: "desen.editor-core.structural-edits-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T04",
    path: "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
    bytes: 26_988,
    sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
    proofId: "editor-core-content-edits",
    profile: "desen.editor-core.content-edits-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T05",
    path: "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
    bytes: 30_014,
    sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
    proofId: "editor-core-state-binding-edits",
    profile: "desen.editor-core.state-binding-edits-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T06",
    path: "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
    bytes: 31_310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    proofId: "editor-core-event-action-edits",
    profile: "desen.editor-core.event-action-edits-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T07",
    path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    bytes: 62_304,
    sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
    proofId: "editor-core-authoring-round-trip",
    profile: "desen.editor-core.authoring-round-trip-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T08",
    path: "docs/proof/artifacts/editor-core-0.1.0-persistence.json",
    bytes: 49_785,
    sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
    proofId: "editor-core-persistence",
    profile: "desen.editor-core.persistence-proof.v1",
    authority: "EDITOR_PREDECESSOR",
  }),
  Object.freeze({
    task: "M08-T09",
    path: "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json",
    bytes: 40_099,
    sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
    proofId: "editor-core-continuous-validation",
    profile: "desen.editor-core.continuous-validation-proof.v1",
    authority: "EDITOR_PREDECESSOR_AND_RUNTIME_RECEIPTS",
  }),
  Object.freeze({
    task: "M01-T05",
    path: "docs/proof/baselines/tracked-foundation.json",
    bytes: 1_212,
    sha256: "5c430da7e221dc37c9bdd4ca1c423f1a84d0aabe22cfe4465e40b67fa7d1529c",
    authority: "P18_PLATFORM_PREREQUISITE",
  }),
  Object.freeze({
    task: "M04-T16",
    path: "docs/proof/artifacts/runtime-core-0.1.0-headless-sign-in.json",
    bytes: 274_096,
    sha256: "bdda1b2d0c4630a1a6708b2e6bb9a9ecdca0c2efca3615ca4cf69cee871170a4",
    authority: "P18_JSON_TRACE_PREREQUISITE",
  }),
  Object.freeze({
    task: "M04-T17",
    path: "docs/proof/artifacts/runtime-core-0.1.0-audit-hardening.json",
    bytes: 15_084,
    sha256: "cd37e7721f7b89a983a92c405a4c7491cdaf84354a0ae0ab60adbdac815bb5fa",
    profile: "desen-runtime-core-audit-hardening-v1",
    authority: "P18_PLATFORM_PREREQUISITE",
  }),
]);

export const EDITOR_CORE_TERMINAL_INTEGRATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates M08-T01 through T09 and the exact P-18 platform prerequisites",
  "[graphs] runs two independent receipted emitted graphs with identical detached outcomes",
  "[transcript] executes all 32 commands with an exact stable-identity ledger",
  "[atomicity] contains one controlled failure and resumes without changing the prior document",
  "[terminal] validates, persists, reopens, and distinguishes authoring fingerprints",
  "[platform] AST-audits source, JavaScript, and declarations for the React DOM Node CSS boundary",
  "[trace] round-trips callback-free JSON through RFC 8785 with an exact digest",
  "[mutation] rejects runtime, tracked boundary, and prerequisite substitution",
  "[verification] rejects artifact and visible proof-pin drift",
  "[writer] atomically writes exact deterministic evidence",
]);

export const DEFAULT_EDITOR_CORE_TERMINAL_INTEGRATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCoreTerminalIntegrationProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreTerminalIntegrationProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreTerminalIntegrationProofError(code, message, details);
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

function assertDeepFrozen(value, label) {
  const visited = new Set();
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (
      current === null ||
      typeof current !== "object" ||
      ArrayBuffer.isView(current) ||
      visited.has(current)
    ) {
      continue;
    }
    visited.add(current);
    if (!Object.isFrozen(current)) fail("BEHAVIOR_DRIFT", `${label} must be recursively frozen.`);
    stack.push(...Object.values(current));
  }
}

function bytesEqual(left, right) {
  return Buffer.from(left).equals(Buffer.from(right));
}

function exactArray(actual, expected, code, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} drifted.`, { actual, expected });
  }
}

function captureExactObject(raw, allowedKeys, label) {
  if (raw === undefined) return Object.freeze(Object.create(null));
  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one plain non-Proxy object.`);
  }
  const keys = Reflect.ownKeys(raw);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown option.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      descriptor.writable !== true ||
      descriptor.configurable !== true
    ) {
      fail("OPTIONS_INVALID", `${label}.${key} must be a normal own data property.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureByteInput(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    fail("OPTIONS_INVALID", `${label} must be bytes.`);
  }
  return Buffer.from(value);
}

function captureByteMap(raw, allowedPaths, label) {
  if (raw === undefined) return new Map();
  if (!(raw instanceof Map) || utilTypes.isProxy(raw)) {
    fail("OPTIONS_INVALID", `${label} must be a non-Proxy Map.`);
  }
  const captured = new Map();
  for (const [relativePath, bytes] of raw) {
    if (typeof relativePath !== "string" || !allowedPaths.includes(relativePath)) {
      fail("OPTIONS_INVALID", `${label} contains a path outside its authority boundary.`);
    }
    captured.set(relativePath, captureByteInput(bytes, `${label}[${relativePath}]`));
  }
  return captured;
}

const BUILD_OPTION_KEYS = Object.freeze([
  "fileOverrides",
  "inventoryExtraPaths",
  "prerequisiteBytes",
  "runtime",
]);

function captureInventoryExtraPaths(raw) {
  if (raw === undefined) return Object.freeze([]);
  if (
    !Array.isArray(raw) ||
    utilTypes.isProxy(raw) ||
    Object.getPrototypeOf(raw) !== Array.prototype
  ) {
    fail("OPTIONS_INVALID", "buildOptions.inventoryExtraPaths must be one plain non-Proxy array.");
  }
  const keys = Reflect.ownKeys(raw);
  const expectedKeys = [
    ...Array.from({ length: raw.length }, (_, index) => String(index)),
    "length",
  ];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    fail(
      "OPTIONS_INVALID",
      "buildOptions.inventoryExtraPaths must be one dense undecorated array.",
    );
  }
  const captured = [];
  for (let index = 0; index < raw.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      descriptor.writable !== true ||
      descriptor.configurable !== true ||
      typeof descriptor.value !== "string" ||
      !/^packages\/editor-core\/(?:src|dist)\/[^/]+$/u.test(descriptor.value)
    ) {
      fail(
        "OPTIONS_INVALID",
        `buildOptions.inventoryExtraPaths[${index}] must be one direct editor-core inventory path.`,
      );
    }
    captured.push(descriptor.value);
  }
  return Object.freeze(captured);
}

function captureBuildOptions(raw) {
  const source = captureExactObject(raw, BUILD_OPTION_KEYS, "buildOptions");
  return Object.freeze({
    fileOverrides: captureByteMap(source.fileOverrides, TRACKED_PATHS, "fileOverrides"),
    inventoryExtraPaths: captureInventoryExtraPaths(source.inventoryExtraPaths),
    prerequisiteBytes: captureByteMap(
      source.prerequisiteBytes,
      EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS.map(({ path: pinPath }) => pinPath),
      "prerequisiteBytes",
    ),
    runtime: source.runtime,
  });
}

async function enumerateRegularInventory(relativeDirectory, label) {
  const absoluteDirectory = path.join(WORKSPACE_ROOT, relativeDirectory);
  try {
    const [canonicalDirectory, directoryEntry] = await Promise.all([
      realpath(absoluteDirectory),
      lstat(absoluteDirectory),
    ]);
    if (
      canonicalDirectory !== absoluteDirectory ||
      !directoryEntry.isDirectory() ||
      directoryEntry.isSymbolicLink()
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} must be one canonical non-symlink directory.`);
    }
    const firstNames = (await readdir(absoluteDirectory)).sort(compareText);
    const inventory = [];
    for (const name of firstNames) {
      if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        fail("FILESYSTEM_UNSAFE", `${label} contains an unsafe directory entry.`);
      }
      const entry = await lstat(path.join(absoluteDirectory, name));
      if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
        fail("FILESYSTEM_UNSAFE", `${label}/${name} must be one unlinked regular file.`);
      }
      inventory.push(`${relativeDirectory}/${name}`);
    }
    const secondNames = (await readdir(absoluteDirectory)).sort(compareText);
    if (JSON.stringify(firstNames) !== JSON.stringify(secondNames)) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while its inventory was inspected.`);
    }
    return Object.freeze(inventory.sort(compareText));
  } catch (error) {
    if (error instanceof EditorCoreTerminalIntegrationProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be inventoried safely.`, String(error));
  }
}

async function verifyWorkspaceFileInventory(inventoryExtraPaths = Object.freeze([])) {
  const [sourceInventory, distInventory] = await Promise.all([
    enumerateRegularInventory(EDITOR_SOURCE_DIRECTORY, "editor-core source inventory"),
    enumerateRegularInventory(EDITOR_DIST_DIRECTORY, "editor-core distribution inventory"),
  ]);
  const simulatedSourceExtras = inventoryExtraPaths.filter((entry) =>
    entry.startsWith(`${EDITOR_SOURCE_DIRECTORY}/`),
  );
  const simulatedDistExtras = inventoryExtraPaths.filter((entry) =>
    entry.startsWith(`${EDITOR_DIST_DIRECTORY}/`),
  );
  const checkedSourceInventory = [...sourceInventory, ...simulatedSourceExtras].sort(compareText);
  const checkedDistInventory = [...distInventory, ...simulatedDistExtras].sort(compareText);
  exactArray(
    checkedSourceInventory,
    EXPECTED_EDITOR_SOURCE_INVENTORY,
    "INVENTORY_DRIFT",
    "Editor source file inventory",
  );
  exactArray(
    checkedDistInventory,
    EXPECTED_EDITOR_DIST_INVENTORY,
    "INVENTORY_DRIFT",
    "Editor distribution file inventory",
  );
  if (inventoryExtraPaths.length !== 0) {
    fail("INVENTORY_OVERRIDE_REJECTED", "Caller inventory substitutions cannot issue PASS.");
  }
  return deepFreeze({
    method: "NO_FOLLOW_EXACT_REGULAR_FILE_INVENTORY",
    sourceDirectory: EDITOR_SOURCE_DIRECTORY,
    sourceFiles: sourceInventory.length,
    sourcePaths: sourceInventory,
    distDirectory: EDITOR_DIST_DIRECTORY,
    distFiles: distInventory.length,
    distPaths: distInventory,
  });
}

async function readNoFollow(relativeOrAbsolutePath, label, maxBytes = MAX_AUTHORITY_BYTES) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.join(WORKSPACE_ROOT, relativeOrAbsolutePath);
  let handle;
  try {
    const [canonicalParent, parent] = await Promise.all([
      realpath(path.dirname(absolutePath)),
      lstat(path.dirname(absolutePath)),
    ]);
    if (canonicalParent !== path.dirname(absolutePath) || !parent.isDirectory()) {
      fail("FILESYSTEM_UNSAFE", `${label} parent must be one canonical directory.`);
    }
    const before = await lstat(absolutePath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", `${label} must be one unlinked regular file.`);
    }
    if (before.size > maxBytes) fail("AUTHORITY_LIMIT", `${label} exceeds the read bound.`);
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mode !== before.mode
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while opening.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const namedAfter = await lstat(absolutePath);
    if (
      bytes.byteLength !== opened.size ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      namedAfter.dev !== opened.dev ||
      namedAfter.ino !== opened.ino ||
      namedAfter.size !== opened.size ||
      namedAfter.nlink !== 1 ||
      namedAfter.isSymbolicLink()
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while reading.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreTerminalIntegrationProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be read safely.`, String(error));
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof EditorCoreTerminalIntegrationProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`, String(error));
  }
}

async function trackedBytes(relativePath, options) {
  const live = await readNoFollow(relativePath, relativePath);
  const override = options.fileOverrides.get(relativePath);
  if (override === undefined) return live;
  if (relativePath === PACKAGE_README_PATH) return override;
  if (!override.equals(live)) fail("BOUNDARY_DRIFT", `${relativePath} mutation was rejected.`);
  return override;
}

function receipt(relativePath, bytes) {
  return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
}

function testNames(source) {
  return [...source.matchAll(/^\s*(?:it|test)\(\s*["']([^"']+)["']/gm)].map((match) => match[1]);
}

function countTypeAssertions(source) {
  return [...source.matchAll(/@ts-expect-error/g)].length;
}

async function authenticatePrerequisites(options) {
  const artifacts = Object.create(null);
  const evidence = [];
  for (const pin of EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS) {
    const bytes =
      options.prerequisiteBytes.get(pin.path) ??
      (await readNoFollow(pin.path, `frozen ${pin.task} prerequisite`, MAX_AUTHORITY_BYTES));
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The exact frozen ${pin.task} artifact receipt did not match.`);
    }
    const artifact = parseJson(bytes, `frozen ${pin.task} prerequisite`);
    if (
      pin.task.startsWith("M08-") &&
      (artifact.schemaVersion !== 1 ||
        artifact.task !== pin.task ||
        artifact.result !== "PASS" ||
        artifact.proofId !== pin.proofId ||
        artifact.profile !== pin.profile ||
        artifact.claim?.taskStatus !== "DONE")
    ) {
      fail("PREREQUISITE_DRIFT", `${pin.task} lost its reviewed editor PASS profile.`);
    }
    if (
      pin.task === "M01-T05" &&
      (artifact.verification?.quality?.result !== "PASS" ||
        artifact.verification?.boundaryFixtures?.allowedCasesPassed !== 1 ||
        artifact.verification?.boundaryFixtures?.forbiddenCasesRejected !== 5)
    ) {
      fail("PREREQUISITE_DRIFT", "M01-T05 lost its reviewed platform-boundary baseline.");
    }
    if (
      pin.task === "M04-T16" &&
      (artifact.schemaVersion !== 1 ||
        artifact.task !== "M04-T16" ||
        artifact.gate !== "G04" ||
        artifact.result !== "PASS" ||
        artifact.claim?.target !== "platform-neutral")
    ) {
      fail("PREREQUISITE_DRIFT", "M04-T16 lost its reviewed JSON-trace PASS profile.");
    }
    if (
      pin.task === "M04-T17" &&
      (artifact.schemaVersion !== 1 ||
        artifact.task !== "M04-T17" ||
        artifact.gate !== "G04" ||
        artifact.result !== "PASS" ||
        artifact.profile !== pin.profile ||
        artifact.claim?.taskStatus !== "DONE" ||
        artifact.claim?.gateStatus !== "DONE")
    ) {
      fail("PREREQUISITE_DRIFT", "M04-T17 lost its reviewed platform audit PASS profile.");
    }
    artifacts[pin.task] = deepFreeze(artifact);
    evidence.push(
      Object.freeze({
        task: pin.task,
        path: pin.path,
        bytes: pin.bytes,
        sha256: pin.sha256,
        authority: pin.authority,
        result: "PASS",
        authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      }),
    );
  }
  if (options.prerequisiteBytes.size !== 0) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "Caller prerequisite bytes cannot issue PASS.");
  }
  return Object.freeze({ artifacts: deepFreeze(artifacts), evidence: deepFreeze(evidence) });
}

function parseSourceFile(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_DRIFT", `${fileName} contains parse diagnostics.`);
  }
  return sourceFile;
}

function auditAstFile(sourceText, fileName, layer) {
  const sourceFile = parseSourceFile(sourceText, fileName);
  const staticSpecifiers = [];
  let dynamicImports = 0;
  let evalCalls = 0;
  let functionConstructors = 0;
  const forbiddenIdentifiers = new Set();

  function addSpecifier(node) {
    if (node !== undefined && ts.isStringLiteralLike(node)) staticSpecifiers.push(node.text);
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addSpecifier(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addSpecifier(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (ts.isLiteralTypeNode(argument)) addSpecifier(argument.literal);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImports += 1;
      if (ts.isIdentifier(node.expression) && node.expression.text === "eval") evalCalls += 1;
      if (ts.isIdentifier(node.expression) && node.expression.text === "Function") {
        functionConstructors += 1;
      }
    } else if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      functionConstructors += 1;
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "globalThis" &&
      [
        "document",
        "window",
        "navigator",
        "fetch",
        "eval",
        "Function",
        "React",
        "ReactDOM",
        "localStorage",
        "sessionStorage",
        "indexedDB",
      ].includes(node.name.text)
    ) {
      forbiddenIdentifiers.add(`globalThis.${node.name.text}`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "globalThis" &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      [
        "document",
        "window",
        "navigator",
        "fetch",
        "eval",
        "Function",
        "React",
        "ReactDOM",
        "localStorage",
        "sessionStorage",
        "indexedDB",
      ].includes(node.argumentExpression.text)
    ) {
      forbiddenIdentifiers.add(`globalThis.${node.argumentExpression.text}`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "document" &&
      [
        "body",
        "head",
        "createElement",
        "createTextNode",
        "querySelector",
        "querySelectorAll",
        "getElementById",
        "addEventListener",
      ].includes(node.name.text)
    ) {
      forbiddenIdentifiers.add(`document.${node.name.text}`);
    }
    if (ts.isIdentifier(node) && FORBIDDEN_PLATFORM_IDENTIFIERS.has(node.text)) {
      forbiddenIdentifiers.add(node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const forbiddenSpecifiers = staticSpecifiers.filter(
    (specifier) =>
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "react-dom" ||
      specifier.startsWith("react-dom/") ||
      specifier.startsWith("node:") ||
      /\.(?:css|less|sass|scss)(?:\?|$)/iu.test(specifier),
  );
  const unknownStaticSpecifiers = staticSpecifiers.filter(
    (specifier) =>
      specifier !== "@desen/protocol" &&
      specifier !== "@desen/validator" &&
      !specifier.startsWith("./"),
  );
  if (
    forbiddenSpecifiers.length !== 0 ||
    unknownStaticSpecifiers.length !== 0 ||
    dynamicImports !== 0 ||
    evalCalls !== 0 ||
    functionConstructors !== 0 ||
    forbiddenIdentifiers.size !== 0
  ) {
    fail("PLATFORM_DRIFT", `${fileName} crossed the platform-neutral AST boundary.`, {
      forbiddenSpecifiers,
      unknownStaticSpecifiers,
      dynamicImports,
      evalCalls,
      functionConstructors,
      forbiddenIdentifiers: [...forbiddenIdentifiers].sort(compareText),
    });
  }
  return Object.freeze({
    file: fileName,
    layer,
    staticSpecifiers: Object.freeze(staticSpecifiers),
    staticEdges: staticSpecifiers.length,
    forbiddenSpecifiers: 0,
    unknownStaticSpecifiers: 0,
    dynamicImports,
    evalCalls,
    functionConstructors,
    forbiddenIdentifiers: 0,
  });
}

function resolveAuditedRelativeTarget(fileName, layer, specifier) {
  if (!specifier.startsWith("./") || !specifier.endsWith(".js")) {
    fail("PLATFORM_DRIFT", `${fileName} contains an unclosed relative edge: ${specifier}`);
  }
  const emittedTarget = path.posix.normalize(
    path.posix.join(path.posix.dirname(fileName), specifier),
  );
  if (layer === "SOURCE") return `${emittedTarget.slice(0, -3)}.ts`;
  if (layer === "EMITTED_DTS") return `${emittedTarget.slice(0, -3)}.d.ts`;
  return emittedTarget;
}

function verifyRelativeEdgeClosure(audits) {
  const expectedPathsByLayer = Object.freeze({
    SOURCE: new Set(EDITOR_SOURCE_PATHS),
    EMITTED_JS: new Set(EDITOR_RUNTIME_PATHS),
    EMITTED_DTS: new Set(EDITOR_DECLARATION_PATHS),
  });
  const receipts = [];
  for (const audit of audits) {
    const expectedPaths = expectedPathsByLayer[audit.layer];
    if (!(expectedPaths instanceof Set)) {
      fail("PLATFORM_DRIFT", `Unknown AST audit layer: ${audit.layer}`);
    }
    for (const specifier of audit.staticSpecifiers) {
      if (!specifier.startsWith(".")) continue;
      const target = resolveAuditedRelativeTarget(audit.file, audit.layer, specifier);
      if (!expectedPaths.has(target)) {
        fail(
          "PLATFORM_DRIFT",
          `${audit.file} resolves outside the exact audited ${audit.layer} closure: ${specifier}`,
          { target },
        );
      }
      receipts.push(Object.freeze({ from: audit.file, specifier, target, layer: audit.layer }));
    }
  }
  return deepFreeze({
    closed: true,
    relativeEdges: receipts.length,
    receipts,
  });
}

function reexportedNames(sourceText, fileName) {
  const sourceFile = parseSourceFile(sourceText, fileName);
  const runtime = [];
  const types = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue;
    if (!ts.isNamedExports(statement.exportClause)) {
      fail("PUBLIC_API_DRIFT", `${fileName} contains a wildcard or unreviewed export.`);
    }
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail("PUBLIC_API_DRIFT", `${fileName} aliases an export.`);
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    runtime: Object.freeze(runtime.sort(compareText)),
    types: Object.freeze(types.sort(compareText)),
  });
}

function exactReadmeSection(source, heading) {
  const headingPattern = new RegExp(`^## ${heading}\\r?$`, "gmu");
  const matches = [...source.matchAll(headingPattern)];
  if (matches.length !== 1) {
    fail("README_DRIFT", `The current package README must contain exactly one ${heading} section.`);
  }
  const remainder = source.slice(matches[0].index + matches[0][0].length);
  const nextHeadingIndex = remainder.search(/^## /mu);
  if (nextHeadingIndex < 0) {
    fail("README_DRIFT", `The current package README ${heading} section is not bounded.`);
  }
  const section = remainder.slice(0, nextHeadingIndex);
  if (/<!--|-->/u.test(section)) {
    fail("README_DRIFT", `The current package README ${heading} section hides authority.`);
  }
  return section.replace(/\s+/gu, " ").trim();
}

function exactTextCount(source, expected) {
  return source.split(expected).length - 1;
}

function verifyCurrentPackageReadme(files) {
  const source = decodeUtf8(files.get(PACKAGE_README_PATH), PACKAGE_README_PATH);
  const terminalSection = exactReadmeSection(source, "Terminal integration proof");
  const statusSection = exactReadmeSection(source, "Status");
  if (
    exactTextCount(terminalSection, CURRENT_PACKAGE_README_TERMINAL_CLAUSE) !== 1 ||
    exactTextCount(statusSection, CURRENT_PACKAGE_README_COMPLETION_CLAUSE) !== 1
  ) {
    fail("README_DRIFT", "The current package README completion semantics drifted.");
  }
  for (const staleClaim of [
    /Terminal integration remains assigned to M08-T10/u,
    /M08-T10 (?:is|remains) next/u,
    /S-002[^.]{0,160}`PLANNED`/u,
    /P-18[^.]{0,120}`PARTIAL`/u,
    /M08 is 9\/10/u,
    /G08[^.]{0,120}(?:not yet|`(?:PLANNED|PARTIAL|IN_PROGRESS|NOT_STARTED)`)/u,
  ]) {
    if (staleClaim.test(statusSection)) {
      fail("README_DRIFT", "The current package README retained a predecessor status claim.");
    }
  }
}

function verifyBoundary(files, t09Artifact, fileInventory) {
  if (
    files.get(PACKAGE_PATH).byteLength !== 1_665 ||
    sha256(files.get(PACKAGE_PATH)) !==
      "24fc3b4d821093cd47e29ce6e65df2eff91e748a9468a2ccc678a4efa4ae0f4f" ||
    files.get(PACKAGE_TEST_PATH).byteLength !== 27_158 ||
    sha256(files.get(PACKAGE_TEST_PATH)) !==
      "3d77bef07197e0a914b92e7f7b3a7cc65448c56f0ad03d303edfb6139170997b"
  ) {
    fail("TERMINAL_CONTRACT_DRIFT", "The finalized T10 package test contract drifted.");
  }
  const packageManifest = parseJson(files.get(PACKAGE_PATH), PACKAGE_PATH);
  if (
    packageManifest.name !== "@desen/editor-core" ||
    packageManifest.private !== true ||
    packageManifest.type !== "module" ||
    packageManifest.sideEffects !== false ||
    JSON.stringify(packageManifest.files) !== JSON.stringify(["dist"]) ||
    JSON.stringify(packageManifest.exports) !==
      JSON.stringify({ ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } }) ||
    JSON.stringify(packageManifest.dependencies) !==
      JSON.stringify({ "@desen/protocol": "workspace:*", "@desen/validator": "workspace:*" }) ||
    packageManifest.scripts?.["test:terminal-integration"] !==
      "vitest run test/terminal-integration.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core terminal manifest boundary drifted.");
  }
  verifyCurrentPackageReadme(files);

  const rootManifest = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const expectedRootScripts = {
    "generate:editor-core-terminal-integration":
      "pnpm verify:editor-core-continuous-validation && pnpm verify:editor-core-persistence && pnpm --filter @desen/editor-core... build && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-core test:terminal-integration && pnpm --filter @desen/editor-core test:public-package && node scripts/generate-editor-core-terminal-integration-proof.mjs",
    "verify:editor-core-terminal-integration":
      "pnpm verify:editor-core-continuous-validation && pnpm verify:editor-core-persistence && pnpm --filter @desen/editor-core... build && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-core test:terminal-integration && pnpm --filter @desen/editor-core test:public-package && node scripts/verify-editor-core-terminal-integration.mjs",
    "test:editor-core-terminal-integration":
      "pnpm verify:editor-core-continuous-validation && pnpm verify:editor-core-persistence && pnpm --filter @desen/editor-core... build && pnpm --filter @desen/editor-core typecheck && pnpm --filter @desen/editor-core test:terminal-integration && pnpm --filter @desen/editor-core test:public-package && node --test tests/editor-core-terminal-integration.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootScripts)) {
    if (rootManifest.scripts?.[name] !== command) {
      fail("MANIFEST_DRIFT", `Root script ${name} drifted.`);
    }
  }
  const aggregateTestSteps = rootManifest.scripts?.test?.split(" && ") ?? [];
  const aggregateCheckSteps = rootManifest.scripts?.check?.split(" && ") ?? [];
  const terminalTestStep = "pnpm test:editor-core-terminal-integration";
  const terminalVerifyStep = "pnpm verify:editor-core-terminal-integration";
  if (
    aggregateTestSteps.filter((step) => step === terminalTestStep).length !== 1 ||
    aggregateCheckSteps.filter((step) => step === terminalVerifyStep).length !== 1 ||
    aggregateTestSteps.indexOf(terminalTestStep) !==
      aggregateTestSteps.indexOf("pnpm test:editor-core-continuous-validation") + 1 ||
    aggregateCheckSteps.indexOf(terminalVerifyStep) !==
      aggregateCheckSteps.indexOf("pnpm verify:editor-core-continuous-validation") + 1
  ) {
    fail(
      "MANIFEST_DRIFT",
      "Aggregate root test/check must run terminal integration exactly once after T09.",
    );
  }

  const expectedRuntime = [...t09Artifact.publicApi.runtimeExports].sort(compareText);
  const expectedTypes = [...t09Artifact.publicApi.typeExports].sort(compareText);
  if (expectedRuntime.length !== 35 || expectedTypes.length !== 88) {
    fail("PUBLIC_API_DRIFT", "The frozen T09 public export authority drifted.");
  }
  const sourceIndex = reexportedNames(
    decodeUtf8(files.get("packages/editor-core/src/index.ts"), "packages/editor-core/src/index.ts"),
    "packages/editor-core/src/index.ts",
  );
  const emittedIndex = reexportedNames(
    decodeUtf8(
      files.get("packages/editor-core/dist/index.js"),
      "packages/editor-core/dist/index.js",
    ),
    "packages/editor-core/dist/index.js",
  );
  const declarationIndex = reexportedNames(
    decodeUtf8(
      files.get("packages/editor-core/dist/index.d.ts"),
      "packages/editor-core/dist/index.d.ts",
    ),
    "packages/editor-core/dist/index.d.ts",
  );
  exactArray(sourceIndex.runtime, expectedRuntime, "PUBLIC_API_DRIFT", "Source runtime exports");
  exactArray(sourceIndex.types, expectedTypes, "PUBLIC_API_DRIFT", "Source type exports");
  exactArray(emittedIndex.runtime, expectedRuntime, "PUBLIC_API_DRIFT", "Emitted runtime exports");
  exactArray(
    declarationIndex.runtime,
    expectedRuntime,
    "PUBLIC_API_DRIFT",
    "Declaration runtime exports",
  );
  exactArray(declarationIndex.types, expectedTypes, "PUBLIC_API_DRIFT", "Declaration type exports");

  const audits = [];
  for (const relativePath of EDITOR_SOURCE_PATHS) {
    audits.push(
      auditAstFile(decodeUtf8(files.get(relativePath), relativePath), relativePath, "SOURCE"),
    );
  }
  for (const relativePath of EDITOR_RUNTIME_PATHS) {
    audits.push(
      auditAstFile(decodeUtf8(files.get(relativePath), relativePath), relativePath, "EMITTED_JS"),
    );
  }
  for (const relativePath of EDITOR_DECLARATION_PATHS) {
    audits.push(
      auditAstFile(decodeUtf8(files.get(relativePath), relativePath), relativePath, "EMITTED_DTS"),
    );
  }
  const relativeEdgeClosure = verifyRelativeEdgeClosure(audits);
  const byLayer = Object.fromEntries(
    ["SOURCE", "EMITTED_JS", "EMITTED_DTS"].map((layer) => {
      const selected = audits.filter((audit) => audit.layer === layer);
      return [
        layer,
        Object.freeze({
          files: selected.length,
          staticEdges: selected.reduce((sum, audit) => sum + audit.staticEdges, 0),
          forbiddenImports: 0,
          unknownImports: 0,
          dynamicImports: 0,
          evalCalls: 0,
          functionConstructors: 0,
          forbiddenPlatformIdentifiers: 0,
        }),
      ];
    }),
  );
  if (byLayer.EMITTED_JS.staticEdges !== 24) {
    fail("EMITTED_DRIFT", "The emitted JavaScript graph must retain exactly 24 static edges.");
  }

  const focusedTests = testNames(decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH));
  if (focusedTests.length !== 4) {
    fail("TEST_INVENTORY_DRIFT", "Terminal integration must retain exactly four focused cases.");
  }
  for (const fragment of ["32", "replay", "persist", "authoring"]) {
    if (!focusedTests.some((name) => name.toLowerCase().includes(fragment))) {
      fail("TEST_INVENTORY_DRIFT", `Focused terminal tests lost the ${fragment} boundary.`);
    }
  }
  const publicTests = testNames(decodeUtf8(files.get(PUBLIC_TEST_PATH), PUBLIC_TEST_PATH));
  const publicTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PUBLIC_TYPES_PATH), PUBLIC_TYPES_PATH),
  );
  if (publicTests.length !== 50 || publicTypeAssertions !== 102) {
    fail("TEST_INVENTORY_DRIFT", "The terminal proof must preserve the T09 public test authority.");
  }
  const rootTests = testNames(decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH));
  exactArray(
    rootTests,
    EDITOR_CORE_TERMINAL_INTEGRATION_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );

  return deepFreeze({
    runtimeExports: expectedRuntime,
    typeExports: expectedTypes,
    taskRuntimeExportsAdded: 0,
    taskTypeExportsAdded: 0,
    emittedFiles: fileInventory.distFiles,
    fileInventory,
    astAudit: {
      method: "TYPESCRIPT_AST",
      byLayer,
      files: audits.length,
      relativeEdgeClosure,
      receipts: audits,
    },
    focusedBehaviorCases: focusedTests.length,
    publicRuntimeAndRootCases: publicTests.length,
    publicCompilerNegativeAssertions: publicTypeAssertions,
    rootProofCases: rootTests.length,
    aggregateRootTestWired: true,
    aggregateRootCheckWired: true,
  });
}

function prerequisiteReceipt(t09Artifact, relativePath, collection) {
  const candidates = t09Artifact.executionAuthority?.[collection];
  const matches = Array.isArray(candidates)
    ? candidates.filter((candidate) => candidate?.path === relativePath)
    : [];
  if (matches.length !== 1) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Missing frozen M08-T09 receipt: ${relativePath}`);
  }
  return matches[0];
}

function authenticateRuntimeClosure(t09Artifact, files) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(t09Artifact, relativePath, "dependencyReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Dependency runtime drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  const editorReceipts = EDITOR_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(t09Artifact, relativePath, "editorReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Editor runtime drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  return deepFreeze({
    mode: "TWO_INDEPENDENT_AUTHENTICATED_BYTE_COPY_ESM_GRAPHS",
    graphCount: 2,
    sameWorkspaceModuleCacheUsed: false,
    importAfterReceipt: true,
    exactReceiptedBytes: true,
    editorRuntimeFilesPerGraph: editorReceipts.length,
    dependencyFilesPerGraph: dependencyReceipts.length,
    runtimeFilesPerGraph: ISOLATED_RUNTIME_PATHS.length,
    editorReceipts,
    dependencyReceipts,
    currentManifestReceipt: receipt(PACKAGE_PATH, files.get(PACKAGE_PATH)),
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
}

function isolatedDestination(directory, relativePath) {
  const match = relativePath.match(/^packages\/(editor-core|protocol|validator)\/(.+)$/u);
  if (match === null) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Path outside isolated package graph: ${relativePath}`);
  }
  return path.join(directory, "node_modules", "@desen", match[1], match[2]);
}

async function importReceiptedRuntime(files, expectedRuntimeExports) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t10-runtime-"));
  try {
    const copies = ISOLATED_RUNTIME_PATHS.map((relativePath) => ({
      bytes: files.get(relativePath),
      destination: isolatedDestination(directory, relativePath),
    }));
    const entryPath = path.join(directory, "entry.mjs");
    copies.push({
      bytes: Buffer.from(
        'import * as editorCore from "@desen/editor-core";\nimport * as protocol from "@desen/protocol";\nexport { editorCore, protocol };\n',
      ),
      destination: entryPath,
    });
    await Promise.all(
      copies.map(async ({ bytes, destination }) => {
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }),
    );
    const imported = await import(pathToFileURL(entryPath).href);
    exactArray(
      Object.keys(imported.editorCore).sort(compareText),
      expectedRuntimeExports,
      "PUBLIC_API_DRIFT",
      "Isolated runtime exports",
    );
    for (const name of ["calculateDesenSourceDigest", "canonicalizeJsonBytes"]) {
      if (typeof imported.protocol?.[name] !== "function") {
        fail("RUNTIME_AUTHORITY_DRIFT", `Isolated protocol runtime lost ${name}.`);
      }
    }
    return Object.freeze({ editorCore: imported.editorCore, protocol: imported.protocol });
  } catch (error) {
    if (error instanceof EditorCoreTerminalIntegrationProofError) throw error;
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      "The receipted emitted graph could not be imported.",
      String(error),
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function terminalInput(validSource) {
  const input = clone(validSource);
  input.authoring = {
    session: "terminal-integration",
    selection: { surfaceId: "sign-in", nodeId: "sign-in.title" },
  };
  const surface = input.surfaces["sign-in"];
  const root = surface.root;
  surface.state.terminalDelete = { schema: { type: "boolean" }, initial: false };
  surface.resources.terminalTasks = {
    use: "com.example.tasks/list",
    input: {},
    policy: "manual",
  };
  root.behaviors = [
    {
      id: "sign-in.terminal-sortable",
      use: "com.example.interactions/Sortable",
      props: { axis: "vertical", handle: "item" },
      slots: { dragPreview: [] },
    },
  ];
  root.variants = [
    { when: { op: "truthy", args: [true] }, props: { align: "start" } },
    {
      when: { op: "truthy", args: [false] },
      style: { base: { root: { padding: "sm" } } },
    },
  ];
  root.slots.default.push(
    {
      id: "sign-in.terminal-delete",
      use: "com.example.ui/Text",
      props: { text: "Delete me", role: "caption" },
    },
    {
      id: "sign-in.terminal-move",
      use: "com.example.ui/Text",
      props: { text: "Move me", role: "caption" },
    },
    {
      id: "sign-in.terminal-reorder",
      use: "com.example.ui/Text",
      props: { text: "Reorder me", role: "caption" },
    },
    {
      id: "sign-in.terminal-repeat",
      use: "com.example.ui/Text",
      props: { text: "Repeated task", role: "caption" },
      repeat: {
        items: { $ref: "resource.terminalTasks.value" },
        as: "task",
        key: { $ref: "item.task.id" },
        limit: 10,
      },
    },
  );
  const submit = root.slots.default.find((node) => node.id === "sign-in.submit");
  submit.on.press.push({ type: "state.set", path: "email", value: "terminal@desen.dev" });
  return input;
}

function expectDocument(runtime, input, label) {
  const result = runtime.createDesenEditorDocument(input);
  if (result?.ok !== true || result.document === undefined || result.diagnostics?.length !== 0) {
    fail("BEHAVIOR_DRIFT", `${label} failed direct Source admission.`, result?.diagnostics);
  }
  assertDeepFrozen(result, `${label} result`);
  return result.document;
}

function expectSuccess(result, label) {
  if (result?.ok !== true || result.document === undefined || result.diagnostics?.length !== 0) {
    fail("BEHAVIOR_DRIFT", `${label} did not return one complete success.`, result?.diagnostics);
  }
  assertDeepFrozen(result, `${label} result`);
  return result;
}

function pointerToken(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function identityLedger(document, canonicalizeJsonBytes) {
  const occurrences = [];
  const walkBehavior = (behavior, pointer) => {
    occurrences.push({ kind: "behavior", id: behavior.id, pointer });
    for (const [slot, children] of Object.entries(behavior.slots ?? {})) {
      children.forEach((child, index) =>
        walkNode(child, `${pointer}/slots/${pointerToken(slot)}/${index}`),
      );
    }
  };
  const walkNode = (node, pointer) => {
    occurrences.push({ kind: "node", id: node.id, pointer });
    (node.behaviors ?? []).forEach((behavior, index) =>
      walkBehavior(behavior, `${pointer}/behaviors/${index}`),
    );
    for (const [slot, children] of Object.entries(node.slots ?? {})) {
      children.forEach((child, index) =>
        walkNode(child, `${pointer}/slots/${pointerToken(slot)}/${index}`),
      );
    }
  };
  for (const [surfaceId, surface] of Object.entries(document.surfaces)) {
    walkNode(surface.root, `/surfaces/${pointerToken(surfaceId)}/root`);
  }
  occurrences.sort((left, right) =>
    compareText(
      `${left.kind}\0${left.id}\0${left.pointer}`,
      `${right.kind}\0${right.id}\0${right.pointer}`,
    ),
  );
  const identities = occurrences.map(({ kind, id }) => `${kind}:${id}`).sort(compareText);
  const canonical = canonicalizeJsonBytes(occurrences);
  return deepFreeze({
    count: occurrences.length,
    identities,
    occurrences,
    canonicalSha256: sha256(canonical),
  });
}

function identityDelta(before, after) {
  const beforeCounts = new Map();
  const afterCounts = new Map();
  for (const identity of before.identities)
    beforeCounts.set(identity, (beforeCounts.get(identity) ?? 0) + 1);
  for (const identity of after.identities)
    afterCounts.set(identity, (afterCounts.get(identity) ?? 0) + 1);
  const added = [];
  const removed = [];
  for (const identity of [...new Set([...beforeCounts.keys(), ...afterCounts.keys()])].sort(
    compareText,
  )) {
    const difference = (afterCounts.get(identity) ?? 0) - (beforeCounts.get(identity) ?? 0);
    for (let index = 0; index < difference; index += 1) added.push(identity);
    for (let index = 0; index < -difference; index += 1) removed.push(identity);
  }
  return Object.freeze({ added: Object.freeze(added), removed: Object.freeze(removed) });
}

function terminalCommands(runtime) {
  return Object.freeze([
    [
      "insertDesenEditorNode",
      (document) =>
        runtime.insertDesenEditorNode(document, {
          surfaceId: "sign-in",
          parentId: "sign-in.layout",
          slot: "default",
          index: 0,
          idBase: "sign-in.terminal",
          use: "com.example.ui/Text",
        }),
    ],
    [
      "deleteDesenEditorNode",
      (document) =>
        runtime.deleteDesenEditorNode(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal-delete",
        }),
    ],
    [
      "moveDesenEditorNode",
      (document) =>
        runtime.moveDesenEditorNode(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal-move",
          parentId: "sign-in.terminal-sortable",
          slot: "dragPreview",
          index: 0,
        }),
    ],
    [
      "reorderDesenEditorNode",
      (document) =>
        runtime.reorderDesenEditorNode(document, {
          surfaceId: "sign-in",
          parentId: "sign-in.layout",
          slot: "default",
          nodeId: "sign-in.terminal-reorder",
          index: 1,
        }),
    ],
    [
      "setDesenEditorOwnerProp",
      (document) =>
        runtime.setDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.terminal",
          name: "text",
          value: "Terminal integration",
        }),
    ],
    [
      "deleteDesenEditorOwnerProp",
      (document) =>
        runtime.deleteDesenEditorOwnerProp(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.title",
          name: "role",
        }),
    ],
    [
      "setDesenEditorOwnerStyleProperty",
      (document) =>
        runtime.setDesenEditorOwnerStyleProperty(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.terminal",
          state: "base",
          part: "text",
          property: "color",
          value: "purple",
        }),
    ],
    [
      "deleteDesenEditorOwnerStyleProperty",
      (document) =>
        runtime.deleteDesenEditorOwnerStyleProperty(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.terminal",
          state: "base",
          part: "text",
          property: "color",
        }),
    ],
    [
      "setDesenEditorNodeCondition",
      (document) =>
        runtime.setDesenEditorNodeCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal",
          when: { op: "truthy", args: [true] },
        }),
    ],
    [
      "clearDesenEditorNodeCondition",
      (document) =>
        runtime.clearDesenEditorNodeCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal",
        }),
    ],
    [
      "insertDesenEditorVariant",
      (document) =>
        runtime.insertDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 1,
          variant: { when: { op: "truthy", args: [true] }, props: { align: "center" } },
        }),
    ],
    [
      "deleteDesenEditorVariant",
      (document) =>
        runtime.deleteDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 1,
        }),
    ],
    [
      "reorderDesenEditorVariant",
      (document) =>
        runtime.reorderDesenEditorVariant(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          variantIndex: 0,
          index: 1,
        }),
    ],
    [
      "setDesenEditorVariantCondition",
      (document) =>
        runtime.setDesenEditorVariantCondition(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 0,
          when: { op: "truthy", args: [true] },
        }),
    ],
    [
      "setDesenEditorVariantProp",
      (document) =>
        runtime.setDesenEditorVariantProp(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 0,
          name: "align",
          value: "end",
        }),
    ],
    [
      "deleteDesenEditorVariantProp",
      (document) =>
        runtime.deleteDesenEditorVariantProp(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 0,
          name: "align",
        }),
    ],
    [
      "setDesenEditorVariantStyleProperty",
      (document) =>
        runtime.setDesenEditorVariantStyleProperty(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 0,
          state: "base",
          part: "root",
          property: "padding",
          value: "lg",
        }),
    ],
    [
      "deleteDesenEditorVariantStyleProperty",
      (document) =>
        runtime.deleteDesenEditorVariantStyleProperty(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.layout",
          index: 0,
          state: "base",
          part: "root",
          property: "padding",
        }),
    ],
    [
      "insertDesenEditorStateDeclaration",
      (document) =>
        runtime.insertDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "terminal",
          declaration: { schema: { type: "string" }, initial: "" },
        }),
    ],
    [
      "deleteDesenEditorStateDeclaration",
      (document) =>
        runtime.deleteDesenEditorStateDeclaration(document, {
          surfaceId: "sign-in",
          name: "terminalDelete",
        }),
    ],
    [
      "setDesenEditorStateSchema",
      (document) =>
        runtime.setDesenEditorStateSchema(document, {
          surfaceId: "sign-in",
          name: "terminal",
          schema: { type: "string", maxLength: 32 },
        }),
    ],
    [
      "setDesenEditorStateInitial",
      (document) =>
        runtime.setDesenEditorStateInitial(document, {
          surfaceId: "sign-in",
          name: "terminal",
          initial: "ready",
        }),
    ],
    [
      "setDesenEditorNodeRepeatItems",
      (document) =>
        runtime.setDesenEditorNodeRepeatItems(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal-repeat",
          items: { $ref: "resource.terminalTasks.value", fallback: [] },
        }),
    ],
    [
      "setDesenEditorNodeRepeatKey",
      (document) =>
        runtime.setDesenEditorNodeRepeatKey(document, {
          surfaceId: "sign-in",
          nodeId: "sign-in.terminal-repeat",
          key: { $ref: "item.task.id" },
        }),
    ],
    [
      "setDesenEditorResourceInput",
      (document) =>
        runtime.setDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "terminalTasks",
          name: "temporary",
          value: true,
        }),
    ],
    [
      "deleteDesenEditorResourceInput",
      (document) =>
        runtime.deleteDesenEditorResourceInput(document, {
          surfaceId: "sign-in",
          resourceId: "terminalTasks",
          name: "temporary",
        }),
    ],
    [
      "insertDesenEditorEventHandler",
      (document) =>
        runtime.insertDesenEditorEventHandler(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.layout",
          event: "temporary",
          actions: [{ type: "state.toggle", path: "terminalDelete" }],
        }),
    ],
    [
      "deleteDesenEditorEventHandler",
      (document) =>
        runtime.deleteDesenEditorEventHandler(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.layout",
          event: "temporary",
        }),
    ],
    [
      "insertDesenEditorAction",
      (document) =>
        runtime.insertDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionListPointer: "/on/press",
          index: 1,
          action: { type: "state.set", path: "terminal", value: "inserted" },
        }),
    ],
    [
      "replaceDesenEditorAction",
      (document) =>
        runtime.replaceDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionPointer: "/on/press/1",
          action: { type: "state.set", path: "terminal", value: "replaced" },
        }),
    ],
    [
      "deleteDesenEditorAction",
      (document) =>
        runtime.deleteDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionPointer: "/on/press/1",
        }),
    ],
    [
      "reorderDesenEditorAction",
      (document) =>
        runtime.reorderDesenEditorAction(document, {
          surfaceId: "sign-in",
          ownerId: "sign-in.submit",
          actionPointer: "/on/press/0",
          index: 1,
        }),
    ],
  ]);
}

function canonicalReceipt(value, canonicalizeJsonBytes) {
  const bytes = canonicalizeJsonBytes(value);
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
}

async function persistenceRoundTrip(runtime, document, canonicalizeJsonBytes) {
  let stored = null;
  const adapter = {
    async readSource(sourceKey) {
      if (stored === null) return { status: "missing" };
      return {
        status: "found",
        record: {
          sourceKey,
          generation: stored.generation,
          value: JSON.parse(Buffer.from(stored.bytes).toString("utf8")),
        },
      };
    },
    async compareAndSetSource(request) {
      if (request.expectedGeneration !== null || stored !== null) {
        return { status: "conflict", currentGeneration: stored?.generation ?? null };
      }
      stored = { generation: 1, bytes: new Uint8Array(request.bytes) };
      return { status: "created", generation: 1 };
    },
  };
  const port = runtime.createDesenEditorPersistencePort(adapter);
  assertDeepFrozen(port, "persistence port");
  const save = await port.saveSource({
    sourceKey: "terminal-source",
    expectedGeneration: null,
    document,
  });
  const opened = await port.openSource("terminal-source");
  if (
    save?.status !== "created" ||
    save.generation !== 1 ||
    opened?.status !== "opened" ||
    opened.generation !== 1 ||
    opened.document === document ||
    !bytesEqual(canonicalizeJsonBytes(opened.document), canonicalizeJsonBytes(document))
  ) {
    fail("PERSISTENCE_DRIFT", "The in-memory CAS save/open round trip drifted.", { save, opened });
  }
  assertDeepFrozen(save, "persistence save result");
  assertDeepFrozen(opened, "persistence open result");
  return deepFreeze({
    sourceKey: "terminal-source",
    saveStatus: save.status,
    openStatus: opened.status,
    generation: opened.generation,
    detachedReopenedDocument: true,
    canonicalBytesPreserved: true,
    storedBytes: stored.bytes.byteLength,
    storedSha256: sha256(stored.bytes),
  });
}

function authoringFingerprintBoundary(runtime, protocol, finalDocument, catalog) {
  const leftInput = clone(finalDocument);
  const rightInput = clone(finalDocument);
  leftInput.authoring = { terminalVariant: "alpha", selection: { nodeId: "sign-in.terminal" } };
  rightInput.authoring = { terminalVariant: "omega", selection: { nodeId: "sign-in.title" } };
  const left = expectDocument(runtime, leftInput, "left authoring variant");
  const right = expectDocument(runtime, rightInput, "right authoring variant");
  const validatorResult = runtime.createDesenEditorContinuousValidator([clone(catalog)]);
  if (validatorResult?.ok !== true) {
    fail("VALIDATION_DRIFT", "The authoring fingerprint validator could not be created.");
  }
  const leftReport = validatorResult.validator.validate(left);
  const rightReport = validatorResult.validator.validate(right);
  const leftSourceDigest = protocol.calculateDesenSourceDigest(left);
  const rightSourceDigest = protocol.calculateDesenSourceDigest(right);
  if (
    leftSourceDigest !== rightSourceDigest ||
    leftReport.valid !== true ||
    rightReport.valid !== true ||
    leftReport.diagnostics.length !== 0 ||
    rightReport.diagnostics.length !== 0 ||
    leftReport.documentFingerprint === rightReport.documentFingerprint
  ) {
    fail(
      "FINGERPRINT_DRIFT",
      "The Source-digest/document-fingerprint authoring boundary drifted.",
      {
        leftSourceDigest,
        rightSourceDigest,
        leftReport,
        rightReport,
      },
    );
  }
  return deepFreeze({
    protocolSourceDigestExcludesRootAuthoring: true,
    sourceDigest: leftSourceDigest,
    sourceDigestsEqual: true,
    continuousDocumentFingerprintIncludesRootAuthoring: true,
    leftDocumentFingerprint: leftReport.documentFingerprint,
    rightDocumentFingerprint: rightReport.documentFingerprint,
    documentFingerprintsDifferent: true,
  });
}

async function runTerminalTranscript(runtime, protocol, validSource, validCatalog) {
  const canonicalizeJsonBytes = protocol.canonicalizeJsonBytes;
  const input = terminalInput(validSource);
  let document = expectDocument(runtime, input, "terminal fixture");
  const commands = terminalCommands(runtime);
  exactArray(
    commands.map(([name]) => name),
    MUTATION_COMMANDS,
    "BEHAVIOR_DRIFT",
    "Exact 32-command transcript",
  );
  const initialLedger = identityLedger(document, canonicalizeJsonBytes);
  const steps = [];
  let controlledFailure;

  for (let index = 0; index < commands.length; index += 1) {
    const ordinal = index + 1;
    const [command, run] = commands[index];
    const prior = document;
    const beforeBytes = canonicalizeJsonBytes(prior);
    const beforeLedger = identityLedger(prior, canonicalizeJsonBytes);
    const result = expectSuccess(run(prior), `${ordinal}:${command}`);
    if (result.document === prior || !bytesEqual(canonicalizeJsonBytes(prior), beforeBytes)) {
      fail("ATOMICITY_DRIFT", `${command} mutated or reused its prior document.`);
    }
    document = result.document;
    const afterLedger = identityLedger(document, canonicalizeJsonBytes);
    const delta = identityDelta(beforeLedger, afterLedger);
    const expectedDelta =
      ordinal === 1
        ? { added: ["node:sign-in.terminal"], removed: [] }
        : ordinal === 2
          ? { added: [], removed: ["node:sign-in.terminal-delete"] }
          : { added: [], removed: [] };
    exactArray(delta.added, expectedDelta.added, "IDENTITY_DRIFT", `${command} added identities`);
    exactArray(
      delta.removed,
      expectedDelta.removed,
      "IDENTITY_DRIFT",
      `${command} removed identities`,
    );
    steps.push(
      deepFreeze({
        ordinal,
        command,
        result: "PASS",
        priorDocumentUnchanged: true,
        freshDocument: true,
        recursivelyFrozen: true,
        before: canonicalReceipt(prior, canonicalizeJsonBytes),
        after: canonicalReceipt(document, canonicalizeJsonBytes),
        identityDelta: delta,
        identityLedger: afterLedger,
        insertedNodeId: command === "insertDesenEditorNode" ? result.insertedNodeId : null,
      }),
    );

    if (ordinal === 16) {
      const resumeBase = document;
      const resumeBytes = canonicalizeJsonBytes(resumeBase);
      const failure = runtime.deleteDesenEditorNode(resumeBase, {
        surfaceId: "sign-in",
        nodeId: "sign-in.controlled-missing",
      });
      if (
        failure?.ok !== false ||
        Object.hasOwn(failure, "document") ||
        failure.diagnostics?.length !== 1 ||
        failure.diagnostics[0]?.code !== "run.desen.editor/STRUCTURAL_EDIT_TARGET_NOT_FOUND" ||
        !bytesEqual(canonicalizeJsonBytes(resumeBase), resumeBytes)
      ) {
        fail(
          "ATOMICITY_DRIFT",
          "The controlled failure exposed a document or changed resume state.",
          failure,
        );
      }
      assertDeepFrozen(failure, "controlled failure");
      controlledFailure = deepFreeze({
        afterSuccessfulStep: ordinal,
        command: "deleteDesenEditorNode",
        diagnosticCode: failure.diagnostics[0].code,
        partialDocumentExposed: false,
        priorDocumentUnchanged: true,
        resumeStep: ordinal + 1,
        resumedSuccessfully: false,
        resumeBase: canonicalReceipt(resumeBase, canonicalizeJsonBytes),
      });
    } else if (ordinal === 17 && controlledFailure !== undefined) {
      controlledFailure = deepFreeze({ ...controlledFailure, resumedSuccessfully: true });
    }
  }

  if (controlledFailure?.resumedSuccessfully !== true) {
    fail("ATOMICITY_DRIFT", "The transcript did not resume after its controlled failure.");
  }
  const finalLedger = identityLedger(document, canonicalizeJsonBytes);
  const expectedFinalIdentities = initialLedger.identities
    .filter((identity) => identity !== "node:sign-in.terminal-delete")
    .concat("node:sign-in.terminal")
    .sort(compareText);
  exactArray(finalLedger.identities, expectedFinalIdentities, "IDENTITY_DRIFT", "Final identities");

  const validatorResult = runtime.createDesenEditorContinuousValidator([clone(validCatalog)]);
  if (validatorResult?.ok !== true)
    fail("VALIDATION_DRIFT", "The terminal validator was not created.");
  const terminalReport = validatorResult.validator.validate(document);
  if (
    terminalReport.valid !== true ||
    terminalReport.diagnostics.length !== 0 ||
    terminalReport.obligations.length !== 7 ||
    terminalReport.invalidSubjects.length !== 0 ||
    terminalReport.unmappedDiagnosticIndexes.length !== 0
  ) {
    fail(
      "VALIDATION_DRIFT",
      "The exact terminal Source did not pass continuous validation.",
      terminalReport,
    );
  }
  assertDeepFrozen(terminalReport, "terminal validation report");
  const persistence = await persistenceRoundTrip(runtime, document, canonicalizeJsonBytes);
  const authoringFingerprints = authoringFingerprintBoundary(
    runtime,
    protocol,
    document,
    validCatalog,
  );
  const trace = deepFreeze({
    schemaVersion: 1,
    profile: "desen.editor-core.terminal-command-trace.v1",
    commands: MUTATION_COMMANDS,
    initial: {
      document: canonicalReceipt(
        expectDocument(runtime, input, "trace initial fixture"),
        canonicalizeJsonBytes,
      ),
      identityLedger: initialLedger,
    },
    steps,
    controlledFailure,
    final: {
      document: canonicalReceipt(document, canonicalizeJsonBytes),
      identityLedger: finalLedger,
      validation: {
        valid: terminalReport.valid,
        diagnosticCount: terminalReport.diagnostics.length,
        obligationCount: terminalReport.obligations.length,
        obligationKinds: [...new Set(terminalReport.obligations.map(({ kind }) => kind))].sort(
          compareText,
        ),
        invalidSubjectCount: terminalReport.invalidSubjects.length,
        unmappedDiagnosticCount: terminalReport.unmappedDiagnosticIndexes.length,
        documentFingerprint: terminalReport.documentFingerprint,
        catalogSetFingerprint: terminalReport.catalogSetFingerprint,
        report: terminalReport,
        reportCanonical: canonicalReceipt(terminalReport, canonicalizeJsonBytes),
      },
      persistence,
      authoringFingerprints,
    },
  });
  const jsonBytes = Buffer.from(JSON.stringify(trace), "utf8");
  const parsed = JSON.parse(jsonBytes.toString("utf8"));
  const canonicalBefore = canonicalizeJsonBytes(trace);
  const canonicalAfter = canonicalizeJsonBytes(parsed);
  if (
    JSON.stringify(parsed) !== JSON.stringify(trace) ||
    !bytesEqual(canonicalBefore, canonicalAfter)
  ) {
    fail("TRACE_DRIFT", "The callback-free terminal trace failed JSON/RFC 8785 round trip.");
  }
  return deepFreeze({
    trace,
    finalDocument: document,
    traceRoundTrip: {
      jsonSerializable: true,
      callbacksOrExecutableValues: false,
      jsonBytes: jsonBytes.byteLength,
      parsedValueExact: true,
      rfc8785CanonicalBytes: canonicalBefore.byteLength,
      rfc8785CanonicalSha256: sha256(canonicalBefore),
      roundTripCanonicalSha256: sha256(canonicalAfter),
      canonicalBytesEqual: true,
    },
  });
}

async function authenticateFrozenArtifact() {
  const bytes = await readNoFollow(ARTIFACT_PATH, "frozen M08-T10 proof artifact");
  const digest = sha256(bytes);
  if (bytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes || digest !== FROZEN_ARTIFACT_PIN.sha256) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T10 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(bytes, "frozen M08-T10 proof artifact");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-terminal-integration" ||
    artifact.profile !== "desen.editor-core.terminal-integration-proof.v1" ||
    artifact.task !== "M08-T10" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.gate !== "G08" ||
    artifact.claim?.gateStatus !== "DONE" ||
    artifact.claim?.p18Status !== "PROVEN" ||
    artifact.claim?.s002Status !== "TESTED" ||
    artifact.prerequisites?.length !== EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS.length ||
    artifact.publicApi?.runtimeExports?.length !== 35 ||
    artifact.publicApi?.typeExports?.length !== 88 ||
    artifact.executionAuthority?.graphCount !== 2 ||
    artifact.independentGraphs?.graphs !== 2 ||
    artifact.packageBoundary?.platformNeutral !== true ||
    artifact.testAuthority?.focusedBehaviorCases !== 4 ||
    artifact.testAuthority?.publicRuntimeAndRootCases !== 50 ||
    artifact.testAuthority?.publicCompilerNegativeAssertions !== 102 ||
    artifact.testAuthority?.rootProofCases !== 10 ||
    artifact.trackedBoundary?.files !== TRACKED_PATHS.length ||
    !Array.isArray(receipts) ||
    receipts.length !== TRACKED_PATHS.length ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T10 artifact identity or retained claim drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(bytes),
    artifactSha256: digest,
  });
}

function assertCurrentTerminalCompatibility(frozenArtifact, currentCompatibility) {
  const frozenReceipts = new Map(
    frozenArtifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  const currentReceipts = new Map(
    currentCompatibility.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T10_RECEIPT_PATHS) {
    const frozenReceipt = frozenReceipts.get(relativePath);
    const currentReceipt = currentReceipts.get(relativePath);
    if (
      frozenReceipt === undefined ||
      currentReceipt === undefined ||
      frozenReceipt.bytes !== currentReceipt.bytes ||
      frozenReceipt.sha256 !== currentReceipt.sha256
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T10 receipt drifted: ${relativePath}`);
    }
  }
  for (const relativePath of CURRENT_COMPATIBILITY_ONLY_PATHS) {
    if (!frozenReceipts.has(relativePath) || !currentReceipts.has(relativePath)) {
      fail("BOUNDARY_DRIFT", `A compatibility-only M08-T10 receipt is missing: ${relativePath}`);
    }
  }
  const normalizedReceipts = currentCompatibility.trackedBoundary.receipts.map((candidate) =>
    CURRENT_COMPATIBILITY_ONLY_PATHS.includes(candidate.path)
      ? frozenReceipts.get(candidate.path)
      : candidate,
  );
  const normalized = {
    ...currentCompatibility,
    trackedBoundary: {
      files: currentCompatibility.trackedBoundary.files,
      receipts: normalizedReceipts,
    },
  };
  if (JSON.stringify(normalized) !== JSON.stringify(frozenArtifact)) {
    fail("BEHAVIOR_DRIFT", "The current M08-T10 graph left its frozen terminal claim.");
  }
}

export async function buildEditorCoreTerminalIntegrationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const frozen = await authenticateFrozenArtifact();
  const fileInventory = await verifyWorkspaceFileInventory(options.inventoryExtraPaths);
  const prerequisites = await authenticatePrerequisites(options);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const t09Artifact = prerequisites.artifacts["M08-T09"];
  const boundary = verifyBoundary(files, t09Artifact, fileInventory);
  const executionAuthority = authenticateRuntimeClosure(t09Artifact, files);
  const validSource = parseJson(files.get(SOURCE_FIXTURE_PATH), SOURCE_FIXTURE_PATH);
  const validCatalog = parseJson(files.get(CATALOG_FIXTURE_PATH), CATALOG_FIXTURE_PATH);
  const [firstGraph, secondGraph] = await Promise.all([
    importReceiptedRuntime(files, boundary.runtimeExports),
    importReceiptedRuntime(files, boundary.runtimeExports),
  ]);
  const [first, second] = await Promise.all([
    runTerminalTranscript(firstGraph.editorCore, firstGraph.protocol, validSource, validCatalog),
    runTerminalTranscript(secondGraph.editorCore, secondGraph.protocol, validSource, validCatalog),
  ]);
  if (
    first.finalDocument === second.finalDocument ||
    JSON.stringify(first.trace) !== JSON.stringify(second.trace) ||
    !bytesEqual(
      firstGraph.protocol.canonicalizeJsonBytes(first.finalDocument),
      secondGraph.protocol.canonicalizeJsonBytes(second.finalDocument),
    ) ||
    !bytesEqual(
      firstGraph.protocol.canonicalizeJsonBytes(first.trace.final.validation.report),
      secondGraph.protocol.canonicalizeJsonBytes(second.trace.final.validation.report),
    ) ||
    JSON.stringify(first.traceRoundTrip) !== JSON.stringify(second.traceRoundTrip)
  ) {
    fail("DETERMINISM_DRIFT", "The two independent emitted graphs did not converge exactly.");
  }
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue terminal integration evidence.");
  }
  const finalFileInventory = await verifyWorkspaceFileInventory();
  if (JSON.stringify(finalFileInventory) !== JSON.stringify(fileInventory)) {
    fail("INVENTORY_DRIFT", "The editor-core file inventory changed during terminal execution.");
  }

  const receipts = [...files.entries()]
    .map(([relativePath, bytes]) => receipt(relativePath, bytes))
    .sort((left, right) => compareText(left.path, right.path));
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-terminal-integration",
    profile: "desen.editor-core.terminal-integration-proof.v1",
    task: "M08-T10",
    result: "PASS",
    prerequisites: prerequisites.evidence,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      taskStatus: "DONE",
      gate: "G08",
      gateStatus: "DONE",
      p18Status: "PROVEN",
      s002Status: "TESTED",
      exactMutationCommandCount: MUTATION_COMMANDS.length,
      deterministicTerminalCommandTranscript: true,
      stableIdentityLedger: true,
      failureAtomicityAndResume: true,
      continuousValidationTerminalPass: true,
      persistenceSaveOpenRoundTrip: true,
      authoringDigestFingerprintSeparation: true,
      astPlatformBoundary: true,
      callbackFreeJsonTraceRoundTrip: true,
      prerequisiteTasks: EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS.map(({ task }) => task),
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      taskRuntimeExportsAdded: boundary.taskRuntimeExportsAdded,
      taskTypeExportsAdded: boundary.taskTypeExportsAdded,
      productionHelperAdded: false,
    },
    executionAuthority,
    independentGraphs: {
      graphs: 2,
      graphOneTrace: first.trace,
      graphTwoTrace: second.trace,
      traceValuesEqual: true,
      finalCanonicalBytesEqual: true,
      finalDocumentsDetached: true,
      fullValidationReportsEqual: true,
      graphOneRoundTrip: first.traceRoundTrip,
      graphTwoRoundTrip: second.traceRoundTrip,
    },
    packageBoundary: {
      currentEmittedFiles: boundary.emittedFiles,
      fileInventory: boundary.fileInventory,
      productionDependencies: ["@desen/protocol", "@desen/validator"],
      manifestExportRoots: ["."],
      platformNeutral: true,
      astAudit: boundary.astAudit,
      aggregateRootTestWired: boundary.aggregateRootTestWired,
      aggregateRootCheckWired: boundary.aggregateRootCheckWired,
      reactImports: 0,
      domImports: 0,
      nodeImports: 0,
      cssImports: 0,
      dynamicImports: 0,
      evalCalls: 0,
    },
    testAuthority: {
      focusedBehaviorCases: boundary.focusedBehaviorCases,
      publicRuntimeAndRootCases: boundary.publicRuntimeAndRootCases,
      publicCompilerNegativeAssertions: boundary.publicCompilerNegativeAssertions,
      rootProofCases: boundary.rootProofCases,
    },
    trackedBoundary: { files: receipts.length, receipts },
    nonclaims: [
      "REACT_RENDERER_COMPONENT_OR_DOM_BEHAVIOR",
      "SELECTION_VIEWPORT_UNDO_REDO_OR_MULTI_USER_POLICY",
      "CONCRETE_DURABILITY_DATABASE_FILESYSTEM_OR_NETWORK_ADAPTER",
      "DYNAMIC_OBLIGATION_EXECUTION_OR_VALUE_RESOLUTION",
      "HOSTILE_JAVASCRIPT_SANDBOX_OR_PROXY_TRAP_MEMBRANE",
      "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
      "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:terminal-integration",
      "pnpm --filter @desen/editor-core test:public-package",
      "node scripts/generate-editor-core-terminal-integration-proof.mjs",
      "node scripts/verify-editor-core-terminal-integration.mjs",
      "node --test tests/editor-core-terminal-integration.test.mjs",
    ],
  });
  assertCurrentTerminalCompatibility(frozen.artifact, currentCompatibility);
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      retainedTaskTimeReceipts: RETAINED_T10_RECEIPT_PATHS.length,
      currentCompatibilityOnlyPaths: CURRENT_COMPATIBILITY_ONLY_PATHS,
    },
    task: "M08-T10",
  });
}

const VERIFY_OPTION_KEYS = Object.freeze([
  "artifactBytes",
  "artifactPath",
  "buildOptions",
  "proofDocumentBytes",
  "proofDocumentPath",
]);

function captureVerifyOptions(raw) {
  const source = captureExactObject(raw, VERIFY_OPTION_KEYS, "verifyOptions");
  for (const key of ["artifactPath", "proofDocumentPath"]) {
    if (source[key] !== undefined && typeof source[key] !== "string") {
      fail("OPTIONS_INVALID", `verifyOptions.${key} must be a string.`);
    }
  }
  return Object.freeze({
    artifactBytes:
      source.artifactBytes === undefined
        ? undefined
        : captureByteInput(source.artifactBytes, "verifyOptions.artifactBytes"),
    artifactPath: source.artifactPath,
    buildOptions: source.buildOptions,
    proofDocumentBytes:
      source.proofDocumentBytes === undefined
        ? undefined
        : captureByteInput(source.proofDocumentBytes, "verifyOptions.proofDocumentBytes"),
    proofDocumentPath: source.proofDocumentPath,
  });
}

function verifyProofPin(proof, artifactSha256) {
  if (/<!--[\s\S]*?-->/u.test(proof) || /sha256:PENDING/u.test(proof)) {
    fail("PROOF_PIN_DRIFT", "The proof document contains hidden or pending authority.");
  }
  const exactPin = `Final artifact: \`sha256:${artifactSha256}\``;
  const pinLines = proof.split(/\r?\n/u).filter((line) => line.startsWith("Final artifact:"));
  if (pinLines.length !== 1 || pinLines[0] !== exactPin) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  for (const contradiction of [
    /\bM08-T10\b[^\n]*(?:NOT_STARTED|IN_PROGRESS|FAIL)/iu,
    /\bStatus:\s*(?:NOT_STARTED|IN_PROGRESS|FAIL)/iu,
    /\bResult:\s*FAIL/iu,
  ]) {
    if (contradiction.test(proof)) {
      fail("PROOF_PIN_DRIFT", "The visible proof document contradicts its PASS authority.");
    }
  }
}

export async function verifyEditorCoreTerminalIntegrationEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCoreTerminalIntegrationEvidence(options.buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T10 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T10 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T10 proof document",
    ));
  verifyProofPin(decodeUtf8(proofBytes, "M08-T10 proof document"), built.artifactSha256);
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisiteTasks: EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS.map(({ task }) => task),
    directPredecessorSha256: EDITOR_CORE_TERMINAL_INTEGRATION_PREREQUISITE_PINS[8].sha256,
    p18Status: "PROVEN",
    g08Status: "DONE",
  });
}

async function assertSafeDestination(destinationPath) {
  const absolutePath = path.resolve(destinationPath);
  const parent = path.dirname(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(parent);
  } catch (error) {
    fail("FILESYSTEM_UNSAFE", "Artifact destination parent cannot be resolved.", String(error));
  }
  if (canonicalParent !== parent) fail("FILESYSTEM_UNSAFE", "Artifact parent is not canonical.");
  try {
    const status = await lstat(absolutePath);
    if (!status.isFile() || status.isSymbolicLink() || status.nlink !== 1) {
      fail("FILESYSTEM_UNSAFE", "Existing artifact destination must be one regular file.");
    }
  } catch (error) {
    if (error instanceof EditorCoreTerminalIntegrationProofError) throw error;
    if (error?.code !== "ENOENT") {
      fail("FILESYSTEM_UNSAFE", "Artifact destination cannot be inspected.", String(error));
    }
  }
  return absolutePath;
}

const WRITE_OPTION_KEYS = Object.freeze(["beforeAtomicRename", "destinationPath"]);

function captureWriteOptions(raw) {
  const source = captureExactObject(raw, WRITE_OPTION_KEYS, "writeOptions");
  if (source.destinationPath !== undefined && typeof source.destinationPath !== "string") {
    fail("OPTIONS_INVALID", "writeOptions.destinationPath must be a string.");
  }
  if (
    source.beforeAtomicRename !== undefined &&
    (typeof source.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(source.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "writeOptions.beforeAtomicRename must be a non-Proxy function.");
  }
  return Object.freeze(source);
}

export async function writeEditorCoreTerminalIntegrationEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreTerminalIntegrationEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_TERMINAL_INTEGRATION_ARTIFACT_PATH,
  );
  try {
    await writeAtomicProofArtifact({
      artifactPath: destinationPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail(
      "ATOMIC_WRITE_FAILED",
      "The proof artifact could not be committed atomically.",
      String(error),
    );
  }
  const committed = await readNoFollow(destinationPath, "committed M08-T10 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T10 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
