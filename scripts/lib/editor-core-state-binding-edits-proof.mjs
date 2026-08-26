import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const DIRECTORY_READ_FLAGS = READ_FLAGS | (fileConstants.O_DIRECTORY ?? 0);
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-STATE-BINDING-EDITS.md";
const T02_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json";
const T04_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-content-edits.json";
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const INDEX_SOURCE_PATH = "packages/editor-core/src/index.ts";
const STATE_BINDING_EDITS_SOURCE_PATH = "packages/editor-core/src/state-binding-edits.ts";
const PACKAGE_TEST_PATH = "packages/editor-core/test/state-binding-edits.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/state-binding-edits.types.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const ROOT_TEST_PATH = "tests/editor-core-state-binding-edits.test.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-state-binding-edits-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-state-binding-edits-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-state-binding-edits.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const DOCUMENT_LIMIT = 8_388_608;

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
const CURRENT_EDITOR_RUNTIME_PATHS = Object.freeze([
  "packages/editor-core/package.json",
  "packages/editor-core/dist/index.js",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/content-edits.js",
  "packages/editor-core/dist/state-binding-edits.js",
]);
const RETAINED_EDITOR_RUNTIME_PATHS = Object.freeze([
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/content-edits.js",
]);
const ISOLATED_RUNTIME_PATHS = Object.freeze([
  ...CURRENT_EDITOR_RUNTIME_PATHS,
  ...DEPENDENCY_RUNTIME_PATHS,
]);
const DIST_PATHS = Object.freeze(
  [
    "index",
    "source-document",
    "stable-id-insert",
    "structural-edits",
    "content-edits",
    "state-binding-edits",
  ].flatMap((name) => [
    `packages/editor-core/dist/${name}.d.ts`,
    `packages/editor-core/dist/${name}.d.ts.map`,
    `packages/editor-core/dist/${name}.js`,
    `packages/editor-core/dist/${name}.js.map`,
  ]),
);
const TRACKED_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  PACKAGE_PATH,
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  "packages/editor-core/src/structural-edits.ts",
  "packages/editor-core/src/content-edits.ts",
  STATE_BINDING_EDITS_SOURCE_PATH,
  INDEX_SOURCE_PATH,
  ...DIST_PATHS,
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  "packages/editor-core/test/structural-edits.test.ts",
  "packages/editor-core/test/structural-edits.types.ts",
  "packages/editor-core/test/content-edits.test.ts",
  "packages/editor-core/test/content-edits.types.ts",
  PACKAGE_TEST_PATH,
  PACKAGE_TYPES_PATH,
  PUBLIC_TEST_PATH,
  PUBLIC_TYPES_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
  PROOF_LIBRARY_PATH,
  GENERATOR_PATH,
  VERIFIER_PATH,
  ROOT_TEST_PATH,
]);
const TRACKED_PATH_SET = new Set(TRACKED_PATHS);
const RETAINED_T04_RECEIPT_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  "packages/editor-core/src/stable-id-insert.ts",
  "packages/editor-core/src/structural-edits.ts",
  "packages/editor-core/src/content-edits.ts",
  "packages/editor-core/dist/source-document.d.ts",
  "packages/editor-core/dist/source-document.d.ts.map",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/source-document.js.map",
  "packages/editor-core/dist/stable-id-insert.d.ts",
  "packages/editor-core/dist/stable-id-insert.d.ts.map",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/stable-id-insert.js.map",
  "packages/editor-core/dist/structural-edits.d.ts",
  "packages/editor-core/dist/structural-edits.d.ts.map",
  "packages/editor-core/dist/structural-edits.js",
  "packages/editor-core/dist/structural-edits.js.map",
  "packages/editor-core/dist/content-edits.d.ts",
  "packages/editor-core/dist/content-edits.d.ts.map",
  "packages/editor-core/dist/content-edits.js",
  "packages/editor-core/dist/content-edits.js.map",
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  "packages/editor-core/test/stable-id-insert.test.ts",
  "packages/editor-core/test/stable-id-insert.types.ts",
  "packages/editor-core/test/structural-edits.test.ts",
  "packages/editor-core/test/structural-edits.types.ts",
  "packages/editor-core/test/content-edits.test.ts",
  "packages/editor-core/test/content-edits.types.ts",
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
]);

const RETAINED_CONTENT_RUNTIME_EXPORTS = Object.freeze(
  [
    "clearDesenEditorNodeCondition",
    "deleteDesenEditorOwnerProp",
    "deleteDesenEditorOwnerStyleProperty",
    "deleteDesenEditorVariant",
    "deleteDesenEditorVariantProp",
    "deleteDesenEditorVariantStyleProperty",
    "insertDesenEditorVariant",
    "reorderDesenEditorVariant",
    "setDesenEditorNodeCondition",
    "setDesenEditorOwnerProp",
    "setDesenEditorOwnerStyleProperty",
    "setDesenEditorVariantCondition",
    "setDesenEditorVariantProp",
    "setDesenEditorVariantStyleProperty",
  ].sort(compareText),
);
const STATE_BINDING_RUNTIME_EXPORTS = Object.freeze(
  [
    "deleteDesenEditorResourceInput",
    "deleteDesenEditorStateDeclaration",
    "insertDesenEditorStateDeclaration",
    "setDesenEditorNodeRepeatItems",
    "setDesenEditorNodeRepeatKey",
    "setDesenEditorResourceInput",
    "setDesenEditorStateInitial",
    "setDesenEditorStateSchema",
  ].sort(compareText),
);
const EXPECTED_RUNTIME_EXPORTS = Object.freeze(
  [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "insertDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    ...RETAINED_CONTENT_RUNTIME_EXPORTS,
    ...STATE_BINDING_RUNTIME_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorDocument",
    "DesenEditorDocumentCreationFailure",
    "DesenEditorDocumentCreationResult",
    "DesenEditorDocumentCreationSuccess",
    "DesenEditorInsertDiagnostic",
    "DesenEditorInsertDiagnosticCode",
    "DesenEditorNodeDeleteCommand",
    "DesenEditorNodeInsertCommand",
    "DesenEditorNodeInsertFailure",
    "DesenEditorNodeInsertResult",
    "DesenEditorNodeInsertSuccess",
    "DesenEditorNodeMoveCommand",
    "DesenEditorNodeReorderCommand",
    "DesenEditorStructuralEditDiagnostic",
    "DesenEditorStructuralEditDiagnosticCode",
    "DesenEditorStructuralEditFailure",
    "DesenEditorStructuralEditResult",
    "DesenEditorStructuralEditSuccess",
    "DesenEditorContentEditDiagnostic",
    "DesenEditorContentEditDiagnosticCode",
    "DesenEditorContentEditFailure",
    "DesenEditorContentEditResult",
    "DesenEditorContentEditSuccess",
    "DesenEditorContentPredicate",
    "DesenEditorContentValue",
    "DesenEditorContentVariant",
    "DesenEditorNodeConditionClearCommand",
    "DesenEditorNodeConditionSetCommand",
    "DesenEditorOwnerPropDeleteCommand",
    "DesenEditorOwnerPropSetCommand",
    "DesenEditorOwnerStylePropertyDeleteCommand",
    "DesenEditorOwnerStylePropertySetCommand",
    "DesenEditorVariantConditionSetCommand",
    "DesenEditorVariantDeleteCommand",
    "DesenEditorVariantInsertCommand",
    "DesenEditorVariantPropDeleteCommand",
    "DesenEditorVariantPropSetCommand",
    "DesenEditorVariantReorderCommand",
    "DesenEditorVariantStylePropertyDeleteCommand",
    "DesenEditorVariantStylePropertySetCommand",
    "DesenEditorBindingValue",
    "DesenEditorNodeRepeatItemsSetCommand",
    "DesenEditorNodeRepeatKeySetCommand",
    "DesenEditorResourceInputDeleteCommand",
    "DesenEditorResourceInputSetCommand",
    "DesenEditorStateBindingEditDiagnostic",
    "DesenEditorStateBindingEditDiagnosticCode",
    "DesenEditorStateBindingEditFailure",
    "DesenEditorStateBindingEditResult",
    "DesenEditorStateBindingEditSuccess",
    "DesenEditorStateDeclaration",
    "DesenEditorStateDeclarationDeleteCommand",
    "DesenEditorStateDeclarationInsertCommand",
    "DesenEditorStateInitialSetCommand",
    "DesenEditorStateSchemaSetCommand",
  ].sort(compareText),
);
const EXPECTED_STATE_BINDING_EXPORTS = Object.freeze(
  [
    ...STATE_BINDING_RUNTIME_EXPORTS,
    "DesenEditorBindingValue",
    "DesenEditorNodeRepeatItemsSetCommand",
    "DesenEditorNodeRepeatKeySetCommand",
    "DesenEditorResourceInputDeleteCommand",
    "DesenEditorResourceInputSetCommand",
    "DesenEditorStateBindingEditDiagnostic",
    "DesenEditorStateBindingEditDiagnosticCode",
    "DesenEditorStateBindingEditFailure",
    "DesenEditorStateBindingEditResult",
    "DesenEditorStateBindingEditSuccess",
    "DesenEditorStateDeclaration",
    "DesenEditorStateDeclarationDeleteCommand",
    "DesenEditorStateDeclarationInsertCommand",
    "DesenEditorStateInitialSetCommand",
    "DesenEditorStateSchemaSetCommand",
  ].sort(compareText),
);
const EXPECTED_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID",
  "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
  "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS",
  "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
]);
const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "inserts complete dotted and prototype-sensitive state declarations as detached own data",
  "sets state schema and inert initial values, then deletes without cascading references",
  "retains the required empty state map after deleting the final declaration",
  "replaces repeat items and key while preserving alias, limit, extensions, order, and identities",
  "creates, replaces, and deletes prototype-sensitive resource-input leaves as own data",
  "reports duplicate, missing target, and missing path failures without partial authority",
  "requires one unique component-node identity for repeat edits",
  "preserves structural diagnostics for invalid schemas and binding forms atomically",
  "rejects active, executable, sparse, inherited, symbol, extra, and malformed command data without hooks",
  "accepts an honest forwarding Proxy and contains throwing reflection traps atomically",
  "is deterministic, detached, deeply frozen, atomic, and stable-ID preserving",
  "accepts component depth 64 and rejects depth 65 before mutation",
  "accepts exactly 25,000 surface identities and rejects the next occurrence",
  "accepts an exact 8 MiB post-edit Source and rejects a one-byte crossing",
]);
const EXPECTED_PUBLIC_TEST_NAMES = Object.freeze([
  "the package manifest keeps one exact root export and the declared runtime dependencies",
  "the emitted public module graph stays platform-neutral and execution-closed",
  "the built public package resolves through its export map and exposes the reviewed runtime exports",
  "the emitted factory returns the direct plain frozen Source without a hidden model",
  "the emitted factory detaches caller input and creates independent snapshots",
  "the emitted factory admits structurally valid unresolved capability use",
  "the emitted factory rejects an invalid Source root without a partial document",
  "the emitted factory rejects an invalid embedded schema at its exact pointer",
  "the emitted factory rejects executable non-JSON data without a partial document",
  "the emitted factory rejects getter and toJSON hooks without invoking caller code",
  "the emitted insert command allocates a stable id and returns one new direct Source",
  "the emitted insert command is deterministic and keeps identity allocation surface-local",
  "the emitted insert command creates Object.prototype-named slots as own data",
  "the emitted insert command rejects missing, ambiguous, and invalid positions atomically",
  "the emitted insert command rejects active or authority-expanding command input",
  "the emitted structural commands delete, move, and reorder without rewriting identities",
  "the emitted move command targets behavior slots and creates prototype-named own data",
  "the emitted structural commands reject roots, cycles, and invalid positions atomically",
  "the emitted structural commands reject active and authority-expanding command input",
  "the emitted base content commands edit component and behavior owners",
  "the emitted condition and variant lifecycle commands preserve ordered semantics",
  "the emitted delete and variant-update commands retain emptied own containers",
  "the emitted content commands reject missing, ambiguous, invalid, and structural paths atomically",
  "the emitted content commands enforce own-data shapes and contain Proxy reflection failures atomically",
  "the emitted content commands are deterministic, immutable, and Catalog-unresolved",
  "the emitted state declaration commands preserve exact lifecycle and whole schema-initial values",
  "the emitted repeat commands replace whole item and key bindings without changing coupled fields",
  "the emitted resource input commands create and delete own prototype-sensitive bindings",
  "the emitted state and binding commands reject missing, duplicate, ambiguous, and structural failures atomically",
  "the emitted state and binding commands enforce own-data shapes and contain Proxy reflection failures atomically",
  "the emitted state and binding commands are deterministic, immutable, and semantically unresolved",
  "[proof-core] two fresh final builds are byte-identical and preserve honest scope",
  "[proof-core] rejects a wrapper-returning or mutable public runtime",
  "[proof-core] rejects caller retention and partial failure authority",
  "[proof-core] rejects admission that becomes semantically too strict",
  "[proof-core] rejects source, TSDoc, import, distribution, and manifest drift",
  "[proof-core] rejects focused-test inventory drift",
  "[proof-core] rejects accessor, inherited, symbol, and Proxy options without hooks",
]);

const BUILD_OPTION_KEYS = Object.freeze([
  "beforeAuthorityRecheck",
  "fileOverrides",
  "t02PrerequisiteBytes",
  "t02PrerequisitePath",
  "t04CompatibilityBytes",
  "t04CompatibilityPath",
  "runtime",
]);
const VERIFY_OPTION_KEYS = Object.freeze([
  "artifactBytes",
  "artifactPath",
  "buildOptions",
  "proofDocumentBytes",
  "proofDocumentPath",
]);
const WRITE_OPTION_KEYS = Object.freeze(["beforeAtomicRename", "destinationPath"]);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_VIEW_INTRINSICS = Object.freeze({
  buffer: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get,
  byteLength: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get,
  byteOffset: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset")?.get,
});

export const EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M08-T02",
    path: T02_ARTIFACT_PATH,
    bytes: 19_561,
    sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
  }),
]);

export const EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN = Object.freeze({
  task: "M08-T04",
  path: T04_ARTIFACT_PATH,
  bytes: 26_988,
  sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
});

const EMBEDDED_T03_CHAIN_PIN = Object.freeze({
  task: "M08-T03",
  path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
  bytes: 22_402,
  sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
});

export const EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact M08-T02 prerequisite, M08-T04 graph compatibility, and isolated runtime",
  "[determinism] two fresh M08-T05 builds are byte-identical",
  "[behavior] proves eight state/binding commands, stable identity, limits, and atomic diagnostics",
  "[mutation] rejects runtime substitution and tracked boundary mutation",
  "[artifact] verifies exact artifact bytes and one exact final proof pin",
  "[writer] atomically commits exact bytes and preserves the previous destination on failure",
  "[writer-filesystem] rejects symlink, hard-link, and non-file destinations",
  "[filesystem] rejects linked artifact/proof and linked, replaced, or raced prerequisites",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[immutability] freezes evidence and states the exact nonclaim boundary",
]);

export const DEFAULT_EDITOR_CORE_STATE_BINDING_EDITS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCoreStateBindingEditsProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreStateBindingEditsProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreStateBindingEditsProofError(code, message, details);
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
  const pending = [value];
  const visited = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    if (!Object.isFrozen(current)) fail("BEHAVIOR_DRIFT", `${label} must be recursively frozen.`);
    pending.push(...Object.values(current));
  }
}

function captureByteInput(value, label) {
  if (typeof value === "string") return Buffer.from(value, "utf8");
  if (!utilTypes.isUint8Array(value) || utilTypes.isProxy(value)) {
    fail("OPTIONS_INVALID", `${label} must be a non-shared byte view or string.`);
  }
  for (const key of ["buffer", "byteLength", "byteOffset", "length"]) {
    if (Object.hasOwn(value, key)) fail("OPTIONS_INVALID", `${label} shadows byte authority.`);
  }
  const buffer = BYTE_VIEW_INTRINSICS.buffer?.call(value);
  const byteLength = BYTE_VIEW_INTRINSICS.byteLength?.call(value);
  const byteOffset = BYTE_VIEW_INTRINSICS.byteOffset?.call(value);
  if (utilTypes.isSharedArrayBuffer(buffer)) {
    fail("OPTIONS_INVALID", `${label} cannot alias shared mutable memory.`);
  }
  return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
}

function captureExactObject(raw, allowedKeys, label) {
  if (raw === undefined) return Object.create(null);
  if (typeof raw !== "object" || raw === null || utilTypes.isProxy(raw)) {
    fail("OPTIONS_INVALID", `${label} must be a plain non-Proxy object.`);
  }
  const prototype = Object.getPrototypeOf(raw);
  if (prototype !== null && prototype !== Object.prototype) {
    fail("OPTIONS_INVALID", `${label} cannot carry inherited authority.`);
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(raw)) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      fail("OPTIONS_INVALID", `${label} contains unknown authority.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${key} must be an own enumerable data property.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureFileOverrides(raw) {
  if (raw === undefined) return new Map();
  const source = captureExactObject(raw, TRACKED_PATHS, "fileOverrides");
  const captured = new Map();
  for (const [relativePath, value] of Object.entries(source)) {
    if (!TRACKED_PATH_SET.has(relativePath)) {
      fail("OPTIONS_INVALID", `Untracked file override: ${relativePath}`);
    }
    captured.set(relativePath, captureByteInput(value, `fileOverrides.${relativePath}`));
  }
  return captured;
}

function captureRuntime(raw) {
  if (raw === undefined) return undefined;
  const keys = ["createDesenEditorDocument", ...STATE_BINDING_RUNTIME_EXPORTS];
  const source = captureExactObject(raw, keys, "buildOptions.runtime");
  for (const key of keys) {
    if (typeof source[key] !== "function" || utilTypes.isProxy(source[key])) {
      fail("OPTIONS_INVALID", `buildOptions.runtime.${key} must be a non-Proxy function.`);
    }
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, source[key]])));
}

function captureBuildOptions(raw) {
  const source = captureExactObject(raw, BUILD_OPTION_KEYS, "buildOptions");
  for (const key of ["t02PrerequisitePath", "t04CompatibilityPath"]) {
    if (source[key] !== undefined && typeof source[key] !== "string") {
      fail("OPTIONS_INVALID", `buildOptions.${key} must be a string.`);
    }
  }
  if (
    source.beforeAuthorityRecheck !== undefined &&
    (typeof source.beforeAuthorityRecheck !== "function" ||
      utilTypes.isProxy(source.beforeAuthorityRecheck))
  ) {
    fail("OPTIONS_INVALID", "buildOptions.beforeAuthorityRecheck must be a non-Proxy function.");
  }
  return Object.freeze({
    beforeAuthorityRecheck: source.beforeAuthorityRecheck,
    fileOverrides: captureFileOverrides(source.fileOverrides),
    t02PrerequisiteBytes:
      source.t02PrerequisiteBytes === undefined
        ? undefined
        : captureByteInput(source.t02PrerequisiteBytes, "buildOptions.t02PrerequisiteBytes"),
    t02PrerequisitePath: source.t02PrerequisitePath,
    t04CompatibilityBytes:
      source.t04CompatibilityBytes === undefined
        ? undefined
        : captureByteInput(source.t04CompatibilityBytes, "buildOptions.t04CompatibilityBytes"),
    t04CompatibilityPath: source.t04CompatibilityPath,
    runtime: captureRuntime(source.runtime),
  });
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

async function openCanonicalDirectory(directoryPath, label) {
  let handle;
  try {
    const canonical = await realpath(directoryPath);
    const named = await lstat(directoryPath);
    if (canonical !== directoryPath || !named.isDirectory() || named.isSymbolicLink()) {
      fail("FILESYSTEM_UNSAFE", `${label} is not one canonical named directory.`);
    }
    handle = await open(directoryPath, DIRECTORY_READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isDirectory() || !sameIdentity(named, opened)) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while opening.`);
    }
    return Object.freeze({ directoryPath, handle, label, opened });
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be opened safely.`, String(error));
  }
}

async function assertCanonicalDirectoryUnchanged(capture) {
  try {
    const [handleAfter, namedAfter, canonicalAfter] = await Promise.all([
      capture.handle.stat(),
      lstat(capture.directoryPath),
      realpath(capture.directoryPath),
    ]);
    if (
      !handleAfter.isDirectory() ||
      !sameIdentity(capture.opened, handleAfter) ||
      !namedAfter.isDirectory() ||
      namedAfter.isSymbolicLink() ||
      !sameIdentity(capture.opened, namedAfter) ||
      canonicalAfter !== capture.directoryPath
    ) {
      fail("FILESYSTEM_UNSAFE", `${capture.label} changed identity during the authority read.`);
    }
  } catch (error) {
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${capture.label} became unavailable during the authority read.`);
  }
}

async function readNoFollow(
  relativeOrAbsolutePath,
  label,
  maxBytes = MAX_AUTHORITY_BYTES,
  beforeAuthorityRecheck = undefined,
) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.join(WORKSPACE_ROOT, relativeOrAbsolutePath);
  const parent = path.dirname(absolutePath);
  let rootCapture;
  let parentCapture;
  let handle;
  try {
    rootCapture = await openCanonicalDirectory(WORKSPACE_ROOT, "Proof workspace root");
    parentCapture = await openCanonicalDirectory(parent, `${label} parent`);
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
    await beforeAuthorityRecheck?.(Object.freeze({ absolutePath, label }));
    const namedAfter = await lstat(absolutePath);
    if (
      bytes.byteLength !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mode !== before.mode ||
      after.nlink !== 1 ||
      !namedAfter.isFile() ||
      namedAfter.isSymbolicLink() ||
      namedAfter.nlink !== 1 ||
      !sameIdentity(opened, namedAfter) ||
      namedAfter.size !== opened.size
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while reading.`);
    }
    await assertCanonicalDirectoryUnchanged(parentCapture);
    await assertCanonicalDirectoryUnchanged(rootCapture);
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be read safely.`, String(error));
  } finally {
    await handle?.close().catch(() => undefined);
    await parentCapture?.handle.close().catch(() => undefined);
    await rootCapture?.handle.close().catch(() => undefined);
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
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`, String(error));
  }
}

async function trackedBytes(relativePath, options) {
  const live = await readNoFollow(
    relativePath,
    relativePath,
    MAX_AUTHORITY_BYTES,
    options.beforeAuthorityRecheck,
  );
  const override = options.fileOverrides.get(relativePath);
  if (override === undefined) return live;
  if (!override.equals(live)) fail("BOUNDARY_DRIFT", `${relativePath} mutation was rejected.`);
  return override;
}

function receipt(relativePath, bytes) {
  return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
}

function exactArray(actual, expected, code, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} drifted.`, { actual, expected });
  }
}

function staticModuleSpecifiers(source) {
  return [
    ...source.matchAll(/^\s*(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/gm),
  ].map((match) => match[1]);
}

function exportedNames(sourceText, fileName) {
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
  const names = [];
  let tsdocDeclarations = 0;
  for (const statement of sourceFile.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (
      !ts.isTypeAliasDeclaration(statement) &&
      !ts.isInterfaceDeclaration(statement) &&
      !ts.isFunctionDeclaration(statement)
    ) {
      continue;
    }
    const name = statement.name?.text;
    if (name !== undefined) names.push(name);
    const leading = sourceText.slice(statement.getFullStart(), statement.getStart(sourceFile));
    if (/\/\*\*[\s\S]*?\*\//u.test(leading)) tsdocDeclarations += 1;
  }
  return Object.freeze({ names: names.sort(compareText), tsdocDeclarations });
}

function reexportedNames(sourceText, fileName) {
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
  const runtime = [];
  const types = [];
  const modules = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail("SOURCE_DRIFT", `${fileName} may contain only explicit named re-exports.`);
    }
    modules.push(statement.moduleSpecifier.text);
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail("SOURCE_DRIFT", `${fileName} must not alias public exports.`);
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    runtime: Object.freeze(runtime.sort(compareText)),
    types: Object.freeze(types.sort(compareText)),
    modules: Object.freeze(modules.sort(compareText)),
  });
}

function testNames(source) {
  return [...source.matchAll(/^\s*(?:it|test)\(\s*["']([^"']+)["']/gm)].map((match) => match[1]);
}

function countTypeAssertions(source) {
  return [...source.matchAll(/@ts-expect-error/g)].length;
}

function verifyBoundary(files) {
  const manifest = parseJson(files.get(PACKAGE_PATH), PACKAGE_PATH);
  if (
    manifest.name !== "@desen/editor-core" ||
    manifest.private !== true ||
    manifest.type !== "module" ||
    manifest.sideEffects !== false ||
    JSON.stringify(manifest.files) !== JSON.stringify(["dist"]) ||
    JSON.stringify(manifest.exports) !==
      JSON.stringify({ ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } }) ||
    JSON.stringify(manifest.dependencies) !==
      JSON.stringify({ "@desen/protocol": "workspace:*", "@desen/validator": "workspace:*" }) ||
    manifest.scripts?.["test:state-binding-edits"] !== "vitest run test/state-binding-edits.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core manifest boundary drifted.");
  }

  const sourceText = decodeUtf8(
    files.get(STATE_BINDING_EDITS_SOURCE_PATH),
    STATE_BINDING_EDITS_SOURCE_PATH,
  );
  const sourceExports = exportedNames(sourceText, STATE_BINDING_EDITS_SOURCE_PATH);
  exactArray(
    sourceExports.names,
    EXPECTED_STATE_BINDING_EXPORTS,
    "SOURCE_DRIFT",
    "State/binding source exports",
  );
  if (sourceExports.tsdocDeclarations !== EXPECTED_STATE_BINDING_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public state-binding-edit declaration must retain TSDoc.");
  }
  for (const literal of ["8_388_608", "25_000", "maxSourceTreeDepth: 64"]) {
    if (!sourceText.includes(literal)) fail("LIMIT_DRIFT", `Missing fixed limit: ${literal}`);
  }
  for (const code of EXPECTED_DIAGNOSTIC_CODES) {
    if (!sourceText.includes(`"${code}"`)) fail("DIAGNOSTIC_DRIFT", `Missing code: ${code}`);
  }

  const sourceIndex = reexportedNames(
    decodeUtf8(files.get(INDEX_SOURCE_PATH), INDEX_SOURCE_PATH),
    INDEX_SOURCE_PATH,
  );
  exactArray(sourceIndex.runtime, EXPECTED_RUNTIME_EXPORTS, "SOURCE_DRIFT", "Runtime exports");
  exactArray(sourceIndex.types, EXPECTED_TYPE_EXPORTS, "SOURCE_DRIFT", "Type exports");
  exactArray(
    sourceIndex.modules,
    [
      "./content-edits.js",
      "./content-edits.js",
      "./source-document.js",
      "./source-document.js",
      "./stable-id-insert.js",
      "./stable-id-insert.js",
      "./state-binding-edits.js",
      "./state-binding-edits.js",
      "./structural-edits.js",
      "./structural-edits.js",
    ],
    "SOURCE_DRIFT",
    "Source index edges",
  );

  const distIndexPath = "packages/editor-core/dist/index.js";
  const distIndexDeclarationPath = "packages/editor-core/dist/index.d.ts";
  const distStateBindingPath = "packages/editor-core/dist/state-binding-edits.js";
  const distStateBindingDeclarationPath = "packages/editor-core/dist/state-binding-edits.d.ts";
  const distIndex = decodeUtf8(files.get(distIndexPath), distIndexPath);
  const emittedIndex = reexportedNames(distIndex, distIndexPath);
  const emittedIndexDeclaration = reexportedNames(
    decodeUtf8(files.get(distIndexDeclarationPath), distIndexDeclarationPath),
    distIndexDeclarationPath,
  );
  exactArray(emittedIndex.runtime, EXPECTED_RUNTIME_EXPORTS, "EMITTED_DRIFT", "Emitted exports");
  exactArray(
    emittedIndexDeclaration.runtime,
    EXPECTED_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Declaration runtime exports",
  );
  exactArray(
    emittedIndexDeclaration.types,
    EXPECTED_TYPE_EXPORTS,
    "EMITTED_DRIFT",
    "Declaration type exports",
  );
  const emittedStateBinding = exportedNames(
    decodeUtf8(files.get(distStateBindingDeclarationPath), distStateBindingDeclarationPath),
    distStateBindingDeclarationPath,
  );
  exactArray(
    emittedStateBinding.names,
    EXPECTED_STATE_BINDING_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted state/binding declarations",
  );
  if (emittedStateBinding.tsdocDeclarations !== EXPECTED_STATE_BINDING_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted state/binding declarations lost TSDoc.");
  }

  const emittedModules = [
    [
      distIndexPath,
      [
        "./source-document.js",
        "./stable-id-insert.js",
        "./structural-edits.js",
        "./content-edits.js",
        "./state-binding-edits.js",
      ],
    ],
    ["packages/editor-core/dist/source-document.js", ["@desen/validator"]],
    ["packages/editor-core/dist/stable-id-insert.js", ["@desen/protocol", "./source-document.js"]],
    ["packages/editor-core/dist/structural-edits.js", ["@desen/protocol", "./source-document.js"]],
    ["packages/editor-core/dist/content-edits.js", ["@desen/protocol", "./source-document.js"]],
    [distStateBindingPath, ["@desen/protocol", "./source-document.js"]],
  ];
  for (const [relativePath, expected] of emittedModules) {
    exactArray(
      staticModuleSpecifiers(decodeUtf8(files.get(relativePath), relativePath)),
      expected,
      "EMITTED_DRIFT",
      `${relativePath} static edges`,
    );
  }
  const emittedGraph = emittedModules
    .map(([relativePath]) => decodeUtf8(files.get(relativePath), relativePath))
    .join("\n");
  for (const forbidden of [
    /\bimport\s*\(/u,
    /\beval\s*\(/u,
    /\bReact(?:DOM)?\b/u,
    /\b(?:window|navigator|HTMLElement|customElements|MutationObserver|XMLHttpRequest|WebSocket)\b/u,
    /\b(?:globalThis\.)?document\s*\.\s*(?:body|head|createElement|querySelector|getElementById|addEventListener)\b/u,
  ]) {
    if (forbidden.test(emittedGraph)) {
      fail("PLATFORM_DRIFT", `Forbidden emitted authority: ${forbidden}`);
    }
  }

  const focusedTests = testNames(decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH));
  exactArray(
    focusedTests,
    EXPECTED_PACKAGE_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Focused behavior inventory",
  );
  const focusedTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PACKAGE_TYPES_PATH), PACKAGE_TYPES_PATH),
  );
  if (focusedTypeAssertions !== 14) {
    fail("TEST_INVENTORY_DRIFT", "Focused compiler-negative inventory must remain fourteen.");
  }
  const publicTests = testNames(decodeUtf8(files.get(PUBLIC_TEST_PATH), PUBLIC_TEST_PATH));
  exactArray(
    publicTests,
    EXPECTED_PUBLIC_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Public runtime/root inventory",
  );
  const publicTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PUBLIC_TYPES_PATH), PUBLIC_TYPES_PATH),
  );
  if (publicTypeAssertions !== 48) {
    fail("TEST_INVENTORY_DRIFT", "Public compiler-negative inventory must remain forty-eight.");
  }
  const rootTests = testNames(decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH));
  exactArray(
    rootTests,
    EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );

  return deepFreeze({
    runtimeExports: [...EXPECTED_RUNTIME_EXPORTS],
    typeExports: [...EXPECTED_TYPE_EXPORTS],
    stateBindingPublicDeclarations: EXPECTED_STATE_BINDING_EXPORTS.length,
    stateBindingTsdocDeclarations: sourceExports.tsdocDeclarations,
    emittedFiles: DIST_PATHS.length,
    staticEsmEdges: 14,
    unknownStaticEsmEdges: 0,
    platformNeutral: true,
    focusedBehaviorCases: EXPECTED_PACKAGE_TEST_NAMES.length,
    focusedCompilerNegativeAssertions: focusedTypeAssertions,
    publicRuntimeAndRootCases: EXPECTED_PUBLIC_TEST_NAMES.length,
    publicCompilerNegativeAssertions: publicTypeAssertions,
    rootProofCases: EDITOR_CORE_STATE_BINDING_EDITS_ROOT_TEST_NAMES.length,
  });
}

async function authenticatePrerequisites(options) {
  const [t02Pin] = EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS;
  const authorities = [
    {
      role: "prerequisite",
      pin: t02Pin,
      path: options.t02PrerequisitePath ?? T02_ARTIFACT_PATH,
      suppliedBytes: options.t02PrerequisiteBytes,
      expectedProofId: "editor-core-stable-id-insert",
      expectedProfile: "desen.editor-core.stable-id-insert-proof.v1",
      expectedFiles: 53,
      expectedRuntimeFiles: 25,
      expectedEditorFiles: 4,
      expectedPublicCases: 22,
      expectedPublicField: "publicRuntimeCases",
      expectedClaim: "immutableInsertCommand",
    },
    {
      role: "current-graph-compatibility",
      pin: EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN,
      path: options.t04CompatibilityPath ?? T04_ARTIFACT_PATH,
      suppliedBytes: options.t04CompatibilityBytes,
      expectedProofId: "editor-core-content-edits",
      expectedProfile: "desen.editor-core.content-edits-proof.v1",
      expectedFiles: 67,
      expectedRuntimeFiles: 27,
      expectedEditorFiles: 6,
      expectedPublicCases: 32,
      expectedPublicField: "publicRuntimeAndRootCases",
      expectedClaim: "immutableContentEditCommands",
    },
  ];
  const authenticated = [];
  for (const authority of authorities) {
    const bytes =
      authority.suppliedBytes ??
      (await readNoFollow(
        authority.path,
        `frozen ${authority.pin.task} ${authority.role}`,
        MAX_AUTHORITY_BYTES,
        options.beforeAuthorityRecheck,
      ));
    if (bytes.byteLength !== authority.pin.bytes || sha256(bytes) !== authority.pin.sha256) {
      fail(
        "PREREQUISITE_DRIFT",
        `The exact frozen ${authority.pin.task} artifact receipt did not match.`,
      );
    }
    const artifact = parseJson(bytes, `frozen ${authority.pin.task} ${authority.role}`);
    const receipts = artifact.trackedBoundary?.receipts;
    if (
      artifact.schemaVersion !== 1 ||
      artifact.proofId !== authority.expectedProofId ||
      artifact.profile !== authority.expectedProfile ||
      artifact.task !== authority.pin.task ||
      artifact.result !== "PASS" ||
      artifact.claim?.taskStatus !== "DONE" ||
      artifact.claim?.[authority.expectedClaim] !== true ||
      artifact.trackedBoundary?.files !== authority.expectedFiles ||
      !Array.isArray(receipts) ||
      receipts.length !== authority.expectedFiles ||
      new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
      artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
      artifact.executionAuthority?.runtimeFiles !== authority.expectedRuntimeFiles ||
      artifact.executionAuthority?.editorFiles !== authority.expectedEditorFiles ||
      artifact.executionAuthority?.dependencyFiles !== 21 ||
      artifact.testAuthority?.focusedBehaviorCases !== 16 ||
      artifact.testAuthority?.[authority.expectedPublicField] !== authority.expectedPublicCases ||
      artifact.testAuthority?.rootProofCases !== 10
    ) {
      fail(
        "PREREQUISITE_DRIFT",
        `The frozen ${authority.pin.task} artifact is not its reviewed PASS profile.`,
      );
    }
    authenticated.push(deepFreeze(artifact));
  }
  const t04Artifact = authenticated[1];
  const embeddedChain = t04Artifact.prerequisites;
  const expectedChain = [t02Pin, EMBEDDED_T03_CHAIN_PIN];
  if (!Array.isArray(embeddedChain) || embeddedChain.length !== expectedChain.length) {
    fail("PREREQUISITE_DRIFT", "M08-T04 no longer exposes its exact embedded predecessor chain.");
  }
  for (let index = 0; index < expectedChain.length; index += 1) {
    const actual = embeddedChain[index];
    const expected = expectedChain[index];
    if (
      actual?.task !== expected.task ||
      actual?.path !== expected.path ||
      actual?.bytes !== expected.bytes ||
      actual?.sha256 !== expected.sha256 ||
      actual?.result !== "PASS" ||
      actual?.authentication !== "DIRECT_NO_FOLLOW_EXACT_BYTES" ||
      actual?.liveProofReaderInput !== false ||
      actual?.checkpointHeadInput !== false
    ) {
      fail("PREREQUISITE_DRIFT", `M08-T04 embedded chain entry ${index} drifted.`);
    }
  }
  if (
    options.t02PrerequisiteBytes !== undefined ||
    options.t02PrerequisitePath !== undefined ||
    options.t04CompatibilityBytes !== undefined ||
    options.t04CompatibilityPath !== undefined
  ) {
    fail(
      "PREREQUISITE_OVERRIDE_REJECTED",
      "Caller-supplied prerequisite or compatibility bytes cannot issue PASS.",
    );
  }
  return Object.freeze({
    t02Artifact: authenticated[0],
    t04Artifact,
    evidence: deepFreeze(
      EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS.map((pin) => ({
        ...pin,
        result: "PASS",
        authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
        liveProofReaderInput: false,
        checkpointHeadInput: false,
      })),
    ),
    currentGraphCompatibility: deepFreeze({
      ...EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      embeddedPrerequisiteChain: expectedChain.map((pin) => ({
        task: pin.task,
        path: pin.path,
        bytes: pin.bytes,
        sha256: pin.sha256,
      })),
      widensOfficialPrerequisites: false,
    }),
  });
}

function prerequisiteReceipt(prerequisite, relativePath, collection) {
  const candidates = prerequisite.executionAuthority?.[collection];
  const matches = Array.isArray(candidates)
    ? candidates.filter((candidate) => candidate?.path === relativePath)
    : [];
  if (matches.length !== 1) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Missing predecessor receipt: ${relativePath}`);
  }
  const candidate = matches[0];
  if (
    JSON.stringify(Reflect.ownKeys(candidate)) !== JSON.stringify(["path", "bytes", "sha256"]) ||
    !Number.isSafeInteger(candidate.bytes) ||
    candidate.bytes < 0 ||
    typeof candidate.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidate.sha256)
  ) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Malformed predecessor receipt: ${relativePath}`);
  }
  return candidate;
}

function assertRetainedT04Receipts(prerequisite, files) {
  const receipts = new Map(
    prerequisite.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T04_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T04 receipt drifted: ${relativePath}`);
    }
  }
}

function authenticateRuntimeClosure(
  compatibilityArtifact,
  prerequisiteEvidence,
  compatibilityEvidence,
  files,
) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(
      compatibilityArtifact,
      relativePath,
      "dependencyReceipts",
    );
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Dependency byte drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  for (const relativePath of RETAINED_EDITOR_RUNTIME_PATHS) {
    const authority = prerequisiteReceipt(compatibilityArtifact, relativePath, "editorReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Retained editor runtime drifted: ${relativePath}`);
    }
  }
  const editorReceipts = CURRENT_EDITOR_RUNTIME_PATHS.map((relativePath) =>
    receipt(relativePath, files.get(relativePath)),
  ).sort((left, right) => compareText(left.path, right.path));
  return deepFreeze({
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: ISOLATED_RUNTIME_PATHS.length,
    editorFiles: editorReceipts.length,
    retainedPredecessorEditorFiles: RETAINED_EDITOR_RUNTIME_PATHS.length,
    dependencyFiles: dependencyReceipts.length,
    dependencyModules: PROTOCOL_RUNTIME_PATHS.length + VALIDATOR_RUNTIME_PATHS.length,
    dependencyManifests: 2,
    prerequisites: prerequisiteEvidence.map(({ task, path: artifactPath, sha256: digest }) => ({
      task,
      path: artifactPath,
      sha256: digest,
    })),
    currentGraphCompatibility: {
      task: compatibilityEvidence.task,
      path: compatibilityEvidence.path,
      sha256: compatibilityEvidence.sha256,
      widensOfficialPrerequisites: false,
    },
    editorReceipts,
    dependencyReceipts,
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

async function importReceiptedRuntime(files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t05-runtime-"));
  try {
    const copies = ISOLATED_RUNTIME_PATHS.map((relativePath) => ({
      bytes: files.get(relativePath),
      destination: isolatedDestination(directory, relativePath),
    }));
    const entryPath = path.join(directory, "entry.mjs");
    copies.push({
      bytes: Buffer.from(
        [
          'import * as editorCore from "@desen/editor-core";',
          'import { canonicalizeJsonBytes } from "@desen/protocol";',
          "export { canonicalizeJsonBytes, editorCore };",
          "",
        ].join("\n"),
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
      EXPECTED_RUNTIME_EXPORTS,
      "PUBLIC_API_DRIFT",
      "Isolated runtime exports",
    );
    if (typeof imported.canonicalizeJsonBytes !== "function") {
      fail("PUBLIC_API_DRIFT", "The isolated runtime lost canonical byte authority.");
    }
    return Object.freeze({
      canonicalizeJsonBytes: imported.canonicalizeJsonBytes,
      editorCore: Object.freeze(
        Object.fromEntries(
          EXPECTED_RUNTIME_EXPORTS.map((name) => [name, imported.editorCore[name]]),
        ),
      ),
    });
  } catch (error) {
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      "The exact receipted editor runtime graph could not be imported in isolation.",
      String(error),
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function createDocument(runtime, validSource, input = clone(validSource)) {
  const result = runtime.createDesenEditorDocument(input);
  if (!result?.ok) fail("BEHAVIOR_DRIFT", "The isolated runtime rejected a valid Source fixture.");
  return result.document;
}

function expectSuccess(result, label) {
  if (!result?.ok || result.diagnostics?.length !== 0 || !Object.hasOwn(result, "document")) {
    fail("BEHAVIOR_DRIFT", `${label} did not return an exact success.`);
  }
  assertDeepFrozen(result, label);
  return result;
}

function expectFailure(result, code, label) {
  if (
    result?.ok !== false ||
    result.diagnostics?.[0]?.code !== code ||
    Object.hasOwn(result, "document")
  ) {
    fail("BEHAVIOR_DRIFT", `${label} did not fail atomically with ${code}.`);
  }
  assertDeepFrozen(result, label);
  return result;
}

function surfaceIdentities(editorDocument, surfaceId = "sign-in") {
  const surface = editorDocument.surfaces[surfaceId];
  const identities = [];
  const pending = [{ kind: "node", value: surface.root }];
  while (pending.length > 0) {
    const owner = pending.pop();
    identities.push(owner.value.id);
    for (const children of Object.values(owner.value.slots ?? {})) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ kind: "node", value: children[index] });
      }
    }
    if (owner.kind === "node") {
      for (let index = (owner.value.behaviors?.length ?? 0) - 1; index >= 0; index -= 1) {
        pending.push({ kind: "behavior", value: owner.value.behaviors[index] });
      }
    }
  }
  return identities.sort(compareText);
}

function sourceWithTreeDepth(validSource, depth) {
  const input = clone(validSource);
  const root = input.surfaces["sign-in"].root;
  let parent = root;
  for (let index = 1; index <= depth; index += 1) {
    const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
    parent.slots = { default: [child] };
    parent = child;
  }
  return { input, ownerId: parent.id };
}

function sourceWithIdentityCount(validSource, count) {
  const input = clone(validSource);
  input.surfaces["sign-in"].root.behaviors = Array.from({ length: count - 6 }, (_, index) => ({
    id: `identity.behavior.${index}`,
    use: "com.example.interactions/Preview",
  }));
  return input;
}

function sizedSource(validSource, canonicalizeJsonBytes, extraBytes) {
  const input = clone(validSource);
  input.surfaces["sign-in"].root.slots.default[0].props.x = false;
  input.authoring = { padding: "" };
  const baseLength = canonicalizeJsonBytes(input).byteLength;
  input.authoring.padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
  return input;
}

function behaviorFixture(validSource) {
  const input = clone(validSource);
  const surface = input.surfaces["sign-in"];
  surface.resources.data = {
    use: "com.example.data/List",
    input: {},
    policy: "manual",
    extensions: { "com.example.resource": { retained: true } },
  };
  surface.root.slots.default[0].repeat = {
    items: { $ref: "resource.data.value", fallback: [] },
    as: "row",
    key: { $ref: "item.row.id" },
    limit: 10,
    extensions: { "com.example.repeat": { retained: true } },
  };
  return input;
}

function verifyBehavior(runtime, validSource, canonicalizeJsonBytes) {
  for (const name of ["createDesenEditorDocument", ...STATE_BINDING_RUNTIME_EXPORTS]) {
    if (typeof runtime?.[name] !== "function") {
      fail("BEHAVIOR_DRIFT", "The isolated runtime lost " + name + ".");
    }
  }

  const baseline = createDocument(runtime, validSource, behaviorFixture(validSource));
  const baselineBytes = Buffer.from(canonicalizeJsonBytes(baseline));
  const baselineIds = surfaceIdentities(baseline);
  const executed = [];
  let currentDocument = baseline;

  function execute(name, command, label = name) {
    const previous = currentDocument;
    const result = expectSuccess(runtime[name](previous, command), label);
    if (result.document === previous || result.document.surfaces === previous.surfaces) {
      fail("BEHAVIOR_DRIFT", label + " did not return a fresh detached Source.");
    }
    executed.push(name);
    currentDocument = result.document;
    return result.document;
  }

  const declaration = {
    schema: {
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
    },
    initial: { value: "original" },
    extensions: { "com.example.state": { retained: true } },
  };
  execute("insertDesenEditorStateDeclaration", {
    surfaceId: "sign-in",
    name: "profile.name",
    declaration,
  });
  declaration.initial.value = "caller-mutated";
  if (currentDocument.surfaces["sign-in"].state["profile.name"].initial.value !== "original") {
    fail("BEHAVIOR_DRIFT", "Inserted state declaration retained caller authority.");
  }

  execute("setDesenEditorStateSchema", {
    surfaceId: "sign-in",
    name: "email",
    schema: { type: "number", minimum: 0 },
  });
  const markerInitial = { $ref: "state.password", fallback: { nested: true } };
  execute("setDesenEditorStateInitial", {
    surfaceId: "sign-in",
    name: "email",
    initial: markerInitial,
  });
  markerInitial.fallback.nested = false;
  if (currentDocument.surfaces["sign-in"].state.email.initial.fallback.nested !== true) {
    fail("BEHAVIOR_DRIFT", "State initial data was retained or interpreted as a binding.");
  }

  execute("setDesenEditorNodeRepeatItems", {
    surfaceId: "sign-in",
    nodeId: "sign-in.title",
    items: { $ref: "resource.data.value", fallback: [{ id: "fallback" }] },
  });
  execute("setDesenEditorNodeRepeatKey", {
    surfaceId: "sign-in",
    nodeId: "sign-in.title",
    key: { $ref: "item.row.slug", fallback: 0 },
  });
  execute("setDesenEditorResourceInput", {
    surfaceId: "sign-in",
    resourceId: "data",
    name: "__proto__",
    value: { $ref: "state.password", fallback: ["safe"] },
  });
  const resourceInput = currentDocument.surfaces["sign-in"].resources.data.input;
  if (
    !Object.hasOwn(resourceInput, "__proto__") ||
    resourceInput.__proto__.fallback[0] !== "safe"
  ) {
    fail("BEHAVIOR_DRIFT", "Prototype-sensitive resource input was not exact own data.");
  }
  execute("deleteDesenEditorResourceInput", {
    surfaceId: "sign-in",
    resourceId: "data",
    name: "__proto__",
  });
  execute("deleteDesenEditorStateDeclaration", {
    surfaceId: "sign-in",
    name: "email",
  });

  exactArray(
    executed.slice().sort(compareText),
    STATE_BINDING_RUNTIME_EXPORTS,
    "BEHAVIOR_DRIFT",
    "Executed state/binding commands",
  );
  exactArray(
    surfaceIdentities(currentDocument),
    baselineIds,
    "BEHAVIOR_DRIFT",
    "Stable identities",
  );
  const finalSurface = currentDocument.surfaces["sign-in"];
  const repeat = finalSurface.root.slots.default[0].repeat;
  if (
    repeat.as !== "row" ||
    repeat.limit !== 10 ||
    repeat.extensions["com.example.repeat"].retained !== true ||
    Reflect.ownKeys(finalSurface.resources.data.input).length !== 0 ||
    finalSurface.root.slots.default[1].props.value.$ref !== "state.email"
  ) {
    fail("BEHAVIOR_DRIFT", "State/binding edits widened their exact lifecycle boundary.");
  }

  const deterministicCommand = {
    surfaceId: "sign-in",
    nodeId: "sign-in.title",
    key: { $ref: "item.row.key", fallback: "missing" },
  };
  const deterministicFirst = expectSuccess(
    runtime.setDesenEditorNodeRepeatKey(baseline, deterministicCommand),
    "deterministic state/binding edit",
  );
  const deterministicSecond = expectSuccess(
    runtime.setDesenEditorNodeRepeatKey(baseline, clone(deterministicCommand)),
    "repeated deterministic state/binding edit",
  );
  if (
    !Buffer.from(canonicalizeJsonBytes(deterministicFirst.document)).equals(
      Buffer.from(canonicalizeJsonBytes(deterministicSecond.document)),
    ) ||
    deterministicFirst.document === deterministicSecond.document
  ) {
    fail("BEHAVIOR_DRIFT", "Equal commands are not deterministic fresh snapshots.");
  }

  expectFailure(
    runtime.insertDesenEditorStateDeclaration(baseline, {
      surfaceId: "sign-in",
      name: "email",
      declaration: { schema: { type: "string" }, initial: "" },
    }),
    "run.desen.editor/STATE_BINDING_EDIT_TARGET_EXISTS",
    "existing state declaration",
  );
  expectFailure(
    runtime.deleteDesenEditorResourceInput(baseline, {
      surfaceId: "sign-in",
      resourceId: "data",
      name: "missing",
    }),
    "run.desen.editor/STATE_BINDING_EDIT_PATH_NOT_FOUND",
    "missing resource-input path",
  );
  expectFailure(
    runtime.setDesenEditorResourceInput(baseline, {
      surfaceId: "sign-in",
      resourceId: "missing",
      name: "value",
      value: true,
    }),
    "run.desen.editor/STATE_BINDING_EDIT_TARGET_NOT_FOUND",
    "missing resource target",
  );

  const ambiguousInput = behaviorFixture(validSource);
  ambiguousInput.surfaces["sign-in"].root.behaviors = [
    { id: "sign-in.title", use: "com.example.interactions/Duplicate" },
  ];
  expectFailure(
    runtime.setDesenEditorNodeRepeatItems(createDocument(runtime, validSource, ambiguousInput), {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      items: [],
    }),
    "run.desen.editor/STATE_BINDING_EDIT_TARGET_AMBIGUOUS",
    "ambiguous repeat target",
  );
  expectFailure(
    runtime.setDesenEditorNodeRepeatItems(baseline, {
      surfaceId: "sign-in",
      nodeId: "sign-in.title",
      items: { $ref: "unknown.value" },
    }),
    "SCHEMA_INVALID",
    "structural diagnostic pass-through",
  );

  let getterInvoked = false;
  let toJsonInvoked = false;
  const accessorCommand = { surfaceId: "sign-in", name: "email" };
  Object.defineProperty(accessorCommand, "initial", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return "active";
    },
  });
  expectFailure(
    runtime.setDesenEditorStateInitial(baseline, accessorCommand),
    "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID",
    "accessor command",
  );
  expectFailure(
    runtime.setDesenEditorStateInitial(baseline, {
      surfaceId: "sign-in",
      name: "email",
      initial: {
        inert: true,
        toJSON() {
          toJsonInvoked = true;
          return { serialized: "authority" };
        },
      },
    }),
    "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID",
    "toJSON command value",
  );
  if (getterInvoked || toJsonInvoked) {
    fail("BEHAVIOR_DRIFT", "Command capture invoked an accessor or toJSON hook.");
  }

  const forwardingTraps = [];
  const forwardingTarget = {
    surfaceId: "sign-in",
    resourceId: "data",
    name: "forwarded",
    value: { $ref: "state.email" },
  };
  const forwardingProxy = new Proxy(forwardingTarget, {
    getOwnPropertyDescriptor(target, key) {
      forwardingTraps.push("getOwnPropertyDescriptor:" + String(key));
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    getPrototypeOf(target) {
      forwardingTraps.push("getPrototypeOf");
      return Reflect.getPrototypeOf(target);
    },
    ownKeys(target) {
      forwardingTraps.push("ownKeys");
      return Reflect.ownKeys(target);
    },
  });
  const forwarded = expectSuccess(
    runtime.setDesenEditorResourceInput(baseline, forwardingProxy),
    "forwarding Proxy command",
  );
  if (
    forwarded.document.surfaces["sign-in"].resources.data.input.forwarded.$ref !== "state.email"
  ) {
    fail("BEHAVIOR_DRIFT", "A forwarding Proxy no longer exposes admissible own data.");
  }
  const expectedForwardingTraps = [
    "getPrototypeOf",
    "ownKeys",
    "getOwnPropertyDescriptor:name",
    "getOwnPropertyDescriptor:resourceId",
    "getOwnPropertyDescriptor:surfaceId",
    "getOwnPropertyDescriptor:value",
  ];
  exactArray(
    forwardingTraps,
    expectedForwardingTraps,
    "BEHAVIOR_DRIFT",
    "Forwarding Proxy reflection traps",
  );

  const throwingTraps = [];
  const throwingProxy = new Proxy(forwardingTarget, {
    getPrototypeOf() {
      throwingTraps.push("getPrototypeOf");
      throw new TypeError("controlled Proxy reflection failure");
    },
  });
  expectFailure(
    runtime.setDesenEditorResourceInput(baseline, throwingProxy),
    "run.desen.editor/STATE_BINDING_EDIT_COMMAND_INVALID",
    "throwing Proxy command",
  );
  const expectedThrowingTraps = ["getPrototypeOf"];
  exactArray(
    throwingTraps,
    expectedThrowingTraps,
    "BEHAVIOR_DRIFT",
    "Throwing Proxy reflection traps",
  );

  const exactDepth = sourceWithTreeDepth(validSource, 64);
  expectSuccess(
    runtime.setDesenEditorStateInitial(createDocument(runtime, validSource, exactDepth.input), {
      surfaceId: "sign-in",
      name: "email",
      initial: "",
    }),
    "exact depth ceiling",
  );
  const crossingDepth = sourceWithTreeDepth(validSource, 65);
  expectFailure(
    runtime.setDesenEditorStateInitial(createDocument(runtime, validSource, crossingDepth.input), {
      surfaceId: "sign-in",
      name: "email",
      initial: "",
    }),
    "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
    "depth crossing",
  );

  expectSuccess(
    runtime.setDesenEditorStateInitial(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 25_000)),
      { surfaceId: "sign-in", name: "email", initial: "" },
    ),
    "exact identity ceiling",
  );
  expectFailure(
    runtime.setDesenEditorStateInitial(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 25_001)),
      { surfaceId: "sign-in", name: "email", initial: "" },
    ),
    "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
    "identity crossing",
  );

  const exactByteDocument = createDocument(
    runtime,
    validSource,
    sizedSource(validSource, canonicalizeJsonBytes, 0),
  );
  if (canonicalizeJsonBytes(exactByteDocument).byteLength !== DOCUMENT_LIMIT) {
    fail("BEHAVIOR_DRIFT", "The exact canonical byte fixture is not 8 MiB.");
  }
  expectSuccess(
    runtime.setDesenEditorStateInitial(exactByteDocument, {
      surfaceId: "sign-in",
      name: "email",
      initial: "",
    }),
    "exact canonical-byte ceiling",
  );
  expectFailure(
    runtime.setDesenEditorStateInitial(
      createDocument(runtime, validSource, sizedSource(validSource, canonicalizeJsonBytes, 1)),
      { surfaceId: "sign-in", name: "email", initial: "" },
    ),
    "run.desen.editor/STATE_BINDING_EDIT_LIMIT_EXCEEDED",
    "canonical-byte crossing",
  );

  if (
    !Buffer.from(canonicalizeJsonBytes(baseline)).equals(baselineBytes) ||
    Object.prototype.constructor !== Object
  ) {
    fail("BEHAVIOR_DRIFT", "A state/binding failure mutated the current Source.");
  }

  return deepFreeze({
    commands: {
      functions: [...STATE_BINDING_RUNTIME_EXPORTS],
      executed: STATE_BINDING_RUNTIME_EXPORTS.length,
      stateDeclarationLifecycle: true,
      repeatItemsAndKey: true,
      resourceInputSetAndDelete: true,
    },
    stateAndBindings: {
      dottedDeclarationsRemainData: true,
      initialMarkerShapesRemainInert: true,
      noReferenceOrActionCascade: true,
      repeatAliasLimitAndExtensionsPreserved: true,
      emptyRequiredMapsRetained: true,
      unresolvedSemanticsPreservedForM08T09: true,
    },
    identityAndData: {
      stableIdsUnchanged: true,
      identities: baselineIds,
      prototypeSensitiveNamesAreOwnData: true,
      callerInputsDetached: true,
    },
    limits: {
      canonicalDocumentBytes: DOCUMENT_LIMIT,
      identitiesPerTargetSurface: 25_000,
      sourceTreeDepth: 64,
      rootDepth: 0,
      exactCeilingsPass: true,
      oneUnitCrossingsFail: true,
    },
    diagnostics: {
      editorCodes: [...EXPECTED_DIAGNOSTIC_CODES],
      structuralPassThrough: "SCHEMA_INVALID",
      missingExistingAmbiguousAndPathFailClosed: true,
      commandShapeBoundary: "OWN_ENUMERABLE_DATA_DESCRIPTORS",
      accessorAndToJsonHooksRejectedWithoutInvocation: true,
      proxyReflectionMayInvokeTraps: true,
      forwardingProxyAdmitted: true,
      forwardingProxyTrapOrder: expectedForwardingTraps,
      throwingProxyContainedAsCommandInvalid: true,
      throwingProxyTrapOrder: expectedThrowingTraps,
      throwingProxyFailureLeavesPriorSourceUnchanged: true,
      failuresExposeNoDocument: true,
    },
    immutability: {
      inputDocumentsUnchanged: true,
      commandsNotRetained: true,
      freshDetachedSuccess: true,
      recursivelyFrozenResults: true,
      atomicFailure: true,
    },
  });
}

async function artifactBytes(artifact) {
  return Buffer.from(await format(`${JSON.stringify(artifact)}\n`, { parser: "json" }), "utf8");
}

export async function buildEditorCoreStateBindingEditsEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const authenticatedPrerequisites = await authenticatePrerequisites(options);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const boundary = verifyBoundary(files);
  assertRetainedT04Receipts(authenticatedPrerequisites.t04Artifact, files);
  const executionAuthority = authenticateRuntimeClosure(
    authenticatedPrerequisites.t04Artifact,
    authenticatedPrerequisites.evidence,
    authenticatedPrerequisites.currentGraphCompatibility,
    files,
  );
  const isolatedRuntime = await importReceiptedRuntime(files);
  const validSource = parseJson(files.get(FIXTURE_PATH), FIXTURE_PATH);
  const behavior = verifyBehavior(
    isolatedRuntime.editorCore,
    validSource,
    isolatedRuntime.canonicalizeJsonBytes,
  );
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue state-binding-edit evidence.");
  }
  if (options.beforeAuthorityRecheck !== undefined) {
    fail(
      "AUTHORITY_HOOK_REJECTED",
      "A caller-supplied authority-read hook cannot issue state-binding-edit evidence.",
    );
  }
  const receipts = [...files.entries()]
    .map(([relativePath, bytes]) => receipt(relativePath, bytes))
    .sort((left, right) => compareText(left.path, right.path));
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-state-binding-edits",
    profile: "desen.editor-core.state-binding-edits-proof.v1",
    task: "M08-T05",
    result: "PASS",
    prerequisites: authenticatedPrerequisites.evidence,
    currentGraphCompatibility: authenticatedPrerequisites.currentGraphCompatibility,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      immutableStateBindingEditCommands: true,
      stableIdentityPreserved: true,
      taskStatus: "DONE",
      prerequisiteTasks: ["M08-T02"],
      prerequisiteStatuses: ["DONE"],
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      stateBindingPublicDeclarations: boundary.stateBindingPublicDeclarations,
      stateBindingTsdocDeclarations: boundary.stateBindingTsdocDeclarations,
    },
    behavior,
    executionAuthority,
    packageBoundary: {
      currentEmittedFiles: boundary.emittedFiles,
      staticEsmEdges: boundary.staticEsmEdges,
      unknownStaticEsmEdges: boundary.unknownStaticEsmEdges,
      platformNeutral: boundary.platformNeutral,
      manifestExportRoots: ["."],
      productionDependencies: ["@desen/protocol", "@desen/validator"],
    },
    testAuthority: {
      focusedBehaviorCases: boundary.focusedBehaviorCases,
      focusedCompilerNegativeAssertions: boundary.focusedCompilerNegativeAssertions,
      publicRuntimeAndRootCases: boundary.publicRuntimeAndRootCases,
      publicCompilerNegativeAssertions: boundary.publicCompilerNegativeAssertions,
      rootProofCases: boundary.rootProofCases,
    },
    trackedBoundary: { files: receipts.length, receipts },
    nonclaims: [
      "EVENT_AND_CLOSED_ACTION_EDITING_M08_T06",
      "AUTHORING_ISOLATION_AND_UNKNOWN_EXTENSION_PROOF_M08_T07",
      "PERSISTENCE_M08_T08",
      "STATE_SCHEMA_INITIAL_REFERENCE_REPEAT_AND_CATALOG_SEMANTICS_M08_T09",
      "UNDO_REDO_SELECTION_AND_VIEWPORT_POLICY",
      "M08-T10_AND_G08_TERMINAL_UI_BOUNDARY",
      "HOSTILE_JAVASCRIPT_SANDBOX",
      "NO_PROXY_TRAP_EXECUTION_MEMBRANE",
      "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
      "STREAMING_OR_PREALLOCATION_MEMORY_DOS_BOUND",
      "P18_OR_G08_ADVANCEMENT",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:state-binding-edits",
      "pnpm --filter @desen/editor-core test:public-package",
      "node scripts/generate-editor-core-state-binding-edits-proof.mjs",
      "node scripts/verify-editor-core-state-binding-edits.mjs",
      "node --test tests/editor-core-state-binding-edits.test.mjs",
    ],
  });
  const bytes = await artifactBytes(artifact);
  return deepFreeze({
    artifact,
    artifactBytes: bytes,
    artifactSha256: sha256(bytes),
    task: "M08-T05",
  });
}

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

function visibleHtmlSegments(line, containers) {
  const voidElements = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);
  const tagPattern = /<\s*(\/?)\s*([A-Za-z][\w:-]*)([^>]*)>/gu;
  let cursor = 0;
  let visible = "";
  let excluded = "";
  for (const match of line.matchAll(tagPattern)) {
    if (containers.length === 0) visible += line.slice(cursor, match.index);
    else excluded += line.slice(cursor, match.index);
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const attributes = match[3];
    if (closing) {
      const matchingIndex = containers.findLastIndex((container) => container.name === name);
      if (matchingIndex >= 0) containers.splice(matchingIndex);
    } else if (!attributes.trimEnd().endsWith("/") && !voidElements.has(name)) {
      containers.push({ name });
    }
    cursor = match.index + match[0].length;
  }
  if (containers.length === 0) visible += line.slice(cursor);
  else excluded += line.slice(cursor);
  return { visible, excluded };
}

function visibleProofDocumentLines(document) {
  const visible = [];
  const htmlAuthority = [];
  const rawAuthority = [];
  let fence;
  let insideComment = false;
  const htmlContainers = [];
  for (const rawLine of document.split(/\r?\n/u)) {
    if (fence !== undefined) {
      const fenceMatch = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (
        fenceMatch !== null &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    let remainder = rawLine;
    let line = "";
    while (remainder.length > 0) {
      if (insideComment) {
        const commentEnd = remainder.indexOf("-->");
        if (commentEnd < 0) {
          remainder = "";
        } else {
          insideComment = false;
          remainder = remainder.slice(commentEnd + 3);
        }
        continue;
      }
      const commentStart = remainder.indexOf("<!--");
      if (commentStart < 0) {
        line += remainder;
        remainder = "";
      } else {
        line += remainder.slice(0, commentStart);
        insideComment = true;
        remainder = remainder.slice(commentStart + 4);
      }
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const htmlSegments = visibleHtmlSegments(line, htmlContainers);
    const htmlVisibleLine = htmlSegments.visible;
    if (htmlSegments.excluded.trim() !== "") htmlAuthority.push(htmlSegments.excluded);
    const fenceMatch = htmlVisibleLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (fenceMatch !== null) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    rawAuthority.push(line);
    visible.push(htmlVisibleLine.trimEnd());
  }
  return {
    visible,
    htmlAuthority,
    rawHtml: /<\s*\/?\s*[A-Za-z][\s\S]*?>/u.test(rawAuthority.join("\n")),
  };
}

function proofDocumentHasContradictoryStatus(visibleLines) {
  for (const line of visibleLines) {
    const normalized = line
      .replace(/\\([`*_~])/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const field = normalized.match(/\b(?:result|status)\s*:\s*(.*)$/iu);
    if (field === null) continue;
    const value = field[1].trim();
    if (
      !/^(?:PASS|DONE)\b/iu.test(value) ||
      /\b(?:BLOCKED|ERROR|FAIL(?:ED|URE)?|INCOMPLETE|IN[ _-]?PROGRESS|NOT[ _-]?STARTED|PENDING|SKIPPED|TODO|UNKNOWN)\b/iu.test(
        value,
      )
    ) {
      return true;
    }
  }
  return false;
}

export async function verifyEditorCoreStateBindingEditsEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCoreStateBindingEditsEvidence(options.buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T05 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T05 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T05 proof document",
    ));
  const proof = decodeUtf8(proofBytes, "M08-T05 proof document");
  const exactPin = `Final artifact: \`sha256:${built.artifactSha256}\``;
  const { visible: visibleLines, htmlAuthority, rawHtml } = visibleProofDocumentLines(proof);
  const visiblePinLines = visibleLines.filter((line) => line.startsWith("Final artifact:"));
  if (
    visiblePinLines.length !== 1 ||
    visiblePinLines[0] !== exactPin ||
    rawHtml ||
    proofDocumentHasContradictoryStatus([...visibleLines, ...htmlAuthority]) ||
    visibleLines.join("\n").includes("sha256:PENDING")
  ) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisiteSha256: EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS[0].sha256,
    prerequisiteSha256s: EDITOR_CORE_STATE_BINDING_EDITS_PREREQUISITE_PINS.map(
      (prerequisite) => prerequisite.sha256,
    ),
    currentGraphCompatibilitySha256:
      EDITOR_CORE_STATE_BINDING_EDITS_CURRENT_GRAPH_COMPATIBILITY_PIN.sha256,
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
    if (error instanceof EditorCoreStateBindingEditsProofError) throw error;
    if (error?.code !== "ENOENT") {
      fail("FILESYSTEM_UNSAFE", "Artifact destination cannot be inspected.", String(error));
    }
  }
  return absolutePath;
}

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

export async function writeEditorCoreStateBindingEditsEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreStateBindingEditsEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_STATE_BINDING_EDITS_ARTIFACT_PATH,
  );
  await writeAtomicProofArtifact({
    artifactPath: destinationPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  const committed = await readNoFollow(destinationPath, "committed M08-T05 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T05 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
