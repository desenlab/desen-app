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
const NAMED_SLOT_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-named-slot-authoring.json";
const FIXTURES_SCENARIOS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-fixtures-scenarios-fidelity.json";
const SOURCE_PERSISTENCE_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-source-persistence.json";
const NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-node-linked-diagnostics.json";
const PUBLISH_ACTIVATION_ARTIFACT_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const ROOT_PACKAGE_PATH = "package.json";
const APP_PACKAGE_PATH = "apps/desen-app/package.json";
const APP_INDEX_PATH = "apps/desen-app/index.html";
const ADAPTER_CANVAS_SOURCE_PATH = "apps/desen-app/src/adapter-canvas.tsx";
const APPLICATION_SOURCE_PATH = "apps/desen-app/src/application.tsx";
const AUTHORING_DATA_SOURCE_PATH = "apps/desen-app/src/authoring-data.ts";
const AUTHORING_SELECTION_SOURCE_PATH = "apps/desen-app/src/authoring-selection.ts";
const AUTHORING_INSPECTOR_SOURCE_PATH = "apps/desen-app/src/authoring-inspector.ts";
const AUTHORING_PREVIEW_SOURCE_PATH = "apps/desen-app/src/authoring-preview.ts";
const AUTHORING_SLOT_SOURCE_PATH = "apps/desen-app/src/authoring-slots.ts";
const AUTHORING_STATE_SOURCE_PATH = "apps/desen-app/src/authoring-state.ts";
const AUTHORING_EVENT_ACTION_SOURCE_PATH = "apps/desen-app/src/authoring-event-actions.ts";
const AUTHORING_FIXTURES_SOURCE_PATH = "apps/desen-app/src/authoring-fixtures.ts";
const AUTHORING_SCENARIOS_SOURCE_PATH = "apps/desen-app/src/authoring-scenarios.ts";
const PREVIEW_CONTROLS_SOURCE_PATH = "apps/desen-app/src/preview-controls.tsx";
const PREVIEW_FIDELITY_SOURCE_PATH = "apps/desen-app/src/preview-fidelity.ts";
const EVENT_ACTION_PANEL_SOURCE_PATH = "apps/desen-app/src/event-action-panel.tsx";
const INSPECTOR_PANEL_SOURCE_PATH = "apps/desen-app/src/inspector-panel.tsx";
const STATE_PANEL_SOURCE_PATH = "apps/desen-app/src/state-panel.tsx";
const STRUCTURED_JSON_SOURCE_PATH = "apps/desen-app/src/structured-json.ts";
const ADAPTER_CANVAS_TEST_PATH = "apps/desen-app/test/adapter-canvas.test.tsx";
const APPLICATION_TEST_PATH = "apps/desen-app/test/application.test.tsx";
const AUTHORING_SELECTION_TEST_PATH = "apps/desen-app/test/authoring-selection.test.ts";
const AUTHORING_INSPECTOR_TEST_PATH = "apps/desen-app/test/authoring-inspector.test.ts";
const AUTHORING_PREVIEW_TEST_PATH = "apps/desen-app/test/authoring-preview.test.ts";
const AUTHORING_SLOT_TEST_PATH = "apps/desen-app/test/authoring-slots.test.ts";
const AUTHORING_STATE_TEST_PATH = "apps/desen-app/test/authoring-state.test.ts";
const AUTHORING_EVENT_ACTION_TEST_PATH = "apps/desen-app/test/authoring-event-actions.test.ts";
const EVENT_ACTION_PANEL_TEST_PATH = "apps/desen-app/test/event-action-panel.test.tsx";
const AUTHORING_FIXTURES_TEST_PATH = "apps/desen-app/test/authoring-fixtures.test.ts";
const AUTHORING_SCENARIOS_TEST_PATH = "apps/desen-app/test/authoring-scenarios.test.ts";
const PREVIEW_CONTROLS_TEST_PATH = "apps/desen-app/test/preview-controls.test.tsx";
const PREVIEW_FIDELITY_TEST_PATH = "apps/desen-app/test/preview-fidelity.test.ts";
const INSPECTOR_PANEL_TEST_PATH = "apps/desen-app/test/inspector-panel.test.tsx";
const STATE_PANEL_TEST_PATH = "apps/desen-app/test/state-panel.test.tsx";
const STRUCTURED_JSON_TEST_PATH = "apps/desen-app/test/structured-json.test.ts";
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
    AUTHORING_SLOT_SOURCE_PATH,
    AUTHORING_STATE_SOURCE_PATH,
    AUTHORING_EVENT_ACTION_SOURCE_PATH,
    AUTHORING_FIXTURES_SOURCE_PATH,
    AUTHORING_SCENARIOS_SOURCE_PATH,
    EVENT_ACTION_PANEL_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
    PREVIEW_CONTROLS_SOURCE_PATH,
    PREVIEW_FIDELITY_SOURCE_PATH,
    STATE_PANEL_SOURCE_PATH,
    STRUCTURED_JSON_SOURCE_PATH,
    "apps/desen-app/src/authoring-diagnostics.ts",
    "apps/desen-app/src/authoring-persistence.ts",
    "apps/desen-app/src/authoring-publication.ts",
    "apps/desen-app/src/diagnostics-panel.tsx",
    "apps/desen-app/src/persistence-controls.tsx",
    "apps/desen-app/src/publication-controls.tsx",
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
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/authoring-diagnostics.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-inspector.ts",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/authoring-slots.ts",
  "apps/desen-app/src/authoring-state.ts",
  "apps/desen-app/src/diagnostics-panel.tsx",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/test/adapter-canvas.test.tsx",
  "apps/desen-app/test/application.test.tsx",
  "apps/desen-app/test/authoring-diagnostics.test.ts",
  "apps/desen-app/test/authoring-event-actions.test.ts",
  "apps/desen-app/test/authoring-inspector.test.ts",
  "apps/desen-app/test/authoring-slots.test.ts",
  "apps/desen-app/test/authoring-state.test.ts",
  "apps/desen-app/test/diagnostics-panel.test.tsx",
  "apps/desen-app/test/persistence-application.test.tsx",
]);
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
  "apps/desen-app/test/publication-application.test.tsx",
  "apps/desen-app/test/publication-controls.test.tsx",
  "packages/editor-web/package.json",
  "packages/editor-web/src/index.ts",
  "packages/editor-web/src/local-bundle-channel-publication.ts",
  "packages/editor-web/test/local-bundle-channel-publication.test.ts",
  "packages/editor-web/test/public-package.mjs",
  "packages/editor-web/test/public-package.types.mts",
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
const SUCCESSOR_COMPATIBILITY_PATHS = Object.freeze([
  ...T12_SUCCESSOR_RECEIPT_PATHS,
  ...T13_SUCCESSOR_RECEIPT_PATHS,
  ...T14_SUCCESSOR_RECEIPT_PATHS,
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
    ROOT_PACKAGE_PATH,
    NAMED_SLOT_ARTIFACT_PATH,
    FIXTURES_SCENARIOS_ARTIFACT_PATH,
    SOURCE_PERSISTENCE_ARTIFACT_PATH,
    NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH,
    PUBLISH_ACTIVATION_ARTIFACT_PATH,
    ...T12_SUCCESSOR_RECEIPT_PATHS,
    ...T13_SUCCESSOR_RECEIPT_PATHS,
    ...T14_SUCCESSOR_RECEIPT_PATHS,
    AUTHORING_SELECTION_SOURCE_PATH,
    AUTHORING_SELECTION_TEST_PATH,
    AUTHORING_INSPECTOR_SOURCE_PATH,
    AUTHORING_PREVIEW_SOURCE_PATH,
    AUTHORING_SLOT_SOURCE_PATH,
    AUTHORING_STATE_SOURCE_PATH,
    AUTHORING_EVENT_ACTION_SOURCE_PATH,
    AUTHORING_FIXTURES_SOURCE_PATH,
    AUTHORING_SCENARIOS_SOURCE_PATH,
    EVENT_ACTION_PANEL_SOURCE_PATH,
    INSPECTOR_PANEL_SOURCE_PATH,
    PREVIEW_CONTROLS_SOURCE_PATH,
    PREVIEW_FIDELITY_SOURCE_PATH,
    STATE_PANEL_SOURCE_PATH,
    STRUCTURED_JSON_SOURCE_PATH,
    AUTHORING_INSPECTOR_TEST_PATH,
    AUTHORING_PREVIEW_TEST_PATH,
    AUTHORING_SLOT_TEST_PATH,
    AUTHORING_STATE_TEST_PATH,
    AUTHORING_EVENT_ACTION_TEST_PATH,
    EVENT_ACTION_PANEL_TEST_PATH,
    AUTHORING_FIXTURES_TEST_PATH,
    AUTHORING_SCENARIOS_TEST_PATH,
    INSPECTOR_PANEL_TEST_PATH,
    PREVIEW_CONTROLS_TEST_PATH,
    PREVIEW_FIDELITY_TEST_PATH,
    STATE_PANEL_TEST_PATH,
    STRUCTURED_JSON_TEST_PATH,
  ]),
]);
const RETAINED_HISTORICAL_PATHS = Object.freeze(
  TRACKED_PATHS.filter((relativePath) => !SUCCESSOR_COMPATIBILITY_PATHS.includes(relativePath)),
);
const FROZEN_ARTIFACT_PIN = Object.freeze({
  bytes: 73_111,
  sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
});
const NAMED_SLOT_ARTIFACT_PIN = Object.freeze({
  task: "M09-T07",
  proofId: "desen-app-named-slot-authoring",
  profile: "desen.app.named-slot-authoring-proof.v1",
  result: "PASS",
  path: NAMED_SLOT_ARTIFACT_PATH,
  bytes: 24_830,
  sha256: "daae817af45d8ead7052fd84df4edefd7d29cdd9ebe9cc1baea5b22b27dae90f",
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
  "pnpm-lock.yaml",
  ADAPTER_CANVAS_SOURCE_PATH,
  "apps/desen-app/src/application.module.css",
  APPLICATION_SOURCE_PATH,
  AUTHORING_FIXTURES_SOURCE_PATH,
  AUTHORING_SCENARIOS_SOURCE_PATH,
  INSPECTOR_PANEL_SOURCE_PATH,
  PREVIEW_CONTROLS_SOURCE_PATH,
  PREVIEW_FIDELITY_SOURCE_PATH,
  ADAPTER_CANVAS_TEST_PATH,
  APPLICATION_TEST_PATH,
  AUTHORING_FIXTURES_TEST_PATH,
  AUTHORING_SCENARIOS_TEST_PATH,
  PREVIEW_CONTROLS_TEST_PATH,
  PREVIEW_FIDELITY_TEST_PATH,
]);
const NAMED_SLOT_SOURCE_AND_TEST_PATHS = Object.freeze([
  AUTHORING_DATA_SOURCE_PATH,
  AUTHORING_SLOT_SOURCE_PATH,
  AUTHORING_PREVIEW_SOURCE_PATH,
  ADAPTER_CANVAS_SOURCE_PATH,
  "apps/desen-app/test/authoring-data.test.ts",
  AUTHORING_SLOT_TEST_PATH,
  AUTHORING_PREVIEW_TEST_PATH,
  ADAPTER_CANVAS_TEST_PATH,
]);

const EXPECTED_ADAPTER_IMPORTS = Object.freeze([
  Object.freeze({
    module: "react",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["useEffect", "useMemo", "useRef", "useState"]),
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
    module: "./authoring-diagnostics.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["projectAuthoringDiagnostics"]),
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
    module: "@desen/editor-core",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["DesenEditorContinuousValidationReport"]),
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
    module: "react",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze(["RefObject"]),
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
  Object.freeze({
    module: "./authoring-diagnostics.js",
    defaultImport: null,
    namespaceImport: null,
    namedImports: Object.freeze([
      "AuthoringDiagnosticOccurrence",
      "AuthoringDiagnosticView",
      "AuthoringDiagnosticsSnapshotIdentity",
    ]),
    typeOnly: true,
  }),
]);

const EXPECTED_JSX_BY_FUNCTION = Object.freeze({
  isSupportedRoute: Object.freeze([]),
  readPreviewRevision: Object.freeze([]),
  renderManagedFailure: Object.freeze(["div"]),
  SelectionOverlay: Object.freeze(["div", "span", "span", "strong", "code", "span"]),
  DiagnosticPlaceholderOverlay: Object.freeze([
    "div",
    "span",
    "span",
    "strong",
    "code",
    "span",
    "span",
  ]),
  ManagedAdapterSurface: Object.freeze([
    "fieldset",
    "legend",
    "div",
    "RuntimeReactSurfaceBoundary",
    "DiagnosticPlaceholderOverlay",
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
  projectAuthoringDiagnostics: 1,
  projectAuthoringSelection: 1,
  renderRuntimeReactSurface: 1,
  useEffect: 2,
  useMemo: 1,
  useRef: 2,
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
  EXPECTED_ADAPTER_TEST_NAMES[0],
  "runs real adapter events on the same session and preserves state across mode changes",
  "keeps an exact host authority stable and hides its tree synchronously on replacement",
  ...EXPECTED_ADAPTER_TEST_NAMES.slice(1, 3),
  "replaces the exact session when a current authoring draft Bundle is rerendered",
  EXPECTED_ADAPTER_TEST_NAMES[3],
  "renders Source-identity selection chrome as a sibling outside the managed subtree",
  "keeps a selected conditional Source node honest when it is not materialized",
  "rejects stale and cross-route selection identities without exposing overlay chrome",
]);
const EXPECTED_APPLICATION_TEST_NAMES = Object.freeze([
  "renders the editable Source hierarchy and keeps the exact managed adapter canvas read only",
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

const EXPECTED_CURRENT_APPLICATION_GRAPH_IMPORTS = Object.freeze([
  "apps/desen-app/src/adapter-canvas.tsx",
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/assets/breadcrumb-separator.svg",
  "apps/desen-app/src/assets/desen-logo.svg",
  "apps/desen-app/src/assets/plus.svg",
  "apps/desen-app/src/assets/settings.svg",
  "apps/desen-app/src/assets/theme.svg",
  "apps/desen-app/src/authoring-data.ts",
  "apps/desen-app/src/authoring-diagnostics.ts",
  "apps/desen-app/src/authoring-event-actions.ts",
  "apps/desen-app/src/authoring-fixtures.ts",
  "apps/desen-app/src/authoring-inspector.ts",
  "apps/desen-app/src/authoring-persistence.ts",
  "apps/desen-app/src/authoring-preview.ts",
  "apps/desen-app/src/authoring-publication.ts",
  "apps/desen-app/src/authoring-scenarios.ts",
  "apps/desen-app/src/authoring-selection.ts",
  "apps/desen-app/src/authoring-slots.ts",
  "apps/desen-app/src/authoring-state.ts",
  "apps/desen-app/src/diagnostics-panel.tsx",
  "apps/desen-app/src/event-action-panel.tsx",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app/src/persistence-controls.tsx",
  "apps/desen-app/src/preview-controls.tsx",
  "apps/desen-app/src/preview-fidelity.ts",
  "apps/desen-app/src/project-data.ts",
  "apps/desen-app/src/project-navigation.ts",
  "apps/desen-app/src/publication-controls.tsx",
  "apps/desen-app/src/state-panel.tsx",
  "node_modules/react/index.js",
  "node_modules/react/jsx-runtime.js",
  "packages/editor-core/dist/index.js",
  "packages/protocol/dist/index.js",
  "packages/reference-catalog-web/catalog.json",
  "packages/runtime-core/dist/index.js",
]);
const EXPECTED_CURRENT_VITE_GRAPH_SHA256 =
  "sha256:076a321a624f6d3dc08cf59a50bd9422fa395645ecd279ad407e6f1babb2314d";

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
  testkit: Object.freeze(["protocol", "testkit"]),
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

function captureFileOverrides(value) {
  if (value === undefined) return new Map();
  if (
    !(value instanceof Map) ||
    utilTypes.isProxy(value) ||
    value.size > CURRENT_COMPATIBILITY_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one bounded intrinsic Map.");
  }
  const captured = new Map();
  for (const [relativePath, bytes] of value) {
    if (
      typeof relativePath !== "string" ||
      !CURRENT_COMPATIBILITY_PATHS.includes(relativePath) ||
      captured.has(relativePath)
    ) {
      fail("OPTIONS_INVALID", "fileOverrides contains an untracked or duplicate path.");
    }
    captured.set(relativePath, captureBytes(bytes, `fileOverrides[${relativePath}]`));
  }
  return captured;
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

function authenticateNamedSlotArtifact(bytes) {
  const pin = NAMED_SLOT_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PREREQUISITE_DRIFT", "The exact M09-T07 named-slot artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, NAMED_SLOT_ARTIFACT_PATH);
  if (
    artifact?.schemaVersion !== 1 ||
    artifact?.task !== pin.task ||
    artifact?.proofId !== pin.proofId ||
    artifact?.profile !== pin.profile ||
    artifact?.result !== pin.result ||
    artifact?.claim?.completeCatalogDeclaredSlotProjection !== true ||
    artifact?.claim?.publicStableIdInsert !== true ||
    artifact?.claim?.publicCrossSlotMove !== true ||
    artifact?.claim?.publicSameSlotReorder !== true ||
    artifact?.claim?.nodeDeletionPreflight !== true ||
    artifact?.claim?.deletionPreflightRunsPublicMutationAndValidation !== true ||
    artifact?.claim?.publicNestedSubtreeDelete !== true ||
    artifact?.claim?.rootDeletionDisabled !== true ||
    artifact?.claim?.sourceMinimumDeletionDisabled !== true ||
    artifact?.claim?.behaviorOwnedDeletePreservesEmptySlot !== true ||
    artifact?.claim?.exactOwnDataDeletionSelectionCapture !== true ||
    artifact?.claim?.continuousCompleteSourceRevalidation !== true ||
    artifact?.claim?.failedDeletionPreservesCurrentDocument !== true ||
    artifact?.claim?.cyclePreflight !== true ||
    artifact?.claim?.insertionAdmissionCachedPerModelAndExactTarget !== true ||
    artifact?.claim?.placementAdmissionCachedPerModelAndExactTarget !== true ||
    artifact?.claim?.cachedPlacementBaseMaterializesBoundaryFinalIndex !== true ||
    artifact?.claim?.componentPaletteRenderLimit !== 24 ||
    artifact?.claim?.activeTabOnlyAuthoringWork !== true ||
    artifact?.claim?.browserDataTransferReadsZero !== true ||
    artifact?.claim?.expandedDropReadyBoundaries !== true ||
    artifact?.claim?.stableNestedDragHover !== true ||
    artifact?.claim?.explicitComponentDropTargetGuide !== true ||
    artifact?.claim?.sourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.deletionSourceAndPreviewCommitAtomically !== true ||
    artifact?.claim?.deletionFocusManaged !== true ||
    artifact?.claim?.slotChromeOutsideManagedCapabilitySubtree !== true
  ) {
    fail("PREREQUISITE_DRIFT", "The M09-T07 named-slot identity or retained claims drifted.");
  }
  const trackedReceipts = artifact?.boundary?.trackedReceipts;
  if (!Array.isArray(trackedReceipts)) {
    fail("PREREQUISITE_DRIFT", "The M09-T07 tracked receipt boundary is absent.");
  }
  const receiptsByPath = new Map(trackedReceipts.map((receipt) => [receipt?.path, receipt]));
  const sourceAndTestReceipts = NAMED_SLOT_SOURCE_AND_TEST_PATHS.map((relativePath) => {
    const receipt = receiptsByPath.get(relativePath);
    if (
      receipt === undefined ||
      typeof receipt.bytes !== "number" ||
      !/^[0-9a-f]{64}$/u.test(receipt.sha256)
    ) {
      fail("PREREQUISITE_DRIFT", `The M09-T07 receipt for ${relativePath} is absent or invalid.`);
    }
    return Object.freeze({ path: relativePath, bytes: receipt.bytes, sha256: receipt.sha256 });
  });
  return Object.freeze({ pin, sourceAndTestReceipts: Object.freeze(sourceAndTestReceipts) });
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
    if (
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const receipt = receiptMap.get(relativePath);
    const liveBytes = files.get(relativePath);
    if (
      receipt === undefined ||
      liveBytes === undefined ||
      receipt.bytes !== liveBytes.byteLength ||
      receipt.sha256 !== sha256(liveBytes)
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

function authenticateFixturesScenariosSuccessor(bytes, files) {
  const pin = FIXTURES_SCENARIOS_ARTIFACT_PIN;
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PREREQUISITE_DRIFT", "The exact M09-T11 fixtures/scenarios artifact receipt drifted.");
  }
  const artifact = parseJson(bytes, FIXTURES_SCENARIOS_ARTIFACT_PATH);
  const parent = artifact.prerequisites?.[0];
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.task !== pin.task ||
    artifact.proofId !== pin.proofId ||
    artifact.profile !== pin.profile ||
    artifact.result !== pin.result ||
    parent?.task !== "M09-T10" ||
    parent?.proofId !== "desen-app-design-run-modes" ||
    parent?.bytes !== 17_900 ||
    parent?.sha256 !== "bc5b7ffef0c39737882072f9340bcade86f084db8e7923fcb03aa7364d077334" ||
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.scenarioSourceAndBundleEphemeral !== true ||
    artifact.claim?.authoredSourceAndPublishablePreviewUnchanged !== true ||
    artifact.claim?.publicSyntheticFixtureProjection !== true ||
    artifact.claim?.pendingStaticFixtureClaimed !== false ||
    artifact.claim?.pendingRuntimeLifecycleExercised !== true ||
    artifact.claim?.exactOperationAndPreviewContextAuthorization !== true ||
    artifact.claim?.operationInputOrPasswordRetained !== false ||
    artifact.claim?.stableAppOwnedOperationPort !== true ||
    artifact.claim?.cleanupSynchronouslyRevokesFixtureAdmission !== true ||
    artifact.claim?.pendingRevokedOnPreviewReplacement !== true ||
    !isDeepStrictEqual(artifact.claim?.visibleExecutionContexts, [
      "synthetic",
      "integration",
      "production",
    ]) ||
    artifact.claim?.visibleApproximateFidelityDifferences !== true ||
    artifact.claim?.integrationOrProductionExecutionClaimed !== false ||
    artifact.claim?.s001Status !== "TESTED" ||
    artifact.claim?.pf028Status !== "CLOSED" ||
    artifact.tests?.focusedTestCases !== 86 ||
    artifact.tests?.testCaseCounts?.[ADAPTER_CANVAS_TEST_PATH] !== 10 ||
    artifact.tests?.testCaseCounts?.[APPLICATION_TEST_PATH] !== 40 ||
    !Array.isArray(trackedReceipts)
  ) {
    fail("PREREQUISITE_DRIFT", "The exact M09-T11 artifact identity or claims drifted.");
  }
  const receiptMap = new Map(trackedReceipts.map((candidate) => [candidate?.path, candidate]));
  for (const relativePath of T11_LIVE_RECEIPT_PATHS) {
    if (
      T12_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(relativePath) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(relativePath)
    ) {
      continue;
    }
    const authority = receiptMap.get(relativePath);
    const liveBytes = files.get(relativePath);
    if (
      authority === undefined ||
      liveBytes === undefined ||
      authority.bytes !== liveBytes.byteLength ||
      authority.sha256 !== sha256(liveBytes)
    ) {
      fail("PREREQUISITE_DRIFT", `The live M09-T11 receipt drifted: ${relativePath}.`);
    }
  }
  return deepFreeze({
    task: pin.task,
    artifact: pin,
    exactDesignRunParent: true,
    scenarioSourceAndBundleEphemeral: true,
    pendingRuntimeLifecycleExercised: true,
    exactOperationAndPreviewContextAuthorization: true,
    operationInputOrPasswordRetained: false,
    stableAppOwnedOperationPort: true,
    fixtureAdmissionRevokedOnCleanupAndReplacement: true,
    visibleExecutionContexts: ["synthetic", "integration", "production"],
    visibleApproximateFidelityDifferences: true,
    focusedTestCases: 86,
    s001Status: "TESTED",
    pf028Status: "CLOSED",
  });
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
  if (bareReturns.length !== 6) {
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
    !ts.isShorthandPropertyAssignment(mountProperties[2]) ||
    !mountText.includes("bundle") ||
    !mountText.includes("catalogs: [referenceCatalog]") ||
    !mountText.includes("hostPorts")
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
  const diagnosticPlaceholders = collectDescendants(
    managedBody,
    (node) =>
      ts.isJsxSelfClosingElement(node) &&
      jsxTagText(node.tagName, sourceFile) === "DiagnosticPlaceholderOverlay",
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
  const diagnosticPlaceholderAttributeNames = (
    diagnosticPlaceholders[0]?.attributes.properties ?? []
  ).map((property) => (ts.isJsxAttribute(property) ? property.name.getText(sourceFile) : null));
  if (
    managedFieldsets.length !== 1 ||
    managedBoundaries.length !== 1 ||
    selectionOverlays.length !== 1 ||
    diagnosticPlaceholders.length !== 1 ||
    !ts.isJsxElement(fieldsetElement) ||
    !isWithin(managedBoundaries[0], fieldsetElement) ||
    isWithin(selectionOverlays[0], fieldsetElement) ||
    isWithin(diagnosticPlaceholders[0], fieldsetElement) ||
    !isDeepStrictEqual(fieldsetAttributeNames, [
      "className",
      "data-adapter-canvas-mode",
      "data-adapter-interactions",
      "data-managed-capability-frame",
      "disabled",
      "style",
    ]) ||
    !isDeepStrictEqual(boundaryAttributeNames, ["renderFailure", "result"]) ||
    !isDeepStrictEqual(overlayAttributeNames, ["projection"]) ||
    !isDeepStrictEqual(diagnosticPlaceholderAttributeNames, [
      "diagnostic",
      "occurrence",
      "placeholderRef",
    ]) ||
    !managedText.includes('data-managed-capability-frame="true"') ||
    !managedText.includes('data-managed-capability-subtree="true"') ||
    !managedText.includes("data-adapter-canvas-mode={mode}") ||
    !managedText.includes('data-adapter-interactions={mode === "run" ? "enabled" : "disabled"}') ||
    !managedText.includes('disabled={mode === "design"}') ||
    !managedText.includes("style={REFERENCE_WEB_TOKEN_CSS_PROPERTIES}") ||
    !managedText.includes("diagnosticIndex: result.surface.diagnosticIndex") ||
    !managedText.includes(
      "<RuntimeReactSurfaceBoundary renderFailure={renderManagedFailure} result={result} />",
    ) ||
    !managedText.includes(
      'mode === "design" && selectedDiagnostic !== undefined ? ( <DiagnosticPlaceholderOverlay diagnostic={selectedDiagnostic.diagnostic} occurrence={selectedDiagnostic.occurrence} placeholderRef={diagnosticPlaceholderRef} /> ) : mode === "design" ? ( <SelectionOverlay projection={projection} /> ) : null',
    )
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Selection chrome must remain a Design-only diagnostic-index sibling outside the mode-controlled managed subtree.",
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
    "hostPorts = ADAPTER_CANVAS_HOST_PORTS",
    'mode = "design"',
    "<ManagedAdapterSurface authoringModel={authoringModel} diagnostics={diagnostics} input={state.input} mode={mode} projectId={projectId} selection={selection} surfaceId={surfaceId} />",
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
        "diagnostics",
        "hostPorts",
        "mode",
        "projectId",
        "selection",
        "surfaceId",
      ]) ||
      !canvasElementText.includes("authoringModel={model}") ||
      !canvasElementText.includes(
        "bundle={effectivePreview?.ok === true ? effectivePreview.bundle : null}",
      ) ||
      !canvasElementText.includes('diagnostics={ mode === "design"') ||
      !canvasElementText.includes("report: activeTransientDiagnostics.report") ||
      !canvasElementText.includes(
        "selectedSelectionKey: diagnosticSelection?.selectionKey ?? null",
      ) ||
      !canvasElementText.includes("hostPorts={fixtureHostPorts}") ||
      !canvasElementText.includes("mode={mode}") ||
      !canvasElementText.includes("projectId={project.id}") ||
      !canvasElementText.includes('selection={mode === "design" ? selection : null}') ||
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
          (specifier.startsWith("@desen/runtime-") && specifier !== "@desen/runtime-core") ||
          (specifier.startsWith("@desen/reference-catalog-web") &&
            specifier !== "@desen/reference-catalog-web/catalog.json") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/"),
      )
    ) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        "Registry/runtime authority and ReactDOM scheduling must remain outside application.tsx.",
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
      directReactDomImports: 0,
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
    hostPortsPolicy: "EXACT_INERT_ALL_DENY_DEFAULT_WITH_EXPLICIT_APP_OVERRIDE",
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
  if (graph.length !== 147 || graphIdSet.size !== graph.length) {
    fail("VITE_GRAPH_DRIFT", "The exact normalized App graph module inventory drifted.", {
      modules: graph.length,
    });
  }
  const staticEdges = graph.reduce((total, module) => total + module.imports.length, 0);
  const dynamicEdges = graph.reduce((total, module) => total + module.dynamicImports.length, 0);
  if (staticEdges !== 439 || dynamicEdges !== 0) {
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
    application.imports.includes(AUTHORING_SELECTION_SOURCE_PATH) !== true ||
    application.imports.includes(AUTHORING_SLOT_SOURCE_PATH) !== true
  ) {
    fail(
      "VITE_GRAPH_DRIFT",
      "The App application lost its adapter-canvas, Source-selection, or named-slot module edge.",
    );
  }
  if (!isDeepStrictEqual(application.imports, EXPECTED_CURRENT_APPLICATION_GRAPH_IMPORTS)) {
    fail(
      "VITE_GRAPH_DRIFT",
      "The current application import graph drifted or regained a direct ReactDOM scheduling edge.",
      { actual: application.imports },
    );
  }
  const canvas = findGraphModule(graph, ADAPTER_CANVAS_SOURCE_PATH);
  const expectedCanvasEdges = [
    "apps/desen-app/src/application.module.css",
    AUTHORING_DATA_SOURCE_PATH,
    "apps/desen-app/src/authoring-diagnostics.ts",
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
  const graphSha256 = `sha256:${sha256(Buffer.from(JSON.stringify(graph)))}`;
  if (graphSha256 !== EXPECTED_CURRENT_VITE_GRAPH_SHA256) {
    fail("VITE_GRAPH_DRIFT", "The exact current successor Vite graph identity drifted.", {
      actual: graphSha256,
    });
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
    graphSha256,
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

function inspectPackage(appBytes, rootBytes) {
  const manifest = parseJson(appBytes, APP_PACKAGE_PATH);
  const rootManifest = parseJson(rootBytes, ROOT_PACKAGE_PATH);
  const requiredDependencies = {
    "@desen/catalog-sdk": "workspace:*",
    "@desen/editor-core": "workspace:*",
    "@desen/publisher": "workspace:*",
    "@desen/protocol": "workspace:*",
    "@desen/reference-catalog-web": "workspace:*",
    "@desen/runtime-core": "workspace:*",
    "@desen/runtime-react": "workspace:*",
    "@desen/testkit": "workspace:*",
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
      "vitest run test/authoring-inspector.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:structured-inspector"] !==
      "vitest run test/structured-json.test.ts test/authoring-inspector.test.ts test/inspector-panel.test.tsx test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:named-slots"] !==
      "vitest run test/authoring-data.test.ts test/authoring-slots.test.ts test/authoring-preview.test.ts test/adapter-canvas.test.tsx test/application.test.tsx" ||
    manifest.scripts?.["test:fixtures-scenarios"] !==
      "vitest run test/authoring-fixtures.test.ts test/authoring-scenarios.test.ts test/preview-fidelity.test.ts test/preview-controls.test.tsx test/adapter-canvas.test.tsx test/application.test.tsx"
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The Desen App exact T03 package/runtime contract drifted.");
  }
  const namedSlotPrefix =
    "node scripts/verify-desen-app-structured-inspector.mjs && pnpm --filter @desen/app-web build && pnpm --filter @desen/app-web typecheck && pnpm --filter @desen/app-web test:named-slots && ";
  const namedSlotRootCommands = {
    "generate:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/generate-desen-app-named-slot-authoring-proof.mjs`,
    "verify:desen-app-named-slot-authoring": `${namedSlotPrefix}node scripts/verify-desen-app-named-slot-authoring.mjs`,
    "test:desen-app-named-slot-authoring": `${namedSlotPrefix}node --test tests/desen-app-named-slot-authoring.test.mjs`,
  };
  if (
    Object.entries(namedSlotRootCommands).some(
      ([name, command]) => rootManifest.scripts?.[name] !== command,
    )
  ) {
    fail("PACKAGE_CONTRACT_DRIFT", "The exact T07 root proof command chain drifted.");
  }
  return deepFreeze({
    name: manifest.name,
    dependencies: requiredDependencies,
    build: manifest.scripts.build,
    typecheck: manifest.scripts.typecheck,
    focusedTest: manifest.scripts["test:canvas"],
    selectionFocusedTest: manifest.scripts["test:selection"],
    inspectorFocusedTest: manifest.scripts["test:inspector"],
    structuredInspectorFocusedTest: manifest.scripts["test:structured-inspector"],
    namedSlotFocusedTest: manifest.scripts["test:named-slots"],
    fixturesScenariosFocusedTest: manifest.scripts["test:fixtures-scenarios"],
    namedSlotRootCommands,
  });
}

function inspectNamedSlotSuccessor(files, sourceAndTestReceipts) {
  const slots = decodeUtf8(files.get(AUTHORING_SLOT_SOURCE_PATH), AUTHORING_SLOT_SOURCE_PATH);
  const application = decodeUtf8(files.get(APPLICATION_SOURCE_PATH), APPLICATION_SOURCE_PATH);
  const css = decodeUtf8(
    files.get("apps/desen-app/src/application.module.css"),
    "apps/desen-app/src/application.module.css",
  );
  const slotTests = decodeUtf8(files.get(AUTHORING_SLOT_TEST_PATH), AUTHORING_SLOT_TEST_PATH);
  const applicationTests = decodeUtf8(files.get(APPLICATION_TEST_PATH), APPLICATION_TEST_PATH);
  const modeSuccessorPaths = new Set([ADAPTER_CANVAS_SOURCE_PATH, ADAPTER_CANVAS_TEST_PATH]);
  for (const receipt of sourceAndTestReceipts) {
    if (
      modeSuccessorPaths.has(receipt.path) ||
      T13_SUCCESSOR_RECEIPT_PATHS.includes(receipt.path) ||
      T14_SUCCESSOR_RECEIPT_PATHS.includes(receipt.path)
    ) {
      continue;
    }
    const bytes = files.get(receipt.path);
    if (
      bytes === undefined ||
      bytes.byteLength !== receipt.bytes ||
      sha256(bytes) !== receipt.sha256
    ) {
      fail(
        "SOURCE_POLICY_VIOLATION",
        `The live M09-T07 source/test receipt drifted: ${receipt.path}.`,
      );
    }
  }
  for (const marker of [
    "  deleteDesenEditorNode,",
    "insertDesenEditorNode",
    "moveDesenEditorNode",
    "reorderDesenEditorNode",
    "evaluateAuthoringSlotInsertion",
    "evaluateAuthoringSlotPlacement",
    "evaluateAuthoringNodeDeletion",
    "applyAuthoringNodeDelete",
    "function captureComponentSelection(",
    "placement.slot.children.length - 1 < placement.slot.contract.minimum",
    "const VALIDATOR_BY_MODEL = new WeakMap<",
    "const INSERTION_ADMISSION_BY_MODEL = new WeakMap<",
    "const PLACEMENT_ADMISSION_BY_MODEL = new WeakMap<",
    "materializePlacementCompatibility(cached.base, index)",
    "nodeContainsOwner(placement.node, capturedSelection)",
  ]) {
    if (!slots.includes(marker)) {
      fail("SOURCE_POLICY_VIOLATION", `The live M09-T07 named-slot source lost ${marker}.`);
    }
  }
  for (const marker of [
    "const COMPONENT_PALETTE_RENDER_LIMIT = 24",
    "components.slice(0, COMPONENT_PALETTE_RENDER_LIMIT)",
    "if (!active) return null",
    '{activeTab === "layers" ? (',
    'active={activeTab === "components"}',
    "const [activeDropProjection, setActiveDropProjection] = useState<AuthoringDropProjection | null>",
    "const projectDrop = useCallback((next: AuthoringDropProjection | null) =>",
    "onProjectDrop={projectDrop}",
    "function projectNearestDrop(",
    "Math.abs(clientY - midpoint) <= LAYER_DROP_MIDPOINT_HYSTERESIS_PX",
    "data-drop-hovered={dropReady && dropHovered}",
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
    'Readonly<{ readonly status: "noop"; readonly projection: AuthoringDropProjection }>',
    'status: "noop",\n        projection: Object.freeze({ index, target }),',
    "data-guide={readySlot === null}",
    "className={styles.componentsView}",
    'data-drop-noop={dragAdmission?.status === "noop"}',
    'data-drop-noop-hovered={dragAdmission?.status === "noop" && dropHovered}',
    '{dragAdmission?.status === "noop" ? "Current position" : "Drop here"}',
    "event.stopPropagation();\n    const admission = projectNearestDrop(list, event.clientY, event.target);",
    'if (admission.status === "rejected" || admission.status === "unavailable") {\n      publishAdmission(admission);',
    'if (admission.status === "accepted" || admission.status === "noop") {',
    '(releaseAdmission.status === "unavailable" || releaseAdmission.status === "rejected")',
    "interaction.dragSession.current.ownerKey === sessionOwnerKey",
    'interaction.dragSession.current.admission === "accepted"',
    "? interaction.dragSession.current.lastAcceptedProjection",
    'if (releaseAdmission.status === "noop") {',
    "const [panelDragHovered, setPanelDragHovered] = useState(false)",
    "const panelDragEnterDepth = useRef(0)",
    'data-component-drag-active={dragIntent?.kind === "component"}',
    "data-drop-hovered={componentDropReady && panelDragHovered}",
    "panelDragEnterDepth.current += 1",
    "panelDragEnterDepth.current = Math.max(0, panelDragEnterDepth.current - 1)",
    'if (!componentDropReady) return;\n    event.stopPropagation();\n    event.preventDefault();\n    event.dataTransfer.dropEffect = "copy";',
    "className={styles.componentSlotTarget}",
    "onDragOver={admitComponentDrop}",
    "onDrop={receiveComponentDrop}",
    'data-component-card="true"',
    "className={styles.componentItem}",
    'data-component-drag-handle="true"',
    "className={styles.componentDragHandle}",
    "title={`Drag ${component.displayName} to the highlighted drop target above`}",
    'data-layer-drag-handle="true"',
    "className={styles.layerDragHandle}",
    "title={`Drag ${node.displayName} layer`}",
    "className={styles.layerSelectAction}",
    "data-layer-source-node-id={node.id}",
    "className={styles.componentAddAction}",
    "draggable={false}",
    "event.preventDefault();\n                                event.stopPropagation();",
    "onClick={() => addComponent(component.id)}",
    "No drop target selected",
    "evaluateAuthoringNodeDeletion(route, model, selection)",
    "applyAuthoringNodeDelete(document, referenceCatalog, route, selection)",
    'if (result.operation === "insert" && edit.kind === "insert" && preparedModel.ok)',
    "sourceNodeId: result.nodeId",
    'setActiveTab("layers")',
    "setSelection(null)",
    "Remove layer",
    "layersTab.current?.focus()",
  ]) {
    if (!application.includes(marker)) {
      fail("SOURCE_POLICY_VIOLATION", `The live M09-T07 App source lost ${marker}.`);
    }
  }
  for (const forbidden of [
    "dataTransfer.getData",
    "function acceptsDragIntent(",
    "targetDragEnterDepth",
    "targetDragHovered",
    "draggable={enabled}",
    "draggable={movable}",
    "flushSync",
  ]) {
    if (application.includes(forbidden)) {
      fail("SOURCE_POLICY_VIOLATION", `The live M09-T07 App retained ${forbidden}.`);
    }
  }
  const componentLibraryStart = application.indexOf("function ComponentLibrary(");
  const authoringPanelStart = application.indexOf("function AuthoringPanel(");
  if (componentLibraryStart < 0 || authoringPanelStart <= componentLibraryStart) {
    fail("SOURCE_POLICY_VIOLATION", "The live M09-T07 Components panel boundary drifted.");
  }
  const componentLibrary = application.slice(componentLibraryStart, authoringPanelStart);
  const componentTargetStart = componentLibrary.indexOf("aria-label={targetName}");
  const componentGroupsStart = componentLibrary.indexOf("{groups.length > 0 ? (");
  if (componentTargetStart < 0 || componentGroupsStart <= componentTargetStart) {
    fail("SOURCE_POLICY_VIOLATION", "The live M09-T07 component target boundary drifted.");
  }
  const componentTarget = componentLibrary.slice(componentTargetStart, componentGroupsStart);
  if (
    ![
      "onDragEnter={enterComponentDrop}",
      "onDragLeave={leaveComponentDrop}",
      "onDragOver={admitComponentDrop}",
      "onDrop={receiveComponentDrop}",
    ].every(
      (marker) => componentTarget.includes(marker) && componentLibrary.split(marker).length === 3,
    )
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The Components panel fallback and sticky target must each retain all four authenticated drop handlers.",
    );
  }
  for (const marker of [
    ".slotBoundary {\n  position: relative;\n  display: flex;\n  min-height: 1.25rem;\n  align-items: center;\n  padding: 0 0.125rem;",
    ".slotBoundaryHitArea {\n  position: absolute;\n  inset: 0;\n  z-index: 5;\n  pointer-events: none;",
    '.slotBoundary[data-drop-ready="true"] .slotBoundaryHitArea,\n.slotBoundary[data-drop-noop="true"] .slotBoundaryHitArea {\n  pointer-events: auto;',
    '.slotBoundary[data-drop-ready="true"]::before {\n  position: absolute;\n  inset: 0.125rem;',
    '.slotBoundary[data-drop-ready="true"]',
    '.slotBoundary[data-drop-noop="true"]::before',
    '.slotBoundary[data-drop-hovered="true"]',
    '.slotBoundary[data-drop-hovered="true"] .slotBoundaryLine',
    '.slotBoundary[data-drop-noop-hovered="true"] .slotBoundaryCue',
    '.slotBoundary[data-drop-noop-hovered="true"] .slotBoundaryLine',
    '.componentsView[data-component-drag-active="true"]',
    '.componentsView[data-drop-hovered="true"]',
    ".componentSlotTarget {\n  position: sticky;\n  top: 0.25rem;",
    '.componentSlotTarget[data-drag-active="true"]',
    '.componentSlotTarget[data-guide="true"]',
    '.componentSlotTarget[data-drop-hovered="true"]',
    ".layerDragGuide {",
    ".layerDragHandle {\n  position: relative;\n  width: 1.75rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.25rem;",
    ".layerDragHandle::before {",
    ".componentItem {",
    ".componentDragHandle {\n  position: relative;\n  width: 2rem;\n  height: 2rem;\n  flex: 0 0 auto;\n  margin: -0.1875rem -0.25rem;",
    ".componentDragHandle::before {",
    ".componentAddAction {",
    ".deleteLayerAction {",
    ".deleteLayerGlyph {",
  ]) {
    if (!css.includes(marker)) {
      fail("SOURCE_POLICY_VIOLATION", `The live M09-T07 App CSS lost ${marker}.`);
    }
  }
  for (const forbidden of [
    "margin-block: -1.125rem",
    "margin-block: -0.875rem",
    "transition: min-height",
    '[data-drag-active="true"] .slotBoundary',
  ]) {
    if (css.includes(forbidden)) {
      fail("SOURCE_POLICY_VIOLATION", `The live M09-T07 App CSS retained ${forbidden}.`);
    }
  }
  for (const marker of [
    "disables inserts whose Catalog defaults fail schema or bounded transition admission",
    "finishes a cross-owner move across 1,024 sibling nodes",
    "Array.from({ length: 1_025 }",
    "removes a newly inserted nested subtree",
    "deletes from a behavior-owned slot and retains its own empty slot key",
    "disables root deletion and deletion across the owning slot minimum",
    "captures deletion selections as exact own data and rejects cross-route authority",
  ]) {
    if (!slotTests.includes(marker)) {
      fail("TEST_RECEIPT_DRIFT", `The live M09-T07 slot tests lost ${marker}.`);
    }
  }
  for (const marker of [
    "disables deletion for the surface root and a slot-minimum preflight without changing preview",
    "preserves the selected layer, preview, and focus when deletion is rejected",
    "expect(reads).toBe(0)",
    'getAttribute("data-drop-hovered")',
    "const alertCard = alert.closest(\"[data-component-card='true']\")",
    "expect((alert as HTMLButtonElement).draggable).toBe(false)",
    "expect(alertCard.draggable).toBe(false)",
    "[data-component-drag-handle='true']",
    "expect(alertDragHandle.draggable).toBe(true)",
    "fireEvent.dragEnter(dropPrompt, { dataTransfer })",
    "fireEvent.dragOver(panelSearch, { dataTransfer })",
    "fireEvent.drop(target, { dataTransfer })",
    'expect(layerDragHandleFor(emailLayer).getAttribute("draggable")).toBe("true")',
    "expect(slotEdit).toHaveBeenCalledTimes(1)",
    "uses the release position when it crosses a row midpoint after the last dragover",
    "keeps the admitted gap stable while the pointer jitters around a row midpoint",
    "keeps edge scrolling through a no-op gap, re-hit-tests, and fences a stale frame",
    "expect(elementFromPoint).toHaveBeenCalledWith(20, 195)",
    "expect(cancelFrame).toHaveBeenCalledWith(2)",
    "drops from a visible row with the last admitted projection when drop coordinates are absent",
    'getAttribute("data-drop-noop-hovered")',
    'toContain("Current position")',
    "Selected in Layers · use Remove layer above or press Delete/Backspace.",
    'expect(deleteAlert.textContent).toBe("Remove layer")',
    "No drop target selected",
  ]) {
    if (!applicationTests.includes(marker)) {
      fail("TEST_RECEIPT_DRIFT", `The live M09-T07 App tests lost ${marker}.`);
    }
  }
  return deepFreeze({
    task: "M09-T07",
    completeNamedSlotProjectionImplemented: true,
    publicStableIdInsertMoveAndReorderImplemented: true,
    publicValidatedNestedSubtreeDeletionImplemented: true,
    exactDeletionSelectionCaptureImplemented: true,
    rootAndMinimumDeletionPreflightImplemented: true,
    behaviorOwnedDeletePreservesEmptySlotImplemented: true,
    failedDeletionPreservesDocumentImplemented: true,
    exactTargetAdmissionCachesImplemented: true,
    placementCacheMaterializesBoundaryFinalIndex: true,
    cyclePreflightedBeforePublicEditorCoreMove: true,
    componentPaletteRenderLimit: 24,
    activeTabOnlyAuthoringWork: true,
    largeSameSlotBoundaryEvaluationCovered: true,
    compactStableDropBoundariesImplemented: true,
    stableNestedDragHoverImplemented: true,
    stableGlobalLayerDragSessionImplemented: true,
    globalLayerOwnerAndEpochFencingImplemented: true,
    innermostNestedSlotOwnsPointerImplemented: true,
    rejectedReleaseRetainsLastAcceptedProjection: true,
    noOpProjectionVisibleAndInert: true,
    edgeScrollExactSlotRehitTestingImplemented: true,
    browserDataTransferReads: 0,
    explicitComponentDropTargetGuideImplemented: true,
    componentPanelWideDropSurfaceImplemented: true,
    componentTargetDirectDropSurfaceImplemented: true,
    componentDropAdmissionLimitedToExplicitTarget: false,
    componentPaletteOuterDropInert: false,
    draggableComponentCardImplemented: false,
    dedicatedComponentDragHandleImplemented: true,
    dedicatedLayerDragHandleImplemented: true,
    separateNonDraggableComponentAddActionImplemented: true,
    atomicDeletionPreviewAndFocusImplemented: true,
    successfulInsertionSelectsNewLayer: true,
    exactArtifactSourceAndTestReceipts: true,
    artifactSourceAndTestReceiptCount: sourceAndTestReceipts.length,
    retainedLiveArtifactSourceAndTestReceiptCount:
      sourceAndTestReceipts.length - modeSuccessorPaths.size,
    modeSuccessorSemanticPaths: [...modeSuccessorPaths].sort(),
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

async function readTrackedFiles(workspaceRoot, fileOverrides) {
  const files = new Map();
  for (const relativePath of CURRENT_COMPATIBILITY_PATHS) {
    const live = await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath);
    files.set(relativePath, fileOverrides.get(relativePath) ?? live);
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
    [
      "fixturesScenariosArtifactBytes",
      "fileOverrides",
      "hostSourceAuditArtifactBytes",
      "shellArtifactBytes",
      "workspaceRoot",
    ],
    "build options",
  );
  return Object.freeze({
    workspaceRoot: capturePath(options.workspaceRoot, "workspaceRoot", WORKSPACE_ROOT),
    fileOverrides: captureFileOverrides(options.fileOverrides),
    shellArtifactBytes:
      options.shellArtifactBytes === undefined
        ? undefined
        : captureBytes(options.shellArtifactBytes, "shellArtifactBytes"),
    hostSourceAuditArtifactBytes:
      options.hostSourceAuditArtifactBytes === undefined
        ? undefined
        : captureBytes(options.hostSourceAuditArtifactBytes, "hostSourceAuditArtifactBytes"),
    fixturesScenariosArtifactBytes:
      options.fixturesScenariosArtifactBytes === undefined
        ? undefined
        : captureBytes(options.fixturesScenariosArtifactBytes, "fixturesScenariosArtifactBytes"),
  });
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
      "The exact M09-T13 node-linked-diagnostics artifact drifted.",
    );
  }
  const artifact = parseJson(artifactBytes, NODE_LINKED_DIAGNOSTICS_ARTIFACT_PATH);
  const trackedReceipts = artifact.boundary?.trackedReceipts;
  const receiptPaths = Array.isArray(trackedReceipts)
    ? trackedReceipts.map((candidate) => candidate?.path)
    : [];
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
    artifact.claim?.taskStatus !== "DONE" ||
    artifact.claim?.immutableRejectedCandidateReport !== true ||
    artifact.claim?.explicitContextIdentityMappingOnly !== true ||
    artifact.claim?.diagnosticCodeMessagePointerIdentityInference !== false ||
    artifact.claim?.duplicateOccurrenceOrderPreserved !== true ||
    artifact.claim?.unmappedDiagnosticsVisible !== true ||
    artifact.claim?.unmappedDiagnosticsSelectable !== false ||
    artifact.claim?.reportSnapshotDocumentFingerprintFenced !== true ||
    artifact.claim?.reportSnapshotCatalogFingerprintFenced !== true ||
    artifact.claim?.routeAndSurfaceFenced !== true ||
    artifact.claim?.runtimeKindMismatchFailsClosed !== true ||
    artifact.claim?.committedOwnerFingerprintFenced !== true ||
    artifact.claim?.snapshotBoundSelectionReadmitted !== true ||
    artifact.claim?.invalidPlaceholderAppOwned !== true ||
    artifact.claim?.invalidPlaceholderInsideManagedRuntimeSubtree !== false ||
    artifact.claim?.runModeDiagnosticsVisible !== false ||
    artifact.claim?.automaticFocusSteal !== false ||
    artifact.claim?.explicitSelectionFocusOnly !== true ||
    artifact.claim?.obligationsVisibleMetadataOnly !== true ||
    artifact.claim?.obligationsExecutable !== false ||
    artifact.claim?.rejectedDiagnosticsPersisted !== false ||
    artifact.claim?.rejectedDiagnosticsAffectDirtyState !== false ||
    artifact.claim?.rejectedDiagnosticsIncludedInSave !== false ||
    artifact.claim?.lastKnownGoodPreviewPreserved !== true ||
    artifact.claim?.p16Status !== "PROVEN" ||
    artifact.claim?.pf086Status !== "OPEN" ||
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
      "The M09-T13 node-linked-diagnostics identity or claims drifted.",
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
    focusedTestCases: 161,
    fullAppTestFiles: 24,
    fullAppTestCases: 339,
    trackedFiles: 39,
    parentArtifacts: 11,
    rootTests: 12,
    explicitContextIdentityMappingOnly: true,
    diagnosticCodeMessagePointerIdentityInference: false,
    duplicateOccurrenceOrderPreserved: true,
    unmappedDiagnosticsSelectable: false,
    snapshotAndRouteFenced: true,
    runtimeKindMismatchFailsClosed: true,
    invalidPlaceholderInsideManagedRuntimeSubtree: false,
    runModeDiagnosticsVisible: false,
    automaticFocusSteal: false,
    obligationsExecutable: false,
    rejectedDiagnosticsPersisted: false,
    rejectedDiagnosticsAffectDirtyState: false,
    rejectedDiagnosticsIncludedInSave: false,
    p16Status: "PROVEN",
    pf086Status: "OPEN",
  });
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
      const liveSource =
        bytes === undefined ? "" : decodeUtf8(bytes, T14_PUBLICATION_APPLICATION_TEST_PATH);
      const timeoutMarker = "}, 10_000);";
      const timeoutMarkerOccurrences = liveSource.split(timeoutMarker).length - 1;
      const frozenBytes = Buffer.from(liveSource.replace(timeoutMarker, "});"), "utf8");
      if (
        receipt?.bytes !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        receipt.sha256 !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        bytes?.byteLength !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(bytes ?? Buffer.alloc(0)) !== T14_LIVE_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256 ||
        timeoutMarkerOccurrences !== 1 ||
        frozenBytes.byteLength !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.bytes ||
        sha256(frozenBytes) !== T14_FROZEN_PUBLICATION_APPLICATION_TEST_RECEIPT.sha256
      ) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          `The exact M09-T14 timeout successor drifted: ${relativePath}.`,
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

/** Authenticates frozen M09-T03 evidence and exact additive M09-T07/T11 successors. */
export async function buildDesenAppRealAdapterCanvasEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const canonicalWorkspaceRoot = await realpath(options.workspaceRoot);
  const [frozen, files, discoveredSourcePaths, shellBytes, hostBytes] = await Promise.all([
    authenticateFrozenArtifact(canonicalWorkspaceRoot),
    readTrackedFiles(canonicalWorkspaceRoot, options.fileOverrides),
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
  const namedSlotEvidence = authenticateNamedSlotArtifact(files.get(NAMED_SLOT_ARTIFACT_PATH));
  const fixturesScenariosSuccessor = authenticateFixturesScenariosSuccessor(
    options.fixturesScenariosArtifactBytes ?? files.get(FIXTURES_SCENARIOS_ARTIFACT_PATH),
    files,
  );
  const sourcePersistenceSuccessor = authenticateSourcePersistenceSuccessor(files);
  const nodeLinkedDiagnosticsSuccessor = authenticateNodeLinkedDiagnosticsSuccessor(files);
  const publishActivationSuccessor = authenticatePublishActivationSuccessor(files);
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
  const packageContract = inspectPackage(files.get(APP_PACKAGE_PATH), files.get(ROOT_PACKAGE_PATH));
  const namedSlotSuccessor = inspectNamedSlotSuccessor(
    files,
    namedSlotEvidence.sourceAndTestReceipts,
  );
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
        AUTHORING_SLOT_SOURCE_PATH,
        INSPECTOR_PANEL_SOURCE_PATH,
        STRUCTURED_JSON_SOURCE_PATH,
        AUTHORING_INSPECTOR_TEST_PATH,
        AUTHORING_PREVIEW_TEST_PATH,
        AUTHORING_SLOT_TEST_PATH,
        INSPECTOR_PANEL_TEST_PATH,
        STRUCTURED_JSON_TEST_PATH,
        NAMED_SLOT_ARTIFACT_PATH,
        FIXTURES_SCENARIOS_ARTIFACT_PATH,
      ].map((relativePath) => ({
        path: relativePath,
        bytes: files.get(relativePath).byteLength,
        sha256: sha256(files.get(relativePath)),
      })),
    },
    successor: {
      ...namedSlotSuccessor,
      artifact: namedSlotEvidence.pin,
      stableSourceSelectionOverlayOwnedBySuccessor: true,
      historicalNoSelectionOverlayNonclaimAppliedToCurrentApp: false,
      outsideManagedCapabilitySubtree: true,
      publicDiagnosticIndexOnly: true,
      privateDomOrReactInspection: false,
      schemaDerivedPrimitiveAndEnumInspectorImplemented: true,
      publicEditorCorePropMutationImplemented: true,
      publisherBackedSessionPreviewImplemented: true,
      historicalNoInspectorOrSourceMutationNonclaimAppliedToCurrentApp: false,
      nestedObjectAndStructuredJsonEditingImplemented: true,
      dynamicEditingImplemented: false,
      persistenceImplemented: false,
      runOrPublishImplemented: false,
    },
    fixturesScenariosSuccessor,
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
