import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rm, writeFile } from "node:fs/promises";
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
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-stable-id-insert.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-STABLE-ID-INSERT.md";
const T01_ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const INSERT_SOURCE_PATH = "packages/editor-core/src/stable-id-insert.ts";
const INDEX_SOURCE_PATH = "packages/editor-core/src/index.ts";
const STRUCTURAL_EDITS_SOURCE_PATH = "packages/editor-core/src/structural-edits.ts";
const CONTENT_EDITS_SOURCE_PATH = "packages/editor-core/src/content-edits.ts";
const PACKAGE_PATH = "packages/editor-core/package.json";
const PACKAGE_TEST_PATH = "packages/editor-core/test/stable-id-insert.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/stable-id-insert.types.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const ROOT_TEST_PATH = "tests/editor-core-stable-id-insert.test.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-stable-id-insert-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-stable-id-insert-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-stable-id-insert.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const DOCUMENT_LIMIT = 8_388_608;
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 19_561,
  sha256: "edc7dc1df296056be0c281ed268d07565b0eca2eed7ba7ba63e69ae6b74f6547",
});
const RETAINED_EDITOR_RUNTIME_PATHS = Object.freeze([
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/stable-id-insert.js",
]);
const STRUCTURAL_EDITS_DIST_PATHS = Object.freeze([
  "packages/editor-core/dist/structural-edits.d.ts",
  "packages/editor-core/dist/structural-edits.js",
]);
const CONTENT_EDITS_DIST_PATHS = Object.freeze([
  "packages/editor-core/dist/content-edits.d.ts",
  "packages/editor-core/dist/content-edits.js",
]);
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
  ...RETAINED_EDITOR_RUNTIME_PATHS,
  ...DEPENDENCY_RUNTIME_PATHS,
]);

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_VIEW_INTRINSICS = Object.freeze({
  buffer: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get,
  byteLength: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength")?.get,
  byteOffset: Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteOffset")?.get,
});

export const EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN = Object.freeze({
  task: "M08-T01",
  path: T01_ARTIFACT_PATH,
  bytes: 23_270,
  sha256: "aaa3a2447b71361361f471a822bba78e90a3f97f493b23ad3314f51c62ad4025",
});

export const EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M08-T01 artifact without a live reader input",
  "[determinism] two fresh M08-T02 builds are byte-identical",
  "[behavior] proves allocation, ordering, node and behavior targets, limits, and atomic failures",
  "[mutation] rejects runtime substitution and tracked boundary mutation",
  "[artifact] verifies exact artifact bytes and one exact final proof pin",
  "[writer] atomically commits exact bytes and preserves the previous destination on failure",
  "[writer-filesystem] rejects symlink, hard-link, and non-file destinations",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[immutability] freezes evidence and states the exact nonclaim boundary",
]);

export const DEFAULT_EDITOR_CORE_STABLE_ID_INSERT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze([
  "createDesenEditorDocument",
  "insertDesenEditorNode",
]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "DesenEditorDocument",
  "DesenEditorDocumentCreationFailure",
  "DesenEditorDocumentCreationResult",
  "DesenEditorDocumentCreationSuccess",
  "DesenEditorInsertDiagnostic",
  "DesenEditorInsertDiagnosticCode",
  "DesenEditorNodeInsertCommand",
  "DesenEditorNodeInsertFailure",
  "DesenEditorNodeInsertResult",
  "DesenEditorNodeInsertSuccess",
]);
const EXPECTED_INSERT_EXPORTS = Object.freeze([
  "DesenEditorInsertDiagnostic",
  "DesenEditorInsertDiagnosticCode",
  "DesenEditorNodeInsertCommand",
  "DesenEditorNodeInsertFailure",
  "DesenEditorNodeInsertResult",
  "DesenEditorNodeInsertSuccess",
  "insertDesenEditorNode",
]);
const EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS = Object.freeze([
  "deleteDesenEditorNode",
  "moveDesenEditorNode",
  "reorderDesenEditorNode",
]);
const EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS = Object.freeze([
  "DesenEditorNodeDeleteCommand",
  "DesenEditorNodeMoveCommand",
  "DesenEditorNodeReorderCommand",
  "DesenEditorStructuralEditDiagnostic",
  "DesenEditorStructuralEditDiagnosticCode",
  "DesenEditorStructuralEditFailure",
  "DesenEditorStructuralEditResult",
  "DesenEditorStructuralEditSuccess",
]);
const EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS = Object.freeze(
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
const EXPECTED_CONTENT_EDIT_TYPE_EXPORTS = Object.freeze(
  [
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
  ].sort(compareText),
);
const EXPECTED_CURRENT_RUNTIME_EXPORTS = Object.freeze(
  [
    "createDesenEditorDocument",
    "deleteDesenEditorNode",
    "insertDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    ...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_CURRENT_TYPE_EXPORTS = Object.freeze(
  [
    ...EXPECTED_TYPE_EXPORTS,
    ...EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS,
    ...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS,
  ].sort(compareText),
);
const EXPECTED_DIAGNOSTIC_CODES = Object.freeze([
  "run.desen.editor/INSERT_COMMAND_INVALID",
  "run.desen.editor/INSERT_LIMIT_EXCEEDED",
  "run.desen.editor/INSERT_POSITION_INVALID",
  "run.desen.editor/INSERT_TARGET_AMBIGUOUS",
  "run.desen.editor/INSERT_TARGET_NOT_FOUND",
]);
const EXPECTED_PACKAGE_TEST_NAMES = Object.freeze([
  "inserts one minimal leaf at the exact ordered boundary and preserves every prior identity",
  "allocates the lowest free suffix deterministically without retaining either input",
  "truncates a 128-character occupied base only enough for its collision suffix",
  "skips occupied suffixes and chooses the lowest free collision ordinal",
  "keeps identity allocation surface-local and case-sensitive",
  "reserves behavior identities and can target a behavior-owned named slot",
  "creates an absent slot only at index zero and preserves unresolved catalog semantics",
  "creates Object.prototype-named slots as own data without inherited lookup",
  "creates the slot map for a leaf parent without widening the inserted node payload",
  "rejects missing and ambiguous identity targets without choosing a first match",
  "rejects malformed exact-command fields, extra authority, and active properties",
  "accepts exactly 4,096 capability-id code units and rejects 4,097",
  "preserves structural diagnostics when a forged current document is rejected",
  "accepts source depth 64 and rejects an insertion that would create depth 65",
  "admits exactly 25,000 surface identities and rejects the next one",
  "admits an exact 8 MiB post-insert document and rejects a one-byte crossing",
]);
const RETAINED_T02_PUBLIC_TEST_NAMES = Object.freeze([
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
  "[proof-core] two fresh final builds are byte-identical and preserve honest scope",
  "[proof-core] rejects a wrapper-returning or mutable public runtime",
  "[proof-core] rejects caller retention and partial failure authority",
  "[proof-core] rejects admission that becomes semantically too strict",
  "[proof-core] rejects source, TSDoc, import, distribution, and manifest drift",
  "[proof-core] rejects focused-test inventory drift",
  "[proof-core] rejects accessor, inherited, symbol, and Proxy options without hooks",
]);
const RETAINED_T02_PUBLIC_TYPE_CLAIMS = Object.freeze([
  "emitted declarations keep the direct document recursively immutable",
  "emitted declarations do not permit replacing nested Source maps",
  "emitted declarations expose the Source root itself, not a wrapper",
  "a successful admission has no structural diagnostic entries",
  "a rejected admission exposes no partial editor document",
  "emitted command successes keep the next Source immutable",
  "emitted success diagnostics are empty",
  "emitted failures expose no partial Source",
  "emitted failures expose no allocated identity",
  "emitted command fields remain readonly",
  "callers cannot bypass emitted allocator ownership",
]);
const DIST_PATHS = Object.freeze([
  "packages/editor-core/dist/index.d.ts",
  "packages/editor-core/dist/index.d.ts.map",
  "packages/editor-core/dist/index.js",
  "packages/editor-core/dist/index.js.map",
  "packages/editor-core/dist/source-document.d.ts",
  "packages/editor-core/dist/source-document.d.ts.map",
  "packages/editor-core/dist/source-document.js",
  "packages/editor-core/dist/source-document.js.map",
  "packages/editor-core/dist/stable-id-insert.d.ts",
  "packages/editor-core/dist/stable-id-insert.d.ts.map",
  "packages/editor-core/dist/stable-id-insert.js",
  "packages/editor-core/dist/stable-id-insert.js.map",
]);
const TRACKED_PATHS = Object.freeze([
  FIXTURE_PATH,
  "tsconfig.base.json",
  PACKAGE_PATH,
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  "packages/editor-core/src/source-document.ts",
  INSERT_SOURCE_PATH,
  INDEX_SOURCE_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ...DIST_PATHS,
  "packages/editor-core/test/source-document.test.ts",
  "packages/editor-core/test/source-document.types.ts",
  PACKAGE_TEST_PATH,
  PACKAGE_TYPES_PATH,
  PUBLIC_TEST_PATH,
  PUBLIC_TYPES_PATH,
  ATOMIC_WRITER_PATH,
  PROOF_LIBRARY_PATH,
  GENERATOR_PATH,
  VERIFIER_PATH,
  ROOT_TEST_PATH,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...TRACKED_PATHS,
  STRUCTURAL_EDITS_SOURCE_PATH,
  ...STRUCTURAL_EDITS_DIST_PATHS,
  CONTENT_EDITS_SOURCE_PATH,
  ...CONTENT_EDITS_DIST_PATHS,
]);
const TRACKED_PATH_SET = new Set(CURRENT_COMPATIBILITY_PATHS);
const RETAINED_T02_RECEIPT_PATHS = Object.freeze(
  TRACKED_PATHS.filter(
    (relativePath) =>
      ![
        PACKAGE_PATH,
        INDEX_SOURCE_PATH,
        "packages/editor-core/dist/index.d.ts",
        "packages/editor-core/dist/index.d.ts.map",
        "packages/editor-core/dist/index.js",
        "packages/editor-core/dist/index.js.map",
        PUBLIC_TEST_PATH,
        PUBLIC_TYPES_PATH,
        PROOF_LIBRARY_PATH,
        ROOT_TEST_PATH,
      ].includes(relativePath),
  ),
);
const BUILD_OPTION_KEYS = Object.freeze([
  "fileOverrides",
  "prerequisiteBytes",
  "prerequisitePath",
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

export class EditorCoreStableIdInsertProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreStableIdInsertProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreStableIdInsertProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
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
    if (Object.hasOwn(value, key)) fail("OPTIONS_INVALID", `${label} shadows byte-view authority.`);
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
  const source = captureExactObject(raw, CURRENT_COMPATIBILITY_PATHS, "fileOverrides");
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
  const source = captureExactObject(raw, EXPECTED_RUNTIME_EXPORTS, "buildOptions.runtime");
  for (const key of EXPECTED_RUNTIME_EXPORTS) {
    if (typeof source[key] !== "function" || utilTypes.isProxy(source[key])) {
      fail(
        "OPTIONS_INVALID",
        `buildOptions.runtime.${key} must be an own non-Proxy function data property.`,
      );
    }
  }
  return Object.freeze({
    createDesenEditorDocument: source.createDesenEditorDocument,
    insertDesenEditorNode: source.insertDesenEditorNode,
  });
}

function captureBuildOptions(raw) {
  const source = captureExactObject(raw, BUILD_OPTION_KEYS, "buildOptions");
  if (source.prerequisitePath !== undefined && typeof source.prerequisitePath !== "string") {
    fail("OPTIONS_INVALID", "buildOptions.prerequisitePath must be a string.");
  }
  return Object.freeze({
    fileOverrides: captureFileOverrides(source.fileOverrides),
    prerequisiteBytes:
      source.prerequisiteBytes === undefined
        ? undefined
        : captureByteInput(source.prerequisiteBytes, "buildOptions.prerequisiteBytes"),
    prerequisitePath: source.prerequisitePath,
    runtime: captureRuntime(source.runtime),
  });
}

async function readNoFollow(relativeOrAbsolutePath, label, maxBytes = MAX_AUTHORITY_BYTES) {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? path.resolve(relativeOrAbsolutePath)
    : path.join(WORKSPACE_ROOT, relativeOrAbsolutePath);
  const parent = path.dirname(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(parent);
  } catch (error) {
    fail("FILESYSTEM_UNSAFE", `${label} parent cannot be resolved.`, String(error));
  }
  if (canonicalParent !== parent) fail("FILESYSTEM_UNSAFE", `${label} parent is not canonical.`);

  let handle;
  try {
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
      opened.size !== before.size
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while opening.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      bytes.byteLength !== before.size ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.nlink !== 1
    ) {
      fail("FILESYSTEM_UNSAFE", `${label} changed while reading.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreStableIdInsertProofError) throw error;
    fail("FILESYSTEM_UNSAFE", `${label} cannot be read safely.`, String(error));
  } finally {
    await handle?.close();
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
    if (error instanceof EditorCoreStableIdInsertProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`, String(error));
  }
}

async function trackedBytes(relativePath, options) {
  const live = await readNoFollow(relativePath, relativePath);
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

function exportedNames(sourceText) {
  const sourceFile = ts.createSourceFile(
    "stable-id-insert.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
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
  return { names: names.sort(compareText), tsdocDeclarations };
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
    manifest.scripts?.["test:stable-id-insert"] !== "vitest run test/stable-id-insert.test.ts" ||
    manifest.scripts?.["test:structural-edits"] !== "vitest run test/structural-edits.test.ts" ||
    manifest.scripts?.["test:content-edits"] !== "vitest run test/content-edits.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core manifest boundary drifted.");
  }

  const insertSource = decodeUtf8(files.get(INSERT_SOURCE_PATH), INSERT_SOURCE_PATH);
  const exports = exportedNames(insertSource);
  exactArray(
    exports.names,
    [...EXPECTED_INSERT_EXPORTS].sort(compareText),
    "SOURCE_DRIFT",
    "Insert exports",
  );
  if (exports.tsdocDeclarations !== EXPECTED_INSERT_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public insert declaration must retain TSDoc.");
  }
  for (const literal of ["4_096", "8_388_608", "25_000", "maxSourceTreeDepth: 64"]) {
    if (!insertSource.includes(literal)) fail("LIMIT_DRIFT", `Missing fixed limit: ${literal}`);
  }
  for (const code of EXPECTED_DIAGNOSTIC_CODES) {
    if (!insertSource.includes(`"${code}"`)) fail("DIAGNOSTIC_DRIFT", `Missing code: ${code}`);
  }

  const structuralEditsSource = decodeUtf8(
    files.get(STRUCTURAL_EDITS_SOURCE_PATH),
    STRUCTURAL_EDITS_SOURCE_PATH,
  );
  const structuralSourceExports = exportedNames(structuralEditsSource);
  exactArray(
    structuralSourceExports.names,
    [...EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS, ...EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS].sort(
      compareText,
    ),
    "SOURCE_DRIFT",
    "Structural-edit exports",
  );
  if (
    structuralSourceExports.tsdocDeclarations !==
    EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS.length + EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Every public structural-edit declaration must retain TSDoc.");
  }

  const contentEditsSource = decodeUtf8(
    files.get(CONTENT_EDITS_SOURCE_PATH),
    CONTENT_EDITS_SOURCE_PATH,
  );
  const contentSourceExports = exportedNames(contentEditsSource);
  exactArray(
    contentSourceExports.names,
    [...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS, ...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS].sort(
      compareText,
    ),
    "SOURCE_DRIFT",
    "Content-edit exports",
  );
  if (
    contentSourceExports.tsdocDeclarations !==
    EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS.length + EXPECTED_CONTENT_EDIT_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Every public content-edit declaration must retain TSDoc.");
  }

  const indexSource = decodeUtf8(files.get(INDEX_SOURCE_PATH), INDEX_SOURCE_PATH);
  const sourceIndexExports = reexportedNames(indexSource, INDEX_SOURCE_PATH);
  exactArray(
    sourceIndexExports.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "SOURCE_DRIFT",
    "Current package runtime exports",
  );
  exactArray(
    sourceIndexExports.types,
    EXPECTED_CURRENT_TYPE_EXPORTS,
    "SOURCE_DRIFT",
    "Current package type exports",
  );
  exactArray(
    sourceIndexExports.modules,
    [
      "./content-edits.js",
      "./content-edits.js",
      "./source-document.js",
      "./source-document.js",
      "./stable-id-insert.js",
      "./stable-id-insert.js",
      "./structural-edits.js",
      "./structural-edits.js",
    ],
    "SOURCE_DRIFT",
    "Current source index edges",
  );

  const distIndex = decodeUtf8(
    files.get("packages/editor-core/dist/index.js"),
    "packages/editor-core/dist/index.js",
  );
  const distSource = decodeUtf8(
    files.get("packages/editor-core/dist/source-document.js"),
    "packages/editor-core/dist/source-document.js",
  );
  const distInsert = decodeUtf8(
    files.get("packages/editor-core/dist/stable-id-insert.js"),
    "packages/editor-core/dist/stable-id-insert.js",
  );
  const distStructuralEdits = decodeUtf8(
    files.get("packages/editor-core/dist/structural-edits.js"),
    "packages/editor-core/dist/structural-edits.js",
  );
  const distStructuralEditsDeclaration = decodeUtf8(
    files.get("packages/editor-core/dist/structural-edits.d.ts"),
    "packages/editor-core/dist/structural-edits.d.ts",
  );
  const distContentEdits = decodeUtf8(
    files.get("packages/editor-core/dist/content-edits.js"),
    "packages/editor-core/dist/content-edits.js",
  );
  const distContentEditsDeclaration = decodeUtf8(
    files.get("packages/editor-core/dist/content-edits.d.ts"),
    "packages/editor-core/dist/content-edits.d.ts",
  );
  const distIndexExports = reexportedNames(distIndex, "packages/editor-core/dist/index.js");
  const distIndexDeclarationExports = reexportedNames(
    decodeUtf8(
      files.get("packages/editor-core/dist/index.d.ts"),
      "packages/editor-core/dist/index.d.ts",
    ),
    "packages/editor-core/dist/index.d.ts",
  );
  exactArray(
    distIndexExports.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Current emitted runtime exports",
  );
  exactArray(
    distIndexDeclarationExports.runtime,
    EXPECTED_CURRENT_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Current emitted declaration runtime exports",
  );
  exactArray(
    distIndexDeclarationExports.types,
    EXPECTED_CURRENT_TYPE_EXPORTS,
    "EMITTED_DRIFT",
    "Current emitted declaration type exports",
  );
  exactArray(
    staticModuleSpecifiers(distIndex),
    [
      "./source-document.js",
      "./stable-id-insert.js",
      "./structural-edits.js",
      "./content-edits.js",
    ],
    "EMITTED_DRIFT",
    "Emitted index edges",
  );
  exactArray(
    staticModuleSpecifiers(distSource),
    ["@desen/validator"],
    "EMITTED_DRIFT",
    "Emitted Source edges",
  );
  exactArray(
    staticModuleSpecifiers(distInsert),
    ["@desen/protocol", "./source-document.js"],
    "EMITTED_DRIFT",
    "Emitted insert edges",
  );
  exactArray(
    staticModuleSpecifiers(distStructuralEdits),
    ["@desen/protocol", "./source-document.js"],
    "EMITTED_DRIFT",
    "Emitted structural-edit edges",
  );
  const structuralDeclarationExports = exportedNames(distStructuralEditsDeclaration);
  exactArray(
    structuralDeclarationExports.names,
    [...EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS, ...EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS].sort(
      compareText,
    ),
    "EMITTED_DRIFT",
    "Emitted structural-edit declarations",
  );
  if (
    structuralDeclarationExports.tsdocDeclarations !==
    EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS.length + EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Emitted structural-edit declarations lost TSDoc.");
  }
  exactArray(
    staticModuleSpecifiers(distContentEdits),
    ["@desen/protocol", "./source-document.js"],
    "EMITTED_DRIFT",
    "Emitted content-edit edges",
  );
  const contentDeclarationExports = exportedNames(distContentEditsDeclaration);
  exactArray(
    contentDeclarationExports.names,
    [...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS, ...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS].sort(
      compareText,
    ),
    "EMITTED_DRIFT",
    "Emitted content-edit declarations",
  );
  if (
    contentDeclarationExports.tsdocDeclarations !==
    EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS.length + EXPECTED_CONTENT_EDIT_TYPE_EXPORTS.length
  ) {
    fail("TSDOC_DRIFT", "Emitted content-edit declarations lost TSDoc.");
  }
  const emittedGraph = `${distIndex}\n${distSource}\n${distInsert}\n${distStructuralEdits}\n${distContentEdits}`;
  for (const forbidden of [
    /\bimport\s*\(/u,
    /\beval\s*\(/u,
    /\bReact(?:DOM)?\b/u,
    /\b(?:window|navigator|HTMLElement|customElements|MutationObserver|XMLHttpRequest|WebSocket)\b/u,
    /\b(?:globalThis\.)?document\s*\.\s*(?:body|head|createElement|querySelector|getElementById|addEventListener)\b/u,
  ]) {
    if (forbidden.test(emittedGraph))
      fail("PLATFORM_DRIFT", `Forbidden emitted authority: ${forbidden}`);
  }
  const packageTest = decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH);
  exactArray(
    testNames(packageTest),
    EXPECTED_PACKAGE_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Focused behavior inventory",
  );
  const packageTypes = decodeUtf8(files.get(PACKAGE_TYPES_PATH), PACKAGE_TYPES_PATH);
  if (countTypeAssertions(packageTypes) !== 8) {
    fail("TEST_INVENTORY_DRIFT", "Focused compiler-negative inventory must remain eight.");
  }
  const rootTest = decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH);
  exactArray(
    testNames(rootTest),
    EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );
  const publicTestNames = testNames(decodeUtf8(files.get(PUBLIC_TEST_PATH), PUBLIC_TEST_PATH));
  if (RETAINED_T02_PUBLIC_TEST_NAMES.some((name) => !publicTestNames.includes(name))) {
    fail("TEST_INVENTORY_DRIFT", "The public package lost a retained M08-T02 runnable case.");
  }
  const publicTypes = decodeUtf8(files.get(PUBLIC_TYPES_PATH), PUBLIC_TYPES_PATH);
  if (
    RETAINED_T02_PUBLIC_TYPE_CLAIMS.some(
      (claim) => !publicTypes.includes(`// @ts-expect-error ${claim}`),
    )
  ) {
    fail("TEST_INVENTORY_DRIFT", "The public package lost a retained M08-T02 type claim.");
  }

  return deepFreeze({
    runtimeExports: [...EXPECTED_RUNTIME_EXPORTS],
    typeExports: [...EXPECTED_TYPE_EXPORTS],
    currentPackageRuntimeExports: [...EXPECTED_CURRENT_RUNTIME_EXPORTS],
    currentPackageTypeExports: [...EXPECTED_CURRENT_TYPE_EXPORTS],
    additiveTypeExports: [
      ...EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS,
      ...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS,
    ].sort(compareText),
    additiveRuntimeExports: [
      ...EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS,
      ...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS,
    ].sort(compareText),
    additiveSuccessors: [
      {
        task: "M08-T03",
        sourcePath: STRUCTURAL_EDITS_SOURCE_PATH,
        runtimePath: "packages/editor-core/dist/structural-edits.js",
        declarationPath: "packages/editor-core/dist/structural-edits.d.ts",
        runtimeExports: [...EXPECTED_STRUCTURAL_EDIT_RUNTIME_EXPORTS],
        typeExports: [...EXPECTED_STRUCTURAL_EDIT_TYPE_EXPORTS],
      },
      {
        task: "M08-T04",
        sourcePath: CONTENT_EDITS_SOURCE_PATH,
        runtimePath: "packages/editor-core/dist/content-edits.js",
        declarationPath: "packages/editor-core/dist/content-edits.d.ts",
        runtimeExports: [...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS],
        typeExports: [...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS],
      },
    ],
    additiveSuccessor: {
      task: "M08-T04",
      sourcePath: CONTENT_EDITS_SOURCE_PATH,
      runtimePath: "packages/editor-core/dist/content-edits.js",
      declarationPath: "packages/editor-core/dist/content-edits.d.ts",
      runtimeExports: [...EXPECTED_CONTENT_EDIT_RUNTIME_EXPORTS],
      typeExports: [...EXPECTED_CONTENT_EDIT_TYPE_EXPORTS],
    },
    publicDeclarations: EXPECTED_INSERT_EXPORTS.length,
    tsdocDeclarations: exports.tsdocDeclarations,
    staticEsmEdges: 11,
    unknownStaticEsmEdges: 0,
    platformNeutral: true,
    focusedBehaviorCases: EXPECTED_PACKAGE_TEST_NAMES.length,
    focusedCompilerNegativeAssertions: 8,
    publicRuntimeCases: publicTestNames.length,
    publicCompilerNegativeAssertions: countTypeAssertions(publicTypes),
    rootProofCases: EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES.length,
  });
}

function exactPrerequisiteReceipt(prerequisiteArtifact, relativePath) {
  const trackedFiles = prerequisiteArtifact.evidence?.trackedFiles;
  const matches = Array.isArray(trackedFiles)
    ? trackedFiles.filter((candidate) => candidate?.path === relativePath)
    : [];
  if (matches.length !== 1) {
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      `The frozen M08-T01 prerequisite must contain one dependency receipt: ${relativePath}.`,
    );
  }
  const candidate = matches[0];
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    JSON.stringify(Reflect.ownKeys(candidate)) !== JSON.stringify(["path", "bytes", "sha256"]) ||
    !Number.isSafeInteger(candidate.bytes) ||
    candidate.bytes < 0 ||
    typeof candidate.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidate.sha256)
  ) {
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      `The frozen M08-T01 dependency receipt is malformed: ${relativePath}.`,
    );
  }
  return candidate;
}

function authenticateRuntimeClosure(prerequisiteArtifact, files) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = exactPrerequisiteReceipt(prerequisiteArtifact, relativePath);
    const bytes = files.get(relativePath);
    if (bytes.byteLength !== authority.bytes || sha256(bytes) !== authority.sha256) {
      fail(
        "RUNTIME_AUTHORITY_DRIFT",
        `The exact frozen dependency byte receipt drifted: ${relativePath}.`,
      );
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  const editorReceipts = RETAINED_EDITOR_RUNTIME_PATHS.map((relativePath) =>
    receipt(relativePath, files.get(relativePath)),
  ).sort((left, right) => compareText(left.path, right.path));

  return deepFreeze({
    mode: "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH",
    exactReceiptedBytes: true,
    importAfterReceipt: true,
    workspaceModuleCacheUsed: false,
    runtimeFiles: ISOLATED_RUNTIME_PATHS.length,
    editorFiles: editorReceipts.length,
    dependencyFiles: dependencyReceipts.length,
    dependencyModules: PROTOCOL_RUNTIME_PATHS.length + VALIDATOR_RUNTIME_PATHS.length,
    dependencyManifests: 2,
    prerequisite: {
      task: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.task,
      path: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.path,
      sha256: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.sha256,
    },
    editorReceipts,
    dependencyReceipts,
    trustedAuthorities: ["NODE_RUNTIME", "ESM_LOADER", "PROCESS_ENVIRONMENT"],
  });
}

function isolatedDestination(directory, relativePath) {
  const match = relativePath.match(/^packages\/(editor-core|protocol|validator)\/(.+)$/u);
  if (match === null) {
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      `The isolated runtime path is outside the reviewed package graph: ${relativePath}.`,
    );
  }
  return path.join(directory, "node_modules", "@desen", match[1], match[2]);
}

async function importReceiptedRuntime(files) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t02-runtime-"));
  try {
    const copies = ISOLATED_RUNTIME_PATHS.map((relativePath) => ({
      bytes: files.get(relativePath),
      destination: isolatedDestination(directory, relativePath),
    }));
    const entryPath = path.join(directory, "entry.mjs");
    copies.push({
      bytes: Buffer.from(
        [
          'import { createDesenEditorDocument } from "./node_modules/@desen/editor-core/dist/source-document.js";',
          'import { insertDesenEditorNode } from "./node_modules/@desen/editor-core/dist/stable-id-insert.js";',
          'import { canonicalizeJsonBytes } from "@desen/protocol";',
          "const editorCore = Object.freeze({ createDesenEditorDocument, insertDesenEditorNode });",
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
      Object.keys(imported.editorCore),
      EXPECTED_RUNTIME_EXPORTS,
      "PUBLIC_API_DRIFT",
      "Isolated runtime exports",
    );
    if (
      typeof imported.editorCore.createDesenEditorDocument !== "function" ||
      typeof imported.editorCore.insertDesenEditorNode !== "function" ||
      typeof imported.canonicalizeJsonBytes !== "function"
    ) {
      fail("PUBLIC_API_DRIFT", "The isolated runtime lost one reviewed function export.");
    }
    return Object.freeze({
      canonicalizeJsonBytes: imported.canonicalizeJsonBytes,
      editorCore: Object.freeze({
        createDesenEditorDocument: imported.editorCore.createDesenEditorDocument,
        insertDesenEditorNode: imported.editorCore.insertDesenEditorNode,
      }),
    });
  } catch (error) {
    if (error instanceof EditorCoreStableIdInsertProofError) throw error;
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      "The exact receipted editor-core runtime graph could not be imported in isolation.",
      String(error),
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function createDocument(runtime, validSource, input = clone(validSource)) {
  const result = runtime.createDesenEditorDocument(input);
  if (!result?.ok) fail("BEHAVIOR_DRIFT", "The emitted runtime rejected a valid Source fixture.");
  return result.document;
}

function command(overrides = {}) {
  return {
    surfaceId: "sign-in",
    parentId: "sign-in.layout",
    slot: "default",
    index: 0,
    idBase: "sign-in.inserted",
    use: "com.example.ui/Text",
    ...overrides,
  };
}

function expectSuccess(result, id, label) {
  if (!result?.ok || result.insertedNodeId !== id || result.diagnostics?.length !== 0) {
    fail("BEHAVIOR_DRIFT", `${label} did not return the exact success.`);
  }
  assertDeepFrozen(result, label);
  return result;
}

function expectFailure(result, code, label) {
  if (
    result?.ok !== false ||
    result.diagnostics?.[0]?.code !== code ||
    Object.hasOwn(result, "document") ||
    Object.hasOwn(result, "insertedNodeId")
  ) {
    fail("BEHAVIOR_DRIFT", `${label} did not fail atomically with ${code}.`);
  }
  assertDeepFrozen(result, label);
}

function sourceWithParentDepth(validSource, depth) {
  const input = clone(validSource);
  const root = input.surfaces["sign-in"].root;
  root.slots = {};
  let parent = root;
  for (let index = 1; index <= depth; index += 1) {
    const child = { id: `depth.${index}`, use: "com.example.ui/Stack", slots: {} };
    parent.slots = { default: [child] };
    parent = child;
  }
  return { input, parentId: parent.id };
}

function sourceWithIdentityCount(validSource, count) {
  const input = clone(validSource);
  input.surfaces["sign-in"].root.slots = {
    default: Array.from({ length: count - 1 }, (_, index) => ({
      id: `item.${index}`,
      use: "com.example.ui/Text",
    })),
  };
  return input;
}

function sizedSource(validSource, canonicalizeJsonBytes, extraBytes) {
  const input = clone(validSource);
  input.authoring = { padding: "" };
  const candidate = clone(input);
  candidate.surfaces["sign-in"].root.slots.default.splice(0, 0, {
    id: "sign-in.inserted",
    use: "com.example.ui/Text",
  });
  const baseLength = canonicalizeJsonBytes(candidate).byteLength;
  input.authoring.padding = "x".repeat(DOCUMENT_LIMIT - baseLength + extraBytes);
  return input;
}

function verifyBehavior(runtime, validSource, canonicalizeJsonBytes) {
  if (
    typeof runtime?.createDesenEditorDocument !== "function" ||
    typeof runtime?.insertDesenEditorNode !== "function"
  ) {
    fail("BEHAVIOR_DRIFT", "The runtime does not expose both reviewed editor operations.");
  }

  const document = createDocument(runtime, validSource);
  const before = canonicalizeJsonBytes(document);
  const orderedCommand = command({ index: 2, idBase: "sign-in.help" });
  const ordered = expectSuccess(
    runtime.insertDesenEditorNode(document, orderedCommand),
    "sign-in.help",
    "ordered node insertion",
  );
  exactArray(
    ordered.document.surfaces["sign-in"].root.slots.default.map((node) => node.id),
    [
      "sign-in.title",
      "sign-in.email",
      "sign-in.help",
      "sign-in.password",
      "sign-in.error",
      "sign-in.submit",
    ],
    "BEHAVIOR_DRIFT",
    "Semantic slot order",
  );
  exactArray(
    Object.keys(ordered.document.surfaces["sign-in"].root.slots.default[2]).sort(compareText),
    ["id", "use"],
    "BEHAVIOR_DRIFT",
    "Minimal inserted node",
  );
  if (
    sha256(canonicalizeJsonBytes(document)) !== sha256(before) ||
    ordered.document === document ||
    Object.isFrozen(orderedCommand)
  ) {
    fail("BEHAVIOR_DRIFT", "Insertion mutated or retained caller-owned input.");
  }
  orderedCommand.idBase = "caller.changed";
  if (ordered.insertedNodeId !== "sign-in.help") {
    fail("BEHAVIOR_DRIFT", "The success retained mutable command authority.");
  }

  const absentSlot = expectSuccess(
    runtime.insertDesenEditorNode(
      document,
      command({ slot: "notYetDeclared", use: "com.example.unresolved/Unknown" }),
    ),
    "sign-in.inserted",
    "absent slot at zero",
  );
  if (
    absentSlot.document.surfaces["sign-in"].root.slots.notYetDeclared[0].use !==
    "com.example.unresolved/Unknown"
  ) {
    fail("BEHAVIOR_DRIFT", "Absent-slot or unresolved-semantic admission drifted.");
  }
  const prototypeNamedSlot = expectSuccess(
    runtime.insertDesenEditorNode(
      document,
      command({ slot: "constructor", idBase: "sign-in.prototype-safe" }),
    ),
    "sign-in.prototype-safe",
    "Object.prototype-named slot insertion",
  );
  const prototypeNamedSlots = prototypeNamedSlot.document.surfaces["sign-in"].root.slots;
  if (
    !Object.hasOwn(prototypeNamedSlots, "constructor") ||
    prototypeNamedSlots.constructor?.[0]?.id !== "sign-in.prototype-safe" ||
    Object.prototype.constructor !== Object
  ) {
    fail("BEHAVIOR_DRIFT", "Object.prototype-named slots must become isolated own data.");
  }

  const collisionInput = clone(validSource);
  collisionInput.surfaces["sign-in"].root.slots.default.push({
    id: "sign-in.title-2",
    use: "com.example.ui/Text",
  });
  const collision = expectSuccess(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, collisionInput),
      command({ idBase: "sign-in.title" }),
    ),
    "sign-in.title-3",
    "lowest-free collision allocation",
  );
  const crossSurface = expectSuccess(
    runtime.insertDesenEditorNode(
      document,
      command({ surfaceId: "home", parentId: "home.layout", idBase: "sign-in.title" }),
    ),
    "sign-in.title",
    "surface-local allocation",
  );

  const behaviorInput = clone(validSource);
  behaviorInput.surfaces["sign-in"].root.behaviors = [
    {
      id: "sign-in.sortable",
      use: "com.example.interactions/Sortable",
      slots: { dragPreview: [] },
    },
  ];
  const behaviorDocument = createDocument(runtime, validSource, behaviorInput);
  const behaviorCollision = expectSuccess(
    runtime.insertDesenEditorNode(behaviorDocument, command({ idBase: "sign-in.sortable" })),
    "sign-in.sortable-2",
    "behavior identity reservation",
  );
  const behaviorTarget = expectSuccess(
    runtime.insertDesenEditorNode(
      behaviorDocument,
      command({ parentId: "sign-in.sortable", slot: "dragPreview", idBase: "sign-in.preview" }),
    ),
    "sign-in.preview",
    "behavior slot insertion",
  );
  if (
    behaviorTarget.document.surfaces["sign-in"].root.behaviors[0].slots.dragPreview[0].id !==
    "sign-in.preview"
  ) {
    fail("BEHAVIOR_DRIFT", "Behavior-owned target insertion drifted.");
  }

  const missing = runtime.insertDesenEditorNode(document, command({ parentId: "missing.parent" }));
  expectFailure(missing, "run.desen.editor/INSERT_TARGET_NOT_FOUND", "missing target");
  const ambiguousInput = clone(validSource);
  ambiguousInput.surfaces["sign-in"].root.slots.default[1].id = "sign-in.title";
  expectFailure(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, ambiguousInput),
      command({ parentId: "sign-in.title" }),
    ),
    "run.desen.editor/INSERT_TARGET_AMBIGUOUS",
    "ambiguous target",
  );
  expectFailure(
    runtime.insertDesenEditorNode(document, command({ slot: "absent", index: 1 })),
    "run.desen.editor/INSERT_POSITION_INVALID",
    "invalid position",
  );
  expectFailure(
    runtime.insertDesenEditorNode(document, command({ use: "invalid" })),
    "run.desen.editor/INSERT_COMMAND_INVALID",
    "invalid command",
  );
  const forged = clone(validSource);
  forged.kind = "desen.bundle";
  expectFailure(
    runtime.insertDesenEditorNode(forged, command()),
    "SCHEMA_INVALID",
    "structurally invalid document",
  );

  const exactUse = `${"a".repeat(4_091)}/Text`;
  const crossingUse = `${"a".repeat(4_092)}/Text`;
  expectSuccess(
    runtime.insertDesenEditorNode(document, command({ use: exactUse })),
    "sign-in.inserted",
    "exact capability-id ceiling",
  );
  expectFailure(
    runtime.insertDesenEditorNode(document, command({ use: crossingUse })),
    "run.desen.editor/INSERT_COMMAND_INVALID",
    "capability-id crossing",
  );

  const exactDepth = sourceWithParentDepth(validSource, 63);
  expectSuccess(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, exactDepth.input),
      command({ parentId: exactDepth.parentId }),
    ),
    "sign-in.inserted",
    "exact depth ceiling",
  );
  const crossingDepth = sourceWithParentDepth(validSource, 64);
  expectFailure(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, crossingDepth.input),
      command({ parentId: crossingDepth.parentId }),
    ),
    "run.desen.editor/INSERT_LIMIT_EXCEEDED",
    "depth crossing",
  );

  const exactIdentities = expectSuccess(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 24_999)),
      command({ index: 24_998 }),
    ),
    "sign-in.inserted",
    "exact identity ceiling",
  );
  expectFailure(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, sourceWithIdentityCount(validSource, 25_000)),
      command({ index: 24_999 }),
    ),
    "run.desen.editor/INSERT_LIMIT_EXCEEDED",
    "identity crossing",
  );

  const exactBytes = expectSuccess(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, sizedSource(validSource, canonicalizeJsonBytes, 0)),
      command(),
    ),
    "sign-in.inserted",
    "exact canonical-byte ceiling",
  );
  if (canonicalizeJsonBytes(exactBytes.document).byteLength !== DOCUMENT_LIMIT) {
    fail("BEHAVIOR_DRIFT", "The exact canonical-byte success is not 8 MiB.");
  }
  expectFailure(
    runtime.insertDesenEditorNode(
      createDocument(runtime, validSource, sizedSource(validSource, canonicalizeJsonBytes, 1)),
      command(),
    ),
    "run.desen.editor/INSERT_LIMIT_EXCEEDED",
    "canonical-byte crossing",
  );
  if (sha256(canonicalizeJsonBytes(document)) !== sha256(before)) {
    fail("BEHAVIOR_DRIFT", "A rejected insert mutated the current document.");
  }

  return deepFreeze({
    allocation: {
      base: ordered.insertedNodeId,
      lowestFreeCollision: collision.insertedNodeId,
      surfaceLocal: crossSurface.insertedNodeId,
      behaviorReserved: behaviorCollision.insertedNodeId,
    },
    insertion: {
      exactOrderedBoundary: 2,
      insertedNodeKeys: ["id", "use"],
      nodeTarget: true,
      behaviorTarget: true,
      absentSlotAtZero: true,
      prototypeNamedSlotOwnData: true,
    },
    limits: {
      capabilityIdCodeUnits: 4_096,
      canonicalDocumentBytes: DOCUMENT_LIMIT,
      identitiesPerTargetSurface: 25_000,
      sourceTreeDepth: 64,
      rootDepth: 0,
      exactCeilingsPass: true,
      oneUnitCrossingsFail: true,
      exactIdentityResultCount:
        exactIdentities.document.surfaces["sign-in"].root.slots.default.length + 1,
    },
    diagnostics: {
      editorCodes: [...EXPECTED_DIAGNOSTIC_CODES],
      structuralPassThrough: "SCHEMA_INVALID",
      failuresExposeNoDocumentOrIdentity: true,
    },
    immutability: {
      inputDocumentUnchanged: true,
      freshDetachedSuccess: true,
      recursivelyFrozenResults: true,
      atomicFailure: true,
    },
  });
}

async function authenticatePrerequisite(options) {
  const prerequisitePath = options.prerequisitePath ?? T01_ARTIFACT_PATH;
  const bytes =
    options.prerequisiteBytes ??
    (await readNoFollow(prerequisitePath, "frozen M08-T01 prerequisite"));
  const pin = EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PREREQUISITE_DRIFT", "The exact frozen M08-T01 artifact receipt did not match.");
  }
  const artifact = parseJson(bytes, "frozen M08-T01 prerequisite");
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-source-document" ||
    artifact.task !== "M08-T01" ||
    artifact.result !== "PASS"
  ) {
    fail("PREREQUISITE_DRIFT", "The frozen M08-T01 artifact is not its reviewed PASS profile.");
  }
  if (options.prerequisiteBytes !== undefined || options.prerequisitePath !== undefined) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "A caller-supplied prerequisite cannot issue PASS.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    evidence: deepFreeze({
      ...pin,
      result: "PASS",
      authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
      liveProofReaderInput: false,
      sequence29HeadInput: false,
    }),
  });
}

async function authenticateFrozenArtifact() {
  const bytes = await readNoFollow(ARTIFACT_PATH, "frozen M08-T02 proof artifact");
  if (
    bytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(bytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T02 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(bytes, "frozen M08-T02 proof artifact");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-stable-id-insert" ||
    artifact.profile !== "desen.editor-core.stable-id-insert-proof.v1" ||
    artifact.task !== "M08-T02" ||
    artifact.result !== "PASS" ||
    JSON.stringify(artifact.publicApi?.runtimeExports) !==
      JSON.stringify(EXPECTED_RUNTIME_EXPORTS) ||
    JSON.stringify(artifact.publicApi?.typeExports) !== JSON.stringify(EXPECTED_TYPE_EXPORTS) ||
    artifact.claim?.stableIdAllocator !== true ||
    artifact.claim?.immutableInsertCommand !== true ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    artifact.executionAuthority?.runtimeFiles !== 25 ||
    artifact.executionAuthority?.editorFiles !== 4 ||
    artifact.executionAuthority?.dependencyFiles !== 21 ||
    artifact.trackedBoundary?.files !== 53 ||
    !Array.isArray(receipts) ||
    receipts.length !== 53 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    artifact.testAuthority?.focusedBehaviorCases !== 16 ||
    artifact.testAuthority?.focusedCompilerNegativeAssertions !== 8 ||
    artifact.testAuthority?.publicRuntimeCases !== 22 ||
    artifact.testAuthority?.publicCompilerNegativeAssertions !== 11 ||
    artifact.testAuthority?.rootProofCases !== EDITOR_CORE_STABLE_ID_INSERT_ROOT_TEST_NAMES.length
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T02 artifact identity or retained claim drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(bytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedT02Receipts(frozenArtifact, files) {
  const receipts = new Map(
    frozenArtifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T02_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T02 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

export async function buildEditorCoreStableIdInsertEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const frozen = await authenticateFrozenArtifact();
  const authenticatedPrerequisite = await authenticatePrerequisite(options);
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const boundary = verifyBoundary(files);
  assertRetainedT02Receipts(frozen.artifact, files);
  const executionAuthority = authenticateRuntimeClosure(authenticatedPrerequisite.artifact, files);
  const isolatedRuntime = await importReceiptedRuntime(files);
  const validSource = parseJson(files.get(FIXTURE_PATH), FIXTURE_PATH);
  const behavior = verifyBehavior(
    isolatedRuntime.editorCore,
    validSource,
    isolatedRuntime.canonicalizeJsonBytes,
  );
  if (JSON.stringify(behavior) !== JSON.stringify(frozen.artifact.behavior)) {
    fail("BEHAVIOR_DRIFT", "The retained M08-T02 runtime behavior left its frozen claim.");
  }
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue current compatibility evidence.");
  }
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-stable-id-insert",
    profile: "desen.editor-core.stable-id-insert-proof.v1",
    task: "M08-T02",
    result: "PASS",
    prerequisite: authenticatedPrerequisite.evidence,
    claim: frozen.artifact.claim,
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      insertPublicDeclarations: boundary.publicDeclarations,
      insertTsdocDeclarations: boundary.tsdocDeclarations,
    },
    behavior,
    executionAuthority,
    packageBoundary: {
      frozenTaskTimeEmittedFiles: DIST_PATHS.length,
      retainedRuntimeModuleFiles: RETAINED_EDITOR_RUNTIME_PATHS.length,
      additiveEmittedFiles: STRUCTURAL_EDITS_DIST_PATHS.length + CONTENT_EDITS_DIST_PATHS.length,
      staticEsmEdges: boundary.staticEsmEdges,
      unknownStaticEsmEdges: boundary.unknownStaticEsmEdges,
      platformNeutral: boundary.platformNeutral,
      manifestExportRoots: ["."],
      productionDependencies: ["@desen/protocol", "@desen/validator"],
    },
    boundary,
    testAuthority: {
      focusedBehaviorCases: boundary.focusedBehaviorCases,
      focusedCompilerNegativeAssertions: boundary.focusedCompilerNegativeAssertions,
      publicRuntimeCases: boundary.publicRuntimeCases,
      publicCompilerNegativeAssertions: boundary.publicCompilerNegativeAssertions,
      rootProofCases: boundary.rootProofCases,
    },
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      retainedTaskTimeReceipts: RETAINED_T02_RECEIPT_PATHS.length,
    },
  });
  return Object.freeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    task: "M08-T02",
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

function visibleProofAuthority(document) {
  const visible = [];
  const rawAuthority = [];
  let fence;
  let insideComment = false;
  for (const rawLine of document.split(/\r?\n/u)) {
    if (fence !== undefined) {
      const closing = rawLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
      if (
        closing !== null &&
        closing[1][0] === fence.marker &&
        closing[1].length >= fence.length &&
        closing[2].trim() === ""
      ) {
        fence = undefined;
      }
      continue;
    }
    let remainder = rawLine;
    let line = "";
    while (remainder.length > 0) {
      if (insideComment) {
        const end = remainder.indexOf("-->");
        if (end < 0) remainder = "";
        else {
          insideComment = false;
          remainder = remainder.slice(end + 3);
        }
        continue;
      }
      const start = remainder.indexOf("<!--");
      if (start < 0) {
        line += remainder;
        remainder = "";
      } else {
        line += remainder.slice(0, start);
        insideComment = true;
        remainder = remainder.slice(start + 4);
      }
    }
    if (/^(?: {4}|\t)/u.test(line)) continue;
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if (opening !== null) {
      fence = { marker: opening[1][0], length: opening[1].length };
      continue;
    }
    rawAuthority.push(line);
    visible.push(line.trimEnd());
  }
  return {
    visible,
    rawHtml: /<\s*\/?\s*[A-Za-z][\s\S]*?>/u.test(rawAuthority.join("\n")),
  };
}

function proofDocumentHasContradictoryStatus(visibleLines) {
  return visibleLines.some((line) => {
    const normalized = line
      .replace(/\\([`*_~])/gu, "$1")
      .replace(/[`*_~]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    const field = normalized.match(/\b(?:result|status)\s*:\s*(.*)$/iu);
    if (field === null) return false;
    const value = field[1].trim();
    return (
      !/^(?:PASS|DONE)\b/iu.test(value) ||
      /\b(?:BLOCKED|ERROR|FAIL(?:ED|URE)?|INCOMPLETE|IN[ _-]?PROGRESS|NOT[ _-]?STARTED|PENDING|SKIPPED|TODO|UNKNOWN)\b/iu.test(
        value,
      )
    );
  });
}

export async function verifyEditorCoreStableIdInsertEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCoreStableIdInsertEvidence(options.buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T02 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T02 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T02 proof document",
    ));
  const proof = decodeUtf8(proofBytes, "M08-T02 proof document");
  const exactPin = `Final artifact: \`sha256:${built.artifactSha256}\``;
  const { visible, rawHtml } = visibleProofAuthority(proof);
  const pinLines = visible.filter((line) => line.startsWith("Final artifact:"));
  if (
    pinLines.length !== 1 ||
    pinLines[0] !== exactPin ||
    rawHtml ||
    proofDocumentHasContradictoryStatus(visible) ||
    visible.join("\n").includes("sha256:PENDING")
  ) {
    fail("PROOF_PIN_DRIFT", "The proof document final pin drifted.");
  }
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisiteSha256: EDITOR_CORE_STABLE_ID_INSERT_PREREQUISITE_PIN.sha256,
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
    if (error instanceof EditorCoreStableIdInsertProofError) throw error;
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

export async function writeEditorCoreStableIdInsertEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreStableIdInsertEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_STABLE_ID_INSERT_ARTIFACT_PATH,
  );
  await writeAtomicProofArtifact({
    artifactPath: destinationPath,
    artifactBytes: built.artifactBytes,
    beforeAtomicRename: options.beforeAtomicRename,
  });
  const committed = await readNoFollow(destinationPath, "committed M08-T02 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T02 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
