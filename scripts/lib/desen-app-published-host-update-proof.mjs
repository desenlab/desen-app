import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, types as utilTypes } from "node:util";
import { gunzipSync } from "node:zlib";

import { format } from "prettier";
import ts from "typescript";

import { writeAtomicProofArtifact } from "./atomic-proof-artifact.mjs";
import { matchesAmendedHistoricalReceipt } from "./historical-archive-redaction.mjs";
import { buildCurrentReferenceHostWebSourceAuditEvidence } from "./reference-host-web-source-audit-proof.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(MODULE_DIRECTORY, "../..");
const ARTIFACT_RELATIVE_PATH = "docs/proof/artifacts/desen-app-0.1.0-published-host-update.json";
const PROOF_DOCUMENT_RELATIVE_PATH = "docs/proof/DESEN-APP-PUBLISHED-HOST-UPDATE.md";
const T04_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-success-host-operation.json";
const T14_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-publish-activation.json";
const HOST_AUDIT_ARTIFACT_PATH = "docs/proof/artifacts/reference-host-web-0.1.0-source-audit.json";
const APP_CANVAS_ARTIFACT_PATH = "docs/proof/artifacts/desen-app-0.1.0-real-adapter-canvas.json";
const T04_HISTORICAL_READER_BRIDGE_PATH =
  "docs/proof/artifacts/desen-app-0.1.0-t04-historical-reader-bridge.json.gz";
const MAX_AUTHORITY_BYTES = 24 * 1_024 * 1_024;
const MAX_OVERRIDE_BYTES = 64 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_BYTES = 4 * 1_024 * 1_024;
const MAX_HISTORICAL_BRIDGE_INFLATED_BYTES = 8 * 1_024 * 1_024;
const MAX_HISTORICAL_DECODED_BYTES = 7 * 1_024 * 1_024;
const MAX_HISTORICAL_OVERRIDES = 256;
const READ_FLAGS =
  fileConstants.O_RDONLY | (fileConstants.O_NOFOLLOW ?? 0) | (fileConstants.O_NONBLOCK ?? 0);
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "byteLength").get;
const BUFFER_GETTER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer").get;

const APP_SOURCE_PATHS = Object.freeze(
  [
    "apps/desen-app/src/adapter-canvas.tsx",
    "apps/desen-app/src/application.module.css",
    "apps/desen-app/src/application.tsx",
    "apps/desen-app/src/assets/breadcrumb-separator.svg",
    "apps/desen-app/src/assets/desen-logo.svg",
    "apps/desen-app/src/assets/plus.svg",
    "apps/desen-app/src/assets/settings.svg",
    "apps/desen-app/src/assets/theme.svg",
    "apps/desen-app/src/authoring-behavior-projection.ts",
    "apps/desen-app/src/authoring-conditions.ts",
    "apps/desen-app/src/authoring-connections.ts",
    "apps/desen-app/src/authoring-data.ts",
    "apps/desen-app/src/authoring-diagnostics.ts",
    "apps/desen-app/src/authoring-event-actions.ts",
    "apps/desen-app/src/authoring-fixtures.ts",
    "apps/desen-app/src/authoring-inspector.ts",
    "apps/desen-app/src/authoring-integration.ts",
    "apps/desen-app/src/authoring-persistence.ts",
    "apps/desen-app/src/authoring-preview.ts",
    "apps/desen-app/src/authoring-publication.ts",
    "apps/desen-app/src/authoring-run-navigation.ts",
    "apps/desen-app/src/authoring-scenarios.ts",
    "apps/desen-app/src/authoring-selection.ts",
    "apps/desen-app/src/authoring-slots.ts",
    "apps/desen-app/src/authoring-state.ts",
    "apps/desen-app/src/behavior-controls.tsx",
    "apps/desen-app/src/diagnostics-panel.tsx",
    "apps/desen-app/src/event-action-panel.tsx",
    "apps/desen-app/src/inspector-panel.tsx",
    "apps/desen-app/src/local-operation-binding.ts",
    "apps/desen-app/src/local-runtime-persistence.ts",
    "apps/desen-app/src/local-runtime-publication.ts",
    "apps/desen-app/src/local-workspaces.module.css",
    "apps/desen-app/src/local-workspaces.tsx",
    "apps/desen-app/src/main.tsx",
    "apps/desen-app/src/persistence-controls.tsx",
    "apps/desen-app/src/preview-controls.tsx",
    "apps/desen-app/src/preview-fidelity.ts",
    "apps/desen-app/src/product-bootstrap.tsx",
    "apps/desen-app/src/project-data.ts",
    "apps/desen-app/src/project-inventory-fixture.ts",
    "apps/desen-app/src/project-navigation.ts",
    "apps/desen-app/src/project-workspace-profile.ts",
    "apps/desen-app/src/publication-controls.tsx",
    "apps/desen-app/src/reference-authoring-profile.ts",
    "apps/desen-app/src/reference-empty-project.ts",
    "apps/desen-app/src/reference-flow-workspace-profile.ts",
    "apps/desen-app/src/reference-project-fixtures.ts",
    "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
    "apps/desen-app/src/state-panel.tsx",
    "apps/desen-app/src/structured-json.ts",
    "apps/desen-app/src/styles.css",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const APP_FIXTURE_ONLY_SOURCE_PATHS = Object.freeze([
  "apps/desen-app/src/reference-authoring-profile.ts",
  "apps/desen-app/src/reference-project-fixtures.ts",
]);

const APP_GRAPH_SOURCE_PATHS = Object.freeze(
  APP_SOURCE_PATHS.filter((relativePath) => !APP_FIXTURE_ONLY_SOURCE_PATHS.includes(relativePath)),
);

const HOST_SOURCE_PATHS = Object.freeze([
  "apps/reference-host-web/src/application.tsx",
  "apps/reference-host-web/src/browser-profile.ts",
  "apps/reference-host-web/src/channel-delivery.ts",
  "apps/reference-host-web/src/failure-view.tsx",
  "apps/reference-host-web/src/host-ports.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/managed-surface.tsx",
  "apps/reference-host-web/src/official-sign-in.ts",
  "apps/reference-host-web/src/recovery-authority.ts",
  "apps/reference-host-web/src/root-policy.ts",
  "apps/reference-host-web/src/root.tsx",
  "apps/reference-host-web/src/sign-in-http-handler.ts",
  "apps/reference-host-web/src/styles.css",
]);

const HOST_SERVER_SOURCE_PATHS = Object.freeze([
  "apps/reference-host-web-server/src/channel-activation-controller.ts",
  "apps/reference-host-web-server/src/control-plane-client.ts",
  "apps/reference-host-web-server/src/index.ts",
  "apps/reference-host-web-server/src/installed-package-inventory.ts",
  "apps/reference-host-web-server/src/server.ts",
]);

const SOURCE_POLICY_PATHS = Object.freeze({
  runtimePublication: "apps/desen-app/src/local-runtime-publication.ts",
  main: "apps/desen-app/src/main.tsx",
  productBootstrap: "apps/desen-app/src/product-bootstrap.tsx",
  publicationHost: "apps/desen-app/dev/local-publication-host.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.mjs",
  referenceServer: "apps/reference-host-web-server/src/server.ts",
  referenceServerIndex: "apps/reference-host-web-server/src/index.ts",
});

const TEST_PATHS = Object.freeze({
  runtimePublication: "apps/desen-app/test/local-runtime-publication.test.ts",
  publicationHost: "apps/desen-app/dev/local-publication-host.test.mjs",
  localDevHost: "apps/desen-app/dev/local-dev-host.test.mjs",
  productBootstrap: "apps/desen-app/test/product-bootstrap.test.tsx",
  mainLifecycle: "apps/desen-app/test/main-lifecycle.test.tsx",
  referenceServer: "apps/reference-host-web-server/test/server.test.ts",
  referenceServerTypes: "apps/reference-host-web-server/test-d/production-boundary.test-d.ts",
});

const BROWSER_PATHS = Object.freeze({
  spec: "apps/desen-app-browser-e2e/published-host-update.pw.ts",
  config: "apps/desen-app-browser-e2e/published-host-playwright.config.ts",
  server: "apps/desen-app-browser-e2e/published-host-proof-server.mjs",
});

const BOUNDARY_FIXTURE_PATHS = Object.freeze([
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-published-server-reviewed-roots/apps/control-plane-api/dist/index.js",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-published-server-reviewed-roots/apps/desen-app-browser-e2e/published-host-proof-server.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-published-server-reviewed-roots/apps/desen-app/dev/local-publication-host.mjs",
  "tests/boundaries/fixtures/allowed-desen-app-browser-e2e-published-server-reviewed-roots/apps/reference-host-web-server/dist/index.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-published-server-imports-local-publication-host/apps/desen-app-browser-e2e/proof-application.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-non-published-server-imports-local-publication-host/apps/desen-app/dev/local-publication-host.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-published-server-imports-reference-host-private/apps/desen-app-browser-e2e/published-host-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-published-server-imports-reference-host-private/apps/reference-host-web-server/dist/private.js",
  "tests/boundaries/fixtures/desen-app-browser-e2e-published-server-imports-unreviewed-dev-module/apps/desen-app-browser-e2e/published-host-proof-server.mjs",
  "tests/boundaries/fixtures/desen-app-browser-e2e-published-server-imports-unreviewed-dev-module/apps/desen-app/dev/local-publication-private.mjs",
]);

const SUPPORT_PATHS = Object.freeze([
  "apps/desen-app/dev/local-dev.mjs",
  "apps/desen-app/package.json",
  "apps/desen-app/tsconfig.local-dev.json",
  "apps/desen-app-browser-e2e/package.json",
  "apps/reference-host-web/index.html",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/tsconfig.json",
  "apps/reference-host-web-server/package.json",
  "apps/reference-host-web-server/tsconfig.build.json",
  "apps/reference-host-web-server/tsconfig.json",
  "dependency-cruiser.config.cjs",
  "scripts/verify-boundary-fixtures.mjs",
  "docs/adr/0020-desen-app-fixed-destination-publication-and-host-activation.md",
  "pnpm-lock.yaml",
]);

const BRIDGE_REPRODUCTION_PATHS = Object.freeze([
  "scripts/generate-desen-app-t04-historical-reader-bridge.mjs",
  "tests/desen-app-t04-historical-reader-fixture.mjs",
]);

const PROOF_ENTRYPOINT_PATHS = Object.freeze([
  "scripts/lib/atomic-proof-artifact.mjs",
  "scripts/generate-desen-app-published-host-update-proof.mjs",
  "scripts/verify-desen-app-published-host-update.mjs",
]);

const TRACKED_PATHS = Object.freeze(
  [
    ...APP_SOURCE_PATHS,
    ...HOST_SOURCE_PATHS,
    ...HOST_SERVER_SOURCE_PATHS,
    ...Object.values(SOURCE_POLICY_PATHS),
    ...Object.values(TEST_PATHS),
    ...Object.values(BROWSER_PATHS),
    ...BOUNDARY_FIXTURE_PATHS,
    ...SUPPORT_PATHS,
    ...BRIDGE_REPRODUCTION_PATHS,
    ...PROOF_ENTRYPOINT_PATHS,
    T04_ARTIFACT_PATH,
    T14_ARTIFACT_PATH,
    HOST_AUDIT_ARTIFACT_PATH,
    APP_CANVAS_ARTIFACT_PATH,
    T04_HISTORICAL_READER_BRIDGE_PATH,
  ]
    .filter((relativePath, index, paths) => paths.indexOf(relativePath) === index)
    .sort((left, right) => left.localeCompare(right, "en-US")),
);

const SUCCESSOR_ADDED_PATHS = Object.freeze(
  [
    BROWSER_PATHS.config,
    BROWSER_PATHS.server,
    BROWSER_PATHS.spec,
    SOURCE_POLICY_PATHS.publicationHost,
    TEST_PATHS.publicationHost,
    SOURCE_POLICY_PATHS.runtimePublication,
    TEST_PATHS.runtimePublication,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const APPROVED_AR_01_RECEIPT_PATHS = Object.freeze([
  "docs/proof/artifacts/desen-app-0.1.0-t03-historical-reader-bridge.json.gz",
  "scripts/generate-desen-app-t03-historical-reader-bridge.mjs",
]);

const T04_PREDECESSOR_GAP_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/dev/local-dev.mjs",
    bytes: 1_313,
    sha256: "8e7e4fe465a9ce46737bf1bc0c0e1154d62feeac7a96443a5cd7952412881a1e",
  }),
  Object.freeze({
    path: "pnpm-lock.yaml",
    bytes: 131_888,
    sha256: "23632d4c1d8bc8832a31db328fa36c7f1523aeb7c52f034ddbb3f8edecc4c002",
  }),
]);

const FOCUSED_TEST_COMMANDS = Object.freeze([
  "pnpm --filter @desen/app-web exec vitest run test/local-runtime-publication.test.ts test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx dev/local-publication-host.test.mjs dev/local-dev-host.test.mjs",
  "pnpm --filter @desen/reference-host-web-server exec vitest run test/server.test.ts",
  "pnpm --filter @desen/reference-host-web-server typecheck",
]);
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config published-host-playwright.config.ts";
const BROWSER_TEST_NAME =
  "publishes visible label and layout edits into one unchanged independent host build";

const SHARED_MANAGED_MODULES = Object.freeze(
  [
    "packages/reference-catalog-web/dist/components/alert.js",
    "packages/reference-catalog-web/dist/components/button.js",
    "packages/reference-catalog-web/dist/components/contracts.js",
    "packages/reference-catalog-web/dist/components/interactive-contracts.js",
    "packages/reference-catalog-web/dist/components/stack.js",
    "packages/reference-catalog-web/dist/components/text-field.js",
    "packages/reference-catalog-web/dist/components/text.js",
    "packages/reference-catalog-web/dist/host-operations/index.js",
    "packages/reference-catalog-web/dist/host-operations/sign-in.js",
    "packages/reference-catalog-web/dist/operations/sign-in.js",
    "packages/reference-catalog-web/dist/react-adapters/index.js",
    "packages/runtime-react/dist/adapter-error-boundary.js",
    "packages/runtime-react/dist/diagnostic-index.js",
    "packages/runtime-react/dist/index.js",
    "packages/runtime-react/dist/interactions.js",
    "packages/runtime-react/dist/live-surface.js",
    "packages/runtime-react/dist/reconciliation.js",
    "packages/runtime-react/dist/registry.js",
    "packages/runtime-react/dist/render-plan.js",
    "packages/runtime-react/dist/root-error-policy.js",
    "packages/runtime-react/dist/session-surface.js",
    "packages/runtime-react/dist/surface-boundary.js",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const APP_ALLOWED_PACKAGES = Object.freeze([
  "catalog-sdk",
  "editor-core",
  "editor-web",
  "protocol",
  "publisher",
  "reference-catalog-web",
  "runtime-core",
  "runtime-react",
  "testkit",
  "validator",
]);
const HOST_ALLOWED_PACKAGES = Object.freeze([
  "catalog-sdk",
  "protocol",
  "reference-catalog-web",
  "runtime-core",
  "runtime-react",
  "runtime-web",
  "validator",
]);

/** Exact immutable M10-T04 application/real-host-operation predecessor. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN = Object.freeze({
  task: "M10-T04",
  gate: null,
  proofId: "desen-app-success-host-operation",
  path: T04_ARTIFACT_PATH,
  bytes: 22_456,
  sha256: "d9d841af06ec9efc51c3f1c74079f0aa4d5e1c7e996f3b97df7e277e4b1f8423",
  profile: "desen.app.success-host-operation-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact immutable M09-T14 publication/activation predecessor. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN = Object.freeze({
  task: "M09-T14",
  gate: "G09",
  proofId: "desen-app-publish-activation",
  path: T14_ARTIFACT_PATH,
  bytes: 24_763,
  sha256: "6bd2db0ca490f1d0046f145da7c4b7e9b4b25ec0f8295a159529a0e66534b23b",
  profile: "desen.app.publish-activation-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact immutable M05-T09 independent reference-host source/import audit predecessor. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN = Object.freeze({
  task: "M05-T09",
  gate: "G05",
  proofId: null,
  path: HOST_AUDIT_ARTIFACT_PATH,
  bytes: 59_871,
  sha256: "cb54702266260a6e139950808b520bc139d35cebbde03ea93a187d2340a17e89",
  profile: "desen-reference-host-web-source-audit-v1",
  result: "PASS",
  immutable: true,
});

/** Exact immutable M09-T03 App managed-renderer identity predecessor. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN = Object.freeze({
  task: "M09-T03",
  gate: null,
  proofId: "desen-app-real-adapter-canvas",
  path: APP_CANVAS_ARTIFACT_PATH,
  bytes: 73_111,
  sha256: "8f89b237c20d80e83d96f17c31146d251c026977a4fff1ab1d0822e489c63151",
  profile: "desen.app.real-adapter-canvas-proof.v1",
  result: "PASS",
  immutable: true,
});

/** Exact clean M10-T04 historical-reader bridge owned by this append-only successor. */
export const DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN = Object.freeze({
  path: T04_HISTORICAL_READER_BRIDGE_PATH,
  bytes: 3_110_146,
  sha256: "784552241d8ac1ead3ce20886076f177db86cced534cc4d0e36081497a006d75",
  uncompressedBytes: 4_878_660,
  baseCommit: "33b922e6746365510c0549ddbf3b08469e58dc11",
  fileEntries: 51,
  predecessorGapFiles: 2,
  successorAddedPaths: 7,
  projections: 1,
});

/** Independent root cases owned by the append-only M10-T05 proof family. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES = Object.freeze([
  "[authority] authenticates four immutable parents and the clean T04 historical bridge",
  "[source] fixes publication and activation to launcher-owned destinations outside Source",
  "[transport] preserves strict bounded separate browser and server activation authorities",
  "[host] freshly audits the complete independent host source and public managed renderer graph",
  "[build] proves deterministic App and host Vite graphs with one shared managed implementation",
  "[browser] records two visible publish/activate revisions against unchanged host build bytes",
  "[boundary] keeps the proof server on exact public roots and one reviewed activation bridge",
  "[claims] closes only M10-T05 and P-07 while retaining later recovery and G10 owners",
  "[determinism] reproduces exact evidence without Chromium, listener, or filesystem output",
  "[policy] rejects source, graph, browser, parent, bridge, artifact, report, option, and write mutations",
]);

/** Default destination of the deterministic M10-T05 artifact. */
export const DEFAULT_DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PATH = path.join(
  WORKSPACE_ROOT,
  ARTIFACT_RELATIVE_PATH,
);
const DEFAULT_PROOF_DOCUMENT_PATH = path.join(WORKSPACE_ROOT, PROOF_DOCUMENT_RELATIVE_PATH);

/** Exact frozen artifact identity; the reader and root test remain checkpoint-owned. */
export const DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN = Object.freeze({
  bytes: 188_547,
  sha256: "851f9c561744c15e330529d524e5d80e6ff892039fa56aae269558a715502c64",
});

const SUCCESSOR_AUTHORITIES = new WeakMap();
let cachedHistoricalBridgeAuthority;

/** Stable fail-closed error raised by the M10-T05 evidence reader. */
export class DesenAppPublishedHostUpdateProofError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DesenAppPublishedHostUpdateProofError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details = {}) {
  throw new DesenAppPublishedHostUpdateProofError(code, message, details);
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
    utilTypes.isProxy(value) ||
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    fail("OPTIONS_INVALID", `${label} must be one inert own-data object.`);
  }
  const captured = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowedKeys.includes(key) ||
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} contains unsupported authority.`);
    }
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureBytes(value, label) {
  if (utilTypes.isProxy(value) || !utilTypes.isUint8Array(value)) {
    fail("OPTIONS_INVALID", `${label} must be one non-Proxy byte array.`);
  }
  const prototype = Object.getPrototypeOf(value);
  let byteLength;
  let backingBuffer;
  try {
    byteLength = Reflect.apply(BYTE_LENGTH_GETTER, value, []);
    backingBuffer = Reflect.apply(BUFFER_GETTER, value, []);
  } catch {
    fail("OPTIONS_INVALID", `${label} violates the bounded byte authority.`);
  }
  if (
    (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) ||
    Object.getOwnPropertyDescriptor(value, "buffer") !== undefined ||
    Object.getOwnPropertyDescriptor(value, "byteLength") !== undefined ||
    Object.getOwnPropertyDescriptor(value, "byteOffset") !== undefined ||
    utilTypes.isSharedArrayBuffer(backingBuffer) ||
    byteLength > MAX_AUTHORITY_BYTES
  ) {
    fail("OPTIONS_INVALID", `${label} violates the bounded byte authority.`);
  }
  try {
    const captured = Buffer.alloc(byteLength);
    Reflect.apply(Uint8Array.prototype.set, captured, [value]);
    return captured;
  } catch {
    fail("OPTIONS_INVALID", `${label} violates the bounded byte authority.`);
  }
}

function safeRelativePath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    relativePath.length <= 512 &&
    !relativePath.includes("\0") &&
    !path.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    !relativePath.split("/").includes("..")
  );
}

function captureAbsolutePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 16_384 ||
    value.includes("\0")
  ) {
    fail("OPTIONS_INVALID", `${label} must be one non-empty bounded path string.`);
  }
  return path.resolve(value);
}

function captureOverrides(value) {
  if (value === undefined) return new Map();
  if (
    utilTypes.isProxy(value) ||
    !(value instanceof Map) ||
    Object.getPrototypeOf(value) !== Map.prototype ||
    Reflect.ownKeys(value).length !== 0 ||
    value.size > TRACKED_PATHS.length
  ) {
    fail("OPTIONS_INVALID", "fileOverrides must be one inert bounded Map.");
  }
  const captured = new Map();
  let totalBytes = 0;
  for (const [relativePath, bytes] of Map.prototype.entries.call(value)) {
    if (!TRACKED_PATHS.includes(relativePath)) {
      fail("OPTIONS_INVALID", "fileOverrides contains an untracked path.", { relativePath });
    }
    const capturedBytes = captureBytes(bytes, `fileOverrides[${relativePath}]`);
    totalBytes += capturedBytes.byteLength;
    if (totalBytes > MAX_OVERRIDE_BYTES) {
      fail("OPTIONS_INVALID", "fileOverrides exceeds its aggregate byte budget.");
    }
    captured.set(relativePath, capturedBytes);
  }
  return captured;
}

function captureBuildOptions(rawOptions) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["fileOverrides", "workspaceRoot"],
    "build options",
  );
  return Object.freeze({
    workspaceRoot: captureAbsolutePath(options.workspaceRoot ?? WORKSPACE_ROOT, "workspaceRoot"),
    fileOverrides: captureOverrides(options.fileOverrides),
  });
}

async function readRegularAuthority(absolutePath, relativePath) {
  let handle;
  try {
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority is not one bounded regular file: ${relativePath}.`);
    }
    const canonical = await realpath(absolutePath);
    if (canonical !== absolutePath) {
      fail("AUTHORITY_UNSAFE", `Authority resolves through a linked path: ${relativePath}.`);
    }
    handle = await open(absolutePath, READ_FLAGS);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== metadata.size || opened.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority changed during acquisition: ${relativePath}.`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Could not read evidence authority: ${relativePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function inventoryDirectory(workspaceRoot, relativeDirectory) {
  const root = path.join(workspaceRoot, relativeDirectory);
  const canonical = await realpath(root).catch(() => undefined);
  if (canonical !== root) {
    fail("SOURCE_INVENTORY_DRIFT", `${relativeDirectory} must be one canonical directory.`);
  }
  const collected = [];
  async function visit(absoluteDirectory) {
    let directory;
    try {
      directory = await opendir(absoluteDirectory);
      for await (const entry of directory) {
        const absolute = path.join(absoluteDirectory, entry.name);
        if (entry.isSymbolicLink()) {
          fail("SOURCE_INVENTORY_DRIFT", "Production source cannot contain a symbolic link.");
        }
        if (entry.isDirectory()) await visit(absolute);
        else if (entry.isFile()) {
          collected.push(path.relative(workspaceRoot, absolute).replaceAll(path.sep, "/"));
        } else {
          fail("SOURCE_INVENTORY_DRIFT", "Production source contains an unsupported entry.");
        }
        if (collected.length > 256) {
          fail("SOURCE_INVENTORY_DRIFT", "Production source inventory exceeds its fixed bound.");
        }
      }
    } finally {
      await directory?.close().catch(() => undefined);
    }
  }
  await visit(root);
  return Object.freeze(collected.sort((left, right) => left.localeCompare(right, "en-US")));
}

async function acquireFiles(options) {
  const canonicalRoot = await realpath(options.workspaceRoot);
  if (canonicalRoot !== options.workspaceRoot) {
    fail("AUTHORITY_UNSAFE", "workspaceRoot must be its canonical non-symbolic path.");
  }
  const [appInventory, hostInventory, hostServerInventory] = await Promise.all([
    inventoryDirectory(canonicalRoot, "apps/desen-app/src"),
    inventoryDirectory(canonicalRoot, "apps/reference-host-web/src"),
    inventoryDirectory(canonicalRoot, "apps/reference-host-web-server/src"),
  ]);
  if (
    !isDeepStrictEqual(appInventory, APP_SOURCE_PATHS) ||
    !isDeepStrictEqual(hostInventory, HOST_SOURCE_PATHS) ||
    !isDeepStrictEqual(hostServerInventory, HOST_SERVER_SOURCE_PATHS)
  ) {
    fail("SOURCE_INVENTORY_DRIFT", "The complete App or reference-host source inventory drifted.", {
      appInventory,
      hostInventory,
      hostServerInventory,
    });
  }
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      options.fileOverrides.get(relativePath) ??
        (await readRegularAuthority(path.join(canonicalRoot, relativePath), relativePath)),
    );
  }
  return Object.freeze({ files, appInventory, hostInventory, hostServerInventory });
}

function decodeUtf8(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code, `${relativePath} is not valid UTF-8.`);
  }
}

function parseJson(bytes, relativePath, code = "SOURCE_POLICY_VIOLATION") {
  try {
    return JSON.parse(decodeUtf8(bytes, relativePath, code));
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail(code, `${relativePath} is not valid JSON.`);
  }
}

function exactJsonKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    isDeepStrictEqual(Object.keys(value), expectedKeys) &&
    Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return (
        typeof key === "string" &&
        descriptor !== undefined &&
        descriptor.enumerable &&
        descriptor.configurable &&
        descriptor.writable &&
        "value" in descriptor
      );
    })
  );
}

function occurrenceCount(source, fragment) {
  return source.split(fragment).length - 1;
}

function requireFragments(source, fragments, label, code = "SOURCE_POLICY_VIOLATION") {
  const missing = fragments.filter((fragment) => !source.includes(fragment));
  if (missing.length > 0) fail(code, `${label} lost required M10-T05 authority.`, { missing });
}

function requireUniqueFragment(source, fragment, label, code = "SOURCE_POLICY_VIOLATION") {
  if (occurrenceCount(source, fragment) !== 1) {
    fail(code, `${label} lost one exact unique M10-T05 authority.`, { fragment });
  }
}

function forbidFragments(source, fragments, label, code = "SOURCE_POLICY_VIOLATION") {
  const present = fragments.filter((fragment) => source.includes(fragment));
  if (present.length > 0) fail(code, `${label} acquired authority outside M10-T05.`, { present });
}

function captureBrowserTestCallbackSource(source) {
  const sourceFile = ts.createSourceFile(
    BROWSER_PATHS.spec,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    fail("BROWSER_POLICY_VIOLATION", "The M10-T05 Chromium scenario is not valid TypeScript.");
  }
  const callbacks = [];
  let suiteBypass;
  const captureTestPropertyPath = (expression) => {
    const names = [];
    let cursor = expression;
    while (ts.isPropertyAccessExpression(cursor)) {
      names.unshift(cursor.name.text);
      cursor = cursor.expression;
    }
    return ts.isIdentifier(cursor) && cursor.text === "test" ? names : undefined;
  };
  const visitCalls = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const testPropertyPath = captureTestPropertyPath(node.expression);
      if (
        testPropertyPath !== undefined &&
        !(testPropertyPath.length === 1 && testPropertyPath[0] === "info")
      ) {
        suiteBypass = `test.${testPropertyPath.join(".")}`;
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "test" &&
      node.arguments.length === 2 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === BROWSER_TEST_NAME &&
      (ts.isArrowFunction(node.arguments[1]) || ts.isFunctionExpression(node.arguments[1])) &&
      ts.isBlock(node.arguments[1].body)
    ) {
      callbacks.push(node.arguments[1]);
    }
    ts.forEachChild(node, visitCalls);
  };
  visitCalls(sourceFile);
  if (suiteBypass !== undefined) {
    fail(
      "BROWSER_POLICY_VIOLATION",
      "The M10-T05 Chromium scenario may not be skipped, fixed-me, or expected to fail.",
      { bypass: suiteBypass },
    );
  }
  if (callbacks.length !== 1) {
    fail(
      "BROWSER_POLICY_VIOLATION",
      "M10-T05 requires one exact executable Chromium test callback.",
    );
  }
  const callback = callbacks[0];
  let bypass;
  const visitCallback = (node) => {
    if (
      node !== callback &&
      (ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node))
    ) {
      return;
    }
    if (ts.isReturnStatement(node)) bypass = "return";
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "test" &&
      ["skip", "fixme", "fail"].includes(node.expression.name.text)
    ) {
      bypass = `test.${node.expression.name.text}`;
    }
    ts.forEachChild(node, visitCallback);
  };
  visitCallback(callback.body);
  if (bypass !== undefined) {
    fail(
      "BROWSER_POLICY_VIOLATION",
      "The M10-T05 Chromium callback may not return early or conditionally bypass execution.",
      { bypass },
    );
  }
  return Object.freeze({
    bodySource: callback.body.getText(sourceFile),
    topLevelStatements: Object.freeze(
      callback.body.statements.map((statement) => statement.getText(sourceFile).trim()),
    ),
  });
}

function authenticatePinnedArtifact(bytes, pin, predicate, label) {
  if (bytes.byteLength !== pin.bytes || sha256(bytes) !== pin.sha256) {
    fail("PARENT_DRIFT", `The exact immutable ${label} artifact drifted.`);
  }
  const artifact = parseJson(bytes, pin.path, "PARENT_DRIFT");
  if (!predicate(artifact)) {
    fail("PARENT_DRIFT", `The immutable ${label} schema or claim drifted.`);
  }
  return Object.freeze({ summary: { ...pin }, artifact: deepFreeze(artifact) });
}

function authenticateParents(files) {
  const t04 = authenticatePinnedArtifact(
    files.get(T04_ARTIFACT_PATH),
    DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
    (artifact) =>
      artifact?.schemaVersion === 1 &&
      artifact.task === "M10-T04" &&
      artifact.gate === null &&
      artifact.proofId === "desen-app-success-host-operation" &&
      artifact.profile === "desen.app.success-host-operation-proof.v1" &&
      artifact.result === "PASS" &&
      artifact.claim?.m10T04Closed === true &&
      artifact.claim?.actualLocalHttpHostOperation === true &&
      artifact.claim?.runSourceGenerationAndBytesUnchanged === true &&
      artifact.boundary?.trackedFiles === 51,
    "M10-T04",
  );
  const t14 = authenticatePinnedArtifact(
    files.get(T14_ARTIFACT_PATH),
    DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN,
    (artifact) =>
      artifact?.schemaVersion === 1 &&
      artifact.task === "M09-T14" &&
      artifact.gate === "G09" &&
      artifact.proofId === "desen-app-publish-activation" &&
      artifact.profile === "desen.app.publish-activation-proof.v1" &&
      artifact.result === "PASS" &&
      artifact.claim?.savedAuthoredSourceOnly === true &&
      artifact.claim?.publisherRerunFromSavedSource === true &&
      artifact.claim?.activeRevisionRequiresReferenceHostReceipt === true &&
      artifact.claim?.realPublicControlPlaneAndReferenceHostIntegration === true,
    "M09-T14",
  );
  const hostAudit = authenticatePinnedArtifact(
    files.get(HOST_AUDIT_ARTIFACT_PATH),
    DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN,
    (artifact) =>
      artifact?.schemaVersion === 1 &&
      artifact.task === "M05-T09" &&
      artifact.profile === "desen-reference-host-web-source-audit-v1" &&
      artifact.result === "PASS" &&
      artifact.claim?.directOrHiddenHandwrittenManagedTreesRejected === true &&
      artifact.claim?.publicReferenceReactAdaptersReached === true &&
      artifact.claim?.publicRuntimeReactRenderPlanReached === true &&
      artifact.claim?.p07Status === "PARTIAL" &&
      artifact.runtimeResolution?.observer === "moduleParsed",
    "M05-T09",
  );
  const appCanvas = authenticatePinnedArtifact(
    files.get(APP_CANVAS_ARTIFACT_PATH),
    DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN,
    (artifact) =>
      artifact?.schemaVersion === 1 &&
      artifact.task === "M09-T03" &&
      artifact.proofId === "desen-app-real-adapter-canvas" &&
      artifact.profile === "desen.app.real-adapter-canvas-proof.v1" &&
      artifact.result === "PASS" &&
      artifact.claim?.exactPublicReferenceAdapterRegistryUsed === true &&
      artifact.claim?.exactPublicRuntimeReactRendererUsed === true &&
      artifact.claim?.managedCompositionRegistryOnly === true &&
      artifact.claim?.p07Status === "PARTIAL",
    "M09-T03",
  );
  return Object.freeze({ t04, t14, hostAudit, appCanvas });
}

function authenticateHistoricalReaderBridge(compressedBytes, parentArtifact) {
  const pin = DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN;
  if (
    compressedBytes.byteLength !== pin.bytes ||
    compressedBytes.byteLength > MAX_HISTORICAL_BRIDGE_BYTES ||
    sha256(compressedBytes) !== pin.sha256
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The exact compressed T04 historical bridge drifted.");
  }
  if (cachedHistoricalBridgeAuthority !== undefined) {
    if (!isDeepStrictEqual(cachedHistoricalBridgeAuthority.projection, parentArtifact)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The cached T04 projection differs from its parent.");
    }
    return cachedHistoricalBridgeAuthority;
  }
  let inflated;
  try {
    inflated = gunzipSync(compressedBytes, {
      maxOutputLength: MAX_HISTORICAL_BRIDGE_INFLATED_BYTES,
    });
  } catch (error) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 bridge is not bounded gzip.", {
      cause: String(error),
    });
  }
  if (inflated.byteLength !== pin.uncompressedBytes) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 bridge inflated size drifted.");
  }
  let manifest;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(inflated);
    manifest = JSON.parse(source);
    if (!Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8").equals(inflated)) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The T04 bridge is not canonical dense JSON.");
    }
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 bridge JSON is invalid.", {
      cause: String(error),
    });
  }
  const projectionKeys = ["desen-app-success-host-operation"];
  if (
    !exactJsonKeys(manifest, [
      "schemaVersion",
      "profile",
      "baseCommit",
      "successorAddedPaths",
      "predecessorGapFiles",
      "files",
      "projections",
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.profile !== "desen.app.m10-t04-historical-reader-bridge.v1" ||
    manifest.baseCommit !== pin.baseCommit ||
    !isDeepStrictEqual(manifest.successorAddedPaths, SUCCESSOR_ADDED_PATHS) ||
    !exactJsonKeys(
      manifest.predecessorGapFiles,
      T04_PREDECESSOR_GAP_RECEIPTS.map(({ path: relativePath }) => relativePath),
    ) ||
    Object.keys(manifest.predecessorGapFiles).length !== pin.predecessorGapFiles ||
    !exactJsonKeys(manifest.files, Object.keys(manifest.files)) ||
    Object.keys(manifest.files).length !== pin.fileEntries ||
    !exactJsonKeys(manifest.projections, projectionKeys) ||
    !isDeepStrictEqual(manifest.projections[projectionKeys[0]], parentArtifact)
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 bridge identity or parent projection drifted.");
  }
  const receipts = parentArtifact.boundary?.trackedReceipts;
  if (!Array.isArray(receipts) || receipts.length !== pin.fileEntries) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 projection lost its exact receipt inventory.");
  }
  const entries = Object.entries(manifest.files);
  const encodedPaths = entries.map(([relativePath]) => relativePath);
  const expectedPaths = receipts
    .map(({ path: relativePath }) => relativePath)
    .sort((left, right) => left.localeCompare(right, "en-US"));
  if (
    !isDeepStrictEqual(encodedPaths, expectedPaths) ||
    new Set(encodedPaths).size !== encodedPaths.length ||
    !isDeepStrictEqual(
      encodedPaths,
      [...encodedPaths].sort((left, right) => left.localeCompare(right, "en-US")),
    )
  ) {
    fail("HISTORICAL_BRIDGE_DRIFT", "The T04 task-time file manifest is not canonical.");
  }
  const files = new Map();
  let decodedBytes = 0;
  for (const [relativePath, encoded] of entries) {
    if (
      !safeRelativePath(relativePath) ||
      typeof encoded !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
    ) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The T04 task-time file entry is malformed.");
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded || bytes.byteLength > MAX_AUTHORITY_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", `Invalid T04 task-time file: ${relativePath}.`);
    }
    decodedBytes += bytes.byteLength;
    if (decodedBytes > MAX_HISTORICAL_DECODED_BYTES) {
      fail("HISTORICAL_BRIDGE_DRIFT", "The decoded T04 file authority exceeds its bound.");
    }
    files.set(relativePath, bytes);
  }
  const predecessorGapFiles = new Map();
  for (const receipt of T04_PREDECESSOR_GAP_RECEIPTS) {
    const encoded = manifest.predecessorGapFiles[receipt.path];
    if (
      typeof encoded !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
    ) {
      fail("HISTORICAL_BRIDGE_DRIFT", `Malformed T04 predecessor gap: ${receipt.path}.`);
    }
    const bytes = Buffer.from(encoded, "base64");
    decodedBytes += bytes.byteLength;
    if (
      bytes.toString("base64") !== encoded ||
      bytes.byteLength !== receipt.bytes ||
      sha256(bytes) !== receipt.sha256 ||
      decodedBytes > MAX_HISTORICAL_DECODED_BYTES
    ) {
      fail("HISTORICAL_BRIDGE_DRIFT", `T04 predecessor gap drifted: ${receipt.path}.`);
    }
    predecessorGapFiles.set(receipt.path, bytes);
  }
  let amendmentCount = 0;
  for (const receipt of receipts) {
    const bytes = files.get(receipt.path);
    const exact = bytes?.byteLength === receipt.bytes && sha256(bytes) === receipt.sha256;
    const amended =
      bytes !== undefined &&
      APPROVED_AR_01_RECEIPT_PATHS.includes(receipt.path) &&
      matchesAmendedHistoricalReceipt(receipt, bytes);
    if (!exact && !amended) {
      fail("HISTORICAL_BRIDGE_DRIFT", `The exact T04 task-time receipt drifted: ${receipt.path}.`);
    }
    if (amended) amendmentCount += 1;
  }
  if (amendmentCount !== APPROVED_AR_01_RECEIPT_PATHS.length) {
    fail(
      "HISTORICAL_BRIDGE_DRIFT",
      "The T04 bridge does not contain exactly two AR-01 amendments.",
    );
  }
  cachedHistoricalBridgeAuthority = Object.freeze({
    files,
    predecessorGapFiles,
    projection: deepFreeze(manifest.projections[projectionKeys[0]]),
    successorAddedPaths: new Set(manifest.successorAddedPaths),
    summary: deepFreeze({
      ...pin,
      profile: manifest.profile,
      canonicalDenseManifest: true,
      boundedGzip: true,
      parentProjectionAuthenticated: true,
      cleanAr01Base: true,
      approvedAr01ReceiptAmendments: amendmentCount,
    }),
  });
  return cachedHistoricalBridgeAuthority;
}

/** Verifies the fixed-destination publication composition without executing product code. */
export function verifyDesenAppPublishedHostUpdateSourcePolicy(rawInput) {
  const input = exactOwnDataOptions(
    rawInput,
    Object.keys(SOURCE_POLICY_PATHS),
    "source-policy input",
  );
  const source = Object.create(null);
  for (const key of Object.keys(SOURCE_POLICY_PATHS)) {
    if (typeof input[key] !== "string" || input[key].length > MAX_AUTHORITY_BYTES) {
      fail("OPTIONS_INVALID", `source-policy input.${key} must be one bounded string.`);
    }
    source[key] = input[key];
  }

  requireFragments(
    source.runtimePublication,
    [
      'export const DESEN_APP_LOCAL_PUBLICATION_PROFILE = "desen.app.local-publication.v1"',
      'const ACTIVATION_PATH = "/v1/activate-published-revision";',
      "captureDesenAppLocalPublicationConfig(",
      "activationOrigin === controlPlaneOrigin",
      "activationToken === controlPlaneToken",
      'request.redirect !== "error"',
      'credentials: "omit"',
      "FETCH_TIMEOUT_MILLISECONDS",
      "MAX_BUNDLE_REQUEST_BYTES",
      "MAX_CHANNEL_RESPONSE_BYTES",
      "MAX_ACTIVATION_RESPONSE_BYTES",
      "MAX_RESPONSE_CHUNKS",
      "declaredLength !== length",
      "Promise.race([request, deadline])",
      "createLocalDesenBundleChannelPublicationPort({",
      "createFixedDestinationAuthoringPublicationPort({",
      "channelName: config.destination.channelName",
      "hostId: config.destination.hostId",
      "activatePublishedRevision(config, browserFetch, request)",
      "active.activeRevision !== request.revision",
      'Object.freeze({ status: "indeterminate" as const })',
    ],
    SOURCE_POLICY_PATHS.runtimePublication,
  );
  forbidFragments(
    source.runtimePublication,
    [
      "document.cookie",
      "localStorage",
      "sessionStorage",
      'credentials: "include"',
      "window.location",
      "eval(",
      "new Function(",
    ],
    SOURCE_POLICY_PATHS.runtimePublication,
  );
  requireUniqueFragment(
    source.runtimePublication,
    [
      "    config?.profile !== DESEN_APP_LOCAL_PUBLICATION_PROFILE ||",
      "    controlPlaneOrigin === undefined ||",
    ].join("\n"),
    SOURCE_POLICY_PATHS.runtimePublication,
  );
  const activationRequestBlock = [
    "    const result = await browserRequest(",
    "      browserFetch,",
    "      `${config.activation.origin}${ACTIVATION_PATH}`,",
    "      {",
    '        method: "POST",',
    "        headers: {",
    "          authorization: `Bearer ${config.activation.apiToken}`,",
    '          "content-type": "application/json",',
  ].join("\n");
  requireUniqueFragment(
    source.runtimePublication,
    activationRequestBlock,
    SOURCE_POLICY_PATHS.runtimePublication,
  );
  if (occurrenceCount(source.runtimePublication, "ACTIVATION_PATH") !== 2) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "The local activation client lost its single fixed endpoint use.",
    );
  }
  const channelPublicationBlock = [
    "  const channelPort = createLocalDesenBundleChannelPublicationPort({",
    "    origin: config.controlPlane.origin,",
    "    apiToken: config.controlPlane.apiToken,",
    "    channelName: config.destination.channelName,",
    "    fetch: createChannelFetch(config, browserFetch),",
    "  });",
  ].join("\n");
  requireUniqueFragment(
    source.runtimePublication,
    channelPublicationBlock,
    SOURCE_POLICY_PATHS.runtimePublication,
  );
  const fixedDestinationBlock = [
    "  return createFixedDestinationAuthoringPublicationPort({",
    "    channelName: config.destination.channelName,",
    "    hostId: config.destination.hostId,",
    "    publishBundleToChannel: channelPort.publishBundleToChannel,",
    "    activatePublishedRevision: (request) =>",
    "      activatePublishedRevision(config, browserFetch, request),",
    "  });",
  ].join("\n");
  requireUniqueFragment(
    source.runtimePublication,
    fixedDestinationBlock,
    SOURCE_POLICY_PATHS.runtimePublication,
  );

  requireFragments(
    source.main,
    [
      'from "./local-runtime-publication.js"',
      "let publicationPort: AuthoringPublicationPort | null = null;",
      "createInjectedDesenAppLocalPublicationPort(",
      "globalThis.fetch.bind(globalThis)",
      "publicationPort={publicationPort}",
      "Publication is an independent optional authority.",
    ],
    SOURCE_POLICY_PATHS.main,
  );
  if (occurrenceCount(source.main, "publicationPort={publicationPort}") !== 1) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Only the fixed account workspace may receive local publication authority.",
    );
  }
  requireUniqueFragment(
    source.main,
    [
      "            <DesenAppProduct",
      "              persistencePort={persistencePort}",
      "              publicationPort={publicationPort}",
      "              workspaceProfile={REFERENCE_SIGN_IN_WORKSPACE_PROFILE}",
      "            />",
    ].join("\n"),
    SOURCE_POLICY_PATHS.main,
  );
  requireUniqueFragment(
    source.main,
    [
      "            <DesenAppProduct",
      "              integrationBinding={flowIntegration}",
      "              persistencePort={persistencePort}",
      "              workspaceProfile={REFERENCE_FLOW_WORKSPACE_PROFILE}",
      "            />",
    ].join("\n"),
    SOURCE_POLICY_PATHS.main,
  );
  requireFragments(
    source.productBootstrap,
    [
      "readonly publicationPort?: AuthoringPublicationPort | null;",
      "publicationPort = null",
      "publicationPort={publicationPort}",
      "workspaceProfile={workspaceProfile}",
    ],
    SOURCE_POLICY_PATHS.productBootstrap,
  );

  requireFragments(
    source.publicationHost,
    [
      'import { timingSafeEqual } from "node:crypto";',
      'const LOOPBACK = "127.0.0.1";',
      'const ENDPOINT = "/v1/activate-published-revision";',
      "MAX_REQUEST_BYTES",
      "MAX_REQUEST_CHUNKS",
      "REQUEST_TIMEOUT_MILLISECONDS",
      "request.headers.host !== `${LOOPBACK}:${listener.port}`",
      "request.headers.cookie !== undefined",
      "uniqueRequestHeaders(request)",
      "timingSafeEqual(candidate, expected)",
      'request.headers["content-encoding"] !== undefined',
      "captureActivationRequest(bodyResult.body)",
      "activationRequest.channelName !== channelName",
      "activationRequest.hostId !== hostId",
      "captureActivationSettlement(rawSettlement) ?? INDETERMINATE",
      "server.maxConnections = 32",
      "server.maxRequestsPerSocket = 1",
      "server.closeAllConnections()",
      "expectedAuthorization.fill(0)",
      "return Object.freeze({ listen, close });",
    ],
    SOURCE_POLICY_PATHS.publicationHost,
  );
  forbidFragments(
    source.publicationHost,
    ['host: "0.0.0.0"', "console.log", "console.error", "process.env", "set-cookie"],
    SOURCE_POLICY_PATHS.publicationHost,
  );
  requireUniqueFragment(
    source.publicationHost,
    "      server.listen({ host: LOOPBACK, port: 0, exclusive: true }, () => {",
    SOURCE_POLICY_PATHS.publicationHost,
  );
  requireUniqueFragment(
    source.publicationHost,
    [
      "    listenPromise ??= new Promise((resolve, reject) => {",
      "      const onError = () => reject(new DesenAppLocalPublicationHostError());",
      '      server.once("error", onError);',
      "      server.listen({ host: LOOPBACK, port: 0, exclusive: true }, () => {",
    ].join("\n"),
    SOURCE_POLICY_PATHS.publicationHost,
  );
  requireUniqueFragment(
    source.publicationHost,
    [
      "    closePromise ??= (async () => {",
      "      await listenPromise?.catch(() => undefined);",
      "      try {",
      "        if (!server.listening) return;",
    ].join("\n"),
    SOURCE_POLICY_PATHS.publicationHost,
  );
  const credentialCleanupBlock = [
    "      } finally {",
    "        listener = undefined;",
    "        expectedAuthorization.fill(0);",
    "      }",
    "    })();",
    "    return closePromise;",
  ].join("\n");
  requireUniqueFragment(
    source.publicationHost,
    credentialCleanupBlock,
    SOURCE_POLICY_PATHS.publicationHost,
  );

  requireFragments(
    source.localDevHost,
    [
      'from "@desen/reference-host-web-server"',
      'from "./local-publication-host.mjs"',
      'export const DESEN_APP_LOCAL_PUBLICATION_DEFINE_NAME = "__DESEN_APP_LOCAL_PUBLICATION_CONFIG__";',
      "createDesenAppLocalPublicationDefine(",
      "controlPlaneOrigin === activationOrigin",
      "controlPlaneApiToken === activationApiToken",
      "await buildReferenceHost({",
      "configFile: false",
      "await openReferenceHost({",
      "publicationHost = await openPublicationHost({",
      "activeReferenceHost.activatePublishedRevision({",
      "publication.channelName",
      "publication.hostId",
      "await publicationHost.close()",
      "await referenceHost.close()",
    ],
    SOURCE_POLICY_PATHS.localDevHost,
  );

  requireFragments(
    source.referenceServer,
    [
      "ReferenceHostPublishedRevisionActivationRequest",
      "ReferenceHostPublishedRevisionActivationSettlement",
      "capturePublishedRevisionActivationRequest(requestValue, captured.channelName)",
      "readPublicationChannel(controlPlaneClient)",
      "channelMatchesPublishedRevision(channelBeforeRefresh, request)",
      "refresh = await activeController.refresh()",
      "channelMatchesPublishedRevision(channelAfterRefresh, request)",
      "activeRevision !== request.revision",
      'status: "active"',
      "activationGeneration",
    ],
    SOURCE_POLICY_PATHS.referenceServer,
  );
  requireFragments(
    source.referenceServerIndex,
    [
      "openReferenceHostWebServer",
      "ReferenceHostPublishedRevisionActivationRequest",
      "ReferenceHostPublishedRevisionActivationSettlement",
    ],
    SOURCE_POLICY_PATHS.referenceServerIndex,
  );
  forbidFragments(
    source.referenceServer,
    ["eval(", "new Function(", "localStorage"],
    SOURCE_POLICY_PATHS.referenceServer,
  );
  const channelBeforeRead =
    "const channelBeforeRefresh = await readPublicationChannel(controlPlaneClient);";
  const channelBeforeMatch = "channelMatchesPublishedRevision(channelBeforeRefresh, request)";
  const refreshCall = "refresh = await activeController.refresh()";
  const channelAfterRead =
    "const channelAfterRefresh = await readPublicationChannel(controlPlaneClient);";
  const channelAfterMatch = "channelMatchesPublishedRevision(channelAfterRefresh, request)";
  for (const fragment of [
    channelBeforeRead,
    channelBeforeMatch,
    refreshCall,
    channelAfterRead,
    channelAfterMatch,
  ]) {
    requireUniqueFragment(source.referenceServer, fragment, SOURCE_POLICY_PATHS.referenceServer);
  }
  const channelActivationOrder = [
    source.referenceServer.indexOf(channelBeforeRead),
    source.referenceServer.indexOf(channelBeforeMatch),
    source.referenceServer.indexOf(refreshCall),
    source.referenceServer.indexOf(channelAfterRead),
    source.referenceServer.indexOf(channelAfterMatch),
  ];
  if (
    channelActivationOrder.some(
      (index, position) => position > 0 && index <= channelActivationOrder[position - 1],
    )
  ) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Reference-host activation must prove pre-refresh identity, refresh, and independently re-read the exact identity.",
    );
  }

  return deepFreeze({
    exactInjectedProfile: true,
    independentControlPlaneAndActivationAuthorities: true,
    fixedChannelAndHostDestination: true,
    sourceCannotSelectEndpointHandlerCredentialOrHostModule: true,
    browserCredentialsOmitted: true,
    boundedBrowserTransport: true,
    exactActivationRevisionRequired: true,
    normalProductBootstrapReceivesOptionalPort: true,
    flowWorkspaceCannotReceivePublicationPort: true,
    serverOwnsChannelRereadAndActivation: true,
    activationBridgeStrictAndLoopbackOnly: true,
    callbackSettlementClosedAndRedacted: true,
    lifecycleIdempotentAndCredentialsZeroed: true,
  });
}

function verifyFocusedTests(files) {
  const sources = Object.fromEntries(
    Object.entries(TEST_PATHS).map(([key, relativePath]) => [
      key,
      decodeUtf8(files.get(relativePath), relativePath, "TEST_POLICY_VIOLATION"),
    ]),
  );
  const required = {
    runtimePublication: [
      'describe("Desen App local publication composition"',
      "captures only the exact profile as a detached recursively frozen configuration",
      "publishes and activates through the exact secured four-request browser sequence",
      "rejects per-request destination substitution before either transport is invoked",
      "treats an active response for another revision as indeterminate",
      "maps network loss according to whether an effect may already have committed",
      "contains oversized and malformed channel or activation responses",
      "bounds response fragmentation and settles even when an injected fetch ignores abort",
      "requires an explicit fetch and never falls back to ambient or absent injected authority",
    ],
    publicationHost: [
      'describe("local publication activation HTTP host"',
      "projects one exact successful fixed-destination activation over real HTTP",
      "accepts reordered closed request JSON and rejects a wrong destination before callback",
      "rejects malformed, duplicated, encoded, or nonclosed activation JSON",
      "denies requests outside exact origin, bearer, and cookie-free authority",
      "authorizes only the exact preflight without exposing credentialed CORS",
      "bounds a chunked request body before invoking the activation callback",
      "projects invalid, accessor-backed, and thrown callback outcomes to indeterminate",
      "rejects malformed trusted options without invoking accessors or retaining private values",
      "reuses listen(0), closes idle sockets, and revokes authority exactly once",
    ],
    localDevHost: [
      "publication",
      "referenceHostOrigin",
      "openPublicationHost",
      "openReferenceHost",
      "buildReferenceHost",
    ],
    productBootstrap: ["publicationPort", "DesenAppProduct"],
    mainLifecycle: [
      "createInjectedDesenAppLocalPublicationPort",
      "normalizes the root and mounts the empty durable product workspace",
      "keeps the durable product available when independent publication configuration is rejected",
      "private-publication-configuration-detail",
    ],
    referenceServer: [
      "activates one exact published channel identity through the server's single controller",
      "rejects malformed or mismatched publication identities without activating a candidate",
      "never reports Active when the host preserves a different last-known-good revision",
      "fails closed before refresh when unavailable and after the server lifetime closes",
    ],
    referenceServerTypes: ["activatePublishedRevision", "ReferenceHostWebServer"],
  };
  for (const [key, fragments] of Object.entries(required)) {
    requireFragments(sources[key], fragments, TEST_PATHS[key], "TEST_POLICY_VIOLATION");
  }
  const declarationSites = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      key === "referenceServerTypes"
        ? (source.match(/@ts-expect-error M10-T05-N\d+/gu)?.length ?? 0)
        : (source.match(/\b(?:it|test)(?:\.each)?\(/gu)?.length ?? 0),
    ]),
  );
  if (Object.values(declarationSites).some((count) => count < 1)) {
    fail(
      "TEST_POLICY_VIOLATION",
      "Every focused M10-T05 runtime suite or compile-time negative fixture needs declarations.",
    );
  }
  return deepFreeze({
    declarationSites,
    totalDeclarationSites: Object.values(declarationSites).reduce((sum, count) => sum + count, 0),
    declarationSitesAreNotExpandedExecutionCount: true,
    fixedDestinationAndCredentialNegatives: true,
    callbackSettlementAndLifecycleNegatives: true,
    channelRaceAndClosedHostNegatives: true,
    normalProductInjectionCovered: true,
  });
}

/** Verifies the visible Chromium journey/config identity without starting Chromium. */
export function verifyDesenAppPublishedHostUpdateBrowserPolicy(rawInput) {
  const input = exactOwnDataOptions(rawInput, ["config", "server", "spec"], "browser-policy input");
  for (const key of ["config", "server", "spec"]) {
    if (typeof input[key] !== "string" || input[key].length > MAX_AUTHORITY_BYTES) {
      fail("OPTIONS_INVALID", `browser-policy input.${key} must be one bounded string.`);
    }
  }
  const callbackAuthority = captureBrowserTestCallbackSource(input.spec);
  const callbackSource = callbackAuthority.bodySource;
  requireFragments(
    input.spec,
    [
      `test("${BROWSER_TEST_NAME}"`,
      'const HOST_ORIGIN = "http://127.0.0.1:4178";',
      'const BASELINE_LABEL = "Draft checkout";',
      'const UPDATED_LABEL = "Ready to continue";',
      'const STABLE_LABEL = "Your details stay private";',
      "const buildBefore = await hostBuildFingerprint(request);",
      'expect(assets.some((asset) => asset.endsWith(".js"))).toBe(true);',
      'expect(assets.some((asset) => asset.endsWith(".css"))).toBe(true);',
      'await page.goto("/")',
      'name: "New project"',
      'name: "Create project"',
      "await setText(page, BASELINE_LABEL)",
      "await setText(page, STABLE_LABEL)",
      "await save(page, 2)",
      "const baselineReceipt = await publish(page);",
      'expect(baselineReceipt.Source).toBe("g2")',
      'expect(baselineReceipt.Channel).toBe("g1")',
      "await host.reload()",
      "const baselineDistance = await verticalDistance(host);",
      "await setText(page, UPDATED_LABEL)",
      '.selectOption({ label: "xl" })',
      "await save(page, 3)",
      "const updatedReceipt = await publish(page);",
      'expect(updatedReceipt.Source).toBe("g3")',
      'expect(updatedReceipt.Channel).toBe("g2")',
      "expect(updatedReceipt.RevisionIdentity).not.toBe(baselineReceipt.RevisionIdentity)",
      "expect(updatedDistance).toBeGreaterThan(baselineDistance + 8)",
      "expect(await hostBuildFingerprint(request)).toBe(buildBefore)",
      'await host.screenshot({ path: test.info().outputPath("published-layout-update.png") })',
    ],
    BROWSER_PATHS.spec,
    "BROWSER_POLICY_VIOLATION",
  );
  forbidFragments(
    input.spec,
    [
      "page.evaluate(",
      "page.route(",
      "route.fulfill(",
      "page.addInitScript(",
      "localStorage.",
      "sessionStorage.",
      "request.post(",
      "request.put(",
      "request.patch(",
      "request.delete(",
    ],
    BROWSER_PATHS.spec,
    "BROWSER_POLICY_VIOLATION",
  );
  if ((input.spec.match(/^test\(/gmu)?.length ?? 0) !== 1) {
    fail("BROWSER_POLICY_VIOLATION", "M10-T05 owns exactly one visible Chromium scenario.");
  }
  const finalRevisionReloadBlock = [
    "  await host.reload();",
    "  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();",
    "  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();",
  ].join("\n");
  if (occurrenceCount(input.spec, finalRevisionReloadBlock) !== 1) {
    fail(
      "BROWSER_POLICY_VIOLATION",
      "M10-T05 lost its unique second reload and revision-B persistence observation.",
    );
  }
  const updatedPublicationBlock = [
    "  await openSourceAndRelease(page);",
    "  await save(page, 3);",
    "  const updatedReceipt = await publish(page);",
    '  expect(updatedReceipt.Source).toBe("g3");',
    '  expect(updatedReceipt.Channel).toBe("g2");',
    "  expect(updatedReceipt.RevisionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);",
    "  expect(updatedReceipt.RevisionIdentity).not.toBe(baselineReceipt.RevisionIdentity);",
  ].join("\n");
  const firstUpdatedRevisionObservationBlock = [
    "  await host.reload();",
    "  await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();",
    "  await expect(host.getByText(BASELINE_LABEL, { exact: true })).toHaveCount(0);",
    "  await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();",
    "  const updatedDistance = await verticalDistance(host);",
    "  expect(updatedDistance).toBeGreaterThan(baselineDistance + 8);",
    "  expect(await hostBuildFingerprint(request)).toBe(buildBefore);",
  ].join("\n");
  for (const fragment of [
    updatedPublicationBlock,
    firstUpdatedRevisionObservationBlock,
    finalRevisionReloadBlock,
  ]) {
    requireUniqueFragment(input.spec, fragment, BROWSER_PATHS.spec, "BROWSER_POLICY_VIOLATION");
    if (!callbackSource.includes(fragment)) {
      fail(
        "BROWSER_POLICY_VIOLATION",
        "The required M10-T05 observation escaped the sole Chromium callback.",
      );
    }
  }
  const browserObservationOrder = [
    callbackSource.indexOf(updatedPublicationBlock),
    callbackSource.indexOf(firstUpdatedRevisionObservationBlock),
    callbackSource.indexOf(finalRevisionReloadBlock),
    callbackSource.indexOf(
      'await host.screenshot({ path: test.info().outputPath("published-layout-update.png") })',
    ),
  ];
  if (
    browserObservationOrder.some(
      (index, position) =>
        index < 0 || (position > 0 && index <= browserObservationOrder[position - 1]),
    )
  ) {
    fail(
      "BROWSER_POLICY_VIOLATION",
      "The visible publication-B, activation, persistence, and screenshot observations are out of order.",
    );
  }
  const criticalTopLevelStatements = [
    "await save(page, 3);",
    "const updatedReceipt = await publish(page);",
    'expect(updatedReceipt.Source).toBe("g3");',
    'expect(updatedReceipt.Channel).toBe("g2");',
    "expect(updatedReceipt.RevisionIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);",
    "expect(updatedReceipt.RevisionIdentity).not.toBe(baselineReceipt.RevisionIdentity);",
    "await host.reload();",
    "await expect(host.getByText(UPDATED_LABEL, { exact: true })).toBeVisible();",
    "await expect(host.getByText(BASELINE_LABEL, { exact: true })).toHaveCount(0);",
    "await expect(host.getByText(STABLE_LABEL, { exact: true })).toBeVisible();",
    "const updatedDistance = await verticalDistance(host);",
    "expect(updatedDistance).toBeGreaterThan(baselineDistance + 8);",
    "expect(await hostBuildFingerprint(request)).toBe(buildBefore);",
    'await host.screenshot({ path: test.info().outputPath("published-layout-update.png") });',
  ];
  for (const statement of criticalTopLevelStatements) {
    const totalCount = occurrenceCount(callbackSource, statement);
    const topLevelCount = callbackAuthority.topLevelStatements.filter(
      (candidate) => candidate === statement,
    ).length;
    if (totalCount < 1 || topLevelCount !== totalCount) {
      fail(
        "BROWSER_POLICY_VIOLATION",
        "A critical M10-T05 browser observation is conditional or nested.",
        { statement },
      );
    }
  }
  requireFragments(
    input.config,
    [
      'testMatch: "published-host-update.pw.ts"',
      '...devices["Desktop Chrome"]',
      "fullyParallel: false",
      "workers: 1",
      "retries: 0",
      'projects: [{ name: "published-host-update-chromium" }]',
      "published-host-proof-server.mjs",
      "reuseExistingServer: false",
      'trace: "retain-on-failure"',
      'screenshot: "only-on-failure"',
    ],
    BROWSER_PATHS.config,
    "BROWSER_POLICY_VIOLATION",
  );
  requireFragments(
    input.server,
    [
      'import { openLocalControlPlane } from "@desen/control-plane-api";',
      'import { openReferenceHostWebServer } from "@desen/reference-host-web-server";',
      'import { openDesenAppLocalPublicationHost } from "../desen-app/dev/local-publication-host.mjs";',
      "const APP_PORT = 4_177;",
      "const REFERENCE_HOST_PORT = 4_178;",
      'const CHANNEL_NAME = "preview";',
      'const HOST_ID = "reference-host-web";',
      'const controlPlaneToken = randomBytes(32).toString("base64url")',
      'const activationToken = randomBytes(32).toString("base64url")',
      "if (controlPlaneToken === activationToken)",
      "await build({\n    root: REFERENCE_HOST_ROOT",
      "referenceHost = await openReferenceHostWebServer({",
      "activationBridge = await openDesenAppLocalPublicationHost({",
      "referenceHost.activatePublishedRevision({ channelName, channelGeneration, revision })",
      "await build({\n    root: APP_ROOT",
      "__DESEN_APP_LOCAL_PUBLICATION_CONFIG__",
      "root: APP_ROOT",
      "configFile: false",
      "async () => activationBridge?.close()",
      "async () => referenceHost?.close()",
      "async () => controlPlane?.close()",
    ],
    BROWSER_PATHS.server,
    "BROWSER_POLICY_VIOLATION",
  );
  forbidFragments(
    input.server,
    ['host: "0.0.0.0"', "page.evaluate(", "process.env.DESEN", "localStorage", "sessionStorage"],
    BROWSER_PATHS.server,
    "BROWSER_POLICY_VIOLATION",
  );
  const controlPlaneCredentialBlock = [
    "  controlPlane = await openLocalControlPlane({",
    "    rootDirectory: controlPlaneRoot,",
    "    apiToken: controlPlaneToken,",
    "    allowedOrigins: Object.freeze([APP_ORIGIN]),",
    "  });",
  ].join("\n");
  const referenceHostCredentialBlock = [
    "  referenceHost = await openReferenceHostWebServer({",
    "    rootDirectory: controlPlaneRoot,",
    "    installedPackageDirectory: INSTALLED_PACKAGE_ROOT,",
    "    clientBuildDirectory: referenceHostDist,",
    "    controlPlaneOrigin: controlPlaneListener.origin,",
    "    controlPlaneApiToken: controlPlaneToken,",
    "    channelName: CHANNEL_NAME,",
    "  });",
  ].join("\n");
  const activationCredentialBlock = [
    "  activationBridge = await openDesenAppLocalPublicationHost({",
    "    apiToken: activationToken,",
    "    allowedOrigin: APP_ORIGIN,",
    "    channelName: CHANNEL_NAME,",
    "    hostId: HOST_ID,",
  ].join("\n");
  const browserCredentialDefineBlock = [
    "      __DESEN_APP_LOCAL_RUNTIME_CONFIG__: JSON.stringify({",
    '        profile: "desen.app.local-runtime.v1",',
    "        controlPlane: { origin: controlPlaneListener.origin, apiToken: controlPlaneToken },",
    "      }),",
    "      __DESEN_APP_LOCAL_PUBLICATION_CONFIG__: JSON.stringify({",
    '        profile: "desen.app.local-publication.v1",',
    "        controlPlane: { origin: controlPlaneListener.origin, apiToken: controlPlaneToken },",
    "        activation: { origin: activationListener.origin, apiToken: activationToken },",
    "        destination: { channelName: CHANNEL_NAME, hostId: HOST_ID },",
    "      }),",
  ].join("\n");
  for (const fragment of [
    controlPlaneCredentialBlock,
    referenceHostCredentialBlock,
    activationCredentialBlock,
    browserCredentialDefineBlock,
  ]) {
    requireUniqueFragment(input.server, fragment, BROWSER_PATHS.server, "BROWSER_POLICY_VIOLATION");
  }
  return deepFreeze({
    chromiumConfigurations: 1,
    testName: BROWSER_TEST_NAME,
    normalVisibleProductFlow: true,
    visibleSourceGenerationA: 2,
    visibleSourceGenerationB: 3,
    visibleChannelGenerationA: 1,
    visibleChannelGenerationB: 2,
    distinctPublishedBundleRevisions: true,
    labelChangesAcrossActivation: true,
    stackGapChangesAcrossActivation: true,
    hostBuildFingerprintStableAcrossAAndB: true,
    secondReloadPreservesRevisionB: true,
    directDomOrNetworkMutationUsed: false,
    proofOnlyProductRouteUsed: false,
    serverBuildsAppAndHostSeparately: true,
    independentCredentials: true,
    productionDeploymentClaimed: false,
  });
}

function verifyBoundaryAuthority(files) {
  const configurationPath = "dependency-cruiser.config.cjs";
  const verifierPath = "scripts/verify-boundary-fixtures.mjs";
  const configuration = decodeUtf8(
    files.get(configurationPath),
    configurationPath,
    "BOUNDARY_POLICY_VIOLATION",
  );
  const verifier = decodeUtf8(files.get(verifierPath), verifierPath, "BOUNDARY_POLICY_VIOLATION");
  requireFragments(
    configuration,
    [
      'const desenAppLocalPublicationHostPath = "^apps/desen-app/dev/local-publication-host\\\\.mjs$";',
      'const desenAppBrowserPublishedHostProofServerPath =\n  "^apps/desen-app-browser-e2e/published-host-proof-server\\\\.mjs$";',
      'const referenceHostServerPublicBuildEntryPath =\n  "^apps/reference-host-web-server/dist/index\\\\.(?:d\\\\.ts|js)$";',
      'name: "desen-app-browser-e2e-published-server-reference-host-public-root-only"',
      'name: "desen-app-browser-e2e-published-server-has-no-other-application-dependencies"',
      "pathNot: desenAppLocalPublicationHostPath",
    ],
    configurationPath,
    "BOUNDARY_POLICY_VIOLATION",
  );
  const cases = Object.freeze(
    [
      Object.freeze({
        name: "allowed-desen-app-browser-e2e-published-server-reviewed-roots",
        expectedRule: null,
      }),
      Object.freeze({
        name: "desen-app-browser-e2e-published-server-imports-reference-host-private",
        expectedRule: "desen-app-browser-e2e-published-server-reference-host-public-root-only",
      }),
      Object.freeze({
        name: "desen-app-browser-e2e-published-server-imports-unreviewed-dev-module",
        expectedRule:
          "desen-app-browser-e2e-published-server-has-no-other-application-dependencies",
      }),
      Object.freeze({
        name: "desen-app-browser-e2e-non-published-server-imports-local-publication-host",
        expectedRule: "desen-app-browser-e2e-reviewed-app-source-only",
      }),
    ],
    SOURCE_POLICY_PATHS.referenceServer,
  );
  for (const boundaryCase of cases) {
    const marker =
      "name: " +
      JSON.stringify(boundaryCase.name) +
      ",\n    expectedRule: " +
      (boundaryCase.expectedRule === null ? "null" : JSON.stringify(boundaryCase.expectedRule)) +
      ",";
    if (occurrenceCount(verifier, marker) !== 1) {
      fail("BOUNDARY_POLICY_VIOLATION", "A T05 boundary fixture classification drifted.", {
        boundaryCase,
      });
    }
  }
  const fixtureSources = BOUNDARY_FIXTURE_PATHS.map((relativePath) => ({
    path: relativePath,
    source: decodeUtf8(files.get(relativePath), relativePath, "BOUNDARY_POLICY_VIOLATION"),
  }));
  for (const fixture of fixtureSources) {
    forbidFragments(
      fixture.source,
      ["createServer(", ".listen("],
      fixture.path,
      "BOUNDARY_POLICY_VIOLATION",
    );
  }
  requireFragments(
    fixtureSources.find(({ path: relativePath }) =>
      relativePath.endsWith(
        "reviewed-roots/apps/desen-app-browser-e2e/published-host-proof-server.mjs",
      ),
    )?.source ?? "",
    [
      'from "../control-plane-api/dist/index.js"',
      'from "../reference-host-web-server/dist/index.js"',
      'from "../desen-app/dev/local-publication-host.mjs"',
    ],
    "allowed published-host boundary fixture",
    "BOUNDARY_POLICY_VIOLATION",
  );
  return deepFreeze({
    authorityFiles: BOUNDARY_FIXTURE_PATHS.length + 2,
    cases,
    exactPublishedServerImporter: true,
    publicControlPlaneEntryOnly: true,
    publicReferenceHostServerEntryOnly: true,
    exactLocalActivationBridgeOnly: true,
    neighboringDevModulesDenied: true,
    otherBrowserImportersDenied: true,
    inertFixtureFiles: true,
    dependencyCruiserExecutedByVerifier: false,
  });
}

function verifyBridgeReproductionAuthority(files) {
  const generator = decodeUtf8(
    files.get(BRIDGE_REPRODUCTION_PATHS[0]),
    BRIDGE_REPRODUCTION_PATHS[0],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  const fixture = decodeUtf8(
    files.get(BRIDGE_REPRODUCTION_PATHS[1]),
    BRIDGE_REPRODUCTION_PATHS[1],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  requireFragments(
    generator,
    [
      `const EXPECTED_BASE_COMMIT = "${DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.baseCommit}";`,
      'profile: "desen.app.m10-t04-historical-reader-bridge.v1"',
      ...SUCCESSOR_ADDED_PATHS.map((relativePath) => `"${relativePath}"`),
      ...T04_PREDECESSOR_GAP_RECEIPTS.map(({ path: relativePath }) => `"${relativePath}"`),
      "predecessorGapFiles",
      '"desen-app-success-host-operation": parentArtifact',
      "matchesAmendedHistoricalReceipt(receipt, bytes)",
      "gzipSync(bytes, { level: 9, mtime: 0 })",
      '{ flag: "wx" }',
    ],
    BRIDGE_REPRODUCTION_PATHS[0],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  requireFragments(
    fixture,
    [
      "authenticateDesenAppPublishedHostUpdateSuccessor",
      "readDesenAppT04HistoricalReaderTaskTimeFile",
      "createDesenAppT04HistoricalReaderReadFile",
      "DesenAppPublishedHostUpdateProofError",
    ],
    BRIDGE_REPRODUCTION_PATHS[1],
    "HISTORICAL_BRIDGE_DRIFT",
  );
  return deepFreeze({
    exactCleanAr01BaseCommit: true,
    exclusiveDeterministicGzipWrite: true,
    successorAddedPathInventoryExact: true,
    onlyTwoApprovedAr01Amendments: true,
    historicalFixtureUsesBrandedSuccessor: true,
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
    const relative = path.relative(workspaceRoot, base).replaceAll(path.sep, "/");
    if (!relative.startsWith("../") && relative !== "..") {
      const nested = relative.lastIndexOf("/node_modules/");
      const normalized =
        relative.startsWith("node_modules/.pnpm/") && nested !== -1
          ? `node_modules/${relative.slice(nested + 14)}`
          : relative;
      return `${prefix}${normalized}${query}`;
    }
  }
  return `${prefix}${base.replaceAll(path.sep, "/")}${query}`;
}

function outputBytes(output) {
  if (output.type === "chunk") return Buffer.from(output.code, "utf8");
  return typeof output.source === "string"
    ? Buffer.from(output.source, "utf8")
    : Buffer.from(output.source);
}

async function runObservedViteBuild(workspaceRoot, applicationRoot, observerName) {
  const viteModulePath = path.join(
    workspaceRoot,
    "apps/desen-app/node_modules/vite/dist/node/index.js",
  );
  const vite = await import(pathToFileURL(viteModulePath).href);
  if (vite.version !== "8.1.5" || typeof vite.build !== "function") {
    fail("VITE_BUILD_FAILED", "M10-T05 requires the pinned Vite 8.1.5 programmatic API.");
  }
  const observed = [];
  let result;
  try {
    result = await vite.build({
      root: path.join(workspaceRoot, applicationRoot),
      appType: "spa",
      configFile: false,
      envDir: false,
      clearScreen: false,
      logLevel: "silent",
      build: { write: false },
      plugins: [
        {
          name: observerName,
          enforce: "post",
          moduleParsed(moduleInfo) {
            if (
              typeof moduleInfo.code !== "string" ||
              Buffer.byteLength(moduleInfo.code, "utf8") > MAX_AUTHORITY_BYTES
            ) {
              fail("VITE_GRAPH_DRIFT", "Vite exposed missing or oversized transformed code.");
            }
            const code = Buffer.from(moduleInfo.code, "utf8");
            observed.push(
              Object.freeze({
                id: moduleInfo.id,
                imports: Object.freeze([...moduleInfo.importedIds]),
                dynamicImports: Object.freeze([...moduleInfo.dynamicallyImportedIds]),
                codeBytes: code.byteLength,
                codeSha256: `sha256:${sha256(code)}`,
              }),
            );
          },
        },
      ],
    });
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail("VITE_BUILD_FAILED", `The ${applicationRoot} Vite observer build failed.`, {
      cause: String(error),
    });
  }
  const normalized = observed.map((entry) => {
    const queryIndex = entry.id.indexOf("?");
    const rawBase = queryIndex === -1 ? entry.id : entry.id.slice(0, queryIndex);
    return Object.freeze({
      module: deepFreeze({
        id: normalizeGraphId(workspaceRoot, entry.id),
        imports: entry.imports
          .map((id) => normalizeGraphId(workspaceRoot, id))
          .sort((left, right) => left.localeCompare(right, "en-US")),
        dynamicImports: entry.dynamicImports
          .map((id) => normalizeGraphId(workspaceRoot, id))
          .sort((left, right) => left.localeCompare(right, "en-US")),
        codeBytes: entry.codeBytes,
        codeSha256: entry.codeSha256,
      }),
      rawBase,
    });
  });
  const graph = normalized
    .map(({ module }) => module)
    .sort((left, right) => left.id.localeCompare(right.id, "en-US"));
  const backingPaths = [];
  for (const { module, rawBase } of normalized) {
    if (module.id.startsWith("virtual:")) continue;
    if (!path.isAbsolute(rawBase)) {
      fail("VITE_GRAPH_DRIFT", "A non-virtual Vite module has no local backing path.", {
        module: module.id,
      });
    }
    const canonical = await realpath(rawBase).catch(() => undefined);
    if (canonical === undefined || !canonical.startsWith(`${workspaceRoot}${path.sep}`)) {
      fail("VITE_GRAPH_DRIFT", "A Vite graph backing file escapes the workspace.", {
        module: module.id,
      });
    }
    backingPaths.push(path.relative(workspaceRoot, canonical).replaceAll(path.sep, "/"));
  }
  const outputs = (Array.isArray(result) ? result.flatMap(({ output }) => output) : result.output)
    .map((output) => {
      const bytes = outputBytes(output);
      if (bytes.byteLength > MAX_AUTHORITY_BYTES) {
        fail("VITE_BUILD_DRIFT", "A Vite output exceeds the fixed evidence bound.");
      }
      return deepFreeze({
        fileName: output.fileName,
        type: output.type,
        isEntry: output.type === "chunk" ? output.isEntry : null,
        bytes: bytes.byteLength,
        sha256: `sha256:${sha256(bytes)}`,
      });
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName, "en-US"));
  return deepFreeze({
    graph,
    outputs,
    backingPaths: [...new Set(backingPaths)].sort((left, right) =>
      left.localeCompare(right, "en-US"),
    ),
  });
}

function captureDenseStringArray(value, label, maximumEntries = 1_024) {
  if (
    utilTypes.isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded dense Array.`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable ||
    lengthDescriptor.configurable ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value > maximumEntries
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded dense Array.`);
  }
  const length = lengthDescriptor.value;
  const expectedKeys = new Set(["length", ...Array.from({ length }, (_, index) => String(index))]);
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.size ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.has(key))
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded dense Array.`);
  }
  const captured = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0 ||
      descriptor.value.length > 4_096 ||
      descriptor.value.includes("\0")
    ) {
      fail("OPTIONS_INVALID", `${label} contains unsupported authority.`);
    }
    captured.push(descriptor.value);
  }
  return Object.freeze(captured);
}

function captureGraph(rawGraph, label) {
  if (
    utilTypes.isProxy(rawGraph) ||
    !Array.isArray(rawGraph) ||
    Object.getPrototypeOf(rawGraph) !== Array.prototype
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded intrinsic Array.`);
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(rawGraph, "length");
  if (
    lengthDescriptor === undefined ||
    lengthDescriptor.enumerable ||
    lengthDescriptor.configurable ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value === 0 ||
    lengthDescriptor.value > 512
  ) {
    fail("OPTIONS_INVALID", `${label} must be one bounded intrinsic Array.`);
  }
  const length = lengthDescriptor.value;
  const expectedArrayKeys = new Set([
    "length",
    ...Array.from({ length }, (_, index) => String(index)),
  ]);
  const arrayKeys = Reflect.ownKeys(rawGraph);
  if (
    arrayKeys.length !== expectedArrayKeys.size ||
    arrayKeys.some((key) => typeof key !== "string" || !expectedArrayKeys.has(key))
  ) {
    fail("OPTIONS_INVALID", `${label} must be one dense own-data Array.`);
  }

  const captured = [];
  for (let index = 0; index < length; index += 1) {
    const indexDescriptor = Object.getOwnPropertyDescriptor(rawGraph, String(index));
    if (
      indexDescriptor === undefined ||
      !indexDescriptor.enumerable ||
      !("value" in indexDescriptor)
    ) {
      fail("OPTIONS_INVALID", `${label} must be one dense own-data Array.`);
    }
    const entry = indexDescriptor.value;
    if (
      entry === null ||
      typeof entry !== "object" ||
      utilTypes.isProxy(entry) ||
      Array.isArray(entry) ||
      (Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null)
    ) {
      fail("OPTIONS_INVALID", `${label}[${index}] must be one inert object.`);
    }
    const expectedKeys = ["codeBytes", "codeSha256", "dynamicImports", "id", "imports"];
    const entryKeys = Reflect.ownKeys(entry);
    if (
      !isDeepStrictEqual(entryKeys.filter((key) => typeof key === "string").sort(), expectedKeys) ||
      entryKeys.some((key) => typeof key !== "string")
    ) {
      fail("OPTIONS_INVALID", `${label}[${index}] key inventory drifted.`);
    }
    const values = Object.create(null);
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(entry, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        fail("OPTIONS_INVALID", `${label}[${index}] fields must be enumerable own data.`);
      }
      values[key] = descriptor.value;
    }
    if (
      typeof values.id !== "string" ||
      values.id.length === 0 ||
      values.id.length > 4_096 ||
      !Number.isSafeInteger(values.codeBytes) ||
      values.codeBytes < 0 ||
      values.codeBytes > MAX_AUTHORITY_BYTES ||
      typeof values.codeSha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(values.codeSha256)
    ) {
      fail("OPTIONS_INVALID", `${label}[${index}] fields are malformed.`);
    }
    captured.push(
      deepFreeze({
        id: values.id,
        imports: captureDenseStringArray(values.imports, `${label}[${index}].imports`),
        dynamicImports: captureDenseStringArray(
          values.dynamicImports,
          `${label}[${index}].dynamicImports`,
        ),
        codeBytes: values.codeBytes,
        codeSha256: values.codeSha256,
      }),
    );
  }
  return Object.freeze(captured);
}

function findGraphModule(graph, id) {
  return graph.find((entry) => entry.id === id);
}

function workspacePackageName(moduleId) {
  return /^packages\/([^/]+)\//u.exec(moduleId)?.[1];
}

function auditOneGraph(graph, application, sourcePaths, allowedPackages) {
  const graphIds = graph.map(({ id }) => id);
  if (
    new Set(graphIds).size !== graph.length ||
    !isDeepStrictEqual(
      graphIds,
      [...graphIds].sort((left, right) => left.localeCompare(right, "en-US")),
    )
  ) {
    fail("VITE_GRAPH_DRIFT", `${application} graph IDs must be unique and canonical.`);
  }
  const graphIdSet = new Set(graphIds);
  const dynamicEdges = graph.reduce((total, module) => total + module.dynamicImports.length, 0);
  const unresolved = graph.flatMap((module) =>
    [...module.imports, ...module.dynamicImports]
      .filter((imported) => !graphIdSet.has(imported))
      .map((imported) => `${module.id} -> ${imported}`),
  );
  if (dynamicEdges !== 0 || unresolved.length !== 0) {
    fail(
      "VITE_GRAPH_DRIFT",
      `${application} graph gained dynamic or unresolved executable edges.`,
      {
        dynamicEdges,
        unresolved,
      },
    );
  }
  const sourcePrefix = `${application}/src/`;
  const actualSourcePaths = graphIds.filter((id) => id.startsWith(sourcePrefix)).sort();
  if (!isDeepStrictEqual(actualSourcePaths, sourcePaths)) {
    fail("VITE_GRAPH_DRIFT", `${application} production source graph inventory drifted.`, {
      actualSourcePaths,
    });
  }
  for (const module of graph) {
    const packageName = workspacePackageName(module.id);
    const allowed =
      module.id === `${application}/index.html` ||
      module.id.startsWith(sourcePrefix) ||
      module.id.startsWith("virtual:") ||
      /^node_modules\/(?:react|react-dom|scheduler)\//u.test(module.id) ||
      (packageName !== undefined && allowedPackages.includes(packageName)) ||
      (application === "apps/reference-host-web" &&
        module.id === "examples/sign-in/official-derived.bundle.desen.json") ||
      (application === "apps/desen-app" &&
        /^examples\/sign-in\/official-derived\.(?:bundle|source)\.desen\.json$/u.test(module.id));
    if (!allowed) {
      fail("VITE_GRAPH_DRIFT", `${application} graph escaped its closed runtime envelope.`, {
        module: module.id,
      });
    }
  }
  const entry = findGraphModule(graph, `${application}/index.html`);
  const reachable = new Set();
  const pending = entry === undefined ? [] : [entry.id];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || reachable.has(id)) continue;
    reachable.add(id);
    for (const imported of findGraphModule(graph, id)?.imports ?? []) pending.push(imported);
  }
  if (sourcePaths.some((relativePath) => !reachable.has(relativePath))) {
    fail("VITE_GRAPH_DRIFT", `${application} contains unreachable production source.`);
  }
  return Object.freeze({
    moduleCount: graph.length,
    staticEdges: graph.reduce((total, module) => total + module.imports.length, 0),
    dynamicEdges,
    unresolvedEdges: unresolved.length,
    reachableProductionSourceFiles: sourcePaths.length,
    graphSha256: `sha256:${sha256(Buffer.from(JSON.stringify(graph), "utf8"))}`,
  });
}

/** Applies the exact current App/reference-host graph and shared managed-module policy. */
export function verifyDesenAppPublishedHostUpdateGraphPolicy(rawInput) {
  const input = exactOwnDataOptions(
    rawInput,
    ["appGraph", "appSourcePaths", "hostGraph", "hostSourcePaths"],
    "graph-policy input",
  );
  const appGraph = captureGraph(input.appGraph, "appGraph");
  const hostGraph = captureGraph(input.hostGraph, "hostGraph");
  const appSourcePaths = captureDenseStringArray(input.appSourcePaths, "appSourcePaths", 256);
  const hostSourcePaths = captureDenseStringArray(input.hostSourcePaths, "hostSourcePaths", 256);
  if (
    !isDeepStrictEqual(appSourcePaths, APP_GRAPH_SOURCE_PATHS) ||
    !isDeepStrictEqual(hostSourcePaths, HOST_SOURCE_PATHS)
  ) {
    fail("VITE_GRAPH_DRIFT", "The current production source classification drifted.");
  }
  const app = auditOneGraph(appGraph, "apps/desen-app", appSourcePaths, APP_ALLOWED_PACKAGES);
  const host = auditOneGraph(
    hostGraph,
    "apps/reference-host-web",
    hostSourcePaths,
    HOST_ALLOWED_PACKAGES,
  );
  for (const forbiddenPrefix of [
    "apps/control-plane-api/",
    "apps/reference-host-web-server/",
    "apps/reference-host-web/",
  ]) {
    if (appGraph.some(({ id }) => id.startsWith(forbiddenPrefix))) {
      fail(
        "VITE_GRAPH_DRIFT",
        "The browser App graph acquired a server or host application edge.",
        {
          forbiddenPrefix,
        },
      );
    }
  }
  for (const forbiddenPrefix of [
    "apps/desen-app/",
    "apps/control-plane-api/",
    "apps/reference-host-web-server/",
  ]) {
    if (hostGraph.some(({ id }) => id.startsWith(forbiddenPrefix))) {
      fail("VITE_GRAPH_DRIFT", "The independent host graph acquired App or server source.", {
        forbiddenPrefix,
      });
    }
  }
  const appMain = findGraphModule(appGraph, "apps/desen-app/src/main.tsx");
  const appCanvas = findGraphModule(appGraph, "apps/desen-app/src/adapter-canvas.tsx");
  const appReferenceProfile = findGraphModule(
    appGraph,
    "apps/desen-app/src/reference-sign-in-workspace-profile.ts",
  );
  const hostMain = findGraphModule(hostGraph, "apps/reference-host-web/src/main.tsx");
  const hostManaged = findGraphModule(hostGraph, "apps/reference-host-web/src/managed-surface.tsx");
  const hostOfficial = findGraphModule(
    hostGraph,
    "apps/reference-host-web/src/official-sign-in.ts",
  );
  if (
    appMain?.imports.includes("apps/desen-app/src/local-runtime-publication.ts") !== true ||
    appCanvas?.imports.includes("packages/runtime-react/dist/index.js") !== true ||
    appReferenceProfile?.imports.includes(
      "packages/reference-catalog-web/dist/react-adapters/index.js",
    ) !== true ||
    hostMain?.imports.includes("apps/reference-host-web/src/channel-delivery.ts") !== true ||
    hostManaged?.imports.includes("packages/runtime-react/dist/index.js") !== true ||
    hostOfficial?.imports.includes(
      "packages/reference-catalog-web/dist/react-adapters/index.js",
    ) !== true
  ) {
    fail(
      "VITE_GRAPH_DRIFT",
      "The App/host graph lost its normal publication or public managed path.",
      {
        appMainImports: appMain?.imports,
        appCanvasImports: appCanvas?.imports,
        appReferenceProfileImports: appReferenceProfile?.imports,
        hostMainImports: hostMain?.imports,
        hostManagedImports: hostManaged?.imports,
        hostOfficialImports: hostOfficial?.imports,
      },
    );
  }
  const sharedIdentity = SHARED_MANAGED_MODULES.map((id) => {
    const appModule = findGraphModule(appGraph, id);
    const hostModule = findGraphModule(hostGraph, id);
    if (
      appModule === undefined ||
      hostModule === undefined ||
      !isDeepStrictEqual(appModule, hostModule)
    ) {
      fail("SHARED_RUNTIME_IDENTITY_DRIFT", "App and host transformed managed modules differ.", {
        id,
      });
    }
    return deepFreeze({
      id,
      codeBytes: appModule.codeBytes,
      codeSha256: appModule.codeSha256,
      importsSha256: `sha256:${sha256(Buffer.from(JSON.stringify(appModule.imports), "utf8"))}`,
    });
  });
  return deepFreeze({
    tool: "vite@8.1.5",
    authority: "programmatic build({ write: false }) Plugin.moduleParsed",
    observer: "moduleParsed",
    write: false,
    app,
    host,
    appModules: appGraph,
    hostModules: hostGraph,
    completeAppSourceFiles: APP_SOURCE_PATHS.length,
    appFixtureOnlySourceFiles: APP_FIXTURE_ONLY_SOURCE_PATHS,
    completeHostSourceFiles: HOST_SOURCE_PATHS.length,
    sharedManagedModuleCount: sharedIdentity.length,
    sharedManagedIdentity: sharedIdentity,
    publicRegistryAndRuntimeOnly: true,
    noHandwrittenHostManagedTreePreservedByFreshHostAudit: true,
  });
}

function validateOutputs(first, second, application) {
  if (!isDeepStrictEqual(first, second)) {
    fail("VITE_BUILD_NONDETERMINISTIC", `${application} Vite output identities differ.`);
  }
  if (
    first.length !== 3 ||
    first.filter(({ type }) => type === "chunk").length !== 1 ||
    first.filter(({ type }) => type === "asset").length !== 2 ||
    first.some(
      ({ bytes, sha256: digest }) =>
        !Number.isSafeInteger(bytes) || bytes <= 0 || !/^sha256:[0-9a-f]{64}$/u.test(digest),
    ) ||
    !first.some(
      ({ fileName, type, isEntry }) =>
        type === "chunk" &&
        isEntry === true &&
        /^assets\/index-[A-Za-z0-9_-]+\.js$/u.test(fileName),
    ) ||
    !first.some(
      ({ fileName, type }) =>
        type === "asset" && /^assets\/index-[A-Za-z0-9_-]+\.css$/u.test(fileName),
    ) ||
    !first.some(({ fileName, type }) => type === "asset" && fileName === "index.html")
  ) {
    fail("VITE_BUILD_DRIFT", `${application} output envelope drifted.`);
  }
  return deepFreeze({
    files: first.length,
    outputs: first,
    identitySha256: `sha256:${sha256(Buffer.from(JSON.stringify(first), "utf8"))}`,
  });
}

async function snapshotBackingFiles(workspaceRoot, paths) {
  const receipts = [];
  for (const relativePath of paths) {
    const bytes = await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath);
    receipts.push(
      Object.freeze({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: `sha256:${sha256(bytes)}`,
      }),
    );
  }
  return Object.freeze(receipts);
}

async function buildDualViteAudit(workspaceRoot) {
  const [appFirst, hostFirst] = await Promise.all([
    runObservedViteBuild(workspaceRoot, "apps/desen-app", "desen-app-t05-app-a"),
    runObservedViteBuild(workspaceRoot, "apps/reference-host-web", "desen-app-t05-host-a"),
  ]);
  const backingPaths = [...new Set([...appFirst.backingPaths, ...hostFirst.backingPaths])].sort(
    (left, right) => left.localeCompare(right, "en-US"),
  );
  const backingBefore = await snapshotBackingFiles(workspaceRoot, backingPaths);
  const [appSecond, hostSecond] = await Promise.all([
    runObservedViteBuild(workspaceRoot, "apps/desen-app", "desen-app-t05-app-b"),
    runObservedViteBuild(workspaceRoot, "apps/reference-host-web", "desen-app-t05-host-b"),
  ]);
  if (
    !isDeepStrictEqual(appFirst.graph, appSecond.graph) ||
    !isDeepStrictEqual(hostFirst.graph, hostSecond.graph) ||
    !isDeepStrictEqual(appFirst.backingPaths, appSecond.backingPaths) ||
    !isDeepStrictEqual(hostFirst.backingPaths, hostSecond.backingPaths)
  ) {
    fail("VITE_GRAPH_NONDETERMINISTIC", "Independent App or host Vite graph observations differ.");
  }
  const graph = verifyDesenAppPublishedHostUpdateGraphPolicy({
    appGraph: appFirst.graph,
    appSourcePaths: APP_GRAPH_SOURCE_PATHS,
    hostGraph: hostFirst.graph,
    hostSourcePaths: HOST_SOURCE_PATHS,
  });
  const backingAfter = await snapshotBackingFiles(workspaceRoot, backingPaths);
  if (!isDeepStrictEqual(backingBefore, backingAfter)) {
    fail("VITE_GRAPH_NONDETERMINISTIC", "Vite backing bytes changed across observations.");
  }
  return deepFreeze({
    ...graph,
    independentBuildsPerApplication: 2,
    deterministic: true,
    appOutput: validateOutputs(appFirst.outputs, appSecond.outputs, "Desen App"),
    hostOutput: validateOutputs(hostFirst.outputs, hostSecond.outputs, "reference host"),
    hostOutputIdentityAEqualsB: true,
    backingFiles: backingBefore.length,
    backingSnapshotSha256: `sha256:${sha256(Buffer.from(JSON.stringify(backingBefore), "utf8"))}`,
    backingModulesStableAcrossObservations: true,
  });
}

function sourceReceipts(files, paths) {
  return Object.freeze(
    paths.map((relativePath) => {
      const bytes = files.get(relativePath);
      return Object.freeze({
        path: relativePath,
        bytes: bytes.byteLength,
        sha256: `sha256:${sha256(bytes)}`,
      });
    }),
  );
}

async function buildFreshHostAudit(workspaceRoot, files) {
  let current;
  try {
    current = await buildCurrentReferenceHostWebSourceAuditEvidence({ workspaceRoot });
  } catch (error) {
    fail("CURRENT_HOST_AUDIT_FAILED", "The fresh complete reference-host audit failed.", {
      cause: String(error),
    });
  }
  const artifact = current.artifact;
  if (
    artifact?.task !== "M05-T09" ||
    artifact.result !== "PASS" ||
    artifact.sourceAudit?.sourceFiles !== HOST_SOURCE_PATHS.length ||
    artifact.claim?.productionSourceInventoryClosed !== true ||
    artifact.claim?.everyProductionSourceFileReachableFromRealEntry !== true ||
    artifact.claim?.directOrHiddenHandwrittenManagedTreesRejected !== true ||
    artifact.claim?.publicReferenceReactAdaptersReached !== true ||
    artifact.claim?.publicRuntimeReactRenderPlanReached !== true ||
    artifact.runtimeResolution?.tool !== "vite@8.1.5" ||
    artifact.runtimeResolution?.observer !== "moduleParsed" ||
    artifact.runtimeResolution?.write !== false ||
    artifact.runtimeResolution?.independentBuilds !== 2 ||
    artifact.runtimeResolution?.dynamicEdges !== 0 ||
    artifact.runtimeResolution?.unresolvedEdges !== 0
  ) {
    fail(
      "CURRENT_HOST_AUDIT_FAILED",
      "The current host audit lost its complete managed-source claim.",
    );
  }
  const currentSourceReceipts = artifact.evidence?.trackedFiles?.filter(({ path: relativePath }) =>
    HOST_SOURCE_PATHS.includes(relativePath),
  );
  const expectedReceipts = sourceReceipts(files, HOST_SOURCE_PATHS);
  if (!isDeepStrictEqual(currentSourceReceipts, expectedReceipts)) {
    fail(
      "CURRENT_HOST_AUDIT_FAILED",
      "The current host audit source receipts differ from T05 acquisition.",
    );
  }
  return deepFreeze({
    compiler: artifact.sourceAudit.compiler,
    compilerAuthority: artifact.sourceAudit.compilerAuthority,
    sourceFiles: artifact.sourceAudit.sourceFiles,
    executableSourceFiles: artifact.sourceAudit.executableSourceFiles,
    importDeclarations: artifact.sourceAudit.importDeclarations,
    jsxElements: artifact.sourceAudit.jsxElements,
    compositionFunctions: artifact.sourceAudit.compositionFunctions,
    executableAuthoritySurface: artifact.sourceAudit.executableAuthoritySurface,
    publicAdapterRegistryCalls: artifact.sourceAudit.publicAdapterRegistryCalls,
    publicRuntimeReactSurfaceCalls: artifact.sourceAudit.publicRuntimeReactSurfaceCalls,
    publicReactRootCalls: artifact.sourceAudit.publicReactRootCalls,
    buildEnvelope: artifact.buildEnvelope,
    runtimeResolution: {
      tool: artifact.runtimeResolution.tool,
      authority: artifact.runtimeResolution.authority,
      observer: artifact.runtimeResolution.observer,
      write: artifact.runtimeResolution.write,
      independentBuilds: artifact.runtimeResolution.independentBuilds,
      moduleCount: artifact.runtimeResolution.moduleCount,
      staticEdges: artifact.runtimeResolution.staticEdges,
      dynamicEdges: artifact.runtimeResolution.dynamicEdges,
      unresolvedEdges: artifact.runtimeResolution.unresolvedEdges,
      graphSha256: artifact.runtimeResolution.graphSha256,
      backingFiles: artifact.runtimeResolution.backingFiles,
      backingSnapshotSha256: artifact.runtimeResolution.backingSnapshotSha256,
    },
    packageBoundary: artifact.packageBoundary,
    sourceReceipts: expectedReceipts,
    exactJsxOwnershipAllowlistEnforced: true,
    directOrHiddenHandwrittenManagedTreesRejected: true,
    currentAuditUsesFreshSourceAndBuild: true,
  });
}

function verifyPackageAuthority(files) {
  const app = parseJson(files.get("apps/desen-app/package.json"), "apps/desen-app/package.json");
  const browser = parseJson(
    files.get("apps/desen-app-browser-e2e/package.json"),
    "apps/desen-app-browser-e2e/package.json",
  );
  const host = parseJson(
    files.get("apps/reference-host-web/package.json"),
    "apps/reference-host-web/package.json",
  );
  const server = parseJson(
    files.get("apps/reference-host-web-server/package.json"),
    "apps/reference-host-web-server/package.json",
  );
  if (
    app?.name !== "@desen/app-web" ||
    app.scripts?.build !== "vite build" ||
    app.scripts?.["test:local-runtime"] !==
      "vitest run test/local-runtime-persistence.test.ts test/local-runtime-publication.test.ts dev/local-dev-host.test.mjs dev/local-publication-host.test.mjs" ||
    app.scripts?.["test:product-bootstrap"] !==
      "vitest run test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx" ||
    browser?.name !== "@desen/app-browser-e2e" ||
    !browser.scripts?.["test:e2e"]?.endsWith(
      "playwright test --config published-host-playwright.config.ts",
    ) ||
    host?.name !== "@desen/reference-host-web" ||
    host.scripts?.build !== "vite build" ||
    server?.name !== "@desen/reference-host-web-server" ||
    server.scripts?.build !== "tsc -p tsconfig.build.json" ||
    !server.scripts?.["test:channel"]?.includes("test/server.test.ts")
  ) {
    fail("SOURCE_POLICY_VIOLATION", "The T05 package/build/test ownership drifted.");
  }
  return deepFreeze({
    appPackage: app.name,
    browserPackage: browser.name,
    hostPackage: host.name,
    hostServerPackage: server.name,
    appBuild: app.scripts.build,
    hostBuild: host.scripts.build,
    focusedCommands: FOCUSED_TEST_COMMANDS,
    browserCommand: BROWSER_COMMAND,
    browserSuiteIncludesPublishedHostConfig: true,
  });
}

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
}

/** Builds fresh M10-T05 evidence without starting Chromium, a listener, or writing Vite output. */
export async function buildDesenAppPublishedHostUpdateEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const acquired = await acquireFiles(options);
  const files = acquired.files;
  const parents = authenticateParents(files);
  const bridge = authenticateHistoricalReaderBridge(
    files.get(T04_HISTORICAL_READER_BRIDGE_PATH),
    parents.t04.artifact,
  );
  const source = verifyDesenAppPublishedHostUpdateSourcePolicy(
    Object.fromEntries(
      Object.entries(SOURCE_POLICY_PATHS).map(([key, relativePath]) => [
        key,
        decodeUtf8(files.get(relativePath), relativePath),
      ]),
    ),
  );
  const focusedTests = verifyFocusedTests(files);
  const browser = verifyDesenAppPublishedHostUpdateBrowserPolicy({
    spec: decodeUtf8(files.get(BROWSER_PATHS.spec), BROWSER_PATHS.spec),
    config: decodeUtf8(files.get(BROWSER_PATHS.config), BROWSER_PATHS.config),
    server: decodeUtf8(files.get(BROWSER_PATHS.server), BROWSER_PATHS.server),
  });
  const dependencyBoundary = verifyBoundaryAuthority(files);
  const bridgeReproduction = verifyBridgeReproductionAuthority(files);
  const packageAuthority = verifyPackageAuthority(files);
  const acquiredAppSourceReceipts = sourceReceipts(files, APP_SOURCE_PATHS);
  const acquiredHostSourceReceipts = sourceReceipts(files, HOST_SOURCE_PATHS);
  const freshHostAudit = await buildFreshHostAudit(options.workspaceRoot, files);
  const viteAudit = await buildDualViteAudit(options.workspaceRoot);
  const finalAppSourceReceipts = await snapshotBackingFiles(
    options.workspaceRoot,
    APP_SOURCE_PATHS,
  );
  const finalHostSourceReceipts = await snapshotBackingFiles(
    options.workspaceRoot,
    HOST_SOURCE_PATHS,
  );
  if (
    !isDeepStrictEqual(acquiredAppSourceReceipts, finalAppSourceReceipts) ||
    !isDeepStrictEqual(acquiredHostSourceReceipts, finalHostSourceReceipts)
  ) {
    fail("SOURCE_SNAPSHOT_DRIFT", "App or host source changed across the fresh build audit.");
  }
  const trackedReceipts = Object.freeze(
    TRACKED_PATHS.map((relativePath) => {
      const bytes = files.get(relativePath);
      return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }),
  );
  const artifact = deepFreeze({
    schemaVersion: 1,
    proofId: "desen-app-published-host-update",
    profile: "desen.app.published-host-update-proof.v1",
    task: "M10-T05",
    gate: null,
    result: "PASS",
    prerequisites: [
      parents.t04.summary,
      parents.t14.summary,
      parents.hostAudit.summary,
      parents.appCanvas.summary,
    ],
    claim: {
      taskStatus: "DONE",
      p07Status: "PROVEN",
      m10T05Closed: true,
      visibleNormalProductAuthoring: true,
      twoSavedPublishedAndActivatedRevisions: true,
      labelAndLayoutUpdateVisibleInIndependentHost: true,
      hostSourceUnchangedAcrossPublishedRevisions: true,
      hostBuildUnchangedAcrossPublishedRevisions: true,
      immutableHostBuildAndSourceIdentityAtoB: true,
      savedAuthoredSourceOnly: true,
      exactPublishedRevisionActivation: true,
      serverOwnedChannelRereadAndActivation: true,
      fixedLauncherOwnedChannelAndHost: true,
      browserAndServerAuthoritiesSeparate: true,
      currentAppAndReferenceHostSourceImportBuildAudit: true,
      samePublicManagedImplementationInAppAndHost: true,
      noHandwrittenManagedHostTree: true,
      sourceSelectsEndpointCredentialHandlerOrExecutableModule: false,
      browserE2eClaimed: true,
      productionDeploymentCovered: false,
      remoteHostCovered: false,
      invalidPublicationCovered: false,
      lastKnownGoodRecoveryCovered: false,
      m10T06Closed: false,
      m10T07Closed: false,
      m10T08Closed: false,
      m10T09Closed: false,
      g10Closed: false,
    },
    authority: {
      source,
      focusedTests,
      browser,
      appSourceAudit: {
        inventory: acquired.appInventory,
        completeSourceFiles: APP_SOURCE_PATHS.length,
        productionGraphSourceFiles: APP_GRAPH_SOURCE_PATHS.length,
        fixtureOnlySourceFiles: APP_FIXTURE_ONLY_SOURCE_PATHS,
        sourceReceipts: acquiredAppSourceReceipts,
        everyProductionSourceFileReachable: true,
        fixtureOnlyModulesExcludedFromProductionGraph: true,
        importsResolvedByFreshViteBuild: true,
      },
      referenceHostSourceAudit: freshHostAudit,
      runtimeResolution: viteAudit,
      dependencyBoundary,
      package: packageAuthority,
      historicalReaderBridge: bridge.summary,
      bridgeReproduction,
    },
    tests: {
      focusedCommands: FOCUSED_TEST_COMMANDS,
      browserCommand: BROWSER_COMMAND,
      boundaryCommand: "pnpm boundaries",
      boundaryFixtureCommand: "node scripts/verify-boundary-fixtures.mjs",
      verifierCommand: "node scripts/verify-desen-app-published-host-update.mjs",
      proofReaderCommand: "node --test tests/desen-app-published-host-update.test.mjs",
      rootTestNames: DESEN_APP_PUBLISHED_HOST_UPDATE_ROOT_TEST_NAMES,
      browserExecutedByVerifier: false,
      dependencyCruiserExecutedByT05Verifier: false,
      currentHostAuditExecutesDependencyCruiser: true,
      deterministicReaderStartsListener: false,
      deterministicReaderStartsChromium: false,
      viteBuildsExecutedByVerifier: true,
      viteBuildOutputWritten: false,
      declarationSitesAreNotExecutionCount: true,
    },
    boundary: {
      trackedFiles: trackedReceipts.length,
      trackedReceipts,
      parentArtifacts: 4,
      historicalReaderBridgeArtifacts: 1,
      immutableInputs: true,
      completeAppSourceFiles: APP_SOURCE_PATHS.length,
      completeReferenceHostSourceFiles: HOST_SOURCE_PATHS.length,
      completeReferenceHostServerSourceFiles: HOST_SERVER_SOURCE_PATHS.length,
      sourceSymlinksRejected: true,
      checkpointOwnedReaderPaths: [
        "scripts/lib/desen-app-published-host-update-proof.mjs",
        "tests/desen-app-published-host-update.test.mjs",
      ],
      artifactTrackedEntrypoints: PROOF_ENTRYPOINT_PATHS,
    },
    nonClaims: [
      "M10-T05 proves two local normal-product Save, Publish, Activate cycles and visible independent-host updates while the separately built host source and static build identity remain unchanged.",
      "The fixed preview channel, reference-host identity, endpoints, bearers, control-plane implementation, activation callback, and executable modules remain trusted launcher/server authority outside authored Source.",
      "The deterministic reader performs fresh source and Vite write:false audits but starts no browser, network listener, application server, or external host; Chromium remains a distinct CI workload.",
      "The browser fingerprint uses read-only HTTP GETs solely to authenticate the independent host static HTML and assets; all Source authoring, saving, publication, and activation occurs through visible product controls.",
      "This local reference composition is not remote deployment, production credentials, multi-user persistence, invalid-publication rejection, last-known-good recovery, or production operations.",
      "M10-T06, M10-T07, M10-T08, M10-T09, N-036, P-12, and G10 remain owned by their later tasks.",
      "Local evidence does not imply hosted exact-head Quality gate or Browser E2E success until those workloads pass for the unchanged revision.",
    ],
  });
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({ artifact, artifactBytes, artifactSha256: sha256(artifactBytes) });
}

function assertPinnedArtifact(bytes) {
  const pin = DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN;
  if (
    pin.bytes <= 0 ||
    !/^[0-9a-f]{64}$/u.test(pin.sha256) ||
    bytes.byteLength !== pin.bytes ||
    sha256(bytes) !== pin.sha256
  ) {
    fail("ARTIFACT_DRIFT", "The immutable committed M10-T05 artifact bytes drifted.");
  }
}

function authenticatePublishedHostUpdateArtifact(bytes) {
  assertPinnedArtifact(bytes);
  const artifact = parseJson(bytes, ARTIFACT_RELATIVE_PATH, "ARTIFACT_DRIFT");
  if (
    artifact?.schemaVersion !== 1 ||
    artifact.task !== "M10-T05" ||
    artifact.gate !== null ||
    artifact.proofId !== "desen-app-published-host-update" ||
    artifact.profile !== "desen.app.published-host-update-proof.v1" ||
    artifact.result !== "PASS" ||
    artifact.claim?.p07Status !== "PROVEN" ||
    artifact.claim?.m10T05Closed !== true
  ) {
    fail("ARTIFACT_DRIFT", "The committed M10-T05 artifact identity or claim drifted.");
  }
  return deepFreeze(artifact);
}

function verifyProofDocument(bytes, artifactSha256) {
  const source = decodeUtf8(bytes, PROOF_DOCUMENT_RELATIVE_PATH, "PROOF_DOCUMENT_DRIFT");
  const expectedHeader = [
    "# Desen App published host update",
    "",
    "Task: M10-T05",
    "",
    "Status: DONE",
    "",
    "P-07: PROVEN",
    "",
    `M10-T04 parent: \`sha256:${DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN.sha256}\``,
    "",
    `M09-T14 parent: \`sha256:${DESEN_APP_PUBLISHED_HOST_UPDATE_T14_PIN.sha256}\``,
    "",
    `M05-T09 host audit: \`sha256:${DESEN_APP_PUBLISHED_HOST_UPDATE_HOST_AUDIT_PIN.sha256}\``,
    "",
    `M09-T03 App canvas: \`sha256:${DESEN_APP_PUBLISHED_HOST_UPDATE_APP_CANVAS_PIN.sha256}\``,
    "",
    `Historical bridge: \`sha256:${DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.sha256}\``,
    "",
    `Final artifact: \`sha256:${artifactSha256}\``,
  ].join("\n");
  if (
    !source.startsWith(expectedHeader) ||
    occurrenceCount(source, "Task: M10-T05") !== 1 ||
    occurrenceCount(source, "Status: DONE") !== 1 ||
    occurrenceCount(source, "P-07: PROVEN") !== 1 ||
    occurrenceCount(source, "Final artifact:") !== 1 ||
    source.includes("sha256:PENDING")
  ) {
    fail("PROOF_DOCUMENT_DRIFT", "The M10-T05 proof report lost its exact authority header.");
  }
}

/** Verifies the pinned artifact against fresh current App and host authorities. */
export async function verifyDesenAppPublishedHostUpdateEvidence(rawOptions = undefined) {
  const options = exactOwnDataOptions(
    rawOptions,
    ["artifactBytes", "artifactPath", "buildOptions", "proofDocument", "proofDocumentPath"],
    "verify options",
  );
  const suppliedArtifactBytes =
    options.artifactBytes === undefined
      ? undefined
      : captureBytes(options.artifactBytes, "artifactBytes");
  const suppliedProofDocument =
    options.proofDocument === undefined
      ? undefined
      : captureBytes(options.proofDocument, "proofDocument");
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PATH
      : captureAbsolutePath(options.artifactPath, "artifactPath");
  const proofDocumentPath =
    options.proofDocumentPath === undefined
      ? DEFAULT_PROOF_DOCUMENT_PATH
      : captureAbsolutePath(options.proofDocumentPath, "proofDocumentPath");
  const built = await buildDesenAppPublishedHostUpdateEvidence(options.buildOptions);
  const artifactBytes =
    suppliedArtifactBytes === undefined
      ? await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH)
      : suppliedArtifactBytes;
  if (!artifactBytes.equals(built.artifactBytes)) {
    fail("ARTIFACT_DRIFT", "The committed M10-T05 artifact does not match current authorities.");
  }
  const artifact = authenticatePublishedHostUpdateArtifact(artifactBytes);
  const proofDocument =
    suppliedProofDocument === undefined
      ? await readRegularAuthority(proofDocumentPath, PROOF_DOCUMENT_RELATIVE_PATH)
      : suppliedProofDocument;
  verifyProofDocument(proofDocument, built.artifactSha256);
  return deepFreeze({
    task: artifact.task,
    result: artifact.result,
    artifactBytes: artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: artifact.boundary.trackedFiles,
    rootTests: artifact.tests.rootTestNames.length,
    focusedDeclarationSites: artifact.authority.focusedTests.totalDeclarationSites,
    chromiumScenarios: artifact.authority.browser.chromiumConfigurations,
    appGraphModules: artifact.authority.runtimeResolution.app.moduleCount,
    hostGraphModules: artifact.authority.runtimeResolution.host.moduleCount,
    sharedManagedModules: artifact.authority.runtimeResolution.sharedManagedModuleCount,
    p07Status: artifact.claim.p07Status,
    m10T05Closed: artifact.claim.m10T05Closed,
    browserExecutedByVerifier: false,
    deterministicReaderStartsListener: false,
    viteBuildsExecutedByVerifier: true,
    viteBuildOutputWritten: false,
  });
}

function successorAuthority(successor) {
  if (
    successor === null ||
    typeof successor !== "object" ||
    utilTypes.isProxy(successor) ||
    !SUCCESSOR_AUTHORITIES.has(successor)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "T04 historical compatibility requires the exact authenticated M10-T05 successor.",
    );
  }
  return SUCCESSOR_AUTHORITIES.get(successor);
}

/** Authenticates the exact M10-T05 successor for the historical M10-T04 reader. */
export async function authenticateDesenAppPublishedHostUpdateSuccessor(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions, ["workspaceRoot"], "successor options");
  const workspaceRoot = captureAbsolutePath(
    options.workspaceRoot ?? WORKSPACE_ROOT,
    "workspaceRoot",
  );
  const artifactBytes = await readRegularAuthority(
    path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
    ARTIFACT_RELATIVE_PATH,
  );
  const artifact = authenticatePublishedHostUpdateArtifact(artifactBytes);
  verifyProofDocument(
    await readRegularAuthority(
      path.join(workspaceRoot, PROOF_DOCUMENT_RELATIVE_PATH),
      PROOF_DOCUMENT_RELATIVE_PATH,
    ),
    DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256,
  );
  const parent = authenticatePinnedArtifact(
    await readRegularAuthority(path.join(workspaceRoot, T04_ARTIFACT_PATH), T04_ARTIFACT_PATH),
    DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN,
    (artifact) => artifact?.task === "M10-T04" && artifact?.result === "PASS",
    "M10-T04",
  );
  const bridge = authenticateHistoricalReaderBridge(
    await readRegularAuthority(
      path.join(workspaceRoot, T04_HISTORICAL_READER_BRIDGE_PATH),
      T04_HISTORICAL_READER_BRIDGE_PATH,
    ),
    parent.artifact,
  );
  const successor = deepFreeze({
    task: "M10-T05",
    proofId: "desen-app-published-host-update",
    profile: "desen.app.published-host-update-proof.v1",
    result: artifact.result,
    artifact: {
      path: ARTIFACT_RELATIVE_PATH,
      ...DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN,
      immutable: true,
    },
    predecessor: { ...DESEN_APP_PUBLISHED_HOST_UPDATE_T04_PIN },
    trackedFiles: artifact.boundary.trackedFiles,
    p07Status: artifact.claim.p07Status,
    m10T05Closed: artifact.claim.m10T05Closed,
  });
  SUCCESSOR_AUTHORITIES.set(successor, bridge);
  return successor;
}

function validateHistoricalOverrideMap(fileOverrides) {
  if (
    utilTypes.isProxy(fileOverrides) ||
    !(fileOverrides instanceof Map) ||
    Object.getPrototypeOf(fileOverrides) !== Map.prototype ||
    Reflect.ownKeys(fileOverrides).length !== 0 ||
    fileOverrides.size > MAX_HISTORICAL_OVERRIDES
  ) {
    fail("OPTIONS_INVALID", "Historical fileOverrides must be one inert bounded Map.");
  }
}

/** Materializes retained T04 technical bytes before caller-owned hostile mutations. */
export function materializeDesenAppT04HistoricalReaderFileOverrides(successor, fileOverrides) {
  const authority = successorAuthority(successor);
  validateHistoricalOverrideMap(fileOverrides);
  const materialized = new Map(
    [...authority.files].map(([relativePath, bytes]) => [relativePath, Buffer.from(bytes)]),
  );
  for (const [relativePath, bytes] of authority.predecessorGapFiles) {
    materialized.set(relativePath, Buffer.from(bytes));
  }
  let totalBytes = 0;
  for (const [relativePath, bytes] of Map.prototype.entries.call(fileOverrides)) {
    if (!safeRelativePath(relativePath)) {
      fail("OPTIONS_INVALID", "Historical fileOverrides contains an unsafe relative path.");
    }
    const captured = captureBytes(bytes, `historical fileOverrides[${relativePath}]`);
    totalBytes += captured.byteLength;
    if (totalBytes > MAX_OVERRIDE_BYTES) {
      fail("OPTIONS_INVALID", "Historical fileOverrides exceeds its aggregate byte budget.");
    }
    materialized.set(relativePath, captured);
  }
  return materialized;
}

/** Returns a defensive copy of retained M10-T04 task-time bytes. */
export function readDesenAppT04HistoricalReaderTaskTimeFile(successor, relativePath) {
  if (!safeRelativePath(relativePath)) {
    fail("OPTIONS_INVALID", "relativePath must be one safe relative path.");
  }
  const authority = successorAuthority(successor);
  const bytes =
    authority.files.get(relativePath) ?? authority.predecessorGapFiles.get(relativePath);
  if (bytes === undefined) {
    fail("OPTIONS_INVALID", "relativePath has no T04 task-time bridge entry.", { relativePath });
  }
  return Buffer.from(bytes);
}

/** Removes only exact authenticated T05-added paths from a historical T04 inventory. */
export function projectDesenAppT04HistoricalReaderPathInventory(successor, currentPaths) {
  const authority = successorAuthority(successor);
  const captured = captureDenseStringArray(currentPaths, "historical path inventory", 4_096);
  if (
    new Set(captured).size !== captured.length ||
    captured.some((entry) => !safeRelativePath(entry))
  ) {
    fail("OPTIONS_INVALID", "Historical path inventory contains duplicate or unsafe paths.");
  }
  return Object.freeze(
    captured.filter((relativePath) => !authority.successorAddedPaths.has(relativePath)),
  );
}

async function canonicalDestinationPath(filePath) {
  const absolutePath = path.resolve(filePath);
  const canonicalParent = await realpath(path.dirname(absolutePath));
  return path.join(canonicalParent, path.basename(absolutePath));
}

/** Atomically writes newly built M10-T05 evidence or refuses unsafe frozen replacement. */
export async function writeDesenAppPublishedHostUpdateEvidence(rawOptions = undefined) {
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
  const artifactPath =
    options.artifactPath === undefined
      ? DEFAULT_DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PATH
      : captureAbsolutePath(options.artifactPath, "artifactPath");
  const built = await buildDesenAppPublishedHostUpdateEvidence(options.buildOptions);
  let destination;
  try {
    destination = await canonicalDestinationPath(artifactPath);
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T05 artifact destination is unsafe.", {
      cause: String(error),
    });
  }
  if (
    destination ===
      (await canonicalDestinationPath(DEFAULT_DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PATH)) &&
    DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.bytes > 0
  ) {
    try {
      const existing = await readRegularAuthority(destination, ARTIFACT_RELATIVE_PATH);
      if (!existing.equals(built.artifactBytes)) {
        fail("ARTIFACT_WRITE_UNSAFE", "Refusing to rewrite the frozen tracked M10-T05 artifact.");
      }
    } catch (error) {
      if (
        error instanceof DesenAppPublishedHostUpdateProofError &&
        error.code !== "AUTHORITY_UNSAFE"
      ) {
        throw error;
      }
    }
  }
  try {
    await writeAtomicProofArtifact({
      artifactPath: destination,
      artifactBytes: built.artifactBytes,
      beforeAtomicRename: options.beforeAtomicRename,
    });
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail("ARTIFACT_WRITE_UNSAFE", "The atomic M10-T05 artifact write failed.", {
      cause: String(error),
    });
  }
  return deepFreeze({
    artifactPath: destination,
    artifactBytes: built.artifactBytes.byteLength,
    artifactSha256: built.artifactSha256,
    trackedFiles: built.artifact.boundary.trackedFiles,
    rootTests: built.artifact.tests.rootTestNames.length,
    appGraphModules: built.artifact.authority.runtimeResolution.app.moduleCount,
    hostGraphModules: built.artifact.authority.runtimeResolution.host.moduleCount,
  });
}
