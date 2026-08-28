import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-SCHEMA-INSPECTOR.md";
const CATALOG_PARENT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-catalog-panel-layer-tree.json";
const SELECTION_PARENT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json";
const PUBLISHER_PARENT_ARTIFACT_PATH = "docs/proof/artifacts/publisher-0.1.0-official-golden.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const GLOBAL_CSS_PATH = "apps/desen-app/src/styles.css";
const INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-schema-inspector-proof.mjs",
  "scripts/generate-desen-app-schema-inspector-proof.mjs",
  "scripts/verify-desen-app-schema-inspector.mjs",
  "tests/desen-app-schema-inspector.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  INSPECTOR_SOURCE_PATH,
  PREVIEW_SOURCE_PATH,
  SELECTION_SOURCE_PATH,
  PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  GLOBAL_CSS_PATH,
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  CATALOG_PATH,
  SOURCE_FIXTURE_PATH,
  BUNDLE_FIXTURE_PATH,
  ...SOURCE_PATHS,
  INSPECTOR_TEST_PATH,
  PREVIEW_TEST_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  CATALOG_PARENT_ARTIFACT_PATH,
  SELECTION_PARENT_ARTIFACT_PATH,
  PUBLISHER_PARENT_ARTIFACT_PATH,
  ...PROOF_READER_PATHS,
]);

const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  AUTHORING_DATA_PATH,
  INSPECTOR_SOURCE_PATH,
  PANEL_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  INSPECTOR_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-schema-inspector-proof.mjs",
  "tests/desen-app-schema-inspector.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    STRUCTURED_JSON_SOURCE_PATH,
    PANEL_TEST_PATH,
    STRUCTURED_JSON_TEST_PATH,
  ]),
]);

const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-schema-inspector-proof.mjs",
  "tests/desen-app-schema-inspector.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 22_998,
  sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
});

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  [AUTHORING_DATA_PATH]: "e55163afbc6b39ab42318a6d48b3ca76de93cd006df0a585397990ed62fc3bad",
  [INSPECTOR_SOURCE_PATH]: "e461c9935574c9c89e0bd5462da21c2f4b16dd4f2c4a4db35fd504be99e0f3e7",
  [PREVIEW_SOURCE_PATH]: "75fa2d605f8c5ceebc2668c1f4c739155c7791b895132dc9a5fac183384e3d34",
  [SELECTION_SOURCE_PATH]: "e97eed87734fff6fdc3a40dbc81754a88318238090e4c1dfcc53062e8ff7fc7c",
  [PANEL_SOURCE_PATH]: "c1ea515440052e41273c78b3f1d5289aec9f50987cd0ee8169116aa0a7cf5c2c",
  [ADAPTER_SOURCE_PATH]: "a678302fd2931172d32f6509dc37018a294bc938ccca73df646a715516a6db38",
  [APPLICATION_SOURCE_PATH]: "e030bbad64e1909a2f3237de3d820f13af730439c0f94e289553782b990dcab0",
  [APPLICATION_CSS_PATH]: "8a3c2f832cd532d263b29ff1da39fc0a89a54cc51a4333dc47b6de02473e67ac",
  [GLOBAL_CSS_PATH]: "4cffb8e77e10402919b942834020f19b330fe34cd06654ed7ff5b2b9c68d9e35",
});

const EXPECTED_REFERENCE_CONTROLS = Object.freeze([
  Object.freeze({
    componentId: "com.example.ui/Alert",
    controls: Object.freeze([
      Object.freeze({ property: "text", kind: "string", required: true }),
      Object.freeze({
        property: "tone",
        kind: "enum",
        required: true,
        options: Object.freeze(["info", "success", "warning", "critical"]),
      }),
    ]),
  }),
  Object.freeze({
    componentId: "com.example.ui/Button",
    controls: Object.freeze([
      Object.freeze({ property: "disabled", kind: "boolean", required: false }),
      Object.freeze({ property: "label", kind: "string", required: true }),
      Object.freeze({ property: "loading", kind: "boolean", required: false }),
      Object.freeze({
        property: "variant",
        kind: "enum",
        required: false,
        options: Object.freeze(["primary", "secondary", "danger"]),
      }),
    ]),
  }),
  Object.freeze({
    componentId: "com.example.ui/Stack",
    controls: Object.freeze([
      Object.freeze({
        property: "align",
        kind: "enum",
        required: false,
        options: Object.freeze(["start", "center", "end", "stretch"]),
      }),
      Object.freeze({
        property: "direction",
        kind: "enum",
        required: false,
        options: Object.freeze(["vertical", "horizontal"]),
      }),
      Object.freeze({
        property: "gap",
        kind: "enum",
        required: false,
        options: Object.freeze(["none", "xs", "sm", "md", "lg", "xl"]),
      }),
      Object.freeze({ property: "maxWidth", kind: "number", required: false }),
    ]),
  }),
  Object.freeze({
    componentId: "com.example.ui/Text",
    controls: Object.freeze([
      Object.freeze({
        property: "role",
        kind: "enum",
        required: false,
        options: Object.freeze(["body", "heading", "caption"]),
      }),
      Object.freeze({ property: "text", kind: "string", required: true }),
    ]),
  }),
  Object.freeze({
    componentId: "com.example.ui/TextField",
    controls: Object.freeze([
      Object.freeze({ property: "disabled", kind: "boolean", required: false }),
      Object.freeze({ property: "invalid", kind: "boolean", required: false }),
      Object.freeze({ property: "label", kind: "string", required: true }),
      Object.freeze({ property: "placeholder", kind: "string", required: false }),
      Object.freeze({ property: "secure", kind: "boolean", required: false }),
      Object.freeze({ property: "value", kind: "string", required: true }),
    ]),
  }),
]);

const EXPECTED_INSPECTOR_TEST_NAMES = Object.freeze([
  "derives the exact canonical primitive and enum matrix for every reference component",
  "distinguishes literal, absent, and dynamic Source values without coercion",
  "sets string, enum, boolean, and number props through fresh immutable Source snapshots",
  "deletes only an existing optional prop and rejects absent or required deletion atomically",
  "rejects invalid enum and numeric values without mutating the current Source",
  "keeps dynamic props outside T05 mutation authority and preserves their exact objects",
  "captures exact own-data edit fields before authorization and rejects accessor drift",
  "rejects stale routes and forged selection identity before exposing or applying controls",
  "preserves integer and mixed primitive enum values with exact JSON types",
  "keeps dynamic object values bound instead of presenting the structured fallback",
]);

const EXPECTED_PREVIEW_TEST_NAMES = Object.freeze([
  "admits the official-derived Source as the frozen direct reference editor document",
  "reproduces the exact session-local baseline Bundle and official revision",
  "publishes a valid primitive prop edit as a fresh exact Bundle revision",
  "rejects a runtime-cast non-Source without throwing or exposing a partial Bundle",
  "rejects a structurally valid but Catalog-invalid prop edit without a partial Bundle",
]);

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "replaces the exact session when a current authoring draft Bundle is rerendered",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "edits schema-derived string and enum props and refreshes the exact adapter preview",
  "preserves the prior Source and preview when Publisher rejects an oversized valid prop",
  "keeps bound props locked while boolean and numeric edits fail or apply atomically",
  "resets local drafts across Source identities and qualifies repeated edit actions",
]);

/** Exact immutable Catalog, App-continuity, and Publisher parent receipts for M09-T05. */
export const DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T02",
    proofId: "desen-app-catalog-panel-layer-tree",
    path: CATALOG_PARENT_ARTIFACT_PATH,
    bytes: 25_375,
    sha256: "85a310feaf1a0cc3656055cd3a76eeb02e02a278c21d22167853b53c03f1ee61",
    profile: "desen.app.catalog-panel-layer-tree-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T04",
    proofId: "desen-app-selection-overlay",
    path: SELECTION_PARENT_ARTIFACT_PATH,
    bytes: 11_997,
    sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
    profile: "desen.app.selection-overlay-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M06-T10",
    proofId: "publisher-official-golden",
    path: PUBLISHER_PARENT_ARTIFACT_PATH,
    bytes: 13_179,
    sha256: "a2cde9718894b4af506e750d66ea7577d96da4e8a09649f17afe0f94dada17e2",
    profile: "desen.publisher.official-golden-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T05 artifact. */
export const DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact frozen Catalog, selection-overlay, and Publisher parents",
  "[schema] derives the exact primitive and enum control surface from Catalog schemas",
  "[mutation] proves public Editor Core atomic edits and continuous schema revalidation",
  "[safety] locks dynamic and structured values and rejects stale routes and selections",
  "[preview] proves Publisher-backed immutable session preview replacement",
  "[ownership] keeps Inspector and selection overlay outside managed capability subtrees",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened schema, mutation, validation, preview, and ownership sources",
  "[verification] rejects parent, committed artifact, and visible proof-pin drift",
  "[filesystem] writes atomically and rejects non-regular proof authorities",
]);

/** Default destination for deterministic M09-T05 evidence. */
export const DEFAULT_DESEN_APP_SCHEMA_INSPECTOR_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T05 evidence reader. */
export class DesenAppSchemaInspectorProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppSchemaInspectorProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppSchemaInspectorProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function _canonicalArtifactBytes(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
}

function exactOwnDataOptions(value, allowedKeys, label) {
  if (value === undefined) return Object.freeze(Object.create(null));
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert own-data object.`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
  }
  const captured = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${String(key)} must be enumerable own data.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function capturePath(value, label, fallback) {
  const selected = value === undefined ? fallback : value;
  if (typeof selected !== "string" || selected.length === 0 || selected.includes("\0")) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty path.`);
  }
  return path.resolve(selected);
}

function captureBytes(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    !utilTypes.isUint8Array(value) ||
    utilTypes.isSharedArrayBuffer(value.buffer)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared bytes.`);
  }
  return Buffer.from(value);
}

function captureOverrides(value) {
  if (value === undefined) return Object.freeze(new Map());
  if (
    !(value instanceof Map) ||
    utilTypes.isProxy(value) ||
    value.size > CURRENT_COMPATIBILITY_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (!CURRENT_COMPATIBILITY_PATHS.includes(relativePath) || captured.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unknown or duplicate path.", {
        path: relativePath,
      });
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return Object.freeze(captured);
}

function captureBuildOptions(value) {
  const options = exactOwnDataOptions(
    value,
    ["fileOverrides", "parentArtifactBytes", "workspaceRoot"],
    "build options",
  );
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureOverrides(options.fileOverrides),
    parentArtifactBytes:
      options.parentArtifactBytes === undefined
        ? undefined
        : captureBytes(options.parentArtifactBytes, "parentArtifactBytes"),
  });
}

async function readRegularAuthority(absolutePath, label) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("AUTHORITY_UNREADABLE", `${label} could not be inspected.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.size > MAX_AUTHORITY_BYTES) {
    fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular file.`);
  }
  let canonical;
  try {
    canonical = await realpath(absolutePath);
  } catch (error) {
    fail("AUTHORITY_UNREADABLE", `${label} could not be resolved.`, { cause: String(error) });
  }
  if (canonical !== absolutePath) {
    fail("AUTHORITY_UNSAFE", `${label} must not resolve through a linked path.`);
  }

  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `${label} exceeded its byte ceiling.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppSchemaInspectorProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const output = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    const live = await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath);
    const override = overrides.get(relativePath);
    if (
      override !== undefined &&
      SELF_RESEALED_PATHS.includes(relativePath) &&
      !isDeepStrictEqual(override, live)
    ) {
      fail("BOUNDARY_DRIFT", `${relativePath} cannot be substituted by a caller.`);
    }
    output.set(relativePath, override ?? live);
  }
  return output;
}

function decodeUtf8(bytes, label) {
  const value = Buffer.from(bytes).toString("utf8");
  if (value.includes("\0") || !Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact UTF-8 text.`);
  }
  return value;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    fail("JSON_INVALID", `${label} must contain valid JSON.`, { cause: String(error) });
  }
}

function parseTypeScript(rawSource, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    rawSource,
    ts.ScriptTarget.ESNext,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} has TypeScript parse diagnostics.`);
  }
  return sourceFile;
}

function collectDescendants(node, predicate) {
  const output = [];
  function visit(current) {
    if (predicate(current)) output.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return output;
}

function functionName(node) {
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) return node.name.text;
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0];
    if (declaration !== undefined && ts.isIdentifier(declaration.name)) {
      return declaration.name.text;
    }
  }
  return undefined;
}

function functionBody(node) {
  if (ts.isFunctionDeclaration(node)) return node.body;
  if (ts.isVariableStatement(node)) {
    const initializer = node.declarationList.declarations[0]?.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return initializer.body;
    }
  }
  return undefined;
}

function exactFunction(sourceFile, name) {
  const matches = sourceFile.statements.filter((statement) => functionName(statement) === name);
  if (matches.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", `Expected exactly one ${name} function.`);
  }
  return matches[0];
}

function callNames(sourceFile) {
  return collectDescendants(sourceFile, ts.isCallExpression).map((call) => {
    if (ts.isIdentifier(call.expression)) return call.expression.text;
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    return call.expression.getText(sourceFile);
  });
}

function importModules(sourceFile) {
  return sourceFile.statements.filter(ts.isImportDeclaration).map((declaration) => {
    if (!ts.isStringLiteral(declaration.moduleSpecifier)) {
      fail("SOURCE_POLICY_VIOLATION", "All imports must use literal module specifiers.");
    }
    return Object.freeze({
      module: declaration.moduleSpecifier.text,
      typeOnly: declaration.importClause?.isTypeOnly === true,
    });
  });
}

function assertPublicImports(sourceFile, relativePath, allowedPackages) {
  const imports = importModules(sourceFile);
  const packageImports = imports.filter(({ module }) => module.startsWith("@desen/"));
  const forbidden = packageImports.filter(
    ({ module }) =>
      !allowedPackages.includes(module) || /\/(?:dist|src|test|internal)(?:\/|$)/u.test(module),
  );
  if (forbidden.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} crossed a private package boundary.`, {
      forbidden,
    });
  }
  return Object.freeze({
    packageImports: packageImports.map(({ module }) => module),
    privatePackageImports: 0,
  });
}

function assertExpectedHash(rawSource, relativePath) {
  const actual = sha256(Buffer.from(rawSource, "utf8"));
  if (actual !== EXPECTED_SOURCE_SHA256[relativePath]) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} exact reviewed bytes drifted.`, { actual });
  }
}

function assertCalls(sourceFile, required, label) {
  const observed = callNames(sourceFile);
  const missing = required.filter((name) => !observed.includes(name));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required public calls.`, { missing });
  }
  return observed;
}

function inspectAuthoringData(rawSource) {
  assertExpectedHash(rawSource, AUTHORING_DATA_PATH);
  const sourceFile = parseTypeScript(rawSource, AUTHORING_DATA_PATH);
  const imports = assertPublicImports(sourceFile, AUTHORING_DATA_PATH, [
    "@desen/catalog-sdk",
    "@desen/reference-catalog-web/catalog.json",
    "@desen/validator",
  ]);
  assertCalls(
    sourceFile,
    ["deriveComponentInspectorControls", "registerComponent"],
    "Authoring projection",
  );
  exactFunction(sourceFile, "projectComponent");
  exactFunction(sourceFile, "prepareCatalogAuthoringModel");
  if (!rawSource.includes("readonly inspector: ComponentInspectorControlPlan")) {
    fail("SOURCE_POLICY_VIOLATION", "Catalog authoring metadata lost its exact inspector plan.");
  }
  return deepFreeze({
    imports,
    publicCatalogSdkDerivation: true,
    exactValidatedCatalogAndSourceProjection: true,
    inspectorPlanFrozenWithComponentSummary: true,
  });
}

function inspectInspectorSource(rawSource) {
  assertExpectedHash(rawSource, INSPECTOR_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, INSPECTOR_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, INSPECTOR_SOURCE_PATH, [
    "@desen/catalog-sdk",
    "@desen/editor-core",
  ]);
  const observedCalls = assertCalls(
    sourceFile,
    [
      "createDesenEditorContinuousValidator",
      "deleteDesenEditorOwnerProp",
      "setDesenEditorOwnerProp",
      "prepareCatalogAuthoringModel",
      "projectAuthoringSelection",
    ],
    "Inspector mutation",
  );
  exactFunction(sourceFile, "prepareAuthoringInspectorModel");
  exactFunction(sourceFile, "applyAuthoringInspectorEdit");
  exactFunction(sourceFile, "captureInspectorEdit");

  const editCapture = rawSource.indexOf("const capturedEdit = captureInspectorEdit(edit)");
  const authorization = rawSource.indexOf(
    "const prepared = prepareCatalogAuthoringModel(catalogValue, document)",
  );
  const dynamicLock = rawSource.indexOf(
    'field.value.kind === "dynamic" || field.value.kind === "structured"',
  );
  const mutation = rawSource.indexOf("const changed =");
  const validator = rawSource.indexOf("createDesenEditorContinuousValidator([catalogValue])");
  const validation = rawSource.indexOf("validator.validator.validate(changed.document)");
  const success = rawSource.indexOf("document: changed.document");
  if (
    editCapture < 0 ||
    authorization <= editCapture ||
    dynamicLock <= authorization ||
    mutation <= dynamicLock ||
    validator <= mutation ||
    validation <= validator ||
    success <= validation
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Inspector lost lock-before-mutation or mutation-before-revalidation ordering.",
    );
  }
  for (const marker of [
    "Reflect.ownKeys(edit)",
    'Object.getOwnPropertyDescriptor(edit, "kind")',
    'Object.getOwnPropertyDescriptor(edit, "property")',
    'Object.getOwnPropertyDescriptor(edit, "value")',
    'typeof key !== "string"',
  ]) {
    if (!rawSource.includes(marker)) {
      fail("SOURCE_POLICY_VIOLATION", `Inspector command capture lost ${marker}.`);
    }
  }
  for (const kind of ["boolean", "enum", "integer", "number", "string"]) {
    if (!rawSource.includes(`control.kind === "${kind}"`)) {
      fail("SOURCE_POLICY_VIOLATION", `Inspector lost the ${kind} control boundary.`);
    }
  }
  for (const reason of [
    "catalog-invalid",
    "control-unavailable",
    "edit-rejected",
    "required-property",
    "selection-invalid",
    "source-invalid",
    "value-invalid",
  ]) {
    if (!rawSource.includes(`"${reason}"`)) {
      fail("SOURCE_POLICY_VIOLATION", `Inspector lost the ${reason} closed outcome.`);
    }
  }
  return deepFreeze({
    imports,
    editorCoreCalls: observedCalls.filter((name) =>
      [
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorOwnerProp",
        "setDesenEditorOwnerProp",
      ].includes(name),
    ),
    editableKinds: ["boolean", "enum", "integer", "number", "string"],
    exactJsonPrimitiveEnumIdentity: true,
    editCommandCapturedAsExactOwnEnumerableData: true,
    editAccessorsSymbolsAndUnknownFieldsRejected: true,
    proxyGetTrapNotRequired: true,
    dynamicAndStructuredLockPrecedesMutation: true,
    mutationUsesPublicEditorCoreOnly: true,
    completeDocumentRevalidatedAfterEveryMutation: true,
    noPartialDocumentOnFailure: true,
    routeAndSelectionReadmissionRequired: true,
  });
}

function inspectPreviewSource(rawSource) {
  assertExpectedHash(rawSource, PREVIEW_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, PREVIEW_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, PREVIEW_SOURCE_PATH, [
    "@desen/editor-core",
    "@desen/publisher",
    "@desen/reference-catalog-web/catalog.json",
  ]);
  assertCalls(sourceFile, ["createDesenEditorDocument", "publishDesenSource"], "Session preview");
  exactFunction(sourceFile, "prepareAuthoringPreviewBundle");
  for (const literal of [
    "run.desen.reference.sign-in",
    "0.1.0",
    "web-react",
    "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0",
  ]) {
    if (!rawSource.includes(JSON.stringify(literal))) {
      fail("SOURCE_POLICY_VIOLATION", `Session preview lost exact candidate literal ${literal}.`);
    }
  }
  if (
    !rawSource.includes('previewFailure("editor-document-invalid")') ||
    !rawSource.includes('previewFailure("publication-rejected")') ||
    !rawSource.includes("revision: published.bundle.revision")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Session preview lost its exact fail-closed result shape.");
  }
  return deepFreeze({
    imports,
    sourceReadmittedBeforePublication: true,
    exactReferenceCatalogPackageCandidate: true,
    publicPublisherOnly: true,
    immutableBundleAndRevisionReturned: true,
    persistenceAuthority: false,
    activationAuthority: false,
  });
}

function jsxTagsWithin(sourceFile, functionNameValue) {
  const body = functionBody(exactFunction(sourceFile, functionNameValue));
  if (body === undefined) {
    fail("SOURCE_POLICY_VIOLATION", `${functionNameValue} has no inspectable body.`);
  }
  return collectDescendants(
    body,
    (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
  ).map((node) =>
    ts.isIdentifier(node.tagName) ? node.tagName.text : node.tagName.getText(sourceFile),
  );
}

function inspectPanelSource(rawSource) {
  assertExpectedHash(rawSource, PANEL_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, PANEL_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, PANEL_SOURCE_PATH, ["@desen/catalog-sdk"]);
  for (const name of [
    "DynamicField",
    "EnumField",
    "BooleanField",
    "TextOrNumberField",
    "DeferredField",
    "InspectorPanel",
  ]) {
    exactFunction(sourceFile, name);
  }
  const dynamicTags = jsxTagsWithin(sourceFile, "DynamicField");
  const deferredTags = jsxTagsWithin(sourceFile, "DeferredField");
  if (
    dynamicTags.some((tag) => ["button", "input", "select", "textarea"].includes(tag)) ||
    deferredTags.some((tag) => ["button", "input", "select", "textarea"].includes(tag))
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Locked fields acquired an interactive mutation control.");
  }
  const panelTags = jsxTagsWithin(sourceFile, "InspectorPanel");
  if (!panelTags.includes("aside") || rawSource.includes("DesenAdapterCanvas")) {
    fail("SOURCE_POLICY_VIOLATION", "Inspector lost App-owned aside isolation.");
  }
  for (const marker of [
    'data-authoring-inspector="true"',
    'data-control-kind="enum"',
    'data-control-kind="boolean"',
    'role="switch"',
    'type={numeric ? "number" : "text"}',
    "Nested and structured JSON editing follows in M09-T06.",
    "Binding editing becomes available with M09-T08.",
  ]) {
    if (!rawSource.includes(marker)) {
      fail("SOURCE_POLICY_VIOLATION", `Inspector UI lost required boundary marker ${marker}.`);
    }
  }
  return deepFreeze({
    imports,
    owner: "Desen App",
    semanticContainer: "aside",
    primitiveControls: {
      enum: "select",
      boolean: "checkbox switch",
      string: "text input",
      number: "number input",
      integer: "number input step=1",
    },
    dynamicInteractiveControls: 0,
    structuredInteractiveControls: 0,
    managedAdapterImports: 0,
  });
}

function inspectApplicationSource(rawSource) {
  assertExpectedHash(rawSource, APPLICATION_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, APPLICATION_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, APPLICATION_SOURCE_PATH, [
    "@desen/reference-catalog-web/catalog.json",
  ]);
  const calls = assertCalls(
    sourceFile,
    [
      "applyAuthoringInspectorEdit",
      "prepareAuthoringInspectorModel",
      "prepareAuthoringPreviewBundle",
      "prepareCatalogAuthoringModel",
    ],
    "Surface editor",
  );
  const surfaceTags = jsxTagsWithin(sourceFile, "SurfaceEditor");
  const previewPreparation = rawSource.indexOf(
    "const nextPreview = prepareAuthoringPreviewBundle(result.document)",
  );
  const previewRejection = rawSource.indexOf("if (!nextPreview.ok)", previewPreparation);
  const sessionCommit = rawSource.indexOf(
    "setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
    previewRejection,
  );
  if (
    surfaceTags.filter((tag) => tag === "DesenAdapterCanvas").length !== 1 ||
    surfaceTags.filter((tag) => tag === "InspectorPanel").length !== 1 ||
    !rawSource.includes("const [authoringSession, setAuthoringSession] = useState") ||
    !rawSource.includes("document: REFERENCE_EDITOR_DOCUMENT") ||
    !rawSource.includes("preview: prepareAuthoringPreviewBundle(REFERENCE_EDITOR_DOCUMENT)") ||
    previewPreparation < 0 ||
    previewRejection <= previewPreparation ||
    sessionCommit <= previewRejection ||
    !rawSource.includes("authoringModel={model}") ||
    !rawSource.includes("bundle={preview.ok ? preview.bundle : null}")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "SurfaceEditor lost its exact session-authoring composition.");
  }
  if (
    rawSource.includes("data-managed-capability-subtree") ||
    rawSource.includes("data-managed-capability-frame")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Application attempted to own managed subtree markers.");
  }
  return deepFreeze({
    imports,
    calls: [...new Set(calls)].filter((name) => name.startsWith("prepareAuthoring")),
    documentOwner: "route-keyed SurfaceEditor session state",
    modelAndPreviewRecomputedFromSameDocument: true,
    sourceAndPreviewCommitAtomically: true,
    publisherRejectionPreservesPriorSession: true,
    inspectorAndCanvasComposedByApp: true,
    inspectorInsideManagedSubtree: false,
    saveAuthority: false,
  });
}

function inspectCssSource(applicationCss, globalCss) {
  assertExpectedHash(applicationCss, APPLICATION_CSS_PATH);
  assertExpectedHash(globalCss, GLOBAL_CSS_PATH);
  for (const selector of [
    ".inspectorPanel",
    ".inspectorField",
    ".switchControl",
    ".boundValue",
    ".deferredControl",
  ]) {
    if (!applicationCss.includes(selector)) {
      fail("CSS_POLICY_VIOLATION", `Inspector presentation lost ${selector}.`);
    }
  }
  if (
    applicationCss.includes("data-managed-capability-subtree") ||
    applicationCss.includes("data-managed-capability-frame") ||
    globalCss.includes("data-managed-capability")
  ) {
    fail("CSS_POLICY_VIOLATION", "App Inspector CSS attempted to target managed descendants.");
  }
  return deepFreeze({
    appOwnedInspectorSelectors: true,
    managedDescendantSelectors: 0,
    responsiveThreePanelWorkspace: applicationCss.includes("grid-template-columns"),
  });
}

function inspectAdapterSource(rawSource) {
  assertExpectedHash(rawSource, ADAPTER_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, ADAPTER_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, ADAPTER_SOURCE_PATH, [
    "@desen/reference-catalog-web/catalog.json",
    "@desen/reference-catalog-web/react-adapters",
    "@desen/reference-catalog-web/tokens",
    "@desen/runtime-core",
    "@desen/runtime-react",
  ]);
  assertCalls(
    sourceFile,
    ["disposeRuntimeHeadlessSession", "mountRuntimeHeadlessSession", "projectAuthoringSelection"],
    "Adapter canvas",
  );
  if (
    !rawSource.includes("readonly authoringModel?: CatalogAuthoringModel") ||
    !rawSource.includes("readonly bundle?: unknown") ||
    !rawSource.includes("state.previewRevision !== previewRevision") ||
    !rawSource.includes("<SelectionOverlay projection={projection} />") ||
    !rawSource.includes('data-managed-capability-subtree="true"')
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Adapter lost draft replacement or overlay boundary markers.");
  }
  if (rawSource.includes("InspectorPanel")) {
    fail("SOURCE_POLICY_VIOLATION", "Managed adapter canvas imported App Inspector chrome.");
  }
  return deepFreeze({
    imports,
    publisherBundleAcceptedAsOpaqueInput: true,
    revisionReplacementDisposesPreviousSession: true,
    selectionOverlayRemainsAppOwnedSibling: true,
    inspectorImports: 0,
  });
}

function inspectSelectionSource(rawSource) {
  assertExpectedHash(rawSource, SELECTION_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, SELECTION_SOURCE_PATH);
  const imports = assertPublicImports(sourceFile, SELECTION_SOURCE_PATH, ["@desen/runtime-react"]);
  exactFunction(sourceFile, "projectAuthoringSelection");
  return deepFreeze({
    imports,
    validatedModelMembershipRequired: true,
    routeIdentityRequired: true,
    runtimeAuthority: "callback-free diagnostic identity only",
  });
}

/** Applies the exact M09-T05 production source and ownership policy. */
export function verifyDesenAppSchemaInspectorSourcePolicy(rawInput) {
  const keys = [
    "adapterSource",
    "applicationSource",
    "applicationCss",
    "authoringDataSource",
    "globalCss",
    "inspectorSource",
    "panelSource",
    "previewSource",
    "selectionSource",
  ];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    authoringData: inspectAuthoringData(input.authoringDataSource),
    inspector: inspectInspectorSource(input.inspectorSource),
    preview: inspectPreviewSource(input.previewSource),
    selection: inspectSelectionSource(input.selectionSource),
    panel: inspectPanelSource(input.panelSource),
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    css: inspectCssSource(input.applicationCss, input.globalCss),
  });
}

function schemaObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("CATALOG_POLICY_VIOLATION", `${label} must be an object.`);
  }
  return value;
}

function controlKind(schema, label) {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return "enum";
  if (["boolean", "integer", "number", "string"].includes(schema.type)) return schema.type;
  fail("CATALOG_POLICY_VIOLATION", `${label} is not a T05 primitive or enum schema.`);
}

function _inspectCatalog(catalogBytes) {
  const catalog = schemaObject(parseJson(catalogBytes, CATALOG_PATH), "catalog");
  const components = schemaObject(catalog.components, "catalog.components");
  const matrix = Object.keys(components)
    .sort()
    .map((componentId) => {
      const component = schemaObject(components[componentId], `components.${componentId}`);
      const propsSchema = schemaObject(component.propsSchema, `${componentId}.propsSchema`);
      const properties = schemaObject(propsSchema.properties, `${componentId}.properties`);
      const required = new Set(Array.isArray(propsSchema.required) ? propsSchema.required : []);
      const controls = Object.keys(properties)
        .sort()
        .map((property) => {
          const schema = schemaObject(properties[property], `${componentId}.${property}`);
          const kind = controlKind(schema, `${componentId}.${property}`);
          const control = { property, kind, required: required.has(property) };
          if (kind === "enum") control.options = [...schema.enum];
          return deepFreeze(control);
        });
      return deepFreeze({ componentId, controls });
    });
  if (!isDeepStrictEqual(matrix, EXPECTED_REFERENCE_CONTROLS)) {
    fail("CATALOG_POLICY_VIOLATION", "The exact reference primitive/enum matrix drifted.", {
      matrix,
    });
  }
  return deepFreeze({
    catalog: {
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
    },
    referenceControls: matrix,
    referenceKinds: ["boolean", "enum", "number", "string"],
    syntheticCoveredKinds: ["integer", "mixed-primitive-enum"],
    schemaAuthority: "component.propsSchema",
  });
}

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  return collectDescendants(sourceFile, ts.isCallExpression)
    .filter(
      (call) =>
        ts.isIdentifier(call.expression) &&
        ["it", "test"].includes(call.expression.text) &&
        call.arguments.length > 0 &&
        ts.isStringLiteral(call.arguments[0]),
    )
    .map((call) => call.arguments[0].text);
}

function _inspectTests(files) {
  const expectedByPath = new Map([
    [INSPECTOR_TEST_PATH, EXPECTED_INSPECTOR_TEST_NAMES],
    [PREVIEW_TEST_PATH, EXPECTED_PREVIEW_TEST_NAMES],
    [ADAPTER_TEST_PATH, EXPECTED_ADAPTER_TEST_NAMES],
    [APPLICATION_TEST_PATH, EXPECTED_APPLICATION_TEST_NAMES],
  ]);
  const retained = {};
  for (const [relativePath, expected] of expectedByPath) {
    const actual = collectTestNames(
      decodeUtf8(files.get(relativePath), relativePath),
      relativePath,
    );
    const missing = expected.filter((name) => !actual.includes(name));
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required T05 tests.`, { missing });
    }
    retained[relativePath] = expected;
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:inspector && node --test tests/desen-app-schema-inspector.test.mjs",
    retained,
    rootTestNames: DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES,
    hostileMutationClasses: [
      "MANUAL_CONTROL_PLAN",
      "PRIVATE_EDITOR_IMPORT",
      "DIRECT_SOURCE_MUTATION",
      "VALIDATION_BYPASS",
      "DYNAMIC_VALUE_OVERWRITE",
      "STRUCTURED_VALUE_OVERWRITE",
      "STALE_ROUTE_OR_SELECTION",
      "PUBLISHER_BYPASS",
      "PARTIAL_PREVIEW_BUNDLE",
      "INSPECTOR_IN_MANAGED_SUBTREE",
      "SESSION_WITHOUT_DISPOSAL",
    ],
  });
}

function _inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:inspector"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App inspector test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-catalog-panel-layer-tree.mjs && node scripts/verify-desen-app-selection-overlay.mjs && node scripts/verify-publisher-official-golden.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:inspector && ";
  const expectedRootCommands = {
    "generate:desen-app-schema-inspector": `${prefix}node scripts/generate-desen-app-schema-inspector-proof.mjs`,
    "verify:desen-app-schema-inspector": `${prefix}node scripts/verify-desen-app-schema-inspector.mjs`,
    "test:desen-app-schema-inspector": `${prefix}node --test tests/desen-app-schema-inspector.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    directParentVerifiers: [
      "node scripts/verify-desen-app-catalog-panel-layer-tree.mjs",
      "node scripts/verify-desen-app-selection-overlay.mjs",
      "node scripts/verify-publisher-official-golden.mjs",
    ],
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`);
  if (
    artifact.task !== pin.task ||
    artifact.profile !== pin.profile ||
    artifact.result !== "PASS"
  ) {
    fail("PARENT_DRIFT", `The ${pin.task} parent identity drifted.`);
  }
  if (
    pin.proofId === "desen-app-catalog-panel-layer-tree" &&
    (artifact.proofId !== pin.proofId ||
      artifact.claim?.exactCatalogResolved !== true ||
      artifact.claim?.cumulativeCatalogAndSourceValidationRequired !== true)
  ) {
    fail("PARENT_DRIFT", "The M09-T02 Catalog/Source authority claims drifted.");
  }
  if (
    pin.proofId === "desen-app-selection-overlay" &&
    (artifact.proofId !== pin.proofId ||
      artifact.claim?.selectionChromeOutsideManagedCapabilitySubtree !== true ||
      artifact.claim?.privateDomAndReactAuthoringRejected !== true ||
      artifact.claim?.managedAdapterPathRetained !== true)
  ) {
    fail("PARENT_DRIFT", "The M09-T04 App ownership claims drifted.");
  }
  if (
    pin.proofId === "publisher-official-golden" &&
    (artifact.claims?.publicDoublePublication?.publicOperation !== "publishDesenSource" ||
      artifact.claims?.publicDoublePublication?.immutableIndependentResults !== true ||
      artifact.claims?.publicDoublePublication?.comparisons?.revisionsExactAcrossAllThree !== true)
  ) {
    fail("PARENT_DRIFT", "The M06-T10 public Publisher authority claims drifted.");
  }
  return pin;
}

function receipts(files) {
  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([relativePath, bytes]) =>
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
}

const CURRENT_SUCCESSOR_SHA256 = Object.freeze({
  [ROOT_PACKAGE_PATH]: "2e5158e6d3d58cdcb4320ffc4b343ec0b30533b84c23c81a080a650280d3334b",
  [APP_PACKAGE_PATH]: "145a5d118a0327fc10e192fcee23f5e66858dc508a18485b723cac68e852665b",
  [LOCKFILE_PATH]: "463a35abf13fd9ba6acb897aca52a11e7a90c8fcfedbce085e82f89c23418d89",
  [AUTHORING_DATA_PATH]: "cc185e4094a97a0e36c304f8e6bc7bf2630a481ceb4143d645cbe1f600d1dbd6",
  [INSPECTOR_SOURCE_PATH]: "8a79b662f5b7bf15147d242b38916162d2f6f75e175d056ba9434177c09ce8e6",
  [PANEL_SOURCE_PATH]: "a9362b4531a00bbe24cf07e9d75e6c58fe27051d77fec48e7f6a1f269bffeca0",
  [STRUCTURED_JSON_SOURCE_PATH]: "9c28b34b37bd02d213750f17c868807d4dd50c9fffb35ce6c3e3e6483a513c36",
  [APPLICATION_CSS_PATH]: "f8edeac5a918dcd8ba7b2b636a32473ccc7c1082bfa5d743763a85d25225d637",
  [INSPECTOR_TEST_PATH]: "77f777f2790962df2e0b984cf06af57200d958a5faf4dee7c9d6845c32b27406",
  [PANEL_TEST_PATH]: "73280b88d69fa0906f7f6728cb5abc9b732752b7d2ece3a096e13fe59725a7e2",
  [STRUCTURED_JSON_TEST_PATH]: "e09774464eb09f99074619ea9d33f78a111e4799127b3ff32ed9841645b3efed",
  [APPLICATION_TEST_PATH]: "292cb62cfe43b17c39b1548409a77e128ab030fc005bba9a99b98c95ce4f443c",
});

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T05 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T05 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T05 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-schema-inspector" ||
    artifact?.profile !== "desen.app.schema-inspector-proof.v1" ||
    artifact?.task !== "M09-T05" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.schemaDerivedPrimitiveAndEnumControls !== true ||
    artifact?.claim?.publicEditorCoreAtomicMutation !== true ||
    artifact?.claim?.structuredValuesLocked !== true ||
    artifact?.claim?.dynamicValuesLocked !== true ||
    artifact?.claim?.p08Status !== "NOT_PROVEN" ||
    artifact?.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((candidate) => candidate?.path),
      [...TRACKED_PATHS].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    trackedReceipts.some(
      (candidate) =>
        candidate === null ||
        typeof candidate !== "object" ||
        !Number.isSafeInteger(candidate.bytes) ||
        candidate.bytes < 0 ||
        typeof candidate.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(candidate.sha256),
    ) ||
    !isDeepStrictEqual(artifact?.tests?.rootTestNames, DESEN_APP_SCHEMA_INSPECTOR_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T05 artifact identity or retained claims drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const taskTimeReceipts = new Map(
    frozenArtifact.boundary.trackedReceipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    const authority = taskTimeReceipts.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T05 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function inspectStructuredInspectorSuccessor(files) {
  for (const [relativePath, expectedSha256] of Object.entries(CURRENT_SUCCESSOR_SHA256)) {
    const bytes = files.get(relativePath);
    if (bytes === undefined || sha256(bytes) !== expectedSha256) {
      fail("SUCCESSOR_POLICY_VIOLATION", `${relativePath} exact reviewed T06 bytes drifted.`);
    }
  }
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const structuredCommand =
    "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const rootPrefix =
    "node scripts/verify-desen-app-schema-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:structured-inspector && ";
  const rootCommands = {
    "generate:desen-app-structured-inspector": `${rootPrefix}node scripts/generate-desen-app-structured-inspector-proof.mjs`,
    "verify:desen-app-structured-inspector": `${rootPrefix}node scripts/verify-desen-app-structured-inspector.mjs`,
    "test:desen-app-structured-inspector": `${rootPrefix}node --test tests/desen-app-structured-inspector.test.mjs`,
  };
  if (
    app.scripts?.["test:structured-inspector"] !== structuredCommand ||
    app.dependencies?.["@desen/protocol"] !== "workspace:*" ||
    Object.entries(rootCommands).some(([name, command]) => root.scripts?.[name] !== command)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T06 package or proof command drifted.");
  }
  const sourceMarkers = new Map([
    [AUTHORING_DATA_PATH, ["deriveComponentInspectorControls", "ComponentInspectorControlPlan"]],
    [
      INSPECTOR_SOURCE_PATH,
      [
        "canonicalizeJsonBytes",
        "parseJsonPointer",
        'control.kind === "structured-json"',
        "nestedDynamicValue",
        "setDesenEditorOwnerProp",
      ],
    ],
    [
      PANEL_SOURCE_PATH,
      ["StructuredJsonField", "parseStructuredJsonText", "formatStructuredJson", "Apply"],
    ],
    [
      STRUCTURED_JSON_SOURCE_PATH,
      ["PUBLISH_SOURCE_JSON_LIMITS", "canonicalizeJson", "parseStructuredJsonText"],
    ],
    [
      INSPECTOR_TEST_PATH,
      [
        "edits a structured-JSON property while rejecting dynamic marker injection",
        "locks only the dynamic child while preserving edits to its literal group sibling",
      ],
    ],
    [
      PANEL_TEST_PATH,
      [
        "nested and structured Inspector panel",
        "commits structured JSON only through explicit Apply",
      ],
    ],
    [
      STRUCTURED_JSON_TEST_PATH,
      ["rejects duplicate decoded member names at every object level", "dynamic-value"],
    ],
  ]);
  for (const [relativePath, markers] of sourceMarkers) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    for (const marker of markers) {
      if (!source.includes(marker)) {
        fail("SUCCESSOR_POLICY_VIOLATION", `${relativePath} lost the T06 marker ${marker}.`);
      }
    }
  }
  return deepFreeze({
    task: "M09-T06",
    nestedObjectInspector: true,
    schemaDerivedChildControls: true,
    structuredJsonFallback: true,
    strictDuplicateMemberRejection: true,
    protocolDynamicValuesLocked: true,
    explicitApplyOnly: true,
    publicEditorCoreMutationRetained: true,
    publisherBackedSessionPreviewRetained: true,
    inspectorOutsideManagedCapabilitySubtree: true,
    package: {
      appName: app.name,
      protocolDependency: app.dependencies["@desen/protocol"],
      structuredInspectorTestCommand: structuredCommand,
      rootCommands,
    },
  });
}

/** Authenticates frozen M09-T05 evidence and checks its live additive M09-T06 successor. */
export async function buildDesenAppSchemaInspectorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_SCHEMA_INSPECTOR_PARENT_PINS.map((pin) =>
    authenticateParent(
      pin.path === SELECTION_PARENT_ARTIFACT_PATH && options.parentArtifactBytes !== undefined
        ? options.parentArtifactBytes
        : files.get(pin.path),
      pin,
    ),
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const successor = inspectStructuredInspectorSuccessor(files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-schema-inspector",
    profile: "desen.app.schema-inspector-proof.v1",
    task: "M09-T05",
    result: "PASS",
    prerequisites: parents,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      schemaDerivedPrimitiveAndEnumControls:
        frozen.artifact.claim.schemaDerivedPrimitiveAndEnumControls,
      publicEditorCoreAtomicMutation: frozen.artifact.claim.publicEditorCoreAtomicMutation,
      continuousSchemaRevalidation: frozen.artifact.claim.continuousSchemaRevalidation,
      failedEditPreservesCurrentDocument: frozen.artifact.claim.failedEditPreservesCurrentDocument,
      dynamicValuesLocked: frozen.artifact.claim.dynamicValuesLocked,
      staleRouteAndSelectionRejected: frozen.artifact.claim.staleRouteAndSelectionRejected,
      publisherSessionPreview: frozen.artifact.claim.publisherSessionPreview,
      inspectorOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.inspectorOutsideManagedCapabilitySubtree,
      selectionOverlayBoundaryRetained: frozen.artifact.claim.selectionOverlayBoundaryRetained,
    },
    successor,
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        STRUCTURED_JSON_SOURCE_PATH,
        PANEL_TEST_PATH,
        STRUCTURED_JSON_TEST_PATH,
      ].map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
  });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH);
  for (const required of [
    "Task: M09-T05",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "M09-T06: NOT_PROVEN",
    "M09-T08: NOT_PROVEN",
    "M09-T10: NOT_PROVEN",
    "M09-T12: NOT_PROVEN",
    "M09-T14: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T05 bytes and the visible report digest. */
export async function verifyDesenAppSchemaInspectorEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppSchemaInspectorEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_SCHEMA_INSPECTOR_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T05 artifact bytes differ from fresh evidence.");
  }
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularAuthority(
          capturePath(
            options.proofDocumentPath,
            "proofDocumentPath",
            path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_PATH),
          ),
          PROOF_DOCUMENT_PATH,
        )
      : captureBytes(options.proofDocument, "proofDocument");
  verifyProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    prerequisites: built.artifact.prerequisites.length,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    p08Status: built.artifact.claim.p08Status,
  });
}

/** Atomically writes exact deterministic M09-T05 proof bytes. */
export async function writeDesenAppSchemaInspectorEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactPath", "beforeAtomicRename", "buildOptions"],
    "write options",
  );
  if (
    options.beforeAtomicRename !== undefined &&
    (typeof options.beforeAtomicRename !== "function" ||
      utilTypes.isProxy(options.beforeAtomicRename))
  ) {
    fail("OPTIONS_INVALID", "beforeAtomicRename must be one non-Proxy function.");
  }
  const artifactPath = capturePath(
    options.artifactPath,
    "artifactPath",
    DEFAULT_DESEN_APP_SCHEMA_INSPECTOR_ARTIFACT_PATH,
  );
  const built = await buildDesenAppSchemaInspectorEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T05 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
