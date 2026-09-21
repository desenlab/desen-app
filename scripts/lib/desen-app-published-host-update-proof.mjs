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
import {
  M10A_T17_ADDED_APP_SOURCE_RECEIPTS,
  M10A_T17_LEGACY_INPUT_SUCCESSORS,
} from "./m10a-t17-legacy-input-receipts.mjs";
import {
  M10A_T18_ADDED_APP_SOURCE_RECEIPTS,
  M10A_T18_LEGACY_INPUT_SUCCESSORS,
} from "./m10a-t18-legacy-input-receipts.mjs";
import {
  M10A_T19_ADDED_APP_SOURCE_RECEIPTS,
  M10A_T19_LEGACY_INPUT_SUCCESSORS,
} from "./m10a-t19-legacy-input-receipts.mjs";
import { M10A_T21_LEGACY_INPUT_SUCCESSORS } from "./m10a-t21-legacy-input-receipts.mjs";
import { M10A_T20_LEGACY_INPUT_SUCCESSORS } from "./m10a-t20-legacy-input-receipts.mjs";
import {
  M10A_T15_ADDED_APP_SOURCE_RECEIPTS,
  M10A_T15_LEGACY_INPUT_SUCCESSORS,
} from "./m10a-t15-legacy-input-receipts.mjs";
import { M10A_T16_LEGACY_INPUT_SUCCESSORS } from "./m10a-t16-legacy-input-receipts.mjs";
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
const T06_SUCCESSOR_PATH = "docs/proof/artifacts/desen-app-0.1.0-invalid-publication.json";
const T06_SUCCESSOR_PIN = Object.freeze({
  bytes: 193_291,
  sha256: "1eb4260306d20fc87558edc4da4027c96bbb84598b758b242b8530010fe6071a",
});
const T08_SUCCESSOR_PATH = "docs/proof/artifacts/desen-app-0.1.0-repeatable-demo.json";
const T08_SUCCESSOR_PIN = Object.freeze({
  bytes: 319_719,
  sha256: "048041735b406dab4eefa6b0d02e2c039d3b3c3629d4dfc0cd7489a3c9f286f5",
});
const T08_REVIEWED_CHANGED_PATHS = Object.freeze([
  "apps/desen-app-browser-e2e/package.json",
  "apps/desen-app/dev/local-dev-host.mjs",
  "apps/desen-app/dev/local-dev-host.test.mjs",
  "apps/desen-app/src/main.tsx",
  "apps/desen-app/test/main-lifecycle.test.tsx",
  "apps/desen-app/tsconfig.local-dev.json",
  "apps/reference-host-web/package.json",
  "apps/reference-host-web/src/channel-delivery.ts",
  "apps/reference-host-web/src/main.tsx",
  "apps/reference-host-web/src/official-sign-in.ts",
  "apps/reference-host-web-server/src/channel-activation-controller.ts",
  "apps/reference-host-web-server/src/index.ts",
  "apps/reference-host-web-server/src/server.ts",
  "apps/reference-host-web-server/test/server.test.ts",
  "dependency-cruiser.config.cjs",
  "scripts/verify-boundary-fixtures.mjs",
]);
const T08_ADDED_APP_PATHS = Object.freeze([
  "apps/desen-app/dev/local-demo-host.mjs",
  "apps/desen-app/dev/local-demo-host.test.mjs",
  "apps/desen-app/dev/local-demo.mjs",
]);
const T07_PROTOCOL_LOCKFILE_ADDITION =
  "      '@desen/protocol':\n        specifier: workspace:*\n        version: link:../../packages/protocol\n";
const T06_ADDED_APP_PATHS = Object.freeze([
  "apps/desen-app/src/authoring-source-draft.ts",
  "apps/desen-app/src/source-draft-controls.tsx",
]);
const T06_REVIEWED_CHANGED_PATHS = Object.freeze([
  "apps/desen-app/src/application.module.css",
  "apps/desen-app/src/application.tsx",
  "apps/desen-app/src/inspector-panel.tsx",
  "apps/desen-app-browser-e2e/package.json",
  ...T06_ADDED_APP_PATHS,
]);
const T06_INSPECTOR_PATH = "apps/desen-app/src/inspector-panel.tsx";
const T06_INSPECTOR_ADDITIONS = Object.freeze([
  "  /** New rejected snapshots reveal Inspector without moving keyboard focus. */\n  readonly diagnosticsRevealKey?: string | undefined;\n",
  "  diagnosticsRevealKey,\n",
  '  useEffect(() => {\n    if (diagnosticsRevealKey !== undefined) setActiveTab("inspector");\n  }, [diagnosticsRevealKey]);\n',
]);
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
    "apps/desen-app/src/authoring-source-draft.ts",
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
    "apps/desen-app/src/source-draft-controls.tsx",
    "apps/desen-app/src/state-panel.tsx",
    "apps/desen-app/src/structured-json.ts",
    "apps/desen-app/src/styles.css",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// T10 can add inert authoring-lifecycle modules before it wires them into the normal App.
// This bounded inventory admission keeps the M10 receipt set immutable while the M10 graph audit
// still rejects any edge from the frozen product path into these successor-owned modules.
const M10A_T10_ISOLATED_APP_SOURCE_PATHS = Object.freeze(
  [
    "apps/desen-app/src/project-lifecycle-navigation.ts",
    "apps/desen-app/src/project-lifecycle.ts",
    "apps/desen-app/src/starter-project.ts",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// T11 is the first M10A successor that deliberately joins the normal App runtime graph. Unlike
// T10's dormant lifecycle helpers, these modules must be received by the fresh Vite observation
// and are projected back only by the exact T11 successor bridge below.
const M10A_T11_REACHABLE_APP_SOURCE_PATHS = Object.freeze(
  [
    "apps/desen-app/src/authoring-direct-manipulation.ts",
    "apps/desen-app/src/canvas-manipulation-controls.tsx",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// T12 is the first normal-product successor to make the previously inventory-only T10
// lifecycle surface executable. Its eight new modules and these two exact T10 modules are
// received by the current Vite observation; T10 navigation itself remains inventory-only.
const M10A_T12_REACHABLE_T10_APP_SOURCE_PATHS = Object.freeze(
  ["apps/desen-app/src/project-lifecycle.ts", "apps/desen-app/src/starter-project.ts"].sort(
    (left, right) => left.localeCompare(right, "en-US"),
  ),
);

const M10A_T12_ADDED_APP_SOURCE_PATHS = Object.freeze(
  [
    "apps/desen-app/src/authoring-design-tokens.ts",
    "apps/desen-app/src/authoring-style-preview-runtime.ts",
    "apps/desen-app/src/authoring-styles.ts",
    "apps/desen-app/src/local-project-workspace-persistence.ts",
    "apps/desen-app/src/project-workspace-authoring-persistence.ts",
    "apps/desen-app/src/starter-neutral-workspace-profile.ts",
    "apps/desen-app/src/starter-workspace-product.tsx",
    "apps/desen-app/src/style-panel.tsx",
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const CURRENT_APP_SOURCE_INVENTORY_PATHS = Object.freeze(
  [
    ...APP_SOURCE_PATHS,
    ...M10A_T10_ISOLATED_APP_SOURCE_PATHS,
    ...M10A_T11_REACHABLE_APP_SOURCE_PATHS,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

const APP_FIXTURE_ONLY_SOURCE_PATHS = Object.freeze([
  "apps/desen-app/src/reference-authoring-profile.ts",
  "apps/desen-app/src/reference-project-fixtures.ts",
]);

const APP_GRAPH_SOURCE_PATHS = Object.freeze(
  APP_SOURCE_PATHS.filter((relativePath) => !APP_FIXTURE_ONLY_SOURCE_PATHS.includes(relativePath)),
);

const CURRENT_APP_SOURCE_RECEIPT_PATHS = Object.freeze(
  [...APP_SOURCE_PATHS, ...M10A_T11_REACHABLE_APP_SOURCE_PATHS].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  ),
);

const CURRENT_APP_GRAPH_SOURCE_PATHS = Object.freeze(
  [...APP_GRAPH_SOURCE_PATHS, ...M10A_T11_REACHABLE_APP_SOURCE_PATHS].sort((left, right) =>
    left.localeCompare(right, "en-US"),
  ),
);

/** Complete T12 inventory, including the still-non-executable T10 navigation helper. */
const M10A_T12_CURRENT_APP_SOURCE_INVENTORY_PATHS = Object.freeze(
  [
    ...APP_SOURCE_PATHS,
    ...M10A_T10_ISOLATED_APP_SOURCE_PATHS,
    ...M10A_T11_REACHABLE_APP_SOURCE_PATHS,
    ...M10A_T12_ADDED_APP_SOURCE_PATHS,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// T13 adds an App-local IndexedDB adapter. It is intentionally outside the frozen T12 graph
// projection, but the live source inventory must admit the additive successor file so the older
// browser proof can continue to authenticate its exact historical graph without treating T13 as
// an unreviewed mutation.
const M10A_T13_ADDED_APP_SOURCE_PATHS = Object.freeze([
  "apps/desen-app/src/design-system-asset-storage.ts",
]);
const M10A_T12_LIVE_APP_SOURCE_INVENTORY_PATHS = Object.freeze(
  [...M10A_T12_CURRENT_APP_SOURCE_INVENTORY_PATHS, ...M10A_T13_ADDED_APP_SOURCE_PATHS].sort(
    (left, right) => left.localeCompare(right, "en-US"),
  ),
);

// Unlike the older T11 bridge, T12 reads a receipt for every current App source, including
// inventory-only code, before it can project any historical graph.
const M10A_T12_APP_SOURCE_RECEIPT_PATHS = M10A_T12_CURRENT_APP_SOURCE_INVENTORY_PATHS;

const M10A_T12_APP_GRAPH_SOURCE_PATHS = Object.freeze(
  [
    ...APP_GRAPH_SOURCE_PATHS,
    ...M10A_T11_REACHABLE_APP_SOURCE_PATHS,
    ...M10A_T12_REACHABLE_T10_APP_SOURCE_PATHS,
    ...M10A_T12_ADDED_APP_SOURCE_PATHS,
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);

// Current inventory and executable reachability are deliberately separate. T15's persistence
// interfaces have no runtime code; T13's storage adapter and T10's navigation factory stay dormant.
const M10A_T15_APP_SOURCE_RECEIPT_PATHS = Object.freeze(
  [
    ...M10A_T12_LIVE_APP_SOURCE_INVENTORY_PATHS,
    ...M10A_T15_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T17_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T18_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T19_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
  ].sort((left, right) => left.localeCompare(right, "en-US")),
);
const M10A_T15_APP_GRAPH_SOURCE_PATHS = Object.freeze(
  [
    ...M10A_T12_APP_GRAPH_SOURCE_PATHS,
    ...M10A_T15_ADDED_APP_SOURCE_RECEIPTS.filter(
      ({ path: sourcePath }) => sourcePath !== "apps/desen-app/src/authoring-persistence-types.ts",
    ).map(({ path: sourcePath }) => sourcePath),
    ...M10A_T17_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T18_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T19_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
  ].sort((left, right) => left.localeCompare(right, "en-US")),
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

const T01A_ANCESTOR_GAP_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/package.json",
    bytes: 4_122,
    sha256: "7038647aa1809f07ee5131d0df8d0bee75bf1f2cdf0358be738b2c3603b64577",
  }),
]);

const DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS = Object.freeze({
  path: "pnpm-lock.yaml",
  currentBytes: 132_006,
  historicalBytes: 132_012,
  currentSha256: "0f968b0c6622f6bfe732d5ec9a2b6a49268e171a64fae6caf9501f6d25f8f074",
  historicalSha256: "f1165af2748866387a09d87dcf56a2e9036d553503256312051ce9c15a5ef8b8",
  predecessor: Object.freeze({
    authority: "SEC-01",
    bytes: 132_012,
    sha256: "49f1d521ebd2e097508d22f8235e111bfb7e6bdc26a039b517a4a19aba7b2735",
  }),
});

const M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T01",
  bytes: 138_171,
  sha256: "2d7d284b3f32e1dedc94161aef6f012f7e86913c9f50437edb64630ba14bc31f",
  predecessor: Object.freeze({
    authority: "M10-T08",
    bytes: 132_210,
    sha256: "f2ba3d3f38b1cee1ef369f8ea138f476bbf4574931262563b9f550937c9cae6c",
  }),
});

const M10A_T01_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze([
      "  apps/starter-catalog-web-proof:\n",
      "  packages/starter-catalog-web:\n",
    ]),
  }),
  Object.freeze({
    section: "packages",
    headers: Object.freeze([
      "  '@base-ui/react@1.8.0':\n",
      "  '@base-ui/utils@0.4.0':\n",
      "  '@floating-ui/core@1.8.0':\n",
      "  '@floating-ui/dom@1.8.0':\n",
      "  '@floating-ui/react-dom@2.1.9':\n",
      "  '@floating-ui/utils@0.2.12':\n",
      "  reselect@5.3.0:\n",
      "  use-sync-external-store@1.6.0:\n",
    ]),
  }),
  Object.freeze({
    section: "snapshots",
    headers: Object.freeze([
      "  '@base-ui/react@1.8.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@base-ui/utils@0.4.0(@types/react@19.2.17)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@floating-ui/core@1.8.0':\n",
      "  '@floating-ui/dom@1.8.0':\n",
      "  '@floating-ui/react-dom@2.1.9(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':\n",
      "  '@floating-ui/utils@0.2.12': {}\n",
      "  reselect@5.3.0: {}\n",
      "  use-sync-external-store@1.6.0(react@19.2.8):\n",
    ]),
  }),
]);

const M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T02",
  bytes: 138_555,
  sha256: "686319cce7bafbfcb62750dbc02abcc23ce95b13a760cb496974a5f129690b76",
  predecessor: Object.freeze({
    authority: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T02_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze(["  packages/design-system-core:\n"]),
  }),
]);

const M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T03",
  bytes: 139_714,
  sha256: "073a9dc3f6ce05d8e7672a74eea9296b4fee7ed8db9858cdd90731beed7ec74a",
  predecessor: Object.freeze({
    authority: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T03_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze([
      "  apps/design-system-workbench-proof:\n",
      "  packages/design-system-authoring:\n",
    ]),
  }),
]);

const M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T04",
  bytes: 140_115,
  sha256: "70c1ad1d1c20a7023e8cc568ad6a718d74bd9147c92ea63f2fffc1e59e391ccd",
  predecessor: Object.freeze({
    authority: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T04_LOCKFILE_ADDED_ENTRIES = Object.freeze([
  Object.freeze({
    section: "importers",
    headers: Object.freeze(["  packages/design-system-release:\n"]),
  }),
]);

const M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T10",
  bytes: 140_361,
  sha256: "c233c161fe79c5931576d4ce079ebb65f8295ed49903a4617f9166902dac4fe1",
  predecessor: Object.freeze({
    authority: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T10_LOCKFILE_ADDED_FRAGMENTS = Object.freeze([
  "      '@desen/design-system-core':\n        specifier: workspace:*\n        version: link:../../packages/design-system-core\n",
  "      '@desen/starter-catalog-web':\n        specifier: workspace:*\n        version: link:../../packages/starter-catalog-web\n",
]);

/**
 * T12 adds the already-reviewed neutral authoring package to the normal App composition.
 * The lockfile has no transitive resolution change: this one importer fragment is the entire
 * exact successor and must reproduce the T10 receipt byte-for-byte when removed.
 */
const M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T12",
  bytes: 140_493,
  sha256: "a207a5de2bc071f801ab3771ac7d5115c298149f97c92b0453654111a09c917a",
  predecessor: Object.freeze({
    authority: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T12_LOCKFILE_ADDED_FRAGMENTS = Object.freeze([
  "      '@desen/design-system-authoring':\n        specifier: workspace:*\n        version: link:../../packages/design-system-authoring\n",
]);

// T13 adds the local asset package and bundled Inter font. pnpm also records the Vite peer
// context introduced by the new package's Vitest test surface; the exact inverse below projects
// the live T13 lockfile back to the frozen T12 receipt without accepting arbitrary edits.
const M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT = Object.freeze({
  authority: "M10A-T13",
  bytes: 141_822,
  sha256: "2973a4c7af7283756095e12ed8b4c39c456027987b7a8e3352d0b6680162feb8",
  predecessor: Object.freeze({
    authority: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    bytes: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
    sha256: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
  }),
});

const M10A_T13_LOCKFILE_INVERSE = Object.freeze([
  Object.freeze({
    current:
      "      '@desen/design-system-assets':\n        specifier: workspace:*\n        version: link:../../packages/design-system-assets\n",
    predecessor: "",
  }),
  Object.freeze({
    current:
      "      '@fontsource-variable/inter':\n        specifier: 5.3.0\n        version: 5.3.0\n",
    predecessor: "",
  }),
  Object.freeze({
    current:
      "  packages/design-system-assets:\n    dependencies:\n      '@desen/protocol':\n        specifier: workspace:*\n        version: link:../protocol\n    devDependencies:\n      vitest:\n        specifier: 4.1.10\n        version: 4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)(vite@8.1.5(@types/node@24.13.3))\n\n",
    predecessor: "",
  }),
  Object.freeze({
    current:
      "  '@fontsource-variable/inter@5.3.0':\n    resolution: {integrity: sha512-OupL48va4JNofb97w6NYeF9S7W/kHNKM0Er8Dem5nqi4jeOLrVJDoE8tZEpnMJmtkvNbB1EIPPwHcdkF6b1oUA==}\n\n",
    predecessor: "",
  }),
  Object.freeze({
    current: "  '@fontsource-variable/inter@5.3.0': {}\n\n",
    predecessor: "",
  }),
  Object.freeze({
    current: "      jsdom: '*'\n      vite: ^6.0.0 || ^7.0.0 || ^8.0.0\n",
    predecessor: "      jsdom: '*'\n",
  }),
  Object.freeze({
    current: "      - msw\n",
    predecessor:
      "      - '@vitejs/devtools'\n      - esbuild\n      - jiti\n      - less\n      - msw\n      - sass\n      - sass-embedded\n      - stylus\n      - sugarss\n      - terser\n      - tsx\n      - yaml\n",
  }),
]);

const M10A_T10_APP_PACKAGE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/package.json",
  bytes: 4_864,
  sha256: "8b8cedadbd884e6f337f6c9460d7db95cfd77c446fcf72ba2a0ddcc917a6846f",
  predecessor: Object.freeze({
    bytes: 4_621,
    sha256: "133b549eca53d3f4438259bf020f13ec6e14597e9b05edfa74440191cd67cd1c",
  }),
  inverseChanges: Object.freeze([
    '    "test:project-lifecycle": "vitest run test/project-lifecycle.test.ts test/project-lifecycle-navigation.test.ts test/starter-project.test.ts",\n',
    '    "@desen/design-system-core": "workspace:*",\n',
    '    "@desen/starter-catalog-web": "workspace:*",\n',
  ]),
});

/**
 * M10A-T10 admits only the two already-declared design-system dependencies at the
 * Desen App composition boundary. This successor must project back to the exact
 * M10A-T04 policy before the frozen M10 reader evaluates its historical chain.
 */
const M10A_T10_T04_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_914,
    sha256: "aac2ce1bfcaa2e81b488f688d1a4f9a0e02ac97958f1eb90a95f16c0d112fa4c",
    predecessor: Object.freeze({
      bytes: 16_861,
      sha256: "db92e8d8d3596a9c6484a58df61ecc090c4e83164fee523ae3eca64cf9e8bac5",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '    "editor-web",\n    "design-system-core",\n    "reference-catalog-web",\n',
        '    "editor-web",\n    "reference-catalog-web",\n',
      ]),
      Object.freeze([
        '    "reference-catalog-web",\n    "starter-catalog-web",\n    "testkit",\n',
        '    "reference-catalog-web",\n    "testkit",\n',
      ]),
    ]),
  }),
]);

const M10A_T01_T08_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_189,
    sha256: "e78d9f77c35eae01ea145944fc17f4f416aed89505ffdc96836d5fc6457cf069",
    predecessor: Object.freeze({
      bytes: 15_181,
      sha256: "9d1b7d5f78fd4e0d356183b21f237b8e4e98b8df9d5ad625fdd73fe4f357cb60",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '  "starter-catalog-web": ["protocol", "catalog-sdk", "runtime-react"],\n',
        "",
      ]),
      Object.freeze([
        '  "starter-catalog-web-proof": [\n    "protocol",\n    "editor-core",\n    "publisher",\n    "runtime-core",\n    "runtime-react",\n    "starter-catalog-web",\n  ],\n',
        "",
      ]),
      Object.freeze([
        '    {\n      name: "starter-proof-host-has-no-authoring",\n      severity: "error",\n      comment:\n        "The independent starter browser host and shared runtime consume Bundles, never authoring, publishing or App code.",\n      from: { path: "^apps/starter-catalog-web-proof/src/(?:host|shared)/" },\n      to: {\n        path: "^(?:packages/(?:editor-core|editor-web|publisher|testkit|desen)/|apps/)",\n        pathNot: "^apps/starter-catalog-web-proof/src/(?:(?:host|shared)/|application\\\\.css$)",\n      },\n    },\n    {\n      name: "starter-proof-has-no-other-apps",\n      severity: "error",\n      from: { path: "^apps/starter-catalog-web-proof/" },\n      to: { path: "^apps/(?!starter-catalog-web-proof/)" },\n    },\n',
        "",
      ]),
      Object.freeze([
        '          "^packages/(?:runtime-react|runtime-web|editor-web|reference-catalog-web|starter-catalog-web)/",\n          "(?:^|/)node_modules/@base-ui/",\n',
        '          "^packages/(?:runtime-react|runtime-web|editor-web|reference-catalog-web)/",\n',
      ]),
    ]),
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 9_606,
    sha256: "b80b30a52db67ba93c9d705566e3c7db453c98bc42e6cc7b0e7a68bb8efaee62",
    predecessor: Object.freeze({
      bytes: 9_049,
      sha256: "03b0c558fc9803726c09b03ca3c31b4df0f2f44acf3f9f18b8c64dc2d8f3856d",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '  { name: "allowed-starter-runtime-react", expectedRule: null },\n  {\n    name: "starter-imports-editor-core",\n    expectedRule: "package-starter-catalog-web-allowed-dependencies",\n  },\n  { name: "starter-imports-app", expectedRule: "packages-never-import-apps" },\n  { name: "neutral-imports-starter", expectedRule: "neutral-packages-no-frameworks" },\n  {\n    name: "starter-proof-host-imports-publisher",\n    expectedRule: "starter-proof-host-has-no-authoring",\n  },\n  { name: "starter-proof-imports-app", expectedRule: "starter-proof-has-no-other-apps" },\n',
        "",
      ]),
    ]),
  }),
]);

const M10A_T02_T01_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_261,
    sha256: "4c70efb8588360fd51722e0ea0dc507ae006d2628daccbd26277785b2f91c3ec",
    predecessor: Object.freeze({
      bytes: 16_189,
      sha256: "e78d9f77c35eae01ea145944fc17f4f416aed89505ffdc96836d5fc6457cf069",
    }),
    inverseChanges: Object.freeze([
      Object.freeze(['  "design-system-core": ["protocol", "editor-core"],\n', ""]),
      Object.freeze([
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core)/src/";',
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core)/src/";',
      ]),
    ]),
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 10_148,
    sha256: "9a6b89593d2d215bb2bc2fb835400497f156fa9a29858a87af312c920410d0a8",
    predecessor: Object.freeze({
      bytes: 9_606,
      sha256: "b80b30a52db67ba93c9d705566e3c7db453c98bc42e6cc7b0e7a68bb8efaee62",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '  { name: "allowed-design-system-editor-core", expectedRule: null },\n  {\n    name: "design-system-imports-runtime-core",\n    expectedRule: "package-design-system-core-allowed-dependencies",\n  },\n  {\n    name: "design-system-imports-validator",\n    expectedRule: "package-design-system-core-allowed-dependencies",\n  },\n  {\n    name: "runtime-core-imports-design-system",\n    expectedRule: "package-runtime-core-allowed-dependencies",\n  },\n  {\n    name: "design-system-imports-node",\n    expectedRule: "neutral-packages-no-node-builtins",\n  },\n',
        "",
      ]),
    ]),
  }),
]);

const M10A_T03_T02_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_776,
    sha256: "344d1dfda896882d8b4a49a71a34e698a5a2d69bd0a0830d42fb8ccfc8e827ff",
    predecessor: Object.freeze({
      bytes: 16_261,
      sha256: "4c70efb8588360fd51722e0ea0dc507ae006d2628daccbd26277785b2f91c3ec",
    }),
    inverseChanges: Object.freeze([
      Object.freeze(['  "design-system-authoring": ["protocol", "design-system-core"],\n', ""]),
      Object.freeze(['  "design-system-workbench-proof": ["design-system-authoring"],\n', ""]),
      Object.freeze([
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core|design-system-authoring)/src/";',
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core)/src/";',
      ]),
      Object.freeze([
        '    {\n      name: "design-system-workbench-proof-has-no-other-apps",\n      severity: "error",\n      comment:\n        "The isolated design-system workbench proof cannot acquire Desen App or another application composition root.",\n      from: { path: "^apps/design-system-workbench-proof/" },\n      to: { path: "^apps/(?!design-system-workbench-proof/)" },\n    },\n',
        "",
      ]),
    ]),
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 10_829,
    sha256: "32c7c5d55a329858f2be8c8973bd1e36b47e20647a24b9afef00e6f582a6f7bd",
    predecessor: Object.freeze({
      bytes: 10_148,
      sha256: "9a6b89593d2d215bb2bc2fb835400497f156fa9a29858a87af312c920410d0a8",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '  { name: "allowed-design-system-authoring-foundations", expectedRule: null },\n  { name: "allowed-design-system-workbench-authoring", expectedRule: null },\n  {\n    name: "design-system-authoring-imports-runtime-core",\n    expectedRule: "package-design-system-authoring-allowed-dependencies",\n  },\n  {\n    name: "design-system-authoring-imports-node",\n    expectedRule: "neutral-packages-no-node-builtins",\n  },\n  {\n    name: "design-system-workbench-imports-core",\n    expectedRule: "application-design-system-workbench-proof-allowed-dependencies",\n  },\n  {\n    name: "design-system-workbench-imports-app",\n    expectedRule: "design-system-workbench-proof-has-no-other-apps",\n  },\n',
        "",
      ]),
    ]),
  }),
]);

/**
 * M10A-T04 adds only the neutral release package boundary and its three negative/positive
 * fixture cases. The M10-T05 historical reader still needs the exact T03 bytes when it
 * authenticates the older reviewed published-host evidence, so this inverse projector is
 * deliberately narrow and receipt-pinned.
 */
const M10A_T04_T03_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_861,
    sha256: "db92e8d8d3596a9c6484a58df61ecc090c4e83164fee523ae3eca64cf9e8bac5",
    predecessor: Object.freeze({
      bytes: 16_776,
      sha256: "344d1dfda896882d8b4a49a71a34e698a5a2d69bd0a0830d42fb8ccfc8e827ff",
    }),
    inverseChanges: Object.freeze([
      Object.freeze(['  "design-system-release": ["protocol", "design-system-core"],\n', ""]),
      Object.freeze([
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core|design-system-authoring|design-system-release)/src/";',
        '"^packages/(protocol|validator|publisher|catalog-sdk|runtime-core|editor-core|design-system-core|design-system-authoring)/src/";',
      ]),
    ]),
  }),
  Object.freeze({
    path: "scripts/verify-boundary-fixtures.mjs",
    bytes: 11_155,
    sha256: "8a5e0d102b3956c387fff6d1e6c18435dd6b2d1a50dc16fcdf72839697d1ca46",
    predecessor: Object.freeze({
      bytes: 10_829,
      sha256: "32c7c5d55a329858f2be8c8973bd1e36b47e20647a24b9afef00e6f582a6f7bd",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '  { name: "allowed-design-system-release-foundations", expectedRule: null },\n  {\n    name: "design-system-release-imports-runtime-core",\n    expectedRule: "package-design-system-release-allowed-dependencies",\n  },\n  {\n    name: "design-system-release-imports-node",\n    expectedRule: "neutral-packages-no-node-builtins",\n  },\n',
        "",
      ]),
    ]),
  }),
]);

const M10A_T01_APP_GRAPH_SUCCESSOR = Object.freeze({
  graphSha256: "sha256:df612d09ef98ae388987343948b76e2d4b2ba76c283e840a1266dc6105211e2e",
  modules: Object.freeze([
    Object.freeze({
      id: "packages/editor-core/dist/index.js",
      codeBytes: 1_536,
      codeSha256: "sha256:46793348193ec7cc51915c6a83813654d32810b93a10e1efe953c9c895f8ac51",
    }),
    Object.freeze({
      id: "packages/editor-core/dist/stable-id-insert.js",
      codeBytes: 34_011,
      codeSha256: "sha256:7e7c3cb82f589eb73dc31076e6b8909c9ede3d2a92d8fc2b22b644f767c9e726",
    }),
  ]),
  entryOutput: Object.freeze({
    fileName: "assets/index-z0KPy9Yo.js",
    bytes: 1_539_917,
    sha256: "sha256:178e53f57447e8e8d4a1dd5728c2deb0645e90f65c58962b098cc9750609475e",
  }),
  htmlSha256: "sha256:f543302dc9ad6b267f5e6e1df5a05a65352f15e959d7d2ca9d3a9673288278f7",
  outputIdentitySha256: "sha256:b1e80809142c6d7941e221e517e67720bd1b5f46fae7a05f2430ed93b61a6475",
  backingSnapshotSha256: "sha256:9fb4dc9cd9443fbda9b2d840b3cc4052fde0f63ce24f328f835381c6ded9540b",
});

/**
 * The complete T11 source delta is receipt-pinned before any historical M10 proof is projected.
 * The three existing files are replacements; the two named modules are the only new reachable
 * product sources. This lets an older proof stay immutable without accepting arbitrary App edits.
 */
const M10A_T11_APP_SOURCE_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/src/application.module.css",
    bytes: 122_621,
    sha256: "sha256:08e85c9b6793d54d265e7512a27a735b5b14977eb97c810da8ccf01ef2b7d410",
  }),
  Object.freeze({
    path: "apps/desen-app/src/application.tsx",
    bytes: 168_750,
    sha256: "sha256:6480a98ce6597ddb5d4cbb2abce100719fa88a5907731458800d9d829c33a827",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-direct-manipulation.ts",
    bytes: 11_671,
    sha256: "sha256:05d24fc35b2e57ea30d85ab2cbcd875ec5952dfed8828ce6dadbf07cd7c5f20c",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-slots.ts",
    bytes: 59_517,
    sha256: "sha256:6530c05bfbbcac49137a3759ce81471204d957b5932c267148820f044c10a8ed",
  }),
  Object.freeze({
    path: "apps/desen-app/src/canvas-manipulation-controls.tsx",
    bytes: 4_262,
    sha256: "sha256:fd3213e4c3901542dd959e09936be99402fcdc9e55b13383ec72ead75ab0dbf0",
  }),
]);

const M10A_T11_APP_GRAPH_SUCCESSOR = Object.freeze({
  app: Object.freeze({
    moduleCount: 172,
    staticEdges: 525,
    dynamicEdges: 0,
    unresolvedEdges: 0,
    reachableProductionSourceFiles: 54,
    graphSha256: "sha256:b811e2c3101e62f480917a027bcc0d7fdf8754ff8fbb66f09e4e0bab0880779f",
  }),
  completeAppSourceFiles: 56,
  transformedModules: Object.freeze([
    Object.freeze({
      id: "apps/desen-app/src/application.module.css",
      codeBytes: 32_956,
      codeSha256: "sha256:833a09c350f26603cd598a1bd64853f3b7e9fc919a04df4a140fc878cfda9cea",
    }),
    Object.freeze({
      id: "apps/desen-app/src/application.tsx",
      codeBytes: 141_441,
      codeSha256: "sha256:af7c49cfc10ec2a1b1965a364b41e8c3ea113860722f840e4ceadbc8f24b1653",
    }),
    Object.freeze({
      id: "apps/desen-app/src/authoring-slots.ts",
      codeBytes: 43_536,
      codeSha256: "sha256:ab13318be6f94257c9ef4bb74621f4c5e3c8d6fe925fa6b4a225e6aba0533471",
    }),
  ]),
  addedModules: Object.freeze([
    Object.freeze({
      id: "apps/desen-app/src/authoring-direct-manipulation.ts",
      imports: Object.freeze([]),
      dynamicImports: Object.freeze([]),
      codeBytes: 8_266,
      codeSha256: "sha256:17cc0b07fd78d55e878846acac36c3346a7d67db42a11c1f8be3ca1aeeb141fd",
    }),
    Object.freeze({
      id: "apps/desen-app/src/canvas-manipulation-controls.tsx",
      imports: Object.freeze([
        "apps/desen-app/src/application.module.css",
        "node_modules/react/jsx-runtime.js",
      ]),
      dynamicImports: Object.freeze([]),
      codeBytes: 4_032,
      codeSha256: "sha256:149cef80d687d01f0675253fdccfe107536615652af66a5e7015db06830b111e",
    }),
  ]),
  appOutput: Object.freeze({
    files: 3,
    outputs: Object.freeze([
      Object.freeze({
        fileName: "assets/index-DXWMEQ_S.css",
        type: "asset",
        isEntry: null,
        bytes: 116_796,
        sha256: "sha256:d87798f6630cdaab71b4ec856d7398d95d2062b1883cc7a37d57ce150b734be9",
      }),
      Object.freeze({
        fileName: "assets/index-EeQmysjL.js",
        type: "chunk",
        isEntry: true,
        bytes: 1_554_421,
        sha256: "sha256:c468b47003b4485c529c15e1dc3e6ae65540b3dc89bb7a8198691e135c15c140",
      }),
      Object.freeze({
        fileName: "index.html",
        type: "asset",
        isEntry: null,
        bytes: 511,
        sha256: "sha256:d6c78cbdc37cf709f0c97d23b20d8b953c07be7d244ebc81fb0b202b428715b2",
      }),
    ]),
    identitySha256: "sha256:7bdb556fb86a782566d14e1a59fb6c56eec2db0f9a7508be407fa44589d1827d",
  }),
  backingFiles: 189,
  backingSnapshotSha256: "sha256:a4c75360c41618aafbdb2846dddc719ac8a4e0f34366e778a9871263255c23d7",
});

/**
 * Every T12 replacement/new App source is content-addressed before the graph successor is
 * accepted. The two unchanged T10 lifecycle files are separately receipt-pinned below because
 * T11 deliberately kept its lifecycle inventory receipt-free.
 */
const M10A_T12_APP_SOURCE_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/src/application.module.css",
    bytes: 133_516,
    sha256: "sha256:12d0647cb988870dfe77f4e348e0cf57eb201df0eb8fe8e5845ae37e018504bc",
  }),
  Object.freeze({
    path: "apps/desen-app/src/application.tsx",
    bytes: 174_486,
    sha256: "sha256:5074eea22b007f680d2f6b14e3e66ab2fb4ebc146d33077e5bc623c77ffda151",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-data.ts",
    bytes: 33_278,
    sha256: "sha256:b759d8b68e118e36dffdd8ac637251c048c6dfb75bcd7afcad173cd84d8a8b61",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-design-tokens.ts",
    bytes: 5_150,
    sha256: "sha256:66f48f4f4f8ab89a18b6ea24a7b42c3dab171345ff1eecba6bf14c634bfe3833",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-inspector.ts",
    bytes: 39_061,
    sha256: "sha256:abbc6fb9d844c067f2fb9c8acea9617ca1e8e0a04354dd8d2fc47d61a6b87145",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-style-preview-runtime.ts",
    bytes: 5_449,
    sha256: "sha256:7ab842b881d4ccfcc5f769dc80bd06f79d23b6e419848ce17ec179c3c142c8a5",
  }),
  Object.freeze({
    path: "apps/desen-app/src/authoring-styles.ts",
    bytes: 50_494,
    sha256: "sha256:766adea2e706dd03fe443788bf0b76c070b90c8dfca358b0aad6537cf1a9d03e",
  }),
  Object.freeze({
    path: "apps/desen-app/src/inspector-panel.tsx",
    bytes: 35_107,
    sha256: "sha256:f5f63d93e0d4a5a73fa652d6b07b3b068fc3b0015aaec385f26085932a3d6bc8",
  }),
  Object.freeze({
    path: "apps/desen-app/src/local-project-workspace-persistence.ts",
    bytes: 13_501,
    sha256: "sha256:7803a72208e6693440aecaea535faf5474a46fc1fc878b624eb16a9c45cb31c9",
  }),
  Object.freeze({
    path: "apps/desen-app/src/main.tsx",
    bytes: 6_793,
    sha256: "sha256:03f4c3040c67c4d3644c71835b347ea96fc861a155b217ab87b8ff8277973393",
  }),
  Object.freeze({
    path: "apps/desen-app/src/preview-fidelity.ts",
    bytes: 7_961,
    sha256: "sha256:a5015bf788238e0534da6129e92efe4a425e5580e8229f51f40805d8ffafccc4",
  }),
  Object.freeze({
    path: "apps/desen-app/src/product-bootstrap.tsx",
    bytes: 16_148,
    sha256: "sha256:ec5519ca8ca6053f8bce80665b1636d4ce962acd1b3c6208178fca7c19c3aab8",
  }),
  Object.freeze({
    path: "apps/desen-app/src/project-workspace-authoring-persistence.ts",
    bytes: 10_796,
    sha256: "sha256:895ee4af157f7f8191a95376e98d8cb7756816c348649cf410071b44673df830",
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-neutral-workspace-profile.ts",
    bytes: 3_634,
    sha256: "sha256:5273a112ba2b39dcb01737c9786f6a2cb10f8f167b2abadcd353958a60e214fb",
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-project.ts",
    bytes: 4_000,
    sha256: "sha256:00c43f860cc94e5f8dd97b4de5b9a65e55ce6116bf881d31b670713b7a54afa5",
  }),
  Object.freeze({
    path: "apps/desen-app/src/starter-workspace-product.tsx",
    bytes: 1_774,
    sha256: "sha256:7cab34f631ba051ff04e5797a9c27367c5fb88b9a29be942852c59f908b1a587",
  }),
  Object.freeze({
    path: "apps/desen-app/src/style-panel.tsx",
    bytes: 65_544,
    sha256: "sha256:424abb192f510104aca344d6cdef48b466df4aae15bb9bdb9943638b5bc9f191",
  }),
]);

// T14 changes only the live App authoring surface. This additive receipt projects the current
// history/reuse implementation back to the frozen T12 source.
const M10A_T14_APP_SOURCE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/src/application.tsx",
  bytes: 184_768,
  sha256: "sha256:4fcc90c0c7af787cefd2a02af795789d9eb89aee139366ba9e4b328e153f7e58",
  predecessor: Object.freeze({
    bytes: 174_486,
    sha256: "sha256:5074eea22b007f680d2f6b14e3e66ab2fb4ebc146d33077e5bc623c77ffda151",
  }),
  inverseChanges: Object.freeze([
    Object.freeze([
      "function SurfaceEditor({\n  authoringClipboard,\n  authoringProjectRecord,\n",
      "function SurfaceEditor({\n  authoringProjectRecord,\n",
    ]),
    Object.freeze([
      "  /** Project-scoped clipboard authority retained while admitted surfaces remount. */\n  readonly authoringClipboard: { current: DesenEditorClipboardPayload | null };\n",
      "",
    ]),
    Object.freeze([
      '  const [historyNotice, setHistoryNotice] = useState("");\n',
      '  const authoringClipboard = useRef<DesenEditorClipboardPayload | null>(null);\n  const [historyNotice, setHistoryNotice] = useState("");\n',
    ]),
    Object.freeze([
      "      selectedSourceNodeIds.length > 0\n        ? selectedSourceNodeIds\n",
      "      directSelections.length > 0\n        ? directSelections.map(({ sourceNodeId }) => sourceNodeId)\n",
    ]),
    Object.freeze([
      "  const clipboardAuthorityId = `${workspaceProfileMountIdentity(workspaceProfile)}:${project.id}`;\n  const clipboardScope = useRef<{\n    authorityId: string;\n    store: { current: DesenEditorClipboardPayload | null };\n  }>({ authorityId: clipboardAuthorityId, store: { current: null } });\n  if (clipboardScope.current.authorityId !== clipboardAuthorityId) {\n    clipboardScope.current = { authorityId: clipboardAuthorityId, store: { current: null } };\n  }\n\n",
      "",
    ]),
    Object.freeze(["      authoringClipboard={clipboardScope.current.store}\n", ""]),
    Object.freeze([
      '    let nextHistory: DesenEditorHistory;\n    const currentHistory = authoringHistory.current;\n    if (resetsHistory || currentHistory === null) {\n      const resetHistory = createDesenEditorHistory(nextSession.document);\n      if (resetHistory === undefined)\n        throw new TypeError("The bounded authoring history could not be reset.");\n      nextHistory = resetHistory;\n    } else {\n      const recorded = recordDesenEditorHistory(currentHistory, nextSession.document);\n      if (!recorded.ok)\n        throw new TypeError("The bounded authoring history rejected an admitted document.");\n      nextHistory = recorded.history;\n    }\n    const canonicalDocument = canonicalizeJson(nextSession.document);\n    inMemoryCurrentCanonical.current = canonicalDocument;\n    if (establishesBaseline) inMemoryBaselineCanonical.current = canonicalDocument;\n    authoringHistory.current = nextHistory;\n',
      '    const canonicalDocument = canonicalizeJson(nextSession.document);\n    inMemoryCurrentCanonical.current = canonicalDocument;\n    if (establishesBaseline) inMemoryBaselineCanonical.current = canonicalDocument;\n    const currentHistory = authoringHistory.current;\n    if (resetsHistory || currentHistory === null) {\n      const nextHistory = createDesenEditorHistory(nextSession.document);\n      if (nextHistory === undefined)\n        throw new TypeError("The bounded authoring history could not be reset.");\n      authoringHistory.current = nextHistory;\n    } else {\n      authoringHistory.current = recordDesenEditorHistory(currentHistory, nextSession.document);\n    }\n',
    ]),
    Object.freeze([
      "  function copySelectedLayers(): DesenEditorClipboardPayload | null {\n",
      "  function copySelectedLayers(): void {\n",
    ]),
    Object.freeze([
      "    if (!isDesignMode()) return null;\n    const nodeIds = selectedReuseNodeIds();\n",
      "    if (!isDesignMode()) return;\n    const nodeIds = selectedReuseNodeIds();\n",
    ]),
    Object.freeze([
      '      setHistoryNotice("Select at least one layer before copying.");\n      return null;\n',
      '      setHistoryNotice("Select at least one layer before copying.");\n      return;\n',
    ]),
    Object.freeze([
      '      setHistoryNotice("Copy was rejected safely: the selection is no longer current.");\n      return null;\n',
      '      setHistoryNotice("Copy was rejected safely: the selection is no longer current.");\n      return;\n',
    ]),
    Object.freeze(["    return result.payload;\n", ""]),
    Object.freeze([
      "  function pasteClipboardPayload(payload: DesenEditorClipboardPayload | null): void {\n    if (!isDesignMode()) return;\n    const target = reuseTarget();\n",
      "  function pasteSelectedLayers(): void {\n    if (!isDesignMode()) return;\n    const payload = authoringClipboard.current;\n    const target = reuseTarget();\n",
    ]),
    Object.freeze([
      "  function pasteSelectedLayers(): void {\n    pasteClipboardPayload(authoringClipboard.current);\n  }\n\n",
      "",
    ]),
    Object.freeze([
      "  function duplicateSelectedLayers(): void {\n    const payload = copySelectedLayers();\n    if (payload === null) return;\n    pasteClipboardPayload(payload);\n  }\n",
      "  function duplicateSelectedLayers(): void {\n    copySelectedLayers();\n    if (authoringClipboard.current === null) return;\n    pasteSelectedLayers();\n  }\n",
    ]),
    Object.freeze([
      'import {\n  captureDesenEditorClipboard,\n  createDesenEditorContinuousValidator,\n  createDesenEditorHistory,\n  pasteDesenEditorClipboard,\n  readDesenEditorNodePlacement,\n  recordDesenEditorHistory,\n  redoDesenEditorHistory,\n  undoDesenEditorHistory,\n} from "@desen/editor-core";\n',
      'import { createDesenEditorContinuousValidator } from "@desen/editor-core";\n',
    ]),
    Object.freeze(["  DesenEditorClipboardPayload,\n  DesenEditorHistory,\n", ""]),
    Object.freeze([
      '  const authoringHistory = useRef<DesenEditorHistory | null>(null);\n  if (authoringHistory.current === null) {\n    const createdHistory = createDesenEditorHistory(mountedInitialDocument);\n    if (createdHistory === undefined)\n      throw new TypeError("The bounded authoring history could not be created.");\n    authoringHistory.current = createdHistory;\n  }\n  const authoringClipboard = useRef<DesenEditorClipboardPayload | null>(null);\n  const [historyNotice, setHistoryNotice] = useState("");\n',
      "",
    ]),
    Object.freeze(["    resetsHistory = false,\n", ""]),
    Object.freeze([
      '    const currentHistory = authoringHistory.current;\n    if (resetsHistory || currentHistory === null) {\n      const nextHistory = createDesenEditorHistory(nextSession.document);\n      if (nextHistory === undefined)\n        throw new TypeError("The bounded authoring history could not be reset.");\n      authoringHistory.current = nextHistory;\n    } else {\n      authoringHistory.current = recordDesenEditorHistory(currentHistory, nextSession.document);\n    }\n',
      "",
    ]),
    Object.freeze(['    setHistoryNotice("");\n', ""]),
    Object.freeze([
      "    commitAuthoringSession(result.session, true, true);\n",
      "    commitAuthoringSession(result.session, true);\n",
    ]),
    Object.freeze([
      '  function selectedReuseNodeIds(): readonly string[] {\n    const ids =\n      directSelections.length > 0\n        ? directSelections.map(({ sourceNodeId }) => sourceNodeId)\n        : selection === null\n          ? []\n          : [selection.sourceNodeId];\n    return Object.freeze([...new Set(ids)]);\n  }\n\n  function validateReuseCandidate(\n    candidate: DesenEditorDocument,\n  ):\n    | Readonly<{ readonly ok: true; readonly preview: typeof preview }>\n    | Readonly<{ readonly ok: false }> {\n    if (!preparedModel.ok || diagnosticsValidator?.ok !== true) {\n      return Object.freeze({ ok: false as const });\n    }\n    const report = diagnosticsValidator.validator.validate(candidate);\n    if (!report.valid) {\n      captureEditDiagnostics(Object.freeze({ ok: false as const, validationReport: report }));\n      return Object.freeze({ ok: false as const });\n    }\n    const nextPreview = prepareAuthoringPreviewBundle(candidate, workspaceSnapshot.catalogPackages);\n    return nextPreview.ok\n      ? Object.freeze({ ok: true as const, preview: nextPreview })\n      : Object.freeze({ ok: false as const });\n  }\n\n  function copySelectedLayers(): void {\n    if (!isDesignMode()) return;\n    const nodeIds = selectedReuseNodeIds();\n    if (nodeIds.length === 0) {\n      setHistoryNotice("Select at least one layer before copying.");\n      return;\n    }\n    const result = captureDesenEditorClipboard(document, selectedSurface.sourceId, nodeIds);\n    if (!result.ok) {\n      setHistoryNotice("Copy was rejected safely: the selection is no longer current.");\n      return;\n    }\n    authoringClipboard.current = result.payload;\n    setHistoryNotice(\n      `Copied ${result.payload.nodes.length} layer${result.payload.nodes.length === 1 ? "" : "s"}.`,\n    );\n  }\n\n  function reuseTarget(): Readonly<{\n    readonly parentId: string;\n    readonly slot: string;\n    readonly index: number;\n  }> | null {\n    const nodeIds = selectedReuseNodeIds();\n    const anchorId = nodeIds.at(-1);\n    if (anchorId === undefined) return null;\n    const anchor = readDesenEditorNodePlacement(document, selectedSurface.sourceId, anchorId);\n    if (\n      anchor === null ||\n      anchor.parentId === null ||\n      anchor.slot === null ||\n      anchor.index === null\n    )\n      return null;\n    return Object.freeze({ parentId: anchor.parentId, slot: anchor.slot, index: anchor.index + 1 });\n  }\n\n  function pasteSelectedLayers(): void {\n    if (!isDesignMode()) return;\n    const payload = authoringClipboard.current;\n    const target = reuseTarget();\n    if (payload === null || target === null) {\n      setHistoryNotice("Choose a current layer and an App-captured clipboard selection first.");\n      return;\n    }\n    const result = pasteDesenEditorClipboard(document, {\n      payload,\n      surfaceId: selectedSurface.sourceId,\n      parentId: target.parentId,\n      slot: target.slot,\n      index: target.index,\n    });\n    if (!result.ok) {\n      setHistoryNotice("Paste was rejected safely; the authored Source is unchanged.");\n      return;\n    }\n    const admitted = validateReuseCandidate(result.document);\n    if (!admitted.ok) {\n      setHistoryNotice(\n        "Paste was rejected by the current Catalog contract; the Source is unchanged.",\n      );\n      return;\n    }\n    commitAuthoringSession(Object.freeze({ document: result.document, preview: admitted.preview }));\n    setHistoryNotice(\n      `Pasted ${result.insertedNodeIds.length} fresh layer${result.insertedNodeIds.length === 1 ? "" : "s"}.`,\n    );\n  }\n\n  function duplicateSelectedLayers(): void {\n    copySelectedLayers();\n    if (authoringClipboard.current === null) return;\n    pasteSelectedLayers();\n  }\n\n  function transitionHistory(direction: "undo" | "redo"): void {\n    if (!isDesignMode()) return;\n    const current = authoringHistory.current;\n    if (current === null) return;\n    const result =\n      direction === "undo" ? undoDesenEditorHistory(current) : redoDesenEditorHistory(current);\n    if (!result.ok) {\n      setHistoryNotice(direction === "undo" ? "Nothing to undo." : "Nothing to redo.");\n      return;\n    }\n    const nextPreview = prepareAuthoringPreviewBundle(\n      result.history.document,\n      workspaceSnapshot.catalogPackages,\n    );\n    if (!nextPreview.ok) {\n      setHistoryNotice(\n        "History transition was rejected because the preview boundary is unavailable.",\n      );\n      return;\n    }\n    authoringHistory.current = result.history;\n    inMemoryCurrentCanonical.current = canonicalizeJson(result.history.document);\n    updateInMemoryDirtyProjection();\n    clearTransientDiagnostics();\n    selectOne(null);\n    setAuthoringSession(Object.freeze({ document: result.history.document, preview: nextPreview }));\n    setHistoryNotice(direction === "undo" ? "Last edit undone." : "Edit restored.");\n  }\n\n  useEffect(() => {\n    function handleHistoryShortcut(event: globalThis.KeyboardEvent): void {\n      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;\n      const target = event.target;\n      if (\n        target instanceof HTMLInputElement ||\n        target instanceof HTMLTextAreaElement ||\n        target instanceof HTMLSelectElement ||\n        (target instanceof HTMLElement &&\n          (target.isContentEditable || target.contentEditable === "true"))\n      )\n        return;\n      if (event.key.toLowerCase() === "z") {\n        event.preventDefault();\n        transitionHistory(event.shiftKey ? "redo" : "undo");\n      } else if (event.key.toLowerCase() === "y") {\n        event.preventDefault();\n        transitionHistory("redo");\n      }\n    }\n    globalThis.document.addEventListener("keydown", handleHistoryShortcut);\n    return () => globalThis.document.removeEventListener("keydown", handleHistoryShortcut);\n  });\n\n',
      "",
    ]),
    Object.freeze([
      '  const historyState = authoringHistory.current;\n  const canUndo = mode === "design" && historyState !== null && historyState.past.length > 0;\n  const canRedo = mode === "design" && historyState !== null && historyState.future.length > 0;\n  const canReuseSelection = mode === "design" && selectedSourceNodeIds.length > 0;\n  const canPaste = canReuseSelection && authoringClipboard.current !== null;\n',
      "",
    ]),
    Object.freeze([
      '          <div aria-label="Authoring history and reuse" className={styles.modeControl}>\n            <button\n              aria-label="Undo last authoring edit"\n              data-history-action="undo"\n              disabled={!canUndo || sourceDraft !== null || publicationPending}\n              onClick={() => transitionHistory("undo")}\n              type="button"\n            >\n              Undo\n            </button>\n            <button\n              aria-label="Redo authoring edit"\n              data-history-action="redo"\n              disabled={!canRedo || sourceDraft !== null || publicationPending}\n              onClick={() => transitionHistory("redo")}\n              type="button"\n            >\n              Redo\n            </button>\n            <button\n              aria-label="Copy selected layers"\n              data-history-action="copy"\n              disabled={!canReuseSelection || sourceDraft !== null || publicationPending}\n              onClick={copySelectedLayers}\n              type="button"\n            >\n              Copy\n            </button>\n            <button\n              aria-label="Paste copied layers"\n              data-history-action="paste"\n              disabled={!canPaste || sourceDraft !== null || publicationPending}\n              onClick={pasteSelectedLayers}\n              type="button"\n            >\n              Paste\n            </button>\n            <button\n              aria-label="Duplicate selected layers"\n              data-history-action="duplicate"\n              disabled={!canReuseSelection || sourceDraft !== null || publicationPending}\n              onClick={duplicateSelectedLayers}\n              type="button"\n            >\n              Duplicate\n            </button>\n          </div>\n          <span aria-live="polite" className={styles.visuallyHidden} data-history-notice>\n            {historyNotice}\n          </span>\n',
      "",
    ]),
  ]),
});

/**
 * T12 also updates this pre-existing T08 wiring test to supply its new project-workspace port.
 * It is not a production graph source, so its exact successor receipt stays separately scoped.
 */
const M10A_T12_REPLACED_T08_INPUT_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/test/main-lifecycle.test.tsx",
    bytes: 11_323,
    sha256: "sha256:f6a2064bcf140e6531e2b708e5b3db31eaeb7df66b234412560825feae68c3f2",
  }),
]);

/**
 * T12 documentation and lifecycle-wiring inputs that were already tracked by the frozen T08
 * composition proof. Each inverse is content-addressed and reduces only its reviewed delta.
 */
const M10A_T12_T08_INPUT_SUCCESSORS = Object.freeze([
  Object.freeze({
    path: "dependency-cruiser.config.cjs",
    bytes: 16_945,
    sha256: "c8cb509ea87d9a25b49bb8ba389340d4304a1043b8fa2847d01331fdc78743d8",
    predecessor: Object.freeze({
      bytes: 16_914,
      sha256: "aac2ce1bfcaa2e81b488f688d1a4f9a0e02ac97958f1eb90a95f16c0d112fa4c",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        '    "design-system-core",\n    "design-system-authoring",\n    "reference-catalog-web",\n',
        '    "design-system-core",\n    "reference-catalog-web",\n',
      ]),
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app-browser-e2e/README.md",
    bytes: 11_437,
    sha256: "590ad3afffb1fee95c80e104b710a027be0754e5b01aa9c26f84e39fbdb21cac",
    predecessor: Object.freeze({
      bytes: 10_964,
      sha256: "18f465f4221158401dc9c03a804b248db27ba761d156bac4112047d0ab6a6dff",
    }),
    inverseChanges: Object.freeze([
      Object.freeze(["all ten Chromium journeys.\n", "all nine Chromium journeys.\n"]),
      Object.freeze([
        "The ten independently configured journeys cover:\n",
        "The nine independently configured journeys cover:\n",
      ]),
      Object.freeze([
        "- M10A-T12: a normal DESEN Neutral project is created through the visible product UI, then uses\n  closed Style controls to persist a literal component-level presentation and a resolved T02 token\n  presentation. It proves fixed Desktop, Tablet, and Mobile preview frames, narrower responsive\n  override precedence, reset inheritance, and aggregate-workspace persistence after reload. It\n  does not claim named-theme CRUD or a generic CSS, JSX, or JSON authoring escape hatch.\n",
        "",
      ]),
    ]),
  }),
  Object.freeze({
    path: "apps/desen-app/test/main-lifecycle.test.tsx",
    bytes: 11_323,
    sha256: "f6a2064bcf140e6531e2b708e5b3db31eaeb7df66b234412560825feae68c3f2",
    predecessor: Object.freeze({
      bytes: 10_743,
      sha256: "5ada9ae5cc3ea358986d666d8d40a414512dfb863fca4a959a60b331e48d636e",
    }),
    inverseChanges: Object.freeze([
      Object.freeze([
        'function injectProjectWorkspacePort(port: unknown = null) {\n  const createInjectedDesenAppLocalProjectWorkspaceStoragePort = vi.fn(\n    (browserFetchValue: unknown, optionsValue: unknown) => {\n      void browserFetchValue;\n      void optionsValue;\n      return port;\n    },\n  );\n  vi.doMock("../src/local-project-workspace-persistence.js", () => ({\n    createInjectedDesenAppLocalProjectWorkspaceStoragePort,\n  }));\n  return createInjectedDesenAppLocalProjectWorkspaceStoragePort;\n}\n\n',
        "",
      ]),
      Object.freeze(['  vi.doUnmock("../src/local-project-workspace-persistence.js");\n', ""]),
      Object.freeze(["  injectProjectWorkspacePort();\n", ""]),
    ]),
  }),
]);

/**
 * T12's Inspector Style view is projected exactly to the pre-T12/T06 Inspector before the
 * frozen invalid-publication bridge applies its older three-fragment inverse patch.
 */
const M10A_T12_INSPECTOR_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/src/inspector-panel.tsx",
  bytes: 35_107,
  sha256: "f5f63d93e0d4a5a73fa652d6b07b3b068fc3b0015aaec385f26085932a3d6bc8",
  predecessor: Object.freeze({
    bytes: 32_870,
    sha256: "b3701cab338477495cd4530e98ab9fd1eb700a2edcd981d662b46556dad23a47",
  }),
  inverseChanges: Object.freeze([
    Object.freeze(['import { StylePanel } from "./style-panel.js";\n', ""]),
    Object.freeze([
      'import type {\n  AuthoringResolvedStyleToken,\n  AuthoringStyleEdit,\n  AuthoringStyleEditResult,\n  AuthoringStyleModelResult,\n  AuthoringStyleTarget,\n} from "./authoring-styles.js";\n',
      "",
    ]),
    Object.freeze([
      "  /** Closed style model for the current Source selection; absent models intentionally stay idle. */\n  readonly styleModel?: AuthoringStyleModelResult | undefined;\n  /** Explicit resolved token choices presented only inside the Style view. */\n  readonly styleTokenOptions?: readonly AuthoringResolvedStyleToken[] | undefined;\n  /** App-owned Desktop, Tablet, or Mobile style layer selection. */\n  readonly styleTarget?: AuthoringStyleTarget | undefined;\n  /** Applies a sealed visual-style leaf edit from the Style view. */\n  readonly onStyleEdit?: ((edit: AuthoringStyleEdit) => AuthoringStyleEditResult) | undefined;\n  /** Switches the app-owned visual style layer without exposing raw variant predicates. */\n  readonly onStyleTargetChange?: ((target: AuthoringStyleTarget) => void) | undefined;\n",
      "",
    ]),
    Object.freeze([
      'type InspectorTab = "inspector" | "style" | "state" | "actions";\n\nconst IDLE_STYLE_MODEL: AuthoringStyleModelResult = Object.freeze({ status: "idle" });',
      'type InspectorTab = "inspector" | "state" | "actions";',
    ]),
    Object.freeze(["  onStyleEdit,\n  onStyleTargetChange,\n", ""]),
    Object.freeze(["  styleModel = IDLE_STYLE_MODEL,\n  styleTarget,\n  styleTokenOptions,\n", ""]),
    Object.freeze(["  const styleTab = useRef<HTMLButtonElement>(null);\n", ""]),
    Object.freeze([
      '      : nextTab === "style"\n        ? styleTab\n        : nextTab === "state"\n          ? stateTab\n          : actionsTab',
      '      : nextTab === "state"\n        ? stateTab\n        : actionsTab',
    ]),
    Object.freeze([
      '    const tabs: readonly InspectorTab[] = ["inspector", "style", "state", "actions"];',
      '    const tabs: readonly InspectorTab[] = ["inspector", "state", "actions"];',
    ]),
    Object.freeze([
      '        <button\n          aria-controls={`${panelId}-style-panel`}\n          aria-selected={activeTab === "style"}\n          id={`${panelId}-style-tab`}\n          onClick={() => selectTab("style")}\n          onKeyDown={selectAdjacentTab}\n          ref={styleTab}\n          role="tab"\n          tabIndex={activeTab === "style" ? 0 : -1}\n          type="button"\n        >\n          Style\n        </button>\n',
      "",
    ]),
    Object.freeze([
      '      <div\n        aria-labelledby={`${panelId}-style-tab`}\n        className={styles.inspectorTabPanel}\n        hidden={activeTab !== "style"}\n        id={`${panelId}-style-panel`}\n        role="tabpanel"\n        tabIndex={activeTab === "style" ? 0 : -1}\n      >\n        <StylePanel\n          model={styleModel}\n          onEdit={onStyleEdit}\n          onTargetChange={onStyleTargetChange}\n          target={styleTarget}\n          tokenOptions={styleTokenOptions}\n        />\n      </div>\n',
      "",
    ]),
  ]),
});

const M10A_T12_RETAINED_T10_APP_SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    path: "apps/desen-app/src/project-lifecycle-navigation.ts",
    bytes: 1_351,
    sha256: "sha256:8b16f387b2d2e9e32e7458bc421e60616359fb9ad16ef49451622edb5252e1ed",
  }),
  Object.freeze({
    path: "apps/desen-app/src/project-lifecycle.ts",
    bytes: 40_345,
    sha256: "sha256:d797e98dd28edae64277ffb13fc1a6e4830063b4d5edd6b529f70aacee482fbd",
  }),
]);

/**
 * A canonical full-graph receipt rather than an allowlist of newly discovered vendor modules.
 * Its hash covers every normalized module id, static/dynamic edge and transformed-code receipt
 * from the fresh Vite build; source and output receipts below prevent a coarse summary from
 * masking a graph change.
 */
const M10A_T12_APP_GRAPH_SUCCESSOR = Object.freeze({
  app: Object.freeze({
    moduleCount: 689,
    staticEdges: 2_970,
    dynamicEdges: 0,
    unresolvedEdges: 0,
    reachableProductionSourceFiles: 64,
    graphSha256: "sha256:4d2a4a74154d5041380a79a726ea698d9197dace3f25391ca6614492108df823",
  }),
  completeAppSourceFiles: 67,
  appOutput: Object.freeze({
    files: 3,
    outputs: Object.freeze([
      Object.freeze({
        fileName: "assets/index-BjqjQCrT.js",
        type: "chunk",
        isEntry: true,
        bytes: 3_563_574,
        sha256: "sha256:552bedce2b3d37cbada93e9a028f28027f5c07d0335fa86ab60acba701e95034",
      }),
      Object.freeze({
        fileName: "assets/index-YPwZ0Ugb.css",
        type: "asset",
        isEntry: null,
        bytes: 142_543,
        sha256: "sha256:7164c5cca45bfd234be1ef330db23dd27f2567f91959aa1e581f7b652f84469e",
      }),
      Object.freeze({
        fileName: "index.html",
        type: "asset",
        isEntry: null,
        bytes: 511,
        sha256: "sha256:a62f270d284198568e5041a59fc1f10c2f611e3c599cfba438b3e917e62d903a",
      }),
    ]),
    identitySha256: "sha256:232f614c94f0886ded63d10f8876a9639c5efde631df628b429d609097ff0b95",
  }),
  backingFiles: 706,
  backingSnapshotSha256: "sha256:de6e55faa898faf607179285fd79e139f2353a164aecaa6f98bf510550c68204",
});

// T14's fresh graph is authenticated separately, then projected to the immutable T12 graph.
const M10A_T14_APP_GRAPH_SUCCESSOR = Object.freeze({
  app: Object.freeze({
    moduleCount: 690,
    staticEdges: 2_974,
    dynamicEdges: 0,
    unresolvedEdges: 0,
    reachableProductionSourceFiles: 64,
    graphSha256: "sha256:81caef9057f448051a88849097312a97840c3356c3926441729f18c575f27db0",
  }),
  appOutput: Object.freeze({
    files: 3,
    outputs: Object.freeze([
      Object.freeze({
        fileName: "assets/index-9rpgAhBO.js",
        type: "chunk",
        isEntry: true,
        bytes: 3_593_346,
        sha256: "sha256:89ed3ee0c1cab002b95aee7c827303d6d613848579b32411395098811e422b9a",
      }),
      Object.freeze({
        fileName: "assets/index-YPwZ0Ugb.css",
        type: "asset",
        isEntry: null,
        bytes: 142_543,
        sha256: "sha256:7164c5cca45bfd234be1ef330db23dd27f2567f91959aa1e581f7b652f84469e",
      }),
      Object.freeze({
        fileName: "index.html",
        type: "asset",
        isEntry: null,
        bytes: 511,
        sha256: "sha256:569179098917de7bca00adfd0adbda86200c87d66843896437f1e4de8278f159",
      }),
    ]),
    identitySha256: "sha256:f24bed7af89935c994a0296791704a905c4f4bb3c05ec752b0d152bafccaac9d",
  }),
  backingFiles: 707,
  backingSnapshotSha256: "sha256:c74566cb50c4b5675c98a2dcd7851b7b8948ba9088597aaae324c70ea72224f6",
});

// Observed by two independent write:false builds per App/host. This binds transformed code,
// imports, outputs and backing bytes; source inventory admission alone cannot authorize T15.
const M10A_T15_APP_GRAPH_SUCCESSOR = Object.freeze({
  app: Object.freeze({
    ...M10A_T14_APP_GRAPH_SUCCESSOR.app,
    moduleCount: 712,
    staticEdges: 3_056,
    reachableProductionSourceFiles: 77,
    graphSha256: "sha256:adb025bec1fcb5d677eeb28000cbf0061ebb6c9f36897e8627da0b259e5b21ac",
  }),
  appOutput: Object.freeze({
    files: 3,
    outputs: Object.freeze([
      Object.freeze({
        fileName: "assets/index-L5CQRlGI.js",
        type: "chunk",
        isEntry: true,
        bytes: 3_735_452,
        sha256: "sha256:f06118ebde58daffb686a5b60f6b937aa7bb8bda14cc8d5a98a8608b815cd139",
      }),
      Object.freeze({
        fileName: "assets/index-pkucD332.css",
        type: "asset",
        isEntry: null,
        bytes: 158_507,
        sha256: "sha256:a531758a4996e355aa0cdd89dd769a75f1edf33831067aa80bb1b20db3bd1f96",
      }),
      Object.freeze({
        fileName: "index.html",
        type: "asset",
        isEntry: null,
        bytes: 511,
        sha256: "sha256:5eef2b88f10906dfe271b079ecd74e5647c4da1ea61d03643f415e2d3772da26",
      }),
    ]),
    identitySha256: "sha256:7d5dc58a9dd833d87ffc5337b85ed6e950ef87955a06b62f7b57e7b23fb7aaf9",
  }),
  backingFiles: 729,
  backingSnapshotSha256: "sha256:05594646e839f545d9b86e07bc11f4502ece6a2a09f01cae617cfac71791bd2c",
});

const FOCUSED_TEST_COMMANDS = Object.freeze([
  "pnpm --filter @desen/app-web exec vitest run test/local-runtime-publication.test.ts test/product-bootstrap.test.tsx test/main-lifecycle.test.tsx dev/local-publication-host.test.mjs dev/local-dev-host.test.mjs",
  "pnpm --filter @desen/reference-host-web-server exec vitest run test/server.test.ts",
  "pnpm --filter @desen/reference-host-web-server typecheck",
]);
const BROWSER_COMMAND =
  "pnpm --filter @desen/app-browser-e2e exec playwright test --config published-host-playwright.config.ts";
const BROWSER_E2E_SCRIPT =
  "pnpm --filter @desen/app-web... build && pnpm --filter @desen/reference-host-web-server... build && pnpm --filter @desen/reference-host-web... build && pnpm run typecheck && pnpm run build && playwright test --config playwright.config.ts && playwright test --config product-playwright.config.ts && playwright test --config input-pending-playwright.config.ts && playwright test --config failure-playwright.config.ts && playwright test --config success-host-playwright.config.ts && playwright test --config published-host-playwright.config.ts";
const M10A_T12_BROWSER_E2E_SCRIPT = `${BROWSER_E2E_SCRIPT} && playwright test --config invalid-publication-playwright.config.ts && playwright test --config restart-recovery-playwright.config.ts && playwright test --config repeatable-demo-playwright.config.ts && playwright test --config t12-playwright.config.ts`;
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
  "design-system-authoring",
  "design-system-core",
  "editor-core",
  "editor-web",
  "protocol",
  "publisher",
  "reference-catalog-web",
  "runtime-core",
  "runtime-react",
  "starter-catalog-web",
  "testkit",
  "validator",
]);
const APP_ALLOWED_NODE_MODULE_PACKAGES =
  /^node_modules\/(?:@base-ui\/(?:react|utils)|@floating-ui\/(?:core|dom|react-dom|utils)|react|react-dom|reselect|scheduler|use-sync-external-store)\//u;
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
  bytes: 3_111_833,
  sha256: "07c33e1086e6de68220b42af1bbf75a1be17978972d344bedba5ad5685dc8470",
  uncompressedBytes: 4_884_471,
  baseCommit: "33b922e6746365510c0549ddbf3b08469e58dc11",
  fileEntries: 51,
  predecessorGapFiles: 2,
  successorAddedPaths: 7,
  projections: 1,
  t01aAncestor: Object.freeze({
    task: "M10-T01A",
    baseCommit: "39a3c6c7a477b700b332b725a9ddf5d1956c0ba5",
    artifact: Object.freeze({
      path: "docs/proof/artifacts/desen-app-0.1.0-user-created-blank-project.json",
      bytes: 20_173,
      sha256: "6277b82f22bf26e92b670164f2f1e2b7f861409f5b37585fb5053d88c4dadd2e",
    }),
    fileEntries: 1,
  }),
});

/** Exact additive T11 App test declaration, projected before the older T10 receipt. */
const M10A_T11_APP_PACKAGE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/package.json",
  bytes: 5_080,
  sha256: "503de2c93b32aa51b38870a746bbee68fbafa00e1d38b9cf7909625f9056bb92",
  predecessor: Object.freeze({
    bytes: M10A_T10_APP_PACKAGE_SUCCESSOR.bytes,
    sha256: M10A_T10_APP_PACKAGE_SUCCESSOR.sha256,
  }),
  inverseChanges: Object.freeze([
    '    "test:direct-manipulation": "vitest run test/authoring-direct-manipulation.test.ts test/canvas-manipulation-controls.test.tsx test/authoring-slots.test.ts test/adapter-canvas.test.tsx test/application.test.tsx",\n',
  ]),
});

/** Exact additive T13 App manifest successor, projected before the frozen T12 receipt. */
const M10A_T13_APP_PACKAGE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/package.json",
  bytes: 5_226,
  sha256: "06d2ae3491c70c8efe4c6d3cd2e8084dbef1894abb9334859269c2597b46f8ac",
  predecessor: Object.freeze({
    bytes: 5_133,
    sha256: "18d5b7479278b39e337027b0739e1f1b6055d0291b774ed761a7a6ecb4ad436e",
  }),
  inverseChanges: Object.freeze([
    Object.freeze({
      current: `  "dependencies": {\n    "@desen/catalog-sdk": "workspace:*",\n    "@desen/design-system-assets": "workspace:*",\n    "@desen/design-system-authoring": "workspace:*",\n    "@desen/design-system-core": "workspace:*",\n    "@desen/editor-core": "workspace:*",\n    "@desen/editor-web": "workspace:*",\n    "@desen/protocol": "workspace:*",\n    "@desen/publisher": "workspace:*",\n    "@desen/reference-catalog-web": "workspace:*",\n    "@desen/runtime-core": "workspace:*",\n    "@desen/runtime-react": "workspace:*",\n    "@desen/starter-catalog-web": "workspace:*",\n    "@desen/testkit": "workspace:*",\n    "@desen/validator": "workspace:*",\n    "@fontsource-variable/inter": "5.3.0",\n    "react": "19.2.8",\n    "react-dom": "19.2.8"\n  },\n`,
      predecessor: `  "dependencies": {\n    "@desen/catalog-sdk": "workspace:*",\n    "@desen/design-system-authoring": "workspace:*",\n    "@desen/design-system-core": "workspace:*",\n    "@desen/editor-core": "workspace:*",\n    "@desen/editor-web": "workspace:*",\n    "@desen/publisher": "workspace:*",\n    "@desen/protocol": "workspace:*",\n    "@desen/reference-catalog-web": "workspace:*",\n    "@desen/runtime-core": "workspace:*",\n    "@desen/runtime-react": "workspace:*",\n    "@desen/starter-catalog-web": "workspace:*",\n    "@desen/testkit": "workspace:*",\n    "@desen/validator": "workspace:*",\n    "react": "19.2.8",\n    "react-dom": "19.2.8"\n  },\n`,
    }),
  ]),
});

/** Exact additive T13 dependency-boundary successor, projected before the frozen T12 receipt. */
const M10A_T13_CONFIG_SUCCESSOR = Object.freeze({
  path: "dependency-cruiser.config.cjs",
  bytes: 16_973,
  sha256: "9b59bdfdecad052ef32bbf0d44373679a72b08fc5ea2289fecd1bc3bee4c555e",
  predecessor: Object.freeze({
    bytes: 16_945,
    sha256: "c8cb509ea87d9a25b49bb8ba389340d4304a1043b8fa2847d01331fdc78743d8",
  }),
  inverseChanges: Object.freeze([Object.freeze(['    "design-system-assets",\n', ""])]),
});

/** Exact T12 normal-App manifest addition, projected before the frozen T11 receipt. */
const M10A_T12_APP_PACKAGE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app/package.json",
  bytes: 5_133,
  sha256: "18d5b7479278b39e337027b0739e1f1b6055d0291b774ed761a7a6ecb4ad436e",
  predecessor: Object.freeze({
    bytes: M10A_T11_APP_PACKAGE_SUCCESSOR.bytes,
    sha256: M10A_T11_APP_PACKAGE_SUCCESSOR.sha256,
  }),
  inverseChanges: Object.freeze(['    "@desen/design-system-authoring": "workspace:*",\n']),
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
  bytes: 189_123,
  sha256: "80c0b815a813ef462233b48a7fffe7c4d0bbf391aefc68eb9a6174da6bd84bd3",
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

function sameAuthorityStat(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
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
    if (!sameAuthorityStat(metadata, opened) || opened.size > MAX_AUTHORITY_BYTES) {
      fail("AUTHORITY_UNSAFE", `Authority changed during acquisition: ${relativePath}.`);
    }
    const bytes = await handle.readFile();
    const [after, named] = await Promise.all([handle.stat(), lstat(absolutePath)]);
    if (
      bytes.byteLength !== opened.size ||
      !sameAuthorityStat(opened, after) ||
      !sameAuthorityStat(after, named)
    ) {
      fail("AUTHORITY_UNSAFE", `Authority changed during acquisition: ${relativePath}.`);
    }
    return bytes;
  } catch (error) {
    if (error instanceof DesenAppPublishedHostUpdateProofError) throw error;
    fail("AUTHORITY_UNSAFE", `Could not read evidence authority: ${relativePath}.`, {
      cause: String(error),
    });
  } finally {
    await handle?.close();
  }
}

async function snapshotTrackedBackingFiles(workspaceRoot) {
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath),
    );
  }
  return files;
}

async function verifyTrackedBackingFence(workspaceRoot, acquired) {
  const finalBackingFiles = await snapshotTrackedBackingFiles(workspaceRoot);
  for (const relativePath of TRACKED_PATHS) {
    const initialBacking = acquired.backingFiles.get(relativePath);
    const finalBacking = finalBackingFiles.get(relativePath);
    const admitted = acquired.files.get(relativePath);
    if (!initialBacking.equals(finalBacking)) {
      fail("SOURCE_SNAPSHOT_DRIFT", "A tracked backing authority changed across execution.", {
        path: relativePath,
      });
    }
    if (!admitted.equals(initialBacking)) {
      fail(
        "SOURCE_SNAPSHOT_DRIFT",
        "A hostile override differs from its tracked backing authority.",
        {
          path: relativePath,
        },
      );
    }
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
    !isDeepStrictEqual(appInventory, M10A_T15_APP_SOURCE_RECEIPT_PATHS) ||
    !isDeepStrictEqual(hostInventory, HOST_SOURCE_PATHS) ||
    !isDeepStrictEqual(hostServerInventory, HOST_SERVER_SOURCE_PATHS)
  ) {
    fail("SOURCE_INVENTORY_DRIFT", "The complete App or reference-host source inventory drifted.", {
      appInventory,
      hostInventory,
      hostServerInventory,
    });
  }
  const backingFiles = await snapshotTrackedBackingFiles(canonicalRoot);
  const files = new Map();
  for (const relativePath of TRACKED_PATHS) {
    files.set(
      relativePath,
      options.fileOverrides.get(relativePath) ?? backingFiles.get(relativePath),
    );
  }
  // These are fresh runtime-source authorities, deliberately outside the frozen M10 tracked
  // receipt set. They cannot be caller-overridden and are fenced again around the Vite build.
  for (const relativePath of [
    ...M10A_T10_ISOLATED_APP_SOURCE_PATHS,
    ...M10A_T11_REACHABLE_APP_SOURCE_PATHS,
    ...M10A_T12_ADDED_APP_SOURCE_PATHS,
    ...M10A_T13_ADDED_APP_SOURCE_PATHS,
    ...M10A_T15_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T17_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T18_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
    ...M10A_T19_ADDED_APP_SOURCE_RECEIPTS.map(({ path: sourcePath }) => sourcePath),
  ]) {
    files.set(
      relativePath,
      await readRegularAuthority(path.join(canonicalRoot, relativePath), relativePath),
    );
  }
  return Object.freeze({
    files,
    backingFiles,
    appInventory,
    hostInventory,
    hostServerInventory,
  });
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

function removeExactLockfileEntry(source, section, header, authority) {
  const sectionMarker = `\n${section}:\n`;
  if (occurrenceCount(source, sectionMarker) !== 1) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      `The ${authority} lockfile successor lost one exact reviewed section.`,
      { authority, section },
    );
  }
  const sectionStart = source.indexOf(sectionMarker) + sectionMarker.length;
  const nextSectionPattern = /^\S[^\r\n]*:\r?$/gmu;
  nextSectionPattern.lastIndex = sectionStart;
  const nextSection = nextSectionPattern.exec(source);
  const sectionEnd = nextSection?.index ?? source.length;
  const sectionText = source.slice(sectionStart, sectionEnd);
  if (occurrenceCount(sectionText, header) !== 1) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      `The ${authority} lockfile successor lost one exact additive entry.`,
      { authority, section, header: header.trimEnd() },
    );
  }
  const entryStart = sectionStart + sectionText.indexOf(header);
  const nextEntryPattern = /^ {2}\S[^\r\n]*$/gmu;
  nextEntryPattern.lastIndex = entryStart + header.length;
  const nextEntry = nextEntryPattern.exec(source);
  const entryEnd =
    nextEntry !== null && nextEntry.index < sectionEnd ? nextEntry.index : sectionEnd;
  if (entryEnd <= entryStart) {
    fail("DEPENDENCY_SUCCESSOR_DRIFT", `The ${authority} lockfile entry boundary drifted.`, {
      authority,
      section,
      header: header.trimEnd(),
    });
  }
  return source.slice(0, entryStart) + source.slice(entryEnd);
}

function authenticateAdditiveLockfileSuccessor(bytes, successor, additions) {
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      `The live lockfile is not the exact reviewed ${successor.authority} additive successor.`,
    );
  }
  let predecessorText = decodeUtf8(
    bytes,
    DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS.path,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  for (const { section, headers } of additions) {
    for (const header of headers) {
      predecessorText = removeExactLockfileEntry(
        predecessorText,
        section,
        header,
        successor.authority,
      );
    }
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      `Removing only the reviewed ${successor.authority} additions must reproduce the exact ${successor.predecessor.authority} lockfile.`,
    );
  }
  return Object.freeze({ predecessorBytes, predecessorText });
}

function removeExactImporterDependencyFragment(source, importer, fragment, authority) {
  const importerMarker = `  ${importer}:\n`;
  if (occurrenceCount(source, importerMarker) !== 1) {
    fail("DEPENDENCY_SUCCESSOR_DRIFT", `The ${authority} importer boundary drifted.`, {
      authority,
      importer,
    });
  }
  const importerStart = source.indexOf(importerMarker);
  const nextImporterPattern = /\n {2}\S[^\r\n]*:\r?\n/gmu;
  nextImporterPattern.lastIndex = importerStart + importerMarker.length;
  const nextImporter = nextImporterPattern.exec(source);
  const importerEnd = nextImporter?.index ?? source.length;
  const importerText = source.slice(importerStart, importerEnd);
  if (occurrenceCount(importerText, fragment) !== 1) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      `The ${authority} lockfile successor lost one exact additive dependency fragment.`,
      { authority, importer, fragment },
    );
  }
  return (
    source.slice(0, importerStart) + importerText.replace(fragment, "") + source.slice(importerEnd)
  );
}

/**
 * Authenticates the exact additive M10A-T01 lockfile and returns its reviewed M10-T08
 * predecessor bytes for frozen historical-reader projection.
 */
export function authenticateM10AT01LockfileSuccessor(bytes) {
  return authenticateAdditiveLockfileSuccessor(
    bytes,
    M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT,
    M10A_T01_LOCKFILE_ADDED_ENTRIES,
  );
}

/**
 * Authenticates the exact additive M10A-T02 lockfile and returns its reviewed M10A-T01
 * predecessor bytes without changing the existing historical projection.
 */
export function authenticateM10AT02LockfileSuccessor(bytes) {
  return authenticateAdditiveLockfileSuccessor(
    bytes,
    M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT,
    M10A_T02_LOCKFILE_ADDED_ENTRIES,
  );
}

/**
 * Authenticates the exact additive M10A-T03 lockfile and returns its reviewed M10A-T02
 * predecessor bytes without weakening either historical successor check.
 */
export function authenticateM10AT03LockfileSuccessor(bytes) {
  return authenticateAdditiveLockfileSuccessor(
    bytes,
    M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT,
    M10A_T03_LOCKFILE_ADDED_ENTRIES,
  );
}

/** Authenticates the exact additive M10A-T04 lockfile and returns its reviewed T03 predecessor. */
export function authenticateM10AT04LockfileSuccessor(bytes) {
  return authenticateAdditiveLockfileSuccessor(
    bytes,
    M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT,
    M10A_T04_LOCKFILE_ADDED_ENTRIES,
  );
}

/**
 * Authenticates the exact M10A-T10 App dependency additions and returns the reviewed T04
 * predecessor without allowing those dependencies to alter historical M10 receipts.
 */
export function authenticateM10AT10LockfileSuccessor(bytes) {
  if (
    bytes.byteLength !== M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.bytes ||
    sha256(bytes) !== M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "The live lockfile is not the exact reviewed M10A-T10 additive successor.",
    );
  }
  let predecessorText = decodeUtf8(
    bytes,
    DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS.path,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  for (const fragment of M10A_T10_LOCKFILE_ADDED_FRAGMENTS) {
    predecessorText = removeExactImporterDependencyFragment(
      predecessorText,
      "apps/desen-app",
      fragment,
      M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    );
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.bytes ||
    sha256(predecessorBytes) !== M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "Removing only the reviewed M10A-T10 dependencies must reproduce the exact M10A-T04 lockfile.",
    );
  }
  return Object.freeze({ predecessorBytes, predecessorText });
}

/**
 * Authenticates the live T13 lockfile successor and projects it to the frozen T12 receipt before
 * the existing T10 → T04 predecessor chain. No caller may relabel an arbitrary current lockfile
 * as the T10 receipt.
 */
export function authenticateM10AT12LockfileSuccessor(bytes) {
  if (
    bytes.byteLength !== M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.bytes ||
    sha256(bytes) !== M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "The live lockfile is not the exact reviewed M10A-T13 additive successor.",
    );
  }
  let predecessorText = decodeUtf8(
    bytes,
    DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS.path,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  const currentVitestContext =
    "4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)(vite@8.1.5(@types/node@24.13.3))";
  const predecessorVitestContext =
    "4.1.10(@types/node@24.13.3)(@vitest/coverage-v8@4.1.10)(jsdom@29.1.1)";
  if (occurrenceCount(predecessorText, currentVitestContext) !== 23) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "The live T13 lockfile does not contain the exact reviewed Vitest peer context count.",
    );
  }
  for (const { current, predecessor } of M10A_T13_LOCKFILE_INVERSE) {
    if (occurrenceCount(predecessorText, current) !== 1) {
      fail(
        "DEPENDENCY_SUCCESSOR_DRIFT",
        "The live T13 lockfile does not contain one exact reviewed additive fragment.",
        { fragment: current },
      );
    }
    predecessorText = predecessorText.replace(current, predecessor);
  }
  if (occurrenceCount(predecessorText, currentVitestContext) !== 22) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "The reviewed T13 inverse did not leave the expected Vitest peer context count.",
    );
  }
  predecessorText = predecessorText.replaceAll(currentVitestContext, predecessorVitestContext);
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.bytes ||
    sha256(predecessorBytes) !== M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "Removing only the reviewed M10A-T13 additions must reproduce the exact M10A-T12 lockfile.",
      { bytes: predecessorBytes.byteLength, sha256: sha256(predecessorBytes) },
    );
  }
  return Object.freeze({ predecessorBytes, predecessorText });
}

/** Projects the exact frozen T12 lockfile receipt to its T10 predecessor. */
function authenticateM10AT12HistoricalLockfileSuccessor(bytes) {
  if (
    bytes.byteLength !== M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.bytes ||
    sha256(bytes) !== M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "The projected lockfile is not the exact frozen M10A-T12 receipt.",
    );
  }
  let predecessorText = decodeUtf8(
    bytes,
    DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS.path,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  for (const fragment of M10A_T12_LOCKFILE_ADDED_FRAGMENTS) {
    predecessorText = removeExactImporterDependencyFragment(
      predecessorText,
      "apps/desen-app",
      fragment,
      M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.authority,
    );
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.bytes ||
    sha256(predecessorBytes) !== M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.predecessor.sha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "Removing only the reviewed M10A-T12 dependency must reproduce the exact M10A-T10 lockfile.",
    );
  }
  return Object.freeze({ predecessorBytes, predecessorText });
}

/**
 * Projects the exact additive T10 App manifest back to its pre-T10 historical
 * receipt. Readers of frozen M10 evidence may use this only before their own
 * independently reviewed successor projections.
 */
export function projectM10AT10HistoricalInput(relativePath, bytes) {
  if (relativePath !== M10A_T10_APP_PACKAGE_SUCCESSOR.path) return bytes;
  if (
    bytes.byteLength !== M10A_T10_APP_PACKAGE_SUCCESSOR.bytes ||
    sha256(bytes) !== M10A_T10_APP_PACKAGE_SUCCESSOR.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The current T10 App package input is outside its exact reviewed successor receipt.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const fragment of M10A_T10_APP_PACKAGE_SUCCESSOR.inverseChanges) {
    if (occurrenceCount(predecessorText, fragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T10 App package successor lost one exact additive declaration.",
        { path: relativePath, fragment },
      );
    }
    predecessorText = predecessorText.replace(fragment, "");
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== M10A_T10_APP_PACKAGE_SUCCESSOR.predecessor.bytes ||
    sha256(predecessorBytes) !== M10A_T10_APP_PACKAGE_SUCCESSOR.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only reviewed T10 package additions must reproduce the exact M10A-T09 package.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/**
 * Projects the exact additive T11 App manifest back to the reviewed T10 receipt. The T10
 * projector remains responsible for the older lifecycle declaration after this narrow step.
 */
export function projectM10AT11HistoricalInput(relativePath, bytes) {
  if (relativePath !== M10A_T11_APP_PACKAGE_SUCCESSOR.path) return bytes;
  if (
    bytes.byteLength !== M10A_T11_APP_PACKAGE_SUCCESSOR.bytes ||
    sha256(bytes) !== M10A_T11_APP_PACKAGE_SUCCESSOR.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The current T11 App package input is outside its exact reviewed successor receipt.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const fragment of M10A_T11_APP_PACKAGE_SUCCESSOR.inverseChanges) {
    if (occurrenceCount(predecessorText, fragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T11 App package successor lost one exact additive declaration.",
        { path: relativePath, fragment },
      );
    }
    predecessorText = predecessorText.replace(fragment, "");
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== M10A_T11_APP_PACKAGE_SUCCESSOR.predecessor.bytes ||
    sha256(predecessorBytes) !== M10A_T11_APP_PACKAGE_SUCCESSOR.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only reviewed T11 package additions must reproduce the exact T10 package.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

const M10A_T12_BROWSER_PACKAGE_SUCCESSOR = Object.freeze({
  path: "apps/desen-app-browser-e2e/package.json",
  bytes: 1_819,
  sha256: "a811cf3d7ec960796ab47baee69524888a59efc0ab26e81a7eeeaf1968547c66",
  predecessor: Object.freeze({
    bytes: 1_563,
    sha256: "16bdd23236597c1cb97c6d1246da5798b603ec7143e0b7b12cc8ed75d8eb4caf",
  }),
  inverseChanges: Object.freeze([
    '    "test:m10a-t12": "pnpm --filter @desen/app-web... build && pnpm --filter @desen/control-plane-api build && pnpm run typecheck && pnpm run build && playwright test --config t12-playwright.config.ts",\n',
    " && playwright test --config t12-playwright.config.ts",
  ]),
});

/**
 * Authenticates one exact current T15 input before reconstructing its pre-T15 bytes.
 *
 * @remarks This is historical identity projection, never execution or current behavior evidence.
 * Unrelated paths pass through unchanged; a stale or mutated successor cannot use the inverse.
 */
export function projectM10AT15HistoricalInput(relativePath, bytes) {
  const t21Successor = M10A_T21_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t21Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t21Successor.current.bytes ||
      sha256(bytes) !== t21Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T21 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t21Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T21 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t21Successor.predecessor.bytes ||
      sha256(predecessor) !== t21Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T21 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const t20Successor = M10A_T20_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t20Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t20Successor.current.bytes ||
      sha256(bytes) !== t20Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T20 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t20Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T20 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t20Successor.predecessor.bytes ||
      sha256(predecessor) !== t20Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T20 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const t19Successor = M10A_T19_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t19Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t19Successor.current.bytes ||
      sha256(bytes) !== t19Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T19 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t19Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T19 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t19Successor.predecessor.bytes ||
      sha256(predecessor) !== t19Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T19 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const t18Successor = M10A_T18_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t18Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t18Successor.current.bytes ||
      sha256(bytes) !== t18Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T18 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t18Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T18 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t18Successor.predecessor.bytes ||
      sha256(predecessor) !== t18Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T18 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const t17Successor = M10A_T17_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t17Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t17Successor.current.bytes ||
      sha256(bytes) !== t17Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T17 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t17Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T17 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t17Successor.predecessor.bytes ||
      sha256(predecessor) !== t17Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T17 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const t16Successor = M10A_T16_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (t16Successor !== undefined) {
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.byteLength !== t16Successor.current.bytes ||
      sha256(bytes) !== t16Successor.current.sha256
    ) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The T16 input differs from its reviewed successor.", {
        path: relativePath,
      });
    }
    const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
    for (const hunk of t16Successor.inverseHunks.toReversed()) {
      const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
      if (start < 0 || start + hunk.remove > lines.length) {
        fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T16 inverse is out of bounds.", {
          path: relativePath,
        });
      }
      lines.splice(start, hunk.remove, ...hunk.restore);
    }
    const predecessor = Buffer.from(lines.join("\n"));
    if (
      predecessor.byteLength !== t16Successor.predecessor.bytes ||
      sha256(predecessor) !== t16Successor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T16 inverse does not reconstruct its exact predecessor.",
        { path: relativePath },
      );
    }
    bytes = predecessor;
  }
  const successor = M10A_T15_LEGACY_INPUT_SUCCESSORS.find(
    ({ path: owned }) => owned === relativePath,
  );
  if (successor === undefined) return bytes;
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength !== successor.current.bytes ||
    sha256(bytes) !== successor.current.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T15 input differs from its reviewed successor.", {
      path: relativePath,
    });
  }
  const lines = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION").split("\n");
  for (const hunk of successor.inverseHunks.toReversed()) {
    const start = hunk.remove === 0 ? hunk.start : hunk.start - 1;
    if (start < 0 || start + hunk.remove > lines.length) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T15 inverse is out of bounds.", {
        path: relativePath,
      });
    }
    lines.splice(start, hunk.remove, ...hunk.restore);
  }
  const predecessor = Buffer.from(lines.join("\n"));
  if (
    predecessor.byteLength !== successor.predecessor.bytes ||
    sha256(predecessor) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The T15 inverse does not reconstruct its exact predecessor.",
      { path: relativePath },
    );
  }
  return predecessor;
}

/**
 * Projects exact T12-owned manifests, lockfile, and the Inspector Style-view source to their
 * reviewed predecessors. All other inputs pass through unchanged for narrower successor chains.
 */
export function projectM10AT12HistoricalInput(relativePath, bytes) {
  bytes = projectM10AT15HistoricalInput(relativePath, bytes);
  if (relativePath === M10A_T14_APP_SOURCE_SUCCESSOR.path) {
    if (
      bytes.byteLength !== M10A_T14_APP_SOURCE_SUCCESSOR.bytes ||
      sha256(bytes) !== M10A_T14_APP_SOURCE_SUCCESSOR.sha256.slice("sha256:".length)
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The current T14 App source is outside its exact reviewed successor receipt.",
        { path: relativePath },
      );
    }
    let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
    for (const [
      currentFragment,
      predecessorFragment,
    ] of M10A_T14_APP_SOURCE_SUCCESSOR.inverseChanges) {
      if (occurrenceCount(predecessorText, currentFragment) !== 1) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "The T14 App source successor lost one exact reviewed change.",
          { path: relativePath, currentFragment },
        );
      }
      predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
    }
    const predecessorBytes = Buffer.from(predecessorText);
    if (
      predecessorBytes.byteLength !== M10A_T14_APP_SOURCE_SUCCESSOR.predecessor.bytes ||
      sha256(predecessorBytes) !== M10A_T14_APP_SOURCE_SUCCESSOR.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Removing only the reviewed T14 App source changes must reproduce the exact T12 receipt.",
        { path: relativePath },
      );
    }
    bytes = predecessorBytes;
  }
  if (relativePath === M10A_T13_CONFIG_SUCCESSOR.path) {
    if (
      bytes.byteLength !== M10A_T13_CONFIG_SUCCESSOR.bytes ||
      sha256(bytes) !== M10A_T13_CONFIG_SUCCESSOR.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The current T13 dependency-boundary input is outside its exact reviewed successor receipt.",
        { path: relativePath },
      );
    }
    let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
    for (const [currentFragment, predecessorFragment] of M10A_T13_CONFIG_SUCCESSOR.inverseChanges) {
      if (occurrenceCount(predecessorText, currentFragment) !== 1) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "The T13 dependency-boundary successor lost one exact additive declaration.",
          { path: relativePath, currentFragment },
        );
      }
      predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
    }
    const predecessorBytes = Buffer.from(predecessorText);
    if (
      predecessorBytes.byteLength !== M10A_T13_CONFIG_SUCCESSOR.predecessor.bytes ||
      sha256(predecessorBytes) !== M10A_T13_CONFIG_SUCCESSOR.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Removing only the reviewed T13 dependency-boundary addition must reproduce the exact T12 input.",
        { path: relativePath },
      );
    }
    bytes = predecessorBytes;
  }
  if (relativePath === M10A_T13_APP_PACKAGE_SUCCESSOR.path) {
    if (
      bytes.byteLength !== M10A_T13_APP_PACKAGE_SUCCESSOR.bytes ||
      sha256(bytes) !== M10A_T13_APP_PACKAGE_SUCCESSOR.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The current T13 App package input is outside its exact reviewed successor receipt.",
        { path: relativePath },
      );
    }
    let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
    for (const { current, predecessor } of M10A_T13_APP_PACKAGE_SUCCESSOR.inverseChanges) {
      if (occurrenceCount(predecessorText, current) !== 1) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "The T13 App package successor lost one exact additive declaration.",
          { path: relativePath, current },
        );
      }
      predecessorText = predecessorText.replace(current, predecessor);
    }
    bytes = Buffer.from(predecessorText);
    if (
      bytes.byteLength !== M10A_T13_APP_PACKAGE_SUCCESSOR.predecessor.bytes ||
      sha256(bytes) !== M10A_T13_APP_PACKAGE_SUCCESSOR.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Removing only reviewed T13 package additions must reproduce the exact T12 App package.",
        { path: relativePath },
      );
    }
  }
  if (relativePath === DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS.path) {
    const t13 = authenticateM10AT12LockfileSuccessor(bytes);
    return authenticateM10AT12HistoricalLockfileSuccessor(t13.predecessorBytes).predecessorBytes;
  }
  const t08InputSuccessor = M10A_T12_T08_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (t08InputSuccessor !== undefined) {
    if (
      bytes.byteLength !== t08InputSuccessor.bytes ||
      sha256(bytes) !== t08InputSuccessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "A current T12 T08-tracked input is outside its exact reviewed successor receipt.",
        { path: relativePath },
      );
    }
    let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
    for (const [currentFragment, predecessorFragment] of t08InputSuccessor.inverseChanges) {
      if (occurrenceCount(predecessorText, currentFragment) !== 1) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "A T12 T08-tracked successor lost one exact reviewed change.",
          { path: relativePath, currentFragment },
        );
      }
      predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
    }
    const predecessorBytes = Buffer.from(predecessorText);
    if (
      predecessorBytes.byteLength !== t08InputSuccessor.predecessor.bytes ||
      sha256(predecessorBytes) !== t08InputSuccessor.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Removing only reviewed T12 changes must reproduce the exact frozen T08 input.",
        { path: relativePath },
      );
    }
    return predecessorBytes;
  }
  if (relativePath === M10A_T12_INSPECTOR_SUCCESSOR.path) {
    if (
      bytes.byteLength !== M10A_T12_INSPECTOR_SUCCESSOR.bytes ||
      sha256(bytes) !== M10A_T12_INSPECTOR_SUCCESSOR.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The current T12 Inspector input is outside its exact reviewed successor receipt.",
        { path: relativePath },
      );
    }
    let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
    for (const [
      currentFragment,
      predecessorFragment,
    ] of M10A_T12_INSPECTOR_SUCCESSOR.inverseChanges) {
      if (occurrenceCount(predecessorText, currentFragment) !== 1) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "The T12 Inspector successor lost one exact reviewed Style-view change.",
          { path: relativePath, currentFragment },
        );
      }
      predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
    }
    const predecessorBytes = Buffer.from(predecessorText);
    if (
      predecessorBytes.byteLength !== M10A_T12_INSPECTOR_SUCCESSOR.predecessor.bytes ||
      sha256(predecessorBytes) !== M10A_T12_INSPECTOR_SUCCESSOR.predecessor.sha256
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "Removing only reviewed T12 Inspector changes must reproduce the exact T06 receipt.",
        { path: relativePath },
      );
    }
    return predecessorBytes;
  }
  const successor = [M10A_T12_APP_PACKAGE_SUCCESSOR, M10A_T12_BROWSER_PACKAGE_SUCCESSOR].find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A current T12 manifest input is outside its exact reviewed successor receipt.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const fragment of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, fragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "A T12 manifest successor lost one exact additive declaration.",
        { path: relativePath, fragment },
      );
    }
    predecessorText = predecessorText.replace(fragment, "");
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only reviewed T12 manifest additions must reproduce the exact T11 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Projects one exact T10 policy input back to the M10A-T04 policy boundary. */
export function projectM10AT10T04Input(relativePath, bytes) {
  const successor = M10A_T10_T04_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A reviewed M10A-T04 input is not the exact M10A-T10 additive successor.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const [currentFragment, predecessorFragment] of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, currentFragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "An M10A-T10 successor input lost one exact reviewed policy addition.",
        { path: relativePath },
      );
    }
    predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only M10A-T10 policy additions must reproduce the exact M10A-T04 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Projects one exact live M10A-T03 policy input back to its reviewed M10A-T02 predecessor. */
export function projectM10AT03T02Input(relativePath, bytes) {
  const successor = M10A_T03_T02_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A reviewed M10A-T02 input is not the exact M10A-T03 additive successor.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const [currentFragment, predecessorFragment] of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, currentFragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "An M10A-T03 successor input lost one exact reviewed policy addition.",
        { path: relativePath },
      );
    }
    predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only M10A-T03 policy additions must reproduce the exact M10A-T02 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Projects one exact live M10A-T04 policy input back to its reviewed M10A-T03 predecessor. */
export function projectM10AT04T03Input(relativePath, bytes) {
  const successor = M10A_T04_T03_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A reviewed M10A-T03 input is not the exact M10A-T04 additive successor.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const [currentFragment, predecessorFragment] of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, currentFragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "An M10A-T04 successor input lost one exact reviewed policy addition.",
        { path: relativePath },
      );
    }
    predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only M10A-T04 policy additions must reproduce the exact M10A-T03 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Projects one exact live M10A-T02 policy input back to its reviewed M10A-T01 predecessor. */
export function projectM10AT02T01Input(relativePath, bytes) {
  const successor = M10A_T02_T01_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A reviewed M10A-T01 input is not the exact M10A-T02 additive successor.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const [currentFragment, predecessorFragment] of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, currentFragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "An M10A-T02 successor input lost one exact reviewed policy addition.",
        { path: relativePath },
      );
    }
    predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only M10A-T02 policy additions must reproduce the exact M10A-T01 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Projects one exact M10A-T01 policy input back to its reviewed M10-T08 predecessor. */
export function projectM10AT01T08Input(relativePath, bytes) {
  const successor = M10A_T01_T08_INPUT_SUCCESSORS.find(
    ({ path: successorPath }) => successorPath === relativePath,
  );
  if (successor === undefined) return bytes;
  if (bytes.byteLength !== successor.bytes || sha256(bytes) !== successor.sha256) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A reviewed T08 input is not the exact M10A-T01 additive successor.",
      { path: relativePath },
    );
  }
  let predecessorText = decodeUtf8(bytes, relativePath, "SUCCESSOR_POLICY_VIOLATION");
  for (const [currentFragment, predecessorFragment] of successor.inverseChanges) {
    if (occurrenceCount(predecessorText, currentFragment) !== 1) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "An M10A-T01 successor input lost one exact reviewed policy addition.",
        { path: relativePath },
      );
    }
    predecessorText = predecessorText.replace(currentFragment, predecessorFragment);
  }
  const predecessorBytes = Buffer.from(predecessorText);
  if (
    predecessorBytes.byteLength !== successor.predecessor.bytes ||
    sha256(predecessorBytes) !== successor.predecessor.sha256
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "Removing only M10A-T01 policy additions must reproduce the exact T08 receipt.",
      { path: relativePath },
    );
  }
  return predecessorBytes;
}

/** Reconstructs the exact T01 graph successor without projecting it away. */
function buildM10AT01SuccessorGraphAudit(t08GraphAudit) {
  if (t08GraphAudit === null || typeof t08GraphAudit !== "object") {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08/M10A graph authority is missing.");
  }
  const moduleSuccessors = new Map(
    M10A_T01_APP_GRAPH_SUCCESSOR.modules.map((module) => [module.id, module]),
  );
  const observedModuleIds = t08GraphAudit.runtimeResolution?.appModules
    ?.filter(({ id }) => moduleSuccessors.has(id))
    .map(({ id }) => id);
  if (
    !isDeepStrictEqual(
      observedModuleIds,
      M10A_T01_APP_GRAPH_SUCCESSOR.modules.map(({ id }) => id),
    )
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The T08 graph lost one exact Editor Core predecessor module.",
    );
  }
  let entryOutputs = 0;
  let htmlOutputs = 0;
  const expectedOutputs = t08GraphAudit.runtimeResolution.appOutput.outputs.map((output) => {
    if (output.type === "chunk" && output.isEntry === true) {
      entryOutputs += 1;
      return {
        ...output,
        ...M10A_T01_APP_GRAPH_SUCCESSOR.entryOutput,
      };
    }
    if (output.fileName === "index.html" && output.type === "asset") {
      htmlOutputs += 1;
      return {
        ...output,
        sha256: M10A_T01_APP_GRAPH_SUCCESSOR.htmlSha256,
      };
    }
    return output;
  });
  if (entryOutputs !== 1 || htmlOutputs !== 1) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08 graph lost its exact App entry or HTML output.");
  }
  return {
    ...t08GraphAudit,
    runtimeResolution: {
      ...t08GraphAudit.runtimeResolution,
      app: {
        ...t08GraphAudit.runtimeResolution.app,
        graphSha256: M10A_T01_APP_GRAPH_SUCCESSOR.graphSha256,
      },
      appModules: t08GraphAudit.runtimeResolution.appModules.map((module) => {
        const successor = moduleSuccessors.get(module.id);
        return successor === undefined
          ? module
          : {
              ...module,
              codeBytes: successor.codeBytes,
              codeSha256: successor.codeSha256,
            };
      }),
      appOutput: {
        ...t08GraphAudit.runtimeResolution.appOutput,
        outputs: expectedOutputs,
        identitySha256: M10A_T01_APP_GRAPH_SUCCESSOR.outputIdentitySha256,
      },
      backingSnapshotSha256: M10A_T01_APP_GRAPH_SUCCESSOR.backingSnapshotSha256,
    },
  };
}

/** Authenticates the exact M10A-T01 App-graph successor and returns the frozen T08 graph. */
export function projectM10AT01CurrentGraphAudit(currentGraphAudit, t08GraphAudit) {
  if (currentGraphAudit === null || typeof currentGraphAudit !== "object") {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08/M10A graph authority is missing.");
  }
  const expectedSuccessor = buildM10AT01SuccessorGraphAudit(t08GraphAudit);
  if (!isDeepStrictEqual(currentGraphAudit, expectedSuccessor)) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The fresh App/host graph is not the exact reviewed M10A-T01 successor of T08.",
    );
  }
  return t08GraphAudit;
}

/** Builds the exact reachable T11 graph successor without projecting its historical boundary. */
function buildM10AT11SuccessorGraphAudit(t08GraphAudit) {
  if (t08GraphAudit === null || typeof t08GraphAudit !== "object") {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08/M10A graph authority is missing.");
  }
  const t01GraphAudit = buildM10AT01SuccessorGraphAudit(t08GraphAudit);
  const historicalSourceAudit = t01GraphAudit.appSourceAudit;
  const historicalRuntime = t01GraphAudit.runtimeResolution;
  if (
    historicalSourceAudit === null ||
    typeof historicalSourceAudit !== "object" ||
    historicalRuntime === null ||
    typeof historicalRuntime !== "object" ||
    !isDeepStrictEqual(historicalSourceAudit.inventory, APP_SOURCE_PATHS) ||
    historicalSourceAudit.completeSourceFiles !== APP_SOURCE_PATHS.length ||
    historicalSourceAudit.productionGraphSourceFiles !== APP_GRAPH_SOURCE_PATHS.length ||
    !Array.isArray(historicalSourceAudit.sourceReceipts) ||
    !Array.isArray(historicalRuntime.appModules)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08 graph cannot anchor the reviewed T11 successor.");
  }

  const sourceSuccessors = new Map(
    M10A_T11_APP_SOURCE_SUCCESSORS.map((receipt) => [receipt.path, receipt]),
  );
  const historicalSourceReceipts = new Map(
    historicalSourceAudit.sourceReceipts.map((receipt) => [receipt?.path, receipt]),
  );
  const expectedSourceReceipts = CURRENT_APP_SOURCE_RECEIPT_PATHS.map((relativePath) => {
    const successor = sourceSuccessors.get(relativePath);
    if (successor !== undefined) return successor;
    const historical = historicalSourceReceipts.get(relativePath);
    if (historical === undefined) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T08 source receipt set lost one untouched App source.",
        { path: relativePath },
      );
    }
    return historical;
  });
  if (
    !isDeepStrictEqual(
      [...sourceSuccessors.keys()].sort((left, right) => left.localeCompare(right, "en-US")),
      [
        "apps/desen-app/src/application.module.css",
        "apps/desen-app/src/application.tsx",
        "apps/desen-app/src/authoring-direct-manipulation.ts",
        "apps/desen-app/src/authoring-slots.ts",
        "apps/desen-app/src/canvas-manipulation-controls.tsx",
      ],
    )
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T11 source successor set drifted.");
  }

  const transformedModules = new Map(
    M10A_T11_APP_GRAPH_SUCCESSOR.transformedModules.map((module) => [module.id, module]),
  );
  const historicalModuleIds = new Set(historicalRuntime.appModules.map(({ id }) => id));
  if (
    M10A_T11_APP_GRAPH_SUCCESSOR.transformedModules.some(
      ({ id }) => !historicalModuleIds.has(id),
    ) ||
    M10A_T11_APP_GRAPH_SUCCESSOR.addedModules.some(({ id }) => historicalModuleIds.has(id))
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08 module graph cannot anchor the T11 delta.");
  }
  const expectedAppModules = [
    ...historicalRuntime.appModules.map((module) => {
      const successor = transformedModules.get(module.id);
      if (successor === undefined) return module;
      if (module.id === "apps/desen-app/src/application.tsx") {
        return {
          ...module,
          ...successor,
          imports: [...new Set([...module.imports, ...M10A_T11_REACHABLE_APP_SOURCE_PATHS])].sort(
            (left, right) => left.localeCompare(right, "en-US"),
          ),
        };
      }
      return { ...module, ...successor };
    }),
    ...M10A_T11_APP_GRAPH_SUCCESSOR.addedModules,
  ].sort(({ id: left }, { id: right }) => left.localeCompare(right, "en-US"));
  const expectedCurrentGraphAudit = {
    ...t01GraphAudit,
    appSourceAudit: {
      ...historicalSourceAudit,
      inventory: CURRENT_APP_SOURCE_INVENTORY_PATHS,
      completeSourceFiles: CURRENT_APP_SOURCE_INVENTORY_PATHS.length,
      productionGraphSourceFiles: CURRENT_APP_GRAPH_SOURCE_PATHS.length,
      sourceReceipts: expectedSourceReceipts,
    },
    runtimeResolution: {
      ...historicalRuntime,
      app: M10A_T11_APP_GRAPH_SUCCESSOR.app,
      appModules: expectedAppModules,
      completeAppSourceFiles: M10A_T11_APP_GRAPH_SUCCESSOR.completeAppSourceFiles,
      appOutput: M10A_T11_APP_GRAPH_SUCCESSOR.appOutput,
      backingFiles: M10A_T11_APP_GRAPH_SUCCESSOR.backingFiles,
      backingSnapshotSha256: M10A_T11_APP_GRAPH_SUCCESSOR.backingSnapshotSha256,
    },
  };
  return deepFreeze(expectedCurrentGraphAudit);
}

/**
 * Authenticates the exact reachable T11 successor, then returns the reviewed T10-shaped graph.
 * T10's three lifecycle files remain inventory-only and are deliberately left for its own narrow
 * projector. No historical receipt is reused until this full fresh App and host graph matches.
 */
export function projectM10AT11CurrentGraphAudit(currentGraphAudit, t08GraphAudit) {
  const expectedCurrentGraphAudit = buildM10AT11SuccessorGraphAudit(t08GraphAudit);
  if (!isDeepStrictEqual(currentGraphAudit, expectedCurrentGraphAudit)) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The fresh App/host graph is not the exact reviewed M10A-T11 successor of T08.",
    );
  }
  const t01GraphAudit = buildM10AT01SuccessorGraphAudit(t08GraphAudit);
  const historicalSourceAudit = t01GraphAudit.appSourceAudit;
  return deepFreeze({
    ...t01GraphAudit,
    appSourceAudit: {
      ...historicalSourceAudit,
      inventory: Object.freeze(
        [...APP_SOURCE_PATHS, ...M10A_T10_ISOLATED_APP_SOURCE_PATHS].sort((left, right) =>
          left.localeCompare(right, "en-US"),
        ),
      ),
      completeSourceFiles: APP_SOURCE_PATHS.length + M10A_T10_ISOLATED_APP_SOURCE_PATHS.length,
    },
  });
}

/**
 * Authenticates T12's complete normal-App source and Vite graph successor, then returns the
 * exact T11-shaped graph required by the existing T11 → T10 → T01 projection chain. The full
 * canonical graph receipt covers every transformed dependency module rather than admitting a
 * potentially open-ended vendor subgraph.
 */
export function projectM10AT12CurrentGraphAudit(currentGraphAudit, t08GraphAudit) {
  if (
    currentGraphAudit === null ||
    typeof currentGraphAudit !== "object" ||
    t08GraphAudit === null ||
    typeof t08GraphAudit !== "object"
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08/M10A graph authority is missing.");
  }
  const t11GraphAudit = buildM10AT11SuccessorGraphAudit(t08GraphAudit);
  const t11SourceAudit = t11GraphAudit.appSourceAudit;
  const t11Runtime = t11GraphAudit.runtimeResolution;
  if (
    t11SourceAudit === null ||
    typeof t11SourceAudit !== "object" ||
    t11Runtime === null ||
    typeof t11Runtime !== "object" ||
    !Array.isArray(t11SourceAudit.sourceReceipts) ||
    !Array.isArray(t11Runtime.hostModules)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T11 graph cannot anchor the reviewed T12 successor.");
  }

  const t12SourceSuccessors = new Map(
    M10A_T12_APP_SOURCE_SUCCESSORS.map((receipt) => [receipt.path, receipt]),
  );
  t12SourceSuccessors.set(M10A_T14_APP_SOURCE_SUCCESSOR.path, M10A_T14_APP_SOURCE_SUCCESSOR);
  const retainedT10Receipts = new Map(
    M10A_T12_RETAINED_T10_APP_SOURCE_RECEIPTS.map((receipt) => [receipt.path, receipt]),
  );
  const t11SourceReceipts = new Map(
    t11SourceAudit.sourceReceipts.map((receipt) => [receipt?.path, receipt]),
  );
  if (
    !isDeepStrictEqual(
      [...t12SourceSuccessors.keys()].sort((left, right) => left.localeCompare(right, "en-US")),
      [
        "apps/desen-app/src/application.module.css",
        "apps/desen-app/src/application.tsx",
        "apps/desen-app/src/authoring-data.ts",
        "apps/desen-app/src/authoring-design-tokens.ts",
        "apps/desen-app/src/authoring-inspector.ts",
        "apps/desen-app/src/authoring-style-preview-runtime.ts",
        "apps/desen-app/src/authoring-styles.ts",
        "apps/desen-app/src/inspector-panel.tsx",
        "apps/desen-app/src/local-project-workspace-persistence.ts",
        "apps/desen-app/src/main.tsx",
        "apps/desen-app/src/preview-fidelity.ts",
        "apps/desen-app/src/product-bootstrap.tsx",
        "apps/desen-app/src/project-workspace-authoring-persistence.ts",
        "apps/desen-app/src/starter-neutral-workspace-profile.ts",
        "apps/desen-app/src/starter-project.ts",
        "apps/desen-app/src/starter-workspace-product.tsx",
        "apps/desen-app/src/style-panel.tsx",
      ],
    ) ||
    !isDeepStrictEqual(
      [...retainedT10Receipts.keys()].sort((left, right) => left.localeCompare(right, "en-US")),
      [
        "apps/desen-app/src/project-lifecycle-navigation.ts",
        "apps/desen-app/src/project-lifecycle.ts",
      ],
    ) ||
    !isDeepStrictEqual(M10A_T12_REACHABLE_T10_APP_SOURCE_PATHS, [
      "apps/desen-app/src/project-lifecycle.ts",
      "apps/desen-app/src/starter-project.ts",
    ])
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T12 source successor set drifted.");
  }
  const expectedSourceReceipts = M10A_T12_APP_SOURCE_RECEIPT_PATHS.map((relativePath) => {
    const successor = t12SourceSuccessors.get(relativePath);
    if (successor !== undefined) {
      return Object.freeze({
        path: successor.path,
        bytes: successor.bytes,
        sha256: successor.sha256,
      });
    }
    const retained = retainedT10Receipts.get(relativePath);
    if (retained !== undefined) return retained;
    const historical = t11SourceReceipts.get(relativePath);
    if (historical === undefined) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "The T11 source receipt set lost one untouched T12 App source.",
        { path: relativePath },
      );
    }
    return historical;
  });
  const t15SourceReceipts = new Map(
    expectedSourceReceipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const successor of M10A_T15_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T15 must retain the exact reviewed predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const added of M10A_T15_ADDED_APP_SOURCE_RECEIPTS) {
    if (t15SourceReceipts.has(added.path))
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T15 cannot replace a predecessor through its additive inventory.",
      );
    t15SourceReceipts.set(added.path, { ...added, sha256: `sha256:${added.sha256}` });
  }
  for (const successor of M10A_T16_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T16 must retain the exact reviewed T15 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const successor of M10A_T17_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T17 must retain the exact reviewed T16 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const added of M10A_T17_ADDED_APP_SOURCE_RECEIPTS) {
    if (t15SourceReceipts.has(added.path))
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T17 cannot replace a predecessor through its additive inventory.",
      );
    t15SourceReceipts.set(added.path, { ...added, sha256: `sha256:${added.sha256}` });
  }
  for (const successor of M10A_T18_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T18 must retain the exact reviewed T17 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const added of M10A_T18_ADDED_APP_SOURCE_RECEIPTS) {
    if (t15SourceReceipts.has(added.path))
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T18 cannot replace a predecessor through its additive inventory.",
      );
    t15SourceReceipts.set(added.path, { ...added, sha256: `sha256:${added.sha256}` });
  }
  for (const successor of M10A_T19_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T19 must retain the exact reviewed T18 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const added of M10A_T19_ADDED_APP_SOURCE_RECEIPTS) {
    if (t15SourceReceipts.has(added.path))
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T19 cannot replace a predecessor through its additive inventory.",
      );
    t15SourceReceipts.set(added.path, { ...added, sha256: `sha256:${added.sha256}` });
  }
  for (const successor of M10A_T21_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T21 must retain the exact reviewed T20 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  for (const successor of M10A_T20_LEGACY_INPUT_SUCCESSORS) {
    if (!successor.path.startsWith("apps/desen-app/src/")) continue;
    const prior = t15SourceReceipts.get(successor.path);
    if (
      prior?.bytes !== successor.predecessor.bytes ||
      prior.sha256 !== `sha256:${successor.predecessor.sha256}`
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "T20 must retain the exact reviewed T19 predecessor source receipt.",
        { path: successor.path },
      );
    }
    t15SourceReceipts.set(successor.path, {
      path: successor.path,
      bytes: successor.current.bytes,
      sha256: `sha256:${successor.current.sha256}`,
    });
  }
  // The previously dormant T13 adapter now also receives exact bytes in the complete inventory;
  // it remains absent from the executable graph, so this grants no new runtime authority.
  t15SourceReceipts.set("apps/desen-app/src/design-system-asset-storage.ts", {
    path: "apps/desen-app/src/design-system-asset-storage.ts",
    bytes: 6_129,
    sha256: "sha256:3d7a7e405d6a9aa45d03e530d6269d22b3d30fdecb25099a6094622a8838066a",
  });
  const expectedSourceAudit = {
    ...t11SourceAudit,
    inventory: M10A_T15_APP_SOURCE_RECEIPT_PATHS,
    completeSourceFiles: M10A_T15_APP_SOURCE_RECEIPT_PATHS.length,
    productionGraphSourceFiles: M10A_T15_APP_GRAPH_SOURCE_PATHS.length,
    sourceReceipts: M10A_T15_APP_SOURCE_RECEIPT_PATHS.map((sourcePath) =>
      t15SourceReceipts.get(sourcePath),
    ),
  };

  const runtime = currentGraphAudit.runtimeResolution;
  if (runtime === null || typeof runtime !== "object") {
    fail("SUCCESSOR_POLICY_VIOLATION", "The current T12 runtime graph is missing.");
  }
  const graphPolicy = verifyDesenAppPublishedHostUpdateGraphPolicy({
    appGraph: runtime.appModules,
    appSourcePaths: M10A_T15_APP_GRAPH_SOURCE_PATHS,
    hostGraph: runtime.hostModules,
    hostSourcePaths: HOST_SOURCE_PATHS,
  });
  if (
    !isDeepStrictEqual(graphPolicy.app, M10A_T15_APP_GRAPH_SUCCESSOR.app) ||
    !isDeepStrictEqual(graphPolicy.host, t11Runtime.host) ||
    !isDeepStrictEqual(graphPolicy.hostModules, t11Runtime.hostModules) ||
    !isDeepStrictEqual(graphPolicy.sharedManagedIdentity, t11Runtime.sharedManagedIdentity) ||
    graphPolicy.sharedManagedModuleCount !== t11Runtime.sharedManagedModuleCount
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The fresh Vite graph is not the exact reviewed T12 successor.",
    );
  }
  const expectedRuntime = {
    ...graphPolicy,
    independentBuildsPerApplication: 2,
    deterministic: true,
    appOutput: M10A_T15_APP_GRAPH_SUCCESSOR.appOutput,
    hostOutput: t11Runtime.hostOutput,
    hostOutputIdentityAEqualsB: true,
    backingFiles: M10A_T15_APP_GRAPH_SUCCESSOR.backingFiles,
    backingSnapshotSha256: M10A_T15_APP_GRAPH_SUCCESSOR.backingSnapshotSha256,
    backingModulesStableAcrossObservations: true,
  };
  const expectedCurrentGraphAudit = {
    ...t11GraphAudit,
    appSourceAudit: expectedSourceAudit,
    runtimeResolution: expectedRuntime,
  };
  if (!isDeepStrictEqual(currentGraphAudit, expectedCurrentGraphAudit)) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The fresh App/host graph is not the exact reviewed M10A-T12 successor of T11.",
    );
  }
  return t11GraphAudit;
}

/** Projects only the exact inventory-only T10 lifecycle successor after T11 was authenticated. */
function projectM10AT10IsolatedAppSourceInventory(currentGraphAudit, t08GraphAudit) {
  const sourceAudit = currentGraphAudit?.appSourceAudit;
  const historicalSourceAudit = t08GraphAudit?.appSourceAudit;
  const expectedInventory = [...APP_SOURCE_PATHS, ...M10A_T10_ISOLATED_APP_SOURCE_PATHS].sort(
    (left, right) => left.localeCompare(right, "en-US"),
  );
  if (
    sourceAudit === null ||
    typeof sourceAudit !== "object" ||
    historicalSourceAudit === null ||
    typeof historicalSourceAudit !== "object" ||
    !isDeepStrictEqual(sourceAudit.inventory, expectedInventory) ||
    sourceAudit.completeSourceFiles !== expectedInventory.length ||
    sourceAudit.productionGraphSourceFiles !== APP_GRAPH_SOURCE_PATHS.length ||
    !isDeepStrictEqual(sourceAudit.sourceReceipts, historicalSourceAudit.sourceReceipts)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T10 lifecycle inventory drifted.");
  }
  return {
    ...currentGraphAudit,
    appSourceAudit: historicalSourceAudit,
  };
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
  const t01aAncestorPin = pin.t01aAncestor;
  if (
    !exactJsonKeys(manifest, [
      "schemaVersion",
      "profile",
      "baseCommit",
      "t01aAncestor",
      "successorAddedPaths",
      "predecessorGapFiles",
      "files",
      "projections",
    ]) ||
    manifest.schemaVersion !== 1 ||
    manifest.profile !== "desen.app.m10-t04-historical-reader-bridge.v1" ||
    manifest.baseCommit !== pin.baseCommit ||
    !exactJsonKeys(manifest.t01aAncestor, ["task", "baseCommit", "artifact", "files"]) ||
    manifest.t01aAncestor.task !== t01aAncestorPin.task ||
    manifest.t01aAncestor.baseCommit !== t01aAncestorPin.baseCommit ||
    !exactJsonKeys(manifest.t01aAncestor.artifact, ["path", "bytes", "sha256"]) ||
    !isDeepStrictEqual(manifest.t01aAncestor.artifact, t01aAncestorPin.artifact) ||
    !exactJsonKeys(
      manifest.t01aAncestor.files,
      T01A_ANCESTOR_GAP_RECEIPTS.map(({ path: relativePath }) => relativePath),
    ) ||
    Object.keys(manifest.t01aAncestor.files).length !== t01aAncestorPin.fileEntries ||
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
  const t01aAncestorFiles = new Map();
  for (const receipt of T01A_ANCESTOR_GAP_RECEIPTS) {
    const encoded = manifest.t01aAncestor.files[receipt.path];
    if (
      typeof encoded !== "string" ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)
    ) {
      fail("HISTORICAL_BRIDGE_DRIFT", `Malformed M10-T01A ancestor gap: ${receipt.path}.`);
    }
    const bytes = Buffer.from(encoded, "base64");
    decodedBytes += bytes.byteLength;
    if (
      bytes.toString("base64") !== encoded ||
      bytes.byteLength !== receipt.bytes ||
      sha256(bytes) !== receipt.sha256 ||
      decodedBytes > MAX_HISTORICAL_DECODED_BYTES
    ) {
      fail("HISTORICAL_BRIDGE_DRIFT", `M10-T01A ancestor gap drifted: ${receipt.path}.`);
    }
    if (predecessorGapFiles.has(receipt.path) || !files.has(receipt.path)) {
      fail(
        "HISTORICAL_BRIDGE_DRIFT",
        `M10-T01A ancestor gap is not separate from the T04 file authorities: ${receipt.path}.`,
      );
    }
    t01aAncestorFiles.set(receipt.path, bytes);
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
    t01aAncestor: Object.freeze({
      task: manifest.t01aAncestor.task,
      baseCommit: manifest.t01aAncestor.baseCommit,
      artifact: deepFreeze(manifest.t01aAncestor.artifact),
      files: t01aAncestorFiles,
    }),
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
  if (occurrenceCount(source.main, "publicationPort={publicationPort}") !== 2) {
    fail(
      "SOURCE_POLICY_VIOLATION",
      "Only the two installed Account and Flow workspaces may receive local publication authority.",
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
      "              publicationPort={publicationPort}",
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
    flowWorkspaceCannotReceivePublicationPort: false,
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
      'const desenAppBrowserPublicationServerPaths =\n  "^apps/desen-app-browser-e2e/(?:published-host-proof-server|restart-recovery-proof-server)\\\\.mjs$";',
      'const desenAppBrowserRecoveryProofServerPath =\n  "^apps/desen-app-browser-e2e/restart-recovery-proof-server\\\\.mjs$";',
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
      `const EXPECTED_T01A_BASE_COMMIT = "${DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.t01aAncestor.baseCommit}";`,
      `sha256: "${DESEN_APP_T04_HISTORICAL_READER_BRIDGE_PIN.t01aAncestor.artifact.sha256}"`,
      ...T01A_ANCESTOR_GAP_RECEIPTS.map(({ sha256: digest }) => `sha256: "${digest}"`),
      'profile: "desen.app.m10-t04-historical-reader-bridge.v1"',
      "t01aAncestor",
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
    exactT01aAncestorBaseCommit: true,
    exactT01aAncestorArtifactReceipt: true,
    t01aAncestorNamespaceSeparate: true,
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
    lengthDescriptor.value > 1_024
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
      (application === "apps/desen-app" && APP_ALLOWED_NODE_MODULE_PACKAGES.test(module.id)) ||
      (application === "apps/reference-host-web" &&
        /^node_modules\/(?:react|react-dom|scheduler)\//u.test(module.id)) ||
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
    !isDeepStrictEqual(appSourcePaths, M10A_T15_APP_GRAPH_SOURCE_PATHS) ||
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
    completeAppSourceFiles: M10A_T15_APP_SOURCE_RECEIPT_PATHS.length,
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
    appSourcePaths: M10A_T15_APP_GRAPH_SOURCE_PATHS,
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
    projectM10AT15HistoricalInput(
      "apps/desen-app-browser-e2e/package.json",
      files.get("apps/desen-app-browser-e2e/package.json"),
    ),
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
    browser.scripts?.["test:e2e"] !== M10A_T12_BROWSER_E2E_SCRIPT ||
    browser.devDependencies?.["@desen/protocol"] !== "workspace:*" ||
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
    browserSuiteBuildsDependencyClosures: true,
  });
}

async function canonicalArtifactBytes(artifact) {
  return Buffer.from(await format(JSON.stringify(artifact), { parser: "json" }));
}

/**
 * Observes the complete current App and independent host without projecting a historical proof.
 * Successor proofs share the fresh build policy, not the predecessor's recorded build results.
 * No caller-supplied source overrides or graph receipts can authorize this observation.
 */
export async function buildCurrentDesenAppPublishedHostUpdateGraphAudit(rawOptions = undefined) {
  const options = exactOwnDataOptions(rawOptions, ["workspaceRoot"], "current graph options");
  const workspaceRoot = captureAbsolutePath(
    options.workspaceRoot ?? WORKSPACE_ROOT,
    "workspaceRoot",
  );
  const acquired = await acquireFiles({ workspaceRoot, fileOverrides: new Map() });
  const appSourceReceipts = sourceReceipts(acquired.files, M10A_T15_APP_SOURCE_RECEIPT_PATHS);
  const hostSourceReceipts = sourceReceipts(acquired.files, HOST_SOURCE_PATHS);
  const referenceHostSourceAudit = await buildFreshHostAudit(workspaceRoot, acquired.files);
  const runtimeResolution = await buildDualViteAudit(workspaceRoot);
  const [appAfter, hostAfter, appInventoryAfter, hostInventoryAfter, serverInventoryAfter] =
    await Promise.all([
      snapshotBackingFiles(workspaceRoot, M10A_T15_APP_SOURCE_RECEIPT_PATHS),
      snapshotBackingFiles(workspaceRoot, HOST_SOURCE_PATHS),
      inventoryDirectory(workspaceRoot, "apps/desen-app/src"),
      inventoryDirectory(workspaceRoot, "apps/reference-host-web/src"),
      inventoryDirectory(workspaceRoot, "apps/reference-host-web-server/src"),
    ]);
  if (
    !isDeepStrictEqual(appSourceReceipts, appAfter) ||
    !isDeepStrictEqual(hostSourceReceipts, hostAfter) ||
    !isDeepStrictEqual(acquired.appInventory, appInventoryAfter) ||
    !isDeepStrictEqual(acquired.hostInventory, hostInventoryAfter) ||
    !isDeepStrictEqual(acquired.hostServerInventory, serverInventoryAfter)
  ) {
    fail(
      "SOURCE_SNAPSHOT_DRIFT",
      "Current App or host authority changed across graph observation.",
    );
  }
  return deepFreeze({
    appSourceAudit: {
      inventory: M10A_T15_APP_SOURCE_RECEIPT_PATHS,
      completeSourceFiles: M10A_T15_APP_SOURCE_RECEIPT_PATHS.length,
      productionGraphSourceFiles: M10A_T15_APP_GRAPH_SOURCE_PATHS.length,
      fixtureOnlySourceFiles: APP_FIXTURE_ONLY_SOURCE_PATHS,
      sourceReceipts: appSourceReceipts,
      everyProductionSourceFileReachable: true,
      fixtureOnlyModulesExcludedFromProductionGraph: true,
      importsResolvedByFreshViteBuild: true,
    },
    referenceHostSourceAudit,
    runtimeResolution,
  });
}

/** Builds fresh M10-T05 evidence without starting Chromium, a listener, or writing Vite output. */
export async function buildDesenAppPublishedHostUpdateEvidence(rawOptions = undefined) {
  const options = captureBuildOptions(rawOptions);
  const acquired = await acquireFiles(options);
  const files = acquired.files;
  const recoverySuccessor = await readT08SuccessorArtifact(options.workspaceRoot);
  const dependencyPin = DEPENDENCY_SECURITY_LOCKFILE_RECEIPTS;
  const dependencyBytes = files.get(dependencyPin.path);
  const t12LockfileSuccessor = authenticateM10AT12LockfileSuccessor(dependencyBytes);
  const t12HistoricalLockfileSuccessor = authenticateM10AT12HistoricalLockfileSuccessor(
    t12LockfileSuccessor.predecessorBytes,
  );
  const t10LockfileSuccessor = authenticateM10AT10LockfileSuccessor(
    t12HistoricalLockfileSuccessor.predecessorBytes,
  );
  const t04LockfileSuccessor = authenticateM10AT04LockfileSuccessor(
    t10LockfileSuccessor.predecessorBytes,
  );
  const t03LockfileSuccessor = authenticateM10AT03LockfileSuccessor(
    t04LockfileSuccessor.predecessorBytes,
  );
  const t02LockfileSuccessor = authenticateM10AT02LockfileSuccessor(
    t03LockfileSuccessor.predecessorBytes,
  );
  const lockfileSuccessor = authenticateM10AT01LockfileSuccessor(
    t02LockfileSuccessor.predecessorBytes,
  );
  assertT08Receipt(
    recoverySuccessor,
    dependencyPin.path,
    lockfileSuccessor.predecessorBytes,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  const t08ProjectedInputs = new Map(
    M10A_T01_T08_INPUT_SUCCESSORS.map(({ path: relativePath }) => [
      relativePath,
      projectM10AT01T08Input(
        relativePath,
        projectM10AT02T01Input(
          relativePath,
          projectM10AT03T02Input(
            relativePath,
            projectM10AT04T03Input(
              relativePath,
              projectM10AT10T04Input(
                relativePath,
                projectM10AT12HistoricalInput(relativePath, files.get(relativePath)),
              ),
            ),
          ),
        ),
      ),
    ]),
  );
  const t12ProjectedInputs = new Map(
    [M10A_T12_APP_PACKAGE_SUCCESSOR.path, M10A_T12_BROWSER_PACKAGE_SUCCESSOR.path].map(
      (relativePath) => [
        relativePath,
        projectM10AT12HistoricalInput(relativePath, files.get(relativePath)),
      ],
    ),
  );
  const t11ProjectedInputs = new Map([
    [
      M10A_T10_APP_PACKAGE_SUCCESSOR.path,
      projectM10AT10HistoricalInput(
        M10A_T10_APP_PACKAGE_SUCCESSOR.path,
        projectM10AT11HistoricalInput(
          M10A_T11_APP_PACKAGE_SUCCESSOR.path,
          t12ProjectedInputs.get(M10A_T11_APP_PACKAGE_SUCCESSOR.path),
        ),
      ),
    ],
  ]);
  let securityLockfileText = lockfileSuccessor.predecessorText;
  for (const importer of ["apps/desen-app-browser-e2e", "apps/reference-host-web"]) {
    const start = securityLockfileText.indexOf(`  ${importer}:\n`);
    const end = securityLockfileText.indexOf("\n  apps/", start + 1);
    const block = securityLockfileText.slice(start, end);
    if (start < 0 || end < 0 || occurrenceCount(block, T07_PROTOCOL_LOCKFILE_ADDITION) !== 1) {
      fail(
        "DEPENDENCY_SUCCESSOR_DRIFT",
        "Each reviewed browser/host Protocol test link must occur exactly once.",
      );
    }
    securityLockfileText =
      securityLockfileText.slice(0, start) +
      block.replace(T07_PROTOCOL_LOCKFILE_ADDITION, "") +
      securityLockfileText.slice(end);
  }
  const securityLockfile = Buffer.from(securityLockfileText);
  if (
    securityLockfile.byteLength !== dependencyPin.currentBytes ||
    sha256(securityLockfile) !== dependencyPin.currentSha256
  ) {
    fail(
      "DEPENDENCY_SUCCESSOR_DRIFT",
      "Removing only the reviewed T07/T08 Protocol test links must reproduce the exact SEC-02 security lockfile.",
    );
  }
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
  for (const relativePath of T08_REVIEWED_CHANGED_PATHS) {
    if (assertM10AT12SourceSuccessorReceipt(relativePath, files.get(relativePath))) continue;
    assertT08Receipt(
      recoverySuccessor,
      relativePath,
      t08ProjectedInputs.get(relativePath) ??
        t12ProjectedInputs.get(relativePath) ??
        files.get(relativePath),
    );
  }
  const acquiredAppSourceReceipts = sourceReceipts(files, M10A_T15_APP_SOURCE_RECEIPT_PATHS);
  const acquiredHostSourceReceipts = sourceReceipts(files, HOST_SOURCE_PATHS);
  const freshHostAudit = await buildFreshHostAudit(options.workspaceRoot, files);
  const viteAudit = await buildDualViteAudit(options.workspaceRoot);
  const finalAppSourceReceipts = await snapshotBackingFiles(
    options.workspaceRoot,
    M10A_T15_APP_SOURCE_RECEIPT_PATHS,
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
      // Live App, dependency-boundary, and Vite observations stay fresh. Only exact reviewed
      // successor receipts are projected when reconstructing the immutable M10 artifact.
      if (relativePath === dependencyPin.path) {
        return Object.freeze({
          path: relativePath,
          bytes: dependencyPin.historicalBytes,
          sha256: dependencyPin.historicalSha256,
        });
      }
      const bytes =
        t08ProjectedInputs.get(relativePath) ??
        t11ProjectedInputs.get(relativePath) ??
        t12ProjectedInputs.get(relativePath) ??
        projectM10AT15HistoricalInput(relativePath, files.get(relativePath));
      return Object.freeze({ path: relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) });
    }),
  );
  const currentArtifact = deepFreeze({
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
        inventory: M10A_T15_APP_SOURCE_RECEIPT_PATHS,
        completeSourceFiles: M10A_T15_APP_SOURCE_RECEIPT_PATHS.length,
        productionGraphSourceFiles: M10A_T15_APP_GRAPH_SOURCE_PATHS.length,
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
      completeAppSourceFiles: M10A_T15_APP_SOURCE_RECEIPT_PATHS.length,
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
  const successorProjection = await projectT06HistoricalPredecessor(
    options.workspaceRoot,
    currentArtifact,
    recoverySuccessor,
  );
  // Reacquire successor identity and every admitted wiring input after the fresh graph work.
  // Caller overrides are checked before projection; they never replace this filesystem fence.
  await readT08SuccessorArtifact(options.workspaceRoot);
  await readT06SuccessorArtifact(options.workspaceRoot);
  for (const relativePath of T08_REVIEWED_CHANGED_PATHS) {
    const currentBytes = await readRegularAuthority(
      path.join(options.workspaceRoot, relativePath),
      relativePath,
    );
    if (assertM10AT12SourceSuccessorReceipt(relativePath, currentBytes)) continue;
    assertT08Receipt(
      recoverySuccessor,
      relativePath,
      projectM10AT01T08Input(
        relativePath,
        projectM10AT02T01Input(
          relativePath,
          projectM10AT03T02Input(
            relativePath,
            projectM10AT04T03Input(
              relativePath,
              projectM10AT10T04Input(
                relativePath,
                projectM10AT12HistoricalInput(relativePath, currentBytes),
              ),
            ),
          ),
        ),
      ),
    );
  }
  const finalDependencyBytes = await readRegularAuthority(
    path.join(options.workspaceRoot, dependencyPin.path),
    dependencyPin.path,
  );
  const finalT12LockfileSuccessor = authenticateM10AT12LockfileSuccessor(finalDependencyBytes);
  const finalT12HistoricalLockfileSuccessor = authenticateM10AT12HistoricalLockfileSuccessor(
    finalT12LockfileSuccessor.predecessorBytes,
  );
  const finalT10LockfileSuccessor = authenticateM10AT10LockfileSuccessor(
    finalT12HistoricalLockfileSuccessor.predecessorBytes,
  );
  const finalT04LockfileSuccessor = authenticateM10AT04LockfileSuccessor(
    finalT10LockfileSuccessor.predecessorBytes,
  );
  const finalT03LockfileSuccessor = authenticateM10AT03LockfileSuccessor(
    finalT04LockfileSuccessor.predecessorBytes,
  );
  const finalT02LockfileSuccessor = authenticateM10AT02LockfileSuccessor(
    finalT03LockfileSuccessor.predecessorBytes,
  );
  const finalLockfileSuccessor = authenticateM10AT01LockfileSuccessor(
    finalT02LockfileSuccessor.predecessorBytes,
  );
  assertT08Receipt(
    recoverySuccessor,
    dependencyPin.path,
    finalLockfileSuccessor.predecessorBytes,
    "DEPENDENCY_SUCCESSOR_DRIFT",
  );
  await verifyTrackedBackingFence(options.workspaceRoot, acquired);
  const artifact = successorProjection.artifact;
  const artifactBytes = await canonicalArtifactBytes(artifact);
  return deepFreeze({
    artifact,
    artifactBytes,
    artifactSha256: sha256(artifactBytes),
    liveSuccessorAuthority: successorProjection.liveSuccessorAuthority,
    dependencySecurityCompatibility: {
      authority: "SEC-02",
      path: dependencyPin.path,
      currentBytes: dependencyBytes.byteLength,
      historicalBytes: dependencyPin.historicalBytes,
      currentSha256: sha256(dependencyBytes),
      t13LockfileSuccessor: {
        task: M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T13_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      t12LockfileSuccessor: {
        task: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T12_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      t10LockfileSuccessor: {
        task: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T10_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      t04LockfileSuccessor: {
        task: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T04_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      t03LockfileSuccessor: {
        task: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T03_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      t02LockfileSuccessor: {
        task: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T02_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      lockfileSuccessor: {
        task: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.authority,
        bytes: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.bytes,
        sha256: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.sha256,
        additivePredecessor: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      },
      compositionSuccessor: {
        task: "M10-T08",
        artifact: { path: T08_SUCCESSOR_PATH, ...T08_SUCCESSOR_PIN },
      },
      compositionLockfile: M10A_T01_LOCKFILE_SUCCESSOR_RECEIPT.predecessor,
      securityTaskLockfile: {
        bytes: dependencyPin.currentBytes,
        sha256: dependencyPin.currentSha256,
      },
      historicalSha256: dependencyPin.historicalSha256,
      predecessor: dependencyPin.predecessor,
      fastify: "5.12.2",
      fastUri: ["3.1.7", "4.1.4"],
      developmentDependencies: {
        undici: "7.29.1",
        postcss: "8.5.28",
        "js-yaml": ["3.15.2", "4.3.2"],
        "brace-expansion": "5.0.9",
        nanoid: "3.3.18",
      },
      projectedReceipts: 2,
      immutableArtifactPreserved: true,
    },
  });
}

async function readT06SuccessorArtifact(workspaceRoot) {
  const bytes = await readRegularAuthority(
    path.join(workspaceRoot, T06_SUCCESSOR_PATH),
    T06_SUCCESSOR_PATH,
  );
  if (
    T06_SUCCESSOR_PIN.bytes <= 0 ||
    bytes.byteLength !== T06_SUCCESSOR_PIN.bytes ||
    sha256(bytes) !== T06_SUCCESSOR_PIN.sha256
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact reviewed T06 successor artifact is required.");
  }
  const artifact = parseJson(bytes, T06_SUCCESSOR_PATH, "SUCCESSOR_POLICY_VIOLATION");
  if (artifact.task !== "M10-T06" || artifact.result !== "PASS") {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T06 successor identity drifted.");
  }
  return deepFreeze(artifact);
}

async function readT08SuccessorArtifact(workspaceRoot) {
  const bytes = await readRegularAuthority(
    path.join(workspaceRoot, T08_SUCCESSOR_PATH),
    T08_SUCCESSOR_PATH,
  );
  if (bytes.byteLength !== T08_SUCCESSOR_PIN.bytes || sha256(bytes) !== T08_SUCCESSOR_PIN.sha256) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The exact reviewed T08 composition artifact is required.");
  }
  const artifact = parseJson(bytes, T08_SUCCESSOR_PATH, "SUCCESSOR_POLICY_VIOLATION");
  if (
    artifact.task !== "M10-T08" ||
    artifact.proofId !== "desen-app-repeatable-demo" ||
    artifact.profile !== "desen.app.repeatable-demo-proof.v1" ||
    artifact.result !== "PASS"
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The T08 composition successor identity drifted.");
  }
  return deepFreeze(artifact);
}

function assertT08Receipt(successor, relativePath, bytes, code = "SUCCESSOR_POLICY_VIOLATION") {
  const receipt = successor.boundary.trackedReceipts.find(
    ({ path: receiptPath }) => receiptPath === relativePath,
  );
  if (receipt?.bytes !== bytes.byteLength || receipt.sha256 !== sha256(bytes)) {
    fail(code, "A current wiring input differs from its exact reviewed T08 receipt.", {
      path: relativePath,
    });
  }
}

/**
 * T12 may replace a former T08-tracked App source or wiring test without changing the frozen
 * T08 artifact. Its current bytes must instead match the complete T12 receipt exactly; callers
 * retain the frozen T08 receipt rather than relabeling a current input as historical evidence.
 */
function assertM10AT12SourceSuccessorReceipt(relativePath, bytes) {
  bytes = projectM10AT15HistoricalInput(relativePath, bytes);
  const receipt = [
    M10A_T14_APP_SOURCE_SUCCESSOR,
    ...M10A_T12_APP_SOURCE_SUCCESSORS,
    ...M10A_T12_REPLACED_T08_INPUT_RECEIPTS,
  ].find(({ path: receiptPath }) => receiptPath === relativePath);
  if (receipt === undefined) return false;
  if (
    bytes.byteLength !== receipt.bytes ||
    sha256(bytes) !== receipt.sha256.slice("sha256:".length)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "A T12 source or wiring successor differs from its exact reviewed receipt.",
      { path: relativePath },
    );
  }
  return true;
}

async function projectT06HistoricalPredecessor(workspaceRoot, currentArtifact, recoverySuccessor) {
  const successor = await readT06SuccessorArtifact(workspaceRoot);
  const historical = authenticatePublishedHostUpdateArtifact(
    await readRegularAuthority(
      path.join(workspaceRoot, ARTIFACT_RELATIVE_PATH),
      ARTIFACT_RELATIVE_PATH,
    ),
  );
  const currentGraphAudit = {
    appSourceAudit: currentArtifact.authority.appSourceAudit,
    referenceHostSourceAudit: currentArtifact.authority.referenceHostSourceAudit,
    runtimeResolution: currentArtifact.authority.runtimeResolution,
  };
  const t08GraphAudit = recoverySuccessor.authority?.currentGraphAudit;
  const t11GraphAudit = projectM10AT12CurrentGraphAudit(currentGraphAudit, t08GraphAudit);
  const t10GraphAudit = projectM10AT11CurrentGraphAudit(t11GraphAudit, t08GraphAudit);
  projectM10AT01CurrentGraphAudit(
    projectM10AT10IsolatedAppSourceInventory(t10GraphAudit, t08GraphAudit),
    t08GraphAudit,
  );
  const currentReceipts = currentArtifact.boundary.trackedReceipts;
  const historicalReceipts = new Map(
    historical.boundary.trackedReceipts.map((receipt) => [receipt.path, receipt]),
  );
  const successorReceipts = new Map(
    successor.boundary.trackedReceipts.map((receipt) => [receipt.path, receipt]),
  );
  const recoveryReceipts = new Map(
    recoverySuccessor.boundary.trackedReceipts.map((receipt) => [receipt.path, receipt]),
  );
  const t11CurrentSourceReceipts = new Map(
    t11GraphAudit.appSourceAudit.sourceReceipts.map((receipt) => [receipt.path, receipt]),
  );
  const t11TrackedSourceSuccessors = new Map(
    M10A_T11_APP_SOURCE_SUCCESSORS.filter(({ path: relativePath }) =>
      APP_SOURCE_PATHS.includes(relativePath),
    ).map((receipt) => [receipt.path, receipt]),
  );
  const t12TrackedSourceSuccessors = new Map(
    [
      ...M10A_T12_APP_SOURCE_SUCCESSORS.filter(({ path: relativePath }) =>
        APP_SOURCE_PATHS.includes(relativePath),
      ),
      ...M10A_T12_REPLACED_T08_INPUT_RECEIPTS,
      M10A_T14_APP_SOURCE_SUCCESSOR,
    ].map((receipt) => [receipt.path, receipt]),
  );
  for (const receipt of currentReceipts) {
    const t12SourceSuccessor = t12TrackedSourceSuccessors.get(receipt.path);
    if (
      t12SourceSuccessor !== undefined &&
      (receipt.bytes !== t12SourceSuccessor.bytes ||
        receipt.sha256 !== t12SourceSuccessor.sha256.slice("sha256:".length))
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "A tracked App source is outside the exact reviewed T12 replacement receipt.",
        { path: receipt.path },
      );
    }
    const t11SourceSuccessor = t11TrackedSourceSuccessors.get(receipt.path);
    if (t11SourceSuccessor !== undefined) {
      const freshReceipt = t11CurrentSourceReceipts.get(receipt.path);
      if (
        freshReceipt?.bytes !== t11SourceSuccessor.bytes ||
        freshReceipt.sha256 !== t11SourceSuccessor.sha256 ||
        (t12SourceSuccessor === undefined &&
          (receipt.bytes !== freshReceipt.bytes ||
            receipt.sha256 !== freshReceipt.sha256.slice("sha256:".length)))
      ) {
        fail(
          "SUCCESSOR_POLICY_VIOLATION",
          "A tracked App source is outside the exact reviewed T11 replacement receipt.",
          { path: receipt.path },
        );
      }
      continue;
    }
    const expected = T08_REVIEWED_CHANGED_PATHS.includes(receipt.path)
      ? recoveryReceipts.get(receipt.path)
      : T06_REVIEWED_CHANGED_PATHS.includes(receipt.path)
        ? successorReceipts.get(receipt.path)
        : historicalReceipts.get(receipt.path);
    if (
      expected === undefined ||
      (t12SourceSuccessor === undefined && !isDeepStrictEqual(receipt, expected))
    ) {
      fail(
        "SUCCESSOR_POLICY_VIOLATION",
        "A current T05 input is outside its exact reviewed successor receipt.",
        { path: receipt.path },
      );
    }
  }
  if (
    !isDeepStrictEqual(
      currentReceipts.map(({ path: filePath }) => filePath),
      [...historicalReceipts.keys(), ...T06_ADDED_APP_PATHS].sort((left, right) =>
        left.localeCompare(right, "en-US"),
      ),
    )
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The predecessor/successor path relation drifted.");
  }
  // Only these explicit historical fields may differ. Every other claim and observation is
  // compared in full; the fresh current graph remains separately exposed, never relabeled.
  const artifact = deepFreeze({
    ...currentArtifact,
    authority: {
      ...currentArtifact.authority,
      source: {
        ...currentArtifact.authority.source,
        flowWorkspaceCannotReceivePublicationPort:
          historical.authority.source.flowWorkspaceCannotReceivePublicationPort,
      },
      focusedTests: {
        ...currentArtifact.authority.focusedTests,
        declarationSites: historical.authority.focusedTests.declarationSites,
        totalDeclarationSites: historical.authority.focusedTests.totalDeclarationSites,
      },
      appSourceAudit: historical.authority.appSourceAudit,
      referenceHostSourceAudit: historical.authority.referenceHostSourceAudit,
      runtimeResolution: historical.authority.runtimeResolution,
    },
    boundary: {
      ...currentArtifact.boundary,
      trackedFiles: historical.boundary.trackedFiles,
      trackedReceipts: historical.boundary.trackedReceipts,
      completeAppSourceFiles: historical.boundary.completeAppSourceFiles,
    },
  });
  if (!isDeepStrictEqual(artifact, historical)) {
    fail("SUCCESSOR_POLICY_VIOLATION", "An unreviewed historical T05 field would be projected.");
  }
  return deepFreeze({
    artifact,
    liveSuccessorAuthority: {
      task: "M10-T08",
      artifact: { path: T08_SUCCESSOR_PATH, ...T08_SUCCESSOR_PIN },
      compositionSuccessor: {
        task: "M10-T08",
        artifact: { path: T08_SUCCESSOR_PATH, ...T08_SUCCESSOR_PIN },
        reviewedChangedInputs: [...T08_REVIEWED_CHANGED_PATHS, "pnpm-lock.yaml"],
        productSourceUnchanged: false,
      },
      currentGraphAudit,
      currentSourcePolicy: currentArtifact.authority.source,
      currentFocusedTestDeclarations: currentArtifact.authority.focusedTests,
      m10aIsolatedAppSourceInventory: M10A_T10_ISOLATED_APP_SOURCE_PATHS,
      m10aReachableAppSourcePaths: M10A_T11_REACHABLE_APP_SOURCE_PATHS,
      projectedHistoricalFields: [
        "authority.source.flowWorkspaceCannotReceivePublicationPort",
        "authority.focusedTests.declarationSites",
        "authority.focusedTests.totalDeclarationSites",
        "authority.appSourceAudit",
        "authority.referenceHostSourceAudit",
        "authority.runtimeResolution",
        "boundary.trackedFiles",
        "boundary.trackedReceipts",
        "boundary.completeAppSourceFiles",
      ],
      currentObservationsAreNotHistoricalResults: true,
    },
  });
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
  const buildOptions = captureBuildOptions(options.buildOptions);
  // Rejected caller-supplied identities need no compilation. Accepted identities still require
  // fresh observations below, and all caller-owned options are captured before the first await.
  if (suppliedArtifactBytes !== undefined) {
    authenticatePublishedHostUpdateArtifact(suppliedArtifactBytes);
  }
  if (suppliedProofDocument !== undefined) {
    verifyProofDocument(suppliedProofDocument, DESEN_APP_PUBLISHED_HOST_UPDATE_ARTIFACT_PIN.sha256);
  }
  // Path admission can reject unsafe inputs but cannot authorize their contents.
  // The existing reads below reacquire both authorities after the fresh builds.
  if (suppliedArtifactBytes === undefined) {
    await readRegularAuthority(artifactPath, ARTIFACT_RELATIVE_PATH);
  }
  if (suppliedProofDocument === undefined) {
    await readRegularAuthority(proofDocumentPath, PROOF_DOCUMENT_RELATIVE_PATH);
  }
  const built = await buildDesenAppPublishedHostUpdateEvidence(buildOptions);
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
    graphCountsDescribe: "immutable M10-T05 task-time evidence",
    currentSuccessor: {
      task: built.liveSuccessorAuthority.task,
      artifact: built.liveSuccessorAuthority.artifact,
      appGraphModules:
        built.liveSuccessorAuthority.currentGraphAudit.runtimeResolution.app.moduleCount,
      hostGraphModules:
        built.liveSuccessorAuthority.currentGraphAudit.runtimeResolution.host.moduleCount,
      sharedManagedModules:
        built.liveSuccessorAuthority.currentGraphAudit.runtimeResolution.sharedManagedModuleCount,
      observationsAreFresh: true,
      observationsAreNotHistoricalResults: true,
    },
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
  const currentSuccessor = await readT06SuccessorArtifact(workspaceRoot);
  const demoSuccessor = await readT08SuccessorArtifact(workspaceRoot);
  for (const relativePath of T08_ADDED_APP_PATHS) {
    assertT08Receipt(
      demoSuccessor,
      relativePath,
      await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath),
    );
  }
  const currentReceipts = new Map(
    currentSuccessor.boundary.trackedReceipts.map((receipt) => [receipt.path, receipt]),
  );
  for (const relativePath of T06_ADDED_APP_PATHS) {
    const bytes = await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath);
    const receipt = currentReceipts.get(relativePath);
    if (receipt?.bytes !== bytes.byteLength || receipt.sha256 !== sha256(bytes)) {
      fail("SUCCESSOR_POLICY_VIOLATION", "A reviewed T06-added App source changed.", {
        relativePath,
      });
    }
  }
  const currentInspector = await readRegularAuthority(
    path.join(workspaceRoot, T06_INSPECTOR_PATH),
    T06_INSPECTOR_PATH,
  );
  const t06Inspector = projectM10AT12HistoricalInput(T06_INSPECTOR_PATH, currentInspector);
  const currentInspectorReceipt = currentReceipts.get(T06_INSPECTOR_PATH);
  if (
    currentInspectorReceipt?.bytes !== t06Inspector.byteLength ||
    currentInspectorReceipt.sha256 !== sha256(t06Inspector)
  ) {
    fail("SUCCESSOR_POLICY_VIOLATION", "The projected T06 Inspector source changed.");
  }
  // This file had not changed since T01B and therefore has no older retained bridge entry.
  // Admit both endpoints: exact current T06 bytes and the exact frozen T05 receipt. Only the
  // three reviewed additive fragments may be reversed; this never supplies current build data.
  let historicalInspectorText = decodeUtf8(
    t06Inspector,
    T06_INSPECTOR_PATH,
    "SUCCESSOR_POLICY_VIOLATION",
  );
  for (const addition of T06_INSPECTOR_ADDITIONS) {
    if (occurrenceCount(historicalInspectorText, addition) !== 1) {
      fail("SUCCESSOR_POLICY_VIOLATION", "The reviewed T06 Inspector inverse patch is not exact.");
    }
    historicalInspectorText = historicalInspectorText.replace(addition, "");
  }
  const historicalInspector = Buffer.from(historicalInspectorText);
  const historicalInspectorReceipt = artifact.boundary.trackedReceipts.find(
    (receipt) => receipt.path === T06_INSPECTOR_PATH,
  );
  if (
    historicalInspectorReceipt?.bytes !== historicalInspector.byteLength ||
    historicalInspectorReceipt.sha256 !== sha256(historicalInspector)
  ) {
    fail(
      "SUCCESSOR_POLICY_VIOLATION",
      "The historical Inspector projection changed its frozen receipt.",
    );
  }
  SUCCESSOR_AUTHORITIES.set(successor, {
    ...bridge,
    files: new Map([...bridge.files, [T06_INSPECTOR_PATH, historicalInspector]]),
    successorAddedPaths: new Set([
      ...bridge.successorAddedPaths,
      ...T06_ADDED_APP_PATHS,
      ...T08_ADDED_APP_PATHS,
    ]),
  });
  await readT08SuccessorArtifact(workspaceRoot);
  for (const relativePath of T08_ADDED_APP_PATHS) {
    assertT08Receipt(
      demoSuccessor,
      relativePath,
      await readRegularAuthority(path.join(workspaceRoot, relativePath), relativePath),
    );
  }
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

/** Returns a defensive copy of one exact M10-T01A ancestor-gap file. */
export function readDesenAppT01aHistoricalReaderGapFile(successor, relativePath) {
  if (!safeRelativePath(relativePath)) {
    fail("OPTIONS_INVALID", "relativePath must be one safe relative path.");
  }
  const authority = successorAuthority(successor);
  const bytes = authority.t01aAncestor.files.get(relativePath);
  if (bytes === undefined) {
    fail("OPTIONS_INVALID", "relativePath has no M10-T01A ancestor gap entry.", { relativePath });
  }
  return Buffer.from(bytes);
}

/** Removes only exact authenticated T05/T06-added paths from a historical T04 inventory. */
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

async function preflightArtifactDestination(artifactPath) {
  try {
    const destination = await canonicalDestinationPath(artifactPath);
    const metadata = await lstat(destination).catch((error) => {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    });
    if (metadata !== undefined && !metadata.isFile()) {
      throw new TypeError("The artifact destination must be a regular file.");
    }
  } catch (error) {
    fail("ARTIFACT_WRITE_UNSAFE", "The M10-T05 artifact destination is unsafe.", {
      cause: String(error),
    });
  }
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
  const buildOptions = captureBuildOptions(options.buildOptions);
  // This mirrors the atomic writer's existing policy without retaining a write
  // capability: canonical destination and inode checks still run after the build.
  await preflightArtifactDestination(artifactPath);
  const built = await buildDesenAppPublishedHostUpdateEvidence(buildOptions);
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
