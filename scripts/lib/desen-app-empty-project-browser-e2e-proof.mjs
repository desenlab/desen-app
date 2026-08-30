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
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-empty-project-browser-e2e.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-EMPTY-PROJECT-BROWSER-E2E.md";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const LOCKFILE_PATH = "pnpm-lock.yaml";
const PARENT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";

const SOURCE_PATHS = Object.freeze({
  application: "apps/desen-app/src/application.tsx",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  applicationTest: "apps/desen-app/test/application.test.tsx",
  browserSpec: "apps/desen-app/e2e/empty-project-to-sign-in.pw.ts",
  proofApplication: "apps/desen-app/e2e/proof-application.tsx",
  playwrightConfig: "apps/desen-app/e2e/playwright.config.ts",
  viteConfig: "apps/desen-app/e2e/vite.config.ts",
  e2eTsconfig: "apps/desen-app/e2e/tsconfig.json",
  e2eHtml: "apps/desen-app/e2e/index.html",
});

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-empty-project-browser-e2e-proof.mjs",
  "scripts/generate-desen-app-empty-project-browser-e2e-proof.mjs",
  "scripts/verify-desen-app-empty-project-browser-e2e.mjs",
  "tests/desen-app-empty-project-browser-e2e.test.mjs",
]);

const TRACKED_PATHS = Object.freeze([
  ROOT_PACKAGE_PATH,
  APP_PACKAGE_PATH,
  LOCKFILE_PATH,
  PARENT_ARTIFACT_PATH,
  ...Object.values(SOURCE_PATHS),
  ...PROOF_READER_PATHS,
]);

const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const PLAYWRIGHT_VERSION = "1.62.1";
const BROWSER_TEST_NAME =
  "authors and saves a valid sign-in Source from the empty project in a real browser";

/** Exact immutable M09/G09 predecessor required by the first M10 browser proof. */
export const DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN = Object.freeze({
  task: "M09-T14",
  gate: "G09",
  proofId: "desen-app-publish-activation",
  path: PARENT_ARTIFACT_PATH,
  bytes: 24_763,
  sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  profile: "desen.app.publish-activation-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent reader tests retained in the M10-T01 artifact. */
export const DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact completed M09/G09 predecessor",
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
export const DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M10-T01 evidence reader. */
export class DesenAppEmptyProjectBrowserE2eProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppEmptyProjectBrowserE2eProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppEmptyProjectBrowserE2eProofError(code, message, details);
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
    if (error instanceof DesenAppEmptyProjectBrowserE2eProofError) throw error;
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
    if (error instanceof DesenAppEmptyProjectBrowserE2eProofError) throw error;
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
export function verifyDesenAppEmptyProjectBrowserE2eSourcePolicy(rawInput) {
  const input = captureSourcePolicyInput(rawInput);
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
      'import { EMPTY_REFERENCE_PROJECT_DOCUMENT } from "../src/reference-empty-project.js"',
      'page.goto("/e2e/index.html")',
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
      '...devices["Desktop Chrome"]',
      "workers: 1",
      "retries: 0",
      "timeout: 60_000",
      'trace: "retain-on-failure"',
      'video: "retain-on-failure"',
      'screenshot: "only-on-failure"',
      "reuseExistingServer: false",
      "url: APP_ORIGIN",
    ],
    SOURCE_PATHS.playwrightConfig,
  );
  assertIncludes(
    input.viteConfig,
    [
      "root: import.meta.dirname",
      'outDir: resolve(import.meta.dirname, "../dist-e2e")',
      'host: "127.0.0.1"',
      "port: 4174",
      "strictPort: true",
    ],
    SOURCE_PATHS.viteConfig,
  );

  const e2eTsconfig = JSON.parse(input.e2eTsconfig);
  if (
    e2eTsconfig?.compilerOptions?.noEmit !== true ||
    !isDeepStrictEqual(e2eTsconfig?.compilerOptions?.types, [
      "@playwright/test",
      "node",
      "vite/client",
    ])
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

function inspectPackageContract(files) {
  const rootPackage = parseJson(files.get(ROOT_PACKAGE_PATH), ROOT_PACKAGE_PATH);
  const appPackage = parseJson(files.get(APP_PACKAGE_PATH), APP_PACKAGE_PATH);
  const lockfile = decodeUtf8(files.get(LOCKFILE_PATH), LOCKFILE_PATH);
  if (
    rootPackage?.devDependencies?.["@playwright/test"] !== PLAYWRIGHT_VERSION ||
    rootPackage?.scripts?.["test:e2e"] !== "turbo run test:e2e" ||
    rootPackage?.scripts?.["verify:desen-app-empty-project-browser-e2e"] !==
      "node scripts/verify-desen-app-empty-project-browser-e2e.mjs" ||
    rootPackage?.scripts?.["test:desen-app-empty-project-browser-e2e"] !==
      "node --test tests/desen-app-empty-project-browser-e2e.test.mjs" ||
    appPackage?.scripts?.["build:e2e"] !== "vite build --config e2e/vite.config.ts" ||
    appPackage?.scripts?.["test:e2e"] !==
      "pnpm run build:e2e && playwright test --config e2e/playwright.config.ts"
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The exact Playwright workspace command contract drifted.");
  }
  for (const marker of [
    "'@playwright/test':\n        specifier: 1.62.1\n        version: 1.62.1",
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
  return deepFreeze({
    rootPackageName: rootPackage.name,
    appPackageName: appPackage.name,
    playwrightPackage: "@playwright/test",
    playwrightVersion: PLAYWRIGHT_VERSION,
    browserProject: "chromium",
    browserProfile: "Desktop Chrome",
    rootCommand: rootPackage.scripts["test:e2e"],
    appBuildCommand: appPackage.scripts["build:e2e"],
    appBrowserCommand: appPackage.scripts["test:e2e"],
    exactLockfileClosure: true,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact M09/G09 predecessor artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.task !== pin.task ||
    artifact.gate !== pin.gate ||
    artifact.result !== pin.result
  ) {
    fail("PARENT_DRIFT", "The M09/G09 predecessor identity or result drifted.");
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
export async function buildDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppEmptyProjectBrowserE2eSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const packageContract = inspectPackageContract(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-empty-project-browser-e2e",
    profile: "desen.app.empty-project-browser-e2e-proof.v1",
    task: "M10-T01",
    gate: null,
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
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
      browserCommand: "pnpm test:e2e",
      browserSpec: SOURCE_PATHS.browserSpec,
      browserTestName: BROWSER_TEST_NAME,
      browserTestDeclarations: 1,
      configuredProjects: ["chromium"],
      workers: 1,
      retries: 0,
      proofReaderCommand: "node --test tests/desen-app-empty-project-browser-e2e.test.mjs",
      verifierCommand: "node scripts/verify-desen-app-empty-project-browser-e2e.mjs",
      rootTestNames: DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ROOT_TEST_NAMES,
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
  for (const required of [
    "Task: M10-T01",
    "Status: DONE",
    "P-08: PROVEN",
    "T02+: NOT_PROVEN",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ]) {
    if (!text.includes(required)) {
      fail("PROOF_DOCUMENT_DRIFT", `Proof document is missing ${required}.`);
    }
  }
}

/** Verifies committed M10-T01 bytes and the visible report digest without rerunning Playwright. */
export async function verifyDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
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
export async function writeDesenAppEmptyProjectBrowserE2eEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_EMPTY_PROJECT_BROWSER_E2E_ARTIFACT_PATH,
  );
  const built = await buildDesenAppEmptyProjectBrowserE2eEvidence(options.buildOptions);
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
