import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import { format } from "prettier";
import ts from "typescript";

import * as editorCorePublicApi from "../../packages/editor-core/dist/index.js";

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
    "scripts/lib/editor-core-source-document-proof.mjs",
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

/** Controlled failure emitted by the in-memory M08-T01 proof core. */
export class EditorCoreSourceDocumentProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "EditorCoreSourceDocumentProofError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = undefined) {
  throw new EditorCoreSourceDocumentProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function captureOptions(rawOptions) {
  if (rawOptions === undefined) {
    return Object.freeze({
      fileOverrides: Object.freeze(Object.create(null)),
      runtimeApi: captureRuntimeApi(undefined),
    });
  }
  const options = captureOwnDataRecord(rawOptions, "proof options", [
    "fileOverrides",
    "runtimeApi",
  ]);
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
      overrides[relativePath] = Buffer.from(value);
    }
  }
  return Object.freeze({
    fileOverrides: Object.freeze(overrides),
    runtimeApi: captureRuntimeApi(options.runtimeApi),
  });
}

async function readTrackedBytes(relativePath, overrides) {
  if (Object.hasOwn(overrides, relativePath)) return Buffer.from(overrides[relativePath]);
  const absolutePath = path.join(WORKSPACE_ROOT, relativePath);
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("EDITOR_SOURCE_DOCUMENT_FILE_MISSING", `Required file is missing: ${relativePath}.`, {
      cause: String(error),
    });
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    fail(
      "EDITOR_SOURCE_DOCUMENT_FILE_UNSAFE",
      `Required path must be a regular non-symlink file: ${relativePath}.`,
    );
  }
  return readFile(absolutePath);
}

async function readTrackedText(relativePath, overrides) {
  return (await readTrackedBytes(relativePath, overrides)).toString("utf8");
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
  const inventory = Object.freeze({
    packageRuntimeCases: (files[PACKAGE_TEST_PATH].match(/^\s*it\("/gmu) ?? []).length,
    sourceCompilerNegativeCases: (files[PACKAGE_TYPES_PATH].match(/@ts-expect-error/gu) ?? [])
      .length,
    publicRuntimeContractCases: (
      files[PUBLIC_TEST_PATH].match(/^test\("(?!\[proof-core\])/gmu) ?? []
    ).length,
    publicCompilerNegativeCases: (files[PUBLIC_TYPES_PATH].match(/@ts-expect-error/gu) ?? [])
      .length,
  });
  if (
    !exactJson(inventory, {
      packageRuntimeCases: 7,
      sourceCompilerNegativeCases: 5,
      publicRuntimeContractCases: 10,
      publicCompilerNegativeCases: 5,
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

/**
 * Builds deterministic in-memory M08-T01 proof-core evidence from the emitted public package.
 *
 * @remarks This preparation deliberately writes no artifact, reads no G07 promotion receipt, and
 * registers no root proof workload. Those authority-bearing steps remain gated on I07-04/G07.
 */
export async function buildEditorCoreSourceDocumentEvidence(rawOptions = undefined) {
  const options = captureOptions(rawOptions);
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

  const artifact = Object.freeze({
    schemaVersion: 1,
    profile: "desen.editor-core.source-document-proof-core.v1",
    task: "M08-T01",
    result: "PASS",
    claim: Object.freeze({
      protocol: "0.1.0",
      platform: "platform-neutral",
      directSourceRoot: true,
      structuralAdmissionOnly: true,
      semanticValidation: false,
      taskStatus: "IN_PROGRESS",
    }),
    publicApi: Object.freeze({
      runtimeExports: boundary.runtimeExports,
      typeExports: boundary.typeExports,
      publicDeclarations: boundary.publicDeclarations,
      tsdocDeclarations: boundary.tsdocDeclarations,
    }),
    documentModel,
    structuralAdmission: Object.freeze({
      officialFixture: FIXTURE_PATH,
      exactFixtureIdentity: true,
      unresolvedSemanticReferenceAccepted: true,
      failureExposesPartialDocument: false,
    }),
    boundary,
    evidence: Object.freeze({ tests, trackedFiles }),
    deferred: Object.freeze([
      "The exact I07-04 promotion receipt and G07 DONE authority do not exist yet.",
      "No tracked artifact, proof-document pin, root verifier/test pair, or CI inventory reseal is claimed.",
      "Stable-ID commands, persistence, continuous validation, and the terminal M08 proof remain assigned to M08-T02 through M08-T10.",
    ]),
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
