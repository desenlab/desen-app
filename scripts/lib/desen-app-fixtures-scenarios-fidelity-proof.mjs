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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-FIXTURES-SCENARIOS-FIDELITY.md";
const DESIGN_RUN_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-design-run-modes.json";
const SIGN_IN_FIXTURE_ARTIFACT_PATH =
  "docs/proof/artifacts/reference-sign-in-fixtures-and-host-binding.json";
const PARITY_ARTIFACT_PATH = "docs/proof/artifacts/reference-catalog-web-parity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const FIXTURE_SOURCE_PATH = "apps/desen-app/src/authoring-fixtures.ts";
const SCENARIO_SOURCE_PATH = "apps/desen-app/src/authoring-scenarios.ts";
const FIDELITY_SOURCE_PATH = "apps/desen-app/src/preview-fidelity.ts";
const CONTROLS_SOURCE_PATH = "apps/desen-app/src/preview-controls.tsx";
const ADAPTER_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const INSPECTOR_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const APPLICATION_CSS_PATH = "apps/desen-app/src/application.module.css";
const FIXTURE_TEST_PATH = "apps/desen-app/test/authoring-fixtures.test.ts";
const SCENARIO_TEST_PATH = "apps/desen-app/test/authoring-scenarios.test.ts";
const FIDELITY_TEST_PATH = "apps/desen-app/test/preview-fidelity.test.ts";
const CONTROLS_TEST_PATH = "apps/desen-app/test/preview-controls.test.tsx";
const ADAPTER_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs",
  "scripts/generate-desen-app-fixtures-scenarios-fidelity-proof.mjs",
  "scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
  "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
]);

const SOURCE_PATHS = Object.freeze([
  FIXTURE_SOURCE_PATH,
  SCENARIO_SOURCE_PATH,
  FIDELITY_SOURCE_PATH,
  CONTROLS_SOURCE_PATH,
  ADAPTER_SOURCE_PATH,
  APPLICATION_SOURCE_PATH,
  INSPECTOR_SOURCE_PATH,
  APPLICATION_CSS_PATH,
]);

const APP_TEST_PATHS = Object.freeze([
  FIXTURE_TEST_PATH,
  SCENARIO_TEST_PATH,
  FIDELITY_TEST_PATH,
  CONTROLS_TEST_PATH,
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
  DESIGN_RUN_ARTIFACT_PATH,
  SIGN_IN_FIXTURE_ARTIFACT_PATH,
  PARITY_ARTIFACT_PATH,
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
  "scripts/lib/desen-app-fixtures-scenarios-fidelity-proof.mjs",
  "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
]);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T12_SUCCESSOR_RECEIPT_PATHS,
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  ...SELF_RESEALED_PATHS,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 29_407,
  sha256: "3f08980e687d48ba267f78c7d4dd1ae1eb59db5cc6bb3401d88705ee0416cc9d",
});

const SOURCE_POLICY_KEYS = Object.freeze([
  "fixtureSource",
  "scenarioSource",
  "fidelitySource",
  "controlsSource",
  "adapterSource",
  "applicationSource",
  "inspectorSource",
  "applicationCss",
]);

const EXPECTED_TEST_NAMES = Object.freeze({
  [FIXTURE_TEST_PATH]: Object.freeze([
    "shows synthetic, integration, and production context without activating real bindings",
    "offers only exact success and declared invalid-credentials fixtures",
    "publishes a real pending lifecycle before explicit successful settlement",
    "settles the selected declared public failure without replacing the host port",
    "denies a forged request with %s without starting lifecycle",
    "denies a request with %s context",
    "rejects inherited or accessor-backed authorization fields without invoking them",
    "rejects inherited or accessor-backed request context without invoking getters",
    "captures the expected preview identity without retaining caller ownership",
    "rejects malformed expected preview identity before creating authority",
    "revokes admission synchronously during cleanup and reactivates only the same live lifetime",
    "revokes pending work on disposal and ignores late settlement",
    "revokes a replaced transport while preserving the stable operation port",
    "never reads, retains, or logs operation input and password data",
    "rejects unknown outcome values without changing the controller",
  ]),
  [SCENARIO_TEST_PATH]: Object.freeze([
    "exposes the authored sentinel and exact Catalog scenarios in stable order",
    "returns an honest idle state and rejects stale route or capability authority",
    "prepares a shallow transient props overlay and leaves session Source/preview untouched",
    "restores authored values by exact identity without fabricating another session snapshot",
    "rejects missing, unprefixed, and stale-preview scenario requests without partial output",
    "fails closed for scenario state or fixtures instead of partially applying props",
    "does not invoke hostile route, selection, or scenario-prop accessors",
  ]),
  [FIDELITY_TEST_PATH]: Object.freeze([
    "reports the current reference surface as same-fidelity",
    "uses approximate, undeclared, equivalent, same precedence over unique nested capabilities",
    "fails closed to undeclared for missing or invalid fidelity metadata",
    "retains all approximate differences and supplies an explicit empty-declaration fallback",
    "rejects invalid routes without reading raw Source or Catalog data",
    "deduplicates deterministically regardless of traversal and component-library order",
  ]),
  [CONTROLS_TEST_PATH]: Object.freeze([
    "renders every approximate difference and undeclared adapter without color-only meaning",
    "keeps the scenario selector closed to the exact projected values",
    "shows only synthetic execution and enables explicit completion only while pending",
  ]),
  [ADAPTER_TEST_PATH]: Object.freeze([
    "runs real adapter events on the same session and preserves state across mode changes",
    "keeps an exact host authority stable and hides its tree synchronously on replacement",
  ]),
  [APPLICATION_TEST_PATH]: Object.freeze([
    "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
    "uses only the App-owned drag intent and ignores forged native transfer authority",
    "snaps a native layer drag to the before or after half of a visible layer row",
    "uses the release position when it crosses a row midpoint after the last dragover",
    "keeps the admitted gap stable while the pointer jitters around a row midpoint",
    "drops from a visible row with the last admitted projection when drop coordinates are absent",
    "moves nodes across nested slots with keyboard and App-owned native drag intent",
    "keeps Catalog scenarios transient across Design and Run without changing Source values",
    "runs real pending lifecycle and settles only exact synthetic success and failure fixtures",
    "revokes the previous fixture authority synchronously when a scenario replaces its Bundle",
  ]),
});

const EXPECTED_FOCUSED_TEST_CASE_COUNTS = Object.freeze({
  [FIXTURE_TEST_PATH]: 20,
  [SCENARIO_TEST_PATH]: 7,
  [FIDELITY_TEST_PATH]: 6,
  [CONTROLS_TEST_PATH]: 3,
  [ADAPTER_TEST_PATH]: 10,
  [APPLICATION_TEST_PATH]: 42,
});

/** Exact reviewed App cases in the six-file M09-T11 focused suite. */
export const DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES = 86;
const CURRENT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES = 88;

/** Exact immutable proof receipts bounding the M09-T11 App authority. */
export const DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T10",
    proofId: "desen-app-design-run-modes",
    path: DESIGN_RUN_ARTIFACT_PATH,
    bytes: 17_900,
    sha256: "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334",
    profile: "desen.app.design-run-modes-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M03-T08",
    path: SIGN_IN_FIXTURE_ARTIFACT_PATH,
    bytes: 12_713,
    sha256: "b0413687bd907b71509db52d3e22b6eda5a4150509ac323bf51e5f8425f897e2",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M03-T09",
    path: PARITY_ARTIFACT_PATH,
    bytes: 18_146,
    sha256: "6e350f2af71ac4e1f040afe7a3fcc3035de35b585f0121db6a2b35b4f3552a8a",
    result: "PASS",
    immutable: true,
  }),
]);

/** Reviewed independent root-test names retained by the M09-T11 artifact. */
export const DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact Design/Run, fixture, and parity parents",
  "[scenario] proves props-only transient Source and Bundle previews",
  "[fixture] proves exact inert inventory, context, and input non-retention",
  "[lifecycle] proves real pending then explicit success or public failure",
  "[fidelity] proves conservative same, equivalent, undeclared, and approximate disclosure",
  "[ui] proves visible context, scenario, fixture, and complete-difference controls",
  "[session] proves scenario and pending continuity across Design and Run",
  "[tests] retains focused positive, negative, and package dependency evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects scenario, fixture, host-authority, fidelity, and UI weakening",
  "[verification] rejects parent, artifact, report, and filesystem authority drift",
]);

/** Default destination for deterministic M09-T11 evidence. */
export const DEFAULT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T11 evidence reader. */
export class DesenAppFixturesScenariosFidelityProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppFixturesScenariosFidelityProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppFixturesScenariosFidelityProofError(code, message, details);
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
    if (error instanceof DesenAppFixturesScenariosFidelityProofError) throw error;
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
    output.set(relativePath, overrides.get(relativePath) ?? live);
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
    fail(code, `${label} lost required M09-T11 policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function captureSourcePolicyInput(rawInput) {
  const input = exactOwnDataOptions(rawInput, SOURCE_POLICY_KEYS, "source policy input");
  const captured = Object.create(null);
  for (const key of SOURCE_POLICY_KEYS) {
    if (typeof input[key] !== "string") {
      fail("OPTIONS_INVALID", `source policy input.${key} must be UTF-8 text.`);
    }
    captured[key] = input[key];
  }
  return Object.freeze(captured);
}

function parseTypeScript(rawSource, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    rawSource,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail(code, `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function unwrapExpression(rawNode) {
  let node = rawNode;
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

function exactObjectProperties(rawNode, expectedNames, label) {
  const node = unwrapExpression(rawNode);
  if (!ts.isObjectLiteralExpression(node)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one object literal.`);
  }
  const names = [];
  const properties = new Map();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      fail("SOURCE_POLICY_VIOLATION", `${label} admits only named data properties.`);
    }
    if (properties.has(property.name.text)) {
      fail("SOURCE_POLICY_VIOLATION", `${label} contains duplicate data properties.`);
    }
    names.push(property.name.text);
    properties.set(property.name.text, property.initializer);
  }
  if (!isDeepStrictEqual(names, expectedNames)) {
    fail("SOURCE_POLICY_VIOLATION", `${label} field closure drifted.`, {
      actual: names,
      expected: expectedNames,
    });
  }
  return properties;
}

function exactCallArgument(rawNode, callee, label) {
  const node = unwrapExpression(rawNode);
  if (
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== callee ||
    node.arguments.length !== 1
  ) {
    fail("SOURCE_POLICY_VIOLATION", `${label} must remain one ${callee} call.`);
  }
  return node.arguments[0];
}

function exactString(rawNode, expected, label) {
  const node = unwrapExpression(rawNode);
  if (!ts.isStringLiteral(node) || node.text !== expected) {
    fail("SOURCE_POLICY_VIOLATION", `${label} changed.`);
  }
}

function variableInitializer(sourceFile, name) {
  const matches = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      matches.push(node.initializer);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (matches.length !== 1 || matches[0] === undefined) {
    fail("SOURCE_POLICY_VIOLATION", `${sourceFile.fileName} must declare ${name} exactly once.`);
  }
  return matches[0];
}

function inspectFixtureInventory(sourceFile) {
  const contextArgument = exactCallArgument(
    variableInitializer(sourceFile, "AUTHORING_FIXTURE_CONTEXT_MODEL"),
    "deepFreezeProjection",
    "AUTHORING_FIXTURE_CONTEXT_MODEL",
  );
  const context = exactObjectProperties(
    contextArgument,
    ["activeId", "disclosure", "options"],
    "fixture context model",
  );
  exactString(context.get("activeId"), "synthetic", "fixture active context");
  exactString(
    context.get("disclosure"),
    "Synthetic Catalog data. Integration and production calls are off.",
    "fixture context disclosure",
  );
  const options = unwrapExpression(context.get("options"));
  if (!ts.isArrayLiteralExpression(options) || options.elements.length !== 3) {
    fail("SOURCE_POLICY_VIOLATION", "Fixture context must retain exactly three visible options.");
  }
  const expectedOptions = [
    ["synthetic", "active"],
    ["integration", "unavailable"],
    ["production", "unavailable"],
  ];
  for (const [index, [id, availability]] of expectedOptions.entries()) {
    const properties = exactObjectProperties(
      options.elements[index],
      ["id", "label", "availability", "description"],
      `fixture context option ${index}`,
    );
    exactString(properties.get("id"), id, `fixture context option ${index}.id`);
    exactString(
      properties.get("availability"),
      availability,
      `fixture context option ${index}.availability`,
    );
  }

  const outcomesArgument = exactCallArgument(
    variableInitializer(sourceFile, "AUTHORING_SIGN_IN_FIXTURE_OUTCOMES"),
    "deepFreezeProjection",
    "AUTHORING_SIGN_IN_FIXTURE_OUTCOMES",
  );
  const outcomes = unwrapExpression(outcomesArgument);
  if (!ts.isArrayLiteralExpression(outcomes) || outcomes.elements.length !== 2) {
    fail("SOURCE_POLICY_VIOLATION", "Sign-in inventory must retain exactly two outcomes.");
  }
  const expectedOutcomes = [
    ["success", "success"],
    ["invalidCredentials", "error"],
  ];
  for (const [index, [id, kind]] of expectedOutcomes.entries()) {
    const properties = exactObjectProperties(
      outcomes.elements[index],
      ["id", "label", "kind", "capabilityId", "fixtureValue"],
      `fixture outcome ${index}`,
    );
    exactString(properties.get("id"), id, `fixture outcome ${index}.id`);
    exactString(properties.get("kind"), kind, `fixture outcome ${index}.kind`);
  }
}

function inspectModuleAuthority(source, relativePath, allowedModules) {
  const sourceFile = parseTypeScript(source, relativePath);
  const imports = [];
  const violations = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
      if (!allowedModules(node.moduleSpecifier.text)) {
        violations.push(`import:${node.moduleSpecifier.text}`);
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) violations.push("dynamic-import");
      if (
        ts.isIdentifier(node.expression) &&
        ["eval", "fetch", "require", "setInterval"].includes(node.expression.text)
      ) {
        violations.push(`call:${node.expression.text}`);
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ["fetch", "eval"].includes(node.expression.name.text)
      ) {
        violations.push(`call-property:${node.expression.name.text}`);
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
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired executable host authority.`, {
      violations,
    });
  }
  return Object.freeze({ sourceFile, imports: Object.freeze(imports) });
}

function exactAllowedModules(modules) {
  const allowed = new Set(modules);
  return (specifier) => allowed.has(specifier);
}

function appShellModule(specifier) {
  return (
    specifier === "react" ||
    specifier === "react-dom" ||
    specifier.startsWith(".") ||
    (specifier.startsWith("@desen/") &&
      !specifier.includes("/host-operations") &&
      !specifier.includes("control-plane") &&
      !specifier.includes("runtime-web"))
  );
}

function inspectFixtureSource(source) {
  const { sourceFile, imports } = inspectModuleAuthority(
    source,
    FIXTURE_SOURCE_PATH,
    exactAllowedModules([
      "@desen/reference-catalog-web/operations",
      "@desen/runtime-core",
      "@desen/testkit",
    ]),
  );
  inspectFixtureInventory(sourceFile);
  assertIncludes(
    source,
    [
      "createSyntheticFixtureSnapshot({",
      "context: SYNTHETIC_FIXTURE_CONTEXT",
      "operations: [signInOperationRegistration]",
      "resources: []",
      '"invalidCredentials"',
      '"unavailable"',
      'Object.hasOwn(SIGN_IN_FIXTURE_SNAPSHOT.operations[SIGN_IN_CAPABILITY_ID] ?? {}, "pending")',
      "new Promise<RuntimeHostCallResult>",
      "const operationPort = Object.freeze({ invoke }) satisfies RuntimeOperationPort",
      'readOwnDataString(request, "capabilityId") === SIGN_IN_CAPABILITY_ID',
      'readOwnDataString(request, "invocationAlias") === SIGN_IN_INVOCATION_ALIAS',
      'readOwnDataString(request, "effect") === SIGN_IN_EFFECT',
      'const expectedKeys = ["documentId", "revision", "surfaceId", "requestId"] as const',
      'readContextString("documentId") === expectedContext.documentId',
      'readContextString("revision") === expectedContext.revision',
      'readContextString("surfaceId") === expectedContext.surfaceId',
      'readContextString("requestId") !== undefined',
      "descriptor?.enumerable === true",
      '"value" in descriptor',
      "descriptor.value.length > 0",
      "let active = true",
      "if (disposed || !active || !isAuthorizedSignInRequest(request, expectedContext))",
      'if (!active) return Object.freeze({ status: "rejected", reason: "inactive" })',
      'if (!active) return Object.freeze({ status: "ignored", reason: "inactive" })',
      "replaced?.resolve(DENIED_RESULT)",
      "revoked?.resolve(DENIED_RESULT)",
      "const activate = (): void =>",
      "const deactivate = (): void =>",
      "revoked.resolve(DENIED_RESULT)",
      "current.resolve(outcomeResult(current.outcomeId))",
      "listeners.clear()",
    ],
    FIXTURE_SOURCE_PATH,
  );
  assertExcludes(
    source,
    [
      "request.input",
      'request["input"]',
      "bindReferenceSignInHostOperation",
      "@desen/reference-catalog-web/host-operations",
      "console.",
      "localStorage",
      "sessionStorage",
    ],
    FIXTURE_SOURCE_PATH,
  );
  return deepFreeze({
    imports,
    publicTestkitProjection: true,
    exactOutcomes: ["success:user-1", "error:invalidCredentials"],
    staticPendingOption: false,
    unavailableFixtureOption: false,
    exactRequestContextAuthorization: true,
    requestInputObservedOrRetained: false,
    realPromisePending: true,
    explicitSettlement: true,
    stableOperationPort: true,
    synchronousDeactivationRevokesAdmissionAndPending: true,
    sameLiveLifetimeCanReactivate: true,
    disposeRevokesPending: true,
    executableHostBinding: false,
  });
}

function inspectScenarioSource(source) {
  const { imports } = inspectModuleAuthority(
    source,
    SCENARIO_SOURCE_PATH,
    exactAllowedModules([
      "@desen/catalog-sdk",
      "@desen/editor-core",
      "./authoring-data.js",
      "./authoring-preview.js",
      "./authoring-selection.js",
    ]),
  );
  assertIncludes(
    source,
    [
      'export const AUTHORING_SOURCE_SCENARIO_VALUE = "source" as const',
      '"fixtures"',
      '"props"',
      '"state"',
      'if (hasOwnData(scenario, "fixtures") || hasOwnData(scenario, "state"))',
      'throw new ScenarioProjectionError("scenario-unsupported")',
      "prepareCatalogAuthoringModel(initialProjection.catalog, document)",
      "const baselinePreview = prepareAuthoringPreviewBundle(document)",
      "if (baselinePreview.revision !== admittedCurrentPreview.revision)",
      "let scenarioDocument = document",
      "setDesenEditorOwnerProp(scenarioDocument",
      "scenarioDocument = edited.document",
      "const preview = prepareAuthoringPreviewBundle(scenarioDocument)",
      "return Object.freeze({ ok: true, scenarioDocument, preview })",
    ],
    SCENARIO_SOURCE_PATH,
  );
  assertExcludes(
    source,
    [
      "setAuthoringSession",
      "saveDesen",
      "publishToControlPlane",
      "commitActivation",
      "hostPorts",
      "RuntimeHost",
      "localStorage",
    ],
    SCENARIO_SOURCE_PATH,
  );
  return deepFreeze({
    imports,
    authoredSentinel: "source",
    propsOnly: true,
    stateAndFixturesFailClosed: true,
    publicEditorCoreTransitions: true,
    freshCatalogAndDocumentAdmission: true,
    publisherPreviewPreparedSeparately: true,
    authoredDocumentMutation: false,
    currentPreviewMutation: false,
    persistenceOrPublicationAuthority: false,
  });
}

function inspectFidelitySource(source) {
  const { imports } = inspectModuleAuthority(
    source,
    FIDELITY_SOURCE_PATH,
    exactAllowedModules(["./authoring-data.js", "./authoring-slots.js"]),
  );
  assertIncludes(
    source,
    [
      'export type PreviewFidelityKind = "approximate" | "undeclared" | "equivalent" | "same"',
      "APPROXIMATE_FIDELITY_FALLBACK",
      "same: 0",
      "equivalent: 1",
      "undeclared: 2",
      "approximate: 3",
      "component?.inspector.authoring",
      'fidelity === "same" || fidelity === "equivalent" || fidelity === "approximate"',
      'fidelity === "approximate" && differencesValue.length === 0',
      "Object.freeze([APPROXIMATE_FIDELITY_FALLBACK])",
      "Object.freeze([...differencesValue])",
      'kind: "undeclared"',
      "capabilityIds.map((capabilityId) => readEntry(model, capabilityId))",
    ],
    FIDELITY_SOURCE_PATH,
  );
  assertExcludes(
    source,
    [
      "validationCatalogs",
      "validationDocument",
      "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
      "RuntimeReact",
      "document.querySelector",
    ],
    FIDELITY_SOURCE_PATH,
  );
  return deepFreeze({
    imports,
    kinds: ["same", "equivalent", "undeclared", "approximate"],
    conservativePrecedence: true,
    sourceSurfaceCapabilitiesOnly: true,
    completeDeclaredDifferences: true,
    approximateEmptyFallbackVisible: true,
    missingOrInvalidMetadataUndeclared: true,
    runtimeOrPrivateAdapterInspection: false,
  });
}

function inspectControlsSource(source) {
  const { imports } = inspectModuleAuthority(
    source,
    CONTROLS_SOURCE_PATH,
    exactAllowedModules([
      "react",
      "./application.module.css",
      "./authoring-fixtures.js",
      "./authoring-scenarios.js",
      "./preview-fidelity.js",
    ]),
  );
  assertIncludes(
    source,
    [
      "export function PreviewContextDisclosure",
      'aria-label="Preview context and fidelity"',
      'projection.kind === "approximate"',
      'return "Approximate preview"',
      "entry.differences.map((difference)",
      'role="alert"',
      "Known preview differences",
      "Fidelity not declared for",
      "export function ScenarioPreviewControl",
      'aria-label="Scenario preview"',
      "Preview only · not saved or published",
      "export function RunControls",
      'aria-label="Run controls"',
      "AUTHORING_FIXTURE_CONTEXT_MODEL.options.map",
      "AUTHORING_SIGN_IN_FIXTURE_OUTCOMES.map",
      'name="fixture-context"',
      "disabled={!active || pending}",
      "disabled={!pending}",
      'aria-live="polite"',
      "AUTHORING_FIXTURE_CONTEXT_MODEL.disclosure",
    ],
    CONTROLS_SOURCE_PATH,
  );
  return deepFreeze({
    imports,
    visibleExecutionContexts: ["synthetic", "integration", "production"],
    scenarioPreviewOnlyDisclosure: true,
    pendingNotSelectable: true,
    explicitCompleteControl: true,
    approximateAlertPersistent: true,
    completeDifferenceList: true,
    undeclaredFidelityWarning: true,
    politeLifecycleStatus: true,
  });
}

function inspectAdapterSource(source) {
  const { imports } = inspectModuleAuthority(source, ADAPTER_SOURCE_PATH, appShellModule);
  assertIncludes(
    source,
    [
      "readonly hostPorts?: RuntimeHostPorts",
      "hostPorts = ADAPTER_CANVAS_HOST_PORTS",
      "hostPorts,",
      "[bundle, hostPorts, previewRevision, routeIdentity, supported]",
      "disposeRuntimeHeadlessSession(session)",
      "real adapter controls use the selected synthetic fixture",
    ],
    ADAPTER_SOURCE_PATH,
  );
  return deepFreeze({
    imports,
    denyOnlyDefaultPorts: true,
    appOwnedHostPortsExplicit: true,
    hostPortIdentityInMountLifetime: true,
    sessionDisposedOnReplacement: true,
    managedAdapterTreeReimplementation: false,
  });
}

function inspectApplicationSource(source) {
  const { imports, sourceFile } = inspectModuleAuthority(
    source,
    APPLICATION_SOURCE_PATH,
    appShellModule,
  );
  const reactDomImports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "react-dom",
  );
  if (reactDomImports.length !== 0) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The M09-T13 successor must retain its surrendered react-dom application authority.",
    );
  }
  assertIncludes(
    source,
    [
      "function createAuthoringFixtureHostPorts(operationPort: RuntimeOperationPort)",
      "operations: operationPort",
      'navigation: { navigate: () => ({ status: "denied" }) }',
      'resources: { load: () => ({ status: "denied" }) }',
      "prepareAuthoringScenarioModel(preparedModel.model, route, selection)",
      "prepareAuthoringScenarioPreview(",
      "const effectivePreview =",
      "scenarioPreview?.ok === true",
      "const fixtureRevision = effectivePreview?.ok === true",
      "createAuthoringSignInFixtureController({",
      "revision: fixtureRevision",
      "createAuthoringFixtureHostPorts(fixtureController.operationPort)",
      "useSyncExternalStore(",
      "fixtureController.subscribe",
      "fixtureController.dispose()",
      "fixtureController.activate()",
      "fixtureController.deactivate()",
      "fixtureControllerLifetime.current = fixtureController",
      "queueMicrotask(() =>",
      "fixtureControllerLifetime.current !== fixtureController",
      "const LAYER_DROP_MIDPOINT_HYSTERESIS_PX = 4",
      "interface AuthoringDropProjection",
      "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
      "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
      "setActiveDropProjection((current) =>",
      "current.index === next.index",
      "isSameAuthoringSlotSelection(current.target, next.target)",
      "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
      ".closest<HTMLDivElement>('[data-layer-slot-surface=\"true\"]')",
      "activeDropProjection={activeDropProjection}",
      "onProjectDrop={projectDrop}",
      "type AuthoringDropAdmission =",
      "function evaluateDragIntent(",
      "interface AuthoringDragSession {",
      "function createAuthoringDragSession(epoch = 0): AuthoringDragSession",
      "const dragSession = useRef<AuthoringDragSession>(createAuthoringDragSession())",
      "dragSession.current = createAuthoringDragSession(current.epoch + 1)",
      "const sessionOwnerKey = JSON.stringify([target.ownerKind, target.ownerId, target.slot])",
      "pending.sessionEpoch !== currentSession.epoch",
      "pending.ownerKey !== currentSession.ownerKey",
      "document.elementFromPoint(pending.clientX, pending.clientY)",
      "hitSlotSurface !== pending.slotSurface",
      "function clearUnclaimedDrop(): void {",
      "className={styles.slotBoundaryHitArea}",
      'data-slot-boundary-hit-area="true"',
      "onDragEnter={onBoundaryDragEnter}",
      "onDragOver={onBoundaryDragOver}",
      "onDrop={onBoundaryDrop}",
      "className={styles.componentsView}",
      "panelDragEnterDepth.current += 1",
      'admission.status === "noop"\n        ? "none"',
      'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
      "className={styles.componentSlotTarget}",
      "onDragOver={admitComponentDrop}",
      "onDrop={receiveComponentDrop}",
      'data-component-card="true"',
      "className={styles.componentItem}",
      'data-component-drag-handle="true"',
      "className={styles.componentDragHandle}",
      'data-layer-drag-handle="true"',
      "data-layer-drop-row-node-id={node.id}",
      'querySelector<HTMLElement>("[data-layer-drop-row-node-id]")',
      "className={styles.componentAddAction}",
      "draggable={false}",
      "event.preventDefault();\n                                event.stopPropagation();",
      "onClick={() => addComponent(component.id)}",
      "if (!isDesignMode() || scenarioOwnerKey === null) return",
      "<PreviewContextDisclosure fidelity={fidelity}",
      "hostPorts={fixtureHostPorts}",
      "<ScenarioPreviewControl",
      "<RunControls",
      "fixtureController.completePending()",
      "fixtureController.selectOutcome(outcomeId)",
    ],
    APPLICATION_SOURCE_PATH,
  );
  assertExcludes(
    source,
    [
      "scenarioDocument",
      "bindReferenceSignInHostOperation",
      "host-operations",
      "function acceptsDragIntent(",
      "flushSync",
      "draggable={enabled}",
      "draggable={movable}",
      'title="Drag anywhere in this panel to add"',
    ],
    APPLICATION_SOURCE_PATH,
  );
  for (const handler of [
    "onDragEnter={enterComponentDrop}",
    "onDragLeave={leaveComponentDrop}",
    "onDragOver={admitComponentDrop}",
    "onDrop={receiveComponentDrop}",
  ]) {
    if (source.split(handler).length !== 3) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "The Components panel fallback and sticky target must each retain direct authenticated handlers.",
        { handler },
      );
    }
  }
  return deepFreeze({
    imports,
    scenarioSelectionDesignOnly: true,
    scenarioPreviewSeparateFromAuthoringSession: true,
    scenarioPersistsAcrossModeToggle: true,
    exactEffectivePreviewRevisionBindsController: true,
    stableHostPortsPerController: true,
    synchronousCleanupClosesFixtureAdmission: true,
    strictModeReplayRetainsOnlySameLiveController: true,
    pendingControllerDisposedOnPreviewReplacement: true,
    applicationReactDomImports: 0,
    reactDomAuthoritySurrendered: true,
    componentDragAuthorityLimitedToDedicatedHandle: true,
    dedicatedLayerDragHandle: true,
    separateNonDraggableComponentAddAction: true,
    componentPanelWideDropSurface: true,
    stickyComponentTargetDirectDropSurface: true,
    stableGlobalLayerDragSession: true,
    globalLayerOwnerAndEpochFencing: true,
    edgeScrollExactSlotRehitTesting: true,
    nestedSlotSurfaceOwnsDropEvents: true,
    layerMidpointHysteresis: 4,
    onlyOperationPortExecutable: true,
    navigationResourcesStorageProductionDenied: true,
  });
}

function inspectInspectorSource(source) {
  const { imports } = inspectModuleAuthority(source, INSPECTOR_SOURCE_PATH, appShellModule);
  assertIncludes(
    source,
    [
      "readonly previewControls?: ReactNode",
      "previewControls,",
      "{previewControls}",
      'aria-label="Inspector"',
    ],
    INSPECTOR_SOURCE_PATH,
  );
  return deepFreeze({ imports, previewControlsAppOwned: true, managedTreeOwnership: false });
}

function inspectCss(source) {
  assertIncludes(
    source,
    [
      ".previewDisclosure",
      ".fidelityBadge",
      ".fidelityDetails strong {",
      ".scenarioControl",
      ".runControls",
      ".fixtureContextGroup",
      ".fixtureOutcomeControl",
      ".runControlsBoundary",
      ".layerSlot > ul",
      ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;",
      ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;",
      '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
      '.slotBoundary[data-drop-hovered="true"]::before',
      ".layerDragGuide {",
      ".componentItem {",
      ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
      ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
      ".layerDragHandle::before",
      '.componentsView[data-component-drag-active="true"]',
      ".componentAddAction {",
    ],
    APPLICATION_CSS_PATH,
  );
  return deepFreeze({
    contextAndFidelityVisible: true,
    approximateDifferenceContainerVisible: true,
    scenarioAndRunControlsVisible: true,
    nestedLayerSlotsAndGlobalDragGuideVisible: true,
    dedicatedDragHandlesAndSeparateAddActionVisible: true,
    managedCapabilityStylesChanged: false,
  });
}

/** Verifies M09-T11 source semantics and rejects widened executable authority. */
export function verifyDesenAppFixturesScenariosFidelitySourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  return deepFreeze({
    fixture: inspectFixtureSource(input.fixtureSource),
    scenario: inspectScenarioSource(input.scenarioSource),
    fidelity: inspectFidelitySource(input.fidelitySource),
    controls: inspectControlsSource(input.controlsSource),
    adapter: inspectAdapterSource(input.adapterSource),
    application: inspectApplicationSource(input.applicationSource),
    inspector: inspectInspectorSource(input.inspectorSource),
    css: inspectCss(input.applicationCss),
  });
}

function collectTestNames(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath, "TEST_POLICY_VIOLATION");
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
  return Object.freeze(names);
}

function collectTestCaseCount(rawSource, relativePath) {
  const sourceFile = parseTypeScript(rawSource, relativePath, "TEST_POLICY_VIOLATION");
  let count = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const direct =
        ts.isIdentifier(node.expression) && ["it", "test"].includes(node.expression.text);
      const parameterized =
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        ["it", "test"].includes(node.expression.expression.expression.text) &&
        node.expression.expression.name.text === "each";
      if (direct) count += 1;
      if (parameterized) {
        const table = unwrapExpression(node.expression.arguments[0]);
        if (!ts.isArrayLiteralExpression(table) || table.elements.length === 0) {
          fail(
            "TEST_POLICY_VIOLATION",
            `${relativePath} must use a non-empty literal table for focused parameterized tests.`,
          );
        }
        count += table.elements.length;
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return count;
}

function namedTestBody(rawSource, relativePath, testName) {
  const sourceFile = parseTypeScript(rawSource, relativePath, "TEST_POLICY_VIOLATION");
  const bodies = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.arguments.length >= 2 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === testName &&
      ts.isIdentifier(node.expression) &&
      ["it", "test"].includes(node.expression.text)
    ) {
      bodies.push(node.arguments[1].getText(sourceFile));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  if (bodies.length !== 1) {
    fail("TEST_POLICY_VIOLATION", `${relativePath} must contain exactly one ${testName} test.`);
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
  const testCaseCounts = Object.fromEntries(
    [...sources].map(([relativePath, source]) => [
      relativePath,
      collectTestCaseCount(source, relativePath),
    ]),
  );
  if (!isDeepStrictEqual(testCaseCounts, EXPECTED_FOCUSED_TEST_CASE_COUNTS)) {
    fail("TEST_POLICY_VIOLATION", "The exact six-file M09-T11 focused case counts drifted.", {
      actual: testCaseCounts,
      expected: EXPECTED_FOCUSED_TEST_CASE_COUNTS,
    });
  }
  const focusedTestCases = Object.values(testCaseCounts).reduce((total, count) => total + count, 0);
  if (focusedTestCases !== CURRENT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES) {
    fail("TEST_POLICY_VIOLATION", "The current compatible focused case total drifted.", {
      actual: focusedTestCases,
      expected: CURRENT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_FOCUSED_TEST_CASES,
    });
  }
  for (const [relativePath, requiredNames] of Object.entries(EXPECTED_TEST_NAMES)) {
    const missing = requiredNames.filter((name) => !names[relativePath].includes(name));
    if (missing.length !== 0) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} lost required M09-T11 tests.`, { missing });
    }
  }

  assertIncludes(
    namedTestBody(
      sources.get(FIXTURE_TEST_PATH),
      FIXTURE_TEST_PATH,
      "never reads, retains, or logs operation input and password data",
    ),
    ["inputAccess", "not.toHaveBeenCalled()", "consoleSpies", "not.toContain(secret)"],
    "fixture secret-retention test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(FIXTURE_TEST_PATH),
      FIXTURE_TEST_PATH,
      "revokes admission synchronously during cleanup and reactivates only the same live lifetime",
    ),
    [
      "controller.deactivate()",
      'toEqual({ status: "denied" })',
      'reason: "inactive"',
      "controller.activate()",
      'errorCode: "invalidCredentials"',
      "controller.dispose()",
    ],
    "fixture cleanup admission test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(SCENARIO_TEST_PATH),
      SCENARIO_TEST_PATH,
      "prepares a shallow transient props overlay and leaves session Source/preview untouched",
    ),
    [
      "expect(result.scenarioDocument).not.toBe(document)",
      "expect(result.preview).not.toBe(preview)",
      "expect(JSON.stringify(document)).toBe(documentBytes)",
      "expect(JSON.stringify(preview)).toBe(previewBytes)",
    ],
    "scenario transient test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(FIDELITY_TEST_PATH),
      FIDELITY_TEST_PATH,
      "retains all approximate differences and supplies an explicit empty-declaration fallback",
    ),
    ["First complete difference.", "Second complete difference.", "APPROXIMATE_FIDELITY_FALLBACK"],
    "approximate fidelity test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "keeps Catalog scenarios transient across Design and Run without changing Source values",
    ),
    [
      'target: { value: "catalog:invalid" }',
      'getByRole("button", { name: "Run" })',
      'getByRole("button", { name: "Design" })',
      'target: { value: "source" }',
    ],
    "application scenario continuity test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "runs real pending lifecycle and settles only exact synthetic success and failure fixtures",
    ),
    [
      '"success"',
      '"invalidCredentials"',
      'not.toContain("pending")',
      'name: "Complete fixture"',
      "Invalid credentials",
      "Production navigation remains blocked",
    ],
    "application fixture lifecycle test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "uses only the App-owned drag intent and ignores forged native transfer authority",
    ),
    [
      "const alertCard = alert.closest(\"[data-component-card='true']\")",
      "expect((alert as HTMLButtonElement).draggable).toBe(false)",
      "expect(alertCard.draggable).toBe(false)",
      "expect(alertDragHandle.draggable).toBe(true)",
      "expect(reads).toBe(0)",
      "fireEvent.dragEnter(panelSearch",
      "fireEvent.dragEnter(dropPrompt",
      "fireEvent.dragOver(panelSearch",
      "expect(slotEdit).toHaveBeenCalledTimes(1)",
      "fireEvent.drop(target",
    ],
    "dedicated component grip and panel-wide authenticated drop test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "chooses an exact named-slot target and inserts Catalog defaults into Source and preview",
    ),
    [
      "expect(addAlert.draggable).toBe(false)",
      "const alertCard = addAlert.closest(\"[data-component-card='true']\")",
      "expect(alertCard.draggable).toBe(false)",
      "alertCard.querySelector(\"[data-component-drag-handle='true']\")",
      "fireEvent.click(addAlert)",
    ],
    "dedicated component grip and separate Add activation test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "moves nodes across nested slots with keyboard and App-owned native drag intent",
    ),
    [
      "querySelectorAll(\"[data-drop-hovered='true']\")).toHaveLength(1)",
      "fireEvent.dragOver(outerStart",
      "fireEvent.drop(nestedBoundaryLine",
      'cycleTarget.getAttribute("data-drop-ready")).toBe("false")',
      "expect(reads).toBe(0)",
    ],
    "global nested-slot drop projection test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
    ),
    [
      "const elementFromPoint = vi.fn(() => acceptedBoundary)",
      'expect(dataTransfer.dropEffect).toBe("none")',
      "expect(elementFromPoint).toHaveBeenCalledWith(20, 195)",
      "expect(cancelFrame).toHaveBeenCalledWith(2)",
      "act(() => staleFrame?.(2))",
    ],
    "stable global drag-session re-hit-test and stale-frame fencing test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "keeps the admitted gap stable while the pointer jitters around a row midpoint",
    ),
    ["dragOverAt(118)", "dragOverAt(122)", "dragOverAt(126)"],
    "layer midpoint hysteresis test",
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    namedTestBody(
      sources.get(APPLICATION_TEST_PATH),
      APPLICATION_TEST_PATH,
      "revokes the previous fixture authority synchronously when a scenario replaces its Bundle",
    ),
    [
      'firstController.read().status).toBe("pending")',
      "replacement).not.toBe(firstController)",
      'firstController.operationPort.invoke(request)).toEqual({ status: "denied" })',
      'firstController.read().status).toBe("disposed")',
    ],
    "scenario Bundle fixture-authority replacement test",
    "TEST_POLICY_VIOLATION",
  );

  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:fixtures-scenarios && node --test tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
    appTestNames: names,
    testDeclarationCounts: Object.fromEntries(
      Object.entries(names).map(([relativePath, testNames]) => [relativePath, testNames.length]),
    ),
    testCaseCounts,
    focusedTestCases,
    rootTestNames: DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES,
    semanticCoverage: [
      "PROPS_ONLY_SCENARIO_EPHEMERAL_SOURCE_AND_BUNDLE",
      "AUTHORED_SOURCE_AND_PUBLISHABLE_PREVIEW_UNCHANGED",
      "PUBLIC_TESTKIT_EXACT_SIGN_IN_FIXTURE_PROJECTION",
      "PENDING_IS_RUNTIME_LIFECYCLE_NOT_STATIC_FIXTURE",
      "EXACT_CONTEXT_CAPABILITY_ALIAS_EFFECT_AUTHORIZATION",
      "REQUEST_INPUT_AND_PASSWORD_NOT_OBSERVED_OR_RETAINED",
      "EXPLICIT_SUCCESS_AND_DECLARED_FAILURE_SETTLEMENT",
      "DISPOSE_AND_REPLACEMENT_REVOKE_PENDING",
      "SYNCHRONOUS_EFFECT_CLEANUP_REVOKES_ADMISSION_AND_PENDING",
      "STRICT_MODE_REPLAY_REACTIVATES_ONLY_THE_SAME_LIVE_CONTROLLER",
      "VISIBLE_SYNTHETIC_INTEGRATION_PRODUCTION_CONTEXT",
      "VISIBLE_COMPLETE_APPROXIMATE_FIDELITY_DIFFERENCES",
      "SCENARIO_AND_PENDING_CONTINUITY_ACROSS_DESIGN_RUN",
      "DRAGGABLE_COMPONENT_CARD_WITH_SEPARATE_NON_DRAGGABLE_ADD_ACTION",
      "EXPLICIT_COMPONENT_SLOT_TARGET_ONLY_WITH_INERT_OUTER_DROP_GUARD",
      "STABLE_GLOBAL_LAYER_DRAG_SESSION_ACROSS_NESTED_SLOT_SURFACES",
      "GLOBAL_LAYER_OWNER_AND_EPOCH_FENCING",
      "EDGE_SCROLL_REHIT_TESTS_THE_EXACT_SLOT_SURFACE",
      "LAYER_DROP_MIDPOINT_HYSTERESIS_RETAINS_ADMITTED_GAP",
    ],
  });
}

function inspectPackages(files) {
  const root = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const app = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const appCommand =
    "vitest run test/authoring-fixtures.test.ts test/authoring-scenarios.test.ts test/preview-fidelity.test.ts test/preview-controls.test.tsx test/adapter-canvas.test.tsx test/application.test.tsx";
  if (app.name !== "@desen/app-web") {
    fail("PACKAGE_POLICY_VIOLATION", "The Desen App package identity drifted.");
  }
  if (app.scripts?.["test:fixtures-scenarios"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact App fixtures/scenarios test command drifted.");
  }
  if (app.dependencies?.["@desen/testkit"] !== "workspace:*") {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost its public testkit fixture projection.");
  }
  for (const dependency of [
    "@desen/catalog-sdk",
    "@desen/editor-core",
    "@desen/protocol",
    "@desen/publisher",
    "@desen/reference-catalog-web",
    "@desen/runtime-core",
    "@desen/runtime-react",
    "@desen/validator",
  ]) {
    if (app.dependencies?.[dependency] !== "workspace:*") {
      fail("PACKAGE_POLICY_VIOLATION", `Desen App lost public dependency ${dependency}.`);
    }
  }
  const prefix =
    "node scripts/verify-desen-app-design-run-modes.mjs && node scripts/verify-reference-sign-in-fixtures-and-host-binding.mjs && node scripts/verify-reference-catalog-web-parity.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:fixtures-scenarios && ";
  const expectedRootCommands = {
    "generate:desen-app-fixtures-scenarios-fidelity":
      prefix + "node scripts/generate-desen-app-fixtures-scenarios-fidelity-proof.mjs",
    "verify:desen-app-fixtures-scenarios-fidelity":
      prefix + "node scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
    "test:desen-app-fixtures-scenarios-fidelity":
      prefix + "node --test tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
  };
  for (const [name, command] of Object.entries(expectedRootCommands)) {
    if (root.scripts?.[name] !== command) {
      fail("PACKAGE_POLICY_VIOLATION", `The exact ${name} command drifted.`);
    }
  }
  return deepFreeze({
    appName: app.name,
    appTestCommand: appCommand,
    testkitDependency: "workspace:*",
    rootPackageName: root.name,
    rootCommands: expectedRootCommands,
    parentsAuthenticatedInsideReader: true,
  });
}

function authenticateParent(bytes, pin) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact frozen ${pin.task} parent artifact changed.`);
  }
  const artifact = parseJson(bytes, `frozen ${pin.task} parent artifact`);
  if (artifact.task !== pin.task || artifact.result !== pin.result) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.task === "M09-T10" &&
    (artifact.proofId !== pin.proofId ||
      artifact.profile !== pin.profile ||
      artifact.claim?.oneImmutableSourceAndBundleSession !== true ||
      artifact.claim?.modeExcludedFromRuntimeMountIdentity !== true ||
      artifact.claim?.sameManagedCapabilitySubtreeOnToggle !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T10 Design/Run claims drifted.");
  }
  if (
    pin.task === "M03-T08" &&
    (artifact.operation?.operationId !== "com.example.auth/signIn" ||
      artifact.operation?.fixtures?.success?.userId !== "user-1" ||
      !isDeepStrictEqual(artifact.operation?.fixtures?.errors?.invalidCredentials, {}) ||
      artifact.operation?.lookups?.unavailable?.status !== "missing" ||
      artifact.operation?.pendingFixtureClaimed !== false ||
      artifact.hostBinding?.executableStoredInCatalogOrFixtures !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M03-T08 sign-in fixture authority drifted.");
  }
  if (
    pin.task === "M03-T09" &&
    (artifact.claim?.scope !== "reference-sign-in-slice" ||
      artifact.parity?.components?.length !== 5 ||
      artifact.parity.components.some(({ adapterFidelity }) => adapterFidelity !== "same") ||
      artifact.parity?.operation?.binding !== "application-supplied")
  ) {
    fail("PARENT_DRIFT", "The frozen M03-T09 parity authority drifted.");
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
    "frozen M09-T11 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T11 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T11 proof artifact");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M09-T11" ||
    artifact.proofId !== "desen-app-fixtures-scenarios-fidelity" ||
    artifact.profile !== "desen.app.fixtures-scenarios-fidelity-proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
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
      DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ROOT_TEST_NAMES,
    )
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T11 identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T11 task-time receipt drifted: ${relativePath}.`);
    }
  }
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
    if (T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)) continue;
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
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact M09-T12 source-persistence artifact drifted.");
  }
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
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The M09-T12 source-persistence identity or claims drifted.",
    );
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate.path, candidate]));
  for (const relativePath of T12_SUCCESSOR_RECEIPT_PATHS) {
    if (
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const receipt = receiptMap.get(relativePath);
    const bytes = files.get(relativePath);
    if (
      receipt === undefined ||
      bytes === undefined ||
      receipt.bytes !== bytes.byteLength ||
      receipt.sha256 !== sha256(bytes)
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", `The live M09-T12 receipt drifted: ${relativePath}.`);
    }
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

/** Builds detached deterministic M09-T11 fixture, scenario, and fidelity evidence. */
export async function buildDesenAppFixturesScenariosFidelityEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppFixturesScenariosFidelitySourcePolicy({
    fixtureSource: decodeUtf8(files.get(FIXTURE_SOURCE_PATH), FIXTURE_SOURCE_PATH),
    scenarioSource: decodeUtf8(files.get(SCENARIO_SOURCE_PATH), SCENARIO_SOURCE_PATH),
    fidelitySource: decodeUtf8(files.get(FIDELITY_SOURCE_PATH), FIDELITY_SOURCE_PATH),
    controlsSource: decodeUtf8(files.get(CONTROLS_SOURCE_PATH), CONTROLS_SOURCE_PATH),
    adapterSource: decodeUtf8(files.get(ADAPTER_SOURCE_PATH), ADAPTER_SOURCE_PATH),
    applicationSource: decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    inspectorSource: decodeUtf8(files.get(INSPECTOR_SOURCE_PATH), INSPECTOR_SOURCE_PATH),
    applicationCss: decodeUtf8(files.get(APPLICATION_CSS_PATH), APPLICATION_CSS_PATH),
  });
  const tests = inspectTests(files);
  const packageContract = inspectPackages(files);
  const trackedReceipts = receipts(files);
  const currentProjection = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-fixtures-scenarios-fidelity",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    task: "M09-T11",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      propsOnlyCatalogScenarios: true,
      scenarioSourceAndBundleEphemeral: true,
      authoredSourceAndPublishablePreviewUnchanged: true,
      publicSyntheticFixtureProjection: true,
      exactSelectableFixtureOutcomes: ["success:user-1", "error:invalidCredentials"],
      pendingStaticFixtureClaimed: false,
      pendingRuntimeLifecycleExercised: true,
      exactOperationAndPreviewContextAuthorization: true,
      operationInputOrPasswordRetained: false,
      stableAppOwnedOperationPort: true,
      cleanupSynchronouslyRevokesFixtureAdmission: true,
      strictModeReplayRetainsOnlySameLiveFixtureLifetime: true,
      pendingRevokedOnPreviewReplacement: true,
      componentDragAuthorityLimitedToDedicatedHandleRetained: true,
      dedicatedLayerDragHandleRetained: true,
      separateNonDraggableComponentAddActionRetained: true,
      componentPanelWideDropSurfaceRetained: true,
      stickyComponentTargetDirectDropSurfaceRetained: true,
      stableGlobalLayerDragSessionRetained: true,
      globalLayerOwnerAndEpochFencingRetained: true,
      edgeScrollExactSlotRehitTestingRetained: true,
      layerDropHysteresisRetained: true,
      visibleExecutionContexts: ["synthetic", "integration", "production"],
      visibleApproximateFidelityDifferences: true,
      sameProductionAdapterDisclosure: true,
      integrationOrProductionExecutionClaimed: false,
      persistenceClaimed: false,
      diagnosticsClaimed: false,
      publicationClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      p09Status: "PARTIAL",
      p10Status: "PARTIAL",
      s001Status: "TESTED",
      pf025Status: "OPEN",
      pf028Status: "CLOSED",
      pf083Status: "OPEN",
      pf089Status: "OPEN",
    },
    authority: {
      source,
      protocolProfiles: {
        scenarios: "Catalog-declared props-only overlays in a separate ephemeral preview",
        fixtures: "public testkit synthetic projection with App-owned deferred Runtime port",
        context: "synthetic active; integration and production visible but unavailable",
        fidelity: "same/equivalent/approximate/undeclared with complete visible differences",
        lifecycle: "real Runtime pending followed by explicit fixture settlement",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "select an authenticated Source component",
        "choose Source values or one exact Catalog props-only scenario",
        "prepare a separate transient Source and Publisher preview Bundle",
        "bind one App fixture controller to the effective preview revision",
        "retain scenario and pending state across Design and Run presentation changes",
        "start a real Runtime operation pending lifecycle from the real adapter",
        "explicitly settle the captured success or invalidCredentials fixture",
        "synchronously revoke request admission and pending transport during effect cleanup",
        "dispose and revoke the controller when preview identity changes",
      ],
      ownership: {
        scenarioControl: "Desen App Inspector chrome",
        fixtureControl: "Desen App Run chrome",
        fidelityDisclosure: "Desen App persistent sibling chrome",
        managedCapabilitySubtree: "exact Runtime React adapter output",
        operationLifecycle: "Runtime Core through App-owned synthetic operation port",
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
      finalCommandWiringPinned: true,
    },
    result: "PASS",
    nonclaims: [
      "M09-T11 proves only controlled authoring scenarios and synthetic sign-in fixtures.",
      "Scenario state and scenario fixture overrides remain unsupported and fail closed.",
      "Integration and production contexts are visible but unavailable; no real service is called.",
      "M09-T12 durable save/open remains NOT_PROVEN.",
      "M09-T13 node-linked diagnostics and invalid placeholders remain NOT_PROVEN.",
      "M09-T14 publication and activation remain NOT_PROVEN.",
      "G09 and automated real-browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN; P-09 and P-10 remain PARTIAL.",
      "PF-025, PF-083, and PF-089 remain OPEN; no Catalog authoring hint or transient App profile becomes protocol authority.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-fixtures-scenarios-fidelity",
    profile: "desen.app.fixtures-scenarios-fidelity-proof.v1",
    task: "M09-T11",
    result: "PASS",
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      scenarioSourceAndBundleEphemeral: frozen.artifact.claim.scenarioSourceAndBundleEphemeral,
      pendingRuntimeLifecycleExercised: frozen.artifact.claim.pendingRuntimeLifecycleExercised,
      operationInputOrPasswordRetained: frozen.artifact.claim.operationInputOrPasswordRetained,
      s001Status: frozen.artifact.claim.s001Status,
      pf028Status: frozen.artifact.claim.pf028Status,
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
    sourcePersistenceSuccessor,
    nodeLinkedDiagnosticsSuccessor,
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
    "Task: M09-T11",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "P-09: PARTIAL",
    "P-10: PARTIAL",
    "S-001: TESTED",
    "PF-025: OPEN",
    "PF-028: CLOSED",
    "PF-083: OPEN",
    "PF-089: OPEN",
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

/** Verifies committed M09-T11 bytes and the visible report digest. */
export async function verifyDesenAppFixturesScenariosFidelityEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppFixturesScenariosFidelityEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T11 artifact bytes differ from fresh evidence.");
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
    s001Status: built.artifact.claim.s001Status,
    pf028Status: built.artifact.claim.pf028Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T11 proof bytes. */
export async function writeDesenAppFixturesScenariosFidelityEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_FIXTURES_SCENARIOS_FIDELITY_ARTIFACT_PATH,
  );
  const built = await buildDesenAppFixturesScenariosFidelityEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T11 artifact write failed safely.", {
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
