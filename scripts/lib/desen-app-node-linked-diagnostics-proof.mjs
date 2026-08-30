import { Buffer } from "node:buffer";
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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-NODE-LINKED-DIAGNOSTICS.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const RUNTIME_DIAGNOSTICS_PARENT_PATH =
  "docs/proof/artifacts/runtime-react-0.1.0-reconciliation-diagnostics.json";
const CONTINUOUS_VALIDATION_PARENT_PATH =
  "docs/proof/artifacts/editor-core-0.1.0-continuous-validation.json";
const SELECTION_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-selection-overlay.json";
const SCHEMA_INSPECTOR_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-schema-inspector.json";
const STRUCTURED_INSPECTOR_PARENT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-structured-inspector.json";
const NAMED_SLOTS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const STATE_BINDINGS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const EVENT_ACTIONS_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
const MODES_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const FIXTURES_PARENT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const PERSISTENCE_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";

const SOURCE_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/src/authoring-diagnostics.ts",
  diagnosticsPanel: "apps/desen-app/src/diagnostics-panel.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  authoringInspector: "apps/desen-app/src/authoring-inspector.ts",
  authoringState: "apps/desen-app/src/authoring-state.ts",
  authoringEventActions: "apps/desen-app/src/authoring-event-actions.ts",
  authoringSlots: "apps/desen-app/src/authoring-slots.ts",
  persistence: "apps/desen-app/src/authoring-persistence.ts",
});

const TEST_PATHS = Object.freeze({
  authoringDiagnostics: "apps/desen-app/test/authoring-diagnostics.test.ts",
  diagnosticsPanel: "apps/desen-app/test/diagnostics-panel.test.tsx",
  authoringInspector: "apps/desen-app/test/authoring-inspector.test.ts",
  authoringState: "apps/desen-app/test/authoring-state.test.ts",
  authoringEventActions: "apps/desen-app/test/authoring-event-actions.test.ts",
  authoringSlots: "apps/desen-app/test/authoring-slots.test.ts",
  adapterCanvas: "apps/desen-app/test/adapter-canvas.test.tsx",
  application: "apps/desen-app/test/application.test.tsx",
  persistenceApplication: "apps/desen-app/test/persistence-application.test.tsx",
});

const FOCUSED_TEST_PATHS = Object.freeze(Object.values(TEST_PATHS));
const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/generate-desen-app-node-linked-diagnostics-proof.mjs",
  "scripts/verify-desen-app-node-linked-diagnostics.mjs",
  "tests/desen-app-node-linked-diagnostics.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(TEST_PATHS),
  RUNTIME_DIAGNOSTICS_PARENT_PATH,
  CONTINUOUS_VALIDATION_PARENT_PATH,
  SELECTION_PARENT_PATH,
  SCHEMA_INSPECTOR_PARENT_PATH,
  STRUCTURED_INSPECTOR_PARENT_PATH,
  NAMED_SLOTS_PARENT_PATH,
  STATE_BINDINGS_PARENT_PATH,
  EVENT_ACTIONS_PARENT_PATH,
  MODES_PARENT_PATH,
  FIXTURES_PARENT_PATH,
  PERSISTENCE_PARENT_PATH,
  ...PROOF_READER_PATHS,
]);
const T14_PUBLICATION_APPLICATION_TEST_PATH =
  "apps/desen-app/test/publication-application.test.tsx";
const T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT = Object.freeze({
  bytes: 24_485,
  sha256: "52e29b84745ff331556529612015b95b581bf3007118352ebad796ca9541e0e3",
});
const T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT = Object.freeze({
  bytes: 24_493,
  sha256: "5eba8a2b15cbcf992d0f04d0d7ad719c1a9fc42cdb66635ebc0eab679a221901",
});
const T14_SUCCESSOR_RECEIPT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "apps/desen-app/package.json",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-preview.ts",
  "apps/desen-app/src/authoring-publication.ts",
  "apps/desen-app/src/publication-controls.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-publication.test.ts",
  "apps/desen-app/test/publication-activation-integration.test.ts",
  T14_PUBLICATION_APPLICATION_TEST_PATH,
  "apps/desen-app/test/publication-controls.test.tsx",
  "packages/editor-web/package.json",
  "packages/editor-web/src/index.ts",
  "packages/editor-web/src/local-bundle-channel-publication.ts",
  "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
]);
const SELF_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-node-linked-diagnostics-proof.mjs",
  "tests/desen-app-node-linked-diagnostics.test.mjs",
]);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  ...SELF_RESEALED_PATHS,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([...TRACKED_PATHS, PUBLISH_ACTIVATION_ARTIFACT_PATH, ...T14_SUCCESSOR_RECEIPT_PATHS]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 29_208,
  sha256: "8ac4d81d9097e188860757c637673ff406ba9f82b8cd8f379f184ef85138e972",
});

const EXPECTED_TEST_DECLARATION_COUNTS = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: 7,
  [TEST_PATHS.diagnosticsPanel]: 4,
  [TEST_PATHS.authoringInspector]: 27,
  [TEST_PATHS.authoringState]: 13,
  [TEST_PATHS.authoringEventActions]: 13,
  [TEST_PATHS.authoringSlots]: 23,
  [TEST_PATHS.adapterCanvas]: 10,
  [TEST_PATHS.application]: 38,
  [TEST_PATHS.persistenceApplication]: 17,
});
const EXPECTED_TEST_CASE_COUNTS = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: 7,
  [TEST_PATHS.diagnosticsPanel]: 4,
  [TEST_PATHS.authoringInspector]: 27,
  [TEST_PATHS.authoringState]: 13,
  [TEST_PATHS.authoringEventActions]: 13,
  [TEST_PATHS.authoringSlots]: 28,
  [TEST_PATHS.adapterCanvas]: 10,
  [TEST_PATHS.application]: 42,
  [TEST_PATHS.persistenceApplication]: 17,
});
const REQUIRED_TEST_NAMES = Object.freeze({
  [TEST_PATHS.authoringDiagnostics]: Object.freeze([
    "creates links only from invalidSubjects and leaves code/message/pointer guesses visible but inert",
    "preserves every duplicate occurrence without guessing which runtime instance belongs to it",
    "rejects stale report or rendered route authority and inconsistent runtime kinds without a partial model",
    "copies obligation metadata through a closed shape and never retains executable extras",
  ]),
  [TEST_PATHS.diagnosticsPanel]: Object.freeze([
    "keeps every diagnostic in projector order, announces the count, and does not steal focus",
    "renders every explicitly mapped occurrence as a native selection button",
    "leaves identity-looking unmapped and out-of-route metadata readable but non-selectable",
  ]),
  [TEST_PATHS.authoringInspector]: Object.freeze([
    "rejects invalid enum and numeric values without mutating the current Source",
  ]),
  [TEST_PATHS.authoringState]: Object.freeze([
    "returns the frozen rejected-candidate report without exposing the candidate",
  ]),
  [TEST_PATHS.authoringEventActions]: Object.freeze([
    "returns the frozen rejected-candidate report without exposing the candidate",
  ]),
  [TEST_PATHS.authoringSlots]: Object.freeze([
    "keeps dry-run inert but returns the exact report when deletion creates a semantic failure",
    "disables inserts whose Catalog defaults fail schema or bounded transition admission",
  ]),
  [TEST_PATHS.adapterCanvas]: Object.freeze([
    "renders Source-identity selection chrome as a sibling outside the managed subtree",
  ]),
  [TEST_PATHS.application]: Object.freeze([
    "keeps bound props explicit while boolean and numeric edits fail or apply atomically",
    "switches modes accessibly while preserving selection, authoring views, and local drafts",
    "uses only the App-owned drag intent and ignores forged native transfer authority",
    "forgets an admitted gap after the pointer reaches the dragged layer's no-op position",
  ]),
  [TEST_PATHS.persistenceApplication]: Object.freeze([
    "keeps rejected-candidate diagnostics outside Source, dirty state, and Save requests",
  ]),
});

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact reviewed App cases in the nine-file M09-T13 focused suite. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES = 161;

/** Exact immutable proof receipts bounding the M09-T13 diagnostics authority. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M05-T05",
    proofId: null,
    path: RUNTIME_DIAGNOSTICS_PARENT_PATH,
    bytes: 19_234,
    sha256: "292731d7eff67d5c80bd0de0d0c940c9783e49efd34069c5c11cc9eb4264dbfb",
    profile: "desen-runtime-react-reconciliation-diagnostics-v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M08-T09",
    proofId: "editor-core-continuous-validation",
    path: CONTINUOUS_VALIDATION_PARENT_PATH,
    bytes: 40_099,
    sha256: "7739b5143685d613a678c6eca5480f27a5a303b176bf2bf4613a4d6917fe7e5a",
    profile: "desen.editor-core.continuous-validation-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T04",
    proofId: "desen-app-selection-overlay",
    path: SELECTION_PARENT_PATH,
    bytes: 11_997,
    sha256: "9a3805545ea49820c744fc07b9c3b0c2919b3e2fb524f9855df1cec9058901b1",
    profile: "desen.app.selection-overlay-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T05",
    proofId: "desen-app-schema-inspector",
    path: SCHEMA_INSPECTOR_PARENT_PATH,
    bytes: 22_998,
    sha256: "473ab3248ed7b7b4de0e558df47159a74c28c134b46569aa91130745fd69660b",
    profile: "desen.app.schema-inspector-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T06",
    proofId: "desen-app-structured-inspector",
    path: STRUCTURED_INSPECTOR_PARENT_PATH,
    bytes: 26_133,
    sha256: "6ea4eb3f51fdfc39eeca676d7ebafb145d66a9efdfa03af9c33a7aa39aa6aaec",
    profile: "desen.app.structured-inspector-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T07",
    proofId: "desen-app-named-slot-authoring",
    path: NAMED_SLOTS_PARENT_PATH,
    bytes: 24_830,
    sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
    profile: "desen.app.named-slot-authoring-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T08",
    proofId: "desen-app-state-binding-editor",
    path: STATE_BINDINGS_PARENT_PATH,
    bytes: 28_766,
    sha256: "b7298375cba4b82258d1c293ecb66c3ae6641408ae9f5753da121ac44fcf601a",
    profile: "desen.app.state-binding-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T09",
    proofId: "desen-app-event-action-editor",
    path: EVENT_ACTIONS_PARENT_PATH,
    bytes: 23_812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
    profile: "desen.app.event-action-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    path: MODES_PARENT_PATH,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T11",
    proofId: "desen-app-fixtures-scenarios-fidelity",
    path: FIXTURES_PARENT_PATH,
    bytes: 29_407,
    sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M09-T12",
    proofId: "desen-app-source-persistence",
    path: PERSISTENCE_PARENT_PATH,
    bytes: 27_053,
    sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
    profile: "desen.app.source-persistence-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T13 artifact. */
export const DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact validation, selection, mode, and persistence parents",
  "[mapping] proves only explicit context identity mappings create selectable targets",
  "[occurrences] preserves duplicate order and keeps unmapped diagnostics inert",
  "[fencing] rejects stale report, Catalog, route, and Runtime-kind authority",
  "[canvas] keeps the selectable invalid placeholder outside the managed Runtime subtree",
  "[mode] hides diagnostics in Run and never steals focus without explicit selection",
  "[obligations] exposes dynamic obligations only as inert visible metadata",
  "[persistence] keeps rejected diagnostics outside Source, dirty state, and Save requests",
  "[tests] retains exact nine-file 161-case focused and 24-file 339-case full evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects projector, panel, integration, test, and package weakening",
  "[verification] rejects parent, artifact, report, destination, and linked-path drift",
]);

/** Default destination for deterministic M09-T13 evidence. */
export const DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T13 evidence reader. */
export class DesenAppNodeLinkedDiagnosticsProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppNodeLinkedDiagnosticsProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppNodeLinkedDiagnosticsProofError(code, message, details);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (ArrayBuffer.isView(value)) return value;
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
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
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      fail("OPTIONS_INVALID", `${label} contains an unknown or symbol field.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      fail("OPTIONS_INVALID", `${label}.${key} must be enumerable own data.`);
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
    if (error instanceof DesenAppNodeLinkedDiagnosticsProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    files.set(
      relativePath,
      overrides.get(relativePath) ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, label) {
  const value = Buffer.from(bytes).toString("utf8");
  if (value.includes("\0") || !Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must be exact UTF-8 text.`);
  }
  return value;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    fail(code, `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) fail(code, `${label} lost required M09-T13 policy.`, { missing });
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden diagnostics authority.`, {
      present,
    });
  }
}

function assertOccurrenceCount(source, marker, expected, label) {
  const actual = source.split(marker).length - 1;
  if (actual !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} exact M09-T13 occurrence count drifted.`, {
      marker,
      expected,
      actual,
    });
  }
}

function parseTypeScript(source, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const scriptKind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function inspectImports(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath);
  const imports = [];
  const violations = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) violations.push("dynamic-import");
      if (
        ts.isIdentifier(node.expression) &&
        ["eval", "fetch", "require", "setInterval", "setTimeout"].includes(node.expression.text)
      ) {
        violations.push(`call:${node.expression.text}`);
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["EventSource", "Function", "WebSocket", "XMLHttpRequest"].includes(node.expression.text)
    ) {
      violations.push(`new:${node.expression.text}`);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (violations.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired executable diagnostics authority.`, {
      violations,
    });
  }
  return Object.freeze(imports);
}

function captureSourcePolicyInput(rawInput) {
  const keys = Object.keys(SOURCE_PATHS);
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  const captured = Object.create(null);
  for (const key of keys) {
    if (typeof input[key] !== "string") {
      fail("OPTIONS_INVALID", `source policy input.${key} must be UTF-8 text.`);
    }
    captured[key] = input[key];
  }
  return Object.freeze(captured);
}

/** Verifies the complete App-owned M09-T13 diagnostics source boundary. */
export function verifyDesenAppNodeLinkedDiagnosticsSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const imports = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(([, relativePath]) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"))
      .map(([key, relativePath]) => [key, inspectImports(input[key], relativePath)]),
  );

  assertIncludes(
    input.authoringDiagnostics,
    [
      'import { isJsonPointer, isSha256Digest } from "@desen/protocol"',
      "DesenEditorContinuousValidationReport",
      "DesenEditorInvalidSubjectMapping",
      "RuntimeReactDiagnosticIndex",
      "readonly diagnosticIndex: number",
      "readonly selectionKey: string",
      'readonly previewStatus: "materialized" | "invalid-placeholder"',
      'readonly linkStatus: "linked" | "outside-route" | "unmapped"',
      'readonly status: "rejected"',
      "report.documentFingerprint !== snapshot.documentFingerprint",
      "report.catalogSetFingerprint !== snapshot.catalogSetFingerprint",
      'return rejected("stale-validation-report")',
      'return rejected("stale-rendered-snapshot")',
      'return rejected("runtime-index-mismatch")',
      "report.invalidSubjects",
      "report.unmappedDiagnosticIndexes",
      "mapping.occurrencePointers.map",
      "mapping.subject.kind",
      "mapping.subject.id",
      "occurrenceSelectionKey(snapshot, index, mapping, occurrencePointer)",
      'linkStatus: "unmapped"',
      'linkStatus: "outside-route"',
      'linkStatus: "linked"',
      "runtimeNodeIdsBySourceNodeId",
      "runtimeNodeIdsByBehaviorId",
      "Object.freeze({ index, kind: obligation.kind, pointer: obligation.pointer, context })",
    ],
    SOURCE_PATHS.authoringDiagnostics,
  );
  assertExcludes(
    input.authoringDiagnostics,
    [
      "rendered.documentFingerprint",
      "diagnostic.code.includes",
      "diagnostic.message.includes",
      "diagnostic.pointer.includes",
      "obligation.execute",
      "onSelect:",
    ],
    SOURCE_PATHS.authoringDiagnostics,
  );
  assertOccurrenceCount(
    input.authoringDiagnostics,
    "report.invalidSubjects",
    2,
    SOURCE_PATHS.authoringDiagnostics,
  );

  assertIncludes(
    input.diagnosticsPanel,
    [
      'aria-label="Validation diagnostics"',
      'aria-live="polite"',
      'role="status"',
      "diagnostic.occurrences.map",
      "onSelect(occurrence.selectionKey)",
      'type="button"',
      "aria-current=",
      '"No Source target"',
      '"Outside this surface"',
      'aria-label="Deferred runtime checks"',
      'aria-label="Dismiss validation diagnostics"',
    ],
    SOURCE_PATHS.diagnosticsPanel,
  );
  assertExcludes(
    input.diagnosticsPanel,
    ["autoFocus", "dangerouslySetInnerHTML", "onClick={obligation"],
    SOURCE_PATHS.diagnosticsPanel,
  );

  assertIncludes(
    input.adapterCanvas,
    [
      'data-managed-capability-subtree="true"',
      'data-diagnostic-placeholder="source-identity"',
      "tabIndex={-1}",
      'role="status"',
      "projectAuthoringDiagnostics(",
      "diagnosticIndex: result.surface.diagnosticIndex",
      'mode === "design" && selectedDiagnostic !== undefined',
      "diagnosticPlaceholderRef.current?.focus({ preventScroll: true })",
      "</fieldset>",
      "<DiagnosticPlaceholderOverlay",
    ],
    SOURCE_PATHS.adapterCanvas,
  );
  assertOccurrenceCount(
    input.adapterCanvas,
    "<DiagnosticPlaceholderOverlay",
    1,
    SOURCE_PATHS.adapterCanvas,
  );

  assertIncludes(
    input.application,
    [
      "interface TransientAuthoringDiagnostics",
      "readonly ownerDocumentFingerprint: string",
      "readonly report: DesenEditorContinuousValidationReport",
      "readonly selectionKey: string",
      "const committedDocumentFingerprint = useMemo(() => digestCanonicalJson(document), [document])",
      "createDesenEditorContinuousValidator(preparedModel.model.validationCatalogs)",
      "transientDiagnostics.ownerDocumentFingerprint === committedDocumentFingerprint",
      "transientDiagnostics.snapshot.projectId === route.projectId",
      "transientDiagnostics.snapshot.surfaceId === route.surfaceId",
      "transientDiagnostics.snapshot.catalogSetFingerprint ===",
      "const report = result.ok ? undefined : result.validationReport",
      "documentFingerprint: report.documentFingerprint",
      "ownerDocumentFingerprint: committedDocumentFingerprint",
      "projectAuthoringDiagnostics(",
      "candidate.selectionKey === selectionKey",
      "setDiagnosticSelection(",
      "clearTransientDiagnostics()",
      'mode === "design" &&',
      'hidden={mode === "run"}',
      "<DiagnosticsPanel",
      "selectedSelectionKey: diagnosticSelection?.selectionKey ?? null",
      'data-component-drag-handle="true"',
      'data-layer-drag-handle="true"',
      "className={styles.slotBoundaryHitArea}",
      'data-slot-boundary-hit-area="true"',
      "onDragEnter={onBoundaryDragEnter}",
      "onDragOver={onBoundaryDragOver}",
      "onDrop={onBoundaryDrop}",
      "data-layer-drop-row-node-id={node.id}",
      'querySelector<HTMLElement>("[data-layer-drop-row-node-id]")',
      "onDrop={receiveComponentDrop}",
      'releaseAdmission.status === "rejected"',
      "interaction.dragSession.current.lastAcceptedProjection",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      "clientY < midpoint",
      '"Current position"',
      "pendingLayerFocus.current = result.nodeId",
      'setActiveTab("layers")',
      "Remove layer",
    ],
    SOURCE_PATHS.application,
  );
  assertExcludes(
    input.application,
    ["flushSync", "draggable={enabled}", "draggable={movable}"],
    SOURCE_PATHS.application,
  );
  assertOccurrenceCount(
    input.application,
    "captureEditDiagnostics(result);",
    6,
    SOURCE_PATHS.application,
  );
  for (const handler of [
    "onDragEnter={enterComponentDrop}",
    "onDragLeave={leaveComponentDrop}",
    "onDragOver={admitComponentDrop}",
    "onDrop={receiveComponentDrop}",
  ]) {
    assertOccurrenceCount(input.application, handler, 2, SOURCE_PATHS.application);
  }

  assertIncludes(
    input.inspectorPanel,
    ["readonly diagnosticsControls?: ReactNode", "{diagnosticsControls}"],
    SOURCE_PATHS.inspectorPanel,
  );
  for (const key of [
    "authoringInspector",
    "authoringState",
    "authoringEventActions",
    "authoringSlots",
  ]) {
    assertIncludes(
      input[key],
      [
        "readonly validationReport?: DesenEditorContinuousValidationReport",
        '"source-invalid"',
        "validationReport",
      ],
      SOURCE_PATHS[key],
    );
  }
  assertIncludes(
    input.authoringInspector,
    ['return Object.freeze({ ok: false, reason: "source-invalid", validationReport: report })'],
    SOURCE_PATHS.authoringInspector,
  );
  assertIncludes(
    input.authoringState,
    ['return failure("source-invalid", validationReport)'],
    SOURCE_PATHS.authoringState,
  );
  assertIncludes(
    input.authoringEventActions,
    ['return failure("source-invalid", validationReport)'],
    SOURCE_PATHS.authoringEventActions,
  );
  assertIncludes(
    input.authoringSlots,
    [
      'failure("source-invalid", validationReport)',
      'failure("defaults-invalid", validationReport)',
    ],
    SOURCE_PATHS.authoringSlots,
  );

  assertExcludes(
    input.persistence,
    ["TransientAuthoringDiagnostics", "AuthoringDiagnosticsViewModel", "validationReport"],
    SOURCE_PATHS.persistence,
  );
  assertIncludes(
    input.applicationCss,
    [
      ".diagnosticsPanel",
      ".diagnosticsTarget:focus-visible",
      '.diagnosticsTarget[aria-current="true"]',
      ".diagnosticPlaceholder",
      ".diagnosticPlaceholder:focus-visible",
      '.componentsView[data-component-drag-active="true"]',
      '.componentsView[data-drop-hovered="true"]',
      ".componentDragHandle",
      ".layerDragHandle::before",
      '.slotBoundary[data-drop-ready="true"]',
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;",
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;",
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
      '.slotBoundary[data-drop-noop-hovered="true"]::before',
      ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
      ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
      ".deleteLayerGlyph",
    ],
    SOURCE_PATHS.applicationCss,
  );
  assertExcludes(
    input.applicationCss,
    [
      '[data-drag-active="true"] .slotBoundary',
      "margin-block: -0.875rem",
      "transition: min-height 100ms ease",
    ],
    SOURCE_PATHS.applicationCss,
  );

  return deepFreeze({
    imports,
    explicitInvalidSubjectMappingOnly: true,
    diagnosticTextIdentityInference: false,
    duplicateOccurrenceOrderPreserved: true,
    unmappedDiagnosticsVisibleAndInert: true,
    candidateDocumentAndCatalogFingerprintsRequired: true,
    renderedRouteAndRuntimeKindFenced: true,
    committedOwnerFingerprintFencedByApplication: true,
    snapshotBoundSelectionKeyReadmittedByApplication: true,
    invalidPlaceholderOutsideManagedRuntimeSubtree: true,
    runModeDiagnosticsHidden: true,
    focusRequiresExplicitSelection: true,
    obligationsVisibleMetadataOnly: true,
    rejectedCandidateDiagnosticsOutsidePersistence: true,
    editAdaptersReturnFrozenValidationReport: true,
    dedicatedComponentDragHandle: true,
    dedicatedLayerDragHandle: true,
    componentPanelWideDropSurface: true,
    innermostNestedSlotOwnsPointer: true,
    stableInsertionLaneGeometry: true,
    rowHalfProjectionBroadensHitArea: true,
    noOpPlacementFeedbackVisible: true,
    releaseDriftRetainsLastAdmittedPlacement: true,
    insertedNodeFocusedInLayers: true,
    selectedInstanceRemovalDiscoverable: true,
  });
}

function unwrapExpression(node) {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function collectArrayDeclarations(sourceFile) {
  const declarations = new Map();
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      const value = unwrapExpression(node.initializer);
      if (ts.isArrayLiteralExpression(value))
        declarations.set(node.name.text, value.elements.length);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return declarations;
}

function arrayLength(node, declarations) {
  const value = unwrapExpression(node);
  if (ts.isArrayLiteralExpression(value)) return value.elements.length;
  if (ts.isIdentifier(value)) return declarations.get(value.text);
  return undefined;
}

function staticTestName(node) {
  const value = unwrapExpression(node);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  return undefined;
}

function isTestCall(node) {
  if (!ts.isCallExpression(node)) return false;
  if (ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
    return true;
  }
  if (!ts.isCallExpression(node.expression)) return false;
  const factory = node.expression;
  return (
    ts.isPropertyAccessExpression(factory.expression) &&
    ts.isIdentifier(factory.expression.expression) &&
    ["it", "test"].includes(factory.expression.expression.text) &&
    factory.expression.name.text === "each"
  );
}

function subtreeContainsTest(node) {
  let found = false;
  const visit = (candidate) => {
    if (found) return;
    if (isTestCall(candidate)) {
      found = true;
      return;
    }
    candidate.forEachChild(visit);
  };
  visit(node);
  return found;
}

function inspectTestFile(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath, "TEST_POLICY_VIOLATION");
  const arrays = collectArrayDeclarations(sourceFile);
  let declarations = 0;
  let cases = 0;
  const names = [];
  const visit = (node, multiplier = 1) => {
    if (ts.isForOfStatement(node) && subtreeContainsTest(node.statement)) {
      const length = arrayLength(node.expression, arrays);
      if (length === undefined || length === 0) {
        fail("TEST_POLICY_VIOLATION", `${relativePath} has an unbounded test loop.`);
      }
      visit(node.statement, multiplier * length);
      return;
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text)) {
        declarations += 1;
        cases += multiplier;
        const name =
          node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
        if (name !== undefined) names.push(name);
        return;
      }
      if (ts.isCallExpression(node.expression)) {
        const factory = node.expression;
        if (
          ts.isPropertyAccessExpression(factory.expression) &&
          ts.isIdentifier(factory.expression.expression) &&
          ["it", "test"].includes(factory.expression.expression.text) &&
          factory.expression.name.text === "each"
        ) {
          const length =
            factory.arguments[0] === undefined
              ? undefined
              : arrayLength(factory.arguments[0], arrays);
          if (length === undefined || length === 0) {
            fail("TEST_POLICY_VIOLATION", `${relativePath} has an unbounded each table.`);
          }
          declarations += 1;
          cases += multiplier * length;
          const name =
            node.arguments[0] === undefined ? undefined : staticTestName(node.arguments[0]);
          if (name !== undefined) names.push(name);
          return;
        }
      }
    }
    node.forEachChild((child) => visit(child, multiplier));
  };
  visit(sourceFile);
  return Object.freeze({ declarations, cases, names: Object.freeze(names) });
}

function inspectTests(files) {
  const inventories = Object.fromEntries(
    FOCUSED_TEST_PATHS.map((relativePath) => [
      relativePath,
      inspectTestFile(decodeUtf8(files.get(relativePath), relativePath), relativePath),
    ]),
  );
  for (const relativePath of FOCUSED_TEST_PATHS) {
    const inventory = inventories[relativePath];
    if (
      inventory.declarations !== EXPECTED_TEST_DECLARATION_COUNTS[relativePath] ||
      inventory.cases !== EXPECTED_TEST_CASE_COUNTS[relativePath]
    ) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} exact test inventory drifted.`, {
        actual: { declarations: inventory.declarations, cases: inventory.cases },
        expected: {
          declarations: EXPECTED_TEST_DECLARATION_COUNTS[relativePath],
          cases: EXPECTED_TEST_CASE_COUNTS[relativePath],
        },
      });
    }
    const missing = REQUIRED_TEST_NAMES[relativePath].filter(
      (name) => !inventory.names.includes(name),
    );
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required semantic tests.`, { missing });
    }
  }
  const focusedTestCases = FOCUSED_TEST_PATHS.reduce(
    (total, relativePath) => total + inventories[relativePath].cases,
    0,
  );
  if (focusedTestCases !== DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES) {
    fail("TEST_POLICY_VIOLATION", "The exact focused M09-T13 case count drifted.");
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:diagnostics && node --test tests/desen-app-node-linked-diagnostics.test.mjs",
    focusedFiles: FOCUSED_TEST_PATHS,
    testDeclarationCounts: Object.fromEntries(
      FOCUSED_TEST_PATHS.map((relativePath) => [
        relativePath,
        inventories[relativePath].declarations,
      ]),
    ),
    testCaseCounts: Object.fromEntries(
      FOCUSED_TEST_PATHS.map((relativePath) => [relativePath, inventories[relativePath].cases]),
    ),
    focusedTestCases,
    fullAppTestFiles: 24,
    fullAppTestCases: 339,
    rootTestNames: DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES,
    semanticCoverage: [
      "EXPLICIT_CONTEXT_IDENTITY_MAPPING",
      "NO_TEXT_OR_POINTER_IDENTITY_INFERENCE",
      "DUPLICATE_OCCURRENCE_ORDER",
      "UNMAPPED_VISIBLE_NON_LINKABLE",
      "REPORT_SNAPSHOT_CATALOG_ROUTE_RUNTIME_KIND_FENCES",
      "SNAPSHOT_BOUND_SELECTION_READMISSION",
      "APP_OWNED_PLACEHOLDER_OUTSIDE_RUNTIME_SUBTREE",
      "RUN_HIDDEN_NO_FOCUS_STEAL",
      "INERT_OBLIGATION_METADATA",
      "DIAGNOSTICS_OUTSIDE_SOURCE_DIRTY_AND_SAVE",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(
    files.get(ROOT_PACKAGE_PATH),
    ROOT_PACKAGE_PATH,
    "PACKAGE_POLICY_VIOLATION",
  );
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH, "PACKAGE_POLICY_VIOLATION");
  const appCommand =
    "vitest run test/authoring-diagnostics.test.ts test/diagnostics-panel.test.tsx test/authoring-inspector.test.ts test/authoring-state.test.ts test/authoring-event-actions.test.ts test/authoring-slots.test.ts test/adapter-canvas.test.tsx test/application.test.tsx test/persistence-application.test.tsx";
  if (app.name !== "@desen/app-web" || app.scripts?.["test:diagnostics"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact Desen App diagnostics command drifted.");
  }
  for (const dependency of ["@desen/editor-core", "@desen/protocol", "@desen/runtime-react"]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `Desen App lost ${dependency} diagnostics authority.`);
    }
  }
  const prefix =
    "pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:diagnostics && ";
  const expectedRootCommands = {
    "generate:desen-app-node-linked-diagnostics":
      prefix + "node scripts/generate-desen-app-node-linked-diagnostics-proof.mjs",
    "verify:desen-app-node-linked-diagnostics":
      prefix + "node scripts/verify-desen-app-node-linked-diagnostics.mjs",
    "test:desen-app-node-linked-diagnostics":
      prefix + "node --test tests/desen-app-node-linked-diagnostics.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    editorCoreDependency: "workspace:*",
    protocolDependency: "workspace:*",
    runtimeReactDependency: "workspace:*",
    rootPackageName: root.name,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`, "PARENT_DRIFT");
  if (
    artifact.task !== pin.task ||
    (artifact.proofId ?? null) !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    (pin.task === "M05-T05"
      ? artifact.claim?.boundedCallbackFreeImmutableDiagnosticIndex !== true
      : artifact.claim?.taskStatus !== "DONE")
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.task === "M05-T05" &&
    (artifact.claim?.liveSessionSubscriptionCommitOnly !== true ||
      artifact.claim?.boundedCallbackFreeImmutableDiagnosticIndex !== true ||
      artifact.diagnostics?.repeatedSourceIdentityOneToMany !== true ||
      artifact.diagnostics?.callbackFields !== 0)
  ) {
    fail("PARENT_DRIFT", "The frozen M05-T05 Runtime diagnostic-index authority drifted.");
  }
  if (
    pin.task === "M08-T09" &&
    (artifact.claim?.explicitSubjectInvalidNodeMapping !== true ||
      artifact.claim?.duplicateOccurrenceMapping !== true ||
      artifact.claim?.controlledUnmappedDiagnostics !== true ||
      artifact.claim?.completeAuthoringSensitiveDocumentFingerprint !== true ||
      artifact.claim?.orderSensitiveCatalogSetFingerprint !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M08-T09 continuous-validation authority drifted.");
  }
  if (
    pin.task === "M09-T04" &&
    (artifact.claim?.publicDiagnosticIndexOnly !== true ||
      artifact.claim?.repeatedRuntimeInstancesPreserved !== true ||
      artifact.claim?.selectionChromeOutsideManagedCapabilitySubtree !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T04 selection authority drifted.");
  }
  if (
    pin.task === "M09-T05" &&
    (artifact.claim?.continuousSchemaRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T05 schema Inspector authority drifted.");
  }
  if (
    pin.task === "M09-T06" &&
    (artifact.claim?.continuousSchemaRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T06 structured Inspector authority drifted.");
  }
  if (
    pin.task === "M09-T07" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedDeletionPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T07 named-slot authority drifted.");
  }
  if (
    pin.task === "M09-T08" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T08 state-binding authority drifted.");
  }
  if (
    pin.task === "M09-T09" &&
    (artifact.claim?.continuousCompleteSourceRevalidation !== true ||
      artifact.claim?.failedEditPreservesCurrentDocument !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T09 event/action authority drifted.");
  }
  if (
    pin.task === "M09-T10" &&
    (artifact.claim?.sameManagedCapabilitySubtreeOnToggle !== true ||
      artifact.claim?.accessibleModeControl !== true ||
      artifact.claim?.diagnosticsClaimed !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T10 mode authority drifted.");
  }
  if (
    pin.task === "M09-T11" &&
    (artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
      artifact.claim?.diagnosticsClaimed !== false ||
      artifact.claim?.operationInputOrPasswordRetained !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T11 fixtures/scenarios authority drifted.");
  }
  if (
    pin.task === "M09-T12" &&
    (artifact.claim?.authoredSourceOnly !== true ||
      artifact.claim?.completeAuthoredSourceCanonicalDirtyComparison !== true ||
      artifact.claim?.diagnosticsClaimed !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T12 persistence authority drifted.");
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
    "frozen M09-T13 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T13 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T13 proof artifact");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M09-T13" ||
    artifact.proofId !== "desen-app-node-linked-diagnostics" ||
    artifact.profile !== "desen.app.node-linked-diagnostics-proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableRejectedCandidateReport !== true ||
    artifact.claim?.explicitContextIdentityMappingOnly !== true ||
    artifact.claim?.diagnosticCodeMessagePointerIdentityInference !== false ||
    artifact.claim?.duplicateOccurrenceOrderPreserved !== true ||
    artifact.claim?.unmappedDiagnosticsSelectable !== false ||
    artifact.claim?.reportSnapshotDocumentFingerprintFenced !== true ||
    artifact.claim?.reportSnapshotCatalogFingerprintFenced !== true ||
    artifact.claim?.routeAndSurfaceFenced !== true ||
    artifact.claim?.runtimeKindMismatchFailsClosed !== true ||
    artifact.claim?.invalidPlaceholderInsideManagedRuntimeSubtree !== false ||
    artifact.claim?.runModeDiagnosticsVisible !== false ||
    artifact.claim?.automaticFocusSteal !== false ||
    artifact.claim?.obligationsExecutable !== false ||
    artifact.claim?.rejectedDiagnosticsPersisted !== false ||
    artifact.claim?.rejectedDiagnosticsAffectDirtyState !== false ||
    artifact.claim?.rejectedDiagnosticsIncludedInSave !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.p16Status !== "PROVEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
    artifact.claim?.pf089Status !== "OPEN" ||
    artifact.tests?.focusedTestCases !== DESEN_APP_NODE_LINKED_DIAGNOSTICS_FOCUSED_TEST_CASES ||
    artifact.tests?.fullAppTestFiles !== 24 ||
    artifact.tests?.fullAppTestCases !== 339 ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    artifact.boundary?.parentArtifacts !== 11 ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
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
    !isDeepStrictEqual(
      artifact.tests?.rootTestNames,
      DESEN_APP_NODE_LINKED_DIAGNOSTICS_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T13 identity or retained claims drifted.");
  }
  return deepFreeze({
    artifact,
    artifactBytes: Buffer.from(artifactBytes),
    artifactSha256: FROZEN_ARTIFACT_PIN.sha256,
  });
}

function assertRetainedHistoricalReceipts(frozenArtifact, files) {
  const receiptMap = new Map(
    frozenArtifact.boundary.trackedReceipts.map((candidate) => [candidate.path, candidate]),
  );
  for (const relativePath of RETAINED_HISTORICAL_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("BOUNDARY_DRIFT", `A retained M09-T13 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function isExactPublicationApplicationTimeoutSuccessor(bytes) {
  if (
    bytes.byteLength !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
    sha256(bytes) !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
  ) {
    return false;
  }
  const source = decodeUtf8(bytes, T14_PUBLICATION_APPLICATION_TEST_PATH);
  const liveClosing = "  }, 10_000);";
  if (source.split(liveClosing).length - 1 !== 1) return false;
  const frozenBytes = Buffer.from(source.replace(liveClosing, "  });"));
  if (
    frozenBytes.byteLength !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
    sha256(frozenBytes) !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
  ) {
    return false;
  }
  const sourceFile = parseTypeScript(source, T14_PUBLICATION_APPLICATION_TEST_PATH);
  let namedTestCalls = 0;
  let exactTimeoutCalls = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "it" &&
      node.arguments.length >= 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text ===
        "does not surface late replaced-port or unmounted settlements as current success"
    ) {
      namedTestCalls += 1;
      if (
        node.arguments.length === 3 &&
        ts.isNumericLiteral(node.arguments[2]) &&
        node.arguments[2].getText(sourceFile) === "10_000"
      ) {
        exactTimeoutCalls += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return namedTestCalls === 1 && exactTimeoutCalls === 1;
}

function authenticatePublishActivationSuccessor(files) {
  const pin = Object.freeze({
    task: "M09-T14",
    gate: "G09",
    proofId: "desen-app-publish-activation",
    profile: "desen.app.publish-activation-proof.v1",
    result: "PASS",
    path: PUBLISH_ACTIVATION_ARTIFACT_PATH,
    bytes: 24_763,
    sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  });
  const artifactBytes = files.get(PUBLISH_ACTIVATION_ARTIFACT_PATH);
  if (
    artifactBytes?.byteLength !== pin.bytes ||
    sha256(artifactBytes ?? Buffer.alloc(0)) !== pin.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The exact M09-T14/G09 publish-activation artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, PUBLISH_ACTIVATION_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.gate !== pin.gate ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.gateStatus !== "DONE" ||
    artifact.claim?.savedAuthoredSourceOnly !== true ||
    artifact.claim?.publisherRerunFromSavedSource !== true ||
    artifact.claim?.scenarioPreviewPublished !== false ||
    artifact.claim?.fixtureDataPublished !== false ||
    artifact.claim?.operationInputOrSecretPublished !== false ||
    artifact.claim?.rejectedDiagnosticsPublished !== false ||
    artifact.claim?.exactCanonicalBundleBytesStored !== true ||
    artifact.claim?.fixedPreviewChannelCompareAndSet !== true ||
    artifact.claim?.mutableChannelIsActivationAuthority !== false ||
    artifact.claim?.sourceGenerationDistinct !== true ||
    artifact.claim?.channelGenerationDistinct !== true ||
    artifact.claim?.durableActivationGenerationDistinct !== true ||
    artifact.claim?.activeRevisionRequiresReferenceHostReceipt !== true ||
    artifact.claim?.staleCompletionCanBecomeActive !== false ||
    artifact.claim?.blindRetryAfterIndeterminate !== false ||
    artifact.claim?.conflictActivatesCandidate !== false ||
    artifact.claim?.lastKnownGoodActivationPreserved !== true ||
    artifact.claim?.realPublicControlPlaneAndReferenceHostIntegration !== true ||
    artifact.claim?.browserAppImportsNodeCompositionPackages !== false ||
    artifact.claim?.publicationClaimed !== true ||
    artifact.claim?.activationClaimed !== true ||
    artifact.claim?.browserE2eClaimed !== false ||
    artifact.claim?.p08Status !== "NOT_PROVEN" ||
    artifact.claim?.pf085Status !== "OPEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
    artifact.claim?.pf089Status !== "OPEN" ||
    artifact.tests?.focusedTestDeclarations !== 45 ||
    artifact.tests?.rootTestNames?.length !== 12 ||
    artifact.tests?.realPublicIntegration !== true ||
    artifact.boundary?.trackedFiles !== 33 ||
    artifact.boundary?.parentArtifacts !== 9 ||
    trackedReceipts?.length !== 33 ||
    !isDeepStrictEqual(
      receiptPaths,
      [...receiptPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    )
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T14/G09 publish-activation identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T14_SUCCESSOR_RECEIPT_PATHS) {
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (relativePath === T14_PUBLICATION_APPLICATION_TEST_PATH) {
      if (
        receipt?.bytes !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        receipt.sha256 !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        bytes === undefined ||
        !isExactPublicationApplicationTimeoutSuccessor(bytes)
      ) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          `The exact live M09-T14 timeout successor drifted: ${relativePath}.`,
        );
      }
      continue;
    }
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T14 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    gate: pin.gate,
    artifact: pin,
    focusedTestDeclarations: 45,
    trackedFiles: 33,
    parentArtifacts: 9,
    rootTests: 12,
    savedAuthoredSourceOnly: true,
    publisherRerunFromSavedSource: true,
    scenarioPreviewPublished: false,
    fixtureDataPublished: false,
    operationInputOrSecretPublished: false,
    rejectedDiagnosticsPublished: false,
    exactCanonicalBundleBytesStored: true,
    fixedPreviewChannelCompareAndSet: true,
    mutableChannelIsActivationAuthority: false,
    distinctSourceChannelAndActivationGenerations: true,
    activeRevisionRequiresReferenceHostReceipt: true,
    staleCompletionCanBecomeActive: false,
    blindRetryAfterIndeterminate: false,
    conflictActivatesCandidate: false,
    lastKnownGoodActivationPreserved: true,
    realPublicControlPlaneAndReferenceHostIntegration: true,
    browserAppImportsNodeCompositionPackages: false,
    publicationClaimed: true,
    activationClaimed: true,
    browserE2eClaimed: false,
    p08Status: "NOT_PROVEN",
    pf085Status: "OPEN",
    pf086Status: "OPEN",
    pf089Status: "OPEN",
  });
}

/** Builds detached deterministic M09-T13 node-linked diagnostics evidence. */
export async function buildDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_NODE_LINKED_DIAGNOSTICS_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppNodeLinkedDiagnosticsSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const currentProjection = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    task: "M09-T13",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
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
      browserE2eClaimed: false,
      dedicatedComponentDragHandle: true,
      dedicatedLayerDragHandle: true,
      componentPanelWideDropSurface: true,
      innermostNestedSlotOwnsPointer: true,
      stableInsertionLaneGeometry: true,
      rowHalfProjectionBroadensHitArea: true,
      noOpPlacementFeedbackVisible: true,
      releaseDriftRetainsLastAdmittedPlacement: true,
      insertedNodeFocusedInLayers: true,
      selectedInstanceRemovalDiscoverable: true,
      p08Status: "NOT_PROVEN",
      p16Status: "PROVEN",
      pf086Status: "OPEN",
      pf089Status: "OPEN",
    },
    authority: {
      source,
      protocolProfiles: {
        report:
          "one immutable rejected-candidate continuous-validation report with exact document and Catalog fingerprints",
        mapping:
          "only Validator-owned invalidSubjects context identity; diagnostic text and pointers are display metadata",
        occurrence:
          "every explicit occurrence pointer retained in Validator order under one snapshot-bound selection key",
        runtime:
          "current public Runtime React diagnostic index admitted only for the current project and surface",
        placeholder:
          "App-owned focusable-on-request sibling outside the managed Runtime capability subtree",
        mode: "Design-only diagnostics presentation with no mount-authority change and no Run focus steal",
        obligations:
          "closed callback-free visible metadata with no resolver or execution authority",
        persistence:
          "transient rejected-candidate state excluded from committed Source, canonical dirty projection, and Save requests",
        authoringInteraction:
          "dedicated component and layer grips, one panel-wide authenticated append surface, innermost nested-slot pointer ownership, stable compact lanes with whole-row midpoint projection, explicit no-op feedback, and selected-instance removal discovery without widening mutation authority",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "capture the exact frozen validation report only from one rejected edit",
        "fence the candidate report by exact candidate document and Catalog fingerprints",
        "fence retained transient state by the last-known-good committed Source owner and current App route",
        "project links only from explicit invalidSubjects context identities",
        "retain every duplicate occurrence and leave unmapped or outside-route diagnostics non-linkable",
        "re-admit an opaque snapshot-bound selection key from the current projection",
        "use the public Runtime diagnostic index only to distinguish materialized identity from invalid placeholder",
        "render selected invalid diagnostics in App chrome outside the managed Runtime subtree",
        "hide diagnostics in Run and focus a placeholder only after an explicit current selection",
        "copy dynamic obligations into inert visible metadata without executing them",
        "clear transient diagnostics on every successful committed Source replacement",
        "start component drag only from its dedicated dotted grip and admit the complete Components panel for the highlighted target",
        "start layer drag only from its dedicated dotted grip, fence pointer ownership to the innermost named slot, and preserve the last admitted placement through release drift",
        "switch successful insertion to Layers, focus the new node, and expose Remove layer plus guarded keyboard deletion",
      ],
      ownership: {
        validationReport: "Editor Core continuous validator",
        targetMapping: "Validator invalidSubjects entries",
        selection: "Desen App snapshot-bound key re-admission",
        runtimeIdentity: "public Runtime React diagnostic index",
        placeholderAndPanel: "Desen App Design chrome",
        managedRuntimeSubtree: "unchanged Runtime React adapter boundary",
        persistenceAndDirtyState: "committed authored Source only",
        dragAndRemovalChrome: "Desen App-owned authoring interaction state outside Runtime",
      },
    },
    tests,
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: parents.length,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      focusedAppTestCases: tests.focusedTestCases,
      focusedAppTestCaseCountPinned: true,
      fullAppTestFiles: tests.fullAppTestFiles,
      fullAppTestCases: tests.fullAppTestCases,
      fullAppTestCaseCountPinned: true,
      finalCommandWiringPinned: true,
      historicalProofReadersTracked: false,
    },
    result: "PASS",
    nonclaims: [
      "M09-T13 proves only App-owned node-linked diagnostics for rejected local authoring candidates.",
      "Diagnostics do not mutate or replace the last-known-good committed Source or Runtime preview.",
      "Dynamic obligations remain visible metadata and do not grant Runtime execution authority.",
      "M09-T14 publication and activation remain NOT_PROVEN.",
      "A concrete App storage adapter and automated real-browser E2E remain NOT_PROVEN.",
      "P-16 is PROVEN for the selected Web–React profile; native diagnostic identity remains independently profiled.",
      "PF-086 remains OPEN because interoperable diagnostic-index and editor-subscription profiles are not defined.",
      "P-08 remains NOT_PROVEN; PF-089 remains OPEN.",
      "The retained authoring compatibility correction does not widen named-slot, cardinality, validator, or native-transfer authority.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-node-linked-diagnostics",
    profile: "desen.app.node-linked-diagnostics-proof.v1",
    task: "M09-T13",
    result: "PASS",
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      immutableRejectedCandidateReport: frozen.artifact.claim.immutableRejectedCandidateReport,
      explicitContextIdentityMappingOnly: frozen.artifact.claim.explicitContextIdentityMappingOnly,
      rejectedDiagnosticsPersisted: frozen.artifact.claim.rejectedDiagnosticsPersisted,
      publicationClaimed: frozen.artifact.claim.publicationClaimed,
      activationClaimed: frozen.artifact.claim.activationClaimed,
      p08Status: frozen.artifact.claim.p08Status,
      p16Status: frozen.artifact.claim.p16Status,
      pf086Status: frozen.artifact.claim.pf086Status,
      pf089Status: frozen.artifact.claim.pf089Status,
    },
    prerequisites: parents,
    source: currentProjection.authority.source,
    package: packageContract,
    tests,
    boundary: {
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentPathReceipts: receipts(files),
    },
    publishActivationSuccessor,
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
    "Task: M09-T13",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "P-16: PROVEN",
    "PF-086: OPEN",
    "PF-089: OPEN",
    "M09-T14: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T13 bytes and the visible report digest. */
export async function verifyDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppNodeLinkedDiagnosticsEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T13 artifact bytes differ from fresh evidence.");
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
    testDeclarationCounts: built.artifact.tests.testDeclarationCounts,
    testCaseCounts: built.artifact.tests.testCaseCounts,
    focusedTestCases: built.artifact.tests.focusedTestCases,
    fullAppTestFiles: built.artifact.tests.fullAppTestFiles,
    fullAppTestCases: built.artifact.tests.fullAppTestCases,
    p08Status: built.artifact.claim.p08Status,
    p16Status: built.artifact.claim.p16Status,
    pf086Status: built.artifact.claim.pf086Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T13 proof bytes. */
export async function writeDesenAppNodeLinkedDiagnosticsEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
  );
  const built = await buildDesenAppNodeLinkedDiagnosticsEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T13 artifact write failed safely.", {
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
