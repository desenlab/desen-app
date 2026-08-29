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
const DESIGN_RUN_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
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

const T12_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/src/persistence-controls.tsx",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/state-panel.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-persistence.test.ts",
  "apps/desen-app/test/inspector-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
  "apps/desen-app/test/persistence-controls.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
  "apps/desen-app/test/state-panel.test.tsx",
]);
const T13_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/authoring-diagnostics.ts",
  "apps/desen-app/src/diagnostics-panel.tsx",
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/src/authoring-inspector.ts",
  "apps/desen-app/src/authoring-state.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-slots.ts",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/diagnostics-panel.test.tsx",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
]);

const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T12_SUCCESSOR_RECEIPT_PATHS,
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  "apps/desen-app/src/inspector-panel.tsx",
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-event-action-editor-proof.mjs",
  "tests/desen-app-event-action-editor.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    ...SUCCESSOR_COMPATIBILITY_PATHS,
    DESIGN_RUN_ARTIFACT_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
  ]),
]);

const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);

const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-event-action-editor-proof.mjs",
  "tests/desen-app-event-action-editor.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 23_812,
  sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
});

const DESIGN_RUN_ARTIFACT_PIN = Object.freeze({
  task: "M09-T10",
  proofId: "desen-app-design-run-modes",
  profile: "desen.app.design-run-modes-proof.v1",
  result: "PASS",
  path: DESIGN_RUN_ARTIFACT_PATH,
  bytes: 17_900,
  sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
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
  "apps/desen-app/src/inspector-panel.tsx",
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
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
  "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
  "uses only the App-owned drag intent and ignores forged native transfer authority",
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
      "const validationReport = validator.validator.validate(changed.document)",
      'if (!validationReport.valid) return failure("source-invalid", validationReport)',
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
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      "<EventActionPanel",
      "model={eventActionModel}",
      "onEdit={onEventActionEdit}",
      'activeTab === "actions"',
      "const resolvedActiveSlot = activeSlot ?? defaultSlot;",
      'aria-label="Change target in Layers"',
      "type AuthoringDropAdmission =",
      "function evaluateDragIntent(",
      "interface AuthoringDragSession {",
      "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
      "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      "pending.sessionEpoch !== currentSession.epoch",
      "pending.ownerKey !== currentSession.ownerKey",
      "interaction.dragSession.current.ownerKey === sessionOwnerKey",
      'interaction.dragSession.current.admission === "accepted"',
      "interaction.dragSession.current.lastAcceptedProjection",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "function clearUnclaimedDrop(): void {",
      "className={styles.componentsView}",
      'event.dataTransfer.dropEffect = "none"',
      'if (dragIntent?.kind !== "component") return;\n        event.preventDefault();\n        onClearDrag();',
      "className={styles.componentSlotTarget}",
      "onDragOver={admitComponentDrop}",
      "onDrop={receiveComponentDrop}",
      'data-component-card="true"',
      "className={styles.componentItem}",
      "draggable={enabled}",
      "className={styles.componentAddAction}",
      "draggable={false}",
      "onClick={() => addComponent(component.id)}",
      '(event.key !== "Delete" && event.key !== "Backspace")',
      "target instanceof HTMLInputElement",
      "target instanceof HTMLTextAreaElement",
      "target instanceof HTMLSelectElement",
      "target.isContentEditable",
      'target.contentEditable === "true"',
      "className={styles.authoringSelectionActions}",
      "disabled={deletionCompatibility?.accepted !== true}",
    ],
    "application.tsx",
  );
  assertExcludes(
    source,
    [
      "@desen/editor-core/src",
      "@desen/publisher/src",
      "function acceptsDragIntent(",
      "panelDragEnterDepth",
      "componentDragHandle",
      'title="Drag anywhere in this panel to add"',
    ],
    "application.tsx",
  );
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
    retainedRootSafeDefaultPlacementTarget: true,
    retainedExplicitChangeTarget: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    guardedLastAcceptedProjection: true,
    layerMidpointHysteresis: 4,
    explicitStickyComponentDropTarget: true,
    componentPaletteOuterDropInert: true,
    draggableComponentCard: true,
    separateNonDraggableComponentAddAction: true,
    retainedVisibleSelectedLayerDeleteControl: true,
    retainedGuardedDeleteAndBackspace: true,
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
    if (ts.isCallExpression(node) && callName(node) === "commitAuthoringSession") {
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
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 2rem;",
      ".layerDragGuide {",
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
      ".componentItem {",
      ".componentAddAction {",
      ".authoringSelectionActions {",
      ".deleteLayerAction {",
    ],
    "application.module.css",
  );
  return deepFreeze({
    actionPanelResponsiveWidth: true,
    selectedOwnerContext: true,
    recursiveSettlementTones: true,
    visibleInvalidJsonState: true,
    keyboardFocusPresentation: true,
    stableThirtyTwoPixelLayerGapPresentation: true,
    stableGlobalDragGuidePresentation: true,
    stickyExplicitComponentTargetPresentation: true,
    draggableComponentCardAndSeparateAddPresentation: true,
    retainedVisibleDeletePresentation: true,
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

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T09 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T09 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T09 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-event-action-editor" ||
    artifact?.profile !== "desen.app.event-action-editor-proof.v1" ||
    artifact?.task !== "M09-T09" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.catalogDeclaredEventProjection !== true ||
    artifact?.claim?.exactSelectedComponentOwner !== true ||
    artifact?.claim?.behaviorOwnerUiClaimed !== false ||
    artifact?.claim?.absentEmptyAndPresentHandlerLifecycle !== true ||
    artifact?.claim?.recursivelyNestedOperationSettlements !== true ||
    artifact?.claim?.canonicalEscapedActionPointers !== true ||
    artifact?.claim?.publicEditorCoreEventActionMutation !== true ||
    artifact?.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.eventActionChromeOutsideManagedCapabilitySubtree !== true ||
    artifact?.claim?.actionExecutionClaimed !== false ||
    artifact?.claim?.designRunClaimed !== false ||
    artifact?.claim?.persistenceClaimed !== false ||
    artifact?.claim?.activationClaimed !== false ||
    artifact?.claim?.browserE2eClaimed !== false ||
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
    !isDeepStrictEqual(
      artifact?.tests?.rootTestNames,
      DESEN_APP_EVENT_ACTION_EDITOR_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T09 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T09 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateDesignRunSuccessor(files) {
  const artifactBytes = files.get(DESIGN_RUN_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== DESIGN_RUN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== DESIGN_RUN_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T10 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, DESIGN_RUN_ARTIFACT_PATH);
  const localReceipts = artifact.tests?.localCommandReceipts;
  const applicationTestNames = artifact.tests?.appTestNames?.[APPLICATION_TEST_PATH];
  const retainedUxTestNames = [
    "deletes a newly inserted selected layer with %s outside editable controls",
    "ignores deletion shortcuts from editable controls while retaining the selected layer",
    "drops from a visible row with the last admitted projection when drop coordinates are absent",
    "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
  ];
  if (
    artifact.task !== DESIGN_RUN_ARTIFACT_PIN.task ||
    artifact.proofId !== DESIGN_RUN_ARTIFACT_PIN.proofId ||
    artifact.profile !== DESIGN_RUN_ARTIFACT_PIN.profile ||
    artifact.result !== DESIGN_RUN_ARTIFACT_PIN.result ||
    artifact.claim?.oneImmutableSourceAndBundleSession !== true ||
    artifact.claim?.modeExcludedFromRuntimeMountIdentity !== true ||
    artifact.claim?.zeroRuntimeRemountOrDisposeOnToggle !== true ||
    artifact.claim?.sameManagedCapabilitySubtreeOnToggle !== true ||
    artifact.claim?.designControlsDisabled !== true ||
    artifact.claim?.designSelectionAndAuthoringOnly !== true ||
    artifact.claim?.runAdapterEventToRuntimeStateSet !== true ||
    artifact.claim?.runStateSetRerendersAdapter !== true ||
    artifact.claim?.sourceRevisionUnchangedOnToggle !== true ||
    artifact.claim?.bundleRevisionUnchangedOnToggle !== true ||
    artifact.claim?.centralAuthoringGuardsInRun !== true ||
    artifact.claim?.allExternalHostPortsDeniedOrInert !== true ||
    artifact.claim?.fixturesAndScenariosClaimed !== false ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.diagnosticsClaimed !== false ||
    artifact.claim?.publicationClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.p09Status !== "PARTIAL" ||
    artifact.claim?.pf025Status !== "OPEN" ||
    artifact.claim?.pf028Status !== "OPEN" ||
    artifact.claim?.pf083Status !== "OPEN" ||
    localReceipts?.adapter?.tests !== 9 ||
    localReceipts?.application?.tests !== 35 ||
    localReceipts?.focusedDesignRun?.tests !== 44 ||
    localReceipts?.fullApp?.tests !== 210 ||
    localReceipts?.rootProof?.tests !== 10 ||
    !Array.isArray(applicationTestNames) ||
    retainedUxTestNames.some((name) => !applicationTestNames.includes(name))
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T10 artifact identity or claims drifted.");
  }
  return deepFreeze({
    task: DESIGN_RUN_ARTIFACT_PIN.task,
    artifact: DESIGN_RUN_ARTIFACT_PIN,
    oneImmutableSourceAndBundleSession: true,
    zeroRuntimeRemountOrDisposeOnToggle: true,
    sameManagedCapabilitySubtreeOnToggle: true,
    exactAdapterStateSetExecution: true,
    centralRunAuthoringGuards: true,
    externalHostPortsDeniedOrInert: true,
    retainedAuthoringUxTests: retainedUxTestNames,
    focusedDesignRunTests: 44,
    fullAppTests: 210,
    fixturesAndScenariosImplemented: false,
    persistenceImplemented: false,
    diagnosticsImplemented: false,
    publicationImplemented: false,
    activationImplemented: false,
    browserE2eImplemented: false,
  });
}

function authenticateNodeLinkedDiagnosticsSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T13",
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    result: "PASS",
    path: NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    bytes: 27_353,
    sha256: "b18cfc2a5999202e0e9641a8efdcdb6972253911372a09bfb73d5b06e1efd12c",
  });
  const artifactBytes = files.get(NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M09-T13 node-linked diagnostics artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  const semanticClaims = {
    taskStatus: artifact.claim?.taskStatus,
    immutableRejectedCandidateReport: artifact.claim?.immutableRejectedCandidateReport,
    explicitContextIdentityMappingOnly: artifact.claim?.explicitContextIdentityMappingOnly,
    diagnosticCodeMessagePointerIdentityInference:
      artifact.claim?.diagnosticCodeMessagePointerIdentityInference,
    duplicateOccurrenceOrderPreserved: artifact.claim?.duplicateOccurrenceOrderPreserved,
    unmappedDiagnosticsVisible: artifact.claim?.unmappedDiagnosticsVisible,
    unmappedDiagnosticsSelectable: artifact.claim?.unmappedDiagnosticsSelectable,
    reportSnapshotDocumentFingerprintFenced:
      artifact.claim?.reportSnapshotDocumentFingerprintFenced,
    reportSnapshotCatalogFingerprintFenced: artifact.claim?.reportSnapshotCatalogFingerprintFenced,
    routeAndSurfaceFenced: artifact.claim?.routeAndSurfaceFenced,
    runtimeKindMismatchFailsClosed: artifact.claim?.runtimeKindMismatchFailsClosed,
    committedOwnerFingerprintFenced: artifact.claim?.committedOwnerFingerprintFenced,
    snapshotBoundSelectionReadmitted: artifact.claim?.snapshotBoundSelectionReadmitted,
    invalidPlaceholderAppOwned: artifact.claim?.invalidPlaceholderAppOwned,
    invalidPlaceholderInsideManagedRuntimeSubtree:
      artifact.claim?.invalidPlaceholderInsideManagedRuntimeSubtree,
    runModeDiagnosticsVisible: artifact.claim?.runModeDiagnosticsVisible,
    automaticFocusSteal: artifact.claim?.automaticFocusSteal,
    explicitSelectionFocusOnly: artifact.claim?.explicitSelectionFocusOnly,
    obligationsVisibleMetadataOnly: artifact.claim?.obligationsVisibleMetadataOnly,
    obligationsExecutable: artifact.claim?.obligationsExecutable,
    rejectedDiagnosticsPersisted: artifact.claim?.rejectedDiagnosticsPersisted,
    rejectedDiagnosticsAffectDirtyState: artifact.claim?.rejectedDiagnosticsAffectDirtyState,
    rejectedDiagnosticsIncludedInSave: artifact.claim?.rejectedDiagnosticsIncludedInSave,
    lastKnownGoodPreviewPreserved: artifact.claim?.lastKnownGoodPreviewPreserved,
    publicationClaimed: artifact.claim?.publicationClaimed,
    activationClaimed: artifact.claim?.activationClaimed,
    p08Status: artifact.claim?.p08Status,
    p16Status: artifact.claim?.p16Status,
    pf086Status: artifact.claim?.pf086Status,
    pf089Status: artifact.claim?.pf089Status,
  };
  const expectedClaims = {
    taskStatus: "DONE",
    immutableRejectedCandidateReport: true,
    explicitContextIdentityMappingOnly: true,
    diagnosticCodeMessagePointerIdentityInference: false,
    duplicateOccurrenceOrderPreserved: true,
    unmappedDiagnosticsVisible: true,
    unmappedDiagnosticsSelectable: false,
    reportSnapshotDocumentFingerprintFenced: true,
    reportSnapshotCatalogFingerprintFenced: true,
    routeAndSurfaceFenced: true,
    runtimeKindMismatchFailsClosed: true,
    committedOwnerFingerprintFenced: true,
    snapshotBoundSelectionReadmitted: true,
    invalidPlaceholderAppOwned: true,
    invalidPlaceholderInsideManagedRuntimeSubtree: false,
    runModeDiagnosticsVisible: false,
    automaticFocusSteal: false,
    explicitSelectionFocusOnly: true,
    obligationsVisibleMetadataOnly: true,
    obligationsExecutable: false,
    rejectedDiagnosticsPersisted: false,
    rejectedDiagnosticsAffectDirtyState: false,
    rejectedDiagnosticsIncludedInSave: false,
    lastKnownGoodPreviewPreserved: true,
    publicationClaimed: false,
    activationClaimed: false,
    p08Status: "NOT_PROVEN",
    p16Status: "PROVEN",
    pf086Status: "OPEN",
    pf089Status: "OPEN",
  };
  const diagnosticsCommand =
    "vitest run test/authoring-diagnostics.test.ts test/diagnostics-panel.test.tsx test/authoring-inspector.test.ts test/authoring-state.test.ts test/authoring-event-actions.test.ts test/authoring-slots.test.ts test/adapter-canvas.test.tsx test/application.test.tsx test/persistence-application.test.tsx";
  const appPackage = parseJson(
    files.get("apps/desen-app/package.json"),
    "apps/desen-app/package.json",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    !isDeepStrictEqual(semanticClaims, expectedClaims) ||
    artifact.tests?.focusedTestCases !== 161 ||
    artifact.tests?.fullAppTestFiles !== 24 ||
    artifact.tests?.fullAppTestCases !== 339 ||
    artifact.tests?.rootTestNames?.length !== 12 ||
    artifact.boundary?.trackedFiles !== 39 ||
    artifact.boundary?.parentArtifacts !== 11 ||
    artifact.boundary?.focusedAppTestCases !== 161 ||
    artifact.boundary?.fullAppTestFiles !== 24 ||
    artifact.boundary?.fullAppTestCases !== 339 ||
    trackedReceipts?.length !== 39 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    appPackage.scripts?.["test:diagnostics"] !== diagnosticsCommand
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T13 node-linked diagnostics identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T13_SUCCESSOR_RECEIPT_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T13 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    focusedTestFiles: 9,
    focusedTestCases: 161,
    fullAppTestFiles: 24,
    fullAppTestCases: 339,
    parentArtifacts: 11,
    trackedFiles: 39,
    ...expectedClaims,
    diagnosticsCommand,
  });
}

function authenticateSourcePersistenceSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    path: SOURCE_PERSISTENCE_ARTIFACT_PATH,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
  });
  const artifactBytes = files.get(SOURCE_PERSISTENCE_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  )
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T12 source-persistence artifact drifted.");
  const artifact = parseJson(artifactBytes, SOURCE_PERSISTENCE_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  const persistenceCommand =
    "vitest run test/authoring-persistence.test.ts test/persistence-controls.test.tsx test/persistence-application.test.tsx test/project-navigation.test.ts test/application.test.tsx";
  const appPackage = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const persistenceControlsSource = decodeUtf8(
    files.get("apps/desen-app/src/persistence-controls.tsx"),
    "apps/desen-app/src/persistence-controls.tsx",
  );
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.publicEditorCorePersistencePort !== true ||
    artifact.claim?.exactProjectScopedSourceKey !== "account-app-source" ||
    artifact.claim?.authoredSourceOnly !== true ||
    artifact.claim?.sourceKeyIndependentOfDocumentId !== true ||
    artifact.claim?.awaitedSettlementsCapturedAsExactOwnEnumerableData !== true ||
    artifact.claim?.settlementAccessorInvocation !== false ||
    artifact.claim?.validOptionalDiagnosticDataCopiedAndFrozen !== true ||
    artifact.claim?.casGenerationRelationshipsValidated !== true ||
    artifact.claim?.openedDocumentReauthorized !== true ||
    artifact.claim?.failedOrRejectedOpenPreservesDraft !== true ||
    artifact.claim?.malformedOpenRetryableAndDraftPreserved !== true ||
    artifact.claim?.generationExhaustionRequiresReopen !== true ||
    artifact.claim?.automaticRetryOrMerge !== false ||
    artifact.claim?.unexpectedDispatchedSaveIndeterminate !== true ||
    artifact.claim?.malformedSaveIndeterminateAndReopenRequired !== true ||
    artifact.claim?.staleOpenCannotReplaceEditedSession !== true ||
    artifact.claim?.staleLifetimeSettlementIgnored !== true ||
    artifact.claim?.postReflectionAndAdmissionAuthorityRechecked !== true ||
    artifact.claim?.reentrantSettlementCannotPublishRevokedState !== true ||
    artifact.claim?.dirtyOpenRequiresExplicitConfirmation !== true ||
    artifact.claim?.designModeOnlyControls !== true ||
    artifact.claim?.visibleGenerationDirtyAndReopenState !== true ||
    artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true ||
    artifact.claim?.identityOrVersionDirtyAuthority !== false ||
    artifact.claim?.sameCanonicalReplacementRemainsClean !== true ||
    artifact.claim?.canonicalRevertReturnsClean !== true ||
    artifact.claim?.successfulOpenOrSaveEstablishesCanonicalBaseline !== true ||
    artifact.claim?.newerEditRemainsDirtyAfterOlderSave !== true ||
    artifact.claim?.centralizedAuthoringSessionCommit !== true ||
    artifact.claim?.noPortCanonicalBaselineAndCurrentTracked !== true ||
    artifact.claim?.noPortDirtyProjectionRerenderSafe !== true ||
    artifact.claim?.cleanNoPortLabelAccurate !== true ||
    artifact.claim?.pristineNoPortNavigationAdmitted !== true ||
    artifact.claim?.editedNoPortDraftNavigationAndPageExitGuarded !== true ||
    artifact.claim?.openAdmissionAtomic !== true ||
    artifact.claim?.createUpdateUnchangedGenerationCas !== true ||
    artifact.claim?.conflictOrIndeterminateRequiresReopen !== true ||
    artifact.claim?.navigationAndPageExitGuarded !== true ||
    artifact.claim?.scenarioPreviewPersisted !== false ||
    artifact.claim?.runtimeInputOrSecretPersisted !== false ||
    artifact.claim?.concretePersistenceAdapterClaimed !== false ||
    !persistenceControlsSource.includes('return "Local draft unchanged";') ||
    artifact.tests?.focusedTestCases !== 142 ||
    artifact.tests?.fullAppTestFiles !== 22 ||
    artifact.tests?.fullAppTestCases !== 324 ||
    artifact.boundary?.trackedFiles !== 35 ||
    artifact.boundary?.parentArtifacts !== 3 ||
    artifact.boundary?.focusedAppTestCases !== 142 ||
    artifact.boundary?.fullAppTestFiles !== 22 ||
    artifact.boundary?.fullAppTestCases !== 324 ||
    trackedReceipts?.length !== 35 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    ) ||
    appPackage.scripts?.["test:persistence"] !== persistenceCommand
  )
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T12 source-persistence identity or claims drifted.",
    );
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T12_SUCCESSOR_RECEIPT_PATHS) {
    if (T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)) continue;
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    )
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T12 receipt drifted: ${relativePath}.`);
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    focusedTestCases: 142,
    fullAppTestFiles: 22,
    fullAppTestCases: 324,
    exactProjectScopedSourceKey: "account-app-source",
    publicEditorCorePersistencePort: true,
    authoredSourceOnly: true,
    sourceKeyIndependentOfDocumentId: true,
    awaitedSettlementsCapturedAsExactOwnEnumerableData: true,
    settlementAccessorInvocation: false,
    validOptionalDiagnosticDataCopiedAndFrozen: true,
    casGenerationRelationshipsValidated: true,
    openedDocumentReauthorized: true,
    failedOrRejectedOpenPreservesDraft: true,
    malformedOpenRetryableAndDraftPreserved: true,
    generationExhaustionRequiresReopen: true,
    automaticRetryOrMerge: false,
    unexpectedDispatchedSaveIndeterminate: true,
    malformedSaveIndeterminateAndReopenRequired: true,
    staleOpenCannotReplaceEditedSession: true,
    staleLifetimeSettlementIgnored: true,
    postReflectionAndAdmissionAuthorityRechecked: true,
    reentrantSettlementCannotPublishRevokedState: true,
    dirtyOpenRequiresExplicitConfirmation: true,
    designModeOnlyControls: true,
    visibleGenerationDirtyAndReopenState: true,
    completeAuthoredSourceCanonicalDirtyComparison: true,
    identityOrVersionDirtyAuthority: false,
    sameCanonicalReplacementRemainsClean: true,
    canonicalRevertReturnsClean: true,
    successfulOpenOrSaveEstablishesCanonicalBaseline: true,
    newerEditRemainsDirtyAfterOlderSave: true,
    centralizedAuthoringSessionCommit: true,
    noPortCanonicalBaselineAndCurrentTracked: true,
    noPortDirtyProjectionRerenderSafe: true,
    cleanNoPortLabelAccurate: true,
    cleanNoPortStatusText: "Local draft unchanged",
    pristineNoPortNavigationAdmitted: true,
    editedNoPortDraftNavigationAndPageExitGuarded: true,
    openAdmissionAtomic: true,
    createUpdateUnchangedGenerationCas: true,
    conflictOrIndeterminateRequiresReopen: true,
    navigationAndPageExitGuarded: true,
    scenarioPreviewPersisted: false,
    runtimeInputOrSecretPersisted: false,
    concretePersistenceAdapterClaimed: false,
    persistenceCommand,
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
    parent?.task !== DESIGN_RUN_ARTIFACT_PIN.task ||
    parent?.bytes !== DESIGN_RUN_ARTIFACT_PIN.bytes ||
    parent?.sha256 !== DESIGN_RUN_ARTIFACT_PIN.sha256 ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.cleanupSynchronouslyRevokesFixtureAdmission !== true ||
    artifact.claim?.pendingRevokedOnPreviewReplacement !== true ||
    artifact.claim?.integrationOrProductionExecutionClaimed !== false ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.diagnosticsClaimed !== false ||
    artifact.claim?.publicationClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate?.path, candidate]));
  for (const relativePath of T11_LIVE_RECEIPT_PATHS) {
    if (
      T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const authority = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      authority === undefined ||
      bytes === undefined ||
      authority.bytes !== bytes.byteLength ||
      authority.sha256 !== sha256(bytes)
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The live M09-T11 successor receipt drifted: ${relativePath}.`,
      );
    }
  }
  return deepFreeze({
    task: FIXTURES_SCENARIOS_ARTIFACT_PIN.task,
    artifact: FIXTURES_SCENARIOS_ARTIFACT_PIN,
    exactDesignRunParent: DESIGN_RUN_ARTIFACT_PIN,
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

/** Retained task-time builder used only to define the frozen M09-T09 evidence shape. */
async function _buildFreshDesenAppEventActionEditorEvidence(rawOptions = undefined) {
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

/** Authenticates frozen M09-T09 evidence and checks its live additive M09-T10 successor. */
export async function buildDesenAppEventActionEditorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_EVENT_ACTION_EDITOR_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const source = verifyDesenAppEventActionEditorSourcePolicy({
    eventActionSource: decodeUtf8(files.get(EVENT_ACTION_SOURCE_PATH), EVENT_ACTION_SOURCE_PATH),
    eventActionPanel: decodeUtf8(files.get(EVENT_ACTION_PANEL_PATH), EVENT_ACTION_PANEL_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const successor = authenticateDesignRunSuccessor(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-event-action-editor",
    profile: "desen.app.event-action-editor-proof.v1",
    task: "M09-T09",
    result: "PASS",
    prerequisites: parents,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      catalogDeclaredEventProjection: frozen.artifact.claim.catalogDeclaredEventProjection,
      exactSelectedComponentOwner: frozen.artifact.claim.exactSelectedComponentOwner,
      behaviorOwnerUiClaimed: frozen.artifact.claim.behaviorOwnerUiClaimed,
      absentEmptyAndPresentHandlerLifecycle:
        frozen.artifact.claim.absentEmptyAndPresentHandlerLifecycle,
      recursivelyNestedOperationSettlements:
        frozen.artifact.claim.recursivelyNestedOperationSettlements,
      canonicalEscapedActionPointers: frozen.artifact.claim.canonicalEscapedActionPointers,
      publicEditorCoreEventActionMutation:
        frozen.artifact.claim.publicEditorCoreEventActionMutation,
      continuousCompleteSourceRevalidation:
        frozen.artifact.claim.continuousCompleteSourceRevalidation,
      sourceAndPreviewCommitAtomically: frozen.artifact.claim.sourceAndPreviewCommitAtomically,
      eventActionChromeOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.eventActionChromeOutsideManagedCapabilitySubtree,
    },
    source,
    successor,
    fixturesScenariosSuccessor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
    retainedAuthoringUx: {
      rootSafeDefaultPlacementTarget: source.application.retainedRootSafeDefaultPlacementTarget,
      explicitChangeTarget: source.application.retainedExplicitChangeTarget,
      stableThirtyTwoPixelLayerGaps: source.css.stableThirtyTwoPixelLayerGapPresentation,
      stableGlobalLayerDragSession: source.application.stableGlobalLayerDragSession,
      globalLayerOwnerAndEpochFencing: source.application.globalLayerOwnerAndEpochFencing,
      guardedLastAcceptedProjection: source.application.guardedLastAcceptedProjection,
      explicitStickyComponentDropTarget: source.application.explicitStickyComponentDropTarget,
      componentPaletteOuterDropInert: source.application.componentPaletteOuterDropInert,
      draggableComponentCard: source.application.draggableComponentCard,
      separateNonDraggableComponentAddAction:
        source.application.separateNonDraggableComponentAddAction,
      visibleSelectedLayerDeleteControl:
        source.application.retainedVisibleSelectedLayerDeleteControl,
      guardedDeleteAndBackspace: source.application.retainedGuardedDeleteAndBackspace,
      namedSlotAndValidatorAuthorityChanged: false,
      arbitraryCanvasGeometryOrDropClaimed: false,
      nativeBrowserDragE2eClaimed: false,
    },
    package: packageContract,
    testPolicy: {
      applicationTestNames: tests.appTestNames[APPLICATION_TEST_PATH],
      rootTestNames: tests.rootTestNames,
    },
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        ROOT_PACKAGE_PATH,
        APP_PACKAGE_PATH,
        LOCKFILE_PATH,
        "apps/desen-app/src/inspector-panel.tsx",
        ADAPTER_SOURCE_PATH,
        APPLICATION_SOURCE_PATH,
        APPLICATION_CSS_PATH,
        ADAPTER_TEST_PATH,
        APPLICATION_TEST_PATH,
        DESIGN_RUN_ARTIFACT_PATH,
        FIXTURES_SCENARIOS_ARTIFACT_PATH,
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
