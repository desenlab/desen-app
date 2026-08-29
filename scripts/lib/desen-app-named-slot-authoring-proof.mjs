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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-NAMED-SLOT-AUTHORING.md";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const AUTHORING_DATA_PATH = "apps/desen-app/src/authoring-data.ts";
const SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const AUTHORING_DATA_TEST_PATH = "apps/desen-app/test/authoring-data.test.ts";
const SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
const PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "scripts/generate-desen-app-named-slot-authoring-proof.mjs",
  "scripts/verify-desen-app-named-slot-authoring.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  AUTHORING_DATA_PATH,
  SLOT_SOURCE_PATH,
  PREVIEW_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  AUTHORING_DATA_TEST_PATH,
  SLOT_TEST_PATH,
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
  PARENT_ARTIFACT_PATH,
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
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
]);

const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    STATE_BINDING_ARTIFACT_PATH,
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
  "scripts/lib/desen-app-named-slot-authoring-proof.mjs",
  "tests/desen-app-named-slot-authoring.test.mjs",
]);

const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 24_830,
  sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
});

const STATE_BINDING_ARTIFACT_PIN = Object.freeze({
  task: "M09-T08",
  proofId: "desen-app-state-binding-editor",
  profile: "desen.app.state-binding-editor-proof.v1",
  result: "PASS",
  path: STATE_BINDING_ARTIFACT_PATH,
  bytes: 28_766,
  sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
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
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  ADAPTER_TEST_PATH,
  APPLICATION_TEST_PATH,
]);

const EXPECTED_AUTHORING_DATA_TEST_NAMES = Object.freeze([
  "projects the exact Catalog library and official Source surface trees",
  "preserves absent slots, own empty slots, and Source child-array order",
]);

const EXPECTED_SLOT_TEST_NAMES = Object.freeze([
  "projects the selected slot and captures an exact frozen selection",
  "inserts reference components with exact defaults and deterministic collision IDs",
  "removes a newly inserted nested subtree and preserves the owning slot plus prior siblings",
  "$label",
  "preflights and rejects a move into the moving node's descendant slot",
  "projects a declared-but-absent slot with effective min/max semantics",
  "implements ID/category OR, unrestricted, explicit-empty, and max acceptance",
  "disables inserts whose Catalog defaults fail schema or bounded transition admission",
  "moves across component and behavior owners without changing the node",
  "deletes from a behavior-owned slot and retains its own empty slot key",
  "rejects crossing a source minimum or destination maximum atomically",
  "disables root deletion and deletion across the owning slot minimum",
  "rejects one insert or move into an absent optional minItems:2 slot",
  "fails closed when a minimal insert cannot materialize the component's own required slot",
  "finishes a cross-owner move across 1,024 sibling nodes",
  "deletes the final node from a 1,024-sibling slot within the bounded profile",
  "rejects stale and forged selections without mutating Source",
  "rejects cross-route and extra-field inputs",
  "never invokes accessors on hostile selection or edit objects",
  "captures deletion selections as exact own data and rejects cross-route authority",
  "rejects deletion with a %s",
  "captures every edit Proxy own descriptor exactly once",
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
  "renders the editable Source hierarchy and keeps the exact managed adapter canvas read only",
  "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
  "disables deletion for the surface root and a slot-minimum preflight without changing preview",
  "preserves the selected layer, preview, and focus when deletion is rejected",
  "uses only the App-owned drag intent and ignores forged native transfer authority",
  "snaps a native layer drag to the before or after half of a visible layer row",
  "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
  "reorders a selected Source node through the keyboard placement control",
  "moves nodes across nested slots with keyboard and App-owned native drag intent",
  "switches to the exact Catalog component library and filters only the local view",
]);

/** Exact immutable M09-T06 predecessor receipt for M09-T07. */
export const DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN = Object.freeze({
  task: "M09-T06",
  proofId: "desen-app-structured-inspector",
  path: PARENT_ARTIFACT_PATH,
  bytes: 26_133,
  sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
  profile: "desen.app.structured-inspector-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Reviewed independent root-test names retained by the M09-T07 artifact. */
export const DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact frozen M09-T06 structured-inspector parent",
  "[catalog] proves PF-010 slot projection, presence, cardinality, and acceptance",
  "[editing] proves public insert, move, reorder, delete, identity, and index semantics",
  "[safety] proves exact capture, bounded defaults, deletion minima, and complete Source validation",
  "[ownership] keeps expanded drag targets, deletion UI, and slot chrome App-owned",
  "[tests] pins focused App behavior and exact package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened slot, mutation, bound, and ownership sources",
  "[verification] rejects parent, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T07 evidence. */
export const DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T07 evidence reader. */
export class DesenAppNamedSlotAuthoringProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppNamedSlotAuthoringProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppNamedSlotAuthoringProofError(code, message, details);
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
    if (error instanceof DesenAppNamedSlotAuthoringProofError) throw error;
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
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required named-slot policy.`, { missing });
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
      "export interface AuthoringSlotContract",
      "readonly slotContracts: readonly AuthoringSlotContract[]",
      "readonly defaultProps: JsonObject",
      "function projectSlotContracts(",
      'Object.hasOwn(slot, "minItems")',
      "required\n            ? 1\n            : 0",
      'Object.hasOwn(slot, "accepts") || Object.hasOwn(slot, "acceptsCategories")',
      "defaultProps: optionalObject(authoring?.defaultProps) ?? Object.freeze({})",
      "slotContracts: metadata.slotContracts",
      "validationDocument: sourceResult.value",
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
    completeDeclaredSlotProjection: true,
    effectiveMinimumProfile: "minItems ?? (required ? 1 : 0)",
    explicitAcceptancePresenceRetained: true,
    authoringDefaultsRetained: true,
    sourcePresenceRetainedSeparately: true,
    validatedDocumentSnapshotRetained: true,
  });
}

function inspectSlotSource(source) {
  assertIncludes(
    source,
    [
      "createDesenEditorContinuousValidator",
      "  deleteDesenEditorNode,",
      "insertDesenEditorNode",
      "moveDesenEditorNode",
      "reorderDesenEditorNode",
      "setDesenEditorOwnerProp",
      "export function evaluateAuthoringSlotInsertion(",
      "export function evaluateAuthoringSlotPlacement(",
      "export function evaluateAuthoringNodeDeletion(",
      "export function applyAuthoringNodeDelete(",
      "canonicalizeJsonBytes",
      "maxDefaultPropTransitions: 256",
      "maxAggregateSnapshotWorkBytes: 33_554_432",
      "const VALIDATOR_BY_MODEL = new WeakMap<",
      "VALIDATOR_BY_MODEL.get(model)",
      "VALIDATOR_BY_MODEL.set(model, prepared)",
      "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
      "const PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<",
      "function admissionKey(selection: AuthoringSlotSelection, subjectId: string)",
      "selection.ownerCapabilityId",
      "function materializePlacementCompatibility(",
      'base.operation === "reorder" && index > base.sourceIndex ? index - 1 : index',
      'changesSource: base.operation === "move" || finalIndex !== base.sourceIndex',
      "const keys = Reflect.ownKeys(edit)",
      "Object.getOwnPropertyDescriptor(edit, key)",
      "function captureComponentSelection(",
      "const fields = exactOwnData(selection, [",
      "const contractsBySet = new WeakMap<",
      "if (owner.slots.length === 0) return",
      "contractsBySet.set(owner.slotContracts, contracts)",
      "present: sourceSlot !== undefined",
      "if (!slot.contract.constrainsChildren) return true",
      "slot.contract.acceptedCapabilityIds.includes(component.id)",
      "slot.contract.acceptedCategories.includes(component.semanticCategory)",
      "slot.children.length >= slot.contract.maximum",
      "const transitionCount = Object.keys(component.defaultProps).length + 1",
      "transitionCount - 1 > SLOT_INSERT_PROFILE.maxDefaultPropTransitions",
      "const properties = Object.keys(component.defaultProps)",
      "if (!withinDefaultProfile(document, component)) return undefined",
      "properties.sort(compareText)",
      "Math.floor(SLOT_INSERT_PROFILE.maxAggregateSnapshotWorkBytes / transitionCount)",
      "prepared.model.validationDocument",
      "capturedEdit.index > projection.slot.children.length",
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "capturedEdit.index > placement.index ? capturedEdit.index - 1 : capturedEdit.index",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "nodeContainsOwner(placement.node, capturedSelection)",
      "insertDesenEditorNode(model.validationDocument",
      "const validationReport = validationReportForCandidate(prepared.model, changed.document)",
      '? failure("source-invalid", validationReport)',
      "placement === undefined || placement === null",
      "does not invent a private subtree transaction",
    ],
    "authoring-slots.ts",
  );
  assertExcludes(
    source,
    [
      "react",
      "react-dom",
      "DragEvent",
      "dataTransfer",
      "document.querySelector",
      "getBoundingClientRect",
      "elementFromPoint",
      "querySelector",
    ],
    "authoring-slots.ts",
  );
  const insertionPreflight = sourceSection(
    source,
    "export function evaluateAuthoringSlotInsertion(",
    "/** Re-authorizes one current Source node",
    "insertion preflight",
  );
  const placementPreflight = sourceSection(
    source,
    "export function evaluateAuthoringSlotPlacement(",
    "/** Re-authorizes whether the exact current selection may be removed",
    "placement preflight",
  );
  const deletionPreflight = sourceSection(
    source,
    "export function evaluateAuthoringNodeDeletion(",
    "/**\n * Removes one exact selected subtree",
    "deletion preflight",
  );
  const deletionMutation = sourceSection(
    source,
    "export function applyAuthoringNodeDelete(",
    "/**\n * Applies an insertion",
    "deletion mutation",
  );
  const mutation = sourceSection(
    source,
    "export function applyAuthoringSlotEdit(",
    undefined,
    "slot mutation",
  );
  assertIncludes(
    insertionPreflight,
    [
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "const admissions = insertionAdmissions(model)",
      "const key = admissionKey(capturedSelection, componentId)",
      "const cached = admissions.get(key)",
      "index > cached.maximumIndex",
      "cached.compatibility",
      "insertDesenEditorNode(model.validationDocument",
      "validateCandidate(model, staged)",
    ],
    "insertion preflight",
  );
  assertIncludes(
    placementPreflight,
    [
      "projection.slot.children.length + 1 < projection.slot.contract.minimum",
      "const admissions = placementAdmissions(model)",
      "const key = admissionKey(capturedSelection, nodeId)",
      "const cached = admissions.get(key)",
      "index > cached.maximumIndex",
      "materializePlacementCompatibility(cached.base, index)",
      "admissions.set(key, Object.freeze({ maximumIndex, base }))",
      "reorderDesenEditorNode(model.validationDocument",
      "moveDesenEditorNode(model.validationDocument",
      "validateCandidate(model, changed.document)",
    ],
    "placement preflight",
  );
  assertIncludes(
    deletionPreflight,
    [
      "const capturedSelection = captureComponentSelection(selection)",
      "placement === undefined ||\n    placement === null",
      "placement.node.capabilityId !== capturedSelection.capabilityId",
      "placement.node.displayName !== capturedSelection.displayName",
      "placement.node.conditional !== capturedSelection.conditional",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "deleteDesenEditorNode(model.validationDocument",
      "validateCandidate(model, changed.document)",
    ],
    "deletion preflight",
  );
  assertIncludes(
    deletionMutation,
    [
      "const capturedSelection = captureComponentSelection(selection)",
      "prepareCatalogAuthoringModel(catalogValue, document)",
      "findNodePlacement(",
      "placement.node.capabilityId !== capturedSelection.capabilityId",
      "placement.slot.children.length - 1 < placement.slot.contract.minimum",
      "deleteDesenEditorNode(prepared.model.validationDocument",
      "const validationReport = validationReportForCandidate(prepared.model, changed.document)",
      '? failure("source-invalid", validationReport)',
      'operation: "delete"',
    ],
    "deletion mutation",
  );
  assertIncludes(
    mutation,
    ["projection.slot.children.length + 1 < projection.slot.contract.minimum"],
    "slot mutation",
  );
  return deepFreeze({
    publicEditorCoreOnly: true,
    exactRouteSelectionAndEditCapture: true,
    editDescriptorsCapturedOnce: true,
    absentSlotProjection: true,
    linearSharedContractTraversal: true,
    exactIdOrCategoryAcceptance: true,
    unrestrictedOnlyWhenAcceptanceFieldsAbsent: true,
    componentInsertionPreflight: true,
    nodeMoveAndReorderPreflight: true,
    nodeDeletionPreflight: true,
    insertionPreflightRunsPublicMutationAndValidation: true,
    placementPreflightRunsPublicMutationAndValidation: true,
    deletionPreflightRunsPublicMutationAndValidation: true,
    cyclePreflight: true,
    sameSlotNoOpReported: true,
    destinationMaximumBeforeInsertOrMove: true,
    absentDestinationMinimumBeforeInsertOrMove: true,
    sourceMinimumBeforeCrossSlotMove: true,
    sourceMinimumBeforeDelete: true,
    sameSlotBoundaryConvertedAfterRemoval: true,
    rootPlacementRejected: true,
    rootDeletionRejected: true,
    cyclesPreflightedBeforePublicEditorCoreMove: true,
    deterministicStableIdInsert: true,
    publicNestedSubtreeDelete: true,
    exactComponentDeletionSelectionCapture: true,
    defaultPropTransitionLimit: 256,
    defaultPropWorkByteLimit: 33_554_432,
    defaultPropWidthCheckedBeforeSort: true,
    validatorPreparationCachedPerModel: true,
    insertionAdmissionCachedPerModelAndExactTarget: true,
    placementAdmissionCachedPerModelAndExactTarget: true,
    admissionCacheKeysExcludeBoundaryIndex: true,
    cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
    cachedAdmissionsRejectOutOfRangeBoundary: true,
    minimalRequiredSlotInsertFailsClosed: true,
    validatedSourceSnapshotMutation: true,
    completeSourceRevalidation: true,
    deletionCompleteSourceRevalidation: true,
    noPartialDocumentOrIdentityOnFailure: true,
    noPartialDocumentOnDeleteFailure: true,
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
      "type AuthoringDragIntent =",
      'Readonly<{ readonly kind: "component"; readonly componentId: string }>',
      'Readonly<{ readonly kind: "node"; readonly nodeId: string }>',
      "function declaredSlotStates(",
      "const slotsByName = new Map(owner.slots.map((slot) => [slot.name, slot]))",
      "return owner.slotContracts.map((contract) =>",
      'event.dataTransfer.setData("text/plain", "DESEN App authoring item")',
      "const [dragIntent, setDragIntent] = useState<AuthoringDragIntent | null>(null)",
      'const dropReady = dragAdmission?.status === "accepted"',
      "type AuthoringDropAdmission =",
      "function evaluateDragIntent(",
      "interface AuthoringDragSession {",
      "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
      "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
      "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
      "onProjectDrop={projectDrop}",
      "const activeDropIndex =",
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      "function projectNearestDrop(",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "pending.sessionEpoch !== currentSession.epoch",
      "pending.ownerKey !== currentSession.ownerKey",
      "document.elementFromPoint(pending.clientX, pending.clientY)",
      "hitSlotSurface !== pending.slotSurface",
      "function clearUnclaimedDrop(): void {",
      "data-drop-hovered={dropReady && dropHovered}",
      "data-drop-ready={dropReady}",
      "onDragEnter={updateDropProjection}",
      "onDragOver={updateDropProjection}",
      "onDrop={receiveDrop}",
      "interaction.onApplyIntent(projection.target, projection.index, interaction.dragIntent)",
      "event.stopPropagation()",
      "projectAuthoringSlotSelection(resolvedActiveSlot, route, model)",
      "evaluateAuthoringSlotInsertion(\n                              route,",
      "evaluateAuthoringSlotPlacement(route, authoringModel, target",
      "selectedPlacement?.accepted === true && selectedPlacement.changesSource === true",
      'if (!compatibility.changesSource) return Object.freeze({ status: "noop" })',
      "slot insertion boundary at position",
      'role="group"',
      "const componentDropReady =",
      "const [targetDragHovered, setTargetDragHovered] = useState(false)",
      "const targetDragEnterDepth = useRef(0)",
      "data-drop-hovered={componentDropReady && targetDragHovered}",
      "data-drop-ready={componentDropReady}",
      "data-guide={readySlot === null}",
      "targetDragEnterDepth.current += 1",
      "targetDragEnterDepth.current = Math.max(0, targetDragEnterDepth.current - 1)",
      "className={styles.componentsView}",
      'event.dataTransfer.dropEffect = "none"',
      'if (dragIntent?.kind !== "component") return;\n        event.preventDefault();\n        onClearDrag();',
      'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
      "onDragOver={admitComponentDrop}",
      "onDrop={receiveComponentDrop}",
      "No drop target selected",
      "Choose a named slot in Layers before placing a component.",
      "Choose slot in Layers",
      "className={styles.componentSlotTarget}",
      'data-component-card="true"',
      "className={styles.componentItem}",
      "draggable={enabled}",
      "? `Drag ${component.displayName} to the Add to target`",
      "className={styles.componentAddAction}",
      "draggable={false}",
      "event.preventDefault();\n                                event.stopPropagation();",
      "onClick={() => addComponent(component.id)}",
      "const COMPONENT_PALETTE_RENDER_LIMIT = 24",
      "const visibleComponents = components.slice(0, COMPONENT_PALETTE_RENDER_LIMIT)",
      "const groups = groupComponents(visibleComponents)",
      "Showing ${visibleComponents.length} of ${components.length} matches",
      "readonly active: boolean",
      "if (!active) return null",
      '{activeTab === "layers" ? (',
      'active={activeTab === "components"}',
      "disabled={!selectedMovable}",
      "disabled={!enabled}",
      "onApplyIntent(readySlot.selection, readySlot.slot.children.length",
      "applyAuthoringSlotEdit(document, referenceCatalog, route, target, edit)",
      "evaluateAuthoringNodeDeletion(route, model, selection)",
      "applyAuthoringNodeDelete(document, referenceCatalog, route, selection)",
      "prepareAuthoringPreviewBundle(result.document)",
      "commitAuthoringSession(Object.freeze({ document: result.document, preview: nextPreview }))",
      'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
      "sourceNodeId: result.nodeId",
      "setSelection(null)",
      "Deletes this layer and its nested Source subtree.",
      "aria-label={`Delete ${selection.displayName} layer · ${selection.sourceNodeId}`}",
      "disabled={deletionCompatibility?.accepted !== true}",
      "onClick={deleteSelection}",
      "layersTab.current?.focus()",
      "<aside",
      'aria-label="Authoring panel"',
      "<DesenAdapterCanvas",
      "placement, and Inspector chrome never enter the managed",
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
    appOwnedDragIntent: true,
    browserPayloadIsInertHint: true,
    declaredAbsentSlotsVisible: true,
    linearDeclaredPresentJoin: true,
    orderedBoundaryControls: true,
    expandedNonOverlappingDropReadyBoundaries: true,
    rowHalfDropTargets: true,
    rowGeometryUsedOnlyForBoundedDropProjection: true,
    stableNestedDragHoverTracking: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    edgeScrollRehitTestsExactSlotSurface: true,
    componentCompatibilityVisible: true,
    explicitComponentDropTarget: true,
    componentDropAdmissionLimitedToExplicitTarget: true,
    componentPaletteOuterDropInert: true,
    draggableComponentCard: true,
    separateNonDraggableComponentAddAction: true,
    stickyComponentDropTarget: true,
    componentDragGuidance: true,
    slotlessDisabledPlacementGuide: true,
    browserDataTransferReads: 0,
    invalidPlacementControlsDisabled: true,
    sameSlotNoOpControlsDisabled: true,
    componentPaletteRenderLimit: 24,
    completeFilteredMatchCountRetained: true,
    inactiveLayerTreeNotRendered: true,
    inactiveComponentPaletteShortCircuited: true,
    activeTabOnlyAuthoringWork: true,
    staleSlotProjectionRejected: true,
    publicNodeDeletionPreflight: true,
    invalidDeletionControlsDisabled: true,
    deletionReasonAssociatedWithControl: true,
    sourceAndPreviewCommitAtomically: true,
    deletionSourceAndPreviewCommitAtomically: true,
    successfulDeletionClearsSelection: true,
    successfulInsertionSelectsNewLayer: true,
    deletionFocusReturnsToLayersTab: true,
    failedDeletionPreservesSelectionAndFocus: true,
    publisherFailurePreservesPriorSession: true,
    slotChromeOutsideManagedCapabilitySubtree: true,
  });
}

function inspectCssSource(source) {
  assertIncludes(
    source,
    [
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 2rem;\n  align-items: center;\n  padding: 0 0.125rem;",
      '.slotBoundary[data-drop-ready="true"]',
      '.slotBoundary[data-drop-ready="true"]::before',
      '.slotBoundary[data-drop-hovered="true"]',
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryLine',
      '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
      ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
      '.componentSlotTarget[data-drag-active="true"]',
      '.componentSlotTarget[data-ready="true"]',
      '.componentSlotTarget[data-guide="true"]',
      '.componentSlotTarget[data-drop-ready="true"]',
      '.componentSlotTarget[data-drop-hovered="true"]',
      ".layerDragGuide {",
      ".componentItem {",
      ".componentAddAction {",
    ],
    "application.module.css",
  );
  const managedSlotSelectors = source
    .split("\n")
    .filter(
      (line) =>
        line.includes("data-managed-capability-subtree") &&
        (line.includes("slot") || line.includes("componentItem")),
    );
  if (managedSlotSelectors.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "Slot chrome CSS entered the managed capability subtree.", {
      managedSlotSelectors,
    });
  }
  assertExcludes(
    source,
    ["margin-block: -1.125rem", "transition: min-height"],
    "application.module.css",
  );
  return deepFreeze({
    namedSlotSelectors: true,
    selectedTargetPresentation: true,
    expandedNonOverlappingDropBoundaries: true,
    rowDropPositionPresentation: true,
    stableHoveredDropPresentation: true,
    stableGlobalDragGuidePresentation: true,
    stickyComponentTargetPresentation: true,
    slotlessTargetGuidePresentation: true,
    draggableComponentCardPresentation: true,
    separateComponentAddActionPresentation: true,
    managedDescendantSlotSelectors: 0,
  });
}

/** Applies the exact M09-T07 production source and ownership policy. */
export function verifyDesenAppNamedSlotAuthoringSourcePolicy(rawInput) {
  const keys = [
    "adapterSource",
    "applicationSource",
    "applicationCss",
    "authoringDataSource",
    "previewSource",
    "slotSource",
  ];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", `${key} must be exact source text.`);
    }
  }
  return deepFreeze({
    authoringData: inspectAuthoringData(input.authoringDataSource),
    slots: inspectSlotSource(input.slotSource),
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
    names[AUTHORING_DATA_TEST_PATH],
    EXPECTED_AUTHORING_DATA_TEST_NAMES,
    AUTHORING_DATA_TEST_PATH,
  );
  requireTestNames(names[SLOT_TEST_PATH], EXPECTED_SLOT_TEST_NAMES, SLOT_TEST_PATH);
  requireTestNames(names[PREVIEW_TEST_PATH], EXPECTED_PREVIEW_TEST_NAMES, PREVIEW_TEST_PATH);
  requireTestNames(names[ADAPTER_TEST_PATH], EXPECTED_ADAPTER_TEST_NAMES, ADAPTER_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );
  assertIncludes(
    sources.get(SLOT_TEST_PATH),
    [
      "translates a forward end boundary after removal",
      "keeps a backward boundary in pre-removal coordinates",
      "normalizes an adjacent forward boundary to a no-op",
      "required: true,\n          minItems: 1",
      "getOwnPropertyDescriptor",
      "descriptorReads",
      "1_024",
      "Array.from({ length: 1_025 }",
      "compatibility.accepted && !compatibility.changesSource",
      "removes a newly inserted nested subtree",
      "evaluateAuthoringNodeDeletion(REFERENCE_ROUTE, model, selection)",
      "applyAuthoringNodeDelete(",
      "deletes from a behavior-owned slot and retains its own empty slot key",
      "disables root deletion and deletion across the owning slot minimum",
      "deletes the final node from a 1,024-sibling slot within the bounded profile",
      "captures deletion selections as exact own data and rejects cross-route authority",
      '"stale capability", { capabilityId: EXACT_CAPABILITY }',
      '"stale display name", { displayName: "Renamed elsewhere" }',
      '"stale conditional state", { conditional: true }',
    ],
    "authoring-slots tests",
  );
  assertIncludes(
    sources.get(APPLICATION_TEST_PATH),
    [
      "Delete Alert layer · node.alert",
      "Deleted Alert layer · node.alert.",
      "expect(document.activeElement).toBe(layersTab)",
      "disables deletion for the surface root and a slot-minimum preflight without changing preview",
      "expect(deleteAttempt).not.toHaveBeenCalled()",
      "preserves the selected layer, preview, and focus when deletion is rejected",
      "expect(document.activeElement).toBe(deleteTitle)",
      "expect(reads).toBe(0)",
      "const alertCard = alert.closest(\"[data-component-card='true']\")",
      "expect((alert as HTMLButtonElement).draggable).toBe(false)",
      "expect(alertCard.draggable).toBe(true)",
      "expect(outsideDrop.defaultPrevented).toBe(true)",
      "expect(slotEdit).toHaveBeenCalledTimes(1)",
      'getAttribute("data-drop-hovered")',
      'getAttribute("data-drop-ready")',
      "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
      "expect(elementFromPoint).toHaveBeenCalledWith(20, 195)",
      "expect(cancelFrame).toHaveBeenCalledWith(2)",
      "No drop target selected",
      "Choose slot in Layers",
      "Choose a named slot in Layers, then return to Components.",
    ],
    "application tests",
  );
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:named-slots && node --test tests/desen-app-named-slot-authoring.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES,
    localCommandReceipts: {
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
    },
    semanticCoverage: [
      "PF_010_EFFECTIVE_MINIMUM",
      "ABSENT_VS_EMPTY_SLOT",
      "EXACT_ID_OR_CATEGORY_ACCEPTANCE",
      "EXPLICIT_EMPTY_ACCEPTANCE_REJECTS_ALL",
      "SOURCE_MINIMUM",
      "DESTINATION_MAXIMUM",
      "ABSENT_DESTINATION_MINIMUM",
      "PF_080_BOUNDARY_CONVERSION",
      "PUBLIC_STABLE_ID_INSERT",
      "PUBLIC_MOVE_AND_REORDER",
      "PUBLIC_NESTED_SUBTREE_DELETE",
      "BEHAVIOR_OWNED_DESTINATION",
      "BEHAVIOR_OWNED_DELETE_AND_EMPTY_SLOT_KEY",
      "EXACT_OWN_DATA_CAPTURE",
      "EXACT_DELETION_SELECTION_CAPTURE",
      "STALE_DELETION_IDENTITY_REJECTION",
      "DEFAULT_PROP_STAGING_BOUNDS",
      "INSERT_DRY_RUN_REVALIDATION",
      "MOVE_REORDER_DRY_RUN_REVALIDATION",
      "DELETE_DRY_RUN_REVALIDATION",
      "ROOT_AND_SOURCE_MINIMUM_DELETE_PREFLIGHT",
      "CYCLE_PREFLIGHT",
      "SAME_SLOT_NO_OP_SUPPRESSION",
      "MODEL_KEYED_EXACT_TARGET_ADMISSION_CACHE",
      "BOUNDARY_FINAL_INDEX_MATERIALIZATION",
      "ONE_THOUSAND_TWENTY_FIVE_CACHED_BOUNDARIES",
      "ONE_THOUSAND_TWENTY_FOUR_SIBLING_DELETE",
      "COMPONENT_PALETTE_RENDER_LIMIT_24",
      "ACTIVE_TAB_ONLY_AUTHORING_WORK",
      "EXPANDED_OVERLAPPING_DROP_BOUNDARIES",
      "STABLE_NESTED_DRAG_HOVER",
      "EXPLICIT_COMPONENT_DROP_TARGET_GUIDE",
      "DATA_TRANSFER_READS_ZERO",
      "CONTINUOUS_SOURCE_REVALIDATION",
      "ATOMIC_PUBLISHER_PREVIEW",
      "ATOMIC_PUBLISHER_DELETE_PREVIEW",
      "DELETION_FOCUS_MANAGEMENT",
      "APP_OWNED_DRAG_HINTS",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:named-slots"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App named-slot test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const expectedRootCommands = {
    "generate:desen-app-named-slot-authoring": `${prefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${prefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${prefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
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
    parentAuthenticatedInsideReader: true,
    publicDependencies,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_NAMED_SLOT_AUTHORING_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact frozen M09-T06 parent artifact changed.");
  }
  const artifact = parseJson(bytes, "frozen M09-T06 parent artifact");
  if (
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.publicEditorCoreNestedMutation !== true ||
    artifact.claim?.continuousSchemaRevalidation !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.inspectorOutsideManagedCapabilitySubtree !== true ||
    artifact.claim?.p08Status !== "NOT_PROVEN"
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T06 identity or retained claims drifted.");
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
    "frozen M09-T07 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T07 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T07 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-named-slot-authoring" ||
    artifact?.profile !== "desen.app.named-slot-authoring-proof.v1" ||
    artifact?.task !== "M09-T07" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact?.claim?.publicStableIdInsert !== true ||
    artifact?.claim?.publicCrossSlotMove !== true ||
    artifact?.claim?.publicSameSlotReorder !== true ||
    artifact?.claim?.publicNestedSubtreeDelete !== true ||
    artifact?.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.slotChromeOutsideManagedCapabilitySubtree !== true ||
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
      DESEN_APP_NAMED_SLOT_AUTHORING_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T07 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T07 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function authenticateStateBindingSuccessor(files) {
  const artifactBytes = files.get(STATE_BINDING_ARTIFACT_PATH);
  if (
    artifactBytes.byteLength !== STATE_BINDING_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== STATE_BINDING_ARTIFACT_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T08 artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, STATE_BINDING_ARTIFACT_PATH);
  if (
    artifact.task !== STATE_BINDING_ARTIFACT_PIN.task ||
    artifact.proofId !== STATE_BINDING_ARTIFACT_PIN.proofId ||
    artifact.profile !== STATE_BINDING_ARTIFACT_PIN.profile ||
    artifact.result !== STATE_BINDING_ARTIFACT_PIN.result ||
    artifact.claim?.surfaceLocalPrimitiveStateList !== true ||
    artifact.claim?.primitiveStateAddUpdateDelete !== true ||
    artifact.claim?.boundedConservativeUsageCount !== true ||
    artifact.claim?.directCompatibleLocalStatePropBinding !== true ||
    artifact.claim?.exactDirectBindingChange !== true ||
    artifact.claim?.exactDirectBindingDetachToInitial !== true ||
    artifact.claim?.runtimeAndAdvancedBindingReadOnly !== true ||
    artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact.claim?.retainedNamedSlotAuthoringUxCompatibility !== true ||
    artifact.claim?.eventActionEditingClaimed !== false ||
    artifact.claim?.designRunClaimed !== false ||
    artifact.claim?.persistenceClaimed !== false ||
    artifact.claim?.activationClaimed !== false ||
    artifact.claim?.browserE2eClaimed !== false
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T08 artifact identity or claims drifted.");
  }
  return deepFreeze({
    task: STATE_BINDING_ARTIFACT_PIN.task,
    artifact: STATE_BINDING_ARTIFACT_PIN,
    surfaceLocalPrimitiveStateEditing: true,
    boundedUsageCounts: true,
    exactCompatibleDirectLocalStateBindingChangeAndDetach: true,
    runtimeAndAdvancedBindingsReadOnly: true,
    atomicPublisherBackedPreview: true,
    retainedNamedSlotAuthoringUxCompatibility: true,
    eventActionEditingImplemented: false,
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

/** Builds detached deterministic M09-T07 named-slot authoring evidence. */
async function _buildFreshDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppNamedSlotAuthoringSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    slotSource: decodeUtf8(files.get(SLOT_SOURCE_PATH), SLOT_SOURCE_PATH),
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
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    task: "M09-T07",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      completeCatalogDeclaredSlotProjection: true,
      absentAndEmptySlotsRemainDistinct: true,
      pf010EffectiveMinimum: true,
      exactIdOrCategoryAcceptance: true,
      explicitEmptyAcceptanceRejectsAll: true,
      componentInsertionPreflight: true,
      nodeMoveAndReorderPreflight: true,
      nodeDeletionPreflight: true,
      invalidPlacementControlsDisabled: true,
      insertionPreflightRunsPublicMutationAndValidation: true,
      placementPreflightRunsPublicMutationAndValidation: true,
      deletionPreflightRunsPublicMutationAndValidation: true,
      cyclePreflight: true,
      sameSlotNoOpControlsDisabled: true,
      insertionAdmissionCachedPerModelAndExactTarget: true,
      placementAdmissionCachedPerModelAndExactTarget: true,
      cachedPlacementBaseMaterializesBoundaryFinalIndex: true,
      componentPaletteRenderLimit: 24,
      activeTabOnlyAuthoringWork: true,
      sourceMinimumEnforced: true,
      destinationMaximumEnforced: true,
      absentDestinationMinimumEnforced: true,
      publicStableIdInsert: true,
      publicCrossSlotMove: true,
      publicSameSlotReorder: true,
      publicNestedSubtreeDelete: true,
      pf080BoundaryConversion: true,
      nodeAndBehaviorOwnersSupported: true,
      stableIdentityPreserved: true,
      rootsAndCyclesFailClosed: true,
      rootDeletionDisabled: true,
      sourceMinimumDeletionDisabled: true,
      behaviorOwnedDeletePreservesEmptySlot: true,
      exactOwnDataRouteSelectionAndEditCapture: true,
      exactOwnDataDeletionSelectionCapture: true,
      validatedSourceSnapshotMutation: true,
      boundedDefaultPropStaging: true,
      continuousCompleteSourceRevalidation: true,
      failedEditPreservesCurrentDocument: true,
      failedDeletionPreservesCurrentDocument: true,
      appOwnedInertDragHints: true,
      browserDataTransferReadsZero: true,
      expandedDropReadyBoundaries: true,
      stableNestedDragHover: true,
      explicitComponentDropTargetGuide: true,
      keyboardPlacementControl: true,
      publisherSessionPreview: true,
      sourceAndPreviewCommitAtomically: true,
      deletionSourceAndPreviewCommitAtomically: true,
      deletionFocusManaged: true,
      slotChromeOutsideManagedCapabilitySubtree: true,
      persistenceClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
    },
    authority: {
      protocolProfiles: {
        slotSemantics: "PF-010",
        editorPositionSemantics: "PF-080",
        insertIndex: "existing destination boundary",
        moveIndex: "destination boundary before move",
        reorderIndex: "final position after selected child removal",
      },
      source,
    },
    application: {
      package: packageContract,
      mutationFlow: [
        "validator-admitted Catalog and Source projection",
        "exact route and named-slot selection reauthorization",
        "App-owned inert drag or keyboard placement intent",
        "Catalog acceptance and cardinality checks",
        "public Editor Core insert, move, reorder, or nested-subtree delete",
        "bounded Catalog default-prop staging for insert",
        "continuous complete-Source validation",
        "Publisher session-local Bundle",
        "atomic Source and exact adapter session replacement",
        "successful deletion clears stale selection and returns focus to Layers",
      ],
      ownership: {
        slotChrome: "Desen App sibling chrome",
        browserDragPayload: "inert non-authoritative hint",
        dropTargets: "expanded App-owned boundary and explicit Components target chrome",
        deletionControl: "App-owned exact-selection preflight outside managed capability subtree",
        managedCapabilitySubtree: "Runtime React adapters only",
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
      "M09-T08 is NOT_PROVEN: local-state and binding editing are not implemented.",
      "M09-T09 is NOT_PROVEN: event and closed-action editing are not implemented.",
      "M09-T10 is NOT_PROVEN: no Design/Run mode is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T14 is NOT_PROVEN: session preview is not control-plane publication or activation.",
      "P-08 remains NOT_PROVEN until the remaining visual authoring and browser-E2E owners pass.",
      "A component requiring its own materialized child slot is rejected; no private subtree transaction is invented.",
      "No private DOM, component geometry, hit testing, canvas picking, or managed-tree inspection is claimed.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

/** Authenticates frozen M09-T07 evidence and checks its live additive M09-T08 successor. */
export async function buildDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parent = authenticateParent(options.parentArtifactBytes ?? files.get(PARENT_ARTIFACT_PATH));
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const source = verifyDesenAppNamedSlotAuthoringSourcePolicy({
    authoringDataSource: decodeUtf8(files.get(AUTHORING_DATA_PATH), AUTHORING_DATA_PATH),
    slotSource: decodeUtf8(files.get(SLOT_SOURCE_PATH), SLOT_SOURCE_PATH),
    previewSource: decodeUtf8(files.get(PREVIEW_SOURCE_PATH), PREVIEW_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const successor = authenticateStateBindingSuccessor(files);
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(files);
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-named-slot-authoring",
    profile: "desen.app.named-slot-authoring-proof.v1",
    task: "M09-T07",
    result: "PASS",
    prerequisites: [parent],
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      completeCatalogDeclaredSlotProjection:
        frozen.artifact.claim.completeCatalogDeclaredSlotProjection,
      publicStableIdInsert: frozen.artifact.claim.publicStableIdInsert,
      publicCrossSlotMove: frozen.artifact.claim.publicCrossSlotMove,
      publicSameSlotReorder: frozen.artifact.claim.publicSameSlotReorder,
      publicNestedSubtreeDelete: frozen.artifact.claim.publicNestedSubtreeDelete,
      continuousCompleteSourceRevalidation:
        frozen.artifact.claim.continuousCompleteSourceRevalidation,
      sourceAndPreviewCommitAtomically: frozen.artifact.claim.sourceAndPreviewCommitAtomically,
      slotChromeOutsideManagedCapabilitySubtree:
        frozen.artifact.claim.slotChromeOutsideManagedCapabilitySubtree,
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
        STATE_BINDING_ARTIFACT_PATH,
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
    "Task: M09-T07",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "M09-T08: NOT_PROVEN",
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
    pureSlot: receipts.pureSlot.tests,
    focusedNamedSlots: receipts.focusedNamedSlots.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T07 bytes and the visible report digest. */
export async function verifyDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppNamedSlotAuthoringEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T07 artifact bytes differ from fresh evidence.");
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

/** Atomically writes exact deterministic M09-T07 proof bytes. */
export async function writeDesenAppNamedSlotAuthoringEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_NAMED_SLOT_AUTHORING_ARTIFACT_PATH,
  );
  const built = await buildDesenAppNamedSlotAuthoringEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T07 artifact write failed safely.", {
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
