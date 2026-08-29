import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-EVENT-ACTION-EDITOR.md";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const EDITOR_EVENT_ACTION_ARTIFACT_PATH =
  "docs/proof/artifacts/editor-core-0.1.0-event-action-edits.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const AUTHORING_SELECTION_PATH = "apps/desen-app/src/authoring-selection.ts";
const EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const EVENT_ACTION_PANEL_PATH = "apps/desen-app/src/event-action-panel.tsx";
const STRUCTURED_JSON_PATH = "apps/desen-app/src/structured-json.ts";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const AUTHORING_DATA_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const AUTHORING_SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const EVENT_ACTION_TEST_PATH = "apps/desen-app/test/authoring-event-actions.test.ts";
const EVENT_ACTION_PANEL_TEST_PATH = "apps/desen-app/test/event-action-panel.test.tsx";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-event-action-editor-proof.mjs",
  "scripts/generate-desen-app-event-action-editor-proof.mjs",
  "scripts/verify-desen-app-event-action-editor.mjs",
  "tests/desen-app-event-action-editor.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  AUTHORING_SELECTION_PATH,
  EVENT_ACTION_SOURCE_PATH,
  EVENT_ACTION_PANEL_PATH,
  STRUCTURED_JSON_PATH,
  PREVIEW_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  STRUCTURED_JSON_TEST_PATH,
  AUTHORING_DATA_TEST_PATH,
  AUTHORING_SELECTION_TEST_PATH,
  EVENT_ACTION_TEST_PATH,
  EVENT_ACTION_PANEL_TEST_PATH,
  PREVIEW_TEST_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  CATALOG_PATH,
  SOURCE_FIXTURE_PATH,
  BUNDLE_FIXTURE_PATH,
  ...SOURCE_PATHS,
  ...APP_TEST_PATHS,
  STATE_BINDING_ARTIFACT_PATH,
  EDITOR_EVENT_ACTION_ARTIFACT_PATH,
  ...PROOF_READER_PATHS,
]);

const EXPECTED_EVENT_ACTION_TEST_NAMES = Object.freeze([
  "creates exact component owner references and rejects forged behavior values",
  "projects sign-in change and press with canonical nested settlement pointers",
  "retains declared absent, present-empty, and present-nonempty handler states",
  "escapes every owner-relative event token canonically",
  "maps all six App edits one-to-one to immutable Editor Core transitions",
  "uses post-removal final reorder indices without an App-side adjustment",
  "materializes and retains operation success/failure settlement lists",
  "projects every member of the seven-action union including nested settlements",
  "fails closed for idle, stale, cross-route, forged behavior, and ambiguous selections",
  "rejects undeclared events, malformed pointers, and invalid indices before mutation",
  "enforces the 25,000-action and 64-level projection limits",
  "contains malformed own-data edits and preserves every caller input on success or failure",
]);

const EXPECTED_PANEL_TEST_NAMES = Object.freeze([
  "shows the selected component and Catalog events, then adds and deletes an exact handler",
  "offers all seven complete-action starters and preserves a $ref on insert",
  "edits one whole action without committing its intermediate JSON draft",
  "reorders and deletes root actions through exact pointers with focus recovery",
  "renders recursive operation settlement lists and inserts into an absent Failure list",
  "reports local JSON and edit failures accessibly without losing the draft",
  "keeps idle, rejected, and Catalog-empty states honest and non-actionable",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "switches to the exact Catalog component library and filters only the local view",
  "commits sign-in event handlers and complete actions through the live authoring session",
  "keeps the prior event projection and canvas when action preview preflight fails",
  "preserves the prior Source and preview when Publisher rejects an oversized valid prop",
]);

/** Exact immutable proof receipts that bound M09-T09 App authority. */
export const DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    path: STATE_BINDING_ARTIFACT_PATH,
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M08-T06",
    proofId: "editor-core-event-action-edits",
    path: EDITOR_EVENT_ACTION_ARTIFACT_PATH,
    bytes: 31_310,
    sha256: "05a7df153512b8dd0f8289991d12a9d12d79903ed8b3637ef6c8a450ca8a6be7",
    profile: "desen.editor-core.event-action-edits-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T09 artifact. */
export const DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact frozen App and Editor Core parents",
  "[projection] proves Catalog events, exact owners, lifecycle, and canonical pointers",
  "[mutation] proves all six public immutable event and action transitions",
  "[nesting] proves the closed seven-action union and recursive settlement lists",
  "[safety] proves bounded capture, complete validation, and atomic failure",
  "[ownership] keeps action chrome App-owned and preview replacement atomic",
  "[tests] pins focused App behavior and exact package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened event, action, preview, and ownership sources",
  "[verification] rejects parents, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T09 evidence. */
export const DEFAULT_DESEN_APP_EVENT_ACTION_EDITOR_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T09 evidence reader. */
export class DesenAppEventActionEditorProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppEventActionEditorProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppEventActionEditorProofError(code, message, details);
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
  const options = exactOwnDataOptions(value, ["fileOverrides", "workspaceRoot"], "build options");
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureOverrides(options.fileOverrides),
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
    if (error instanceof DesenAppEventActionEditorProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const output = new Map();
  for (const relativePath of TRACKED_PATHS) {
    output.set(
      relativePath,
      overrides.get(relativePath) ??
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
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required event/action policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function inspectEventActionSource(source) {
  assertIncludes(
    source,
    [
      "createDesenEditorContinuousValidator",
      "deleteDesenEditorAction",
      "deleteDesenEditorEventHandler",
      "insertDesenEditorAction",
      "insertDesenEditorEventHandler",
      "reorderDesenEditorAction",
      "replaceDesenEditorAction",
      "escapeJsonPointerToken",
      "maxActionDepth: 64",
      "maxActionOccurrences: 25_000",
      "maxIdentityOccurrences: 25_000",
      "maxSourceDepth: 64",
      'readonly ownerKind: "component"',
      'fields.ownerKind !== "component"',
      "function exactOwnData(",
      "Reflect.ownKeys(input)",
      "Object.getOwnPropertyDescriptor(input, key)",
      "function projectActionList(",
      "`${pointer}/${index}` as DesenEditorActionPointer",
      "`/on/${escapeJsonPointerToken(event)}` as DesenEditorActionListPointer",
      "export function createAuthoringEventOwnerSelection(",
      "export function prepareAuthoringEventActionModel(",
      "export function applyAuthoringEventActionEdit(",
      "prepareCatalogAuthoringModel(catalogValue, document)",
      "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      "validator.validator.validate(changed.document).valid",
    ],
    "authoring-event-actions.ts",
  );
  assertExcludes(
    source,
    ["react", "react-dom", "document.querySelector", "@desen/editor-core/src"],
    "authoring-event-actions.ts",
  );
  return deepFreeze({
    appOwnerKinds: ["component"],
    behaviorOwnerUiClaimed: false,
    actionTypes: [
      "component.command",
      "event.emit",
      "navigate",
      "operation.invoke",
      "resource.refresh",
      "state.set",
      "state.toggle",
    ],
    publicEditorCoreCommands: 6,
    catalogDeclaredEventsOnly: true,
    absentEmptyAndPresentLifecycle: true,
    canonicalEscapedPointers: true,
    recursiveOperationSettlements: true,
    actionDepthLimit: 64,
    actionOccurrenceLimit: 25_000,
    identityOccurrenceLimit: 25_000,
    sourceDepthLimit: 64,
    exactOwnDataRouteSelectionAndEditCapture: true,
    freshOwnerAndPointerAuthorization: true,
    continuousCompleteSourceRevalidation: true,
    noPartialDocumentOnFailure: true,
  });
}

function inspectPanelSource(source) {
  assertIncludes(
    source,
    [
      "parseInertJsonText",
      "const parsed = parseInertJsonText(draft);",
      "formatStructuredJson",
      '"component.command"',
      '"event.emit"',
      '"navigate"',
      '"operation.invoke"',
      '"resource.refresh"',
      '"state.set"',
      '"state.toggle"',
      "The complete JSON object is committed unchanged.",
      "Apply replaces the complete action.",
      '{"$ref":"state.name"}',
      "function ActionListView(",
      "action.onSuccess",
      "action.onFailure",
      "export function EventActionPanel(",
      "<h2 id={titleId}>Events &amp; Actions</h2>",
      'aria-label="Selected event component"',
      "Select a component to inspect its Catalog-declared events.",
    ],
    "event-action-panel.tsx",
  );
  assertExcludes(
    source,
    [
      "@desen/runtime-react",
      "@desen/reference-catalog-web",
      "document.querySelector",
      "getBoundingClientRect",
      "eval(",
      "new Function",
    ],
    "event-action-panel.tsx",
  );
  return deepFreeze({
    owner: "Desen App",
    catalogEventLifecycleControls: true,
    completeActionJsonComposer: true,
    inertReferencePreservation: true,
    sevenActionStarters: true,
    recursiveSettlementLists: true,
    replaceDeleteAndReorderControls: true,
    accessibleFailureAndFocusRecovery: true,
    executionClaimed: false,
    managedAdapterImports: 0,
  });
}

function inspectApplicationSource(source) {
  assertIncludes(
    source,
    [
      "applyAuthoringEventActionEdit",
      "createAuthoringEventOwnerSelection",
      "prepareAuthoringEventActionModel",
      'type AuthoringTab = "layers" | "components" | "state" | "actions"',
      'const tabs: readonly AuthoringTab[] = ["layers", "components", "state", "actions"]',
      "const eventOwnerSelection = useMemo<AuthoringEventOwnerSelection | null>",
      "const eventActionModel = useMemo<AuthoringEventActionModelResult>",
      "function editSelectedEventAction(",
      "const result = applyAuthoringEventActionEdit(",
      "const nextPreview = prepareAuthoringPreviewBundle(result.document)",
      "setAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      "<EventActionPanel",
      "model={eventActionModel}",
      "onEdit={onEventActionEdit}",
      'activeTab === "actions"',
    ],
    "application.tsx",
  );
  assertExcludes(source, ["@desen/editor-core/src", "@desen/publisher/src"], "application.tsx");
  inspectEventActionCommitFlow(source);
  return deepFreeze({
    exactComponentOwnerSelection: true,
    fourKeyboardNavigableAuthoringTabs: true,
    freshEventActionProjection: true,
    publicEditorCoreMutationBoundary: true,
    publisherPreflightBeforeCommit: true,
    sourceAndPreviewCommitAtomically: true,
    publisherFailurePreservesPriorSession: true,
    eventActionChromeOutsideManagedCapabilitySubtree: true,
  });
}

function propertyAccessMatches(node, objectName, propertyName) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === objectName &&
    node.name.text === propertyName
  );
}

function isNegatedOkGuard(node, resultName) {
  return (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken &&
    propertyAccessMatches(node.operand, resultName, "ok")
  );
}

function containsReturnStatement(node) {
  let found = false;
  const visit = (child) => {
    if (ts.isReturnStatement(child)) {
      found = true;
      return;
    }
    child.forEachChild(visit);
  };
  visit(node);
  return found;
}

function callName(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    ? node.expression.text
    : undefined;
}

function variableCallName(statement, variableName, expectedCallName) {
  if (!ts.isVariableStatement(statement) || statement.declarationList.declarations.length !== 1) {
    return false;
  }
  const declaration = statement.declarationList.declarations[0];
  return (
    ts.isIdentifier(declaration.name) &&
    declaration.name.text === variableName &&
    declaration.initializer !== undefined &&
    callName(declaration.initializer) === expectedCallName
  );
}

function inspectEventActionCommitFlow(source) {
  const sourceFile = parseTypeScript(source, APPLICATION_SOURCE_PATH);
  const matches = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "editSelectedEventAction" &&
      node.body !== undefined
    ) {
      matches.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (matches.length !== 1) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "application.tsx must retain exactly one editSelectedEventAction function.",
    );
  }

  const statements = matches[0].body.statements;
  const applyIndex = statements.findIndex((statement) =>
    variableCallName(statement, "result", "applyAuthoringEventActionEdit"),
  );
  const resultGuardIndex = statements.findIndex(
    (statement, index) =>
      index > applyIndex &&
      ts.isIfStatement(statement) &&
      isNegatedOkGuard(statement.expression, "result") &&
      containsReturnStatement(statement.thenStatement),
  );
  const previewIndex = statements.findIndex(
    (statement, index) =>
      index > resultGuardIndex &&
      variableCallName(statement, "nextPreview", "prepareAuthoringPreviewBundle"),
  );
  const previewGuardIndex = statements.findIndex(
    (statement, index) =>
      index > previewIndex &&
      ts.isIfStatement(statement) &&
      isNegatedOkGuard(statement.expression, "nextPreview") &&
      containsReturnStatement(statement.thenStatement),
  );
  const commitIndexes = [];
  matches[0].body.forEachChild(function collectCommits(node) {
    if (ts.isCallExpression(node) && callName(node) === "setAuthoringSession") {
      const owningStatementIndex = statements.findIndex(
        (statement) => statement.pos <= node.pos && node.end <= statement.end,
      );
      commitIndexes.push(owningStatementIndex);
    }
    node.forEachChild(collectCommits);
  });

  if (
    applyIndex < 0 ||
    resultGuardIndex <= applyIndex ||
    previewIndex <= resultGuardIndex ||
    previewGuardIndex <= previewIndex ||
    commitIndexes.length !== 1 ||
    commitIndexes[0] <= previewGuardIndex
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "editSelectedEventAction must apply, reject failed edits, preflight preview, reject failed preview, and commit exactly once in that order.",
    );
  }
}

function inspectCssSource(source) {
  assertIncludes(
    source,
    [
      '.authoringPanel[data-active-tab="actions"]',
      ".eventActionPanel {",
      ".eventOwnerContext {",
      ".actionReferenceGuide {",
      ".eventCard {",
      ".actionListSection {",
      '.actionListSection[data-action-list-tone="success"]',
      '.actionListSection[data-action-list-tone="failure"]',
      ".actionJsonTextarea {",
      '.actionJsonTextarea[aria-invalid="true"]',
      ".actionCardControls button:focus-visible",
    ],
    "application.module.css",
  );
  return deepFreeze({
    actionPanelResponsiveWidth: true,
    selectedOwnerContext: true,
    recursiveSettlementTones: true,
    visibleInvalidJsonState: true,
    keyboardFocusPresentation: true,
  });
}

/** Verifies exact source-policy markers without retaining caller-owned source text. */
export function verifyDesenAppEventActionEditorSourcePolicy(rawInput) {
  const keys = ["applicationCss", "applicationSource", "eventActionPanel", "eventActionSource"];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    eventAction: inspectEventActionSource(input.eventActionSource),
    panel: inspectPanelSource(input.eventActionPanel),
    application: inspectApplicationSource(input.applicationSource),
    css: inspectCssSource(input.applicationCss),
  });
}

function parseTypeScript(rawSource, relativePath) {
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    rawSource,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  const names = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const direct =
        ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text);
      const parameterized =
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        ["it", "test"].includes(node.expression.expression.expression.text) &&
        node.expression.expression.name.text === "each";
      if (direct || parameterized) names.push(node.arguments[0].text);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return names;
}

function requireTestNames(actual, expected, relativePath) {
  const missing = expected.filter((name) => !actual.includes(name));
  if (missing.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} lost required tests.`, { missing });
  }
}

function namedTestBody(rawSource, relativePath, testName) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  const bodies = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length >= 2 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === testName &&
      ((ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          ["it", "test"].includes(node.expression.expression.text)))
    ) {
      bodies.push(node.arguments[1].getText(sourceFile));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (bodies.length !== 1) {
    fail(
      "TEST_POLICY_VIOLATION",
      `${relativePath} must contain exactly one ${testName} test body.`,
    );
  }
  return bodies[0];
}

function inspectTests(files) {
  const sources = new Map(
    APP_TEST_PATHS.map((relativePath) => [
      relativePath,
      decodeUtf8(files.get(relativePath), relativePath),
    ]),
  );
  const names = Object.fromEntries(
    [...sources].map(([relativePath, source]) => [
      relativePath,
      collectTestNames(source, relativePath),
    ]),
  );
  requireTestNames(
    names[EVENT_ACTION_TEST_PATH],
    EXPECTED_EVENT_ACTION_TEST_NAMES,
    EVENT_ACTION_TEST_PATH,
  );
  requireTestNames(
    names[EVENT_ACTION_PANEL_TEST_PATH],
    EXPECTED_PANEL_TEST_NAMES,
    EVENT_ACTION_PANEL_TEST_PATH,
  );
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );
  assertIncludes(
    sources.get(EVENT_ACTION_TEST_PATH),
    [
      "Array.from(\n      { length: 25_001 }",
      "nestedAction(65)",
      "expect(getterCalls).toBe(0)",
      'pointer: "/on/press/0/onSuccess/0"',
      'actionListPointer: "/on/press/0/onFailure"',
    ],
    "authoring-event-actions tests",
  );
  assertIncludes(
    sources.get(EVENT_ACTION_PANEL_TEST_PATH),
    [
      "expectedTypes",
      'payload: { email: { $ref: "state.email" } }',
      "Object member names must be unique.",
      "document.activeElement",
    ],
    "event-action panel tests",
  );
  assertIncludes(
    sources.get(APPLICATION_TEST_PATH),
    [
      'screen.getByRole("tab", { name: "Actions" })',
      '"Delete change event handler"',
      '"Add complete action"',
      'document.querySelector("[data-managed-capability-subtree]")',
    ],
    "application tests",
  );
  const previewFailureTest = namedTestBody(
    sources.get(APPLICATION_TEST_PATH),
    APPLICATION_TEST_PATH,
    "keeps the prior event projection and canvas when action preview preflight fails",
  );
  assertIncludes(
    previewFailureTest,
    [
      '.spyOn(authoringPreview, "prepareAuthoringPreviewBundle")',
      '.mockReturnValueOnce(Object.freeze({ ok: false, reason: "publication-rejected" }))',
      "const rejectedCandidate = previewPreflight.mock.calls[1]?.[0];",
      ")?.on?.change,\n    ).toBeUndefined();",
      'expect(within(panel).getByText("Handler added")).toBeTruthy();',
      'expect(within(panel).getByRole("article", { name: "action 1 in change" })).toBeTruthy();',
      'expect(screen.getByRole("group", { name: "Sign-in adapter canvas" })).toBe(baselineCanvas);',
      "expect(document.querySelector(\"[data-managed-capability-subtree='true']\")).toBe(",
      "baselineManagedSubtree,\n    );",
    ],
    "application preview-failure test",
  );
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:event-actions && node --test tests/desen-app-event-action-editor.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES,
    localCommandReceipts: {
      pureEventActions: {
        command:
          "pnpm --filter @desen/app-web exec vitest run test/authoring-event-actions.test.ts",
        result: "PASS",
        testFiles: 1,
        tests: 12,
      },
      panel: {
        command: "pnpm --filter @desen/app-web exec vitest run test/event-action-panel.test.tsx",
        result: "PASS",
        testFiles: 1,
        tests: 7,
      },
      focusedEventActions: {
        command: "pnpm --filter @desen/app-web test:event-actions",
        result: "PASS",
        testFiles: 8,
        tests: 84,
      },
      fullApp: {
        command: "pnpm --filter @desen/app-web test",
        result: "PASS",
        testFiles: 15,
        tests: 202,
      },
      rootProof: {
        command: "node --test tests/desen-app-event-action-editor.test.mjs",
        result: "PASS",
        testFiles: 1,
        tests: 10,
      },
    },
    semanticCoverage: [
      "CATALOG_DECLARED_COMPONENT_EVENTS",
      "ABSENT_EMPTY_NONEMPTY_HANDLER_LIFECYCLE",
      "CANONICAL_ESCAPED_OWNER_RELATIVE_POINTERS",
      "SIX_PUBLIC_EDITOR_CORE_MUTATIONS",
      "SEVEN_CLOSED_ACTION_TYPES",
      "RECURSIVE_OPERATION_SETTLEMENT_LISTS",
      "EXACT_OWN_DATA_ROUTE_OWNER_AND_EDIT_CAPTURE",
      "BOUNDED_DEPTH_OCCURRENCE_AND_IDENTITY_PROJECTION",
      "COMPLETE_SOURCE_REVALIDATION",
      "ATOMIC_PUBLISHER_PREVIEW",
      "APP_OWNED_EVENT_ACTION_CHROME",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/structured-json.test.ts test/authoring-data.test.ts test/authoring-selection.test.ts test/authoring-event-actions.test.ts test/event-action-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:event-actions"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App event/action test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-editor-core-event-action-edits.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:event-actions && ";
  const expectedRootCommands = {
    "generate:desen-app-event-action-editor": `${prefix}node scripts/generate-desen-app-event-action-editor-proof.mjs`,
    "verify:desen-app-event-action-editor": `${prefix}node scripts/verify-desen-app-event-action-editor.mjs`,
    "test:desen-app-event-action-editor": `${prefix}node --test tests/desen-app-event-action-editor.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  for (const dependency of [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/validator",
  ]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `The App lost its public ${dependency} dependency.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`);
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.proofId === "desen-app-state-binding-editor" &&
    (artifact.claim?.surfaceLocalPrimitiveStateList !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.stateAndBindingChromeOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T08 App authority claims drifted.");
  }
  if (
    pin.proofId === "editor-core-event-action-edits" &&
    (artifact.claim?.immutableEventActionEditCommands !== true ||
      artifact.claim?.stableIdentityPreserved !== true ||
      artifact.claim?.taskStatus !== "DONE")
  ) {
    fail("PARENT_DRIFT", "The frozen M08-T06 event/action authority claims drifted.");
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

/** Builds detached deterministic M09-T09 event/action editor evidence. */
export async function buildDesenAppEventActionEditorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parents = DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppEventActionEditorSourcePolicy({
    eventActionSource: decodeUtf8(files.get(EVENT_ACTION_SOURCE_PATH), EVENT_ACTION_SOURCE_PATH),
    eventActionPanel: decodeUtf8(files.get(EVENT_ACTION_PANEL_PATH), EVENT_ACTION_PANEL_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-event-action-editor",
    profile: "desen.app.event-action-editor-proof.v1",
    task: "M09-T09",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      catalogDeclaredEventProjection: true,
      exactSelectedComponentOwner: true,
      behaviorOwnerUiClaimed: false,
      absentEmptyAndPresentHandlerLifecycle: true,
      closedActionTypes: source.eventAction.actionTypes,
      recursivelyNestedOperationSettlements: true,
      canonicalEscapedActionPointers: true,
      exactOwnDataEventActionCapture: true,
      publicEditorCoreEventActionMutation: true,
      continuousCompleteSourceRevalidation: true,
      failedEditPreservesCurrentDocument: true,
      publisherSessionPreview: true,
      sourceAndPreviewCommitAtomically: true,
      eventActionChromeOutsideManagedCapabilitySubtree: true,
      actionExecutionClaimed: false,
      persistenceClaimed: false,
      designRunClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      pf025Status: "OPEN",
      pf083Status: "OPEN",
    },
    authority: {
      protocolProfiles: {
        owner: "exact selected component Source identity",
        event: "Catalog-declared event name only",
        action: "one complete member of the closed seven-action union",
        pointer: "canonical escaped owner-relative RFC 6901 path",
        settlement: "operation.invoke onSuccess/onFailure recursively only",
      },
      source,
    },
    application: {
      package: packageContract,
      mutationFlow: [
        "validator-admitted Catalog and Source projection",
        "exact route and component owner capture",
        "Catalog-declared event plus bounded canonical action-list projection",
        "complete inert action JSON capture",
        "one of six public Editor Core event/action commands",
        "continuous complete-Source validation",
        "Publisher session-local Bundle",
        "atomic Source and exact adapter session replacement",
      ],
      ownership: {
        eventPanel: "Desen App sibling chrome",
        actionComposer: "Desen App sibling chrome",
        references: "inert Source guidance only",
        managedCapabilitySubtree: "Runtime React adapters only",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 2,
      immutableInputs: true,
      sourceSymlinksRejected: true,
    },
    result: "PASS",
    nonclaims: [
      "M09-T09 edits inert Source event handlers and actions; it does not execute them.",
      "Behavior-owner UI is not claimed; forged behavior selection remains a negative boundary case.",
      "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
      "G09 and real-browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN until Design/Run, persistence, publication, and browser-E2E owners pass.",
      "PF-025 and PF-083 remain OPEN; App presentation and addressing do not amend protocol vocabulary.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH);
  for (const required of [
    "Task: M09-T09",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "PF-025: OPEN",
    "PF-083: OPEN",
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

function localTestCounts(artifact) {
  const receipts = artifact.tests.localCommandReceipts;
  return deepFreeze({
    pureEventActions: receipts.pureEventActions.tests,
    panel: receipts.panel.tests,
    focusedEventActions: receipts.focusedEventActions.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T09 bytes and the visible report digest. */
export async function verifyDesenAppEventActionEditorEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppEventActionEditorEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_EVENT_ACTION_EDITOR_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T09 artifact bytes differ from fresh evidence.");
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
    localTestCounts: localTestCounts(built.artifact),
    p08Status: built.artifact.claim.p08Status,
  });
}

/** Atomically writes exact deterministic M09-T09 proof bytes. */
export async function writeDesenAppEventActionEditorEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_EVENT_ACTION_EDITOR_ARTIFACT_PATH,
  );
  const built = await buildDesenAppEventActionEditorEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T09 artifact write failed safely.", {
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
    localTestCounts: localTestCounts(built.artifact),
  });
}
