import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";

import { format } from "prettier";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-USER-CREATED-BLANK-PROJECT.md";
const MAX_AUTHORITY_BYTES = 16 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const SOURCE_PATHS = Object.freeze({
  main: "apps/desen-app/src/main.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  localPersistence: "apps/desen-app/src/local-runtime-persistence.ts",
  application: "apps/desen-app/src/application.tsx",
  projectData: "apps/desen-app/src/project-data.ts",
  emptyProject: "apps/desen-app/src/reference-empty-project.ts",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  localDevLauncher: "apps/desen-app/dev/local-dev.mjs",
  productSpec: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
  productServer: "apps/desen-app-browser-e2e/product-proof-server.mjs",
  productPlaywright: "apps/desen-app-browser-e2e/product-playwright.config.ts",
});

const PACKAGE_PATHS = Object.freeze({
  rootPackage: "package.json",
  appPackage: "apps/desen-app/package.json",
  browserPackage: "apps/desen-app-browser-e2e/package.json",
  lockfile: "pnpm-lock.yaml",
  appTsconfig: "apps/desen-app/tsconfig.local-dev.json",
  browserPlaywright: "apps/desen-app-browser-e2e/playwright.config.ts",
  workflow: ".github/workflows/ci.yml",
});

const BOUNDARY_PATHS = Object.freeze({
  gitignore: ".gitignore",
  configuration: "dependency-cruiser.config.cjs",
  verifier: "scripts/verify-boundary-fixtures.mjs",
  readme: "tests/boundaries/README.md",
  allowedControlPlaneRoot:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/control-plane-api/dist/index.js",
  allowedProductServer:
    "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-product-server-control-plane-root/apps/desen-app-browser-e2e/product-proof-server.mjs",
  rejectedNonProductControlPlaneRoot:
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/control-plane-api/dist/index.js",
  rejectedNonProductServer:
    "tests/boundaries/fixtures/desen-app-browser-e2e-non-product-server-imports-control-plane/apps/desen-app-browser-e2e/proof-application.mjs",
  rejectedPrivateControlPlaneModule:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/control-plane-api/dist/runtime-activation-sqlite-internal.js",
  rejectedPrivateProductServer:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-control-plane-private/apps/desen-app-browser-e2e/product-proof-server.mjs",
  rejectedOtherAppProductServer:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app-browser-e2e/product-proof-server.mjs",
  rejectedOtherAppSource:
    "tests/boundaries/fixtures/desen-app-browser-e2e-product-server-imports-other-app/apps/desen-app/src/application.js",
});

const EXPECTED_BOUNDARY_FIXTURE_CONTENT = Object.freeze({
  [BOUNDARY_PATHS.allowedControlPlaneRoot]:
    'export const openLocalControlPlane = () => "public-build-root";\n',
  [BOUNDARY_PATHS.allowedProductServer]:
    'import { openLocalControlPlane } from "../control-plane-api/dist/index.js";\n\nexport const allowedProductProofComposition = openLocalControlPlane();\n',
  [BOUNDARY_PATHS.rejectedNonProductControlPlaneRoot]:
    'export const openLocalControlPlane = () => "public-build-root";\n',
  [BOUNDARY_PATHS.rejectedNonProductServer]:
    'import { openLocalControlPlane } from "../control-plane-api/dist/index.js";\n\nexport const invalidNonProductServerControlPlaneDependency = openLocalControlPlane();\n',
  [BOUNDARY_PATHS.rejectedPrivateControlPlaneModule]:
    'export const privateActivationDatabase = "private";\n',
  [BOUNDARY_PATHS.rejectedPrivateProductServer]:
    'import { privateActivationDatabase } from "../control-plane-api/dist/runtime-activation-sqlite-internal.js";\n\nexport const invalidPrivateControlPlaneDependency = privateActivationDatabase;\n',
  [BOUNDARY_PATHS.rejectedOtherAppProductServer]:
    'import { applicationName } from "../desen-app/src/application.js";\n\nexport const invalidProductServerApplicationDependency = applicationName;\n',
  [BOUNDARY_PATHS.rejectedOtherAppSource]: 'export const applicationName = "desen-app";\n',
});

const BOUNDARY_AUTHORITY_PATHS = Object.freeze(
  [PACKAGE_PATHS.rootPackage, ...Object.values(BOUNDARY_PATHS)].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  ),
);

const TEST_PATHS = Object.freeze([
  "apps/desen-app/dev/local-dev-host.test.mjs",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/local-runtime-persistence.test.ts",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/test/product-bootstrap.test.tsx",
]);

const PRESENTATION_PATHS = Object.freeze([
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/styles.css",
]);

const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
  "scripts/generate-desen-app-user-created-blank-project-proof.mjs",
  "scripts/verify-desen-app-user-created-blank-project.mjs",
  "tests/desen-app-user-created-blank-project.test.mjs",
]);

const PARENT_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-browser-e2e-workspace-compatibility.json";

const TRACKED_PATHS = Object.freeze(
  [
    ...Object.values(SOURCE_PATHS),
    ...Object.values(PACKAGE_PATHS),
    ...Object.values(BOUNDARY_PATHS),
    ...TEST_PATHS,
    ...PRESENTATION_PATHS,
    PARENT_ARTIFACT_PATH,
    ...PROOF_READER_PATHS,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

/** Exact immutable M10-T01-COMPAT predecessor required by the user-created project proof. */
export const DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN = Object.freeze({
  task: "M10-T01-COMPAT",
  gate: null,
  proofId: "desen-app-browser-e2e-workspace-compatibility",
  path: PARENT_ARTIFACT_PATH,
  bytes: 16_025,
  sha256: "e90378e191fddea1264c8c056e2ff7a72fdfd945d1b1113465c12ddbffb1888d",
  profile: "desen.app.browser-e2e-workspace-compatibility-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Independent root cases owned by the append-only M10-T01A proof family. */
export const DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates the exact immutable M10-T01-COMPAT predecessor",
  "[entry] normal main composes the product bootstrap and injected durable port",
  "[creation] visible New project UI creates only the exact admitted blank profile",
  "[runtime] local launcher binds a fresh secret, fixed loopback, and durable Source store",
  "[browser] real Chromium begins at zero projects and uses only visible product controls",
  "[authoring] native Components and Layers gestures build the sign-in Source",
  "[persistence] generation one creation and generation two authored save survive reload",
  "[reopen] project and surface navigation reopen the exact saved Source",
  "[package] dedicated product E2E and hosted workflow retain exact ownership",
  "[determinism] detached evidence is byte-stable with complete exact file receipts",
  "[policy] source, artifact, report, option, and destination drift fail closed",
]);

/** Default destination of the deterministic M10-T01A artifact. */
export const DEFAULT_DESEN_APP_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);

const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);
const PRODUCT_TEST_NAME =
  "creates, authors, persists, reloads, and reopens a blank sign-in project through the normal product UI";
const IMMUTABLE_M10_T01A_ARTIFACT_PIN = Object.freeze({
  bytes: 20_173,
  sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
});
const SECURE_SCROLL_COMPATIBILITY_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
    bytes: 15_935,
    sha256: "1ea724a50606719b597ddfee7db95594a9a1272d2cac33fd2c23800879b9cbc1",
  }),
  Object.freeze({
    path: "apps/desen-app/src/application.module.css",
    bytes: 112_302,
    sha256: "4ff3d05e8160ab8b155b1e9a24a565dd2988e808a02dd29cb375dc8edc2f41d1",
  }),
  Object.freeze({
    path: "apps/desen-app/src/inspector-panel.tsx",
    bytes: 32_412,
    sha256: "06e62b9449aa4f1ea05bc0b28d045897897baabfbf257eff9b9bafa842ecf470",
  }),
  Object.freeze({
    path: "apps/desen-app/test/inspector-panel.test.tsx",
    bytes: 27_492,
    sha256: "ee46354d9ff0c09fe6b85e4a7ee66a85221832ce0c198d0319222b3cda90d6b5",
  }),
]);
const SECURE_SCROLL_COMPATIBILITY_OVERRIDE_PATHS = Object.freeze(
  [
    ...new Set([...TRACKED_PATHS, ...SECURE_SCROLL_COMPATIBILITY_RECEIPTS.map(({ path }) => path)]),
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);
const SECURE_SCROLL_CHECKPOINT_RESEALED_PATHS = Object.freeze([
  "scripts/lib/desen-app-user-created-blank-project-proof.mjs",
  "tests/desen-app-user-created-blank-project.test.mjs",
]);

/** Stable fail-closed error raised by the M10-T01A reader. */
export class DesenAppUserCreatedBlankProjectProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppUserCreatedBlankProjectProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppUserCreatedBlankProjectProofError(code, message, details);
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

function captureOverrides(value, allowedPaths = TRACKED_PATHS) {
  if (value === undefined) return Object.freeze(new Map());
  if (!(value instanceof Map) || utilTypes.isProxy(value) || value.size > allowedPaths.length) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (!allowedPaths.includes(relativePath) || captured.has(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an unknown or duplicate path.", {
        path: relativePath,
      });
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return Object.freeze(captured);
}

function captureBuildOptions(value, allowedOverridePaths = TRACKED_PATHS) {
  const options = exactOwnDataOptions(value, ["fileOverrides", "workspaceRoot"], "build options");
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureOverrides(options.fileOverrides, allowedOverridePaths),
  });
}

function trackedBuildOptions(options) {
  return Object.freeze({
    workspaceRoot: options.workspaceRoot,
    fileOverrides: new Map(
      [...options.fileOverrides].filter(([relativePath]) => TRACKED_PATHS.includes(relativePath)),
    ),
  });
}

async function readRegularAuthority(absolutePath, label) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("AUTHORITY_UNREADABLE", `${label} could not be inspected.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_AUTHORITY_BYTES) {
    fail("AUTHORITY_UNSAFE", `${label} must be one bounded regular non-symlink file.`);
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
    const [opened, current] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      !opened.isFile() ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino ||
      opened.size !== current.size ||
      opened.size > MAX_AUTHORITY_BYTES
    ) {
      fail("AUTHORITY_UNSAFE", `${label} changed identity while open.`);
    }
    const bytes = Buffer.allocUnsafe(opened.size + 1);
    let offset = 0;
    while (offset <= opened.size) {
      const { bytesRead } = await handle.read(bytes, offset, opened.size + 1 - offset, null);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== opened.size) fail("AUTHORITY_UNSAFE", `${label} changed while read.`);
    return Buffer.from(bytes.subarray(0, offset));
  } catch (error) {
    if (error instanceof DesenAppUserCreatedBlankProjectProofError) throw error;
    fail("AUTHORITY_UNREADABLE", `${label} could not be read safely.`, { cause: String(error) });
  } finally {
    await handle?.close();
  }
}

async function readTrackedFiles(workspaceRoot, overrides) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    const override = overrides.get(relativePath);
    files.set(
      relativePath,
      override ??
        (await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath)),
    );
  }
  return files;
}

function decodeUtf8(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  const text = Buffer.from(bytes).toString("utf8");
  if (text.includes("\0") || !Buffer.from(text).equals(Buffer.from(bytes))) {
    fail(code, `${label} must be exact UTF-8 text.`);
  }
  return text;
}

function parseJson(bytes, label, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, label, code));
  } catch (error) {
    if (error instanceof DesenAppUserCreatedBlankProjectProofError) throw error;
    fail(code, `${label} must be valid JSON.`);
  }
}

function requireMarkers(source, label, required, forbidden = []) {
  const missing = required.filter((marker) => !source.includes(marker));
  const present = forbidden.filter((marker) => source.includes(marker));
  if (missing.length !== 0 || present.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", `${label} lost the reviewed product-flow contract.`, {
      missing,
      forbiddenPresent: present,
    });
  }
}

function occurrenceCount(source, marker) {
  return source.split(marker).length - 1;
}

function requireExactBoundaryMarkers(source, label, markers) {
  const drifted = markers.filter(
    ([marker, expectedOccurrences]) => occurrenceCount(source, marker) !== expectedOccurrences,
  );
  if (drifted.length !== 0) {
    fail("BOUNDARY_CONTRACT_DRIFT", `${label} lost the reviewed boundary contract.`, {
      drifted: drifted.map(([marker, expectedOccurrences]) => ({
        marker,
        expectedOccurrences,
        actualOccurrences: occurrenceCount(source, marker),
      })),
    });
  }
}

function captureSourceInput(value) {
  const expectedKeys = Object.keys(SOURCE_PATHS);
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    !isDeepStrictEqual(Reflect.ownKeys(value), expectedKeys)
  ) {
    fail("SOURCE_POLICY_VIOLATION", "Source policy input fields drifted.");
  }
  const captured = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      Buffer.byteLength(descriptor.value) > MAX_AUTHORITY_BYTES
    ) {
      fail("SOURCE_POLICY_VIOLATION", `Source policy input ${key} must be bounded own text.`);
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

/** Verifies the normal-product bootstrap, local runtime, and user-visible Chromium scenario. */
export function verifyDesenAppUserCreatedBlankProjectSourcePolicy(rawInput) {
  const input = captureSourceInput(rawInput);
  requireMarkers(
    input.main,
    SOURCE_PATHS.main,
    [
      'import { DesenAppProduct } from "./product-bootstrap.js";',
      'import { createInjectedDesenAppLocalPersistencePort } from "./local-runtime-persistence.js";',
      "createInjectedDesenAppLocalPersistencePort",
      "const browserFetch = globalThis.fetch.bind(globalThis);",
      "createInjectedDesenAppLocalPersistencePort(browserFetch)",
      "<DesenAppProduct persistencePort={persistencePort} />",
    ],
    ["EMPTY_REFERENCE_PROJECT_DOCUMENT", "initialDocument=", "proof-application"],
  );
  requireMarkers(
    input.productBootstrap,
    SOURCE_PATHS.productBootstrap,
    [
      "createAuthoringPersistenceController",
      "document: EMPTY_REFERENCE_PROJECT_DOCUMENT",
      "<dialog",
      "Create a project",
      "Blank sign-in project",
      "Create project",
      "controller.save()",
      "navigateDesenApp(PRODUCT_SURFACE_PATH)",
      "projectInventoryIsFixture={false}",
      "onRequestProjectCreation=",
      "preparedPersistenceController={controller}",
    ],
    ["localStorage", "sessionStorage", "createMemory", "proof"],
  );
  requireMarkers(
    input.localPersistence,
    SOURCE_PATHS.localPersistence,
    [
      'DESEN_APP_LOCAL_RUNTIME_PROFILE = "desen.app.local-runtime.v1"',
      "createLocalDesenEditorPersistencePort",
      "^http:\\/\\/127\\.0\\.0\\.1:",
      'credentials: "omit"',
      'redirect: "error"',
      'cache: "no-store"',
      "apiToken: config.controlPlane.apiToken",
      "FETCH_TIMEOUT_MILLISECONDS",
      "MAX_RESPONSE_BYTES",
    ],
    ["localhost", "https://", "localStorage"],
  );
  requireMarkers(
    input.localDevHost,
    SOURCE_PATHS.localDevHost,
    [
      "openLocalControlPlane",
      "controlPlane = await openControlPlane({",
      'DESEN_APP_LOCAL_DEV_ORIGIN = "http://127.0.0.1:5173"',
      'join(stateDirectory, "desen-app")',
      'join(appStateDirectory, "control-plane")',
      "randomBytes",
      "allowedOrigins: Object.freeze([DESEN_APP_LOCAL_DEV_ORIGIN])",
      "strictPort: true",
      "createDesenAppLocalRuntimeDefine(listener.origin, apiToken)",
    ],
    ["0.0.0.0", "localhost", "DESEN_API_TOKEN", "process.env"],
  );
  requireMarkers(input.localDevLauncher, SOURCE_PATHS.localDevLauncher, [
    "startDesenAppLocalDev",
    'stateDirectory: resolve(import.meta.dirname, "../../..", ".desen")',
    "Desen App is ready at ${host.appOrigin}",
    "Local Source persistence is active",
    'process.once("SIGINT"',
    'process.once("SIGTERM"',
  ]);
  requireMarkers(
    input.productServer,
    SOURCE_PATHS.productServer,
    [
      "openLocalControlPlane",
      "await build({",
      "await preview({",
      'mkdtemp(join(tmpdir(), "desen-product-browser-proof-"))',
      "allowedOrigins: Object.freeze([APP_ORIGIN])",
      "JSON.stringify(localRuntimeConfig)",
    ],
    ["proof-application", "EMPTY_REFERENCE_PROJECT_DOCUMENT", "initialDocument"],
  );
  requireMarkers(input.productPlaywright, SOURCE_PATHS.productPlaywright, [
    'testMatch: "user-created-blank-project.pw.ts"',
    'name: "product-chromium"',
    "workers: 1",
    "retries: 0",
    "reuseExistingServer: false",
    'command: "exec node apps/desen-app-browser-e2e/product-proof-server.mjs"',
  ]);
  requireMarkers(
    input.productSpec,
    SOURCE_PATHS.productSpec,
    [
      `test("${PRODUCT_TEST_NAME}"`,
      'await page.goto("/")',
      "/\\/projects$/u",
      'hasText: "0 projects"',
      'name: "New project"',
      'name: "Create a project"',
      'name: "Create project"',
      '"Source saved successfully. Generation 1."',
      '"Source saved successfully. Generation 2."',
      "new DataTransfer()",
      'componentDragHandle(page, "Text").dragTo(placementTarget(page))',
      "passwordDragHandle.dragTo(positionThree)",
      "await page.reload()",
      'name: "Open project"',
      "expect(runtimeFailures).toEqual([])",
    ],
    ["proof-application", "initialDocument", "page.evaluate(() => window", "test.skip"],
  );
  if (
    occurrenceCount(input.productSpec, `test("${PRODUCT_TEST_NAME}"`) !== 1 ||
    occurrenceCount(input.productSpec, ".dragTo(") !== 2 ||
    occurrenceCount(input.productSpec, "await page.reload()") !== 1 ||
    occurrenceCount(input.productSpec, "test(") !== 1
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The product Chromium scenario count, gesture count, or reload authority drifted.",
    );
  }
  requireMarkers(input.application, SOURCE_PATHS.application, [
    "onRequestProjectCreation",
    'aria-label="New project"',
    "preparedPersistenceController",
    "projectInventoryIsFixture",
    "data-canvas-frame={canvasFrameOrientation?.toLowerCase()",
    "data-canvas-frame-height={canvasFrame.frame.height}",
    "data-canvas-frame-width={canvasFrame.frame.width}",
  ]);
  requireMarkers(input.projectData, SOURCE_PATHS.projectData, [
    'id: "account-app"',
    'id: "sign-in"',
    "DESEN_APP_LOCAL_PROJECTS",
  ]);
  requireMarkers(input.emptyProject, SOURCE_PATHS.emptyProject, [
    "EMPTY_REFERENCE_PROJECT_DOCUMENT",
    'id: "com.example.account-app"',
    'entry: "sign-in"',
    'id: "sign-in.layout"',
    "width: 420",
    "height: 720",
  ]);

  return deepFreeze({
    normalProductEntry: true,
    productEntryInjectsDocument: false,
    visibleNewProjectControl: true,
    visibleBlankTemplate: true,
    exactProjectId: "account-app",
    exactSurfaceId: "sign-in",
    exactCatalogIdentity: "run.desen.reference.sign-in@0.1.0#web-react",
    frame: { preset: "portrait", width: 420, height: 720 },
    localRuntimeProfile: "desen.app.local-runtime.v1",
    fixedLoopbackOnly: true,
    freshBearerSecret: true,
    durableControlPlaneStore: true,
    productionBundlePreview: true,
    browserTestName: PRODUCT_TEST_NAME,
    browserTestDeclarations: 1,
    nativeDragCalls: 2,
    forgedDataTransferRejected: true,
    initialProjectCount: 0,
    creationGeneration: 1,
    authoredGeneration: 2,
    hardReloadCovered: true,
    visibleProjectReopenCovered: true,
    browserRuntimeErrorsAllowed: 0,
    browserExecutionPerformedByReader: false,
  });
}

function inspectBoundaryContract(files) {
  const rootPackage = parseJson(
    files.get(PACKAGE_PATHS.rootPackage),
    PACKAGE_PATHS.rootPackage,
    "BOUNDARY_CONTRACT_DRIFT",
  );
  if (
    rootPackage?.scripts?.boundaries !==
      "depcruise --config dependency-cruiser.config.cjs apps packages && node scripts/verify-boundary-fixtures.mjs" ||
    rootPackage?.devDependencies?.["dependency-cruiser"] !== "18.1.0"
  ) {
    fail(
      "BOUNDARY_CONTRACT_DRIFT",
      "The root package lost the exact dependency boundary command or tool version.",
    );
  }

  const gitignore = decodeUtf8(
    files.get(BOUNDARY_PATHS.gitignore),
    BOUNDARY_PATHS.gitignore,
    "BOUNDARY_CONTRACT_DRIFT",
  );
  const ignoreLines = gitignore.split(/\r?\n/u);
  for (const expectedLine of [
    ".desen/",
    "!tests/boundaries/fixtures/*/apps/control-plane-api/dist/",
    "!tests/boundaries/fixtures/*/apps/control-plane-api/dist/**",
  ]) {
    if (ignoreLines.filter((line) => line === expectedLine).length !== 1) {
      fail("BOUNDARY_CONTRACT_DRIFT", ".gitignore lost an exact boundary fixture or state rule.", {
        expectedLine,
      });
    }
  }

  const configuration = decodeUtf8(
    files.get(BOUNDARY_PATHS.configuration),
    BOUNDARY_PATHS.configuration,
    "BOUNDARY_CONTRACT_DRIFT",
  );
  requireExactBoundaryMarkers(configuration, BOUNDARY_PATHS.configuration, [
    ['"desen-app-browser-e2e": ["editor-core"],', 1],
    ["const desenAppBrowserProductProofServerPath =", 1],
    ["const controlPlanePublicBuildEntryPath =", 1],
    ['name: "desen-app-browser-e2e-reviewed-app-source-only"', 1],
    ["pathNot: desenAppBrowserProductProofServerPath", 1],
    ['name: "desen-app-browser-e2e-product-server-control-plane-public-root-only"', 1],
    ["from: { path: desenAppBrowserProductProofServerPath }", 2],
    ["pathNot: controlPlanePublicBuildEntryPath", 1],
    ['name: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies"', 1],
    ['path: "^apps/(?!desen-app-browser-e2e/|control-plane-api/)",', 1],
  ]);

  const verifier = decodeUtf8(
    files.get(BOUNDARY_PATHS.verifier),
    BOUNDARY_PATHS.verifier,
    "BOUNDARY_CONTRACT_DRIFT",
  );
  const fixtureCases = [
    {
      name: "allowed-desen-app-browser-e2e-product-server-control-plane-root",
      expectedRule: null,
    },
    {
      name: "desen-app-browser-e2e-non-product-server-imports-control-plane",
      expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
    },
    {
      name: "desen-app-browser-e2e-product-server-imports-control-plane-private",
      expectedRule: "desen-app-browser-e2e-product-server-control-plane-public-root-only",
    },
    {
      name: "desen-app-browser-e2e-product-server-imports-other-app",
      expectedRule: "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
    },
  ];
  for (const fixtureCase of fixtureCases) {
    requireExactBoundaryMarkers(verifier, BOUNDARY_PATHS.verifier, [
      [
        `name: "${fixtureCase.name}",\n    expectedRule: ${
          fixtureCase.expectedRule === null ? "null" : `"${fixtureCase.expectedRule}"`
        }`,
        1,
      ],
    ]);
  }

  const boundaryReadme = decodeUtf8(
    files.get(BOUNDARY_PATHS.readme),
    BOUNDARY_PATHS.readme,
    "BOUNDARY_CONTRACT_DRIFT",
  );
  requireExactBoundaryMarkers(boundaryReadme, BOUNDARY_PATHS.readme, [
    ["normal-product browser proof", 1],
    ["built public Control Plane `index`", 1],
    ["deep/private", 1],
    ["every other application root", 1],
  ]);

  const fixturePaths = Object.keys(EXPECTED_BOUNDARY_FIXTURE_CONTENT).sort((left, right) =>
    left.localeCompare(right, "en-US"),
  );
  for (const fixturePath of fixturePaths) {
    const actual = decodeUtf8(files.get(fixturePath), fixturePath, "BOUNDARY_CONTRACT_DRIFT");
    if (actual !== EXPECTED_BOUNDARY_FIXTURE_CONTENT[fixturePath]) {
      fail("BOUNDARY_CONTRACT_DRIFT", `${fixturePath} drifted from its exact fixture authority.`);
    }
  }

  return deepFreeze({
    command: "pnpm boundaries",
    rootScript: rootPackage.scripts.boundaries,
    dependencyCruiserVersion: rootPackage.devDependencies["dependency-cruiser"],
    productServerPath: "apps/desen-app-browser-e2e/product-proof-server.mjs",
    admittedControlPlaneEntry: "apps/control-plane-api/dist/index.js",
    rules: [
      "desen-app-browser-e2e-reviewed-app-source-only",
      "desen-app-browser-e2e-product-server-control-plane-public-root-only",
      "desen-app-browser-e2e-product-server-has-no-other-application-dependencies",
    ],
    fixtureCases,
    exactFixtureFiles: fixturePaths.length,
    authorityFiles: 1 + Object.keys(BOUNDARY_PATHS).length,
    durableStateIgnored: true,
    ignoredDistFixturesReadmitted: true,
    executionPerformedByReader: false,
  });
}

function inspectPackageContract(files) {
  const app = parseJson(files.get(PACKAGE_PATHS.appPackage), PACKAGE_PATHS.appPackage);
  const browser = parseJson(files.get(PACKAGE_PATHS.browserPackage), PACKAGE_PATHS.browserPackage);
  const lockfile = decodeUtf8(files.get(PACKAGE_PATHS.lockfile), PACKAGE_PATHS.lockfile);
  const workflow = decodeUtf8(files.get(PACKAGE_PATHS.workflow), PACKAGE_PATHS.workflow);
  const appTsconfig = parseJson(files.get(PACKAGE_PATHS.appTsconfig), PACKAGE_PATHS.appTsconfig);
  const expectedBrowserCommand =
    "pnpm --filter @desen/app-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts";
  const requiredWorkflowBlock = [
    "node scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs",
    "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
    "node scripts/verify-desen-app-user-created-blank-project.mjs",
    "node --test tests/desen-app-user-created-blank-project.test.mjs",
  ];
  const missingWorkflowMarkers = requiredWorkflowBlock.filter(
    (marker) => !workflow.includes(marker),
  );
  if (
    app?.name !== "@desen/app-web" ||
    app?.scripts?.dev !== "node dev/local-dev.mjs" ||
    app?.scripts?.["test:local-runtime"] !==
      "vitest run test/local-runtime-persistence.test.ts dev/local-dev-host.test.mjs" ||
    app?.scripts?.["test:product-bootstrap"] !==
      "vitest run test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx" ||
    app?.devDependencies?.["@desen/control-plane-api"] !== "workspace:*" ||
    app?.dependencies?.["@desen/editor-web"] !== "workspace:*" ||
    browser?.name !== "@desen/app-browser-e2e" ||
    browser?.scripts?.["test:e2e"] !== expectedBrowserCommand ||
    browser?.devDependencies?.["@desen/control-plane-api"] !== "workspace:*" ||
    browser?.devDependencies?.["@playwright/test"] !== "1.62.1" ||
    !isDeepStrictEqual(appTsconfig?.include, ["dev/local-dev-host.mjs", "dev/local-dev.mjs"]) ||
    missingWorkflowMarkers.length !== 0 ||
    !workflow.includes("run: pnpm --filter @desen/app-browser-e2e test:e2e") ||
    !lockfile.includes("apps/desen-app-browser-e2e:") ||
    !lockfile.includes("apps/desen-app:") ||
    !lockfile.includes("specifier: workspace:*")
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The product bootstrap package or hosted workflow drifted.", {
      missingWorkflowMarkers,
    });
  }
  return deepFreeze({
    appPackageName: app.name,
    browserPackageName: browser.name,
    appDevCommand: app.scripts.dev,
    appLocalRuntimeTestCommand: app.scripts["test:local-runtime"],
    appProductBootstrapTestCommand: app.scripts["test:product-bootstrap"],
    browserCommand: expectedBrowserCommand,
    browserProject: "product-chromium",
    playwrightVersion: "1.62.1",
    appOwnsPlaywright: false,
    dedicatedBrowserWorkspace: true,
    exactHeadBrowserExecution: true,
    workflowEvidenceOrder: requiredWorkflowBlock,
  });
}

function authenticateParent(bytes) {
  const pin = DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", "The exact immutable M10-T01-COMPAT predecessor drifted.");
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (
    artifact?.proofId !== pin.proofId ||
    artifact?.profile !== pin.profile ||
    artifact?.compatibilityReceipt !== pin.task ||
    artifact?.gate !== pin.gate ||
    artifact?.result !== pin.result
  ) {
    fail("PARENT_DRIFT", "The compatibility predecessor identity or result drifted.");
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

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(
    await format(JSON.stringify(artifact), {
      filepath: ARTIFACT_RELATIVE_PATH,
      parser: "json",
      printWidth: 100,
    }),
  );
}

async function inspectSecureScrollCompatibility(workspaceRoot, historicalArtifact, fileOverrides) {
  const compatibilityReceiptMap = new Map(
    SECURE_SCROLL_COMPATIBILITY_RECEIPTS.map((receipt) => [receipt.path, receipt]),
  );
  const historicalReceipts = historicalArtifact?.boundary?.trackedReceipts;
  if (!Array.isArray(historicalReceipts)) {
    fail("ARTIFACT_DRIFT", "The immutable M10-T01A receipt manifest drifted.");
  }
  let retainedHistoricalReceipts = 0;
  for (const receipt of historicalReceipts) {
    if (compatibilityReceiptMap.has(receipt?.path)) continue;
    if (SECURE_SCROLL_CHECKPOINT_RESEALED_PATHS.includes(receipt?.path)) continue;
    const bytes =
      fileOverrides.get(receipt.path) ??
      (await readRegularAuthority(path.join(workspaceRoot, receipt.path), receipt.path));
    if (bytes.byteLength !== receipt.bytes || sha256(bytes) !== receipt.sha256) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The retained M10-T01A historical receipt drifted: ${receipt.path}.`,
      );
    }
    retainedHistoricalReceipts += 1;
  }
  for (const receipt of SECURE_SCROLL_COMPATIBILITY_RECEIPTS) {
    const bytes =
      fileOverrides.get(receipt.path) ??
      (await readRegularAuthority(path.join(workspaceRoot, receipt.path), receipt.path));
    if (bytes.byteLength !== receipt.bytes || sha256(bytes) !== receipt.sha256) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        `The exact M10-T01A Secure-scroll compatibility receipt drifted: ${receipt.path}.`,
      );
    }
  }
  return deepFreeze({
    compatibilityReceipt: "M10-T01A-SECURE-SCROLL-COMPAT",
    additivePaths: Object.freeze([
      "apps/desen-app/src/inspector-panel.tsx",
      "apps/desen-app/test/inspector-panel.test.tsx",
    ]),
    checkpointResealedPaths: SECURE_SCROLL_CHECKPOINT_RESEALED_PATHS,
    correctiveReceiptOnly: true,
    immutableTaskArtifactPreserved: true,
    optionalBooleanGeometryContained: true,
    overriddenHistoricalPaths: Object.freeze([
      "apps/desen-app-browser-e2e/user-created-blank-project.pw.ts",
      "apps/desen-app/src/application.module.css",
    ]),
    replacementFocusPreservedWithoutOuterScroll: true,
    realChromiumGeometryRegressionCovered: true,
    retainedHistoricalReceipts,
    trackedReceipts: SECURE_SCROLL_COMPATIBILITY_RECEIPTS,
  });
}

/** Builds detached deterministic M10-T01A evidence without launching Chromium or a listener. */
export async function buildDesenAppUserCreatedBlankProjectEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const workspaceRoot = await realpath(options.workspaceRoot);
  const files = await readTrackedFiles(workspaceRoot, options.fileOverrides);
  const parent = authenticateParent(files.get(PARENT_ARTIFACT_PATH));
  const source = verifyDesenAppUserCreatedBlankProjectSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const boundaryAuthority = inspectBoundaryContract(files);
  const packageAuthority = inspectPackageContract(files);
  const trackedReceipts = receipts(files);
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-user-created-blank-project",
    profile: "desen.app.user-created-blank-project-proof.v1",
    task: "M10-T01A",
    gate: null,
    protocol: "0.1.0",
    target: "web-react",
    prerequisites: [parent],
    claim: {
      taskStatus: "DONE",
      p08Status: "PROVEN",
      normalProductEntryCovered: true,
      zeroProjectStartCovered: true,
      visibleProjectCreationCovered: true,
      exactBlankProfileCovered: true,
      fixtureBootstrapBypassed: true,
      durableLocalPersistenceCovered: true,
      visualAuthoringCovered: true,
      nativeComponentDragCovered: true,
      nativeLayerDragCovered: true,
      forgedDataTransferRejected: true,
      authoredDeletionCovered: true,
      generationOneCreationCovered: true,
      generationTwoSaveCovered: true,
      hardReloadCovered: true,
      visibleProjectReopenCovered: true,
      exactSourceReadBackCovered: true,
      designRunStaticParityCovered: true,
      productServerControlPlaneBoundaryCovered: true,
      runtimeInputAndPendingCovered: false,
      invalidCredentialsAndPublicFailureCovered: false,
      successNavigationAndHostOperationCovered: false,
      remoteDeploymentCovered: false,
      g10Closed: false,
    },
    authority: {
      source,
      package: packageAuthority,
      boundary: boundaryAuthority,
      authoredOutcome: {
        projectId: "account-app",
        surfaceId: "sign-in",
        statePaths: ["email", "password"],
        orderedComponentIds: ["node.text", "node.textfield", "node.textfield-2", "node.button"],
        bindings: ["state.email", "state.password"],
        deletedTransientComponent: "node.alert",
        createdGeneration: 1,
        authoredGeneration: 2,
      },
      execution: {
        normalProductEntry: "apps/desen-app/src/main.tsx",
        productionBundlePreview: true,
        realControlPlaneAdapter: true,
        fixedLoopbackOnly: true,
        transientProofStateRoot: true,
        durableLocalDevelopmentStateRoot: ".desen/desen-app/control-plane",
        injectedDocumentOrRouteAuthority: false,
        browserRerunOwnedByProofReader: false,
        hostedExecutionRequired: true,
      },
    },
    tests: {
      browserCommand: "pnpm --filter @desen/app-browser-e2e test:e2e",
      browserSpec: SOURCE_PATHS.productSpec,
      browserTestName: PRODUCT_TEST_NAME,
      browserTestDeclarations: 1,
      configuredProjects: ["product-chromium"],
      workers: 1,
      retries: 0,
      productBootstrapCommand: "pnpm --filter @desen/app-web test:product-bootstrap",
      localRuntimeCommand: "pnpm --filter @desen/app-web test:local-runtime",
      boundaryCommand: "pnpm boundaries",
      boundaryFixtureVerifier: "node scripts/verify-boundary-fixtures.mjs",
      proofReaderCommand: "node --test tests/desen-app-user-created-blank-project.test.mjs",
      verifierCommand: "node scripts/verify-desen-app-user-created-blank-project.mjs",
      rootTestNames: DESEN_APP_USER_CREATED_BLANK_PROJECT_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
      boundaryExecutedByVerifier: false,
    },
    boundary: {
      trackedFiles: TRACKED_PATHS.length,
      trackedReceipts,
      proofReaderPaths: PROOF_READER_PATHS,
      boundaryAuthorityPaths: BOUNDARY_AUTHORITY_PATHS,
      boundaryAuthorityFiles: BOUNDARY_AUTHORITY_PATHS.length,
      parentArtifacts: 1,
      immutableInputs: true,
      sourceSymlinksRejected: true,
      browserExecutionSeparateFromStaticReader: true,
    },
    result: "PASS",
    nonclaims: [
      "M10-T01A makes the completed M10-T01 authoring scenario reachable through the normal product UI; it does not replace or rewrite M10-T01 or M10-T01-COMPAT evidence.",
      "M10-T02 typed input dispatch and visible pending state remain NOT_PROVEN by this artifact.",
      "M10-T03 invalid-credentials and public failure rendering remain NOT_PROVEN by this artifact.",
      "M10-T04 successful navigation and one real host operation remain NOT_PROVEN by this artifact.",
      "The supported creation profile remains the exact Account app sign-in Source; arbitrary project schemas or identities are NOT_PROVEN.",
      "Remote deployment, multi-user persistence, and G10 closure remain NOT_PROVEN.",
      "The deterministic reader never starts Chromium, Vite, or a network listener; exact-head Browser E2E executes the pinned product scenario separately.",
      "The deterministic reader authenticates boundary policy and fixture bytes but does not execute dependency-cruiser; pnpm boundaries remains separately required.",
      "No hosted-CI pass is inferred from locally generated artifact bytes alone.",
    ],
  });
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function verifyProofDocument(bytes, artifactSha256) {
  const text = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App user-created blank project",
    "",
    "Task: M10-T01A",
    "",
    "Status: DONE",
    "",
    "P-08: PROVEN",
    "",
    "T02+: NOT_PROVEN",
    "",
    `Predecessor artifact: \`sha256:${DESEN_APP_USER_CREATED_BLANK_PROJECT_PARENT_PIN.sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !text.startsWith(expectedHeader) ||
    occurrenceCount(text, "Task: M10-T01A") !== 1 ||
    occurrenceCount(text, "Status: DONE") !== 1 ||
    occurrenceCount(text, "P-08: PROVEN") !== 1 ||
    occurrenceCount(text, "T02+: NOT_PROVEN") !== 1 ||
    occurrenceCount(text, "Final artifact:") !== 1 ||
    text.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T01A proof report lost its exact authority header.");
  }
}

/** Verifies immutable M10-T01A evidence plus its exact current compatibility receipts. */
export async function verifyDesenAppUserCreatedBlankProjectEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const compatibilityBuildOptions = captureBuildOptions(
    options.buildOptions,
    SECURE_SCROLL_COMPATIBILITY_OVERRIDE_PATHS,
  );
  await buildDesenAppUserCreatedBlankProjectEvidence(
    trackedBuildOptions(compatibilityBuildOptions),
  );
  const compatibilityWorkspaceRoot = await realpath(compatibilityBuildOptions.workspaceRoot);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
          ),
          ARTIFACT_RELATIVE_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (
    artifactBytes.byteLength !== IMMUTABLE_M10_T01A_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== IMMUTABLE_M10_T01A_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T01A artifact bytes drifted.");
  }
  const artifact = parseJson(artifactBytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.task !== "M10-T01A" ||
    artifact?.proofId !== "desen-app-user-created-blank-project" ||
    artifact?.profile !== "desen.app.user-created-blank-project-proof.v1" ||
    artifact?.result !== "PASS"
  ) {
    fail("ARTIFACT_DRIFT", "The immutable M10-T01A artifact identity drifted.");
  }
  const compatibility = await inspectSecureScrollCompatibility(
    compatibilityWorkspaceRoot,
    artifact,
    compatibilityBuildOptions.fileOverrides,
  );
  const proofDocument =
    options.proofDocument === undefined
      ? await readRegularAuthority(
          capturePath(options.proofDocumentPath, "proofDocumentPath", DEFAULT_PROOF_DOCUMENT_PATH),
          PROOF_DOCUMENT_RELATIVE_PATH,
        )
      : captureBytes(options.proofDocument, "proofDocument");
  verifyProofDocument(proofDocument, IMMUTABLE_M10_T01A_ARTIFACT_PIN.sha256);
  return deepFreeze({
    task: artifact.task,
    result: artifact.result,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: IMMUTABLE_M10_T01A_ARTIFACT_PIN.sha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    browserTestDeclarations: artifact.tests.browserTestDeclarations,
    p08Status: artifact.claim.p08Status,
    t02PlusStatus: "NOT_PROVEN",
    browserExecutedByVerifier: false,
    compatibilityReceipt: compatibility.compatibilityReceipt,
    compatibilityReceipts: compatibility.trackedReceipts.length,
    checkpointResealedReaders: compatibility.checkpointResealedPaths.length,
    correctiveReceiptOnly: compatibility.correctiveReceiptOnly,
    immutableTaskArtifactPreserved: compatibility.immutableTaskArtifactPreserved,
    retainedHistoricalReceipts: compatibility.retainedHistoricalReceipts,
  });
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

function authenticateImmutableArtifactBytes(bytes) {
  if (
    bytes.byteLength !== IMMUTABLE_M10_T01A_ARTIFACT_PIN.bytes ||
    sha256(bytes) !== IMMUTABLE_M10_T01A_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T01A artifact bytes drifted.");
  }
  return bytes;
}

/** Preserves the tracked M10-T01A artifact or copies only its authenticated bytes elsewhere. */
export async function writeDesenAppUserCreatedBlankProjectEvidence(rawOptions = undefined) {
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
  const requestedArtifactPath = capturePath(
    options.artifactPath,
    "artifactPath",
    DEFAULT_DESEN_APP_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
  );
  const verified = await verifyDesenAppUserCreatedBlankProjectEvidence({
    buildOptions: options.buildOptions,
  });
  const artifactBytes = authenticateImmutableArtifactBytes(
    await readRegularAuthority(
      DEFAULT_DESEN_APP_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH,
      ARTIFACT_RELATIVE_PATH,
    ),
  );
  let artifactPath;
  let trackedArtifactPath;
  try {
    [artifactPath, trackedArtifactPath] = await Promise.all([
      canonicalDestinationPath(requestedArtifactPath),
      canonicalDestinationPath(DEFAULT_DESEN_APP_USER_CREATED_BLANK_PROJECT_ARTIFACT_PATH),
    ]);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T01A artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  const summary = {
    task: verified.task,
    result: verified.result,
    artifactPath,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: IMMUTABLE_M10_T01A_ARTIFACT_PIN.sha256,
    trackedFiles: verified.trackedFiles,
  };
  if (artifactPath === trackedArtifactPath) {
    return deepFreeze({ ...summary, preserved: true });
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Historical M10-T01A artifact copy failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({ ...summary, preserved: false });
}
