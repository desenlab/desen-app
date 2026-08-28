import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const PROOF_DOCUMENT_PATH = "docs/proof/DESEN-APP-REAL-ADAPTER-CANVAS.md";
const SHELL_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-shell-navigation.json";
const HOST_SOURCE_AUDIT_ARTIFACT_PATH =
  "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const APP_INDEX_PATH = "apps/desen-app/index.html";
const ADAPTER_CANVAS_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const AUTHORING_DATA_SOURCE_PATH = "apps/desen-app/src/authoring-data.ts";
const AUTHORING_SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const AUTHORING_INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const AUTHORING_PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const INSPECTOR_PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const ADAPTER_CANVAS_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const AUTHORING_SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const AUTHORING_INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const AUTHORING_PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const MAIN_LIFECYCLE_TEST_PATH = "apps/desen-app/test/main-lifecycle.test.tsx";
const CATALOG_PATH = "packages/reference-catalog-web/catalog.json";
const BUNDLE_PATH = "examples/sign-in/official-derived.bundle.desen.json";
const SOURCE_PATH = "examples/sign-in/official-derived.source.desen.json";
const MAX_AUTHORITY_BYTES = 32 * 1_024 * 1_024;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);

const APP_SOURCE_PATHS = Object.freeze([
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/assets/breadcrumb-separator.svg",
  "apps/desen-app/src/assets/desen-logo.svg",
  "apps/desen-app/src/assets/plus.svg",
  "apps/desen-app/src/assets/settings.svg",
  "apps/desen-app/src/assets/theme.svg",
  "apps/desen-app/src/authoring-data.ts",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/styles.css",
]);
const CURRENT_APP_SOURCE_PATHS = Object.freeze(
  [
    ...APP_SOURCE_PATHS,
    AUTHORING_SELECTION_SOURCE_PATH,
    AUTHORING_INSPECTOR_SOURCE_PATH,
    AUTHORING_PREVIEW_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
  ].sort(),
);
const CURRENT_APP_TYPESCRIPT_SOURCE_PATHS = Object.freeze(
  CURRENT_APP_SOURCE_PATHS.filter((relativePath) => /\.(?:ts|tsx)$/u.test(relativePath)),
);
const PROOF_READER_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
  "scripts/generate-desen-app-real-adapter-canvas-proof.mjs",
  "scripts/verify-desen-app-real-adapter-canvas.mjs",
  "tests/desen-app-real-adapter-canvas.test.mjs",
]);
const TRACKED_PATHS = Object.freeze([
  APP_PACKAGE_PATH,
  "apps/desen-app/tsconfig.json",
  APP_INDEX_PATH,
  ...APP_SOURCE_PATHS,
  ADAPTER_CANVAS_TEST_PATH,
  APPLICATION_TEST_PATH,
  MAIN_LIFECYCLE_TEST_PATH,
  "apps/desen-app/test/authoring-data.test.ts",
  "apps/desen-app/test/project-navigation.test.ts",
  "pnpm-lock.yaml",
  CATALOG_PATH,
  BUNDLE_PATH,
  SOURCE_PATH,
  ...PROOF_READER_PATHS,
]);
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  APP_PACKAGE_PATH,
  ADAPTER_CANVAS_SOURCE_PATH,
  "apps/desen-app/src/application.module.css",
  APPLICATION_SOURCE_PATH,
  AUTHORING_DATA_SOURCE_PATH,
  "apps/desen-app/src/styles.css",
  ADAPTER_CANVAS_TEST_PATH,
  APPLICATION_TEST_PATH,
  "apps/desen-app/test/authoring-data.test.ts",
  "pnpm-lock.yaml",
  "scripts/lib/desen-app-real-adapter-canvas-proof.mjs",
  "tests/desen-app-real-adapter-canvas.test.mjs",
]);
const CURRENT_COMPATIBILITY_PATHS = Object.freeze([
  ...new Set([
    ...TRACKED_PATHS,
    AUTHORING_SELECTION_SOURCE_PATH,
    AUTHORING_SELECTION_TEST_PATH,
    AUTHORING_INSPECTOR_SOURCE_PATH,
    AUTHORING_PREVIEW_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
    AUTHORING_INSPECTOR_TEST_PATH,
    AUTHORING_PREVIEW_TEST_PATH,
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 73_111,
  sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
});

const EXPECTED_ADAPTER_IMPORTS = Object.freeze([
  Object.freeze({
    module: "react",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["useEffect", "useMemo", "useState"]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/reference-catalog-web/catalog.json",
    defaultImport: "referenceCatalog",
    namespaceImport: null,
    namedImports: Object.freeze([]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/reference-catalog-web/react-adapters",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT"]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/reference-catalog-web/tokens",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["REFERENCE_WEB_TOKEN_CSS_PROPERTIES"]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/runtime-core",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze([
      "createRuntimeHostPorts",
      "disposeRuntimeHeadlessSession",
      "mountRuntimeHeadlessSession",
    ]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/runtime-react",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze([
      "RuntimeReactSurfaceBoundary",
      "createRuntimeReactAdapterRegistry",
      "renderRuntimeReactSurface",
      "useRuntimeReactSurface",
    ]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "../../../examples/sign-in/official-derived.bundle.desen.json",
    defaultImport: "officialDerivedSignInBundle",
    namespaceImport: null,
    namedImports: Object.freeze([]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "./authoring-data.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["REFERENCE_AUTHORING_MODEL"]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "./authoring-selection.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["projectAuthoringSelection"]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "./application.module.css",
    defaultImport: "styles",
    namespaceImport: null,
    namedImports: Object.freeze([]),
    typeOnly: false,
  }),
  Object.freeze({
    module: "@desen/runtime-core",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["RuntimeHostPorts", "RuntimeJsonObject"]),
    typeOnly: true,
  }),
  Object.freeze({
    module: "@desen/runtime-react",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze([
      "RuntimeReactLiveSurfaceInput",
      "RuntimeReactSurfaceFailureRenderer",
    ]),
    typeOnly: true,
  }),
  Object.freeze({
    module: "./authoring-selection.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["AuthoringComponentSelection", "AuthoringSelectionProjection"]),
    typeOnly: true,
  }),
  Object.freeze({
    module: "./authoring-data.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["CatalogAuthoringModel"]),
    typeOnly: true,
  }),
]);

const EXPECTED_JSX_BY_FUNCTION = Object.freeze({
  isSupportedRoute: Object.freeze([]),
  readPreviewRevision: Object.freeze([]),
  renderManagedFailure: Object.freeze(["div"]),
  SelectionOverlay: Object.freeze(["div", "span", "span", "strong", "code", "span"]),
  ManagedAdapterSurface: Object.freeze([
    "fieldset",
    "legend",
    "div",
    "RuntimeReactSurfaceBoundary",
    "SelectionOverlay",
  ]),
  CanvasUnavailable: Object.freeze(["div"]),
  CanvasLoading: Object.freeze(["div"]),
  DesenAdapterCanvas: Object.freeze([
    "CanvasUnavailable",
    "CanvasUnavailable",
    "CanvasLoading",
    "CanvasUnavailable",
    "div",
    "p",
    "div",
    "ManagedAdapterSurface",
  ]),
});

const EXPECTED_CALL_COUNTS = Object.freeze({
  createRuntimeHostPorts: 1,
  createRuntimeReactAdapterRegistry: 1,
  disposeRuntimeHeadlessSession: 3,
  mountRuntimeHeadlessSession: 1,
  projectAuthoringSelection: 1,
  renderRuntimeReactSurface: 1,
  useEffect: 1,
  useMemo: 1,
  useRuntimeReactSurface: 1,
  useState: 1,
});

const EXPECTED_HOST_PORTS_INITIALIZER_SHA256 =
  "e847374aedc576cbd48684e45de8afee5e571b19283f0fcd6962dade856e9f08";
const EXPECTED_ROUTE_GUARD_SHA256 =
  "4e551db5e7d107ec324066e3e211ceb8907197a2460135015ce03e27c25f1e89";
const EXPECTED_APPLICATION_ADAPTER_IMPORT_SHA256 =
  "f818878a0d6a7809c6531dad12589d26e2e17b88b1c90f515cf9409519ee2617";

const EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  "renders the official-derived sign-in only through the shared real adapters",
  "fails closed for every unsupported project or surface without mounting sign-in",
  "removes a previous tree synchronously and disposes the exact route session",
  "balances StrictMode replay and final unmount with exact session disposal",
]);
const CURRENT_EXPECTED_ADAPTER_TEST_NAMES = Object.freeze([
  ...EXPECTED_ADAPTER_TEST_NAMES.slice(0, 3),
  "replaces the exact session when a current authoring draft Bundle is rerendered",
  EXPECTED_ADAPTER_TEST_NAMES[3],
  "renders Source-identity selection chrome as a sibling outside the managed subtree",
  "keeps a selected conditional Source node honest when it is not materialized",
  "rejects stale and cross-route selection identities without exposing overlay chrome",
]);
const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "renders the exact selected surface, layer hierarchy, and read-only managed adapter canvas",
  "does not substitute the sign-in Source tree or adapter canvas for another preview surface",
]);
const EXPECTED_SELECTION_TEST_NAMES = Object.freeze([
  "creates only a frozen inert route and Source identity",
  "keeps idle and pre-render states explicit without inventing a runtime target",
  "projects repeated component instances while excluding attached behavior identities",
  "reports a conditional Source component honestly when no runtime instance exists",
  "rejects cross-route, cross-surface, and stale-capability identities closed",
  "rejects a forged same-route Source identity instead of treating it as conditional",
]);

const REQUIRED_SHARED_RUNTIME_MODULES = Object.freeze([
  "packages/reference-catalog-web/dist/react-adapters/index.js",
  "packages/reference-catalog-web/dist/components/alert.js",
  "packages/reference-catalog-web/dist/components/button.js",
  "packages/reference-catalog-web/dist/components/stack.js",
  "packages/reference-catalog-web/dist/components/text.js",
  "packages/reference-catalog-web/dist/components/text-field.js",
  "packages/runtime-core/dist/index.js",
  "packages/runtime-core/dist/headless-session.js",
  "packages/runtime-react/dist/index.js",
  "packages/runtime-react/dist/adapter-error-boundary.js",
  "packages/runtime-react/dist/diagnostic-index.js",
  "packages/runtime-react/dist/interactions.js",
  "packages/runtime-react/dist/live-surface.js",
  "packages/runtime-react/dist/reconciliation.js",
  "packages/runtime-react/dist/registry.js",
  "packages/runtime-react/dist/render-plan.js",
  "packages/runtime-react/dist/root-error-policy.js",
  "packages/runtime-react/dist/session-surface.js",
  "packages/runtime-react/dist/surface-boundary.js",
]);

const REQUIRED_COMPONENT_MODULES = Object.freeze([
  "packages/reference-catalog-web/dist/components/alert.js",
  "packages/reference-catalog-web/dist/components/button.js",
  "packages/reference-catalog-web/dist/components/stack.js",
  "packages/reference-catalog-web/dist/components/text.js",
  "packages/reference-catalog-web/dist/components/text-field.js",
]);

const EXPECTED_GRAPH_DATA_MODULES = Object.freeze([
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/styles.css",
  "examples/sign-in/official-derived.bundle.desen.json",
  "examples/sign-in/official-derived.source.desen.json",
  "packages/reference-catalog-web/catalog.json",
]);

const ALLOWED_RUNTIME_PACKAGE_EDGES = Object.freeze({
  "catalog-sdk": Object.freeze(["catalog-sdk", "protocol"]),
  "editor-core": Object.freeze(["editor-core", "protocol", "validator"]),
  publisher: Object.freeze(["catalog-sdk", "protocol", "publisher", "validator"]),
  protocol: Object.freeze(["protocol"]),
  "reference-catalog-web": Object.freeze([
    "catalog-sdk",
    "protocol",
    "reference-catalog-web",
    "runtime-react",
  ]),
  "runtime-core": Object.freeze(["protocol", "runtime-core", "validator"]),
  "runtime-react": Object.freeze(["protocol", "runtime-core", "runtime-react", "validator"]),
  validator: Object.freeze(["protocol", "validator"]),
});

/** Exact immutable prerequisite receipt for M09-T01. */
export const DESEN_APP_REAL_ADAPTER_CANVAS_SHELL_PIN = Object.freeze({
  task: "M09-T01",
  proofId: "desen-app-shell-navigation",
  path: SHELL_ARTIFACT_PATH,
  bytes: 12_118,
  sha256: "c3189ff9196f0da91311156893ab569a3c9f9c1ee62631b58286647f36d23220",
  profile: "desen.app.shell-navigation-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact immutable prerequisite receipt for the M05-T09/G05 host source audit. */
export const DESEN_APP_REAL_ADAPTER_CANVAS_HOST_SOURCE_AUDIT_PIN = Object.freeze({
  task: "M05-T09",
  proofId: "reference-host-web-source-audit",
  path: HOST_SOURCE_AUDIT_ARTIFACT_PATH,
  bytes: 59_871,
  sha256: "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  profile: "desen-reference-host-web-source-audit-v1",
  result: "PASS",
  immutable: true,
});

/** Reviewed root-test names retained inside the deterministic M09-T03 artifact. */
export const DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES = Object.freeze([
  "[positive] authenticates the exact T01 and M05-T09 parents and the P-06 closure",
  "[positive] proves exact public registry-only source composition and controlled Bundle identity",
  "[positive] compares the real App Vite graph with the frozen reference-host runtime modules",
  "[positive] records disabled UI, unsupported-route, stale-removal, and StrictMode disposal receipts",
  "[negative] rejects a direct real-component import and handwritten managed tree",
  "[negative] rejects aliased registry symbols and helper-hidden managed composition",
  "[negative] rejects an alternate local registry and dynamic or private imports",
  "[negative] rejects DOM/private-tree inspection and unsupported-route substitution",
  "[negative] rejects Vite graph component, registry, runtime, and code-identity substitution",
  "[negative] rejects prerequisite, committed artifact, and visible proof-pin drift",
  "[negative] rejects non-regular authorities and unsafe artifact destinations",
]);

/** Default committed path for deterministic M09-T03 evidence. */
export const DEFAULT_DESEN_APP_REAL_ADAPTER_CANVAS_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_PATH,
);

/** Stable typed failure raised by the M09-T03 proof reader. */
export class DesenAppRealAdapterCanvasProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppRealAdapterCanvasProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppRealAdapterCanvasProofError(code, message, details);
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

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function captureBytes(value, label) {
  if (
    (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) ||
    utilTypes.isProxy(value) ||
    value.byteLength > MAX_AUTHORITY_BYTES
  ) {
    fail("OPTIONS_INVALID", `${label} must be non-Proxy bytes within the proof limit.`);
  }
  return Buffer.from(value);
}

function capturePath(value, label, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty path string.`);
  }
  return path.resolve(value);
}

function exactOwnDataOptions(value, expectedKeys, label) {
  if (value === undefined) return Object.freeze({});
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert plain object.`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))) {
    fail("OPTIONS_INVALID", `${label} contains an unsupported option.`);
  }
  const captured = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      descriptor.configurable !== true ||
      descriptor.writable !== true
    ) {
      fail("OPTIONS_INVALID", `${label}.${key} must be one ordinary data property.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

async function readRegularAuthority(absolutePath, label) {
  let entry;
  try {
    entry = await lstat(absolutePath);
  } catch (error) {
    fail("AUTHORITY_READ_FAILED", `Cannot stat ${label}.`, { cause: String(error) });
  }
  if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_AUTHORITY_BYTES) {
    fail("AUTHORITY_NOT_REGULAR", `${label} must be one bounded regular file.`);
  }
  let handle;
  try {
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      fail("AUTHORITY_RACE", `${label} changed identity while opening.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      bytes.byteLength !== opened.size ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs
    ) {
      fail("AUTHORITY_RACE", `${label} changed while it was read.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppRealAdapterCanvasProofError) throw error;
    fail("AUTHORITY_READ_FAILED", `Cannot read ${label}.`, { cause: String(error) });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function decodeUtf8(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail("AUTHORITY_ENCODING_INVALID", `${label} is not valid UTF-8.`, {
      cause: String(error),
    });
  }
  if (Buffer.byteLength(text, "utf8") !== bytes.byteLength) {
    fail("AUTHORITY_ENCODING_INVALID", `${label} is not exact canonical UTF-8 text.`);
  }
  return text;
}

function parseJson(bytes, label) {
  const text = decodeUtf8(bytes, label);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail("JSON_INVALID", `${label} is not valid JSON.`, { cause: String(error) });
  }
}

async function discoverRegularPaths(directory, workspaceRoot) {
  const discovered = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        fail("SOURCE_INVENTORY_DRIFT", "The App production source inventory contains a symlink.", {
          path: normalizeSlashes(path.relative(workspaceRoot, absolute)),
        });
      }
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        discovered.push(normalizeSlashes(path.relative(workspaceRoot, absolute)));
      } else {
        fail("SOURCE_INVENTORY_DRIFT", "The App production source inventory is not regular.", {
          path: normalizeSlashes(path.relative(workspaceRoot, absolute)),
        });
      }
    }
  }
  await walk(directory);
  return Object.freeze(discovered.sort());
}

function authenticatePinnedArtifact(bytes, pin, label, inspect) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PREREQUISITE_DRIFT", `${label} bytes differ from the exact immutable receipt.`);
  }
  const artifact = parseJson(bytes, label);
  inspect(artifact);
  return artifact;
}

function authenticateShellArtifact(bytes) {
  const pin = DESEN_APP_REAL_ADAPTER_CANVAS_SHELL_PIN;
  authenticatePinnedArtifact(bytes, pin, "M09-T01 shell artifact", (artifact) => {
    if (
      artifact?.schemaVersion !== 1 ||
      artifact?.proofId !== pin.proofId ||
      artifact?.profile !== pin.profile ||
      artifact?.task !== pin.task ||
      artifact?.result !== pin.result ||
      artifact?.claim?.taskStatus !== "DONE" ||
      artifact?.claim?.shellImplemented !== true ||
      artifact?.claim?.projectNavigationImplemented !== true ||
      artifact?.claim?.unknownRoutesFailClosed !== true
    ) {
      fail("PREREQUISITE_DRIFT", "M09-T01 shell artifact identity or retained claim drifted.");
    }
  });
  return pin;
}

function authenticateHostSourceAuditArtifact(bytes) {
  const pin = DESEN_APP_REAL_ADAPTER_CANVAS_HOST_SOURCE_AUDIT_PIN;
  const artifact = authenticatePinnedArtifact(
    bytes,
    pin,
    "M05-T09 host source-audit artifact",
    (candidate) => {
      if (
        candidate?.schemaVersion !== 1 ||
        candidate?.profile !== pin.profile ||
        candidate?.task !== pin.task ||
        candidate?.result !== pin.result ||
        candidate?.claim?.g05Closed !== true ||
        candidate?.claim?.realViteRuntimeResolutionObserved !== true ||
        candidate?.claim?.semanticTypeScriptCheckerUsed !== true ||
        candidate?.claim?.publicReferenceReactAdaptersReached !== true ||
        candidate?.claim?.publicRuntimeReactRenderPlanReached !== true ||
        candidate?.claim?.p06Status !== "PARTIAL" ||
        candidate?.claim?.p07Status !== "PARTIAL" ||
        candidate?.runtimeResolution?.tool !== "vite@8.1.5" ||
        candidate?.runtimeResolution?.observer !== "moduleParsed" ||
        candidate?.runtimeResolution?.write !== false ||
        candidate?.runtimeResolution?.dynamicEdges !== 0 ||
        !Array.isArray(candidate?.runtimeResolution?.modules)
      ) {
        fail("PREREQUISITE_DRIFT", "M05-T09 host source-audit identity or retained claim drifted.");
      }
    },
  );
  return Object.freeze({ pin, artifact });
}

function inspectControlledData(catalogBytes, bundleBytes) {
  const catalog = parseJson(catalogBytes, CATALOG_PATH);
  const bundle = parseJson(bundleBytes, BUNDLE_PATH);
  const componentIds = Object.keys(catalog?.components ?? {}).sort();
  if (
    catalog?.kind !== "desen.catalog" ||
    catalog?.desen !== "0.1.0" ||
    catalog?.id !== "run.desen.reference.sign-in" ||
    catalog?.version !== "0.1.0" ||
    catalog?.target !== "web-react" ||
    catalog?.packageDigest !==
      "sha256:acdbbfe9ad4c1fce8093b0b68036bc7f5678e8b2a603357dbe25f2413a3db6f0" ||
    !isDeepStrictEqual(componentIds, [
      "com.example.ui/Alert",
      "com.example.ui/Button",
      "com.example.ui/Stack",
      "com.example.ui/Text",
      "com.example.ui/TextField",
    ])
  ) {
    fail("CONTROLLED_DATA_DRIFT", "The exact public reference Catalog identity drifted.");
  }
  if (
    bundle?.kind !== "desen.bundle" ||
    bundle?.desen !== "0.1.0" ||
    bundle?.id !== "com.example.account-app" ||
    bundle?.revision !==
      "sha256:2dc98d276a3b4102c2891de1519bda86ea2978f5429fd8ea91831f36f8b73ffb" ||
    bundle?.entry !== "sign-in" ||
    bundle?.surfaces?.["sign-in"]?.id !== "sign-in" ||
    bundle?.requires?.catalogs?.length !== 1 ||
    bundle.requires.catalogs[0]?.digest !== catalog.packageDigest
  ) {
    fail("CONTROLLED_DATA_DRIFT", "The official-derived sign-in Bundle identity drifted.");
  }
  return deepFreeze({
    catalog: {
      path: CATALOG_PATH,
      bytes: catalogBytes.byteLength,
      sha256: sha256(catalogBytes),
      id: catalog.id,
      version: catalog.version,
      target: catalog.target,
      packageDigest: catalog.packageDigest,
      componentIds,
    },
    bundle: {
      path: BUNDLE_PATH,
      bytes: bundleBytes.byteLength,
      sha256: sha256(bundleBytes),
      id: bundle.id,
      revision: bundle.revision,
      entry: bundle.entry,
      surfaceId: bundle.surfaces["sign-in"].id,
      catalogDigest: bundle.requires.catalogs[0].digest,
    },
  });
}

function importReceipt(node) {
  const clause = node.importClause;
  const namedImports = [];
  let namespaceImport = null;
  if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const specifier of clause.namedBindings.elements) {
      const imported = specifier.propertyName?.text ?? specifier.name.text;
      if (specifier.name.text !== imported) {
        fail("SOURCE_POLICY_VIOLATION", "Aliased imports cannot redefine the canvas authority.", {
          module: node.moduleSpecifier.text,
          imported,
          local: specifier.name.text,
        });
      }
      namedImports.push(imported);
    }
  } else if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    namespaceImport = clause.namedBindings.name.text;
  }
  return deepFreeze({
    module: node.moduleSpecifier.text,
    defaultImport: clause?.name?.text ?? null,
    namespaceImport,
    namedImports: Object.freeze(namedImports.sort()),
    typeOnly: clause?.isTypeOnly === true,
  });
}

function functionName(statement) {
  if (ts.isFunctionDeclaration(statement)) return statement.name?.text;
  if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations[0];
    if (
      statement.declarationList.declarations.length === 1 &&
      declaration !== undefined &&
      ts.isIdentifier(declaration.name) &&
      declaration.initializer !== undefined &&
      (ts.isArrowFunction(declaration.initializer) ||
        ts.isFunctionExpression(declaration.initializer))
    ) {
      return declaration.name.text;
    }
  }
  return undefined;
}

function functionBody(statement) {
  if (ts.isFunctionDeclaration(statement)) return statement.body;
  if (ts.isVariableStatement(statement)) {
    const initializer = statement.declarationList.declarations[0]?.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return initializer.body;
    }
  }
  return undefined;
}

function jsxTagText(tagName, sourceFile) {
  return ts.isIdentifier(tagName) ? tagName.text : tagName.getText(sourceFile);
}

function collectDescendants(node, predicate) {
  const values = [];
  function visit(current) {
    if (predicate(current)) values.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return values;
}

function normalizedNodeText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/gu, " ").trim();
}

function exactFunctionStatement(sourceFile, name) {
  const candidates = sourceFile.statements.filter((statement) => functionName(statement) === name);
  if (candidates.length !== 1) {
    fail("SOURCE_POLICY_VIOLATION", `Expected exactly one ${name} function.`);
  }
  return candidates[0];
}

function inspectAuthoringSelectionSource(rawSource) {
  if (typeof rawSource !== "string" || rawSource.includes("\0")) {
    fail("SOURCE_POLICY_VIOLATION", "The authoring-selection policy requires exact source text.");
  }
  const sourceFile = ts.createSourceFile(
    AUTHORING_SELECTION_SOURCE_PATH,
    rawSource,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "The authoring-selection source has parse diagnostics.");
  }
  const imports = sourceFile.statements.filter(ts.isImportDeclaration).map((node) => {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      fail("SOURCE_POLICY_VIOLATION", "The selection source contains a non-literal import.");
    }
    return importReceipt(node);
  });
  const expectedImports = [
    {
      module: "@desen/runtime-react",
      defaultImport: null,
      namespaceImport: null,
      namedImports: ["RuntimeReactDiagnosticIndex"],
      typeOnly: true,
    },
    {
      module: "./authoring-data.js",
      defaultImport: null,
      namespaceImport: null,
      namedImports: ["AuthoringLayerNode", "CatalogAuthoringModel"],
      typeOnly: true,
    },
  ];
  if (!isDeepStrictEqual(imports, expectedImports)) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Selection may depend only on the public diagnostic-index type and inert authoring types.",
      { actual: imports },
    );
  }
  const forbiddenIdentifiers = new Set([
    "Element",
    "HTMLElement",
    "MutationObserver",
    "Node",
    "React",
    "ResizeObserver",
    "document",
    "window",
  ]);
  const forbiddenMembers = new Set([
    "Children",
    "cloneElement",
    "closest",
    "createElement",
    "getBoundingClientRect",
    "innerHTML",
    "outerHTML",
    "props",
    "querySelector",
    "querySelectorAll",
  ]);
  const forbiddenIdentifierNodes = collectDescendants(sourceFile, ts.isIdentifier).filter(
    ({ text }) => forbiddenIdentifiers.has(text) || /^_+react/iu.test(text),
  );
  const forbiddenMemberNodes = collectDescendants(sourceFile, ts.isPropertyAccessExpression).filter(
    ({ name }) => forbiddenMembers.has(name.text) || /^_+react/iu.test(name.text),
  );
  const dynamicImports = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) => call.expression.kind === ts.SyntaxKind.ImportKeyword,
  );
  const mutationCalls = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) &&
      /^(?:activate|commit|createDesenEditor|delete|insert|move|publish|save|update)/u.test(
        call.expression.text,
      ),
  );
  if (
    forbiddenIdentifierNodes.length !== 0 ||
    forbiddenMemberNodes.length !== 0 ||
    dynamicImports.length !== 0 ||
    mutationCalls.length !== 0
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Selection must remain callback-free public identity projection without DOM, React-tree, or mutation authority.",
    );
  }
  for (const name of [
    "createAuthoringComponentSelection",
    "isSameAuthoringComponentSelection",
    "projectAuthoringSelection",
  ]) {
    exactFunctionStatement(sourceFile, name);
  }
  const projector = exactFunctionStatement(sourceFile, "projectAuthoringSelection");
  const projectorText = normalizedNodeText(projector, sourceFile);
  for (const required of [
    "rendered.diagnosticIndex.runtimeNodeIdsBySourceNodeId[selection.sourceNodeId]",
    "rendered.diagnosticIndex.byRuntimeNodeId[runtimeNodeId]",
    'entry?.kind !== "component"',
    'status: "not-materialized"',
    'status: "materialized"',
  ]) {
    if (!projectorText.includes(required)) {
      fail("SOURCE_POLICY_VIOLATION", "The public diagnostic-index selection projection drifted.", {
        required,
      });
    }
  }
  return deepFreeze({
    imports,
    publicDiagnosticIndexTypeOnly: true,
    stableSourceIdentityOnly: true,
    privateDomOrReactInspection: 0,
    mutationCalls: 0,
  });
}

/**
 * Applies the source-only registry-composition policy used by positive and hostile mutation tests.
 */
export function verifyDesenAppRealAdapterCanvasSourcePolicy(
  rawSource,
  rawApplication = undefined,
  rawAuthoringSelection = undefined,
) {
  if (typeof rawSource !== "string" || rawSource.includes("\0")) {
    fail("SOURCE_POLICY_VIOLATION", "The adapter-canvas policy requires exact source text.");
  }
  if (rawApplication !== undefined && typeof rawApplication !== "string") {
    fail("SOURCE_POLICY_VIOLATION", "The application policy requires exact source text.");
  }
  const sourceFile = ts.createSourceFile(
    ADAPTER_CANVAS_SOURCE_PATH,
    rawSource,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );
  if (sourceFile.parseDiagnostics.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "The adapter-canvas source has parse diagnostics.");
  }
  const bareReturns = collectDescendants(sourceFile, ts.isReturnStatement).filter(
    (statement) => statement.expression === undefined,
  );
  if (bareReturns.length !== 5) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The reviewed fail-closed control flow gained an automatic-semicolon return split.",
    );
  }
  const imports = sourceFile.statements.filter(ts.isImportDeclaration).map((node) => {
    if (!ts.isStringLiteral(node.moduleSpecifier)) {
      fail("SOURCE_POLICY_VIOLATION", "The canvas contains a non-literal import.");
    }
    return importReceipt(node);
  });
  if (!isDeepStrictEqual(imports, EXPECTED_ADAPTER_IMPORTS)) {
    fail("SOURCE_POLICY_VIOLATION", "The exact public canvas import surface drifted.", {
      actual: imports,
    });
  }

  const expectedStringConstants = new Map([
    ["SUPPORTED_PROJECT_ID", "account-app"],
    ["SUPPORTED_SURFACE_ID", "sign-in"],
    ["EXPECTED_DOCUMENT_ID", "com.example.account-app"],
  ]);
  const observedStringConstants = new Map();
  const stringConstantDeclarationCounts = new Map(
    [...expectedStringConstants.keys()].map((name) => [name, 0]),
  );
  for (const statement of sourceFile.statements.filter(ts.isVariableStatement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && expectedStringConstants.has(declaration.name.text)) {
        stringConstantDeclarationCounts.set(
          declaration.name.text,
          (stringConstantDeclarationCounts.get(declaration.name.text) ?? 0) + 1,
        );
        if (
          (statement.declarationList.flags & ts.NodeFlags.Const) !== 0 &&
          declaration.initializer !== undefined &&
          ts.isStringLiteral(declaration.initializer)
        ) {
          observedStringConstants.set(declaration.name.text, declaration.initializer.text);
        }
      }
    }
  }
  if (
    !isDeepStrictEqual(observedStringConstants, expectedStringConstants) ||
    [...stringConstantDeclarationCounts.values()].some((count) => count !== 1)
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The exact supported route, document, or Bundle revision identity drifted.",
      { actual: Object.fromEntries(observedStringConstants) },
    );
  }

  const forbiddenReferenceImports = imports.filter(
    ({ module }) =>
      module.startsWith("@desen/reference-catalog-web/") &&
      ![
        "@desen/reference-catalog-web/catalog.json",
        "@desen/reference-catalog-web/react-adapters",
        "@desen/reference-catalog-web/tokens",
      ].includes(module),
  );
  if (forbiddenReferenceImports.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "A private or alternate reference-catalog import was found.");
  }

  const dynamicImports = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) => call.expression.kind === ts.SyntaxKind.ImportKeyword,
  );
  const forbiddenIdentifiers = collectDescendants(sourceFile, ts.isIdentifier)
    .map(({ text }) => text)
    .filter((text) =>
      ["require", "eval", "Function", "createElement", "jsx", "jsxs"].includes(text),
    );
  if (dynamicImports.length !== 0 || forbiddenIdentifiers.length !== 0) {
    fail("SOURCE_POLICY_VIOLATION", "Dynamic or factory-created managed composition is forbidden.");
  }

  const privateDomAccess = collectDescendants(sourceFile, ts.isPropertyAccessExpression).filter(
    (access) =>
      [
        "querySelector",
        "querySelectorAll",
        "getElementById",
        "getElementsByClassName",
        "getElementsByTagName",
        "closest",
        "innerHTML",
        "outerHTML",
      ].includes(access.name.text) ||
      /^_+react(?:RootContainer|Fiber|Props|Container)/u.test(access.name.text),
  );
  const privateTreeElementAccess = collectDescendants(sourceFile, ts.isElementAccessExpression)
    .map((access) => access.argumentExpression)
    .filter(
      (argument) =>
        argument !== undefined &&
        (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) &&
        /^_+react(?:RootContainer|Fiber|Props|Container)/u.test(argument.text),
    );
  const domGlobals = collectDescendants(sourceFile, ts.isIdentifier).filter(({ text }) =>
    ["document", "window", "HTMLElement", "Element", "Node", "MutationObserver"].includes(text),
  );
  if (
    privateDomAccess.length !== 0 ||
    privateTreeElementAccess.length !== 0 ||
    domGlobals.length !== 0
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The managed canvas cannot inspect or author through private DOM.",
    );
  }

  const jsxByFunction = {};
  for (const statement of sourceFile.statements) {
    const name = functionName(statement);
    const body = functionBody(statement);
    if (name === undefined || body === undefined) continue;
    jsxByFunction[name] = collectDescendants(
      body,
      (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node),
    ).map((node) => jsxTagText(node.tagName, sourceFile));
  }
  if (!isDeepStrictEqual(jsxByFunction, EXPECTED_JSX_BY_FUNCTION)) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The exact JSX ownership profile admits no direct or helper-hidden managed tree.",
      { actual: jsxByFunction },
    );
  }

  const callCounts = {};
  for (const name of Object.keys(EXPECTED_CALL_COUNTS)) callCounts[name] = 0;
  for (const call of collectDescendants(sourceFile, ts.isCallExpression)) {
    if (ts.isIdentifier(call.expression) && Object.hasOwn(callCounts, call.expression.text)) {
      callCounts[call.expression.text] += 1;
    }
  }
  if (!isDeepStrictEqual(callCounts, EXPECTED_CALL_COUNTS)) {
    fail("SOURCE_POLICY_VIOLATION", "The exact runtime/registry call profile drifted.", {
      actual: callCounts,
    });
  }

  const hostPortDeclarations = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) =>
      statement.declarationList.declarations.flatMap((declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === "ADAPTER_CANVAS_HOST_PORTS"
          ? [{ declaration, statement }]
          : [],
      ),
    );
  if (
    hostPortDeclarations.length !== 1 ||
    (hostPortDeclarations[0].statement.declarationList.flags & ts.NodeFlags.Const) === 0 ||
    hostPortDeclarations[0].declaration.initializer === undefined ||
    sha256(
      Buffer.from(
        normalizedNodeText(hostPortDeclarations[0].declaration.initializer, sourceFile),
        "utf8",
      ),
    ) !== EXPECTED_HOST_PORTS_INITIALIZER_SHA256
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The canvas host ports must retain the exact inert all-deny implementation.",
    );
  }

  const registryCalls = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) &&
      call.expression.text === "createRuntimeReactAdapterRegistry",
  );
  const registryDeclarations = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .filter(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === "ADAPTER_CANVAS_REGISTRY",
    );
  if (
    registryCalls.length !== 1 ||
    registryDeclarations.length !== 1 ||
    registryDeclarations[0].initializer !== registryCalls[0] ||
    registryCalls[0].arguments.length !== 1 ||
    !ts.isIdentifier(registryCalls[0].arguments[0]) ||
    registryCalls[0].arguments[0].text !== "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT"
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The canvas registry must derive only from the exact public input.",
    );
  }

  const mountCalls = collectDescendants(sourceFile, ts.isCallExpression).filter(
    (call) =>
      ts.isIdentifier(call.expression) && call.expression.text === "mountRuntimeHeadlessSession",
  );
  if (mountCalls.length !== 1) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The canvas must contain exactly one public headless-session mount.",
    );
  }
  const mountText = normalizedNodeText(mountCalls[0], sourceFile);
  const mountArgument = mountCalls[0].arguments[0];
  const mountProperties =
    mountArgument !== undefined && ts.isObjectLiteralExpression(mountArgument)
      ? mountArgument.properties
      : [];
  const mountPropertyNames = mountProperties.map((property) =>
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
    ts.isIdentifier(property.name)
      ? property.name.text
      : null,
  );
  if (
    mountCalls[0].arguments.length !== 1 ||
    !isDeepStrictEqual(mountPropertyNames, ["bundle", "catalogs", "hostPorts"]) ||
    !ts.isShorthandPropertyAssignment(mountProperties[0]) ||
    !mountText.includes("bundle") ||
    !mountText.includes("catalogs: [referenceCatalog]") ||
    !mountText.includes("hostPorts: ADAPTER_CANVAS_HOST_PORTS")
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The session mount lost its exact Bundle/Catalog/host-port tuple.",
    );
  }

  const routeGuard = exactFunctionStatement(sourceFile, "isSupportedRoute");
  const routeGuardText = normalizedNodeText(routeGuard, sourceFile);
  if (sha256(Buffer.from(routeGuardText, "utf8")) !== EXPECTED_ROUTE_GUARD_SHA256) {
    fail("SOURCE_POLICY_VIOLATION", "Unsupported project/surface tuples must fail closed exactly.");
  }

  const managedAdapterSurface = exactFunctionStatement(sourceFile, "ManagedAdapterSurface");
  const managedBody = functionBody(managedAdapterSurface);
  const managedFieldsets = collectDescendants(
    managedBody,
    (node) => ts.isJsxOpeningElement(node) && jsxTagText(node.tagName, sourceFile) === "fieldset",
  );
  const managedBoundaries = collectDescendants(
    managedBody,
    (node) =>
      ts.isJsxSelfClosingElement(node) &&
      jsxTagText(node.tagName, sourceFile) === "RuntimeReactSurfaceBoundary",
  );
  const selectionOverlays = collectDescendants(
    managedBody,
    (node) =>
      ts.isJsxSelfClosingElement(node) &&
      jsxTagText(node.tagName, sourceFile) === "SelectionOverlay",
  );
  const fieldsetElement = managedFieldsets[0]?.parent;
  function isWithin(candidate, ancestor) {
    let current = candidate;
    while (current !== undefined) {
      if (current === ancestor) return true;
      current = current.parent;
    }
    return false;
  }
  const managedText = normalizedNodeText(managedAdapterSurface, sourceFile);
  const fieldsetAttributes = managedFieldsets[0]?.attributes.properties ?? [];
  const fieldsetAttributeNames = fieldsetAttributes.map((property) =>
    ts.isJsxAttribute(property) ? property.name.getText(sourceFile) : null,
  );
  const boundaryAttributeNames = (managedBoundaries[0]?.attributes.properties ?? []).map(
    (property) => (ts.isJsxAttribute(property) ? property.name.getText(sourceFile) : null),
  );
  const overlayAttributeNames = (selectionOverlays[0]?.attributes.properties ?? []).map(
    (property) => (ts.isJsxAttribute(property) ? property.name.getText(sourceFile) : null),
  );
  if (
    managedFieldsets.length !== 1 ||
    managedBoundaries.length !== 1 ||
    selectionOverlays.length !== 1 ||
    !ts.isJsxElement(fieldsetElement) ||
    !isWithin(managedBoundaries[0], fieldsetElement) ||
    isWithin(selectionOverlays[0], fieldsetElement) ||
    !isDeepStrictEqual(fieldsetAttributeNames, [
      "className",
      "data-managed-capability-frame",
      "disabled",
      "style",
    ]) ||
    !isDeepStrictEqual(boundaryAttributeNames, ["renderFailure", "result"]) ||
    !isDeepStrictEqual(overlayAttributeNames, ["projection"]) ||
    !managedText.includes('data-managed-capability-frame="true"') ||
    !managedText.includes('data-managed-capability-subtree="true"') ||
    !managedText.includes("disabled") ||
    !managedText.includes("style={REFERENCE_WEB_TOKEN_CSS_PROPERTIES}") ||
    !managedText.includes("diagnosticIndex: result.surface.diagnosticIndex") ||
    !managedText.includes(
      "<RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />",
    ) ||
    !managedText.includes("<SelectionOverlay projection={projection} />")
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Selection chrome must remain a diagnostic-index projection sibling outside the disabled managed subtree.",
    );
  }

  const canvasFunction = exactFunctionStatement(sourceFile, "DesenAdapterCanvas");
  const canvasText = normalizedNodeText(canvasFunction, sourceFile);
  const supportedDeclarations = collectDescendants(canvasFunction, ts.isVariableDeclaration).filter(
    (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "supported",
  );
  const supportedAssignments = collectDescendants(canvasFunction, ts.isBinaryExpression).filter(
    (expression) =>
      expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(expression.left) &&
      expression.left.text === "supported",
  );
  if (
    supportedDeclarations.length !== 1 ||
    supportedDeclarations[0].parent === undefined ||
    !ts.isVariableDeclarationList(supportedDeclarations[0].parent) ||
    (supportedDeclarations[0].parent.flags & ts.NodeFlags.Const) === 0 ||
    supportedDeclarations[0].initializer === undefined ||
    normalizedNodeText(supportedDeclarations[0].initializer, sourceFile) !==
      "isSupportedRoute(routeIdentity)" ||
    supportedAssignments.length !== 0
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The exact fail-closed route decision was widened.");
  }
  for (const requiredText of [
    "if (!supported) return <CanvasUnavailable />",
    "state.routeIdentity !== routeIdentity",
    "selection = null",
    "<ManagedAdapterSurface authoringModel={authoringModel} input={state.input} projectId={projectId} selection={selection} surfaceId={surfaceId} />",
    "disposeRuntimeHeadlessSession(session)",
  ]) {
    if (!canvasText.includes(requiredText)) {
      fail("SOURCE_POLICY_VIOLATION", "A fail-closed, read-only, or disposal invariant drifted.", {
        requiredText,
      });
    }
  }

  let applicationReceipt = null;
  if (rawApplication !== undefined) {
    const applicationFile = ts.createSourceFile(
      APPLICATION_SOURCE_PATH,
      rawApplication,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TSX,
    );
    if (applicationFile.parseDiagnostics.length !== 0) {
      fail("SOURCE_POLICY_VIOLATION", "The Desen App application source has parse diagnostics.");
    }
    const adapterImports = applicationFile.statements
      .filter(ts.isImportDeclaration)
      .filter(
        (node) =>
          ts.isStringLiteral(node.moduleSpecifier) &&
          node.moduleSpecifier.text === "./adapter-canvas.js",
      );
    const canvasElements = collectDescendants(
      applicationFile,
      (node) =>
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        jsxTagText(node.tagName, applicationFile) === "DesenAdapterCanvas",
    );
    if (adapterImports.length !== 1 || canvasElements.length !== 1) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "The App must compose exactly one DesenAdapterCanvas boundary.",
      );
    }
    if (
      sha256(Buffer.from(normalizedNodeText(adapterImports[0], applicationFile), "utf8")) !==
      EXPECTED_APPLICATION_ADAPTER_IMPORT_SHA256
    ) {
      fail("SOURCE_POLICY_VIOLATION", "The App must retain the exact adapter import binding.");
    }
    const canvasElementText = normalizedNodeText(canvasElements[0], applicationFile);
    const canvasAttributeNames = canvasElements[0].attributes.properties.map((property) =>
      ts.isJsxAttribute(property) ? property.name.getText(applicationFile) : null,
    );
    if (
      !isDeepStrictEqual(canvasAttributeNames, [
        "authoringModel",
        "bundle",
        "projectId",
        "selection",
        "surfaceId",
      ]) ||
      !canvasElementText.includes("authoringModel={model}") ||
      !canvasElementText.includes("bundle={preview.ok ? preview.bundle : null}") ||
      !canvasElementText.includes("projectId={project.id}") ||
      !canvasElementText.includes("selection={selection}") ||
      !canvasElementText.includes("surfaceId={selectedSurface.id}")
    ) {
      fail("SOURCE_POLICY_VIOLATION", "The App canvas lost its exact selected route tuple.");
    }
    const appImports = applicationFile.statements
      .filter(ts.isImportDeclaration)
      .map((node) => (ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : ""));
    if (
      appImports.some(
        (specifier) =>
          specifier.startsWith("@desen/runtime-") ||
          (specifier.startsWith("@desen/reference-catalog-web") &&
            specifier !== "@desen/reference-catalog-web/catalog.json"),
      )
    ) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "Registry/runtime authority must remain isolated behind adapter-canvas.tsx.",
      );
    }
    const shadowCanvasDeclarations = collectDescendants(
      applicationFile,
      (node) => ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node),
    ).filter((node) => ts.isIdentifier(node.name) && node.name.text === "DesenAdapterCanvas");
    const selectedRouteMutations = collectDescendants(
      applicationFile,
      ts.isBinaryExpression,
    ).filter((expression) => {
      if (expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
      const leftText = normalizedNodeText(expression.left, applicationFile);
      return /^(?:\(?selectedSurface\b|\(?project\b)/u.test(leftText);
    });
    if (shadowCanvasDeclarations.length !== 0 || selectedRouteMutations.length !== 0) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "The selected route and imported canvas binding must not be substituted or mutated.",
      );
    }
    applicationReceipt = deepFreeze({
      adapterImports: adapterImports.length,
      canvasBoundaries: canvasElements.length,
      selectedRouteTuple: true,
      sourceIdentitySelectionProp: true,
      directRuntimeImports: 0,
      inertCatalogImports: 1,
    });
  }

  const selectionReceipt =
    rawAuthoringSelection === undefined
      ? null
      : inspectAuthoringSelectionSource(rawAuthoringSelection);

  const functionFingerprints = Object.fromEntries(
    Object.keys(EXPECTED_JSX_BY_FUNCTION).map((name) => {
      const statement = exactFunctionStatement(sourceFile, name);
      return [name, sha256(Buffer.from(normalizedNodeText(statement, sourceFile), "utf8"))];
    }),
  );
  return deepFreeze({
    compiler: `typescript@${ts.version}`,
    parser: "TypeScript TSX AST",
    imports,
    callCounts,
    jsxByFunction,
    functionFingerprints,
    controlledIdentity: Object.fromEntries(observedStringConstants),
    hostPortsPolicy: "EXACT_INERT_ALL_DENY",
    exactPublicRegistryInput: true,
    exactPublisherOrOfficialFallbackBundleMount: true,
    manualManagedTreeElements: 0,
    dynamicExecutableImports: 0,
    privateDomInspectionCalls: 0,
    unsupportedTuplePolicy: "EXACT_ACCOUNT_APP_SIGN_IN_ONLY_NO_SUBSTITUTION",
    readOnlyBoundary: "DISABLED_FIELDSET_OUTSIDE_MANAGED_COMPONENT_SUBTREE",
    application: applicationReceipt,
    selection: selectionReceipt,
  });
}

async function inspectSemanticSymbols(workspaceRoot) {
  const configPath = path.join(workspaceRoot, "apps/desen-app/tsconfig.json");
  const configRead = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configRead.error !== undefined) {
    fail("TYPESCRIPT_AUDIT_FAILED", "Cannot read the Desen App TypeScript configuration.");
  }
  const parsed = ts.parseJsonConfigFileContent(
    configRead.config,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  const rootNames = CURRENT_APP_TYPESCRIPT_SOURCE_PATHS.map((relativePath) =>
    path.join(workspaceRoot, relativePath),
  );
  const program = ts.createProgram({ rootNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length !== 0) {
    fail("TYPESCRIPT_AUDIT_FAILED", "The semantic TypeScript program contains diagnostics.", {
      diagnostics: diagnostics
        .slice(0, 8)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")),
    });
  }
  const sourceFile = program.getSourceFile(path.join(workspaceRoot, ADAPTER_CANVAS_SOURCE_PATH));
  if (sourceFile === undefined) {
    fail("TYPESCRIPT_AUDIT_FAILED", "The semantic program lost adapter-canvas.tsx.");
  }
  const checker = program.getTypeChecker();
  const expectedSymbols = new Map([
    [
      "REFERENCE_WEB_REACT_ADAPTER_REGISTRY_INPUT",
      "packages/reference-catalog-web/dist/react-adapters/index.d.ts",
    ],
    ["createRuntimeReactAdapterRegistry", "packages/runtime-react/dist/registry.d.ts"],
    ["renderRuntimeReactSurface", "packages/runtime-react/dist/render-plan.d.ts"],
    ["useRuntimeReactSurface", "packages/runtime-react/dist/live-surface.d.ts"],
    ["RuntimeReactSurfaceBoundary", "packages/runtime-react/dist/surface-boundary.d.ts"],
    ["mountRuntimeHeadlessSession", "packages/runtime-core/dist/headless-session.d.ts"],
    ["disposeRuntimeHeadlessSession", "packages/runtime-core/dist/headless-session.d.ts"],
  ]);
  const receipts = [];
  for (const statement of sourceFile.statements.filter(ts.isImportDeclaration)) {
    if (
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const specifier of statement.importClause.namedBindings.elements) {
      const expectedPath = expectedSymbols.get(specifier.name.text);
      if (expectedPath === undefined) continue;
      const localSymbol = checker.getSymbolAtLocation(specifier.name);
      const target =
        localSymbol && (localSymbol.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(localSymbol)
          : localSymbol;
      const declarations = (target?.declarations ?? []).map((declaration) =>
        normalizeSlashes(path.relative(workspaceRoot, declaration.getSourceFile().fileName)),
      );
      if (!declarations.includes(expectedPath)) {
        fail(
          "TYPESCRIPT_AUDIT_FAILED",
          "A runtime symbol resolves outside its public declaration.",
          {
            symbol: specifier.name.text,
            expectedPath,
            declarations,
          },
        );
      }
      receipts.push(
        deepFreeze({
          symbol: specifier.name.text,
          module: statement.moduleSpecifier.text,
          declaration: expectedPath,
        }),
      );
    }
  }
  receipts.sort((left, right) => left.symbol.localeCompare(right.symbol));
  if (receipts.length !== expectedSymbols.size) {
    fail("TYPESCRIPT_AUDIT_FAILED", "The semantic public-symbol receipt set is incomplete.");
  }
  return deepFreeze({
    compiler: `typescript@${ts.version}`,
    authority: "TypeScript parser, Program, TypeChecker, and aliased-symbol declarations",
    rootFiles: rootNames.length,
    diagnostics: 0,
    symbols: receipts,
  });
}

function normalizeGraphId(workspaceRoot, rawId) {
  let id = rawId;
  let prefix = "";
  if (id.startsWith("\0")) {
    prefix = "virtual:";
    id = id.slice(1);
  }
  const queryIndex = id.indexOf("?");
  const query = queryIndex === -1 ? "" : id.slice(queryIndex);
  const base = queryIndex === -1 ? id : id.slice(0, queryIndex);
  if (path.isAbsolute(base)) {
    const relative = normalizeSlashes(path.relative(workspaceRoot, base));
    if (!relative.startsWith("../") && relative !== "..") {
      const nested = relative.lastIndexOf("/node_modules/");
      const normalized =
        relative.startsWith("node_modules/.pnpm/") && nested !== -1
          ? `node_modules/${relative.slice(nested + 14)}`
          : relative;
      return `${prefix}${normalized}${query}`;
    }
  }
  return `${prefix}${normalizeSlashes(base)}${query}`;
}

async function runObservedViteBuild(workspaceRoot) {
  const viteModulePath = path.join(
    workspaceRoot,
    "apps/desen-app/node_modules/vite/dist/node/index.js",
  );
  const vite = await import(pathToFileURL(viteModulePath).href);
  if (vite.version !== "8.1.5" || typeof vite.build !== "function") {
    fail("VITE_BUILD_FAILED", "M09-T03 requires the pinned Vite 8.1.5 programmatic API.");
  }
  const observed = [];
  try {
    await vite.build({
      root: path.join(workspaceRoot, "apps/desen-app"),
      configFile: false,
      logLevel: "silent",
      build: { write: false },
      plugins: [
        {
          name: "desen-app-real-adapter-canvas-observer",
          enforce: "post",
          moduleParsed(moduleInfo) {
            if (
              typeof moduleInfo.code !== "string" ||
              Buffer.byteLength(moduleInfo.code, "utf8") > MAX_AUTHORITY_BYTES
            ) {
              fail("VITE_GRAPH_DRIFT", "Vite exposed missing or oversized transformed code.");
            }
            observed.push(
              Object.freeze({
                id: moduleInfo.id,
                imports: Object.freeze([...moduleInfo.importedIds]),
                dynamicImports: Object.freeze([...moduleInfo.dynamicallyImportedIds]),
                codeBytes: Buffer.byteLength(moduleInfo.code, "utf8"),
                codeSha256: `sha256:${sha256(Buffer.from(moduleInfo.code, "utf8"))}`,
              }),
            );
          },
        },
      ],
    });
  } catch (error) {
    if (error instanceof DesenAppRealAdapterCanvasProofError) throw error;
    fail("VITE_BUILD_FAILED", "The real Vite observer build failed.", { cause: String(error) });
  }
  const normalized = observed.map((entry) => {
    const queryIndex = entry.id.indexOf("?");
    const rawBase = queryIndex === -1 ? entry.id : entry.id.slice(0, queryIndex);
    return Object.freeze({
      module: deepFreeze({
        id: normalizeGraphId(workspaceRoot, entry.id),
        imports: entry.imports.map((id) => normalizeGraphId(workspaceRoot, id)).sort(),
        dynamicImports: entry.dynamicImports
          .map((id) => normalizeGraphId(workspaceRoot, id))
          .sort(),
        codeBytes: entry.codeBytes,
        codeSha256: entry.codeSha256,
      }),
      rawBase,
    });
  });
  const modules = normalized
    .map(({ module }) => module)
    .sort((left, right) => left.id.localeCompare(right.id));
  const backingModules = [];
  for (const { module, rawBase } of normalized) {
    if (module.id.startsWith("virtual:")) continue;
    if (!path.isAbsolute(rawBase)) {
      fail("VITE_GRAPH_DRIFT", "A non-virtual module has no local absolute backing path.", {
        module: module.id,
      });
    }
    const canonical = await realpath(rawBase).catch(() => undefined);
    if (canonical === undefined || !canonical.startsWith(`${workspaceRoot}${path.sep}`)) {
      fail("VITE_GRAPH_DRIFT", "A Vite graph backing file escapes the workspace.", {
        module: module.id,
      });
    }
    backingModules.push(
      deepFreeze({
        id: module.id,
        path: normalizeSlashes(path.relative(workspaceRoot, canonical)),
      }),
    );
  }
  backingModules.sort((left, right) => left.id.localeCompare(right.id));
  return deepFreeze({ modules, backingModules });
}

async function snapshotBackingFiles(workspaceRoot, backingModules) {
  const paths = [...new Set(backingModules.map((entry) => entry.path))].sort();
  const receipts = [];
  for (const relativePath of paths) {
    const bytes = await readRegularAuthority(
      path.join(workspaceRoot, relativePath),
      `Vite backing file ${relativePath}`,
    );
    receipts.push(
      deepFreeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }),
    );
  }
  return deepFreeze(receipts);
}

function runtimePackageName(moduleId) {
  return /^packages\/([^/]+)\//u.exec(moduleId)?.[1];
}

function captureGraph(rawGraph) {
  if (
    !Array.isArray(rawGraph) ||
    utilTypes.isProxy(rawGraph) ||
    Object.getPrototypeOf(rawGraph) !== Array.prototype ||
    rawGraph.length > 1_000
  ) {
    fail("VITE_GRAPH_DRIFT", "The Vite graph must be one bounded intrinsic Array.");
  }
  return rawGraph.map((entry, index) => {
    if (
      entry === null ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      utilTypes.isProxy(entry) ||
      Object.getPrototypeOf(entry) !== Object.prototype
    ) {
      fail("VITE_GRAPH_DRIFT", `Vite graph entry ${index} is not an inert object.`);
    }
    const keys = Reflect.ownKeys(entry);
    if (
      !isDeepStrictEqual(keys, ["id", "imports", "dynamicImports", "codeBytes", "codeSha256"]) ||
      typeof entry.id !== "string" ||
      !Array.isArray(entry.imports) ||
      !Array.isArray(entry.dynamicImports) ||
      entry.imports.some((value) => typeof value !== "string") ||
      entry.dynamicImports.some((value) => typeof value !== "string") ||
      !Number.isSafeInteger(entry.codeBytes) ||
      entry.codeBytes < 0 ||
      typeof entry.codeSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(entry.codeSha256)
    ) {
      fail("VITE_GRAPH_DRIFT", `Vite graph entry ${index} fields are malformed.`);
    }
    return deepFreeze({
      id: entry.id,
      imports: [...entry.imports],
      dynamicImports: [...entry.dynamicImports],
      codeBytes: entry.codeBytes,
      codeSha256: entry.codeSha256,
    });
  });
}

function findGraphModule(graph, id) {
  return graph.find((entry) => entry.id === id);
}

/**
 * Validates the closed App graph and compares shared transformed modules with frozen M05-T09.
 */
export function verifyDesenAppRealAdapterCanvasGraphPolicy(rawGraph, rawHostArtifact) {
  const graph = captureGraph(rawGraph);
  if (rawHostArtifact === null || typeof rawHostArtifact !== "object") {
    fail("HOST_GRAPH_IDENTITY_DRIFT", "The host comparison requires its frozen artifact object.");
  }
  const graphIds = graph.map(({ id }) => id);
  const graphIdSet = new Set(graphIds);
  if (graph.length !== 127 || graphIdSet.size !== graph.length) {
    fail("VITE_GRAPH_DRIFT", "The exact normalized App graph module inventory drifted.", {
      modules: graph.length,
    });
  }
  const staticEdges = graph.reduce((total, module) => total + module.imports.length, 0);
  const dynamicEdges = graph.reduce((total, module) => total + module.dynamicImports.length, 0);
  if (staticEdges !== 372 || dynamicEdges !== 0) {
    fail("VITE_GRAPH_DRIFT", "The exact static/dynamic Vite edge profile drifted.", {
      staticEdges,
      dynamicEdges,
    });
  }
  const unresolvedEdges = graph.flatMap((module) =>
    [...module.imports, ...module.dynamicImports]
      .filter((imported) => !graphIdSet.has(imported))
      .map((imported) => `${module.id} -> ${imported}`),
  );
  if (unresolvedEdges.length !== 0) {
    fail("VITE_GRAPH_DRIFT", "The Vite graph contains unresolved or externalized edges.", {
      unresolvedEdges,
    });
  }
  for (const module of graph) {
    const packageName = runtimePackageName(module.id);
    const allowed =
      module.id === APP_INDEX_PATH ||
      module.id.startsWith("apps/desen-app/src/") ||
      module.id === BUNDLE_PATH ||
      module.id === SOURCE_PATH ||
      module.id === CATALOG_PATH ||
      module.id === "virtual:vite/modulepreload-polyfill.js" ||
      /^node_modules\/(?:react|react-dom|scheduler)\//u.test(module.id) ||
      Object.hasOwn(ALLOWED_RUNTIME_PACKAGE_EDGES, packageName);
    if (!allowed) {
      fail("VITE_GRAPH_DRIFT", "The App graph contains a module outside the closed envelope.", {
        module: module.id,
      });
    }
    if (packageName !== undefined) {
      for (const imported of module.imports) {
        const target = runtimePackageName(imported);
        if (
          target !== undefined &&
          ALLOWED_RUNTIME_PACKAGE_EDGES[packageName]?.includes(target) !== true
        ) {
          fail("VITE_GRAPH_DRIFT", "A workspace package edge violates the closed runtime policy.", {
            importer: module.id,
            imported,
          });
        }
      }
    }
  }
  const sourceIds = graphIds.filter((id) => id.startsWith("apps/desen-app/src/")).sort();
  if (!isDeepStrictEqual(sourceIds, CURRENT_APP_SOURCE_PATHS)) {
    fail("VITE_GRAPH_DRIFT", "The App graph has an orphan, missing, or extra production source.", {
      sourceIds,
    });
  }
  const dataModules = graphIds.filter((id) => /\.(?:css|json)(?:\?|$)/u.test(id)).sort();
  if (!isDeepStrictEqual(dataModules, EXPECTED_GRAPH_DATA_MODULES)) {
    fail("VITE_GRAPH_DRIFT", "The exact App data-module inventory drifted.", { dataModules });
  }
  const entry = findGraphModule(graph, APP_INDEX_PATH);
  const reachable = new Set();
  const pending = entry === undefined ? [] : [entry.id];
  while (pending.length !== 0) {
    const id = pending.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const imported of findGraphModule(graph, id)?.imports ?? []) pending.push(imported);
  }
  if (CURRENT_APP_SOURCE_PATHS.some((relativePath) => !reachable.has(relativePath))) {
    fail("VITE_GRAPH_DRIFT", "Every App production source must be reachable from index.html.");
  }
  const application = findGraphModule(graph, APPLICATION_SOURCE_PATH);
  if (
    application?.imports.includes(ADAPTER_CANVAS_SOURCE_PATH) !== true ||
    application.imports.includes(AUTHORING_SELECTION_SOURCE_PATH) !== true
  ) {
    fail(
      "VITE_GRAPH_DRIFT",
      "The App application lost its adapter-canvas or Source-selection module edge.",
    );
  }
  const canvas = findGraphModule(graph, ADAPTER_CANVAS_SOURCE_PATH);
  const expectedCanvasEdges = [
    "apps/desen-app/src/application.module.css",
    AUTHORING_DATA_SOURCE_PATH,
    AUTHORING_SELECTION_SOURCE_PATH,
    BUNDLE_PATH,
    "node_modules/react/index.js",
    "node_modules/react/jsx-runtime.js",
    CATALOG_PATH,
    "packages/reference-catalog-web/dist/react-adapters/index.js",
    "packages/reference-catalog-web/dist/tokens/index.js",
    "packages/runtime-core/dist/index.js",
    "packages/runtime-react/dist/index.js",
  ];
  if (!isDeepStrictEqual(canvas?.imports, expectedCanvasEdges)) {
    fail("VITE_GRAPH_DRIFT", "The canvas runtime import graph is not the exact public path.", {
      actual: canvas?.imports,
    });
  }
  const selection = findGraphModule(graph, AUTHORING_SELECTION_SOURCE_PATH);
  if (
    selection === undefined ||
    selection.imports.length !== 0 ||
    selection.dynamicImports.length !== 0
  ) {
    fail(
      "VITE_GRAPH_DRIFT",
      "The Source-selection projector must emit without runtime package or dynamic edges.",
    );
  }
  const adapters = findGraphModule(
    graph,
    "packages/reference-catalog-web/dist/react-adapters/index.js",
  );
  if (REQUIRED_COMPONENT_MODULES.some((module) => !adapters?.imports.includes(module))) {
    fail("VITE_GRAPH_DRIFT", "The public registry no longer reaches all five real components.");
  }
  const runtimeReact = findGraphModule(graph, "packages/runtime-react/dist/index.js");
  if (
    runtimeReact?.imports.includes("packages/runtime-react/dist/render-plan.js") !== true ||
    runtimeReact.imports.includes("packages/runtime-react/dist/live-surface.js") !== true ||
    runtimeReact.imports.includes("packages/runtime-react/dist/surface-boundary.js") !== true
  ) {
    fail("VITE_GRAPH_DRIFT", "The public runtime-react entry lost its managed rendering path.");
  }

  const hostModules = rawHostArtifact?.runtimeResolution?.modules;
  if (!Array.isArray(hostModules)) {
    fail("HOST_GRAPH_IDENTITY_DRIFT", "The frozen host artifact lost its Vite modules.");
  }
  const identityReceipts = [];
  for (const id of REQUIRED_SHARED_RUNTIME_MODULES) {
    const appModule = findGraphModule(graph, id);
    const hostModule = hostModules.find((candidate) => candidate?.id === id);
    if (
      appModule === undefined ||
      hostModule === undefined ||
      appModule.codeBytes !== hostModule.codeBytes ||
      appModule.codeSha256 !== hostModule.codeSha256 ||
      !isDeepStrictEqual(appModule.imports, hostModule.imports) ||
      !isDeepStrictEqual(appModule.dynamicImports, hostModule.dynamicImports)
    ) {
      fail("HOST_GRAPH_IDENTITY_DRIFT", "App and host transformed runtime modules differ.", {
        id,
      });
    }
    identityReceipts.push(
      deepFreeze({
        id,
        codeBytes: appModule.codeBytes,
        codeSha256: appModule.codeSha256,
        importsSha256: `sha256:${sha256(Buffer.from(JSON.stringify(appModule.imports)))}`,
      }),
    );
  }
  return deepFreeze({
    tool: "vite@8.1.5",
    authority: "programmatic build({ write: false }) Plugin.moduleParsed",
    observer: "moduleParsed",
    write: false,
    moduleCount: graph.length,
    staticEdges,
    dynamicEdges,
    unresolvedEdges: 0,
    reachableProductionSourceFiles: CURRENT_APP_SOURCE_PATHS.length,
    dataModules,
    graphSha256: `sha256:${sha256(Buffer.from(JSON.stringify(graph)))}`,
    modules: graph,
    sharedHostGraphSha256: rawHostArtifact.runtimeResolution.graphSha256,
    sharedRuntimeModuleCount: identityReceipts.length,
    realComponentModuleCount: REQUIRED_COMPONENT_MODULES.length,
    sharedRuntimeIdentity: identityReceipts,
    exactRegistryOnlyComposition: true,
  });
}

async function buildRuntimeGraphEvidence(workspaceRoot, hostArtifact) {
  const first = await runObservedViteBuild(workspaceRoot);
  const firstBacking = await snapshotBackingFiles(workspaceRoot, first.backingModules);
  const second = await runObservedViteBuild(workspaceRoot);
  const secondBacking = await snapshotBackingFiles(workspaceRoot, second.backingModules);
  if (!isDeepStrictEqual(first.modules, second.modules)) {
    fail("VITE_GRAPH_NONDETERMINISTIC", "Two independent Vite observer builds differed.");
  }
  if (
    !isDeepStrictEqual(first.backingModules, second.backingModules) ||
    !isDeepStrictEqual(firstBacking, secondBacking)
  ) {
    fail("VITE_GRAPH_NONDETERMINISTIC", "Vite backing authority changed between observations.");
  }
  const policy = verifyDesenAppRealAdapterCanvasGraphPolicy(first.modules, hostArtifact);
  const finalBacking = await snapshotBackingFiles(workspaceRoot, first.backingModules);
  if (!isDeepStrictEqual(firstBacking, finalBacking)) {
    fail("VITE_GRAPH_NONDETERMINISTIC", "Vite backing authority changed after graph validation.");
  }
  return deepFreeze({
    ...policy,
    independentBuilds: 2,
    deterministic: true,
    backingFiles: firstBacking.length,
    backingSnapshotSha256: `sha256:${sha256(Buffer.from(JSON.stringify(firstBacking)))}`,
    backingModulesStableAcrossObservations: true,
    finalBackingReauthenticated: true,
  });
}

function inspectPackage(bytes) {
  const manifest = parseJson(bytes, APP_PACKAGE_PATH);
  const requiredDependencies = {
    "@desen/catalog-sdk": "workspace:*",
    "@desen/editor-core": "workspace:*",
    "@desen/publisher": "workspace:*",
    "@desen/reference-catalog-web": "workspace:*",
    "@desen/runtime-core": "workspace:*",
    "@desen/runtime-react": "workspace:*",
    "@desen/validator": "workspace:*",
    react: "19.2.8",
    "react-dom": "19.2.8",
  };
  if (
    manifest?.name !== "@desen/app-web" ||
    !isDeepStrictEqual(manifest.dependencies, requiredDependencies) ||
    manifest.scripts?.build !== "vite build" ||
    manifest.scripts?.typecheck !== "tsc -p tsconfig.json --noEmit" ||
    manifest.scripts?.["test:canvas"] !==
      "vitest run test/adapter-canvas.test.tsx test/application.test.tsx test/main-lifecycle.test.tsx" ||
    manifest.scripts?.["test:selection"] !==
      "vitest run test/authoring-selection.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:inspector"] !==
      "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx"
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The Desen App exact T03 package/runtime contract drifted.");
  }
  return deepFreeze({
    name: manifest.name,
    dependencies: requiredDependencies,
    build: manifest.scripts.build,
    typecheck: manifest.scripts.typecheck,
    focusedTest: manifest.scripts["test:canvas"],
    selectionFocusedTest: manifest.scripts["test:selection"],
    inspectorFocusedTest: manifest.scripts["test:inspector"],
  });
}

function testNames(sourceText, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );
  return collectDescendants(sourceFile, ts.isCallExpression)
    .filter(
      (call) =>
        ts.isIdentifier(call.expression) &&
        ["it", "test"].includes(call.expression.text) &&
        call.arguments.length >= 2 &&
        ts.isStringLiteral(call.arguments[0]),
    )
    .map((call) => call.arguments[0].text);
}

function inspectUiReceipts(
  adapterTestBytes,
  applicationTestBytes,
  mainLifecycleTestBytes,
  authoringSelectionTestBytes,
) {
  const adapterText = decodeUtf8(adapterTestBytes, ADAPTER_CANVAS_TEST_PATH);
  const applicationText = decodeUtf8(applicationTestBytes, APPLICATION_TEST_PATH);
  const lifecycleText = decodeUtf8(mainLifecycleTestBytes, MAIN_LIFECYCLE_TEST_PATH);
  const selectionText = decodeUtf8(authoringSelectionTestBytes, AUTHORING_SELECTION_TEST_PATH);
  const adapterNames = testNames(adapterText, ADAPTER_CANVAS_TEST_PATH);
  const applicationNames = testNames(applicationText, APPLICATION_TEST_PATH);
  const selectionNames = testNames(selectionText, AUTHORING_SELECTION_TEST_PATH);
  if (!isDeepStrictEqual(adapterNames, CURRENT_EXPECTED_ADAPTER_TEST_NAMES)) {
    fail("TEST_RECEIPT_DRIFT", "The exact adapter-canvas positive/negative test names drifted.");
  }
  if (EXPECTED_APPLICATION_TEST_NAMES.some((name) => !applicationNames.includes(name))) {
    fail("TEST_RECEIPT_DRIFT", "The App integration lost a T03 canvas/no-substitution test.");
  }
  if (!isDeepStrictEqual(selectionNames, EXPECTED_SELECTION_TEST_NAMES)) {
    fail("TEST_RECEIPT_DRIFT", "The exact public diagnostic-index selection tests drifted.");
  }
  for (const marker of [
    "<StrictMode>",
    "lifecycle.mounted",
    "lifecycle.disposed",
    "view.rerender",
    "view.unmount()",
    ".disabled).toBe(true)",
    "No exact adapter preview is available for this surface.",
  ]) {
    if (!adapterText.includes(marker)) {
      fail("TEST_RECEIPT_DRIFT", "A disabled, substitution, or disposal test receipt drifted.", {
        marker,
      });
    }
  }
  if (
    !lifecycleText.includes("unmounts only on final pagehide") ||
    !lifecycleText.includes("window.dispatchEvent(pageHideEvent(false))") ||
    !lifecycleText.includes('textContent).toBe("")')
  ) {
    fail("TEST_RECEIPT_DRIFT", "The application root lifecycle receipt drifted.");
  }
  return deepFreeze({
    command:
      "pnpm --filter @desen/app-web test:inspector && node --test tests/desen-app-real-adapter-canvas.test.mjs",
    adapterTestNames: adapterNames,
    applicationIntegrationTestNames: EXPECTED_APPLICATION_TEST_NAMES,
    selectionTestNames: selectionNames,
    disabledControls: true,
    unsupportedTupleNoMount: true,
    staleTreeRemovedBeforeReplacement: true,
    exactSessionDisposal: true,
    strictModeReplayBalanced: true,
    finalRootUnmountCovered: true,
    sourceIdentityOverlayOutsideManagedSubtree: true,
    publicDiagnosticIndexProjectionCovered: true,
    publisherBundleSessionReplacementCovered: true,
  });
}

function receipts(files) {
  return TRACKED_PATHS.map((relativePath) => {
    const bytes = files.get(relativePath);
    return deepFreeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
  });
}

async function readTrackedFiles(workspaceRoot) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    files.set(
      relativePath,
      await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath),
    );
  }
  return files;
}

async function authenticateFrozenArtifact(workspaceRoot) {
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_PATH),
    "frozen M09-T03 proof artifact",
  );
  if (
    artifactBytes.byteLength !== FROZEN_ARTIFACT_PIN.bytes ||
    sha256(artifactBytes) !== FROZEN_ARTIFACT_PIN.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T03 artifact bytes differ from their exact receipt.");
  }
  const artifact = parseJson(artifactBytes, "frozen M09-T03 proof artifact");
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.proofId !== "desen-app-real-adapter-canvas" ||
    artifact?.profile !== "desen.app.real-adapter-canvas-proof.v1" ||
    artifact?.task !== "M09-T03" ||
    artifact?.result !== "PASS" ||
    artifact?.claim?.taskStatus !== "DONE" ||
    artifact?.claim?.exactOfficialBundleMounted !== true ||
    artifact?.claim?.exactPublicReferenceAdapterRegistryUsed !== true ||
    artifact?.claim?.exactPublicRuntimeReactRendererUsed !== true ||
    artifact?.claim?.sameTransformedRuntimeModulesAsReferenceHost !== true ||
    artifact?.claim?.managedCompositionRegistryOnly !== true ||
    artifact?.claim?.canvasControlsDisabled !== true ||
    artifact?.claim?.p06Status !== "PROVEN" ||
    artifact?.application?.ui?.selectionOverlay !== false ||
    artifact?.boundary?.trackedFiles !== TRACKED_PATHS.length ||
    !Array.isArray(trackedReceipts) ||
    trackedReceipts.length !== TRACKED_PATHS.length ||
    !isDeepStrictEqual(
      trackedReceipts.map((candidate) => candidate?.path),
      TRACKED_PATHS,
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
      DESEN_APP_REAL_ADAPTER_CANVAS_ROOT_TEST_NAMES,
    ) ||
    artifact?.nonclaims?.[3] !==
      "No selection overlay, inspector, private-DOM authoring, Source mutation, undo, persistence, Design/Run switch, publish, or activation."
  ) {
    fail("ARTIFACT_DRIFT", "The frozen M09-T03 artifact identity or retained claims drifted.");
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
      fail("BOUNDARY_DRIFT", `A retained M09-T03 task-time receipt drifted: ${relativePath}.`);
    }
  }
}

function verifyProofDocument(proofDocument, artifactSha256) {
  const text = decodeUtf8(proofDocument, PROOF_DOCUMENT_PATH);
  const digest = `sha256:${artifactSha256}`;
  if (
    !text.includes("M09-T03") ||
    !/(?:Status:\s*`?DONE`?|M09-T03\s*\|\s*DONE)/u.test(text) ||
    !text.includes(ARTIFACT_PATH) ||
    text.split(digest).length - 1 !== 1 ||
    text.includes("[PENDING_FINAL_ARTIFACT_SHA256]") ||
    !text.includes("P-06") ||
    !text.includes("PROVEN")
  ) {
    fail("PROOF_PIN_DRIFT", "The visible M09-T03 proof path, digest, or closure status drifted.");
  }
}

function captureBuildOptions(rawOptions) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["hostSourceAuditArtifactBytes", "shellArtifactBytes", "workspaceRoot"],
    "build options",
  );
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    shellArtifactBytes:
      options.shellArtifactBytes === undefined
        ? undefined
        : captureBytes(options.shellArtifactBytes, "shellArtifactBytes"),
    hostSourceAuditArtifactBytes:
      options.hostSourceAuditArtifactBytes === undefined
        ? undefined
        : captureBytes(options.hostSourceAuditArtifactBytes, "hostSourceAuditArtifactBytes"),
  });
}

/** Authenticates frozen M09-T03 evidence and checks its live additive M09-T05 successor. */
export async function buildDesenAppRealAdapterCanvasEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const canonicalWorkspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files, discoveredSourcePaths, shellBytes, hostBytes] = await Promise.all([
    authenticateFrozenArtifact(canonicalWorkspaceRoot),
    readTrackedFiles(canonicalWorkspaceRoot),
    discoverRegularPaths(
      path.join(canonicalWorkspaceRoot, "apps/desen-app/src"),
      canonicalWorkspaceRoot,
    ),
    options.shellArtifactBytes ??
      readRegularAuthority(
        path.join(canonicalWorkspaceRoot, SHELL_ARTIFACT_PATH),
        SHELL_ARTIFACT_PATH,
      ),
    options.hostSourceAuditArtifactBytes ??
      readRegularAuthority(
        path.join(canonicalWorkspaceRoot, HOST_SOURCE_AUDIT_ARTIFACT_PATH),
        HOST_SOURCE_AUDIT_ARTIFACT_PATH,
      ),
  ]);
  if (!isDeepStrictEqual(discoveredSourcePaths, CURRENT_APP_SOURCE_PATHS)) {
    fail("SOURCE_INVENTORY_DRIFT", "The complete Desen App production source inventory drifted.", {
      actual: discoveredSourcePaths,
    });
  }
  const shellPin = authenticateShellArtifact(shellBytes);
  const hostSourceAudit = authenticateHostSourceAuditArtifact(hostBytes);
  const hostArtifact = hostSourceAudit.artifact;
  const data = inspectControlledData(files.get(CATALOG_PATH), files.get(BUNDLE_PATH));
  const sourcePolicy = verifyDesenAppRealAdapterCanvasSourcePolicy(
    decodeUtf8(files.get(ADAPTER_CANVAS_SOURCE_PATH), ADAPTER_CANVAS_SOURCE_PATH),
    decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH),
    decodeUtf8(files.get(AUTHORING_SELECTION_SOURCE_PATH), AUTHORING_SELECTION_SOURCE_PATH),
  );
  const [semanticSymbols, runtimeResolution] = await Promise.all([
    inspectSemanticSymbols(canonicalWorkspaceRoot),
    buildRuntimeGraphEvidence(canonicalWorkspaceRoot, hostArtifact),
  ]);
  const packageContract = inspectPackage(files.get(APP_PACKAGE_PATH));
  const uiReceipts = inspectUiReceipts(
    files.get(ADAPTER_CANVAS_TEST_PATH),
    files.get(APPLICATION_TEST_PATH),
    files.get(MAIN_LIFECYCLE_TEST_PATH),
    files.get(AUTHORING_SELECTION_TEST_PATH),
  );
  assertRetainedHistoricalReceipts(frozen.artifact, files);
  const currentCompatibility = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-real-adapter-canvas",
    profile: "desen.app.real-adapter-canvas-proof.v1",
    task: "M09-T03",
    result: "PASS",
    prerequisites: [shellPin, hostSourceAudit.pin],
    retainedClaim: {
      taskStatus: frozen.artifact.claim.taskStatus,
      shellCompatibilityRetained: frozen.artifact.claim.shellCompatibilityRetained,
      exactOfficialBundleMounted: frozen.artifact.claim.exactOfficialBundleMounted,
      exactPublicReferenceAdapterRegistryUsed:
        frozen.artifact.claim.exactPublicReferenceAdapterRegistryUsed,
      exactPublicRuntimeReactRendererUsed:
        frozen.artifact.claim.exactPublicRuntimeReactRendererUsed,
      sameTransformedRuntimeModulesAsReferenceHost:
        frozen.artifact.claim.sameTransformedRuntimeModulesAsReferenceHost,
      managedCompositionRegistryOnly: frozen.artifact.claim.managedCompositionRegistryOnly,
      canvasControlsDisabled: frozen.artifact.claim.canvasControlsDisabled,
      p06Status: frozen.artifact.claim.p06Status,
    },
    authority: {
      data,
      source: sourcePolicy,
      semanticSymbols,
      runtimeResolution,
    },
    application: {
      package: packageContract,
      route: {
        projectId: "account-app",
        surfaceId: "sign-in",
        unsupportedTuplePolicy: "NO_MOUNT_NO_SUBSTITUTION",
      },
      ui: {
        mode: "DESIGN_SESSION_PREVIEW",
        disabledFieldsetOutsideManagedTree: true,
        selectionOverlay: true,
        selectionIdentity: "STABLE_SOURCE_COMPONENT_ID",
        selectionRuntimeProjection: "PUBLIC_DIAGNOSTIC_INDEX_ONLY",
        selectionOverlayOutsideManagedCapabilitySubtree: true,
        inspector: true,
        schemaDerivedPrimitiveAndEnumControls: true,
        sourcePropMutation: "PUBLIC_EDITOR_CORE_ONLY",
        publisherBackedSessionPreview: true,
      },
      lifecycle: {
        headlessSessionPerSupportedMount: true,
        mismatchDisposesBeforeFailure: true,
        preflightFailureDisposesBeforeFailure: true,
        effectCleanupDisposes: true,
        strictModeReplayBalanced: true,
      },
    },
    tests: uiReceipts,
    boundary: {
      appSourceInventoryClosed: true,
      appSourceSymlinksRejected: true,
      productionSourceFiles: CURRENT_APP_SOURCE_PATHS.length,
      retainedHistoricalReceipts: RETAINED_HISTORICAL_PATHS.length,
      successorCompatibilityPaths: SUCCESSOR_COMPATIBILITY_PATHS.length,
      currentHistoricalPathReceipts: receipts(files),
      additiveSuccessorReceipts: [
        AUTHORING_SELECTION_SOURCE_PATH,
        AUTHORING_SELECTION_TEST_PATH,
        AUTHORING_INSPECTOR_SOURCE_PATH,
        AUTHORING_PREVIEW_SOURCE_PATH,
        INSPECTOR_PANEL_SOURCE_PATH,
        AUTHORING_INSPECTOR_TEST_PATH,
        AUTHORING_PREVIEW_TEST_PATH,
      ].map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
    successor: {
      task: "M09-T05",
      stableSourceSelectionOverlayOwnedBySuccessor: true,
      historicalNoSelectionOverlayNonclaimAppliedToCurrentApp: false,
      outsideManagedCapabilitySubtree: true,
      publicDiagnosticIndexOnly: true,
      privateDomOrReactInspection: false,
      schemaDerivedPrimitiveAndEnumInspectorImplemented: true,
      publicEditorCorePropMutationImplemented: true,
      publisherBackedSessionPreviewImplemented: true,
      historicalNoInspectorOrSourceMutationNonclaimAppliedToCurrentApp: false,
      dynamicAndStructuredEditingImplemented: false,
      persistenceImplemented: false,
      runOrPublishImplemented: false,
    },
  });
  return deepFreeze({
    artifact: frozen.artifact,
    artifactBytes: frozen.artifactBytes,
    artifactSha256: frozen.artifactSha256,
    currentCompatibility,
  });
}

/** Verifies committed M09-T03 bytes and their visible proof-document digest association. */
export async function verifyDesenAppRealAdapterCanvasEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const built = await buildDesenAppRealAdapterCanvasEvidence(options.buildOptions);
  const artifactBytes =
    options.artifactBytes === undefined
      ? await readRegularAuthority(
          capturePath(
            options.artifactPath,
            "artifactPath",
            DEFAULT_DESEN_APP_REAL_ADAPTER_CANVAS_ARTIFACT_PATH,
          ),
          ARTIFACT_PATH,
        )
      : captureBytes(options.artifactBytes, "artifactBytes");
  if (!isDeepStrictEqual(artifactBytes, built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "Committed M09-T03 artifact bytes differ from fresh evidence.");
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
    graphModules: built.artifact.authority.runtimeResolution.moduleCount,
    currentGraphModules: built.currentCompatibility.authority.runtimeResolution.moduleCount,
    sharedRuntimeModules: built.artifact.authority.runtimeResolution.sharedRuntimeModuleCount,
    realComponentModules: built.artifact.authority.runtimeResolution.realComponentModuleCount,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}

/** Atomically writes exact deterministic M09-T03 proof bytes. */
export async function writeDesenAppRealAdapterCanvasEvidence(rawOptions = undefined) {
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
    DEFAULT_DESEN_APP_REAL_ADAPTER_CANVAS_ARTIFACT_PATH,
  );
  const built = await buildDesenAppRealAdapterCanvasEvidence(options.buildOptions);
  try {
    await writeAtomicProofArtifact({
      artifactPath,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "Atomic M09-T03 artifact write failed safely.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    task: built.artifact.task,
    result: built.artifact.result,
    artifactPath,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    graphModules: built.artifact.authority.runtimeResolution.moduleCount,
    currentGraphModules: built.currentCompatibility.authority.runtimeResolution.moduleCount,
    trackedFiles: built.artifact.boundary.trackedFiles,
  });
}
