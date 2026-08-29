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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-STATE-BINDING-EDITOR.md";
const SCHEMA_INSPECTOR_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const EDITOR_STATE_ARTIFACT_PATH =
  "docs/proof/artifacts/editor-core-0.1.0-state-binding-edits.json";
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const EVENT_ACTION_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
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
const STATE_SOURCE_PATH = "apps/desen-app/src/authoring-state.ts";
const INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const STATE_PANEL_SOURCE_PATH = "apps/desen-app/src/state-panel.tsx";
const INSPECTOR_PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
const STATE_TEST_PATH = "apps/desen-app/test/authoring-state.test.ts";
const INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const STATE_PANEL_TEST_PATH = "apps/desen-app/test/state-panel.test.tsx";
const INSPECTOR_PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-state-binding-editor-proof.mjs",
  "scripts/generate-desen-app-state-binding-editor-proof.mjs",
  "scripts/verify-desen-app-state-binding-editor.mjs",
  "tests/desen-app-state-binding-editor.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  STATE_SOURCE_PATH,
  INSPECTOR_SOURCE_PATH,
  STRUCTURED_JSON_SOURCE_PATH,
  STATE_PANEL_SOURCE_PATH,
  INSPECTOR_PANEL_SOURCE_PATH,
  PREVIEW_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  STRUCTURED_JSON_TEST_PATH,
  STATE_TEST_PATH,
  INSPECTOR_TEST_PATH,
  STATE_PANEL_TEST_PATH,
  INSPECTOR_PANEL_TEST_PATH,
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
  SCHEMA_INSPECTOR_ARTIFACT_PATH,
  EDITOR_STATE_ARTIFACT_PATH,
  NAMED_SLOT_ARTIFACT_PATH,
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
  INSPECTOR_PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-state-binding-editor-proof.mjs",
  "tests/desen-app-state-binding-editor.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    EVENT_ACTION_ARTIFACT_PATH,
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
  "scripts/lib/desen-app-state-binding-editor-proof.mjs",
  "tests/desen-app-state-binding-editor.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 28_766,
  sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
});

const EVENT_ACTION_ARTIFACT_PIN = Object.freeze({
  task: "M09-T09",
  proofId: "desen-app-event-action-editor",
  profile: "desen.app.event-action-editor-proof.v1",
  result: "PASS",
  path: EVENT_ACTION_ARTIFACT_PATH,
  bytes: 23_812,
  sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
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
  INSPECTOR_PANEL_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const EXPECTED_STRUCTURED_JSON_TEST_NAMES = Object.freeze([
  "admits reserved-looking members as detached recursively frozen inert data",
  "keeps duplicate, malformed, non-finite, and non-scalar input fail-closed",
  "enforces every Publisher Source JSON limit at its exact boundary",
]);

const EXPECTED_STATE_TEST_NAMES = Object.freeze([
  "projects exact ordered primitive declarations and bounded official usage counts",
  "counts reads and nested writes conservatively but excludes inert state initial data",
  "authenticates exact route data and fails closed without invoking accessors",
  "inserts every primitive preset with its exact default on the selected surface",
  "stages schema and initial changes privately and validates only the complete endpoint",
  "deletes only unused declarations without cascading and retains the required state map",
  "keeps legal non-addressable and richer-schema declarations visible but outside edits",
  "rejects duplicate and stale targets with stable reasons and no partial document",
  "captures edits as exact own data and enforces conservative identifiers and preset initials",
  "accepts null-prototype exact command data without prototype-sensitive lookup",
  "maps Catalog, Source, and route rejection without exposing a candidate",
  "bounds data-only projection depth and rejects accessors without reading them",
]);

const EXPECTED_INSPECTOR_TEST_NAMES = Object.freeze([
  "projects only directly addressable primitive local state for compatible bindings",
  "changes and detaches an exact compatible local-state binding atomically",
  "rejects incompatible, forged, and runtime binding transitions without mutation",
]);

const EXPECTED_STATE_PANEL_TEST_NAMES = Object.freeze([
  "presents surface-local state in deterministic order without persistence claims",
  "submits friendly string, boolean, number, and integer initial controls with one Apply",
  "resets the initial control safely when changing primitive type before Apply",
  "rejects invalid numeric drafts locally and announces backend update failures",
  "adds only directly addressable names and reports duplicate state failures",
  "disables deletion for used state and deletes an unused state through the exact edit",
  "refreshes an unsaved primitive draft when the projected declaration changes",
  "fails closed for rejected projection and keeps the empty ready path actionable",
]);

const EXPECTED_INSPECTOR_PANEL_TEST_NAMES = Object.freeze([
  "changes or detaches a compatible direct local-state value source",
  "keeps operation bindings visible and read-only",
]);

const EXPECTED_PREVIEW_TEST_NAMES = Object.freeze([
  "publishes a valid primitive prop edit as a fresh exact Bundle revision",
  "rejects a structurally valid but Catalog-invalid prop edit without a partial Bundle",
]);

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "replaces the exact session when a current authoring draft Bundle is rerendered",
  "renders Source-identity selection chrome as a sibling outside the managed subtree",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "snaps a native layer drag to the before or after half of a visible layer row",
  "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
  "uses only the App-owned drag intent and ignores forged native transfer authority",
  "updates surface-local state and changes a compatible binding in the live preview",
  "keeps bound props explicit while boolean and numeric edits fail or apply atomically",
  "preserves the prior Source and preview when Publisher rejects an oversized valid prop",
]);

/** Exact immutable proof receipts that bound M09-T08 App authority. */
export const DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T05",
    proofId: "desen-app-schema-inspector",
    path: SCHEMA_INSPECTOR_ARTIFACT_PATH,
    bytes: 22_998,
    sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
    profile: "desen.app.schema-inspector-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M08-T05",
    proofId: "editor-core-state-binding-edits",
    path: EDITOR_STATE_ARTIFACT_PATH,
    bytes: 30_014,
    sha256: "b85e578ac2bc27897517f12d8d4cf867a089cd61ff9fd1ab0664c819977634f8",
    profile: "desen.editor-core.state-binding-edits-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    path: NAMED_SLOT_ARTIFACT_PATH,
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T08 artifact. */
export const DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact frozen App, Editor Core, and graph parents",
  "[state] proves primitive local-state projection, usage, and exact edits",
  "[binding] proves exact compatible direct binding change and detach",
  "[safety] proves bounded capture, read-only advanced forms, and complete validation",
  "[ownership] keeps state, binding, and session preview chrome App-owned",
  "[tests] pins focused App behavior and exact package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened state, binding, preview, and ownership sources",
  "[verification] rejects parents, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T08 evidence. */
export const DEFAULT_DESEN_APP_STATE_BINDING_EDITOR_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T08 evidence reader. */
export class DesenAppStateBindingEditorProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppStateBindingEditorProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppStateBindingEditorProofError(code, message, details);
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
    if (error instanceof DesenAppStateBindingEditorProofError) throw error;
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
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required state-binding policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function sourceSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = endMarker === undefined ? source.length : source.indexOf(endMarker, start + 1);
  if (start < 0 || end < 0 || end <= start) {
    fail("SOURCE_POLICY_VIOLATION", `${label} could not be isolated.`);
  }
  return source.slice(start, end);
}

function inspectAuthoringData(source) {
  assertIncludes(
    source,
    [
      "validateDesenInteractionCatalogSet",
      "validateDesenSourceInteractionContracts",
      "validationDocument: sourceResult.value",
      "validationCatalogs:",
    ],
    "authoring-data.ts",
  );
  assertExcludes(
    source,
    ["react", "react-dom", "document.querySelector", "getBoundingClientRect"],
    "authoring-data.ts",
  );
  return deepFreeze({
    publicCatalogAndSourceValidation: true,
    validatedDocumentSnapshotRetained: true,
    validatedCatalogSetRetained: true,
  });
}

function inspectStateSource(source) {
  assertIncludes(
    source,
    [
      "createDesenEditorContinuousValidator",
      "deleteDesenEditorStateDeclaration",
      "insertDesenEditorStateDeclaration",
      "setDesenEditorStateInitial",
      "setDesenEditorStateSchema",
      "const AUTHORING_STATE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/u",
      "maxDepth: 512",
      "maxVisitedValues: 100_000",
      "function exactOwnData(",
      "Reflect.ownKeys(input)",
      "Object.getOwnPropertyDescriptor(input, key)",
      "function usageCounts(",
      "scanReferences(roots, usages, visited)",
      "countActionWrites(root, usages, visited)",
      'type === "state.set" || type === "state.toggle"',
      "function presetType(schema: JsonObject): AuthoringStateValueType | null",
      "export function prepareAuthoringStateModel(",
      "export function applyAuthoringStateEdit(",
      "prepareCatalogAuthoringModel(catalogValue, document)",
      "insertDesenEditorStateDeclaration(candidate",
      "setDesenEditorStateSchema(candidate",
      "setDesenEditorStateInitial(schemaChanged.document",
      "existing.usageCount !== 0",
      "deleteDesenEditorStateDeclaration(candidate",
      "const validationReport = validator.validator.validate(candidate)",
      'if (!validationReport.valid) return failure("source-invalid", validationReport)',
    ],
    "authoring-state.ts",
  );
  assertExcludes(
    source,
    ["react", "react-dom", "document.querySelector", "@desen/editor-core/src"],
    "authoring-state.ts",
  );
  const mutation = sourceSection(
    source,
    "export function applyAuthoringStateEdit(",
    undefined,
    "state mutation",
  );
  assertIncludes(
    mutation,
    [
      "const capturedRoute = captureRoute(route)",
      "const capturedEdit = captureEdit(edit)",
      "prepared.model.validationDocument",
      "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      "return Object.freeze({ ok: true, document: candidate })",
    ],
    "state mutation",
  );
  return deepFreeze({
    primitivePresets: ["boolean", "integer", "number", "string"],
    surfaceLocalProjection: true,
    deterministicDeclarationOrder: true,
    exactOwnDataRouteAndEditCapture: true,
    conservativeIdentifierProfile: "^[A-Za-z][A-Za-z0-9_-]{0,127}$",
    usageReferenceReads: true,
    usageStateSetAndToggleWrites: true,
    inertStateInitialExcludedFromUsage: true,
    usageScanMaxDepth: 512,
    usageScanMaxVisitedValues: 100_000,
    legalAdvancedSchemasVisibleReadOnly: true,
    publicEditorCoreStateCommandsOnly: true,
    primitiveSchemaAndInitialStagedPrivately: true,
    unusedOnlyDeletion: true,
    completeSourceRevalidation: true,
    noPartialDocumentOnFailure: true,
  });
}

function inspectInspectorSource(source) {
  assertIncludes(
    source,
    [
      "export interface AuthoringInspectorStateOption",
      "readonly localStates: readonly AuthoringInspectorStateOption[]",
      "export type AuthoringInspectorBindingEdit =",
      'Readonly<{ readonly kind: "bind"; readonly stateName: string; readonly valuePointer: string }>',
      'Readonly<{ readonly kind: "use-initial"; readonly valuePointer: string }>',
      "function captureInspectorBindingEdit(",
      "function projectInspectorStateOptions(",
      "export function isAuthoringInspectorStateCompatible(",
      "function directLocalStateName(value: JsonValue)",
      'if (keys.length !== 1 || keys[0] !== "$ref") return undefined',
      "export function applyAuthoringInspectorBindingEdit(",
      "const capturedEdit = captureInspectorBindingEdit(edit)",
      'field.value.kind === "dynamic" ? directLocalStateName(field.value.value) : undefined',
      'field.value.kind === "dynamic" && currentStateName === undefined',
      "!isAuthoringInspectorStateCompatible(field, state)",
      "Object.freeze({ $ref: state.reference })",
      "createDesenEditorContinuousValidator(prepared.model.validationCatalogs)",
      "validator.validator.validate(changed)",
    ],
    "authoring-inspector.ts",
  );
  assertExcludes(
    source,
    ["react", "react-dom", "@desen/editor-core/src", "eval(", "new Function"],
    "authoring-inspector.ts",
  );
  return deepFreeze({
    directPrimitiveLocalStateOptionsOnly: true,
    exactSingleRefBindingShapeOnly: true,
    catalogControlCompatibilityRequired: true,
    routeSelectionAndEditReadmissionRequired: true,
    exactOwnDataBindingEditCapture: true,
    runtimeAndAdvancedBindingsReadOnly: true,
    bindConstructsExactStateReference: true,
    detachRestoresValidatedPrimitiveInitial: true,
    completeSourceRevalidation: true,
    noPartialDocumentOnFailure: true,
  });
}

function inspectStructuredJsonSource(source) {
  assertIncludes(
    source,
    [
      'import { PUBLISH_SOURCE_JSON_LIMITS } from "@desen/publisher"',
      "function scanInertJson(text: string)",
      "export function parseInertJsonText(input: unknown)",
      "const issue = scanInertJson(input)",
      "value: deepFreezeJson(parsed as JsonValue)",
    ],
    "structured-json.ts",
  );
  return deepFreeze({
    inertReservedMembersNotInterpreted: true,
    publisherJsonLimitsRetained: true,
    duplicateAndUnicodeChecksRetained: true,
    detachedFrozenSuccess: true,
    advancedStateUiClaimed: false,
  });
}

function inspectPreviewSource(source) {
  assertIncludes(
    source,
    [
      'import { createDesenEditorDocument } from "@desen/editor-core"',
      'import { publishDesenSource } from "@desen/publisher"',
      "createDesenEditorDocument(document)",
      "publishDesenSource(rawSource, REFERENCE_CATALOG_PACKAGES)",
      "bundle: published.bundle",
      "revision: published.bundle.revision",
    ],
    "authoring-preview.ts",
  );
  return deepFreeze({
    publicPublisherOnly: true,
    sourceReadmittedBeforePublication: true,
    exactBundleRevisionReturned: true,
    noPartialBundleOnFailure: true,
  });
}

function inspectAdapterSource(source) {
  assertIncludes(
    source,
    [
      "mounted.snapshot.revision !== previewRevision",
      "disposeRuntimeHeadlessSession(session)",
      'data-managed-capability-subtree="true"',
      "selectionOverlay",
    ],
    "adapter-canvas.tsx",
  );
  return deepFreeze({
    revisionReplacement: true,
    previousSessionDisposed: true,
    managedSubtreeExplicit: true,
    selectionOverlayRemainsSibling: true,
  });
}

function inspectApplicationSource(source) {
  assertIncludes(
    source,
    [
      "applyAuthoringInspectorBindingEdit",
      "applyAuthoringStateEdit",
      "prepareAuthoringStateModel",
      'type AuthoringTab = "layers" | "components" | "state" | "actions"',
      "<StatePanel model={stateModel} onEdit={onStateEdit} surfaceName={selectedSurface.name} />",
      "function editSelectedBinding(edit: AuthoringInspectorBindingEdit)",
      "function editLocalState(edit: AuthoringStateEdit)",
      "prepareAuthoringPreviewBundle(result.document)",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      "<aside",
      'aria-label="Authoring panel"',
      "<DesenAdapterCanvas",
      "<InspectorPanel",
      "onBindingEdit={editSelectedBinding}",
      "navigation, resources, storage, publication, activation, integration, and production calls remain blocked.",
      "type AuthoringDropAdmission =",
      "function evaluateDragIntent(",
      "interface AuthoringDragSession {",
      "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
      "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "function projectNearestDrop(",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      "pending.sessionEpoch !== currentSession.epoch",
      "pending.ownerKey !== currentSession.ownerKey",
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
      'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
      "sourceNodeId: result.nodeId",
    ],
    "application.tsx",
  );
  assertExcludes(
    source,
    [
      "dataTransfer.getData",
      "elementsFromPoint",
      "function acceptsDragIntent(",
      "panelDragEnterDepth",
      "componentDragHandle",
      'title="Drag anywhere in this panel to add"',
    ],
    "application.tsx",
  );
  return deepFreeze({
    statePanelComposedByApp: true,
    bindingInspectorComposedByApp: true,
    localStateRouteProjection: true,
    sourceAndPreviewCommitAtomically: true,
    stateSourceAndPreviewCommitAtomically: true,
    bindingSourceAndPreviewCommitAtomically: true,
    publisherFailurePreservesPriorSession: true,
    stateAndInspectorChromeOutsideManagedCapabilitySubtree: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    explicitStickyComponentDropTarget: true,
    componentPaletteOuterDropInert: true,
    draggableComponentCard: true,
    separateNonDraggableComponentAddAction: true,
    retainedInsertSelectionForDeleteDiscoverability: true,
    saveAuthority: false,
    publicationAuthority: false,
    activationAuthority: false,
  });
}

function inspectStatePanelSource(source) {
  assertIncludes(
    source,
    [
      "export function StatePanel(",
      'model.status === "ready"',
      "Object.freeze([...model.declarations].sort(compareStateNames))",
      "Read-only custom schema",
      "Used states cannot be deleted.",
      'onEdit({ kind: "delete", name: declaration.name })',
      'kind: "update"',
      'kind: "insert"',
      "publication are not available here.",
      "State edits remain local until Save source succeeds.",
    ],
    "state-panel.tsx",
  );
  return deepFreeze({
    owner: "Desen App",
    primitiveListAddUpdateDeleteControls: true,
    deterministicOrder: true,
    boundedUsageVisible: true,
    usedDeleteDisabled: true,
    advancedSchemaReadOnly: true,
    noPersistenceOrPublicationClaim: true,
  });
}

function inspectInspectorPanelSource(source) {
  assertIncludes(
    source,
    [
      "function ValueSourceControl(",
      "isAuthoringInspectorStateCompatible(field, state)",
      'stateName === "__local__"',
      'kind: "use-initial"',
      'kind: "bind"',
      "function DynamicField(",
      "This runtime or advanced binding is preserved as read-only.",
      "Choose another compatible state or restore this state's initial value.",
      'data-authoring-inspector="true"',
    ],
    "inspector-panel.tsx",
  );
  return deepFreeze({
    owner: "Desen App",
    compatibleDirectLocalStateSelector: true,
    detachControl: true,
    runtimeAndAdvancedBindingsReadOnly: true,
    managedAdapterImports: 0,
  });
}

function inspectCssSource(source) {
  assertIncludes(
    source,
    [
      ".valueSourceControl",
      ".statePanel",
      ".stateList",
      ".stateCard",
      ".stateDeleteButton",
      ".stateReadonly",
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 2rem;",
      '.slotBoundary[data-drop-hovered="true"]::before',
      ".layerDragGuide {",
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
      ".componentItem {",
      ".componentAddAction {",
    ],
    "application.module.css",
  );
  const managedSelectors = source
    .split("\n")
    .filter(
      (line) =>
        line.includes("data-managed-capability-subtree") &&
        (line.includes("state") || line.includes("valueSource")),
    );
  if (managedSelectors.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "State or binding CSS entered the managed subtree.", {
      managedSelectors,
    });
  }
  assertExcludes(
    source,
    ["margin-block: -1.125rem", "transition: min-height"],
    "application.module.css",
  );
  return deepFreeze({
    appOwnedStateAndBindingSelectors: true,
    managedDescendantStateOrBindingSelectors: 0,
    stableThirtyTwoPixelSlotGaps: true,
    stableGlobalDragGuidePresentation: true,
    stickyExplicitComponentTargetPresentation: true,
    draggableComponentCardPresentation: true,
    separateComponentAddActionPresentation: true,
  });
}

/** Applies the exact M09-T08 production source and ownership policy. */
export function verifyDesenAppStateBindingEditorSourcePolicy(rawInput) {
  const keys = [
    "adapterSource",
    "applicationSource",
    "applicationCss",
    "authoringDataSource",
    "inspectorPanelSource",
    "inspectorSource",
    "previewSource",
    "statePanelSource",
    "stateSource",
    "structuredJsonSource",
  ];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    authoringData: inspectAuthoringData(input.authoringDataSource),
    state: inspectStateSource(input.stateSource),
    inspector: inspectInspectorSource(input.inspectorSource),
    structuredJson: inspectStructuredJsonSource(input.structuredJsonSource),
    statePanel: inspectStatePanelSource(input.statePanelSource),
    inspectorPanel: inspectInspectorPanelSource(input.inspectorPanelSource),
    preview: inspectPreviewSource(input.previewSource),
    adapter: inspectAdapterSource(input.adapterSource),
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

function collectDescendants(node, predicate) {
  const values = [];
  const visit = (current) => {
    if (predicate(current)) values.push(current);
    current.forEachChild(visit);
  };
  visit(node);
  return values;
}

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath);
  return collectDescendants(sourceFile, ts.isCallExpression)
    .filter((call) => {
      const direct =
        ts.isIdentifier(call.expression) && ["it", "test"].includes(call.expression.text);
      const parameterized =
        ts.isCallExpression(call.expression) &&
        ts.isPropertyAccessExpression(call.expression.expression) &&
        ts.isIdentifier(call.expression.expression.expression) &&
        ["it", "test"].includes(call.expression.expression.expression.text) &&
        call.expression.expression.name.text === "each";
      return (
        (direct || parameterized) &&
        call.arguments.length > 0 &&
        ts.isStringLiteral(call.arguments[0])
      );
    })
    .map((call) => call.arguments[0].text);
}

function requireTestNames(actual, expected, relativePath) {
  const missing = expected.filter((name) => !actual.includes(name));
  if (missing.length !== 0) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} lost required tests.`, { missing });
  }
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
    names[STRUCTURED_JSON_TEST_PATH],
    EXPECTED_STRUCTURED_JSON_TEST_NAMES,
    STRUCTURED_JSON_TEST_PATH,
  );
  requireTestNames(names[STATE_TEST_PATH], EXPECTED_STATE_TEST_NAMES, STATE_TEST_PATH);
  requireTestNames(names[INSPECTOR_TEST_PATH], EXPECTED_INSPECTOR_TEST_NAMES, INSPECTOR_TEST_PATH);
  requireTestNames(
    names[STATE_PANEL_TEST_PATH],
    EXPECTED_STATE_PANEL_TEST_NAMES,
    STATE_PANEL_TEST_PATH,
  );
  requireTestNames(
    names[INSPECTOR_PANEL_TEST_PATH],
    EXPECTED_INSPECTOR_PANEL_TEST_NAMES,
    INSPECTOR_PANEL_TEST_PATH,
  );
  requireTestNames(names[PREVIEW_TEST_PATH], EXPECTED_PREVIEW_TEST_NAMES, PREVIEW_TEST_PATH);
  requireTestNames(names[ADAPTER_TEST_PATH], EXPECTED_ADAPTER_TEST_NAMES, ADAPTER_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );
  assertIncludes(
    sources.get(STATE_TEST_PATH),
    [
      "Array.from({ length: 100_001 }",
      "for (let depth = 0; depth < 513; depth += 1)",
      "expect(accessorCalls).toBe(0)",
      'type: "state.set"',
      'type: "state.toggle"',
      'name: "constrained"',
      'name: "legacy.value"',
      'reason: "state-in-use"',
    ],
    "authoring-state tests",
  );
  assertIncludes(
    sources.get(APPLICATION_TEST_PATH),
    [
      "Updated email local state.",
      "Bound Value to state.password.",
      "Used by 2",
      "Used by 4",
      "Delete password local state",
      "Value value source",
    ],
    "application tests",
  );
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:state-bindings && node --test tests/desen-app-state-binding-editor.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES,
    localCommandReceipts: {
      pureState: {
        command: "pnpm --filter @desen/app-web exec vitest run test/authoring-state.test.ts",
        result: "PASS",
        testFiles: 1,
        tests: 12,
      },
      focusedStateBindings: {
        command: "pnpm --filter @desen/app-web test:state-bindings",
        result: "PASS",
        testFiles: 8,
        tests: 109,
      },
      fullApp: {
        command: "pnpm --filter @desen/app-web test",
        result: "PASS",
        testFiles: 13,
        tests: 181,
      },
      rootProof: {
        command: "node --test tests/desen-app-state-binding-editor.test.mjs",
        result: "PASS",
        testFiles: 1,
        tests: 9,
      },
    },
    semanticCoverage: [
      "SURFACE_LOCAL_PRIMITIVE_STATE_PROJECTION",
      "ORDERED_LIST_ADD_UPDATE_DELETE",
      "BOUNDED_CONSERVATIVE_USAGE_COUNT",
      "STATE_INITIAL_EXCLUDED_AS_INERT_DATA",
      "USED_STATE_DELETE_REJECTED",
      "PRIVATE_SCHEMA_INITIAL_STAGING",
      "EXACT_OWN_DATA_ROUTE_STATE_AND_BINDING_CAPTURE",
      "DIRECT_SINGLE_REF_LOCAL_STATE_BINDING",
      "CATALOG_CONTROL_COMPATIBILITY",
      "DIRECT_BINDING_CHANGE_AND_DETACH",
      "RUNTIME_AND_ADVANCED_BINDINGS_READ_ONLY",
      "CONTINUOUS_SOURCE_REVALIDATION",
      "ATOMIC_PUBLISHER_PREVIEW",
      "APP_OWNED_STATE_AND_BINDING_CHROME",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/structured-json.test.ts test/authoring-state.test.ts test/authoring-inspector.test.ts test/state-panel.test.tsx test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:state-bindings"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App state-binding test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-schema-inspector.mjs && node scripts/verify-editor-core-state-binding-edits.mjs && node scripts/verify-desen-app-named-slot-authoring.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:state-bindings && ";
  const expectedRootCommands = {
    "generate:desen-app-state-binding-editor": `${prefix}node scripts/generate-desen-app-state-binding-editor-proof.mjs`,
    "verify:desen-app-state-binding-editor": `${prefix}node scripts/verify-desen-app-state-binding-editor.mjs`,
    "test:desen-app-state-binding-editor": `${prefix}node --test tests/desen-app-state-binding-editor.test.mjs`,
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  const publicDependencies = [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/validator",
  ];
  for (const dependency of publicDependencies) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `The App lost its public ${dependency} dependency.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
    publicDependencies,
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
    pin.proofId === "desen-app-schema-inspector" &&
    (artifact.claim?.schemaDerivedPrimitiveAndEnumControls !== true ||
      artifact.claim?.publicEditorCoreAtomicMutation !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.inspectorOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T05 Inspector authority claims drifted.");
  }
  if (
    pin.proofId === "editor-core-state-binding-edits" &&
    (artifact.claim?.immutableStateBindingEditCommands !== true ||
      artifact.claim?.stableIdentityPreserved !== true ||
      artifact.claim?.taskStatus !== "DONE")
  ) {
    fail("PARENT_DRIFT", "The frozen M08-T05 state-binding authority claims drifted.");
  }
  if (
    pin.proofId === "desen-app-named-slot-authoring" &&
    (artifact.claim?.publicStableIdInsert !== true ||
      artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.slotChromeOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T07 graph authority claims drifted.");
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
    "frozen M09-T08 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T08 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T08 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-state-binding-editor" ||
    artifact?.profile !== "desen.app.state-binding-editor-proof.v1" ||
    artifact?.task !== "M09-T08" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.surfaceLocalPrimitiveStateList !== true ||
    artifact?.claim?.primitiveStateAddUpdateDelete !== true ||
    artifact?.claim?.boundedConservativeUsageCount !== true ||
    artifact?.claim?.directCompatibleLocalStatePropBinding !== true ||
    artifact?.claim?.exactDirectBindingChange !== true ||
    artifact?.claim?.exactDirectBindingDetachToInitial !== true ||
    artifact?.claim?.runtimeAndAdvancedBindingReadOnly !== true ||
    artifact?.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.stateAndBindingChromeOutsideManagedCapabilitySubtree !== true ||
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
      DESEN_APP_STATE_BINDING_EDITOR_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T08 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T08 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateEventActionSuccessor(files) {
  const artifactBytes = files.get(EVENT_ACTION_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== EVENT_ACTION_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== EVENT_ACTION_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T09 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, EVENT_ACTION_ARTIFACT_PATH);
  if (
    artifact.task !== EVENT_ACTION_ARTIFACT_PIN.task ||
    artifact.proofId !== EVENT_ACTION_ARTIFACT_PIN.proofId ||
    artifact.profile !== EVENT_ACTION_ARTIFACT_PIN.profile ||
    artifact.result !== EVENT_ACTION_ARTIFACT_PIN.result ||
    artifact.claim?.catalogDeclaredEventProjection !== true ||
    artifact.claim?.exactSelectedComponentOwner !== true ||
    artifact.claim?.behaviorOwnerUiClaimed !== false ||
    artifact.claim?.publicEditorCoreEventActionMutation !== true ||
    artifact.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.eventActionChromeOutsideManagedCapabilitySubtree !== true ||
    artifact.claim?.actionExecutionClaimed !== false ||
    artifact.claim?.designRunClaimed !== false ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T09 artifact identity or claims drifted.");
  }
  return deepFreeze({
    task: EVENT_ACTION_ARTIFACT_PIN.task,
    artifact: EVENT_ACTION_ARTIFACT_PIN,
    exactSelectedComponentEvents: true,
    behaviorOwnerUiImplemented: false,
    publicEditorCoreEventActionMutation: true,
    atomicPublisherBackedPreview: true,
    actionExecutionImplemented: false,
    designRunImplemented: false,
    persistenceImplemented: false,
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
    bytes: 29_208,
    sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
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
    parent?.task !== "M09-T10" ||
    parent?.bytes !== 17_900 ||
    parent?.sha256 !== "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.cleanupSynchronouslyRevokesFixtureAdmission !== true ||
    artifact.claim?.pendingRevokedOnPreviewReplacement !== true ||
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

/** Builds detached deterministic M09-T08 state-binding editor evidence. */
async function _buildFreshDesenAppStateBindingEditorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parents = DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppStateBindingEditorSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    stateSource: decodeUtf8(files.get(STATE_SOURCE_PATH), STATE_SOURCE_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_SOURCE_PATH), INSPECTOR_SOURCE_PATH),
    structuredJsonSource: decodeUtf8(
      files.get(STRUCTURED_JSON_SOURCE_PATH),
      STRUCTURED_JSON_SOURCE_PATH,
    ),
    statePanelSource: decodeUtf8(files.get(STATE_PANEL_SOURCE_PATH), STATE_PANEL_SOURCE_PATH),
    inspectorPanelSource: decodeUtf8(
      files.get(INSPECTOR_PANEL_SOURCE_PATH),
      INSPECTOR_PANEL_SOURCE_PATH,
    ),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-state-binding-editor",
    profile: "desen.app.state-binding-editor-proof.v1",
    task: "M09-T08",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      surfaceLocalPrimitiveStateList: true,
      primitiveStateAddUpdateDelete: true,
      primitiveStateTypes: ["boolean", "integer", "number", "string"],
      boundedConservativeUsageCount: true,
      usageScanMaxDepth: 512,
      usageScanMaxVisitedValues: 100_000,
      usedStateDeleteRejected: true,
      directCompatibleLocalStatePropBinding: true,
      exactDirectBindingChange: true,
      exactDirectBindingDetachToInitial: true,
      runtimeAndAdvancedBindingReadOnly: true,
      advancedStateSchemaReadOnly: true,
      exactOwnDataStateAndBindingCapture: true,
      publicEditorCoreStateAndPropMutation: true,
      continuousCompleteSourceRevalidation: true,
      failedEditPreservesCurrentDocument: true,
      publisherSessionPreview: true,
      sourceAndPreviewCommitAtomically: true,
      stateAndBindingChromeOutsideManagedCapabilitySubtree: true,
      retainedNamedSlotAuthoringUxCompatibility: true,
      persistenceClaimed: false,
      eventActionEditingClaimed: false,
      designRunClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
    },
    authority: {
      protocolProfiles: {
        localStateReference: 'exact { "$ref": "state.<name>" } only',
        stateScope: "selected Source surface only",
        primitiveStateTypes: ["boolean", "integer", "number", "string"],
        usageCount: "bounded conservative reads plus explicit state.set/state.toggle writes",
      },
      source,
    },
    application: {
      package: packageContract,
      mutationFlow: [
        "validator-admitted Catalog and Source projection",
        "exact surface route and state or Inspector edit capture",
        "bounded surface-local state and usage projection",
        "Catalog-derived primitive property and compatible local-state reauthorization",
        "public Editor Core state-declaration or owner-prop commands",
        "continuous complete-Source validation",
        "Publisher session-local Bundle",
        "atomic Source and exact adapter session replacement",
      ],
      ownership: {
        statePanel: "Desen App sibling chrome",
        bindingSelector: "Desen App Inspector chrome",
        advancedBindings: "visible read-only Source data",
        managedCapabilitySubtree: "Runtime React adapters only",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 3,
      immutableInputs: true,
      sourceSymlinksRejected: true,
    },
    result: "PASS",
    nonclaims: [
      "Repeat and resource-binding UI are not implemented or claimed by M09-T08.",
      "M09-T09 is NOT_PROVEN: event and closed-action editing are not implemented.",
      "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
      "G09 and browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN until the remaining visual authoring and browser-E2E owners pass.",
      "Runtime namespaces, fallbacks, tokens, formats, nested dynamic values, and advanced local-state schemas remain read-only.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Authenticates frozen M09-T08 evidence and checks its live additive M09-T09 successor. */
export async function buildDesenAppStateBindingEditorEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_STATE_BINDING_EDITOR_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const source = verifyDesenAppStateBindingEditorSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    stateSource: decodeUtf8(files.get(STATE_SOURCE_PATH), STATE_SOURCE_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_SOURCE_PATH), INSPECTOR_SOURCE_PATH),
    structuredJsonSource: decodeUtf8(
      files.get(STRUCTURED_JSON_SOURCE_PATH),
      STRUCTURED_JSON_SOURCE_PATH,
    ),
    statePanelSource: decodeUtf8(files.get(STATE_PANEL_SOURCE_PATH), STATE_PANEL_SOURCE_PATH),
    inspectorPanelSource: decodeUtf8(
      files.get(INSPECTOR_PANEL_SOURCE_PATH),
      INSPECTOR_PANEL_SOURCE_PATH,
    ),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const successor = authenticateEventActionSuccessor(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-state-binding-editor",
    profile: "desen.app.state-binding-editor-proof.v1",
    task: "M09-T08",
    result: "PASS",
    prerequisites: parents,
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      surfaceLocalPrimitiveStateList: frozen.artifact.claim.surfaceLocalPrimitiveStateList,
      primitiveStateAddUpdateDelete: frozen.artifact.claim.primitiveStateAddUpdateDelete,
      boundedConservativeUsageCount: frozen.artifact.claim.boundedConservativeUsageCount,
      directCompatibleLocalStatePropBinding:
        frozen.artifact.claim.directCompatibleLocalStatePropBinding,
      exactDirectBindingChange: frozen.artifact.claim.exactDirectBindingChange,
      exactDirectBindingDetachToInitial: frozen.artifact.claim.exactDirectBindingDetachToInitial,
      continuousCompleteSourceRevalidation:
        frozen.artifact.claim.continuousCompleteSourceRevalidation,
      sourceAndPreviewCommitAtomically: frozen.artifact.claim.sourceAndPreviewCommitAtomically,
      stateAndBindingChromeOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.stateAndBindingChromeOutsideManagedCapabilitySubtree,
    },
    source,
    successor,
    fixturesScenariosSuccessor,
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
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
        APPLICATION_SOURCE_PATH,
        APPLICATION_CSS_PATH,
        APPLICATION_TEST_PATH,
        EVENT_ACTION_ARTIFACT_PATH,
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
    "Task: M09-T08",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "M09-T09: NOT_PROVEN",
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
    pureState: receipts.pureState.tests,
    focusedStateBindings: receipts.focusedStateBindings.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T08 bytes and the visible report digest. */
export async function verifyDesenAppStateBindingEditorEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppStateBindingEditorEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_STATE_BINDING_EDITOR_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T08 artifact bytes differ from fresh evidence.");
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

/** Atomically writes exact deterministic M09-T08 proof bytes. */
export async function writeDesenAppStateBindingEditorEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_STATE_BINDING_EDITOR_ARTIFACT_PATH,
  );
  const built = await buildDesenAppStateBindingEditorEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T08 artifact write failed safely.", {
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
