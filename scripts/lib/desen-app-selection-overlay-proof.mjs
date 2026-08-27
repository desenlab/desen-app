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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-SELECTION-OVERLAY.md";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-selection-overlay-proof.mjs",
  "scripts/generate-desen-app-selection-overlay-proof.mjs",
  "scripts/verify-desen-app-selection-overlay.mjs",
  "tests/desen-app-selection-overlay.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  SELECTION_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  SELECTION_TEST_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  PARENT_ARTIFACT_PATH,
  ...PROOF_READER_PATHS,
]);

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  [SELECTION_SOURCE_PATH]: "e97eed87734fff6fdc3a40dbc81754a88318238090e4c1dfcc53062e8ff7fc7c",
  [ADAPTER_SOURCE_PATH]: "e9f46d9965741066bf43329af2fcba8f7296740862eea3513fc792693d8cbd06",
  [APPLICATION_SOURCE_PATH]: "df13d30eb9ec58477c0c24ee0202ed66cc24aaf10e43e6031f62ba7690efa014",
  [APPLICATION_CSS_PATH]: "995a9cb596628114a4488d7bbc9aac204433b3ac391b638acfd0bcce8667b1bc",
});

const PRIVATE_DOM_PROPERTIES = Object.freeze([
  "closest",
  "composedPath",
  "elementFromPoint",
  "elementsFromPoint",
  "getBoundingClientRect",
  "getClientRects",
  "getElementById",
  "getElementsByClassName",
  "getElementsByTagName",
  "innerHTML",
  "matches",
  "offsetHeight",
  "offsetLeft",
  "offsetTop",
  "offsetWidth",
  "outerHTML",
  "parentElement",
  "parentNode",
  "querySelector",
  "querySelectorAll",
]);

const PRIVATE_DOM_GLOBALS = Object.freeze([
  "document",
  "Element",
  "HTMLElement",
  "MutationObserver",
  "Node",
  "ResizeObserver",
  "window",
]);

const EXPECTED_SELECTION_TEST_NAMES = Object.freeze([
  "creates only a frozen inert route and Source identity",
  "keeps idle and pre-render states explicit without inventing a runtime target",
  "projects repeated component instances while excluding attached behavior identities",
  "reports a conditional Source component honestly when no runtime instance exists",
  "rejects cross-route, cross-surface, and stale-capability identities closed",
  "rejects a forged same-route Source identity instead of treating it as conditional",
]);

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "renders Source-identity selection chrome as a sibling outside the managed subtree",
  "keeps a selected conditional Source node honest when it is not materialized",
  "rejects stale and cross-route selection identities without exposing overlay chrome",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "selects Source layers accessibly and keeps the identity overlay outside managed adapters",
  "removes the managed sign-in tree synchronously when routing to an unsupported surface",
]);

/** Exact immutable M09-T03 parent receipt for M09-T04. */
export const DESEN_APP_SELECTION_OVERLAY_PARENT_PIN = Object.freeze({
  task: "M09-T03",
  proofId: "desen-app-real-adapter-canvas",
  path: PARENT_ARTIFACT_PATH,
  bytes: 73_111,
  sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
  profile: "desen.app.real-adapter-canvas-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Reviewed independent root-test names retained by the M09-T04 artifact. */
export const DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M09-T03 adapter-canvas parent",
  "[selection] captures only exact primitive Source identity admitted by the authoring model",
  "[projection] preserves repeats, filters behavior identities, and rejects stale targets",
  "[ownership] proves selection chrome is a sibling outside the managed capability subtree",
  "[boundary] rejects private DOM, React-tree, geometry, registry, session, and callback authority",
  "[experience] records accessible single selection, conditional feedback, and route reset",
  "[determinism] builds byte-identical detached evidence twice",
  "[mutation] rejects private lookup, geometry, overlay nesting, and perimeter-box substitutions",
  "[verification] rejects parent, committed artifact, and visible proof-pin drift",
  "[filesystem] writes atomically and rejects non-regular proof authorities",
]);

/** Default destination for deterministic M09-T04 evidence. */
export const DEFAULT_DESEN_APP_SELECTION_OVERLAY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T04 evidence reader. */
export class DesenAppSelectionOverlayProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppSelectionOverlayProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppSelectionOverlayProofError(code, message, details);
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

function canonicalArtifactBytes(artifact) {
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
  if (!(value instanceof Map) || utilTypes.isProxy(value) || value.size > TRACKED_PATHS.length) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (!TRACKED_PATHS.includes(relativePath) || captured.has(relativePath)) {
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
    if (error instanceof DesenAppSelectionOverlayProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const output = new Map();
  for (const relativePath of TRACKED_PATHS) {
    const overridden = overrides.get(relativePath);
    output.set(
      relativePath,
      overridden ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
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
    if (declaration !== undefined && ts.isIdentifier(declaration.name))
      return declaration.name.text;
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
  const candidates = sourceFile.statements.filter((statement) => functionName(statement) === name);
  if (candidates.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", `Expected exactly one ${name} function.`);
  }
  return candidates[0];
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

function assertNoPrivateInspection(sourceFile, relativePath, allowApplicationNavigation = false) {
  const privateProperties = collectDescendants(sourceFile, ts.isPropertyAccessExpression)
    .filter((access) => PRIVATE_DOM_PROPERTIES.includes(access.name.text))
    .map((access) => access.getText(sourceFile));
  const allowed = allowApplicationNavigation
    ? privateProperties.filter(
        (text) => text === "document.getElementById" || text === "document.querySelector",
      )
    : [];
  const forbiddenProperties = allowApplicationNavigation
    ? privateProperties.filter(
        (text) => text !== "document.getElementById" && text !== "document.querySelector",
      )
    : privateProperties;
  const privateGlobals = collectDescendants(sourceFile, ts.isIdentifier)
    .filter(({ text }) => PRIVATE_DOM_GLOBALS.includes(text))
    .filter((identifier) => {
      if (!allowApplicationNavigation) return true;
      return identifier.text !== "document" && identifier.text !== "HTMLElement";
    });
  const reactPrivate = collectDescendants(sourceFile, ts.isIdentifier).filter(({ text }) =>
    ["Children", "cloneElement", "createPortal", "findDOMNode"].includes(text),
  );
  const reactPrivateKeys = collectDescendants(sourceFile, ts.isStringLiteral).filter(({ text }) =>
    /^_+react(?:Fiber|Props|RootContainer|Container)/u.test(text),
  );
  if (
    forbiddenProperties.length !== 0 ||
    privateGlobals.length !== 0 ||
    reactPrivate.length !== 0 ||
    reactPrivateKeys.length !== 0
  ) {
    fail("PRIVATE_STRUCTURE_AUTHORITY", `${relativePath} admits private DOM or React authority.`, {
      properties: forbiddenProperties,
      globals: privateGlobals.map(({ text }) => text),
      reactPrivate: reactPrivate.map(({ text }) => text),
    });
  }
  return Object.freeze({
    privateDomOrGeometryCalls: 0,
    privateReactReferences: 0,
    allowedAppNavigationDomCalls: allowed.length,
  });
}

function assertExpectedHash(rawSource, relativePath) {
  const actual = sha256(Buffer.from(rawSource, "utf8"));
  if (actual !== EXPECTED_SOURCE_SHA256[relativePath]) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} exact reviewed bytes drifted.`, { actual });
  }
}

function interfacePropertyNames(sourceFile, interfaceName) {
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName,
  );
  if (declarations.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", `Expected exactly one ${interfaceName} interface.`);
  }
  return declarations[0].members.map((member) => member.name?.getText(sourceFile) ?? "<missing>");
}

function inspectSelectionSource(rawSource) {
  assertExpectedHash(rawSource, SELECTION_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, SELECTION_SOURCE_PATH);
  const imports = importModules(sourceFile);
  if (
    !isDeepStrictEqual(imports, [
      { module: "@desen/runtime-react", typeOnly: true },
      { module: "./authoring-data.js", typeOnly: true },
    ])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Selection may import only public callback-free types.", {
      imports,
    });
  }
  const privateInspection = assertNoPrivateInspection(sourceFile, SELECTION_SOURCE_PATH);
  const selectionKeys = interfacePropertyNames(sourceFile, "AuthoringComponentSelection");
  const snapshotKeys = interfacePropertyNames(sourceFile, "AuthoringRenderedIdentitySnapshot");
  if (
    !isDeepStrictEqual(selectionKeys, [
      "kind",
      "projectId",
      "surfaceId",
      "sourceNodeId",
      "capabilityId",
      "displayName",
      "conditional",
    ]) ||
    !isDeepStrictEqual(snapshotKeys, ["surfaceId", "diagnosticIndex"])
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The exact inert selection or runtime snapshot shape drifted.",
      {
        selectionKeys,
        snapshotKeys,
      },
    );
  }

  const propertyNames = collectDescendants(sourceFile, ts.isPropertyAccessExpression).map(
    (access) => access.name.text,
  );
  const diagnosticReads = propertyNames.filter((name) =>
    ["byRuntimeNodeId", "runtimeNodeIdsByBehaviorId", "runtimeNodeIdsBySourceNodeId"].includes(
      name,
    ),
  );
  if (
    !diagnosticReads.includes("byRuntimeNodeId") ||
    !diagnosticReads.includes("runtimeNodeIdsBySourceNodeId") ||
    diagnosticReads.includes("runtimeNodeIdsByBehaviorId") ||
    propertyNames.some((name) =>
      ["element", "props", "registry", "session", "style"].includes(name),
    )
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Selection escaped its public identity-only diagnostic seam.", {
      diagnosticReads,
    });
  }

  const stringLiterals = new Set(
    collectDescendants(sourceFile, ts.isStringLiteral).map(({ text }) => text),
  );
  for (const status of ["idle", "rejected", "unavailable", "not-materialized", "materialized"]) {
    if (!stringLiterals.has(status)) {
      fail("SOURCE_POLICY_VIOLATION", `Selection lost explicit ${status} state.`);
    }
  }
  for (const name of [
    "createAuthoringComponentSelection",
    "isSameAuthoringComponentSelection",
    "projectAuthoringSelection",
  ]) {
    exactFunction(sourceFile, name);
  }
  return deepFreeze({
    exactPrimitiveFields: selectionKeys,
    exactRuntimeSnapshotFields: snapshotKeys,
    authoringModelMembershipRequired: true,
    conditionalAbsenceOnly: true,
    repeatedRuntimeIdentitiesPreserved: true,
    attachedBehaviorIdentitiesFiltered: true,
    diagnosticReads: [...new Set(diagnosticReads)].sort(),
    constructorDropsUnknownFields: true,
    privateInspection,
  });
}

function jsxTagName(node, sourceFile) {
  const tagName = node.tagName;
  return ts.isIdentifier(tagName) ? tagName.text : tagName.getText(sourceFile);
}

function isWithin(node, ancestor) {
  let current = node.parent;
  while (current !== undefined) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function inspectAdapterSource(rawSource) {
  assertExpectedHash(rawSource, ADAPTER_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, ADAPTER_SOURCE_PATH);
  const imports = importModules(sourceFile);
  if (
    !imports.some(({ module, typeOnly }) => module === "./authoring-selection.js" && !typeOnly) ||
    !imports.some(({ module, typeOnly }) => module === "./authoring-data.js" && !typeOnly) ||
    !imports.some(({ module, typeOnly }) => module === "@desen/runtime-react" && !typeOnly) ||
    imports.some(({ module }) => /(?:\/src\/|\/dist\/|internal)/u.test(module))
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Canvas selection imports drifted from public/local boundaries.",
      {
        imports,
      },
    );
  }
  const privateInspection = assertNoPrivateInspection(sourceFile, ADAPTER_SOURCE_PATH);
  const managedFunction = exactFunction(sourceFile, "ManagedAdapterSurface");
  const managedBody = functionBody(managedFunction);
  if (managedBody === undefined) {
    fail("SOURCE_POLICY_VIOLATION", "ManagedAdapterSurface lost its exact body.");
  }
  const jsxNodes = collectDescendants(
    managedBody,
    (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
  );
  const fieldsetOpenings = jsxNodes.filter((node) => jsxTagName(node, sourceFile) === "fieldset");
  const overlayOpenings = jsxNodes.filter(
    (node) => jsxTagName(node, sourceFile) === "SelectionOverlay",
  );
  const boundaryOpenings = jsxNodes.filter(
    (node) => jsxTagName(node, sourceFile) === "RuntimeReactSurfaceBoundary",
  );
  if (
    fieldsetOpenings.length !== 1 ||
    overlayOpenings.length !== 1 ||
    boundaryOpenings.length !== 1
  ) {
    fail("OVERLAY_OWNERSHIP_VIOLATION", "Managed canvas ownership markers drifted.");
  }
  const fieldsetElement = fieldsetOpenings[0].parent;
  if (
    !ts.isJsxElement(fieldsetElement) ||
    isWithin(overlayOpenings[0], fieldsetElement) ||
    !isWithin(boundaryOpenings[0], fieldsetElement)
  ) {
    fail(
      "OVERLAY_OWNERSHIP_VIOLATION",
      "Selection overlay must remain a sibling outside the managed fieldset subtree.",
    );
  }

  const dataAttributes = collectDescendants(sourceFile, ts.isJsxAttribute)
    .map((attribute) => attribute.name.getText(sourceFile))
    .filter((name) => name.startsWith("data-"));
  if (
    !dataAttributes.includes("data-managed-capability-subtree") ||
    !dataAttributes.includes("data-selection-overlay")
  ) {
    fail("OVERLAY_OWNERSHIP_VIOLATION", "Managed and overlay ownership markers are incomplete.");
  }
  const registryCalls = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) &&
      call.expression.text === "createRuntimeReactAdapterRegistry",
  );
  if (
    registryCalls.length !== 1 ||
    registryCalls[0].arguments[0]?.getText(sourceFile) !==
      "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT"
  ) {
    fail("SOURCE_POLICY_VIOLATION", "T04 altered the exact shared public adapter registry path.");
  }
  const projectorCalls = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) && call.expression.text === "projectAuthoringSelection",
  );
  if (projectorCalls.length !== 1 || projectorCalls[0].arguments.length !== 4) {
    fail("SOURCE_POLICY_VIOLATION", "Canvas must project one exact detached identity snapshot.");
  }
  const snapshotProperties = collectDescendants(managedBody, ts.isPropertyAssignment)
    .map((assignment) => assignment.name.getText(sourceFile))
    .filter((name) => ["diagnosticIndex", "surfaceId"].includes(name));
  if (
    !snapshotProperties.includes("diagnosticIndex") ||
    !snapshotProperties.includes("surfaceId")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Canvas lost the detached diagnostic identity snapshot.");
  }
  return deepFreeze({
    publicRuntimeOnly: true,
    exactSharedRegistryRetained: true,
    detachedSnapshotFields: ["surfaceId", "diagnosticIndex"],
    managedFieldsetContainsRuntimeBoundary: true,
    overlayOutsideManagedFieldset: true,
    overlayReceivesNoManagedChildOrDomHandle: true,
    dataAttributes: [...new Set(dataAttributes)].sort(),
    privateInspection,
  });
}

function inspectApplicationSource(rawSource) {
  assertExpectedHash(rawSource, APPLICATION_SOURCE_PATH);
  const sourceFile = parseTypeScript(rawSource, APPLICATION_SOURCE_PATH);
  const imports = importModules(sourceFile);
  if (
    !imports.some(({ module, typeOnly }) => module === "./authoring-selection.js" && !typeOnly) ||
    imports.some(({ module }) => module === "@desen/editor-core")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Application selection ownership or editor boundary drifted.");
  }
  const privateInspection = assertNoPrivateInspection(sourceFile, APPLICATION_SOURCE_PATH, true);
  if (privateInspection.allowedAppNavigationDomCalls !== 2) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Only the two historical app-owned navigation/focus DOM calls are allowed.",
      privateInspection,
    );
  }
  const layerFunction = exactFunction(sourceFile, "LayerNode");
  const surfaceFunction = exactFunction(sourceFile, "SurfaceEditor");
  const layerBody = functionBody(layerFunction);
  const surfaceBody = functionBody(surfaceFunction);
  if (layerBody === undefined || surfaceBody === undefined) {
    fail("SOURCE_POLICY_VIOLATION", "Layer or route-owned selection body is missing.");
  }
  const layerJsx = collectDescendants(
    layerBody,
    (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
  );
  const buttons = layerJsx.filter((node) => jsxTagName(node, sourceFile) === "button");
  if (buttons.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", "Each Source layer must own one native selection button.");
  }
  const buttonAttributes = buttons[0].attributes.properties
    .filter(ts.isJsxAttribute)
    .map((attribute) => attribute.name.getText(sourceFile));
  if (
    !buttonAttributes.includes("aria-pressed") ||
    !buttonAttributes.includes("aria-label") ||
    !buttonAttributes.includes("onClick") ||
    buttonAttributes.includes("onKeyDown")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Layer selection must preserve native accessible activation.", {
      buttonAttributes,
    });
  }
  const stateCalls = collectDescendants(surfaceBody, ts.isCallExpression).filter(
    (call) => ts.isIdentifier(call.expression) && call.expression.text === "useState",
  );
  if (stateCalls.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", "SurfaceEditor must own one route-local selection state.");
  }
  const projectShell = exactFunction(sourceFile, "ProjectShell");
  const projectBody = functionBody(projectShell);
  const surfaceEditors = collectDescendants(
    projectBody,
    (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
  ).filter((node) => jsxTagName(node, sourceFile) === "SurfaceEditor");
  const keyedSurfaceEditor = surfaceEditors.flatMap((node) =>
    node.attributes.properties
      .filter(ts.isJsxAttribute)
      .filter((attribute) => attribute.name.getText(sourceFile) === "key"),
  );
  if (
    surfaceEditors.length !== 1 ||
    keyedSurfaceEditor.length !== 1 ||
    !keyedSurfaceEditor[0].getText(sourceFile).includes("project.id") ||
    !keyedSurfaceEditor[0].getText(sourceFile).includes("selectedSurface.id")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Route-owned SurfaceEditor lost its exact key reset.");
  }
  return deepFreeze({
    nativeLayerButton: true,
    buttonAttributes: buttonAttributes.sort(),
    singleRouteLocalSelectionState: true,
    routeKeyReset: true,
    validatedAuthoringNodeMinting: true,
    privateInspection,
  });
}

function cssRule(rawCss, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = rawCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"));
  if (match === null) fail("CSS_POLICY_VIOLATION", `Missing exact ${selector} CSS rule.`);
  return match[1].replace(/\s+/gu, " ").trim();
}

function inspectCssSource(rawCss) {
  assertExpectedHash(rawCss, APPLICATION_CSS_PATH);
  const overlayRule = cssRule(rawCss, ".selectionOverlay");
  if (
    !overlayRule.includes("position: absolute") ||
    !overlayRule.includes("pointer-events: none") ||
    !overlayRule.includes("width: max-content") ||
    overlayRule.includes("inset:") ||
    /(?:width|height):\s*100%/u.test(overlayRule)
  ) {
    fail(
      "CSS_POLICY_VIOLATION",
      "Selection chrome must remain a compact non-interactive identity card, not a geometry box.",
      { overlayRule },
    );
  }
  const selectors = [...rawCss.matchAll(/([^{}]+)\{/gu)].map((match) => match[1].trim());
  const managedDescendantSelectors = selectors.filter(
    (selector) =>
      selector.includes("data-managed-capability") ||
      (/selectionOverlay/u.test(selector) && /adapterCanvasSurface/u.test(selector)),
  );
  if (managedDescendantSelectors.length !== 0) {
    fail("CSS_POLICY_VIOLATION", "CSS cannot inspect or target managed capability descendants.", {
      managedDescendantSelectors,
    });
  }
  return deepFreeze({
    compactIdentityCard: true,
    componentGeometryClaimed: false,
    pointerEvents: "none",
    managedDescendantSelectors: 0,
    responsiveEditorStatusDocked: rawCss.includes(".editorStatus {\n    position: static;"),
  });
}

/** Applies the exact M09-T04 production source and ownership policy. */
export function verifyDesenAppSelectionOverlaySourcePolicy(rawInput) {
  const input = exactOwnDataOptions(
    rawInput,
    ["adapterSource", "applicationSource", "cssSource", "selectionSource"],
    "source policy input",
  );
  for (const key of ["adapterSource", "applicationSource", "cssSource", "selectionSource"]) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    selection: inspectSelectionSource(input.selectionSource),
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    css: inspectCssSource(input.cssSource),
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

function inspectTests(files) {
  const selectionNames = collectTestNames(
    decodeUtf8(files.get(SELECTION_TEST_PATH), SELECTION_TEST_PATH),
    SELECTION_TEST_PATH,
  );
  const adapterNames = collectTestNames(
    decodeUtf8(files.get(ADAPTER_TEST_PATH), ADAPTER_TEST_PATH),
    ADAPTER_TEST_PATH,
  );
  const applicationNames = collectTestNames(
    decodeUtf8(files.get(APPLICATION_TEST_PATH), APPLICATION_TEST_PATH),
    APPLICATION_TEST_PATH,
  );
  for (const [actual, expected, label] of [
    [selectionNames, EXPECTED_SELECTION_TEST_NAMES, "selection"],
    [adapterNames, EXPECTED_ADAPTER_TEST_NAMES, "adapter"],
    [applicationNames, EXPECTED_APPLICATION_TEST_NAMES, "application"],
  ]) {
    const missing = expected.filter((name) => !actual.includes(name));
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `Required ${label} tests drifted.`, { missing });
    }
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:selection && node --test tests/desen-app-selection-overlay.test.mjs",
    selectionTestNames: EXPECTED_SELECTION_TEST_NAMES,
    adapterTestNames: EXPECTED_ADAPTER_TEST_NAMES,
    applicationTestNames: EXPECTED_APPLICATION_TEST_NAMES,
    rootTestNames: DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES,
    hostileMutationClasses: [
      "UNKNOWN_OR_STALE_SOURCE_IDENTITY",
      "CALLBACK_OR_EXTRA_SELECTION_FIELD",
      "PRIVATE_DOM_LOOKUP",
      "PRIVATE_REACT_TREE_ACCESS",
      "GEOMETRY_MEASUREMENT",
      "OVERLAY_NESTING",
      "PERIMETER_BOUNDING_BOX",
      "REGISTRY_OR_MANAGED_TREE_SUBSTITUTION",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/authoring-selection.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:selection"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App selection test command drifted.");
  }
  const expectedRootCommands = {
    "generate:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node scripts/generate-desen-app-selection-overlay-proof.mjs",
    "verify:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node scripts/verify-desen-app-selection-overlay.mjs",
    "test:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node --test tests/desen-app-selection-overlay.test.mjs",
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
    directParentVerifier: "node scripts/verify-desen-app-real-adapter-canvas.mjs",
  });
}

function authenticateParent(bytes) {
  if (
    bytes.byteLength !== DESEN_APP_SELECTION_OVERLAY_PARENT_PIN.bytes ||
    sha256(bytes) !== DESEN_APP_SELECTION_OVERLAY_PARENT_PIN.sha256
  ) {
    fail("PARENT_DRIFT", "The exact frozen M09-T03 parent artifact changed.");
  }
  const artifact = parseJson(bytes, "frozen M09-T03 parent artifact");
  if (
    artifact.task !== DESEN_APP_SELECTION_OVERLAY_PARENT_PIN.task ||
    artifact.proofId !== DESEN_APP_SELECTION_OVERLAY_PARENT_PIN.proofId ||
    artifact.profile !== DESEN_APP_SELECTION_OVERLAY_PARENT_PIN.profile ||
    artifact.result !== "PASS" ||
    artifact.claim?.exactPublicRuntimeReactRendererUsed !== true ||
    artifact.claim?.privateDomAuthoringRejected !== true
  ) {
    fail("PARENT_DRIFT", "The M09-T03 parent identity or retained claims drifted.");
  }
  return DESEN_APP_SELECTION_OVERLAY_PARENT_PIN;
}

function receipts(files) {
  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([relativePath, bytes]) =>
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
}

/** Builds detached deterministic M09-T04 selection-overlay evidence. */
export async function buildDesenAppSelectionOverlayEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parentBytes = options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH);
  const parent = authenticateParent(parentBytes);
  const source = verifyDesenAppSelectionOverlaySourcePolicy({
    selectionSource: decodeUtf8(files.get(SELECTION_SOURCE_PATH), SELECTION_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    cssSource: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-selection-overlay",
    profile: "desen.app.selection-overlay-proof.v1",
    task: "M09-T04",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      stableSourceIdentitySelection: true,
      validatedAuthoringModelMembershipRequired: true,
      publicDiagnosticIndexOnly: true,
      repeatedRuntimeInstancesPreserved: true,
      behaviorRuntimeIdentitiesExcludedFromComponentSelection: true,
      conditionalAbsenceRepresentedHonestly: true,
      unknownAndStaleIdentityRejected: true,
      selectionChromeOutsideManagedCapabilitySubtree: true,
      privateDomAndReactAuthoringRejected: true,
      componentGeometryClaimed: false,
      managedAdapterPathRetained: true,
      routeResetSynchronous: true,
      n042Status: "TESTED",
      p06Status: "PROVEN",
      p07Status: "PARTIAL",
      p16Status: "PARTIAL",
    },
    authority: { source },
    application: {
      package: packageContract,
      selection: {
        owner: "route-keyed SurfaceEditor",
        identity: "project/surface/Source/capability/display/conditional primitives",
        runtimeLookup: "RuntimeReactDiagnosticIndex callback-free identity",
        persistence: false,
      },
      overlay: {
        owner: "Desen App authoring chrome",
        relationship: "DOM sibling outside disabled managed fieldset",
        shape: "compact identity/status card",
        pointerEvents: "none",
        componentGeometry: false,
      },
      accessibility: {
        nativeLayerButtons: true,
        pressedState: true,
        dynamicSelectDeselectName: true,
        conditionalName: true,
        panelLiveStatus: true,
        tabKeyboardWrap: true,
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
    },
    result: "PASS",
    nonclaims: [
      "No per-component rectangle, hit testing, canvas picking, geometry, or private DOM/native structure is exposed.",
      "No inspector, Source mutation, insertion, move, reorder, cardinality, drag/drop, binding, event, or action authoring.",
      "No Design/Run switch, diagnostics navigation, invalid placeholders, persistence, publication, or activation.",
      "P-07 and P-16 remain PARTIAL; browser E2E and end-to-end diagnostic selection remain later tasks.",
      "N-042 is TESTED only for this exact controlled Web-React profile, not arbitrary future or native adapters.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH);
  for (const required of [
    "Task: M09-T04",
    "Status: DONE",
    "N-042: TESTED",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T04 bytes and the visible report digest. */
export async function verifyDesenAppSelectionOverlayEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppSelectionOverlayEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_SELECTION_OVERLAY_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T04 artifact bytes differ from fresh evidence.");
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
    n042Status: built.artifact.claim.n042Status,
  });
}

/** Atomically writes exact deterministic M09-T04 proof bytes. */
export async function writeDesenAppSelectionOverlayEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_SELECTION_OVERLAY_ARTIFACT_PATH,
  );
  const built = await buildDesenAppSelectionOverlayEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T04 artifact write failed safely.", {
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
