import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-SHELL-NAVIGATION.md";
const PREREQUISITE_PATH = "docs/proof/artifacts/editor-core-0.1.0-terminal-integration.json";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const APP_PATHS = Object.freeze([
  "apps/desen-app/package.json",
  "apps/desen-app/tsconfig.json",
  "apps/desen-app/index.html",
  "apps/desen-app/README.md",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/styles.css",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/project-navigation.test.ts",
]);
const PROOF_PATHS = Object.freeze([
  "package.json",
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-shell-navigation-proof.mjs",
  "scripts/generate-desen-app-shell-navigation-proof.mjs",
  "scripts/verify-desen-app-shell-navigation.mjs",
  "tests/desen-app-shell-navigation.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([...APP_PATHS, ...PROOF_PATHS]);
const SOURCE_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/src\/(?:.+\.(?:ts|tsx)|.+\.css)$/u.test(relativePath)),
);
const TEST_PATHS = Object.freeze(
  APP_PATHS.filter((relativePath) => /\/test\//u.test(relativePath)),
);

/** Exact immutable G08 prerequisite for the first Desen App task. */
export const DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN = Object.freeze({
  task: "M08-T10",
  gate: "G08",
  path: PREREQUISITE_PATH,
  bytes: 325_549,
  sha256: "5787479d699ab8f53b739e633bf9a88900da00ae4f4c78f96b3e62a73133fa1b",
  proofId: "editor-core-terminal-integration",
  profile: "desen.editor-core.terminal-integration-proof.v1",
  result: "PASS",
});

/** Exact root-test names owned by the M09-T01 proof reader. */
export const DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES = Object.freeze([
  "[authority] binds M09-T01 to the exact completed G08 artifact",
  "[shell] records the closed route, fixture, guidance, and accessibility profile",
  "[boundary] keeps the first app slice free of editor, renderer, persistence, and publish authority",
  "[determinism] builds byte-identical detached evidence twice",
  "[mutation] rejects prerequisite, route, package, and scope-boundary drift",
  "[verification] rejects artifact and visible proof-pin drift",
  "[writer] atomically writes exact evidence and preserves a destination on tampering",
  "[filesystem] rejects linked prerequisite, artifact, and proof authorities",
]);

/** Default destination for deterministic M09-T01 evidence. */
export const DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable fail-closed error raised by the M09-T01 evidence builder. */
export class DesenAppShellNavigationProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppShellNavigationProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppShellNavigationProofError(code, message, details);
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
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
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
    utilTypes.isSharedArrayBuffer(value.buffer) ||
    (Object.getPrototypeOf(value) !== Uint8Array.prototype &&
      Object.getPrototypeOf(value) !== Buffer.prototype)
  ) {
    fail("OPTIONS_INVALID", `${label} must be exact non-shared Buffer or Uint8Array bytes.`);
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

function captureBuildOptions(rawOptions) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["fileOverrides", "prerequisiteBytes", "prerequisitePath", "workspaceRoot"],
    "build options",
  );
  const workspaceRoot = capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT);
  return Object.freeze({
    workspaceRoot,
    fileOverrides: captureOverrides(options.fileOverrides),
    prerequisiteBytes:
      options.prerequisiteBytes === undefined
        ? undefined
        : captureBytes(options.prerequisiteBytes, "prerequisiteBytes"),
    prerequisitePath: capturePath(
      options.prerequisitePath,
      "prerequisitePath",
      path.join(workspaceRoot, PREREQUISITE_PATH),
    ),
  });
}

async function readRegularAuthority(absolutePath, label) {
  const resolved = path.resolve(absolutePath);
  let canonicalParent;
  try {
    canonicalParent = await realpath(path.dirname(resolved));
  } catch (error) {
    fail("AUTHORITY_UNSAFE", `${label} parent is unavailable.`, { cause: String(error) });
  }
  const canonical = path.join(canonicalParent, path.basename(resolved));
  if (canonical !== resolved) {
    fail("AUTHORITY_UNSAFE", `${label} must not traverse a linked parent.`);
  }
  let before;
  let handle;
  try {
    before = await lstat(canonical);
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1 ||
      before.size > MAX_AUTHORITY_BYTES
    ) {
      fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular non-linked file.`);
    }
    handle = await open(canonical, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength !== before.size || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `${label} changed size while reading.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppShellNavigationProofError) throw error;
    fail("AUTHORITY_UNSAFE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("UTF8_INVALID", `${label} is not valid UTF-8.`);
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  } catch (error) {
    if (error instanceof DesenAppShellNavigationProofError) throw error;
    fail("JSON_INVALID", `${label} is not valid JSON.`);
  }
}

function exactTextCount(source, expected) {
  return source.split(expected).length - 1;
}

function requireText(source, expected, label) {
  if (exactTextCount(source, expected) < 1) {
    fail("SHELL_SEMANTIC_DRIFT", `${label} lost required M09-T01 semantics.`, { expected });
  }
}

function rejectText(source, pattern, label) {
  if (pattern.test(source)) {
    fail("SCOPE_BOUNDARY_DRIFT", `${label} crosses the M09-T01 scope boundary.`, {
      pattern: String(pattern),
    });
  }
}

function verifyPrerequisite(bytes) {
  if (
    bytes.byteLength !== DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.bytes ||
    sha256(bytes) !== DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.sha256
  ) {
    fail("PREREQUISITE_DRIFT", "The exact completed G08 artifact changed.");
  }
  const artifact = parseJson(bytes, PREREQUISITE_PATH);
  for (const [key, expected] of [
    ["task", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.task],
    ["proofId", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.proofId],
    ["profile", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.profile],
    ["result", DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN.result],
  ]) {
    if (artifact?.[key] !== expected) {
      fail("PREREQUISITE_DRIFT", `The G08 prerequisite lost its exact ${key}.`);
    }
  }
  if (artifact?.claim?.gateStatus !== "DONE" || artifact?.claim?.p18Status !== "PROVEN") {
    fail("PREREQUISITE_DRIFT", "The G08 prerequisite no longer proves terminal editor closure.");
  }
  return deepFreeze({ ...DESEN_APP_SHELL_NAVIGATION_PREREQUISITE_PIN });
}

function verifyPackage(bytes, rootPackageBytes) {
  const manifest = parseJson(bytes, "apps/desen-app/package.json");
  const rootManifest = parseJson(rootPackageBytes, "package.json");
  const expectedDependencies = {
    react: "19.2.8",
    "react-dom": "19.2.8",
  };
  const expectedDevDependencies = {
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    jsdom: "29.1.1",
    vite: "8.1.5",
    vitest: "4.1.10",
  };
  const expectedScripts = {
    build: "vite build",
    typecheck: "tsc -p tsconfig.json --noEmit",
    test: "vitest run",
    "test:shell":
      "vitest run test/project-navigation.test.ts test/application.test.tsx test/main-lifecycle.test.tsx",
  };
  if (
    manifest?.name !== "@desen/app-web" ||
    manifest?.private !== true ||
    manifest?.type !== "module" ||
    !isDeepStrictEqual(
      Object.fromEntries(Object.keys(expectedScripts).map((key) => [key, manifest.scripts?.[key]])),
      expectedScripts,
    ) ||
    !isDeepStrictEqual(manifest?.dependencies, expectedDependencies) ||
    !isDeepStrictEqual(manifest?.devDependencies, expectedDevDependencies) ||
    rootManifest?.devDependencies?.typescript !== "6.0.3" ||
    ts.version !== "6.0.3"
  ) {
    fail("PACKAGE_DRIFT", "The private React/Vite Desen App package contract drifted.");
  }
  return deepFreeze({
    name: manifest.name,
    private: manifest.private,
    framework: `react@${manifest.dependencies.react}`,
    buildTool: `vite@${manifest.devDependencies?.vite}`,
    proofParser: `typescript@${ts.version}`,
    routerDependency: false,
    uiKitDependency: false,
    iconDependency: false,
  });
}

function verifyShellSemantics(files) {
  const application = decodeUtf8(
    files.get("apps/desen-app/src/application.tsx"),
    "application.tsx",
  );
  const navigation = decodeUtf8(
    files.get("apps/desen-app/src/project-navigation.ts"),
    "project-navigation.ts",
  );
  const data = decodeUtf8(files.get("apps/desen-app/src/project-data.ts"), "project-data.ts");
  const main = decodeUtf8(files.get("apps/desen-app/src/main.tsx"), "main.tsx");
  const globalStyles = decodeUtf8(files.get("apps/desen-app/src/styles.css"), "styles.css");
  const moduleStyles = decodeUtf8(
    files.get("apps/desen-app/src/application.module.css"),
    "application.module.css",
  );
  const readme = decodeUtf8(files.get("apps/desen-app/README.md"), "apps/desen-app/README.md");

  for (const required of [
    "useSyncExternalStore",
    "aria-current",
    "Skip to main content",
    "data-route-heading",
    "Capability catalogs",
    "New project",
    "Project creation unlocks with catalog setup.",
  ]) {
    requireText(application, required, "application.tsx");
  }
  for (const required of [
    'kind: "projects"',
    'kind: "project"',
    'kind: "not-found"',
    '"popstate"',
    ".pushState",
    ".replaceState",
    "destination.origin !== window.location.origin",
  ]) {
    requireText(navigation, required, "project-navigation.ts");
  }
  requireText(
    navigation,
    "return `${window.location.pathname}${window.location.search}${window.location.hash}`;",
    "project-navigation.ts",
  );
  requireText(
    navigation,
    'window.location.pathname !== "/" ||\n    window.location.search !== "" ||\n    window.location.hash !== ""',
    "project-navigation.ts",
  );
  for (const required of ['id: "account-app"', 'id: "checkout-pilot"', "Object.freeze("]) {
    requireText(data, required, "project-data.ts");
  }
  for (const required of ["normalizeInitialDesenAppLocation", "StrictMode", '"pagehide"']) {
    requireText(main, required, "main.tsx");
  }
  for (const required of ["--desen-app-", ":focus-visible", "prefers-reduced-motion"]) {
    requireText(globalStyles, required, "styles.css");
  }
  for (const required of ["@media", "var(--desen-app-", ".visuallyHidden"]) {
    requireText(moduleStyles, required, "application.module.css");
  }
  for (const required of ["M09-T01", "M09-T02", "History API", "not implemented"]) {
    requireText(readme, required, "apps/desen-app/README.md");
  }

  for (const [relativePath, source] of [
    ["application.tsx", application],
    ["project-navigation.ts", navigation],
    ["project-data.ts", data],
    ["main.tsx", main],
  ]) {
    rejectText(
      source,
      /(?:dangerouslySetInnerHTML|\beval\s*\(|\bnew\s+Function\s*\()/u,
      relativePath,
    );
    rejectText(source, /from\s+["']@desen\//u, relativePath);
  }
  rejectText(
    application,
    /(?:createDesenEditor|useRuntimeReactSurface|publish|activateRevision)\s*\(/u,
    "application.tsx",
  );

  return deepFreeze({
    routes: ["/projects", "/projects/:projectId", "/projects/:projectId/surfaces/:surfaceId"],
    navigationAuthority: "SAME_ORIGIN_HISTORY_API_WITH_POPSTATE_AND_APP_EVENT",
    unknownRoutePolicy: "EXPLICIT_NOT_FOUND",
    fixtureProjects: ["account-app", "checkout-pilot"],
    search: "INERT_FIXED_FIXTURE_FILTER",
    responsiveCss: true,
    reducedMotionHonored: true,
    keyboardFocusVisible: true,
    routeHeadingFocus: true,
    landmarksAndCurrentPageSemantics: true,
    disabledFutureActionsExplained: true,
    appTokenPrefix: "--desen-app-",
  });
}

function countRegisteredTests(source) {
  return [...source.matchAll(/\b(?:it|test)\s*\(\s*["'`]/gu)].length;
}

function verifyTests(files) {
  const registrations = {};
  for (const relativePath of TEST_PATHS) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const count = countRegisteredTests(source);
    if (count < 2) {
      fail("TEST_AUTHORITY_DRIFT", `${relativePath} must retain positive and negative cases.`);
    }
    registrations[path.basename(relativePath)] = count;
  }
  const navigation = decodeUtf8(
    files.get("apps/desen-app/test/project-navigation.test.ts"),
    "project-navigation.test.ts",
  );
  const application = decodeUtf8(
    files.get("apps/desen-app/test/application.test.tsx"),
    "application.test.tsx",
  );
  for (const required of ["not-found", "cross-origin", "popstate", "pushState"]) {
    requireText(navigation, required, "project-navigation.test.ts");
  }
  for (const required of ["Search projects", "New project", "aria-current", "not found"]) {
    requireText(application, required, "application.test.tsx");
  }
  const runtimeCases = {
    "project-navigation.test.ts": 30,
    "application.test.tsx": 10,
    "main-lifecycle.test.tsx": 3,
  };
  if (
    registrations["project-navigation.test.ts"] !== 8 ||
    exactTextCount(navigation, "it.each(") !== 2 ||
    registrations["application.test.tsx"] !== 6 ||
    exactTextCount(application, "it.each(") !== 1 ||
    registrations["main-lifecycle.test.tsx"] !== 3
  ) {
    fail("TEST_AUTHORITY_DRIFT", "The exact 43-case focused Vitest matrix drifted.");
  }
  return deepFreeze({
    files: TEST_PATHS.length,
    registrations,
    runtimeCases,
    totalRuntimeCases: Object.values(runtimeCases).reduce((total, count) => total + count, 0),
    positiveAndNegativeCoverage: true,
    executionAuthority: "ROOT_SCRIPT_REQUIRES_SUCCESSFUL_FOCUSED_VITEST_RUN",
  });
}

function resolveTrackedSourceImport(importerPath, specifier) {
  if (
    specifier.includes("\\") ||
    specifier.includes("?") ||
    specifier.includes("#") ||
    !/^(?:\.\.?\/)[a-zA-Z0-9._/-]+$/u.test(specifier)
  ) {
    fail("IMPORT_BOUNDARY_DRIFT", `${importerPath} has an invalid relative import.`, {
      specifier,
    });
  }
  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(importerPath), specifier),
  );
  const extension = path.posix.extname(resolved);
  const candidates =
    extension === ".js"
      ? [`${resolved.slice(0, -3)}.ts`, `${resolved.slice(0, -3)}.tsx`]
      : [".ts", ".tsx", ".css"].includes(extension)
        ? [resolved]
        : [];
  const trackedTargets = candidates.filter((candidate) => SOURCE_PATHS.includes(candidate));
  if (trackedTargets.length !== 1) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      `${importerPath} imports a relative module outside the exact tracked source authority.`,
      { specifier },
    );
  }
  return trackedTargets[0];
}

function inspectImports(files) {
  const imports = [];
  for (const relativePath of SOURCE_PATHS.filter((entry) => /\.(?:ts|tsx)$/u.test(entry))) {
    const source = decodeUtf8(files.get(relativePath), relativePath);
    const sourceFile = ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (sourceFile.parseDiagnostics.length > 0) {
      fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has TypeScript parse diagnostics.`, {
        diagnosticCodes: sourceFile.parseDiagnostics.map(({ code }) => code),
      });
    }
    const recordSpecifier = (moduleSpecifier, kind) => {
      if (!ts.isStringLiteralLike(moduleSpecifier)) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} has a non-literal module specifier.`);
      }
      const specifier = moduleSpecifier.text;
      if (specifier.startsWith(".")) {
        imports.push({
          kind,
          path: relativePath,
          specifier,
          resolvedPath: resolveTrackedSourceImport(relativePath, specifier),
        });
        return;
      }
      if (specifier !== "react" && specifier !== "react-dom/client") {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} imports an unreviewed package.`, {
          specifier,
        });
      }
      imports.push({ kind, path: relativePath, specifier, resolvedPath: null });
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        recordSpecifier(node.moduleSpecifier, "import");
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        recordSpecifier(node.moduleSpecifier, "re-export");
      } else if (ts.isImportEqualsDeclaration(node) || ts.isImportTypeNode(node)) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an indirect import declaration.`);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        fail("IMPORT_BOUNDARY_DRIFT", `${relativePath} contains an executable dynamic import.`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  const indexHtml = decodeUtf8(files.get("apps/desen-app/index.html"), "index.html");
  const expectedModuleEntry = '<script type="module" src="/src/main.tsx"></script>';
  const scriptOpenings = [...indexHtml.matchAll(/<script\b/giu)].length;
  const scriptClosings = [...indexHtml.matchAll(/<\/script\s*>/giu)].length;
  if (
    exactTextCount(indexHtml, expectedModuleEntry) !== 1 ||
    scriptOpenings !== 1 ||
    scriptClosings !== 1 ||
    /\s(?:on[a-z][a-z0-9_-]*|srcdoc)\s*=/iu.test(indexHtml) ||
    /\bjavascript\s*:/iu.test(indexHtml) ||
    /<(?:iframe|object|embed)\b/iu.test(indexHtml)
  ) {
    fail(
      "IMPORT_BOUNDARY_DRIFT",
      "index.html must retain one exact module entry and no other executable HTML authority.",
    );
  }
  return deepFreeze({
    method: "TYPESCRIPT_AST_MODULE_SPECIFIER_INVENTORY_WITH_TRACKED_RELATIVE_RESOLUTION",
    imports,
    htmlModuleEntry: "/src/main.tsx",
    desenPackageImports: 0,
    arbitraryExecutableImports: 0,
    arbitraryExecutableHtmlEntries: 0,
  });
}

async function readTrackedFiles(options) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    const override = options.fileOverrides.get(relativePath);
    files.set(
      relativePath,
      override ??
        (await readRegularAuthority(path.join(options.workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function receipts(files) {
  return TRACKED_PATHS.map((relativePath) => {
    const bytes = files.get(relativePath);
    return deepFreeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  });
}

function canonicalArtifactBytes(artifact) {
  return Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

/** Builds deterministic, detached M09-T01 shell/navigation evidence. */
export async function buildDesenAppShellNavigationEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const [files, prerequisiteBytes] = await Promise.all([
    readTrackedFiles(options),
    options.prerequisiteBytes ?? readRegularAuthority(options.prerequisitePath, PREREQUISITE_PATH),
  ]);
  const prerequisite = verifyPrerequisite(prerequisiteBytes);
  const packageContract = verifyPackage(
    files.get("apps/desen-app/package.json"),
    files.get("package.json"),
  );
  const shell = verifyShellSemantics(files);
  const tests = verifyTests(files);
  const importBoundary = inspectImports(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-shell-navigation",
    profile: "desen.app.shell-navigation-proof.v1",
    task: "M09-T01",
    result: "PASS",
    prerequisite,
    claim: {
      taskStatus: "DONE",
      prerequisiteGate: "G08",
      prerequisiteStatus: "DONE",
      shellImplemented: true,
      projectNavigationImplemented: true,
      directUrlNavigationImplemented: true,
      unknownRoutesFailClosed: true,
      catalogDrivenPanelImplemented: false,
      realAdapterCanvasImplemented: false,
      selectionOrInspectorImplemented: false,
      persistenceUiImplemented: false,
      runOrPublishImplemented: false,
      userProjectCreationImplemented: false,
    },
    application: {
      package: packageContract,
      shell,
    },
    boundary: {
      imports: importBoundary,
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
    },
    evidence: {
      tests,
      rootTestNames: DESEN_APP_SHELL_NAVIGATION_ROOT_TEST_NAMES,
    },
    nonclaims: [
      "No catalog-driven component panel or layer tree.",
      "No runtime-react canvas, adapter execution, selection overlay, or inspector.",
      "No editor-core mutation, undo, save/open, Design/Run, fixture execution, publish, or activation.",
      "No user-created project persistence; New project remains disabled and explained.",
    ],
  });
  const artifactBytes = canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(proofDocument, artifactSha256) {
  const text = decodeUtf8(proofDocument, PROOF_DOCUMENT_PATH);
  if (
    exactTextCount(text, ARTIFACT_PATH) < 1 ||
    exactTextCount(text, `sha256:${artifactSha256}`) !== 1 ||
    exactTextCount(text, "[PENDING_FINAL_ARTIFACT_SHA256]") !== 0 ||
    exactTextCount(text, "M09-T01") < 1 ||
    !/(?:Status:\s*`?DONE`?|M09-T01\s*\|\s*DONE)/u.test(text)
  ) {
    fail("PROOF_PIN_DRIFT", "The visible M09-T01 proof path, digest, or DONE association drifted.");
  }
}

/** Verifies committed artifact bytes and their visible proof-document association. */
export async function verifyDesenAppShellNavigationEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppShellNavigationEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T01 artifact bytes differ from fresh evidence.");
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
    trackedFiles: built.artifact.boundary.trackedFiles,
    focusedRuntimeCases: built.artifact.evidence.tests.totalRuntimeCases,
    prerequisiteGate: built.artifact.claim.prerequisiteGate,
    prerequisiteStatus: built.artifact.claim.prerequisiteStatus,
  });
}

/** Atomically writes exact deterministic M09-T01 evidence. */
export async function writeDesenAppShellNavigationEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_SHELL_NAVIGATION_ARTIFACT_PATH,
  );
  const built = await buildDesenAppShellNavigationEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T01 artifact write failed safely.", {
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
    focusedRuntimeCases: built.artifact.evidence.tests.totalRuntimeCases,
  });
}
