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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-SOURCE-PERSISTENCE.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const SOURCE_FIXTURE_PATH = "examples/sign-in/official-derived.source.desen.json";
const BUNDLE_FIXTURE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const SHELL_PARENT_PATH = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const EDITOR_PERSISTENCE_PARENT_PATH = "docs/proof/artifacts/editor-core-0.1.0-persistence.json";
const FIXTURES_PARENT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";

const SOURCE_PATHS = Object.freeze({
  authoringData: "apps/desen-app/src/authoring-data.ts",
  authoringPreview: "apps/desen-app/src/authoring-preview.ts",
  authoringFixtures: "apps/desen-app/src/authoring-fixtures.ts",
  authoringScenarios: "apps/desen-app/src/authoring-scenarios.ts",
  previewFidelity: "apps/desen-app/src/preview-fidelity.ts",
  previewControls: "apps/desen-app/src/preview-controls.tsx",
  adapterCanvas: "apps/desen-app/src/adapter-canvas.tsx",
  application: "apps/desen-app/src/application.tsx",
  applicationCss: "apps/desen-app/src/application.module.css",
  inspectorPanel: "apps/desen-app/src/inspector-panel.tsx",
  statePanel: "apps/desen-app/src/state-panel.tsx",
  projectNavigation: "apps/desen-app/src/project-navigation.ts",
  persistence: "apps/desen-app/src/authoring-persistence.ts",
  persistenceControls: "apps/desen-app/src/persistence-controls.tsx",
});

const TEST_PATHS = Object.freeze({
  persistence: "apps/desen-app/test/authoring-persistence.test.ts",
  controls: "apps/desen-app/test/persistence-controls.test.tsx",
  application: "apps/desen-app/test/persistence-application.test.tsx",
  navigation: "apps/desen-app/test/project-navigation.test.ts",
  shell: "apps/desen-app/test/application.test.tsx",
  inspectorCompatibility: "apps/desen-app/test/inspector-panel.test.tsx",
  stateCompatibility: "apps/desen-app/test/state-panel.test.tsx",
});

const FOCUSED_TEST_PATHS = Object.freeze([
  TEST_PATHS.persistence,
  TEST_PATHS.controls,
  TEST_PATHS.application,
  TEST_PATHS.navigation,
  TEST_PATHS.shell,
]);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-source-persistence-proof.mjs",
  "scripts/generate-desen-app-source-persistence-proof.mjs",
  "scripts/verify-desen-app-source-persistence.mjs",
  "tests/desen-app-source-persistence.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  CATALOG_PATH,
  SOURCE_FIXTURE_PATH,
  BUNDLE_FIXTURE_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(TEST_PATHS),
  SHELL_PARENT_PATH,
  EDITOR_PERSISTENCE_PARENT_PATH,
  FIXTURES_PARENT_PATH,
  ...PROOF_READER_PATHS,
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
  "scripts/lib/desen-app-source-persistence-proof.mjs",
  "tests/desen-app-source-persistence.test.mjs",
]);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ...T14_SUCCESSOR_RECEIPT_PATHS,
  ...SELF_RESEALED_PATHS,
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 27_053,
  sha256: "717d0ddada008edb34909d5defcc4c28e95b36f6dfc0b1abb4d09d9775a6b734",
});

const EXPECTED_FOCUSED_TEST_CASE_COUNTS = Object.freeze({
  [TEST_PATHS.persistence]: 30,
  [TEST_PATHS.controls]: 22,
  [TEST_PATHS.application]: 17,
  [TEST_PATHS.navigation]: 32,
  [TEST_PATHS.shell]: 42,
});

const EXPECTED_TEST_DECLARATION_COUNTS = Object.freeze({
  [TEST_PATHS.persistence]: 24,
  [TEST_PATHS.controls]: 12,
  [TEST_PATHS.application]: 17,
  [TEST_PATHS.navigation]: 12,
  [TEST_PATHS.shell]: 38,
});

const REQUIRED_TEST_NAMES = Object.freeze({
  [TEST_PATHS.persistence]: Object.freeze([
    "derives the exact project-owned local key without consulting Source.id",
    "derives clean replacements from complete canonical authored content",
    "fails closed and remains retryable for malformed open settlements without invoking accessors",
    "treats every malformed dispatched save settlement as indeterminate until reopen",
    "rechecks open authority after settlement capture and opened-document admission",
    "rechecks save authority after settlement capture re-entry",
    "publishes opening synchronously and swaps document plus preview atomically after admission",
    "prevents an open settlement from overwriting an authored edit made while reading",
    "saves the authored snapshot with exact route key and generation precondition",
    "retains a newer authored edit while an earlier save snapshot settles",
    "keeps save settlement %# distinct",
    "revokes pending async authority on dispose and stops future notifications",
  ]),
  [TEST_PATHS.controls]: Object.freeze([
    "requires explicit inline confirmation before a dirty Source can be opened",
    "revokes a dirty-open confirmation when its exact authority identity changes",
    "blocks both actions outside Design mode and explains admission",
    "admits reopen but blocks save after conflict, uncertainty, or generation exhaustion",
  ]),
  [TEST_PATHS.application]: Object.freeze([
    "keeps persistence visibly unavailable when the host injects no public port",
    "protects an edited no-port draft across navigation, traversal, and page exit",
    "requires explicit, cancelable confirmation before dirty Open can replace the draft",
    "opens one exact accepted Source atomically and clears transient editor and fixture state",
    "protects a dirty pending session across canceled links, traversal, and page exit",
    "keeps one injected persistence controller live through StrictMode replay",
    "never sends Catalog scenario values or Runtime form secrets to the persistence port",
    "keeps a newer edit dirty when an older Source snapshot settles in flight",
  ]),
  [TEST_PATHS.navigation]: Object.freeze([
    "admits canonical app navigation only through the current exact guard owner",
    "restores the last admitted location when traversal is canceled or guard admission throws",
  ]),
  [TEST_PATHS.shell]: Object.freeze([
    "renders an app-native projects gallery with explicit landmarks and current navigation",
    "keeps Catalog scenarios transient across Design and Run without changing Source values",
    "runs real pending lifecycle and settles only exact synthetic success and failure fixtures",
  ]),
});

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

/** Exact reviewed App cases in the five-file M09-T12 focused suite. */
export const DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES = 142;
const CURRENT_DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES = 143;

/** Exact immutable proof receipts bounding the M09-T12 App authority. */
export const DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS = Object.freeze([
  Object.freeze({
    task: "M09-T01",
    proofId: "desen-app-shell-navigation",
    path: SHELL_PARENT_PATH,
    bytes: 12_118,
    sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
    profile: "desen.app.shell-navigation-proof.v1",
    result: "PASS",
    immutable: true,
  }),
  Object.freeze({
    task: "M08-T08",
    proofId: "editor-core-persistence",
    path: EDITOR_PERSISTENCE_PARENT_PATH,
    bytes: 49_785,
    sha256: "51932d4165afff3c40fae6769527e480f6d0ff355f3fbc6d8ae7c6809e50a6fe",
    profile: "desen.editor-core.persistence-proof.v1",
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
]);

/** Reviewed independent root-test names retained by the M09-T12 artifact. */
export const DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates exact shell, Editor persistence, and T11 App parents",
  "[source] proves one route-owned Source identity through the public Editor Core port",
  "[open] proves exact settlement capture, admission, retryable malformed failure, and draft preservation",
  "[save] proves copied diagnostics, CAS relationships, malformed uncertainty, and reentrant revocation",
  "[dirty] proves complete canonical-content baselines, reverts, and stale settlement isolation",
  "[ui] proves Design-only controls, visible state, and explicit dirty-open confirmation",
  "[navigation] proves pristine admission plus dirty no-port and port-backed navigation protection",
  "[boundary] proves authored Source only and excludes scenario, secret, and concrete storage",
  "[tests] retains exact five-file 142-case focused evidence",
  "[determinism] builds byte-identical detached evidence twice",
  "[policy] rejects persistence, navigation, UI, test, and package weakening",
  "[verification] rejects parent, artifact, report, and destination authority drift",
]);

/** Default destination for deterministic M09-T12 evidence. */
export const DEFAULT_DESEN_APP_SOURCE_PERSISTENCE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T12 evidence reader. */
export class DesenAppSourcePersistenceProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppSourcePersistenceProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppSourcePersistenceProofError(code, message, details);
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
    if (error instanceof DesenAppSourcePersistenceProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
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

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    fail(code, `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) fail(code, `${label} lost required M09-T12 policy.`, { missing });
}

function assertOccurrenceCount(source, marker, expected, label, code = "SOURCE_POLICY_VIOLATION") {
  const actual = source.split(marker).length - 1;
  if (actual !== expected) {
    fail(code, `${label} exact M09-T12 policy occurrence count drifted.`, {
      marker,
      actual,
      expected,
    });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden authority.`, { present });
  }
}

function parseTypeScript(source, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  const kind = relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, kind);
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
      const specifier = node.moduleSpecifier.text;
      imports.push(specifier);
      if (
        specifier.includes("@desen/editor-web") ||
        specifier.includes("control-plane") ||
        specifier.includes("runtime-web")
      ) {
        violations.push(`import:${specifier}`);
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
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} acquired executable storage authority.`, {
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

/** Verifies the complete App-owned M09-T12 persistence source boundary. */
export function verifyDesenAppSourcePersistenceSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const imports = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(([, relativePath]) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"))
      .map(([key, relativePath]) => [key, inspectImports(input[key], relativePath)]),
  );

  assertIncludes(
    input.persistence,
    [
      'from "@desen/editor-core"',
      'import { canonicalizeJson, isJsonPointer } from "@desen/protocol"',
      'const AUTHORIZED_PROJECT_ID = "account-app"',
      'const AUTHORIZED_SURFACE_ID = "sign-in"',
      'const AUTHORIZED_DOCUMENT_ID = "com.example.account-app"',
      'const AUTHORIZED_SOURCE_KEY = "account-app-source"',
      "const MAX_GENERATION = Number.MAX_SAFE_INTEGER",
      'const PERSISTENCE_PORT_KEYS = Object.freeze(["openSource", "saveSource"])',
      "function exactOwnData(",
      "function allowedOwnData(",
      "const keys = Reflect.ownKeys(input)",
      "const descriptor = Object.getOwnPropertyDescriptor(input, key)",
      'descriptor?.enumerable !== true || !("value" in descriptor)',
      "output[key] = descriptor.value",
      "values.projectId !== AUTHORIZED_PROJECT_ID",
      "values.surfaceId !== AUTHORIZED_SURFACE_ID",
      "prepareCatalogAuthoringModel(catalog, document)",
      "prepareAuthoringPreviewBundle(prepared.model.validationDocument)",
      "prepared.model.validationDocument.id !== AUTHORIZED_DOCUMENT_ID",
      "readonly canonicalDocument: string",
      "canonicalDocument = canonicalizeJson(prepared.model.validationDocument)",
      "function captureDiagnosticSubject(",
      'const values = exactOwnData(input, ["id", "kind"])',
      'values.kind !== "node" && values.kind !== "behavior"',
      "return Object.freeze({ kind: values.kind, id: values.id })",
      "function captureDiagnosticContext(",
      'allowedOwnData(input, ["capabilityId", "documentId", "subject", "surfaceId"])',
      "return Object.keys(output).length === 0 ? undefined : Object.freeze(output)",
      "function capturePersistenceDiagnostic(",
      'allowedOwnData(input, ["code", "context", "message", "pointer"])',
      "values.pointer !== undefined && !isJsonPointer(values.pointer)",
      "values.context === undefined ? undefined : captureDiagnosticContext(values.context)",
      "...(values.pointer !== undefined ? { pointer: values.pointer } : {})",
      "...(context !== undefined ? { context } : {})",
      "function captureOpenSettlement(input: unknown)",
      'const opened = exactOwnData(input, ["document", "generation", "status"])',
      'opened?.status === "opened" && positiveGeneration(opened.generation)',
      "function captureSaveSettlement(",
      "expectedGeneration === null && generated.generation === 1",
      "expectedGeneration < MAX_GENERATION",
      "generated.generation === expectedGeneration + 1",
      "return expectedGeneration !== null && generated.generation === expectedGeneration",
      "expectedGeneration === MAX_GENERATION && generated.generation === MAX_GENERATION",
      "currentGeneration === null || positiveGeneration(currentGeneration)",
      "currentGeneration === expectedGeneration",
      "let currentDocumentCanonical = initialAdmission.canonicalDocument",
      "let savedDocumentCanonical: string | null = null",
      "if (admitted.canonicalDocument === currentDocumentCanonical)",
      "currentDocumentCanonical = admitted.canonicalDocument",
      "state.reopenRequired ||",
      "savedDocumentCanonical === null ||",
      "currentDocumentCanonical !== savedDocumentCanonical",
      "const snapshotDocument = state.session.document",
      "const snapshotDocumentCanonical = currentDocumentCanonical",
      "const expectedGeneration = state.generation",
      "Object.freeze({ sourceKey, expectedGeneration, document: snapshotDocument })",
      "let rawPortResult: unknown",
      "rawPortResult = await openSource(sourceKey)",
      "const portResult = captureOpenSettlement(rawPortResult)",
      "const portResult = captureOpenSettlement(rawPortResult);\n    if (\n      state.disposed ||",
      "if (portResult === undefined)",
      "rawPortResult = await saveSource(",
      "const result = captureSaveSettlement(rawPortResult, expectedGeneration)",
      "if (result === undefined)",
      "const indeterminate = unexpectedSaveIndeterminate()",
      "if (state.reopenRequired)",
      "unexpectedSaveIndeterminate()",
      "documentVersion !== openedAtDocumentVersion",
      "const admitted = admitSession(capturedCatalog, portResult.document)",
      "const admitted = admitSession(capturedCatalog, portResult.document);\n    if (\n      state.disposed ||",
      "const result = captureSaveSettlement(rawPortResult, expectedGeneration);\n    if (state.disposed || currentOperation !== token)",
      "savedDocumentCanonical = admitted.canonicalDocument",
      "savedDocumentCanonical = snapshotDocumentCanonical",
      "dirty: currentDocumentCanonical !== snapshotDocumentCanonical",
      'result.status === "conflict"',
      'result.status === "generation-exhausted"',
      'result.status === "indeterminate"',
      "currentOperation = null",
      "listeners.clear()",
    ],
    SOURCE_PATHS.persistence,
  );
  assertOccurrenceCount(
    input.persistence,
    "let rawPortResult: unknown",
    2,
    SOURCE_PATHS.persistence,
  );
  assertOccurrenceCount(
    input.persistence,
    "const descriptor = Object.getOwnPropertyDescriptor(input, key)",
    2,
    SOURCE_PATHS.persistence,
  );
  assertOccurrenceCount(
    input.persistence,
    'descriptor?.enumerable !== true || !("value" in descriptor)',
    2,
    SOURCE_PATHS.persistence,
  );
  assertOccurrenceCount(
    input.persistence,
    "state.disposed ||\n      currentOperation !== token ||\n      documentVersion !== openedAtDocumentVersion",
    3,
    SOURCE_PATHS.persistence,
  );
  assertExcludes(
    input.persistence,
    [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "@desen/editor-web",
      "fetch(",
      "const snapshotDocumentVersion = documentVersion",
      "dirty: documentVersion !== snapshotDocumentVersion",
    ],
    SOURCE_PATHS.persistence,
  );

  assertIncludes(
    input.persistenceControls,
    [
      "readonly confirmationScope: object | null",
      "const confirmationVisible =",
      "projection.dirty &&",
      "if (projection.dirty)",
      "setConfirmation(Object.freeze({ scope: confirmationScope, statusKey }))",
      'aria-live="polite"',
      'aria-label="Source persistence"',
      'data-reopen-required="true"',
      "Open and save are available in Design mode.",
      "Discard unsaved changes?",
      "Cancel open",
      "Discard changes and open",
      'projection.status.state === "unavailable" && !projection.dirty',
      'return "Local draft unchanged"',
    ],
    SOURCE_PATHS.persistenceControls,
  );

  assertIncludes(
    input.projectNavigation,
    [
      "let installedNavigationGuard: InstalledNavigationGuard | null = null",
      "export function installDesenAppNavigationGuard",
      "installedNavigationGuard = Object.freeze({ guard, owner })",
      "if (installedNavigationGuard?.owner === owner) installedNavigationGuard = null",
      "return guard(destination) === true",
      "catch {\n    return false",
      'window.history.pushState(null, "", acceptedLocation)',
      "if (!navigationIsAdmitted(destination.pathname)) return",
    ],
    SOURCE_PATHS.projectNavigation,
  );

  assertIncludes(
    input.application,
    [
      'from "@desen/editor-core"',
      'import { canonicalizeJson, digestCanonicalJson } from "@desen/protocol"',
      "createAuthoringPersistenceController({",
      "persistencePort === null",
      "dirty: state?.dirty ?? inMemoryDirty",
      "const REFERENCE_EDITOR_DOCUMENT_CANONICAL = canonicalizeJson(REFERENCE_EDITOR_DOCUMENT)",
      "const inMemoryBaselineCanonical = useRef(REFERENCE_EDITOR_DOCUMENT_CANONICAL)",
      "const inMemoryCurrentCanonical = useRef(REFERENCE_EDITOR_DOCUMENT_CANONICAL)",
      "const inMemoryDraftDirty = useRef(false)",
      "const [inMemoryDirtyProjection, setInMemoryDirtyProjection] = useState(false)",
      "const dirty = inMemoryCurrentCanonical.current !== inMemoryBaselineCanonical.current",
      "setInMemoryDirtyProjection((current) => (current === dirty ? current : dirty))",
      "persistenceControllerLifetime.current = persistenceController",
      "inMemoryBaselineCanonical.current = canonicalizeJson(persistenceState.savedDocument)",
      "if (persistenceController === null) return inMemoryDraftDirty.current",
      "installDesenAppNavigationGuard(() =>",
      "window.confirm(",
      'window.addEventListener("beforeunload", protectPageExit)',
      "persistenceController.replaceAuthoredDocument(document)",
      "establishesBaseline = false",
      "const canonicalDocument = canonicalizeJson(nextSession.document)",
      "inMemoryCurrentCanonical.current = canonicalDocument",
      "if (establishesBaseline) inMemoryBaselineCanonical.current = canonicalDocument",
      "updateInMemoryDirtyProjection()",
      "const result = await persistenceController.open()",
      "persistenceController.read().session !== result.session",
      "commitAuthoringSession(result.session, true)",
      "setSelection(null)",
      "AUTHORING_SOURCE_SCENARIO_VALUE",
      "void persistenceController.save()",
      "readonly persistencePort?: DesenEditorPersistencePort | null",
      "export function DesenAppApplication({",
      "persistencePort = null,",
      "publicationPort = null,",
    ],
    SOURCE_PATHS.application,
  );
  assertOccurrenceCount(input.application, "setAuthoringSession(", 1, SOURCE_PATHS.application);
  assertOccurrenceCount(input.application, "commitAuthoringSession(", 8, SOURCE_PATHS.application);
  assertOccurrenceCount(input.application, "canonicalizeJson(", 5, SOURCE_PATHS.application);
  assertExcludes(
    input.application,
    [
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "@desen/editor-web",
      "@desen/control-plane",
      "dirty: state?.dirty ?? true",
    ],
    SOURCE_PATHS.application,
  );

  assertIncludes(
    input.applicationCss,
    [
      ".persistenceControls {",
      '.persistenceControls[data-persistence-state="conflict"]',
      ".persistenceActions button:disabled",
      '.persistenceMeta > span[data-dirty="true"]',
      ".persistenceOpenConfirmation {",
      ".persistenceOpenConfirmation[hidden]",
      ".persistenceOpenConfirmation button:focus-visible",
    ],
    SOURCE_PATHS.applicationCss,
  );
  assertIncludes(
    input.inspectorPanel,
    ["Edits remain local until Save source succeeds."],
    SOURCE_PATHS.inspectorPanel,
  );
  assertIncludes(
    input.statePanel,
    ["State edits remain local until Save source succeeds."],
    SOURCE_PATHS.statePanel,
  );

  return deepFreeze({
    imports,
    route: { projectId: "account-app", surfaceId: "sign-in" },
    sourceKey: "account-app-source",
    documentId: "com.example.account-app",
    publicEditorCorePersistencePort: true,
    authoredSourceOnly: true,
    scenarioPreviewPersisted: false,
    runtimeInputOrSecretPersisted: false,
    exactOwnDataAuthorityCapture: true,
    awaitedSettlementsCapturedAsExactOwnEnumerableData: true,
    settlementAccessorInvocation: false,
    validOptionalDiagnosticDataCopiedAndFrozen: true,
    casGenerationRelationshipsValidated: true,
    openAdmissionAtomic: true,
    openedDocumentReauthorized: true,
    failedOrRejectedOpenPreservesDraft: true,
    malformedOpenRetryableAndDraftPreserved: true,
    generationCompareAndSet: true,
    automaticRetryOrMerge: false,
    uncertaintyRequiresReopen: true,
    malformedSaveIndeterminateAndReopenRequired: true,
    newerEditRemainsDirtyAfterOlderSave: true,
    completeAuthoredSourceCanonicalDirtyComparison: true,
    identityOrVersionDirtyAuthority: false,
    sameCanonicalReplacementRemainsClean: true,
    canonicalRevertReturnsClean: true,
    successfulOpenOrSaveEstablishesCanonicalBaseline: true,
    staleOpenCannotReplaceEditedSession: true,
    staleLifetimeSettlementIgnored: true,
    postReflectionAndAdmissionAuthorityRechecked: true,
    reentrantSettlementCannotPublishRevokedState: true,
    dirtyOpenRequiresExplicitConfirmation: true,
    navigationAndPageExitGuarded: true,
    centralizedAuthoringSessionCommit: true,
    noPortCanonicalBaselineAndCurrentTracked: true,
    noPortDirtyProjectionRerenderSafe: true,
    cleanNoPortLabelAccurate: true,
    pristineNoPortNavigationAdmitted: true,
    editedNoPortDraftNavigationAndPageExitGuarded: true,
    designModeOnlyControls: true,
    visibleGenerationDirtyAndReopenState: true,
    concretePersistenceAdapterClaimed: false,
  });
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

function inspectTestFile(source, relativePath) {
  const sourceFile = parseTypeScript(source, relativePath, "TEST_POLICY_VIOLATION");
  const arrays = collectArrayDeclarations(sourceFile);
  let declarations = 0;
  let cases = 0;
  const names = [];

  const visit = (node, multiplier = 1) => {
    if (ts.isForOfStatement(node)) {
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
        const eachFactory = node.expression;
        if (
          ts.isPropertyAccessExpression(eachFactory.expression) &&
          ts.isIdentifier(eachFactory.expression.expression) &&
          ["it", "test"].includes(eachFactory.expression.expression.text) &&
          eachFactory.expression.name.text === "each"
        ) {
          const length =
            eachFactory.arguments[0] === undefined
              ? undefined
              : arrayLength(eachFactory.arguments[0], arrays);
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
    Object.values(TEST_PATHS).map((relativePath) => [
      relativePath,
      inspectTestFile(decodeUtf8(files.get(relativePath), relativePath), relativePath),
    ]),
  );
  for (const relativePath of FOCUSED_TEST_PATHS) {
    const inventory = inventories[relativePath];
    if (
      inventory.declarations !== EXPECTED_TEST_DECLARATION_COUNTS[relativePath] ||
      inventory.cases !== EXPECTED_FOCUSED_TEST_CASE_COUNTS[relativePath]
    ) {
      fail("TEST_POLICY_VIOLATION", `${relativePath} exact test inventory drifted.`, {
        actual: { declarations: inventory.declarations, cases: inventory.cases },
        expected: {
          declarations: EXPECTED_TEST_DECLARATION_COUNTS[relativePath],
          cases: EXPECTED_FOCUSED_TEST_CASE_COUNTS[relativePath],
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
  if (focusedTestCases !== CURRENT_DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES) {
    fail("TEST_POLICY_VIOLATION", "The current compatible focused case count drifted.");
  }
  const inspectorSource = decodeUtf8(
    files.get(TEST_PATHS.inspectorCompatibility),
    TEST_PATHS.inspectorCompatibility,
  );
  const stateSource = decodeUtf8(
    files.get(TEST_PATHS.stateCompatibility),
    TEST_PATHS.stateCompatibility,
  );
  assertIncludes(
    inspectorSource,
    ["Edits remain local until Save source succeeds."],
    TEST_PATHS.inspectorCompatibility,
    "TEST_POLICY_VIOLATION",
  );
  assertIncludes(
    stateSource,
    ["without persistence claims", "State edits remain local until Save source succeeds."],
    TEST_PATHS.stateCompatibility,
    "TEST_POLICY_VIOLATION",
  );
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:persistence && node --test tests/desen-app-source-persistence.test.mjs",
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
    rootTestNames: DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES,
    semanticCoverage: [
      "EXACT_PROJECT_SCOPED_SOURCE_KEY",
      "PUBLIC_EDITOR_CORE_PERSISTENCE_PORT",
      "EXACT_OWN_ENUMERABLE_SETTLEMENT_CAPTURE_WITHOUT_ACCESSORS",
      "VALIDATED_FRESH_FROZEN_OPTIONAL_DIAGNOSTIC_COPY",
      "CAS_SETTLEMENT_GENERATION_RELATIONSHIPS",
      "MALFORMED_OPEN_RETRYABLE_DRAFT_PRESERVATION",
      "MALFORMED_SAVE_INDETERMINATE_REOPEN_LOCK",
      "POST_REFLECTION_AND_ADMISSION_REENTRANT_AUTHORITY_RECHECK",
      "ATOMIC_OPEN_ADMISSION_AND_DRAFT_PRESERVATION",
      "GENERATION_COMPARE_AND_SET_WITHOUT_RETRY_OR_MERGE",
      "INDETERMINATE_CONFLICT_AND_EXHAUSTION_REOPEN_LOCK",
      "NEWER_EDIT_AND_STALE_LIFETIME_ISOLATION",
      "COMPLETE_AUTHORED_SOURCE_CANONICAL_DIRTY_BASELINE",
      "CANONICAL_SAME_VALUE_AND_REVERT_CLEANLINESS",
      "SAVE_SETTLEMENT_CURRENT_VERSUS_SNAPSHOT_CANONICAL",
      "DIRTY_OPEN_INLINE_CONFIRMATION",
      "DIRTY_NAVIGATION_TRAVERSAL_AND_PAGE_EXIT_GUARD",
      "NO_PORT_PRISTINE_ADMISSION_AND_EDITED_DRAFT_GUARD",
      "NO_PORT_CANONICAL_BASELINE_CURRENT_AND_RERENDER_PROJECTION",
      "CLEAN_NO_PORT_STATUS_LABEL",
      "CENTRALIZED_AUTHORED_SESSION_COMMIT",
      "AUTHORED_SOURCE_ONLY_NO_SCENARIO_OR_RUNTIME_SECRET",
      "STRICT_MODE_AND_HOST_AUTHORITY_REPLACEMENT",
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
    "vitest run test/authoring-persistence.test.ts test/persistence-controls.test.tsx test/persistence-application.test.tsx test/project-navigation.test.ts test/application.test.tsx";
  if (app.name !== "@desen/app-web" || app.scripts?.["test:persistence"] !== appCommand) {
    fail("PACKAGE_POLICY_VIOLATION", "The exact Desen App persistence command drifted.");
  }
  if (app.dependencies?.["@desen/editor-core"] !== "workspace:*") {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App lost the public Editor Core dependency.");
  }
  if (app.dependencies?.["@desen/editor-web"] !== undefined) {
    fail("PACKAGE_POLICY_VIOLATION", "Desen App acquired Editor Web persistence authority.");
  }
  const prefix =
    "node scripts/verify-desen-app-shell-navigation.mjs && node scripts/verify-editor-core-persistence.mjs && node scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:persistence && ";
  const expectedRootCommands = {
    "generate:desen-app-source-persistence":
      prefix + "node scripts/generate-desen-app-source-persistence-proof.mjs",
    "verify:desen-app-source-persistence":
      prefix + "node scripts/verify-desen-app-source-persistence.mjs",
    "test:desen-app-source-persistence":
      prefix + "node --test tests/desen-app-source-persistence.test.mjs",
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
    editorWebDependency: null,
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
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    artifact.claim?.taskStatus !== "DONE"
  ) {
    fail("PARENT_DRIFT", `The frozen ${pin.task} identity drifted.`);
  }
  if (
    pin.task === "M09-T01" &&
    (artifact.claim?.shellImplemented !== true ||
      artifact.claim?.projectNavigationImplemented !== true ||
      artifact.claim?.directUrlNavigationImplemented !== true ||
      artifact.claim?.unknownRoutesFailClosed !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T01 shell authority drifted.");
  }
  if (
    pin.task === "M08-T08" &&
    (artifact.claim?.platformNeutralPort !== true ||
      artifact.claim?.generationCompareAndSet !== true ||
      artifact.claim?.sourceKeyIndependentOfSourceId !== true ||
      artifact.claim?.uncertainCommitRequiresReopen !== true)
  ) {
    fail("PARENT_DRIFT", "The frozen M08-T08 persistence authority drifted.");
  }
  if (
    pin.task === "M09-T11" &&
    (artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
      artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
      artifact.claim?.operationInputOrPasswordRetained !== false ||
      artifact.claim?.persistenceClaimed !== false)
  ) {
    fail("PARENT_DRIFT", "The frozen M09-T11 App authority drifted.");
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
    "frozen M09-T12 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T12 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T12 proof artifact");
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact.schemaVersion !== 1 ||
    artifact.task !== "M09-T12" ||
    artifact.proofId !== "desen-app-source-persistence" ||
    artifact.profile !== "desen.app.source-persistence-proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.publicEditorCorePersistencePort !== true ||
    artifact.claim?.authoredSourceOnly !== true ||
    artifact.claim?.diagnosticsClaimed !== false ||
    artifact.tests?.focusedTestCases !== DESEN_APP_SOURCE_PERSISTENCE_FOCUSED_TEST_CASES ||
    artifact.tests?.fullAppTestFiles !== 22 ||
    artifact.tests?.fullAppTestCases !== 324 ||
    artifact.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    artifact.boundary?.parentArtifacts !== 3 ||
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
    !isDeepStrictEqual(artifact.tests?.rootTestNames, DESEN_APP_SOURCE_PERSISTENCE_ROOT_TEST_NAMES)
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T12 identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T12 task-time receipt drifted: ${relativePath}.`);
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
  const appPackage = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
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

/** Builds detached deterministic M09-T12 Source persistence evidence. */
export async function buildDesenAppSourcePersistenceEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files] = await Promise.all([
    authenticateFrozenArtifact(workspaceRoot),
    readTrackedFiles(workspaceRoot, options.fileOverrides),
  ]);
  const parents = DESEN_APP_SOURCE_PERSISTENCE_PARENT_PINS.map((pin) =>
    authenticateParent(files.get(pin.path), pin),
  );
  const source = verifyDesenAppSourcePersistenceSourcePolicy(
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
    proofId: "desen-app-source-persistence",
    profile: "desen.app.source-persistence-proof.v1",
    task: "M09-T12",
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: parents,
    claim: {
      taskStatus: "DONE",
      publicEditorCorePersistencePort: true,
      exactProjectScopedSourceKey: "account-app-source",
      sourceKeyIndependentOfDocumentId: true,
      authoredSourceOnly: true,
      scenarioPreviewPersisted: false,
      runtimeInputOrSecretPersisted: false,
      awaitedSettlementsCapturedAsExactOwnEnumerableData: true,
      settlementAccessorInvocation: false,
      validOptionalDiagnosticDataCopiedAndFrozen: true,
      casGenerationRelationshipsValidated: true,
      openAdmissionAtomic: true,
      openedDocumentReauthorized: true,
      failedOrRejectedOpenPreservesDraft: true,
      malformedOpenRetryableAndDraftPreserved: true,
      createUpdateUnchangedGenerationCas: true,
      conflictOrIndeterminateRequiresReopen: true,
      generationExhaustionRequiresReopen: true,
      automaticRetryOrMerge: false,
      unexpectedDispatchedSaveIndeterminate: true,
      malformedSaveIndeterminateAndReopenRequired: true,
      newerEditRemainsDirtyAfterOlderSave: true,
      completeAuthoredSourceCanonicalDirtyComparison: true,
      identityOrVersionDirtyAuthority: false,
      sameCanonicalReplacementRemainsClean: true,
      canonicalRevertReturnsClean: true,
      successfulOpenOrSaveEstablishesCanonicalBaseline: true,
      staleOpenCannotReplaceEditedSession: true,
      staleLifetimeSettlementIgnored: true,
      postReflectionAndAdmissionAuthorityRechecked: true,
      reentrantSettlementCannotPublishRevokedState: true,
      dirtyOpenRequiresExplicitConfirmation: true,
      navigationAndPageExitGuarded: true,
      centralizedAuthoringSessionCommit: true,
      noPortCanonicalBaselineAndCurrentTracked: true,
      noPortDirtyProjectionRerenderSafe: true,
      cleanNoPortLabelAccurate: true,
      pristineNoPortNavigationAdmitted: true,
      editedNoPortDraftNavigationAndPageExitGuarded: true,
      designModeOnlyControls: true,
      visibleGenerationDirtyAndReopenState: true,
      concretePersistenceAdapterClaimed: false,
      diagnosticsClaimed: false,
      publicationClaimed: false,
      activationClaimed: false,
      browserE2eClaimed: false,
      p08Status: "NOT_PROVEN",
      n012Status: "TESTED",
      n018Status: "TESTED",
      s003Status: "TESTED",
      pf085Status: "OPEN",
      pf089Status: "OPEN",
    },
    authority: {
      source,
      protocolProfiles: {
        storageIdentity: "one route-owned account-app-source key independent of Source.id",
        port: "public Editor Core DesenEditorPersistencePort injected by the trusted host",
        settlementCapture:
          "awaited open/save values captured only from exact own enumerable data descriptors without invoking accessors",
        diagnostics:
          "recognized diagnostic code plus valid optional pointer, context, and subject copied into fresh frozen data",
        open: "complete Source plus publishable preview admitted atomically before replacement",
        save: "exact immutable authored Source snapshot with validated expected-generation CAS settlement relationships",
        dirty:
          "complete admitted authored Source canonical content compared across current, saved, and dispatched snapshots",
        uncertainty: "conflict, exhaustion, and uncertainty require an explicit reopen",
        noPort:
          "surface-owned canonical baseline/current refs with a rerender-safe dirty projection and accurate clean local-draft label",
        navigation:
          "pristine no-port navigation is admitted while edited no-port and port-backed dirty drafts require admission",
      },
    },
    application: {
      package: packageContract,
      flow: [
        "capture one exact project route and public persistence port",
        "capture awaited settlements from exact own enumerable data without invoking accessors",
        "copy valid optional diagnostic pointer, context, and subject into fresh frozen data",
        "derive the fixed project-owned Source key",
        "open then reauthorize document id, Catalog projection, surface, and preview",
        "keep malformed Open retryable while preserving the draft and lock malformed Save as indeterminate until reopen",
        "hold and recheck the operation token after settlement reflection and opened-document admission",
        "replace authored Source and preview only after complete admission",
        "save only the controller's immutable authored Source snapshot with expected generation",
        "validate every created, updated, unchanged, conflict, and exhausted generation relationship",
        "derive dirty state from complete admitted Source canonical content rather than identity or version",
        "keep a newer canonical edit dirty, or clean a canonical revert, when an earlier snapshot settles",
        "establish the canonical baseline only after an admitted Open or successful Save",
        "label a clean no-port state as Local draft unchanged rather than saved",
        "require reopen after conflict, exhausted generation, or uncertain commit",
        "commit every authored-session replacement through one centralized dirty-state owner",
        "admit pristine no-port navigation while guarding edited no-port and port-backed dirty drafts",
        "confirm destructive dirty Open or navigation and protect dirty page exit",
        "ignore stale work after edit, route unmount, StrictMode replay, or host replacement",
      ],
      ownership: {
        persistencePort: "trusted host injection using the public Editor Core interface",
        sourceIdentity: "Desen App fixed project route",
        authoredDocument: "App authoring session only",
        dirtyProjection:
          "current surface/controller canonical baseline, current content, and rerender-safe projection",
        persistenceControls: "Desen App Design chrome",
        navigationGuard: "current surface/controller lifetime",
        concreteStorage: "not owned or claimed by the App",
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
      "M09-T12 proves only App-owned authored Source persistence over an injected public port.",
      "The App does not provide or claim a concrete browser, native, or control-plane adapter.",
      "Catalog scenarios, fixture state, Runtime input, and secrets are not persistence inputs.",
      "M09-T13 node-linked diagnostics and invalid placeholders remain NOT_PROVEN.",
      "M09-T14 publication and activation remain NOT_PROVEN.",
      "G09 and automated real-browser E2E remain NOT_PROVEN.",
      "P-08 remains NOT_PROVEN; PF-085 and PF-089 remain OPEN.",
      "No required-gate, global CI count, or hosted-CI pass is inferred from local evidence.",
    ],
  });
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-source-persistence",
    profile: "desen.app.source-persistence-proof.v1",
    task: "M09-T12",
    result: "PASS",
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      publicEditorCorePersistencePort: frozen.artifact.claim.publicEditorCorePersistencePort,
      authoredSourceOnly: frozen.artifact.claim.authoredSourceOnly,
      diagnosticsClaimed: frozen.artifact.claim.diagnosticsClaimed,
      p08Status: frozen.artifact.claim.p08Status,
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
    "Task: M09-T12",
    "Status: DONE",
    "P-08: NOT_PROVEN",
    "N-012: TESTED",
    "N-018: TESTED",
    "S-003: TESTED",
    "PF-085: OPEN",
    "PF-089: OPEN",
    "M09-T13: NOT_PROVEN",
    "M09-T14: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M09-T12 bytes and the visible report digest. */
export async function verifyDesenAppSourcePersistenceEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppSourcePersistenceEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_SOURCE_PERSISTENCE_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T12 artifact bytes differ from fresh evidence.");
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
    n012Status: built.artifact.claim.n012Status,
    n018Status: built.artifact.claim.n018Status,
    s003Status: built.artifact.claim.s003Status,
    pf085Status: built.artifact.claim.pf085Status,
    pf089Status: built.artifact.claim.pf089Status,
  });
}

/** Atomically writes exact deterministic M09-T12 proof bytes. */
export async function writeDesenAppSourcePersistenceEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_SOURCE_PERSISTENCE_ARTIFACT_PATH,
  );
  const built = await buildDesenAppSourcePersistenceEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T12 artifact write failed safely.", {
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
