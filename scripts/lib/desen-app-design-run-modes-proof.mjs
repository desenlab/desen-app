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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-DESIGN-RUN-MODES.md";
const REAL_ADAPTER_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const STATE_BINDING_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-state-binding-editor.json";
const EVENT_ACTION_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-event-action-editor.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const INSPECTOR_PANEL_PATH = "apps/desen-app/src/inspector-panel.tsx";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-design-run-modes-proof.mjs",
  "scripts/generate-desen-app-design-run-modes-proof.mjs",
  "scripts/verify-desen-app-design-run-modes.mjs",
  "tests/desen-app-design-run-modes.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  APPLICATION_CSS_PATH,
  INSPECTOR_PANEL_PATH,
]);

const APP_TEST_PATHS = Object.freeze([ADAPTER_TEST_PATH, APPLICATION_TEST_PATH]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  CATALOG_PATH,
  SOURCE_FIXTURE_PATH,
  BUNDLE_FIXTURE_PATH,
  ...SOURCE_PATHS,
  ...APP_TEST_PATHS,
  REAL_ADAPTER_ARTIFACT_PATH,
  STATE_BINDING_ARTIFACT_PATH,
  EVENT_ACTION_ARTIFACT_PATH,
  ...PROOF_READER_PATHS,
]);

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "runs real adapter events on the same session and preserves state across mode changes",
]);

const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "switches modes accessibly while preserving selection, authoring views, and local drafts",
  "rejects stale hidden authoring callbacks while Run interactions leave Source unchanged",
  "resets the ephemeral mode to Design when a new surface route mounts",
]);

/** Exact immutable proof receipts that bound M09-T10 App authority. */
export const DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T03",
    proofId: "desen-app-real-adapter-canvas",
    path: REAL_ADAPTER_ARTIFACT_PATH,
    bytes: 73_111,
    sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
    profile: "desen.app.real-adapter-canvas-proof.v1",
    result: "PASS",
    immutable: true,
  }),
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
    task: "M09-T09",
    proofId: "desen-app-event-action-editor",
    path: EVENT_ACTION_ARTIFACT_PATH,
    bytes: 23_812,
    sha256: "0060ef39273ea36666f1701d5d3fa0f1610b95f40d88304ba980dcdc73cb29ab",
    profile: "desen.app.event-action-editor-proof.v1",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T10 artifact. */
export const DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact T03, T08, and T09 parents",
  "[session] proves one immutable Source and Bundle across both modes",
  "[lifecycle] proves mode is excluded from Runtime mount identity",
  "[design] proves interaction-disabled selection and authoring only",
  "[run] proves adapter event to Runtime state action and rerender",
  "[safety] proves revision stability, central guards, and denied host ports",
  "[tests] pins accessible mode behavior, exclusions, and package commands",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects weakened mode, lifecycle, execution, and authoring sources",
  "[verification] rejects parents, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T10 evidence. */
export const DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T10 evidence reader. */
export class DesenAppDesignRunModesProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppDesignRunModesProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppDesignRunModesProofError(code, message, details);
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
    if (error instanceof DesenAppDesignRunModesProofError) throw error;
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

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail(code, `${label} lost required event/action policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function unwrapParenthesizedExpression(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function exactObjectPropertyInitializers(rawNode, expectedNames, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isObjectLiteralExpression(node)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one exact object literal.`);
  }
  const actualNames = [];
  const properties = new Map();
  for (const property of node.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      properties.has(property.name.text)
    ) {
      fail("SOURCE_POLICY_VIOLATION", `${label} admits only unique named data properties.`);
    }
    actualNames.push(property.name.text);
    properties.set(property.name.text, property.initializer);
  }
  if (!isDeepStrictEqual(actualNames, expectedNames)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} field closure drifted.`, {
      actual: actualNames,
      expected: expectedNames,
    });
  }
  return properties;
}

function exactZeroArgumentArrow(rawNode, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (
    !ts.isArrowFunction(node) ||
    node.parameters.length !== 0 ||
    (node.modifiers?.length ?? 0) !== 0
  ) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one synchronous zero-argument arrow.`);
  }
  return node.body;
}

function assertExactIdentifier(rawNode, expected, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isIdentifier(node) || node.text !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} result drifted.`);
  }
}

function assertExactString(rawNode, expected, label) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (!ts.isStringLiteral(node) || node.text !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} result drifted.`);
  }
}

function assertExactStatusCallback(rawNode, status, label, withGeneration = false) {
  const result = exactZeroArgumentArrow(rawNode, label);
  const properties = exactObjectPropertyInitializers(
    result,
    withGeneration ? ["status", "generation"] : ["status"],
    `${label} result`,
  );
  assertExactString(properties.get("status"), status, `${label}.status`);
  if (withGeneration && properties.get("generation").kind !== ts.SyntaxKind.NullKeyword) {
    fail("SOURCE_POLICY_VIOLATION", `${label}.generation result drifted.`);
  }
}

function isExactRejectedEditResult(rawNode) {
  const node = unwrapParenthesizedExpression(rawNode);
  if (
    !ts.isCallExpression(node) ||
    node.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(node.expression) ||
    !ts.isIdentifier(node.expression.expression) ||
    node.expression.expression.text !== "Object" ||
    node.expression.name.text !== "freeze"
  ) {
    return false;
  }
  let properties;
  try {
    properties = exactObjectPropertyInitializers(
      node.arguments[0],
      ["ok", "reason"],
      "Run-mode rejected edit result",
    );
  } catch (error) {
    if (error instanceof DesenAppDesignRunModesProofError) return false;
    throw error;
  }
  return (
    unwrapParenthesizedExpression(properties.get("ok")).kind === ts.SyntaxKind.FalseKeyword &&
    ts.isStringLiteral(unwrapParenthesizedExpression(properties.get("reason"))) &&
    unwrapParenthesizedExpression(properties.get("reason")).text === "edit-rejected"
  );
}

function assertExactSnapshotGroup(rawNode, snapshotIdentifier, label) {
  const properties = exactObjectPropertyInitializers(rawNode, ["getSnapshot", "subscribe"], label);
  assertExactIdentifier(
    exactZeroArgumentArrow(properties.get("getSnapshot"), `${label}.getSnapshot`),
    snapshotIdentifier,
    `${label}.getSnapshot`,
  );
  const unsubscribe = exactZeroArgumentArrow(properties.get("subscribe"), `${label}.subscribe`);
  assertExactIdentifier(
    exactZeroArgumentArrow(unsubscribe, `${label}.subscribe result`),
    "undefined",
    `${label}.subscribe result`,
  );
}

function inspectRuntimeHostPorts(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const declarations = [];
  const calls = [];
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "ADAPTER_CANVAS_HOST_PORTS"
    ) {
      declarations.push(node);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createRuntimeHostPorts"
    ) {
      calls.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (
    declarations.length !== 1 ||
    calls.length !== 1 ||
    declarations[0].initializer !== calls[0] ||
    calls[0].arguments.length !== 1
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "adapter-canvas.tsx must retain one exact host-port declaration.",
    );
  }

  const argument = calls[0].arguments[0];
  if (
    !ts.isSatisfiesExpression(argument) ||
    argument.type.getText(sourceFile) !== "RuntimeHostPorts"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The host-port declaration must retain its RuntimeHostPorts closure.",
    );
  }
  const ports = exactObjectPropertyInitializers(
    argument.expression,
    [
      "navigation",
      "storage",
      "operations",
      "resources",
      "tokens",
      "context",
      "environment",
      "clock",
      "diagnostics",
    ],
    "ADAPTER_CANVAS_HOST_PORTS",
  );

  const navigation = exactObjectPropertyInitializers(
    ports.get("navigation"),
    ["navigate"],
    "hostPorts.navigation",
  );
  assertExactStatusCallback(navigation.get("navigate"), "denied", "hostPorts.navigation.navigate");

  const storage = exactObjectPropertyInitializers(
    ports.get("storage"),
    ["getBundle", "putBundle", "readActivation", "commitActivation"],
    "hostPorts.storage",
  );
  assertExactStatusCallback(storage.get("getBundle"), "missing", "hostPorts.storage.getBundle");
  assertExactStatusCallback(storage.get("putBundle"), "conflict", "hostPorts.storage.putBundle");
  assertExactStatusCallback(
    storage.get("readActivation"),
    "missing",
    "hostPorts.storage.readActivation",
  );
  assertExactStatusCallback(
    storage.get("commitActivation"),
    "conflict",
    "hostPorts.storage.commitActivation",
    true,
  );

  const operations = exactObjectPropertyInitializers(
    ports.get("operations"),
    ["invoke"],
    "hostPorts.operations",
  );
  assertExactStatusCallback(operations.get("invoke"), "denied", "hostPorts.operations.invoke");
  const resources = exactObjectPropertyInitializers(
    ports.get("resources"),
    ["load"],
    "hostPorts.resources",
  );
  assertExactStatusCallback(resources.get("load"), "denied", "hostPorts.resources.load");
  const tokens = exactObjectPropertyInitializers(
    ports.get("tokens"),
    ["resolve"],
    "hostPorts.tokens",
  );
  assertExactStatusCallback(tokens.get("resolve"), "missing", "hostPorts.tokens.resolve");

  assertExactSnapshotGroup(ports.get("context"), "EMPTY_RUNTIME_JSON", "hostPorts.context");
  assertExactSnapshotGroup(
    ports.get("environment"),
    "WEB_RUNTIME_ENVIRONMENT",
    "hostPorts.environment",
  );

  const clock = exactObjectPropertyInitializers(ports.get("clock"), ["now"], "hostPorts.clock");
  const clockResult = unwrapParenthesizedExpression(
    exactZeroArgumentArrow(clock.get("now"), "hostPorts.clock.now"),
  );
  if (!ts.isNumericLiteral(clockResult) || clockResult.text !== "1") {
    fail("SOURCE_POLICY_VIOLATION", "hostPorts.clock.now result drifted.");
  }
  const diagnostics = exactObjectPropertyInitializers(
    ports.get("diagnostics"),
    ["report"],
    "hostPorts.diagnostics",
  );
  assertExactIdentifier(
    exactZeroArgumentArrow(diagnostics.get("report"), "hostPorts.diagnostics.report"),
    "undefined",
    "hostPorts.diagnostics.report",
  );
}

function inspectRuntimeMountHostPorts(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const calls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "mountRuntimeHeadlessSession"
    ) {
      calls.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  const argument = calls[0]?.arguments[0];
  if (
    calls.length !== 1 ||
    calls[0].arguments.length !== 1 ||
    argument === undefined ||
    !ts.isObjectLiteralExpression(argument) ||
    argument.properties.length !== 3
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The Runtime mount must retain one exact Bundle/Catalog/host-port tuple.",
    );
  }
  const [bundle, catalogs, hostPorts] = argument.properties;
  if (
    !ts.isShorthandPropertyAssignment(bundle) ||
    bundle.name.text !== "bundle" ||
    !ts.isPropertyAssignment(catalogs) ||
    !ts.isIdentifier(catalogs.name) ||
    catalogs.name.text !== "catalogs" ||
    !ts.isArrayLiteralExpression(catalogs.initializer) ||
    catalogs.initializer.elements.length !== 1 ||
    !ts.isIdentifier(catalogs.initializer.elements[0]) ||
    catalogs.initializer.elements[0].text !== "referenceCatalog" ||
    !ts.isPropertyAssignment(hostPorts) ||
    !ts.isIdentifier(hostPorts.name) ||
    hostPorts.name.text !== "hostPorts" ||
    !ts.isIdentifier(hostPorts.initializer) ||
    hostPorts.initializer.text !== "ADAPTER_CANVAS_HOST_PORTS"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The Runtime mount must consume the exact closed ADAPTER_CANVAS_HOST_PORTS identifier.",
    );
  }
}

function inspectAdapterSource(source) {
  assertIncludes(
    source,
    [
      'export type DesenAdapterCanvasMode = "design" | "run"',
      'mode = "design"',
      "data-adapter-canvas-mode={mode}",
      'data-adapter-interactions={mode === "run" ? "enabled" : "disabled"}',
      'disabled={mode === "design"}',
      '{mode === "design" ? <SelectionOverlay projection={projection} /> : null}',
      "Run preview · real adapter controls are enabled; external effects remain denied.",
      "mountRuntimeHeadlessSession({",
      "hostPorts: ADAPTER_CANVAS_HOST_PORTS",
      "<RuntimeReactSurfaceBoundary",
      "useRuntimeReactSurface(input)",
      'navigation: { navigate: () => ({ status: "denied" }) }',
      'operations: { invoke: () => ({ status: "denied" }) }',
      'resources: { load: () => ({ status: "denied" }) }',
      'getBundle: () => ({ status: "missing" })',
      'putBundle: () => ({ status: "conflict" })',
      'commitActivation: () => ({ status: "conflict", generation: null })',
    ],
    "adapter-canvas.tsx",
  );
  assertExcludes(
    source,
    [
      "window.fetch",
      "globalThis.fetch",
      "localStorage",
      "sessionStorage",
      "@desen/runtime-core/src",
      "@desen/runtime-react/src",
    ],
    "adapter-canvas.tsx",
  );
  inspectRuntimeMountIdentity(source);
  inspectRuntimeHostPorts(source);
  inspectRuntimeMountHostPorts(source);
  return deepFreeze({
    modes: ["design", "run"],
    designDefault: true,
    oneRuntimeSessionAcrossModeToggle: true,
    modeExcludedFromMountEffectIdentity: true,
    sameManagedCapabilitySubtree: true,
    designControlsDisabled: true,
    designSelectionOverlayOnly: true,
    runAdapterInteractionsEnabled: true,
    exactPublicRuntimeReactBoundary: true,
    hostPortsDeniedOrInert: true,
    externalEffectsDenied: true,
  });
}

function inspectRuntimeMountIdentity(source) {
  const sourceFile = parseTypeScript(source, ADAPTER_SOURCE_PATH);
  const mountEffects = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useEffect" &&
      node.arguments.length === 2 &&
      ts.isArrowFunction(node.arguments[0]) &&
      node.arguments[0].getText(sourceFile).includes("mountRuntimeHeadlessSession")
    ) {
      mountEffects.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (mountEffects.length !== 1) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "adapter-canvas.tsx must retain exactly one Runtime-mount effect.",
    );
  }
  const dependencies = mountEffects[0].arguments[1];
  if (!ts.isArrayLiteralExpression(dependencies)) {
    fail("SOURCE_POLICY_VIOLATION", "The Runtime-mount effect needs an explicit dependency list.");
  }
  const names = dependencies.elements.map((element) => element.getText(sourceFile));
  if (
    names.includes("mode") ||
    names.includes("selection") ||
    names.length !== 4 ||
    !["bundle", "previewRevision", "routeIdentity", "supported"].every((name) =>
      names.includes(name),
    )
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Mode or authoring state entered Runtime mount identity.", {
      dependencies: names,
    });
  }
}

function inspectApplicationSource(source) {
  assertIncludes(
    source,
    [
      'type SurfaceEditorMode = "design" | "run"',
      'useState<SurfaceEditorMode>("design")',
      'const modeRef = useRef<SurfaceEditorMode>("design")',
      "function isDesignMode()",
      'modeRef.current === "design"',
      'role="group"',
      'aria-label="Design and Run mode"',
      'aria-pressed={mode === "design"}',
      'aria-pressed={mode === "run"}',
      "data-mode={mode}",
      "mode={mode}",
      'selection={mode === "design" ? selection : null}',
      'interactive={mode === "design"}',
      "Object.freeze({ document: result.document, preview: nextPreview })",
    ],
    "application.tsx",
  );
  assertExcludes(
    source,
    [
      "@desen/runtime-core/src",
      "@desen/runtime-react/src",
      "@desen/editor-core/src",
      "@desen/publisher/src",
      "localStorage",
      "sessionStorage",
      "window.fetch",
    ],
    "application.tsx",
  );
  inspectCentralAuthoringGuards(source);
  inspectModeToggleFlow(source);
  return deepFreeze({
    modeState: "App-owned closed union",
    oneImmutableAuthoringSession: true,
    sameDocumentAndPreviewAcrossToggle: true,
    exactBundleRevisionUnchanged: true,
    exactSourceRevisionUnchanged: true,
    centralRunModeAuthoringGuards: true,
    runSelectionSuppressed: true,
    runPanelsMountedButNoninteractive: true,
    accessiblePressedModeControl: true,
    liveSafetyStatus: true,
  });
}

function inspectModeToggleFlow(source) {
  const sourceFile = parseTypeScript(source, APPLICATION_SOURCE_PATH);
  const matches = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "chooseMode" &&
      node.body !== undefined
    ) {
      matches.push(node.body.getText(sourceFile));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (matches.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", "application.tsx must retain exactly one mode transition.");
  }
  assertIncludes(
    matches[0],
    ["modeRef.current = nextMode", "setMode(nextMode)", ".current?.focus()"],
    "chooseMode",
  );
  assertExcludes(
    matches[0],
    [
      "setAuthoringSession",
      "setSelection",
      "prepareAuthoringPreviewBundle",
      "mountRuntimeHeadlessSession",
    ],
    "chooseMode",
  );
}

function inspectCentralAuthoringGuards(source) {
  const sourceFile = parseTypeScript(source, APPLICATION_SOURCE_PATH);
  inspectDesignModePredicate(sourceFile);
  const expectedNames = [
    "toggleSelection",
    "editSelectedProperty",
    "editSelectedBinding",
    "editLocalState",
    "editSelectedEventAction",
    "editNamedSlot",
    "deleteSelectedLayer",
  ];
  const guardedFunctions = new Map(expectedNames.map((name) => [name, []]));
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name !== undefined &&
      expectedNames.includes(node.name.text) &&
      node.body !== undefined
    ) {
      guardedFunctions.get(node.name.text).push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  for (const name of expectedNames) {
    const declarations = guardedFunctions.get(name);
    if (declarations.length !== 1) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "application.tsx lost the exact central Run-mode authoring guard coverage.",
        { function: name, declarations: declarations.length },
      );
    }
    const effectiveStatements = declarations[0].body.statements.filter(
      (statement) =>
        !ts.isEmptyStatement(statement) &&
        !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)),
    );
    const guard = effectiveStatements[0];
    if (
      guard === undefined ||
      !ts.isIfStatement(guard) ||
      guard.elseStatement !== undefined ||
      !ts.isPrefixUnaryExpression(guard.expression) ||
      guard.expression.operator !== ts.SyntaxKind.ExclamationToken ||
      !ts.isCallExpression(guard.expression.operand) ||
      guard.expression.operand.arguments.length !== 0 ||
      !ts.isIdentifier(guard.expression.operand.expression) ||
      guard.expression.operand.expression.text !== "isDesignMode"
    ) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `The ${name} Design guard must be its first effective statement.`,
      );
    }
    const consequent = ts.isBlock(guard.thenStatement)
      ? guard.thenStatement.statements.length === 1
        ? guard.thenStatement.statements[0]
        : undefined
      : guard.thenStatement;
    if (consequent === undefined || !ts.isReturnStatement(consequent)) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `The ${name} Design guard must directly return before authoring work.`,
      );
    }
    if (name === "toggleSelection") {
      if (consequent.expression !== undefined) {
        fail("SOURCE_POLICY_VIOLATION", "toggleSelection must return inertly in Run mode.");
      }
    } else if (
      consequent.expression === undefined ||
      !isExactRejectedEditResult(consequent.expression)
    ) {
      fail("SOURCE_POLICY_VIOLATION", `${name} must return the exact rejected edit result.`);
    }
  }
}

function inspectDesignModePredicate(sourceFile) {
  const declarations = [];
  const visit = (node) => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "isDesignMode" &&
      node.body !== undefined
    ) {
      declarations.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  const declaration = declarations[0];
  const statements = declaration?.body?.statements.filter(
    (statement) =>
      !ts.isEmptyStatement(statement) &&
      !(ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)),
  );
  const result = statements?.[0];
  const expression =
    result !== undefined && ts.isReturnStatement(result) ? result.expression : undefined;
  if (
    declarations.length !== 1 ||
    declaration.parameters.length !== 0 ||
    declaration.asteriskToken !== undefined ||
    (declaration.modifiers?.length ?? 0) !== 0 ||
    declaration.type?.kind !== ts.SyntaxKind.BooleanKeyword ||
    statements.length !== 1 ||
    expression === undefined ||
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
    !ts.isPropertyAccessExpression(expression.left) ||
    !ts.isIdentifier(expression.left.expression) ||
    expression.left.expression.text !== "modeRef" ||
    expression.left.name.text !== "current" ||
    !ts.isStringLiteral(expression.right) ||
    expression.right.text !== "design"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      'isDesignMode must remain exactly `return modeRef.current === "design"`.',
    );
  }
}

function inspectInspectorSource(source) {
  assertIncludes(
    source,
    [
      "readonly hidden?: boolean | undefined",
      "hidden = false",
      "hidden={hidden}",
      "data-preserve-inspector-draft='true'",
    ],
    "inspector-panel.tsx",
  );
  assertExcludes(source, ["@desen/runtime-core", "@desen/runtime-react"], "inspector-panel.tsx");
  return deepFreeze({
    hiddenAdmissionExplicit: true,
    runMutationControlsUnreachable: true,
    modeTogglePreservesUnappliedDraft: true,
    remainsAppOwnedChrome: true,
  });
}

function inspectCssSource(source) {
  assertIncludes(
    source,
    [".modeControl {", ".modeSafety {", '.surfaceFrame[data-mode="run"] {'],
    "application.module.css",
  );
  assertExcludes(source, ["pointer-events: auto !important"], "application.module.css");
  return deepFreeze({
    visibleModeControl: true,
    explicitRunPresentation: true,
    noManagedCapabilityTreeOwnership: true,
  });
}

/** Verifies exact source-policy markers without retaining caller-owned source text. */
export function verifyDesenAppDesignRunModesSourcePolicy(rawInput) {
  const keys = ["adapterSource", "applicationCss", "applicationSource", "inspectorSource"];
  const input = exactOwnDataOptions(rawInput, keys, "source policy input");
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].includes("\0")) {
      fail("SOURCE_POLICY_VIOLATION", key + " must be exact source text.");
    }
  }
  return deepFreeze({
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    inspector: inspectInspectorSource(input.inspectorSource),
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
  requireTestNames(names[ADAPTER_TEST_PATH], EXPECTED_ADAPTER_TEST_NAMES, ADAPTER_TEST_PATH);
  requireTestNames(
    names[APPLICATION_TEST_PATH],
    EXPECTED_APPLICATION_TEST_NAMES,
    APPLICATION_TEST_PATH,
  );

  const adapterModeTest = namedTestBody(
    sources.get(ADAPTER_TEST_PATH),
    ADAPTER_TEST_PATH,
    EXPECTED_ADAPTER_TEST_NAMES[0],
  );
  assertIncludes(
    adapterModeTest,
    [
      "expect(runCanvas).toBe(designCanvas)",
      "managedSubtree",
      "expect(lifecycle.mounted).toEqual([session])",
      "expect(lifecycle.disposed).toHaveLength(0)",
      'fireEvent.change(email, { target: { value: "run-mode@example.test" } })',
      '"value",\n      "run-mode@example.test"',
      'mode="run"',
      'mode="design"',
    ],
    "adapter Design/Run test",
    "TEST_POLICY_VIOLATION",
  );

  const applicationSource = sources.get(APPLICATION_TEST_PATH);
  const accessibleModeTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[0],
  );
  assertIncludes(
    accessibleModeTest,
    [
      'getByRole("group", { name: "Design and Run mode" })',
      'getByRole("button", { name: "Run" })',
      'getByRole("button", { name: "Design" })',
      "expect(document.activeElement).toBe(runButton)",
      "expect((authoring as HTMLElement).hidden).toBe(true)",
      "expect((inspector as HTMLElement).hidden).toBe(true)",
      'componentSearch.value).toBe("feedback")',
      'value,\n    ).toBe("Unapplied design hint")',
      'placeholder,\n    ).toBe("Work email")',
    ],
    "accessible application Design/Run test",
    "TEST_POLICY_VIOLATION",
  );
  const runGuardTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[1],
  );
  assertIncludes(
    runGuardTest,
    [
      "const preflightCountInRun = previewPreflight.mock.calls.length",
      "fireEvent.click(staleApply)",
      "fireEvent.click(staleDelete)",
      "toHaveBeenCalledTimes(preflightCountInRun)",
      'fireEvent.change(liveEmail, { target: { value: "runtime@example.com" } })',
      'placeholder,\n    ).toBe("")',
    ],
    "application Run guard test",
    "TEST_POLICY_VIOLATION",
  );
  const routeResetTest = namedTestBody(
    applicationSource,
    APPLICATION_TEST_PATH,
    EXPECTED_APPLICATION_TEST_NAMES[2],
  );
  assertIncludes(
    routeResetTest,
    [
      'fireEvent.click(screen.getByRole("button", { name: "Run" }))',
      'window.location.pathname).toBe("/projects/account-app/surfaces/recovery")',
      'getByRole("button", { name: "Design" }).getAttribute("aria-pressed")',
    ],
    "application route reset test",
    "TEST_POLICY_VIOLATION",
  );

  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:design-run && node --test tests/desen-app-design-run-modes.test.mjs",
    appTestNames: names,
    rootTestNames: DESEN_APP_DESIGN_RUN_MODES_ROOT_TEST_NAMES,
    localCommandReceipts: {
      adapter: {
        command: "pnpm --filter @desen/app-web exec vitest run test/adapter-canvas.test.tsx",
        result: "PASS",
        testFiles: 1,
        tests: 9,
      },
      application: {
        command: "pnpm --filter @desen/app-web exec vitest run test/application.test.tsx",
        result: "PASS",
        testFiles: 1,
        tests: 35,
      },
      focusedDesignRun: {
        command: "pnpm --filter @desen/app-web test:design-run",
        result: "PASS",
        testFiles: 2,
        tests: 44,
      },
      fullApp: {
        command: "pnpm --filter @desen/app-web test",
        result: "PASS",
        testFiles: 15,
        tests: 210,
      },
      rootProof: {
        command: "node --test tests/desen-app-design-run-modes.test.mjs",
        result: "PASS",
        testFiles: 1,
        tests: 10,
      },
    },
    semanticCoverage: [
      "ONE_IMMUTABLE_SOURCE_AND_BUNDLE_SESSION",
      "MODE_EXCLUDED_FROM_RUNTIME_MOUNT_IDENTITY",
      "ZERO_REMOUNT_OR_DISPOSE_ON_TOGGLE",
      "SAME_MANAGED_CAPABILITY_SUBTREE",
      "DESIGN_INTERACTIONS_DISABLED_AND_SELECTION_ONLY",
      "RUN_ADAPTER_EVENT_TO_RUNTIME_STATE_SET_RERENDER",
      "SOURCE_AND_BUNDLE_REVISION_STABLE",
      "CENTRAL_RUN_AUTHORING_GUARDS",
      "ALL_EXTERNAL_HOST_PORTS_DENIED_OR_INERT",
      "ACCESSIBLE_DESIGN_RUN_CONTROL",
      "FIXTURE_PERSISTENCE_DIAGNOSTICS_PUBLICATION_E2E_EXCLUDED",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand = "vitest run test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.scripts?.["test:design-run"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App Design/Run test command drifted.");
  }
  const prefix =
    "node scripts/verify-desen-app-real-adapter-canvas.mjs && node scripts/verify-desen-app-state-binding-editor.mjs && node scripts/verify-desen-app-event-action-editor.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:design-run && ";
  const expectedRootCommands = {
    "generate:desen-app-design-run-modes":
      prefix + "node scripts/generate-desen-app-design-run-modes-proof.mjs",
    "verify:desen-app-design-run-modes":
      prefix + "node scripts/verify-desen-app-design-run-modes.mjs",
    "test:desen-app-design-run-modes":
      prefix + "node --test tests/desen-app-design-run-modes.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", "The exact " + name + " command drifted.");
    }
  }
  for (const dependency of [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/runtime-core",
    "@desen/runtime-react",
    "@desen/validator",
  ]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", "The App lost public dependency " + dependency + ".");
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
    pin.proofId === "desen-app-real-adapter-canvas" &&
    (artifact.claim?.exactOfficialBundleMounted !== true ||
      artifact.claim?.exactPublicRuntimeReactRendererUsed !== true ||
      artifact.claim?.managedCompositionRegistryOnly !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T03 Runtime canvas authority claims drifted.");
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
    pin.proofId === "desen-app-event-action-editor" &&
    (artifact.claim?.closedActionTypes?.includes("state.set") !== true ||
      artifact.claim?.sourceAndPreviewCommitAtomically !== true ||
      artifact.claim?.publicEditorCoreEventActionMutation !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T09 event/action authority claims drifted.");
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

/** Builds detached deterministic M09-T10 Design/Run evidence. */
export async function buildDesenAppDesignRunModesEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parents = DESEN_APP_DESIGN_RUN_MODES_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppDesignRunModesSourcePolicy({
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_PANEL_PATH), INSPECTOR_PANEL_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-design-run-modes",
    profile: "desen.app.design-run-modes-proof.v1",
    task: "M09-T10",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      oneImmutableSourceAndBundleSession: true,
      modeExcludedFromRuntimeMountIdentity: true,
      zeroRuntimeRemountOrDisposeOnToggle: true,
      sameManagedCapabilitySubtreeOnToggle: true,
      designControlsDisabled: true,
      designSelectionAndAuthoringOnly: true,
      runAdapterEventToRuntimeStateSet: true,
      runStateSetRerendersAdapter: true,
      sourceRevisionUnchangedOnToggle: true,
      bundleRevisionUnchangedOnToggle: true,
      centralAuthoringGuardsInRun: true,
      allExternalHostPortsDeniedOrInert: true,
      accessibleModeControl: true,
      fixturesAndScenariosClaimed: false,
      persistenceClaimed: false,
      diagnosticsClaimed: false,
      publicationClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      p09Status: "PARTIAL",
      pf025Status: "OPEN",
      pf028Status: "OPEN",
      pf083Status: "OPEN",
    },
    authority: {
      protocolProfiles: {
        design: "App selection and authoring chrome; Runtime controls disabled",
        run: "exact public adapter event through Runtime React/Core action execution",
        session: "one immutable {document, preview} with the same Source and Bundle revision",
        lifecycle: "mode excluded from Runtime mount-effect identity",
        hostPorts: "navigation, operations, resources denied; storage/tokens missing or conflict",
      },
      source,
    },
    application: {
      package: packageContract,
      modeFlow: [
        "one App-owned closed Design/Run state",
        "same immutable authoring Source and Publisher Bundle session",
        "mode excluded from Runtime session mount identity",
        "Design disables managed controls and admits selection/authoring",
        "Run suppresses selection and centrally rejects authoring",
        "Run adapter event enters Runtime React then Runtime Core",
        "closed state.set action updates Runtime local state",
        "Runtime React rerenders the same managed capability subtree",
      ],
      ownership: {
        modeControl: "Desen App sibling chrome",
        selectionOverlay: "Design-only App sibling chrome",
        managedCapabilitySubtree: "exact Runtime React adapter output",
        execution: "Runtime Core through public Runtime React bridge",
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
      "M09-T10 proves only the controlled sign-in Design/Run slice on one in-memory session.",
      "Fixtures and scenarios remain M09-T11; no operation fixture or scenario orchestration is claimed.",
      "M09-T12 is NOT_PROVEN: no save/open or durable persistence UI is claimed.",
      "M09-T13 is NOT_PROVEN: no node-linked diagnostics navigation or placeholder UI is claimed.",
      "M09-T14 is NOT_PROVEN: no control-plane publication or channel activation is claimed.",
      "G09 and real-browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN until persistence, publication, and browser-E2E owners pass.",
      "P-09 is PARTIAL: state.set is exercised; operation lifecycle remains a later owner.",
      "PF-025, PF-028, and PF-083 remain OPEN; Design/Run presentation does not provide operation fixtures or amend protocol vocabulary.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH);
  for (const required of [
    "Task: M09-T10",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "PF-025: OPEN",
    "PF-028: OPEN",
    "PF-083: OPEN",
    "P-09: PARTIAL",
    "M09-T11: NOT_PROVEN",
    "M09-T12: NOT_PROVEN",
    "M09-T13: NOT_PROVEN",
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
    adapter: receipts.adapter.tests,
    application: receipts.application.tests,
    focusedDesignRun: receipts.focusedDesignRun.tests,
    fullApp: receipts.fullApp.tests,
    rootProof: receipts.rootProof.tests,
  });
}

/** Verifies committed M09-T10 bytes and the visible report digest. */
export async function verifyDesenAppDesignRunModesEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppDesignRunModesEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T10 artifact bytes differ from fresh evidence.");
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

/** Atomically writes exact deterministic M09-T10 proof bytes. */
export async function writeDesenAppDesignRunModesEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_DESIGN_RUN_MODES_ARTIFACT_PATH,
  );
  const built = await buildDesenAppDesignRunModesEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T10 artifact write failed safely.", {
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
