import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-BROWSER-E2E-WORKSPACE-COMPATIBILITY.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const BROWSER_PACKAGE_PATH = "apps/desen-app-browser-e2e/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json";

const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  applicationTest: "apps/desen-app/test/application.test.tsx",
  browserSpec: "apps/desen-app-browser-e2e/empty-project-to-sign-in.pw.ts",
  proofApplication: "apps/desen-app-browser-e2e/proof-application.tsx",
  playwrightConfig: "apps/desen-app-browser-e2e/playwright.config.ts",
  viteConfig: "apps/desen-app-browser-e2e/vite.config.ts",
  e2eTsconfig: "apps/desen-app-browser-e2e/tsconfig.json",
  e2eHtml: "apps/desen-app-browser-e2e/index.html",
});

const BOUNDARY_PATHS = Object.freeze({
  configuration: "dependency-cruiser.config.cjs",
  fixtureVerifier: "scripts/verify-boundary-fixtures.mjs",
  documentation: "tests/boundaries/README.md",
  allowedFixture:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app-browser-e2e/proof-application.ts",
  allowedApplicationStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/application.tsx",
  allowedEmptyProjectStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/reference-empty-project.ts",
  allowedStylesStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/apps/desen-app/src/styles.css",
  allowedEditorCoreStub:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-reviewed-imports/packages/editor-core/src/index.ts",
  forbiddenPackageFixture:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/apps/desen-app-browser-e2e/proof-application.ts",
  forbiddenPublisherStub:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-publisher/packages/publisher/src/index.ts",
  forbiddenAppSourceFixture:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app-browser-e2e/proof-application.ts",
  forbiddenAppMainStub:
    "tests/boundaries/fixtures/desen-app-browser-e2e-imports-unreviewed-app-source/apps/desen-app/src/main.ts",
});

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-browser-e2e-workspace-compatibility-proof.mjs",
  "scripts/generate-desen-app-browser-e2e-workspace-compatibility-proof.mjs",
  "scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
  "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  BROWSER_PACKAGE_PATH,
  LOCKFILE_PATH,
  WORKFLOW_PATH,
  PARENT_ARTIFACT_PATH,
  ...Object.values(SOURCE_PATHS),
  ...Object.values(BOUNDARY_PATHS),
  ...PROOF_READER_PATHS,
]);

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const PLAYWRIGHT_VERSION = "1.62.1";
const BROWSER_TEST_NAME =
  "authors and saves a valid sign-in Source from the empty project in a real browser";
const BROWSER_SPEC_PIN = Object.freeze({
  path: SOURCE_PATHS.browserSpec,
  bytes: 12_756,
  sha256: "662b617e335d9ff2e5c15f8cd43b03ca2b4a5dca0a471f8f053334fa5c57a0b0",
});
const BROWSER_WORKFLOW_JOB_IF =
  "${{ github.event_name != 'workflow_dispatch' || inputs.mode == 'required' }}";

/** Exact immutable task-time M10-T01 proof required by the corrective workspace receipt. */
export const DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN = Object.freeze({
  task: "M10-T01",
  gate: null,
  proofId: "desen-app-empty-project-browser-e2e",
  path: PARENT_ARTIFACT_PATH,
  bytes: 10_259,
  sha256: "959dde63ef28bc7fd25967a9193e39e082c9178bc12f40b83036c5dd6042df77",
  profile: "desen.app.empty-project-browser-e2e-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent reader tests retained in the M10-T01 compatibility artifact. */
export const DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact immutable M10-T01 task-time proof",
  "[bootstrap] retains an explicitly empty admitted Source and exact Catalog identity",
  "[browser] retains one real-browser empty-project-to-saved-sign-in scenario",
  "[drag] distinguishes native Components and Layers gestures from forged transfer data",
  "[persistence] saves through the public persistence port and re-admits canonical Source",
  "[parity] keeps the same declared 420 by 720 frame and static content in Design and Run",
  "[dependency] pins Playwright and Chromium configuration to exact workspace contracts",
  "[boundary] keeps T02 through T04 runtime lifecycle claims outside M10-T01",
  "[determinism] builds byte-identical detached evidence and exact tracked receipts",
  "[policy] rejects weakened source, browser, package, lockfile, and parent authority",
  "[verification] rejects artifact, proof-report, option, and destination drift",
]);

/** Default destination for deterministic M10-T01 evidence. */
export const DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M10-T01 evidence reader. */
export class DesenAppBrowserE2eWorkspaceCompatibilityProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppBrowserE2eWorkspaceCompatibilityProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppBrowserE2eWorkspaceCompatibilityProofError(code, message, details);
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

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(
    await format(JSON.stringify(artifact), {
      filepath: ARTIFACT_PATH,
      parser: "json",
      printWidth: 100,
    }),
  );
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
    if (error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      overrides.get(relativePath) ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  const value = Buffer.from(bytes).toString("utf8");
  if (value.includes("\0") || !Buffer.from(value, "utf8").equals(Buffer.from(bytes))) {
    fail(code, `${label} must be exact UTF-8 text.`);
  }
  return value;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label, code));
  } catch (error) {
    if (error instanceof DesenAppBrowserE2eWorkspaceCompatibilityProofError) throw error;
    fail(code, `${label} must be exact JSON.`, { cause: String(error) });
  }
}

function assertIncludes(source, markers, label) {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost required M10-T01 policy.`, { missing });
  }
}

function assertExcludes(source, markers, label) {
  const present = markers.filter((marker) => source.includes(marker));
  if (present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} acquired forbidden M10-T01 authority.`, {
      present,
    });
  }
}

function parseTypeScript(source, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${relativePath} must parse as TypeScript.`);
  }
  return sourceFile;
}

function callCount(sourceFile, propertyName) {
  let count = 0;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === propertyName
    ) {
      count += 1;
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return count;
}

function importSources(sourceFile) {
  return Object.freeze(
    sourceFile.statements
      .filter(ts.isImportDeclaration)
      .map((statement) =>
        ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null,
      ),
  );
}

function declaredBrowserTests(sourceFile) {
  const names = [];
  let exclusiveOrSkipped = false;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === "test") {
        const first = node.arguments[0];
        names.push(first !== undefined && ts.isStringLiteral(first) ? first.text : null);
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "test" &&
        ["only", "skip", "fixme"].includes(node.expression.name.text)
      ) {
        exclusiveOrSkipped = true;
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return Object.freeze({ names: Object.freeze(names), exclusiveOrSkipped });
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

/** Verifies the exact empty-project-to-saved-sign-in browser scenario without executing it. */
export function verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
  const browserSpecBytes = Buffer.from(input.browserSpec, "utf8");
  if (
    browserSpecBytes.byteLength !== BROWSER_SPEC_PIN.bytes ||
    sha256(browserSpecBytes) !== BROWSER_SPEC_PIN.sha256
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The exact enabled M10-T01 browser scenario bytes drifted.");
  }
  const parsed = Object.fromEntries(
    Object.entries(SOURCE_PATHS)
      .filter(([, relativePath]) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"))
      .map(([key, relativePath]) => [key, parseTypeScript(input[key], relativePath)]),
  );

  assertIncludes(
    input.application,
    [
      "readonly initialDocument?: DesenEditorDocument",
      "initialDocument = REFERENCE_EDITOR_DOCUMENT",
      "const [mountedInitialDocument] = useState(() => initialDocument)",
      "canonicalizeJson(mountedInitialDocument)",
      "document: mountedInitialDocument",
      "preview: prepareAuthoringPreviewBundle(mountedInitialDocument)",
      "initialDocument={initialDocument}",
    ],
    SOURCE_PATHS.application,
  );

  assertIncludes(
    input.emptyProject,
    [
      'kind: "desen.source"',
      'desen: "0.1.0"',
      'id: "com.example.account-app"',
      'id: "run.desen.reference.sign-in"',
      'target: "web-react"',
      'entry: "sign-in"',
      "state: Object.freeze({})",
      "resources: Object.freeze({})",
      'id: "sign-in.layout"',
      'use: "com.example.ui/Stack"',
      "maxWidth: 420",
      "width: 420, height: 720",
      "createDesenEditorDocument(EMPTY_REFERENCE_SOURCE)",
      "EMPTY_REFERENCE_PROJECT_DOCUMENT",
    ],
    SOURCE_PATHS.emptyProject,
  );
  assertExcludes(
    input.emptyProject,
    ["slots:", "children:", "sign-in.title", "sign-in.email", "sign-in.password", "sign-in.submit"],
    SOURCE_PATHS.emptyProject,
  );

  assertIncludes(
    input.applicationTest,
    [
      'it("admits an explicit empty-project bootstrap without substituting completed sign-in content"',
      "initialDocument={EMPTY_REFERENCE_PROJECT_DOCUMENT}",
      'stackSlotName(0, "sign-in.layout", "Absent")',
      ").toHaveLength(1)",
      'queryByText("sign-in.title")',
      'queryByText("sign-in.email")',
      'queryByText("sign-in.password")',
      'queryByText("sign-in.submit")',
    ],
    SOURCE_PATHS.applicationTest,
  );

  const browserTests = declaredBrowserTests(parsed.browserSpec);
  if (
    !isDeepStrictEqual(browserTests.names, [BROWSER_TEST_NAME]) ||
    browserTests.exclusiveOrSkipped
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The browser proof must retain one enabled exact scenario.", {
      browserTests,
    });
  }
  const browserImports = importSources(parsed.browserSpec);
  if (
    !isDeepStrictEqual(browserImports, [
      "@playwright/test",
      "@desen/editor-core",
      "../desen-app/src/reference-empty-project.js",
      "@playwright/test",
    ])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The browser spec import surface drifted.", {
      browserImports,
    });
  }
  const nativeDragCalls = callCount(parsed.browserSpec, "dragTo");
  if (nativeDragCalls !== 2) {
    fail("SOURCE_POLICY_VIOLATION", "The browser proof must retain two native drag gestures.", {
      nativeDragCalls,
    });
  }
  assertIncludes(
    input.browserSpec,
    [
      'import { expect, test } from "@playwright/test"',
      'import { createDesenEditorDocument } from "@desen/editor-core"',
      'import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../desen-app/src/reference-empty-project.js"',
      'page.goto("/")',
      "toHaveCount(1)",
      "toHaveCount(0)",
      "const transfer = new DataTransfer()",
      'transfer.setData("text/plain", "forged component authority")',
      'for (const type of ["dragenter", "dragover", "drop"])',
      "target.dispatchEvent(",
      "expect(emptySavedDocument).toEqual(EMPTY_REFERENCE_PROJECT_DOCUMENT)",
      "await expect(saveSource).toBeDisabled()",
      "window.__DESEN_BROWSER_PROOF__.readSaveCount())).toBe(1)",
      'componentDragHandle(page, "Text").dragTo(placementTarget(page))',
      "passwordDragHandle.dragTo(positionThree)",
      'addLocalState(page, "email")',
      'addLocalState(page, "password")',
      'bindValueToState(page, "email")',
      'bindValueToState(page, "password")',
      'addChangeStateAction(page, "email")',
      'addChangeStateAction(page, "password")',
      'name: "Delete Alert layer · node.alert"',
      'data-canvas-frame-width", "420"',
      'data-canvas-frame-height", "720"',
      'getByRole("button", { name: "Run" }).click()',
      "const designManagedHtml = await managedSubtree.evaluate((node) => node.innerHTML)",
      ".poll(() => managedSubtree.evaluate((node) => node.innerHTML))",
      ".toBe(designManagedHtml)",
      'getByRole("button", { name: "Design" }).click()',
      'const saveSource = persistence.getByRole("button", { name: "Save source" })',
      "await saveSource.click()",
      '"Source saved successfully. Generation 2."',
      "window.__DESEN_BROWSER_PROOF__.readSaveCount())).toBe(2)",
      "window.__DESEN_BROWSER_PROOF__.readSavedDocument()",
      "createDesenEditorDocument(savedDocument)",
      '"com.example.ui/Text"',
      '"com.example.ui/TextField"',
      '"com.example.ui/Button"',
      '{ type: "state.set", path: "email", value: { $ref: "event.value" } }',
      '{ type: "state.set", path: "password", value: { $ref: "event.value" } }',
      "expect(runtimeFailures).toEqual([])",
    ],
    SOURCE_PATHS.browserSpec,
  );
  assertExcludes(
    input.browserSpec,
    ["test.only", "test.skip", "test.fixme", "chromium.launch", "page.mouse"],
    SOURCE_PATHS.browserSpec,
  );

  assertIncludes(
    input.proofApplication,
    [
      'import { createDesenEditorPersistencePort } from "@desen/editor-core"',
      "const readSource:",
      "const compareAndSetSource:",
      'status: "created", generation: 1',
      'status: "conflict"',
      'status: "unchanged"',
      'status: "generation-exhausted"',
      "createDesenEditorPersistencePort(",
      'Object.defineProperty(window, "__DESEN_BROWSER_PROOF__"',
      "enumerable: false",
      "initialDocument={EMPTY_REFERENCE_PROJECT_DOCUMENT}",
      "persistencePort={persistencePort}",
    ],
    SOURCE_PATHS.proofApplication,
  );
  const proofApplicationImports = importSources(parsed.proofApplication);
  if (
    !isDeepStrictEqual(proofApplicationImports, [
      "react",
      "react-dom/client",
      "@desen/editor-core",
      "../desen-app/src/application.js",
      "../desen-app/src/reference-empty-project.js",
      "../desen-app/src/styles.css",
      "@desen/editor-core",
    ])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The proof application import surface drifted.", {
      proofApplicationImports,
    });
  }
  assertExcludes(
    input.proofApplication,
    ["localStorage", "sessionStorage", "fetch(", "XMLHttpRequest"],
    SOURCE_PATHS.proofApplication,
  );

  assertIncludes(
    input.playwrightConfig,
    [
      'import { defineConfig, devices } from "@playwright/test"',
      'name: "chromium"',
      'testMatch: "**/*.pw.ts"',
      'outputDir: resolve(PACKAGE_ROOT, "test-results")',
      '...devices["Desktop Chrome"]',
      "workers: 1",
      "retries: 0",
      "timeout: 60_000",
      'trace: "retain-on-failure"',
      'video: "retain-on-failure"',
      'screenshot: "only-on-failure"',
      'outputFolder: resolve(PACKAGE_ROOT, "playwright-report")',
      'command: "pnpm --filter @desen/app-browser-e2e exec vite preview --config vite.config.ts"',
      "cwd: WORKSPACE_ROOT",
      "reuseExistingServer: false",
      "url: APP_ORIGIN",
    ],
    SOURCE_PATHS.playwrightConfig,
  );
  assertIncludes(
    input.viteConfig,
    [
      "root: import.meta.dirname",
      'outDir: resolve(import.meta.dirname, "dist")',
      'host: "127.0.0.1"',
      "port: 4174",
      "strictPort: true",
    ],
    SOURCE_PATHS.viteConfig,
  );

  const e2eTsconfig = JSON.parse(input.e2eTsconfig);
  if (
    e2eTsconfig?.extends !== "../../tsconfig.react-web.json" ||
    e2eTsconfig?.compilerOptions?.noEmit !== true ||
    !isDeepStrictEqual(e2eTsconfig?.compilerOptions?.types, [
      "@playwright/test",
      "node",
      "vite/client",
    ]) ||
    !isDeepStrictEqual(e2eTsconfig?.include, ["**/*.ts", "**/*.tsx"])
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The isolated browser proof TypeScript contract drifted.");
  }
  assertIncludes(
    input.e2eHtml,
    ['<div id="desen-app-root"></div>', 'src="/proof-application.tsx"'],
    SOURCE_PATHS.e2eHtml,
  );

  return deepFreeze({
    explicitEmptyBootstrap: true,
    admittedBeforeExport: true,
    exactCatalogIdentity: "run.desen.reference.sign-in@0.1.0#web-react",
    initialNodes: 1,
    initialLocalStateEntries: 0,
    initialBindings: 0,
    initialEventsAndActions: 0,
    browserTestName: BROWSER_TEST_NAME,
    browserTestDeclarations: browserTests.names.length,
    browserSpecReceipt: BROWSER_SPEC_PIN,
    nativeComponentDrag: true,
    nativeLayerDrag: true,
    nativeDragCalls,
    forgedDataTransferRejected: true,
    deletionCovered: true,
    persistencePortReal: true,
    canonicalSavedSourceReadBack: true,
    structuralReadmission: true,
    designRunStaticParity: true,
    frame: Object.freeze({ preset: "portrait", width: 420, height: 720 }),
    runtimeConsoleErrorsAllowed: 0,
    browserExecutionPerformedByReader: false,
  });
}

function inspectBoundaryContract(files) {
  const configuration = decodeUtf8(
    files.get(BOUNDARY_PATHS.configuration),
    BOUNDARY_PATHS.configuration,
  );
  const fixtureVerifier = decodeUtf8(
    files.get(BOUNDARY_PATHS.fixtureVerifier),
    BOUNDARY_PATHS.fixtureVerifier,
  );
  const documentation = decodeUtf8(
    files.get(BOUNDARY_PATHS.documentation),
    BOUNDARY_PATHS.documentation,
  );
  const allowedFixture = decodeUtf8(
    files.get(BOUNDARY_PATHS.allowedFixture),
    BOUNDARY_PATHS.allowedFixture,
  );
  const forbiddenPackageFixture = decodeUtf8(
    files.get(BOUNDARY_PATHS.forbiddenPackageFixture),
    BOUNDARY_PATHS.forbiddenPackageFixture,
  );
  const forbiddenAppSourceFixture = decodeUtf8(
    files.get(BOUNDARY_PATHS.forbiddenAppSourceFixture),
    BOUNDARY_PATHS.forbiddenAppSourceFixture,
  );
  const requiredConfiguration = [
    '"desen-app-browser-e2e": ["editor-core"]',
    'name: "desen-app-browser-e2e-reviewed-app-source-only"',
    'from: { path: "^apps/desen-app-browser-e2e/" }',
    'path: "^apps/(?!desen-app-browser-e2e/)"',
    '"^apps/desen-app/src/(?:application\\\\.tsx|reference-empty-project\\\\.ts|styles\\\\.css)$"',
  ];
  const requiredVerifier = [
    '{ name: "allowed-desen-app-browser-e2e-reviewed-imports", expectedRule: null }',
    'name: "desen-app-browser-e2e-imports-publisher"',
    'expectedRule: "application-desen-app-browser-e2e-allowed-dependencies"',
    'name: "desen-app-browser-e2e-imports-unreviewed-app-source"',
    'expectedRule: "desen-app-browser-e2e-reviewed-app-source-only"',
  ];
  const requiredDocumentation = [
    "Desen App browser-proof fixtures",
    "composes only `editor-core` plus the reviewed App application",
    "rejects an undeclared `publisher` package edge",
    "rejects an unreviewed App source entry",
  ];
  const missing = [
    ...requiredConfiguration
      .filter((marker) => !configuration.includes(marker))
      .map((marker) => `${BOUNDARY_PATHS.configuration}:${marker}`),
    ...requiredVerifier
      .filter((marker) => !fixtureVerifier.includes(marker))
      .map((marker) => `${BOUNDARY_PATHS.fixtureVerifier}:${marker}`),
    ...requiredDocumentation
      .filter((marker) => !documentation.includes(marker))
      .map((marker) => `${BOUNDARY_PATHS.documentation}:${marker}`),
  ];
  if (
    !isDeepStrictEqual(
      importSources(parseTypeScript(allowedFixture, BOUNDARY_PATHS.allowedFixture)),
      [
        "../desen-app/src/application.js",
        "../desen-app/src/reference-empty-project.js",
        "../desen-app/src/styles.css",
        "../../packages/editor-core/src/index.js",
      ],
    ) ||
    !isDeepStrictEqual(
      importSources(
        parseTypeScript(forbiddenPackageFixture, BOUNDARY_PATHS.forbiddenPackageFixture),
      ),
      ["../../packages/publisher/src/index.js"],
    ) ||
    !isDeepStrictEqual(
      importSources(
        parseTypeScript(forbiddenAppSourceFixture, BOUNDARY_PATHS.forbiddenAppSourceFixture),
      ),
      ["../desen-app/src/main.js"],
    )
  ) {
    missing.push("boundary fixture import surface");
  }
  if (missing.length !== 0) {
    fail("BOUNDARY_CONTRACT_DRIFT", "The dedicated browser boundary contract drifted.", {
      missing,
    });
  }
  return deepFreeze({
    command: "pnpm boundaries",
    dedicatedInternalPackageAllowlist: ["editor-core"],
    reviewedAppSourceEntries: [
      "apps/desen-app/src/application.tsx",
      "apps/desen-app/src/reference-empty-project.ts",
      "apps/desen-app/src/styles.css",
    ],
    positiveFixture: "allowed-desen-app-browser-e2e-reviewed-imports",
    negativeFixtures: [
      Object.freeze({
        name: "desen-app-browser-e2e-imports-publisher",
        rule: "application-desen-app-browser-e2e-allowed-dependencies",
      }),
      Object.freeze({
        name: "desen-app-browser-e2e-imports-unreviewed-app-source",
        rule: "desen-app-browser-e2e-reviewed-app-source-only",
      }),
    ],
  });
}

function workspaceLockImporter(lockfile, importerPath) {
  const marker = `  ${importerPath}:\n`;
  const start = lockfile.indexOf(marker);
  if (start === -1) {
    fail("PACKAGE_CONTRACT_DRIFT", "The lockfile lost the dedicated browser importer.");
  }
  const remainder = lockfile.slice(start + marker.length);
  const nextImporter = remainder.search(/\n {2}(?:apps|packages)\/[^:\n]+:/u);
  return (
    nextImporter === -1
      ? lockfile.slice(start)
      : lockfile.slice(start, start + marker.length + nextImporter)
  ).trimEnd();
}

function exactYamlMappings(lines, start, end, indentation, label) {
  const mappings = new Map();
  const pattern = new RegExp(`^ {${indentation}}([A-Za-z][A-Za-z0-9-]*):(?: (.*))?$`, "u");
  for (let index = start; index < end; index += 1) {
    if (lines[index].includes("\t")) {
      fail("PACKAGE_CONTRACT_DRIFT", `${label} must not contain YAML tab indentation.`);
    }
    const match = pattern.exec(lines[index]);
    if (match === null) continue;
    const [, key, value = ""] = match;
    if (mappings.has(key)) {
      fail("PACKAGE_CONTRACT_DRIFT", `${label} contains duplicate ${key} authority.`);
    }
    mappings.set(key, Object.freeze({ index, value }));
  }
  return mappings;
}

function workflowRunCommand(lines, stepEnd, mappings, label) {
  const run = mappings.get("run");
  if (run === undefined) {
    fail("PACKAGE_CONTRACT_DRIFT", `${label} lost its run command.`);
  }
  if (run.value !== "|") return run.value;

  const commands = [];
  for (let index = run.index + 1; index < stepEnd; index += 1) {
    const line = lines[index];
    if (line.length === 0) {
      commands.push("");
      continue;
    }
    const indentation = /^ */u.exec(line)[0].length;
    if (indentation <= 8) break;
    if (indentation < 10) {
      fail("PACKAGE_CONTRACT_DRIFT", `${label} has malformed run-block indentation.`);
    }
    commands.push(line.slice(10));
  }
  while (commands.at(-1) === "") commands.pop();
  return commands.join("\n");
}

function inspectBrowserWorkflowContract(workflow) {
  const lines = workflow.split("\n");
  const jobStarts = lines
    .map((line, index) => (line === "  browser-e2e:" ? index : -1))
    .filter((index) => index !== -1);
  if (jobStarts.length !== 1) {
    fail("PACKAGE_CONTRACT_DRIFT", "The Browser E2E workflow job must be unique.");
  }
  const jobStart = jobStarts[0];
  const nextJobOffset = lines
    .slice(jobStart + 1)
    .findIndex((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/u.test(line));
  const jobEnd = nextJobOffset === -1 ? lines.length : jobStart + 1 + nextJobOffset;
  const stepsIndexes = lines
    .slice(jobStart + 1, jobEnd)
    .map((line, offset) => (line === "    steps:" ? jobStart + 1 + offset : -1))
    .filter((index) => index !== -1);
  if (stepsIndexes.length !== 1) {
    fail("PACKAGE_CONTRACT_DRIFT", "The Browser E2E workflow steps must be unique.");
  }
  const stepsIndex = stepsIndexes[0];
  const jobMappings = exactYamlMappings(lines, jobStart + 1, stepsIndex + 1, 4, "Browser E2E job");
  if (
    jobMappings.get("if")?.value !== BROWSER_WORKFLOW_JOB_IF ||
    jobMappings.has("continue-on-error") ||
    jobMappings.has("needs") ||
    jobMappings.has("strategy")
  ) {
    fail(
      "PACKAGE_CONTRACT_DRIFT",
      "The Browser E2E job acquired conditional or failure-tolerant authority.",
    );
  }

  const stepStarts = [];
  for (let index = stepsIndex + 1; index < jobEnd; index += 1) {
    const match = /^ {6}- name: (.+)$/u.exec(lines[index]);
    if (match !== null) stepStarts.push(Object.freeze({ index, name: match[1] }));
  }
  const steps = new Map();
  const orderedNames = [];
  for (const [position, step] of stepStarts.entries()) {
    if (steps.has(step.name)) {
      fail("PACKAGE_CONTRACT_DRIFT", `The Browser E2E workflow duplicates ${step.name}.`);
    }
    const stepEnd = stepStarts[position + 1]?.index ?? jobEnd;
    const mappings = exactYamlMappings(
      lines,
      step.index + 1,
      stepEnd,
      8,
      `Browser E2E step ${step.name}`,
    );
    if (
      [
        "Install Chromium runtime",
        "Run browser E2E proof",
        "Verify frozen browser-proof evidence",
      ].includes(step.name) &&
      (mappings.has("if") || mappings.has("continue-on-error"))
    ) {
      fail(
        "PACKAGE_CONTRACT_DRIFT",
        `Browser E2E step ${step.name} must run unconditionally and fail closed.`,
      );
    }
    orderedNames.push(step.name);
    steps.set(
      step.name,
      Object.freeze({
        command: mappings.has("run")
          ? workflowRunCommand(lines, stepEnd, mappings, `Browser E2E step ${step.name}`)
          : null,
        position,
      }),
    );
  }

  const required = [
    Object.freeze({
      name: "Install Chromium runtime",
      command: "pnpm --filter @desen/app-browser-e2e exec playwright install --with-deps chromium",
    }),
    Object.freeze({
      name: "Run browser E2E proof",
      command: "pnpm --filter @desen/app-browser-e2e test:e2e",
    }),
    Object.freeze({
      name: "Verify frozen browser-proof evidence",
      command: [
        "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
        "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
      ].join("\n"),
    }),
  ];
  const selected = required.map(({ name, command }) => {
    const step = steps.get(name);
    if (step === undefined || step.command !== command) {
      fail("PACKAGE_CONTRACT_DRIFT", `The exact ${name} workflow command drifted.`);
    }
    return step;
  });
  if (
    selected[1].position !== selected[0].position + 1 ||
    selected[2].position !== selected[1].position + 1
  ) {
    fail(
      "PACKAGE_CONTRACT_DRIFT",
      "Browser install, execution, and evidence verification must remain consecutive and ordered.",
    );
  }

  return deepFreeze({
    jobIf: BROWSER_WORKFLOW_JOB_IF,
    orderedStepNames: orderedNames,
    requiredSteps: required.map(({ name }) => name),
  });
}

function inspectPackageContract(files) {
  const rootPackage = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const appPackage = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const browserPackage = parseJson(files.get(BROWSER_PACKAGE_PATH), BROWSER_PACKAGE_PATH);
  const lockfile = decodeUtf8(files.get(LOCKFILE_PATH), LOCKFILE_PATH);
  const workflow = decodeUtf8(files.get(WORKFLOW_PATH), WORKFLOW_PATH);
  const browserWorkflow = inspectBrowserWorkflowContract(workflow);
  const forbiddenRootScripts = [
    "generate:desen-app-empty-project-browser-e2e",
    "verify:desen-app-empty-project-browser-e2e",
    "test:desen-app-empty-project-browser-e2e",
    "generate:desen-app-browser-e2e-workspace-compatibility",
    "verify:desen-app-browser-e2e-workspace-compatibility",
    "test:desen-app-browser-e2e-workspace-compatibility",
  ];
  if (
    rootPackage?.name !== "desen-workspace" ||
    rootPackage?.scripts?.["test:e2e"] !== "node scripts/not-implemented.mjs browser-e2e G10" ||
    forbiddenRootScripts.some((script) => Object.hasOwn(rootPackage?.scripts ?? {}, script)) ||
    Object.hasOwn(rootPackage?.dependencies ?? {}, "@playwright/test") ||
    Object.hasOwn(rootPackage?.devDependencies ?? {}, "@playwright/test")
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The root manifest acquired M10 browser-proof ownership.");
  }
  if (
    appPackage?.name !== "@desen/app-web" ||
    appPackage?.scripts?.lint !== "eslint src test --max-warnings=0" ||
    appPackage?.scripts?.typecheck !== "tsc -p tsconfig.json --noEmit" ||
    Object.hasOwn(appPackage?.scripts ?? {}, "build:e2e") ||
    Object.hasOwn(appPackage?.scripts ?? {}, "test:e2e") ||
    Object.hasOwn(appPackage?.dependencies ?? {}, "@playwright/test") ||
    Object.hasOwn(appPackage?.devDependencies ?? {}, "@playwright/test")
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The product App manifest acquired browser-harness ownership.");
  }

  const expectedBrowserScripts = {
    build: "vite build",
    lint: "eslint . --max-warnings=0",
    typecheck: "tsc -p tsconfig.json --noEmit",
    "test:e2e":
      "pnpm --filter @desen/app-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts",
  };
  const expectedBrowserDependencies = {
    "@desen/editor-core": "workspace:*",
    react: "19.2.8",
    "react-dom": "19.2.8",
  };
  const expectedBrowserDevDependencies = {
    "@desen/app-web": "workspace:*",
    "@playwright/test": PLAYWRIGHT_VERSION,
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    vite: "8.1.5",
  };
  if (
    browserPackage?.name !== "@desen/app-browser-e2e" ||
    browserPackage?.version !== "0.0.0" ||
    browserPackage?.private !== true ||
    browserPackage?.type !== "module" ||
    !isDeepStrictEqual(browserPackage?.scripts, expectedBrowserScripts) ||
    !isDeepStrictEqual(browserPackage?.dependencies, expectedBrowserDependencies) ||
    !isDeepStrictEqual(browserPackage?.devDependencies, expectedBrowserDevDependencies)
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The dedicated browser workspace manifest drifted.");
  }

  const expectedImporter = [
    "  apps/desen-app-browser-e2e:",
    "    dependencies:",
    "      '@desen/editor-core':",
    "        specifier: workspace:*",
    "        version: link:../../packages/editor-core",
    "      react:",
    "        specifier: 19.2.8",
    "        version: 19.2.8",
    "      react-dom:",
    "        specifier: 19.2.8",
    "        version: 19.2.8(react@19.2.8)",
    "    devDependencies:",
    "      '@desen/app-web':",
    "        specifier: workspace:*",
    "        version: link:../desen-app",
    "      '@playwright/test':",
    "        specifier: 1.62.1",
    "        version: 1.62.1",
    "      '@types/node':",
    "        specifier: 24.13.3",
    "        version: 24.13.3",
    "      '@types/react':",
    "        specifier: 19.2.17",
    "        version: 19.2.17",
    "      '@types/react-dom':",
    "        specifier: 19.2.3",
    "        version: 19.2.3(@types/react@19.2.17)",
    "      vite:",
    "        specifier: 8.1.5",
    "        version: 8.1.5(@types/node@24.13.3)",
  ].join("\n");
  if (workspaceLockImporter(lockfile, "apps/desen-app-browser-e2e") !== expectedImporter) {
    fail("PACKAGE_CONTRACT_DRIFT", "The dedicated browser lockfile importer drifted.");
  }
  for (const marker of [
    "'@playwright/test@1.62.1':",
    "playwright-core@1.62.1:",
    "playwright@1.62.1:",
  ]) {
    if (!lockfile.includes(marker)) {
      fail("PACKAGE_CONTRACT_DRIFT", "The lockfile lost one exact Playwright 1.62.1 pin.", {
        marker,
      });
    }
  }

  const requiredWorkflowMarkers = [
    "run: pnpm --filter @desen/app-browser-e2e exec playwright install --with-deps chromium",
    "run: pnpm --filter @desen/app-browser-e2e test:e2e",
    "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
    "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    "apps/desen-app-browser-e2e/playwright-report/",
    "apps/desen-app-browser-e2e/test-results/",
  ];
  const missingWorkflowMarkers = requiredWorkflowMarkers.filter(
    (marker) => !workflow.includes(marker),
  );
  const forbiddenWorkflowMarkers = [
    "pnpm verify:desen-app-empty-project-browser-e2e",
    "pnpm test:desen-app-empty-project-browser-e2e",
    "node scripts/verify-desen-app-empty-project-browser-e2e.mjs",
    "node --test tests/desen-app-empty-project-browser-e2e.test.mjs",
    "apps/desen-app/playwright-report/",
    "apps/desen-app/test-results/",
  ].filter((marker) => workflow.includes(marker));
  if (missingWorkflowMarkers.length !== 0 || forbiddenWorkflowMarkers.length !== 0) {
    fail("PACKAGE_CONTRACT_DRIFT", "The exact-head browser workflow command contract drifted.", {
      forbiddenWorkflowMarkers,
      missingWorkflowMarkers,
    });
  }

  return deepFreeze({
    rootPackageName: rootPackage.name,
    appPackageName: appPackage.name,
    browserPackageName: browserPackage.name,
    rootBrowserCommandReserved: rootPackage.scripts["test:e2e"],
    rootOwnsBrowserE2e: false,
    appOwnsBrowserE2e: false,
    dedicatedWorkspaceOwnership: true,
    playwrightPackage: "@playwright/test",
    playwrightVersion: PLAYWRIGHT_VERSION,
    browserProject: "chromium",
    browserProfile: "Desktop Chrome",
    browserBuildCommand: browserPackage.scripts.build,
    browserTypecheckCommand: browserPackage.scripts.typecheck,
    browserCommand: browserPackage.scripts["test:e2e"],
    workflowBrowserCommand: "pnpm --filter @desen/app-browser-e2e test:e2e",
    browserWorkflow,
    exactLockfileClosure: true,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T01 task-time artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.task !== pin.task ||
    artifact.gate !== pin.gate ||
    artifact.result !== pin.result
  ) {
    fail("PARENT_DRIFT", "The M10-T01 task-time predecessor identity or result drifted.");
  }
  return pin;
}

function receipts(files) {
  return deepFreeze(
    [...files.entries()]
      .map(([relativePath, bytes]) => ({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      }))
      .sort((left, right) => left.path.localeCompare(right.path, "en-US")),
  );
}

/** Builds detached deterministic M10-T01 evidence without launching a browser. */
export async function buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppBrowserE2eWorkspaceCompatibilitySourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const packageContract = inspectPackageContract(files);
  const boundaryContract = inspectBoundaryContract(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-browser-e2e-workspace-compatibility",
    profile: "desen.app.browser-e2e-workspace-compatibility-proof.v1",
    task: "M10-T01",
    compatibilityReceipt: "M10-T01-COMPAT",
    gate: null,
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      correctiveReceiptOnly: true,
      dedicatedBoundaryPolicyCovered: true,
      p08Status: "PROVEN",
      beginsFromExplicitlyEmptySource: true,
      exactCatalogResolved: true,
      visualAuthoringCovered: true,
      nativeComponentDragCovered: true,
      nativeLayerDragCovered: true,
      forgedDataTransferRejected: true,
      authoredDeletionCovered: true,
      exactSourceSavedAndReadBack: true,
      savedSourceStructurallyAdmitted: true,
      designRunStaticParityCovered: true,
      runtimeInputAndPendingCovered: false,
      invalidCredentialsAndPublicFailureCovered: false,
      successNavigationAndHostOperationCovered: false,
      remoteDeploymentCovered: false,
      g10Closed: false,
    },
    authority: {
      source,
      package: packageContract,
      boundary: boundaryContract,
      authoredOutcome: {
        surface: "sign-in",
        statePaths: ["email", "password"],
        orderedComponentIds: ["node.text", "node.textfield", "node.textfield-2", "node.button"],
        orderedComponentUses: [
          "com.example.ui/Text",
          "com.example.ui/TextField",
          "com.example.ui/TextField",
          "com.example.ui/Button",
        ],
        bindings: ["state.email", "state.password"],
        actions: [
          "change -> state.set(email, event.value)",
          "change -> state.set(password, event.value)",
        ],
        deletedTransientComponent: "node.alert",
      },
      execution: {
        productionBundlePreview: true,
        isolatedWorkspacePackage: "@desen/app-browser-e2e",
        configuredBrowser: "Chromium through Playwright Desktop Chrome",
        nativeGestureAuthority: "Playwright locator.dragTo for both positive drag paths",
        negativeAuthority:
          "one isolated forged DataTransfer dragenter/dragover/drop sequence that must not mutate Source",
        persistenceAuthority:
          "public createDesenEditorPersistencePort over an isolated deterministic CAS adapter",
        validatorAuthority: "public createDesenEditorDocument over the exact saved read-back",
        browserRerunOwnedByProofReader: false,
        hostedExecutionRequired: true,
      },
    },
    tests: {
      browserCommand: "pnpm --filter @desen/app-browser-e2e test:e2e",
      browserSpec: SOURCE_PATHS.browserSpec,
      browserTestName: BROWSER_TEST_NAME,
      browserTestDeclarations: 1,
      configuredProjects: ["chromium"],
      workers: 1,
      retries: 0,
      proofReaderCommand:
        "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
      verifierCommand: "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
      rootTestNames: DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
    },
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      parentArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      browserExecutionSeparateFromStaticReader: true,
    },
    result: "PASS",
    nonclaims: [
      "M10-T01-COMPAT is a corrective receipt for M10-T01, not a new plan task or completion claim.",
      "M10-T01 proves only empty-project visual authoring, persistence, validation, and Design/Run static parity for the sign-in Source.",
      "M10-T02 input dispatch and visible pending state remain NOT_PROVEN by this artifact.",
      "M10-T03 invalid-credentials and public failure rendering remain NOT_PROVEN by this artifact.",
      "M10-T04 successful navigation and one real host operation remain NOT_PROVEN by this artifact.",
      "Remote deployment and G10 closure remain NOT_PROVEN.",
      "The deterministic proof reader never launches a browser; an exact-head Browser E2E job must execute the pinned scenario.",
      "No hosted-CI pass is inferred from locally generated artifact bytes alone.",
    ],
  });
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
  });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_PATH, "PROOF_DOCUMENT_DRIFT");
  const lines = text.split("\n");
  const heading = "# Desen App browser E2E workspace compatibility";
  if (lines.filter((line) => line === heading).length !== 1 || lines[0] !== heading) {
    fail("PROOF_DOCUMENT_DRIFT", "Proof document must retain one exact leading title.");
  }
  const expectedFields = [
    Object.freeze({ key: "Task", value: "M10-T01" }),
    Object.freeze({ key: "Compatibility receipt", value: "M10-T01-COMPAT" }),
    Object.freeze({ key: "Status", value: "DONE" }),
    Object.freeze({ key: "P-08", value: "PROVEN" }),
    Object.freeze({ key: "T02+", value: "NOT_PROVEN" }),
    Object.freeze({
      key: "Historical artifact",
      value: `\`sha256:${DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_PARENT_PIN.sha256}\``,
    }),
    Object.freeze({
      key: "Compatibility artifact",
      value: `\`sha256:${artifactSha256}\``,
    }),
  ];
  const knownFieldPattern = new RegExp(
    `^(${expectedFields.map(({ key }) => key.replace(/[+]/gu, "\\+")).join("|")})\\s*:`,
    "u",
  );
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  const sectionBoundary = firstSection === -1 ? lines.length : firstSection;
  const fieldIndexes = [];
  for (const { key, value } of expectedFields) {
    const exactLine = `${key}: ${value}`;
    const indexes = lines
      .map((line, index) => (line.startsWith(`${key}:`) ? index : -1))
      .filter((index) => index !== -1);
    if (indexes.length !== 1 || lines[indexes[0]] !== exactLine || indexes[0] >= sectionBoundary) {
      fail(
        "PROOF_DOCUMENT_DRIFT",
        `Proof document must contain one unique leading ${key} authority.`,
      );
    }
    fieldIndexes.push(indexes[0]);
  }
  if (
    lines.some(
      (line) =>
        knownFieldPattern.test(line) &&
        !expectedFields.some(({ key }) => line.startsWith(`${key}:`)),
    ) ||
    !fieldIndexes.every((index, position) => position === 0 || index > fieldIndexes[position - 1])
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "Proof document authority fields must be canonical and ordered.");
  }
}

/** Verifies committed M10-T01 bytes and the visible report digest without rerunning Playwright. */
export async function verifyDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M10-T01 artifact bytes differ from fresh evidence.");
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
    browserTestDeclarations: built.artifact.tests.browserTestDeclarations,
    playwrightVersion: built.artifact.authority.package.playwrightVersion,
    configuredProjects: built.artifact.tests.configuredProjects,
    p08Status: built.artifact.claim.p08Status,
    t02PlusStatus: "NOT_PROVEN",
    browserExecutedByVerifier: false,
  });
}

/** Atomically writes exact deterministic M10-T01 proof bytes. */
export async function writeDesenAppBrowserE2eWorkspaceCompatibilityEvidence(
  rawOptions = undefined,
) {
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
    DEFAULT_DESEN_APP_BROWSER_E2E_WORKSPACE_COMPATIBILITY_ARTIFACT_PATH,
  );
  const built = await buildDesenAppBrowserE2eWorkspaceCompatibilityEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M10-T01 artifact write failed safely.", {
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
