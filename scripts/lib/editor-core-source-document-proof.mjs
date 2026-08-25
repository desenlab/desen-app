import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import * as editorCorePublicApi from "../../packages/editor-core/dist/index.js";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const FIXTURE_PATH =
  "packages/protocol/upstream/0.1.0/snapshot/conformance/valid/sign-in.source.json";
const PACKAGE_PATH = "packages/editor-core/package.json";
const SOURCE_PATH = "packages/editor-core/src/source-document.ts";
const INDEX_PATH = "packages/editor-core/src/index.ts";
const DIST_SOURCE_PATH = "packages/editor-core/dist/source-document.js";
const DIST_INDEX_PATH = "packages/editor-core/dist/index.js";
const DIST_SOURCE_DECLARATION_PATH = "packages/editor-core/dist/source-document.d.ts";
const DIST_INDEX_DECLARATION_PATH = "packages/editor-core/dist/index.d.ts";
const PACKAGE_TEST_PATH = "packages/editor-core/test/source-document.test.ts";
const PACKAGE_TYPES_PATH = "packages/editor-core/test/source-document.types.ts";
const PUBLIC_TEST_PATH = "packages/editor-core/test/public-package.mjs";
const PUBLIC_TYPES_PATH = "packages/editor-core/test/public-package.types.mts";
const GENERATOR_PATH = "scripts/generate-editor-core-source-document-proof.mjs";
const VERIFIER_PATH = "scripts/verify-editor-core-source-document.mjs";
const PROOF_LIBRARY_PATH = "scripts/lib/editor-core-source-document-proof.mjs";
const ATOMIC_WRITER_PATH = "scripts/lib/atomic-proof-artifact.mjs";
const ROOT_TEST_PATH = "tests/editor-core-source-document.test.mjs";
const PROOF_DOCUMENT_PATH = "docs/proof/EDITOR-CORE-SOURCE-DOCUMENT.md";
const ARTIFACT_PATH = "docs/proof/artifacts/editor-core-0.1.0-source-document.json";
const I07_04_PREREQUISITE_PATH = "docs/proof/baselines/i07-04-affected-selector-promotion.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

export const EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN = Object.freeze({
  task: "I07-04",
  gate: "G07",
  path: I07_04_PREREQUISITE_PATH,
  bytes: 88_341,
  sha256: "76a29908843c0bb9a4ca5ad74b5bc94383c3fa21463ce81e98bf53e8f01d7549",
});

export const EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES = Object.freeze([
  "[authority] builds final M08-T01 evidence from the exact G07/I07-04 prerequisite",
  "[determinism] two final evidence builds are byte-identical",
  "[prerequisite] rejects changed I07-04 bytes and incomplete hosted closure",
  "[behavior] rejects wrappers, mutation authority, partial failure, and semantic overreach",
  "[boundary] rejects source, TSDoc, import, distribution, and manifest drift",
  "[inventory] rejects package, public, and root test-authority drift",
  "[artifact] verifies exact bytes and the exact proof-document pin",
  "[writer] atomically writes exact bytes and preserves an existing destination on failure",
  "[writer-filesystem] rejects linked and non-file artifact destinations",
  "[options] rejects unknown, accessor, inherited, symbol, proxy, and shared inputs",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
  "[utf8] rejects invalid proof UTF-8 without normalization",
  "[immutability] freezes final evidence and keeps later M08 scope explicit",
]);

export const DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

const EXPECTED_RUNTIME_EXPORTS = Object.freeze(["createDesenEditorDocument"]);
const EXPECTED_TYPE_EXPORTS = Object.freeze([
  "DesenEditorDocument",
  "DesenEditorDocumentCreationFailure",
  "DesenEditorDocumentCreationResult",
  "DesenEditorDocumentCreationSuccess",
]);
const EXPECTED_SOURCE_EXPORTS = Object.freeze([
  "createDesenEditorDocument",
  "DesenEditorDocument",
  "DesenEditorDocumentCreationFailure",
  "DesenEditorDocumentCreationResult",
  "DesenEditorDocumentCreationSuccess",
]);
const EXPECTED_TRACKED_PATHS = Object.freeze(
  [
    FIXTURE_PATH,
    PACKAGE_PATH,
    "packages/editor-core/README.md",
    INDEX_PATH,
    SOURCE_PATH,
    PACKAGE_TEST_PATH,
    PACKAGE_TYPES_PATH,
    PUBLIC_TEST_PATH,
    PUBLIC_TYPES_PATH,
    "packages/editor-core/tsconfig.build.json",
    "packages/editor-core/tsconfig.public-package.json",
    DIST_INDEX_PATH,
    DIST_INDEX_DECLARATION_PATH,
    "packages/editor-core/dist/index.d.ts.map",
    "packages/editor-core/dist/index.js.map",
    DIST_SOURCE_PATH,
    DIST_SOURCE_DECLARATION_PATH,
    "packages/editor-core/dist/source-document.d.ts.map",
    "packages/editor-core/dist/source-document.js.map",
    GENERATOR_PATH,
    VERIFIER_PATH,
    PROOF_LIBRARY_PATH,
    ATOMIC_WRITER_PATH,
    ROOT_TEST_PATH,
  ].sort(),
);
const FORBIDDEN_IDENTIFIER_NAMES = Object.freeze([
  "Buffer",
  "CSSStyleSheet",
  "Date",
  "Document",
  "Element",
  "Function",
  "HTMLElement",
  "Intl",
  "MutationObserver",
  "Node",
  "React",
  "ReactDOM",
  "Request",
  "Response",
  "WebSocket",
  "Worker",
  "eval",
  "fetch",
  "globalThis",
  "indexedDB",
  "localStorage",
  "navigator",
  "performance",
  "process",
  "sessionStorage",
  "window",
]);

/** Controlled failure emitted by the final deterministic M08-T01 proof. */
export class EditorCoreSourceDocumentProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreSourceDocumentProofError";
    this.code = code;
    this.details = deepFreeze(details);
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreSourceDocumentProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function captureOwnDataRecord(value, label, allowedKeys = undefined) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  ) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be a plain own-data object.`);
  }
  let prototype;
  let keys;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} has an unsupported prototype.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || (allowedKeys !== undefined && !allowedKeys.includes(key))) {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} contains an unknown field.`);
    }
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label}.${key} is not safely inspectable.`);
    }
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label}.${key} must be own data.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureByteView(value, label) {
  if (value === null || typeof value !== "object" || utilTypes.isProxy(value)) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be copied bytes.`);
  }
  let prototype;
  let backingBuffer;
  try {
    prototype = Object.getPrototypeOf(value);
    backingBuffer = value.buffer;
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be captured safely.`);
  }
  if (prototype !== Buffer.prototype && prototype !== Uint8Array.prototype) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be Buffer or Uint8Array bytes.`);
  }
  if (typeof SharedArrayBuffer === "function" && backingBuffer instanceof SharedArrayBuffer) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must not use shared memory.`);
  }
  try {
    return Buffer.from(value);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} could not be copied safely.`);
  }
}

function capturePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID", `${label} must be a non-empty path string.`);
  }
  return path.resolve(value);
}

function normalizeBuildOptions(options) {
  const rawOverrides = options.fileOverrides;
  const overrides = Object.create(null);
  if (rawOverrides !== undefined) {
    const capturedOverrides = captureOwnDataRecord(rawOverrides, "fileOverrides");
    for (const [relativePath, value] of Object.entries(capturedOverrides)) {
      if (!EXPECTED_TRACKED_PATHS.includes(relativePath)) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
          `fileOverrides contains an untracked path: ${relativePath}.`,
        );
      }
      if (typeof value !== "string" && !Buffer.isBuffer(value)) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
          `fileOverrides.${relativePath} must be text or Buffer bytes.`,
        );
      }
      overrides[relativePath] =
        typeof value === "string"
          ? Buffer.from(value)
          : captureByteView(value, `fileOverrides.${relativePath}`);
    }
  }
  return Object.freeze({
    fileOverrides: Object.freeze(overrides),
    runtimeApi: captureRuntimeApi(options.runtimeApi),
    prerequisiteBytes:
      options.prerequisiteBytes === undefined
        ? undefined
        : captureByteView(options.prerequisiteBytes, "prerequisiteBytes"),
    prerequisitePath:
      options.prerequisitePath === undefined
        ? path.join(WORKSPACE_ROOT, I07_04_PREREQUISITE_PATH)
        : capturePath(options.prerequisitePath, "prerequisitePath"),
  });
}

function captureBuildOptions(rawOptions) {
  if (rawOptions === undefined) return normalizeBuildOptions(Object.freeze(Object.create(null)));
  return normalizeBuildOptions(
    captureOwnDataRecord(rawOptions, "build options", [
      "fileOverrides",
      "runtimeApi",
      "prerequisiteBytes",
      "prerequisitePath",
    ]),
  );
}

function captureVerifyOptions(rawOptions) {
  const options =
    rawOptions === undefined
      ? Object.freeze(Object.create(null))
      : captureOwnDataRecord(rawOptions, "verify options", [
          "artifactBytes",
          "artifactPath",
          "fileOverrides",
          "prerequisiteBytes",
          "prerequisitePath",
          "proofDocument",
          "proofDocumentPath",
          "runtimeApi",
        ]);
  const build = normalizeBuildOptions(options);
  return Object.freeze({
    build,
    artifactBytes:
      options.artifactBytes === undefined
        ? undefined
        : captureByteView(options.artifactBytes, "artifactBytes"),
    artifactPath:
      options.artifactPath === undefined
        ? DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH
        : capturePath(options.artifactPath, "artifactPath"),
    proofDocument: options.proofDocument,
    proofDocumentPath:
      options.proofDocumentPath === undefined
        ? path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH)
        : capturePath(options.proofDocumentPath, "proofDocumentPath"),
  });
}

function captureWriteOptions(rawOptions) {
  const options =
    rawOptions === undefined
      ? Object.freeze(Object.create(null))
      : captureOwnDataRecord(rawOptions, "write options", [
          "artifactPath",
          "beforeAtomicRename",
          "buildOptions",
        ]);
  if (
    options.beforeAtomicRename !== undefined &&
    typeof options.beforeAtomicRename !== "function"
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "beforeAtomicRename must be a function when provided.",
    );
  }
  return Object.freeze({
    artifactPath:
      options.artifactPath === undefined
        ? DEFAULT_EDITOR_CORE_SOURCE_DOCUMENT_ARTIFACT_PATH
        : capturePath(options.artifactPath, "artifactPath"),
    beforeAtomicRename: options.beforeAtomicRename,
    build: captureBuildOptions(options.buildOptions),
  });
}

async function readRegularAuthority(absolutePath, label, maximumBytes = MAX_AUTHORITY_BYTES) {
  const resolvedInput = path.resolve(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(path.dirname(resolvedInput));
  } catch (error) {
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} parent is unavailable.`, {
      cause: String(error),
    });
  }
  const canonicalPath = path.join(canonicalParent, path.basename(resolvedInput));
  if (canonicalPath !== resolvedInput) {
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} must not traverse a linked parent.`);
  }
  let before;
  let handle;
  try {
    before = await lstat(canonicalPath);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > maximumBytes
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE",
        `${label} must be one bounded regular non-linked file.`,
      );
    }
    handle = await open(canonicalPath, READ_FLAGS);
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      opened.size !== before.size ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino
    ) {
      fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} identity changed before read.`);
    }
    const bytes = await handle.readFile();
    const after = await lstat(canonicalPath);
    if (
      !after.isFile() ||
      after.nlink !== 1 ||
      bytes.byteLength !== opened.size ||
      bytes.byteLength > maximumBytes ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      after.ctimeMs !== opened.ctimeMs
    ) {
      fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} changed while it was read.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail("EDITOR_SOURCE_DOCUMENT_AUTHORITY_UNSAFE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function fatalUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

async function readTrackedBytes(relativePath, overrides) {
  if (Object.hasOwn(overrides, relativePath)) return Buffer.from(overrides[relativePath]);
  return readRegularAuthority(
    path.join(WORKSPACE_ROOT, relativePath),
    `Required file ${relativePath}`,
  );
}

async function readTrackedText(relativePath, overrides) {
  return fatalUtf8(await readTrackedBytes(relativePath, overrides), relativePath);
}

function parseJson(text, relativePath) {
  try {
    return JSON.parse(text);
  } catch {
    fail("EDITOR_SOURCE_DOCUMENT_JSON_INVALID", `Required JSON is invalid: ${relativePath}.`);
  }
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function inspectFrozenInertJson(root, label) {
  const pending = [{ value: root, pointer: "" }];
  const visited = new Set();
  const objects = new Set();
  while (pending.length > 0) {
    const { value, pointer } = pending.pop();
    if (value === null || typeof value === "string" || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) continue;
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a non-finite number.`,
      );
    }
    if (typeof value !== "object") {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a non-JSON ${typeof value} value.`,
      );
    }
    if (utilTypes.isProxy(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} contains a Proxy.`);
    }
    if (visited.has(value)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a cycle or aliased JSON object.`,
      );
    }
    visited.add(value);
    objects.add(value);
    let prototype;
    let keys;
    try {
      prototype = Object.getPrototypeOf(value);
      keys = Reflect.ownKeys(value);
    } catch {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} could not be inspected safely.`,
      );
    }
    const array = Array.isArray(value);
    if (!Object.isFrozen(value) || prototype !== (array ? Array.prototype : Object.prototype)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} must be frozen plain JSON data.`,
      );
    }
    if (keys.some((key) => typeof key !== "string")) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} contains a symbol property.`,
      );
    }
    const expectedArrayKeys = array
      ? [...Array.from({ length: value.length }, (_, index) => String(index)), "length"]
      : undefined;
    if (array && !exactJson(keys, expectedArrayKeys)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} must be a dense JSON array with only index keys and length.`,
      );
    }
    for (const key of keys) {
      let descriptor;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        fail(
          "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
          `${label}${pointer}/${key} could not be inspected safely.`,
        );
      }
      const arrayLength = array && key === "length";
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable === arrayLength
      ) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
          `${label}${pointer}/${key} is not an exact own-data JSON property.`,
        );
      }
      if (!arrayLength) pending.push({ value: descriptor.value, pointer: `${pointer}/${key}` });
    }
  }
  return Object.freeze({ objects });
}

function captureRuntimeApi(value) {
  const candidate =
    value === undefined
      ? { createDesenEditorDocument: editorCorePublicApi.createDesenEditorDocument }
      : value;
  const api = captureOwnDataRecord(candidate, "runtimeApi", ["createDesenEditorDocument"]);
  if (typeof api.createDesenEditorDocument !== "function") {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "runtimeApi.createDesenEditorDocument must be a function.",
    );
  }
  return Object.freeze({ createDesenEditorDocument: api.createDesenEditorDocument });
}

function assertRejected(result, pointer, label) {
  const inspected = inspectFrozenInertJson(result, `${label} result`);
  if (
    result.ok !== false ||
    !exactJson(Reflect.ownKeys(result), ["ok", "diagnostics"]) ||
    Object.hasOwn(result, "document") ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length !== 1 ||
    result.diagnostics[0]?.code !== "SCHEMA_INVALID" ||
    result.diagnostics[0]?.pointer !== pointer
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      `${label} no longer rejects with the exact closed diagnostic shell.`,
    );
  }
  return inspected;
}

function assertCallerGraphUnfrozenAndDetached(input, outputObjects, label) {
  const pending = [{ value: input, pointer: "" }];
  const visited = new Set();
  while (pending.length > 0) {
    const { value, pointer } = pending.pop();
    if (value === null || typeof value !== "object" || visited.has(value)) continue;
    if (utilTypes.isProxy(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} contains a Proxy.`);
    }
    visited.add(value);
    if (Object.isFrozen(value)) {
      fail("EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT", `${label}${pointer} was frozen by admission.`);
    }
    if (outputObjects.has(value)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} is retained by the admitted result.`,
      );
    }
    let keys;
    try {
      keys = Reflect.ownKeys(value);
    } catch {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        `${label}${pointer} could not be inspected safely.`,
      );
    }
    for (const key of keys) {
      if (typeof key !== "string" || (Array.isArray(value) && key === "length")) continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        pending.push({ value: descriptor.value, pointer: `${pointer}/${key}` });
      }
    }
  }
}

function assertSuccessfulAdmission(result, input, expectedDocument, label) {
  const inspected = inspectFrozenInertJson(result, `${label} result`);
  if (
    result.ok !== true ||
    !exactJson(Reflect.ownKeys(result), ["ok", "document", "diagnostics"]) ||
    !isDeepStrictEqual(result.document, expectedDocument) ||
    !exactJson(result.diagnostics, []) ||
    Object.hasOwn(result.document, "source") ||
    Object.hasOwn(result.document, "nodes") ||
    Object.hasOwn(result.document, "index") ||
    Object.hasOwn(result.document, "ast")
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      `${label} lost its exact direct Source success contract.`,
    );
  }
  assertCallerGraphUnfrozenAndDetached(input, inspected.objects, `${label} caller`);
  return Object.freeze({
    objects: inspected.objects,
    documentObjects: inspectFrozenInertJson(result.document, `${label} document`).objects,
  });
}

function verifyRuntimeBehavior(runtimeApi, officialSource) {
  if (
    !exactJson(sorted(Object.keys(runtimeApi)), EXPECTED_RUNTIME_EXPORTS) ||
    typeof runtimeApi.createDesenEditorDocument !== "function"
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
      "The built package must expose only createDesenEditorDocument at runtime.",
    );
  }
  const createDocument = runtimeApi.createDesenEditorDocument;
  const firstInput = cloneJson(officialSource);
  const secondInput = cloneJson(officialSource);
  const first = createDocument(firstInput);
  const second = createDocument(secondInput);
  const firstGraph = assertSuccessfulAdmission(
    first,
    firstInput,
    officialSource,
    "first admission",
  );
  const secondGraph = assertSuccessfulAdmission(
    second,
    secondInput,
    officialSource,
    "second admission",
  );
  for (const object of firstGraph.documentObjects) {
    if (secondGraph.documentObjects.has(object)) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
        "Independent admissions share document graph identity.",
      );
    }
  }
  firstInput.id = "caller-mutated-after-admission";
  firstInput.surfaces.extra = cloneJson(officialSource.surfaces["sign-in"]);
  if (
    first.document.id !== officialSource.id ||
    Object.hasOwn(first.document.surfaces, "extra") ||
    !isDeepStrictEqual(second.document, officialSource)
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      "The emitted factory retained caller mutation authority.",
    );
  }

  const unresolved = cloneJson(officialSource);
  unresolved.surfaces["sign-in"].root.use = "com.example.unresolved/Unknown";
  const unresolvedResult = createDocument(unresolved);
  assertSuccessfulAdmission(
    unresolvedResult,
    unresolved,
    unresolved,
    "unresolved semantic admission",
  );

  const invalidRoot = cloneJson(officialSource);
  invalidRoot.kind = "desen.bundle";
  const invalidRootResult = createDocument(invalidRoot);
  const invalidRootGraph = assertRejected(invalidRootResult, "/kind", "invalid Source root");
  assertCallerGraphUnfrozenAndDetached(
    invalidRoot,
    invalidRootGraph.objects,
    "invalid root caller",
  );

  const invalidEmbeddedSchema = cloneJson(officialSource);
  invalidEmbeddedSchema.surfaces["sign-in"].state.email.schema = {
    type: "string",
    pattern: "[",
  };
  const invalidEmbeddedResult = createDocument(invalidEmbeddedSchema);
  const invalidEmbeddedGraph = assertRejected(
    invalidEmbeddedResult,
    "/surfaces/sign-in/state/email/schema/pattern",
    "invalid embedded schema",
  );
  assertCallerGraphUnfrozenAndDetached(
    invalidEmbeddedSchema,
    invalidEmbeddedGraph.objects,
    "invalid embedded-schema caller",
  );

  const executable = cloneJson(officialSource);
  executable.authoring = { executable: () => "not inert JSON" };
  assertRejected(createDocument(executable), "", "executable input");

  let getterCalls = 0;
  let toJsonCalls = 0;
  const accessor = cloneJson(officialSource);
  Object.defineProperty(accessor.authoring, "selection", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return { surfaceId: "sign-in" };
    },
  });
  const serializationHook = cloneJson(officialSource);
  serializationHook.toJSON = () => {
    toJsonCalls += 1;
    return cloneJson(officialSource);
  };
  assertRejected(createDocument(accessor), "", "accessor input");
  assertRejected(createDocument(serializationHook), "", "serialization-hook input");
  if (getterCalls !== 0 || toJsonCalls !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_BEHAVIOR_DRIFT",
      "The emitted factory invoked caller-owned executable hooks.",
    );
  }

  return Object.freeze({
    directSourceRoot: true,
    hiddenModelKeys: Object.freeze([]),
    detached: true,
    independentSnapshots: true,
    deeplyFrozenPlainOwnData: true,
    callerUnfrozen: true,
    unresolvedSemanticsAdmitted: true,
    rejectedVectors: Object.freeze([
      Object.freeze({ vector: "invalid-root", code: "SCHEMA_INVALID", pointer: "/kind" }),
      Object.freeze({
        vector: "invalid-embedded-schema",
        code: "SCHEMA_INVALID",
        pointer: "/surfaces/sign-in/state/email/schema/pattern",
      }),
      Object.freeze({ vector: "executable-non-json", code: "SCHEMA_INVALID", pointer: "" }),
      Object.freeze({ vector: "accessor", code: "SCHEMA_INVALID", pointer: "" }),
      Object.freeze({ vector: "serialization-hook", code: "SCHEMA_INVALID", pointer: "" }),
    ]),
  });
}

function declarationInventory(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtime = [];
  const types = [];
  const missingTsdoc = [];
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
      `${fileName} contains TypeScript parse diagnostics.`,
    );
  }
  for (const statement of sourceFile.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (
      (!ts.isTypeAliasDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isFunctionDeclaration(statement)) ||
      statement.name === undefined ||
      !ts.isIdentifier(statement.name)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
        `${fileName} contains an unsupported public declaration.`,
      );
    }
    const name = statement.name.text;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      types.push(name);
    } else {
      runtime.push(name);
    }
    if (ts.getJSDocCommentsAndTags(statement).length === 0) missingTsdoc.push(name);
  }
  return Object.freeze({
    sourceFile,
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
    missingTsdoc: Object.freeze(sorted(missingTsdoc)),
  });
}

function reexportInventory(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2023,
    true,
    fileName.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const runtime = [];
  const types = [];
  const modules = [];
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
      `${fileName} contains TypeScript parse diagnostics.`,
    );
  }
  for (const statement of sourceFile.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    ) {
      fail(
        "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
        `${fileName} may contain only explicit named re-exports.`,
      );
    }
    modules.push(statement.moduleSpecifier.text);
    for (const element of statement.exportClause.elements) {
      if (element.propertyName !== undefined) {
        fail(
          "EDITOR_SOURCE_DOCUMENT_PUBLIC_API_DRIFT",
          `${fileName} must not alias public exports.`,
        );
      }
      (statement.isTypeOnly || element.isTypeOnly ? types : runtime).push(element.name.text);
    }
  }
  return Object.freeze({
    sourceFile,
    runtime: Object.freeze(sorted(runtime)),
    types: Object.freeze(sorted(types)),
    modules: Object.freeze(sorted(modules)),
  });
}

function verifySourceAndDistributionContract(files, packageManifest) {
  const source = declarationInventory(files[SOURCE_PATH], SOURCE_PATH);
  const sourcePrivateStatements = source.sourceFile.statements.filter(
    (statement) =>
      !ts.isImportDeclaration(statement) &&
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  const sourcePrivateDeclaration = sourcePrivateStatements[0]?.declarationList?.declarations?.[0];
  if (
    source.sourceFile.statements.length !== 9 ||
    sourcePrivateStatements.length !== 1 ||
    !ts.isVariableStatement(sourcePrivateStatements[0]) ||
    sourcePrivateStatements[0].declarationList.declarations.length !== 1 ||
    sourcePrivateDeclaration === undefined ||
    !ts.isIdentifier(sourcePrivateDeclaration.name) ||
    sourcePrivateDeclaration.name.text !== "EMPTY_DIAGNOSTICS" ||
    !exactJson(sorted([...source.runtime, ...source.types]), EXPECTED_SOURCE_EXPORTS) ||
    !exactJson(source.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(source.types, EXPECTED_TYPE_EXPORTS) ||
    source.missingTsdoc.length !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_SOURCE_CONTRACT_DRIFT",
      "The source document public declaration or TSDoc inventory drifted.",
      { runtime: source.runtime, types: source.types, missingTsdoc: source.missingTsdoc },
    );
  }
  const imports = source.sourceFile.statements.filter(ts.isImportDeclaration);
  const importProjection = imports.map((statement) => ({
    module: statement.moduleSpecifier.text,
    typeOnly: statement.importClause?.isTypeOnly === true,
  }));
  if (
    !exactJson(importProjection, [
      { module: "@desen/validator", typeOnly: false },
      { module: "@desen/protocol", typeOnly: true },
      { module: "@desen/validator", typeOnly: true },
    ])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_IMPORT_BOUNDARY_DRIFT",
      "The Source document may import only the validator at runtime and protocol/validator types.",
    );
  }

  const sourceIndex = reexportInventory(files[INDEX_PATH], INDEX_PATH);
  const distIndex = reexportInventory(files[DIST_INDEX_PATH], DIST_INDEX_PATH);
  const declarationIndex = reexportInventory(
    files[DIST_INDEX_DECLARATION_PATH],
    DIST_INDEX_DECLARATION_PATH,
  );
  if (
    !exactJson(sourceIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(sourceIndex.types, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(sourceIndex.modules, ["./source-document.js", "./source-document.js"]) ||
    !exactJson(distIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    distIndex.types.length !== 0 ||
    !exactJson(distIndex.modules, ["./source-document.js"]) ||
    !exactJson(declarationIndex.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(declarationIndex.types, EXPECTED_TYPE_EXPORTS) ||
    !exactJson(declarationIndex.modules, ["./source-document.js", "./source-document.js"])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Source and emitted package-root export inventories no longer agree.",
      {
        sourceIndex: {
          runtime: sourceIndex.runtime,
          types: sourceIndex.types,
          modules: sourceIndex.modules,
        },
        distIndex: {
          runtime: distIndex.runtime,
          types: distIndex.types,
          modules: distIndex.modules,
        },
        declarationIndex: {
          runtime: declarationIndex.runtime,
          types: declarationIndex.types,
          modules: declarationIndex.modules,
        },
      },
    );
  }

  const declaration = declarationInventory(
    files[DIST_SOURCE_DECLARATION_PATH],
    DIST_SOURCE_DECLARATION_PATH,
  );
  if (
    declaration.sourceFile.statements.length !== 7 ||
    !exactJson(declaration.runtime, EXPECTED_RUNTIME_EXPORTS) ||
    !exactJson(declaration.types, EXPECTED_TYPE_EXPORTS) ||
    declaration.missingTsdoc.length !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Emitted declarations lost the reviewed API or TSDoc contract.",
    );
  }

  const emittedSource = ts.createSourceFile(
    DIST_SOURCE_PATH,
    files[DIST_SOURCE_PATH],
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  const emittedImports = emittedSource.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.moduleSpecifier.text);
  const emittedPrivateStatements = emittedSource.statements.filter(
    (statement) =>
      !ts.isImportDeclaration(statement) &&
      !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  const emittedPrivateDeclaration = emittedPrivateStatements[0]?.declarationList?.declarations?.[0];
  if (
    emittedSource.parseDiagnostics.length !== 0 ||
    emittedSource.statements.length !== 3 ||
    emittedPrivateStatements.length !== 1 ||
    !ts.isVariableStatement(emittedPrivateStatements[0]) ||
    emittedPrivateStatements[0].declarationList.declarations.length !== 1 ||
    emittedPrivateDeclaration === undefined ||
    !ts.isIdentifier(emittedPrivateDeclaration.name) ||
    emittedPrivateDeclaration.name.text !== "EMPTY_DIAGNOSTICS" ||
    !exactJson(emittedImports, ["@desen/validator"])
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_DISTRIBUTION_DRIFT",
      "Emitted runtime code acquired an unexpected import.",
    );
  }

  const forbidden = new Set();
  for (const sourceFile of [source.sourceFile, sourceIndex.sourceFile, emittedSource]) {
    function visit(node) {
      if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIER_NAMES.includes(node.text)) {
        forbidden.add(node.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        forbidden.add("dynamic import");
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "eval" || node.expression.text === "Function")
      ) {
        forbidden.add(node.expression.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  if (forbidden.size > 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PLATFORM_BOUNDARY_DRIFT",
      "Platform or executable authority entered editor-core.",
      { forbidden: sorted(forbidden) },
    );
  }

  if (
    !exactJson(packageManifest.exports, {
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
    }) ||
    !exactJson(packageManifest.dependencies, {
      "@desen/protocol": "workspace:*",
      "@desen/validator": "workspace:*",
    }) ||
    !exactJson(packageManifest.files, ["dist"]) ||
    packageManifest.sideEffects !== false
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_MANIFEST_DRIFT",
      "The editor-core manifest lost its exact export or dependency boundary.",
    );
  }

  return Object.freeze({
    runtimeExports: EXPECTED_RUNTIME_EXPORTS,
    typeExports: EXPECTED_TYPE_EXPORTS,
    publicDeclarations: EXPECTED_SOURCE_EXPORTS.length,
    tsdocDeclarations: EXPECTED_SOURCE_EXPORTS.length,
    runtimeImports: Object.freeze(["@desen/validator"]),
    typeImports: Object.freeze(["@desen/protocol", "@desen/validator"]),
    productionDependencies: Object.freeze(["@desen/protocol", "@desen/validator"]),
    platformImports: 0,
    executableAuthority: 0,
  });
}

function verifyTestInventory(files) {
  const rootSourceFile = ts.createSourceFile(
    ROOT_TEST_PATH,
    files[ROOT_TEST_PATH],
    ts.ScriptTarget.ES2023,
    true,
    ts.ScriptKind.JS,
  );
  if (rootSourceFile.parseDiagnostics.length !== 0) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The M08-T01 root proof test contains parse diagnostics.",
    );
  }
  const rootTestNames = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "test" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      rootTestNames.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(rootSourceFile);
  const inventory = deepFreeze({
    packageRuntimeCases: (files[PACKAGE_TEST_PATH].match(/^\s*it\("/gmu) ?? []).length,
    sourceCompilerNegativeCases: (files[PACKAGE_TYPES_PATH].match(/@ts-expect-error/gu) ?? [])
      .length,
    publicRuntimeContractCases: (
      files[PUBLIC_TEST_PATH].match(/^test\("(?!\[proof-core\])/gmu) ?? []
    ).length,
    publicCompilerNegativeCases: (files[PUBLIC_TYPES_PATH].match(/@ts-expect-error/gu) ?? [])
      .length,
    publicProofCoreCases: (files[PUBLIC_TEST_PATH].match(/^test\("\[proof-core\]/gmu) ?? []).length,
    rootProofCases: rootTestNames.length,
    rootTestNames,
  });
  if (
    !exactJson(inventory, {
      packageRuntimeCases: 7,
      sourceCompilerNegativeCases: 5,
      publicRuntimeContractCases: 10,
      publicCompilerNegativeCases: 5,
      publicProofCoreCases: 7,
      rootProofCases: EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES.length,
      rootTestNames: EDITOR_CORE_SOURCE_DOCUMENT_ROOT_TEST_NAMES,
    })
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_TEST_INVENTORY_DRIFT",
      "The reviewed M08-T01 focused test inventory drifted.",
      { actual: inventory },
    );
  }
  return inventory;
}

async function trackedInventory(overrides) {
  const entries = [];
  for (const relativePath of EXPECTED_TRACKED_PATHS) {
    const bytes = await readTrackedBytes(relativePath, overrides);
    entries.push(
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
  }
  return Object.freeze(entries);
}

async function authenticatePrerequisite(options) {
  const bytes =
    options.prerequisiteBytes ??
    (await readRegularAuthority(options.prerequisitePath, "I07-04/G07 prerequisite"));
  const pin = EDITOR_CORE_SOURCE_DOCUMENT_PREREQUISITE_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The exact I07-04/G07 prerequisite bytes drifted.",
      {
        expectedBytes: pin.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: pin.sha256,
        actualSha256: sha256(bytes),
      },
    );
  }
  let authority;
  try {
    authority = JSON.parse(fatalUtf8(bytes, I07_04_PREREQUISITE_PATH));
  } catch (error) {
    if (error instanceof EditorCoreSourceDocumentProofError) throw error;
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The exact I07-04/G07 prerequisite is not valid JSON.",
    );
  }
  const cutover = authority.cutover;
  if (
    authority.schemaVersion !== 1 ||
    authority.profile !== "desen.ci.affected-selector-promotion-evidence.v1" ||
    authority.task !== "I07-04" ||
    authority.repository !== "https://github.com/desenlab/desen-app" ||
    !Array.isArray(authority.observations) ||
    authority.observations.length !== 20 ||
    authority.observations.some(
      (observation) =>
        observation?.quality?.status !== "PASS" ||
        observation.quality.authority !== "REQUIRED" ||
        observation.quality.scope !== "EXHAUSTIVE" ||
        observation?.affected?.status !== "PASS" ||
        observation.affected.freshExecution !== true ||
        observation.affected.cachedSuccessRead !== false,
    ) ||
    authority.threshold?.minimumConsecutiveEligibleComparisons !== 20 ||
    authority.threshold.eligibleComparisons !== 20 ||
    authority.threshold.consecutiveEligibleComparisons !== 20 ||
    authority.threshold.falseNegatives !== 0 ||
    authority.threshold.sameRevisionWithinComparison !== true ||
    authority.threshold.freshHostedExecution !== true ||
    authority.threshold.cachedSuccessAllowed !== false ||
    authority.threshold.satisfied !== true ||
    authority.decision?.status !== "PROMOTION_AUTHORIZED" ||
    authority.decision.affectedPromotionAuthorized !== true ||
    authority.decision.eligiblePullRequests !== "REQUIRED_AFFECTED" ||
    authority.decision.unsafePullRequests !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.main !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.release !== "REQUIRED_EXHAUSTIVE" ||
    authority.decision.manualAudit !== "REQUIRED_EXHAUSTIVE" ||
    cutover?.status !== "HOSTED_CUTOVER_VERIFIED" ||
    cutover?.cleanup?.status !== "PASS" ||
    cutover.cleanup.authority !== "REQUIRED" ||
    cutover.cleanup.scope !== "EXHAUSTIVE" ||
    cutover?.main?.status !== "PASS" ||
    cutover.main.authority !== "REQUIRED" ||
    cutover.main.scope !== "EXHAUSTIVE" ||
    cutover?.affectedCanary?.status !== "PASS" ||
    cutover.affectedCanary.authority !== "REQUIRED" ||
    cutover.affectedCanary.effectiveScope !== "AFFECTED" ||
    cutover.affectedCanary.freshExecution !== true ||
    cutover.affectedCanary.cachedSuccessRead !== false ||
    cutover?.proofReaderCheckpoint?.liveVerification !== "PASS" ||
    cutover?.infrastructureDebt?.status !== "CLOSED" ||
    cutover.infrastructureDebt.zeroReferences !== "PASS" ||
    cutover.infrastructureDebt.removedPendingHostedProofCount !== 0
  ) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PREREQUISITE_DRIFT",
      "The pinned I07-04 authority does not close the formal G07 prerequisite.",
    );
  }
  return deepFreeze({
    ...pin,
    result: "PASS",
    status: "DONE",
    authority: {
      profile: authority.profile,
      observations: authority.observations.length,
      falseNegatives: authority.threshold.falseNegatives,
      promotion: authority.decision.status,
      cutover: cutover.status,
      cleanup: {
        revision: cutover.cleanup.receiptRevision,
        runId: cutover.cleanup.runId,
        jobId: cutover.cleanup.jobId,
        receiptSha256: cutover.cleanup.receiptSha256,
        authority: cutover.cleanup.authority,
        scope: cutover.cleanup.scope,
        result: cutover.cleanup.status,
      },
      main: {
        revision: cutover.main.receiptRevision,
        runId: cutover.main.runId,
        jobId: cutover.main.jobId,
        receiptSha256: cutover.main.receiptSha256,
        authority: cutover.main.authority,
        scope: cutover.main.scope,
        result: cutover.main.status,
      },
      affectedCanary: {
        revision: cutover.affectedCanary.executionRevision,
        runId: cutover.affectedCanary.runId,
        jobId: cutover.affectedCanary.jobId,
        receiptSha256: cutover.affectedCanary.receiptSha256,
        authority: cutover.affectedCanary.authority,
        scope: cutover.affectedCanary.effectiveScope,
        freshExecution: cutover.affectedCanary.freshExecution,
        cachedSuccessRead: cutover.affectedCanary.cachedSuccessRead,
        result: cutover.affectedCanary.status,
      },
      proofReaderCheckpoint: cutover.proofReaderCheckpoint,
      infrastructureDebt: {
        status: cutover.infrastructureDebt.status,
        zeroReferences: cutover.infrastructureDebt.zeroReferences,
        removedPendingHostedProofCount: cutover.infrastructureDebt.removedPendingHostedProofCount,
        liveVerification: cutover.infrastructureDebt.liveVerification,
      },
    },
  });
}

function buildOptionsFromCapture(options) {
  return {
    fileOverrides: options.fileOverrides,
    runtimeApi: options.runtimeApi,
    ...(options.prerequisiteBytes === undefined
      ? { prerequisitePath: options.prerequisitePath }
      : { prerequisiteBytes: options.prerequisiteBytes }),
  };
}

/** Builds final deterministic M08-T01 evidence from the emitted public package. */
export async function buildEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const paths = [
    FIXTURE_PATH,
    PACKAGE_PATH,
    SOURCE_PATH,
    INDEX_PATH,
    DIST_SOURCE_PATH,
    DIST_INDEX_PATH,
    DIST_SOURCE_DECLARATION_PATH,
    DIST_INDEX_DECLARATION_PATH,
    PACKAGE_TEST_PATH,
    PACKAGE_TYPES_PATH,
    PUBLIC_TEST_PATH,
    PUBLIC_TYPES_PATH,
    ROOT_TEST_PATH,
  ];
  const texts = await Promise.all(
    paths.map((relativePath) => readTrackedText(relativePath, options.fileOverrides)),
  );
  const files = Object.fromEntries(
    paths.map((relativePath, index) => [relativePath, texts[index]]),
  );
  const officialSource = parseJson(files[FIXTURE_PATH], FIXTURE_PATH);
  const packageManifest = parseJson(files[PACKAGE_PATH], PACKAGE_PATH);
  const runtimeApi = captureRuntimeApi(options.runtimeApi);
  const documentModel = verifyRuntimeBehavior(runtimeApi, officialSource);
  const boundary = verifySourceAndDistributionContract(files, packageManifest);
  const tests = verifyTestInventory(files);
  const trackedFiles = await trackedInventory(options.fileOverrides);
  const prerequisite = await authenticatePrerequisite(options);

  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "editor-core-source-document",
    profile: "desen.editor-core.source-document-proof.v1",
    task: "M08-T01",
    result: "PASS",
    prerequisite,
    claim: {
      protocol: "0.1.0",
      platform: "platform-neutral",
      directSourceRoot: true,
      structuralAdmissionOnly: true,
      semanticValidation: false,
      taskStatus: "DONE",
      prerequisiteGate: "G07",
      prerequisiteStatus: "DONE",
    },
    publicApi: {
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      publicDeclarations: boundary.publicDeclarations,
      tsdocDeclarations: boundary.tsdocDeclarations,
    },
    documentModel,
    structuralAdmission: {
      officialFixture: FIXTURE_PATH,
      exactFixtureIdentity: true,
      unresolvedSemanticReferenceAccepted: true,
      failureExposesPartialDocument: false,
    },
    boundary,
    evidence: { tests, trackedFiles },
    nonclaims: [
      "M08-T01 defines admission and immutable ownership only; mutation commands and stable-ID allocation remain assigned to M08-T02 through M08-T06.",
      "Persistence and authoring-extension round trips remain assigned to M08-T07 and M08-T08.",
      "Continuous semantic validation and invalid-node mapping remain assigned to M08-T09.",
      "The React/DOM boundary and terminal editor determinism proof remain assigned to M08-T10 and G08.",
    ],
    reproduction: [
      "pnpm --filter @desen/editor-core build",
      "pnpm --filter @desen/editor-core test:source-document",
      "pnpm --filter @desen/editor-core test:public-package",
      "node scripts/generate-editor-core-source-document-proof.mjs",
      "node scripts/verify-editor-core-source-document.mjs",
      "node --test tests/editor-core-source-document.test.mjs",
    ],
  });
  const artifactText = await format(JSON.stringify(artifact), {
    parser: "json",
    printWidth: 100,
    tabWidth: 2,
    endOfLine: "lf",
  });
  const artifactBytes = Buffer.from(artifactText, "utf8");
  return Object.freeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function proofDocumentHasExactPin(document, artifactSha256) {
  const artifactLine = `Artifact: \`${ARTIFACT_PATH}\``;
  const receiptLine = `Final receipt: \`sha256:${artifactSha256}\``;
  return (
    typeof document === "string" &&
    document.split(artifactLine).length - 1 === 1 &&
    document.split(receiptLine).length - 1 === 1 &&
    document.match(/Final receipt: `sha256:[0-9a-f]{64}`/gu)?.length === 1 &&
    !document.includes("sha256:PENDING")
  );
}

/** Rebuilds M08-T01 and verifies exact artifact bytes plus the human proof digest pin. */
export async function verifyEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureVerifyOptions(rawOptions);
  if (options.proofDocument !== undefined && typeof options.proofDocument !== "string") {
    fail(
      "EDITOR_SOURCE_DOCUMENT_OPTIONS_INVALID",
      "proofDocument must be UTF-8 text when provided.",
    );
  }
  const built = await buildEditorCoreSourceDocumentEvidence(buildOptionsFromCapture(options.build));
  const artifactBytes =
    options.artifactBytes ??
    (await readRegularAuthority(options.artifactPath, "M08-T01 proof artifact"));
  if (!Buffer.from(artifactBytes).equals(Buffer.from(built.artifactBytes))) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_DRIFT",
      "The committed M08-T01 artifact is not exactly reproducible.",
    );
  }
  const proofDocument =
    options.proofDocument ??
    fatalUtf8(
      await readRegularAuthority(options.proofDocumentPath, "M08-T01 proof document"),
      PROOF_DOCUMENT_PATH,
    );
  if (!proofDocumentHasExactPin(proofDocument, built.artifactSha256)) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_PROOF_PIN_DRIFT",
      "The M08-T01 proof document lacks one exact final artifact pin.",
    );
  }
  return deepFreeze({
    task: "M08-T01",
    result: "PASS",
    artifactSha256: built.artifactSha256,
    prerequisiteTask: built.artifact.prerequisite.task,
    prerequisiteGate: built.artifact.prerequisite.gate,
    trackedFiles: built.artifact.evidence.trackedFiles.length,
    rootProofCases: built.artifact.evidence.tests.rootProofCases,
  });
}

async function assertSafeWriteDestination(artifactPath) {
  const parent = await realpath(path.dirname(artifactPath)).catch(() => undefined);
  if (parent === undefined || path.join(parent, path.basename(artifactPath)) !== artifactPath) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination parent must be canonical.",
    );
  }
  let entry;
  try {
    entry = await lstat(artifactPath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination could not be inspected.",
    );
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact destination must be one regular non-linked file.",
    );
  }
}

/** Atomically commits exact M08-T01 artifact bytes after a complete successful build. */
export async function writeEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureWriteOptions(rawOptions);
  const built = await buildEditorCoreSourceDocumentEvidence(buildOptionsFromCapture(options.build));
  await assertSafeWriteDestination(options.artifactPath);
  try {
    await writeAtomicProofArtifact({
      artifactPath: options.artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The M08-T01 artifact could not be committed atomically.",
    );
  }
  const committed = await readRegularAuthority(options.artifactPath, "M08-T01 proof artifact");
  if (!committed.equals(built.artifactBytes)) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_ARTIFACT_WRITE_FAILED",
      "The committed M08-T01 artifact bytes changed after atomic write.",
    );
  }
  return deepFreeze({
    task: "M08-T01",
    result: "PASS",
    artifactPath: options.artifactPath,
    artifactSha256: built.artifactSha256,
  });
}
