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
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const GLOBAL_CSS_PATH = "apps/desen-app/src/styles.css";
const SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const AUTHORING_DATA_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const AUTHORING_SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
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

const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-selection-overlay-proof.mjs",
  "tests/desen-app-selection-overlay.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    NAMED_SLOT_ARTIFACT_PATH,
    AUTHORING_DATA_PATH,
    INSPECTOR_SOURCE_PATH,
    PREVIEW_SOURCE_PATH,
    PANEL_SOURCE_PATH,
    STRUCTURED_JSON_SOURCE_PATH,
    AUTHORING_SLOT_SOURCE_PATH,
    GLOBAL_CSS_PATH,
    AUTHORING_DATA_TEST_PATH,
    INSPECTOR_TEST_PATH,
    PREVIEW_TEST_PATH,
    PANEL_TEST_PATH,
    STRUCTURED_JSON_TEST_PATH,
    AUTHORING_SLOT_TEST_PATH,
    LOCKFILE_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
  ]),
]);

const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-selection-overlay-proof.mjs",
  "tests/desen-app-selection-overlay.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 11_997,
  sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
});

const NAMED_SLOT_ARTIFACT_PIN = Object.freeze({
  task: "M09-T07",
  proofId: "desen-app-named-slot-authoring",
  profile: "desen.app.named-slot-authoring-proof.v1",
  result: "PASS",
  path: NAMED_SLOT_ARTIFACT_PATH,
  bytes: 24_830,
  sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
});

const FIXTURES_SCENARIOS_ARTIFACT_PIN = Object.freeze({
  task: "M09-T11",
  proofId: "desen-app-fixtures-scenarios-fidelity",
  profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
  result: "PASS",
  path: FIXTURES_SCENARIOS_ARTIFACT_PATH,
  bytes: 29_407,
  sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
});

const T11_LIVE_RECEIPT_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const NAMED_SLOT_LIVE_SOURCE_AND_TEST_PATHS = Object.freeze([
  ADAPTER_SOURCE_PATH,
  AUTHORING_DATA_PATH,
  PREVIEW_SOURCE_PATH,
  AUTHORING_SLOT_SOURCE_PATH,
  ADAPTER_TEST_PATH,
  AUTHORING_DATA_TEST_PATH,
  PREVIEW_TEST_PATH,
  AUTHORING_SLOT_TEST_PATH,
]);

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  [SELECTION_SOURCE_PATH]: "e97eed87734fff6fdc3a40dbc81754a88318238090e4c1dfcc53062e8ff7fc7c",
  [ADAPTER_SOURCE_PATH]: "911dadf85606f60c4b6e73d793dc9e3bf3ff0c938b606bb7bc04f2ea958772f9",
  [APPLICATION_SOURCE_PATH]: "b2afd9138c8219a2435d63b66411197d3ca2c51a5f4734d4ead5c7a8d43ad956",
  [APPLICATION_CSS_PATH]: "3b7eaa736f2cc85113267a800e831b1bb70504cf363959a243137434e8a91a29",
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
    if (error instanceof DesenAppSelectionOverlayProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const output = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    const overridden = overrides.get(relativePath);
    const live = await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath);
    if (
      overridden !== undefined &&
      SELF_RESEALED_PATHS.includes(relativePath) &&
      !isDeepStrictEqual(overridden, live)
    ) {
      fail("BOUNDARY_DRIFT", `${relativePath} cannot be substituted by a caller.`);
    }
    output.set(relativePath, overridden ?? live);
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
        (text) =>
          text === "document.getElementById" ||
          text === "document.querySelector" ||
          text === "eventElement?.closest" ||
          text === "exactBoundary?.parentElement" ||
          text === "event.currentTarget.closest" ||
          text === "rows[hoveredRowIndex]?.getBoundingClientRect" ||
          text === "row.getBoundingClientRect" ||
          text === "scrollSurface.getBoundingClientRect" ||
          text === "event.currentTarget.getBoundingClientRect",
      )
    : [];
  const forbiddenProperties = allowApplicationNavigation
    ? privateProperties.filter(
        (text) =>
          text !== "document.getElementById" &&
          text !== "document.querySelector" &&
          text !== "eventElement?.closest" &&
          text !== "exactBoundary?.parentElement" &&
          text !== "event.currentTarget.closest" &&
          text !== "rows[hoveredRowIndex]?.getBoundingClientRect" &&
          text !== "row.getBoundingClientRect" &&
          text !== "scrollSurface.getBoundingClientRect" &&
          text !== "event.currentTarget.getBoundingClientRect",
      )
    : privateProperties;
  const privateGlobals = collectDescendants(sourceFile, ts.isIdentifier)
    .filter(({ text }) => PRIVATE_DOM_GLOBALS.includes(text))
    .filter((identifier) => {
      if (!allowApplicationNavigation) return true;
      if (
        identifier.text === "document" ||
        identifier.text === "HTMLElement" ||
        identifier.text === "Element" ||
        identifier.text === "Node"
      ) {
        return false;
      }
      return !(
        identifier.text === "Node" &&
        ts.isBinaryExpression(identifier.parent) &&
        identifier.parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
        identifier.parent.left.getText(sourceFile) === "relatedTarget"
      );
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
    allowedAppNavigationDomCalls: allowed.filter(
      (text) => text === "document.getElementById" || text === "document.querySelector",
    ).length,
    allowedRowDropGeometryCalls: allowed.filter((text) => text.endsWith("getBoundingClientRect"))
      .length,
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
  const sourceFile = parseTypeScript(rawSource, APPLICATION_SOURCE_PATH);
  const imports = importModules(sourceFile);
  if (
    !imports.some(({ module, typeOnly }) => module === "./authoring-selection.js" && !typeOnly) ||
    imports.some(({ module }) => module === "@desen/editor-core")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Application selection ownership or editor boundary drifted.");
  }
  const privateInspection = assertNoPrivateInspection(sourceFile, APPLICATION_SOURCE_PATH, true);
  if (
    privateInspection.allowedAppNavigationDomCalls !== 2 ||
    privateInspection.allowedRowDropGeometryCalls !== 4
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Only two navigation/focus calls plus four exact layer-drop geometry reads are allowed.",
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
  if (stateCalls.length !== 4) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "SurfaceEditor must own route-local mode, selection, authoring-session, and scenario state.",
    );
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
    routeLocalSelectionAndAuthoringSessionState: true,
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
  const inspectorCommand =
    "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const structuredInspectorCommand =
    "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  const namedSlotCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (
    app.scripts?.["test:inspector"] !== inspectorCommand ||
    app.scripts?.["test:structured-inspector"] !== structuredInspectorCommand ||
    app.scripts?.["test:named-slots"] !== namedSlotCommand ||
    ["@desen/catalog-sdk", "@desen/editor-core", "@desen/protocol", "@desen/publisher"].some(
      (dependency) => app.dependencies?.[dependency] !== "workspace:*",
    )
  ) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact T05 App dependency or test contract drifted.");
  }
  const expectedRootCommands = {
    "generate:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node scripts/generate-desen-app-selection-overlay-proof.mjs",
    "verify:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node scripts/verify-desen-app-selection-overlay.mjs",
    "test:desen-app-selection-overlay":
      "node scripts/verify-desen-app-real-adapter-canvas.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:selection && node --test tests/desen-app-selection-overlay.test.mjs",
  };
  const namedSlotPrefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const namedSlotRootCommands = {
    "generate:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${namedSlotPrefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  for (const [name, command] of Object.entries(namedSlotRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} successor command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    inspectorTestCommand: inspectorCommand,
    structuredInspectorTestCommand: structuredInspectorCommand,
    namedSlotTestCommand: namedSlotCommand,
    namedSlotRootCommands,
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

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T04 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T04 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T04 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-selection-overlay" ||
    artifact?.profile !== "desen.app.selection-overlay-proof.v1" ||
    artifact?.task !== "M09-T04" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.stableSourceIdentitySelection !== true ||
    artifact?.claim?.selectionChromeOutsideManagedCapabilitySubtree !== true ||
    artifact?.claim?.privateDomAndReactAuthoringRejected !== true ||
    artifact?.claim?.n042Status !== "TESTED" ||
    artifact?.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((candidate) => candidate?.path).sort(),
      [...TRACKED_PATHS].sort(),
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
    !isDeepStrictEqual(artifact?.tests?.rootTestNames, DESEN_APP_SELECTION_OVERLAY_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T04 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T04 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateNamedSlotArtifact(bytes, files) {
  const pin = NAMED_SLOT_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T07 named-slot artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, NAMED_SLOT_ARTIFACT_PATH);
  const authenticatedClaims = {
    publicValidatedDelete:
      artifact.claim?.nodeDeletionPreflight === true &&
      artifact.claim?.deletionPreflightRunsPublicMutationAndValidation === true &&
      artifact.claim?.publicNestedSubtreeDelete === true &&
      artifact.claim?.continuousCompleteSourceRevalidation === true,
    exactDeleteSelection: artifact.claim?.exactOwnDataDeletionSelectionCapture === true,
    rootAndSourceMinimumDeletionDisabled:
      artifact.claim?.rootDeletionDisabled === true &&
      artifact.claim?.sourceMinimumDeletionDisabled === true,
    behaviorOwnedDeletePreservesEmptySlot:
      artifact.claim?.behaviorOwnedDeletePreservesEmptySlot === true,
    failedDeletionPreservesCurrentDocument:
      artifact.claim?.failedDeletionPreservesCurrentDocument === true,
    browserDataTransferReadsZero: artifact.claim?.browserDataTransferReadsZero === true,
    expandedDropReadyBoundaries: artifact.claim?.expandedDropReadyBoundaries === true,
    stableNestedDragHover: artifact.claim?.stableNestedDragHover === true,
    explicitComponentDropTargetGuide: artifact.claim?.explicitComponentDropTargetGuide === true,
    deletionSourceAndPreviewCommitAtomically:
      artifact.claim?.deletionSourceAndPreviewCommitAtomically === true,
    deletionFocusManaged: artifact.claim?.deletionFocusManaged === true,
  };
  const expectedLocalCommandReceipts = {
    pureSlot: {
      command: "pnpm --filter @desen/app-web exec vitest run test/authoring-slots.test.ts",
      result: "PASS",
      testFiles: 1,
      tests: 27,
    },
    focusedNamedSlots: {
      command: "pnpm --filter @desen/app-web test:named-slots",
      result: "PASS",
      testFiles: 5,
      tests: 70,
    },
    fullApp: {
      command: "pnpm --filter @desen/app-web test",
      result: "PASS",
      testFiles: 11,
      tests: 151,
    },
    rootProof: {
      command: "node --test tests/desen-app-named-slot-authoring.test.mjs",
      result: "PASS",
      testFiles: 1,
      tests: 9,
    },
  };
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact.claim?.publicStableIdInsert !== true ||
    artifact.claim?.publicCrossSlotMove !== true ||
    artifact.claim?.publicSameSlotReorder !== true ||
    artifact.claim?.cyclePreflight !== true ||
    artifact.claim?.insertionAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.placementAdmissionCachedPerModelAndExactTarget !== true ||
    artifact.claim?.componentPaletteRenderLimit !== 24 ||
    artifact.claim?.activeTabOnlyAuthoringWork !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.slotChromeOutsideManagedCapabilitySubtree !== true ||
    Object.values(authenticatedClaims).some((value) => value !== true) ||
    !isDeepStrictEqual(artifact.tests?.localCommandReceipts, expectedLocalCommandReceipts) ||
    !Array.isArray(trackedReceipts) ||
    artifact.boundary?.trackedFiles !== trackedReceipts.length ||
    trackedReceipts.some(
      (candidate) =>
        candidate === null ||
        typeof candidate !== "object" ||
        typeof candidate.path !== "string" ||
        !Number.isSafeInteger(candidate.bytes) ||
        candidate.bytes < 0 ||
        typeof candidate.sha256 !== "string" ||
        !/^[0-9a-f]{64}$/u.test(candidate.sha256),
    ) ||
    new Set(trackedReceipts.map((candidate) => candidate.path)).size !== trackedReceipts.length
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The M09-T07 named-slot identity or claims drifted.");
  }

  const receiptsByPath = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  const modeSuccessorPaths = new Set([ADAPTER_SOURCE_PATH, ADAPTER_TEST_PATH]);
  const exactLiveSourceAndTestReceipts = NAMED_SLOT_LIVE_SOURCE_AND_TEST_PATHS.map(
    (relativePath) => {
      const receipt = receiptsByPath.get(relativePath);
      const liveBytes = files.get(relativePath);
      if (
        receipt === undefined ||
        liveBytes === undefined ||
        (!modeSuccessorPaths.has(relativePath) &&
          (receipt.bytes !== liveBytes.byteLength || receipt.sha256 !== sha256(liveBytes)))
      ) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          `The live M09-T07 source/test receipt drifted: ${relativePath}.`,
        );
      }
      return Object.freeze({ ...receipt });
    },
  );
  return deepFreeze({
    ...pin,
    authenticatedClaims,
    exactLiveSourceAndTestReceipts,
    localCommandReceipts: expectedLocalCommandReceipts,
  });
}

function authenticateFixturesScenariosSuccessor(files) {
  const artifactBytes = files.get(FIXTURES_SCENARIOS_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== FIXTURES_SCENARIOS_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FIXTURES_SCENARIOS_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const parent = artifact.prerequisites?.[0];
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.task !== FIXTURES_SCENARIOS_ARTIFACT_PIN.task ||
    artifact.proofId !== FIXTURES_SCENARIOS_ARTIFACT_PIN.proofId ||
    artifact.profile !== FIXTURES_SCENARIOS_ARTIFACT_PIN.profile ||
    artifact.result !== FIXTURES_SCENARIOS_ARTIFACT_PIN.result ||
    parent?.task !== "M09-T10" ||
    parent?.bytes !== 17_900 ||
    parent?.sha256 !== "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate?.path, candidate]));
  for (const relativePath of T11_LIVE_RECEIPT_PATHS) {
    const authority = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T11 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: FIXTURES_SCENARIOS_ARTIFACT_PIN.task,
    artifact: FIXTURES_SCENARIOS_ARTIFACT_PIN,
    exactDesignRunParent: true,
    scenariosEphemeral: true,
    pendingRuntimeLifecycleExercised: true,
    exactOperationAndPreviewContextAuthorization: true,
    operationInputOrPasswordRetained: false,
    stableAppOwnedOperationPort: true,
    focusedTestCases: 86,
    s001Status: "TESTED",
    pf028Status: "CLOSED",
  });
}

function inspectSchemaInspectorSuccessor(files) {
  const authoring = decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH);
  const inspector = decodeUtf8(files.get(INSPECTOR_SOURCE_PATH), INSPECTOR_SOURCE_PATH);
  const preview = decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH);
  const panel = decodeUtf8(files.get(PANEL_SOURCE_PATH), PANEL_SOURCE_PATH);
  const structuredJson = decodeUtf8(
    files.get(STRUCTURED_JSON_SOURCE_PATH),
    STRUCTURED_JSON_SOURCE_PATH,
  );
  const slots = decodeUtf8(files.get(AUTHORING_SLOT_SOURCE_PATH), AUTHORING_SLOT_SOURCE_PATH);
  const adapter = decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH);
  const application = decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH);
  const applicationCss = decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH);
  const inspectorTests = decodeUtf8(files.get(INSPECTOR_TEST_PATH), INSPECTOR_TEST_PATH);
  const previewTests = decodeUtf8(files.get(PREVIEW_TEST_PATH), PREVIEW_TEST_PATH);
  const panelTests = decodeUtf8(files.get(PANEL_TEST_PATH), PANEL_TEST_PATH);
  const structuredJsonTests = decodeUtf8(
    files.get(STRUCTURED_JSON_TEST_PATH),
    STRUCTURED_JSON_TEST_PATH,
  );
  const slotTests = decodeUtf8(files.get(AUTHORING_SLOT_TEST_PATH), AUTHORING_SLOT_TEST_PATH);
  const applicationTests = decodeUtf8(files.get(APPLICATION_TEST_PATH), APPLICATION_TEST_PATH);

  for (const [source, relativePath, markers] of [
    [
      authoring,
      AUTHORING_DATA_PATH,
      ["deriveComponentInspectorControls", "ComponentInspectorControlPlan"],
    ],
    [
      inspector,
      INSPECTOR_SOURCE_PATH,
      [
        "createDesenEditorContinuousValidator",
        "deleteDesenEditorOwnerProp",
        "setDesenEditorOwnerProp",
        "captureInspectorEdit",
        'if (field.value.kind === "dynamic") {',
        'control.kind === "structured-json"',
        'reason: "control-unavailable"',
      ],
    ],
    [preview, PREVIEW_SOURCE_PATH, ["createDesenEditorDocument", "publishDesenSource"]],
    [panel, PANEL_SOURCE_PATH, ['aria-label="Inspector"', "AuthoringInspectorEdit"]],
    [
      structuredJson,
      STRUCTURED_JSON_SOURCE_PATH,
      ["PUBLISH_SOURCE_JSON_LIMITS", "canonicalizeJson", "parseStructuredJsonText"],
    ],
    [
      slots,
      AUTHORING_SLOT_SOURCE_PATH,
      [
        "insertDesenEditorNode",
        "moveDesenEditorNode",
        "reorderDesenEditorNode",
        "evaluateAuthoringSlotInsertion",
        "evaluateAuthoringSlotPlacement",
        "deleteDesenEditorNode",
        "export function evaluateAuthoringNodeDeletion(",
        "export function applyAuthoringNodeDelete(",
        "const capturedSelection = captureComponentSelection(selection);",
        "placement.slot.children.length - 1 < placement.slot.contract.minimum",
        "validateCandidate(prepared.model, changed.document)",
        'operation: "delete"',
        "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
        "const PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<",
      ],
    ],
    [
      application,
      APPLICATION_SOURCE_PATH,
      [
        "evaluateAuthoringNodeDeletion",
        "applyAuthoringNodeDelete",
        "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
        "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
        "onProjectDrop={projectDrop}",
        "function projectNearestDrop(",
        "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
        "data-drop-hovered={dropReady && dropHovered}",
        "const panelDragEnterDepth = useRef(0)",
        "data-drop-hovered={componentDropReady && targetDragHovered}",
        "data-guide={readySlot === null}",
        "className={styles.componentDragHandle}",
        'title="Drag anywhere in this panel to add"',
        'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
        "sourceNodeId: result.nodeId",
        "No drop target selected",
        "Choose slot in Layers",
        'draggedComponent === undefined ? "Insert target" : "Release to add"',
        "function deleteSelectedLayer(): AuthoringSlotEditResult",
        "setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
        "setSelection(null);",
        "layersTab.current?.focus();",
        "disabled={deletionCompatibility?.accepted !== true}",
      ],
    ],
    [
      applicationCss,
      APPLICATION_CSS_PATH,
      [
        ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.5rem;\n  align-items: center;\n  padding: 0 0.125rem;",
        '.slotBoundary[data-drop-ready="true"]',
        '.slotBoundary[data-drop-hovered="true"]',
        '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
        ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
        '.componentSlotTarget[data-guide="true"]',
        '.componentSlotTarget[data-drop-hovered="true"]',
        ".componentDragHandle {",
      ],
    ],
  ]) {
    for (const marker of markers) {
      if (!source.includes(marker)) {
        fail("SUCCESSOR_POLICY_VIOLATION", `${relativePath} lost the T07 marker ${marker}.`);
      }
    }
  }
  if (
    adapter.includes("InspectorPanel") ||
    !adapter.includes("bundle = officialDerivedSignInBundle") ||
    !adapter.includes("state.previewRevision !== previewRevision") ||
    !application.includes("prepareAuthoringInspectorModel") ||
    !application.includes("applyAuthoringInspectorEdit") ||
    !application.includes("prepareAuthoringPreviewBundle") ||
    !application.includes(
      "setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
    ) ||
    application.indexOf("<InspectorPanel") <= application.indexOf("<DesenAdapterCanvas") ||
    !inspectorTests.includes("keeps dynamic props outside T05 mutation authority") ||
    !previewTests.includes(
      "publishes a valid primitive prop edit as a fresh exact Bundle revision",
    ) ||
    !panel.includes("StructuredJsonField") ||
    !panel.includes("parseStructuredJsonText") ||
    !panelTests.includes("commits structured JSON only through explicit Apply") ||
    !structuredJsonTests.includes("rejects duplicate decoded member names at every object level") ||
    !slotTests.includes("finishes a cross-owner move across 1,024 sibling nodes") ||
    !slotTests.includes("Array.from({ length: 1_025 }") ||
    !slotTests.includes(
      "removes a newly inserted nested subtree and preserves the owning slot plus prior siblings",
    ) ||
    !slotTests.includes("deletes from a behavior-owned slot and retains its own empty slot key") ||
    !slotTests.includes("disables root deletion and deletion across the owning slot minimum") ||
    !slotTests.includes(
      "deletes the final node from a 1,024-sibling slot within the bounded profile",
    ) ||
    !slotTests.includes(
      "captures deletion selections as exact own data and rejects cross-route authority",
    ) ||
    !slotTests.includes('])("rejects deletion with a %s"') ||
    !applicationTests.includes(
      "disables deletion for the surface root and a slot-minimum preflight without changing preview",
    ) ||
    !applicationTests.includes(
      "preserves the selected layer, preview, and focus when deletion is rejected",
    ) ||
    !applicationTests.includes(
      "uses only the App-owned drag intent and ignores forged native transfer authority",
    ) ||
    !applicationTests.includes("expect(reads).toBe(0)") ||
    !applicationTests.includes('getAttribute("data-drop-hovered")') ||
    !applicationTests.includes(
      "const alertDragHandle = alert.querySelector(\"[draggable='true']\")",
    ) ||
    !applicationTests.includes('getByText("Release to add")') ||
    !applicationTests.includes('toContain("No drop target selected")') ||
    !applicationTests.includes('name: "Choose slot in Layers"') ||
    application.includes("dataTransfer.getData") ||
    !application.includes("const COMPONENT_PALETTE_RENDER_LIMIT = 24") ||
    !application.includes("if (!active) return null") ||
    !application.includes('active={activeTab === "components"}')
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The live M09-T07 inspector or named-slot boundary drifted.",
    );
  }
  return deepFreeze({
    task: "M09-T07",
    schemaDerivedPrimitiveAndEnumControls: true,
    publicEditorCoreAtomicMutation: true,
    nestedObjectAndStructuredJsonEditing: true,
    dynamicValuesLocked: true,
    publisherBackedSessionPreview: true,
    sourceAndPreviewCommitAtomically: true,
    inspectorOutsideManagedCapabilitySubtree: true,
    selectionOverlayBoundaryRetained: true,
    completeNamedSlotProjectionImplemented: true,
    publicStableIdInsertMoveAndReorderImplemented: true,
    publicValidatedNodeDeleteImplemented: true,
    exactOwnDataDeletionSelectionImplemented: true,
    rootAndSourceMinimumDeletionDisabled: true,
    behaviorOwnedDeletePreservesEmptySlot: true,
    failedDeletionPreservesCurrentDocument: true,
    browserDataTransferReadsZero: true,
    expandedDropReadyBoundaries: true,
    stableNestedDragHover: true,
    explicitComponentDropTargetGuide: true,
    deletionSourceAndPreviewCommitAtomically: true,
    deletionFocusManaged: true,
    exactTargetAdmissionCachesImplemented: true,
    componentPaletteRenderLimit: 24,
    activeTabOnlyAuthoringWork: true,
  });
}

function receipts(files) {
  return [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([relativePath, bytes]) =>
      Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
}

/** Authenticates frozen M09-T04 evidence and exact additive M09-T07/T11 successors. */
export async function buildDesenAppSelectionOverlayEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
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
  const namedSlotArtifact = authenticateNamedSlotArtifact(
    files.get(NAMED_SLOT_ARTIFACT_PATH),
    files,
  );
  const successor = inspectSchemaInspectorSuccessor(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-selection-overlay",
    profile: "desen.app.selection-overlay-proof.v1",
    task: "M09-T04",
    result: "PASS",
    prerequisites: [parent],
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      stableSourceIdentitySelection: frozen.artifact.claim.stableSourceIdentitySelection,
      validatedAuthoringModelMembershipRequired:
        frozen.artifact.claim.validatedAuthoringModelMembershipRequired,
      publicDiagnosticIndexOnly: frozen.artifact.claim.publicDiagnosticIndexOnly,
      repeatedRuntimeInstancesPreserved: frozen.artifact.claim.repeatedRuntimeInstancesPreserved,
      behaviorRuntimeIdentitiesExcludedFromComponentSelection:
        frozen.artifact.claim.behaviorRuntimeIdentitiesExcludedFromComponentSelection,
      conditionalAbsenceRepresentedHonestly:
        frozen.artifact.claim.conditionalAbsenceRepresentedHonestly,
      unknownAndStaleIdentityRejected: frozen.artifact.claim.unknownAndStaleIdentityRejected,
      selectionChromeOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.selectionChromeOutsideManagedCapabilitySubtree,
      privateDomAndReactAuthoringRejected:
        frozen.artifact.claim.privateDomAndReactAuthoringRejected,
      componentGeometryClaimed: frozen.artifact.claim.componentGeometryClaimed,
      managedAdapterPathRetained: frozen.artifact.claim.managedAdapterPathRetained,
      routeResetSynchronous: frozen.artifact.claim.routeResetSynchronous,
      n042Status: frozen.artifact.claim.n042Status,
      p06Status: frozen.artifact.claim.p06Status,
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
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        AUTHORING_DATA_PATH,
        INSPECTOR_SOURCE_PATH,
        PREVIEW_SOURCE_PATH,
        PANEL_SOURCE_PATH,
        STRUCTURED_JSON_SOURCE_PATH,
        AUTHORING_SLOT_SOURCE_PATH,
        GLOBAL_CSS_PATH,
        AUTHORING_DATA_TEST_PATH,
        INSPECTOR_TEST_PATH,
        PREVIEW_TEST_PATH,
        PANEL_TEST_PATH,
        STRUCTURED_JSON_TEST_PATH,
        AUTHORING_SLOT_TEST_PATH,
        NAMED_SLOT_ARTIFACT_PATH,
        FIXTURES_SCENARIOS_ARTIFACT_PATH,
      ].map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
    successor: deepFreeze({ ...successor, artifact: namedSlotArtifact }),
    fixturesScenariosSuccessor,
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
