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
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-CONTINUOUS-VALIDATION.md";
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 40_099,
  sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
});
const SOURCE_FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const CATALOG_FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/web.catalog.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const PACKAGE_README_PATH = "packages/editor-core/README.md";
const INDEX_SOURCE_PATH = "packages/editor-core/src/index.ts";
const PERSISTENCE_SOURCE_PATH = "packages/editor-core/src/persistence.ts";
const CONTINUOUS_SOURCE_PATH = "packages/editor-core/src/continuous-validation.ts";
const PERSISTENCE_TEST_PATH = "packages/editor-core/test/persistence.test.ts";
const PERSISTENCE_TYPES_PATH = "packages/editor-core/test/persistence.types.ts";
const PACKAGE_TEST_PATH = "packages/editor-core/test/continuous-validation.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/continuous-validation.types.ts";
const TERMINAL_INTEGRATION_TEST_PATH = "packages/editor-core/test/terminal-integration.test.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-continuous-validation-proof.mjs";
const GENERATOR_PATH = "scripts/generate-editor-core-continuous-validation-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-continuous-validation.mjs";
const ROOT_TEST_PATH = "tests/editor-core-continuous-validation.test.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";

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
const DIST_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.flatMap((name) => [
    `packages/editor-core/dist/${name}.d.ts`,
    `packages/editor-core/dist/${name}.d.ts.map`,
    `packages/editor-core/dist/${name}.js`,
    `packages/editor-core/dist/${name}.js.map`,
  ]),
);
const CURRENT_EDITOR_RUNTIME_PATHS = Object.freeze([
  PACKAGE_PATH,
  ...EDITOR_MODULE_NAMES.map((name) => `packages/editor-core/dist/${name}.js`),
]);
const RETAINED_T07_EDITOR_RUNTIME_PATHS = Object.freeze(
  [
    "source-document",
    "stable-id-insert",
    "structural-edits",
    "content-edits",
    "state-binding-edits",
    "event-action-edits",
  ].map((name) => `packages/editor-core/dist/${name}.js`),
);
const ISOLATED_RUNTIME_PATHS = Object.freeze([
  ...CURRENT_EDITOR_RUNTIME_PATHS,
  ...DEPENDENCY_RUNTIME_PATHS,
]);

const EDITOR_SOURCE_PATHS = Object.freeze(
  EDITOR_MODULE_NAMES.filter((name) => name !== "index").map(
    (name) => `packages/editor-core/src/${name}.ts`,
  ),
);
const EDITOR_TEST_PATHS = Object.freeze(
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
  "tsconfig.base.json",
  PACKAGE_PATH,
  PACKAGE_README_PATH,
  "packages/editor-core/tsconfig.json",
  "packages/editor-core/tsconfig.build.json",
  "packages/editor-core/tsconfig.public-package.json",
  INDEX_SOURCE_PATH,
  ...EDITOR_SOURCE_PATHS,
  ...DIST_PATHS,
  ...EDITOR_TEST_PATHS,
  TERMINAL_INTEGRATION_TEST_PATH,
  PUBLIC_TEST_PATH,
  PUBLIC_TYPES_PATH,
  ...DEPENDENCY_RUNTIME_PATHS,
  ATOMIC_WRITER_PATH,
  PROOF_LIBRARY_PATH,
  GENERATOR_PATH,
  VERIFIER_PATH,
  ROOT_TEST_PATH,
]);
const RETAINED_T09_RECEIPT_PATHS = Object.freeze(
  TRACKED_PATHS.filter(
    (relativePath) =>
      ![
        PACKAGE_PATH,
        PACKAGE_README_PATH,
        PUBLIC_TEST_PATH,
        TERMINAL_INTEGRATION_TEST_PATH,
        PROOF_LIBRARY_PATH,
        ROOT_TEST_PATH,
      ].includes(relativePath),
  ),
);
const CURRENT_PACKAGE_README_COMPLETION_CLAUSE =
  "M08-T10 terminal integration and G08 are `DONE`; `N-012`, `N-014`, `N-018`, `S-002`, and `S-003` are `TESTED`, P-18 is `PROVEN`, M08 is 10/10, and M09-T01 is next.";
const CURRENT_PACKAGE_README_TERMINAL_CLAUSE =
  "M08-T10 is a proof-only closure over the existing API and adds no production helper or public export.";

const EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES = Object.freeze([
  "composes all 32 command APIs with immutable snapshots and an exact stable-identity ledger",
  "replays two independent command runs byte-for-byte without sharing result identity",
  "ends T09-valid with retained obligations and distinguishes authoring fingerprints from digests",
  "round-trips the terminal document through an injected T08 persistence adapter",
]);

const NEW_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorContinuousValidator"]);
const NEW_TYPE_EXPORTS = Object.freeze(
  [
    "DesenEditorContinuousValidationReport",
    "DesenEditorContinuousValidator",
    "DesenEditorContinuousValidatorCreationFailure",
    "DesenEditorContinuousValidatorCreationResult",
    "DesenEditorContinuousValidatorCreationSuccess",
    "DesenEditorInvalidSubjectMapping",
  ].sort(compareText),
);
const EXPECTED_CONTINUOUS_SOURCE_EXPORTS = Object.freeze(
  [...NEW_RUNTIME_EXPORTS, ...NEW_TYPE_EXPORTS].sort(compareText),
);
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
const EXPECTED_PERSISTENCE_SOURCE_EXPORTS = Object.freeze(
  [...PERSISTENCE_RUNTIME_EXPORTS, ...PERSISTENCE_TYPE_EXPORTS].sort(compareText),
);

export const EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS = Object.freeze([
  Object.freeze({
    task: "M08-T03",
    path: "docs/proof/artifacts/editor-core-0.1.0-structural-edits.json",
    bytes: 22_402,
    sha256: "0d44f67c316c21ff8b612221d01e81c76d3b24783164bb75a772985bbc7def8b",
    proofId: "editor-core-structural-edits",
    profile: "desen.editor-core.structural-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T04",
    path: "docs/proof/artifacts/editor-core-0.1.0-content-edits.json",
    bytes: 26_988,
    sha256: "1726d453913c091d30229be02270a0cb4b74bf479f87027c4b9a0da3bb3c7066",
    proofId: "editor-core-content-edits",
    profile: "desen.editor-core.content-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T05",
    path: "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json",
    bytes: 30_014,
    sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
    proofId: "editor-core-state-binding-edits",
    profile: "desen.editor-core.state-binding-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T06",
    path: "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json",
    bytes: 31_310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    proofId: "editor-core-event-action-edits",
    profile: "desen.editor-core.event-action-edits-proof.v1",
  }),
  Object.freeze({
    task: "M08-T07",
    path: "docs/proof/artifacts/editor-core-0.1.0-authoring-round-trip.json",
    bytes: 62_304,
    sha256: "33b6f81be62076d304c6daaec5d860e7995fa69ceaf34103469b349a347962db",
    proofId: "editor-core-authoring-round-trip",
    profile: "desen.editor-core.authoring-round-trip-proof.v1",
  }),
]);

export const EDITOR_CORE_CONTINUOUS_VALIDATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact M08-T03 through T07 artifacts and an isolated runtime graph",
  "[determinism] two fresh M08-T09 builds are byte-identical",
  "[behavior] maps critical subject diagnostics, duplicate occurrences, and controlled unmapped diagnostics",
  "[fingerprints] includes authoring in document identity and preserves Catalog order",
  "[obligations] preserves dynamic work without turning obligations into invalidity",
  "[mutation] rejects runtime, tracked-boundary, and prerequisite substitution",
  "[verification] rejects artifact and visible proof-pin drift",
  "[writer] atomically writes exact deterministic evidence",
]);

export const DEFAULT_EDITOR_CORE_CONTINUOUS_VALIDATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

export class EditorCoreContinuousValidationProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreContinuousValidationProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreContinuousValidationProofError(code, message, details);
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

function captureFileOverrides(raw) {
  if (raw === undefined) return new Map();
  if (!(raw instanceof Map) || utilTypes.isProxy(raw)) {
    fail("OPTIONS_INVALID", "buildOptions.fileOverrides must be a non-Proxy Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of raw) {
    if (typeof relativePath !== "string" || !TRACKED_PATHS.includes(relativePath)) {
      fail("OPTIONS_INVALID", "A file override path is outside the tracked boundary.");
    }
    captured.set(relativePath, captureByteInput(bytes, `fileOverrides[${relativePath}]`));
  }
  return captured;
}

const BUILD_OPTION_KEYS = Object.freeze([
  "fileOverrides",
  "runtime",
  "t03PrerequisiteBytes",
  "t04PrerequisiteBytes",
  "t05PrerequisiteBytes",
  "t06PrerequisiteBytes",
  "t07PrerequisiteBytes",
]);

function captureBuildOptions(raw) {
  const source = captureExactObject(raw, BUILD_OPTION_KEYS, "buildOptions");
  const prerequisites = Object.create(null);
  for (const task of ["03", "04", "05", "06", "07"]) {
    const key = `t${task}PrerequisiteBytes`;
    prerequisites[key] =
      source[key] === undefined ? undefined : captureByteInput(source[key], `buildOptions.${key}`);
  }
  return Object.freeze({
    fileOverrides: captureFileOverrides(source.fileOverrides),
    runtime: source.runtime,
    ...prerequisites,
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
    if (error instanceof EditorCoreContinuousValidationProofError) throw error;
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

function verifyCurrentPackageReadmeCompletion(bytes) {
  const source = decodeUtf8(bytes, PACKAGE_README_PATH);
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
  return deepFreeze({
    authority: "CURRENT_COMPATIBILITY_ONLY_NOT_FROZEN_M08_T09_AUTHORITY",
    path: PACKAGE_README_PATH,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    task: "M08-T10",
    taskStatus: "DONE",
    gate: "G08",
    gateStatus: "DONE",
    s002Status: "TESTED",
    p18Status: "PROVEN",
    m08Progress: "10/10",
    nextTask: "M09-T01",
  });
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof EditorCoreContinuousValidationProofError) throw error;
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
    if (statement.name?.text !== undefined) names.push(statement.name.text);
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
      if (element.propertyName !== undefined)
        fail("SOURCE_DRIFT", `${fileName} aliases an export.`);
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

async function authenticatePrerequisites(options) {
  const artifacts = Object.create(null);
  const evidence = [];
  for (const pin of EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS) {
    const taskNumber = pin.task.slice(-2);
    const optionKey = `t${taskNumber}PrerequisiteBytes`;
    const bytes =
      options[optionKey] ??
      (await readNoFollow(pin.path, `frozen ${pin.task} prerequisite`, MAX_AUTHORITY_BYTES));
    if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
      fail("PREREQUISITE_DRIFT", `The exact frozen ${pin.task} artifact receipt did not match.`);
    }
    const artifact = parseJson(bytes, `frozen ${pin.task} prerequisite`);
    if (
      artifact.schemaVersion !== 1 ||
      artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.task !== pin.task ||
      artifact.result !== "PASS" ||
      artifact.claim?.taskStatus !== "DONE"
    ) {
      fail("PREREQUISITE_DRIFT", `The frozen ${pin.task} artifact lost its reviewed PASS profile.`);
    }
    artifacts[pin.task] = deepFreeze(artifact);
    evidence.push(
      Object.freeze({
        task: pin.task,
        path: pin.path,
        bytes: pin.bytes,
        sha256: pin.sha256,
        result: "PASS",
        authentication: "DIRECT_NO_FOLLOW_EXACT_BYTES",
        liveProofReaderInput: false,
        checkpointHeadInput: false,
      }),
    );
  }
  if (
    ["03", "04", "05", "06", "07"].some(
      (task) => options[`t${task}PrerequisiteBytes`] !== undefined,
    )
  ) {
    fail("PREREQUISITE_OVERRIDE_REJECTED", "Caller-supplied prerequisite bytes cannot issue PASS.");
  }
  if (Object.hasOwn(artifacts, "M08-T08")) {
    fail("PREREQUISITE_DRIFT", "M08-T08 must not become a formal M08-T09 prerequisite.");
  }
  const t07Artifact = artifacts["M08-T07"];
  if (
    t07Artifact.claim?.proofOnlyNoRuntimeOrTypeExportAdded !== true ||
    t07Artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    t07Artifact.executionAuthority?.editorFiles !== 8 ||
    t07Artifact.executionAuthority?.dependencyFiles !== 21 ||
    !Array.isArray(t07Artifact.executionAuthority?.editorReceipts) ||
    !Array.isArray(t07Artifact.executionAuthority?.dependencyReceipts) ||
    !Array.isArray(t07Artifact.publicApi?.runtimeExports) ||
    !Array.isArray(t07Artifact.publicApi?.typeExports)
  ) {
    fail("PREREQUISITE_DRIFT", "The frozen M08-T07 runtime and export authority drifted.");
  }
  return Object.freeze({
    artifacts: deepFreeze(artifacts),
    evidence: deepFreeze(evidence),
    t07Artifact,
  });
}

function verifyBoundary(files, t07Artifact) {
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
    manifest.scripts?.["test:persistence"] !== "vitest run test/persistence.test.ts" ||
    manifest.scripts?.["test:continuous-validation"] !==
      "vitest run test/continuous-validation.test.ts" ||
    manifest.scripts?.["test:terminal-integration"] !==
      "vitest run test/terminal-integration.test.ts"
  ) {
    fail("MANIFEST_DRIFT", "The editor-core continuous-validation manifest boundary drifted.");
  }

  const predecessorRuntime = [...t07Artifact.publicApi.runtimeExports].sort(compareText);
  const predecessorTypes = [...t07Artifact.publicApi.typeExports].sort(compareText);
  const expectedRuntime = [
    ...predecessorRuntime,
    ...PERSISTENCE_RUNTIME_EXPORTS,
    ...NEW_RUNTIME_EXPORTS,
  ].sort(compareText);
  const expectedTypes = [
    ...predecessorTypes,
    ...PERSISTENCE_TYPE_EXPORTS,
    ...NEW_TYPE_EXPORTS,
  ].sort(compareText);
  if (expectedRuntime.length !== 35 || expectedTypes.length !== 88) {
    fail(
      "PUBLIC_API_DRIFT",
      "The current T08 plus T09 package must expose exactly thirty-five runtime and eighty-eight type exports.",
    );
  }

  const persistenceSourceText = decodeUtf8(
    files.get(PERSISTENCE_SOURCE_PATH),
    PERSISTENCE_SOURCE_PATH,
  );
  const persistenceSourceExports = exportedNames(persistenceSourceText, PERSISTENCE_SOURCE_PATH);
  exactArray(
    persistenceSourceExports.names,
    EXPECTED_PERSISTENCE_SOURCE_EXPORTS,
    "SOURCE_DRIFT",
    "Persistence source exports",
  );
  if (persistenceSourceExports.tsdocDeclarations !== EXPECTED_PERSISTENCE_SOURCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public persistence declaration must retain TSDoc.");
  }

  const continuousSourceText = decodeUtf8(
    files.get(CONTINUOUS_SOURCE_PATH),
    CONTINUOUS_SOURCE_PATH,
  );
  const continuousSourceExports = exportedNames(continuousSourceText, CONTINUOUS_SOURCE_PATH);
  exactArray(
    continuousSourceExports.names,
    EXPECTED_CONTINUOUS_SOURCE_EXPORTS,
    "SOURCE_DRIFT",
    "Continuous-validation source exports",
  );
  if (continuousSourceExports.tsdocDeclarations !== EXPECTED_CONTINUOUS_SOURCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Every public continuous-validation declaration must retain TSDoc.");
  }
  for (const requiredText of [
    "validateDesenExecutionCatalogSet",
    "validateDesenSourceExecutionContracts",
    "digestCanonicalJson",
    "documentFingerprint",
    "catalogSetFingerprint",
    "invalidSubjects",
    "unmappedDiagnosticIndexes",
    "occurrencePointers",
  ]) {
    if (!continuousSourceText.includes(requiredText)) {
      fail("SOURCE_DRIFT", `Continuous validation lost required authority: ${requiredText}`);
    }
  }

  const sourceIndex = reexportedNames(
    decodeUtf8(files.get(INDEX_SOURCE_PATH), INDEX_SOURCE_PATH),
    INDEX_SOURCE_PATH,
  );
  exactArray(sourceIndex.runtime, expectedRuntime, "SOURCE_DRIFT", "Source runtime exports");
  exactArray(sourceIndex.types, expectedTypes, "SOURCE_DRIFT", "Source type exports");

  const distIndexPath = "packages/editor-core/dist/index.js";
  const distIndexDeclarationPath = "packages/editor-core/dist/index.d.ts";
  const distContinuousDeclarationPath = "packages/editor-core/dist/continuous-validation.d.ts";
  const distPersistencePath = "packages/editor-core/dist/persistence.js";
  const distPersistenceDeclarationPath = "packages/editor-core/dist/persistence.d.ts";
  const emittedIndex = reexportedNames(
    decodeUtf8(files.get(distIndexPath), distIndexPath),
    distIndexPath,
  );
  const emittedDeclarationIndex = reexportedNames(
    decodeUtf8(files.get(distIndexDeclarationPath), distIndexDeclarationPath),
    distIndexDeclarationPath,
  );
  exactArray(emittedIndex.runtime, expectedRuntime, "EMITTED_DRIFT", "Emitted runtime exports");
  exactArray(
    emittedDeclarationIndex.runtime,
    expectedRuntime,
    "EMITTED_DRIFT",
    "Emitted declaration runtime exports",
  );
  exactArray(
    emittedDeclarationIndex.types,
    expectedTypes,
    "EMITTED_DRIFT",
    "Emitted declaration type exports",
  );
  const emittedPersistenceRuntime = exportedNames(
    decodeUtf8(files.get(distPersistencePath), distPersistencePath),
    distPersistencePath,
  );
  exactArray(
    emittedPersistenceRuntime.names,
    PERSISTENCE_RUNTIME_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted persistence runtime exports",
  );
  const emittedPersistence = exportedNames(
    decodeUtf8(files.get(distPersistenceDeclarationPath), distPersistenceDeclarationPath),
    distPersistenceDeclarationPath,
  );
  exactArray(
    emittedPersistence.names,
    EXPECTED_PERSISTENCE_SOURCE_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted persistence declarations",
  );
  if (emittedPersistence.tsdocDeclarations !== EXPECTED_PERSISTENCE_SOURCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted persistence declarations lost TSDoc.");
  }
  const emittedContinuous = exportedNames(
    decodeUtf8(files.get(distContinuousDeclarationPath), distContinuousDeclarationPath),
    distContinuousDeclarationPath,
  );
  exactArray(
    emittedContinuous.names,
    EXPECTED_CONTINUOUS_SOURCE_EXPORTS,
    "EMITTED_DRIFT",
    "Emitted continuous-validation declarations",
  );
  if (emittedContinuous.tsdocDeclarations !== EXPECTED_CONTINUOUS_SOURCE_EXPORTS.length) {
    fail("TSDOC_DRIFT", "Emitted continuous-validation declarations lost TSDoc.");
  }

  const emittedStaticEdges = [];
  for (const moduleName of EDITOR_MODULE_NAMES) {
    const relativePath = `packages/editor-core/dist/${moduleName}.js`;
    const text = decodeUtf8(files.get(relativePath), relativePath);
    const specifiers = staticModuleSpecifiers(text);
    emittedStaticEdges.push(...specifiers.map((specifier) => [relativePath, specifier]));
    if (/\bimport\s*\(/u.test(text) || /\beval\s*\(/u.test(text)) {
      fail("PLATFORM_DRIFT", `${relativePath} contains dynamic code loading.`);
    }
    for (const specifier of specifiers) {
      if (
        specifier !== "@desen/protocol" &&
        specifier !== "@desen/validator" &&
        !specifier.startsWith("./")
      ) {
        fail("PLATFORM_DRIFT", `${relativePath} has an unreviewed static edge: ${specifier}`);
      }
    }
  }
  if (emittedStaticEdges.length !== 24) {
    fail("EMITTED_DRIFT", "The emitted editor graph must retain exactly twenty-four static edges.");
  }
  const emittedGraph = EDITOR_MODULE_NAMES.map((name) =>
    decodeUtf8(
      files.get(`packages/editor-core/dist/${name}.js`),
      `packages/editor-core/dist/${name}.js`,
    ),
  ).join("\n");
  for (const forbidden of [
    /\bReact(?:DOM)?\b/u,
    /\b(?:window|navigator|HTMLElement|customElements|MutationObserver|XMLHttpRequest|WebSocket)\b/u,
    /\b(?:node:|fs|path|process|Buffer|fetch|localStorage|indexedDB)\b/u,
    /\b(?:globalThis\.)?document\s*\.\s*(?:body|head|createElement|querySelector|getElementById|addEventListener)\b/u,
  ]) {
    if (forbidden.test(emittedGraph)) {
      fail("PLATFORM_DRIFT", `Forbidden emitted platform authority: ${forbidden}`);
    }
  }

  const focusedTests = testNames(decodeUtf8(files.get(PACKAGE_TEST_PATH), PACKAGE_TEST_PATH));
  const requiredFocusedFragments = [
    "catalog",
    "valid",
    "subject",
    "duplicate",
    "unmapped",
    "fingerprint",
    "obligation",
    "determin",
  ];
  for (const fragment of requiredFocusedFragments) {
    if (!focusedTests.some((name) => name.toLowerCase().includes(fragment))) {
      fail("TEST_INVENTORY_DRIFT", `Focused tests lost the ${fragment} boundary.`);
    }
  }
  if (focusedTests.length !== 12) {
    fail("TEST_INVENTORY_DRIFT", "Continuous validation must retain exactly twelve focused cases.");
  }
  const focusedTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PACKAGE_TYPES_PATH), PACKAGE_TYPES_PATH),
  );
  if (focusedTypeAssertions !== 9) {
    fail(
      "TEST_INVENTORY_DRIFT",
      "Continuous validation must retain exactly nine focused compiler-negative cases.",
    );
  }
  const persistenceTests = testNames(
    decodeUtf8(files.get(PERSISTENCE_TEST_PATH), PERSISTENCE_TEST_PATH),
  );
  const persistenceTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PERSISTENCE_TYPES_PATH), PERSISTENCE_TYPES_PATH),
  );
  if (persistenceTests.length !== 10 || persistenceTypeAssertions !== 21) {
    fail(
      "TEST_INVENTORY_DRIFT",
      "The non-formal T08 current boundary must retain ten persistence cases and twenty-one compiler-negative assertions.",
    );
  }
  const terminalIntegrationTests = testNames(
    decodeUtf8(files.get(TERMINAL_INTEGRATION_TEST_PATH), TERMINAL_INTEGRATION_TEST_PATH),
  );
  exactArray(
    terminalIntegrationTests,
    EXPECTED_TERMINAL_INTEGRATION_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Terminal-integration behavior inventory",
  );
  const publicTests = testNames(decodeUtf8(files.get(PUBLIC_TEST_PATH), PUBLIC_TEST_PATH));
  const publicTypeAssertions = countTypeAssertions(
    decodeUtf8(files.get(PUBLIC_TYPES_PATH), PUBLIC_TYPES_PATH),
  );
  if (publicTests.length !== 50 || publicTypeAssertions !== 102) {
    fail(
      "TEST_INVENTORY_DRIFT",
      "The current T08 plus T09 public package must retain fifty runtime/root cases and one hundred two compiler-negative assertions.",
    );
  }
  const rootTests = testNames(decodeUtf8(files.get(ROOT_TEST_PATH), ROOT_TEST_PATH));
  exactArray(
    rootTests,
    EDITOR_CORE_CONTINUOUS_VALIDATION_ROOT_TEST_NAMES,
    "TEST_INVENTORY_DRIFT",
    "Root proof inventory",
  );

  return deepFreeze({
    runtimeExports: expectedRuntime,
    typeExports: expectedTypes,
    taskRuntimeExportsAdded: NEW_RUNTIME_EXPORTS.length,
    taskTypeExportsAdded: NEW_TYPE_EXPORTS.length,
    currentNonformalPersistenceRuntimeExports: PERSISTENCE_RUNTIME_EXPORTS.length,
    currentNonformalPersistenceTypeExports: PERSISTENCE_TYPE_EXPORTS.length,
    continuousValidationDeclarations: EXPECTED_CONTINUOUS_SOURCE_EXPORTS.length,
    continuousValidationTsdocDeclarations: continuousSourceExports.tsdocDeclarations,
    emittedFiles: DIST_PATHS.length,
    staticEsmEdges: emittedStaticEdges.length,
    unknownStaticEsmEdges: 0,
    platformNeutral: true,
    focusedBehaviorCases: focusedTests.length,
    focusedCompilerNegativeAssertions: focusedTypeAssertions,
    persistenceBehaviorCases: persistenceTests.length,
    persistenceCompilerNegativeAssertions: persistenceTypeAssertions,
    publicRuntimeAndRootCases: publicTests.length,
    publicCompilerNegativeAssertions: publicTypeAssertions,
    rootProofCases: rootTests.length,
    terminalProofSuccessor: {
      task: "M08-T10",
      authority: "PROOF_ONLY_CURRENT_TERMINAL_SUCCESSOR",
      focusedTestPath: TERMINAL_INTEGRATION_TEST_PATH,
      runtimeExportsAdded: 0,
      typeExportsAdded: 0,
      focusedRuntimeCases: terminalIntegrationTests.length,
      publicRuntimeCasesAdded: 0,
      publicCompilerNegativeAssertionsAdded: 0,
    },
  });
}

function prerequisiteReceipt(prerequisite, relativePath, collection) {
  const candidates = prerequisite.executionAuthority?.[collection];
  const matches = Array.isArray(candidates)
    ? candidates.filter((candidate) => candidate?.path === relativePath)
    : [];
  if (matches.length !== 1) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Missing M08-T07 receipt: ${relativePath}`);
  }
  const candidate = matches[0];
  if (
    JSON.stringify(Reflect.ownKeys(candidate)) !== JSON.stringify(["path", "bytes", "sha256"]) ||
    !Number.isSafeInteger(candidate.bytes) ||
    candidate.bytes < 0 ||
    typeof candidate.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(candidate.sha256)
  ) {
    fail("RUNTIME_AUTHORITY_DRIFT", `Malformed M08-T07 receipt: ${relativePath}`);
  }
  return candidate;
}

function authenticateRuntimeClosure(t07Artifact, prerequisiteEvidence, files) {
  const dependencyReceipts = DEPENDENCY_RUNTIME_PATHS.map((relativePath) => {
    const authority = prerequisiteReceipt(t07Artifact, relativePath, "dependencyReceipts");
    const bytes = files.get(relativePath);
    if (authority.bytes !== bytes.byteLength || authority.sha256 !== sha256(bytes)) {
      fail("RUNTIME_AUTHORITY_DRIFT", `Dependency byte drifted: ${relativePath}`);
    }
    return receipt(relativePath, bytes);
  }).sort((left, right) => compareText(left.path, right.path));
  for (const relativePath of RETAINED_T07_EDITOR_RUNTIME_PATHS) {
    const authority = prerequisiteReceipt(t07Artifact, relativePath, "editorReceipts");
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
    retainedPredecessorEditorFiles: RETAINED_T07_EDITOR_RUNTIME_PATHS.length,
    currentNonformalPersistenceEditorFiles: 1,
    dependencyFiles: dependencyReceipts.length,
    dependencyModules: PROTOCOL_RUNTIME_PATHS.length + VALIDATOR_RUNTIME_PATHS.length,
    dependencyManifests: 2,
    prerequisites: prerequisiteEvidence.map(({ task, path: artifactPath, sha256: digest }) => ({
      task,
      path: artifactPath,
      sha256: digest,
    })),
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

async function importReceiptedRuntime(files, expectedRuntimeExports) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "desen-m08-t09-runtime-"));
  try {
    const copies = ISOLATED_RUNTIME_PATHS.map((relativePath) => ({
      bytes: files.get(relativePath),
      destination: isolatedDestination(directory, relativePath),
    }));
    const entryPath = path.join(directory, "entry.mjs");
    copies.push({
      bytes: Buffer.from(
        'import * as editorCore from "@desen/editor-core";\nexport { editorCore };\n',
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
    return Object.freeze(
      Object.fromEntries(expectedRuntimeExports.map((name) => [name, imported.editorCore[name]])),
    );
  } catch (error) {
    if (error instanceof EditorCoreContinuousValidationProofError) throw error;
    fail(
      "RUNTIME_AUTHORITY_DRIFT",
      "The exact receipted editor runtime graph could not be imported in isolation.",
      String(error),
    );
  } finally {
    await rm(directory, { force: true, recursive: true }).catch(() => undefined);
  }
}

function expectAdmittedDocument(runtime, input, label) {
  const result = runtime.createDesenEditorDocument(input);
  if (
    result?.ok !== true ||
    result.document === undefined ||
    JSON.stringify(Reflect.ownKeys(result)) !== JSON.stringify(["ok", "document", "diagnostics"])
  ) {
    fail("BEHAVIOR_DRIFT", `${label} was not admitted as one direct editor Source.`);
  }
  assertDeepFrozen(result, `${label} creation result`);
  assertDeepFrozen(result.document, `${label} document`);
  return result.document;
}

function expectBoundValidator(runtime, catalogs, label) {
  const result = runtime.createDesenEditorContinuousValidator(catalogs);
  if (
    result?.ok !== true ||
    result.validator === undefined ||
    result.diagnostics?.length !== 0 ||
    typeof result.validator.validate !== "function" ||
    !/^sha256:[0-9a-f]{64}$/u.test(result.validator.catalogSetFingerprint)
  ) {
    fail("BEHAVIOR_DRIFT", `${label} did not create one Catalog-bound validator.`);
  }
  assertDeepFrozen(result, `${label} creation result`);
  assertDeepFrozen(result.validator, `${label} validator`);
  return result.validator;
}

function expectReportShape(report, label) {
  exactArray(
    Reflect.ownKeys(report),
    [
      "valid",
      "documentFingerprint",
      "catalogSetFingerprint",
      "diagnostics",
      "obligations",
      "invalidSubjects",
      "unmappedDiagnosticIndexes",
    ],
    "BEHAVIOR_DRIFT",
    `${label} keys`,
  );
  if (
    typeof report.valid !== "boolean" ||
    (report.documentFingerprint !== null &&
      !/^sha256:[0-9a-f]{64}$/u.test(report.documentFingerprint)) ||
    !/^sha256:[0-9a-f]{64}$/u.test(report.catalogSetFingerprint) ||
    !Array.isArray(report.diagnostics) ||
    !Array.isArray(report.obligations) ||
    !Array.isArray(report.invalidSubjects) ||
    !Array.isArray(report.unmappedDiagnosticIndexes) ||
    Object.hasOwn(report, "document") ||
    Object.hasOwn(report, "value") ||
    Object.hasOwn(report, "validator")
  ) {
    fail("BEHAVIOR_DRIFT", `${label} report shape drifted.`);
  }
  assertDeepFrozen(report, `${label} report`);
}

function signInDefaultChildren(source) {
  return source.surfaces["sign-in"].root.slots.default;
}

function emptySecondCatalog(validCatalog) {
  const catalog = clone(validCatalog);
  catalog.id = "com.example.empty-catalog";
  catalog.description = "Ordered fingerprint proof Catalog";
  catalog.components = {};
  catalog.behaviors = {};
  catalog.operations = {};
  catalog.resources = {};
  return catalog;
}

function reportReceipt(report) {
  const bytes = Buffer.from(JSON.stringify(report), "utf8");
  return Object.freeze({ bytes: bytes.byteLength, sha256: sha256(bytes) });
}

function verifyBehavior(runtime, validSource, validCatalog) {
  const sourceInput = clone(validSource);
  const catalogInput = clone(validCatalog);
  const sourceBefore = JSON.stringify(sourceInput);
  const catalogBefore = JSON.stringify(catalogInput);
  const document = expectAdmittedDocument(runtime, sourceInput, "baseline Source");
  const validator = expectBoundValidator(runtime, [catalogInput], "baseline Catalog set");
  const baseline = validator.validate(document);
  expectReportShape(baseline, "baseline");
  if (
    baseline.valid !== true ||
    baseline.diagnostics.length !== 0 ||
    baseline.obligations.length !== 7 ||
    baseline.invalidSubjects.length !== 0 ||
    baseline.unmappedDiagnosticIndexes.length !== 0 ||
    baseline.catalogSetFingerprint !== validator.catalogSetFingerprint ||
    JSON.stringify(sourceInput) !== sourceBefore ||
    JSON.stringify(catalogInput) !== catalogBefore
  ) {
    fail("BEHAVIOR_DRIFT", "The valid Source/Catalog baseline or ownership boundary drifted.");
  }

  const secondBaseline = validator.validate(document);
  expectReportShape(secondBaseline, "second baseline");
  if (
    secondBaseline === baseline ||
    JSON.stringify(secondBaseline) !== JSON.stringify(baseline) ||
    secondBaseline.documentFingerprint !== baseline.documentFingerprint
  ) {
    fail("DETERMINISM_DRIFT", "Repeated validation must return fresh byte-equivalent reports.");
  }

  const invalidCatalog = runtime.createDesenEditorContinuousValidator([{ kind: "desen.catalog" }]);
  if (
    invalidCatalog?.ok !== false ||
    invalidCatalog.diagnostics?.[0]?.code !== "SCHEMA_INVALID" ||
    Object.hasOwn(invalidCatalog, "validator")
  ) {
    fail("BEHAVIOR_DRIFT", "Malformed Catalog input exposed a partial validator.");
  }
  assertDeepFrozen(invalidCatalog, "invalid Catalog result");

  const criticalInput = clone(validSource);
  criticalInput.surfaces["sign-in"].root.use = "com.example.unresolved/Unknown";
  const criticalDocument = expectAdmittedDocument(
    runtime,
    criticalInput,
    "critical-subject Source",
  );
  const critical = validator.validate(criticalDocument);
  expectReportShape(critical, "critical-subject");
  if (
    critical.valid !== false ||
    critical.diagnostics.length !== 1 ||
    critical.diagnostics[0]?.code !== "UNKNOWN_CAPABILITY" ||
    critical.diagnostics[0]?.pointer !== "/surfaces/sign-in/root/use" ||
    JSON.stringify(critical.invalidSubjects) !==
      JSON.stringify([
        {
          surfaceId: "sign-in",
          subject: { kind: "node", id: "sign-in.layout" },
          diagnosticIndexes: [0],
          occurrencePointers: ["/surfaces/sign-in/root"],
        },
      ]) ||
    critical.unmappedDiagnosticIndexes.length !== 0
  ) {
    fail("MAPPING_DRIFT", "Explicit critical node-subject mapping drifted.");
  }

  const duplicateInput = clone(validSource);
  signInDefaultChildren(duplicateInput)[0].id = "sign-in.email";
  const duplicateDocument = expectAdmittedDocument(
    runtime,
    duplicateInput,
    "duplicate-subject Source",
  );
  const duplicate = validator.validate(duplicateDocument);
  expectReportShape(duplicate, "duplicate-subject");
  const duplicateDiagnosticIndex = duplicate.diagnostics.findIndex(
    (diagnostic) => diagnostic.code === "DUPLICATE_NODE_ID",
  );
  const duplicateMapping = duplicate.invalidSubjects.find(
    (mapping) =>
      mapping.surfaceId === "sign-in" &&
      mapping.subject?.kind === "node" &&
      mapping.subject?.id === "sign-in.email" &&
      mapping.diagnosticIndexes.includes(duplicateDiagnosticIndex),
  );
  if (
    duplicate.valid !== false ||
    duplicateDiagnosticIndex < 0 ||
    JSON.stringify(duplicateMapping?.occurrencePointers) !==
      JSON.stringify([
        "/surfaces/sign-in/root/slots/default/0",
        "/surfaces/sign-in/root/slots/default/1",
      ])
  ) {
    fail("MAPPING_DRIFT", "Duplicate node occurrences were not mapped exactly and in order.");
  }

  const unmappedInput = clone(validSource);
  unmappedInput.catalogs[0].version = "2.0.0";
  const unmappedDocument = expectAdmittedDocument(runtime, unmappedInput, "unmapped Source");
  const unmapped = validator.validate(unmappedDocument);
  expectReportShape(unmapped, "unmapped");
  if (
    unmapped.valid !== false ||
    unmapped.diagnostics.length !== 1 ||
    unmapped.diagnostics[0]?.code !== "run.desen.validator/CATALOG_REQUIREMENT_MISMATCH" ||
    unmapped.invalidSubjects.length !== 0 ||
    JSON.stringify(unmapped.unmappedDiagnosticIndexes) !== JSON.stringify([0])
  ) {
    fail("MAPPING_DRIFT", "Document-level diagnostics must remain controlled and unmapped.");
  }

  const multiDiagnosticInput = clone(validSource);
  multiDiagnosticInput.surfaces["sign-in"].root.props = {
    direction: "invalid",
    maxWidth: -1,
  };
  const multiDiagnostic = validator.validate(
    expectAdmittedDocument(runtime, multiDiagnosticInput, "multi-diagnostic Source"),
  );
  expectReportShape(multiDiagnostic, "multi-diagnostic");
  if (
    multiDiagnostic.diagnostics.length < 2 ||
    multiDiagnostic.invalidSubjects.length !== 1 ||
    multiDiagnostic.invalidSubjects[0].diagnosticIndexes.length !==
      multiDiagnostic.diagnostics.length ||
    JSON.stringify(multiDiagnostic.invalidSubjects[0].occurrencePointers) !==
      JSON.stringify(["/surfaces/sign-in/root"])
  ) {
    fail("MAPPING_DRIFT", "Multiple diagnostics for one subject were not grouped losslessly.");
  }

  const authoringFirstInput = clone(validSource);
  const authoringSecondInput = clone(validSource);
  authoringFirstInput.authoring = {
    selection: { surfaceId: "sign-in", nodeId: "sign-in.email" },
  };
  authoringSecondInput.authoring = {
    selection: { surfaceId: "sign-in", nodeId: "sign-in.password" },
  };
  const authoringFirst = validator.validate(
    expectAdmittedDocument(runtime, authoringFirstInput, "first authoring Source"),
  );
  const authoringSecond = validator.validate(
    expectAdmittedDocument(runtime, authoringSecondInput, "second authoring Source"),
  );
  if (
    authoringFirst.valid !== true ||
    authoringSecond.valid !== true ||
    authoringFirst.documentFingerprint === authoringSecond.documentFingerprint
  ) {
    fail("FINGERPRINT_DRIFT", "The complete document fingerprint must include root authoring.");
  }

  const emptyCatalog = emptySecondCatalog(validCatalog);
  const orderedFirst = expectBoundValidator(
    runtime,
    [clone(validCatalog), clone(emptyCatalog)],
    "first ordered Catalog set",
  );
  const orderedSecond = expectBoundValidator(
    runtime,
    [clone(emptyCatalog), clone(validCatalog)],
    "second ordered Catalog set",
  );
  const orderedFirstReport = orderedFirst.validate(document);
  const orderedSecondReport = orderedSecond.validate(document);
  if (
    orderedFirst.catalogSetFingerprint === orderedSecond.catalogSetFingerprint ||
    orderedFirstReport.valid !== true ||
    orderedSecondReport.valid !== true ||
    orderedFirstReport.documentFingerprint !== orderedSecondReport.documentFingerprint ||
    orderedFirstReport.catalogSetFingerprint !== orderedFirst.catalogSetFingerprint ||
    orderedSecondReport.catalogSetFingerprint !== orderedSecond.catalogSetFingerprint
  ) {
    fail("FINGERPRINT_DRIFT", "Catalog-set array order must remain fingerprint-significant.");
  }

  const callerCatalog = clone(validCatalog);
  const captured = expectBoundValidator(runtime, [callerCatalog], "caller-owned Catalog set");
  const capturedFingerprint = captured.catalogSetFingerprint;
  callerCatalog.id = "caller-mutated";
  callerCatalog.components = {};
  const capturedReport = captured.validate(document);
  if (
    captured.catalogSetFingerprint !== capturedFingerprint ||
    capturedReport.catalogSetFingerprint !== capturedFingerprint ||
    capturedReport.valid !== true
  ) {
    fail("OWNERSHIP_DRIFT", "The validator retained caller Catalog mutation authority.");
  }

  const obligationKinds = [...new Set(baseline.obligations.map(({ kind }) => kind))].sort(
    compareText,
  );
  if (
    JSON.stringify(obligationKinds) !==
    JSON.stringify(["component-prop", "operation-input", "state-write"])
  ) {
    fail("OBLIGATION_DRIFT", "The exact dynamic obligation-kind handoff drifted.");
  }

  return deepFreeze({
    determinism: {
      repeatedReportByteEquivalent: true,
      freshReportIdentity: true,
      baselineReport: reportReceipt(baseline),
      secondBaselineReport: reportReceipt(secondBaseline),
    },
    catalogCapture: {
      malformedCatalogControlled: true,
      noPartialValidatorOnFailure: true,
      callerMutationDetached: true,
      validatorAndReportsRecursivelyFrozen: true,
    },
    baseline: {
      valid: baseline.valid,
      diagnosticCount: baseline.diagnostics.length,
      obligationCount: baseline.obligations.length,
      obligationKinds,
      documentFingerprint: baseline.documentFingerprint,
      catalogSetFingerprint: baseline.catalogSetFingerprint,
      obligationsDoNotCauseInvalidity: baseline.valid && baseline.obligations.length > 0,
    },
    criticalSubjectMapping: {
      diagnosticCodes: critical.diagnostics.map(({ code }) => code),
      invalidSubjects: critical.invalidSubjects,
      unmappedDiagnosticIndexes: critical.unmappedDiagnosticIndexes,
      explicitContextOnly: true,
      pointerInference: false,
    },
    duplicateOccurrences: {
      diagnosticCodes: duplicate.diagnostics.map(({ code }) => code),
      mapping: duplicateMapping,
      everyExactOccurrenceReturned: true,
      occurrenceOrderDeterministic: true,
    },
    multiDiagnosticSubject: {
      diagnosticCodes: multiDiagnostic.diagnostics.map(({ code }) => code),
      mapping: multiDiagnostic.invalidSubjects[0],
      validatorDiagnosticOrderPreserved: true,
    },
    controlledUnmapped: {
      diagnosticCodes: unmapped.diagnostics.map(({ code }) => code),
      invalidSubjects: unmapped.invalidSubjects,
      unmappedDiagnosticIndexes: unmapped.unmappedDiagnosticIndexes,
      noPointerGuessing: true,
    },
    fingerprints: {
      algorithm: "RFC8785_SHA256",
      authoringSensitiveDocumentFingerprint: true,
      firstAuthoringDocumentFingerprint: authoringFirst.documentFingerprint,
      secondAuthoringDocumentFingerprint: authoringSecond.documentFingerprint,
      orderSensitiveCatalogSetFingerprint: true,
      firstCatalogOrderFingerprint: orderedFirst.catalogSetFingerprint,
      secondCatalogOrderFingerprint: orderedSecond.catalogSetFingerprint,
      identicalDocumentAcrossCatalogOrders: true,
    },
  });
}

async function authenticateFrozenArtifact() {
  const bytes = await readNoFollow(ARTIFACT_PATH, "frozen M08-T09 proof artifact");
  const digest = sha256(bytes);
  if (bytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes || digest !== FROZEN_ARTIFACT_PIN.sha256) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T09 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(bytes, "frozen M08-T09 proof artifact");
  const receipts = artifact.trackedBoundary?.receipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.proofId !== "editor-core-continuous-validation" ||
    artifact.profile !== "desen.editor-core.continuous-validation-proof.v1" ||
    artifact.task !== "M08-T09" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.catalogBoundContinuousValidation !== true ||
    artifact.claim?.deterministicFrozenReports !== true ||
    artifact.publicApi?.runtimeExports?.length !== 35 ||
    artifact.publicApi?.typeExports?.length !== 88 ||
    artifact.trackedBoundary?.files !== 99 ||
    !Array.isArray(receipts) ||
    receipts.length !== 99 ||
    new Set(receipts.map((candidate) => candidate?.path)).size !== receipts.length ||
    artifact.executionAuthority?.mode !== "AUTHENTICATED_BYTE_COPY_ISOLATED_ESM_GRAPH" ||
    artifact.executionAuthority?.runtimeFiles !== 31 ||
    artifact.executionAuthority?.editorFiles !== 10 ||
    artifact.executionAuthority?.dependencyFiles !== 21 ||
    artifact.testAuthority?.focusedBehaviorCases !== 12 ||
    artifact.testAuthority?.focusedCompilerNegativeAssertions !== 9 ||
    artifact.testAuthority?.publicRuntimeAndRootCases !== 50 ||
    artifact.testAuthority?.publicCompilerNegativeAssertions !== 102 ||
    artifact.testAuthority?.rootProofCases !==
      EDITOR_CORE_CONTINUOUS_VALIDATION_ROOT_TEST_NAMES.length
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M08-T09 artifact identity or retained claim drifted.");
  }
  return Object.freeze({
    artifact: deepFreeze(artifact),
    artifactBytes: Buffer.from(bytes),
    artifactSha256: digest,
  });
}

function assertRetainedT09Receipts(frozenArtifact, files) {
  const receipts = new Map(
    frozenArtifact.trackedBoundary.receipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_T09_RECEIPT_PATHS) {
    const authority = receipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M08-T09 receipt drifted: ${relativePath}`);
    }
  }
}

export async function buildEditorCoreContinuousValidationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  if (options.runtime !== undefined) {
    fail("RUNTIME_OVERRIDE_REJECTED", "A caller-supplied runtime cannot issue PASS.");
  }
  const frozen = await authenticateFrozenArtifact();
  const prerequisites = await authenticatePrerequisites(options);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(relativePath, await trackedBytes(relativePath, options));
  }
  const packageReadmeCompletion = verifyCurrentPackageReadmeCompletion(
    files.get(PACKAGE_README_PATH),
  );
  const boundary = verifyBoundary(files, prerequisites.t07Artifact);
  const executionAuthority = authenticateRuntimeClosure(
    prerequisites.t07Artifact,
    prerequisites.evidence,
    files,
  );
  const runtime = await importReceiptedRuntime(files, boundary.runtimeExports);
  const validSource = parseJson(files.get(SOURCE_FIXTURE_PATH), SOURCE_FIXTURE_PATH);
  const validCatalog = parseJson(files.get(CATALOG_FIXTURE_PATH), CATALOG_FIXTURE_PATH);
  const behavior = verifyBehavior(runtime, validSource, validCatalog);
  if (JSON.stringify(behavior) !== JSON.stringify(frozen.artifact.behavior)) {
    fail("BEHAVIOR_DRIFT", "The retained M08-T09 behavior left its frozen claim.");
  }
  assertRetainedT09Receipts(frozen.artifact, files);
  if (options.fileOverrides.size !== 0) {
    fail("BOUNDARY_DRIFT", "Mutation overrides cannot issue continuous-validation evidence.");
  }

  const receipts = [...files.entries()]
    .map(([relativePath, bytes]) => receipt(relativePath, bytes))
    .sort((left, right) => compareText(left.path, right.path));
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-continuous-validation",
    profile: "desen.editor-core.continuous-validation-proof.v1",
    task: "M08-T09",
    result: "PASS",
    prerequisites: prerequisites.evidence,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      catalogBoundContinuousValidation: true,
      cumulativeExecutionContractDiagnostics: true,
      explicitSubjectInvalidNodeMapping: true,
      duplicateOccurrenceMapping: true,
      controlledUnmappedDiagnostics: true,
      dynamicObligationsPreserved: true,
      completeAuthoringSensitiveDocumentFingerprint: true,
      orderSensitiveCatalogSetFingerprint: true,
      deterministicFrozenReports: true,
      taskStatus: "DONE",
      prerequisiteTasks: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map(
        ({ task }) => task,
      ),
      prerequisiteStatuses: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map(() => "DONE"),
      m08T08FormalPrerequisite: false,
      m08T08CurrentGraphCompatibility: true,
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      taskRuntimeExportsAdded: boundary.taskRuntimeExportsAdded,
      taskTypeExportsAdded: boundary.taskTypeExportsAdded,
      currentNonformalPersistenceRuntimeExports: boundary.currentNonformalPersistenceRuntimeExports,
      currentNonformalPersistenceTypeExports: boundary.currentNonformalPersistenceTypeExports,
      continuousValidationDeclarations: boundary.continuousValidationDeclarations,
      continuousValidationTsdocDeclarations: boundary.continuousValidationTsdocDeclarations,
      resultFields: [
        "valid",
        "documentFingerprint",
        "catalogSetFingerprint",
        "diagnostics",
        "obligations",
        "invalidSubjects",
        "unmappedDiagnosticIndexes",
      ],
      mappingFields: ["surfaceId", "subject", "diagnosticIndexes", "occurrencePointers"],
      terminalProofSuccessor: boundary.terminalProofSuccessor,
    },
    packageReadmeCompletion,
    behavior,
    executionAuthority,
    packageBoundary: {
      currentEmittedFiles: boundary.emittedFiles,
      staticEsmEdges: boundary.staticEsmEdges,
      unknownStaticEsmEdges: boundary.unknownStaticEsmEdges,
      platformNeutral: boundary.platformNeutral,
      manifestExportRoots: ["."],
      productionDependencies: ["@desen/protocol", "@desen/validator"],
      reactImports: 0,
      domImports: 0,
      nodeImports: 0,
      networkOrStorageAuthority: false,
      currentNonformalPersistenceModuleAudited: true,
    },
    testAuthority: {
      focusedBehaviorCases: boundary.focusedBehaviorCases,
      focusedCompilerNegativeAssertions: boundary.focusedCompilerNegativeAssertions,
      persistenceBehaviorCases: boundary.persistenceBehaviorCases,
      persistenceCompilerNegativeAssertions: boundary.persistenceCompilerNegativeAssertions,
      publicRuntimeAndRootCases: boundary.publicRuntimeAndRootCases,
      publicCompilerNegativeAssertions: boundary.publicCompilerNegativeAssertions,
      rootProofCases: boundary.rootProofCases,
      terminalIntegrationRuntimeCases: boundary.terminalProofSuccessor.focusedRuntimeCases,
    },
    trackedBoundary: { files: receipts.length, receipts },
    nonclaims: [
      "POINTER_TEXT_AS_SUBJECT_IDENTITY_AUTHORITY",
      "DIAGNOSTIC_MAPPING_WITHOUT_EXPLICIT_SURFACE_AND_SUBJECT_CONTEXT",
      "DYNAMIC_OBLIGATION_EXECUTION_OR_VALUE_RESOLUTION",
      "CATALOG_FETCH_PACKAGE_LOADING_OR_ADAPTER_EXECUTION",
      "PERSISTENCE_STORAGE_OR_DURABILITY_AUTHORITY",
      "UNDO_REDO_SELECTION_OR_VIEWPORT_POLICY",
      "M08_T10_TERMINAL_BYTES_ARE_COMPATIBILITY_ONLY_NOT_M08_T09_CLAIM_AUTHORITY",
      "CURRENT_PACKAGE_README_BYTES_ARE_COMPATIBILITY_ONLY_NOT_M08_T09_CLAIM_AUTHORITY",
      "REACT_RENDERER_COMPONENT_OR_DOM_BEHAVIOR",
      "HOSTILE_JAVASCRIPT_SANDBOX",
      "NODE_RUNTIME_ESM_LOADER_AND_PROCESS_ENVIRONMENT_ARE_TRUSTED_AUTHORITIES",
      "P18_OR_G08_ADVANCEMENT",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:continuous-validation",
      "pnpm --filter @desen/editor-core test:public-package",
      "pnpm --filter @desen/editor-core test:terminal-integration",
      "node scripts/generate-editor-core-continuous-validation-proof.mjs",
      "node scripts/verify-editor-core-continuous-validation.mjs",
      "node --test tests/editor-core-continuous-validation.test.mjs",
    ],
    frozenAuthority: {
      path: ARTIFACT_PATH,
      bytes: FROZEN_ARTIFACT_PIN.bytes,
      sha256: FROZEN_ARTIFACT_PIN.sha256,
      retainedTaskTimeReceipts: RETAINED_T09_RECEIPT_PATHS.length,
      formalPrerequisiteTasks: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map(
        ({ task }) => task,
      ),
    },
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
    task: "M08-T09",
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
    /\bM08-T09\b[^\n]*(?:NOT_STARTED|IN_PROGRESS|FAIL)/iu,
    /\bStatus:\s*(?:NOT_STARTED|IN_PROGRESS|FAIL)/iu,
    /\bResult:\s*FAIL/iu,
  ]) {
    if (contradiction.test(proof)) {
      fail("PROOF_PIN_DRIFT", "The visible proof document contradicts its PASS authority.");
    }
  }
}

export async function verifyEditorCoreContinuousValidationEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  const built = await buildEditorCoreContinuousValidationEvidence(options.buildOptions);
  const committed =
    options.artifactBytes ??
    (await readNoFollow(options.artifactPath ?? ARTIFACT_PATH, "M08-T09 proof artifact"));
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M08-T09 artifact is not the exact fresh build.");
  }
  const proofBytes =
    options.proofDocumentBytes ??
    (await readNoFollow(
      options.proofDocumentPath ?? PROOF_DOCUMENT_PATH,
      "M08-T09 proof document",
    ));
  verifyProofPin(decodeUtf8(proofBytes, "M08-T09 proof document"), built.artifactSha256);
  return deepFreeze({
    task: built.task,
    result: "PASS",
    artifactPath: ARTIFACT_PATH,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
    directPredecessorSha256: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.at(-1).sha256,
    prerequisiteTasks: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map(({ task }) => task),
    prerequisiteSha256s: EDITOR_CORE_CONTINUOUS_VALIDATION_PREREQUISITE_PINS.map(
      ({ sha256: digest }) => digest,
    ),
    m08T08FormalPrerequisite: false,
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
    if (error instanceof EditorCoreContinuousValidationProofError) throw error;
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

export async function writeEditorCoreContinuousValidationEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreContinuousValidationEvidence();
  const destinationPath = await assertSafeDestination(
    options.destinationPath ?? DEFAULT_EDITOR_CORE_CONTINUOUS_VALIDATION_ARTIFACT_PATH,
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
  const committed = await readNoFollow(destinationPath, "committed M08-T09 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Atomic writer committed non-exact M08-T09 bytes.");
  }
  return deepFreeze({
    task: built.task,
    artifactPath: destinationPath,
    artifactBytes: committed.byteLength,
    artifactSha256: built.artifactSha256,
  });
}
